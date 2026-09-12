import React from 'react';
import type { VisualEffect } from '../../../../engine/types';
import type { EditorTool } from './timelineLaneUtils';

export interface ShadersLaneProps {
  effects: VisualEffect[];
  widthPx: number;
  activeTool: EditorTool;
  selectedEffectIds: Set<string>;
  songOrigin: number;
  pixelsPerSecond: number;
  totalDuration: number;
  subLaneHeight: number;
  onSelectEffect?: (effect: VisualEffect | null) => void;
  onToggleEffectSelection?: (id: string, multi: boolean) => void;
  onEffectMove?: (e: React.PointerEvent, effect: VisualEffect) => void;
  onEffectResize?: (e: React.PointerEvent, effect: VisualEffect) => void;
  onTrackClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRemoveEffect?: (id: string) => void;
}

export const ShadersLane = React.memo(function ShadersLane({
  effects,
  widthPx,
  activeTool,
  selectedEffectIds,
  songOrigin,
  pixelsPerSecond,
  totalDuration,
  subLaneHeight,
  onSelectEffect,
  onToggleEffectSelection,
  onEffectMove,
  onEffectResize,
  onTrackClick,
  onRemoveEffect,
}: ShadersLaneProps) {
  const laneCount = 4;
  const totalLaneHeight = laneCount * subLaneHeight;
  const cardHeight = Math.min(52, Math.max(38, subLaneHeight - 16));
  const cardOffset = (subLaneHeight - cardHeight) / 2;

  return (
    <div
      className={`flex-1 bg-fuchsia-950/[0.08] border-b border-fuchsia-500/20 relative z-10 transition-colors flex-shrink-0 ${
        activeTool === 'shader' ? 'hover:bg-fuchsia-950/[0.14] cursor-crosshair' : ''
      }`}
      style={{
        width: widthPx,
        minWidth: widthPx,
        minHeight: `${totalLaneHeight}px`,
        height: `${totalLaneHeight}px`,
      }}
      onClick={onTrackClick}
    >
      {/* 4 Sub-track horizontal dividers */}
      <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
        {Array.from({ length: laneCount }, (_, lane) => (
          <div
            key={lane}
            style={{ height: `${subLaneHeight}px` }}
            className={`border-b border-fuchsia-500/15 ${
              lane % 2 === 1 ? 'bg-fuchsia-950/[0.04]' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {effects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="font-mono text-xs text-white/30 tracking-wide">
            No shader effects. Select Shader (S) tool to place effects along the timeline.
          </span>
        </div>
      )}

      {effects.map((effect, index) => {
        const isSelected = selectedEffectIds.has(effect.id);
        const hasTime = typeof effect.startTime === 'number';
        const startTime = hasTime ? effect.startTime! : 0;
        const duration = hasTime && effect.duration ? effect.duration : totalDuration;
        const x = (startTime + songOrigin) * pixelsPerSecond;
        const width = Math.max(64, duration * pixelsPerSecond);

        const laneIndex = Math.max(0, Math.min(laneCount - 1, effect.lane ?? (index % laneCount)));
        const topOffset = laneIndex * subLaneHeight + cardOffset;

        return (
          <div
            key={effect.id}
            data-shader-item="true"
            data-shader-id={effect.id}
            className={`absolute rounded-lg flex items-center z-20 cursor-pointer transition-all overflow-hidden select-none ${
              isSelected
                ? 'ring-2 ring-white shadow-[0_0_20px_rgba(232,121,249,0.9)]'
                : 'hover:brightness-125'
            } ${hasTime ? '' : 'border-dashed opacity-85'}`}
            style={{
              top: `${topOffset}px`,
              left: x,
              width,
              height: `${cardHeight}px`,
              backgroundColor: 'rgba(192, 132, 252, 0.18)',
              border: `1.5px ${hasTime ? 'solid' : 'dashed'} rgba(216, 180, 254, 0.6)`,
            }}
            onPointerDown={(e) => {
              if (onEffectMove) {
                onEffectMove(e, effect);
              } else {
                if (activeTool === 'eraser') {
                  e.stopPropagation();
                  onRemoveEffect?.(effect.id);
                  return;
                }
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                  e.stopPropagation();
                  onToggleEffectSelection?.(effect.id, true);
                  return;
                }
                onSelectEffect?.(effect);
              }
            }}
          >
            {/* Shader Type Badge */}
            <div className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ml-2 flex-shrink-0 uppercase pointer-events-none bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40">
              {effect.type}
            </div>

            {/* Scope / Target info */}
            <div className="flex flex-col px-2 overflow-hidden flex-1 select-none pointer-events-none min-w-0">
              <span className="text-[11px] font-mono font-bold truncate text-white">
                {effect.scope === 'global' ? 'Global Stage' : effect.scope === 'range' ? `z:[${effect.zIndexMin ?? 0}..${effect.zIndexMax ?? 100}]` : `Target: ${effect.targetNodeId || 'Object'}`}
              </span>
              <span className="text-[9px] font-mono text-white/60 truncate">
                {hasTime ? `${duration.toFixed(1)}s` : 'Always on'} • int: {effect.intensity ?? 1.0}
              </span>
            </div>

            {/* Resize Handle */}
            {hasTime && activeTool === 'select' && onEffectResize && (
              <div
                data-shader-item="true"
                className="absolute right-0 top-0 bottom-0 w-3 hover:bg-fuchsia-400/40 cursor-ew-resize flex items-center justify-center flex-shrink-0 z-30"
                onPointerDown={(e) => onEffectResize(e, effect)}
                title="Ajustar duración"
              >
                <div className="w-1 h-5 bg-fuchsia-200 rounded-full pointer-events-none" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
