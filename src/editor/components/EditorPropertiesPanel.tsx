import React from 'react';
import { Activity, Layers, Trash2, MousePointerClick, Zap, Sparkles } from 'lucide-react';
import type {
  PadEvent,
  PadId,
  PadBehavior,
  PadConfig,
  SceneNodeData,
  TriggerData,
  TriggerActionType,
  EasingType,
  BlendModeType,
  VisualEffect,
  VisualEffectScope,
} from '../../engine/types';
import { EffectRegistry } from '../../engine/visual/effects/EffectRegistry';
import { NumericInput } from './NumericInput';

interface EditorPropertiesPanelProps {
  selectedEvent: PadEvent | null;
  selectedEvents?: PadEvent[];
  selectedNode: SceneNodeData | null;
  selectedNodes?: SceneNodeData[];
  selectedTrigger: TriggerData | null;
  selectedTriggers: TriggerData[];
  selectedEffect?: VisualEffect | null;
  selectedEffects?: VisualEffect[];
  effects?: VisualEffect[];
  nodes: SceneNodeData[];
  pads: PadConfig[];
  activeTab: 'timeline' | 'preview';
  timelineMode?: 'notes' | 'triggers' | 'visuals' | 'shaders';
  onUpdateEvent: (event: PadEvent) => void;
  onUpdateEventsBatch?: (events: PadEvent[]) => void;
  onRemoveEvent: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
  onUpdateNode: (updates: Partial<SceneNodeData>) => void;
  onRemoveNode?: (id: string) => void;
  onUpdateTrigger: (trigger: TriggerData) => void;
  onRemoveTrigger: (id: string) => void;
  onUpdateEffect?: (effect: VisualEffect) => void;
  onRemoveEffect?: (id: string) => void;
}

/**
 * Normalizes any color input into a valid 7-character lowercase hex string (#rrggbb)
 * for safe consumption by HTML5 <input type="color">.
 */
function toValidHexColor(val: unknown, fallback = '#00e5ff'): string {
  if (typeof val !== 'string') return fallback;
  const str = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(str)) {
    return `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str}`.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(str)) {
    return `#${str[0]}${str[0]}${str[1]}${str[1]}${str[2]}${str[2]}`.toLowerCase();
  }
  return fallback;
}

export function EditorPropertiesPanel({
  selectedEvent,
  selectedEvents,
  selectedNode,
  selectedNodes,
  selectedTrigger,
  selectedTriggers,
  selectedEffect,
  selectedEffects,
  nodes,
  pads,
  activeTab,
  timelineMode,
  onUpdateEvent,
  onUpdateEventsBatch,
  onRemoveEvent,
  onRemoveBatch,
  onUpdateNode,
  onRemoveNode,
  onUpdateTrigger,
  onRemoveTrigger,
  onUpdateEffect,
  onRemoveEffect,
}: EditorPropertiesPanelProps) {
  return (
    <aside className="w-72 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col h-full min-h-0 overflow-y-auto select-none custom-scrollbar">
      {/* 1. BATCH NOTES SELECTION */}
      {selectedEvents && selectedEvents.length > 1 ? (
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
              {(['tap', 'hold', 'loop', 'trigger'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    const updated = selectedEvents.map((ev) => ({
                      ...ev,
                      behavior: b,
                      duration: b === 'hold' || b === 'loop' ? (ev.duration || 0.5) : undefined,
                    }));
                    onUpdateEventsBatch?.(updated);
                  }}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-white/80 font-mono uppercase text-[10px] font-semibold border border-white/10 text-center transition-colors cursor-pointer"
                >
                  {b}
                </button>
              ))}
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
      ) : selectedTriggers && selectedTriggers.length > 1 ? (
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#00e5ff] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Batch Selection
            </span>
            <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[10px] font-bold border border-violet-500/40">
              {selectedTriggers.length} Triggers
            </span>
          </div>

          <button
            onClick={() => {
              const ids = new Set(selectedTriggers.map((t) => t.id));
              onRemoveBatch?.(new Set(), ids);
            }}
            className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedTriggers.length} Triggers (Del)
          </button>
        </div>
      ) : selectedNodes && selectedNodes.length > 1 ? (
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Batch Selection
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/40">
              {selectedNodes.length} Objects
            </span>
          </div>

          <button
            onClick={() => {
              const ids = new Set(selectedNodes.map((n) => n.uid));
              onRemoveBatch?.(new Set(), new Set(), ids);
            }}
            className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedNodes.length} Objects (Del)
          </button>
        </div>
      ) : selectedEffects && selectedEffects.length > 1 ? (
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Batch Selection
            </span>
            <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 font-mono text-[10px] font-bold border border-fuchsia-500/40">
              {selectedEffects.length} Shaders
            </span>
          </div>

          <button
            onClick={() => {
              const ids = new Set(selectedEffects.map((e) => e.id));
              onRemoveBatch?.(new Set(), new Set(), new Set(), ids);
            }}
            className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete {selectedEffects.length} Shaders (Del)
          </button>
        </div>
      ) : selectedEvent ? (
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
              <option value="loop">Loop (Continuous)</option>
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
      ) : selectedTrigger ? (
        /* 2. TRIGGER / FX PROPERTIES */
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#ffea00] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Trigger FX
            </span>
            <span className="font-mono text-[10px] text-white/40">{selectedTrigger.id}</span>
          </div>

          {/* Timeline Layer */}
          <label className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Timeline Layer</span>
              <span className="text-[10px] text-yellow-400 font-mono">
                Layer {selectedTrigger.layer ?? 1}
              </span>
            </div>
            <NumericInput
              step="1"
              min={1}
              max={99}
              value={selectedTrigger.layer ?? 1}
              onChange={(val) => onUpdateTrigger({ ...selectedTrigger, layer: Math.round(val) })}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#ffea00] outline-none"
            />
            <span className="text-[10px] text-white/40">
              Only rendered when Timeline Triggers mode is set to this layer.
            </span>
          </label>

          {/* Trigger Time */}
          <div className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between">
              <span>Time (s)</span>
              <span className="text-white/40 font-mono">{selectedTrigger.time.toFixed(3)}s</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    time: Math.max(0, Number((selectedTrigger.time - 0.05).toFixed(3))),
                  })
                }
                className="px-1.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono"
              >
                -0.05
              </button>
              <NumericInput
                step="0.01"
                min={0}
                value={selectedTrigger.time}
                onChange={(val) => onUpdateTrigger({ ...selectedTrigger, time: val })}
                className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded px-1.5 py-1 text-white outline-none focus:border-[#ffea00] font-mono text-center text-xs"
              />
              <button
                onClick={() =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    time: Number((selectedTrigger.time + 0.05).toFixed(3)),
                  })
                }
                className="px-1.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono"
              >
                +0.05
              </button>
            </div>
          </div>

          {/* Duration */}
          <label className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between">
              <span>Duration (s)</span>
              <span className="text-white/40 font-mono">
                {selectedTrigger.duration > 0 ? `${selectedTrigger.duration.toFixed(2)}s` : 'Instant'}
              </span>
            </div>
            <NumericInput
              step="0.05"
              min={0}
              value={selectedTrigger.duration}
              onChange={(val) => onUpdateTrigger({ ...selectedTrigger, duration: val })}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#ffea00] font-mono"
            />
          </label>

          {/* Easing (if duration > 0) */}
          {selectedTrigger.duration > 0 && (
            <label className="flex flex-col gap-1 text-white/70">
              Easing Curve
              <select
                value={selectedTrigger.easing || 'linear'}
                onChange={(e) =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    easing: e.target.value as EasingType,
                  })
                }
                className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#ffea00] font-mono cursor-pointer"
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In-Out</option>
                <option value="easeInQuad">Ease In Quad</option>
                <option value="easeOutQuad">Ease Out Quad</option>
                <option value="easeInOutQuad">Ease In-Out Quad</option>
              </select>
            </label>
          )}

          {/* Target ID / Node Selection */}
          <div className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Target ID (Affected Objects)</span>
              <span className="text-[10px] text-white/40 font-mono">
                {selectedTrigger.targetId === 'all' ? 'all' : `ID: ${selectedTrigger.targetId}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedTrigger.targetId === 'all' ? 'all' : String(selectedTrigger.targetId)}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateTrigger({
                    ...selectedTrigger,
                    targetId: val === 'all' ? 'all' : Number(val),
                  });
                }}
                className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#ffea00] font-mono cursor-pointer text-xs"
              >
                <option value="all">[All Scene Objects]</option>
                {Array.from(
                  new Set(
                    nodes
                      .map((n) => (n.targetId !== undefined ? n.targetId : (typeof n.id === 'number' ? n.id : null)))
                      .filter((id): id is number => id !== null && id !== undefined)
                  )
                )
                  .sort((a, b) => a - b)
                  .map((assignedId) => {
                    const matchedNames = nodes
                      .filter((n) => {
                        const tid = n.targetId !== undefined ? n.targetId : (typeof n.id === 'number' ? n.id : null);
                        return tid === assignedId;
                      })
                      .map((n) => n.name || n.uid)
                      .join(', ');
                    return (
                      <option key={assignedId} value={String(assignedId)}>
                        ID {assignedId} ({matchedNames})
                      </option>
                    );
                  })}
              </select>

              <input
                type="number"
                placeholder="ID #"
                title="Enter numeric ID directly"
                value={typeof selectedTrigger.targetId === 'number' ? selectedTrigger.targetId : ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  onUpdateTrigger({
                    ...selectedTrigger,
                    targetId: val === '' ? 'all' : Number(val),
                  });
                }}
                className="w-16 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono text-center outline-none focus:border-[#ffea00] text-xs placeholder:text-white/30"
              />
            </div>
            <span className="text-[10px] text-white/40">
              Affects all objects assigned this numeric ID.
            </span>
          </div>

          {/* Action Selector */}
          <label className="flex flex-col gap-1 text-white/70">
            Action Type
            <select
              value={selectedTrigger.action}
              onChange={(e) => {
                const action = e.target.value as TriggerActionType;
                let defaultProps: Record<string, number | string | boolean> = {};
                if (action === 'transform') {
                  defaultProps = { scaleX: 1.25, scaleY: 1.25, rotation: 0 };
                } else if (action === 'color') {
                  defaultProps = { color: '#ff007f', opacity: 1 };
                } else if (action === 'pulse') {
                  defaultProps = { band: 'bass', multiplier: 1.5 };
                } else {
                  defaultProps = { effectType: 'reactivePulse' };
                }
                onUpdateTrigger({
                  ...selectedTrigger,
                  action,
                  properties: defaultProps,
                });
              }}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#ffea00] font-mono cursor-pointer"
            >
              <option value="transform">Transform (Scale / Pos / Rot)</option>
              <option value="color">Color / Opacity</option>
              <option value="pulse">Audio Pulse (FFT Band)</option>
              <option value="effect">Special Effect / Shaders</option>
            </select>
          </label>

          {/* Action Parameters Form */}
          <div className="p-2.5 bg-black/40 rounded border border-white/10 flex flex-col gap-2">
            <span className="text-[10px] uppercase font-mono font-bold text-white/50">Action Parameters</span>

            {selectedTrigger.action === 'transform' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col text-white/60">
                  Scale
                  <NumericInput
                    step="0.1"
                    value={(selectedTrigger.properties.scaleX as number) ?? 1}
                    onChange={(val) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: {
                          ...selectedTrigger.properties,
                          scaleX: val,
                          scaleY: val,
                        },
                      })
                    }
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col text-white/60">
                  Rot (deg)
                  <NumericInput
                    step="15"
                    value={Math.round((((selectedTrigger.properties.rotation as number) ?? 0) * 180) / Math.PI)}
                    onChange={(val) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: {
                          ...selectedTrigger.properties,
                          rotation: (val * Math.PI) / 180,
                        },
                      })
                    }
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
            )}

            {selectedTrigger.action === 'color' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col text-white/60">
                  Color (Hex)
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={toValidHexColor(selectedTrigger.properties.color, '#ff007f')}
                      onChange={(e) =>
                        onUpdateTrigger({
                          ...selectedTrigger,
                          properties: { ...selectedTrigger.properties, color: e.target.value },
                        })
                      }
                      className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={(selectedTrigger.properties.color as string) ?? ''}
                      placeholder="#ff007f"
                      onChange={(e) =>
                        onUpdateTrigger({
                          ...selectedTrigger,
                          properties: { ...selectedTrigger.properties, color: e.target.value },
                        })
                      }
                      className="flex-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </div>
                </label>
                <label className="flex flex-col text-white/60">
                  Opacidad ({((selectedTrigger.properties.opacity as number) ?? 1).toFixed(2)})
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={(selectedTrigger.properties.opacity as number) ?? 1}
                    onChange={(e) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: { ...selectedTrigger.properties, opacity: Number(e.target.value) },
                      })
                    }
                    className="mt-1 accent-[#ff007f]"
                  />
                </label>
              </div>
            )}

            {selectedTrigger.action === 'pulse' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col text-white/60">
                  Banda FFT
                  <select
                    value={(selectedTrigger.properties.band as string) || 'bass'}
                    onChange={(e) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: { ...selectedTrigger.properties, band: e.target.value },
                      })
                    }
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  >
                    <option value="bass">Bass (Graves / Kick)</option>
                    <option value="mids">Mids (Medios / Snare)</option>
                    <option value="treble">Treble (Agudos / Leads)</option>
                    <option value="amplitude">Master Amplitude</option>
                  </select>
                </label>
                <label className="flex flex-col text-white/60">
                  Multiplicador
                  <NumericInput
                    step="0.1"
                    min={0.5}
                    max={3}
                    value={(selectedTrigger.properties.multiplier as number) ?? 1.5}
                    onChange={(val) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: { ...selectedTrigger.properties, multiplier: val },
                      })
                    }
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
            )}

            {selectedTrigger.action === 'effect' && (
              <label className="flex flex-col text-white/60">
                Efecto
                <select
                  value={(selectedTrigger.properties.effectType as string) || 'reactivePulse'}
                  onChange={(e) =>
                    onUpdateTrigger({
                      ...selectedTrigger,
                      properties: { ...selectedTrigger.properties, effectType: e.target.value },
                    })
                  }
                  className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                >
                  <option value="reactivePulse">Reactive Pulse</option>
                  <option value="particleBurst">Particle Burst</option>
                </select>
              </label>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => onRemoveTrigger(selectedTrigger.id)}
            className="mt-2 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Trigger
          </button>
        </div>
      ) : selectedEffect ? (
        /* SHADER EFFECT PROPERTIES */
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Shader Effect
            </span>
            <span className="font-mono text-purple-300 text-[10px]">{selectedEffect.type}</span>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-2 rounded bg-white/[0.03] border border-white/10">
            <span className="font-semibold text-white/80">Active</span>
            <input
              type="checkbox"
              checked={selectedEffect.enabled !== false}
              onChange={(e) => onUpdateEffect?.({ ...selectedEffect, enabled: e.target.checked })}
              className="rounded border-white/20 bg-black/40 text-fuchsia-400 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Shader Type */}
          <label className="flex flex-col gap-1 text-white/70">
            <span className="font-semibold">Shader Type</span>
            <select
              value={selectedEffect.type}
              onChange={(e) => {
                const newType = e.target.value;
                const def = EffectRegistry.get(newType);
                onUpdateEffect?.({
                  ...selectedEffect,
                  type: newType,
                  parameters: { ...(def?.defaultParameters ?? {}) },
                });
              }}
              className="bg-black/50 border border-white/10 rounded px-2 py-1.5 text-white font-mono focus:border-fuchsia-400 outline-none cursor-pointer"
            >
              <option value="bloom">Bloom (Glow)</option>
              <option value="pixelate">Pixel-Art (Pixelate)</option>
              <option value="chromatic">RGB Shift (Chromatic)</option>
              <option value="motionBlur">Motion Blur</option>
              <option value="scanlines">CRT Scanlines</option>
              <option value="glitch">Digital Glitch</option>
              <option value="colorGrade">Color Grading</option>
            </select>
          </label>

          {/* Target Selection */}
          <label className="flex flex-col gap-1 text-white/70">
            <span className="font-semibold">Target</span>
            <select
              value={selectedEffect.scope}
              onChange={(e) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  scope: e.target.value as VisualEffectScope,
                })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-1.5 text-white font-mono focus:border-fuchsia-400 outline-none cursor-pointer"
            >
              <option value="global">Full Stage (Global)</option>
              <option value="range">Z-Index Range</option>
              <option value="object">Target ID</option>
            </select>
          </label>

          {/* Target: Target ID dropdown */}
          {selectedEffect.scope === 'object' && (
            <label className="flex flex-col gap-1 text-white/70">
              <span className="font-semibold">Target ID</span>
              <select
                value={selectedEffect.targetNodeId || ''}
                onChange={(e) =>
                  onUpdateEffect?.({
                    ...selectedEffect,
                    targetNodeId: e.target.value || undefined,
                  })
                }
                className="bg-black/50 border border-white/10 rounded px-2 py-1.5 text-white font-mono focus:border-fuchsia-400 outline-none cursor-pointer"
              >
                <option value="">-- Select Target ID --</option>
                {nodes.map((n) => (
                  <option key={n.uid} value={n.uid}>
                    Target ID: #{n.targetId !== null && n.targetId !== undefined ? n.targetId : n.uid} — {n.name || n.uid} ({n.type})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Target: Z-Index Range Inputs */}
          {selectedEffect.scope === 'range' && (
            <div className="flex flex-col gap-2 p-2.5 rounded bg-white/[0.03] border border-white/10">
              <span className="font-semibold text-white/80">Z-Index Bounds</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Min Z-Index</span>
                  <NumericInput
                    step="1"
                    value={selectedEffect.zIndexMin ?? 0}
                    onChange={(val) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        zIndexMin: Math.round(val),
                      })
                    }
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Max Z-Index</span>
                  <NumericInput
                    step="1"
                    value={selectedEffect.zIndexMax ?? 100}
                    onChange={(val) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        zIndexMax: Math.round(val),
                      })
                    }
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
              <span className="text-[10px] text-white/40">
                Applies shader only to objects within this z-index range.
              </span>
            </div>
          )}

          {/* Intensity Slider */}
          <label className="flex flex-col gap-1 text-white/60">
            <div className="flex justify-between items-center">
              <span>Intensity ({(selectedEffect.intensity ?? 1.0).toFixed(2)})</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.5"
              step="0.05"
              value={selectedEffect.intensity ?? 1.0}
              onChange={(e) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  intensity: Number(e.target.value),
                })
              }
              className="accent-fuchsia-400"
            />
          </label>

          {/* Shader Specific Parameters */}
          <div className="flex flex-col gap-2 p-2.5 rounded bg-white/[0.03] border border-white/10">
            <span className="font-semibold text-white/80">Shader Parameters</span>
            {selectedEffect.type === 'pixelate' && (
              <label className="flex flex-col gap-1 text-white/60">
                <span>Pixel Size ({Number(selectedEffect.parameters.pixelSize ?? 8)}px)</span>
                <input
                  type="range"
                  min="2"
                  max="40"
                  step="1"
                  value={Number(selectedEffect.parameters.pixelSize ?? 8)}
                  onChange={(e) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      parameters: {
                        ...selectedEffect.parameters,
                        pixelSize: Number(e.target.value),
                      },
                    })
                  }
                  className="accent-fuchsia-400"
                />
              </label>
            )}

            {(selectedEffect.type === 'chromatic' || selectedEffect.type === 'rgbShift') && (
              <label className="flex flex-col gap-1 text-white/60">
                <span>Shift Offset ({Number(selectedEffect.parameters.shift ?? 0.005).toFixed(4)})</span>
                <input
                  type="range"
                  min="0.001"
                  max="0.03"
                  step="0.001"
                  value={Number(selectedEffect.parameters.shift ?? 0.005)}
                  onChange={(e) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      parameters: {
                        ...selectedEffect.parameters,
                        shift: Number(e.target.value),
                      },
                    })
                  }
                  className="accent-fuchsia-400"
                />
              </label>
            )}

            {selectedEffect.type === 'motionBlur' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Velocity X</span>
                  <NumericInput
                    step="1"
                    value={Number(selectedEffect.parameters.velocityX ?? 16)}
                    onChange={(val) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          velocityX: val,
                        },
                      })
                    }
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Velocity Y</span>
                  <NumericInput
                    step="1"
                    value={Number(selectedEffect.parameters.velocityY ?? 0)}
                    onChange={(val) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          velocityY: val,
                        },
                      })
                    }
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
            )}

            {selectedEffect.type === 'bloom' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Luminance Threshold ({Number(selectedEffect.parameters.threshold ?? 0.50).toFixed(2)})</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.95"
                    step="0.05"
                    value={Number(selectedEffect.parameters.threshold ?? 0.50)}
                    onChange={(e) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          threshold: Number(e.target.value),
                        },
                      })
                    }
                    className="accent-fuchsia-400"
                  />
                  <span className="text-[10px] text-white/40">Only pixels brighter than this value emit neon glow.</span>
                </label>
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Glow Radius ({Number(selectedEffect.parameters.radius ?? 2.5).toFixed(1)}px)</span>
                  <input
                    type="range"
                    min="1.0"
                    max="6.0"
                    step="0.2"
                    value={Number(selectedEffect.parameters.radius ?? 2.5)}
                    onChange={(e) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          radius: Number(e.target.value),
                        },
                      })
                    }
                    className="accent-fuchsia-400"
                  />
                </label>
              </div>
            )}

            {selectedEffect.type === 'shockwave' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Wave Speed ({Number(selectedEffect.parameters.speed ?? 1.5).toFixed(2)})</span>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={Number(selectedEffect.parameters.speed ?? 1.5)}
                    onChange={(e) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          speed: Number(e.target.value),
                        },
                      })
                    }
                    className="accent-fuchsia-400"
                  />
                </label>
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Wave Size ({Number(selectedEffect.parameters.waveSize ?? 0.08).toFixed(3)})</span>
                  <input
                    type="range"
                    min="0.02"
                    max="0.25"
                    step="0.01"
                    value={Number(selectedEffect.parameters.waveSize ?? 0.08)}
                    onChange={(e) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          waveSize: Number(e.target.value),
                        },
                      })
                    }
                    className="accent-fuchsia-400"
                  />
                </label>
                <label className="flex flex-col gap-1 text-white/60">
                  <span>Wave Amplitude ({Number(selectedEffect.parameters.amplitude ?? 0.03).toFixed(3)})</span>
                  <input
                    type="range"
                    min="0.005"
                    max="0.08"
                    step="0.005"
                    value={Number(selectedEffect.parameters.amplitude ?? 0.03)}
                    onChange={(e) =>
                      onUpdateEffect?.({
                        ...selectedEffect,
                        parameters: {
                          ...selectedEffect.parameters,
                          amplitude: Number(e.target.value),
                        },
                      })
                    }
                    className="accent-fuchsia-400"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Timing Window */}
          <div className="flex flex-col gap-2 p-2.5 rounded bg-white/[0.03] border border-white/10">
            <span className="font-semibold text-white/80">Timeline Activation</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-white/60">
                <span>Start Time (s)</span>
                <NumericInput
                  step="0.1"
                  min={0}
                  value={selectedEffect.startTime ?? 0}
                  onChange={(val) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      startTime: val,
                    })
                  }
                  className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="flex flex-col gap-1 text-white/60">
                <span>Duration (s)</span>
                <NumericInput
                  step="0.1"
                  min={0.1}
                  value={selectedEffect.duration ?? 2.0}
                  onChange={(val) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      duration: val,
                    })
                  }
                  className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            </div>
          </div>

          {/* Delete Shader */}
          {onRemoveEffect && (
            <button
              onClick={() => onRemoveEffect(selectedEffect.id)}
              className="mt-2 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Shader
            </button>
          )}
        </div>
      ) : selectedNode ? (
        /* 3. SCENE NODE PROPERTIES */
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#00ff9d] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Scene Object
            </span>
            <span className="font-mono text-[#00e5ff] text-[10px]">{selectedNode.type}</span>
          </div>

          {/* 1. Name */}
          <label className="flex flex-col gap-1 text-white/70">
            <span className="font-semibold">Object Name</span>
            <input
              type="text"
              value={selectedNode.name || selectedNode.uid}
              onChange={(e) => onUpdateNode({ name: e.target.value })}
              placeholder="e.g. rect-1"
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
            />
          </label>

          {/* 2. Numeric Group ID */}
          <label className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Object ID (Trigger ID)</span>
              <span className="text-[10px] text-white/40 font-mono">
                {(() => {
                  const tid = selectedNode.targetId !== undefined ? selectedNode.targetId : (typeof selectedNode.id === 'number' ? selectedNode.id : null);
                  return tid === null || tid === undefined ? 'null (No ID)' : `ID: ${tid}`;
                })()}
              </span>
            </div>
            <input
              type="number"
              value={(() => {
                const tid = selectedNode.targetId !== undefined ? selectedNode.targetId : (typeof selectedNode.id === 'number' ? selectedNode.id : null);
                return tid !== null && tid !== undefined ? tid : '';
              })()}
              onChange={(e) => {
                const val = e.target.value.trim();
                const numVal = val === '' ? null : Number(val);
                onUpdateNode({ targetId: numVal, id: numVal });
              }}
              placeholder="null (No ID assigned)"
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none placeholder:text-white/30"
            />
            <span className="text-[10px] text-white/40">
              Multiple objects can share the same ID to be controlled by a single Trigger.
            </span>
          </label>

          {/* Timeline Layer */}
          <label className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Timeline Layer</span>
              <span className="text-[10px] text-[#00ff9d] font-mono">
                Layer {selectedNode.layer ?? 1}
              </span>
            </div>
            <NumericInput
              step="1"
              min={1}
              max={99}
              value={selectedNode.layer ?? 1}
              onChange={(val) => onUpdateNode({ layer: Math.round(val) })}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
            />
            <span className="text-[10px] text-white/40">
              Only rendered when Timeline Visuals mode is set to this layer.
            </span>
          </label>

          {/* 3. Hierarchy & Stacking (Z-Index) */}
          <div className="flex flex-col gap-2.5 p-2.5 rounded bg-white/[0.03] border border-white/10 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white/90">Hierarchy & Stacking</span>
              <span className="text-[10px] text-white/40 font-mono">
                z-index: {selectedNode.zIndex ?? 0}
              </span>
            </div>

            {/* Numeric Z-Index Input with Step Controls */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60">Z-Index:</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateNode({ zIndex: (selectedNode.zIndex ?? 0) - 1 })}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-mono font-bold cursor-pointer"
                  title="Lower Z-Index (-1)"
                >
                  -
                </button>
                <NumericInput
                  step="1"
                  value={selectedNode.zIndex ?? 0}
                  onChange={(val) => onUpdateNode({ zIndex: Math.round(val) })}
                  className="w-14 min-w-0 shrink-0 bg-black/50 border border-white/20 rounded px-1.5 py-1 text-xs text-white text-center font-mono focus:border-[#00e5ff] outline-none"
                />
                <button
                  type="button"
                  onClick={() => onUpdateNode({ zIndex: (selectedNode.zIndex ?? 0) + 1 })}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-mono font-bold cursor-pointer"
                  title="Increase Z-Index (+1)"
                >
                  +
                </button>
              </div>
            </div>
            <span className="text-[10px] text-white/40 leading-tight">
              Higher values render above lower values in the scene.
            </span>

            {/* Hierarchical Scene Priority Checkboxes */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.aboveLanes)}
                  onChange={(e) => onUpdateNode({ aboveLanes: e.target.checked })}
                  className="rounded border-white/20 bg-black/40 text-[#00e5ff] focus:ring-0 cursor-pointer"
                />
                <span>Above Lanes & Notes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.abovePads)}
                  onChange={(e) => onUpdateNode({ abovePads: e.target.checked })}
                  className="rounded border-white/20 bg-black/40 text-purple-400 focus:ring-0 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <span>Above Gameplay Pads</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">High Priority</span>
                </span>
              </label>
            </div>
          </div>

          {/* 4. Temporal Lifespan */}
          <div className="flex flex-col gap-2 p-2.5 rounded bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-semibold text-white/80">Temporal Lifespan</span>
                <span className="text-[10px] text-white/40">Visible only during active time window</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(selectedNode.lifespan)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onUpdateNode({
                      lifespan: {
                        startTime: 0,
                        duration: 10,
                        fadeInMs: 500,
                        fadeOutMs: 500,
                      },
                    });
                  } else {
                    onUpdateNode({ lifespan: undefined });
                  }
                }}
                className="accent-[#00ff9d] cursor-pointer w-4 h-4"
              />
            </div>

            {selectedNode.lifespan && (
              <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-white/5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Start Time (s)
                    <NumericInput
                      step="0.1"
                      min={0}
                      value={selectedNode.lifespan.startTime}
                      onChange={(val) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            startTime: val,
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Duration (s)
                    <NumericInput
                      step="0.1"
                      min={0.1}
                      value={selectedNode.lifespan.duration}
                      onChange={(val) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            duration: val,
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Fade In (ms)
                    <NumericInput
                      step="50"
                      min={0}
                      value={selectedNode.lifespan.fadeInMs ?? 0}
                      onChange={(val) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            fadeInMs: val,
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Fade Out (ms)
                    <NumericInput
                      step="50"
                      min={0}
                      value={selectedNode.lifespan.fadeOutMs ?? 0}
                      onChange={(val) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            fadeOutMs: val,
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Transform */}
          <div className="flex flex-col gap-2">
            <h3 className="text-white/40 uppercase font-mono font-bold text-[10px]">Position (1920x1080 Space)</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col text-white/60">
                X
                <NumericInput
                  step="1"
                  value={selectedNode.transform?.x ?? 0}
                  onChange={(val) =>
                    onUpdateNode({
                      transform: { ...selectedNode.transform, x: val },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                />
              </label>
              <label className="flex flex-col text-white/60">
                Y
                <NumericInput
                  step="1"
                  value={selectedNode.transform?.y ?? 0}
                  onChange={(val) =>
                    onUpdateNode({
                      transform: { ...selectedNode.transform, y: val },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                />
              </label>
            </div>
          </div>

          {/* Scale & Rotation */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col text-white/60">
              Scale
              <NumericInput
                step="0.1"
                value={selectedNode.transform?.scaleX ?? 1}
                onChange={(val) =>
                  onUpdateNode({
                    transform: {
                      ...selectedNode.transform,
                      scaleX: val,
                      scaleY: val,
                    },
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
              />
            </label>
            <label className="flex flex-col text-white/60">
              Rotation (deg)
              <NumericInput
                step="15"
                value={Math.round((((selectedNode.transform?.rotation ?? 0) * 180) / Math.PI))}
                onChange={(val) =>
                  onUpdateNode({
                    transform: {
                      ...selectedNode.transform,
                      rotation: (val * Math.PI) / 180,
                    },
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
              />
            </label>
          </div>

          {/* Opacity */}
          <label className="flex flex-col gap-1 text-white/60">
            <div className="flex justify-between items-center">
              <span>Opacity ({((selectedNode.transform?.opacity ?? 1)).toFixed(2)})</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedNode.transform?.opacity ?? 1}
              onChange={(e) =>
                onUpdateNode({
                  transform: {
                    ...selectedNode.transform,
                    opacity: Number(e.target.value),
                  },
                })
              }
              className="accent-[#00ff9d]"
            />
          </label>

          {/* Dimensions / Color */}
          <div className="flex flex-col gap-2">
            <h3 className="text-white/40 uppercase font-mono font-bold text-[10px]">Geometry & Color</h3>
            {(selectedNode.type === 'rectangle' || selectedNode.type === 'triangle' || selectedNode.type === 'diamond' || selectedNode.type === 'sprite' || selectedNode.type === 'circle' || selectedNode.type === 'hexagon') && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col text-white/60">
                  Width
                  <NumericInput
                    step="1"
                    min={10}
                    value={
                      (selectedNode.properties?.width as number) ??
                      ((selectedNode.properties?.radius as number) ? (selectedNode.properties?.radius as number) * 2 : 120)
                    }
                    onChange={(val) => {
                      const props: Record<string, unknown> = {
                        ...selectedNode.properties,
                        width: val,
                      };
                      if (selectedNode.type === 'circle' || selectedNode.type === 'hexagon') {
                        props.height = val;
                        props.radius = Math.round(val / 2);
                      }
                      onUpdateNode({ properties: props });
                    }}
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col text-white/60">
                  Height
                  <NumericInput
                    step="1"
                    min={10}
                    value={
                      (selectedNode.properties?.height as number) ??
                      ((selectedNode.properties?.radius as number) ? (selectedNode.properties?.radius as number) * 2 : 120)
                    }
                    onChange={(val) => {
                      const props: Record<string, unknown> = {
                        ...selectedNode.properties,
                        height: val,
                      };
                      if (selectedNode.type === 'circle' || selectedNode.type === 'hexagon') {
                        props.width = val;
                        props.radius = Math.round(val / 2);
                      }
                      onUpdateNode({ properties: props });
                    }}
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
            )}

            {(selectedNode.type === 'circle' || selectedNode.type === 'hexagon') && (
              <label className="flex flex-col text-white/60">
                Radius
                <NumericInput
                  step="1"
                  min={5}
                  value={
                    (selectedNode.properties?.radius as number) ??
                    ((selectedNode.properties?.width as number) ? Math.round((selectedNode.properties?.width as number) / 2) : 60)
                  }
                  onChange={(val) => {
                    onUpdateNode({
                      properties: {
                        ...selectedNode.properties,
                        radius: val,
                        width: val * 2,
                        height: val * 2,
                      },
                    });
                  }}
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            )}

            {selectedNode.type === 'star' && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Width
                    <NumericInput
                      step="1"
                      min={10}
                      value={
                        (selectedNode.properties?.width as number) ??
                        ((selectedNode.properties?.outerRadius as number) ? (selectedNode.properties?.outerRadius as number) * 2 : 120)
                      }
                      onChange={(val) => {
                        const outerR = Math.round(val / 2);
                        const oldOuter = (selectedNode.properties?.outerRadius as number) || 60;
                        const oldInner = (selectedNode.properties?.innerRadius as number) || 28;
                        const ratio = oldOuter > 0 ? oldInner / oldOuter : 0.45;
                        onUpdateNode({
                          properties: {
                            ...selectedNode.properties,
                            width: val,
                            height: val,
                            outerRadius: outerR,
                            innerRadius: Math.round(outerR * ratio),
                          },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Height
                    <NumericInput
                      step="1"
                      min={10}
                      value={
                        (selectedNode.properties?.height as number) ??
                        ((selectedNode.properties?.outerRadius as number) ? (selectedNode.properties?.outerRadius as number) * 2 : 120)
                      }
                      onChange={(val) => {
                        const outerR = Math.round(val / 2);
                        const oldOuter = (selectedNode.properties?.outerRadius as number) || 60;
                        const oldInner = (selectedNode.properties?.innerRadius as number) || 28;
                        const ratio = oldOuter > 0 ? oldInner / oldOuter : 0.45;
                        onUpdateNode({
                          properties: {
                            ...selectedNode.properties,
                            width: val,
                            height: val,
                            outerRadius: outerR,
                            innerRadius: Math.round(outerR * ratio),
                          },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <label className="flex flex-col text-white/60">
                  Star Points (Spikes)
                  <NumericInput
                    step="1"
                    min={3}
                    max={20}
                    value={(selectedNode.properties?.points as number) ?? 5}
                    onChange={(val) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, points: Math.max(3, Math.min(20, Math.round(val))) },
                      })
                    }
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Outer Radius
                    <NumericInput
                      step="1"
                      min={5}
                      value={(selectedNode.properties?.outerRadius as number) ?? 60}
                      onChange={(val) => {
                        onUpdateNode({
                          properties: {
                            ...selectedNode.properties,
                            outerRadius: val,
                            width: val * 2,
                            height: val * 2,
                          },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Inner Radius
                    <NumericInput
                      step="1"
                      min={2}
                      value={(selectedNode.properties?.innerRadius as number) ?? 28}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, innerRadius: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
              </div>
            )}

            {selectedNode.type === 'pointLight' && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Width
                    <NumericInput
                      step="1"
                      min={10}
                      value={
                        (selectedNode.properties?.width as number) ??
                        ((selectedNode.properties?.radius as number) ? (selectedNode.properties?.radius as number) * 2 : 200)
                      }
                      onChange={(val) => {
                        onUpdateNode({
                          properties: {
                            ...selectedNode.properties,
                            width: val,
                            height: val,
                            radius: Math.round(val / 2),
                          },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Height
                    <NumericInput
                      step="1"
                      min={10}
                      value={
                        (selectedNode.properties?.height as number) ??
                        ((selectedNode.properties?.radius as number) ? (selectedNode.properties?.radius as number) * 2 : 200)
                      }
                      onChange={(val) => {
                        onUpdateNode({
                          properties: {
                            ...selectedNode.properties,
                            width: val,
                            height: val,
                            radius: Math.round(val / 2),
                          },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <label className="flex flex-col text-white/60">
                  Glow Radius
                  <NumericInput
                    step="1"
                    min={10}
                    max={1000}
                    value={
                      (selectedNode.properties?.radius as number) ??
                      ((selectedNode.properties?.width as number) ? Math.round((selectedNode.properties?.width as number) / 2) : 100)
                    }
                    onChange={(val) => {
                      onUpdateNode({
                        properties: {
                          ...selectedNode.properties,
                          radius: val,
                          width: val * 2,
                          height: val * 2,
                        },
                      });
                    }}
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col text-white/60">
                  <div className="flex justify-between items-center">
                    <span>Intensity</span>
                    <span className="font-mono text-xs">{(((selectedNode.properties?.intensity as number) ?? 1.0)).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={(selectedNode.properties?.intensity as number) ?? 1.0}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, intensity: Number(e.target.value) },
                      })
                    }
                    className="accent-[#00e5ff] mt-1"
                  />
                </label>
              </div>
            )}

            {selectedNode.type === 'beamLight' && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Beam Length
                    <NumericInput
                      step="1"
                      min={10}
                      value={(selectedNode.properties?.length as number) ?? (selectedNode.properties?.height as number) ?? 320}
                      onChange={(val) => {
                        onUpdateNode({
                          properties: { ...selectedNode.properties, length: val, height: val },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Beam Thickness
                    <NumericInput
                      step="1"
                      min={5}
                      value={(selectedNode.properties?.width as number) ?? 70}
                      onChange={(val) => {
                        onUpdateNode({
                          properties: { ...selectedNode.properties, width: val },
                        });
                      }}
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <label className="flex flex-col text-white/60">
                  <div className="flex justify-between items-center">
                    <span>Intensity</span>
                    <span className="font-mono text-xs">{(((selectedNode.properties?.intensity as number) ?? 1.0)).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={(selectedNode.properties?.intensity as number) ?? 1.0}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, intensity: Number(e.target.value) },
                      })
                    }
                    className="accent-[#ff007f] mt-1"
                  />
                </label>
              </div>
            )}

            {selectedNode.type === 'audioSpectrum' && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Spectrum Width
                    <NumericInput
                      step="1"
                      min={50}
                      value={(selectedNode.properties?.width as number) ?? 420}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, width: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Peak Height
                    <NumericInput
                      step="1"
                      min={20}
                      value={(selectedNode.properties?.height as number) ?? 120}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, height: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Render Mode
                    <select
                      value={(selectedNode.properties?.mode as string) ?? 'bars'}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, mode: e.target.value },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono cursor-pointer"
                    >
                      <option value="bars">Bars</option>
                      <option value="curve">Curve</option>
                      <option value="radial">Radial</option>
                    </select>
                  </label>
                  <label className="flex flex-col text-white/60">
                    Bands (8 - 64)
                    <NumericInput
                      step="4"
                      min={8}
                      max={64}
                      value={(selectedNode.properties?.bands as number) ?? 32}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, bands: Math.round(val) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>

                {/* Frequency Analysis Focus & Range */}
                <div className="flex flex-col gap-1 text-white/70 bg-white/[0.03] p-2.5 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white/90">Frequency Focus</span>
                    <span className="font-mono text-[10px] text-[#00e5ff]">
                      {((selectedNode.properties?.minFreq as number) ?? 40)}Hz - {((selectedNode.properties?.maxFreq as number) ?? 14000)}Hz
                    </span>
                  </div>
                  <select
                    value={(selectedNode.properties?.frequencyBand as string) || 'full'}
                    onChange={(e) => {
                      const band = e.target.value;
                      let minF = (selectedNode.properties?.minFreq as number) ?? 40;
                      let maxF = (selectedNode.properties?.maxFreq as number) ?? 14000;
                      if (band === 'full') {
                        minF = 40;
                        maxF = 14000;
                      } else if (band === 'bass') {
                        minF = 20;
                        maxF = 250;
                      } else if (band === 'lowMids') {
                        minF = 250;
                        maxF = 1000;
                      } else if (band === 'highMids') {
                        minF = 1000;
                        maxF = 4000;
                      } else if (band === 'treble') {
                        minF = 4000;
                        maxF = 16000;
                      }
                      onUpdateNode({
                        properties: {
                          ...selectedNode.properties,
                          frequencyBand: band,
                          minFreq: minF,
                          maxFreq: maxF,
                        },
                      });
                    }}
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono cursor-pointer"
                  >
                    <option value="full">Full Spectrum (20 Hz - 14 kHz)</option>
                    <option value="bass">Sub & Bass (20 Hz - 250 Hz)</option>
                    <option value="lowMids">Low Mids (250 Hz - 1 kHz)</option>
                    <option value="highMids">High Mids (1 kHz - 4 kHz)</option>
                    <option value="treble">Treble & Highs (4 kHz - 16 kHz)</option>
                    <option value="custom">Custom Range (Manual Hz)</option>
                  </select>

                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                    <label className="flex flex-col text-white/60 text-[11px]">
                      Min Freq (Hz)
                      <NumericInput
                        step="10"
                        min={20}
                        max={20000}
                        value={(selectedNode.properties?.minFreq as number) ?? 40}
                        onChange={(val) => {
                          onUpdateNode({
                            properties: {
                              ...selectedNode.properties,
                              minFreq: Math.round(val),
                              frequencyBand: 'custom',
                            },
                          });
                        }}
                        className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                      />
                    </label>
                    <label className="flex flex-col text-white/60 text-[11px]">
                      Max Freq (Hz)
                      <NumericInput
                        step="50"
                        min={20}
                        max={20000}
                        value={(selectedNode.properties?.maxFreq as number) ?? 14000}
                        onChange={(val) => {
                          onUpdateNode({
                            properties: {
                              ...selectedNode.properties,
                              maxFreq: Math.round(val),
                              frequencyBand: 'custom',
                            },
                          });
                        }}
                        className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                      />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Bar Gap (px)
                    <NumericInput
                      step="1"
                      min={0}
                      max={20}
                      value={(selectedNode.properties?.gap as number) ?? 3}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, gap: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Gain ({((selectedNode.properties?.gain as number) ?? 1.0).toFixed(1)}x)
                    <NumericInput
                      step="0.1"
                      min={0.2}
                      max={4.0}
                      value={(selectedNode.properties?.gain as number) ?? 1.0}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, gain: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Decay ({((selectedNode.properties?.decay as number) ?? 0.88).toFixed(2)})
                    <NumericInput
                      step="0.02"
                      min={0.5}
                      max={0.99}
                      value={(selectedNode.properties?.decay as number) ?? 0.88}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, decay: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Attack ({((selectedNode.properties?.attack as number) ?? 0.75).toFixed(2)})
                    <NumericInput
                      step="0.05"
                      min={0.1}
                      max={1.0}
                      value={(selectedNode.properties?.attack as number) ?? 0.75}
                      onChange={(val) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, attack: val },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
              </div>
            )}

            {selectedNode.type !== 'group' && (
              <label className="flex flex-col text-white/60">
                Color
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={toValidHexColor(selectedNode.properties?.color, '#00e5ff')}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, color: e.target.value },
                      })
                    }
                    className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={(selectedNode.properties?.color as string) ?? ''}
                    placeholder="#00e5ff"
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, color: e.target.value },
                      })
                    }
                    className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </div>
              </label>
            )}

            {/* Blend Mode */}
            <label className="flex flex-col text-white/60">
              Blend Mode
              <select
                value={selectedNode.blendMode || 'normal'}
                onChange={(e) =>
                  onUpdateNode({
                    blendMode: e.target.value as BlendModeType,
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
              >
                <option value="normal">Normal</option>
                <option value="add">Add (Additive Glow)</option>
                <option value="screen">Screen (Lighten)</option>
                <option value="multiply">Multiply (Darken)</option>
              </select>
            </label>
          </div>

          {/* Delete Node Button */}
          {onRemoveNode && (
            <button
              onClick={() => onRemoveNode(selectedNode.uid)}
              className="mt-2 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Node
            </button>
          )}
        </div>
      ) : (
        /* 4. EMPTY STATE */
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-12">
          <MousePointerClick className="w-8 h-8 mb-2 text-white/60" />
          <div className="text-xs italic leading-relaxed text-white/80">
            {activeTab === 'timeline'
              ? timelineMode === 'shaders'
                ? 'Click a shader block in timeline or use Shader (S) tool to place and inspect.'
                : 'Click a note or timeline trigger to inspect properties.'
              : 'Select an object in Scene tab or Live Preview to edit it.'}
          </div>
        </div>
      )}
    </aside>
  );
}
