import type { LevelData } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';

/**
 * Path where the game looks for an external audio file.
 * Place a song at public/audio/song.mp3 to use it instead of the
 * procedural synthesizer. If the file doesn't exist, the game falls
 * back to procedural audio automatically.
 */
export const SONG_URL = '/audio/song.mp3';

/**
 * Creates the default prototype level.
 *
 * If `songUrl` is provided, the level references that audio file and the
 * AudioEngine will load it. If omitted, the procedural synthesizer plays.
 *
 * The beatmap is always generated procedurally and synced to the BPM —
 * this is a prototype. When a real beatmap is authored (via the editor),
 * it will replace the generated notes.
 */
export function createPrototypeLevel(songUrl?: string): LevelData {
  const bpm = 128;
  const bars = 16; // ~30 seconds of gameplay
  const leadInBars = 2;
  const notes = BeatmapGenerator.generate(bpm, bars, leadInBars);
  const duration = ((bars + leadInBars) * 4 * 60) / bpm;

  return {
    metadata: {
      id: 'proto-001',
      name: 'Neon Pulse',
      difficulty: 'Normal',
      author: 'Prototype',
    },
    song: {
      id: 'proto-song',
      title: 'Neon Pulse',
      artist: songUrl ? 'External Audio' : 'Procedural Audio',
      bpm,
      offset: 0,
      duration,
      url: songUrl,
    },
    pads: BeatmapGenerator.defaultPads(),
    notes,
    timing: {
      bpm,
      offset: 0,
      windows: {
        perfect: 0.045,  // ±45ms
        good: 0.090,     // ±90ms
        miss: 0.150,     // ±150ms -> auto-miss
      },
    },
  };
}
