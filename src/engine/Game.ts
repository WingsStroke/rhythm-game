import { AudioTransport } from './time/AudioTransport';
import { InputManager } from './input/InputManager';
import { GameplayEngine } from './gameplay/GameplayEngine';
import { GameplayEventBus } from './gameplay/GameplayEventBus';
import { VisualEngine } from './visual/VisualEngine';
import { SongRegistry } from './content/SongRegistry';
import { loadUserKeybindings, type KeybindingMap } from './input/Keybindings';

import type { LevelData, PlayerState, AudioBands } from './types';
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

  private _isPaused = false;

  // Callbacks for React UI
  public onScoreUpdate: ((state: PlayerState) => void) | null = null;
  public onGameComplete: ((state: PlayerState) => void) | null = null;
  public onLoadStatus: ((status: string) => void) | null = null;
  public onPauseChange: ((paused: boolean) => void) | null = null;
  public onTimeUpdate: ((currentTime: number, duration: number) => void) | null = null;

  private isPreRolling = false;

  get songSource(): 'file' | 'procedural' {
    return this.transport.isUsingFile ? 'file' : 'procedural';
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentLevel(): LevelData {
    return this.level;
  }

  get duration(): number {
    return this.level.song.duration;
  }

  get currentTime(): number {
    return this.getCurrentGameTime();
  }

  private getCurrentGameTime(): number {
    return this.transport.getTime();
  }

  constructor(container: HTMLElement, level: LevelData) {
    this.container = container;
    this.level = level;
    this.eventBus = new GameplayEventBus();
    this.transport = new AudioTransport();
    this.input = new InputManager(() => this.getCurrentGameTime());
    this.gameplay = new GameplayEngine(level, () => this.getCurrentGameTime(), this.eventBus);
    this.visual = new VisualEngine(container, level, this.transport.audioEngine);
  }

  async start(): Promise<void> {
    // 1. Initialize audio (must be from user gesture)
    await this.transport.init();

    // 2. Register song in SongRegistry and check for cached AudioBuffer
    const songRegistry = SongRegistry.getInstance();
    songRegistry.registerSong(this.level.song);

    const songId = this.level.songId || this.level.song.id;
    const cachedBuffer = songRegistry.getAudioBuffer(songId);

    if (cachedBuffer) {
      // Instant in-memory cache hit: skip fetch and decodeAudioData
      this.transport.loadAudioBuffer(cachedBuffer);
    } else {
      const audioUrl = this.level.song.url || this.level.song.audioUrl;
      if (audioUrl) {
        await this.transport.loadFile(audioUrl, songId);
      }
    }

    // 3. Initialize visual engine (PixiJS)
    await this.visual.init();

    // 4. Wire up input -> gameplay -> visual feedback
    this.setupInput();
    this.setupGameplayCallbacks();

    // 5. Set up the update loop on PixiJS ticker
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.visual.setUpdateCallback((_ticker: Ticker) => this.frameUpdate());

    // 6. Start gameplay and transport with pre-roll & audio envelope
    const leadIn = this.level.timing?.leadIn ?? 0;
    const envelope = {
      fadeIn: this.level.timing?.fadeIn ?? 0,
      fadeOut: this.level.timing?.fadeOut ?? 0,
      totalDuration: this.level.song.duration,
    };

    this.transport.onBeat((beatIndex: number) => this.visual.onBeat(beatIndex));

    if (leadIn > 0) {
      this.isPreRolling = true;
      this.gameplay.start(-leadIn);
      await this.transport.play(this.level.song.bpm, 0, envelope, leadIn);
    } else {
      this.isPreRolling = false;
      this.gameplay.start(0);
      await this.transport.play(this.level.song.bpm, 0, envelope);
    }

    this.running = true;
    this._isPaused = false;
    this.onPauseChange?.(false);
  }

  pause(): void {
    if (!this.running || this._isPaused) return;
    this._isPaused = true;
    this.transport.pause();
    this.onPauseChange?.(true);
  }

  async resume(): Promise<void> {
    if (!this.running || !this._isPaused) return;
    this._isPaused = false;
    await this.transport.play();
    this.onPauseChange?.(false);
  }

  async restart(): Promise<void> {
    this.stop();
    this.gameplay.reset();
    const leadIn = this.level.timing?.leadIn ?? 0;
    const envelope = {
      fadeIn: this.level.timing?.fadeIn ?? 0,
      fadeOut: this.level.timing?.fadeOut ?? 0,
      totalDuration: this.level.song.duration,
    };

    this._isPaused = false;
    this.onPauseChange?.(false);
    this.input.attach();
    this.running = true;

    if (leadIn > 0) {
      this.isPreRolling = true;
      this.gameplay.start(-leadIn);
      await this.transport.play(this.level.song.bpm, 0, envelope, leadIn);
    } else {
      this.isPreRolling = false;
      this.gameplay.start(0);
      await this.transport.play(this.level.song.bpm, 0, envelope);
    }
  }

  private setupInput(customKeybindings?: KeybindingMap): void {
    const map = customKeybindings || loadUserKeybindings(this.level.pads);
    this.input.setKeyMap(map);
    this.input.setHandler((event) => {
      if (this._isPaused) return;
      this.gameplay.handleInput(event);
    });
    this.input.onPadPress = (pad) => {
      if (this._isPaused) return;
      this.visual.pressPad(pad);
    };
    this.input.onPadRelease = (pad) => {
      if (this._isPaused) return;
      this.visual.releasePad(pad);
    };
    this.visual.onPadInput = (padId, pressed) => {
      if (this._isPaused) return;
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
    if (!this.running || this._isPaused) return;

    const gameTime = this.getCurrentGameTime();
    this.isPreRolling = gameTime < 0;
    const bands: AudioBands = this.isPreRolling
      ? { bass: 0, mids: 0, treble: 0, amplitude: 0, freqData: new Uint8Array(0), waveData: new Uint8Array(0) }
      : this.transport.getAudioBands();

    // Emit live time update for HUD progress bar
    this.onTimeUpdate?.(Math.max(0, gameTime), this.level.song.duration);

    // Update gameplay (check for misses, loop/hold expiry, pre-cue states)
    this.gameplay.update();

    // Update visuals
    this.visual.update(gameTime, bands);

    // Check for game completion: either all notes consumed and expired, or gameTime >= duration
    const songDuration = this.level.song.duration;
    if (this.gameplay.isComplete || (songDuration > 0 && gameTime >= songDuration)) {
      this.running = false;
      this.stop();
      const finalState = this.gameplay.state;
      this.onGameComplete?.(finalState);
    }
  }

  stop(): void {
    this.running = false;
    this._isPaused = false;
    this.onPauseChange?.(false);
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
