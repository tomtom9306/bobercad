import { v } from "../../engine/core/math.mjs";
import {
  clone,
  memberAuthoringPoints,
  moveMemberWithLayout,
  setMemberLayoutEndpoint,
  setMemberPhysicalEndpoint
} from "../../engine/api/project/members.mjs";
import { snapCandidates } from "../../engine/api/project/snapping.mjs";
import {
  memberAxesForTarget,
  normalizeCoordinateSpace,
  vectorComponentsInAxes,
  vectorFromAxisComponents
} from "../scene/authoring/member-axis-space.mjs";
import { memberAuthoringOverlay } from "../scene/build-authoring-overlays.mjs";
import {
  axisScreenDistance,
  quantizeDegrees,
  quantizeDistance,
  rotateMemberAroundAxis,
  signedScreenAngleDegrees,
  translationStepForScale
} from "./manipulator-math.mjs";
import { nearestScreenSnap } from "./snap-controller.mjs";

function memberById(project, memberId) {
  return project.model?.members?.[memberId] || null;
}

function handleEndpoint(kind) {
  if (typeof kind !== "string") return null;
  if (kind.endsWith("-start")) return "start";
  if (kind.endsWith("-end")) return "end";
  return null;
}

function projectMemberCount(project) {
  return Object.keys(project.model?.members || {}).length;
}

function memberLength(member) {
  return v.len(v.sub(member.end, member.start));
}

function localSnapOptions(project, member) {
  const count = projectMemberCount(project);
  if (count <= 1500) return {};
  const points = memberAuthoringPoints(member);
  if (count > 25000) {
    return {
      center: points.center,
      radius: Math.max(8000, Math.min(24000, memberLength(member) * 4)),
      maxMemberCandidates: 800
    };
  }
  return {
    center: points.center,
    radius: Math.max(20000, memberLength(member) * 2.5),
    maxMemberCandidates: 2000
  };
}

function isLargeProject(project) {
  return projectMemberCount(project) > 1500;
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function connectionPreviewObjectIds(project, memberId) {
  const previewCollections = new Set(["plates", "features", "fastenerGroups", "welds"]);
  const ids = [];
  for (const connection of Object.values(project.model?.connections || {})) {
    if (connection.mainMemberId !== memberId && connection.secondaryMemberId !== memberId) continue;
    ids.push(
      ...flattenIds(connection.generator?.objectRoles),
      ...(connection.generator?.ownedObjectIds || []),
      ...flattenIds(connection.manualParts)
    );
  }
  return [...new Set(ids)].filter((id) => previewCollections.has(project.objectIndex?.[id]?.collection));
}

function perfMark(name, data = {}) {
  if (typeof window === "undefined" || !window.__boberCadPerf?.events) return;
  window.__boberCadPerf.events.push({ name, time: performance.now(), ...data });
}

function isMoveOperation(operation) {
  return operation?.kind === "move-member";
}

function isPendingTransformOperation(operation) {
  return ["move-member", "physical-endpoint", "layout-endpoint"].includes(operation?.kind);
}

function handleTarget(handle) {
  if (handle?.target === "start" || handle?.target === "center" || handle?.target === "end") return handle.target;
  if (handleEndpoint(handle?.kind) === "start") return "start";
  if (handleEndpoint(handle?.kind) === "end") return "end";
  return "center";
}

function handlePoint(member, handle) {
  const points = memberAuthoringPoints(member);
  const target = handleTarget(handle);
  if (target === "start") return handle?.kind?.startsWith("layout-") ? points.layoutStart : points.physicalStart;
  if (target === "end") return handle?.kind?.startsWith("layout-") ? points.layoutEnd : points.physicalEnd;
  return points.center;
}

function memberGeometryPatch(member) {
  const patch = {
    start: member.start,
    end: member.end,
    rotation: member.rotation || 0
  };
  if (member.layoutAxis) patch.layoutAxis = member.layoutAxis;
  return patch;
}

function axisIndex(axisId) {
  if (axisId === "x" || axisId === 0) return 0;
  if (axisId === "y" || axisId === 1) return 1;
  if (axisId === "z" || axisId === 2) return 2;
  return -1;
}

function endpointLabel(endpoint) {
  return endpoint === "start" ? "Start" : "End";
}

function operationTargetPoint(member, operation) {
  const points = memberAuthoringPoints(member);
  if (operation?.kind === "move-member") return points.center;
  if (operation?.kind === "layout-endpoint") return operation.endpoint === "start" ? points.layoutStart : points.layoutEnd;
  if (operation?.kind === "physical-endpoint") return operation.endpoint === "start" ? points.physicalStart : points.physicalEnd;
  return points.center;
}

function operationTitle(operation) {
  if (operation?.kind === "move-member") return "Move member";
  if (operation?.kind === "layout-endpoint") return `Move layout ${operation.endpoint}`;
  if (operation?.kind === "physical-endpoint") return `Move ${operation.endpoint} point`;
  return "Move member";
}

function operationTargetLabel(operation) {
  if (operation?.kind === "move-member") return "Center";
  if (operation?.kind === "layout-endpoint") return `Layout ${endpointLabel(operation.endpoint)}`;
  if (operation?.kind === "physical-endpoint") return endpointLabel(operation.endpoint);
  return "Reference point";
}

function operationAxisTarget(operation) {
  if (operation?.kind === "move-member") return "center";
  if ((operation?.kind === "layout-endpoint" || operation?.kind === "physical-endpoint") && operation.endpoint) return operation.endpoint;
  return handleTarget(operation);
}

function movedPointRows(baseMember, draftMember, operation) {
  const basePoints = memberAuthoringPoints(baseMember);
  const draftPoints = memberAuthoringPoints(draftMember);
  if (operation?.kind === "move-member") {
    const rows = [
      { label: "Start", before: basePoints.physicalStart, after: draftPoints.physicalStart },
      { label: "End", before: basePoints.physicalEnd, after: draftPoints.physicalEnd }
    ];
    if (baseMember.layoutAxis) {
      rows.push(
        { label: "L Start", before: basePoints.layoutStart, after: draftPoints.layoutStart },
        { label: "L End", before: basePoints.layoutEnd, after: draftPoints.layoutEnd }
      );
    }
    return rows;
  }
  if (operation?.kind === "layout-endpoint") {
    return [{
      label: `L ${endpointLabel(operation.endpoint)}`,
      before: operation.endpoint === "start" ? basePoints.layoutStart : basePoints.layoutEnd,
      after: operation.endpoint === "start" ? draftPoints.layoutStart : draftPoints.layoutEnd
    }];
  }
  return [{
    label: endpointLabel(operation?.endpoint),
    before: operation?.endpoint === "start" ? basePoints.physicalStart : basePoints.physicalEnd,
    after: operation?.endpoint === "start" ? draftPoints.physicalStart : draftPoints.physicalEnd
  }];
}

function moveDeltaBetweenMembers(fromMember, toMember, operation) {
  return v.sub(operationTargetPoint(toMember, operation), operationTargetPoint(fromMember, operation));
}

export function createMemberEditController({ viewer, api, selection, settings = {}, onProjectChange, onLocalProjectChange, onMemberSelected, onCleared, onMessage, onTransformChange }) {
  let activeMemberId = null;
  let drag = null;
  let pendingTransform = null;
  let pendingDrag = null;
  let dragFramePending = false;
  let connectionRefreshTimer = null;
  let connectionRefreshIdle = null;
  const authoringSettings = settings.authoring || {};
  const manipulatorSettings = authoringSettings.manipulator || {};
  let coordinateSpace = normalizeCoordinateSpace(manipulatorSettings.coordinateSpace);

  function renderOverlay(member = null, snap = null, dragPoint = null) {
    if (!activeMemberId) {
      viewer.setAuthoringOverlay(null);
      return;
    }
    viewer.setAuthoringOverlay(memberAuthoringOverlay(api.project(), activeMemberId, {
      member,
      snap,
      dragPoint,
      settings: {
        ...authoringSettings,
        manipulator: {
          ...manipulatorSettings,
          coordinateSpace
        },
        axes: settings.render?.axes || {}
      }
    }));
  }

  function axesForOperation(member, operation) {
    return memberAxesForTarget(member, operationAxisTarget(operation), operation?.coordinateSpace || coordinateSpace);
  }

  function pendingDelta() {
    if (!pendingTransform) return [0, 0, 0];
    const basePoint = operationTargetPoint(pendingTransform.baseMember, pendingTransform.operation);
    const currentPoint = operationTargetPoint(pendingTransform.draft.member, pendingTransform.operation);
    return v.sub(currentPoint, basePoint);
  }

  function pendingDeltaComponents() {
    if (!pendingTransform) return [0, 0, 0];
    return vectorComponentsInAxes(
      pendingDelta(),
      axesForOperation(pendingTransform.baseMember, pendingTransform.operation)
    );
  }

  function transformState() {
    if (!pendingTransform) return null;
    const basePoint = operationTargetPoint(pendingTransform.baseMember, pendingTransform.operation);
    const currentPoint = operationTargetPoint(pendingTransform.draft.member, pendingTransform.operation);
    return {
      memberId: pendingTransform.memberId,
      title: operationTitle(pendingTransform.operation),
      targetLabel: operationTargetLabel(pendingTransform.operation),
      coordinateSpace: pendingTransform.coordinateSpace || coordinateSpace,
      basePoint,
      currentPoint,
      delta: pendingDeltaComponents(),
      increment: pendingTransform.increment,
      affectedPoints: movedPointRows(pendingTransform.baseMember, pendingTransform.draft.member, pendingTransform.operation),
      committed: Boolean(pendingTransform.committed),
      error: pendingTransform.error || ""
    };
  }

  function emitTransformChange() {
    onTransformChange?.(transformState());
  }

  function clearPendingTransform({ restoreOverlay = true, clearPreview = true, message = "" } = {}) {
    if (!pendingTransform) return false;
    pendingTransform = null;
    pendingDrag = null;
    if (clearPreview) viewer.clearObjectPreview?.();
    if (restoreOverlay) renderOverlay();
    emitTransformChange();
    if (message) onMessage?.(message, "ok");
    return true;
  }

  function draftFromOperation(baseMember, operation) {
    if (operation.kind === "move-member") {
      return {
        member: moveMemberWithLayout(baseMember, operation.delta),
        operation,
        snap: null,
        dragPoint: v.add(operationTargetPoint(baseMember, operation), operation.delta)
      };
    }
    if (operation.kind === "physical-endpoint") {
      const member = setMemberPhysicalEndpoint(baseMember, operation.endpoint, operation.point);
      return {
        member,
        operation,
        snap: null,
        dragPoint: operation.point
      };
    }
    if (operation.kind === "layout-endpoint") {
      const member = setMemberLayoutEndpoint(baseMember, operation.endpoint, operation.point);
      return {
        member,
        operation,
        snap: null,
        dragPoint: operation.point
      };
    }
    return null;
  }

  function operationFromDelta(delta) {
    if (!pendingTransform) return null;
    const operation = pendingTransform.operation;
    if (operation.kind === "move-member") return { kind: "move-member", delta, coordinateSpace: pendingTransform.coordinateSpace || coordinateSpace };
    const basePoint = operationTargetPoint(pendingTransform.baseMember, operation);
    return {
      kind: operation.kind,
      endpoint: operation.endpoint,
      point: v.add(basePoint, delta),
      coordinateSpace: pendingTransform.coordinateSpace || coordinateSpace
    };
  }

  function operationFromComponents(components) {
    if (!pendingTransform) return null;
    return operationFromDelta(vectorFromAxisComponents(
      components,
      axesForOperation(pendingTransform.baseMember, pendingTransform.operation)
    ));
  }

  function applyPendingOperation(operation) {
    if (!pendingTransform) return false;
    try {
      const draft = draftFromOperation(pendingTransform.baseMember, operation);
      if (!draft) return false;
      pendingTransform = {
        ...pendingTransform,
        operation,
        draft,
        error: ""
      };
      renderOverlay(draft.member, draft.snap, draft.dragPoint);
      updateLivePreview(draft);
      emitTransformChange();
      if (pendingTransform.committed) commitDraft(pendingTransform.memberId, draft, { message: false });
      return true;
    } catch (error) {
      pendingTransform = {
        ...pendingTransform,
        error: error.message
      };
      emitTransformChange();
      return false;
    }
  }

  function setPendingTransformDelta(axisId, value) {
    if (!pendingTransform || typeof value !== "number" || !Number.isFinite(value)) return false;
    const index = axisIndex(axisId);
    if (index < 0) return false;
    const components = pendingDeltaComponents();
    components[index] = value;
    const operation = operationFromComponents(components);
    return operation ? applyPendingOperation(operation) : false;
  }

  function setPendingTransformResult(axisId, value) {
    if (!pendingTransform || typeof value !== "number" || !Number.isFinite(value)) return false;
    const index = axisIndex(axisId);
    if (index < 0) return false;
    const basePoint = operationTargetPoint(pendingTransform.baseMember, pendingTransform.operation);
    const currentPoint = operationTargetPoint(pendingTransform.draft.member, pendingTransform.operation);
    const nextPoint = [...currentPoint];
    nextPoint[index] = value;
    const operation = operationFromDelta(v.sub(nextPoint, basePoint));
    return operation ? applyPendingOperation(operation) : false;
  }

  function nudgePendingTransform(axisId, direction) {
    if (!pendingTransform) return false;
    const index = axisIndex(axisId);
    if (index < 0) return false;
    const step = Number.isFinite(pendingTransform.increment) && pendingTransform.increment > 0
      ? pendingTransform.increment
      : 1;
    const components = pendingDeltaComponents();
    components[index] += direction * step;
    const operation = operationFromComponents(components);
    return operation ? applyPendingOperation(operation) : false;
  }

  function setPendingTransformIncrement(value) {
    if (!pendingTransform || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
    pendingTransform = { ...pendingTransform, increment: value, error: "" };
    emitTransformChange();
    return true;
  }

  function clearConnectionRefresh() {
    clearTimeout(connectionRefreshTimer);
    connectionRefreshTimer = null;
    if (connectionRefreshIdle !== null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(connectionRefreshIdle);
    }
    connectionRefreshIdle = null;
  }

  function queueConnectionRefresh(memberId) {
    if (typeof api.regenerateMemberConnections !== "function") return;
    clearConnectionRefresh();
    const useLocalRefresh = typeof onLocalProjectChange === "function";
    const run = () => {
      connectionRefreshIdle = null;
      if (!memberById(api.project(), memberId)) return;
      perfMark("member-drag-deferred-refresh-start", { memberId });
      const nextProject = api.regenerateMemberConnections(memberId);
      const affectedObjectIds = [memberId, ...connectionPreviewObjectIds(nextProject, memberId)];
      const localRefresh = typeof onLocalProjectChange === "function"
        ? onLocalProjectChange(nextProject, memberId, affectedObjectIds) !== false
        : false;
      if (!localRefresh) onProjectChange(nextProject);
      perfMark("member-drag-deferred-refresh-finished", { memberId, localRefresh, affectedObjectCount: affectedObjectIds.length });
      if (activeMemberId === memberId) {
        selection.select([memberId]);
        renderOverlay();
      }
    };
    if (useLocalRefresh) {
      connectionRefreshTimer = setTimeout(() => {
        connectionRefreshTimer = null;
        run();
      }, 0);
      return;
    }
    connectionRefreshTimer = setTimeout(() => {
      connectionRefreshTimer = null;
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        connectionRefreshIdle = window.requestIdleCallback(run, { timeout: 2400 });
      } else {
        run();
      }
    }, 1600);
  }

  function selectMember(memberId, options = {}) {
    if (!memberById(api.project(), memberId)) return;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    perfMark("member-select-start", { memberId });
    activeMemberId = memberId;
    selection.select([memberId]);
    renderOverlay();
    if (options.notify !== false) onMemberSelected?.(memberId);
    onMessage?.(`Selected ${memberId}.`, "ok");
    perfMark("member-select-finished", { memberId });
  }

  function setCoordinateSpace(nextSpace, options = {}) {
    const normalized = normalizeCoordinateSpace(nextSpace);
    if (coordinateSpace === normalized) return false;
    if (drag) return false;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    coordinateSpace = normalized;
    if (activeMemberId) renderOverlay();
    emitTransformChange();
    if (options.notify !== false) onMessage?.(`${normalized === "local" ? "Local" : "Global"} axes.`, "ok");
    return true;
  }

  function toggleCoordinateSpace(options = {}) {
    return setCoordinateSpace(coordinateSpace === "local" ? "global" : "local", options);
  }

  function clear(options = {}) {
    activeMemberId = null;
    drag = null;
    pendingTransform = null;
    pendingDrag = null;
    clearConnectionRefresh();
    viewer.clearObjectPreview?.();
    viewer.setAuthoringOverlay(null);
    emitTransformChange();
    if (options.notify !== false) onCleared?.();
  }

  function snapPoint(point, candidates) {
    return nearestScreenSnap({
      candidates,
      viewer,
      point,
      excludeObjectId: activeMemberId,
      screenTolerance: authoringSettings.snapTolerancePx || 14
    });
  }

  function projectedAxisScale(point, axis) {
    const origin = viewer.projectPoint(point);
    if (!origin) return viewer.screenScale();
    const probe = Math.max(10, 36 / Math.max(viewer.screenScale(), 1e-9));
    const end = viewer.projectPoint(v.add(point, v.mul(axis, probe)));
    if (!end) return viewer.screenScale();
    const screenLength = Math.hypot(end.x - origin.x, end.y - origin.y);
    return screenLength > 1e-6 ? screenLength / probe : viewer.screenScale();
  }

  function axisDistanceFromDrag(input, basePoint, axis) {
    if (drag.handle.axisScreen) {
      const screenDistance = axisScreenDistance({
        pointerStart: drag.startScreen,
        pointerCurrent: input.screen,
        axisScreen: drag.handle.axisScreen
      });
      const scale = Number.isFinite(drag.handle.screenScalePxPerWorld)
        ? drag.handle.screenScalePxPerWorld
        : projectedAxisScale(basePoint, axis);
      return scale > 1e-9 ? screenDistance / scale : 0;
    }
    return v.dot(viewer.screenDeltaToWorld(input.totalDx, input.totalDy), axis);
  }

  function axisSnap(basePoint, axis, rawPoint, candidates) {
    const snap = snapPoint(rawPoint, candidates);
    if (!snap?.point) return { snap: null, point: rawPoint };
    const distance = v.dot(v.sub(snap.point, basePoint), axis);
    const lockedPoint = v.add(basePoint, v.mul(axis, distance));
    return {
      snap: { ...snap, point: lockedPoint },
      point: lockedPoint
    };
  }

  function draftFromAxisDrag(input) {
    const base = drag.baseMember;
    const candidates = drag.candidates;
    const target = handleTarget(drag.handle);
    const axis = v.norm(drag.handle.axis || [1, 0, 0]);
    const basePoint = handlePoint(base, drag.handle);
    const step = translationStepForScale(manipulatorSettings.translation || {}, viewer.screenScale());
    const distance = quantizeDistance(axisDistanceFromDrag(input, basePoint, axis), step);
    const rawPoint = v.add(basePoint, v.mul(axis, distance));
    const snapResult = axisSnap(basePoint, axis, rawPoint, candidates);
    const point = snapResult.point;

    if (target === "center") {
      const moveDelta = v.sub(point, basePoint);
      return {
        member: moveMemberWithLayout(base, moveDelta),
        operation: { kind: "move-member", delta: moveDelta, coordinateSpace },
        snap: snapResult.snap,
        dragPoint: rawPoint,
        readout: `${drag.handle.spaceLabel || ""} ${Math.round(v.dot(moveDelta, axis))} mm`.trim()
      };
    }

    const member = setMemberPhysicalEndpoint(base, target, point);
    return {
      member,
      operation: { kind: "physical-endpoint", endpoint: target, point, coordinateSpace },
      snap: snapResult.snap,
      dragPoint: rawPoint,
      readout: `${drag.handle.spaceLabel || ""} ${Math.round(distance)} mm`.trim()
    };
  }

  function draftFromRotationDrag(input) {
    const base = drag.baseMember;
    const rawDegrees = signedScreenAngleDegrees({
      center: drag.handle.screen,
      pointerStart: drag.startScreen,
      pointerCurrent: input.screen
    });
    const degrees = quantizeDegrees(rawDegrees, manipulatorSettings.rotation?.stepDegrees || 1);
    const pivot = handlePoint(base, drag.handle);
    const axis = v.norm(drag.handle.axis || [1, 0, 0]);
    const member = rotateMemberAroundAxis(base, pivot, axis, degrees);
    return {
      member,
      operation: {
        kind: "member-rotation",
        axisId: drag.handle.axisId,
        coordinateSpace,
        degrees,
        patch: memberGeometryPatch(member)
      },
      snap: null,
      dragPoint: pivot,
      readout: `${drag.handle.spaceLabel || ""} ${String(drag.handle.axisLabel || drag.handle.axisId || "").toUpperCase()} ${Math.round(degrees * 100) / 100} deg`.trim()
    };
  }

  function draftFromDrag(input) {
    if (drag.handle.kind === "translate-axis") return draftFromAxisDrag(input);
    if (drag.handle.kind === "rotate-axis") return draftFromRotationDrag(input);

    const delta = viewer.screenDeltaToWorld(input.totalDx, input.totalDy);
    const base = drag.baseMember;
    const candidates = drag.candidates;
    const kind = drag.handle.kind;
    const points = memberAuthoringPoints(base);

    if (kind === "move-member") {
      const rawCenter = v.add(points.center, delta);
      const snap = snapPoint(rawCenter, candidates);
      const moveDelta = snap ? v.sub(snap.point, points.center) : delta;
      return { member: moveMemberWithLayout(base, moveDelta), operation: { kind, delta: moveDelta, coordinateSpace }, snap, dragPoint: rawCenter };
    }

    const endpoint = handleEndpoint(kind);
    if (!endpoint) return null;
    const isLayout = kind.startsWith("layout-");
    const rawPoint = v.add(isLayout ? points[`layout${endpoint === "start" ? "Start" : "End"}`] : base[endpoint], delta);
    const snap = snapPoint(rawPoint, candidates);
    const point = snap?.point || rawPoint;
    const member = isLayout
      ? setMemberLayoutEndpoint(base, endpoint, point)
      : setMemberPhysicalEndpoint(base, endpoint, point);
    return {
      member,
      operation: { kind: isLayout ? "layout-endpoint" : "physical-endpoint", endpoint, point, coordinateSpace },
      snap,
      dragPoint: rawPoint
    };
  }

  function beginDrag({ handle, screen }) {
    if (handle?.kind === "coordinate-space-toggle") return false;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    const project = api.project();
    const member = memberById(project, handle?.memberId);
    if (!handle?.memberId || !member) return false;
    clearConnectionRefresh();
    activeMemberId = handle.memberId;
    selection.select([activeMemberId]);
    perfMark("member-drag-begin", { memberId: activeMemberId, handle: handle.kind });
    const snapStart = performance.now();
    const candidates = snapCandidates(project, localSnapOptions(project, member));
    perfMark("member-drag-snap-candidates-built", {
      memberId: activeMemberId,
      candidateCount: candidates.length,
      durationMs: performance.now() - snapStart
    });
    const previewsConnectedObjects = handle.kind === "move-member" || (handle.kind === "translate-axis" && handleTarget(handle) === "center");
    drag = {
      handle,
      startScreen: screen || handle.screen || null,
      baseMember: clone(member),
      candidates,
      previewObjectIds: previewsConnectedObjects
        ? [activeMemberId, ...connectionPreviewObjectIds(project, activeMemberId)]
        : []
    };
    if (drag.previewObjectIds.length) viewer.beginObjectPreview?.(drag.previewObjectIds);
    return true;
  }

  function showTransformDraft(draft) {
    if (!drag || !activeMemberId || !isPendingTransformOperation(draft.operation)) return;
    pendingTransform = {
      memberId: activeMemberId,
      baseMember: clone(drag.baseMember),
      draft,
      operation: draft.operation,
      coordinateSpace,
      previewObjectIds: [...(drag.previewObjectIds || [])],
      increment: pendingTransform?.increment || translationStepForScale(manipulatorSettings.translation || {}, viewer.screenScale()),
      committed: false,
      error: ""
    };
    emitTransformChange();
  }

  function updateLivePreview(draft) {
    const move = isMoveOperation(draft.operation);
    const previewObjectIds = drag?.previewObjectIds || pendingTransform?.previewObjectIds || [];
    const livePreview = viewer.updateMemberMovePreview?.(draft.member, {
      delta: move ? draft.operation.delta : [0, 0, 0],
      objectIds: move ? previewObjectIds : []
    });
    if (!move) {
      perfMark("member-drag-live-preview-updated", {
        memberId: activeMemberId,
        livePreview: Boolean(livePreview),
        previewObjectCount: 0,
        previewMode: draft.operation.kind
      });
      return;
    }
    perfMark("member-drag-live-preview-updated", {
      memberId: activeMemberId,
      livePreview: Boolean(livePreview),
      previewObjectCount: previewObjectIds.length,
      previewMode: "move"
    });
  }

  function updateDrag({ totalDx, totalDy, screen }) {
    if (!drag || !activeMemberId) return;
    pendingDrag = { totalDx, totalDy, screen };
    if (dragFramePending) return;
    dragFramePending = true;
    requestAnimationFrame(() => {
      dragFramePending = false;
      if (!drag || !activeMemberId || !pendingDrag) return;
      const current = pendingDrag;
      pendingDrag = null;
      const draft = draftFromDrag(current);
      if (!draft) return;
      drag.draft = draft;
      renderOverlay(draft.member, draft.snap, draft.dragPoint);
      updateLivePreview(draft);
      showTransformDraft(draft);
    });
  }

  function flushPendingDrag() {
    if (!drag || !activeMemberId || !pendingDrag) return;
    const current = pendingDrag;
    pendingDrag = null;
    const draft = draftFromDrag(current);
    if (!draft) return;
    drag.draft = draft;
    renderOverlay(draft.member, draft.snap, draft.dragPoint);
    updateLivePreview(draft);
    showTransformDraft(draft);
  }

  function commitDraft(memberId, draft, options = {}) {
    const deferConnections = isLargeProject(api.project());
    const commitOptions = deferConnections ? { regenerateConnections: false } : {};
    const currentMember = clone(memberById(api.project(), memberId));
    const moveDelta = draft.operation.kind === "move-member"
      ? moveDeltaBetweenMembers(currentMember, draft.member, draft.operation)
      : [0, 0, 0];
    let nextProject;
    perfMark("member-drag-commit-start", { memberId, operation: draft.operation.kind, deferConnections });
    if (draft.operation.kind === "move-member") {
      nextProject = api.moveMemberWithLayout(memberId, moveDelta, commitOptions);
    } else if (draft.operation.kind === "physical-endpoint") {
      nextProject = api.setMemberPhysicalEndpoint(memberId, draft.operation.endpoint, draft.operation.point, commitOptions);
    } else if (draft.operation.kind === "member-rotation") {
      nextProject = api.updateMember(memberId, draft.operation.patch, commitOptions);
    } else {
      nextProject = api.setMemberLayoutEndpoint(memberId, draft.operation.endpoint, draft.operation.point, commitOptions);
    }
    perfMark("member-drag-store-updated", { memberId });
    if (deferConnections) {
      const previewObjectIds = draft.operation.kind === "move-member"
        ? [memberId, ...connectionPreviewObjectIds(nextProject, memberId)]
        : [];
      const updatedInstance = viewer.updateMemberInstance?.(nextProject.model.members[memberId], {
        delta: moveDelta,
        translateObjectIds: previewObjectIds,
        project: nextProject
      });
      perfMark("member-drag-instance-updated", { memberId, updatedInstance: Boolean(updatedInstance), previewObjectCount: previewObjectIds.length });
    }
    if (!deferConnections) onProjectChange(nextProject);
    viewer.clearObjectPreview?.();
    selection.select([memberId]);
    renderOverlay();
    if (deferConnections) {
      queueConnectionRefresh(memberId);
      perfMark("member-drag-deferred-refresh-queued", { memberId });
    }
    if (options.message !== false) onMessage?.("Member updated.", "ok");
  }

  function commitDragTransform(draft) {
    if (!drag || !activeMemberId || !isPendingTransformOperation(draft.operation)) {
      const memberId = activeMemberId;
      drag = null;
      pendingDrag = null;
      if (memberId) commitDraft(memberId, draft);
      return;
    }
    const memberId = activeMemberId;
    const baseMember = clone(drag.baseMember);
    const previewObjectIds = [...(drag.previewObjectIds || [])];
    pendingTransform = {
      memberId,
      baseMember,
      draft,
      operation: draft.operation,
      coordinateSpace,
      previewObjectIds,
      increment: translationStepForScale(manipulatorSettings.translation || {}, viewer.screenScale()),
      committed: true,
      error: ""
    };
    drag = null;
    pendingDrag = null;
    selection.select([memberId]);
    emitTransformChange();
    commitDraft(memberId, draft);
  }

  function confirmPendingTransform() {
    if (!pendingTransform) return false;
    if (!pendingTransform.committed) {
      const transform = pendingTransform;
      pendingTransform = { ...pendingTransform, committed: true };
      commitDraft(transform.memberId, transform.draft);
    }
    return clearPendingTransform({ message: "" });
  }

  function cancelPendingTransform() {
    if (!pendingTransform) return false;
    if (!pendingTransform.committed) return clearPendingTransform({ message: "Member move cancelled." });
    const transform = pendingTransform;
    const baseOperation = transform.operation.kind === "move-member"
      ? { kind: "move-member", delta: [0, 0, 0], coordinateSpace: transform.coordinateSpace }
      : {
          kind: transform.operation.kind,
          endpoint: transform.operation.endpoint,
          point: operationTargetPoint(transform.baseMember, transform.operation),
          coordinateSpace: transform.coordinateSpace
        };
    const restoreDraft = {
      member: clone(transform.baseMember),
      operation: baseOperation,
      snap: null,
      dragPoint: operationTargetPoint(transform.baseMember, transform.operation)
    };
    pendingTransform = null;
    pendingDrag = null;
    emitTransformChange();
    commitDraft(transform.memberId, restoreDraft, { message: false });
    onMessage?.("Member move undone.", "ok");
    return true;
  }

  function endDrag() {
    flushPendingDrag();
    if (!drag?.draft || !activeMemberId) {
      drag = null;
      pendingDrag = null;
      viewer.clearObjectPreview?.();
      renderOverlay();
      return;
    }
    commitDragTransform(drag.draft);
  }

  function cancelDrag() {
    drag = null;
    pendingDrag = null;
    clearConnectionRefresh();
    viewer.clearObjectPreview?.();
    renderOverlay();
  }

  function handleSceneClick(face) {
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    if (face?.collection === "members" && face.objectId) {
      selectMember(face.objectId);
      return;
    }
    clear();
    selection.clear();
  }

  function handleAuthoringClick({ handle }) {
    if (handle?.kind !== "coordinate-space-toggle") return false;
    if (drag) return false;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    return toggleCoordinateSpace();
  }

  api.subscribe(() => {
    if (pendingTransform && !pendingTransform.committed && activeMemberId && memberById(api.project(), activeMemberId)) {
      renderOverlay(pendingTransform.draft.member, pendingTransform.draft.snap, pendingTransform.draft.dragPoint);
      emitTransformChange();
      return;
    }
    if (activeMemberId && memberById(api.project(), activeMemberId)) renderOverlay();
    if (activeMemberId && !memberById(api.project(), activeMemberId)) clear();
  });

  viewer.setAuthoringHandler({
    beginDrag,
    click: handleAuthoringClick,
    drag: updateDrag,
    end: endDrag,
    cancel: cancelDrag
  });

  return {
    cancelPendingTransform,
    clear,
    confirmPendingTransform,
    coordinateSpace: () => coordinateSpace,
    handleSceneClick,
    nudgePendingTransform,
    pendingTransformState: transformState,
    selectMember,
    setCoordinateSpace,
    setPendingTransformDelta,
    setPendingTransformIncrement,
    setPendingTransformResult,
    toggleCoordinateSpace
  };
}
