import { v } from "../../core/math.mjs";
import { snapCandidates } from "./snap-candidates.mjs";

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function finiteScreen(point) {
  return point && typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y);
}

function screenDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lineScreenData(viewer, candidate) {
  if (!finitePoint(candidate.a) || !finitePoint(candidate.b)) return null;
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

function lineHit(viewer, candidate, screen, defaultTolerance) {
  const data = lineScreenData(viewer, candidate);
  if (!data) return null;
  const projected = pointOnLineAtScreen(candidate, data, screen);
  const distance = screenDistance(projected.projected, screen);
  const tolerance = Number.isFinite(candidate.screenTolerance) ? candidate.screenTolerance : defaultTolerance;
  if (distance > tolerance) return null;
  return {
    ...candidate,
    point: projected.point,
    projected: projected.projected,
    t: projected.t,
    screenDistance: distance
  };
}

function pointHit(viewer, candidate, screen, defaultTolerance) {
  if (!finitePoint(candidate.point)) return null;
  const projected = viewer.projectPoint(candidate.point);
  if (!finiteScreen(projected)) return null;
  const distance = screenDistance(projected, screen);
  const tolerance = Number.isFinite(candidate.screenTolerance) ? candidate.screenTolerance : defaultTolerance;
  if (distance > tolerance) return null;
  return {
    ...candidate,
    projected,
    screenDistance: distance
  };
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

function closestAxisPoints(left, right) {
  const a0 = left.a;
  const b0 = right.a;
  const ad = v.norm(v.sub(left.b, left.a));
  const bd = v.norm(v.sub(right.b, right.a));
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
    Number.isFinite(left.worldIntersectionTolerance) ? left.worldIntersectionTolerance : 1,
    Number.isFinite(right.worldIntersectionTolerance) ? right.worldIntersectionTolerance : 1
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

function rankSnap(left, right) {
  const leftPriority = left.priority || 0;
  const rightPriority = right.priority || 0;
  if (Math.abs(left.screenDistance - right.screenDistance) > 1e-6) return left.screenDistance - right.screenDistance;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  return String(left.label || left.type || "").localeCompare(String(right.label || right.type || ""));
}

export function nearestSnapPoint(project, point, options = {}) {
  const tolerance = options.tolerance ?? 25;
  const candidates = options.candidates || snapCandidates(project, { ...options, includeLines: false });
  let best = null;
  for (const candidate of candidates) {
    if (candidate.kind && candidate.kind !== "point") continue;
    if (!finitePoint(candidate.point)) continue;
    if (options.excludeObjectId && candidate.objectId === options.excludeObjectId) continue;
    const distance = v.len(v.sub(candidate.point, point));
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { ...candidate, distance };
  }
  return best;
}

export function solveSnap({
  candidates = [],
  viewer,
  screen,
  rawPoint = null,
  excludeObjectId = null,
  screenTolerance = 14,
  intersectionTolerancePx = null,
  cycleIndex = 0
} = {}) {
  if (!viewer || !finiteScreen(screen)) return { snap: null, candidates: [] };
  const usable = candidates.filter((candidate) => candidate && candidate.objectId !== excludeObjectId);
  const hits = [];
  for (const candidate of usable) {
    if (candidate.intersectionOnly) continue;
    const hit = candidate.kind === "line"
      ? lineHit(viewer, candidate, screen, screenTolerance)
      : pointHit(viewer, candidate, screen, screenTolerance);
    if (hit) hits.push(hit);
  }

  const lineCandidates = usable.filter((candidate) => candidate.kind === "line");
  const intersectionTolerance = Number.isFinite(intersectionTolerancePx) ? intersectionTolerancePx : screenTolerance * 1.35;
  for (let i = 0; i < lineCandidates.length; i += 1) {
    for (let j = i + 1; j < lineCandidates.length; j += 1) {
      const hit = linePairIntersection(viewer, lineCandidates[i], lineCandidates[j], screen, intersectionTolerance);
      if (hit) hits.push(hit);
    }
  }

  if (rawPoint && !hits.length) return { snap: null, candidates: [] };
  hits.sort(rankSnap);
  const snap = hits.length ? hits[Math.abs(cycleIndex) % hits.length] : null;
  return { snap, candidates: hits };
}
