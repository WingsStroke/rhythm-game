import type { SongData } from '../types';

/**
 * SongRegistry — Centralized registry for SongData assets.
 *
 * Prepared as the foundational data model for Phase 5 (Content Pipeline).
 * In Phase 5, this registry will be actively integrated with AudioEngine to manage
 * multi-difficulty level sharing (Easy, Normal, Hard) and decoded AudioBuffer memory caching.
 */
export class SongRegistry {
  private static instance: SongRegistry | null = null;
  private songs: Map<string, SongData> = new Map();

  public static getInstance(): SongRegistry {
    if (!SongRegistry.instance) {
      SongRegistry.instance = new SongRegistry();
    }
    return SongRegistry.instance;
  }

  public registerSong(song: SongData): void {
    this.songs.set(song.id, song);
  }

  public getSong(id: string): SongData | undefined {
    return this.songs.get(id);
  }

  public getAllSongs(): SongData[] {
    return Array.from(this.songs.values());
  }

  public hasSong(id: string): boolean {
    return this.songs.has(id);
  }

  public clear(): void {
    this.songs.clear();
  }
}
