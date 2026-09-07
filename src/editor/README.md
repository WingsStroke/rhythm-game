# src/editor

The level editor application. Built with React and styled with Tailwind CSS. Reuses all engine modules directly, ensuring that what is authored in the editor matches what is rendered at runtime.

The editor is accessible from the game''s start screen. It does not restart the page; it is mounted as a React component alongside the game.

---

## Module Overview

### EditorApp.tsx

Root component. Assembles the full editor layout: header, toolbar, sidebar, timeline, properties panel, and the PixiJS preview canvas.

Owns top-level UI state:
- Active tab (timeline or preview)
- Active tool (Select, Pen, Object, Eraser)
- Timeline mode (Notes & Pads, FX & Triggers, Visuals & Atmosphere)
- Grid subdivision
- Creation behavior (tap, hold, loop, trigger)
- Object primitive / light / EQ preset
- Selected event, trigger, and scene node IDs
- Zoom level

Delegates engine lifecycle to `useEditorEngine` and level state to `useEditorHistory`.

### Timeline.tsx

The primary event authoring surface. A horizontally scrollable, multi-track timeline in DAW style engineered for responsive behavior across three specialized modes:

1. **Notes & Pads**: Multi-track pad timeline (one row per pad ID) with compact, responsive track heights (`h-14` / 56px minimum) and dynamic expansion to fill available vertical space.
2. **FX & Triggers**: Multi-track trigger automation lanes (up to 8 dynamic tracks) for keyframing animations, audio reactivity, color shifts, and camera pulses without empty voids.
3. **Visuals & Atmosphere**: Scene graph timeline (up to 8 dynamic tracks) featuring draggable `SceneNodeLifespan` bars that define node entry, duration, and exit windows.

Layout Features:
- Sticky time ruler at the top with seek-on-click and drag-to-scrub with auto-scroll.
- Dedicated decoupled left column (`w-36` / 144px) for track headers synchronized vertically with the canvas and scroll-forwarded via wheel.
- Responsive track distribution: tracks occupy full available height and allow smooth vertical scrolling when content exceeds the viewport.
- Multi-selection marquee box, single-click selection, multi-select with Shift/Ctrl, and continuous red playhead line.

### constants.ts

Shared editor constants (default BPM, initial zoom, available subdivisions, behavior labels, etc.).

### utils.ts

Shared utility functions used across editor components.

---

## components/

### EditorHeader.tsx

Top navigation bar. Contains:
- Tab switcher (Timeline / Preview).
- Transport controls (play/pause, stop, seek to start).
- Recording toggle (arms live record mode).
- Hitsound toggle.
- Playback Speed Selector (0.25x, 0.5x, 0.75x, 1.0x).
- Gear settings toggle button: Opens a floating dropdown menu with staggered animations:
  1. `Playtest Level` (F5 / Ctrl+Enter)
  2. `Song & Pads Setup` (opens `SongPadsModal`)
  3. `Load Audio File`
  4. `Import Beatmap (JSON)`
  5. `Export Beatmap (JSON)`
  6. `Exit Editor`

### SongPadsModal.tsx

Centralized settings modal divided into two operational tabs:
- **Song Configuration**: Title, Artist, BPM, Duration, Lead-In pre-roll preparation, Fade In / Fade Out volume envelopes, and interactive Audio Offset Calibrator with fine-tuning step buttons (±1ms, ±10ms).
- **Pads Matrix**: Interactive matrix editor for level-specific pad properties: pad colors, labels, audio channel routing, and acoustic roles. Displays active player keybindings as read-only indicators (player control mapping is configured globally from the main menu's `KeybindingsModal`).

### EditorToolbar.tsx

Tool palette row. Contains:
- Tool selector buttons in standardized order: Select (V), Pen (B), Object (O), Eraser (E).
- Dropdown sub-selector for Pen behavior (tap, hold, loop, trigger).
- Dropdown sub-selector for Object creation:
  - Vector Primitives: Rectangle, Circle, Line, Triangle, Diamond, Star, Hexagon.
  - Lighting: Point Light, Beam Light.
  - Visualizers: Audio Spectrum EQ.
- Timeline Mode switcher: Notes & Pads (`1`), FX & Triggers (`2`), Visuals & Atmosphere (`3`).
- Grid subdivision selector: 1/1, 1/2, 1/4, 1/8, 1/16, Free.
- Zoom controls: Zoom In / Zoom Out buttons, scale slider (40 to 350 px/s), and numeric scale display.
- Waveform watermark toggle button (`W`).

### EditorSidebarLeft.tsx

Dedicated exclusively to the `SceneOutliner`, offering full-height hierarchy inspection with internal vertical scrolling (`overflow-y-auto custom-scrollbar`) for compact windows.

### SceneOutliner.tsx

Tree view listing all scene nodes from `LevelData.visual.nodes`. Each node displays:
- Its name (e.g. `rect-1`).
- Its numeric ID badge if assigned, or a dimmed `null` indicator if not.

Clicking a node selects it and populates the properties panel. Supports multi-selection (Shift/Ctrl) and delete.

### EditorPropertiesPanel.tsx

Context-sensitive inspector strictly constrained to viewport height with internal vertical scrolling (`h-full min-h-0 overflow-y-auto custom-scrollbar`):

- **PadEvent selected**: targetTime, padId, behavior (tap, hold, loop, trigger), duration (automatically hidden for tap events), triggerId.
- **TriggerData selected**: time, action type, targetId (numeric or string), easing, duration, properties (transform/color/pulse values).
- **SceneNode selected**: name, numeric ID (trigger group), type-specific properties (x, y, scaleX, scaleY, rotation, opacity, color, width, height, radius, innerRadius, points, light properties), blend mode, visibility, and delete node button.
- **Multi-selection**: Displays item count and allows batch deletion and grouped inspection.

---

## Live Preview & Transform Gizmo

In the Preview tab, visual objects can be selected and modified directly in the viewport:
- **Direct Selection**: Clicking a scene object selects it; Shift-clicking toggles multi-selection.
- **Transform Gizmo**: A responsive bounding box with 8 scale handles (NW, N, NE, E, SE, S, SW, W) and a move body.
  - **Translation**: Dragging inside the bounding box moves all selected objects.
  - **Proportional/Directional Scaling**: Dragging any of the 8 handles resizes single or multiple objects anchored to the opposing edge or corner.
  - **Live Preview Sync**: Updates the scene graph interactively and commits undoable history entries to `LevelData` upon pointer release.
  - **Isolated Overlay**: Rendered on `editorOverlayContainer` (zIndex 99), ensuring post-processing filters (bloom, glitch) do not distort handles or selection frames.

---

## hooks/

### useEditorHistory.ts

Undo/redo system for `LevelData`.

- Maintains a `past` stack (max 50 entries) and a `future` stack of `LevelData` snapshots.
- `setLevel(newLevel, recordHistory?)`: pushes the current state to `past` and applies the new state. Pass `recordHistory = false` for continuous drag updates (avoids polluting the stack with intermediate frames).
- `undo()`: pops from `past`, pushes current to `future`.
- `redo()`: pops from `future`, pushes current to `past`.
- Wired to Ctrl+Z / Ctrl+Y via `useEditorShortcuts`.

### useEditorEngine.ts

Manages the PixiJS engine lifecycle within the editor context.

- Initializes `AudioTransport`, `VisualEngine`, `InputManager`, `GameplayEngine`, and `GameplayEventBus` when the preview tab is activated.
- Disposes all engine instances when the tab changes away or the component unmounts.
- Maintains a `requestAnimationFrame` loop for the timeline current time display.
- Handles pre-scheduled lead-in playback, continuous time progression through `0.0s`, and live recording mode: captures pad presses as `PadEvent` objects with grid-snapped timestamps.
- Integrates `TransformGizmo` callbacks (`onCommit`, `onChange`) with `useEditorHistory`.
- Provides `handleSeek`, `handlePlay`, `handleStop`, `handleLoadAudio`, and `handleToggleRecord` to EditorApp.

### useEditorShortcuts.ts

Global `keydown` handler. Wires:
- `Ctrl+Z`: undo.
- `Ctrl+Y` / `Ctrl+Shift+Z`: redo.
- `Ctrl+C` / `Ctrl+X` / `Ctrl+V`: copy / cut / paste batch clipboard.
- `Ctrl+D`: duplicate selected items.
- `Ctrl+A`: select all.
- `Ctrl+=` / `Ctrl+-`: zoom in / zoom out anchored to playhead.
- `Space`: play/pause toggle.
- `R`: toggle recording mode.
- `W`: toggle waveform watermark.
- `Delete` / `Backspace`: delete selected event, trigger, or scene node.
- `V`: switch to select tool.
- `B`: switch to pen tool.
- `O`: switch to object tool.
- `E`: switch to eraser tool.
- `1` - `4`: switch timeline mode.
- `F5` / `Ctrl+Enter`: playtest level.
