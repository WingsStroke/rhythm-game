import React from 'react';
import { Repeat, Zap } from 'lucide-react';
import type { PadConfig, PadEvent, PadId } from '../../../../engine/types';
import type { EditorTool } from './timelineLaneUtils';

export interface PadTracksLaneProps {
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

export const PadTracksLane = React.memo(function PadTracksLane({
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
                    className={`absolute top-1/2 -translate-y-1/2 w-5 h-12 rounded-lg transition-[border-color,box-shadow,transform] z-20 cursor-grab active:cursor-grabbing ${
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
                    className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center border z-20 cursor-grab active:cursor-grabbing overflow-hidden transition-[border-color,box-shadow] ${
                      isSelected
                        ? 'ring-2 ring-white border-white shadow-[0_0_20px_#ffffff]'
                        : 'border-white/30 hover:brightness-110'
                    }`}
                    style={{
                      left: x,
                      width: Math.max(24, width),
                      backgroundColor: `${pad.color}40`,
                      borderLeft: `5px solid ${pad.color}`,
                    }}
                    onPointerDown={(e) => onEventMove(e, event)}
                  >
                    <span className="text-[11px] font-mono font-bold text-white/90 px-2 min-w-0 truncate flex-1 pointer-events-none mr-5">
                      HOLD ({(event.duration || 0).toFixed(2)}s)
                    </span>
                    {(activeTool === 'select' || activeTool === 'pen') && (
                      <div
                        data-event-item="true"
                        className="absolute right-0 top-0 bottom-0 w-6 hover:bg-white/30 cursor-ew-resize flex items-center justify-center z-30 transition-colors"
                        onPointerDown={(e) => onEventResize(e, event)}
                        title="Arrastrar para cambiar duración"
                      >
                        <div className="w-1.5 h-6 bg-white/80 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.6)] pointer-events-none" />
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
                    className={`absolute top-1 bottom-1 rounded-lg flex items-center border transition-[border-color,box-shadow] z-10 ${
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
                    <div className="flex items-center gap-1.5 px-2 min-w-0 overflow-hidden pointer-events-none select-none flex-1 mr-6">
                      <Repeat className="w-3.5 h-3.5 text-[#00ff9d] flex-shrink-0" />
                      <span className="text-[10px] font-mono font-bold text-[#00ff9d] tracking-wider uppercase truncate">
                        LOOP ({(event.duration || 0).toFixed(2)}s)
                      </span>
                    </div>

                    {/* End handle (Punto de Desactivación & Resize) */}
                    {(activeTool === 'select' || activeTool === 'pen') && (
                      <div
                        data-event-item="true"
                        className="absolute right-0 top-0 bottom-0 w-6 bg-[#ff0055]/30 hover:bg-[#ff0055]/50 border-l border-[#ff0055]/70 cursor-ew-resize flex items-center justify-center z-30 transition-colors pointer-events-auto"
                        onPointerDown={(e) => onEventResize(e, event)}
                        title="Fin de Bucle (Presionar para desactivar en gameplay / Arrastrar para duración)"
                      >
                        <div className="w-1.5 h-6 bg-[#ff0055] rounded-full shadow-[0_0_8px_#ff0055] pointer-events-none" />
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
                    className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-md flex items-center gap-1.5 px-2.5 border-2 z-20 cursor-grab active:cursor-grabbing transition-[border-color,box-shadow] ${
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
