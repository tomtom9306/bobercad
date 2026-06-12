import { projectPointToPlane, pointToPlaneCoordinates } from "../../engine/api/project/work-plane.mjs?v=finite-point-api-dry-1";
import { finiteNumberOr, v } from "../../engine/core/math.mjs?v=world-axis-dry-1";
import { solveSnap } from "../../engine/api/project/snap-solver.mjs?v=unified-snap-manager-10";
import { collectSnapCandidates } from "./snap-providers.mjs?v=unified-snap-manager-9";
import { snapProfile } from "./snap-profiles.mjs?v=unified-snap-manager-10";

function defaultScopeManager() {
  return {
    scope: () => ({}),
    candidateAllowed: () => true
  };
}

function snapLabel(snap) {
  return snap?.label || snap?.type || "Snap";
}

function projectedSnap(snap, plane) {
  if (!snap || !plane?.origin || !v.isVec3(snap.point)) return snap;
  const projected = projectPointToPlane(snap.point, plane);
  return {
    ...snap,
    originalPoint: snap.point,
    point: projected,
    pointLocal: pointToPlaneCoordinates(projected, plane),
    label: snapLabel(snap)
  };
}

function snapDiagnostic(result, data = {}) {
  return {
    accepted: Boolean(result.accepted),
    providerId: result.providerId || null,
    type: result.type || null,
    label: result.label || null,
    target: result.target || null,
    strength: result.strength || null,
    candidateCount: Array.isArray(result.candidates) ? result.candidates.length : 0,
    cycleIndex: data.cycleIndex || 0,
    cycleGroup: data.cycleGroup || null,
    scope: data.scope || {}
  };
}

function candidateDiagnostic(candidate, status, reason) {
  return {
    candidateId: candidate?.candidateId || [
      candidate?.providerId || "provider",
      candidate?.type || candidate?.kind || "candidate",
      candidate?.target?.collection,
      candidate?.target?.objectId,
      candidate?.target?.subId,
      candidate?.objectId
    ].filter(Boolean).join(":"),
    status,
    reason,
    providerId: candidate?.providerId || null,
    type: candidate?.type || null,
    kind: candidate?.kind || null,
    label: candidate?.label || null,
    target: candidate?.target || null,
    priority: Number.isFinite(candidate?.priority) ? candidate.priority : null
  };
}

function resultFromSnap({ snap, rawPoint, plane, profile, candidates, diagnostics = [], cycleIndex = 0, cycleGroup = null, scope = {} }) {
  let result;
  if (!snap?.point) {
    result = {
      accepted: false,
      pointWorld: rawPoint || null,
      pointLocal: plane?.origin && v.isVec3(rawPoint) ? pointToPlaneCoordinates(rawPoint, plane) : null,
      rawPointWorld: rawPoint || null,
      snap: null,
      relationHints: [],
      candidates,
      cycleIndex,
      cycleGroup,
      scope
    };
    result.diagnostics = diagnostics.length
      ? diagnostics
      : [candidateDiagnostic(null, profile?.enabled === false ? "disabled" : "rejected", profile?.enabled === false ? "snap strength off" : "no accepted candidates")];
    return result;
  }
  const pointWorld = snap.point;
  result = {
    accepted: true,
    pointWorld,
    pointLocal: snap.pointLocal || (plane?.origin ? pointToPlaneCoordinates(pointWorld, plane) : null),
    rawPointWorld: rawPoint || null,
    label: snapLabel(snap),
    strength: profile.strength,
    providerId: snap.providerId || null,
    type: snap.type || null,
    target: snap.target || null,
    relationHints: Array.isArray(snap.relationHints) ? snap.relationHints : [],
    preview: {
      marker: snap.kind || "point",
      guideLines: Array.isArray(snap.sources) ? snap.sources.filter((source) => source?.kind === "line") : [],
      highlightObjectIds: snap.objectId ? [snap.objectId] : []
    },
    snap,
    candidates,
    cycleIndex,
    cycleGroup,
    scope
  };
  result.diagnostics = diagnostics.length ? diagnostics : [candidateDiagnostic(snap, "accepted", "selected")];
  return result;
}

function scopeFilterCandidates(project, candidates = [], scopeManager, context = {}) {
  const accepted = [];
  const rejected = [];
  for (const candidate of candidates) {
    const allowed = scopeManager.candidateAllowed?.(project, candidate, {
      smartComponentId: context.smartComponentId
    }) !== false;
    if (allowed) {
      accepted.push(candidate);
    } else {
      rejected.push(candidateDiagnostic(candidate, "rejected", "filtered by selection/snap scope"));
    }
  }
  return { accepted, rejected };
}

export function createSnapManager({ viewer, api = null, profiles = {}, settings = {}, selectionScope = null } = {}) {
  const scopeManager = selectionScope || defaultScopeManager();
  const authoringSettings = () => settings.authoring || settings || {};
  const project = () => api?.project?.() || api?.project || null;
  let cycleState = { group: null, index: 0 };
  let lastSnapshot = null;

  function profile(options = {}) {
    return snapProfile(authoringSettings(), options);
  }

  function scope() {
    return scopeManager.scope?.() || {};
  }

  function roundedPointKey(point) {
    return v.isVec3(point) ? point.map((value) => Math.round(value * 10) / 10).join(",") : "";
  }

  function roundedScreenKey(screen) {
    return screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)
      ? `${Math.round(screen.x)},${Math.round(screen.y)}`
      : "";
  }

  function cycleGroupFor(input = {}) {
    const context = input.context || {};
    return [
      context.tool || "",
      context.phase || "",
      context.activeObjectId || "",
      context.excludeObjectId || input.excludeObjectId || "",
      context.smartComponentId || "",
      context.memberType || "",
      context.axisGuideMode || "",
      context.projectToPlane === false ? "world" : "plane",
      roundedScreenKey(input.screen),
      roundedPointKey(input.rawPoint)
    ].join("|");
  }

  function resetCycle() {
    cycleState = { group: null, index: 0 };
  }

  function cycle() {
    cycleState = {
      group: cycleState.group,
      index: cycleState.index + 1
    };
    return cycleState.index;
  }

  function cycleIndexFor(input = {}) {
    if (Number.isFinite(input.cycleIndex)) return input.cycleIndex;
    if (Number.isFinite(input.context?.cycleIndex)) return input.context.cycleIndex;
    const group = input.cycleGroup || cycleGroupFor(input);
    if (group !== cycleState.group) {
      cycleState = { group, index: 0 };
      return 0;
    }
    return cycleState.index;
  }

  function resolve(input = {}) {
    const activeProject = input.project || project();
    const screen = input.screen;
    const rawPoint = input.rawPoint;
    const context = input.context || {};
    const cycleGroup = input.cycleGroup || cycleGroupFor(input);
    const cycleIndex = cycleIndexFor({ ...input, cycleGroup });
    const activeProfile = profile({
      strength: input.strength,
      event: input.event || context.event
    });
    if (!activeProfile.enabled) {
      const disabledResult = resultFromSnap({
        snap: null,
        rawPoint,
        plane: context.projectToPlane === false ? null : context.workPlane,
        profile: activeProfile,
        candidates: [],
        diagnostics: [candidateDiagnostic(null, "disabled", "snap strength off or Alt held")],
        cycleIndex,
        cycleGroup,
        scope: scopeManager.scope?.() || {}
      });
      lastSnapshot = snapDiagnostic(disabledResult, { cycleIndex, cycleGroup, scope: scopeManager.scope?.() || {} });
      return disabledResult;
    }
    const scope = {
      ...scopeManager.scope?.(),
      ...(input.scope || {})
    };
    const rawCandidates = collectSnapCandidates({
      project: activeProject,
      profiles,
      context,
      scope,
      profile: activeProfile,
      rawPoint
    });
    const scoped = scopeFilterCandidates(activeProject, rawCandidates, scopeManager, context);
    const solved = solveSnap({
      candidates: scoped.accepted,
      viewer: input.viewer || viewer,
      screen,
      rawPoint,
      excludeObjectId: context.excludeObjectId || input.excludeObjectId,
      screenTolerance: finiteNumberOr(context.screenTolerancePx, activeProfile.screenTolerancePx),
      intersectionTolerancePx: finiteNumberOr(context.intersectionTolerancePx, activeProfile.intersectionTolerancePx),
      pointPriorityBiasPx: activeProfile.pointBiasPx,
      intersectionPriorityBiasPx: activeProfile.intersectionBiasPx,
      linePriorityBiasPx: activeProfile.axisBiasPx,
      projectionPriorityBiasPx: activeProfile.projectionBiasPx,
      maxIntersectionSources: activeProfile.maxIntersectionSources,
      cycleIndex
    });
    const plane = context.projectToPlane === false ? null : context.workPlane || context.plane || null;
    const snap = plane ? projectedSnap(solved.snap, plane) : solved.snap;
    const result = resultFromSnap({
      snap,
      rawPoint,
      plane,
      profile: activeProfile,
      candidates: solved.candidates || [],
      diagnostics: [
        ...(solved.diagnostics || []),
        ...scoped.rejected
      ],
      cycleIndex,
      cycleGroup,
      scope
    });
    lastSnapshot = snapDiagnostic(result, { cycleIndex, cycleGroup, scope });
    return result;
  }

  function point(input = {}) {
    const result = resolve(input);
    return {
      point: result.accepted ? result.pointWorld : input.rawPoint,
      rawPoint: input.rawPoint,
      snap: result.snap,
      snapResult: result,
      candidates: result.candidates
    };
  }

  return {
    cycle,
    resetCycle,
    resolve,
    point,
    profile,
    scope,
    snapshot: () => lastSnapshot ? { ...lastSnapshot } : null
  };
}
