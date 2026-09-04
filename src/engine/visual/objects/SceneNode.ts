import { Container, Graphics, Sprite, Texture, Color } from 'pixi.js';
import type { SceneNodeData } from '../../types';

/**
 * SceneNode wraps a PixiJS Container or display object.
 * It provides a unified way to apply data-driven properties.
 */
export class SceneNode {
  public id: string;
  public data: SceneNodeData;
  public container: Container;
  public displayObject?: Container;

  constructor(data: SceneNodeData) {
    this.id = data.id;
    this.data = data;
    this.container = new Container();

    if (data.type !== 'group') {
      this.displayObject = this.createDisplayObject(data);
      if (this.displayObject) {
        this.container.addChild(this.displayObject);
      }
    }

    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.applyProperties(data);
  }

  public updateData(newData: SceneNodeData) {
    this.data = newData;
    
    // Recreate visual representation
    if (this.displayObject) {
      this.displayObject.destroy();
      this.container.removeChild(this.displayObject);
    }
    
    if (newData.type !== 'group') {
      this.displayObject = this.createDisplayObject(newData);
      if (this.displayObject) {
        this.container.addChild(this.displayObject);
      }
    }
    
    this.applyProperties(newData);
  }

  /**
   * Applies properties from SceneNodeData
   */
  applyProperties(data: SceneNodeData) {
    const transform = data.transform || {};
    if (transform.x !== undefined) this.container.x = transform.x;
    if (transform.y !== undefined) this.container.y = transform.y;
    if (transform.scaleX !== undefined) this.container.scale.x = transform.scaleX;
    if (transform.scaleY !== undefined) this.container.scale.y = transform.scaleY;
    if (transform.rotation !== undefined) this.container.rotation = transform.rotation;
    if (transform.opacity !== undefined) this.container.alpha = transform.opacity;
    
    // In the future, we can also apply visual properties (color, etc.) here
  }

  private createDisplayObject(data: SceneNodeData): Container {
    const props = data.properties || {};
    
    switch (data.type) {
      case 'rectangle': {
        const g = new Graphics();
        const color = props.color ? new Color(props.color as string).toNumber() : 0xffffff;
        const width = (props.width as number) || 100;
        const height = (props.height as number) || 100;
        g.rect(0, 0, width, height);
        g.fill({ color });
        // Center pivot conceptually if needed, or leave top-left.
        // For rhythm games, centering is often easier.
        g.pivot.set(width / 2, height / 2);
        return g;
      }
      case 'circle': {
        const g = new Graphics();
        const color = props.color ? new Color(props.color as string).toNumber() : 0xffffff;
        const radius = (props.radius as number) || 50;
        g.circle(0, 0, radius);
        g.fill({ color });
        return g;
      }
      case 'sprite': {
        // Fallback to empty texture if none provided.
        // In a real scenario, you'd load this from an asset manager.
        const s = new Sprite(Texture.WHITE); 
        if (props.width) s.width = props.width as number;
        if (props.height) s.height = props.height as number;
        s.anchor.set(0.5);
        if (props.color) s.tint = new Color(props.color as string).toNumber();
        return s;
      }
      default:
        return new Container(); // Fallback empty
    }
  }

  destroy() {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}
