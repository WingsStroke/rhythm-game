import { Container, Graphics, Rectangle, type Application } from 'pixi.js';
import type { SceneNode } from '../objects/SceneNode';
import type { SceneNodeData } from '../../types';

export type GizmoHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface HandleInfo {
  type: GizmoHandleType;
  cursor: string;
  graphics: Graphics;
}

interface NodeInitialState {
  node: SceneNode;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * TransformGizmo provides an interactive move and resize/scale widget directly inside
 * the PixiJS Live Preview viewport.
 * Supports both single-object and multi-object collective bounding boxes.
 */
export class TransformGizmo extends Container {
  private app: Application;
  private sceneContainer: Container;

  private outlineGraphics: Graphics;
  private moveHitArea: Graphics;
  private handles: Map<GizmoHandleType, HandleInfo> = new Map();

  private selectedNodes: SceneNode[] = [];
  private isDragging = false;
  private dragMode: 'none' | 'translate' | 'scale' = 'none';
  private activeHandle: GizmoHandleType | null = null;

  private startScreenPos = { x: 0, y: 0 };
  private startBBox = { x: 0, y: 0, width: 0, height: 0 }; // in stage coordinates
  private initialStates: Map<string, NodeInitialState> = new Map();

  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;

  public onCommit?: (updatedNodes: SceneNodeData[]) => void;
  public onChange?: () => void;

  constructor(app: Application, sceneContainer: Container) {
    super();
    this.app = app;
    this.sceneContainer = sceneContainer;
    this.zIndex = 100;

    // 1. Move Hit Area (interior of the bounding box)
    this.moveHitArea = new Graphics();
    this.moveHitArea.eventMode = 'static';
    this.moveHitArea.cursor = 'move';
    this.moveHitArea.on('pointerdown', this.onMoveStart, this);
    this.addChild(this.moveHitArea);

    // 2. Dashed Outline & Center Pivot Marker
    this.outlineGraphics = new Graphics();
    this.addChild(this.outlineGraphics);

    // 3. Resize Handles
    const handleConfigs: { type: GizmoHandleType; cursor: string }[] = [
      { type: 'nw', cursor: 'nwse-resize' },
      { type: 'n', cursor: 'ns-resize' },
      { type: 'ne', cursor: 'nesw-resize' },
      { type: 'e', cursor: 'ew-resize' },
      { type: 'se', cursor: 'nwse-resize' },
      { type: 's', cursor: 'ns-resize' },
      { type: 'sw', cursor: 'nesw-resize' },
      { type: 'w', cursor: 'ew-resize' },
    ];

    for (const conf of handleConfigs) {
      const g = new Graphics();
      g.eventMode = 'static';
      g.cursor = conf.cursor;
      g.hitArea = new Rectangle(-8, -8, 16, 16);
      g.on('pointerdown', (e) => this.onScaleStart(conf.type, e));
      this.addChild(g);
      this.handles.set(conf.type, { type: conf.type, cursor: conf.cursor, graphics: g });
    }

    this.boundOnPointerMove = this.onGlobalPointerMove.bind(this);
    this.boundOnPointerUp = this.onGlobalPointerUp.bind(this);

    this.visible = false;
  }

  public setSelectedNodes(nodes: SceneNode[]): void {
    if (this.isDragging) return;
    this.selectedNodes = nodes.filter((n) => n && !n.container.destroyed);
    this.update();
  }

  public update(): void {
    if (this.selectedNodes.length === 0) {
      this.visible = false;
      this.outlineGraphics.clear();
      this.moveHitArea.clear();
      for (const h of this.handles.values()) h.graphics.clear();
      return;
    }

    this.visible = true;

    // Compute collective screen bounds of all selected nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.selectedNodes) {
      if (node.container.destroyed) continue;
      const b = node.container.getBounds();
      const bx = Number.isFinite(b.x) ? b.x : (Number.isFinite(b.minX) ? b.minX : 0);
      const by = Number.isFinite(b.y) ? b.y : (Number.isFinite(b.minY) ? b.minY : 0);
      const bw = Number.isFinite(b.width) ? b.width : (Number.isFinite(b.maxX) ? b.maxX - b.minX : 0);
      const bh = Number.isFinite(b.height) ? b.height : (Number.isFinite(b.maxY) ? b.maxY - b.minY : 0);

      minX = Math.min(minX, bx);
      minY = Math.min(minY, by);
      maxX = Math.max(maxX, bx + bw);
      maxY = Math.max(maxY, by + bh);
    }

    if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
      this.outlineGraphics.clear();
      this.moveHitArea.clear();
      for (const h of this.handles.values()) h.graphics.clear();
      return;
    }

    const bx = minX;
    const by = minY;
    const bw = maxX - minX;
    const bh = maxY - minY;

    // 1. Move Hit Area: interior of bounding box
    this.moveHitArea.clear();
    this.moveHitArea.rect(bx, by, bw, bh).fill({ color: 0x000000, alpha: 0.001 });

    // 2. Dashed Bounding Box Outline
    this.outlineGraphics.clear();
    const dash = 6;
    const gap = 4;
    this.drawDashed(bx, by, bx + bw, by, dash, gap);
    this.drawDashed(bx, by + bh, bx + bw, by + bh, dash, gap);
    this.drawDashed(bx, by, bx, by + bh, dash, gap);
    this.drawDashed(bx + bw, by, bx + bw, by + bh, dash, gap);

    // 3. Center pivot crosshair
    const centerX = bx + bw / 2;
    const centerY = by + bh / 2;
    this.outlineGraphics
      .circle(centerX, centerY, 3.5)
      .fill({ color: 0x00e5ff, alpha: 0.6 })
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    this.outlineGraphics
      .moveTo(centerX - 6, centerY)
      .lineTo(centerX + 6, centerY)
      .stroke({ width: 1, color: 0x00e5ff, alpha: 0.8 });
    this.outlineGraphics
      .moveTo(centerX, centerY - 6)
      .lineTo(centerX, centerY + 6)
      .stroke({ width: 1, color: 0x00e5ff, alpha: 0.8 });

    // 4. Update 8 Handles positions and graphics
    const handlePositions: Record<GizmoHandleType, { x: number; y: number }> = {
      nw: { x: bx, y: by },
      n: { x: centerX, y: by },
      ne: { x: bx + bw, y: by },
      e: { x: bx + bw, y: centerY },
      se: { x: bx + bw, y: by + bh },
      s: { x: centerX, y: by + bh },
      sw: { x: bx, y: by + bh },
      w: { x: bx, y: centerY },
    };

    const handleSize = 7;
    const half = handleSize / 2;

    for (const [type, info] of this.handles.entries()) {
      const pos = handlePositions[type];
      info.graphics.position.set(pos.x, pos.y);
      info.graphics.clear();
      info.graphics
        .rect(-half, -half, handleSize, handleSize)
        .fill({ color: 0xffffff, alpha: 0.95 })
        .stroke({ width: 1.5, color: 0x00e5ff, alpha: 1 });
    }
  }

  private drawDashed(x1: number, y1: number, x2: number, y2: number, dash: number, gap: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    let current = 0;
    while (current < dist) {
      const startX = x1 + nx * current;
      const startY = y1 + ny * current;
      const segLen = Math.min(dash, dist - current);
      this.outlineGraphics
        .moveTo(startX, startY)
        .lineTo(startX + nx * segLen, startY + ny * segLen)
        .stroke({ width: 1.5, color: 0x00e5ff, alpha: 0.85 });
      current += dash + gap;
    }
  }

  // --------------------------------------------------------------------------
  // Drag Operations: Translate & Scale
  // --------------------------------------------------------------------------

  private onMoveStart(e: { stopPropagation: () => void; clientX?: number; clientY?: number }): void {
    e.stopPropagation();
    if (this.selectedNodes.length === 0) return;

    this.isDragging = true;
    this.dragMode = 'translate';
    this.activeHandle = null;

    const mouseEvent = e as unknown as MouseEvent;
    this.startScreenPos = {
      x: mouseEvent.clientX ?? 0,
      y: mouseEvent.clientY ?? 0,
    };

    this.captureInitialState();
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
  }

  private onScaleStart(type: GizmoHandleType, e: { stopPropagation: () => void; clientX?: number; clientY?: number }): void {
    e.stopPropagation();
    if (this.selectedNodes.length === 0) return;

    this.isDragging = true;
    this.dragMode = 'scale';
    this.activeHandle = type;

    const mouseEvent = e as unknown as MouseEvent;
    this.startScreenPos = {
      x: mouseEvent.clientX ?? 0,
      y: mouseEvent.clientY ?? 0,
    };

    this.captureInitialState();
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
  }

  private captureInitialState(): void {
    this.initialStates.clear();
    const scale = this.sceneContainer.scale.x || 1;
    const offsetX = this.sceneContainer.x || 0;
    const offsetY = this.sceneContainer.y || 0;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of this.selectedNodes) {
      if (node.container.destroyed) continue;
      this.initialStates.set(node.uid, {
        node,
        x: node.container.x,
        y: node.container.y,
        scaleX: node.container.scale.x,
        scaleY: node.container.scale.y,
      });

      const b = node.container.getBounds();
      minX = Math.min(minX, (b.x - offsetX) / scale);
      minY = Math.min(minY, (b.y - offsetY) / scale);
      maxX = Math.max(maxX, (b.x + b.width - offsetX) / scale);
      maxY = Math.max(maxY, (b.y + b.height - offsetY) / scale);
    }

    this.startBBox = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  private onGlobalPointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;

    const scale = this.sceneContainer.scale.x || 1;
    const deltaScreenX = e.clientX - this.startScreenPos.x;
    const deltaScreenY = e.clientY - this.startScreenPos.y;
    const deltaStageX = deltaScreenX / scale;
    const deltaStageY = deltaScreenY / scale;

    if (this.dragMode === 'translate') {
      for (const state of this.initialStates.values()) {
        state.node.container.x = Math.round(state.x + deltaStageX);
        state.node.container.y = Math.round(state.y + deltaStageY);
      }
    } else if (this.dragMode === 'scale' && this.activeHandle) {
      const bbox = this.startBBox;
      let ratioX = 1;
      let ratioY = 1;
      let anchorX = bbox.x;
      let anchorY = bbox.y;

      switch (this.activeHandle) {
        case 'se': {
          anchorX = bbox.x;
          anchorY = bbox.y;
          const newW = Math.max(10, bbox.width + deltaStageX);
          const newH = Math.max(10, bbox.height + deltaStageY);
          ratioX = newW / bbox.width;
          ratioY = newH / bbox.height;
          break;
        }
        case 'nw': {
          anchorX = bbox.x + bbox.width;
          anchorY = bbox.y + bbox.height;
          const newW = Math.max(10, bbox.width - deltaStageX);
          const newH = Math.max(10, bbox.height - deltaStageY);
          ratioX = newW / bbox.width;
          ratioY = newH / bbox.height;
          break;
        }
        case 'ne': {
          anchorX = bbox.x;
          anchorY = bbox.y + bbox.height;
          const newW = Math.max(10, bbox.width + deltaStageX);
          const newH = Math.max(10, bbox.height - deltaStageY);
          ratioX = newW / bbox.width;
          ratioY = newH / bbox.height;
          break;
        }
        case 'sw': {
          anchorX = bbox.x + bbox.width;
          anchorY = bbox.y;
          const newW = Math.max(10, bbox.width - deltaStageX);
          const newH = Math.max(10, bbox.height + deltaStageY);
          ratioX = newW / bbox.width;
          ratioY = newH / bbox.height;
          break;
        }
        case 'e': {
          anchorX = bbox.x;
          const newW = Math.max(10, bbox.width + deltaStageX);
          ratioX = newW / bbox.width;
          break;
        }
        case 'w': {
          anchorX = bbox.x + bbox.width;
          const newW = Math.max(10, bbox.width - deltaStageX);
          ratioX = newW / bbox.width;
          break;
        }
        case 's': {
          anchorY = bbox.y;
          const newH = Math.max(10, bbox.height + deltaStageY);
          ratioY = newH / bbox.height;
          break;
        }
        case 'n': {
          anchorY = bbox.y + bbox.height;
          const newH = Math.max(10, bbox.height - deltaStageY);
          ratioY = newH / bbox.height;
          break;
        }
      }

      if (this.selectedNodes.length === 1) {
        const state = Array.from(this.initialStates.values())[0];
        if (state) {
          state.node.container.scale.x = Math.max(0.02, state.scaleX * ratioX);
          state.node.container.scale.y = Math.max(0.02, state.scaleY * ratioY);
        }
      } else {
        // Multi-selection: scale positions and scales proportionally relative to anchor
        for (const state of this.initialStates.values()) {
          const relX = state.x - anchorX;
          const relY = state.y - anchorY;
          state.node.container.x = Math.round(anchorX + relX * ratioX);
          state.node.container.y = Math.round(anchorY + relY * ratioY);
          state.node.container.scale.x = Math.max(0.02, state.scaleX * ratioX);
          state.node.container.scale.y = Math.max(0.02, state.scaleY * ratioY);
        }
      }
    }

    this.update();
    this.onChange?.();
  }

  private onGlobalPointerUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.dragMode = 'none';
    this.activeHandle = null;

    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);

    // Commit changes to LevelData
    const updated: SceneNodeData[] = [];
    for (const state of this.initialStates.values()) {
      const node = state.node;
      updated.push({
        ...node.data,
        transform: {
          ...node.data.transform,
          x: Math.round(node.container.x),
          y: Math.round(node.container.y),
          scaleX: Number(node.container.scale.x.toFixed(3)),
          scaleY: Number(node.container.scale.y.toFixed(3)),
        },
      });
    }

    this.initialStates.clear();
    this.update();
    if (updated.length > 0) {
      this.onCommit?.(updated);
    }
  }

  public destroy(): void {
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    super.destroy({ children: true });
  }
}
