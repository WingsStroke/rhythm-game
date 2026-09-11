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
import type { LevelData, PadEvent, PadBehavior, SceneNodeData, TriggerData, ScenePrimitiveType, VisualEffect } from '../engine/types';
import { LevelValidator } from '../engine/content/LevelValidator';
import { SongRegistry } from '../engine/content/SongRegistry';
import { timelineTimeToSongTime } from '../engine/time/timeUtils';
import { PrimitiveRegistry } from '../engine/visual/objects/PrimitiveRegistry';
import { ListVideo, Gamepad2, Zap, Layers, Sparkles } from 'lucide-react';

type EditorTab = 'timeline' | 'preview';

/**
 * Safely duplicates a SceneNodeData, guaranteeing valid transform positioning and lifespan adjustment.
 */
function duplicateSceneNode(
  source: SceneNodeData,
  newUid: string,
  lifespanAdjust?: {
    mode: 'rebase';
    baseTime: number;
    playheadTime: number;
  } | {
    mode: 'shift';
    shift: number;
  }
): SceneNodeData {
  const cloned: SceneNodeData = JSON.parse(JSON.stringify(source));
  cloned.uid = newUid;
  cloned.id = newUid;
  if (cloned.name) {
    cloned.name = `${cloned.name}-copy`;
  }
  if (cloned.lifespan && lifespanAdjust) {
    if (lifespanAdjust.mode === 'rebase') {
      const delta = cloned.lifespan.startTime - lifespanAdjust.baseTime;
      cloned.lifespan.startTime = Number((lifespanAdjust.playheadTime + delta).toFixed(4));
    } else {
      cloned.lifespan.startTime = Number((cloned.lifespan.startTime + lifespanAdjust.shift).toFixed(4));
    }
  } else {
    if (!cloned.transform) {
      cloned.transform = { x: 980, y: 560 };
    } else {
      cloned.transform.x = (cloned.transform.x ?? 960) + 20;
      cloned.transform.y = (cloned.transform.y ?? 540) + 20;
    }
  }
  return cloned;
}

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
    saveDraftManually,
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
  const [timelineMode, setTimelineMode] = useState<'notes' | 'triggers' | 'visuals' | 'shaders'>('notes');
  const [selectedShaderType, setSelectedShaderType] = useState<string>('bloom');
  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [selectedPrimitiveType, setSelectedPrimitiveType] = useState<ScenePrimitiveType>('rectangle');
  const [creationBehavior, setCreationBehavior] = useState<PadBehavior>('tap');
  const [gridSubdivision, setGridSubdivision] = useState<GridSubdivision>('1/4');
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(120);
  const [showWaveform, setShowWaveform] = useState<boolean>(true);

  // Multi-selection state
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [selectedTriggerIds, setSelectedTriggerIds] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEffectIds, setSelectedEffectIds] = useState<Set<string>>(new Set());

  // Single active items for inspector (when single item is selected, or primary pivot)
  const selectedEventId = useMemo(
    () => (selectedEventIds.size === 1 ? Array.from(selectedEventIds)[0] : null),
    [selectedEventIds]
  );
  const selectedTriggerId = useMemo(
    () => (selectedTriggerIds.size === 1 ? Array.from(selectedTriggerIds)[0] : null),
    [selectedTriggerIds]
  );
  const selectedNodeId = useMemo(
    () => (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null),
    [selectedNodeIds]
  );
  const selectedEffectId = useMemo(
    () => (selectedEffectIds.size === 1 ? Array.from(selectedEffectIds)[0] : null),
    [selectedEffectIds]
  );

  const selectedEvents = useMemo(
    () => level.events.filter((e) => selectedEventIds.has(e.id)),
    [level.events, selectedEventIds]
  );

  const selectedTriggers = useMemo(
    () => (level.visual?.triggers || []).filter((t) => selectedTriggerIds.has(t.id)),
    [level.visual?.triggers, selectedTriggerIds]
  );

  const selectedNodes = useMemo(
    () =>
      (level.visual?.nodes || []).filter(
        (n) =>
          selectedNodeIds.has(n.uid) ||
          (Boolean(n.id) && selectedNodeIds.has(String(n.id))) ||
          (Boolean(n.name) && selectedNodeIds.has(n.name!))
      ),
    [level.visual?.nodes, selectedNodeIds]
  );

  const selectedEffect = useMemo(
    () => (level.visual?.effects || []).find((e) => e.id === selectedEffectId) || null,
    [level.visual?.effects, selectedEffectId]
  );

  const selectedEffects = useMemo(
    () => (level.visual?.effects || []).filter((e) => selectedEffectIds.has(e.id)),
    [level.visual?.effects, selectedEffectIds]
  );

  const selectEvent = useCallback((id: string | null) => {
    if (!id) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set([id]));
      setSelectedTriggerIds(new Set());
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, []);

  const selectTrigger = useCallback((id: string | null) => {
    if (!id) {
      setSelectedTriggerIds(new Set());
    } else {
      setSelectedTriggerIds(new Set([id]));
      setSelectedEventIds(new Set());
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, []);

  const selectNode = useCallback((id: string | null, isShift: boolean = false) => {
    if (!id) {
      setSelectedNodeIds(new Set());
    } else if (isShift) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
    } else {
      setSelectedNodeIds(new Set([id]));
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, []);

  const selectEffect = useCallback((effect: VisualEffect | null) => {
    if (!effect) {
      setSelectedEffectIds(new Set());
    } else {
      setSelectedEffectIds(new Set([effect.id]));
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedNodeIds(new Set());
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
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
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
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, []);

  const selectNodesBatch = useCallback((ids: Set<string>, additive: boolean = false) => {
    setSelectedNodeIds((prev) => {
      if (!additive) return new Set(ids);
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids.size > 0 && !additive) {
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, []);

  const selectEffectsBatch = useCallback((ids: Set<string>, additive: boolean = false) => {
    setSelectedEffectIds((prev) => {
      if (!additive) return new Set(ids);
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    if (ids.size > 0 && !additive) {
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedNodeIds(new Set());
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
    setSelectedNodeIds(new Set());
    setSelectedEffectIds(new Set());
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
    setSelectedNodeIds(new Set());
    setSelectedEffectIds(new Set());
  }, []);

  const toggleEffectSelection = useCallback((id: string, multi: boolean = true) => {
    setSelectedEffectIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedEventIds(new Set());
    setSelectedTriggerIds(new Set());
    setSelectedNodeIds(new Set());
  }, []);

  const toggleNodeSelection = useCallback((id: string, multi: boolean = true) => {
    setSelectedNodeIds((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedEventIds(new Set());
    setSelectedTriggerIds(new Set());
    setSelectedEffectIds(new Set());
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
      if (timelineMode === 'notes') {
        const allEventIds = new Set(level.events.map((e) => e.id));
        setSelectedEventIds(allEventIds);
        setSelectedTriggerIds(new Set());
        setSelectedNodeIds(new Set());
        setSelectedEffectIds(new Set());
      } else if (timelineMode === 'triggers') {
        const visibleTrigs = (level.visual?.triggers || []).filter((t) => (t.layer ?? 1) === activeLayer);
        setSelectedTriggerIds(new Set(visibleTrigs.map((t) => t.id)));
        setSelectedEventIds(new Set());
        setSelectedNodeIds(new Set());
        setSelectedEffectIds(new Set());
      } else if (timelineMode === 'visuals') {
        const visibleN = (level.visual?.nodes || []).filter((n) => (n.layer ?? 1) === activeLayer);
        setSelectedNodeIds(new Set(visibleN.map((n) => n.uid)));
        setSelectedEventIds(new Set());
        setSelectedTriggerIds(new Set());
        setSelectedEffectIds(new Set());
      } else if (timelineMode === 'shaders') {
        const allEffects = level.visual?.effects || [];
        setSelectedEffectIds(new Set(allEffects.map((e) => e.id)));
        setSelectedEventIds(new Set());
        setSelectedTriggerIds(new Set());
        setSelectedNodeIds(new Set());
      }
    } else if (activeTab === 'preview') {
      const allNodes = level.visual?.nodes || [];
      setSelectedNodeIds(new Set(allNodes.map((n) => n.uid)));
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
    }
  }, [activeTab, timelineMode, level.events, level.visual?.triggers, level.visual?.nodes, level.visual?.effects, activeLayer]);

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

  const handleSelectPrimitiveType = useCallback((type: ScenePrimitiveType) => {
    setSelectedPrimitiveType(type);
    setActiveTool('object');
  }, []);

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
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setLevel]);

  const handleUpdateNodesBatch = useCallback((updatedNodes: SceneNodeData[]) => {
    setLevel((prev) => {
      const map = new Map(updatedNodes.map((n) => [n.uid, n]));
      const currentNodes = prev.visual?.nodes || [];
      const newNodes = currentNodes.map((n) => map.get(n.uid) || n);
      return {
        ...prev,
        visual: {
          ...prev.visual,
          nodes: newNodes,
        },
      };
    });
  }, [setLevel]);

  const handleSelectTool = useCallback(
    (tool: EditorTool) => {
      setActiveTool(tool);
      if (tool === 'shader') {
        setActiveTab('timeline');
        setTimelineMode('shaders');
      } else if (tool === 'object') {
        if (activeTab === 'timeline' && timelineMode !== 'visuals') {
          setTimelineMode('visuals');
        }
      } else if (tool === 'pen') {
        if (activeTab === 'timeline' && timelineMode !== 'notes' && timelineMode !== 'triggers') {
          setTimelineMode('notes');
        }
      }
    },
    [activeTab, timelineMode]
  );

  const handleSelectShaderType = useCallback((type: string) => {
    setSelectedShaderType(type);
    setActiveTool('shader');
    setTimelineMode('shaders');
    setActiveTab('timeline');
  }, []);

  // 4. VisualEffect mutations
  const handleAddEffect = useCallback((newEffect: VisualEffect) => {
    setLevel((prev) => {
      const currentEffects = prev.visual?.effects || [];
      return {
        ...prev,
        visual: {
          ...prev.visual,
          effects: [...currentEffects, newEffect],
        },
      };
    });
    selectEffect(newEffect);
  }, [setLevel, selectEffect]);

  const handleUpdateEffect = useCallback((updatedEffect: VisualEffect) => {
    setLevel((prev) => {
      const currentEffects = prev.visual?.effects || [];
      const newEffects = currentEffects.map((e) => (e.id === updatedEffect.id ? updatedEffect : e));
      return {
        ...prev,
        visual: {
          ...prev.visual,
          effects: newEffects,
        },
      };
    });
  }, [setLevel]);

  const handleRemoveEffect = useCallback((id: string) => {
    setLevel((prev) => ({
      ...prev,
      visual: {
        ...prev.visual,
        effects: (prev.visual?.effects || []).filter((e) => e.id !== id),
      },
    }));
    setSelectedEffectIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setLevel]);

  const handleRemoveBatch = useCallback((eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => {
    const eIds = eventIds ?? selectedEventIds;
    const tIds = triggerIds ?? selectedTriggerIds;
    const nIds = nodeIds ?? selectedNodeIds;
    const efIds = effectIds ?? selectedEffectIds;

    if (eIds.size > 0 || tIds.size > 0 || nIds.size > 0 || efIds.size > 0) {
      setLevel((prev) => ({
        ...prev,
        events: eIds.size > 0 ? prev.events.filter((e) => !eIds.has(e.id)) : prev.events,
        visual: {
          ...prev.visual,
          triggers: tIds.size > 0 ? (prev.visual?.triggers || []).filter((t) => !tIds.has(t.id)) : (prev.visual?.triggers || []),
          nodes: nIds.size > 0
            ? (prev.visual?.nodes || []).filter(
                (n) =>
                  !nIds.has(n.uid) &&
                  (!n.id || !nIds.has(String(n.id))) &&
                  (!n.name || !nIds.has(n.name))
              )
            : (prev.visual?.nodes || []),
          effects: efIds.size > 0
            ? (prev.visual?.effects || []).filter((ef) => !efIds.has(ef.id))
            : (prev.visual?.effects || []),
        },
      }));
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
    } else if (selectedNodeId) {
      handleRemoveNode(selectedNodeId);
    } else if (selectedEffectId) {
      handleRemoveEffect(selectedEffectId);
    }
  }, [selectedEventIds, selectedTriggerIds, selectedNodeIds, selectedNodeId, selectedEffectIds, selectedEffectId, setLevel, handleRemoveNode, handleRemoveEffect]);

  // Mutable ref to keep current audio timeline time accessible in callbacks
  const currentTimeRef = useRef(0);

  // Modular Engine hook
  const handleLivePreviewCanvasClick = useCallback(
    (stageX: number, stageY: number) => {
      if (activeTool === 'object') {
        const bpm = level.timing?.bpm || 120;
        const leadIn = level.timing?.leadIn ?? 0;
        const offset = level.timing?.offset ?? 0;
        const rawSongTime = Math.max(0, timelineTimeToSongTime(currentTimeRef.current, leadIn, offset));
        const snappedTime = snapTimeToGrid(rawSongTime, bpm, gridSubdivision);

        const type = selectedPrimitiveType || 'rectangle';
        const nodes = level.visual?.nodes || [];
        let max = 0;
        const prefix = type.toLowerCase();
        for (const node of nodes) {
          const name = node.name || (typeof node.id === 'string' ? node.id : '');
          if (name.startsWith(`${prefix}-`)) {
            const num = parseInt(name.replace(`${prefix}-`, ''), 10);
            if (!Number.isNaN(num) && num > max) max = num;
          }
        }
        const counter = max + 1;
        const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;

        const beatSec = 60 / bpm;
        const defaultDuration = Math.max(1, Number((beatSec * 4).toFixed(3)));
        const defaultProps = PrimitiveRegistry.get(type)?.defaultProperties || {};

        const newNode: SceneNodeData = {
          uid,
          name: `${prefix}-${counter}`,
          targetId: null,
          id: null,
          type,
          layer: activeLayer,
          subLane: 0,
          visible: true,
          lifespan: {
            startTime: snappedTime,
            duration: defaultDuration,
            fadeInMs: 200,
            fadeOutMs: 200,
          },
          transform: {
            x: stageX,
            y: stageY,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: type === 'pointLight' || type === 'beamLight' ? 1.0 : 0.9,
          },
          blendMode: type === 'pointLight' || type === 'beamLight' ? 'add' : 'normal',
          zIndex: 0,
          properties: { ...defaultProps },
        };

        handleAddNode(newNode);
        selectNode(newNode.uid);
      } else if (activeTool === 'select') {
        selectNode(null);
      }
    },
    [
      activeTool,
      level.timing?.bpm,
      level.timing?.leadIn,
      level.timing?.offset,
      level.visual?.nodes,
      gridSubdivision,
      selectedPrimitiveType,
      activeLayer,
      handleAddNode,
      selectNode,
    ]
  );

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
    activeTool,
    creationBehavior,
    gridSubdivision,
    selectedTriggerId,
    selectedNodeId,
    selectedNodeIds,
    onSelectNode: (id, isShift) => selectNode(id, isShift),
    onRemoveNode: handleRemoveNode,
    onSelectNodesBatch: (ids, additive) => selectNodesBatch(new Set(ids), additive),
    onUpdateNodesBatch: handleUpdateNodesBatch,
    onRecordEvent: handleAddEvent,
    onCanvasClick: handleLivePreviewCanvasClick,
  });

  currentTimeRef.current = currentTime;

  // Clipboard Engine
  interface ClipboardData {
    type: 'events' | 'triggers' | 'nodes';
    events?: PadEvent[];
    triggers?: TriggerData[];
    nodes?: SceneNodeData[];
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
    } else if (selectedNodeIds.size > 0) {
      const selected = (level.visual?.nodes || []).filter((n) =>
        selectedNodeIds.has(n.uid) ||
        (Boolean(n.id) && selectedNodeIds.has(String(n.id))) ||
        (Boolean(n.name) && selectedNodeIds.has(n.name!))
      );
      if (selected.length === 0) return;
      const baseTime = Math.min(
        ...selected.map((n) => (n.lifespan ? n.lifespan.startTime : currentTimeRef.current))
      );
      clipboardRef.current = {
        type: 'nodes',
        nodes: selected.map((n) => JSON.parse(JSON.stringify(n))),
        baseTime,
      };
    }
  }, [selectedEventIds, selectedTriggerIds, selectedNodeIds, level.events, level.visual?.triggers, level.visual?.nodes]);

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
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
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
      setSelectedNodeIds(new Set());
      setSelectedEffectIds(new Set());
    } else if (clipboardRef.current.type === 'nodes' && clipboardRef.current.nodes) {
      const baseTime = clipboardRef.current.baseTime;
      const newIds = new Set<string>();
      const pastedNodes: SceneNodeData[] = clipboardRef.current.nodes.map((node, i) => {
        const newUid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}_${i}`;
        newIds.add(newUid);
        return duplicateSceneNode(node, newUid, {
          mode: 'rebase',
          baseTime,
          playheadTime: snappedPlayhead,
        });
      });

      setLevel((prev) => ({
        ...prev,
        visual: {
          ...prev.visual,
          nodes: [...(prev.visual?.nodes || []), ...pastedNodes],
        },
      }));
      setSelectedNodeIds(newIds);
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
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
    } else if (selectedNodeIds.size > 0) {
      const selected = (level.visual?.nodes || []).filter((n) =>
        selectedNodeIds.has(n.uid) ||
        (Boolean(n.id) && selectedNodeIds.has(String(n.id))) ||
        (Boolean(n.name) && selectedNodeIds.has(n.name!))
      );
      if (selected.length === 0) return;
      const beatDuration = 60 / level.timing.bpm;
      const snapInterval = getSnapInterval(level.timing.bpm, gridSubdivision);
      const minShift = snapInterval > 0 ? snapInterval : beatDuration;

      const hasLifespans = selected.some((n) => n.lifespan);
      let shift = minShift;
      if (hasLifespans) {
        const timesWithLifespan = selected.filter((n) => n.lifespan).map((n) => n.lifespan!);
        const minTime = Math.min(...timesWithLifespan.map((l) => l.startTime));
        const maxTime = Math.max(...timesWithLifespan.map((l) => l.startTime + (l.duration || 0)));
        const blockSpan = maxTime - minTime;
        shift = Math.max(minShift, snapTimeToGrid(blockSpan || minShift, level.timing.bpm, gridSubdivision));
      }

      const newIds = new Set<string>();
      const duplicatedNodes: SceneNodeData[] = selected.map((n, i) => {
        const newUid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}_${i}`;
        newIds.add(newUid);
        const cloned = duplicateSceneNode(n, newUid);
        // Cada vez que se duplica un objeto en su Timeline, este baja un carril,
        // pero si se duplica un objeto en el último carril (7), este se mueve al primero (0).
        const currentLane = n.subLane ?? 0;
        cloned.subLane = (currentLane + 1) % 8;
        return cloned;
      });

      setLevel((prev) => ({
        ...prev,
        visual: {
          ...prev.visual,
          nodes: [...(prev.visual?.nodes || []), ...duplicatedNodes],
        },
      }));
      setSelectedNodeIds(newIds);
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedEffectIds(new Set());
    } else if (selectedEffectIds.size > 0) {
      const selected = (level.visual?.effects || []).filter((e) => selectedEffectIds.has(e.id));
      if (selected.length === 0) return;
      const SHADER_LANE_COUNT = 4;
      const newIds = new Set<string>();
      const duplicatedEffects: VisualEffect[] = selected.map((eff, i) => {
        const newId = `fx_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}_${i}`;
        newIds.add(newId);
        // Cada vez que se duplica un shader, este baja un carril,
        // pero si se duplica en el último carril (3), este se mueve al primero (0).
        const currentLane = eff.lane ?? 0;
        const newLane = (currentLane + 1) % SHADER_LANE_COUNT;
        return {
          ...eff,
          id: newId,
          lane: newLane,
          parameters: { ...eff.parameters },
          region: eff.region ? { ...eff.region } : undefined,
        };
      });

      setLevel((prev) => ({
        ...prev,
        visual: {
          ...prev.visual,
          effects: [...(prev.visual?.effects || []), ...duplicatedEffects],
        },
      }));
      setSelectedEffectIds(newIds);
      setSelectedEventIds(new Set());
      setSelectedTriggerIds(new Set());
      setSelectedNodeIds(new Set());
    }
  }, [selectedEventIds, selectedTriggerIds, selectedNodeIds, selectedEffectIds, level.events, level.visual?.triggers, level.visual?.nodes, level.visual?.effects, level.timing.bpm, gridSubdivision, setLevel]);

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
    canDelete: Boolean(selectedEventIds.size > 0 || selectedTriggerIds.size > 0 || selectedNodeIds.size > 0 || selectedNodeId || selectedEffectIds.size > 0 || selectedEffectId),
    onSelectTool: handleSelectTool,
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

  // Import existing level JSON with safety parsing and deep validation,
  // preserving any audio buffers and audio processing metadata currently loaded.
  const handleJsonImport = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          const validation = LevelValidator.validate(parsed);
          if (validation.valid && validation.sanitizedLevel) {
            const currentSongId = level.songId || level.song.id;
            const existingAudioBuffer =
              SongRegistry.getInstance().getActiveAudioBuffer(currentSongId);

            let mergedLevel = validation.sanitizedLevel;

            if (existingAudioBuffer) {
              const targetSongId = currentSongId || mergedLevel.songId || mergedLevel.song.id;

              // Ensure the existing audio buffer is mapped across all relevant IDs in SongRegistry
              SongRegistry.getInstance().setAudioBuffer(targetSongId, existingAudioBuffer);
              if (mergedLevel.songId) {
                SongRegistry.getInstance().setAudioBuffer(mergedLevel.songId, existingAudioBuffer);
              }
              if (mergedLevel.song?.id) {
                SongRegistry.getInstance().setAudioBuffer(mergedLevel.song.id, existingAudioBuffer);
              }

              // Preserve decoded audio metrics: song identity, duration, and audio URLs
              mergedLevel = {
                ...mergedLevel,
                songId: targetSongId,
                song: {
                  ...mergedLevel.song,
                  id: targetSongId,
                  duration: existingAudioBuffer.duration || level.song.duration || mergedLevel.song.duration,
                  url: level.song.url || mergedLevel.song.url,
                  audioUrl: level.song.audioUrl || mergedLevel.song.audioUrl,
                  title:
                    mergedLevel.song.title && mergedLevel.song.title !== 'Untitled Track'
                      ? mergedLevel.song.title
                      : (level.song.title || 'Untitled Track'),
                  artist:
                    mergedLevel.song.artist && mergedLevel.song.artist !== 'Unknown Artist'
                      ? mergedLevel.song.artist
                      : (level.song.artist || 'Unknown Artist'),
                },
              };
            }

            resetHistory(mergedLevel);
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
    [level, handleStop, resetHistory]
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
  const selectedEvent = selectedEventId ? (level.events.find((e) => e.id === selectedEventId) || null) : null;
  const selectedTrigger = selectedTriggerId ? ((level.visual?.triggers || []).find((t) => t.id === selectedTriggerId) || null) : null;
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return (
      (level.visual?.nodes || []).find(
        (n) =>
          (n.uid && n.uid === selectedNodeId) ||
          (n.id !== null && n.id !== undefined && String(n.id) === selectedNodeId) ||
          (n.name && n.name === selectedNodeId)
      ) || null
    );
  }, [level.visual?.nodes, selectedNodeId]);

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
        onSaveToLocalStorage={saveDraftManually}
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
        onSelectTool={handleSelectTool}
        gridSubdivision={gridSubdivision}
        onChangeGridSubdivision={setGridSubdivision}
        pixelsPerSecond={pixelsPerSecond}
        onChangePixelsPerSecond={setPixelsPerSecond}
        showWaveform={showWaveform}
        onToggleWaveform={() => setShowWaveform((prev) => !prev)}
        selectedPrimitiveType={selectedPrimitiveType}
        onSelectPrimitiveType={handleSelectPrimitiveType}
        selectedShaderType={selectedShaderType}
        onSelectShaderType={handleSelectShaderType}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative z-10">
        {/* Central Workspace: Tab Switcher & Active View */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* View Tab Bar */}
          <div className="flex shrink-0 border-b border-white/10 bg-black/40">
            <button
              onClick={() => {
                setActiveTab('timeline');
                setTimelineMode('notes');
              }}
              className={`px-5 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'timeline' && timelineMode === 'notes'
                  ? 'border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/10'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" /> Notes
            </button>
            <button
              onClick={() => {
                setActiveTab('timeline');
                setTimelineMode('triggers');
              }}
              className={`px-5 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'timeline' && timelineMode === 'triggers'
                  ? 'border-[#ffea00] text-yellow-300 bg-[#ffea00]/10'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Triggers
            </button>
            <button
              onClick={() => {
                setActiveTab('timeline');
                setTimelineMode('visuals');
              }}
              className={`px-5 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'timeline' && timelineMode === 'visuals'
                  ? 'border-[#00ff9d] text-[#00ff9d] bg-[#00ff9d]/10'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Visuals
            </button>
            <button
              onClick={() => {
                setActiveTab('timeline');
                setTimelineMode('shaders');
              }}
              className={`px-5 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'timeline' && timelineMode === 'shaders'
                  ? 'border-fuchsia-400 text-fuchsia-300 bg-fuchsia-500/10'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Shaders
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-5 py-2 text-xs font-semibold transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-purple-400 text-purple-300 bg-purple-500/10'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Live Preview
            </button>
            <div className="ml-auto px-4 flex items-center gap-3 text-xs text-white/40 font-mono">
              <span className="text-[#00e5ff]/80 font-medium">
                {level.events.length} {level.events.length === 1 ? 'note' : 'notes'}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-yellow-400/80 flex items-center gap-1 font-medium">
                <Zap className="w-3 h-3" /> {(level.visual?.triggers || []).length} triggers
              </span>
              <span className="text-white/20">|</span>
              <span className="text-emerald-400/80 flex items-center gap-1 font-medium">
                <Layers className="w-3 h-3" /> {(level.visual?.nodes || []).length} visuals
              </span>
              <span className="text-white/20">|</span>
              <span className="text-fuchsia-400/80 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" /> {(level.visual?.effects || []).length} shaders
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
                timelineMode={timelineMode}
                activeLayer={activeLayer}
                onChangeActiveLayer={setActiveLayer}
                selectedPrimitiveType={selectedPrimitiveType}
                selectedShaderType={selectedShaderType}
                selectedEventId={selectedEventId}
                selectedEventIds={selectedEventIds}
                selectedTriggerId={selectedTriggerId}
                selectedTriggerIds={selectedTriggerIds}
                selectedNodeId={selectedNodeId}
                selectedNodeIds={selectedNodeIds}
                selectedEffectId={selectedEffectId}
                selectedEffectIds={selectedEffectIds}
                onSelectEvent={(evt) => selectEvent(evt?.id || null)}
                onSelectEvents={selectEventsBatch}
                onSelectTrigger={(trig) => selectTrigger(trig?.id || null)}
                onSelectTriggers={selectTriggersBatch}
                onSelectNode={(node) => selectNode(node?.uid || null)}
                onSelectNodes={selectNodesBatch}
                onSelectEffect={selectEffect}
                onSelectEffects={selectEffectsBatch}
                onToggleEventSelection={toggleEventSelection}
                onToggleTriggerSelection={toggleTriggerSelection}
                onToggleNodeSelection={toggleNodeSelection}
                onToggleEffectSelection={toggleEffectSelection}
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
                onAddNode={handleAddNode}
                onUpdateNode={handleUpdateNodeById}
                onUpdateNodesBatch={handleUpdateNodesBatch}
                onRemoveNode={handleRemoveNode}
                onAddEffect={handleAddEffect}
                onUpdateEffect={handleUpdateEffect}
                onRemoveEffect={handleRemoveEffect}
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

        {/* Right Sidebar: Contextual Properties Panel (Events, Triggers, Nodes, Shaders) */}
        <EditorPropertiesPanel
          selectedEvent={selectedEvent}
          selectedEvents={selectedEvents}
          selectedTrigger={selectedTrigger}
          selectedTriggers={selectedTriggers}
          selectedNode={selectedNode}
          selectedNodes={selectedNodes}
          selectedEffect={selectedEffect}
          selectedEffects={selectedEffects}
          effects={level.visual?.effects || []}
          nodes={level.visual?.nodes || []}
          pads={level.pads}
          activeTab={activeTab}
          timelineMode={timelineMode}
          onUpdateEvent={handleUpdateEvent}
          onUpdateEventsBatch={handleUpdateEventsBatch}
          onRemoveEvent={handleRemoveEvent}
          onRemoveBatch={handleRemoveBatch}
          onUpdateTrigger={handleUpdateTrigger}
          onRemoveTrigger={handleRemoveTrigger}
          onUpdateNode={handleUpdateNode}
          onRemoveNode={handleRemoveNode}
          onUpdateEffect={handleUpdateEffect}
          onRemoveEffect={handleRemoveEffect}
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
