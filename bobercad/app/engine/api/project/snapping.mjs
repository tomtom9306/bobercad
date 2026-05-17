import { v } from "../../core/math.mjs";
import { memberLayoutAxis } from "./members.mjs";

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function pushPoint(candidates, point, data) {
  if (!finitePoint(point)) return;
  candidates.push({ point: [...point], ...data });
}

function gridDirections(grid) {
  const rotation = (grid.rotation || 0) * Math.PI / 180;
  const xDir = [Math.cos(rotation), Math.sin(rotation), 0];
  const yDir = [-Math.sin(rotation), Math.cos(rotation), 0];
  return { xDir, yDir };
}

function gridPosition(origin, xDir, yDir, x, y, z) {
  return v.add(v.add([origin[0], origin[1], z], v.mul(xDir, x)), v.mul(yDir, y));
}

export function snapCandidates(project, options = {}) {
  const candidates = [];
  const includeLayoutAxis = options.includeLayoutAxis !== false;

  for (const member of Object.values(project.model?.members || {})) {
    pushPoint(candidates, member.start, {
      type: "member-endpoint",
      objectId: member.id,
      endpoint: "start",
      label: `${member.id}.start`
    });
    pushPoint(candidates, member.end, {
      type: "member-endpoint",
      objectId: member.id,
      endpoint: "end",
      label: `${member.id}.end`
    });
    if (includeLayoutAxis && member.layoutAxis) {
      const axis = memberLayoutAxis(member);
      pushPoint(candidates, axis.start, {
        type: "layout-endpoint",
        objectId: member.id,
        endpoint: "start",
        label: `${member.id}.layout.start`
      });
      pushPoint(candidates, axis.end, {
        type: "layout-endpoint",
        objectId: member.id,
        endpoint: "end",
        label: `${member.id}.layout.end`
      });
    }
  }

  for (const point of Object.values(project.model?.workPoints || {})) {
    pushPoint(candidates, point.point || point.position, {
      type: "work-point",
      objectId: point.id,
      label: point.name || point.id
    });
  }

  const projectLevels = Object.values(project.levels || project.model?.levels || {});
  for (const grid of Object.values(project.gridSystems || project.model?.gridSystems || {})) {
    const origin = grid.origin || [0, 0, 0];
    const xAxes = grid.axes?.x || [];
    const yAxes = grid.axes?.y || [];
    const levels = grid.levels || (projectLevels.length ? projectLevels : [{ id: "base", elevation: origin[2] || 0 }]);
    const { xDir, yDir } = gridDirections(grid);
    for (const xAxis of xAxes) {
      for (const yAxis of yAxes) {
        for (const level of levels) {
          pushPoint(candidates, gridPosition(origin, xDir, yDir, xAxis.position || 0, yAxis.position || 0, level.elevation || 0), {
            type: "grid-intersection",
            objectId: grid.id,
            label: `${grid.id}.${xAxis.id || "x"}.${yAxis.id || "y"}.${level.id || "level"}`
          });
        }
      }
    }
  }

  return candidates;
}

export function nearestSnapPoint(project, point, options = {}) {
  const tolerance = options.tolerance ?? 25;
  const candidates = options.candidates || snapCandidates(project, options);
  let best = null;
  for (const candidate of candidates) {
    if (options.excludeObjectId && candidate.objectId === options.excludeObjectId) continue;
    const distance = v.len(v.sub(candidate.point, point));
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { ...candidate, distance };
  }
  return best;
}
