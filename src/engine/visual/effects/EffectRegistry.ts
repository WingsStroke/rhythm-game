import { Filter, ColorMatrixFilter } from 'pixi.js';

export interface EffectDefinition {
  type: string;
  label: string;
  description: string;
  defaultParameters: Record<string, number | string | boolean>;
  createFilter: (params: Record<string, number | string | boolean>, intensity?: number) => Filter | Filter[];
  updateFilter?: (
    filter: Filter | Filter[],
    params: Record<string, number | string | boolean>,
    intensity?: number,
    time?: number
  ) => void;
}

/**
 * EffectRegistry maintains a catalog of verified, safe post-processing filters/shaders.
 * In accordance with the security and architectural requirements of the DevTeam Report,
 * levels never contain raw arbitrary GLSL, but instead reference registered, parameterizable effects.
 */
export class EffectRegistry {
  private static registry = new Map<string, EffectDefinition>();

  public static register(def: EffectDefinition): void {
    this.registry.set(def.type, def);
  }

  public static get(type: string): EffectDefinition | undefined {
    return this.registry.get(type);
  }

  public static has(type: string): boolean {
    return this.registry.has(type);
  }

  public static getAll(): EffectDefinition[] {
    return Array.from(this.registry.values());
  }

  public static createFilter(
    type: string,
    params: Record<string, number | string | boolean>,
    intensity = 1.0
  ): Filter[] {
    const def = this.registry.get(type);
    if (!def) return [];
    try {
      const res = def.createFilter(params, intensity);
      return Array.isArray(res) ? res : [res];
    } catch {
      return [];
    }
  }

  public static update(
    filters: Filter[],
    type: string,
    params: Record<string, number | string | boolean>,
    intensity = 1.0,
    time = 0
  ): void {
    const def = this.registry.get(type);
    if (!def || !filters || filters.length === 0) return;
    if (def.updateFilter) {
      def.updateFilter(filters.length === 1 ? filters[0] : filters, params, intensity, time);
      return;
    }
    for (const filter of filters) {
      const u = filter as unknown as {
        resources?: { filterUniforms?: { uniforms?: Record<string, number> } };
        uniforms?: Record<string, number>;
      };
      if (u.resources?.filterUniforms?.uniforms && 'uTime' in u.resources.filterUniforms.uniforms) {
        u.resources.filterUniforms.uniforms.uTime = time;
      } else if (u.uniforms && 'uTime' in u.uniforms) {
        u.uniforms.uTime = time;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Registered Visual Effects
// ----------------------------------------------------------------------------

// 1. Bloom Filter
EffectRegistry.register({
  type: 'bloom',
  label: 'Bloom (Glow)',
  description: 'Bright glow amplification and saturation boost',
  defaultParameters: { brightness: 1.12, contrast: 1.1 },
  createFilter: (params, intensity = 1.0) => {
    const filter = new ColorMatrixFilter();
    const b = Number(params.brightness ?? 1.12) * intensity;
    filter.brightness(b, false);
    return filter;
  },
});

// 2. Chromatic Aberration
EffectRegistry.register({
  type: 'chromatic',
  label: 'Chromatic Aberration',
  description: 'Color channel RGB offset splitting',
  defaultParameters: { shift: 0.005 },
  createFilter: (params, intensity = 1.0) => {
    const baseShift = Number(params.shift ?? 0.005) * intensity;
    const frag = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform float uShift;
      void main() {
        vec2 uv = vTextureCoord;
        float shift = uShift;
        float r = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
        float g = texture2D(uTexture, uv).g;
        float b = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
        float a = texture2D(uTexture, uv).a;
        gl_FragColor = vec4(r, g, b, a);
      }
    `;
    const filter = new Filter({
      gl: { fragment: frag },
      resources: {
        filterUniforms: {
          uShift: { value: baseShift, type: 'f32' },
        },
      },
    } as unknown as ConstructorParameters<typeof Filter>[0]);
    return filter;
  },
});

// 3. Scanlines (CRT Overlay)
EffectRegistry.register({
  type: 'scanlines',
  label: 'CRT Scanlines',
  description: 'Retro arcade scanline raster effect',
  defaultParameters: { count: 180.0, opacity: 0.2 },
  createFilter: (params, intensity = 1.0) => {
    const count = Number(params.count ?? 180.0);
    const opacity = Number(params.opacity ?? 0.2) * intensity;
    const frag = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform float uCount;
      uniform float uOpacity;
      void main() {
        vec2 uv = vTextureCoord;
        vec4 col = texture2D(uTexture, uv);
        float line = sin(uv.y * uCount * 3.14159);
        float dark = clamp(line * 0.5 + 0.5, 0.0, 1.0);
        col.rgb *= (1.0 - uOpacity) + dark * uOpacity;
        gl_FragColor = col;
      }
    `;
    const filter = new Filter({
      gl: { fragment: frag },
      resources: {
        filterUniforms: {
          uCount: { value: count, type: 'f32' },
          uOpacity: { value: opacity, type: 'f32' },
        },
      },
    } as unknown as ConstructorParameters<typeof Filter>[0]);
    return filter;
  },
});

// 4. Glitch / Slice Jitter
EffectRegistry.register({
  type: 'glitch',
  label: 'Digital Glitch',
  description: 'Horizontal pixel slice displacement',
  defaultParameters: { slices: 12.0, offset: 0.015 },
  createFilter: (params, intensity = 1.0) => {
    const slices = Number(params.slices ?? 12.0);
    const offset = Number(params.offset ?? 0.015) * intensity;
    const frag = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform float uSlices;
      uniform float uOffset;
      uniform float uTime;
      void main() {
        vec2 uv = vTextureCoord;
        float slice = floor(uv.y * uSlices);
        float jitter = sin(slice * 43758.5453 + floor(uTime * 14.0));
        if (jitter > 0.5) {
          uv.x += uOffset * (jitter - 0.5) * 2.0;
        }
        gl_FragColor = texture2D(uTexture, uv);
      }
    `;
    const filter = new Filter({
      gl: { fragment: frag },
      resources: {
        filterUniforms: {
          uSlices: { value: slices, type: 'f32' },
          uOffset: { value: offset, type: 'f32' },
          uTime: { value: 0.0, type: 'f32' },
        },
      },
    } as unknown as ConstructorParameters<typeof Filter>[0]);
    return filter;
  },
  updateFilter: (filter, _params, _intensity, time = 0) => {
    const f = (Array.isArray(filter) ? filter[0] : filter) as unknown as {
      resources?: { filterUniforms?: { uniforms?: Record<string, number> } };
    };
    if (f.resources?.filterUniforms?.uniforms) {
      f.resources.filterUniforms.uniforms.uTime = time;
    }
  },
});

// 5. Color Grading / Hue & Saturation
EffectRegistry.register({
  type: 'colorGrade',
  label: 'Color Grading',
  description: 'Cinematic color matrix adjustment',
  defaultParameters: { brightness: 1.0, contrast: 1.0, saturation: 1.1 },
  createFilter: (params, intensity = 1.0) => {
    const filter = new ColorMatrixFilter();
    const sat = 1.0 + (Number(params.saturation ?? 1.1) - 1.0) * intensity;
    filter.saturate(sat, false);
    return filter;
  },
});

// 6. Pixel-Art (Pixelate)
EffectRegistry.register({
  type: 'pixelate',
  label: 'Pixel-Art (Pixelate)',
  description: 'Retro pixel grid mosaic rasterization',
  defaultParameters: { pixelSize: 8.0 },
  createFilter: (params, intensity = 1.0) => {
    const rawSize = Math.max(1.0, Number(params.pixelSize ?? 8.0) * intensity);
    const frag = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform float uPixelSize;
      uniform vec2 uResolution;
      void main() {
        vec2 coord = vTextureCoord;
        if (uPixelSize > 1.0 && uResolution.x > 0.0 && uResolution.y > 0.0) {
          vec2 d = vec2(uPixelSize) / uResolution;
          coord = floor(coord / d) * d + d * 0.5;
        }
        gl_FragColor = texture2D(uTexture, coord);
      }
    `;
    const filter = new Filter({
      gl: { fragment: frag },
      resources: {
        filterUniforms: {
          uPixelSize: { value: rawSize, type: 'f32' },
          uResolution: { value: [1920, 1080], type: 'vec2<f32>' },
        },
      },
    } as unknown as ConstructorParameters<typeof Filter>[0]);
    return filter;
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const rawSize = Math.max(1.0, Number(params.pixelSize ?? 8.0) * intensity);
    const f = (Array.isArray(filter) ? filter[0] : filter) as unknown as {
      resources?: { filterUniforms?: { uniforms?: Record<string, unknown> } };
    };
    if (f.resources?.filterUniforms?.uniforms) {
      f.resources.filterUniforms.uniforms.uPixelSize = rawSize;
    }
  },
});

// 7. Motion Blur
EffectRegistry.register({
  type: 'motionBlur',
  label: 'Motion Blur',
  description: 'Directional velocity streak sample blur',
  defaultParameters: { velocityX: 16.0, velocityY: 0.0 },
  createFilter: (params, intensity = 1.0) => {
    const vx = (Number(params.velocityX ?? 16.0) * intensity) / 1920.0;
    const vy = (Number(params.velocityY ?? 0.0) * intensity) / 1080.0;
    const frag = `
      precision mediump float;
      varying vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform vec2 uVelocity;
      void main() {
        vec2 uv = vTextureCoord;
        vec4 color = vec4(0.0);
        color += texture2D(uTexture, uv - uVelocity * 0.50) * 0.05;
        color += texture2D(uTexture, uv - uVelocity * 0.33) * 0.12;
        color += texture2D(uTexture, uv - uVelocity * 0.16) * 0.20;
        color += texture2D(uTexture, uv) * 0.26;
        color += texture2D(uTexture, uv + uVelocity * 0.16) * 0.20;
        color += texture2D(uTexture, uv + uVelocity * 0.33) * 0.12;
        color += texture2D(uTexture, uv + uVelocity * 0.50) * 0.05;
        gl_FragColor = color;
      }
    `;
    const filter = new Filter({
      gl: { fragment: frag },
      resources: {
        filterUniforms: {
          uVelocity: { value: [vx, vy], type: 'vec2<f32>' },
        },
      },
    } as unknown as ConstructorParameters<typeof Filter>[0]);
    return filter;
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const vx = (Number(params.velocityX ?? 16.0) * intensity) / 1920.0;
    const vy = (Number(params.velocityY ?? 0.0) * intensity) / 1080.0;
    const f = (Array.isArray(filter) ? filter[0] : filter) as unknown as {
      resources?: { filterUniforms?: { uniforms?: Record<string, unknown> } };
    };
    if (f.resources?.filterUniforms?.uniforms) {
      f.resources.filterUniforms.uniforms.uVelocity = [vx, vy];
    }
  },
});

// 8. RGB Shift (Alias for Chromatic Aberration)
EffectRegistry.register({
  type: 'rgbShift',
  label: 'RGB Shift (Chromatic)',
  description: 'Color channel RGB offset splitting',
  defaultParameters: { shift: 0.008 },
  createFilter: (params, intensity = 1.0) => {
    return EffectRegistry.createFilter('chromatic', params, intensity);
  },
});
