import { v } from "../../core/math.mjs";
import { memberCenter, memberLayoutAxis } from "./members.mjs";

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function pushPoint(candidates, point, data) {
  if (!finitePoint(point)) return;
  candidates.push({
    kind: "point",
    point: [...point],
    priority: 100,
    ...data
  });
}

function pushLine(candidates, a, b, data) {
  if (!finitePoint(a) || !finitePoint(b) || v.len(v.sub(b, a)) <= 1e-9) return;
  candidates.push({
    kind: "line",
    a: [...a],
    b: [...b],
    priority: 60,
    ...data
  });
}

function gridDirections(grid) {
  const rotation = (grid.rotation || 0) * Math.PI / 180;
  return {
    xDir: [Math.cos(rotation), Math.sin(rotation), 0],
    yDir: [-Math.sin(rotation), Math.cos(rotation), 0]
  };
}

function gridPosition(origin, xDir, yDir, x, y, z) {
  return v.add(v.add([origin[0], origin[1], z], v.mul(xDir, x)), v.mul(yDir, y));
}

function axisSpan(values, fallback = 5000) {
  const positions = values.map((axis) => axis.position || 0);
  if (!positions.length) return [-fallback, fallback];
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  if (Math.abs(max - min) < 1e-9) return [min - fallback, max + fallback];
  const pad = Math.max((max - min) * 0.25, fallback * 0.2);
  return [min - pad, max + pad];
}

function inSnapRange(point, options) {
  if (!finitePoint(options.center) || !(options.radius > 0)) return true;
  if (!finitePoint(point)) return false;
  return v.len(v.sub(point, options.center)) <= options.radius;
}

function closestPointOnSegment(a, b, point) {
  const ab = v.sub(b, a);
  const lengthSq = v.dot(ab, ab);
  if (lengthSq <= 1e-12) return a;
  const t = Math.max(0, Math.min(1, v.dot(v.sub(point, a), ab) / lengthSq));
  return v.add(a, v.mul(ab, t));
}

function memberSnapDistance(member, options) {
  if (!finitePoint(options.center) || !(options.radius > 0)) return true;
  const closest = closestPointOnSegment(member.start, member.end, options.center);
  return v.len(v.sub(closest, options.center));
}

function memberInSnapRange(member, options) {
  const distance = memberSnapDistance(member, options);
  return distance === true || distance <= options.radius;
}

function memberSnapSource(project, options) {
  const members = Object.values(project.model?.members || {});
  const maxMemberCandidates = Number.isFinite(options.maxMemberCandidates)
    ? Math.max(0, Math.floor(options.maxMemberCandidates))
    : null;
  if (maxMemberCandidates === null) return members.filter((member) => memberInSnapRange(member, options));
  if (maxMemberCandidates <= 0) return [];

  const scored = [];
  for (const member of members) {
    const distance = memberSnapDistance(member, options);
    if (distance !== true && options.radius > 0 && distance > options.radius) continue;
    scored.push({ member, distance: distance === true ? 0 : distance });
  }
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, maxMemberCandidates).map((item) => item.member);
}

function addGridCandidates(candidates, project) {
  const projectLevels = Object.values(project.levels || project.model?.levels || {});
  for (const grid of Object.values(project.gridSystems || project.model?.gridSystems || {})) {
    const origin = grid.origin || [0, 0, 0];
    const xAxes = grid.axes?.x || [];
    const yAxes = grid.axes?.y || [];
    const levels = grid.levels || (projectLevels.length ? projectLevels : [{ id: "base", elevation: origin[2] || 0 }]);
    const { xDir, yDir } = gridDirections(grid);
    const xSpan = axisSpan(xAxes);
    const ySpan = axisSpan(yAxes);

    for (const level of levels) {
      const z = level.elevation || 0;
      for (const xAxis of xAxes) {
        const x = xAxis.position || 0;
        pushLine(
          candidates,
          gridPosition(origin, xDir, yDir, x, ySpan[0], z),
          gridPosition(origin, xDir, yDir, x, ySpan[1], z),
          {
            type: "grid-line",
            objectId: grid.id,
            axis: "x",
            label: `Grid ${xAxis.id || "X"} @ ${level.id || z}`,
            priority: 55
          }
        );
      }
      for (const yAxis of yAxes) {
        const y = yAxis.position || 0;
        pushLine(
          candidates,
          gridPosition(origin, xDir, yDir, xSpan[0], y, z),
          gridPosition(origin, xDir, yDir, xSpan[1], y, z),
          {
            type: "grid-line",
            objectId: grid.id,
            axis: "y",
            label: `Grid ${yAxis.id || "Y"} @ ${level.id || z}`,
            priority: 55
          }
        );
      }
      for (const xAxis of xAxes) {
        for (const yAxis of yAxes) {
          pushPoint(candidates, gridPosition(origin, xDir, yDir, xAxis.position || 0, yAxis.position || 0, z), {
            type: "grid-intersection",
            objectId: grid.id,
            label: `Grid ${xAxis.id || "X"}/${yAxis.id || "Y"} @ ${level.id || z}`,
            priority: 130
          });
        }
      }
    }
  }
}

function addGlobalAxisCandidates(candidates, options) {
  if (!options.includeGlobalAxes) return;
  const origin = finitePoint(options.globalAxisOrigin) ? options.globalAxisOrigin : [0, 0, 0];
  const span = Number.isFinite(options.globalAxisSpan) ? Math.max(1, options.globalAxisSpan) : 100000;
  const tolerancePx = Number.isFinite(options.globalAxisSnapTolerancePx) ? options.globalAxisSnapTolerancePx : undefined;
  pushPoint(candidates, origin, {
    type: "global-origin",
    label: "Global origin",
    priority: 260
  });
  for (const [axis, direction] of Object.entries({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] })) {
    pushLine(candidates, v.sub(origin, v.mul(direction, span)), v.add(origin, v.mul(direction, span)), {
      type: "global-axis",
      axis,
      point: [...origin],
      label: `Global ${axis.toUpperCase()} axis`,
      priority: 240,
      screenTolerance: tolerancePx,
      screenIntersectionMode: "self"
    });
  }
}

export function snapCandidates(project, options = {}) {
  const candidates = [];
  const includeMembers = options.includeMembers !== false;
  const includeLayoutAxis = options.includeLayoutAxis !== false;
  const includeLines = options.includeLines !== false;

  if (includeMembers) {
    for (const member of memberSnapSource(project, options)) {
      pushPoint(candidates, member.start, {
        type: "member-endpoint",
        objectId: member.id,
        endpoint: "start",
        label: `Endpoint: ${member.id} start`,
        priority: 120
      });
      pushPoint(candidates, member.end, {
        type: "member-endpoint",
        objectId: member.id,
        endpoint: "end",
        label: `Endpoint: ${member.id} end`,
        priority: 120
      });
      pushPoint(candidates, memberCenter(member), {
        type: "member-midpoint",
        objectId: member.id,
        label: `Midpoint: ${member.id}`,
        priority: 95
      });
      if (includeLines) {
        pushLine(candidates, member.start, member.end, {
          type: "member-axis",
          objectId: member.id,
          label: `Axis: ${member.id}`,
          priority: 70
        });
      }
      if (includeLayoutAxis && member.layoutAxis) {
        const axis = memberLayoutAxis(member);
        pushPoint(candidates, axis.start, {
          type: "layout-endpoint",
          objectId: member.id,
          endpoint: "start",
          label: `Layout endpoint: ${member.id} start`,
          priority: 115
        });
        pushPoint(candidates, axis.end, {
          type: "layout-endpoint",
          objectId: member.id,
          endpoint: "end",
          label: `Layout endpoint: ${member.id} end`,
          priority: 115
        });
        if (includeLines) {
          pushLine(candidates, axis.start, axis.end, {
            type: "layout-axis",
            objectId: member.id,
            label: `Layout axis: ${member.id}`,
            priority: 80
          });
        }
      }
    }
  }

  for (const point of Object.values(project.model?.workPoints || {})) {
    if (!inSnapRange(point.point || point.position, options)) continue;
    pushPoint(candidates, point.point || point.position, {
      type: "work-point",
      objectId: point.id,
      label: `Work point: ${point.name || point.id}`,
      priority: 125
    });
  }

  addGridCandidates(candidates, project);
  addGlobalAxisCandidates(candidates, options);
  if (Array.isArray(options.extraCandidates)) candidates.push(...options.extraCandidates);
  return candidates;
}

export function pointSnapCandidates(project, options = {}) {
  return snapCandidates(project, options).filter((candidate) => candidate.kind === "point");
}
