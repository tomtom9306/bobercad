import { optionalPath } from "../../engine/modules/connections/connection-schema.mjs";
import { v } from "../../engine/core/math.mjs";
import { objectById } from "../../engine/core/model.mjs";
import { resolveInterface, sectionBounds } from "../../engine/geometry/member-geometry.mjs";

const EPSILON = 1e-6;
const COLOR = "#334155";
const ACTIVE_COLOR = "#2563eb";
const ERROR_COLOR = "#b91c1c";
const WARNING_COLOR = "#b45309";
const ARROW_LENGTH = 7;
const ARROW_HALF_WIDTH = 2.6;
const OUTSIDE_ARROW_MAX_LENGTH = 34;
const EXTENSION_GAP = 2;
const EXTENSION_OVERRUN = 6;
const DEFAULT_SURFACE_LIFT = 4;

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function fmt(value) {
  if (!finite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
}

function roleId(connection, role) {
  return connection.generator?.objectRoles?.[role] || null;
}

function roleObject(project, connection, role) {
  const id = roleId(connection, role);
  return id && project.objectIndex?.[id] ? objectById(project, id) : null;
}

function interfaceIdByRole(project, definition, connection, role) {
  const zone = project.model.connectionZones?.[connection.connectionZoneId];
  const index = (definition.interfaces || []).findIndex((item) => item.role === role);
  return index >= 0 ? zone?.interfaceIds?.[index] : null;
}

function paramValue(definition, connection, path) {
  const spec = definition.parameters[path] || {};
  return optionalPath(connection.referenceParameters, spec.writePath || path, spec.default);
}

function parameterLabel(definition, path) {
  return definition.parameters[path]?.label || path;
}

function parameterUnit(definition, path) {
  return definition.parameters[path]?.unit || "";
}

function dimensionText(definition, spec, measured, connection) {
  const value = finite(measured) ? measured : paramValue(definition, connection, spec.parameter);
  const unit = parameterUnit(definition, spec.parameter);
  return `${spec.label || parameterLabel(definition, spec.parameter)} ${fmt(value)}${unit ? ` ${unit}` : ""}`;
}

function draftingText(spec, value) {
  const text = fmt(value);
  if (spec.reference?.kind === "hole-diameter") return `Ø${text}`;
  return text;
}

function fullDimensionText(definition, spec, measured, connection) {
  const value = finite(measured) ? measured : paramValue(definition, connection, spec.parameter);
  const unit = parameterUnit(definition, spec.parameter);
  return `${parameterLabel(definition, spec.parameter)} ${fmt(value)}${unit ? ` ${unit}` : ""}`;
}

function referenceRoles(spec) {
  return Object.entries(spec.reference || {})
    .filter(([key, value]) => key.endsWith("Role") && typeof value === "string")
    .map(([, value]) => value);
}

function diagnosticPaths(spec) {
  return [
    spec.parameter,
    spec.reference?.customParameter,
    spec.reference?.rowsParameter,
    spec.reference?.columnsParameter
  ].filter(Boolean);
}

function issueForDimension(connection, spec) {
  const diagnostics = (connection.generator?.diagnostics || [])
    .filter((entry) => entry.severity === "error" || entry.severity === "warning");
  const paths = diagnosticPaths(spec);
  const roles = referenceRoles(spec);
  const matches = diagnostics.filter((entry) => (
    (entry.parameters || []).some((path) => paths.includes(path))
    || (!(entry.parameters || []).length && (entry.objectRoles || []).some((role) => roles.includes(role)))
  ));
  return matches.find((entry) => entry.severity === "error") || matches[0] || null;
}

function issueColor(issue, active) {
  if (issue?.severity === "error") return ERROR_COLOR;
  if (issue?.severity === "warning") return WARNING_COLOR;
  return active ? ACTIVE_COLOR : COLOR;
}

function dimensionTitle(definition, spec, measured, connection, issue) {
  const title = fullDimensionText(definition, spec, measured, connection);
  return issue?.message ? `${title}\n${issue.message}` : title;
}

function dimensionModeControl(definition, connection, spec) {
  const control = spec.reference?.modeControl;
  if (!control?.path || !definition.parameters[control.path]) return null;
  const parameter = definition.parameters[control.path];
  return {
    path: control.path,
    label: control.label || parameter.label || control.path,
    value: paramValue(definition, connection, control.path),
    options: Array.isArray(control.options) ? control.options : (parameter.values || []).map((value) => ({
      value,
      label: String(value)
    }))
  };
}

function basisAxis(basis, key) {
  if (key === "normal") return basis.normal;
  if (key === "localAxisY") return basis.localAxisY;
  if (key === "localAxisZ") return basis.localAxisZ;
  return [0, 0, 0];
}

function surfaceLift(settings) {
  return finite(settings?.surfaceLift) ? Math.max(0, settings.surfaceLift) : DEFAULT_SURFACE_LIFT;
}

function offsetVector(basis, offset = {}, settings = {}) {
  const lift = surfaceLift(settings);
  return Object.entries(offset).reduce((sum, [key, value]) => (
    finite(value)
      ? v.add(sum, v.mul(
        basisAxis(basis, key),
        settings.clampNormal !== false && key === "normal" && Math.abs(value) > lift ? Math.sign(value) * lift : value
      ))
      : sum
  ), [0, 0, 0]);
}

function dimensionOffset(ctx, basis, offset = {}, options = {}) {
  return offsetVector(basis, offset, {
    ...(ctx.dimensionSettings || {}),
    ...options
  });
}

function midpoint(a, b) {
  return v.mul(v.add(a, b), 0.5);
}

function distance(a, b) {
  return v.len(v.sub(b, a));
}

function perpendicularAxis(axis) {
  const fromZ = v.cross(axis, [0, 0, 1]);
  if (v.len(fromZ) > EPSILON) return v.norm(fromZ);
  return v.norm(v.cross(axis, [0, 1, 0]));
}

function pushLine(lines, base, a, b) {
  if (distance(a, b) <= EPSILON) return;
  lines.push({ ...base, points: [a, b] });
}

function pushArrow(lines, base, point, inward, side) {
  const arrowLength = Math.min(ARROW_LENGTH, Math.max(4, distance(base.dimensionStart, base.dimensionEnd) * 0.28));
  const back = v.mul(v.norm(inward), arrowLength);
  const spread = v.mul(v.norm(side), ARROW_HALF_WIDTH);
  pushLine(lines, base, point, v.add(point, v.add(back, spread)));
  pushLine(lines, base, point, v.add(point, v.sub(back, spread)));
}

function plateBasis(plate) {
  return {
    normal: v.norm(plate.normal),
    localAxisY: v.norm(plate.localAxisY),
    localAxisZ: v.norm(plate.localAxisZ)
  };
}

function plateBounds(plate) {
  const outline = Array.isArray(plate.outline) && plate.outline.length
    ? plate.outline
    : [
      [-plate.width / 2, -plate.height / 2],
      [plate.width / 2, -plate.height / 2],
      [plate.width / 2, plate.height / 2],
      [-plate.width / 2, plate.height / 2]
    ];
  return {
    minY: Math.min(...outline.map((point) => point[0])),
    maxY: Math.max(...outline.map((point) => point[0])),
    minZ: Math.min(...outline.map((point) => point[1])),
    maxZ: Math.max(...outline.map((point) => point[1])),
    minN: -plate.thickness / 2,
    maxN: plate.thickness / 2
  };
}

function atValue(value, min, max) {
  if (value === "min") return min;
  if (value === "max") return max;
  if (finite(value)) return value;
  return (min + max) / 2;
}

function platePoint(plate, basis, y, z, n = 0) {
  return v.add(plate.center, v.add(v.mul(basis.localAxisY, y), v.add(v.mul(basis.localAxisZ, z), v.mul(basis.normal, n))));
}

function plateOutlineLocalPoints(plate) {
  const bounds = plateBounds(plate);
  return Array.isArray(plate.outline) && plate.outline.length >= 3
    ? plate.outline
    : [
      [bounds.minY, bounds.minZ],
      [bounds.maxY, bounds.minZ],
      [bounds.maxY, bounds.maxZ],
      [bounds.minY, bounds.maxZ]
    ];
}

function longestPlateEdge(plate, axis) {
  const points = plateOutlineLocalPoints(plate);
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const along = Math.abs(b[axisIndex] - a[axisIndex]);
    const across = Math.abs(b[otherIndex] - a[otherIndex]);
    if (along <= EPSILON || along + EPSILON < across) continue;
    if (!best || along > best.length) best = { a, b, length: along };
  }
  return best;
}

function pickedEdgeOffset(axis, edge, basis, rawOffset, settings) {
  const offset = { ...(rawOffset || {}) };
  const otherKey = axis === "localAxisY" ? "localAxisZ" : "localAxisY";
  const edgeMid = (edge.a[axis === "localAxisY" ? 1 : 0] + edge.b[axis === "localAxisY" ? 1 : 0]) / 2;
  if (finite(offset[otherKey])) offset[otherKey] = Math.abs(offset[otherKey]) * (edgeMid >= 0 ? 1 : -1);
  return offsetVector(basis, offset, settings);
}

function makeDimension({ spec, definition, connection, a, b, extensionA = null, extensionB = null, offset = [0, 0, 0], measured = null, editKind = null, editPath = null, editIndex = null, editValues = null, editValueOffset = null, editValueScale = null, modeSeed = null, modeSeeds = null, active = false, activeDimensionId = null, activeMode = null, activeEditing = false }) {
  const length = distance(a, b);
  const value = finite(measured) ? measured : length;
  if (value <= EPSILON) return null;
  const start = v.add(a, offset);
  const end = v.add(b, offset);
  const offsetLength = v.len(offset);
  const lines = [];
  const id = `${connection.id}:${spec.id}`;
  const isActive = active && (!activeDimensionId || activeDimensionId === id);
  const issue = issueForDimension(connection, spec);
  const color = issueColor(issue, isActive);
  const base = {
    dimensionId: id,
    connectionId: connection.id,
    parameter: spec.parameter,
    color,
    issueSeverity: issue?.severity || null,
    issueMessage: issue?.message || null,
    issueResolvable: Array.isArray(issue?.resolve) && issue.resolve.length > 0,
    active: isActive,
    activeMode: isActive ? activeMode : null,
    editing: isActive && activeEditing,
    editKind,
    editPath,
    editIndex,
    editValues,
    editValueOffset,
    editValueScale,
    editOnCommit: spec.reference?.editOnCommit || null,
    dimensionValue: value,
    modeSeed,
    modeSeeds,
    modeControl: dimensionModeControl(definition, connection, spec),
    dimensionStart: start,
    dimensionEnd: end
  };
  const dimensionAxis = v.norm(v.sub(end, start));
  const markerAxis = offsetLength > EPSILON ? v.norm(offset) : perpendicularAxis(dimensionAxis);
  const outsideArrows = distance(start, end) <= (spec.outsideArrowMaxLength || OUTSIDE_ARROW_MAX_LENGTH);
  pushLine(lines, base, start, end);
  pushArrow(lines, base, start, outsideArrows ? v.mul(dimensionAxis, -1) : dimensionAxis, markerAxis);
  pushArrow(lines, base, end, outsideArrows ? dimensionAxis : v.mul(dimensionAxis, -1), markerAxis);
  if (offsetLength > EPSILON) {
    const extensionAxis = v.norm(offset);
    const gap = Math.min(EXTENSION_GAP, offsetLength * 0.3);
    const firstAnchor = extensionA || a;
    const secondAnchor = extensionB || b;
    pushLine(lines, base, v.add(firstAnchor, v.mul(extensionAxis, gap)), v.add(start, v.mul(extensionAxis, EXTENSION_OVERRUN)));
    pushLine(lines, base, v.add(secondAnchor, v.mul(extensionAxis, gap)), v.add(end, v.mul(extensionAxis, EXTENSION_OVERRUN)));
  }
  return {
    lines,
    labels: [{
      ...base,
      point: midpoint(start, end),
      labelLine: [start, end],
      labelAxis: dimensionAxis,
      labelUpAxis: markerAxis,
      textHeight: spec.textHeight,
      text: dimensionText(definition, spec, value, connection),
      displayText: draftingText(spec, value),
      title: dimensionTitle(definition, spec, value, connection, issue)
    }]
  };
}

function makeNote({ spec, definition, connection, point, anchor = null, textValue, displayTextValue = null, titleValue = null, labelAxis = undefined, editKind = null, editValue = null, editTitle = null, editPath = null, editIndex = null, editValues = null, editValueOffset = null, editValueScale = null, editPaths = null, editLabels = null, dimensionValue = null, modeSeed = null, modeSeeds = null, active = false, activeDimensionId = null, activeMode = null, activeEditing = false }) {
  const id = `${connection.id}:${spec.id}`;
  const isActive = active && (!activeDimensionId || activeDimensionId === id);
  const issue = issueForDimension(connection, spec);
  const base = {
    dimensionId: id,
    connectionId: connection.id,
    parameter: spec.parameter,
    color: issueColor(issue, isActive),
    issueSeverity: issue?.severity || null,
    issueMessage: issue?.message || null,
    issueResolvable: Array.isArray(issue?.resolve) && issue.resolve.length > 0,
    active: isActive,
    activeMode: isActive ? activeMode : null,
    editing: isActive && activeEditing,
    editOnCommit: spec.reference?.editOnCommit || null,
    modeControl: dimensionModeControl(definition, connection, spec)
  };
  const lines = [];
  const leaderAxis = anchor && distance(anchor, point) > EPSILON ? v.norm(v.sub(point, anchor)) : [1, 0, 0];
  if (anchor && distance(anchor, point) > EPSILON) {
    const tickAxis = perpendicularAxis(leaderAxis);
    const tick = spec.tickLength || 7;
    pushLine(lines, base, anchor, point);
    pushLine(lines, base, v.add(point, v.mul(tickAxis, -tick / 2)), v.add(point, v.mul(tickAxis, tick / 2)));
  }
  const resolvedLabelAxis = labelAxis === undefined ? leaderAxis : labelAxis;
  return {
    lines,
    labels: [{
      ...base,
      point,
      labelAxis: resolvedLabelAxis,
      labelUpAxis: perpendicularAxis(leaderAxis),
      textHeight: spec.textHeight,
      text: textValue,
      displayText: displayTextValue || textValue,
      title: issue?.message ? `${titleValue || fullDimensionText(definition, spec, 0, connection)}\n${issue.message}` : titleValue || fullDimensionText(definition, spec, 0, connection),
      editKind,
      editValue,
      editTitle,
      editPath,
      editIndex,
      editValues,
      editValueOffset,
      editValueScale,
      editPaths,
      editLabels,
      dimensionValue,
      modeSeed,
      modeSeeds
    }]
  };
}

function combine(parts) {
  return {
    lines: parts.flatMap((part) => part?.lines || []),
    labels: parts.flatMap((part) => part?.labels || [])
  };
}

function plateAxisDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  if (!plate) return null;
  const basis = plateBasis(plate);
  const bounds = plateBounds(plate);
  const at = spec.reference.at || {};
  const axis = spec.reference.axis;
  const y = atValue(at.localAxisY, bounds.minY, bounds.maxY);
  const z = atValue(at.localAxisZ, bounds.minZ, bounds.maxZ);
  const n = atValue(at.normal, bounds.minN, bounds.maxN);

  if (axis === "normal") {
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, y, z, bounds.minN),
      b: platePoint(plate, basis, y, z, bounds.maxN),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: plate.thickness
    });
  }
  if (axis === "localAxisY") {
    const edge = spec.reference.edgePick === "longest" ? longestPlateEdge(plate, axis) : null;
    if (edge) {
      return makeDimension({
        ...ctx,
        spec,
        a: platePoint(plate, basis, edge.a[0], edge.a[1], n),
        b: platePoint(plate, basis, edge.b[0], edge.b[1], n),
        offset: pickedEdgeOffset(axis, edge, basis, spec.reference.offset, ctx.dimensionSettings || {}),
        measured: edge.length
      });
    }
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, bounds.minY, z, n),
      b: platePoint(plate, basis, bounds.maxY, z, n),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: bounds.maxY - bounds.minY
    });
  }
  if (axis === "localAxisZ") {
    const edge = spec.reference.edgePick === "longest" ? longestPlateEdge(plate, axis) : null;
    if (edge) {
      return makeDimension({
        ...ctx,
        spec,
        a: platePoint(plate, basis, edge.a[0], edge.a[1], n),
        b: platePoint(plate, basis, edge.b[0], edge.b[1], n),
        offset: pickedEdgeOffset(axis, edge, basis, spec.reference.offset, ctx.dimensionSettings || {}),
        measured: edge.length
      });
    }
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, y, bounds.minZ, n),
      b: platePoint(plate, basis, y, bounds.maxZ, n),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: bounds.maxZ - bounds.minZ
    });
  }
  return null;
}

function featureBasis(project, feature) {
  const ref = feature?.reference;
  if (!ref) return null;
  if (ref.kind === "plate-face") {
    const plate = project.objectIndex?.[feature.ownerId] ? objectById(project, feature.ownerId) : null;
    if (!plate) return null;
    const basis = plateBasis(plate);
    const faceOffset = ref.face === "front" ? -plate.thickness / 2 : plate.thickness / 2;
    const origin = Array.isArray(ref.origin) ? ref.origin : plate.center;
    return {
      origin: v.add(origin, v.mul(basis.normal, faceOffset)),
      normal: basis.normal,
      localAxisY: v.norm(ref.localAxisY),
      localAxisZ: v.norm(ref.localAxisZ)
    };
  }
  return {
    origin: ref.origin,
    normal: v.norm(ref.normal),
    localAxisY: v.norm(ref.localAxisY),
    localAxisZ: v.norm(ref.localAxisZ)
  };
}

function positionPoint(basis, position) {
  return v.add(basis.origin, v.add(v.mul(basis.localAxisY, position[0]), v.mul(basis.localAxisZ, position[1])));
}

function positionInBasis(point, origin, basis) {
  const offset = v.sub(point, origin);
  const yy = v.dot(basis.localAxisY, basis.localAxisY);
  const yz = v.dot(basis.localAxisY, basis.localAxisZ);
  const zz = v.dot(basis.localAxisZ, basis.localAxisZ);
  const py = v.dot(offset, basis.localAxisY);
  const pz = v.dot(offset, basis.localAxisZ);
  const determinant = yy * zz - yz * yz;
  if (Math.abs(determinant) <= EPSILON) return [py, pz];
  return [
    (py * zz - pz * yz) / determinant,
    (pz * yy - py * yz) / determinant
  ];
}

function patternLayoutBasis(pattern, fallbackBasis) {
  if (!fallbackBasis) return null;
  const ref = pattern?.layoutReference;
  if (!ref || !Array.isArray(ref.origin) || !Array.isArray(ref.localAxisY) || !Array.isArray(ref.localAxisZ)) return fallbackBasis;
  return {
    origin: ref.origin,
    normal: fallbackBasis.normal,
    localAxisY: v.norm(ref.localAxisY),
    localAxisZ: v.norm(ref.localAxisZ)
  };
}

function patternPositionsInBasis(pattern, sourceBasis, targetBasis) {
  return (pattern.positions || []).map((position) => (
    positionInBasis(positionPoint(sourceBasis, position), targetBasis.origin, targetBasis)
  ));
}

function plateBoundsInBasis(plate, basis) {
  const outline = Array.isArray(plate.outline) && plate.outline.length
    ? plate.outline
    : [
      [-plate.width / 2, -plate.height / 2],
      [plate.width / 2, -plate.height / 2],
      [plate.width / 2, plate.height / 2],
      [-plate.width / 2, plate.height / 2]
    ];
  const coordinates = outline.map(([y, z]) => positionInBasis(platePoint(plate, plateBasis(plate), y, z), basis.origin, basis));
  return {
    minY: Math.min(...coordinates.map(([y]) => y)),
    maxY: Math.max(...coordinates.map(([y]) => y)),
    minZ: Math.min(...coordinates.map(([, z]) => z)),
    maxZ: Math.max(...coordinates.map(([, z]) => z))
  };
}

function holePair(pattern, axis) {
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const groups = new Map();
  for (const position of pattern.positions || []) {
    const key = Math.round(position[otherIndex] / 0.001);
    const group = groups.get(key) || [];
    group.push(position);
    groups.set(key, group);
  }
  const candidates = [...groups.values()].filter((group) => group.length > 1)
    .sort((a, b) => Math.abs(a[0][otherIndex]) - Math.abs(b[0][otherIndex]));
  const group = candidates[0];
  if (!group) return null;
  const sorted = [...group].sort((a, b) => a[axisIndex] - b[axisIndex]);
  return [sorted[0], sorted[1]];
}

function sortedCoordinateValues(positions, axis) {
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  return [...new Set((positions || []).map((position) => Math.round(position[axisIndex] / 0.001) * 0.001))]
    .sort((a, b) => a - b);
}

function edgeDistanceSign(edge) {
  return edge === "max" ? 1 : -1;
}

function basisBoundsCoordinate(bounds, axis, edge) {
  if (axis === "localAxisY") return edge === "max" ? bounds.maxY : bounds.minY;
  return edge === "max" ? bounds.maxZ : bounds.minZ;
}

function signedEdgeDistance(edgeCoordinate, pointCoordinate, edge) {
  return edgeDistanceSign(edge) * (edgeCoordinate - pointCoordinate);
}

function edgeDistanceEditTransform({ basis, measureBasis, axis, edge, edgeCoordinate, parameterEdge, parameterCoordinate, values, holePoint, signedMeasured }) {
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const parameterHoleCoordinate = parameterEdge === "max" ? values[values.length - 1] : values[0];
  const currentStored = parameterEdge === "max"
    ? parameterCoordinate - parameterHoleCoordinate
    : parameterHoleCoordinate - parameterCoordinate;
  const layoutStep = parameterEdge === "max" ? -1 : 1;
  const steppedPoint = v.add(holePoint, v.mul(basisAxis(basis, axis), layoutStep));
  const steppedPosition = positionInBasis(steppedPoint, measureBasis.origin, measureBasis);
  const steppedMeasured = signedEdgeDistance(edgeCoordinate, steppedPosition[axisIndex], edge);
  const measuredPerStored = steppedMeasured - signedMeasured;
  if (Math.abs(measuredPerStored) <= EPSILON) return null;
  return {
    editKind: "offsetNumber",
    editValueScale: 1 / measuredPerStored,
    editValueOffset: currentStored - signedMeasured / measuredPerStored
  };
}

function spacingPairs(pattern, axis) {
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const groups = new Map();
  for (const position of pattern.positions || []) {
    const key = Math.round(position[otherIndex] / 0.001);
    const group = groups.get(key) || [];
    group.push(position);
    groups.set(key, group);
  }
  const group = [...groups.values()].filter((items) => items.length > 1)
    .sort((a, b) => Math.abs(a[0][otherIndex]) - Math.abs(b[0][otherIndex]))[0];
  if (!group) return [];
  const sorted = [...group].sort((a, b) => a[axisIndex] - b[axisIndex]);
  return sorted.slice(1).map((position, index) => [sorted[index], position]);
}

function spacingDimension(ctx, options) {
  const { spec, a, b, offset, measured, editKind = null, editPath = null, editIndex = null, editValues = null, modeSeed = null, modeSeeds = null } = options;
  if (measured > EPSILON) {
    return makeDimension({
      ...ctx,
      spec,
      a,
      b,
      offset,
      measured,
      editKind,
      editPath,
      editIndex,
      editValues,
      modeSeed,
      modeSeeds
    });
  }
  const anchor = midpoint(a, b);
  return makeNote({
    ...ctx,
    spec,
    anchor,
    point: v.add(anchor, offset),
    textValue: dimensionText(ctx.definition, spec, 0, ctx.connection),
    displayTextValue: draftingText(spec, 0),
    titleValue: fullDimensionText(ctx.definition, spec, 0, ctx.connection),
    editKind,
    editPath,
    editIndex,
    editValues,
    dimensionValue: 0,
    modeSeed,
    modeSeeds
  });
}

function holeSpacingDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const layoutPattern = pattern && sourceBasis && basis ? { ...pattern, positions: patternPositionsInBasis(pattern, sourceBasis, basis) } : null;
  const pairs = layoutPattern && basis ? spacingPairs(layoutPattern, spec.reference.axis) : [];
  const useCustomGaps = optionalPath(ctx.connection.referenceParameters, spec.reference.spacingModePath || "", "equal") === "custom";
  const existingValues = optionalPath(ctx.connection.referenceParameters, spec.reference.customParameter, []);
  const pairValues = pairs.map((pair) => distance(positionPoint(basis, pair[0]), positionPoint(basis, pair[1])));
  const editValues = pairValues.map((fallback, index) => {
    const value = Array.isArray(existingValues) ? existingValues[index] : null;
    return useCustomGaps && finite(value) ? value : fallback;
  });
  const modeSeed = spec.reference.customParameter && pairValues.length
    ? { when: "custom", path: spec.reference.customParameter, value: pairValues }
    : null;
  const modeSeedsForPair = (index) => {
    const seeds = [];
    if (modeSeed) seeds.push(modeSeed);
    if (spec.parameter && finite(pairValues[index])) {
      seeds.push({ when: "equal", path: spec.parameter, value: pairValues[index] });
    }
    return seeds.length ? seeds : null;
  };
  const pairDimensions = () => {
    return pairs.map((pair, index) => spacingDimension(ctx, {
      spec: {
        ...spec,
        id: `${spec.id}-${index + 1}`,
        parameter: useCustomGaps ? spec.reference.customParameter : spec.parameter,
        label: spec.reference.pairLabel || spec.label,
        reference: {
          ...spec.reference
        }
      },
      a: positionPoint(basis, pair[0]),
      b: positionPoint(basis, pair[1]),
      offset: dimensionOffset(ctx, basis, spec.reference.pairOffset || spec.reference.offset),
      measured: pairValues[index],
      editKind: useCustomGaps ? "numberListItem" : null,
      editPath: useCustomGaps ? spec.reference.customParameter : null,
      editIndex: useCustomGaps ? index : null,
      editValues: useCustomGaps ? editValues : null,
      modeSeed,
      modeSeeds: modeSeedsForPair(index)
    }));
  };
  const pair = layoutPattern && basis ? holePair(layoutPattern, spec.reference.axis) : null;
  if (!pair) return null;
  if (spec.reference.showPairSwitchers === true && spec.reference.customParameter && pairs.length) return combine(pairDimensions());
  const equalDimension = spacingDimension(ctx, {
    spec,
    a: positionPoint(basis, pair[0]),
    b: positionPoint(basis, pair[1]),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: distance(positionPoint(basis, pair[0]), positionPoint(basis, pair[1])),
    modeSeed
  });
  if (!pattern || !basis || !spec.reference.customParameter || !pairs.length) return equalDimension;
  if (useCustomGaps) return combine(pairDimensions());
  return equalDimension;
}

function holeEdgeDistanceDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const measureBasis = spec.reference.measureBasis === "feature" ? sourceBasis : basis;
  if (!plate || !pattern?.positions?.length || !sourceBasis || !basis || !measureBasis) return null;
  const positions = patternPositionsInBasis(pattern, sourceBasis, basis);
  const bounds = plateBoundsInBasis(plate, basis);
  const axis = spec.reference.axis;
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const values = sortedCoordinateValues(positions, axis);
  if (!values.length) return null;
  const iface = spec.reference.interfaceRole
    ? interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole)
    : null;
  if (iface && axis === "localAxisY") {
    const planeNormal = interfaceAxis(iface, plate);
    const axisVector = basisAxis(basis, axis);
    const supportEdge = spec.reference.edgePick === "far" ? plateSupportEdge(plate, iface, plateBasis(plate)) : null;
    const planePoint = linePlane(basis.origin, axisVector, iface.origin, planeNormal);
    if (supportEdge && planePoint) {
      const planePosition = positionInBasis(planePoint, basis.origin, basis);
      const planeCoord = planePosition[axisIndex];
      const holeValue = values.reduce((best, value) => (
        Math.abs(value - planeCoord) < Math.abs(best - planeCoord) ? value : best
      ), values[0]);
      const edgeEnds = [supportEdge.a, supportEdge.b].map((point) => ({
        point,
        position: positionInBasis(point, basis.origin, basis)
      }));
      const farEnd = edgeEnds.reduce((best, item) => (
        Math.abs(item.position[axisIndex] - holeValue) > Math.abs(best.position[axisIndex] - holeValue) ? item : best
      ), edgeEnds[0]);
      const supportCandidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
      const hole = supportCandidates.length
        ? supportCandidates.reduce((best, item) => Math.abs(item[otherIndex] - farEnd.position[otherIndex]) < Math.abs(best[otherIndex] - farEnd.position[otherIndex]) ? item : best, supportCandidates[0])
        : null;
      if (hole) {
        const farCoord = farEnd.position[axisIndex];
        const holeCoord = hole[axisIndex];
        const supportDirection = Math.sign(holeCoord - planeCoord) || Math.sign(farCoord - planeCoord) || 1;
        const dimensionDirection = Math.sign(holeCoord - farCoord) || supportDirection;
        const a = positionPoint(basis, axis === "localAxisY" ? [farCoord, hole[otherIndex]] : [hole[otherIndex], farCoord]);
        const b = positionPoint(basis, hole);
        return makeDimension({
          ...ctx,
          spec,
          a,
          b,
          extensionA: farEnd.point,
          offset: dimensionOffset(ctx, basis, spec.reference.offset),
          measured: Math.abs(holeCoord - farCoord),
          editKind: "offsetNumber",
          editValueScale: dimensionDirection / supportDirection,
          editValueOffset: (farCoord - planeCoord) / supportDirection
        });
      }
    }
    const candidates = positions
      .map((position) => {
        const holePoint = positionPoint(basis, position);
        const edgePoint = linePlane(holePoint, axisVector, iface.origin, planeNormal);
        return edgePoint ? {
          position,
          holePoint,
          edgePoint,
          measured: distance(holePoint, edgePoint)
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.measured - b.measured || Math.abs(a.position[otherIndex]) - Math.abs(b.position[otherIndex]));
    const best = candidates[0];
    if (best) {
      return makeDimension({
        ...ctx,
        spec,
        a: best.edgePoint,
        b: best.holePoint,
        offset: dimensionOffset(ctx, basis, spec.reference.offset),
        measured: best.measured
      });
    }
  }
  const measureBounds = measureBasis === basis ? bounds : plateBoundsInBasis(plate, measureBasis);
  const edgeValue = basisBoundsCoordinate(measureBounds, axis, spec.reference.edge);
  const holeValue = spec.reference.edge === "max" ? values[values.length - 1] : values[0];
  const candidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
  const hole = candidates.length
    ? candidates.reduce((best, item) => Math.abs(item[otherIndex]) < Math.abs(best[otherIndex]) ? item : best, candidates[0])
    : null;
  if (!hole) return null;
  const holePoint = positionPoint(basis, hole);
  const holeInMeasureBasis = positionInBasis(holePoint, measureBasis.origin, measureBasis);
  const other = holeInMeasureBasis[otherIndex];
  const a = axis === "localAxisY"
    ? positionPoint(measureBasis, [edgeValue, other])
    : positionPoint(measureBasis, [other, edgeValue]);
  const signedMeasured = signedEdgeDistance(edgeValue, holeInMeasureBasis[axisIndex], spec.reference.edge);
  let editKind = null;
  let editValueOffset = null;
  let editValueScale = null;
  const parameterEdge = spec.reference.parameterEdge || spec.reference.edge;
  const parameterCoordinate = basisBoundsCoordinate(bounds, axis, parameterEdge);
  if (finite(parameterCoordinate)) {
    const edit = edgeDistanceEditTransform({
      basis,
      measureBasis,
      axis,
      edge: spec.reference.edge,
      edgeCoordinate: edgeValue,
      parameterEdge,
      parameterCoordinate,
      values,
      holePoint,
      signedMeasured
    });
    if (edit) ({ editKind, editValueOffset, editValueScale } = edit);
  }
  return makeDimension({
    ...ctx,
    spec,
    a,
    b: holePoint,
    offset: dimensionOffset(ctx, measureBasis, spec.reference.offset),
    measured: Math.abs(signedMeasured),
    editKind,
    editValueOffset,
    editValueScale
  });
}

function holeInterfaceEdgeDistanceDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const measureBasis = spec.reference.measureBasis === "feature" ? sourceBasis : basis;
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const rawInterface = rawInterfaceByRole(ctx.project, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  if (!pattern?.positions?.length || !sourceBasis || !basis || !measureBasis || !iface) return null;

  const axis = spec.reference.axis;
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const positions = patternPositionsInBasis(pattern, sourceBasis, basis);
  const values = sortedCoordinateValues(positions, axis);
  if (!values.length) return null;
  const holeValue = spec.reference.edge === "max" ? values[values.length - 1] : values[0];
  const candidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
  const hole = candidates.length
    ? candidates.reduce((best, item) => Math.abs(item[otherIndex]) < Math.abs(best[otherIndex]) ? item : best, candidates[0])
    : null;
  if (!hole) return null;

  const edge = interfaceEdgeOnBasis(ctx.project, ctx.profiles, rawInterface, iface, measureBasis, axis, spec.reference.edge);
  if (!edge) return null;
  const axisVector = basisAxis(measureBasis, axis);
  const holePoint = positionPoint(basis, hole);
  const edgePoint = linePlane(holePoint, axisVector, edge.planePoint, edge.normal);
  if (!edgePoint) return null;
  const holeInMeasureBasis = positionInBasis(holePoint, measureBasis.origin, measureBasis);
  const signedMeasured = spec.reference.edge === "max"
    ? edge.coordinate - holeInMeasureBasis[axisIndex]
    : holeInMeasureBasis[axisIndex] - edge.coordinate;

  let editKind = null;
  let editValueOffset = null;
  let editValueScale = null;
  const parameterEdge = spec.reference.parameterEdge || spec.reference.edge;
  const parameterCoordinate = (() => {
    if (plate) {
      const bounds = plateBoundsInBasis(plate, basis);
      if (axis === "localAxisY") return parameterEdge === "max" ? bounds.maxY : bounds.minY;
      return parameterEdge === "max" ? bounds.maxZ : bounds.minZ;
    }
    const parameter = interfaceEdgeOnBasis(ctx.project, ctx.profiles, rawInterface, iface, basis, axis, parameterEdge);
    return parameter?.coordinate;
  })();
  if (finite(parameterCoordinate)) {
    const edit = edgeDistanceEditTransform({
      basis,
      measureBasis,
      axis,
      edge: spec.reference.edge,
      edgeCoordinate: edge.coordinate,
      parameterEdge,
      parameterCoordinate,
      values,
      holePoint,
      signedMeasured
    });
    if (edit) ({ editKind, editValueOffset, editValueScale } = edit);
  }

  return makeDimension({
    ...ctx,
    spec,
    a: edgePoint,
    b: holePoint,
    offset: dimensionOffset(ctx, measureBasis, spec.reference.offset),
    measured: Math.abs(signedMeasured),
    editKind,
    editValueOffset,
    editValueScale
  });
}

function closestHole(pattern) {
  return [...(pattern.positions || [])].sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))[0] || null;
}

function uniqueCount(values) {
  return new Set(values.map((value) => Math.round(value / 0.001))).size;
}

function holePatternDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  if (!pattern?.positions?.length || !basis) return null;
  const rowPath = spec.reference.rowsParameter || "bolts.rows";
  const columnPath = spec.reference.columnsParameter || "bolts.columns";
  const generatedRows = uniqueCount(pattern.positions.map((position) => position[1]));
  const generatedColumns = uniqueCount(pattern.positions.map((position) => position[0]));
  const rows = paramValue(ctx.definition, ctx.connection, rowPath) || generatedRows;
  const columns = paramValue(ctx.definition, ctx.connection, columnPath) || generatedColumns;
  const center = pattern.positions.reduce((sum, position) => v.add(sum, positionPoint(basis, position)), [0, 0, 0]);
  const anchor = v.mul(center, 1 / pattern.positions.length);
  const point = v.add(anchor, dimensionOffset(ctx, basis, spec.reference.offset, { clampNormal: false }));
  return makeNote({
    ...ctx,
    spec,
    point,
    anchor,
    textValue: `${spec.label || "bolts"} ${rows}x${columns}`,
    displayTextValue: `${rows}x${columns}`,
    titleValue: `${parameterLabel(ctx.definition, spec.parameter)} pattern ${rows} rows x ${columns} columns`,
    editKind: "positiveIntegerPair",
    editValue: `${rows}x${columns}`,
    editTitle: "Bolt pattern",
    editPaths: {
      first: rowPath,
      second: columnPath
    },
    editLabels: {
      first: parameterLabel(ctx.definition, rowPath),
      second: parameterLabel(ctx.definition, columnPath)
    }
  });
}

function holeDiameterDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const position = pattern && basis ? closestHole(pattern) : null;
  const diameter = pattern?.holeDiameter;
  if (!position || !finite(diameter) || diameter <= 0) return null;
  const center = positionPoint(basis, position);
  const axis = basisAxis(basis, spec.reference.axis || "localAxisY");
  return makeDimension({
    ...ctx,
    spec,
    a: v.add(center, v.mul(axis, -diameter / 2)),
    b: v.add(center, v.mul(axis, diameter / 2)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: diameter
  });
}

function featureDepthDimension(ctx, spec) {
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const depth = feature?.depth;
  if (!basis || !finite(depth) || depth <= 0) return null;
  return makeDimension({
    ...ctx,
    spec,
    a: basis.origin,
    b: v.add(basis.origin, v.mul(basis.normal, depth)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: depth
  });
}

function fastenerLengthDimension(ctx, spec) {
  const group = roleObject(ctx.project, ctx.connection, spec.reference.fastenerRole);
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const position = pattern && basis ? closestHole(pattern) : null;
  const length = group?.assembly?.length;
  if (!group || !position || !finite(length) || length <= 0) return null;
  const axis = Array.isArray(group.orientation?.axis) ? v.norm(group.orientation.axis) : basis.normal;
  const start = positionPoint(basis, position);
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: v.add(start, v.mul(axis, length)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: length
  });
}

function interfaceByRole(project, profiles, definition, connection, role) {
  const interfaceId = interfaceIdByRole(project, definition, connection, role);
  return interfaceId ? resolveInterface(project, profiles, interfaceId) : null;
}

function rawInterfaceByRole(project, definition, connection, role) {
  const interfaceId = interfaceIdByRole(project, definition, connection, role);
  return interfaceId && project.objectIndex?.[interfaceId] ? objectById(project, interfaceId) : null;
}

function profileById(profiles, profileId) {
  return profiles?.[profileId] || profiles?.profiles?.[profileId] || null;
}

function interfaceSectionEdgeValue(project, profiles, rawInterface, resolvedInterface, axis, edge) {
  const ownerId = rawInterface?.ownerId || resolvedInterface?.ownerId;
  const ownerEntry = ownerId ? project.objectIndex?.[ownerId] : null;
  if (ownerEntry?.collection === "members") {
    const member = objectById(project, ownerId);
    const profile = profileById(profiles, member.profile);
    if (profile) {
      const bounds = sectionBounds(profile);
      if (axis === "localAxisZ") return edge === "max" ? bounds.maxZ : bounds.minZ;
      if (axis === "localAxisY") return edge === "max" ? bounds.maxY : bounds.minY;
    }
  }
  const extents = rawInterface?.extents || resolvedInterface?.extents || {};
  const size = axis === "localAxisY" ? (extents.width || extents.length) : extents.height;
  return finite(size) ? (edge === "max" ? size / 2 : -size / 2) : null;
}

function interfaceEdgeOnBasis(project, profiles, rawInterface, resolvedInterface, basis, axis, edge) {
  const normal = basisAxis(resolvedInterface, axis);
  const edgeValue = interfaceSectionEdgeValue(project, profiles, rawInterface, resolvedInterface, axis, edge);
  if (!finite(edgeValue) || v.len(normal) <= EPSILON) return null;
  const planePoint = v.add(resolvedInterface.origin, v.mul(normal, edgeValue));
  const axisVector = basisAxis(basis, axis);
  const point = linePlane(basis.origin, axisVector, planePoint, normal);
  if (!point) return null;
  const position = positionInBasis(point, basis.origin, basis);
  return {
    coordinate: position[axis === "localAxisY" ? 0 : 1],
    planePoint,
    normal
  };
}

function pointToPlane(point, origin, normal) {
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, origin), normal)));
}

function linePlane(point, direction, origin, normal) {
  const denominator = v.dot(direction, normal);
  if (Math.abs(denominator) <= EPSILON) return null;
  return v.add(point, v.mul(direction, v.dot(v.sub(origin, point), normal) / denominator));
}

function interfaceAxis(iface, plate) {
  const normal = v.norm(iface.normal);
  return plate && v.dot(v.sub(plate.center, iface.origin), normal) < 0 ? v.mul(normal, -1) : normal;
}

function interfaceAnnotationBasis(plate, iface) {
  const plateAxes = plateBasis(plate);
  return {
    origin: plate.center,
    normal: plateAxes.normal,
    localAxisY: interfaceAxis(iface, plate),
    localAxisZ: Array.isArray(iface.localAxisZ) ? v.norm(iface.localAxisZ) : plateAxes.localAxisZ
  };
}

function plateOutlineWorldPoints(plate, basis) {
  const bounds = plateBounds(plate);
  const outline = Array.isArray(plate.outline) && plate.outline.length >= 3
    ? plate.outline
    : [
      [bounds.minY, bounds.minZ],
      [bounds.maxY, bounds.minZ],
      [bounds.maxY, bounds.maxZ],
      [bounds.minY, bounds.maxZ]
    ];
  return outline.map((point) => platePoint(plate, basis, point[0], point[1], 0));
}

function plateSupportEdge(plate, iface, basis) {
  const supportNormal = v.norm(iface.normal);
  const points = plateOutlineWorldPoints(plate, basis);
  const centroid = v.mul(points.reduce((sum, point) => v.add(sum, point), [0, 0, 0]), 1 / points.length);
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const score = Math.abs(v.dot(v.sub(a, iface.origin), supportNormal))
      + Math.abs(v.dot(v.sub(b, iface.origin), supportNormal));
    if (!best || score < best.score) best = { a, b, score };
  }
  if (!best) return null;
  const center = midpoint(best.a, best.b);
  const inwardRaw = v.sub(centroid, center);
  return {
    a: best.a,
    b: best.b,
    center,
    inward: v.len(inwardRaw) > EPSILON ? v.norm(inwardRaw) : v.mul(basis.localAxisY, -1)
  };
}

function interfaceOffsetDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const value = paramValue(ctx.definition, ctx.connection, spec.parameter);
  if (!plate || !iface || !finite(value) || value <= 0) return null;
  const basis = plateBasis(plate);
  const axis = interfaceAxis(iface, plate);
  const start = pointToPlane(plate.center, iface.origin, axis);
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: v.add(start, v.mul(axis, value)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: value
  });
}

function featurePlaneOffsetDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  if (!plate || !feature?.plane || !iface) return null;
  const offsetBasis = interfaceAnnotationBasis(plate, iface);
  const axis = interfaceAxis(iface, plate);
  const start = pointToPlane(plate.center, iface.origin, axis);
  const end = linePlane(start, axis, feature.plane.origin, feature.plane.normal);
  if (!end) return null;
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: end,
    offset: dimensionOffset(ctx, offsetBasis, spec.reference.offset),
    measured: distance(start, end)
  });
}

function weldSizeDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const value = paramValue(ctx.definition, ctx.connection, spec.parameter);
  if (!plate || !iface || !finite(value)) return null;
  const basis = plateBasis(plate);
  const supportEdge = plateSupportEdge(plate, iface, basis);
  if (!supportEdge) return null;
  const side = spec.reference.side === "back" ? -1 : 1;
  const faceOffset = v.mul(basis.normal, side * (plate.thickness / 2));
  const supportNormal = interfaceAxis(iface, plate);
  const plateFaceInwardRaw = v.sub(supportNormal, v.mul(basis.normal, v.dot(supportNormal, basis.normal)));
  const plateFaceInward = v.len(plateFaceInwardRaw) > EPSILON ? v.norm(plateFaceInwardRaw) : supportEdge.inward;
  const inward = v.dot(plateFaceInward, supportEdge.inward) < 0 ? v.mul(plateFaceInward, -1) : plateFaceInward;
  const zSide = spec.reference.edge === "bottom" ? -1 : 1;
  const supportEdgeEnd = v.dot(v.sub(supportEdge.a, plate.center), basis.localAxisZ) * zSide
    > v.dot(v.sub(supportEdge.b, plate.center), basis.localAxisZ) * zSide
    ? supportEdge.a
    : supportEdge.b;
  const anchor = spec.reference.edge === "top" || spec.reference.edge === "bottom"
    ? supportEdgeEnd
    : v.add(supportEdge.center, faceOffset);
  const labelPocket = v.add(v.mul(supportNormal, 34), v.mul(basis.normal, side * 34));
  const sideOffset = spec.reference.edge === "top" || spec.reference.edge === "bottom"
    ? v.add(v.mul(inward, 18), v.mul(basis.localAxisZ, zSide * 18))
    : v.add(
      labelPocket,
      v.mul(basis.localAxisZ, spec.reference.side === "back" ? -10 : 10)
    );
  const point = v.add(anchor, sideOffset);
  if (value <= EPSILON) {
    return makeNote({
      ...ctx,
      spec,
      point,
      anchor,
      textValue: `${spec.label || "weld"} ${spec.zeroLabel || "no weld"}`,
      displayTextValue: spec.zeroLabel || "no weld",
      titleValue: `${parameterLabel(ctx.definition, spec.parameter)} no weld`,
      labelAxis: [0, 0, 0]
    });
  }
  return makeNote({
    ...ctx,
    spec,
    point,
    anchor,
    textValue: dimensionText(ctx.definition, spec, value, ctx.connection),
    displayTextValue: `${spec.label || "W"} ${fmt(value)}`,
    titleValue: fullDimensionText(ctx.definition, spec, value, ctx.connection),
    dimensionValue: value,
    labelAxis: [0, 0, 0]
  });
}

function buildOne(ctx, spec) {
  const activePaths = [spec.parameter, spec.reference?.customParameter].filter(Boolean);
  const active = activePaths.includes(ctx.activeParameterPath);
  const nextCtx = { ...ctx, active, activeMode: active ? ctx.activeParameterMode : null, activeEditing: active && ctx.activeParameterEditing };
  if (spec.reference.kind === "plate-axis") return plateAxisDimension(nextCtx, spec);
  if (spec.reference.kind === "bolt-pattern") return holePatternDimension(nextCtx, spec);
  if (spec.reference.kind === "hole-spacing") return holeSpacingDimension(nextCtx, spec);
  if (spec.reference.kind === "hole-edge-distance") return holeEdgeDistanceDimension(nextCtx, spec);
  if (spec.reference.kind === "hole-interface-edge-distance") return holeInterfaceEdgeDistanceDimension(nextCtx, spec);
  if (spec.reference.kind === "hole-diameter") return holeDiameterDimension(nextCtx, spec);
  if (spec.reference.kind === "feature-depth") return featureDepthDimension(nextCtx, spec);
  if (spec.reference.kind === "fastener-length") return fastenerLengthDimension(nextCtx, spec);
  if (spec.reference.kind === "interface-offset") return interfaceOffsetDimension(nextCtx, spec);
  if (spec.reference.kind === "feature-plane-offset") return featurePlaneOffsetDimension(nextCtx, spec);
  if (spec.reference.kind === "weld-size") return weldSizeDimension(nextCtx, spec);
  return null;
}

export function buildConnectionDimensions({ project, profiles, definition, connectionId, activeParameterPath = null, activeDimensionId = null, activeParameterMode = "select", activeParameterEditing = false, dimensionSettings = null }) {
  const connection = project.model.connections?.[connectionId];
  if (!connection || connection.generator?.status !== "generated") return { lines: [], labels: [] };
  const ctx = { project, profiles, definition, connection, activeParameterPath, activeDimensionId, activeParameterMode, activeParameterEditing, dimensionSettings: dimensionSettings || {} };
  return combine((definition.dimensions || []).map((spec) => buildOne(ctx, spec)));
}
