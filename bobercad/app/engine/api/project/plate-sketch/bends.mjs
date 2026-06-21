import { plateBends } from "./model-accessors.mjs";
import { bendDescendantIds, normalizeBend } from "./bend-normalization.mjs";
import { normalizePlate } from "./model-and-placement.mjs";
import { fail, optionalObject } from "./sketch-geometry-and-relations.mjs";

export function upsertPlateBend(plate, bendPatch) {
  const sketch = plate.sketch;
  const existingIds = new Set();
  for (const bend of plateBends(plate)) {
    if (typeof bend?.id !== "string" || !bend.id.trim()) fail("bend id must be a non-empty string");
    if (existingIds.has(bend.id)) fail(`duplicate bend id ${bend.id}`);
    existingIds.add(bend.id);
  }
  if (bendPatch?.id !== undefined) existingIds.add(bendPatch.id);
  const bend = normalizeBend(bendPatch, sketch, existingIds);
  const sameTarget = (item) => {
    if (bend.parentBendId || item.parentBendId) {
      return item.parentBendId === bend.parentBendId && item.parentEdge === bend.parentEdge;
    }
    return item.edgeId === bend.edgeId;
  };
  const existingBends = plateBends(plate);
  const replacedIds = existingBends
    .filter((item) => item.id !== bend.id && sameTarget(item))
    .map((item) => item.id);
  const removedIds = bendDescendantIds(existingBends, replacedIds);
  const bends = existingBends.filter((item) => item.id !== bend.id && !removedIds.has(item.id));
  bends.push(bend);
  return normalizePlate({
    ...plate,
    type: "bent-plate",
    fabrication: {
      ...optionalObject(plate.fabrication, {}, `${plate.id}.fabrication`),
      bends
    }
  });
}

export function removePlateBend(plate, bendId) {
  if (typeof bendId !== "string" || !bendId.trim()) fail("bend id must be a non-empty string");
  const existingBends = plateBends(plate);
  const seedIds = existingBends
    .filter((bend) => bend.id === bendId || bend.edgeId === bendId)
    .map((bend) => bend.id);
  if (!seedIds.length) fail(`${plate?.id || "plate"}: bend not found: ${bendId}`);
  const removedIds = bendDescendantIds(existingBends, seedIds);
  const bends = existingBends.filter((bend) => !removedIds.has(bend.id));
  return normalizePlate({
    ...plate,
    type: bends.length ? "bent-plate" : "plate",
    fabrication: {
      ...optionalObject(plate.fabrication, {}, `${plate.id}.fabrication`),
      bends
    }
  });
}
