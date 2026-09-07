import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioTransport } from '../../engine/time/AudioTransport';
import { VisualEngine } from '../../engine/visual/VisualEngine';
import { InputManager } from '../../engine/input/InputManager';
import { GameplayEngine } from '../../engine/gameplay/GameplayEngine';
import { GameplayEventBus } from '../../engine/gameplay/GameplayEventBus';
import { SongRegistry } from '../../engine/content/SongRegistry';
import { snapTimeToGrid, getSnapInterval, type GridSubdivision } from '../utils';
import { loadUserKeybindings, type KeybindingMap } from '../../engine/input/Keybindings';
import type {
  LevelData,
  PadId,
  AudioBands,
  SceneNodeData,
  PadEvent,
  PadBehavior,
} from '../../engine/types';
import { timelineTimeToSongTime } from '../../engine/time/timeUtils';

interface UseEditorEngineOptions {
  level: LevelData;
  activeTab: 'timeline' | 'preview';
  creationBehavior: PadBehavior;
  gridSubdivision: GridSubdivision;
  selectedTriggerId?: string | null;
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  activeTool?: string;
  customKeybindings?: KeybindingMap;
  onSelectNode?: (nodeId: string | null, isShift?: boolean) => void;
  onUpdateNodesBatch?: (nodes: SceneNodeData[]) => void;
  onRecordEvent?: (event: PadEvent) => void;
  onCanvasClick?: (stageX: number, stageY: number) => void;
}

export function useEditorEngine({
  level,
  activeTab,
  creationBehavior,
  gridSubdivision,
  selectedTriggerId,
  selectedNodeId,
  selectedNodeIds,
  activeTool,
  customKeybindings,
  onSelectNode,
  onUpdateNodesBatch,
  onRecordEvent,
  onCanvasClick,
}: UseEditorEngineOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [enableHitsounds, setEnableHitsounds] = useState(true);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);

  const transportRef = useRef<AudioTransport | null>(null);
  const visualRef = useRef<VisualEngine | null>(null);
  const gameplayRef = useRef<GameplayEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const eventBusRef = useRef<GameplayEventBus | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Active hold records: padId -> { startTime, eventId }
  const activeRecordHolds = useRef<Map<PadId, { startTime: number; eventId: string }>>(new Map());

  // Mutable refs to prevent stale closures in input callbacks
  const levelRef = useRef(level);
  levelRef.current = level;

  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const selectedTriggerIdRef = useRef(selectedTriggerId);
  selectedTriggerIdRef.current = selectedTriggerId;

  const customKeybindingsRef = useRef(customKeybindings);
  customKeybindingsRef.current = customKeybindings;

  const enableHitsoundsRef = useRef(enableHitsounds);
  enableHitsoundsRef.current = enableHitsounds;

  const creationBehaviorRef = useRef(creationBehavior);
  creationBehaviorRef.current = creationBehavior;

  const onCanvasClickRef = useRef(onCanvasClick);
  onCanvasClickRef.current = onCanvasClick;

  const gridSubdivisionRef = useRef(gridSubdivision);
  gridSubdivisionRef.current = gridSubdivision;

  const onUpdateNodesBatchRef = useRef(onUpdateNodesBatch);
  onUpdateNodesBatchRef.current = onUpdateNodesBatch;

  // Ref kept in sync with currentTime so the rAF loop always reads the latest
  // value without being listed as a dependency (which would recreate the loop
  // every frame during playback).
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const onRecordEventRef = useRef(onRecordEvent);
  onRecordEventRef.current = onRecordEvent;

  // Initialize InputManager once and maintain key mapping
  useEffect(() => {
    const input = new InputManager(
      () => currentTimeRef.current - (levelRef.current.timing?.leadIn ?? 0)
    );
    inputRef.current = input;

    const map = customKeybindingsRef.current || loadUserKeybindings(levelRef.current.pads);
    input.setKeyMap(map);

    input.onPadPress = (padId) => {
      // 1. Play immediate hitsound if enabled
      if (enableHitsoundsRef.current) {
        transportRef.current?.playHitsound(padId);
      }

      // 2. Animate pad in visual engine
      visualRef.current?.pressPad(padId);

      // 3. Live recording logic when recording and playback are active
      if (isRecordingRef.current && isPlayingRef.current) {
        const leadIn = levelRef.current.timing?.leadIn ?? 0;
        const songOffset = levelRef.current.timing?.offset ?? 0;
        const songTime = Math.max(0, timelineTimeToSongTime(currentTimeRef.current, leadIn, songOffset));
        const beh = creationBehaviorRef.current;
        const currentBpm = levelRef.current.timing.bpm;
        const sub = gridSubdivisionRef.current;

        if (beh === 'hold') {
          activeRecordHolds.current.set(padId, { startTime: songTime, eventId: crypto.randomUUID() });
        } else {
          const snappedTime = sub !== 'free' ? snapTimeToGrid(songTime, currentBpm, sub) : songTime;
          let defaultDuration: number | undefined;

          if (beh === 'loop') {
            const beatDuration = 60 / currentBpm;
            defaultDuration = beatDuration * 4; // 1 full bar
          }

          const newEvent: PadEvent = {
            id: crypto.randomUUID(),
            padId,
            targetTime: snappedTime,
            behavior: beh,
            duration: defaultDuration,
            triggerId: beh === 'trigger' ? (selectedTriggerIdRef.current || undefined) : undefined,
            quantized: sub !== 'free',
          };
          onRecordEventRef.current?.(newEvent);
        }
      }
    };

    input.onPadRelease = (padId) => {
      visualRef.current?.releasePad(padId);

      // Live recording completion for hold notes
      if (isRecordingRef.current && isPlayingRef.current) {
        const hold = activeRecordHolds.current.get(padId);
        if (hold) {
          activeRecordHolds.current.delete(padId);
          const leadIn = levelRef.current.timing?.leadIn ?? 0;
          const songOffset = levelRef.current.timing?.offset ?? 0;
          const releaseTime = Math.max(0, timelineTimeToSongTime(currentTimeRef.current, leadIn, songOffset));
          const rawDuration = Math.max(0.05, releaseTime - hold.startTime);
          const currentBpm = levelRef.current.timing.bpm;
          const sub = gridSubdivisionRef.current;

          const snappedStart = sub !== 'free' ? snapTimeToGrid(hold.startTime, currentBpm, sub) : hold.startTime;
          const interval = getSnapInterval(currentBpm, sub);
          const snappedDuration =
            interval > 0 ? Math.max(interval, Math.round(rawDuration / interval) * interval) : rawDuration;

          const newEvent: PadEvent = {
            id: hold.eventId,
            padId,
            targetTime: snappedStart,
            behavior: 'hold',
            duration: snappedDuration,
            quantized: sub !== 'free',
          };
          onRecordEventRef.current?.(newEvent);
        }
      }
    };

    input.attach();

    return () => {
      input.detach();
      inputRef.current = null;
    };
  }, []);

  // Initialize Visual Engine and Gameplay Engine when preview tab is shown
  useEffect(() => {
    if (activeTab !== 'preview' || !canvasContainerRef.current) return;

    if (!visualRef.current) {
      const eventBus = new GameplayEventBus();
      eventBusRef.current = eventBus;

      const gameplay = new GameplayEngine(
        level,
        () => currentTimeRef.current - (levelRef.current.timing?.leadIn ?? 0),
        eventBus
      );
      gameplayRef.current = gameplay;

      if (inputRef.current) {
        inputRef.current.setHandler((event) => gameplayRef.current?.handleInput(event));
      }

      const ve = new VisualEngine(canvasContainerRef.current, level, transportRef.current?.audioEngine ?? null);
      ve.onNodeSelect = (id, isShift) => {
        onSelectNode?.(id, isShift);
      };
      ve.onNodesTransformCommit = (updatedNodes) => {
        onUpdateNodesBatchRef.current?.(updatedNodes);
      };
      ve.onCanvasClick = (stageX, stageY) => {
        onCanvasClickRef.current?.(stageX, stageY);
      };

      ve.onPadInput = (padId, pressed) => {
        if (pressed) {
          inputRef.current?.pressPad(padId);
        } else {
          inputRef.current?.releasePad(padId);
        }
      };

      ve.attachEventBus(eventBus);

      ve.init().then(() => {
        visualRef.current = ve;
        if (transportRef.current?.audioEngine) {
          ve.setAudioEngine(transportRef.current.audioEngine);
        }
        if (selectedNodeIds && selectedNodeIds.size > 0) {
          ve.setSelectedNodes(selectedNodeIds);
        } else {
          ve.setSelectedNode(selectedNodeId ?? null);
        }
        if (activeTab === 'preview' || isRecording) {
          inputRef.current?.attach();
        }
        if (isPlaying) {
          const leadIn = levelRef.current.timing?.leadIn ?? 0;
          gameplay.start(currentTime - leadIn);
        }
      });
    } else if (transportRef.current?.audioEngine) {
      visualRef.current.setAudioEngine(transportRef.current.audioEngine);
    }
    // All mutable values are accessed via refs; activeTab is the only
    // structural dependency that must reinitialize the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Synchronize audio engine with visual engine whenever transport becomes available
  useEffect(() => {
    if (visualRef.current && transportRef.current?.audioEngine) {
      visualRef.current.setAudioEngine(transportRef.current.audioEngine);
    }
  }, [activeTab, isPlaying]);

  // Synchronize selection overlay with active selectedNodeIds / selectedNodeId
  useEffect(() => {
    if (selectedNodeIds && selectedNodeIds.size > 0) {
      visualRef.current?.setSelectedNodes(selectedNodeIds);
    } else {
      visualRef.current?.setSelectedNode(selectedNodeId ?? null);
    }
  }, [selectedNodeIds, selectedNodeId]);

  // Synchronize active tool cursor style on the Live Preview canvas
  useEffect(() => {
    if (visualRef.current && activeTool) {
      visualRef.current.setActiveTool(activeTool);
    }
  }, [activeTool]);

  // Attach input listener in preview mode OR when recording is active in timeline mode
  useEffect(() => {
    if (activeTab === 'preview' || isRecording) {
      inputRef.current?.attach();
      if (isPlaying && activeTab === 'preview') {
        const leadIn = levelRef.current.timing?.leadIn ?? 0;
        gameplayRef.current?.start(currentTime - leadIn);
      }
    } else {
      inputRef.current?.detach();
    }
    // isPlaying and currentTime are read at call time; listing them would
    // re-run this effect during playback, re-attaching input unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      inputRef.current?.detach();
      visualRef.current?.dispose();
      visualRef.current = null;
      gameplayRef.current?.reset();
      gameplayRef.current = null;
      eventBusRef.current = null;
    };
  }, []);

  // Sync events in real-time when level.events changes
  useEffect(() => {
    if (visualRef.current) {
      visualRef.current.syncEvents(level.events);
    }
    if (gameplayRef.current) {
      gameplayRef.current.setEvents(level.events);
    }
  }, [level.events]);

  // Sync visual nodes and triggers in real-time when level.visual changes
  useEffect(() => {
    if (visualRef.current && level.visual) {
      try {
        if (level.visual.nodes) {
          visualRef.current.syncVisualNodes(level.visual.nodes);
        }
        if (level.visual.triggers) {
          visualRef.current.syncVisualTriggers(level.visual.triggers);
        }
      } catch (err) {
        console.warn('[useEditorEngine] Non-fatal error syncing visual components:', err);
      }
    }
  }, [level.visual]);

  // Sync keyMap when level.pads or customKeybindings changes
  useEffect(() => {
    if (inputRef.current) {
      const map = customKeybindings || loadUserKeybindings(level.pads);
      inputRef.current.setKeyMap(map);
    }
  }, [level.pads, customKeybindings]);

  // Sync timing offset in real-time when level.timing changes
  useEffect(() => {
    const offset = level.timing?.offset ?? 0;
    if (gameplayRef.current) {
      gameplayRef.current.setOffset(offset);
    }
    if (visualRef.current) {
      visualRef.current.syncTiming(offset);
    }
  }, [level.timing?.offset]);

  // Main animation loop
  useEffect(() => {
    const loop = () => {
      let t = currentTimeRef.current;
      const currentLeadIn = levelRef.current.timing?.leadIn ?? 0;

      if (isPlayingRef.current && transportRef.current && transportRef.current.state === 'playing') {
        const audioTime = transportRef.current.getTime();
        t = currentLeadIn + audioTime;
        setCurrentTime(t);
        currentTimeRef.current = t;
      }

      const audioTime = t - currentLeadIn;
      const isPreRolling = audioTime < 0;

      if (activeTab === 'preview') {
        if (isPlayingRef.current && gameplayRef.current) {
          gameplayRef.current.update();
        }
        if (visualRef.current) {
          const bands: AudioBands =
            isPlayingRef.current && !isPreRolling && transportRef.current
              ? transportRef.current.getAudioBands()
              : {
                  bass: 0,
                  mids: 0,
                  treble: 0,
                  amplitude: 0,
                  freqData: new Uint8Array(0),
                  waveData: new Uint8Array(0),
                };
          visualRef.current.update(audioTime, bands);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [activeTab]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      transportRef.current?.pause();
      setIsPlaying(false);
      setIsRecording(false);
    } else {
      if (!transportRef.current) {
        transportRef.current = new AudioTransport();
        await transportRef.current.init();
        transportRef.current.setPlaybackSpeed(playbackSpeedRef.current);
      }
      if (visualRef.current && transportRef.current) {
        visualRef.current.setAudioEngine(transportRef.current.audioEngine);
      }

      // Always synchronize transport audio buffer with active level song identity
      // (crucial for instant undo/redo track alignment and audio file replacement)
      const songId = level.songId || level.song.id;
      const cached = SongRegistry.getInstance().getAudioBuffer(songId);
      if (cached) {
        transportRef.current.loadAudioBuffer(cached);
      } else if (level.song.url) {
        await transportRef.current.loadFile(level.song.url, songId);
      }
      transportRef.current.onBeat((beatIndex: number) => {
        if (visualRef.current && activeTab === 'preview') {
          visualRef.current.onBeat(beatIndex);
        }
      });

      const currentLeadIn = level.timing?.leadIn ?? 0;
      const currentTimelineTime = currentTimeRef.current;
      const audioTime = currentTimelineTime - currentLeadIn;

      const envelope = {
        fadeIn: level.timing?.fadeIn ?? 0,
        fadeOut: level.timing?.fadeOut ?? 0,
        totalDuration: level.song.duration,
      };

      if (currentTimelineTime < currentLeadIn) {
        // Pre-schedule audio with the exact remaining lead-in time
        const remainingLeadIn = currentLeadIn - currentTimelineTime;
        await transportRef.current.play(level.timing.bpm, 0, envelope, remainingLeadIn);
      } else {
        await transportRef.current.play(level.timing.bpm, Math.max(0, audioTime), envelope, 0);
      }
      setIsPlaying(true);
      if (activeTab === 'preview') {
        gameplayRef.current?.start(audioTime);
      }
    }
  }, [
    isPlaying,
    level.songId,
    level.song.id,
    level.song.url,
    level.timing.bpm,
    level.timing?.fadeIn,
    level.timing?.fadeOut,
    level.timing?.leadIn,
    level.song.duration,
    activeTab,
  ]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    const clamped = Math.max(0.25, Math.min(4.0, Number(speed.toFixed(2))));
    setPlaybackSpeedState(clamped);
    playbackSpeedRef.current = clamped;
    transportRef.current?.setPlaybackSpeed(clamped);
  }, []);

  const handleStop = useCallback(() => {
    transportRef.current?.stop();
    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    const currentLeadIn = levelRef.current.timing?.leadIn ?? 0;
    visualRef.current?.seek(-currentLeadIn);
    gameplayRef.current?.reset();
    gameplayRef.current?.start(-currentLeadIn);
    activeRecordHolds.current.clear();
  }, []);

  const handleSeek = useCallback((t: number) => {
    const clampedTime = Math.max(0, t);
    setCurrentTime(clampedTime);
    currentTimeRef.current = clampedTime;

    const currentLeadIn = levelRef.current.timing?.leadIn ?? 0;
    const audioTime = clampedTime - currentLeadIn;

    transportRef.current?.seek(audioTime);
    visualRef.current?.seek(audioTime);
    if (isPlayingRef.current) {
      gameplayRef.current?.start(audioTime);
    } else {
      gameplayRef.current?.reset();
    }
  }, []);

  const toggleRecord = useCallback(async () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      if (!isPlaying) {
        await togglePlay();
      }
    }
  }, [isRecording, isPlaying, togglePlay]);

  const toggleHitsounds = useCallback(() => {
    setEnableHitsounds((prev) => !prev);
  }, []);

  const loadAudioFile = useCallback(
    async (file: File, songId?: string): Promise<{ success: boolean; duration: number }> => {
      if (!transportRef.current) {
        transportRef.current = new AudioTransport();
        await transportRef.current.init();
        transportRef.current.setPlaybackSpeed(playbackSpeedRef.current);
      }
      if (visualRef.current && transportRef.current) {
        visualRef.current.setAudioEngine(transportRef.current.audioEngine);
      }
      const result = await transportRef.current.loadAudio(file, songId);
      if (result.success) {
        setIsPlaying(false);
        setIsRecording(false);
        setCurrentTime(0);
        currentTimeRef.current = 0;
        const currentLeadIn = levelRef.current.timing?.leadIn ?? 0;
        visualRef.current?.seek(-currentLeadIn);
        gameplayRef.current?.reset();
      }
      return result;
    },
    []
  );

  const updateSceneNode = useCallback((node: SceneNodeData) => {
    visualRef.current?.updateNode(node);
  }, []);

  const dispose = useCallback(() => {
    transportRef.current?.dispose();
    transportRef.current = null;
  }, []);

  return {
    canvasContainerRef,
    isPlaying,
    isRecording,
    enableHitsounds,
    playbackSpeed,
    setPlaybackSpeed,
    currentTime,
    setCurrentTime,
    togglePlay,
    toggleRecord,
    toggleHitsounds,
    handleStop,
    handleSeek,
    loadAudioFile,
    updateSceneNode,
    dispose,
  };
}
