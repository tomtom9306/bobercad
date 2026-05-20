import { solveSnap } from "../../engine/api/project/snapping.mjs";

export function nearestScreenSnap({ candidates, viewer, point, excludeObjectId = null, screenTolerance = 14 }) {
  const target = viewer.projectPoint(point);
  if (!target) return null;
  return solveSnap({
    candidates,
    viewer,
    rawPoint: point,
    screen: target,
    excludeObjectId,
    screenTolerance
  }).snap;
}
