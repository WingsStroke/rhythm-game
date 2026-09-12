import type { EffectType, TriggerData } from '../types';
import type { Animator } from './Animator';
import type { SceneGraph } from './SceneGraph';
import type { SceneNode } from './objects/SceneNode';

export class TriggerDispatcher {
  private sceneGraph: SceneGraph;
  private animator: Animator;
  private triggers: TriggerData[] = [];
  private nextTriggerIndex = 0;

  /** Optional event hooks for external listeners. */
  public onTrigger?: (trigger: TriggerData) => void;
  public onEffect?: (
    effectType: EffectType,
    targetId: string | number,
    properties: Record<string, unknown>
  ) => void;

  constructor(sceneGraph: SceneGraph, animator: Animator) {
    this.sceneGraph = sceneGraph;
    this.animator = animator;
  }

  /**
   * Loads and sorts triggers chronologically.
   */
  public setTriggers(triggers: TriggerData[]): void {
    this.triggers = [...triggers].sort((a, b) => a.time - b.time);
    this.nextTriggerIndex = 0;
  }

  /**
   * Called on every frame with the master audio clock time.
   */
  public update(currentTime: number): void {
    while (
      this.nextTriggerIndex < this.triggers.length &&
      this.triggers[this.nextTriggerIndex].time <= currentTime
    ) {
      const trigger = this.triggers[this.nextTriggerIndex];
      this.dispatch(trigger, currentTime);
      this.nextTriggerIndex++;
    }
  }

  /**
   * Re-aligns the trigger pointer after seeking in the timeline,
   * evaluating cumulative state of past triggers for deterministic preview.
   */
  public seek(targetTime: number): void {
    this.animator.clearTransitions();

    // Binary search for first trigger with time >= targetTime
    let low = 0;
    let high = this.triggers.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.triggers[mid].time < targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // Apply cumulative end states of triggers preceding targetTime
    for (let i = 0; i < low; i++) {
      const trigger = this.triggers[i];
      const targetNodes = this.resolveTargets(trigger.targetId);

      if (trigger.action === 'transform') {
        for (const node of targetNodes) {
          for (const [prop, val] of Object.entries(trigger.properties)) {
            const targetVal = Number(val);
            if (!Number.isNaN(targetVal)) {
              this.animator.applyPropertyToNode(node, prop, targetVal);
            }
          }
        }
      } else if (trigger.action === 'pos') {
        for (const node of targetNodes) {
          if (trigger.properties.x !== undefined) {
            const vx = Number(trigger.properties.x);
            if (!Number.isNaN(vx)) this.animator.applyPropertyToNode(node, 'x', vx);
          }
          if (trigger.properties.y !== undefined) {
            const vy = Number(trigger.properties.y);
            if (!Number.isNaN(vy)) this.animator.applyPropertyToNode(node, 'y', vy);
          }
        }
      } else if (trigger.action === 'rot') {
        for (const node of targetNodes) {
          if (trigger.properties.rotation !== undefined) {
            const deg = Number(trigger.properties.rotation);
            if (!Number.isNaN(deg)) {
              const rad = (deg * Math.PI) / 180;
              this.animator.applyPropertyToNode(node, 'rotation', rad);
            }
          }
        }
      } else if (trigger.action === 'scale') {
        for (const node of targetNodes) {
          const s = trigger.properties.scale !== undefined ? Number(trigger.properties.scale) : undefined;
          const sx = trigger.properties.scaleX !== undefined ? Number(trigger.properties.scaleX) : s;
          const sy = trigger.properties.scaleY !== undefined ? Number(trigger.properties.scaleY) : s;
          if (sx !== undefined && !Number.isNaN(sx)) this.animator.applyPropertyToNode(node, 'scaleX', sx);
          if (sy !== undefined && !Number.isNaN(sy)) this.animator.applyPropertyToNode(node, 'scaleY', sy);
        }
      } else if (trigger.action === 'skew') {
        for (const node of targetNodes) {
          if (trigger.properties.skewX !== undefined) {
            const sx = Number(trigger.properties.skewX);
            if (!Number.isNaN(sx)) this.animator.applyPropertyToNode(node, 'skewX', sx);
          }
          if (trigger.properties.skewY !== undefined) {
            const sy = Number(trigger.properties.skewY);
            if (!Number.isNaN(sy)) this.animator.applyPropertyToNode(node, 'skewY', sy);
          }
        }
      } else if (trigger.action === 'color' || trigger.action === 'appearance') {
        for (const node of targetNodes) {
          if (trigger.properties.opacity !== undefined) {
            const op = Number(trigger.properties.opacity);
            if (!Number.isNaN(op)) node.container.alpha = op;
          }
          if (trigger.properties.color !== undefined) {
            const hex = String(trigger.properties.color);
            const numColor = parseInt(hex.replace('#', ''), 16);
            if (!Number.isNaN(numColor)) {
              (node.container as unknown as { tint?: number }).tint = numColor;
            }
          }
          if (trigger.properties.visible !== undefined) {
            node.container.visible = Boolean(trigger.properties.visible);
          }
        }
      }
    }

    this.nextTriggerIndex = low;
  }

  /**
   * Fires a trigger immediately by its ID (e.g. triggered by interactive gameplay).
   */
  public fireTrigger(triggerId: string, currentTime = 0): void {
    const trigger = this.triggers.find((t) => t.id === triggerId);
    if (trigger) {
      this.dispatch(trigger, currentTime);
    }
  }

  /**
   * Dispatches a single trigger, applying transformations or routing visual effects.
   */
  public dispatch(trigger: TriggerData, currentTime: number): void {
    const targetNodes = this.resolveTargets(trigger.targetId);

    switch (trigger.action) {
      case 'pos': {
        for (const node of targetNodes) {
          const propsToAnimate = ['x', 'y'] as const;
          for (const prop of propsToAnimate) {
            if (trigger.properties[prop] !== undefined) {
              const targetVal = Number(trigger.properties[prop]);
              if (Number.isNaN(targetVal)) continue;
              if (trigger.duration > 0) {
                const currentVal = this.animator.getNodeProperty(node.id, prop);
                this.animator.addTransition(
                  node.id,
                  prop,
                  currentVal,
                  targetVal,
                  trigger.duration,
                  trigger.easing ?? 'linear',
                  currentTime
                );
              } else {
                this.animator.applyPropertyToNode(node, prop, targetVal);
              }
            }
          }
        }
        break;
      }

      case 'rot': {
        for (const node of targetNodes) {
          if (trigger.properties.rotation !== undefined) {
            const deg = Number(trigger.properties.rotation);
            if (Number.isNaN(deg)) continue;
            const targetRad = (deg * Math.PI) / 180;
            if (trigger.duration > 0) {
              const currentVal = this.animator.getNodeProperty(node.id, 'rotation');
              this.animator.addTransition(
                node.id,
                'rotation',
                currentVal,
                targetRad,
                trigger.duration,
                trigger.easing ?? 'linear',
                currentTime
              );
            } else {
              this.animator.applyPropertyToNode(node, 'rotation', targetRad);
            }
          }
        }
        break;
      }

      case 'scale': {
        for (const node of targetNodes) {
          const s = trigger.properties.scale !== undefined ? Number(trigger.properties.scale) : undefined;
          const sx = trigger.properties.scaleX !== undefined ? Number(trigger.properties.scaleX) : s;
          const sy = trigger.properties.scaleY !== undefined ? Number(trigger.properties.scaleY) : s;
          const targets = [
            { prop: 'scaleX', val: sx },
            { prop: 'scaleY', val: sy },
          ];
          for (const { prop, val } of targets) {
            if (val !== undefined && !Number.isNaN(val)) {
              if (trigger.duration > 0) {
                const currentVal = this.animator.getNodeProperty(node.id, prop);
                this.animator.addTransition(
                  node.id,
                  prop,
                  currentVal,
                  val,
                  trigger.duration,
                  trigger.easing ?? 'linear',
                  currentTime
                );
              } else {
                this.animator.applyPropertyToNode(node, prop, val);
              }
            }
          }
        }
        break;
      }

      case 'skew': {
        for (const node of targetNodes) {
          const targets = [
            {
              prop: 'skewX',
              val: trigger.properties.skewX !== undefined ? Number(trigger.properties.skewX) : undefined,
            },
            {
              prop: 'skewY',
              val: trigger.properties.skewY !== undefined ? Number(trigger.properties.skewY) : undefined,
            },
          ];
          for (const { prop, val } of targets) {
            if (val !== undefined && !Number.isNaN(val)) {
              if (trigger.duration > 0) {
                const currentVal = this.animator.getNodeProperty(node.id, prop);
                this.animator.addTransition(
                  node.id,
                  prop,
                  currentVal,
                  val,
                  trigger.duration,
                  trigger.easing ?? 'linear',
                  currentTime
                );
              } else {
                this.animator.applyPropertyToNode(node, prop, val);
              }
            }
          }
        }
        break;
      }

      case 'transform': {
        for (const node of targetNodes) {
          for (const [prop, val] of Object.entries(trigger.properties)) {
            const targetVal = Number(val);
            if (Number.isNaN(targetVal)) continue;

            if (trigger.duration > 0) {
              const currentVal = this.animator.getNodeProperty(node.id, prop);
              this.animator.addTransition(
                node.id,
                prop,
                currentVal,
                targetVal,
                trigger.duration,
                trigger.easing ?? 'linear',
                currentTime
              );
            } else {
              this.animator.applyPropertyToNode(node, prop, targetVal);
            }
          }
        }
        break;
      }

      case 'color':
      case 'appearance': {
        for (const node of targetNodes) {
          if (trigger.properties.opacity !== undefined) {
            const targetOpacity = Number(trigger.properties.opacity);
            if (!Number.isNaN(targetOpacity)) {
              if (trigger.duration > 0) {
                const currentOpacity = node.container.alpha;
                this.animator.addTransition(
                  node.id,
                  'opacity',
                  currentOpacity,
                  targetOpacity,
                  trigger.duration,
                  trigger.easing ?? 'linear',
                  currentTime
                );
              } else {
                node.container.alpha = targetOpacity;
              }
            }
          }

          if (trigger.properties.color !== undefined) {
            const hex = String(trigger.properties.color);
            const numColor = parseInt(hex.replace('#', ''), 16);
            if (!Number.isNaN(numColor)) {
              (node.container as unknown as { tint?: number }).tint = numColor;
            }
          }

          if (trigger.properties.visible !== undefined) {
            node.container.visible = Boolean(trigger.properties.visible);
          }

          if (trigger.properties.blendMode !== undefined) {
            (node.container as unknown as { blendMode: unknown }).blendMode =
              trigger.properties.blendMode;
          }
        }
        break;
      }

      case 'pulse': {
        this.onEffect?.('reactivePulse', trigger.targetId, trigger.properties);
        break;
      }

      case 'effect': {
        const effectType = (trigger.properties.effectType as EffectType) ?? 'reactivePulse';
        this.onEffect?.(effectType, trigger.targetId, trigger.properties);
        break;
      }
    }

    this.onTrigger?.(trigger);
  }

  /**
   * Resolves targetId to one or more SceneNodes (by target numerical ID, direct ID/name, group, or all).
   */
  private resolveTargets(targetId: string | number): SceneNode[] {
    if (targetId === 'all') {
      return this.sceneGraph.getAllNodes();
    }

    // 1. Resolve all nodes sharing this numerical targetId
    const matchedByTargetId = this.sceneGraph.getNodesByTargetId(targetId);
    if (matchedByTargetId.length > 0) {
      return matchedByTargetId;
    }

    // 2. Fallback: single node by uid/name/id string
    const singleNode = this.sceneGraph.getNode(String(targetId));
    if (singleNode) {
      return [singleNode];
    }

    // 3. Fallback: group property
    const groupNodes = this.sceneGraph.getNodesByGroup(targetId);
    if (groupNodes.length > 0) {
      return groupNodes;
    }

    return [];
  }

  /**
   * Resets trigger dispatch pointer to the beginning.
   */
  public reset(): void {
    this.nextTriggerIndex = 0;
    this.animator.clearTransitions();
  }
}
