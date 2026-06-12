import { closestAxisPoints, finiteNumber, finiteNumberOr, linePlaneIntersection, projectPointToPlane, screenDistance, v } from "../../core/math.mjs?v=screen-distance-dry-1";

const DEFAULT_POINT_PRIORITY_BIAS_PX = 12;
const DEFAULT_INTERSECTION_PRIORITY_BIAS_PX = 10;
const DEFAULT_LINE_PRIORITY_BIAS_PX = 8;
const DEFAULT_PROJECTION_PRIORITY_BIAS_PX = 4;

function candidateId(candidate, index = 0) {
  if (candidate?.candidateId) return candidate.candidateId;
  const target = candidate?.target || {};
  const targetKey = [
    target.collection,
    target.objectId,
    target.subId,
    target.semanticRole
  ].filter(Boolean).join("/");
  return [
    candidate?.providerId || "provider",
    candidate?.type || candidate?.kind || "candidate",
    targetKey || candidate?.objectId || index
  ].join(":");
}

function snapDiagnostic(candidate, status, reason, data = {}) {
  return {
    candidateId: candidate?.candidateId || data.candidateId || null,
    status,
    reason,
    providerId: candidate?.providerId || data.providerId || null,
    type: candidate?.type || data.type || null,
    kind: candidate?.kind || data.kind || null,
    label: candidate?.label || data.label || null,
    target: candidate?.target || data.target || null,
    screenDistance: finiteNumber(data.screenDistance) ? data.screenDistance : null,
    priority: finiteNumber(candidate?.priority) ? candidate.priority : null,
    rank: Number.isInteger(data.rank) ? data.rank : null
  };
}

function finiteScreen(point) {
  return point && finiteNumber(point.x) && finiteNumber(point.y);
}

function lineScreenData(viewer, candidate) {
  if (!v.isVec3(candidate.a) || !v.isVec3(candidate.b)) return null;
  const a = viewer.projectPoint(candidate.a);
  const b = viewer.projectPoint(candidate.b);
  if (!finiteScreen(a) || !finiteScreen(b)) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return null;
  return { a, b, dx, dy, lengthSq };
}

function pointOnLineAtScreen(candidate, data, screen) {
  const t = ((screen.x - data.a.x) * data.dx + (screen.y - data.a.y) * data.dy) / data.lengthSq;
  return {
    point: v.add(candidate.a, v.mul(v.sub(candidate.b, candidate.a), t)),
    projected: {
      x: data.a.x + data.dx * t,
      y: data.a.y + data.dy * t
    },
    t
  };
}

function candidateHit(candidate, distance, defaultTolerance, data = {}) {
  const tolerance = finiteNumberOr(candidate.screenTolerance, defaultTolerance);
  if (distance > tolerance) return null;
  return { ...candidate, ...data, screenDistance: distance };
}

function lineHit(viewer, candidate, screen, defaultTolerance) {
  const data = lineScreenData(viewer, candidate);
  if (!data) return null;
  const projected = pointOnLineAtScreen(candidate, data, screen);
  const distance = screenDistance(projected.projected, screen);
  return candidateHit(candidate, distance, defaultTolerance, {
    point: projected.point,
    projected: projected.projected,
    t: projected.t
  });
}

function pointHit(viewer, candidate, screen, defaultTolerance) {
  if (!v.isVec3(candidate.point)) return null;
  const projected = viewer.projectPoint(candidate.point);
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
      const x = (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x;
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
  const bounds = candidate.bounds || {};
  if (!v.isVec3(candidate.origin) || !v.isVec3(candidate.axisU) || !v.isVec3(candidate.axisV)) return null;
  const axisU = v.safeNorm(candidate.axisU, [0, 0, 0]);
  const axisV = v.safeNorm(candidate.axisV, [0, 0, 0]);
  if (v.len(axisU) <= 1e-9 || v.len(axisV) <= 1e-9) return null;
  return {
    origin: candidate.origin,
    axisU,
    axisV,
    minU: finiteNumberOr(bounds.minU, 0),
    maxU: finiteNumberOr(bounds.maxU, 0),
    minV: finiteNumberOr(bounds.minV, 0),
    maxV: finiteNumberOr(bounds.maxV, 0)
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
  if (!bounds) return point;
  const coords = planeCoords(bounds, point);
  const u = Math.max(Math.min(bounds.minU, bounds.maxU), Math.min(Math.max(bounds.minU, bounds.maxU), coords.u));
  const w = Math.max(Math.min(bounds.minV, bounds.maxV), Math.min(Math.max(bounds.minV, bounds.maxV), coords.v));
  return v.add(bounds.origin, v.add(v.mul(bounds.axisU, u), v.mul(bounds.axisV, w)));
}

function planeHitPoint(viewer, candidate, screen, rawPoint) {
  const normal = v.safeNorm(candidate.normal, [0, 0, 0]);
  if (!v.isVec3(candidate.origin) || v.len(normal) <= 1e-9) return null;
  let point = null;
  const ray = typeof viewer.screenRay === "function" ? viewer.screenRay(screen.x, screen.y) : null;
  if (ray?.origin && ray?.direction) point = linePlaneIntersection(ray.origin, ray.direction, candidate.origin, normal);
  if (!point && v.isVec3(rawPoint)) point = projectPointToPlane(rawPoint, candidate.origin, normal);
  if (!point && v.isVec3(candidate.point)) point = candidate.point;
  return point ? clampPlanePoint(candidate, point) : null;
}

function planeHit(viewer, candidate, screen, rawPoint, defaultTolerance) {
  const points = Array.isArray(candidate.points) ? candidate.points.filter(v.isVec3) : [];
  if (points.length < 3) return null;
  const projected = points.map((point) => viewer.projectPoint(point));
  if (projected.some((point) => !finiteScreen(point))) return null;
  const distance = screenPolygonDistance(screen, projected);
  const point = planeHitPoint(viewer, candidate, screen, rawPoint);
  if (!point) return null;
  return candidateHit(candidate, distance, defaultTolerance, {
    point,
    projected: viewer.projectPoint(point),
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

function linePairIntersection(viewer, left, right, screen, tolerance) {
  const leftData = lineScreenData(viewer, left);
  const rightData = lineScreenData(viewer, right);
  if (!leftData || !rightData) return null;
  const intersection = screenLineIntersection(leftData, rightData);
  if (!intersection) return null;
  const projected = { x: intersection.x, y: intersection.y };
  const distance = screenDistance(projected, screen);
  if (distance > tolerance) return null;

  const leftPoint = v.add(left.a, v.mul(v.sub(left.b, left.a), intersection.leftT));
  const rightPoint = v.add(right.a, v.mul(v.sub(right.b, right.a), intersection.rightT));
  const closest = closestAxisPoints(left, right);
  const worldTolerance = Math.max(
    finiteNumberOr(left.worldIntersectionTolerance, 1),
    finiteNumberOr(right.worldIntersectionTolerance, 1)
  );
  if (closest.distance <= worldTolerance) {
    const point = v.mul(v.add(closest.pointA, closest.pointB), 0.5);
    const pointProjected = viewer.projectPoint(point);
    const pointDistance = finiteScreen(pointProjected) ? screenDistance(pointProjected, screen) : distance;
    return {
      kind: "point",
      type: "axis-intersection",
      point,
      projected: finiteScreen(pointProjected) ? pointProjected : projected,
      screenDistance: pointDistance,
      priority: Math.max(left.priority || 0, right.priority || 0) + 80,
      label: `${left.label || left.type || "Axis"} x ${right.label || right.type || "Axis"}`,
      sources: [left, right]
    };
  }
  const screenSource = left.type === "screen-line" || left.screenIntersectionMode === "self"
    ? { candidate: left, point: leftPoint }
    : right.type === "screen-line" || right.screenIntersectionMode === "self"
      ? { candidate: right, point: rightPoint }
      : null;
  const point = screenSource?.point || leftPoint;
  return {
    kind: "point",
    type: "axis-intersection",
    point,
    projected,
    screenDistance: distance,
    priority: Math.max(left.priority || 0, right.priority || 0) + 80,
    label: `${left.label || left.type || "Axis"} x ${right.label || right.type || "Axis"}`,
    sources: [left, right]
  };
}

function snapClass(hit) {
  if (hit?.kind === "point" && hit.type !== "axis-intersection") return "point";
  if (hit?.type === "axis-intersection") return "intersection";
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
  return hit.screenDistance - snapClassBias(hit, pointBiasPx, intersectionBiasPx, lineBiasPx, projectionBiasPx);
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

function withCandidateIds(candidates = [], excludeObjectId = null) {
  const usable = [];
  const diagnostics = [];
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate) continue;
    const normalized = { ...candidate, candidateId: candidateId(candidate, index) };
    if (normalized.objectId && normalized.objectId === excludeObjectId) {
      diagnostics.push(snapDiagnostic(normalized, "rejected", "excluded active object"));
      continue;
    }
    usable.push(normalized);
  }
  return { usable, diagnostics };
}

export function solveSnap({
  candidates = [],
  viewer,
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
  cycleIndex = 0
} = {}) {
  if (!viewer || !finiteScreen(screen)) {
    return {
      snap: null,
      candidates: [],
      diagnostics: [snapDiagnostic(null, "rejected", "missing viewer or finite screen")]
    };
  }
  const { usable, diagnostics: rejectedDiagnostics } = withCandidateIds(candidates, excludeObjectId);
  const hits = [];
  for (const candidate of usable) {
    if (candidate.intersectionOnly) {
      rejectedDiagnostics.push(snapDiagnostic(candidate, "candidate", "intersection-only source"));
      continue;
    }
    const hit = candidate.kind === "line"
      ? lineHit(viewer, candidate, screen, screenTolerance)
      : candidate.kind === "plane"
        ? planeHit(viewer, candidate, screen, rawPoint, screenTolerance)
        : pointHit(viewer, candidate, screen, screenTolerance);
    if (hit) {
      hits.push(hit);
    } else {
      rejectedDiagnostics.push(snapDiagnostic(candidate, "rejected", "outside screen tolerance or not projectable"));
    }
  }

  const intersectionTolerance = finiteNumberOr(intersectionTolerancePx, screenTolerance * 1.35);
  const intersectionSourceLimit = Math.max(0, Math.floor(finiteNumberOr(maxIntersectionSources, 48)));
  const lineSourceHits = [];
  if (intersectionSourceLimit > 0) {
    for (const candidate of usable) {
      if (candidate.kind !== "line" || candidate.allowIntersections === false) continue;
      const hit = lineHit(viewer, candidate, screen, intersectionTolerance);
      if (hit) lineSourceHits.push(hit);
    }
  }
  lineSourceHits.sort((left, right) => rankSnap(left, right, pointPriorityBiasPx, intersectionPriorityBiasPx, linePriorityBiasPx, projectionPriorityBiasPx));
  const lineIntersectionSources = lineSourceHits.slice(0, intersectionSourceLimit);
  if (lineSourceHits.length > lineIntersectionSources.length) {
    rejectedDiagnostics.push(snapDiagnostic(null, "rejected", "intersection source limit", {
      candidateId: "solver.intersections:source-limit",
      providerId: "solver.intersections",
      type: "axis-intersection",
      label: `${lineSourceHits.length - lineIntersectionSources.length} intersection sources skipped`
    }));
  }
  for (let i = 0; i < lineIntersectionSources.length; i += 1) {
    for (let j = i + 1; j < lineIntersectionSources.length; j += 1) {
      const hit = linePairIntersection(viewer, lineIntersectionSources[i], lineIntersectionSources[j], screen, intersectionTolerance);
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
    pointPriorityBiasPx,
    intersectionPriorityBiasPx,
    linePriorityBiasPx,
    projectionPriorityBiasPx
  ));
  const snap = hits.length ? hits[Math.abs(cycleIndex) % hits.length] : null;
  const hitDiagnostics = hits.map((hit, index) => snapDiagnostic(hit, hit === snap ? "accepted" : "candidate", hit === snap ? "selected by rank/cycle" : "ranked alternative", {
    screenDistance: hit.screenDistance,
    rank: index + 1
  }));
  return {
    snap,
    candidates: hits,
    diagnostics: [
      ...hitDiagnostics,
      ...rejectedDiagnostics
    ]
  };
}
