import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Clock,
  Play,
  Pause,
  Square,
  Circle,
  Download,
  Upload,
  LogOut,
  Music,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  Gauge,
  Settings,
  Sliders,
} from 'lucide-react';
import { formatTime } from '../utils';

interface EditorHeaderProps {
  bpm: number;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  enableHitsounds: boolean;
  playbackSpeed?: number;
  onChangePlaybackSpeed?: (speed: number) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onToggleHitsounds: () => void;
  onStop: () => void;
  onLoadAudioFile: (file: File) => void;
  onImportJson: (file: File) => void;
  onExport: () => void;
  onPlaytest?: () => void;
  onOpenSongPadsModal?: () => void;
  onExit: () => void;
}

export function EditorHeader({
  bpm,
  currentTime,
  isPlaying,
  isRecording,
  enableHitsounds,
  playbackSpeed = 1.0,
  onChangePlaybackSpeed,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onTogglePlay,
  onToggleRecord,
  onToggleHitsounds,
  onStop,
  onLoadAudioFile,
  onImportJson,
  onExport,
  onPlaytest,
  onOpenSongPadsModal,
  onExit,
}: EditorHeaderProps) {
  const [localSpeed, setLocalSpeed] = useState<string>(playbackSpeed.toString());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSpeed(playbackSpeed.toString());
  }, [playbackSpeed]);

  // Click outside and ESC key handlers for dropdown menu
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      // If clicking inside containerRef (which contains both the gear button and dropdown),
      // let the button's own onClick toggle the state instead of closing prematurely.
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      setIsSettingsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 gap-3 bg-black/50 shrink-0 select-none relative z-50 overflow-visible">
      <style>{`
        @keyframes headerMenuStagger {
          0% {
            opacity: 0;
            transform: translateY(-8px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Brand & Time Badges */}
      <div className="flex items-center gap-4 shrink-0">
        <Activity className="w-5 h-5 text-[#00e5ff]" />
        <span className="font-bold text-lg tracking-wider text-[#00e5ff]">BEATMAP EDITOR</span>
        <div className="text-xs text-white/60 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-[#00e5ff]" /> BPM: {bpm}
        </div>
        <div className="text-xs text-white/50 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-[#00ff9d]" /> {formatTime(currentTime)}
        </div>
      </div>

      {/* Transport & Recording & History Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Undo / Redo Buttons */}
        <div className="flex items-center gap-1 mr-1 border-r border-white/10 pr-2 shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center border border-white/10 shrink-0 ${
              canUndo
                ? 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white cursor-pointer'
                : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center border border-white/10 shrink-0 ${
              canRedo
                ? 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white cursor-pointer'
                : 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed opacity-30'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* REC Button */}
        <button
          onClick={onToggleRecord}
          title="Toggle Live Recording Mode (R) — Tap A,S,D,F to place notes in real-time"
          className={`px-3.5 py-1.5 rounded transition-all text-xs font-bold flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0 cursor-pointer ${
            isRecording
              ? 'bg-red-500 text-white shadow-[0_0_15px_#ff0055] animate-pulse border border-red-400'
              : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
          }`}
        >
          <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-white' : 'fill-red-400'}`} />
          {isRecording ? 'RECORDING' : 'REC (R)'}
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className={`px-4 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0 cursor-pointer ${
            isPlaying
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30'
              : 'bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/40 hover:bg-[#00ff9d]/30'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="px-3.5 py-1.5 bg-white/10 text-white/80 rounded hover:bg-white/20 transition-colors text-xs font-bold flex items-center gap-2 border border-white/10 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Square className="w-3.5 h-3.5" /> STOP
        </button>

        {/* Hitsound Toggle */}
        <button
          onClick={onToggleHitsounds}
          title={enableHitsounds ? 'Hitsounds Enabled (Low-latency audio click)' : 'Hitsounds Disabled'}
          className={`px-3.5 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-2 shadow-sm border whitespace-nowrap shrink-0 cursor-pointer ${
            enableHitsounds
              ? 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/40 hover:bg-[#00ff9d]/30'
              : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20'
          }`}
        >
          {enableHitsounds ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {enableHitsounds ? 'HITS' : 'MUTE'}
        </button>

        {/* Playback Speed Input (0.25x - 4x) */}
        {onChangePlaybackSpeed && (
          <div
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded ml-1 shrink-0"
            title="Playback Speed (0.25x - 4.0x)"
          >
            <Gauge className="w-3.5 h-3.5 text-[#00e5ff] shrink-0" />
            <span className="text-[10px] text-white/50 font-mono font-bold whitespace-nowrap">SPEED:</span>
            <div className="flex items-center">
              <input
                type="number"
                min={0.25}
                max={4}
                step={0.25}
                value={localSpeed}
                onChange={(e) => {
                  setLocalSpeed(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0.25 && val <= 4) {
                    onChangePlaybackSpeed(Number(val.toFixed(2)));
                  }
                }}
                onBlur={() => {
                  const val = parseFloat(localSpeed);
                  if (isNaN(val) || val < 0.25) {
                    onChangePlaybackSpeed(0.25);
                    setLocalSpeed('0.25');
                  } else if (val > 4) {
                    onChangePlaybackSpeed(4);
                    setLocalSpeed('4');
                  } else {
                    const rounded = Number(val.toFixed(2));
                    onChangePlaybackSpeed(rounded);
                    setLocalSpeed(String(rounded));
                  }
                }}
                className="w-13 bg-black/60 border border-white/15 rounded px-1.5 py-0.5 text-xs text-center font-mono font-bold text-[#00e5ff] focus:border-[#00e5ff] outline-none"
              />
              <span className="text-xs font-mono text-white/60 ml-1 font-bold">x</span>
            </div>
          </div>
        )}
      </div>

      {/* Top-Right Settings Gear & Actions Menu */}
      <div ref={containerRef} className="relative shrink-0 flex items-center">
        <button
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          title="Settings & Actions"
          className={`p-2 rounded-lg border transition-all cursor-pointer ${
            isSettingsOpen
              ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff]/50 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
              : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
          }`}
          aria-label="Settings and Actions"
        >
          <Settings className={`w-4 h-4 transition-transform duration-300 ${isSettingsOpen ? 'rotate-90 text-[#00e5ff]' : ''}`} />
        </button>

        {/* Dropdown Floating Menu with Staggered Cascading Animation */}
        {isSettingsOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-64 bg-[#0c0d16] border border-[#25283c] rounded-xl shadow-[0_20px_48px_rgba(0,0,0,0.98)] p-1.5 z-[100] flex flex-col gap-0.5 pointer-events-auto backdrop-blur-none"
          >
            {/* 1. Playtest Action */}
            {onPlaytest && (
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  onPlaytest();
                }}
                style={{
                  animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                  animationDelay: '0ms',
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-[#ff2d6f]/20 to-[#00e5ff]/20 hover:from-[#ff2d6f]/30 hover:to-[#00e5ff]/30 text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Play className="w-3.5 h-3.5 fill-white text-white group-hover:scale-110 transition-transform" />
                  <span>Playtest Level</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
                  F5
                </span>
              </button>
            )}

            {/* 2. Song & Pads Configuration */}
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                onOpenSongPadsModal?.();
              }}
              style={{
                animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: '35ms',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Song & Pads Setup</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-white/10" />

            {/* 3. Load Audio File */}
            <label
              style={{
                animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: '70ms',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <Music className="w-3.5 h-3.5 text-[#b388ff]" />
              <span>Load Audio File</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onLoadAudioFile(file);
                    setIsSettingsOpen(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {/* 4. Import Beatmap JSON */}
            <label
              style={{
                animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: '105ms',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>Import Beatmap (JSON)</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportJson(file);
                    setIsSettingsOpen(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {/* 5. Export Beatmap JSON */}
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                onExport();
              }}
              style={{
                animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: '140ms',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#00ff9d]" />
              <span>Export Beatmap (JSON)</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-white/10" />

            {/* 6. Exit Editor */}
            <button
              onClick={() => {
                setIsSettingsOpen(false);
                onExit();
              }}
              style={{
                animation: 'headerMenuStagger 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: '175ms',
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/15 text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Exit Editor</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
