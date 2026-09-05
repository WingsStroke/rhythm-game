import { Container, Graphics } from 'pixi.js';

export interface Particle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  baseRadius: number;
  active: boolean;
}

/**
 * Pre-allocated particle pool for explosion bursts and hit feedback.
 * Avoids GC allocations in the render ticker by reusing Graphics objects.
 */
export class ParticlePool {
  private container: Container;
  private particles: Particle[] = [];
  private poolIndex = 0;

  constructor(container: Container, capacity = 60) {
    this.container = container;
    this.initPool(capacity);
  }

  private initPool(capacity: number): void {
    for (let i = 0; i < capacity; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.particles.push({
        gfx: g,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1.0,
        color: 0xffffff,
        baseRadius: 4,
        active: false,
      });
    }
  }

  /**
   * Spawns a radial burst of particles at (x, y).
   */
  public spawn(
    x: number,
    y: number,
    color: number,
    count: number,
    speedMultiplier = 1.0
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.particles.length;

      const angle = Math.random() * Math.PI * 2;
      const speed = (100 + Math.random() * 220) * speedMultiplier;
      const radius = 3 + Math.random() * 4;

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.life = 1.0;
      p.maxLife = 1.0;
      p.color = color;
      p.baseRadius = radius;

      p.gfx.clear();
      p.gfx.circle(0, 0, radius).fill({ color, alpha: 0.95 });
      p.gfx.x = x;
      p.gfx.y = y;
      p.gfx.alpha = 1;
      p.gfx.scale.set(1);
      p.gfx.visible = true;
    }
  }

  /**
   * Advances physics and visual life for all active particles.
   * @param dt Delta time in seconds.
   * @param dispersionFactor Optional multiplier from audio treble dispersion.
   */
  public update(dt: number, dispersionFactor = 1.0): void {
    const clampedDt = Math.min(dt, 0.1);
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life -= clampedDt * 2.2;
      if (p.life <= 0) {
        p.active = false;
        p.gfx.visible = false;
        continue;
      }

      p.x += p.vx * clampedDt * dispersionFactor;
      p.y += p.vy * clampedDt;
      p.vy += 220 * clampedDt; // Gravity

      p.gfx.x = p.x;
      p.gfx.y = p.y;
      p.gfx.alpha = Math.max(0, p.life);
      p.gfx.scale.set(Math.max(0.1, p.life));
    }
  }

  /**
   * Deactivates and hides all particles.
   */
  public reset(): void {
    for (const p of this.particles) {
      p.active = false;
      p.gfx.visible = false;
    }
    this.poolIndex = 0;
  }

  /**
   * Destroys all graphics objects when engine disposes.
   */
  public destroy(): void {
    for (const p of this.particles) {
      p.gfx.destroy();
    }
    this.particles = [];
  }
}
