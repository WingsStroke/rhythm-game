# Rhythm Game

A browser-based rhythm game built with TypeScript, React, PixiJS, and the Web Audio API.

## Overview

This project is a data-driven rhythm game engine and level editor for the web. Players interact with a set of Launchpads that represent sonic functions within a musical composition. Each pad corresponds to a role in the track (Kick, Snare, Lead, etc.) rather than a musical pitch, and the player must activate the correct pad at the precise time dictated by the beatmap.

The project is developed around three core pillars:

1. Pad interaction as the primary gameplay mechanic.
2. Frame-rate-independent synchronization driven by the audio clock.
3. A data-driven visual system flexible enough to author complex audiovisual experiences without modifying engine code.

The repository contains both the game runtime and a fully integrated level editor.

## Technology Stack

### Current (Active)

| Technology | Role |
|---|---|
| TypeScript | Primary language for engine and editor |
| React | UI layer (menus, editor interface, HUD) |
| PixiJS v8 | GPU-accelerated 2D rendering |
| Web Audio API | Audio playback, synthesis, and FFT analysis |
| Vite | Development server and production bundler |
| Tailwind CSS | Editor styling |

### Planned (Not yet integrated)

| Technology | Intended Role |
|---|---|
| Supabase | Backend infrastructure: user accounts, authentication, leaderboards, online events, and multiplayer coordination |

Supabase is declared as a dependency in `package.json` in anticipation of future backend features. No Supabase client calls exist in the current codebase. The specific backend architecture (tables, auth flow, real-time channels) has not been designed yet and will be addressed in a dedicated phase.

## Requirements

- Node.js >= 18
- A modern browser with Web Audio API support (Chrome 120+, Firefox 120+, Edge 120+)

## Running Locally

```sh
npm install
npm run dev
```

The development server starts at `http://localhost:5173`. The game requires a user gesture to initialize the audio context.

To use an external audio file, place an MP3 or OGG at `public/song.mp3`. The engine will detect its presence automatically and prefer it over the built-in procedural synthesizer.

## Building for Production

```sh
npm run build
```

Output is placed in `dist/`.

## Project Structure

```
src/
  App.tsx                      Root React component and screen router
  main.tsx                     Application entry point
  engine/                      Core runtime engine (renderer-agnostic where possible)
    Game.ts                    Top-level orchestrator
    types.ts                   Shared type definitions
    audio/                     Web Audio API wrapper and modulator
    time/                      Transport interface and audio clock
    input/                     Abstracted input management
    beatmap/                   Beatmap generation utilities
    gameplay/                  Hit detection, scoring, and event bus
    visual/                    PixiJS rendering, scene graph, triggers, particles
  editor/                      Level editor application
    EditorApp.tsx              Editor root component
    Timeline.tsx               DAW-style multi-track event editor
    components/                Editor UI components
    hooks/                     Editor state and engine hooks
    constants.ts               Shared editor constants
    utils.ts                   Shared editor utilities
  game/
    GameScreen.tsx             Standalone Player full-screen view (1920x1080 fixed)
    components/                HUD, PauseModal, and ResultsModal components
    createPrototypeLevel.ts    Prototype level definition
```

## Design Principles

### Core Architecture
- The audio clock (`AudioContext.currentTime`) is the single source of truth for all timing decisions. `requestAnimationFrame` drives rendering only.
- Levels are pure data (`LevelData`). The engine interprets them; no gameplay logic is embedded in level files.
- All subsystems are decoupled. `GameplayEngine` emits events via `GameplayEventBus`. `VisualEngine` subscribes to those events without importing gameplay logic directly.
- The level editor reuses the same engine modules used at runtime, ensuring editor preview fidelity.

### UI/UX Design & Interface Standards
- **UI Optimization & Space Ergonomics**: Full utilization of the screen real estate with zero dead voids. Authoring tracks, interactive pads, notes, handles, and indicators maintain spacious, ergonomic proportions.
- **Full Multi-Viewport Responsiveness**: Fluid multi-viewport adaptability across windowed mode, F11 full-screen, laptops, standard 1080p, and high-DPI/ultrawide displays without element clipping or miniaturization.
- **Contextual, Non-Overwhelming Design Logic**: Clean, hierarchical interfaces where complex parameters are presented contextually on demand in dedicated inspectors rather than crowding the central workspace.
- **Tactile Menu Interactivity & Micro-Interactions**: Tactile micro-interactions with rich, responsive states (`hover`, `active`, `focus`, keyboard navigability) and immediate visual feedback.

## Documentation

Full technical documentation is available in DOCUMENTATION.md.

Per-module documentation is located in each subdirectory under src/.

## License

Private repository. All rights reserved.

