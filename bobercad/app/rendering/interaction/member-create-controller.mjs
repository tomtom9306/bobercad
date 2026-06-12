import { distance3, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs?v=world-axis-dry-1";
import { arrayValues } from "../../engine/core/model.mjs?v=interaction-array-values-dry-1";
import { createPreviewMember } from "../../engine/api/project/member-factory.mjs?v=member-snap-ref-defined-object-dry-1";
import { memberAxisData, memberById, memberStationAtPoint } from "../../engine/api/project/members.mjs?v=member-api-distance-dry-1";
import { activeWorkPlane, rayPlaneIntersection } from "../../engine/api/project/work-plane.mjs?v=finite-point-api-dry-1";
import { memberFrameAt } from "../../engine/geometry/member-evaluator.mjs?v=geometry-api-array-values-dry-1";
import { memberCreationOverlay } from "../scene/authoring/member-overlays.mjs?v=unified-snap-manager-8";
import { coordinateSpaceLabel as axisGuideModeLabel, normalizeCoordinateSpace as normalizeAxisGuideMode } from "../scene/authoring/member-axis-space.mjs?v=final-array-values-dry-1";
import { matchesShortcut, shortcutSetting } from "./keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { pointOnViewRay } from "./pointer-plane-point.mjs?v=view-ray-dry-1";

const NUMBER_KEYS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-", ",", "@"]);
const MIN_MEMBER_LENGTH = 1e-6;

function distinctPoints(a, b) {
  return v.isVec3(a) && v.isVec3(b) && distance3(a, b) > MIN_MEMBER_LENGTH;
}

function commandName(type) {
  return type === "column" ? "Column" : "Beam";
}

function memberEndReference(member) {
  const axis = memberAxisData(member);
  if (!member?.id || !axis) return null;
  return {
    memberId: member.id,
    station: axis.length
  };
}

function statusFor(state, extra = "") {
  if (!state.active) return "No modeling command";
  const base = state.start
    ? `${commandName(state.type)}: pick end, type length/height, or Enter`
    : `${commandName(state.type)}: pick first point`;
  const snap = state.snap?.label ? ` | ${state.snap.label}` : "";
  const axes = state.start && state.type === "beam" ? ` | Axes: ${axisGuideModeLabel(state.axisGuideModeLabel || state.axisGuideMode)}` : "";
  const input = state.input ? ` | ${state.input}` : "";
  return `${base}${snap}${axes}${input}${extra ? ` | ${extra}` : ""}`;
}

function parseRelativeInput(value) {
  if (!value.startsWith("@")) return null;
  const parts = value.slice(1).split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !finiteNumber(part))) return null;
  return parts;
}

function parseElevationInput(value) {
  if (!value.toLowerCase().startsWith("z")) return null;
  const elevation = Number(value.slice(1));
  return finiteNumberOr(elevation, null);
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
  snapManager,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange
}) {
  const authoringSettings = settings.authoring || {};
  const shortcuts = settings.shortcuts?.memberCreate || {};
  const state = {
    active: false,
    type: null,
    start: null,
    startSnap: null,
    startReference: null,
    end: null,
    endSnap: null,
    endReference: null,
    snap: null,
    rawPoint: null,
    input: "",
    lastPointer: null,
    elevationLock: null,
    axisGuideMode: normalizeAxisGuideMode(authoringSettings.axisGuideMode),
    axisGuideModeLabel: normalizeAxisGuideMode(authoringSettings.axisGuideMode),
    activeReferenceMemberIds: []
  };

  function plane() {
    return activeWorkPlane(api.project(), {});
  }

  function snapMemberSource(snap) {
    if (snap?.objectId && memberById(api.project(), snap.objectId)) return snap;
    return arrayValues(snap?.sources).find((source) => source?.objectId && memberById(api.project(), source.objectId)) || null;
  }

  function memberReferenceFrom(hit, snap, point) {
    const snapSource = snapMemberSource(snap);
    const snapMemberId = snapSource?.objectId || null;
    const hitMemberId = hit?.face?.collection === "members" && hit.face.objectId && memberById(api.project(), hit.face.objectId)
      ? hit.face.objectId
      : null;
    const memberId = snapMemberId || hitMemberId;
    const member = memberId ? memberById(api.project(), memberId) : null;
    if (!member || !v.isVec3(point)) return null;
    return {
      memberId,
      station: memberStationAtPoint(member, point, snapMemberId ? snapSource : null)
    };
  }

  function startProfileAxes() {
    if (!state.start || state.type !== "beam" || !state.startReference?.memberId) return [];
    const member = memberById(api.project(), state.startReference.memberId);
    if (!member) return [];
    try {
      const frame = memberFrameAt(member, state.startReference.station || 0);
      return ["x", "y", "z"].map((axis) => ({
        axis,
        point: state.start,
        direction: v.norm(frame[axis]),
        label: `Profile ${axis.toUpperCase()} axis: ${member.id}`,
        memberId: member.id
      }));
    } catch {
      return [];
    }
  }

  function activeAxisGuideMode() {
    if (!state.start || state.type !== "beam") return normalizeAxisGuideMode(state.axisGuideMode);
    if (state.axisGuideMode === "local" && startProfileAxes().length) return "local";
    return "global";
  }

  function activateReferenceMemberFromHit(hit) {
    const memberId = hit?.face?.collection === "members" ? hit.face.objectId : null;
    if (!memberId || !memberById(api.project(), memberId)) return;
    const limit = Math.max(0, Math.floor(authoringSettings.activeReferenceMemberLimit));
    state.activeReferenceMemberIds = [
      memberId,
      ...state.activeReferenceMemberIds.filter((id) => id !== memberId)
    ].slice(0, limit);
  }

  function pointerRawPoint(screen, hit, activePlane) {
    if (v.isVec3(hit?.point)) return hit.point;
    if (state.start && state.type === "beam") {
      const viewPoint = pointOnViewRay(viewer, state.start, screen);
      if (viewPoint) return viewPoint;
    }
    return rayPlaneIntersection(viewer.screenRay(screen.x, screen.y), activePlane);
  }

  function pointerPoint({ screen, hit, event }) {
    const activePlane = plane();
    const raw = pointerRawPoint(screen, hit, activePlane);
    if (!v.isVec3(raw)) return { point: null, rawPoint: null, snap: null, plane: activePlane };
    if (!snapManager) throw new Error("member create requires snap manager");
    const snapResult = snapManager.resolve({
      screen,
      rawPoint: raw,
      event,
      context: {
        tool: "member-create",
        phase: state.start ? "pick-end" : "pick-start",
        memberType: state.type,
        start: state.start,
        startReference: state.startReference,
        activeMemberIds: state.activeReferenceMemberIds,
        axisGuideMode: activeAxisGuideMode(),
        workPlane: activePlane,
        projectToPlane: false,
        includeLines: true
      }
    });
    const snap = snapResult.snap;
    let point = snapResult.accepted ? snapResult.pointWorld : raw;
    if (state.elevationLock !== null) point = [point[0], point[1], state.elevationLock];
    if (state.start && event?.shiftKey && state.type === "beam") point = axisLockedPoint(state.start, point, activePlane);
    if (state.start && state.type === "column") point = [state.start[0], state.start[1], point[2]];
    return { point, rawPoint: raw, snap, reference: memberReferenceFrom(hit, snap, point), plane: activePlane };
  }

  function previewEnd(point) {
    if (!state.start) return null;
    if (state.type === "column" && !point) return v.add(state.start, [0, 0, authoringSettings.defaultColumnHeight || 3000]);
    return point;
  }

  function renderOverlay(activePlane = plane()) {
    const end = previewEnd(state.end);
    const axisGuideMode = activeAxisGuideMode();
    state.axisGuideModeLabel = axisGuideMode;
    onOverlayChange(memberCreationOverlay({
      start: state.start,
      end,
      rawPoint: state.rawPoint,
      snap: state.snap,
      profileAxes: axisGuideMode === "local" ? startProfileAxes() : [],
      type: state.type,
      workPlane: activePlane,
      settings: authoringSettings
    }));
    if (state.start && distinctPoints(state.start, end)) {
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
    activateReferenceMemberFromHit(pointer?.hit);
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
    state.endReference = result.reference;
    renderOverlay(result.plane);
    return result;
  }

  function start(type) {
    state.active = true;
    state.type = type === "column" ? "column" : "beam";
    state.start = null;
    state.startSnap = null;
    state.startReference = null;
    state.end = null;
    state.endSnap = null;
    state.endReference = null;
    state.snap = null;
    state.input = "";
    snapManager?.resetCycle?.();
    state.elevationLock = null;
    state.axisGuideMode = normalizeAxisGuideMode(authoringSettings.axisGuideMode);
    state.axisGuideModeLabel = state.axisGuideMode;
    state.activeReferenceMemberIds = [];
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
    state.startReference = null;
    state.end = null;
    state.endReference = null;
    state.input = "";
    state.axisGuideModeLabel = state.axisGuideMode;
    state.activeReferenceMemberIds = [];
    clearPreview();
    onStatusChange("No modeling command");
  }

  function resetStage() {
    state.start = null;
    state.startSnap = null;
    state.startReference = null;
    state.end = null;
    state.endSnap = null;
    state.endReference = null;
    state.input = "";
    snapManager?.resetCycle?.();
    state.axisGuideModeLabel = state.axisGuideMode;
    renderOverlay();
  }

  function commit(end = state.end, endSnap = state.endSnap, endReference = state.endReference) {
    if (!state.start || !distinctPoints(state.start, end)) return false;
    const result = api.createMember({
      type: state.type,
      start: state.start,
      end,
      startSnap: state.startSnap,
      endSnap
    });
    onProjectChange(result.project);
    if (state.type === "beam") {
      const chainReference = memberEndReference(result.member);
      state.start = end;
      state.startSnap = endSnap;
      state.startReference = chainReference || endReference;
      state.end = null;
      state.endSnap = null;
      state.endReference = null;
      state.input = "";
      if (chainReference) {
        state.activeReferenceMemberIds = [
          chainReference.memberId,
          ...state.activeReferenceMemberIds.filter((id) => id !== chainReference.memberId)
        ].slice(0, Math.max(0, Math.floor(authoringSettings.activeReferenceMemberLimit)));
      }
      renderOverlay();
    } else {
      resetStage();
    }
    return true;
  }

  function pointerMove(pointer) {
    if (!state.active) return false;
    snapManager?.resetCycle?.();
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
      state.startReference = result.reference;
      state.end = state.type === "column" ? v.add(state.start, [0, 0, authoringSettings.defaultColumnHeight || 3000]) : null;
      renderOverlay(result.plane);
      return true;
    }
    commit(result.point, result.snap, result.reference);
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
      return commit(end, null, null);
    }
    const distance = Number(value);
    if (!finiteNumber(distance) || distance <= 0) return false;
    let end;
    if (state.type === "column") {
      end = v.add(state.start, [0, 0, distance]);
    } else {
      const direction = state.end ? v.norm(v.sub(state.end, state.start)) : v.norm(plane().axisX);
      end = v.add(state.start, v.mul(direction, distance));
    }
    state.input = "";
    return commit(end, null, null);
  }

  function cycleSnap() {
    if (!state.active) return false;
    snapManager?.cycle?.();
    if (state.lastPointer) setPointerState(state.lastPointer);
    return true;
  }

  function toggleAxisGuideMode() {
    if (!state.active || state.type !== "beam") return false;
    if (!state.start) return true;
    if (activeAxisGuideMode() === "global") {
      if (!startProfileAxes().length) {
        renderOverlay();
        onStatusChange(statusFor(state, "No local profile axes at start point"));
        return true;
      }
      state.axisGuideMode = "local";
    } else {
      state.axisGuideMode = "global";
    }
    snapManager?.resetCycle?.();
    if (state.lastPointer) setPointerState(state.lastPointer);
    else renderOverlay();
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    if (matchesShortcut(event, shortcutSetting(shortcuts, "cancel", "Escape"))) {
      if (state.start) resetStage();
      else cancel();
      return true;
    }
    if (matchesShortcut(event, shortcutSetting(shortcuts, "cycleSnap", authoringSettings.snap?.cycleKey || "Tab"))) {
      cycleSnap();
      return true;
    }
    if (matchesShortcut(event, shortcutSetting(shortcuts, "toggleAxisGuideMode", "Shift+Tab"))) {
      toggleAxisGuideMode();
      return true;
    }
    if (matchesShortcut(event, shortcutSetting(shortcuts, "confirm", "Enter"))) {
      applyTypedInput();
      return true;
    }
    if (matchesShortcut(event, shortcutSetting(shortcuts, "deleteInput", "Backspace"))) {
      state.input = state.input.slice(0, -1);
      renderOverlay();
      return true;
    }
    if (matchesShortcut(event, shortcutSetting(shortcuts, "elevationInput", "Z")) && !state.input) {
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
    cycleSnap,
    start,
    status: () => statusFor(state)
  };
}
