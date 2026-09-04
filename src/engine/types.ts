// ---- Core type system for the rhythm engine ----
// These types describe WHAT the engine needs to do, decoupled from
// any rendering technology (PixiJS, WebGL, etc).

/** Pad identity. A pad represents a sonic FUNCTION (e.g. "kick"), not a pitch. */
export type PadId = string;

/** Note types — extensible for future hold/release/special notes. */
export type NoteType = 'tap' | 'hold';

/** A single note in a beatmap. */
export interface Note {
  /** Time in seconds (relative to song start) when the note should be hit. */
  time: number;
  /** Target pad id (e.g. "pad_0"). */
  pad: PadId;
  /** Note type. */
  type: NoteType;
  /** Duration for hold notes (seconds). 0 for tap notes. */
  duration?: number;
}

/** Pad configuration within a level. */
export interface PadConfig {
  id: PadId;
  /** Human-readable label (e.g. "Kick", "Melody"). */
  label: string;
  /** Color used for notes and pad feedback (hex string, e.g. "#ff0066"). */
  color: string;
  /** Key binding hint for the editor (not used by the engine directly). */
  keyHint?: string;
}

/** Song metadata. */
export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  /** BPM of the song. */
  bpm: number;
  /** Audio offset in seconds (calibration). */
  offset: number;
  /** Duration in seconds. */
  duration: number;
  /**
   * URL to an external audio file. When provided, the AudioEngine loads and
   * plays this file instead of synthesizing procedural music.
   * Leave undefined to use the built-in procedural synthesizer.
   */
  url?: string;
}

/** Judgement result for a hit note. */
export type Judgement = 'perfect' | 'good' | 'miss';

/** Timing windows in seconds. */
export interface TimingWindows {
  perfect: number;
  good: number;
  miss: number;
}

/** Player state during a game session. */
export interface PlayerState {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
}

/** Abstract input event from any source (keyboard, touch, gamepad). */
export interface PadInputEvent {
  pad: PadId;
  /** True = pressed, false = released. */
  pressed: boolean;
  /** Timestamp from the audio clock (seconds). */
  time: number;
}

/** Level format — data-driven, renderer-agnostic. */
export interface LevelData {
  formatVersion: number;
  metadata: {
    id: string;
    name: string;
    difficulty: string;
    author: string;
  };
  song: SongInfo;
  pads: PadConfig[];
  notes: Note[];
  timing: {
    bpm: number;
    offset: number;
    windows: TimingWindows;
  };
  visual: {
    nodes: SceneNodeData[];
    animations: AnimationData[];
    triggers: TriggerData[];
  };
}

// ---- Data-Driven Visual Engine Types ----

export interface SceneNodeData {
  id: string;
  type: string;
  parentId?: string;
  transform?: {
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    opacity?: number;
  };
  properties?: Record<string, unknown>;
}

export interface TriggerData {
  // Placeholder for future trigger system
  id: string;
  type: string;
  [key: string]: unknown;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  time: number; // in seconds
  value: number;
  easing?: EasingType;
}

export interface AnimationData {
  id: string;
  targetId: string; // ID of the VisualObject or SceneGroup
  property: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'alpha';
  keyframes: Keyframe[];
}

/** Audio frequency band data for visual reactivity. */
export interface AudioBands {
  bass: number;
  mids: number;
  treble: number;
  amplitude: number;
  /** Raw frequency data (0-255 per bin). */
  freqData: Uint8Array;
  /** Time-domain waveform data (0-255 per sample). */
  waveData: Uint8Array;
}

/** Callback when a note is judged. */
export interface JudgementCallback {
  (note: Note, judgement: Judgement, offset: number): void;
}
