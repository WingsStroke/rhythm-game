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

    // 1. Create all nodes first, indexed strictly by immutable uid
    for (const nodeData of nodesData) {
      const node = new SceneNode(nodeData);
      node.container.on('pointerdown', (e) => {
        e.stopPropagation();
        this.onNodeSelect?.(node.uid);
      });
      this.nodes.set(node.uid, node);
    }

    // 2. Build hierarchy
    for (const nodeData of nodesData) {
      const node = this.getNode(nodeData.uid);
      if (node) {
        if (nodeData.parentId) {
          const parent = this.getNode(nodeData.parentId);
          if (parent) {
            parent.container.addChild(node.container);
          } else {
            console.warn(`Parent node ${nodeData.parentId} not found for node ${node.uid}`);
            this.root.addChild(node.container);
          }
        } else {
          this.root.addChild(node.container);
        }
      }
    }
  }

  public getNode(key: string): SceneNode | undefined {
    // 1. Direct O(1) lookup by internal uid
    if (this.nodes.has(key)) return this.nodes.get(key);
    // 2. Fallback lookup by human-readable name
    for (const node of this.nodes.values()) {
      if (node.uid === key || node.name === key) {
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
      if (node.targetId !== null && isNum && node.targetId === num) {
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
      this.onNodeSelect?.(node.uid);
    });
    this.nodes.set(node.uid, node);
    
    if (nodeData.parentId) {
      const parent = this.getNode(nodeData.parentId);
      if (parent) {
        parent.container.addChild(node.container);
      } else {
        this.root.addChild(node.container);
      }
    } else {
      this.root.addChild(node.container);
    }
  }

  public removeNode(idOrUid: string) {
    const node = this.getNode(idOrUid);
    if (node) {
      node.destroy();
      this.nodes.delete(node.uid);
    }
  }

  public setParent(childKey: string, parentKey?: string) {
    const node = this.getNode(childKey);
    if (!node) return;

    // Remove from current parent
    if (node.container.parent) {
      node.container.parent.removeChild(node.container);
    }

    if (parentKey) {
      const parent = this.getNode(parentKey);
      if (parent) {
        parent.container.addChild(node.container);
        node.data.parentId = parent.uid;
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
