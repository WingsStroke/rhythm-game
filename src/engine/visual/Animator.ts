import type { AnimationData, Keyframe } from '../types';
import type { SceneGraph } from './SceneGraph';

/**
 * Animator evaluates keyframes and applies them to SceneNodes.
 */
export class Animator {
  private sceneGraph: SceneGraph;
  private animations: AnimationData[] = [];

  constructor(sceneGraph: SceneGraph) {
    this.sceneGraph = sceneGraph;
  }

  public setAnimations(animations: AnimationData[]) {
    this.animations = animations;
  }

  /**
   * Called every frame.
   * @param time Current audio time in seconds.
   */
  public update(time: number) {
    for (const anim of this.animations) {
      const node = this.sceneGraph.getNode(anim.targetId);
      if (!node) continue;

      const value = this.evaluateKeyframes(time, anim.keyframes);
      
      // Apply the interpolated value to the node
      switch (anim.property) {
        case 'x': node.container.x = value; break;
        case 'y': node.container.y = value; break;
        case 'scaleX': node.container.scale.x = value; break;
        case 'scaleY': node.container.scale.y = value; break;
        case 'rotation': node.container.rotation = value; break;
        case 'alpha': node.container.alpha = value; break;
      }
    }
  }

  private evaluateKeyframes(time: number, keyframes: Keyframe[]): number {
    if (keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    // Before first keyframe
    if (time <= keyframes[0].time) return keyframes[0].value;
    
    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

    // Find the current segment
    let kf1 = keyframes[0];
    let kf2 = keyframes[1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
        kf1 = keyframes[i];
        kf2 = keyframes[i + 1];
        break;
      }
    }

    const duration = kf2.time - kf1.time;
    let t = (time - kf1.time) / duration;

    // Apply easing
    const easing = kf2.easing || 'linear';
    t = this.applyEasing(t, easing);

    return kf1.value + (kf2.value - kf1.value) * t;
  }

  private applyEasing(t: number, type: string): number {
    switch (type) {
      case 'linear': return t;
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default: return t;
    }
  }
}
