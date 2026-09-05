import type { AnimationData, EasingType, Keyframe } from '../types';
import type { SceneGraph } from './SceneGraph';
import type { SceneNode } from './objects/SceneNode';

export interface ActiveTransition {
  targetId: string;
  property: string;
  from: number;
  to: number;
  duration: number;
  easing: EasingType;
  startTime: number;
}

/**
 * Animator evaluates keyframes and dynamic transitions, applying them to SceneNodes.
 */
export class Animator {
  private sceneGraph: SceneGraph;
  private animations: AnimationData[] = [];
  private activeTransitions: ActiveTransition[] = [];

  constructor(sceneGraph: SceneGraph) {
    this.sceneGraph = sceneGraph;
  }

  public setAnimations(animations: AnimationData[]) {
    this.animations = animations;
  }

  /**
   * Adds a temporal transition triggered dynamically.
   */
  public addTransition(
    targetId: string,
    property: string,
    from: number,
    to: number,
    duration: number,
    easing: EasingType = 'linear',
    startTime: number
  ): void {
    // Remove existing transition targeting the same node and property
    this.activeTransitions = this.activeTransitions.filter(
      (t) => !(t.targetId === targetId && t.property === property)
    );

    this.activeTransitions.push({
      targetId,
      property,
      from,
      to,
      duration: Math.max(0, duration),
      easing,
      startTime,
    });
  }

  /**
   * Removes all active transitions (e.g. on seek or stop).
   */
  public clearTransitions(): void {
    this.activeTransitions = [];
  }

  /**
   * Reads current numeric value of a property from a SceneNode.
   */
  public getNodeProperty(targetId: string, property: string): number {
    const node = this.sceneGraph.getNode(targetId);
    if (!node) return 0;

    switch (property) {
      case 'x': return node.container.x;
      case 'y': return node.container.y;
      case 'scaleX': return node.container.scale.x;
      case 'scaleY': return node.container.scale.y;
      case 'scale': return node.container.scale.x;
      case 'rotation': return node.container.rotation;
      case 'alpha':
      case 'opacity': return node.container.alpha;
      case 'pivotX': return node.container.pivot.x;
      case 'pivotY': return node.container.pivot.y;
      default: return 0;
    }
  }

  /**
   * Called every frame.
   * @param time Current audio time in seconds.
   */
  public update(time: number): void {
    // 1. Evaluate permanent track animations
    for (const anim of this.animations) {
      const node = this.sceneGraph.getNode(anim.targetId);
      if (!node) continue;

      const value = this.evaluateKeyframes(time, anim.keyframes);
      this.applyPropertyToNode(node, anim.property, value);
    }

    // 2. Evaluate active temporal transitions
    if (this.activeTransitions.length > 0) {
      this.activeTransitions = this.activeTransitions.filter((trans) => {
        const elapsed = time - trans.startTime;
        if (elapsed < 0) {
          // Transition is in future
          return true;
        }

        const t = trans.duration > 0 ? Math.min(1, Math.max(0, elapsed / trans.duration)) : 1;
        const easedT = this.applyEasing(t, trans.easing);
        const value = trans.from + (trans.to - trans.from) * easedT;

        const node = this.sceneGraph.getNode(trans.targetId);
        if (node) {
          this.applyPropertyToNode(node, trans.property, value);
        }

        return elapsed < trans.duration;
      });
    }
  }

  public applyPropertyToNode(node: SceneNode, property: string, value: number): void {
    switch (property) {
      case 'x':
        node.container.x = value;
        break;
      case 'y':
        node.container.y = value;
        break;
      case 'scaleX':
        node.container.scale.x = value;
        break;
      case 'scaleY':
        node.container.scale.y = value;
        break;
      case 'scale':
        node.container.scale.set(value);
        break;
      case 'rotation':
        node.container.rotation = value;
        break;
      case 'alpha':
      case 'opacity':
        node.container.alpha = value;
        break;
      case 'pivotX':
        node.container.pivot.x = value;
        break;
      case 'pivotY':
        node.container.pivot.y = value;
        break;
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

  public applyEasing(t: number, type: EasingType | string): number {
    switch (type) {
      case 'linear':
        return t;
      case 'easeIn':
      case 'easeInQuad':
        return t * t;
      case 'easeOut':
      case 'easeOutQuad':
        return t * (2 - t);
      case 'easeInOut':
      case 'easeInOutQuad':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }
}

