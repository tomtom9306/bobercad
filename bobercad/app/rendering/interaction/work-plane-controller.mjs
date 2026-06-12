import { activeWorkPlane } from "../../engine/api/project/work-plane.mjs";
import { v } from "../../engine/core/math.mjs";
import { workPlaneFromThreePoints } from "../../engine/api/project/plates.mjs?v=plate-construction-vertex-drag-1";
import { pointerPlanePoint } from "./pointer-plane-point.mjs?v=pointer-plane-dry-1";
import { handleBackspaceOrEscape } from "./keyboard-shortcuts.mjs?v=backspace-escape-dry-1";

export function createWorkPlaneController({
  viewer,
  api,
  snapManager,
  onWorkPlaneChange,
  onStatusChange
}) {
  const state = {
    active: false,
    points: [],
    lastPointer: null,
    previewSnap: null
  };

  function status() {
    const snap = state.previewSnap?.label ? ` | ${state.previewSnap.label}` : "";
    return `Workplane: pick point ${state.points.length + 1} of 3${snap}`;
  }

  function reset() {
    state.active = false;
    state.points = [];
    state.lastPointer = null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    onStatusChange?.("No modeling command");
  }

  function start() {
    state.active = true;
    state.points = [];
    state.lastPointer = viewer.currentPointer?.() || null;
    state.previewSnap = null;
    snapManager?.resetCycle?.();
    if (state.lastPointer) state.previewSnap = resolvedPointer(state.lastPointer).snap;
    onStatusChange?.(status());
  }

  function resolvedPointer(pointer) {
    const fallbackPlane = activeWorkPlane(api.project(), {});
    const rawPoint = pointerPlanePoint(pointer, viewer, fallbackPlane);
    if (!v.isVec3(rawPoint)) {
      return { point: null, rawPoint: null, snap: null };
    }
    const snap = snapManager?.point({
      screen: pointer?.screen,
      rawPoint,
      event: pointer?.event,
      context: {
        tool: "workplane-create",
        phase: `pick-${state.points.length + 1}`,
        event: pointer?.event,
        projectToPlane: false,
        includeLines: true
      }
    });
    return {
      point: snap?.point || rawPoint,
      rawPoint,
      snap: snap?.snap || null
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
      onStatusChange?.("Workplane: could not resolve screen point");
      return true;
    }
    state.previewSnap = result.snap;
    const point = result.point;
    state.points.push(point);
    if (state.points.length < 3) {
      onStatusChange?.(status());
      return true;
    }
    try {
      const plane = workPlaneFromThreePoints(state.points[0], state.points[1], state.points[2], "custom-3-point-workplane");
      plane.label = "3 point workplane";
      onWorkPlaneChange?.(plane);
      reset();
      onStatusChange?.("Workplane set from 3 points");
    } catch (error) {
      state.points.pop();
      onStatusChange?.(error.message);
    }
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    return handleBackspaceOrEscape(event, () => {
      state.points.pop();
      onStatusChange?.(status());
    }, reset);
  }

  return {
    active: () => state.active,
    start,
    cancel: reset,
    cycleSnap() {
      if (!state.active || !state.lastPointer) return false;
      snapManager?.cycle?.();
      const result = resolvedPointer(state.lastPointer);
      state.previewSnap = result.snap;
      onStatusChange?.(status());
      return true;
    },
    pointerMove,
    pointerDown,
    handleKey
  };
}
