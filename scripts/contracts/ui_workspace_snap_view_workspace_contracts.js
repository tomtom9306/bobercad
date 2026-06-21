const fs = require("fs");
const path = require("path");
const { validateValue } = require("../validate_json_schema");
const { ROOT, fail, parseModelCollections, readJson, stripCssComments, lineNumberAt, readUiContractTextFixtures } = require("./ui_contract_helpers");

function checkSnapViewWorkspaceContracts(context) {
  const {
    errors,
    workspaceRelative,
    registryPath,
    commandGroupMetadataPath,
    bottomStripMetadataPath,
    dataSurfaceMetadataPath,
    projectDataMetadataPath,
    dataDockMetadataPath,
    inspectorDockMetadataPath,
    inspectorPropertyMetadataPath,
    trimOperationMetadataPath,
    inspectorPropertyBindingsPath,
    generatedPropertyBindingsPath,
    generatedPropertiesPanelPath,
    modelBrowserPath,
    modelBrowserMetadataPath,
    smartComponentBrowserMetadataPath,
    leftDockResultMetadataPath,
    commandPaletteMetadataPath,
    modelCollectionMetadataPath,
    snapMetadataPath,
    settingsStripMetadataPath,
    viewMetadataPath,
    workspaceStoragePath,
    workspaceCustomizerPath,
    snapSelectionManagerPath,
    iconRegistryPath,
    workspace,
    workspaceSchema,
    registry,
    commandGroupMetadata,
    bottomStripMetadata,
    dataSurfaceMetadata,
    projectDataMetadata,
    dataDockMetadata,
    inspectorDockMetadata,
    inspectorPropertyMetadata,
    trimOperationMetadata,
    inspectorPropertyBindings,
    generatedPropertyBindings,
    modelBrowser,
    modelBrowserMetadata,
    smartComponentBrowserMetadata,
    leftDockResultMetadata,
    commandPaletteMetadata,
    modelCollectionMetadata,
    snapMetadata,
    settingsStripMetadata,
    viewMetadata,
    workspaceStorage,
    workspaceCustomizer,
    snapSelectionManager,
    iconRegistry,
    commands,
    commandIdPattern,
    commandIds,
    defaultToolbarIds,
    commandById,
    featureNavbarCommands,
    iconNames,
    groupIds
  } = context;
  const {
    uiElementsText,
    commandPaletteText,
    viewerEditorPanelsText,
    inspectorDockCssText,
    designTokensText,
    workspaceShellText,
    viewerIndexText,
    viewerRuntimeTextForInspector,
    viewerRuntimeIntegrationText
  } = readUiContractTextFixtures(context);
  const snapScopeModes = (snapMetadata.SNAP_SCOPE_MODES || []).map((mode) => mode.id);
  for (const mode of snapScopeModes) {
    const commandId = `selection.scope.${mode}`;
    const command = commandById.get(commandId);
    if (!command) {
      fail(errors, `UI command registry is missing ${commandId}`);
      continue;
    }
    if (command.snapScopeMode !== mode || !command.snapScopePatch) {
      fail(errors, `UI command ${commandId} must declare snapScopeMode and snapScopePatch`);
    }
    if (command.toolbarPin !== true) {
      fail(errors, `UI command ${commandId} must be eligible for user toolbar pinning`);
    }
  }
  const snapTargetKeys = (snapMetadata.SNAP_TARGET_SPECS || []).map((target) => target.key);
  const defaultSnapScope = snapSelectionManager.DEFAULT_SNAP_SCOPE || {};
  for (const filter of snapMetadata.SNAP_FILTER_SPECS || []) {
    if (!Object.hasOwn(defaultSnapScope, filter.key)) {
      fail(errors, `snap-metadata filter ${filter.key} is not supported by DEFAULT_SNAP_SCOPE`);
    }
  }
  if (defaultSnapScope.welds !== false || defaultSnapScope.trimJoints !== false) {
    fail(errors, "DEFAULT_SNAP_SCOPE should keep welds and trimJoints disabled until first-class UI/providers are available");
  }
  for (const target of snapTargetKeys) {
    const commandId = `settings.snapTarget.${target}.toggle`;
    const command = commandById.get(commandId);
    if (!command) {
      fail(errors, `UI command registry is missing ${commandId}`);
      continue;
    }
    if (command.snapTarget !== target) fail(errors, `UI command ${commandId} must declare snapTarget ${target}`);
  }
  const registryScopeModes = (registry.SNAP_SCOPE_COMMANDS || []).map((command) => command.snapScopeMode);
  if (JSON.stringify(registryScopeModes) !== JSON.stringify(snapScopeModes)) {
    fail(errors, "UI command registry scope commands must come from snap-metadata SNAP_SCOPE_MODES");
  }
  const registryTargetKeys = (registry.SNAP_TARGET_COMMANDS || []).map((command) => command.snapTarget);
  if (JSON.stringify(registryTargetKeys) !== JSON.stringify(snapTargetKeys)) {
    fail(errors, "UI command registry snap target commands must come from snap-metadata SNAP_TARGET_SPECS");
  }
  const displayModeIds = (viewMetadata.DISPLAY_MODE_SPECS || []).map((mode) => mode.id);
  const viewOrientationIds = (viewMetadata.VIEW_ORIENTATION_SPECS || []).map((orientation) => orientation.id);
  if (
    viewMetadata.VIEW_ORIENTATION_FREE_ID !== "custom"
    || viewMetadata.normalizeViewOrientationState?.("custom") !== "custom"
    || viewMetadata.activeViewOrientation?.("custom") !== ""
    || viewMetadata.activeViewOrientation?.("top") !== "top"
    || viewMetadata.normalizeViewOrientation?.("custom") !== "iso"
  ) {
    fail(errors, "view-metadata must own the shared custom/free orientation state helpers while command orientation fallback remains iso");
  }
  const settingsStripGroupIds = new Set((settingsStripMetadata.VIEWER_SETTINGS_STRIP_GROUP_SPECS || []).map((group) => group.id));
  if (JSON.stringify([...settingsStripGroupIds]) !== JSON.stringify(["display", "view", "visibility"])) {
    fail(errors, `settings-strip-metadata must declare display, view, and visibility groups in order, got ${JSON.stringify([...settingsStripGroupIds])}`);
  }
  for (const group of settingsStripMetadata.VIEWER_SETTINGS_STRIP_GROUP_SPECS || []) {
    if (!group.id || !group.label || !group.icon || !group.description || !Number.isFinite(group.order)) {
      fail(errors, `settings-strip-metadata group must declare id, label, icon, description, and finite order: ${JSON.stringify(group)}`);
    }
    if (group.icon && !iconNames.has(group.icon)) fail(errors, `settings-strip-metadata group ${group.id} references unknown icon: ${group.icon}`);
  }
  for (const mode of viewMetadata.DISPLAY_MODE_SPECS || []) {
    if (!mode.id || !mode.label || !mode.title || !mode.description || !mode.icon || !mode.settingsStripGroup) {
      fail(errors, `view-metadata display mode must declare id, label, title, description, icon, and settingsStripGroup: ${JSON.stringify(mode)}`);
    }
    if (!settingsStripGroupIds.has(mode.settingsStripGroup)) fail(errors, `view-metadata display mode ${mode.id} references unknown settings strip group: ${mode.settingsStripGroup}`);
    if (!mode.settingsStripLabel || !Number.isFinite(mode.settingsStripOrder)) {
      fail(errors, `view-metadata display mode ${mode.id} must declare settingsStripLabel and finite settingsStripOrder`);
    }
    if (mode.icon && !iconNames.has(mode.icon)) fail(errors, `view-metadata display mode ${mode.id} references unknown icon: ${mode.icon}`);
  }
  for (const orientation of viewMetadata.VIEW_ORIENTATION_SPECS || []) {
    if (!orientation.id || !orientation.label || !orientation.title || !orientation.description) {
      fail(errors, `view-metadata orientation must declare id, label, title, and description: ${JSON.stringify(orientation)}`);
    }
    if (orientation.settingsStripGroup) {
      if (!settingsStripGroupIds.has(orientation.settingsStripGroup)) fail(errors, `view-metadata orientation ${orientation.id} references unknown settings strip group: ${orientation.settingsStripGroup}`);
      if (!orientation.settingsStripLabel || !Number.isFinite(orientation.settingsStripOrder)) {
        fail(errors, `view-metadata strip orientation ${orientation.id} must declare settingsStripLabel and finite settingsStripOrder`);
      }
    }
  }
  const stripOrientationIds = (viewMetadata.VIEW_ORIENTATION_SPECS || []).filter((orientation) => orientation.settingsStripGroup).map((orientation) => orientation.id);
  if (JSON.stringify(stripOrientationIds) !== JSON.stringify(["iso", "top", "front", "right"])) {
    fail(errors, `view-metadata settings strip orientations must stay compact as iso/top/front/right, got ${JSON.stringify(stripOrientationIds)}`);
  }
  const registryDisplayModeIds = (registry.DISPLAY_MODE_COMMANDS || []).map((command) => command.displayMode);
  if (JSON.stringify(registryDisplayModeIds) !== JSON.stringify(displayModeIds)) {
    fail(errors, "UI command registry display mode commands must come from view-metadata DISPLAY_MODE_SPECS");
  }
  const registryViewOrientationIds = (registry.VIEW_ORIENTATION_COMMANDS || []).map((command) => command.viewOrientation);
  if (JSON.stringify(registryViewOrientationIds) !== JSON.stringify(viewOrientationIds)) {
    fail(errors, "UI command registry orientation commands must come from view-metadata VIEW_ORIENTATION_SPECS");
  }
  const expectedRenderVisibilityCommands = [
    { id: "settings.visibility.cuts.toggle", renderVisibilityKey: "cuttingObjects", label: "Cuts", icon: "feature", settingsStripOrder: 0 },
    { id: "settings.visibility.planes.toggle", renderVisibilityKey: "referencePlanes", label: "Planes", icon: "reference-plane", settingsStripOrder: 1 },
    { id: "settings.visibility.grids.toggle", renderVisibilityKey: "grids", label: "Grids", icon: "grid", settingsStripOrder: 2 },
    { id: "settings.visibility.fasteners.toggle", renderVisibilityKey: "fasteners", label: "Fasteners", icon: "fastener", settingsStripOrder: 3 }
  ];
  const registryRenderVisibilityCommandIds = (registry.RENDER_VISIBILITY_COMMANDS || []).map((command) => command.id);
  if (JSON.stringify(registryRenderVisibilityCommandIds) !== JSON.stringify(expectedRenderVisibilityCommands.map((command) => command.id))) {
    fail(errors, `UI command registry render visibility commands must stay compact and ordered, got ${JSON.stringify(registryRenderVisibilityCommandIds)}`);
  }
  for (const expected of expectedRenderVisibilityCommands) {
    const command = commandById.get(expected.id);
    if (!command) {
      fail(errors, `UI command registry is missing ${expected.id}`);
      continue;
    }
    for (const key of ["renderVisibilityKey", "label", "icon", "settingsStripOrder"]) {
      if (command[key] !== expected[key]) fail(errors, `UI render visibility command ${expected.id} must declare ${key}=${expected[key]}`);
    }
    if (command.settingsStripGroup !== "visibility" || !command.settingsStripLabel || !command.title || !command.description) {
      fail(errors, `UI render visibility command ${expected.id} must be a titled visibility settings-strip command`);
    }
  }
  for (const command of commands.filter((item) => item.settingsStripGroup)) {
    if (!settingsStripGroupIds.has(command.settingsStripGroup)) fail(errors, `UI settings strip command ${command.id} references unknown settings strip group: ${command.settingsStripGroup}`);
    if (!command.id || !command.title || !command.description || !command.icon || !command.settingsStripLabel || !Number.isFinite(command.settingsStripOrder)) {
      fail(errors, `UI settings strip command must declare id, title, description, icon, settingsStripLabel, and finite settingsStripOrder: ${JSON.stringify(command)}`);
    }
    if (!iconNames.has(command.icon)) fail(errors, `UI settings strip command ${command.id} references unknown icon: ${command.icon}`);
  }
  const stripOrdersByGroup = new Map();
  for (const command of commands.filter((item) => item.settingsStripGroup)) {
    const orders = stripOrdersByGroup.get(command.settingsStripGroup) || new Set();
    if (orders.has(command.settingsStripOrder)) fail(errors, `UI settings strip group ${command.settingsStripGroup} has duplicate order ${command.settingsStripOrder}`);
    orders.add(command.settingsStripOrder);
    stripOrdersByGroup.set(command.settingsStripGroup, orders);
  }
  for (const spec of viewMetadata.DISPLAY_MODE_SPECS || []) {
    const command = (registry.DISPLAY_MODE_COMMANDS || []).find((item) => item.displayMode === spec.id);
    for (const key of ["label", "title", "description", "icon", "settingsStripGroup", "settingsStripLabel", "settingsStripOrder"]) {
      if (command?.[key] !== spec[key]) fail(errors, `UI display mode command ${spec.id} must copy ${key} from view-metadata`);
    }
  }
  for (const spec of viewMetadata.VIEW_ORIENTATION_SPECS || []) {
    const command = (registry.VIEW_ORIENTATION_COMMANDS || []).find((item) => item.viewOrientation === spec.id);
    if (command?.title !== spec.title || command?.description !== spec.description) {
      fail(errors, `UI orientation command ${spec.id} must copy title and description from view-metadata`);
    }
    for (const key of ["settingsStripGroup", "settingsStripLabel", "settingsStripOrder"]) {
      if (command?.[key] !== spec[key]) fail(errors, `UI orientation command ${spec.id} must copy ${key} from view-metadata`);
    }
  }
  const viewerRuntimeText = viewerRuntimeIntegrationText;
  const viewerSettingsStripText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.mjs"), "utf8");
  const viewerSettingsStripCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.css"), "utf8");
  const sceneGeometryBuilderText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/scene-geometry-builder.mjs"), "utf8");
  const sceneAnnotationMetadataText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/scene-annotation-metadata.mjs"), "utf8");
  const sceneDatumReferenceAssemblyText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/scene-datum-reference-assembly.mjs"), "utf8");
  const sceneObjectGeometryAdaptersText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/scene-object-geometry-adapters.mjs"), "utf8");
  const viewerSettingsBandIndex = viewerIndexText.indexOf('class="bc-viewer-settings-band"');
  const viewerSettingsStripIndex = viewerIndexText.indexOf('id="viewer-settings-strip"');
  const toolbarBandIndex = viewerIndexText.indexOf('class="bc-toolbar-band"');
  const modelingToolbarIndex = viewerIndexText.indexOf('id="modeling-toolbar"');
  if (
    viewerSettingsBandIndex < 0
    || viewerSettingsStripIndex < viewerSettingsBandIndex
    || toolbarBandIndex < 0
    || viewerSettingsStripIndex > toolbarBandIndex
    || modelingToolbarIndex < toolbarBandIndex
    || viewerIndexText.slice(toolbarBandIndex, modelingToolbarIndex).includes('id="viewer-settings-strip"')
  ) {
    fail(errors, "Viewer settings strip must live in a fixed bc-viewer-settings-band under the top navbar, not inside the dockable modeling toolbar band");
  }
  if (
    !designTokensText.includes("--bc-viewer-settings-band-height:")
    || !designTokensText.includes("--bc-shell-viewer-settings-top-offset:")
    || !designTokensText.includes("--bc-shell-viewer-settings-top-offset-mobile:")
    || !designTokensText.includes("--bc-shell-toolbar-top-offset: calc(var(--bc-shell-topbar-height) + var(--bc-viewer-settings-band-height)")
    || !workspaceShellText.includes(".bc-viewer-settings-band")
    || !workspaceShellText.includes("top: var(--bc-shell-viewer-settings-top-offset)")
    || !workspaceShellText.includes("top: var(--bc-shell-viewer-settings-top-offset-mobile)")
  ) {
    fail(errors, "Viewer settings strip must have its own design-system shell band and toolbar offsets");
  }
  if (
    !viewerSettingsStripText.includes("segmentedControl")
    || !viewerSettingsStripText.includes("settings-strip-metadata.mjs")
    || !viewerSettingsStripText.includes("commands.filter((item) => item?.settingsStripGroup)")
    || !viewerSettingsStripText.includes("settingsStripLabel")
    || !viewerSettingsStripText.includes("settingsStripOrder")
    || !viewerSettingsStripText.includes("normalizeViewerSettingsStripWorkspace")
    || !viewerSettingsStripText.includes("viewerSettingsStripGroupSpec")
    || !viewerSettingsStripText.includes("viewerSettingsStripVisibleGroupIds")
    || !viewerSettingsStripText.includes("setWorkspace")
    || !viewerSettingsStripText.includes("command.icon")
    || !viewerSettingsStripText.includes("command.active")
    || !viewerSettingsStripText.includes("command.enabled")
    || !viewerSettingsStripText.includes("command.run")
    || !viewerSettingsStripText.includes("normalizeViewOrientation")
    || !viewerSettingsStripText.includes("setOrientation")
    || !viewerSettingsStripText.includes("onOrientationChange")
    || !viewerSettingsStripText.includes("view.orientation.")
  ) {
    fail(errors, "Viewer settings strip must stay command-driven, workspace-filtered, metadata-grouped, and support orientation state");
  }
  if (
    viewerSettingsStripText.includes("bc-viewer-settings-group-icon")
    || viewerSettingsStripText.includes("createIcon(groupSpec")
    || viewerSettingsStripCssText.includes(".bc-viewer-settings-group-icon")
    || viewerSettingsStripCssText.includes(".bc-viewer-settings-label")
  ) {
    fail(errors, "Viewer settings strip must keep visible content clickable; group labels/icons stay out of the strip and command buttons carry the SVGs");
  }
  for (const token of ["../../engine/", "../../rendering/", "viewer-runtime", "createWebglViewer", "buildScene", "projectUrl", "settingsUrl", "viewer-settings.json", "fetch(", "data/projects"]) {
    if (viewerSettingsStripText.includes(token)) fail(errors, `Viewer settings strip must stay decoupled from engine/rendering/project JSON: ${token}`);
  }
  if (!viewerRuntimeText.includes("snapScopeCommandState(command)") || !viewerRuntimeText.includes("snapTargetCommandState(command)")) {
    fail(errors, "Viewer runtime must expose selection scope and snap target command state");
  }
  if (
    viewerRuntimeText.includes("GRID_CREATE_DISABLED_REASON")
    || viewerRuntimeText.includes("Grid creator is not wired yet.")
    || !viewerRuntimeText.includes("function startGridCreate()")
    || !viewerRuntimeText.includes("function openGridEditor()")
    || viewerRuntimeText.includes("api.createGridSystem")
    || viewerRuntimeText.includes('"model.level.create"')
    || viewerRuntimeText.includes("startLevelCreate")
    || !viewerRuntimeText.includes("getEditorApi()?.selectObject?.(gridSystemId")
    || !viewerRuntimeText.includes("showInspectorProperties?.({ notify: true })")
    || !viewerRuntimeText.includes('"model.grid.create": () => startGridCreate()')
  ) {
    fail(errors, "Viewer Grid command must open the Properties grid editor without creating grid or level objects directly");
  }
  if (!viewerRuntimeText.includes("...snapScopeCommandHandlers") || !viewerRuntimeText.includes("...snapTargetCommandHandlers")) {
    fail(errors, "Viewer runtime must register selection scope and snap target command handlers");
  }
  if (
    !viewerRuntimeText.includes("renderVisibilityCommandState(command)")
    || !viewerRuntimeText.includes("toggleRenderVisibilityCommand")
    || !viewerRuntimeText.includes('settings.visibility.cuts.toggle')
    || !viewerRuntimeText.includes('settings.visibility.fasteners.toggle')
    || !viewerRuntimeText.includes('settings.visibility.grids.toggle')
    || !viewerRuntimeText.includes('settings.visibility.planes.toggle')
    || !viewerRuntimeText.includes("renderVisibilitySettings()[key] = nextVisible")
    || !viewerRuntimeText.includes("rerender(api.project())")
    || !viewerRuntimeText.includes("...renderVisibilityCommandHandlers")
  ) {
    fail(errors, "Viewer runtime must expose settings-strip render visibility state and handlers for cutting objects, fasteners, grids, and reference planes");
  }
  if (
    !sceneAnnotationMetadataText.includes('return renderVisibilityEnabled(scene, "cuttingObjects");')
    || !sceneAnnotationMetadataText.includes('return renderVisibilityEnabled(scene, "fasteners");')
    || !sceneAnnotationMetadataText.includes('return renderVisibilityEnabled(scene, "grids");')
    || !sceneAnnotationMetadataText.includes('return renderVisibilityEnabled(scene, "referencePlanes");')
    || !sceneGeometryBuilderText.includes("addGridSystems")
    || !sceneDatumReferenceAssemblyText.includes('operation.type === "plane-trim" && renderReferencePlanes')
    || !sceneDatumReferenceAssemblyText.includes("if (renderCuttingObjects) {")
    || !sceneGeometryBuilderText.includes("if (shouldRenderCuttingObjects(sceneData)) {")
    || !sceneObjectGeometryAdaptersText.includes("if (!shouldRenderFasteners(scene)) return;")
  ) {
    fail(errors, "Scene geometry builder must gate cutting-object visuals, fasteners, and reference-plane markers through render.visibility settings");
  }
  for (const localName of ["SNAP_TARGET_KEYS", "SNAP_SCOPE_COMMAND_SPECS", "SNAP_STRENGTH_VALUES"]) {
    if (viewerRuntimeText.includes(localName)) fail(errors, `Viewer runtime must derive ${localName} directly from snap-metadata instead of declaring it locally`);
  }
  if (
    !viewerRuntimeText.includes("data-dock-metadata.mjs")
    || !viewerRuntimeText.includes("dataDockTabsForWorkspace")
    || !viewerRuntimeText.includes("panelTabState?.(DATA_DOCK_PANEL_ID)")
    || !viewerRuntimeText.includes("leftDockTabs?.setTabs?.(dataDockTabsForWorkspace()")
    || !viewerRuntimeText.includes("setPanelTabVisible?.(DATA_DOCK_PANEL_ID, tabId, true")
  ) {
    fail(errors, "Viewer runtime must derive Data Dock tabs from workspace-normalized metadata");
  }
  if (
    viewerRuntimeText.includes("legacyActiveTabStorageKey")
    || viewerRuntimeText.includes("DATA_DOCK_LEGACY_TAB_STORAGE_KEY")
    || viewerRuntimeText.includes("bobercad.ui.left-dock.active-tab.v1")
  ) {
    fail(errors, "Viewer runtime must not preserve legacy Data Dock active-tab migration");
  }
  if (viewerRuntimeText.includes("tabs: DATA_DOCK_TABS.map((tab)")) {
    fail(errors, "Viewer runtime must not mount Data Dock tabs directly from raw DATA_DOCK_TABS order");
  }
  if (viewerRuntimeText.includes("LEFT_DOCK_TAB_STORAGE_KEY") || viewerRuntimeText.includes("const DATA_DOCK_TABS =")) {
    fail(errors, "Viewer runtime must not redeclare Data Dock tab metadata locally");
  }
  const dockTabsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/dock-tabs.mjs"), "utf8");
  if (!dockTabsText.includes("setTabs:") || !dockTabsText.includes("panelByTabId") || !dockTabsText.includes("activeTabId(options.activeTab")) {
    fail(errors, "Dock tabs must support workspace-driven tab list refresh and active-tab fallback");
  }
  if (dockTabsText.includes("localStorage") || dockTabsText.includes("storageKey") || dockTabsText.includes("persistActiveTab")) {
    fail(errors, "Dock tabs must be a workspace-driven shell widget, not a separate active-tab localStorage owner");
  }
  if (!viewerRuntimeText.includes("view-metadata.mjs") || !viewerRuntimeText.includes("DISPLAY_MODE_SPECS.map") || !viewerRuntimeText.includes("VIEW_ORIENTATION_SPECS.map")) {
    fail(errors, "Viewer runtime must derive display mode and view orientation handlers from view-metadata");
  }
  if (!viewerRuntimeText.includes("commands: () => commandRegistration.viewerCommandItems") || !viewerRuntimeText.includes("workspace: defaultWorkspace?.viewerSettingsStrip") || !viewerRuntimeText.includes("getViewerSettingsUi()?.setWorkspace?.(workspace?.viewerSettingsStrip)") || !viewerRuntimeText.includes("orientation: commandRegistration.viewOrientation()") || !viewerRuntimeText.includes("onOrientationChange") || !viewerRuntimeText.includes("setOrientation?.(viewOrientation)")) {
    fail(errors, "Viewer runtime must mount the settings strip from command items and keep orientation state synchronized");
  }
  const navCubeText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/nav-cube.mjs"), "utf8");
  const navCubeCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/nav-cube.css"), "utf8");
  const designTokensCss = stripCssComments(designTokensText);
  const workspaceShellCss = stripCssComments(workspaceShellText);
  const navCubeCss = stripCssComments(navCubeCssText);
  const themeLightCss = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/theme-light.css"), "utf8");
  const themeDarkCss = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/theme-dark.css"), "utf8");
  const viewerSettingsStripCss = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.css"), "utf8");
  const viewerSettingsStripTextForOrientation = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.mjs"), "utf8");
  if (
    !viewerRuntimeText.includes("normalizeViewOrientationState")
    || !viewerRuntimeText.includes("activeViewOrientation")
    || viewerRuntimeText.includes("const VIEW_ORIENTATION_ID_SET")
    || viewerRuntimeText.includes("function normalizeViewOrientationState")
    || viewerRuntimeText.includes("function activeViewOrientation")
    || !viewerRuntimeText.includes("previousActiveOrientation")
    || !viewerRuntimeText.includes("previousActiveOrientation !== activeViewOrientation(viewOrientation)")
    || !viewerRuntimeText.includes("syncCameraSurfaces(viewer.viewCamera?.())")
  ) {
    fail(errors, "Viewer runtime must use shared orientation free-state helpers and refresh command surfaces when active orientation changes");
  }
  if (!navCubeText.includes("VIEW_ORIENTATION_FREE_ID") || !navCubeText.includes("normalizeViewOrientationState") || navCubeText.includes('CUSTOM_ORIENTATION = "custom"')) {
    fail(errors, "Nav cube must use shared view-metadata free orientation state instead of local custom constants");
  }
  if (
    navCubeText.includes("pendingOrientation")
    || navCubeText.includes("orientation: event.target.closest")
    || /commitOrientation\(\s*pendingOrientation\s*\)/.test(navCubeText)
  ) {
    fail(errors, "Nav cube clicks must commit the clicked face button, not a pointerdown target captured before 3D hit testing settles");
  }
  for (const token of [
    "--bc-font-weight-semibold:",
    "--bc-shell-topbar-row-main-height:",
    "--bc-shell-topbar-row-menu-height:",
    "--bc-shell-topbar-row-feature-height:",
    "--bc-shell-topbar-height:",
    "--bc-shell-topbar-row-feature-min-height-mobile:",
    "--bc-shell-topbar-height-mobile:",
    "--bc-statusbar-height: 38px;",
    "--bc-shell-toolbar-top-offset:",
    "--bc-shell-toolbar-top-offset-mobile:",
    "--bc-shell-toolbar-bottom-offset:",
    "--bc-shell-dock-top-offset:",
    "--bc-shell-dock-top-offset-mobile:",
    "--bc-shell-dock-screen-margin:",
    "--bc-shell-floating-dock-screen-margin:",
    "--bc-shell-floating-dock-height:",
    "--bc-shell-floating-dock-max-height:",
    "--bc-shell-floating-dock-top-offset:",
    "--bc-shell-floating-dock-tall-height:",
    "--bc-nav-cube-surface-size:",
    "--bc-nav-cube-stage-size:",
    "--bc-nav-cube-model-size:",
    "--bc-nav-cube-perspective:",
    "--bc-nav-cube-surface-size-mobile:",
    "--bc-nav-cube-stage-size-mobile:",
    "--bc-nav-cube-model-size-mobile:"
  ]) {
    if (!designTokensCss.includes(token)) fail(errors, `Design-system tokens must own shell/nav-cube geometry token: ${token}`);
  }
  for (const token of [
    "grid-template-rows:",
    "var(--bc-shell-topbar-row-main-height)",
    "var(--bc-shell-topbar-row-menu-height)",
    "var(--bc-shell-topbar-row-feature-height)",
    "min-height: var(--bc-shell-topbar-height)",
    "top: var(--bc-shell-toolbar-top-offset)",
    "bottom: var(--bc-shell-toolbar-bottom-offset)",
    "top: var(--bc-shell-dock-top-offset)",
    "bottom: var(--bc-statusbar-height)",
    "calc(100vw - var(--bc-shell-dock-screen-margin))",
    "calc(100vw - var(--bc-shell-floating-dock-screen-margin))",
    "height: var(--bc-shell-floating-dock-height)",
    "max-height: var(--bc-shell-floating-dock-max-height)",
    "top: var(--bc-shell-floating-dock-top-offset)",
    "height: var(--bc-shell-floating-dock-tall-height)",
    "min-height: var(--bc-statusbar-height)",
    "minmax(var(--bc-shell-topbar-row-feature-min-height-mobile), auto)",
    "min-height: var(--bc-shell-topbar-height-mobile)",
    "top: var(--bc-shell-toolbar-top-offset-mobile)",
    "top: var(--bc-shell-dock-top-offset-mobile)"
  ]) {
    if (!workspaceShellCss.includes(token)) fail(errors, `Workspace shell CSS must consume design-system shell geometry token: ${token}`);
  }
  for (const legacyLiteral of [
    "grid-template-rows: 38px 28px 60px",
    "grid-template-rows: 38px 28px minmax(62px, auto)",
    "top: 140px",
    "top: 144px",
    "top: 142px",
    "top: 138px",
    "bottom: 38px",
    "bottom: 48px",
    "max-height: calc(100vh - 192px)",
    "calc(100vw - 36px)",
    "calc(100vw - 72px)"
  ]) {
    if (workspaceShellCss.includes(legacyLiteral)) fail(errors, `Workspace shell geometry must use design-system tokens instead of ${legacyLiteral}`);
  }
  if (!/\.bc-statusbar\s*\{[\s\S]*?min-height:\s*var\(--bc-statusbar-height\)/.test(workspaceShellCss)) {
    fail(errors, "Workspace shell status bar must consume --bc-statusbar-height for its min-height");
  }
  if (
    !themeLightCss.includes("--bc-shadow-toolbar-compact:")
    || !themeLightCss.includes("--bc-shadow-dock-reveal:")
    || !themeDarkCss.includes("--bc-shadow-toolbar-compact:")
    || !themeDarkCss.includes("--bc-shadow-dock-reveal:")
    || !viewerSettingsStripCss.includes("box-shadow: var(--bc-shadow-toolbar-compact)")
    || !workspaceShellCss.includes("drop-shadow(var(--bc-shadow-dock-reveal))")
    || viewerSettingsStripCss.includes("rgb(15 23 42")
    || workspaceShellCss.includes("rgb(15 23 42")
  ) {
    fail(errors, "Shell compact toolbar and dock reveal shadows must be theme tokens, not raw component CSS values");
  }
  for (const token of [
    "calc(var(--bc-space-6) + var(--bc-statusbar-height))",
    "width: var(--bc-nav-cube-surface-size)",
    "min-height: var(--bc-nav-cube-surface-size)",
    "--bc-nav-cube-size: var(--bc-nav-cube-model-size)",
    "width: var(--bc-nav-cube-stage-size)",
    "height: var(--bc-nav-cube-stage-size)",
    "perspective: var(--bc-nav-cube-perspective)",
    "width: var(--bc-nav-cube-surface-size-mobile)",
    "min-height: var(--bc-nav-cube-surface-size-mobile)",
    "--bc-nav-cube-size: var(--bc-nav-cube-model-size-mobile)",
    "width: var(--bc-nav-cube-stage-size-mobile)",
    "height: var(--bc-nav-cube-stage-size-mobile)"
  ]) {
    if (!navCubeCss.includes(token)) fail(errors, `Nav cube CSS must consume design-system geometry token: ${token}`);
  }
  if (navCubeCss.includes("var(--bc-statusbar-height,") || navCubeCss.includes("--bc-nav-cube-right-offset: calc(var(--bc-space-6) + 132px)")) {
    fail(errors, "Nav cube CSS must derive statusbar and toolbar clearance from design-system tokens, not local fallbacks");
  }
  if (
    !navCubeCssText.includes("--bc-nav-cube-right-offset")
    || !navCubeCssText.includes("--bc-nav-cube-left-offset")
    || !navCubeCssText.includes("--bc-nav-cube-top-offset")
    || !navCubeCssText.includes("--bc-nav-cube-bottom-offset")
    || !navCubeCssText.includes("bottom: var(--bc-nav-cube-bottom-offset)")
    || !navCubeCssText.includes("top: auto")
    || navCubeCssText.includes("top: 50%")
    || navCubeCssText.includes("translateY(-50%)")
  ) {
    fail(errors, "Nav cube CSS must anchor the control in the bottom-right with tokenized offsets, not centered on the right edge");
  }
  if (
    !viewerRuntimeText.includes("normalizeViewerOverlaysWorkspace")
    || !viewerRuntimeText.includes("applyViewerOverlayWorkspace")
    || !viewerRuntimeText.includes("applyViewerOverlayWorkspace(workspace?.viewerOverlays)")
    || !viewerRuntimeText.includes("applyViewerOverlayWorkspace(defaultWorkspace?.viewerOverlays)")
    || !viewerRuntimeText.includes("navCubeRoot.dataset.overlayVisible")
    || !viewerRuntimeText.includes("navCubeRoot.dataset.overlayCorner")
    || !navCubeCssText.includes('[data-overlay-visible="false"]')
    || !navCubeCssText.includes('[data-overlay-corner="bottom-left"]')
    || !navCubeCssText.includes('[data-overlay-corner="top-right"]')
    || !navCubeCssText.includes('[data-overlay-corner="top-left"]')
    || !navCubeCssText.includes("var(--bc-shell-toolbar-top-offset)")
    || !navCubeCssText.includes("var(--bc-shell-toolbar-top-offset-mobile)")
  ) {
    fail(errors, "Nav cube overlay visibility and corner placement must be workspace-owned and reflected through runtime data attributes plus tokenized CSS");
  }
  if (!viewerSettingsStripTextForOrientation.includes("activeViewOrientation") || viewerSettingsStripTextForOrientation.includes("const VIEW_ORIENTATION_IDS")) {
    fail(errors, "Viewer settings strip must use shared activeViewOrientation helper for compact orientation active state");
  }
  for (const localName of ["DISPLAY_MODE_VALUES", "VIEW_ORIENTATION_VALUES"]) {
    if (viewerRuntimeText.includes(localName)) fail(errors, `Viewer runtime must derive ${localName} directly from view-metadata instead of declaring it locally`);
  }
  if (viewerRuntimeText.includes('tab.id === "data"') || viewerRuntimeText.includes('tab.id === "model"')) {
    fail(errors, "Viewer runtime must use Data Dock panelElementId metadata instead of branching on tab ids");
  }
  for (const token of [
    "DATA_DOCK_PANEL_DESCRIPTION",
    "DATA_DOCK_PANEL_ICON",
    "DATA_DOCK_PANEL_DOCK",
    "DATA_DOCK_PANEL_DEFAULT_WIDTH",
    "DATA_DOCK_PANEL_MIN_WIDTH",
    "DATA_DOCK_PANEL_MAX_WIDTH",
    "DATA_DOCK_PANEL_DEFAULT_VISIBLE",
    "DATA_DOCK_PANEL_DEFAULT_PINNED"
  ]) {
    if (!viewerRuntimeText.includes(token)) {
      fail(errors, `Viewer runtime must derive Data Dock panel chrome from data-dock-metadata: ${token}`);
    }
  }
  const viewerCommandAdapterText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-command-adapter.mjs"), "utf8");
  if (!viewerCommandAdapterText.includes("data-dock-metadata.mjs") || !viewerCommandAdapterText.includes("DATA_DOCK_PANEL_ID") || !viewerCommandAdapterText.includes("DATA_DOCK_COMMAND_LABEL")) {
    fail(errors, "Viewer command adapter must use Data Dock metadata for the legacy panel toggle");
  }
  if (!viewerCommandAdapterText.includes("inspector-dock-metadata.mjs") || !viewerCommandAdapterText.includes("INSPECTOR_PANEL_ID") || !viewerCommandAdapterText.includes("INSPECTOR_COMMAND_LABEL")) {
    fail(errors, "Viewer command adapter must use Inspector Dock metadata for the legacy panel toggle");
  }
  if (viewerCommandAdapterText.includes('toggleDockPanel("inspector"') || viewerCommandAdapterText.includes('"Inspector"),')) {
    fail(errors, "Viewer command adapter must not hardcode Inspector Dock panel id or label");
  }
  if (!viewerCommandAdapterText.includes("command-group-metadata.mjs") || !viewerCommandAdapterText.includes("commandGroupLabel")) {
    fail(errors, "Viewer command adapter must use command group metadata for palette group labels");
  }
  const featureNavbarText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/feature-navbar.mjs"), "utf8");
  const featureNavbarCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/feature-navbar.css"), "utf8");
  if (!featureNavbarText.includes("command-group-metadata.mjs") || !featureNavbarText.includes("COMMAND_GROUP_ORDER")) {
    fail(errors, "Feature navbar must derive top-level groups from command-group-metadata");
  }
  if (!featureNavbarText.includes("resolveGroups(groups)")) {
    fail(errors, "Feature navbar must resolve group order dynamically so workspace state can customize top navigation");
  }
  if (!featureNavbarText.includes("FEATURE_NAVBAR_SURFACE") || !featureNavbarText.includes("command?.navSurface !== FEATURE_NAVBAR_SURFACE")) {
    fail(errors, "Feature navbar must only render commands that explicitly opt into the feature-navbar surface");
  }
  if (!featureNavbarText.includes(".filter((group) => group?.commands?.length)")) {
    fail(errors, "Feature navbar must filter commandless workspace groups so top navigation never opens blank tabs");
  }
  if (featureNavbarText.includes("command.nav === false")) {
    fail(errors, "Feature navbar must not include commands by default through legacy nav=false filtering");
  }
  if (
    featureNavbarText.includes("DEFAULT_GROUP_ORDER")
    || featureNavbarText.includes("GROUP_LABELS")
    || featureNavbarText.includes("const RIBBON_SECTION_ORDER")
    || featureNavbarText.includes("const RIBBON_SECTION_LABELS")
    || featureNavbarText.includes("function inferRibbonSection")
    || !featureNavbarText.includes("commandRibbonSectionOrder")
    || !featureNavbarText.includes("commandRibbonSectionLabel")
    || !featureNavbarText.includes("inferCommandRibbonSection")
  ) {
    fail(errors, "Feature navbar must consume command-group metadata for command groups and ribbon sections instead of redeclaring shell heuristics locally");
  }
  for (const token of [
    "--bc-feature-nav-tab-height",
    "--bc-feature-nav-tab-max-width",
    "--bc-feature-nav-tab-max-width-medium",
    "--bc-feature-nav-tab-max-width-mobile",
    "--bc-feature-nav-tab-icon-size",
    "--bc-feature-nav-ribbon-min-height",
    "--bc-feature-ribbon-section-title-height",
    "--bc-feature-ribbon-section-title-font-size",
    "--bc-feature-ribbon-section-command-min-height",
    "--bc-feature-ribbon-command-width",
    "--bc-feature-ribbon-command-width-medium",
    "--bc-feature-ribbon-command-width-mobile",
    "--bc-feature-ribbon-command-font-size",
    "--bc-feature-ribbon-command-icon-box-size",
    "--bc-feature-ribbon-command-icon-size",
    "--bc-feature-ribbon-command-label-max-height"
  ]) {
    if (!designTokensText.includes(token)) fail(errors, `Feature navbar/ribbon sizing token is missing from design-system tokens: ${token}`);
  }
  if (
    !featureNavbarCssText.includes("var(--bc-feature-nav-tab-height)")
    || !featureNavbarCssText.includes("var(--bc-feature-nav-tab-max-width)")
    || !featureNavbarCssText.includes("var(--bc-feature-nav-tab-max-width-medium)")
    || !featureNavbarCssText.includes("var(--bc-feature-nav-tab-max-width-mobile)")
    || !featureNavbarCssText.includes("var(--bc-feature-nav-tab-icon-size)")
    || !featureNavbarCssText.includes("var(--bc-feature-nav-ribbon-min-height)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-section-title-height)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-section-title-font-size)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-section-command-min-height)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-width)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-width-medium)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-width-mobile)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-font-size)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-icon-box-size)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-icon-size)")
    || !featureNavbarCssText.includes("var(--bc-feature-ribbon-command-label-max-height)")
    || featureNavbarCssText.includes("grid-template-rows: 28px")
    || featureNavbarCssText.includes("minmax(58px")
    || featureNavbarCssText.includes("max-width: 132px")
    || featureNavbarCssText.includes("max-width: 112px")
    || featureNavbarCssText.includes("max-width: 96px")
    || featureNavbarCssText.includes("width: 60px")
    || featureNavbarCssText.includes("width: 58px")
    || featureNavbarCssText.includes("width: 56px")
    || featureNavbarCssText.includes("height: 28px")
    || featureNavbarCssText.includes("grid-template-rows: 17px")
    || featureNavbarCssText.includes("max-height: 23px")
  ) {
    fail(errors, "Feature navbar/ribbon compact geometry must inherit design-system sizing tokens instead of local fixed dimensions");
  }
  const workspaceCustomizerFiles = [
    "workspace-customizer-panel.mjs",
    "workspace-customizer-state.mjs",
    "workspace-customizer-dialog.mjs",
    "workspace-customizer-commands.mjs",
    "workspace-customizer-file-io.mjs",
    "workspace-customizer-labels.mjs",
    "workspace-customizer-manager.mjs",
    "workspace-customizer-mount.mjs",
    "workspace-customizer-ordering.mjs",
    "workspace-customizer-panel-dock.mjs",
    "workspace-customizer-toolbar-dom.mjs"
  ];
  const workspaceCustomizerText = workspaceCustomizerFiles
    .map((file) => fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell", file), "utf8"))
    .join("\n");
  const workspaceCustomizerCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/workspace-customizer.css"), "utf8");
  const modelingToolbarCommandStateText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"), "utf8");
  if (
    !uiElementsText.includes("export function applyCommandState")
    || !uiElementsText.includes("element.dataset.commandActive")
    || !uiElementsText.includes('element.setAttribute("aria-disabled"')
    || !uiElementsText.includes('element.setAttribute("aria-pressed"')
    || !modelingToolbarCommandStateText.includes("applyCommandState")
    || !viewerSettingsStripText.includes("applyCommandState")
    || !featureNavbarText.includes("applyCommandState")
    || !commandPaletteText.includes("applyCommandState")
    || !workspaceCustomizerText.includes("applyCommandState")
  ) {
    fail(errors, "Command visual state must be centralized through ui-elements applyCommandState across toolbar, settings strip, feature ribbon, palette, and workspace toolbar controls");
  }
  const workspaceCustomizerPrimitiveHelpers = [
    "workspaceCustomizerToggleRow",
    "workspaceCustomizerActionRow",
    "workspaceCustomizerRowActions",
    "workspaceCustomizerMoveButton",
    "workspaceCustomizerDragHandle",
    "bindWorkspaceCustomizerRowReorderDrag"
  ];
  for (const helper of workspaceCustomizerPrimitiveHelpers) {
    if (!uiElementsText.includes(`export function ${helper}`)) {
      fail(errors, `Workspace customizer design primitive must be exported from ui-elements.mjs: ${helper}`);
    }
    if (helper !== "workspaceCustomizerRowActions" && !workspaceCustomizerText.includes(helper)) {
      fail(errors, `Workspace customizer panel must consume shared design primitive: ${helper}`);
    }
  }
  if (
    !uiElementsText.includes('button.append(createIcon("drag-handle"))')
    || !uiElementsText.includes("document.elementFromPoint")
    || !uiElementsText.includes("sourceDatasetKey")
    || !uiElementsText.includes("targetDatasetKey")
    || !uiElementsText.includes("scopeDatasetKey")
    || !uiElementsText.includes("onReorder?.({")
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-row-toggle"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-row-actions"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-check"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-command-icon"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-command-copy"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-command-label"')
    || workspaceCustomizerText.includes('className = "bc-workspace-customizer-command-description"')
    || workspaceCustomizerText.includes('className = "bc-icon-button bc-workspace-customizer-move"')
    || workspaceCustomizerText.includes('className = "bc-icon-button bc-workspace-customizer-drag-handle"')
    || workspaceCustomizerText.includes('handle.append(createIcon("snap"))')
  ) {
    fail(errors, "Workspace customizer row, move, and drag-handle visuals must inherit shared design-system primitives");
  }
  for (const legacyDragHelper of [
    "bindPanelTabDrag",
    "bindCommandRowDrag",
    "bindFeatureNavbarGroupDrag",
    "bindToolbarGroupDrag",
    "bindBottomStripDrag",
    "bindViewerSettingsStripDrag"
  ]) {
    if (workspaceCustomizerText.includes(`function ${legacyDragHelper}`) || workspaceCustomizerText.includes(`${legacyDragHelper}(`)) {
      fail(errors, `Workspace customizer row drag pointer behavior must use bindWorkspaceCustomizerRowReorderDrag instead of local helper ${legacyDragHelper}`);
    }
  }
  for (const helper of [
    "shellChromeButton",
    "dockResizeHandleControl",
    "dockRevealToggleControl",
    "dockPinToggleControl",
    "toolbarOverflowMenuItemControl"
  ]) {
    if (!uiElementsText.includes(`export function ${helper}`)) {
      fail(errors, `Shell chrome control primitive must be exported from ui-elements.mjs: ${helper}`);
    }
    if (helper !== "shellChromeButton" && !workspaceCustomizerText.includes(helper)) {
      fail(errors, `Workspace shell chrome must consume shared design-system control primitive: ${helper}`);
    }
  }
  if (
    !uiElementsText.includes('className: "bc-dock-resize-handle"')
    || !uiElementsText.includes('className: "bc-dock-reveal-toggle"')
    || !uiElementsText.includes('className: "bc-dock-pin-toggle"')
    || !uiElementsText.includes('item.className = "bc-toolbar-overflow-item"')
    || !uiElementsText.includes('iconNode.className = "bc-toolbar-overflow-icon"')
    || !uiElementsText.includes('copy.className = "bc-toolbar-overflow-copy"')
    || !uiElementsText.includes('labelNode.className = "bc-toolbar-overflow-label"')
    || !uiElementsText.includes('descriptionNode.className = "bc-toolbar-overflow-description"')
    || workspaceCustomizerText.includes('className = "bc-dock-resize-handle"')
    || workspaceCustomizerText.includes('className = "bc-dock-reveal-toggle"')
    || workspaceCustomizerText.includes('className = "bc-dock-pin-toggle"')
    || workspaceCustomizerText.includes('item.className = "bc-toolbar-overflow-item"')
    || workspaceCustomizerText.includes('className = "bc-toolbar-overflow-icon"')
    || workspaceCustomizerText.includes('className = "bc-toolbar-overflow-copy"')
    || workspaceCustomizerText.includes('className = "bc-toolbar-overflow-label"')
    || workspaceCustomizerText.includes('className = "bc-toolbar-overflow-description"')
    || workspaceCustomizerText.includes("function panelRevealToggleIcon")
    || workspaceCustomizerText.includes("function panelPinToggleIcon")
  ) {
    fail(errors, "Dock resize, reveal, pin, and overflow shell controls must inherit shared design-system chrome primitives");
  }
  for (const token of [
    "--bc-control-height-tiny",
    "--bc-control-tile-size",
    "--bc-control-action-size",
    "--bc-control-icon-size",
    "--bc-control-icon-size-medium",
    "--bc-customizer-status-column",
    "--bc-customizer-icon-column"
  ]) {
    if (!designTokensText.includes(token)) fail(errors, `Design-system compact control sizing token is missing: ${token}`);
  }
  if (
    !workspaceCustomizerCssText.includes("var(--bc-customizer-status-column)")
    || !workspaceCustomizerCssText.includes("var(--bc-customizer-icon-column)")
    || !workspaceCustomizerCssText.includes("var(--bc-control-height-tiny)")
    || !workspaceCustomizerCssText.includes("var(--bc-control-action-size)")
    || !workspaceCustomizerCssText.includes("var(--bc-control-tile-size)")
    || !workspaceCustomizerCssText.includes("var(--bc-control-icon-size-medium)")
    || workspaceCustomizerCssText.includes("grid-template-columns: 42px")
    || workspaceCustomizerCssText.includes("width: 26px")
    || workspaceCustomizerCssText.includes("height: 26px")
    || workspaceCustomizerCssText.includes("width: 30px")
    || workspaceCustomizerCssText.includes("height: 30px")
  ) {
    fail(errors, "Workspace customizer compact row/control sizing must come from design-system density tokens");
  }
  if (
    !viewerSettingsStripCssText.includes("var(--bc-control-tile-size)")
    || !viewerSettingsStripCssText.includes("var(--bc-control-icon-size)")
    || viewerSettingsStripCssText.includes("min-height: 30px")
    || viewerSettingsStripCssText.includes("width: 30px")
    || viewerSettingsStripCssText.includes("height: 30px")
    || viewerSettingsStripCssText.includes("top: 36px")
  ) {
    fail(errors, "Viewer settings strip and compact toolbar sizing must come from design-system density tokens");
  }
  if (
    !workspaceCustomizerText.includes('id: "workspace.customize.open"')
    || /id: "workspace\.(?:customize\.open|reset|toolbar\.reset|import|export)"[\s\S]{0,320}navSurface: "feature-navbar"/.test(workspaceCustomizerText)
  ) {
    fail(errors, "Workspace customizer commands must stay out of the Tools top navbar while remaining available through the Settings action and command palette");
  }
  if (
    !workspaceCustomizerText.includes("segmentedControl")
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-segment-options"')
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-panel-dock-options"')
    || workspaceCustomizerText.includes('className = "bc-segment-button"')
    || /(^|\n)\s*\.bc-segment-button\b/.test(workspaceCustomizerCssText)
  ) {
    fail(errors, "Workspace customizer theme, density, and panel dock choices must use shared segmentedControl without owning global bc-segment-button CSS");
  }
  if (
    workspaceCustomizerText.includes('className: "bc-workspace-customizer-dock-options"')
    || workspaceCustomizerText.includes("Toolbar position")
    || workspaceCustomizerText.includes("setToolbarDock")
    || workspaceCustomizerText.includes("workspace.toolbarDock.")
    || workspaceCustomizerText.includes("toolbarDockFromPoint")
    || uiElementsText.includes("toolbarDragHandleControl")
    || uiElementsText.includes("bc-toolbar-drag-handle")
  ) {
    fail(errors, "Main toolbar placement must stay anchored to the default dock without user-facing docking controls or drag handles");
  }
  if (
    !workspaceCustomizerText.includes("topbarMenuButton(button")
    || !workspaceCustomizerText.includes('icon: "settings"')
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-trigger bc-topbar-menu-button"')
    || !workspaceCustomizerText.includes('labelClassName: "bc-topbar-menu-label"')
    || workspaceCustomizerText.includes('button.replaceChildren(document.createTextNode("Settings"))')
    || !workspaceShellText.includes(".bc-topbar-menu-button .bc-icon")
  ) {
    fail(errors, "Topbar Settings action must be SVG-backed with the shared topbar menu label recipe");
  }
  if (!workspaceCustomizerText.includes("normalizeNavigationWorkspace") || !workspaceCustomizerText.includes("navigationStateForStorage") || !workspaceCustomizerText.includes("COMMAND_GROUP_ORDER")) {
    fail(errors, "Workspace customizer must preserve navigation.featureNavbar workspace state using command group metadata");
  }
  if (
    !workspaceCustomizerText.includes("Top navigation")
    || !workspaceCustomizerText.includes("setFeatureNavbarGroupVisible")
    || !workspaceCustomizerText.includes("moveFeatureNavbarGroup")
    || !workspaceCustomizerText.includes("workspace.featureNavbar.${action}.${groupId}")
    || !workspaceCustomizerText.includes("workspace.featureNavbar.${action}")
    || !workspaceCustomizerText.includes("workspaceCustomizer.setFeatureNavbarGroupVisible?.(groupId, !visible)")
    || !workspaceCustomizerText.includes("setFeatureNavbarGroupVisible(groupId, visible)")
    || !workspaceCustomizerText.includes("onFeatureNavbarGroupVisibilityChange")
    || !workspaceCustomizerText.includes("onFeatureNavbarGroupMove")
    || !workspaceCustomizerText.includes("onFeatureNavbarGroupReorder")
    || !workspaceCustomizerText.includes("reorderFeatureNavbarGroup")
    || !workspaceCustomizerText.includes("featureNavbarGroupDragHandle")
    || !workspaceCustomizerText.includes('sourceDatasetKey: "featureNavbarDragHandle"')
    || !workspaceCustomizerText.includes('targetDatasetKey: "featureNavbarGroupId"')
    || !workspaceCustomizerText.includes("moveFeatureNavbarGroupBefore")
    || !workspaceCustomizerText.includes("commandGroupSpec")
  ) {
    fail(errors, "Workspace customizer must expose top feature-navbar group visibility and ordering/drag controls from command group metadata");
  }
  if (
    !workspaceCustomizerText.includes("Toolbar commands")
    || !workspaceCustomizerText.includes("Toolbar groups")
    || !workspaceCustomizerText.includes("groupIds: workspace.groupIds.slice()")
    || !workspaceCustomizerText.includes("groupIds: defaults.groupIds")
    || !workspaceCustomizerText.includes("normalizeToolbarGroupIds")
    || !workspaceCustomizerText.includes("onToolbarGroupMove")
    || !workspaceCustomizerText.includes("onToolbarGroupReorder")
    || !workspaceCustomizerText.includes("moveToolbarGroup")
    || !workspaceCustomizerText.includes("reorderToolbarGroup")
    || !workspaceCustomizerText.includes("toolbarGroupDragHandle")
    || !workspaceCustomizerText.includes('sourceDatasetKey: "toolbarGroupDragHandle"')
    || !workspaceCustomizerText.includes('targetDatasetKey: "toolbarGroupId"')
    || !workspaceCustomizerText.includes("moveToolbarGroupBefore")
    || !workspaceCustomizerText.includes("onCommandReorder")
    || !workspaceCustomizerText.includes("reorderToolbarCommand")
    || !workspaceCustomizerText.includes("commandRowDragHandle")
    || !workspaceCustomizerText.includes('sourceDatasetKey: "commandRowDragHandle"')
    || !workspaceCustomizerText.includes('targetDatasetKey: "commandId"')
    || !workspaceCustomizerText.includes("moveToolbarCommand(workspace")
  ) {
    fail(errors, "Workspace customizer must expose direct drag reorder controls for toolbar groups and command rows in the Workspace panel");
  }
  if (
    !workspaceCustomizerText.includes("WORKSPACE_TOOLBAR_GROUP_SELECTOR")
    || !workspaceCustomizerText.includes("data-workspace-toolbar-group")
    || !workspaceCustomizerText.includes("normalizeToolbarGroupIds(workspace.groupIds, orderedCommands)")
    || !workspaceCustomizerText.includes("commandGroupsById(orderedCommands)")
    || !workspaceCustomizerText.includes("ensureWorkspaceToolbarCommandGroup")
    || !workspaceCustomizerText.includes("collectWorkspaceToolbarButtons")
    || !workspaceCustomizerText.includes("workspaceToolbarCommandButtons(toolbar)")
    || !workspaceCustomizerText.includes("removeUnusedWorkspaceToolbarGroups")
    || !workspaceCustomizerText.includes("positionToolbarOverflow")
    || !workspaceCustomizerText.includes("lastWorkspaceToolbarGroup")
    || workspaceCustomizerText.includes('const group = toolbar.querySelector(".bc-toolbar-group")')
  ) {
    fail(errors, "Live modeling toolbar reconciliation must render workspace-managed command groups and keep overflow anchored after those groups");
  }
  if (
    !workspaceCustomizerText.includes('id: "workspace.toolbar.reset"')
    || !workspaceCustomizerText.includes('action: "workspace.toolbar.reset"')
    || !workspaceCustomizerText.includes("workspaceCustomizer.resetToolbar?.()")
    || !workspaceCustomizerText.includes("onToolbarReset")
    || !workspaceCustomizerText.includes('workspaceActionButton("Reset toolbar"')
    || !workspaceCustomizerText.includes("resetToolbar()")
    || !workspaceCustomizerText.includes("resetToolbar(customizer)")
    || !workspaceCustomizerText.includes("const defaults = defaultWorkspaceState()")
    || !workspaceCustomizerText.includes("commandIds: defaults.commandIds")
    || !workspaceCustomizerText.includes("hiddenCommandIds: defaults.hiddenCommandIds")
    || !workspaceCustomizerText.includes("groupIds: defaults.groupIds")
    || !workspaceCustomizerText.includes("collapsedGroups: defaults.collapsedGroups")
    || !workspaceCustomizerText.includes("dock: defaults.dock")
    || !workspaceCustomizerText.includes('setToolbarStatus("Toolbar reset.")')
  ) {
    fail(errors, "Workspace customizer must expose a toolbar-only reset command/action that restores default modeling toolbar state without resetting the whole workspace");
  }
  if (
    !workspaceCustomizerText.includes("onPanelPinChange")
    || !workspaceCustomizerText.includes("panelPinButton")
    || !workspaceCustomizerText.includes("panelPinCommands")
    || !workspaceCustomizerText.includes('WORKSPACE_PANEL_PIN_ACTION = "workspace.panel.pin"')
    || !workspaceCustomizerText.includes('WORKSPACE_PANEL_UNPIN_ACTION = "workspace.panel.unpin"')
    || !workspaceCustomizerText.includes("id: `${action}.${panel.id}`")
    || !workspaceCustomizerText.includes("setPanelPinned(panelId, pinned)")
    || !workspaceCustomizerText.includes("panelStateForStorage(state.panels)")
  ) {
    fail(errors, "Workspace customizer must expose panel pin/unpin controls through the Workspace panel, command search, and persisted panel state");
  }
  if (
    !workspaceCustomizerText.includes("onPanelDockChange")
    || !workspaceCustomizerText.includes("panelDockButtons")
    || !workspaceCustomizerText.includes("setPanelDock(panelId, dock)")
    || !workspaceCustomizerText.includes("normalizeWorkspacePanelState")
    || !workspaceCustomizerText.includes("normalizePanelDock")
    || !workspaceCustomizerText.includes("workspacePanelDock(panel, workspace")
    || !workspaceCustomizerText.includes("dataset.workspacePanelDock")
    || !workspaceCustomizerText.includes("dataset.workspacePanelSideDock")
    || !workspaceCustomizerText.includes("dock: panelWorkspace.dock")
  ) {
    fail(errors, "Workspace customizer must keep panel dock placement workspace-owned, visible in customization controls, and reflected onto panel host data attributes");
  }
  if (
    !workspaceShellText.includes('[data-workspace-panel-dock="right"]')
    || !workspaceShellText.includes('[data-workspace-panel-dock="bottom"]')
    || !workspaceShellText.includes('[data-workspace-panel-side-dock="false"]')
    || !workspaceShellText.includes(".bc-left-dock [data-inspector-context-panel]")
    || !workspaceShellText.includes(".bc-right-dock [data-inspector-context-panel]")
    || !workspaceShellText.includes(".bc-right-dock #library-panel")
  ) {
    fail(errors, "Workspace shell CSS must style workspace-driven panel dock placement and support Library/Inspector content under either side dock host");
  }
  for (const legacyInspectorSelector of ["#object-editor", "#feature-editor", "#trim-joint-editor", "#custom-panel"]) {
    if (workspaceShellText.includes(legacyInspectorSelector) || inspectorDockCssText.includes(legacyInspectorSelector) || viewerEditorPanelsText.includes(legacyInspectorSelector)) {
      fail(errors, `Inspector shell/editor CSS must use data-inspector-context-panel slots instead of legacy selector ${legacyInspectorSelector}`);
    }
  }
  if (
    !workspaceCustomizerText.includes("panelTabState")
    || !workspaceCustomizerText.includes("workspacePanelTabCommands")
    || !workspaceCustomizerText.includes("workspace.panelTab.${action}.${panelId}.${tab.id}")
    || !workspaceCustomizerText.includes("workspaceCustomizer.setPanelTabVisible?.(panelId, tab.id, !visible)")
    || !workspaceCustomizerText.includes("setPanelTabVisible")
    || !workspaceCustomizerText.includes("movePanelTab(")
    || !workspaceCustomizerText.includes("reorderPanelTab")
    || !workspaceCustomizerText.includes("panelTabDragHandle")
    || !workspaceCustomizerText.includes('sourceDatasetKey: "panelTabDragHandle"')
    || !workspaceCustomizerText.includes('targetDatasetKey: "panelTabId"')
    || !workspaceCustomizerText.includes('scopeDatasetKey: "panelTabPanelId"')
    || !workspaceCustomizerText.includes("movePanelTabBefore")
    || !workspaceCustomizerText.includes("normalizePanelHiddenTabIds")
    || !workspaceCustomizerText.includes("tabIds: tabIds.slice()")
    || !workspaceCustomizerText.includes("hiddenTabIds: (panelWorkspace.hiddenTabIds || []).slice()")
    || !workspaceCustomizerText.includes("panelStateForStorage(state.panels)")
  ) {
    fail(errors, "Workspace customizer must expose tabbed panel visibility/order/drag controls and persist tabIds/hiddenTabIds in panel workspace state");
  }
  if (!viewerRuntimeText.includes("visibleFeatureNavbarGroups") || !viewerRuntimeText.includes("groups: () => visibleFeatureNavbarGroups")) {
    fail(errors, "Viewer runtime must pass workspace-driven feature navbar groups into mountFeatureNavbar");
  }
  if (!viewerRuntimeText.includes("featureNavbar?.refresh?.()")) {
    fail(errors, "Viewer runtime must refresh the feature navbar when workspace navigation state changes");
  }
  for (const [relative, token] of [
    ["bobercad/app/ui/shell/status-bar.mjs", "BOTTOM_STRIP_DEFAULT_ITEM_IDS"],
    ["bobercad/app/ui/shell/workspace-customizer-manager.mjs", "bottomStripItemSpec"],
    ["bobercad/app/ui/viewer/viewer-runtime.mjs", "bottomStrip: defaultWorkspace?.bottomStrip"],
  ]) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    if (!text.includes("bottom-strip-metadata.mjs") && relative !== "bobercad/app/ui/viewer/viewer-runtime.mjs") {
      fail(errors, `${relative}: bottom strip UI metadata must come from commands/bottom-strip-metadata.mjs`);
    }
    if (!text.includes(token)) {
      fail(errors, `${relative}: bottom strip workspace wiring must include ${token}`);
    }
  }
  const statusBarTextForBottomStrip = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/status-bar.mjs"), "utf8");
  if (
    !statusBarTextForBottomStrip.includes("segmentedControl")
    || !statusBarTextForBottomStrip.includes("BOTTOM_STRIP_ITEM_SPECS")
    || !statusBarTextForBottomStrip.includes("bottomStripControls")
    || !statusBarTextForBottomStrip.includes(".map((item) => [item.id, factories[item.id]?.(item)])")
    || !statusBarTextForBottomStrip.includes("dataset.statusbarScopeMode")
    || statusBarTextForBottomStrip.includes("const controls = {")
  ) {
    fail(errors, "Status bar bottom strip must derive item controls from bottom-strip metadata and use shared segmented controls for scope");
  }
  const modelingToolbarStatusText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"), "utf8");
  if (
    !statusBarTextForBottomStrip.includes('setPrompt(message = "Ready")')
    || !modelingToolbarStatusText.includes("onStatusChange")
    || !modelingToolbarStatusText.includes("const handled = onStatusChange(message);")
    || !modelingToolbarStatusText.includes("if (handled !== false) return;")
    || !viewerRuntimeText.includes("function updateStatusBarPrompt(message)")
    || !viewerRuntimeText.includes("statusBar.setPrompt(nextMessage)")
    || !viewerRuntimeText.includes("onStatusChange: updateStatusBarPrompt")
    || viewerRuntimeText.includes("modelingUi?.setStatus(message)")
    || viewerRuntimeText.includes("statusBar?.setPrompt(message)")
  ) {
    fail(errors, "Modeling toolbar status messages must route through the shell status bar prompt owner with only a local DOM fallback");
  }
  const workspaceCustomizerTextForBottomStrip = workspaceCustomizerText;
  if (
    !workspaceCustomizerTextForBottomStrip.includes("workspace.import")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.export")
    || !workspaceCustomizerTextForBottomStrip.includes("importWorkspaceFile")
    || !workspaceCustomizerTextForBottomStrip.includes("exportWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("chooseWorkspaceImport")
    || !workspaceCustomizerTextForBottomStrip.includes("workspacePreferencePayload")
    || !workspaceCustomizerTextForBottomStrip.includes("writeWorkspacePreferences")
    || !workspaceCustomizerTextForBottomStrip.includes("workspacePreferencesEnvelope")
    || !workspaceCustomizerTextForBottomStrip.includes("importWorkspacePreferences")
    || !workspaceCustomizerTextForBottomStrip.includes("downloadWorkspaceFile")
    || !workspaceCustomizerTextForBottomStrip.includes("chooseWorkspaceFile")
  ) {
    fail(errors, "Workspace customizer must expose import/export commands and persist through the versioned workspace storage envelope");
  }
  const workspaceStorageText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/workspace-storage.mjs"), "utf8");
  if (
    !workspaceStorageText.includes("viewerOverlays")
    || !workspaceCustomizerTextForBottomStrip.includes("Viewer overlays")
    || !workspaceCustomizerTextForBottomStrip.includes("normalizeViewerOverlaysWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("viewerOverlayStateForStorage")
    || !workspaceCustomizerTextForBottomStrip.includes("mergeViewerOverlaysWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("setViewerOverlayVisible")
    || !workspaceCustomizerTextForBottomStrip.includes("setViewerOverlayCorner")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.viewerOverlay.${action}.${overlay.id}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.viewerOverlay.corner.${overlay.id}.${corner.id}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspaceCustomizer.setViewerOverlayVisible?.(overlay.id, !visible)")
    || !workspaceCustomizerTextForBottomStrip.includes("viewerOverlayCornerButtons")
    || !workspaceCustomizerTextForBottomStrip.includes("bc-workspace-customizer-overlay-corner-options")
  ) {
    fail(errors, "Workspace customizer must preserve viewerOverlays workspace state and expose NavCube visibility/corner controls through UI and command search");
  }
  if (
    !workspaceCustomizerTextForBottomStrip.includes("normalizeBottomStripWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("bottomStripStateForStorage")
    || !workspaceCustomizerTextForBottomStrip.includes("setBottomStripItemVisible")
    || !workspaceCustomizerTextForBottomStrip.includes("moveBottomStripItem")
    || !workspaceCustomizerTextForBottomStrip.includes("onBottomStripReorder")
    || !workspaceCustomizerTextForBottomStrip.includes("reorderBottomStripItem")
    || !workspaceCustomizerTextForBottomStrip.includes("bottomStripDragHandle")
    || !workspaceCustomizerTextForBottomStrip.includes('sourceDatasetKey: "bottomStripDragHandle"')
    || !workspaceCustomizerTextForBottomStrip.includes('targetDatasetKey: "bottomStripItemId"')
    || !workspaceCustomizerTextForBottomStrip.includes("moveBottomStripItemBefore")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.bottomStrip.${action}.${item.id}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.bottomStrip.${action}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspaceCustomizer.setBottomStripItemVisible?.(item.id, !visible)")
  ) {
    fail(errors, "Workspace customizer must preserve bottomStrip workspace state and expose bottom strip visibility/order/drag controls through UI and command search");
  }
  if (
    !workspaceCustomizerCssText.includes("bc-workspace-customizer-drag-handle")
    || !workspaceCustomizerCssText.includes("bc-workspace-customizer-panel-dock-options")
    || !workspaceCustomizerCssText.includes("[data-bottom-strip-item-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-bottom-strip-item-id].is-drop-target")
    || !workspaceCustomizerCssText.includes("[data-viewer-settings-strip-group-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-viewer-settings-strip-group-id].is-drop-target")
    || !workspaceCustomizerCssText.includes("[data-panel-tab-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-panel-tab-id].is-drop-target")
    || !workspaceCustomizerCssText.includes("[data-command-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-command-id].is-drop-target")
    || !workspaceCustomizerCssText.includes("[data-toolbar-group-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-toolbar-group-id].is-drop-target")
    || !workspaceCustomizerCssText.includes("[data-feature-navbar-group-id].is-dragging")
    || !workspaceCustomizerCssText.includes("[data-feature-navbar-group-id].is-drop-target")
  ) {
    fail(errors, "Workspace customizer CSS must expose tokenized drag/drop states for toolbar, navbar, bottom/top strip, and panel-tab row reordering");
  }
  if (
    !workspaceCustomizerTextForBottomStrip.includes("settings-strip-metadata.mjs")
    || !workspaceCustomizerTextForBottomStrip.includes("Top settings strip")
    || !workspaceCustomizerTextForBottomStrip.includes("normalizeViewerSettingsStripWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("mergeViewerSettingsStripWorkspace")
    || !workspaceCustomizerTextForBottomStrip.includes("viewerSettingsStripStateForStorage")
    || !workspaceCustomizerTextForBottomStrip.includes("setViewerSettingsStripGroupVisible")
    || !workspaceCustomizerTextForBottomStrip.includes("moveViewerSettingsStripGroup")
    || !workspaceCustomizerTextForBottomStrip.includes("onViewerSettingsStripReorder")
    || !workspaceCustomizerTextForBottomStrip.includes("reorderViewerSettingsStripGroup")
    || !workspaceCustomizerTextForBottomStrip.includes("viewerSettingsStripDragHandle")
    || !workspaceCustomizerTextForBottomStrip.includes('sourceDatasetKey: "viewerSettingsStripDragHandle"')
    || !workspaceCustomizerTextForBottomStrip.includes('targetDatasetKey: "viewerSettingsStripGroupId"')
    || !workspaceCustomizerTextForBottomStrip.includes("moveViewerSettingsStripGroupBefore")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.settingsStrip.${action}.${group.id}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspace.settingsStrip.${action}")
    || !workspaceCustomizerTextForBottomStrip.includes("workspaceCustomizer.setViewerSettingsStripGroupVisible?.(group.id, !visible)")
  ) {
    fail(errors, "Workspace customizer must preserve viewerSettingsStrip workspace state and expose top settings strip visibility/order/drag controls through UI and command search");
  }
  const snapSettingsControlText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/controls/snap-settings-control.mjs"), "utf8");
  if (
    !snapSettingsControlText.includes("snap-metadata.mjs")
    || !snapSettingsControlText.includes("SNAP_STRENGTH_SPECS")
    || !snapSettingsControlText.includes("SNAP_TARGET_SPECS")
    || !snapSettingsControlText.includes("normalizeSnapStrength")
    || !snapSettingsControlText.includes("createSnapSettingsControl")
    || !snapSettingsControlText.includes("dataset.snapTarget")
    || !snapSettingsControlText.includes("syncFilterCount")
  ) {
    fail(errors, "Shared snap settings control must render strength and target controls from commands/snap-metadata.mjs");
  }
  for (const relative of [
    "bobercad/app/ui/shell/status-bar.mjs",
    "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"
  ]) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    if (!text.includes("snap-settings-control.mjs") || !text.includes("createSnapSettingsControl")) {
      fail(errors, `${relative}: snap settings UI must render through controls/snap-settings-control.mjs`);
    }
  }
  const viewerRuntimeTextForSnapControls = viewerRuntimeIntegrationText;
  if (!viewerRuntimeTextForSnapControls.includes("snap-metadata.mjs") || !viewerRuntimeTextForSnapControls.includes("SNAP_TARGET_SPECS")) {
    fail(errors, "Viewer runtime snap commands must come from commands/snap-metadata.mjs");
  }
  for (const relative of [
    "bobercad/app/ui/shell/status-bar.mjs",
    "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"
  ]) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    for (const legacyToken of ["SNAP_FILTER_SPECS", "snapFilter", "SNAP_STRENGTH_SPECS", "SNAP_TARGET_SPECS", "dataset.snapTarget"]) {
      if (text.includes(legacyToken)) {
        fail(errors, `${relative}: visible snap settings must be delegated to controls/snap-settings-control.mjs instead of declaring ${legacyToken}`);
      }
    }
  }
  const statusBarSnapText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/status-bar.mjs"), "utf8");
  if (
    !statusBarSnapText.includes('strengthMeta: { source: "statusbar" }')
    || !statusBarSnapText.includes('source: "snapTarget"')
    || !statusBarSnapText.includes("key, label, enabled")
  ) {
    fail(errors, "Status bar snap control must preserve statusbar/snapTarget metadata when using the shared snap settings control");
  }
  if (
    !statusBarSnapText.includes("toggleSnapSettings()")
    || !statusBarSnapText.includes("setSnapSettingsOpen(open = true)")
    || !statusBarSnapText.includes("onSnapSettings();")
    || !viewerCommandAdapterText.includes("statusBar")
    || !viewerCommandAdapterText.includes("statusBar?.toggleSnapSettings?.()")
    || !viewerRuntimeText.includes("statusBar,")
  ) {
    fail(errors, "Snap settings toggle command must route through the bottom-strip snap popover before falling back to toolbar-only behavior");
  }
  for (const [relative, token] of [
    ["bobercad/app/ui/viewer/nav-cube.mjs", "VIEW_ORIENTATION_NAV_ORDER"],
    ["bobercad/app/ui/viewer/viewer-settings-strip.mjs", "DISPLAY_MODE_SPECS"]
  ]) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    if (!text.includes("view-metadata.mjs") || !text.includes(token)) {
      fail(errors, `${relative}: view UI metadata must come from commands/view-metadata.mjs`);
    }
  }
  const modelingToolbarCommandIds = workspace.toolbars?.modeling?.commandIds || [];
  const registryModelingToolbarIds = (registry.MODELING_TOOLBAR_COMMANDS || []).map((command) => command.id);
  if (JSON.stringify(modelingToolbarCommandIds) !== JSON.stringify(registryModelingToolbarIds)) {
    fail(errors, `${workspaceRelative}: modeling toolbar commandIds must match MODELING_TOOLBAR_COMMANDS order`);
  }
  for (const commandId of registryModelingToolbarIds) {
    const command = commandById.get(commandId);
    if (command?.defaultToolbar !== "modeling") {
      fail(errors, `MODELING_TOOLBAR_COMMANDS entry ${commandId} must declare defaultToolbar: modeling`);
    }
  }
  for (const [toolbarId, toolbar] of Object.entries(workspace.toolbars || {})) {
    const toolbarCommandIds = toolbar.commandIds || [];
    for (const commandId of toolbar.commandIds || []) {
      const command = commandById.get(commandId);
      if (!command) {
        fail(errors, `${workspaceRelative}: toolbar ${toolbarId} references unknown command: ${commandId}`);
        continue;
      }
      if (command.defaultToolbar && command.defaultToolbar !== toolbarId) {
        fail(errors, `${workspaceRelative}: ${commandId} defaultToolbar is ${command.defaultToolbar}, not ${toolbarId}`);
      }
    }
    for (const commandId of toolbar.hiddenCommandIds || []) {
      if (!commandById.has(commandId)) fail(errors, `${workspaceRelative}: toolbar ${toolbarId} hides unknown command: ${commandId}`);
      if (!toolbarCommandIds.includes(commandId)) fail(errors, `${workspaceRelative}: toolbar ${toolbarId} hiddenCommandIds must be a subset of commandIds: ${commandId}`);
    }
    for (const groupId of toolbar.collapsedGroups || []) {
      if (!groupIds.has(groupId)) fail(errors, `${workspaceRelative}: toolbar ${toolbarId} collapsedGroups references unknown command group: ${groupId}`);
    }
  }
}

module.exports = { checkSnapViewWorkspaceContracts };
