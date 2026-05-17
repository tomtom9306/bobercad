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

export function createMemberEditController({ viewer, api, selection, onProjectChange, onMemberSelected, onCleared, onMessage }) {
  let activeMemberId = null;
  let drag = null;

  function renderOverlay(member = null, snap = null, dragPoint = null) {
    if (!activeMemberId) {
      viewer.setAuthoringOverlay(null);
      return;
    }
    viewer.setAuthoringOverlay(memberAuthoringOverlay(api.project(), activeMemberId, { member, snap, dragPoint }));
  }

  function selectMember(memberId, options = {}) {
    if (!memberById(api.project(), memberId)) return;
    activeMemberId = memberId;
    selection.select([memberId]);
    renderOverlay();
    if (options.notify !== false) onMemberSelected?.(memberId);
    onMessage?.(`Selected ${memberId}.`, "ok");
  }

  function clear(options = {}) {
    activeMemberId = null;
    drag = null;
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
    if (!handle?.memberId || !memberById(api.project(), handle.memberId)) return false;
    activeMemberId = handle.memberId;
    selection.select([activeMemberId]);
    drag = {
      handle,
      baseMember: clone(memberById(api.project(), activeMemberId)),
      candidates: snapCandidates(api.project())
    };
    return true;
  }

  function updateDrag({ totalDx, totalDy }) {
    if (!drag || !activeMemberId) return;
    const draft = draftFromDrag(totalDx, totalDy);
    if (!draft) return;
    drag.draft = draft;
    renderOverlay(draft.member, draft.snap, draft.dragPoint);
  }

  function endDrag() {
    if (!drag?.draft || !activeMemberId) {
      drag = null;
      renderOverlay();
      return;
    }
    const draft = drag.draft;
    drag = null;
    let nextProject;
    if (draft.operation.kind === "move-member") {
      nextProject = api.moveMemberWithLayout(activeMemberId, draft.operation.delta);
    } else if (draft.operation.kind === "physical-endpoint") {
      nextProject = api.setMemberPhysicalEndpoint(activeMemberId, draft.operation.endpoint, draft.operation.point);
    } else {
      nextProject = api.setMemberLayoutEndpoint(activeMemberId, draft.operation.endpoint, draft.operation.point);
    }
    onProjectChange(nextProject);
    selection.select([activeMemberId]);
    renderOverlay();
    onMessage?.("Member updated.", "ok");
  }

  function cancelDrag() {
    drag = null;
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
