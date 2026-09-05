import React from 'react';
import { Settings2, SlidersHorizontal } from 'lucide-react';
import type { LevelData } from '../../engine/types';

interface EditorSidebarLeftProps {
  level: LevelData;
  onChangeLevel: (newLevel: LevelData) => void;
}

export function EditorSidebarLeft({ level, onChangeLevel }: EditorSidebarLeftProps) {
  return (
    <aside className="w-56 border-r border-white/10 bg-black/20 p-4 overflow-y-auto shrink-0 flex flex-col justify-between select-none">
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

      <div className="text-[11px] text-white/30 border-t border-white/10 pt-3 flex flex-col gap-1 font-mono">
        <span>Shortcuts:</span>
        <span>V - Select / Move</span>
        <span>B - Draw Note</span>
        <span>E - Eraser</span>
        <span>Del - Delete Note</span>
        <span>Space - Play / Pause</span>
      </div>
    </aside>
  );
}
