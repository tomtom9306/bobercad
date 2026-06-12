import { v } from "../../engine/core/math.mjs?v=vec3-dry-1";

export function labelRotation(label, projectPoint) {
  const axis = Array.isArray(label.labelLine) && label.labelLine.length === 2
    ? v.sub(label.labelLine[1], label.labelLine[0])
    : label.labelAxis;
  if (!Array.isArray(axis)) return 0;
  const a = projectPoint(label.point);
  const b = projectPoint(v.add(label.point, axis));
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1) return 0;
  let angle = Math.atan2(dy, dx);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}
