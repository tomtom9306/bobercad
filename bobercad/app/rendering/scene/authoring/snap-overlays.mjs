import { v } from "../../../engine/core/math.mjs?v=world-axis-dry-1";
import { arrayValues } from "../../../engine/core/model.mjs?v=scene-array-values-dry-1";
import { authoringLine as line } from "./authoring-primitives.mjs?v=work-plane-axis-dry-1";

const DEFAULT_SNAP_COLOR = "#38bdf8";

function snapPoint(snap) {
  if (v.isVec3(snap?.point)) return snap.point;
  if (v.isVec3(snap?.pointWorld)) return snap.pointWorld;
  return null;
}

function snapLabel(snap) {
  return snap?.label || snap?.type || "Snap";
}

function distinctPoints(a, b) {
  return v.isVec3(a) && v.isVec3(b) && v.len(v.sub(a, b)) > 1e-9;
}

export function activeAxisFromSnap(snap, type) {
  if (snap?.type === type) return snap.axis || null;
  const source = arrayValues(snap?.sources).find((item) => item.type === type && item.axis);
  return source?.axis || null;
}

function isSnapAxisSource(source) {
  return source?.kind === "line" && v.isVec3(source.a) && v.isVec3(source.b) && v.len(v.sub(source.b, source.a)) > 1e-9;
}

export function snapAxisSources(snap) {
  const sources = [];
  if (isSnapAxisSource(snap)) sources.push(snap);
  for (const source of arrayValues(snap?.sources)) {
    if (isSnapAxisSource(source)) sources.push(source);
  }
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.type || ""}:${source.objectId || ""}:${source.axis || ""}:${source.a.join(",")}:${source.b.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stationOnAxis(source, point) {
  const axis = v.sub(source.b, source.a);
  const lengthSq = v.dot(axis, axis);
  if (lengthSq <= 1e-12 || !v.isVec3(point)) return null;
  return v.dot(v.sub(point, source.a), axis) / lengthSq;
}

function memberAxisHighlightPoints(source, snap, settings = {}) {
  const direction = v.norm(v.sub(source.b, source.a));
  const length = v.len(v.sub(source.b, source.a));
  const pad = settings.snapAxisExtensionPadding || settings.snapAxisHighlightPadding || 300;
  const station = stationOnAxis(source, snapPoint(snap));
  if (station === null) return [v.sub(source.a, v.mul(direction, pad)), v.add(source.b, v.mul(direction, pad))];
  const snapDistance = station * length;
  const startDistance = Math.min(0, snapDistance) - pad;
  const endDistance = Math.max(length, snapDistance) + pad;
  return [
    v.add(source.a, v.mul(direction, startDistance)),
    v.add(source.a, v.mul(direction, endDistance))
  ];
}

function snapAxisLinePoints(source, snap, settings = {}) {
  if (source.type === "composite-guide-axis") return [source.a, source.b];
  if (source.type === "member-axis" || source.type === "layout-axis") return memberAxisHighlightPoints(source, snap, settings);
  const point = snapPoint(snap);
  const center = point || (v.isVec3(source.point) ? source.point : v.mul(v.add(source.a, source.b), 0.5));
  const direction = v.norm(v.sub(source.b, source.a));
  const span = settings.snapAxisHighlightSpan || settings.globalAxisGuideSpan || settings.profileAxisGuideSpan || 1600;
  return [v.sub(center, v.mul(direction, span)), v.add(center, v.mul(direction, span))];
}

export function snapAxisSourceLines(snap, settings = {}) {
  const color = settings.snapAxisColor || settings.snapColor || DEFAULT_SNAP_COLOR;
  return snapAxisSources(snap).map((source) => line(
    snapAxisLinePoints(source, snap, settings),
    color,
    {
      kind: "snap-axis-active",
      axis: source.axis,
      objectId: source.objectId,
      sourceType: source.type
    }
  ));
}

export function snapPointOverlay({
  snap = null,
  rawPoint = null,
  sourcePoint = null,
  settings = {},
  color = null,
  objectId = null,
  linkKind = "snap-link",
  handleKind = "snap",
  labelClassName = "snap",
  labelOffset = null,
  handleRadius = 11,
  includeAxisLines = true,
  includeLink = true,
  includeHandle = true,
  includeLabel = true
} = {}) {
  const point = snapPoint(snap);
  const snapColor = color || settings.snapColor || DEFAULT_SNAP_COLOR;
  const lines = includeAxisLines ? snapAxisSourceLines(snap, settings) : [];
  const handles = [];
  const labels = [];
  if (!point) return { lines, handles, labels };
  const linkStart = v.isVec3(sourcePoint) ? sourcePoint : rawPoint;
  if (includeLink && distinctPoints(linkStart, point)) {
    lines.push(line([linkStart, point], snapColor, { kind: linkKind, objectId }));
  }
  if (includeHandle) {
    handles.push({
      kind: handleKind,
      point,
      color: snapColor,
      radius: handleRadius
    });
  }
  if (includeLabel) {
    labels.push({
      point,
      text: snapLabel(snap),
      color: snapColor,
      className: labelClassName,
      ...(labelOffset ? { screenOffsetPx: labelOffset } : {})
    });
  }
  return { lines, handles, labels };
}
