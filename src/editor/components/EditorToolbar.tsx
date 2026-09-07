import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer,
  Pencil,
  Eraser,
  Box,
  Square,
  Circle,
  Folder,
  ChevronDown,
  Repeat,
  Zap,
  Radio,
  Clock,
  ZoomIn,
  ZoomOut,
  Activity,
} from 'lucide-react';
import type { EditorTool, GridSubdivision } from '../Timeline';
import type { PadBehavior } from '../../engine/types';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  creationBehavior: PadBehavior;
  onChangeCreationBehavior: (behavior: PadBehavior) => void;
  gridSubdivision: GridSubdivision;
  onChangeGridSubdivision: (subdivision: GridSubdivision) => void;
  pixelsPerSecond: number;
  onChangePixelsPerSecond: (fnOrValue: number | ((prev: number) => number)) => void;
  showWaveform?: boolean;
  onToggleWaveform?: () => void;
  selectedPrimitiveType?: 'rectangle' | 'circle' | 'group';
  onSelectPrimitiveType?: (type: 'rectangle' | 'circle' | 'group') => void;
}

export function EditorToolbar({
  activeTool,
  onSelectTool,
  creationBehavior,
  onChangeCreationBehavior,
  gridSubdivision,
  onChangeGridSubdivision,
  pixelsPerSecond,
  onChangePixelsPerSecond,
  showWaveform = true,
  onToggleWaveform,
  selectedPrimitiveType = 'rectangle',
  onSelectPrimitiveType,
}: EditorToolbarProps) {
  const [isPenMenuOpen, setIsPenMenuOpen] = useState(false);
  const [isObjectMenuOpen, setIsObjectMenuOpen] = useState(false);

  const penContainerRef = useRef<HTMLDivElement>(null);
  const objectContainerRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside or Escape
  useEffect(() => {
    if (!isPenMenuOpen && !isObjectMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        penContainerRef.current &&
        !penContainerRef.current.contains(e.target as Node)
      ) {
        setIsPenMenuOpen(false);
      }
      if (
        objectContainerRef.current &&
        !objectContainerRef.current.contains(e.target as Node)
      ) {
        setIsObjectMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPenMenuOpen(false);
        setIsObjectMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPenMenuOpen, isObjectMenuOpen]);

  const setZoom = (val: number | ((prev: number) => number)) => {
    if (typeof val === 'function') {
      onChangePixelsPerSecond((prev: number) => Math.max(40, Math.min(350, val(prev))));
    } else {
      onChangePixelsPerSecond(Math.max(40, Math.min(350, val)));
    }
  };

  const noteTypes: {
    behavior: PadBehavior;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      behavior: 'tap',
      label: 'Tap Note',
      description: 'Single precise hit on beat',
      icon: <Radio className="w-3.5 h-3.5 text-[#00e5ff]" />,
      color: '#00e5ff',
    },
    {
      behavior: 'hold',
      label: 'Hold Note',
      description: 'Sustained press with tail',
      icon: <Clock className="w-3.5 h-3.5 text-[#00ff9d]" />,
      color: '#00ff9d',
    },
    {
      behavior: 'loop',
      label: 'Loop Note',
      description: 'Persistent loop playback bar',
      icon: <Repeat className="w-3.5 h-3.5 text-[#ffea00]" />,
      color: '#ffea00',
    },
    {
      behavior: 'trigger',
      label: 'Trigger Note',
      description: 'Fires audiovisual FX and pulses',
      icon: <Zap className="w-3.5 h-3.5 text-[#ff007f]" />,
      color: '#ff007f',
    },
  ];

  const objectPrimitives: {
    type: 'rectangle' | 'circle' | 'group';
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      type: 'rectangle',
      label: 'Rectangle',
      description: '140x140 geometric quad element',
      icon: <Square className="w-3.5 h-3.5 text-[#00e5ff]" />,
      color: '#00e5ff',
    },
    {
      type: 'circle',
      label: 'Circle',
      description: 'Radius 70 radial element',
      icon: <Circle className="w-3.5 h-3.5 text-[#ff007f]" />,
      color: '#ff007f',
    },
    {
      type: 'group',
      label: 'Group Container',
      description: 'Hierarchical node container',
      icon: <Folder className="w-3.5 h-3.5 text-[#ffea00]" />,
      color: '#ffea00',
    },
  ];

  return (
    <div className="h-11 border-b border-white/10 bg-black/30 flex items-center justify-between px-4 gap-2 shrink-0 select-none overflow-visible relative z-40">
      <style>{`
        @keyframes toolbarMenuStagger {
          0% {
            opacity: 0;
            transform: translateY(-6px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Tool Mode Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Select Tool */}
        <button
          onClick={() => {
            onSelectTool('select');
            setIsPenMenuOpen(false);
            setIsObjectMenuOpen(false);
          }}
          title="Select & Move (V)"
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTool === 'select'
              ? 'bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/60 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" /> Select (V)
        </button>

        {/* Pen Tool with Floating Mini-Modal */}
        <div ref={penContainerRef} className="relative">
          <button
            onClick={() => {
              onSelectTool('pen');
              setIsPenMenuOpen((prev) => !prev);
              setIsObjectMenuOpen(false);
            }}
            title="Draw Notes / Pen (B) — Click to choose note type"
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'pen'
                ? 'bg-[#00ff9d]/25 text-[#00ff9d] border border-[#00ff9d]/60 shadow-[0_0_8px_rgba(0,255,157,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Pen (B)</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/10 uppercase font-semibold text-white/90">
              {creationBehavior}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isPenMenuOpen ? 'rotate-180 text-[#00ff9d]' : 'text-white/40'}`} />
          </button>

          {/* Floating Staggered Dropdown Menu for Pen Note Types */}
          {isPenMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-[#0c0d16] border border-[#25283c] rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.9)] p-1.5 z-[100] flex flex-col gap-1 pointer-events-auto">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/40 border-b border-white/10 flex items-center justify-between">
                <span>Select Note Type</span>
                <span className="text-[#00ff9d]">Pen Tool</span>
              </div>
              {noteTypes.map((item, index) => (
                <button
                  key={item.behavior}
                  onClick={() => {
                    onChangeCreationBehavior(item.behavior);
                    onSelectTool('pen');
                    setIsPenMenuOpen(false);
                  }}
                  style={{
                    animation: 'toolbarMenuStagger 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
                    animationDelay: `${index * 35}ms`,
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    creationBehavior === item.behavior
                      ? 'bg-white/15 text-white border border-white/30 font-semibold shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-white/90">{item.label}</span>
                      <span className="text-[10px] text-white/40 font-mono">{item.description}</span>
                    </div>
                  </div>
                  {creationBehavior === item.behavior && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Object (O) Tool with Floating Mini-Modal */}
        <div ref={objectContainerRef} className="relative">
          <button
            onClick={() => {
              onSelectTool('object');
              setIsObjectMenuOpen((prev) => !prev);
              setIsPenMenuOpen(false);
            }}
            title="Place Visual Object (O) — Click to choose primitive"
            className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === 'object'
                ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Object (O)</span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/10 uppercase font-semibold text-white/90">
              {selectedPrimitiveType}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isObjectMenuOpen ? 'rotate-180 text-emerald-400' : 'text-white/40'}`} />
          </button>

          {/* Floating Staggered Dropdown Menu for Object Primitives */}
          {isObjectMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-[#0c0d16] border border-[#25283c] rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.9)] p-1.5 z-[100] flex flex-col gap-1 pointer-events-auto">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-white/40 border-b border-white/10 flex items-center justify-between">
                <span>Select Visual Primitive</span>
                <span className="text-emerald-400">Object Tool</span>
              </div>
              {objectPrimitives.map((item, index) => (
                <button
                  key={item.type}
                  onClick={() => {
                    onSelectPrimitiveType?.(item.type);
                    onSelectTool('object');
                    setIsObjectMenuOpen(false);
                  }}
                  style={{
                    animation: 'toolbarMenuStagger 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
                    animationDelay: `${index * 35}ms`,
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedPrimitiveType === item.type
                      ? 'bg-white/15 text-white border border-white/30 font-semibold shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-white/90">{item.label}</span>
                      <span className="text-[10px] text-white/40 font-mono">{item.description}</span>
                    </div>
                  </div>
                  {selectedPrimitiveType === item.type && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Eraser Tool */}
        <button
          onClick={() => {
            onSelectTool('eraser');
            setIsPenMenuOpen(false);
            setIsObjectMenuOpen(false);
          }}
          title="Eraser (E)"
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-red-500/25 text-red-400 border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" /> Eraser (E)
        </button>
      </div>

      {/* Grid Snapping & Zoom controls */}
      <div className="flex items-center gap-4">
        {/* Snap Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-white/40 uppercase font-mono">Snap:</span>
          <select
            value={gridSubdivision}
            onChange={(e) => onChangeGridSubdivision(e.target.value as GridSubdivision)}
            className="bg-black/60 border border-white/20 rounded px-2 py-0.5 text-xs text-white/90 outline-none focus:border-[#00e5ff] font-mono cursor-pointer"
          >
            <option value="1/1">1/1 (Bar)</option>
            <option value="1/2">1/2 (Half)</option>
            <option value="1/4">1/4 (Beat)</option>
            <option value="1/8">1/8 (8th)</option>
            <option value="1/16">1/16 (16th)</option>
            <option value="free">Free (Off)</option>
          </select>
        </div>

        {/* Waveform Background Toggle */}
        {onToggleWaveform && (
          <button
            onClick={onToggleWaveform}
            title="Toggle background audio waveform (W)"
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showWaveform
                ? 'bg-[#00e5ff]/20 text-[#00e5ff] border-[#00e5ff]/50 shadow-[0_0_8px_rgba(0,229,255,0.25)]'
                : 'text-white/40 hover:text-white/80 hover:bg-white/5 border-white/10'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            WAVE
          </button>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="text-[11px] text-white/40 uppercase font-mono">Zoom:</span>
          <button
            onClick={() => setZoom((p) => Math.max(40, p - 20))}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Zoom out (Ctrl + Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="40"
            max="350"
            step="5"
            value={pixelsPerSecond}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-16 h-1.5 accent-[#00e5ff] bg-white/10 rounded-lg cursor-pointer appearance-none"
            title={`Zoom scale: ${pixelsPerSecond}px/s (Ctrl + Mouse Wheel)`}
          />
          <span className="text-xs font-mono text-white/60 w-14 text-center">{pixelsPerSecond}px/s</span>
          <button
            onClick={() => setZoom((p) => Math.min(350, p + 20))}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Zoom in (Ctrl + Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
