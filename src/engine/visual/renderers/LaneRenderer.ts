import { Graphics } from 'pixi.js';
import type { PadConfig, PadId } from '../../types';

export interface LaneRenderOptions {
  laneGfx: Graphics;
  pads: PadConfig[];
  padXPositions: Map<PadId, number>;
  padY: number;
  padHeight: number;
  screenHeight: number;
  hexToInt: (hex: string) => number;
}

export class LaneRenderer {
  /**
   * Draws the black translucent lane background and vibrant neon separator lines.
   */
  public static drawLanes({
    laneGfx,
    pads,
    padXPositions,
    padY,
    padHeight,
    screenHeight,
    hexToInt,
  }: LaneRenderOptions): void {
    laneGfx.clear();

    const laneBottom = Math.max(screenHeight, padY + padHeight + 40);
    const lanePadding = 4;
    const laneWidth = 100 + lanePadding * 2;

    for (const pad of pads) {
      const x = padXPositions.get(pad.id);
      if (x === undefined) continue;
      const color = hexToInt(pad.color);
      const laneX = x - lanePadding;

      // 1. Black translucent lane column (covers entire lane background from top past the pads)
      laneGfx
        .rect(laneX, 0, laneWidth, laneBottom)
        .fill({ color: 0x000000, alpha: 0.35 });

      // 2. Neon separator lines on left and right borders of the lane
      // Soft neon glow pass
      laneGfx
        .moveTo(laneX, 0)
        .lineTo(laneX, laneBottom)
        .stroke({ color, width: 3, alpha: 0.20 });
      laneGfx
        .moveTo(laneX + laneWidth, 0)
        .lineTo(laneX + laneWidth, laneBottom)
        .stroke({ color, width: 3, alpha: 0.20 });

      // Crisp vibrant neon core line
      laneGfx
        .moveTo(laneX, 0)
        .lineTo(laneX, laneBottom)
        .stroke({ color, width: 1.5, alpha: 0.65 });
      laneGfx
        .moveTo(laneX + laneWidth, 0)
        .lineTo(laneX + laneWidth, laneBottom)
        .stroke({ color, width: 1.5, alpha: 0.65 });
    }
  }
}
