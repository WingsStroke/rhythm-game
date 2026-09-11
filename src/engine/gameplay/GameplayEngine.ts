import type {
  LevelData,
  PadEvent,
  PadId,
  PadState,
  PlayerState,
  Judgement,
  TimingWindows,
  PadInputEvent,
} from '../types';
import type { GameplayEventBus } from './GameplayEventBus';
import { audioTimeToSongTime } from '../time/timeUtils';

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
  private songOffset = 0;
  private playerState: PlayerState;
  private pending: PadEvent[] = [];
  private getTime: () => number;
  public eventBus?: GameplayEventBus;

  /** Tracks active hold events: eventId → PadEvent */
  private activeHolds: Map<string, PadEvent> = new Map();
  /** Tracks active loop events: eventId → ActiveLoopState */
  private activeLoops: Map<string, {
    event: PadEvent;
    activated: boolean;
    startTime: number;
    endTime: number;
    deactivationEvaluated: boolean;
  }> = new Map();
  /** Set of event IDs that are contained inside any loop interval */
  private loopChildIds: Set<string> = new Set();
  /** Map from loop eventId to Set of child event IDs contained within it */
  private loopToChildrenMap: Map<string, Set<string>> = new Map();
  /** Tracks which pads are currently physically pressed */
  private pressedPads: Set<PadId> = new Set();
  /** Tracks the current visual state of each pad */
  private padStates: Map<PadId, PadState> = new Map();
  /** Tracks pending timers to cancel them cleanly on reset/dispose */
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  public onJudgement: ((event: PadEvent, judgement: Judgement, offset: number) => void) | null = null;
  public onComboBreak: (() => void) | null = null;
  public onScoreChange: ((state: PlayerState) => void) | null = null;

  constructor(level: LevelData, getTime: () => number, eventBus?: GameplayEventBus) {
    this.events = [...level.events].sort((a, b) => a.targetTime - b.targetTime);
    this.windows = level.timing.windows;
    this.songOffset = level.timing?.offset ?? 0;
    this.getTime = getTime;
    this.eventBus = eventBus;
    this.playerState = this.freshState();

    // Initialize all pads to 'ready' state
    for (const pad of level.pads) {
      this.padStates.set(pad.id, 'ready');
    }

    this.rebuildLoopRelationships();
  }

  public setOffset(offset: number): void {
    this.songOffset = offset;
  }

  private getSongTime(): number {
    return audioTimeToSongTime(this.getTime(), this.songOffset);
  }

  reset(): void {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.pending = [];
    this.activeHolds.clear();
    this.activeLoops.clear();
    this.pressedPads.clear();
    this.playerState = this.freshState();
    for (const key of this.padStates.keys()) {
      this.emitPadStateChange(key, this.padStates.get(key)!, 'ready');
    }
  }

  setEvents(events: PadEvent[]): void {
    this.events = [...events].sort((a, b) => a.targetTime - b.targetTime);
    this.rebuildLoopRelationships();
    this.start();
  }

  private rebuildLoopRelationships(): void {
    this.loopChildIds.clear();
    this.loopToChildrenMap.clear();

    for (const loop of this.events) {
      if (loop.behavior !== 'loop') continue;
      const duration = loop.duration ?? 1.0;
      const loopEnd = loop.targetTime + duration;
      const children = new Set<string>();

      for (const candidate of this.events) {
        if (
          candidate.id !== loop.id &&
          candidate.padId === loop.padId &&
          candidate.behavior !== 'loop' &&
          candidate.targetTime >= loop.targetTime - 0.001 &&
          candidate.targetTime <= loopEnd + 0.001
        ) {
          children.add(candidate.id);
          this.loopChildIds.add(candidate.id);
        }
      }

      this.loopToChildrenMap.set(loop.id, children);
    }
  }

  start(startTime?: number): void {
    this.reset();
    const time = startTime ?? this.getSongTime();
    if (time > 0.05) {
      this.pending = this.events.filter((e) => e.targetTime >= time - this.windows.miss);
    } else {
      this.pending = [...this.events];
    }
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
    const time = this.getSongTime();
    const missWindow = this.windows.miss;
    const queueLeadTime = 0.5; // seconds before targetTime to enter 'queued' state

    // Pre-cue upcoming events (this.pending is sorted ascending by targetTime)
    for (const evt of this.pending) {
      const timeToEvent = evt.targetTime - time;
      if (timeToEvent > queueLeadTime) {
        break;
      }
      if (timeToEvent > 0) {
        // Child notes inside loops are automated and do not pre-cue the pad
        if (this.loopChildIds.has(evt.id)) {
          continue;
        }
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
      // Child notes inside loops must NEVER trigger individual auto-misses
      if (this.loopChildIds.has(evt.id)) {
        continue;
      }
      this.judge(evt, 'miss', time - evt.targetTime);
      if (evt.behavior === 'loop') {
        this.handleMissedLoopStart(evt);
      }
    }

    // Deactivate expired holds
    for (const [id, evt] of this.activeHolds) {
      if (evt.duration !== undefined && time >= evt.targetTime + evt.duration) {
        this.activeHolds.delete(id);
        this.emitPadStateChange(evt.padId, 'holding', 'success', evt);
        this.schedulePadStateTransition(evt.padId, 'success', 'ready', 300);
      }
    }

    // Auto-trigger inner notes inside active loops (no points, pure visual/audio feedback)
    for (const [, loop] of this.activeLoops) {
      if (loop.activated && time >= loop.startTime && time < loop.endTime) {
        for (let i = 0; i < this.pending.length; ) {
          const pendingEvt = this.pending[i];
          if (
            pendingEvt.padId === loop.event.padId &&
            pendingEvt.id !== loop.event.id &&
            pendingEvt.targetTime >= loop.startTime &&
            pendingEvt.targetTime <= time
          ) {
            this.pending.splice(i, 1);
            this.emitPadStateChange(pendingEvt.padId, 'playing', 'playing', pendingEvt);
            this.eventBus?.emit({
              type: 'AUTO_LOOP_HIT',
              padId: pendingEvt.padId,
              time: this.getSongTime(),
              event: pendingEvt,
              score: this.playerState.score,
              combo: this.playerState.combo,
            });
          } else {
            i++;
          }
        }
      }
    }

    // Deactivate loops and evaluate missed deactivations
    for (const [id, loop] of this.activeLoops) {
      if (loop.activated && !loop.deactivationEvaluated && time > loop.endTime + this.windows.miss) {
        loop.deactivationEvaluated = true;
        this.judge(loop.event, 'miss', time - loop.endTime);
        this.activeLoops.delete(id);
        this.emitPadStateChange(loop.event.padId, 'playing', 'ready', loop.event);
      } else if (!loop.activated && time > loop.endTime) {
        this.activeLoops.delete(id);
        this.emitPadStateChange(loop.event.padId, this.padStates.get(loop.event.padId) ?? 'ready', 'ready', loop.event);
      }
    }
  }

  /**
   * Handle a pad press or release from the player.
   */
  handleInput(inputEvent: PadInputEvent): void {
    const { pad, pressed, time: rawTime } = inputEvent;
    const time = audioTimeToSongTime(rawTime, this.songOffset);

    if (pressed) {
      this.pressedPads.add(pad);
      this.handlePress(pad, time);
    } else {
      this.pressedPads.delete(pad);
      this.handleRelease(pad, time);
    }
  }

  private handlePress(pad: PadId, time: number): void {
    // 1. Check for active loop deactivation press
    for (const [id, loop] of this.activeLoops) {
      if (loop.event.padId === pad && loop.activated && !loop.deactivationEvaluated) {
        const deactOffset = Math.abs(time - loop.endTime);
        if (deactOffset <= this.windows.miss) {
          loop.deactivationEvaluated = true;
          const judgement = this.offsetToJudgement(deactOffset);
          const signedOffset = time - loop.endTime;
          this.judge(loop.event, judgement, signedOffset);
          this.activeLoops.delete(id);
          this.emitPadStateChange(pad, 'playing', judgement === 'miss' ? 'miss' : 'success', loop.event);
          this.schedulePadStateTransition(pad, judgement === 'miss' ? 'miss' : 'success', 'ready', 300);
          return;
        }
      }
    }

    // 2. If pad is currently in an active loop interval, player presses don't interfere with auto-playing notes
    for (const [, loop] of this.activeLoops) {
      if (loop.event.padId === pad && loop.activated && time >= loop.startTime && time < loop.endTime - this.windows.miss) {
        return;
      }
    }

    // Find the nearest pending event for this pad within the miss window
    let bestEvt: PadEvent | null = null;
    let bestIndex = -1;
    let bestOffset = Infinity;

    for (let i = 0; i < this.pending.length; i++) {
      const evt = this.pending[i];
      if (evt.padId !== pad) continue;
      // Events are sorted by targetTime; stop if we're too far ahead
      if (evt.targetTime - time > this.windows.miss) break;

      // Inner notes inside loops are automated and can NEVER be hit directly by player input
      if (this.loopChildIds.has(evt.id)) continue;

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
        this.evaluateHoldStart(bestEvt, bestOffset);
        break;
      case 'loop':
        this.evaluateLoopStart(bestEvt, bestOffset, signedOffset);
        break;
      case 'trigger':
        this.evaluateTrigger(bestEvt, bestOffset);
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
        this.emitPadStateChange(pad, 'holding', 'success', evt);
        this.schedulePadStateTransition(pad, 'success', 'ready', 300);
      } else {
        // Released too early — treat as dropped sustain without score/combo impact
        this.emitPadStateChange(pad, 'holding', 'miss', evt);
        this.schedulePadStateTransition(pad, 'miss', 'ready', 400);
      }
      break;
    }
  }

  // ---- Behavior evaluators ----

  private evaluateTap(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    this.judge(evt, judgement, signedOffset);
  }

  private evaluateHoldStart(evt: PadEvent, absOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    if (judgement === 'miss') {
      this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'miss', evt);
      this.schedulePadStateTransition(evt.padId, 'miss', 'ready', 300);
      return;
    }

    // Valid press — start tracking sustain without score/combo modifications
    this.activeHolds.set(evt.id, evt);
    this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'holding', evt);
  }

  private evaluateLoopStart(evt: PadEvent, absOffset: number, signedOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    const duration = evt.duration ?? 1.0;

    if (judgement === 'perfect' || judgement === 'good') {
      this.activeLoops.set(evt.id, {
        event: evt,
        activated: true,
        startTime: evt.targetTime,
        endTime: evt.targetTime + duration,
        deactivationEvaluated: false,
      });

      this.applyHitScore(judgement);
      const s = this.playerState;
      const eventTime = this.getSongTime();
      this.eventBus?.emit({
        type: judgement === 'perfect' ? 'HIT_PERFECT' : 'HIT_GOOD',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: s.combo,
      });

      this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'playing', evt);
      this.onJudgement?.(evt, judgement, signedOffset);
      this.onScoreChange?.(this.state);
    } else {
      this.activeLoops.set(evt.id, {
        event: evt,
        activated: false,
        startTime: evt.targetTime,
        endTime: evt.targetTime + duration,
        deactivationEvaluated: true,
      });

      if (this.playerState.combo > 0) {
        this.onComboBreak?.();
        this.eventBus?.emit({
          type: 'COMBO_BREAK',
          padId: evt.padId,
          time: this.getSongTime(),
          event: evt,
          score: this.playerState.score,
          combo: 0,
        });
      }
      this.applyMiss();
      this.eventBus?.emit({
        type: 'HIT_MISS',
        padId: evt.padId,
        time: this.getSongTime(),
        event: evt,
        score: this.playerState.score,
        combo: 0,
      });

      this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'miss', evt);
      this.schedulePadStateTransition(evt.padId, 'miss', 'ready', 300);

      // Discard any remaining child notes from this.pending so they can never be hit or score points
      const childrenIds = this.loopToChildrenMap.get(evt.id);
      if (childrenIds && childrenIds.size > 0) {
        this.pending = this.pending.filter((p) => !childrenIds.has(p.id));
      }

      this.onJudgement?.(evt, 'miss', signedOffset);
      this.onScoreChange?.(this.state);
    }
  }

  private handleMissedLoopStart(evt: PadEvent): void {
    const duration = evt.duration ?? 1.0;
    this.activeLoops.set(evt.id, {
      event: evt,
      activated: false,
      startTime: evt.targetTime,
      endTime: evt.targetTime + duration,
      deactivationEvaluated: true,
    });
    this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'miss', evt);
    this.schedulePadStateTransition(evt.padId, 'miss', 'ready', 300);

    // Discard any remaining child notes from this.pending so they can never be hit or score points
    const childrenIds = this.loopToChildrenMap.get(evt.id);
    if (childrenIds && childrenIds.size > 0) {
      this.pending = this.pending.filter((p) => !childrenIds.has(p.id));
    }
  }

  private evaluateTrigger(evt: PadEvent, absOffset: number): void {
    const judgement = this.offsetToJudgement(absOffset);
    if (judgement === 'miss') {
      this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'miss', evt);
      this.schedulePadStateTransition(evt.padId, 'miss', 'ready', 300);
      return;
    }

    // Trigger hit — trigger audiovisual FX without combo/score modifications
    this.emitPadStateChange(evt.padId, this.padStates.get(evt.padId) ?? 'ready', 'success', evt);
    this.schedulePadStateTransition(evt.padId, 'success', 'ready', 300);

    const triggerId = evt.triggerId || 'fx_trigger';
    this.eventBus?.emit({
      type: 'TRIGGER_TRIGGERED',
      padId: evt.padId,
      time: this.getSongTime(),
      event: evt,
      triggerId,
    });
  }

  // ---- Core judge helper (for tap/trigger/miss) ----

  private judge(evt: PadEvent, judgement: Judgement, offset: number): void {
    const s = this.playerState;
    const eventTime = this.getSongTime();
    const prevState = this.padStates.get(evt.padId) ?? 'ready';

    if (judgement === 'perfect' || judgement === 'good') {
      this.applyHitScore(judgement);
      this.eventBus?.emit({
        type: judgement === 'perfect' ? 'HIT_PERFECT' : 'HIT_GOOD',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: s.combo,
      });
      this.emitPadStateChange(evt.padId, prevState, 'success');
      this.schedulePadStateTransition(evt.padId, 'success', 'ready', 300);
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
      this.applyMiss();
      this.eventBus?.emit({
        type: 'HIT_MISS',
        padId: evt.padId,
        time: eventTime,
        event: evt,
        score: s.score,
        combo: 0,
      });
      this.emitPadStateChange(evt.padId, prevState, 'miss');
      this.schedulePadStateTransition(evt.padId, 'miss', 'ready', 400);
    }

    this.onJudgement?.(evt, judgement, offset);
    this.onScoreChange?.(this.state);
  }

  private calculateMultiplier(combo: number): number {
    if (combo >= 40) return 8;
    if (combo >= 20) return 4;
    if (combo >= 10) return 2;
    return 1;
  }

  private calculateAccuracy(): number {
    const total = this.playerState.perfectCount + this.playerState.goodCount + this.playerState.missCount;
    if (total === 0) return 100;
    const acc = ((this.playerState.perfectCount * 300 + this.playerState.goodCount * 100) / (total * 300)) * 100;
    return Number(acc.toFixed(1));
  }

  private applyHitScore(judgement: 'perfect' | 'good'): void {
    const s = this.playerState;
    s.combo++;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
    s.multiplier = this.calculateMultiplier(s.combo);

    const basePoints = judgement === 'perfect' ? 300 : 100;
    s.score += basePoints * s.multiplier;

    if (judgement === 'perfect') s.perfectCount++;
    else s.goodCount++;

    s.accuracy = this.calculateAccuracy();
  }

  private applyMiss(): void {
    const s = this.playerState;
    s.combo = 0;
    s.multiplier = 1;
    s.missCount++;
    s.accuracy = this.calculateAccuracy();
  }

  // ---- Helpers ----

  private offsetToJudgement(absOffset: number): Judgement {
    if (absOffset <= this.windows.perfect) return 'perfect';
    if (absOffset <= this.windows.good) return 'good';
    return 'miss';
  }

  private emitPadStateChange(
    padId: PadId,
    oldState: PadState,
    newState: PadState,
    event?: PadEvent
  ): void {
    this.padStates.set(padId, newState);
    this.eventBus?.emit({
      type: 'PAD_STATE_CHANGE',
      padId,
      time: this.getSongTime(),
      oldState,
      newState,
      event,
    });
  }

  private schedulePadStateTransition(
    padId: PadId,
    fromState: PadState,
    toState: PadState,
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      this.emitPadStateChange(padId, fromState, toState);
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  get isComplete(): boolean {
    const lastEvent = this.events.length > 0 ? this.events[this.events.length - 1] : null;
    return (
      this.pending.length === 0 &&
      this.activeHolds.size === 0 &&
      this.activeLoops.size === 0 &&
      this.getSongTime() > (lastEvent?.targetTime ?? 0) + 2
    );
  }

  private freshState(): PlayerState {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      accuracy: 100,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
    };
  }
}
