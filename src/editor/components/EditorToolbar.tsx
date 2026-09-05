import React from 'react';
import { MousePointer, Pencil, Eraser, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
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
  onChangePixelsPerSecond: (fn: (prev: number) => number) => void;
  onQuantize: () => void;
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
  onQuantize,
}: EditorToolbarProps) {
  return (
    <div className="h-11 border-b border-white/10 bg-black/30 flex items-center justify-between px-6 shrink-0 select-none">
      {/* Tool Mode Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onSelectTool('select')}
          title="Select & Move (V)"
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            activeTool === 'select'
              ? 'bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/60 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" /> Select (V)
        </button>
        <button
          onClick={() => onSelectTool('pen')}
          title="Draw / Pen (B)"
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            activeTool === 'pen'
              ? 'bg-[#00ff9d]/25 text-[#00ff9d] border border-[#00ff9d]/60 shadow-[0_0_8px_rgba(0,255,157,0.3)]'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" /> Pen (B)
        </button>
        <button
          onClick={() => onSelectTool('eraser')}
          title="Eraser (E)"
          className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
            activeTool === 'eraser'
              ? 'bg-red-500/25 text-red-400 border border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" /> Eraser (E)
        </button>

        {/* Sub-selector for creation behavior */}
        {activeTool === 'pen' && (
          <div className="flex items-center gap-1 ml-3 pl-3 border-l border-white/10">
            <span className="text-[11px] text-white/40 uppercase font-mono mr-1">Type:</span>
            {(['tap', 'hold', 'loop', 'trigger'] as PadBehavior[]).map((beh) => (
              <button
                key={beh}
                onClick={() => onChangeCreationBehavior(beh)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors ${
                  creationBehavior === beh
                    ? 'bg-white/20 text-white border border-white/40 font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {beh}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Snapping, Quantize & Zoom controls */}
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

        {/* Quantize Button */}
        <button
          onClick={onQuantize}
          title="Quantize selected note (or all notes if none selected) to current grid snap"
          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/90 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#ffea00]" />
          <span>Quantize</span>
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
          <span className="text-[11px] text-white/40 uppercase font-mono">Zoom:</span>
          <button
            onClick={() => onChangePixelsPerSecond((p) => Math.max(60, p - 20))}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-white/60 w-12 text-center">{pixelsPerSecond}px/s</span>
          <button
            onClick={() => onChangePixelsPerSecond((p) => Math.min(260, p + 20))}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
