import type { SongData } from '../types';

/**
 * SongRegistry manages registered songs and audio resources.
 * Ensures that multiple levels (e.g. Easy, Medium, Hard) sharing
 * the same song track reuse the same metadata and audio source.
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
