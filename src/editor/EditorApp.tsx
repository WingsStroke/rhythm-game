import { useState } from 'react';
import { Timeline } from './Timeline';
import type { LevelData, Note, PadId } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';

// A mock initial level data
const initialLevel: LevelData = {
  formatVersion: 1,
  metadata: {
    id: 'editor-level-1',
    name: 'New Level',
    difficulty: 'Normal',
    author: 'Editor',
  },
  song: {
    id: 'song-1',
    title: 'New Song',
    artist: 'Unknown',
    bpm: 120,
    offset: 0,
    duration: 120,
  },
  pads: BeatmapGenerator.defaultPads(),
  notes: [],
  timing: {
    bpm: 120,
    offset: 0,
    windows: { perfect: 0.05, good: 0.1, miss: 0.2 },
  },
  visual: {
    nodes: [],
    animations: [],
    triggers: [],
  },
};

export function EditorApp({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState<LevelData>(initialLevel);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(level, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "level.json");
    dlAnchorElem.click();
  };

  const addNote = (time: number, padId: PadId) => {
    setLevel(prev => {
      const newNotes = [...prev.notes, { time, pad: padId, type: 'tap' }];
      newNotes.sort((a, b) => a.time - b.time); // Keep notes sorted
      return { ...prev, notes: newNotes as Note[] };
    });
  };

  const removeNote = (index: number) => {
    setLevel(prev => {
      const newNotes = [...prev.notes];
      newNotes.splice(index, 1);
      return { ...prev, notes: newNotes };
    });
  };

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0f0f15] text-white">
      
      {/* Toolbar */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/40">
        <div className="flex items-center gap-4">
          <span className="font-bold text-xl tracking-wider text-[#00e5ff]">BEATMAP EDITOR</span>
          <div className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">BPM: {level.timing.bpm}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="px-4 py-1.5 bg-[#00e5ff]/20 text-[#00e5ff] rounded hover:bg-[#00e5ff]/40 transition-colors text-sm font-semibold">
            Export JSON
          </button>
          <button onClick={onExit} className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40 transition-colors text-sm font-semibold">
            Exit
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Config) */}
        <aside className="w-64 border-r border-white/10 bg-black/20 p-4 overflow-y-auto">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Level Config</h2>
          
          <div className="flex flex-col gap-3">
            <label className="text-sm text-white/70">
              Title
              <input type="text" value={level.song.title} onChange={e => setLevel({...level, song: {...level.song, title: e.target.value}})} className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#00e5ff] outline-none" />
            </label>
            <label className="text-sm text-white/70">
              BPM
              <input type="number" value={level.timing.bpm} onChange={e => setLevel({...level, timing: {...level.timing, bpm: Number(e.target.value)}})} className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#00e5ff] outline-none" />
            </label>
          </div>

          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mt-8 mb-4">Pads ({level.pads.length})</h2>
          <div className="flex flex-col gap-2">
            {level.pads.map((pad, idx) => (
              <div key={pad.id} className="p-2 bg-white/5 border border-white/10 rounded text-xs flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pad.color }} />
                <span className="font-mono">{pad.id}</span>
                <span className="opacity-50">({pad.label})</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Canvas (Timeline) */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-black/60">
          <Timeline level={level} onAddNote={addNote} onRemoveNote={removeNote} />
        </main>

        {/* Right Sidebar (Properties) */}
        <aside className="w-64 border-l border-white/10 bg-black/20 p-4">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Properties</h2>
          <div className="text-sm text-white/40 italic">Select an object to edit its properties.</div>
        </aside>

      </div>
    </div>
  );
}
