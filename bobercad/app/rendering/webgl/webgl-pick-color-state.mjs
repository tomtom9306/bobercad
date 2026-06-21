import { truthyValues } from "../../engine/core/model.mjs";

function pickObjectKey(item) {
  if (!item?.collection || !item?.objectId) return null;
  return truthyValues([
    item.collection,
    item.objectId,
    item.operationId ? `operation:${item.operationId}` : null,
    item.regionKey ? `region:${item.regionKey}` : null,
    item.referencePlaneId ? `plane:${item.referencePlaneId}` : null,
    item.componentKind ? `kind:${item.componentKind}` : null,
    item.positionIndex !== undefined ? `position:${item.positionIndex}` : null
  ]).join(":");
}

function encodePickColorId(id) {
  return [
    ((id >> 16) & 255) / 255,
    ((id >> 8) & 255) / 255,
    (id & 255) / 255,
    1
  ];
}

export function createWebglPickColorState() {
  let pickObjectByColorId = new Map();
  let pickColorIdByObjectKey = new Map();
  let nextPickColorId = 1;

  function reset() {
    pickObjectByColorId = new Map();
    pickColorIdByObjectKey = new Map();
    nextPickColorId = 1;
  }

  function colorForItem(item) {
    const key = pickObjectKey(item);
    if (!key) return [0, 0, 0, 1];
    let id = pickColorIdByObjectKey.get(key);
    if (!id) {
      id = nextPickColorId;
      nextPickColorId += 1;
      pickColorIdByObjectKey.set(key, id);
      pickObjectByColorId.set(id, {
        collection: item.collection,
        objectId: item.objectId,
        ...(item.memberId ? { memberId: item.memberId } : {}),
        ...(item.ownerMemberId ? { ownerMemberId: item.ownerMemberId } : {}),
        ...(item.operationId ? { operationId: item.operationId } : {}),
        ...(item.regionKey ? { regionKey: item.regionKey } : {}),
        ...(item.referencePlaneId ? { referencePlaneId: item.referencePlaneId } : {}),
        ...(item.componentKind ? { componentKind: item.componentKind } : {}),
        ...(item.positionIndex !== undefined ? { positionIndex: item.positionIndex } : {})
      });
    }
    return encodePickColorId(id);
  }

  function objectFromPixel(pixel) {
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    return id ? pickObjectByColorId.get(id) || null : null;
  }

  return {
    reset,
    colorForItem,
    objectFromPixel
  };
}
