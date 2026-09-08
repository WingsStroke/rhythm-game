import React, { useState, useRef } from 'react';
import { SongRegistry } from '@/engine/content/SongRegistry';
import { LevelValidator } from '@/engine/content/LevelValidator';
import { BeatmapGenerator } from '@/engine/beatmap/BeatmapGenerator';
import { SONG_URL } from '@/game/createPrototypeLevel';
import type { LevelData } from '@/engine/types';
import {
  UploadCloud,
  FileAudio,
  Play,
  Sliders,
  AlertCircle,
  X,
  Disc,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface EditorSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (level: LevelData) => void;
  initialLevel?: LevelData | null;
}

type WizardStage = 'form' | 'processing' | 'error';

export const EditorSetupWizard: React.FC<EditorSetupWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  initialLevel,
}) => {
  const [stage, setStage] = useState<WizardStage>('form');
  const [title, setTitle] = useState(initialLevel?.song.title || 'Neon Pulse');
  const [artist, setArtist] = useState(initialLevel?.song.artist || 'Antigravity');
  const [bpm, setBpm] = useState<number>(initialLevel?.song.bpm || 128);
  const [leadInSeconds, setLeadInSeconds] = useState<number>(2.0);
  const [songOffsetMs, setSongOffsetMs] = useState<number>(
    initialLevel?.timing?.offset ? Math.round(initialLevel.timing.offset * 1000) : 0
  );

  const [audioSource, setAudioSource] = useState<'default' | 'file' | 'prototypeLevel'>(
    initialLevel ? 'prototypeLevel' : 'default'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonImportFile, setJsonImportFile] = useState<File | null>(null);

  // Progress state
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStatusText, setCurrentStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const f = files[0];
      if (f.name.endsWith('.json')) {
        setJsonImportFile(f);
      } else {
        setSelectedFile(f);
        setAudioSource('file');
        const inferredName = f.name.replace(/\.[^/.]+$/, '');
        if (!title || title === 'Neon Pulse') {
          setTitle(inferredName);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      setSelectedFile(f);
      setAudioSource('file');
      const inferredName = f.name.replace(/\.[^/.]+$/, '');
      if (!title || title === 'Neon Pulse') {
        setTitle(inferredName);
      }
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setJsonImportFile(e.target.files[0]);
    }
  };

  const handlePreloadDefault = () => {
    setTitle('Neon Pulse');
    setArtist('Audio Prototype');
    setBpm(128);
    setLeadInSeconds(2.0);
    setSongOffsetMs(0);
    setAudioSource('default');
    setSelectedFile(null);
    setJsonImportFile(null);
  };

  const handleStartIngestion = async () => {
    setStage('processing');
    setErrorMessage(null);
    setProgressPercent(10);
    setCurrentStatusText('Initializing audio context and reading assets...');

    try {
      // 0. If JSON beatmap import is provided, prioritize it
      if (jsonImportFile) {
        setCurrentStatusText('Parsing and validating Level JSON...');
        setProgressPercent(30);
        const text = await jsonImportFile.text();
        const parsed = JSON.parse(text);
        const validation = LevelValidator.validate(parsed);
        if (!validation.valid || !validation.sanitizedLevel) {
          throw new Error(`Invalid level JSON:\n${validation.errors.join('\n')}`);
        }
        setProgressPercent(100);
        setCurrentStatusText('Level verified. Hydrating editor...');
        setTimeout(() => {
          onComplete(validation.sanitizedLevel!);
        }, 250);
        return;
      }

      // If user wants to open the current level in memory without changes
      if (audioSource === 'prototypeLevel' && initialLevel) {
        setProgressPercent(100);
        setCurrentStatusText('Opening existing level...');
        setTimeout(() => {
          onComplete(initialLevel);
        }, 150);
        return;
      }

      // 1. Resolve Audio Buffer
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();

      let arrayBuffer: ArrayBuffer;
      let audioUrl: string | undefined = undefined;

      if (audioSource === 'file' && selectedFile) {
        setCurrentStatusText(`Reading audio stream from "${selectedFile.name}"...`);
        setProgressPercent(25);
        arrayBuffer = await selectedFile.arrayBuffer();
        audioUrl = URL.createObjectURL(selectedFile);
      } else {
        setCurrentStatusText(`Fetching prototype audio from ${SONG_URL}...`);
        setProgressPercent(25);
        try {
          const res = await fetch(SONG_URL);
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          arrayBuffer = await res.arrayBuffer();
          audioUrl = SONG_URL;
        } catch {
          // Fallback to synthetic blank buffer if external file not available
          setCurrentStatusText('No external audio file found. Generating synthesis clock...');
          arrayBuffer = new ArrayBuffer(0);
        }
      }

      let decodedBuffer: AudioBuffer | null = null;

      if (arrayBuffer.byteLength > 0) {
        setCurrentStatusText('Decoding native PCM samples with AudioContext...');
        setProgressPercent(50);
        decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      }

      // 3. Register audio in SongRegistry
      setCurrentStatusText('Caching decoded audio buffer in SongRegistry...');
      setProgressPercent(85);
      const songId = `song-${Date.now()}`;
      if (decodedBuffer) {
        SongRegistry.getInstance().setAudioBuffer(songId, decodedBuffer);
      }

      // 4. Construct LevelData structure
      setCurrentStatusText('Constructing verified LevelData structure...');
      setProgressPercent(92);

      const duration = decodedBuffer ? decodedBuffer.duration : 120;

      const newLevel: LevelData = {
        formatVersion: 1,
        metadata: {
          id: `level-${Date.now()}`,
          name: title.trim() || 'Untitled Track',
          difficulty: 'Normal',
          author: artist.trim() || 'Custom Author',
        },
        songId,
        song: {
          id: songId,
          title: title.trim() || 'Untitled Track',
          artist: artist.trim() || 'Custom Artist',
          bpm: Math.max(40, Math.min(300, Number(bpm) || 128)),
          offset: (Number(songOffsetMs) || 0) / 1000,
          duration,
          url: audioUrl,
        },
        pads: BeatmapGenerator.defaultPads(),
        events: [],
        timing: {
          bpm: Math.max(40, Math.min(300, Number(bpm) || 128)),
          offset: (Number(songOffsetMs) || 0) / 1000,
          windows: { perfect: 0.045, good: 0.090, miss: 0.150 },
        },
        visual: {
          nodes: [],
          animations: [],
          triggers: [],
          audioMappings: [],
        },
      };

      // 5. Deep validation
      const validation = LevelValidator.validate(newLevel);
      if (!validation.valid || !validation.sanitizedLevel) {
        throw new Error(`Validation error: ${validation.errors.join(', ')}`);
      }

      setProgressPercent(100);
      setCurrentStatusText('Pipeline ingestion complete. Mounting editor...');

      setTimeout(() => {
        onComplete(validation.sanitizedLevel!);
      }, 250);
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-[#0a0a16] border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(0,229,255,0.15)] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wider text-white uppercase flex items-center gap-2">
                Level Editor Setup Wizard
              </h2>
              <p className="text-xs text-white/50">
                Standard Ingestion Pipeline & Audio Synchronization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {stage === 'form' && (
            <>
              {/* Quick Preset Choice */}
              <div className="flex items-center justify-between bg-cyan-950/20 border border-cyan-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-white/80 font-medium">
                    Quick Track Presets
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreloadDefault}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all"
                  >
                    Reset to Default Prototype
                  </button>
                  {initialLevel && (
                    <button
                      type="button"
                      onClick={() => setAudioSource('prototypeLevel')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all ${
                        audioSource === 'prototypeLevel'
                          ? 'bg-purple-600 text-white border-purple-400'
                          : 'bg-purple-950/30 text-purple-300 border-purple-500/30 hover:bg-purple-900/40'
                      }`}
                    >
                      Keep Current Memory Level
                    </button>
                  )}
                </div>
              </div>

              {/* Grid: Title & Artist */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Song Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Track Title"
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-white/15 rounded-lg text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Artist / Band
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Composer or Band"
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-white/15 rounded-lg text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
              </div>

              {/* Grid: BPM, Lead-In, Offset */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={300}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-white/15 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Lead-In (s)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={0.5}
                    max={5.0}
                    value={leadInSeconds}
                    onChange={(e) => setLeadInSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-white/15 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Offset (ms)
                  </label>
                  <input
                    type="number"
                    step={5}
                    min={-500}
                    max={500}
                    value={songOffsetMs}
                    onChange={(e) => setSongOffsetMs(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-black/50 border border-white/15 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                </div>
              </div>

              {/* Audio File Selection / Drag & Drop */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center justify-between">
                  <span>Audio Source</span>
                  {selectedFile && (
                    <span className="text-cyan-400 font-mono text-[11px] font-normal">
                      {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  )}
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : selectedFile
                        ? 'border-cyan-500/40 bg-cyan-950/10'
                        : 'border-white/15 bg-white/[0.01] hover:border-white/30 hover:bg-white/[0.03]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mp3,audio/wav,audio/ogg,audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                    {selectedFile ? <FileAudio className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                  </div>

                  <p className="text-xs text-white/80 font-medium">
                    {selectedFile
                      ? 'Click or drop to replace selected audio file'
                      : 'Drag and drop an audio file (.mp3, .wav, .ogg) or click to browse'}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    {audioSource === 'default' && !selectedFile
                      ? 'Currently configured to use prototype audio (/audio/song.mp3)'
                      : 'File will be decoded native into SongRegistry with zero network lag'}
                  </p>
                </div>
              </div>

              {/* Optional JSON import dropzone */}
              <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-white/50" />
                  <span className="text-xs text-white/60">
                    {jsonImportFile ? `Importing JSON: ${jsonImportFile.name}` : 'Or import existing beatmap JSON'}
                  </span>
                </div>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleJsonChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 transition-colors"
                >
                  Browse JSON
                </button>
              </div>
            </>
          )}

          {/* Processing / Ingestion Progress Stage */}
          {stage === 'processing' && (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin flex items-center justify-center" />
                <Disc className="w-7 h-7 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  Processing & Ingesting Level Data
                </h3>
                <p className="text-xs text-cyan-300 font-mono">
                  {currentStatusText}
                </p>
              </div>

              <div className="w-full bg-black/60 rounded-full h-2.5 border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(0,229,255,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-white/40 font-mono">
                {progressPercent}% Complete
              </p>
            </div>
          )}

          {/* Error Stage */}
          {stage === 'error' && (
            <div className="py-6 px-4 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-red-400 uppercase">
                  Ingestion Pipeline Error
                </h3>
                <p className="text-xs text-white/70 max-w-md whitespace-pre-wrap font-mono">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => setStage('form')}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Return to Setup Form
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {stage === 'form' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartIngestion}
              className="px-6 py-2.5 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all flex items-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Launch Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
