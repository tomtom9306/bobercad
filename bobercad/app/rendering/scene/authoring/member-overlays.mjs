import { WORLD_AXIS_ENTRIES, clamp, finiteNumber, sameVec3, v } from "../../../engine/core/math.mjs?v=world-axis-dry-1";
import { formatNumber } from "../../../engine/core/format.mjs?v=format-number-dry-1";
import { memberAuthoringPoints, memberById } from "../../../engine/api/project/members.mjs?v=member-api-distance-dry-1";
import { authoringAxisLines, authoringLine as line } from "./authoring-primitives.mjs?v=work-plane-axis-dry-1";
import { activeAxisFromSnap, snapPointOverlay } from "./snap-overlays.mjs?v=unified-snap-manager-8";
import { coordinateSpaceLabel, memberAxesByTarget, normalizeCoordinateSpace } from "./member-axis-space.mjs?v=member-api-distance-dry-1";
import { memberManipulatorHandles } from "./member-manipulator-overlays.mjs";

function handle(memberId, kind, point, color, radius = 10) {
  return { memberId, kind, point, color, radius };
}

function axisColor(axis, settings = {}, active = false) {
  if (active) return settings.snapColor || "#facc15";
  const axes = settings.axes || {};
  if (axis === "x") return axes.xColor || "#dc2626";
  if (axis === "y") return axes.yColor || "#16a34a";
  return axes.zColor || "#2563eb";
}

function axisGuideSet(entries, settings, activeAxis, span, className) {
  const lines = [];
  const labels = [];
  for (const entry of entries) {
    if (!v.isVec3(entry.point) || !v.isVec3(entry.direction)) continue;
    const active = activeAxis === entry.axis;
    const color = axisColor(entry.axis, settings, active);
    const offset = v.mul(entry.direction, span);
    const positive = v.add(entry.point, offset);
    lines.push(line([v.sub(entry.point, offset), positive], color, { kind: entry.kind, axis: entry.axis, ...entry.meta }));
    labels.push({
      point: positive,
      text: String(entry.axis || "").toUpperCase(),
      color,
      className: active ? `${className} active` : className
    });
  }
  return { lines, labels };
}

function globalAxisGuides(origins, settings = {}, activeAxis = null) {
  const originList = Array.isArray(origins?.[0]) ? origins : v.isVec3(origins) ? [origins] : [];
  if (!originList.length) return { lines: [], labels: [] };
  const span = settings.globalAxesSpan || settings.globalAxisGuideSpan || 1600;
  const entries = originList.flatMap((origin, originIndex) => WORLD_AXIS_ENTRIES.map(([axis, direction]) => ({
    axis,
    direction,
    point: origin,
    kind: `global-${axis}-axis-guide`,
    meta: { originIndex }
  })));
  return axisGuideSet(entries, settings, activeAxis, span, "snap global-axis");
}

function profileAxisGuides(profileAxes = [], settings = {}, activeAxis = null) {
  const span = settings.profileAxisGuideSpan || settings.globalAxisGuideSpan || 1600;
  const entries = profileAxes.map((guide) => ({
    axis: guide?.axis,
    direction: guide?.direction,
    point: guide?.point,
    kind: `profile-${guide?.axis}-axis-guide`,
    meta: { objectId: guide?.memberId }
  }));
  return axisGuideSet(entries, settings, activeAxis, span, "snap profile-axis");
}

export function memberAuthoringOverlay(project, memberId, options = {}) {
  const member = options.member || memberById(project, memberId);
  if (!member) return { lines: [], handles: [], labels: [] };
  const points = memberAuthoringPoints(member);
  const showLayoutAxis = options.showLayoutAxis === true;
  const lines = [
    line([points.physicalStart, points.physicalEnd], "#22c55e", { objectId: memberId, kind: "physical-axis" })
  ];
  if (showLayoutAxis) {
    lines.push(line([points.layoutStart, points.layoutEnd], "#f59e0b", { objectId: memberId, kind: "layout-axis" }));
  }
  const snapOverlay = snapPointOverlay({
    snap: options.snap,
    rawPoint: options.dragPoint,
    settings: options.settings || {},
    objectId: memberId
  });
  lines.push(...snapOverlay.lines);
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
  handles.push(...snapOverlay.handles);
  labels.push(...snapOverlay.labels);
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
    lines.push(...authoringAxisLines(workPlane.origin, workPlane.axisX, workPlane.axisY, settings.workPlaneSize || 220, settings.workPlaneColor || "#94a3b8"));
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
  const snapOverlay = snapPointOverlay({
    snap,
    rawPoint,
    settings,
    handleRadius: 12
  });
  lines.push(...snapOverlay.lines);
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
  handles.push(...snapOverlay.handles);
  labels.push(...snapOverlay.labels);
  return { lines, handles, labels };
}

function isFreshPoint(point, points) {
  return v.isVec3(point) && !points.some((other) => sameVec3(other, point));
}

function addPlatePointMarker(handles, point, color, kind, radius = 12) {
  if (!v.isVec3(point)) return;
  handles.push({ kind, point, color, radius });
}

function addPlateGuideLabel(labels, point, text, color, className, offset = { x: 18, y: -18 }) {
  if (!v.isVec3(point)) return;
  labels.push({ point, text, color, className, screenOffsetPx: offset });
}

function addPlatePreviewCornerHandles(handles, points, color) {
  for (let index = 0; index < points.length; index += 1) {
    handles.push({ kind: `plate-preview-corner-${index + 1}`, point: points[index], color, radius: 7 });
  }
}

function plateActiveInstruction(pointCount) {
  if (pointCount <= 0) return "P1/3 first corner";
  if (pointCount === 1) return "P2/3 edge end";
  return "P3/3 depth point";
}

export function plateCreationOverlay({ points = [], current = null, guidePoint = null, rawPoint = null, snap = null, previewPoints = [], workPlane, step = null, relations = {}, settings = {} }) {
  const faces = [];
  const lines = [];
  const handles = [];
  const labels = [];
  const color = settings.previewColor || "#2563eb";
  const fillColor = settings.platePreviewColor || settings.previewColor || "#0ea5e9";
  const snapColor = settings.snapColor || "#38bdf8";
  const workPlaneColor = settings.workPlaneColor || "#94a3b8";
  const validPoints = points.filter(v.isVec3);
  const activePoint = v.isVec3(guidePoint) ? guidePoint : current;
  const firstPointPreview = validPoints.length === 0 && previewPoints.length >= 4;
  const previewBaseStart = validPoints[0] || (firstPointPreview ? previewPoints[0] : null);
  const previewBaseEnd = validPoints[1] || (validPoints.length === 1 && v.isVec3(activePoint) ? activePoint : null) || (firstPointPreview ? previewPoints[1] : null);
  const activeStepIndex = finiteNumber(step) ? clamp(Math.floor(step) - 1, 0, 2) : validPoints.length;
  const activeInstruction = plateActiveInstruction(activeStepIndex);
  if (workPlane?.origin) {
    lines.push(...authoringAxisLines(workPlane.origin, workPlane.axisX, workPlane.axisY, settings.workPlaneSize || 220, workPlaneColor));
  }
  const drawingOrigin = validPoints[0] || (v.isVec3(current) ? current : null);
  if (drawingOrigin && workPlane?.axisX && workPlane?.axisY) {
    const size = settings.plateGuideSize || Math.min(settings.workPlaneSize || 220, 180);
    lines.push(...authoringAxisLines(drawingOrigin, workPlane.axisX, workPlane.axisY, size, workPlaneColor, {
      x: "plate-draw-axis-x",
      y: "plate-draw-axis-y"
    }));
  }

  for (const [index, point] of points.entries()) {
    if (!v.isVec3(point)) continue;
    addPlatePointMarker(handles, point, color, `plate-point-${index + 1}`, index === points.length - 1 ? 12 : 11);
    addPlateGuideLabel(labels, point, `P${index + 1} set`, color, "creation-start plate-point-set", { x: 8, y: -8 });
  }

  const currentIsFresh = isFreshPoint(current, points);
  const activeIsFresh = isFreshPoint(activePoint, points);
  const activeIsGuide = activeIsFresh && !sameVec3(activePoint, current);
  const lastPoint = validPoints[validPoints.length - 1] || null;
  if (currentIsFresh) {
    addPlatePointMarker(handles, current, snapColor, "plate-current", 11);
    addPlateGuideLabel(labels, current, activeInstruction, snapColor, "snap plate-cursor plate-active-step");
  }
  const snapOverlay = snapPointOverlay({
    snap,
    rawPoint,
    settings,
    labelOffset: { x: 18, y: -34 },
    handleRadius: 10
  });
  lines.push(...snapOverlay.lines);
  handles.push(...snapOverlay.handles);
  labels.push(...snapOverlay.labels);
  if (activeIsGuide) {
    addPlatePointMarker(handles, activePoint, fillColor, "plate-guide", 11);
    addPlateGuideLabel(labels, activePoint, activeInstruction, fillColor, "plate-guide plate-active-step", { x: 18, y: 18 });
  }
  if (lastPoint && activeIsFresh) {
    lines.push(line([lastPoint, activePoint], color, { kind: "create-axis" }));
  }

  if (previewBaseStart && previewBaseEnd && !sameVec3(previewBaseStart, previewBaseEnd)) {
    lines.push(line([previewBaseStart, previewBaseEnd], color, { kind: "create-axis" }));
    const base = v.sub(previewBaseEnd, previewBaseStart);
    const baseLength = v.len(base);
    const planeNormal = v.safeNorm(workPlane?.normal || v.cross(workPlane?.axisX || [1, 0, 0], workPlane?.axisY || [0, 1, 0]), [0, 0, 1]);
    const depthAxis = baseLength > 1e-9 ? v.safeNorm(v.cross(planeNormal, v.mul(base, 1 / baseLength)), [0, 0, 0]) : [0, 0, 0];
    if (v.len(depthAxis) > 1e-9) {
      const guideLength = settings.plateDepthGuideLength || Math.max(settings.workPlaneSize || 220, 360);
      const guideColor = settings.plateDepthGuideColor || snapColor;
      for (const point of [previewBaseStart, previewBaseEnd]) {
        lines.push(line([v.sub(point, v.mul(depthAxis, guideLength)), v.add(point, v.mul(depthAxis, guideLength))], guideColor, { kind: "plate-depth-guide" }));
      }
    }
    const relationPoint = v.mul(v.add(previewBaseStart, previewBaseEnd), 0.5);
    const relationText = relations.axisLocked === false ? "Free angle" : "Axis lock";
    const relationColor = relations.axisLocked === false ? settings.warningColor || "#f97316" : snapColor;
    handles.push({
      kind: "plate-create-axis-lock-toggle",
      point: relationPoint,
      color: relationColor,
      radius: 9,
      hitTolerancePx: 14,
      title: relations.axisLocked === false ? "Enable axis lock" : "Disable axis lock"
    });
    labels.push({
      point: relationPoint,
      text: relationText,
      color: relationColor,
      className: relations.axisLocked === false ? "snap plate-relation free-angle" : "snap plate-relation axis-lock",
      screenOffsetPx: { x: 14, y: -30 }
    });
  }

  if (points.length === 1 && activeIsFresh) {
    const length = v.len(v.sub(activePoint, points[0]));
    labels.push({
      point: v.mul(v.add(points[0], activePoint), 0.5),
      text: `L ${formatNumber(length)}`,
      color,
      className: "creation-dimension"
    });
  }

  if (previewBaseStart && previewBaseEnd && previewPoints.length >= 4) {
    faces.push({
      points: previewPoints,
      color: fillColor,
      opacity: Math.min(settings.previewOpacity || 0.32, 0.24)
    });
    for (let index = 0; index < previewPoints.length; index += 1) {
      lines.push(line([previewPoints[index], previewPoints[(index + 1) % previewPoints.length]], color, { kind: "plate-preview-outline" }));
    }
    addPlatePreviewCornerHandles(handles, previewPoints, fillColor);
    const edgeLength = v.len(v.sub(previewBaseEnd, previewBaseStart));
    const depthLength = v.len(v.sub(previewPoints[3], previewPoints[0]));
    labels.push({
      point: v.mul(previewPoints.reduce((sum, point) => v.add(sum, point), [0, 0, 0]), 1 / previewPoints.length),
      text: `${formatNumber(edgeLength)} x ${formatNumber(depthLength)}`,
      color,
      className: "creation-dimension"
    });
    if (validPoints.length > 0 && activeIsFresh) {
      lines.push(line([activePoint, previewPoints[3]], snapColor, { kind: "plate-depth-projection" }));
      labels.push({
        point: v.add(v.mul(activePoint, 0.25), v.mul(previewPoints[3], 0.75)),
        text: "depth",
        color: snapColor,
        className: "snap plate-projection",
        screenOffsetPx: { x: 12, y: 20 }
      });
    }
  } else if (points.length >= 2 && activeIsFresh) {
    lines.push(line([points[0], activePoint], color, { kind: "create-axis" }));
  }

  return { faces, lines, handles, labels };
}
