import { Application, Container, Graphics, Text, ColorMatrixFilter, Filter, Ticker } from 'pixi.js';
import type { LevelData, Note, PadId, PadConfig, AudioBands, Judgement } from '../types';
import { AudioEngine } from '../audio/AudioEngine';

/**
 * VisualEngine — all rendering using PixiJS v8.
 *
 * Architecture:
 *  - Scene graph with layers: background, notes, pads, particles, effects.
 *  - Objects are PixiJS Containers/Graphics — NOT stored in the beatmap.
 *  - The beatmap describes WHAT; this engine decides HOW to render it.
 *  - Audio reactivity: background, pads, and particles respond to FFT bands.
 *  - Custom GLSL filters for bloom-like glow and RGB shift.
 *  - Particle system for hit bursts and ambient effects.
 *
 * The game loop calls update(audioTime, audioBands) each frame. Rendering
 * is driven by PixiJS's ticker, but positions/sizes use audio time — not
 * frame count — so behavior is frame-rate independent.
 */

const FALL_DISTANCE = 600; // pixels notes travel before reaching the pad
const NOTE_SIZE = 56;
const PAD_HEIGHT = 90;

interface PadVisual {
  container: Container;
  rect: Graphics;
  label: Text;
  glow: Graphics;
  baseColor: number;
  pressed: boolean;
  pressAnim: number;
  x: number;
  bandIndex: number;
}

interface ParticlePool {
  particles: Graphics[];
  index: number;
}

export class VisualEngine {
  private app: Application;
  private stage: Container;
  private root: HTMLElement;

  // Layers
  private bgLayer: Container;
  private noteLayer: Container;
  private padLayer: Container;
  private particleLayer: Container;
  private fxLayer: Container;

  // Visual objects
  private bgRect: Graphics;
  private bgGrid: Graphics;
  private noteGraphics: Map<Note, Graphics> = new Map();
  private padVisuals: Map<PadId, PadVisual> = new Map();
  private particles: ParticlePool;
  private scoreText: Text;
  private comboText: Text;

  // Config
  private pads: PadConfig[];
  private notes: Note[];
  private padXPositions: Map<PadId, number> = new Map();
  private padY: number;
  private leadTime: number; // seconds for a note to fall from top to pad

  // Audio-reactive state
  private beatPulse = 0;

  constructor(root: HTMLElement, level: LevelData, audio: AudioEngine) {
    this.root = root;
    this.pads = level.pads;
    this.notes = level.notes;
    this.padY = 0;
    this.leadTime = 1.5; // notes appear 1.5s before hit time

    this.app = new Application();
    this.stage = this.app.stage;
    this.stage.sortableChildren = true;

    this.bgLayer = new Container(); this.bgLayer.zIndex = 0;
    this.noteLayer = new Container(); this.noteLayer.zIndex = 10;
    this.padLayer = new Container(); this.padLayer.zIndex = 20;
    this.particleLayer = new Container(); this.particleLayer.zIndex = 15;
    this.fxLayer = new Container(); this.fxLayer.zIndex = 25;

    this.stage.addChild(this.bgLayer, this.noteLayer, this.particleLayer, this.padLayer, this.fxLayer);

    this.bgRect = new Graphics();
    this.bgGrid = new Graphics();
    this.scoreText = new Text({ text: '0', style: { fontFamily: 'monospace', fontSize: 28, fill: 0xffffff } });
    this.comboText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 36, fill: 0xffffff } });
    this.particles = { particles: [], index: 0 };
  }

  async init(): Promise<void> {
    await this.app.init({
      width: 800,
      height: 600,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: this.root,
    });
    this.root.appendChild(this.app.canvas);

    this.setupScene();
    this.setupFilters();
  }

  private setupScene(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.padY = h - PAD_HEIGHT - 20;

    const padCount = this.pads.length;
    const totalPadWidth = padCount * 100 + (padCount - 1) * 20;
    const startX = (w - totalPadWidth) / 2;

    // Background fill
    this.bgRect.rect(0, 0, w, h).fill({ color: 0x0a0a16 });
    this.bgLayer.addChild(this.bgRect);
    this.bgLayer.addChild(this.bgGrid);

    // Build pads
    this.pads.forEach((pad, i) => {
      const x = startX + i * 120;
      this.padXPositions.set(pad.id, x);

      const container = new Container();
      container.x = x;
      container.y = this.padY;

      const glow = new Graphics();
      glow.roundRect(-15, -15, 130, PAD_HEIGHT + 30, 12).fill({ color: this.hexToInt(pad.color), alpha: 0.15 });
      glow.zIndex = 0;
      container.addChild(glow);

      const rect = new Graphics();
      rect.roundRect(0, 0, 100, PAD_HEIGHT, 10).fill({ color: this.hexToInt(pad.color), alpha: 0.3 });
      rect.stroke({ color: this.hexToInt(pad.color), width: 2, alpha: 0.6 });
      rect.zIndex = 1;
      container.addChild(rect);

      const label = new Text({
        text: pad.label,
        style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff, align: 'center' },
      });
      label.anchor.set(0.5);
      label.x = 50;
      label.y = PAD_HEIGHT / 2;
      label.zIndex = 2;
      container.addChild(label);

      this.padLayer.addChild(container);

      this.padVisuals.set(pad.id, {
        container, rect, label, glow,
        baseColor: this.hexToInt(pad.color),
        pressed: false, pressAnim: 0, x,
        bandIndex: i,
      });
    });

    // HUD
    this.scoreText.x = 20;
    this.scoreText.y = 20;
    this.fxLayer.addChild(this.scoreText);

    this.comboText.anchor.set(0.5);
    this.comboText.x = w / 2;
    this.comboText.y = 60;
    this.fxLayer.addChild(this.comboText);

    // Pre-allocate particle pool (50 particles)
    for (let i = 0; i < 50; i++) {
      const p = new Graphics();
      p.visible = false;
      this.particleLayer.addChild(p);
      this.particles.particles.push(p);
    }
  }

  private bloomFilter: ColorMatrixFilter | null = null;
  private rgbFilter: Filter | null = null;

  private setupFilters(): void {
    // Bloom approximation via color matrix (brightness boost)
    this.bloomFilter = new ColorMatrixFilter();
    this.bloomFilter.brightness(1.08, false);
    this.fxLayer.filters = [this.bloomFilter];

    // Simple RGB-split / chromatic aberration via custom shader
    const fragShader = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform float uTime;
      uniform float uBass;
      uniform float uAmp;
      void main() {
        vec2 uv = vTextureCoord;
        float shift = 0.003 + uBass * 0.01 + uAmp * 0.005;
        float r = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
        float g = texture2D(uTexture, uv).g;
        float b = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
        float a = texture2D(uTexture, uv).a;
        gl_FragColor = vec4(r, g, b, a);
      }
    `;
    // Apply RGB shift to the note + particle layers for a "music intensity" feel
    // Using PixiJS v8 Filter API (GL only — WebGL backend)
    this.rgbFilter = new Filter({
      gl: { fragment: fragShader },
    } as ConstructorParameters<typeof Filter>[0]);
    // We update uniforms each frame in update()
    this.noteLayer.filters = [this.rgbFilter];
  }

  private hexToInt(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  /** Spawn a particle burst at a position with a given color. */
  private spawnBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles.particles[this.particles.index];
      this.particles.index = (this.particles.index + 1) % this.particles.particles.length;

      p.clear();
      p.circle(0, 0, 3 + Math.random() * 4).fill({ color, alpha: 0.9 });
      p.x = x;
      p.y = y;
      p.visible = true;
      p.alpha = 1;

      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      (p as Graphics & { _vx?: number; _vy?: number; _life?: number })._vx = Math.cos(angle) * speed;
      (p as Graphics & { _vx?: number; _vy?: number; _life?: number })._vy = Math.sin(angle) * speed - 50;
      (p as Graphics & { _vx?: number; _vy?: number; _life?: number })._life = 1.0;
    }
  }

  /** Animate pad press feedback. */
  pressPad(padId: PadId): void {
    const pv = this.padVisuals.get(padId);
    if (pv) {
      pv.pressed = true;
      pv.pressAnim = 1.0;
    }
  }

  releasePad(padId: PadId): void {
    const pv = this.padVisuals.get(padId);
    if (pv) pv.pressed = false;
  }

  /** Trigger judgement-specific visual effects. */
  showJudgement(note: Note, judgement: Judgement): void {
    const pv = this.padVisuals.get(note.pad);
    if (!pv) return;

    const color = pv.baseColor;
    const x = pv.x + 50;
    const y = this.padY + PAD_HEIGHT / 2;

    if (judgement === 'perfect') {
      this.spawnBurst(x, y, color, 12);
      this.spawnBurst(x, y, 0xffffff, 6);
    } else if (judgement === 'good') {
      this.spawnBurst(x, y, color, 6);
    } else {
      // Miss — red flash
      this.spawnBurst(x, y, 0xff3333, 4);
    }
  }

  updateScore(score: number, combo: number): void {
    this.scoreText.text = score.toLocaleString();
    this.comboText.text = combo > 1 ? `${combo}x COMBO` : '';
    this.comboText.style.fill = combo > 20 ? 0xffcc00 : 0xffffff;
  }

  onBeat(beatIndex: number): void {
    this.beatPulse = 1.0;
  }

  /**
   * Main update — called every frame with audio time and band data.
   */
  update(audioTime: number, bands: AudioBands): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // --- Background: react to bass + beat pulse ---
    const bgIntensity = bands.bass * 0.6 + this.beatPulse * 0.4;
    const bgHue = 0x0a0a16;
    const r = ((bgHue >> 16) & 0xff) + bgIntensity * 40;
    const g = ((bgHue >> 8) & 0xff) + bgIntensity * 20;
    const b = (bgHue & 0xff) + bgIntensity * 60;
    this.bgRect.clear();
    this.bgRect.rect(0, 0, w, h).fill({ color: (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b) });

    // Grid lines that pulse on beats
    this.bgGrid.clear();
    const gridAlpha = 0.05 + this.beatPulse * 0.1 + bands.mids * 0.05;
    const gridSpacing = 40 + bands.bass * 10;
    this.bgGrid.setStrokeStyle({ width: 1, color: 0x3a3a5a, alpha: gridAlpha });
    for (let x = 0; x < w; x += gridSpacing) {
      this.bgGrid.moveTo(x, 0).lineTo(x, h);
    }
    for (let y = 0; y < h; y += gridSpacing) {
      this.bgGrid.moveTo(0, y).lineTo(w, y);
    }
    this.bgGrid.stroke();
    this.beatPulse *= 0.92; // decay

    // --- RGB shift filter uniforms ---
    if (this.rgbFilter) {
      const u = this.rgbFilter as unknown as { uniforms: Record<string, number> };
      u.uniforms.uTime = audioTime;
      u.uniforms.uBass = bands.bass;
      u.uniforms.uAmp = bands.amplitude;
    }

    // --- Notes: create/destroy/update positions ---
    // Remove notes that are past
    for (const [note, gfx] of this.noteGraphics) {
      if (note.time + 0.5 < audioTime) {
        gfx.destroy();
        this.noteGraphics.delete(note);
      }
    }

    // Spawn upcoming notes
    for (const note of this.notes) {
      if (this.noteGraphics.has(note)) continue;
      const timeUntilHit = note.time - audioTime;
      if (timeUntilHit > this.leadTime || timeUntilHit < -0.3) continue;

      const padConfig = this.pads.find(p => p.id === note.pad);
      if (!padConfig) continue;

      const gfx = new Graphics();
      const color = this.hexToInt(padConfig.color);
      gfx.roundRect(-NOTE_SIZE / 2, -NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE, 8).fill({ color, alpha: 0.85 });
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      this.noteLayer.addChild(gfx);
      this.noteGraphics.set(note, gfx);
    }

    // Update note positions
    for (const [note, gfx] of this.noteGraphics) {
      const x = this.padXPositions.get(note.pad) ?? 0;
      const progress = 1 - (note.time - audioTime) / this.leadTime;
      const y = this.padY + PAD_HEIGHT / 2 - FALL_DISTANCE * progress;
      gfx.x = x + 50;
      gfx.y = y;

      // Scale slightly as they approach
      const scale = 0.8 + progress * 0.2;
      gfx.scale.set(scale);

      // Fade in at the top
      if (progress < 0.1) gfx.alpha = progress * 10;
      else gfx.alpha = 1;
    }

    // --- Pads: audio-reactive + press animation ---
    for (const [, pv] of this.padVisuals) {
      let bandValue = 0;
      if (pv.bandIndex === 0) bandValue = bands.bass;
      else if (pv.bandIndex === 1) bandValue = bands.mids;
      else if (pv.bandIndex === 2) bandValue = bands.treble;
      else bandValue = bands.amplitude;

      const idleGlow = 0.15 + bandValue * 0.3;
      const pressGlow = pv.pressAnim * 0.5;

      pv.glow.clear();
      pv.glow.roundRect(-15 - bandValue * 5, -15 - bandValue * 5, 130 + bandValue * 10, PAD_HEIGHT + 30 + bandValue * 10, 12)
        .fill({ color: pv.baseColor, alpha: idleGlow + pressGlow });

      pv.rect.clear();
      const fillAlpha = 0.3 + bandValue * 0.2 + pv.pressAnim * 0.4;
      pv.rect.roundRect(0, 0, 100, PAD_HEIGHT, 10).fill({ color: pv.baseColor, alpha: fillAlpha });
      pv.rect.stroke({ color: pv.baseColor, width: 2 + pv.pressAnim * 2, alpha: 0.6 + pv.pressAnim * 0.4 });

      // Scale pulse on press
      const pressScale = 1 + pv.pressAnim * 0.15;
      pv.container.scale.set(pressScale);
      pv.container.x = pv.x - (pressScale - 1) * 50;
      pv.container.y = this.padY - (pressScale - 1) * PAD_HEIGHT / 2;

      pv.pressAnim *= 0.85;
    }

    // --- Particles: update physics ---
    for (const p of this.particles.particles) {
      if (!p.visible) continue;
      const ext = p as Graphics & { _vx?: number; _vy?: number; _life?: number };
      if (ext._life === undefined || ext._life <= 0) {
        p.visible = false;
        continue;
      }
      const dt = 1 / 60; // approximate
      p.x += (ext._vx ?? 0) * dt;
      p.y += (ext._vy ?? 0) * dt;
      ext._vy = (ext._vy ?? 0) + 400 * dt; // gravity
      ext._life -= dt * 2;
      p.alpha = Math.max(0, ext._life);
      p.scale.set(Math.max(0.1, ext._life));
    }

    // --- Combo text scale pulse ---
    if (this.comboText.text) {
      this.comboText.scale.set(1 + bands.amplitude * 0.1);
    }
  }

  private tickerCb: ((ticker: Ticker) => void) | null = null;

  /** Register an external update callback on PixiJS's ticker. */
  setUpdateCallback(cb: (ticker: Ticker) => void): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.tickerCb = cb;
    this.app.ticker.add(cb);
  }

  get screen(): { width: number; height: number } {
    return { width: this.app.screen.width, height: this.app.screen.height };
  }

  dispose(): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.app.destroy(true);
    if (this.app.canvas.parentNode) {
      this.app.canvas.parentNode.removeChild(this.app.canvas);
    }
  }
}
