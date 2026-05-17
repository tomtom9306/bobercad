export function nearestScreenSnap({ candidates, viewer, point, excludeObjectId = null, screenTolerance = 14 }) {
  const target = viewer.projectPoint(point);
  if (!target) return null;
  let best = null;
  for (const candidate of candidates) {
    if (excludeObjectId && candidate.objectId === excludeObjectId) continue;
    const projected = viewer.projectPoint(candidate.point);
    if (!projected) continue;
    const dx = projected.x - target.x;
    const dy = projected.y - target.y;
    const distance = Math.hypot(dx, dy);
    if (distance > screenTolerance) continue;
    if (!best || distance < best.screenDistance) best = { ...candidate, screenDistance: distance };
  }
  return best;
}
