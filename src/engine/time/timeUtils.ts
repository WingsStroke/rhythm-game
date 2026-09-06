/**
 * Pure mathematical time conversion utilities for the rhythm game engine.
 * Unifies time calculations across AudioEngine, GameplayEngine, VisualEngine,
 * and the Editor Timeline.
 */

/**
 * Returns the effective origin of the song on the timeline canvas.
 * Accounts for both pre-roll lead-in and audio offset.
 */
export function getSongOrigin(leadIn?: number, offset?: number): number {
  return (leadIn ?? 0) + (offset ?? 0);
}

/**
 * Converts raw audio playback time to calibrated song time by applying offset.
 */
export function audioTimeToSongTime(audioTime: number, offset?: number): number {
  return audioTime - (offset ?? 0);
}

/**
 * Converts calibrated song time to raw audio playback time by applying offset.
 */
export function songTimeToAudioTime(songTime: number, offset?: number): number {
  return songTime + (offset ?? 0);
}

/**
 * Converts continuous timeline time (including pre-roll lead-in and offset)
 * to song time.
 */
export function timelineTimeToSongTime(
  timelineTime: number,
  leadIn?: number,
  offset?: number
): number {
  return timelineTime - getSongOrigin(leadIn, offset);
}

/**
 * Converts song time to continuous timeline time (including pre-roll lead-in and offset).
 */
export function songTimeToTimelineTime(
  songTime: number,
  leadIn?: number,
  offset?: number
): number {
  return songTime + getSongOrigin(leadIn, offset);
}

/**
 * Converts song time to horizontal pixel coordinate on the timeline canvas.
 */
export function songTimeToTimelineX(
  songTime: number,
  pixelsPerSecond: number,
  leadIn?: number,
  offset?: number
): number {
  return songTimeToTimelineTime(songTime, leadIn, offset) * pixelsPerSecond;
}

/**
 * Converts horizontal pixel coordinate on the timeline canvas to calibrated song time.
 */
export function timelineXToSongTime(
  x: number,
  pixelsPerSecond: number,
  leadIn?: number,
  offset?: number
): number {
  const timelineTime = timelineXToTimelineTime(x, pixelsPerSecond);
  return timelineTimeToSongTime(timelineTime, leadIn, offset);
}

/**
 * Converts horizontal pixel coordinate on the timeline canvas to continuous timeline time.
 */
export function timelineXToTimelineTime(
  x: number,
  pixelsPerSecond: number
): number {
  return Math.max(0, x / pixelsPerSecond);
}
