const fs = require("fs");
const path = require("path");

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

function readUiContractTextFixtures(context = {}) {
  const {
    generatedPropertiesPanelPath,
    generatedPropertyBindingsPath,
    inspectorPropertyMetadataPath,
    leftDockResultMetadataPath
  } = context;
  const generatedPropertiesText = fs.readFileSync(generatedPropertiesPanelPath, "utf8");
  const generatedPanelElementsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/panel-elements.mjs"), "utf8");
  const generatedPropertyBindingsText = fs.readFileSync(generatedPropertyBindingsPath, "utf8");
  const inspectorPropertyMetadataText = fs.readFileSync(inspectorPropertyMetadataPath, "utf8");
  const panelsAndControlsCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/panels-and-controls.css"), "utf8");
  const uiElementsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/ui-elements.mjs"), "utf8");
  const modelBrowserText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/model-browser.mjs"), "utf8");
  const leftDockResultMetadataText = fs.readFileSync(leftDockResultMetadataPath, "utf8");
  const projectFilesPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/project-files-panel.mjs"), "utf8");
  const projectDataPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/project-data-panel.mjs"), "utf8");
  const panelsAndControlsText = panelsAndControlsCssText;
  const smartComponentBrowserText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/smart-component-browser.mjs"), "utf8");
  const commandPaletteText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/command-palette.mjs"), "utf8");
  const commandPaletteCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/command-palette.css"), "utf8");
  const commandRegistryText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/commands/command-registry.mjs"), "utf8");
  const inspectorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-panel.mjs"), "utf8");
  const inspectorPropertyBindingsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs"), "utf8");
  const inspectorEditableObjectPropertyMetadataText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/commands/inspector-editable-object-property-metadata.mjs"), "utf8");
  const featureEditorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/feature-editor-panel.mjs"), "utf8");
  const trimJointEditorPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/trim-joint-editor-panel.mjs"), "utf8");
  const memberTransformPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/member-transform-panel.mjs"), "utf8");
  const memberTransformPanelCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/member-transform-panel.css"), "utf8");
  const viewerEditorPanelsText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-editor-panels.css"), "utf8");
  const inspectorDockText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/inspector-dock.mjs"), "utf8");
  const inspectorDockCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/inspector-dock.css"), "utf8");
  const designTokensText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/design-system/tokens.css"), "utf8");
  const workspaceShellText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/workspace-shell.css"), "utf8");
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
  return {
    generatedPropertiesText,
    generatedPanelElementsText,
    generatedPropertyBindingsText,
    inspectorPropertyMetadataText,
    panelsAndControlsCssText,
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
    viewerCommandRegistrationText,
    viewerWorkspaceBindingsText,
    viewerRuntimeIntegrationText,
    viewerAppControllerText
  };
}

module.exports = {
  ROOT,
  fail,
  parseModelCollections,
  readJson,
  stripCssComments,
  lineNumberAt,
  readUiContractTextFixtures
};
