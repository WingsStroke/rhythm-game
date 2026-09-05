import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPrototypeLevel, SONG_URL } from '@/game/createPrototypeLevel';
import type { LevelData } from '@/engine/types';
import { EditorApp } from '@/editor/EditorApp';
import { ErrorBoundary } from '@/editor/components/ErrorBoundary';
import { GameScreen } from '@/game/GameScreen';
import { Play, Upload, Edit3 } from 'lucide-react';

type Screen = 'start' | 'playing' | 'editor';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [hasSongFile, setHasSongFile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<LevelData | null>(null);
  const [editorLevel, setEditorLevel] = useState<LevelData | null>(null);
  const [playtestFromEditor, setPlaytestFromEditor] = useState(false);

  // Check if external audio file exists in public/audio/
  useEffect(() => {
    fetch(SONG_URL, { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        setHasSongFile(r.ok && !ct.includes('text/html'));
      })
      .catch(() => setHasSongFile(false));
  }, []);

  const defaultPrototypeLevel = useMemo(() => {
    return createPrototypeLevel(hasSongFile ? SONG_URL : undefined);
  }, [hasSongFile]);

  const handleStartDefault = useCallback(() => {
    setErrorMsg(null);
    setActiveLevel(defaultPrototypeLevel);
    setPlaytestFromEditor(false);
    setScreen('playing');
  }, [defaultPrototypeLevel]);

  const handleLoadJsonLevel = useCallback((file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as LevelData;
        if (parsed.formatVersion && parsed.song && Array.isArray(parsed.events)) {
          const sanitized: LevelData = {
            ...parsed,
            visual: {
              nodes: parsed.visual?.nodes || [],
              animations: parsed.visual?.animations || [],
              triggers: parsed.visual?.triggers || [],
              audioMappings: parsed.visual?.audioMappings || [],
              settings: parsed.visual?.settings,
            },
          };
          setActiveLevel(sanitized);
          setPlaytestFromEditor(false);
          setScreen('playing');
        } else {
          setErrorMsg('The JSON file does not have a valid level format.');
        }
      } catch {
        setErrorMsg('Could not parse the JSON file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handlePlaytestFromEditor = useCallback((levelToTest: LevelData) => {
    setErrorMsg(null);
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
          onStart={handleStartDefault}
          onOpenEditor={() => setScreen('editor')}
          onLoadJson={handleLoadJsonLevel}
          hasSongFile={hasSongFile}
          errorMsg={errorMsg}
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
  onStart: () => void;
  onOpenEditor: () => void;
  onLoadJson: (file: File) => void;
  hasSongFile: boolean;
  errorMsg: string | null;
}

function StartScreen({
  onStart,
  onOpenEditor,
  onLoadJson,
  hasSongFile,
  errorMsg,
}: StartScreenProps) {
  return (
    <div className="relative z-10 w-full h-full overflow-y-auto flex flex-col items-center justify-center px-6 py-8">
      {/* Background glow ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff2d6f] rounded-full blur-[130px] opacity-25 animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full blur-[130px] opacity-25 animate-pulse"
          style={{ animationDelay: '0.6s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00ff9d] rounded-full blur-[110px] opacity-15 animate-pulse"
          style={{ animationDelay: '1.2s' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-xl">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-[#00e5ff] font-semibold">
            STAGE 4 — STANDALONE PLAYER & CONTENT PIPELINE
          </span>
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
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              hasSongFile ? 'bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]' : 'bg-[#ffcc00] shadow-[0_0_8px_#ffcc00]'
            } animate-pulse`}
          />
          <span className="text-sm text-white/70">
            {hasSongFile ? 'External Audio File Detected' : 'Procedural Audio Synthesizer (Zero-Assets)'}
          </span>
        </div>

        <div className="flex flex-col gap-4 items-center w-full">
          {/* Main Action Group */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              id="play-button"
              onClick={onStart}
              className="flex-1 py-4 px-6 bg-gradient-to-r from-[#ff2d6f] to-[#00e5ff] text-white text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff2d6f]/40 cursor-pointer tracking-wider flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>PLAY</span>
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

          {errorMsg && (
            <div className="w-full px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-sm text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Controls hint card */}
          <div className="text-sm text-white/50 mt-4 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm w-full">
            <p className="mb-3 text-white/80 font-medium">Controls — Press keys or click on pads:</p>
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
