import { arrayValues } from "../../core/model.mjs?v=array-values-dry-1";
import { v } from "../../core/math.mjs?v=axis-segment-dry-1";

const EPSILON = 1e-9;

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  return Number.isFinite(Number(value));
}

function safeVec3(value, fallback) {
  return Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))
    ? value.map(Number)
    : fallback;
}

function safeNorm(value, fallback) {
  const vector = safeVec3(value, fallback);
  return v.len(vector) > EPSILON ? v.norm(vector) : fallback;
}

function orthogonalFallback(axis) {
  const candidate = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  return v.norm(v.cross ? v.cross(axis, candidate) : [
    axis[1] * candidate[2] - axis[2] * candidate[1],
    axis[2] * candidate[0] - axis[0] * candidate[2],
    axis[0] * candidate[1] - axis[1] * candidate[0]
  ]);
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function projectGridSystems(project) {
  return plainObject(project?.model?.gridSystems) ? project.model.gridSystems : {};
}

export function projectLevels(project) {
  return plainObject(project?.model?.levels) ? project.model.levels : {};
}

export function gridSystemById(project, gridSystemId) {
  return projectGridSystems(project)[gridSystemId] || null;
}

export function levelById(project, levelId) {
  return projectLevels(project)[levelId] || null;
}

export function gridSystemBasis(grid = {}) {
  const origin = safeVec3(grid.origin, [0, 0, 0]);
  const axisX = safeNorm(grid.axisX, null);
  const axisY = safeNorm(grid.axisY, null);
  if (axisX && axisY && v.len(cross(axisX, axisY)) > EPSILON) {
    const axisZ = safeNorm(grid.axisZ, v.norm(cross(axisX, axisY)));
    return { origin, axisX, axisY, axisZ };
  }

  const rotation = finiteNumber(grid.rotation) ? Number(grid.rotation) * Math.PI / 180 : 0;
  const x = axisX || [Math.cos(rotation), Math.sin(rotation), 0];
  const y = axisY || [-Math.sin(rotation), Math.cos(rotation), 0];
  const z = safeNorm(grid.axisZ, v.norm(cross(x, y)));
  return {
    origin,
    axisX: safeNorm(x, [1, 0, 0]),
    axisY: safeNorm(y, orthogonalFallback(x)),
    axisZ: z
  };
}

export function gridAxes(grid = {}, axisId) {
  if (axisId) return arrayValues(grid.axes?.[axisId]);
  return {
    x: arrayValues(grid.axes?.x),
    y: arrayValues(grid.axes?.y)
  };
}

export function datumLevelsForGrid(project, grid = {}) {
  const levels = projectLevels(project);
  const levelIds = Array.isArray(grid.levelIds) ? grid.levelIds.filter(Boolean) : [];
  const selected = levelIds.map((levelId) => levels[levelId]).filter(Boolean);
  if (selected.length) return selected;
  const allLevels = Object.values(levels);
  if (allLevels.length) return allLevels;
  const origin = safeVec3(grid.origin, [0, 0, 0]);
  return [{ id: "level_origin", name: "Origin", elevation: origin[2] || 0 }];
}

export function gridAxisSpan(axes = [], fallback = 5000) {
  const positions = axes.map((axis) => Number(axis.position || 0)).filter(Number.isFinite);
  if (!positions.length) return [-fallback, fallback];
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  if (Math.abs(max - min) < EPSILON) return [min - fallback, max + fallback];
  const pad = Math.max((max - min) * 0.25, fallback * 0.2);
  return [min - pad, max + pad];
}

export function gridPoint(grid, xPosition = 0, yPosition = 0, elevation = 0) {
  const { origin, axisX, axisY, axisZ } = gridSystemBasis(grid);
  return v.add(v.add(v.add(origin, v.mul(axisX, Number(xPosition || 0))), v.mul(axisY, Number(yPosition || 0))), v.mul(axisZ, Number(elevation || 0)));
}

export function gridLineSegmentsAtLevel(project, grid = {}, level = {}) {
  const axes = gridAxes(grid);
  const xSpan = gridAxisSpan(axes.x);
  const ySpan = gridAxisSpan(axes.y);
  const elevation = Number(level.elevation || 0);
  const segments = [];
  for (const axis of axes.x) {
    const position = Number(axis.position || 0);
    segments.push({
      grid,
      level,
      axis,
      axisGroup: "x",
      a: gridPoint(grid, position, ySpan[0], elevation),
      b: gridPoint(grid, position, ySpan[1], elevation)
    });
  }
  for (const axis of axes.y) {
    const position = Number(axis.position || 0);
    segments.push({
      grid,
      level,
      axis,
      axisGroup: "y",
      a: gridPoint(grid, xSpan[0], position, elevation),
      b: gridPoint(grid, xSpan[1], position, elevation)
    });
  }
  return segments;
}

export function gridIntersectionPointsAtLevel(project, grid = {}, level = {}) {
  const axes = gridAxes(grid);
  const elevation = Number(level.elevation || 0);
  const points = [];
  for (const xAxis of axes.x) {
    for (const yAxis of axes.y) {
      points.push({
        grid,
        level,
        xAxis,
        yAxis,
        point: gridPoint(grid, Number(xAxis.position || 0), Number(yAxis.position || 0), elevation)
      });
    }
  }
  return points;
}

export function allGridLineSegments(project) {
  return Object.values(projectGridSystems(project)).flatMap((grid) => (
    datumLevelsForGrid(project, grid).flatMap((level) => gridLineSegmentsAtLevel(project, grid, level))
  ));
}

export function allGridIntersectionPoints(project) {
  return Object.values(projectGridSystems(project)).flatMap((grid) => (
    datumLevelsForGrid(project, grid).flatMap((level) => gridIntersectionPointsAtLevel(project, grid, level))
  ));
}
