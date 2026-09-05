import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioTransport } from '../../engine/time/AudioTransport';
import { VisualEngine } from '../../engine/visual/VisualEngine';
import { InputManager } from '../../engine/input/InputManager';
import { GameplayEngine } from '../../engine/gameplay/GameplayEngine';
import { GameplayEventBus } from '../../engine/gameplay/GameplayEventBus';
import { snapTimeToGrid, getSnapInterval } from '../Timeline';
import type {
  LevelData,
  PadId,
  AudioBands,
  SceneNodeData,
  PadEvent,
  PadBehavior,
} from '../../engine/types';
import type { GridSubdivision } from '../Timeline';

interface UseEditorEngineOptions {
  level: LevelData;
  activeTab: 'timeline' | 'preview';
  creationBehavior: PadBehavior;
  gridSubdivision: GridSubdivision;
  onSelectNode?: (nodeId: string | null) => void;
  onRecordEvent?: (event: PadEvent) => void;
}

export function useEditorEngine({
  level,
  activeTab,
  creationBehavior,
  gridSubdivision,
  onSelectNode,
  onRecordEvent,
}: UseEditorEngineOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [enableHitsounds, setEnableHitsounds] = useState(true);
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

  const enableHitsoundsRef = useRef(enableHitsounds);
  enableHitsoundsRef.current = enableHitsounds;

  const creationBehaviorRef = useRef(creationBehavior);
  creationBehaviorRef.current = creationBehavior;

  const gridSubdivisionRef = useRef(gridSubdivision);
  gridSubdivisionRef.current = gridSubdivision;

  // Ref kept in sync with currentTime so the rAF loop always reads the latest
  // value without being listed as a dependency (which would recreate the loop
  // every frame during playback).
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const onRecordEventRef = useRef(onRecordEvent);
  onRecordEventRef.current = onRecordEvent;

  // Initialize InputManager once and maintain key mapping
  useEffect(() => {
    const input = new InputManager(() => transportRef.current?.getTime() ?? 0);
    inputRef.current = input;

    const map: Record<string, PadId> = {};
    for (const pad of levelRef.current.pads) {
      if (pad.keyHint) {
        map[`Key${pad.keyHint.toUpperCase()}`] = pad.id;
      }
    }
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
        const t = transportRef.current?.getTime() ?? 0;
        const beh = creationBehaviorRef.current;
        const currentBpm = levelRef.current.timing.bpm;
        const sub = gridSubdivisionRef.current;

        if (beh === 'hold') {
          activeRecordHolds.current.set(padId, { startTime: t, eventId: crypto.randomUUID() });
        } else {
          const snappedTime = sub !== 'free' ? snapTimeToGrid(t, currentBpm, sub) : t;
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
            triggerId: beh === 'trigger' ? levelRef.current.visual.triggers[0]?.id || 'trigger_1' : undefined,
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
          const releaseTime = transportRef.current?.getTime() ?? hold.startTime;
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
        () => transportRef.current?.getTime() ?? 0,
        eventBus
      );
      gameplayRef.current = gameplay;

      if (inputRef.current) {
        inputRef.current.setHandler((event) => gameplayRef.current?.handleInput(event));
      }

      const ve = new VisualEngine(canvasContainerRef.current, level, transportRef.current?.audioEngine ?? null);
      ve.onNodeSelect = (id) => {
        onSelectNode?.(id);
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
        if (activeTab === 'preview' || isRecording) {
          inputRef.current?.attach();
        }
        if (isPlaying) {
          gameplay.start(currentTime);
        }
      });
    }
    // All mutable values are accessed via refs; activeTab is the only
    // structural dependency that must reinitialize the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Attach input listener in preview mode OR when recording is active in timeline mode
  useEffect(() => {
    if (activeTab === 'preview' || isRecording) {
      inputRef.current?.attach();
      if (isPlaying && activeTab === 'preview') {
        gameplayRef.current?.start(currentTime);
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
      if (level.visual.nodes) {
        visualRef.current.syncVisualNodes(level.visual.nodes);
      }
      if (level.visual.triggers) {
        visualRef.current.syncVisualTriggers(level.visual.triggers);
      }
    }
  }, [level.visual]);

  // Sync keyMap when level.pads changes
  useEffect(() => {
    if (inputRef.current) {
      const map: Record<string, PadId> = {};
      for (const pad of level.pads) {
        if (pad.keyHint) {
          map[`Key${pad.keyHint.toUpperCase()}`] = pad.id;
        }
      }
      inputRef.current.setKeyMap(map);
    }
  }, [level.pads]);

  // Main animation loop
  useEffect(() => {
    const loop = () => {
      // Read from ref to avoid stale closure on currentTime while keeping
      // the effect stable (no currentTime in the dependency array).
      let t = currentTimeRef.current;
      if (isPlayingRef.current && transportRef.current) {
        t = transportRef.current.getTime();
        setCurrentTime(t);
        currentTimeRef.current = t;
      }
      if (activeTab === 'preview') {
        if (isPlayingRef.current && gameplayRef.current) {
          gameplayRef.current.update();
        }
        if (visualRef.current) {
          const bands: AudioBands =
            isPlayingRef.current && transportRef.current
              ? transportRef.current.getAudioBands()
              : {
                  bass: 0,
                  mids: 0,
                  treble: 0,
                  amplitude: 0,
                  freqData: new Uint8Array(0),
                  waveData: new Uint8Array(0),
                };
          visualRef.current.update(t, bands);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
    // activeTab is the only structural dependency; isPlaying and currentTime
    // are accessed via refs to prevent loop re-creation on every state update.
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
        if (level.song.url) {
          await transportRef.current.loadFile(level.song.url);
        }
      }
      transportRef.current.onBeat((beatIndex: number) => {
        if (visualRef.current && activeTab === 'preview') {
          visualRef.current.onBeat(beatIndex);
        }
      });
      await transportRef.current.play(level.timing.bpm, currentTime);
      setIsPlaying(true);
      if (activeTab === 'preview') {
        gameplayRef.current?.start(currentTime);
      }
    }
  }, [isPlaying, currentTime, level.song.url, level.timing.bpm, activeTab]);

  const handleStop = useCallback(() => {
    transportRef.current?.stop();
    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
    visualRef.current?.seek(0);
    gameplayRef.current?.reset();
    gameplayRef.current?.start(0);
    activeRecordHolds.current.clear();
  }, []);

  const handleSeek = useCallback(
    (t: number) => {
      setCurrentTime(t);
      transportRef.current?.seek(t);
      visualRef.current?.seek(t);
      if (isPlaying) {
        gameplayRef.current?.start(t);
      } else {
        gameplayRef.current?.reset();
      }
    },
    [isPlaying]
  );

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
    async (file: File): Promise<{ success: boolean; duration: number }> => {
      if (!transportRef.current) {
        transportRef.current = new AudioTransport();
        await transportRef.current.init();
      }
      const result = await transportRef.current.loadAudio(file);
      if (result.success) {
        setIsPlaying(false);
        setIsRecording(false);
        setCurrentTime(0);
        visualRef.current?.seek(0);
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
