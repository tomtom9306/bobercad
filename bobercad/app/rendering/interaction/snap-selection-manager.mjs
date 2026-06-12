import { uniqueTruthy } from "../../engine/core/model.mjs?v=unique-dry-1";

export const DEFAULT_SNAP_SCOPE = Object.freeze({
  members: true,
  plates: true,
  fasteners: true,
  welds: false,
  features: true,
  trimJoints: false,
  workPoints: true,
  referencePlanes: true,
  grids: true,
  activeSketch: true,
  constructionGuides: true,
  currentSmartComponentOnly: false,
  selectedObjectsOnly: false
});

const COLLECTION_SCOPE = Object.freeze({
  members: "members",
  plates: "plates",
  fastenerGroups: "fasteners",
  welds: "welds",
  features: "features",
  trimJoints: "trimJoints",
  workPoints: "workPoints",
  referencePlanes: "referencePlanes",
  gridSystems: "grids"
});

function normalizeScope(raw = {}) {
  return {
    ...DEFAULT_SNAP_SCOPE,
    ...Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Boolean(value)]))
  };
}

function collectionScopeKey(collection) {
  return COLLECTION_SCOPE[collection] || collection || null;
}

function collectIdValues(value, ids = []) {
  if (typeof value === "string" && value) {
    ids.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectIdValues(item, ids);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectIdValues(item, ids);
  }
  return ids;
}

function smartComponentObjectIds(project, smartComponentId) {
  if (!project || !smartComponentId) return new Set();
  const instances = project.model?.smartComponentInstances || {};
  const instance = instances[smartComponentId];
  if (!instance) return new Set();
  const ids = new Set(uniqueTruthy([
    ...Object.values(project.objectIndex || {})
      .filter((entry) => entry.sourceComponentId === smartComponentId || entry.smartComponentId === smartComponentId)
      .map((entry) => entry.id || entry.objectId),
    ...Object.keys(project.objectIndex || {}).filter((objectId) => {
      const entry = project.objectIndex?.[objectId];
      return entry?.sourceComponentId === smartComponentId || entry?.smartComponentId === smartComponentId;
    })
  ]));
  const visited = new Set();
  const visit = (instanceId) => {
    if (visited.has(instanceId)) return;
    visited.add(instanceId);
    const current = instances[instanceId];
    if (!current) return;
    for (const objectId of uniqueTruthy([
      ...collectIdValues(current.ownedObjectIds),
      ...collectIdValues(current.objectRoles),
      ...collectIdValues(current.childComponentRoles)
    ])) {
      if (instances[objectId]) {
        visit(objectId);
      } else {
        ids.add(objectId);
      }
    }
  };
  visit(smartComponentId);
  return ids;
}

export function createSnapSelectionManager({ settings = {}, viewer = null } = {}) {
  let selectedIds = [];
  let scope = normalizeScope(settings.authoring?.snap?.scope);
  let activeSmartComponentId = null;

  function setSelected(objectIds = []) {
    selectedIds = uniqueTruthy(objectIds);
    viewer?.setHighlightedObjects?.(selectedIds);
    return selectedIds;
  }

  function setScope(patch = {}) {
    scope = normalizeScope({ ...scope, ...patch });
    return { ...scope };
  }

  function setActiveSmartComponent(smartComponentId = null) {
    activeSmartComponentId = smartComponentId || null;
  }

  function scopeState() {
    return {
      ...scope,
      selectedObjectIds: [...selectedIds],
      activeSmartComponentId
    };
  }

  function objectAllowed(project, objectId, collection = null, options = {}) {
    if (!objectId && !collection) return true;
    const entry = objectId ? project?.objectIndex?.[objectId] : null;
    const resolvedCollection = collection || entry?.collection || null;
    const key = collectionScopeKey(resolvedCollection);
    if (key && scope[key] === false) return false;
    if (!options.ignoreSelectedObjectsOnly && scope.selectedObjectsOnly && objectId && !selectedIds.includes(objectId)) return false;
    const smartId = options.smartComponentId || activeSmartComponentId;
    if (scope.currentSmartComponentOnly && smartId && objectId) {
      const allowedIds = smartComponentObjectIds(project, smartId);
      if (allowedIds.size && !allowedIds.has(objectId)) return false;
    }
    return true;
  }

  function candidateAllowed(project, candidate, options = {}) {
    if (!candidate) return false;
    const providerId = candidate.providerId || "";
    if (providerId.startsWith("construction.") && !scope.constructionGuides) return false;
    if (providerId.startsWith("sketch.") && !scope.activeSketch) return false;
    if (providerId === "precision.adaptiveGrid" && options.grid !== false) return scope.constructionGuides !== false;
    if (candidate.type?.startsWith("grid-") && !scope.grids) return false;
    if (candidate.type?.startsWith("reference-plane") && !scope.referencePlanes) return false;
    if (candidate.type === "work-point" && !scope.workPoints) return false;
    const collection = candidate.target?.collection || candidate.collection || null;
    const objectId = candidate.target?.objectId || candidate.objectId || null;
    return objectAllowed(project, objectId, collection, options);
  }

  function pickOptions(project, options = {}) {
    const objectIds = options.objectIds || null;
    if (objectIds) {
      return {
        ...options,
        objectIds: objectIds.filter((objectId) => objectAllowed(project, objectId, null, { ignoreSelectedObjectsOnly: true }))
      };
    }
    return options;
  }

  return {
    selectedIds: () => [...selectedIds],
    setSelected,
    clearSelected: () => setSelected([]),
    scope: scopeState,
    setScope,
    setActiveSmartComponent,
    objectAllowed,
    candidateAllowed,
    pickOptions
  };
}

export function snapScopeFromSettings(settings = {}) {
  return normalizeScope(settings.authoring?.snap?.scope);
}
