import React from 'react';
import type { SceneNodeData } from '../../../../engine/types';
import type { EditorTool } from './timelineLaneUtils';
import { SUB_LANE_COUNT } from './timelineLaneUtils';

export interface VisualObjectsLaneProps {
  nodes: SceneNodeData[];
  totalNodesCount?: number;
  activeLayer?: number;
  widthPx: number;
  activeTool: EditorTool;
  effectiveNodeIds: Set<string>;
  songOrigin: number;
  pixelsPerSecond: number;
  totalDuration: number;
  subLaneHeight: number;
  onSelectNode?: (node: SceneNodeData | null) => void;
  onToggleNodeSelection?: (id: string, multi: boolean) => void;
  onNodeMove?: (e: React.PointerEvent, node: SceneNodeData) => void;
  onNodeResize?: (e: React.PointerEvent, node: SceneNodeData) => void;
  onTrackClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRemoveNode?: (id: string) => void;
}

export const VisualObjectsLane = React.memo(function VisualObjectsLane({
  nodes,
  activeLayer = 1,
  widthPx,
  activeTool,
  effectiveNodeIds,
  songOrigin,
  pixelsPerSecond,
  totalDuration,
  subLaneHeight,
  onSelectNode,
  onToggleNodeSelection,
  onNodeMove,
  onNodeResize,
  onTrackClick,
  onRemoveNode,
}: VisualObjectsLaneProps) {
  const totalLaneHeight = SUB_LANE_COUNT * subLaneHeight;
  const cardHeight = Math.min(52, Math.max(38, subLaneHeight - 16));
  const cardOffset = (subLaneHeight - cardHeight) / 2;

  return (
    <div
      className={`flex-1 bg-emerald-950/[0.08] border-b border-emerald-500/20 relative z-10 transition-colors flex-shrink-0 ${
        activeTool === 'object' ? 'hover:bg-emerald-950/[0.14] cursor-crosshair' : ''
      }`}
      style={{
        width: widthPx,
        minWidth: widthPx,
        minHeight: `${totalLaneHeight}px`,
        height: `${totalLaneHeight}px`,
      }}
      onClick={onTrackClick}
    >
      {/* 8 Sub-track horizontal dividers and visual guides */}
      <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
        {Array.from({ length: SUB_LANE_COUNT }, (_, lane) => (
          <div
            key={lane}
            style={{ height: `${subLaneHeight}px` }}
            className={`border-b border-emerald-500/15 ${
              lane % 2 === 1 ? 'bg-emerald-950/[0.04]' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="font-mono text-xs text-white/30 tracking-wide">
            No visual objects on Layer {activeLayer}. Click with Object (O) on any sub-track to place elements.
          </span>
        </div>
      )}

      {nodes.map((node, index) => {
        const isSelected =
          effectiveNodeIds.has(node.uid) ||
          (Boolean(node.id) && effectiveNodeIds.has(String(node.id))) ||
          (Boolean(node.name) && effectiveNodeIds.has(node.name!));
        const zIndex = node.zIndex ?? 0;
        const isAbovePads = Boolean(node.abovePads);
        const isAboveLanes = Boolean(node.aboveLanes);
        const layerColor = isAbovePads ? '#c084fc' : (isAboveLanes ? '#00e5ff' : '#00ff9d');
        const hierarchyLabel = isAbovePads ? 'PADS' : (isAboveLanes ? 'LANES' : 'BASE');
        const zIndexVal = `z:${zIndex}`;

        const hasLifespan = Boolean(node.lifespan);
        const startTime = node.lifespan ? node.lifespan.startTime : 0;
        const duration = node.lifespan ? node.lifespan.duration : totalDuration;
        const x = (startTime + songOrigin) * pixelsPerSecond;
        const width = Math.max(54, duration * pixelsPerSecond);

        const laneIndex = Math.max(0, Math.min(SUB_LANE_COUNT - 1, node.subLane ?? (index % SUB_LANE_COUNT)));
        const topOffset = laneIndex * subLaneHeight + cardOffset;

        return (
          <div
            key={node.uid || node.id || node.name || index}
            data-node-item="true"
            data-node-id={node.uid}
            className={`absolute rounded-lg flex items-center z-20 cursor-pointer transition-all overflow-hidden select-none ${
              isSelected
                ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                : 'hover:brightness-125'
            } ${hasLifespan ? '' : 'border-dashed opacity-85'}`}
            style={{
              top: `${topOffset}px`,
              left: x,
              width,
              height: `${cardHeight}px`,
              backgroundColor: `${layerColor}1a`,
              border: `1.5px ${hasLifespan ? 'solid' : 'dashed'} ${layerColor}99`,
            }}
            onPointerDown={(e) => {
              if (activeTool === 'eraser') {
                e.stopPropagation();
                onRemoveNode?.(node.uid);
                return;
              }
              if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                onToggleNodeSelection?.(node.uid, true);
                return;
              }
              if (onNodeMove) {
                onNodeMove(e, node);
              } else {
                onSelectNode?.(node);
              }
            }}
          >
            {/* Fade-in visual ramp */}
            {hasLifespan && (node.lifespan?.fadeInMs ?? 0) > 0 && (
              <div
                className="absolute left-0 top-0 bottom-0 pointer-events-none rounded-l-md overflow-hidden bg-gradient-to-r from-white/25 to-transparent border-r border-white/20"
                style={{
                  width: Math.min(width * 0.45, ((node.lifespan!.fadeInMs! / 1000) * pixelsPerSecond)),
                }}
              />
            )}

            {/* Fade-out visual ramp */}
            {hasLifespan && (node.lifespan?.fadeOutMs ?? 0) > 0 && (
              <div
                className="absolute right-0 top-0 bottom-0 pointer-events-none rounded-r-md overflow-hidden bg-gradient-to-l from-white/25 to-transparent border-l border-white/20"
                style={{
                  width: Math.min(width * 0.45, ((node.lifespan!.fadeOutMs! / 1000) * pixelsPerSecond)),
                }}
              />
            )}

            {/* Layer Badge */}
            <div
              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ml-2 flex-shrink-0 uppercase pointer-events-none flex items-center gap-1"
              style={{
                backgroundColor: `${layerColor}30`,
                color: layerColor,
                border: `1px solid ${layerColor}60`,
              }}
            >
              <span>{hierarchyLabel}</span>
              <span className="opacity-75">{zIndexVal}</span>
            </div>

            {/* Object Details */}
            <div className="flex flex-col px-2 overflow-hidden flex-1 select-none pointer-events-none min-w-0">
              <span className="text-[11px] font-mono font-bold truncate text-white">
                {node.name || node.uid || 'SceneObject'}
              </span>
              <span className="text-[9px] font-mono text-white/60 truncate">
                {node.type} {hasLifespan ? `• ${(node.lifespan!.duration).toFixed(1)}s` : '• all time'}
              </span>
            </div>

            {/* Resize Handle — shown for all nodes in select mode; dashed for infinite nodes */}
            {activeTool === 'select' && onNodeResize && (
              <div
                data-node-item="true"
                className={`absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center flex-shrink-0 ${
                  hasLifespan
                    ? 'hover:bg-white/40 cursor-ew-resize'
                    : 'hover:bg-white/20 cursor-ew-resize opacity-50'
                }`}
                onPointerDown={(e) => onNodeResize(e, node)}
                title={hasLifespan ? 'Ajustar duración' : 'Asignar duración (nodo infinito)'}
              >
                <div className={`w-1 h-5 rounded-full pointer-events-none ${hasLifespan ? 'bg-white/70' : 'bg-white/40'}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
