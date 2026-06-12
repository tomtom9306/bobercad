import { activeWorkPlane } from "../../engine/api/project/work-plane.mjs?v=plate-draw-feedback-4";
import { finiteNumber, finitePositiveNumberOr, sameVec3, v } from "../../engine/core/math.mjs?v=same-vec3-dry-1";
import { formatNumber } from "../../engine/core/format.mjs?v=format-number-dry-1";
import { platePlacementFromThreePoints, sketchVertices } from "../../engine/api/project/plates.mjs?v=plate-construction-vertex-drag-1";
import { plateCreationOverlay } from "../scene/authoring/member-overlays.mjs?v=unified-snap-manager-8";
import { pointerPlanePoint } from "./pointer-plane-point.mjs?v=plate-draw-feedback-3";
import { handleEscapeReset } from "./keyboard-shortcuts.mjs?v=escape-reset-dry-1";
import { adaptiveSnapGridStep } from "./snap-profiles.mjs?v=unified-snap-manager-10";

const DEFAULT_PLATE_DEPTH = 300;
const DEFAULT_PLATE_WIDTH = 600;
const MIN_PREVIEW_DISTANCE = 1e-6;
const DEFAULT_PLATE_CREATE_AXIS_LOCK = false;

export function createPlateCreateController({
  viewer,
  api,
  snapManager,
  getWorkPlane,
  settings,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange
}) {
  const authoringSettings = settings?.authoring || {};
  const state = {
    active: false,
    points: [],
    current: null,
    rawPoint: null,
    snap: null,
    plane: null,
    lastPointer: null,
    axisLocked: DEFAULT_PLATE_CREATE_AXIS_LOCK
  };

  function status(previewPoints = [], current = state.current) {
    if (!state.active) return "No modeling command";
    const relation = state.axisLocked ? "axis locked rectangle" : "free angle rectangle";
    if (state.points.length === 0) {
      return v.isVec3(current)
        ? `Plate 1/3: pick first corner - ${relation}`
        : `Plate 1/3: move cursor to first corner - ${relation}`;
    }
    if (state.points.length === 1) {
      const length = v.isVec3(current) ? v.len(v.sub(current, state.points[0])) : null;
      return finiteNumber(length)
        ? `Plate 2/3: pick edge end - ${formatNumber(length, { digits: 1, invalid: "-" })} mm - ${relation}`
        : `Plate 2/3: pick edge end - ${relation}`;
    }
    if (previewPoints.length >= 4) {
      const edgeLength = v.len(v.sub(state.points[1], state.points[0]));
      const depthLength = v.len(v.sub(previewPoints[3], previewPoints[0]));
      return `Plate 3/3: pick depth point - ${formatNumber(edgeLength, { digits: 1, invalid: "-" })} x ${formatNumber(depthLength, { digits: 1, invalid: "-" })} mm - ${relation}`;
    }
    return `Plate 3/3: pick depth point - ${relation}`;
  }

  function worldOutline(placement) {
    return sketchVertices(placement.sketch).map((vertex) => v.add(
      placement.center,
      v.add(v.mul(placement.localAxisY, vertex.point[0]), v.mul(placement.localAxisZ, vertex.point[1]))
    ));
  }

  function positiveSetting(name, fallback) {
    const value = authoringSettings?.[name];
    return finitePositiveNumberOr(value, fallback);
  }

  function fallbackDepthPoint(first, second) {
    const base = v.sub(second, first);
    const baseLength = v.len(base);
    if (baseLength <= MIN_PREVIEW_DISTANCE) return null;
    const baseAxis = v.mul(base, 1 / baseLength);
    const normal = v.safeNorm(state.plane?.normal, [0, 0, 1]);
    const depthAxis = v.safeNorm(v.cross(normal, baseAxis), v.safeNorm(state.plane?.axisY, [0, 1, 0]));
    return v.add(first, v.mul(depthAxis, positiveSetting("defaultPlateDepth", DEFAULT_PLATE_DEPTH)));
  }

  function fallbackEdgePoint(first) {
    if (!v.isVec3(first)) return null;
    const axis = v.safeNorm(state.plane?.axisX, [1, 0, 0]);
    return v.add(first, v.mul(axis, positiveSetting("defaultPlateWidth", DEFAULT_PLATE_WIDTH)));
  }

  function fallbackPointAfterFirstPick(edgePoint) {
    if (!v.isVec3(edgePoint)) return null;
    return fallbackDepthPoint(state.points[0], edgePoint);
  }

  function fallbackPointAfterSecondPick() {
    return fallbackDepthPoint(state.points[0], state.points[1]);
  }

  function axisScreenScale(origin, axis) {
    const start = viewer.projectPoint?.(origin);
    const baseScale = viewer.screenScale?.() || 1;
    if (!start || !v.isVec3(axis)) return baseScale;
    const probe = Math.max(10, 42 / Math.max(baseScale, 1e-9));
    const end = viewer.projectPoint?.(v.add(origin, v.mul(v.safeNorm(axis, [1, 0, 0]), probe)));
    if (!end) return baseScale;
    const screenLength = Math.hypot(end.x - start.x, end.y - start.y);
    return screenLength > 1e-6 ? screenLength / probe : baseScale;
  }

  function adaptiveGridStep(origin, axis) {
    return adaptiveSnapGridStep(axisScreenScale(origin, axis), authoringSettings, {
      gridPrecision: "fine"
    });
  }

  function plateCreateAdaptiveGrid(rawPoint, plane = state.plane, options = {}) {
    if (!v.isVec3(rawPoint) || state.points.length <= 0) return null;
    const useAxisLock = options.axisLocked ?? state.axisLocked;
    let origin = state.points[0];
    let axis = null;
    let length = null;
    let label = "Plate grid";
    if (state.points.length === 1) {
      const delta = v.sub(rawPoint, origin);
      if (v.len(delta) <= MIN_PREVIEW_DISTANCE) return null;
      if (useAxisLock) {
        const nearest = nearestWorkPlaneAxis(delta);
        axis = nearest.axis;
        length = nearest.projection;
        label = "Plate axis grid";
      } else {
        axis = v.safeNorm(delta, v.safeNorm(plane?.axisX, [1, 0, 0]));
        length = v.len(delta);
      }
    } else if (state.points.length === 2) {
      const first = state.points[0];
      const second = state.points[1];
      const base = v.sub(second, first);
      const baseLength = v.len(base);
      if (baseLength <= MIN_PREVIEW_DISTANCE) return null;
      const baseAxis = v.mul(base, 1 / baseLength);
      const normal = v.safeNorm(plane?.normal, [0, 0, 1]);
      origin = first;
      axis = v.safeNorm(v.cross(normal, baseAxis), v.safeNorm(plane?.axisY, [0, 1, 0]));
      length = v.dot(v.sub(rawPoint, first), axis);
      label = "Plate depth grid";
    }
    if (!v.isVec3(axis) || !finiteNumber(length)) return null;
    const step = adaptiveGridStep(origin, axis);
    if (!finiteNumber(step) || step <= MIN_PREVIEW_DISTANCE) return null;
    return {
      origin,
      axis,
      length,
      step,
      label,
      priority: 6,
      minDistance: MIN_PREVIEW_DISTANCE,
      target: {
        collection: "activeCommand",
        objectId: "plate-create",
        subId: `pick-${state.points.length + 1}`,
        semanticRole: "adaptive-grid"
      }
    };
  }

  function nearestWorkPlaneAxis(delta) {
    const axisX = v.safeNorm(state.plane?.axisX, [1, 0, 0]);
    const axisY = v.safeNorm(state.plane?.axisY, [0, 1, 0]);
    const xProjection = v.dot(delta, axisX);
    const yProjection = v.dot(delta, axisY);
    return Math.abs(xProjection) >= Math.abs(yProjection)
      ? { axis: axisX, projection: xProjection }
      : { axis: axisY, projection: yProjection };
  }

  function constrainedEdgePoint(rawPoint, options = {}) {
    if (!v.isVec3(rawPoint) || !v.isVec3(state.points[0])) return rawPoint;
    if (options.snap?.providerId === "precision.adaptiveGrid") return rawPoint;
    const first = state.points[0];
    const delta = v.sub(rawPoint, first);
    if (v.len(delta) <= MIN_PREVIEW_DISTANCE) return fallbackEdgePoint(first);
    const useAxisLock = options.axisLocked ?? state.axisLocked;
    if (useAxisLock) {
      const { axis, projection } = nearestWorkPlaneAxis(delta);
      return v.add(first, v.mul(axis, projection));
    }
    return rawPoint;
  }

  function constrainedDepthPoint(rawPoint, options = {}) {
    if (!v.isVec3(rawPoint) || state.points.length < 2) return rawPoint;
    if (options.snap?.providerId === "precision.adaptiveGrid") return rawPoint;
    const first = state.points[0];
    const second = state.points[1];
    const base = v.sub(second, first);
    const baseLength = v.len(base);
    if (baseLength <= MIN_PREVIEW_DISTANCE) return fallbackPointAfterSecondPick();
    const baseAxis = v.mul(base, 1 / baseLength);
    const normal = v.safeNorm(state.plane?.normal, [0, 0, 1]);
    const depthAxis = v.safeNorm(v.cross(normal, baseAxis), v.safeNorm(state.plane?.axisY, [0, 1, 0]));
    const rawDepth = v.dot(v.sub(rawPoint, first), depthAxis);
    return v.add(first, v.mul(depthAxis, rawDepth));
  }

  function constrainedGuidePoint(current = state.current, options = {}) {
    if (state.points.length === 1 && (!v.isVec3(current) || sameVec3(current, state.points[0], MIN_PREVIEW_DISTANCE))) {
      return fallbackEdgePoint(state.points[0]);
    }
    if (state.points.length === 2 && (!v.isVec3(current) || sameVec3(current, state.points[1], MIN_PREVIEW_DISTANCE))) {
      return fallbackPointAfterSecondPick();
    }
    if (state.points.length === 1) return constrainedEdgePoint(current, options);
    if (state.points.length === 2) return constrainedDepthPoint(current, options);
    return current;
  }

  function previewPlatePlacement(first, second, third) {
    try {
      return platePlacementFromThreePoints(first, second, third, {
        preferredNormal: state.plane?.normal,
        idPrefix: "manual_plate_preview"
      });
    } catch {
      return null;
    }
  }

  function previewPlacement(guidePoint = constrainedGuidePoint()) {
    if (!v.isVec3(guidePoint)) return null;
    if (state.points.length === 0) {
      const edgePoint = fallbackEdgePoint(guidePoint);
      const depthPoint = v.isVec3(edgePoint) ? fallbackDepthPoint(guidePoint, edgePoint) : null;
      if (!v.isVec3(edgePoint) || !v.isVec3(depthPoint)) return null;
      return previewPlatePlacement(guidePoint, edgePoint, depthPoint);
    }
    if (state.points.length === 1) {
      const depthPoint = fallbackPointAfterFirstPick(guidePoint);
      if (!v.isVec3(depthPoint)) return null;
      return previewPlatePlacement(state.points[0], guidePoint, depthPoint);
    }
    if (state.points.length < 2) return null;
    return previewPlatePlacement(state.points[0], state.points[1], guidePoint);
  }

  function previewPlate(placement) {
    if (!placement) return null;
    return {
      id: "manual_plate_preview",
      type: "plate",
      material: "S355",
      thickness: 8,
      ...placement,
      display: {
        color: authoringSettings.platePreviewColor || "#0ea5e9",
        edgeColor: authoringSettings.previewColor || "#2563eb",
        opacity: authoringSettings.previewOpacity || 0.32
      }
    };
  }

  function renderOverlay() {
    const current = state.current;
    const guidePoint = constrainedGuidePoint(current, { snap: state.snap });
    const placement = previewPlacement(guidePoint);
    const plate = previewPlate(placement);
    const previewPoints = placement ? worldOutline(placement) : [];
    onOverlayChange?.(plateCreationOverlay({
      points: state.points,
      current,
      guidePoint,
      rawPoint: state.rawPoint,
      snap: state.snap,
      previewPoints,
      workPlane: state.plane,
      step: Math.min(state.points.length + 1, 3),
      relations: {
        axisLocked: state.axisLocked,
        mode: state.axisLocked ? "axis-locked-rectangle" : "free-angle-rectangle"
      },
      settings: authoringSettings
    }));
    onPreviewChange?.({ plates: plate ? [plate] : [] });
    onStatusChange?.(status(previewPoints, guidePoint));
  }

  function pointerPointResult(pointer, plane) {
    const rawPoint = pointerPlanePoint(pointer, viewer, plane, { preferHit: false });
    if (!v.isVec3(rawPoint)) return { point: null, rawPoint: null, snap: null };
    if (!snapManager) return { point: rawPoint, rawPoint, snap: null };
    const result = snapManager.point({
      screen: pointer?.screen,
      rawPoint,
      event: pointer?.event,
      context: {
        tool: "plate-create",
        phase: `pick-${state.points.length + 1}`,
        event: pointer?.event,
        workPlane: plane,
        projectToPlane: true,
        includeLines: true,
        adaptiveGrid: plateCreateAdaptiveGrid(rawPoint, plane)
      }
    });
    return {
      point: result.point,
      rawPoint,
      snap: result.snap
    };
  }

  function setPointerState(pointer, plane) {
    state.lastPointer = pointer || null;
    const result = pointerPointResult(pointer, plane);
    state.current = result.point;
    state.rawPoint = result.rawPoint;
    state.snap = result.snap;
    return result;
  }

  function viewportCenterPointer() {
    const viewport = viewer.viewportSize?.();
    if (!finiteNumber(viewport?.width) || !finiteNumber(viewport?.height) || viewport.width <= 0 || viewport.height <= 0) return null;
    return {
      screen: {
        x: viewport.width / 2,
        y: viewport.height / 2
      },
      hit: null
    };
  }

  function reset() {
    state.active = false;
    state.points = [];
    state.current = null;
    state.rawPoint = null;
    state.snap = null;
    state.plane = null;
    state.lastPointer = null;
    state.axisLocked = DEFAULT_PLATE_CREATE_AXIS_LOCK;
    snapManager?.resetCycle?.();
    onPreviewChange?.({ plates: [] });
    onOverlayChange?.(null);
    onStatusChange?.("No modeling command");
  }

  function start(initialPointer = null) {
    state.active = true;
    state.points = [];
    state.current = null;
    state.rawPoint = null;
    state.snap = null;
    state.plane = getWorkPlane?.() || activeWorkPlane(api.project(), {});
    state.lastPointer = null;
    state.axisLocked = DEFAULT_PLATE_CREATE_AXIS_LOCK;
    snapManager?.resetCycle?.();
    const pointer = initialPointer || viewer.currentPointer?.() || viewportCenterPointer();
    if (pointer) setPointerState(pointer, state.plane);
    renderOverlay();
  }

  function cancel() {
    reset();
  }

  function pointerMove(pointer) {
    if (!state.active) return false;
    snapManager?.resetCycle?.();
    const plane = state.plane || getWorkPlane?.() || activeWorkPlane(api.project(), {});
    state.plane = plane;
    setPointerState(pointer, plane);
    renderOverlay();
    return true;
  }

  function cycleSnap() {
    if (!state.active || !state.lastPointer) return false;
    snapManager?.cycle?.();
    const plane = state.plane || getWorkPlane?.() || activeWorkPlane(api.project(), {});
    state.plane = plane;
    setPointerState(state.lastPointer, plane);
    renderOverlay();
    return true;
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    if (pointer?.handle?.kind === "plate-create-axis-lock-toggle") {
      state.axisLocked = !state.axisLocked;
      renderOverlay();
      onStatusChange?.(state.axisLocked ? "Plate: axis lock enabled" : "Plate: free angle enabled");
      return true;
    }
    const plane = state.plane || getWorkPlane?.() || activeWorkPlane(api.project(), {});
    const pointerResult = setPointerState(pointer, plane);
    const point = pointerResult.point;
    if (!v.isVec3(point)) {
      onStatusChange?.("Plate: could not resolve point on work plane");
      return true;
    }
    const constrainedPoint = constrainedGuidePoint(point, {
      axisLocked: pointer?.event?.altKey ? false : state.axisLocked,
      snap: pointerResult.snap
    });
    state.current = constrainedPoint;
    state.points.push(constrainedPoint);
    if (state.points.length < 3) {
      renderOverlay();
      return true;
    }

    let placement = null;
    try {
      placement = platePlacementFromThreePoints(state.points[0], state.points[1], state.points[2], {
        preferredNormal: plane.normal,
        idPrefix: "manual_plate"
      });
    } catch (error) {
      state.points.pop();
      onStatusChange?.(error.message);
      return true;
    }
    const createResult = api.createPlate({
      id: "manual_plate",
      type: "plate",
      material: "S355",
      thickness: 8,
      ...placement,
      placementIntent: {
        role: "manual-plate",
        source: "plate-create-3-point-command"
      },
      display: {
        color: "#6b7280",
        edgeColor: "#0ea5e9"
      }
    });
    onProjectChange?.(createResult.project);
    reset();
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    if (event.key?.toLowerCase() === "r") {
      state.axisLocked = !state.axisLocked;
      renderOverlay();
      onStatusChange?.(state.axisLocked ? "Plate: axis lock enabled" : "Plate: free angle enabled");
      return true;
    }
    return handleEscapeReset(event, cancel);
  }

  return {
    active: () => state.active,
    start,
    cancel,
    cycleSnap,
    handleKey,
    pointerMove,
    pointerDown
  };
}
