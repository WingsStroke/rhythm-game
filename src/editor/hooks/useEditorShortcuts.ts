import { useEffect } from 'react';
import type { EditorTool } from '../Timeline';

interface UseEditorShortcutsOptions {
  activeTab: 'timeline' | 'preview';
  isRecording?: boolean;
  selectedEventId: string | null;
  onSelectTool: (tool: EditorTool) => void;
  onDeleteSelectedEvent: () => void;
  onTogglePlay: () => void;
  onToggleRecord?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function useEditorShortcuts({
  activeTab,
  isRecording,
  selectedEventId,
  onSelectTool,
  onDeleteSelectedEvent,
  onTogglePlay,
  onToggleRecord,
  onUndo,
  onRedo,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Undo / Redo keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Record shortcut (R)
      if (e.code === 'KeyR') {
        e.preventDefault();
        onToggleRecord?.();
        return;
      }

      // Space play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
        return;
      }

      // In preview mode or while actively recording, let pad keys pass through to InputManager
      if (activeTab === 'preview' || isRecording) {
        return;
      }

      if (e.code === 'KeyV') {
        onSelectTool('select');
      } else if (e.code === 'KeyB') {
        onSelectTool('pen');
      } else if (e.code === 'KeyE') {
        onSelectTool('eraser');
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedEventId) {
          e.preventDefault();
          onDeleteSelectedEvent();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, onTogglePlay, onToggleRecord, onSelectTool, onDeleteSelectedEvent, onUndo, onRedo, activeTab, isRecording]);
}
