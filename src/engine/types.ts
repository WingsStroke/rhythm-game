// ---- Core type system for the rhythm engine ----
// These types describe WHAT the engine needs to do, decoupled from
// any rendering technology (PixiJS, WebGL, etc).

/** Pad identity. A pad represents a sonic FUNCTION (e.g. "kick"), not a pitch. */
export type PadId = string;

// ---- PadEvent — replaces the old Note interface ----

/**
 * The interaction mode required from the player for a given event.
 *  - 'tap'     : Single precise press aligned to the target time.
 *  - 'hold'    : Press and sustain from targetTime until targetTime + duration.
 *  - 'loop'    : Activates a persistent playback state for a span of measures.
 *  - 'trigger' : Tap that fires an audiovisual trigger on success.
 */
export type PadBehavior = 'tap' | 'hold' | 'loop' | 'trigger';

/**
 * Discrete states that govern a pad's LED-like feedback.
 *  - 'ready'   : Idle, dim base illumination.
 *  - 'queued'  : Pre-cue flash (~half a measure before the event).
 *  - 'playing' : Loop active, modulated in real-time by FFT spectrum.
 *  - 'holding' : Active sustained press emitting continuous energy.
 *  - 'success' : Hit flash after a valid judgement.
 *  - 'miss'    : Desaturation/dimming after a temporal error.
 */
export type PadState = 'ready' | 'queued' | 'playing' | 'holding' | 'success' | 'miss';

/**
 * A single authoring event in the level. Carries a stable unique ID
 * so that operations in the engine and editor (selection, undo/redo,
 * duplication, serialization) are always safe and index-independent.
 */
export interface PadEvent {
  /** Immutable unique identifier (UUID/nanoid). */
  id: string;
  /** Musical execution timestamp in seconds (audio clock). */
  targetTime: number;
  /** Target pad that must receive the interaction. */
  padId: PadId;
  /** Interaction modality required from the player. */
  behavior: PadBehavior;
  /** Temporal length required for 'hold' and 'loop' behaviors (seconds). */
  duration?: number;
  /** Visual trigger identifier linked to 'trigger' behavior events. */
  triggerId?: string;
  /** Preparatory flag for rhythmic quantization. */
  quantized?: boolean;
}

// ---- Pad configuration ----

/**
 * Semantic acoustic role of a pad within the musical arrangement.
 * Drives default color palettes and VisualEngine reactivity profiles.
 */
export type PadRole =
  | 'kick' | 'snare' | 'drums'
  | 'bass' | 'lead' | 'synth'
  | 'vocal' | 'fx' | 'custom';

/** Pad configuration within a level. */
export interface PadConfig {
  id: PadId;
  /** Human-readable label (e.g. "Kick", "Melody"). */
  label: string;
  /** Color used for notes and pad feedback (hex string, e.g. "#ff0066"). */
  color: string;
  /** Key binding hint for the editor (not used by the engine directly). */
  keyHint?: string;
  /** Semantic acoustic function within the musical arrangement. */
  role?: PadRole;
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

/** Judgement result for a hit event. */
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
  /** All authored pad events, ordered chronologically by targetTime. */
  events: PadEvent[];
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

// ---- Performance Phrases ----

/**
 * Groups a sequence of PadEvents that must be perceived as a single
 * interpretive entity. Used by GameplayEngine to detect and reward
 * successful chained sequences.
 *
 * NOTE: Logic for phrase completion detection is planned for a future phase.
 * This interface defines the data contract only.
 */
export interface PerformancePhrase {
  id: string;
  startTime: number;
  endTime: number;
  /** Ordered list of PadEvent IDs belonging to this phrase. */
  eventIds: string[];
}

// ---- Data-Driven Visual Engine Types ----

export type BlendModeType = 'normal' | 'add' | 'multiply' | 'screen';

export interface SceneNodeTransform {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  pivotX?: number;
  pivotY?: number;
}

export interface SceneNodeData {
  id: string;
  type: string; // 'rectangle' | 'circle' | 'line' | 'container' | 'sprite' | 'group'
  parentId?: string;
  group?: string | number;
  blendMode?: BlendModeType;
  visible?: boolean;
  transform?: SceneNodeTransform;
  properties?: Record<string, unknown>;
}

export interface VisualGroupData extends SceneNodeData {
  type: 'group' | 'container';
  childrenIds?: string[];
}

export type TriggerActionType = 'transform' | 'appearance' | 'effect';
export type EffectType = 'reactivePulse' | 'particleBurst';

export interface TriggerData {
  id: string;
  /** Exact time in seconds from the audio clock. */
  time: number;
  /** Type of action to execute. */
  action: TriggerActionType;
  /** Target SceneNode ID or group identifier. */
  targetId: string;
  /** Easing curve for transition. */
  easing?: EasingType;
  /** Duration of transition in seconds. */
  duration: number;
  /** Key-value pairs of target properties (e.g. { x: 500, opacity: 0.8 }). */
  properties: Record<string, number | string | boolean>;
}

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad';

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

// ---- Gameplay Event Bus Types ----

export type GameplayEventType =
  | 'HIT_PERFECT'
  | 'HIT_GOOD'
  | 'HIT_MISS'
  | 'COMBO_BREAK'
  | 'PAD_STATE_CHANGE'
  | 'TRIGGER_TRIGGERED'
  | 'PHRASE_COMPLETED';

/** Gameplay event emitted by GameplayEngine and dispatched via GameplayEventBus. */
export interface GameplayEvent {
  type: GameplayEventType;
  padId: PadId;
  time: number;
  /** The pad event that originated this gameplay event. */
  event?: PadEvent;
  score?: number;
  combo?: number;
  /** For PAD_STATE_CHANGE: the previous state of the pad. */
  oldState?: PadState;
  /** For PAD_STATE_CHANGE: the new state of the pad. */
  newState?: PadState;
  /** For TRIGGER_TRIGGERED: the visual trigger identifier. */
  triggerId?: string;
  /** For PHRASE_COMPLETED: the phrase identifier. */
  phraseId?: string;
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

/** Callback when a pad event is judged. */
export interface JudgementCallback {
  (event: PadEvent, judgement: Judgement, offset: number): void;
}
