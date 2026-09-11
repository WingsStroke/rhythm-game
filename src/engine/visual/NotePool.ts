import { Container, Graphics } from 'pixi.js';
import type { PadEvent } from '../types';

export const NOTE_SIZE = 56;

export interface PooledNote {
  container: Container;
  tailGfx: Graphics;
  headGfx: Graphics;
  accentGfx: Graphics;
  active: boolean;
  event: PadEvent | null;
  color: number;
  currentTailHeight: number;
}

export interface ActiveNote {
  event: PadEvent;
  container: Container;
  tailGfx: Graphics;
  headGfx: Graphics;
  accentGfx: Graphics;
  gfx: Container;
}

/**
 * Pre-allocated pool of note display objects in PixiJS v8.
 * Supports distinct visuals and geometry for:
 *   - tap: Crisp rounded rectangle head with luminous jewel
 *   - hold: Rounded rectangle head + sustain tail extending upwards proportional to duration
 *   - loop: Rounded capsule head + concentric loop glyph and striped sustain body
 *   - trigger: Neon diamond/rhombus head with electric cyan/purple aura and spark core
 */
export class NotePool {
  private container: Container;
  private pool: PooledNote[] = [];
  private freeList: PooledNote[] = [];
  private eventMap: Map<string, PooledNote> = new Map();

  constructor(container: Container, capacity = 150) {
    this.container = container;
    this.container.sortableChildren = true;
    this.initPool(capacity);
  }

  private createPooledItem(): PooledNote {
    const root = new Container();
    root.visible = false;

    const tailGfx = new Graphics();
    const headGfx = new Graphics();
    const accentGfx = new Graphics();

    root.addChild(tailGfx);
    root.addChild(headGfx);
    root.addChild(accentGfx);
    this.container.addChild(root);

    return {
      container: root,
      tailGfx,
      headGfx,
      accentGfx,
      active: false,
      event: null,
      color: 0xffffff,
      currentTailHeight: 0,
    };
  }

  private initPool(capacity: number): void {
    for (let i = 0; i < capacity; i++) {
      const item = this.createPooledItem();
      this.pool.push(item);
      this.freeList.push(item);
    }
  }

  /**
   * Configures graphics based on note behavior and color.
   */
  public renderNoteGeometry(item: PooledNote, behavior: string, color: number, tailHeight = 0): void {
    item.headGfx.clear();
    item.accentGfx.clear();
    item.tailGfx.clear();

    if (behavior === 'hold') {
      // Hold Note: Head at (0, 0), sustain tail extending upwards to -tailHeight
      item.headGfx
        .roundRect(-28, -14, 56, 28, 6)
        .fill({ color, alpha: 0.95 })
        .stroke({ color: 0xffffff, width: 2.5, alpha: 0.95 });

      // Sustain center notch
      item.accentGfx
        .roundRect(-4, -7, 8, 14, 3)
        .fill({ color: 0xffffff, alpha: 0.85 });

      this.renderHoldTail(item, color, tailHeight);
    } else if (behavior === 'loop') {
      // Loop Activation Note: Capsule head with neon Play/Loop glyph
      item.headGfx
        .roundRect(-42, -16, 84, 32, 8)
        .fill({ color: 0x070716, alpha: 0.95 })
        .stroke({ color: 0x00ff9d, width: 3, alpha: 1.0 });

      // Core glow
      item.accentGfx
        .roundRect(-38, -12, 76, 24, 6)
        .fill({ color, alpha: 0.35 });

      // Play / Loop start glyph
      item.accentGfx
        .poly([-7, -8, -7, 8, 9, 0])
        .fill({ color: 0x00ff9d, alpha: 1.0 });

      if (tailHeight > 0) {
        this.renderLoopTail(item, color, tailHeight);
      } else {
        item.tailGfx.visible = false;
      }
    } else if (behavior === 'trigger') {
      // Trigger Note: Diamond / Rhombus with electric aura
      item.headGfx
        .poly([-26, 0, 0, -26, 26, 0, 0, 26])
        .fill({ color, alpha: 0.95 })
        .stroke({ color: 0x00e5ff, width: 3, alpha: 1.0 });

      // Spark / core jewel
      item.accentGfx
        .poly([-10, 0, 0, -10, 10, 0, 0, 10])
        .fill({ color: 0xffffff, alpha: 0.98 })
        .circle(0, -26, 2)
        .fill({ color: 0x00e5ff, alpha: 1 })
        .circle(0, 26, 2)
        .fill({ color: 0x00e5ff, alpha: 1 })
        .circle(-26, 0, 2)
        .fill({ color: 0x00e5ff, alpha: 1 })
        .circle(26, 0, 2)
        .fill({ color: 0x00e5ff, alpha: 1 });

      item.tailGfx.visible = false;
    } else {
      // Standard Tap Note: Crisp rounded rectangle
      item.headGfx
        .roundRect(-28, -14, 56, 28, 6)
        .fill({ color, alpha: 0.95 })
        .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });

      // Center jewel pill
      item.accentGfx
        .roundRect(-14, -4, 28, 8, 4)
        .fill({ color: 0xffffff, alpha: 0.85 });

      item.tailGfx.visible = false;
    }
  }

  /**
   * Renders or redraws the sustain tail for a hold note.
   */
  public renderHoldTail(item: PooledNote, color: number, tailHeight: number): void {
    item.tailGfx.clear();
    item.currentTailHeight = tailHeight;

    if (tailHeight <= 2) {
      item.tailGfx.visible = false;
      return;
    }

    item.tailGfx.visible = true;
    const halfW = 18;

    // Body fill (semi-transparent neon glow)
    item.tailGfx
      .rect(-halfW, -tailHeight, halfW * 2, tailHeight)
      .fill({ color, alpha: 0.45 });

    // Edge glowing lines
    item.tailGfx
      .moveTo(-halfW, 0)
      .lineTo(-halfW, -tailHeight)
      .stroke({ color, width: 2, alpha: 0.9 });

    item.tailGfx
      .moveTo(halfW, 0)
      .lineTo(halfW, -tailHeight)
      .stroke({ color, width: 2, alpha: 0.9 });

    // End cap at -tailHeight
    item.tailGfx
      .roundRect(-halfW - 3, -tailHeight - 6, (halfW + 3) * 2, 6, 2)
      .fill({ color: 0xffffff, alpha: 0.85 });
  }

  /**
   * Renders the transparent corridor and stop cap for a loop note.
   */
  public renderLoopTail(item: PooledNote, color: number, tailHeight: number): void {
    item.tailGfx.clear();
    item.currentTailHeight = tailHeight;

    if (tailHeight <= 2) {
      item.tailGfx.visible = false;
      return;
    }

    item.tailGfx.visible = true;
    const halfW = 42; // Width of the pad track column (84px total, nicely fits pad width)

    // 1. Transparent corridor body fill
    item.tailGfx
      .roundRect(-halfW, -tailHeight, halfW * 2, tailHeight, 6)
      .fill({ color, alpha: 0.16 });

    // 2. Lateral neon guide rails
    item.tailGfx
      .moveTo(-halfW, 0)
      .lineTo(-halfW, -tailHeight)
      .stroke({ color: 0x00ff9d, width: 2.5, alpha: 0.85 });

    item.tailGfx
      .moveTo(halfW, 0)
      .lineTo(halfW, -tailHeight)
      .stroke({ color: 0x00ff9d, width: 2.5, alpha: 0.85 });

    // 3. Subtle periodic crossbars
    const step = 45;
    for (let y = -step; y > -tailHeight + 20; y -= step) {
      item.tailGfx
        .moveTo(-halfW + 6, y)
        .lineTo(halfW - 6, y)
        .stroke({ color: 0xffffff, width: 1, alpha: 0.15 });
    }

    // 4. End Cap / Deactivation Marker (Stop marker at -tailHeight)
    item.tailGfx
      .roundRect(-halfW, -tailHeight - 16, halfW * 2, 20, 6)
      .fill({ color: 0x070716, alpha: 0.95 })
      .stroke({ color: 0xff0055, width: 2.5, alpha: 1.0 });

    // Stop icon square inside end cap
    item.tailGfx
      .roundRect(-6, -tailHeight - 10, 12, 12, 2)
      .fill({ color: 0xff0055, alpha: 1.0 });
  }

  /**
   * Borrows a note from the pool for a given PadEvent and sets its graphics.
   */
  public acquire(event: PadEvent, color: number, tailHeight = 0): PooledNote | null {
    const existing = this.eventMap.get(event.id);
    if (existing) {
      existing.event = event;
      existing.color = color;
      this.renderNoteGeometry(existing, event.behavior, color, tailHeight);
      return existing;
    }

    let item = this.freeList.pop();

    if (!item) {
      item = this.createPooledItem();
      this.pool.push(item);
    }

    item.active = true;
    item.event = event;
    item.color = color;
    item.container.visible = true;
    item.container.zIndex = event.behavior === 'loop' ? 1 : 5;
    this.renderNoteGeometry(item, event.behavior, color, tailHeight);
    this.eventMap.set(event.id, item);
    return item;
  }

  /**
   * Returns whether an event currently has an active note checked out.
   */
  public has(eventOrId: PadEvent | string): boolean {
    const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
    return this.eventMap.has(id);
  }

  /**
   * Returns a pooled note by its event or id if active.
   */
  public get(eventOrId: PadEvent | string): PooledNote | undefined {
    const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
    return this.eventMap.get(id);
  }

  /**
   * Releases a note associated with an event back to the pool.
   */
  public release(eventOrId: PadEvent | string): void {
    const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
    const item = this.eventMap.get(id);
    if (!item) return;

    item.active = false;
    item.event = null;
    item.container.visible = false;
    item.tailGfx.clear();
    item.headGfx.clear();
    item.accentGfx.clear();
    this.eventMap.delete(id);
    this.freeList.push(item);
  }

  /**
   * Returns all currently active notes in the pool.
   */
  public getActiveNotes(): ActiveNote[] {
    const active: ActiveNote[] = [];
    for (const item of this.pool) {
      if (item.active && item.event) {
        active.push({
          event: item.event,
          container: item.container,
          tailGfx: item.tailGfx,
          headGfx: item.headGfx,
          accentGfx: item.accentGfx,
          gfx: item.container,
        });
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
      item.container.visible = false;
      item.tailGfx.clear();
      item.headGfx.clear();
      item.accentGfx.clear();
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
        item.tailGfx.destroy();
        item.headGfx.destroy();
        item.accentGfx.destroy();
        item.container.destroy({ children: true });
      } catch {
        // Ignored
      }
    }
    this.pool = [];
    this.freeList = [];
    this.eventMap.clear();
  }
}
