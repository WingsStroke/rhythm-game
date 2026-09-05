# Rhythm Game - Technical Documentation

**Last updated:** 2026-09-05
**Version:** Prototype 2 (Phase 2 completed)
**Repository:** rhythm-game

---

## 1. Project Philosophy

The central premise is that music must be felt, not only heard.

Players do not merely react to visual cues. Every press must produce an immediate and coherent response. The environment must react to musical events: drum hits, intensity changes, song sections, transitions, note combinations, and player actions.

This requires that all systems be designed to work together:

- Audio is not independent of gameplay.
- Gameplay is not disconnected from animations.
- Animations do not depend on values hard-coded inside a specific scene.

A signal must be able to traverse the entire system. Example:

    song increases intensity
    -> audio frequency energy increases in bass band
    -> AudioBands.bass value rises
    -> TriggerDispatcher fires a configured trigger at that timestamp
    -> objects in the scene scale up, change color, emit particles
    -> the scene changes its visual appearance

The designer configures what signals cause what effects. The engine executes the result.

**Priority order when conflicts arise:**

    Gameplay > Synchronization > Legibility > Visual Effects

Visual spectacle must never compromise playability. Frame rate targets: 60 FPS minimum, higher where hardware allows.

---

## 1.2. Design and Interface Philosophy (UI/UX Principles)

From prototype maturation through production runtime, all visual interfaces, menus, and authoring tools must adhere to four design principles:

### 1. Optimización de UI (UI Optimization & Space Ergonomics)
- **Zero Wasted Space**: Interfaces must eliminate dead voids or underutilized areas. Workspaces (such as the timeline authoring surface, outliners, and inspectors) must expand to utilize the available screen real estate efficiently.
- **Visual Ergonomics**: Authoring tracks, interactive pads, notes, handles, and indicators must maintain generous, accessible proportions so clicking, dragging, scrubbing, and inspecting feel comfortable and precise.
- **Visual Hierarchy**: Critical information (playback time, snap division, bpm, pad roles, active tools) must be legible at a glance without eye strain.

### 2. Diseño Totalmente Responsivo (Full Multi-Viewport Responsiveness)
- **Universal Adaptation**: The application must function and look balanced across all viewport formats: standard desktop windowed mode, full-screen F11, laptops (1366x768 / 1440x900), standard 1080p, 1440p, 4K, and ultrawide monitors.
- **Elastic Proportions**: Avoid brittle, hardcoded heights and offsets that cause miniaturization, excessive margins, or element overlap. Containers must use elastic layouts (`flex-1`, `min-h`, percentage bounds, and `ResizeObserver`) to distribute space proportionally.
- **Independent Canvas Preservation**: Decorative background scene nodes scale within a virtual 1920x1080 coordinate reference, while gameplay lanes, launchpads, falling notes, and HUD adapt in real time to the true physical screen bounds.

### 3. Lógica de Diseño No Abrumadora (Contextual, Non-Overwhelming Logic)
- **Focus on the Creative Flow**: The central canvas must prioritize the primary task (playing or composing rhythm tracks). Secondary tools, advanced trigger properties, and node hierarchies must be accessible without visual noise or cognitive clutter.
- **Contextual Presentation**: Information is presented on demand (e.g., selecting a note, trigger, or node opens its targeted properties in the contextual inspector, rather than permanently crowding the viewport with inactive parameters).
- **Predictable Muscle Memory**: Standard, intuitive keybindings (Space for play/pause, DEL/Backspace for deleting any selected element, Ctrl+Z/Ctrl+Y for history, V/B/E for tools) allow creators to author quickly without second-guessing controls.

### 4. Interactividad en Menús (Tactile Micro-Interactions & Rich Feedback)
- **Living Interface**: Every interactive element—buttons, tabs, track headers, handles, toggles, and modal options—must provide immediate, tactile feedback.
- **Multi-State Richness**: Explicit and polished styling for `hover`, `active`, `focus`, and `disabled` states using subtle micro-animations, neon accent illumination, smooth CSS transitions, and elevation shadows.
- **Aesthetic Consistency**: The UI reflects the high-energy, neon-infused cyberpunk and synth aesthetic of the rhythm game, creating an engaging first impression.

---

## 1.1. Technology Stack

### Active

| Technology | Role |
|---|---|
| TypeScript | Primary language |
| React | UI layer (menus, editor, HUD) |
| PixiJS v8 | GPU-accelerated 2D rendering |
| Web Audio API | Audio playback, synthesis, FFT analysis |
| Vite | Build system |
| Tailwind CSS | Editor styling |

### Planned (Not yet integrated)

| Technology | Intended Role |
|---|---|
| Supabase | User accounts, authentication, leaderboards, multiplayer coordination, online events |

`@supabase/supabase-js` is declared in `package.json` in anticipation of backend features. No Supabase client calls exist in the current codebase. The backend architecture has not been designed; it will be addressed as a dedicated project phase.

---

## 2. Architecture Overview

The project is structured into two primary applications sharing a common engine:

- **Game Runtime**: The playable game, accessed from the start screen.
- **Level Editor**: An integrated DAW-style editor for authoring levels.

Both applications are mounted in React inside `App.tsx` and share the same engine modules.

### Timing Architecture

    AudioContext.currentTime (master clock)
        |
        v
    AudioTransport / AudioEngine
        |-- getTime() --> GameplayEngine (hit detection)
        |-- getTime() --> VisualEngine (note positions)
        |-- getAudioBands() --> VisualEngine (FFT reactivity)
        |-- onBeat() --> VisualEngine (beat callbacks)

`requestAnimationFrame` drives rendering through the PixiJS Ticker. All logical time references use the audio clock, not the frame count.

### Event Flow

    InputManager
        -> PadInputEvent
            -> GameplayEngine.handleInput()
                -> Judgement (perfect / good / miss)
                    -> GameplayEventBus.emit()
                        -> VisualEngine (hit feedback, particles)
                        -> Score update callback -> React UI

---

## 3. Module Reference

### src/engine/types.ts

The canonical type system for the entire project. All other modules import from here. No module should define its own competing versions of these types.

Key types:

| Type | Description |
|---|---|
| `PadId` | String identifier for a pad. Represents a sonic function, not a pitch. |
| `PadBehavior` | `tap`, `hold`, `loop`, `trigger`. The interaction mode for an event. |
| `PadState` | `ready`, `queued`, `playing`, `holding`, `success`, `miss`. Visual feedback state. |
| `PadEvent` | A single authored event in the level. Has a stable UUID. |
| `PadConfig` | Configuration for one pad (label, color, key hint, acoustic role). |
| `LevelData` | The full level format. Data-driven and renderer-agnostic. |
| `TriggerData` | A timed visual trigger: action, target, duration, properties. |
| `AudioBands` | Real-time frequency data: bass, mids, treble, amplitude, FFT array. |
| `GameplayEvent` | Events emitted by GameplayEngine via the event bus. |
| `AnimationData` | Keyframe-based animation definition for a scene node property. |
| `SceneNodeData` | Data definition for a visual object in the scene graph. |

---

### src/engine/Game.ts

Top-level orchestrator for the game runtime. Wires all subsystems together and owns the PixiJS ticker update loop.

Responsibilities:

- Instantiates AudioTransport, InputManager, GameplayEngine, GameplayEventBus, and VisualEngine.
- Calls `transport.init()` from a user gesture to comply with browser autoplay policy.
- Runs `frameUpdate()` on every PixiJS tick, advancing gameplay and visuals.
- Provides callbacks for React: `onScoreUpdate`, `onGameComplete`, `onLoadStatus`.

---

### src/engine/audio/AudioEngine.ts

Wraps the Web Audio API. Serves as both the audio clock and the procedural music synthesizer.

Responsibilities:

- Single `AudioContext` as the master clock for the entire game.
- Procedural drum track synthesized using `OscillatorNode` and `GainNode` for operation without external audio assets.
- External audio file playback via `AudioBufferSourceNode`.
- Real-time FFT analysis via `AnalyserNode`. Exposes smoothed bands: bass, mids, treble, amplitude, and raw frequency/wave arrays.
- Beat detection for both procedural and file-based playback modes.
- Four-pad hitsound synthesizer with distinct frequencies for immediate tactile feedback.

### src/engine/audio/AudioModulator.ts

Applies configurable envelope shaping to individual audio frequency bands. Supports asymmetric attack and release times, allowing the visual system to respond differently to rising versus falling signal energy.

---

### src/engine/time/Transport.ts

Interface declaration for all playback control. Any consumer (Game, editor, previewer) depends on this interface, never on AudioEngine directly. Defines: `play`, `pause`, `stop`, `seek`, `getTime`, `getAudioBands`, `loadFile`, `loadAudio`, `playHitsound`, `onBeat`, `onStateChange`.

### src/engine/time/AudioTransport.ts

Concrete implementation of `Transport` backed by `AudioEngine`. Manages play/pause/stop state machine, seek offsets, and audio loading from URL, File, or ArrayBuffer.

### src/engine/time/TimingEngine.ts

Converts audio clock time into beat and bar indices. Used for ruler labels and grid quantization in the editor.

### src/engine/time/TimeSource.ts

Minimal interface: `getTime(): number`. Implemented by AudioEngine for dependency injection.

---

### src/engine/input/InputManager.ts

Abstracts all input sources into a uniform stream of `PadInputEvent` objects identified by `PadId`. Maps keyboard `KeyboardEvent.code` values to pad IDs via a configurable key map. Timestamps events using the audio clock. Provides `pressPad`/`releasePad` methods so touch targets can inject events without bypassing the abstraction.

---

### src/engine/beatmap/BeatmapGenerator.ts

Generates prototype `LevelData` programmatically. Produces structured note patterns aligned to a BPM grid. Used for testing and to populate the prototype level.

---

### src/engine/gameplay/GameplayEngine.ts

Pure gameplay logic. No rendering code.

Responsibilities:

- Tracks which `PadEvent` objects are pending, hit, or missed.
- Matches player input events to the nearest pending `PadEvent` within configured timing windows.
- Handles all four `PadBehavior` types: tap (single-press), hold (press-and-sustain), loop (sustained state until expiry), trigger (fires TRIGGER_TRIGGERED on success).
- Maintains `PlayerState`: score, combo, maxCombo, perfectCount, goodCount, missCount.
- Emits all judgement results via `GameplayEventBus`.

### src/engine/gameplay/GameplayEventBus.ts

Decoupled publish-subscribe bus for gameplay events. VisualEngine subscribes without importing GameplayEngine directly. Event types: `HIT_PERFECT`, `HIT_GOOD`, `HIT_MISS`, `COMBO_BREAK`, `PAD_STATE_CHANGE`, `TRIGGER_TRIGGERED`, `PHRASE_COMPLETED`.

### src/engine/gameplay/PerformancePhrase.ts

Data contract for musical phrase grouping. Detection logic is planned for a future phase.

---

### src/engine/visual/ — Layer Hierarchy

| Layer | zIndex | Contents |
|---|---|---|
| bgLayer | 0 | Ambient reactive background, grid |
| sceneLayer | 5 | Level designer scene graph nodes |
| laneLayer | 10 | Target columns and hit receptors |
| noteLayer | 15 | Incoming falling notes |
| padLayer | 20 | Interactive pads with glow feedback |
| fxLayer | 25 | Particle bursts and hit flares |
| hudLayer | 30 | Score, combo, judgement labels |

### src/engine/visual/VisualEngine.ts

Main PixiJS rendering class. Manages all layers and coordinates visual subsystems on every frame. Scales the decorative `sceneLayer` to fit the viewport using a virtual 1920x1080 coordinate space, while rendering gameplay elements (lanes, interactive launchpad, notes, particle bursts, and judgements) directly in responsive screen space with automatic horizontal centering and adaptive vertical receptor positioning. Integrated with a `ResizeObserver` for immediate layout recalculation upon container dimension changes. Responds to `GameplayEvent` objects from the event bus for hit feedback. Provides `onBeat` callback for beat-synchronized pulses.

### src/engine/visual/SceneGraph.ts

Manages the hierarchy of `SceneNode` objects. Builds from `LevelData.visual.nodes`. Supports lookup by UID, by numeric `targetId` (for trigger grouping), by name, and by group.

### src/engine/visual/objects/SceneNode.ts

Wraps one PixiJS `Container`. Holds `uid` (immutable internal key), `name` (human-readable with counter), and numeric `targetId` (trigger group, null by default). Renders as rectangle, circle, line, container, or group.

### src/engine/visual/TriggerDispatcher.ts

Reads the sorted `TriggerData` array and fires each trigger at the correct audio clock time. Maintains a `nextTriggerIndex` pointer. On seek, performs binary search and cumulatively replays past triggers to restore deterministic visual state. When `targetId` is a number, affects all scene nodes sharing that numeric ID simultaneously.

### src/engine/visual/Animator.ts

Manages active property transitions with configurable easing. On each frame, interpolates values and writes them to PixiJS objects. Supports: x, y, scaleX, scaleY, rotation, alpha, tint.

### src/engine/visual/ParticlePool.ts

Pre-allocated pool of PixiJS `Graphics` objects used as particles. Provides `burst(x, y, color, count)`. Avoids per-frame allocations.

---

### src/editor/EditorApp.tsx

Root component of the editor. Assembles all panels and manages top-level UI state: active tab, active tool, grid subdivision, creation behavior, zoom, selected event/trigger IDs, recording mode. Delegates engine lifecycle to `useEditorEngine` and level state to `useEditorHistory`.

### src/editor/Timeline.tsx

The primary authoring surface. Multi-track DAW-style timeline engineered under the UI optimization and responsive design principles:
- **Decoupled Track Header Architecture & Synchronized Vertical Scrolling**: Dedicated left column (144px / `w-36`) displaying track headers (TIEMPO, Pad labels with role & key indicators, TRIGGERS, FX LANE) that never scrolls horizontally and remains cleanly positioned to the left without ever overlaying notes. In windowed mode or on compact screens, its vertical scroll (`scrollTop`) is synchronized in real-time with the tracks canvas, with mouse wheel forwarding (`onWheel`) for intuitive dual-column navigation.
- **Adaptive Vertical Sizing & Windowed Responsiveness**: Uses an elastic flex distribution (`flex-1` with `min-h-[68px]` per pad track). On tall/full-screen displays, tracks expand smoothly to 110px–165px to fill empty vertical space; in windowed mode (non-fullscreen/reduced height), tracks compress adaptively down to 68px. If the total height exceeds the viewport, smooth vertical scrolling activates without ever clipping the Triggers section or FX Lane.
- **Horizontally Scrollable Canvas**: Scrollable tracks container for ruler, beat/bar grid lines, notes (tap, hold, loop, trigger), scene triggers, and playhead starting at origin `t = 0`.
- **Sticky Time Ruler**: Quantized ruler with seek-on-click, playhead drag, and edge auto-scrolling.

Tools: Pen (insert), Select (move/resize via drag), Eraser (delete on click).

### src/editor/components/EditorHeader.tsx

Top navigation bar: tab switching, transport controls, audio file loading, recording toggle, hitsound toggle. Features overflow-safe horizontal scrolling for narrow window layouts.

### src/editor/components/EditorToolbar.tsx

Tool palette: Select / Pen / Eraser, grid subdivision selector, zoom control. Features horizontal overflow protection for compact viewports.

### src/editor/components/EditorSidebarLeft.tsx

Scene management and metadata sidebar: Song & Pads config (title, BPM, duration, pad roles, shortcuts) and Scene Outliner. Fully responsive with dedicated internal vertical scrolling (`overflow-y-auto custom-scrollbar`) preventing clipping in windowed mode.

### src/editor/components/SceneOutliner.tsx

Tree view of scene nodes. Displays name and numeric ID badge (golden if assigned, dimmed if null). Supports selection and deletion.

### src/editor/components/EditorPropertiesPanel.tsx

Context-sensitive property inspector for selected PadEvent, TriggerData, or SceneNode. Strictly constrained to viewport height with internal vertical scrolling (`h-full min-h-0 overflow-y-auto custom-scrollbar`), guaranteeing that all form fields (Position, Scale, Rotation, Opacity, Dimensions, Color, Blend Mode, and Delete button) remain completely accessible in windowed mode.

### src/editor/hooks/useEditorHistory.ts

Undo/redo system. Fixed-size stack (max 50 snapshots). `setLevel(newLevel, recordHistory?)` pushes to the stack; pass `false` during continuous drags to avoid polluting history with intermediate frames. Ctrl+Z = undo, Ctrl+Y = redo.

### src/editor/hooks/useEditorEngine.ts

Manages engine lifecycle within the editor. Initializes and disposes AudioTransport, VisualEngine, InputManager, GameplayEngine, and GameplayEventBus as tabs change. Handles live recording mode: captures pad presses as `PadEvent` objects with grid-snapped timestamps.

### src/editor/hooks/useEditorShortcuts.ts

Global keyboard shortcut handler. Wires Ctrl+Z, Ctrl+Y, Space, R (record), B (pen), V (select), E (eraser), and Delete/Backspace (deletes whichever item is currently selected: note/event, trigger, or scene node).

---

### src/game/createPrototypeLevel.ts

Generates the prototype `LevelData`. Defines the four pads (Kick, Snare, Lead, Alt Lead), their colors, key bindings, timing windows, and initial events generated by `BeatmapGenerator`. Exports `SONG_URL` (`/song.mp3`).

---

## 4. Level Data Format

`LevelData` is the universal data contract between the editor and the engine, supporting both standalone authored levels and separated `SongData` assets (Sección 11 Informe.md).

```
LevelData {
  formatVersion: number
  metadata: { id, name, difficulty, author }
  songId?: string           // Reference to SongRegistry asset
  song: SongData            // { id, title, artist, bpm, offset, duration, url?, audioUrl?, licenseInfo? }
  pads: PadConfig[]         // id, label, color, keyHint, role, audioChannel?
  events: PadEvent[]        // sorted by targetTime
  timing: { bpm, offset, windows: { perfect, good, miss } }
  visual: {
    nodes: SceneNodeData[]      // scene graph objects
    animations: AnimationData[]
    triggers: TriggerData[]     // timed visual events
    audioMappings?: AudioMapping[] // real-time FFT bands driving node transforms
    settings?: LevelVisualSettings // declarative background, grid & shader intensities
  }
}
```

SceneNodeData fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `uid` | string | auto-generated | Immutable internal key for React and scene graph |
| `name` | string | `type-N` | Human-readable name with counter (e.g. `rect-1`) |
| `id` | number or null | null | Numeric trigger group ID. Null means ungrouped. |
| `type` | string | required | `rectangle`, `circle`, `line`, `container`, `group`, `sprite` |
| `transform` | object | - | x, y, rotation, scaleX, scaleY, opacity, pivotX, pivotY |
| `properties` | object | - | Type-specific values (color, width, height, radius, etc.) |

---

## 5. Current State

### Implemented and working

- Complete game runtime: audio, input, gameplay, PixiJS rendering.
- Standalone Player (`GameScreen`): fixed 1920×1080 logical resolution with automatic letterbox/pillarbox projection.
- Pause system: immediate freeze of AudioTransport and PixiJS ticker via Escape key with full modal controls (Resume, Restart, Exit).
- Real-time Performance HUD (`GameHUD`): dynamic combo multiplier (1x, 2x, 4x, 8x), live percentage accuracy (`Accuracy %`), and top song progress bar with remaining time.
- Results screen (`ResultsModal`): automatic deployment on track completion with rank badges (SS, S, A, B, C, D), detailed hit breakdown (Perfect, Good, Miss), and score stats.
- Complete Editor → Player circle: "PROBAR NIVEL" (Playtest) action in editor header with seamless roundtrip return.
- Level serialization and deserialization: JSON export and import in both Editor and Player.
- Declarative Audio Modulation Channels (`AudioMapping`): FFT frequency bands (`bass`, `mids`, `treble`, `ambient`) driving `SceneNode` transforms (`scale`, `opacity`, `rotation`, `x`, `y`) in real time.
- Semantic pad reactivity: pad audio channels resolved by musical role (`PadRole`) or explicit `audioChannel` in `PadConfig`, eliminating hardcoded array indices.
- Data-driven visual settings (`LevelVisualSettings`): background reactivity, grid pulse, bloom intensity and GLSL RGB aberration shader controlled by level configuration.
- Separation of contracts: `SongData` metadata separated from `LevelData`, with `SongRegistry` preventing duplicate audio buffer allocations.
- Procedural music synthesizer and external audio file playback with runtime fallback.
- Four pad behaviors: tap, hold, loop, trigger.
- Full level editor with timeline, scene outliner, and properties panel.
- DAW-style timeline with sticky track headers, tools, grid snapping (1/1 through 1/16 and free), auto-scroll on playhead drag.
- Undo/redo history (Ctrl+Z / Ctrl+Y, 50-entry stack, drag-safe).
- Live recording mode: captures pad presses as timed events during playback.
- Scene graph with parent-child hierarchy and numeric trigger grouping.
- TriggerDispatcher: time-sorted execution, seek-safe cumulative replay.
- Animator: eased property transitions for scene nodes.
- ParticlePool: pooled particle bursts on hit events.

### Planned (not yet implemented)

- Full keyframe animation curve editor in the timeline.
- Additional shader and post-processing effects (custom GLSL distortion, noise).
- Performance phrase detection and chained rewards.
- Online song/beatmap repository integration (Supabase backend).
- Touch and gamepad input sources.

---

## 6. Contribution and Maintenance Guidelines

- Commit messages must be in Spanish, concise and descriptive.
- Every set of functional changes must be committed immediately after TypeScript verification (`npx tsc -b`).
- `git push` is performed manually by the repository owner; never run it from automated scripts.
- `npm run dev` is run by the developer independently; never invoke it from automated agents.
- Changes to `types.ts` must be reflected in all consuming modules before the commit.
- This file and the per-module READMEs must be updated whenever a module is added, removed, or its public interface changes significantly.
