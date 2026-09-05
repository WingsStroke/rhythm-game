import { Container, Graphics, Sprite, Texture, Color } from 'pixi.js';
import type { SceneNodeData, ModulatableProperty } from '../../types';

/**
 * Safely parses any color representation (hex string, rgb, named color, or number)
 * into a PixiJS numeric color without ever throwing an exception.
 */
export function safeParseColor(input: unknown, defaultColor = 0xffffff): number {
  if (input === null || input === undefined || input === '') {
    return defaultColor;
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  try {
    const str = String(input).trim();
    const formatted = /^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{3}$/.test(str) ? `#${str}` : str;
    return new Color(formatted).toNumber();
  } catch {
    return defaultColor;
  }
}

/**
 * SceneNode wraps a PixiJS Container or display object.
 * It provides a unified way to apply data-driven properties.
 */
export class SceneNode {
  public readonly uid: string;
  public name: string;
  public targetId: number | null;
  /** Alias for uid ensuring full backward compatibility with callers referencing node.id */
  public id: string;
  public data: SceneNodeData;
  public container: Container;
  public displayObject?: Container;

  constructor(data: SceneNodeData) {
    const uniqueKey =
      data.uid ||
      (typeof data.id === 'string' ? data.id : undefined) ||
      data.name ||
      `node_${Date.now().toString(36)}_${Math.floor(1000 + Math.random() * 9000)}`;
    this.uid = uniqueKey;
    this.id = uniqueKey;
    this.name = data.name || (typeof data.id === 'string' ? data.id : 'node-1');
    this.targetId =
      data.targetId !== undefined
        ? data.targetId
        : typeof data.id === 'number'
          ? data.id
          : null;
    this.data = { ...data, uid: this.uid, name: this.name, targetId: this.targetId, id: this.targetId };
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
    this.name = newData.name || this.name;
    this.targetId =
      newData.targetId !== undefined
        ? newData.targetId
        : typeof newData.id === 'number'
          ? newData.id
          : null;
    this.data = { ...newData, uid: this.uid, name: this.name, targetId: this.targetId, id: this.targetId };
    
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
    if (transform.pivotX !== undefined) this.container.pivot.x = transform.pivotX;
    if (transform.pivotY !== undefined) this.container.pivot.y = transform.pivotY;
    if (data.visible !== undefined) this.container.visible = data.visible;
    if (data.blendMode) {
      // PixiJS v8 Container supports blendMode at runtime but the generic
      // Container type does not declare it; cast through unknown to avoid 'any'.
      (this.container as unknown as { blendMode: string }).blendMode = data.blendMode;
    }
  }

  /**
   * Applies real-time audio modulation delta to a specific property.
   */
  public setModulatedTransform(property: ModulatableProperty, delta: number, baseValue?: number): void {
    const base = baseValue ?? this.getBaseProperty(property);
    const val = base + delta;
    switch (property) {
      case 'scale':
        this.container.scale.set(Math.max(0.01, val));
        break;
      case 'scaleX':
        this.container.scale.x = Math.max(0.01, val);
        break;
      case 'scaleY':
        this.container.scale.y = Math.max(0.01, val);
        break;
      case 'opacity':
        this.container.alpha = Math.max(0, Math.min(1, val));
        break;
      case 'rotation':
        this.container.rotation = val;
        break;
      case 'x':
        this.container.x = val;
        break;
      case 'y':
        this.container.y = val;
        break;
    }
  }

  public getBaseProperty(property: ModulatableProperty): number {
    const t = this.data.transform || {};
    switch (property) {
      case 'scale':
      case 'scaleX':
        return t.scaleX ?? 1;
      case 'scaleY':
        return t.scaleY ?? 1;
      case 'opacity':
        return t.opacity ?? 1;
      case 'rotation':
        return t.rotation ?? 0;
      case 'x':
        return t.x ?? 0;
      case 'y':
        return t.y ?? 0;
    }
  }

  private createDisplayObject(data: SceneNodeData): Container {
    const props = data.properties || {};
    
    switch (data.type) {
      case 'rectangle': {
        const g = new Graphics();
        const color = safeParseColor(props.color, 0x00e5ff);
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
        const color = safeParseColor(props.color, 0xff007f);
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
        if (props.color) s.tint = safeParseColor(props.color, 0xffffff);
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
