export type GridSubdivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | 'free';

/**
 * Formats seconds into standard musical timestamp m:ss.ms
 * @example formatTime(75.4) => "1:15.4"
 */
export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60)
    .toString()
    .padStart(2, '0');
  const ms = Math.floor((t % 1) * 10);
  return `${m}:${s}.${ms}`;
}

/**
 * Calculates the time interval in seconds for a given grid subdivision.
 */
export function getSnapInterval(bpm: number, subdivision: GridSubdivision): number {
  const beatDuration = 60 / bpm;
  switch (subdivision) {
    case '1/1':
      return beatDuration * 4;
    case '1/2':
      return beatDuration * 2;
    case '1/4':
      return beatDuration;
    case '1/8':
      return beatDuration / 2;
    case '1/16':
      return beatDuration / 4;
    case 'free':
    default:
      return 0;
  }
}

/**
 * Snaps a raw time in seconds to the nearest subdivision.
 */
export function snapTimeToGrid(rawTime: number, bpm: number, subdivision: GridSubdivision): number {
  const interval = getSnapInterval(bpm, subdivision);
  if (interval <= 0) return Math.max(0, rawTime);
  return Math.max(0, Math.round(rawTime / interval) * interval);
}

export interface EventCollisionTarget {
  id?: string;
  padId: string;
  targetTime: number;
  duration?: number;
  behavior?: string;
}

/**
 * Checks if two events on the timeline collide or overlap invalidly on the same pad.
 * Rules:
 *  - Events on different pads never collide.
 *  - Two instant notes on the same pad cannot occupy the same targetTime (within tolerance).
 *  - A hold note occupies [targetTime, targetTime + duration]; no other note can overlap this span on the same pad.
 *  - Two loop notes on the same pad cannot overlap.
 *  - Non-loop notes can exist inside a loop span on the same pad, but cannot overlap the Loop Start or Loop End exactly.
 */
export function areEventsColliding(
  a: EventCollisionTarget,
  b: EventCollisionTarget,
  tolerance = 0.03
): boolean {
  if (a.id && b.id && a.id === b.id) return false;
  if (a.padId !== b.padId) return false;

  const aStart = a.targetTime;
  const aDuration = typeof a.duration === 'number' && Number.isFinite(a.duration) ? Math.max(0, a.duration) : 0;
  const aEnd = aStart + aDuration;
  const aIsLoop = a.behavior === 'loop';
  const aIsHold = a.behavior === 'hold' && aDuration > tolerance;

  const bStart = b.targetTime;
  const bDuration = typeof b.duration === 'number' && Number.isFinite(b.duration) ? Math.max(0, b.duration) : 0;
  const bEnd = bStart + bDuration;
  const bIsLoop = b.behavior === 'loop';
  const bIsHold = b.behavior === 'hold' && bDuration > tolerance;

  // Case 1: Two loops on the same pad cannot overlap
  if (aIsLoop && bIsLoop) {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd) - tolerance;
  }

  // Case 2: Loop vs child note on the same pad
  if (aIsLoop && !bIsLoop) {
    if (Math.abs(bStart - aStart) < tolerance) return true;
    if (Math.abs(bStart - aEnd) < tolerance) return true;
    if (bIsHold && bEnd > aEnd + tolerance) return true;
    return false;
  }
  if (!aIsLoop && bIsLoop) {
    if (Math.abs(aStart - bStart) < tolerance) return true;
    if (Math.abs(aStart - bEnd) < tolerance) return true;
    if (aIsHold && aEnd > bEnd + tolerance) return true;
    return false;
  }

  // Case 3: Hold note vs any other note on the same pad
  if (aIsHold && bIsHold) {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd) - tolerance;
  }
  if (aIsHold && !bIsHold) {
    return bStart >= aStart - tolerance && bStart <= aEnd - tolerance;
  }
  if (!aIsHold && bIsHold) {
    return aStart >= bStart - tolerance && aStart <= bEnd - tolerance;
  }

  // Case 4: Instant notes on the same pad
  return Math.abs(aStart - bStart) < tolerance;
}

/**
 * Returns true if the candidate event collides with any of the existing events.
 */
export function hasEventCollision(
  candidate: EventCollisionTarget,
  existingEvents: EventCollisionTarget[],
  tolerance = 0.03
): boolean {
  return existingEvents.some((existing) => areEventsColliding(candidate, existing, tolerance));
}
