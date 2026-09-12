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
  VisualEffect,
} from '../types';
import type { AudioEngine } from '../audio/AudioEngine';
import type { ModulatedChannels } from '../audio/AudioModulator';
import { AudioModulator } from '../audio/AudioModulator';
import { SceneGraph } from './SceneGraph';
import { Animator, applyEasing } from './Animator';
import { TriggerDispatcher } from './TriggerDispatcher';
import { ParticlePool } from './ParticlePool';
import { NotePool } from './NotePool';
import { EffectRegistry, createShaderFilter, updateShaderUniforms } from './effects/EffectRegistry';
import { AudioSpectrumVisualizer } from './objects/AudioSpectrumVisualizer';
import { TransformGizmo } from './editor/TransformGizmo';
import type { SceneNode } from './objects/SceneNode';
import type { GameplayEventBus } from '../gameplay/GameplayEventBus';
import { audioTimeToSongTime } from '../time/timeUtils';
import { loadUserKeybindings, getBoundKeyForPad, formatKeyCode, type KeybindingMap } from '../input/Keybindings';

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

const PAD_HEIGHT = 100;

interface PadVisual {
  container: Container;
  socket: Graphics;
  buttonContainer: Container;
  buttonGlow: Graphics;
  buttonBase: Graphics;
  keyText: Text;
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
  private sceneLayer!: Container; // sceneBackgroundLayer (zIndex: 2)
  private sceneAboveLanesLayer!: Container; // sceneAboveLanesLayer (zIndex: 18)
  private sceneAbovePadsLayer!: Container; // sceneAbovePadsLayer (zIndex: 22)
  private sceneForegroundLayer!: Container; // legacy alias for sceneAbovePadsLayer
  private laneLayer!: Container;
  private noteLayer!: Container;
  private padLayer!: Container;
  private fxLayer!: Container;
  private hudLayer!: Container;

  // Editor preview flag
  private isEditorPreview = false;

  // Editor tooling overlay (isolated from level serialization)
  private editorOverlayContainer!: Container;
  private transformGizmo!: TransformGizmo;
  private selectedNodeIds: Set<string> = new Set();

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
  private notePool!: NotePool;
  private activeHoldEventIds: Set<string> = new Set();
  private activeLoopEventIds: Set<string> = new Set();
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
  private currentSongTime = 0;
  private bloomFilter: ColorMatrixFilter | null = null;
  private rgbFilter: Filter | null = null;
  private tickerCb: ((ticker: Ticker) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private mainStage!: Container;
  private audioEngine: AudioEngine | null = null;
  private spectrumBuffer: Uint8Array = new Uint8Array(256);
  private activeVisualEffects: {
    effect: VisualEffect;
    filters: Filter[];
    container?: Container;
    targetNodeId?: string;
    matchedNodes?: import('./objects/SceneNode').SceneNode[];
  }[] = [];

  /** Emitted when player clicks/touches a pad directly */
  public onPadInput: ((padId: PadId, pressed: boolean) => void) | null = null;
  /** Emitted when a SceneNode is clicked with select tool */
  public onNodeSelect: ((nodeId: string | null, isShift?: boolean) => void) | null = null;
  /** Emitted when a SceneNode is clicked with eraser tool */
  public onNodeRemove?: ((nodeId: string) => void) | null = null;
  /** Emitted when multiple SceneNodes are marquee-selected in Live Preview */
  public onNodesSelectBatch?: ((nodeIds: string[], isAdditive: boolean) => void) | null = null;
  /** Emitted when node transforms are modified and committed via Live Preview gizmo */
  public onNodesTransformCommit?: ((nodes: SceneNodeData[]) => void) | null = null;
  /** Emitted when player/creator clicks on the canvas background outside interactive elements */
  public onCanvasClick?: ((stageX: number, stageY: number) => void) | null = null;
  private currentTool: string = 'select';
  private marqueeGfx = new Graphics();

  constructor(
    root: HTMLElement,
    level: LevelData,
    audio?: AudioEngine | null,
    options?: { isEditorPreview?: boolean }
  ) {
    this.root = root;
    this.level = level;
    this.pads = level.pads;
    this.events = level.events;
    this.audioEngine = audio ?? null;
    this.isEditorPreview = Boolean(options?.isEditorPreview);
    this.app = new Application();
    this.audioModulator = new AudioModulator();
  }

  public setAudioEngine(audio: AudioEngine | null): void {
    this.audioEngine = audio;
    if (this.audioEngine && this.sceneGraph) {
      const sr = this.audioEngine.sampleRate;
      for (const node of this.sceneGraph.getSpectrumNodes()) {
        (node.displayObject as AudioSpectrumVisualizer).setSampleRate(sr);
      }
    }
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
    this.setupVisualEffects();

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
    // Release active notes that are no longer present in the updated event list
    if (this.notePool) {
      for (const { event } of this.notePool.getActiveNotes()) {
        if (!newEvents.includes(event)) {
          this.notePool.release(event);
        }
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
    this.setupVisualEffects();
    this.updateSelectionOverlay();
  }

  public syncVisualNodes(nodes: SceneNodeData[]): void {
    this.level.visual.nodes = nodes;
    this.sceneGraph.buildFromData(this.level);
    this.setupVisualEffects();
    this.updateSelectionOverlay();
  }

  public syncVisualTriggers(triggers: TriggerData[]): void {
    this.level.visual.triggers = triggers;
    this.triggerDispatcher.setTriggers(triggers);
  }

  public syncVisualEffects(effects: VisualEffect[]): void {
    if (!this.level.visual) {
      this.level.visual = { nodes: [], triggers: [], animations: [], audioMappings: [], effects: [] };
    }
    this.level.visual.effects = effects;
    this.setupVisualEffects();
  }

  public syncTiming(offset: number): void {
    if (!this.level.timing) {
      this.level.timing = { bpm: 120, offset, windows: { perfect: 0.05, good: 0.1, miss: 0.15 } };
    } else {
      this.level.timing.offset = offset;
    }
  }

  public syncKeybindings(keyMap?: KeybindingMap): void {
    const map = keyMap || loadUserKeybindings(this.level.pads);
    for (const [padId, visual] of this.padVisuals.entries()) {
      const boundKey = getBoundKeyForPad(map, padId);
      const padConfig = this.level.pads.find((p) => p.id === padId);
      const displayKey = boundKey ? formatKeyCode(boundKey) : (padConfig?.keyHint || '');
      visual.keyText.text = displayKey;
    }
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
      bus.subscribe('AUTO_LOOP_HIT', (gameEvent) => {
        const pv = this.padVisuals.get(gameEvent.padId);
        if (pv) {
          pv.pressAnim = 1.0;
          const x = this.padXPositions.get(gameEvent.padId) ?? 0;
          const targetY = this.padY + PAD_HEIGHT / 2;
          this.particlePool?.spawn(x + 50, targetY, pv.baseColor, 5, 1.0);
        }
        if (gameEvent.event) {
          this.notePool?.release(gameEvent.event);
        }
      }),
      bus.subscribe('PAD_STATE_CHANGE', (gameEvent) => {
        const pv = this.padVisuals.get(gameEvent.padId);
        if (pv && gameEvent.newState) {
          pv.state = gameEvent.newState;
          if (gameEvent.newState === 'holding') {
            if (gameEvent.event) {
              this.activeHoldEventIds.add(gameEvent.event.id);
            }
          } else if (gameEvent.newState === 'playing') {
            if (gameEvent.event && gameEvent.event.behavior === 'loop') {
              this.activeLoopEventIds.add(gameEvent.event.id);
            }
          } else if (
            gameEvent.newState === 'success' ||
            gameEvent.newState === 'miss' ||
            gameEvent.newState === 'ready'
          ) {
            if (gameEvent.event) {
              this.activeHoldEventIds.delete(gameEvent.event.id);
              this.activeLoopEventIds.delete(gameEvent.event.id);
              this.notePool?.release(gameEvent.event);
            } else {
              // Clear active holds associated with this pad
              for (const id of Array.from(this.activeHoldEventIds)) {
                const pooled = this.notePool?.get(id);
                if (pooled && pooled.event?.padId === gameEvent.padId) {
                  this.activeHoldEventIds.delete(id);
                  this.notePool?.release(id);
                }
              }
              // Only clear active loops if the loop duration has actually expired
              const songTime = this.currentSongTime;
              for (const id of Array.from(this.activeLoopEventIds)) {
                const pooled = this.notePool?.get(id);
                if (pooled && pooled.event?.padId === gameEvent.padId) {
                  const loopEnd = (pooled.event.targetTime ?? 0) + (pooled.event.duration ?? 0);
                  if (songTime >= loopEnd - 0.05) {
                    this.activeLoopEventIds.delete(id);
                    this.notePool?.release(id);
                  }
                }
              }
            }
          }

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
    this.sceneLayer.zIndex = 2; // sceneBackgroundLayer
    this.sceneLayer.sortableChildren = true;

    this.laneLayer = new Container();
    this.laneLayer.zIndex = 10;

    this.noteLayer = new Container();
    this.noteLayer.zIndex = 15;

    this.sceneAboveLanesLayer = new Container();
    this.sceneAboveLanesLayer.zIndex = 18;
    this.sceneAboveLanesLayer.sortableChildren = true;

    this.padLayer = new Container();
    this.padLayer.zIndex = 20;

    this.sceneAbovePadsLayer = new Container();
    this.sceneAbovePadsLayer.zIndex = 22;
    this.sceneAbovePadsLayer.sortableChildren = true;
    this.sceneForegroundLayer = this.sceneAbovePadsLayer;

    this.fxLayer = new Container();
    this.fxLayer.zIndex = 25;

    this.hudLayer = new Container();
    this.hudLayer.zIndex = 30;

    this.editorOverlayContainer = new Container();
    this.editorOverlayContainer.zIndex = 99;
    this.transformGizmo = new TransformGizmo(this.app, this.sceneLayer);
    this.transformGizmo.onCommit = (updated) => {
      this.onNodesTransformCommit?.(updated);
    };
    this.editorOverlayContainer.addChild(this.transformGizmo);
    this.editorOverlayContainer.addChild(this.marqueeGfx);

    this.app.stage.sortableChildren = true;
    this.mainStage = new Container();
    this.mainStage.sortableChildren = true;
    this.mainStage.filterArea = this.app.screen;
    this.mainStage.zIndex = 1;
    this.mainStage.addChild(
      this.bgLayer,
      this.sceneLayer,
      this.laneLayer,
      this.noteLayer,
      this.sceneAboveLanesLayer,
      this.padLayer,
      this.sceneAbovePadsLayer,
      this.fxLayer
    );
    this.mainStage.sortChildren();

    this.app.stage.addChild(
      this.mainStage,
      this.hudLayer,
      this.editorOverlayContainer
    );
    // 2. Initialize SceneGraph, Animator, and TriggerDispatcher
    this.sceneGraph = new SceneGraph(
      this.sceneLayer,
      this.sceneAboveLanesLayer,
      this.sceneAbovePadsLayer
    );
    this.animator = new Animator(this.sceneGraph);
    this.triggerDispatcher = new TriggerDispatcher(this.sceneGraph, this.animator);

    this.updateLayout();

    this.triggerDispatcher.onTrigger = (trigger) => {
      this.handleTriggerFired(trigger);
    };
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
    this.bgRect.eventMode = 'static';
    this.bgRect.cursor = this.currentTool === 'object' ? 'crosshair' : 'default';

    let isMarqueeDragging = false;
    let marqueeStartX = 0;
    let marqueeStartY = 0;
    let marqueeIsShift = false;

    this.bgRect.on('pointerdown', (e) => {
      const localPos = this.sceneLayer.toLocal(e.global);
      const stageX = Math.max(0, Math.min(1920, Math.round(localPos.x)));
      const stageY = Math.max(0, Math.min(1080, Math.round(localPos.y)));

      if (this.currentTool === 'select') {
        isMarqueeDragging = true;
        marqueeStartX = e.global.x;
        marqueeStartY = e.global.y;
        marqueeIsShift = Boolean(e.shiftKey);
        this.marqueeGfx.clear();
        return;
      }

      if (this.onCanvasClick) {
        this.onCanvasClick(stageX, stageY);
      }
    });

    const onMarqueePointerMove = (e: PointerEvent) => {
      if (!isMarqueeDragging) return;
      let currGlobalX = 0;
      let currGlobalY = 0;
      try {
        const rect = this.app.canvas.getBoundingClientRect();
        currGlobalX = (e.clientX - rect.left) * (this.app.renderer.width / rect.width);
        currGlobalY = (e.clientY - rect.top) * (this.app.renderer.height / rect.height);
      } catch {
        currGlobalX = e.clientX;
        currGlobalY = e.clientY;
      }

      const minX = Math.min(marqueeStartX, currGlobalX);
      const maxX = Math.max(marqueeStartX, currGlobalX);
      const minY = Math.min(marqueeStartY, currGlobalY);
      const maxY = Math.max(marqueeStartY, currGlobalY);

      this.marqueeGfx.clear();
      this.marqueeGfx.rect(minX, minY, maxX - minX, maxY - minY);
      this.marqueeGfx.fill({ color: 0x00e5ff, alpha: 0.15 });
      this.marqueeGfx.stroke({ width: 1.5, color: 0x00e5ff, alpha: 0.9 });
    };

    const onMarqueePointerUp = (e: PointerEvent) => {
      if (!isMarqueeDragging) return;
      isMarqueeDragging = false;
      this.marqueeGfx.clear();

      let currGlobalX = 0;
      let currGlobalY = 0;
      try {
        const rect = this.app.canvas.getBoundingClientRect();
        currGlobalX = (e.clientX - rect.left) * (this.app.renderer.width / rect.width);
        currGlobalY = (e.clientY - rect.top) * (this.app.renderer.height / rect.height);
      } catch {
        currGlobalX = e.clientX;
        currGlobalY = e.clientY;
      }

      const dist = Math.hypot(currGlobalX - marqueeStartX, currGlobalY - marqueeStartY);
      if (dist > 8) {
        const minX = Math.min(marqueeStartX, currGlobalX);
        const maxX = Math.max(marqueeStartX, currGlobalX);
        const minY = Math.min(marqueeStartY, currGlobalY);
        const maxY = Math.max(marqueeStartY, currGlobalY);

        const hitUids: string[] = [];
        if (this.sceneGraph) {
          for (const node of this.sceneGraph.getAllNodes()) {
            if (node.container.destroyed || !node.container.visible) continue;
            const bounds = node.container.getBounds();
            if (
              bounds.x < maxX &&
              bounds.x + bounds.width > minX &&
              bounds.y < maxY &&
              bounds.y + bounds.height > minY
            ) {
              hitUids.push(node.uid);
            }
          }
        }
        this.onNodesSelectBatch?.(hitUids, marqueeIsShift);
      } else {
        if (!marqueeIsShift) {
          this.onNodeSelect?.(null, false);
        }
      }
    };

    window.addEventListener('pointermove', onMarqueePointerMove);
    window.addEventListener('pointerup', onMarqueePointerUp);
    this.eventUnsubscribers.push(() => {
      window.removeEventListener('pointermove', onMarqueePointerMove);
      window.removeEventListener('pointerup', onMarqueePointerUp);
    });

    this.bgLayer.addChild(this.bgRect);
    this.bgLayer.addChild(this.bgGrid);

    // Dedicated lane layer
    this.laneLayer.addChild(this.laneGfx);

    this.sceneGraph.onNodeSelect = (id, isShift) => {
      if (this.currentTool === 'eraser') {
        if (id && this.onNodeRemove) {
          this.onNodeRemove(id);
        }
        return;
      }
      if (this.currentTool === 'select') {
        if (this.onNodeSelect) this.onNodeSelect(id, isShift);
      }
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
      container.sortableChildren = true;

      // Pointer interactive setup for touch / click
      container.eventMode = 'static';
      container.cursor = 'pointer';
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

      // Dark opaque backing to occlude background visual objects in sceneLayer
      const backing = new Graphics();
      backing.roundRect(0, 0, 100, PAD_HEIGHT, 14).fill({ color: 0x000000, alpha: 1.0 });
      backing.zIndex = 0;
      container.addChild(backing);

      // Launchpad Socket (black rounded rectangle chassis with subtle rounded corners)
      const socket = new Graphics();
      socket.roundRect(0, 0, 100, PAD_HEIGHT, 14).fill({ color: 0x0a0a0f, alpha: 0.98 });
      socket.stroke({ color: 0x1c1c28, width: 1.5, alpha: 0.85 });
      socket.roundRect(5, 5, 90, PAD_HEIGHT - 10, 11).fill({ color: 0x050508, alpha: 1.0 });
      socket.stroke({ color: 0x121218, width: 1, alpha: 0.6 });
      socket.zIndex = 1;
      container.addChild(socket);

      // Inner Button Container (centered at 50, 50 so scale expands from center)
      const buttonContainer = new Container();
      buttonContainer.x = 50;
      buttonContainer.y = PAD_HEIGHT / 2;
      buttonContainer.sortableChildren = true;
      buttonContainer.zIndex = 2;
      container.addChild(buttonContainer);

      // Glow-Neon illumination layer (fixed geometry, color/opacity pulse)
      const buttonGlow = new Graphics();
      buttonGlow.zIndex = 1;
      buttonContainer.addChild(buttonGlow);

      // Inner translucent frosted white silicone button
      const buttonBase = new Graphics();
      buttonBase.roundRect(-43, -43, 86, 86, 10).fill({ color: 0x1e1e24, alpha: 0.95 });
      buttonBase.roundRect(-43, -43, 86, 86, 10).fill({ color: 0xffffff, alpha: 0.12 });
      buttonBase.stroke({ color: 0xffffff, width: 1.5, alpha: 0.15 });
      buttonBase.zIndex = 2;
      buttonContainer.addChild(buttonBase);

      // Centered Key Letter assigned by player (low opacity)
      const userBindings = loadUserKeybindings(this.level.pads);
      const boundKey = getBoundKeyForPad(userBindings, pad.id);
      const displayKey = boundKey ? formatKeyCode(boundKey) : (pad.keyHint || '');

      const keyText = new Text({
        text: displayKey,
        style: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: 32,
          fill: 0xffffff,
          fontWeight: 'bold',
        },
      });
      keyText.anchor.set(0.5);
      keyText.x = 0;
      keyText.y = 0;
      keyText.alpha = 0.38;
      keyText.zIndex = 3;
      buttonContainer.addChild(keyText);

      container.sortChildren();
      this.padLayer.addChild(container);
      this.padVisuals.set(pad.id, {
        container,
        socket,
        buttonContainer,
        buttonGlow,
        buttonBase,
        keyText,
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

    // 6. Pre-allocated Particle Pool & Note Pool
    this.particlePool = new ParticlePool(this.fxLayer, 80);
    this.notePool = new NotePool(this.noteLayer, 150);
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
    } else if (effectType === 'shockwave') {
      const effect: VisualEffect = {
        id: `trig_shockwave_${Date.now()}`,
        type: 'shockwave',
        scope: 'global',
        enabled: true,
        startTime: this.lastAudioTime,
        duration: typeof properties.duration === 'number' ? properties.duration : 0.8,
        parameters: {
          speed: typeof properties.speed === 'number' ? properties.speed : 2.0,
          waveSize: typeof properties.waveSize === 'number' ? properties.waveSize : 0.1,
          amplitude: typeof properties.amplitude === 'number' ? properties.amplitude : 0.04,
          centerX: typeof properties.centerX === 'number' ? properties.centerX : 0.5,
          centerY: typeof properties.centerY === 'number' ? properties.centerY : 0.5,
        },
      };
      const filters = EffectRegistry.createFilter(effect.type, effect.parameters, 1.0);
      if (filters.length > 0) {
        this.activeVisualEffects.push({ effect, filters });
      }
    }
  }

  /**
   * Invoked whenever a trigger is dispatched by TriggerDispatcher.
   */
  private handleTriggerFired(trigger: TriggerData): void {
    // Hook for audio-visual synchronization or external trigger listeners
  }

  private drawLanes(): void {
    this.laneGfx.clear();

    for (const pad of this.pads) {
      const x = this.padXPositions.get(pad.id);
      if (x === undefined) continue;
      const color = this.hexToInt(pad.color);

      // 1. Black translucent lane column (low opacity)
      this.laneGfx
        .rect(x, 0, 100, this.padY + PAD_HEIGHT)
        .fill({ color: 0x000000, alpha: 0.35 });

      // 2. Neon separator lines on left and right borders of the lane
      // Soft neon glow pass
      this.laneGfx
        .moveTo(x, 0)
        .lineTo(x, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 3, alpha: 0.20 });
      this.laneGfx
        .moveTo(x + 100, 0)
        .lineTo(x + 100, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 3, alpha: 0.20 });

      // Crisp vibrant neon core line
      this.laneGfx
        .moveTo(x, 0)
        .lineTo(x, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 1.5, alpha: 0.65 });
      this.laneGfx
        .moveTo(x + 100, 0)
        .lineTo(x + 100, this.padY + PAD_HEIGHT)
        .stroke({ color, width: 1.5, alpha: 0.65 });
    }
  }

  private updateLayout(): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    if (screenW === this.lastWidth && screenH === this.lastHeight) return;

    this.lastWidth = screenW;
    this.lastHeight = screenH;

    // Scale and center scene layers to 1920x1080 reference stage
    const sceneScale = Math.min(screenW / 1920, screenH / 1080);
    const offsetX = (screenW - 1920 * sceneScale) / 2;
    const offsetY = (screenH - 1080 * sceneScale) / 2;
    const sceneLayers = [this.sceneLayer, this.sceneAboveLanesLayer, this.sceneAbovePadsLayer];
    for (const layer of sceneLayers) {
      if (layer) {
        layer.scale.set(sceneScale);
        layer.x = offsetX;
        layer.y = offsetY;
      }
    }

    if (this.transformGizmo) {
      this.transformGizmo.update();
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
        pv.container.x = x;
        pv.container.y = this.padY;
      }
    });

    if (this.comboText) {
      this.comboText.x = screenW / 2;
    }

    this.drawLanes();
    if (this.mainStage) {
      this.mainStage.filterArea = this.app.screen;
      this.mainStage.sortChildren();
    }
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
      const rgbEnabled = Boolean(settings?.rgbShiftEnabled);
      if (rgbEnabled) {
        const fragShader = `
          precision highp float;
          in vec2 vTextureCoord;
          out vec4 finalColor;

          uniform sampler2D uTexture;
          uniform float uTime;
          uniform float uBass;
          uniform float uAmp;

          void main() {
            vec2 uv = vTextureCoord;
            float rawShift = 0.001 + uBass * 0.003 + uAmp * 0.0015;
            float shift = clamp(rawShift, 0.0, 0.006);
            float r = texture(uTexture, uv + vec2(shift, 0.0)).r;
            vec4 center = texture(uTexture, uv);
            float b = texture(uTexture, uv - vec2(shift, 0.0)).b;
            finalColor = vec4(r, center.g, b, center.a);
          }
        `;
        this.rgbFilter = createShaderFilter(
          'reactive-rgb-filter',
          fragShader,
          {
            uTime: { value: 0.0, type: 'f32' },
            uBass: { value: 0.0, type: 'f32' },
            uAmp: { value: 0.0, type: 'f32' },
          },
          16
        );
        this.noteLayer.filters = [this.rgbFilter];
      } else {
        this.rgbFilter = null;
        this.noteLayer.filters = [];
      }
    } catch {
      this.rgbFilter = null;
    }
  }

  private setupVisualEffects(): void {
    // 1. Reset existing filters and cleanup dynamic region containers
    if (this.mainStage) {
      this.mainStage.filters = [];
    }
    if (this.sceneGraph) {
      for (const node of this.sceneGraph.getAllNodes()) {
        node.container.filters = [];
      }
    }
    for (const item of this.activeVisualEffects) {
      if (item.container && item.container.parent) {
        item.container.parent.removeChild(item.container);
        item.container.destroy({ children: true });
      }
    }
    this.activeVisualEffects = [];

    const effects = this.level.visual?.effects;
    if (!effects || effects.length === 0) return;

    const globalFilters: Filter[] = [];

    for (const effect of effects) {
      if (effect.enabled === false) continue;
      const filters = EffectRegistry.createFilter(
        effect.type,
        effect.parameters ?? {},
        effect.intensity ?? 1.0
      );
      if (filters.length === 0) continue;

      if (effect.scope === 'global') {
        globalFilters.push(...filters);
        this.activeVisualEffects.push({ effect, filters });
      } else if (effect.scope === 'object' && (effect.targetNodeId || effect.targetId !== undefined)) {
        const targetId = effect.targetId !== undefined ? effect.targetId : effect.targetNodeId!;
        let nodes = this.sceneGraph?.getNodesByTargetId(targetId) || [];
        if (nodes.length === 0 && typeof targetId === 'string') {
          const single = this.sceneGraph?.getNode(targetId);
          if (single) nodes = [single];
        }
        for (const node of nodes) {
          node.container.filters = filters;
        }
        if (nodes.length > 0) {
          this.activeVisualEffects.push({
            effect,
            filters,
            targetNodeId: effect.targetNodeId,
            matchedNodes: nodes,
          });
        }
      } else if (effect.scope === 'range') {
        const minZ = effect.zIndexMin ?? -Infinity;
        const maxZ = effect.zIndexMax ?? Infinity;
        const matchedNodes = (this.sceneGraph?.getAllNodes() || []).filter((node) => {
          const z = node.data.zIndex ?? 0;
          return z >= minZ && z <= maxZ;
        });
        for (const node of matchedNodes) {
          node.container.filters = filters;
        }
        this.activeVisualEffects.push({ effect, filters, matchedNodes });
      } else if (effect.scope === 'region' && effect.region) {
        const regionContainer = new Container();
        const maskGfx = new Graphics();
        maskGfx.rect(effect.region.x, effect.region.y, effect.region.width, effect.region.height);
        maskGfx.fill({ color: 0xffffff });
        regionContainer.mask = maskGfx;
        regionContainer.addChild(maskGfx);
        regionContainer.filters = filters;

        if (effect.targetNodeId) {
          const node = this.sceneGraph?.getNode(effect.targetNodeId) || this.sceneGraph?.getNodesByTargetId(effect.targetNodeId)[0];
          if (node) {
            regionContainer.addChild(node.container);
          }
        }
        this.sceneLayer.addChild(regionContainer);
        this.activeVisualEffects.push({
          effect,
          filters,
          container: regionContainer,
          targetNodeId: effect.targetNodeId,
        });
      }
    }

    if (this.mainStage && globalFilters.length > 0) {
      this.mainStage.filters = globalFilters;
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

  private findFirstVisibleEventIndex(minTime: number): number {
    let low = 0;
    let high = this.events.length - 1;
    let result = this.events.length;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.events[mid].targetTime >= minTime) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return result;
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
    // 1. Immediately return note sprite to pool, unless it's actively being sustained in a hold or active loop
    if (event.behavior === 'loop') {
      this.activeLoopEventIds.add(event.id);
    } else if (this.notePool && !this.activeHoldEventIds.has(event.id) && !this.activeLoopEventIds.has(event.id)) {
      this.notePool.release(event);
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
    this.activeHoldEventIds.clear();
    this.activeLoopEventIds.clear();
    // Return all active notes to pool so they cleanly re-instantiate for the new timestamp
    if (this.notePool) {
      this.notePool.releaseAll();
    }
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

    const settings = this.level.visual?.settings;

    // 3. Modulated background response from level visual settings (only if explicitly enabled)
    const bgReactive = Boolean(settings?.backgroundReactive);
    if (bgReactive) {
      const bgBassMult = settings?.backgroundBassMultiplier ?? 0.6;
      const bgIntensity = channels.bassIntensity * bgBassMult + this.beatPulse * 0.4;
      const br = Math.min(255, 7 + bgIntensity * 35);
      const bg = Math.min(255, 7 + bgIntensity * 18);
      const bb = Math.min(255, 20 + bgIntensity * 55);
      this.bgRect.clear();
      this.bgRect
        .rect(0, 0, w, h)
        .fill({ color: (Math.round(br) << 16) | (Math.round(bg) << 8) | Math.round(bb) });
    } else {
      this.bgRect.clear();
      this.bgRect.rect(0, 0, w, h).fill({ color: 0x000000 });
    }

    // 4. Modulated Grid pulse from level visual settings (only if explicitly enabled)
    this.bgGrid.clear();
    const gridEnabled = Boolean(settings?.gridEnabled);
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

    // 5. RGB shift uniforms update from level visual settings (only if explicitly enabled)
    const rgbEnabled = Boolean(settings?.rgbShiftEnabled);
    const rgbIntensity = rgbEnabled ? (settings?.rgbShiftIntensity ?? 1.0) : 0;
    if (this.rgbFilter) {
      try {
        updateShaderUniforms(this.rgbFilter, {
          uTime: audioTime,
          uBass: channels.bassIntensity * rgbIntensity,
          uAmp: channels.ambientBrightness * rgbIntensity,
        });
      } catch {
        // Ignored
      }
    }

    // 5b. Apply declarative real-time Audio Mappings to SceneNodes
    this.applyAudioMappings(channels);

    // 5c. Update dynamic uniforms for registered visual effects and handle time-window activation
    const activeGlobalFilters: Filter[] = [];
    for (const item of this.activeVisualEffects) {
      const { effect, filters } = item;
      const hasTimeWindow = typeof effect.startTime === 'number' && typeof effect.duration === 'number';
      const inWindow = effect.enabled !== false && (!hasTimeWindow || (audioTime >= effect.startTime! && audioTime <= (effect.startTime! + effect.duration!)));

      if (effect.scope === 'global') {
        if (inWindow) {
          activeGlobalFilters.push(...filters);
        }
      } else if (effect.scope === 'object') {
        const targetNodes = item.matchedNodes && item.matchedNodes.length > 0
          ? item.matchedNodes
          : (item.targetNodeId
            ? (this.sceneGraph?.getNodesByTargetId(item.targetNodeId) || [this.sceneGraph?.getNode(item.targetNodeId)].filter((n): n is SceneNode => Boolean(n)))
            : []);
        for (const node of targetNodes) {
          node.container.filters = inWindow ? filters : [];
        }
      } else if (effect.scope === 'range' && item.matchedNodes) {
        for (const node of item.matchedNodes) {
          node.container.filters = inWindow ? filters : [];
        }
      } else if (effect.scope === 'region' && item.container) {
        item.container.filters = inWindow ? filters : [];
      }

      if (inWindow) {
        let fadeFactor = 1.0;
        if (hasTimeWindow && effect.duration! > 0) {
          const t = audioTime - effect.startTime!;
          const dur = effect.duration!;
          if (effect.fadeIn && effect.fadeIn > 0 && t < effect.fadeIn) {
            const progress = Math.max(0, Math.min(1, t / effect.fadeIn));
            fadeFactor *= applyEasing(progress, effect.fadeInEasing ?? 'easeOutQuad');
          }
          if (effect.fadeOut && effect.fadeOut > 0 && (dur - t) < effect.fadeOut) {
            const progress = Math.max(0, Math.min(1, (dur - t) / effect.fadeOut));
            fadeFactor *= applyEasing(progress, effect.fadeOutEasing ?? 'easeInQuad');
          }
        }
        const effectiveIntensity = (effect.intensity ?? 1.0) * Math.max(0, Math.min(1, fadeFactor));

        EffectRegistry.update(
          filters,
          effect.type,
          effect.parameters ?? {},
          effectiveIntensity,
          audioTime
        );
      }
    }

    if (this.mainStage) {
      this.mainStage.filters = activeGlobalFilters.length > 0 ? activeGlobalFilters : [];
    }

    // 5d. Real-time audio spectrum generator update
    if (this.sceneGraph) {
      const spectrumNodes = this.sceneGraph.getSpectrumNodes();
      if (spectrumNodes.size > 0) {
        if (this.audioEngine && this.audioEngine.isPlaying) {
          this.audioEngine.getSpectrumFrequencyData(this.spectrumBuffer);
          const sr = this.audioEngine.sampleRate;
          for (const node of spectrumNodes) {
            const visualizer = node.displayObject as AudioSpectrumVisualizer;
            visualizer.setSampleRate(sr);
            visualizer.update(this.spectrumBuffer);
          }
        } else {
          for (const node of spectrumNodes) {
            (node.displayObject as AudioSpectrumVisualizer).decayOnly();
          }
        }
      }
    }

    // 6. Compute song timing with calibration offset
    const songOffset = this.level.timing?.offset ?? 0;
    const songTime = audioTimeToSongTime(audioTime, songOffset);
    this.currentSongTime = songTime;

    // 6b. Evaluate temporal lifespan for all scene nodes
    if (this.sceneGraph) {
      for (const node of this.sceneGraph.getAllNodes()) {
        const ls = node.data.lifespan;
        const isSelectedInEditor =
          this.selectedNodeIds.has(node.uid) ||
          (Boolean(node.id) && this.selectedNodeIds.has(String(node.id))) ||
          (Boolean(node.name) && this.selectedNodeIds.has(node.name!));

        if (!ls) {
          node.container.visible = node.data.visible !== false;
        } else {
          const startTime = ls.startTime;
          const endTime = ls.startTime + ls.duration;
          if (songTime < startTime || songTime > endTime) {
            if (isSelectedInEditor) {
              node.container.visible = true;
              node.container.alpha = 0.45;
            } else {
              node.container.visible = false;
            }
          } else {
            node.container.visible = node.data.visible !== false;
            let fadeMult = 1.0;
            const fadeInSec = (ls.fadeInMs ?? 0) / 1000;
            const fadeOutSec = (ls.fadeOutMs ?? 0) / 1000;
            if (fadeInSec > 0 && songTime < startTime + fadeInSec) {
              fadeMult = Math.min(fadeMult, (songTime - startTime) / fadeInSec);
            }
            if (fadeOutSec > 0 && songTime > endTime - fadeOutSec) {
              fadeMult = Math.min(fadeMult, (endTime - songTime) / fadeOutSec);
            }
            fadeMult = Math.max(0, Math.min(1, fadeMult));

            const baseAlpha =
              node.data.layerId === 'sceneFront'
                ? Math.min(0.35, node.data.transform?.opacity ?? 0.35)
                : (node.data.transform?.opacity ?? 1.0);
            node.container.alpha = baseAlpha * fadeMult;
          }
        }
      }
    }

    // 6c. Real-time selection overlay update (bounding box & anchors)
    this.updateSelectionOverlay();

    // 7. Cleanup events that fell past the pads
    if (this.notePool) {
      for (const { event } of this.notePool.getActiveNotes()) {
        const duration = event.duration || 0;
        if (
          event.targetTime + duration + 0.4 < songTime &&
          !this.activeHoldEventIds.has(event.id) &&
          !this.activeLoopEventIds.has(event.id)
        ) {
          this.notePool.release(event);
        }
      }

      // 8. Acquire event sprites approaching within leadTime window using binary search
      const minVisibleTime = songTime - 0.2;
      const maxVisibleTime = songTime + this.leadTime;
      const startIndex = this.findFirstVisibleEventIndex(minVisibleTime);
      const fallDistance = Math.min(600, Math.max(250, this.padY - 20));

      for (let i = startIndex; i < this.events.length; i++) {
        const event = this.events[i];
        if (event.targetTime > maxVisibleTime) {
          break; // Subsequent events cannot be visible since events are sorted
        }
        if (this.notePool.has(event)) continue;

        const padConfig = this.pads.find((p) => p.id === event.padId);
        if (!padConfig) continue;

        const color = this.hexToInt(padConfig.color);
        const initialTailHeight = event.duration ? (event.duration / this.leadTime) * fallDistance : 0;
        this.notePool.acquire(event, color, initialTailHeight);
      }

      // 9. Event positions: fall from top towards pad center
      const targetY = this.padY + PAD_HEIGHT / 2;
      for (const { event, gfx } of this.notePool.getActiveNotes()) {
        const x = this.padXPositions.get(event.padId) ?? 0;
        const isBeingHeld = this.activeHoldEventIds.has(event.id);
        const pooled = this.notePool.get(event.id);

        const isLooping =
          event.behavior === 'loop' &&
          Boolean(event.duration) &&
          this.activeLoopEventIds.has(event.id) &&
          songTime <= event.targetTime + (event.duration || 0);

        if ((isBeingHeld && event.duration) || isLooping) {
          // Sustained hold or active loop: Anchored at pad receptor line
          gfx.x = x + 50;
          gfx.y = targetY;
          gfx.scale.set(1.02);
          gfx.alpha = 1;

          // Tail length shrinks dynamically as hold or loop progresses
          const remaining = (event.targetTime + (event.duration || 0)) - songTime;
          const currentTailHeight = Math.max(0, (remaining / this.leadTime) * fallDistance);
          if (pooled) {
            if (event.behavior === 'hold') {
              this.notePool.renderHoldTail(pooled, pooled.color, currentTailHeight);
            } else if (event.behavior === 'loop') {
              this.notePool.renderLoopTail(pooled, pooled.color, currentTailHeight);
            }
          }

          // Sparks feedback at receptor line
          const pv = this.padVisuals.get(event.padId);
          if (pv && Math.random() < 0.25) {
            this.particlePool.spawn(x + 50, targetY, pv.baseColor, 2, 0.7);
          }
        } else {
          const progress = 1 - (event.targetTime - songTime) / this.leadTime;
          const y = targetY - fallDistance * (1 - progress);

          gfx.x = x + 50;
          gfx.y = y;
          gfx.scale.set(0.85 + Math.min(progress, 1) * 0.15);
          gfx.alpha = progress < 0.08 ? progress * 12.5 : 1;

          // In flight hold note: ensure initial tail is drawn
          if (event.behavior === 'hold' && event.duration && pooled) {
            const desiredTailHeight = (event.duration / this.leadTime) * fallDistance;
            if (Math.abs(pooled.currentTailHeight - desiredTailHeight) > 2) {
              this.notePool.renderHoldTail(pooled, pooled.color, desiredTailHeight);
            }
          } else if (event.behavior === 'loop' && event.duration && pooled) {
            const desiredTailHeight = (event.duration / this.leadTime) * fallDistance;
            if (Math.abs(pooled.currentTailHeight - desiredTailHeight) > 2) {
              this.notePool.renderLoopTail(pooled, pooled.color, desiredTailHeight);
            }
          }
        }
      }
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

      // Base idle glow modulated slightly by audio beats
      let idleGlow = bandValue * 0.15;
      const pressGlow = pv.pressAnim * 0.85;
      let totalGlow = Math.min(1, idleGlow + pressGlow);
      let glowColor = pv.baseColor;
      let rimColor = 0xffffff;
      let rimAlpha = 0.12 + totalGlow * 0.5;

      // Button scale animation: ONLY the inner white button scales on input!
      let buttonScale = 1.0 + pv.pressAnim * 0.12;

      // State-specific visual behaviors
      switch (pv.state) {
        case 'queued': {
          const pulse = Math.sin(audioTime * 16) * 0.5 + 0.5;
          totalGlow = Math.max(totalGlow, 0.35 + pulse * 0.45);
          break;
        }
        case 'playing': {
          // Loop active: full vibrant neon illumination modulated in real-time
          totalGlow = Math.max(totalGlow, 0.65 + bandValue * 0.35);
          buttonScale = Math.max(buttonScale, 1.0 + bandValue * 0.05);
          break;
        }
        case 'holding': {
          // Holding sustained note: intense glow and continuous edge particles
          totalGlow = Math.max(totalGlow, 0.85 + bandValue * 0.15);
          buttonScale = Math.max(buttonScale, 1.04);
          if (Math.random() < 0.35) {
            this.particlePool.spawn(
              pv.x + 20 + Math.random() * 60,
              this.padY + PAD_HEIGHT / 2 + (Math.random() - 0.5) * 20,
              pv.baseColor,
              1,
              0.6
            );
          }
          break;
        }
        case 'miss': {
          if (pv.stateAnim > 0) {
            glowColor = 0xff3344;
            totalGlow = Math.max(totalGlow, pv.stateAnim * 0.8);
            pv.stateAnim *= 0.88;
          }
          break;
        }
        case 'ready':
        default:
          break;
      }

      // 1. Render Glow-Neon: fixed geometry, purely color/opacity pulse (no size expansion)
      pv.buttonGlow.clear();
      if (totalGlow > 0.02) {
        // Outer soft diffusion halo
        pv.buttonGlow
          .roundRect(-46, -46, 92, 92, 12)
          .fill({ color: glowColor, alpha: totalGlow * 0.35 });
        // Core neon aura
        pv.buttonGlow
          .roundRect(-43, -43, 86, 86, 10)
          .fill({ color: glowColor, alpha: totalGlow * 0.65 });
      }

      // 2. Render Button Base (the frosted white translucent silicone pad)
      pv.buttonBase.clear();
      // Matte dark silicone substrate
      pv.buttonBase
        .roundRect(-43, -43, 86, 86, 10)
        .fill({ color: 0x1e1e24, alpha: 0.95 });
      // Frosted white translucent layer (launchpad silicone look)
      pv.buttonBase
        .roundRect(-43, -43, 86, 86, 10)
        .fill({ color: 0xffffff, alpha: 0.12 });
      // Illuminated neon wash when glowing / pressed
      if (totalGlow > 0.02) {
        pv.buttonBase
          .roundRect(-43, -43, 86, 86, 10)
          .fill({ color: glowColor, alpha: totalGlow * 0.70 });
        // Extra translucent white gloss when illuminated
        pv.buttonBase
          .roundRect(-43, -43, 86, 86, 10)
          .fill({ color: 0xffffff, alpha: totalGlow * 0.18 });
      }
      // Silicone rim stroke
      pv.buttonBase.stroke({
        color: totalGlow > 0.1 ? glowColor : rimColor,
        width: 1.5,
        alpha: rimAlpha,
      });

      // 3. Key text opacity: subtle in idle, brighter when lit
      pv.keyText.alpha = 0.38 + totalGlow * 0.38;

      // 4. Animate button size on input: ONLY the inner button container scales!
      pv.buttonContainer.scale.set(buttonScale);

      // Outer container stays stationary at (pv.x, this.padY)
      pv.container.scale.set(1.0);
      pv.container.x = pv.x;
      pv.container.y = this.padY;

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
    this.sceneGraph.updateNode(nodeData);
  }

  setUpdateCallback(cb: (ticker: Ticker) => void): void {
    if (this.tickerCb) this.app.ticker.remove(this.tickerCb);
    this.tickerCb = cb;
    this.app.ticker.add(cb);
  }

  /**
   * Sets the currently selected SceneNode IDs to display the interactive transform gizmo.
   */
  public setSelectedNodes(nodeIds: string[] | Set<string> | null): void {
    this.selectedNodeIds.clear();
    if (nodeIds) {
      for (const id of nodeIds) this.selectedNodeIds.add(id);
    }
    this.updateSelectionOverlay();
  }

  public setActiveTool(tool: string): void {
    this.currentTool = tool;
    if (this.bgRect) {
      this.bgRect.cursor = tool === 'object' ? 'crosshair' : 'default';
    }
    if (this.sceneGraph) {
      this.sceneGraph.setNodesInteractive(tool !== 'object');
    }
  }

  public setSelectedNode(nodeId: string | null): void {
    this.setSelectedNodes(nodeId ? [nodeId] : null);
  }

  public getSelectedNode(): string | null {
    return this.selectedNodeIds.size === 1 ? Array.from(this.selectedNodeIds)[0] : null;
  }

  public getSelectedNodes(): Set<string> {
    return this.selectedNodeIds;
  }

  private updateSelectionOverlay(): void {
    if (!this.transformGizmo || !this.sceneGraph) return;
    const nodes: SceneNode[] = [];
    for (const id of this.selectedNodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (node) nodes.push(node);
    }
    this.transformGizmo.setSelectedNodes(nodes);
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

    if (this.transformGizmo) {
      this.transformGizmo.destroy();
    }

    if (this.notePool) {
      this.notePool.destroy();
    }
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
