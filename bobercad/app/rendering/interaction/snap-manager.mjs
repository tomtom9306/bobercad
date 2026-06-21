import { projectPointToPlane, pointToPlaneCoordinates } from "../../engine/api/project/work-plane.mjs";
import { finiteNumberOr, v } from "../../engine/core/math.mjs";
import { solveSnap } from "../../engine/api/interaction/snap-solver.mjs";
import { collectSnapCandidates } from "./snap-candidate-providers.mjs";
import { candidateDiagnostic, snapDiagnostic } from "./snap-diagnostics.mjs";
import { snapProfile } from "./snap-profiles.mjs";
import { createVisibilityFilter, solidVisibilityScopeCandidates, visibleHitForResolve, visibleObjectIds, wireframeSnapMode } from "./snap-visibility-policy.mjs";

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

function projectionPort(activeViewer) {
  return {
    projectPoint: (point) => activeViewer.projectPoint(point),
    screenRay: (x, y) => activeViewer.screenRay?.(x, y) || null
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
    reference: snap.reference || null,
    relationHints: Array.isArray(snap.hints?.relationHints)
      ? snap.hints.relationHints
      : Array.isArray(snap.relationHints) ? snap.relationHints : [],
    preview: snap.preview || {
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

function projectObjectCount(project) {
  return Object.keys(project?.objectIndex || {}).length;
}

function autoSearchRadius({ project, viewer, rawPoint, profile, context = {} }) {
  if (Number.isFinite(context.radius) || context.disableAutoSearchRadius === true) return context.radius;
  if (!v.isVec3(rawPoint) || projectObjectCount(project) < 1000) return context.radius;
  const scale = typeof viewer?.screenScale === "function" ? viewer.screenScale() : null;
  if (!Number.isFinite(scale) || scale <= 0) return context.radius;
  const tolerance = Number.isFinite(profile?.screenTolerancePx) ? profile.screenTolerancePx : 16;
  return Math.max(750, Math.min(2500, tolerance * 28 / scale));
}

function snapContextForResolve({ project, viewer, context, rawPoint, profile }) {
  const radius = autoSearchRadius({ project, viewer, rawPoint, profile, context });
  if (!Number.isFinite(radius) || radius <= 0) return context;
  return {
    ...context,
    radius,
    maxMemberCandidates: Number.isFinite(context.maxMemberCandidates)
      ? context.maxMemberCandidates
      : 60,
    maxPlateCandidates: Number.isFinite(context.maxPlateCandidates)
      ? context.maxPlateCandidates
      : 120
  };
}

function profileForContext(baseProfile, context = {}) {
  const surfaceTargets = context.includeSurfaceTargets;
  if (surfaceTargets === false || surfaceTargets === "corners" || surfaceTargets === "edges" || surfaceTargets === "faces") {
    return {
      ...baseProfile,
      includeSurfaceTargets: surfaceTargets
    };
  }
  return baseProfile;
}

function maxIntersectionSourcesForResolve(context, providerContext, activeProfile) {
  const configured = finiteNumberOr(context.maxIntersectionSources, activeProfile.maxIntersectionSources);
  if (Number.isFinite(providerContext?.radius)) return Math.min(configured, 24);
  return configured;
}

function maxVisibleCandidatesForResolve(context, providerContext) {
  if (Number.isFinite(context.maxVisibleCandidates)) return context.maxVisibleCandidates;
  return Number.isFinite(providerContext?.radius) ? 96 : 160;
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
    const activeProfile = profileForContext(profile({
      strength: input.strength,
      event: input.event || context.event
    }), context);
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
    const activeViewer = input.viewer || viewer;
    const projection = projectionPort(activeViewer);
    const visibilityResolved = !wireframeSnapMode(activeViewer, context)
      && context.snapVisibility !== false
      && typeof activeViewer?.snapVisibilityAt === "function";
    const visibleHit = visibilityResolved ? visibleHitForResolve(activeViewer, screen, context) : null;
    const candidateRawPoint = v.isVec3(visibleHit?.point) ? visibleHit.point : rawPoint;
    const providerContext = snapContextForResolve({
      project: activeProject,
      viewer: activeViewer,
      context,
      rawPoint: candidateRawPoint,
      profile: activeProfile
    });
    const evaluatedEdges = typeof activeViewer?.evaluatedSnapEdges === "function"
      ? activeViewer.evaluatedSnapEdges({
        objectIds: [...visibleObjectIds(visibleHit)],
        visibleHit,
        rawPoint: candidateRawPoint
      })
      : [];
    const rawCandidates = collectSnapCandidates({
      project: activeProject,
      profiles,
      context: {
        ...providerContext,
        visibleHit,
        evaluatedEdges
      },
      scope,
      profile: activeProfile,
      rawPoint: candidateRawPoint
    });
    const scoped = scopeFilterCandidates(activeProject, rawCandidates, scopeManager, context);
    const visibleScoped = solidVisibilityScopeCandidates(scoped.accepted, visibleHit, context, visibilityResolved);
    const solveProfile = {
      ...activeProfile,
      maxIntersectionSources: activeProfile.maxIntersectionSources
    };
    const solved = solveSnap({
      candidates: visibleScoped.accepted,
      projection,
      screen,
      rawPoint,
      excludeObjectId: context.excludeObjectId || input.excludeObjectId,
      screenTolerance: finiteNumberOr(context.screenTolerancePx, activeProfile.screenTolerancePx),
      intersectionTolerancePx: finiteNumberOr(context.intersectionTolerancePx, activeProfile.intersectionTolerancePx),
      pointPriorityBiasPx: activeProfile.pointBiasPx,
      intersectionPriorityBiasPx: activeProfile.intersectionBiasPx,
      linePriorityBiasPx: activeProfile.axisBiasPx,
      projectionPriorityBiasPx: activeProfile.projectionBiasPx,
      maxIntersectionSources: maxIntersectionSourcesForResolve(context, providerContext, solveProfile),
      maxDiagnostics: Number.isFinite(context.maxDiagnostics) ? context.maxDiagnostics : 120,
      maxVisibleCandidates: maxVisibleCandidatesForResolve(context, providerContext),
      cycleIndex,
      visibilityFilter: createVisibilityFilter(activeViewer, context, visibleHit)
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
        ...scoped.rejected,
        ...visibleScoped.rejected
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
