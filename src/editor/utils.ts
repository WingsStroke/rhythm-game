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
