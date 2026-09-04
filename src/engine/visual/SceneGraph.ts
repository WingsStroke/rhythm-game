import { Container } from 'pixi.js';
import { SceneNode, VisualObjectNode, SceneGroupNode } from './objects/SceneNode';
import type { LevelData } from '../types';

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

    const { objects = [], groups = [] } = levelData;

    // 1. Create all groups first
    for (const groupData of groups) {
      const node = new SceneGroupNode(groupData);
      this.nodes.set(node.id, node);
    }

    // 2. Build group hierarchy
    for (const groupData of groups) {
      const node = this.nodes.get(groupData.id);
      if (node) {
        if (groupData.parentId) {
          const parent = this.nodes.get(groupData.parentId);
          if (parent) {
            parent.container.addChild(node.container);
          } else {
            console.warn(`Parent group ${groupData.parentId} not found for group ${groupData.id}`);
            this.root.addChild(node.container);
          }
        } else {
          this.root.addChild(node.container);
        }
      }
    }

    // 3. Create all objects and attach to groups or root
    for (const objData of objects) {
      const node = new VisualObjectNode(objData);
      this.nodes.set(node.id, node);

      if (objData.groupId) {
        const parent = this.nodes.get(objData.groupId);
        if (parent) {
          parent.container.addChild(node.container);
        } else {
          console.warn(`Parent group ${objData.groupId} not found for object ${objData.id}`);
          this.root.addChild(node.container);
        }
      } else {
        this.root.addChild(node.container);
      }
    }
  }

  public getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  public dispose() {
    for (const node of this.nodes.values()) {
      node.destroy();
    }
    this.nodes.clear();
  }
}
