import { Container } from 'pixi.js';
import { SceneNode } from './objects/SceneNode';
import type { LevelData, SceneNodeData } from '../types';

/**
 * SceneGraph manages the hierarchy of visual nodes.
 */
export class SceneGraph {
  public root: Container;
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
      this.nodes.set(node.id, node);
    }

    // 2. Build hierarchy
    for (const nodeData of nodesData) {
      const node = this.nodes.get(nodeData.id);
      if (node) {
        if (nodeData.parentId) {
          const parent = this.nodes.get(nodeData.parentId);
          if (parent) {
            parent.container.addChild(node.container);
          } else {
            console.warn(`Parent node ${nodeData.parentId} not found for node ${nodeData.id}`);
            this.root.addChild(node.container);
          }
        } else {
          this.root.addChild(node.container);
        }
      }
    }
  }

  public getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  public addNode(nodeData: SceneNodeData) {
    const node = new SceneNode(nodeData);
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
