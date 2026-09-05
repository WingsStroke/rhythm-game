import { useState, useRef, useEffect, useCallback } from 'react';
import { Timeline, type EditorTool, type GridSubdivision } from './Timeline';
import { AudioTransport } from '../engine/time/AudioTransport';
import { VisualEngine } from '../engine/visual/VisualEngine';
import { InputManager } from '../engine/input/InputManager';
import { GameplayEngine } from '../engine/gameplay/GameplayEngine';
import { GameplayEventBus } from '../engine/gameplay/GameplayEventBus';
import type { LevelData, PadEvent, PadId, PadBehavior, AudioBands } from '../engine/types';
import { BeatmapGenerator } from '../engine/beatmap/BeatmapGenerator';
import {
  Play,
  Pause,
  Square,
  Download,
  LogOut,
  Clock,
  Activity,
  Settings2,
  SlidersHorizontal,
  MousePointerClick,
  Gamepad2,
  ListVideo,
  MousePointer,
  Pencil,
  Eraser,
  Trash2,
  ZoomIn,
  ZoomOut,
  Zap,
  Repeat,
  Layers,
} from 'lucide-react';

// Default initial level data
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
  events: [],
  timing: {
    bpm: 120,
    offset: 0,
    windows: { perfect: 0.045, good: 0.09, miss: 0.15 },
  },
  visual: {
    nodes: [
      {
        id: 'test_rect',
        type: 'rectangle',
        transform: { x: 500, y: 300 },
        properties: { width: 200, height: 100, color: '#00e5ff' },
      },
    ],
    animations: [],
    triggers: [
      {
        id: 'trigger_1',
        time: 0,
        action: 'effect',
        targetId: 'all',
        duration: 0.5,
        properties: { effectType: 'reactivePulse' },
      },
    ],
  },
};

type EditorTab = 'timeline' | 'preview';

export function EditorApp({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState<LevelData>(initialLevel);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<EditorTab>('timeline');

  // Authoring tools state
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [creationBehavior, setCreationBehavior] = useState<PadBehavior>('tap');
  const [gridSubdivision, setGridSubdivision] = useState<GridSubdivision>('1/4');
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(120);

  // Selection state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const transportRef = useRef<AudioTransport | null>(null);
  const visualRef = useRef<VisualEngine | null>(null);
  const gameplayRef = useRef<GameplayEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const eventBusRef = useRef<GameplayEventBus | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize Visual Engine, Gameplay Engine and Input Manager when preview tab is first shown
  useEffect(() => {
    if (activeTab !== 'preview' || !canvasContainerRef.current) return;

    if (!visualRef.current) {
      const eventBus = new GameplayEventBus();
      eventBusRef.current = eventBus;

      const gameplay = new GameplayEngine(
        level,
        () => transportRef.current?.getTime() ?? 0,
        eventBus
      );
      gameplayRef.current = gameplay;

      const input = new InputManager(() => transportRef.current?.getTime() ?? 0);
      inputRef.current = input;

      const map: Record<string, PadId> = {};
      for (const pad of level.pads) {
        if (pad.keyHint) {
          map[`Key${pad.keyHint.toUpperCase()}`] = pad.id;
        }
      }
      input.setKeyMap(map);
      input.setHandler((event) => gameplayRef.current?.handleInput(event));

      const ve = new VisualEngine(canvasContainerRef.current, level, transportRef.current?.audioEngine ?? null);
      ve.onNodeSelect = (id) => {
        setSelectedNodeId(id);
        setSelectedEventId(null);
      };

      input.onPadPress = (padId) => ve.pressPad(padId);
      input.onPadRelease = (padId) => ve.releasePad(padId);

      ve.onPadInput = (padId, pressed) => {
        if (pressed) {
          inputRef.current?.pressPad(padId);
        } else {
          inputRef.current?.releasePad(padId);
        }
      };

      ve.attachEventBus(eventBus);

      ve.init().then(() => {
        visualRef.current = ve;
        if (activeTab === 'preview') {
          input.attach();
        }
        if (isPlaying) {
          gameplay.start(currentTime);
        }
      });
    } else {
      inputRef.current?.attach();
      if (isPlaying) {
        gameplayRef.current?.start(currentTime);
      }
    }
  }, [activeTab]);

  // Tab switching effect to attach/detach input listeners
  useEffect(() => {
    if (activeTab === 'preview') {
      inputRef.current?.attach();
      if (isPlaying) {
        gameplayRef.current?.start(currentTime);
      }
    } else {
      inputRef.current?.detach();
    }
  }, [activeTab]);

  // Cleanup Visual Engine, Gameplay Engine and Input Manager on unmount
  useEffect(() => {
    return () => {
      inputRef.current?.detach();
      visualRef.current?.dispose();
      visualRef.current = null;
      gameplayRef.current?.reset();
      gameplayRef.current = null;
      eventBusRef.current = null;
    };
  }, []);

  // Sync events to VisualEngine and GameplayEngine in real-time when level.events changes
  useEffect(() => {
    if (visualRef.current) {
      visualRef.current.syncEvents(level.events);
    }
    if (gameplayRef.current) {
      gameplayRef.current.setEvents(level.events);
    }
  }, [level.events]);

  // Sync keyMap when level.pads changes
  useEffect(() => {
    if (inputRef.current) {
      const map: Record<string, PadId> = {};
      for (const pad of level.pads) {
        if (pad.keyHint) {
          map[`Key${pad.keyHint.toUpperCase()}`] = pad.id;
        }
      }
      inputRef.current.setKeyMap(map);
    }
  }, [level.pads]);

  // Main animation loop
  useEffect(() => {
    const loop = () => {
      let t = currentTime;
      if (isPlaying && transportRef.current) {
        t = transportRef.current.getTime();
        setCurrentTime(t);
      }
      if (activeTab === 'preview') {
        if (isPlaying && gameplayRef.current) {
          gameplayRef.current.update();
        }
        if (visualRef.current) {
          const bands: AudioBands =
            isPlaying && transportRef.current
              ? transportRef.current.getAudioBands()
              : {
                  bass: 0,
                  mids: 0,
                  treble: 0,
                  amplitude: 0,
                  freqData: new Uint8Array(0),
                  waveData: new Uint8Array(0),
                };
          visualRef.current.update(t, bands);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, activeTab]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      transportRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!transportRef.current) {
        transportRef.current = new AudioTransport();
        await transportRef.current.init();
        if (level.song.url) {
          await transportRef.current.loadFile(level.song.url);
        }
      }
      transportRef.current.onBeat((beatIndex: number) => {
        if (visualRef.current && activeTab === 'preview') {
          visualRef.current.onBeat(beatIndex);
        }
      });
      await transportRef.current.play(level.timing.bpm, currentTime);
      setIsPlaying(true);
      if (activeTab === 'preview') {
        gameplayRef.current?.start(currentTime);
      }
    }
  }, [isPlaying, currentTime, level.song.url, level.timing.bpm, activeTab]);

  const handleStop = () => {
    transportRef.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    visualRef.current?.seek(0);
    gameplayRef.current?.reset();
    gameplayRef.current?.start(0);
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(level, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${level.song.title.toLowerCase().replace(/\s+/g, '_')}_level.json`);
    dlAnchorElem.click();
  };

  // Event mutations
  const handleAddEvent = (newEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = [...prev.events, newEvent].sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
    setSelectedEventId(newEvent.id);
    setSelectedNodeId(null);
  };

  const handleUpdateEvent = (updatedEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = prev.events
        .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  };

  const handleRemoveEvent = (id: string) => {
    setLevel((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    if (selectedEventId === id) {
      setSelectedEventId(null);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // In preview mode, allow Space to toggle play/pause, but don't intercept other keys (e.g. pad inputs)
      if (activeTab === 'preview') {
        if (e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        }
        return;
      }

      if (e.code === 'KeyV') {
        setActiveTool('select');
      } else if (e.code === 'KeyB') {
        setActiveTool('pen');
      } else if (e.code === 'KeyE') {
        setActiveTool('eraser');
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedEventId) {
          e.preventDefault();
          handleRemoveEvent(selectedEventId);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, togglePlay, activeTab]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, '0');
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s}.${ms}`;
  };

  const selectedEvent = level.events.find((e) => e.id === selectedEventId) || null;
  const selectedNode = level.visual.nodes.find((n) => n.id === selectedNodeId) || null;

  const updateSelectedNode = (updates: any) => {
    if (!selectedNode) return;
    const newNode = { ...selectedNode, ...updates };
    setLevel((prev) => {
      const idx = prev.visual.nodes.findIndex((n) => n.id === newNode.id);
      if (idx === -1) return prev;
      const newNodes = [...prev.visual.nodes];
      newNodes[idx] = newNode;
      return { ...prev, visual: { ...prev.visual, nodes: newNodes } };
    });
    visualRef.current?.updateNode(newNode);
  };

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0b0b12] text-white select-none">
      {/* Primary Navigation / Global Transport Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 shrink-0">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-[#00e5ff]" />
          <span className="font-bold text-lg tracking-wider text-[#00e5ff]">BEATMAP EDITOR</span>
          <div className="text-xs text-white/60 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10">
            <Clock className="w-3.5 h-3.5 text-[#00e5ff]" /> BPM: {level.timing.bpm}
          </div>
          <div className="text-xs text-white/50 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10">
            <Clock className="w-3.5 h-3.5 text-[#00ff9d]" /> {formatTime(currentTime)}
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={`px-4 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-2 shadow-sm ${
              isPlaying
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30'
                : 'bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/40 hover:bg-[#00ff9d]/30'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            onClick={handleStop}
            className="px-3.5 py-1.5 bg-white/10 text-white/80 rounded hover:bg-white/20 transition-colors text-xs font-bold flex items-center gap-2 border border-white/10"
          >
            <Square className="w-3.5 h-3.5" /> STOP
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-3.5 py-1.5 bg-[#00e5ff]/20 text-[#00e5ff] rounded hover:bg-[#00e5ff]/30 transition-colors text-xs font-semibold flex items-center gap-2 border border-[#00e5ff]/30"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            onClick={() => {
              transportRef.current?.dispose();
              onExit();
            }}
            className="px-3.5 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-xs font-semibold flex items-center gap-2 border border-red-500/30"
          >
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </header>

      {/* Secondary Authoring Toolbar */}
      <div className="h-11 border-b border-white/10 bg-black/30 flex items-center justify-between px-6 shrink-0">
        {/* Tool Mode Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTool('select')}
            title="Select & Move (V)"
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTool === 'select'
                ? 'bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/60 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" /> Select (V)
          </button>
          <button
            onClick={() => setActiveTool('pen')}
            title="Draw / Pen (B)"
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTool === 'pen'
                ? 'bg-[#00ff9d]/25 text-[#00ff9d] border border-[#00ff9d]/60 shadow-[0_0_8px_rgba(0,255,157,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" /> Pen (B)
          </button>
          <button
            onClick={() => setActiveTool('eraser')}
            title="Eraser (E)"
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeTool === 'eraser'
                ? 'bg-red-500/25 text-red-400 border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" /> Eraser (E)
          </button>

          {/* Sub-selector for creation behavior */}
          {activeTool === 'pen' && (
            <div className="flex items-center gap-1 ml-3 pl-3 border-l border-white/10">
              <span className="text-[11px] text-white/40 uppercase font-mono mr-1">Type:</span>
              {(['tap', 'hold', 'loop', 'trigger'] as PadBehavior[]).map((beh) => (
                <button
                  key={beh}
                  onClick={() => setCreationBehavior(beh)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors ${
                    creationBehavior === beh
                      ? 'bg-white/20 text-white border border-white/40 font-bold'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {beh}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid Snapping & Zoom controls */}
        <div className="flex items-center gap-4">
          {/* Snap Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/40 uppercase font-mono">Snap:</span>
            <select
              value={gridSubdivision}
              onChange={(e) => setGridSubdivision(e.target.value as GridSubdivision)}
              className="bg-black/60 border border-white/20 rounded px-2 py-0.5 text-xs text-white/90 outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
            >
              <option value="1/1">1/1 (Bar)</option>
              <option value="1/2">1/2 (Half)</option>
              <option value="1/4">1/4 (Beat)</option>
              <option value="1/8">1/8 (8th)</option>
              <option value="1/16">1/16 (16th)</option>
              <option value="free">Free (Off)</option>
            </select>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
            <span className="text-[11px] text-white/40 uppercase font-mono">Zoom:</span>
            <button
              onClick={() => setPixelsPerSecond((p) => Math.max(60, p - 20))}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono text-white/60 w-12 text-center">{pixelsPerSecond}px/s</span>
            <button
              onClick={() => setPixelsPerSecond((p) => Math.min(260, p + 20))}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Level Config & Pad list) */}
        <aside className="w-56 border-r border-white/10 bg-black/20 p-4 overflow-y-auto shrink-0 flex flex-col justify-between">
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
                  onChange={(e) => setLevel({ ...level, song: { ...level.song, title: e.target.value } })}
                  className="w-full mt-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-xs focus:border-[#00e5ff] outline-none"
                />
              </label>
              <label className="text-xs text-white/60">
                BPM
                <input
                  type="number"
                  value={level.timing.bpm}
                  onChange={(e) =>
                    setLevel({
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
                    setLevel({ ...level, song: { ...level.song, duration: Number(e.target.value) } })
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

        {/* Center Canvas / Timeline Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Switcher Bar */}
          <div className="flex shrink-0 border-b border-white/10 bg-black/40">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'timeline'
                  ? 'border-[#00e5ff] text-[#00e5ff]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" /> Timeline
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'border-[#00ff9d] text-[#00ff9d]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Live Preview
            </button>
            <div className="ml-auto px-4 flex items-center text-xs text-white/40 font-mono">
              {level.events.length} events
            </div>
          </div>

          {/* Active View Container */}
          <div className="flex-1 overflow-hidden relative">
            {/* Timeline Tab */}
            <div className={`absolute inset-0 ${activeTab === 'timeline' ? 'flex flex-col' : 'hidden'}`}>
              <Timeline
                level={level}
                currentTime={currentTime}
                isPlaying={isPlaying}
                activeTool={activeTool}
                creationBehavior={creationBehavior}
                gridSubdivision={gridSubdivision}
                pixelsPerSecond={pixelsPerSecond}
                selectedEventId={selectedEventId}
                onSelectEvent={(evt) => {
                  setSelectedEventId(evt?.id || null);
                  if (evt) setSelectedNodeId(null);
                }}
                onSeek={(t) => {
                  setCurrentTime(t);
                  transportRef.current?.seek(t);
                  visualRef.current?.seek(t);
                  if (isPlaying) {
                    gameplayRef.current?.start(t);
                  } else {
                    gameplayRef.current?.reset();
                  }
                }}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onRemoveEvent={handleRemoveEvent}
              />
            </div>

            {/* Preview Tab (Live Game Canvas) */}
            <div
              ref={canvasContainerRef}
              className={`absolute inset-0 bg-black ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            />
          </div>
        </main>

        {/* Right Sidebar: Contextual Properties Panel */}
        <aside className="w-64 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col overflow-y-auto">
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
                  onChange={(e) => handleUpdateEvent({ ...selectedEvent, padId: e.target.value as PadId })}
                  className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
                >
                  {level.pads.map((p) => (
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
                      handleUpdateEvent({
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
                      handleUpdateEvent({
                        ...selectedEvent,
                        targetTime: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono text-center"
                  />
                  <button
                    onClick={() =>
                      handleUpdateEvent({
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
                    handleUpdateEvent({
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
                      handleUpdateEvent({
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
                    onChange={(e) => handleUpdateEvent({ ...selectedEvent, triggerId: e.target.value })}
                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#00e5ff] font-mono"
                  />
                </label>
              )}

              {/* Delete Button */}
              <button
                onClick={() => handleRemoveEvent(selectedEvent.id)}
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
                        updateSelectedNode({
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
                        updateSelectedNode({
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
                        updateSelectedNode({ properties: { ...selectedNode.properties, width: Number(e.target.value) } })
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
                        updateSelectedNode({ properties: { ...selectedNode.properties, height: Number(e.target.value) } })
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
                        updateSelectedNode({ properties: { ...selectedNode.properties, color: e.target.value } })
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
      </div>
    </div>
  );
}
