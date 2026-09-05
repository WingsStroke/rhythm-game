import React, { useEffect } from 'react';
import { Play, RotateCcw, LogOut } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  songTitle?: string;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onExit,
  songTitle,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm mx-4 flex flex-col items-center gap-6 p-8 rounded-3xl bg-[#0e0e18]/90 border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        {/* Glow Ambiance */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-[#00e5ff] rounded-full blur-[80px] opacity-20 pointer-events-none" />

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[11px] text-[#00e5ff] font-bold tracking-widest uppercase">Game Paused</span>
          <h2 className="text-3xl font-black tracking-tight text-white drop-shadow">
            {songTitle || 'NEON PULSE'}
          </h2>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onResume}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#00e5ff] to-[#ff2d6f] text-white font-bold flex items-center justify-center gap-3 shadow-lg shadow-[#00e5ff]/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>RESUME</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>RESTART</span>
          </button>

          <button
            onClick={onExit}
            className="w-full py-3.5 px-6 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 hover:text-white font-bold flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer mt-2"
          >
            <LogOut className="w-5 h-5" />
            <span>EXIT TO MENU</span>
          </button>
        </div>

        <span className="text-[11px] text-white/40 tracking-wider">
          Press [ESC] or [ENTER] to resume
        </span>
      </div>
    </div>
  );
};
