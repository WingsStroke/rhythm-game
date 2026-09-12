import React from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import type { VisualEffect, VisualEffectScope, EasingType } from '../../../engine/types';
import { EffectRegistry } from '../../../engine/visual/effects/EffectRegistry';
import { NumericInput } from '../NumericInput';

export interface EffectInspectorProps {
  selectedEffect: VisualEffect | null;
  selectedEffects?: VisualEffect[];
  onUpdateEffect?: (effect: VisualEffect) => void;
  onRemoveEffect?: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
}

export function EffectInspector({
  selectedEffect,
  selectedEffects,
  onUpdateEffect,
  onRemoveEffect,
  onRemoveBatch,
}: EffectInspectorProps) {
  // Batch selection mode
  if (selectedEffects && selectedEffects.length > 1) {
    return (
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
    );
  }

  // Single effect selection mode
  if (!selectedEffect) return null;

  return (
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

      {/* Target: Trigger ID Numeric Input */}
      {selectedEffect.scope === 'object' && (
        <label className="flex flex-col gap-1 text-white/70">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Trigger ID (Target ID)</span>
            <span className="text-[10px] text-fuchsia-300 font-mono">
              ID: {selectedEffect.targetId !== undefined ? selectedEffect.targetId : (typeof selectedEffect.targetNodeId === 'number' ? selectedEffect.targetNodeId : 0)}
            </span>
          </div>
          <NumericInput
            step="1"
            min={0}
            value={selectedEffect.targetId !== undefined ? selectedEffect.targetId : (typeof selectedEffect.targetNodeId === 'number' ? selectedEffect.targetNodeId : 0)}
            onChange={(val) =>
              onUpdateEffect?.({
                ...selectedEffect,
                targetId: Math.max(0, Math.round(val)),
                targetNodeId: String(Math.max(0, Math.round(val))),
              })
            }
            className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-fuchsia-400 outline-none"
          />
          <span className="text-[10px] text-white/40">
            Afecta a todos los objetos con este Trigger ID.
          </span>
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

        {selectedEffect.type === 'grain' && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-white/60">
              <span>Grain Amount ({Number(selectedEffect.parameters.amount ?? 0.15).toFixed(2)})</span>
              <input
                type="range"
                min="0.02"
                max="0.80"
                step="0.02"
                value={Number(selectedEffect.parameters.amount ?? 0.15)}
                onChange={(e) =>
                  onUpdateEffect?.({
                    ...selectedEffect,
                    parameters: {
                      ...selectedEffect.parameters,
                      amount: Number(e.target.value),
                    },
                  })
                }
                className="accent-fuchsia-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-white/60">
              <span>Grain Speed ({Number(selectedEffect.parameters.speed ?? 1.0).toFixed(1)}x)</span>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={Number(selectedEffect.parameters.speed ?? 1.0)}
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
          </div>
        )}

        {selectedEffect.type === 'zoomBlur' && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-white/60">
              <span>Zoom Strength ({Number(selectedEffect.parameters.strength ?? 0.25).toFixed(2)})</span>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.05"
                value={Number(selectedEffect.parameters.strength ?? 0.25)}
                onChange={(e) =>
                  onUpdateEffect?.({
                    ...selectedEffect,
                    parameters: {
                      ...selectedEffect.parameters,
                      strength: Number(e.target.value),
                    },
                  })
                }
                className="accent-fuchsia-400"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-white/60">
                <span>Center X</span>
                <NumericInput
                  step="0.05"
                  min={0}
                  max={1}
                  value={Number(selectedEffect.parameters.centerX ?? 0.5)}
                  onChange={(val) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      parameters: { ...selectedEffect.parameters, centerX: val },
                    })
                  }
                  className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="flex flex-col gap-1 text-white/60">
                <span>Center Y</span>
                <NumericInput
                  step="0.05"
                  min={0}
                  max={1}
                  value={Number(selectedEffect.parameters.centerY ?? 0.5)}
                  onChange={(val) =>
                    onUpdateEffect?.({
                      ...selectedEffect,
                      parameters: { ...selectedEffect.parameters, centerY: val },
                    })
                  }
                  className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
                />
              </label>
            </div>
          </div>
        )}

        {selectedEffect.type === 'shake' && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-white/60">
              <span>Shake Amplitude ({Number(selectedEffect.parameters.amplitude ?? 0.02).toFixed(3)})</span>
              <input
                type="range"
                min="0.005"
                max="0.10"
                step="0.005"
                value={Number(selectedEffect.parameters.amplitude ?? 0.02)}
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
            <label className="flex flex-col gap-1 text-white/60">
              <span>Frequency ({Number(selectedEffect.parameters.frequency ?? 25.0).toFixed(0)} Hz)</span>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={Number(selectedEffect.parameters.frequency ?? 25.0)}
                onChange={(e) =>
                  onUpdateEffect?.({
                    ...selectedEffect,
                    parameters: {
                      ...selectedEffect.parameters,
                      frequency: Number(e.target.value),
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

        {/* Fade In & Out */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
          <label className="flex flex-col gap-1 text-white/60">
            <span>Fade In (s)</span>
            <NumericInput
              step="0.05"
              min={0}
              value={selectedEffect.fadeIn ?? 0}
              onChange={(val) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  fadeIn: Math.max(0, val),
                })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-white/60">
            <span>Fade In Easing</span>
            <select
              value={selectedEffect.fadeInEasing || 'linear'}
              onChange={(e) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  fadeInEasing: e.target.value as EasingType,
                })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono text-[11px] outline-none focus:border-fuchsia-400 cursor-pointer"
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
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-white/60">
            <span>Fade Out (s)</span>
            <NumericInput
              step="0.05"
              min={0}
              value={selectedEffect.fadeOut ?? 0}
              onChange={(val) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  fadeOut: Math.max(0, val),
                })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-white/60">
            <span>Fade Out Easing</span>
            <select
              value={selectedEffect.fadeOutEasing || 'linear'}
              onChange={(e) =>
                onUpdateEffect?.({
                  ...selectedEffect,
                  fadeOutEasing: e.target.value as EasingType,
                })
              }
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono text-[11px] outline-none focus:border-fuchsia-400 cursor-pointer"
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
        </div>
        <span className="text-[10px] text-white/40">
          Suaviza la entrada y salida de la intensidad del shader.
        </span>
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
  );
}
