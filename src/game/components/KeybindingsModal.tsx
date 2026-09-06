import React, { useState, useEffect, useCallback } from 'react';
import { X, Keyboard, RotateCcw, Check, Gamepad2, AlertCircle } from 'lucide-react';
import {
  type KeybindingMap,
  loadUserKeybindings,
  saveUserKeybindings,
  resetUserKeybindings,
  assignPadKey,
  formatKeyCode,
  getBoundKeyForPad,
} from '../../engine/input/Keybindings';

interface PadMeta {
  id: string;
  label: string;
  defaultColor: string;
  defaultKey: string;
}

const PAD_METAS: PadMeta[] = [
  { id: 'pad_0', label: 'Kick', defaultColor: '#ff2d6f', defaultKey: 'KeyA' },
  { id: 'pad_1', label: 'Snare', defaultColor: '#00e5ff', defaultKey: 'KeyS' },
  { id: 'pad_2', label: 'Lead', defaultColor: '#ffcc00', defaultKey: 'KeyD' },
  { id: 'pad_3', label: 'Alt Lead', defaultColor: '#00ff9d', defaultKey: 'KeyF' },
];

interface KeybindingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBindingsChange?: (bindings: KeybindingMap) => void;
}

export const KeybindingsModal: React.FC<KeybindingsModalProps> = ({
  isOpen,
  onClose,
  onBindingsChange,
}) => {
  const [bindings, setBindings] = useState<KeybindingMap>(() => loadUserKeybindings());
  const [listeningPadId, setListeningPadId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const current = loadUserKeybindings();
      setBindings(current);
      setListeningPadId(null);
      setStatusMessage(null);
    }
  }, [isOpen]);

  // Global keydown listener when listening for a new key binding or closing on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listeningPadId) {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setListeningPadId(null);
        setStatusMessage('Cancelled key assignment.');
        return;
      }

      // Ignore lone modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const targetPad = listeningPadId;
      const newKeyCode = e.code;
      const previousOwner = bindings[newKeyCode];
      const previousKeyForTarget = getBoundKeyForPad(bindings, targetPad);

      const nextBindings = assignPadKey(bindings, targetPad, newKeyCode);
      setBindings(nextBindings);
      saveUserKeybindings(nextBindings);
      onBindingsChange?.(nextBindings);
      setListeningPadId(null);

      if (previousOwner && previousOwner !== targetPad) {
        const prevTargetName = PAD_METAS.find((p) => p.id === previousOwner)?.label || previousOwner;
        const currentTargetName = PAD_METAS.find((p) => p.id === targetPad)?.label || targetPad;
        const swappedKeyName = previousKeyForTarget ? formatKeyCode(previousKeyForTarget) : '?';
        setStatusMessage(
          `Swapped: ${formatKeyCode(newKeyCode)} for ${currentTargetName}, ${swappedKeyName} moved to ${prevTargetName}.`
        );
      } else {
        const currentTargetName = PAD_METAS.find((p) => p.id === targetPad)?.label || targetPad;
        setStatusMessage(`Assigned ${formatKeyCode(newKeyCode)} to ${currentTargetName}.`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, listeningPadId, bindings, onClose, onBindingsChange]);

  const handleResetDefaults = useCallback(() => {
    const defaults = resetUserKeybindings();
    setBindings(defaults);
    onBindingsChange?.(defaults);
    setListeningPadId(null);
    setStatusMessage('Controls reset to default A, S, D, F.');
  }, [onBindingsChange]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !listeningPadId) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-xl bg-[#0c0d18] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00e5ff]/10 border border-[#00e5ff]/30 flex items-center justify-center text-[#00e5ff]">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">
                Keyboard Controls Configuration
              </h2>
              <p className="text-xs text-white/50 font-mono">
                Global key mapping for all game modes and songs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Status Message / Hint Banner */}
          {listeningPadId ? (
            <div className="px-4 py-3 bg-[#00e5ff]/10 border border-[#00e5ff]/40 rounded-xl flex items-center gap-3 text-xs text-[#00e5ff] font-mono animate-pulse">
              <Gamepad2 className="w-4 h-4 flex-shrink-0" />
              <span>
                Listening for input: Press any keyboard key to rebind{' '}
                <strong>
                  {PAD_METAS.find((p) => p.id === listeningPadId)?.label || listeningPadId}
                </strong>
                . (Press Escape to cancel)
              </span>
            </div>
          ) : statusMessage ? (
            <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2.5 text-xs text-white/80 font-mono">
              <Check className="w-3.5 h-3.5 text-[#00ff9d] flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-xl flex items-center gap-2.5 text-xs text-white/50 font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              <span>
                Click on any pad key button below, then press the desired keyboard key to reassign it.
              </span>
            </div>
          )}

          {/* 4 Pads Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAD_METAS.map((pad, index) => {
              const boundKey = getBoundKeyForPad(bindings, pad.id);
              const displayKey = boundKey ? formatKeyCode(boundKey) : '?';
              const isListening = listeningPadId === pad.id;

              return (
                <div
                  key={pad.id}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    isListening
                      ? 'bg-[#00e5ff]/10 border-[#00e5ff] shadow-[0_0_16px_rgba(0,229,255,0.25)] scale-105'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <span className="text-[10px] font-mono text-white/40 uppercase">
                      Pad #{index + 1}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: pad.defaultColor }}
                    />
                  </div>

                  <span className="text-xs font-bold text-white/90 font-mono">
                    {pad.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setListeningPadId(isListening ? null : pad.id);
                      setStatusMessage(null);
                    }}
                    className={`w-full h-14 rounded-xl font-mono font-black text-xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isListening
                        ? 'border-[#00e5ff] bg-[#00e5ff]/20 text-[#00e5ff] animate-pulse'
                        : 'border-white/20 bg-black/40 text-white hover:border-white/40 hover:bg-black/60'
                    }`}
                    style={{
                      borderColor: isListening ? '#00e5ff' : `${pad.defaultColor}80`,
                      color: isListening ? '#00e5ff' : pad.defaultColor,
                      boxShadow: isListening
                        ? '0 0 16px rgba(0,229,255,0.3)'
                        : `0 0 12px ${pad.defaultColor}25`,
                    }}
                    title="Click to rebind this key"
                  >
                    {isListening ? '...' : displayKey}
                  </button>

                  <span className="text-[9px] text-white/40 font-mono text-center">
                    {isListening ? 'Press key' : 'Click to edit'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-white/40 font-mono space-y-1 bg-black/30 p-3 rounded-xl border border-white/5">
            <p>Conflicts are handled automatically: assigning an in-use key swaps keys between the two pads.</p>
            <p>Saved preferences persist globally in your browser across sessions.</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Reset to standard A, S, D, F layout"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white/60" />
            <span>Reset to Defaults (A S D F)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00e5ff] hover:bg-[#00c8e0] text-black font-mono font-bold text-xs transition-all shadow-[0_0_16px_rgba(0,229,255,0.3)] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
