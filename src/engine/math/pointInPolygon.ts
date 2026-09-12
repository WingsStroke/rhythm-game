export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Ray-casting algorithm to test if a 2D point lies inside a polygon (Jordan Curve Theorem).
 */
export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Tests whether a bounding box intersects with or is enclosed by a polygon lasso.
 */
export function boundsIntersectPolygon(rect: Rect2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;

  // 1. Check center point
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (pointInPolygon(center, polygon)) return true;

  // 2. Check all 4 corners
  const corners: Point2D[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  for (const c of corners) {
    if (pointInPolygon(c, polygon)) return true;
  }

  // 3. Check if any polygon vertex is inside rect
  for (const p of polygon) {
    if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height) {
      return true;
    }
  }

  return false;
}
