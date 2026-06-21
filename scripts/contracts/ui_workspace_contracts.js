const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { validateValue } = require("../validate_json_schema");
const { checkInspectorDescriptorContracts } = require("./ui_workspace_inspector_descriptor_contracts");
const { checkGeneratedPanelContracts } = require("./ui_workspace_generated_panel_contracts");
const { checkLeftDockShellContracts } = require("./ui_workspace_left_dock_shell_contracts");
const { checkSnapViewWorkspaceContracts } = require("./ui_workspace_snap_view_workspace_contracts");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function parseModelCollections(text) {
  const match = String(text || "").match(/MODEL_COLLECTIONS\s*=\s*new Set\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function stripCssComments(text) {
  return String(text || "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

async function checkUiWorkspace(errors) {
  const workspaceRelative = "bobercad/app/ui/workspaces/default-workspace.json";
  const registryPath = path.join(ROOT, "bobercad/app/ui/commands/command-registry.mjs");
  const commandGroupMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/command-group-metadata.mjs");
  const bottomStripMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/bottom-strip-metadata.mjs");
  const dataSurfaceMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/data-surface-metadata.mjs");
  const projectDataMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/project-data-metadata.mjs");
  const dataDockMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/data-dock-metadata.mjs");
  const inspectorDockMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/inspector-dock-metadata.mjs");
  const inspectorPropertyMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/inspector-property-metadata.mjs");
  const trimOperationMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/trim-operation-metadata.mjs");
  const inspectorPropertyBindingsPath = path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs");
  const generatedPropertyBindingsPath = path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-property-bindings.mjs");
  const generatedPropertiesPanelPath = path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-properties-panel.mjs");
  const modelBrowserPath = path.join(ROOT, "bobercad/app/ui/viewer/model-browser.mjs");
  const modelBrowserMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/model-browser-metadata.mjs");
  const smartComponentBrowserMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/smart-component-browser-metadata.mjs");
  const leftDockResultMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/left-dock-result-metadata.mjs");
  const commandPaletteMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/command-palette-metadata.mjs");
  const modelCollectionMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/model-collection-metadata.mjs");
  const snapMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/snap-metadata.mjs");
  const settingsStripMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/settings-strip-metadata.mjs");
  const viewMetadataPath = path.join(ROOT, "bobercad/app/ui/commands/view-metadata.mjs");
  const workspaceStoragePath = path.join(ROOT, "bobercad/app/ui/shell/workspace-storage.mjs");
  const workspaceCustomizerPath = path.join(ROOT, "bobercad/app/ui/shell/workspace-customizer-panel.mjs");
  const snapSelectionManagerPath = path.join(ROOT, "bobercad/app/rendering/interaction/snap-selection-manager.mjs");
  const iconRegistryPath = path.join(ROOT, "bobercad/app/ui/icons/icon-registry.mjs");
  const workspace = readJson(workspaceRelative);
  const workspaceSchema = readJson("bobercad/app/schemas/ui-workspace.schema.json");
  let registry;
  let commandGroupMetadata;
  let bottomStripMetadata;
  let dataSurfaceMetadata;
  let projectDataMetadata;
  let dataDockMetadata;
  let inspectorDockMetadata;
  let inspectorPropertyMetadata;
  let trimOperationMetadata;
  let inspectorPropertyBindings;
  let generatedPropertyBindings;
  let modelBrowser;
  let modelBrowserMetadata;
  let smartComponentBrowserMetadata;
  let leftDockResultMetadata;
  let commandPaletteMetadata;
  let modelCollectionMetadata;
  let snapMetadata;
  let settingsStripMetadata;
  let viewMetadata;
  let workspaceStorage;
  let workspaceCustomizer;
  let snapSelectionManager;
  let iconRegistry;
  try {
    [registry, commandGroupMetadata, bottomStripMetadata, dataSurfaceMetadata, projectDataMetadata, dataDockMetadata, inspectorDockMetadata, inspectorPropertyMetadata, trimOperationMetadata, inspectorPropertyBindings, generatedPropertyBindings, modelBrowser, modelBrowserMetadata, smartComponentBrowserMetadata, leftDockResultMetadata, commandPaletteMetadata, modelCollectionMetadata, snapMetadata, settingsStripMetadata, viewMetadata, workspaceStorage, workspaceCustomizer, snapSelectionManager, iconRegistry] = await Promise.all([
      import(pathToFileURL(registryPath).href),
      import(pathToFileURL(commandGroupMetadataPath).href),
      import(pathToFileURL(bottomStripMetadataPath).href),
      import(pathToFileURL(dataSurfaceMetadataPath).href),
      import(pathToFileURL(projectDataMetadataPath).href),
      import(pathToFileURL(dataDockMetadataPath).href),
      import(pathToFileURL(inspectorDockMetadataPath).href),
      import(pathToFileURL(inspectorPropertyMetadataPath).href),
      import(pathToFileURL(trimOperationMetadataPath).href),
      import(pathToFileURL(inspectorPropertyBindingsPath).href),
      import(pathToFileURL(generatedPropertyBindingsPath).href),
      import(pathToFileURL(modelBrowserPath).href),
      import(pathToFileURL(modelBrowserMetadataPath).href),
      import(pathToFileURL(smartComponentBrowserMetadataPath).href),
      import(pathToFileURL(leftDockResultMetadataPath).href),
      import(pathToFileURL(commandPaletteMetadataPath).href),
      import(pathToFileURL(modelCollectionMetadataPath).href),
      import(pathToFileURL(snapMetadataPath).href),
      import(pathToFileURL(settingsStripMetadataPath).href),
      import(pathToFileURL(viewMetadataPath).href),
      import(pathToFileURL(workspaceStoragePath).href),
      import(pathToFileURL(workspaceCustomizerPath).href),
      import(pathToFileURL(snapSelectionManagerPath).href),
      import(pathToFileURL(iconRegistryPath).href)
    ]);
  } catch (error) {
    fail(errors, `UI registry failed to import: ${error.message}`);
    return;
  }
  const commands = typeof registry.commandPaletteSpecs === "function"
    ? registry.commandPaletteSpecs()
    : [
      ...(registry.MODELING_TOOLBAR_COMMANDS || []),
      ...(registry.VIEW_COMMANDS || []),
      ...(registry.SELECT_COMMANDS || []),
      ...(registry.PANEL_COMMANDS || []),
      ...(registry.SETTINGS_COMMANDS || []),
      ...(registry.CORE_COMMANDS || [])
  ];
  const commandIdPattern = /^[a-z][A-Za-z0-9.-]*$/;
  const commandIds = new Set();
  const defaultToolbarIds = new Set(Object.keys(workspace.toolbars || {}));
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const featureNavbarCommands = commands.filter((command) => command.navSurface === "feature-navbar");
  const iconNames = new Set(typeof iconRegistry.registeredIconNames === "function" ? iconRegistry.registeredIconNames() : []);
  if (!iconNames.has("upload") || !iconNames.has("download")) {
    fail(errors, "UI icon registry must include upload/download icons for workspace import/export controls");
  }
  if (!iconNames.has("pin") || !iconNames.has("pin-off")) {
    fail(errors, "UI icon registry must include pin/pin-off icons for workspace panel pin controls");
  }
  if (!iconNames.has("drag-handle")) {
    fail(errors, "UI icon registry must include a semantic drag-handle icon for workspace customization controls");
  }
  if (!iconNames.has("check") || !iconNames.has("cancel") || !iconNames.has("add")) {
    fail(errors, "UI icon registry must include check/cancel/add icons for generated action rows");
  }
  const trimOperationTypes = trimOperationMetadata.TRIM_OPERATION_TYPES || [];
  const expectedTrimOperationIconIds = new Set([
    "trim-butt-a-to-b",
    "trim-butt-b-to-a",
    "trim-butt-both",
    "trim-miter",
    "trim-profile-cope",
    "trim-plane"
  ]);
  if (trimOperationTypes.length !== expectedTrimOperationIconIds.size) {
    fail(errors, `trim-operation-metadata must describe every supported trim option, got ${trimOperationTypes.length}`);
  }
  for (const option of trimOperationTypes) {
    if (!option?.id || !option?.label || typeof option.gap !== "boolean" || !option.icon) {
      fail(errors, `trim-operation-metadata option must declare id, label, gap, and icon: ${JSON.stringify(option)}`);
      continue;
    }
    if (!expectedTrimOperationIconIds.has(option.icon)) fail(errors, `trim-operation-metadata option ${option.id} uses unexpected icon ${option.icon}`);
    if (!iconNames.has(option.icon)) fail(errors, `trim-operation-metadata option ${option.id} references unknown icon: ${option.icon}`);
    if (trimOperationMetadata.trimOperationIcon?.(option.id) !== option.icon) {
      fail(errors, `trim-operation-metadata trimOperationIcon helper must resolve ${option.id} to ${option.icon}`);
    }
  }
  if (featureNavbarCommands.length < 10 || featureNavbarCommands.length > 16) {
    fail(errors, `Feature navbar must stay curated while exposing Model, dedicated Tools, and Structural Analysis commands, got ${featureNavbarCommands.length}`);
  }
  const featureNavbarCommandGroups = new Set(featureNavbarCommands.map((command) => command.group));
  for (const groupId of featureNavbarCommandGroups) {
    if (!["model", "tools", "structural-analysis"].includes(groupId)) fail(errors, `Feature navbar command group ${groupId} must stay out of the top navbar until it has dedicated commands`);
  }
  const requiredFeatureNavbarCommandIds = new Set([
    ...(registry.MODELING_TOOLBAR_COMMANDS || []).map((command) => command.id),
    ...(registry.MODEL_REFERENCE_COMMANDS || []).map((command) => command.id),
    ...(registry.TOOLS_WORKFLOW_COMMANDS || []).map((command) => command.id),
    ...(registry.STRUCTURAL_ANALYSIS_COMMANDS || []).map((command) => command.id)
  ]);
  for (const commandId of requiredFeatureNavbarCommandIds) {
    if (commandById.get(commandId)?.navSurface !== "feature-navbar") {
      fail(errors, `Feature navbar must expose workflow command ${commandId}`);
    }
  }
  for (const command of featureNavbarCommands) {
    if (command.group === "tools" && !command.id?.startsWith("tools.")) {
      fail(errors, `Tools top navbar command ${command.id} must be a dedicated tools.* workflow command`);
    }
    if (command.group === "structural-analysis" && !command.id?.startsWith("structural-analysis.")) {
      fail(errors, `Structural Analysis top navbar command ${command.id} must be a dedicated structural-analysis.* workflow command`);
    }
    if (/^(view|selection|panel|settings|workspace)\./.test(command.id || "")) {
      fail(errors, `Utility command ${command.id} must stay out of the top navbar`);
    }
    if (!command.group || !command.ribbonSection) {
      fail(errors, `Feature navbar command ${command.id} must declare group and ribbonSection metadata`);
    }
  }
  if (
    !commandGroupMetadata.RIBBON_SECTION_ORDER
    || !commandGroupMetadata.RIBBON_SECTION_LABELS
    || typeof commandGroupMetadata.commandRibbonSectionOrder !== "function"
    || typeof commandGroupMetadata.commandRibbonSectionLabel !== "function"
    || typeof commandGroupMetadata.inferCommandRibbonSection !== "function"
  ) {
    fail(errors, "command-group-metadata must own feature-navbar ribbon section order, labels, and temporary fallback inference");
  }
  for (const command of featureNavbarCommands) {
    const order = commandGroupMetadata.commandRibbonSectionOrder?.(command.group) || [];
    const sectionLabel = commandGroupMetadata.commandRibbonSectionLabel?.(command.ribbonSection);
    if (!order.includes(command.ribbonSection)) {
      fail(errors, `Feature navbar command ${command.id} uses ribbonSection ${command.ribbonSection} not ordered by command-group-metadata for group ${command.group}`);
    }
    if (!sectionLabel || sectionLabel === command.ribbonSection) {
      fail(errors, `Feature navbar command ${command.id} uses ribbonSection ${command.ribbonSection} without friendly metadata label`);
    }
  }
  for (const command of commands) {
    if (command.nav === true || command.nav === false) fail(errors, `Command ${command.id} must use navSurface metadata instead of legacy nav flags`);
  }
  for (const command of registry.SNAP_TARGET_COMMANDS || []) {
    if (command.navSurface === "feature-navbar") fail(errors, `Advanced snap target command ${command.id} must stay out of the feature navbar`);
  }
  for (const command of registry.SNAP_STRENGTH_COMMANDS || []) {
    if (command.navSurface === "feature-navbar") fail(errors, `Detailed snap strength command ${command.id} must stay out of the feature navbar`);
  }
  if (workspaceStorage.WORKSPACE_SCHEMA !== "bobercad-ui-workspace" || workspaceStorage.CURRENT_WORKSPACE_SCHEMA_VERSION !== workspace.schemaVersion) {
    fail(errors, "Workspace storage schema/version constants must match the committed default workspace preset");
  }
  if (workspaceStorage.WORKSPACE_SCHEMA_REF !== workspace.$schema) {
    fail(errors, "Workspace storage schema ref must match the committed default workspace $schema path");
  }
  const toolbarDockEnum = workspaceSchema.$defs?.toolbarDock?.enum || [];
  const panelDockEnum = workspaceSchema.$defs?.panelDock?.enum || [];
  if (JSON.stringify(toolbarDockEnum) !== JSON.stringify(["top"])) {
    fail(errors, "UI workspace schema toolbarDock enum must keep the main toolbar anchored to the default top dock");
  }
  if (!panelDockEnum.includes("floating")) {
    fail(errors, "UI workspace schema panelDock enum must keep floating for dock panel configs");
  }
  if (workspaceSchema.properties?.toolbars?.additionalProperties !== false || !workspaceSchema.properties?.toolbars?.properties?.modeling) {
    fail(errors, "UI workspace schema must only allow the modeling toolbar until runtime supports multiple persisted toolbars");
  }
  if (workspaceSchema.$defs?.toolbar?.properties?.groupIds?.items?.$ref !== "#/$defs/commandGroupId") {
    fail(errors, "UI workspace schema toolbar.groupIds must persist ordered command-group ids for toolbar layout customization");
  }
  if (!(workspaceSchema.$defs?.toolbar?.required || []).includes("groupIds")) {
    fail(errors, "UI workspace schema toolbar.groupIds must be required for committed workspace presets");
  }
  if (workspaceSchema.$defs?.toolbar?.properties?.collapsedGroups?.items?.$ref !== "#/$defs/commandGroupId") {
    fail(errors, "UI workspace schema toolbar.collapsedGroups must use commandGroupId references like toolbar.groupIds");
  }
  if (workspaceSchema.$defs?.panel?.properties?.collapsed) {
    fail(errors, "UI workspace schema must not advertise panel.collapsed until runtime preserves it");
  }
  if (workspaceSchema.properties?.sections?.propertyNames?.pattern !== "^[a-z][A-Za-z0-9.-]*$") {
    fail(errors, "UI workspace schema section keys must follow the workspace section id pattern");
  }
  if (
    !(workspaceSchema.required || []).includes("viewerOverlays")
    || workspaceSchema.properties?.viewerOverlays?.$ref !== "#/$defs/viewerOverlays"
    || !workspaceSchema.$defs?.viewerOverlays?.required?.includes("navCube")
    || workspaceSchema.$defs?.viewerOverlays?.properties?.navCube?.$ref !== "#/$defs/viewerOverlay"
    || JSON.stringify(workspaceSchema.$defs?.viewerOverlayCorner?.enum || []) !== JSON.stringify(["bottom-right", "bottom-left", "top-right", "top-left"])
    || !workspaceSchema.$defs?.viewerOverlay?.required?.includes("visible")
    || !workspaceSchema.$defs?.viewerOverlay?.required?.includes("corner")
  ) {
    fail(errors, "UI workspace schema must persist viewerOverlays.navCube visible/corner state as a first-class workspace branch");
  }
  if (workspace.viewerOverlays?.navCube?.visible !== true || workspace.viewerOverlays?.navCube?.corner !== "bottom-right") {
    fail(errors, `${workspaceRelative}: viewerOverlays.navCube must default visible in the bottom-right corner`);
  }
  const migratedWorkspace = workspaceStorage.migrateWorkspacePreferences?.({
    commandIds: ["model.beam.create"],
    hiddenCommandIds: ["view.reset"],
    groupIds: ["tools", "model"],
    collapsedGroups: ["view"],
    dock: "left",
    viewerOverlays: { navCube: { visible: false, corner: "top-left" } },
    sections: { "inspector.member.center": { open: false } }
  });
  if (
    migratedWorkspace?.schema !== workspaceStorage.WORKSPACE_SCHEMA
    || migratedWorkspace?.schemaVersion !== workspaceStorage.CURRENT_WORKSPACE_SCHEMA_VERSION
    || migratedWorkspace?.$schema !== workspaceStorage.WORKSPACE_SCHEMA_REF
    || migratedWorkspace?.toolbars?.modeling?.commandIds?.[0] !== "model.beam.create"
    || migratedWorkspace?.toolbars?.modeling?.groupIds?.[0] !== "tools"
    || migratedWorkspace?.toolbars?.modeling?.dock !== "left"
    || migratedWorkspace?.commandIds
    || migratedWorkspace?.groupIds
    || migratedWorkspace?.viewerOverlays?.navCube?.corner !== "top-left"
    || migratedWorkspace?.sections?.["inspector.member.center"]?.open !== false
  ) {
    fail(errors, `Workspace storage migration must wrap legacy flat toolbar preferences without dropping viewer overlays or sections: ${JSON.stringify(migratedWorkspace)}`);
  }
  const migratedNestedLegacyWorkspace = workspaceStorage.importWorkspacePreferences?.({
    modeling: {
      commandIds: ["model.column.create"],
      groupIds: ["model"],
      panels: { library: { visible: false } },
      bottomStrip: { itemIds: ["units", "snap"], hiddenItemIds: ["snap"] },
      viewerSettingsStrip: { groupIds: ["view"], hiddenGroupIds: [] },
      viewerOverlays: { navCube: { visible: false, corner: "bottom-left" } }
    }
  });
  if (
    migratedNestedLegacyWorkspace?.toolbars?.modeling?.commandIds?.[0] !== "model.column.create"
    || migratedNestedLegacyWorkspace?.toolbars?.modeling?.groupIds?.[0] !== "model"
    || migratedNestedLegacyWorkspace?.panels?.library?.visible !== false
    || migratedNestedLegacyWorkspace?.bottomStrip?.itemIds?.[0] !== "units"
    || migratedNestedLegacyWorkspace?.viewerSettingsStrip?.groupIds?.[0] !== "view"
    || migratedNestedLegacyWorkspace?.viewerOverlays?.navCube?.corner !== "bottom-left"
    || migratedNestedLegacyWorkspace?.modeling
  ) {
    fail(errors, `Workspace import must preserve nested legacy modeling panel, strip, and overlay data while removing the legacy modeling wrapper: ${JSON.stringify(migratedNestedLegacyWorkspace)}`);
  }
  const exportedWorkspace = JSON.parse(workspaceStorage.exportWorkspacePreferences?.({
    commandIds: ["model.plate.create"],
    groupIds: ["model"]
  }) || "{}");
  if (
    exportedWorkspace?.schema !== workspaceStorage.WORKSPACE_SCHEMA
    || exportedWorkspace?.schemaVersion !== workspaceStorage.CURRENT_WORKSPACE_SCHEMA_VERSION
    || exportedWorkspace?.$schema !== workspaceStorage.WORKSPACE_SCHEMA_REF
    || exportedWorkspace?.toolbars?.modeling?.commandIds?.[0] !== "model.plate.create"
    || exportedWorkspace?.toolbars?.modeling?.groupIds?.[0] !== "model"
    || exportedWorkspace?.commandIds
    || exportedWorkspace?.groupIds
  ) {
    fail(errors, `Workspace export must normalize schema, version, and legacy toolbar preferences: ${JSON.stringify(exportedWorkspace)}`);
  }
  const exportedDefaultWorkspace = JSON.parse(workspaceStorage.exportWorkspacePreferences?.(workspace) || "{}");
  for (const error of validateValue(exportedDefaultWorkspace, workspaceSchema, workspaceSchema, [], [])) {
    fail(errors, `Workspace export must validate against ui-workspace.schema.json at ${error.path.length ? error.path.join(".") : "$"}: ${error.message}`);
  }
  for (const [label, payload] of [
    ["empty object", {}],
    ["array", []],
    ["wrong schema", { schema: "bobercad-project", schemaVersion: workspace.schemaVersion }],
    ["future version", { ...workspace, schemaVersion: "99.0.0" }],
    ["partial current schema", { schema: workspace.schema, schemaVersion: workspace.schemaVersion, sections: { "inspector.member.center": { open: false } } }]
  ]) {
    let failed = false;
    try {
      workspaceStorage.importWorkspacePreferences?.(payload);
    } catch (error) {
      failed = true;
    }
    if (!failed) fail(errors, `Workspace import must reject ${label} payloads`);
  }
  const groupIds = new Set();
  for (const group of commandGroupMetadata.COMMAND_GROUP_SPECS || []) {
    if (!group.id || !group.label || !group.icon || !group.description) {
      fail(errors, `command-group-metadata group must declare id, label, icon, and description: ${JSON.stringify(group)}`);
    }
    if (groupIds.has(group.id)) fail(errors, `command-group-metadata duplicate group id: ${group.id}`);
    groupIds.add(group.id);
    if (group.icon && !iconNames.has(group.icon)) fail(errors, `command-group-metadata group ${group.id} references unknown icon: ${group.icon}`);
  }
  const metadataCommandGroups = Object.fromEntries((commandGroupMetadata.COMMAND_GROUP_SPECS || []).map((group) => [group.id, group.label]));
  if (JSON.stringify(registry.COMMAND_GROUPS || {}) !== JSON.stringify(metadataCommandGroups)) {
    fail(errors, "UI command registry COMMAND_GROUPS must come from command-group-metadata COMMAND_GROUP_SPECS");
  }
  for (const command of commands) {
    for (const field of ["id", "action", "label", "title", "description", "group", "icon"]) {
      if (typeof command[field] !== "string" || !command[field].trim()) {
        fail(errors, `UI command must declare non-empty string field ${field}: ${JSON.stringify(command)}`);
      }
    }
    if (command.id && !commandIdPattern.test(command.id)) fail(errors, `UI command id has invalid shape: ${command.id}`);
    if (commandIds.has(command.id)) fail(errors, `UI command duplicate id: ${command.id}`);
    commandIds.add(command.id);
    for (const field of ["label", "title", "description"]) {
      if (command[field] === command.id) fail(errors, `UI command ${command.id} must not use raw id as ${field}`);
    }
    if ("toolbarPin" in command && typeof command.toolbarPin !== "boolean") fail(errors, `UI command ${command.id} toolbarPin must be boolean when present`);
    if (command.defaultToolbar && !defaultToolbarIds.has(command.defaultToolbar)) {
      fail(errors, `UI command ${command.id} references unknown defaultToolbar: ${command.defaultToolbar}`);
    }
    if (!groupIds.has(command.group)) fail(errors, `UI command ${command.id} references unknown command group: ${command.group}`);
    if (!command.icon) fail(errors, `UI command ${command.id} is missing icon`);
    else if (!iconNames.has(command.icon)) fail(errors, `UI command ${command.id} references unknown icon: ${command.icon}`);
  }
  const dataLibraryIds = new Set();
  const requiredDataLibraryIds = ["profiles", "materials", "fasteners", "frames", "smartComponents"];
  for (const spec of dataSurfaceMetadata.DATA_LIBRARY_SPECS || []) {
    if (!spec.id || !spec.label || !spec.icon || !spec.entryKey) {
      fail(errors, `data-surface-metadata library must declare id, label, icon, and entryKey: ${JSON.stringify(spec)}`);
    }
    if (dataLibraryIds.has(spec.id)) fail(errors, `data-surface-metadata duplicate library id: ${spec.id}`);
    dataLibraryIds.add(spec.id);
    if (spec.icon && !iconNames.has(spec.icon)) fail(errors, `data-surface-metadata library ${spec.id} references unknown icon: ${spec.icon}`);
  }
  for (const libraryId of requiredDataLibraryIds) {
    if (!dataLibraryIds.has(libraryId)) fail(errors, `data-surface-metadata must include library id ${libraryId}`);
  }
  const defaultDataLibraryIds = (dataSurfaceMetadata.DATA_LIBRARY_SPECS || []).map((spec) => spec.id);
  if (JSON.stringify(dataSurfaceMetadata.DATA_LIBRARY_DEFAULT_IDS || []) !== JSON.stringify(defaultDataLibraryIds)) {
    fail(errors, "data-surface-metadata DATA_LIBRARY_DEFAULT_IDS must match DATA_LIBRARY_SPECS order");
  }
  const normalizedDataLibraryIds = dataSurfaceMetadata.normalizeDataLibraryIds?.(["frames", "missing", "profiles", "frames"]);
  if (JSON.stringify(normalizedDataLibraryIds) !== JSON.stringify(["frames", "profiles"])) {
    fail(errors, `data-surface-metadata normalizeDataLibraryIds must keep known unique ids in user order: ${JSON.stringify(normalizedDataLibraryIds)}`);
  }
  const sortedDataLibraryIds = dataSurfaceMetadata.sortDataLibraryEntries?.([
    { id: "zCustom" },
    { id: "smartComponents" },
    { id: "profiles" },
    { id: "frames" },
    { id: "alphaCustom" }
  ])?.map((entry) => entry.id);
  if (JSON.stringify(sortedDataLibraryIds) !== JSON.stringify(["profiles", "frames", "smartComponents", "alphaCustom", "zCustom"])) {
    fail(errors, `data-surface-metadata sortDataLibraryEntries must use known metadata order before unknown ids: ${JSON.stringify(sortedDataLibraryIds)}`);
  }
  const fallbackLibrarySpec = dataSurfaceMetadata.dataLibraryFallbackSpec?.("externalCatalog");
  if (fallbackLibrarySpec?.label !== "External Catalog" || fallbackLibrarySpec?.icon !== "library" || fallbackLibrarySpec?.entryKey !== "externalCatalog") {
    fail(errors, `data-surface-metadata fallback spec must provide a readable library row identity: ${JSON.stringify(fallbackLibrarySpec)}`);
  }
  const dataSourceDescriptor = dataSurfaceMetadata.dataSourceDescriptor?.({
    id: "project",
    label: "Project JSON",
    kind: "Project",
    icon: "file",
    path: "file:///viewer/data/projects/sample.json"
  });
  if (
    dataSourceDescriptor?.id !== "project"
    || dataSourceDescriptor?.displayPath !== "viewer/data/projects/sample.json"
    || dataSourceDescriptor?.description !== "Project - viewer/data/projects/sample.json"
    || !["project", "Project JSON", "file:///viewer/data/projects/sample.json", "viewer/data/projects/sample.json"].every((keyword) => dataSourceDescriptor?.keywords?.includes(keyword))
    || !Object.isFrozen(dataSourceDescriptor)
  ) {
    fail(errors, `data-surface-metadata must expose a frozen source provenance descriptor: ${JSON.stringify(dataSourceDescriptor)}`);
  }
  const dataLibraryDescriptor = dataSurfaceMetadata.dataLibraryDescriptor?.("profiles", {
    libraryId: "starter-profiles",
    version: "1.0.0",
    path: "bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json"
  }, {
    name: "Starter Profiles",
    count: 9,
    unit: "entries"
  });
  if (
    dataLibraryDescriptor?.label !== "Profiles"
    || dataLibraryDescriptor?.value !== "Starter Profiles"
    || dataLibraryDescriptor?.meta !== "9 entries"
    || dataLibraryDescriptor?.status !== "loaded"
    || dataLibraryDescriptor?.sourceLabel !== "Profiles library"
    || !dataLibraryDescriptor?.description?.includes("starter-profiles")
    || !["profiles", "Starter Profiles", "starter-profiles", "1.0.0", "loaded", "9 entries"].every((keyword) => dataLibraryDescriptor?.keywords?.includes(keyword))
    || !Object.isFrozen(dataLibraryDescriptor)
  ) {
    fail(errors, `data-surface-metadata must expose a frozen library provenance descriptor: ${JSON.stringify(dataLibraryDescriptor)}`);
  }
  if (!projectDataMetadata.PROJECT_DATA_PANEL_SPEC?.title || !projectDataMetadata.PROJECT_DATA_PANEL_SPEC?.icon || !projectDataMetadata.PROJECT_DATA_PANEL_SPEC?.searchLabel) {
    fail(errors, "project-data-metadata panel spec must declare title, icon, and search label");
  }
  if (projectDataMetadata.PROJECT_DATA_PANEL_SPEC?.icon && !iconNames.has(projectDataMetadata.PROJECT_DATA_PANEL_SPEC.icon)) {
    fail(errors, `project-data-metadata panel references unknown icon: ${projectDataMetadata.PROJECT_DATA_PANEL_SPEC.icon}`);
  }
  const projectDataSectionIds = (projectDataMetadata.PROJECT_DATA_SECTION_SPECS || []).map((section) => section.id);
  if (JSON.stringify(projectDataSectionIds) !== JSON.stringify(["libraries", "model", "settings"])) {
    fail(errors, `project-data-metadata sections must keep the Data tab order: ${JSON.stringify(projectDataSectionIds)}`);
  }
  for (const section of projectDataMetadata.PROJECT_DATA_SECTION_SPECS || []) {
    if (!section.id || !section.label) fail(errors, `project-data-metadata section must declare id and label: ${JSON.stringify(section)}`);
  }
  const projectDataActionIds = Object.values(projectDataMetadata.PROJECT_DATA_ROW_ACTIONS || {}).map((action) => action.id);
  for (const actionId of ["openSource", "showCollection", "showComponents"]) {
    const spec = projectDataMetadata.projectDataRowActionSpec?.(actionId);
    if (!spec?.id || !spec?.label || !spec?.icon || !spec?.titleVerb) {
      fail(errors, `project-data-metadata must declare row action ${actionId}: ${JSON.stringify(spec)}`);
    }
    if (spec?.icon && !iconNames.has(spec.icon)) fail(errors, `project-data-metadata action ${actionId} references unknown icon: ${spec.icon}`);
    if (!projectDataActionIds.includes(actionId)) fail(errors, `project-data-metadata action map must include ${actionId}`);
  }
  if (projectDataMetadata.projectDataActionTitle?.("showCollection", "Members") !== "Show Members") {
    fail(errors, "project-data-metadata action title helper must combine action verbs with row labels");
  }
  const projectDataSettingIds = (projectDataMetadata.PROJECT_DATA_SETTING_ROW_SPECS || []).map((setting) => setting.id);
  if (JSON.stringify(projectDataSettingIds) !== JSON.stringify(["project-schema", "project-units-length", "project-units-angle", "project-object-index"])) {
    fail(errors, `project-data-metadata setting rows must keep Project Settings row order: ${JSON.stringify(projectDataSettingIds)}`);
  }
  for (const setting of projectDataMetadata.PROJECT_DATA_SETTING_ROW_SPECS || []) {
    if (!setting.id || !setting.label || !setting.icon) fail(errors, `project-data-metadata setting row must declare id, label, and icon: ${JSON.stringify(setting)}`);
    if (setting.icon && !iconNames.has(setting.icon)) fail(errors, `project-data-metadata setting row ${setting.id} references unknown icon: ${setting.icon}`);
  }
  const dataDockTabIds = new Set();
  const dataDockCommandIds = new Set();
  for (const tab of dataDockMetadata.DATA_DOCK_TABS || []) {
    if (!tab.id || !tab.label || !tab.icon || !tab.commandId || !tab.action || !tab.panelElementId) {
      fail(errors, `data-dock-metadata tab must declare id, label, icon, commandId, action, and panelElementId: ${JSON.stringify(tab)}`);
    }
    if (dataDockTabIds.has(tab.id)) fail(errors, `data-dock-metadata duplicate tab id: ${tab.id}`);
    dataDockTabIds.add(tab.id);
    if (dataDockCommandIds.has(tab.commandId)) fail(errors, `data-dock-metadata duplicate command id: ${tab.commandId}`);
    dataDockCommandIds.add(tab.commandId);
    if (tab.icon && !iconNames.has(tab.icon)) fail(errors, `data-dock-metadata tab ${tab.id} references unknown icon: ${tab.icon}`);
  }
  const metadataDataDockTabOrder = (dataDockMetadata.DATA_DOCK_TABS || []).map((tab) => tab.id);
  if (JSON.stringify(metadataDataDockTabOrder) !== JSON.stringify(["files", "data", "model", "components"])) {
    fail(errors, `data-dock-metadata must keep Files/Data/Model/Components tab order: ${JSON.stringify(metadataDataDockTabOrder)}`);
  }
  if (!dataDockMetadata.DATA_DOCK_PANEL_DESCRIPTION || !dataDockMetadata.DATA_DOCK_PANEL_ICON || !dataDockMetadata.DATA_DOCK_PANEL_DOCK) {
    fail(errors, "data-dock-metadata must declare panel description, icon, and dock constants");
  }
  if (dataDockMetadata.DATA_DOCK_PANEL_ICON && !iconNames.has(dataDockMetadata.DATA_DOCK_PANEL_ICON)) {
    fail(errors, `data-dock-metadata panel references unknown icon: ${dataDockMetadata.DATA_DOCK_PANEL_ICON}`);
  }
  if (dataDockMetadata.DATA_DOCK_COMMAND_ICON && !iconNames.has(dataDockMetadata.DATA_DOCK_COMMAND_ICON)) {
    fail(errors, `data-dock-metadata command references unknown icon: ${dataDockMetadata.DATA_DOCK_COMMAND_ICON}`);
  }
  const dataDockPanel = workspace.panels?.[dataDockMetadata.DATA_DOCK_PANEL_ID];
  if (dataDockPanel?.label !== dataDockMetadata.DATA_DOCK_PANEL_LABEL) {
    fail(errors, `${workspaceRelative}: Data Dock panel must be labeled ${dataDockMetadata.DATA_DOCK_PANEL_LABEL}`);
  }
  if (dataDockPanel?.dock !== dataDockMetadata.DATA_DOCK_PANEL_DOCK) {
    fail(errors, `${workspaceRelative}: Data Dock panel must use metadata dock ${dataDockMetadata.DATA_DOCK_PANEL_DOCK}`);
  }
  if (dataDockPanel?.width !== dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_WIDTH) {
    fail(errors, `${workspaceRelative}: Data Dock width must default to ${dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_WIDTH}`);
  }
  if (dataDockPanel?.visible !== dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_VISIBLE) {
    fail(errors, `${workspaceRelative}: Data Dock visibility must default to ${dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_VISIBLE}`);
  }
  if (dataDockPanel?.pinned !== dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_PINNED) {
    fail(errors, `${workspaceRelative}: Data Dock pinned state must default to ${dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_PINNED}`);
  }
  if (dataDockPanel?.activeTab !== dataDockMetadata.DATA_DOCK_DEFAULT_TAB) {
    fail(errors, `${workspaceRelative}: Data Dock activeTab must default to ${dataDockMetadata.DATA_DOCK_DEFAULT_TAB}`);
  }
  const defaultDataDockTabIds = (dataDockMetadata.DATA_DOCK_TABS || []).map((tab) => tab.id);
  if (JSON.stringify(dataDockPanel?.tabIds || []) !== JSON.stringify(defaultDataDockTabIds)) {
    fail(errors, `${workspaceRelative}: Data Dock tabIds must default to data-dock-metadata order`);
  }
  for (const tabId of dataDockPanel?.hiddenTabIds || []) {
    if (!defaultDataDockTabIds.includes(tabId)) fail(errors, `${workspaceRelative}: Data Dock hiddenTabIds references unknown tab: ${tabId}`);
    if (!(dataDockPanel?.tabIds || []).includes(tabId)) fail(errors, `${workspaceRelative}: Data Dock hiddenTabIds must be a subset of tabIds: ${tabId}`);
  }
  const panelTabConfig = {
    id: dataDockMetadata.DATA_DOCK_PANEL_ID,
    tabs: defaultDataDockTabIds.map((id) => ({ id, label: id })),
    defaultActiveTab: dataDockMetadata.DATA_DOCK_DEFAULT_TAB,
    defaultVisible: dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_VISIBLE,
    defaultPinned: dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_PINNED,
    defaultWidth: dataDockMetadata.DATA_DOCK_PANEL_DEFAULT_WIDTH,
    minWidth: dataDockMetadata.DATA_DOCK_PANEL_MIN_WIDTH,
    maxWidth: dataDockMetadata.DATA_DOCK_PANEL_MAX_WIDTH,
    dock: dataDockMetadata.DATA_DOCK_PANEL_DOCK
  };
  const panelTabReorderInput = {
    visible: true,
    width: 300,
    dock: "left",
    pinned: true,
    tabIds: ["files", "data", "model", "components"],
    hiddenTabIds: ["model"],
    activeTab: "components"
  };
  const panelTabReordered = workspaceCustomizer.movePanelTabBefore?.(panelTabReorderInput, panelTabConfig, "components", "data");
  if (
    JSON.stringify(panelTabReordered?.tabIds) !== JSON.stringify(["files", "components", "data", "model"])
    || JSON.stringify(panelTabReordered?.hiddenTabIds) !== JSON.stringify(["model"])
    || panelTabReordered?.activeTab !== "components"
    || workspaceCustomizer.movePanelTabBefore?.(panelTabReorderInput, panelTabConfig, "missing", "data") !== panelTabReorderInput
    || workspaceCustomizer.movePanelTabBefore?.(panelTabReorderInput, panelTabConfig, "data", "data") !== panelTabReorderInput
  ) {
    fail(errors, `panel tab drag reorder helper must move source before target, preserve hidden ids and active tab, and ignore invalid reorder requests: ${JSON.stringify(panelTabReordered)}`);
  }
  const panelDockRightState = workspaceCustomizer.normalizeWorkspacePanelState?.({ ...panelTabReorderInput, dock: "right" }, panelTabConfig);
  const panelDockInvalidState = workspaceCustomizer.normalizeWorkspacePanelState?.({ ...panelTabReorderInput, dock: "sideways" }, panelTabConfig);
  if (
    workspaceCustomizer.normalizePanelDock?.("floating") !== "floating"
    || panelDockRightState?.dock !== "right"
    || panelDockInvalidState?.dock !== dataDockMetadata.DATA_DOCK_PANEL_DOCK
  ) {
    fail(errors, `panel workspace dock normalization must preserve valid workspace docks and fall back to metadata defaults: ${JSON.stringify({ panelDockRightState, panelDockInvalidState })}`);
  }
  const defaultFeatureNavbar = workspace.navigation?.featureNavbar || {};
  const defaultFeatureGroups = defaultFeatureNavbar.groupIds || [];
  const defaultHiddenFeatureGroups = defaultFeatureNavbar.hiddenGroupIds || [];
  if (JSON.stringify(defaultFeatureGroups) !== JSON.stringify(commandGroupMetadata.COMMAND_GROUP_ORDER || [])) {
    fail(errors, `${workspaceRelative}: feature navbar groupIds must default to command-group-metadata COMMAND_GROUP_ORDER`);
  }
  for (const groupId of defaultHiddenFeatureGroups) {
    if (!groupIds.has(groupId)) fail(errors, `${workspaceRelative}: feature navbar hiddenGroupIds references unknown command group: ${groupId}`);
    if (!defaultFeatureGroups.includes(groupId)) fail(errors, `${workspaceRelative}: feature navbar hiddenGroupIds must be a subset of groupIds: ${groupId}`);
  }
  const featureNavbarReorderInput = {
    featureNavbar: {
      groupIds: ["model", "tools", "structural-analysis"],
      hiddenGroupIds: ["tools"]
    }
  };
  const featureNavbarReordered = workspaceCustomizer.moveFeatureNavbarGroupBefore?.(featureNavbarReorderInput, "tools", "model");
  if (
    JSON.stringify(featureNavbarReordered?.featureNavbar?.groupIds) !== JSON.stringify(["tools", "model", "structural-analysis"])
    || JSON.stringify(featureNavbarReordered?.featureNavbar?.hiddenGroupIds) !== JSON.stringify(["tools"])
    || workspaceCustomizer.moveFeatureNavbarGroupBefore?.(featureNavbarReorderInput, "missing", "model") !== featureNavbarReorderInput
    || workspaceCustomizer.moveFeatureNavbarGroupBefore?.(featureNavbarReorderInput, "tools", "tools") !== featureNavbarReorderInput
  ) {
    fail(errors, `feature navbar drag reorder helper must move source before target, preserve hidden ids, and ignore invalid reorder requests: ${JSON.stringify(featureNavbarReordered)}`);
  }
  const toolbarReorderInput = { commandIds: ["model.beam.create", "model.column.create", "model.plate.create"], hiddenCommandIds: ["model.column.create"] };
  const toolbarReordered = workspaceCustomizer.moveToolbarCommand?.(toolbarReorderInput, "model.plate.create", "model.beam.create");
  if (
    JSON.stringify(toolbarReordered?.commandIds) !== JSON.stringify(["model.plate.create", "model.beam.create", "model.column.create"])
    || JSON.stringify(toolbarReordered?.hiddenCommandIds) !== JSON.stringify(["model.column.create"])
    || workspaceCustomizer.moveToolbarCommand?.(toolbarReorderInput, "missing", "model.beam.create") !== toolbarReorderInput
    || workspaceCustomizer.moveToolbarCommand?.(toolbarReorderInput, "model.beam.create", "missing") !== toolbarReorderInput
  ) {
    fail(errors, `toolbar command drag reorder helper must move source before target, preserve hidden ids, and ignore invalid reorder requests: ${JSON.stringify(toolbarReordered)}`);
  }
  const defaultToolbar = workspace.toolbars?.modeling || {};
  if (!Array.isArray(defaultToolbar.groupIds) || !defaultToolbar.groupIds.includes("model")) {
    fail(errors, `${workspaceRelative}: modeling toolbar must persist ordered groupIds so toolbar groups are first-class workspace layout state`);
  }
  for (const groupId of defaultToolbar.groupIds || []) {
    if (!groupIds.has(groupId)) fail(errors, `${workspaceRelative}: toolbar modeling groupIds references unknown command group: ${groupId}`);
  }
  const defaultToolbarGroups = new Set(defaultToolbar.groupIds || []);
  for (const commandId of defaultToolbar.commandIds || []) {
    const command = commandById.get(commandId);
    if (command?.group && !defaultToolbarGroups.has(command.group)) {
      fail(errors, `${workspaceRelative}: toolbar modeling groupIds must include default command group ${command.group} for ${commandId}`);
    }
  }
  for (const groupId of defaultToolbar.collapsedGroups || []) {
    if (!defaultToolbarGroups.has(groupId)) fail(errors, `${workspaceRelative}: toolbar modeling collapsedGroups must be a subset of groupIds: ${groupId}`);
  }
  const toolbarGroupCommands = commands.filter((command) => ["model", "tools"].includes(command.group));
  const toolbarGroupReorderInput = { groupIds: ["model", "tools"], collapsedGroups: ["tools"] };
  const toolbarGroupReordered = workspaceCustomizer.moveToolbarGroupBefore?.(toolbarGroupReorderInput, "tools", "model", toolbarGroupCommands);
  if (
    JSON.stringify(toolbarGroupReordered?.groupIds) !== JSON.stringify(["tools", "model"])
    || JSON.stringify(toolbarGroupReordered?.collapsedGroups) !== JSON.stringify(["tools"])
    || workspaceCustomizer.moveToolbarGroupBefore?.(toolbarGroupReorderInput, "missing", "model", toolbarGroupCommands) !== toolbarGroupReorderInput
    || workspaceCustomizer.moveToolbarGroupBefore?.(toolbarGroupReorderInput, "tools", "tools", toolbarGroupCommands) !== toolbarGroupReorderInput
  ) {
    fail(errors, `toolbar group drag reorder helper must move source before target, preserve collapsed groups, and ignore invalid reorder requests: ${JSON.stringify(toolbarGroupReordered)}`);
  }
  const bottomStripItemIds = (bottomStripMetadata.BOTTOM_STRIP_ITEM_SPECS || []).map((item) => item.id);
  if (JSON.stringify(workspace.bottomStrip?.itemIds || []) !== JSON.stringify(bottomStripItemIds)) {
    fail(errors, `${workspaceRelative}: bottomStrip.itemIds must default to bottom-strip-metadata order`);
  }
  for (const item of bottomStripMetadata.BOTTOM_STRIP_ITEM_SPECS || []) {
    if (!item.id || !item.label || !item.icon || !item.description) {
      fail(errors, `bottom-strip-metadata item must declare id, label, icon, and description: ${JSON.stringify(item)}`);
    }
    if (item.icon && !iconNames.has(item.icon)) fail(errors, `bottom-strip-metadata item ${item.id} references unknown icon: ${item.icon}`);
  }
  for (const itemId of workspace.bottomStrip?.hiddenItemIds || []) {
    if (!bottomStripItemIds.includes(itemId)) fail(errors, `${workspaceRelative}: bottomStrip.hiddenItemIds references unknown item: ${itemId}`);
    if (!(workspace.bottomStrip?.itemIds || []).includes(itemId)) fail(errors, `${workspaceRelative}: bottomStrip.hiddenItemIds must be a subset of itemIds: ${itemId}`);
  }
  const bottomStripReorderInput = { itemIds: ["selection", "scope", "snap", "units"], hiddenItemIds: ["snap"] };
  const bottomStripReordered = workspaceCustomizer.moveBottomStripItemBefore?.(bottomStripReorderInput, "units", "scope");
  if (
    JSON.stringify(bottomStripReordered?.itemIds) !== JSON.stringify(["selection", "units", "scope", "snap"])
    || JSON.stringify(bottomStripReordered?.hiddenItemIds) !== JSON.stringify(["snap"])
    || workspaceCustomizer.moveBottomStripItemBefore?.(bottomStripReorderInput, "missing", "scope") !== bottomStripReorderInput
    || workspaceCustomizer.moveBottomStripItemBefore?.(bottomStripReorderInput, "units", "units") !== bottomStripReorderInput
  ) {
    fail(errors, `bottom strip drag reorder helper must move source before target, preserve hidden ids, and ignore invalid reorder requests: ${JSON.stringify(bottomStripReordered)}`);
  }
  const settingsStripGroupIdsForWorkspace = (settingsStripMetadata.VIEWER_SETTINGS_STRIP_GROUP_SPECS || []).map((group) => group.id);
  if (JSON.stringify(workspace.viewerSettingsStrip?.groupIds || []) !== JSON.stringify(settingsStripGroupIdsForWorkspace)) {
    fail(errors, `${workspaceRelative}: viewerSettingsStrip.groupIds must default to settings-strip-metadata order`);
  }
  for (const groupId of workspace.viewerSettingsStrip?.hiddenGroupIds || []) {
    if (!settingsStripGroupIdsForWorkspace.includes(groupId)) fail(errors, `${workspaceRelative}: viewerSettingsStrip.hiddenGroupIds references unknown settings strip group: ${groupId}`);
    if (!(workspace.viewerSettingsStrip?.groupIds || []).includes(groupId)) fail(errors, `${workspaceRelative}: viewerSettingsStrip.hiddenGroupIds must be a subset of groupIds: ${groupId}`);
  }
  const settingsStripReorderInput = { groupIds: ["display", "view", "visibility"], hiddenGroupIds: ["visibility"] };
  const settingsStripReordered = workspaceCustomizer.moveViewerSettingsStripGroupBefore?.(settingsStripReorderInput, "visibility", "display");
  if (
    JSON.stringify(settingsStripReordered?.groupIds) !== JSON.stringify(["visibility", "display", "view"])
    || JSON.stringify(settingsStripReordered?.hiddenGroupIds) !== JSON.stringify(["visibility"])
    || workspaceCustomizer.moveViewerSettingsStripGroupBefore?.(settingsStripReorderInput, "missing", "display") !== settingsStripReorderInput
    || workspaceCustomizer.moveViewerSettingsStripGroupBefore?.(settingsStripReorderInput, "visibility", "visibility") !== settingsStripReorderInput
  ) {
    fail(errors, `settings strip drag reorder helper must move source before target, preserve hidden ids, and ignore invalid reorder requests: ${JSON.stringify(settingsStripReordered)}`);
  }
  for (const tab of dataDockMetadata.DATA_DOCK_TABS || []) {
    const commandId = tab.commandId;
    const command = commandById.get(commandId);
    if (!command) {
      fail(errors, `UI command registry is missing ${commandId}`);
      continue;
    }
    if (command.dataDockTab !== tab.id || command.icon !== tab.icon) {
      fail(errors, `UI command ${commandId} must target Data Dock tab metadata ${tab.id}`);
    }
  }
  const registryDataDockTabs = (registry.DATA_DOCK_COMMANDS || []).map((command) => command.dataDockTab);
  const metadataDataDockTabs = (dataDockMetadata.DATA_DOCK_TABS || []).map((tab) => tab.id);
  if (JSON.stringify(registryDataDockTabs) !== JSON.stringify(metadataDataDockTabs)) {
    fail(errors, "UI command registry Data Dock commands must come from data-dock-metadata DATA_DOCK_TABS");
  }
  const dataDockToggle = commandById.get("panel.library.toggle");
  if (
    dataDockToggle?.label !== dataDockMetadata.DATA_DOCK_COMMAND_LABEL
    || dataDockToggle?.title !== dataDockMetadata.DATA_DOCK_COMMAND_TITLE
    || dataDockToggle?.description !== dataDockMetadata.DATA_DOCK_COMMAND_DESCRIPTION
    || dataDockToggle?.icon !== dataDockMetadata.DATA_DOCK_COMMAND_ICON
  ) {
    fail(errors, "UI command panel.library.toggle must derive label, title, description, and icon from data-dock-metadata");
  }
  const inspectorContextIds = new Set();
  for (const context of inspectorDockMetadata.INSPECTOR_CONTEXTS || []) {
    if (!context.id || !context.label || !context.title || !context.description || !context.icon || !context.panelSlot || !context.commandId || !context.action) {
      fail(errors, `inspector-dock-metadata context must declare id, label, title, description, icon, panelSlot, commandId, and action: ${JSON.stringify(context)}`);
    }
    if (Object.hasOwn(context, "panelElementId")) fail(errors, `inspector-dock-metadata context must use panelSlot instead of legacy panelElementId: ${context.id}`);
    if (inspectorContextIds.has(context.id)) fail(errors, `inspector-dock-metadata duplicate context id: ${context.id}`);
    inspectorContextIds.add(context.id);
    if (context.icon && !iconNames.has(context.icon)) fail(errors, `inspector-dock-metadata context ${context.id} references unknown icon: ${context.icon}`);
    const command = commandById.get(context.commandId);
    if (!command) {
      fail(errors, `UI command registry is missing Inspector context command ${context.commandId}`);
    } else if (
      command.inspectorContext !== context.id
      || command.action !== context.action
      || command.label !== context.label
      || command.title !== context.title
      || command.description !== context.description
      || command.icon !== context.icon
    ) {
      fail(errors, `UI command ${context.commandId} must derive Inspector context command metadata from inspector-dock-metadata`);
    }
  }
  const registryInspectorContexts = (registry.INSPECTOR_CONTEXT_COMMANDS || []).map((command) => command.inspectorContext);
  const metadataInspectorContexts = (inspectorDockMetadata.INSPECTOR_CONTEXTS || []).map((context) => context.id);
  if (JSON.stringify(registryInspectorContexts) !== JSON.stringify(metadataInspectorContexts)) {
    fail(errors, "UI command registry Inspector context commands must come from inspector-dock-metadata INSPECTOR_CONTEXTS");
  }
  if (!inspectorContextIds.has(inspectorDockMetadata.INSPECTOR_DEFAULT_CONTEXT)) {
    fail(errors, `inspector-dock-metadata default context is not declared: ${inspectorDockMetadata.INSPECTOR_DEFAULT_CONTEXT}`);
  }
  const inspectorPanel = workspace.panels?.[inspectorDockMetadata.INSPECTOR_PANEL_ID];
  if (inspectorPanel?.label !== inspectorDockMetadata.INSPECTOR_PANEL_LABEL || inspectorPanel?.dock !== inspectorDockMetadata.INSPECTOR_PANEL_DOCK) {
    fail(errors, `${workspaceRelative}: Inspector panel must use inspector-dock-metadata id, label, and right dock`);
  }
  if (inspectorPanel?.width !== inspectorDockMetadata.INSPECTOR_PANEL_DEFAULT_WIDTH || inspectorPanel?.visible !== inspectorDockMetadata.INSPECTOR_PANEL_DEFAULT_VISIBLE) {
    fail(errors, `${workspaceRelative}: Inspector panel width and visibility must default from inspector-dock-metadata`);
  }
  if (inspectorPanel?.activeTab !== inspectorDockMetadata.INSPECTOR_DEFAULT_CONTEXT) {
    fail(errors, `${workspaceRelative}: Inspector panel activeTab must default to ${inspectorDockMetadata.INSPECTOR_DEFAULT_CONTEXT}`);
  }
  if (JSON.stringify(inspectorPanel?.tabIds || []) !== JSON.stringify(metadataInspectorContexts)) {
    fail(errors, `${workspaceRelative}: Inspector panel tabIds must default to inspector-dock-metadata context order`);
  }
  for (const tabId of inspectorPanel?.hiddenTabIds || []) {
    if (!metadataInspectorContexts.includes(tabId)) fail(errors, `${workspaceRelative}: Inspector hiddenTabIds references unknown context: ${tabId}`);
    if (!(inspectorPanel?.tabIds || []).includes(tabId)) fail(errors, `${workspaceRelative}: Inspector hiddenTabIds must be a subset of tabIds: ${tabId}`);
  }
  const inspectorToggle = commandById.get("panel.inspector.toggle");
  if (
    inspectorToggle?.label !== inspectorDockMetadata.INSPECTOR_COMMAND_LABEL
    || inspectorToggle?.title !== inspectorDockMetadata.INSPECTOR_COMMAND_TITLE
    || inspectorToggle?.description !== inspectorDockMetadata.INSPECTOR_COMMAND_DESCRIPTION
    || inspectorToggle?.icon !== inspectorDockMetadata.INSPECTOR_COMMAND_ICON
  ) {
    fail(errors, "UI command panel.inspector.toggle must derive label, title, description, and icon from inspector-dock-metadata");
  }
  const contractContext = {
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
  };
  checkInspectorDescriptorContracts(contractContext);
  checkGeneratedPanelContracts(contractContext);
  checkLeftDockShellContracts(contractContext);
  checkSnapViewWorkspaceContracts(contractContext);
}

module.exports = { checkUiWorkspace };
