import { useState, useCallback, useRef } from 'react';
import type { LevelData } from '../../engine/types';

interface UseEditorHistoryReturn {
  level: LevelData;
  setLevel: (newLevel: LevelData | ((prev: LevelData) => LevelData), recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (initialLevel: LevelData) => void;
}

const MAX_HISTORY = 50;

/**
 * useEditorHistory — Manages state history for LevelData with a fixed-size stack.
 * Allows atomic undo / redo operations while debouncing continuous drag operations.
 */
export function useEditorHistory(initialLevel: LevelData): UseEditorHistoryReturn {
  const [present, setPresent] = useState<LevelData>(initialLevel);
  const [past, setPast] = useState<LevelData[]>([]);
  const [future, setFuture] = useState<LevelData[]>([]);

  // Ref to hold the current present state to prevent stale closures in callbacks
  const presentRef = useRef(present);
  presentRef.current = present;

  const setLevel = useCallback(
    (newLevelOrFn: LevelData | ((prev: LevelData) => LevelData), recordHistory = true) => {
      const current = presentRef.current;
      const next = typeof newLevelOrFn === 'function' ? newLevelOrFn(current) : newLevelOrFn;

      if (next === current) return;

      if (recordHistory) {
        setPast((prevPast) => {
          const updated = [...prevPast, current];
          if (updated.length > MAX_HISTORY) {
            return updated.slice(updated.length - MAX_HISTORY);
          }
          return updated;
        });
        setFuture([]); // New branch of actions invalidates future redo branch
      }

      setPresent(next);
    },
    []
  );

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;

      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setFuture((prevFuture) => [presentRef.current, ...prevFuture]);
      setPresent(previous);

      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setPast((prevPast) => {
        const updated = [...prevPast, presentRef.current];
        if (updated.length > MAX_HISTORY) {
          return updated.slice(updated.length - MAX_HISTORY);
        }
        return updated;
      });
      setPresent(next);

      return newFuture;
    });
  }, []);

  const resetHistory = useCallback((newInitialLevel: LevelData) => {
    setPresent(newInitialLevel);
    setPast([]);
    setFuture([]);
  }, []);

  return {
    level: present,
    setLevel,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetHistory,
  };
}
