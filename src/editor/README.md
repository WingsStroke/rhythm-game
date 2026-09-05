# src/editor

The level editor application. Built with React and styled with Tailwind CSS. Reuses all engine modules directly, ensuring that what is authored in the editor matches what is rendered at runtime.

The editor is accessible from the game''s start screen. It does not restart the page; it is mounted as a React component alongside the game.

---

## Module Overview

### EditorApp.tsx

Root component. Assembles the full editor layout: header, toolbar, sidebar, timeline, properties panel, and the PixiJS preview canvas.

Owns top-level UI state:
- Active tab (timeline or preview)
- Active tool (select, pen, eraser)
- Grid subdivision
- Creation behavior (tap, hold, loop, trigger)
- Selected event and trigger IDs
- Zoom level

Delegates engine lifecycle to `useEditorEngine` and level state to `useEditorHistory`.

### Timeline.tsx

The primary event authoring surface. A horizontally scrollable, multi-track timeline in DAW style engineered for responsive behavior:

Layout:
- Sticky time ruler at the top with seek-on-click and drag-to-scrub with auto-scroll.
- Dedicated decoupled left column (`w-36` / 144px) for track headers (TIEMPO, pad labels, TRIGGERS, FX LANE) synchronized vertically with the canvas and scroll-forwarded via wheel.
- Adaptive track heights (`flex-1 min-h-[68px]`) expanding on full-screen displays and compressing in windowed mode, with smooth vertical scrolling when content exceeds viewport height.
- An FX LANE track (`h-32`) for `TriggerData` authoring.
- A continuous red playhead line from ruler to FX lane.

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
- Audio file loader (reads a file from disk and passes an `ArrayBuffer` to the transport).
- Recording toggle (arms live record mode).
- Hitsound toggle.

### EditorToolbar.tsx

Tool palette row. Contains:
- Tool selector buttons: Select, Pen, Eraser.
- Grid subdivision selector: 1/1, 1/2, 1/4, 1/8, 1/16, Free.
- Zoom slider.

### EditorSidebarLeft.tsx

Left sidebar for song configuration and scene management. Features dedicated internal vertical scrolling (`overflow-y-auto custom-scrollbar`) for compact windows:
- Song & Pads config tab: Title, BPM, duration, pad labels & roles, keyboard shortcuts.
- Scene Outliner tab.

### SceneOutliner.tsx

Tree view listing all scene nodes from `LevelData.visual.nodes`. Each node displays:
- Its name (e.g. `rect-1`).
- Its numeric ID badge if assigned, or a dimmed `null` indicator if not.

Clicking a node selects it and populates the properties panel. Supports delete.

### EditorPropertiesPanel.tsx

Context-sensitive inspector strictly constrained to viewport height with internal vertical scrolling (`h-full min-h-0 overflow-y-auto custom-scrollbar`):

- **PadEvent selected**: targetTime, padId, behavior, duration, triggerId.
- **TriggerData selected**: time, action type, targetId (numeric or string), easing, duration, properties (transform/color/pulse values).
- **SceneNode selected**: name, numeric ID (trigger group), type-specific properties (x, y, scaleX, scaleY, rotation, opacity, color, width, height, radius), blend mode, visibility, and delete node button. Fully reachable in windowed mode.

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
- Handles recording mode: when `isRecording` is true and the transport is playing, pad press events are captured as `PadEvent` objects with grid-snapped timestamps and passed to the `onRecordEvent` callback.
- Provides `handleSeek`, `handlePlay`, `handleStop`, `handleLoadAudio`, and `handleToggleRecord` to EditorApp.

### useEditorShortcuts.ts

Global `keydown` handler. Wires:
- `Ctrl+Z`: undo.
- `Ctrl+Y` / `Ctrl+Shift+Z`: redo.
- `Space`: play/pause toggle.
- `B`: switch to pen tool.
- `V`: switch to select tool.
- `E`: switch to eraser tool.
