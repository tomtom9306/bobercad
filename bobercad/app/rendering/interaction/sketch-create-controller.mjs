import { v } from "../../engine/core/math.mjs";
import { activeWorkPlane, pointFromPlaneCoordinates, pointToPlaneCoordinates } from "../../engine/api/project/work-plane.mjs?v=plane-coordinates-dry-1";
import { pointerPlanePoint } from "./pointer-plane-point.mjs?v=sketch-pointer-dry-1";
import { handleBackspaceOrEscape } from "./keyboard-shortcuts.mjs?v=backspace-escape-dry-1";

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
  onStatusChange
}) {
  const state = {
    active: false,
    points: [],
    plane: null,
    lastPointer: null,
    previewSnap: null
  };

  function status() {
    const snap = state.previewSnap?.label ? ` | ${state.previewSnap.label}` : "";
    return `Sketch: pick point ${state.points.length + 1}${snap}`;
  }

  function reset() {
    state.active = false;
    state.points = [];
    state.plane = null;
    state.lastPointer = null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    onStatusChange?.("No modeling command");
  }

  function start() {
    state.active = true;
    state.points = [];
    state.plane = getWorkPlane?.() || activeWorkPlane(api.project(), {});
    state.lastPointer = viewer.currentPointer?.() || null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    if (state.lastPointer) state.previewSnap = resolvedPointer(state.lastPointer).snap;
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
    snapManager?.resetCycle?.();
    state.lastPointer = pointer;
    const result = resolvedPointer(pointer);
    state.previewSnap = result.snap;
    onStatusChange?.(status());
    return true;
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    state.lastPointer = pointer;
    const result = resolvedPointer(pointer);
    if (!v.isVec3(result.point)) {
      onStatusChange?.("Sketch: could not resolve point on work plane");
      return true;
    }
    state.previewSnap = result.snap;
    const point = result.point;
    state.points.push(point);
    if (state.points.length >= 3) return finish();
    onStatusChange?.(status());
    return true;
  }

  function cycleSnap() {
    if (!state.active || !state.lastPointer) return false;
    snapManager?.cycle?.();
    const result = resolvedPointer(state.lastPointer);
    state.previewSnap = result.snap;
    onStatusChange?.(status());
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    if (event.key === "Enter") return finish();
    return handleBackspaceOrEscape(event, () => {
      state.points.pop();
      onStatusChange?.(status());
    }, reset);
  }

  return {
    active: () => state.active,
    start,
    cancel: reset,
    cycleSnap,
    pointerMove,
    pointerDown,
    handleKey,
    finish
  };
}
