import React, { useState, useCallback } from 'react';
import { Timeline, type EditorTool, type GridSubdivision } from './Timeline';
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorSidebarLeft } from './components/EditorSidebarLeft';
import { EditorPropertiesPanel } from './components/EditorPropertiesPanel';
import { useEditorEngine } from './hooks/useEditorEngine';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useEditorHistory } from './hooks/useEditorHistory';
import { INITIAL_LEVEL } from './constants';
import type { LevelData, PadEvent, PadBehavior, SceneNodeData, TriggerData } from '../engine/types';
import { ListVideo, Gamepad2, Zap } from 'lucide-react';

type EditorTab = 'timeline' | 'preview';

export function EditorApp({ onExit }: { onExit: () => void }) {
  // History-managed level state (Undo / Redo stack)
  const {
    level,
    setLevel,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  } = useEditorHistory(INITIAL_LEVEL);

  const [activeTab, setActiveTab] = useState<EditorTab>('timeline');

  // Authoring tools state
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [creationBehavior, setCreationBehavior] = useState<PadBehavior>('tap');
  const [gridSubdivision, setGridSubdivision] = useState<GridSubdivision>('1/4');
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(120);

  // Mutually exclusive selection state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectEvent = useCallback((id: string | null) => {
    setSelectedEventId(id);
    if (id) {
      setSelectedTriggerId(null);
      setSelectedNodeId(null);
    }
  }, []);

  const selectTrigger = useCallback((id: string | null) => {
    setSelectedTriggerId(id);
    if (id) {
      setSelectedEventId(null);
      setSelectedNodeId(null);
    }
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setSelectedEventId(null);
      setSelectedTriggerId(null);
    }
  }, []);

  // 1. PadEvent mutations
  const handleAddEvent = useCallback((newEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = [...prev.events, newEvent].sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
    selectEvent(newEvent.id);
  }, [setLevel, selectEvent]);

  const handleUpdateEvent = useCallback((updatedEvent: PadEvent) => {
    setLevel((prev) => {
      const newEvents = prev.events
        .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  }, [setLevel]);

  const handleRemoveEvent = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    setSelectedEventId((prevId) => (prevId === id ? null : prevId));
  }, [setLevel]);

  // 2. TriggerData mutations
  const handleAddTrigger = useCallback((newTrigger: TriggerData) => {
    setLevel((prev) => {
      const currentTriggers = prev.visual?.triggers || [];
      const newTriggers = [...currentTriggers, newTrigger].sort((a, b) => a.time - b.time);
      return {
        ...prev,
        visual: {
          ...prev.visual,
          triggers: newTriggers,
        },
      };
    });
    selectTrigger(newTrigger.id);
  }, [setLevel, selectTrigger]);

  const handleUpdateTrigger = useCallback((updatedTrigger: TriggerData) => {
    setLevel((prev) => {
      const currentTriggers = prev.visual?.triggers || [];
      const newTriggers = currentTriggers
        .map((t) => (t.id === updatedTrigger.id ? updatedTrigger : t))
        .sort((a, b) => a.time - b.time);
      return {
        ...prev,
        visual: {
          ...prev.visual,
          triggers: newTriggers,
        },
      };
    });
  }, [setLevel]);

  const handleRemoveTrigger = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      visual: {
        ...prev.visual,
        triggers: (prev.visual?.triggers || []).filter((t) => t.id !== id),
      },
    }));
    setSelectedTriggerId((prevId) => (prevId === id ? null : prevId));
  }, [setLevel]);

  // 3. SceneNode mutations
  const handleAddNode = useCallback((newNode: SceneNodeData) => {
    setLevel((prev) => {
      const currentNodes = prev.visual?.nodes || [];
      return {
        ...prev,
        visual: {
          ...prev.visual,
          nodes: [...currentNodes, newNode],
        },
      };
    });
    const key = newNode.uid || (typeof newNode.id === 'string' ? newNode.id : newNode.name || 'node');
    selectNode(key);
  }, [setLevel, selectNode]);

  const handleUpdateNode = useCallback((updates: Partial<SceneNodeData>) => {
    if (!selectedNodeId) return;
    setLevel((prev) => {
      const currentNodes = prev.visual?.nodes || [];
      const idx = currentNodes.findIndex(
        (n) => (n.uid && n.uid === selectedNodeId) || n.id === selectedNodeId || n.name === selectedNodeId
      );
      if (idx === -1) return prev;
      const updated = { ...currentNodes[idx], ...updates } as SceneNodeData;
      const newNodes = [...currentNodes];
      newNodes[idx] = updated;
      return {
        ...prev,
        visual: {
          ...prev.visual,
          nodes: newNodes,
        },
      };
    });
  }, [selectedNodeId, setLevel]);

  const handleRemoveNode = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      visual: {
        ...prev.visual,
        nodes: (prev.visual?.nodes || []).filter(
          (n) => n.uid !== id && n.id !== id && n.name !== id
        ),
        triggers: (prev.visual?.triggers || []).map((t) =>
          t.targetId === id ? { ...t, targetId: 'all' } : t
        ),
      },
    }));
    setSelectedNodeId((prevId) => (prevId === id ? null : prevId));
  }, [setLevel]);

  // Modular Engine hook
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
    dispose,
  } = useEditorEngine({
    level,
    activeTab,
    creationBehavior,
    gridSubdivision,
    onSelectNode: (id) => selectNode(id),
    onRecordEvent: handleAddEvent,
  });

  // Keyboard shortcuts hook with Undo/Redo & Delete handling
  useEditorShortcuts({
    activeTab,
    isRecording,
    selectedEventId,
    onSelectTool: setActiveTool,
    onDeleteSelectedEvent: () => {
      if (selectedEventId) {
        handleRemoveEvent(selectedEventId);
      } else if (selectedTriggerId) {
        handleRemoveTrigger(selectedTriggerId);
      } else if (selectedNodeId) {
        handleRemoveNode(selectedNodeId);
      }
    },
    onTogglePlay: togglePlay,
    onToggleRecord: toggleRecord,
    onUndo: undo,
    onRedo: redo,
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
    [loadAudioFile, setLevel]
  );

  // Import existing level JSON with safety parsing
  const handleJsonImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string) as LevelData;
          if (parsed.formatVersion && parsed.song && Array.isArray(parsed.events)) {
            // Guarantee visual structure
            const sanitized: LevelData = {
              ...parsed,
              visual: {
                nodes: parsed.visual?.nodes || [],
                animations: parsed.visual?.animations || [],
                triggers: parsed.visual?.triggers || [],
              },
            };
            resetHistory(sanitized);
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
    [handleStop, resetHistory]
  );

  // Export level data to downloadable JSON
  const handleExport = useCallback(() => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(level, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${level.song.title.toLowerCase().replace(/\s+/g, '_')}_level.json`);
    dlAnchorElem.click();
  }, [level]);

  // Selected item lookup
  const selectedEvent = level.events.find((e) => e.id === selectedEventId) || null;
  const selectedTrigger = (level.visual?.triggers || []).find((t) => t.id === selectedTriggerId) || null;
  const selectedNode =
    (level.visual?.nodes || []).find(
      (n) => (n.uid && n.uid === selectedNodeId) || n.id === selectedNodeId || n.name === selectedNodeId
    ) || null;

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col bg-[#0b0b12] text-white select-none">
      {/* Top Header & Transport / Audio / Import / Export / History Controls */}
      <EditorHeader
        bpm={level.timing.bpm}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isRecording={isRecording}
        enableHitsounds={enableHitsounds}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
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
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Song Metadata, Pads & SceneOutliner */}
        <EditorSidebarLeft
          level={level}
          onChangeLevel={setLevel}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectNode}
          onAddNode={handleAddNode}
          onRemoveNode={handleRemoveNode}
        />

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
            <div className="ml-auto px-4 flex items-center gap-3 text-xs text-white/40 font-mono">
              <span>{level.events.length} notas</span>
              <span className="text-white/20">|</span>
              <span className="text-yellow-400/80 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {(level.visual?.triggers || []).length} triggers
              </span>
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
                selectedTriggerId={selectedTriggerId}
                onSelectEvent={(evt) => selectEvent(evt?.id || null)}
                onSelectTrigger={(trig) => selectTrigger(trig?.id || null)}
                onSeek={handleSeek}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onRemoveEvent={handleRemoveEvent}
                onAddTrigger={handleAddTrigger}
                onUpdateTrigger={handleUpdateTrigger}
                onRemoveTrigger={handleRemoveTrigger}
              />
            </div>

            {/* Live Preview View (PixiJS Canvas) */}
            <div
              ref={canvasContainerRef}
              className={`absolute inset-0 bg-black ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            />
          </div>
        </main>

        {/* Right Sidebar: Contextual Properties Panel (Events, Triggers, Nodes) */}
        <EditorPropertiesPanel
          selectedEvent={selectedEvent}
          selectedTrigger={selectedTrigger}
          selectedNode={selectedNode}
          nodes={level.visual?.nodes || []}
          pads={level.pads}
          activeTab={activeTab}
          onUpdateEvent={handleUpdateEvent}
          onRemoveEvent={handleRemoveEvent}
          onUpdateTrigger={handleUpdateTrigger}
          onRemoveTrigger={handleRemoveTrigger}
          onUpdateNode={handleUpdateNode}
          onRemoveNode={handleRemoveNode}
        />
      </div>
    </div>
  );
}
