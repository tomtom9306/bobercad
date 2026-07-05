import { distancePointToSegment, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { formatNumber } from "../../engine/core/format.mjs";
import { sketchEdges } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { plateBendGeometry } from "../scene/plate-bend-geometry.mjs";
import { handleEscapeReset } from "./keyboard-shortcuts.mjs";

const TARGET_HOVER_TOLERANCE_PX = 18;
const TARGET_HOVER_COLOR = "#f59e0b";
const TARGET_HOVER_LINE_WIDTH = 6;
const GHOST_BEND_COLOR = "#7dd3fc";
const GHOST_BEND_EDGE_COLOR = "#0284c7";
const GHOST_BEND_OPACITY = 0.42;
const DEFAULT_BEND_ANGLE = 90;
const DEFAULT_BEND_K_FACTOR = 0.33;
const DEFAULT_FLANGE_LENGTH = 80;
const MIN_INTERACTIVE_FLANGE_LENGTH = 1;

function bendIdForTarget(target) {
  const raw = target.parentBendId
    ? `${target.parentBendId}_${target.parentEdge || "outer"}`
    : target.edgeId;
  return `bend_${raw.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function bendPatchForTarget(target) {
  if (target.parentBendId) {
    return {
      id: bendIdForTarget(target),
      parentBendId: target.parentBendId,
      parentEdge: target.parentEdge || "outer"
    };
  }
  return {
    id: bendIdForTarget(target),
    edgeId: target.edgeId
  };
}

function screenLineParameter(point, start, end) {
  const abx = end.x - start.x;
  const aby = end.y - start.y;
  const lengthSq = abx * abx + aby * aby;
  return lengthSq <= 0.000001
    ? 0
    : Math.min(1, Math.max(0, ((point.x - start.x) * abx + (point.y - start.y) * aby) / lengthSq));
}

function screenLineDistance(point, start, end) {
  const t = screenLineParameter(point, start, end);
  return Math.hypot(point.x - (start.x + (end.x - start.x) * t), point.y - (start.y + (end.y - start.y) * t));
}

function screenLineSide(point, start, end) {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function sketchEdgeMap(plate) {
  return new Map(sketchEdges(plate?.sketch).map((edge) => [edge.id, edge]));
}

function isBendableTarget(plate, target, edgeMap = sketchEdgeMap(plate)) {
  if (target?.parentBendId) return true;
  const edge = target?.edgeId ? edgeMap.get(target.edgeId) : null;
  return Boolean(edge && edge.kind !== "circular-arc");
}

function targetLabel(plate, target) {
  if (!target) return "Hover a bendable edge";
  if (target.parentBendId) return `${target.parentBendId} / ${target.parentEdge || "outer"}`;
  const edges = sketchEdges(plate?.sketch);
  const index = edges.findIndex((edge) => edge.id === target.edgeId);
  return index >= 0 ? `${index + 1}. ${target.edgeId}` : target.edgeId || target.id || "-";
}

function defaultBendRadius(plate) {
  return Math.max(plate?.thickness || 8, 8);
}

function boundedNumber(value, fallback, { min = -Infinity, max = Infinity, minExclusive = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (minExclusive ? numeric <= min : numeric < min) return fallback;
  if (numeric > max) return fallback;
  return numeric;
}

function defaultBendSettings() {
  return {
    direction: "up",
    angle: DEFAULT_BEND_ANGLE,
    radius: null,
    kFactor: DEFAULT_BEND_K_FACTOR,
    flangeLength: DEFAULT_FLANGE_LENGTH
  };
}

function normalizeBendSettings(settings = {}) {
  const base = { ...defaultBendSettings(), ...(settings || {}) };
  const radius = base.radius === null || base.radius === "" || base.radius === undefined
    ? null
    : boundedNumber(base.radius, null, { min: 0 });
  return {
    direction: base.direction === "down" ? "down" : "up",
    angle: boundedNumber(base.angle, DEFAULT_BEND_ANGLE, { min: 0, minExclusive: true, max: 180 }),
    radius,
    kFactor: boundedNumber(base.kFactor, DEFAULT_BEND_K_FACTOR, { min: 0, max: 1 }),
    flangeLength: boundedNumber(base.flangeLength, DEFAULT_FLANGE_LENGTH, { min: 0, minExclusive: true })
  };
}

function resolvedBendRadius(plate, settings) {
  return finiteNumber(settings.radius) ? settings.radius : defaultBendRadius(plate);
}

function bendAngleRadians(bend) {
  return Math.abs(finiteNumberOr(bend?.angle, DEFAULT_BEND_ANGLE)) * Math.PI / 180;
}

function bendOutwardLimitOffset(radius, angle) {
  const bendRadius = Math.max(0, finiteNumberOr(radius, 0));
  const bendAngle = Math.max(0, finiteNumberOr(angle, 0));
  if (bendRadius <= 1e-6 || bendAngle <= 1e-6) return 0;
  if (bendAngle >= Math.PI / 2) return bendRadius;
  return bendRadius * Math.sin(bendAngle);
}

function bendCurveRadiusForTarget(radius, thickness, target) {
  const bendRadius = Math.max(0, finiteNumberOr(radius, 0));
  if (target?.edgeRole === "sketch") return bendRadius;
  return Math.max(0, bendRadius - Math.max(0, finiteNumberOr(thickness, 0)) / 2);
}

function bendPreviewFromSettings(plate, settings = {}, direction = null) {
  const normalized = normalizeBendSettings(settings);
  const bendRadius = resolvedBendRadius(plate, normalized);
  return {
    direction: direction === "down" || direction === "up" ? direction : normalized.direction,
    angle: normalized.angle,
    radius: bendRadius,
    kFactor: normalized.kFactor,
    flangeLength: normalized.flangeLength
  };
}

function defaultBendPatch(plate, target, direction, settings = {}) {
  return {
    ...bendPatchForTarget(target),
    ...bendPreviewFromSettings(plate, settings, direction)
  };
}

function previewPlateWithBend(plate, bend) {
  const existingBends = arrayValues(plate?.fabrication?.bends).filter((item) => item.id !== bend.id);
  return {
    ...plate,
    display: {
      ...(plate.display || {}),
      color: GHOST_BEND_COLOR,
      edgeColor: GHOST_BEND_EDGE_COLOR,
      opacity: GHOST_BEND_OPACITY,
      transparent: true
    },
    fabrication: {
      ...(plate.fabrication || {}),
      bends: [...existingBends, bend]
    }
  };
}

function previewBendLine(plate, target, bend) {
  if (!target?.start || !target?.end || !target?.outward) return null;
  const angle = bendAngleRadians(bend);
  const radius = bendCurveRadiusForTarget(bend?.radius, plate?.thickness, target);
  const inset = bendOutwardLimitOffset(radius, angle);
  return {
    start: v.add(target.start, v.mul(target.outward, -inset)),
    end: v.add(target.end, v.mul(target.outward, -inset))
  };
}

function nearestBendTarget(plate, worldPoint, options = {}) {
  const geometry = plateBendGeometry(plate);
  const edgeMap = sketchEdgeMap(plate);
  let best = null;
  for (const target of arrayValues(geometry.targetEdges)) {
    if (!isBendableTarget(plate, target, edgeMap)) continue;
    let distance = distancePointToSegment(worldPoint, target.start, target.end);
    let screenDistance = null;
    if (options.screen && typeof options.projectPoint === "function") {
      const start = options.projectPoint(target.start);
      const end = options.projectPoint(target.end);
      if (start && end) {
        screenDistance = screenLineDistance(options.screen, start, end);
        distance = screenDistance;
      }
    }
    if (!best || distance < best.distance) best = { target, distance, screenDistance };
  }
  if (!best) return null;
  if (finiteNumber(best.screenDistance)) {
    return best.screenDistance <= TARGET_HOVER_TOLERANCE_PX ? best : null;
  }
  const screenScale = typeof options.screenScale === "function" ? options.screenScale() : null;
  if (finiteNumber(screenScale) && screenScale > 1e-9) {
    return best.distance <= TARGET_HOVER_TOLERANCE_PX / screenScale ? best : null;
  }
  return best;
}

export function createPlateBendController({
  viewer,
  api,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange,
  onToolStateChange
}) {
  const state = {
    active: false,
    hover: null,
    pending: null,
    settings: defaultBendSettings()
  };

  function currentSettings() {
    return normalizeBendSettings(state.settings);
  }

  function currentHoverBend() {
    if (state.pending?.plateId && state.pending?.target) {
      return defaultBendPatch(
        api.object(state.pending.plateId),
        state.pending.target,
        currentSettings().direction,
        currentSettings()
      );
    }
    if (!state.hover?.plateId || !state.hover?.target) return bendPreviewFromSettings(null, currentSettings());
    return defaultBendPatch(
      api.object(state.hover.plateId),
      state.hover.target,
      state.hover.direction,
      currentSettings()
    );
  }

  function status() {
    if (!state.active) return "No modeling command";
    if (state.pending?.target) {
      const bend = currentHoverBend();
      const direction = bend.direction === "down" ? "down" : "up";
      return `Bend: move mouse to set ${formatNumber(bend.flangeLength, { digits: 0 })} mm ${direction}, click to place`;
    }
    if (!state.hover?.target) return "Bend: set properties, then hover a plate edge";
    const bend = currentHoverBend();
    const direction = bend.direction === "down" ? "down" : "up";
    return `Bend: click ${state.hover.targetLabel} - ${direction}, ${formatNumber(bend.angle, { digits: 0 })} deg`;
  }

  function clearPreview() {
    onPreviewChange?.(null);
  }

  function clearHover(options = {}) {
    if (!state.hover && !options.force) return;
    state.hover = null;
    onOverlayChange?.(null);
    onToolStateChange?.();
  }

  function clearPending(options = {}) {
    if (!state.pending && !options.force) return;
    state.pending = null;
    clearPreview();
    onToolStateChange?.();
  }

  function reset() {
    clearHover({ force: true });
    clearPending({ force: true });
    state.active = false;
    onStatusChange?.("No modeling command");
    onToolStateChange?.();
  }

  function start() {
    state.active = true;
    clearHover({ force: true });
    onStatusChange?.(status());
    onToolStateChange?.();
  }

  function preciseHitPoint(pointer, objectId) {
    if (v.isVec3(pointer?.hit?.point)) return pointer.hit.point;
    const hit = viewer?.pickScene?.(pointer?.screen?.x, pointer?.screen?.y, {
      forceCpu: true,
      includeTransparent: false,
      objectIds: [objectId]
    });
    return v.isVec3(hit?.point) ? hit.point : null;
  }

  function pointerDirection(pointer) {
    const base = currentSettings().direction;
    if (pointer?.event?.altKey || pointer?.event?.shiftKey) return base === "down" ? "up" : "down";
    return base;
  }

  function placementLine(plate, target, bend) {
    return previewBendLine(plate, target, bend) || target;
  }

  function placementDirection(pointer, plate, target, fallback, bend = null) {
    const line = placementLine(plate, target, bend);
    const start = typeof viewer?.projectPoint === "function" ? viewer.projectPoint(line.start) : null;
    const end = typeof viewer?.projectPoint === "function" ? viewer.projectPoint(line.end) : null;
    let direction = fallback === "down" ? "down" : "up";
    if (pointer?.screen && start && end) {
      const side = screenLineSide(pointer.screen, start, end);
      if (Math.abs(side) > 4) direction = side >= 0 ? "up" : "down";
    }
    if (pointer?.event?.altKey || pointer?.event?.shiftKey) return direction === "down" ? "up" : "down";
    return direction;
  }

  function placementFlangeLength(pointer, plate, target, fallback, bend = null) {
    const line = placementLine(plate, target, bend);
    const start = typeof viewer?.projectPoint === "function" ? viewer.projectPoint(line.start) : null;
    const end = typeof viewer?.projectPoint === "function" ? viewer.projectPoint(line.end) : null;
    if (!pointer?.screen || !start || !end) return fallback;
    const screenDistance = screenLineDistance(pointer.screen, start, end);
    const screenScale = typeof viewer?.screenScale === "function" ? viewer.screenScale() : null;
    const worldDistance = finiteNumber(screenScale) && screenScale > 1e-9 ? screenDistance / screenScale : screenDistance;
    if (!finiteNumber(worldDistance) || worldDistance <= 1e-6) return fallback;
    return Math.max(MIN_INTERACTIVE_FLANGE_LENGTH, worldDistance);
  }

  function overlayForHover(plate, hover, bend = null) {
    if (!hover?.target) return null;
    const line = previewBendLine(plate, hover.target, bend || currentHoverBend()) || hover.target;
    const midpoint = v.mul(v.add(line.start, line.end), 0.5);
    return {
      suppressHighlightObjectIds: [plate.id],
      lines: [{
        points: [line.start, line.end],
        color: TARGET_HOVER_COLOR,
        lineWidth: TARGET_HOVER_LINE_WIDTH,
        kind: "plate-bend-target-preview",
        objectId: plate.id,
        edgeId: hover.target.edgeId || "",
        parentBendId: hover.target.parentBendId || "",
        parentEdge: hover.target.parentEdge || ""
      }],
      handles: [],
      labels: [{
        point: midpoint,
        text: "Bend",
        color: TARGET_HOVER_COLOR,
        className: "plate-bend-target-preview",
        screenOffsetPx: { x: 10, y: -14 }
      }]
    };
  }

  function renderPendingPreview() {
    if (!state.pending?.plateId || !state.pending?.target) {
      clearPreview();
      return;
    }
    const plate = api.object(state.pending.plateId);
    const bend = currentHoverBend();
    onPreviewChange?.({ plates: [previewPlateWithBend(plate, bend)] });
    onOverlayChange?.(overlayForHover(plate, {
      ...state.pending,
      targetLabel: state.pending.targetLabel || targetLabel(plate, state.pending.target)
    }, bend));
  }

  function hoverKey(plateId, target, direction) {
    return [plateId, target?.id || "", direction].join(":");
  }

  function updateHover(plate, nearest, pointer) {
    const direction = pointerDirection(pointer);
    const nextHover = {
      key: hoverKey(plate.id, nearest.target, direction),
      plateId: plate.id,
      target: nearest.target,
      direction,
      targetLabel: targetLabel(plate, nearest.target),
      distance: nearest.distance,
      screenDistance: nearest.screenDistance
    };
    if (state.hover?.key === nextHover.key) return;
    state.hover = nextHover;
    onOverlayChange?.(overlayForHover(
      plate,
      nextHover,
      defaultBendPatch(plate, nearest.target, direction, currentSettings())
    ));
    onStatusChange?.(status());
    onToolStateChange?.();
  }

  function beginPending(plate, nearest, pointer) {
    const direction = pointerDirection(pointer);
    state.pending = {
      key: hoverKey(plate.id, nearest.target, direction),
      plateId: plate.id,
      target: nearest.target,
      direction,
      targetLabel: targetLabel(plate, nearest.target),
      distance: nearest.distance,
      screenDistance: nearest.screenDistance
    };
    state.hover = null;
    state.settings = normalizeBendSettings({ ...state.settings, direction });
    renderPendingPreview();
    onStatusChange?.(status());
    onToolStateChange?.();
  }

  function updatePending(pointer) {
    if (!state.pending?.plateId || !state.pending?.target) return false;
    const plate = api.object(state.pending.plateId);
    const settings = currentSettings();
    const bend = defaultBendPatch(plate, state.pending.target, settings.direction, settings);
    const nextDirection = placementDirection(pointer, plate, state.pending.target, settings.direction, bend);
    const nextFlangeLength = placementFlangeLength(pointer, plate, state.pending.target, settings.flangeLength, bend);
    state.settings = normalizeBendSettings({
      ...state.settings,
      direction: nextDirection,
      flangeLength: nextFlangeLength
    });
    state.pending = {
      ...state.pending,
      direction: nextDirection,
      key: hoverKey(state.pending.plateId, state.pending.target, nextDirection)
    };
    renderPendingPreview();
    onStatusChange?.(status());
    onToolStateChange?.();
    return true;
  }

  function commitPending() {
    if (!state.pending?.plateId || !state.pending?.target) return false;
    const plate = api.object(state.pending.plateId);
    const result = api.upsertPlateBend(plate.id, defaultBendPatch(plate, state.pending.target, currentSettings().direction, currentSettings()));
    onProjectChange?.(result);
    reset();
    return true;
  }

  function pointerMove(pointer) {
    if (!state.active) return false;
    if (state.pending) return updatePending(pointer);
    const objectId = pointer?.hit?.face?.objectId;
    const collection = objectId ? api.project().objectIndex?.[objectId]?.collection : null;
    if (collection !== "plates") {
      clearHover();
      onStatusChange?.(status());
      return true;
    }
    const plate = api.object(objectId);
    const hitPoint = preciseHitPoint(pointer, objectId);
    if (!v.isVec3(hitPoint)) {
      clearHover();
      onStatusChange?.("Bend: move over a plate edge");
      return true;
    }
    const nearest = nearestBendTarget(plate, hitPoint, {
      screen: pointer?.screen,
      projectPoint: viewer?.projectPoint,
      screenScale: viewer?.screenScale
    });
    if (!nearest?.target) {
      clearHover();
      onStatusChange?.("Bend: move closer to a bendable edge");
      return true;
    }
    updateHover(plate, nearest, pointer);
    return true;
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    if (state.pending) {
      updatePending(pointer);
      return commitPending();
    }
    const objectId = pointer?.hit?.face?.objectId;
    const collection = objectId ? api.project().objectIndex?.[objectId]?.collection : null;
    if (collection !== "plates") {
      onStatusChange?.("Bend: pick a plate");
      return true;
    }
    const plate = api.object(objectId);
    const hitPoint = preciseHitPoint(pointer, objectId);
    if (!v.isVec3(hitPoint)) {
      onStatusChange?.("Bend: could not resolve point on plate");
      return true;
    }
    const nearest = nearestBendTarget(plate, hitPoint, {
      screen: pointer?.screen,
      projectPoint: viewer?.projectPoint,
      screenScale: viewer?.screenScale
    });
    if (!nearest?.target) {
      onStatusChange?.("Bend: pick a bendable plate edge");
      return true;
    }
    beginPending(plate, nearest, pointer);
    return true;
  }

  function setOption(option, value) {
    const key = String(option || "");
    if (!(key in defaultBendSettings())) return false;
    state.settings = normalizeBendSettings({ ...state.settings, [key]: value });
    if (state.pending?.plateId && state.pending?.target) {
      state.pending = {
        ...state.pending,
        direction: currentSettings().direction,
        key: hoverKey(state.pending.plateId, state.pending.target, currentSettings().direction)
      };
      renderPendingPreview();
    } else if (state.hover?.plateId && state.hover?.target) {
      state.hover = {
        ...state.hover,
        direction: currentSettings().direction,
        key: hoverKey(state.hover.plateId, state.hover.target, currentSettings().direction)
      };
      onOverlayChange?.(overlayForHover(api.object(state.hover.plateId), state.hover));
    }
    onStatusChange?.(status());
    onToolStateChange?.();
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    return handleEscapeReset(event, reset);
  }

  return {
    active: () => state.active,
    needsPrecisePointerHit: () => true,
    status,
    toolState: () => ({
      targetLabel: state.pending?.targetLabel || state.hover?.targetLabel || "Hover a bendable edge",
      targetObjectId: state.pending?.plateId || state.hover?.plateId || "",
      targetEdgeId: state.pending?.target?.edgeId || state.hover?.target?.edgeId || "",
      targetParentBendId: state.pending?.target?.parentBendId || state.hover?.target?.parentBendId || "",
      bend: currentHoverBend(),
      bendSettings: currentSettings()
    }),
    start,
    cancel: reset,
    setOption,
    pointerMove,
    pointerDown,
    handleKey
  };
}
