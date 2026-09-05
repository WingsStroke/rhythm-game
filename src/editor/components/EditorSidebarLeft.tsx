import React, { useState } from 'react';
import { Settings2, SlidersHorizontal, Layers } from 'lucide-react';
import type { LevelData, SceneNodeData } from '../../engine/types';
import { SceneOutliner } from './SceneOutliner';

interface EditorSidebarLeftProps {
  level: LevelData;
  onChangeLevel: (newLevel: LevelData) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddNode: (node: SceneNodeData) => void;
  onRemoveNode: (nodeId: string) => void;
}

export function EditorSidebarLeft({
  level,
  onChangeLevel,
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onRemoveNode,
}: EditorSidebarLeftProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'scene'>('config');

  return (
    <aside className="w-64 border-r border-white/10 bg-black/20 flex flex-col shrink-0 select-none overflow-hidden">
      {/* Tab Switcher: Config vs Scene */}
      <div className="flex border-b border-white/10 bg-black/40 text-xs font-mono">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-b-2 font-semibold ${
            activeTab === 'config'
              ? 'border-[#00e5ff] text-[#00e5ff] bg-white/[0.04]'
              : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.02]'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Song & Pads</span>
        </button>
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors border-b-2 font-semibold ${
            activeTab === 'scene'
              ? 'border-[#00e5ff] text-[#00e5ff] bg-white/[0.04]'
              : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.02]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Escena ({level.visual?.nodes?.length || 0})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'config' ? (
        <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" /> Song Config
            </h2>

            <div className="flex flex-col gap-2.5">
              <label className="text-xs text-white/60">
                Title
                <input
                  type="text"
                  value={level.song.title}
                  onChange={(e) =>
                    onChangeLevel({ ...level, song: { ...level.song, title: e.target.value } })
                  }
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-[#00e5ff] outline-none"
                />
              </label>
              <label className="text-xs text-white/60">
                BPM
                <input
                  type="number"
                  value={level.timing.bpm}
                  onChange={(e) =>
                    onChangeLevel({
                      ...level,
                      timing: { ...level.timing, bpm: Number(e.target.value) },
                      song: { ...level.song, bpm: Number(e.target.value) },
                    })
                  }
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-[#00e5ff] outline-none font-mono"
                />
              </label>
              <label className="text-xs text-white/60">
                Duration (s)
                <input
                  type="number"
                  value={level.song.duration}
                  onChange={(e) =>
                    onChangeLevel({ ...level, song: { ...level.song, duration: Number(e.target.value) } })
                  }
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-[#00e5ff] outline-none font-mono"
                />
              </label>
            </div>

            <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mt-6 mb-2.5 flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Pads ({level.pads.length})
            </h2>
            <div className="flex flex-col gap-1.5">
              {level.pads.map((pad) => (
                <div
                  key={pad.id}
                  className="p-2 bg-white/[0.03] border border-white/10 rounded text-xs flex items-center gap-2"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pad.color }} />
                  <div className="flex flex-col">
                    <span className="font-mono text-white/80 font-medium">{pad.label}</span>
                    <span className="text-[10px] text-white/40 uppercase font-mono">{pad.role || 'custom'}</span>
                  </div>
                  <span className="ml-auto text-white/30 font-mono">[{pad.keyHint}]</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-white/30 border-t border-white/10 pt-3 flex flex-col gap-0.5 font-mono mt-4">
            <span className="font-bold text-white/40 mb-0.5">Atajos:</span>
            <span>V - Select / Move</span>
            <span>B - Draw Note / Trigger</span>
            <span>E - Eraser</span>
            <span>Del - Delete</span>
            <span>Space - Play / Pause</span>
            <span>Ctrl+Z - Deshacer</span>
            <span>Ctrl+Y - Rehacer</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <SceneOutliner
            nodes={level.visual?.nodes || []}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onAddNode={onAddNode}
            onRemoveNode={onRemoveNode}
          />
        </div>
      )}
    </aside>
  );
}
