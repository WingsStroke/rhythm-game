// @ts-ignore - polybooljs does not provide official TypeScript declarations
import PolyBool from 'polybooljs';
import type { SceneNodeData } from '../types';

export interface PolyBoolPolygon {
  regions: Array<Array<[number, number]>>;
  inverted: boolean;
}

export type BooleanOpType = 'union' | 'intersect' | 'difference';

/**
 * Extracts the 2D stage-coordinate polygonal contour of a SceneNode.
 */
export function extractNodePolygon(node: SceneNodeData): PolyBoolPolygon {
  const transform = node.transform || {};
  const posX = transform.x ?? 960;
  const posY = transform.y ?? 540;
  const rot = transform.rotation ?? 0;
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const skewX = transform.skewX ?? 0;
  const skewY = transform.skewY ?? 0;
  const props = node.properties || {};

  let localPoints: [number, number][] = [];

  switch (node.type) {
    case 'rectangle': {
      const w = ((props.width as number) || 140) / 2;
      const h = ((props.height as number) || 140) / 2;
      localPoints = [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h],
      ];
      break;
    }
    case 'circle': {
      const r = (props.radius as number) || ((props.width as number) ? (props.width as number) / 2 : 70);
      const segments = 24;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        localPoints.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      break;
    }
    case 'triangle': {
      const hw = ((props.width as number) || 120) / 2;
      const hh = ((props.height as number) || 120) / 2;
      localPoints = [
        [0, -hh],
        [hw, hh],
        [-hw, hh],
      ];
      break;
    }
    case 'diamond': {
      const hw = ((props.width as number) || 120) / 2;
      const hh = ((props.height as number) || 120) / 2;
      localPoints = [
        [0, -hh],
        [hw, 0],
        [0, hh],
        [-hw, 0],
      ];
      break;
    }
    case 'hexagon': {
      const r = (props.radius as number) || ((props.width as number) ? (props.width as number) / 2 : 60);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        localPoints.push([Math.cos(angle) * r, Math.sin(angle) * r]);
      }
      break;
    }
    case 'star': {
      const count = Math.max(3, Math.min(20, (props.points as number) || 5));
      const outerR = (props.outerRadius as number) || ((props.width as number) ? (props.width as number) / 2 : 60);
      const innerR = (props.innerRadius as number) || Math.round(outerR * 0.45);
      const step = Math.PI / count;
      let angle = -Math.PI / 2;
      for (let i = 0; i < count * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        localPoints.push([Math.cos(angle) * r, Math.sin(angle) * r]);
        angle += step;
      }
      break;
    }
    case 'polygon': {
      const pts = (props.points as number[]) || [];
      for (let i = 0; i < pts.length; i += 2) {
        localPoints.push([pts[i], pts[i + 1]]);
      }
      break;
    }
    default: {
      const hw = 50;
      const hh = 50;
      localPoints = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];
    }
  }

  // Transform local coordinates into stage coordinates (skew, scale, rotation, translation)
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const stageRegion: [number, number][] = localPoints.map(([lx, ly]) => {
    // 1. Skew
    const skx = lx + Math.tan(skewX) * ly;
    const sky = ly + Math.tan(skewY) * lx;
    // 2. Scale
    const scx = skx * scaleX;
    const scy = sky * scaleY;
    // 3. Rotation
    const rx = scx * cos - scy * sin;
    const ry = scx * sin + scy * cos;
    // 4. Translation
    return [Math.round((rx + posX) * 100) / 100, Math.round((ry + posY) * 100) / 100];
  });

  return {
    regions: [stageRegion],
    inverted: false,
  };
}

/**
 * Performs a boolean operation between two SceneNodes and generates a combined 'polygon' SceneNodeData.
 */
export function combineSceneNodes(
  nodeA: SceneNodeData,
  nodeB: SceneNodeData,
  operation: BooleanOpType
): SceneNodeData | null {
  const polyA = extractNodePolygon(nodeA);
  const polyB = extractNodePolygon(nodeB);

  let result: PolyBoolPolygon;
  switch (operation) {
    case 'union':
      result = PolyBool.union(polyA, polyB);
      break;
    case 'intersect':
      result = PolyBool.intersect(polyA, polyB);
      break;
    case 'difference':
      result = PolyBool.difference(polyA, polyB);
      break;
  }

  if (!result || !result.regions || result.regions.length === 0) {
    return null;
  }

  const primaryRegion = result.regions[0];
  if (!primaryRegion || primaryRegion.length < 3) return null;

  // Calculate geometric centroid/bounding center
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of primaryRegion) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const centerX = Math.round((minX + maxX) / 2);
  const centerY = Math.round((minY + maxY) / 2);

  // Store polygon coordinates relative to node's center (X, Y)
  const relativePoints: number[] = [];
  for (const [x, y] of primaryRegion) {
    relativePoints.push(Math.round((x - centerX) * 10) / 10);
    relativePoints.push(Math.round((y - centerY) * 10) / 10);
  }

  const newUid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;

  return {
    uid: newUid,
    name: `${operation}-${nodeA.name || 'shape'}`,
    type: 'polygon',
    visible: true,
    zIndex: Math.max(nodeA.zIndex ?? 0, nodeB.zIndex ?? 0),
    layer: nodeA.layer ?? 1,
    subLane: nodeA.subLane,
    transform: {
      x: centerX,
      y: centerY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: nodeA.transform?.opacity ?? 1,
    },
    properties: {
      points: relativePoints,
      color: nodeA.properties?.color || '#00e5ff',
      strokeColor: '#ffffff',
      strokeWidth: 0,
      closed: true,
    },
  };
}
