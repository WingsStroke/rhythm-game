import { useState, useRef, useEffect } from 'react';
import { Timeline } from './Timeline';
import { AudioEngine } from '../engine/audio/AudioEngine';
import { VisualEngine } from '../engine/visual/VisualEngine';
import type { LevelData, Note, PadId, AudioBands } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';
import { Play, Pause, Square, Download, LogOut, Clock, Activity, Settings2, SlidersHorizontal, MousePointerClick, Gamepad2, ListVideo } from 'lucide-react';

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

type EditorTab = 'timeline' | 'preview';

export function EditorApp({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState<LevelData>(initialLevel);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>('timeline');

  const audioRef = useRef<AudioEngine | null>(null);
  const visualRef = useRef<VisualEngine | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize Visual Engine when preview tab is first shown
  useEffect(() => {
    if (activeTab !== 'preview' || !canvasContainerRef.current) return;
    if (visualRef.current) return; // Already initialized

    const ve = new VisualEngine(canvasContainerRef.current, level, null as any);
    ve.init().then(() => {
      visualRef.current = ve;
    });
  }, [activeTab]);

  // Cleanup Visual Engine on unmount
  useEffect(() => {
    return () => {
      visualRef.current?.dispose();
      visualRef.current = null;
    };
  }, []);

  // Sync notes to VisualEngine in real-time when level.notes changes
  useEffect(() => {
    if (visualRef.current) {
      visualRef.current.syncNotes(level.notes);
    }
  }, [level.notes, activeTab]); // also run when tab changes because it might be newly initialized

  // Main animation loop — runs always but only polls audio when playing
  useEffect(() => {
    const loop = () => {
      let t = currentTime;
      if (isPlaying && audioRef.current) {
        t = audioRef.current.getTime();
        setCurrentTime(t);
      }
      if (visualRef.current && activeTab === 'preview') {
        const mockBands: AudioBands = {
          bass: 0, mids: 0, treble: 0, amplitude: 0,
          freqData: new Uint8Array(0), waveData: new Uint8Array(0),
        };
        visualRef.current.update(t, mockBands);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, activeTab]); // Note: currentTime intentionally omitted to avoid re-subscribing every frame

  const togglePlay = async () => {
    if (isPlaying) {
      audioRef.current?.stop();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new AudioEngine();
        await audioRef.current.init();
        if (level.song.url) {
          await audioRef.current.loadFile(level.song.url);
        }
      }
      audioRef.current.start(level.timing.bpm, currentTime);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioRef.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

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
      newNotes.sort((a, b) => a.time - b.time);
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

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s}.${ms}`;
  };

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0f0f15] text-white">

      {/* Toolbar */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 shrink-0">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-[#00e5ff]" />
          <span className="font-bold text-xl tracking-wider text-[#00e5ff]">BEATMAP EDITOR</span>
          <div className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> BPM: {level.timing.bpm}
          </div>
          <div className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatTime(currentTime)}
          </div>
        </div>
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={`px-4 py-1.5 rounded transition-colors text-sm font-bold flex items-center gap-2 ${
              isPlaying
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40'
                : 'bg-[#00ff9d]/20 text-[#00ff9d] hover:bg-[#00ff9d]/40'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button onClick={handleStop} className="px-4 py-1.5 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm font-bold flex items-center gap-2">
            <Square className="w-4 h-4" /> STOP
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="px-4 py-1.5 bg-[#00e5ff]/20 text-[#00e5ff] rounded hover:bg-[#00e5ff]/40 transition-colors text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Export JSON
          </button>
          <button onClick={() => { audioRef.current?.dispose(); onExit(); }} className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40 transition-colors text-sm font-semibold flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Exit
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar (Config) */}
        <aside className="w-56 border-r border-white/10 bg-black/20 p-4 overflow-y-auto shrink-0">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Level Config
          </h2>

          <div className="flex flex-col gap-3">
            <label className="text-sm text-white/70">
              Title
              <input type="text" value={level.song.title} onChange={e => setLevel({...level, song: {...level.song, title: e.target.value}})} className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#00e5ff] outline-none" />
            </label>
            <label className="text-sm text-white/70">
              BPM
              <input type="number" value={level.timing.bpm} onChange={e => setLevel({...level, timing: {...level.timing, bpm: Number(e.target.value)}})} className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#00e5ff] outline-none" />
            </label>
            <label className="text-sm text-white/70">
              Duration (s)
              <input type="number" value={level.song.duration} onChange={e => setLevel({...level, song: {...level.song, duration: Number(e.target.value)}})} className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#00e5ff] outline-none" />
            </label>
          </div>

          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Pads ({level.pads.length})
          </h2>
          <div className="flex flex-col gap-1.5">
            {level.pads.map((pad) => (
              <div key={pad.id} className="p-2 bg-white/5 border border-white/10 rounded text-xs flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pad.color }} />
                <span className="font-mono text-white/70">{pad.label}</span>
                <span className="ml-auto text-white/30">[{pad.keyHint}]</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center — Tabs (Timeline / Preview) */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tab Bar */}
          <div className="flex shrink-0 border-b border-white/10 bg-black/30">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'timeline'
                  ? 'border-[#00e5ff] text-[#00e5ff]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <ListVideo className="w-4 h-4" /> Timeline
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-2.5 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'border-[#00ff9d] text-[#00ff9d]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Gamepad2 className="w-4 h-4" /> Live Preview
            </button>
            <div className="ml-auto px-4 flex items-center text-xs text-white/30">
              {level.notes.length} notes
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">

            {/* Timeline Tab */}
            <div className={`absolute inset-0 ${activeTab === 'timeline' ? 'flex flex-col' : 'hidden'}`}>
              <Timeline
                level={level}
                currentTime={currentTime}
                onSeek={(t) => setCurrentTime(t)}
                onAddNote={addNote}
                onRemoveNote={removeNote}
              />
            </div>

            {/* Preview Tab — PixiJS canvas mounts here */}
            <div
              ref={canvasContainerRef}
              className={`absolute inset-0 bg-black ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            />
          </div>
        </main>

        {/* Right Sidebar (Properties) */}
        <aside className="w-56 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Properties
          </h2>
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
            <MousePointerClick className="w-8 h-8 mb-2" />
            <div className="text-sm italic">
              {activeTab === 'preview'
                ? 'Select a node in the canvas to edit.'
                : 'Switch to Live Preview to select visual nodes.'}
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
