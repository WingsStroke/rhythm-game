import type { SongData } from '../types';

export interface AudioLoadResult {
  buffer: AudioBuffer | null;
  duration: number;
  cached: boolean;
}

/**
 * SongRegistry — Centralized registry for SongData assets and decoded AudioBuffers.
 *
 * Implements Phase 5 (Content Pipeline & Asset Management):
 *  - Stores SongData metadata dictionary.
 *  - Manages decoded AudioBuffer cache in memory to prevent duplicate network
 *    requests and redundant decodeAudioData calls across difficulty switches
 *    or level restarts for the same track.
 *  - Deduplicates in-flight asynchronous audio loading promises.
 */
export class SongRegistry {
  private static instance: SongRegistry | null = null;
  private songs: Map<string, SongData> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private pendingLoads: Map<string, Promise<AudioLoadResult>> = new Map();

  public static getInstance(): SongRegistry {
    if (!SongRegistry.instance) {
      SongRegistry.instance = new SongRegistry();
    }
    return SongRegistry.instance;
  }

  // ---- Metadata Registration ----

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

  // ---- AudioBuffer Memory Cache ----

  public setAudioBuffer(songId: string, buffer: AudioBuffer): void {
    this.audioBuffers.set(songId, buffer);
  }

  public getAudioBuffer(songId: string): AudioBuffer | undefined {
    return this.audioBuffers.get(songId);
  }

  public hasAudioBuffer(songId: string): boolean {
    return this.audioBuffers.has(songId);
  }

  public removeAudioBuffer(songId: string): boolean {
    return this.audioBuffers.delete(songId);
  }

  public clearAudioBuffers(): void {
    this.audioBuffers.clear();
  }

  /**
   * Loads and decodes an audio file for a given SongData asset, returning the
   * cached buffer if already present or fetching and decoding it once.
   */
  public async loadAudioForSong(song: SongData, ctx: AudioContext): Promise<AudioLoadResult> {
    this.registerSong(song);

    // 1. Check in-memory cache
    const existingBuffer = this.audioBuffers.get(song.id);
    if (existingBuffer) {
      return {
        buffer: existingBuffer,
        duration: existingBuffer.duration,
        cached: true,
      };
    }

    // 2. Check pending in-flight requests to prevent duplicate parallel fetches
    const existingPromise = this.pendingLoads.get(song.id);
    if (existingPromise) {
      return existingPromise;
    }

    const audioUrl = song.url || song.audioUrl;
    if (!audioUrl) {
      return { buffer: null, duration: 0, cached: false };
    }

    // 3. Initiate fetch and decode
    const loadPromise = (async (): Promise<AudioLoadResult> => {
      try {
        const response = await fetch(audioUrl);
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || contentType.includes('text/html')) {
          console.warn(`[SongRegistry] Audio request returned invalid status or HTML (${response.status}, ${contentType}) for song: ${song.id}`);
          return { buffer: null, duration: 0, cached: false };
        }

        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

        this.audioBuffers.set(song.id, decodedBuffer);
        return {
          buffer: decodedBuffer,
          duration: decodedBuffer.duration,
          cached: false,
        };
      } catch (err) {
        console.warn(`[SongRegistry] Failed to decode audio for song "${song.id}":`, err);
        return { buffer: null, duration: 0, cached: false };
      } finally {
        this.pendingLoads.delete(song.id);
      }
    })();

    this.pendingLoads.set(song.id, loadPromise);
    return loadPromise;
  }

  public clear(): void {
    this.songs.clear();
    this.audioBuffers.clear();
    this.pendingLoads.clear();
  }
}
