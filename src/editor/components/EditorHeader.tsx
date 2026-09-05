import React from 'react';
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
} from 'lucide-react';
import { formatTime } from '../utils';

interface EditorHeaderProps {
  bpm: number;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  enableHitsounds: boolean;
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
  onExit: () => void;
}

export function EditorHeader({
  bpm,
  currentTime,
  isPlaying,
  isRecording,
  enableHitsounds,
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
  onExit,
}: EditorHeaderProps) {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 gap-3 bg-black/50 shrink-0 select-none overflow-x-auto overflow-y-hidden">
      {/* Brand & Time Badges */}
      <div className="flex items-center gap-4">
        <Activity className="w-5 h-5 text-[#00e5ff]" />
        <span className="font-bold text-lg tracking-wider text-[#00e5ff]">BEATMAP EDITOR</span>
        <div className="text-xs text-white/60 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10">
          <Clock className="w-3.5 h-3.5 text-[#00e5ff]" /> BPM: {bpm}
        </div>
        <div className="text-xs text-white/50 bg-white/5 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border border-white/10">
          <Clock className="w-3.5 h-3.5 text-[#00ff9d]" /> {formatTime(currentTime)}
        </div>
      </div>

      {/* Transport & Recording & History Controls */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo Buttons */}
        <div className="flex items-center gap-1 mr-1 border-r border-white/10 pr-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer cambio (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center border border-white/10 ${
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
            title="Rehacer cambio (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center border border-white/10 ${
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
          className={`px-3.5 py-1.5 rounded transition-all text-xs font-bold flex items-center gap-2 shadow-sm ${
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
          className={`px-4 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-2 shadow-sm ${
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
          className="px-3.5 py-1.5 bg-white/10 text-white/80 rounded hover:bg-white/20 transition-colors text-xs font-bold flex items-center gap-2 border border-white/10"
        >
          <Square className="w-3.5 h-3.5" /> STOP
        </button>

        {/* Hitsound Toggle */}
        <button
          onClick={onToggleHitsounds}
          title={enableHitsounds ? 'Hitsounds Enabled (Low-latency audio click)' : 'Hitsounds Disabled'}
          className={`px-3.5 py-1.5 rounded transition-colors text-xs font-bold flex items-center gap-2 shadow-sm border ${
            enableHitsounds
              ? 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/40 hover:bg-[#00ff9d]/30'
              : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20'
          }`}
        >
          {enableHitsounds ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {enableHitsounds ? 'HITS' : 'MUTE'}
        </button>
      </div>

      {/* Action Buttons: Audio, Import, Export, Exit */}
      <div className="flex items-center gap-2.5">
        {/* Playtest / Test Play in Real Game */}
        {onPlaytest && (
          <button
            onClick={onPlaytest}
            title="Probar nivel en el motor de juego real (Standalone Runtime)"
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white font-black rounded hover:scale-105 active:scale-95 transition-all text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#ff2d6f]/30 mr-1"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>PROBAR NIVEL</span>
          </button>
        )}

        {/* Load Audio File */}
        <label
          title="Load Audio File (.mp3, .wav, .ogg)"
          className="px-3 py-1.5 bg-[#00e5ff]/15 text-[#00e5ff] hover:bg-[#00e5ff]/25 rounded transition-colors text-xs font-semibold flex items-center gap-1.5 border border-[#00e5ff]/30 cursor-pointer"
        >
          <Music className="w-3.5 h-3.5" />
          <span>Load Audio</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onLoadAudioFile(file);
                e.target.value = '';
              }
            }}
          />
        </label>

        {/* Import JSON */}
        <label
          title="Import Beatmap JSON"
          className="px-3 py-1.5 bg-white/10 text-white/80 hover:bg-white/20 rounded transition-colors text-xs font-semibold flex items-center gap-1.5 border border-white/10 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-white/70" />
          <span>Import JSON</span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportJson(file);
                e.target.value = '';
              }
            }}
          />
        </label>

        {/* Export JSON */}
        <button
          onClick={onExport}
          className="px-3 py-1.5 bg-[#00ff9d]/15 text-[#00ff9d] rounded hover:bg-[#00ff9d]/25 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-[#00ff9d]/30"
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>

        {/* Exit Button */}
        <button
          onClick={onExit}
          className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-red-500/30"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </div>
    </header>
  );
}
