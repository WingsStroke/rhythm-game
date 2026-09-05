# src/engine

Core runtime engine. All modules in this directory are renderer-agnostic where possible. They do not import from `src/editor` or `src/game`. Dependencies flow inward: editor and game depend on engine, never the reverse.

## Module Overview

### Game.ts

Top-level orchestrator. Instantiates and connects all subsystems. Owns the per-frame update loop via the PixiJS Ticker. Provides callbacks (`onScoreUpdate`, `onGameComplete`) for the React UI.

### types.ts

Single source of truth for all shared type definitions. Every other module imports from here. Do not define competing type aliases elsewhere.

---

## Subdirectories

### audio/

| File | Description |
|---|---|
| `AudioEngine.ts` | Web Audio API wrapper. Master clock, procedural synthesizer, external file playback, FFT analysis, hitsounds. |
| `AudioModulator.ts` | Envelope shaper for FFT band signals. Configurable asymmetric attack and release. |

AudioEngine is the sole `AudioContext` owner. All time references in the game derive from `AudioContext.currentTime` exposed via its `getTime()` method.

---

### time/

| File | Description |
|---|---|
| `Transport.ts` | Interface for all playback control. Consumers depend on this, not on AudioEngine directly. |
| `AudioTransport.ts` | Concrete Transport implementation backed by AudioEngine. Manages state machine, seek offsets, and audio loading. |
| `TimingEngine.ts` | Converts audio time to beat and bar indices. |
| `TimeSource.ts` | Minimal interface `getTime(): number` for dependency injection. |

---

### input/

| File | Description |
|---|---|
| `InputManager.ts` | Maps raw keyboard events to `PadInputEvent` objects identified by `PadId`. Timestamps events using the audio clock. Provides `pressPad`/`releasePad` methods for touch injection. |

The engine does not receive key codes. It receives pad identifiers and audio timestamps.

---

### beatmap/

| File | Description |
|---|---|
| `BeatmapGenerator.ts` | Generates prototype `LevelData` programmatically. Used for testing and to populate the prototype level without an external file. |

---

### gameplay/

| File | Description |
|---|---|
| `GameplayEngine.ts` | Hit detection, timing window evaluation, state tracking for all four `PadBehavior` types, combo and score management, event emission. No rendering code. |
| `GameplayEventBus.ts` | Publish-subscribe bus. Decouples GameplayEngine from VisualEngine and React UI. |
| `PerformancePhrase.ts` | Data contract for musical phrase grouping. Detection logic is planned for a future phase. |

---

### visual/

| File | Description |
|---|---|
| `VisualEngine.ts` | Main PixiJS rendering class. Layer hierarchy management, note fall animation, pad visuals, HUD, beat pulses, FFT reactivity. |
| `SceneGraph.ts` | Manages the hierarchy of `SceneNode` objects. Builds from `LevelData`. Supports UID, name, numeric ID, and group lookups. |
| `objects/SceneNode.ts` | Wraps one PixiJS Container. Holds `uid`, `name`, and numeric `targetId`. Renders as rectangle, circle, line, container, or group. |
| `TriggerDispatcher.ts` | Reads sorted `TriggerData` and fires each trigger at the correct audio time. Seek-safe via binary search and cumulative state replay. |
| `Animator.ts` | Manages active property transitions with easing. Writes interpolated values to PixiJS objects each frame. |
| `ParticlePool.ts` | Pre-allocated pool of PixiJS Graphics objects used as particles. Provides `burst()`. |

#### Layer Hierarchy

```
bgLayer    (zIndex 0)  : Background and grid
sceneLayer (zIndex 5)  : Designer scene nodes
laneLayer  (zIndex 10) : Hit receptors
noteLayer  (zIndex 15) : Falling notes
padLayer   (zIndex 20) : Pads
fxLayer    (zIndex 25) : Particles and flares
hudLayer   (zIndex 30) : Score, combo, judgements
```

The sceneLayer operates in a virtual 1920x1080 coordinate space scaled to fit the actual viewport.
