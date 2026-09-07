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
  rotation: number;
  localBounds: { x: number; y: number; width: number; height: number };
  initW: number;
  initH: number;
  currentW: number;
  currentH: number;
}

/**
 * TransformGizmo provides an interactive move and resize/scale widget directly inside
 * the PixiJS Live Preview viewport.
 * Supports Oriented Bounding Box (OBB) for single rotated objects, and collective
 * Axis-Aligned Bounding Box (AABB) for multi-object selections.
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
  private boundOnPointerUp: () => void;

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
    this.boundOnPointerUp = () => this.onGlobalPointerUp();

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

    // A. Single Selection: Oriented Bounding Box (OBB) following node rotation
    if (this.selectedNodes.length === 1) {
      const node = this.selectedNodes[0];
      if (node.container.destroyed) {
        this.outlineGraphics.clear();
        this.moveHitArea.clear();
        for (const h of this.handles.values()) h.graphics.clear();
        return;
      }

      const lb = node.container.getLocalBounds();
      const lx = Number.isFinite(lb.x) ? lb.x : (Number.isFinite(lb.minX) ? lb.minX : 0);
      const ly = Number.isFinite(lb.y) ? lb.y : (Number.isFinite(lb.minY) ? lb.minY : 0);
      const lw = Math.max(1, Number.isFinite(lb.width) ? lb.width : (Number.isFinite(lb.maxX) ? lb.maxX - lb.minX : 10));
      const lh = Math.max(1, Number.isFinite(lb.height) ? lb.height : (Number.isFinite(lb.maxY) ? lb.maxY - lb.minY : 10));

      const pNW = node.container.toGlobal({ x: lx, y: ly });
      const pNE = node.container.toGlobal({ x: lx + lw, y: ly });
      const pSE = node.container.toGlobal({ x: lx + lw, y: ly + lh });
      const pSW = node.container.toGlobal({ x: lx, y: ly + lh });

      const pN = node.container.toGlobal({ x: lx + lw / 2, y: ly });
      const pE = node.container.toGlobal({ x: lx + lw, y: ly + lh / 2 });
      const pS = node.container.toGlobal({ x: lx + lw / 2, y: ly + lh });
      const pW = node.container.toGlobal({ x: lx, y: ly + lh / 2 });

      const pCenter = node.container.toGlobal({ x: lx + lw / 2, y: ly + lh / 2 });

      // 1. Move Hit Area: oriented polygon
      this.moveHitArea.clear();
      this.moveHitArea.poly([pNW.x, pNW.y, pNE.x, pNE.y, pSE.x, pSE.y, pSW.x, pSW.y]).fill({ color: 0x000000, alpha: 0.001 });

      // 2. Dashed Oriented Bounding Box
      this.outlineGraphics.clear();
      const dash = 6;
      const gap = 4;
      this.drawDashed(pNW.x, pNW.y, pNE.x, pNE.y, dash, gap);
      this.drawDashed(pNE.x, pNE.y, pSE.x, pSE.y, dash, gap);
      this.drawDashed(pSE.x, pSE.y, pSW.x, pSW.y, dash, gap);
      this.drawDashed(pSW.x, pSW.y, pNW.x, pNW.y, dash, gap);

      // 3. Center pivot crosshair
      this.outlineGraphics
        .circle(pCenter.x, pCenter.y, 3.5)
        .fill({ color: 0x00e5ff, alpha: 0.6 })
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
      this.outlineGraphics
        .moveTo(pCenter.x - 6, pCenter.y)
        .lineTo(pCenter.x + 6, pCenter.y)
        .stroke({ width: 1, color: 0x00e5ff, alpha: 0.8 });
      this.outlineGraphics
        .moveTo(pCenter.x, pCenter.y - 6)
        .lineTo(pCenter.x, pCenter.y + 6)
        .stroke({ width: 1, color: 0x00e5ff, alpha: 0.8 });

      // 4. Update 8 Handles positions
      const handlePositions: Record<GizmoHandleType, { x: number; y: number }> = {
        nw: pNW,
        n: pN,
        ne: pNE,
        e: pE,
        se: pSE,
        s: pS,
        sw: pSW,
        w: pW,
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
      return;
    }

    // B. Multi-selection: collective Axis-Aligned Bounding Box (AABB)
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
    window.addEventListener('pointercancel', this.boundOnPointerUp);
    window.addEventListener('blur', this.boundOnPointerUp);
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
    window.addEventListener('pointercancel', this.boundOnPointerUp);
    window.addEventListener('blur', this.boundOnPointerUp);
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

      const lb = node.container.getLocalBounds();
      const lx = Number.isFinite(lb.x) ? lb.x : (Number.isFinite(lb.minX) ? lb.minX : 0);
      const ly = Number.isFinite(lb.y) ? lb.y : (Number.isFinite(lb.minY) ? lb.minY : 0);
      const lw = Math.max(1, Number.isFinite(lb.width) ? lb.width : (Number.isFinite(lb.maxX) ? lb.maxX - lb.minX : 10));
      const lh = Math.max(1, Number.isFinite(lb.height) ? lb.height : (Number.isFinite(lb.maxY) ? lb.maxY - lb.minY : 10));

      const props = (node.data.properties || {}) as Record<string, unknown>;
      let initW = typeof props.width === 'number' ? props.width : 0;
      let initH = typeof props.height === 'number' ? props.height : 0;

      if (!initW && typeof props.radius === 'number') {
        initW = props.radius * 2;
        initH = props.radius * 2;
      }
      if (!initW && typeof props.outerRadius === 'number') {
        initW = props.outerRadius * 2;
        initH = props.outerRadius * 2;
      }
      if (!initW && typeof props.length === 'number') {
        initW = props.length;
        initH = typeof props.width === 'number' ? props.width : props.length;
      }

      if (!initW || initW <= 0) {
        initW = Math.max(10, Math.round(lw));
      }
      if (!initH || initH <= 0) {
        initH = Math.max(10, Math.round(lh));
      }

      this.initialStates.set(node.uid, {
        node,
        x: node.container.x,
        y: node.container.y,
        scaleX: node.container.scale.x,
        scaleY: node.container.scale.y,
        rotation: node.container.rotation,
        localBounds: { x: lx, y: ly, width: lw, height: lh },
        initW,
        initH,
        currentW: initW,
        currentH: initH,
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
      if (this.selectedNodes.length === 1) {
        // Single rotated/oriented node scale
        const state = Array.from(this.initialStates.values())[0];
        if (state) {
          const angle = state.rotation || 0;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          // Project deltaStage into node's local coordinate frame
          const localDeltaX = deltaStageX * cos + deltaStageY * sin;
          const localDeltaY = -deltaStageX * sin + deltaStageY * cos;

          let newW = state.initW;
          let newH = state.initH;

          switch (this.activeHandle) {
            case 'e':
              newW = Math.max(10, Math.round(state.initW + localDeltaX * 2));
              break;
            case 'w':
              newW = Math.max(10, Math.round(state.initW - localDeltaX * 2));
              break;
            case 's':
              newH = Math.max(10, Math.round(state.initH + localDeltaY * 2));
              break;
            case 'n':
              newH = Math.max(10, Math.round(state.initH - localDeltaY * 2));
              break;
            case 'se':
              newW = Math.max(10, Math.round(state.initW + localDeltaX * 2));
              newH = Math.max(10, Math.round(state.initH + localDeltaY * 2));
              break;
            case 'sw':
              newW = Math.max(10, Math.round(state.initW - localDeltaX * 2));
              newH = Math.max(10, Math.round(state.initH + localDeltaY * 2));
              break;
            case 'ne':
              newW = Math.max(10, Math.round(state.initW + localDeltaX * 2));
              newH = Math.max(10, Math.round(state.initH - localDeltaY * 2));
              break;
            case 'nw':
              newW = Math.max(10, Math.round(state.initW - localDeltaX * 2));
              newH = Math.max(10, Math.round(state.initH - localDeltaY * 2));
              break;
          }

          state.currentW = newW;
          state.currentH = newH;

          // CRITICAL: Position (x, y) NEVER changes during resize!
          state.node.container.x = state.x;
          state.node.container.y = state.y;

          // Live visual scaling for immediate feedback
          state.node.container.scale.x = Math.max(0.02, state.scaleX * (newW / state.initW));
          state.node.container.scale.y = Math.max(0.02, state.scaleY * (newH / state.initH));
        }
      } else {
        // Multi-selection: collective AABB scaling
        const bbox = this.startBBox;
        let ratioX = 1;
        let ratioY = 1;

        switch (this.activeHandle) {
          case 'se': {
            const newW = Math.max(10, bbox.width + deltaStageX * 2);
            const newH = Math.max(10, bbox.height + deltaStageY * 2);
            ratioX = newW / bbox.width;
            ratioY = newH / bbox.height;
            break;
          }
          case 'nw': {
            const newW = Math.max(10, bbox.width - deltaStageX * 2);
            const newH = Math.max(10, bbox.height - deltaStageY * 2);
            ratioX = newW / bbox.width;
            ratioY = newH / bbox.height;
            break;
          }
          case 'ne': {
            const newW = Math.max(10, bbox.width + deltaStageX * 2);
            const newH = Math.max(10, bbox.height - deltaStageY * 2);
            ratioX = newW / bbox.width;
            ratioY = newH / bbox.height;
            break;
          }
          case 'sw': {
            const newW = Math.max(10, bbox.width - deltaStageX * 2);
            const newH = Math.max(10, bbox.height + deltaStageY * 2);
            ratioX = newW / bbox.width;
            ratioY = newH / bbox.height;
            break;
          }
          case 'e': {
            const newW = Math.max(10, bbox.width + deltaStageX * 2);
            ratioX = newW / bbox.width;
            break;
          }
          case 'w': {
            const newW = Math.max(10, bbox.width - deltaStageX * 2);
            ratioX = newW / bbox.width;
            break;
          }
          case 's': {
            const newH = Math.max(10, bbox.height + deltaStageY * 2);
            ratioY = newH / bbox.height;
            break;
          }
          case 'n': {
            const newH = Math.max(10, bbox.height - deltaStageY * 2);
            ratioY = newH / bbox.height;
            break;
          }
        }

        for (const state of this.initialStates.values()) {
          const newW = Math.max(10, Math.round(state.initW * ratioX));
          const newH = Math.max(10, Math.round(state.initH * ratioY));
          state.currentW = newW;
          state.currentH = newH;

          // Keep individual node positions invariant
          state.node.container.x = state.x;
          state.node.container.y = state.y;
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

    const dragMode = this.dragMode;
    this.isDragging = false;
    this.dragMode = 'none';
    this.activeHandle = null;

    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerUp);
    window.removeEventListener('blur', this.boundOnPointerUp);

    // Commit changes to LevelData
    const updated: SceneNodeData[] = [];
    for (const state of this.initialStates.values()) {
      const node = state.node;
      const props = { ...(node.data.properties || {}) };

      if (dragMode === 'translate') {
        const updatedNode: SceneNodeData = {
          ...node.data,
          transform: {
            ...node.data.transform,
            x: Math.round(node.container.x),
            y: Math.round(node.container.y),
          },
        };
        node.updateData(updatedNode);
        updated.push(updatedNode);
      } else if (dragMode === 'scale') {
        const newW = state.currentW ?? state.initW;
        const newH = state.currentH ?? state.initH;

        props.width = newW;
        props.height = newH;

        if (node.data.type === 'circle' || node.data.type === 'hexagon' || node.data.type === 'pointLight') {
          props.radius = Math.round(newW / 2);
        } else if (node.data.type === 'star') {
          const oldOuter = (props.outerRadius as number) || 60;
          const oldInner = (props.innerRadius as number) || 28;
          const ratio = oldOuter > 0 ? oldInner / oldOuter : 0.45;
          props.outerRadius = Math.round(newW / 2);
          props.innerRadius = Math.round((newW / 2) * ratio);
        } else if (node.data.type === 'beamLight') {
          props.length = newW;
          props.width = newH;
        }

        // Reset container scale back to unit (1, 1) and guarantee invariant position
        node.container.scale.set(1, 1);
        node.container.x = state.x;
        node.container.y = state.y;

        const updatedNode: SceneNodeData = {
          ...node.data,
          properties: props,
          transform: {
            ...node.data.transform,
            x: state.x,
            y: state.y,
            scaleX: 1,
            scaleY: 1,
          },
        };
        node.updateData(updatedNode);
        updated.push(updatedNode);
      }
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
    window.removeEventListener('pointercancel', this.boundOnPointerUp);
    window.removeEventListener('blur', this.boundOnPointerUp);
    super.destroy({ children: true });
  }
}
