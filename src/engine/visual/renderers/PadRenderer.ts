import { Container, Graphics, Text } from 'pixi.js';
import type { PadState, ModulationChannel } from '../../types';
import type { ModulatedChannels } from '../../audio/AudioModulator';
import type { ParticlePool } from '../ParticlePool';

export interface PadVisual {
  container: Container;
  socket: Graphics;
  buttonContainer: Container;
  buttonGlow: Graphics;
  buttonBase: Graphics;
  keyText: Text;
  baseColor: number;
  pressed: boolean;
  pressAnim: number;
  state: PadState;
  stateAnim: number;
  x: number;
  channel: ModulationChannel;
}

export class PadRenderer {
  /**
   * Updates animations and redraws visual surfaces for a physical silicone launchpad pad.
   */
  public static updatePadVisual(
    pv: PadVisual,
    channels: ModulatedChannels,
    audioTime: number,
    padY: number,
    padHeight: number,
    particlePool?: ParticlePool
  ): void {
    let bandValue = 0;
    switch (pv.channel) {
      case 'bass':
        bandValue = channels.bassIntensity;
        break;
      case 'mids':
        bandValue = channels.midsReactivity;
        break;
      case 'treble':
        bandValue = channels.trebleDispersion;
        break;
      case 'ambient':
      default:
        bandValue = channels.ambientBrightness;
        break;
    }

    // Base idle glow modulated slightly by audio beats
    const idleGlow = bandValue * 0.15;
    const pressGlow = pv.pressAnim * 0.85;
    let totalGlow = Math.min(1, idleGlow + pressGlow);
    let glowColor = pv.baseColor;
    const rimColor = 0xffffff;
    const rimAlpha = 0.12 + totalGlow * 0.5;

    // Button scale animation: ONLY the inner white button scales on input!
    let buttonScale = 1.0 + pv.pressAnim * 0.12;

    // State-specific visual behaviors
    switch (pv.state) {
      case 'queued': {
        const pulse = Math.sin(audioTime * 16) * 0.5 + 0.5;
        totalGlow = Math.max(totalGlow, 0.35 + pulse * 0.45);
        break;
      }
      case 'playing': {
        // Loop active: full vibrant neon illumination modulated in real-time
        totalGlow = Math.max(totalGlow, 0.65 + bandValue * 0.35);
        buttonScale = Math.max(buttonScale, 1.0 + bandValue * 0.05);
        break;
      }
      case 'holding': {
        // Holding sustained note: intense glow and continuous edge particles
        totalGlow = Math.max(totalGlow, 0.85 + bandValue * 0.15);
        buttonScale = Math.max(buttonScale, 1.04);
        if (particlePool && Math.random() < 0.35) {
          particlePool.spawn(
            pv.x + 20 + Math.random() * 60,
            padY + padHeight / 2 + (Math.random() - 0.5) * 20,
            pv.baseColor,
            1,
            0.6
          );
        }
        break;
      }
      case 'miss': {
        if (pv.stateAnim > 0) {
          glowColor = 0xff3344;
          totalGlow = Math.max(totalGlow, pv.stateAnim * 0.8);
          pv.stateAnim *= 0.88;
        }
        break;
      }
      case 'ready':
      default:
        break;
    }

    // 1. Render Glow-Neon: fixed geometry, purely color/opacity pulse (no size expansion)
    pv.buttonGlow.clear();
    if (totalGlow > 0.02) {
      // Outer soft diffusion halo
      pv.buttonGlow
        .roundRect(-46, -46, 92, 92, 12)
        .fill({ color: glowColor, alpha: totalGlow * 0.35 });
      // Core neon aura
      pv.buttonGlow
        .roundRect(-43, -43, 86, 86, 10)
        .fill({ color: glowColor, alpha: totalGlow * 0.65 });
    }

    // 2. Render Button Base (the frosted white translucent silicone pad)
    pv.buttonBase.clear();
    // Matte dark silicone substrate
    pv.buttonBase
      .roundRect(-43, -43, 86, 86, 10)
      .fill({ color: 0x1e1e24, alpha: 0.95 });
    // Frosted white translucent layer (launchpad silicone look)
    pv.buttonBase
      .roundRect(-43, -43, 86, 86, 10)
      .fill({ color: 0xffffff, alpha: 0.12 });
    // Illuminated neon wash when glowing / pressed
    if (totalGlow > 0.02) {
      pv.buttonBase
        .roundRect(-43, -43, 86, 86, 10)
        .fill({ color: glowColor, alpha: totalGlow * 0.70 });
      // Extra translucent white gloss when illuminated
      pv.buttonBase
        .roundRect(-43, -43, 86, 86, 10)
        .fill({ color: 0xffffff, alpha: totalGlow * 0.18 });
    }
    // Silicone rim stroke
    pv.buttonBase.stroke({
      color: totalGlow > 0.1 ? glowColor : rimColor,
      width: 1.5,
      alpha: rimAlpha,
    });

    // 3. Key text opacity: subtle in idle, brighter when lit
    pv.keyText.alpha = 0.38 + totalGlow * 0.38;

    // 4. Animate button size on input: ONLY the inner button container scales!
    pv.buttonContainer.scale.set(buttonScale);

    // Outer container stays stationary at (pv.x, padY)
    pv.container.scale.set(1.0);
    pv.container.x = pv.x;
    pv.container.y = padY;

    pv.pressAnim *= 0.84;
  }
}
