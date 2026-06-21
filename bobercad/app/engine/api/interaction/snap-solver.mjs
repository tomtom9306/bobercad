import { closestAxisPoints, finiteNumber, linePlaneIntersection, projectPointToPlane, screenDistance, v } from "../../core/math.mjs";

const DEFAULT_POINT_PRIORITY_BIAS_PX = 12;
const DEFAULT_INTERSECTION_PRIORITY_BIAS_PX = 10;
const DEFAULT_LINE_PRIORITY_BIAS_PX = 8;
const DEFAULT_PROJECTION_PRIORITY_BIAS_PX = 4;
const SNAP_KINDS = new Set(["point", "line", "plane"]);

function fail(message) {
  throw new Error(`snap solver: ${message}`);
}

function optionalObject(value, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requiredObject(value, label) {
  const object = optionalObject(value, label);
  if (!object) fail(`${label} is required`);
  return object;
}

function requiredNumber(value, label) {
  if (!finiteNumber(value)) fail(`${label} must be a finite number`);
  return value;
}

function requiredNonNegativeNumber(value, label) {
  const number = requiredNumber(value, label);
  if (number < 0) fail(`${label} must be non-negative`);
  return number;
}

function optionalNumber(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  return requiredNumber(value, label);
}

function optionalNonNegativeNumber(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  return requiredNonNegativeNumber(value, label);
}

function requiredNonNegativeInteger(value, label) {
  const number = requiredNonNegativeNumber(value, label);
  if (!Number.isInteger(number)) fail(`${label} must be an integer`);
  return number;
}

function requiredPositiveInteger(value, label) {
  const number = requiredNonNegativeInteger(value, label);
  if (number < 1) fail(`${label} must be at least 1`);
  return number;
}

function requiredInteger(value, label) {
  const number = requiredNumber(value, label);
  if (!Number.isInteger(number)) fail(`${label} must be an integer`);
  return number;
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) fail(`${label} must be a finite [x, y, z] point`);
  return value;
}

function requiredDirection(value, label) {
  const direction = requiredVec3(value, label);
  const length = v.len(direction);
  if (length <= 1e-9) fail(`${label} cannot be zero length`);
  return v.mul(direction, 1 / length);
}

function validateOptionalBoolean(value, label) {
  if (value !== undefined && typeof value !== "boolean") fail(`${label} must be a boolean`);
}

function candidateId(candidate, index = 0) {
  if (candidate?.candidateId !== undefined && candidate?.candidateId !== null && candidate?.candidateId !== "") {
    if (typeof candidate.candidateId !== "string") fail("candidateId must be a string");
    return candidate.candidateId;
  }
  const target = optionalObject(candidate?.target, "candidate.target");
  const targetKey = [
    target?.collection,
    target?.objectId,
    target?.subId,
    target?.semanticRole
  ].filter(Boolean).join("/");
  return [
    candidate?.providerId || "provider",
    candidate?.type || candidate?.kind || "candidate",
    targetKey || candidate?.objectId || index
  ].join(":");
}

function candidateObjectIds(candidate) {
  return [
    candidate?.objectId,
    candidate?.target?.objectId
  ].filter((id) => typeof id === "string" && id);
}

function canonicalCandidateFields(candidate) {
  const priority = optionalNonNegativeNumber(candidate.priority, 0, `${candidate.candidateId}.priority`);
  return {
    geometry: candidate.geometry || {
      kind: candidate.kind,
      ...(candidate.kind === "point" ? { point: candidate.point } : {}),
      ...(candidate.kind === "line" ? { a: candidate.a, b: candidate.b, point: candidate.point || candidate.a } : {}),
      ...(candidate.kind === "plane" ? {
        points: candidate.points,
        origin: candidate.origin,
        axisU: candidate.axisU,
        axisV: candidate.axisV,
        normal: candidate.normal
      } : {})
    },
    identity: candidate.identity || {
      candidateId: candidate.candidateId,
      providerId: candidate.providerId || null,
      type: candidate.type || null,
      objectId: candidate.objectId || candidate.target?.objectId || null,
      target: candidate.target || null
    },
    visibility: candidate.visibility || {
      policy: candidate.visibilityPolicy || null,
      objectIds: candidateObjectIds(candidate)
    },
    ranking: candidate.ranking || {
      priority,
      screenTolerance: finiteNumber(candidate.screenTolerance) ? candidate.screenTolerance : null,
      visibilityPenaltyPx: optionalNonNegativeNumber(candidate.visibilityPenaltyPx, 0, `${candidate.candidateId}.visibilityPenaltyPx`)
    },
    reference: candidate.reference || null,
    hints: candidate.hints || {
      relationHints: Array.isArray(candidate.relationHints) ? candidate.relationHints : []
    },
    preview: candidate.preview || null
  };
}

function validateCandidate(candidate, index) {
  const normalized = { ...requiredObject(candidate, `candidate ${index}`) };
  normalized.candidateId = candidateId(normalized, index);
  if (!SNAP_KINDS.has(normalized.kind)) fail(`${normalized.candidateId}.kind must be point, line, or plane`);
  optionalNonNegativeNumber(normalized.priority, 0, `${normalized.candidateId}.priority`);
  optionalNonNegativeNumber(normalized.screenTolerance, undefined, `${normalized.candidateId}.screenTolerance`);
  validateOptionalBoolean(normalized.intersectionOnly, `${normalized.candidateId}.intersectionOnly`);
  validateOptionalBoolean(normalized.allowIntersections, `${normalized.candidateId}.allowIntersections`);
  validateOptionalBoolean(normalized.infiniteLine, `${normalized.candidateId}.infiniteLine`);
  validateOptionalBoolean(normalized.preferInteriorSnap, `${normalized.candidateId}.preferInteriorSnap`);
  optionalNonNegativeNumber(normalized.interiorSnapEdgeBiasPx, undefined, `${normalized.candidateId}.interiorSnapEdgeBiasPx`);
  optionalNonNegativeNumber(normalized.worldIntersectionTolerance, undefined, `${normalized.candidateId}.worldIntersectionTolerance`);
  if (normalized.screenIntersectionMode !== undefined && normalized.screenIntersectionMode !== "self") {
    fail(`${normalized.candidateId}.screenIntersectionMode must be self`);
  }
  if (normalized.kind === "point") {
    requiredVec3(normalized.point, `${normalized.candidateId}.point`);
  } else if (normalized.kind === "line") {
    requiredVec3(normalized.a, `${normalized.candidateId}.a`);
    requiredVec3(normalized.b, `${normalized.candidateId}.b`);
    if (v.len(v.sub(normalized.b, normalized.a)) <= 1e-9) fail(`${normalized.candidateId} line cannot be zero length`);
  } else if (normalized.kind === "plane") {
    if (!Array.isArray(normalized.points) || normalized.points.length < 3) fail(`${normalized.candidateId}.points must contain at least 3 points`);
    normalized.points.forEach((point, pointIndex) => requiredVec3(point, `${normalized.candidateId}.points[${pointIndex}]`));
    requiredVec3(normalized.origin, `${normalized.candidateId}.origin`);
    requiredDirection(normalized.normal, `${normalized.candidateId}.normal`);
  }
  Object.assign(normalized, canonicalCandidateFields(normalized));
  return normalized;
}

function snapDiagnostic(candidate, status, reason, data = {}) {
  const candidateTarget = optionalObject(candidate?.target, "candidate.target");
  const dataTarget = optionalObject(data.target, "diagnostic target");
  return {
    candidateId: candidate?.candidateId || data.candidateId || null,
    status,
    reason,
    providerId: candidate?.providerId || data.providerId || null,
    type: candidate?.type || data.type || null,
    kind: candidate?.kind || data.kind || null,
    label: candidate?.label || data.label || null,
    target: candidateTarget || dataTarget,
    screenDistance: finiteNumber(data.screenDistance) ? data.screenDistance : null,
    priority: finiteNumber(candidate?.priority) ? candidate.priority : null,
    rank: Number.isInteger(data.rank) ? data.rank : null,
    visibilityPenaltyPx: finiteNumber(data.visibilityPenaltyPx)
      ? data.visibilityPenaltyPx
      : finiteNumber(candidate?.scoreBreakdown?.visibilityPenaltyPx) ? candidate.scoreBreakdown.visibilityPenaltyPx : null,
    scoreBreakdown: data.scoreBreakdown || candidate?.scoreBreakdown || null
  };
}

function finiteScreen(point) {
  return point && finiteNumber(point.x) && finiteNumber(point.y);
}

function lineScreenData(projection, candidate) {
  requiredVec3(candidate.a, `${candidate.candidateId}.a`);
  requiredVec3(candidate.b, `${candidate.candidateId}.b`);
  const a = projection.projectPoint(candidate.a);
  const b = projection.projectPoint(candidate.b);
  if (!finiteScreen(a) || !finiteScreen(b)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return null;
  return { a, b, dx, dy, lengthSq };
}

function pointOnLineAtScreen(candidate, data, screen) {
  const rawT = ((screen.x - data.a.x) * data.dx + (screen.y - data.a.y) * data.dy) / data.lengthSq;
  const t = lineAllowsExtension(candidate) ? rawT : Math.max(0, Math.min(1, rawT));
  return {
    point: v.add(candidate.a, v.mul(v.sub(candidate.b, candidate.a), t)),
    projected: {
      x: data.a.x + data.dx * t,
      y: data.a.y + data.dy * t
    },
    t,
    rawT
  };
}

function candidateHit(candidate, distance, defaultTolerance, data = {}) {
  const tolerance = optionalNonNegativeNumber(candidate.screenTolerance, defaultTolerance, `${candidate.candidateId}.screenTolerance`);
  if (distance > tolerance) return null;
  const visibilityPenaltyPx = optionalNonNegativeNumber(candidate.visibilityPenaltyPx, 0, `${candidate.candidateId}.visibilityPenaltyPx`);
  return {
    ...candidate,
    ...data,
    screenDistance: distance,
    scoreBreakdown: {
      rawScreenDistance: distance,
      visibilityPenaltyPx,
      priority: optionalNumber(candidate.priority, 0, `${candidate.candidateId}.priority`)
    }
  };
}

function lineAllowsExtension(candidate) {
  return candidate?.type === "screen-line"
    || candidate?.screenIntersectionMode === "self"
    || candidate?.infiniteLine === true;
}

function lineIntersectionInRange(candidate, t, tolerance = 1e-6) {
  if (lineAllowsExtension(candidate)) return true;
  return t >= -tolerance && t <= 1 + tolerance;
}

function lineHit(projection, candidate, screen, defaultTolerance) {
  const data = lineScreenData(projection, candidate);
  if (!data) return null;
  const projected = pointOnLineAtScreen(candidate, data, screen);
  const distance = screenDistance(projected.projected, screen);
  return candidateHit(candidate, distance, defaultTolerance, {
    point: projected.point,
    projected: projected.projected,
    t: projected.t
  });
}

function pointHit(projection, candidate, screen, defaultTolerance) {
  requiredVec3(candidate.point, `${candidate.candidateId}.point`);
  const projected = projection.projectPoint(candidate.point);
  if (!finiteScreen(projected)) return null;
  const distance = screenDistance(projected, screen);
  return candidateHit(candidate, distance, defaultTolerance, { projected });
}

function screenSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return screenDistance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return screenDistance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function pointInScreenPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses) {
      const x = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

function screenPolygonDistance(point, polygon) {
  if (polygon.length < 3) return Infinity;
  if (pointInScreenPolygon(point, polygon)) return 0;
  let best = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    best = Math.min(best, screenSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]));
  }
  return best;
}

function planeBounds(candidate) {
  const id = candidateId(candidate);
  const bounds = optionalObject(candidate.bounds, `${id}.bounds`);
  if (!bounds) fail(`${id}.bounds is required`);
  return {
    origin: requiredVec3(candidate.origin, `${id}.origin`),
    axisU: requiredDirection(candidate.axisU, `${id}.axisU`),
    axisV: requiredDirection(candidate.axisV, `${id}.axisV`),
    minU: requiredNumber(bounds.minU, `${id}.bounds.minU`),
    maxU: requiredNumber(bounds.maxU, `${id}.bounds.maxU`),
    minV: requiredNumber(bounds.minV, `${id}.bounds.minV`),
    maxV: requiredNumber(bounds.maxV, `${id}.bounds.maxV`)
  };
}

function planeCoords(bounds, point) {
  const delta = v.sub(point, bounds.origin);
  return {
    u: v.dot(delta, bounds.axisU),
    v: v.dot(delta, bounds.axisV)
  };
}

function clampPlanePoint(candidate, point) {
  const bounds = planeBounds(candidate);
  const coords = planeCoords(bounds, point);
  const u = Math.max(Math.min(bounds.minU, bounds.maxU), Math.min(Math.max(bounds.minU, bounds.maxU), coords.u));
  const w = Math.max(Math.min(bounds.minV, bounds.maxV), Math.min(Math.max(bounds.minV, bounds.maxV), coords.v));
  return v.add(bounds.origin, v.add(v.mul(bounds.axisU, u), v.mul(bounds.axisV, w)));
}

function planeHitPoint(projection, candidate, screen, rawPoint) {
  const origin = requiredVec3(candidate.origin, `${candidate.candidateId}.origin`);
  const normal = requiredDirection(candidate.normal, `${candidate.candidateId}.normal`);
  let point = null;
  const ray = typeof projection.screenRay === "function" ? projection.screenRay(screen.x, screen.y) : null;
  if (ray) {
    const rayObject = requiredObject(ray, "projection screen ray");
    point = linePlaneIntersection(
      requiredVec3(rayObject.origin, "projection screen ray origin"),
      requiredVec3(rayObject.direction, "projection screen ray direction"),
      origin,
      normal
    );
  }
  if (!point && v.isVec3(rawPoint)) point = projectPointToPlane(rawPoint, origin, normal);
  return point ? clampPlanePoint(candidate, point) : null;
}

function planeHit(projection, candidate, screen, rawPoint, defaultTolerance) {
  if (!Array.isArray(candidate.points) || candidate.points.length < 3) fail(`${candidate.candidateId}.points must contain at least 3 points`);
  const points = candidate.points.map((point, index) => requiredVec3(point, `${candidate.candidateId}.points[${index}]`));
  const projected = points.map((point) => projection.projectPoint(point));
  if (projected.some((point) => !finiteScreen(point))) return null;
  const distance = screenPolygonDistance(screen, projected);
  const point = planeHitPoint(projection, candidate, screen, rawPoint);
  if (!point) return null;
  const pointProjected = projection.projectPoint(point);
  if (!finiteScreen(pointProjected)) return null;
  return candidateHit(candidate, distance, defaultTolerance, {
    point,
    projected: pointProjected,
    screenPolygon: projected
  });
}

function screenLineIntersection(left, right) {
  const denominator = left.dx * right.dy - left.dy * right.dx;
  if (Math.abs(denominator) <= 1e-9) return null;
  const x = right.a.x - left.a.x;
  const y = right.a.y - left.a.y;
  const leftT = (x * right.dy - y * right.dx) / denominator;
  const rightT = (x * left.dy - y * left.dx) / denominator;
  return {
    x: left.a.x + left.dx * leftT,
    y: left.a.y + left.dy * leftT,
    leftT,
    rightT
  };
}

function linePairIntersection(projection, left, right, screen, tolerance) {
  const leftData = lineScreenData(projection, left);
  const rightData = lineScreenData(projection, right);
  if (!leftData || !rightData) return null;
  const intersection = screenLineIntersection(leftData, rightData);
  if (!intersection) return null;
  const projected = { x: intersection.x, y: intersection.y };
  const distance = screenDistance(projected, screen);
  if (distance > tolerance) return null;
  if (!lineIntersectionInRange(left, intersection.leftT) || !lineIntersectionInRange(right, intersection.rightT)) return null;

  const leftPoint = v.add(left.a, v.mul(v.sub(left.b, left.a), intersection.leftT));
  const rightPoint = v.add(right.a, v.mul(v.sub(right.b, right.a), intersection.rightT));
  const closest = closestAxisPoints(left, right);
  const worldTolerance = Math.max(
    optionalNonNegativeNumber(left.worldIntersectionTolerance, 1, `${left.candidateId}.worldIntersectionTolerance`),
    optionalNonNegativeNumber(right.worldIntersectionTolerance, 1, `${right.candidateId}.worldIntersectionTolerance`)
  );
  const priority = Math.max(optionalNumber(left.priority, 0, `${left.candidateId}.priority`), optionalNumber(right.priority, 0, `${right.candidateId}.priority`)) + 80;
  const visibilityPenaltyPx = Math.max(
    optionalNonNegativeNumber(left?.scoreBreakdown?.visibilityPenaltyPx ?? left?.visibilityPenaltyPx, 0, `${left.candidateId}.visibilityPenaltyPx`),
    optionalNonNegativeNumber(right?.scoreBreakdown?.visibilityPenaltyPx ?? right?.visibilityPenaltyPx, 0, `${right.candidateId}.visibilityPenaltyPx`)
  );
  if (closest.distance <= worldTolerance) {
    const point = v.mul(v.add(closest.pointA, closest.pointB), 0.5);
    const pointProjected = projection.projectPoint(point);
    const pointDistance = finiteScreen(pointProjected) ? screenDistance(pointProjected, screen) : distance;
    return {
      kind: "point",
      type: "world-intersection",
      intersectionKind: "world",
      intersectionSemanticType: "axis-intersection",
      point,
      projected: finiteScreen(pointProjected) ? pointProjected : projected,
      screenDistance: pointDistance,
      priority,
      label: `${left.label || left.type || "Axis"} x ${right.label || right.type || "Axis"}`,
      sources: [left, right],
      scoreBreakdown: {
        rawScreenDistance: pointDistance,
        visibilityPenaltyPx,
        priority
      }
    };
  }
  const point = left.type === "screen-line" || left.screenIntersectionMode === "self"
    ? leftPoint
    : right.type === "screen-line" || right.screenIntersectionMode === "self"
      ? rightPoint
      : leftPoint;
  return {
    kind: "point",
    type: "screen-intersection",
    intersectionKind: "screen",
    intersectionSemanticType: "axis-intersection",
    point,
    projected,
    screenDistance: distance,
    priority,
    label: `${left.label || left.type || "Axis"} x ${right.label || right.type || "Axis"}`,
    sources: [left, right],
    scoreBreakdown: {
      rawScreenDistance: distance,
      visibilityPenaltyPx,
      priority
    }
  };
}

function snapClass(hit) {
  if (hit?.type === "world-intersection" || hit?.type === "screen-intersection" || hit?.type === "projection-guide" || hit?.intersectionSemanticType === "axis-intersection") return "intersection";
  if (hit?.kind === "point") return "point";
  if (hit?.kind === "line") return "line";
  if (hit?.kind === "plane") return "plane";
  return "other";
}

function snapClassRank(hit) {
  const hitClass = snapClass(hit);
  if (hitClass === "point") return 0;
  if (hitClass === "intersection") return 1;
  if (hitClass === "line") return 2;
  if (hitClass === "plane") return 3;
  return 3;
}

function snapClassBias(hit, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx) {
  const hitClass = snapClass(hit);
  if (hitClass === "point") return pointBiasPx;
  if (hitClass === "intersection") return intersectionBiasPx;
  if (hitClass === "line") return lineBiasPx;
  if (hitClass === "plane") return projectionBiasPx;
  return 0;
}

function biasedDistance(hit, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx) {
  const visibilityPenaltyPx = optionalNonNegativeNumber(hit?.scoreBreakdown?.visibilityPenaltyPx ?? hit?.visibilityPenaltyPx, 0, `${hit?.candidateId || "hit"}.visibilityPenaltyPx`);
  return hit.screenDistance + visibilityPenaltyPx - snapClassBias(hit, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
}

function rankSnap(left, right, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx) {
  const leftClass = snapClassRank(left);
  const rightClass = snapClassRank(right);
  if (leftClass !== rightClass) {
    const leftBias = snapClassBias(left, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
    const rightBias = snapClassBias(right, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
    if (leftClass < rightClass && left.screenDistance <= right.screenDistance + leftBias) return -1;
    if (rightClass < leftClass && right.screenDistance <= left.screenDistance + rightBias) return 1;
  }
  const leftDistance = biasedDistance(left, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
  const rightDistance = biasedDistance(right, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
  if (Math.abs(leftDistance - rightDistance) > 1e-6) return leftDistance - rightDistance;
  const leftPriority = left.priority || 0;
  const rightPriority = right.priority || 0;
  if (Math.abs(left.screenDistance - right.screenDistance) > 1e-6) return left.screenDistance - right.screenDistance;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  return String(left.label || left.type || "").localeCompare(String(right.label || right.type || ""));
}

function hitReferencesObject(hit, objectId) {
  if (!objectId) return false;
  if (hit?.objectId === objectId) return true;
  return Array.isArray(hit?.sources) && hit.sources.some((source) => source?.objectId === objectId);
}

function blocksInteriorPlanePromotion(hit) {
  if (hit?.providerId === "sketch.active") return true;
  const type = String(hit?.type || "");
  if (type.endsWith("face-center") || type.endsWith("face-centerline")) return false;
  if (type === "plate-center" || type === "plate-sketch-center") return false;
  return true;
}

function canBlockInteriorPlanePromotion(other, plane) {
  return hitReferencesObject(other, plane.objectId) || other?.providerId === "sketch.active";
}

function preferredInteriorPlane(hits) {
  return hits.find((hit) => {
    if (hit?.kind !== "plane" || hit.preferInteriorSnap !== true) return false;
    if (!finiteNumber(hit.screenDistance) || hit.screenDistance > 1e-6) return false;
    const edgeBiasPx = optionalNonNegativeNumber(hit.interiorSnapEdgeBiasPx, 3, `${hit.candidateId}.interiorSnapEdgeBiasPx`);
    return !hits.some((other) => (
      other !== hit
      && other?.kind !== "plane"
      && canBlockInteriorPlanePromotion(other, hit)
      && blocksInteriorPlanePromotion(other)
      && finiteNumber(other.screenDistance)
      && other.screenDistance < edgeBiasPx
    ));
  });
}

function promotePreferredInteriorPlane(hits) {
  const preferred = preferredInteriorPlane(hits);
  if (!preferred) return hits;
  const index = hits.indexOf(preferred);
  if (index <= 0) return hits;
  hits.splice(index, 1);
  hits.unshift(preferred);
  return hits;
}

function pushDiagnostic(diagnostics, diagnostic, limit = Infinity) {
  if (diagnostics.length < limit) diagnostics.push(diagnostic);
}

function visibilityAccepted(decision) {
  if (decision === true) return true;
  if (decision === false) return false;
  if (decision && typeof decision === "object" && typeof decision.accepted === "boolean") return decision.accepted;
  fail("visibility filter must return a boolean or { accepted: boolean }");
}

function visibilityReason(decision) {
  if (decision && typeof decision.reason === "string" && decision.reason) return decision.reason;
  return "hidden by visible scene geometry";
}

function applyVisibilityFilter(hits, visibilityFilter, projection, screen, diagnostics, diagnosticLimit, maxAccepted = Infinity) {
  const acceptedLimit = maxAccepted === Infinity ? Infinity : requiredPositiveInteger(maxAccepted, "max visible candidates");
  if (visibilityFilter !== null && visibilityFilter !== undefined && typeof visibilityFilter !== "function") fail("visibility filter must be a function");
  if (typeof visibilityFilter !== "function" || !hits.length) return hits.slice(0, acceptedLimit);
  const accepted = [];
  for (const [index, hit] of hits.entries()) {
    const decision = visibilityFilter(hit, {
      projection,
      screen,
      rank: index + 1
    });
    if (visibilityAccepted(decision)) {
      accepted.push(hit);
      if (accepted.length >= acceptedLimit) break;
      continue;
    }
    pushDiagnostic(diagnostics, snapDiagnostic(hit, "rejected", visibilityReason(decision), {
      screenDistance: hit.screenDistance,
      rank: index + 1
    }), diagnosticLimit);
  }
  return accepted;
}

function withCandidateIds(candidates = [], excludeObjectId = null, maxDiagnostics = Infinity) {
  if (!Array.isArray(candidates)) fail("candidates must be an array");
  const usable = [];
  const diagnostics = [];
  for (const [index, candidate] of candidates.entries()) {
    const normalized = validateCandidate(candidate, index);
    if (normalized.objectId && normalized.objectId === excludeObjectId) {
      pushDiagnostic(diagnostics, snapDiagnostic(normalized, "rejected", "excluded active object"), maxDiagnostics);
      continue;
    }
    usable.push(normalized);
  }
  return { usable, diagnostics };
}

export function solveSnap({
  candidates = [],
  projection,
  screen,
  rawPoint = null,
  excludeObjectId = null,
  screenTolerance = 14,
  intersectionTolerancePx = null,
  pointPriorityBiasPx = DEFAULT_POINT_PRIORITY_BIAS_PX,
  intersectionPriorityBiasPx = DEFAULT_INTERSECTION_PRIORITY_BIAS_PX,
  linePriorityBiasPx = DEFAULT_LINE_PRIORITY_BIAS_PX,
  projectionPriorityBiasPx = DEFAULT_PROJECTION_PRIORITY_BIAS_PX,
  maxIntersectionSources = 48,
  maxDiagnostics = 200,
  maxVisibleCandidates = 160,
  cycleIndex = 0,
  visibilityFilter = null
} = {}) {
  if (!projection || !finiteScreen(screen)) {
    return {
      snap: null,
      candidates: [],
      diagnostics: [snapDiagnostic(null, "rejected", "missing projection or finite screen")]
    };
  }
  if (typeof projection.projectPoint !== "function") fail("projection.projectPoint is required");
  const snapScreenTolerance = requiredNonNegativeNumber(screenTolerance, "screen tolerance");
  const pointBiasPx = requiredNonNegativeNumber(pointPriorityBiasPx, "point priority bias");
  const intersectionBiasPx = requiredNonNegativeNumber(intersectionPriorityBiasPx, "intersection priority bias");
  const lineBiasPx = requiredNonNegativeNumber(linePriorityBiasPx, "line priority bias");
  const projectionBiasPx = requiredNonNegativeNumber(projectionPriorityBiasPx, "projection priority bias");
  const rejectedDiagnosticLimit = requiredNonNegativeInteger(maxDiagnostics, "max diagnostics");
  const visibleCandidateLimit = requiredPositiveInteger(maxVisibleCandidates, "max visible candidates");
  const cycle = Math.abs(requiredInteger(cycleIndex, "cycle index"));
  const { usable, diagnostics: rejectedDiagnostics } = withCandidateIds(candidates, excludeObjectId, rejectedDiagnosticLimit);
  const hits = [];
  for (const candidate of usable) {
    if (candidate.intersectionOnly) {
      pushDiagnostic(rejectedDiagnostics, snapDiagnostic(candidate, "candidate", "intersection-only source"), rejectedDiagnosticLimit);
      continue;
    }
    const hit = candidate.kind === "line"
      ? lineHit(projection, candidate, screen, snapScreenTolerance)
      : candidate.kind === "plane"
        ? planeHit(projection, candidate, screen, rawPoint, snapScreenTolerance)
        : pointHit(projection, candidate, screen, snapScreenTolerance);
    if (hit) {
      hits.push(hit);
    } else {
      pushDiagnostic(rejectedDiagnostics, snapDiagnostic(candidate, "rejected", "outside screen tolerance or not projectable"), rejectedDiagnosticLimit);
    }
  }

  const intersectionTolerance = optionalNonNegativeNumber(intersectionTolerancePx, snapScreenTolerance * 1.35, "intersection tolerance");
  const intersectionSourceLimit = requiredNonNegativeInteger(maxIntersectionSources, "max intersection sources");
  const lineSourceHits = [];
  if (intersectionSourceLimit > 0) {
    for (const candidate of usable) {
      if (candidate.kind !== "line" || candidate.allowIntersections === false) continue;
      const hit = lineHit(projection, candidate, screen, intersectionTolerance);
      if (hit) lineSourceHits.push(hit);
    }
  }
  lineSourceHits.sort((left, right) => rankSnap(left, right, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx));
  const lineIntersectionSources = lineSourceHits.slice(0, intersectionSourceLimit);
  if (lineSourceHits.length > lineIntersectionSources.length) {
    pushDiagnostic(rejectedDiagnostics, snapDiagnostic(null, "rejected", "intersection source limit", {
      candidateId: "solver.intersections:source-limit",
      providerId: "solver.intersections",
      type: "axis-intersection",
      label: `${lineSourceHits.length - lineIntersectionSources.length} intersection sources skipped`
    }), rejectedDiagnosticLimit);
  }
  for (let i = 0; i < lineIntersectionSources.length; i += 1) {
    for (let j = i + 1; j < lineIntersectionSources.length; j += 1) {
      const hit = linePairIntersection(projection, lineIntersectionSources[i], lineIntersectionSources[j], screen, intersectionTolerance);
      if (hit) {
        hits.push({
          ...hit,
          candidateId: `intersection:${lineIntersectionSources[i].candidateId}+${lineIntersectionSources[j].candidateId}`,
          providerId: "solver.intersections",
          target: null
        });
      }
    }
  }

  hits.sort((left, right) => rankSnap(
    left,
    right,
    pointBiasPx,
    intersectionBiasPx,
    lineBiasPx,
    projectionBiasPx
  ));
  promotePreferredInteriorPlane(hits);
  const visibleHits = promotePreferredInteriorPlane(
    applyVisibilityFilter(hits, visibilityFilter, projection, screen, rejectedDiagnostics, rejectedDiagnosticLimit, visibleCandidateLimit)
  );
  const snap = visibleHits.length ? visibleHits[cycle % visibleHits.length] : null;
  const hitDiagnostics = visibleHits.map((hit, index) => snapDiagnostic(hit, hit === snap ? "accepted" : "candidate", hit === snap ? "selected by rank/cycle" : "ranked alternative", {
    screenDistance: hit.screenDistance,
    rank: index + 1
  }));
  return {
    snap,
    candidates: visibleHits,
    diagnostics: [
      ...hitDiagnostics,
      ...rejectedDiagnostics
    ]
  };
}
