import { finiteNumberOr, v } from "../../engine/core/math.mjs";
import { candidateDiagnostic } from "./snap-diagnostics.mjs";

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

export function visibleObjectIds(visibility) {
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

function visibilityPenaltyPx(context = {}) {
  return Math.max(0, finiteNumberOr(context.snapVisibilityPenaltyPx, 24));
}

function candidateWithVisibilityPenalty(candidate, reason, context = {}) {
  const penalty = visibilityPenaltyPx(context);
  const current = Math.max(0, finiteNumberOr(candidate?.visibilityPenaltyPx, 0));
  const visibilityPenalty = Math.max(current, penalty);
  return {
    ...candidate,
    visibilityPenaltyPx: visibilityPenalty,
    visibilityPenaltyReason: reason,
    ranking: {
      ...(candidate?.ranking || {}),
      visibilityPenaltyPx: visibilityPenalty
    }
  };
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
  if (pointMatch === true) return true;
  return null;
}

export function wireframeSnapMode(activeViewer, context = {}) {
  return context.wireframeMode === true
    || context.renderMode === "wireframe"
    || context.snapVisibility === "wireframe"
    || activeViewer?.renderMode?.() === "wireframe"
    || activeViewer?.snapVisibilityMode?.() === "wireframe";
}

function snapVisibilityRequiresPrecise(context = {}) {
  return context.snapVisibilityRequirePrecise !== false;
}

export function visibleHitForResolve(activeViewer, screen, context = {}) {
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

export function createVisibilityFilter(activeViewer, context = {}, seedVisibleHit = null) {
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

export function solidVisibilityScopeCandidates(candidates = [], visibleHit = null, context = {}, visibilityResolved = false) {
  if (context.snapVisibility === false || !visibilityResolved || wireframeSnapMode(null, context)) {
    return { accepted: candidates, rejected: [] };
  }
  const preciseVisibility = snapVisibilityRequiresPrecise(context);
  const visibleIds = visibleObjectIds(visibleHit);
  const rejected = [];
  if (!visibleIds.size) {
    return {
      accepted: candidates.map((candidate) => (
        physicalSnapProvider(candidate?.providerId)
          ? candidateWithVisibilityPenalty(candidate, "no visible scene object at snap point", context)
          : candidate
      )),
      rejected: candidates
        .filter((candidate) => physicalSnapProvider(candidate?.providerId))
        .map((candidate) => candidateDiagnostic(candidate, "candidate", "visibility penalty: no visible scene object at snap point"))
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
      const reason = `not under visible object ${[...visibleIds].join(", ")}`;
      accepted.push(candidateWithVisibilityPenalty(candidate, reason, context));
      rejected.push(candidateDiagnostic(candidate, "candidate", `visibility penalty: ${reason}`));
      continue;
    }
    if (candidate.visibilityPolicy === "visible-surface" && preciseVisibility) {
      const surfaceMatch = surfaceMatchesVisibleHit(candidate, visibleHit, context);
      if (surfaceMatch !== true) {
        const reason = surfaceMatch === false ? "not the visible surface under cursor" : "missing precise visible surface";
        accepted.push(candidateWithVisibilityPenalty(candidate, reason, context));
        rejected.push(candidateDiagnostic(
          candidate,
          "candidate",
          `visibility penalty: ${reason}`
        ));
        continue;
      }
    }
    accepted.push(candidate);
  }
  return { accepted, rejected };
}
