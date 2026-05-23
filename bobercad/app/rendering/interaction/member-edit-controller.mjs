import { v } from "../../engine/core/math.mjs";
import {
  clone,
  memberAuthoringPoints,
  moveMemberWithLayout,
  setMemberLayoutEndpoint,
  setMemberPhysicalEndpoint
} from "../../engine/api/project/members.mjs";
import { snapCandidates } from "../../engine/api/project/snapping.mjs";
import { memberAuthoringOverlay } from "../scene/build-authoring-overlays.mjs";
import { nearestScreenSnap } from "./snap-controller.mjs";

function memberById(project, memberId) {
  return project.model?.members?.[memberId] || null;
}

function handleEndpoint(kind) {
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

export function createMemberEditController({ viewer, api, selection, onProjectChange, onLocalProjectChange, onMemberSelected, onCleared, onMessage }) {
  let activeMemberId = null;
  let drag = null;
  let pendingDrag = null;
  let dragFramePending = false;
  let connectionRefreshTimer = null;
  let connectionRefreshIdle = null;

  function renderOverlay(member = null, snap = null, dragPoint = null) {
    if (!activeMemberId) {
      viewer.setAuthoringOverlay(null);
      return;
    }
    viewer.setAuthoringOverlay(memberAuthoringOverlay(api.project(), activeMemberId, { member, snap, dragPoint }));
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
    perfMark("member-select-start", { memberId });
    activeMemberId = memberId;
    selection.select([memberId]);
    renderOverlay();
    if (options.notify !== false) onMemberSelected?.(memberId);
    onMessage?.(`Selected ${memberId}.`, "ok");
    perfMark("member-select-finished", { memberId });
  }

  function clear(options = {}) {
    activeMemberId = null;
    drag = null;
    pendingDrag = null;
    clearConnectionRefresh();
    viewer.clearObjectPreview?.();
    viewer.setAuthoringOverlay(null);
    if (options.notify !== false) onCleared?.();
  }

  function snapPoint(point, candidates) {
    return nearestScreenSnap({
      candidates,
      viewer,
      point,
      excludeObjectId: activeMemberId,
      screenTolerance: 14
    });
  }

  function draftFromDrag(totalDx, totalDy) {
    const delta = viewer.screenDeltaToWorld(totalDx, totalDy);
    const base = drag.baseMember;
    const candidates = drag.candidates;
    const kind = drag.handle.kind;
    const points = memberAuthoringPoints(base);

    if (kind === "move-member") {
      const rawCenter = v.add(points.center, delta);
      const snap = snapPoint(rawCenter, candidates);
      const moveDelta = snap ? v.sub(snap.point, points.center) : delta;
      return { member: moveMemberWithLayout(base, moveDelta), operation: { kind, delta: moveDelta }, snap, dragPoint: rawCenter };
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
      operation: { kind: isLayout ? "layout-endpoint" : "physical-endpoint", endpoint, point },
      snap,
      dragPoint: rawPoint
    };
  }

  function beginDrag({ handle }) {
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
    drag = {
      handle,
      baseMember: clone(member),
      candidates,
      previewObjectIds: handle.kind === "move-member"
        ? [activeMemberId, ...connectionPreviewObjectIds(project, activeMemberId)]
        : []
    };
    if (drag.previewObjectIds.length) viewer.beginObjectPreview?.(drag.previewObjectIds);
    return true;
  }

  function updateLivePreview(draft) {
    const move = isMoveOperation(draft.operation);
    if (!move) {
      perfMark("member-drag-live-preview-updated", {
        memberId: activeMemberId,
        livePreview: false,
        previewObjectCount: 0,
        previewMode: "endpoint"
      });
      return;
    }
    const livePreview = viewer.updateMemberMovePreview?.(draft.member, {
      delta: draft.operation.delta,
      objectIds: drag.previewObjectIds
    });
    perfMark("member-drag-live-preview-updated", {
      memberId: activeMemberId,
      livePreview: Boolean(livePreview),
      previewObjectCount: drag.previewObjectIds.length,
      previewMode: "move"
    });
  }

  function updateDrag({ totalDx, totalDy }) {
    if (!drag || !activeMemberId) return;
    pendingDrag = { totalDx, totalDy };
    if (dragFramePending) return;
    dragFramePending = true;
    requestAnimationFrame(() => {
      dragFramePending = false;
      if (!drag || !activeMemberId || !pendingDrag) return;
      const current = pendingDrag;
      pendingDrag = null;
      const draft = draftFromDrag(current.totalDx, current.totalDy);
      if (!draft) return;
      drag.draft = draft;
      renderOverlay(draft.member, draft.snap, draft.dragPoint);
      updateLivePreview(draft);
    });
  }

  function flushPendingDrag() {
    if (!drag || !activeMemberId || !pendingDrag) return;
    const current = pendingDrag;
    pendingDrag = null;
    const draft = draftFromDrag(current.totalDx, current.totalDy);
    if (!draft) return;
    drag.draft = draft;
    renderOverlay(draft.member, draft.snap, draft.dragPoint);
    updateLivePreview(draft);
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
    const draft = drag.draft;
    const memberId = activeMemberId;
    const deferConnections = isLargeProject(api.project());
    const commitOptions = deferConnections ? { regenerateConnections: false } : {};
    drag = null;
    pendingDrag = null;
    let nextProject;
    perfMark("member-drag-commit-start", { memberId, operation: draft.operation.kind, deferConnections });
    if (draft.operation.kind === "move-member") {
      nextProject = api.moveMemberWithLayout(memberId, draft.operation.delta, commitOptions);
    } else if (draft.operation.kind === "physical-endpoint") {
      nextProject = api.setMemberPhysicalEndpoint(memberId, draft.operation.endpoint, draft.operation.point, commitOptions);
    } else {
      nextProject = api.setMemberLayoutEndpoint(memberId, draft.operation.endpoint, draft.operation.point, commitOptions);
    }
    perfMark("member-drag-store-updated", { memberId });
    if (deferConnections) {
      const previewObjectIds = draft.operation.kind === "move-member"
        ? [memberId, ...connectionPreviewObjectIds(nextProject, memberId)]
        : [];
      const updatedInstance = viewer.updateMemberInstance?.(nextProject.model.members[memberId], {
        delta: draft.operation.delta,
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
    onMessage?.("Member updated.", "ok");
  }

  function cancelDrag() {
    drag = null;
    pendingDrag = null;
    clearConnectionRefresh();
    viewer.clearObjectPreview?.();
    renderOverlay();
  }

  function handleSceneClick(face) {
    if (face?.collection === "members" && face.objectId) {
      selectMember(face.objectId);
      return;
    }
    clear();
    selection.clear();
  }

  api.subscribe(() => {
    if (activeMemberId && memberById(api.project(), activeMemberId)) renderOverlay();
    if (activeMemberId && !memberById(api.project(), activeMemberId)) clear();
  });

  viewer.setAuthoringHandler({
    beginDrag,
    drag: updateDrag,
    end: endDrag,
    cancel: cancelDrag
  });

  return {
    clear,
    handleSceneClick,
    selectMember
  };
}
