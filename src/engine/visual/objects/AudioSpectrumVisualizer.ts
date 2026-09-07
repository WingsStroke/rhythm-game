import { Container, Graphics } from 'pixi.js';
import { safeParseColor } from './SceneNode';

export type SpectrumRenderMode = 'bars' | 'curve' | 'radial';

export interface AudioSpectrumProperties {
  width?: number;
  height?: number;
  bands?: number;
  mode?: SpectrumRenderMode;
  color?: string | number;
  gap?: number;
  attack?: number;
  decay?: number;
  gain?: number;
  minFreq?: number;
  maxFreq?: number;
  sampleRate?: number;
}

/**
 * AudioSpectrumVisualizer renders a high-performance, real-time frequency spectrum
 * mapped across perceptual Mel/logarithmic bands with asymmetric attack/decay ballistics.
 */
export class AudioSpectrumVisualizer extends Container {
  private graphics: Graphics;
  public spectrumWidth = 420;
  public spectrumHeight = 120;
  public bandsCount = 32;
  public mode: SpectrumRenderMode = 'bars';
  public color = 0x00e5ff;
  public gap = 3;
  public attack = 0.75;
  public decay = 0.88;
  public gain = 1.0;
  public minFreq = 40;
  public maxFreq = 14000;

  private currentSampleRate = 44100;
  private currentFftSize = 512;
  private smoothedBands: Float32Array;
  private binRanges: [number, number][] = [];

  constructor(props: Record<string, unknown> = {}) {
    super();
    this.graphics = new Graphics();
    this.addChild(this.graphics);

    this.bandsCount = Math.max(8, Math.min(64, (props.bands as number) || 32));
    this.smoothedBands = new Float32Array(this.bandsCount);

    this.applyProperties(props);
    this.recomputeBinRanges(this.currentSampleRate, this.currentFftSize);
    this.renderFallback();
  }

  public applyProperties(props: Record<string, unknown>): void {
    if (props.width !== undefined) this.spectrumWidth = Math.max(20, props.width as number);
    if (props.height !== undefined) this.spectrumHeight = Math.max(10, props.height as number);
    if (props.color !== undefined) this.color = safeParseColor(props.color, 0x00e5ff);
    if (props.gap !== undefined) this.gap = Math.max(0, props.gap as number);
    if (props.mode !== undefined) {
      const m = String(props.mode);
      if (m === 'bars' || m === 'curve' || m === 'radial') {
        this.mode = m;
      }
    }
    if (props.attack !== undefined) this.attack = Math.max(0.1, Math.min(1.0, props.attack as number));
    if (props.decay !== undefined) this.decay = Math.max(0.1, Math.min(0.99, props.decay as number));
    if (props.gain !== undefined) this.gain = Math.max(0.1, Math.min(5.0, props.gain as number));
    if (props.sampleRate !== undefined) {
      const sr = Number(props.sampleRate);
      if (sr > 0 && sr !== this.currentSampleRate) {
        this.currentSampleRate = sr;
      }
    }

    if (props.bands !== undefined) {
      const newBands = Math.max(8, Math.min(64, props.bands as number));
      if (newBands !== this.bandsCount) {
        this.bandsCount = newBands;
        this.smoothedBands = new Float32Array(this.bandsCount);
        this.recomputeBinRanges(this.currentSampleRate, this.currentFftSize);
      }
    }
  }

  public setSampleRate(sampleRate: number): void {
    if (!sampleRate || sampleRate <= 0 || sampleRate === this.currentSampleRate) return;
    this.currentSampleRate = sampleRate;
    this.recomputeBinRanges(this.currentSampleRate, this.currentFftSize);
  }

  /**
   * Precomputes logarithmic/Mel bin boundaries across the FFT frequency range
   * to avoid any runtime allocation in per-frame update cycles.
   */
  public recomputeBinRanges(sampleRate = 44100, fftSize = 512): void {
    const totalBins = fftSize / 2;
    const binWidth = sampleRate / fftSize;
    this.binRanges = [];

    const minF = Math.max(20, this.minFreq);
    const maxF = Math.min(sampleRate / 2, this.maxFreq);

    for (let k = 0; k < this.bandsCount; k++) {
      const fStart = minF * Math.pow(maxF / minF, k / this.bandsCount);
      const fEnd = minF * Math.pow(maxF / minF, (k + 1) / this.bandsCount);

      const binStart = Math.min(totalBins - 1, Math.max(1, Math.floor(fStart / binWidth)));
      const binEnd = Math.min(totalBins, Math.max(binStart + 1, Math.ceil(fEnd / binWidth)));
      this.binRanges.push([binStart, binEnd]);
    }
  }

  /**
   * Updates band values using raw FFT byte data (0-255) and re-renders display object.
   */
  public update(fftData: Uint8Array): void {
    if (!fftData || fftData.length === 0) {
      this.decayOnly();
      return;
    }

    const n = this.bandsCount;
    for (let k = 0; k < n; k++) {
      const range = this.binRanges[k];
      if (!range) continue;
      const [start, end] = range;

      let sum = 0;
      let count = 0;
      for (let b = start; b < end; b++) {
        if (b < fftData.length) {
          sum += fftData[b];
          count++;
        }
      }

      const raw = count > 0 ? Math.min(1.2, ((sum / count) / 255.0) * this.gain) : 0;

      // Asymmetric ballistics: fast attack on onset, smooth exponential decay on release
      if (raw > this.smoothedBands[k]) {
        this.smoothedBands[k] = this.smoothedBands[k] + (raw - this.smoothedBands[k]) * this.attack;
      } else {
        this.smoothedBands[k] = this.smoothedBands[k] * this.decay;
      }
    }

    this.renderSpectrum();
  }

  public decayOnly(): void {
    let hasChanged = false;
    for (let k = 0; k < this.bandsCount; k++) {
      const resting = 0.05 + Math.sin((k / this.bandsCount) * Math.PI) * 0.08;
      if (this.smoothedBands[k] > resting + 0.001) {
        this.smoothedBands[k] = Math.max(resting, this.smoothedBands[k] * this.decay);
        hasChanged = true;
      } else if (this.smoothedBands[k] < resting - 0.001) {
        this.smoothedBands[k] = Math.min(resting, this.smoothedBands[k] + (resting - this.smoothedBands[k]) * 0.1);
        hasChanged = true;
      }
    }
    if (hasChanged) {
      this.renderSpectrum();
    }
  }

  private renderFallback(): void {
    // Initial resting state visualization
    for (let k = 0; k < this.bandsCount; k++) {
      this.smoothedBands[k] = 0.08 + Math.sin((k / this.bandsCount) * Math.PI) * 0.15;
    }
    this.renderSpectrum();
  }

  private renderSpectrum(): void {
    this.graphics.clear();
    const B = this.bandsCount;
    const w = this.spectrumWidth;
    const h = this.spectrumHeight;

    if (this.mode === 'bars') {
      const totalGaps = (B - 1) * this.gap;
      const barW = Math.max(1, (w - totalGaps) / B);
      const halfW = w / 2;
      const bottomY = h / 2;

      for (let i = 0; i < B; i++) {
        const val = Math.max(0.02, Math.min(1.0, this.smoothedBands[i]));
        const barH = val * h;
        const x = -halfW + i * (barW + this.gap);
        const y = bottomY - barH;
        this.graphics.rect(x, y, barW, barH);
      }
      this.graphics.fill({ color: this.color });
    } else if (this.mode === 'curve') {
      const stepX = w / (B - 1);
      const halfW = w / 2;
      const bottomY = h / 2;

      for (let i = 0; i < B; i++) {
        const val = Math.max(0.02, Math.min(1.0, this.smoothedBands[i]));
        const x = -halfW + i * stepX;
        const y = bottomY - val * h;

        if (i === 0) {
          this.graphics.moveTo(x, y);
        } else {
          this.graphics.lineTo(x, y);
        }
      }
      this.graphics.stroke({ width: 3, color: this.color });
    } else if (this.mode === 'radial') {
      const angleStep = (Math.PI * 2) / B;
      const baseRadius = Math.max(10, h * 0.35);
      const maxExt = h * 0.65;

      for (let i = 0; i < B; i++) {
        const val = Math.max(0.02, Math.min(1.0, this.smoothedBands[i]));
        const angle = i * angleStep - Math.PI / 2;
        const len = val * maxExt;
        const x1 = Math.cos(angle) * baseRadius;
        const y1 = Math.sin(angle) * baseRadius;
        const x2 = Math.cos(angle) * (baseRadius + len);
        const y2 = Math.sin(angle) * (baseRadius + len);

        this.graphics.moveTo(x1, y1);
        this.graphics.lineTo(x2, y2);
      }
      this.graphics.stroke({ width: Math.max(2, this.gap || 2), color: this.color });
    }
  }
}
