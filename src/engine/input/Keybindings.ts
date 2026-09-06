import type { PadConfig, PadId } from '../types';

export type KeybindingMap = Record<string, PadId>;

export const KEYBINDINGS_STORAGE_KEY = 'wings_stroke_keybindings';

/**
 * Derives default keybindings from pad configurations.
 */
export function getDefaultKeybindings(pads: PadConfig[]): KeybindingMap {
  const map: KeybindingMap = {};
  for (const pad of pads) {
    if (pad.keyHint) {
      const hint = pad.keyHint.trim();
      if (hint.length === 1 && /^[a-zA-Z]$/.test(hint)) {
        map[`Key${hint.toUpperCase()}`] = pad.id;
      } else if (hint.length === 1 && /^[0-9]$/.test(hint)) {
        map[`Digit${hint}`] = pad.id;
      } else if (hint.toLowerCase() === 'space') {
        map['Space'] = pad.id;
      } else {
        map[`Key${hint.toUpperCase()}`] = pad.id;
      }
    }
  }
  return map;
}

/**
 * Loads user keybindings from localStorage, merging with defaults.
 */
export function loadUserKeybindings(pads: PadConfig[]): KeybindingMap {
  const defaults = getDefaultKeybindings(pads);
  try {
    const raw = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return { ...defaults, ...parsed };
    }
  } catch (err) {
    console.warn('Could not load user keybindings from localStorage:', err);
  }
  return defaults;
}

/**
 * Persists customized user keybindings to localStorage.
 */
export function saveUserKeybindings(bindings: KeybindingMap): void {
  try {
    localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch (err) {
    console.warn('Could not save user keybindings to localStorage:', err);
  }
}

/**
 * Clears custom user keybindings from localStorage.
 */
export function resetUserKeybindings(): void {
  try {
    localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
  } catch {
    // Ignored
  }
}

/**
 * Human-readable display label for a KeyboardEvent.code.
 */
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ArrowUp') return 'Up Arrow';
  if (code === 'ArrowDown') return 'Down Arrow';
  if (code === 'ArrowLeft') return 'Left Arrow';
  if (code === 'ArrowRight') return 'Right Arrow';
  return code;
}

/**
 * Finds the currently bound key code for a given padId.
 */
export function getBoundKeyForPad(bindings: KeybindingMap, padId: PadId): string | null {
  for (const [code, id] of Object.entries(bindings)) {
    if (id === padId) return code;
  }
  return null;
}
