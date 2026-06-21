import { finiteNumber } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";

export function sceneCollectionCounts(project = {}) {
  const model = project.model || {};
  return Object.fromEntries([
    "members",
    "plates",
    "sketches",
    "trimJoints",
    "fastenerGroups",
    "welds",
    "gridSystems",
    "levels",
    "workPoints",
    "referencePlanes"
  ].map((collection) => [collection, Object.keys(model[collection] || {}).length]));
}

export function sceneReferencePoints(project = {}) {
  const model = project.model || {};
  const points = [];
  const addPoint = (point) => {
    const next = vec3(point);
    if (next) points.push(next);
  };

  for (const member of objectValues(model.members)) {
    addPoint(member.start);
    addPoint(member.end);
    addPoint(member.layoutAxis?.start);
    addPoint(member.layoutAxis?.end);
  }
  for (const plate of objectValues(model.plates)) {
    addPoint(plate.center);
    for (const point of plateCornerPoints(plate)) addPoint(point);
  }
  for (const sketch of objectValues(model.sketches)) {
    addPoint(sketch.origin || sketch.center);
  }
  for (const workPoint of objectValues(model.workPoints)) addPoint(workPoint.point);
  for (const referencePlane of objectValues(model.referencePlanes)) addPoint(referencePlane.origin);
  for (const level of objectValues(model.levels)) {
    if (finiteNumber(level.elevation)) addPoint([0, 0, level.elevation]);
  }
  for (const grid of objectValues(model.gridSystems)) {
    for (const point of gridSystemReferencePoints(grid, model.levels || {})) addPoint(point);
  }
  return points;
}

function plateCornerPoints(plate = {}) {
  const center = vec3(plate.center);
  const axisX = vec3(plate.axisX);
  const axisY = vec3(plate.axisY);
  if (!center || !axisX || !axisY || !finiteNumber(plate.width) || !finiteNumber(plate.height)) return [];
  const halfWidth = plate.width * 0.5;
  const halfHeight = plate.height * 0.5;
  return [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => [
    center[0] + axisX[0] * halfWidth * xSign + axisY[0] * halfHeight * ySign,
    center[1] + axisX[1] * halfWidth * xSign + axisY[1] * halfHeight * ySign,
    center[2] + axisX[2] * halfWidth * xSign + axisY[2] * halfHeight * ySign
  ]));
}

function gridSystemReferencePoints(grid = {}, levels = {}) {
  const origin = vec3(grid.origin) || [0, 0, 0];
  const axisX = vec3(grid.axisX) || [1, 0, 0];
  const axisY = vec3(grid.axisY) || [0, 1, 0];
  const axisZ = vec3(grid.axisZ) || [0, 0, 1];
  const xPositions = axisPositions(grid.axes?.x);
  const yPositions = axisPositions(grid.axes?.y);
  const zPositions = levelElevations(grid.levelIds, levels);
  const points = [];
  for (const x of xPositions) {
    for (const y of yPositions) {
      for (const z of zPositions) {
        points.push([
          origin[0] + axisX[0] * x + axisY[0] * y + axisZ[0] * z,
          origin[1] + axisX[1] * x + axisY[1] * y + axisZ[1] * z,
          origin[2] + axisX[2] * x + axisY[2] * y + axisZ[2] * z
        ]);
      }
    }
  }
  return points;
}

function axisPositions(axes = []) {
  const positions = arrayValues(axes).map((axis) => axis.position).filter(finiteNumber);
  return positions.length ? positions : [0];
}

function levelElevations(levelIds = [], levels = {}) {
  const ids = arrayValues(levelIds).filter(Boolean);
  const values = (ids.length ? ids.map((id) => levels[id]?.elevation) : objectValues(levels).map((level) => level.elevation))
    .filter(finiteNumber);
  return values.length ? values : [0];
}

function objectValues(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.values(value) : [];
}

function vec3(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const point = value.slice(0, 3).map(Number);
  return point.every(finiteNumber) ? point : null;
}
