import type { AudioBands } from '../types';

/**
 * Represents the current playback state of the transport.
 *  - 'stopped' : No playback. Time is at 0.
 *  - 'playing' : Actively playing. getTime() advances with the audio clock.
 *  - 'paused'  : Playback suspended. getTime() is frozen at the pause position.
 */
export type TransportState = 'stopped' | 'playing' | 'paused';

/**
 * Transport — declarative interface for all playback control.
 *
 * Any component that needs to control or observe playback (Game, EditorApp,
 * level previewer) depends only on this interface, never on AudioEngine directly.
 * This decouples the timing contract from the Web Audio implementation.
 */
export interface Transport {
  /** Current playback state. */
  readonly state: TransportState;

  /**
   * Returns the current playback position in seconds (audio clock time).
   * When paused, returns the frozen offset. When stopped, returns 0.
   */
  getTime(): number;

  /**
   * Starts or resumes playback.
   * @param bpm    Tempo in beats per minute. Required when starting from stopped.
   * @param offset Playback start position in seconds. Defaults to 0.
   */
  play(bpm?: number, offset?: number): Promise<void>;

  /**
   * Pauses playback, preserving the current position.
   * A subsequent play() call will resume from the frozen offset.
   */
  pause(): void;

  /**
   * Stops playback and resets the position to 0.
   */
  stop(): void;

  /**
   * Seeks to a specific position in the audio stream.
   * Can be called while playing (restarts from new position) or while paused.
   * @param targetTime Position in seconds.
   */
  seek(targetTime: number): void;

  /**
   * Registers a listener for transport state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(listener: (state: TransportState) => void): () => void;

  /**
   * Registers a listener for beat events.
   * Returns an unsubscribe function.
   */
  onBeat(listener: (beatIndex: number, beatTime: number) => void): () => void;

  /**
   * Returns current audio frequency band data for visual reactivity.
   */
  getAudioBands(): AudioBands;

  /**
   * Loads an external audio file for playback.
   * Must be called after the transport is initialized.
   * @returns true if file loaded successfully, false if falling back to procedural.
   */
  loadFile(url: string): Promise<boolean>;

  /**
   * Initializes the underlying audio context.
   * Must be called from a user gesture to satisfy browser autoplay policies.
   */
  init(): Promise<void>;

  /**
   * Whether the transport is using a loaded file (true) or procedural synthesis (false).
   */
  readonly isUsingFile: boolean;

  /**
   * Releases all resources and closes the audio context.
   */
  dispose(): void;
}
