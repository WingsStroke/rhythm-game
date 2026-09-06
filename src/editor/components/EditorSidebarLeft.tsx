import React from 'react';
import { Layers } from 'lucide-react';
import type { LevelData, SceneNodeData } from '../../engine/types';
import { SceneOutliner } from './SceneOutliner';

interface EditorSidebarLeftProps {
  level: LevelData;
  onChangeLevel?: (newLevel: LevelData) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddNode: (node: SceneNodeData) => void;
  onRemoveNode: (nodeId: string) => void;
}

export function EditorSidebarLeft({
  level,
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onRemoveNode,
}: EditorSidebarLeftProps) {
  const nodeCount = level.visual?.nodes?.length || 0;

  return (
    <aside className="w-64 border-r border-white/10 bg-black/20 flex flex-col shrink-0 select-none overflow-hidden h-full min-h-0">
      {/* Dedicated Scene Outliner Header */}
      <div className="h-10 px-3.5 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00e5ff]" />
          <span className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
            Scene Outliner
          </span>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
        </span>
      </div>

      {/* Full-Height Scene Outliner */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <SceneOutliner
          nodes={level.visual?.nodes || []}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onAddNode={onAddNode}
          onRemoveNode={onRemoveNode}
        />
      </div>
    </aside>
  );
}
