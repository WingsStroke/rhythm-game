import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import { Game } from '@/engine/Game';
import { createPrototypeLevel } from '@/game/createPrototypeLevel';
import type { PlayerState } from '@/engine/types';

type Screen = 'start' | 'playing' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const gameRef = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback(async () => {
    if (!containerRef.current) return;
    setScreen('playing');
    setPlayerState(null);

    // Wait for the container to be rendered
    await new Promise((r) => setTimeout(r, 50));

    const level = createPrototypeLevel();
    const game = new Game(containerRef.current, level);
    gameRef.current = game;

    game.onScoreUpdate = (state) => setPlayerState(state);
    game.onGameComplete = (state) => {
      setPlayerState(state);
      setScreen('results');
    };

    await game.start();
  }, []);

  const stopGame = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    setScreen('start');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#05050f] text-white overflow-hidden relative">
      {screen === 'start' && <StartScreen onStart={startGame} />}
      {screen === 'playing' && (
        <PlayingScreen
          containerRef={containerRef}
          playerState={playerState}
          onQuit={stopGame}
        />
      )}
      {screen === 'results' && playerState && (
        <ResultsScreen state={playerState} onRetry={startGame} onMenu={stopGame} />
      )}
    </div>
  );
}

// ---- Start Screen ----

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00ff9d] rounded-full blur-[100px] opacity-10 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-6xl md:text-8xl font-black tracking-tight">
            <span className="text-[#ff2d6f]">NEON</span>{' '}
            <span className="text-[#00e5ff]">PULSE</span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 font-light tracking-wider">
            A RHYTHM ENGINE PROTOTYPE
          </p>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <button
            onClick={onStart}
            className="px-12 py-4 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white text-xl font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#ff2d6f]/30"
          >
            PLAY
          </button>
          <div className="text-sm text-white/40 mt-4">
            <p className="mb-2">Controls — press the keys as notes land on the pads:</p>
            <div className="flex gap-3 justify-center">
              {[
                { key: 'A', label: 'Kick', color: '#ff2d6f' },
                { key: 'S', label: 'Snare', color: '#00e5ff' },
                { key: 'D', label: 'Lead', color: '#ffcc00' },
                { key: 'F', label: 'Alt', color: '#00ff9d' },
              ].map((pad) => (
                <div key={pad.key} className="flex flex-col items-center gap-1">
                  <kbd
                    className="w-12 h-12 flex items-center justify-center rounded-lg font-bold text-lg border-2"
                    style={{ borderColor: pad.color, color: pad.color, boxShadow: `0 0 12px ${pad.color}40` }}
                  >
                    {pad.key}
                  </kbd>
                  <span className="text-xs text-white/50">{pad.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Playing Screen ----

function PlayingScreen({
  containerRef,
  playerState,
  onQuit,
}: {
  containerRef: RefObject<HTMLDivElement>,
  playerState: PlayerState | null;
  onQuit: () => void;
}) {
  return (
    <div className="relative w-full h-screen">
      {/* PixiJS canvas mounts here */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Quit button */}
      <button
        onClick={onQuit}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
      >
        Quit
      </button>

      {/* Score overlay (React HUD on top of canvas) */}
      {playerState && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-6 text-center pointer-events-none">
          <Stat label="Score" value={playerState.score.toLocaleString()} />
          <Stat label="Combo" value={`${playerState.combo}x`} highlight={playerState.combo > 10} />
          <Stat label="Perfect" value={String(playerState.perfectCount)} />
          <Stat label="Good" value={String(playerState.goodCount)} />
          <Stat label="Miss" value={String(playerState.missCount)} color="#ff3344" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, color = '#ffffff' }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex flex-col items-center bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <span
        className="text-xl font-bold"
        style={{
          color: highlight ? '#ffcc00' : color,
          textShadow: highlight ? '0 0 10px #ffcc0080' : 'none',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---- Results Screen ----

function ResultsScreen({ state, onRetry, onMenu }: { state: PlayerState; onRetry: () => void; onMenu: () => void }) {
  const total = state.perfectCount + state.goodCount + state.missCount;
  const accuracy = total > 0 ? ((state.perfectCount * 300 + state.goodCount * 100) / (total * 300) * 100).toFixed(1) : '0.0';
  const rank = accuracy === '100.0' ? 'SS' : parseFloat(accuracy) >= 90 ? 'S' : parseFloat(accuracy) >= 75 ? 'A' : parseFloat(accuracy) >= 60 ? 'B' : 'C';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[120px] opacity-15" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-[#00e5ff] rounded-full blur-[120px] opacity-15" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <h2 className="text-5xl font-black tracking-tight">RESULTS</h2>

        <div
          className="w-32 h-32 flex items-center justify-center rounded-2xl text-7xl font-black"
          style={{
            background: rank === 'SS' ? 'linear-gradient(135deg, #ffcc00, #ff8800)' : rank === 'S' ? 'linear-gradient(135deg, #00e5ff, #0088ff)' : 'linear-gradient(135deg, #00ff9d, #00aa66)',
            boxShadow: '0 0 40px rgba(255,204,0,0.3)',
          }}
        >
          {rank}
        </div>

        <div className="text-3xl font-bold">{state.score.toLocaleString()}</div>
        <div className="text-white/50">Max Combo: {state.maxCombo}x · Accuracy: {accuracy}%</div>

        <div className="flex gap-8 mt-4">
          <ResultStat label="Perfect" value={state.perfectCount} color="#ffcc00" />
          <ResultStat label="Good" value={state.goodCount} color="#00e5ff" />
          <ResultStat label="Miss" value={state.missCount} color="#ff3344" />
        </div>

        <div className="flex gap-4 mt-6">
          <button
            onClick={onRetry}
            className="px-10 py-3 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform"
          >
            RETRY
          </button>
          <button
            onClick={onMenu}
            className="px-10 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
          >
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-white/40 uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}
