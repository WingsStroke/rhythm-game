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
  selectedNode: SceneNodeData | null;
  selectedTrigger: TriggerData | null;
  nodes: SceneNodeData[];
  pads: PadConfig[];
  activeTab: 'timeline' | 'preview';
  onUpdateEvent: (event: PadEvent) => void;
  onRemoveEvent: (id: string) => void;
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
  selectedNode,
  selectedTrigger,
  nodes,
  pads,
  activeTab,
  onUpdateEvent,
  onRemoveEvent,
  onUpdateNode,
  onRemoveNode,
  onUpdateTrigger,
  onRemoveTrigger,
}: EditorPropertiesPanelProps) {
  return (
    <aside className="w-72 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col h-full min-h-0 overflow-y-auto select-none custom-scrollbar">
      {/* 1. PAD EVENT PROPERTIES */}
      {selectedEvent ? (
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
                      .filter((n) => n.id !== null && n.id !== undefined && n.id !== '')
                      .map((n) => Number(n.id))
                  )
                )
                  .sort((a, b) => a - b)
                  .map((assignedId) => {
                    const matchedNames = nodes
                      .filter((n) => Number(n.id) === assignedId)
                      .map((n) => n.name || n.uid || n.id)
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
              value={selectedNode.name || (typeof selectedNode.id === 'string' ? selectedNode.id : '')}
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
                {selectedNode.id === null || selectedNode.id === undefined || selectedNode.id === ''
                  ? 'null (No ID)'
                  : `ID: ${selectedNode.id}`}
              </span>
            </div>
            <input
              type="number"
              value={selectedNode.id !== null && selectedNode.id !== undefined ? selectedNode.id : ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                onUpdateNode({ id: val === '' ? null : Number(val) });
              }}
              placeholder="null (No ID assigned)"
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00ff9d] outline-none placeholder:text-white/30"
            />
            <span className="text-[10px] text-white/40">
              Multiple objects can share the same ID to be controlled by a single Trigger.
            </span>
          </label>

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
            Opacity ({((selectedNode.transform?.opacity ?? 1)).toFixed(2)})
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
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
            {selectedNode.type === 'rectangle' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col text-white/60">
                  Width
                  <input
                    type="number"
                    value={(selectedNode.properties?.width as number) ?? 100}
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
                    value={(selectedNode.properties?.height as number) ?? 100}
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

            {selectedNode.type === 'circle' && (
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
              onClick={() =>
                onRemoveNode(
                  selectedNode.uid ||
                    (typeof selectedNode.id === 'string' ? selectedNode.id : selectedNode.name || 'node')
                )
              }
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
