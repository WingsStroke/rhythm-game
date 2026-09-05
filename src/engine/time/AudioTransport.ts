import { AudioEngine } from '../audio/AudioEngine';
import type { AudioBands } from '../types';
import type { Transport, TransportState } from './Transport';

/**
 * AudioTransport — concrete Transport implementation backed by AudioEngine.
 *
 * This class is the single source of truth for:
 *  - Playback state (stopped / playing / paused)
 *  - Current playback position (getTime)
 *  - Transport control (play, pause, stop, seek)
 *
 * It wraps AudioEngine so that consumers (Game, EditorApp, etc.) only
 * depend on the Transport interface, never on the Web Audio internals.
 *
 * Time calculation:
 *   playbackTime = (audioContext.currentTime - startContextTime) + pausedOffset
 *
 * When paused, getTime() returns the frozen pausedOffset, so no time accumulates
 * between pause and the next play() call. On resume, startContextTime is reset
 * to the current audio context time, and pausedOffset is carried forward.
 */
export class AudioTransport implements Transport {
  private readonly audio: AudioEngine;
  private _state: TransportState = 'stopped';
  private _bpm = 120;

  // Listener sets
  private stateListeners: Set<(state: TransportState) => void> = new Set();
  private beatListeners: Set<(beatIndex: number, beatTime: number) => void> = new Set();

  constructor() {
    this.audio = new AudioEngine();
  }

  // ---- Transport interface ----

  get state(): TransportState {
    return this._state;
  }

  get isUsingFile(): boolean {
    return this.audio.isUsingFile;
  }

  async init(): Promise<void> {
    await this.audio.init();

    // Wire beat events from the underlying AudioEngine
    this.audio.onBeat = (beatIndex: number, beatTime: number) => {
      for (const listener of this.beatListeners) {
        listener(beatIndex, beatTime);
      }
    };
  }

  async loadFile(url: string): Promise<boolean> {
    return this.audio.loadFile(url);
  }

  getTime(): number {
    return this.audio.getTime();
  }

  getAudioBands(): AudioBands {
    return this.audio.getAudioBands();
  }

  async play(bpm?: number, offset?: number): Promise<void> {
    if (bpm !== undefined) this._bpm = bpm;

    const startOffset = offset ?? (this._state === 'paused' ? this.audio.getTime() : 0);

    this.audio.start(this._bpm, startOffset);
    this._setState('playing');
  }

  pause(): void {
    if (this._state !== 'playing') return;

    // Capture current position before stopping
    this.audio.stop();
    this._setState('paused');
  }

  stop(): void {
    if (this._state === 'stopped') return;

    this.audio.stop();
    this._setState('stopped');
  }

  seek(targetTime: number): void {
    const wasPlaying = this._state === 'playing';

    // Always stop current playback first
    if (this._state !== 'stopped') {
      this.audio.stop();
    }

    if (wasPlaying) {
      // Restart from the new position immediately
      this.audio.start(this._bpm, targetTime);
      this._setState('playing');
    } else {
      // Paused or stopped: freeze at the requested position without playing.
      // We achieve this by starting and immediately stopping to set internal offset,
      // then stopping so AudioEngine holds the offset for getTime().
      // AudioEngine.start() sets startTime = ctx.currentTime - offset, so
      // getTime() will return targetTime when called right after.
      // However, since we immediately stop, we store the value via a brief start.
      // A cleaner approach: AudioEngine exposes a setOffset method; until then,
      // we start briefly so getTime() resolves correctly when queried.
      this.audio.start(this._bpm, targetTime);
      // Tiny delay to let getTime() settle, then stop — preserves the offset
      // internally via AudioEngine's pauseOffset logic.
      setTimeout(() => {
        if (this._state !== 'playing') {
          this.audio.stop();
        }
      }, 0);
      this._setState('paused');
    }
  }

  onStateChange(listener: (state: TransportState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onBeat(listener: (beatIndex: number, beatTime: number) => void): () => void {
    this.beatListeners.add(listener);
    return () => this.beatListeners.delete(listener);
  }

  dispose(): void {
    this.audio.dispose();
    this.stateListeners.clear();
    this.beatListeners.clear();
  }

  // ---- Internal ----

  private _setState(next: TransportState): void {
    if (this._state === next) return;
    this._state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  // ---- Expose AudioEngine for VisualEngine (needs the AudioEngine reference directly) ----

  /**
   * Provides direct access to the underlying AudioEngine for subsystems
   * (e.g. VisualEngine) that need it for advanced audio-reactive features.
   * Use Transport interface methods for all playback control.
   */
  get audioEngine(): AudioEngine {
    return this.audio;
  }
}
