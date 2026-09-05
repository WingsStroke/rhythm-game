import React from 'react';
import type { PlayerState } from '../../engine/types';
import { RotateCcw, ArrowLeft, Trophy } from 'lucide-react';

interface ResultsModalProps {
  state: PlayerState;
  songTitle?: string;
  difficulty?: string;
  onRetry: () => void;
  onExit: () => void;
  exitLabel?: string;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  state,
  songTitle,
  difficulty,
  onRetry,
  onExit,
  exitLabel = 'MENU',
}) => {
  const accuracy = state.accuracy ?? 0;
  const rank =
    accuracy >= 100
      ? 'SS'
      : accuracy >= 90
      ? 'S'
      : accuracy >= 80
      ? 'A'
      : accuracy >= 70
      ? 'B'
      : accuracy >= 60
      ? 'C'
      : 'D';

  const getRankGradient = (r: string) => {
    switch (r) {
      case 'SS':
        return 'from-[#ffe600] to-[#ff5500] text-black shadow-[0_0_40px_#ffe60080]';
      case 'S':
        return 'from-[#00e5ff] to-[#0066ff] text-white shadow-[0_0_35px_#00e5ff80]';
      case 'A':
        return 'from-[#00ff9d] to-[#00aa66] text-black shadow-[0_0_30px_#00ff9d80]';
      case 'B':
        return 'from-[#ffaa00] to-[#ff5500] text-white shadow-[0_0_25px_#ffaa0060]';
      case 'C':
        return 'from-[#aa00ff] to-[#6600cc] text-white shadow-[0_0_20px_#aa00ff60]';
      default:
        return 'from-gray-600 to-gray-800 text-white shadow-none';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg flex flex-col items-center gap-6 p-8 rounded-3xl bg-[#0d0d17]/95 border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.9)]">
        {/* Glow Ambiance */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#ff2d6f] rounded-full blur-[100px] opacity-20 pointer-events-none" />

        {/* Header Title */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 text-xs font-bold text-[#00e5ff] tracking-widest uppercase">
            <Trophy className="w-4 h-4" />
            <span>Track Complete</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white drop-shadow">
            {songTitle || 'NEON PULSE'}
          </h2>
          {difficulty && (
            <span className="text-xs uppercase font-semibold text-white/50 tracking-wider">
              {difficulty} Dificultad
            </span>
          )}
        </div>

        {/* Center Rank & Accuracy */}
        <div className="flex items-center justify-center gap-8 my-2">
          <div
            className={`w-28 h-28 rounded-3xl flex items-center justify-center font-black text-6xl bg-gradient-to-br ${getRankGradient(
              rank
            )}`}
          >
            {rank}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-white/50 uppercase font-bold tracking-wider">Final Score</span>
            <span className="text-3xl font-black font-mono tracking-tight text-white drop-shadow">
              {state.score.toLocaleString()}
            </span>
            <div className="flex items-center gap-3 text-sm text-white/70 font-mono mt-1">
              <span>
                Acc: <strong className="text-[#00e5ff]">{accuracy.toFixed(1)}%</strong>
              </span>
              <span>·</span>
              <span>
                Max: <strong className="text-[#ffcc00]">{state.maxCombo}x</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Judgement Breakdown Grid */}
        <div className="grid grid-cols-3 gap-3 w-full py-3 border-y border-white/10">
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#ffcc00]/80">Perfect</span>
            <span className="text-2xl font-black font-mono text-[#ffcc00]">{state.perfectCount}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#00e5ff]/80">Good</span>
            <span className="text-2xl font-black font-mono text-[#00e5ff]">{state.goodCount}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#ff3344]/80">Miss</span>
            <span className="text-2xl font-black font-mono text-[#ff3344]">{state.missCount}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full mt-2">
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#ff2d6f]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RETRY</span>
          </button>

          <button
            onClick={onExit}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{exitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
