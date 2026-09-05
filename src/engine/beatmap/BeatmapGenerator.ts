import type { PadEvent, PadConfig, PadId } from '../types';

/**
 * BeatmapGenerator — generates a playable beatmap procedurally.
 *
 * In the final game, beatmaps are authored data (from the level editor or
 * external files). For the prototype, this generator creates a deterministic
 * pattern synced to the BPM so we can validate gameplay without a hand-crafted
 * level.
 *
 * All generated events use stable UUIDs for safe reference in the editor
 * (selection, undo/redo, duplication) and GameplayEngine (index-free lookup).
 */
export class BeatmapGenerator {
  /**
   * Generates a playable beatmap procedurally adapted to the requested difficulty.
   *
   * @param bpm        Tempo of the song.
   * @param bars       Number of musical bars (4 beats each) to generate.
   * @param difficulty 'Easy' | 'Normal' | 'Hard'
   * @param leadInBars Bars of intro silence/groove before the first note (default 2).
   * @returns          PadEvent array with timestamps in seconds and stable IDs.
   */
  static generateDifficulty(
    bpm: number,
    bars: number,
    difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal',
    leadInBars = 2
  ): PadEvent[] {
    const beatLen = 60 / bpm;
    const events: PadEvent[] = [];
    const pads: PadId[] = ['pad_0', 'pad_1', 'pad_2', 'pad_3'];

    let t = leadInBars * 4 * beatLen;

    for (let bar = 0; bar < bars; bar++) {
      const inSection = bar % 4;

      for (let beat = 0; beat < 4; beat++) {
        if (difficulty === 'Easy') {
          // --- EASY DIFFICULTY ---
          // Kick on beat 0 and beat 2 only (relaxed half-note pulse)
          if (beat === 0 || beat === 2) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t,
              padId: pads[0],
              behavior: 'tap',
            });
          }

          // Snare on beat 1 only
          if (beat === 1) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t,
              padId: pads[1],
              behavior: 'tap',
            });
          }

          // Gentle lead on offbeats in later bars
          if (inSection >= 2 && beat === 3) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen / 2,
              padId: pads[2],
              behavior: 'tap',
            });
          }
        } else if (difficulty === 'Hard') {
          // --- HARD DIFFICULTY ---
          // Kick on every beat
          events.push({
            id: BeatmapGenerator.uid(),
            targetTime: t,
            padId: pads[0],
            behavior: 'tap',
          });

          // Syncopated offbeat kick on eighth in bars 2+
          if (inSection >= 1 && (beat === 1 || beat === 3)) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.5,
              padId: pads[0],
              behavior: 'tap',
            });
          }

          // Snare on beats 1 and 3
          if (beat === 1 || beat === 3) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t,
              padId: pads[1],
              behavior: 'tap',
            });
          }

          // Fast ghost note before beat 3
          if (beat === 2) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.75,
              padId: pads[1],
              behavior: 'tap',
            });
          }

          // Arpeggio on eighth notes throughout all bars
          events.push({
            id: BeatmapGenerator.uid(),
            targetTime: t + beatLen * 0.5,
            padId: pads[2],
            behavior: 'tap',
          });

          // Dense sixteenths bursts
          if (beat === 0 || beat === 2) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.25,
              padId: pads[3],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.75,
              padId: pads[3],
              behavior: 'tap',
            });
          }

          // Intense fill in the 4th bar
          if (inSection === 3 && beat === 3) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.25,
              padId: pads[1],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.5,
              padId: pads[2],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.75,
              padId: pads[3],
              behavior: 'tap',
            });
          }
        } else {
          // --- NORMAL DIFFICULTY (Default) ---
          // Pad 0 (kick) — every beat, tap
          events.push({
            id: BeatmapGenerator.uid(),
            targetTime: t,
            padId: pads[0],
            behavior: 'tap',
          });

          // Pad 1 (snare/perc) — beats 2 and 4, tap
          if (beat === 1 || beat === 3) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t,
              padId: pads[1],
              behavior: 'tap',
            });
          }

          // Pad 2 (lead) — eighth-note arpeggio in bars 2+, tap
          if (inSection >= 1) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen / 2,
              padId: pads[2],
              behavior: 'tap',
            });
          }

          // Pad 3 (second lead) — sixteenth bursts in bars 3+, tap
          if (inSection >= 2 && (beat === 0 || beat === 2)) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.25,
              padId: pads[3],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.75,
              padId: pads[3],
              behavior: 'tap',
            });
          }

          // Dense fill in the last beat of each 4-bar section
          if (inSection === 3 && beat === 3) {
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.25,
              padId: pads[2],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.5,
              padId: pads[1],
              behavior: 'tap',
            });
            events.push({
              id: BeatmapGenerator.uid(),
              targetTime: t + beatLen * 0.75,
              padId: pads[3],
              behavior: 'tap',
            });
          }
        }

        t += beatLen;
      }
    }

    // Sort by targetTime to guarantee chronological order
    events.sort((a, b) => a.targetTime - b.targetTime);

    return events;
  }

  /** Backward-compatible default generator for Normal difficulty. */
  static generate(bpm: number, bars: number, leadInBars = 2): PadEvent[] {
    return BeatmapGenerator.generateDifficulty(bpm, bars, 'Normal', leadInBars);
  }

  static defaultPads(): PadConfig[] {
    return [
      { id: 'pad_0', label: 'Kick',     color: '#ff2d6f', keyHint: 'A', role: 'kick'  },
      { id: 'pad_1', label: 'Snare',    color: '#00e5ff', keyHint: 'S', role: 'snare' },
      { id: 'pad_2', label: 'Lead',     color: '#ffcc00', keyHint: 'D', role: 'lead'  },
      { id: 'pad_3', label: 'Alt Lead', color: '#00ff9d', keyHint: 'F', role: 'fx'    },
    ];
  }

  /**
   * Generates a unique ID for each pad event.
   * Uses crypto.randomUUID() when available (all modern browsers),
   * with a deterministic counter fallback for environments without it.
   */
  private static _counter = 0;
  private static uid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `pad-event-${Date.now()}-${BeatmapGenerator._counter++}`;
  }
}
