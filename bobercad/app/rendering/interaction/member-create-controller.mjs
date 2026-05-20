import { v } from "../../engine/core/math.mjs";
import { createPreviewMember } from "../../engine/api/project/member-factory.mjs";
import { memberLayoutAxis } from "../../engine/api/project/members.mjs";
import { activeWorkPlane, rayPlaneIntersection } from "../../engine/api/project/work-plane.mjs";
import { snapCandidates, solveSnap } from "../../engine/api/project/snapping.mjs";
import { memberCreationOverlay } from "../scene/build-authoring-overlays.mjs";

const NUMBER_KEYS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-", ",", "@"]);

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function commandName(type) {
  return type === "column" ? "Column" : "Beam";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function closestPointOnSegment(a, b, point) {
  const axis = v.sub(b, a);
  const lengthSq = v.dot(axis, axis);
  if (lengthSq <= 1e-12) return { point: [...a], t: 0 };
  const t = clamp01(v.dot(v.sub(point, a), axis) / lengthSq);
  return { point: v.add(a, v.mul(axis, t)), t };
}

function memberById(project, memberId) {
  return project.model?.members?.[memberId] || null;
}

function statusFor(state, extra = "") {
  if (!state.active) return "No modeling command";
  const base = state.start
    ? `${commandName(state.type)}: pick end, type length/height, or Enter`
    : `${commandName(state.type)}: pick first point`;
  const snap = state.snap?.label ? ` | ${state.snap.label}` : "";
  const input = state.input ? ` | ${state.input}` : "";
  return `${base}${snap}${input}${extra ? ` | ${extra}` : ""}`;
}

function parseRelativeInput(value) {
  if (!value.startsWith("@")) return null;
  const parts = value.slice(1).split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts;
}

function parseElevationInput(value) {
  if (!value.toLowerCase().startsWith("z")) return null;
  const elevation = Number(value.slice(1));
  return Number.isFinite(elevation) ? elevation : null;
}

function axisLockedPoint(start, point, plane) {
  const delta = v.sub(point, start);
  const axes = [v.norm(plane.axisX), v.norm(plane.axisY), [0, 0, 1]];
  let best = axes[0];
  let bestDistance = -Infinity;
  for (const axis of axes) {
    const distance = Math.abs(v.dot(delta, axis));
    if (distance > bestDistance) {
      best = axis;
      bestDistance = distance;
    }
  }
  return v.add(start, v.mul(best, v.dot(delta, best)));
}

export function createMemberCreateController({
  viewer,
  api,
  profiles,
  settings,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange
}) {
  const authoringSettings = settings.authoring || {};
  const state = {
    active: false,
    type: null,
    start: null,
    startSnap: null,
    end: null,
    endSnap: null,
    snap: null,
    rawPoint: null,
    input: "",
    cycleIndex: 0,
    lastPointer: null,
    elevationLock: null
  };

  function plane() {
    return activeWorkPlane(api.project(), {});
  }

  function faceAxisSnap(hit, screen, rawPoint) {
    if (hit?.face?.collection !== "members" || !hit.face.objectId) return null;
    const member = memberById(api.project(), hit.face.objectId);
    if (!member) return null;
    const axis = memberLayoutAxis(member);
    const closest = closestPointOnSegment(axis.start, axis.end, rawPoint);
    const projected = viewer.projectPoint(closest.point);
    if (!projected) return null;
    const screenDistance = Math.hypot(projected.x - screen.x, projected.y - screen.y);
    if (screenDistance > (authoringSettings.faceAxisSnapTolerancePx || 42)) return null;
    return {
      kind: "line",
      type: member.layoutAxis ? "layout-axis" : "member-axis",
      objectId: member.id,
      a: axis.start,
      b: axis.end,
      point: closest.point,
      t: closest.t,
      label: member.layoutAxis ? `Layout axis: ${member.id}` : `Axis: ${member.id}`,
      priority: 220,
      projected,
      screenDistance
    };
  }

  function preferredSnap(solvedSnap, hit, screen, rawPoint) {
    const axisSnap = faceAxisSnap(hit, screen, rawPoint);
    if (!axisSnap) return solvedSnap;
    if (!solvedSnap) return axisSnap;
    const bias = authoringSettings.faceAxisSnapBiasPx || 10;
    if (solvedSnap.objectId === axisSnap.objectId && axisSnap.screenDistance <= solvedSnap.screenDistance + bias) return axisSnap;
    if (axisSnap.screenDistance <= solvedSnap.screenDistance + bias) return axisSnap;
    return solvedSnap;
  }

  function pointerPoint({ screen, hit, event }) {
    const activePlane = plane();
    const raw = hit?.point || rayPlaneIntersection(viewer.screenRay(screen.x, screen.y), activePlane);
    if (!finitePoint(raw)) return { point: null, rawPoint: null, snap: null, plane: activePlane };
    const candidates = snapCandidates(api.project());
    const solved = solveSnap({
      candidates,
      viewer,
      screen,
      rawPoint: raw,
      screenTolerance: authoringSettings.snapTolerancePx || 16,
      cycleIndex: state.cycleIndex
    });
    const snap = preferredSnap(solved.snap, hit, screen, raw);
    let point = snap?.point || raw;
    if (state.elevationLock !== null) point = [point[0], point[1], state.elevationLock];
    if (state.start && event?.shiftKey && state.type === "beam") point = axisLockedPoint(state.start, point, activePlane);
    if (state.start && state.type === "column") point = [state.start[0], state.start[1], point[2]];
    return { point, rawPoint: raw, snap, plane: activePlane };
  }

  function previewEnd(point) {
    if (!state.start) return null;
    if (state.type === "column" && !point) return v.add(state.start, [0, 0, authoringSettings.defaultColumnHeight || 3000]);
    return point;
  }

  function renderOverlay(activePlane = plane()) {
    const end = previewEnd(state.end);
    onOverlayChange(memberCreationOverlay({
      start: state.start,
      end,
      rawPoint: state.rawPoint,
      snap: state.snap,
      type: state.type,
      workPlane: activePlane,
      settings: authoringSettings
    }));
    if (state.start && end) {
      onPreviewChange([createPreviewMember(api.project(), profiles, {
        type: state.type,
        start: state.start,
        end,
        startSnap: state.startSnap,
        endSnap: state.endSnap,
        display: {
          opacity: authoringSettings.previewOpacity || 0.32,
          color: state.type === "column" ? authoringSettings.columnColor : authoringSettings.beamColor
        }
      })]);
    } else {
      onPreviewChange([]);
    }
    onStatusChange(statusFor(state));
  }

  function setPointerState(pointer) {
    const result = pointerPoint(pointer);
    state.lastPointer = pointer;
    state.rawPoint = result.rawPoint;
    state.snap = result.snap;
    if (!state.start) {
      state.end = null;
      renderOverlay(result.plane);
      return result;
    }
    state.end = previewEnd(result.point);
    state.endSnap = result.snap;
    renderOverlay(result.plane);
    return result;
  }

  function start(type) {
    state.active = true;
    state.type = type === "column" ? "column" : "beam";
    state.start = null;
    state.startSnap = null;
    state.end = null;
    state.endSnap = null;
    state.snap = null;
    state.input = "";
    state.cycleIndex = 0;
    state.elevationLock = null;
    renderOverlay();
  }

  function clearPreview() {
    onPreviewChange([]);
    onOverlayChange(null);
  }

  function cancel() {
    state.active = false;
    state.type = null;
    state.start = null;
    state.end = null;
    state.input = "";
    clearPreview();
    onStatusChange("No modeling command");
  }

  function resetStage() {
    state.start = null;
    state.startSnap = null;
    state.end = null;
    state.endSnap = null;
    state.input = "";
    state.cycleIndex = 0;
    renderOverlay();
  }

  function commit(end = state.end, endSnap = state.endSnap) {
    if (!state.start || !finitePoint(end)) return false;
    const result = api.createMember({
      type: state.type,
      start: state.start,
      end,
      startSnap: state.startSnap,
      endSnap
    });
    onProjectChange(result.project);
    if (state.type === "beam") {
      state.start = end;
      state.startSnap = endSnap;
      state.end = null;
      state.endSnap = null;
      state.input = "";
      renderOverlay();
    } else {
      resetStage();
    }
    return true;
  }

  function pointerMove(pointer) {
    if (!state.active) return false;
    setPointerState(pointer);
    return true;
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    const result = setPointerState(pointer);
    if (!result.point) return true;
    if (!state.start) {
      state.start = result.point;
      state.startSnap = result.snap;
      state.end = state.type === "column" ? v.add(state.start, [0, 0, authoringSettings.defaultColumnHeight || 3000]) : null;
      renderOverlay(result.plane);
      return true;
    }
    commit(result.point, result.snap);
    return true;
  }

  function applyTypedInput() {
    const value = state.input.trim();
    if (!value) return commit();
    const elevation = parseElevationInput(value);
    if (elevation !== null) {
      state.elevationLock = elevation;
      state.input = "";
      if (state.start && state.end) state.end = [state.end[0], state.end[1], elevation];
      renderOverlay();
      return true;
    }
    if (!state.start) return false;
    const relative = parseRelativeInput(value);
    if (relative) {
      const end = v.add(state.start, relative);
      state.input = "";
      return commit(end, null);
    }
    const distance = Number(value);
    if (!Number.isFinite(distance) || distance <= 0) return false;
    let end;
    if (state.type === "column") {
      end = v.add(state.start, [0, 0, distance]);
    } else {
      const direction = state.end ? v.norm(v.sub(state.end, state.start)) : v.norm(plane().axisX);
      end = v.add(state.start, v.mul(direction, distance));
    }
    state.input = "";
    return commit(end, null);
  }

  function cycleSnap() {
    if (!state.active) return false;
    state.cycleIndex += 1;
    if (state.lastPointer) setPointerState(state.lastPointer);
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    if (event.key === "Escape") {
      if (state.start) resetStage();
      else cancel();
      return true;
    }
    if (event.key === "Tab") {
      cycleSnap();
      return true;
    }
    if (event.key === "Enter") {
      applyTypedInput();
      return true;
    }
    if (event.key === "Backspace") {
      state.input = state.input.slice(0, -1);
      renderOverlay();
      return true;
    }
    if (event.key.toLowerCase() === "z" && !state.input) {
      state.input = "z";
      renderOverlay();
      return true;
    }
    if (NUMBER_KEYS.has(event.key)) {
      state.input += event.key;
      renderOverlay();
      return true;
    }
    return false;
  }

  return {
    active: () => state.active,
    cancel,
    handleKey,
    pointerDown,
    pointerMove,
    start,
    status: () => statusFor(state)
  };
}
