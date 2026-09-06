import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { LevelData, PadId, PadEvent, PadBehavior, TriggerData, TriggerActionType } from '../engine/types';
import { SongRegistry } from '../engine/content/SongRegistry';
import { WaveformCanvas } from './components/WaveformCanvas';
import { Zap, Repeat, Clock } from 'lucide-react';

import { getSnapInterval, snapTimeToGrid, type GridSubdivision } from './utils';

export type { GridSubdivision };
export type EditorTool = 'select' | 'pen' | 'eraser';

interface TimelineProps {
  level: LevelData;
  currentTime: number;
  isPlaying: boolean;
  activeTool: EditorTool;
  creationBehavior: PadBehavior;
  gridSubdivision: GridSubdivision;
  pixelsPerSecond: number;
  showWaveform?: boolean;
  selectedEventId?: string | null;
  selectedEventIds?: Set<string>;
  selectedTriggerId?: string | null;
  selectedTriggerIds?: Set<string>;
  onSelectEvent: (event: PadEvent | null) => void;
  onSelectEvents?: (ids: Set<string>, additive?: boolean) => void;
  onSelectTrigger?: (trigger: TriggerData | null) => void;
  onSelectTriggers?: (ids: Set<string>, additive?: boolean) => void;
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
  selectedEventId,
  selectedEventIds,
  selectedTriggerId,
  selectedTriggerIds,
  onSelectEvent,
  onSelectEvents,
  onSelectTrigger,
  onSelectTriggers,
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
  }, []);

  const [dragState, setDragState] = useState<{
    targetType: 'event' | 'trigger' | 'batch_events' | 'batch_triggers';
    mode: 'move' | 'resize';
    event?: PadEvent;
    trigger?: TriggerData;
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

  // Native wheel listener for smooth horizontal zoom centered on cursor pivot
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onChangePixelsPerSecond) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const currentScrollLeft = container.scrollLeft;
        const timeUnderCursor = (currentScrollLeft + mouseX) / pixelsPerSecond;

        const zoomDelta = e.deltaY < 0 ? 15 : -15;
        const newPixelsPerSecond = Math.max(40, Math.min(350, pixelsPerSecond + zoomDelta));
        if (newPixelsPerSecond === pixelsPerSecond) return;

        onChangePixelsPerSecond(newPixelsPerSecond);

        requestAnimationFrame(() => {
          const newScrollLeft = timeUnderCursor * newPixelsPerSecond - mouseX;
          container.scrollLeft = Math.max(0, newScrollLeft);
        });
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [pixelsPerSecond, onChangePixelsPerSecond]);

  const beatDuration = 60 / level.timing.bpm;
  const totalDuration = level.song.duration || 120;
  const offset = level.timing?.offset ?? 0;
  const leadIn = level.timing?.leadIn ?? 0;
  const fadeIn = level.timing?.fadeIn ?? 0;
  const fadeOut = level.timing?.fadeOut ?? 0;
  const widthPx = Math.max(1200, totalDuration * pixelsPerSecond);

  const audioBuffer = useMemo(
    () => SongRegistry.getInstance().getAudioBuffer(level.songId || level.song.id),
    [level.songId, level.song.id]
  );

  const triggers = level.visual?.triggers || [];

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
      const rawTime = Math.max(0, clickX / pixelsPerSecond);
      if (rawTime < offset) {
        if (gridSubdivision === 'free') {
          return rawTime;
        }
        const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
        const step = interval > 0 ? interval : beatDuration;
        const stepsBefore = Math.round((offset - rawTime) / step);
        return Math.max(0, offset - stepsBefore * step);
      }
      const rawSongTime = rawTime - offset;
      const snappedSongTime = snapTimeToGrid(rawSongTime, level.timing.bpm, gridSubdivision);
      return snappedSongTime + offset;
    },
    [pixelsPerSecond, offset, gridSubdivision, level.timing.bpm, beatDuration]
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

  const handleTrackClick = (e: React.MouseEvent, padId: PadId) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-event-item]')) return;

    if (activeTool === 'pen') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const rawAudioTime = Math.max(0, clickX / pixelsPerSecond);
      const rawSongTime = rawAudioTime - offset;
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), level.timing.bpm, gridSubdivision);

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
    }
  };

  const handleTriggerTrackClick = (e: React.MouseEvent) => {
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-trigger-item]')) return;

    if (activeTool === 'pen') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const rawAudioTime = Math.max(0, clickX / pixelsPerSecond);
      const rawSongTime = rawAudioTime - offset;
      const snappedTime = snapTimeToGrid(Math.max(0, rawSongTime), level.timing.bpm, gridSubdivision);

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
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-item], [data-trigger-item], [data-ruler]')) return;

    if (activeTool === 'select') {
      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!isAdditive) {
        onSelectEvent(null);
        onSelectTrigger?.(null);
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
  };

  const startEventMove = (e: React.PointerEvent, event: PadEvent) => {
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
        }
      }
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

  // Memoized Ruler Ticks that dynamically adapt to the active snap gridSubdivision and timing offset
  const rulerTicks = useMemo(() => {
    const ticks: React.ReactNode[] = [];
    const bpm = level.timing.bpm || 120;
    const interval = getSnapInterval(bpm, gridSubdivision);
    const step = interval > 0 ? interval : beatDuration;
    const barDuration = 4 * beatDuration;

    // 0. Initial audio start marker (if offset > 0)
    if (offset > 0.01) {
      ticks.push(
        <div
          key="ruler-audio-start"
          className="absolute top-0 bottom-0 border-l border-white/20 flex flex-col justify-between pl-1 pointer-events-none"
          style={{ left: 0 }}
        >
          <span className="font-mono text-[9px] text-white/40 font-bold">0.0s</span>
          <span className="text-[8px] text-white/25 font-mono mb-0.5">start</span>
        </div>
      );
    }

    // 1. Measure / Bar Markers (m.1, m.2, ...) starting from offset
    const maxBar = Math.floor((totalDuration - offset) / barDuration);
    for (let barIdx = 0; barIdx <= maxBar; barIdx++) {
      const barTime = offset + barIdx * barDuration;
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
    const totalSteps = Math.floor((totalDuration - offset) / step);
    const stepsPerBar = Math.round(barDuration / step);
    if (stepsPerBar > 1) {
      for (let i = 1; i <= totalSteps; i++) {
        if (i % stepsPerBar === 0) continue; // Skip bar markers already drawn
        const time = offset + i * step;
        ticks.push(
          <div
            key={`ruler-sub-${i}`}
            className="absolute bottom-0 h-2 border-l border-white/20 pointer-events-none"
            style={{ left: time * pixelsPerSecond }}
          />
        );
      }
    }

    // 3. Pre-offset intermediate ticks if offset > 0
    if (offset > 0) {
      const preSteps = Math.floor(offset / step);
      for (let k = 1; k <= preSteps; k++) {
        const time = offset - k * step;
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
  }, [totalDuration, beatDuration, pixelsPerSecond, gridSubdivision, level.timing.bpm, offset]);

  // Memoized Background Grid Lines that dynamically adapt directly to the selected snap and offset
  // All lines have the exact same low, notable opacity (border-white/10) with zero harsh contrasting lines
  const backgroundGridLines = useMemo(() => {
    const bpm = level.timing.bpm || 120;
    const interval = getSnapInterval(bpm, gridSubdivision);
    const step = interval > 0 ? interval : beatDuration; // fallback to 1/4 beat in 'free' mode
    const lines: React.ReactNode[] = [];

    // Forward grid lines starting from offset
    const totalStepsForward = Math.ceil((totalDuration - offset) / step);
    for (let i = 0; i <= totalStepsForward; i++) {
      const time = offset + i * step;
      if (time > totalDuration) break;
      lines.push(
        <div
          key={`grid-snap-${i}`}
          className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none"
          style={{ left: time * pixelsPerSecond }}
        />
      );
    }

    // Pre-offset grid lines from offset back down to 0
    if (offset > 0) {
      const preSteps = Math.ceil(offset / step);
      for (let k = 1; k <= preSteps; k++) {
        const time = offset - k * step;
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
  }, [totalDuration, beatDuration, pixelsPerSecond, gridSubdivision, level.timing.bpm, offset]);

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
          {/* TIME Header */}
          <div className="sticky top-0 z-30 h-9 border-b border-white/10 bg-black/95 flex items-center justify-between px-3.5 gap-2 shadow-md flex-shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00e5ff]" />
              <span className="font-mono text-xs font-bold text-white/80 tracking-wider">TIME</span>
            </div>
            {leadIn > 0 && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00ff9d]/15 text-[#00ff9d] border border-[#00ff9d]/30 font-bold"
                title={`Pre-roll lead-in: ${leadIn}s`}
              >
                +{leadIn}s
              </span>
            )}
          </div>

          {/* Pad Track Labels (flex-1 to distribute vertical space generously, min-h-[68px] for responsive windowed mode) */}
          <div className="flex-1 flex flex-col py-1.5 gap-1.5 min-h-[280px]">
            {level.pads.map((pad) => (
              <div
                key={pad.id}
                className="flex-1 min-h-[68px] flex flex-col justify-center px-3.5 bg-black/90 border-y border-white/10 shadow-sm transition-colors hover:bg-white/[0.04] group"
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

          {/* Triggers Section Header */}
          <div className="h-9 my-1 flex items-center px-3.5 bg-black/95 border-y border-violet-500/40 shadow-sm flex-shrink-0">
            <Zap className="w-4 h-4 text-yellow-400 mr-2 flex-shrink-0" />
            <span className="text-xs font-mono font-bold text-white/90 tracking-wider">TRIGGERS</span>
          </div>

          {/* FX Lane Track Label */}
          <div className="h-32 flex flex-col justify-center px-3.5 bg-black/90 border-b border-white/10 shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs font-mono font-bold text-white/90 tracking-wide">FX LANE</span>
            </div>
            <span className="text-[10px] text-white/40 font-mono mt-1">Scene & Effects</span>
          </div>
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

          {/* Note Track Lanes (flex-1 to consume remaining vertical space smoothly, min-h-[280px] for responsiveness) */}
          <div
            ref={padTracksRef}
            className="flex-1 flex flex-col py-1.5 gap-1.5 min-h-[280px] relative z-10"
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
                  currentTime={currentTime}
                  bpm={level.timing.bpm}
                  offset={offset}
                />
              </div>
            )}

            {/* Fade In Shading & Volume Curve Overlay */}
            {fadeIn > 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15 overflow-hidden flex flex-col justify-between border-r border-[#00e5ff]/50 bg-gradient-to-r from-black/85 via-black/40 to-transparent"
                style={{
                  left: offset * pixelsPerSecond,
                  width: Math.max(12, fadeIn * pixelsPerSecond),
                }}
              >
                <div className="flex items-center gap-1.5 px-2 pt-1 z-10">
                  <span className="font-mono text-[9px] font-bold text-[#00e5ff] uppercase tracking-wider bg-black/75 px-1.5 py-0.5 rounded border border-[#00e5ff]/40 shadow-sm">
                    Fade In {fadeIn.toFixed(1)}s
                  </span>
                </div>
                <svg className="w-full h-full absolute inset-0 pointer-events-none opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <line x1="0" y1="100" x2="100" y2="0" stroke="#00e5ff" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
              </div>
            )}

            {/* Fade Out Shading & Volume Curve Overlay */}
            {fadeOut > 0 && totalDuration > fadeOut && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-15 overflow-hidden flex flex-col justify-between border-l border-pink-500/50 bg-gradient-to-l from-black/85 via-black/40 to-transparent"
                style={{
                  left: (totalDuration - fadeOut) * pixelsPerSecond,
                  width: Math.max(12, fadeOut * pixelsPerSecond),
                }}
              >
                <div className="flex items-center justify-end gap-1.5 px-2 pt-1 z-10">
                  <span className="font-mono text-[9px] font-bold text-pink-400 uppercase tracking-wider bg-black/75 px-1.5 py-0.5 rounded border border-pink-500/40 shadow-sm">
                    Fade Out {fadeOut.toFixed(1)}s
                  </span>
                </div>
                <svg className="w-full h-full absolute inset-0 pointer-events-none opacity-40" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <line x1="0" y1="0" x2="100" y2="100" stroke="#ff2d6f" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
              </div>
            )}
            {level.pads.map((pad) => {
              const trackEvents = level.events.filter((e) => e.padId === pad.id);
              return (
                <div
                  key={pad.id}
                  className={`flex-1 min-h-[68px] bg-white/[0.025] border-y border-white/10 relative transition-colors ${
                    activeTool === 'pen' ? 'hover:bg-white/[0.06] cursor-crosshair' : ''
                  }`}
                  style={{ width: widthPx, minWidth: widthPx }}
                  onClick={(e) => handleTrackClick(e, pad.id)}
                >
                  {trackEvents.map((event) => {
                    const isSelected = effectiveEventIds.has(event.id);
                    const x = (event.targetTime + offset) * pixelsPerSecond;
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
                          onPointerDown={(e) => startEventMove(e, event)}
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
                          className={`absolute top-1/2 -translate-y-1/2 h-12 rounded-lg border-2 flex items-center transition-all z-20 cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffffff]'
                              : 'border-white/40'
                          }`}
                          style={{
                            left: x,
                            width,
                            backgroundColor: `${pad.color}35`,
                            borderColor: pad.color,
                            boxShadow: `0 0 12px ${pad.color}40`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                        >
                          <div
                            className="w-4 h-full rounded-l-md flex items-center justify-center flex-shrink-0 shadow"
                            style={{ backgroundColor: pad.color }}
                          >
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-white/90 px-2 truncate flex-1 pointer-events-none">
                            HOLD ({(event.duration || 0).toFixed(2)}s)
                          </span>
                          {activeTool === 'select' && (
                            <div
                              data-event-item="true"
                              className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                              onPointerDown={(e) => startEventResize(e, event)}
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
                          className={`absolute top-1/2 -translate-y-1/2 h-12 rounded-lg border-2 border-dashed flex items-center transition-all z-20 cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white border-solid shadow-[0_0_20px_#ffffff]'
                              : 'border-white/50'
                          }`}
                          style={{
                            left: x,
                            width,
                            backgroundColor: `${pad.color}25`,
                            borderColor: pad.color,
                            boxShadow: `0 0 12px ${pad.color}35`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                        >
                          <div
                            className="w-4 h-full rounded-l-md flex items-center justify-center flex-shrink-0 shadow"
                            style={{ backgroundColor: pad.color }}
                          >
                            <Repeat className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-white/90 px-2 truncate flex-1 pointer-events-none">
                            LOOP ({(event.duration || 0).toFixed(2)}s)
                          </span>
                          {activeTool === 'select' && (
                            <div
                              data-event-item="true"
                              className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                              onPointerDown={(e) => startEventResize(e, event)}
                            >
                              <div className="w-1.5 h-6 bg-white/70 rounded-full pointer-events-none" />
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (event.behavior === 'trigger') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          data-event-id={event.id}
                          className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center gap-1.5 px-2.5 border-2 z-20 cursor-grab active:cursor-grabbing transition-all ${
                            isSelected
                              ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffea00]'
                              : 'border-yellow-400/80 bg-yellow-500/25 hover:scale-105'
                          }`}
                          style={{ left: x }}
                          onPointerDown={(e) => startEventMove(e, event)}
                        >
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="text-[10px] font-mono font-bold text-yellow-300">
                            {event.triggerId || 'trig'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })}
          </div>

          {/* Triggers Section Title Row */}
          <div className="h-9 border-y border-violet-500/30 bg-black/80 my-1 relative z-20 shadow-md flex items-center pl-4 gap-3 flex-shrink-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-violet-300">
              SCENE TRIGGERS & FX AUTOMATION
            </span>
            <span className="text-[10px] font-mono text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              {triggers.length} {triggers.length === 1 ? 'trigger' : 'triggers'}
            </span>
          </div>

          {/* FX Lane Track */}
          <div
            className={`h-32 bg-violet-950/[0.08] border-b border-violet-500/20 relative z-10 transition-colors flex-shrink-0 ${
              activeTool === 'pen' ? 'hover:bg-violet-950/[0.16] cursor-crosshair' : ''
            }`}
            style={{ width: widthPx, minWidth: widthPx }}
            onClick={handleTriggerTrackClick}
          >
            {triggers.map((trigger) => {
              const isSelected = effectiveTriggerIds.has(trigger.id);
              const x = (trigger.time + offset) * pixelsPerSecond;
              const width = Math.max(32, (trigger.duration || 0) * pixelsPerSecond);
              const color = getTriggerColor(trigger.action);
              return (
                <div
                  key={trigger.id}
                  data-trigger-item="true"
                  data-trigger-id={trigger.id}
                  className={`absolute top-1/2 -translate-y-1/2 h-16 rounded-lg flex items-center z-20 cursor-grab active:cursor-grabbing transition-all ${
                    isSelected
                      ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.9)]'
                      : 'hover:brightness-110'
                  }`}
                  style={{
                    left: x,
                    width,
                    backgroundColor: `${color}25`,
                    border: `2px solid ${color}`,
                  }}
                  onPointerDown={(e) => startTriggerMove(e, trigger)}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center ml-2 flex-shrink-0 shadow"
                    style={{ backgroundColor: color }}
                  >
                    <Zap className="w-3.5 h-3.5 -rotate-45 text-black font-bold" />
                  </div>
                  <div className="flex flex-col px-2.5 overflow-hidden flex-1">
                    <span className="text-[11px] font-mono font-bold uppercase truncate text-white">
                      {trigger.action}
                    </span>
                    <span className="text-[10px] font-mono text-white/60 truncate">{trigger.targetId}</span>
                  </div>
                  {activeTool === 'select' && (
                    <div
                      data-trigger-item="true"
                      className="w-4 h-full hover:bg-white/40 rounded-r-md cursor-ew-resize flex items-center justify-center flex-shrink-0"
                      onPointerDown={(e) => startTriggerResize(e, trigger)}
                    >
                      <div className="w-1.5 h-6 bg-white/60 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            <div className="w-4 h-4 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#ff0000]" />
          </div>
        </div>
      </div>
    </div>
  );
}
