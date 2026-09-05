import type {
  LevelData,
  PadEvent,
  PadId,
  PadState,
  PlayerState,
  Judgement,
  TimingWindows,
  PadInputEvent,
  GameplayEvent,
} from '../types';
import type { GameplayEventBus } from './GameplayEventBus';

/**
 * GameplayEngine — pure gameplay logic, no rendering.
 *
 * Responsibilities:
 *  - Track which PadEvents are pending, hit, or missed.
 *  - Detect player interactions and match them to PadEvents.
 *  - Evaluate judgements (perfect / good / miss) per PadBehavior:
 *      tap     — classic single-press timing check
 *      hold    — press-and-sustain with two-phase validation
 *      loop    — activates PAD_STATE_CHANGE(playing) until expiry
 *      trigger — tap that fires TRIGGER_TRIGGERED on success
 *  - Maintain score, combo, and PlayerState.
 *  - Emit decoupled events via GameplayEventBus.
 */
export class GameplayEngine {
  private events: PadEvent[];
  private windows: TimingWindows;
  private playerState: PlayerState;
  private pending: PadEvent[] = [];
  private getTime: () => number;
  public eventBus?: GameplayEventBus;

  /** Tracks active hold events: eventId → PadEvent */
  private activeHolds: Map<string, PadEvent> = new Map();
  /** Tracks active loop events: eventId → PadEvent */
  private activeLoops: Map<string, PadEvent> = new Map();
  /** Tracks which pads are currently physically pressed */
  private pressedPads: Set<PadId> = new Set();
  /** Tracks the current visual state of each pad */
  private padStates: Map<PadId, PadState> = new Map();

  public onJudgement: ((event: PadEvent, judgement: Judgement, offset: number) => void) | null = null;
  public onComboBreak: (() => void) | null = null;
  public onScoreChange: ((state: PlayerState) => void) | null = null;

  constructor(level: LevelData, getTime: () => number, eventBus?: GameplayEventBus) {
    this.events = [...level.events].sort((a, b) => a.targetTime - b.targetTime);
    this.windows = level.timing.windows;
    this.getTime = getTime;
    this.eventBus = eventBus;
    this.playerState = this.freshState();

    // Initialize all pads to 'ready' state
    for (const pad of level.pads) {
      this.padStates.set(pad.id, 'ready');
    }
  }

  reset(): void {
    this.pending = [];
    this.activeHolds.clear();
    this.activeLoops.clear();
    this.pressedPads.clear();
    this.playerState = this.freshState();
    for (const key of this.padStates.keys()) {
      this.emitPadStateChange(key, this.padStates.get(key)!, 'ready');
    }
  }

  start(): void {
    this.reset();
    this.pending = [...this.events];
  }

  get state(): PlayerState {
    return { ...this.playerState };
  }

  get activeEvents(): readonly PadEvent[] {
    return this.pending;
  }

  /**
   * Called every frame.
   * - Auto-misses events whose window has expired.
   * - Deactivates loops/holds that have run past their duration.
   * - Emits PAD_STATE_CHANGE for queued events approaching their target time.
   */
  update(): void {
    const time = this.getTime();
    const missWindow = this.windows.miss;
    const queueLeadTime = 0.5; // seconds before targetTime to enter 'queued' state

    // Pre-cue upcoming events
    for (const evt of this.pending) {
      if (evt.targetTime - time <= queueLeadTime && evt.targetTime - time > 0) {
        const current = this.padStates.get(evt.padId);
        if (current === 'ready') {
          this.emitPadStateChange(evt.padId, 'ready', 'queued');
        }
      }
    }

    // Auto-miss expired events
    while (
      this.pending.length > 0 &&
      this.pending[0].targetTime + missWindow < time
    ) {
      const evt = this.pending.shift()!;
      this.judge(evt, 'miss', time - evt.targetTime);
    }

    // Deactivate expired holds
    for (const [id, evt] of this.activeHolds) {
      if (evt.duration !== undefined && time >= evt.targetTime + evt.duration) {
        this.activeHolds.delete(id);
        // Pad held long enough — score was already given on press, just reset state
        this.emitPadStateChange(evt.padId, 'holding', 'success');
        setTimeout(() => this.emitPadStateChange(evt.padId, 'success', 'ready'), 300);
      }
    }

    // Deactivate expired loops
    for (const [id, evt] of this.activeLoops) {
      if (evt.duration !== undefined && time >= evt.targetTime + evt.duration) {
        this.activeLoops.delete(id);
        this.emitPadStateChange(evt.padId, 'playing', 'ready');
      }
    }
  }

  /**
   * Handle a pad press or release from the player.
   */
  handleInput(inputEvent: PadInputEvent): void {
    const { pad, pressed, time } = inputEvent;

    if (pressed) {
      this.pressedPads.add(pad);
      this.handlePress(pad, time);
    } else {
      this.pressedPads.delete(pad);
      this.handleRelease(pad, time);
    }
  }

  private handlePress(pad: PadId, time: number): void {
    // Find the nearest pending event for this pad within the miss window
    let bestEvt: PadEvent | null = null;
    let bestIndex = -1;
    let bestOffset = Infinity;

    for (let i = 0; i < this.pending.length; i++) {
      const evt = this.pending[i];
      if (evt.padId !== pad) continue;
      // Events are sorted by targetTime; stop if we're too far ahead
      if (evt.targetTime - time > this.windows.miss) break;
      const offset = Math.abs(time - evt.targetTime);
      if (offset < bestOffset && offset <= this.windows.miss) {
        bestEvt = evt;
        bestIndex = i;
        bestOffset = offset;
      }
    }

    if (!bestEvt || bestIndex < 0) return;

    this.pending.splice(bestIndex, 1);
    const signedOffset = time - bestEvt.targetTime;

    switch (bestEvt.behavior) {
      case 'tap':
        this.evaluateTap(bestEvt, bestOffset, signedOffset);
        break;
      case 'hold':
        this.evaluateHoldStart(bestEvt, bestOffset, signedOffset);
        break;
      case 'loop':
        this.evaluateLoopStart(bestEvt, bestOffset, signedOffset);
        break;
      case 'trigger':
        this.evaluateTrigger(bestEvt, bestOffset, signedOffset);
        break;
    }
  }

  private handleRelease(pad: PadId, time: number): void {
    // Check if a hold event was active on this pad
    for (const [id, evt] of this.activeHolds) {
      if (evt.padId !== pad) continue;
      this.activeHolds.delete(id);

      const heldDuration = time - evt.targetTime;
      const required = evt.duration ?? 0;
      const heldEnough = required === 0 || heldDuration >= required * 0.8;

      if (heldEnough) {
        this.emitPadStateChange(pad, 'holding', 'success');
        setTimeout(() => this.emitPadStateChange(pad, 'success', 'ready'), 300);
      } else {
        // Released too early — treat as miss
        this.emitPadStateChange(pad, 'holding', 'miss');
        const s = this.playerState;
        if (s.combo > 0) this.onComboBreak?.();
        s.combo = 0;
        s.missCount++;
        this.eventBus?.emit({
          type: 'HIT_MISS',
          padId: pad,
          time,
          event: evt,
          score: s.score,
          combo: 0,
        });
        this.onScoreChange?.(this.state);
        setTimeout(() => this.emitPadStateChange(pad, 'miss', 'ready'), 400);
      }
      break;
    }
  }

  // ---- Behavior evaluators ----

  private evaluateTap(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    this.judge(evt, judgement, signedOffset);
  }

  private evaluateHoldStart(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    if (judgement === 'miss') {
      this.judge(evt, 'miss', signedOffset);
      return;
    }

    // Valid press — award score immediately and start tracking the sustain
    const s = this.playerState;
    const points = judgement === 'perfect' ? 300 : 100;
    s.score += points;
    s.combo++;
    if (judgement === 'perfect') s.perfectCount++;
    else s.goodCount++;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    this.eventBus?.emit({
      type: judgement === 'perfect' ? 'HIT_PERFECT' : 'HIT_GOOD',
      padId: evt.padId,
      time: this.getTime(),
      event: evt,
      score: s.score,
      combo: s.combo,
    });
    this.onJudgement?.(evt, judgement, signedOffset);
    this.onScoreChange?.(this.state);

    this.activeHolds.set(evt.id, evt);
    this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'holding');
  }

  private evaluateLoopStart(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    if (judgement === 'miss') {
      this.judge(evt, 'miss', signedOffset);
      return;
    }

    const s = this.playerState;
    const points = judgement === 'perfect' ? 300 : 100;
    s.score += points;
    s.combo++;
    if (judgement === 'perfect') s.perfectCount++;
    else s.goodCount++;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;

    this.eventBus?.emit({
      type: judgement === 'perfect' ? 'HIT_PERFECT' : 'HIT_GOOD',
      padId: evt.padId,
      time: this.getTime(),
      event: evt,
      score: s.score,
      combo: s.combo,
    });
    this.onJudgement?.(evt, judgement, signedOffset);
    this.onScoreChange?.(this.state);

    this.activeLoops.set(evt.id, evt);
    this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'playing');
  }

  private evaluateTrigger(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    this.judge(evt, judgement, signedOffset);

    if (judgement !== 'miss' && evt.triggerId) {
      this.eventBus?.emit({
        type: 'TRIGGER_TRIGGERED',
        padId: evt.padId,
        time: this.getTime(),
        event: evt,
        triggerId: evt.triggerId,
      });
    }
  }

  // ---- Core judge helper (for tap/trigger/miss) ----

  private judge(evt: PadEvent, judgement: Judgement, offset: number): void {
    const s = this.playerState;
    const eventTime = this.getTime();
    const prevState = this.padStates.get(evt.padId) ?? 'ready';

    if (judgement === 'perfect') {
      s.score += 300;
      s.combo++;
      s.perfectCount++;
      this.eventBus?.emit({
        type: 'HIT_PERFECT',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: s.combo,
      });
      this.emitPadStateChange(evt.padId, prevState, 'success');
      setTimeout(() => this.emitPadStateChange(evt.padId, 'success', 'ready'), 300);
    } else if (judgement === 'good') {
      s.score += 100;
      s.combo++;
      s.goodCount++;
      this.eventBus?.emit({
        type: 'HIT_GOOD',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: s.combo,
      });
      this.emitPadStateChange(evt.padId, prevState, 'success');
      setTimeout(() => this.emitPadStateChange(evt.padId, 'success', 'ready'), 300);
    } else {
      if (s.combo > 0) {
        this.onComboBreak?.();
        this.eventBus?.emit({
          type: 'COMBO_BREAK',
          padId: evt.padId,
          time: eventTime,
          event: evt,
          score: s.score,
          combo: 0,
        });
      }
      s.combo = 0;
      s.missCount++;
      this.eventBus?.emit({
        type: 'HIT_MISS',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: 0,
      });
      this.emitPadStateChange(evt.padId, prevState, 'miss');
      setTimeout(() => this.emitPadStateChange(evt.padId, 'miss', 'ready'), 400);
    }

    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
    this.onJudgement?.(evt, judgement, offset);
    this.onScoreChange?.(this.state);
  }

  // ---- Helpers ----

  private offsetToJudgement(absOffset: number): Judgement {
    if (absOffset <= this.windows.perfect) return 'perfect';
    if (absOffset <= this.windows.good) return 'good';
    return 'miss';
  }

  private emitPadStateChange(padId: PadId, oldState: PadState, newState: PadState): void {
    this.padStates.set(padId, newState);
    this.eventBus?.emit({
      type: 'PAD_STATE_CHANGE',
      padId,
      time: this.getTime(),
      oldState,
      newState,
    });
  }

  get isComplete(): boolean {
    const lastEvent = this.events.length > 0 ? this.events[this.events.length - 1] : null;
    return (
      this.pending.length === 0 &&
      this.activeHolds.size === 0 &&
      this.activeLoops.size === 0 &&
      this.getTime() > (lastEvent?.targetTime ?? 0) + 2
    );
  }

  private freshState(): PlayerState {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
    };
  }
}
