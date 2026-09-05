import React from 'react';
import { Square, Circle, Folder, Trash2, Plus, Layers } from 'lucide-react';
import type { SceneNodeData } from '../../engine/types';

interface SceneOutlinerProps {
  nodes: SceneNodeData[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onAddNode: (node: SceneNodeData) => void;
  onRemoveNode: (nodeId: string) => void;
}

export function SceneOutliner({
  nodes,
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onRemoveNode,
}: SceneOutlinerProps) {
  const getNextCounter = (prefix: string) => {
    let max = 0;
    for (const node of nodes) {
      const name = node.name || (typeof node.id === 'string' ? node.id : '');
      if (name.startsWith(`${prefix}-`)) {
        const num = parseInt(name.replace(`${prefix}-`, ''), 10);
        if (!Number.isNaN(num) && num > max) max = num;
      }
    }
    return max + 1;
  };

  const handleAddRectangle = () => {
    const counter = getNextCounter('rect');
    const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;
    const newRect: SceneNodeData = {
      uid,
      name: `rect-${counter}`,
      id: null, // Por defecto null (sin ID)
      type: 'rectangle',
      visible: true,
      transform: {
        x: 960,
        y: 540,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 0.9,
      },
      properties: {
        width: 140,
        height: 140,
        color: '#00e5ff',
      },
    };
    onAddNode(newRect);
    onSelectNode(newRect.uid!);
  };

  const handleAddCircle = () => {
    const counter = getNextCounter('circle');
    const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;
    const newCircle: SceneNodeData = {
      uid,
      name: `circle-${counter}`,
      id: null, // Por defecto null (sin ID)
      type: 'circle',
      visible: true,
      transform: {
        x: 960,
        y: 540,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 0.9,
      },
      properties: {
        radius: 70,
        color: '#ff007f',
      },
    };
    onAddNode(newCircle);
    onSelectNode(newCircle.uid!);
  };

  const handleAddGroup = () => {
    const counter = getNextCounter('group');
    const uid = `node_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`;
    const newGroup: SceneNodeData = {
      uid,
      name: `group-${counter}`,
      id: null, // Por defecto null (sin ID)
      type: 'group',
      visible: true,
      transform: {
        x: 960,
        y: 540,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
      },
      properties: {},
    };
    onAddNode(newGroup);
    onSelectNode(newGroup.uid!);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'rectangle':
        return <Square className="w-3.5 h-3.5 text-[#00e5ff]" />;
      case 'circle':
        return <Circle className="w-3.5 h-3.5 text-[#ff007f]" />;
      case 'group':
      case 'container':
        return <Folder className="w-3.5 h-3.5 text-[#ffea00]" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-white/60" />;
    }
  };

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Action Toolbar for Adding Primitives */}
      <div className="p-3 border-b border-white/10 bg-black/30">
        <div className="text-[10px] uppercase font-mono text-white/40 mb-2 font-bold flex items-center justify-between">
          <span>Crear Primitiva</span>
          <span className="text-white/60">{nodes.length} nodos</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleAddRectangle}
            title="Crear Rectángulo en centro (X:960, Y:540)"
            className="px-2 py-1.5 bg-white/5 hover:bg-[#00e5ff]/20 text-white/90 hover:text-[#00e5ff] rounded border border-white/10 hover:border-[#00e5ff]/40 transition-colors flex items-center justify-center gap-1 font-mono font-medium"
          >
            <Square className="w-3 h-3 text-[#00e5ff]" />
            <span>Rect</span>
          </button>
          <button
            onClick={handleAddCircle}
            title="Crear Círculo en centro (X:960, Y:540)"
            className="px-2 py-1.5 bg-white/5 hover:bg-[#ff007f]/20 text-white/90 hover:text-[#ff007f] rounded border border-white/10 hover:border-[#ff007f]/40 transition-colors flex items-center justify-center gap-1 font-mono font-medium"
          >
            <Circle className="w-3 h-3 text-[#ff007f]" />
            <span>Circ</span>
          </button>
          <button
            onClick={handleAddGroup}
            title="Crear Contenedor / Grupo lógico"
            className="px-2 py-1.5 bg-white/5 hover:bg-[#ffea00]/20 text-white/90 hover:text-[#ffea00] rounded border border-white/10 hover:border-[#ffea00]/40 transition-colors flex items-center justify-center gap-1 font-mono font-medium"
          >
            <Folder className="w-3 h-3 text-[#ffea00]" />
            <span>Group</span>
          </button>
        </div>
      </div>

      {/* Nodes List / Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {nodes.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-[11px] font-mono">
            No hay nodos escénicos.<br />
            Haz clic en los botones superiores para agregar elementos visuales.
          </div>
        ) : (
          nodes.map((node) => {
            const nodeKey = node.uid || (typeof node.id === 'string' ? node.id : node.name || 'node');
            const isSelected = selectedNodeId === nodeKey || (node.uid && selectedNodeId === node.uid);
            const color = (node.properties?.color as string) || '#ffffff';
            const displayName = node.name || (typeof node.id === 'string' ? node.id : nodeKey);

            return (
              <div
                key={nodeKey}
                onClick={() => onSelectNode(isSelected ? null : nodeKey)}
                className={`group px-2.5 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-[#00e5ff]/20 text-white border-[#00e5ff]/60 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                    : 'bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white border-white/5'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 pr-2">
                  {getNodeIcon(node.type)}
                  <span className="font-mono font-medium truncate text-white/90">{displayName}</span>
                  {node.id !== null && node.id !== undefined && node.id !== '' ? (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 font-mono text-[9px] font-bold shrink-0">
                      ID: {node.id}
                    </span>
                  ) : (
                    <span className="px-1 py-0.5 rounded bg-white/5 text-white/30 font-mono text-[9px] shrink-0">
                      null
                    </span>
                  )}
                  {node.type !== 'group' && (
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 ml-auto"
                      style={{ backgroundColor: color }}
                      title={`Color: ${color}`}
                    />
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveNode(nodeKey);
                  }}
                  title="Eliminar nodo"
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
