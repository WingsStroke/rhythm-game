# src/engine/content

Contains models, registries, schema validators, and content pipeline managers for audio assets, song metadata, and multi-difficulty level management.

---

## Module Overview

### SongRegistry.ts

Centralized, singleton registry for `SongData` definitions and decoded `AudioBuffer` memory caching.

```typescript
export class SongRegistry {
  public static getInstance(): SongRegistry;

  // Metadata registration
  public registerSong(song: SongData): void;
  public getSong(id: string): SongData | undefined;
  public getAllSongs(): SongData[];
  public hasSong(id: string): boolean;

  // Decoded AudioBuffer cache
  public setAudioBuffer(songId: string, buffer: AudioBuffer): void;
  public getAudioBuffer(songId: string): AudioBuffer | undefined;
  public hasAudioBuffer(songId: string): boolean;
  public removeAudioBuffer(songId: string): boolean;
  public clearAudioBuffers(): void;

  // Deduplicated async loader
  public loadAudioForSong(song: SongData, ctx: AudioContext): Promise<AudioLoadResult>;
  public clear(): void;
}
```

#### Capabilities (Phase 5 — Content Pipeline & Asset Management)
- Stores track metadata (`id`, `title`, `artist`, `bpm`, `offset`, `duration`, `url`).
- Keeps decoded `AudioBuffer` instances resident in RAM, eliminating duplicate network fetches and CPU-intensive `decodeAudioData` calls when switching difficulties or replaying.
- Deduplicates concurrent in-flight loading requests for the same song asset.

---

### LevelValidator.ts

Deep schema validation, data integrity verification, and sanitization for `LevelData` structures.

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedLevel?: LevelData;
}

export class LevelValidator {
  public static validate(data: unknown): ValidationResult;
  public static sanitize(raw: Record<string, unknown>): LevelData;
}
```

#### Validation Scope
- **Format Version**: Ensures `formatVersion >= 1`.
- **Metadata**: Validates `id`, `name`, `difficulty`, and `author`.
- **Song**: Validates `id`, `bpm` (1–1000), `duration`, and audio URLs.
- **Pads**: Verifies unique IDs, human-readable labels, and color definitions.
- **Events**: Verifies unique IDs, chronological ordering (auto-sorts with warning if unsorted), pad references, valid behaviors (`tap`, `hold`, `loop`, `trigger`), and positive durations for sustains.
- **Timing**: Validates `0 < perfect < good < miss` timing windows.
- **Visual**: Guarantees valid arrays for `nodes`, `animations`, `triggers`, and `audioMappings`, ensuring immutable `uid` node indexing.

---

### ContentManager.ts

High-level content orchestrator bridging level packaging, validation, and cached asset loading.

```typescript
export interface DifficultyOption {
  difficulty: 'Easy' | 'Normal' | 'Hard' | string;
  level: LevelData;
  noteCount: number;
}

export interface LevelPackage {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: number;
  audioUrl?: string;
  difficulties: DifficultyOption[];
}

export class ContentManager {
  public static getInstance(): ContentManager;
  public loadLevel(rawLevel: LevelData | unknown, audioCtx?: AudioContext): Promise<LoadedContent>;
  public createDefaultPackage(songUrl?: string): LevelPackage;
  public isAudioCached(songId: string): boolean;
  public getAudioBuffer(songId: string): AudioBuffer | undefined;
}
```

#### Multi-Difficulty Packages
- Groups multiple difficulty beatmaps (`Easy`, `Normal`, `Hard`) under a single `songId`.
- Seamless difficulty switching with zero audio reloading delay.
