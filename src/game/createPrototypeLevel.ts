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
 * Pad semantic roles:
 *  - Pad 0 (Kick)     → role: 'kick',  behavior: 'tap'
 *  - Pad 1 (Snare)    → role: 'snare', behavior: 'tap'
 *  - Pad 2 (Lead)     → role: 'lead',  behavior: 'tap'
 *  - Pad 3 (FX)       → role: 'fx',    behavior: 'tap'
 */
export function createPrototypeLevel(songUrl?: string): LevelData {
  const bpm = 128;
  const bars = 16; // ~30 seconds of gameplay
  const leadInBars = 2;
  const events = BeatmapGenerator.generate(bpm, bars, leadInBars);
  const duration = ((bars + leadInBars) * 4 * 60) / bpm;

  return {
    formatVersion: 1,
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
    events,
    timing: {
      bpm,
      offset: 0,
      windows: {
        perfect: 0.045,  // ±45ms
        good: 0.090,     // ±90ms
        miss: 0.150,     // ±150ms -> auto-miss
      },
    },
    visual: {
      nodes: [
        {
          uid: 'test_rect',
          name: 'rect-1',
          id: null,
          type: 'rectangle',
          transform: {
            x: 960,
            y: 540,
          },
          properties: {
            width: 200,
            height: 100,
            color: '#00e5ff',
          },
        },
      ],
      animations: [
        {
          id: 'test_anim',
          targetId: 'test_rect',
          property: 'x',
          keyframes: [
            { time: 0, value: 960, easing: 'easeInOut' },
            { time: 2, value: 1160, easing: 'easeInOut' },
            { time: 4, value: 960, easing: 'easeInOut' },
          ],
        },
      ],
      triggers: [],
    },
  };
}