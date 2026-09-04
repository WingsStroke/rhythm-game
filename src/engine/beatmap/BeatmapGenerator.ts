import type { LevelData, Note, PadConfig, PadId } from '../types';

/**
 * BeatmapGenerator — generates a playable beatmap procedurally.
 *
 * In the final game, beatmaps are authored data (from the level editor or
 * external files). For the prototype, this generator creates a deterministic
 * pattern synced to the BPM so we can validate gameplay without a hand-crafted
 * map.
 *
 * The pattern alternates pads and adds rhythmic variety.
 */
export class BeatmapGenerator {
  /**
   * @param bpm  Tempo of the song.
   * @param bars Number of musical bars (4 beats each) to generate.
   * @returns    Note array with timestamps in seconds.
   */
  static generate(bpm: number, bars: number): Note[] {
    const beatLen = 60 / bpm;
    const notes: Note[] = [];
    const pads: PadId[] = ['pad_0', 'pad_1', 'pad_2', 'pad_3'];

    let t = 0;
    for (let bar = 0; bar < bars; bar++) {
      const inSection = bar % 4;

      for (let beat = 0; beat < 4; beat++) {
        const globalBeat = bar * 4 + beat;

        // Pad 0 (kick) — every beat
        notes.push({ time: t, pad: pads[0], type: 'tap' });

        // Pad 1 (snare/perc) — beats 2 and 4
        if (beat === 1 || beat === 3) {
          notes.push({ time: t, pad: pads[1], type: 'tap' });
        }

        // Pad 2 (lead) — eighth-note arpeggio in bars 2+
        if (inSection >= 1) {
          notes.push({ time: t + beatLen / 2, pad: pads[2], type: 'tap' });
        }

        // Pad 3 (second lead) — sixteenth bursts in bars 3+
        if (inSection >= 2 && (beat === 0 || beat === 2)) {
          notes.push({ time: t + beatLen * 0.25, pad: pads[3], type: 'tap' });
          notes.push({ time: t + beatLen * 0.75, pad: pads[3], type: 'tap' });
        }

        // Dense fill in the last bar of each section
        if (inSection === 3 && beat === 3) {
          notes.push({ time: t + beatLen * 0.25, pad: pads[2], type: 'tap' });
          notes.push({ time: t + beatLen * 0.5, pad: pads[1], type: 'tap' });
          notes.push({ time: t + beatLen * 0.75, pad: pads[3], type: 'tap' });
        }

        t += beatLen;
      }
    }

    return notes;
  }

  static defaultPads(): PadConfig[] {
    return [
      { id: 'pad_0', label: 'Kick', color: '#ff2d6f', keyHint: 'A' },
      { id: 'pad_1', label: 'Snare', color: '#00e5ff', keyHint: 'S' },
      { id: 'pad_2', label: 'Lead', color: '#ffcc00', keyHint: 'D' },
      { id: 'pad_3', label: 'Alt Lead', color: '#00ff9d', keyHint: 'F' },
    ];
  }
}
