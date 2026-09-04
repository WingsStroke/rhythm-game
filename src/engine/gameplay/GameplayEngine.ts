import type { LevelData, Note, PadId, PlayerState, Judgement, TimingWindows, PadInputEvent } from '../types';

/**
 * GameplayEngine — pure gameplay logic, no rendering.
 *
 * Responsibilities:
 *  - Track which notes are pending, hit, or missed.
 *  - Detect hits when the player presses a pad.
 *  - Assign judgements (perfect / good / miss) based on timing windows.
 *  - Maintain score, combo, and player state.
 *
 * This module is renderer-agnostic. It emits judgement callbacks that
 * the VisualEngine can consume to trigger effects (particles, flash, etc).
 */
export class GameplayEngine {
  private notes: Note[];
  private windows: TimingWindows;
  private playerState: PlayerState;
  private pending: Note[] = [];
  private getTime: () => number;

  public onJudgement: ((note: Note, judgement: Judgement, offset: number) => void) | null = null;
  public onComboBreak: (() => void) | null = null;
  public onScoreChange: ((state: PlayerState) => void) | null = null;

  constructor(level: LevelData, getTime: () => number) {
    this.notes = [...level.notes].sort((a, b) => a.time - b.time);
    this.windows = level.timing.windows;
    this.getTime = getTime;
    this.playerState = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
    };
  }

  reset(): void {
    this.pending = [];
    this.playerState = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
    };
  }

  start(): void {
    this.reset();
    this.pending = [...this.notes];
  }

  get state(): PlayerState {
    return { ...this.playerState };
  }

  get activeNotes(): readonly Note[] {
    return this.pending;
  }

  /**
   * Called every frame. Checks for notes that should be auto-missed
   * because the player didn't hit them in time.
   */
  update(): void {
    const time = this.getTime();
    const missWindow = this.windows.miss;

    // Any pending note whose hit time + miss window has passed is a miss
    while (this.pending.length > 0 && this.pending[0].time + missWindow < time) {
      const note = this.pending.shift()!;
      this.judge(note, 'miss', time - note.time);
    }
  }

  /**
   * Handle a pad press from the player.
   * Finds the nearest pending note for this pad within the timing windows.
   */
  handleInput(event: PadInputEvent): void {
    if (!event.pressed) return;

    const time = event.time;
    const pad = event.pad;

    // Find nearest pending note for this pad
    let best: Note | null = null;
    let bestIndex = -1;
    let bestOffset = Infinity;

    for (let i = 0; i < this.pending.length; i++) {
      const note = this.pending[i];
      if (note.pad !== pad) continue;
      // Notes are sorted by time; if we're past the miss window, stop
      if (note.time - time > this.windows.miss) break;
      const offset = Math.abs(time - note.time);
      if (offset < bestOffset && offset <= this.windows.miss) {
        best = note;
        bestIndex = i;
        bestOffset = offset;
      }
    }

    if (best && bestIndex >= 0) {
      this.pending.splice(bestIndex, 1);
      const offset = time - best.time;
      let judgement: Judgement;
      if (bestOffset <= this.windows.perfect) judgement = 'perfect';
      else if (bestOffset <= this.windows.good) judgement = 'good';
      else judgement = 'miss';
      this.judge(best, judgement, offset);
    }
  }

  private judge(note: Note, judgement: Judgement, offset: number): void {
    const s = this.playerState;

    if (judgement === 'perfect') {
      s.score += 300;
      s.combo++;
      s.perfectCount++;
    } else if (judgement === 'good') {
      s.score += 100;
      s.combo++;
      s.goodCount++;
    } else {
      if (s.combo > 0) this.onComboBreak?.();
      s.combo = 0;
      s.missCount++;
    }

    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    this.onJudgement?.(note, judgement, offset);
    this.onScoreChange?.(this.state);
  }

  get isComplete(): boolean {
    const lastNote = this.notes.length > 0 ? this.notes[this.notes.length - 1] : null;
    return this.pending.length === 0 && this.getTime() > (lastNote?.time ?? 0) + 2;
  }
}
