import React from 'react';
import { Activity, Layers, Trash2 } from 'lucide-react';
import type { PadEvent, PadId, PadBehavior, PadConfig } from '../../../engine/types';
import { NumericInput } from '../NumericInput';

export interface NoteInspectorProps {
  selectedEvent: PadEvent | null;
  selectedEvents?: PadEvent[];
  allEvents?: PadEvent[];
  pads: PadConfig[];
  onUpdateEvent: (event: PadEvent) => void;
  onUpdateEventsBatch?: (events: PadEvent[]) => void;
  onRemoveEvent: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
}

export function NoteInspector({
  selectedEvent,
  selectedEvents,
  allEvents = [],
  pads,
  onUpdateEvent,
  onUpdateEventsBatch,
  onRemoveEvent,
  onRemoveBatch,
}: NoteInspectorProps) {
  // Batch selection mode
  if (selectedEvents && selectedEvents.length > 1) {
    return (
      <div className="flex flex-col gap-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="font-bold uppercase tracking-wider text-[#00e5ff] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Batch Selection
          </span>
          <span className="px-2 py-0.5 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-mono text-[10px] font-bold border border-[#00e5ff]/40">
            {selectedEvents.length} Notes
          </span>
        </div>

        {/* Batch Behavior change */}
        <div className="flex flex-col gap-1 text-white/70">
          <span>Change Behavior (All)</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {(['tap', 'hold', 'loop', 'trigger'] as const).map((b) => {
              const isLoopDisabled =
                b === 'loop' &&
                selectedEvents.some((ev) =>
                  allEvents.some(
                    (e: PadEvent) =>
                      e.id !== ev.id &&
                      e.padId === ev.padId &&
                      e.behavior === 'loop' &&
                      ev.targetTime >= e.targetTime &&
                      ev.targetTime < e.targetTime + (e.duration || 0)
                  )
                );

              return (
                <button
                  key={b}
                  disabled={isLoopDisabled}
                  onClick={() => {
                    const updated = selectedEvents.map((ev) => ({
                      ...ev,
                      behavior: b,
                      duration: b === 'hold' || b === 'loop' ? (ev.duration || 0.5) : undefined,
                    }));
                    onUpdateEventsBatch?.(updated);
                  }}
                  className={`px-2 py-1 rounded font-mono uppercase text-[10px] font-semibold border text-center transition-colors ${
                    isLoopDisabled
                      ? 'bg-white/5 text-white/25 border-white/5 cursor-not-allowed'
                      : 'bg-white/5 hover:bg-white/15 text-white/80 border-white/10 cursor-pointer'
                  }`}
                  title={isLoopDisabled ? 'No permitido dentro de otro loop' : undefined}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        {/* Batch Pad reassignment */}
        <label className="flex flex-col gap-1 text-white/70">
          Assign to Pad (All)
          <select
            defaultValue=""
            onChange={(e) => {
              const targetPadId = e.target.value as PadId;
              if (!targetPadId) return;
              const updated = selectedEvents.map((ev) => ({
                ...ev,
                padId: targetPadId,
              }));
              onUpdateEventsBatch?.(updated);
              e.target.value = '';
            }}
            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
          >
            <option value="" disabled>-- Select Pad --</option>
            {pads.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.role || p.keyHint})
              </option>
            ))}
          </select>
        </label>

        {/* Batch Delete Button */}
        <button
          onClick={() => {
            const ids = new Set(selectedEvents.map((e) => e.id));
            onRemoveBatch?.(ids, new Set());
          }}
          className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete {selectedEvents.length} Notes (Del)
        </button>
      </div>
    );
  }

  // Single note selection mode
  if (!selectedEvent) return null;

  const isInsideLoop = allEvents.some(
    (e: PadEvent) =>
      e.id !== selectedEvent.id &&
      e.padId === selectedEvent.padId &&
      e.behavior === 'loop' &&
      selectedEvent.targetTime >= e.targetTime &&
      selectedEvent.targetTime < e.targetTime + (e.duration || 0)
  );

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-bold uppercase tracking-wider text-[#00e5ff] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> Pad Event
        </span>
        <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono uppercase text-[10px] text-white/60">
          {selectedEvent.behavior}
        </span>
      </div>

      {/* Pad Assignment */}
      <label className="flex flex-col gap-1 text-white/70">
        Pad Track
        <select
          value={selectedEvent.padId}
          onChange={(e) => onUpdateEvent({ ...selectedEvent, padId: e.target.value as PadId })}
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
        >
          {pads.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} [{p.keyHint}]
            </option>
          ))}
        </select>
      </label>

      {/* Target Time */}
      <div className="flex flex-col gap-1 text-white/70">
        <div className="flex justify-between">
          <span>Target Time (s)</span>
          <span className="text-white/40 font-mono">{selectedEvent.targetTime.toFixed(3)}s</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              onUpdateEvent({
                ...selectedEvent,
                targetTime: Math.max(0, Number((selectedEvent.targetTime - 0.05).toFixed(3))),
              })
            }
            className="px-1.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono"
          >
            -0.05
          </button>
          <NumericInput
            step="0.01"
            min={0}
            value={selectedEvent.targetTime}
            onChange={(val) =>
              onUpdateEvent({
                ...selectedEvent,
                targetTime: val,
              })
            }
            className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded px-1.5 py-1 text-white outline-none focus:border-[#00e5ff] font-mono text-center text-xs"
          />
          <button
            onClick={() =>
              onUpdateEvent({
                ...selectedEvent,
                targetTime: Number((selectedEvent.targetTime + 0.05).toFixed(3)),
              })
            }
            className="px-1.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono"
          >
            +0.05
          </button>
        </div>
      </div>

      {/* Behavior Selector */}
      <label className="flex flex-col gap-1 text-white/70">
        Behavior
        <select
          value={selectedEvent.behavior}
          onChange={(e) => {
            const newBeh = e.target.value as PadBehavior;
            onUpdateEvent({
              ...selectedEvent,
              behavior: newBeh,
              duration: newBeh === 'hold' || newBeh === 'loop' ? selectedEvent.duration || 1.0 : undefined,
            });
          }}
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono cursor-pointer capitalize"
        >
          <option value="tap">Tap (Single Hit)</option>
          <option value="hold">Hold (Sustained)</option>
          <option value="loop" disabled={isInsideLoop}>
            {isInsideLoop ? 'Loop (No permitido dentro de otro loop)' : 'Loop (Continuous)'}
          </option>
          <option value="trigger">Trigger (Visual FX)</option>
        </select>
      </label>

      {/* Duration for hold/loop */}
      {(selectedEvent.behavior === 'hold' || selectedEvent.behavior === 'loop') && (
        <div className="flex flex-col gap-1 text-white/70">
          <div className="flex justify-between">
            <span>Duration (s)</span>
            <span className="text-white/40 font-mono">
              {(selectedEvent.duration ?? 1.0).toFixed(2)}s
            </span>
          </div>
          <NumericInput
            step="0.05"
            min={0.05}
            value={selectedEvent.duration ?? 1.0}
            onChange={(val) =>
              onUpdateEvent({
                ...selectedEvent,
                duration: val,
              })
            }
            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono"
          />
        </div>
      )}

      {/* Trigger ID for trigger behavior */}
      {selectedEvent.behavior === 'trigger' && (
        <label className="flex flex-col gap-1 text-white/70">
          Trigger ID
          <input
            type="text"
            value={selectedEvent.triggerId || ''}
            placeholder="e.g. trigger_1"
            onChange={(e) => onUpdateEvent({ ...selectedEvent, triggerId: e.target.value })}
            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono"
          />
        </label>
      )}

      {/* Delete Button */}
      <button
        onClick={() => onRemoveEvent(selectedEvent.id)}
        className="mt-4 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete Event
      </button>
    </div>
  );
}
