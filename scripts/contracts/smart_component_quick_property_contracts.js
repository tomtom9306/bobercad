const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

async function checkSmartComponentQuickProperties(errors) {
  const parameterValuesPath = path.join(ROOT, "bobercad/app/engine/api/model/smart-component-parameter-values.mjs");
  const parameterValues = await import(pathToFileURL(parameterValuesPath).href);
  const generatedPropertyBindings = await import(pathToFileURL(path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-property-bindings.mjs")).href);
  const parameterValuesText = fs.readFileSync(parameterValuesPath, "utf8");
  const quickPaths = (definition) => parameterValues.uiQuickParameterEntries(definition, firstPresetParameters(definition)).map((entry) => entry.path);
  const momentEndPlate = readJson("bobercad/data/libraries/smart-components/components/connections/moment-end-plate/config.json");
  const expectedMoment = ["plate.thickness", "plate.width", "plate.height", "bolts.rows", "bolts.columns", "bolts.pitch"];
  if (!momentEndPlate.parameters?.["plate.offset"]) {
    fail(errors, "Smart Component quick properties sentinel changed: moment-end-plate must keep plate.offset as a raw parameter");
  }
  if (JSON.stringify(momentEndPlate.ui || {}).includes("plate.offset")) {
    fail(errors, "Smart Component quick properties sentinel changed: moment-end-plate plate.offset must stay out of ui.tabs");
  }
  const momentPaths = quickPaths(momentEndPlate);
  if (JSON.stringify(momentPaths) !== JSON.stringify(expectedMoment)) {
    fail(errors, `Smart Component quick properties should follow ui.tabs order and skip hidden/read-only fields for moment-end-plate, got ${JSON.stringify(momentPaths)}`);
  }
  if (typeof parameterValues.parameterFieldDescriptor !== "function") {
    fail(errors, "Smart Component parameter values must export parameterFieldDescriptor for generated UI surfaces");
  } else {
    const field = parameterValues.parameterFieldDescriptor(momentEndPlate, firstPresetParameters(momentEndPlate), "plate.thickness", { onChange: () => {} });
    if (field?.type !== "number" || field.parameterPath !== "plate.thickness" || !String(field.label || "").includes("mm")) {
      fail(errors, `Smart Component parameterFieldDescriptor should produce generated numeric fields with parameter identity, got ${JSON.stringify(field)}`);
    }
    const integerField = parameterValues.parameterFieldDescriptor(momentEndPlate, firstPresetParameters(momentEndPlate), "bolts.rows", { onChange: () => {} });
    if (integerField?.options?.integer !== true) {
      fail(errors, `Smart Component parameterFieldDescriptor should preserve positiveInteger validation metadata, got ${JSON.stringify(integerField)}`);
    }
    const commitField = parameterValues.parameterFieldDescriptor(momentEndPlate, firstPresetParameters(momentEndPlate), "plate.thickness", {
      commit: { action: "smartComponent.parameter.set", smartComponentId: "component-a" }
    });
    if (
      commitField?.type !== "number"
      || commitField?.commit?.action !== "smartComponent.parameter.set"
      || commitField?.commit?.smartComponentId !== "component-a"
      || commitField?.commit?.parameterPath !== "plate.thickness"
      || typeof commitField?.onChange === "function"
      || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(commitField)
    ) {
      fail(errors, `Smart Component parameterFieldDescriptor should produce serializable commit descriptors, got ${JSON.stringify(commitField)}`);
    }
    const boundCommitField = generatedPropertyBindings.bindGeneratedPropertyField?.(commitField, {
      commits: { "smartComponent.parameter.set": () => "parameter" }
    });
    if (typeof boundCommitField?.onChange !== "function") {
      fail(errors, `Generated Properties binding adapter must bind Smart Component parameter commit descriptors, got ${JSON.stringify(boundCommitField)}`);
    }
    const standardField = parameterValues.parameterFieldDescriptor({
      parameters: {
        "bolts.fastenerRef": { kind: "catalogRef", label: "Bolt", catalog: "fasteners" },
        "bolts.length": {
          kind: "positiveNumber",
          label: "Length",
          unit: "mm",
          standardOptions: { kind: "fastenerLengths", fastenerRef: "bolts.fastenerRef" }
        }
      }
    }, { bolts: { fastenerRef: "M16", length: 60 } }, "bolts.length", {
      api: { catalogEntries: (name) => name === "fasteners" ? { M16: { id: "M16", lengths: [40, 60, 80] } } : {} },
      onChange: () => {}
    });
    if (standardField?.type !== "numberChoice" || standardField.options?.map((option) => option.id).join(",") !== "40,60,80" || standardField.numberOptions?.minExclusive !== true) {
      fail(errors, `Smart Component parameterFieldDescriptor should expose standard fastener lengths as generated numberChoice fields, got ${JSON.stringify(standardField)}`);
    }
    const customStandardField = parameterValues.parameterFieldDescriptor({
      parameters: {
        "bolts.fastenerRef": { kind: "catalogRef", label: "Bolt", catalog: "fasteners" },
        "bolts.length": {
          kind: "positiveNumber",
          label: "Length",
          unit: "mm",
          standardOptions: { kind: "fastenerLengths", fastenerRef: "bolts.fastenerRef" }
        }
      }
    }, { bolts: { fastenerRef: "M16", length: 65 } }, "bolts.length", {
      api: { catalogEntries: (name) => name === "fasteners" ? { M16: { id: "M16", lengths: [40, 60, 80] } } : {} },
      onChange: () => {}
    });
    if (customStandardField?.custom !== true) {
      fail(errors, `Smart Component parameterFieldDescriptor should mark non-catalog standard option values as custom, got ${JSON.stringify(customStandardField)}`);
    }
    const customActionField = parameterValues.parameterFieldDescriptor({
      parameters: {
        "bolts.fastenerRef": { kind: "catalogRef", label: "Bolt", catalog: "fasteners" },
        "bolts.length": {
          kind: "positiveNumber",
          label: "Length",
          unit: "mm",
          standardOptions: { kind: "fastenerLengths", fastenerRef: "bolts.fastenerRef" }
        }
      }
    }, { bolts: { fastenerRef: "M16", length: 60 } }, "bolts.length", {
      api: { catalogEntries: (name) => name === "fasteners" ? { M16: { id: "M16", lengths: [40, 60, 80] } } : {} },
      commit: { action: "smartComponent.parameter.set", smartComponentId: "component-a" },
      customAction: { action: "smartComponent.parameter.customNumber" }
    });
    let customActionRan = false;
    const boundCustomActionField = generatedPropertyBindings.bindGeneratedPropertyField?.(customActionField, {
      commits: { "smartComponent.parameter.set": () => "parameter" },
      actions: {
        "smartComponent.parameter.customNumber": (action) => {
          customActionRan = action?.sourcePath === "bolts.length" && action?.parameterKind === "positiveNumber";
        }
      }
    });
    boundCustomActionField?.onCustom?.();
    if (
      customActionField?.customAction?.action !== "smartComponent.parameter.customNumber"
      || customActionField?.customAction?.sourcePath !== "bolts.length"
      || typeof customActionField?.onCustom === "function"
      || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(customActionField)
      || typeof boundCustomActionField?.onCustom !== "function"
      || !customActionRan
    ) {
      fail(errors, `Generated Properties binding adapter must bind Smart Component custom-number actions without raw descriptor callbacks, got ${JSON.stringify({ customActionField, hasOnCustom: typeof boundCustomActionField?.onCustom })}`);
    }
  }

  const stairSystem = readJson("bobercad/data/libraries/smart-components/components/stairs/stair-system/config.json");
  const routeItem = stairSystem.ui?.tabs?.find((tab) => tab.id === "route")?.items?.[0];
  const geometryItems = stairSystem.ui?.tabs?.find((tab) => tab.id === "geometry")?.items || [];
  const expectedStairPrefix = [
    "levels.ffl1",
    "levels.ffl2",
    "levels.slab1ToFfl1",
    "levels.slab2ToFfl2",
    "geometry.maxStepHeight",
    "geometry.going"
  ];
  if (routeItem?.kind !== "stairRouteModules" || routeItem.path !== "route.modules") {
    fail(errors, "Smart Component quick properties sentinel changed: stair-system route tab must start with stairRouteModules route.modules");
  }
  if (geometryItems[0] !== "levels.ffl1") {
    fail(errors, "Smart Component quick properties sentinel changed: stair-system geometry tab must start with levels.ffl1");
  }
  const stairPaths = quickPaths(stairSystem);
  if (stairPaths.includes("route.modules") || JSON.stringify(stairPaths) !== JSON.stringify(expectedStairPrefix)) {
    fail(errors, `Smart Component quick properties should skip UI-only/object route editor and continue in ui.tabs order for stair-system, got ${JSON.stringify(stairPaths)}`);
  }

  const inspectorText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-panel.mjs"), "utf8");
  const smartComponentPropertiesText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/contributions/smart-component-properties.mjs"), "utf8");
  if (!inspectorText.includes("contributions/smart-component-properties.mjs") || inspectorText.includes("uiQuickParameterEntries(definition") || inspectorText.includes("parameterFieldDescriptor(definition")) {
    fail(errors, "Smart Component quick properties: Inspector must delegate quick field assembly to the Smart Component properties contribution");
  }
  if (!smartComponentPropertiesText.includes("uiQuickParameterEntries(definition") || !smartComponentPropertiesText.includes("parameterFieldDescriptor(definition")) {
    fail(errors, "Smart Component quick properties contribution must generate fields from definition.ui order through parameterFieldDescriptor");
  }
  if (!parameterValuesText.includes("parameterValue(definition") || !parameterValuesText.includes("spec.writePath || path") || !parameterValuesText.includes("conditionMatches(spec.editableWhen")) {
    fail(errors, "Smart Component parameterFieldDescriptor must resolve values, honor writePath, and share editableWhen behavior");
  }
  if (!parameterValuesText.includes('type: "numberList"')) {
    fail(errors, "Smart Component parameterFieldDescriptor must expose editable numberList descriptors");
  }
  if (!parameterValuesText.includes('type: "numberChoice"') || !parameterValuesText.includes("function standardNumberOptions") || !parameterValuesText.includes("options.integer = true")) {
    fail(errors, "Smart Component parameterFieldDescriptor must expose catalog-backed standard numeric choices with validation metadata");
  }
  if (!parameterValuesText.includes("help: parameterHelpText(spec)") || !parameterValuesText.includes("readOnly: !editable || !commitTarget")) {
    fail(errors, "Smart Component parameterFieldDescriptor must preserve help/readOnly metadata for generated fields");
  }
  if (!parameterValuesText.includes("customAction = null") || !parameterValuesText.includes("function parameterCustomNumberBinding")) {
    fail(errors, "Smart Component parameterFieldDescriptor must expose custom standard-number selection as a serializable generated action descriptor");
  }
  const generatedPropertiesText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-properties-panel.mjs"), "utf8");
  const panelElementsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/panel-elements.mjs"), "utf8");
  if (
    !generatedPropertiesText.includes('field.type === "numberList"')
    || !generatedPropertiesText.includes("numberListControl")
    || !panelElementsText.includes("export function numberListControl")
    || !panelElementsText.includes("function parseNumberList")
    || !panelElementsText.includes("options.itemMinimum")
    || !panelElementsText.includes('row.className = "bc-field bc-number-list-field"')
  ) {
    fail(errors, "Generated Properties must render and validate numberList descriptors");
  }
  if (
    !generatedPropertiesText.includes('field.type === "numberChoice"')
    || !generatedPropertiesText.includes("numberChoiceControl")
    || !panelElementsText.includes("export function numberChoiceControl")
    || !panelElementsText.includes("CUSTOM_NUMBER_CHOICE")
    || !panelElementsText.includes('row.className = "bc-field bc-number-choice-field"')
  ) {
    fail(errors, "Generated Properties must render catalog-backed standard numeric choices with a custom value path");
  }
  if (!panelElementsText.includes("options.integer") || !panelElementsText.includes("options.max") || !panelElementsText.includes("numericStepMatches")) {
    fail(errors, "Panel numeric controls must validate integer, max, and step metadata from generated descriptors");
  }
  if (!generatedPropertiesText.includes("export function generatedPropertyField")) {
    fail(errors, "Generated Properties must expose a single-field renderer for generated Smart Component parameter rows");
  }
  const smartComponentParameterUiText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/smart-component-parameter-ui.mjs"), "utf8");
  if (
    !smartComponentParameterUiText.includes("parameterFieldDescriptor(definition")
    || !smartComponentParameterUiText.includes("bindGeneratedPropertyField")
    || !smartComponentParameterUiText.includes("function bindParameterDescriptor")
    || !smartComponentParameterUiText.includes('commit: { action: "smartComponent.parameter.set" }')
    || !smartComponentParameterUiText.includes('customAction: { action: "smartComponent.parameter.customNumber" }')
    || !smartComponentParameterUiText.includes("generatedPropertyField(bindParameterDescriptor")
  ) {
    fail(errors, "Smart Component parameter panel must render ordinary parameter rows through generated property descriptors and hydrate serializable commit/action intents at the panel edge");
  }
  if (
    !smartComponentParameterUiText.includes("function smartComponentPlateFieldDescriptor")
    || !smartComponentParameterUiText.includes("function smartComponentRoleFieldDescriptor")
    || !smartComponentParameterUiText.includes("bindSmartComponentToggleDescriptor")
    || !smartComponentParameterUiText.includes("renderSmartComponentToggle")
    || !smartComponentParameterUiText.includes('"smartComponent.plateIncluded.set"')
    || !smartComponentParameterUiText.includes('"smartComponent.roleActive.set"')
    || !smartComponentParameterUiText.includes("updatePlateIncluded(commit.plateId, included)")
    || !smartComponentParameterUiText.includes("updateComponentActive(commit.role, active)")
    || !smartComponentParameterUiText.includes("disabled: Boolean(plate.required)")
    || !smartComponentParameterUiText.includes('disabledReason: plate.required ? "Required generated plate" : ""')
    || !smartComponentParameterUiText.includes("renderSmartComponentToggle(smartComponentPlateFieldDescriptor")
    || !smartComponentParameterUiText.includes("renderSmartComponentToggle(smartComponentRoleFieldDescriptor")
  ) {
    fail(errors, "Smart Component parameter panel must render generated role and plate toggles through serializable checkbox descriptors bound at the panel edge");
  }
  if (
    !smartComponentParameterUiText.includes("function routeModuleFieldDescriptor")
    || !smartComponentParameterUiText.includes("function bindRouteModuleDescriptor")
    || !smartComponentParameterUiText.includes("function renderRouteModuleField")
    || !smartComponentParameterUiText.includes('"smartComponent.routeModule.set"')
    || !smartComponentParameterUiText.includes('commit.mode === "type"')
    || !smartComponentParameterUiText.includes('commit.mode === "stepOverrideEnabled"')
    || !smartComponentParameterUiText.includes("removeKeys")
    || !smartComponentParameterUiText.includes("routeModuleNumberOptions")
    || !smartComponentParameterUiText.includes("routeModuleSelectOptions")
    || !smartComponentParameterUiText.includes("function routeModuleActionRowDescriptor")
    || !smartComponentParameterUiText.includes("function bindRouteModuleActionRowDescriptor")
    || !smartComponentParameterUiText.includes("function renderRouteModuleActionRow")
    || !smartComponentParameterUiText.includes('label: "Module type"')
    || !smartComponentParameterUiText.includes('label: "Override steps"')
    || !smartComponentParameterUiText.includes('patchKey: "radius"')
    || !smartComponentParameterUiText.includes('patchKey: "turnDirection"')
    || !smartComponentParameterUiText.includes('patchKey: "rotationDegrees"')
    || !smartComponentParameterUiText.includes('patchKey: "entryExtensionLength"')
    || !smartComponentParameterUiText.includes('patchKey: "exitExtensionLength"')
    || !smartComponentParameterUiText.includes('patchKey: "turnAcross"')
    || !smartComponentParameterUiText.includes("renderRouteModuleField(routeModuleFieldDescriptor")
    || !smartComponentParameterUiText.includes('"smartComponent.routeModule.add"')
    || !smartComponentParameterUiText.includes('"smartComponent.routeModule.remove"')
    || !smartComponentParameterUiText.includes("routeModuleAddAction(\"flight.straight\"")
    || !smartComponentParameterUiText.includes("routeModuleAddAction(\"flight.curved\"")
    || !smartComponentParameterUiText.includes("routeModuleAddAction(\"landing.straight\"")
    || !smartComponentParameterUiText.includes("routeModuleAddAction(\"landing.l\"")
    || !smartComponentParameterUiText.includes("routeModuleAddAction(\"landing.u\"")
    || !smartComponentParameterUiText.includes("routeModuleRemoveAction(index)")
    || smartComponentParameterUiText.includes("compactRouteAction")
    || smartComponentParameterUiText.includes('button("Add straight flight"')
    || smartComponentParameterUiText.includes('button("Add curved flight"')
    || smartComponentParameterUiText.includes('button("Add straight landing"')
    || smartComponentParameterUiText.includes('button("Add L landing"')
    || smartComponentParameterUiText.includes('button("Add U landing"')
  ) {
    fail(errors, "Smart Component route module scalar/select/checkbox controls and add/remove actions must render through generated descriptors bound at the panel edge");
  }
  if (
    !smartComponentParameterUiText.includes("function smartComponentDiagnosticListDescriptor")
    || !smartComponentParameterUiText.includes("function renderSmartComponentDiagnosticList")
    || !smartComponentParameterUiText.includes('type: "diagnosticList"')
    || !smartComponentParameterUiText.includes("renderSmartComponentDiagnosticList(api.smartComponent(smartComponentId))")
    || smartComponentParameterUiText.includes("function diagnosticList(instance)")
  ) {
    fail(errors, "Smart Component diagnostics in the parameter panel must render through generated diagnosticList descriptors");
  }
  if (
    !smartComponentParameterUiText.includes("function smartComponentManagedObjectListDescriptor")
    || !smartComponentParameterUiText.includes("bindSmartComponentManagedObjectListDescriptor")
    || !smartComponentParameterUiText.includes("renderSmartComponentManagedObjectList")
    || !smartComponentParameterUiText.includes('type: "objectRefList"')
    || !smartComponentParameterUiText.includes('"smartComponent.objectOverrides.reset"')
    || !smartComponentParameterUiText.includes('"smartComponent.object.detach"')
    || !smartComponentParameterUiText.includes('"smartComponent.object.reattach"')
    || !smartComponentParameterUiText.includes("renderSmartComponentManagedObjectList(api.smartComponent(smartComponentId))")
    || smartComponentParameterUiText.includes('button("Reset overrides"')
    || smartComponentParameterUiText.includes('button("Detach"')
    || smartComponentParameterUiText.includes('button("Reattach"')
  ) {
    fail(errors, "Smart Component managed object overrides in the parameter panel must render through generated objectRefList descriptors");
  }
  if (
    !smartComponentParameterUiText.includes("function smartComponentFooterActionRowDescriptor")
    || !smartComponentParameterUiText.includes("bindSmartComponentFooterActionRowDescriptor")
    || !smartComponentParameterUiText.includes("renderSmartComponentFooterActionRow")
    || !smartComponentParameterUiText.includes('"smartComponent.parameterPanel.apply"')
    || !smartComponentParameterUiText.includes('"smartComponent.parameterPanel.delete"')
    || !smartComponentParameterUiText.includes('"smartComponent.parameterPanel.resolveDiagnostics"')
    || !smartComponentParameterUiText.includes('icon: "check"')
    || !smartComponentParameterUiText.includes('icon: "cancel"')
    || !smartComponentParameterUiText.includes('icon: "reset-view"')
    || !smartComponentParameterUiText.includes("footer.replaceChildren(renderSmartComponentFooterActionRow(), message)")
    || smartComponentParameterUiText.includes('button("Modify"')
    || smartComponentParameterUiText.includes('button("Delete"')
    || smartComponentParameterUiText.includes('button("Resolve"')
  ) {
    fail(errors, "Smart Component parameter panel footer actions must render through generated actionRow descriptors");
  }
  if (
    !smartComponentParameterUiText.includes("function stairComputedGeometryReadoutListDescriptor")
    || !smartComponentParameterUiText.includes("function renderStairComputedGeometryReadoutList")
    || !smartComponentParameterUiText.includes('type: "readoutList"')
    || !smartComponentParameterUiText.includes("measurements.rise ?? measurements.stepHeight")
    || !smartComponentParameterUiText.includes("measurements.stepCount ?? measurements.calculatedStepCount")
    || !smartComponentParameterUiText.includes("measurements.flightStepDistribution || outputs.computedGeometry?.flightStepDistribution")
    || !smartComponentParameterUiText.includes("renderStairComputedGeometryReadoutList(api.smartComponent(smartComponentId))")
    || smartComponentParameterUiText.includes("function stairComputedGeometryReadouts")
  ) {
    fail(errors, "Smart Component stair computed geometry must render through generated readoutList descriptors");
  }
  if (
    !smartComponentParameterUiText.includes("disclosureSection as sharedDisclosureSection")
    || !smartComponentParameterUiText.includes("sharedDisclosureSection(item.label")
    || !smartComponentParameterUiText.includes('className: "bc-disclosure-nested"')
    || !smartComponentParameterUiText.includes('bodyClassName: "bc-parameter-section-body"')
    || smartComponentParameterUiText.includes("property-section")
    || smartComponentParameterUiText.includes("property-tab-body")
    || smartComponentParameterUiText.includes('from "../../../app/ui/icons/icon-registry.mjs')
    || smartComponentParameterUiText.includes("function disclosureSection(label")
    || smartComponentParameterUiText.includes("createIcon(\"chevron-right\"")
  ) {
    fail(errors, "Smart Component nested parameter sections must use the shared disclosure primitive and design-system bc-* section classes instead of property-section wrappers");
  }
  if (
    !smartComponentParameterUiText.includes("const readoutDescriptor = {")
    || !smartComponentParameterUiText.includes("value: readoutValue(value, spec.unit)")
    || !smartComponentParameterUiText.includes("return parameterRow(generatedPropertyField(readoutDescriptor), path, uiState)")
    || !smartComponentParameterUiText.includes('body.querySelectorAll(".bc-readout[data-path]")')
    || !smartComponentParameterUiText.includes('row.querySelector(".bc-readout-value")')
    || smartComponentParameterUiText.includes("editor-")
    || smartComponentParameterUiText.includes("readout as sharedReadout")
    || smartComponentParameterUiText.includes("function readout(")
    || smartComponentParameterUiText.includes("readout(spec.label")
    || smartComponentParameterUiText.includes(".connection-ui .property-readout")
    || smartComponentParameterUiText.includes(".connection-ui .property-label")
    || smartComponentParameterUiText.includes(".connection-ui .property-value")
    || smartComponentParameterUiText.includes(".connection-ui .property-unit")
    || smartComponentParameterUiText.includes(".property-readout[data-path]")
    || smartComponentParameterUiText.includes(".property-value, .editor-value")
  ) {
    fail(errors, "Smart Component parameter-panel fallback readouts must render through generated field descriptors and the bc-readout refresh path");
  }
  if (
    !smartComponentParameterUiText.includes("function smartComponentTabStripDescriptor")
    || !smartComponentParameterUiText.includes("const renderSmartComponentTabStrip")
    || !smartComponentParameterUiText.includes("bindSmartComponentTabStripDescriptor")
    || !smartComponentParameterUiText.includes('type: "tabList"')
    || !smartComponentParameterUiText.includes('"smartComponent.parameterPanel.tab.set"')
    || !smartComponentParameterUiText.includes("renderSmartComponentTabStrip()")
    || !smartComponentParameterUiText.includes('className: "bc-panel-tab-strip"')
    || !smartComponentParameterUiText.includes('buttonClassName: "bc-panel-tab"')
    || !smartComponentParameterUiText.includes('body.className = "bc-parameter-tab-body bc-properties-body"')
    || !smartComponentParameterUiText.includes('body.setAttribute("role", "tabpanel")')
    || !smartComponentParameterUiText.includes('body.setAttribute("aria-label", tab?.label || "Parameters")')
    || smartComponentParameterUiText.includes(".connection-ui .property-tabs")
    || smartComponentParameterUiText.includes(".connection-ui .property-tab {")
    || smartComponentParameterUiText.includes(".connection-ui .property-tab +")
    || smartComponentParameterUiText.includes(".connection-ui .property-tab.active")
    || smartComponentParameterUiText.includes(".connection-ui .diagnostic-list")
    || smartComponentParameterUiText.includes(".connection-ui .diagnostic-item")
    || smartComponentParameterUiText.includes(".connection-ui .diagnostic-title")
    || smartComponentParameterUiText.includes(".connection-ui .diagnostic-meta")
    || smartComponentParameterUiText.includes("function tabButton")
    || smartComponentParameterUiText.includes("function button(label")
    || smartComponentParameterUiText.includes("button(tab.label")
  ) {
    fail(errors, "Smart Component parameter tabs must render through generated tabList descriptors bound at the panel edge");
  }
  if (
    smartComponentParameterUiText.includes("smartComponentPlateOptions(smartComponentId).map((plate) => checkboxField")
    || smartComponentParameterUiText.includes("smartComponentRoleOptions(smartComponentId)")
      && smartComponentParameterUiText.includes(".map((component) => checkboxField")
  ) {
    fail(errors, "Smart Component role/plate toggles must not use the local checkboxField renderer now that generated checkbox descriptors own those rows");
  }
  for (const localRouteControl of ["function field({ spec", "function checkboxField", "function selectField", "card.append(selectField", "card.append(checkboxField", "card.append(field({"]) {
    if (smartComponentParameterUiText.includes(localRouteControl)) {
      fail(errors, `Smart Component route modules must not keep local scalar/select/checkbox controls: ${localRouteControl}`);
    }
  }
  if (!smartComponentParameterUiText.includes("customNumberPaths: uiState.customNumberPaths") || !smartComponentParameterUiText.includes("uiState.customNumberPaths.add(sourcePath)")) {
    fail(errors, "Smart Component parameter panel must route standard numeric choices through generated descriptors while preserving custom choice state");
  }
  if (smartComponentParameterUiText.includes("standardNumberField") || smartComponentParameterUiText.includes("skipStandardOptions: true")) {
    fail(errors, "Smart Component parameter panel must not keep a private standard-number renderer now that generated fields own that control");
  }
  if (smartComponentParameterUiText.includes("const EDITABLE_KINDS")) {
    fail(errors, "Smart Component parameter panel must not duplicate ordinary parameter editability kinds locally");
  }
}

function firstPresetParameters(definition) {
  return Object.values(definition?.presets || {}).find((preset) => preset?.parameters)?.parameters || {};
}

module.exports = { checkSmartComponentQuickProperties };
