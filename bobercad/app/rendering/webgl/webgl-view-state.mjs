import { clamp, v } from "../../engine/core/math.mjs";

export function normalizeDisplayMode(mode) {
  return ["shaded", "wireframe", "xray"].includes(mode) ? mode : "shaded";
}

export function cameraAnglesForDirection(direction) {
  const d = v.safeNorm(direction, [-1, -1, -0.62]);
  const pitch = Math.acos(clamp(-d[2], -1, 1));
  const horizontal = Math.hypot(d[0], d[1]);
  const yaw = horizontal <= 1e-9 ? 0 : Math.atan2(-d[0], -d[1]);
  return { yaw, pitch };
}

export function cameraAnglesForOrientation(orientation) {
  const directions = {
    front: [1, 0, 0],
    back: [-1, 0, 0],
    right: [0, -1, 0],
    left: [0, 1, 0],
    top: [0, 0, -1],
    bottom: [0, 0, 1],
    iso: [-1, -1, -0.62]
  };
  return cameraAnglesForDirection(directions[orientation] || directions.iso);
}

export function cameraStateFor(camera, orientation, reason = "camera") {
  return {
    ...camera.viewAngles(),
    orientation,
    reason
  };
}

export function cloneScenePoint(point) {
  return Array.isArray(point) ? [...point] : point;
}

export function cloneSceneItem(item) {
  return {
    ...item,
    points: Array.isArray(item.points) ? item.points.map(cloneScenePoint) : [],
    start: cloneScenePoint(item.start),
    axisX: cloneScenePoint(item.axisX),
    axisY: cloneScenePoint(item.axisY),
    axisZ: cloneScenePoint(item.axisZ)
  };
}
