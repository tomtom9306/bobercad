import { v } from "../../../engine/core/math.mjs";

export function authoringLine(points, color, meta = {}) {
  return { points, color, collection: "authoring", ...meta };
}

export function authoringAxisLines(origin, axisX, axisY, size, color, kinds = {}) {
  if (!origin || !axisX || !axisY) return [];
  const x = v.mul(v.norm(axisX), size);
  const y = v.mul(v.norm(axisY), size);
  return [
    authoringLine([v.sub(origin, x), v.add(origin, x)], color, { kind: kinds.x || "work-plane-x" }),
    authoringLine([v.sub(origin, y), v.add(origin, y)], color, { kind: kinds.y || "work-plane-y" })
  ];
}
