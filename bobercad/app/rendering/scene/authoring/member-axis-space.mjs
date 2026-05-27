import { v } from "../../../engine/core/math.mjs";
import { memberFrameAt } from "../../../engine/geometry/member-evaluator.mjs";

export const AXIS_IDS = ["x", "y", "z"];

const WORLD_AXES = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1]
};

export function normalizeCoordinateSpace(value) {
  return value === "local" ? "local" : "global";
}

export function coordinateSpaceLabel(value) {
  return normalizeCoordinateSpace(value) === "local" ? "Local" : "Global";
}

function stationForTarget(member, target) {
  const length = v.len(v.sub(member.end, member.start));
  if (target === "start") return 0;
  if (target === "end") return length;
  return length / 2;
}

function localAxisMap(member, target) {
  const frame = memberFrameAt(member, stationForTarget(member, target));
  return {
    x: frame.x,
    y: frame.y,
    z: frame.z
  };
}

export function memberAxesForTarget(member, target = "center", coordinateSpace = "global") {
  const space = normalizeCoordinateSpace(coordinateSpace);
  const axes = space === "local" ? localAxisMap(member, target) : WORLD_AXES;
  const spaceLabel = coordinateSpaceLabel(space);
  return Object.fromEntries(AXIS_IDS.map((axisId) => [axisId, {
    axisId,
    axis: v.norm(axes[axisId]),
    axisLabel: axisId.toUpperCase(),
    coordinateSpace: space,
    spaceLabel
  }]));
}

export function memberAxesByTarget(member, coordinateSpace = "global") {
  return Object.fromEntries(["start", "center", "end"].map((target) => [
    target,
    memberAxesForTarget(member, target, coordinateSpace)
  ]));
}

export function vectorComponentsInAxes(vector, axes) {
  return AXIS_IDS.map((axisId) => v.dot(vector, axes[axisId].axis));
}

export function vectorFromAxisComponents(components, axes) {
  return AXIS_IDS.reduce(
    (sum, axisId, index) => v.add(sum, v.mul(axes[axisId].axis, components[index] || 0)),
    [0, 0, 0]
  );
}
