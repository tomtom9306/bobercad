import { v } from "../../../engine/core/math.mjs";
import { memberAuthoringPoints } from "../../../engine/api/project/members.mjs";
import { coordinateSpaceLabel, memberAxesByTarget, normalizeCoordinateSpace } from "./member-axis-space.mjs";
import { memberManipulatorHandles } from "./member-manipulator-overlays.mjs";

function line(points, color, meta = {}) {
  return { points, color, collection: "authoring", ...meta };
}

function handle(memberId, kind, point, color, radius = 10) {
  return { memberId, kind, point, color, radius };
}

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function axisColor(axis, settings = {}, active = false) {
  if (active) return settings.snapColor || "#facc15";
  const axes = settings.axes || {};
  if (axis === "x") return axes.xColor || "#dc2626";
  if (axis === "y") return axes.yColor || "#16a34a";
  return axes.zColor || "#2563eb";
}

function globalAxisGuides(origins, settings = {}, activeAxis = null) {
  const originList = Array.isArray(origins?.[0]) ? origins : finitePoint(origins) ? [origins] : [];
  if (!originList.length) return { lines: [], labels: [] };
  const span = settings.globalAxesSpan || settings.globalAxisGuideSpan || 1600;
  const guides = [
    { axis: "x", direction: [1, 0, 0] },
    { axis: "y", direction: [0, 1, 0] },
    { axis: "z", direction: [0, 0, 1] }
  ];
  const lines = [];
  const labels = [];
  for (const [originIndex, origin] of originList.entries()) {
    if (!finitePoint(origin)) continue;
    for (const guide of guides) {
      const active = activeAxis === guide.axis;
      const color = axisColor(guide.axis, settings, active);
      const negative = v.sub(origin, v.mul(guide.direction, span));
      const positive = v.add(origin, v.mul(guide.direction, span));
      lines.push(line([negative, positive], color, { kind: `global-${guide.axis}-axis-guide`, axis: guide.axis, originIndex }));
      labels.push({
        point: positive,
        text: guide.axis.toUpperCase(),
        color,
        className: active ? "snap global-axis active" : "snap global-axis"
      });
    }
  }
  return { lines, labels };
}

function profileAxisGuides(profileAxes = [], settings = {}, activeAxis = null) {
  const span = settings.profileAxisGuideSpan || settings.globalAxisGuideSpan || 1600;
  const lines = [];
  const labels = [];
  for (const guide of profileAxes) {
    if (!guide?.point || !guide?.direction) continue;
    const active = activeAxis === guide.axis;
    const color = axisColor(guide.axis, settings, active);
    const negative = v.sub(guide.point, v.mul(guide.direction, span));
    const positive = v.add(guide.point, v.mul(guide.direction, span));
    lines.push(line([negative, positive], color, { kind: `profile-${guide.axis}-axis-guide`, axis: guide.axis, objectId: guide.memberId }));
    labels.push({
      point: positive,
      text: String(guide.axis || "").toUpperCase(),
      color,
      className: active ? "snap profile-axis active" : "snap profile-axis"
    });
  }
  return { lines, labels };
}

function activeAxisFromSnap(snap, type) {
  if (snap?.type === type) return snap.axis || null;
  const source = Array.isArray(snap?.sources) ? snap.sources.find((item) => item.type === type && item.axis) : null;
  return source?.axis || null;
}

function isSnapAxisSource(source) {
  return source?.kind === "line" && finitePoint(source.a) && finitePoint(source.b) && v.len(v.sub(source.b, source.a)) > 1e-9;
}

function snapAxisSources(snap) {
  const sources = [];
  if (isSnapAxisSource(snap)) sources.push(snap);
  for (const source of snap?.sources || []) {
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
  if (lengthSq <= 1e-12 || !finitePoint(point)) return null;
  return v.dot(v.sub(point, source.a), axis) / lengthSq;
}

function memberAxisHighlightPoints(source, snap, settings = {}) {
  const direction = v.norm(v.sub(source.b, source.a));
  const length = v.len(v.sub(source.b, source.a));
  const pad = settings.snapAxisExtensionPadding || settings.snapAxisHighlightPadding || 300;
  const station = stationOnAxis(source, snap?.point);
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
  const center = finitePoint(snap?.point) ? snap.point : finitePoint(source.point) ? source.point : v.mul(v.add(source.a, source.b), 0.5);
  const direction = v.norm(v.sub(source.b, source.a));
  const span = settings.snapAxisHighlightSpan || settings.globalAxisGuideSpan || settings.profileAxisGuideSpan || 1600;
  return [v.sub(center, v.mul(direction, span)), v.add(center, v.mul(direction, span))];
}

function snapAxisSourceLines(snap, settings = {}) {
  const color = settings.snapAxisColor || settings.snapColor || "#38bdf8";
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

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function memberById(project, memberId, draftMember = null) {
  return draftMember || project.model?.members?.[memberId] || null;
}

export function memberAuthoringOverlay(project, memberId, options = {}) {
  const member = memberById(project, memberId, options.member);
  if (!member) return { lines: [], handles: [], labels: [] };
  const points = memberAuthoringPoints(member);
  const showLayoutAxis = options.showLayoutAxis === true;
  const lines = [
    line([points.physicalStart, points.physicalEnd], "#22c55e", { objectId: memberId, kind: "physical-axis" })
  ];
  if (showLayoutAxis) {
    lines.push(line([points.layoutStart, points.layoutEnd], "#f59e0b", { objectId: memberId, kind: "layout-axis" }));
  }
  if (options.snap?.point) {
    lines.push(line([options.dragPoint || options.snap.point, options.snap.point], "#38bdf8", { objectId: memberId, kind: "snap-line" }));
  }
  lines.push(...snapAxisSourceLines(options.snap, options.settings || {}));
  const axisGuides = globalAxisGuides(
    options.globalAxesOrigins || options.globalAxesOrigin,
    { ...(options.settings || {}), globalAxesSpan: options.globalAxesSpan },
    activeAxisFromSnap(options.snap, "global-axis")
  );
  lines.push(...axisGuides.lines);
  const manipulatorSettings = options.settings?.manipulator || {};
  const coordinateSpace = normalizeCoordinateSpace(manipulatorSettings.coordinateSpace);
  const handles = manipulatorSettings.visible === false
    ? [
        handle(memberId, "move-member", points.center, "#0ea5e9", 12),
        handle(memberId, "physical-start", points.physicalStart, "#22c55e"),
        handle(memberId, "physical-end", points.physicalEnd, "#22c55e")
      ]
    : memberManipulatorHandles(memberId, points, {
        ...manipulatorSettings.screen,
        ...(options.settings?.axes || {}),
        coordinateAxesByTarget: memberAxesByTarget(member, coordinateSpace),
        coordinateSpace,
        visible: manipulatorSettings.visible
      });
  if (showLayoutAxis) {
    handles.push(
      handle(memberId, "layout-start", points.layoutStart, "#f59e0b"),
      handle(memberId, "layout-end", points.layoutEnd, "#f59e0b")
    );
  }
  const labels = [...axisGuides.labels];
  if (options.snap?.point) labels.push({
    point: options.snap.point,
    text: options.snap.label || options.snap.type || "Snap",
    color: "#38bdf8",
    className: "snap"
  });
  if (manipulatorSettings.visible !== false) {
    labels.push({
      point: points.center,
      screenOffsetPx: manipulatorSettings.screen?.spaceToggleOffsetPx || { x: -30, y: -30 },
      text: coordinateSpace === "local" ? "L" : "G",
      color: coordinateSpace === "local" ? "#0f766e" : "#475569",
      className: `space-toggle ${coordinateSpace}`,
      title: `${coordinateSpaceLabel(coordinateSpace)} axes`
    });
  }
  return {
    lines,
    handles,
    labels
  };
}

export function memberCreationOverlay({ start, end, snap, rawPoint, type, workPlane, profileAxes = [], settings = {} }) {
  const lines = [];
  const handles = [];
  const labels = [];
  const color = settings.previewColor || "#2563eb";
  if (workPlane?.origin) {
    const size = settings.workPlaneSize || 220;
    const axisX = v.mul(v.norm(workPlane.axisX), size);
    const axisY = v.mul(v.norm(workPlane.axisY), size);
    lines.push(line([v.sub(workPlane.origin, axisX), v.add(workPlane.origin, axisX)], settings.workPlaneColor || "#94a3b8", { kind: "work-plane-x" }));
    lines.push(line([v.sub(workPlane.origin, axisY), v.add(workPlane.origin, axisY)], settings.workPlaneColor || "#94a3b8", { kind: "work-plane-y" }));
  }
  if (start) {
    handles.push({ kind: "create-start", point: start, color, radius: 11 });
    labels.push({ point: start, text: "Start", color, className: "creation-start" });
    if (type === "beam") {
      const axisGuides = profileAxes.length
        ? profileAxisGuides(profileAxes, settings, activeAxisFromSnap(snap, "profile-axis"))
        : globalAxisGuides(start, settings, activeAxisFromSnap(snap, "global-axis") || activeAxisFromSnap(snap, "creation-axis"));
      lines.push(...axisGuides.lines);
      labels.push(...axisGuides.labels);
    }
  }
  lines.push(...snapAxisSourceLines(snap, settings));
  if (start && end) {
    lines.push(line([start, end], color, { kind: "create-axis" }));
    handles.push({ kind: "create-end", point: end, color, radius: 11 });
    const length = v.len(v.sub(end, start));
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
    labels.push({
      point: v.mul(v.add(start, end), 0.5),
      text: `${type === "column" ? "H" : "L"} ${formatNumber(length)}  A ${formatNumber(angle)}`,
      color,
      className: "creation-dimension"
    });
  }
  if (snap?.point) {
    if (rawPoint) lines.push(line([rawPoint, snap.point], settings.snapColor || "#38bdf8", { kind: "snap-link" }));
    handles.push({ kind: "snap", point: snap.point, color: settings.snapColor || "#38bdf8", radius: 12 });
    labels.push({ point: snap.point, text: snap.label || snap.type || "Snap", color: settings.snapColor || "#38bdf8", className: "snap" });
  }
  return { lines, handles, labels };
}
