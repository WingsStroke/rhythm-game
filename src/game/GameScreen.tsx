import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from '../engine/Game';
import type { LevelData, PlayerState } from '../engine/types';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { ResultsModal } from './components/ResultsModal';

interface GameScreenProps {
  level: LevelData;
  onExit: () => void;
  exitLabel?: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  level,
  onExit,
  exitLabel = 'MENU',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(level.song.duration || 30);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finalState, setFinalState] = useState<PlayerState | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize and run the Game instance
  useEffect(() => {
    let active = true;

    const initGame = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      try {
        const game = new Game(containerRef.current, level);
        gameRef.current = game;

        game.onScoreUpdate = (state) => {
          if (!active) return;
          setPlayerState(state);
        };

        game.onTimeUpdate = (time, totalDuration) => {
          if (!active) return;
          setCurrentTime(time);
          if (totalDuration > 0) setDuration(totalDuration);
        };

        game.onPauseChange = (paused) => {
          if (!active) return;
          setIsPaused(paused);
        };

        game.onGameComplete = (finalPlayerState) => {
          if (!active) return;
          setFinalState(finalPlayerState);
          setIsComplete(true);
        };

        await game.start();
      } catch (err) {
        console.error('Failed to initialize Game:', err);
        if (active) {
          setInitError(err instanceof Error ? err.message : 'Error starting game.');
        }
      }
    };

    initGame();

    return () => {
      active = false;
      if (gameRef.current) {
        try {
          gameRef.current.dispose();
        } catch (e) {
          console.warn('Error during game disposal:', e);
        }
        gameRef.current = null;
      }
    };
  }, [level]);

  // Handle Escape key for Pause toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isComplete) {
        e.preventDefault();
        if (gameRef.current) {
          if (gameRef.current.isPaused) {
            gameRef.current.resume();
          } else {
            gameRef.current.pause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComplete]);

  const handleResume = useCallback(() => {
    gameRef.current?.resume();
  }, []);

  const handleRestart = useCallback(() => {
    setIsComplete(false);
    setFinalState(null);
    setPlayerState(null);
    setCurrentTime(0);
    gameRef.current?.restart();
  }, []);

  const handleExit = useCallback(() => {
    if (gameRef.current) {
      try {
        gameRef.current.dispose();
      } catch (e) {
        console.warn('Error disposing game:', e);
      }
      gameRef.current = null;
    }
    onExit();
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-20 w-full h-full bg-[#05050f] text-white overflow-hidden select-none flex items-center justify-center">
      {/* Responsive Game Viewport */}
      <div
        id="game-viewport"
        className="relative w-full h-full flex items-center justify-center shadow-2xl overflow-hidden"
      >
        {/* PixiJS Game Canvas Container */}
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full z-0 pointer-events-auto"
        />

        {/* Real-time HUD */}
        {!isComplete && (
          <GameHUD
            playerState={playerState}
            currentTime={currentTime}
            duration={duration}
            songTitle={level.song.title}
            difficulty={level.metadata.difficulty}
            onPause={() => gameRef.current?.pause()}
          />
        )}

        {/* Pause Modal Overlay */}
        {isPaused && !isComplete && (
          <PauseModal
            onResume={handleResume}
            onRestart={handleRestart}
            onExit={handleExit}
            songTitle={level.song.title}
          />
        )}

        {/* Results Screen Modal */}
        {isComplete && (
          <ResultsModal
            state={
              finalState ||
              playerState || {
                score: 0,
                combo: 0,
                maxCombo: 0,
                multiplier: 1,
                accuracy: 0,
                perfectCount: 0,
                goodCount: 0,
                missCount: 0,
              }
            }
            songTitle={level.song.title}
            difficulty={level.metadata.difficulty}
            onRetry={handleRestart}
            onExit={handleExit}
            exitLabel={exitLabel}
          />
        )}

        {/* Error Notification */}
        {initError && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-8 gap-4 text-center">
            <span className="text-red-400 text-lg font-bold">Could not load track</span>
            <p className="text-white/60 text-sm max-w-md">{initError}</p>
            <button
              onClick={handleExit}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-bold text-sm cursor-pointer"
            >
              Return
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
