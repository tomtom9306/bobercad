import { createProjectStore } from "../../engine/store/project-store.mjs";
import { clone, optionalPath, setPath } from "../../engine/modules/connections/connection-schema.mjs";
import { loadConnectionDefinitions } from "../../engine/modules/connections/connection-registry.mjs";
import { buildConnectionDimensions } from "../../rendering/annotations/build-dimensions.mjs";
import { buildScene } from "../../rendering/scene/build-scene.mjs";
import { createMemberEditController } from "../../rendering/interaction/member-edit-controller.mjs";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs";
import { createWebglViewer } from "../../rendering/webgl/webgl-renderer.mjs";
import { mountEditorUi } from "./panels/property-panel.mjs";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const objectEditor = document.getElementById("object-editor");
const libraryPanel = document.getElementById("library-panel");
const customPanel = document.getElementById("custom-panel");
const settingsUrl = new URL("./viewer-settings.json", import.meta.url);
let settings = null;
let viewer = null;

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function applyUiSettings(project) {
  hud.hidden = !settings.ui.showHud;
  meta.hidden = !settings.ui.showMeta;
  reset.hidden = !settings.ui.showResetButton;
  title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function projectPath() {
  const demo = new URLSearchParams(window.location.search).get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  meta.textContent = `${Object.keys(project.model.members).length} members\n${Object.keys(project.model.plates).length} plates\n${Object.keys(project.model.fastenerGroups).length} fastener groups`;
}

function renderProject(project, profiles, fasteners, options = {}) {
  viewer.setScene(buildScene(project, profiles, fasteners, settings), options);
  updateMeta(project);
}

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

function seedDimensionModeValue(definition, parameters, dimension, modePath, modeValue) {
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

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const [profiles, fasteners, connectionCatalog] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadConnectionDefinitions()]);

    viewer = createWebglViewer(canvas, reset, settings);
    applyUiSettings(project);

    const api = createProjectStore({ project, profiles: profiles.profiles, connectionCatalog, fasteners });
    const selection = createSelectionController({ viewer });
    let activeConnectionId = null;
    let activeDimensionPath = null;
    let activeDimensionId = null;
    let activeDimensionMode = null;
    let activeDimensionEditingLabel = false;
    const clearActiveDimension = () => {
      if (!activeDimensionPath && !activeDimensionId && !activeDimensionMode && !activeDimensionEditingLabel) return false;
      activeDimensionPath = null;
      activeDimensionId = null;
      activeDimensionMode = null;
      activeDimensionEditingLabel = false;
      renderDimensions();
      return true;
    };
    const renderDimensions = () => {
      const connection = activeConnectionId ? api.project().model.connections?.[activeConnectionId] : null;
      if (!connection) {
        viewer.setDimensionOverlay(null);
        return;
      }
      viewer.setDimensionOverlay(buildConnectionDimensions({
        project: api.project(),
        profiles: profiles.profiles,
        definition: api.definition(activeConnectionId),
        connectionId: activeConnectionId,
        activeParameterPath: activeDimensionPath,
        activeDimensionId,
        activeParameterMode: activeDimensionMode,
        activeParameterEditing: activeDimensionEditingLabel,
        dimensionSettings: settings.render.dimensions
      }));
    };
    const rerender = (nextProject) => {
      renderProject(nextProject, profiles, fasteners, { preserveCamera: true });
      renderDimensions();
    };
    let editorApi = null;
    const memberEdit = createMemberEditController({
      viewer,
      api,
      selection,
      onProjectChange: rerender,
      onMemberSelected: (memberId) => editorApi?.selectMember(memberId, { fromMemberEdit: true }),
      onCleared: () => editorApi?.clearSelection({ fromMemberEdit: true })
    });
    viewer.setClickHandler((face) => {
      if (!face) clearActiveDimension();
      memberEdit.handleSceneClick(face);
    });
    const showConnectionEditor = (connectionId, options = {}) => {
      activeConnectionId = connectionId;
      activeDimensionPath = options.focusPath || null;
      activeDimensionId = options.focusDimensionId || null;
      activeDimensionMode = activeDimensionPath ? options.focusMode || "select" : null;
      activeDimensionEditingLabel = Boolean(activeDimensionPath && options.focusLabel);
      const definition = api.definition(connectionId);
      definition.customUi.mountConnectionUi({
        panel: customPanel,
        definition,
        connectionId,
        api,
        focusPath: activeDimensionPath,
        focusMode: activeDimensionMode,
        focusInput: !options.focusLabel,
        onPanelFocus: () => {
          if (!activeDimensionEditingLabel) return;
          activeDimensionEditingLabel = false;
          activeDimensionId = null;
          renderDimensions();
        },
        onProjectChange: rerender,
        onConnectionDeleted: () => {
          activeConnectionId = null;
          activeDimensionPath = null;
          activeDimensionId = null;
          activeDimensionMode = null;
          activeDimensionEditingLabel = false;
          viewer.setDimensionOverlay(null);
          customPanel.hidden = true;
          memberEdit.clear({ notify: false });
          selection.clear();
        }
      });
      renderDimensions();
    };
    viewer.setDimensionClickHandler((dimension) => {
      const sameDimension = activeConnectionId === dimension.connectionId && activeDimensionId === dimension.dimensionId;
      const nextFocusMode = sameDimension && activeDimensionMode === "cursor" ? "select" : sameDimension ? "cursor" : "select";
      editorApi?.selectConnection(dimension.connectionId, {
        focusPath: dimension.parameter,
        focusDimensionId: dimension.dimensionId,
        focusMode: nextFocusMode,
        focusLabel: true
      });
    });
    viewer.setDimensionModeHandler((dimension, path, value) => {
      try {
        const definition = api.definition(dimension.connectionId);
        const spec = definition.parameters[path];
        if (!spec) return false;
        const parameters = clone(api.connection(dimension.connectionId).referenceParameters);
        let changed = writeParameter(parameters, definition, path, value);
        changed = seedDimensionModeValue(definition, parameters, dimension, path, value) || changed;
        if (changed) {
          const nextProject = api.updateConnection(dimension.connectionId, parameters);
          editorApi?.selectConnection(dimension.connectionId, {
            focusPath: dimension.parameter,
            focusDimensionId: dimension.dimensionId,
            focusMode: activeDimensionMode || "select",
            focusLabel: true
          });
          rerender(nextProject);
          return true;
        }
        editorApi?.selectConnection(dimension.connectionId, {
          focusPath: dimension.parameter,
          focusDimensionId: dimension.dimensionId,
          focusMode: activeDimensionMode || "select",
          focusLabel: true
        });
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });
    viewer.setDimensionCancelHandler(() => {
      clearActiveDimension();
    });
    viewer.setDimensionRepairHandler((dimension) => {
      try {
        const nextProject = api.resolveConnectionDiagnostics(dimension.connectionId);
        showConnectionEditor(dimension.connectionId);
        rerender(nextProject);
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });
    viewer.setDimensionValueHandler((dimension, value) => {
      try {
        const definition = api.definition(dimension.connectionId);
        const spec = definition.parameters[dimension.parameter];
        if (!spec) return false;
        const parameters = clone(api.connection(dimension.connectionId).referenceParameters);
        for (const [path, nextValue] of Object.entries(dimension.editOnCommit || {})) {
          if (definition.parameters[path]) setPath(parameters, definition.parameters[path].writePath || path, nextValue, definition.type);
        }
        if (dimension.editKind === "positiveIntegerPair") {
          const firstPath = dimension.editPaths?.first;
          const secondPath = dimension.editPaths?.second;
          if (!firstPath || !secondPath || !Number.isInteger(value?.first) || !Number.isInteger(value?.second)) return false;
          if (!definition.parameters[firstPath] || !definition.parameters[secondPath]) return false;
          setPath(parameters, definition.parameters[firstPath].writePath || firstPath, value.first, definition.type);
          setPath(parameters, definition.parameters[secondPath].writePath || secondPath, value.second, definition.type);
        } else if (dimension.editKind === "numberListItem") {
          if (!dimension.editPath || !Number.isInteger(dimension.editIndex) || typeof value !== "number" || !Number.isFinite(value)) return false;
          const nextValues = Array.isArray(dimension.editValues) ? [...dimension.editValues] : [];
          while (nextValues.length <= dimension.editIndex) nextValues.push(0);
          nextValues[dimension.editIndex] = value;
          setPath(parameters, dimension.editPath, nextValues, definition.type);
        } else if (dimension.editKind === "offsetNumber") {
          if (typeof value !== "number" || !Number.isFinite(value)) return false;
          setPath(parameters, spec.writePath || dimension.parameter, value * (dimension.editValueScale ?? 1) + (dimension.editValueOffset || 0), definition.type);
        } else {
          setPath(parameters, spec.writePath || dimension.parameter, value, definition.type);
        }
        const nextProject = api.updateConnection(dimension.connectionId, parameters);
        showConnectionEditor(dimension.connectionId);
        rerender(nextProject);
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (clearActiveDimension()) event.preventDefault();
    }, { capture: true });

    renderProject(api.project(), profiles, fasteners);
    connectionCatalog.customUi.mountConnectionLibraryUi({
      panel: libraryPanel,
      api,
      selection,
      onProjectChange: rerender,
      onConnectionCreated: showConnectionEditor
    });
    editorApi = mountEditorUi({
      panel: objectEditor,
      api,
      profiles: profiles.profiles,
      selection,
      memberEdit,
      onProjectChange: rerender,
      onConnectionSelected: showConnectionEditor,
      onConnectionDeleted: () => {
        customPanel.hidden = true;
      }
    });

    const connection = api.supportedConnections()[0];
    if (connection) {
      showConnectionEditor(connection.id);
    } else {
      customPanel.hidden = true;
    }

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", () => viewer?.resize());
main();
