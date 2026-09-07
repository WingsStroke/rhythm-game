import React from 'react';
import { Activity, Layers, Trash2, MousePointerClick, Zap } from 'lucide-react';
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
} from '../../engine/types';

interface EditorPropertiesPanelProps {
  selectedEvent: PadEvent | null;
  selectedEvents?: PadEvent[];
  selectedNode: SceneNodeData | null;
  selectedNodes?: SceneNodeData[];
  selectedTrigger: TriggerData | null;
  selectedTriggers: TriggerData[];
  nodes: SceneNodeData[];
  pads: PadConfig[];
  activeTab: 'timeline' | 'preview';
  onUpdateEvent: (event: PadEvent) => void;
  onUpdateEventsBatch?: (events: PadEvent[]) => void;
  onRemoveEvent: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>) => void;
  onUpdateNode: (updates: Partial<SceneNodeData>) => void;
  onRemoveNode?: (id: string) => void;
  onUpdateTrigger: (trigger: TriggerData) => void;
  onRemoveTrigger: (id: string) => void;
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
  nodes,
  pads,
  activeTab,
  onUpdateEvent,
  onUpdateEventsBatch,
  onRemoveEvent,
  onRemoveBatch,
  onUpdateNode,
  onRemoveNode,
  onUpdateTrigger,
  onRemoveTrigger,
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
              <input
                type="number"
                step="0.01"
                value={selectedEvent.targetTime}
                onChange={(e) =>
                  onUpdateEvent({
                    ...selectedEvent,
                    targetTime: Math.max(0, Number(e.target.value)),
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
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={selectedEvent.duration ?? 1.0}
                onChange={(e) =>
                  onUpdateEvent({
                    ...selectedEvent,
                    duration: Math.max(0.05, Number(e.target.value)),
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
            <input
              type="number"
              min={1}
              max={99}
              value={selectedTrigger.layer ?? 1}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                onUpdateTrigger({ ...selectedTrigger, layer: val });
              }}
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
              <input
                type="number"
                step="0.01"
                value={selectedTrigger.time}
                onChange={(e) =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    time: Math.max(0, Number(e.target.value)),
                  })
                }
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
            <input
              type="number"
              step="0.05"
              min="0"
              value={selectedTrigger.duration}
              onChange={(e) =>
                onUpdateTrigger({
                  ...selectedTrigger,
                  duration: Math.max(0, Number(e.target.value)),
                })
              }
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
                  <input
                    type="number"
                    step="0.1"
                    value={(selectedTrigger.properties.scaleX as number) ?? 1}
                    onChange={(e) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: {
                          ...selectedTrigger.properties,
                          scaleX: Number(e.target.value),
                          scaleY: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col text-white/60">
                  Rot (deg)
                  <input
                    type="number"
                    step="15"
                    value={Math.round((((selectedTrigger.properties.rotation as number) ?? 0) * 180) / Math.PI)}
                    onChange={(e) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: {
                          ...selectedTrigger.properties,
                          rotation: (Number(e.target.value) * Math.PI) / 180,
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
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="3"
                    value={(selectedTrigger.properties.multiplier as number) ?? 1.5}
                    onChange={(e) =>
                      onUpdateTrigger({
                        ...selectedTrigger,
                        properties: { ...selectedTrigger.properties, multiplier: Number(e.target.value) },
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
            className="mt-2 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Trigger
          </button>
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
            <input
              type="number"
              min={1}
              max={99}
              value={selectedNode.layer ?? 1}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                onUpdateNode({ layer: val });
              }}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
            />
            <span className="text-[10px] text-white/40">
              Only rendered when Timeline Visuals mode is set to this layer.
            </span>
          </label>

          {/* 3. Scene Layer */}
          <div className="flex flex-col gap-1 text-white/70">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Scene Layer</span>
              <span className="text-[10px] text-white/40 font-mono">
                {selectedNode.layerId === 'sceneFront' ? 'Foreground (zIndex 22)' : 'Background (zIndex 2)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => onUpdateNode({ layerId: 'sceneBack' })}
                className={`px-2 py-1 rounded font-mono uppercase text-[10px] font-semibold border transition-colors cursor-pointer text-center ${
                  selectedNode.layerId !== 'sceneFront'
                    ? 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/50 shadow-[0_0_8px_rgba(0,255,157,0.2)]'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
              >
                Background
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentOpacity = selectedNode.transform?.opacity ?? 1;
                  const safeOpacity = Math.min(0.35, currentOpacity);
                  const safeBlend = (selectedNode.blendMode === 'screen' || selectedNode.blendMode === 'add') ? selectedNode.blendMode : 'add';
                  onUpdateNode({
                    layerId: 'sceneFront',
                    blendMode: safeBlend,
                    transform: {
                      ...selectedNode.transform,
                      opacity: safeOpacity,
                    },
                  });
                }}
                className={`px-2 py-1 rounded font-mono uppercase text-[10px] font-semibold border transition-colors cursor-pointer text-center ${
                  selectedNode.layerId === 'sceneFront'
                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff]/50 shadow-[0_0_8px_rgba(0,229,255,0.2)]'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
              >
                Foreground
              </button>
            </div>
            {selectedNode.layerId === 'sceneFront' && (
              <div className="mt-1 p-2 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/20 text-[10px] text-[#00e5ff]/90 leading-tight font-mono">
                Readability Safeguard: Foreground layer renders above gameplay pads. Opacity is clamped to max 0.35 with Add/Screen blend mode.
              </div>
            )}
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
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={selectedNode.lifespan.startTime}
                      onChange={(e) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            startTime: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Duration (s)
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={selectedNode.lifespan.duration}
                      onChange={(e) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            duration: Math.max(0.1, Number(e.target.value)),
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
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={selectedNode.lifespan.fadeInMs ?? 0}
                      onChange={(e) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            fadeInMs: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Fade Out (ms)
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={selectedNode.lifespan.fadeOutMs ?? 0}
                      onChange={(e) =>
                        onUpdateNode({
                          lifespan: {
                            ...selectedNode.lifespan!,
                            fadeOutMs: Math.max(0, Number(e.target.value)),
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
                <input
                  type="number"
                  value={selectedNode.transform?.x ?? 0}
                  onChange={(e) =>
                    onUpdateNode({
                      transform: { ...selectedNode.transform, x: Number(e.target.value) },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
                />
              </label>
              <label className="flex flex-col text-white/60">
                Y
                <input
                  type="number"
                  value={selectedNode.transform?.y ?? 0}
                  onChange={(e) =>
                    onUpdateNode({
                      transform: { ...selectedNode.transform, y: Number(e.target.value) },
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
              <input
                type="number"
                step="0.1"
                value={selectedNode.transform?.scaleX ?? 1}
                onChange={(e) =>
                  onUpdateNode({
                    transform: {
                      ...selectedNode.transform,
                      scaleX: Number(e.target.value),
                      scaleY: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none"
              />
            </label>
            <label className="flex flex-col text-white/60">
              Rotation (deg)
              <input
                type="number"
                step="15"
                value={Math.round((((selectedNode.transform?.rotation ?? 0) * 180) / Math.PI))}
                onChange={(e) =>
                  onUpdateNode({
                    transform: {
                      ...selectedNode.transform,
                      rotation: (Number(e.target.value) * Math.PI) / 180,
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
              {selectedNode.layerId === 'sceneFront' && (
                <span className="text-[10px] text-[#00e5ff] font-mono font-bold">Max 0.35 (Front Safeguard)</span>
              )}
            </div>
            <input
              type="range"
              min="0"
              max={selectedNode.layerId === 'sceneFront' ? 0.35 : 1}
              step="0.01"
              value={Math.min(selectedNode.layerId === 'sceneFront' ? 0.35 : 1, selectedNode.transform?.opacity ?? 1)}
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
            {(selectedNode.type === 'rectangle' || selectedNode.type === 'triangle' || selectedNode.type === 'diamond') && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col text-white/60">
                  Width
                  <input
                    type="number"
                    value={(selectedNode.properties?.width as number) ?? 120}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, width: Number(e.target.value) },
                      })
                    }
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <label className="flex flex-col text-white/60">
                  Height
                  <input
                    type="number"
                    value={(selectedNode.properties?.height as number) ?? 120}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, height: Number(e.target.value) },
                      })
                    }
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
              </div>
            )}

            {(selectedNode.type === 'circle' || selectedNode.type === 'hexagon') && (
              <label className="flex flex-col text-white/60">
                Radius
                <input
                  type="number"
                  value={(selectedNode.properties?.radius as number) ?? 60}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, radius: Number(e.target.value) },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            )}

            {selectedNode.type === 'star' && (
              <div className="flex flex-col gap-2">
                <label className="flex flex-col text-white/60">
                  Star Points (Spikes)
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={(selectedNode.properties?.points as number) ?? 5}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, points: Math.max(3, Math.min(20, Number(e.target.value))) },
                      })
                    }
                    className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Outer Radius
                    <input
                      type="number"
                      value={(selectedNode.properties?.outerRadius as number) ?? 60}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, outerRadius: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Inner Radius
                    <input
                      type="number"
                      value={(selectedNode.properties?.innerRadius as number) ?? 28}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, innerRadius: Number(e.target.value) },
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
                <label className="flex flex-col text-white/60">
                  Glow Radius
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={(selectedNode.properties?.radius as number) ?? 100}
                    onChange={(e) =>
                      onUpdateNode({
                        properties: { ...selectedNode.properties, radius: Number(e.target.value) },
                      })
                    }
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
                    <input
                      type="number"
                      value={(selectedNode.properties?.length as number) ?? 320}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, length: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Beam Thickness
                    <input
                      type="number"
                      value={(selectedNode.properties?.width as number) ?? 70}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, width: Number(e.target.value) },
                        })
                      }
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
                    <input
                      type="number"
                      value={(selectedNode.properties?.width as number) ?? 420}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, width: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Peak Height
                    <input
                      type="number"
                      value={(selectedNode.properties?.height as number) ?? 120}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, height: Number(e.target.value) },
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
                    <input
                      type="number"
                      min={8}
                      max={64}
                      step={4}
                      value={(selectedNode.properties?.bands as number) ?? 32}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, bands: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Bar Gap (px)
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={(selectedNode.properties?.gap as number) ?? 3}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, gap: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Gain ({((selectedNode.properties?.gain as number) ?? 1.0).toFixed(1)}x)
                    <input
                      type="number"
                      min={0.2}
                      max={4.0}
                      step={0.1}
                      value={(selectedNode.properties?.gain as number) ?? 1.0}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, gain: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col text-white/60">
                    Decay ({((selectedNode.properties?.decay as number) ?? 0.88).toFixed(2)})
                    <input
                      type="number"
                      min={0.5}
                      max={0.99}
                      step={0.02}
                      value={(selectedNode.properties?.decay as number) ?? 0.88}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, decay: Number(e.target.value) },
                        })
                      }
                      className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                    />
                  </label>
                  <label className="flex flex-col text-white/60">
                    Attack ({((selectedNode.properties?.attack as number) ?? 0.75).toFixed(2)})
                    <input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={(selectedNode.properties?.attack as number) ?? 0.75}
                      onChange={(e) =>
                        onUpdateNode({
                          properties: { ...selectedNode.properties, attack: Number(e.target.value) },
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
                value={selectedNode.blendMode || (selectedNode.layerId === 'sceneFront' ? 'add' : 'normal')}
                onChange={(e) =>
                  onUpdateNode({
                    blendMode: e.target.value as BlendModeType,
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
              >
                {selectedNode.layerId !== 'sceneFront' && <option value="normal">Normal</option>}
                <option value="add">Add (Additive Glow)</option>
                <option value="screen">Screen (Lighten)</option>
                {selectedNode.layerId !== 'sceneFront' && <option value="multiply">Multiply (Darken)</option>}
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
              ? 'Click a note or timeline trigger to inspect properties.'
              : 'Select an object in Scene tab or Live Preview to edit it.'}
          </div>
        </div>
      )}
    </aside>
  );
}
