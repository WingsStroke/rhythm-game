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

| Technology | Role |
|---|---|
| TypeScript | Primary language for engine and editor |
| React | UI layer (menus, editor interface, HUD) |
| PixiJS v8 | GPU-accelerated 2D rendering |
| Web Audio API | Audio playback, synthesis, and FFT analysis |
| Vite | Development server and production bundler |
| Tailwind CSS | Editor styling |

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
    createPrototypeLevel.ts    Prototype level definition
```

## Design Principles

- The audio clock (AudioContext.currentTime) is the single source of truth for all timing decisions. requestAnimationFrame drives rendering only.
- Levels are pure data (LevelData). The engine interprets them; no gameplay logic is embedded in level files.
- All subsystems are decoupled. GameplayEngine emits events via GameplayEventBus. VisualEngine subscribes to those events without importing gameplay logic directly.
- The level editor reuses the same engine modules used at runtime, ensuring editor preview fidelity.

## Documentation

Full technical documentation is available in DOCUMENTATION.md.

Per-module documentation is located in each subdirectory under src/.

## License

Private repository. All rights reserved.
