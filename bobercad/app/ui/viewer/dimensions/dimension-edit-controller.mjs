import { clone, optionalPath, setPath } from "../../../engine/modules/connections/connection-schema.mjs";
import { buildConnectionDimensions } from "../../../rendering/annotations/build-dimensions.mjs";

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cloneIfObject(value) {
  return value && typeof value === "object" ? clone(value) : value;
}

function writeParameter(parameters, definition, path, value) {
  const spec = definition.parameters[path];
  if (!spec) return false;
  const writePath = spec.writePath || path;
  const nextValue = cloneIfObject(value);
  const changed = !sameValue(optionalPath(parameters, writePath), nextValue);
  setPath(parameters, writePath, nextValue, definition.type);
  return changed;
}

function storedDimensionValue(dimension, value = dimension.dimensionValue) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (dimension.editKind === "offsetNumber") {
    return value * (dimension.editValueScale ?? 1) + (dimension.editValueOffset || 0);
  }
  return value;
}

function seedModeValue(definition, parameters, dimension, modePath, modeValue) {
  let changed = false;
  const seeds = [
    dimension.modeSeed,
    ...(Array.isArray(dimension.modeSeeds) ? dimension.modeSeeds : [])
  ].filter(Boolean);
  const appliedSeedPaths = new Set();
  for (const seed of seeds) {
    if (!seed?.path || (seed.when && seed.when !== modeValue)) continue;
    changed = writeParameter(parameters, definition, seed.path, seed.value) || changed;
    appliedSeedPaths.add(seed.path);
  }
  if (modeValue !== "custom") return changed;
  if (!dimension.parameter || dimension.parameter === modePath || appliedSeedPaths.has(dimension.parameter)) return changed;
  if (dimension.editKind === "numberListItem") {
    if (dimension.editPath && Array.isArray(dimension.editValues)) {
      changed = writeParameter(parameters, definition, dimension.editPath, dimension.editValues) || changed;
    }
    return changed;
  }
  const value = storedDimensionValue(dimension);
  if (value !== null) changed = writeParameter(parameters, definition, dimension.parameter, value) || changed;
  return changed;
}

function applyDimensionValue(parameters, definition, dimension, value) {
  const spec = definition.parameters[dimension.parameter];
  if (!spec) return false;
  for (const [path, nextValue] of Object.entries(dimension.editOnCommit || {})) {
    const commitSpec = definition.parameters[path];
    if (commitSpec) setPath(parameters, commitSpec.writePath || path, nextValue, definition.type);
  }
  if (dimension.editKind === "positiveIntegerPair") {
    const firstPath = dimension.editPaths?.first;
    const secondPath = dimension.editPaths?.second;
    const firstSpec = definition.parameters[firstPath];
    const secondSpec = definition.parameters[secondPath];
    if (!firstSpec || !secondSpec || !Number.isInteger(value?.first) || !Number.isInteger(value?.second)) return false;
    setPath(parameters, firstSpec.writePath || firstPath, value.first, definition.type);
    setPath(parameters, secondSpec.writePath || secondPath, value.second, definition.type);
    return true;
  }
  if (dimension.editKind === "numberListItem") {
    if (!dimension.editPath || !Number.isInteger(dimension.editIndex) || typeof value !== "number" || !Number.isFinite(value)) return false;
    const nextValues = Array.isArray(dimension.editValues) ? [...dimension.editValues] : [];
    while (nextValues.length <= dimension.editIndex) nextValues.push(0);
    nextValues[dimension.editIndex] = value;
    setPath(parameters, dimension.editPath, nextValues, definition.type);
    return true;
  }
  if (dimension.editKind === "offsetNumber") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    setPath(parameters, spec.writePath || dimension.parameter, storedDimensionValue(dimension, value), definition.type);
    return true;
  }
  setPath(parameters, spec.writePath || dimension.parameter, value, definition.type);
  return true;
}

export function createDimensionEditController({ viewer, api, profiles, settings, getEditorApi, onProjectChange, openConnectionEditor }) {
  let connectionId = null;
  let path = null;
  let dimensionId = null;
  let mode = null;
  let editingLabel = false;

  function focus() {
    return { connectionId, path, dimensionId, mode, editingLabel };
  }

  function clearDimension({ render = true } = {}) {
    if (!path && !dimensionId && !mode && !editingLabel) return false;
    path = null;
    dimensionId = null;
    mode = null;
    editingLabel = false;
    if (render) renderDimensions();
    return true;
  }

  function clearAll() {
    connectionId = null;
    clearDimension({ render: false });
    viewer.setDimensionOverlay(null);
  }

  function selectConnection(nextConnectionId, options = {}) {
    connectionId = nextConnectionId;
    path = options.focusPath || null;
    dimensionId = options.focusDimensionId || null;
    mode = path ? options.focusMode || "select" : null;
    editingLabel = Boolean(path && options.focusLabel);
    return focus();
  }

  function stopLabelEdit() {
    if (!editingLabel) return false;
    editingLabel = false;
    dimensionId = null;
    renderDimensions();
    return true;
  }

  function renderDimensions() {
    const connection = connectionId ? api.project().model.connections?.[connectionId] : null;
    if (!connection) {
      viewer.setDimensionOverlay(null);
      return;
    }
    viewer.setDimensionOverlay(buildConnectionDimensions({
      project: api.project(),
      profiles,
      definition: api.definition(connectionId),
      connectionId,
      activeParameterPath: path,
      activeDimensionId: dimensionId,
      activeParameterMode: mode,
      activeParameterEditing: editingLabel,
      dimensionSettings: settings.render.dimensions
    }));
  }

  function refocusDimension(dimension) {
    getEditorApi()?.selectConnection(dimension.connectionId, {
      focusPath: dimension.parameter,
      focusDimensionId: dimension.dimensionId,
      focusMode: mode || "select",
      focusLabel: true
    });
  }

  function wireViewer() {
    viewer.setDimensionClickHandler((dimension) => {
      const sameDimension = connectionId === dimension.connectionId && dimensionId === dimension.dimensionId;
      const nextMode = sameDimension && mode === "cursor" ? "select" : sameDimension ? "cursor" : "select";
      getEditorApi()?.selectConnection(dimension.connectionId, {
        focusPath: dimension.parameter,
        focusDimensionId: dimension.dimensionId,
        focusMode: nextMode,
        focusLabel: true
      });
    });

    viewer.setDimensionModeHandler((dimension, modePath, modeValue) => {
      try {
        const definition = api.definition(dimension.connectionId);
        if (!definition.parameters[modePath]) return false;
        const parameters = clone(api.connection(dimension.connectionId).referenceParameters);
        let changed = writeParameter(parameters, definition, modePath, modeValue);
        changed = seedModeValue(definition, parameters, dimension, modePath, modeValue) || changed;
        refocusDimension(dimension);
        if (changed) onProjectChange(api.updateConnection(dimension.connectionId, parameters));
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });

    viewer.setDimensionCancelHandler(() => {
      clearDimension();
    });

    viewer.setDimensionRepairHandler((dimension) => {
      try {
        const nextProject = api.resolveConnectionDiagnostics(dimension.connectionId);
        openConnectionEditor(dimension.connectionId);
        onProjectChange(nextProject);
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });

    viewer.setDimensionValueHandler((dimension, value) => {
      try {
        const definition = api.definition(dimension.connectionId);
        const parameters = clone(api.connection(dimension.connectionId).referenceParameters);
        if (!applyDimensionValue(parameters, definition, dimension, value)) return false;
        const nextProject = api.updateConnection(dimension.connectionId, parameters);
        openConnectionEditor(dimension.connectionId);
        onProjectChange(nextProject);
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });
  }

  wireViewer();

  return {
    connectionId: () => connectionId,
    focus,
    selectConnection,
    clearDimension,
    clearAll,
    stopLabelEdit,
    render: renderDimensions
  };
}
