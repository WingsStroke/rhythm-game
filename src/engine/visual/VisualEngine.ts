import { Application, Container, Graphics, Text, ColorMatrixFilter, Filter, Ticker } from 'pixi.js';
import type { LevelData, Note, PadId, PadConfig, AudioBands, Judgement } from '../types';
import { AudioEngine } from '../audio/AudioEngine';
import { SceneGraph } from './SceneGraph';
import { Animator } from './Animator';

/**
 * VisualEngine — all rendering using PixiJS v8.
 *
 * Scene graph with layers: background, lanes, notes, pads, particles, effects.
 * The beatmap describes WHAT; this engine decides HOW to render it.
 * Audio reactivity: background, pads, and particles respond to FFT bands.
 */

const FALL_DISTANCE = 600;
const NOTE_SIZE = 56;
const PAD_HEIGHT = 90;

interface PadVisual {
  container: Container;
  rect: Graphics;
  label: Text;
  keyText: Text;
  glow: Graphics;
  baseColor: number;
  pressed: boolean;
  pressAnim: number;
  x: number;
  bandIndex: number;
}

interface JudgementPopup {
  text: Text;
  life: number;
  maxLife: number;
  baseX: number;
  baseY: number;
}

export class VisualEngine {
  private app: Application;
  private root: HTMLElement;
  private level: LevelData;
  private pads: PadConfig[];
  private notes: Note[];

  // Layers — created in init()
  private bgLayer!: Container;
  private noteLayer!: Container;
  private padLayer!: Container;
  private particleLayer!: Container;
  private fxLayer!: Container;
  private sceneLayer!: Container;

  // Scene Graph
  private sceneGraph!: SceneGraph;
  private animator!: Animator;

  // Visual objects
  private bgRect!: Graphics;
  private bgGrid!: Graphics;
  private laneGfx!: Graphics;
  private noteGraphics: Map<Note, Graphics> = new Map();
  private padVisuals: Map<PadId, PadVisual> = new Map();
  private particlePool: Graphics[] = [];
  private particleIndex = 0;
  private judgementPopups: JudgementPopup[] = [];
  private scoreText!: Text;
  private comboText!: Text;

  private padXPositions: Map<PadId, number> = new Map();
  private padY = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private leadTime = 1.5;
  private beatPulse = 0;
  private bloomFilter: ColorMatrixFilter | null = null;
  private rgbFilter: Filter | null = null;
  private tickerCb: ((ticker: Ticker) => void) | null = null;

  /** Emitted when player clicks/touches a pad directly */
  public onPadInput: ((padId: PadId, pressed: boolean) => void) | null = null;

  constructor(root: HTMLElement, level: LevelData, _audio: AudioEngine) {
    this.root = root;
    this.level = level;
    this.pads = level.pads;
    this.notes = level.notes;
    this.app = new Application();
  }

  async init(): Promise<void> {
    await this.app.init({
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

  public syncNotes(newNotes: Note[]): void {
    // Destroy graphics for notes that are no longer in the new array
    for (const [note, gfx] of this.noteGraphics) {
      if (!newNotes.includes(note)) {
        gfx.destroy();
        this.noteGraphics.delete(note);
      }
    }
    this.notes = newNotes;
  }

  private setupScene(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.lastWidth = w;
    this.lastHeight = h;
    this.padY = h - PAD_HEIGHT - 30;

    // Create layers
    this.bgLayer = new Container();
    this.noteLayer = new Container();
    this.padLayer = new Container();
    this.particleLayer = new Container();
    this.fxLayer = new Container();
    this.sceneLayer = new Container();

    this.bgLayer.zIndex = 0;
    this.sceneLayer.zIndex = 5;
    this.noteLayer.zIndex = 10;
    this.padLayer.zIndex = 20;
    this.particleLayer.zIndex = 15;
    this.fxLayer.zIndex = 25;

    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(this.bgLayer, this.sceneLayer, this.noteLayer, this.particleLayer, this.padLayer, this.fxLayer);

    // Initialize SceneGraph
    this.sceneGraph = new SceneGraph(this.sceneLayer);
    this.animator = new Animator(this.sceneGraph);
    
    // Load data-driven visual elements
    this.sceneGraph.buildFromData(this.level);
    if (this.level.visual?.animations) {
      this.animator.setAnimations(this.level.visual.animations);
    }

    // Background rect & grid
    this.bgRect = new Graphics();
    this.bgGrid = new Graphics();
    this.laneGfx = new Graphics();
    this.bgRect.rect(0, 0, w, h).fill({ color: 0x070714 });
    this.bgLayer.addChild(this.bgRect);
    this.bgLayer.addChild(this.bgGrid);
    this.bgLayer.addChild(this.laneGfx);

    // Pads
    const padCount = this.pads.length;
    const padWidth = 100;
    const padGap = 20;
    const totalPadWidth = padCount * padWidth + (padCount - 1) * padGap;
    const startX = (w - totalPadWidth) / 2;

    this.pads.forEach((pad, i) => {
      const x = startX + i * (padWidth + padGap);
      this.padXPositions.set(pad.id, x);
      const color = this.hexToInt(pad.color);

      const container = new Container();
      container.x = x;
      container.y = this.padY;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Mouse & touch interaction on pad
      container.on('pointerdown', (e) => {
        e.stopPropagation();
        this.onPadInput?.(pad.id, true);
      });
      container.on('pointerup', (e) => {
        e.stopPropagation();
        this.onPadInput?.(pad.id, false);
      });
      container.on('pointerupoutside', () => {
        this.onPadInput?.(pad.id, false);
      });

      const glow = new Graphics();
      glow.roundRect(-15, -15, 130, PAD_HEIGHT + 30, 14).fill({ color, alpha: 0.15 });
      glow.zIndex = 0;
      container.addChild(glow);

      const rect = new Graphics();
      rect.roundRect(0, 0, 100, PAD_HEIGHT, 10).fill({ color, alpha: 0.25 });
      rect.stroke({ color, width: 2, alpha: 0.7 });
      rect.zIndex = 1;
      container.addChild(rect);

      // Key hint (A, S, D, F)
      const keyText = new Text({
        text: pad.keyHint || '',
        style: { fontFamily: 'monospace', fontSize: 22, fill: 0xffffff, fontWeight: 'bold' },
      });
      keyText.anchor.set(0.5);
      keyText.x = 50;
      keyText.y = PAD_HEIGHT / 2 - 10;
      keyText.zIndex = 2;
      container.addChild(keyText);

      // Pad role label (Kick, Snare, etc)
      const label = new Text({
        text: pad.label,
        style: { fontFamily: 'monospace', fontSize: 12, fill: 0xcccccc, align: 'center' },
      });
      label.anchor.set(0.5);
      label.x = 50;
      label.y = PAD_HEIGHT / 2 + 16;
      label.zIndex = 2;
      container.addChild(label);

      this.padLayer.addChild(container);
      this.padVisuals.set(pad.id, {
        container, rect, label, keyText, glow,
        baseColor: color,
        pressed: false, pressAnim: 0, x,
        bandIndex: i,
      });
    });

    this.drawLanes();

    // HUD text
    this.scoreText = new Text({ text: '0', style: { fontFamily: 'monospace', fontSize: 28, fill: 0xffffff } });
    this.scoreText.x = 20;
    this.scoreText.y = 20;
    this.fxLayer.addChild(this.scoreText);

    this.comboText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 34, fill: 0xffffff, fontWeight: 'bold' } });
    this.comboText.anchor.set(0.5);
    this.comboText.x = w / 2;
    this.comboText.y = 60;
    this.fxLayer.addChild(this.comboText);

    // Particle pool
    for (let i = 0; i < 60; i++) {
      const p = new Graphics();
      p.visible = false;
      this.particleLayer.addChild(p);
      this.particlePool.push(p);
    }
  }

  private drawLanes(): void {
    this.laneGfx.clear();
    const h = this.app.screen.height;

    for (const pad of this.pads) {
      const x = this.padXPositions.get(pad.id);
      if (x === undefined) continue;
      const color = this.hexToInt(pad.color);

      // Lane background column
      this.laneGfx.rect(x, 0, 100, this.padY + PAD_HEIGHT).fill({ color, alpha: 0.035 });

      // Left & Right lane borders
      this.laneGfx.moveTo(x, 0).lineTo(x, this.padY + PAD_HEIGHT).stroke({ color, width: 1, alpha: 0.18 });
      this.laneGfx.moveTo(x + 100, 0).lineTo(x + 100, this.padY + PAD_HEIGHT).stroke({ color, width: 1, alpha: 0.18 });

      // Target receptor outline on the pad zone
      this.laneGfx.roundRect(x + 5, this.padY + 5, 90, PAD_HEIGHT - 10, 8).stroke({ color, width: 1.5, alpha: 0.35 });
    }
  }

  private updateLayout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w === this.lastWidth && h === this.lastHeight) return;

    this.lastWidth = w;
    this.lastHeight = h;
    this.padY = h - PAD_HEIGHT - 30;

    const padCount = this.pads.length;
    const padWidth = 100;
    const padGap = 20;
    const totalPadWidth = padCount * padWidth + (padCount - 1) * padGap;
    const startX = (w - totalPadWidth) / 2;

    this.pads.forEach((pad, i) => {
      const x = startX + i * (padWidth + padGap);
      this.padXPositions.set(pad.id, x);
      const pv = this.padVisuals.get(pad.id);
      if (pv) {
        pv.x = x;
        if (!pv.pressed && pv.pressAnim < 0.05) {
          pv.container.x = x;
          pv.container.y = this.padY;
        }
      }
    });

    if (this.comboText) {
      this.comboText.x = w / 2;
    }

    this.drawLanes();
  }

  private setupFilters(): void {
    try {
      this.bloomFilter = new ColorMatrixFilter();
      this.bloomFilter.brightness(1.06, false);
      this.fxLayer.filters = [this.bloomFilter];
    } catch {
      this.bloomFilter = null;
    }

    try {
      const fragShader = `
        precision mediump float;
        varying vec2 vTextureCoord;
        uniform sampler2D uTexture;
        uniform float uTime;
        uniform float uBass;
        uniform float uAmp;
        void main() {
          vec2 uv = vTextureCoord;
          float shift = 0.002 + uBass * 0.006 + uAmp * 0.003;
          float r = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
          float g = texture2D(uTexture, uv).g;
          float b = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
          float a = texture2D(uTexture, uv).a;
          gl_FragColor = vec4(r, g, b, a);
        }
      `;
      this.rgbFilter = new Filter({
        gl: { fragment: fragShader },
      } as ConstructorParameters<typeof Filter>[0]);
      this.noteLayer.filters = [this.rgbFilter];
    } catch {
      this.rgbFilter = null;
    }
  }

  private hexToInt(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  private spawnBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool[this.particleIndex];
      this.particleIndex = (this.particleIndex + 1) % this.particlePool.length;

      p.clear();
      p.circle(0, 0, 3 + Math.random() * 4).fill({ color, alpha: 0.95 });
      p.x = x;
      p.y = y;
      p.visible = true;
      p.alpha = 1;

      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 220;
      const ext = p as Graphics & { _vx?: number; _vy?: number; _life?: number };
      ext._vx = Math.cos(angle) * speed;
      ext._vy = Math.sin(angle) * speed - 60;
      ext._life = 1.0;
    }
  }

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

  showJudgement(note: Note, judgement: Judgement): void {
    // 1. Immediately remove note sprite from screen
    const noteGfx = this.noteGraphics.get(note);
    if (noteGfx) {
      noteGfx.destroy();
      this.noteGraphics.delete(note);
    }

    const pv = this.padVisuals.get(note.pad);
    if (!pv) return;
    const x = pv.x + 50;
    const y = this.padY + PAD_HEIGHT / 2;

    // 2. Spawn particles
    if (judgement === 'perfect') {
      this.spawnBurst(x, y, pv.baseColor, 14);
      this.spawnBurst(x, y, 0xffffff, 8);
    } else if (judgement === 'good') {
      this.spawnBurst(x, y, pv.baseColor, 8);
    } else {
      this.spawnBurst(x, y, 0xff3344, 6);
    }

    // 3. Floating Judgement popup
    let textStr = 'PERFECT!';
    let textColor = 0xffcc00;
    let fontSize = 20;

    if (judgement === 'good') {
      textStr = 'GOOD';
      textColor = 0x00e5ff;
      fontSize = 17;
    } else if (judgement === 'miss') {
      textStr = 'MISS';
      textColor = 0xff3344;
      fontSize = 17;
    }

    const popupText = new Text({
      text: textStr,
      style: {
        fontFamily: 'monospace',
        fontSize,
        fill: textColor,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    popupText.anchor.set(0.5);
    popupText.x = x;
    popupText.y = this.padY - 24;
    popupText.scale.set(1.25);
    this.fxLayer.addChild(popupText);

    this.judgementPopups.push({
      text: popupText,
      life: 0.65,
      maxLife: 0.65,
      baseX: x,
      baseY: this.padY - 24,
    });
  }

  updateScore(score: number, combo: number): void {
    this.scoreText.text = score.toLocaleString();
    this.comboText.text = combo > 1 ? `${combo}x COMBO` : '';
    this.comboText.style.fill = combo > 20 ? 0xffcc00 : 0xffffff;
  }

  onBeat(_beatIndex: number): void {
    this.beatPulse = 1.0;
  }

  update(audioTime: number, bands: AudioBands): void {
    this.updateLayout();
    
    // Update data-driven animations
    if (this.animator) {
      this.animator.update(audioTime);
    }

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // Background reaction to bass & beats
    const bgIntensity = bands.bass * 0.6 + this.beatPulse * 0.4;
    const br = Math.min(255, 7 + bgIntensity * 35);
    const bg = Math.min(255, 7 + bgIntensity * 18);
    const bb = Math.min(255, 20 + bgIntensity * 55);
    this.bgRect.clear();
    this.bgRect.rect(0, 0, w, h).fill({ color: (Math.round(br) << 16) | (Math.round(bg) << 8) | Math.round(bb) });

    // Grid pulse
    this.bgGrid.clear();
    const gridAlpha = 0.04 + this.beatPulse * 0.08 + bands.mids * 0.04;
    const gridSpacing = 40 + bands.bass * 8;
    for (let gx = 0; gx < w; gx += gridSpacing) {
      this.bgGrid.moveTo(gx, 0).lineTo(gx, h);
    }
    for (let gy = 0; gy < h; gy += gridSpacing) {
      this.bgGrid.moveTo(0, gy).lineTo(w, gy);
    }
    this.bgGrid.stroke({ width: 1, color: 0x303055, alpha: gridAlpha });
    this.beatPulse *= 0.92;

    // RGB shift uniforms safe update
    if (this.rgbFilter) {
      try {
        const u = this.rgbFilter as unknown as {
          resources?: { filterUniforms?: { uniforms?: Record<string, number> } };
          uniforms?: Record<string, number>;
        };
        if (u.resources?.filterUniforms?.uniforms) {
          u.resources.filterUniforms.uniforms.uTime = audioTime;
          u.resources.filterUniforms.uniforms.uBass = bands.bass;
          u.resources.filterUniforms.uniforms.uAmp = bands.amplitude;
        } else if (u.uniforms) {
          u.uniforms.uTime = audioTime;
          u.uniforms.uBass = bands.bass;
          u.uniforms.uAmp = bands.amplitude;
        }
      } catch {
        // Ignored
      }
    }

    // Cleanup notes that fell past the pads
    for (const [note, gfx] of this.noteGraphics) {
      if (note.time + 0.4 < audioTime) {
        gfx.destroy();
        this.noteGraphics.delete(note);
      }
    }

    // Spawn notes approaching within leadTime window
    for (const note of this.notes) {
      if (this.noteGraphics.has(note)) continue;
      const timeUntilHit = note.time - audioTime;
      if (timeUntilHit > this.leadTime || timeUntilHit < -0.2) continue;
      const padConfig = this.pads.find(p => p.id === note.pad);
      if (!padConfig) continue;

      const gfx = new Graphics();
      const color = this.hexToInt(padConfig.color);
      // Note body with glow stroke
      gfx.roundRect(-NOTE_SIZE / 2, -NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE, 8).fill({ color, alpha: 0.92 });
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      this.noteLayer.addChild(gfx);
      this.noteGraphics.set(note, gfx);
    }

    // Note positions: fall from top towards pad center
    const targetY = this.padY + PAD_HEIGHT / 2;
    for (const [note, gfx] of this.noteGraphics) {
      const x = this.padXPositions.get(note.pad) ?? 0;
      // progress goes from 0.0 (far away at spawn) to 1.0 (exact hit moment)
      const progress = 1 - (note.time - audioTime) / this.leadTime;
      // Correct downward fall trajectory: starts at targetY - FALL_DISTANCE and arrives at targetY
      const y = targetY - FALL_DISTANCE * (1 - progress);

      gfx.x = x + 50;
      gfx.y = y;
      gfx.scale.set(0.85 + Math.min(progress, 1) * 0.15);
      gfx.alpha = progress < 0.08 ? progress * 12.5 : 1;
    }

    // Pad animations
    for (const [, pv] of this.padVisuals) {
      let bandValue = 0;
      if (pv.bandIndex === 0) bandValue = bands.bass;
      else if (pv.bandIndex === 1) bandValue = bands.mids;
      else if (pv.bandIndex === 2) bandValue = bands.treble;
      else bandValue = bands.amplitude;

      const idleGlow = 0.12 + bandValue * 0.28;
      const pressGlow = pv.pressAnim * 0.55;

      pv.glow.clear();
      pv.glow.roundRect(-15 - bandValue * 4, -15 - bandValue * 4, 130 + bandValue * 8, PAD_HEIGHT + 30 + bandValue * 8, 14)
        .fill({ color: pv.baseColor, alpha: idleGlow + pressGlow });

      pv.rect.clear();
      const fillAlpha = 0.25 + bandValue * 0.18 + pv.pressAnim * 0.45;
      pv.rect.roundRect(0, 0, 100, PAD_HEIGHT, 10).fill({ color: pv.baseColor, alpha: fillAlpha });
      pv.rect.stroke({ color: pv.baseColor, width: 2 + pv.pressAnim * 2.5, alpha: 0.6 + pv.pressAnim * 0.4 });

      const pressScale = 1 + pv.pressAnim * 0.12;
      pv.container.scale.set(pressScale);
      pv.container.x = pv.x - (pressScale - 1) * 50;
      pv.container.y = this.padY - (pressScale - 1) * (PAD_HEIGHT / 2);
      pv.pressAnim *= 0.84;
    }

    // Particles update
    const dt = 1 / 60;
    for (const p of this.particlePool) {
      if (!p.visible) continue;
      const ext = p as Graphics & { _vx?: number; _vy?: number; _life?: number };
      if (ext._life === undefined || ext._life <= 0) {
        p.visible = false;
        continue;
      }
      p.x += (ext._vx ?? 0) * dt;
      p.y += (ext._vy ?? 0) * dt;
      ext._vy = (ext._vy ?? 0) + 420 * dt;
      ext._life -= dt * 2.2;
      p.alpha = Math.max(0, ext._life);
      p.scale.set(Math.max(0.1, ext._life));
    }

    // Judgement popups update
    for (let i = this.judgementPopups.length - 1; i >= 0; i--) {
      const popup = this.judgementPopups[i];
      popup.life -= dt;
      if (popup.life <= 0) {
        popup.text.destroy();
        this.judgementPopups.splice(i, 1);
        continue;
      }
      const tRatio = 1 - popup.life / popup.maxLife;
      popup.text.y = popup.baseY - tRatio * 32;
      popup.text.alpha = Math.min(1, popup.life / (popup.maxLife * 0.35));
      const sc = 1.25 - tRatio * 0.25;
      popup.text.scale.set(Math.max(1, sc));
    }

    // Combo text pulse
    if (this.comboText.text) {
      this.comboText.scale.set(1 + bands.amplitude * 0.12);
    }
  }

  setUpdateCallback(cb: (ticker: Ticker) => void): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.tickerCb = cb;
    this.app.ticker.add(cb);
  }

  dispose(): void {
    if (this.tickerCb) {
      try {
        this.app.ticker?.remove(this.tickerCb);
      } catch {
        // Ticker already stopped
      }
      this.tickerCb = null;
    }

    for (const [, gfx] of this.noteGraphics) {
      try {
        if (!gfx.destroyed) gfx.destroy();
      } catch {
        // Ignored
      }
    }
    this.noteGraphics.clear();

    for (const popup of this.judgementPopups) {
      try {
        if (!popup.text.destroyed) popup.text.destroy();
      } catch {
        // Ignored
      }
    }
    this.judgementPopups = [];

    // Safely capture canvas reference before destroying Application
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = this.app.canvas;
    } catch {
      canvas = null;
    }

    try {
      this.app.destroy(true, { children: true });
    } catch (err) {
      console.warn('Notice during Pixi app destroy:', err);
    }

    try {
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    } catch {
      // Ignored
    }
  }
}
