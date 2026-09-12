import { useEffect } from 'react';
import type { EditorTool } from '../Timeline';

interface UseEditorShortcutsOptions {
  activeTab: 'timeline' | 'preview';
  isRecording?: boolean;
  canDelete?: boolean;
  onSelectTool: (tool: EditorTool) => void;
  onDeleteSelected: () => void;
  onTogglePlay: () => void;
  onToggleRecord?: () => void;
  onToggleWaveform?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onSelectAll?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function useEditorShortcuts({
  activeTab,
  isRecording,
  canDelete,
  onSelectTool,
  onDeleteSelected,
  onTogglePlay,
  onToggleRecord,
  onToggleWaveform,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onSelectAll,
  onZoomIn,
  onZoomOut,
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

      // Clipboard shortcuts: Copy (Ctrl+C), Cut (Ctrl+X), Paste (Ctrl+V), Duplicate (Ctrl+D), Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        e.preventDefault();
        onCopy?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
        e.preventDefault();
        onCut?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        e.preventDefault();
        onPaste?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        onDuplicate?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
        e.preventDefault();
        onSelectAll?.();
        return;
      }

      // Zoom shortcuts: Zoom In (Ctrl + '+' / '='), Zoom Out (Ctrl + '-')
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+' || e.key === '=')) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-')) {
        e.preventDefault();
        onZoomOut?.();
        return;
      }

      // Record shortcut (R)
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
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

      // Delete / Backspace shortcut for any selected items (events, triggers, or nodes)
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (canDelete && !isRecording) {
          e.preventDefault();
          onDeleteSelected();
          return;
        }
      }

      // In preview mode or while actively recording, let pad keys pass through to InputManager
      if (activeTab === 'preview' || isRecording) {
        return;
      }

      if (e.code === 'KeyW' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onToggleWaveform?.();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.code === 'KeyV') {
          onSelectTool('select');
        } else if (e.code === 'KeyB') {
          onSelectTool('pen');
        } else if (e.code === 'KeyE') {
          onSelectTool('eraser');
        } else if (e.code === 'KeyO') {
          onSelectTool('object');
        } else if (e.code === 'KeyS') {
          onSelectTool('shader');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canDelete,
    onTogglePlay,
    onToggleRecord,
    onToggleWaveform,
    onSelectTool,
    onDeleteSelected,
    onUndo,
    onRedo,
    onCopy,
    onCut,
    onPaste,
    onDuplicate,
    onSelectAll,
    onZoomIn,
    onZoomOut,
    activeTab,
    isRecording,
  ]);
}
