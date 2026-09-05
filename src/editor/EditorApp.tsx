import React, { useState, useCallback } from 'react';
import { Timeline, snapTimeToGrid, getSnapInterval, type EditorTool, type GridSubdivision } from './Timeline';
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

  // Event mutations
  const handleAddEvent = useCallback((newEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = [...prev.events, newEvent].sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
    setSelectedEventId(newEvent.id);
    setSelectedNodeId(null);
  }, []);

  const handleUpdateEvent = useCallback((updatedEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = prev.events
        .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  }, []);

  const handleRemoveEvent = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    setSelectedEventId((prevId) => (prevId === id ? null : prevId));
  }, []);

  // Modular Engine hook (AudioTransport, VisualEngine, GameplayEngine, InputManager, EventBus, Recording)
  const {
    canvasContainerRef,
    isPlaying,
    isRecording,
    enableHitsounds,
    currentTime,
    togglePlay,
    toggleRecord,
    toggleHitsounds,
    handleStop,
    handleSeek,
    loadAudioFile,
    updateSceneNode,
    dispose,
  } = useEditorEngine({
    level,
    activeTab,
    creationBehavior,
    gridSubdivision,
    onSelectNode: (id) => {
      setSelectedNodeId(id);
      setSelectedEventId(null);
    },
    onRecordEvent: handleAddEvent,
  });

  const handleUpdateNode = useCallback(
    (updates: Partial<SceneNodeData>) => {
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
    },
    [level.visual.nodes, selectedNodeId, updateSceneNode]
  );

  // Keyboard shortcuts hook (V, B, E, Del, Space, R)
  useEditorShortcuts({
    activeTab,
    isRecording,
    selectedEventId,
    onSelectTool: setActiveTool,
    onDeleteSelectedEvent: () => {
      if (selectedEventId) handleRemoveEvent(selectedEventId);
    },
    onTogglePlay: togglePlay,
    onToggleRecord: toggleRecord,
  });

  // Load external audio file into editor
  const handleAudioLoad = useCallback(
    async (file: File) => {
      const res = await loadAudioFile(file);
      if (res.success) {
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
        setLevel((prev) => ({
          ...prev,
          song: {
            ...prev.song,
            title: cleanTitle,
            duration: Math.ceil(res.duration) || prev.song.duration,
          },
        }));
      } else {
        alert('Could not decode audio file. Make sure it is a valid MP3, WAV, or OGG.');
      }
    },
    [loadAudioFile]
  );

  // Import existing level JSON
  const handleJsonImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string) as LevelData;
          if (parsed.formatVersion && parsed.song && Array.isArray(parsed.events)) {
            setLevel(parsed);
            handleStop();
          } else {
            alert('Invalid beatmap JSON format.');
          }
        } catch {
          alert('Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
    },
    [handleStop]
  );

  // Export level data to downloadable JSON
  const handleExport = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(level, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${level.song.title.toLowerCase().replace(/\s+/g, '_')}_level.json`);
    dlAnchorElem.click();
  }, [level]);

  // Quantize selected note or all notes to current grid snap
  const handleQuantize = useCallback(() => {
    const interval = getSnapInterval(level.timing.bpm, gridSubdivision);
    if (interval <= 0) return; // 'free' mode does not quantize

    setLevel((prev) => {
      const newEvents = prev.events
        .map((event) => {
          if (selectedEventId && event.id !== selectedEventId) return event;
          const snappedTarget = snapTimeToGrid(event.targetTime, prev.timing.bpm, gridSubdivision);
          let snappedDuration = event.duration;
          if (event.duration !== undefined) {
            snappedDuration = Math.max(interval, Math.round(event.duration / interval) * interval);
          }
          return {
            ...event,
            targetTime: snappedTarget,
            duration: snappedDuration,
            quantized: true,
          };
        })
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  }, [level.timing.bpm, gridSubdivision, selectedEventId]);

  const selectedEvent = level.events.find((e) => e.id === selectedEventId) || null;
  const selectedNode = level.visual.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0b0b12] text-white select-none">
      {/* Top Header & Transport / Audio / Import / Export Controls */}
      <EditorHeader
        bpm={level.timing.bpm}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isRecording={isRecording}
        enableHitsounds={enableHitsounds}
        onTogglePlay={togglePlay}
        onToggleRecord={toggleRecord}
        onToggleHitsounds={toggleHitsounds}
        onStop={handleStop}
        onLoadAudioFile={handleAudioLoad}
        onImportJson={handleJsonImport}
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
        onQuantize={handleQuantize}
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
