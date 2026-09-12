export interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlignmentLine {
  type: 'vertical' | 'horizontal';
  stageCoord: number;
  screenCoord: number;
  minScreen: number;
  maxScreen: number;
}

export interface AlignmentResult {
  snapDeltaStageX: number;
  snapDeltaStageY: number;
  lines: AlignmentLine[];
}

/**
 * AlignmentGuideSystem calculates magnetic alignment snaps and guidelines
 * across visible scene objects in 2D space.
 */
export class AlignmentGuideSystem {
  /**
   * Calculates snapping offsets and visual guide lines against candidate reference boxes.
   *
   * @param movingBBox Current bounding box of the active selection in stage space.
   * @param referenceBoxes Bounding boxes of non-selected visible nodes in stage space.
   * @param scale Viewport scale factor.
   * @param offsetX Stage viewport screen offset X.
   * @param offsetY Stage viewport screen offset Y.
   * @param thresholdScreenPx Magnetic snap distance threshold in screen pixels.
   */
  public static calculateSnap(
    movingBBox: BoundingBox2D,
    referenceBoxes: BoundingBox2D[],
    scale: number,
    offsetX: number,
    offsetY: number,
    thresholdScreenPx = 8
  ): AlignmentResult {
    const s = scale || 1;
    const thresholdStage = thresholdScreenPx / s;
    let snapDeltaStageX = 0;
    let snapDeltaStageY = 0;
    let minDistanceX = thresholdStage;
    let minDistanceY = thresholdStage;
    const lines: AlignmentLine[] = [];

    const movingLeft = movingBBox.x;
    const movingCenterX = movingBBox.x + movingBBox.width / 2;
    const movingRight = movingBBox.x + movingBBox.width;

    const movingTop = movingBBox.y;
    const movingCenterY = movingBBox.y + movingBBox.height / 2;
    const movingBottom = movingBBox.y + movingBBox.height;

    // 1. Horizontal Snapping (X-axis alignment)
    let bestSnapX: { stageVal: number; delta: number; refBox: BoundingBox2D } | null = null;

    for (const ref of referenceBoxes) {
      const refLeft = ref.x;
      const refCenterX = ref.x + ref.width / 2;
      const refRight = ref.x + ref.width;

      const pairs = [
        { m: movingLeft, r: refLeft },
        { m: movingLeft, r: refRight },
        { m: movingCenterX, r: refCenterX },
        { m: movingRight, r: refLeft },
        { m: movingRight, r: refRight },
      ];

      for (const pair of pairs) {
        const dist = Math.abs(pair.r - pair.m);
        if (dist < minDistanceX) {
          minDistanceX = dist;
          bestSnapX = { stageVal: pair.r, delta: pair.r - pair.m, refBox: ref };
        }
      }
    }

    if (bestSnapX) {
      snapDeltaStageX = bestSnapX.delta;
      const screenX = bestSnapX.stageVal * s + offsetX;
      const y1 = Math.min(movingTop, bestSnapX.refBox.y) * s + offsetY - 20;
      const y2 = Math.max(movingBottom, bestSnapX.refBox.y + bestSnapX.refBox.height) * s + offsetY + 20;
      lines.push({
        type: 'vertical',
        stageCoord: bestSnapX.stageVal,
        screenCoord: screenX,
        minScreen: y1,
        maxScreen: y2,
      });
    }

    // 2. Vertical Snapping (Y-axis alignment)
    let bestSnapY: { stageVal: number; delta: number; refBox: BoundingBox2D } | null = null;

    for (const ref of referenceBoxes) {
      const refTop = ref.y;
      const refCenterY = ref.y + ref.height / 2;
      const refBottom = ref.y + ref.height;

      const pairs = [
        { m: movingTop, r: refTop },
        { m: movingTop, r: refBottom },
        { m: movingCenterY, r: refCenterY },
        { m: movingBottom, r: refTop },
        { m: movingBottom, r: refBottom },
      ];

      for (const pair of pairs) {
        const dist = Math.abs(pair.r - pair.m);
        if (dist < minDistanceY) {
          minDistanceY = dist;
          bestSnapY = { stageVal: pair.r, delta: pair.r - pair.m, refBox: ref };
        }
      }
    }

    if (bestSnapY) {
      snapDeltaStageY = bestSnapY.delta;
      const screenY = bestSnapY.stageVal * s + offsetY;
      const x1 = Math.min(movingLeft, bestSnapY.refBox.x) * s + offsetX - 20;
      const x2 = Math.max(movingRight, bestSnapY.refBox.x + bestSnapY.refBox.width) * s + offsetX + 20;
      lines.push({
        type: 'horizontal',
        stageCoord: bestSnapY.stageVal,
        screenCoord: screenY,
        minScreen: x1,
        maxScreen: x2,
      });
    }

    return {
      snapDeltaStageX,
      snapDeltaStageY,
      lines,
    };
  }
}
