import type { LevelData } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';

/**
 * Creates the default prototype level.
 * The prototype uses a procedural beatmap synced to a 128 BPM track.
 * When a real song is provided, this would be replaced by loaded data.
 */
export function createPrototypeLevel(): LevelData {
  const bpm = 128;
  const bars = 16; // ~30 seconds of gameplay
  const notes = BeatmapGenerator.generate(bpm, bars);

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
      artist: 'Procedural Audio',
      bpm,
      offset: 0,
      duration: (bars * 4 * 60) / bpm,
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
