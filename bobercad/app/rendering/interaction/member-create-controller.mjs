import { v } from "../../engine/core/math.mjs";
import { createPreviewMember } from "../../engine/api/project/member-factory.mjs?v=axis-snap-1";
import { memberLayoutAxis } from "../../engine/api/project/members.mjs";
import { activeWorkPlane, rayPlaneIntersection } from "../../engine/api/project/work-plane.mjs";
import { snapCandidates } from "../../engine/api/project/snap-candidates.mjs?v=trim-create-ui-1";
import { composeSnapCandidates } from "../../engine/api/project/snap-composer.mjs?v=active-reference-guides-1";
import { solveSnap } from "../../engine/api/project/snap-solver.mjs?v=snap-architecture-1";
import { memberFrameAt } from "../../engine/geometry/member-evaluator.mjs";
import { memberCreationOverlay } from "../scene/build-authoring-overlays.mjs?v=active-reference-guides-1";

const NUMBER_KEYS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-", ",", "@"]);
const MIN_MEMBER_LENGTH = 1e-6;

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function distinctPoints(a, b) {
  return finitePoint(a) && finitePoint(b) && v.len(v.sub(b, a)) > MIN_MEMBER_LENGTH;
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
    startReference: null,
    end: null,
    endSnap: null,
    endReference: null,
    snap: null,
    rawPoint: null,
    input: "",
    cycleIndex: 0,
    lastPointer: null,
    elevationLock: null,
    activeReferenceMemberIds: []
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

  function isDirectPointSnap(snap) {
    return snap?.kind === "point" && snap.type !== "axis-intersection";
  }

  function preferredDirectPointSnap(solvedSnap, hits) {
    if (!Array.isArray(hits) || !hits.length) return solvedSnap;
    const pointSnap = hits
      .filter(isDirectPointSnap)
      .sort((left, right) => left.screenDistance - right.screenDistance)[0] || null;
    if (!pointSnap) return solvedSnap;
    if (!solvedSnap) return pointSnap;
    if (isDirectPointSnap(solvedSnap)) return solvedSnap;
    const bias = authoringSettings.pointSnapBiasPx || 12;
    return pointSnap.screenDistance <= solvedSnap.screenDistance + bias ? pointSnap : solvedSnap;
  }

  function preferredSnap(solvedSnap, hit, screen, rawPoint) {
    if (isDirectPointSnap(solvedSnap)) return solvedSnap;
    const axisSnap = faceAxisSnap(hit, screen, rawPoint);
    if (!axisSnap) return solvedSnap;
    if (!solvedSnap) return axisSnap;
    const bias = authoringSettings.faceAxisSnapBiasPx || 10;
    if (solvedSnap.objectId === axisSnap.objectId && axisSnap.screenDistance <= solvedSnap.screenDistance + bias) return axisSnap;
    if (axisSnap.screenDistance <= solvedSnap.screenDistance + bias) return axisSnap;
    return solvedSnap;
  }

  function usesStartAxis(snap) {
    if (!snap) return false;
    if (snap.type === "profile-axis") return true;
    if (snap.type === "creation-axis") return true;
    return Array.isArray(snap.sources) && snap.sources.some((source) => source.type === "profile-axis" || source.type === "creation-axis");
  }

  function usesGlobalAxis(snap) {
    return snap?.type === "global-axis" || (Array.isArray(snap?.sources) && snap.sources.some((source) => source.type === "global-axis"));
  }

  function isStartAxisIntersection(snap) {
    return snap?.type === "axis-intersection" && usesStartAxis(snap);
  }

  function preferredStartAxisSnap(solvedSnap, hits) {
    if (!state.start || !Array.isArray(hits) || !hits.length) return solvedSnap;
    const pointSnap = preferredDirectPointSnap(solvedSnap, hits);
    if (isDirectPointSnap(pointSnap)) return pointSnap;
    const intersectionSnap = hits
      .filter(isStartAxisIntersection)
      .sort((left, right) => left.screenDistance - right.screenDistance)[0] || null;
    if (intersectionSnap) {
      if (!solvedSnap || usesStartAxis(solvedSnap) || usesGlobalAxis(solvedSnap)) return intersectionSnap;
      const intersectionBias = authoringSettings.startAxisIntersectionBiasPx || 28;
      if (intersectionSnap.screenDistance <= solvedSnap.screenDistance + intersectionBias) return intersectionSnap;
    }
    const startAxisHits = hits
      .filter(usesStartAxis)
      .sort((left, right) => left.screenDistance - right.screenDistance);
    const startAxisSnap = startAxisHits[0] || null;
    if (!startAxisSnap) return pointSnap;
    if (!pointSnap) return startAxisSnap;
    if (usesStartAxis(pointSnap)) return pointSnap;
    const bias = authoringSettings.startAxisSnapBiasPx || authoringSettings.profileAxisSnapBiasPx || 24;
    return startAxisSnap.screenDistance <= pointSnap.screenDistance + bias ? startAxisSnap : pointSnap;
  }

  function snapMemberSource(snap) {
    if (snap?.objectId && memberById(api.project(), snap.objectId)) return snap;
    return (snap?.sources || []).find((source) => source?.objectId && memberById(api.project(), source.objectId)) || null;
  }

  function memberStationAtPoint(member, point, source = null) {
    const referenceAxis = source?.type === "layout-axis" && member.layoutAxis
      ? memberLayoutAxis(member)
      : { start: member.start, end: member.end };
    const axis = v.sub(referenceAxis.end, referenceAxis.start);
    const referenceLength = v.len(axis);
    const memberLength = v.len(v.sub(member.end, member.start));
    if (referenceLength <= 1e-9 || memberLength <= 1e-9) return 0;
    const ratio = clamp01(v.dot(v.sub(point, referenceAxis.start), axis) / (referenceLength * referenceLength));
    return ratio * memberLength;
  }

  function memberReferenceFrom(hit, snap, point) {
    const snapSource = snapMemberSource(snap);
    const snapMemberId = snapSource?.objectId || null;
    const hitMemberId = hit?.face?.collection === "members" && hit.face.objectId && memberById(api.project(), hit.face.objectId)
      ? hit.face.objectId
      : null;
    const memberId = snapMemberId || hitMemberId;
    const member = memberId ? memberById(api.project(), memberId) : null;
    if (!member || !finitePoint(point)) return null;
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

  function startProfileAxisCandidates() {
    const span = authoringSettings.profileAxisSnapSpan || authoringSettings.globalAxisSnapSpan || 100000;
    const tolerance = authoringSettings.profileAxisSnapTolerancePx || authoringSettings.globalAxisSnapTolerancePx || 34;
    return startProfileAxes().map((axis) => ({
      kind: "line",
      type: "profile-axis",
      objectId: axis.memberId,
      axis: axis.axis,
      a: v.sub(axis.point, v.mul(axis.direction, span)),
      b: v.add(axis.point, v.mul(axis.direction, span)),
      point: axis.point,
      label: axis.label,
      priority: 250,
      screenTolerance: tolerance,
      screenIntersectionMode: "self"
    }));
  }

  function startCreationAxisCandidates() {
    if (!state.start || state.type !== "beam" || startProfileAxes().length) return [];
    const span = authoringSettings.creationAxisSnapSpan || authoringSettings.globalAxisSnapSpan || 100000;
    const tolerance = authoringSettings.creationAxisSnapTolerancePx || authoringSettings.globalAxisSnapTolerancePx || 34;
    return Object.entries({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }).map(([axis, direction]) => ({
      kind: "line",
      type: "creation-axis",
      axis,
      a: v.sub(state.start, v.mul(direction, span)),
      b: v.add(state.start, v.mul(direction, span)),
      point: state.start,
      label: `Start ${axis.toUpperCase()} axis`,
      priority: 250,
      screenTolerance: tolerance,
      screenIntersectionMode: "self"
    }));
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

  function activeReferenceAxisCandidates() {
    const spanTolerance = authoringSettings.activeReferenceAxisSnapTolerancePx || authoringSettings.snapTolerancePx || 16;
    const candidates = [];
    for (const memberId of state.activeReferenceMemberIds) {
      const member = memberById(api.project(), memberId);
      if (!member) continue;
      candidates.push({
        kind: "line",
        type: "member-axis",
        objectId: member.id,
        a: member.start,
        b: member.end,
        point: member.start,
        label: `Axis: ${member.id}`,
        priority: 90,
        screenTolerance: spanTolerance
      });
      if (member.layoutAxis) {
        const axis = memberLayoutAxis(member);
        candidates.push({
          kind: "line",
          type: "layout-axis",
          objectId: member.id,
          a: axis.start,
          b: axis.end,
          point: axis.start,
          label: `Layout axis: ${member.id}`,
          priority: 95,
          screenTolerance: spanTolerance
        });
      }
    }
    return candidates;
  }

  function commandSnapCandidates() {
    const candidates = snapCandidates(api.project(), {
      includeLines: false,
      includeGlobalAxes: true,
      globalAxisOrigin: [0, 0, 0],
      globalAxisSpan: authoringSettings.globalAxisSnapSpan || 100000,
      globalAxisSnapTolerancePx: authoringSettings.globalAxisSnapTolerancePx || 34
    });
    const constructionAxes = [
      ...startProfileAxisCandidates(),
      ...startCreationAxisCandidates()
    ];
    candidates.push(...constructionAxes);
    candidates.push(...activeReferenceAxisCandidates());
    if (state.start && state.type === "beam") {
      candidates.push(...composeSnapCandidates(api.project(), {
        constructionAxes,
        activeMemberIds: state.activeReferenceMemberIds,
        screenTolerance: authoringSettings.compositeSnapTolerancePx || authoringSettings.snapTolerancePx || 16
      }));
    }
    return candidates;
  }

  function pointOnViewPlaneAtCursor(basePoint, screen) {
    if (!finitePoint(basePoint) || !screen) return null;
    const ray = viewer.screenRay(screen.x, screen.y);
    const denominator = v.dot(ray.direction, ray.direction);
    if (denominator <= 1e-12) return null;
    const distance = v.dot(v.sub(basePoint, ray.origin), ray.direction) / denominator;
    const point = v.add(ray.origin, v.mul(ray.direction, distance));
    return finitePoint(point) ? point : null;
  }

  function pointerRawPoint(screen, hit, activePlane) {
    if (finitePoint(hit?.point)) return hit.point;
    if (state.start && state.type === "beam") {
      const viewPoint = pointOnViewPlaneAtCursor(state.start, screen);
      if (viewPoint) return viewPoint;
    }
    return rayPlaneIntersection(viewer.screenRay(screen.x, screen.y), activePlane);
  }

  function pointerPoint({ screen, hit, event }) {
    const activePlane = plane();
    const raw = pointerRawPoint(screen, hit, activePlane);
    if (!finitePoint(raw)) return { point: null, rawPoint: null, snap: null, plane: activePlane };
    const solved = solveSnap({
      candidates: commandSnapCandidates(),
      viewer,
      screen,
      rawPoint: raw,
      screenTolerance: authoringSettings.snapTolerancePx || 16,
      intersectionTolerancePx: authoringSettings.multiSnapTolerancePx || 22,
      pointPriorityBiasPx: authoringSettings.pointSnapBiasPx,
      intersectionPriorityBiasPx: authoringSettings.intersectionSnapBiasPx,
      cycleIndex: state.cycleIndex
    });
    const directPointSnap = preferredDirectPointSnap(solved.snap, solved.candidates);
    const snap = preferredStartAxisSnap(preferredSnap(directPointSnap, hit, screen, raw), solved.candidates);
    let point = snap?.point || raw;
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
    onOverlayChange(memberCreationOverlay({
      start: state.start,
      end,
      rawPoint: state.rawPoint,
      snap: state.snap,
      profileAxes: startProfileAxes(),
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
    state.cycleIndex = 0;
    state.elevationLock = null;
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
    state.cycleIndex = 0;
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
      state.start = end;
      state.startSnap = endSnap;
      state.startReference = endReference;
      state.end = null;
      state.endSnap = null;
      state.endReference = null;
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
    if (!Number.isFinite(distance) || distance <= 0) return false;
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
