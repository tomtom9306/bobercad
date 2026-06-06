import { optionalPath } from "../../engine/modules/smart-components/parameters.mjs?v=stair-route-ui-fit-2";
import { v } from "../../engine/core/math.mjs";
import { objectById } from "../../engine/core/model.mjs";
import { resolveInterfaceWithConnectionReference, sectionBounds } from "../../engine/geometry/member-geometry.mjs";

export { optionalPath, v };

export const EPSILON = 1e-6;
export const COLOR = "#334155";
export const ACTIVE_COLOR = "#2563eb";
export const ERROR_COLOR = "#b91c1c";
export const WARNING_COLOR = "#b45309";
export const ARROW_LENGTH = 7;
export const ARROW_HALF_WIDTH = 2.6;
export const OUTSIDE_ARROW_MAX_LENGTH = 34;
export const EXTENSION_GAP = 2;
export const EXTENSION_OVERRUN = 6;
export const DEFAULT_SURFACE_LIFT = 4;

export function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function fmt(value) {
  if (!finite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
}

export function roleId(smartComponent, role) {
  return smartComponent.objectRoles?.[role] || null;
}

export function roleObject(project, smartComponent, role) {
  const id = roleId(smartComponent, role);
  return id && project.objectIndex?.[id] ? objectById(project, id) : null;
}

export function interfaceIdByRole(project, definition, smartComponent, role) {
  const zone = project.model.connectionZones?.[smartComponent.inputs?.connectionZoneId];
  const index = (definition.interfaces || []).findIndex((item) => item.role === role);
  return index >= 0 ? zone?.interfaceIds?.[index] : null;
}

export function paramValue(definition, smartComponent, path) {
  const spec = definition.parameters[path] || {};
  return optionalPath(smartComponent.referenceParameters, spec.writePath || path, spec.default);
}

export function parameterLabel(definition, path) {
  return definition.parameters[path]?.label || path;
}

export function parameterUnit(definition, path) {
  return definition.parameters[path]?.unit || "";
}

export function dimensionText(definition, spec, measured, smartComponent) {
  const value = finite(measured) ? measured : paramValue(definition, smartComponent, spec.parameter);
  const unit = parameterUnit(definition, spec.parameter);
  return `${spec.label || parameterLabel(definition, spec.parameter)} ${fmt(value)}${unit ? ` ${unit}` : ""}`;
}

export function draftingText(spec, value) {
  const text = fmt(value);
  if (spec.reference?.kind === "hole-diameter") return `Ø${text}`;
  return text;
}

export function fullDimensionText(definition, spec, measured, smartComponent) {
  const value = finite(measured) ? measured : paramValue(definition, smartComponent, spec.parameter);
  const unit = parameterUnit(definition, spec.parameter);
  return `${parameterLabel(definition, spec.parameter)} ${fmt(value)}${unit ? ` ${unit}` : ""}`;
}

export function referenceRoles(spec) {
  return Object.entries(spec.reference || {})
    .filter(([key, value]) => key.endsWith("Role") && typeof value === "string")
    .map(([, value]) => value);
}

export function diagnosticPaths(spec) {
  return [
    spec.parameter,
    spec.reference?.customParameter,
    spec.reference?.rowsParameter,
    spec.reference?.columnsParameter
  ].filter(Boolean);
}

export function issueForDimension(smartComponent, spec) {
  const diagnostics = (smartComponent.diagnostics || [])
    .filter((entry) => entry.severity === "error" || entry.severity === "warning");
  const paths = diagnosticPaths(spec);
  const roles = referenceRoles(spec);
  const matches = diagnostics.filter((entry) => (
    (entry.parameters || []).some((path) => paths.includes(path))
    || (!(entry.parameters || []).length && (entry.objectRoles || []).some((role) => roles.includes(role)))
  ));
  return matches.find((entry) => entry.severity === "error") || matches[0] || null;
}

export function issueColor(issue, active) {
  if (issue?.severity === "error") return ERROR_COLOR;
  if (issue?.severity === "warning") return WARNING_COLOR;
  return active ? ACTIVE_COLOR : COLOR;
}

export function dimensionTitle(definition, spec, measured, smartComponent, issue) {
  const title = fullDimensionText(definition, spec, measured, smartComponent);
  return issue?.message ? `${title}\n${issue.message}` : title;
}

export function dimensionModeControl(definition, smartComponent, spec) {
  const control = spec.reference?.modeControl;
  if (!control?.path || !definition.parameters[control.path]) return null;
  const parameter = definition.parameters[control.path];
  return {
    path: control.path,
    label: control.label || parameter.label || control.path,
    value: paramValue(definition, smartComponent, control.path),
    options: Array.isArray(control.options) ? control.options : (parameter.values || []).map((value) => ({
      value,
      label: String(value)
    }))
  };
}

export function basisAxis(basis, key) {
  if (key === "normal") return basis.normal;
  if (key === "localAxisY") return basis.localAxisY;
  if (key === "localAxisZ") return basis.localAxisZ;
  return [0, 0, 0];
}

export function surfaceLift(settings) {
  return finite(settings?.surfaceLift) ? Math.max(0, settings.surfaceLift) : DEFAULT_SURFACE_LIFT;
}

function hasInPlaneOffset(offset) {
  return ["localAxisY", "localAxisZ"].some((key) => finite(offset?.[key]) && Math.abs(offset[key]) > EPSILON);
}

export function offsetVector(basis, offset = {}, settings = {}) {
  const lift = surfaceLift(settings);
  const keepPlaneOffsetFlat = settings.clampNormal !== false && hasInPlaneOffset(offset);
  return Object.entries(offset).reduce((sum, [key, value]) => {
    if (!finite(value) || (keepPlaneOffsetFlat && key === "normal")) return sum;
    const resolved = settings.clampNormal !== false && key === "normal" && Math.abs(value) > lift
      ? Math.sign(value) * lift
      : value;
    return v.add(sum, v.mul(basisAxis(basis, key), resolved));
  }, [0, 0, 0]);
}

export function dimensionOffset(ctx, basis, offset = {}, options = {}) {
  return offsetVector(basis, offset, {
    ...(ctx.dimensionSettings || {}),
    ...options
  });
}

export function midpoint(a, b) {
  return v.mul(v.add(a, b), 0.5);
}

export function distance(a, b) {
  return v.len(v.sub(b, a));
}

export function perpendicularAxis(axis) {
  const fromZ = v.cross(axis, [0, 0, 1]);
  if (v.len(fromZ) > EPSILON) return v.norm(fromZ);
  return v.norm(v.cross(axis, [0, 1, 0]));
}

function perpendicularDimensionOffset(dimensionAxis, offset) {
  if (v.len(offset) <= EPSILON) return offset;
  const parallel = v.mul(dimensionAxis, v.dot(offset, dimensionAxis));
  const perpendicular = v.sub(offset, parallel);
  return v.len(perpendicular) > EPSILON ? perpendicular : [0, 0, 0];
}

export function pushLine(lines, base, a, b) {
  if (distance(a, b) <= EPSILON) return;
  lines.push({ ...base, points: [a, b] });
}

export function pushArrow(lines, base, point, inward, side) {
  const arrowLength = Math.min(ARROW_LENGTH, Math.max(4, distance(base.dimensionStart, base.dimensionEnd) * 0.28));
  const back = v.mul(v.norm(inward), arrowLength);
  const spread = v.mul(v.norm(side), ARROW_HALF_WIDTH);
  pushLine(lines, base, point, v.add(point, v.add(back, spread)));
  pushLine(lines, base, point, v.add(point, v.sub(back, spread)));
}

export function plateBasis(plate) {
  return {
    normal: v.norm(plate.normal),
    localAxisY: v.norm(plate.localAxisY),
    localAxisZ: v.norm(plate.localAxisZ)
  };
}

export function plateBounds(plate) {
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

export function atValue(value, min, max) {
  if (value === "min") return min;
  if (value === "max") return max;
  if (finite(value)) return value;
  return (min + max) / 2;
}

export function platePoint(plate, basis, y, z, n = 0) {
  return v.add(plate.center, v.add(v.mul(basis.localAxisY, y), v.add(v.mul(basis.localAxisZ, z), v.mul(basis.normal, n))));
}

export function plateOutlineLocalPoints(plate) {
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

export function longestPlateEdge(plate, axis) {
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

export function pickedEdgeOffset(axis, edge, basis, rawOffset, settings) {
  const offset = { ...(rawOffset || {}) };
  const otherKey = axis === "localAxisY" ? "localAxisZ" : "localAxisY";
  const edgeMid = (edge.a[axis === "localAxisY" ? 1 : 0] + edge.b[axis === "localAxisY" ? 1 : 0]) / 2;
  if (finite(offset[otherKey])) offset[otherKey] = Math.abs(offset[otherKey]) * (edgeMid >= 0 ? 1 : -1);
  return offsetVector(basis, offset, settings);
}

export function makeDimension({ spec, definition, smartComponent, a, b, extensionA = null, extensionB = null, offset = [0, 0, 0], measured = null, editKind = null, editPath = null, editIndex = null, editValues = null, editValueOffset = null, editValueScale = null, modeSeed = null, modeSeeds = null, active = false, activeDimensionId = null, activeMode = null, activeEditing = false }) {
  const length = distance(a, b);
  const value = finite(measured) ? measured : length;
  if (value <= EPSILON) return null;
  const dimensionAxis = v.norm(v.sub(b, a));
  const dimensionLineOffset = perpendicularDimensionOffset(dimensionAxis, offset);
  const start = v.add(a, dimensionLineOffset);
  const end = v.add(b, dimensionLineOffset);
  const offsetLength = v.len(dimensionLineOffset);
  const lines = [];
  const id = `${smartComponent.id}:${spec.id}`;
  const isActive = active && (!activeDimensionId || activeDimensionId === id);
  const issue = issueForDimension(smartComponent, spec);
  const color = issueColor(issue, isActive);
  const base = {
    dimensionId: id,
    smartComponentId: smartComponent.id,
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
    modeControl: dimensionModeControl(definition, smartComponent, spec),
    dimensionStart: start,
    dimensionEnd: end
  };
  const markerAxis = offsetLength > EPSILON ? v.norm(dimensionLineOffset) : perpendicularAxis(dimensionAxis);
  const outsideArrows = distance(start, end) <= (spec.outsideArrowMaxLength || OUTSIDE_ARROW_MAX_LENGTH);
  pushLine(lines, base, start, end);
  pushArrow(lines, base, start, outsideArrows ? v.mul(dimensionAxis, -1) : dimensionAxis, markerAxis);
  pushArrow(lines, base, end, outsideArrows ? dimensionAxis : v.mul(dimensionAxis, -1), markerAxis);
  if (offsetLength > EPSILON) {
    const extensionAxis = v.norm(dimensionLineOffset);
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
      text: dimensionText(definition, spec, value, smartComponent),
      displayText: draftingText(spec, value),
      title: dimensionTitle(definition, spec, value, smartComponent, issue)
    }]
  };
}

export function makeNote({ spec, definition, smartComponent, point, anchor = null, textValue, displayTextValue = null, titleValue = null, labelAxis = undefined, editKind = null, editValue = null, editTitle = null, editPath = null, editIndex = null, editValues = null, editValueOffset = null, editValueScale = null, editPaths = null, editLabels = null, dimensionValue = null, modeSeed = null, modeSeeds = null, active = false, activeDimensionId = null, activeMode = null, activeEditing = false }) {
  const id = `${smartComponent.id}:${spec.id}`;
  const isActive = active && (!activeDimensionId || activeDimensionId === id);
  const issue = issueForDimension(smartComponent, spec);
  const base = {
    dimensionId: id,
    smartComponentId: smartComponent.id,
    parameter: spec.parameter,
    color: issueColor(issue, isActive),
    issueSeverity: issue?.severity || null,
    issueMessage: issue?.message || null,
    issueResolvable: Array.isArray(issue?.resolve) && issue.resolve.length > 0,
    active: isActive,
    activeMode: isActive ? activeMode : null,
    editing: isActive && activeEditing,
    editOnCommit: spec.reference?.editOnCommit || null,
    modeControl: dimensionModeControl(definition, smartComponent, spec)
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
      title: issue?.message ? `${titleValue || fullDimensionText(definition, spec, 0, smartComponent)}\n${issue.message}` : titleValue || fullDimensionText(definition, spec, 0, smartComponent),
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

export function combine(parts) {
  return {
    lines: parts.flatMap((part) => part?.lines || []),
    labels: parts.flatMap((part) => part?.labels || [])
  };
}

export function featureBasis(project, feature) {
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

export function positionPoint(basis, position) {
  return v.add(basis.origin, v.add(v.mul(basis.localAxisY, position[0]), v.mul(basis.localAxisZ, position[1])));
}

export function positionInBasis(point, origin, basis) {
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

export function patternLayoutBasis(pattern, fallbackBasis) {
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

export function patternPositionsInBasis(pattern, sourceBasis, targetBasis) {
  return (pattern.positions || []).map((position) => (
    positionInBasis(positionPoint(sourceBasis, position), targetBasis.origin, targetBasis)
  ));
}

export function plateBoundsInBasis(plate, basis) {
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

export function holePair(pattern, axis) {
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

export function sortedCoordinateValues(positions, axis) {
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  return [...new Set((positions || []).map((position) => Math.round(position[axisIndex] / 0.001) * 0.001))]
    .sort((a, b) => a - b);
}

export function edgeDistanceSign(edge) {
  return edge === "max" ? 1 : -1;
}

export function basisBoundsCoordinate(bounds, axis, edge) {
  if (axis === "localAxisY") return edge === "max" ? bounds.maxY : bounds.minY;
  return edge === "max" ? bounds.maxZ : bounds.minZ;
}

export function signedEdgeDistance(edgeCoordinate, pointCoordinate, edge) {
  return edgeDistanceSign(edge) * (edgeCoordinate - pointCoordinate);
}

export function edgeDistanceEditTransform({ basis, measureBasis, axis, edge, edgeCoordinate, parameterEdge, parameterCoordinate, values, holePoint, signedMeasured }) {
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

export function spacingPairs(pattern, axis) {
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

export function spacingDimension(ctx, options) {
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
    textValue: dimensionText(ctx.definition, spec, 0, ctx.smartComponent),
    displayTextValue: draftingText(spec, 0),
    titleValue: fullDimensionText(ctx.definition, spec, 0, ctx.smartComponent),
    editKind,
    editPath,
    editIndex,
    editValues,
    dimensionValue: 0,
    modeSeed,
    modeSeeds
  });
}

export function closestHole(pattern) {
  return [...(pattern.positions || [])].sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))[0] || null;
}

export function uniqueCount(values) {
  return new Set(values.map((value) => Math.round(value / 0.001))).size;
}

export function interfaceByRole(project, profiles, definition, smartComponent, role) {
  const interfaceId = interfaceIdByRole(project, definition, smartComponent, role);
  return interfaceId ? resolveInterfaceWithConnectionReference(project, profiles, interfaceId) : null;
}

export function rawInterfaceByRole(project, definition, smartComponent, role) {
  const interfaceId = interfaceIdByRole(project, definition, smartComponent, role);
  return interfaceId && project.objectIndex?.[interfaceId] ? objectById(project, interfaceId) : null;
}

export function profileById(profiles, profileId) {
  return profiles?.[profileId] || profiles?.profiles?.[profileId] || null;
}

export function interfaceSectionEdgeValue(project, profiles, rawInterface, resolvedInterface, axis, edge) {
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

export function interfaceEdgeOnBasis(project, profiles, rawInterface, resolvedInterface, basis, axis, edge) {
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

export function pointToPlane(point, origin, normal) {
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, origin), normal)));
}

export function linePlane(point, direction, origin, normal) {
  const denominator = v.dot(direction, normal);
  if (Math.abs(denominator) <= EPSILON) return null;
  return v.add(point, v.mul(direction, v.dot(v.sub(origin, point), normal) / denominator));
}

export function interfaceAxis(iface, plate) {
  const normal = v.norm(iface.normal);
  return plate && v.dot(v.sub(plate.center, iface.origin), normal) < 0 ? v.mul(normal, -1) : normal;
}

export function interfaceAnnotationBasis(plate, iface) {
  const plateAxes = plateBasis(plate);
  return {
    origin: plate.center,
    normal: plateAxes.normal,
    localAxisY: interfaceAxis(iface, plate),
    localAxisZ: Array.isArray(iface.localAxisZ) ? v.norm(iface.localAxisZ) : plateAxes.localAxisZ
  };
}

export function plateOutlineWorldPoints(plate, basis) {
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

export function plateSupportEdge(plate, iface, basis) {
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

export function clearanceAnnotationBasis(geometry) {
  return {
    origin: geometry.basis.origin,
    normal: geometry.basis.y,
    localAxisY: geometry.basis.x,
    localAxisZ: geometry.basis.z
  };
}

export function rangeMid(ranges, axis) {
  return (ranges[`${axis}Min`] + ranges[`${axis}Max`]) / 2;
}
