import { Application, Container, Graphics, Text, ColorMatrixFilter, Filter, Ticker } from 'pixi.js';
import type {
  LevelData,
  PadEvent,
  PadId,
  PadState,
  PadConfig,
  AudioBands,
  Judgement,
  SceneNodeData,
  TriggerData,
  EffectType,
  ModulationChannel,
} from '../types';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ModulatedChannels } from '../audio/AudioModulator';
import { AudioModulator } from '../audio/AudioModulator';
import { SceneGraph } from './SceneGraph';
import { Animator } from './Animator';
import { TriggerDispatcher } from './TriggerDispatcher';
import { ParticlePool } from './ParticlePool';
import type { GameplayEventBus } from '../gameplay/GameplayEventBus';

/**
 * VisualEngine — modular and reactive presentation engine using PixiJS v8.
 *
 * Layer Hierarchy:
 *  - bgLayer (zIndex: 0): Ambient reactive background & grid (full screen)
 *  - virtualStage (zIndex: 5): 1920x1080 logical coordinate stage with letterbox/pillarbox
 *    - sceneLayer (zIndex: 5): User/level designer scene graph nodes & triggers
 *    - laneLayer (zIndex: 10): Target columns and hit receptors (never occluded by scene nodes)
 *    - noteLayer (zIndex: 15): Incoming falling notes (guaranteed visibility)
 *    - padLayer (zIndex: 20): Interactive pads with glow feedback
 *    - fxLayer (zIndex: 25): Particle bursts & hit flares
 *    - hudLayer (zIndex: 30): Score, combo, and floating judgement labels
 */

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
  state: PadState;
  stateAnim: number;
  x: number;
  channel: ModulationChannel;
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
  private events: PadEvent[];

  // Strict Layer Hierarchy
  private bgLayer!: Container;
  private sceneLayer!: Container;
  private laneLayer!: Container;
  private noteLayer!: Container;
  private padLayer!: Container;
  private fxLayer!: Container;
  private hudLayer!: Container;

  // Scene Graph & Trigger Systems
  private sceneGraph!: SceneGraph;
  private animator!: Animator;
  private triggerDispatcher!: TriggerDispatcher;
  private audioModulator: AudioModulator;
  private particlePool!: ParticlePool;

  // Event Bus & Listeners
  private eventBus?: GameplayEventBus;
  private eventUnsubscribers: (() => void)[] = [];

  // Visual objects
  private bgRect!: Graphics;
  private bgGrid!: Graphics;
  private laneGfx!: Graphics;
  private noteGraphics: Map<PadEvent, Graphics> = new Map();
  private padVisuals: Map<PadId, PadVisual> = new Map();
  private judgementPopups: JudgementPopup[] = [];
  private scoreText!: Text;
  private comboText!: Text;

  private padXPositions: Map<PadId, number> = new Map();
  private padY = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private leadTime = 1.5;
  private beatPulse = 0;
  private lastAudioTime = 0;
  private bloomFilter: ColorMatrixFilter | null = null;
  private rgbFilter: Filter | null = null;
  private tickerCb: ((ticker: Ticker) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  /** Emitted when player clicks/touches a pad directly */
  public onPadInput: ((padId: PadId, pressed: boolean) => void) | null = null;
  /** Emitted when a SceneNode is clicked */
  public onNodeSelect: ((nodeId: string) => void) | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(root: HTMLElement, level: LevelData, _audio?: AudioEngine | null) {
    this.root = root;
    this.level = level;
    this.pads = level.pads;
    this.events = level.events;
    this.app = new Application();
    this.audioModulator = new AudioModulator();
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

    this.resizeHandler = () => {
      try {
        this.app.resize();
        this.updateLayout();
      } catch {
        // Ignored
      }
    };
    window.addEventListener('resize', this.resizeHandler);

    if (typeof ResizeObserver !== 'undefined' && this.root) {
      this.resizeObserver = new ResizeObserver(() => {
        try {
          this.app.resize();
          this.updateLayout();
        } catch {
          // Ignored
        }
      });
      this.resizeObserver.observe(this.root);
    }
  }

  public syncEvents(newEvents: PadEvent[]): void {
    // Destroy graphics for events that are no longer in the new array
    for (const [event, gfx] of this.noteGraphics) {
      if (!newEvents.includes(event)) {
        gfx.destroy();
        this.noteGraphics.delete(event);
      }
    }
    this.events = newEvents;
  }

  public syncLevelVisual(level: LevelData): void {
    this.level = level;
    this.sceneGraph.buildFromData(level);
    if (level.visual?.animations) {
      this.animator.setAnimations(level.visual.animations);
    }
    if (level.visual?.triggers) {
      this.triggerDispatcher.setTriggers(level.visual.triggers);
    }
    this.setupFilters();
  }

  public syncVisualNodes(nodes: SceneNodeData[]): void {
    this.level.visual.nodes = nodes;
    this.sceneGraph.buildFromData(this.level);
  }

  public syncVisualTriggers(triggers: TriggerData[]): void {
    this.level.visual.triggers = triggers;
    this.triggerDispatcher.setTriggers(triggers);
  }

  /**
   * Connects to a GameplayEventBus to receive decoupled gameplay notifications.
   */
  public attachEventBus(bus: GameplayEventBus): void {
    this.detachEventBus();
    this.eventBus = bus;

    this.eventUnsubscribers.push(
      bus.subscribe('HIT_PERFECT', (gameEvent) => {
        if (gameEvent.event) this.showJudgement(gameEvent.event, 'perfect');
        if (gameEvent.score !== undefined && gameEvent.combo !== undefined) {
          this.updateScore(gameEvent.score, gameEvent.combo);
        }
      }),
      bus.subscribe('HIT_GOOD', (gameEvent) => {
        if (gameEvent.event) this.showJudgement(gameEvent.event, 'good');
        if (gameEvent.score !== undefined && gameEvent.combo !== undefined) {
          this.updateScore(gameEvent.score, gameEvent.combo);
        }
      }),
      bus.subscribe('HIT_MISS', (gameEvent) => {
        if (gameEvent.event) this.showJudgement(gameEvent.event, 'miss');
        if (gameEvent.score !== undefined && gameEvent.combo !== undefined) {
          this.updateScore(gameEvent.score, gameEvent.combo);
        }
      }),
      bus.subscribe('COMBO_BREAK', () => {
        if (this.comboText) {
          this.comboText.text = '';
        }
      }),
      bus.subscribe('PAD_STATE_CHANGE', (gameEvent) => {
        const pv = this.padVisuals.get(gameEvent.padId);
        if (pv && gameEvent.newState) {
          pv.state = gameEvent.newState;
          if (gameEvent.newState === 'success') {
            this.pressPad(gameEvent.padId);
            this.particlePool.spawn(pv.x + 50, this.padY + PAD_HEIGHT / 2, pv.baseColor, 10, 1.2);
          } else if (gameEvent.newState === 'miss') {
            pv.stateAnim = 1.0;
          } else if (gameEvent.newState === 'queued') {
            pv.stateAnim = 1.0;
          }
        }
      }),
      bus.subscribe('TRIGGER_TRIGGERED', (gameEvent) => {
        if (gameEvent.triggerId && this.triggerDispatcher) {
          this.triggerDispatcher.fireTrigger(gameEvent.triggerId);
        }
      })
    );
  }

  public detachEventBus(): void {
    for (const unsub of this.eventUnsubscribers) {
      unsub();
    }
    this.eventUnsubscribers = [];
    this.eventBus = undefined;
  }

  private setupScene(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.lastWidth = w;
    this.lastHeight = h;
    const viewportH = Math.min(h, this.root.clientHeight || window.innerHeight, window.innerHeight);
    this.padY = Math.max(60, viewportH - PAD_HEIGHT - 35);

    // 1. Create layers with strict zIndex hierarchy directly on app.stage
    this.bgLayer = new Container();
    this.bgLayer.zIndex = 0;

    this.sceneLayer = new Container();
    this.sceneLayer.zIndex = 5;

    this.laneLayer = new Container();
    this.laneLayer.zIndex = 10;

    this.noteLayer = new Container();
    this.noteLayer.zIndex = 15;

    this.padLayer = new Container();
    this.padLayer.zIndex = 20;

    this.fxLayer = new Container();
    this.fxLayer.zIndex = 25;

    this.hudLayer = new Container();
    this.hudLayer.zIndex = 30;

    this.app.stage.sortableChildren = true;
    this.app.stage.addChild(
      this.bgLayer,
      this.sceneLayer,
      this.laneLayer,
      this.noteLayer,
      this.padLayer,
      this.fxLayer,
      this.hudLayer
    );

    // Scale and center sceneLayer to virtual 1920x1080 stage
    const sceneScale = Math.min(w / 1920, h / 1080);
    this.sceneLayer.scale.set(sceneScale);
    this.sceneLayer.x = (w - 1920 * sceneScale) / 2;
    this.sceneLayer.y = (h - 1080 * sceneScale) / 2;

    // 2. Initialize SceneGraph, Animator, and TriggerDispatcher
    this.sceneGraph = new SceneGraph(this.sceneLayer);
    this.animator = new Animator(this.sceneGraph);
    this.triggerDispatcher = new TriggerDispatcher(this.sceneGraph, this.animator);

    this.triggerDispatcher.onEffect = (effectType, targetId, props) => {
      this.handleVisualEffect(effectType, targetId, props);
    };

    // Load data-driven visual elements
    this.sceneGraph.buildFromData(this.level);
    if (this.level.visual?.animations) {
      this.animator.setAnimations(this.level.visual.animations);
    }
    if (this.level.visual?.triggers) {
      this.triggerDispatcher.setTriggers(this.level.visual.triggers);
    }

    // 3. Background rect & grid
    this.bgRect = new Graphics();
    this.bgGrid = new Graphics();
    this.laneGfx = new Graphics();

    this.bgRect.rect(0, 0, w, h).fill({ color: 0x070714 });
    this.bgLayer.addChild(this.bgRect);
    this.bgLayer.addChild(this.bgGrid);

    // Dedicated lane layer
    this.laneLayer.addChild(this.laneGfx);

    this.sceneGraph.onNodeSelect = (id) => {
      if (this.onNodeSelect) this.onNodeSelect(id);
    };

    // 4. Pads
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
        container,
        rect,
        label,
        keyText,
        glow,
        baseColor: color,
        pressed: false,
        pressAnim: 0,
        state: 'ready',
        stateAnim: 0,
        x,
        channel: this.resolvePadChannel(pad),
      });
    });

    this.drawLanes();

    // 5. HUD layer (score & combo)
    this.scoreText = new Text({
      text: '0',
      style: { fontFamily: 'monospace', fontSize: 28, fill: 0xffffff },
    });
    this.scoreText.x = 40;
    this.scoreText.y = 30;
    this.hudLayer.addChild(this.scoreText);

    this.comboText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 34, fill: 0xffffff, fontWeight: 'bold' },
    });
    this.comboText.anchor.set(0.5);
    this.comboText.x = w / 2;
    this.comboText.y = 60;
    this.hudLayer.addChild(this.comboText);

    // 6. Pre-allocated Particle Pool
    this.particlePool = new ParticlePool(this.fxLayer, 80);
  }

  private handleVisualEffect(
    effectType: EffectType,
    targetId: string | number,
    properties: Record<string, unknown>
  ): void {
    const targetKey = String(targetId);
    if (effectType === 'particleBurst') {
      const targetNodes =
        typeof targetId === 'number'
          ? this.sceneGraph.getNodesByTargetId(targetId)
          : this.sceneGraph.getNode(targetKey)
          ? [this.sceneGraph.getNode(targetKey)!]
          : [];

      if (targetNodes.length > 0) {
        for (const node of targetNodes) {
          const color = properties.color ? this.hexToInt(String(properties.color)) : 0x00e5ff;
          const count = typeof properties.count === 'number' ? properties.count : 16;
          this.particlePool.spawn(node.container.x, node.container.y, color, count);
        }
        return;
      }

      let x = this.app.screen.width / 2;
      let y = this.padY;

      if (this.padXPositions.has(targetKey as PadId)) {
        x = (this.padXPositions.get(targetKey as PadId) ?? 0) + 50;
        y = this.padY + PAD_HEIGHT / 2;
      }

      const color = properties.color ? this.hexToInt(String(properties.color)) : 0x00e5ff;
      const count = typeof properties.count === 'number' ? properties.count : 16;
      this.particlePool.spawn(x, y, color, count);
    } else if (effectType === 'reactivePulse') {
      const targetNodes =
        typeof targetId === 'number'
          ? this.sceneGraph.getNodesByTargetId(targetId)
          : this.sceneGraph.getNode(targetKey)
          ? [this.sceneGraph.getNode(targetKey)!]
          : [];

      for (const node of targetNodes) {
        const currentScale = node.container.scale.x;
        this.animator.addTransition(
          node.id,
          'scale',
          currentScale * 1.35,
          currentScale,
          0.28,
          'easeOutQuad',
          this.lastAudioTime
        );
      }
    }
  }

  private drawLanes(): void {
    this.laneGfx.clear();

    for (const pad of this.pads) {
      const x = this.padXPositions.get(pad.id);
      if (x === undefined) continue;
      const color = this.hexToInt(pad.color);

      // Lane background column
      this.laneGfx.rect(x, 0, 100, this.padY + PAD_HEIGHT).fill({ color, alpha: 0.035 });

      // Left & Right lane borders
      this.laneGfx
        .moveTo(x, 0)
        .lineTo(x, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 1, alpha: 0.18 });
      this.laneGfx
        .moveTo(x + 100, 0)
        .lineTo(x + 100, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 1, alpha: 0.18 });

      // Target receptor outline on the pad zone
      this.laneGfx
        .roundRect(x + 5, this.padY + 5, 90, PAD_HEIGHT - 10, 8)
        .stroke({ color, width: 1.5, alpha: 0.35 });
    }
  }

  private updateLayout(): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    if (screenW === this.lastWidth && screenH === this.lastHeight) return;

    this.lastWidth = screenW;
    this.lastHeight = screenH;

    // Scale and center sceneLayer to 1920x1080 reference stage
    if (this.sceneLayer) {
      const sceneScale = Math.min(screenW / 1920, screenH / 1080);
      this.sceneLayer.scale.set(sceneScale);
      this.sceneLayer.x = (screenW - 1920 * sceneScale) / 2;
      this.sceneLayer.y = (screenH - 1080 * sceneScale) / 2;
    }

    const viewportH = Math.min(screenH, this.root.clientHeight || window.innerHeight, window.innerHeight);
    this.padY = Math.max(60, viewportH - PAD_HEIGHT - 35);

    const padCount = this.pads.length;
    const padWidth = 100;
    const padGap = 20;
    const totalPadWidth = padCount * padWidth + (padCount - 1) * padGap;
    const startX = (screenW - totalPadWidth) / 2;

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
      this.comboText.x = screenW / 2;
    }

    this.drawLanes();
  }

  private setupFilters(): void {
    const settings = this.level.visual?.settings;
    try {
      const bloomIntensity = settings?.bloomIntensity ?? 1.06;
      this.bloomFilter = new ColorMatrixFilter();
      this.bloomFilter.brightness(bloomIntensity, false);
      this.fxLayer.filters = [this.bloomFilter];
    } catch {
      this.bloomFilter = null;
    }

    try {
      const rgbEnabled = settings?.rgbShiftEnabled !== false;
      if (rgbEnabled) {
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
      } else {
        this.rgbFilter = null;
        this.noteLayer.filters = [];
      }
    } catch {
      this.rgbFilter = null;
    }
  }

  private resolvePadChannel(pad: PadConfig): ModulationChannel {
    if (pad.audioChannel) return pad.audioChannel;
    switch (pad.role) {
      case 'kick':
      case 'drums':
      case 'bass':
        return 'bass';
      case 'snare':
      case 'lead':
      case 'synth':
        return 'mids';
      case 'vocal':
      case 'fx':
        return 'treble';
      default:
        return 'ambient';
    }
  }

  private hexToInt(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
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

  showJudgement(event: PadEvent, judgement: Judgement): void {
    // 1. Immediately remove note sprite from screen
    const noteGfx = this.noteGraphics.get(event);
    if (noteGfx) {
      noteGfx.destroy();
      this.noteGraphics.delete(event);
    }

    const pv = this.padVisuals.get(event.padId);
    if (!pv) return;
    const x = pv.x + 50;
    const y = this.padY + PAD_HEIGHT / 2;

    // 2. Spawn particles via ParticlePool
    if (judgement === 'perfect') {
      this.particlePool.spawn(x, y, pv.baseColor, 14);
      this.particlePool.spawn(x, y, 0xffffff, 8);
    } else if (judgement === 'good') {
      this.particlePool.spawn(x, y, pv.baseColor, 8);
    } else {
      this.particlePool.spawn(x, y, 0xff3344, 6);
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
    this.hudLayer.addChild(popupText);

    this.judgementPopups.push({
      text: popupText,
      life: 0.65,
      maxLife: 0.65,
      baseX: x,
      baseY: this.padY - 24,
    });
  }

  updateScore(score: number, combo: number): void {
    if (this.scoreText) {
      this.scoreText.text = score.toLocaleString();
    }
    if (this.comboText) {
      this.comboText.text = combo > 1 ? `${combo}x COMBO` : '';
      this.comboText.style.fill = combo > 20 ? 0xffcc00 : 0xffffff;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBeat(_beatIndex: number): void {
    this.beatPulse = 1.0;
  }

  /**
   * Seeks visual animations, particle states, and triggers to a given audio timestamp.
   */
  public seek(targetTime: number): void {
    this.lastAudioTime = targetTime;
    if (this.animator) {
      this.animator.clearTransitions();
      this.animator.update(targetTime);
    }
    if (this.triggerDispatcher) {
      this.triggerDispatcher.seek(targetTime);
    }
    if (this.particlePool) {
      this.particlePool.reset();
    }
    // Destroy all active note graphics so they cleanly re-instantiate for the new timestamp
    for (const [, gfx] of this.noteGraphics) {
      try {
        if (!gfx.destroyed) gfx.destroy();
      } catch {
        // Ignored
      }
    }
    this.noteGraphics.clear();
  }

  update(audioTime: number, bands: AudioBands): void {
    this.lastAudioTime = audioTime;
    this.updateLayout();

    // 1. AudioModulator smooths frequency bands with asymmetric attack/decay
    this.audioModulator.update(bands);
    const channels = this.audioModulator.channels;

    // 2. Temporal Trigger Dispatcher & Dynamic Animator
    if (this.triggerDispatcher) {
      this.triggerDispatcher.update(audioTime);
    }
    if (this.animator) {
      this.animator.update(audioTime);
    }

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    // 3. Modulated background response from level visual settings
    const settings = this.level.visual?.settings;
    const bgReactive = settings?.backgroundReactive !== false;
    const bgBassMult = settings?.backgroundBassMultiplier ?? 0.6;
    const bgIntensity = bgReactive ? (channels.bassIntensity * bgBassMult + this.beatPulse * 0.4) : 0;
    const br = Math.min(255, 7 + bgIntensity * 35);
    const bg = Math.min(255, 7 + bgIntensity * 18);
    const bb = Math.min(255, 20 + bgIntensity * 55);
    this.bgRect.clear();
    this.bgRect
      .rect(0, 0, w, h)
      .fill({ color: (Math.round(br) << 16) | (Math.round(bg) << 8) | Math.round(bb) });

    // 4. Modulated Grid pulse from level visual settings
    this.bgGrid.clear();
    const gridEnabled = settings?.gridEnabled !== false;
    if (gridEnabled) {
      const gridReactive = settings?.gridReactive !== false;
      const gridAlpha = 0.04 + (gridReactive ? (this.beatPulse * 0.08 + channels.midsReactivity * 0.04) : 0);
      const gridSpacing = 40 + (gridReactive ? channels.bassIntensity * 8 : 0);
      for (let gx = 0; gx < w; gx += gridSpacing) {
        this.bgGrid.moveTo(gx, 0).lineTo(gx, h);
      }
      for (let gy = 0; gy < h; gy += gridSpacing) {
        this.bgGrid.moveTo(0, gy).lineTo(w, gy);
      }
      this.bgGrid.stroke({ width: 1, color: 0x303055, alpha: gridAlpha });
    }
    this.beatPulse *= 0.92;

    // 5. RGB shift uniforms update from level visual settings
    const rgbEnabled = settings?.rgbShiftEnabled !== false;
    const rgbIntensity = rgbEnabled ? (settings?.rgbShiftIntensity ?? 1.0) : 0;
    if (this.rgbFilter) {
      try {
        const u = this.rgbFilter as unknown as {
          resources?: { filterUniforms?: { uniforms?: Record<string, number> } };
          uniforms?: Record<string, number>;
        };
        if (u.resources?.filterUniforms?.uniforms) {
          u.resources.filterUniforms.uniforms.uTime = audioTime;
          u.resources.filterUniforms.uniforms.uBass = channels.bassIntensity * rgbIntensity;
          u.resources.filterUniforms.uniforms.uAmp = channels.ambientBrightness * rgbIntensity;
        } else if (u.uniforms) {
          u.uniforms.uTime = audioTime;
          u.uniforms.uBass = channels.bassIntensity * rgbIntensity;
          u.uniforms.uAmp = channels.ambientBrightness * rgbIntensity;
        }
      } catch {
        // Ignored
      }
    }

    // 5b. Apply declarative real-time Audio Mappings to SceneNodes
    this.applyAudioMappings(channels);

    // 6. Cleanup events that fell past the pads
    for (const [event, gfx] of this.noteGraphics) {
      if (event.targetTime + 0.4 < audioTime) {
        gfx.destroy();
        this.noteGraphics.delete(event);
      }
    }

    // 7. Spawn event sprites approaching within leadTime window
    for (const event of this.events) {
      if (this.noteGraphics.has(event)) continue;
      const timeUntilHit = event.targetTime - audioTime;
      if (timeUntilHit > this.leadTime || timeUntilHit < -0.2) continue;
      const padConfig = this.pads.find((p) => p.id === event.padId);
      if (!padConfig) continue;

      const gfx = new Graphics();
      const color = this.hexToInt(padConfig.color);
      // Note body with glow stroke
      gfx
        .roundRect(-NOTE_SIZE / 2, -NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE, 8)
        .fill({ color, alpha: 0.92 });
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      this.noteLayer.addChild(gfx);
      this.noteGraphics.set(event, gfx);
    }

    // 8. Event positions: fall from top towards pad center
    const targetY = this.padY + PAD_HEIGHT / 2;
    const fallDistance = Math.min(600, Math.max(250, this.padY - 20));
    for (const [event, gfx] of this.noteGraphics) {
      const x = this.padXPositions.get(event.padId) ?? 0;
      const progress = 1 - (event.targetTime - audioTime) / this.leadTime;
      const y = targetY - fallDistance * (1 - progress);

      gfx.x = x + 50;
      gfx.y = y;
      gfx.scale.set(0.85 + Math.min(progress, 1) * 0.15);
      gfx.alpha = progress < 0.08 ? progress * 12.5 : 1;
    }

    // 9. Pad animations driven by PadState and semantic modulated audio channels
    for (const [, pv] of this.padVisuals) {
      let bandValue = 0;
      switch (pv.channel) {
        case 'bass':
          bandValue = channels.bassIntensity;
          break;
        case 'mids':
          bandValue = channels.midsReactivity;
          break;
        case 'treble':
          bandValue = channels.trebleDispersion;
          break;
        case 'ambient':
        default:
          bandValue = channels.ambientBrightness;
          break;
      }

      let idleGlow = 0.12 + bandValue * 0.28;
      const pressGlow = pv.pressAnim * 0.55;
      let fillAlpha = 0.25 + bandValue * 0.18 + pv.pressAnim * 0.45;
      let strokeColor = pv.baseColor;
      let strokeWidth = 2 + pv.pressAnim * 2.5;
      let strokeAlpha = 0.6 + pv.pressAnim * 0.4;
      let pressScale = 1 + pv.pressAnim * 0.12;

      // State-specific visual behaviors
      switch (pv.state) {
        case 'queued': {
          // Pre-cue rhythmic pulse
          const pulse = Math.sin(audioTime * 16) * 0.5 + 0.5;
          strokeWidth = 3 + pulse * 2;
          strokeAlpha = 0.8 + pulse * 0.2;
          idleGlow = 0.25 + pulse * 0.35;
          break;
        }
        case 'playing': {
          // Loop active: 100% full intensity glow modulated in real time
          idleGlow = 0.6 + bandValue * 0.4;
          fillAlpha = 0.5 + bandValue * 0.35;
          strokeWidth = 3 + bandValue * 2;
          strokeAlpha = 0.95;
          pressScale = Math.max(pressScale, 1.0 + bandValue * 0.08);
          break;
        }
        case 'holding': {
          // Holding sustained note: intense glow and continuous edge particles
          idleGlow = 0.7 + bandValue * 0.3;
          fillAlpha = 0.65 + bandValue * 0.25;
          strokeWidth = 4;
          strokeAlpha = 1.0;
          if (Math.random() < 0.35) {
            this.particlePool.spawn(
              pv.x + 15 + Math.random() * 70,
              this.padY + PAD_HEIGHT / 2 + (Math.random() - 0.5) * 20,
              pv.baseColor,
              1,
              0.6
            );
          }
          break;
        }
        case 'miss': {
          // Warning red tint pulse
          if (pv.stateAnim > 0) {
            strokeColor = 0xff3344;
            strokeWidth = 2 + pv.stateAnim * 3;
            strokeAlpha = 0.9;
            pv.stateAnim *= 0.88;
          }
          break;
        }
        case 'ready':
        default:
          break;
      }

      pv.glow.clear();
      pv.glow
        .roundRect(
          -15 - bandValue * 4,
          -15 - bandValue * 4,
          130 + bandValue * 8,
          PAD_HEIGHT + 30 + bandValue * 8,
          14
        )
        .fill({ color: strokeColor, alpha: Math.min(1, idleGlow + pressGlow) });

      pv.rect.clear();
      pv.rect
        .roundRect(0, 0, 100, PAD_HEIGHT, 10)
        .fill({ color: strokeColor, alpha: Math.min(1, fillAlpha) });
      pv.rect.stroke({
        color: strokeColor,
        width: strokeWidth,
        alpha: strokeAlpha,
      });

      pv.container.scale.set(pressScale);
      pv.container.x = pv.x - (pressScale - 1) * 50;
      pv.container.y = this.padY - (pressScale - 1) * (PAD_HEIGHT / 2);
      pv.pressAnim *= 0.84;
    }

    // 10. Update Particle Pool with treble dispersion modulation
    const dt = 1 / 60;
    if (this.particlePool) {
      this.particlePool.update(dt, 1.0 + channels.trebleDispersion * 0.8);
    }

    // 11. Judgement popups update
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

    // 12. Combo text pulse with ambient brightness
    if (this.comboText?.text) {
      this.comboText.scale.set(1 + channels.ambientBrightness * 0.12);
    }
  }

  /**
   * Applies real-time audio modulation channels to SceneNodes based on LevelData.visual.audioMappings.
   */
  private applyAudioMappings(channels: ModulatedChannels): void {
    const mappings = this.level.visual?.audioMappings;
    if (!mappings || mappings.length === 0) return;

    for (const mapping of mappings) {
      let rawSignal = 0;
      switch (mapping.channel) {
        case 'bass':
          rawSignal = channels.bassIntensity;
          break;
        case 'mids':
          rawSignal = channels.midsReactivity;
          break;
        case 'treble':
          rawSignal = channels.trebleDispersion;
          break;
        case 'ambient':
        default:
          rawSignal = channels.ambientBrightness;
          break;
      }

      let delta = rawSignal * mapping.multiplier;
      if (mapping.clampMin !== undefined) delta = Math.max(mapping.clampMin, delta);
      if (mapping.clampMax !== undefined) delta = Math.min(mapping.clampMax, delta);

      const targets =
        mapping.targetId === 'all'
          ? this.sceneGraph.getAllNodes()
          : this.sceneGraph.getNodesByTargetId(mapping.targetId);

      for (const node of targets) {
        node.setModulatedTransform(mapping.property, delta, mapping.baseValue);
      }
    }
  }

  public updateNode(nodeData: SceneNodeData): void {
    const key = nodeData.uid || (typeof nodeData.id === 'string' ? nodeData.id : nodeData.name || '');
    const node = this.sceneGraph.getNode(key);
    if (node) {
      node.updateData(nodeData);
    }
  }

  setUpdateCallback(cb: (ticker: Ticker) => void): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.tickerCb = cb;
    this.app.ticker.add(cb);
  }

  dispose(): void {
    this.detachEventBus();

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

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
    this.events = [];

    for (const popup of this.judgementPopups) {
      try {
        if (!popup.text.destroyed) popup.text.destroy();
      } catch {
        // Ignored
      }
    }
    this.judgementPopups = [];

    if (this.particlePool) {
      this.particlePool.destroy();
    }

    if (this.sceneGraph) {
      this.sceneGraph.dispose();
    }

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
