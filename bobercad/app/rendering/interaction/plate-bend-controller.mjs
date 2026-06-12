import { distancePointToSegment, v } from "../../engine/core/math.mjs?v=point-segment-distance-dry-1";
import { arrayValues } from "../../engine/core/model.mjs?v=interaction-array-values-dry-1";
import { plateBendGeometry } from "../scene/plate-bend-geometry.mjs?v=plate-placement-vertex-dry-1";
import { handleEscapeReset } from "./keyboard-shortcuts.mjs?v=escape-reset-dry-1";

function bendIdForTarget(target) {
  const raw = target.parentBendId
    ? `${target.parentBendId}_${target.parentEdge || "outer"}`
    : target.edgeId;
  return `bend_${raw.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function bendPatchForTarget(target) {
  if (target.parentBendId) {
    return {
      id: bendIdForTarget(target),
      parentBendId: target.parentBendId,
      parentEdge: target.parentEdge || "outer"
    };
  }
  return {
    id: bendIdForTarget(target),
    edgeId: target.edgeId
  };
}

function nearestBendTarget(plate, worldPoint) {
  const geometry = plateBendGeometry(plate);
  let best = null;
  for (const target of arrayValues(geometry.targetEdges)) {
    const distance = distancePointToSegment(worldPoint, target.start, target.end);
    if (!best || distance < best.distance) best = { target, distance };
  }
  return best;
}

export function createPlateBendController({
  api,
  onProjectChange,
  onStatusChange
}) {
  const state = { active: false };

  function reset() {
    state.active = false;
    onStatusChange?.("No modeling command");
  }

  function start() {
    state.active = true;
    onStatusChange?.("Bend: click a plate or bend edge");
  }

  function pointerDown(pointer) {
    if (!state.active) return false;
    const objectId = pointer?.hit?.face?.objectId;
    const collection = objectId ? api.project().objectIndex?.[objectId]?.collection : null;
    if (collection !== "plates") {
      onStatusChange?.("Bend: pick a plate");
      return true;
    }
    const plate = api.object(objectId);
    if (!v.isVec3(pointer?.hit?.point)) {
      onStatusChange?.("Bend: could not resolve point on plate");
      return true;
    }
    const nearest = nearestBendTarget(plate, pointer.hit.point);
    if (!nearest?.target) {
      onStatusChange?.("Bend: plate has no bendable edge");
      return true;
    }
    const direction = pointer.event?.altKey || pointer.event?.shiftKey ? "down" : "up";
    const bendRadius = Math.max(plate.thickness || 8, 8);
    const result = api.upsertPlateBend(plate.id, {
      ...bendPatchForTarget(nearest.target),
      direction,
      angle: 90,
      radius: bendRadius,
      flangeLength: 80,
      relief: { mode: "auto", type: "round", radius: bendRadius }
    });
    onProjectChange?.(result);
    reset();
    return true;
  }

  function handleKey(event) {
    if (!state.active) return false;
    return handleEscapeReset(event, reset);
  }

  return {
    active: () => state.active,
    start,
    cancel: reset,
    pointerDown,
    handleKey
  };
}
