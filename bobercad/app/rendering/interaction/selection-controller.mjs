function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function memberIdFromFace(face) {
  if (face?.collection === "members") return face.objectId;
  return face?.memberId || face?.ownerMemberId || null;
}

export function createSelectionController({ viewer }) {
  let selectedIds = [];
  let pickMode = null;

  function select(objectIds = []) {
    selectedIds = unique(objectIds);
    viewer.setHighlightedObjects(selectedIds);
    return selectedIds;
  }

  function cancelPick({ clear = true } = {}) {
    pickMode = null;
    viewer.setPickHandler(null);
    if (clear) select([]);
  }

  function beginObjectPick({ count = 1, objectIdFromFace, onPick, onComplete, onError }) {
    if (typeof objectIdFromFace !== "function") throw new Error("selection controller: objectIdFromFace is required");
    const picked = [];
    pickMode = { count, picked };
    select([]);
    viewer.setPickHandler((face) => {
      const objectId = objectIdFromFace(face);
      if (!objectId) {
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
    });
  }

  return {
    selectedIds() {
      return [...selectedIds];
    },

    select,

    clear() {
      return select([]);
    },

    cancelPick,

    beginObjectPick,

    beginMemberPick(options = {}) {
      beginObjectPick({ ...options, objectIdFromFace: options.objectIdFromFace || memberIdFromFace });
    },

    pickMode() {
      return pickMode ? { count: pickMode.count, picked: [...pickMode.picked] } : null;
    }
  };
}
