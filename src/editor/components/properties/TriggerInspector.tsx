import React from 'react';
import { Zap, Layers, Trash2 } from 'lucide-react';
import type { TriggerData, TriggerActionType, EasingType } from '../../../engine/types';
import { NumericInput } from '../NumericInput';
import { toValidHexColor } from './propertyUtils';

export interface TriggerInspectorProps {
  selectedTrigger: TriggerData | null;
  selectedTriggers: TriggerData[];
  onUpdateTrigger: (trigger: TriggerData) => void;
  onRemoveTrigger: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
}

export function TriggerInspector({
  selectedTrigger,
  selectedTriggers,
  onUpdateTrigger,
  onRemoveTrigger,
  onRemoveBatch,
}: TriggerInspectorProps) {
  // Batch selection mode
  if (selectedTriggers && selectedTriggers.length > 1) {
    return (
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
            onRemoveBatch?.(new Set(), ids, new Set(), new Set());
          }}
          className="mt-2 w-full py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold flex items-center justify-center gap-1.5 border border-red-500/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete {selectedTriggers.length} Triggers (Del)
        </button>
      </div>
    );
  }

  // Single trigger selection mode
  if (!selectedTrigger) return null;

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-bold uppercase tracking-wider text-[#ffea00] flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" /> Trigger FX
        </span>
        <span className="font-mono text-[10px] text-white/40">{selectedTrigger.id}</span>
      </div>

      {/* 1. Trigger ID (Integer Numeric Input) */}
      <label className="flex flex-col gap-1 text-white/70">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-yellow-400">Trigger ID</span>
          <span className="text-[10px] text-white/40 font-mono">
            {selectedTrigger.targetId !== undefined && selectedTrigger.targetId !== 'all'
              ? `ID: ${selectedTrigger.targetId}`
              : 'ID: 0'}
          </span>
        </div>
        <NumericInput
          step="1"
          min={0}
          value={typeof selectedTrigger.targetId === 'number' ? selectedTrigger.targetId : 0}
          onChange={(val) =>
            onUpdateTrigger({
              ...selectedTrigger,
              targetId: Math.max(0, Math.round(val)),
            })
          }
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#ffea00] outline-none"
        />
        <span className="text-[10px] text-white/40">
          Afecta a todos los objetos con este Trigger ID.
        </span>
      </label>

      {/* 2. Timeline Layer */}
      <label className="flex flex-col gap-1 text-white/70">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-yellow-400">Timeline Layer</span>
          <span className="text-[10px] text-yellow-400/70 font-mono">
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
          Solo se muestra en el Timeline cuando este layer está activo.
        </span>
      </label>

      {/* 3. Trigger Time */}
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

      {/* 4. Duration */}
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

      {/* 5. Easing (if duration > 0) */}
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

      {/* 6. Action Type Selector */}
      <label className="flex flex-col gap-1 text-white/70">
        Action Type
        <select
          value={selectedTrigger.action}
          onChange={(e) => {
            const action = e.target.value as TriggerActionType;
            let defaultProps: Record<string, number | string | boolean> = {};
            if (action === 'pos') {
              defaultProps = { x: 0, y: 0 };
            } else if (action === 'rot') {
              defaultProps = { rotation: 0 };
            } else if (action === 'scale') {
              defaultProps = { scale: 1.25, scaleX: 1.25, scaleY: 1.25 };
            } else if (action === 'color') {
              defaultProps = { color: '#ff007f', opacity: 1 };
            } else if (action === 'pulse') {
              defaultProps = { band: 'bass', multiplier: 1.5 };
            }
            onUpdateTrigger({
              ...selectedTrigger,
              action,
              properties: defaultProps,
            });
          }}
          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#ffea00] font-mono cursor-pointer"
        >
          <option value="pos">Position (Pos)</option>
          <option value="rot">Rotation (Rot)</option>
          <option value="scale">Scale</option>
          <option value="color">Color</option>
          <option value="pulse">Audio Pulse (FFT Band)</option>
        </select>
      </label>

      {/* 7. Action Parameters Form */}
      <div className="p-2.5 bg-black/40 rounded border border-white/10 flex flex-col gap-2">
        <span className="text-[10px] uppercase font-mono font-bold text-white/50">Action Parameters</span>

        {/* Pos (X & Y) */}
        {selectedTrigger.action === 'pos' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col text-white/60">
              Pos X
              <NumericInput
                step="10"
                value={(selectedTrigger.properties.x as number) ?? 0}
                onChange={(val) =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    properties: {
                      ...selectedTrigger.properties,
                      x: val,
                    },
                  })
                }
                className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
              />
            </label>
            <label className="flex flex-col text-white/60">
              Pos Y
              <NumericInput
                step="10"
                value={(selectedTrigger.properties.y as number) ?? 0}
                onChange={(val) =>
                  onUpdateTrigger({
                    ...selectedTrigger,
                    properties: {
                      ...selectedTrigger.properties,
                      y: val,
                    },
                  })
                }
                className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
              />
            </label>
          </div>
        )}

        {/* Rot (degrees) */}
        {selectedTrigger.action === 'rot' && (
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
        )}

        {/* Scale */}
        {selectedTrigger.action === 'scale' && (
          <label className="flex flex-col text-white/60">
            Scale Factor
            <NumericInput
              step="0.1"
              min={0.01}
              value={(selectedTrigger.properties.scale as number) ?? (selectedTrigger.properties.scaleX as number) ?? 1.25}
              onChange={(val) =>
                onUpdateTrigger({
                  ...selectedTrigger,
                  properties: {
                    ...selectedTrigger.properties,
                    scale: val,
                    scaleX: val,
                    scaleY: val,
                  },
                })
              }
              className="mt-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-white font-mono"
            />
          </label>
        )}

        {/* Color */}
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

        {/* Pulse */}
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
      </div>

      {/* Delete Button */}
      <button
        onClick={() => onRemoveTrigger(selectedTrigger.id)}
        className="mt-2 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/40 flex items-center justify-center gap-2 transition-colors font-semibold cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete Trigger
      </button>
    </div>
  );
}
