import { v } from "../../../engine/core/math.mjs";
import { memberAuthoringPoints } from "../../../engine/api/project/members.mjs";

function line(points, color, meta = {}) {
  return { points, color, collection: "authoring", ...meta };
}

function handle(memberId, kind, point, color, radius = 10) {
  return { memberId, kind, point, color, radius };
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
  const handles = [
    handle(memberId, "move-member", points.center, "#0ea5e9", 12),
    handle(memberId, "physical-start", points.physicalStart, "#22c55e"),
    handle(memberId, "physical-end", points.physicalEnd, "#22c55e")
  ];
  if (showLayoutAxis) {
    handles.push(
      handle(memberId, "layout-start", points.layoutStart, "#f59e0b"),
      handle(memberId, "layout-end", points.layoutEnd, "#f59e0b")
    );
  }
  return {
    lines,
    handles,
    labels: options.snap?.point ? [{
      point: options.snap.point,
      text: options.snap.label || options.snap.type || "Snap",
      color: "#38bdf8",
      className: "snap"
    }] : []
  };
}

export function memberCreationOverlay({ start, end, snap, rawPoint, type, workPlane, settings = {} }) {
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
  }
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
