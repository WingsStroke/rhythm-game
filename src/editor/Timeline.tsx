import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { LevelData, PadId, PadConfig, PadEvent, PadBehavior, TriggerData, TriggerActionType, SceneNodeData } from '../engine/types';
import { SongRegistry } from '../engine/content/SongRegistry';
import { WaveformCanvas } from './components/WaveformCanvas';
import { Zap, Repeat, Volume2, VolumeX, Clock, Layers } from 'lucide-react';

import { getSnapInterval, snapTimeToGrid, type GridSubdivision } from './utils';
import {
  getSongOrigin,
  timelineTimeToSongTime,
  songTimeToTimelineTime,
  timelineXToSongTime,
  timelineXToTimelineTime,
} from '../engine/time/timeUtils';

export type { GridSubdivision };
export type EditorTool = 'select' | 'pen' | 'eraser' | 'object';

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
      className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
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
                  >
                    <div className="w-full h-full border border-white/30 rounded-lg flex items-center justify-center">
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
                    className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center border border-dashed z-20 cursor-grab active:cursor-grabbing transition-all ${
                      isSelected
                        ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffffff]'
                        : 'border-white/40 hover:brightness-110'
                    }`}
                    style={{
                      left: x,
                      width,
                      backgroundColor: `${pad.color}30`,
                      borderLeft: `5px solid ${pad.color}`,
                    }}
                    onPointerDown={(e) => onEventMove(e, event)}
                  >
                    <div className="pl-1.5 flex items-center pointer-events-none">
                      <Repeat className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white/90 px-2 truncate flex-1 pointer-events-none">
                      LOOP ({(event.duration || 0).toFixed(2)}s)
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
  onTriggerTrackClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTriggerMove: (e: React.PointerEvent, trigger: TriggerData) => void;
  onTriggerResize: (e: React.PointerEvent, trigger: TriggerData) => void;
}

const TriggersLane = React.memo(function TriggersLane({
  triggers,
  totalTriggersCount,
  activeLayer = 1,
  widthPx,
  activeTool,
  effectiveTriggerIds,
  songOrigin,
  pixelsPerSecond,
  onTriggerTrackClick,
  onTriggerMove,
  onTriggerResize,
}: TriggersLaneProps) {
  return (
    <>
      {/* Triggers Section Title Row */}
      <div className="h-9 border-y border-violet-500/30 bg-black/80 my-1 relative z-20 shadow-md flex items-center pl-4 gap-3 flex-shrink-0">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-yellow-300">
          FX & TRIGGERS AUTOMATION — LAYER {activeLayer}
        </span>
        <span className="text-[10px] font-mono text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
          {triggers.length} on this layer
          {typeof totalTriggersCount === 'number' ? ` (${totalTriggersCount} total)` : ''}
        </span>
      </div>

      {/* FX Lane Track */}
      <div
        className={`flex-1 min-h-[360px] bg-violet-950/[0.08] border-b border-violet-500/20 relative z-10 transition-colors flex-shrink-0 ${
          activeTool === 'pen' ? 'hover:bg-violet-950/[0.16] cursor-crosshair' : ''
        }`}
        style={{ width: widthPx, minWidth: widthPx }}
        onClick={onTriggerTrackClick}
      >
        {triggers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-xs text-white/30 tracking-wide">
              No triggers on Layer {activeLayer}. Click with Pen (B) to place triggers.
            </span>
          </div>
        )}
        {triggers.map((trigger, index) => {
          const isSelected = effectiveTriggerIds.has(trigger.id);
          const x = (trigger.time + songOrigin) * pixelsPerSecond;
          const width = Math.max(32, (trigger.duration || 0) * pixelsPerSecond);
          const color = getTriggerColor(trigger.action);
          const topOffset = (index % 4) * 68 + 16;
          return (
            <div
              key={trigger.id}
              data-trigger-item="true"
              data-trigger-id={trigger.id}
              className={`absolute h-14 rounded-lg flex items-center z-20 cursor-grab active:cursor-grabbing transition-all ${
                isSelected
                  ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                  : 'hover:brightness-110'
              }`}
              style={{
                top: `${topOffset}px`,
                left: x,
                width,
                backgroundColor: `${color}25`,
                border: `2px solid ${color}`,
              }}
              onPointerDown={(e) => onTriggerMove(e, trigger)}
            >
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center ml-2 flex-shrink-0 shadow"
                style={{ backgroundColor: color }}
              >
                <Zap className="w-3.5 h-3.5 -rotate-45 text-black font-bold" />
              </div>
              <div className="flex flex-col px-2.5 overflow-hidden flex-1 select-none pointer-events-none">
                <span className="text-[11px] font-mono font-bold uppercase truncate text-white">
                  {trigger.action}
                </span>
                <span className="text-[10px] font-mono text-white/60 truncate">{trigger.targetId}</span>
              </div>
              {activeTool === 'select' && (
                <div
                  data-trigger-item="true"
                  className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                  onPointerDown={(e) => onTriggerResize(e, trigger)}
                >
                  <div className="w-1.5 h-6 bg-white/60 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
});

interface VisualObjectsLaneProps {
  nodes: SceneNodeData[];
  totalNodesCount?: number;
  activeLayer?: number;
  widthPx: number;
  activeTool: EditorTool;
  selectedNodeId?: string | null;
  songOrigin: number;
  pixelsPerSecond: number;
  totalDuration: number;
  onSelectNode?: (node: SceneNodeData | null) => void;
  onNodeMove?: (e: React.PointerEvent, node: SceneNodeData) => void;
  onNodeResize?: (e: React.PointerEvent, node: SceneNodeData) => void;
  onTrackClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onRemoveNode?: (id: string) => void;
}

const VisualObjectsLane = React.memo(function VisualObjectsLane({
  nodes,
  totalNodesCount,
  activeLayer = 1,
  widthPx,
  activeTool,
  selectedNodeId,
  songOrigin,
  pixelsPerSecond,
  totalDuration,
  onSelectNode,
  onNodeMove,
  onNodeResize,
  onTrackClick,
  onRemoveNode,
}: VisualObjectsLaneProps) {
  return (
    <>
      {/* Visual Objects Section Title Row */}
      <div className="h-9 border-y border-emerald-500/30 bg-black/80 my-1 relative z-20 shadow-md flex items-center pl-4 gap-3 flex-shrink-0">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-300">
          SCENE OBJECTS & LIFESPAN — LAYER {activeLayer}
        </span>
        <span className="text-[10px] font-mono text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
          {nodes.length} on this layer
          {typeof totalNodesCount === 'number' ? ` (${totalNodesCount} total)` : ''}
        </span>
      </div>

      {/* Visual Objects Track Lane */}
      <div
        className={`flex-1 min-h-[360px] bg-emerald-950/[0.08] border-b border-emerald-500/20 relative z-10 transition-colors flex-shrink-0 ${
          activeTool === 'object' ? 'hover:bg-emerald-950/[0.16] cursor-crosshair' : ''
        }`}
        style={{ width: widthPx, minWidth: widthPx }}
        onClick={onTrackClick}
      >
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-xs text-white/30 tracking-wide">
              No visual objects on Layer {activeLayer}. Click with Object (O) to place elements.
            </span>
          </div>
        )}
        {nodes.map((node, index) => {
          const isSelected = selectedNodeId === node.uid || selectedNodeId === node.id || selectedNodeId === node.name;
          const isFront = node.layerId === 'sceneFront';
          const layerColor = isFront ? '#00e5ff' : '#00ff9d';
          const layerLabel = isFront ? 'FRONT' : 'BACK';
          const zIndexVal = isFront ? 'z:22' : 'z:2';

          const hasLifespan = Boolean(node.lifespan);
          const startTime = node.lifespan ? node.lifespan.startTime : 0;
          const duration = node.lifespan ? node.lifespan.duration : totalDuration;
          const x = (startTime + songOrigin) * pixelsPerSecond;
          const width = Math.max(54, duration * pixelsPerSecond);

          // Stagger items into 4 visual tiers to prevent visual overlap
          const topOffset = (index % 4) * 60 + 16;

          return (
            <div
              key={node.uid || node.id || node.name || index}
              data-node-item="true"
              data-node-id={node.uid || node.id || node.name}
              className={`absolute h-11 rounded-lg flex items-center z-20 cursor-pointer transition-all ${
                isSelected
                  ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                  : 'hover:brightness-125'
              } ${hasLifespan ? '' : 'border-dashed opacity-85'}`}
              style={{
                top: `${topOffset}px`,
                left: x,
                width,
                backgroundColor: `${layerColor}1a`,
                border: `1.5px ${hasLifespan ? 'solid' : 'dashed'} ${layerColor}99`,
              }}
              onPointerDown={(e) => {
                if (activeTool === 'eraser') {
                  e.stopPropagation();
                  onRemoveNode?.(node.uid);
                  return;
                }
                if (hasLifespan && onNodeMove) {
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
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider ml-2 flex-shrink-0 uppercase"
                style={{
                  backgroundColor: `${layerColor}30`,
                  color: layerColor,
                  border: `1px solid ${layerColor}60`,
                }}
              >
                {layerLabel}
              </div>

              {/* Object Details */}
              <div className="flex flex-col px-2 overflow-hidden flex-1 select-none pointer-events-none">
                <span className="text-[11px] font-mono font-bold truncate text-white">
                  {node.name || node.uid || 'SceneObject'}
                </span>
                <span className="text-[9px] font-mono text-white/60 truncate">
                  {node.type} • {zIndexVal} {hasLifespan ? `• ${(node.lifespan!.duration).toFixed(1)}s` : '• all time'}
                </span>
              </div>

              {/* Resize Handle */}
              {hasLifespan && activeTool === 'select' && onNodeResize && (
                <div
                  data-node-item="true"
                  className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                  onPointerDown={(e) => onNodeResize(e, node)}
                >
                  <div className="w-1.5 h-6 bg-white/60 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
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
  timelineMode?: 'notes' | 'triggers' | 'visuals';
  activeLayer?: number;
  onChangeActiveLayer?: (layer: number) => void;
  selectedPrimitiveType?: 'rectangle' | 'circle' | 'group';
  selectedEventId?: string | null;
  selectedEventIds?: Set<string>;
  selectedTriggerId?: string | null;
  selectedTriggerIds?: Set<string>;
  selectedNodeId?: string | null;
  onSelectEvent: (event: PadEvent | null) => void;
  onSelectEvents?: (ids: Set<string>, additive?: boolean) => void;
  onSelectTrigger?: (trigger: TriggerData | null) => void;
  onSelectTriggers?: (ids: Set<string>, additive?: boolean) => void;
  onSelectNode?: (node: SceneNodeData | null) => void;
  onToggleEventSelection?: (id: string, multi: boolean) => void;
  onToggleTriggerSelection?: (id: string, multi: boolean) => void;
  onSelectEventRange?: (targetId: string) => void;
  onSeek?: (time: number) => void;
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
  onRemoveNode?: (id: string) => void;
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
  selectedEventId,
  selectedEventIds,
  selectedTriggerId,
  selectedTriggerIds,
  selectedNodeId,
  onSelectEvent,
  onSelectEvents,
  onSelectTrigger,
  onSelectTriggers,
  onSelectNode,
  onToggleEventSelection,
  onToggleTriggerSelection,
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
  onRemoveNode,
  onChangePixelsPerSecond,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerCanvasRef = useRef<HTMLDivElement>(null);
  const leftHeadersRef = useRef<HTMLDivElement>(null);
  const rulerTrackRef = useRef<HTMLDivElement>(null);
  const padTracksRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);
  const [padAreaHeight, setPadAreaHeight] = useState(280);

  const effectiveEventIds = useMemo(
    () => selectedEventIds ?? (selectedEventId ? new Set([selectedEventId]) : new Set<string>()),
    [selectedEventIds, selectedEventId]
  );

  const effectiveTriggerIds = useMemo(
    () => selectedTriggerIds ?? (selectedTriggerId ? new Set([selectedTriggerId]) : new Set<string>()),
    [selectedTriggerIds, selectedTriggerId]
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

  const [dragState, setDragState] = useState<{
    targetType: 'event' | 'trigger' | 'batch_events' | 'batch_triggers' | 'node';
    mode: 'move' | 'resize';
    event?: PadEvent;
    trigger?: TriggerData;
    node?: SceneNodeData;
    origEvents?: PadEvent[];
    origTriggers?: TriggerData[];
    startX: number;
    origTargetTime?: number;
    origDuration?: number;
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
    () => SongRegistry.getInstance().getAudioBuffer(level.songId || level.song.id),
    [level.songId, level.song.id]
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
    if (!isPlaying || !containerRef.current) return;
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
        if (container.scrollLeft !== prevScroll && onSeek && rulerTrackRef.current) {
          const trackRect = rulerTrackRef.current.getBoundingClientRect();
          const clickX = x - trackRect.left;
          onSeek(getAudioTimeFromClickX(clickX));
        }
      }

      autoScrollRaf.current = requestAnimationFrame(tick);
    };

    autoScrollRaf.current = requestAnimationFrame(tick);
  }, [onSeek, getAudioTimeFromClickX]);

  const stopAutoScroller = useCallback(() => {
    if (autoScrollRaf.current !== null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
    scrubPointerX.current = null;
  }, []);

  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (!rulerTrackRef.current || !onSeek) return;
    isDraggingPlayhead.current = true;
    scrubPointerX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const trackRect = rulerTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    onSeek(getAudioTimeFromClickX(clickX));
    startAutoScroller();
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead.current || !rulerTrackRef.current || !onSeek) return;
    scrubPointerX.current = e.clientX;
    const trackRect = rulerTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    onSeek(getAudioTimeFromClickX(clickX));
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    isDraggingPlayhead.current = false;
    stopAutoScroller();
    // releasePointerCapture may throw if the element was already removed from the DOM; safe to ignore.
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
  };

  const handleTrackClick = useCallback((e: React.MouseEvent, padId: PadId) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-event-item]')) return;

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
      onAddEvent(newEvent);
      onSelectEvent(newEvent);
      onSelectTrigger?.(null);
    }
  }, [dragState, activeTool, pixelsPerSecond, leadIn, offset, level.timing.bpm, gridSubdivision, creationBehavior, beatDuration, selectedTriggerId, onAddEvent, onSelectEvent, onSelectTrigger]);

  const handleTriggerTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-trigger-item]')) return;

    if (activeTool === 'pen') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
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
      };
      onAddTrigger?.(newTrigger);
      onSelectTrigger?.(newTrigger);
      onSelectEvent(null);
    }
  }, [dragState, activeTool, pixelsPerSecond, leadIn, offset, level.timing.bpm, gridSubdivision, beatDuration, level.visual?.nodes, activeLayer, onAddTrigger, onSelectTrigger, onSelectEvent]);

  const handleVisualTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-node-item]')) return;

    if (activeTool === 'object') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const rawSongTime = timelineXToSongTime(clickX, pixelsPerSecond, leadIn, offset);
      const bpm = level.timing.bpm || 120;
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), bpm, gridSubdivision);

      const type = selectedPrimitiveType || 'rectangle';
      const nodes = level.visual?.nodes || [];
      let max = 0;
      const prefix = type === 'rectangle' ? 'rect' : type === 'circle' ? 'circle' : 'group';
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

      const newNode: SceneNodeData = {
        uid,
        name: `${prefix}-${counter}`,
        targetId: null,
        id: null,
        type,
        layer: activeLayer,
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
          opacity: 0.9,
        },
        properties:
          type === 'rectangle'
            ? { width: 140, height: 140, color: '#00e5ff' }
            : type === 'circle'
            ? { radius: 70, color: '#ff007f' }
            : {},
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
    onAddNode,
    onSelectNode,
    onSelectEvent,
    onSelectTrigger,
  ]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-item], [data-trigger-item], [data-node-item], [data-ruler]')) return;

    if (activeTool === 'select') {
      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!isAdditive) {
        onSelectEvent(null);
        onSelectTrigger?.(null);
        onSelectNode?.(null);
        onSelectEvents?.(new Set(), false);
        onSelectTriggers?.(new Set(), false);
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
  }, [activeTool, onSelectEvent, onSelectTrigger, onSelectNode, onSelectEvents, onSelectTriggers]);

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
    }

    if (activeTool === 'select') {
      if (isAlreadySelected && effectiveEventIds.size > 1) {
        const selectedEventsList = level.events.filter((ev) => effectiveEventIds.has(ev.id));
        setDragState({
          targetType: 'batch_events',
          mode: 'move',
          event,
          origEvents: selectedEventsList,
          startX: e.clientX,
          origTargetTime: event.targetTime,
        });
      } else {
        setDragState({
          targetType: 'event',
          mode: 'move',
          event,
          startX: e.clientX,
          origTargetTime: event.targetTime,
          origDuration: event.duration || beatDuration,
        });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveEvent, onSelectEventRange, onToggleEventSelection, effectiveEventIds, onSelectEvent, onSelectTrigger, level.events, beatDuration]);

  const startEventResize = useCallback((e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectEvent(event);
    setDragState({
      targetType: 'event',
      mode: 'resize',
      event,
      startX: e.clientX,
      origTargetTime: event.targetTime,
      origDuration: event.duration || beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectEvent, beatDuration]);

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
    }

    if (activeTool === 'select') {
      if (isAlreadySelected && effectiveTriggerIds.size > 1) {
        const selectedTriggersList = triggers.filter((tr) => effectiveTriggerIds.has(tr.id));
        setDragState({
          targetType: 'batch_triggers',
          mode: 'move',
          trigger,
          origTriggers: selectedTriggersList,
          startX: e.clientX,
          origTargetTime: trigger.time,
        });
      } else {
        setDragState({
          targetType: 'trigger',
          mode: 'move',
          trigger,
          startX: e.clientX,
          origTargetTime: trigger.time,
          origDuration: trigger.duration || beatDuration,
        });
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveTrigger, onToggleTriggerSelection, effectiveTriggerIds, onSelectTrigger, onSelectEvent, triggers, beatDuration]);

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
    onSelectNode?.(node);
    onSelectEvent(null);
    onSelectTrigger?.(null);

    if (activeTool === 'select' && node.lifespan) {
      setDragState({
        targetType: 'node',
        mode: 'move',
        node,
        startX: e.clientX,
        origTargetTime: node.lifespan.startTime,
        origDuration: node.lifespan.duration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, onRemoveNode, onSelectNode, onSelectEvent, onSelectTrigger]);

  const startNodeResize = useCallback((e: React.PointerEvent, node: SceneNodeData) => {
    e.stopPropagation();
    if (activeTool !== 'select' || !node.lifespan) return;
    onSelectNode?.(node);
    onSelectEvent(null);
    onSelectTrigger?.(null);

    setDragState({
      targetType: 'node',
      mode: 'resize',
      node,
      startX: e.clientX,
      origTargetTime: node.lifespan.startTime,
      origDuration: node.lifespan.duration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, onSelectNode, onSelectEvent, onSelectTrigger]);

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

      onSelectEvents?.(hitEventIds, marquee.isAdditive);
      onSelectTriggers?.(hitTriggerIds, marquee.isAdditive);
      return;
    }

    if (!dragState) return;
    const deltaX = e.clientX - dragState.startX;
    const deltaTime = deltaX / pixelsPerSecond;

    if (dragState.targetType === 'event' && dragState.event) {
      if (dragState.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, dragState.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
        if (snapped !== dragState.event.targetTime) onUpdateEvent({ ...dragState.event, targetTime: snapped });
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0 ? Math.max(interval, Math.round(Math.max(0.05, dragState.origDuration! + deltaTime) / interval) * interval) : Math.max(0.05, dragState.origDuration! + deltaTime);
        if (snapped !== dragState.event.duration) onUpdateEvent({ ...dragState.event, duration: snapped });
      }
    } else if (dragState.targetType === 'batch_events' && dragState.origEvents && dragState.event) {
      const snappedPivot = snapTimeToGrid(Math.max(0, dragState.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
      const deltaSnap = snappedPivot - dragState.origTargetTime!;
      const minTime = Math.min(...dragState.origEvents.map((ev) => ev.targetTime));
      const validDelta = (minTime + deltaSnap < 0) ? -minTime : deltaSnap;
      const updated = dragState.origEvents.map((ev) => ({
        ...ev,
        targetTime: Math.max(0, Number((ev.targetTime + validDelta).toFixed(4))),
      }));
      onUpdateEventsBatch?.(updated);
    } else if (dragState.targetType === 'trigger' && dragState.trigger) {
      if (dragState.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, dragState.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
        if (snapped !== dragState.trigger.time) onUpdateTrigger?.({ ...dragState.trigger, time: snapped });
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0 ? Math.max(interval, Math.round(Math.max(0, dragState.origDuration! + deltaTime) / interval) * interval) : Math.max(0, dragState.origDuration! + deltaTime);
        if (snapped !== dragState.trigger.duration) onUpdateTrigger?.({ ...dragState.trigger, duration: snapped });
      }
    } else if (dragState.targetType === 'batch_triggers' && dragState.origTriggers && dragState.trigger) {
      const snappedPivot = snapTimeToGrid(Math.max(0, dragState.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
      const deltaSnap = snappedPivot - dragState.origTargetTime!;
      const minTime = Math.min(...dragState.origTriggers.map((tr) => tr.time));
      const validDelta = (minTime + deltaSnap < 0) ? -minTime : deltaSnap;
      const updated = dragState.origTriggers.map((tr) => ({
        ...tr,
        time: Math.max(0, Number((tr.time + validDelta).toFixed(4))),
      }));
      onUpdateTriggersBatch?.(updated);
    } else if (dragState.targetType === 'node' && dragState.node && dragState.node.lifespan) {
      if (dragState.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, dragState.origTargetTime! + deltaTime), level.timing.bpm, gridSubdivision);
        if (snapped !== dragState.node.lifespan.startTime) {
          onUpdateNode?.(dragState.node.uid, {
            lifespan: {
              ...dragState.node.lifespan,
              startTime: snapped,
            },
          });
        }
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0
          ? Math.max(interval, Math.round(Math.max(0.1, dragState.origDuration! + deltaTime) / interval) * interval)
          : Math.max(0.1, dragState.origDuration! + deltaTime);
        if (snapped !== dragState.node.lifespan.duration) {
          onUpdateNode?.(dragState.node.uid, {
            lifespan: {
              ...dragState.node.lifespan,
              duration: snapped,
            },
          });
        }
      }
    }
  }, [
    marquee,
    dragState,
    pixelsPerSecond,
    level.timing.bpm,
    gridSubdivision,
    onSelectEvents,
    onSelectTriggers,
    onUpdateEvent,
    onUpdateEventsBatch,
    onUpdateTrigger,
    onUpdateTriggersBatch,
    onUpdateNode,
  ]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (marquee) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
      setMarquee(null);
      return;
    }
    if (dragState) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
      if (dragState.targetType === 'batch_events' && Math.abs(e.clientX - dragState.startX) < 3 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (dragState.event) {
          onSelectEvent(dragState.event);
          onSelectTrigger?.(null);
        }
      } else if (dragState.targetType === 'batch_triggers' && Math.abs(e.clientX - dragState.startX) < 3 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (dragState.trigger) {
          onSelectTrigger?.(dragState.trigger);
          onSelectEvent(null);
          onSelectNode?.(null);
        }
      } else if (dragState.targetType === 'node' && Math.abs(e.clientX - dragState.startX) < 3) {
        if (dragState.node) {
          onSelectNode?.(dragState.node);
          onSelectEvent(null);
          onSelectTrigger?.(null);
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
            {timelineMode === 'notes' ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00e5ff]" />
                <span className="font-mono text-xs font-bold text-white/80 tracking-wider">TIME</span>
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
          {timelineMode === 'notes' && (
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
                      {pad.keyHint}
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

          {timelineMode === 'triggers' && (
            <div className="flex-1 min-h-[360px] flex flex-col justify-center px-3.5 bg-black/90 border-y border-violet-500/30 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-xs font-mono font-bold text-white/90 tracking-wide">FX & TRIGGERS</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono mt-1">Scene & Effects</span>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono text-yellow-300/90 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20 w-fit">
                <span>Layer {activeLayer}</span>
              </div>
            </div>
          )}

          {timelineMode === 'visuals' && (
            <div className="flex-1 min-h-[360px] flex flex-col justify-center px-3.5 bg-black/90 border-y border-emerald-500/30 shadow-sm">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-mono font-bold text-white/90 tracking-wide">SCENE OBJECTS</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono mt-1">Back & Front Elements</span>
              <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-300/90 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 w-fit">
                <span>Layer {activeLayer}</span>
              </div>
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
            >
              {rulerTicks}
            </div>
          </div>

          {/* Background Beat & Bar Grid Lines spanning full height */}
          <div className="absolute top-9 bottom-0 pointer-events-none z-0" style={{ left: 0, width: widthPx }}>
            {backgroundGridLines}
          </div>

          {/* 1. Note Track Lanes (Only rendered in 'notes' mode) */}
          {timelineMode === 'notes' && (
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
          {timelineMode === 'triggers' && (
            <TriggersLane
              triggers={visibleTriggers}
              totalTriggersCount={triggers.length}
              activeLayer={activeLayer}
              widthPx={widthPx}
              activeTool={activeTool}
              effectiveTriggerIds={effectiveTriggerIds}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              onTriggerTrackClick={handleTriggerTrackClick}
              onTriggerMove={startTriggerMove}
              onTriggerResize={startTriggerResize}
            />
          )}

          {/* 3. Visual Objects Lane (Only rendered in 'visuals' mode) */}
          {timelineMode === 'visuals' && (
            <VisualObjectsLane
              nodes={visibleNodes}
              totalNodesCount={sceneNodes.length}
              activeLayer={activeLayer}
              widthPx={widthPx}
              activeTool={activeTool}
              selectedNodeId={selectedNodeId}
              songOrigin={songOrigin}
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
              onSelectNode={onSelectNode}
              onNodeMove={startNodeMove}
              onNodeResize={startNodeResize}
              onTrackClick={handleVisualTrackClick}
              onRemoveNode={onRemoveNode}
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
