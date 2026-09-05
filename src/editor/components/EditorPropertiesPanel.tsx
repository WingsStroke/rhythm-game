import React from 'react';
import { Activity, Layers, Trash2, MousePointerClick } from 'lucide-react';
import type { PadEvent, PadId, PadBehavior, PadConfig, SceneNodeData } from '../../engine/types';

interface EditorPropertiesPanelProps {
  selectedEvent: PadEvent | null;
  selectedNode: SceneNodeData | null;
  pads: PadConfig[];
  activeTab: 'timeline' | 'preview';
  onUpdateEvent: (event: PadEvent) => void;
  onRemoveEvent: (id: string) => void;
  onUpdateNode: (updates: Partial<SceneNodeData>) => void;
}

export function EditorPropertiesPanel({
  selectedEvent,
  selectedNode,
  pads,
  activeTab,
  onUpdateEvent,
  onRemoveEvent,
  onUpdateNode,
}: EditorPropertiesPanelProps) {
  return (
    <aside className="w-64 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col overflow-y-auto select-none">
      {/* PAD EVENT PROPERTIES */}
      {selectedEvent ? (
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#00e5ff] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Properties
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
                    targetTime: Math.max(0, Number((selectedEvent.targetTime - 0.1).toFixed(3))),
                  })
                }
                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[11px] font-mono"
              >
                -0.1s
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
                className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono text-center"
              />
              <button
                onClick={() =>
                  onUpdateEvent({
                    ...selectedEvent,
                    targetTime: Number((selectedEvent.targetTime + 0.1).toFixed(3)),
                  })
                }
                className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[11px] font-mono"
              >
                +0.1s
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
      ) : selectedNode ? (
        /* SCENE NODE PROPERTIES */
        <div className="flex flex-col gap-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="font-bold uppercase tracking-wider text-[#00ff9d] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Properties
            </span>
            <span className="font-mono text-[#00e5ff]">{selectedNode.id}</span>
          </div>

          {/* Transform */}
          <div className="flex flex-col gap-2">
            <h3 className="text-white/40 uppercase">Transform</h3>
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
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:border-[#00e5ff] outline-none"
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
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:border-[#00e5ff] outline-none"
                />
              </label>
            </div>
          </div>

          {/* Dimensions */}
          <div className="flex flex-col gap-2">
            <h3 className="text-white/40 uppercase">Properties</h3>
            {selectedNode.properties?.width !== undefined && (
              <label className="flex flex-col text-white/60">
                Width
                <input
                  type="number"
                  value={(selectedNode.properties.width as number) ?? 0}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, width: Number(e.target.value) },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:border-[#00e5ff] outline-none"
                />
              </label>
            )}
            {selectedNode.properties?.height !== undefined && (
              <label className="flex flex-col text-white/60">
                Height
                <input
                  type="number"
                  value={(selectedNode.properties.height as number) ?? 0}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, height: Number(e.target.value) },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:border-[#00e5ff] outline-none"
                />
              </label>
            )}
            {selectedNode.properties?.color !== undefined && (
              <label className="flex flex-col text-white/60">
                Color
                <input
                  type="text"
                  value={(selectedNode.properties.color as string) ?? ''}
                  onChange={(e) =>
                    onUpdateNode({
                      properties: { ...selectedNode.properties, color: e.target.value },
                    })
                  }
                  className="mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white font-mono focus:border-[#00e5ff] outline-none"
                />
              </label>
            )}
          </div>
        </div>
      ) : (
        /* EMPTY STATE */
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-12">
          <MousePointerClick className="w-8 h-8 mb-2 text-white/60" />
          <div className="text-xs italic leading-relaxed text-white/80">
            {activeTab === 'timeline'
              ? 'Click any note in the Timeline to inspect and edit its properties.'
              : 'Click a scene node in Live Preview to inspect and edit its properties.'}
          </div>
        </div>
      )}
    </aside>
  );
}
