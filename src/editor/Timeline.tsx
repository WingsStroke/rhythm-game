import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { LevelData, PadId, PadEvent, PadBehavior, TriggerData, TriggerActionType } from '../engine/types';
import { Zap, Repeat, Clock } from 'lucide-react';

export type EditorTool = 'select' | 'pen' | 'eraser';
export type GridSubdivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | 'free';

interface TimelineProps {
  level: LevelData;
  currentTime: number;
  isPlaying: boolean;
  activeTool: EditorTool;
  creationBehavior: PadBehavior;
  gridSubdivision: GridSubdivision;
  pixelsPerSecond: number;
  selectedEventId: string | null;
  selectedTriggerId?: string | null;
  onSelectEvent: (event: PadEvent | null) => void;
  onSelectTrigger?: (trigger: TriggerData | null) => void;
  onSeek?: (time: number) => void;
  onAddEvent: (event: PadEvent) => void;
  onUpdateEvent: (event: PadEvent) => void;
  onRemoveEvent: (id: string) => void;
  onAddTrigger?: (trigger: TriggerData) => void;
  onUpdateTrigger?: (trigger: TriggerData) => void;
  onRemoveTrigger?: (id: string) => void;
}

const TRACK_HEADER_WIDTH = 128;

/**
 * Calculates the time interval in seconds for a given grid subdivision.
 */
export function getSnapInterval(bpm: number, subdivision: GridSubdivision): number {
  const beatDuration = 60 / bpm;
  switch (subdivision) {
    case '1/1':
      return beatDuration * 4;
    case '1/2':
      return beatDuration * 2;
    case '1/4':
      return beatDuration;
    case '1/8':
      return beatDuration / 2;
    case '1/16':
      return beatDuration / 4;
    case 'free':
    default:
      return 0;
  }
}

/**
 * Snaps a raw time in seconds to the nearest subdivision.
 */
export function snapTimeToGrid(rawTime: number, bpm: number, subdivision: GridSubdivision): number {
  const interval = getSnapInterval(bpm, subdivision);
  if (interval <= 0) return Math.max(0, rawTime);
  return Math.max(0, Math.round(rawTime / interval) * interval);
}

export function Timeline({
  level,
  currentTime,
  isPlaying,
  activeTool,
  creationBehavior,
  gridSubdivision,
  pixelsPerSecond,
  selectedEventId,
  selectedTriggerId,
  onSelectEvent,
  onSelectTrigger,
  onSeek,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
  onAddTrigger,
  onUpdateTrigger,
  onRemoveTrigger,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);

  const [dragState, setDragState] = useState<{
    targetType: 'event' | 'trigger';
    mode: 'move' | 'resize';
    event?: PadEvent;
    trigger?: TriggerData;
    startX: number;
    origTargetTime: number;
    origDuration: number;
  } | null>(null);

  const beatDuration = 60 / level.timing.bpm;
  const totalDuration = level.song.duration || 120;
  const totalBeats = Math.floor(totalDuration / beatDuration);
  const totalBars = Math.ceil(totalBeats / 4);
  const widthPx = Math.max(1200, totalDuration * pixelsPerSecond);

  const triggers = level.visual?.triggers || [];

  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;
    const container = containerRef.current;
    const playheadX = TRACK_HEADER_WIDTH + currentTime * pixelsPerSecond;
    const targetScroll = playheadX - container.clientWidth * 0.35;

    if (Math.abs(container.scrollLeft - targetScroll) > 5) {
      container.scrollLeft = Math.max(0, targetScroll);
    }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  const scrubPointerX = useRef<number | null>(null);
  const autoScrollRaf = useRef<number | null>(null);

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
          const rawTime = Math.max(0, clickX / pixelsPerSecond);
          const time = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);
          onSeek(time);
        }
      }

      autoScrollRaf.current = requestAnimationFrame(tick);
    };

    autoScrollRaf.current = requestAnimationFrame(tick);
  }, [onSeek, pixelsPerSecond, level.timing.bpm, gridSubdivision]);

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
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const time = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);
    onSeek(time);
    startAutoScroller();
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead.current || !rulerTrackRef.current || !onSeek) return;
    scrubPointerX.current = e.clientX;
    const trackRect = rulerTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const time = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);
    onSeek(time);
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    isDraggingPlayhead.current = false;
    stopAutoScroller();
    // releasePointerCapture may throw if the element was already removed from the DOM; safe to ignore.
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
  };

  const handleTrackClick = (e: React.MouseEvent, padId: PadId) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-event-item]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const snappedTime = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);

    if (activeTool === 'pen') {
      const newEvent: PadEvent = {
        id: crypto.randomUUID(),
        padId,
        targetTime: snappedTime,
        behavior: creationBehavior,
        duration: creationBehavior === 'hold' ? beatDuration * 2 : creationBehavior === 'loop' ? beatDuration * 4 : undefined,
        triggerId: creationBehavior === 'trigger' ? triggers[0]?.id || 'trigger_1' : undefined,
      };
      onAddEvent(newEvent);
      onSelectEvent(newEvent);
      onSelectTrigger?.(null);
    } else {
      onSelectEvent(null);
      onSelectTrigger?.(null);
    }
  };

  const handleTriggerTrackClick = (e: React.MouseEvent) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-trigger-item]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const snappedTime = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);

    if (activeTool === 'pen') {
      const newTrigger: TriggerData = {
        id: `trig_${Math.floor(1000 + Math.random() * 9000)}`,
        time: snappedTime,
        action: 'transform',
        targetId: level.visual?.nodes?.[0]?.id || 'all',
        duration: beatDuration,
        easing: 'easeOutQuad',
        properties: { scaleX: 1.25, scaleY: 1.25 },
      };
      onAddTrigger?.(newTrigger);
      onSelectTrigger?.(newTrigger);
      onSelectEvent(null);
    } else {
      onSelectTrigger?.(null);
      onSelectEvent(null);
    }
  };

  const startEventMove = (e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();
    if (activeTool === 'eraser') { onRemoveEvent(event.id); return; }
    onSelectEvent(event);
    onSelectTrigger?.(null);
    if (activeTool === 'select') {
      setDragState({
        targetType: 'event',
        mode: 'move',
        event,
        startX: e.clientX,
        origTargetTime: event.targetTime,
        origDuration: event.duration || beatDuration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const startEventResize = (e: React.PointerEvent, event: PadEvent) => {
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
  };

  const startTriggerMove = (e: React.PointerEvent, trigger: TriggerData) => {
    e.stopPropagation();
    if (activeTool === 'eraser') { onRemoveTrigger?.(trigger.id); return; }
    onSelectTrigger?.(trigger);
    onSelectEvent(null);
    if (activeTool === 'select') {
      setDragState({
        targetType: 'trigger',
        mode: 'move',
        trigger,
        startX: e.clientX,
        origTargetTime: trigger.time,
        origDuration: trigger.duration || beatDuration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const startTriggerResize = (e: React.PointerEvent, trigger: TriggerData) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    onSelectTrigger?.(trigger);
    onSelectEvent(null);
    setDragState({
      targetType: 'trigger',
      mode: 'resize',
      trigger,
      startX: e.clientX,
      origTargetTime: trigger.time,
      origDuration: trigger.duration || beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    const deltaX = e.clientX - dragState.startX;
    const deltaTime = deltaX / pixelsPerSecond;

    if (dragState.targetType === 'event' && dragState.event) {
      if (dragState.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, dragState.origTargetTime + deltaTime), level.timing.bpm, gridSubdivision);
        if (snapped !== dragState.event.targetTime) onUpdateEvent({ ...dragState.event, targetTime: snapped });
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0 ? Math.max(interval, Math.round(Math.max(0.05, dragState.origDuration + deltaTime) / interval) * interval) : Math.max(0.05, dragState.origDuration + deltaTime);
        if (snapped !== dragState.event.duration) onUpdateEvent({ ...dragState.event, duration: snapped });
      }
    } else if (dragState.targetType === 'trigger' && dragState.trigger) {
      if (dragState.mode === 'move') {
        const snapped = snapTimeToGrid(Math.max(0, dragState.origTargetTime + deltaTime), level.timing.bpm, gridSubdivision);
        if (snapped !== dragState.trigger.time) onUpdateTrigger?.({ ...dragState.trigger, time: snapped });
      } else {
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const snapped = interval > 0 ? Math.max(0, Math.round(Math.max(0, dragState.origDuration + deltaTime) / interval) * interval) : Math.max(0, dragState.origDuration + deltaTime);
        if (snapped !== dragState.trigger.duration) onUpdateTrigger?.({ ...dragState.trigger, duration: snapped });
      }
    }
  }, [dragState, pixelsPerSecond, level.timing.bpm, gridSubdivision, onUpdateEvent, onUpdateTrigger]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      // releasePointerCapture may throw if the pointer was already released; safe to ignore.
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* intentional no-op */ }
      setDragState(null);
    }
  };

  const getTriggerColor = (action: TriggerActionType) => {
    switch (action) {
      case 'transform': return '#00e5ff';
      case 'color': return '#ff007f';
      case 'pulse': return '#ffea00';
      default: return '#00ff9d';
    }
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden select-none bg-[#09090f]">
      <div ref={containerRef} className="flex-1 overflow-auto relative cursor-default" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <div style={{ width: TRACK_HEADER_WIDTH + widthPx, minHeight: level.pads.length * 56 + 36 + 120 + 30 }} className="relative bg-[#09090f]">
          <div className="sticky top-0 z-40 h-8 border-b border-white/10 bg-black/90 backdrop-blur-md flex">
            <div className="sticky left-0 w-32 h-full bg-black/95 border-r border-white/10 z-50 flex items-center px-3 gap-1.5 flex-shrink-0 shadow-md">
              <Clock className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span className="font-mono text-[10px] font-bold text-white/70">TIEMPO</span>
            </div>
            <div ref={rulerTrackRef} className="relative flex-1 cursor-crosshair overflow-hidden" style={{ width: widthPx, minWidth: widthPx }} onPointerDown={handleRulerPointerDown} onPointerMove={handleRulerPointerMove} onPointerUp={handleRulerPointerUp}>
              {Array.from({ length: totalBars + 1 }).map((_, barIdx) => {
                const barTime = barIdx * 4 * beatDuration;
                return <div key={barIdx} className="absolute top-0 bottom-0 border-l-2 border-[#00e5ff]/40 flex flex-col justify-between pl-1 pointer-events-none" style={{ left: barTime * pixelsPerSecond }}><span className="font-mono text-[10px] font-bold text-[#00e5ff]/80">m.{barIdx + 1}</span><span className="text-[9px] text-white/30 font-mono mb-0.5">{barTime.toFixed(1)}s</span></div>;
              })}
              {Array.from({ length: totalBeats + 1 }).map((_, beatIdx) => {
                if (beatIdx % 4 === 0) return null;
                return <div key={beatIdx} className="absolute bottom-0 h-3 border-l border-white/20 pointer-events-none" style={{ left: beatIdx * beatDuration * pixelsPerSecond }} />;
              })}
            </div>
          </div>
          <div className="absolute top-8 bottom-0 pointer-events-none z-0" style={{ left: TRACK_HEADER_WIDTH, width: widthPx }}>
            {Array.from({ length: totalBars + 1 }).map((_, barIdx) => <div key={`bar-${barIdx}`} className="absolute top-0 bottom-0 border-l border-white/25 pointer-events-none" style={{ left: barIdx * 4 * beatDuration * pixelsPerSecond }} />)}
            {Array.from({ length: totalBeats + 1 }).map((_, beatIdx) => (beatIdx % 4 === 0 ? null : <div key={`beat-${beatIdx}`} className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none" style={{ left: beatIdx * beatDuration * pixelsPerSecond }} />))}
          </div>
          <div className="flex flex-col gap-1.5 py-2 relative z-10">
            {level.pads.map((pad) => {
              const trackEvents = level.events.filter((e) => e.padId === pad.id);
              return (
                <div key={pad.id} className="flex h-13 bg-white/[0.03] border-y border-white/10 relative transition-colors">
                  <div className="sticky left-0 w-32 h-full bg-black/90 border-r border-white/10 flex items-center px-3 z-30 backdrop-blur-md shadow-lg flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full mr-2 shadow-sm flex-shrink-0" style={{ backgroundColor: pad.color }} />
                    <div className="flex flex-col overflow-hidden"><span className="text-xs font-mono font-semibold text-white/90 truncate">{pad.label}</span><span className="text-[10px] text-white/40 font-mono">[{pad.keyHint}]</span></div>
                  </div>
                  <div className={`relative flex-1 ${activeTool === 'pen' ? 'hover:bg-white/[0.07] cursor-crosshair' : ''}`} style={{ width: widthPx, minWidth: widthPx }} onClick={(e) => handleTrackClick(e, pad.id)}>
                    {trackEvents.map((event) => {
                      const isSelected = event.id === selectedEventId;
                      const x = event.targetTime * pixelsPerSecond;
                      const width = Math.max(14, (event.duration ?? beatDuration) * pixelsPerSecond);
                      if (event.behavior === 'tap') return <div key={event.id} data-event-item="true" className={`absolute top-1/2 -translate-y-1/2 w-4 h-8 rounded-md transition-shadow z-20 cursor-grab ${isSelected ? 'ring-2 ring-white shadow-[0_0_15px_#ffffff]' : 'hover:brightness-125'}`} style={{ left: Math.max(0, x - 8), backgroundColor: pad.color, boxShadow: `0 0 10px ${pad.color}90` }} onPointerDown={(e) => startEventMove(e, event)} />;
                      if (event.behavior === 'hold') return <div key={event.id} data-event-item="true" className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md border flex items-center transition-all z-20 cursor-grab ${isSelected ? 'ring-2 ring-white border-white shadow-[0_0_15px_#ffffff]' : 'border-white/30'}`} style={{ left: x, width, backgroundColor: `${pad.color}35`, borderColor: pad.color }} onPointerDown={(e) => startEventMove(e, event)}><div className="w-3.5 h-full rounded-l-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pad.color }}><div className="w-1.5 h-1.5 rounded-full bg-white" /></div><span className="text-[9px] font-mono text-white/70 px-1 truncate flex-1 pointer-events-none">{(event.duration || 0).toFixed(2)}s</span>{activeTool === 'select' && <div data-event-item="true" className="w-3.5 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0" onPointerDown={(e) => startEventResize(e, event)}><div className="w-1 h-4 bg-white/60 rounded-full pointer-events-none" /></div>}</div>;
                      if (event.behavior === 'loop') return <div key={event.id} data-event-item="true" className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md border border-dashed flex items-center transition-all z-20 cursor-grab ${isSelected ? 'ring-2 ring-white border-solid shadow-[0_0_15px_#ffffff]' : 'border-white/40'}`} style={{ left: x, width, backgroundColor: `${pad.color}25`, borderColor: pad.color }} onPointerDown={(e) => startEventMove(e, event)}><div className="w-3.5 h-full rounded-l-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pad.color }}><Repeat className="w-2.5 h-2.5 text-white" /></div><span className="text-[9px] font-mono text-white/70 px-1 truncate flex-1 pointer-events-none">Loop {(event.duration || 0).toFixed(2)}s</span>{activeTool === 'select' && <div data-event-item="true" className="w-3.5 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0" onPointerDown={(e) => startEventResize(e, event)}><div className="w-1 h-4 bg-white/60 rounded-full pointer-events-none" /></div>}</div>;
                      if (event.behavior === 'trigger') return <div key={event.id} data-event-item="true" className={`absolute top-1/2 -translate-y-1/2 h-7 rounded-sm flex items-center gap-1 px-1.5 border z-20 cursor-grab ${isSelected ? 'ring-2 ring-white border-white shadow-[0_0_15px_#ffffff]' : 'border-yellow-400/60 bg-yellow-500/20'}`} style={{ left: x }} onPointerDown={(e) => startEventMove(e, event)}><Zap className="w-3 h-3 text-yellow-400" /><span className="text-[9px] font-mono font-bold text-yellow-300">{event.triggerId || 'trig'}</span></div>;
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex h-8 border-y border-violet-500/30 bg-black/80 my-1 relative z-20 shadow-md">
            <div className="sticky left-0 w-32 h-full bg-black/95 border-r border-violet-500/40 flex items-center px-3 z-30 backdrop-blur-md flex-shrink-0"><Zap className="w-3.5 h-3.5 text-yellow-400 mr-1.5 flex-shrink-0" /><span className="text-[11px] font-mono font-bold text-white/90">TRIGGERS</span></div>
            <div className="flex items-center gap-3 pl-4 flex-1"><span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-300">SCENE TRIGGERS & FX AUTOMATION</span><span className="text-[9px] font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded border border-white/10">{triggers.length} disparadores</span></div>
          </div>
          <div className="flex h-28 bg-violet-950/[0.07] border-b border-violet-500/20 relative z-10 transition-colors">
            <div className="sticky left-0 w-32 h-full bg-black/90 border-r border-white/10 flex flex-col justify-center px-3 z-30 backdrop-blur-md shadow-lg flex-shrink-0"><div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" /><span className="text-xs font-mono font-bold text-white/90">FX LANE</span></div><span className="text-[10px] text-white/40 font-mono mt-0.5">Automation</span></div>
            <div className={`relative flex-1 ${activeTool === 'pen' ? 'hover:bg-violet-950/[0.14] cursor-crosshair' : ''}`} style={{ width: widthPx, minWidth: widthPx }} onClick={handleTriggerTrackClick}>
              {triggers.map((trigger) => {
                const x = trigger.time * pixelsPerSecond;
                const width = Math.max(28, (trigger.duration || 0) * pixelsPerSecond);
                const color = getTriggerColor(trigger.action);
                return <div key={trigger.id} data-trigger-item="true" className={`absolute top-1/2 -translate-y-1/2 h-14 rounded-md flex items-center z-20 cursor-grab ${selectedTriggerId === trigger.id ? 'ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.8)]' : ''}`} style={{ left: x, width, backgroundColor: `${color}25`, border: `2px solid ${color}` }} onPointerDown={(e) => startTriggerMove(e, trigger)}><div className="w-5 h-5 rounded flex items-center justify-center ml-1.5 flex-shrink-0" style={{ backgroundColor: color }}><Zap className="w-2.5 h-2.5 -rotate-45 text-black" /></div><div className="flex flex-col px-2 overflow-hidden flex-1"><span className="text-[10px] font-mono font-bold uppercase truncate text-white">{trigger.action}</span><span className="text-[9px] font-mono text-white/60 truncate">{trigger.targetId}</span></div>{activeTool === 'select' && <div data-trigger-item="true" className="w-3.5 h-full hover:bg-white/40 rounded-r-sm cursor-ew-resize flex items-center justify-center flex-shrink-0" onPointerDown={(e) => startTriggerResize(e, trigger)}><div className="w-1 h-5 bg-white/60 rounded-full" /></div>}</div>;
              })}
            </div>
          </div>
          <div className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none" style={{ left: TRACK_HEADER_WIDTH + currentTime * pixelsPerSecond }}><div className="w-3.5 h-3.5 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#ff0000]" /></div>
        </div>
      </div>
    </div>
  );
}
