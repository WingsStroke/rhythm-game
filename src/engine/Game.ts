import { AudioEngine } from './audio/AudioEngine';
import { InputManager } from './input/InputManager';
import { GameplayEngine } from './gameplay/GameplayEngine';
import { VisualEngine } from './visual/VisualEngine';
import { BeatmapGenerator } from './beatmap/BeatmapGenerator';
import type { LevelData, PlayerState, Judgement, Note, PadId } from './types';
import type { Ticker } from 'pixi.js';

/**
 * Game — top-level orchestrator.
 *
 * Wires together: AudioEngine, InputManager, GameplayEngine, VisualEngine.
 *
 * The update loop runs on PixiJS's Ticker (driven by rAF), but all time
 * references use the audio clock. This ensures frame-rate-independent
 * gameplay: timing, hit detection, and note positions are based on
 * AudioContext.currentTime, not frame count.
 */
export class Game {
  private audio: AudioEngine;
  private input: InputManager;
  private gameplay: GameplayEngine;
  private visual: VisualEngine;
  private level: LevelData;
  private container: HTMLElement;
  private running = false;

  // Callbacks for React UI
  public onScoreUpdate: ((state: PlayerState) => void) | null = null;
  public onGameComplete: ((state: PlayerState) => void) | null = null;
  public onLoadStatus: ((status: string) => void) | null = null;

  get songSource(): 'file' | 'procedural' {
    return this.audio.isUsingFile ? 'file' : 'procedural';
  }

  constructor(container: HTMLElement, level: LevelData) {
    this.container = container;
    this.level = level;
    this.audio = new AudioEngine();
    this.input = new InputManager(() => this.audio.getTime());
    this.gameplay = new GameplayEngine(level, () => this.audio.getTime());
    this.visual = new VisualEngine(container, level, this.audio);
  }

  async start(): Promise<void> {
    // 1. Initialize audio (must be from user gesture)
    await this.audio.init();

    // 2. Load external audio file if the level specifies one
    if (this.level.song.url) {
      await this.audio.loadFile(this.level.song.url);
    }

    // 3. Initialize visual engine (PixiJS)
    await this.visual.init();

    // 4. Wire up input -> gameplay -> visual feedback
    this.setupInput();
    this.setupGameplayCallbacks();

    // 5. Set up the update loop on PixiJS ticker
    this.visual.setUpdateCallback((_ticker: Ticker) => this.frameUpdate());

    // 6. Start audio + gameplay
    this.gameplay.start();
    this.audio.onBeat = (beatIndex: number) => this.visual.onBeat(beatIndex);
    this.audio.start(this.level.song.bpm);

    this.running = true;
  }

  private setupInput(): void {
    const map: Record<string, PadId> = {};
    for (const pad of this.level.pads) {
      if (pad.keyHint) {
        // keyHint is a character like "A" -> KeyboardEvent.code "KeyA"
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
    this.gameplay.onJudgement = (note: Note, judgement: Judgement, _offset: number) => {
      this.visual.showJudgement(note, judgement);
    };
    this.gameplay.onScoreChange = (state: PlayerState) => {
      this.visual.updateScore(state.score, state.combo);
      this.onScoreUpdate?.(state);
    };
  }

  /** Called every frame by PixiJS ticker. */
  private frameUpdate(): void {
    if (!this.running) return;

    const audioTime = this.audio.getTime();
    const bands = this.audio.getAudioBands();

    // Update gameplay (check for misses)
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
      this.audio.stop();
    } catch (e) {
      console.warn('Error stopping audio:', e);
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
      this.audio.dispose();
    } catch (e) {
      console.warn('Error disposing audio engine:', e);
    }
  }
}
