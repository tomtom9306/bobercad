const fs = require("fs");
const path = require("path");
const { validateValue } = require("../validate_json_schema");
const { ROOT, fail, parseModelCollections, readJson, stripCssComments, lineNumberAt } = require("./ui_contract_helpers");

function checkGeneratedPanelContracts(context) {
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
  const generatedPropertiesText = fs.readFileSync(generatedPropertiesPanelPath, "utf8");
  const generatedPanelElementsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/panel-elements.mjs"), "utf8");
  const generatedPropertyBindingsText = fs.readFileSync(generatedPropertyBindingsPath, "utf8");
  const inspectorPropertyMetadataText = fs.readFileSync(inspectorPropertyMetadataPath, "utf8");
  const panelsAndControlsCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/panels-and-controls.css"), "utf8");
  const uiElementsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/ui-elements.mjs"), "utf8");
  for (const fieldType of ["number", "numberChoice", "numberList", "vector3", "vector2", "axisTransformGrid", "select", "segmented", "optionGrid", "checkbox", "text", "tabList", "readoutList", "actionList", "actionRow", "action", "objectRef", "objectRefList", "statusGroupTitle", "statusRow", "summaryCard", "statusListCard", "nestedFieldCard", "diagnosticList", "message"]) {
    if (!generatedPropertiesText.includes(`field.type === "${fieldType}"`)) {
      fail(errors, `Generated Properties renderer must support descriptor field type: ${fieldType}`);
    }
  }
  if (
    generatedPropertiesText.includes("section.rows")
    || generatedPropertiesText.includes("rows?.length")
    || generatedPropertiesText.includes('button("Select"')
    || generatedPropertiesText.includes('button("Fit"')
    || generatedPropertyBindingsText.includes("rows: section.rows")
    || generatedPropertyBindingsText.includes("section.rows")
    || generatedPropertyBindingsText.includes("bound.select")
    || generatedPropertyBindingsText.includes("bound.fit")
  ) {
    fail(errors, "Generated Properties renderer and binding adapter must use field/action descriptors, not raw section rows or hardcoded objectRef select/fit buttons");
  }
  if (!generatedPropertiesText.includes("decoratePropertyField") || !generatedPropertiesText.includes("row.dataset.parameterPath") || !generatedPropertiesText.includes("row.dataset.path")) {
    fail(errors, "Generated Properties renderer must preserve descriptor identity on DOM rows");
  }
  if (
    !generatedPropertiesText.includes("function diagnosticListField")
    || !generatedPropertiesText.includes("diagnosticListControl")
    || !generatedPanelElementsText.includes("export function diagnosticListControl")
    || !generatedPanelElementsText.includes('list.className = "bc-diagnostic-list"')
    || !generatedPanelElementsText.includes('item.className = "bc-diagnostic-item"')
    || !generatedPanelElementsText.includes("item.dataset.severity = severity")
    || !generatedPanelElementsText.includes('"bc-diagnostic-title"')
    || !generatedPanelElementsText.includes('"bc-diagnostic-meta"')
  ) {
    fail(errors, "Generated Properties renderer must expose a design-system diagnosticList descriptor renderer");
  }
  if (
    !generatedPropertiesText.includes("function objectRefListField")
    || !generatedPropertiesText.includes("objectRefListControl")
    || !generatedPanelElementsText.includes("export function objectRefControl")
    || !generatedPanelElementsText.includes("export function objectRefListControl")
    || !generatedPanelElementsText.includes('list.className = "bc-object-ref-list"')
    || !generatedPanelElementsText.includes("list.append(objectRefControl(item))")
  ) {
    fail(errors, "Generated Properties renderer must expose a reusable objectRefList descriptor renderer");
  }
  if (
    !generatedPropertiesText.includes("function readoutListField")
    || !generatedPropertiesText.includes("readoutListControl")
    || !generatedPanelElementsText.includes("export function readoutListControl")
    || !generatedPanelElementsText.includes('list.className = "bc-readout-list"')
  ) {
    fail(errors, "Generated Properties renderer must expose a reusable readoutList descriptor renderer");
  }
  if (
    !generatedPropertiesText.includes("function tabListField")
    || !generatedPropertiesText.includes("tabListControl")
    || !generatedPanelElementsText.includes("export function tabListControl")
    || !generatedPanelElementsText.includes('list.setAttribute("role", "tablist")')
    || !generatedPanelElementsText.includes('item.setAttribute("role", "tab")')
    || !generatedPanelElementsText.includes('item.setAttribute("aria-selected"')
    || !generatedPanelElementsText.includes('event.key === "ArrowRight"')
    || !generatedPanelElementsText.includes('event.key === "Home"')
    || !generatedPanelElementsText.includes('event.key === "End"')
  ) {
    fail(errors, "Generated Properties renderer must expose an accessible tabList descriptor renderer");
  }
  if (
    !generatedPropertyBindingsText.includes("items: bindGeneratedPropertyFields(field.items, bindings)")
    || !generatedPropertyBindingsText.includes("rows: bindGeneratedPropertyRows(field.rows, bindings)")
    || !generatedPropertyBindingsText.includes("function bindGeneratedPropertyValueControl")
    || !generatedPropertyBindingsText.includes("delta: bindGeneratedPropertyValueControl(row.delta, bindings)")
    || !generatedPropertyBindingsText.includes("result: bindGeneratedPropertyValueControl(row.result, bindings)")
    || !generatedPropertyBindingsText.includes("confirmAction: bindGeneratedPropertyAction(field.confirmAction, bindings)")
    || !generatedPropertyBindingsText.includes("cancelAction: bindGeneratedPropertyAction(field.cancelAction, bindings)")
  ) {
    fail(errors, "Generated Property bindings must hydrate nested list descriptor items, rows, row value controls, and confirm/cancel actions");
  }
  if (
    !generatedPropertiesText.includes("vectorControl")
    || !generatedPanelElementsText.includes("export function vectorControl")
    || !generatedPanelElementsText.includes("options.axisLabels")
    || !generatedPanelElementsText.includes("options.options?.axisLabels")
  ) {
    fail(errors, "Generated Properties vector fields must support descriptor-provided axis labels for local CAD coordinate rows");
  }
  if (
    !generatedPropertiesText.includes("function axisTransformGridField")
    || !generatedPropertiesText.includes("axisTransformGridControl")
    || !generatedPanelElementsText.includes("export function axisTransformGridControl")
    || !generatedPanelElementsText.includes("axisTransformInput(axis.delta")
    || !generatedPanelElementsText.includes("axisTransformInput(axis.result")
    || !generatedPanelElementsText.includes("axisTransformIncrement(field.increment")
    || !generatedPropertiesText.includes('field.type === "axisTransformGrid"')
    || !generatedPanelElementsText.includes("function axisTransformShortcutMatches")
    || !generatedPanelElementsText.includes("axisTransformShortcutSetting(field.shortcuts")
    || generatedPropertiesText.includes("rendering/interaction/keyboard-shortcuts")
  ) {
    fail(errors, "Generated Properties renderer must route shortcut-aware axis transform grid descriptors through shared panel primitives");
  }
  for (const token of [
    "function actionField",
    "function actionRowField",
    "function actionListField",
    "function segmentedField",
    "segmentedFieldControl",
    "function optionGridField",
    "diagnosticListControl",
    "objectRefControl",
    "objectRefListControl",
    "readoutListControl",
    "axisTransformGridControl",
    "optionGridControl",
    "tabListControl",
    "statusGroupTitleControl",
    "statusRowControl",
    "messageControl",
    "summaryCardControl",
    "statusListRowControl",
    "function axisTransformGridField",
    "function summaryCardField",
    "function statusListCardField",
    "function nestedFieldCardField",
    "function appendActionRow",
    "descriptorActions",
    "propertyButtonClass",
    "function isReadOnlyField",
    "function readOnlyPropertyField",
    "function fieldControls",
    "function setFieldInvalidState",
    "function applyControlState",
    "function appendFieldNotes",
    "function validationState",
    "function classTokens",
    "row.classList.add(...classTokens(field.className))",
    "field.className",
    "field.status",
    "aria-invalid",
    "aria-disabled",
    "aria-describedby",
    "field.disabled",
    "field.disabledReason",
    "field.readOnly",
    "field.help",
    "field.warning",
    "field.error",
    "field.validation"
  ]) {
    if (!generatedPropertiesText.includes(token)) {
      fail(errors, `Generated Properties renderer must support descriptor field state metadata: ${token}`);
    }
  }
  for (const token of ["export function statusGroupTitleControl", "export function statusRowControl", "export function messageControl"]) {
    if (!generatedPanelElementsText.includes(token)) {
      fail(errors, `Shared panel-elements primitives must include generated status/message support token: ${token}`);
    }
  }
  for (const token of ["export function summaryCardControl", "export function statusListRowControl"]) {
    if (!generatedPanelElementsText.includes(token)) {
      fail(errors, `Shared panel-elements primitives must include generated card/list support token: ${token}`);
    }
  }
  if (
    !uiElementsText.includes("export function propertiesPanelShell")
    || !uiElementsText.includes('panel.dataset.inspectorProperties = "true"')
    || !uiElementsText.includes('panel.className = "bc-properties-panel"')
    || !uiElementsText.includes('header.className = "bc-properties-header"')
    || !uiElementsText.includes('copy.className = "bc-properties-header-copy"')
    || !uiElementsText.includes('body.className = "bc-properties-body"')
    || !uiElementsText.includes("function propertyBadges")
    || !uiElementsText.includes('row.className = "bc-properties-badges"')
    || !uiElementsText.includes('item.className = "bc-properties-badge"')
    || !uiElementsText.includes("export function disclosureSection")
    || !uiElementsText.includes("workspaceSectionOpen(sectionId)")
    || !uiElementsText.includes("setWorkspaceSectionOpen(sectionId, details.open)")
    || !uiElementsText.includes('details.dataset.state = details.open ? "open" : "closed"')
    || !generatedPanelElementsText.includes("return designPropertiesPanelShell(options)")
    || !generatedPanelElementsText.includes("return designDisclosureSection(label, rows, options)")
    || generatedPanelElementsText.includes("function propertyBadges")
    || generatedPanelElementsText.includes('panel.className = "bc-properties-panel"')
  ) {
    fail(errors, "Design-system ui-elements must own generated Properties shell, disclosure state, header, body, and badge markup while panel-elements delegates");
  }
  if (
    !generatedPropertiesText.includes("function partitionPropertySections")
    || !generatedPropertiesText.includes("function propertySectionZone")
    || !generatedPropertiesText.includes("PROPERTY_SECTION_ZONE_ORDER")
    || !generatedPropertiesText.includes('zone.className = "bc-properties-zone"')
    || !generatedPropertiesText.includes("zone.dataset.propertyZone = placement")
    || !generatedPropertiesText.includes("comparePropertySections")
    || !generatedPropertiesText.includes("finitePriority")
    || !panelsAndControlsCssText.includes(".bc-properties-zone")
    || !panelsAndControlsCssText.includes('[data-property-zone="actions"]')
    || !panelsAndControlsCssText.includes('[data-property-zone="diagnostics"]')
    || !panelsAndControlsCssText.includes('[data-property-zone="reference"]')
  ) {
    fail(errors, "Generated Properties renderer must use placement/priority metadata to render design-system property zones");
  }
  if (
    !inspectorPropertyMetadataText.includes('placement: "diagnostics"')
    || !inspectorPropertyMetadataText.includes('placement: "actions"')
    || !inspectorPropertyMetadataText.includes('placement: "reference"')
    || !inspectorPropertyMetadataText.includes('id: "inspector.properties.object.generatedBy"')
    || !inspectorPropertyMetadataText.includes('id: "inspector.properties.smartComponent.actions"')
    || !inspectorPropertyMetadataText.includes('id: "inspector.properties.smartComponent.diagnostics"')
  ) {
    fail(errors, "Inspector property metadata must explicitly place high-value diagnostics, actions, and provenance/reference sections");
  }
  for (const localToken of ["function statusGroupTitleField", "function statusRowField", "function messageField"]) {
    if (generatedPropertiesText.includes(localToken)) {
      fail(errors, `Generated Properties status/message markup must live in shared panel-elements primitives, not local ${localToken}`);
    }
  }
  for (const localToken of [
    "function propertyBadges",
    '"bc-properties-panel"',
    '"bc-properties-header"',
    '"bc-properties-header-icon"',
    '"bc-properties-header-copy"',
    '"bc-properties-body"',
    '"bc-properties-badges"',
    '"bc-properties-badge"'
  ]) {
    if (generatedPropertiesText.includes(localToken)) {
      fail(errors, `Generated Properties shell markup must live in shared panel-elements primitives, not local ${localToken}`);
    }
  }
  for (const localToken of ['"bc-summary-card"', '"bc-summary-card-title"', '"bc-status-list-row"']) {
    if (generatedPropertiesText.includes(localToken)) {
      fail(errors, `Generated Properties summary-card markup must live in shared panel-elements primitives, not local ${localToken}`);
    }
  }
  for (const token of [
    "actionFieldControl",
    "actionRowControl",
    "actionListControl",
    "axisTransformGridControl",
    "segmentedFieldControl",
    "numberChoiceControl",
    "numberListControl",
    "diagnosticListControl",
    "objectRefControl",
    "objectRefListControl",
    "optionGridControl",
    "readoutListControl",
    "tabListControl",
    "vectorControl",
    'text("span", "bc-label"',
    'text("div", "bc-empty"'
  ]) {
    if (!generatedPropertiesText.includes(token)) {
      fail(errors, `Generated Properties renderer must emit design-system-native classes instead of legacy editor classes: ${token}`);
    }
  }
  if (!generatedPanelElementsText.includes('text("div", "bc-message"')) {
    fail(errors, "Shared panel primitives must own generated message design-system classes");
  }
  for (const token of ['"bc-button"', '"bc-button-primary"', '"bc-button-danger"']) {
    if (!generatedPanelElementsText.includes(token)) {
      fail(errors, `Shared panel primitives must own generated button design-system classes: ${token}`);
    }
  }
  for (const deprecatedToken of [
    "editor-",
    'field.type === "plateRelationGroupTitle"',
    'field.type === "plateRelationRow"',
    'field.type === "plateRelationCard"',
    'field.type === "plateUnderDefinedCard"',
    'field.type === "plateSketchSelectionCard"',
    "function plateRelationGroupTitleField",
    "function plateRelationRowField",
    "function plateRelationCardField",
    "function plateUnderDefinedCardField",
    "function plateSketchSelectionCardField",
    "function appendInlineActionRow",
    "function relationRowActions",
    "editor-relation-",
    "editor-inline-actions",
    "editor-under-defined-row",
    "editor-selected-relation"
  ]) {
    if (generatedPropertiesText.includes(deprecatedToken)) {
      fail(errors, `Generated Properties renderer must use generic status/summary descriptors instead of deprecated plate UI token: ${deprecatedToken}`);
    }
  }
  for (const token of [
    "bindGeneratedPropertySections",
    "bindGeneratedPropertyField",
    "bindGeneratedPropertyFields",
    "bindGeneratedPropertyActions",
    "bindGeneratedPropertyActionGroups",
    "bindGeneratedPropertyGroups",
    "bindGeneratedPropertyAction",
    "generatedPropertyDescriptorsContainFunctions",
    "bound.commit",
    "bound.commandId",
    "bound.action",
    "sectionWithoutRawRows"
  ]) {
    if (!generatedPropertyBindingsText.includes(token)) {
      fail(errors, `Generated Properties binding adapter must support descriptor intent token: ${token}`);
    }
  }
  if (!generatedPanelElementsText.includes("options.disabled") || !generatedPanelElementsText.includes("element.disabled") || !generatedPanelElementsText.includes("aria-disabled") || !generatedPanelElementsText.includes("options.disabledReason")) {
    fail(errors, "Panel button primitive must honor generated descriptor disabled state and disabled reasons");
  }
  for (const helper of ["actionButton", "actionRow"]) {
    if (!generatedPanelElementsText.includes(`export function ${helper}`)) {
      fail(errors, `Panel primitives must expose shared generated action helper: ${helper}`);
    }
  }
  if (
    !generatedPanelElementsText.includes("return button(action.label, className, action.onClick")
    || !generatedPanelElementsText.includes("options.buttonClassName")
    || !generatedPanelElementsText.includes('options.className || "bc-action-row"')
  ) {
    fail(errors, "Panel action helpers must preserve descriptor icon/title/pressed/disabled state and action-row class customization");
  }
  for (const legacyPrimitiveToken of [
    "function designClass",
    "classes.includes(\"editor-",
    "className.includes(\"editor-",
    "editor-title",
    "editor-section-title",
    "editor-subtitle",
    "editor-help",
    "editor-error",
    "editor-warning",
    "editor-label",
    "editor-value",
    "editor-empty",
    "editor-message",
    "editor-field",
    "editor-readout",
    "editor-button",
    "editor-actions"
  ]) {
    if (generatedPanelElementsText.includes(legacyPrimitiveToken)) {
      fail(errors, `Panel primitives must emit design-system bc-* classes directly instead of translating legacy ${legacyPrimitiveToken}`);
    }
  }
  if (generatedPanelElementsText.includes("editor-inline-actions")) {
    fail(errors, "Panel primitives must map generated action rows through bc-action-row directly instead of the deprecated editor-inline-actions class");
  }
  if (
    !uiElementsText.includes('elementText("span", "bc-label", label)')
    || !uiElementsText.includes('return labeledElement("div", "bc-field", label, ...children)')
    || !uiElementsText.includes('return labeledElement("div", "bc-readout", label, elementText("span", "bc-readout-value", value))')
    || !generatedPanelElementsText.includes("return designField(label, ...children)")
    || !generatedPanelElementsText.includes("return designReadout(label, value)")
    || !generatedPanelElementsText.includes('options.className || "bc-field"')
    || !generatedPanelElementsText.includes('return labeledElement("label", "bc-field", label, input)')
    || !generatedPanelElementsText.includes('text("div", "bc-subtitle", label)')
    || uiElementsText.includes('elementText("span", "editor-label", label)')
    || uiElementsText.includes('return labeledElement("div", "editor-field", label, ...children)')
    || generatedPanelElementsText.includes('options.className || "editor-field"')
    || generatedPanelElementsText.includes('return labeledElement("label", "editor-field", label, input)')
    || generatedPanelElementsText.includes('text("div", "editor-subtitle", label)')
    || uiElementsText.includes('return labeledElement("div", "editor-readout", label, elementText("span", "editor-value", value))')
  ) {
    fail(errors, "Design-system and panel primitive defaults must emit bc-field/bc-label/bc-readout markup directly for generated Properties and focused editors");
  }
  const modelBrowserText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/model-browser.mjs"), "utf8");
  const leftDockResultMetadataText = fs.readFileSync(leftDockResultMetadataPath, "utf8");
  const projectFilesPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/project-files-panel.mjs"), "utf8");
  const projectDataPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/project-data-panel.mjs"), "utf8");
  const panelsAndControlsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/panels-and-controls.css"), "utf8");
  if (
    !generatedPropertiesText.includes("segmentedFieldControl")
    || !generatedPanelElementsText.includes("export function segmentedFieldControl")
    || !generatedPanelElementsText.includes("segmentedControl")
    || !generatedPanelElementsText.includes('row.className = "bc-field bc-segmented-field"')
    || !panelsAndControlsText.includes(".bc-segmented-field")
  ) {
    fail(errors, "Generated Properties segmented fields must render through the shared segmented control and design-system field styling");
  }
  if (
    !generatedPropertiesText.includes("optionGridControl")
    || !generatedPanelElementsText.includes("export function optionGridControl")
    || !generatedPanelElementsText.includes("createIcon(option.icon)")
    || !generatedPanelElementsText.includes('row.className = "bc-field bc-option-grid-field"')
    || generatedPropertiesText.includes("function normalizeOptionGridOptions")
    || generatedPropertiesText.includes("function optionGridIcon")
    || generatedPropertiesText.includes("option.iconMarkup")
    || generatedPropertiesText.includes("template.innerHTML")
    || !panelsAndControlsText.includes(".bc-option-grid-field")
    || !panelsAndControlsText.includes(".bc-option-grid-button")
    || panelsAndControlsText.includes(".bc-option-grid-button svg")
  ) {
    fail(errors, "Generated Properties option-grid fields must use registry icon ids and design-system grid styling without raw SVG markup injection");
  }
  if (
    !generatedPropertiesText.includes("actionFieldControl")
    || !generatedPropertiesText.includes("actionRowControl")
    || !generatedPropertiesText.includes("actionListControl")
    || !generatedPanelElementsText.includes("export function actionFieldControl")
    || !generatedPanelElementsText.includes("export function actionRowControl")
    || !generatedPanelElementsText.includes("export function actionListControl")
    || !generatedPanelElementsText.includes("export function descriptorActions")
    || !generatedPanelElementsText.includes("export function propertyButtonClass")
    || !generatedPanelElementsText.includes("bc-action-list-field")
    || !generatedPanelElementsText.includes("bc-action-list-control")
    || !generatedPanelElementsText.includes("bc-action-list-empty")
    || !generatedPropertiesText.includes("actionRow")
    || generatedPropertiesText.includes("button(action.label")
    || !panelsAndControlsText.includes(".bc-action-list-field")
    || !panelsAndControlsText.includes(".bc-action-list-control")
    || !panelsAndControlsText.includes(".bc-action-list-empty")
  ) {
    fail(errors, "Generated Properties action-list fields must render labeled action groups through shared design-system styling");
  }
  if (!panelsAndControlsText.includes(".bc-readout-list") || !panelsAndControlsText.includes("gap: var(--bc-space-4);")) {
    fail(errors, "Design-system panels-and-controls CSS must own generated readout-list spacing");
  }
  for (const token of [".bc-object-ref-list", ".bc-diagnostic-list", ".bc-diagnostic-item", ".bc-diagnostic-title", ".bc-diagnostic-meta"]) {
    if (!panelsAndControlsText.includes(token)) {
      fail(errors, `Design-system panels-and-controls CSS must own generated diagnostic/reference list styling: ${token}`);
    }
  }
  for (const token of [
    ".bc-status-row",
    ".bc-status-row.selected",
    ".bc-status-label",
    ".bc-status-value-input",
    ".bc-status-diagnostic",
    ".bc-status-group-title",
    ".bc-status-list-row",
    ".bc-summary-card",
    ".bc-summary-card-title"
  ]) {
    if (!panelsAndControlsText.includes(token)) {
      fail(errors, `Design-system panels-and-controls CSS must own generic generated status/summary styling: ${token}`);
    }
  }
  if (panelsAndControlsText.includes(".bc-status-row .editor-value") || panelsAndControlsText.includes(".bc-status-list-row .editor-value")) {
    fail(errors, "Design-system status/summary recipes must use bc-status-label instead of legacy editor-value selectors");
  }
  if (
    !generatedPropertiesText.includes("tabListControl")
    || !generatedPanelElementsText.includes("export function tabListControl")
    || !generatedPanelElementsText.includes('list.className = classNames("bc-tab-list"')
    || generatedPropertiesText.includes("document.querySelectorAll(`[data-generated-tab-list")
    || !panelsAndControlsText.includes(".bc-tab-list")
    || !panelsAndControlsText.includes(".bc-tab-button")
    || !panelsAndControlsText.includes('.bc-tab-button[aria-selected="true"]')
    || !panelsAndControlsText.includes(".bc-panel-tab-strip")
    || !panelsAndControlsText.includes(".bc-panel-tab")
  ) {
    fail(errors, "Design-system panels-and-controls CSS must own generated tab-list styling");
  }
  const smartComponentBrowserText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/smart-component-browser.mjs"), "utf8");
  const smartComponentBrowserCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/smart-component-browser.css"), "utf8");
  const connectionArtworkAssets = [
    "apex-gusset.png",
    "base-plate.png",
    "end-plate.png",
    "fin-plate.png",
    "hardware.png",
    "member-splice.png",
    "moment-end-plate.png"
  ];
  const commandPaletteText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/command-palette.mjs"), "utf8");
  const commandPaletteCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/command-palette.css"), "utf8");
  const commandRegistryText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/commands/command-registry.mjs"), "utf8");
  const inspectorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-panel.mjs"), "utf8");
  const inspectorPropertyBindingsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs"), "utf8");
  const featureEditorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/feature-editor-panel.mjs"), "utf8");
  const trimJointEditorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/trim-joint-editor-panel.mjs"), "utf8");
  const memberTransformPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/member-transform-panel.mjs"), "utf8");
  const memberTransformPanelCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/member-transform-panel.css"), "utf8");
  const viewerEditorPanelsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-editor-panels.css"), "utf8");
  const inspectorDockText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/inspector-dock.mjs"), "utf8");
  const inspectorDockCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/inspector-dock.css"), "utf8");
  const designTokensText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/tokens.css"), "utf8");
  const workspaceShellText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/workspace-shell.css"), "utf8");
  const viewerStyleText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/style.css"), "utf8");
  const viewerIndexText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/index.html"), "utf8");
  const viewerRuntimeTextForInspector = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
  const viewerCommandRegistrationText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-command-registration.mjs"), "utf8");
  const viewerWorkspaceBindingsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-workspace-bindings.mjs"), "utf8");
  const viewerRuntimeIntegrationText = [
    viewerRuntimeTextForInspector,
    viewerCommandRegistrationText,
    viewerWorkspaceBindingsText
  ].join("\n");
  const viewerAppControllerText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-app-controller.mjs"), "utf8");
  if (
    !viewerIndexText.includes('id="project-files-panel"')
    || !viewerIndexText.includes('aria-label="Project files"')
    || !viewerIndexText.includes('id="project-data-panel" aria-label="Project data"')
  ) {
    fail(errors, "Viewer index must provide separate Files and Data panel slots for the left Data Dock");
  }
  if (
    inspectorDockText.includes("removeExistingTablist")
    || !inspectorDockText.includes('tablist.setAttribute("role", "tablist")')
    || !inspectorDockText.includes('tab.setAttribute("role", "tab")')
    || !inspectorDockText.includes('tab.setAttribute("aria-selected"')
    || !inspectorDockText.includes('tab.setAttribute("aria-controls"')
    || !inspectorDockText.includes('spec.panel.setAttribute("role", "tabpanel")')
    || !inspectorDockText.includes('spec.panel.setAttribute("aria-labelledby"')
    || !inspectorDockText.includes('spec.panel.setAttribute("aria-hidden"')
    || !inspectorDockText.includes('createIcon(spec.icon || "inspector")')
    || !inspectorDockText.includes('event.key === "ArrowRight"')
    || !inspectorDockText.includes('event.key === "Home"')
    || !inspectorDockText.includes('tabbar.className = "bc-dock-tabs bc-inspector-dock-tabs"')
    || !inspectorDockText.includes('tab.className = "bc-dock-tab')
    || !inspectorDockText.includes('"bc-dock-tab-label"')
    || !inspectorDockCssText.includes(".bc-inspector-dock-shell > .bc-dock-tabs")
    || !inspectorDockCssText.includes('.bc-inspector-dock-body .bc-inspector-context-panel[data-inspector-active="false"]')
  ) {
    fail(errors, "Inspector dock must render metadata-driven SVG context tabs with tablist/tab/tabpanel ARIA and keyboard navigation");
  }
  for (const deprecatedSelector of [
    ".editor-relation-row",
    ".editor-relation-group-title",
    ".editor-inline-actions",
    ".editor-selected-relation",
    ".editor-under-defined-row"
  ]) {
    if (viewerEditorPanelsText.includes(deprecatedSelector)) {
      fail(errors, `Viewer editor CSS must use shared generated status/summary recipes instead of deprecated selector ${deprecatedSelector}`);
    }
  }
  for (const helper of ["dataPanelHeader", "dataPanelSearch", "dataPanelEmpty", "dataPanelSection", "dataPanelCollection", "dataPanelRowCopy", "dataPanelRow", "dataPanelActionRow", "dataPanelLinkRow"]) {
    if (!uiElementsText.includes(`export function ${helper}`)) {
      fail(errors, `ui-elements must export shared left-dock data-panel helper: ${helper}`);
    }
  }
  for (const token of [
    '${namespace}-header bc-data-header',
    '${namespace}-search bc-data-search',
    '${namespace}-empty bc-data-empty',
    '${namespace}-${suffix} bc-data-section',
    '${namespace}-collection bc-data-collection',
    '${namespace}-row-copy bc-data-row-copy',
    '"bc-data-row"',
    '"bc-data-action-row"',
    'bc-data-row-main',
    'bc-data-row-action'
  ]) {
    if (!uiElementsText.includes(token)) {
      fail(errors, `ui-elements data-panel helpers must preserve namespace plus shared data classes: ${token}`);
    }
  }
  if (
    !modelBrowserText.includes("dataPanelHeader")
    || !modelBrowserText.includes("dataPanelSearch")
    || !modelBrowserText.includes("dataPanelEmpty")
    || !modelBrowserText.includes("dataPanelCollection")
    || !modelBrowserText.includes("dataPanelActionRow")
    || !projectFilesPanelText.includes("dataPanelHeader")
    || !projectFilesPanelText.includes("dataPanelSearch")
    || !projectFilesPanelText.includes("dataPanelEmpty")
    || !projectFilesPanelText.includes("dataPanelSection")
    || !projectFilesPanelText.includes("dataPanelLinkRow")
    || !projectDataPanelText.includes("dataPanelHeader")
    || !projectDataPanelText.includes("dataPanelSearch")
    || !projectDataPanelText.includes("dataPanelEmpty")
    || !projectDataPanelText.includes("dataPanelSection")
    || !projectDataPanelText.includes("dataPanelRow")
    || !projectDataPanelText.includes("dataPanelActionRow")
    || !smartComponentBrowserText.includes("dataPanelHeader")
    || !smartComponentBrowserText.includes("dataPanelSearch")
    || !smartComponentBrowserText.includes("dataPanelEmpty")
    || !smartComponentBrowserText.includes("dataPanelSection")
    || !smartComponentBrowserText.includes("dataPanelCollection")
    || !smartComponentBrowserText.includes("dataPanelRow")
    || !smartComponentBrowserText.includes("dataPanelActionRow")
  ) {
    fail(errors, "Left-dock Files, Model Browser, Project Data, and Smart Component Browser must use shared data-panel DOM helpers for repeated shell scaffolding");
  }
  for (const [name, textContent] of [
    ["Model Browser", modelBrowserText],
    ["Project Files", projectFilesPanelText],
    ["Project Data", projectDataPanelText],
    ["Smart Component Browser", smartComponentBrowserText]
  ]) {
    for (const localRowToken of ["bc-data-row-main", "bc-data-row-action", "bc-data-action-row"]) {
      if (textContent.includes(localRowToken)) {
        fail(errors, `${name} must render data rows through shared ui-elements helpers instead of hand-built ${localRowToken} markup`);
      }
    }
  }
  if (!modelBrowserText.includes("model-collection-metadata.mjs") || !modelBrowserText.includes("model-browser-metadata.mjs") || modelBrowserText.includes("const COLLECTION_GROUPS")) {
    fail(errors, "Model Browser must derive collection groups from model-collection-metadata and panel identity from model-browser-metadata");
  }
  if (
    !modelBrowserText.includes("modelObjectSearchDescriptor")
    || !modelBrowserText.includes("searchText: descriptor.searchText")
    || !modelBrowserText.includes("item.searchText")
    || !leftDockResultMetadataText.includes("modelObjectSearchDescriptor")
    || !leftDockResultMetadataText.includes("description: descriptor.description")
    || !leftDockResultMetadataText.includes("keywords: descriptor.keywords")
  ) {
    fail(errors, "Model Browser and left-dock command results must share modelObjectSearchDescriptor for semantic object search");
  }
  if (modelBrowserText.includes("MODEL_BROWSER_VISIBILITY_MODES = Object.freeze") || modelBrowserText.includes('textContent = "Project"') || modelBrowserText.includes('placeholder = "Search model"')) {
    fail(errors, "Model Browser must not redeclare panel copy or visibility mode metadata locally");
  }
  for (const field of [
    "title",
    "icon",
    "searchPlaceholder",
    "searchLabel",
    "scopeLabel",
    "emptyMessage",
    "itemCountLabel",
    "focusIcon",
    "selectVerb",
    "selectedVerb",
    "frameVerb",
    "selectionStatusVerb",
    "framedStatusVerb",
    "frameEmptyStatus"
  ]) {
    if (!modelBrowserMetadata.MODEL_BROWSER_PANEL_SPEC?.[field]) {
      fail(errors, `model-browser-metadata panel spec must declare ${field}`);
    }
  }
  for (const icon of [modelBrowserMetadata.MODEL_BROWSER_PANEL_SPEC?.icon, modelBrowserMetadata.MODEL_BROWSER_PANEL_SPEC?.focusIcon].filter(Boolean)) {
    if (!iconNames.has(icon)) fail(errors, `model-browser-metadata references unknown icon: ${icon}`);
  }
  if (
    modelBrowserMetadata.MODEL_BROWSER_DEFAULT_VISIBILITY !== "primary"
    || modelBrowser.MODEL_BROWSER_DEFAULT_VISIBILITY !== modelBrowserMetadata.MODEL_BROWSER_DEFAULT_VISIBILITY
    || modelBrowser.modelBrowserVisibilityFilter?.("primary") !== modelBrowserMetadata.modelBrowserVisibilityFilter?.("primary")
    || modelBrowserMetadata.modelBrowserVisibilityFilter?.("primary") !== "primary"
    || modelBrowserMetadata.modelBrowserVisibilityFilter?.("unknown") !== "primary"
    || JSON.stringify(modelBrowserMetadata.modelBrowserVisibilityFilter?.("advanced")) !== JSON.stringify(["primary", "advanced"])
  ) {
    fail(errors, "Model Browser must default to primary collections and expose an Advanced mode for primary plus advanced metadata collections");
  }
  const modelBrowserModeIds = (modelBrowserMetadata.MODEL_BROWSER_VISIBILITY_MODES || []).map((mode) => mode.id);
  if (JSON.stringify(modelBrowserModeIds) !== JSON.stringify(["primary", "advanced"])) {
    fail(errors, `Model Browser visibility modes must stay compact and ordered as Primary/Advanced, got ${JSON.stringify(modelBrowserModeIds)}`);
  }
  if (JSON.stringify((modelBrowser.MODEL_BROWSER_VISIBILITY_MODES || []).map((mode) => mode.id)) !== JSON.stringify(modelBrowserModeIds)) {
    fail(errors, "Model Browser must re-export visibility modes from model-browser-metadata for stable callers");
  }
  for (const mode of modelBrowserMetadata.MODEL_BROWSER_VISIBILITY_MODES || []) {
    if (!mode.id || !mode.label || !mode.title) fail(errors, `model-browser-metadata visibility mode must declare id, label, and title: ${JSON.stringify(mode)}`);
  }
  if (
    modelBrowserMetadata.modelBrowserSelectLabel?.("demo", { active: true }) !== "Selected demo"
    || modelBrowserMetadata.modelBrowserSelectLabel?.("demo") !== "Select demo"
    || modelBrowserMetadata.modelBrowserFrameLabel?.("demo") !== "Frame demo"
    || modelBrowserMetadata.modelBrowserSelectionStatus?.("demo") !== "Selected demo."
    || modelBrowserMetadata.modelBrowserFramedStatus?.("demo") !== "Framed demo."
    || modelBrowserMetadata.MODEL_BROWSER_PANEL_SPEC?.frameEmptyStatus !== "Nothing visible to frame."
    || modelBrowserMetadata.modelBrowserModeForCollectionVisibility?.("advanced") !== "advanced"
    || modelBrowserMetadata.modelBrowserModeForCollectionVisibility?.("primary") !== modelBrowserMetadata.MODEL_BROWSER_DEFAULT_VISIBILITY
    || modelBrowserMetadata.modelBrowserModeForCollectionVisibility?.("unknown") !== modelBrowserMetadata.MODEL_BROWSER_DEFAULT_VISIBILITY
  ) {
    fail(errors, "model-browser-metadata row label/status helpers must provide Model Browser action copy and collection visibility mode mapping");
  }
  const primaryBrowserCollections = modelCollectionMetadata.groupedModelCollections?.({ browserVisibility: modelBrowserMetadata.modelBrowserVisibilityFilter("primary") })
    .flatMap((group) => group.collections.map((collection) => collection.id)) || [];
  const advancedBrowserCollections = modelCollectionMetadata.groupedModelCollections?.({ browserVisibility: modelBrowserMetadata.modelBrowserVisibilityFilter("advanced") })
    .flatMap((group) => group.collections.map((collection) => collection.id)) || [];
  for (const advancedOnlyCollection of ["interfaces"]) {
    if (primaryBrowserCollections.includes(advancedOnlyCollection)) {
      fail(errors, `Model Browser primary mode must not include advanced collection ${advancedOnlyCollection}`);
    }
    if (!advancedBrowserCollections.includes(advancedOnlyCollection)) {
      fail(errors, `Model Browser advanced mode must include advanced collection ${advancedOnlyCollection}`);
    }
  }
  for (const primaryConnectionCollection of ["smartComponentInstances", "welds", "fastenerGroups", "holePatterns", "connectionZones"]) {
    if (!primaryBrowserCollections.includes(primaryConnectionCollection)) {
      fail(errors, `Model Browser primary mode must include connection collection ${primaryConnectionCollection}`);
    }
  }
  if (!advancedBrowserCollections.includes("members")) {
    fail(errors, "Model Browser advanced mode must keep primary editable collections visible");
  }
  if (
    !modelBrowserText.includes("segmentedControl")
    || !modelBrowserText.includes("showCollection(collectionId)")
    || !modelBrowserText.includes("modelCollectionBrowserVisibility(id)")
    || !modelBrowserText.includes('datasetKey: "modelBrowserSearch"')
    || !modelBrowserText.includes("dataset.modelBrowserScope")
    || !modelBrowserText.includes("dataset.modelBrowserVisibility")
    || !modelBrowserText.includes("modelBrowserId: item.id")
    || !modelBrowserText.includes("collection: item.collection")
    || !modelBrowserText.includes("focusScope")
    || !modelBrowserText.includes("groupedModelCollections({ browserVisibility: visibilityFilter })")
    || !modelBrowserText.includes("modelBrowserItems(state.project, visibilityFilter)")
  ) {
    fail(errors, "Model Browser must render a data-panel scope control, expose collection jumps, and apply selected metadata visibility to groups and items");
  }
  if (!projectDataPanelText.includes("model-collection-metadata.mjs") || projectDataPanelText.includes("MODEL_COUNT_SPECS")) {
    fail(errors, "Project Data panel must derive model collection counts from model-collection-metadata");
  }
  if (
    !projectFilesPanelText.includes("PROJECT_FILES_PANEL_SPEC")
    || !projectFilesPanelText.includes("data-surface-metadata.mjs")
    || !projectFilesPanelText.includes("dataSourceDescriptor")
    || !projectFilesPanelText.includes("dataLibraryDescriptor")
    || !projectFilesPanelText.includes("sortDataLibraryEntries")
    || !projectFilesPanelText.includes('datasetKey: "projectFilesSearch"')
    || !projectFilesPanelText.includes("projectFilesRowDataset")
    || !projectFilesPanelText.includes("projectFilesKeywords")
    || !projectFilesPanelText.includes("descriptor.searchText")
    || !projectFilesPanelText.includes("resolvedHref(")
    || !projectFilesPanelText.includes("dataPanelLinkRow")
    || !projectFilesPanelText.includes("showRow(rowId")
    || !projectFilesPanelText.includes("rowMatchesQuery(")
  ) {
    fail(errors, "Project Files panel must own searchable source/config file rows through shared data-surface descriptors and safe data-panel links");
  }
  if (
    projectDataPanelText.includes("dataSourceDescriptor")
    || projectDataPanelText.includes("dataPanelLinkRow")
    || projectDataPanelText.includes("resolvedHref(")
    || projectDataPanelText.includes("sourceRows(")
  ) {
    fail(errors, "Project Data panel must not own source-file rows now that Files is a dedicated Data Dock tab");
  }
  if (
    !projectDataPanelText.includes("state = {")
    || !projectDataPanelText.includes("query: \"\"")
    || !projectDataPanelText.includes("renderSearch()")
    || !projectDataPanelText.includes('datasetKey: "projectDataSearch"')
    || !projectDataPanelText.includes("projectDataRowDataset")
    || !projectDataPanelText.includes("focusSearch")
    || !projectDataPanelText.includes("filterSections(")
    || !projectDataPanelText.includes("rowMatchesQuery(")
    || !projectDataPanelText.includes("project-data-metadata.mjs")
    || !projectDataPanelText.includes("PROJECT_DATA_PANEL_SPEC")
    || !projectDataPanelText.includes("PROJECT_DATA_SETTING_ROW_SPECS")
    || !projectDataPanelText.includes("projectDataSectionLabel")
    || !projectDataPanelText.includes("projectDataRowActionSpec")
    || !projectDataPanelText.includes("projectDataActionTitle")
  ) {
    fail(errors, "Project Data panel must expose a design-system search control and derive panel copy, sections, actions, and settings rows from project-data-metadata");
  }
  if (
    !projectDataPanelText.includes("projectLibraryEntries(project)")
    || !projectDataPanelText.includes("data-surface-metadata.mjs")
    || !projectDataPanelText.includes("DATA_LIBRARY_DEFAULT_IDS")
    || !projectDataPanelText.includes("dataLibraryFallbackSpec")
    || !projectDataPanelText.includes("dataLibraryDescriptor")
    || !projectDataPanelText.includes("sortDataLibraryEntries")
    || projectDataPanelText.includes("const LIBRARY_SPECS")
  ) {
    fail(errors, "Project Data panel must derive library rows from shared data-surface metadata instead of local library constants");
  }
  if (
    !leftDockResultMetadataText.includes("dataLibraryDescriptor")
    || !leftDockResultMetadataText.includes("dataSourceDescriptor")
    || leftDockResultMetadataText.includes("function displayPath(")
  ) {
    fail(errors, "left-dock-result-metadata must reuse shared data-surface provenance descriptors for Data search results");
  }
  if (
    !projectDataPanelText.includes("onRowAction")
    || !projectDataPanelText.includes("projectDataActionDataset")
    || !uiElementsText.includes('anchor.target = "_blank"')
    || !uiElementsText.includes('anchor.rel = "noopener noreferrer"')
    || !projectDataPanelText.includes("actionRow(")
    || !projectFilesPanelText.includes("dataPanelLinkRow")
    || !uiElementsText.includes("applyTooltip(anchor")
  ) {
    fail(errors, "Project Data and Files panels must expose navigable row intents, safe source links, and shared tooltip behavior");
  }
  if (!panelsAndControlsText.includes(".bc-data-segment")) {
    fail(errors, "Design-system panels-and-controls CSS must own data-panel segmented controls");
  }
  for (const token of ['.bc-data-row[data-state]', '.bc-data-row[data-state="error"]', '.bc-data-row[data-state="pick"]', '.bc-data-row[data-state="created"]']) {
    if (!panelsAndControlsText.includes(token)) {
      fail(errors, `Design-system panels-and-controls CSS must own generic left-dock data-row state styling: ${token}`);
    }
  }
  for (const token of [".bc-field.disabled", "[data-disabled=\"true\"]", "[data-read-only=\"true\"]", ".bc-field-help", ".bc-field-validation", ".bc-generated-action-field", "[data-state=\"warning\"]", "[data-state=\"error\"]"]) {
    if (!panelsAndControlsText.includes(token)) {
      fail(errors, `Design-system panels-and-controls CSS must own generated field state styling: ${token}`);
    }
  }
  if (
    !uiElementsText.includes('details.dataset.state = details.open ? "open" : "closed"')
    || generatedPanelElementsText.includes("chevron.style")
    || uiElementsText.includes("chevron.style")
    || !panelsAndControlsText.includes('.bc-disclosure[data-state="open"] > .bc-disclosure-summary .bc-disclosure-chevron')
    || !panelsAndControlsText.includes("transform: rotate(90deg)")
    || !panelsAndControlsText.includes("color: var(--bc-color-accent-strong)")
  ) {
    fail(errors, "Shared disclosure chevron state must be CSS-driven from data-state instead of inline panel primitive styles");
  }
  if (
    !smartComponentBrowserText.includes("bc-data-panel")
    || !smartComponentBrowserText.includes("api.smartComponentPresets")
    || !smartComponentBrowserText.includes("api.createSmartComponentFromPreset")
    || !smartComponentBrowserText.includes('datasetKey: "smartComponentSearch"')
    || !smartComponentBrowserText.includes("smartComponentPresetId: item.id")
    || !smartComponentBrowserText.includes("active: item.id === state.selectedPresetId")
    || !smartComponentBrowserText.includes("smart-component-browser-metadata.mjs")
    || !smartComponentBrowserText.includes("SMART_COMPONENT_BROWSER_PANEL_SPEC")
    || !smartComponentBrowserText.includes("smartComponentKindIcon")
    || !smartComponentBrowserText.includes("smartComponentKindLabel")
    || !smartComponentBrowserText.includes("smartComponentPresetActionSpec")
    || !smartComponentBrowserText.includes("smartComponentPresetActionLabel")
    || !smartComponentBrowserText.includes("smartComponentStatusIcon")
    || smartComponentBrowserMetadata.SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC?.layout !== "tiles"
    || !smartComponentBrowserText.includes('spec.layout === "tiles"')
    || !smartComponentBrowserText.includes("renderPresetTile")
    || !smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile")
    || !smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-icon")
    || !smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-preview")
    || !smartComponentBrowserText.includes("smartComponentPresetArtworkUrl")
    || !smartComponentBrowserText.includes("CONNECTION_ARTWORK_BY_VARIANT")
    || !smartComponentBrowserText.includes("./assets/connection-artwork/")
    || smartComponentBrowserText.includes("data:image/svg+xml")
    || smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-action")
    || smartComponentBrowserText.includes("bc-smart-component-browser-preset-tile-value")
    || !smartComponentBrowserText.includes("includeThumbnail: spec.showPreviewImages !== false")
    || !smartComponentBrowserCssText.includes(".bc-smart-component-browser-preset-tile")
    || !smartComponentBrowserCssText.includes('grid-template-columns: repeat(auto-fit, minmax(138px, 1fr))')
    || !smartComponentBrowserCssText.includes(".bc-smart-component-browser-preset-tile-icon")
    || !smartComponentBrowserCssText.includes(".bc-smart-component-browser-preset-tile-preview")
    || smartComponentBrowserCssText.includes(".bc-smart-component-browser-preset-tile-action")
    || smartComponentBrowserCssText.includes(".bc-smart-component-browser-preset-tile-value")
    || smartComponentBrowserMetadata.SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC?.showPreviewImages !== false
    || smartComponentBrowserMetadata.SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC?.previewArtworkMode !== "generated"
    || !viewerStyleText.includes('./smart-component-browser.css')
    || smartComponentBrowserText.includes("function kindIcon")
    || smartComponentBrowserText.includes("function actionLabel")
    || smartComponentBrowserText.includes("function actionIcon")
    || smartComponentBrowserText.includes("function statusIcon")
  ) {
    fail(errors, "Smart Component browser must be a viewer-owned bc-data-panel surface over public Smart Component APIs");
  }
  for (const assetName of connectionArtworkAssets) {
    if (!fs.existsSync(path.join(ROOT, "bobercad/app/ui/viewer/assets/connection-artwork", assetName))) {
      fail(errors, `Smart Component browser generated bitmap artwork asset is missing: ${assetName}`);
    }
  }
}

module.exports = { checkGeneratedPanelContracts };
