import type { LevelData, PadConfig, PadEvent, SceneNodeData, SceneNodeLifespan, TimingWindows, TriggerData, VisualEffect } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedLevel?: LevelData;
}

const DEFAULT_WINDOWS: TimingWindows = {
  perfect: 0.045,
  good: 0.090,
  miss: 0.150,
};

/**
 * LevelValidator — schema validation, integrity checking, and sanitization for LevelData.
 *
 * Implements Phase 5 (Content Pipeline & Asset Management):
 *  - Validates format versions, metadata, song references, pad bindings, and timing windows.
 *  - Checks chronological ordering of events and cross-references event pad IDs with pad definitions.
 *  - Sanitizes incomplete, legacy, or slightly malformed level definitions into rock-solid LevelData objects.
 */
export class LevelValidator {
  /**
   * Performs deep validation of unknown data against the LevelData contract.
   */
  public static validate(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: ['Level data must be a valid non-null JSON object.'],
        warnings: [],
      };
    }

    const raw = data as Record<string, unknown>;

    // 1. formatVersion
    if (typeof raw.formatVersion !== 'number' || raw.formatVersion < 1) {
      errors.push('Missing or invalid "formatVersion": must be a positive integer.');
    } else if (raw.formatVersion > 1) {
      warnings.push(`Level formatVersion (${raw.formatVersion}) is newer than runtime version (1).`);
    }

    // 2. metadata
    if (!raw.metadata || typeof raw.metadata !== 'object') {
      errors.push('Missing "metadata" object.');
    } else {
      const meta = raw.metadata as Record<string, unknown>;
      if (!meta.id || typeof meta.id !== 'string') {
        errors.push('Missing or invalid "metadata.id": must be a non-empty string.');
      }
      if (!meta.name || typeof meta.name !== 'string') {
        errors.push('Missing or invalid "metadata.name": must be a non-empty string.');
      }
      if (!meta.difficulty || typeof meta.difficulty !== 'string') {
        warnings.push('Missing or non-string "metadata.difficulty": will default to "Normal".');
      }
      if (typeof meta.author !== 'string') {
        warnings.push('Missing "metadata.author": will default to "Unknown".');
      }
    }

    // 3. song
    if (!raw.song || typeof raw.song !== 'object') {
      errors.push('Missing "song" object.');
    } else {
      const song = raw.song as Record<string, unknown>;
      if (!song.id || typeof song.id !== 'string') {
        errors.push('Missing or invalid "song.id": must be a non-empty string.');
      }
      if (typeof song.bpm !== 'number' || song.bpm <= 0 || song.bpm > 1000) {
        errors.push(`Invalid "song.bpm" (${song.bpm}): must be a number between 1 and 1000.`);
      }
      if (typeof song.duration !== 'number' || song.duration < 0) {
        warnings.push(`Invalid "song.duration": expected non-negative number, got ${song.duration}.`);
      }
    }

    // 4. pads
    const padIds = new Set<string>();
    if (!Array.isArray(raw.pads) || raw.pads.length === 0) {
      errors.push('Missing or empty "pads" array: level must declare at least one pad.');
    } else {
      raw.pads.forEach((padItem: unknown, index: number) => {
        if (!padItem || typeof padItem !== 'object') {
          errors.push(`Pad at index ${index} is not a valid object.`);
          return;
        }
        const pad = padItem as Record<string, unknown>;
        if (!pad.id || typeof pad.id !== 'string') {
          errors.push(`Pad at index ${index} is missing a valid string "id".`);
        } else {
          if (padIds.has(pad.id)) {
            warnings.push(`Duplicate pad id "${pad.id}" detected in pads array.`);
          }
          padIds.add(pad.id);
        }
        if (!pad.label || typeof pad.label !== 'string') {
          warnings.push(`Pad "${pad.id ?? index}" is missing a string "label".`);
        }
      });
    }

    // 5. events
    let isChronological = true;
    let lastTime = -1;
    if (!Array.isArray(raw.events)) {
      errors.push('Missing "events" array.');
    } else {
      raw.events.forEach((evItem: unknown, index: number) => {
        if (!evItem || typeof evItem !== 'object') {
          errors.push(`Event at index ${index} is not a valid object.`);
          return;
        }
        const ev = evItem as Record<string, unknown>;
        if (!ev.id || typeof ev.id !== 'string') {
          errors.push(`Event at index ${index} is missing a valid string "id".`);
        }
        if (typeof ev.targetTime !== 'number' || isNaN(ev.targetTime) || ev.targetTime < 0) {
          errors.push(`Event "${ev.id ?? index}" has invalid "targetTime": must be a non-negative number.`);
        } else {
          if (ev.targetTime < lastTime) {
            isChronological = false;
          }
          lastTime = ev.targetTime;
        }

        if (typeof ev.padId !== 'string' || (padIds.size > 0 && !padIds.has(ev.padId))) {
          errors.push(`Event "${ev.id ?? index}" references unknown padId "${ev.padId}".`);
        }

        const validBehaviors = ['tap', 'hold', 'loop', 'trigger'];
        if (!validBehaviors.includes(ev.behavior as string)) {
          errors.push(
            `Event "${ev.id ?? index}" has invalid behavior "${ev.behavior}". Expected one of: ${validBehaviors.join(', ')}.`
          );
        } else if ((ev.behavior === 'hold' || ev.behavior === 'loop') && (typeof ev.duration !== 'number' || ev.duration <= 0)) {
          warnings.push(`Event "${ev.id ?? index}" (${ev.behavior}) should have a positive duration, got ${ev.duration}.`);
        }
      });

      if (!isChronological) {
        warnings.push('Events are not sorted chronologically by targetTime; they will be auto-sorted.');
      }
    }

    // 6. timing
    if (raw.timing && typeof raw.timing === 'object') {
      const timing = raw.timing as Record<string, unknown>;
      if (typeof timing.bpm === 'number' && timing.bpm <= 0) {
        errors.push('Invalid "timing.bpm": must be greater than 0.');
      }
      if (timing.windows && typeof timing.windows === 'object') {
        const w = timing.windows as Record<string, unknown>;
        const perf = Number(w.perfect);
        const good = Number(w.good);
        const miss = Number(w.miss);
        if (isNaN(perf) || isNaN(good) || isNaN(miss) || !(perf > 0 && perf < good && good < miss)) {
          warnings.push('Timing windows are irregular or missing; defaulting to standard windows.');
        }
      }
    }

    // 7. visual
    if (raw.visual && typeof raw.visual === 'object') {
      const visual = raw.visual as Record<string, unknown>;
      if (visual.nodes && !Array.isArray(visual.nodes)) {
        errors.push('"visual.nodes" must be an array.');
      }
      if (visual.animations && !Array.isArray(visual.animations)) {
        errors.push('"visual.animations" must be an array.');
      }
      if (visual.triggers && !Array.isArray(visual.triggers)) {
        errors.push('"visual.triggers" must be an array.');
      }
      if (visual.audioMappings && !Array.isArray(visual.audioMappings)) {
        errors.push('"visual.audioMappings" must be an array.');
      }
    }

    const valid = errors.length === 0;
    const sanitizedLevel = valid ? LevelValidator.sanitize(raw) : undefined;

    return {
      valid,
      errors,
      warnings,
      sanitizedLevel,
    };
  }

  /**
   * Takes raw data and builds a clean, fully populated, type-safe LevelData object.
   */
  public static sanitize(raw: Record<string, unknown>): LevelData {
    const metaRaw = (raw.metadata || {}) as Record<string, unknown>;
    const songRaw = (raw.song || {}) as Record<string, unknown>;
    const timingRaw = (raw.timing || {}) as Record<string, unknown>;
    const visualRaw = (raw.visual || {}) as Record<string, unknown>;

    const bpm = Number(timingRaw.bpm || songRaw.bpm || 120);

    // Clean and validate timing windows
    const rawWindows = (timingRaw.windows || {}) as Record<string, unknown>;
    const perfect = Number(rawWindows.perfect) || DEFAULT_WINDOWS.perfect;
    const good = Number(rawWindows.good) || DEFAULT_WINDOWS.good;
    const miss = Number(rawWindows.miss) || DEFAULT_WINDOWS.miss;

    const windows: TimingWindows =
      perfect > 0 && perfect < good && good < miss
        ? { perfect, good, miss }
        : { ...DEFAULT_WINDOWS };

    // Clean pads
    const pads: PadConfig[] = Array.isArray(raw.pads)
      ? raw.pads.map((p, idx) => {
          const pad = p as Record<string, unknown>;
          return {
            id: String(pad.id || `pad_${idx}`),
            label: String(pad.label || `Pad ${idx + 1}`),
            color: String(pad.color || '#00e5ff'),
            keyHint: pad.keyHint ? String(pad.keyHint) : undefined,
            role: (pad.role as PadConfig['role']) || undefined,
            audioChannel: (pad.audioChannel as PadConfig['audioChannel']) || undefined,
          };
        })
      : [];

    // Clean events and sort chronologically
    const events: PadEvent[] = Array.isArray(raw.events)
      ? (raw.events as PadEvent[])
          .map((ev, idx) => ({
            id: String(ev.id || `event_${idx}`),
            targetTime: Number(ev.targetTime) || 0,
            padId: String(ev.padId),
            behavior: (ev.behavior as PadEvent['behavior']) || 'tap',
            duration: typeof ev.duration === 'number' ? ev.duration : undefined,
            triggerId: ev.triggerId ? String(ev.triggerId) : undefined,
            quantized: Boolean(ev.quantized),
          }))
          .sort((a, b) => a.targetTime - b.targetTime)
      : [];

    // Clean visual nodes ensuring immutable uid, layerId, and optional lifespan
    const rawNodes = Array.isArray(visualRaw.nodes) ? visualRaw.nodes : [];
    const nodes: SceneNodeData[] = rawNodes.map((n, idx) => {
      const node = n as Record<string, unknown>;
      const uid = String(node.uid || node.id || `node_${idx}_${Date.now()}`);

      // Sanitize layerId ('sceneBack' | 'sceneFront')
      const rawLayerId = node.layerId;
      const layerId: 'sceneBack' | 'sceneFront' =
        rawLayerId === 'sceneFront' ? 'sceneFront' : 'sceneBack';

      // Sanitize transform and blendMode with readability safeguard for sceneFront
      const rawTransform = (node.transform as SceneNodeData['transform']) || { x: 960, y: 540 };
      const transform = { ...rawTransform };
      let blendMode: SceneNodeData['blendMode'] =
        (node.blendMode as SceneNodeData['blendMode']) || 'normal';

      if (layerId === 'sceneFront') {
        // Enforce readability safeguard:
        // 1. Cap opacity to max 0.35 so gameplay elements behind are fully legible
        if (typeof transform.opacity === 'number') {
          transform.opacity = Math.min(0.35, Math.max(0, transform.opacity));
        } else {
          transform.opacity = 0.35;
        }
        // 2. Restrict blendMode to additive/screen modes
        if (blendMode !== 'add' && blendMode !== 'screen') {
          blendMode = 'add';
        }
      }

      // Sanitize optional lifespan: startTime >= 0, duration > 0, fadeInMs, fadeOutMs
      let lifespan: SceneNodeLifespan | undefined;
      if (node.lifespan && typeof node.lifespan === 'object') {
        const ls = node.lifespan as Record<string, unknown>;
        const startTime = Math.max(0, Number(ls.startTime) || 0);
        const duration = Math.max(0.01, Number(ls.duration) || 1);
        const fadeInMs = ls.fadeInMs !== undefined ? Math.max(0, Number(ls.fadeInMs) || 0) : undefined;
        const fadeOutMs = ls.fadeOutMs !== undefined ? Math.max(0, Number(ls.fadeOutMs) || 0) : undefined;
        lifespan = {
          startTime,
          duration,
          fadeInMs,
          fadeOutMs,
        };
      }

      // Sanitize timeline organizational layer (defaults to 1)
      const layer =
        typeof node.layer === 'number' && Number.isFinite(node.layer) && node.layer >= 1
          ? Math.floor(node.layer)
          : 1;

      // Sanitize subLane (0 to 7)
      const subLane =
        typeof node.subLane === 'number' && Number.isFinite(node.subLane) && node.subLane >= 0
          ? Math.max(0, Math.min(7, Math.floor(node.subLane)))
          : undefined;

      return {
        uid,
        name: typeof node.name === 'string' ? node.name : `node-${idx + 1}`,
        targetId:
          typeof node.targetId === 'number'
            ? node.targetId
            : typeof node.id === 'number'
              ? node.id
              : null,
        id: typeof node.id === 'number' ? node.id : null,
        type: String(node.type || 'rectangle'),
        parentId: node.parentId ? String(node.parentId) : undefined,
        blendMode,
        visible: node.visible !== false,
        layerId,
        layer,
        subLane,
        lifespan,
        transform,
        properties: (node.properties as Record<string, unknown>) || {},
      };
    });

    const levelId = String(metaRaw.id || 'level-001');
    const songId = String(raw.songId || songRaw.id || 'song-001');

    const rawTriggers = Array.isArray(visualRaw.triggers) ? visualRaw.triggers : [];
    const triggers: TriggerData[] = rawTriggers.map((t, idx) => {
      const trig = t as Record<string, unknown>;
      const layer =
        typeof trig.layer === 'number' && Number.isFinite(trig.layer) && trig.layer >= 1
          ? Math.floor(trig.layer)
          : 1;
      // Sanitize subLane (0 to 7)
      const subLane =
        typeof trig.subLane === 'number' && Number.isFinite(trig.subLane) && trig.subLane >= 0
          ? Math.max(0, Math.min(7, Math.floor(trig.subLane)))
          : undefined;
      return {
        id: String(trig.id || `trigger_${idx}_${Date.now()}`),
        time: Math.max(0, Number(trig.time) || 0),
        action: (trig.action as TriggerData['action']) || 'transform',
        targetId:
          typeof trig.targetId === 'number' || typeof trig.targetId === 'string'
            ? trig.targetId
            : 'all',
        easing: trig.easing as TriggerData['easing'],
        duration: Math.max(0, Number(trig.duration) || 0),
        properties: (trig.properties as Record<string, number | string | boolean>) || {},
        layer,
        subLane,
      };
    });

    const rawEffects = Array.isArray(visualRaw.effects) ? visualRaw.effects : [];
    const effects: VisualEffect[] = rawEffects.map((e, idx) => {
      const eff = e as Record<string, unknown>;
      const scope = eff.scope === 'object' || eff.scope === 'region' ? eff.scope : 'global';
      return {
        id: String(eff.id || `effect_${idx}`),
        type: String(eff.type || 'bloom'),
        scope,
        enabled: eff.enabled !== false,
        intensity: typeof eff.intensity === 'number' ? Math.max(0, Math.min(5, eff.intensity)) : 1.0,
        targetNodeId: eff.targetNodeId ? String(eff.targetNodeId) : undefined,
        region:
          eff.region && typeof eff.region === 'object'
            ? (eff.region as { x: number; y: number; width: number; height: number })
            : undefined,
        parameters: (eff.parameters as Record<string, number | string | boolean>) || {},
      };
    });

    return {
      formatVersion: Number(raw.formatVersion) || 1,
      metadata: {
        id: levelId,
        name: String(metaRaw.name || 'Untitled Level'),
        difficulty: String(metaRaw.difficulty || 'Normal'),
        author: String(metaRaw.author || 'Unknown'),
      },
      songId,
      song: {
        id: songId,
        title: String(songRaw.title || 'Untitled Track'),
        artist: String(songRaw.artist || 'Unknown Artist'),
        bpm,
        offset: Number(songRaw.offset) || 0,
        duration: Number(songRaw.duration) || 0,
        url: songRaw.url ? String(songRaw.url) : undefined,
        audioUrl: songRaw.audioUrl ? String(songRaw.audioUrl) : undefined,
        licenseInfo: songRaw.licenseInfo ? String(songRaw.licenseInfo) : undefined,
      },
      pads,
      events,
      timing: {
        bpm,
        offset: Number(timingRaw.offset) || 0,
        windows,
      },
      visual: {
        nodes,
        animations: Array.isArray(visualRaw.animations) ? (visualRaw.animations as LevelData['visual']['animations']) : [],
        triggers,
        audioMappings: Array.isArray(visualRaw.audioMappings)
          ? (visualRaw.audioMappings as LevelData['visual']['audioMappings'])
          : [],
        settings: visualRaw.settings as LevelData['visual']['settings'],
        effects,
      },
    };
  }
}
