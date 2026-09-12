import { Filter, ColorMatrixFilter, GlProgram, UniformGroup, type UniformData } from 'pixi.js';

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
 * Standard PixiJS v8 Vertex Shader for 2D Post-Processing Quad Filters (GLSL 300 es).
 */
export const DEFAULT_FILTER_VERT = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

/**
 * Helper to construct modern PixiJS v8 Filters with GlProgram and UniformGroup.
 */
export function createShaderFilter(
  name: string,
  fragmentSrc: string,
  uniforms: Record<string, UniformData>,
  padding = 0
): Filter {
  const glProgram = GlProgram.from({
    vertex: DEFAULT_FILTER_VERT,
    fragment: fragmentSrc,
    name,
  });
  const uniformGroup = new UniformGroup(uniforms);
  return new Filter({
    glProgram,
    resources: {
      filterUniforms: uniformGroup,
    },
    padding,
  });
}

/**
 * Helper to update custom uniform values in a PixiJS v8 Filter.
 */
export function updateShaderUniforms(
  filter: Filter | Filter[],
  updates: Record<string, unknown>
): void {
  const targetFilter = Array.isArray(filter) ? filter[0] : filter;
  if (!targetFilter) return;
  const res = targetFilter.resources as Record<string, unknown> | undefined;
  const ug = res?.filterUniforms as { uniforms?: Record<string, unknown> } | undefined;
  if (ug?.uniforms) {
    for (const [k, v] of Object.entries(updates)) {
      ug.uniforms[k] = v;
    }
  }
}

/**
 * EffectRegistry maintains a catalog of verified, safe post-processing filters/shaders.
 * In accordance with the security and architectural requirements of the project,
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
    } catch (err) {
      console.error(`[EffectRegistry] Failed to create filter for type '${type}':`, err);
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
      updateShaderUniforms(filter, { uTime: time });
    }
  }
}

// ----------------------------------------------------------------------------
// Registered Visual Effects (Modern PixiJS v8 GLSL 300 es Architecture)
// ----------------------------------------------------------------------------

// 1. Bloom Filter (High-Luminance Threshold + Multi-Tap Radial Neon Halo)
EffectRegistry.register({
  type: 'bloom',
  label: 'Bloom (Neon Glow)',
  description: 'High-luminance extraction with 13-tap multi-radial neon glow',
  defaultParameters: { threshold: 0.50, intensity: 1.5, radius: 2.5 },
  createFilter: (params, intensity = 1.0) => {
    const rawThreshold = Number(params.threshold ?? 0.50);
    const rawIntensity = Number(params.intensity ?? 1.5) * intensity;
    const rawRadius = Number(params.radius ?? 2.5);

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform vec4 uInputSize;
      uniform float uThreshold;
      uniform float uIntensity;
      uniform float uRadius;

      vec3 extractHighlights(vec3 c, float threshold) {
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float soft = clamp(luma - threshold, 0.0, 1.0);
        return c * (soft / max(luma, 0.0001));
      }

      void main() {
        vec4 base = texture(uTexture, vTextureCoord);
        vec2 texel = uInputSize.zw * uRadius;
        vec3 bloom = vec3(0.0);

        // Ring 1: Inner tight glow (4 samples)
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(-texel.x, -texel.y) * 1.5).rgb, uThreshold) * 0.15;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(texel.x, -texel.y) * 1.5).rgb, uThreshold) * 0.15;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(-texel.x, texel.y) * 1.5).rgb, uThreshold) * 0.15;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(texel.x, texel.y) * 1.5).rgb, uThreshold) * 0.15;

        // Ring 2: Mid-range glow (4 samples)
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(0.0, -texel.y) * 3.5).rgb, uThreshold) * 0.12;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(0.0, texel.y) * 3.5).rgb, uThreshold) * 0.12;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(-texel.x, 0.0) * 3.5).rgb, uThreshold) * 0.12;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(texel.x, 0.0) * 3.5).rgb, uThreshold) * 0.12;

        // Ring 3: Wide atmosphere halo (4 samples)
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(-texel.x, -texel.y) * 6.0).rgb, uThreshold) * 0.08;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(texel.x, -texel.y) * 6.0).rgb, uThreshold) * 0.08;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(-texel.x, texel.y) * 6.0).rgb, uThreshold) * 0.08;
        bloom += extractHighlights(texture(uTexture, vTextureCoord + vec2(texel.x, texel.y) * 6.0).rgb, uThreshold) * 0.08;

        // Center highlight contribution
        bloom += extractHighlights(base.rgb, uThreshold) * 0.20;

        // Additive blend preserves deep black background while illuminating bright neon objects
        vec3 finalRgb = base.rgb + bloom * uIntensity;
        finalColor = vec4(finalRgb, base.a);
      }
    `;

    return createShaderFilter(
      'bloom-filter',
      frag,
      {
        uThreshold: { value: rawThreshold, type: 'f32' },
        uIntensity: { value: rawIntensity, type: 'f32' },
        uRadius: { value: rawRadius, type: 'f32' },
      },
      32
    );
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const rawThreshold = Number(params.threshold ?? 0.50);
    const rawIntensity = Number(params.intensity ?? 1.5) * intensity;
    const rawRadius = Number(params.radius ?? 2.5);
    updateShaderUniforms(filter, {
      uThreshold: rawThreshold,
      uIntensity: rawIntensity,
      uRadius: rawRadius,
    });
  },
});

// 2. Chromatic Aberration (RGB Shift with angular control)
EffectRegistry.register({
  type: 'chromatic',
  label: 'Chromatic Aberration',
  description: 'Directional RGB channel split displacement',
  defaultParameters: { shift: 0.008, angle: 0.0 },
  createFilter: (params, intensity = 1.0) => {
    const baseShift = Number(params.shift ?? 0.008) * intensity;
    const baseAngle = Number(params.angle ?? 0.0);

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform float uShift;
      uniform float uAngle;

      void main() {
        vec2 dir = vec2(cos(uAngle), sin(uAngle)) * uShift;
        float r = texture(uTexture, vTextureCoord + dir).r;
        vec4 center = texture(uTexture, vTextureCoord);
        float b = texture(uTexture, vTextureCoord - dir).b;
        finalColor = vec4(r, center.g, b, center.a);
      }
    `;

    return createShaderFilter(
      'chromatic-filter',
      frag,
      {
        uShift: { value: baseShift, type: 'f32' },
        uAngle: { value: baseAngle, type: 'f32' },
      },
      24
    );
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const baseShift = Number(params.shift ?? 0.008) * intensity;
    const baseAngle = Number(params.angle ?? 0.0);
    updateShaderUniforms(filter, {
      uShift: baseShift,
      uAngle: baseAngle,
    });
  },
});

// 3. Scanlines (CRT Arcade Raster Overlay)
EffectRegistry.register({
  type: 'scanlines',
  label: 'CRT Scanlines',
  description: 'Retro arcade scanline raster effect',
  defaultParameters: { count: 180.0, opacity: 0.3 },
  createFilter: (params, intensity = 1.0) => {
    const count = Number(params.count ?? 180.0);
    const opacity = Number(params.opacity ?? 0.3) * intensity;

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform float uCount;
      uniform float uOpacity;

      void main() {
        vec4 col = texture(uTexture, vTextureCoord);
        float line = sin(vTextureCoord.y * uCount * 3.14159265);
        float dark = clamp(line * 0.5 + 0.5, 0.0, 1.0);
        col.rgb *= (1.0 - uOpacity) + dark * uOpacity;
        finalColor = col;
      }
    `;

    return createShaderFilter('scanlines-filter', frag, {
      uCount: { value: count, type: 'f32' },
      uOpacity: { value: opacity, type: 'f32' },
    });
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const count = Number(params.count ?? 180.0);
    const opacity = Number(params.opacity ?? 0.3) * intensity;
    updateShaderUniforms(filter, {
      uCount: count,
      uOpacity: opacity,
    });
  },
});

// 4. Glitch / Digital Slice Displacement
EffectRegistry.register({
  type: 'glitch',
  label: 'Digital Glitch',
  description: 'Horizontal pixel slice displacement jitter',
  defaultParameters: { slices: 12.0, offset: 0.02 },
  createFilter: (params, intensity = 1.0) => {
    const slices = Number(params.slices ?? 12.0);
    const offset = Number(params.offset ?? 0.02) * intensity;

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

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
        finalColor = texture(uTexture, uv);
      }
    `;

    return createShaderFilter('glitch-filter', frag, {
      uSlices: { value: slices, type: 'f32' },
      uOffset: { value: offset, type: 'f32' },
      uTime: { value: 0.0, type: 'f32' },
    });
  },
  updateFilter: (filter, params, intensity = 1.0, time = 0) => {
    const offset = Number(params.offset ?? 0.02) * intensity;
    updateShaderUniforms(filter, {
      uOffset: offset,
      uTime: time,
    });
  },
});

// 5. Color Grading (Cinematic Contrast & Saturation Matrix)
EffectRegistry.register({
  type: 'colorGrade',
  label: 'Color Grading',
  description: 'Cinematic color matrix adjustment',
  defaultParameters: { brightness: 1.0, contrast: 1.1, saturation: 1.3 },
  createFilter: (params, intensity = 1.0) => {
    const filter = new ColorMatrixFilter();
    const sat = 1.0 + (Number(params.saturation ?? 1.3) - 1.0) * intensity;
    const con = 1.0 + (Number(params.contrast ?? 1.1) - 1.0) * intensity;
    const bri = 1.0 + (Number(params.brightness ?? 1.0) - 1.0) * intensity;
    filter.saturate(sat, false);
    filter.contrast(con, false);
    filter.brightness(bri, false);
    return filter;
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const f = (Array.isArray(filter) ? filter[0] : filter) as ColorMatrixFilter;
    if (f && typeof f.saturate === 'function') {
      f.reset();
      const sat = 1.0 + (Number(params.saturation ?? 1.3) - 1.0) * intensity;
      const con = 1.0 + (Number(params.contrast ?? 1.1) - 1.0) * intensity;
      const bri = 1.0 + (Number(params.brightness ?? 1.0) - 1.0) * intensity;
      f.saturate(sat, false);
      f.contrast(con, false);
      f.brightness(bri, false);
    }
  },
});

// 6. Pixel-Art (Retro Pixel Grid Mosaic)
EffectRegistry.register({
  type: 'pixelate',
  label: 'Pixel-Art (Pixelate)',
  description: 'Retro pixel grid mosaic rasterization',
  defaultParameters: { pixelSize: 8.0 },
  createFilter: (params, intensity = 1.0) => {
    const rawSize = Math.max(1.0, Number(params.pixelSize ?? 8.0) * intensity);

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform vec4 uInputSize;
      uniform float uPixelSize;

      void main() {
        vec2 coord = vTextureCoord;
        if (uPixelSize > 1.0) {
          vec2 d = uInputSize.zw * uPixelSize;
          coord = floor(coord / d) * d + d * 0.5;
        }
        finalColor = texture(uTexture, coord);
      }
    `;

    return createShaderFilter('pixelate-filter', frag, {
      uPixelSize: { value: rawSize, type: 'f32' },
    });
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const rawSize = Math.max(1.0, Number(params.pixelSize ?? 8.0) * intensity);
    updateShaderUniforms(filter, {
      uPixelSize: rawSize,
    });
  },
});

// 7. Motion Blur (Velocity Sample Streak Blur)
EffectRegistry.register({
  type: 'motionBlur',
  label: 'Motion Blur',
  description: 'Directional velocity streak sample blur',
  defaultParameters: { velocityX: 16.0, velocityY: 0.0 },
  createFilter: (params, intensity = 1.0) => {
    const vx = Number(params.velocityX ?? 16.0) * intensity;
    const vy = Number(params.velocityY ?? 0.0) * intensity;

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform vec4 uInputSize;
      uniform vec2 uVelocity;

      void main() {
        vec2 uv = vTextureCoord;
        vec2 vel = uVelocity * uInputSize.zw;
        vec4 color = vec4(0.0);
        color += texture(uTexture, uv - vel * 0.50) * 0.05;
        color += texture(uTexture, uv - vel * 0.33) * 0.12;
        color += texture(uTexture, uv - vel * 0.16) * 0.20;
        color += texture(uTexture, uv) * 0.26;
        color += texture(uTexture, uv + vel * 0.16) * 0.20;
        color += texture(uTexture, uv + vel * 0.33) * 0.12;
        color += texture(uTexture, uv + vel * 0.50) * 0.05;
        finalColor = color;
      }
    `;

    return createShaderFilter(
      'motion-blur-filter',
      frag,
      {
        uVelocity: { value: [vx, vy], type: 'vec2<f32>' },
      },
      24
    );
  },
  updateFilter: (filter, params, intensity = 1.0) => {
    const vx = Number(params.velocityX ?? 16.0) * intensity;
    const vy = Number(params.velocityY ?? 0.0) * intensity;
    updateShaderUniforms(filter, {
      uVelocity: [vx, vy],
    });
  },
});

// 8. RGB Shift (Alias for Chromatic Aberration)
EffectRegistry.register({
  type: 'rgbShift',
  label: 'RGB Shift (Chromatic)',
  description: 'Color channel RGB offset splitting',
  defaultParameters: { shift: 0.008, angle: 0.0 },
  createFilter: (params, intensity = 1.0) => {
    return EffectRegistry.createFilter('chromatic', params, intensity);
  },
  updateFilter: (filter, params, intensity = 1.0, time = 0) => {
    EffectRegistry.update(Array.isArray(filter) ? filter : [filter], 'chromatic', params, intensity, time);
  },
});

// 9. Shockwave (Radial Ripple Blast Wave)
EffectRegistry.register({
  type: 'shockwave',
  label: 'Shockwave (Ripple)',
  description: 'Radial explosive wave distortion on key beats and drops',
  defaultParameters: { speed: 1.5, waveSize: 0.08, amplitude: 0.03, centerX: 0.5, centerY: 0.5 },
  createFilter: (params, intensity = 1.0) => {
    const speed = Number(params.speed ?? 1.5);
    const waveSize = Number(params.waveSize ?? 0.08);
    const amplitude = Number(params.amplitude ?? 0.03) * intensity;
    const cx = Number(params.centerX ?? 0.5);
    const cy = Number(params.centerY ?? 0.5);

    const frag = `
      precision highp float;
      in vec2 vTextureCoord;
      out vec4 finalColor;

      uniform sampler2D uTexture;
      uniform vec2 uCenter;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uWaveSize;
      uniform float uAmplitude;

      void main() {
        vec2 uv = vTextureCoord;
        vec2 dir = uv - uCenter;
        float dist = length(dir);
        float radius = fract(uTime * uSpeed * 0.5);
        float diff = abs(dist - radius);

        if (diff < uWaveSize && dist > 0.0) {
          float decay = max(0.0, 1.0 - (radius / 1.2));
          float factor = sin(diff / uWaveSize * 3.14159265);
          vec2 offset = normalize(dir) * factor * uAmplitude * decay;
          uv += offset;
        }

        finalColor = texture(uTexture, uv);
      }
    `;

    return createShaderFilter(
      'shockwave-filter',
      frag,
      {
        uCenter: { value: [cx, cy], type: 'vec2<f32>' },
        uTime: { value: 0.0, type: 'f32' },
        uSpeed: { value: speed, type: 'f32' },
        uWaveSize: { value: waveSize, type: 'f32' },
        uAmplitude: { value: amplitude, type: 'f32' },
      },
      32
    );
  },
  updateFilter: (filter, params, intensity = 1.0, time = 0) => {
    const speed = Number(params.speed ?? 1.5);
    const waveSize = Number(params.waveSize ?? 0.08);
    const amplitude = Number(params.amplitude ?? 0.03) * intensity;
    const cx = Number(params.centerX ?? 0.5);
    const cy = Number(params.centerY ?? 0.5);
    updateShaderUniforms(filter, {
      uCenter: [cx, cy],
      uTime: time,
      uSpeed: speed,
      uWaveSize: waveSize,
      uAmplitude: amplitude,
    });
  },
});
