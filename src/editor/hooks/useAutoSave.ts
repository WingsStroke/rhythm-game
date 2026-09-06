import { useEffect, useRef, useState, useCallback } from 'react';
import type { LevelData } from '../../engine/types';

export const EDITOR_DRAFT_KEY = 'wings_stroke_editor_draft';

export interface EditorDraft {
  level: LevelData;
  timestamp: number;
  audioFileName?: string;
}

interface UseAutoSaveOptions {
  level: LevelData;
  audioFileName?: string;
  enabled?: boolean;
}

export function useAutoSave({
  level,
  audioFileName,
  enabled = true,
}: UseAutoSaveOptions) {
  const [draftAvailable, setDraftAvailable] = useState<boolean>(false);
  const [draftData, setDraftData] = useState<EditorDraft | null>(null);
  const isRestoringRef = useRef<boolean>(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Check for existing draft on initial mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EDITOR_DRAFT_KEY);
      if (!raw) return;

      const parsed: EditorDraft = JSON.parse(raw);
      if (
        parsed &&
        parsed.level &&
        Array.isArray(parsed.level.events) &&
        Array.isArray(parsed.level.pads)
      ) {
        // Offer restore if draft has authored content
        if (parsed.level.events.length > 0) {
          setDraftAvailable(true);
          setDraftData(parsed);
        }
      }
    } catch (err) {
      console.warn('Could not read editor draft from localStorage:', err);
    }
  }, []);

  // Debounced auto-save on level changes
  useEffect(() => {
    if (!enabled || isRestoringRef.current) return;

    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        const payload: EditorDraft = {
          level,
          timestamp: Date.now(),
          audioFileName: audioFileName || undefined,
        };
        localStorage.setItem(EDITOR_DRAFT_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Could not save draft to localStorage:', err);
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [level, audioFileName, enabled]);

  const restoreDraft = useCallback((): { level: LevelData; audioFileName?: string } | null => {
    if (!draftData) return null;
    isRestoringRef.current = true;
    setDraftAvailable(false);

    // Reset isRestoring flag after state propagation
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 500);

    return {
      level: draftData.level,
      audioFileName: draftData.audioFileName,
    };
  }, [draftData]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch (err) {
      console.warn('Could not remove draft from localStorage:', err);
    }
    setDraftAvailable(false);
    setDraftData(null);
  }, []);

  const clearAutoSave = useCallback(() => {
    try {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch {
      // Ignored
    }
    setDraftAvailable(false);
    setDraftData(null);
  }, []);

  return {
    isDraftAvailable: draftAvailable,
    draftTimestamp: draftData?.timestamp ?? null,
    draftAudioFileName: draftData?.audioFileName,
    restoreDraft,
    discardDraft,
    clearAutoSave,
  };
}
