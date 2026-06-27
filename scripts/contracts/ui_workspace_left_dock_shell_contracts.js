const fs = require("fs");
const path = require("path");
const { validateValue } = require("../validate_json_schema");
const { ROOT, fail, parseModelCollections, readJson, stripCssComments, lineNumberAt, readUiContractTextFixtures } = require("./ui_contract_helpers");

function checkLeftDockShellContracts(context) {
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
    modelBrowserText,
    leftDockResultMetadataText,
    projectFilesPanelText,
    projectDataPanelText,
    panelsAndControlsText,
    smartComponentBrowserText,
    commandPaletteText,
    commandPaletteCssText,
    commandRegistryText,
    inspectorPanelText,
    inspectorPropertyBindingsText,
    inspectorEditableObjectPropertyMetadataText,
    featureEditorPanelText,
    trimJointEditorPanelText,
    memberTransformPanelText,
    memberTransformPanelCssText,
    viewerEditorPanelsText,
    inspectorDockText,
    inspectorDockCssText,
    designTokensText,
    workspaceShellText,
    viewerIndexText,
    viewerRuntimeTextForInspector,
    viewerRuntimeIntegrationText,
    viewerAppControllerText,
    inspectorPropertyMetadataText,
    generatedPropertiesText,
    generatedPanelElementsText
  } = readUiContractTextFixtures(context);
  const objectPropertyMetadataText = `${inspectorPropertyMetadataText}\n${inspectorEditableObjectPropertyMetadataText}`;
  const plateSketchInspectorText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/contributions/plate-sketch-inspector.mjs"), "utf8");
  for (const field of ["title", "icon", "searchPlaceholder", "searchLabel", "emptyMessage", "itemCountLabel", "collectionLabel", "readyLabel", "statusMetaFallback"]) {
    if (!smartComponentBrowserMetadata.SMART_COMPONENT_BROWSER_PANEL_SPEC?.[field]) {
      fail(errors, `smart-component-browser-metadata panel spec must declare ${field}`);
    }
  }
  if (smartComponentBrowserMetadata.SMART_COMPONENT_BROWSER_PANEL_SPEC?.icon && !iconNames.has(smartComponentBrowserMetadata.SMART_COMPONENT_BROWSER_PANEL_SPEC.icon)) {
    fail(errors, `smart-component-browser-metadata panel references unknown icon: ${smartComponentBrowserMetadata.SMART_COMPONENT_BROWSER_PANEL_SPEC.icon}`);
  }
  const smartComponentKindIds = new Set((smartComponentBrowserMetadata.SMART_COMPONENT_KIND_SPECS || []).map((spec) => spec.id));
  const smartComponentRegister = readJson("bobercad/data/libraries/smart-components/smart-component-register.json");
  const smartComponentRegisterDir = path.join(ROOT, "bobercad/data/libraries/smart-components");
  const registeredSmartComponentKinds = new Set();
  for (const entry of smartComponentRegister.components || []) {
    const configPath = path.join(smartComponentRegisterDir, entry, "config.json");
    if (!fs.existsSync(configPath)) continue;
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.kind) registeredSmartComponentKinds.add(config.kind);
  }
  for (const kindId of registeredSmartComponentKinds) {
    if (!smartComponentKindIds.has(kindId)) fail(errors, `smart-component-browser-metadata must explicitly cover registered Smart Component kind: ${kindId}`);
  }
  for (const spec of smartComponentBrowserMetadata.SMART_COMPONENT_KIND_SPECS || []) {
    if (!spec.id || !spec.label || !spec.icon || !spec.actionMode) fail(errors, `smart-component-browser-metadata kind must declare id, label, icon, and actionMode: ${JSON.stringify(spec)}`);
    if (spec.icon && !iconNames.has(spec.icon)) fail(errors, `smart-component-browser-metadata kind ${spec.id} references unknown icon: ${spec.icon}`);
  }
  for (const action of Object.values(smartComponentBrowserMetadata.SMART_COMPONENT_PRESET_ACTIONS || {})) {
    if (!action.mode || !action.icon || !action.verb) fail(errors, `smart-component-browser-metadata action must declare mode, icon, and verb: ${JSON.stringify(action)}`);
    if (action.icon && !iconNames.has(action.icon)) fail(errors, `smart-component-browser-metadata action ${action.mode} references unknown icon: ${action.icon}`);
  }
  for (const status of Object.values(smartComponentBrowserMetadata.SMART_COMPONENT_STATUS_SPECS || {})) {
    if (!status.id || !status.icon) fail(errors, `smart-component-browser-metadata status must declare id and icon: ${JSON.stringify(status)}`);
    if (status.icon && !iconNames.has(status.icon)) fail(errors, `smart-component-browser-metadata status ${status.id} references unknown icon: ${status.icon}`);
  }
  if (
    smartComponentBrowserText.includes("selection.beginMemberPick")
    || smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-action")
    || smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-value")
    || smartComponentBrowserMetadata.smartComponentPresetActionSpec?.("connection")?.mode !== "select"
    || smartComponentBrowserMetadata.smartComponentPresetActionIcon?.({ kind: "connection" }) !== "inspector"
    || smartComponentBrowserMetadata.smartComponentPresetActionSpec?.("frame")?.mode !== "create"
    || smartComponentBrowserMetadata.smartComponentPresetActionIcon?.({ kind: "frame" }) !== "smart-component"
    || smartComponentBrowserMetadata.smartComponentStatusIcon?.("error") !== "cancel"
    || !smartComponentBrowserText.includes("onPresetSelected?.(item)")
    || !viewerRuntimeTextForInspector.includes("mountPresetSmartComponentUi")
    || !viewerRuntimeTextForInspector.includes("onPresetSelected: (item) => showSmartComponentPresetEditor(item.id)")
    || !viewerRuntimeTextForInspector.includes('editorApi?.selectSmartComponent(rootSmartComponent.id, { inspectorPanel: "component" })')
  ) {
    fail(errors, "Smart Component browser must treat connection presets as settings selections, not member-pick actions, and route them to the right Component inspector tab");
  }
  const leftDockResults = leftDockResultMetadata.leftDockResultSpecs?.({
    project: readJson("bobercad/data/projects/sample_portal_frame.json"),
    sources: [
      { id: "project", label: "Project JSON", kind: "Project", icon: "file", path: "sample_portal_frame.json" },
      { id: "settings", label: "Viewer settings", kind: "UI", icon: "settings", path: "viewer-settings.json" }
    ],
    smartComponentPresets: [
      { id: "fin_plate", name: "Fin Plate", type: "fin-plate", kind: "connection", version: 1 },
      { id: "portal_frame", name: "Portal Frame", type: "portal-frame", kind: "frame", version: 1 }
    ],
    smartComponentCatalog: {
      definitions: {
        "fin-plate": { title: "Fin Plate", kind: "connection" },
        "portal-frame": { title: "Portal Frame", kind: "frame" }
      }
    }
  }) || [];
  const leftDockResultIds = new Set();
  const leftDockResultKinds = new Set(leftDockResultMetadata.LEFT_DOCK_RESULT_KINDS || []);
  const dataDockTabIdsForResults = new Set((dataDockMetadata.DATA_DOCK_TABS || []).map((tab) => tab.id));
  const modelCollectionIdsForResults = new Set((modelCollectionMetadata.MODEL_COLLECTION_SPECS || []).map((spec) => spec.id));
  for (const field of ["title", "placeholder", "triggerLabel", "triggerTitle", "triggerAriaLabel", "closeLabel", "resultsLabel", "emptyMessage", "activeLabel", "recentGroupLabel", "unavailableMessage"]) {
    if (!commandPaletteMetadata.COMMAND_PALETTE_SPEC?.[field]) fail(errors, `command-palette-metadata spec must declare ${field}`);
  }
  if (commandPaletteMetadata.COMMAND_PALETTE_SHORTCUT !== "Ctrl+K") {
    fail(errors, "command-palette-metadata shortcut must preserve Ctrl+K");
  }
  for (const kind of leftDockResultMetadata.LEFT_DOCK_RESULT_KINDS || []) {
    if (!commandPaletteMetadata.commandPaletteResultKindLabel?.(kind)) {
      fail(errors, `command-palette-metadata must label left-dock result kind: ${kind}`);
    }
  }
  if (!leftDockResults.some((item) => item.kind === "source-file") || !leftDockResults.some((item) => item.kind === "project-data-row") || !leftDockResults.some((item) => item.kind === "model-collection") || !leftDockResults.some((item) => item.kind === "model-object") || !leftDockResults.some((item) => item.kind === "smart-component-preset")) {
    fail(errors, "left-dock-result-metadata must produce Files, Data, Model collection/object, and Smart Component preset results");
  }
  if (!leftDockResults.some((item) => item.kind === "source-file" && item.groupLabel === "Files" && item.action?.type === "showFileRow" && item.action?.tab === "files")) {
    fail(errors, "left-dock-result-metadata must route source-file results to the Files tab with showFileRow");
  }
  for (const item of leftDockResults) {
    if (!item.id || !item.kind || !item.title || !item.groupLabel || !item.icon || !item.action) {
      fail(errors, `left-dock-result-metadata result must declare id, kind, title, groupLabel, icon, and action: ${JSON.stringify(item)}`);
    }
    if (leftDockResultIds.has(item.id)) fail(errors, `left-dock-result-metadata duplicate result id: ${item.id}`);
    leftDockResultIds.add(item.id);
    if (!leftDockResultKinds.has(item.kind)) fail(errors, `left-dock-result-metadata unknown result kind: ${item.kind}`);
    if (item.kindLabel !== commandPaletteMetadata.commandPaletteResultKindLabel?.(item.kind)) fail(errors, `left-dock-result-metadata result ${item.id} must carry command palette kind label`);
    const resultKeywords = (item.keywords || []).map(String);
    if (!resultKeywords.includes(item.kind) || !resultKeywords.includes(item.kindLabel)) {
      fail(errors, `left-dock-result-metadata result ${item.id} must make result kind searchable`);
    }
    if (item.icon && !iconNames.has(item.icon)) fail(errors, `left-dock-result-metadata result ${item.id} references unknown icon: ${item.icon}`);
    if (item.recent !== false || item.toolbarPin !== false || item.paletteDefault !== false) {
      fail(errors, `left-dock-result-metadata result ${item.id} must stay search-only and out of recents/toolbars`);
    }
    if (item.group === "model") fail(errors, `left-dock-result-metadata result ${item.id} must not masquerade as a static Model command`);
    if (!leftDockResultMetadata.validLeftDockResultAction?.(item.action)) fail(errors, `left-dock-result-metadata result has invalid action: ${JSON.stringify(item.action)}`);
    if (!dataDockTabIdsForResults.has(item.action.tab)) fail(errors, `left-dock-result-metadata action references unknown Data Dock tab: ${item.action.tab}`);
    if (item.action.collectionId && !modelCollectionIdsForResults.has(item.action.collectionId)) {
      fail(errors, `left-dock-result-metadata action references unknown model collection: ${item.action.collectionId}`);
    }
    if (typeof item.run === "function") fail(errors, "left-dock-result-metadata must stay pure; runtime attaches run handlers");
  }
  for (const item of leftDockResults) {
    if (item.action.type === "showFileRow" && !item.action.rowId) fail(errors, `left-dock-result-metadata showFileRow action must declare rowId: ${JSON.stringify(item.action)}`);
    if (item.action.type === "showDataRow" && !item.action.rowId) fail(errors, `left-dock-result-metadata showDataRow action must declare rowId: ${JSON.stringify(item.action)}`);
    if (item.action.type === "showModelCollection" && !item.action.collectionId) fail(errors, `left-dock-result-metadata showModelCollection action must declare collectionId: ${JSON.stringify(item.action)}`);
    if (item.action.type === "selectModelObject" && (!item.action.collectionId || !item.action.objectId)) fail(errors, `left-dock-result-metadata selectModelObject action must declare collectionId and objectId: ${JSON.stringify(item.action)}`);
    if (item.action.type === "selectSmartComponent" && (!item.action.collectionId || !(item.action.smartComponentId || item.action.objectId))) fail(errors, `left-dock-result-metadata selectSmartComponent action must declare collectionId and smartComponentId/objectId: ${JSON.stringify(item.action)}`);
    if (item.action.type === "showSmartComponentPreset" && !item.action.presetId) fail(errors, `left-dock-result-metadata showSmartComponentPreset action must declare presetId: ${JSON.stringify(item.action)}`);
  }
  if (!projectFilesPanelText.includes("showRow(rowId") || !projectDataPanelText.includes("showRow(rowId") || !modelBrowserText.includes("showObject(collectionId, objectId)") || !smartComponentBrowserText.includes("showPreset(presetId)")) {
    fail(errors, "Left-dock panels must expose passive row/object/preset reveal APIs for command palette result navigation");
  }
  if (commandRegistryText.includes("left-dock-result-metadata")) {
    fail(errors, "Static command registry must not import runtime/project-derived left-dock results");
  }
  if (
    !commandPaletteText.includes("command-palette-metadata.mjs")
    || !commandPaletteText.includes("COMMAND_PALETTE_SPEC")
    || !commandPaletteText.includes("COMMAND_PALETTE_SHORTCUT")
    || !commandPaletteText.includes("topbarMenuButton")
    || !commandPaletteText.includes('labelClassName: "bc-command-trigger-label"')
    || !commandPaletteText.includes("command.paletteDefault !== false")
    || !commandPaletteText.includes("command.keywords")
    || !commandPaletteText.includes("bc-command-palette-kind")
    || commandPaletteText.includes('title.textContent = "Commands"')
    || commandPaletteText.includes('"No matching commands."')
  ) {
    fail(errors, "Command palette must derive shell copy from metadata and support search-only runtime result kind labels");
  }
  if (!commandPaletteCssText.includes(".bc-command-palette-kind")) {
    fail(errors, "Command palette CSS must style result kind labels");
  }
  const commandPaletteMoveActiveBody = commandPaletteText.match(/function moveActive\(delta\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  if (
    !commandPaletteText.includes("function setActiveIndex(nextIndex, options = {})")
    || !commandPaletteText.includes("syncOptionSelection(previousIndex, false)")
    || !commandPaletteText.includes("syncOptionSelection(normalizedIndex, true)")
    || !commandPaletteText.includes("function syncOptionSelection(index, active)")
    || !commandPaletteText.includes("setActiveIndex(index, { scroll: false })")
    || !commandPaletteText.includes("syncActiveOption(options)")
    || commandPaletteMoveActiveBody.includes("render()")
    || commandPaletteText.includes("state.activeIndex = index;\n      render();")
  ) {
    fail(errors, "Command palette active-result keyboard/hover movement must update row state without recomputing runtime command results");
  }
  if (
    !commandPaletteText.includes("function open(options = {})")
    || !commandPaletteText.includes("const query = String(options.query || \"\")")
    || !uiElementsText.includes("export function topbarMenuButton")
    || !uiElementsText.includes("labelClassName = \"bc-topbar-menu-label\"")
    || !viewerRuntimeTextForInspector.includes("TOPBAR_FILE_COMMAND_QUERY")
    || !viewerRuntimeTextForInspector.includes("commandPalette?.open?.({ query: TOPBAR_FILE_COMMAND_QUERY })")
    || !viewerRuntimeTextForInspector.includes("topbarMenuButton(button")
    || !viewerRuntimeTextForInspector.includes('icon: "file"')
    || !viewerRuntimeTextForInspector.includes('labelClassName: "bc-topbar-menu-label"')
    || viewerRuntimeTextForInspector.includes("File menu is not wired yet.")
    || !workspaceShellText.includes(".bc-topbar-menu-button .bc-icon")
    || !workspaceShellText.includes(".bc-topbar-menu-label")
  ) {
    fail(errors, "Topbar File action must be SVG-backed and route to filtered command search instead of a placeholder status");
  }
  if (
    !viewerRuntimeIntegrationText.includes("leftDockResultSpecs")
    || !viewerRuntimeIntegrationText.includes("leftDockCommandItems")
    || !viewerRuntimeIntegrationText.includes("commandPaletteItems")
    || !viewerRuntimeIntegrationText.includes("ProjectFilesPanelUi")
    || !viewerRuntimeIntegrationText.includes("showFileRow")
    || !viewerRuntimeIntegrationText.includes("getProjectDataPanelUi()?.showRow")
    || !viewerRuntimeIntegrationText.includes("getModelBrowserUi()?.showObject")
    || !viewerRuntimeIntegrationText.includes("getModelBrowserUi()?.showCollection")
    || !viewerRuntimeIntegrationText.includes("getSmartComponentBrowserUi()")
    || !viewerRuntimeIntegrationText.includes("getConnectionComponentBrowserUi()")
    || !viewerRuntimeIntegrationText.includes("showPreset?.(action.presetId)")
  ) {
    fail(errors, "Viewer runtime must feed left-dock result descriptors into the command palette and route actions through left panel APIs");
  }
  for (const context of inspectorDockMetadata.INSPECTOR_CONTEXTS || []) {
    if (!viewerIndexText.includes(`data-inspector-context-panel="${context.panelSlot}"`)) {
      fail(errors, `Inspector context ${context.id} panelSlot is missing from viewer index.html: ${context.panelSlot}`);
    }
  }
  if (
    viewerIndexText.includes('id="object-editor"')
    || viewerIndexText.includes('id="feature-editor"')
    || viewerIndexText.includes('id="trim-joint-editor"')
    || viewerIndexText.includes('id="custom-panel"')
    || viewerRuntimeIntegrationText.includes("context.panelElementId")
    || viewerRuntimeIntegrationText.includes('getElementById("object-editor")')
    || viewerRuntimeIntegrationText.includes('getElementById("feature-editor")')
    || viewerRuntimeIntegrationText.includes('getElementById("trim-joint-editor")')
    || viewerRuntimeIntegrationText.includes('getElementById("custom-panel")')
  ) {
    fail(errors, "Inspector context panels must be addressed through metadata panelSlot/data-inspector-context-panel, not legacy editor DOM ids");
  }
  if (inspectorDockText.includes("activeId = spec.id")) {
    fail(errors, "Inspector Dock must not auto-activate newly visible advanced panels; runtime should choose Properties/advanced contexts explicitly");
  }
  if (
    inspectorDockText.includes("localStorage")
    || inspectorDockText.includes("storageKey")
    || inspectorDockText.includes("persistActivePanel")
    || !inspectorDockText.includes("onActivePanelChange")
    || !inspectorDockText.includes("setPanels")
  ) {
    fail(errors, "Inspector Dock must be a workspace-driven shell widget, not a separate active-tab localStorage owner");
  }
  if (!inspectorPanelText.includes("inspector-property-metadata.mjs") || inspectorPanelText.includes("function objectTitleForEntry") || inspectorPanelText.includes("function objectIconForEntry")) {
    fail(errors, "Inspector panel must derive generated property context identity from inspector-property-metadata");
  }
  if (
    !inspectorPanelText.includes("plate-sketch-inspector.mjs")
    || !plateSketchInspectorText.includes("relationStatusRowDescriptor")
    || !plateSketchInspectorText.includes("relationStatusListFields")
    || !plateSketchInspectorText.includes("selectedEntityRelationStatusFields")
    || !plateSketchInspectorText.includes("selectedRelationCardDescriptor")
    || !plateSketchInspectorText.includes("relationActionDescriptor")
    || !plateSketchInspectorText.includes("constructionLineActionDescriptor")
    || !plateSketchInspectorText.includes('id: "inspector.properties.object.plate.relations"')
    || !plateSketchInspectorText.includes('label: "Sketch Relations"')
    || !plateSketchInspectorText.includes('level: "advanced"')
    || !inspectorPanelText.includes("? [...objectSections, plateEditor(object)].filter(Boolean)")
    || !plateSketchInspectorText.includes("statusListCard")
    || !plateSketchInspectorText.includes("nestedFieldCard")
    || !plateSketchInspectorText.includes('type: "statusRow"')
    || !plateSketchInspectorText.includes('type: "actionRow"')
    || !plateSketchInspectorText.includes('type: "summaryCard"')
    || !plateSketchInspectorText.includes('type: "statusListCard"')
    || !plateSketchInspectorText.includes('type: "nestedFieldCard"')
    || !plateSketchInspectorText.includes('type: "statusGroupTitle"')
    || !plateSketchInspectorText.includes('action: "object.plate.sketchRelation.value.set"')
    || !plateSketchInspectorText.includes('action: "object.plate.sketchRelation.add"')
    || !plateSketchInspectorText.includes('action: "object.plate.sketchConstructionLine.add"')
    || !plateSketchInspectorText.includes('action: "object.plate.sketchUnderDefined.fixRemaining"')
    || !plateSketchInspectorText.includes('action: "object.plate.sketchRelations.unfixAll"')
  ) {
    fail(errors, "Inspector panel must append plate sketch relation tooling as a generated Object Properties section with serializable field descriptors");
  }
  for (const deprecatedType of [
    'type: "plateRelationRow"',
    'type: "plateRelationCard"',
    'type: "plateUnderDefinedCard"',
    'type: "plateSketchSelectionCard"',
    'type: "plateRelationGroupTitle"'
  ]) {
    if (inspectorPanelText.includes(deprecatedType)) {
      fail(errors, `Inspector panel must emit generic generated field descriptors instead of deprecated plate descriptor type ${deprecatedType}`);
    }
  }
  if (
    inspectorPanelText.includes("generatedPropertyField")
    || inspectorPanelText.includes("generatedPlateRelationRows")
    || inspectorPanelText.includes("activeDetailSections")
    || inspectorPanelText.includes("objectEditor")
    || inspectorPanelText.includes("Advanced Object")
    || inspectorPanelText.includes('sectionId: "inspector.detail.object"')
  ) {
    fail(errors, "Inspector panel must not remount plate sketch relation tooling through the legacy Advanced Object detail renderer");
  }
  if (
    !inspectorPanelText.includes("inspectorActiveToolContext")
    || !inspectorPanelText.includes("inspectorActiveToolSections")
    || !inspectorPanelText.includes("MODELING_TOOLBAR_COMMANDS")
    || !inspectorPanelText.includes("activeToolPropertiesPanel")
    || !inspectorPanelText.includes("app?.commandState?.()")
    || !inspectorPanelText.includes("app?.activeToolState?.()")
    || !inspectorPanelText.includes("app?.snapSettings?.()")
    || !inspectorPanelText.includes("generated-property-bindings.mjs")
    || !inspectorPanelText.includes("bindGeneratedPropertySections(activeToolSections")
    || !inspectorPanelText.includes("generatedActiveToolBindings()")
    || !inspectorPanelText.includes("app?.cycleActiveSnap?.()")
    || !inspectorPanelText.includes("settings.snapStrength.")
    || !inspectorPanelText.includes("selection.scope.")
    || !inspectorPanelText.includes("settings.snapTarget.")
    || !inspectorPanelText.includes('app.runCommand("command.cancel")')
    || inspectorPanelText.includes('"activeTool.cycleSnap":')
    || inspectorPanelText.includes('"activeTool.cancel":')
    || inspectorPanelText.includes('"snapStrength.set":')
    || inspectorPanelText.includes('"selectionScope.set":')
    || inspectorPanelText.includes('"snapTarget.set":')
  ) {
    fail(errors, "Inspector panel must render active modeling command state and precision controls through generated active-tool properties");
  }
  if (
    !inspectorPanelText.includes("generatedReferenceBindings")
    || !inspectorPanelText.includes("generatedActiveToolBindings")
    || !inspectorPanelText.includes("generatedMemberBindings")
    || !inspectorPanelText.includes("generatedSupportObjectBindings")
    || !inspectorPanelText.includes("generatedSmartComponentBindings")
    || !inspectorPanelText.includes("createInspectorPropertyBindings")
    || !inspectorPanelText.includes("inspector-property-bindings.mjs")
    || !inspectorPropertyBindingsText.includes("propertyPatch")
    || !inspectorPropertyBindingsText.includes("generatedActiveToolBindings")
    || !inspectorPropertyBindingsText.includes("snapTarget.set")
    || !inspectorPropertyBindingsText.includes("generatedMemberBindings")
    || !inspectorPropertyBindingsText.includes("member.material.set")
    || !inspectorPropertyBindingsText.includes("member.centerCoordinate.set")
    || !inspectorPropertyBindingsText.includes("supportObject.holePattern.update")
    || !inspectorPropertyBindingsText.includes("smartComponent.parameter.set")
    || !inspectorPropertyBindingsText.includes("smartComponent.roleActive.set")
    || !inspectorPropertyBindingsText.includes("smartComponent.object.detach")
    || !inspectorPropertyBindingsText.includes("smartComponent.object.reattach")
    || !inspectorPropertyBindingsText.includes('"objectRef.select"')
    || !inspectorPropertyBindingsText.includes('"objectRef.fit"')
    || !inspectorPropertyMetadataText.includes("smartComponent.object.detach")
    || !inspectorPropertyMetadataText.includes("smartComponent.object.reattach")
    || !inspectorPropertyMetadataText.includes("smartComponent.parameters.open")
    || !inspectorPropertyMetadataText.includes('"objectRef.select"')
    || !inspectorPropertyMetadataText.includes('"objectRef.fit"')
    || !inspectorPanelText.includes("detachObject: (smartComponentId, objectId) => detachSmartComponentObject(smartComponentId, objectId)")
    || !inspectorPanelText.includes("reattachObject: (smartComponentId, objectId) => reattachSmartComponentObject(smartComponentId, objectId)")
    || inspectorPanelText.includes("const supportObjectPatch")
    || inspectorPanelText.includes("const supportObjectCommitBindings")
    || inspectorPanelText.includes('"member.profile.set"')
    || inspectorPanelText.includes('"member.material.set"')
    || inspectorPanelText.includes('"member.rotation.set"')
    || inspectorPanelText.includes('"member.centerCoordinate.set"')
    || inspectorPanelText.includes('"member.endpointCoordinate.set"')
    || inspectorPanelText.includes('"member.alignment.setGlobalAxis"')
    || inspectorPanelText.includes("onSelect: entry ?")
    || inspectorPanelText.includes("onFit: entry ?")
    || inspectorPanelText.includes("onSelect: () => selectSmartComponent")
    || inspectorPanelText.includes("onChange: (active) => setSelectedSmartComponentRoleActive")
    || inspectorPanelText.includes("onClick: () => resetSelectedSmartComponentObjectOverrides")
    || inspectorPanelText.includes("onClick: () => detachSelectedSmartComponentObject")
  ) {
    fail(errors, "Inspector panel objectRef, support-object, and Smart Component rows must use serializable intents bound through generated bindings");
  }
  if (
    !inspectorPanelText.includes("selectionActions")
    || !inspectorPropertyBindingsText.includes("quickActionBindings")
    || !inspectorPropertyBindingsText.includes("inspector.pickMember")
    || !inspectorPropertyBindingsText.includes("selection.plateRelations.toggle")
    || !inspectorPropertyMetadataText.includes("export function inspectorPrimaryActions")
    || !inspectorPropertyMetadataText.includes("export function inspectorSelectionQuickActions")
    || !inspectorPropertyMetadataText.includes("selection.smartComponent.open")
    || inspectorPanelText.includes("inspectorObjectAdvancedActions")
    || inspectorPropertyMetadataText.includes("export function inspectorObjectAdvancedActions")
    || inspectorPanelText.includes('button("Pick Member"')
    || inspectorPanelText.includes('button("Pick Smart Component"')
    || inspectorPanelText.includes('button("Pick Object"')
    || inspectorPanelText.includes("bindActionButtons(inspectorPrimaryActions())")
    || inspectorPanelText.includes("bindQuickActions(actions)")
    || inspectorPanelText.includes("inspectorActionButton")
    || inspectorPanelText.includes('text("div", "bc-inspector-title", "Inspector")')
    || inspectorPanelText.includes('actions.className = "bc-action-row"')
    || inspectorPanelText.includes("selectionQuickActions()")
    || inspectorPanelText.includes('Pick a member, Smart Component, trim, or cut object.')
    || inspectorPanelText.includes('Pick a member, Smart Component, trim, cut object, plate, fastener, or weld.')
    || inspectorPanelText.includes('button("Open Smart Component"')
    || inspectorPanelText.includes('button("Open Direct Component"')
    || inspectorPanelText.includes('button("Open Feature Editor"')
    || inspectorPanelText.includes('"editor-button"')
    || inspectorPanelText.includes('"editor-actions')
    || inspectorPanelText.includes('text("div", "editor-title", "Inspector")')
    || inspectorPanelText.includes('readout("Object", selectedObjectId)')
    || inspectorPanelText.includes('readout("Collection", entry.collection)')
    || inspectorPanelText.includes('readout("Type", object.type')
    || inspectorPanelText.includes('sectionId: "inspector.object.linkedComponent"')
    || inspectorPanelText.includes('sectionId: "inspector.object.details"')
    || inspectorPanelText.includes("onClick: focusSelection")
    || inspectorPanelText.includes("onClick: () => selectSmartComponent(rootSmartComponent.id)")
    || inspectorPanelText.includes('onClick: () => onObjectSelected?.(selectedObjectId, { inspectorPanel: "feature" })')
    || inspectorPanelText.includes("Hide sketch relations in 3D")
  ) {
    fail(errors, "Inspector properties panel must keep generic selection commands out of the Properties body while keeping serializable metadata intents available for bound descriptors");
  }
  if (
    !inspectorPanelText.includes("generatedObjectBindings")
    || !inspectorPanelText.includes("inspectorObjectPropertySections")
    || !inspectorPanelText.includes("].filter(Boolean), generatedObjectBindings())")
    || !inspectorPropertyBindingsText.includes("objectPropertyCommitBindings")
    || !inspectorPropertyBindingsText.includes("mergeObjectPatch(commit.bend")
    || !objectPropertyMetadataText.includes("export function inspectorObjectPropertySections")
    || !objectPropertyMetadataText.includes("object.fastenerGroup.update")
    || !objectPropertyMetadataText.includes("object.plate.update")
    || !objectPropertyMetadataText.includes("object.plate.bend.update")
    || !objectPropertyMetadataText.includes("object.plate.bend.remove")
    || !objectPropertyMetadataText.includes("object.plate.relations.infer")
    || !objectPropertyMetadataText.includes("object.trim.openEditor")
    || objectPropertyMetadataText.includes("object.trimJoint.operation.update")
    || objectPropertyMetadataText.includes("object.trimJoint.operation.select")
    || objectPropertyMetadataText.includes("object.trimJoint.operation.type.set")
    || objectPropertyMetadataText.includes("TRIM_OPERATION_TYPES")
    || objectPropertyMetadataText.includes("trimOperationMemberEndField")
    || objectPropertyMetadataText.includes("trimOperationPlaneActions")
    || objectPropertyMetadataText.includes("trimOperationRegionActions")
    || !objectPropertyMetadataText.includes("object.feature.body.update")
    || !objectPropertyMetadataText.includes("object.weld.update")
    || !objectPropertyMetadataText.includes("object.sketch.createPlate")
    || !inspectorPropertyBindingsText.includes("object.plate.relations.infer")
    || !inspectorPropertyBindingsText.includes("object.plate.bend.remove")
    || !inspectorPropertyBindingsText.includes("object.sketch.createPlate")
    || inspectorPropertyBindingsText.includes("objects.setTrimOperationType")
    || inspectorPanelText.includes("setTrimOperationType(operationId, type)")
    || inspectorPanelText.includes("trimOperationUsesMemberEnd(type")
    || inspectorPanelText.includes("patch.allowExtension = undefined")
    || !inspectorPanelText.includes("removePlateBend: (bendId) => updatePlate")
    || !inspectorPanelText.includes("inferPlateSketchRelations: (plateId) => inferPlateSketchRelations(plateId)")
    || !inspectorPanelText.includes("createPlateFromSketch: (sketchId) => createPlateFromSketch(sketchId)")
    || !objectPropertyMetadataText.includes("objectState")
    || !objectPropertyMetadataText.includes('collection === "sketches"')
    || !objectPropertyMetadataText.includes("sketchPropertiesSections")
    || objectPropertyMetadataText.includes("../../engine/")
    || objectPropertyMetadataText.includes("../engine/")
    || !objectPropertyMetadataText.includes("function arrayValues(value)")
    || inspectorPanelText.includes("const objectPropertyCommitBindings")
    || inspectorPanelText.includes("const objectPropertyActionBindings")
    || inspectorPanelText.includes("mergeObjectPatch(commit.bend")
    || inspectorPanelText.includes("const fastenerPropertiesSections")
    || inspectorPanelText.includes("fastenerGroupEditor")
    || inspectorPanelText.includes("checkboxInput")
    || inspectorPanelText.includes('entry.collection === "fastenerGroups"')
    || inspectorPanelText.includes("Head washer")
    || inspectorPanelText.includes("Nut washer")
    || inspectorPanelText.includes("Grip length")
    || inspectorPanelText.includes("const platePropertiesSections")
    || inspectorPanelText.includes('numericInput("Thickness"')
    || inspectorPanelText.includes('selectInput("Direction"')
    || inspectorPanelText.includes('numericInput("Angle"')
    || inspectorPanelText.includes('button("Remove Bend"')
    || inspectorPanelText.includes("api.upsertPlateBend(plateId, { ...bend")
    || inspectorPanelText.includes("const trimJointPropertiesSections")
    || inspectorPanelText.includes("const featurePropertiesSections")
    || inspectorPanelText.includes("const weldPropertiesSections")
    || inspectorPanelText.includes("const sketchEditor")
    || inspectorPanelText.includes("function sketchEditor")
    || inspectorPanelText.includes('button("Infer Missing Relations"')
    || inspectorPanelText.includes('button("Create Plate"')
    || inspectorPanelText.includes('text("div", "editor-subtitle", "Plate sketch")')
    || inspectorPanelText.includes("const relationViewDetail = relationsVisibleIn3d")
    || inspectorPanelText.includes("const visibleDiagnostics = definition.diagnostics")
    || inspectorPanelText.includes("return sketchEditor(object)")
    || inspectorPanelText.includes('id: "inspector.properties.object.sketch"')
    || inspectorPanelText.includes('label: "Sketch"')
    || inspectorPanelText.includes('label: "Free DOF"')
    || inspectorPanelText.includes("onChange: (fastenerRef) => updateFastenerGroup")
    || inspectorPanelText.includes("onChange: (thickness) => updatePlate")
    || inspectorPanelText.includes("onClick: () => selectObject(plate.id, relationViewDetail)")
    || inspectorPanelText.includes('{ type: "action", label: "Open Trim Editor", icon: "trim", primary: true, onClick')
    || inspectorPanelText.includes('{ type: "action", label: "Open Feature Editor", icon: "feature", primary: true, onClick')
    || inspectorPanelText.includes("onChange: (enabled) => updateTrimOperation")
    || inspectorPanelText.includes("onChange: (booleanType) => updateFeaturePatch")
    || inspectorPanelText.includes("onChange: (radius) => updateFeatureBody")
    || inspectorPanelText.includes("onChange: (size) => updateWeld")
  ) {
    fail(errors, "Inspector panel object Properties rows must emit serializable object.* intents and bind them at the panel boundary");
  }
  if (
    !viewerAppControllerText.includes("activeToolState()")
    || !viewerAppControllerText.includes("cycleActiveSnap()")
    || !viewerAppControllerText.includes("snapSettings()")
    || !viewerAppControllerText.includes("getCommandController()?.activeCommand?.()")
    || !viewerAppControllerText.includes("selectionController?.scope?.()")
  ) {
    fail(errors, "Viewer app controller must expose UI-safe active tool and snap settings state for the generated Inspector");
  }
  if (/"#[0-9a-fA-F]{3,8}"/.test(inspectorPanelText) || inspectorPanelText.includes('display: {')) {
    fail(errors, "Inspector panel must not stamp hardcoded display colors from UI actions; model/rendering defaults should own created-object appearance");
  }
  if (
    !featureEditorPanelText.includes("bindGeneratedPropertySections")
    || !featureEditorPanelText.includes("generatedPropertyField")
    || !featureEditorPanelText.includes("inspectorFeatureEditorSections")
    || !featureEditorPanelText.includes("const renderFeatureFields")
    || !featureEditorPanelText.includes("featureEditorBindings")
    || !featureEditorPanelText.includes('"feature.operationEnabled.set"')
    || !featureEditorPanelText.includes('"feature.update"')
    || !featureEditorPanelText.includes('"feature.body.update"')
    || !featureEditorPanelText.includes('"feature.body.outlinePoint.update"')
    || !featureEditorPanelText.includes('"feature.source.update"')
    || !featureEditorPanelText.includes("setMessage(\"Source member cannot be empty from this editor.\"")
    || featureEditorPanelText.includes("featurePatchCommit")
    || featureEditorPanelText.includes("BOOLEAN_TYPE_OPTIONS")
    || featureEditorPanelText.includes("SOURCE_KIND_OPTIONS")
    || featureEditorPanelText.includes("BODY_AXIS_TYPES")
    || featureEditorPanelText.includes("bodyAxesFields")
    || featureEditorPanelText.includes("bodyEditor")
    || featureEditorPanelText.includes("sourceEditor")
  ) {
    fail(errors, "Feature Editor must render metadata-owned descriptor sections through generated fields bound at the panel edge");
  }
  for (const localFieldBuilder of ["arrayInput", "checkboxInput", "numericInput", "selectInput", "textInput", "vectorInput", "readout("]) {
    if (featureEditorPanelText.includes(localFieldBuilder)) {
      fail(errors, `Feature Editor must not privately build generated-compatible field rows with ${localFieldBuilder}`);
    }
  }
  if (
    !trimJointEditorPanelText.includes("bindGeneratedPropertySections")
    || !trimJointEditorPanelText.includes("generatedPropertyField")
    || !trimJointEditorPanelText.includes("const renderTrimFields")
    || !trimJointEditorPanelText.includes("trimEditorBindings")
    || !trimJointEditorPanelText.includes("trimOperationCommit")
    || !trimJointEditorPanelText.includes("trimOperationTypeCommit")
    || !trimJointEditorPanelText.includes("trimOperationTypeCleanupPatch")
    || !trimJointEditorPanelText.includes("operationMemberEndFallback")
    || !trimJointEditorPanelText.includes("trimMemberEndCommit")
    || !trimJointEditorPanelText.includes('"trim.operation.update"')
    || !trimJointEditorPanelText.includes('"trim.operation.type.set"')
    || !trimJointEditorPanelText.includes('"trim.operation.memberEnd.set"')
    || !trimJointEditorPanelText.includes("trimMenuTypeOptions")
    || !trimJointEditorPanelText.includes("trimFormSection")
    || !trimJointEditorPanelText.includes("trimTargetRow")
    || !trimJointEditorPanelText.includes("planePicker")
    || !trimJointEditorPanelText.includes("segmentPicker")
    || !trimJointEditorPanelText.includes('type: "optionGrid"')
    || !trimJointEditorPanelText.includes('label: "Type"')
    || !trimJointEditorPanelText.includes('className: "trim-menu-type-grid"')
    || !trimJointEditorPanelText.includes('buttonClassName: "trim-menu-type-card"')
    || !trimJointEditorPanelText.includes('trimMenuTypeOptions(operation)')
    || !trimJointEditorPanelText.includes('label: "Object trim"')
    || trimJointEditorPanelText.includes('label: "End trim"')
    || !trimJointEditorPanelText.includes('trimFormSection(objectTrimMode ? "Objects" : "Bodies to be trimmed"')
    || !trimJointEditorPanelText.includes('trimFormSection("Trimming object"')
    || !trimJointEditorPanelText.includes('trimFormSection("Plane"')
    || !trimJointEditorPanelText.includes('trimFormSection("Direction"')
    || !trimJointEditorPanelText.includes('trimFormSection("Extend"')
    || !trimJointEditorPanelText.includes('trimFormSection("Weld gap"')
    || !trimJointEditorPanelText.includes('trimFormSection("Segments to keep"')
    || !trimJointEditorPanelText.includes('showSegments: type === "profile-cope"')
    || !trimJointEditorPanelText.includes("END_TRIM_TARGET_OPTIONS")
    || trimJointEditorPanelText.includes("BUTT_DIRECTION_OPTIONS")
    || !trimJointEditorPanelText.includes('trimOperationTypeCommit(operation)')
    || !trimJointEditorPanelText.includes("patch.memberAEnd = undefined")
    || !trimJointEditorPanelText.includes("patch.memberBEnd = undefined")
    || !trimJointEditorPanelText.includes("patch.referencePlaneIds = undefined")
    || !trimJointEditorPanelText.includes("patch.removedRegionKeys = undefined")
    || !trimJointEditorPanelText.includes("patch.miterMode = undefined")
    || !trimJointEditorPanelText.includes("patch.allowExtension = undefined")
    || !trimJointEditorPanelText.includes('if (trimOperationUsesMemberEnd(type, "memberA")) patch.memberAEnd = operationMemberEndFallback(operation, "memberA")')
    || !trimJointEditorPanelText.includes('if (trimOperationUsesMemberEnd(type, "memberB")) patch.memberBEnd = operationMemberEndFallback(operation, "memberB")')
    || !trimJointEditorPanelText.includes("trim-operation-metadata.mjs")
    || !trimJointEditorPanelText.includes('trimOperationIcon("plane-trim")')
    || !trimJointEditorPanelText.includes('trimOperationIcon("end-miter")')
    || !trimJointEditorPanelText.includes('trimOperationIcon("end-butt-both")')
    || trimJointEditorPanelText.includes("trimOperationIconMarkup")
    || trimJointEditorPanelText.includes("../../../rendering/trim-operation-icons.mjs")
    || !trimJointEditorPanelText.includes('type: "number"')
    || !trimJointEditorPanelText.includes('label: "Gap (mm)"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "gap")')
    || !trimJointEditorPanelText.includes('label: "Allow extension"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "allowExtension")')
    || !trimJointEditorPanelText.includes('type: "segmented"')
    || !trimJointEditorPanelText.includes('label: "Mitre mode"')
    || trimJointEditorPanelText.includes('label: "Butt direction"')
    || !trimJointEditorPanelText.includes('label: "Object"')
    || !trimJointEditorPanelText.includes('"Objects to trim"')
    || !trimJointEditorPanelText.includes('"Cutting objects"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "miterMode")')
    || !trimJointEditorPanelText.includes('value === "profile-balanced" ? "Balanced profile" : "Equal angle"')
    || !trimJointEditorPanelText.includes('label: "End"')
    || !trimJointEditorPanelText.includes('className: "trim-member-end-segment"')
    || !trimJointEditorPanelText.includes('commit: trimMemberEndCommit(operation, member)')
    || !trimJointEditorPanelText.includes('icon: "selection"')
    || !trimJointEditorPanelText.includes('icon: "reference-plane"')
  ) {
    fail(errors, "Trim Editor must render type cards, body pickers, trimming object, miter direction, weld gap, segments, and member-end rows through generated field descriptors bound at the panel edge, without a redundant Butt direction segment");
  }
  for (const localFieldBuilder of ["checkboxControl", "numericControl", "readout(", "miterModePicker", "onMiterModeChange", "trimTypePicker", "trimTypeIcon", "trimOptionGroup", "endToggle", "onEndChange", 'field("Result"', 'field("Planes"', 'field("Regions"', 'button("Pick Plane"', "trim-region-button", "trim-plane-list", "trim-plane-chip", "trim-member-end-toggle", "trim-end-option", "onTypeChange", "onPlanePick", "onPlaneRemove", "onRegionToggle"]) {
    if (trimJointEditorPanelText.includes(localFieldBuilder)) {
      fail(errors, `Trim Editor must not privately build generated-compatible overview/result/plane/region/enabled/gap/miter/member-end rows with ${localFieldBuilder}`);
    }
  }
  if (viewerEditorPanelsText.includes(".trim-type-grid") || viewerEditorPanelsText.includes(".trim-type-button") || viewerEditorPanelsText.includes(".trim-type-label") || viewerEditorPanelsText.includes(".trim-plane-list") || viewerEditorPanelsText.includes(".trim-region-list") || viewerEditorPanelsText.includes(".trim-plane-chip") || viewerEditorPanelsText.includes(".trim-plane-name") || viewerEditorPanelsText.includes(".trim-region-button") || viewerEditorPanelsText.includes(".trim-member-end-toggle") || viewerEditorPanelsText.includes(".trim-end-option")) {
    fail(errors, "Trim result, plane/region action, and member-end segmented styling must live in shared generated design-system recipes, not Trim-specific CSS");
  }
  if (!viewerEditorPanelsText.includes(".trim-target-end .bc-segmented-field")) {
    fail(errors, "Trim Editor body picker may only keep a small layout adapter for generated member-end segmented fields");
  }
  if (
    !trimJointEditorPanelText.includes('section.className = "bc-trim-section"')
    || !viewerEditorPanelsText.includes(".bc-trim-section")
    || trimJointEditorPanelText.includes("trim-editor-section")
    || viewerEditorPanelsText.includes(".trim-editor-section")
    || viewerEditorPanelsText.includes(".editor-sketch-status")
    || viewerEditorPanelsText.includes(".editor-details")
  ) {
    fail(errors, "Focused editor CSS must remove dead editor-status/detail selectors and use bc-trim-section for Trim-specific section layout");
  }
  for (const legacyTrimChromeToken of [
    '"editor-button"',
    '"editor-button danger"',
    '"editor-button primary"',
    '"editor-empty"',
    '"editor-section-title"'
  ]) {
    if (trimJointEditorPanelText.includes(legacyTrimChromeToken)) {
      fail(errors, `Trim Editor custom chrome must emit design-system classes directly instead of ${legacyTrimChromeToken}`);
    }
  }
  if (
    !trimJointEditorPanelText.includes('"bc-button"')
    || !trimJointEditorPanelText.includes('"bc-button bc-button-primary"')
    || !trimJointEditorPanelText.includes('"bc-button bc-button-danger"')
    || !trimJointEditorPanelText.includes('"bc-empty"')
    || !trimJointEditorPanelText.includes('"bc-section-title"')
  ) {
    fail(errors, "Trim Editor custom member/cut chrome must use native bc-button, bc-empty, and bc-section-title classes");
  }
  if (
    /"#[0-9a-fA-F]{3,8}"/.test(trimJointEditorPanelText)
    || !trimJointEditorPanelText.includes('TRIM_MEMBER_SWATCH_FALLBACK = "var(--bc-color-guide)"')
    || !trimJointEditorPanelText.includes('memberA: "var(--bc-color-accent)"')
    || !trimJointEditorPanelText.includes('memberB: "var(--bc-color-warning)"')
    || !trimJointEditorPanelText.includes('row.style.setProperty("--trim-target-color", trimMemberRoleColor(member.role))')
  ) {
    fail(errors, "Trim Editor member role swatches must use design-token colors instead of hardcoded UI hex values");
  }
  if (!viewerEditorPanelsText.includes(".trim-cut-header") || !viewerEditorPanelsText.includes("grid-template-columns: minmax(0, 1fr) auto auto;") || viewerEditorPanelsText.includes("grid-template-columns: minmax(0, 1fr) 30px auto auto;")) {
    fail(errors, "Trim Editor cut header grid must not reserve the old enabled-checkbox column after Enabled moved to generated fields");
  }
  if (
    !generatedPanelElementsText.includes('header.className = "bc-editor-header bc-inspector-header"')
    || !generatedPanelElementsText.includes('text("div", "bc-inspector-title", title)')
    || !generatedPanelElementsText.includes('button("Close", "bc-button", onClose, {')
    || !generatedPanelElementsText.includes('icon: "cancel"')
    || !generatedPanelElementsText.includes('title: "Close panel"')
    || !generatedPanelElementsText.includes('body.className = "bc-inspector-section"')
    || generatedPanelElementsText.includes('header.className = "feature-editor-header bc-inspector-header"')
    || generatedPanelElementsText.includes('text("div", "editor-title", title)')
    || generatedPanelElementsText.includes('button("Close", "editor-button", onClose)')
    || generatedPanelElementsText.includes('body.className = "editor-section bc-inspector-section"')
    || viewerEditorPanelsText.includes(".feature-editor-header")
  ) {
    fail(errors, "Shared focused editor panel chrome must use generic bc-editor-header/bc-inspector classes instead of Feature-specific legacy chrome");
  }
  if (!inspectorPropertyMetadataText.includes('className: "bc-field bc-field-stack"') || inspectorPropertyMetadataText.includes('className: "editor-field editor-field-stack"')) {
    fail(errors, "Generated multiline metadata should request bc-field/bc-field-stack classes directly instead of legacy editor-field stack classes");
  }
  if (
    !memberTransformPanelText.includes("bindGeneratedPropertyField")
    || !memberTransformPanelText.includes("generatedPropertyField")
    || !memberTransformPanelText.includes("generatedTransformBindings")
    || !memberTransformPanelText.includes('"transform.confirm"')
    || !memberTransformPanelText.includes('"transform.cancel"')
    || !memberTransformPanelText.includes('"transform.delta.set"')
    || !memberTransformPanelText.includes('"transform.result.set"')
    || !memberTransformPanelText.includes('"transform.increment.set"')
    || !memberTransformPanelText.includes('"transform.nudge"')
    || !memberTransformPanelText.includes('type: "axisTransformGrid"')
    || !memberTransformPanelText.includes('type: "actionRow"')
    || !memberTransformPanelText.includes('icon: "check"')
    || !memberTransformPanelText.includes('icon: "cancel"')
    || !memberTransformPanelText.includes('icon: "minus"')
    || !memberTransformPanelText.includes('icon: "add"')
    || !memberTransformPanelText.includes("affectedPointField")
    || !memberTransformPanelText.includes("member-transform-reference-row")
    || !memberTransformPanelText.includes("member-transform-affected-row")
    || !memberTransformPanelText.includes('"bc-empty"')
    || memberTransformPanelText.includes('"editor-empty"')
  ) {
    fail(errors, "Member Transform panel must render reference, affected-point, axis grid, and confirm/cancel rows through generated descriptors bound at the panel edge");
  }
  for (const forbiddenMemberTransformImport of ["../engine/", "../../engine/", "../../../engine/", "../rendering/", "../../rendering/", "../../../rendering/"]) {
    if (memberTransformPanelText.includes(forbiddenMemberTransformImport)) {
      fail(errors, `Member Transform panel must keep transform UI formatting local and avoid engine/rendering imports: ${forbiddenMemberTransformImport}`);
    }
  }
  for (const localTransformBuilder of ["function input", "matchesShortcut", "parseNumericControlValue", "member-transform-grid", "member-transform-input", "member-transform-step-input", "member-transform-nudge", "member-transform-step-row", "member-transform-target", "member-transform-point", 'button("OK"', 'button("x"', "member-transform-action"]) {
    if (memberTransformPanelText.includes(localTransformBuilder) || memberTransformPanelCssText.includes(localTransformBuilder)) {
      fail(errors, `Member Transform panel must not keep generated-compatible local transform controls or styling with ${localTransformBuilder}`);
    }
  }
  for (const axisGridCssToken of [".bc-axis-transform-field", ".bc-axis-transform-grid", ".bc-axis-transform-input", ".bc-axis-transform-step", ".bc-axis-transform-increment"]) {
    if (!panelsAndControlsText.includes(axisGridCssToken)) {
      fail(errors, `Design-system panels-and-controls CSS must own generated axis transform grid styling: ${axisGridCssToken}`);
    }
  }
  if (!iconNames.has("minus")) {
    fail(errors, "Icon registry must expose a minus icon for generated axis-transform nudge buttons");
  }
  if (!viewerRuntimeIntegrationText.includes("getEditorApi()?.refresh?.()") || !viewerRuntimeIntegrationText.includes("getEditorApi()?.clearSelection?.({ silent: true })")) {
    fail(errors, "Viewer command registration must refresh the Inspector and clear stale selection when active modeling command state changes");
  }
  const trimSceneMemberHandlerIndex = viewerRuntimeIntegrationText.indexOf("trimJointEditorConsumesMemberFace(face)");
  const memberSceneClickHandlerIndex = viewerRuntimeIntegrationText.indexOf("memberEdit.handleSceneClick(face)");
  if (
    !trimJointEditorPanelText.includes("selectMemberFromSceneFace")
    || !viewerRuntimeIntegrationText.includes("trimJointEditorPanelActive")
    || !viewerRuntimeIntegrationText.includes('trimJointEditorPanel.querySelector(".trim-cut-card, .trim-menu-type-card")')
    || !viewerRuntimeIntegrationText.includes('titleText === "Create Trim"')
    || trimSceneMemberHandlerIndex < 0
    || memberSceneClickHandlerIndex < 0
    || trimSceneMemberHandlerIndex > memberSceneClickHandlerIndex
  ) {
    fail(errors, "Viewer runtime must let the active Trim Editor consume member clicks before falling through to Member Transform selection");
  }
  if (
    !viewerRuntimeIntegrationText.includes("function showInspectorProperties")
    || !viewerRuntimeIntegrationText.includes("if (activeCommandId) workspaceBindings?.showInspectorProperties?.()")
    || !viewerRuntimeIntegrationText.includes("workspaceBindings.showInspectorProperties();")
    || !viewerRuntimeTextForInspector.includes('options.inspectorPanel === "component"')
    || !viewerRuntimeTextForInspector.includes('showInspectorContext("component"')
    || !viewerRuntimeTextForInspector.includes('onSmartComponentCreated: (smartComponentId) => showSmartComponentEditor(smartComponentId, { inspectorPanel: "component" })')
    || !inspectorPanelText.includes('inspectorPanel: "component"')
  ) {
    fail(errors, "Viewer runtime and Inspector actions must explicitly choose generated Properties by default and Component context only for parameter editing");
  }
  if (
    !inspectorPanelText.includes("inspectorMemberIdentitySection")
    || !inspectorPanelText.includes("inspectorMemberEditSections")
    || !inspectorPanelText.includes("inspectorMemberAdvancedSections")
    || !inspectorPanelText.includes("inspectorSmartComponentDiagnosticsSummary(smartComponent)")
    || !inspectorPanelText.includes("inspectorSmartComponentPropertySections")
    || !inspectorPanelText.includes("inspectorObjectIdentitySection")
    || !inspectorPropertyMetadataText.includes("export function inspectorMemberAdvancedSections")
    || !inspectorPropertyBindingsText.includes("member.customProfileDraft.set")
    || !inspectorPropertyBindingsText.includes("member.customProfile.create")
    || !inspectorPropertyBindingsText.includes("member.relation.remove")
    || inspectorPanelText.includes("const objectIdentitySection")
    || inspectorPanelText.includes("Advanced Member")
    || inspectorPanelText.includes("memberEditor")
    || inspectorPanelText.includes("memberRelationRows")
    || inspectorPanelText.includes("relationRows(")
    || inspectorPanelText.includes('button("Create + Apply Section"')
    || inspectorPanelText.includes("Custom section points")
    || inspectorPanelText.includes("centerDraft")
    || inspectorPanelText.includes("Center point")
    || inspectorPanelText.includes("Apply Center")
    || inspectorPanelText.includes('selectInput("Section"')
    || inspectorPanelText.includes('numericInput("Rotation"')
    || inspectorPanelText.includes('readout("Member", selectedMemberId)')
    || inspectorPanelText.includes('id: "inspector.properties.member.primary"')
    || inspectorPanelText.includes('id: "inspector.properties.member.position"')
    || inspectorPanelText.includes('id: "inspector.properties.member.endpoints"')
    || inspectorPanelText.includes('id: "inspector.properties.member.alignment"')
    || inspectorPanelText.includes('id: "inspector.properties.member.identity"')
    || inspectorPanelText.includes('id: "inspector.properties.smartComponent.identity"')
    || inspectorPanelText.includes('id: "inspector.properties.object.identity"')
    || inspectorPanelText.includes("smartComponentEditor")
    || inspectorPanelText.includes("deleteSelectedSmartComponent")
    || inspectorPanelText.includes("Advanced Smart Component")
    || inspectorPanelText.includes("Smart Component is valid.")
    || inspectorPanelText.includes("firstError")
    || inspectorPanelText.includes('button("Open Parameters"')
    || inspectorPanelText.includes('button("Remove Smart Component"')
  ) {
    fail(errors, "Inspector panel must derive generated member/edit/object identity sections from inspector-property-metadata");
  }
  for (const localSmartComponentBuilder of [
    "smartComponentRoleSection",
    "smartComponentManagedObjectEntries",
    "smartComponentOverrideObjectIds",
    "smartComponentLifecycleSection",
    "smartComponentObjectRolesForObject",
    "objectGeneratedBySection"
  ]) {
    if (inspectorPanelText.includes(`const ${localSmartComponentBuilder}`) || inspectorPanelText.includes(`function ${localSmartComponentBuilder}`)) {
      fail(errors, `Inspector panel must not own ${localSmartComponentBuilder}; Smart Component generated property descriptors must come from inspector-property-metadata`);
    }
  }
  if (!inspectorPanelText.includes("inspectorSupportObjectPropertySections")) {
    fail(errors, "Inspector panel must delegate support-object generated property sections to inspector-property-metadata");
  }
  for (const localBuilder of [
    "workPointPropertiesSections",
    "referencePlanePropertiesSections",
    "interfacePropertiesSections",
    "connectionZonePropertiesSections",
    "assemblyPropertiesSections",
    "groupPropertiesSections",
    "holePatternPropertiesSections",
    "objectPatternPropertiesSections",
    "relationPropertiesSections"
  ]) {
    if (inspectorPanelText.includes(`const ${localBuilder} =`)) {
      fail(errors, `Inspector panel must not own ${localBuilder}; support-object generated property sections must come from inspector-property-metadata`);
    }
  }
  const viewerRuntimeDataText = viewerRuntimeIntegrationText;
  if (!viewerRuntimeDataText.includes("Default workspace") || viewerRuntimeDataText.includes("Profile library") || viewerRuntimeDataText.includes("Fastener library")) {
    fail(errors, "Viewer runtime must keep app-owned project source rows explicit for the Files tab while library rows derive their display copy");
  }
  if (
    !viewerRuntimeDataText.includes("mountProjectFilesPanel")
    || !viewerRuntimeDataText.includes("projectFilesPanelRoot")
    || !viewerRuntimeDataText.includes("projectFilesPanelUi")
    || !viewerRuntimeDataText.includes("root: projectFilesPanelRoot")
    || !viewerRuntimeDataText.includes("sourceBaseUrl: projectUrl.href")
    || !viewerRuntimeDataText.includes("sources: projectDataSources()")
    || !viewerRuntimeDataText.includes('action.type === "showFileRow"')
    || !viewerRuntimeDataText.includes("getProjectFilesPanelUi()?.showRow?.(action.rowId)")
  ) {
    fail(errors, "Viewer runtime must mount Project Files and route source-file command results into the Files Data Dock tab");
  }
  const projectDataMountSnippet = viewerRuntimeDataText.match(/projectDataPanelUi = mountProjectDataPanel\(\{[\s\S]*?\n    \}\);/)?.[0] || "";
  if (projectDataMountSnippet.includes("sources:") || projectDataMountSnippet.includes("sourceBaseUrl:")) {
    fail(errors, "Viewer runtime must not pass file-source props into Project Data; source rows belong to Project Files");
  }
  if (
    !viewerRuntimeDataText.includes("loadRegisteredFrameLibrary")
    || !viewerRuntimeDataText.includes("project?.libraries?.frames?.path")
    || !viewerRuntimeDataText.includes("register?.libraries")
    || !viewerRuntimeDataText.includes("config.json")
    || !viewerRuntimeDataText.includes("libraries: { profiles, materials, fasteners, frames }")
  ) {
    fail(errors, "Viewer runtime must load the declared frame register/config and pass frames into Project Data libraries");
  }
  if (
    !viewerRuntimeDataText.includes("onRowAction")
    || !viewerRuntimeDataText.includes('action === "showCollection"')
    || !viewerRuntimeDataText.includes('showDataDockTab("model")')
    || !viewerRuntimeDataText.includes("modelBrowserUi?.showCollection?.(target)")
    || !viewerRuntimeDataText.includes('action === "showComponents"')
    || !viewerRuntimeDataText.includes('showDataDockTab("components")')
  ) {
    fail(errors, "Viewer runtime must wire Project Data row intents through Data Dock tab activation and Model Browser collection jumps");
  }
  if (!viewerRuntimeDataText.includes("smart-component-browser.mjs") || viewerRuntimeDataText.includes("mountSmartComponentLibraryUi")) {
    fail(errors, "Viewer runtime must mount the viewer-owned Smart Component browser for the Components Data Dock tab");
  }
  if (
    !viewerRuntimeDataText.includes("inspector-dock-metadata.mjs")
    || !viewerRuntimeDataText.includes("inspectorContextTabsForWorkspace")
    || !viewerRuntimeDataText.includes("syncInspectorDockTabs")
    || !viewerRuntimeDataText.includes("inspectorContextSpec")
  ) {
    fail(errors, "Viewer runtime must derive Inspector Dock contexts from inspector-dock-metadata");
  }
  if (
    viewerRuntimeDataText.includes("legacyActiveTabStorageKey")
    || viewerRuntimeDataText.includes("INSPECTOR_ACTIVE_CONTEXT_STORAGE_KEY")
    || viewerRuntimeDataText.includes("bobercad.ui.inspector.active-panel.v1")
  ) {
    fail(errors, "Viewer runtime must not preserve legacy Inspector active-tab migration");
  }
  if (
    !viewerRuntimeDataText.includes("inspectorContextCommandState")
    || !viewerRuntimeDataText.includes("showInspectorContext(contextId")
    || !viewerRuntimeDataText.includes("workspaceCustomizer?.setPanelTabVisible?.(INSPECTOR_PANEL_ID, contextId")
    || !viewerRuntimeDataText.includes("workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, contextId")
    || !viewerRuntimeDataText.includes("const inspectorContextCommandHandlers = Object.fromEntries(INSPECTOR_CONTEXTS.map((context)")
    || !viewerRuntimeDataText.includes("...inspectorContextCommandHandlers")
    || !viewerRuntimeDataText.includes("inspectorDockApi?.activate?.(activeContext")
  ) {
    fail(errors, "Viewer runtime must expose Inspector Dock contexts as metadata-derived workspace-tab actions with active/disabled state");
  }
  for (const localName of ["INSPECTOR_PANEL_DEFAULT_WIDTH", "INSPECTOR_PANEL_MIN_WIDTH", "INSPECTOR_PANEL_MAX_WIDTH", "INSPECTOR_PANEL_DEFAULT_VISIBLE"]) {
    if (!viewerRuntimeDataText.includes(localName)) fail(errors, `Viewer runtime must derive ${localName} from inspector-dock-metadata`);
  }
  if (
    viewerRuntimeDataText.includes("bobercad.ui.inspector.active-panel.v1")
    || viewerRuntimeDataText.includes('activePanel: "properties"')
    || viewerRuntimeDataText.includes("storageKey: INSPECTOR_ACTIVE_CONTEXT_STORAGE_KEY")
  ) {
    fail(errors, "Viewer runtime must use workspace panel activeTab for Inspector Dock state, with the legacy key only used for migration");
  }
}

module.exports = { checkLeftDockShellContracts };
