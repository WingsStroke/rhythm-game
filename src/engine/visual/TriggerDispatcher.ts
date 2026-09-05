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
    targetId: string,
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
   * Re-aligns the trigger pointer after seeking in the timeline.
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

      case 'effect': {
        const effectType = (trigger.properties.effectType as EffectType) ?? 'reactivePulse';
        this.onEffect?.(effectType, trigger.targetId, trigger.properties);
        break;
      }
    }

    this.onTrigger?.(trigger);
  }

  /**
   * Resolves targetId to one or more SceneNodes (by direct ID, group, or all).
   */
  private resolveTargets(targetId: string): SceneNode[] {
    if (targetId === 'all') {
      return this.sceneGraph.getAllNodes();
    }

    const singleNode = this.sceneGraph.getNode(targetId);
    if (singleNode) {
      return [singleNode];
    }

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
