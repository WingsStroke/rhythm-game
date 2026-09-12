import React from 'react';
import { Zap } from 'lucide-react';
import type { TriggerData } from '../../../../engine/types';
import type { EditorTool } from './timelineLaneUtils';
import { SUB_LANE_COUNT, getTriggerColor } from './timelineLaneUtils';

export interface TriggersLaneProps {
  triggers: TriggerData[];
  totalTriggersCount?: number;
  activeLayer?: number;
  widthPx: number;
  activeTool: EditorTool;
  effectiveTriggerIds: Set<string>;
  songOrigin: number;
  pixelsPerSecond: number;
  subLaneHeight: number;
  onTriggerTrackClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTriggerMove: (e: React.PointerEvent, trigger: TriggerData) => void;
  onTriggerResize: (e: React.PointerEvent, trigger: TriggerData) => void;
}

export const TriggersLane = React.memo(function TriggersLane({
  triggers,
  activeLayer = 1,
  widthPx,
  activeTool,
  effectiveTriggerIds,
  songOrigin,
  pixelsPerSecond,
  subLaneHeight,
  onTriggerTrackClick,
  onTriggerMove,
  onTriggerResize,
}: TriggersLaneProps) {
  const totalLaneHeight = SUB_LANE_COUNT * subLaneHeight;
  const cardHeight = Math.min(52, Math.max(38, subLaneHeight - 16));
  const cardOffset = (subLaneHeight - cardHeight) / 2;

  return (
    <div
      className={`flex-1 bg-violet-950/[0.08] border-b border-violet-500/20 relative z-10 transition-colors flex-shrink-0 ${
        activeTool === 'pen' ? 'hover:bg-violet-950/[0.14] cursor-crosshair' : ''
      }`}
      style={{
        width: widthPx,
        minWidth: widthPx,
        minHeight: `${totalLaneHeight}px`,
        height: `${totalLaneHeight}px`,
      }}
      onClick={onTriggerTrackClick}
    >
      {/* 8 Sub-track horizontal dividers and visual guides */}
      <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
        {Array.from({ length: SUB_LANE_COUNT }, (_, lane) => (
          <div
            key={lane}
            style={{ height: `${subLaneHeight}px` }}
            className={`border-b border-violet-500/15 ${
              lane % 2 === 1 ? 'bg-violet-950/[0.04]' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {triggers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="font-mono text-xs text-white/30 tracking-wide">
            No triggers on Layer {activeLayer}. Click with Pen (B) on any sub-track to place triggers.
          </span>
        </div>
      )}

      {triggers.map((trigger, index) => {
        const isSelected = effectiveTriggerIds.has(trigger.id);
        const x = (trigger.time + songOrigin) * pixelsPerSecond;
        const width = Math.max(36, (trigger.duration || 0) * pixelsPerSecond);
        const color = getTriggerColor(trigger.action);
        const laneIndex = Math.max(0, Math.min(SUB_LANE_COUNT - 1, trigger.subLane ?? (index % SUB_LANE_COUNT)));
        const topOffset = laneIndex * subLaneHeight + cardOffset;

        return (
          <div
            key={trigger.id}
            data-trigger-item="true"
            data-trigger-id={trigger.id}
            className={`absolute rounded-lg flex items-center z-20 cursor-grab active:cursor-grabbing transition-all overflow-hidden select-none ${
              isSelected
                ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                : 'hover:brightness-110'
            }`}
            style={{
              top: `${topOffset}px`,
              left: x,
              width,
              height: `${cardHeight}px`,
              backgroundColor: `${color}25`,
              border: `2px solid ${color}`,
            }}
            onPointerDown={(e) => onTriggerMove(e, trigger)}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center ml-2 flex-shrink-0 shadow pointer-events-none"
              style={{ backgroundColor: color }}
            >
              <Zap className="w-3.5 h-3.5 -rotate-45 text-black font-bold" />
            </div>
            <div className="flex flex-col px-2 overflow-hidden flex-1 select-none pointer-events-none min-w-0">
              <span className="text-[11px] font-mono font-bold uppercase truncate text-white">
                {trigger.action}
              </span>
              <span className="text-[10px] font-mono text-white/60 truncate">{trigger.targetId}</span>
            </div>
            {activeTool === 'select' && (trigger.duration ?? 0) > 0 && (
              <div
                data-trigger-item="true"
                className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/40 cursor-ew-resize flex items-center justify-center flex-shrink-0"
                onPointerDown={(e) => onTriggerResize(e, trigger)}
              >
                <div className="w-1 h-5 bg-white/70 rounded-full pointer-events-none" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
