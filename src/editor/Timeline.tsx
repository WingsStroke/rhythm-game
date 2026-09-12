import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { LevelData, PadId, PadConfig, PadEvent, PadBehavior, TriggerData, TriggerActionType, SceneNodeData, ScenePrimitiveType, VisualEffect } from '../engine/types';
import { PrimitiveRegistry } from '../engine/visual/objects/PrimitiveRegistry';
import { EffectRegistry } from '../engine/visual/effects/EffectRegistry';
import { SongRegistry } from '../engine/content/SongRegistry';
import { WaveformCanvas } from './components/WaveformCanvas';
import { Zap, Repeat, Volume2, VolumeX, Clock, Layers, Sparkles } from 'lucide-react';

import { getSnapInterval, snapTimeToGrid, hasEventCollision, type GridSubdivision } from './utils';
import {
  getSongOrigin,
  timelineTimeToSongTime,
  songTimeToTimelineTime,
  timelineXToSongTime,
  timelineXToTimelineTime,
} from '../engine/time/timeUtils';
import { loadUserKeybindings, getBoundKeyForPad, formatKeyCode } from '../engine/input/Keybindings';

export type { GridSubdivision };
export type EditorTool = 'select' | 'pen' | 'eraser' | 'object' | 'shader';
export const SUB_LANE_COUNT = 8;

function getTriggerColor(action: TriggerActionType): string {
  switch (action) {
    case 'transform': return '#00e5ff';
    case 'color': return '#ff007f';
    case 'pulse': return '#ffea00';
    default: return '#00ff9d';
  }
}

interface PlayheadProps {
  currentTime: number;
  pixelsPerSecond: number;
}

const Playhead = React.memo(function Playhead({ currentTime, pixelsPerSecond }: PlayheadProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
      style={{ left: currentTime * pixelsPerSecond }}
    >
      <div className="w-4 h-4 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#ff0000]" />
    </div>
  );
});

interface PadTracksLaneProps {
  pads: PadConfig[];
  eventsByPad: Map<string, PadEvent[]>;
  widthPx: number;
  activeTool: EditorTool;
  effectiveEventIds: Set<string>;
  songOrigin: number;
  pixelsPerSecond: number;
  beatDuration: number;
  onTrackClick: (e: React.MouseEvent, padId: PadId) => void;
  onEventMove: (e: React.PointerEvent, event: PadEvent) => void;
  onEventResize: (e: React.PointerEvent, event: PadEvent) => void;
}

const PadTracksLane = React.memo(function PadTracksLane({
  pads,
  eventsByPad,
  widthPx,
  activeTool,
  effectiveEventIds,
  songOrigin,
  pixelsPerSecond,
  beatDuration,
  onTrackClick,
  onEventMove,
  onEventResize,
}: PadTracksLaneProps) {
  return (
    <>
      {pads.map((pad) => {
        const trackEvents = eventsByPad.get(pad.id) || [];
        return (
          <div
            key={pad.id}
            className={`flex-1 min-h-[50px] bg-white/[0.025] border-y border-white/10 relative transition-colors ${
              activeTool === 'pen' ? 'hover:bg-white/[0.06] cursor-crosshair' : ''
            }`}
            style={{ width: widthPx, minWidth: widthPx }}
            onClick={(e) => onTrackClick(e, pad.id)}
          >
            {trackEvents.map((event) => {
              const isSelected = effectiveEventIds.has(event.id);
              const x = (event.targetTime + songOrigin) * pixelsPerSecond;
              const width = Math.max(16, (event.duration ?? beatDuration) * pixelsPerSecond);

              const isInsideLoop = trackEvents.some(
                (e) =>
                  e.id !== event.id &&
                  e.padId === event.padId &&
                  e.behavior === 'loop' &&
                  event.targetTime >= e.targetTime - 0.001 &&
                  event.targetTime <= e.targetTime + (e.duration || 0) + 0.001
              );

              if (event.behavior === 'tap') {
                return (
                  <div
                    key={event.id}
                    data-event-item="true"
                    data-event-id={event.id}
                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-12 rounded-lg transition-all z-20 cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'ring-2 ring-white scale-105 shadow-[0_0_20px_#ffffff]'
                        : 'hover:brightness-125 hover:scale-102'
                    }`}
                    style={{
                      left: Math.max(0, x - 10),
                      backgroundColor: pad.color,
                      boxShadow: `0 0 14px ${pad.color}90`,
                    }}
                    onPointerDown={(e) => onEventMove(e, event)}
                    title={isInsideLoop ? 'Nota de bucle automático (decorativa / sin puntos)' : undefined}
                  >
                    <div className="w-full h-full border border-white/30 rounded-lg flex items-center justify-center relative">
                      {isInsideLoop && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00ff9d] border border-black shadow-[0_0_6px_#00ff9d]" />
                      )}
                      <div className="w-1.5 h-6 rounded-full bg-white/70" />
                    </div>
                  </div>
                );
              }
              if (event.behavior === 'hold') {
                return (
                  <div
                    key={event.id}
                    data-event-item="true"
                    data-event-id={event.id}
                    className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center border z-20 cursor-grab active:cursor-grabbing transition-all ${
                      isSelected
                        ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffffff]'
                        : 'border-white/30 hover:brightness-110'
                    }`}
                    style={{
                      left: x,
                      width,
                      backgroundColor: `${pad.color}40`,
                      borderLeft: `5px solid ${pad.color}`,
                    }}
                    onPointerDown={(e) => onEventMove(e, event)}
                  >
                    <span className="text-[11px] font-mono font-bold text-white/90 px-2 truncate flex-1 pointer-events-none">
                      HOLD ({(event.duration || 0).toFixed(2)}s)
                    </span>
                    {activeTool === 'select' && (
                      <div
                        data-event-item="true"
                        className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                        onPointerDown={(e) => onEventResize(e, event)}
                      >
                        <div className="w-1.5 h-6 bg-white/70 rounded-full pointer-events-none" />
                      </div>
                    )}
                  </div>
                );
              }
              if (event.behavior === 'loop') {
                return (
                  <div
                    key={event.id}
                    data-event-item="true"
                    data-event-id={event.id}
                    className={`absolute top-1 bottom-1 rounded-lg flex items-center border transition-all z-10 ${
                      activeTool === 'pen'
                        ? 'pointer-events-none'
                        : 'cursor-grab active:cursor-grabbing'
                    } overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-[#00ff9d] border-[#00ff9d] shadow-[0_0_22px_rgba(0,255,157,0.4)]'
                        : 'border-[#00ff9d]/50 hover:border-[#00ff9d]/80'
                    }`}
                    style={{
                      left: x,
                      width: Math.max(36, width),
                      backgroundColor: `${pad.color}15`,
                    }}
                    onPointerDown={(e) => onEventMove(e, event)}
                  >
                    {/* Start handle (Punto de Activación) */}
                    <div
                      className="h-full w-4 bg-[#00ff9d]/25 border-r border-[#00ff9d]/60 flex items-center justify-center flex-shrink-0"
                      title="Inicio de Bucle (Presionar para activar en gameplay)"
                    >
                      <div className="w-1.5 h-6 bg-[#00ff9d] rounded-full shadow-[0_0_8px_#00ff9d]" />
                    </div>

                    {/* Header badge */}
                    <div className="flex items-center gap-1.5 px-2 pointer-events-none select-none">
                      <Repeat className="w-3.5 h-3.5 text-[#00ff9d]" />
                      <span className="text-[10px] font-mono font-bold text-[#00ff9d] tracking-wider uppercase">
                        LOOP ({(event.duration || 0).toFixed(2)}s)
                      </span>
                    </div>

                    {/* Flexible space for inner notes */}
                    <div className="flex-1 h-full pointer-events-none" />

                    {/* End handle (Punto de Desactivación & Resize) */}
                    {activeTool === 'select' && (
                      <div
                        data-event-item="true"
                        className="w-5 h-full bg-[#ff0055]/20 hover:bg-[#ff0055]/40 border-l border-[#ff0055]/60 cursor-ew-resize flex items-center justify-center flex-shrink-0 transition-colors"
                        onPointerDown={(e) => onEventResize(e, event)}
                        title="Fin de Bucle (Presionar para desactivar en gameplay / Arrastrar para duración)"
                      >
                        <div className="w-2 h-2 bg-[#ff0055] rounded-xs shadow-[0_0_8px_#ff0055] pointer-events-none" />
                      </div>
                    )}
                  </div>
                );
              }
              if (event.behavior === 'trigger') {
                const hasAssignedTrigger = Boolean(event.triggerId);
                return (
                  <div
                    key={event.id}
                    data-event-item="true"
                    data-event-id={event.id}
                    className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center gap-1.5 px-2.5 border-2 z-20 cursor-grab active:cursor-grabbing transition-all ${
                      isSelected
                        ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffea00]'
                        : hasAssignedTrigger
                        ? 'border-yellow-400/80 bg-yellow-500/25 hover:scale-105'
                        : 'border-amber-500/90 bg-amber-600/30 hover:scale-105'
                    }`}
                    style={{ left: x }}
                    onPointerDown={(e) => onEventMove(e, event)}
                  >
                    <Zap
                      className={`w-3.5 h-3.5 -rotate-45 font-bold pointer-events-none ${
                        hasAssignedTrigger ? 'text-yellow-300' : 'text-amber-400'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-mono font-bold pointer-events-none ${
                        hasAssignedTrigger ? 'text-yellow-300' : 'text-amber-300'
                      }`}
                    >
                      {event.triggerId || 'UNASSIGNED'}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </>
  );
});

interface TriggersLaneProps {
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

const TriggersLane = React.memo(function TriggersLane({
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

interface VisualObjectsLaneProps {
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

const VisualObjectsLane = React.memo(function VisualObjectsLane({
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

interface ShadersLaneProps {
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

const ShadersLane = React.memo(function ShadersLane({
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

interface TimelineProps {
  level: LevelData;
  currentTime: number;
  isPlaying: boolean;
  activeTool: EditorTool;
  creationBehavior: PadBehavior;
  gridSubdivision: GridSubdivision;
  pixelsPerSecond: number;
  showWaveform?: boolean;
  timelineMode?: 'notes' | 'triggers' | 'visuals' | 'shaders';
  activeLayer?: number;
  onChangeActiveLayer?: (layer: number) => void;
  selectedPrimitiveType?: ScenePrimitiveType;
  selectedShaderType?: string;
  selectedEventId?: string | null;
  selectedEventIds?: Set<string>;
  selectedTriggerId?: string | null;
  selectedTriggerIds?: Set<string>;
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  selectedEffectId?: string | null;
  selectedEffectIds?: Set<string>;
  onSelectEvent: (event: PadEvent | null) => void;
  onSelectEvents?: (ids: Set<string>, additive?: boolean) => void;
  onSelectTrigger?: (trigger: TriggerData | null) => void;
  onSelectTriggers?: (ids: Set<string>, additive?: boolean) => void;
  onSelectNode?: (node: SceneNodeData | null) => void;
  onSelectNodes?: (ids: Set<string>, additive?: boolean) => void;
  onSelectEffect?: (effect: VisualEffect | null) => void;
  onSelectEffects?: (ids: Set<string>, additive?: boolean) => void;
  onToggleEventSelection?: (id: string, multi: boolean) => void;
  onToggleTriggerSelection?: (id: string, multi: boolean) => void;
  onToggleNodeSelection?: (id: string, multi: boolean) => void;
  onToggleEffectSelection?: (id: string, multi: boolean) => void;
  onSelectEventRange?: (targetId: string) => void;
  onSeek?: (time: number, isScrubbing?: boolean) => void;
  onAddEvent: (event: PadEvent) => void;
  onUpdateEvent: (event: PadEvent) => void;
  onUpdateEventsBatch?: (events: PadEvent[]) => void;
  onRemoveEvent: (id: string) => void;
  onAddTrigger?: (trigger: TriggerData) => void;
  onUpdateTrigger?: (trigger: TriggerData) => void;
  onUpdateTriggersBatch?: (triggers: TriggerData[]) => void;
  onRemoveTrigger?: (id: string) => void;
  onAddNode?: (node: SceneNodeData) => void;
  onUpdateNode?: (id: string, updates: Partial<SceneNodeData>) => void;
  onUpdateNodesBatch?: (nodes: SceneNodeData[]) => void;
  onRemoveNode?: (id: string) => void;
  onAddEffect?: (effect: VisualEffect) => void;
  onUpdateEffect?: (effect: VisualEffect) => void;
  onRemoveEffect?: (id: string) => void;
  onChangePixelsPerSecond?: (fnOrValue: number | ((prev: number) => number)) => void;
}

export function Timeline({
  level,
  currentTime,
  isPlaying,
  activeTool,
  creationBehavior,
  gridSubdivision,
  pixelsPerSecond,
  showWaveform = true,
  timelineMode = 'notes',
  activeLayer = 1,
  onChangeActiveLayer,
  selectedPrimitiveType = 'rectangle',
  selectedShaderType = 'bloom',
  selectedEventId,
  selectedEventIds,
  selectedTriggerId,
  selectedTriggerIds,
  selectedNodeId,
  selectedNodeIds,
  selectedEffectId,
  selectedEffectIds,
  onSelectEvent,
  onSelectEvents,
  onSelectTrigger,
  onSelectTriggers,
  onSelectNode,
  onSelectNodes,
  onSelectEffect,
  onSelectEffects,
  onToggleEventSelection,
  onToggleTriggerSelection,
  onToggleNodeSelection,
  onToggleEffectSelection,
  onSelectEventRange,
  onSeek,
  onAddEvent,
  onUpdateEvent,
  onUpdateEventsBatch,
  onRemoveEvent,
  onAddTrigger,
  onUpdateTrigger,
  onUpdateTriggersBatch,
  onRemoveTrigger,
  onAddNode,
  onUpdateNode,
  onUpdateNodesBatch,
  onRemoveNode,
  onAddEffect,
  onUpdateEffect,
  onRemoveEffect,
  onChangePixelsPerSecond,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerCanvasRef = useRef<HTMLDivElement>(null);
  const leftHeadersRef = useRef<HTMLDivElement>(null);
  const rulerTrackRef = useRef<HTMLDivElement>(null);
  const padTracksRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);
  const [padAreaHeight, setPadAreaHeight] = useState(280);
  const [timelineHeight, setTimelineHeight] = useState(600);

  const effectiveEventIds = useMemo(
    () => selectedEventIds ?? (selectedEventId ? new Set([selectedEventId]) : new Set<string>()),
    [selectedEventIds, selectedEventId]
  );

  const effectiveTriggerIds = useMemo(
    () => selectedTriggerIds ?? (selectedTriggerId ? new Set([selectedTriggerId]) : new Set<string>()),
    [selectedTriggerIds, selectedTriggerId]
  );

  const effectiveNodeIds = useMemo(
    () => selectedNodeIds ?? (selectedNodeId ? new Set([selectedNodeId]) : new Set<string>()),
    [selectedNodeIds, selectedNodeId]
  );

  const effectiveEffectIds = useMemo(
    () => selectedEffectIds ?? (selectedEffectId ? new Set([selectedEffectId]) : new Set<string>()),
    [selectedEffectIds, selectedEffectId]
  );

  useEffect(() => {
    const el = padTracksRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPadAreaHeight(Math.round(entry.contentRect.height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [timelineMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setTimelineHeight(el.clientHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setTimelineHeight(Math.round(entry.contentRect.height));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 36px is sticky ruler height (h-9). Calculate sub-lane height so all 8 tracks fill available height
  const availableLaneAreaHeight = Math.max(0, timelineHeight - 36);
  const subLaneHeight = Math.max(64, Math.floor(availableLaneAreaHeight / SUB_LANE_COUNT));

  const [dragState, setDragState] = useState<{
    targetType: 'event' | 'trigger' | 'batch_events' | 'batch_triggers' | 'node' | 'batch_nodes' | 'effect';
    mode: 'move' | 'resize';
    event?: PadEvent;
    trigger?: TriggerData;
    node?: SceneNodeData;
    effect?: VisualEffect;
    origEvents?: PadEvent[];
    origTriggers?: TriggerData[];
    origNodes?: SceneNodeData[];
    startX: number;
    startY: number;
    origTargetTime?: number;
    origDuration?: number;
    origSubLane?: number;
    origTriggerSubLanes?: Map<string, number>;
    origNodeSubLanes?: Map<string, number>;
    startScrollLeft?: number;
  } | null>(null);

  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isAdditive: boolean;
  } | null>(null);

  // Track previous pixelsPerSecond to smoothly preserve playhead position during any zoom change
  const prevPpsRef = useRef(pixelsPerSecond);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  useEffect(() => {
    const prevPps = prevPpsRef.current;
    prevPpsRef.current = pixelsPerSecond;

    if (prevPps === pixelsPerSecond) return;
    const container = containerRef.current;
    if (!container) return;

    // Center zoom pivot on the active playhead
    const playheadTime = currentTimeRef.current;
    const oldPlayheadPx = playheadTime * prevPps;
    const currentScroll = container.scrollLeft;
    const viewWidth = container.clientWidth;
    const playheadOffsetInView = oldPlayheadPx - currentScroll;

    let targetScroll: number;
    // If playhead was inside the visible viewport, preserve its exact relative screen position; otherwise center it
    if (playheadOffsetInView >= 0 && playheadOffsetInView <= viewWidth) {
      targetScroll = playheadTime * pixelsPerSecond - playheadOffsetInView;
    } else {
      targetScroll = playheadTime * pixelsPerSecond - viewWidth / 2;
    }

    container.scrollLeft = Math.max(0, targetScroll);
  }, [pixelsPerSecond]);

  // Native wheel listener for smooth horizontal zoom centered on playhead pivot
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onChangePixelsPerSecond) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 15 : -15;
        const newPixelsPerSecond = Math.max(40, Math.min(350, pixelsPerSecond + zoomDelta));
        if (newPixelsPerSecond === pixelsPerSecond) return;

        onChangePixelsPerSecond(newPixelsPerSecond);
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [pixelsPerSecond, onChangePixelsPerSecond]);

  const beatDuration = 60 / level.timing.bpm;
  const totalDuration = level.song.duration || 120;
  const offset = level.timing?.offset ?? 0;
  const leadIn = level.timing?.leadIn ?? 0;
  const songOrigin = getSongOrigin(leadIn, offset);
  const fadeIn = level.timing?.fadeIn ?? 0;
  const fadeOut = level.timing?.fadeOut ?? 0;
  const totalTimelineDuration = totalDuration + leadIn;
  const widthPx = Math.max(1200, totalTimelineDuration * pixelsPerSecond);

  const audioBuffer = useMemo(
    () => SongRegistry.getInstance().getActiveAudioBuffer(level.songId || level.song.id),
    [level.songId, level.song.id, level.song.duration]
  );

  const triggers = useMemo(() => level.visual?.triggers || [], [level.visual?.triggers]);
  const sceneNodes = useMemo(() => level.visual?.nodes || [], [level.visual?.nodes]);

  const visibleTriggers = useMemo(
    () => triggers.filter((t) => (t.layer ?? 1) === activeLayer),
    [triggers, activeLayer]
  );

  const visibleNodes = useMemo(
    () => sceneNodes.filter((n) => (n.layer ?? 1) === activeLayer),
    [sceneNodes, activeLayer]
  );

  const userKeybindings = useMemo(() => loadUserKeybindings(level.pads), [level.pads]);

  // Precompute events grouped by padId once in O(events) time, avoiding O(pads * events) per render
  const eventsByPad = useMemo(() => {
    const map = new Map<string, PadEvent[]>();
    for (const pad of level.pads) {
      map.set(pad.id, []);
    }
    for (const event of level.events) {
      const list = map.get(event.padId);
      if (list) {
        list.push(event);
      } else {
        map.set(event.padId, [event]);
      }
    }
    return map;
  }, [level.pads, level.events]);

  useEffect(() => {
    if (!isPlaying || !containerRef.current || isDraggingPlayhead.current) return;
    const container = containerRef.current;
    const playheadX = currentTime * pixelsPerSecond;
    const targetScroll = playheadX - container.clientWidth * 0.35;

    if (Math.abs(container.scrollLeft - targetScroll) > 5) {
      container.scrollLeft = Math.max(0, targetScroll);
    }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  const scrubPointerX = useRef<number | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const getAudioTimeFromClickX = useCallback(
    (clickX: number) => {
      const rawTime = timelineXToTimelineTime(clickX, pixelsPerSecond);
      if (rawTime < songOrigin) {
        if (gridSubdivision === 'free') {
          return rawTime;
        }
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const step = interval > 0 ? interval : beatDuration;
        const stepsBefore = Math.round((songOrigin - rawTime) / step);
        return Math.max(0, songOrigin - stepsBefore * step);
      }
      const rawSongTime = timelineTimeToSongTime(rawTime, leadIn, offset);
      const snappedSongTime = snapTimeToGrid(rawSongTime, level.timing.bpm, gridSubdivision);
      return songTimeToTimelineTime(snappedSongTime, leadIn, offset);
    },
    [pixelsPerSecond, songOrigin, leadIn, offset, gridSubdivision, level.timing.bpm, beatDuration]
  );

  const startAutoScroller = useCallback(() => {
    if (autoScrollRaf.current !== null) return;

    const tick = () => {
      if (!isDraggingPlayhead.current || !containerRef.current || scrubPointerX.current === null) {
        autoScrollRaf.current = null;
        return;
      }

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const x = scrubPointerX.current;
      const edgeThreshold = 60;

      let scrollDelta = 0;
      if (x > rect.right - edgeThreshold) {
        const factor = Math.min(1, (x - (rect.right - edgeThreshold)) / 80);
        scrollDelta = 6 + factor * 24;
      } else if (x < rect.left + edgeThreshold) {
        const factor = Math.min(1, ((rect.left + edgeThreshold) - x) / 80);
        scrollDelta = -(6 + factor * 24);
      }

      if (scrollDelta !== 0) {
        const prevScroll = container.scrollLeft;
        container.scrollLeft = Math.max(0, container.scrollLeft + scrollDelta);
        if (container.scrollLeft !== prevScroll && onSeek) {
          const clickX = Math.max(0, Math.min(widthPx, (x - rect.left) + container.scrollLeft));
          onSeek(getAudioTimeFromClickX(clickX), true);
        }
      }

      autoScrollRaf.current = requestAnimationFrame(tick);
    };

    autoScrollRaf.current = requestAnimationFrame(tick);
  }, [onSeek, getAudioTimeFromClickX, widthPx]);

  const stopAutoScroller = useCallback(() => {
    if (autoScrollRaf.current !== null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
    scrubPointerX.current = null;
  }, []);

  const handleRulerPointerDown = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container || !onSeek) return;
    isDraggingPlayhead.current = true;
    scrubPointerX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const containerRect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(widthPx, (e.clientX - containerRect.left) + container.scrollLeft));
    onSeek(getAudioTimeFromClickX(clickX), false);
    startAutoScroller();
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!isDraggingPlayhead.current || !container || !onSeek) return;
    scrubPointerX.current = e.clientX;
    const containerRect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(widthPx, (e.clientX - containerRect.left) + container.scrollLeft));
    onSeek(getAudioTimeFromClickX(clickX), true);
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (isDraggingPlayhead.current && onSeek && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(widthPx, (e.clientX - containerRect.left) + containerRef.current.scrollLeft));
      onSeek(getAudioTimeFromClickX(clickX), false);
    }
    isDraggingPlayhead.current = false;
    stopAutoScroller();
    // releasePointerCapture may throw if the element was already removed from the DOM; safe to ignore.
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
  };

  const handleTrackClick = useCallback((e: React.MouseEvent, padId: PadId) => {
    if (dragState) return;
    const eventItem = (e.target as HTMLElement).closest('[data-event-item]');
    if (eventItem) {
      const eventId = eventItem.getAttribute('data-event-id');
      const clickedEvent = level.events.find((ev) => ev.id === eventId);
      if (!(clickedEvent?.behavior === 'loop' && creationBehavior !== 'loop')) {
        return;
      }
    }

    if (activeTool === 'pen') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const rawSongTime = timelineXToSongTime(clickX, pixelsPerSecond, leadIn, offset);
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), level.timing.bpm, gridSubdivision);

      const newEvent: PadEvent = {
        id: crypto.randomUUID(),
        padId,
        targetTime: snappedTime,
        behavior: creationBehavior,
        duration: creationBehavior === 'hold' ? beatDuration * 2 : creationBehavior === 'loop' ? beatDuration * 4 : undefined,
        triggerId: creationBehavior === 'trigger' ? (selectedTriggerId || undefined) : undefined,
      };

      if (creationBehavior === 'loop') {
        const isInsideAnotherLoop = level.events.some(
          (e) =>
            e.padId === padId &&
            e.behavior === 'loop' &&
            snappedTime >= e.targetTime &&
            snappedTime < e.targetTime + (e.duration || 0)
        );
        if (isInsideAnotherLoop) {
          return;
        }
      }

      if (hasEventCollision(newEvent, level.events)) {
        return;
      }

      onAddEvent(newEvent);
      onSelectEvent(newEvent);
      onSelectTrigger?.(null);
    }
  }, [dragState, activeTool, pixelsPerSecond, leadIn, offset, level.timing.bpm, gridSubdivision, creationBehavior, beatDuration, selectedTriggerId, onAddEvent, onSelectEvent, onSelectTrigger, level.events]);

  const handleTriggerTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-trigger-item]')) return;

    if (activeTool === 'pen') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const subLane = Math.max(0, Math.min(SUB_LANE_COUNT - 1, Math.floor(clickY / subLaneHeight)));
      const rawSongTime = timelineXToSongTime(clickX, pixelsPerSecond, leadIn, offset);
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), level.timing.bpm, gridSubdivision);

      const newTrigger: TriggerData = {
        id: `trig_${Math.floor(1000 + Math.random() * 9000)}`,
        time: snappedTime,
        action: 'transform',
        targetId: level.visual?.nodes?.[0]?.id || 'all',
        duration: beatDuration,
        easing: 'easeOutQuad',
        properties: { scaleX: 1.25, scaleY: 1.25 },
        layer: activeLayer,
        subLane,
      };
      onAddTrigger?.(newTrigger);
      onSelectTrigger?.(newTrigger);
      onSelectEvent(null);
      onSelectNode?.(null);
    }
  }, [dragState, activeTool, pixelsPerSecond, leadIn, offset, level.timing.bpm, gridSubdivision, beatDuration, level.visual?.nodes, activeLayer, subLaneHeight, onAddTrigger, onSelectTrigger, onSelectEvent, onSelectNode]);

  const handleVisualTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-node-item]')) return;

    if (activeTool === 'object') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const subLane = Math.max(0, Math.min(SUB_LANE_COUNT - 1, Math.floor(clickY / subLaneHeight)));
      const rawSongTime = timelineXToSongTime(clickX, pixelsPerSecond, leadIn, offset);
      const bpm = level.timing.bpm || 120;
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), bpm, gridSubdivision);

      const type = selectedPrimitiveType || 'rectangle';
      const nodes = level.visual?.nodes || [];
      let max = 0;
      const prefix = type.toLowerCase();
      for (const node of nodes) {
        const name = node.name || (typeof node.id === 'string' ? node.id : '');
        if (name.startsWith(`${prefix}-`)) {
          const num = parseInt(name.replace(`${prefix}-`, ''), 10);
          if (!Number.isNaN(num) && num > max) max = num;
        }
      }
      const counter = max + 1;
      const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;

      // Default temporal duration: 4 beats (1 measure), minimum 1.0s
      const beatSec = 60 / bpm;
      const defaultDuration = Math.max(1, Number((beatSec * 4).toFixed(3)));

      const defaultProps = PrimitiveRegistry.get(type)?.defaultProperties || {};

      const newNode: SceneNodeData = {
        uid,
        name: `${prefix}-${counter}`,
        targetId: null,
        id: null,
        type,
        layer: activeLayer,
        subLane,
        visible: true,
        lifespan: {
          startTime: snappedTime,
          duration: defaultDuration,
          fadeInMs: 200,
          fadeOutMs: 200,
        },
        transform: {
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: (type === 'pointLight' || type === 'beamLight') ? 1.0 : 0.9,
        },
        blendMode: (type === 'pointLight' || type === 'beamLight') ? 'add' : 'normal',
        zIndex: 0,
        properties: { ...defaultProps },
      };

      onAddNode?.(newNode);
      onSelectNode?.(newNode);
      onSelectEvent(null);
      onSelectTrigger?.(null);
    }
  }, [
    dragState,
    activeTool,
    pixelsPerSecond,
    leadIn,
    offset,
    level.timing.bpm,
    level.visual?.nodes,
    gridSubdivision,
    selectedPrimitiveType,
    activeLayer,
    subLaneHeight,
    onAddNode,
    onSelectNode,
    onSelectEvent,
    onSelectTrigger,
  ]);

  const handleShaderTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-shader-item]')) return;

    if (activeTool === 'shader') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const subLane = Math.max(0, Math.min(3, Math.floor(clickY / subLaneHeight)));
      const rawSongTime = timelineXToSongTime(clickX, pixelsPerSecond, leadIn, offset);
      const bpm = level.timing.bpm || 120;
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), bpm, gridSubdivision);

      const type = selectedShaderType || 'bloom';
      const beatSec = 60 / bpm;
      const defaultDuration = Math.max(1, Number((beatSec * 4).toFixed(3)));

      const newEffect: VisualEffect = {
        id: `fx_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`,
        type,
        scope: 'global',
        enabled: true,
        intensity: 1.0,
        startTime: snappedTime,
        duration: defaultDuration,
        lane: subLane,
        parameters: { ...(EffectRegistry.get(type)?.defaultParameters ?? {}) },
      };

      onAddEffect?.(newEffect);
      onSelectEffect?.(newEffect);
      onSelectEvent(null);
      onSelectTrigger?.(null);
      onSelectNode?.(null);
    }
  }, [
    dragState,
    activeTool,
    pixelsPerSecond,
    leadIn,
    offset,
    level.timing.bpm,
    gridSubdivision,
    selectedShaderType,
    onAddEffect,
    onSelectEffect,
    onSelectEvent,
    onSelectTrigger,
    onSelectNode,
  ]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-item], [data-trigger-item], [data-node-item], [data-shader-item], [data-ruler]')) return;

    if (activeTool === 'select') {
      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!isAdditive) {
        onSelectEvent(null);
        onSelectTrigger?.(null);
        onSelectNode?.(null);
        onSelectEffect?.(null);
        onSelectEvents?.(new Set(), false);
        onSelectTriggers?.(new Set(), false);
        onSelectNodes?.(new Set(), false);
      }

      if (innerCanvasRef.current) {
        const canvasRect = innerCanvasRef.current.getBoundingClientRect();
        const startX = e.clientX - canvasRect.left;
        const startY = e.clientY - canvasRect.top;
        setMarquee({
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          isAdditive,
        });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
  }, [activeTool, onSelectEvent, onSelectTrigger, onSelectNode, onSelectEffect, onSelectEvents, onSelectTriggers, onSelectNodes]);

  const startEventMove = useCallback((e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onRemoveEvent(event.id);
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isShift && onSelectEventRange) {
      onSelectEventRange(event.id);
      return;
    }

    if (isCtrlOrMeta) {
      onToggleEventSelection?.(event.id, true);
      return;
    }

    const isAlreadySelected = effectiveEventIds.has(event.id);
    if (!isAlreadySelected) {
      onSelectEvent(event);
      onSelectTrigger?.(null);
      onSelectNode?.(null);
    }

    if (activeTool === 'select') {
      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      if (isAlreadySelected && effectiveEventIds.size > 1) {
        const selectedEventsList = level.events.filter((ev) => effectiveEventIds.has(ev.id));
        setDragState({
          targetType: 'batch_events',
          mode: 'move',
          event,
          origEvents: selectedEventsList,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: event.targetTime,
        });
      } else {
        setDragState({
          targetType: 'event',
          mode: 'move',
          event,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: event.targetTime,
          origDuration: event.duration || beatDuration,
        });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveEvent, onSelectEventRange, onToggleEventSelection, effectiveEventIds, onSelectEvent, onSelectTrigger, onSelectNode, level.events, beatDuration]);

  const startEventResize = useCallback((e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectEvent(event);
    onSelectTrigger?.(null);
    onSelectNode?.(null);
    setDragState({
      targetType: 'event',
      mode: 'resize',
      event,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      origTargetTime: event.targetTime,
      origDuration: event.duration || beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectEvent, onSelectTrigger, onSelectNode, beatDuration]);

  const startTriggerMove = useCallback((e: React.PointerEvent, trigger: TriggerData) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onRemoveTrigger?.(trigger.id);
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (isCtrlOrMeta) {
      onToggleTriggerSelection?.(trigger.id, true);
      return;
    }

    const isAlreadySelected = effectiveTriggerIds.has(trigger.id);
    if (!isAlreadySelected) {
      onSelectTrigger?.(trigger);
      onSelectEvent(null);
      onSelectNode?.(null);
    }

    if (activeTool === 'select') {
      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      if (isAlreadySelected && effectiveTriggerIds.size > 1) {
        const selectedTriggersList = triggers.filter((tr) => effectiveTriggerIds.has(tr.id));
        const triggerSubLanes = new Map<string, number>();
        selectedTriggersList.forEach((tr, i) => triggerSubLanes.set(tr.id, tr.subLane ?? (i % SUB_LANE_COUNT)));
        setDragState({
          targetType: 'batch_triggers',
          mode: 'move',
          trigger,
          origTriggers: selectedTriggersList,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: trigger.time,
          origSubLane: trigger.subLane ?? 0,
          origTriggerSubLanes: triggerSubLanes,
        });
      } else {
        setDragState({
          targetType: 'trigger',
          mode: 'move',
          trigger,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: trigger.time,
          origDuration: trigger.duration || beatDuration,
          origSubLane: trigger.subLane ?? 0,
        });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveTrigger, onToggleTriggerSelection, effectiveTriggerIds, onSelectTrigger, onSelectEvent, onSelectNode, triggers, beatDuration]);

  const startTriggerResize = useCallback((e: React.PointerEvent, trigger: TriggerData) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectTrigger?.(trigger);
    onSelectEvent(null);
    onSelectNode?.(null);
    setDragState({
      targetType: 'trigger',
      mode: 'resize',
      trigger,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      origTargetTime: trigger.time,
      origDuration: trigger.duration || beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectTrigger, onSelectEvent, onSelectNode, beatDuration]);

  const startNodeMove = useCallback((e: React.PointerEvent, node: SceneNodeData) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onRemoveNode?.(node.uid);
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (isCtrlOrMeta) {
      onToggleNodeSelection?.(node.uid, true);
      return;
    }

    const isAlreadySelected =
      effectiveNodeIds.has(node.uid) ||
      (Boolean(node.id) && effectiveNodeIds.has(String(node.id))) ||
      (Boolean(node.name) && effectiveNodeIds.has(node.name!));

    onSelectEvent(null);
    onSelectTrigger?.(null);
    if (!isAlreadySelected) {
      onSelectNode?.(node);
    }

    if (activeTool === 'select') {
      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      if (isAlreadySelected && effectiveNodeIds.size > 1) {
        const selectedNodesList = sceneNodes.filter(
          (n) =>
            effectiveNodeIds.has(n.uid) ||
            (Boolean(n.id) && effectiveNodeIds.has(String(n.id))) ||
            (Boolean(n.name) && effectiveNodeIds.has(n.name!))
        );
        const nodeSubLanes = new Map<string, number>();
        selectedNodesList.forEach((n, i) => nodeSubLanes.set(n.uid, n.subLane ?? (i % SUB_LANE_COUNT)));
        setDragState({
          targetType: 'batch_nodes',
          mode: 'move',
          node,
          origNodes: selectedNodesList,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: node.lifespan?.startTime ?? 0,
          origSubLane: node.subLane ?? 0,
          origNodeSubLanes: nodeSubLanes,
        });
      } else {
        setDragState({
          targetType: 'node',
          mode: 'move',
          node,
          startX: e.clientX,
          startY: e.clientY,
          startScrollLeft: scrollLeft,
          origTargetTime: node.lifespan?.startTime ?? 0,
          origDuration: node.lifespan?.duration ?? (level.song.duration || 120),
          origSubLane: node.subLane ?? 0,
        });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveNode, onToggleNodeSelection, effectiveNodeIds, onSelectNode, onSelectEvent, onSelectTrigger, sceneNodes, level.song.duration]);

  const startNodeResize = useCallback((e: React.PointerEvent, node: SceneNodeData) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectNode?.(node);
    onSelectEvent(null);
    onSelectTrigger?.(null);

    // For nodes without lifespan, synthesize a starting lifespan at time=0 so
    // the drag immediately converts them into a timed node. The origDuration is
    // set to the full song duration so the resize feel starts from the right edge.
    const existingStart = node.lifespan?.startTime ?? 0;
    const existingDuration = node.lifespan?.duration ?? (level.song.duration || 120);

    setDragState({
      targetType: 'node',
      mode: 'resize',
      node,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      origTargetTime: existingStart,
      origDuration: existingDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectNode, onSelectEvent, onSelectTrigger]);

  const startEffectMove = useCallback((e: React.PointerEvent, effect: VisualEffect) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      onRemoveEffect?.(effect.id);
      return;
    }
    const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
    if (isMulti) {
      onToggleEffectSelection?.(effect.id, true);
      return;
    }
    onSelectEffect?.(effect);
    onSelectEvent(null);
    onSelectTrigger?.(null);
    onSelectNode?.(null);

    if (activeTool === 'select') {
      setDragState({
        targetType: 'effect',
        mode: 'move',
        effect,
        startX: e.clientX,
        startY: e.clientY,
        startScrollLeft: containerRef.current?.scrollLeft ?? 0,
        origTargetTime: effect.startTime ?? 0,
        origDuration: effect.duration ?? 2.0,
        origSubLane: effect.lane ?? 0,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveEffect, onToggleEffectSelection, onSelectEffect, onSelectEvent, onSelectTrigger, onSelectNode]);

  const startEffectResize = useCallback((e: React.PointerEvent, effect: VisualEffect) => {
    e.stopPropagation();
    const hasTime = typeof effect.startTime === 'number';
    if (activeTool !== 'select' || !hasTime) return;
    onSelectEffect?.(effect);
    onSelectEvent(null);
    onSelectTrigger?.(null);
    onSelectNode?.(null);

    setDragState({
      targetType: 'effect',
      mode: 'resize',
      effect,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      origTargetTime: effect.startTime ?? 0,
      origDuration: effect.duration ?? 2.0,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectEffect, onSelectEvent, onSelectTrigger, onSelectNode]);

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const dragPointerX = useRef<number | null>(null);
  const dragPointerY = useRef<number | null>(null);
  const dragAutoScrollRaf = useRef<number | null>(null);
  const dragRaf = useRef<number | null>(null);
  const lastDragUpdateKey = useRef<string>('');

  const performDragUpdate = useCallback((clientX: number, clientY: number) => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag) return;

    const currentScrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollOffset = currentScrollLeft - (currentDrag.startScrollLeft ?? 0);
    const deltaX = (clientX - currentDrag.startX) + scrollOffset;
    const deltaTime = deltaX / pixelsPerSecond;
    const deltaY = clientY - currentDrag.startY;
    const subLaneDelta = Math.round(deltaY / subLaneHeight);

    if (currentDrag.targetType === 'event' && currentDrag.event) {
      const otherEvents = level.events.filter((ev) => ev.id !== currentDrag.event!.id);
      if (currentDrag.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
        const updateKey = `evt_move_${currentDrag.event.id}_${snapped}`;
        if (updateKey !== lastDragUpdateKey.current) {
          const candidate = { ...currentDrag.event, targetTime: snapped };
          if (!hasEventCollision(candidate, otherEvents)) {
            lastDragUpdateKey.current = updateKey;
            onUpdateEvent(candidate);
          }
        }
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        let snapped = interval > 0
          ? Math.max(interval, Math.round(Math.max(0.05, currentDrag.origDuration! + deltaTime) / interval) * interval)
          : Math.max(0.05, currentDrag.origDuration! + deltaTime);

        // Magnetic snap: clamp to avoid overlapping next note on the same pad
        const nextEventOnPad = otherEvents
          .filter((ev) => ev.padId === currentDrag.event!.padId && ev.targetTime >= currentDrag.event!.targetTime)
          .sort((a, b) => a.targetTime - b.targetTime)[0];
        if (nextEventOnPad) {
          const maxDuration = Math.max(interval > 0 ? interval : 0.05, nextEventOnPad.targetTime - currentDrag.event!.targetTime);
          snapped = Math.min(snapped, maxDuration);
        }

        const updateKey = `evt_res_${currentDrag.event.id}_${snapped}`;
        if (updateKey !== lastDragUpdateKey.current) {
          const candidate = { ...currentDrag.event, duration: snapped };
          if (!hasEventCollision(candidate, otherEvents)) {
            lastDragUpdateKey.current = updateKey;
            onUpdateEvent(candidate);
          }
        }
      }
    } else if (currentDrag.targetType === 'batch_events' && currentDrag.origEvents && currentDrag.event) {
      const snappedPivot = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
      const deltaSnap = snappedPivot - currentDrag.origTargetTime!;
      const minTime = Math.min(...currentDrag.origEvents.map((ev) => ev.targetTime));
      const validDelta = (minTime + deltaSnap < 0) ? -minTime : deltaSnap;
      const updateKey = `batch_evt_${validDelta}`;
      if (updateKey !== lastDragUpdateKey.current) {
        const draggedIds = new Set(currentDrag.origEvents.map((ev) => ev.id));
        const otherEvents = level.events.filter((ev) => !draggedIds.has(ev.id));
        const updated = currentDrag.origEvents.map((ev) => ({
          ...ev,
          targetTime: Math.max(0, Number((ev.targetTime + validDelta).toFixed(4))),
        }));
        const hasAnyCollision = updated.some((ev) => hasEventCollision(ev, otherEvents));
        if (!hasAnyCollision) {
          lastDragUpdateKey.current = updateKey;
          onUpdateEventsBatch?.(updated);
        }
      }
    } else if (currentDrag.targetType === 'trigger' && currentDrag.trigger) {
      if (currentDrag.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
        const targetSubLane = Math.max(0, Math.min(SUB_LANE_COUNT - 1, (currentDrag.origSubLane ?? 0) + subLaneDelta));
        const updateKey = `trig_move_${currentDrag.trigger.id}_${snapped}_${targetSubLane}`;
        if (updateKey !== lastDragUpdateKey.current) {
          lastDragUpdateKey.current = updateKey;
          onUpdateTrigger?.({ ...currentDrag.trigger, time: snapped, subLane: targetSubLane });
        }
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0 ? Math.max(interval, Math.round(Math.max(0, currentDrag.origDuration! + deltaTime) / interval) * interval) : Math.max(0, currentDrag.origDuration! + deltaTime);
        const updateKey = `trig_res_${currentDrag.trigger.id}_${snapped}`;
        if (updateKey !== lastDragUpdateKey.current) {
          lastDragUpdateKey.current = updateKey;
          onUpdateTrigger?.({ ...currentDrag.trigger, duration: snapped });
        }
      }
    } else if (currentDrag.targetType === 'batch_triggers' && currentDrag.origTriggers && currentDrag.trigger) {
      const snappedPivot = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
      const deltaSnap = snappedPivot - currentDrag.origTargetTime!;
      const minTime = Math.min(...currentDrag.origTriggers.map((tr) => tr.time));
      const validDelta = (minTime + deltaSnap < 0) ? -minTime : deltaSnap;
      const currentLanes = currentDrag.origTriggers.map((tr) => currentDrag.origTriggerSubLanes?.get(tr.id) ?? (tr.subLane ?? 0));
      const minLane = Math.min(...currentLanes);
      const maxLane = Math.max(...currentLanes);
      const clampedLaneDelta = Math.max(-minLane, Math.min((SUB_LANE_COUNT - 1) - maxLane, subLaneDelta));
      const updateKey = `batch_trig_${validDelta}_${clampedLaneDelta}`;
      if (updateKey !== lastDragUpdateKey.current) {
        lastDragUpdateKey.current = updateKey;
        const updated = currentDrag.origTriggers.map((tr) => {
          const origLane = currentDrag.origTriggerSubLanes?.get(tr.id) ?? (tr.subLane ?? 0);
          return {
            ...tr,
            time: Math.max(0, Number((tr.time + validDelta).toFixed(4))),
            subLane: Math.max(0, Math.min(SUB_LANE_COUNT - 1, origLane + clampedLaneDelta)),
          };
        });
        onUpdateTriggersBatch?.(updated);
      }
    } else if (currentDrag.targetType === 'node' && currentDrag.node) {
      if (currentDrag.mode === 'move') {
        const targetSubLane = Math.max(0, Math.min(SUB_LANE_COUNT - 1, (currentDrag.origSubLane ?? 0) + subLaneDelta));
        if (currentDrag.node.lifespan) {
          const snapped = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
          const updateKey = `node_move_${currentDrag.node.uid}_${snapped}_${targetSubLane}`;
          if (updateKey !== lastDragUpdateKey.current) {
            lastDragUpdateKey.current = updateKey;
            onUpdateNode?.(currentDrag.node.uid, {
              subLane: targetSubLane,
              lifespan: {
                ...currentDrag.node.lifespan,
                startTime: snapped,
              },
            });
          }
        } else {
          // Object without temporal lifespan: moves vertically between lanes
          const updateKey = `node_move_${currentDrag.node.uid}_${targetSubLane}`;
          if (updateKey !== lastDragUpdateKey.current) {
            lastDragUpdateKey.current = updateKey;
            onUpdateNode?.(currentDrag.node.uid, {
              subLane: targetSubLane,
            });
          }
        }
      } else if (currentDrag.mode === 'resize' && currentDrag.node) {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0
          ? Math.max(interval, Math.round(Math.max(0.1, currentDrag.origDuration! + deltaTime) / interval) * interval)
          : Math.max(0.1, currentDrag.origDuration! + deltaTime);
        const updateKey = `node_res_${currentDrag.node.uid}_${snapped}`;
        if (updateKey !== lastDragUpdateKey.current) {
          lastDragUpdateKey.current = updateKey;
          const existingLifespan = currentDrag.node.lifespan;
          onUpdateNode?.(currentDrag.node.uid, {
            lifespan: {
              startTime: existingLifespan?.startTime ?? 0,
              duration: snapped,
              fadeInMs: existingLifespan?.fadeInMs,
              fadeOutMs: existingLifespan?.fadeOutMs,
            },
          });
        }
      }
    } else if (currentDrag.targetType === 'batch_nodes' && currentDrag.origNodes && currentDrag.node) {
      const snappedPivot = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
      const deltaSnap = snappedPivot - currentDrag.origTargetTime!;
      const minTime = Math.min(...currentDrag.origNodes.map((n) => n.lifespan?.startTime ?? 0));
      const validDelta = (minTime + deltaSnap < 0) ? -minTime : deltaSnap;
      const currentLanes = currentDrag.origNodes.map((n) => currentDrag.origNodeSubLanes?.get(n.uid) ?? (n.subLane ?? 0));
      const minLane = Math.min(...currentLanes);
      const maxLane = Math.max(...currentLanes);
      const clampedLaneDelta = Math.max(-minLane, Math.min((SUB_LANE_COUNT - 1) - maxLane, subLaneDelta));
      const updateKey = `batch_nodes_${validDelta}_${clampedLaneDelta}`;
      if (updateKey !== lastDragUpdateKey.current) {
        lastDragUpdateKey.current = updateKey;
        const updatedNodes = currentDrag.origNodes.map((n) => {
          const origLane = currentDrag.origNodeSubLanes?.get(n.uid) ?? (n.subLane ?? 0);
          const origTime = n.lifespan?.startTime ?? 0;
          return {
            ...n,
            subLane: Math.max(0, Math.min(SUB_LANE_COUNT - 1, origLane + clampedLaneDelta)),
            lifespan: n.lifespan
              ? {
                  ...n.lifespan,
                  startTime: Math.max(0, Number((origTime + validDelta).toFixed(4))),
                }
              : undefined,
          };
        });
        onUpdateNodesBatch?.(updatedNodes);
      }
    } else if (currentDrag.targetType === 'effect' && currentDrag.effect) {
      if (currentDrag.mode === 'move') {
        const targetSubLane = Math.max(0, Math.min(3, (currentDrag.origSubLane ?? 0) + subLaneDelta));
        const hasTime = typeof currentDrag.effect.startTime === 'number';
        if (hasTime) {
          const snapped = snapTimeToGrid(Math.max(0, currentDrag.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
          const updateKey = `eff_move_${currentDrag.effect.id}_${snapped}_${targetSubLane}`;
          if (updateKey !== lastDragUpdateKey.current) {
            lastDragUpdateKey.current = updateKey;
            onUpdateEffect?.({ ...currentDrag.effect, startTime: snapped, lane: targetSubLane });
          }
        } else {
          const updateKey = `eff_move_${currentDrag.effect.id}_${targetSubLane}`;
          if (updateKey !== lastDragUpdateKey.current) {
            lastDragUpdateKey.current = updateKey;
            onUpdateEffect?.({ ...currentDrag.effect, lane: targetSubLane });
          }
        }
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0
          ? Math.max(interval, Math.round(Math.max(0.1, currentDrag.origDuration! + deltaTime) / interval) * interval)
          : Math.max(0.1, currentDrag.origDuration! + deltaTime);
        const updateKey = `eff_res_${currentDrag.effect.id}_${snapped}`;
        if (updateKey !== lastDragUpdateKey.current) {
          lastDragUpdateKey.current = updateKey;
          onUpdateEffect?.({ ...currentDrag.effect, duration: snapped });
        }
      }
    }
  }, [
    pixelsPerSecond,
    subLaneHeight,
    gridSubdivision,
    level.timing.bpm,
    onUpdateEvent,
    onUpdateEventsBatch,
    onUpdateTrigger,
    onUpdateTriggersBatch,
    onUpdateNode,
    onUpdateNodesBatch,
    onUpdateEffect,
  ]);

  const startDragAutoScroller = useCallback(() => {
    if (dragAutoScrollRaf.current !== null) return;

    const tick = () => {
      if (!dragStateRef.current || !containerRef.current || dragPointerX.current === null) {
        dragAutoScrollRaf.current = null;
        return;
      }

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const x = dragPointerX.current;
      const edgeThreshold = 60;

      let scrollDelta = 0;
      if (x > rect.right - edgeThreshold) {
        const factor = Math.min(1, (x - (rect.right - edgeThreshold)) / 80);
        scrollDelta = 8 + factor * 28;
      } else if (x < rect.left + edgeThreshold) {
        const factor = Math.min(1, ((rect.left + edgeThreshold) - x) / 80);
        scrollDelta = -(8 + factor * 28);
      }

      if (scrollDelta !== 0) {
        const prevScroll = container.scrollLeft;
        container.scrollLeft = Math.max(0, container.scrollLeft + scrollDelta);
        if (container.scrollLeft !== prevScroll && dragPointerY.current !== null) {
          performDragUpdate(x, dragPointerY.current);
        }
      }

      dragAutoScrollRaf.current = requestAnimationFrame(tick);
    };

    dragAutoScrollRaf.current = requestAnimationFrame(tick);
  }, [performDragUpdate]);

  const stopDragAutoScroller = useCallback(() => {
    if (dragAutoScrollRaf.current !== null) {
      cancelAnimationFrame(dragAutoScrollRaf.current);
      dragAutoScrollRaf.current = null;
    }
    dragPointerX.current = null;
    dragPointerY.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (dragAutoScrollRaf.current !== null) {
        cancelAnimationFrame(dragAutoScrollRaf.current);
      }
      if (dragRaf.current !== null) {
        cancelAnimationFrame(dragRaf.current);
      }
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (marquee && innerCanvasRef.current) {
      const canvasRect = innerCanvasRef.current.getBoundingClientRect();
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;
      setMarquee((prev) => (prev ? { ...prev, currentX, currentY } : null));

      const minX = Math.min(marquee.startX, currentX);
      const maxX = Math.max(marquee.startX, currentX);
      const minY = Math.min(marquee.startY, currentY);
      const maxY = Math.max(marquee.startY, currentY);

      const eventEls = innerCanvasRef.current.querySelectorAll<HTMLElement>('[data-event-id]');
      const hitEventIds = new Set<string>();
      eventEls.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elX1 = elRect.left - canvasRect.left;
        const elX2 = elRect.right - canvasRect.left;
        const elY1 = elRect.top - canvasRect.top;
        const elY2 = elRect.bottom - canvasRect.top;
        if (elX1 < maxX && elX2 > minX && elY1 < maxY && elY2 > minY) {
          const id = el.getAttribute('data-event-id');
          if (id) hitEventIds.add(id);
        }
      });

      const triggerEls = innerCanvasRef.current.querySelectorAll<HTMLElement>('[data-trigger-id]');
      const hitTriggerIds = new Set<string>();
      triggerEls.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elX1 = elRect.left - canvasRect.left;
        const elX2 = elRect.right - canvasRect.left;
        const elY1 = elRect.top - canvasRect.top;
        const elY2 = elRect.bottom - canvasRect.top;
        if (elX1 < maxX && elX2 > minX && elY1 < maxY && elY2 > minY) {
          const id = el.getAttribute('data-trigger-id');
          if (id) hitTriggerIds.add(id);
        }
      });

      const nodeEls = innerCanvasRef.current.querySelectorAll<HTMLElement>('[data-node-id]');
      const hitNodeIds = new Set<string>();
      nodeEls.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elX1 = elRect.left - canvasRect.left;
        const elX2 = elRect.right - canvasRect.left;
        const elY1 = elRect.top - canvasRect.top;
        const elY2 = elRect.bottom - canvasRect.top;
        if (elX1 < maxX && elX2 > minX && elY1 < maxY && elY2 > minY) {
          const id = el.getAttribute('data-node-id');
          if (id) hitNodeIds.add(id);
        }
      });

      const shaderEls = innerCanvasRef.current.querySelectorAll<HTMLElement>('[data-shader-id]');
      const hitShaderIds = new Set<string>();
      shaderEls.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const elX1 = elRect.left - canvasRect.left;
        const elX2 = elRect.right - canvasRect.left;
        const elY1 = elRect.top - canvasRect.top;
        const elY2 = elRect.bottom - canvasRect.top;
        if (elX1 < maxX && elX2 > minX && elY1 < maxY && elY2 > minY) {
          const id = el.getAttribute('data-shader-id');
          if (id) hitShaderIds.add(id);
        }
      });

      onSelectEvents?.(hitEventIds, marquee.isAdditive);
      onSelectTriggers?.(hitTriggerIds, marquee.isAdditive);
      onSelectNodes?.(hitNodeIds, marquee.isAdditive);
      onSelectEffects?.(hitShaderIds, marquee.isAdditive);
      return;
    }

    if (!dragState) return;
    dragPointerX.current = e.clientX;
    dragPointerY.current = e.clientY;
    startDragAutoScroller();

    if (!dragRaf.current) {
      dragRaf.current = requestAnimationFrame(() => {
        dragRaf.current = null;
        if (dragPointerX.current !== null && dragPointerY.current !== null) {
          performDragUpdate(dragPointerX.current, dragPointerY.current);
        }
      });
    }
  }, [
    marquee,
    dragState,
    startDragAutoScroller,
    performDragUpdate,
    onSelectEvents,
    onSelectTriggers,
    onSelectNodes,
    onSelectEffects,
  ]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRaf.current !== null) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
    stopDragAutoScroller();
    if (marquee) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
      setMarquee(null);
      return;
    }
    if (dragState) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
      performDragUpdate(e.clientX, e.clientY);
      lastDragUpdateKey.current = '';
      if (dragState.targetType === 'batch_events' && Math.abs(e.clientX - dragState.startX) < 3 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (dragState.event) {
          onSelectEvent(dragState.event);
          onSelectTrigger?.(null);
          onSelectNode?.(null);
        }
      } else if (dragState.targetType === 'batch_triggers' && Math.abs(e.clientX - dragState.startX) < 3 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (dragState.trigger) {
          onSelectTrigger?.(dragState.trigger);
          onSelectEvent(null);
          onSelectNode?.(null);
        }
      } else if (dragState.targetType === 'batch_nodes' && Math.abs(e.clientX - dragState.startX) < 3 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (dragState.node) {
          onSelectNode?.(dragState.node);
          onSelectEvent(null);
          onSelectTrigger?.(null);
        }
      } else if (dragState.targetType === 'node' && Math.abs(e.clientX - dragState.startX) < 3) {
        if (dragState.node) {
          onSelectNode?.(dragState.node);
          onSelectEvent(null);
          onSelectTrigger?.(null);
        }
      } else if (dragState.targetType === 'effect' && Math.abs(e.clientX - dragState.startX) < 3) {
        if (dragState.effect) {
          onSelectEffect?.(dragState.effect);
          onSelectEvent(null);
          onSelectTrigger?.(null);
          onSelectNode?.(null);
        }
      }
      setDragState(null);
    }
  };

  // Memoized Ruler Ticks that dynamically adapt to the active snap gridSubdivision, leadIn, and timing offset
  const rulerTicks = useMemo(() => {
    const ticks: React.ReactNode[] = [];
    const bpm = level.timing.bpm || 120;
    const interval = getSnapInterval(bpm, gridSubdivision);
    const step = interval > 0 ? interval : beatDuration;
    const barDuration = 4 * beatDuration;
    const currentOrigin = (level.timing?.leadIn ?? 0) + (level.timing?.offset ?? 0);
    const totalTimelineSec = (level.song.duration || 120) + (level.timing?.leadIn ?? 0);
    const currentLeadIn = level.timing?.leadIn ?? 0;

    // 0. Pre-roll start marker (if leadIn > 0)
    if (currentLeadIn > 0) {
      ticks.push(
        <div
          key="ruler-preroll-start"
          className="absolute top-0 bottom-0 border-l-2 border-amber-400/60 flex flex-col justify-between pl-1 pointer-events-none"
          style={{ left: 0 }}
        >
          <span className="font-mono text-[9px] text-amber-300 font-bold">0.0s</span>
          <span className="text-[8px] text-amber-400/80 font-mono mb-0.5">pre-roll</span>
        </div>
      );
    }

    // Audio start marker (at leadIn)
    ticks.push(
      <div
        key="ruler-audio-start"
        className={`absolute top-0 bottom-0 ${
          currentLeadIn > 0 ? 'border-l-2 border-amber-400' : 'border-l border-white/20'
        } flex flex-col justify-between pl-1 pointer-events-none`}
        style={{ left: currentLeadIn * pixelsPerSecond }}
      >
        <span className={`font-mono text-[9px] ${currentLeadIn > 0 ? 'text-amber-300 font-bold' : 'text-white/40'}`}>
          {currentLeadIn > 0 ? `${currentLeadIn.toFixed(2)}s` : '0.0s'}
        </span>
        <span className={`text-[8px] ${currentLeadIn > 0 ? 'text-amber-400/80 font-bold' : 'text-white/25'} font-mono mb-0.5`}>
          audio start
        </span>
      </div>
    );

    // 1. Measure / Bar Markers (m.1, m.2, ...) starting from currentOrigin
    const maxBar = Math.floor((totalTimelineSec - currentOrigin) / barDuration);
    for (let barIdx = 0; barIdx <= maxBar; barIdx++) {
      const barTime = currentOrigin + barIdx * barDuration;
      ticks.push(
        <div
          key={`ruler-bar-${barIdx}`}
          className="absolute top-0 bottom-0 border-l-2 border-[#00e5ff]/50 flex flex-col justify-between pl-1 pointer-events-none"
          style={{ left: barTime * pixelsPerSecond }}
        >
          <span className="font-mono text-[10px] font-bold text-[#00e5ff]">m.{barIdx + 1}</span>
          <span className="text-[9px] text-white/40 font-mono mb-0.5">{barTime.toFixed(2)}s</span>
        </div>
      );
    }

    // 2. Intermediate Snap Ticks in Ruler (skipping bar positions)
    const totalSteps = Math.floor((totalTimelineSec - currentOrigin) / step);
    const stepsPerBar = Math.round(barDuration / step);
    if (stepsPerBar > 1) {
      for (let i = 1; i <= totalSteps; i++) {
        if (i % stepsPerBar === 0) continue; // Skip bar markers already drawn
        const time = currentOrigin + i * step;
        ticks.push(
          <div
            key={`ruler-sub-${i}`}
            className="absolute bottom-0 h-2 border-l border-white/20 pointer-events-none"
            style={{ left: time * pixelsPerSecond }}
          />
        );
      }
    }

    // 3. Pre-origin intermediate ticks down to 0
    if (currentOrigin > 0) {
      const preSteps = Math.floor(currentOrigin / step);
      for (let k = 1; k <= preSteps; k++) {
        const time = currentOrigin - k * step;
        if (time <= 0) break;
        ticks.push(
          <div
            key={`ruler-sub-pre-${k}`}
            className="absolute bottom-0 h-1.5 border-l border-white/10 pointer-events-none"
            style={{ left: time * pixelsPerSecond }}
          />
        );
      }
    }

    return ticks;
  }, [level.song.duration, beatDuration, pixelsPerSecond, gridSubdivision, level.timing.bpm, level.timing?.offset, level.timing?.leadIn]);

  // Memoized Background Grid Lines that dynamically adapt directly to the selected snap, leadIn and offset
  // All lines have the exact same low, notable opacity (border-white/10) with zero harsh contrasting lines
  const backgroundGridLines = useMemo(() => {
    const bpm = level.timing.bpm || 120;
    const interval = getSnapInterval(bpm, gridSubdivision);
    const step = interval > 0 ? interval : beatDuration; // fallback to 1/4 beat in 'free' mode
    const currentOrigin = (level.timing?.leadIn ?? 0) + (level.timing?.offset ?? 0);
    const totalTimelineSec = (level.song.duration || 120) + (level.timing?.leadIn ?? 0);
    const lines: React.ReactNode[] = [];

    // Forward grid lines starting from currentOrigin
    const totalStepsForward = Math.ceil((totalTimelineSec - currentOrigin) / step);
    for (let i = 0; i <= totalStepsForward; i++) {
      const time = currentOrigin + i * step;
      if (time > totalTimelineSec) break;
      lines.push(
        <div
          key={`grid-snap-${i}`}
          className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none"
          style={{ left: time * pixelsPerSecond }}
        />
      );
    }

    // Pre-origin grid lines down to 0
    if (currentOrigin > 0) {
      const preSteps = Math.ceil(currentOrigin / step);
      for (let k = 1; k <= preSteps; k++) {
        const time = currentOrigin - k * step;
        if (time < 0) break;
        lines.push(
          <div
            key={`grid-snap-pre-${k}`}
            className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none"
            style={{ left: time * pixelsPerSecond }}
          />
        );
      }
    }

    return lines;
  }, [level.song.duration, beatDuration, pixelsPerSecond, gridSubdivision, level.timing.bpm, level.timing?.offset, level.timing?.leadIn]);

  return (
    <div className="flex-1 w-full h-full min-h-0 flex overflow-hidden relative select-none bg-[#09090f]">
      {/* 1. Dedicated Left Column: Track Headers (always visible, strictly left of timeline, synced vertical scroll) */}
      <div
        ref={leftHeadersRef}
        className="w-36 flex-shrink-0 flex flex-col bg-[#09090f] border-r border-white/10 select-none z-20 h-full min-h-0 overflow-hidden"
        onWheel={(e) => {
          if (containerRef.current) {
            containerRef.current.scrollTop += e.deltaY;
          }
        }}
      >
        <div className="min-h-full flex flex-col">
          {/* Sticky Header: TIME in notes mode, Layer [input] in triggers/visuals mode */}
          <div className="sticky top-0 z-30 h-9 border-b border-white/10 bg-black/95 flex items-center justify-between px-3 gap-2 shadow-md flex-shrink-0">
            {timelineMode === 'notes' && activeTool !== 'shader' ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00e5ff]" />
                <span className="font-mono text-xs font-bold text-white/80 tracking-wider">TIME</span>
              </div>
            ) : (timelineMode === 'shaders' || activeTool === 'shader') ? (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                <span className="font-mono text-xs font-bold text-fuchsia-300 tracking-wider">SHADERS</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className={`font-mono text-xs font-bold tracking-wider ${timelineMode === 'triggers' ? 'text-yellow-400' : 'text-[#00ff9d]'}`}>
                  Layer
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={activeLayer}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    onChangeActiveLayer?.(val);
                  }}
                  className={`w-12 bg-black/70 border rounded px-1.5 py-0.5 text-xs font-mono font-bold text-center outline-none transition-colors ${
                    timelineMode === 'triggers'
                      ? 'border-yellow-500/50 text-yellow-300 focus:border-yellow-400'
                      : 'border-emerald-500/50 text-emerald-300 focus:border-emerald-400'
                  }`}
                />
              </div>
            )}
            {leadIn > 0 && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/10 font-bold"
                title={`Pre-roll lead-in: ${leadIn}s`}
              >
                +{leadIn}s
              </span>
            )}
          </div>

          {/* Mode-Specific Left Track Labels */}
          {timelineMode === 'notes' && activeTool !== 'shader' && (
            <div className="flex-1 flex flex-col py-1.5 gap-1.5 min-h-[360px]">
              {level.pads.map((pad) => (
                <div
                  key={pad.id}
                  className="flex-1 min-h-[60px] flex flex-col justify-center px-3.5 bg-black/90 border-y border-white/10 shadow-sm transition-colors hover:bg-white/[0.04] group"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full shadow-md flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: pad.color, boxShadow: `0 0 10px ${pad.color}80` }}
                    />
                    <span className="text-sm font-mono font-bold text-white tracking-wide truncate">{pad.label}</span>
                    <span className="ml-auto text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-semibold border border-white/10">
                      {(() => {
                        const boundKey = getBoundKeyForPad(userKeybindings, pad.id);
                        return boundKey ? formatKeyCode(boundKey) : (pad.keyHint || '?');
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/40 font-mono">
                    <span className="uppercase tracking-wider">{pad.role || 'track'}</span>
                    {pad.audioChannel && (
                      <>
                        <span className="text-white/20">•</span>
                        <span className="text-[#00e5ff]/80 font-semibold">{pad.audioChannel}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {timelineMode === 'triggers' && activeTool !== 'shader' && (
            <div className="flex flex-col" style={{ minHeight: `${SUB_LANE_COUNT * subLaneHeight}px` }}>
              {Array.from({ length: SUB_LANE_COUNT }, (_, lane) => (
                <div
                  key={lane}
                  style={{ height: `${subLaneHeight}px` }}
                  className="flex flex-col justify-center px-3 bg-black/90 border-b border-violet-500/20 shadow-sm flex-shrink-0"
                >
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400/80" />
                    <span className="text-xs font-mono font-bold text-white/90 tracking-wide">
                      Track {lane + 1}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 font-mono mt-0.5">FX Sub-Lane</span>
                </div>
              ))}
            </div>
          )}

          {timelineMode === 'visuals' && activeTool !== 'shader' && (
            <div className="flex flex-col" style={{ minHeight: `${SUB_LANE_COUNT * subLaneHeight}px` }}>
              {Array.from({ length: SUB_LANE_COUNT }, (_, lane) => (
                <div
                  key={lane}
                  style={{ height: `${subLaneHeight}px` }}
                  className="flex flex-col justify-center px-3 bg-black/90 border-b border-emerald-500/20 shadow-sm flex-shrink-0"
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400/80" />
                    <span className="text-xs font-mono font-bold text-white/90 tracking-wide">
                      Track {lane + 1}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 font-mono mt-0.5">Visual Sub-Lane</span>
                </div>
              ))}
            </div>
          )}

          {(timelineMode === 'shaders' || activeTool === 'shader') && (
            <div className="flex flex-col" style={{ minHeight: `${4 * subLaneHeight}px` }}>
              {Array.from({ length: 4 }, (_, lane) => (
                <div
                  key={lane}
                  style={{ height: `${subLaneHeight}px` }}
                  className="flex flex-col justify-center px-3 bg-black/90 border-b border-fuchsia-500/20 shadow-sm flex-shrink-0"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-fuchsia-400/80" />
                    <span className="text-xs font-mono font-bold text-white/90 tracking-wide">
                      Shader Track {lane + 1}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 font-mono mt-0.5">Post-FX Lane</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Scrollable Timeline Canvas: Grid, Notes, Triggers, and Playhead */}
      <div
        ref={containerRef}
        className="flex-1 h-full min-h-0 overflow-auto relative cursor-default custom-scrollbar"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onScroll={(e) => {
          if (leftHeadersRef.current) {
            leftHeadersRef.current.scrollTop = e.currentTarget.scrollTop;
          }
        }}
      >
        <div
          ref={innerCanvasRef}
          style={{ width: widthPx }}
          className="min-h-full flex flex-col relative bg-[#09090f]"
          onPointerDown={handleCanvasPointerDown}
        >
          {/* Sticky Time Ruler */}
          <div
            data-ruler="true"
            className="sticky top-0 z-30 h-9 border-b border-white/10 bg-black/90 backdrop-blur-md flex flex-shrink-0"
          >
            <div
              ref={rulerTrackRef}
              data-ruler="true"
              className="relative flex-1 cursor-crosshair overflow-hidden"
              style={{ width: widthPx, minWidth: widthPx }}
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              onPointerCancel={handleRulerPointerUp}
              onLostPointerCapture={handleRulerPointerUp}
            >
              {rulerTicks}
            </div>
          </div>

          {/* Background Beat & Bar Grid Lines spanning full height */}
          <div className="absolute top-9 bottom-0 pointer-events-none z-0" style={{ left: 0, width: widthPx }}>
            {backgroundGridLines}
          </div>

          {/* 1. Note Track Lanes (Only rendered in 'notes' mode) */}
          {timelineMode === 'notes' && activeTool !== 'shader' && (
            <div
              ref={padTracksRef}
              className="flex-1 flex flex-col py-1.5 gap-1.5 min-h-[360px] relative z-10"
            >
            {/* Background Audio Waveform Layer */}
            {showWaveform && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <WaveformCanvas
                  audioBuffer={audioBuffer}
                  scrollContainerRef={containerRef}
                  totalWidth={widthPx}
                  height={padAreaHeight}
                  pixelsPerSecond={pixelsPerSecond}
                  bpm={level.timing.bpm}
                  offset={offset}
                  leadIn={leadIn}
                />
              </div>
            )}

            {/* Pre-Roll Lead-In Shading Overlay */}
            {leadIn > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15 overflow-hidden flex flex-col justify-between border-r-2 border-amber-400/80 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/5"
                style={{
                  left: 0,
                  width: leadIn * pixelsPerSecond,
                }}
              >
                <div className="flex items-center gap-1.5 px-2 pt-1 z-10">
                  <span className="font-mono text-[9px] font-bold text-amber-300 uppercase tracking-wider bg-black/80 px-1.5 py-0.5 rounded border border-amber-400/50 shadow-sm">
                    Pre-Roll {leadIn.toFixed(1)}s (Silence)
                  </span>
                </div>
              </div>
            )}

            {/* Fade In Audio Envelope & Volume Curve Overlay (Premiere Pro / CapCut style) */}
            {fadeIn > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15 overflow-hidden flex flex-col justify-between border-r border-[#00e5ff]/50 border-dashed"
                style={{
                  left: leadIn * pixelsPerSecond,
                  width: Math.max(16, fadeIn * pixelsPerSecond),
                }}
              >
                {/* Floating Glassmorphic Badge */}
                <div className="flex items-center gap-1.5 px-2 pt-1.5 z-20">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-[#00e5ff]/60 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
                    <Volume2 className="w-3 h-3 text-[#00e5ff]" />
                    <span className="font-mono text-[9px] font-bold text-[#00e5ff] uppercase tracking-wider">
                      Fade In {fadeIn.toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Acoustic Logarithmic Loudness Curve & Attenuation Mask */}
                <svg
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <linearGradient id="fadeInGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.04" />
                      <stop offset="70%" stopColor="#00e5ff" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.35" />
                    </linearGradient>
                    <pattern id="fadeHatchIn" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  {/* Attenuated / Muted region above the curve */}
                  <path
                    d="M 0,0 L 100,0 L 100,0 C 65,30 35,85 0,100 Z"
                    fill="rgba(0, 0, 0, 0.55)"
                  />
                  <path
                    d="M 0,0 L 100,0 L 100,0 C 65,30 35,85 0,100 Z"
                    fill="url(#fadeHatchIn)"
                  />
                  {/* Active gain area below the curve */}
                  <path
                    d="M 0,100 C 35,85 65,30 100,0 L 100,100 L 0,100 Z"
                    fill="url(#fadeInGradient)"
                  />
                  {/* Glowing Acoustic Bézier Volume Curve */}
                  <path
                    d="M 0,100 C 35,85 65,30 100,0"
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(0, 229, 255, 0.85))' }}
                  />
                  {/* Fade Handle Pip (Anchor Point at 100% volume) */}
                  <circle
                    cx="100"
                    cy="2"
                    r="4.5"
                    fill="#ffffff"
                    stroke="#00e5ff"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 0 4px #00e5ff)' }}
                  />
                </svg>
              </div>
            )}

            {/* Fade Out Audio Envelope & Volume Curve Overlay (Premiere Pro / CapCut style) */}
            {fadeOut > 0 && totalDuration > fadeOut && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15 overflow-hidden flex flex-col justify-between border-l border-pink-500/50 border-dashed"
                style={{
                  left: (leadIn + totalDuration - fadeOut) * pixelsPerSecond,
                  width: Math.max(16, fadeOut * pixelsPerSecond),
                }}
              >
                {/* Floating Glassmorphic Badge */}
                <div className="flex items-center justify-end gap-1.5 px-2 pt-1.5 z-20">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-pink-500/60 shadow-[0_0_12px_rgba(255,45,111,0.3)]">
                    <VolumeX className="w-3 h-3 text-pink-400" />
                    <span className="font-mono text-[9px] font-bold text-pink-400 uppercase tracking-wider">
                      Fade Out {fadeOut.toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Acoustic Logarithmic Loudness Curve & Attenuation Mask */}
                <svg
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <linearGradient id="fadeOutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff2d6f" stopOpacity="0.35" />
                      <stop offset="30%" stopColor="#ff2d6f" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#ff2d6f" stopOpacity="0.04" />
                    </linearGradient>
                    <pattern id="fadeHatchOut" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  {/* Attenuated / Muted region above the curve */}
                  <path
                    d="M 0,0 L 100,0 L 100,100 C 65,70 35,15 0,0 Z"
                    fill="rgba(0, 0, 0, 0.55)"
                  />
                  <path
                    d="M 0,0 L 100,0 L 100,100 C 65,70 35,15 0,0 Z"
                    fill="url(#fadeHatchOut)"
                  />
                  {/* Active gain area below the curve */}
                  <path
                    d="M 0,0 C 35,15 65,70 100,100 L 0,100 Z"
                    fill="url(#fadeOutGradient)"
                  />
                  {/* Glowing Acoustic Bézier Volume Curve */}
                  <path
                    d="M 0,0 C 35,15 65,70 100,100"
                    fill="none"
                    stroke="#ff2d6f"
                    strokeWidth="2.5"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(255, 45, 111, 0.85))' }}
                  />
                  {/* Fade Handle Pip (Anchor Point at start of fade) */}
                  <circle
                    cx="0"
                    cy="2"
                    r="4.5"
                    fill="#ffffff"
                    stroke="#ff2d6f"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 0 4px #ff2d6f)' }}
                  />
                </svg>
              </div>
            )}
            <PadTracksLane
              pads={level.pads}
              eventsByPad={eventsByPad}
              widthPx={widthPx}
              activeTool={activeTool}
              effectiveEventIds={effectiveEventIds}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              beatDuration={beatDuration}
              onTrackClick={handleTrackClick}
              onEventMove={startEventMove}
              onEventResize={startEventResize}
            />
            </div>
          )}

          {/* 2. Triggers & FX Automation Lane (Only rendered in 'triggers' mode) */}
          {timelineMode === 'triggers' && activeTool !== 'shader' && (
            <TriggersLane
              triggers={visibleTriggers}
              activeLayer={activeLayer}
              widthPx={widthPx}
              activeTool={activeTool}
              effectiveTriggerIds={effectiveTriggerIds}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              subLaneHeight={subLaneHeight}
              onTriggerTrackClick={handleTriggerTrackClick}
              onTriggerMove={startTriggerMove}
              onTriggerResize={startTriggerResize}
            />
          )}

          {/* 3. Visual Objects Lane (Only rendered in 'visuals' mode) */}
          {timelineMode === 'visuals' && activeTool !== 'shader' && (
            <VisualObjectsLane
              nodes={visibleNodes}
              activeLayer={activeLayer}
              widthPx={widthPx}
              activeTool={activeTool}
              effectiveNodeIds={effectiveNodeIds}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
              subLaneHeight={subLaneHeight}
              onSelectNode={onSelectNode}
              onToggleNodeSelection={onToggleNodeSelection}
              onNodeMove={startNodeMove}
              onNodeResize={startNodeResize}
              onTrackClick={handleVisualTrackClick}
              onRemoveNode={onRemoveNode}
            />
          )}

          {/* 4. Shaders Post-FX Lane (Rendered in 'shaders' mode OR when activeTool is 'shader') */}
          {(timelineMode === 'shaders' || activeTool === 'shader') && (
            <ShadersLane
              effects={level.visual?.effects || []}
              widthPx={widthPx}
              activeTool={activeTool}
              selectedEffectIds={effectiveEffectIds}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
              subLaneHeight={subLaneHeight}
              onSelectEffect={onSelectEffect}
              onToggleEffectSelection={onToggleEffectSelection}
              onEffectMove={startEffectMove}
              onEffectResize={startEffectResize}
              onTrackClick={handleShaderTrackClick}
              onRemoveEffect={onRemoveEffect}
            />
          )}

          {/* Marquee Selection Rectangle */}
          {marquee && (
            <div
              className="absolute border border-[#00e5ff] bg-[#00e5ff]/15 pointer-events-none z-50 rounded-sm"
              style={{
                left: Math.min(marquee.startX, marquee.currentX),
                top: Math.min(marquee.startY, marquee.currentY),
                width: Math.abs(marquee.currentX - marquee.startX),
                height: Math.abs(marquee.currentY - marquee.startY),
                boxShadow: '0 0 12px rgba(0, 229, 255, 0.25)',
              }}
            />
          )}

          {/* Playhead (Memoized) */}
          <Playhead
            currentTime={currentTime}
            pixelsPerSecond={pixelsPerSecond}
          />
        </div>
      </div>
    </div>
  );
}
