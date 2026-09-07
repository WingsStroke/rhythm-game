import { Texture } from 'pixi.js';

/**
 * GlowTextureCache creates and caches procedural 2D canvas gradient textures
 * (radial glow for point lights and linear glow for beams/rays).
 * These textures are instantiated as PIXI.Sprite with blendMode = ADD,
 * completely avoiding expensive per-frame BlurFilters on the GPU.
 */
export class GlowTextureCache {
  private static radialTexture: Texture | null = null;
  private static linearTexture: Texture | null = null;

  public static getRadialTexture(): Texture {
    if (!this.radialTexture) {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const center = size / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }
      this.radialTexture = Texture.from(canvas);
    }
    return this.radialTexture;
  }

  public static getLinearTexture(): Texture {
    if (!this.linearTexture) {
      const width = 256;
      const height = 64;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Vertical gradient: intense in vertical middle, decaying to top and bottom
        const vGrad = ctx.createLinearGradient(0, 0, 0, height);
        vGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        vGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        vGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');
        vGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, width, height);

        // Horizontal feathering at beam ends
        ctx.globalCompositeOperation = 'destination-in';
        const hGrad = ctx.createLinearGradient(0, 0, width, 0);
        hGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        hGrad.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
        hGrad.addColorStop(0.85, 'rgba(255, 255, 255, 1)');
        hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 0, width, height);
      }
      this.linearTexture = Texture.from(canvas);
    }
    return this.linearTexture;
  }
}
