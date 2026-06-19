import { projectPointToPlane, pointToPlaneCoordinates } from "../../engine/api/project/work-plane.mjs?v=finite-point-api-dry-1";
import { finiteNumberOr, v } from "../../engine/core/math.mjs?v=world-axis-dry-1";
import { solveSnap } from "../../engine/api/interaction/snap-solver.mjs?v=visible-snap-9";
import { collectSnapCandidates } from "./snap-candidate-providers.mjs?v=member-hover-snap-2";
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

function finiteScreen(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function hitVisibilityPolicy(hit) {
  if (typeof hit?.visibilityPolicy === "string" && hit.visibilityPolicy) return hit.visibilityPolicy;
  if (!Array.isArray(hit?.sources)) return null;
  const source = hit.sources.find((item) => typeof item?.visibilityPolicy === "string" && item.visibilityPolicy);
  return source?.visibilityPolicy || null;
}

function addObjectId(ids, id) {
  if (id !== undefined && id !== null && id !== "") ids.add(String(id));
}

function snapObjectIds(hit, ids = new Set()) {
  addObjectId(ids, hit?.objectId);
  addObjectId(ids, hit?.target?.objectId);
  if (Array.isArray(hit?.sources)) {
    for (const source of hit.sources) snapObjectIds(source, ids);
  }
  return ids;
}

function visibleObjectIds(visibility) {
  const ids = new Set();
  const face = visibility?.face || visibility || {};
  addObjectId(ids, face.objectId);
  addObjectId(ids, face.memberId);
  addObjectId(ids, face.ownerMemberId);
  return ids;
}

function physicalSnapProvider(providerId) {
  return providerId === "model.members"
    || providerId === "model.plates"
    || providerId === "model.fasteners";
}

function screenForHit(hit, viewer, fallbackScreen) {
  if (finiteScreen(hit?.projected)) return hit.projected;
  if (v.isVec3(hit?.point) && typeof viewer?.projectPoint === "function") {
    const projected = viewer.projectPoint(hit.point);
    if (finiteScreen(projected)) return projected;
  }
  return finiteScreen(fallbackScreen) ? fallbackScreen : null;
}

function hitDepth(hit, viewer) {
  if (Number.isFinite(hit?.projected?.depth)) return hit.projected.depth;
  if (v.isVec3(hit?.point) && typeof viewer?.projectPoint === "function") {
    const projected = viewer.projectPoint(hit.point);
    if (Number.isFinite(projected?.depth)) return projected.depth;
  }
  return null;
}

function depthSensitivePolicy(policy) {
  return policy === "visible-edge" || policy === "visible-point";
}

function depthMatches(candidateDepth, visibleDepth, tolerance = 0.0025) {
  return Number.isFinite(candidateDepth)
    && Number.isFinite(visibleDepth)
    && Math.abs(candidateDepth - visibleDepth) <= tolerance;
}

function surfaceVisibilityTolerance(context = {}) {
  return Math.max(0.001, finiteNumberOr(context.snapVisibilitySurfaceWorldTolerance, 0.75));
}

function surfaceContainsVisiblePoint(hit, visiblePoint, tolerance) {
  if (!v.isVec3(visiblePoint)) return null;
  const origin = v.isVec3(hit?.origin)
    ? hit.origin
    : Array.isArray(hit?.points) && v.isVec3(hit.points[0])
      ? hit.points[0]
      : null;
  const normal = v.safeNorm(hit?.normal, [0, 0, 0]);
  if (!v.isVec3(origin) || v.len(normal) <= 1e-9) return null;
  const delta = v.sub(visiblePoint, origin);
  if (Math.abs(v.dot(delta, normal)) > tolerance) return false;

  const bounds = hit?.bounds || {};
  const axisU = v.safeNorm(hit?.axisU, [0, 0, 0]);
  const axisV = v.safeNorm(hit?.axisV, [0, 0, 0]);
  const hasBounds = Number.isFinite(bounds.minU)
    && Number.isFinite(bounds.maxU)
    && Number.isFinite(bounds.minV)
    && Number.isFinite(bounds.maxV)
    && v.len(axisU) > 1e-9
    && v.len(axisV) > 1e-9;
  if (!hasBounds) return true;

  const u = v.dot(delta, axisU);
  const w = v.dot(delta, axisV);
  const minU = Math.min(bounds.minU, bounds.maxU) - tolerance;
  const maxU = Math.max(bounds.minU, bounds.maxU) + tolerance;
  const minV = Math.min(bounds.minV, bounds.maxV) - tolerance;
  const maxV = Math.max(bounds.minV, bounds.maxV) + tolerance;
  return u >= minU && u <= maxU && w >= minV && w <= maxV;
}

function visibleSurfaceNormal(visibleHit) {
  const normal = v.safeNorm(visibleHit?.normal || visibleHit?.face?.normal, [0, 0, 0]);
  return v.len(normal) > 1e-9 ? normal : null;
}

function surfaceNormalMatches(hit, visibleHit, context = {}) {
  const visibleNormal = visibleSurfaceNormal(visibleHit);
  if (!visibleNormal) return null;
  const candidateNormal = v.safeNorm(hit?.normal, [0, 0, 0]);
  if (v.len(candidateNormal) <= 1e-9) return null;
  const minDot = Math.max(0, Math.min(1, finiteNumberOr(context.snapVisibilitySurfaceNormalDot, 0.985)));
  return Math.abs(v.dot(candidateNormal, visibleNormal)) >= minDot;
}

function surfaceMatchesVisibleHit(hit, visibleHit, context = {}) {
  const pointMatch = surfaceContainsVisiblePoint(hit, visibleHit?.point, surfaceVisibilityTolerance(context));
  if (pointMatch === false) return false;
  const normalMatch = surfaceNormalMatches(hit, visibleHit, context);
  if (normalMatch === false) return false;
  if (pointMatch === true || normalMatch === true) return true;
  return null;
}

function wireframeSnapMode(activeViewer, context = {}) {
  return context.wireframeMode === true
    || context.renderMode === "wireframe"
    || context.snapVisibility === "wireframe"
    || activeViewer?.renderMode?.() === "wireframe"
    || activeViewer?.snapVisibilityMode?.() === "wireframe";
}

function snapVisibilityRequiresPrecise(context = {}) {
  return context.snapVisibilityRequirePrecise !== false;
}

function visibleHitForResolve(activeViewer, screen, context = {}) {
  if (wireframeSnapMode(activeViewer, context)) return null;
  if (context.snapVisibility === false || typeof activeViewer?.snapVisibilityAt !== "function") return null;
  if (!finiteScreen(screen)) return null;
  return activeViewer.snapVisibilityAt(screen, {
    radiusPx: Number.isFinite(context.snapVisibleHitRadiusPx) ? Math.max(0, context.snapVisibleHitRadiusPx) : 0,
    includeTransparent: false,
    includeInstances: true,
    requirePrecise: snapVisibilityRequiresPrecise(context)
  });
}

function cacheKeyForScreen(screen) {
  return `${Math.round(screen.x)},${Math.round(screen.y)}`;
}

function createVisibilityFilter(activeViewer, context = {}, seedVisibleHit = null) {
  if (wireframeSnapMode(activeViewer, context)) return null;
  if (context.snapVisibility === false || typeof activeViewer?.snapVisibilityAt !== "function") return null;
  const preciseVisibility = snapVisibilityRequiresPrecise(context);
  const cache = new Map();
  if (finiteScreen(seedVisibleHit?.screen)) cache.set(cacheKeyForScreen(seedVisibleHit.screen), seedVisibleHit);
  const radiusPx = Number.isFinite(context.snapVisibilityRadiusPx)
    ? Math.max(0, context.snapVisibilityRadiusPx)
    : 2;
  const visibilityAt = (screen) => {
    if (!finiteScreen(screen)) return null;
    const key = cacheKeyForScreen(screen);
    if (!cache.has(key)) {
      cache.set(key, activeViewer.snapVisibilityAt(screen, {
        radiusPx,
        includeTransparent: false,
        includeInstances: true,
        requirePrecise: preciseVisibility
      }));
    }
    return cache.get(key);
  };
  return (hit, data = {}) => {
    const policy = hitVisibilityPolicy(hit);
    if (!policy) return { accepted: true };
    const objectIds = snapObjectIds(hit);
    if (!objectIds.size) return { accepted: true };
    const screen = screenForHit(hit, activeViewer, data.screen);
    if (!screen) return { accepted: true };
    const visible = visibilityAt(screen);
    const visibleIds = visibleObjectIds(visible);
    if (!visibleIds.size) {
      return { accepted: false, reason: "no visible scene object at snap point" };
    }
    let sameObjectVisible = false;
    for (const objectId of objectIds) {
      if (visibleIds.has(objectId)) {
        sameObjectVisible = true;
        break;
      }
    }
    if (!sameObjectVisible) {
      return {
        accepted: false,
        reason: `occluded by ${[...visibleIds].join(", ")}`
      };
    }
    if (!preciseVisibility) return { accepted: true };
    if (policy === "visible-surface") {
      const surfaceMatch = surfaceMatchesVisibleHit(hit, visible, context);
      if (surfaceMatch !== true) {
        return {
          accepted: false,
          reason: surfaceMatch === false ? "hidden behind visible surface" : "missing precise visible surface"
        };
      }
      const candidateDepth = hitDepth(hit, activeViewer);
      if (!depthMatches(candidateDepth, visible?.depth)) {
        return {
          accepted: false,
          reason: "hidden behind visible surface"
        };
      }
      return { accepted: true };
    }
    if (depthSensitivePolicy(policy)) {
      const candidateDepth = hitDepth(hit, activeViewer);
      if (!depthMatches(candidateDepth, visible?.depth)) {
        return {
          accepted: false,
          reason: "hidden behind visible surface"
        };
      }
    }
    return { accepted: true };
  };
}

function solidVisibilityScopeCandidates(candidates = [], visibleHit = null, context = {}, visibilityResolved = false) {
  if (context.snapVisibility === false || !visibilityResolved || wireframeSnapMode(null, context)) {
    return { accepted: candidates, rejected: [] };
  }
  const preciseVisibility = snapVisibilityRequiresPrecise(context);
  const visibleIds = visibleObjectIds(visibleHit);
  const rejected = [];
  if (!visibleIds.size) {
    return {
      accepted: candidates.filter((candidate) => !physicalSnapProvider(candidate?.providerId)),
      rejected: candidates
        .filter((candidate) => physicalSnapProvider(candidate?.providerId))
        .map((candidate) => candidateDiagnostic(candidate, "rejected", "no visible scene object at snap point"))
    };
  }

  const accepted = [];
  for (const candidate of candidates) {
    if (!physicalSnapProvider(candidate?.providerId)) {
      accepted.push(candidate);
      continue;
    }
    const objectIds = snapObjectIds(candidate);
    let sameObjectVisible = false;
    for (const objectId of objectIds) {
      if (visibleIds.has(objectId)) {
        sameObjectVisible = true;
        break;
      }
    }
    if (!sameObjectVisible) {
      rejected.push(candidateDiagnostic(candidate, "rejected", `not under visible object ${[...visibleIds].join(", ")}`));
      continue;
    }
    if (candidate.visibilityPolicy === "visible-surface" && preciseVisibility) {
      const surfaceMatch = surfaceMatchesVisibleHit(candidate, visibleHit, context);
      if (surfaceMatch !== true) {
        rejected.push(candidateDiagnostic(
          candidate,
          "rejected",
          surfaceMatch === false ? "not the visible surface under cursor" : "missing precise visible surface"
        ));
        continue;
      }
    }
    accepted.push(candidate);
  }
  return { accepted, rejected };
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
    const rawCandidates = collectSnapCandidates({
      project: activeProject,
      profiles,
      context: {
        ...providerContext,
        visibleHit
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
      viewer: activeViewer,
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
