import { createProjectStore } from "../../engine/store/project-command-store.mjs";
import { arrayValues, uniqueTruthy } from "../../engine/core/model.mjs";
import { loadSmartComponentDefinitions } from "../../engine/modules/smart-components/smart-component-registry.mjs";
import { loadSmartComponentUi } from "./smart-component-ui-loader.mjs";
import { buildScene } from "../../rendering/scene/scene-geometry-builder.mjs";
import { createCommandController } from "../../rendering/interaction/command-controller.mjs";
import { createMemberEditController } from "../../rendering/interaction/member-transform-edit-controller.mjs";
import { createPlateSketchEditController } from "../../rendering/interaction/plate-sketch-drag-edit-controller.mjs";
import { createReferencePlaneEditController } from "../../rendering/interaction/reference-plane-edit-controller.mjs";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs";
import { createSnapManager } from "../../rendering/interaction/snap-manager.mjs";
import { createTrimCreateController } from "../../rendering/interaction/trim-create-controller.mjs";
import { isTextInput, matchesShortcut, shortcutSetting } from "../../rendering/interaction/keyboard-shortcuts.mjs";
import { createWebglViewer } from "../../rendering/webgl/webgl-viewer-runtime.mjs";
import { createDimensionOverlayUi } from "./dimensions/dimension-overlay-ui.mjs";
import { createDimensionEditController } from "./dimensions/dimension-edit-controller.mjs";
import { mountFeatureEditorPanel } from "./panels/feature-editor-panel.mjs";
import { mountMemberTransformPanel } from "./panels/member-transform-panel.mjs";
import { mountEditorUi } from "./panels/inspector-panel.mjs";
import { mountTrimJointEditorPanel } from "./panels/trim-joint-editor-panel.mjs";
import { mountCommandPalette } from "../shell/command-palette.mjs";
import { mountStatusBar } from "../shell/status-bar.mjs";
import { normalizeDisplayMode, normalizeViewOrientation } from "../commands/view-metadata.mjs";
import { applyTooltip, topbarMenuButton } from "../design-system/ui-elements.mjs";
import { createViewerAppController } from "./viewer-app-controller.mjs";
import { createViewerCommandRegistration } from "./viewer-command-registration.mjs";
import { createViewerWorkspaceBindings } from "./viewer-workspace-bindings.mjs";
import { mountModelingToolbar } from "./toolbar/modeling-toolbar.mjs";
import { mountModelBrowser } from "./model-browser.mjs";
import { mountProjectDataPanel } from "./project-data-panel.mjs";
import { mountProjectFilesPanel } from "./project-files-panel.mjs";
import { mountProjectPropertiesPanel } from "./project-properties-panel.mjs";
import { mountSmartComponentBrowser } from "./smart-component-browser.mjs";
import { createSmartComponentPreviewService } from "./smart-component-preview-service.mjs";
import { SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC } from "../commands/smart-component-browser-metadata.mjs";
import { mountNavCube } from "./nav-cube.mjs";
import { mountViewerSettingsStrip } from "./viewer-settings-strip.mjs";
import { createIcon } from "../icons/icon-registry.mjs";
import { createViewerRenderScheduler, memberSmartComponentDetailObjectIds, shouldUseProgressiveDetails } from "./viewer-render-scheduler.mjs";
import { createViewerDomRuntime } from "./viewer-dom-runtime.mjs";
import { smartComponentHighlightObjectIds } from "./viewer-smart-component-highlights.mjs";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const featureNavbarRoot = document.getElementById("feature-navbar");
const commandPaletteButton = document.getElementById("command-palette-open");
const topbarFileButton = document.getElementById("topbar-file-open");
const commandPaletteRoot = document.getElementById("command-palette");
const viewerSettingsRoot = document.getElementById("viewer-settings-strip");
const navCubeRoot = document.getElementById("nav-cube");
const modelingToolbar = document.getElementById("modeling-toolbar");
const modelingStatus = document.getElementById("modeling-status");
const workspaceShell = document.querySelector(".bc-workspace-shell");
const statusBarRoot = document.querySelector(".bc-statusbar");
const memberTransformPanel = document.getElementById("member-transform-panel");
const libraryPanel = document.getElementById("library-panel");
const projectPropertiesPanelRoot = document.getElementById("project-properties-panel");
const projectFilesPanelRoot = document.getElementById("project-files-panel");
const projectDataPanelRoot = document.getElementById("project-data-panel");
const modelBrowserRoot = document.getElementById("model-browser");
const connectionComponentLibraryPanel = document.getElementById("connection-component-library");
const smartComponentLibraryPanel = document.getElementById("smart-component-library");
const libraryDock = document.querySelector(".bc-left-dock");
const inspectorDock = document.querySelector(".bc-right-dock");
const initialSearchParams = new URLSearchParams(window.location.search);
const initialQaCapture = initialSearchParams.has("qaCapture");
const initialQaSelectObject = initialSearchParams.get("qaSelectObject");
const TOPBAR_FILE_COMMAND_QUERY = "file";
const settingsUrl = new URL("./viewer-settings.json", import.meta.url);
const defaultWorkspaceUrl = new URL("../workspaces/default-workspace.json", import.meta.url);

let settings = null;
let viewer = null;
let authoringPreview = [];
let authoringPreviewPlates = [];
decorateResetAction(reset);
decorateTopbarFileAction(topbarFileButton);

function preventWorkspacePageZoom(event) {
  if (!event.ctrlKey && !event.metaKey) return;
  if (!workspaceShell?.contains(event.target)) return;
  event.preventDefault();
}

function decorateResetAction(button) {
  if (!button) return;
  button.classList.remove("bc-text-button");
  button.classList.add("bc-icon-button", "bc-viewer-overlay-action");
  button.setAttribute("aria-label", "Reset view");
  applyTooltip(button, "Reset view");
  button.replaceChildren(createIcon("reset-view"));
}

function decorateTopbarFileAction(button) {
  if (!button) return;
  topbarMenuButton(button, {
    icon: "file",
    label: "File",
    title: "File actions",
    ariaLabel: "File actions",
    className: "bc-topbar-menu-button",
    labelClassName: "bc-topbar-menu-label"
  });
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function cloneRuntimeSettings(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function shouldLoadViewerQaBridge(searchParams) {
  return ["qaCapture", "qaView", "qaDebug", "qaSnapSmoke", "qaSelectObject"].some((key) => searchParams.has(key));
}

function consumeQaSelectObjectUrlParam() {
  if (!window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("qaSelectObject")) return;
  url.searchParams.delete("qaSelectObject");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function isDeleteSelectionEvent(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
  const key = String(event.key || "").toLowerCase();
  const code = String(event.code || "").toLowerCase();
  return key === "delete"
    || key === "del"
    || key === "backspace"
    || code === "delete"
    || code === "backspace"
    || event.keyCode === 46
    || event.keyCode === 8
    || event.which === 46
    || event.which === 8;
}

function emptyQaBridge() {
  return {
    mountQaApi() {},
    async applyQaView() {}
  };
}

async function createRuntimeQaBridge(options) {
  if (!shouldLoadViewerQaBridge(options.searchParams)) return emptyQaBridge();
  const { createViewerQaBridge } = await import("./viewer-qa-bridge.mjs");
  return createViewerQaBridge(options);
}

async function loadRegisteredFrameLibrary(project, projectUrl) {
  const frameRegisterPath = project?.libraries?.frames?.path;
  if (!frameRegisterPath) return null;
  const registerUrl = new URL(frameRegisterPath, projectUrl);
  const register = await loadJson(registerUrl);
  const [libraryPath] = Array.isArray(register?.libraries) ? register.libraries : [];
  if (!libraryPath) return null;
  const libraryUrl = new URL(`${libraryPath.replace(/\/?$/, "/")}config.json`, registerUrl);
  return loadJson(libraryUrl);
}

function applyUiSettings(project) {
  if (hud) hud.hidden = !settings.ui.showHud;
  if (meta) meta.hidden = !settings.ui.showMeta;
  if (reset) reset.hidden = !settings.ui.showResetButton;
  if (title) title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function projectPath() {
  const demo = initialSearchParams.get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  if (!meta) return;
  meta.textContent = `${Object.keys(project.model.members).length} members | ${Object.keys(project.model.plates).length} plates | ${Object.keys(project.model.sketches || {}).length} sketches | ${Object.keys(project.model.fastenerGroups).length} fasteners`;
}

function previewOnlyProject(project) {
  return {
    schemaVersion: project?.schemaVersion,
    units: project?.units,
    settings: project?.settings || {},
    libraries: project?.libraries || {},
    objectIndex: {},
    model: {
      profiles: project?.model?.profiles || {},
      members: {},
      plates: {},
      sketches: {},
      features: {},
      trimJoints: {},
      fastenerGroups: {},
      welds: {},
      smartComponentInstances: {}
    }
  };
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const runtimeSettings = cloneRuntimeSettings(settings);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const materialsUrl = new URL(project.libraries.materials.path, projectUrl);
    const [profiles, fasteners, materials, frames, smartComponentCatalog, smartComponentUi, defaultWorkspace] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadJson(materialsUrl), loadRegisteredFrameLibrary(project, projectUrl), loadSmartComponentDefinitions(), loadSmartComponentUi(), loadJson(defaultWorkspaceUrl)]);

    const viewerDomRuntime = createViewerDomRuntime({ canvas, reset });
    viewer = createWebglViewer(canvas, reset, runtimeSettings, {
      qaCapture: initialQaCapture,
      domRuntime: viewerDomRuntime,
      dimensionOverlayFactory: createDimensionOverlayUi
    });
    applyUiSettings(project);

    const api = createProjectStore({
      project,
      profiles: profiles.profiles,
      smartComponentCatalog,
      fasteners,
      materials,
      cloneOnLoad: !shouldUseProgressiveDetails(project)
    });
    const smartComponentPreviewService = createSmartComponentPreviewService({
      api,
      profiles: profiles.profiles,
      fasteners,
      materials,
      smartComponentCatalog,
      viewerSettings: runtimeSettings
    });
    const selection = createSelectionController({ viewer, settings: runtimeSettings, project: () => api.project() });
    const snapManager = createSnapManager({
      viewer,
      api,
      profiles: profiles.profiles,
      settings: runtimeSettings,
      selectionScope: selection
    });
    let commandController = null;
    let trimCreate = null;
    let dimensionEdit = null;
    let focusedMemberId = null;
    let editorApi = null;
    let featureEditorApi = null;
    let trimJointEditorApi = null;
    let memberEdit = null;
    let referencePlaneEdit = null;
    let plateSketchEdit = null;
    let modelingUi = null;
    let viewerSettingsUi = null;
    let navCubeUi = null;
    let modelBrowserUi = null;
    let connectionComponentBrowserUi = null;
    let smartComponentBrowserUi = null;
    let projectPropertiesPanelUi = null;
    let projectFilesPanelUi = null;
    let projectDataPanelUi = null;
    let statusBar = null;
    let commandPalette = null;
    let commandRegistration = null;
    const disposers = [];
    const addDisposer = (dispose) => {
      if (typeof dispose === "function") disposers.push(dispose);
      return dispose;
    };
    const addDomListener = (target, type, listener, options) => {
      if (!target || typeof target.addEventListener !== "function") return () => {};
      target.addEventListener(type, listener, options);
      return addDisposer(() => target.removeEventListener(type, listener, options));
    };
    const trackDisposable = (value) => {
      if (value && typeof value.destroy === "function") addDisposer(() => value.destroy());
      return value;
    };
    window.__boberCadDisposeViewer = () => {
      renderScheduler?.clearQueuedRerender?.();
      renderScheduler?.clearDetailRefresh?.();
      while (disposers.length) disposers.pop()();
    };
    addDomListener(window, "resize", () => viewer?.resize());
    const workspaceBindings = createViewerWorkspaceBindings({
      toolbar: modelingToolbar,
      topbarActions: document.querySelector(".bc-topbar-actions"),
      shell: workspaceShell,
      libraryPanel,
      libraryDock,
      inspectorDock,
      navCubeRoot,
      defaultWorkspace,
      getStatusBar: () => statusBar,
      getViewerSettingsUi: () => viewerSettingsUi,
      getCommandPalette: () => commandPalette,
      getViewerCommandItems: (options = {}) => commandRegistration?.viewerCommandItems({
        shortcutLabelFor: (command) => shortcutSetting(settings.shortcuts?.commands, command.shortcut, command.keyFallback),
        ...options
      }) || [],
      onStatusChange: updateModelingStatus
    });
    addDomListener(workspaceShell, "wheel", preventWorkspacePageZoom, { capture: true, passive: false });
    const objectEditor = workspaceBindings.inspectorContextPanel("properties");
    const featureEditorPanel = workspaceBindings.inspectorContextPanel("feature");
    const trimJointEditorPanel = objectEditor;
    const customPanel = workspaceBindings.inspectorContextPanel("component");
    const viewerApp = createViewerAppController({
      projectStore: api,
      selectionController: selection,
      settings: runtimeSettings,
      getCommandController: () => commandController,
      getTrimCreate: () => trimCreate,
      getEditorApi: () => editorApi,
      getWorkspace: () => workspaceBindings.workspace(),
      getActiveCommandId: () => commandRegistration?.activeCommandId() || null,
      focusObjectIds: (objectIds) => focusObjectIds(objectIds)
    });
    commandRegistration = createViewerCommandRegistration({
      settings: runtimeSettings,
      viewer,
      viewerApp,
      api,
      selection,
      smartComponentCatalog,
      toolbar: modelingToolbar,
      workspaceBindings,
      getStatusBar: () => statusBar,
      getModelingUi: () => modelingUi,
      getViewerSettingsUi: () => viewerSettingsUi,
      getNavCubeUi: () => navCubeUi,
      getCommandController: () => commandController,
      getTrimCreate: () => trimCreate,
      getDimensionEdit: () => dimensionEdit,
      getEditorApi: () => editorApi,
      getMemberEdit: () => memberEdit,
      getTrimJointEditorApi: () => trimJointEditorApi,
      getPlateSketchEdit: () => plateSketchEdit,
      getModelBrowserUi: () => modelBrowserUi,
      getProjectFilesPanelUi: () => projectFilesPanelUi,
      getProjectDataPanelUi: () => projectDataPanelUi,
      getSmartComponentBrowserUi: () => smartComponentBrowserUi,
      getConnectionComponentBrowserUi: () => connectionComponentBrowserUi,
      projectDataSources,
      clearAuxiliaryEditors,
      clearMemberEditSilently,
      refreshSelectionSurfaces,
      refreshStatusBar,
      rerender: (...args) => rerender(...args),
      updateModelingStatus
    });
    statusBar = mountStatusBar({
      root: statusBarRoot,
      prompt: modelingStatus,
      app: viewerApp,
      snapStrength: runtimeSettings.authoring?.snap?.strength || "normal",
      snapScope: selection.scope?.() || {},
      relations: commandRegistration.relationCommandState(),
      bottomStrip: defaultWorkspace?.bottomStrip,
      units: api.project()?.settings?.units?.length || "mm",
      onSnapSettings: () => viewerApp.runCommand("settings.snap.toggle"),
      onSnapStrengthChange: (strength) => commandRegistration.setSnapStrengthCommand(strength),
      onSnapScopeChange: (patch, meta) => {
        const scope = commandRegistration.setSnapScopeCommand(patch);
        updateModelingStatus(commandRegistration.snapScopeStatus(meta, scope));
      },
      onRelationsToggle: () => viewerApp.runCommand("settings.relations.toggle")
    });
    refreshStatusBar();
    function projectDataSources() {
      return [
        { id: "project", label: "Project JSON", kind: "Project", icon: "file", path: projectUrl.href },
        { id: "settings", label: "Viewer settings", kind: "UI", icon: "settings", path: settingsUrl.href },
        { id: "workspace", label: "Default workspace", kind: "UI", icon: "settings", path: defaultWorkspaceUrl.href }
      ];
    }
    function focusObjectIds(objectIds = []) {
      const points = viewer.objectPoints(objectIds);
      if (!points.length) return false;
      viewer.fitPoints(points, { padding: 0.72, minSpan: 220 });
      return true;
    }
    commandRegistration.registerCommands();
    mountViewerSettingsUi();
    mountNavCubeUi();
    viewer.setCameraChangeHandler?.(commandRegistration.syncCameraSurfaces);
    commandRegistration.syncCameraSurfaces(viewer.viewCamera?.());
    mountModelingUi();
    workspaceBindings.mountWorkspaceCustomizer();
    workspaceBindings.mountInspectorDockTabs();
    const commandPaletteItems = () => [
      ...workspaceBindings.workspaceCommandItems(),
      ...commandRegistration.leftDockCommandItems()
    ];
    workspaceBindings.mountFeatureNavbarTabs({ root: featureNavbarRoot });
    workspaceBindings.refreshCommandState();
    commandPalette = mountCommandPalette({
      button: commandPaletteButton,
      root: commandPaletteRoot,
      commands: commandPaletteItems,
      onStatusChange: updateModelingStatus
    });
    function clearAuxiliaryEditors(referencePlaneOptions = undefined) {
      referencePlaneEdit?.clear(referencePlaneOptions);
      plateSketchEdit?.clear(referencePlaneOptions);
      featureEditorApi?.clear();
      trimJointEditorApi?.clear();
    }
    function clearSmartComponentEditor() {
      dimensionEdit?.clearAll();
      selection.setActiveSmartComponent?.(null);
      customPanel.hidden = true;
    }
    function clearMemberEditSilently() {
      memberEdit?.clear({ notify: false });
    }
    function updateStatusBarPrompt(message) {
      const nextMessage = message || "Ready";
      if (!statusBar?.setPrompt) return false;
      statusBar.setPrompt(nextMessage);
      return true;
    }
    function updateModelingStatus(message) {
      const nextMessage = message || "Ready";
      if (modelingUi?.setStatus) {
        modelingUi.setStatus(nextMessage);
      } else {
        updateStatusBarPrompt(nextMessage);
      }
      if (nextMessage === "No modeling command") commandRegistration.setActiveModelingCommand(null);
    }
    bindTopbarFileAction();
    function bindTopbarFileAction() {
      if (!topbarFileButton || topbarFileButton.dataset.bound === "true") return;
      topbarFileButton.dataset.bound = "true";
      addDomListener(topbarFileButton, "click", () => {
        commandPalette?.open?.({ query: TOPBAR_FILE_COMMAND_QUERY });
        updateModelingStatus("File actions opened.");
      });
    }
    function refreshSelectionSurfaces() {
      modelBrowserUi?.setSelectionState?.(viewerApp.selectionState());
      connectionComponentBrowserUi?.refresh?.();
      workspaceBindings.refreshCommandState();
      refreshStatusBar();
    }
    function deleteSelectedObjects() {
      const selectionState = viewerApp.selectionState();
      const project = api.project();
      const selectedSmartComponentId = selectionState.selectedSmartComponentId;
      const selectedObjectIds = [...new Set(arrayValues(selectionState.selectedObjectIds)
        .filter((objectId) => project.objectIndex?.[objectId]))];

      try {
        if (selectedSmartComponentId && project.objectIndex?.[selectedSmartComponentId]) {
          clearSmartComponentEditor();
          clearMemberEditSilently();
          clearAuxiliaryEditors();
          editorApi?.clearSelection?.();
          selection.clear();
          const nextProject = api.deleteSmartComponent(selectedSmartComponentId);
          handleProjectChange(nextProject);
          updateModelingStatus(`Deleted ${selectedSmartComponentId}.`);
          refreshSelectionSurfaces();
          return true;
        }

        if (!selectedObjectIds.length) return false;
        dimensionEdit?.clearDimension({ render: false });
        clearMemberEditSilently();
        clearAuxiliaryEditors();
        editorApi?.clearSelection?.();
        selection.clear();
        const nextProject = api.deleteObjects(selectedObjectIds);
        handleProjectChange(nextProject);
        updateModelingStatus(selectedObjectIds.length === 1
          ? `Deleted ${selectedObjectIds[0]}.`
          : `Deleted ${selectedObjectIds.length} objects.`);
        refreshSelectionSurfaces();
        return true;
      } catch (error) {
        console.error(error);
        updateModelingStatus(error?.message || "Delete failed.");
        return true;
      }
    }
    function mountViewerSettingsUi() {
      viewerSettingsUi = mountViewerSettingsStrip({
        root: viewerSettingsRoot,
        commands: () => commandRegistration.viewerCommandItems({
          shortcutLabelFor: (command) => shortcutSetting(settings.shortcuts?.commands, command.shortcut, command.keyFallback)
        }),
        workspace: defaultWorkspace?.viewerSettingsStrip,
        displayMode: commandRegistration.displayMode(),
        orientation: commandRegistration.viewOrientation(),
        onDisplayModeChange: (mode) => viewerApp.runCommand(`view.displayMode.${normalizeDisplayMode(mode)}`),
        onOrientationChange: (orientation) => viewerApp.runCommand(`view.orientation.${normalizeViewOrientation(orientation)}`)
      });
      viewer.setDisplayMode?.(commandRegistration.displayMode());
    }
    function mountNavCubeUi() {
      workspaceBindings.applyViewerOverlayWorkspace(defaultWorkspace?.viewerOverlays);
      navCubeUi = mountNavCube({
        root: navCubeRoot,
        orientation: commandRegistration.viewOrientation(),
        onOrientationChange: (orientation) => viewerApp.runCommand(`view.orientation.${normalizeViewOrientation(orientation)}`),
        onOrbitDrag: ({ dx, dy }) => {
          viewer.orbitView?.(-dx, -dy, { pivot: "origin" });
        }
      });
      navCubeUi?.setCameraState?.(viewer.viewCamera?.());
      workspaceBindings.syncNavCubeDockClearance();
      workspaceBindings.bindNavCubeDockClearanceObserver();
    }
    function refreshStatusBar(patch = {}) {
      statusBar?.update({
        selectionCount: viewerApp.selectionState().selectedObjectIds.length,
        snapStrength: runtimeSettings.authoring?.snap?.strength || "normal",
        snapScope: selection.scope?.() || {},
        relations: commandRegistration.relationCommandState(),
        units: api.project()?.settings?.units?.length || "mm",
        ...patch
      });
    }
    function mountModelingUi() {
      modelingUi = mountModelingToolbar({
        toolbar: modelingToolbar,
        status: modelingStatus,
        shortcuts: runtimeSettings.shortcuts || {},
        ...commandRegistration.modelingCommandActions(),
        autoRelationsEnabled: commandRegistration.autoRelationsEnabled(),
        onAutoRelationsChange: (enabled) => {
          commandRegistration.setAutoRelationsEnabled(enabled);
        },
        onRelationsToggle: () => viewerApp.runCommand("settings.relations.toggle"),
        onSketchRelationsToggle: () => {
          const toggled = plateSketchEdit?.toggleRelations?.();
          commandRegistration.syncSketchRelationsButton();
          return toggled;
        },
        snapSettings: runtimeSettings.authoring?.snap || {},
        snapScope: selection.scope?.() || {},
        onSnapStrengthChange: commandRegistration.setSnapStrengthCommand,
        onSnapScopeChange: (patch) => {
          const scope = commandRegistration.setSnapScopeCommand(patch);
          const [key, enabled] = Object.entries(patch)[0] || [];
          if (key) updateModelingStatus(commandRegistration.snapScopeStatus({ key, enabled }, scope));
        },
        onStatusChange: updateStatusBarPrompt
      });
      commandRegistration.syncSketchRelationsButton();
    }
    const renderScheduler = createViewerRenderScheduler({
      viewer,
      settings: runtimeSettings,
      profiles,
      fasteners,
      getProject: () => api.project(),
      getPreviewMembers: () => authoringPreview,
      getPreviewPlates: () => authoringPreviewPlates,
      getActiveSmartComponentId: () => dimensionEdit?.smartComponentId() || null,
      getForceDetailObjectIds: () => focusedMemberId ? memberSmartComponentDetailObjectIds(api.project(), focusedMemberId) : [],
      getActiveTrimRenderOptions: () => trimJointEditorApi?.sceneFocus?.() || {},
      updateMeta,
      renderDimensionOverlay: () => dimensionEdit?.render()
    });
    const { renderProject, renderProjectNow, rerender, hotSwapMemberDetails, applyProjectResult, patchProjectObjects } = renderScheduler;
    const handleProjectChange = (nextProject, result = api.lastCommandResult?.()) => applyProjectResult(nextProject, result);
    const handleLocalObjectProjectChange = (nextProject, objectId, objectIds = []) => {
      const localObjectIds = uniqueTruthy([objectId, ...arrayValues(objectIds)]);
      const result = api.lastCommandResult?.();
      if (result?.changedObjectIds?.length || result?.removedObjectIds?.length || result?.regeneratedObjectIds?.length) {
        applyProjectResult(nextProject, {
          ...result,
          changedObjectIds: uniqueTruthy([...arrayValues(result.changedObjectIds), ...localObjectIds])
        });
        return true;
      }
      return patchProjectObjects(nextProject, localObjectIds) || hotSwapMemberDetails(nextProject, objectId, objectIds);
    };
    const handleTrimDraftPreviewChange = (preview, objectIds = []) => {
      const patchIds = uniqueTruthy([
        ...arrayValues(objectIds),
        ...arrayValues(preview?.objectIds)
      ]);
      const previewProject = preview?.project || api.project();
      if (!patchIds.length) {
        renderProjectNow(previewProject);
        return true;
      }
      if (patchProjectObjects(previewProject, patchIds)) return true;
      rerender(previewProject);
      return true;
    };
    renderScheduler.bindDetailScaleRefresh();
    const qaBridge = await createRuntimeQaBridge({
      viewer,
      canvas,
      settings: runtimeSettings,
      searchParams: initialSearchParams,
      hiddenCaptureElements: [hud, modelingToolbar, modelingStatus, memberTransformPanel, objectEditor, featureEditorPanel, trimJointEditorPanel, libraryPanel, customPanel],
      renderProject
    });
    const memberTransformUi = mountMemberTransformPanel({
      panel: memberTransformPanel,
      onDeltaChange: (axisId, value) => memberEdit?.setPendingTransformDelta(axisId, value),
      onResultChange: (axisId, value) => memberEdit?.setPendingTransformResult(axisId, value),
      onNudge: (axisId, direction) => memberEdit?.nudgePendingTransform(axisId, direction),
      onIncrementChange: (value) => memberEdit?.setPendingTransformIncrement(value),
      onConfirm: () => memberEdit?.confirmPendingTransform(),
      onCancel: () => memberEdit?.cancelPendingTransform(),
      shortcuts: runtimeSettings.shortcuts?.memberEdit || {}
    });
    memberEdit = createMemberEditController({
      viewer,
      api,
      selection,
      snapManager,
      settings: runtimeSettings,
      onLocalProjectChange: handleLocalObjectProjectChange,
      onMemberSelected: (memberId) => {
        focusedMemberId = memberId;
        editorApi?.selectMember(memberId, { fromMemberEdit: true });
        refreshSelectionSurfaces();
        if (dimensionEdit?.smartComponentId()) {
          clearSmartComponentEditor();
          renderProjectNow(api.project());
        }
        clearAuxiliaryEditors();
      },
      onCleared: () => {
        focusedMemberId = null;
        editorApi?.clearSelection({ fromMemberEdit: true });
        clearAuxiliaryEditors();
        refreshSelectionSurfaces();
      },
      onTransformChange: (state) => memberTransformUi.update(state),
      autoRelationsEnabled: () => commandRegistration.autoRelationsEnabled(),
      perfMark: (name, data = {}) => {
        if (!window.__boberCadPerf?.events) return;
        window.__boberCadPerf.events.push({ name, time: performance.now(), ...data });
      },
      now: () => performance.now()
    });
    referencePlaneEdit = createReferencePlaneEditController({
      viewer,
      api,
      onLocalObjectProjectChange: handleLocalObjectProjectChange
    });
    plateSketchEdit = createPlateSketchEditController({
      viewer,
      api,
      snapManager,
      settings: runtimeSettings.authoring || {},
      onProjectChange: handleProjectChange,
      onStatusChange: updateModelingStatus,
      onSelectionChange: ({ plateId, selection: sketchSelection }) => {
        commandRegistration.syncSketchRelationsButton();
        if (!plateId || editorApi?.selectedState?.().objectId !== plateId) return;
        editorApi?.selectObject(plateId, {
          edgeIds: sketchSelection?.edgeIds || [],
          vertexIds: sketchSelection?.vertexIds || [],
          ...(sketchSelection?.relationId ? { relationId: sketchSelection.relationId } : {}),
          ...(sketchSelection?.sketchMode ? { sketchMode: sketchSelection.sketchMode } : {})
        }, { notify: false });
      },
      requestDimensionInput: ({ promptText, defaultValue }) => window.prompt(promptText, defaultValue)
    });
    const authoringTarget = (input) => {
      if (input?.handle?.kind === "reference-plane-corner") return referencePlaneEdit.authoringHandler;
      if (input?.handle?.kind?.startsWith("plate-sketch-")) return plateSketchEdit.authoringHandler;
      return memberEdit.authoringHandler;
    };
    viewer.setAuthoringHandler({
      needsDragHit: (input) => authoringTarget(input)?.needsDragHit?.(input) !== false,
      beginDrag: (input) => authoringTarget(input)?.beginDrag?.(input),
      click: (input) => authoringTarget(input)?.click?.(input),
      contextMenu: (input) => plateSketchEdit?.authoringHandler?.contextMenu?.(input) || authoringTarget(input)?.contextMenu?.(input),
      quickListAction: (input) => authoringTarget({ handle: input?.item?.handle })?.quickListAction?.(input),
      drag: (input) => authoringTarget(input)?.drag?.(input),
      end: (input) => authoringTarget(input)?.end?.(input),
      cancel: (input) => authoringTarget(input)?.cancel?.(input)
    });
    const smartComponentPathForObject = (objectId) => {
      const instances = api.project().model?.smartComponentInstances || {};
      const path = [];
      const seen = new Set();
      let current = objectId ? api.smartComponentForObject(objectId) : null;
      while (current && !seen.has(current.id)) {
        path.unshift(current);
        seen.add(current.id);
        current = current.parentInstanceId ? instances[current.parentInstanceId] : null;
      }
      return path;
    };
    const blockFilteredSelection = () => {
      clearMemberEditSilently();
      editorApi?.clearSelection?.();
      selection.clear();
      updateModelingStatus("Object type is filtered by snap/selection scope.");
      return true;
    };
    const toggleSmartComponentPartFromFace = (face) => {
      const result = api.toggleSmartComponentRoleFromFace(face) || api.toggleSmartComponentZoneObjectFromFace?.(face);
      if (!result) return null;
      dimensionEdit?.clearDimension({ render: false });
      editorApi?.selectSmartComponent(result.component.smartComponentId, { inspectorPanel: "component" });
      handleProjectChange(result.project);
      return result;
    };
    const selectHierarchicalFace = (face) => {
      const objectId = face?.objectId || null;
      const project = api.project();
      const entry = objectId ? project.objectIndex?.[objectId] : null;
      const componentsEnabled = selection.componentSelectionEnabled?.() !== false;
      const smartComponentPath = componentsEnabled ? smartComponentPathForObject(objectId) : [];
      const rootSmartComponent = smartComponentPath[0] || null;
      const selected = editorApi?.selectedState?.() || {};
      const selectedRootId = selected.smartComponentId
        ? api.smartComponentRoot(selected.smartComponentId)?.id
        : selected.objectId
          ? api.smartComponentRootForObject(selected.objectId)?.id
          : null;

      if (entry?.collection === "trimJoints" && objectId) {
        clearMemberEditSilently();
        editorApi?.selectObject(objectId, { ...face, inspectorPanel: "properties" });
        return true;
      }

      if (rootSmartComponent) {
        if (selection.objectAllowed?.(project, rootSmartComponent.id, "smartComponentInstances", { ignoreSelectedObjectsOnly: true }) === false) {
          return blockFilteredSelection();
        }

        if (selectedRootId !== rootSmartComponent.id) {
          editorApi?.selectSmartComponent(rootSmartComponent.id, { inspectorPanel: "component" });
          return true;
        }

        const selectedPathIndex = selected.smartComponentId
          ? smartComponentPath.findIndex((component) => component.id === selected.smartComponentId)
          : -1;
        if (selectedPathIndex >= 0 && selectedPathIndex < smartComponentPath.length - 1) {
          editorApi?.selectSmartComponent(smartComponentPath[selectedPathIndex + 1].id, { inspectorPanel: "component" });
          return true;
        }

        if (toggleSmartComponentPartFromFace(face)) return true;
        editorApi?.selectSmartComponent(rootSmartComponent.id, { inspectorPanel: "component" });
        return true;
      }

      if (objectId && entry?.collection && selection.objectAllowed?.(project, objectId, entry.collection, { ignoreSelectedObjectsOnly: true }) === false) {
        return blockFilteredSelection();
      }

      if (entry?.collection) {
        if (face?.collection && face.collection !== "members" && objectId) {
          clearMemberEditSilently();
          editorApi?.selectObject(objectId, face);
          return true;
        }
        return false;
      }

      return false;
    };
    const trimJointEditorPanelActive = () => {
      if (!trimJointEditorPanel || trimJointEditorPanel.hidden) return false;
      const titleText = trimJointEditorPanel.querySelector(".bc-inspector-title")?.textContent?.trim();
      return Boolean(trimJointEditorPanel.querySelector(".trim-cut-card, .trim-menu-type-card") || titleText === "Create Trim");
    };
    const trimJointEditorConsumesMemberFace = (face) => {
      if (trimJointEditorApi?.selectMemberFromSceneFace(face)) return true;
      return face?.collection === "members" && trimJointEditorPanelActive();
    };
    viewer.setClickHandler((face) => {
      if (trimJointEditorApi?.consumePendingSceneClick?.()) {
        clearMemberEditSilently();
        featureEditorApi?.clear();
        referencePlaneEdit?.clear({ overlay: true });
        plateSketchEdit?.clear({ overlay: true });
        return;
      }
      if (!face) {
        dimensionEdit?.clearDimension();
        if (selection.pickMode?.() || trimCreate?.active?.() || trimJointEditorApi?.keepsSceneFocus?.() || trimJointEditorPanelActive()) {
          return;
        }
        if (!commandController?.activeCommand?.() && !trimCreate?.active?.()) {
          editorApi?.selectScene?.();
          updateModelingStatus("View selected.");
          return;
        }
      }
      if (trimJointEditorApi?.toggleRegionFromFace(face)) {
        clearMemberEditSilently();
        featureEditorApi?.clear();
        referencePlaneEdit?.clear({ overlay: true });
        return;
      }
      if (trimJointEditorConsumesMemberFace(face)) {
        clearMemberEditSilently();
        featureEditorApi?.clear();
        referencePlaneEdit?.clear({ overlay: true });
        plateSketchEdit?.clear({ overlay: true });
        return;
      }
      if (selectHierarchicalFace(face)) return;
      memberEdit.handleSceneClick(face);
    });
    const showSmartComponentEditor = (smartComponentId, options = {}) => {
      const smartComponent = api.smartComponent(smartComponentId);
      const inspectorPanel = options.inspectorPanel || (smartComponent?.kind === "connection" ? "component" : null);
      let definition = null;
      try {
        definition = api.definition(smartComponentId);
      } catch {
        definition = null;
      }
      focusedMemberId = null;
      clearMemberEditSilently();
      clearAuxiliaryEditors();
      selection.setActiveSmartComponent?.(smartComponentId);
      selection.select(smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId)));
      const focus = dimensionEdit.selectSmartComponent(smartComponentId, options);
      if (definition) {
        smartComponentUi.mountSmartComponentUi({
          panel: customPanel,
          definition,
          smartComponentId,
          api,
          focusPath: focus.path,
          focusMode: focus.mode,
          focusInput: !options.focusLabel,
          onPanelFocus: () => {
            dimensionEdit.stopLabelEdit();
          },
          onProjectChange: handleProjectChange,
          onSmartComponentDeleted: () => {
            clearSmartComponentEditor();
            renderProject(api.project(), { preserveCamera: true });
            clearMemberEditSilently();
            clearAuxiliaryEditors();
            selection.clear();
          }
        });
      } else {
        customPanel.hidden = true;
        editorApi?.refresh?.();
      }
      renderProject(api.project(), { preserveCamera: true, activeSmartComponentId: dimensionEdit.smartComponentId() });
      dimensionEdit.render();
      if (definition && (options.inspectorPanel === "component" || inspectorPanel === "component")) workspaceBindings.showInspectorContext("component", { focus: false, status: true });
      else workspaceBindings.showInspectorProperties();
    };
    const showSmartComponentPresetEditor = (presetId) => {
      const preset = smartComponentCatalog.smartComponents?.[presetId];
      const definition = preset ? smartComponentCatalog.definitions?.[preset.type] : null;
      if (!preset || !definition) {
        updateModelingStatus(`Smart Component preset not found: ${presetId}`);
        return false;
      }
      focusedMemberId = null;
      dimensionEdit?.clearAll();
      clearMemberEditSilently();
      clearAuxiliaryEditors();
      selection.setActiveSmartComponent?.(null);
      selection.clear();
      smartComponentUi.mountPresetSmartComponentUi({
        panel: customPanel,
        definition,
        preset,
        api,
        onPanelFocus: () => {
          dimensionEdit.stopLabelEdit();
        }
      });
      workspaceBindings.showInspectorContext("component", { focus: false, status: true });
      updateModelingStatus(`${preset.name || preset.id} settings shown.`);
      return true;
    };
    dimensionEdit = createDimensionEditController({
      viewer,
      api,
      profiles: profiles.profiles,
      snapManager,
      settings: runtimeSettings,
      getEditorApi: () => editorApi,
      onProjectChange: handleProjectChange,
      openSmartComponentEditor: showSmartComponentEditor
    });
    viewer.setDoubleClickHandler((face) => {
      try {
        toggleSmartComponentPartFromFace(face);
      } catch (error) {
        console.error(error);
      }
    });
    commandController = createCommandController({
      viewer,
      api,
      profiles: profiles.profiles,
      snapManager,
      settings: runtimeSettings,
      onPreviewChange: (preview) => {
        const previewMembers = Array.isArray(preview) ? preview : arrayValues(preview?.members);
        const previewPlates = Array.isArray(preview) ? [] : arrayValues(preview?.plates);
        authoringPreview = [];
        authoringPreviewPlates = [];
        const previewScene = previewMembers.length || previewPlates.length
          ? buildScene(previewOnlyProject(api.project()), profiles, fasteners, runtimeSettings, {
            activeSmartComponentId: dimensionEdit?.smartComponentId() || null,
            renderObjectIds: [],
            previewMembers,
            previewPlates
          })
          : null;
        viewer.setAuthoringPreviewScene?.(previewScene);
      },
      onOverlayChange: (overlay) => viewer.setAuthoringOverlay(overlay),
      onProjectChange: handleProjectChange,
      onStatusChange: updateModelingStatus,
      onCommandStart: (type) => {
        trimCreate?.cancel();
        commandRegistration.setActiveModelingCommand(type);
        dimensionEdit?.clearDimension({ render: false });
        editorApi?.clearSelection?.({ silent: true });
        clearMemberEditSilently();
        clearAuxiliaryEditors();
        selection.clear();
      },
      keyboardTarget: document
    });
    trimCreate = createTrimCreateController({
      api,
      selection,
      onProjectChange: handleProjectChange,
      onTrimCreated: (trimJointId) => {
        focusedMemberId = null;
        dimensionEdit?.clearDimension({ render: false });
        clearMemberEditSilently();
        clearAuxiliaryEditors({ overlay: true });
        commandRegistration.setActiveModelingCommand(null);
        if (typeof editorApi?.selectObject === "function") {
          editorApi.selectObject(trimJointId, { inspectorPanel: "properties" });
        } else {
          trimJointEditorApi?.selectTrimJoint(trimJointId);
          workspaceBindings.showInspectorProperties({ notify: false });
        }
      },
      onCommandEnd: () => commandRegistration.setActiveModelingCommand(null),
      onPickProgress: (memberIds) => trimJointEditorApi?.openCreateMode?.({ pickedMemberIds: memberIds }),
      onStatusChange: updateModelingStatus
    });
    const handleViewerKeyDelete = (event) => {
      if (!isDeleteSelectionEvent(event) || isTextInput(event.target)) return false;
      if (plateSketchEdit?.removeSelectedRelation?.()) {
        event.preventDefault();
        return true;
      }
      if (!commandController?.activeCommand?.() && !trimCreate?.active?.() && deleteSelectedObjects()) {
        event.preventDefault();
        return true;
      }
      return false;
    };
    const handleViewerKeydown = (event) => {
      if (event.target instanceof Element && memberTransformPanel.contains(event.target)) return;
      if (event.defaultPrevented) return;
      if (!isTextInput(event.target) && matchesShortcut(event, runtimeSettings.authoring?.snap?.cycleKey || "Tab")) {
        if (plateSketchEdit?.cycleSnap?.() || memberEdit?.cycleSnap?.()) {
          event.preventDefault();
          return;
        }
      }
      if (!isTextInput(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey && event.key?.toLowerCase() === "r") {
        if (plateSketchEdit?.toggleRelations?.()) {
          commandRegistration.syncSketchRelationsButton();
          event.preventDefault();
          return;
        }
      }
      if (handleViewerKeyDelete(event)) return;
      if (!isTextInput(event.target) && matchesShortcut(event, shortcutSetting(runtimeSettings.shortcuts?.commands, "createTrim", "T"))) {
        if (!commandController?.activeCommand?.() && !trimCreate?.active?.()) {
          viewerApp.runCommand("model.trim.create");
          event.preventDefault();
        }
        return;
      }
      if (matchesShortcut(event, shortcutSetting(runtimeSettings.shortcuts?.memberEdit, "confirmTransform", "Enter")) && memberEdit.confirmPendingTransform()) {
        event.preventDefault();
        return;
      }
      const cancelCommandBinding = shortcutSetting(runtimeSettings.shortcuts?.commands, "cancel", "Escape");
      const cancelTransformBinding = shortcutSetting(runtimeSettings.shortcuts?.memberEdit, "cancelTransform", cancelCommandBinding);
      const cancelCommand = matchesShortcut(event, cancelCommandBinding);
      const cancelTransform = matchesShortcut(event, cancelTransformBinding);
      if (!cancelCommand && !cancelTransform) return;
      if (cancelCommand && trimCreate?.cancel()) {
        trimJointEditorApi?.clear();
        commandRegistration.setActiveModelingCommand(null);
        event.preventDefault();
        return;
      }
      if (cancelTransform && memberEdit.cancelPendingTransform()) {
        event.preventDefault();
        return;
      }
      if (cancelCommand && dimensionEdit.clearDimension()) {
        event.preventDefault();
        return;
      }
      if (cancelCommand && !commandController?.activeCommand?.() && !trimCreate?.active?.() && plateSketchEdit?.clearSelection?.()) {
        event.preventDefault();
        return;
      }
    };
    addDomListener(window, "keydown", handleViewerKeydown, { capture: true });
    addDomListener(document, "keydown", handleViewerKeydown, { capture: true });
    addDomListener(document, "keyup", (event) => {
      if (event.defaultPrevented) return;
      handleViewerKeyDelete(event);
    }, { capture: true });

    renderProject(api.project());
    qaBridge.mountQaApi({ api, profiles, snapManager });
    qaBridge.applyQaView(api.project()).catch((error) => console.error(error));
    if (libraryPanel) libraryPanel.hidden = false;
    connectionComponentBrowserUi = trackDisposable(mountSmartComponentBrowser({
      root: connectionComponentLibraryPanel || libraryPanel,
      app: viewerApp,
      api,
      smartComponentCatalog,
      selection,
      kindFilter: "connection",
      panelSpec: SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC,
      previewService: smartComponentPreviewService,
      onPresetSelected: (item) => showSmartComponentPresetEditor(item.id),
      onProjectChange: handleProjectChange,
      onSmartComponentCreated: (smartComponentId) => showSmartComponentEditor(smartComponentId, { inspectorPanel: "component" }),
      onStatusChange: updateModelingStatus
    }));
    smartComponentBrowserUi = trackDisposable(mountSmartComponentBrowser({
      root: smartComponentLibraryPanel || libraryPanel,
      app: viewerApp,
      api,
      smartComponentCatalog,
      selection,
      excludeKindFilter: "connection",
      onProjectChange: handleProjectChange,
      onSmartComponentCreated: (smartComponentId) => showSmartComponentEditor(smartComponentId, { inspectorPanel: "component" }),
      onStatusChange: updateModelingStatus
    }));
    featureEditorApi = trackDisposable(mountFeatureEditorPanel({
      panel: featureEditorPanel,
      api,
      selection,
      onLocalObjectProjectChange: handleLocalObjectProjectChange
    }));
    trimJointEditorApi = trackDisposable(mountTrimJointEditorPanel({
      panel: trimJointEditorPanel,
      api,
      profiles: profiles.profiles,
      selection,
      onProjectChange: handleProjectChange,
      onLocalObjectProjectChange: handleLocalObjectProjectChange,
      onDraftPreviewChange: handleTrimDraftPreviewChange,
      onFocusChange: () => renderProjectNow(api.project()),
      onEmptyRender: () => {
        const selectedObjectId = editorApi?.selectedState?.().objectId || "";
        const selectedEntry = selectedObjectId ? api.project().objectIndex?.[selectedObjectId] : null;
        if (selectedEntry?.collection === "trimJoints") {
          editorApi?.clearSelection?.();
          return;
        }
        editorApi?.refresh?.();
      },
      onCreateModeEnd: (detail = {}) => {
        const createdTrimJointId = detail.created && detail.trimJointId ? detail.trimJointId : null;
        trimCreate?.finish?.(createdTrimJointId ? `Trim created: ${createdTrimJointId}` : "No modeling command");
        if (!createdTrimJointId) return;
        focusedMemberId = null;
        dimensionEdit?.clearDimension({ render: false });
        clearMemberEditSilently();
        if (typeof editorApi?.selectObject === "function") {
          editorApi.selectObject(createdTrimJointId, { inspectorPanel: "properties", operationId: detail.operationId || null });
        } else {
          trimJointEditorApi?.selectTrimJoint(createdTrimJointId, { operationId: detail.operationId || null });
          workspaceBindings.showInspectorProperties({ notify: false });
        }
      }
    }));
    editorApi = trackDisposable(mountEditorUi({
      panel: objectEditor,
      app: viewerApp,
      api,
      profiles: profiles.profiles,
      materials: materials.materials,
      selection,
      memberEdit,
      smartComponentHighlightObjectIds: (smartComponentId) => smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId)),
      previewService: smartComponentPreviewService,
      onProjectChange: handleProjectChange,
      onLocalMemberProjectChange: handleLocalObjectProjectChange,
      onSmartComponentSelected: (smartComponentId, options) => {
        focusedMemberId = null;
        showSmartComponentEditor(smartComponentId, options);
        refreshSelectionSurfaces();
      },
      onSmartComponentDeleted: () => {
        clearSmartComponentEditor();
        referencePlaneEdit?.clear({ overlay: true });
        refreshSelectionSurfaces();
      },
      onObjectSelected: (objectId, detail = {}) => {
        refreshSelectionSurfaces();
        workspaceBindings.showInspectorProperties();
        clearSmartComponentEditor();
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection === "features") {
          trimJointEditorApi?.clear();
          featureEditorApi?.selectFeature(objectId);
          if (detail.inspectorPanel === "feature") workspaceBindings.showInspectorContext("feature", { focus: false, status: true });
          referencePlaneEdit?.selectObject(objectId);
          const featureSketchSelected = plateSketchEdit?.selectObject(objectId, { sketchMode: detail.sketchMode, notify: false });
          if (!featureSketchSelected) plateSketchEdit?.clear({ overlay: true });
          commandRegistration.syncSketchRelationsButton();
        } else if (entry?.collection === "trimJoints") {
          featureEditorApi?.clear();
          referencePlaneEdit?.clear({ overlay: true });
          plateSketchEdit?.clear({ overlay: true });
          trimJointEditorApi?.selectTrimJoint(objectId, { operationId: detail.operationId, regionKey: detail.regionKey });
          workspaceBindings.showInspectorProperties({ notify: detail.inspectorPanel === "properties" });
        } else if (entry?.collection === "plates") {
          referencePlaneEdit?.clear({ overlay: true });
          featureEditorApi?.clear();
          trimJointEditorApi?.clear();
          plateSketchEdit?.selectObject(objectId, { sketchMode: detail.sketchMode, notify: false });
          if (detail.relationId) plateSketchEdit?.selectRelation(detail.relationId, { notify: false });
          else if (detail.clearSketchSelection) plateSketchEdit?.clearSelection({ notify: false });
          else if (detail.edgeIds?.length || detail.vertexIds?.length) {
            plateSketchEdit?.selectEntities({ edgeIds: detail.edgeIds, vertexIds: detail.vertexIds }, { notify: false, sketchMode: detail.sketchMode });
          }
          commandRegistration.syncSketchRelationsButton();
        } else {
          clearAuxiliaryEditors({ overlay: true });
        commandRegistration.syncSketchRelationsButton();
        }
      },
      onObjectCleared: () => {
        clearAuxiliaryEditors({ overlay: true });
        commandRegistration.syncSketchRelationsButton();
        refreshSelectionSurfaces();
      }
    }));
    modelBrowserUi = trackDisposable(mountModelBrowser({
      root: modelBrowserRoot,
      app: viewerApp,
      onSelectObject: (objectId) => {
        if (trimJointEditorApi?.selectObjectForActivePick?.(objectId)) {
          workspaceBindings.showInspectorProperties({ notify: false });
          refreshSelectionSurfaces();
          return true;
        }
        return viewerApp.selectObject(objectId);
      },
      onSelectSmartComponent: (smartComponentId) => viewerApp.selectSmartComponent(smartComponentId, { inspectorPanel: "component" }),
      onFocusObject: (objectId) => viewerApp.focusSelection([objectId]),
      onFocusSmartComponent: (smartComponentId) => {
        const objectIds = smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId));
        return viewerApp.focusSelection(objectIds);
      },
      onStatusChange: updateModelingStatus
    }));
    projectPropertiesPanelUi = trackDisposable(mountProjectPropertiesPanel({
      root: projectPropertiesPanelRoot,
      app: viewerApp
    }));
    projectFilesPanelUi = trackDisposable(mountProjectFilesPanel({
      root: projectFilesPanelRoot,
      app: viewerApp,
      sourceBaseUrl: projectUrl.href,
      sources: projectDataSources()
    }));
    projectDataPanelUi = trackDisposable(mountProjectDataPanel({
      root: projectDataPanelRoot,
      app: viewerApp,
      libraries: { profiles, materials, fasteners, frames },
      smartComponentCatalog,
      onRowAction: ({ action, target }) => {
        if (action === "showCollection") {
          workspaceBindings.showDataDockTab("model");
          const shown = modelBrowserUi?.showCollection?.(target);
          updateModelingStatus(shown === false ? `Model collection not found: ${target}` : `Model browser: ${target}`);
        } else if (action === "showComponents") {
          workspaceBindings.showDataDockTab("components");
        }
      }
    }));
    if (libraryPanel) {
      workspaceBindings.mountDataDockTabs();
    }

    if (initialQaSelectObject) {
      try {
        editorApi.selectObject(initialQaSelectObject);
        refreshSelectionSurfaces();
        document.documentElement.dataset.qaSelectedObject = initialQaSelectObject;
        const fitQaSelectedObject = () => {
          const points = viewer.objectPoints([initialQaSelectObject]);
          if (points.length) viewer.fitPoints(points, { padding: 0.7, minSpan: 220 });
        };
        fitQaSelectedObject();
        window.requestAnimationFrame(() => window.requestAnimationFrame(fitQaSelectedObject));
        consumeQaSelectObjectUrlParam();
      } catch (error) {
        document.documentElement.dataset.qaSelectedObject = JSON.stringify({ error: error.message });
        console.warn(error);
      }
    }

    customPanel.hidden = true;

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

main();
