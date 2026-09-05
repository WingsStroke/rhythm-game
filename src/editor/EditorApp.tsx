import React, { useState } from 'react';
import { Timeline, type EditorTool, type GridSubdivision } from './Timeline';
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorSidebarLeft } from './components/EditorSidebarLeft';
import { EditorPropertiesPanel } from './components/EditorPropertiesPanel';
import { useEditorEngine } from './hooks/useEditorEngine';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { INITIAL_LEVEL } from './constants';
import type { LevelData, PadEvent, PadBehavior, SceneNodeData } from '../engine/types';
import { ListVideo, Gamepad2 } from 'lucide-react';

type EditorTab = 'timeline' | 'preview';

export function EditorApp({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState<LevelData>(INITIAL_LEVEL);
  const [activeTab, setActiveTab] = useState<EditorTab>('timeline');

  // Authoring tools state
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [creationBehavior, setCreationBehavior] = useState<PadBehavior>('tap');
  const [gridSubdivision, setGridSubdivision] = useState<GridSubdivision>('1/4');
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(120);

  // Selection state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modular Engine hook (AudioTransport, VisualEngine, GameplayEngine, InputManager, EventBus)
  const {
    canvasContainerRef,
    isPlaying,
    currentTime,
    togglePlay,
    handleStop,
    handleSeek,
    updateSceneNode,
    dispose,
  } = useEditorEngine({
    level,
    activeTab,
    onSelectNode: (id) => {
      setSelectedNodeId(id);
      setSelectedEventId(null);
    },
  });

  // Event mutations
  const handleAddEvent = (newEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = [...prev.events, newEvent].sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
    setSelectedEventId(newEvent.id);
    setSelectedNodeId(null);
  };

  const handleUpdateEvent = (updatedEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = prev.events
        .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  };

  const handleRemoveEvent = (id: string) => {
    setLevel((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    if (selectedEventId === id) {
      setSelectedEventId(null);
    }
  };

  const handleUpdateNode = (updates: Partial<SceneNodeData>) => {
    const selectedNode = level.visual.nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) return;
    const newNode = { ...selectedNode, ...updates } as SceneNodeData;
    setLevel((prev) => {
      const idx = prev.visual.nodes.findIndex((n) => n.id === newNode.id);
      if (idx === -1) return prev;
      const newNodes = [...prev.visual.nodes];
      newNodes[idx] = newNode;
      return { ...prev, visual: { ...prev.visual, nodes: newNodes } };
    });
    updateSceneNode(newNode);
  };

  // Keyboard shortcuts hook (V, B, E, Del, Space)
  useEditorShortcuts({
    activeTab,
    selectedEventId,
    onSelectTool: setActiveTool,
    onDeleteSelectedEvent: () => {
      if (selectedEventId) handleRemoveEvent(selectedEventId);
    },
    onTogglePlay: togglePlay,
  });

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(level, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${level.song.title.toLowerCase().replace(/\s+/g, '_')}_level.json`);
    dlAnchorElem.click();
  };

  const selectedEvent = level.events.find((e) => e.id === selectedEventId) || null;
  const selectedNode = level.visual.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0b0b12] text-white select-none">
      {/* Top Header & Transport Controls */}
      <EditorHeader
        bpm={level.timing.bpm}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onStop={handleStop}
        onExport={handleExport}
        onExit={() => {
          dispose();
          onExit();
        }}
      />

      {/* Authoring Toolbar */}
      <EditorToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        creationBehavior={creationBehavior}
        onChangeCreationBehavior={setCreationBehavior}
        gridSubdivision={gridSubdivision}
        onChangeGridSubdivision={setGridSubdivision}
        pixelsPerSecond={pixelsPerSecond}
        onChangePixelsPerSecond={setPixelsPerSecond}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Song Metadata & Pads */}
        <EditorSidebarLeft level={level} onChangeLevel={setLevel} />

        {/* Central Workspace: Tab Switcher & Active View */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* View Tab Bar */}
          <div className="flex shrink-0 border-b border-white/10 bg-black/40">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'timeline'
                  ? 'border-[#00e5ff] text-[#00e5ff]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" /> Timeline
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'border-[#00ff9d] text-[#00ff9d]'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Live Preview
            </button>
            <div className="ml-auto px-4 flex items-center text-xs text-white/40 font-mono">
              {level.events.length} events
            </div>
          </div>

          {/* Active View Container */}
          <div className="flex-1 overflow-hidden relative">
            {/* Timeline View */}
            <div className={`absolute inset-0 ${activeTab === 'timeline' ? 'flex flex-col' : 'hidden'}`}>
              <Timeline
                level={level}
                currentTime={currentTime}
                isPlaying={isPlaying}
                activeTool={activeTool}
                creationBehavior={creationBehavior}
                gridSubdivision={gridSubdivision}
                pixelsPerSecond={pixelsPerSecond}
                selectedEventId={selectedEventId}
                onSelectEvent={(evt) => {
                  setSelectedEventId(evt?.id || null);
                  if (evt) setSelectedNodeId(null);
                }}
                onSeek={handleSeek}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onRemoveEvent={handleRemoveEvent}
              />
            </div>

            {/* Live Preview View (PixiJS Canvas) */}
            <div
              ref={canvasContainerRef}
              className={`absolute inset-0 bg-black ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            />
          </div>
        </main>

        {/* Right Sidebar: Contextual Properties Panel */}
        <EditorPropertiesPanel
          selectedEvent={selectedEvent}
          selectedNode={selectedNode}
          pads={level.pads}
          activeTab={activeTab}
          onUpdateEvent={handleUpdateEvent}
          onRemoveEvent={handleRemoveEvent}
          onUpdateNode={handleUpdateNode}
        />
      </div>
    </div>
  );
}
