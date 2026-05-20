import { v } from "../../../engine/core/math.mjs";

function line(points, color, meta = {}) {
  return { points, color, collection: "authoring", ...meta };
}

export function workPlaneOverlay(plane, settings = {}) {
  if (!plane?.origin || !plane?.axisX || !plane?.axisY) return { lines: [], handles: [], labels: [] };
  const color = settings.workPlaneColor || "#94a3b8";
  const size = settings.workPlaneSize || 280;
  const x = v.mul(v.norm(plane.axisX), size);
  const y = v.mul(v.norm(plane.axisY), size);
  return {
    lines: [
      line([v.sub(plane.origin, x), v.add(plane.origin, x)], color, { kind: "work-plane-x" }),
      line([v.sub(plane.origin, y), v.add(plane.origin, y)], color, { kind: "work-plane-y" })
    ],
    handles: [],
    labels: [{
      point: v.add(plane.origin, v.add(v.mul(v.norm(plane.axisX), size * 0.62), v.mul(v.norm(plane.axisY), size * 0.18))),
      text: `Work plane: ${plane.label || plane.id || "active"}`,
      color,
      className: "work-plane"
    }]
  };
}
