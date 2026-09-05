import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { LevelData, PadId, PadEvent, PadBehavior } from '../engine/types';
import { Zap, Repeat } from 'lucide-react';

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
  onSelectEvent: (event: PadEvent | null) => void;
  onSeek?: (time: number) => void;
  onAddEvent: (event: PadEvent) => void;
  onUpdateEvent: (event: PadEvent) => void;
  onRemoveEvent: (id: string) => void;
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
  onSelectEvent,
  onSeek,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);

  // Dragging state for moving events or resizing duration
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'resize';
    event: PadEvent;
    startX: number;
    origTargetTime: number;
    origDuration: number;
  } | null>(null);

  const beatDuration = 60 / level.timing.bpm;
  const totalDuration = level.song.duration || 120;
  const totalBeats = Math.floor(totalDuration / beatDuration);
  const totalBars = Math.ceil(totalBeats / 4);
  const widthPx = Math.max(1200, totalDuration * pixelsPerSecond);

  // Auto-scroll timeline to follow playhead smoothly during active playback
  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;
    const container = containerRef.current;
    const playheadX = currentTime * pixelsPerSecond;
    const targetScroll = playheadX - container.clientWidth * 0.35;

    // Smooth follow
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

  // Handle clicking on a track lane (e.g. creating notes with pen, or deselecting)
  const handleTrackClick = (e: React.MouseEvent, padId: PadId) => {
    if (!containerRef.current) return;
    if (dragState) return; // Ignore clicks resulting from a drag gesture
    if ((e.target as HTMLElement).closest('[data-event-item]')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const rawTime = Math.max(0, clickX / pixelsPerSecond);
    const snappedTime = snapTimeToGrid(rawTime, level.timing.bpm, gridSubdivision);

    if (activeTool === 'pen') {
      let defaultDuration: number | undefined;
      if (creationBehavior === 'hold') {
        defaultDuration = beatDuration * 2; // 2 beats
      } else if (creationBehavior === 'loop') {
        defaultDuration = beatDuration * 4; // 1 full bar
      }

      const newEvent: PadEvent = {
        id: crypto.randomUUID(),
        padId,
        targetTime: snappedTime,
        behavior: creationBehavior,
        duration: defaultDuration,
        triggerId: creationBehavior === 'trigger' ? level.visual.triggers[0]?.id || 'trigger_1' : undefined,
      };

      onAddEvent(newEvent);
      onSelectEvent(newEvent);
    } else if (activeTool === 'select') {
      // Deselect when clicking empty space in track
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

    if (activeTool === 'select') {
      setDragState({
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
    setDragState({
      mode: 'resize',
      event,
      startX: e.clientX,
      origTargetTime: event.targetTime,
      origDuration: event.duration ?? beatDuration,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Dragging movement and resize handler
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / pixelsPerSecond;

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
    },
    [dragState, pixelsPerSecond, level.timing.bpm, gridSubdivision, onUpdateEvent]
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

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden select-none bg-[#09090f]">
      {/* Time Ruler (Measures, beats, playhead scrubber) */}
      <div
        className="h-9 border-b border-white/10 bg-black/60 relative overflow-hidden flex-shrink-0 cursor-crosshair"
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
            if (beatIdx % 4 === 0) return null; // Skip full bars (already drawn)
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

      {/* Tracks Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative cursor-default"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{ width: widthPx, minHeight: level.pads.length * 68 + 40 }} className="relative bg-[#09090f]">
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

          {/* Subdivisions (1/8th or 1/16th lines if zoom is high enough) */}
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

          {/* Pad Tracks */}
          <div className="flex flex-col gap-2 py-3 relative z-10">
            {level.pads.map((pad) => {
              const trackEvents = level.events.filter((e) => e.padId === pad.id);

              return (
                <div
                  key={pad.id}
                  className={`h-14 bg-white/[0.03] border-y border-white/10 relative transition-colors ${
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
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-9 rounded-md transition-shadow z-20 cursor-grab active:cursor-grabbing ${
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
                            }
                          }}
                        >
                          <div className="w-full h-full border border-white/40 rounded-md pointer-events-none" />
                        </div>
                      );
                    }

                    // 2. HOLD NOTE (Hit head + sustain body + tail handle)
                    if (event.behavior === 'hold') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className={`absolute top-1/2 -translate-y-1/2 h-9 rounded-md flex items-center z-20 transition-all cursor-grab active:cursor-grabbing ${
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
                            }
                          }}
                        >
                          {/* Hit Head */}
                          <div
                            className="w-3.5 h-full rounded-l-sm flex-shrink-0 pointer-events-none"
                            style={{ backgroundColor: pad.color }}
                          />

                          {/* Center label */}
                          <span className="text-[10px] font-mono text-white/80 px-2 font-bold select-none truncate flex-1 pointer-events-none">
                            HOLD ({(event.duration || 0.5).toFixed(2)}s)
                          </span>

                          {/* Right Resize Handle */}
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

                    // 3. LOOP NOTE (Striped continuous region + badge)
                    if (event.behavior === 'loop') {
                      return (
                        <div
                          key={event.id}
                          data-event-item="true"
                          className={`absolute top-1/2 -translate-y-1/2 h-9 rounded-md flex items-center z-20 transition-all cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'ring-2 ring-white shadow-[0_0_15px_#ffffff]'
                              : 'hover:brightness-110'
                          }`}
                          style={{
                            left: x,
                            width,
                            background: `repeating-linear-gradient(45deg, ${pad.color}45, ${pad.color}45 10px, ${pad.color}20 10px, ${pad.color}20 20px)`,
                            border: `2px dashed ${pad.color}`,
                            boxShadow: `0 0 12px ${pad.color}40`,
                          }}
                          onPointerDown={(e) => startEventMove(e, event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              onRemoveEvent(event.id);
                            } else {
                              onSelectEvent(event);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1 px-2 select-none truncate flex-1 pointer-events-none">
                            <Repeat className="w-3 h-3 text-white/90 shrink-0" />
                            <span className="text-[10px] font-mono text-white/90 font-bold truncate">
                              LOOP ({(event.duration || 1).toFixed(2)}s)
                            </span>
                          </div>

                          {/* Right Resize Handle */}
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

                    // 4. TRIGGER NOTE (Diamond + triggerId badge)
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
                            }
                          }}
                        >
                          {/* Rotated Diamond */}
                          <div
                            className={`w-7 h-7 rotate-45 flex items-center justify-center rounded-sm transition-all pointer-events-none ${
                              isSelected
                                ? 'ring-2 ring-white shadow-[0_0_18px_#ffea00]'
                                : 'hover:scale-110'
                            }`}
                            style={{
                              backgroundColor: '#ffea00',
                              boxShadow: '0 0 12px rgba(255, 234, 0, 0.8)',
                            }}
                          >
                            <Zap className="w-3.5 h-3.5 -rotate-45 text-black font-bold" />
                          </div>

                          {/* Trigger ID Badge */}
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

          {/* Red Playhead line & scrubber */}
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
