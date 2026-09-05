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
