import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Timeline, type EditorTool } from './Timeline';
import { snapTimeToGrid, getSnapInterval, type GridSubdivision } from './utils';
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorPropertiesPanel } from './components/EditorPropertiesPanel';
import { SongPadsModal } from './components/SongPadsModal';
import { useEditorEngine } from './hooks/useEditorEngine';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { useEditorHistory } from './hooks/useEditorHistory';
import { useAutoSave } from './hooks/useAutoSave';
import { INITIAL_LEVEL } from './constants';
import type { LevelData, PadEvent, PadBehavior, SceneNodeData, TriggerData } from '../engine/types';
import { LevelValidator } from '../engine/content/LevelValidator';
import { ListVideo, Gamepad2, Zap } from 'lucide-react';

type EditorTab = 'timeline' | 'preview';

export interface EditorAppProps {
  onExit: () => void;
  onPlaytest?: (level: LevelData) => void;
  initialLevel?: LevelData;
}

export function EditorApp({ onExit, onPlaytest, initialLevel }: EditorAppProps) {
  // History-managed level state (Undo / Redo stack)
  const {
    level,
    setLevel,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  } = useEditorHistory(initialLevel || INITIAL_LEVEL);

  const [activeTab, setActiveTab] = useState<EditorTab>('timeline');
  const [isSongPadsModalOpen, setIsSongPadsModalOpen] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string>('');

  const {
    isDraftAvailable,
    draftTimestamp,
    draftAudioFileName,
    restoreDraft,
    discardDraft,
  } = useAutoSave({
    level,
    audioFileName,
  });

  const handleRestoreSession = useCallback(() => {
    const restored = restoreDraft();
    if (restored) {
      resetHistory(restored.level);
      if (restored.audioFileName) {
        setAudioFileName(restored.audioFileName);
      }
    }
  }, [restoreDraft, resetHistory]);

  // Authoring tools state
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [creationBehavior, setCreationBehavior] = useState<PadBehavior>('tap');
  const [gridSubdivision, setGridSubdivision] = useState<GridSubdivision>('1/4');
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(120);
  const [showWaveform, setShowWaveform] = useState<boolean>(true);

  // Multi-selection state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [selectedTriggerIds, setSelectedTriggerIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Single active items for inspector (when single item is selected, or primary pivot)
  const selectedEventId = useMemo(
    () => (selectedEventIds.size === 1 ? Array.from(selectedEventIds)[0] : null),
    [selectedEventIds]
  );
  const selectedTriggerId = useMemo(
    () => (selectedTriggerIds.size === 1 ? Array.from(selectedTriggerIds)[0] : null),
    [selectedTriggerIds]
  );

  const selectedEvents = useMemo(
    () => level.events.filter((e) => selectedEventIds.has(e.id)),
    [level.events, selectedEventIds]
  );

  const selectedTriggers = useMemo(
    () => (level.visual?.triggers || []).filter((t) => selectedTriggerIds.has(t.id)),
    [level.visual?.triggers, selectedTriggerIds]
  );

  const selectEvent = useCallback((id: string | null) => {
    if (!id) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set([id]));
      setSelectedTriggerIds(new Set());
      setSelectedNodeId(null);
    }
  }, []);

  const selectTrigger = useCallback((id: string | null) => {
    if (!id) {
      setSelectedTriggerIds(new Set());
    } else {
      setSelectedTriggerIds(new Set([id]));
      setSelectedEventIds(new Set());
      setSelectedNodeId(null);
    }
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
    }
  }, []);

  const selectEventsBatch = useCallback((ids: Set<string>, additive: boolean = false) => {
    setSelectedEventIds((prev) => {
      if (!additive) return new Set(ids);
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids.size > 0 && !additive) {
      setSelectedTriggerIds(new Set());
      setSelectedNodeId(null);
    }
  }, []);

  const selectTriggersBatch = useCallback((ids: Set<string>, additive: boolean = false) => {
    setSelectedTriggerIds((prev) => {
      if (!additive) return new Set(ids);
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids.size > 0 && !additive) {
      setSelectedEventIds(new Set());
      setSelectedNodeId(null);
    }
  }, []);

  const toggleEventSelection = useCallback((id: string, multi: boolean = true) => {
    setSelectedEventIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedTriggerIds(new Set());
    setSelectedNodeId(null);
  }, []);

  const toggleTriggerSelection = useCallback((id: string, multi: boolean = true) => {
    setSelectedTriggerIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedEventIds(new Set());
    setSelectedNodeId(null);
  }, []);

  const selectEventRange = useCallback((targetId: string) => {
    if (selectedEventIds.size === 0) {
      setSelectedEventIds(new Set([targetId]));
      return;
    }
    const lastSelectedId = Array.from(selectedEventIds)[selectedEventIds.size - 1];
    const sortedEvents = [...level.events].sort((a, b) => a.targetTime - b.targetTime);
    const idxA = sortedEvents.findIndex((e) => e.id === lastSelectedId);
    const idxB = sortedEvents.findIndex((e) => e.id === targetId);
    if (idxA === -1 || idxB === -1) {
      setSelectedEventIds(new Set([targetId]));
      return;
    }
    const minIdx = Math.min(idxA, idxB);
    const maxIdx = Math.max(idxA, idxB);
    const rangeIds = new Set(selectedEventIds);
    for (let i = minIdx; i <= maxIdx; i++) {
      rangeIds.add(sortedEvents[i].id);
    }
    setSelectedEventIds(rangeIds);
  }, [level.events, selectedEventIds]);

  const handleSelectAll = useCallback(() => {
    if (activeTab === 'timeline') {
      const allEventIds = new Set(level.events.map((e) => e.id));
      setSelectedEventIds(allEventIds);
      setSelectedTriggerIds(new Set());
      setSelectedNodeId(null);
    }
  }, [activeTab, level.events]);

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

  const handleUpdateEventsBatch = useCallback((updatedEvents: PadEvent[]) => {
    setLevel((prev) => {
      const map = new Map(updatedEvents.map((e) => [e.id, e]));
      const newEvents = prev.events
        .map((e) => map.get(e.id) || e)
        .sort((a, b) => a.targetTime - b.targetTime);
      return { ...prev, events: newEvents };
    });
  }, [setLevel]);

  const handleRemoveEvent = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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

  const handleUpdateTriggersBatch = useCallback((updatedTriggers: TriggerData[]) => {
    setLevel((prev) => {
      const map = new Map(updatedTriggers.map((t) => [t.id, t]));
      const currentTriggers = prev.visual?.triggers || [];
      const newTriggers = currentTriggers
        .map((t) => map.get(t.id) || t)
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
    setSelectedTriggerIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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

  const handleCreatePrimitive = useCallback((type: 'rectangle' | 'circle' | 'group') => {
    const nodes = level.visual?.nodes || [];
    let max = 0;
    const prefix = type === 'rectangle' ? 'rect' : type === 'circle' ? 'circle' : 'group';
    for (const node of nodes) {
      const name = node.name || (typeof node.id === 'string' ? node.id : '');
      if (name.startsWith(`${prefix}-`)) {
        const num = parseInt(name.replace(`${prefix}-`, ''), 10);
        if (!Number.isNaN(num) && num > max) max = num;
      }
    }
    const counter = max + 1;
    const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;

    let newNode: SceneNodeData;
    if (type === 'rectangle') {
      newNode = {
        uid,
        name: `rect-${counter}`,
        targetId: null,
        id: null,
        type: 'rectangle',
        visible: true,
        transform: {
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 0.9,
        },
        properties: {
          width: 140,
          height: 140,
          color: '#00e5ff',
        },
      };
    } else if (type === 'circle') {
      newNode = {
        uid,
        name: `circle-${counter}`,
        targetId: null,
        id: null,
        type: 'circle',
        visible: true,
        transform: {
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 0.9,
        },
        properties: {
          radius: 70,
          color: '#ff007f',
        },
      };
    } else {
      newNode = {
        uid,
        name: `group-${counter}`,
        targetId: null,
        id: null,
        type: 'group',
        visible: true,
        transform: {
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
        },
        properties: {},
      };
    }
    handleAddNode(newNode);
  }, [level.visual?.nodes, handleAddNode]);

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

  const handleUpdateNodeById = useCallback((id: string, updates: Partial<SceneNodeData>) => {
    setLevel((prev) => {
      const currentNodes = prev.visual?.nodes || [];
      const idx = currentNodes.findIndex(
        (n) => (n.uid && n.uid === id) || n.id === id || n.name === id
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
  }, [setLevel]);

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

  const handleRemoveBatch = useCallback((eventIds?: Set<string>, triggerIds?: Set<string>) => {
    const eIds = eventIds ?? selectedEventIds;
    const tIds = triggerIds ?? selectedTriggerIds;

    if (eIds.size > 0 || tIds.size > 0) {
      setLevel((prev) => ({
        ...prev,
        events: eIds.size > 0 ? prev.events.filter((e) => !eIds.has(e.id)) : prev.events,
        visual: {
          ...prev.visual,
          triggers: tIds.size > 0 ? (prev.visual?.triggers || []).filter((t) => !tIds.has(t.id)) : (prev.visual?.triggers || []),
        },
      }));
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
    } else if (selectedNodeId) {
      handleRemoveNode(selectedNodeId);
    }
  }, [selectedEventIds, selectedTriggerIds, selectedNodeId, setLevel, handleRemoveNode]);

  // Modular Engine hook
  const {
    canvasContainerRef,
    isPlaying,
    isRecording,
    enableHitsounds,
    playbackSpeed,
    setPlaybackSpeed,
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
    selectedTriggerId,
    selectedNodeId,
    onSelectNode: (id) => selectNode(id),
    onRecordEvent: handleAddEvent,
  });

  // Clipboard Engine
  interface ClipboardData {
    type: 'events' | 'triggers';
    events?: PadEvent[];
    triggers?: TriggerData[];
    baseTime: number;
  }
  const clipboardRef = useRef<ClipboardData | null>(null);

  const handleCopy = useCallback(() => {
    if (selectedEventIds.size > 0) {
      const selected = level.events.filter((e) => selectedEventIds.has(e.id));
      if (selected.length === 0) return;
      const baseTime = Math.min(...selected.map((e) => e.targetTime));
      clipboardRef.current = {
        type: 'events',
        events: selected.map((e) => ({ ...e })),
        baseTime,
      };
    } else if (selectedTriggerIds.size > 0) {
      const selected = (level.visual?.triggers || []).filter((t) => selectedTriggerIds.has(t.id));
      if (selected.length === 0) return;
      const baseTime = Math.min(...selected.map((t) => t.time));
      clipboardRef.current = {
        type: 'triggers',
        triggers: selected.map((t) => ({ ...t })),
        baseTime,
      };
    }
  }, [selectedEventIds, selectedTriggerIds, level.events, level.visual?.triggers]);

  const handleCut = useCallback(() => {
    handleCopy();
    handleRemoveBatch();
  }, [handleCopy, handleRemoveBatch]);

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current) return;
    const snappedPlayhead = snapTimeToGrid(currentTime, level.timing.bpm, gridSubdivision);

    if (clipboardRef.current.type === 'events' && clipboardRef.current.events) {
      const baseTime = clipboardRef.current.baseTime;
      const newIds = new Set<string>();
      const pastedEvents: PadEvent[] = clipboardRef.current.events.map((e) => {
        const newId = crypto.randomUUID();
        newIds.add(newId);
        const delta = e.targetTime - baseTime;
        const targetTime = Number((snappedPlayhead + delta).toFixed(4));
        return {
          ...e,
          id: newId,
          targetTime,
        };
      });

      setLevel((prev) => {
        const newEvents = [...prev.events, ...pastedEvents].sort((a, b) => a.targetTime - b.targetTime);
        return { ...prev, events: newEvents };
      });
      setSelectedEventIds(newIds);
      setSelectedTriggerIds(new Set());
      setSelectedNodeId(null);
    } else if (clipboardRef.current.type === 'triggers' && clipboardRef.current.triggers) {
      const baseTime = clipboardRef.current.baseTime;
      const newIds = new Set<string>();
      const pastedTriggers: TriggerData[] = clipboardRef.current.triggers.map((t) => {
        const newId = `trig_${Math.floor(1000 + Math.random() * 9000)}`;
        newIds.add(newId);
        const delta = t.time - baseTime;
        const time = Number((snappedPlayhead + delta).toFixed(4));
        return {
          ...t,
          id: newId,
          time,
        };
      });

      setLevel((prev) => {
        const currentTriggers = prev.visual?.triggers || [];
        const newTriggers = [...currentTriggers, ...pastedTriggers].sort((a, b) => a.time - b.time);
        return {
          ...prev,
          visual: {
            ...prev.visual,
            triggers: newTriggers,
          },
        };
      });
      setSelectedTriggerIds(newIds);
      setSelectedEventIds(new Set());
      setSelectedNodeId(null);
    }
  }, [currentTime, gridSubdivision, level.timing.bpm, setLevel]);

  const handleDuplicate = useCallback(() => {
    if (selectedEventIds.size > 0) {
      const selected = level.events.filter((e) => selectedEventIds.has(e.id));
      if (selected.length === 0) return;
      const minTime = Math.min(...selected.map((e) => e.targetTime));
      const maxTime = Math.max(...selected.map((e) => e.targetTime + (e.duration || 0)));
      const blockSpan = maxTime - minTime;
      const beatDuration = 60 / level.timing.bpm;
      const snapInterval = getSnapInterval(level.timing.bpm, gridSubdivision);
      const minShift = snapInterval > 0 ? snapInterval : beatDuration;
      const shift = Math.max(minShift, snapTimeToGrid(blockSpan || minShift, level.timing.bpm, gridSubdivision));

      const newIds = new Set<string>();
      const duplicatedEvents: PadEvent[] = selected.map((e) => {
        const newId = crypto.randomUUID();
        newIds.add(newId);
        return {
          ...e,
          id: newId,
          targetTime: Number((e.targetTime + shift).toFixed(4)),
        };
      });

      setLevel((prev) => {
        const newEvents = [...prev.events, ...duplicatedEvents].sort((a, b) => a.targetTime - b.targetTime);
        return { ...prev, events: newEvents };
      });
      setSelectedEventIds(newIds);
    } else if (selectedTriggerIds.size > 0) {
      const selected = (level.visual?.triggers || []).filter((t) => selectedTriggerIds.has(t.id));
      if (selected.length === 0) return;
      const minTime = Math.min(...selected.map((t) => t.time));
      const maxTime = Math.max(...selected.map((t) => t.time + (t.duration || 0)));
      const blockSpan = maxTime - minTime;
      const beatDuration = 60 / level.timing.bpm;
      const snapInterval = getSnapInterval(level.timing.bpm, gridSubdivision);
      const minShift = snapInterval > 0 ? snapInterval : beatDuration;
      const shift = Math.max(minShift, snapTimeToGrid(blockSpan || minShift, level.timing.bpm, gridSubdivision));

      const newIds = new Set<string>();
      const duplicatedTriggers: TriggerData[] = selected.map((t) => {
        const newId = `trig_${Math.floor(1000 + Math.random() * 9000)}`;
        newIds.add(newId);
        return {
          ...t,
          id: newId,
          time: Number((t.time + shift).toFixed(4)),
        };
      });

      setLevel((prev) => {
        const currentTriggers = prev.visual?.triggers || [];
        const newTriggers = [...currentTriggers, ...duplicatedTriggers].sort((a, b) => a.time - b.time);
        return {
          ...prev,
          visual: {
            ...prev.visual,
            triggers: newTriggers,
          },
        };
      });
      setSelectedTriggerIds(newIds);
    }
  }, [selectedEventIds, selectedTriggerIds, level.events, level.visual?.triggers, level.timing.bpm, gridSubdivision, setLevel]);

  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond((prev) => Math.min(350, prev + 20));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond((prev) => Math.max(40, prev - 20));
  }, []);

  // Keyboard shortcuts hook with Undo/Redo & Delete handling
  useEditorShortcuts({
    activeTab,
    isRecording,
    canDelete: Boolean(selectedEventIds.size > 0 || selectedTriggerIds.size > 0 || selectedNodeId),
    onSelectTool: setActiveTool,
    onDeleteSelected: () => handleRemoveBatch(),
    onTogglePlay: togglePlay,
    onToggleRecord: toggleRecord,
    onToggleWaveform: () => setShowWaveform((prev) => !prev),
    onUndo: undo,
    onRedo: redo,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onDuplicate: handleDuplicate,
    onSelectAll: handleSelectAll,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
  });

  // Load external audio file into editor
  const handleAudioLoad = useCallback(
    async (file: File) => {
      const newSongId = `file-${file.name}-${file.size}-${file.lastModified}`;
      const res = await loadAudioFile(file, newSongId);
      if (res.success) {
        setAudioFileName(file.name);
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
        setLevel((prev) => ({
          ...prev,
          songId: newSongId,
          song: {
            ...prev.song,
            id: newSongId,
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

  // Import existing level JSON with safety parsing and deep validation
  const handleJsonImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const validation = LevelValidator.validate(parsed);
          if (validation.valid && validation.sanitizedLevel) {
            resetHistory(validation.sanitizedLevel);
            handleStop();
          } else {
            alert('Level validation failed:\n\n• ' + validation.errors.join('\n• '));
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

  // Global shortcut: F5 or Ctrl+Enter to trigger Playtest
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (onPlaytest) {
          handleStop();
          onPlaytest(level);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [level, onPlaytest, handleStop]);

  return (
    <div className="relative z-10 h-full max-h-screen w-full flex flex-col bg-[#0b0b12] text-white select-none overflow-hidden">
      {/* Top Header & Transport / Audio / Import / Export / History Controls */}
      <EditorHeader
        bpm={level.timing.bpm}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isRecording={isRecording}
        enableHitsounds={enableHitsounds}
        playbackSpeed={playbackSpeed}
        onChangePlaybackSpeed={setPlaybackSpeed}
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
        onOpenSongPadsModal={() => setIsSongPadsModalOpen(true)}
        onPlaytest={
          onPlaytest
            ? () => {
                handleStop();
                onPlaytest(level);
              }
            : undefined
        }
        onExit={() => {
          dispose();
          onExit();
        }}
      />

      {/* Auto-Save Recovery Floating Banner */}
      {isDraftAvailable && (
        <div className="bg-gradient-to-r from-cyan-950/90 via-[#0b0b18]/95 to-cyan-950/90 border-b border-[#00e5ff]/40 px-4 py-2 flex items-center justify-between z-40 text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 text-cyan-200">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
            <span className="font-mono font-medium">
              A previous unsaved session draft was found
              {draftTimestamp ? ` (${Math.max(1, Math.round((Date.now() - draftTimestamp) / 60000))} min ago)` : ''}
              {draftAudioFileName ? ` for "${draftAudioFileName}"` : ''}.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreSession}
              className="px-3 py-1 bg-[#00e5ff] text-black font-mono font-bold rounded hover:bg-cyan-300 transition-colors shadow-sm cursor-pointer"
            >
              Restore Session
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1 bg-white/10 text-white/70 hover:text-white font-mono rounded hover:bg-white/20 transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )} 
      
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
        showWaveform={showWaveform}
        onToggleWaveform={() => setShowWaveform((prev) => !prev)}
        onCreatePrimitive={handleCreatePrimitive}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Central Workspace: Tab Switcher & Active View */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
              <span>{level.events.length} {level.events.length === 1 ? 'note' : 'notes'}</span>
              <span className="text-white/20">|</span>
              <span className="text-yellow-400/80 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {(level.visual?.triggers || []).length} triggers
              </span>
            </div>
          </div>

          {/* Active View Container */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
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
                showWaveform={showWaveform}
                selectedEventId={selectedEventId}
                selectedEventIds={selectedEventIds}
                selectedTriggerId={selectedTriggerId}
                selectedTriggerIds={selectedTriggerIds}
                selectedNodeId={selectedNodeId}
                onSelectEvent={(evt) => selectEvent(evt?.id || null)}
                onSelectEvents={selectEventsBatch}
                onSelectTrigger={(trig) => selectTrigger(trig?.id || null)}
                onSelectTriggers={selectTriggersBatch}
                onSelectNode={(node) => selectNode(node?.uid || null)}
                onToggleEventSelection={toggleEventSelection}
                onToggleTriggerSelection={toggleTriggerSelection}
                onSelectEventRange={selectEventRange}
                onSeek={handleSeek}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onUpdateEventsBatch={handleUpdateEventsBatch}
                onRemoveEvent={handleRemoveEvent}
                onAddTrigger={handleAddTrigger}
                onUpdateTrigger={handleUpdateTrigger}
                onUpdateTriggersBatch={handleUpdateTriggersBatch}
                onRemoveTrigger={handleRemoveTrigger}
                onUpdateNode={handleUpdateNodeById}
                onChangePixelsPerSecond={setPixelsPerSecond}
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
          selectedEvents={selectedEvents}
          selectedTrigger={selectedTrigger}
          selectedTriggers={selectedTriggers}
          selectedNode={selectedNode}
          nodes={level.visual?.nodes || []}
          pads={level.pads}
          activeTab={activeTab}
          onUpdateEvent={handleUpdateEvent}
          onUpdateEventsBatch={handleUpdateEventsBatch}
          onRemoveEvent={handleRemoveEvent}
          onRemoveBatch={handleRemoveBatch}
          onUpdateTrigger={handleUpdateTrigger}
          onRemoveTrigger={handleRemoveTrigger}
          onUpdateNode={handleUpdateNode}
          onRemoveNode={handleRemoveNode}
        />
      </div>

      {/* Song & Pads Settings Modal */}
      <SongPadsModal
        isOpen={isSongPadsModalOpen}
        onClose={() => setIsSongPadsModalOpen(false)}
        level={level}
        onChangeLevel={setLevel}
        audioFileName={audioFileName}
      />
    </div>
  );
}
