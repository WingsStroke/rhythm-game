import { Container } from 'pixi.js';
import { SceneNode } from './objects/SceneNode';
import type { LevelData, SceneNodeData } from '../types';

/**
 * SceneGraph manages the hierarchy of visual nodes.
 */
export class SceneGraph {
  public root: Container;
  public onNodeSelect?: (nodeId: string) => void;
  private nodes: Map<string, SceneNode> = new Map();

  constructor(container: Container) {
    this.root = container;
  }

  /**
   * Initializes the scene graph from LevelData.
   */
  public buildFromData(levelData: LevelData) {
    // Clear existing nodes
    this.dispose();

    const nodesData = levelData.visual?.nodes || [];

    // 1. Create all nodes first
    for (const nodeData of nodesData) {
      const node = new SceneNode(nodeData);
      node.container.on('pointerdown', (e) => {
        e.stopPropagation();
        this.onNodeSelect?.(node.id);
      });
      this.nodes.set(node.id, node);
    }

    // 2. Build hierarchy
    for (const nodeData of nodesData) {
      const key =
        nodeData.uid ||
        (typeof nodeData.id === 'string' ? nodeData.id : nodeData.name || '');
      const node = this.getNode(key);
      if (node) {
        if (nodeData.parentId) {
          const parent = this.getNode(nodeData.parentId);
          if (parent) {
            parent.container.addChild(node.container);
          } else {
            console.warn(`Parent node ${nodeData.parentId} not found for node ${key}`);
            this.root.addChild(node.container);
          }
        } else {
          this.root.addChild(node.container);
        }
      }
    }
  }

  public getNode(id: string): SceneNode | undefined {
    if (this.nodes.has(id)) return this.nodes.get(id);
    for (const node of this.nodes.values()) {
      if (node.uid === id || node.name === id || (node.targetId !== null && String(node.targetId) === id)) {
        return node;
      }
    }
    return undefined;
  }

  public getNodesByTargetId(targetId: number | string): SceneNode[] {
    const num = typeof targetId === 'number' ? targetId : Number(targetId);
    const isNum = !Number.isNaN(num);
    const result: SceneNode[] = [];
    for (const node of this.nodes.values()) {
      if (isNum && node.targetId !== null && node.targetId === num) {
        result.push(node);
      } else if (node.targetId !== null && String(node.targetId) === String(targetId)) {
        result.push(node);
      }
    }
    return result;
  }

  public getNodesByGroup(group: string | number): SceneNode[] {
    const result: SceneNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.data.group === group) {
        result.push(node);
      }
    }
    return result;
  }

  public getAllNodes(): SceneNode[] {
    return Array.from(this.nodes.values());
  }

  public addNode(nodeData: SceneNodeData) {
    const node = new SceneNode(nodeData);
    node.container.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onNodeSelect?.(node.id);
    });
    this.nodes.set(node.id, node);
    
    if (nodeData.parentId) {
      const parent = this.nodes.get(nodeData.parentId);
      if (parent) {
        parent.container.addChild(node.container);
      } else {
        this.root.addChild(node.container);
      }
    } else {
      this.root.addChild(node.container);
    }
  }

  public removeNode(id: string) {
    const node = this.nodes.get(id);
    if (node) {
      node.destroy();
      this.nodes.delete(id);
    }
  }

  public setParent(id: string, parentId?: string) {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove from current parent
    if (node.container.parent) {
      node.container.parent.removeChild(node.container);
    }

    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.container.addChild(node.container);
        node.data.parentId = parentId;
      } else {
        this.root.addChild(node.container);
        node.data.parentId = undefined;
      }
    } else {
      this.root.addChild(node.container);
      node.data.parentId = undefined;
    }
  }

  public dispose() {
    for (const node of this.nodes.values()) {
      node.destroy();
    }
    this.nodes.clear();
  }
}
