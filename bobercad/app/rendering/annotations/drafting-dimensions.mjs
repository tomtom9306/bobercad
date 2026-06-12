import { finiteNumber, v } from "../../engine/core/math.mjs?v=unified-dimension-overlay-1";

const EPSILON = 1e-6;
const DEFAULT_COLOR = "#111827";
const DEFAULT_TICK_SIZE = 8;
const DEFAULT_EXTENSION_GAP = 2;
const DEFAULT_EXTENSION_OVERRUN = 6;
const DEFAULT_LABEL_OFFSET = 10;

export function formatDraftingNumber(value, { decimals = 2 } = {}) {
  return finiteNumber(value) ? value.toFixed(decimals) : "";
}

export function midpoint3(a, b) {
  return v.mul(v.add(a, b), 0.5);
}

export function perpendicularAxis(axis) {
  const fromZ = v.cross(axis, [0, 0, 1]);
  if (v.len(fromZ) > EPSILON) return v.norm(fromZ);
  return v.norm(v.cross(axis, [0, 1, 0]));
}

export function perpendicularDimensionOffset(dimensionAxis, offset) {
  if (v.len(offset) <= EPSILON) return offset;
  const parallel = v.mul(dimensionAxis, v.dot(offset, dimensionAxis));
  const perpendicular = v.sub(offset, parallel);
  return v.len(perpendicular) > EPSILON ? perpendicular : [0, 0, 0];
}

function pushLine(lines, base, a, b) {
  if (v.len(v.sub(a, b)) <= EPSILON) return;
  lines.push({ ...base, points: [a, b] });
}

function tickEndpoints(point, dimensionAxis, markerAxis, size) {
  const half = Math.max(0, size) / 2;
  const diagonal = v.norm(v.sub(dimensionAxis, markerAxis));
  return [
    v.add(point, v.mul(diagonal, -half)),
    v.add(point, v.mul(diagonal, half))
  ];
}

function pushTick(lines, base, point, dimensionAxis, markerAxis, size) {
  const [a, b] = tickEndpoints(point, dimensionAxis, markerAxis, size);
  pushLine(lines, base, a, b);
}

export function linearDraftingDimension({
  base = {},
  a,
  b,
  start = null,
  end = null,
  extensionA = null,
  extensionB = null,
  dimensionAxis = null,
  markerAxis = null,
  lineOffset = null,
  labelPoint = null,
  labelOffset = DEFAULT_LABEL_OFFSET,
  tickSize = DEFAULT_TICK_SIZE,
  extensionGap = DEFAULT_EXTENSION_GAP,
  extensionOverrun = DEFAULT_EXTENSION_OVERRUN,
  lineWidth = 1,
  color = DEFAULT_COLOR,
  text = null,
  displayText = null,
  title = null,
  value = null,
  textHeight = null,
  handles = []
} = {}) {
  if (!Array.isArray(a) || !Array.isArray(b)) return { lines: [], labels: [], handles: [] };
  const axis = dimensionAxis && v.len(dimensionAxis) > EPSILON
    ? v.norm(dimensionAxis)
    : v.norm(v.sub(b, a));
  if (v.len(axis) <= EPSILON) return { lines: [], labels: [], handles: [] };
  const resolvedOffset = Array.isArray(lineOffset) ? perpendicularDimensionOffset(axis, lineOffset) : [0, 0, 0];
  const resolvedStart = start || v.add(a, resolvedOffset);
  const resolvedEnd = end || v.add(b, resolvedOffset);
  const offsetVector = v.sub(resolvedStart, a);
  const upAxis = markerAxis && v.len(markerAxis) > EPSILON
    ? v.norm(markerAxis)
    : v.len(offsetVector) > EPSILON
      ? v.norm(offsetVector)
      : perpendicularAxis(axis);
  const resolvedColor = color || base.color || DEFAULT_COLOR;
  const lineBase = {
    ...base,
    color: resolvedColor,
    lineWidth,
    dimensionStart: resolvedStart,
    dimensionEnd: resolvedEnd,
    dimensionAxis: axis,
    labelAxis: axis,
    labelUpAxis: upAxis
  };
  const lines = [];
  const firstAnchor = extensionA || a;
  const secondAnchor = extensionB || b;
  const firstOffset = v.len(v.sub(resolvedStart, firstAnchor));
  const secondOffset = v.len(v.sub(resolvedEnd, secondAnchor));
  pushLine(lines, lineBase, resolvedStart, resolvedEnd);
  pushTick(lines, { ...lineBase, kind: `${lineBase.kind || "dimension"}-tick` }, resolvedStart, axis, upAxis, tickSize);
  pushTick(lines, { ...lineBase, kind: `${lineBase.kind || "dimension"}-tick` }, resolvedEnd, axis, upAxis, tickSize);
  if (firstOffset > EPSILON) {
    pushLine(
      lines,
      { ...lineBase, kind: `${lineBase.kind || "dimension"}-extension` },
      v.add(firstAnchor, v.mul(upAxis, Math.min(extensionGap, firstOffset * 0.3))),
      v.add(resolvedStart, v.mul(upAxis, extensionOverrun))
    );
  }
  if (secondOffset > EPSILON) {
    pushLine(
      lines,
      { ...lineBase, kind: `${lineBase.kind || "dimension"}-extension` },
      v.add(secondAnchor, v.mul(upAxis, Math.min(extensionGap, secondOffset * 0.3))),
      v.add(resolvedEnd, v.mul(upAxis, extensionOverrun))
    );
  }
  const resolvedLabelPoint = labelPoint || v.add(midpoint3(resolvedStart, resolvedEnd), v.mul(upAxis, labelOffset));
  const labelText = text ?? displayText ?? formatDraftingNumber(value);
  const label = {
    ...lineBase,
    point: resolvedLabelPoint,
    labelLine: [resolvedStart, resolvedEnd],
    text: labelText,
    displayText: displayText ?? labelText,
    title: title ?? labelText,
    textHeight,
    draftingDimension: true
  };
  return {
    lines,
    labels: [label],
    handles: handles.map((handle) => ({
      ...handle,
      point: handle.point || resolvedLabelPoint,
      color: handle.color || resolvedColor,
      dimensionAxis: axis,
      labelUpAxis: upAxis,
      labelLine: [resolvedStart, resolvedEnd]
    }))
  };
}

export function combineDimensionParts(parts) {
  return {
    lines: parts.flatMap((part) => Array.isArray(part?.lines) ? part.lines : []),
    labels: parts.flatMap((part) => Array.isArray(part?.labels) ? part.labels : []),
    handles: parts.flatMap((part) => Array.isArray(part?.handles) ? part.handles : [])
  };
}
