import { useEffect } from 'react';
import type { EditorTool } from '../Timeline';

interface UseEditorShortcutsOptions {
  activeTab: 'timeline' | 'preview';
  selectedEventId: string | null;
  onSelectTool: (tool: EditorTool) => void;
  onDeleteSelectedEvent: () => void;
  onTogglePlay: () => void;
}

export function useEditorShortcuts({
  activeTab,
  selectedEventId,
  onSelectTool,
  onDeleteSelectedEvent,
  onTogglePlay,
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

      // In preview mode, allow Space to toggle play/pause, but don't intercept other keys (e.g. pad inputs)
      if (activeTab === 'preview') {
        if (e.code === 'Space') {
          e.preventDefault();
          onTogglePlay();
        }
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
      } else if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, onTogglePlay, onSelectTool, onDeleteSelectedEvent, activeTab]);
}
