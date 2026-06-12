import { uniqueTruthy as unique } from "../../engine/core/model.mjs?v=unique-dry-1";
import { createSnapSelectionManager } from "./snap-selection-manager.mjs?v=unified-snap-manager-10";

function memberIdFromFace(face) {
  if (face?.collection === "members") return face.objectId;
  return face?.memberId || face?.ownerMemberId || null;
}

function objectIdsForCollections(project, collections = []) {
  const wanted = new Set(collections.filter(Boolean));
  if (!project || !wanted.size) return null;
  return Object.entries(project.objectIndex || {})
    .filter(([, entry]) => wanted.has(entry?.collection))
    .map(([objectId]) => objectId);
}

function objectIdsForScope(project, scopeManager) {
  if (!project?.objectIndex) return null;
  return Object.entries(project.objectIndex)
    .filter(([objectId, entry]) => scopeManager.objectAllowed(project, objectId, entry?.collection, { ignoreSelectedObjectsOnly: true }))
    .map(([objectId]) => objectId);
}

export function createSelectionController({ viewer, settings = {}, project = null }) {
  const scopeManager = createSnapSelectionManager({ viewer, settings });
  let pickMode = null;

  function select(objectIds = []) {
    return scopeManager.setSelected(unique(objectIds));
  }

  function cancelPick({ clear = true } = {}) {
    pickMode = null;
    viewer.setPickHandler(null);
    if (clear) select([]);
  }

  function beginObjectPick({ count = 1, objectIdFromFace, collection = null, collections = [], objectIds = null, componentKind = null, onPick, onComplete, onError }) {
    if (typeof objectIdFromFace !== "function") throw new Error("selection controller: objectIdFromFace is required");
    const picked = [];
    const activeProject = typeof project === "function" ? project() : project;
    const collectionFilter = collection ? [collection, ...collections] : collections;
    const scopedObjectIds = objectIds || objectIdsForCollections(activeProject, collectionFilter) || objectIdsForScope(activeProject, scopeManager);
    const pickOptions = scopeManager.pickOptions(activeProject, {
      ...(scopedObjectIds ? { objectIds: scopedObjectIds } : {}),
      ...(componentKind ? { componentKind } : {})
    });
    pickMode = { count, picked };
    select([]);
    viewer.setPickHandler((face) => {
      const objectId = objectIdFromFace(face);
      const currentProject = typeof project === "function" ? project() : project;
      if (!objectId || !scopeManager.objectAllowed(currentProject, objectId, face?.collection, { ignoreSelectedObjectsOnly: true })) {
        onError?.("Pick a valid object.");
        return;
      }
      if (picked.includes(objectId)) {
        onError?.("Pick a different object.");
        return;
      }
      picked.push(objectId);
      select(picked);
      onPick?.([...picked]);
      if (picked.length >= count) {
        cancelPick({ clear: false });
        onComplete?.([...picked]);
      }
    }, pickOptions);
  }

  return {
    selectedIds() {
      return scopeManager.selectedIds();
    },

    select,

    clear() {
      return select([]);
    },

    cancelPick,

    beginObjectPick,

    beginMemberPick(options = {}) {
      beginObjectPick({ ...options, collection: "members", objectIdFromFace: options.objectIdFromFace || memberIdFromFace });
    },

    scope: scopeManager.scope,

    setScope: scopeManager.setScope,

    setActiveSmartComponent: scopeManager.setActiveSmartComponent,

    objectAllowed: scopeManager.objectAllowed,

    candidateAllowed: scopeManager.candidateAllowed,

    pickMode() {
      return pickMode ? { count: pickMode.count, picked: [...pickMode.picked] } : null;
    }
  };
}
