import { AudioTransport } from './time/AudioTransport';
import { InputManager } from './input/InputManager';
import { GameplayEngine } from './gameplay/GameplayEngine';
import { GameplayEventBus } from './gameplay/GameplayEventBus';
import { VisualEngine } from './visual/VisualEngine';

import type { LevelData, PlayerState, PadId } from './types';
import type { Ticker } from 'pixi.js';

/**
 * Game — top-level orchestrator.
 *
 * Wires together: AudioTransport, InputManager, GameplayEngine, VisualEngine.
 *
 * The update loop runs on PixiJS's Ticker (driven by rAF), but all time
 * references use the audio clock via Transport.getTime(). This ensures
 * frame-rate-independent gameplay: timing, hit detection, and event positions
 * are based on AudioContext.currentTime, not frame count.
 */
export class Game {
  private transport: AudioTransport;
  private input: InputManager;
  private gameplay: GameplayEngine;
  private eventBus: GameplayEventBus;
  private visual: VisualEngine;
  private level: LevelData;
  private container: HTMLElement;
  private running = false;

  // Callbacks for React UI
  public onScoreUpdate: ((state: PlayerState) => void) | null = null;
  public onGameComplete: ((state: PlayerState) => void) | null = null;
  public onLoadStatus: ((status: string) => void) | null = null;

  get songSource(): 'file' | 'procedural' {
    return this.transport.isUsingFile ? 'file' : 'procedural';
  }

  constructor(container: HTMLElement, level: LevelData) {
    this.container = container;
    this.level = level;
    this.eventBus = new GameplayEventBus();
    this.transport = new AudioTransport();
    this.input = new InputManager(() => this.transport.getTime());
    this.gameplay = new GameplayEngine(level, () => this.transport.getTime(), this.eventBus);
    this.visual = new VisualEngine(container, level, this.transport.audioEngine);
  }

  async start(): Promise<void> {
    // 1. Initialize audio (must be from user gesture)
    await this.transport.init();

    // 2. Load external audio file if the level specifies one
    if (this.level.song.url) {
      await this.transport.loadFile(this.level.song.url);
    }

    // 3. Initialize visual engine (PixiJS)
    await this.visual.init();

    // 4. Wire up input -> gameplay -> visual feedback
    this.setupInput();
    this.setupGameplayCallbacks();

    // 5. Set up the update loop on PixiJS ticker
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.visual.setUpdateCallback((_ticker: Ticker) => this.frameUpdate());

    // 6. Start gameplay and transport
    this.gameplay.start();
    this.transport.onBeat((beatIndex: number) => this.visual.onBeat(beatIndex));
    await this.transport.play(this.level.song.bpm, 0);

    this.running = true;
  }

  private setupInput(): void {
    const map: Record<string, PadId> = {};
    for (const pad of this.level.pads) {
      if (pad.keyHint) {
        map[`Key${pad.keyHint}`] = pad.id;
      }
    }
    this.input.setKeyMap(map);
    this.input.setHandler((event) => this.gameplay.handleInput(event));
    this.input.onPadPress = (pad) => this.visual.pressPad(pad);
    this.input.onPadRelease = (pad) => this.visual.releasePad(pad);
    this.visual.onPadInput = (padId, pressed) => {
      if (pressed) {
        this.input.pressPad(padId);
      } else {
        this.input.releasePad(padId);
      }
    };
    this.input.attach();
  }

  private setupGameplayCallbacks(): void {
    this.visual.attachEventBus(this.eventBus);
    this.gameplay.onScoreChange = (state: PlayerState) => {
      this.onScoreUpdate?.(state);
    };
  }

  /** Called every frame by PixiJS ticker. */
  private frameUpdate(): void {
    if (!this.running) return;

    const audioTime = this.transport.getTime();
    const bands = this.transport.getAudioBands();

    // Update gameplay (check for misses, loop/hold expiry, pre-cue states)
    this.gameplay.update();

    // Update visuals
    this.visual.update(audioTime, bands);

    // Check for game completion
    if (this.gameplay.isComplete) {
      this.running = false;
      this.stop();
      const finalState = this.gameplay.state;
      this.onGameComplete?.(finalState);
    }
  }

  stop(): void {
    this.running = false;
    try {
      this.transport.stop();
    } catch (e) {
      console.warn('Error stopping transport:', e);
    }
    try {
      this.input.detach();
    } catch (e) {
      console.warn('Error detaching input:', e);
    }
  }

  dispose(): void {
    this.stop();
    try {
      this.visual.dispose();
    } catch (e) {
      console.warn('Error disposing visual engine:', e);
    }
    try {
      this.transport.dispose();
    } catch (e) {
      console.warn('Error disposing transport:', e);
    }
  }
}
