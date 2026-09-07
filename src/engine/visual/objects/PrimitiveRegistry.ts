import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { safeParseColor } from './SceneNode';
import { GlowTextureCache } from '../GlowTextureCache';
import { AudioSpectrumVisualizer } from './AudioSpectrumVisualizer';

export interface PrimitiveDefinition {
  type: string;
  label: string;
  category: 'basic' | 'polygon' | 'lighting' | 'container' | 'audio';
  defaultProperties: Record<string, unknown>;
  createDisplayObject: (props: Record<string, unknown>) => Container;
}

/**
 * PrimitiveRegistry manages all visual object primitives in a decoupled, extensible registry,
 * preventing SceneNode.ts from becoming a monolithic switch-statement.
 */
export class PrimitiveRegistry {
  private static registry = new Map<string, PrimitiveDefinition>();

  public static register(definition: PrimitiveDefinition): void {
    this.registry.set(definition.type, definition);
  }

  public static get(type: string): PrimitiveDefinition | undefined {
    return this.registry.get(type);
  }

  public static has(type: string): boolean {
    return this.registry.has(type);
  }

  public static getAll(): PrimitiveDefinition[] {
    return Array.from(this.registry.values());
  }

  public static createDisplayObject(type: string, props: Record<string, unknown>): Container {
    const def = this.registry.get(type);
    if (def) {
      return def.createDisplayObject(props);
    }
    return new Container();
  }
}

// ----------------------------------------------------------------------------
// Built-in Primitives Registration
// ----------------------------------------------------------------------------

// 1. Rectangle
PrimitiveRegistry.register({
  type: 'rectangle',
  label: 'Rectangle',
  category: 'basic',
  defaultProperties: { width: 140, height: 140, color: '#00e5ff' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0x00e5ff);
    const width = (props.width as number) || 140;
    const height = (props.height as number) || 140;
    g.rect(0, 0, width, height);
    g.fill({ color });
    g.pivot.set(width / 2, height / 2);
    return g;
  },
});

// 2. Circle
PrimitiveRegistry.register({
  type: 'circle',
  label: 'Circle',
  category: 'basic',
  defaultProperties: { width: 140, height: 140, radius: 70, color: '#ff007f' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0xff007f);
    const radius = (props.radius as number) || (typeof props.width === 'number' ? props.width / 2 : 70);
    g.circle(0, 0, radius);
    g.fill({ color });
    return g;
  },
});

// 3. Triangle (Equilateral / Isosceles)
PrimitiveRegistry.register({
  type: 'triangle',
  label: 'Triangle',
  category: 'polygon',
  defaultProperties: { width: 120, height: 120, color: '#ffea00' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0xffea00);
    const width = (props.width as number) || 120;
    const height = (props.height as number) || 120;
    const halfW = width / 2;
    const halfH = height / 2;
    g.poly([
      0, -halfH,        // Top apex
      halfW, halfH,     // Bottom right
      -halfW, halfH,    // Bottom left
    ]);
    g.fill({ color });
    return g;
  },
});

// 4. Diamond (Rhombus)
PrimitiveRegistry.register({
  type: 'diamond',
  label: 'Diamond',
  category: 'polygon',
  defaultProperties: { width: 120, height: 120, color: '#b388ff' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0xb388ff);
    const width = (props.width as number) || 120;
    const height = (props.height as number) || 120;
    const halfW = width / 2;
    const halfH = height / 2;
    g.poly([
      0, -halfH,        // Top
      halfW, 0,         // Right
      0, halfH,         // Bottom
      -halfW, 0,        // Left
    ]);
    g.fill({ color });
    return g;
  },
});

// 5. Star (Parametric n-pointed star)
PrimitiveRegistry.register({
  type: 'star',
  label: 'Star',
  category: 'polygon',
  defaultProperties: { width: 120, height: 120, points: 5, outerRadius: 60, innerRadius: 28, color: '#ffaa00' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0xffaa00);
    const pointsCount = Math.max(3, Math.min(20, (props.points as number) || 5));
    const outerR = (props.outerRadius as number) || (typeof props.width === 'number' ? props.width / 2 : 60);
    const innerR = (props.innerRadius as number) || Math.round(outerR * 0.45);

    const step = Math.PI / pointsCount;
    const polyPoints: number[] = [];
    // Start pointing up (-PI/2)
    let currentAngle = -Math.PI / 2;
    for (let i = 0; i < pointsCount * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      polyPoints.push(
        Math.cos(currentAngle) * radius,
        Math.sin(currentAngle) * radius
      );
      currentAngle += step;
    }

    g.poly(polyPoints);
    g.fill({ color });
    return g;
  },
});

// 6. Hexagon (Regular 6-sided polygon)
PrimitiveRegistry.register({
  type: 'hexagon',
  label: 'Hexagon',
  category: 'polygon',
  defaultProperties: { width: 120, height: 120, radius: 60, color: '#00ff9d' },
  createDisplayObject: (props) => {
    const g = new Graphics();
    const color = safeParseColor(props.color, 0x00ff9d);
    const radius = (props.radius as number) || (typeof props.width === 'number' ? props.width / 2 : 60);
    const polyPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      polyPoints.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius
      );
    }
    g.poly(polyPoints);
    g.fill({ color });
    return g;
  },
});

// 7. Point Light (Radial Glow Sprite)
PrimitiveRegistry.register({
  type: 'pointLight',
  label: 'Point Light',
  category: 'lighting',
  defaultProperties: { width: 200, height: 200, radius: 100, color: '#00e5ff', intensity: 1.0 },
  createDisplayObject: (props) => {
    const texture = GlowTextureCache.getRadialTexture();
    const sprite = new Sprite(texture);
    const radius = (props.radius as number) || (typeof props.width === 'number' ? props.width / 2 : 100);
    sprite.anchor.set(0.5);
    sprite.width = radius * 2;
    sprite.height = radius * 2;
    sprite.tint = safeParseColor(props.color, 0x00e5ff);
    // Cast through unknown to avoid generic blendMode type mismatch in PixiJS v8
    (sprite as unknown as { blendMode: string }).blendMode = 'add';
    const intensity = Math.max(0, Math.min(1, (props.intensity as number) ?? 1.0));
    sprite.alpha = intensity;
    return sprite;
  },
});

// 8. Beam Light (Linear Glow Ray)
PrimitiveRegistry.register({
  type: 'beamLight',
  label: 'Beam Light',
  category: 'lighting',
  defaultProperties: { width: 70, height: 320, length: 320, color: '#ff007f', intensity: 1.0 },
  createDisplayObject: (props) => {
    const texture = GlowTextureCache.getLinearTexture();
    const sprite = new Sprite(texture);
    const length = (props.length as number) || (props.height as number) || 320;
    const width = (props.width as number) || 70;
    sprite.anchor.set(0.5);
    sprite.width = length;
    sprite.height = width;
    sprite.tint = safeParseColor(props.color, 0xff007f);
    (sprite as unknown as { blendMode: string }).blendMode = 'add';
    const intensity = Math.max(0, Math.min(1, (props.intensity as number) ?? 1.0));
    sprite.alpha = intensity;
    return sprite;
  },
});

// 9. Sprite
PrimitiveRegistry.register({
  type: 'sprite',
  label: 'Sprite',
  category: 'basic',
  defaultProperties: { width: 100, height: 100, color: '#ffffff' },
  createDisplayObject: (props) => {
    const s = new Sprite(Texture.WHITE);
    if (props.width) s.width = props.width as number;
    if (props.height) s.height = props.height as number;
    s.anchor.set(0.5);
    if (props.color) s.tint = safeParseColor(props.color, 0xffffff);
    return s;
  },
});

// 10. Group Container
PrimitiveRegistry.register({
  type: 'group',
  label: 'Group',
  category: 'container',
  defaultProperties: {},
  createDisplayObject: () => new Container(),
});

// 11. Audio Spectrum Visualizer
PrimitiveRegistry.register({
  type: 'audioSpectrum',
  label: 'Audio Spectrum',
  category: 'audio',
  defaultProperties: {
    width: 420,
    height: 120,
    bands: 32,
    mode: 'bars',
    color: '#00e5ff',
    gap: 3,
  },
  createDisplayObject: (props) => new AudioSpectrumVisualizer(props),
});

