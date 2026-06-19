function referencePlaneIdList(referencePlaneIds) {
  if (!Array.isArray(referencePlaneIds) || !referencePlaneIds.length || referencePlaneIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("trim region keys: referencePlaneIds must be a non-empty array of non-empty strings");
  }
  const seen = new Set();
  for (const id of referencePlaneIds) {
    if (seen.has(id)) throw new Error(`trim region keys: duplicate reference plane id ${id}`);
    seen.add(id);
  }
  return referencePlaneIds;
}

export function planeTrimRegionKeys(referencePlaneIds) {
  const planeIds = referencePlaneIdList(referencePlaneIds);
  const keys = [];
  const walk = (index, parts) => {
    if (index >= planeIds.length) {
      keys.push(parts.map(({ planeId, side }) => `${planeId}:${side}`).join("|"));
      return;
    }
    const planeId = planeIds[index];
    walk(index + 1, [...parts, { planeId, side: "-" }]);
    walk(index + 1, [...parts, { planeId, side: "+" }]);
  };
  walk(0, []);
  return keys;
}

export function defaultPlaneTrimRemovedRegionKeys(referencePlaneIds) {
  return planeTrimRegionKeys(referencePlaneIds).filter((key) => key.split("|").some((part) => part.endsWith(":-")));
}

export function trimRegionSelectorMap(regionKeyValue) {
  const map = new Map();
  if (typeof regionKeyValue !== "string" || !regionKeyValue.trim()) throw new Error("trim region keys: region key must be a non-empty string");
  for (const part of regionKeyValue.split("|")) {
    const index = part.lastIndexOf(":");
    if (index <= 0) throw new Error(`trim region keys: invalid region part ${part}`);
    const planeId = part.slice(0, index);
    const side = part.slice(index + 1);
    if (!planeId.trim() || (side !== "+" && side !== "-")) throw new Error(`trim region keys: invalid region part ${part}`);
    if (map.has(planeId)) throw new Error(`trim region keys: duplicate region selector for ${planeId}`);
    map.set(planeId, side);
  }
  return map;
}

export function reconcilePlaneTrimRemovedRegionKeys(operation, referencePlaneIds) {
  if (operation !== undefined && (!operation || typeof operation !== "object" || Array.isArray(operation))) {
    throw new Error("trim region keys: operation must be an object");
  }
  const ids = new Set(referencePlaneIdList(referencePlaneIds));
  const keys = planeTrimRegionKeys([...ids]);
  const removed = new Set();
  const removedRegionKeys = operation?.removedRegionKeys === undefined ? [] : operation.removedRegionKeys;
  if (!Array.isArray(removedRegionKeys)) throw new Error("trim region keys: removedRegionKeys must be an array");
  for (const regionKeyValue of removedRegionKeys) {
    const selector = new Map([...trimRegionSelectorMap(regionKeyValue)].filter(([planeId]) => ids.has(planeId)));
    if (!selector.size) continue;
    for (const key of keys) {
      const keySelector = trimRegionSelectorMap(key);
      if ([...selector].every(([planeId, side]) => keySelector.get(planeId) === side)) removed.add(key);
    }
  }
  return [...removed];
}
