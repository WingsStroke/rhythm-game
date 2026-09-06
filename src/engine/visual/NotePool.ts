import { Container, Graphics } from 'pixi.js';
import type { PadEvent } from '../types';

export const NOTE_SIZE = 56;

export interface PooledNote {
  gfx: Graphics;
  active: boolean;
  event: PadEvent | null;
}

export interface ActiveNote {
  event: PadEvent;
  gfx: Graphics;
}

/**
 * Pre-allocated pool of note display objects in PixiJS v8.
 * Avoids garbage collection pauses by reusing pre-instantiated Graphics objects
 * with tinting and visibility toggles instead of instantiating and destroying per frame.
 */
export class NotePool {
  private container: Container;
  private pool: PooledNote[] = [];
  private freeList: PooledNote[] = [];
  private eventMap: Map<PadEvent, PooledNote> = new Map();

  constructor(container: Container, capacity = 150) {
    this.container = container;
    this.initPool(capacity);
  }

  private initPool(capacity: number): void {
    for (let i = 0; i < capacity; i++) {
      const gfx = new Graphics();
      // Draw static neutral base geometry once: white body + white stroke
      gfx
        .roundRect(-NOTE_SIZE / 2, -NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE, 8)
        .fill({ color: 0xffffff, alpha: 0.92 });
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      gfx.visible = false;
      this.container.addChild(gfx);

      const item: PooledNote = {
        gfx,
        active: false,
        event: null,
      };
      this.pool.push(item);
      this.freeList.push(item);
    }
  }

  /**
   * Borrows a note from the pool for a given PadEvent and sets its tint.
   * O(1) operation using the pre-allocated freeList stack.
   */
  public acquire(event: PadEvent, color: number): PooledNote | null {
    const existing = this.eventMap.get(event);
    if (existing) return existing;

    let item = this.freeList.pop();

    // Expand pool capacity if high-density stream exceeds initial estimate
    if (!item) {
      const gfx = new Graphics();
      gfx
        .roundRect(-NOTE_SIZE / 2, -NOTE_SIZE / 2, NOTE_SIZE, NOTE_SIZE, 8)
        .fill({ color: 0xffffff, alpha: 0.92 });
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
      gfx.visible = false;
      this.container.addChild(gfx);
      item = { gfx, active: false, event: null };
      this.pool.push(item);
    }

    item.active = true;
    item.event = event;
    item.gfx.tint = color;
    item.gfx.visible = true;
    this.eventMap.set(event, item);
    return item;
  }

  /**
   * Returns whether an event currently has an active note checked out.
   */
  public has(event: PadEvent): boolean {
    return this.eventMap.has(event);
  }

  /**
   * Releases a note associated with an event back to the pool.
   * O(1) operation returning the note to the freeList stack.
   */
  public release(event: PadEvent): void {
    const item = this.eventMap.get(event);
    if (!item) return;

    item.active = false;
    item.event = null;
    item.gfx.visible = false;
    this.eventMap.delete(event);
    this.freeList.push(item);
  }

  /**
   * Returns all currently active notes in the pool.
   */
  public getActiveNotes(): ActiveNote[] {
    const active: ActiveNote[] = [];
    for (const item of this.pool) {
      if (item.active && item.event) {
        active.push({ event: item.event, gfx: item.gfx });
      }
    }
    return active;
  }

  /**
   * Releases all active notes back into the pool.
   */
  public releaseAll(): void {
    for (const item of this.pool) {
      item.active = false;
      item.event = null;
      item.gfx.visible = false;
    }
    this.eventMap.clear();
    this.freeList = [...this.pool];
  }

  /**
   * Cleans up all graphics objects on engine destroy.
   */
  public destroy(): void {
    this.releaseAll();
    for (const item of this.pool) {
      try {
        item.gfx.destroy();
      } catch {
        // Ignored
      }
    }
    this.pool = [];
    this.freeList = [];
    this.eventMap.clear();
  }
}
