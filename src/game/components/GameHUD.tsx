import React from 'react';
import type { PlayerState } from '../../engine/types';

interface GameHUDProps {
  playerState: PlayerState | null;
  currentTime: number;
  duration: number;
  songTitle?: string;
  difficulty?: string;
  onPause?: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  playerState,
  currentTime,
  duration,
  songTitle,
  difficulty,
  onPause,
}) => {
  const safeDuration = duration > 0 ? duration : 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const remainingTime = Math.max(0, safeDuration - currentTime);

  const multiplier = playerState?.multiplier ?? 1;
  const getMultiplierColor = (m: number) => {
    if (m >= 8) return 'text-[#ff0055] border-[#ff0055] shadow-[0_0_15px_#ff005580]';
    if (m >= 4) return 'text-[#ffaa00] border-[#ffaa00] shadow-[0_0_12px_#ffaa0080]';
    if (m >= 2) return 'text-[#00e5ff] border-[#00e5ff] shadow-[0_0_10px_#00e5ff80]';
    return 'text-white/60 border-white/20';
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-6 select-none font-sans">
      {/* Top Bar: Song Progress & Track Info */}
      <div className="w-full flex flex-col gap-2">
        {/* Progress Bar Track */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-md shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-[#00e5ff] via-[#ff2d6f] to-[#ffcc00] transition-all duration-75 shadow-[0_0_10px_#00e5ff]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Header Details */}
        <div className="flex items-center justify-between text-xs text-white/70 tracking-wider">
          <div className="flex items-center gap-3">
            {songTitle && (
              <span className="font-bold text-white text-sm drop-shadow-md">
                {songTitle}
              </span>
            )}
            {difficulty && (
              <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] uppercase font-semibold text-[#00e5ff]">
                {difficulty}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-white/50">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="font-mono text-[#00e5ff] font-semibold">
              -{formatTime(remainingTime)}
            </span>
            {onPause && (
              <button
                onClick={onPause}
                className="pointer-events-auto px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold cursor-pointer transition-colors active:scale-95"
                title="Pause (Escape)"
              >
                PAUSE (ESC)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center Top: Score, Multiplier, Accuracy & Judgement Stats */}
      {playerState && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* Score Pill */}
          <div className="flex flex-col items-center px-5 py-2 rounded-2xl bg-black/50 backdrop-blur-lg border border-white/10 shadow-xl min-w-[120px]">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Score</span>
            <span className="text-2xl font-black font-mono tracking-tight text-white drop-shadow">
              {playerState.score.toLocaleString()}
            </span>
          </div>

          {/* Combo & Dynamic Multiplier */}
          <div className="flex flex-col items-center px-5 py-2 rounded-2xl bg-black/50 backdrop-blur-lg border border-white/10 shadow-xl min-w-[100px]">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Combo</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-2xl font-black font-mono transition-transform duration-100 ${
                  playerState.combo > 0 ? 'text-[#ffcc00] scale-105 drop-shadow-[0_0_8px_#ffcc00]' : 'text-white/40'
                }`}
              >
                {playerState.combo}x
              </span>
              <span
                className={`text-xs font-black font-mono px-1.5 py-0.5 rounded border transition-all ${getMultiplierColor(
                  multiplier
                )}`}
              >
                {multiplier}x
              </span>
            </div>
          </div>

          {/* Live Accuracy */}
          <div className="flex flex-col items-center px-5 py-2 rounded-2xl bg-black/50 backdrop-blur-lg border border-white/10 shadow-xl min-w-[90px]">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Accuracy</span>
            <span className="text-2xl font-black font-mono text-[#00e5ff] drop-shadow-[0_0_8px_#00e5ff]">
              {playerState.accuracy.toFixed(1)}%
            </span>
          </div>

          {/* Judgement Counts */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-lg border border-white/10">
            <div className="flex flex-col items-center px-2">
              <span className="text-[9px] text-[#ffcc00]/70 uppercase font-bold">P</span>
              <span className="text-sm font-bold font-mono text-[#ffcc00]">{playerState.perfectCount}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div className="flex flex-col items-center px-2">
              <span className="text-[9px] text-[#00e5ff]/70 uppercase font-bold">G</span>
              <span className="text-sm font-bold font-mono text-[#00e5ff]">{playerState.goodCount}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div className="flex flex-col items-center px-2">
              <span className="text-[9px] text-[#ff3344]/70 uppercase font-bold">M</span>
              <span className="text-sm font-bold font-mono text-[#ff3344]">{playerState.missCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
