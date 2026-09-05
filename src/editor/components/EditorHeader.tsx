import React from 'react';
import { Activity, Clock, Play, Pause, Square, Download, LogOut } from 'lucide-react';
import { formatTime } from '../utils';

interface EditorHeaderProps {
  bpm: number;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onExport: () => void;
  onExit: () => void;
}

export function EditorHeader({
  bpm,
  currentTime,
  isPlaying,
  onTogglePlay,
  onStop,
  onExport,
  onExit,
}: EditorHeaderProps) {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 shrink-0 select-none">
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

      {/* Transport Controls */}
      <div className="flex items-center gap-2">
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
        <button
          onClick={onStop}
          className="px-3.5 py-1.5 bg-white/10 text-white/80 rounded hover:bg-white/20 transition-colors text-xs font-bold flex items-center gap-2 border border-white/10"
        >
          <Square className="w-3.5 h-3.5" /> STOP
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExport}
          className="px-3.5 py-1.5 bg-[#00e5ff]/20 text-[#00e5ff] rounded hover:bg-[#00e5ff]/30 transition-colors text-xs font-semibold flex items-center gap-2 border border-[#00e5ff]/30"
        >
          <Download className="w-3.5 h-3.5" /> Export JSON
        </button>
        <button
          onClick={onExit}
          className="px-3.5 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-xs font-semibold flex items-center gap-2 border border-red-500/30"
        >
          <LogOut className="w-3.5 h-3.5" /> Exit
        </button>
      </div>
    </header>
  );
}
