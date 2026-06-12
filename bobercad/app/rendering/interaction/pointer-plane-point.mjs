import { v } from "../../engine/core/math.mjs";
import { rayPlaneIntersection } from "../../engine/api/project/work-plane.mjs";

export function pointOnViewRay(viewer, basePoint, screen) {
  if (!v.isVec3(basePoint) || !screen) return null;
  const ray = viewer.screenRay(screen.x, screen.y);
  const denominator = v.dot(ray.direction, ray.direction);
  if (denominator <= 1e-12) return null;
  return v.add(ray.origin, v.mul(ray.direction, v.dot(v.sub(basePoint, ray.origin), ray.direction) / denominator));
}

export function pointerPlanePoint(pointer, viewer, plane, options = {}) {
  const hitPoint = pointer?.hit?.point;
  if (options.preferHit !== false && v.isVec3(hitPoint)) return hitPoint;
  const screen = pointer?.screen;
  if (!screen) return v.isVec3(hitPoint) ? hitPoint : null;
  return rayPlaneIntersection(viewer.screenRay(screen.x, screen.y), plane);
}
