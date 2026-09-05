# src/engine/content

Contains models and registries for audio assets, song metadata, and level content management.

---

## Module Overview

### SongRegistry.ts

Singleton registry for `SongData` definitions.

```typescript
export class SongRegistry {
  public static getInstance(): SongRegistry;
  public registerSong(song: SongData): void;
  public getSong(id: string): SongData | undefined;
  public getAllSongs(): SongData[];
  public hasSong(id: string): boolean;
  public clear(): void;
}
```

#### Purpose and Current State
- Currently serves as an in-memory dictionary of `SongData` metadata (`id`, `title`, `artist`, `bpm`, `offset`, `duration`, `url`).
- It is a preparatory data model for **Phase 5 (Content Pipeline & Asset Management)**.

#### Planned Integration (Phase 5)
- Active integration with `AudioEngine` and `AudioTransport`.
- Multi-difficulty level linking (e.g. Easy, Normal, Hard beatmaps sharing a single song asset and metadata).
- Decoded `AudioBuffer` caching to prevent duplicate memory allocations across difficulty changes.
- Content validation and packaging pipelines.
