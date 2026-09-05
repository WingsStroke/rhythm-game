import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioTransport } from '../../engine/time/AudioTransport';
import { VisualEngine } from '../../engine/visual/VisualEngine';
import { InputManager } from '../../engine/input/InputManager';
import { GameplayEngine } from '../../engine/gameplay/GameplayEngine';
import { GameplayEventBus } from '../../engine/gameplay/GameplayEventBus';
import type { LevelData, PadId, AudioBands, SceneNodeData } from '../../engine/types';

interface UseEditorEngineOptions {
  level: LevelData;
  activeTab: 'timeline' | 'preview';
  onSelectNode?: (nodeId: string | null) => void;
}

export function useEditorEngine({ level, activeTab, onSelectNode }: UseEditorEngineOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const transportRef = useRef<AudioTransport | null>(null);
  const visualRef = useRef<VisualEngine | null>(null);
  const gameplayRef = useRef<GameplayEngine | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const eventBusRef = useRef<GameplayEventBus | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize Visual Engine, Gameplay Engine and Input Manager when preview tab is shown
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

      const input = new InputManager(() => transportRef.current?.getTime() ?? 0);
      inputRef.current = input;

      const map: Record<string, PadId> = {};
      for (const pad of level.pads) {
        if (pad.keyHint) {
          map[`Key${pad.keyHint.toUpperCase()}`] = pad.id;
        }
      }
      input.setKeyMap(map);
      input.setHandler((event) => gameplayRef.current?.handleInput(event));

      const ve = new VisualEngine(canvasContainerRef.current, level, transportRef.current?.audioEngine ?? null);
      ve.onNodeSelect = (id) => {
        onSelectNode?.(id);
      };

      input.onPadPress = (padId) => ve.pressPad(padId);
      input.onPadRelease = (padId) => ve.releasePad(padId);

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
        if (activeTab === 'preview') {
          input.attach();
        }
        if (isPlaying) {
          gameplay.start(currentTime);
        }
      });
    } else {
      inputRef.current?.attach();
      if (isPlaying) {
        gameplayRef.current?.start(currentTime);
      }
    }
  }, [activeTab]);

  // Tab switching effect to attach/detach input listeners
  useEffect(() => {
    if (activeTab === 'preview') {
      inputRef.current?.attach();
      if (isPlaying) {
        gameplayRef.current?.start(currentTime);
      }
    } else {
      inputRef.current?.detach();
    }
  }, [activeTab]);

  // Cleanup Visual Engine, Gameplay Engine and Input Manager on unmount
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
      let t = currentTime;
      if (isPlaying && transportRef.current) {
        t = transportRef.current.getTime();
        setCurrentTime(t);
      }
      if (activeTab === 'preview') {
        if (isPlaying && gameplayRef.current) {
          gameplayRef.current.update();
        }
        if (visualRef.current) {
          const bands: AudioBands =
            isPlaying && transportRef.current
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
  }, [isPlaying, activeTab]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      transportRef.current?.pause();
      setIsPlaying(false);
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
    setCurrentTime(0);
    visualRef.current?.seek(0);
    gameplayRef.current?.reset();
    gameplayRef.current?.start(0);
  }, []);

  const handleSeek = useCallback((t: number) => {
    setCurrentTime(t);
    transportRef.current?.seek(t);
    visualRef.current?.seek(t);
    if (isPlaying) {
      gameplayRef.current?.start(t);
    } else {
      gameplayRef.current?.reset();
    }
  }, [isPlaying]);

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
    currentTime,
    setCurrentTime,
    togglePlay,
    handleStop,
    handleSeek,
    updateSceneNode,
    dispose,
  };
}
