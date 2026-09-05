import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { SONG_URL } from '@/game/createPrototypeLevel';
import type { LevelData } from '@/engine/types';
import { ContentManager, type LevelPackage } from '@/engine/content/ContentManager';
import { LevelValidator } from '@/engine/content/LevelValidator';
import { SongRegistry } from '@/engine/content/SongRegistry';
import { EditorApp } from '@/editor/EditorApp';
import { ErrorBoundary } from '@/editor/components/ErrorBoundary';
import { GameScreen } from '@/game/GameScreen';
import { Play, Upload, Edit3, Disc3, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Screen = 'start' | 'playing' | 'editor';
type DifficultyType = 'Easy' | 'Normal' | 'Hard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [hasSongFile, setHasSongFile] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyType>('Normal');
  const [activeLevel, setActiveLevel] = useState<LevelData | null>(null);
  const [editorLevel, setEditorLevel] = useState<LevelData | null>(null);
  const [playtestFromEditor, setPlaytestFromEditor] = useState(false);
  const [isAudioCached, setIsAudioCached] = useState(false);

  // Check if external audio file exists in public/audio/
  useEffect(() => {
    fetch(SONG_URL, { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        setHasSongFile(r.ok && !ct.includes('text/html'));
      })
      .catch(() => setHasSongFile(false));
  }, []);

  // Build the multi-difficulty level package
  const levelPackage: LevelPackage = useMemo(() => {
    return ContentManager.getInstance().createDefaultPackage(hasSongFile ? SONG_URL : undefined);
  }, [hasSongFile]);

  // Derive current level from package and selected difficulty
  const currentLevelOption = useMemo(() => {
    return (
      levelPackage.difficulties.find((d) => d.difficulty === selectedDifficulty) ||
      levelPackage.difficulties[1]
    );
  }, [levelPackage, selectedDifficulty]);

  // Update memory cache status
  useEffect(() => {
    const songId = currentLevelOption.level.songId || currentLevelOption.level.song.id;
    setIsAudioCached(SongRegistry.getInstance().hasAudioBuffer(songId));
  }, [currentLevelOption, screen]);

  const handleStartSelected = useCallback(() => {
    setValidationErrors(null);
    setActiveLevel(currentLevelOption.level);
    setPlaytestFromEditor(false);
    setScreen('playing');
  }, [currentLevelOption]);

  const handleLoadJsonLevel = useCallback((file: File) => {
    setValidationErrors(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const validation = LevelValidator.validate(parsed);

        if (validation.valid && validation.sanitizedLevel) {
          setActiveLevel(validation.sanitizedLevel);
          setPlaytestFromEditor(false);
          setScreen('playing');
        } else {
          setValidationErrors(validation.errors);
        }
      } catch {
        setValidationErrors(['Could not parse JSON file. Ensure the file contains valid JSON syntax.']);
      }
    };
    reader.readAsText(file);
  }, []);

  const handlePlaytestFromEditor = useCallback((levelToTest: LevelData) => {
    setValidationErrors(null);
    setEditorLevel(levelToTest);
    setActiveLevel(levelToTest);
    setPlaytestFromEditor(true);
    setScreen('playing');
  }, []);

  const handleExitGame = useCallback(() => {
    if (playtestFromEditor) {
      setScreen('editor');
    } else {
      setScreen('start');
    }
  }, [playtestFromEditor]);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#05050f] text-white overflow-hidden select-none">
      {screen === 'start' && (
        <StartScreen
          levelPackage={levelPackage}
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          onStart={handleStartSelected}
          onOpenEditor={() => setScreen('editor')}
          onLoadJson={handleLoadJsonLevel}
          hasSongFile={hasSongFile}
          isAudioCached={isAudioCached}
          validationErrors={validationErrors}
          onDismissErrors={() => setValidationErrors(null)}
        />
      )}

      {screen === 'editor' && (
        <ErrorBoundary onExit={() => setScreen('start')}>
          <EditorApp
            onExit={() => setScreen('start')}
            onPlaytest={handlePlaytestFromEditor}
            initialLevel={editorLevel || undefined}
          />
        </ErrorBoundary>
      )}

      {screen === 'playing' && activeLevel && (
        <GameScreen
          level={activeLevel}
          onExit={handleExitGame}
          exitLabel={playtestFromEditor ? 'EDITOR' : 'MENU'}
        />
      )}
    </div>
  );
}

// ---- Start Screen Component ----

interface StartScreenProps {
  levelPackage: LevelPackage;
  selectedDifficulty: DifficultyType;
  onSelectDifficulty: (diff: DifficultyType) => void;
  onStart: () => void;
  onOpenEditor: () => void;
  onLoadJson: (file: File) => void;
  hasSongFile: boolean;
  isAudioCached: boolean;
  validationErrors: string[] | null;
  onDismissErrors: () => void;
}

function StartScreen({
  levelPackage,
  selectedDifficulty,
  onSelectDifficulty,
  onStart,
  onOpenEditor,
  onLoadJson,
  hasSongFile,
  isAudioCached,
  validationErrors,
  onDismissErrors,
}: StartScreenProps) {
  const activeDifficultyOption =
    levelPackage.difficulties.find((d) => d.difficulty === selectedDifficulty) ||
    levelPackage.difficulties[1];

  const difficultyColors: Record<DifficultyType, { bg: string; text: string; border: string; glow: string }> = {
    Easy: {
      bg: 'bg-[#00ff9d]/15',
      text: 'text-[#00ff9d]',
      border: 'border-[#00ff9d]/50',
      glow: 'shadow-[0_0_15px_#00ff9d40]',
    },
    Normal: {
      bg: 'bg-[#00e5ff]/15',
      text: 'text-[#00e5ff]',
      border: 'border-[#00e5ff]/50',
      glow: 'shadow-[0_0_15px_#00e5ff40]',
    },
    Hard: {
      bg: 'bg-[#ff2d6f]/15',
      text: 'text-[#ff2d6f]',
      border: 'border-[#ff2d6f]/50',
      glow: 'shadow-[0_0_15px_#ff2d6f40]',
    },
  };

  const currentTheme = difficultyColors[selectedDifficulty];

  return (
    <div className="relative z-10 w-full h-full overflow-y-auto flex flex-col items-center justify-center px-6 py-8">
      {/* Background ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[130px] opacity-20 animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full blur-[130px] opacity-20 animate-pulse"
          style={{ animationDelay: '0.6s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00ff9d] rounded-full blur-[110px] opacity-15 animate-pulse"
          style={{ animationDelay: '1.2s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-xl w-full">
        {/* Title Header */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-widest text-[#00e5ff] font-semibold flex items-center justify-center gap-1.5">
            <Disc3 className="w-3.5 h-3.5 animate-spin text-[#00e5ff]" />
            PHASE 5 — CONTENT PIPELINE & ASSET MANAGEMENT
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight drop-shadow-2xl">
            <span className="text-[#ff2d6f]">NEON</span>{' '}
            <span className="text-[#00e5ff]">PULSE</span>
          </h1>
          <p className="text-xs md:text-sm text-white/60 font-light tracking-wider uppercase">
            Rhythm Launchpad & Authoring Suite
          </p>
        </div>

        {/* Content & Cache Status Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {/* Audio Source Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-white/70">
            <div
              className={`w-2 h-2 rounded-full ${
                hasSongFile ? 'bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]' : 'bg-[#ffcc00] shadow-[0_0_8px_#ffcc00]'
              } animate-pulse`}
            />
            <span>{hasSongFile ? 'External Audio File' : 'Procedural Synthesizer'}</span>
          </div>

          {/* SongRegistry Buffer Cache Status */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-white/70">
            {isAudioCached ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d]" />
                <span className="text-[#00ff9d]">Audio Resident in RAM Cache</span>
              </>
            ) : (
              <>
                <Activity className="w-3.5 h-3.5 text-white/50" />
                <span>On-Demand Preload Pipeline</span>
              </>
            )}
          </div>
        </div>

        {/* Multi-Difficulty Track Info Card */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-left">
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">{levelPackage.title}</h2>
              <span className="text-xs text-white/50">{levelPackage.artist}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono text-[#00e5ff] font-bold">{levelPackage.bpm} BPM</span>
              <div className="text-xs text-white/40">{Math.round(levelPackage.duration)}s duration</div>
            </div>
          </div>

          {/* Difficulty Selector Tabs */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50 font-medium text-left">Select Difficulty:</span>
            <div className="grid grid-cols-3 gap-2">
              {(['Easy', 'Normal', 'Hard'] as DifficultyType[]).map((diff) => {
                const isSelected = selectedDifficulty === diff;
                const theme = difficultyColors[diff];
                const opt = levelPackage.difficulties.find((d) => d.difficulty === diff);
                return (
                  <button
                    key={diff}
                    onClick={() => onSelectDifficulty(diff)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer border flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? `${theme.bg} ${theme.text} ${theme.border} ${theme.glow}`
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <span className="uppercase tracking-wider">{diff}</span>
                    <span className="text-[10px] font-mono opacity-70">
                      {opt ? `${opt.noteCount} notes` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Level Metadata Summary */}
          <div className="flex items-center justify-between text-xs pt-1 px-1 text-white/60">
            <span>Pattern Density:</span>
            <span className={`font-bold ${currentTheme.text}`}>
              {activeDifficultyOption.noteCount} total notes ({selectedDifficulty})
            </span>
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-col gap-3 items-center w-full">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              id="play-button"
              onClick={onStart}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white text-lg font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff2d6f]/40 cursor-pointer tracking-wider flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>PLAY ({selectedDifficulty.toUpperCase()})</span>
            </button>

            <label
              title="Load external level from .json file"
              className="py-4 px-5 bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold rounded-2xl border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4 text-[#00e5ff]" />
              <span>LOAD JSON</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onLoadJson(file);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            <button
              onClick={onOpenEditor}
              className="py-4 px-5 bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold rounded-2xl border border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
              title="Open Level Editor"
            >
              <Edit3 className="w-4 h-4 text-[#ffcc00]" />
              <span>EDITOR</span>
            </button>
          </div>

          {/* Validation Error Feedback */}
          {validationErrors && validationErrors.length > 0 && (
            <div className="w-full text-left p-4 rounded-xl bg-red-500/20 border border-red-500/40 text-xs text-red-200 backdrop-blur-md flex flex-col gap-2">
              <div className="flex items-center justify-between font-bold text-red-400">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Level Validation Errors ({validationErrors.length})
                </span>
                <button
                  onClick={onDismissErrors}
                  className="text-red-400 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <ul className="list-disc list-inside space-y-1 opacity-90">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Controls hint card */}
          <div className="text-sm text-white/50 mt-1 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm w-full">
            <p className="mb-2 text-white/80 font-medium text-xs">Controls — Press keys or click on pads:</p>
            <div className="grid grid-cols-4 gap-2 justify-center">
              {[
                { key: 'A', label: 'Kick', color: '#ff2d6f' },
                { key: 'S', label: 'Snare', color: '#00e5ff' },
                { key: 'D', label: 'Lead', color: '#ffcc00' },
                { key: 'F', label: 'Alt Lead', color: '#00ff9d' },
              ].map((pad) => (
                <div key={pad.key} className="flex flex-col items-center gap-1">
                  <kbd
                    className="w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg border-2 bg-black/40"
                    style={{ borderColor: pad.color, color: pad.color, boxShadow: `0 0 12px ${pad.color}35` }}
                  >
                    {pad.key}
                  </kbd>
                  <span className="text-[10px] text-white/60 font-semibold">{pad.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
