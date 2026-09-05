import type { LevelData } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';

/** Default initial level data for the editor. */
export const INITIAL_LEVEL: LevelData = {
  formatVersion: 1,
  metadata: {
    id: 'editor-level-1',
    name: 'New Level',
    difficulty: 'Normal',
    author: 'Editor',
  },
  song: {
    id: 'song-1',
    title: 'New Song',
    artist: 'Unknown',
    bpm: 120,
    offset: 0,
    duration: 120,
  },
  pads: BeatmapGenerator.defaultPads(),
  events: [],
  timing: {
    bpm: 120,
    offset: 0,
    windows: { perfect: 0.045, good: 0.09, miss: 0.15 },
  },
  visual: {
    nodes: [
      {
        id: 'test_rect',
        type: 'rectangle',
        transform: { x: 500, y: 300 },
        properties: { width: 200, height: 100, color: '#00e5ff' },
      },
    ],
    animations: [],
    triggers: [
      {
        id: 'trigger_1',
        time: 0,
        action: 'effect',
        targetId: 'all',
        duration: 0.5,
        properties: { effectType: 'reactivePulse' },
      },
    ],
  },
};
