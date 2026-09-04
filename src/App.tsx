import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '@/engine/Game';
import { createPrototypeLevel, SONG_URL } from '@/game/createPrototypeLevel';
import type { PlayerState } from '@/engine/types';

type Screen = 'start' | 'playing' | 'results';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [songSource, setSongSource] = useState<'file' | 'procedural'>('procedural');
  const [hasSongFile, setHasSongFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const gameRef = useRef<Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if an external song file exists at the expected path (avoid Vite SPA html fallback)
  useEffect(() => {
    fetch(SONG_URL, { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        setHasSongFile(r.ok && !ct.includes('text/html'));
      })
      .catch(() => setHasSongFile(false));
  }, []);

  const startGame = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      // Clean up previous instance if any
      if (gameRef.current) {
        gameRef.current.dispose();
        gameRef.current = null;
      }

      if (!containerRef.current) {
        throw new Error('Canvas container is not ready.');
      }
      containerRef.current.innerHTML = '';

      setScreen('playing');
      setPlayerState(null);

      // Use the external song file if available; otherwise procedural synth
      const songUrl = hasSongFile ? SONG_URL : undefined;
      const level = createPrototypeLevel(songUrl);
      const game = new Game(containerRef.current, level);
      gameRef.current = game;
      setSongSource(game.songSource);

      game.onScoreUpdate = (state) => setPlayerState(state);
      game.onGameComplete = (state) => {
        try {
          gameRef.current?.dispose();
        } catch (e) {
          console.warn('Error disposing on complete:', e);
        }
        gameRef.current = null;
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        setPlayerState(state);
        setScreen('results');
      };

      await game.start();
    } catch (err) {
      console.error('Failed to start game:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong starting the game.');
      try {
        gameRef.current?.dispose();
      } catch {
        // Ignored
      }
      gameRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setScreen('start');
    } finally {
      setLoading(false);
    }
  }, [hasSongFile]);

  const stopGame = useCallback(() => {
    try {
      gameRef.current?.dispose();
    } catch (err) {
      console.warn('Error during game disposal:', err);
    }
    gameRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    setPlayerState(null);
    setScreen('start');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        gameRef.current?.dispose();
      } catch {
        // Ignored
      }
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#05050f] text-white overflow-hidden relative select-none">
      {/* PixiJS Game Canvas Container — Always mounted in the DOM to eliminate ref race conditions */}
      <div
        ref={containerRef}
        id="pixi-canvas-container"
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${
          screen === 'playing' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Start Screen Overlay */}
      {screen === 'start' && (
        <StartScreen onStart={startGame} hasSongFile={hasSongFile} errorMsg={errorMsg} loading={loading} />
      )}

      {/* HUD & Overlay during Playing */}
      {screen === 'playing' && (
        <PlayingScreen
          playerState={playerState}
          onQuit={stopGame}
          songSource={songSource}
        />
      )}

      {/* Results Screen Overlay */}
      {screen === 'results' && (
        <ResultsScreen
          state={
            playerState || {
              score: 0,
              combo: 0,
              maxCombo: 0,
              perfectCount: 0,
              goodCount: 0,
              missCount: 0,
            }
          }
          onRetry={startGame}
          onMenu={stopGame}
        />
      )}
    </div>
  );
}

// ---- Start Screen ----

function StartScreen({
  onStart,
  hasSongFile,
  errorMsg,
  loading,
}: {
  onStart: () => void;
  hasSongFile: boolean;
  errorMsg: string | null;
  loading: boolean;
}) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
      {/* Background glow ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[130px] opacity-25 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full blur-[130px] opacity-25 animate-pulse" style={{ animationDelay: '0.6s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00ff9d] rounded-full blur-[110px] opacity-15 animate-pulse" style={{ animationDelay: '1.2s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-xl">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-[#00e5ff] font-semibold">STAGE 1 — PLAYABLE PROTOTYPE</span>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight drop-shadow-2xl">
            <span className="text-[#ff2d6f]">NEON</span>{' '}
            <span className="text-[#00e5ff]">PULSE</span>
          </h1>
          <p className="text-base md:text-lg text-white/60 font-light tracking-wider">
            RHYTHM LAUNCHPAD ENGINE
          </p>
        </div>

        {/* Audio source indicator badge */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/15 backdrop-blur-md shadow-inner">
          <div className={`w-2.5 h-2.5 rounded-full ${hasSongFile ? 'bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]' : 'bg-[#ffcc00] shadow-[0_0_8px_#ffcc00]'} animate-pulse`} />
          <span className="text-sm text-white/70">
            {hasSongFile ? 'External Audio File Detected' : 'Procedural Audio Synthesizer (Zero-Assets)'}
          </span>
        </div>

        <div className="flex flex-col gap-4 items-center w-full">
          <button
            id="play-button"
            onClick={onStart}
            disabled={loading}
            className="w-64 py-4 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white text-2xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff2d6f]/40 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer tracking-wider"
          >
            {loading ? 'STARTING...' : 'PLAY'}
          </button>

          {errorMsg && (
            <div className="w-full px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-sm text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="text-sm text-white/50 mt-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm w-full">
            <p className="mb-3 text-white/80 font-medium">Controls — Press keyboard keys or click the pads:</p>
            <div className="grid grid-cols-4 gap-3 justify-center">
              {[
                { key: 'A', label: 'Kick', color: '#ff2d6f' },
                { key: 'S', label: 'Snare', color: '#00e5ff' },
                { key: 'D', label: 'Lead', color: '#ffcc00' },
                { key: 'F', label: 'Alt Lead', color: '#00ff9d' },
              ].map((pad) => (
                <div key={pad.key} className="flex flex-col items-center gap-1.5">
                  <kbd
                    className="w-12 h-12 flex items-center justify-center rounded-xl font-black text-xl border-2 bg-black/40"
                    style={{ borderColor: pad.color, color: pad.color, boxShadow: `0 0 14px ${pad.color}35` }}
                  >
                    {pad.key}
                  </kbd>
                  <span className="text-xs text-white/60 font-semibold">{pad.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Playing Screen (HUD Overlay) ----

function PlayingScreen({
  playerState,
  onQuit,
  songSource,
}: {
  playerState: PlayerState | null;
  onQuit: () => void;
  songSource: 'file' | 'procedural';
}) {
  const [fps, setFps] = useState(60);

  // Performance FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Keyboard shortcut for Quit: Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onQuit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onQuit]);

  return (
    <div className="relative z-10 w-full h-screen pointer-events-none">
      {/* Top Left: Audio Source & FPS Monitor */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
          <div className={`w-2 h-2 rounded-full ${songSource === 'file' ? 'bg-[#00ff9d]' : 'bg-[#ffcc00]'}`} />
          <span className="text-xs font-medium text-white/70">
            {songSource === 'file' ? 'External Audio' : 'Procedural Synth'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs font-mono">
          <span className="text-white/40">FPS:</span>
          <span className={`font-bold ${fps >= 55 ? 'text-[#00ff9d]' : fps >= 40 ? 'text-[#ffcc00]' : 'text-[#ff3344]'}`}>
            {fps}
          </span>
        </div>
      </div>

      {/* Top Right: Quit Button */}
      <button
        id="quit-button"
        onClick={onQuit}
        className="pointer-events-auto absolute top-4 right-4 z-50 px-4 py-2 bg-red-500/20 hover:bg-red-500/35 active:scale-95 backdrop-blur-md rounded-xl text-sm font-bold text-red-200 hover:text-white transition-all cursor-pointer border border-red-500/40 shadow-lg"
      >
        ✕ QUIT (ESC)
      </button>

      {/* Center Top: Score & Judgement HUD */}
      {playerState && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 text-center">
          <Stat label="Score" value={playerState.score.toLocaleString()} />
          <Stat label="Combo" value={`${playerState.combo}x`} highlight={playerState.combo > 10} />
          <Stat label="Perfect" value={String(playerState.perfectCount)} color="#ffcc00" />
          <Stat label="Good" value={String(playerState.goodCount)} color="#00e5ff" />
          <Stat label="Miss" value={String(playerState.missCount)} color="#ff3344" />
        </div>
      )}

      {/* Bottom helper prompt */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 text-xs text-white/30 tracking-wider font-mono">
        Press [A] [S] [D] [F] or click the pads when notes hit
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  color = '#ffffff',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 min-w-[70px]">
      <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">{label}</span>
      <span
        className="text-lg font-black font-mono"
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

function ResultsScreen({
  state,
  onRetry,
  onMenu,
}: {
  state: PlayerState;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const total = state.perfectCount + state.goodCount + state.missCount;
  const accuracy = total > 0 ? (((state.perfectCount * 300 + state.goodCount * 100) / (total * 300)) * 100).toFixed(1) : '0.0';
  const rank =
    accuracy === '100.0'
      ? 'SS'
      : parseFloat(accuracy) >= 90
      ? 'S'
      : parseFloat(accuracy) >= 75
      ? 'A'
      : parseFloat(accuracy) >= 60
      ? 'B'
      : 'C';

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[130px] opacity-20" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-[#00e5ff] rounded-full blur-[130px] opacity-20" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md bg-black/40 border border-white/15 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
        <h2 className="text-4xl font-black tracking-tight text-white/90">LEVEL COMPLETE</h2>

        <div
          className="w-28 h-28 flex items-center justify-center rounded-2xl text-6xl font-black shadow-2xl"
          style={{
            background:
              rank === 'SS'
                ? 'linear-gradient(135deg, #ffcc00, #ff8800)'
                : rank === 'S'
                ? 'linear-gradient(135deg, #00e5ff, #0088ff)'
                : 'linear-gradient(135deg, #00ff9d, #00aa66)',
            boxShadow: '0 0 35px rgba(255,204,0,0.35)',
          }}
        >
          {rank}
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-3xl font-black font-mono tracking-tight">{state.score.toLocaleString()}</div>
          <div className="text-sm text-white/60">
            Max Combo: <span className="text-white font-bold">{state.maxCombo}x</span> · Accuracy:{' '}
            <span className="text-[#00e5ff] font-bold">{accuracy}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full py-3 border-y border-white/10">
          <ResultStat label="Perfect" value={state.perfectCount} color="#ffcc00" />
          <ResultStat label="Good" value={state.goodCount} color="#00e5ff" />
          <ResultStat label="Miss" value={state.missCount} color="#ff3344" />
        </div>

        <div className="flex gap-4 w-full mt-2">
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg shadow-[#ff2d6f]/30"
          >
            RETRY
          </button>
          <button
            onClick={onMenu}
            className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl transition-all cursor-pointer border border-white/15"
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
      <span className="text-2xl font-black font-mono" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] text-white/50 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}
