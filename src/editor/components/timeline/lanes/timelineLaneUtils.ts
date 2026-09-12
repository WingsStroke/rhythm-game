import type { TriggerActionType } from '../../../../engine/types';

export type EditorTool = 'select' | 'lasso' | 'pen' | 'eraser' | 'object' | 'shader';

export const SUB_LANE_COUNT = 8;

export function getTriggerColor(action: TriggerActionType): string {
  switch (action) {
    case 'pos':
      return '#00e5ff';
    case 'rot':
      return '#ff007f';
    case 'scale':
      return '#00ff9d';
    case 'skew':
      return '#38bdf8';
    case 'color':
      return '#b388ff';
    case 'pulse':
      return '#ffea00';
    default:
      return '#ffffff';
  }
}
