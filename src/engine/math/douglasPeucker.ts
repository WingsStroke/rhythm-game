export interface Point2D {
  x: number;
  y: number;
}

/**
 * Calculates perpendicular distance from a point to a line segment.
 */
function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    const px = point.x - lineStart.x;
    const py = point.y - lineStart.y;
    return Math.sqrt(px * px + py * py);
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const distSq = (point.x - projX) * (point.x - projX) + (point.y - projY) * (point.y - projY);
  return Math.sqrt(distSq);
}

/**
 * Douglas-Peucker polyline simplification algorithm.
 * Reduces raw stream of pointer drag points to essential polygonal vertices.
 *
 * @param points Array of 2D input points.
 * @param tolerance Epsilon distance threshold (pixels). Defaults to 3.5.
 */
export function douglasPeucker(points: Point2D[], tolerance = 3.5): Point2D[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const leftRecursive = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const rightRecursive = douglasPeucker(points.slice(maxIndex), tolerance);
    return leftRecursive.slice(0, leftRecursive.length - 1).concat(rightRecursive);
  }

  return [start, end];
}
