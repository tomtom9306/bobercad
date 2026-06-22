import {
  DATA_DOCK_COMMAND_LABEL,
  DATA_DOCK_PANEL_ID,
  DATA_DOCK_TABS
} from "../commands/data-dock-metadata.mjs";
import { leftDockResultSpecs, validLeftDockResultAction } from "../commands/left-dock-result-metadata.mjs";
import {
  INSPECTOR_CONTEXTS,
  INSPECTOR_PANEL_ID,
  INSPECTOR_PANEL_LABEL,
  inspectorContextLabel
} from "../commands/inspector-dock-metadata.mjs";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength, snapScopeMode, snapScopeModeLabel, snapTargetLabel } from "../commands/snap-metadata.mjs";
import { DISPLAY_MODE_SPECS, VIEW_ORIENTATION_SPECS, activeViewOrientation, displayModeLabel, normalizeDisplayMode, normalizeViewOrientation, normalizeViewOrientationState, viewOrientationLabel } from "../commands/view-metadata.mjs";
import { createViewerCommandItems, createViewerPanelCommandActions } from "./viewer-command-adapter.mjs";

const MODELING_COMMAND_ID_BY_TYPE = {
  beam: "model.beam.create",
  column: "model.column.create",
  plate: "model.plate.create",
  sketch: "model.sketch.create",
  workPlane: "model.workPlane.set",
  plateBend: "model.plateBend.add",
  trim: "model.trim.create"
};
const MODELING_COMMANDS_WITH_SIDE_DOCK_EDITOR = new Set(["trim"]);
const RENDER_VISIBILITY_LABELS = {
  cuttingObjects: "Cutting objects",
  fasteners: "Fasteners",
  grids: "Grids",
  referencePlanes: "Planes"
};

export function createViewerCommandRegistration({
  settings,
  viewer,
  viewerApp,
  api,
  selection,
  smartComponentCatalog,
  toolbar = null,
  workspaceBindings,
  getStatusBar = () => null,
  getModelingUi = () => null,
  getViewerSettingsUi = () => null,
  getNavCubeUi = () => null,
  getCommandController = () => null,
  getTrimCreate = () => null,
  getDimensionEdit = () => null,
  getEditorApi = () => null,
  getMemberEdit = () => null,
  getTrimJointEditorApi = () => null,
  getPlateSketchEdit = () => null,
  getModelBrowserUi = () => null,
  getProjectFilesPanelUi = () => null,
  getProjectDataPanelUi = () => null,
  getSmartComponentBrowserUi = () => null,
  getConnectionComponentBrowserUi = () => null,
  projectDataSources = () => [],
  clearAuxiliaryEditors = () => {},
  clearMemberEditSilently = () => {},
  refreshSelectionSurfaces = () => {},
  refreshStatusBar = () => {},
  rerender = () => {},
  updateModelingStatus = () => {}
} = {}) {
  let activeCommandId = null;
  let displayMode = normalizeDisplayMode(settings.render?.displayMode);
  let viewOrientation = normalizeViewOrientationState(viewer.viewOrientation?.() || "iso");
  let autoRelationsEnabled = settings.authoring?.autoAxisRelations !== false;

  function refreshWorkspaceCommandState() {
    workspaceBindings?.refreshCommandState?.();
  }

  function snapStrengthValue() {
    return normalizeSnapStrength(settings.authoring?.snap?.strength);
  }

  function setSnapStrengthCommand(value) {
    const strength = normalizeSnapStrength(value);
    settings.authoring = settings.authoring || {};
    settings.authoring.snap = settings.authoring.snap || {};
    settings.authoring.snap.strength = strength;
    getModelingUi()?.setSnapStrength?.(strength);
    refreshStatusBar({ snapStrength: strength });
    updateModelingStatus(`Snap strength: ${strength}`);
    refreshWorkspaceCommandState();
    return strength;
  }

  function setSnapScopeCommand(patch = {}) {
    const nextSnap = viewerApp.setSnapSettings({ scope: patch });
    const scope = nextSnap?.scope || selection.scope?.() || {};
    getModelingUi()?.setSnapScope?.(scope);
    refreshStatusBar({ snapScope: scope });
    refreshWorkspaceCommandState();
    return scope;
  }

  function snapScopeCommandState(command) {
    if (!command.snapScopeMode) return {};
    const scope = selection.scope?.() || {};
    const mode = command.snapScopeMode;
    const selectedCount = Array.isArray(scope.selectedObjectIds) ? scope.selectedObjectIds.length : 0;
    const enabled = mode === "selected"
      ? selectedCount > 0
      : mode === "component"
        ? Boolean(scope.activeSmartComponentId)
        : true;
    const active = snapScopeMode(scope) === mode;
    return {
      active,
      enabled,
      disabledReason: enabled
        ? ""
        : mode === "selected"
          ? "Select an object before using selected-only scope."
          : "Select a Smart Component before using component scope.",
      description: active
        ? `${snapScopeModeLabel(mode)} selection scope is active.`
        : command.description
    };
  }

  function setSnapScopeModeCommand(command) {
    const state = snapScopeCommandState(command);
    if (state.enabled === false) {
      updateModelingStatus(state.disabledReason);
      return false;
    }
    const scope = setSnapScopeCommand(command.snapScopePatch || {});
    updateModelingStatus(`Selection scope: ${snapScopeModeLabel(command.snapScopeMode)}`);
    return scope;
  }

  function snapTargetCommandState(command) {
    if (!command.snapTarget) return {};
    const scope = selection.scope?.() || {};
    const enabled = scope[command.snapTarget] !== false;
    const label = snapTargetLabel(command.snapTarget);
    return {
      active: enabled,
      title: enabled ? `Disable ${label} snap` : `Enable ${label} snap`,
      description: enabled
        ? `${label} snap target is enabled.`
        : `${label} snap target is disabled.`
    };
  }

  function toggleSnapTargetCommand(command) {
    const key = command.snapTarget;
    if (!key) return false;
    const scope = selection.scope?.() || {};
    const enabled = !(scope[key] !== false);
    const nextScope = setSnapScopeCommand({ [key]: enabled });
    updateModelingStatus(snapScopeStatus({ key, label: snapTargetLabel(key), enabled }, nextScope));
    return nextScope;
  }

  function snapScopeStatus(meta = {}, scope = {}) {
    if (meta?.source === "scopeMode") return `Selection scope: ${meta.label || "All"}`;
    const label = meta?.label || meta?.key || "Target";
    const enabled = typeof meta?.enabled === "boolean" ? meta.enabled : scope[meta?.key] !== false;
    return `${label} snap ${enabled ? "enabled" : "disabled"}`;
  }

  function snapStrengthCommandState(command) {
    if (!command.id?.startsWith("settings.snapStrength.")) return {};
    const strength = normalizeSnapStrength(command.snapStrength || command.id.replace("settings.snapStrength.", ""));
    const active = snapStrengthValue() === strength;
    return {
      active,
      description: active
        ? `${command.label || command.title || strength} is active.`
        : command.description
    };
  }

  function setDisplayModeCommand(mode) {
    displayMode = normalizeDisplayMode(mode);
    settings.render = settings.render || {};
    settings.render.displayMode = displayMode;
    viewer.setDisplayMode?.(displayMode);
    getViewerSettingsUi()?.setDisplayMode?.(displayMode);
    updateModelingStatus(`Display mode: ${displayModeLabel(displayMode)}`);
    refreshWorkspaceCommandState();
    return displayMode;
  }

  function displayModeCommandState(command) {
    if (!command.id?.startsWith("view.displayMode.")) return {};
    const mode = normalizeDisplayMode(command.displayMode || command.id.replace("view.displayMode.", ""));
    const active = displayMode === mode;
    return {
      active,
      description: active
        ? `${command.label || command.title || mode} display mode is active.`
        : command.description
    };
  }

  function renderVisibilitySettings() {
    settings.render = settings.render || {};
    settings.render.visibility = settings.render.visibility || {};
    return settings.render.visibility;
  }

  function renderVisibilityEnabled(key) {
    return renderVisibilitySettings()[key] !== false;
  }

  function renderVisibilityLabel(key) {
    return RENDER_VISIBILITY_LABELS[key] || "Scene helpers";
  }

  function toggleRenderVisibilityCommand(key) {
    const nextVisible = !renderVisibilityEnabled(key);
    renderVisibilitySettings()[key] = nextVisible;
    rerender(api.project());
    updateModelingStatus(`${renderVisibilityLabel(key)} ${nextVisible ? "shown" : "hidden"}.`);
    refreshWorkspaceCommandState();
    return nextVisible;
  }

  function renderVisibilityCommandState(command) {
    if (!command.renderVisibilityKey) return {};
    const active = renderVisibilityEnabled(command.renderVisibilityKey);
    const label = command.label || renderVisibilityLabel(command.renderVisibilityKey);
    return {
      active,
      description: active
        ? `${label} are visible.`
        : `${label} are hidden.`
    };
  }

  function syncCameraSurfaces(state = viewer.viewCamera?.()) {
    if (!state) return;
    const previousActiveOrientation = activeViewOrientation(viewOrientation);
    viewOrientation = normalizeViewOrientationState(state.orientation);
    getNavCubeUi()?.setCameraState?.({ ...state, orientation: viewOrientation });
    getViewerSettingsUi()?.setOrientation?.(viewOrientation);
    if (previousActiveOrientation !== activeViewOrientation(viewOrientation)) refreshWorkspaceCommandState();
  }

  function setViewOrientationCommand(orientation) {
    const requestedOrientation = normalizeViewOrientation(orientation);
    const applied = viewer.setViewOrientation?.(requestedOrientation) !== false;
    syncCameraSurfaces(viewer.viewCamera?.());
    updateModelingStatus(applied ? `View: ${viewOrientationLabel(requestedOrientation)}` : "View orientation unavailable.");
    return applied ? requestedOrientation : false;
  }

  function viewOrientationCommandState(command) {
    if (!command.id?.startsWith("view.orientation.")) return {};
    const orientation = normalizeViewOrientation(command.viewOrientation || command.id.replace("view.orientation.", ""));
    const active = activeViewOrientation(viewOrientation) === orientation;
    return {
      active,
      description: active
        ? `${command.label || command.title || orientation} is active.`
        : command.description
    };
  }

  function relationCommandState() {
    const active = getPlateSketchEdit()?.activeState?.();
    const selected = getEditorApi()?.selectedState?.();
    const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
    const visible = available && active.sketchMode === "relations";
    if (available) {
      return {
        available,
        active: visible,
        title: visible ? "Hide plate sketch relations" : "Show plate sketch relations",
        description: visible
          ? "Hide relation helpers for the selected plate sketch."
          : "Show relation helpers for the selected plate sketch."
      };
    }
    return {
      available: false,
      active: Boolean(autoRelationsEnabled),
      title: "Toggle automatic axis relations",
      description: autoRelationsEnabled
        ? "Automatic axis relations are on."
        : "Automatic axis relations are off."
    };
  }

  function relationCommandPaletteState(command) {
    if (command.id !== "settings.relations.toggle") return {};
    const state = relationCommandState();
    return {
      active: state.active,
      title: state.title,
      description: state.description
    };
  }

  function panelCommandState(command) {
    const panel = command.id === "panel.library.toggle"
      ? { label: DATA_DOCK_COMMAND_LABEL, visible: workspaceBindings?.dataDockVisible?.() }
      : command.id === "panel.inspector.toggle"
        ? { label: INSPECTOR_PANEL_LABEL, visible: workspaceBindings?.inspectorDockVisible?.() }
        : null;
    if (!panel) return {};
    return {
      active: Boolean(panel.visible),
      title: panel.visible ? `Hide ${panel.label}` : `Show ${panel.label}`,
      description: panel.visible
        ? `${panel.label} dock is visible.`
        : command.description
    };
  }

  function dataDockTabCommandState(command) {
    if (!command.dataDockTab) return {};
    const active = workspaceBindings?.dataDockVisible?.() && workspaceBindings?.dataDockActiveTab?.() === command.dataDockTab;
    return {
      active,
      title: active ? `${command.label} tab is active` : command.title,
      description: active
        ? `${command.label} is active in the ${DATA_DOCK_COMMAND_LABEL}.`
        : command.description
    };
  }

  function inspectorContextCommandState(command) {
    if (!command.inspectorContext) return {};
    const activeContext = workspaceBindings?.inspectorActiveContext?.();
    const active = workspaceBindings?.inspectorDockVisible?.() && activeContext === command.inspectorContext;
    const available = workspaceBindings?.inspectorContextAvailable?.(command.inspectorContext);
    return {
      enabled: available,
      disabledReason: `${inspectorContextLabel(command.inspectorContext)} inspector is not available for the current selection.`,
      active,
      title: active ? `${command.label} inspector is active` : command.title,
      description: active
        ? `${command.label} is active in the ${INSPECTOR_PANEL_LABEL} dock.`
        : command.description
    };
  }

  function plannedModelCommandState() {
    return {};
  }

  function viewerRuntimeCommandState(command) {
    return {
      ...displayModeCommandState(command),
      ...viewOrientationCommandState(command),
      ...renderVisibilityCommandState(command),
      ...relationCommandPaletteState(command),
      ...snapStrengthCommandState(command),
      ...snapScopeCommandState(command),
      ...snapTargetCommandState(command),
      ...panelCommandState(command),
      ...dataDockTabCommandState(command),
      ...inspectorContextCommandState(command),
      ...plannedModelCommandState(command)
    };
  }

  function syncSketchRelationsButton() {
    const state = relationCommandState();
    getModelingUi()?.setSketchRelationsState?.({
      available: state.available,
      visible: state.available && state.active
    });
    refreshStatusBar({ relations: state });
    refreshWorkspaceCommandState();
  }

  function toggleRelationsCommand() {
    const state = relationCommandState();
    if (state.available) {
      const toggled = getPlateSketchEdit()?.toggleRelations?.();
      syncSketchRelationsButton();
      const nextState = relationCommandState();
      refreshStatusBar({ relations: nextState });
      updateModelingStatus(nextState.active
        ? "Plate sketch relations shown."
        : "Plate sketch relations hidden.");
      return toggled;
    }
    autoRelationsEnabled = !autoRelationsEnabled;
    getModelingUi()?.setAutoRelations?.(autoRelationsEnabled);
    refreshStatusBar({ relations: relationCommandState() });
    updateModelingStatus(autoRelationsEnabled
      ? "Automatic axis relations on."
      : "Automatic axis relations off.");
    refreshWorkspaceCommandState();
    return autoRelationsEnabled;
  }

  function setAutoRelationsEnabled(enabled) {
    autoRelationsEnabled = Boolean(enabled);
    updateModelingStatus(autoRelationsEnabled ? "Automatic axis relations on." : "Automatic axis relations off.");
    refreshStatusBar({ relations: relationCommandState() });
    refreshWorkspaceCommandState();
    return autoRelationsEnabled;
  }

  function setActiveModelingCommand(type) {
    activeCommandId = type ? MODELING_COMMAND_ID_BY_TYPE[type] || null : null;
    const inspectorDock = workspaceBindings?.inspectorDockElement?.();
    if (inspectorDock) {
      inspectorDock.dataset.authoringActive = activeCommandId && !MODELING_COMMANDS_WITH_SIDE_DOCK_EDITOR.has(type)
        ? "true"
        : "false";
      inspectorDock.dataset.authoringTool = type || "";
    }
    workspaceBindings?.syncNavCubeDockClearance?.();
    if (activeCommandId) workspaceBindings?.showInspectorProperties?.();
    getModelingUi()?.setActive(type || null);
    getEditorApi()?.refresh?.();
    refreshWorkspaceCommandState();
  }

  function startTrimCreate() {
    getCommandController()?.cancel();
    setActiveModelingCommand("trim");
    getDimensionEdit()?.clearDimension?.({ render: false });
    getEditorApi()?.clearSelection?.({ silent: true });
    getMemberEdit()?.clear?.({ notify: false });
    clearAuxiliaryEditors();
    getTrimJointEditorApi()?.openCreateMode?.();
    workspaceBindings?.showInspectorProperties?.({ notify: false });
    getTrimCreate()?.start?.();
  }

  function startGridCreate() {
    return openGridEditor();
  }

  function openGridEditor() {
    const project = api.project();
    const selectedObjectId = getEditorApi()?.selectedState?.().objectId || "";
    const selectedEntry = selectedObjectId ? project.objectIndex?.[selectedObjectId] : null;
    const gridSystems = project.model?.gridSystems || {};
    const gridSystemId = selectedEntry?.collection === "gridSystems"
      ? selectedObjectId
      : selectedEntry?.collection === "levels"
        ? Object.values(gridSystems).find((grid) => Array.isArray(grid.levelIds) && grid.levelIds.includes(selectedObjectId))?.id
        : Object.keys(gridSystems)[0];
    getCommandController()?.cancel();
    getTrimCreate()?.cancel();
    setActiveModelingCommand(null);
    clearAuxiliaryEditors({ overlay: true });
    if (!gridSystemId) {
      getEditorApi()?.openGridEditor?.();
      workspaceBindings?.showInspectorProperties?.({ notify: true });
      updateModelingStatus("Grid editor opened. Add a grid system from Properties.");
      return true;
    }
    getEditorApi()?.selectObject?.(gridSystemId, { inspectorPanel: "properties" });
    getModelBrowserUi()?.showObject?.("gridSystems", gridSystemId);
    workspaceBindings?.showInspectorProperties?.({ notify: true });
    updateModelingStatus(`Grid editor opened: ${gridSystemId}.`);
    return true;
  }

  function leftDockCommandItems() {
    return leftDockResultSpecs({
      project: api.project(),
      sources: projectDataSources(),
      smartComponentPresets: api.smartComponentPresets?.() || [],
      smartComponentCatalog
    })
      .filter((item) => validLeftDockResultAction(item.action))
      .map((item) => ({
        ...item,
        run: () => runLeftDockResult(item)
      }));
  }

  function runLeftDockResult(item) {
    const action = item?.action || {};
    if (!validLeftDockResultAction(action)) return false;
    workspaceBindings?.showDataDockTab?.(action.tab);
    if (action.type === "showFileRow") {
      const shown = getProjectFilesPanelUi()?.showRow?.(action.rowId);
      updateModelingStatus(shown === false ? `File row not found: ${action.rowId}` : `${item.title} shown in Files.`);
      return shown !== false;
    }
    if (action.type === "showDataRow") {
      const shown = getProjectDataPanelUi()?.showRow?.(action.rowId);
      updateModelingStatus(shown === false ? `Data row not found: ${action.rowId}` : `${item.title} shown in Data.`);
      return shown !== false;
    }
    if (action.type === "showModelCollection") {
      const shown = getModelBrowserUi()?.showCollection?.(action.collectionId);
      updateModelingStatus(shown === false ? `Model collection not found: ${action.collectionId}` : `Model browser: ${action.collectionId}`);
      return shown !== false;
    }
    if (action.type === "selectModelObject") {
      getModelBrowserUi()?.showObject?.(action.collectionId, action.objectId);
      viewerApp.selectObject(action.objectId);
      refreshSelectionSurfaces();
      updateModelingStatus(`Selected ${action.objectId}.`);
      return true;
    }
    if (action.type === "selectSmartComponent") {
      getModelBrowserUi()?.showObject?.(action.collectionId, action.smartComponentId || action.objectId);
      viewerApp.selectSmartComponent(action.smartComponentId || action.objectId);
      refreshSelectionSurfaces();
      updateModelingStatus(`Selected ${action.smartComponentId || action.objectId}.`);
      return true;
    }
    if (action.type === "showSmartComponentPreset") {
      const browser = action.tab === "connections" ? getConnectionComponentBrowserUi() : getSmartComponentBrowserUi();
      const shown = browser?.showPreset?.(action.presetId);
      updateModelingStatus(shown === false ? `Smart Component preset not found: ${action.presetId}` : `${item.title} shown in ${action.tab === "connections" ? "Connections" : "Components"}.`);
      return shown !== false;
    }
    return false;
  }

  function showConnectionComponentsCommand() {
    workspaceBindings?.showDataDockTab?.("connections");
    updateModelingStatus("Connection components shown in Connections.");
    return true;
  }

  function showModelCollectionCommand(collectionId, label) {
    workspaceBindings?.showDataDockTab?.("model");
    const shown = getModelBrowserUi()?.showCollection?.(collectionId);
    updateModelingStatus(shown === false ? `${label} collection not found.` : `${label} shown in Model Browser.`);
    return shown !== false;
  }

  function modelingCommandActions() {
    return {
      onBeam: () => viewerApp.runCommand("model.beam.create"),
      onColumn: () => viewerApp.runCommand("model.column.create"),
      onPlate: () => viewerApp.runCommand("model.plate.create"),
      onSketch: () => viewerApp.runCommand("model.sketch.create"),
      onWorkPlane: () => viewerApp.runCommand("model.workPlane.set"),
      onPlateBend: () => viewerApp.runCommand("model.plateBend.add"),
      onTrim: () => viewerApp.runCommand("model.trim.create"),
      onConnectionComponentOpen: () => viewerApp.runCommand("model.connectionComponent.open"),
      onWeldOpen: () => viewerApp.runCommand("model.weld.open"),
      onBoltGroupOpen: () => viewerApp.runCommand("model.boltGroup.open"),
      onBoltOpen: () => viewerApp.runCommand("model.bolt.open"),
      onAutoConnectionOpen: () => viewerApp.runCommand("model.autoConnection.open"),
      onGridCreate: () => viewerApp.runCommand("model.grid.create")
    };
  }

  function registerCommands() {
    const snapStrengthCommandHandlers = Object.fromEntries(SNAP_STRENGTH_SPECS.map((strength) => [
      `settings.snapStrength.${strength.id}`,
      () => setSnapStrengthCommand(strength.id)
    ]));
    const snapScopeCommandHandlers = Object.fromEntries(SNAP_SCOPE_MODES.map((mode) => [
      `selection.scope.${mode.id}`,
      () => setSnapScopeModeCommand({ snapScopeMode: mode.id, snapScopePatch: mode.patch })
    ]));
    const snapTargetCommandHandlers = Object.fromEntries(SNAP_TARGET_SPECS.map((target) => [
      `settings.snapTarget.${target.key}.toggle`,
      () => toggleSnapTargetCommand({ snapTarget: target.key })
    ]));
    const displayModeCommandHandlers = Object.fromEntries(DISPLAY_MODE_SPECS.map((mode) => [
      `view.displayMode.${mode.id}`,
      () => setDisplayModeCommand(mode.id)
    ]));
    const viewOrientationCommandHandlers = Object.fromEntries(VIEW_ORIENTATION_SPECS.map((orientation) => [
      `view.orientation.${orientation.id}`,
      () => setViewOrientationCommand(orientation.id)
    ]));
    const renderVisibilityCommandHandlers = {
      "settings.visibility.cuts.toggle": () => toggleRenderVisibilityCommand("cuttingObjects"),
      "settings.visibility.fasteners.toggle": () => toggleRenderVisibilityCommand("fasteners"),
      "settings.visibility.grids.toggle": () => toggleRenderVisibilityCommand("grids"),
      "settings.visibility.planes.toggle": () => toggleRenderVisibilityCommand("referencePlanes")
    };
    const dataDockCommandHandlers = Object.fromEntries(DATA_DOCK_TABS.map((tab) => [
      tab.commandId,
      () => workspaceBindings?.showDataDockTab?.(tab.id)
    ]));
    const inspectorContextCommandHandlers = Object.fromEntries(INSPECTOR_CONTEXTS.map((context) => [
      context.commandId,
      () => workspaceBindings?.showInspectorContext?.(context.id)
    ]));
    const shellCommandActions = createViewerPanelCommandActions({
      libraryPanel: workspaceBindings?.dataDockElement?.(),
      inspectorPanel: workspaceBindings?.inspectorDockElement?.(),
      toolbar,
      statusBar: getStatusBar(),
      getWorkspace: () => workspaceBindings?.workspace?.(),
      setStatus: updateModelingStatus
    });
    return viewerApp.registerCommands({
      "model.beam.create": () => getCommandController()?.startBeam(),
      "model.column.create": () => getCommandController()?.startColumn(),
      "model.plate.create": () => getCommandController()?.startPlate(),
      "model.sketch.create": () => getCommandController()?.startSketch(),
      "model.workPlane.set": () => getCommandController()?.startWorkPlane(),
      "model.plateBend.add": () => getCommandController()?.startPlateBend(),
      "model.trim.create": () => startTrimCreate(),
      "model.connectionComponent.open": () => showConnectionComponentsCommand(),
      "model.weld.open": () => showModelCollectionCommand("welds", "Welds"),
      "model.boltGroup.open": () => showModelCollectionCommand("fastenerGroups", "Bolt groups"),
      "model.bolt.open": () => showModelCollectionCommand("holePatterns", "Bolts"),
      "model.autoConnection.open": () => showModelCollectionCommand("connectionZones", "Auto connections"),
      "model.grid.create": () => startGridCreate(),
      "view.reset": () => {
        if (viewer.resetView?.()) {
          syncCameraSurfaces(viewer.viewCamera?.());
          updateModelingStatus("View reset.");
          refreshWorkspaceCommandState();
        }
      },
      "view.fitSelection": () => {
        updateModelingStatus(viewerApp.focusSelection() ? "Selection framed." : "Select an object to fit.");
      },
      ...displayModeCommandHandlers,
      ...viewOrientationCommandHandlers,
      ...renderVisibilityCommandHandlers,
      "selection.clear": () => {
        viewerApp.clearSelection();
        updateModelingStatus("Selection cleared.");
        refreshSelectionSurfaces();
      },
      ...dataDockCommandHandlers,
      ...inspectorContextCommandHandlers,
      "panel.library.toggle": () => {
        shellCommandActions.onLibraryToggle();
        refreshWorkspaceCommandState();
      },
      "panel.inspector.toggle": () => {
        shellCommandActions.onInspectorToggle();
        refreshWorkspaceCommandState();
      },
      "settings.relations.toggle": () => toggleRelationsCommand(),
      "settings.snap.toggle": shellCommandActions.onSnapSettingsToggle,
      "tools.clashDetection.open": () => {
        updateModelingStatus("Clash detection tools are not available yet.");
      },
      "structural-analysis.open": () => {
        updateModelingStatus("Structural analysis tools are not available yet.");
      },
      ...snapStrengthCommandHandlers,
      ...snapScopeCommandHandlers,
      ...snapTargetCommandHandlers,
      "command.cancel": () => {
        if (getTrimCreate()?.cancel?.()) {
          setActiveModelingCommand(null);
          return;
        }
        getCommandController()?.cancel();
        setActiveModelingCommand(null);
      }
    });
  }

  function viewerCommandItems(options = {}) {
    return createViewerCommandItems({
      app: viewerApp,
      shortcutLabelFor: (command) => options.shortcutLabelFor?.(command) || "",
      commandStateFor: viewerRuntimeCommandState,
      ...options
    });
  }

  return {
    activeCommandId: () => activeCommandId,
    displayMode: () => displayMode,
    viewOrientation: () => viewOrientation,
    autoRelationsEnabled: () => autoRelationsEnabled,
    setAutoRelationsEnabled,
    setActiveModelingCommand,
    setSnapStrengthCommand,
    setSnapScopeCommand,
    snapScopeStatus,
    syncCameraSurfaces,
    syncSketchRelationsButton,
    relationCommandState,
    modelingCommandActions,
    viewerCommandItems,
    leftDockCommandItems,
    registerCommands,
    startTrimCreate
  };
}
