import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Music,
  Radio,
  Clock,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle2,
  FileAudio,
  Keyboard,
} from 'lucide-react';
import type { LevelData, PadConfig, PadId, ModulationChannel } from '../../engine/types';

interface SongPadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: LevelData;
  onChangeLevel: (newLevel: LevelData) => void;
  audioFileName?: string;
}

const MODULATION_CHANNELS: ModulationChannel[] = ['bass', 'mids', 'treble', 'ambient'];

const PAD_ROLES = [
  'kick',
  'snare',
  'drums',
  'bass',
  'lead',
  'synth',
  'vocal',
  'fx',
  'custom',
] as const;

export function SongPadsModal({
  isOpen,
  onClose,
  level,
  onChangeLevel,
  audioFileName,
}: SongPadsModalProps) {
  const [activeTab, setActiveTab] = useState<'song' | 'pads'>('song');

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Offset in milliseconds (stored as seconds in level.timing.offset)
  const currentOffsetSec = level.timing?.offset ?? 0;
  const currentOffsetMs = Math.round(currentOffsetSec * 1000);

  const setOffsetMs = (ms: number) => {
    const sec = Number((ms / 1000).toFixed(4));
    onChangeLevel({
      ...level,
      timing: {
        ...level.timing,
        offset: sec,
      },
    });
  };

  const updateSongField = (field: 'title' | 'artist' | 'bpm' | 'duration', value: string | number) => {
    const updatedSong = { ...level.song, [field]: value };
    let updatedTiming = level.timing;
    if (field === 'bpm') {
      updatedTiming = { ...level.timing, bpm: Number(value) };
    }
    onChangeLevel({
      ...level,
      song: updatedSong,
      timing: updatedTiming,
    });
  };

  const updatePadField = (padId: PadId, updates: Partial<PadConfig>) => {
    const updatedPads = level.pads.map((p) => (p.id === padId ? { ...p, ...updates } : p));
    onChangeLevel({
      ...level,
      pads: updatedPads,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#0d0f18] border border-[#24293e] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-settings-title"
      >
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#00e5ff]" />
            <h2 id="modal-settings-title" className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              Project & Pad Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Settings Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 text-xs font-mono shrink-0">
          <button
            onClick={() => setActiveTab('song')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors border-b-2 font-semibold cursor-pointer ${
              activeTab === 'song'
                ? 'border-[#00e5ff] text-[#00e5ff] bg-white/[0.03]'
                : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.01]'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Song Configuration</span>
          </button>
          <button
            onClick={() => setActiveTab('pads')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors border-b-2 font-semibold cursor-pointer ${
              activeTab === 'pads'
                ? 'border-[#00e5ff] text-[#00e5ff] bg-white/[0.03]'
                : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.01]'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Pads Matrix ({level.pads.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeTab === 'song' ? (
            <div className="space-y-6">
              {/* Song Metadata Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-wider font-mono">
                  <Music className="w-3.5 h-3.5 text-[#00e5ff]" />
                  <span>Metadata & Timing</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Song Title</label>
                    <input
                      type="text"
                      value={level.song.title}
                      onChange={(e) => updateSongField('title', e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-[#00e5ff] outline-none"
                      placeholder="e.g. Cybernetic Pulse"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Artist</label>
                    <input
                      type="text"
                      value={level.song.artist || ''}
                      onChange={(e) => updateSongField('artist', e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-[#00e5ff] outline-none"
                      placeholder="e.g. SynthWave Studio"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Beats Per Minute (BPM)</label>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={level.timing.bpm}
                      onChange={(e) => updateSongField('bpm', Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-[#00e5ff] outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Track Duration (Seconds)</label>
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      value={level.song.duration}
                      onChange={(e) => updateSongField('duration', Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:border-[#00e5ff] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Audio Offset Calibration Section */}
              <div className="border border-[#2a2f47] bg-[#111422] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#00ff9d]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Audio Offset Calibration
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#00ff9d]/10 border border-[#00ff9d]/30 text-[#00ff9d] font-bold">
                    {currentOffsetMs > 0 ? `+${currentOffsetMs} ms` : `${currentOffsetMs} ms`}
                  </span>
                </div>

                <p className="text-xs text-white/50 leading-relaxed">
                  Calibrates the delay between the audio file and note spawn. Positive values delay notes (if audio starts with silence); negative values advance them.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setOffsetMs(currentOffsetMs - 10)}
                    title="-10 ms"
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Minus className="w-3 h-3" /> 10
                  </button>
                  <button
                    onClick={() => setOffsetMs(currentOffsetMs - 1)}
                    title="-1 ms"
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Minus className="w-3 h-3" /> 1
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="number"
                      step={1}
                      value={currentOffsetMs}
                      onChange={(e) => setOffsetMs(Number(e.target.value))}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-center text-sm font-mono font-bold text-[#00ff9d] focus:border-[#00ff9d] outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs font-mono text-white/40 pointer-events-none">ms</span>
                  </div>

                  <button
                    onClick={() => setOffsetMs(currentOffsetMs + 1)}
                    title="+1 ms"
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 1
                  </button>
                  <button
                    onClick={() => setOffsetMs(currentOffsetMs + 10)}
                    title="+10 ms"
                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-lg text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" /> 10
                  </button>

                  <button
                    onClick={() => setOffsetMs(0)}
                    title="Reset offset to 0 ms"
                    disabled={currentOffsetMs === 0}
                    className={`p-2 rounded-lg border text-xs font-mono transition-colors ${
                      currentOffsetMs !== 0
                        ? 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
                        : 'border-white/5 bg-transparent text-white/20 cursor-not-allowed'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Audio Source Status Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-wider font-mono">
                  <FileAudio className="w-3.5 h-3.5 text-[#00e5ff]" />
                  <span>Audio Source</span>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff]">
                      <FileAudio className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white/90">
                        {audioFileName || 'Bundled Synthetic Master Track'}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono">
                        {audioFileName ? 'Custom user audio stream' : 'Built-in procedural WebAudio synthesizer'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#00ff9d] font-mono font-semibold bg-[#00ff9d]/10 px-2.5 py-1 rounded-full border border-[#00ff9d]/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Loaded</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Pads Matrix Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-wider font-mono">
                  <Radio className="w-3.5 h-3.5 text-[#00e5ff]" />
                  <span>Interactive Pads Configuration</span>
                </div>
                <span className="text-xs text-white/40 font-mono">
                  {level.pads.length} active channels
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {level.pads.map((pad, index) => (
                  <div
                    key={pad.id}
                    className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl space-y-3 relative hover:border-white/20 transition-colors"
                  >
                    {/* Pad Card Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <label
                          className="relative w-6 h-6 rounded-lg cursor-pointer border border-white/20 shadow-inner flex items-center justify-center shrink-0 overflow-hidden"
                          style={{ backgroundColor: pad.color }}
                          title="Change Pad Color"
                        >
                          <input
                            type="color"
                            value={pad.color}
                            onChange={(e) => updatePadField(pad.id, { color: e.target.value })}
                            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                          />
                        </label>
                        <div>
                          <span className="text-[10px] font-mono text-white/40 uppercase block leading-none">
                            Pad #{index + 1}
                          </span>
                          <span className="text-xs font-bold font-mono text-white/90">
                            {pad.id}
                          </span>
                        </div>
                      </div>

                      {/* Key Hint Badge */}
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                        <Keyboard className="w-3 h-3 text-[#00e5ff]" />
                        <input
                          type="text"
                          maxLength={1}
                          value={pad.keyHint || ''}
                          onChange={(e) =>
                            updatePadField(pad.id, { keyHint: e.target.value.toUpperCase() })
                          }
                          className="w-4 bg-transparent text-xs font-mono font-bold text-white text-center outline-none uppercase"
                          placeholder="?"
                        />
                      </div>
                    </div>

                    {/* Pad Inputs */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10px] text-white/50 mb-1 font-mono">Label</label>
                        <input
                          type="text"
                          value={pad.label}
                          onChange={(e) => updatePadField(pad.id, { label: e.target.value })}
                          className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:border-[#00e5ff] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-white/50 mb-1 font-mono">Audio Channel</label>
                        <select
                          value={pad.audioChannel || 'ambient'}
                          onChange={(e) =>
                            updatePadField(pad.id, {
                              audioChannel: e.target.value as ModulationChannel,
                            })
                          }
                          className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:border-[#00e5ff] outline-none cursor-pointer"
                        >
                          {MODULATION_CHANNELS.map((ch) => (
                            <option key={ch} value={ch} className="bg-[#111422] text-white">
                              {ch.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-white/50 mb-1 font-mono">Role Semantic</label>
                        <select
                          value={pad.role || 'custom'}
                          onChange={(e) =>
                            updatePadField(pad.id, {
                              role: e.target.value as PadConfig['role'],
                            })
                          }
                          className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:border-[#00e5ff] outline-none cursor-pointer"
                        >
                          {PAD_ROLES.map((role) => (
                            <option key={role} value={role} className="bg-[#111422] text-white">
                              {role.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-14 px-6 border-t border-white/10 flex items-center justify-end bg-black/40 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00e5ff] text-black font-bold text-xs rounded-xl hover:bg-[#00e5ff]/90 transition-all shadow-md shadow-[#00e5ff]/20 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
