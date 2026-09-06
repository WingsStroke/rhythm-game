import type { PadConfig, PadId } from '../types';

export type KeybindingMap = Record<string, PadId>;

export const KEYBINDINGS_STORAGE_KEY = 'wings_stroke_keybindings';

export const CANONICAL_PAD_IDS: readonly PadId[] = ['pad_0', 'pad_1', 'pad_2', 'pad_3'] as const;

export const DEFAULT_KEY_MAP: KeybindingMap = {
  KeyA: 'pad_0',
  KeyS: 'pad_1',
  KeyD: 'pad_2',
  KeyF: 'pad_3',
};

/**
 * Derives default keybindings. Falls back to canonical A-S-D-F mapping.
 */
export function getDefaultKeybindings(pads?: PadConfig[]): KeybindingMap {
  const map: KeybindingMap = { ...DEFAULT_KEY_MAP };
  if (pads && pads.length > 0) {
    for (const pad of pads) {
      // If pad is not in canonical map, assign based on keyHint if available
      if (!getBoundKeyForPad(map, pad.id) && pad.keyHint) {
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
  }
  return map;
}

/**
 * Validates and normalizes a keybinding map, ensuring each required pad
 * has exactly one unique key assigned, filling any missing pads from defaults.
 */
export function validateAndNormalizeKeybindings(
  rawBindings: unknown,
  pads?: PadConfig[]
): KeybindingMap {
  const defaults = getDefaultKeybindings(pads);
  if (!rawBindings || typeof rawBindings !== 'object') {
    return defaults;
  }

  const result: KeybindingMap = {};
  const boundPads = new Set<PadId>();
  const boundKeys = new Set<string>();

  for (const [key, padId] of Object.entries(rawBindings as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof padId === 'string' && key.trim().length > 0) {
      if (!boundPads.has(padId) && !boundKeys.has(key)) {
        result[key] = padId;
        boundPads.add(padId);
        boundKeys.add(key);
      }
    }
  }

  // Ensure all canonical pads (and any provided level pads) are bound
  const requiredPads: PadId[] = pads ? pads.map((p) => p.id) : [...CANONICAL_PAD_IDS];
  for (const padId of requiredPads) {
    if (!boundPads.has(padId)) {
      const defaultKey = getBoundKeyForPad(defaults, padId);
      if (defaultKey && !boundKeys.has(defaultKey)) {
        result[defaultKey] = padId;
        boundPads.add(padId);
        boundKeys.add(defaultKey);
      } else {
        // Find any available fallback key
        const fallbackKeys = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
        const availableKey = fallbackKeys.find((k) => !boundKeys.has(k)) || `Key_${padId}`;
        result[availableKey] = padId;
        boundPads.add(padId);
        boundKeys.add(availableKey);
      }
    }
  }

  return result;
}

/**
 * Loads user keybindings from localStorage with validation and default fallback.
 */
export function loadUserKeybindings(pads?: PadConfig[]): KeybindingMap {
  try {
    const raw = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
    if (!raw) return getDefaultKeybindings(pads);
    const parsed = JSON.parse(raw);
    return validateAndNormalizeKeybindings(parsed, pads);
  } catch (err) {
    console.warn('Could not load user keybindings from localStorage:', err);
    return getDefaultKeybindings(pads);
  }
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
 * Clears custom user keybindings from localStorage and returns defaults.
 */
export function resetUserKeybindings(pads?: PadConfig[]): KeybindingMap {
  try {
    localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
  } catch {
    // Ignored
  }
  return getDefaultKeybindings(pads);
}

/**
 * Assigns a key code to a padId with automatic collision swapping.
 * If newKeyCode is already assigned to another pad, the two pads swap keys
 * so neither pad is left unassigned.
 */
export function assignPadKey(
  currentBindings: KeybindingMap,
  targetPadId: PadId,
  newKeyCode: string
): KeybindingMap {
  const updated: KeybindingMap = { ...currentBindings };
  const currentKeyForTarget = getBoundKeyForPad(updated, targetPadId);
  const conflictingPadId = updated[newKeyCode];

  if (conflictingPadId && conflictingPadId !== targetPadId) {
    // Swap keys between conflicting pad and target pad
    if (currentKeyForTarget) {
      updated[currentKeyForTarget] = conflictingPadId;
    } else {
      delete updated[newKeyCode];
    }
    updated[newKeyCode] = targetPadId;
  } else {
    // Remove old binding for target pad
    if (currentKeyForTarget) {
      delete updated[currentKeyForTarget];
    }
    updated[newKeyCode] = targetPadId;
  }

  return updated;
}

/**
 * Human-readable display label for a KeyboardEvent.code.
 */
export function formatKeyCode(code: string): string {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code === 'Space') return 'Space';
  if (code === 'Enter') return 'Enter';
  if (code === 'Tab') return 'Tab';
  if (code === 'Backspace') return 'Backspace';
  if (code === 'ArrowUp') return 'Up';
  if (code === 'ArrowDown') return 'Down';
  if (code === 'ArrowLeft') return 'Left';
  if (code === 'ArrowRight') return 'Right';
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  if (code === 'Comma') return ',';
  if (code === 'Period') return '.';
  if (code === 'Slash') return '/';
  if (code === 'Backslash') return '\\';
  if (code === 'BracketLeft') return '[';
  if (code === 'BracketRight') return ']';
  if (code === 'Minus') return '-';
  if (code === 'Equal') return '=';
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
