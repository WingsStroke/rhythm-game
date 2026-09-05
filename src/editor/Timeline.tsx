import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { LevelData, PadId, PadEvent, PadBehavior, TriggerData, TriggerActionType } from '../engine/types';
import { Zap, Repeat, Sparkles, Layers, Activity } from 'lucide-react';

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

/**
 * Calculates the time interval in seconds for a given grid subdivision.
 */
export function getSnapInterval(bpm: number, subdivision: GridSubdivision): number {
  const beatDuration = 60 / bpm;
  switch (subdivision) {
    case '1/1':
      return beatDuration * 4; // 1 whole measure (4 beats)
    case '1/2':
      return beatDuration * 2; // half note (2 beats)
    case '1/4':
      return beatDuration; // quarter note (1 beat)
    case '1/8':
      return beatDuration / 2; // eighth note (0.5 beat)
    case '1/16':
      return beatDuration / 4; // sixteenth note (0.25 beat)
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
  const isDraggingPlayhead = useRef(false);

  // Dragging state for moving events or triggers, or resizing duration
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

  // Auto-scroll timeline to follow playhead smoothly during active playback
  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;
    const container = containerRef.current;
    const playheadX = currentTime * pixelsPerSecond;
    const targetScroll = playheadX - container.clientWidth * 0.35;

    if (Math.abs(container.scrollLeft - targetScroll) > 5) {
      container.scrollLeft = Math.max(0, targetScroll);
    }
  }, [currentTime, isPlaying, pixelsPerSecond]);

  // Handle seeking / scrubbing on the ruler
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current || !onSeek) return;
    isDraggingPlayhead.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const time = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);
    onSeek(time);
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead.current || !containerRef.current || !onSeek) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const time = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);
    onSeek(time);
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    isDraggingPlayhead.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  // Handle clicking on a Pad track lane (note creation or deselect)
  const handleTrackClick = (e: React.MouseEvent, padId: PadId) => {
    if (!containerRef.current) return;
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-event-item]')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const snappedTime = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);

    if (activeTool === 'pen') {
      let defaultDuration: number | undefined;
      if (creationBehavior === 'hold') {
        defaultDuration = beatDuration * 2;
      } else if (creationBehavior === 'loop') {
        defaultDuration = beatDuration * 4;
      }

      const newEvent: PadEvent = {
        id: crypto.randomUUID(),
        padId,
        targetTime: snappedTime,
        behavior: creationBehavior,
        duration: defaultDuration,
        triggerId: creationBehavior === 'trigger' ? triggers[0]?.id || 'trigger_1' : undefined,
      };

      onAddEvent(newEvent);
      onSelectEvent(newEvent);
      onSelectTrigger?.(null);
    } else if (activeTool === 'select') {
      onSelectEvent(null);
      onSelectTrigger?.(null);
    }
  };

  // Handle clicking on the Triggers lane (trigger creation or deselect)
  const handleTriggerTrackClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (dragState) return;
    if ((e.target as HTMLElement).closest('[data-trigger-item]')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
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
        properties: {
          scaleX: 1.25,
          scaleY: 1.25,
        },
      };

      onAddTrigger?.(newTrigger);
      onSelectTrigger?.(newTrigger);
      onSelectEvent(null);
    } else if (activeTool === 'select') {
      onSelectTrigger?.(null);
      onSelectEvent(null);
    }
  };

  // Start moving an event
  const startEventMove = (e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();

    if (activeTool === 'eraser') {
      onRemoveEvent(event.id);
      return;
    }

    onSelectEvent(event);
    onSelectTrigger?.(null);

    if (activeTool === 'select') {
      setDragState({
        targetType: 'event',
        mode: 'move',
        event,
        startX: e.clientX,
        origTargetTime: event.targetTime,
        origDuration: event.duration ?? beatDuration,
      });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  // Start resizing an event (hold or loop duration)
  const startEventResize = (e: React.PointerEvent, event: PadEvent) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;

    onSelectEvent(event);
    onSelectTrigger?.(null);
    setDragState({
      targetType: 'event',
      mode: 'resize',
      event,
      startX: e.clientX,
      origTargetTime: event.targetTime,
      origDuration: event.duration ?? beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Start moving a trigger
  const startTriggerMove = (e: React.PointerEvent, trigger: TriggerData) => {
    e.stopPropagation();

    if (activeTool === 'eraser') {
      onRemoveTrigger?.(trigger.id);
      return;
    }

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

  // Start resizing a trigger duration
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

  // Dragging movement and resize handler for both events and triggers
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (dragState.targetType === 'event' && dragState.event) {
        if (dragState.mode === 'move') {
          const rawNewTime = Math.max(0, dragState.origTargetTime + deltaTime);
          const snappedNewTime = snapTimeToGrid(rawNewTime, level.timing.bpm, gridSubdivision);

          if (snappedNewTime !== dragState.event.targetTime) {
            const updated = { ...dragState.event, targetTime: snappedNewTime };
            onUpdateEvent(updated);
          }
        } else if (dragState.mode === 'resize') {
          const rawNewDuration = Math.max(0.05, dragState.origDuration + deltaTime);
          const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
          const snappedNewDuration =
            interval > 0 ? Math.max(interval, Math.round(rawNewDuration / interval) * interval) : rawNewDuration;

          if (snappedNewDuration !== dragState.event.duration) {
            const updated = { ...dragState.event, duration: snappedNewDuration };
            onUpdateEvent(updated);
          }
        }
      } else if (dragState.targetType === 'trigger' && dragState.trigger) {
        if (dragState.mode === 'move') {
          const rawNewTime = Math.max(0, dragState.origTargetTime + deltaTime);
          const snappedNewTime = snapTimeToGrid(rawNewTime, level.timing.bpm, gridSubdivision);

          if (snappedNewTime !== dragState.trigger.time) {
            const updated = { ...dragState.trigger, time: snappedNewTime };
            onUpdateTrigger?.(updated);
          }
        } else if (dragState.mode === 'resize') {
          const rawNewDuration = Math.max(0, dragState.origDuration + deltaTime);
          const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
          const snappedNewDuration =
            interval > 0 ? Math.max(0, Math.round(rawNewDuration / interval) * interval) : rawNewDuration;

          if (snappedNewDuration !== dragState.trigger.duration) {
            const updated = { ...dragState.trigger, duration: snappedNewDuration };
            onUpdateTrigger?.(updated);
          }
        }
      }
    },
    [dragState, pixelsPerSecond, level.timing.bpm, gridSubdivision, onUpdateEvent, onUpdateTrigger]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      setDragState(null);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  const getTriggerColor = (action: TriggerActionType) => {
    switch (action) {
      case 'transform':
        return '#00e5ff'; // Electric Cyan
      case 'color':
        return '#ff007f'; // Neon Pink
      case 'pulse':
        return '#ffea00'; // Bright Yellow
      case 'effect':
      default:
        return '#00ff9d'; // Neon Green
    }
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden select-none bg-[#09090f]">
      {/* Time Ruler (Measures, beats, playhead scrubber) */}
      <div
        className="h-8 border-b border-white/10 bg-black/60 relative overflow-hidden flex-shrink-0 cursor-crosshair"
        onPointerDown={handleRulerPointerDown}
        onPointerMove={handleRulerPointerMove}
        onPointerUp={handleRulerPointerUp}
      >
        <div className="absolute top-0 left-0 h-full text-[10px] text-white/50 pointer-events-none" style={{ width: widthPx }}>
          {/* Measure Labels and Ticks */}
          {Array.from({ length: totalBars + 1 }).map((_, barIdx) => {
            const barTime = barIdx * 4 * beatDuration;
            const barX = barTime * pixelsPerSecond;
            return (
              <div
                key={barIdx}
                className="absolute top-0 bottom-0 border-l-2 border-[#00e5ff]/40 flex flex-col justify-between pl-1"
                style={{ left: barX }}
              >
                <span className="font-mono text-[10px] font-bold text-[#00e5ff]/80">m.{barIdx + 1}</span>
                <span className="text-[9px] text-white/30 font-mono mb-0.5">{barTime.toFixed(1)}s</span>
              </div>
            );
          })}

          {/* Quarter Beat Ticks */}
          {Array.from({ length: totalBeats + 1 }).map((_, beatIdx) => {
            if (beatIdx % 4 === 0) return null;
            const beatX = beatIdx * beatDuration * pixelsPerSecond;
            return (
              <div
                key={beatIdx}
                className="absolute bottom-0 h-3 border-l border-white/20"
                style={{ left: beatX }}
              />
            );
          })}
        </div>
      </div>

      {/* Main Track Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative cursor-default"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{ width: widthPx, minHeight: level.pads.length * 56 + 36 + 120 + 30 }} className="relative bg-[#09090f]">
          {/* Vertical Metric Grid Lines */}
          {/* Measure lines */}
          {Array.from({ length: totalBars + 1 }).map((_, barIdx) => (
            <div
              key={`bar-${barIdx}`}
              className="absolute top-0 bottom-0 border-l border-white/25 pointer-events-none z-0"
              style={{ left: barIdx * 4 * beatDuration * pixelsPerSecond }}
            />
          ))}

          {/* Beat lines */}
          {Array.from({ length: totalBeats + 1 }).map((_, beatIdx) => {
            if (beatIdx % 4 === 0) return null;
            return (
              <div
                key={`beat-${beatIdx}`}
                className="absolute top-0 bottom-0 border-l border-white/10 pointer-events-none z-0"
                style={{ left: beatIdx * beatDuration * pixelsPerSecond }}
              />
            );
          })}

          {/* Subdivisions */}
          {gridSubdivision === '1/8' || gridSubdivision === '1/16' ? (
            Array.from({ length: totalBeats * (gridSubdivision === '1/16' ? 4 : 2) }).map((_, subIdx) => {
              const stepTime = beatDuration / (gridSubdivision === '1/16' ? 4 : 2);
              if (subIdx % (gridSubdivision === '1/16' ? 4 : 2) === 0) return null;
              return (
                <div
                  key={`sub-${subIdx}`}
                  className="absolute top-0 bottom-0 border-l border-white/5 pointer-events-none z-0"
                  style={{ left: subIdx * stepTime * pixelsPerSecond }}
                />
              );
            })
          ) : null}

          {/* 1. PAD TRACKS (Sequencing Lanes) */}
          <div className="flex flex-col gap-1.5 py-2 relative z-10">
            {level.pads.map((pad) => {
              const trackEvents = level.events.filter((e) => e.padId === pad.id);

              return (
                <div
                  key={pad.id}
                  className={`h-13 bg-white/[0.03] border-y border-white/10 relative transition-colors ${
                    activeTool === 'pen' ? 'hover:bg-white/[0.07] cursor-crosshair' : ''
                  }`}
                  onClick={(e) => handleTrackClick(e, pad.id)}
                >
                  {/* Sticky Track Label */}
                  <div className="sticky left-0 w-28 h-full bg-black/85 border-r border-white/10 flex items-center px-3 z-30 backdrop-blur-md pointer-events-none shadow-lg">
                    <div className="w-2.5 h-2.5 rounded-full mr-2 shadow-sm" style={{ backgroundColor: pad.color }} />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-mono font-semibold text-white/90 truncate">{pad.label}</span>
                      <span className="text-[10px] text-white/40 font-mono">[{pad.keyHint}]</span>
                    </div>
                  </div>

                  {/* Events in this track */}
                  {trackEvents.map((event) => {
                    const isSelected = event.id === selectedEventId;
                    const x = event.targetTime * pixelsPerSecond;
                    const duration = event.duration ?? beatDuration;
                    const width = Math.max(14, duration * pixelsPerSecond);

                    // 1. TAP NOTE
                    if (event.behavior === 'tap') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-8 rounded-md transition-shadow z-20 cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white shadow-[0_0_15px_#ffffff]'
                              : 'hover:brightness-125'
                          }`}
                          style={{
                            left: x - 8,
                            backgroundColor: pad.color,
                            boxShadow: `0 0 10px ${pad.color}90`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              onRemoveEvent(event.id);
                            } else {
                              onSelectEvent(event);
                              onSelectTrigger?.(null);
                            }
                          }}
                        >
                          <div className="w-full h-full border border-white/40 rounded-md pointer-events-none" />
                        </div>
                      );
                    }

                    // 2. HOLD NOTE
                    if (event.behavior === 'hold') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center z-20 transition-all cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white shadow-[0_0_15px_#ffffff]'
                              : 'hover:brightness-110'
                          }`}
                          style={{
                            left: x,
                            width,
                            backgroundColor: `${pad.color}35`,
                            border: `2px solid ${pad.color}`,
                            boxShadow: `0 0 12px ${pad.color}50`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              onRemoveEvent(event.id);
                            } else {
                              onSelectEvent(event);
                              onSelectTrigger?.(null);
                            }
                          }}
                        >
                          <div
                            className="w-3.5 h-full rounded-l-sm flex-shrink-0 pointer-events-none"
                            style={{ backgroundColor: pad.color }}
                          />
                          <span className="text-[10px] font-mono text-white/80 px-2 font-bold select-none truncate flex-1 pointer-events-none">
                            HOLD ({(event.duration || 0.5).toFixed(2)}s)
                          </span>
                          <div
                            data-event-item="true"
                            className="w-3 h-full hover:bg-white/40 rounded-r-sm cursor-ew-resize flex items-center justify-center flex-shrink-0"
                            onPointerDown={(e) => startEventResize(e, event)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="w-1 h-4 bg-white/60 rounded-full pointer-events-none" />
                          </div>
                        </div>
                      );
                    }

                    // 3. LOOP NOTE
                    if (event.behavior === 'loop') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center z-20 transition-all cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white shadow-[0_0_15px_#ffffff]'
                              : 'hover:brightness-110'
                          }`}
                          style={{
                            left: x,
                            width,
                            backgroundColor: `${pad.color}25`,
                            border: `2px dashed ${pad.color}`,
                            boxShadow: `0 0 8px ${pad.color}40`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              onRemoveEvent(event.id);
                            } else {
                              onSelectEvent(event);
                              onSelectTrigger?.(null);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1 px-2 pointer-events-none text-white/90">
                            <Repeat className="w-3 h-3 text-white" />
                            <span className="text-[10px] font-mono font-bold truncate">
                              LOOP ({(event.duration || 1.0).toFixed(2)}s)
                            </span>
                          </div>
                          <div className="flex-1" />
                          <div
                            data-event-item="true"
                            className="w-3 h-full hover:bg-white/40 rounded-r-sm cursor-ew-resize flex items-center justify-center flex-shrink-0"
                            onPointerDown={(e) => startEventResize(e, event)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="w-1 h-4 bg-white/60 rounded-full pointer-events-none" />
                          </div>
                        </div>
                      );
                    }

                    // 4. TRIGGER EVENT
                    if (event.behavior === 'trigger') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center z-20 cursor-grab active:cursor-grabbing"
                          style={{ left: x - 14 }}
                          onPointerDown={(e) => startEventMove(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              onRemoveEvent(event.id);
                            } else {
                              onSelectEvent(event);
                              onSelectTrigger?.(null);
                            }
                          }}
                        >
                          <div
                            className={`w-6 h-6 rotate-45 flex items-center justify-center rounded-sm transition-all pointer-events-none ${
                              isSelected
                                ? 'ring-2 ring-white shadow-[0_0_18px_#ffea00]'
                                : 'hover:scale-110'
                            }`}
                            style={{
                              backgroundColor: '#ffea00',
                              boxShadow: '0 0 12px rgba(255, 234, 0, 0.8)',
                            }}
                          >
                            <Zap className="w-3 h-3 -rotate-45 text-black font-bold" />
                          </div>
                          <span className="text-[9px] font-mono text-yellow-400/90 font-bold bg-black/80 px-1 rounded mt-1 truncate max-w-[60px] border border-yellow-400/30 pointer-events-none">
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

          {/* 2. SECTION DIVIDER / DOCK BAR (Occupies middle boundary) */}
          <div className="relative z-20 my-1 h-8 border-y border-violet-500/30 bg-black/80 flex items-center shadow-md">
            {/* Sticky Label Matching Pad Headers */}
            <div className="sticky left-0 w-28 h-full bg-black/95 border-r border-violet-500/40 flex items-center px-3 z-30 backdrop-blur-md">
              <Zap className="w-3.5 h-3.5 text-yellow-400 mr-1.5" />
              <span className="text-[11px] font-mono font-bold text-white/90">TRIGGERS</span>
            </div>
            {/* Divider content across width */}
            <div className="flex items-center gap-3 pl-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-300">
                SCENE TRIGGERS & FX AUTOMATION
              </span>
              <span className="text-[9px] font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded border border-white/10">
                {triggers.length} disparadores
              </span>
              <span className="text-[10px] font-mono text-white/30 hidden md:inline">
                Clic con lápiz (B) en el carril inferior para insertar triggers
              </span>
            </div>
          </div>

          {/* 3. TRIGGERS / FX TRACK (Fills the lower empty space) */}
          <div
            className={`relative z-10 h-28 bg-violet-950/[0.07] border-b border-violet-500/20 transition-colors ${
              activeTool === 'pen' ? 'hover:bg-violet-950/[0.14] cursor-crosshair' : ''
            }`}
            onClick={handleTriggerTrackClick}
          >
            {/* Sticky Track Label */}
            <div className="sticky left-0 w-28 h-full bg-black/90 border-r border-white/10 flex flex-col justify-center px-3 z-30 backdrop-blur-md shadow-lg pointer-events-none">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-mono font-bold text-white/90">FX LANE</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono mt-0.5">Automation</span>
            </div>

            {/* Render Trigger Blocks in Track */}
            {triggers.map((trigger) => {
              const isSelected = trigger.id === selectedTriggerId;
              const x = trigger.time * pixelsPerSecond;
              const duration = trigger.duration || 0;
              const width = Math.max(28, duration * pixelsPerSecond);
              const color = getTriggerColor(trigger.action);

              return (
                <div
                  key={trigger.id}
                  data-trigger-item="true"
                  className={`absolute top-1/2 -translate-y-1/2 h-14 rounded-md flex items-center z-20 cursor-grab active:cursor-grabbing transition-all ${
                    isSelected
                      ? 'ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.8)]'
                      : 'hover:brightness-110'
                  }`}
                  style={{
                    left: x,
                    width,
                    backgroundColor: `${color}25`,
                    border: `2px solid ${color}`,
                    boxShadow: `0 0 10px ${color}40`,
                  }}
                  onPointerDown={(e) => startTriggerMove(e, trigger)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      onRemoveTrigger?.(trigger.id);
                    } else {
                      onSelectTrigger?.(trigger);
                      onSelectEvent(null);
                    }
                  }}
                >
                  {/* Start diamond pin */}
                  <div
                    className="w-4 h-4 rotate-45 -ml-2 rounded-xs flex-shrink-0 flex items-center justify-center shadow-md pointer-events-none"
                    style={{ backgroundColor: color }}
                  >
                    <Zap className="w-2.5 h-2.5 -rotate-45 text-black font-bold" />
                  </div>

                  {/* Trigger Information Text */}
                  <div className="flex flex-col px-2 overflow-hidden pointer-events-none select-none flex-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider truncate text-white">
                      {trigger.action}
                    </span>
                    <span className="text-[9px] font-mono text-white/60 truncate">
                      {trigger.targetId} {duration > 0 ? `(${duration.toFixed(2)}s)` : ''}
                    </span>
                  </div>

                  {/* Right Resize Handle for duration */}
                  {activeTool === 'select' && (
                    <div
                      data-trigger-item="true"
                      className="w-3.5 h-full hover:bg-white/40 rounded-r-sm cursor-ew-resize flex items-center justify-center flex-shrink-0"
                      onPointerDown={(e) => startTriggerResize(e, trigger)}
                      onClick={(e) => e.stopPropagation()}
                      title="Arrastrar para ajustar duración"
                    >
                      <div className="w-1 h-5 bg-white/60 rounded-full pointer-events-none" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Continuous Red Playhead line traversing all sections */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            <div className="w-3.5 h-3.5 bg-red-500 rotate-45 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_#ff0000]" />
          </div>
        </div>
      </div>
    </div>
  );
}
