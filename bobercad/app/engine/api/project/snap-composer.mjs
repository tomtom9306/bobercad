import { v } from "../../core/math.mjs";
import { memberCenter, memberLayoutAxis } from "./members.mjs";

const EPSILON = 1e-9;

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function axisFromLine(candidate) {
  if (candidate?.kind !== "line" || !finitePoint(candidate.a) || !finitePoint(candidate.b)) return null;
  const direction = v.norm(v.sub(candidate.b, candidate.a));
  if (v.len(direction) <= EPSILON) return null;
  return {
    origin: finitePoint(candidate.point) ? candidate.point : candidate.a,
    direction,
    source: candidate
  };
}

function memberAxisSource(member, type, axis) {
  return {
    kind: "line",
    type,
    objectId: member.id,
    a: axis.start,
    b: axis.end,
    point: axis.start,
    label: type === "layout-axis" ? `Layout axis: ${member.id}` : `Axis: ${member.id}`
  };
}

function memberAxes(member) {
  const axes = [memberAxisSource(member, "member-axis", { start: member.start, end: member.end })];
  if (member.layoutAxis) axes.push(memberAxisSource(member, "layout-axis", memberLayoutAxis(member)));
  return axes;
}

function memberPoints(member) {
  const points = [
    { kind: "point", type: "member-endpoint", objectId: member.id, endpoint: "start", point: member.start, label: `${member.id} start` },
    { kind: "point", type: "member-endpoint", objectId: member.id, endpoint: "end", point: member.end, label: `${member.id} end` },
    { kind: "point", type: "member-midpoint", objectId: member.id, point: memberCenter(member), label: `${member.id} midpoint` }
  ];
  if (member.layoutAxis) {
    const axis = memberLayoutAxis(member);
    points.push(
      { kind: "point", type: "layout-endpoint", objectId: member.id, endpoint: "start", point: axis.start, label: `${member.id} layout start` },
      { kind: "point", type: "layout-endpoint", objectId: member.id, endpoint: "end", point: axis.end, label: `${member.id} layout end` }
    );
  }
  return points.filter((point) => finitePoint(point.point));
}

function pointOnAxis(axis, point) {
  return v.add(axis.origin, v.mul(axis.direction, v.dot(v.sub(point, axis.origin), axis.direction)));
}

function closestAxisPoints(left, right) {
  const r = v.sub(left.origin, right.origin);
  const dot = v.dot(left.direction, right.direction);
  const c = v.dot(left.direction, r);
  const f = v.dot(right.direction, r);
  const denominator = 1 - dot * dot;
  if (Math.abs(denominator) <= EPSILON) return null;
  const leftPoint = v.add(left.origin, v.mul(left.direction, (dot * f - c) / denominator));
  const rightPoint = v.add(right.origin, v.mul(right.direction, (f - dot * c) / denominator));
  return { leftPoint, rightPoint };
}

function guideLine(sourcePoint, targetPoint, label) {
  if (!finitePoint(sourcePoint) || !finitePoint(targetPoint) || v.len(v.sub(targetPoint, sourcePoint)) <= EPSILON) return null;
  return {
    kind: "line",
    type: "composite-guide-axis",
    a: sourcePoint,
    b: targetPoint,
    point: targetPoint,
    label
  };
}

function addCandidate(candidates, candidate, seen) {
  if (!finitePoint(candidate.point)) return;
  const key = candidate.point.map((value) => Math.round(value * 1000) / 1000).join(",");
  const index = seen.get(key);
  if (index !== undefined) {
    if ((candidate.priority || 0) > (candidates[index].priority || 0)) candidates[index] = candidate;
    return;
  }
  seen.set(key, candidates.length);
  candidates.push(candidate);
}

export function composeSnapCandidates(project, options = {}) {
  const constructionAxes = (options.constructionAxes || []).map(axisFromLine).filter(Boolean);
  const activeMemberIds = [...new Set(options.activeMemberIds || [])].slice(0, 2);
  if (!constructionAxes.length || !activeMemberIds.length) return [];

  const members = activeMemberIds
    .map((memberId) => project.model?.members?.[memberId])
    .filter(Boolean);
  const screenTolerance = Number.isFinite(options.screenTolerance) ? options.screenTolerance : undefined;
  const candidates = [];
  const seen = new Map();

  for (const constructionAxis of constructionAxes) {
    for (const member of members) {
      const axes = memberAxes(member);
      for (const memberPoint of memberPoints(member)) {
        const point = pointOnAxis(constructionAxis, memberPoint.point);
        const memberAxis = axes[0];
        const guide = guideLine(memberPoint.point, point, `${memberPoint.label} projection`);
        addCandidate(candidates, {
          kind: "point",
          type: "composite-point",
          constraint: "point-projected-on-construction-axis",
          point,
          label: `${constructionAxis.source.label || "Axis"} x ${memberPoint.label}`,
          priority: 145,
          screenTolerance,
          sources: [constructionAxis.source, memberPoint, memberAxis, guide].filter(Boolean)
        }, seen);
      }
      for (const axisSource of axes) {
        const memberAxis = axisFromLine(axisSource);
        if (!memberAxis) continue;
        const closest = closestAxisPoints(constructionAxis, memberAxis);
        if (!closest) continue;
        const point = closest.leftPoint;
        const guide = guideLine(closest.rightPoint, point, `${axisSource.label || "Member axis"} projection`);
        addCandidate(candidates, {
          kind: "point",
          type: "composite-point",
          constraint: "axis-axis-nearest-point",
          point,
          label: `${constructionAxis.source.label || "Axis"} x ${axisSource.label || "Member axis"}`,
          priority: 150,
          screenTolerance,
          sources: [constructionAxis.source, axisSource, guide].filter(Boolean)
        }, seen);
      }
    }
  }

  return candidates;
}
