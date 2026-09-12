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
| `AudioEngine.ts` | Web Audio API wrapper. Master clock, procedural synthesizer, external file playback, multi-resolution FFT analysis (main analyser + 512-fft spectrum analyser), hitsounds. |
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
| `Keybindings.ts` | Manages player keyboard-to-pad bindings, canonical defaults (A-S-D-F), collision resolution via automatic key swapping, validation, normalization, and persistent `localStorage` storage (`wings_stroke_keybindings`). |

The engine does not receive key codes directly during gameplay. `InputManager` translates them to pad identifiers and audio timestamps using the active key mapping. Key mappings represent player preferences and remain decoupled from level authoring data.

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
| `VisualEngine.ts` | Main PixiJS rendering orchestrator. Layer hierarchy, note fall animation, pad visuals, HUD, beat pulses, FFT reactivity, post-processing filters, and editor gizmo integration. |
| `SceneGraph.ts` | Manages the hierarchy of `SceneNode` objects. Builds from `LevelData`. Supports UID, name, numeric ID, and group lookups. |
| `Animator.ts` | Manages active property transitions with easing. Writes interpolated values to PixiJS objects each frame. |
| `TriggerDispatcher.ts` | Reads sorted `TriggerData` and fires each trigger at the correct audio time. Seek-safe via binary search and cumulative state replay. |
| `GlowTextureCache.ts` | Shared texture cache for radial glows, soft lights, and particle halos to prevent redundant canvas texture generation and GPU spikes. |
| `NotePool.ts` | Pre-allocated pool of PixiJS Graphics objects for falling notes and sustain trails. |
| `ParticlePool.ts` | Pre-allocated pool of PixiJS Graphics objects used as particles. Provides `burst()`. |
| `objects/SceneNode.ts` | Wraps one PixiJS Container. Holds `uid`, `name`, and numeric `targetId`. Manages transforms, opacity, blend modes, and hit testing. |
| `objects/PrimitiveRegistry.ts` | Procedural vector shape generator for rectangles, circles, lines, triangles, diamonds, stars, hexagons, point lights, and beam lights. |
| `objects/AudioSpectrumVisualizer.ts` | Dynamic audio spectrum visualizer rendering animated EQ frequency bars in real time from Web Audio FFT data. |
| `effects/EffectRegistry.ts` | Registry and manager for full-screen and targeted visual shader filters (bloom, RGB split, chromatic aberration, glitch, blur, vignette, scanlines, color tint). |
| `renderers/LaneRenderer.ts` | Static renderer for translucent lane column backgrounds and neon edge lines. |
| `renderers/PadRenderer.ts` | Static renderer for physical Launchpad pads: silicone caps, neon glow, audio reactivity, and press animation. |
| `editor/TransformGizmo.ts` | Interactive canvas transform gizmo providing translation drag and 8-point proportional/directional scale handles for single and multi-node selection in Live Preview. |

#### Layer Hierarchy

```
bgLayer                (zIndex 0)  : Background and grid
sceneLayer             (zIndex 5)  : Designer scene nodes (background)
laneLayer              (zIndex 10) : Hit receptors
noteLayer              (zIndex 15) : Falling notes
padLayer               (zIndex 20) : Pads
sceneForegroundLayer   (zIndex 22) : Designer scene nodes (foreground)
fxLayer                (zIndex 25) : Particles, flares, and judgement popups
hudLayer               (zIndex 30) : Score, combo, accuracy HUD
editorOverlayContainer (zIndex 99) : TransformGizmo and selection bounds (isolated from post-fx)
```

The sceneLayer operates in a virtual 1920x1080 coordinate space scaled to fit the actual viewport. Top-level post-processing filters are applied to the internal `mainStage` container, ensuring editor tooling on `editorOverlayContainer` remains crisp and undistorted.
