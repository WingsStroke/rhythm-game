import type { LevelData } from '../types';
import { SongRegistry } from './SongRegistry';
import { LevelValidator } from './LevelValidator';
import { createPrototypeLevel } from '../../game/createPrototypeLevel';

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

export interface LoadedContent {
  level: LevelData;
  audioBuffer: AudioBuffer | null;
  cached: boolean;
}

/**
 * ContentManager — unified orchestrator for level packaging, preloading,
 * and memory-cached asset pipelines.
 *
 * Implements Phase 5 (Content Pipeline & Asset Management):
 *  - Bundles multi-difficulty beatmaps under a unified song identity.
 *  - Interacts with LevelValidator to guarantee level correctness.
 *  - Leverages SongRegistry's AudioBuffer cache so switching difficulties
 *    costs 0ms in network/decoding overhead.
 */
export class ContentManager {
  private static instance: ContentManager | null = null;

  public static getInstance(): ContentManager {
    if (!ContentManager.instance) {
      ContentManager.instance = new ContentManager();
    }
    return ContentManager.instance;
  }

  /**
   * Prepares and preloads a level and its underlying audio asset.
   */
  public async loadLevel(
    rawLevel: LevelData | unknown,
    audioCtx?: AudioContext
  ): Promise<LoadedContent> {
    const validation = LevelValidator.validate(rawLevel);
    if (!validation.valid || !validation.sanitizedLevel) {
      throw new Error(`[ContentManager] Level validation failed: ${validation.errors.join('; ')}`);
    }

    const level = validation.sanitizedLevel;
    const songRegistry = SongRegistry.getInstance();
    songRegistry.registerSong(level.song);

    const songId = level.songId || level.song.id;
    let audioBuffer: AudioBuffer | null = songRegistry.getAudioBuffer(songId) || null;
    let cached = Boolean(audioBuffer);

    if (!audioBuffer && audioCtx && (level.song.url || level.song.audioUrl)) {
      const loadResult = await songRegistry.loadAudioForSong(level.song, audioCtx);
      audioBuffer = loadResult.buffer;
      cached = loadResult.cached;
    }

    return {
      level,
      audioBuffer,
      cached,
    };
  }

  /**
   * Builds a multi-difficulty package for the default prototype track,
   * linking Easy, Normal, and Hard beatmaps to the same song identity.
   */
  public createDefaultPackage(songUrl?: string): LevelPackage {
    const easyLevel = createPrototypeLevel(songUrl, 'Easy');
    const normalLevel = createPrototypeLevel(songUrl, 'Normal');
    const hardLevel = createPrototypeLevel(songUrl, 'Hard');

    // Register prototype song in SongRegistry
    SongRegistry.getInstance().registerSong(normalLevel.song);

    return {
      id: 'pkg_neon_pulse',
      title: normalLevel.song.title,
      artist: normalLevel.song.artist,
      bpm: normalLevel.song.bpm,
      duration: normalLevel.song.duration,
      audioUrl: songUrl,
      difficulties: [
        {
          difficulty: 'Easy',
          level: easyLevel,
          noteCount: easyLevel.events.length,
        },
        {
          difficulty: 'Normal',
          level: normalLevel,
          noteCount: normalLevel.events.length,
        },
        {
          difficulty: 'Hard',
          level: hardLevel,
          noteCount: hardLevel.events.length,
        },
      ],
    };
  }

  /**
   * Checks whether the audio buffer for a given song ID is currently resident in memory.
   */
  public isAudioCached(songId: string): boolean {
    return SongRegistry.getInstance().hasAudioBuffer(songId);
  }

  /**
   * Retrieves an in-memory decoded AudioBuffer for the given song ID if available.
   */
  public getAudioBuffer(songId: string): AudioBuffer | undefined {
    return SongRegistry.getInstance().getAudioBuffer(songId);
  }
}
