import type { GameplayEvent, GameplayEventType } from '../types';

export type EventBusListener = (event: GameplayEvent) => void;

/**
 * Decoupled event bus for gameplay events.
 *
 * Channels: HIT_PERFECT, HIT_GOOD, HIT_MISS, COMBO_BREAK,
 *           PAD_STATE_CHANGE, TRIGGER_TRIGGERED, PHRASE_COMPLETED
 *
 * Allows VisualEngine and other systems to react to player actions
 * without direct method couplings between classes.
 */
export class GameplayEventBus {
  private listeners: Map<GameplayEventType | '*', Set<EventBusListener>> = new Map();

  /**
   * Subscribes to a specific event type or all events with '*'.
   * Returns an unsubscribe function.
   */
  public subscribe(
    type: GameplayEventType | '*',
    listener: EventBusListener
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Emits a gameplay event to all subscribed listeners.
   */
  public emit(event: GameplayEvent): void {
    const specific = this.listeners.get(event.type);
    if (specific) {
      for (const listener of specific) {
        listener(event);
      }
    }

    const wildcard = this.listeners.get('*');
    if (wildcard) {
      for (const listener of wildcard) {
        listener(event);
      }
    }
  }

  /**
   * Clears all registered listeners.
   */
  public clear(): void {
    this.listeners.clear();
  }
}
