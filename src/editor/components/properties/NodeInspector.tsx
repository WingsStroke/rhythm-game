import React from 'react';
import { Layers, Trash2 } from 'lucide-react';
import type { SceneNodeData, BlendModeType } from '../../../engine/types';
import { ALLOWED_FONT_FAMILIES } from '../../../engine/types';
import { NumericInput } from '../NumericInput';
import { toValidHexColor } from './propertyUtils';

export interface NodeInspectorProps {
  selectedNode: SceneNodeData | null;
  selectedNodes?: SceneNodeData[];
  onUpdateNode: (updates: Partial<SceneNodeData>) => void;
  onRemoveNode?: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
}

export function NodeInspector({
  selectedNode,
  selectedNodes,
  onUpdateNode,
  onRemoveNode,
  onRemoveBatch,
}: NodeInspectorProps) {
  // Batch selection mode
  if (selectedNodes && selectedNodes.length > 1) {
    return (
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
            onRemoveBatch?.(new Set(), new Set(), ids, new Set());
          }}
          className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete {selectedNodes.length} Objects (Del)
        </button>
      </div>
    );
  }

  // Single node selection mode
  if (!selectedNode) return null;

  return (
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

        {selectedNode.type === 'text' && (
          <div className="flex flex-col gap-2 p-2.5 rounded bg-white/[0.03] border border-white/10">
            <span className="font-semibold text-white/80">Typography Settings</span>
            <label className="flex flex-col text-white/60">
              Text Content
              <input
                type="text"
                value={(selectedNode.properties?.text as string) ?? 'New Text'}
                onChange={(e) =>
                  onUpdateNode({
                    properties: { ...selectedNode.properties, text: e.target.value },
                  })
                }
                className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col text-white/60">
                Font Family
                <select
                  value={(selectedNode.properties?.fontFamily as string) ?? 'Orbitron'}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, fontFamily: e.target.value },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono cursor-pointer"
                >
                  {ALLOWED_FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-white/60">
                Font Size (px)
                <NumericInput
                  step="2"
                  min={8}
                  max={256}
                  value={(selectedNode.properties?.fontSize as number) ?? 48}
                  onChange={(val) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, fontSize: val },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col text-white/60">
                Alignment
                <select
                  value={(selectedNode.properties?.align as string) ?? 'center'}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, align: e.target.value },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono cursor-pointer"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="flex flex-col text-white/60">
                Stroke Width
                <NumericInput
                  step="1"
                  min={0}
                  max={32}
                  value={(selectedNode.properties?.strokeWidth as number) ?? 0}
                  onChange={(val) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, strokeWidth: val },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            </div>
            <label className="flex flex-col text-white/60">
              Stroke Color
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={toValidHexColor(selectedNode.properties?.strokeColor, '#000000')}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, strokeColor: e.target.value },
                    })
                  }
                  className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent p-0"
                />
                <span className="font-mono text-xs text-white/80">
                  {toValidHexColor(selectedNode.properties?.strokeColor, '#000000')}
                </span>
              </div>
            </label>
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
  );
}
