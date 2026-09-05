import type { PerformancePhrase as PerformancePhraseData } from '../types';

/**
 * PerformancePhrase — data container for a grouped sequence of PadEvents.
 *
 * A phrase groups events that should be perceived as a single interpretive
 * entity (e.g. a drum fill, a lead melody run). When all events in the phrase
 * are resolved successfully, a PHRASE_COMPLETED event can be dispatched.
 *
 * NOTE (Phase 2): This class currently acts as a typed data wrapper only.
 * Completion detection logic (tracking which event IDs have been resolved
 * and emitting PHRASE_COMPLETED via the GameplayEventBus) is planned for
 * a future phase alongside the editor's phrase-grouping UI.
 */
export class PerformancePhrase {
  public readonly id: string;
  public readonly startTime: number;
  public readonly endTime: number;
  public readonly eventIds: ReadonlyArray<string>;

  constructor(data: PerformancePhraseData) {
    this.id = data.id;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.eventIds = Object.freeze([...data.eventIds]);
  }

  /** Duration of the phrase in seconds. */
  get duration(): number {
    return this.endTime - this.startTime;
  }

  /** Number of events in the phrase. */
  get length(): number {
    return this.eventIds.length;
  }

  /** Serializes the phrase back to a plain data object. */
  toData(): PerformancePhraseData {
    return {
      id: this.id,
      startTime: this.startTime,
      endTime: this.endTime,
      eventIds: [...this.eventIds],
    };
  }
}
