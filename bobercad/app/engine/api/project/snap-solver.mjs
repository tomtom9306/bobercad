import { v } from "../../core/math.mjs";
import { snapCandidates } from "./snap-candidates.mjs";

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function closestPointOnLine(a, b, point) {
  const ab = v.sub(b, a);
  const lengthSq = v.dot(ab, ab);
  if (lengthSq <= 1e-12) return { point: [...a], t: 0 };
  const t = clamp01(v.dot(v.sub(point, a), ab) / lengthSq);
  return { point: v.add(a, v.mul(ab, t)), t };
}

function closestPointOnScreenSegment(screen, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq <= 1e-9 ? 0 : clamp01(((screen.x - a.x) * abx + (screen.y - a.y) * aby) / lengthSq);
  return {
    t,
    x: a.x + abx * t,
    y: a.y + aby * t
  };
}

function projectCandidate(candidate, viewer, screen, rawPoint) {
  if (candidate.kind === "point") {
    const projected = viewer.projectPoint(candidate.point);
    if (!projected) return null;
    return {
      ...candidate,
      point: candidate.point,
      screenDistance: Math.hypot(projected.x - screen.x, projected.y - screen.y),
      projected
    };
  }

  if (candidate.kind === "line") {
    const a = viewer.projectPoint(candidate.a);
    const b = viewer.projectPoint(candidate.b);
    if (!a || !b) return null;
    const screenClosest = closestPointOnScreenSegment(screen, a, b);
    const worldClosest = finitePoint(rawPoint)
      ? closestPointOnLine(candidate.a, candidate.b, rawPoint)
      : { point: v.add(candidate.a, v.mul(v.sub(candidate.b, candidate.a), screenClosest.t)), t: screenClosest.t };
    return {
      ...candidate,
      point: worldClosest.point,
      t: worldClosest.t,
      screenDistance: Math.hypot(screenClosest.x - screen.x, screenClosest.y - screen.y),
      projected: screenClosest
    };
  }

  return null;
}

export function solveSnap({
  candidates,
  viewer,
  screen,
  rawPoint = null,
  excludeObjectId = null,
  screenTolerance = 14,
  cycleIndex = 0
}) {
  if (!screen || !viewer) return { snap: null, candidates: [] };
  const matches = [];
  for (const candidate of candidates || []) {
    if (excludeObjectId && candidate.objectId === excludeObjectId) continue;
    const projected = projectCandidate(candidate, viewer, screen, rawPoint);
    if (!projected || projected.screenDistance > screenTolerance) continue;
    matches.push(projected);
  }

  matches.sort((a, b) => {
    const distance = a.screenDistance - b.screenDistance;
    if (Math.abs(distance) > 0.01) return distance;
    return (b.priority || 0) - (a.priority || 0);
  });

  if (!matches.length) return { snap: null, candidates: [] };
  return {
    snap: matches[Math.abs(cycleIndex) % matches.length],
    candidates: matches
  };
}

export function nearestSnapPoint(project, point, options = {}) {
  const tolerance = options.tolerance ?? 25;
  const candidates = options.candidates || snapCandidates(project, { ...options, includeLines: false });
  let best = null;
  for (const candidate of candidates) {
    if (candidate.kind && candidate.kind !== "point") continue;
    if (options.excludeObjectId && candidate.objectId === options.excludeObjectId) continue;
    const distance = v.len(v.sub(candidate.point, point));
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { ...candidate, distance };
  }
  return best;
}
