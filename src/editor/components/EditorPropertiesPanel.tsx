import React from 'react';
import { MousePointerClick } from 'lucide-react';
import type {
  PadEvent,
  PadConfig,
  SceneNodeData,
  TriggerData,
  VisualEffect,
} from '../../engine/types';
import {
  NoteInspector,
  TriggerInspector,
  EffectInspector,
  NodeInspector,
} from './properties';

export interface EditorPropertiesPanelProps {
  selectedEvent: PadEvent | null;
  selectedEvents?: PadEvent[];
  /** All PadEvents in the level, used for loop-nesting validation. */
  allEvents?: PadEvent[];
  selectedNode: SceneNodeData | null;
  selectedNodes?: SceneNodeData[];
  selectedTrigger: TriggerData | null;
  selectedTriggers: TriggerData[];
  selectedEffect?: VisualEffect | null;
  selectedEffects?: VisualEffect[];
  effects?: VisualEffect[];
  nodes?: SceneNodeData[];
  pads: PadConfig[];
  activeTab: 'timeline' | 'preview';
  timelineMode?: 'notes' | 'triggers' | 'visuals' | 'shaders';
  onUpdateEvent: (event: PadEvent) => void;
  onUpdateEventsBatch?: (events: PadEvent[]) => void;
  onRemoveEvent: (id: string) => void;
  onRemoveBatch?: (eventIds?: Set<string>, triggerIds?: Set<string>, nodeIds?: Set<string>, effectIds?: Set<string>) => void;
  onUpdateNode: (updates: Partial<SceneNodeData>) => void;
  onRemoveNode?: (id: string) => void;
  onUpdateTrigger: (trigger: TriggerData) => void;
  onRemoveTrigger: (id: string) => void;
  onUpdateEffect?: (effect: VisualEffect) => void;
  onRemoveEffect?: (id: string) => void;
}

export function EditorPropertiesPanel({
  selectedEvent,
  selectedEvents,
  allEvents,
  selectedNode,
  selectedNodes,
  selectedTrigger,
  selectedTriggers,
  selectedEffect,
  selectedEffects,
  pads,
  activeTab,
  timelineMode,
  onUpdateEvent,
  onUpdateEventsBatch,
  onRemoveEvent,
  onRemoveBatch,
  onUpdateNode,
  onRemoveNode,
  onUpdateTrigger,
  onRemoveTrigger,
  onUpdateEffect,
  onRemoveEffect,
}: EditorPropertiesPanelProps) {
  const hasEventSelection = Boolean(selectedEvent || (selectedEvents && selectedEvents.length > 0));
  const hasTriggerSelection = Boolean(selectedTrigger || (selectedTriggers && selectedTriggers.length > 0));
  const hasNodeSelection = Boolean(selectedNode || (selectedNodes && selectedNodes.length > 0));
  const hasEffectSelection = Boolean(selectedEffect || (selectedEffects && selectedEffects.length > 0));

  return (
    <aside className="w-72 border-l border-white/10 bg-black/20 p-4 shrink-0 flex flex-col h-full min-h-0 overflow-y-auto select-none custom-scrollbar">
      {hasEventSelection ? (
        <NoteInspector
          selectedEvent={selectedEvent}
          selectedEvents={selectedEvents}
          allEvents={allEvents}
          pads={pads}
          onUpdateEvent={onUpdateEvent}
          onUpdateEventsBatch={onUpdateEventsBatch}
          onRemoveEvent={onRemoveEvent}
          onRemoveBatch={onRemoveBatch}
        />
      ) : hasTriggerSelection ? (
        <TriggerInspector
          selectedTrigger={selectedTrigger}
          selectedTriggers={selectedTriggers}
          onUpdateTrigger={onUpdateTrigger}
          onRemoveTrigger={onRemoveTrigger}
          onRemoveBatch={onRemoveBatch}
        />
      ) : hasEffectSelection ? (
        <EffectInspector
          selectedEffect={selectedEffect ?? null}
          selectedEffects={selectedEffects}
          onUpdateEffect={onUpdateEffect}
          onRemoveEffect={onRemoveEffect}
          onRemoveBatch={onRemoveBatch}
        />
      ) : hasNodeSelection ? (
        <NodeInspector
          selectedNode={selectedNode}
          selectedNodes={selectedNodes}
          onUpdateNode={onUpdateNode}
          onRemoveNode={onRemoveNode}
          onRemoveBatch={onRemoveBatch}
        />
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-12">
          <MousePointerClick className="w-8 h-8 mb-2 text-white/60" />
          <div className="text-xs italic leading-relaxed text-white/80">
            {activeTab === 'timeline'
              ? timelineMode === 'shaders'
                ? 'Click a shader block in timeline or use Shader (S) tool to place and inspect.'
                : 'Click a note or timeline trigger to inspect properties.'
              : 'Select an object in Scene tab or Live Preview to edit it.'}
          </div>
        </div>
      )}
    </aside>
  );
}
