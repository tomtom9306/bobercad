import { v } from "../../engine/core/math.mjs";
import {
  clone,
  memberAuthoringPoints,
  moveMemberWithLayout,
  setMemberLayoutEndpoint,
  setMemberPhysicalEndpoint
} from "../../engine/api/project/members.mjs";
import {
  affectedObjectIdsForMemberChange
} from "../../engine/api/project/dependencies.mjs";
import {
  axisForRelation,
  axisRelationForEndpoint,
  axisRelationFromSnap,
  axisRelationLabel,
  memberAlignmentRelation,
  projectPointToAxis
} from "../../engine/api/project/axis-relations.mjs?v=relation-types-1";
import { snapCandidates } from "../../engine/api/project/snap-candidates.mjs?v=snap-architecture-1";
import { solveSnap } from "../../engine/api/project/snap-solver.mjs?v=snap-architecture-1";
import {
  memberAxesForTarget,
  normalizeCoordinateSpace,
  vectorComponentsInAxes,
  vectorFromAxisComponents
} from "../scene/authoring/member-axis-space.mjs";
import { memberAuthoringOverlay } from "../scene/build-authoring-overlays.mjs?v=endpoint-axis-origins-1";
import {
  axisScreenDistance,
  quantizeDegrees,
  quantizeDistance,
  rotateMemberAroundAxis,
  signedScreenAngleDegrees,
  translationStepForScale
} from "./manipulator-math.mjs";

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

function oppositeHandlePoint(member, handle) {
  const points = memberAuthoringPoints(member);
  const target = handleTarget(handle);
  const layout = handle?.kind?.startsWith("layout-");
  if (target === "start") return layout ? points.layoutEnd : points.physicalEnd;
  if (target === "end") return layout ? points.layoutStart : points.physicalStart;
  return null;
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

const WORLD_ORIGIN = [0, 0, 0];

const WORLD_AXIS_DIRECTIONS = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1]
};

function samePoint(a, b) {
  return Array.isArray(a) && Array.isArray(b) && v.len(v.sub(a, b)) <= 1e-9;
}

function uniquePoints(points) {
  const result = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 3) continue;
    if (!result.some((existing) => samePoint(existing, point))) result.push(point);
  }
  return result;
}

function globalAxisOriginsForHandle(member, handle) {
  const target = handleTarget(handle);
  if (target === "center") return [handlePoint(member, handle)];
  return uniquePoints([handlePoint(member, handle), oppositeHandlePoint(member, handle)]);
}

function globalAxisGuidesForDrag(dragState) {
  if (!dragState?.handle || handleTarget(dragState.handle) === "center") return [];
  if (dragState.handle.kind === "rotate-axis") return [];
  return globalAxisOriginsForHandle(dragState.baseMember, dragState.handle);
}

function dragGuideAxisCandidates(origin, span, tolerancePx) {
  if (!origin) return [];
  return Object.entries(WORLD_AXIS_DIRECTIONS).map(([axis, direction]) => ({
    kind: "line",
    type: "drag-guide-axis",
    axis,
    a: v.sub(origin, v.mul(direction, span)),
    b: v.add(origin, v.mul(direction, span)),
    point: [...origin],
    label: `Drag ${axis.toUpperCase()} guide`,
    priority: 225,
    screenTolerance: tolerancePx,
    screenIntersectionMode: "self"
  }));
}

export function createMemberEditController({ viewer, api, selection, settings = {}, onLocalProjectChange, onMemberSelected, onCleared, onMessage, onTransformChange, autoRelationsEnabled = () => false }) {
  let activeMemberId = null;
  let drag = null;
  let pendingTransform = null;
  let pendingDrag = null;
  let dragFramePending = false;
  let smartRebuildTimer = null;
  let smartRebuildRevision = 0;
  let semanticPreview = null;
  const authoringSettings = settings.authoring || {};
  const manipulatorSettings = authoringSettings.manipulator || {};
  const smartRebuildDelayMs = Number.isFinite(authoringSettings.smartRebuildDelayMs)
    ? Math.max(0, authoringSettings.smartRebuildDelayMs)
    : 500;
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
      },
      globalAxesOrigins: globalAxisGuidesForDrag(drag),
      globalAxesSpan: authoringSettings.globalAxisGuideSpan || 12000
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
    if (!pendingTransform.committed) restoreSemanticPreview();
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
      const result = endpointAxisDraft(baseMember, operation.endpoint, operation.point, null, operation.axisRelation || null, null, {
        detachAutoRelation: Boolean(operation.detachedAxisRelationId)
      });
      return {
        member: result.member,
        operation,
        snap: result.snap,
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
      axisRelation: operation.axisRelation || null,
      detachedAxisRelationId: operation.detachedAxisRelationId || null,
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

  function applyLocalProjectChange(nextProject, memberId, affectedObjectIds) {
    if (typeof onLocalProjectChange !== "function") {
      throw new Error("member edit requires an affected-object project patch handler");
    }
    if (onLocalProjectChange(nextProject, memberId, affectedObjectIds) === false) {
      throw new Error("member edit affected-object patch failed");
    }
  }

  function clearSmartRebuild() {
    smartRebuildRevision += 1;
    if (smartRebuildTimer !== null) {
      clearTimeout(smartRebuildTimer);
      smartRebuildTimer = null;
    }
  }

  function clearSemanticPreview() {
    semanticPreview = null;
  }

  function semanticPreviewBaseDelta(draft) {
    if (!semanticPreview || !isMoveOperation(draft.operation) || !isMoveOperation(semanticPreview.draft.operation)) return [0, 0, 0];
    return v.sub(draft.operation.delta, semanticPreview.draft.operation.delta);
  }

  function restoreSemanticPreview() {
    if (!semanticPreview?.project || !activeMemberId) {
      clearSemanticPreview();
      return;
    }
    const memberId = activeMemberId;
    const baseProject = api.project();
    const affectedObjectIds = affectedObjectIdsForMemberChange(semanticPreview.project, baseProject, memberId, { renderableOnly: true });
    viewer.clearObjectPreview?.();
    applyLocalProjectChange(baseProject, memberId, affectedObjectIds);
    clearSemanticPreview();
  }

  function applySemanticPreview(draft, revision) {
    if (!drag || !activeMemberId || revision !== smartRebuildRevision) return;
    if (typeof api.draftMemberProject !== "function") throw new Error("member edit requires draft member project API");
    const memberId = activeMemberId;
    const baseProject = api.project();
    const draftProject = api.draftMemberProject(memberId, draft.member);
    if (!drag || activeMemberId !== memberId || revision !== smartRebuildRevision) return;
    const affectedObjectIds = affectedObjectIdsForMemberChange(baseProject, draftProject, memberId, { renderableOnly: true });
    viewer.clearObjectPreview?.();
    applyLocalProjectChange(draftProject, memberId, affectedObjectIds);
    semanticPreview = {
      revision,
      project: draftProject,
      draft,
      affectedObjectIds
    };
    renderOverlay(draft.member, draft.snap, draft.dragPoint);
    perfMark("member-drag-smart-rebuild-finished", { memberId, affectedObjectCount: affectedObjectIds.length });
  }

  function queueSmartRebuild(draft) {
    clearSmartRebuild();
    if (!drag || !activeMemberId || !draft?.member) return;
    const revision = smartRebuildRevision;
    smartRebuildTimer = setTimeout(() => {
      smartRebuildTimer = null;
      try {
        perfMark("member-drag-smart-rebuild-start", { memberId: activeMemberId });
        applySemanticPreview(draft, revision);
      } catch (error) {
        semanticPreview = null;
        if (pendingTransform) {
          pendingTransform = { ...pendingTransform, error: error.message };
          emitTransformChange();
        }
        onMessage?.(error.message, "error");
      }
    }, smartRebuildDelayMs);
  }

  function selectMember(memberId, options = {}) {
    if (!memberById(api.project(), memberId)) return;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    perfMark("member-select-start", { memberId });
    activeMemberId = memberId;
    selection.cancelPick?.({ clear: false });
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
    clearSmartRebuild();
    restoreSemanticPreview();
    activeMemberId = null;
    drag = null;
    pendingTransform = null;
    pendingDrag = null;
    viewer.clearObjectPreview?.();
    viewer.setAuthoringOverlay(null);
    emitTransformChange();
    if (options.notify !== false) onCleared?.();
  }

  function snapAtCursor(screen, candidates) {
    if (!screen) return null;
    return solveSnap({
      candidates,
      viewer,
      screen,
      rawPoint: null,
      excludeObjectId: activeMemberId,
      screenTolerance: authoringSettings.snapTolerancePx || 14,
      pointPriorityBiasPx: authoringSettings.pointSnapBiasPx,
      intersectionPriorityBiasPx: authoringSettings.intersectionSnapBiasPx
    }).snap;
  }

  function standardDragPoint(basePoint, input) {
    return v.add(basePoint, viewer.screenDeltaToWorld(input.totalDx, input.totalDy));
  }

  function pointOnViewPlaneAtCursor(basePoint, input) {
    if (!input?.screen) return standardDragPoint(basePoint, input);
    const ray = viewer.screenRay(input.screen.x, input.screen.y);
    const denominator = v.dot(ray.direction, ray.direction);
    if (denominator <= 1e-12) return standardDragPoint(basePoint, input);
    const distance = v.dot(v.sub(basePoint, ray.origin), ray.direction) / denominator;
    return v.add(ray.origin, v.mul(ray.direction, distance));
  }

  function visibleHitPoint(input) {
    if (!input?.hit?.point) return null;
    if (input.hit.face?.objectId === activeMemberId) return null;
    return input.hit.point;
  }

  function cursorDepthPoint(basePoint, input, candidates) {
    const snap = snapAtCursor(input.screen, candidates);
    if (snap?.point) return { point: snap.point, snap, dragPoint: snap.point };
    const hitPoint = visibleHitPoint(input);
    if (hitPoint) return { point: hitPoint, snap: null, dragPoint: hitPoint };
    const point = pointOnViewPlaneAtCursor(basePoint, input);
    return { point, snap: null, dragPoint: point };
  }

  function closestAxisPoints(axisA, axisB) {
    const a0 = axisA.a;
    const b0 = axisB.a;
    const ad = v.norm(v.sub(axisA.b, axisA.a));
    const bd = v.norm(v.sub(axisB.b, axisB.a));
    const r = v.sub(a0, b0);
    const dot = v.dot(ad, bd);
    const c = v.dot(ad, r);
    const f = v.dot(bd, r);
    const denominator = 1 - dot * dot;
    const s = Math.abs(denominator) <= 1e-9 ? 0 : (dot * f - c) / denominator;
    const t = Math.abs(denominator) <= 1e-9 ? f : (f - dot * c) / denominator;
    const pointA = v.add(a0, v.mul(ad, s));
    const pointB = v.add(b0, v.mul(bd, t));
    return { pointA, pointB, distance: v.len(v.sub(pointA, pointB)) };
  }

  function pointOnAxisNearestScreen(axis, screen, fallbackPoint) {
    if (!screen) return fallbackPoint;
    const a = axis.a;
    const b = axis.b;
    const screenA = viewer.projectPoint(a);
    const screenB = viewer.projectPoint(b);
    if (!screenA || !screenB) return fallbackPoint;
    const dx = screenB.x - screenA.x;
    const dy = screenB.y - screenA.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-9) return fallbackPoint;
    const t = ((screen.x - screenA.x) * dx + (screen.y - screenA.y) * dy) / lengthSq;
    return v.add(a, v.mul(v.sub(b, a), t));
  }

  function endpointAxisDraft(baseMember, endpoint, rawPoint, snap = null, forcedRelation = null, screen = null, options = {}) {
    const project = api.project();
    const snapRelation = autoRelationsEnabled() ? axisRelationFromSnap(baseMember.id, endpoint, snap) : null;
    let relation = forcedRelation || snapRelation;
    let detachedAxisRelationId = null;
    const alignmentRelation = memberAlignmentRelation(project, baseMember.id);
    let point = snap?.point || rawPoint;
    if (!relation) {
      const storedRelation = axisRelationForEndpoint(project, baseMember.id, endpoint);
      if (options.detachAutoRelation && storedRelation?.createdBy === "auto-snap") {
        detachedAxisRelationId = storedRelation.id;
      } else {
        relation = storedRelation;
      }
    }
    if (relation && alignmentRelation) {
      const pointAxis = axisForRelation(project, relation, baseMember, endpoint);
      const alignmentAxis = axisForRelation(project, alignmentRelation, baseMember, endpoint);
      const closest = closestAxisPoints(pointAxis, alignmentAxis);
      point = closest.pointB;
      const label = closest.distance > (authoringSettings.relationConflictTolerance || 1)
        ? `Relation conflict: ${axisRelationLabel(relation)} + ${axisRelationLabel(alignmentRelation)}`
        : `${axisRelationLabel(relation)} + ${axisRelationLabel(alignmentRelation)}`;
      snap = { ...(snap || { kind: "line", type: "axis-relation" }), point, label };
    } else if (relation || alignmentRelation) {
      const activeRelation = relation || alignmentRelation;
      const activeAxis = axisForRelation(project, activeRelation, baseMember, endpoint);
      point = projectPointToAxis(activeAxis, pointOnAxisNearestScreen(activeAxis, screen, point));
      snap = snap
        ? { ...snap, point, label: snap.label || axisRelationLabel(activeRelation) }
        : {
            kind: "line",
            type: activeRelation.source?.type === "global-axis" ? "global-axis" : "axis-relation",
            axis: activeRelation.source?.axis,
            point,
            label: axisRelationLabel(activeRelation)
          };
    }
    const member = setMemberPhysicalEndpoint(baseMember, endpoint, point);
    return { member, point, snap, relation, detachedAxisRelationId };
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

  function axisSnap(basePoint, axis, rawPoint, candidates, screen) {
    const snap = snapAtCursor(screen, candidates);
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
    const snapResult = axisSnap(basePoint, axis, rawPoint, candidates, input.screen);
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

    const result = endpointAxisDraft(base, target, point, snapResult.snap, null, input.screen, {
      detachAutoRelation: true
    });
    return {
      member: result.member,
      operation: {
        kind: "physical-endpoint",
        endpoint: target,
        point: result.point,
        axisRelation: result.relation,
        detachedAxisRelationId: result.detachedAxisRelationId,
        coordinateSpace
      },
      snap: result.snap,
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
        patch: memberGeometryPatch(member, base)
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
      const snap = snapAtCursor(input.screen, candidates);
      const moveDelta = snap ? v.sub(snap.point, points.center) : delta;
      return { member: moveMemberWithLayout(base, moveDelta), operation: { kind, delta: moveDelta, coordinateSpace }, snap, dragPoint: rawCenter };
    }

    const endpoint = handleEndpoint(kind);
    if (!endpoint) return null;
    const isLayout = kind.startsWith("layout-");
    const basePoint = isLayout ? points[`layout${endpoint === "start" ? "Start" : "End"}`] : base[endpoint];
    const resolved = cursorDepthPoint(basePoint, input, candidates);
    if (isLayout) {
      const point = resolved.point;
      const member = setMemberLayoutEndpoint(base, endpoint, point);
      return {
        member,
        operation: { kind: "layout-endpoint", endpoint, point, coordinateSpace },
        snap: resolved.snap,
        dragPoint: resolved.dragPoint
      };
    }
    const result = endpointAxisDraft(base, endpoint, resolved.point, resolved.snap, null, input.screen, {
      detachAutoRelation: true
    });
    return {
      member: result.member,
      operation: {
        kind: "physical-endpoint",
        endpoint,
        point: result.point,
        axisRelation: result.relation,
        detachedAxisRelationId: result.detachedAxisRelationId,
        coordinateSpace
      },
      snap: result.snap,
      dragPoint: resolved.dragPoint
    };
  }

  function beginDrag({ handle, screen }) {
    if (handle?.kind === "coordinate-space-toggle") return false;
    if (pendingTransform) clearPendingTransform({ restoreOverlay: false, clearPreview: !pendingTransform.committed });
    clearSmartRebuild();
    restoreSemanticPreview();
    const project = api.project();
    const member = memberById(project, handle?.memberId);
    if (!handle?.memberId || !member) return false;
    activeMemberId = handle.memberId;
    selection.cancelPick?.({ clear: false });
    selection.select([activeMemberId]);
    perfMark("member-drag-begin", { memberId: activeMemberId, handle: handle.kind });
    const snapStart = performance.now();
    const candidates = snapCandidates(project, {
      ...localSnapOptions(project, member),
      includeGlobalAxes: true,
      globalAxisOrigin: WORLD_ORIGIN,
      globalAxisSpan: authoringSettings.globalAxisSnapSpan || 100000,
      globalAxisSnapTolerancePx: authoringSettings.globalAxisSnapTolerancePx || 34
    });
    for (const origin of globalAxisOriginsForHandle(member, handle)) {
      candidates.push(...dragGuideAxisCandidates(
        origin,
        authoringSettings.globalAxisSnapSpan || 100000,
        authoringSettings.globalAxisSnapTolerancePx || 34
      ));
    }
    perfMark("member-drag-snap-candidates-built", {
      memberId: activeMemberId,
      candidateCount: candidates.length,
      durationMs: performance.now() - snapStart
    });
    drag = {
      handle,
      startScreen: screen || handle.screen || null,
      baseMember: clone(member),
      candidates,
      previewObjectIds: []
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
    const previewDelta = move && semanticPreview
      ? semanticPreviewBaseDelta(draft)
      : move ? draft.operation.delta : [0, 0, 0];
    const livePreview = viewer.updateMemberMovePreview?.(draft.member, {
      delta: previewDelta,
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

  function updateDrag({ totalDx, totalDy, screen, hit }) {
    if (!drag || !activeMemberId) return;
    pendingDrag = { totalDx, totalDy, screen, hit };
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
      queueSmartRebuild(draft);
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
    clearSmartRebuild();
    const beforeProject = api.project();
    const commitOptions = { regenerateSmartComponents: false };
    const currentMember = clone(memberById(api.project(), memberId));
    const moveDelta = draft.operation.kind === "move-member"
      ? moveDeltaBetweenMembers(currentMember, draft.member, draft.operation)
      : [0, 0, 0];
    let nextProject;
    perfMark("member-drag-commit-start", { memberId, operation: draft.operation.kind, localPatch: true });
    if (draft.operation.kind === "move-member") {
      nextProject = api.moveMemberWithLayout(memberId, moveDelta, commitOptions);
    } else if (draft.operation.kind === "physical-endpoint") {
      nextProject = api.updateMember(memberId, memberGeometryPatch(draft.member, currentMember), commitOptions);
      if (draft.operation.axisRelation?.createdBy === "auto-snap") {
        nextProject = api.upsertRelation(draft.operation.axisRelation);
      } else if (draft.operation.detachedAxisRelationId && api.project().model?.relations?.[draft.operation.detachedAxisRelationId]) {
        nextProject = api.deleteRelation(draft.operation.detachedAxisRelationId);
      }
    } else if (draft.operation.kind === "member-rotation") {
      nextProject = api.updateMember(memberId, draft.operation.patch, commitOptions);
    } else {
      nextProject = api.updateMember(memberId, memberGeometryPatch(draft.member, currentMember), commitOptions);
    }
    perfMark("member-drag-store-updated", { memberId });

    if (typeof api.regenerateMemberSmartComponents !== "function") {
      throw new Error("member edit requires member Smart Component regeneration API");
    }
    nextProject = api.regenerateMemberSmartComponents(memberId);
    const affectedObjectIds = affectedObjectIdsForMemberChange(beforeProject, nextProject, memberId, { renderableOnly: true });
    viewer.clearObjectPreview?.();
    applyLocalProjectChange(nextProject, memberId, affectedObjectIds);
    clearSemanticPreview();
    selection.select([memberId]);
    renderOverlay();
    perfMark("member-drag-local-patch-finished", { memberId, affectedObjectCount: affectedObjectIds.length });
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
    clearSmartRebuild();
    flushPendingDrag();
    if (!drag?.draft || !activeMemberId) {
      drag = null;
      pendingDrag = null;
      viewer.clearObjectPreview?.();
      restoreSemanticPreview();
      renderOverlay();
      return;
    }
    commitDragTransform(drag.draft);
  }

  function cancelDrag() {
    clearSmartRebuild();
    drag = null;
    pendingDrag = null;
    viewer.clearObjectPreview?.();
    restoreSemanticPreview();
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

  const authoringHandler = {
    beginDrag,
    click: handleAuthoringClick,
    drag: updateDrag,
    end: endDrag,
    cancel: cancelDrag
  };
  viewer.setAuthoringHandler(authoringHandler);

  return {
    authoringHandler,
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
