import type { PadId, PadInputEvent } from '../types';

/**
 * InputManager — abstracts input sources (keyboard, touch, gamepad)
 * into pad press/release events.
 *
 * The core engine never sees "A" or "S" — it sees "pad_0 pressed".
 * This allows future touch/gamepad support without changing gameplay code.
 *
 * Key mapping is configurable per-pad.
 */
export type InputHandler = (event: PadInputEvent) => void;

export class InputManager {
  private handler: InputHandler | null = null;
  private keyToPad: Map<string, PadId> = new Map();
  private pressedPads: Set<PadId> = new Set();
  private getTime: () => number;

  /** Active pad-press callbacks for visual feedback. */
  public onPadPress: ((pad: PadId) => void) | null = null;
  public onPadRelease: ((pad: PadId) => void) | null = null;

  constructor(getTime: () => number) {
    this.getTime = getTime;
  }

  /**
   * Set the key-to-pad mapping.
   * @example setKeyMap({ KeyA: 'pad_0', KeyS: 'pad_1', ... })
   */
  setKeyMap(map: Record<string, PadId>): void {
    this.keyToPad = new Map(Object.entries(map));
  }

  setHandler(handler: InputHandler): void {
    this.handler = handler;
  }

  /** Start listening for keyboard events. */
  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  /** Programmatically press a pad (for touch/gamepad adapters). */
  pressPad(pad: PadId): void {
    if (this.pressedPads.has(pad)) return;
    this.pressedPads.add(pad);
    const time = this.getTime();
    this.handler?.({ pad, pressed: true, time });
    this.onPadPress?.(pad);
  }

  releasePad(pad: PadId): void {
    if (!this.pressedPads.has(pad)) return;
    this.pressedPads.delete(pad);
    const time = this.getTime();
    this.handler?.({ pad, pressed: false, time });
    this.onPadRelease?.(pad);
  }

  isPressed(pad: PadId): boolean {
    return this.pressedPads.has(pad);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    const pad = this.keyToPad.get(e.code);
    if (pad) {
      e.preventDefault();
      this.pressPad(pad);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    const pad = this.keyToPad.get(e.code);
    if (pad) {
      e.preventDefault();
      this.releasePad(pad);
    }
  };
}
