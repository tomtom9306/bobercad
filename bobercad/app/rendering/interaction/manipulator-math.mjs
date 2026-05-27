import { v } from "../../engine/core/math.mjs";
import { memberFrame } from "../../engine/geometry/member-evaluator.mjs";

const DEFAULT_NICE_STEPS = [1, 2, 5, 10, 25, 50, 100];

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function niceStep(value, steps = DEFAULT_NICE_STEPS) {
  const sorted = [...steps].filter((step) => step > 0).sort((a, b) => a - b);
  if (!sorted.length) return value;
  return sorted.find((step) => step >= value) || sorted[sorted.length - 1];
}

export function translationStepForScale(settings = {}, screenScale = 1) {
  const minStep = finiteNumber(settings.minStep) ? settings.minStep : 1;
  const maxStep = finiteNumber(settings.maxStep) ? settings.maxStep : 100;
  const targetPixelsPerStep = finiteNumber(settings.targetPixelsPerStep) ? settings.targetPixelsPerStep : 8;
  const allowedSteps = Array.isArray(settings.allowedSteps) ? settings.allowedSteps : DEFAULT_NICE_STEPS;
  if (settings.mode === "fixed" && finiteNumber(settings.fixedStep)) {
    return clamp(settings.fixedStep, minStep, maxStep);
  }
  const rawStep = screenScale > 1e-9 ? targetPixelsPerStep / screenScale : maxStep;
  return clamp(niceStep(rawStep, allowedSteps), minStep, maxStep);
}

export function quantizeDistance(distance, step) {
  if (!finiteNumber(distance)) return 0;
  if (!finiteNumber(step) || step <= 0) return distance;
  return Math.round(distance / step) * step;
}

export function quantizeDegrees(degrees, stepDegrees = 1) {
  if (!finiteNumber(degrees)) return 0;
  const step = finiteNumber(stepDegrees) && stepDegrees > 0 ? stepDegrees : 1;
  return Math.round(degrees / step) * step;
}

export function axisScreenDistance({ pointerStart, pointerCurrent, axisScreen }) {
  if (!pointerStart || !pointerCurrent || !axisScreen) return 0;
  const dx = pointerCurrent.x - pointerStart.x;
  const dy = pointerCurrent.y - pointerStart.y;
  return dx * axisScreen.x + dy * axisScreen.y;
}

export function signedScreenAngleDegrees({ center, pointerStart, pointerCurrent }) {
  if (!center || !pointerStart || !pointerCurrent) return 0;
  const ax = pointerStart.x - center.x;
  const ay = pointerStart.y - center.y;
  const bx = pointerCurrent.x - center.x;
  const by = pointerCurrent.y - center.y;
  if (Math.hypot(ax, ay) <= 1e-6 || Math.hypot(bx, by) <= 1e-6) return 0;
  const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  return angle * 180 / Math.PI;
}

export function rotatePointAroundAxis(point, pivot, axis, degrees) {
  const unit = v.norm(axis);
  const radians = degrees * Math.PI / 180;
  const local = v.sub(point, pivot);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const parallel = v.mul(unit, v.dot(unit, local));
  const perpendicular = v.sub(local, parallel);
  const cross = v.cross(unit, local);
  return v.add(pivot, v.add(parallel, v.add(v.mul(perpendicular, cos), v.mul(cross, sin))));
}

export function rotateMemberAroundPivot(member, pivot, axis, degrees) {
  const next = {
    ...member,
    start: rotatePointAroundAxis(member.start, pivot, axis, degrees),
    end: rotatePointAroundAxis(member.end, pivot, axis, degrees)
  };
  if (member.layoutAxis) {
    next.layoutAxis = {
      ...member.layoutAxis,
      start: rotatePointAroundAxis(member.layoutAxis.start, pivot, axis, degrees),
      end: rotatePointAroundAxis(member.layoutAxis.end, pivot, axis, degrees)
    };
  }
  return next;
}

export function rotateMemberAroundAxis(member, pivot, axis, degrees) {
  const next = rotateMemberAroundPivot(member, pivot, axis, degrees);
  const desiredFrame = memberFrame(member);
  const desiredY = v.norm(rotatePointAroundAxis(desiredFrame.y, [0, 0, 0], axis, degrees));
  const zeroRollFrame = memberFrame({ ...next, rotation: 0 });
  const rotation = Math.atan2(
    v.dot(desiredY, zeroRollFrame.z),
    v.dot(desiredY, zeroRollFrame.y)
  ) * 180 / Math.PI;
  return { ...next, rotation };
}
