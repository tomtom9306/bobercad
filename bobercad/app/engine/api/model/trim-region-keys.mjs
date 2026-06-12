import { arrayValues, uniqueTruthy } from "../../core/model.mjs?v=geometry-api-array-values-dry-1";

export function planeTrimRegionKeys(referencePlaneIds = []) {
  const keys = [];
  const walk = (index, parts) => {
    if (index >= referencePlaneIds.length) {
      keys.push(parts.map(({ planeId, side }) => `${planeId}:${side}`).join("|"));
      return;
    }
    const planeId = referencePlaneIds[index];
    walk(index + 1, [...parts, { planeId, side: "-" }]);
    walk(index + 1, [...parts, { planeId, side: "+" }]);
  };
  walk(0, []);
  return keys;
}

export function defaultPlaneTrimRemovedRegionKeys(referencePlaneIds = []) {
  return planeTrimRegionKeys(referencePlaneIds).filter((key) => key.split("|").some((part) => part.endsWith(":-")));
}

export function trimRegionSelectorMap(regionKeyValue) {
  const map = new Map();
  if (typeof regionKeyValue !== "string" || !regionKeyValue) return map;
  for (const part of regionKeyValue.split("|")) {
    const index = part.lastIndexOf(":");
    if (index <= 0) continue;
    const planeId = part.slice(0, index);
    const side = part.slice(index + 1);
    if (side === "+" || side === "-") map.set(planeId, side);
  }
  return map;
}

export function reconcilePlaneTrimRemovedRegionKeys(operation, referencePlaneIds) {
  const ids = new Set(uniqueTruthy(referencePlaneIds));
  const keys = planeTrimRegionKeys([...ids]);
  const removed = new Set();
  for (const regionKeyValue of arrayValues(operation?.removedRegionKeys)) {
    const selector = new Map([...trimRegionSelectorMap(regionKeyValue)].filter(([planeId]) => ids.has(planeId)));
    if (!selector.size) continue;
    for (const key of keys) {
      const keySelector = trimRegionSelectorMap(key);
      if ([...selector].every(([planeId, side]) => keySelector.get(planeId) === side)) removed.add(key);
    }
  }
  return [...removed];
}
