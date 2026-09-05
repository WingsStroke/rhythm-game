import type { AudioBands } from '../types';

export interface ModulatedChannels {
  /** Low frequency power smoothed for punchy vibrations and scale pulses (0..1). */
  bassIntensity: number;
  /** High frequency energy smoothed for particle velocity and sparkle effects (0..1). */
  trebleDispersion: number;
  /** Broad ambient energy for background lighting and glow adjustments (0..1). */
  ambientBrightness: number;
  /** Mid-frequency presence for scenery reactivity and UI elements (0..1). */
  midsReactivity: number;
}

export interface AudioModulatorConfig {
  bassAttack?: number;
  bassDecay?: number;
  trebleAttack?: number;
  trebleDecay?: number;
  midsAttack?: number;
  midsDecay?: number;
  ambientAttack?: number;
  ambientDecay?: number;
}

/**
 * AudioModulator provides asymmetric attack/decay smoothing over audio frequency bands.
 * It prevents visual flickering caused by raw FFT fluctuations while maintaining instant
 * responsiveness to acoustic transients (kicks, snares, cymbals).
 */
export class AudioModulator {
  private _bass = 0;
  private _treble = 0;
  private _ambient = 0;
  private _mids = 0;

  private config: Required<AudioModulatorConfig>;

  constructor(config?: AudioModulatorConfig) {
    this.config = {
      bassAttack: config?.bassAttack ?? 0.75,
      bassDecay: config?.bassDecay ?? 0.08,
      trebleAttack: config?.trebleAttack ?? 0.7,
      trebleDecay: config?.trebleDecay ?? 0.12,
      midsAttack: config?.midsAttack ?? 0.65,
      midsDecay: config?.midsDecay ?? 0.1,
      ambientAttack: config?.ambientAttack ?? 0.5,
      ambientDecay: config?.ambientDecay ?? 0.06,
    };
  }

  /**
   * Updates modulated channels using current frame's audio bands.
   */
  public update(bands: AudioBands): void {
    const rawBass = Math.max(0, Math.min(1, bands.bass));
    const rawTreble = Math.max(0, Math.min(1, bands.treble));
    const rawMids = Math.max(0, Math.min(1, bands.mids));
    const rawAmbient = Math.max(0, Math.min(1, bands.amplitude));

    this._bass = this.processChannel(
      rawBass,
      this._bass,
      this.config.bassAttack,
      this.config.bassDecay
    );

    this._treble = this.processChannel(
      rawTreble,
      this._treble,
      this.config.trebleAttack,
      this.config.trebleDecay
    );

    this._mids = this.processChannel(
      rawMids,
      this._mids,
      this.config.midsAttack,
      this.config.midsDecay
    );

    this._ambient = this.processChannel(
      rawAmbient,
      this._ambient,
      this.config.ambientAttack,
      this.config.ambientDecay
    );
  }

  private processChannel(
    raw: number,
    current: number,
    attackRate: number,
    decayRate: number
  ): number {
    const rate = raw > current ? attackRate : decayRate;
    const next = current + (raw - current) * rate;
    return Math.max(0, Math.min(1, next));
  }

  /** Low frequency power for background pulsing and scale reactions (0..1). */
  public get bassIntensity(): number {
    return this._bass;
  }

  /** High frequency dispersion for particle velocities and jitter (0..1). */
  public get trebleDispersion(): number {
    return this._treble;
  }

  /** Mid-frequency presence for UI and scenery elements (0..1). */
  public get midsReactivity(): number {
    return this._mids;
  }

  /** Overall amplitude for ambient lighting and brightness modulation (0..1). */
  public get ambientBrightness(): number {
    return this._ambient;
  }

  /** Snapshot of all modulated virtual channels. */
  public get channels(): ModulatedChannels {
    return {
      bassIntensity: this._bass,
      trebleDispersion: this._treble,
      ambientBrightness: this._ambient,
      midsReactivity: this._mids,
    };
  }

  /** Reset all channels to zero (e.g. on pause or track reset). */
  public reset(): void {
    this._bass = 0;
    this._treble = 0;
    this._ambient = 0;
    this._mids = 0;
  }
}
