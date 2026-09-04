import { Container, Graphics, Sprite, Texture, Color } from 'pixi.js';
import type { VisualObjectData, SceneGroupData } from '../../types';

/**
 * SceneNode wraps a PixiJS Container or display object.
 * It provides a unified way to apply data-driven properties.
 */
export class SceneNode {
  public id: string;
  public container: Container;

  constructor(id: string) {
    this.id = id;
    this.container = new Container();
  }

  /**
   * Applies properties from either a VisualObjectData or SceneGroupData
   */
  applyProperties(properties: any) {
    if (properties.x !== undefined) this.container.x = properties.x;
    if (properties.y !== undefined) this.container.y = properties.y;
    if (properties.scaleX !== undefined) this.container.scale.x = properties.scaleX;
    if (properties.scaleY !== undefined) this.container.scale.y = properties.scaleY;
    if (properties.rotation !== undefined) this.container.rotation = properties.rotation;
    if (properties.alpha !== undefined) this.container.alpha = properties.alpha;
  }

  destroy() {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

/**
 * Creates a specific PixiJS display object based on data, and attaches it to the node.
 */
export class VisualObjectNode extends SceneNode {
  public displayObject: Container;

  constructor(data: VisualObjectData) {
    super(data.id);
    this.displayObject = this.createDisplayObject(data);
    this.container.addChild(this.displayObject);
    this.applyProperties(data.properties);
  }

  private createDisplayObject(data: VisualObjectData): Container {
    const props = data.properties;
    
    switch (data.type) {
      case 'rectangle': {
        const g = new Graphics();
        const color = props.color ? new Color(props.color).toNumber() : 0xffffff;
        g.rect(0, 0, props.width || 100, props.height || 100);
        g.fill({ color });
        // Center pivot conceptually if needed, or leave top-left.
        // For rhythm games, centering is often easier.
        g.pivot.set((props.width || 100) / 2, (props.height || 100) / 2);
        return g;
      }
      case 'circle': {
        const g = new Graphics();
        const color = props.color ? new Color(props.color).toNumber() : 0xffffff;
        g.circle(0, 0, props.radius || 50);
        g.fill({ color });
        return g;
      }
      case 'sprite': {
        // Fallback to empty texture if none provided.
        // In a real scenario, you'd load this from an asset manager.
        const s = new Sprite(Texture.WHITE); 
        if (props.width) s.width = props.width;
        if (props.height) s.height = props.height;
        s.anchor.set(0.5);
        if (props.color) s.tint = new Color(props.color).toNumber();
        return s;
      }
      default:
        return new Container(); // Fallback empty
    }
  }
}

export class SceneGroupNode extends SceneNode {
  constructor(data: SceneGroupData) {
    super(data.id);
    this.applyProperties(data.properties);
  }
}
