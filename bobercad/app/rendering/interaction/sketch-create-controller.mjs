import { sameVec3, v } from "../../engine/core/math.mjs";
import { activeWorkPlane, pointFromPlaneCoordinates, pointToPlaneCoordinates } from "../../engine/api/project/work-plane.mjs";
import { authoringLine } from "../scene/authoring/authoring-primitives.mjs";
import { pointerPlanePoint } from "./pointer-plane-point.mjs";
import { handleBackspaceOrEscape } from "./keyboard-shortcuts.mjs";
import { createPointerFrameScheduler } from "./pointer-frame-scheduler.mjs";

const SKETCH_PREVIEW_COLOR = "#0ea5e9";
const SKETCH_PREVIEW_CLOSE_COLOR = "#38bdf8";
const SKETCH_PREVIEW_POINT_COLOR = "#38bdf8";
const SKETCH_PREVIEW_CURRENT_COLOR = "#f59e0b";
const SAME_POINT_TOLERANCE = 1e-6;

function centeredOutline(points) {
  const minY = Math.min(...points.map((point) => point[0]));
  const maxY = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1]));
  const maxZ = Math.max(...points.map((point) => point[1]));
  const center = [(minY + maxY) / 2, (minZ + maxZ) / 2];
  return {
    center,
    outline: points.map((point) => [point[0] - center[0], point[1] - center[1]])
  };
}

export function createSketchCreateController({
  viewer,
  api,
  snapManager,
  getWorkPlane,
  onProjectChange,
  onSketchCreated,
  onOverlayChange,
  onStatusChange
}) {
  const pointerScheduler = createPointerFrameScheduler();
  const state = {
    active: false,
    points: [],
    plane: null,
    lastPointer: null,
    previewSnap: null
  };

  function status() {
    const snap = state.previewSnap?.label ? ` | ${state.previewSnap.label}` : "";
    if (state.points.length >= 3) {
      return `Sketch: pick point ${state.points.length + 1}, or Enter/double-click to finish${snap}`;
    }
    return `Sketch: pick point ${state.points.length + 1}${snap}`;
  }

  function overlayPoints(previewPoint = null) {
    const points = [...state.points];
    if (v.isVec3(previewPoint) && !sameVec3(previewPoint, points[points.length - 1], SAME_POINT_TOLERANCE)) {
      points.push(previewPoint);
    }
    return points;
  }

  function renderOverlay(previewPoint = null) {
    const points = overlayPoints(previewPoint);
    const lines = [];
    for (let index = 1; index < points.length; index += 1) {
      lines.push(authoringLine([points[index - 1], points[index]], SKETCH_PREVIEW_COLOR, {
        kind: "sketch-create-preview-edge"
      }));
    }
    if (points.length >= 3) {
      lines.push(authoringLine([points[points.length - 1], points[0]], SKETCH_PREVIEW_CLOSE_COLOR, {
        kind: "sketch-create-preview-close"
      }));
    }
    const committedHandles = state.points.map((point, index) => ({
      kind: "sketch-create-point",
      point,
      index,
      color: SKETCH_PREVIEW_POINT_COLOR,
      radius: 7
    }));
    const handles = [...committedHandles];
    if (v.isVec3(previewPoint) && !sameVec3(previewPoint, state.points[state.points.length - 1], SAME_POINT_TOLERANCE)) {
      handles.push({
        kind: "sketch-create-preview-point",
        point: previewPoint,
        color: SKETCH_PREVIEW_CURRENT_COLOR,
        radius: 6
      });
    }
    if (!lines.length && !handles.length) {
      onOverlayChange?.(null);
      return;
    }
    onOverlayChange?.({ lines, handles, labels: [] });
  }

  function reset() {
    state.active = false;
    pointerScheduler.clear();
    state.points = [];
    state.plane = null;
    state.lastPointer = null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    onOverlayChange?.(null);
    onStatusChange?.("No modeling command");
  }

  function start() {
    state.active = true;
    pointerScheduler.clear();
    state.points = [];
    state.plane = getWorkPlane?.() || activeWorkPlane(api.project(), {});
    state.lastPointer = viewer.currentPointer?.() || null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    if (state.lastPointer) {
      const result = resolvedPointer(state.lastPointer);
      state.previewSnap = result.snap;
      renderOverlay(result.point);
    } else {
      renderOverlay();
    }
    onStatusChange?.(status());
  }

  function finish() {
    if (!state.active) return false;
    try {
      if (state.points.length < 3) {
        onStatusChange?.("Sketch: at least three points are required");
        return true;
      }
      const plane = state.plane || getWorkPlane?.() || activeWorkPlane(api.project(), {});
      const local = state.points.map((point) => pointToPlaneCoordinates(point, plane));
      const { center, outline } = centeredOutline(local);
      const result = api.createSketch({
        id: "manual_sketch",
        outline,
        center: pointFromPlaneCoordinates(center, plane),
        normal: plane.normal,
        localAxisY: plane.axisX,
        localAxisZ: plane.axisY,
        placementIntent: {
          role: "manual-sketch",
          source: "sketch-create-command"
        },
        display: {
          color: "#dbeafe",
          edgeColor: "#0ea5e9"
        }
      });
      onProjectChange?.(result.project);
      reset();
      onSketchCreated?.(result);
    } catch (error) {
      onStatusChange?.(error.message || "Sketch: could not create sketch");
    }
    return true;
  }

  function resolvedPointer(pointer) {
    const plane = state.plane || getWorkPlane?.() || activeWorkPlane(api.project(), {});
    const rawPoint = pointerPlanePoint(pointer, viewer, plane, { preferHit: false });
    if (!v.isVec3(rawPoint)) {
      return { point: null, rawPoint: null, snap: null, plane };
    }
    const snap = snapManager?.point({
      screen: pointer?.screen,
      rawPoint,
      event: pointer?.event,
      context: {
        tool: "sketch-create",
        phase: `pick-${state.points.length + 1}`,
        event: pointer?.event,
        workPlane: plane,
        projectToPlane: true,
        includeLines: true
      }
    });
    return {
      point: snap?.point || rawPoint,
      rawPoint,
      snap: snap?.snap || null,
      plane
    };
  }

  function pointerMove(pointer) {
    if (!state.active) return false;
    return pointerScheduler.schedule(pointer, (nextPointer) => {
      if (!state.active || !nextPointer) return;
      snapManager?.resetCycle?.();
      state.lastPointer = nextPointer;
      const result = resolvedPointer(nextPointer);
      state.previewSnap = result.snap;
      renderOverlay(result.point);
      onStatusChange?.(status());
    });
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    pointerScheduler.clear();
    state.lastPointer = pointer;
    const result = resolvedPointer(pointer);
    if (!v.isVec3(result.point)) {
      onStatusChange?.("Sketch: could not resolve point on work plane");
      return true;
    }
    state.previewSnap = result.snap;
    const point = result.point;
    state.points.push(point);
    if (state.points.length >= 3 && Number(pointer?.event?.detail) >= 2) return finish();
    renderOverlay();
    onStatusChange?.(status());
    return true;
  }

  function cycleSnap() {
    if (!state.active || !state.lastPointer) return false;
    snapManager?.cycle?.();
    const result = resolvedPointer(state.lastPointer);
    state.previewSnap = result.snap;
    renderOverlay(result.point);
    onStatusChange?.(status());
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    if (event.key === "Enter") return finish();
    return handleBackspaceOrEscape(event, () => {
      state.points.pop();
      renderOverlay();
      onStatusChange?.(status());
    }, reset);
  }

  return {
    active: () => state.active,
    needsPointerHit: () => false,
    start,
    cancel: reset,
    cycleSnap,
    pointerMove,
    pointerDown,
    handleKey,
    finish
  };
}
