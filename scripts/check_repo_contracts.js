const fs = require("fs");
const path = require("path");
const { fileURLToPath, pathToFileURL } = require("url");
const { validateFile, validateValue, formatError } = require("./validate_json_schema");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/README.md",
  "docs/architecture/data-model.md",
  "docs/architecture/folder-structure.md",
  "docs/workflows/codex-workflow.md",
  "scripts/check_repo.js",
  "scripts/check_repo_structure.js",
  "scripts/check_repo_contracts.js",
  "scripts/generate_stair_samples.mjs",
  "scripts/validate_json_schema.js",
  "scripts/check_viewer_runtime.js",

  "bobercad/app/schemas/project.schema.json",
  "bobercad/app/schemas/viewer-settings.schema.json",
  "bobercad/app/schemas/api-register.schema.json",
  "bobercad/app/schemas/material-library.schema.json",
  "bobercad/app/schemas/profile-library.schema.json",
  "bobercad/app/schemas/fastener-library.schema.json",
  "bobercad/app/schemas/frame-library.schema.json",
  "bobercad/app/schemas/smart-component.schema.json",
  "bobercad/app/schemas/smart-component-register.schema.json",
  "bobercad/app/schemas/rule-pack.schema.json",
  "bobercad/app/schemas/ui-workspace.schema.json",

  "bobercad/app/engine/api/api-register.json",
  "bobercad/app/engine/api/project/members.mjs",
  "bobercad/app/engine/api/project/objects.mjs",
  "bobercad/app/engine/api/project/plate-sketch-relations-and-bends.mjs",
  "bobercad/app/engine/api/interaction/snap-solver.mjs",
  "bobercad/app/engine/api/geometry/paths.mjs",
  "bobercad/app/engine/api/model/semantic-builders.mjs",
  "bobercad/app/engine/api/model/checks.mjs",
  "bobercad/app/engine/api/model/compliance.mjs",
  "bobercad/app/engine/api/model/connection-primitive-registry.mjs",
  "bobercad/app/engine/api/model/transport-sectioning.mjs",
  "bobercad/app/engine/api/model/solver-result.mjs",
  "bobercad/app/engine/api/model/geometry.mjs",
  "bobercad/app/engine/core/math.mjs",
  "bobercad/app/engine/core/model.mjs",
  "bobercad/app/engine/geometry/csg.mjs",
  "bobercad/app/engine/geometry/member-evaluator.mjs",
  "bobercad/app/engine/geometry/member-geometry.mjs",
  "bobercad/app/engine/geometry/polygon.mjs",
  "bobercad/app/engine/store/project-command-store.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-registry.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-runtime.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-recipe.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-parameters-and-definition.mjs",
  "bobercad/app/rendering/annotations/README.md",
  "bobercad/app/rendering/scene/scene-geometry-builder.mjs",
  "bobercad/app/rendering/scene/plate-bend-geometry.mjs",
  "bobercad/app/rendering/interaction/plate-create-controller.mjs",
  "bobercad/app/rendering/interaction/plate-bend-controller.mjs",
  "bobercad/app/rendering/interaction/sketch-create-controller.mjs",
  "bobercad/app/rendering/interaction/work-plane-controller.mjs",
  "bobercad/app/rendering/interaction/member-transform-edit-controller.mjs",
  "bobercad/app/rendering/interaction/selection-controller.mjs",
  "bobercad/app/rendering/interaction/snap-manager.mjs",
  "bobercad/app/rendering/interaction/snap-profiles.mjs",
  "bobercad/app/rendering/interaction/snap-candidate-providers.mjs",
  "bobercad/app/rendering/interaction/snap-selection-manager.mjs",
  "bobercad/app/rendering/webgl/camera.mjs",
  "bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs",

  "bobercad/app/ui/viewer/index.html",
  "bobercad/app/ui/viewer/README.md",
  "bobercad/app/ui/viewer/style.css",
  "bobercad/app/ui/viewer/viewer-settings.json",
  "bobercad/app/ui/viewer/viewer-runtime.mjs",
  "bobercad/app/ui/viewer/viewer-settings-strip.mjs",
  "bobercad/app/ui/viewer/viewer-settings-strip.css",
  "bobercad/app/ui/viewer/panels/inspector-panel.mjs",
  "bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs",
  "bobercad/app/ui/viewer/panels/generated-property-bindings.mjs",
  "bobercad/app/ui/commands/command-group-metadata.mjs",
  "bobercad/app/ui/commands/model-collection-metadata.mjs",
  "bobercad/app/ui/commands/data-surface-metadata.mjs",
  "bobercad/app/ui/commands/project-data-metadata.mjs",
  "bobercad/app/ui/commands/model-browser-metadata.mjs",
  "bobercad/app/ui/commands/smart-component-browser-metadata.mjs",
  "bobercad/app/ui/commands/left-dock-result-metadata.mjs",
  "bobercad/app/ui/commands/command-palette-metadata.mjs",
  "bobercad/app/ui/commands/data-dock-metadata.mjs",
  "bobercad/app/ui/commands/inspector-dock-metadata.mjs",
  "bobercad/app/ui/commands/inspector-property-metadata.mjs",
  "bobercad/app/ui/commands/trim-operation-metadata.mjs",
  "bobercad/app/ui/commands/command-registry.mjs",
  "bobercad/app/ui/commands/snap-metadata.mjs",
  "bobercad/app/ui/commands/settings-strip-metadata.mjs",
  "bobercad/app/ui/commands/view-metadata.mjs",
  "bobercad/app/ui/design-system/tokens.css",
  "bobercad/app/ui/design-system/theme-light.css",
  "bobercad/app/ui/design-system/theme-dark.css",
  "bobercad/app/ui/design-system/components.css",
  "bobercad/app/ui/design-system/toolbar.css",
  "bobercad/app/ui/design-system/panels-and-controls.css",
  "bobercad/app/ui/design-system/command-palette.css",
  "bobercad/app/ui/design-system/workspace-customizer.css",
  "bobercad/app/ui/design-system/ui-elements.mjs",
  "bobercad/app/ui/controls/snap-settings-control.mjs",
  "bobercad/app/ui/icons/icon-registry.mjs",
  "bobercad/app/ui/shell/command-palette.mjs",
  "bobercad/app/ui/shell/dock-tabs.mjs",
  "bobercad/app/ui/shell/dock-tabs.css",
  "bobercad/app/ui/shell/feature-navbar.mjs",
  "bobercad/app/ui/shell/feature-navbar.css",
  "bobercad/app/ui/shell/inspector-dock.mjs",
  "bobercad/app/ui/shell/inspector-dock.css",
  "bobercad/app/ui/shell/status-bar.mjs",
  "bobercad/app/ui/shell/workspace-storage.mjs",
  "bobercad/app/ui/shell/workspace-customizer-panel.mjs",
  "bobercad/app/ui/shell/workspace-shell.css",
  "bobercad/app/ui/viewer/model-browser.mjs",
  "bobercad/app/ui/viewer/project-files-panel.mjs",
  "bobercad/app/ui/viewer/project-data-panel.mjs",
  "bobercad/app/ui/viewer/smart-component-browser.mjs",
  "bobercad/app/ui/workspaces/default-workspace.json",

  "bobercad/data/projects/sample_seed_connection_structure.json",
  "bobercad/data/projects/sample_portal_frame.json",
  "bobercad/data/projects/sample_beam_to_column_fin_plate.json",
  "bobercad/data/projects/sample_connection_test_frame.json",
  "bobercad/data/projects/sample_beam_to_beam_fin_plate.json",
  "bobercad/data/projects/sample_beam_to_beam_end_plate.json",
  "bobercad/data/projects/sample_authoring_nc1_test.json",
  "bobercad/data/projects/sample_boolean_beam.json",
  "bobercad/data/projects/sample_stair_straight_basic.json",
  "bobercad/data/projects/sample_stair_straight_with_landing.json",
  "bobercad/data/projects/sample_stair_l_shape.json",
  "bobercad/data/projects/sample_stair_u_switchback.json",
  "bobercad/data/projects/sample_stair_winder.json",
  "bobercad/data/projects/sample_stair_curved.json",
  "bobercad/data/projects/sample_stair_spiral.json",
  "bobercad/data/projects/sample_stair_helical.json",
  "bobercad/data/projects/sample_stair_mono_stringer.json",
  "bobercad/data/projects/sample_stair_grating_treads.json",
  "bobercad/data/projects/sample_stair_glass_rail.json",
  "bobercad/data/projects/sample_stair_max_weight_transport_split.json",
  "bobercad/data/projects/sample_stair_manual_station_split.json",
  "bobercad/data/projects/sample_stair_compliance_failures.json",
  "bobercad/data/libraries/materials/material-register.json",
  "bobercad/data/libraries/materials/material-libraries/starter-materials/config.json",
  "bobercad/data/libraries/profiles/profile-register.json",
  "bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json",
  "bobercad/data/libraries/fasteners/fastener-register.json",
  "bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json",
  "bobercad/data/libraries/frames/frame-register.json",
  "bobercad/data/libraries/frames/frame-libraries/starter-frames/config.json",
  "bobercad/data/libraries/smart-components/smart-component-register.json",
  "bobercad/data/libraries/smart-components/member-pick-smart-component-library-ui.mjs",
  "bobercad/data/libraries/smart-components/smart-component-parameter-ui.mjs",
  "bobercad/data/libraries/smart-components/parameter-values.mjs",
  "bobercad/data/libraries/smart-components/components/connections/fin-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/moment-end-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/base-plate/config.json",
  "bobercad/data/libraries/smart-components/components/connections/apex-gusset/config.json",
  "bobercad/data/libraries/smart-components/components/frames/portal-frame/config.json",
  "bobercad/data/libraries/smart-components/components/frames/portal-frame/build.mjs",
  "bobercad/data/libraries/smart-components/components/buildings/warehouse/config.json",
  "bobercad/data/libraries/smart-components/components/buildings/warehouse/build.mjs"
];

const FORBIDDEN_ROOT_DIRS = ["viewer", "libraries", "projects", "schemas"];
const FORBIDDEN_PATHS = [
  "bobercad/app/ui/viewer/code",
  "bobercad/app/ui/viewer/panels/connection-panel.mjs",
  "bobercad/app/ui/viewer/panels/connection-creator-panel.mjs"
];
const FORBIDDEN_VIEWER_FILE_PREFIXES = ["connection-", "fastener-", "material-", "profile-"];
const PROJECT_UI_SCHEMA_VALUES = new Set(["bobercad-ui-workspace", "steel-bim-viewer-settings"]);
const PROJECT_UI_SCHEMA_SUFFIXES = ["ui-workspace.schema.json", "viewer-settings.schema.json"];
const PROJECT_UI_CONFIG_KEYS = new Set([
  "camera",
  "controls",
  "render",
  "ui",
  "workspace",
  "workspaces",
  "workspacePreferences",
  "viewerSettings",
  "toolbars",
  "panels",
  "theme",
  "density",
  "navigation",
  "bottomStrip",
  "viewerSettingsStrip",
  "viewerOverlays",
  "featureNavbar",
  "settingsStrip"
]);
const PROJECT_GENERATED_CACHE_KEYS = new Set([
  "cache",
  "renderCache",
  "rendererCache",
  "viewCache",
  "viewerCache",
  "sceneCache",
  "geometryCache",
  "meshCache",
  "cachedGeometry",
  "generatedGeometry",
  "runtimeGeometry",
  "derivedGeometry"
]);
const PROJECT_MESH_PAYLOAD_KEYS = new Set([
  "mesh",
  "meshes",
  "triangles",
  "triangleIndices",
  "faces",
  "faceIndices",
  "normals",
  "uvs",
  "buffers",
  "scene",
  "sceneGraph",
  "drawCalls"
]);

function fail(errors, message) {
  errors.push(message);
}

function parseModelCollections(text) {
  const match = String(text || "").match(/MODEL_COLLECTIONS\s*=\s*new Set\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripCssComments(text) {
  return String(text || "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

async function checkApiRegister(errors) {
  const registerPath = path.join(ROOT, "bobercad/app/engine/api/api-register.json");
  const register = readJson("bobercad/app/engine/api/api-register.json");
  for (const entry of register.apis || []) {
    if (!entry.module) continue;
    const modulePath = path.resolve(path.dirname(registerPath), entry.module);
    if (!fs.existsSync(modulePath)) {
      fail(errors, `api register module does not exist: ${entry.id} -> ${entry.module}`);
      continue;
    }
    try {
      await import(pathToFileURL(modulePath).href);
    } catch (error) {
      fail(errors, `api register module failed to import: ${entry.id} -> ${entry.module}: ${error.message}`);
    }
  }
}

function checkJsonSchemaRefs(errors) {
  for (const file of walk(path.join(ROOT, "bobercad")).filter((item) => item.endsWith(".json"))) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      fail(errors, `invalid JSON: ${path.relative(ROOT, file)}: ${error.message}`);
      continue;
    }
    const ref = data.$schema;
    if (!ref || ref.includes("://")) continue;
    const target = path.resolve(path.dirname(file), ref);
    if (!fs.existsSync(target)) fail(errors, `${path.relative(ROOT, file)}: $schema target does not exist: ${ref}`);
  }
}

function checkJsonSchemas(errors) {
  const targets = [
    ...walk(path.join(ROOT, "bobercad/data/projects")).filter((item) => item.endsWith(".json")),
    ...walk(path.join(ROOT, "bobercad/app/ui/workspaces")).filter((item) => item.endsWith(".json")),
    path.join(ROOT, "bobercad/data/libraries/smart-components/smart-component-register.json"),
    ...walk(path.join(ROOT, "bobercad/data/libraries/smart-components/components")).filter((item) => item.endsWith(`${path.sep}config.json`))
  ];
  for (const file of targets) {
    try {
      const result = validateFile(file);
      for (const error of result.errors) fail(errors, formatError(result, error));
    } catch (error) {
      fail(errors, `${path.relative(ROOT, file)}: ${error.message}`);
    }
  }
}

function checkProjectSchemaIsolation(errors) {
  const relative = "bobercad/app/schemas/project.schema.json";
  const schema = readJson(relative);
  const schemaText = fs.readFileSync(path.join(ROOT, relative), "utf8");
  for (const suffix of PROJECT_UI_SCHEMA_SUFFIXES) {
    if (schemaText.includes(suffix)) {
      fail(errors, `${relative}: project schema must not reference UI/viewer schema ${suffix}`);
    }
  }
  for (const key of ["camera", "render", "ui", "toolbars", "panels", "theme", "density"]) {
    if (Object.hasOwn(schema.properties || {}, key)) {
      fail(errors, `${relative}: project schema must not define root UI/viewer property ${key}`);
    }
  }
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
  if (JSON.stringify(toolbarDockEnum) !== JSON.stringify(["top", "left", "right", "bottom"])) {
    fail(errors, "UI workspace schema toolbarDock enum must match runtime toolbar dock options");
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
  const objectApiText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/project/objects.mjs"), "utf8");
  const objectApiCollections = parseModelCollections(objectApiText);
  const metadataCollectionIds = (modelCollectionMetadata.MODEL_COLLECTION_SPECS || []).map((spec) => spec.id);
  if (JSON.stringify(metadataCollectionIds.slice().sort()) !== JSON.stringify(objectApiCollections.slice().sort())) {
    fail(errors, `model-collection-metadata must cover object API collections, got ${JSON.stringify(metadataCollectionIds)} expected ${JSON.stringify(objectApiCollections)}`);
  }
  const metadataGroupIds = new Set((modelCollectionMetadata.MODEL_COLLECTION_GROUP_SPECS || []).map((group) => group.id));
  const browserVisibilities = new Set(["primary", "advanced", "none"]);
  for (const spec of modelCollectionMetadata.MODEL_COLLECTION_SPECS || []) {
    if (!spec.id || !spec.label || !spec.singularLabel || !spec.icon || !spec.group) {
      fail(errors, `model-collection-metadata collection must declare id, label, singularLabel, icon, and group: ${JSON.stringify(spec)}`);
    }
    if (!metadataGroupIds.has(spec.group)) fail(errors, `model-collection-metadata collection ${spec.id} references unknown group ${spec.group}`);
    if (spec.icon && !iconNames.has(spec.icon)) fail(errors, `model-collection-metadata collection ${spec.id} references unknown icon: ${spec.icon}`);
    if (!browserVisibilities.has(spec.browserVisibility)) {
      fail(errors, `model-collection-metadata collection ${spec.id} has invalid browserVisibility: ${spec.browserVisibility}`);
    }
  }
  for (const advancedCollectionId of ["interfaces", "connectionZones", "assemblies", "groups", "holePatterns", "objectPatterns", "relations"]) {
    if (modelCollectionMetadata.modelCollectionBrowserVisibility?.(advancedCollectionId) !== "advanced") {
      fail(errors, `model-collection-metadata collection ${advancedCollectionId} must be advanced for the left Model Browser`);
    }
  }
  const modelSearchDescriptor = modelCollectionMetadata.modelObjectSearchDescriptor?.("members", "beam_1", {
    type: "beam",
    profileRef: "IPE300",
    materialRef: "S355",
    fabrication: {
      partMark: "B1",
      assemblyMark: "A100",
      numberingStatus: "preliminary"
    },
    componentRef: "portal_frame_1"
  }, {
    type: "indexed-beam",
    fastenerRef: "M16_8_8"
  });
  const modelSearchKeywords = modelSearchDescriptor?.keywords || [];
  if (
    modelSearchDescriptor?.label !== "beam_1"
    || modelSearchDescriptor?.type !== "beam"
    || !modelSearchDescriptor?.description?.includes("Part: B1")
    || !modelSearchDescriptor?.description?.includes("Assembly: A100")
    || !modelSearchDescriptor?.description?.includes("Numbering: preliminary")
    || !["beam_1", "members", "Member", "beam", "B1", "A100", "preliminary", "IPE300", "S355", "M16_8_8", "portal_frame_1"].every((keyword) => modelSearchKeywords.includes(keyword))
    || !modelSearchDescriptor?.searchText?.includes("Material: S355")
    || !Object.isFrozen(modelSearchDescriptor)
  ) {
    fail(errors, `model-collection-metadata must expose a frozen semantic object search descriptor, got ${JSON.stringify(modelSearchDescriptor)}`);
  }
  for (const spec of modelCollectionMetadata.MODEL_COLLECTION_SPECS || []) {
    const entry = { collection: spec.id, type: spec.singularLabel };
    const title = inspectorPropertyMetadata.inspectorObjectTitleForEntry?.(entry);
    const icon = inspectorPropertyMetadata.inspectorObjectIconForEntry?.(entry);
    if (title !== modelCollectionMetadata.modelCollectionLabel(spec.id, { singular: true })) {
      fail(errors, `inspector-property-metadata title for ${spec.id} must derive from model-collection-metadata`);
    }
    if (icon !== modelCollectionMetadata.modelCollectionIcon(spec.id)) {
      fail(errors, `inspector-property-metadata icon for ${spec.id} must derive from model-collection-metadata`);
    }
  }
  for (const helperName of [
    "inspectorEmptySelectionContext",
    "inspectorMemberContext",
    "inspectorMemberAdvancedSections",
    "inspectorMemberEditSections",
    "inspectorMemberIdentitySection",
    "inspectorActiveToolContext",
    "inspectorActiveToolSections",
    "inspectorPrimaryActions",
    "inspectorSelectionQuickActions",
    "inspectorSmartComponentContext",
    "inspectorSmartComponentDiagnosticsSummary",
    "inspectorSmartComponentIdentitySection",
    "inspectorSmartComponentPropertySections",
    "inspectorObjectGeneratedBySection",
    "inspectorObjectContext",
    "inspectorObjectIdentitySection",
    "inspectorFeatureEditorSections",
    "inspectorObjectTitleForEntry",
    "inspectorObjectIconForEntry",
    "inspectorObjectReferenceSection",
    "inspectorIdListSection",
    "inspectorMetadataSection",
    "inspectorAssemblyContentIds",
    "inspectorFlattenSmartComponentObjectIds",
    "inspectorMetadataLabel",
    "inspectorFormatNumber",
    "inspectorFormatVector",
    "inspectorFormatKeyValues",
    "inspectorFormatPointBounds",
    "inspectorSupportObjectPropertySections",
    "normalizeInspectorPropertySections",
    "normalizeInspectorPropertySection"
  ]) {
    if (typeof inspectorPropertyMetadata[helperName] !== "function") {
      fail(errors, `inspector-property-metadata must export ${helperName}`);
    }
  }
  if (
    !Array.isArray(inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS)
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("primary")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("advanced")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("diagnostic")
    || !Array.isArray(inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS)
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS.includes("main")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS.includes("diagnostics")
  ) {
    fail(errors, "inspector-property-metadata must declare section levels and placements for generated property descriptors");
  }
  const normalizedInspectorSections = inspectorPropertyMetadata.normalizeInspectorPropertySections?.([
    { id: "primary", label: "Primary", fields: [{ label: "Name", value: "A" }] },
    { id: "advanced", label: "Advanced", open: false, fields: [{ label: "Hidden", value: "B" }] },
    { id: "diagnostics", label: "Diagnostics", fields: [{ type: "message", state: "error", value: "Broken" }] },
    { id: "raw-row-escape", label: "Raw Rows", rows: [{ label: "Raw" }] }
  ]);
  const normalizedRawRowSection = normalizedInspectorSections?.find((section) => section.id === "raw-row-escape");
  if (
    normalizedInspectorSections?.[0]?.level !== "primary"
    || normalizedInspectorSections?.[0]?.placement !== "main"
    || normalizedInspectorSections?.[0]?.priority !== 0
    || normalizedInspectorSections?.[1]?.level !== "advanced"
    || normalizedInspectorSections?.[2]?.level !== "diagnostic"
    || normalizedInspectorSections?.[2]?.placement !== "diagnostics"
    || Object.hasOwn(normalizedRawRowSection || {}, "rows")
  ) {
    fail(errors, `generated inspector sections must normalize level, placement, and priority metadata: ${JSON.stringify(normalizedInspectorSections)}`);
  }
  for (const [relative, forbidden] of [
    ["bobercad/app/ui/commands/inspector-property-metadata.mjs", ["../engine/", "../../engine/", "../rendering/", "../../rendering/", "viewer-runtime", "buildScene", "createWebglViewer"]],
    ["bobercad/app/ui/viewer/panels/generated-properties-panel.mjs", ["../engine/", "../../engine/", "../../../engine/", "../rendering/", "../../rendering/", "../../../rendering/", "api.", "buildScene", "createWebglViewer"]],
    ["bobercad/app/ui/viewer/panels/panel-elements.mjs", ["../engine/", "../../engine/", "../../../engine/", "../rendering/", "../../rendering/", "../../../rendering/", "api.", "buildScene", "createWebglViewer"]]
  ]) {
    const textContent = fs.readFileSync(path.join(ROOT, relative), "utf8");
    for (const token of forbidden) {
      if (textContent.includes(token)) fail(errors, `${relative}: generated inspector/property UI must stay descriptor-driven and not depend on engine/rendering/viewer code: ${token}`);
    }
  }
  const generatedPropertiesPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-properties-panel.mjs"), "utf8");
  if (
    !generatedPropertiesPanelText.includes("normalizeInspectorPropertySections")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionLevel")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionPlacement")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionPriority")
    || !generatedPropertiesPanelText.includes("propertiesPanelShell")
  ) {
    fail(errors, "Generated properties panel must normalize section descriptors, route through the shared panel shell, and expose level/placement/priority for progressive disclosure");
  }
  const emptyContext = inspectorPropertyMetadata.inspectorEmptySelectionContext?.();
  if (emptyContext?.title !== "No selection" || emptyContext?.icon !== "inspector") {
    fail(errors, `inspector-property-metadata empty context has unexpected shape: ${JSON.stringify(emptyContext)}`);
  }
  const memberContext = inspectorPropertyMetadata.inspectorMemberContext?.({
    memberId: "member-a",
    member: { type: "beam", material: "S355" }
  });
  if (
    memberContext?.title !== modelCollectionMetadata.modelCollectionLabel("members", { singular: true })
    || memberContext?.subtitle !== "member-a"
    || memberContext?.icon !== modelCollectionMetadata.modelCollectionIcon("members")
  ) {
    fail(errors, `inspector-property-metadata member context must derive from model-collection-metadata: ${JSON.stringify(memberContext)}`);
  }
  const activeToolContext = inspectorPropertyMetadata.inspectorActiveToolContext?.({
    command: { id: "model.beam.create", label: "Beam", title: "Create beam", description: "Create a beam from two picked points.", icon: "beam" }
  });
  const activeToolHintCommandIds = inspectorPropertyMetadata.ACTIVE_TOOL_HINT_COMMAND_IDS || [];
  const modelingCommandIds = (registry.MODELING_TOOLBAR_COMMANDS || []).map((command) => command.id);
  if (JSON.stringify(activeToolHintCommandIds) !== JSON.stringify(modelingCommandIds)) {
    fail(errors, `inspector-property-metadata active tool hints must cover modeling toolbar commands exactly: ${JSON.stringify({ activeToolHintCommandIds, modelingCommandIds })}`);
  }
  const activeToolSections = inspectorPropertyMetadata.inspectorActiveToolSections?.({
    command: { id: "model.beam.create", label: "Beam", title: "Create beam", description: "Create a beam from two picked points.", icon: "beam", keyFallback: "B" },
    commandState: { active: true, activeCommandId: "model.beam.create" },
    toolState: { status: "Beam: pick start point", canCycleSnap: true, needsPointerHit: true },
    snapSettings: { strength: "strong", scope: { members: true, selectedObjectsOnly: true, selectedObjectIds: ["member-a"] } },
    selectionState: { selectedObjectIds: ["member-a"] },
    canCancel: true,
    canCycleSnap: true,
    canOpenSnapSettings: true,
    canSnapStrengthChange: true,
    canSnapScopeChange: true,
    canSnapTargetChange: true
  });
  const activeToolSectionIds = activeToolSections?.map((section) => section.id) || [];
  const activeToolCurrent = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.current");
  const activeToolPrecision = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.precision");
  const activeToolSnapTargets = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.snapTargets");
  const activeToolCycleSnapField = activeToolCurrent?.fields?.find((field) => field.type === "action" && field.icon === "snap");
  const activeToolCancelField = activeToolCurrent?.fields?.find((field) => field.type === "action" && field.icon === "cancel");
  const activeToolStrengthField = activeToolPrecision?.fields?.find((field) => field.type === "select" && field.label === "Snap strength");
  const activeToolScopeField = activeToolPrecision?.fields?.find((field) => field.type === "select" && field.label === "Selection scope");
  const activeToolSettingsField = activeToolPrecision?.fields?.find((field) => field.type === "action" && field.label === "Open Snap Settings");
  if (
    activeToolContext?.title !== "Beam"
    || activeToolContext?.icon !== "beam"
    || activeToolContext?.badges?.[0]?.label !== "Active"
    || activeToolCurrent?.id !== "inspector.properties.activeTool.current"
    || activeToolCancelField?.action !== "activeTool.cancel"
    || activeToolCycleSnapField?.action !== "activeTool.cycleSnap"
    || !activeToolSectionIds.includes("inspector.properties.activeTool.guidance")
    || !activeToolSectionIds.includes("inspector.properties.activeTool.precision")
    || !activeToolSectionIds.includes("inspector.properties.activeTool.snapTargets")
    || activeToolStrengthField?.value !== "strong"
    || activeToolStrengthField?.commit?.action !== "snapStrength.set"
    || activeToolScopeField?.value !== "selected"
    || activeToolScopeField?.commit?.action !== "selectionScope.set"
    || activeToolSettingsField?.commandId !== "settings.snap.toggle"
    || activeToolSnapTargets?.open !== false
    || activeToolSnapTargets?.fields?.length !== (snapMetadata.SNAP_TARGET_SPECS || []).length
    || !activeToolSnapTargets?.fields?.every((field) => field.type === "checkbox" && field.commit?.action === "snapTarget.set" && field.commit?.target)
  ) {
    fail(errors, `inspector-property-metadata active tool context/sections have unexpected shape: ${JSON.stringify({ activeToolContext, activeToolSections })}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(activeToolSections)) {
    fail(errors, "inspector-property-metadata active tool sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const primaryActions = inspectorPropertyMetadata.inspectorPrimaryActions?.();
  if (
    JSON.stringify(primaryActions?.map((action) => action.label)) !== JSON.stringify(["Pick Member", "Pick Smart Component", "Pick Object", "Clear"])
    || JSON.stringify(primaryActions?.map((action) => action.action)) !== JSON.stringify(["inspector.pickMember", "inspector.pickSmartComponent", "inspector.pickObject", "selection.clear"])
    || !primaryActions?.every((action) => action.icon && action.title)
  ) {
    fail(errors, `inspector-property-metadata primary actions have unexpected descriptor shape: ${JSON.stringify(primaryActions)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(primaryActions)) {
    fail(errors, "inspector-property-metadata primary actions must expose serializable descriptors, not bound UI callbacks");
  }
  const plateQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "plate-a",
    objectDetail: { sketchMode: "relations", sketchSelection: ["edge-a"] },
    entry: { collection: "plates" },
    rootSmartComponent: { id: "component-a" }
  });
  const trimQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "trim-a",
    objectDetail: { operationId: "trim-1" },
    entry: { collection: "trimJoints" }
  });
  const featureQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "feature-a",
    entry: { collection: "features" }
  });
  if (
    JSON.stringify(plateQuickActions?.map((action) => action.label)) !== JSON.stringify(["Fit", "Component", "Relations", "Clear"])
    || plateQuickActions?.[1]?.action !== "selection.smartComponent.open"
    || plateQuickActions?.[1]?.payload?.smartComponentId !== "component-a"
    || plateQuickActions?.[2]?.action !== "selection.plateRelations.toggle"
    || plateQuickActions?.[2]?.pressed !== true
    || plateQuickActions?.[2]?.payload?.detail?.sketchMode !== "clean"
    || plateQuickActions?.[2]?.payload?.detail?.clearSketchSelection !== true
    || trimQuickActions?.[1]?.action !== "selection.trim.open"
    || trimQuickActions?.[1]?.payload?.detail?.operationId !== "trim-1"
    || featureQuickActions?.[1]?.action !== "selection.feature.open"
    || inspectorPropertyMetadata.inspectorSelectionQuickActions?.()?.length
  ) {
    fail(errors, `inspector-property-metadata selection quick actions have unexpected descriptor shape: ${JSON.stringify({ plateQuickActions, trimQuickActions, featureQuickActions })}`);
  }
  if (
    generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(plateQuickActions)
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(trimQuickActions)
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(featureQuickActions)
  ) {
    fail(errors, "inspector-property-metadata selection quick actions must expose serializable descriptors, not bound UI callbacks");
  }
  const boundActiveToolSections = generatedPropertyBindings.bindGeneratedPropertySections?.(activeToolSections, {
    runCommand: () => "command",
    actions: {
      "activeTool.cancel": () => "cancel",
      "activeTool.cycleSnap": () => "cycle"
    },
    commits: {
      "snapStrength.set": () => "strength",
      "selectionScope.set": () => "scope",
      "snapTarget.set": () => "target"
    }
  }) || [];
  const boundActiveToolCurrent = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.current");
  const boundActiveToolPrecision = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.precision");
  const boundActiveToolSnapTargets = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.snapTargets");
  if (
    typeof boundActiveToolCurrent?.fields?.find((field) => field.action === "activeTool.cancel")?.onClick !== "function"
    || typeof boundActiveToolCurrent?.fields?.find((field) => field.action === "activeTool.cycleSnap")?.onClick !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commit?.action === "snapStrength.set")?.onChange !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commit?.action === "selectionScope.set")?.onChange !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commandId === "settings.snap.toggle")?.onClick !== "function"
    || !boundActiveToolSnapTargets?.fields?.every((field) => field.commit?.action === "snapTarget.set" && typeof field.onChange === "function")
  ) {
    fail(errors, `Generated Properties binding adapter must attach active-tool handlers from serializable intents: ${JSON.stringify(boundActiveToolSections)}`);
  }
  for (const command of registry.MODELING_TOOLBAR_COMMANDS || []) {
    const sections = inspectorPropertyMetadata.inspectorActiveToolSections?.({
      command,
      commandState: { active: true, activeCommandId: command.id },
      snapSettings: { strength: "normal", scope: {} },
      canCancel: true,
      canCycleSnap: true,
      canOpenSnapSettings: true,
      canSnapStrengthChange: true,
      canSnapScopeChange: true,
      canSnapTargetChange: true
    }) || [];
    const ids = sections.map((section) => section.id);
    for (const requiredId of [
      "inspector.properties.activeTool.current",
      "inspector.properties.activeTool.guidance",
      "inspector.properties.activeTool.precision",
      "inspector.properties.activeTool.snapTargets"
    ]) {
      if (!ids.includes(requiredId)) fail(errors, `Active tool generated properties for ${command.id} must include ${requiredId}`);
    }
  }
  const unknownObjectContext = inspectorPropertyMetadata.inspectorObjectContext?.({
    objectId: "unknown-a",
    entry: { collection: "unknown" },
    object: { type: "mystery" }
  });
  if (unknownObjectContext?.title !== "Object" || unknownObjectContext?.icon !== "inspector") {
    fail(errors, `inspector-property-metadata unknown object context must use neutral fallback metadata: ${JSON.stringify(unknownObjectContext)}`);
  }
  const memberIdentity = inspectorPropertyMetadata.inspectorMemberIdentitySection?.({
    memberId: "member-a",
    member: { type: "beam", material: "S355" },
    lengthText: "1200 mm"
  });
  if (
    memberIdentity?.id !== "inspector.properties.member.identity"
    || JSON.stringify(memberIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "member-a"],
      ["Type", "beam"],
      ["Material", "S355"],
      ["Length", "1200 mm"]
    ])
  ) {
    fail(errors, `inspector-property-metadata member identity section has unexpected shape: ${JSON.stringify(memberIdentity)}`);
  }
  const memberEditSections = inspectorPropertyMetadata.inspectorMemberEditSections?.({
    memberId: "member-a",
    member: { profile: "IPE200", material: "S355", rotation: 15, start: [0, 0, 0], end: [1000, 0, 0] },
    profileOptions: [{ id: "IPE200", label: "IPE 200" }],
    materialOptions: [{ id: "S355", label: "S355 structural steel" }],
    center: [500, 0, 0],
    alignmentLabel: "Global X",
    hasAlignment: true,
    worldAxisIds: ["x", "y", "z"]
  });
  const memberEditSectionIds = memberEditSections?.map((section) => section.id) || [];
  const memberPrimarySection = memberEditSections?.find((section) => section.id === "inspector.properties.member.primary");
  const memberPositionSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.position");
  const memberEndpointSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.endpoints");
  const memberAlignmentSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.alignment");
  if (
    !memberEditSectionIds.includes("inspector.properties.member.primary")
    || !memberEditSectionIds.includes("inspector.properties.member.position")
    || !memberEditSectionIds.includes("inspector.properties.member.endpoints")
    || !memberEditSectionIds.includes("inspector.properties.member.alignment")
    || memberPrimarySection?.fields?.find((field) => field.label === "Section")?.value !== "IPE200"
    || JSON.stringify(memberPrimarySection?.fields?.find((field) => field.label === "Section")?.options?.map((option) => option.id)) !== JSON.stringify(["IPE200"])
    || memberPrimarySection?.fields?.find((field) => field.label === "Section")?.commit?.action !== "member.profile.set"
    || memberPrimarySection?.fields?.find((field) => field.label === "Material")?.value !== "S355"
    || JSON.stringify(memberPrimarySection?.fields?.find((field) => field.label === "Material")?.options?.map((option) => option.id)) !== JSON.stringify(["S355"])
    || memberPrimarySection?.fields?.find((field) => field.label === "Material")?.commit?.action !== "member.material.set"
    || memberPrimarySection?.fields?.find((field) => field.label === "Rotation")?.value !== 15
    || memberPrimarySection?.fields?.find((field) => field.label === "Rotation")?.commit?.action !== "member.rotation.set"
    || memberPositionSection?.fields?.length !== 3
    || JSON.stringify(memberPositionSection?.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([["Center X", 500], ["Center Y", 0], ["Center Z", 0]])
    || memberPositionSection?.fields?.[0]?.commit?.action !== "member.centerCoordinate.set"
    || memberEndpointSection?.fields?.length !== 6
    || memberEndpointSection?.fields?.[0]?.label !== "Start X"
    || memberEndpointSection?.fields?.[5]?.label !== "End Z"
    || memberEndpointSection?.fields?.[0]?.commit?.action !== "member.endpointCoordinate.set"
    || memberAlignmentSection?.fields?.find((field) => field.label === "Current")?.value !== "Global X"
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.setGlobalAxis" && field.payload?.axisId === "x")
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.pickAxis")
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.clear")
  ) {
    fail(errors, `inspector-property-metadata member edit sections have unexpected shape: ${JSON.stringify(memberEditSections)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(memberEditSections)) {
    fail(errors, "inspector-property-metadata member edit sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const memberAdvancedSections = inspectorPropertyMetadata.inspectorMemberAdvancedSections?.({
    memberId: "member-a",
    customProfileValue: "-50 -100\n50 -100\n50 100\n-50 100",
    pointRelations: [{ id: "relation-a", label: "P1 on Global X" }],
    alignmentLabel: "Global X"
  });
  const memberAdvancedSectionIds = memberAdvancedSections?.map((section) => section.id) || [];
  const memberCustomSection = memberAdvancedSections?.find((section) => section.id === "inspector.properties.member.customSection");
  const memberConstraintSection = memberAdvancedSections?.find((section) => section.id === "inspector.properties.member.constraints");
  if (
    !memberAdvancedSectionIds.includes("inspector.properties.member.customSection")
    || !memberAdvancedSectionIds.includes("inspector.properties.member.constraints")
    || memberCustomSection?.level !== "advanced"
    || memberConstraintSection?.level !== "advanced"
    || memberCustomSection?.fields?.find((field) => field.label === "Contour points")?.commit?.action !== "member.customProfileDraft.set"
    || memberCustomSection?.fields?.find((field) => field.label === "Contour points")?.options?.multiline !== true
    || !memberCustomSection?.fields?.some((field) => field.action === "member.customProfile.create")
    || memberConstraintSection?.fields?.find((field) => field.label === "Member alignment")?.value !== "Global X"
    || memberConstraintSection?.fields?.find((field) => field.label === "Constraint 1")?.value !== "P1 on Global X"
    || !memberConstraintSection?.fields?.some((field) => field.action === "member.relation.remove" && field.payload?.relationId === "relation-a")
  ) {
    fail(errors, `inspector-property-metadata member advanced sections have unexpected shape: ${JSON.stringify(memberAdvancedSections)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(memberAdvancedSections)) {
    fail(errors, "inspector-property-metadata member advanced sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const boundMemberEditSections = generatedPropertyBindings.bindGeneratedPropertySections?.([...(memberEditSections || []), ...(memberAdvancedSections || [])], {
    commits: {
      "member.profile.set": () => "profile",
      "member.material.set": () => "material",
      "member.rotation.set": () => "rotation",
      "member.centerCoordinate.set": () => "center",
      "member.endpointCoordinate.set": () => "endpoint",
      "member.customProfileDraft.set": () => "custom-profile-draft"
    },
    actions: {
      "member.alignment.setGlobalAxis": () => "axis",
      "member.alignment.pickAxis": () => "pick",
      "member.alignment.clear": () => "clear",
      "member.customProfile.create": () => "custom-profile-create",
      "member.relation.remove": () => "member-relation-remove"
    }
  }) || [];
  const boundMemberFields = boundMemberEditSections.flatMap((section) => section.fields || []);
  if (
    typeof boundMemberFields.find((field) => field.commit?.action === "member.profile.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.material.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.centerCoordinate.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.endpointCoordinate.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.setGlobalAxis")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.pickAxis")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.clear")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.customProfileDraft.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.customProfile.create")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.relation.remove")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach member edit handlers from serializable intents: ${JSON.stringify(boundMemberEditSections)}`);
  }
  const diagnosticsSummary = inspectorPropertyMetadata.inspectorSmartComponentDiagnosticsSummary?.({
    health: "warning",
    diagnostics: [{ severity: "error" }, { severity: "warning" }, { severity: "info" }]
  });
  if (diagnosticsSummary?.errorCount !== 1 || diagnosticsSummary?.warningCount !== 1 || diagnosticsSummary?.diagnostics?.length !== 3) {
    fail(errors, `inspector-property-metadata Smart Component diagnostics summary has unexpected shape: ${JSON.stringify(diagnosticsSummary)}`);
  }
  const smartComponentIdentity = inspectorPropertyMetadata.inspectorSmartComponentIdentitySection?.({
    smartComponentId: "component-a",
    smartComponent: { type: "fin-plate", kind: "connection" },
    diagnosticsSummary,
    managedObjectCount: 4,
    detachedObjectCount: 1,
    overrideObjectCount: 2
  });
  if (
    smartComponentIdentity?.id !== "inspector.properties.smartComponent.identity"
    || JSON.stringify(smartComponentIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "component-a"],
      ["Type", "fin-plate"],
      ["Kind", "connection"],
      ["Diagnostics", "1 errors, 1 warnings"],
      ["Managed objects", "4"],
      ["Detached", "1"],
      ["Overrides", "2"]
    ])
  ) {
    fail(errors, `inspector-property-metadata Smart Component identity section has unexpected shape: ${JSON.stringify(smartComponentIdentity)}`);
  }
  const smartComponentPropertySections = inspectorPropertyMetadata.inspectorSmartComponentPropertySections?.({
    smartComponentId: "component-a",
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      diagnostics: [{ severity: "warning", message: "Missing optional stiffener." }],
      objectRoles: { plate: "object_a", optional: "object_b", nested: ["object_c", { child: "object_d" }] },
      detachedObjectIds: ["object_b", "object_d"],
      fieldOverrides: { object_a: { thickness: 12 }, object_c: { thickness: 10 } }
    },
    definition: {
      components: [
        { role: "plate", label: "Plate", objectRoles: ["plate"] },
        { role: "optional", label: "Optional part", default: "ghost", objectRoles: ["optional"] },
        { role: "nested", label: "Nested parts", objectRoles: ["nested"] }
      ]
    },
    diagnosticsSummary: { diagnostics: [{ severity: "warning", message: "Missing optional stiffener." }], errorCount: 0, warningCount: 1, health: "warning" },
    quickParameterFields: [{ type: "number", label: "Thickness", value: 12, commit: { action: "smartComponent.parameter.set", smartComponentId: "component-a", parameterPath: "plate.thickness" } }],
    liveRoleOptions: [{ role: "plate", active: true }],
    objectIndex: {
      object_a: { collection: "plates", type: "plate" },
      object_b: { collection: "plates", type: "plate" },
      object_c: { collection: "plates", type: "plate" },
      object_d: { collection: "plates", type: "plate" }
    },
    capabilities: {
      resetObjectOverrides: true,
      detachObject: true,
      reattachObject: true,
      resolveDiagnostics: true,
      deleteSmartComponent: true
    }
  });
  const smartComponentPropertyFields = smartComponentPropertySections?.flatMap((section) => section.fields || []) || [];
  const smartComponentPropertyActions = smartComponentPropertyFields.flatMap((field) => [field, ...(field.actions || [])]);
  const smartComponentDiagnosticsSection = smartComponentPropertySections?.find((section) => section.id === "inspector.properties.smartComponent.diagnostics");
  const smartComponentLifecycleFields = smartComponentPropertySections
    ?.find((section) => section.id === "inspector.properties.smartComponent.lifecycle")
    ?.fields || [];
  const lifecycleFieldByObjectId = (objectId) => smartComponentLifecycleFields.find((field) => field.value === objectId);
  const lifecycleActionsForObjectId = (objectId) => lifecycleFieldByObjectId(objectId)?.actions || [];
  if (
    !Array.isArray(smartComponentPropertySections)
    || !smartComponentPropertySections.some((section) => section.id === "inspector.properties.smartComponent.primaryParameters")
    || smartComponentDiagnosticsSection?.label !== "Diagnostics"
    || smartComponentDiagnosticsSection?.open !== true
    || !smartComponentDiagnosticsSection?.fields?.some((field) => field.type === "message" && field.state === "warning" && field.value === "Missing optional stiffener.")
    || !smartComponentPropertyFields.some((field) => field.commit?.action === "smartComponent.roleActive.set")
    || lifecycleFieldByObjectId("object_a")?.type !== "objectRef"
    || lifecycleFieldByObjectId("object_c")?.type !== "objectRef"
    || lifecycleFieldByObjectId("object_d")?.type !== "objectRef"
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.objectOverrides.reset")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.object.detach")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.object.reattach")
    || !lifecycleActionsForObjectId("object_a").some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || !lifecycleActionsForObjectId("object_a").some((field) => field.action === "smartComponent.object.detach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || lifecycleActionsForObjectId("object_b").some((field) => field.action === "smartComponent.object.detach")
    || !lifecycleActionsForObjectId("object_b").some((field) => field.action === "smartComponent.object.reattach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_b")
    || !lifecycleActionsForObjectId("object_c").some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.objectId === "object_c")
    || !lifecycleActionsForObjectId("object_d").some((field) => field.action === "smartComponent.object.reattach" && field.payload?.objectId === "object_d")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.diagnostics.resolve")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.parameters.open")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.delete")
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(smartComponentPropertySections)
  ) {
    fail(errors, `inspector-property-metadata Smart Component property sections must be serializable descriptor data: ${JSON.stringify(smartComponentPropertySections)}`);
  }
  const boundSmartComponentSections = generatedPropertyBindings.bindGeneratedPropertySections?.(smartComponentPropertySections, {
    commits: {
      "smartComponent.parameter.set": () => "parameter",
      "smartComponent.roleActive.set": () => "role"
    },
    actions: {
      "smartComponent.objectOverrides.reset": () => "reset",
      "smartComponent.object.detach": () => "detach",
      "smartComponent.object.reattach": () => "reattach",
      "smartComponent.diagnostics.resolve": () => "diagnostics",
      "smartComponent.parameters.open": () => "open",
      "smartComponent.delete": () => "delete"
    },
    select: () => "select",
    fit: () => "fit"
  }) || [];
  const boundSmartComponentFields = boundSmartComponentSections.flatMap((section) => section.fields || []);
  const boundSmartComponentActions = boundSmartComponentFields.flatMap((field) => [field, ...(field.actions || [])]);
  if (
    typeof boundSmartComponentFields.find((field) => field.commit?.action === "smartComponent.parameter.set")?.onChange !== "function"
    || typeof boundSmartComponentFields.find((field) => field.commit?.action === "smartComponent.roleActive.set")?.onChange !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.objectOverrides.reset")?.onClick !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.object.detach")?.onClick !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.object.reattach")?.onClick !== "function"
    || typeof boundSmartComponentFields.find((field) => field.action === "smartComponent.diagnostics.resolve")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach Smart Component handlers from metadata intents: ${JSON.stringify(boundSmartComponentSections)}`);
  }
  const generatedBySection = inspectorPropertyMetadata.inspectorObjectGeneratedBySection?.({
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      objectRoles: { plate: "object_a" },
      fieldOverrides: { object_a: { thickness: 12 } }
    },
    rootSmartComponent: { id: "root-component", type: "frame", kind: "assembly" },
    objectId: "object_a",
    objectIndex: {
      "component-a": { collection: "smartComponentInstances", type: "connection" },
      "root-component": { collection: "smartComponentInstances", type: "assembly" },
      object_a: { collection: "plates", type: "plate" }
    },
    capabilities: { resetObjectOverrides: true, detachObject: true, reattachObject: true }
  });
  const generatedByObjectRefActions = generatedBySection?.fields?.flatMap((field) => field.actions || []) || [];
  if (
    generatedBySection?.id !== "inspector.properties.object.generatedBy"
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(generatedBySection)
    || !generatedByObjectRefActions.some((action) => action.action === "objectRef.select" && action.payload?.smartComponentId === "component-a")
    || !generatedByObjectRefActions.some((action) => action.action === "objectRef.select" && action.payload?.smartComponentId === "root-component")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.object.detach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || generatedBySection.fields?.some((field) => field.action === "smartComponent.object.reattach")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.parameters.open")
  ) {
    fail(errors, `inspector-property-metadata object generated-by section must be serializable descriptor data: ${JSON.stringify(generatedBySection)}`);
  }
  const generatedByDetachedSection = inspectorPropertyMetadata.inspectorObjectGeneratedBySection?.({
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      objectRoles: { plate: "object_a" },
      detachedObjectIds: ["object_a"]
    },
    objectId: "object_a",
    objectIndex: {
      "component-a": { collection: "smartComponentInstances", type: "connection" },
      object_a: { collection: "plates", type: "plate" }
    },
    capabilities: { resetObjectOverrides: true, detachObject: true, reattachObject: true }
  });
  if (
    generatedByDetachedSection?.id !== "inspector.properties.object.generatedBy"
    || !generatedByDetachedSection.fields?.some((field) => field.label === "Lifecycle" && field.value === "Detached")
    || generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.object.detach")
    || generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.objectOverrides.reset")
    || !generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.object.reattach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(generatedByDetachedSection)
  ) {
    fail(errors, `inspector-property-metadata detached object generated-by section must expose reattach-only lifecycle data: ${JSON.stringify(generatedByDetachedSection)}`);
  }
  const objectIdentity = inspectorPropertyMetadata.inspectorObjectIdentitySection?.({
    objectId: "plate-a",
    entry: { collection: "plates", type: "plate" },
    object: { type: "plate", ownerId: "component-a", memberEnd: "start", fabrication: { operation: "cut" } }
  });
  if (
    objectIdentity?.id !== "inspector.properties.object.identity"
    || JSON.stringify(objectIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "plate-a"],
      ["Collection", "plates"],
      ["Type", "plate"],
      ["Owner", "component-a"],
      ["Member end", "start"],
      ["Operation", "cut"]
    ])
  ) {
    fail(errors, `inspector-property-metadata object identity section has unexpected shape: ${JSON.stringify(objectIdentity)}`);
  }
  const objectPlateSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "plates",
    objectId: "plate-a",
    objectDetail: { sketchMode: "relations" },
    object: {
      id: "plate-a",
      type: "plate",
      thickness: 8,
      material: "S355"
    },
    objectState: {
      definition: {
        label: "Under-defined",
        degreesOfFreedom: 2,
        relationCount: 5,
        independentConstraintCount: 4,
        variableCount: 8,
        underDefinedVertexIds: ["v1"],
        underDefinedEdgeIds: ["e1"]
      },
      outlineVertices: 4,
      bends: []
    }
  });
  const objectPlateFields = objectPlateSections?.flatMap((section) => section.fields || []) || [];
  if (
    JSON.stringify(objectPlateSections?.map((section) => section.id)) !== JSON.stringify([
      "inspector.properties.object.plate",
      "inspector.properties.object.plate.sketch",
      "inspector.properties.object.plate.bends"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlateSections)
    || !objectPlateFields.some((field) => field.commit?.action === "object.plate.update" && field.label === "Thickness")
    || !objectPlateFields.some((field) => field.action === "object.plate.relations.toggle" && field.pressed === true)
    || !objectPlateFields.some((field) => field.type === "action" && field.action === "object.plate.relations.infer" && field.payload?.objectId === "plate-a" && field.icon === "relation")
  ) {
    fail(errors, `inspector-property-metadata plate generated Properties must expose serializable plate/sketch/bend descriptors: ${JSON.stringify(objectPlateSections)}`);
  }
  const objectPlateWithBendsSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "plates",
    objectId: "plate-b",
    object: {
      id: "plate-b",
      type: "plate",
      thickness: 10,
      material: "S355"
    },
    objectState: {
      definition: { label: "Defined", relationCount: 6, independentConstraintCount: 6, variableCount: 6 },
      outlineVertices: 4,
      bends: [
        { id: "bend-a", edgeId: "edge-a", direction: "up", angle: 90, radius: 2, flangeLength: 50, relief: { type: "round", radius: 8 }, targetLabel: "1. edge-a" },
        { id: "bend-b", edgeId: "edge-b", direction: "down", angle: 45, radius: 3, flangeLength: 75, relief: { type: "rect", radius: 10 }, targetLabel: "2. edge-b" }
      ]
    }
  });
  const objectPlateBendSections = objectPlateWithBendsSections?.filter((section) => section.id?.startsWith("inspector.properties.object.plate.bend.")) || [];
  const objectPlateBendFields = objectPlateBendSections.flatMap((section) => section.fields || []);
  if (
    objectPlateBendSections.length !== 2
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlateWithBendsSections)
    || !objectPlateBendFields.some((field) => field.label === "Relief radius" && field.commit?.action === "object.plate.bend.update" && JSON.stringify(field.commit?.patchPath) === JSON.stringify(["relief", "radius"]))
    || !objectPlateBendFields.some((field) => field.label === "Remove Bend" && field.icon === "cancel" && field.action === "object.plate.bend.remove" && field.payload?.bendId === "bend-a")
    || !objectPlateBendFields.some((field) => field.label === "Direction" && field.commit?.bend?.id === "bend-b")
  ) {
    fail(errors, `inspector-property-metadata plate bend generated Properties must cover every bend edit/remove descriptor: ${JSON.stringify(objectPlateWithBendsSections)}`);
  }
  const objectFeatureSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "features",
    objectId: "feature-a",
    object: {
      id: "feature-a",
      type: "boolean-part",
      operationEnabled: true,
      booleanType: "BOOLEAN_CUT",
      cutKind: "csg",
      body: { type: "box", center: [0, 0, 0], size: [10, 20, 30] },
      source: { memberId: "member-a" }
    }
  });
  const objectFeatureFields = objectFeatureSections?.flatMap((section) => section.fields || []) || [];
  const centerXField = objectFeatureFields.find((field) => field.label === "Center X");
  if (
    !Array.isArray(objectFeatureSections)
    || !objectFeatureSections.length
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectFeatureSections)
    || centerXField?.value !== 0
    || centerXField?.commit?.action !== "object.feature.body.update"
    || JSON.stringify(centerXField?.commit?.vectorValue) !== JSON.stringify([0, 0, 0])
    || !objectFeatureFields.some((field) => field.action === "object.feature.openEditor")
  ) {
    fail(errors, `inspector-property-metadata object dispatcher must expose serializable object descriptors and preserve zero vectors: ${JSON.stringify(objectFeatureSections)}`);
  }
  const boundObjectFeatureSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectFeatureSections, {
    commits: {
      "object.feature.operationEnabled.set": () => "enabled",
      "object.feature.update": () => "feature",
      "object.feature.body.update": () => "body"
    },
    actions: { "object.feature.openEditor": () => "editor" }
  }) || [];
  const boundObjectFeatureFields = boundObjectFeatureSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectFeatureFields.find((field) => field.label === "Center X")?.onChange !== "function"
    || typeof boundObjectFeatureFields.find((field) => field.action === "object.feature.openEditor")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach object-property handlers from metadata intents: ${JSON.stringify(boundObjectFeatureSections)}`);
  }
  const trimJointFixture = {
    id: "trim-a",
    type: "corner-trim",
    participants: [
      { memberId: "beam-a" },
      { memberId: "column-b" }
    ],
    operations: [
      {
        id: "cut-a",
        type: "end-miter",
        enabled: true,
        gap: 5,
        memberAId: "beam-a",
        memberAEnd: "end",
        memberBId: "column-b",
        memberBEnd: "start",
        miterMode: "equal-angle"
      },
      {
        id: "plane-a",
        type: "plane-trim",
        enabled: true,
        gap: 2,
        memberAId: "beam-a",
        memberAEnd: "end",
        referencePlaneIds: ["plane-1"],
        removedRegionKeys: ["plane-1:-"]
      }
    ]
  };
  const objectTrimSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "trimJoints",
    objectId: "trim-a",
    objectDetail: { operationId: "cut-a" },
    object: trimJointFixture
  });
  const objectTrimFields = objectTrimSections?.flatMap((section) => section.fields || []) || [];
  const trimCutSelector = objectTrimFields.find((field) => field.type === "tabList" && field.label === "Cuts");
  const trimTypeField = objectTrimFields.find((field) => field.type === "optionGrid" && field.label === "Type");
  if (
    JSON.stringify(objectTrimSections?.map((section) => section.id)) !== JSON.stringify([
      "inspector.properties.object.trimJoint.overview",
      "inspector.properties.object.trimJoint.cuts",
      "inspector.properties.object.trimJoint.participants",
      "inspector.properties.object.trimJoint.operation"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectTrimSections)
    || trimCutSelector?.commit?.action !== "object.trimJoint.operation.select"
    || JSON.stringify(trimCutSelector?.options?.map((option) => option.id)) !== JSON.stringify(["cut-a", "plane-a"])
    || trimTypeField?.commit?.action !== "object.trimJoint.operation.type.set"
    || trimTypeField?.commit?.operationId !== "cut-a"
    || !trimTypeField?.options?.some((option) => option.id === "end-miter" && option.icon === "trim-miter")
    || trimTypeField?.options?.some((option) => option.id === "plane-trim")
    || !objectTrimFields.some((field) => field.type === "objectRef" && field.label === "Member A" && field.value === "beam-a")
    || !objectTrimFields.some((field) => field.type === "segmented" && field.label === "Member A end" && field.commit?.patchKey === "memberAEnd")
    || !objectTrimFields.some((field) => field.type === "segmented" && field.label === "Miter" && field.commit?.patchKey === "miterMode")
  ) {
    fail(errors, `inspector-property-metadata trim joint generated Properties must expose cut selection, type grid, member refs, and common trim controls: ${JSON.stringify(objectTrimSections)}`);
  }
  const objectPlaneTrimSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "trimJoints",
    objectId: "trim-a",
    objectDetail: { operationId: "plane-a" },
    object: trimJointFixture
  });
  const objectPlaneTrimFields = objectPlaneTrimSections?.flatMap((section) => section.fields || []) || [];
  if (
    generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlaneTrimSections)
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Type" && field.actions?.some((action) => action.action === "object.trim.openEditor" && action.payload?.detail?.operationId === "plane-a"))
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Planes" && field.actions?.some((action) => action.payload?.detail?.operationId === "plane-a"))
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Regions" && field.actions?.some((action) => action.payload?.detail?.regionKey === "plane-1:-"))
  ) {
    fail(errors, `inspector-property-metadata plane trim generated Properties must expose advanced-editor actions for type, planes, and regions: ${JSON.stringify(objectPlaneTrimSections)}`);
  }
  const boundObjectTrimSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectTrimSections, {
    commits: {
      "object.trimJoint.operation.select": () => "select",
      "object.trimJoint.operation.type.set": () => "type",
      "object.trimJoint.operation.update": () => "update"
    },
    actions: {
      "object.trim.openEditor": () => "editor",
      "objectRef.select": () => "selectObject",
      "objectRef.fit": () => "fitObject"
    }
  }) || [];
  const boundObjectTrimFields = boundObjectTrimSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectTrimFields.find((field) => field.type === "tabList")?.onChange !== "function"
    || typeof boundObjectTrimFields.find((field) => field.type === "optionGrid")?.onChange !== "function"
    || typeof boundObjectTrimFields.find((field) => field.label === "Member A")?.actions?.[0]?.onClick !== "function"
    || typeof boundObjectTrimFields.find((field) => field.label === "Miter")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach trim joint property handlers from metadata intents: ${JSON.stringify(boundObjectTrimSections)}`);
  }
  const featureEditorSections = inspectorPropertyMetadata.inspectorFeatureEditorSections?.({
    id: "feature-a",
    type: "boolean-part",
    ownerId: "member-a",
    operationEnabled: true,
    booleanType: "BOOLEAN_CUT",
    source: { kind: "member-profile", memberId: "member-a" },
    body: {
      type: "polygonal-prism",
      center: [0, 0, 0],
      depth: 25,
      axisX: [1, 0, 0],
      axisY: [0, 1, 0],
      axisZ: [0, 0, 1],
      outline: [[0, 0], [100, 0], [100, 50]]
    }
  });
  const featureEditorNestedSections = featureEditorSections?.flatMap((section) => section.sections || []) || [];
  const featureEditorFields = [
    ...(featureEditorSections?.flatMap((section) => section.fields || []) || []),
    ...featureEditorNestedSections.flatMap((section) => section.fields || [])
  ];
  const featureEditorAxisFields = featureEditorNestedSections.find((section) => section.id === "feature.body.axes")?.fields || [];
  const featureEditorOutlineFields = featureEditorNestedSections.find((section) => section.id === "feature.body.outline")?.fields || [];
  const featureEditorBooleanField = featureEditorFields.find((field) => field.label === "Boolean");
  const featureEditorSourceKindField = featureEditorFields.find((field) => field.label === "Kind");
  if (
    JSON.stringify(featureEditorSections?.map((section) => section.id)) !== JSON.stringify(["feature.overview", "feature.operation", "feature.source", "feature.body"])
    || !featureEditorSections?.find((section) => section.id === "feature.body")?.open
    || JSON.stringify(featureEditorNestedSections.map((section) => section.id)) !== JSON.stringify(["feature.body.axes", "feature.body.outline"])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(featureEditorSections)
    || JSON.stringify(featureEditorBooleanField?.options?.map((option) => option.id)) !== JSON.stringify(["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"])
    || !featureEditorSourceKindField?.options?.some((option) => option.id === "member-profile")
    || !featureEditorFields.some((field) => field.label === "Enabled" && field.commit?.action === "feature.operationEnabled.set")
    || !featureEditorFields.some((field) => field.label === "Center" && field.commit?.action === "feature.body.update" && field.commit?.patchKey === "center")
    || !featureEditorFields.some((field) => field.label === "Member" && field.commit?.action === "feature.source.update" && field.commit?.patchKey === "memberId")
    || !["axisX", "axisY", "axisZ"].every((patchKey) => featureEditorAxisFields.some((field) => field.commit?.action === "feature.body.update" && field.commit?.patchKey === patchKey))
    || !featureEditorOutlineFields.every((field, index) => field.type === "vector2" && JSON.stringify(field.axisLabels) === JSON.stringify(["Y", "Z"]) && field.commit?.action === "feature.body.outlinePoint.update" && field.commit?.pointIndex === index)
  ) {
    fail(errors, `inspector-property-metadata Feature Editor sections must expose serializable focused editor descriptors: ${JSON.stringify(featureEditorSections)}`);
  }
  const featureEditorBindableSections = (featureEditorSections || []).flatMap((section) => [
    { ...section, sections: undefined },
    ...((section.sections || []).map((nestedSection) => ({ ...nestedSection, sections: undefined })))
  ]);
  const boundFeatureEditorSections = generatedPropertyBindings.bindGeneratedPropertySections?.(featureEditorBindableSections, {
    commits: {
      "feature.operationEnabled.set": () => "enabled",
      "feature.update": () => "feature",
      "feature.body.update": () => "body",
      "feature.body.outlinePoint.update": () => "outline",
      "feature.source.update": () => "source"
    }
  }) || [];
  const boundFeatureEditorFields = boundFeatureEditorSections.flatMap((section) => section.fields || []);
  if (
    typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.operationEnabled.set")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.update")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.patchKey === "axisX")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.body.outlinePoint.update")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.source.update")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach Feature Editor handlers from metadata intents: ${JSON.stringify(boundFeatureEditorSections)}`);
  }
  const objectSketchSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "sketches",
    object: { id: "sketch-a", type: "sketch" },
    objectId: "sketch-a",
    objectState: {
      definition: { label: "Under-defined", degreesOfFreedom: 2 },
      outlineVertices: 4
    }
  });
  const objectSketchFields = objectSketchSections?.flatMap((section) => section.fields || []) || [];
  if (
    JSON.stringify(objectSketchSections?.map((section) => section.id)) !== JSON.stringify(["inspector.properties.object.sketch"])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectSketchSections)
    || !objectSketchFields.some((field) => field.label === "Status" && field.value === "Under-defined")
    || !objectSketchFields.some((field) => field.label === "Outline" && field.value === "4 vertices")
    || !objectSketchFields.some((field) => field.label === "Free DOF" && field.value === 2)
    || !objectSketchFields.some((field) => field.type === "action" && field.action === "object.sketch.createPlate" && field.payload?.objectId === "sketch-a" && field.icon === "plate" && field.primary === true && field.disabled !== true)
  ) {
    fail(errors, `inspector-property-metadata sketch generated Properties must come from objectState descriptors and expose sketch-to-plate intent: ${JSON.stringify(objectSketchSections)}`);
  }
  const objectFastenerSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "fastenerGroups",
    object: {
      id: "fastener-a",
      fastenerRef: "M16",
      holePatternRef: "holes-a",
      assembly: {
        length: 60,
        gripLength: 42,
        nutOffset: 5,
        washers: { head: true, nut: false }
      },
      participants: ["plate-a", "beam-a"],
      through: { fromFeatureId: "feature-from", toFeatureId: "feature-to" },
      orientation: { headSide: "front", axis: "x" }
    },
    catalogEntries: (catalog) => catalog === "fasteners" ? {
      M16: {
        id: "M16",
        kind: "bolt",
        standard: "ISO",
        grade: "8.8",
        shank: { diameter: 16 },
        hole: { defaultDiameter: 18, shape: "round" },
        washer: { outerDiameter: 30, thickness: 3 }
      }
    } : {},
    catalogOptions: () => [{ id: "M16", label: "M16" }, { id: "M20", label: "M20" }],
    fastenerLengthOptions: () => [{ id: "60", label: "60" }, { id: "80", label: "80" }]
  });
  const fastenerSectionIds = objectFastenerSections?.map((section) => section.id) || [];
  const objectFastenerFields = objectFastenerSections?.flatMap((section) => section.fields || []) || [];
  const fastenerCatalogField = objectFastenerFields.find((field) => field.label === "Fastener");
  const fastenerLengthField = objectFastenerFields.find((field) => field.label === "Length");
  const fastenerGripField = objectFastenerFields.find((field) => field.label === "Grip length");
  const fastenerHeadWasherField = objectFastenerFields.find((field) => field.label === "Head washer");
  const fastenerNutWasherField = objectFastenerFields.find((field) => field.label === "Nut washer");
  if (
    JSON.stringify(fastenerSectionIds) !== JSON.stringify([
      "inspector.properties.object.fastenerGroup.catalog",
      "inspector.properties.object.fastenerGroup.assembly",
      "inspector.properties.object.fastenerGroup.washers",
      "inspector.properties.object.fastenerGroup.installation"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectFastenerSections)
    || fastenerCatalogField?.type !== "select"
    || fastenerCatalogField?.value !== "M16"
    || JSON.stringify(fastenerCatalogField?.options?.map((option) => option.id)) !== JSON.stringify(["M16", "M20"])
    || fastenerCatalogField?.commit?.action !== "object.fastenerGroup.update"
    || fastenerCatalogField?.commit?.patchKey !== "fastenerRef"
    || !objectFastenerFields.some((field) => field.label === "Kind" && field.value === "bolt")
    || !objectFastenerFields.some((field) => field.label === "Standard" && field.value === "ISO")
    || !objectFastenerFields.some((field) => field.label === "Grade" && field.value === "8.8")
    || !objectFastenerFields.some((field) => field.label === "Diameter" && field.value === "16")
    || !objectFastenerFields.some((field) => field.label === "Hole" && field.value === "18 round")
    || fastenerLengthField?.type !== "select"
    || fastenerLengthField?.value !== "60"
    || JSON.stringify(fastenerLengthField?.options?.map((option) => option.id)) !== JSON.stringify(["60", "80"])
    || fastenerLengthField?.commit?.action !== "object.fastenerGroup.update"
    || JSON.stringify(fastenerLengthField?.commit?.patchPath) !== JSON.stringify(["assembly", "length"])
    || fastenerLengthField?.commit?.valueType !== "number"
    || JSON.stringify(fastenerGripField?.commit?.patchPath) !== JSON.stringify(["assembly", "gripLength"])
    || fastenerHeadWasherField?.type !== "checkbox"
    || fastenerHeadWasherField?.value !== true
    || JSON.stringify(fastenerHeadWasherField?.commit?.patchPath) !== JSON.stringify(["assembly", "washers", "head"])
    || fastenerNutWasherField?.type !== "checkbox"
    || fastenerNutWasherField?.value !== false
    || JSON.stringify(fastenerNutWasherField?.commit?.patchPath) !== JSON.stringify(["assembly", "washers", "nut"])
    || !objectFastenerFields.some((field) => field.label === "Hole pattern" && field.value === "holes-a")
    || !objectFastenerFields.some((field) => field.label === "From feature" && field.value === "feature-from")
    || !objectFastenerFields.some((field) => field.label === "To feature" && field.value === "feature-to")
    || !objectFastenerFields.some((field) => field.label === "Head side" && field.value === "front")
    || !objectFastenerFields.some((field) => field.label === "Axis" && field.value === "x")
    || !objectFastenerFields.some((field) => field.label === "Participants" && field.value === "2")
    || !objectFastenerFields.some((field) => field.label === "Participant 2" && field.value === "beam-a")
    || !objectFastenerFields.some((field) => field.label === "Outer diameter" && field.value === "30")
    || !objectFastenerFields.some((field) => field.label === "Thickness" && field.value === "3")
  ) {
    fail(errors, `inspector-property-metadata fastener generated Properties must cover catalog, assembly, washers, and installation without legacy Advanced Object controls: ${JSON.stringify(objectFastenerSections)}`);
  }
  const boundObjectFastenerSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectFastenerSections, {
    commits: { "object.fastenerGroup.update": () => "fastener" }
  }) || [];
  const boundObjectFastenerFields = boundObjectFastenerSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectFastenerFields.find((field) => field.label === "Fastener")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Length")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Head washer")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Nut washer")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach fastener handlers from metadata intents: ${JSON.stringify(boundObjectFastenerSections)}`);
  }
  if (inspectorPropertyMetadata.inspectorMetadataLabel?.("member_end-id") !== "Member End Id") {
    fail(errors, "inspector-property-metadata metadata label formatter must normalize camel/kebab/snake labels");
  }
  if (inspectorPropertyMetadata.inspectorFormatNumber?.(12.34567) !== "12.346") {
    fail(errors, "inspector-property-metadata number formatter must keep inspector numeric precision stable");
  }
  if (inspectorPropertyMetadata.inspectorFormatVector?.([1, 2.34567, "A"]) !== "1, 2.346, A") {
    fail(errors, "inspector-property-metadata vector formatter must keep inspector vector display stable");
  }
  const metadataSection = inspectorPropertyMetadata.inspectorMetadataSection?.({
    id: "demo.authoring",
    object: { authoring: { createdBy: "test", offset: [1, 2] } }
  });
  if (
    metadataSection?.id !== "demo.authoring"
    || metadataSection?.open !== false
    || JSON.stringify(metadataSection.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["Created By", "test"],
      ["Offset", "1, 2"]
    ])
  ) {
    fail(errors, `inspector-property-metadata metadata section has unexpected shape: ${JSON.stringify(metadataSection)}`);
  }
  const supportActions = {
    objectIndex: {
      object_a: { collection: "plates", type: "plate" },
      object_b: { collection: "members", type: "beam" }
    },
    updateWorkPoint: () => {},
    updateReferencePlane: () => {},
    updateInterface: () => {},
    updateConnectionZone: () => {},
    updateAssembly: () => {},
    updateGroup: () => {},
    updateHolePattern: () => {},
    updateObjectPattern: () => {},
    selectObjectReference: () => {},
    focusObjectReference: () => {}
  };
  const supportCollections = {
    workPoints: { role: "grid", point: [1, 2, 3] },
    referencePlanes: { name: "Plane A", origin: [0, 0, 0], normal: [0, 0, 1], axisX: [1, 0, 0], axisY: [0, 1, 0], extents: { xMin: -100, xMax: 100 } },
    interfaces: { role: "face", origin: [0, 0, 0], normal: [0, 0, 1], localAxisY: [1, 0, 0], localAxisZ: [0, 1, 0], extents: { width: 50, height: 80 } },
    connectionZones: { name: "Zone A", origin: [0, 0, 0], interfaceIds: ["object_a"], objectIds: ["object_b"], smartComponentInstanceIds: [] },
    assemblies: { name: "Assembly A", partIds: ["object_a"], memberIds: ["object_b"] },
    groups: { name: "Group A", objectIds: ["object_a"] },
    holePatterns: { holeDiameter: 18, holeType: "round", positions: [[0, 0], [40, 0]] },
    objectPatterns: { name: "Pattern A", generatedObjectIds: ["object_a"], detachedObjectIds: ["object_b"], transform: { count: 2 } },
    relations: { label: "Relation A", source: { type: "global-axis", origin: [0, 0, 0] } }
  };
  const supportCommitHandlers = {
    "supportObject.workPoint.update": () => "workPoint",
    "supportObject.referencePlane.update": () => "referencePlane",
    "supportObject.interface.update": () => "interface",
    "supportObject.connectionZone.update": () => "connectionZone",
    "supportObject.assembly.update": () => "assembly",
    "supportObject.group.update": () => "group",
    "supportObject.holePattern.update": () => "holePattern",
    "supportObject.objectPattern.update": () => "objectPattern"
  };
  for (const [collection, object] of Object.entries(supportCollections)) {
    const sections = inspectorPropertyMetadata.inspectorSupportObjectPropertySections?.({ collection, object, actions: supportActions });
    if (!Array.isArray(sections) || !sections.length || !sections[0]?.id?.startsWith("inspector.properties.object.")) {
      fail(errors, `inspector-property-metadata support dispatcher returned unexpected sections for ${collection}: ${JSON.stringify(sections)}`);
    }
    if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(sections)) {
      fail(errors, `inspector-property-metadata support dispatcher must return serializable descriptors for ${collection}, not bound callbacks`);
    }
    const supportCommitFields = sections.flatMap((section) => section.fields || []).filter((field) => field?.commit);
    if (collection !== "relations" && !supportCommitFields.length) {
      fail(errors, `inspector-property-metadata support dispatcher must expose editable commit intents for ${collection}`);
    }
    const boundSupportSections = generatedPropertyBindings.bindGeneratedPropertySections?.(sections, { commits: supportCommitHandlers }) || [];
    const boundSupportCommitFields = boundSupportSections.flatMap((section) => section.fields || []).filter((field) => field?.commit);
    if (supportCommitFields.length !== boundSupportCommitFields.length || boundSupportCommitFields.some((field) => typeof field.onChange !== "function")) {
      fail(errors, `Generated Properties binding adapter must attach support-object handlers from serializable intents for ${collection}: ${JSON.stringify(boundSupportSections)}`);
    }
  }
  const objectReferenceSection = inspectorPropertyMetadata.inspectorObjectReferenceSection?.({
    id: "demo.refs",
    label: "References",
    values: ["object_a", "missing"],
    itemLabel: "Object",
    objectIndex: supportActions.objectIndex,
    onSelectObject: supportActions.selectObjectReference,
    onFitObject: supportActions.focusObjectReference
  });
  const firstObjectRef = objectReferenceSection?.fields?.[0];
  const missingObjectRef = objectReferenceSection?.fields?.[1];
  const firstObjectRefSelect = firstObjectRef?.actions?.find((action) => action.action === "objectRef.select");
  const firstObjectRefFit = firstObjectRef?.actions?.find((action) => action.action === "objectRef.fit");
  if (
    objectReferenceSection?.id !== "demo.refs"
    || firstObjectRef?.type !== "objectRef"
    || firstObjectRef?.icon !== modelCollectionMetadata.modelCollectionIcon("plates")
    || firstObjectRefSelect?.label !== "Select"
    || firstObjectRefSelect?.icon !== "selection"
    || firstObjectRefSelect?.payload?.objectId !== "object_a"
    || firstObjectRefFit?.label !== "Fit"
    || firstObjectRefFit?.icon !== "zoom-fit"
    || firstObjectRefFit?.payload?.objectId !== "object_a"
    || missingObjectRef?.actions?.length
  ) {
    fail(errors, `inspector-property-metadata object reference section has unexpected shape: ${JSON.stringify(objectReferenceSection)}`);
  }
  for (const action of [firstObjectRefSelect, firstObjectRefFit]) {
    if (!action?.action || !action?.label || !action?.icon || !iconNames.has(action.icon) || !action.payload) {
      fail(errors, `inspector-property-metadata object reference action must declare action, label, icon, and payload: ${JSON.stringify(action)}`);
    }
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectReferenceSection)) {
    fail(errors, "inspector-property-metadata object reference sections must expose serializable select/fit intents, not bound UI callbacks");
  }
  const boundObjectReferenceSection = generatedPropertyBindings.bindGeneratedPropertySections?.([objectReferenceSection], {
    actions: {
      "objectRef.select": () => "select",
      "objectRef.fit": () => "fit"
    }
  })?.[0];
  const boundObjectRefActions = boundObjectReferenceSection?.fields?.[0]?.actions || [];
  if (
    typeof boundObjectRefActions.find((action) => action.action === "objectRef.select")?.onClick !== "function"
    || typeof boundObjectRefActions.find((action) => action.action === "objectRef.fit")?.onClick !== "function"
    || boundObjectReferenceSection?.fields?.[0]?.onSelect
    || boundObjectReferenceSection?.fields?.[0]?.onFit
    || boundObjectReferenceSection?.fields?.[1]?.actions?.length
  ) {
    fail(errors, `Generated Properties binding adapter must attach object reference handlers from serializable intents: ${JSON.stringify(boundObjectReferenceSection)}`);
  }
  if (typeof inspectorPropertyBindings.createInspectorPropertyBindings !== "function" || typeof inspectorPropertyBindings.propertyPatch !== "function") {
    fail(errors, "inspector-property-bindings must export the generated Properties binding factory and patch helper");
  }
  const nestedPatch = inspectorPropertyBindings.propertyPatch?.(42, { patchPath: ["assembly", "length"] });
  const vectorPatch = inspectorPropertyBindings.propertyPatch?.(7, { patchKey: "center", vectorValue: [0, 0, 0], axisIndex: 1 });
  if (JSON.stringify(nestedPatch) !== JSON.stringify({ assembly: { length: 42 } }) || JSON.stringify(vectorPatch) !== JSON.stringify({ center: [0, 7, 0] })) {
    fail(errors, `inspector-property-bindings propertyPatch must preserve nested paths and zero vectors: ${JSON.stringify({ nestedPatch, vectorPatch })}`);
  }
  const bindingEvents = [];
  const inspectorBindings = inspectorPropertyBindings.createInspectorPropertyBindings?.({
    getSelection: () => ({
      memberId: "selected-member",
      smartComponentId: "selected-component",
      objectId: "selected-object",
      objectDetail: { operationId: "trim-1" }
    }),
    definition: (smartComponentId) => ({ type: smartComponentId }),
    refs: {
      selectSmartComponent: (smartComponentId) => bindingEvents.push(["selectSmartComponent", smartComponentId]),
      selectObjectReference: (objectId) => bindingEvents.push(["selectObject", objectId]),
      focusObjectReference: (objectId) => bindingEvents.push(["fit", objectId])
    },
    selectionActions: {
      pickMember: () => bindingEvents.push(["pickMember"]),
      pickSmartComponent: () => bindingEvents.push(["pickSmartComponent"]),
      pickObject: () => bindingEvents.push(["pickObject"]),
      fit: () => bindingEvents.push(["quickFit"]),
      clear: () => bindingEvents.push(["quickClear"]),
      selectSmartComponent: (smartComponentId) => bindingEvents.push(["quickComponent", smartComponentId]),
      openFeatureEditor: (objectId) => bindingEvents.push(["quickFeature", objectId]),
      openTrimEditor: (objectId, detail) => bindingEvents.push(["quickTrim", objectId, detail]),
      selectObjectDetail: (objectId, detail) => bindingEvents.push(["quickDetail", objectId, detail])
    },
    activeTool: {
      runCommand: (commandId) => bindingEvents.push(["toolCommand", commandId]),
      cycleSnap: () => bindingEvents.push(["toolCycleSnap"]),
      cancel: () => bindingEvents.push(["toolCancel"]),
      setSnapStrength: (strength) => bindingEvents.push(["toolStrength", strength]),
      setSelectionScope: (mode) => bindingEvents.push(["toolScope", mode]),
      setSnapTarget: (target, enabled) => bindingEvents.push(["toolTarget", target, enabled])
    },
    members: {
      setProfile: (memberId, profileId) => bindingEvents.push(["memberProfile", memberId, profileId]),
      setMaterial: (memberId, materialId) => bindingEvents.push(["memberMaterial", memberId, materialId]),
      setRotation: (memberId, rotation) => bindingEvents.push(["memberRotation", memberId, rotation]),
      setCenterCoordinate: (memberId, axisIndex, value) => bindingEvents.push(["memberCenter", memberId, axisIndex, value]),
      setEndpointCoordinate: (memberId, endpoint, axisIndex, value) => bindingEvents.push(["memberEndpoint", memberId, endpoint, axisIndex, value]),
      setCustomProfileDraft: (memberId, value) => bindingEvents.push(["memberCustomProfileDraft", memberId, value]),
      createCustomProfile: (memberId) => bindingEvents.push(["memberCreateCustomProfile", memberId]),
      removeRelation: (relationId, memberId) => bindingEvents.push(["memberRemoveRelation", memberId, relationId]),
      setAlignmentGlobalAxis: (memberId, axisId) => bindingEvents.push(["memberAxis", memberId, axisId]),
      pickAlignmentAxis: (memberId) => bindingEvents.push(["memberPickAxis", memberId]),
      clearAlignment: (memberId) => bindingEvents.push(["memberClearAlignment", memberId])
    },
    support: {
      updateWorkPoint: (patch) => bindingEvents.push(["workPoint", patch])
    },
    smartComponents: {
      updateParameter: (smartComponentId, definition, path, value) => bindingEvents.push(["parameter", smartComponentId, definition.type, path, value]),
      setRoleActive: (smartComponentId, role, active) => bindingEvents.push(["role", smartComponentId, role, active]),
      resetObjectOverrides: (smartComponentId, objectId) => bindingEvents.push(["reset", smartComponentId, objectId]),
      detachObject: (smartComponentId, objectId) => bindingEvents.push(["detach", smartComponentId, objectId]),
      reattachObject: (smartComponentId, objectId) => bindingEvents.push(["reattach", smartComponentId, objectId])
    },
    objects: {
      updateFastenerGroup: (patch) => bindingEvents.push(["fastener", patch]),
      updatePlatePatch: (patch) => bindingEvents.push(["plate", patch]),
      upsertPlateBend: (bend) => bindingEvents.push(["bend", bend]),
      removePlateBend: (bendId) => bindingEvents.push(["removeBend", bendId]),
      inferPlateSketchRelations: (objectId) => bindingEvents.push(["inferRelations", objectId]),
      createPlateFromSketch: (objectId) => bindingEvents.push(["createPlate", objectId]),
      selectTrimOperation: (operationId) => bindingEvents.push(["trimSelect", operationId]),
      setTrimOperationType: (operationId, type) => bindingEvents.push(["trimType", operationId, type]),
      setPlateSketchRelationValue: (value, commit) => bindingEvents.push(["relationValue", value, commit]),
      selectPlateSketchRelation: (payload) => bindingEvents.push(["relationSelect", payload]),
      setPlateSketchRelationMode: (payload) => bindingEvents.push(["relationMode", payload]),
      resolvePlateSketchRelation: (payload) => bindingEvents.push(["relationResolve", payload]),
      removePlateSketchRelation: (payload) => bindingEvents.push(["relationRemove", payload]),
      addPlateSketchRelation: (payload) => bindingEvents.push(["relationAdd", payload]),
      addPlateSketchConstructionLine: (payload) => bindingEvents.push(["constructionLine", payload]),
      fixPlateSketchUnderDefinedEntities: (payload) => bindingEvents.push(["underDefinedFix", payload]),
      removePlateSketchFixedRelations: (payload) => bindingEvents.push(["relationUnfixAll", payload]),
      selectObjectDetail: (objectId, detail) => bindingEvents.push(["detail", objectId, detail]),
      openTrimEditor: (objectId, detail) => bindingEvents.push(["trimEditor", objectId, detail]),
      openFeatureEditor: (objectId) => bindingEvents.push(["featureEditor", objectId])
    }
  });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.select"]({ payload: { smartComponentId: "component-ref" } });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.select"]({ payload: { objectId: "object-ref" } });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.fit"]({ payload: { objectId: "fit-ref" } });
  inspectorBindings.generatedActiveToolBindings().runCommand("settings.snap.toggle");
  inspectorBindings.generatedActiveToolBindings().actions["activeTool.cycleSnap"]({});
  inspectorBindings.generatedActiveToolBindings().actions["activeTool.cancel"]({});
  inspectorBindings.generatedActiveToolBindings().commits["snapStrength.set"]("strong");
  inspectorBindings.generatedActiveToolBindings().commits["selectionScope.set"]("component");
  inspectorBindings.generatedActiveToolBindings().commits["snapTarget.set"](false, { target: "members" });
  inspectorBindings.generatedMemberBindings().commits["member.profile.set"]("IPE300", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().commits["member.material.set"]("S275", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().commits["member.rotation.set"](30, {});
  inspectorBindings.generatedMemberBindings().commits["member.centerCoordinate.set"](125, { memberId: "member-a", axisIndex: 0 });
  inspectorBindings.generatedMemberBindings().commits["member.endpointCoordinate.set"](250, { memberId: "member-a", endpoint: "end", axisIndex: 2 });
  inspectorBindings.generatedMemberBindings().commits["member.customProfileDraft.set"]("0 0\n1 0\n0 1", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.setGlobalAxis"]({ payload: { memberId: "member-a", axisId: "z" } });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.pickAxis"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.clear"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.customProfile.create"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.relation.remove"]({ payload: { memberId: "member-a", relationId: "relation-a" } });
  inspectorBindings.generatedSmartComponentBindings().commits["smartComponent.parameter.set"](12, { smartComponentId: "component-a", parameterPath: "plate.thickness" });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.objectOverrides.reset"]({ payload: { smartComponentId: "component-a", objectId: "object-a" } });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.object.detach"]({ payload: { smartComponentId: "component-a", objectId: "object-detach" } });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.object.reattach"]({ payload: { smartComponentId: "component-a", objectId: "object-reattach" } });
  inspectorBindings.generatedSupportObjectBindings().commits["supportObject.workPoint.update"](4, { patchKey: "role" });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.objectOverrides.reset"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-reset" } });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.object.detach"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-detach" } });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.object.reattach"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-reattach" } });
  inspectorBindings.generatedObjectBindings().commits["object.fastenerGroup.update"]("80", { patchPath: ["assembly", "length"], valueType: "number" });
  inspectorBindings.generatedObjectBindings().commits["object.fastenerGroup.update"](true, { patchPath: ["assembly", "washers", "head"] });
  inspectorBindings.generatedObjectBindings().commits["object.plate.bend.update"]("rect", { bend: { id: "bend-a", relief: { type: "round", width: 5 } }, patchPath: ["relief", "type"] });
  inspectorBindings.generatedObjectBindings().actions["object.plate.bend.remove"]({ payload: { bendId: "bend-remove" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.relations.infer"]({ payload: { objectId: "plate-a" } });
  inspectorBindings.generatedObjectBindings().commits["object.trimJoint.operation.select"]("trim-op-a");
  inspectorBindings.generatedObjectBindings().commits["object.trimJoint.operation.type.set"]("end-miter", { operationId: "trim-op-a" });
  inspectorBindings.generatedObjectBindings().commits["object.plate.sketchRelation.value.set"](42, { objectId: "plate-a", relationId: "relation-a" });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.select"]({ payload: { objectId: "plate-a", relationId: "relation-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.mode.set"]({ payload: { objectId: "plate-a", relationId: "relation-a", mode: "driven" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.resolve"]({ payload: { objectId: "plate-a", relationId: "relation-a", healthStatus: "conflicted" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.remove"]({ payload: { objectId: "plate-a", relationId: "relation-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.add"]({ payload: { objectId: "plate-a", relation: { type: "fixed", edgeId: "e1" } } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchConstructionLine.add"]({ payload: { objectId: "plate-a", from: [0, 0], to: [1, 1] } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchUnderDefined.fixRemaining"]({ payload: { objectId: "plate-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelations.unfixAll"]({ payload: { objectId: "plate-a" } });
  const boundRelationNestedField = generatedPropertyBindings.bindGeneratedPropertyField?.({
    type: "statusListCard",
    actions: [{ label: "Fix remaining", action: "object.plate.sketchUnderDefined.fixRemaining", payload: { objectId: "nested-plate" } }],
    actionGroups: [{ actions: [{ label: "Select", action: "object.plate.sketchRelation.select", payload: { relationId: "nested-relation" } }] }],
    groups: [{ rows: [{ actions: [{ label: "Fix", action: "object.plate.sketchRelation.add", payload: { relation: { type: "fixed", vertexId: "v1" } } }] }] }],
    fields: [{ type: "actionRow", actions: [{ label: "Construction line", action: "object.plate.sketchConstructionLine.add", payload: { objectId: "nested-plate", from: [0, 0], to: [2, 2] } }] }]
  }, inspectorBindings.generatedObjectBindings());
  boundRelationNestedField.actions?.[0]?.onClick?.();
  boundRelationNestedField.actionGroups?.[0]?.actions?.[0]?.onClick?.();
  boundRelationNestedField.groups?.[0]?.rows?.[0]?.actions?.[0]?.onClick?.();
  boundRelationNestedField.fields?.[0]?.actions?.[0]?.onClick?.();
  inspectorBindings.generatedObjectBindings().actions["object.sketch.createPlate"]({ payload: { objectId: "sketch-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.trim.openEditor"]({ payload: { objectId: "trim-a", detail: { operationId: "trim-op-a" } } });
  const boundPrimaryActions = inspectorBindings.bindActionButtons(primaryActions);
  boundPrimaryActions.find((action) => action.action === "inspector.pickMember")?.onClick?.();
  boundPrimaryActions.find((action) => action.action === "inspector.pickSmartComponent")?.onClick?.();
  boundPrimaryActions.find((action) => action.action === "inspector.pickObject")?.onClick?.();
  const boundQuickActions = inspectorBindings.bindQuickActions([
    ...plateQuickActions,
    { action: "selection.feature.open", payload: { objectId: "feature-quick" }, label: "Feature" },
    { action: "selection.trim.open", payload: { objectId: "trim-quick", detail: { operationId: "quick-trim" } }, label: "Trim" }
  ]);
  boundQuickActions.find((action) => action.action === "selection.fit")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.smartComponent.open")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.plateRelations.toggle")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.clear")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.feature.open")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.trim.open")?.onClick?.();
  if (
    !bindingEvents.some((event) => event[0] === "parameter" && event[1] === "component-a" && event[3] === "plate.thickness" && event[4] === 12)
    || !bindingEvents.some((event) => event[0] === "selectSmartComponent" && event[1] === "component-ref")
    || !bindingEvents.some((event) => event[0] === "selectObject" && event[1] === "object-ref")
    || !bindingEvents.some((event) => event[0] === "fit" && event[1] === "fit-ref")
    || !bindingEvents.some((event) => event[0] === "toolCommand" && event[1] === "settings.snap.toggle")
    || !bindingEvents.some((event) => event[0] === "toolCycleSnap")
    || !bindingEvents.some((event) => event[0] === "toolCancel")
    || !bindingEvents.some((event) => event[0] === "toolStrength" && event[1] === "strong")
    || !bindingEvents.some((event) => event[0] === "toolScope" && event[1] === "component")
    || !bindingEvents.some((event) => event[0] === "toolTarget" && event[1] === "members" && event[2] === false)
    || !bindingEvents.some((event) => event[0] === "memberProfile" && event[1] === "member-a" && event[2] === "IPE300")
    || !bindingEvents.some((event) => event[0] === "memberMaterial" && event[1] === "member-a" && event[2] === "S275")
    || !bindingEvents.some((event) => event[0] === "memberRotation" && event[1] === "selected-member" && event[2] === 30)
    || !bindingEvents.some((event) => event[0] === "memberCenter" && event[1] === "member-a" && event[2] === 0 && event[3] === 125)
    || !bindingEvents.some((event) => event[0] === "memberEndpoint" && event[1] === "member-a" && event[2] === "end" && event[3] === 2 && event[4] === 250)
    || !bindingEvents.some((event) => event[0] === "memberCustomProfileDraft" && event[1] === "member-a" && event[2] === "0 0\n1 0\n0 1")
    || !bindingEvents.some((event) => event[0] === "memberAxis" && event[1] === "member-a" && event[2] === "z")
    || !bindingEvents.some((event) => event[0] === "memberPickAxis" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberClearAlignment" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberCreateCustomProfile" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberRemoveRelation" && event[1] === "member-a" && event[2] === "relation-a")
    || !bindingEvents.some((event) => event[0] === "reset" && event[1] === "component-a" && event[2] === "object-a")
    || !bindingEvents.some((event) => event[0] === "detach" && event[1] === "component-a" && event[2] === "object-detach")
    || !bindingEvents.some((event) => event[0] === "reattach" && event[1] === "component-a" && event[2] === "object-reattach")
    || !bindingEvents.some((event) => event[0] === "reset" && event[1] === "component-b" && event[2] === "object-bound-reset")
    || !bindingEvents.some((event) => event[0] === "detach" && event[1] === "component-b" && event[2] === "object-bound-detach")
    || !bindingEvents.some((event) => event[0] === "reattach" && event[1] === "component-b" && event[2] === "object-bound-reattach")
    || !bindingEvents.some((event) => event[0] === "workPoint" && event[1].role === 4)
    || !bindingEvents.some((event) => event[0] === "fastener" && event[1].assembly?.length === 80)
    || !bindingEvents.some((event) => event[0] === "fastener" && event[1].assembly?.washers?.head === true)
    || !bindingEvents.some((event) => event[0] === "bend" && event[1].relief?.type === "rect" && event[1].relief?.width === 5)
    || !bindingEvents.some((event) => event[0] === "removeBend" && event[1] === "bend-remove")
    || !bindingEvents.some((event) => event[0] === "inferRelations" && event[1] === "plate-a")
    || !bindingEvents.some((event) => event[0] === "trimSelect" && event[1] === "trim-op-a")
    || !bindingEvents.some((event) => event[0] === "trimType" && event[1] === "trim-op-a" && event[2] === "end-miter")
    || !bindingEvents.some((event) => event[0] === "relationValue" && event[1] === 42 && event[2].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationSelect" && event[1].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationMode" && event[1].mode === "driven")
    || !bindingEvents.some((event) => event[0] === "relationResolve" && event[1].healthStatus === "conflicted")
    || !bindingEvents.some((event) => event[0] === "relationRemove" && event[1].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationAdd" && event[1].relation?.edgeId === "e1")
    || !bindingEvents.some((event) => event[0] === "constructionLine" && event[1].from?.[0] === 0 && event[1].to?.[1] === 1)
    || !bindingEvents.some((event) => event[0] === "underDefinedFix" && event[1].objectId === "plate-a")
    || !bindingEvents.some((event) => event[0] === "relationUnfixAll" && event[1].objectId === "plate-a")
    || !bindingEvents.some((event) => event[0] === "underDefinedFix" && event[1].objectId === "nested-plate")
    || !bindingEvents.some((event) => event[0] === "relationSelect" && event[1].relationId === "nested-relation")
    || !bindingEvents.some((event) => event[0] === "relationAdd" && event[1].relation?.vertexId === "v1")
    || !bindingEvents.some((event) => event[0] === "constructionLine" && event[1].objectId === "nested-plate" && event[1].to?.[0] === 2)
    || !bindingEvents.some((event) => event[0] === "createPlate" && event[1] === "sketch-a")
    || !bindingEvents.some((event) => event[0] === "trimEditor" && event[1] === "trim-a" && event[2].operationId === "trim-op-a")
    || !boundPrimaryActions.every((action) => typeof action.onClick === "function")
    || !bindingEvents.some((event) => event[0] === "pickMember")
    || !bindingEvents.some((event) => event[0] === "pickSmartComponent")
    || !bindingEvents.some((event) => event[0] === "pickObject")
    || !boundQuickActions.every((action) => typeof action.onClick === "function")
    || !bindingEvents.some((event) => event[0] === "quickFit")
    || !bindingEvents.some((event) => event[0] === "quickComponent" && event[1] === "component-a")
    || !bindingEvents.some((event) => event[0] === "quickDetail" && event[1] === "plate-a" && event[2].clearSketchSelection === true)
    || !bindingEvents.some((event) => event[0] === "quickClear")
    || !bindingEvents.some((event) => event[0] === "quickFeature" && event[1] === "feature-quick")
    || !bindingEvents.some((event) => event[0] === "quickTrim" && event[1] === "trim-quick" && event[2].operationId === "quick-trim")
  ) {
    fail(errors, `inspector-property-bindings factory must route generated descriptor intents through supplied callbacks: ${JSON.stringify(bindingEvents)}`);
  }
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
  const viewerIndexText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/index.html"), "utf8");
  const viewerRuntimeTextForInspector = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
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
  for (const advancedOnlyCollection of ["interfaces", "connectionZones", "holePatterns"]) {
    if (primaryBrowserCollections.includes(advancedOnlyCollection)) {
      fail(errors, `Model Browser primary mode must not include advanced collection ${advancedOnlyCollection}`);
    }
    if (!advancedBrowserCollections.includes(advancedOnlyCollection)) {
      fail(errors, `Model Browser advanced mode must include advanced collection ${advancedOnlyCollection}`);
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
    || smartComponentBrowserText.includes("function kindIcon")
    || smartComponentBrowserText.includes("function actionLabel")
    || smartComponentBrowserText.includes("function actionIcon")
    || smartComponentBrowserText.includes("function statusIcon")
  ) {
    fail(errors, "Smart Component browser must be a viewer-owned bc-data-panel surface over public Smart Component APIs");
  }
  for (const field of ["title", "icon", "searchPlaceholder", "searchLabel", "emptyMessage", "itemCountLabel", "collectionLabel", "readyLabel", "statusMetaFallback", "cancelPickLabel"]) {
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
    !smartComponentBrowserText.includes("selection.beginMemberPick")
    || smartComponentBrowserMetadata.smartComponentPresetActionSpec?.("connection")?.mode !== "member-pick"
    || smartComponentBrowserMetadata.smartComponentPresetActionIcon?.({ kind: "connection" }) !== "link"
    || smartComponentBrowserMetadata.smartComponentPresetActionSpec?.("frame")?.mode !== "create"
    || smartComponentBrowserMetadata.smartComponentPresetActionIcon?.({ kind: "frame" }) !== "smart-component"
    || smartComponentBrowserMetadata.smartComponentStatusIcon?.("error") !== "cancel"
    || smartComponentBrowserMetadata.smartComponentStatusIcon?.("pick") !== "link"
  ) {
    fail(errors, "Smart Component browser must keep connection member picking and non-connection create behavior as metadata-driven preset actions");
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
    !viewerRuntimeTextForInspector.includes("leftDockResultSpecs")
    || !viewerRuntimeTextForInspector.includes("leftDockCommandItems")
    || !viewerRuntimeTextForInspector.includes("commandPaletteItems")
    || !viewerRuntimeTextForInspector.includes("projectDataPanelUi?.showRow")
    || !viewerRuntimeTextForInspector.includes("modelBrowserUi?.showObject")
    || !viewerRuntimeTextForInspector.includes("modelBrowserUi?.showCollection")
    || !viewerRuntimeTextForInspector.includes("smartComponentBrowserUi?.showPreset")
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
    || viewerRuntimeTextForInspector.includes("context.panelElementId")
    || viewerRuntimeTextForInspector.includes('getElementById("object-editor")')
    || viewerRuntimeTextForInspector.includes('getElementById("feature-editor")')
    || viewerRuntimeTextForInspector.includes('getElementById("trim-joint-editor")')
    || viewerRuntimeTextForInspector.includes('getElementById("custom-panel")')
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
    !inspectorPanelText.includes("relationStatusRowDescriptor")
    || !inspectorPanelText.includes("relationStatusListFields")
    || !inspectorPanelText.includes("selectedEntityRelationStatusFields")
    || !inspectorPanelText.includes("selectedRelationCardDescriptor")
    || !inspectorPanelText.includes("relationActionDescriptor")
    || !inspectorPanelText.includes("constructionLineActionDescriptor")
    || !inspectorPanelText.includes('id: "inspector.properties.object.plate.relations"')
    || !inspectorPanelText.includes('label: "Sketch Relations"')
    || !inspectorPanelText.includes('level: "advanced"')
    || !inspectorPanelText.includes("? [...objectSections, plateEditor(object)].filter(Boolean)")
    || !inspectorPanelText.includes("statusListCard")
    || !inspectorPanelText.includes("nestedFieldCard")
    || !inspectorPanelText.includes('type: "statusRow"')
    || !inspectorPanelText.includes('type: "actionRow"')
    || !inspectorPanelText.includes('type: "summaryCard"')
    || !inspectorPanelText.includes('type: "statusListCard"')
    || !inspectorPanelText.includes('type: "nestedFieldCard"')
    || !inspectorPanelText.includes('type: "statusGroupTitle"')
    || !inspectorPanelText.includes('action: "object.plate.sketchRelation.value.set"')
    || !inspectorPanelText.includes('action: "object.plate.sketchRelation.add"')
    || !inspectorPanelText.includes('action: "object.plate.sketchConstructionLine.add"')
    || !inspectorPanelText.includes('action: "object.plate.sketchUnderDefined.fixRemaining"')
    || !inspectorPanelText.includes('action: "object.plate.sketchRelations.unfixAll"')
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
    !inspectorPanelText.includes("inspectorPrimaryActions")
    || !inspectorPanelText.includes("inspectorSelectionQuickActions")
    || !inspectorPanelText.includes("bindActionButtons(inspectorPrimaryActions())")
    || !inspectorPanelText.includes("bindQuickActions(actions)")
    || !inspectorPanelText.includes("inspectorActionButton")
    || !inspectorPanelText.includes('"bc-button"')
    || !inspectorPanelText.includes('"bc-button-primary"')
    || !inspectorPanelText.includes('"bc-button-danger"')
    || !inspectorPanelText.includes('text("div", "bc-inspector-title", "Inspector")')
    || !inspectorPanelText.includes('actions.className = "bc-action-row"')
    || !inspectorPanelText.includes("selectionActions")
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
    fail(errors, "Inspector selection quick-action strip must use serializable metadata intents bound through inspector-property-bindings");
  }
  if (
    !inspectorPanelText.includes("generatedObjectBindings")
    || !inspectorPanelText.includes("inspectorObjectPropertySections")
    || !inspectorPanelText.includes("].filter(Boolean), generatedObjectBindings())")
    || !inspectorPropertyBindingsText.includes("objectPropertyCommitBindings")
    || !inspectorPropertyBindingsText.includes("mergeObjectPatch(commit.bend")
    || !inspectorPropertyMetadataText.includes("export function inspectorObjectPropertySections")
    || !inspectorPropertyMetadataText.includes("object.fastenerGroup.update")
    || !inspectorPropertyMetadataText.includes("object.plate.update")
    || !inspectorPropertyMetadataText.includes("object.plate.bend.update")
    || !inspectorPropertyMetadataText.includes("object.plate.bend.remove")
    || !inspectorPropertyMetadataText.includes("object.plate.relations.infer")
    || !inspectorPropertyMetadataText.includes("object.trimJoint.operation.update")
    || !inspectorPropertyMetadataText.includes("object.trimJoint.operation.select")
    || !inspectorPropertyMetadataText.includes("object.trimJoint.operation.type.set")
    || !inspectorPropertyMetadataText.includes("TRIM_OPERATION_TYPES")
    || !inspectorPropertyMetadataText.includes("trimOperationMemberEndField")
    || !inspectorPropertyMetadataText.includes("trimOperationPlaneActions")
    || !inspectorPropertyMetadataText.includes("trimOperationRegionActions")
    || !inspectorPropertyMetadataText.includes("object.feature.body.update")
    || !inspectorPropertyMetadataText.includes("object.weld.update")
    || !inspectorPropertyMetadataText.includes("object.sketch.createPlate")
    || !inspectorPropertyBindingsText.includes("object.plate.relations.infer")
    || !inspectorPropertyBindingsText.includes("object.plate.bend.remove")
    || !inspectorPropertyBindingsText.includes("object.sketch.createPlate")
    || !inspectorPropertyBindingsText.includes("objects.setTrimOperationType")
    || !inspectorPanelText.includes("setTrimOperationType(operationId, type)")
    || !inspectorPanelText.includes("trimOperationUsesMemberEnd(type")
    || !inspectorPanelText.includes("reconcilePlaneTrimRemovedRegionKeys")
    || !inspectorPanelText.includes("removePlateBend: (bendId) => updatePlate")
    || !inspectorPanelText.includes("inferPlateSketchRelations: (plateId) => inferPlateSketchRelations(plateId)")
    || !inspectorPanelText.includes("createPlateFromSketch: (sketchId) => createPlateFromSketch(sketchId)")
    || !inspectorPropertyMetadataText.includes("objectState")
    || !inspectorPropertyMetadataText.includes('collection === "sketches"')
    || !inspectorPropertyMetadataText.includes("sketchPropertiesSections")
    || inspectorPropertyMetadataText.includes("../../engine/")
    || inspectorPropertyMetadataText.includes("../engine/")
    || !inspectorPropertyMetadataText.includes("function arrayValues(value)")
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
    || !trimJointEditorPanelText.includes("trimMemberEndCommit")
    || !trimJointEditorPanelText.includes("trimEditorAction")
    || !trimJointEditorPanelText.includes('"trim.operation.update"')
    || !trimJointEditorPanelText.includes('"trim.operation.type.set"')
    || !trimJointEditorPanelText.includes('"trim.operation.memberEnd.set"')
    || !trimJointEditorPanelText.includes('"trim.plane.pick"')
    || !trimJointEditorPanelText.includes('"trim.plane.remove"')
    || !trimJointEditorPanelText.includes('"trim.region.toggle"')
    || !trimJointEditorPanelText.includes('type: "checkbox"')
    || !trimJointEditorPanelText.includes('label: "Enabled"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "enabled")')
    || !trimJointEditorPanelText.includes('type: "optionGrid"')
    || !trimJointEditorPanelText.includes('label: "Result"')
    || !trimJointEditorPanelText.includes('trimOperationTypeCommit(operation)')
    || !trimJointEditorPanelText.includes("trim-operation-metadata.mjs")
    || !trimJointEditorPanelText.includes("trimOperationIcon(option.id)")
    || trimJointEditorPanelText.includes("trimOperationIconMarkup")
    || trimJointEditorPanelText.includes("../../../rendering/trim-operation-icons.mjs")
    || !trimJointEditorPanelText.includes('type: "number"')
    || !trimJointEditorPanelText.includes('label: "Gap"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "gap")')
    || !trimJointEditorPanelText.includes('type: "segmented"')
    || !trimJointEditorPanelText.includes('label: "Miter"')
    || !trimJointEditorPanelText.includes('trimOperationCommit(operation, "miterMode")')
    || !trimJointEditorPanelText.includes('value === "profile-balanced" ? "Balanced profile" : "Equal angle"')
    || !trimJointEditorPanelText.includes('label: "End"')
    || !trimJointEditorPanelText.includes('className: "trim-member-end-segment"')
    || !trimJointEditorPanelText.includes('commit: trimMemberEndCommit(operation, member)')
    || !trimJointEditorPanelText.includes("planeTrimPlanesField")
    || !trimJointEditorPanelText.includes("planeTrimRegionsField")
    || !trimJointEditorPanelText.includes('type: "actionList"')
    || !trimJointEditorPanelText.includes('label: "Planes"')
    || !trimJointEditorPanelText.includes('label: "Regions"')
    || !trimJointEditorPanelText.includes('icon: "selection"')
    || !trimJointEditorPanelText.includes('icon: "cancel"')
    || !trimJointEditorPanelText.includes('{ label: "Trim", value: model.id }')
    || !trimJointEditorPanelText.includes('{ label: "Cuts", value: String(model.totalOperations) }')
    || !trimJointEditorPanelText.includes('{ label: "Members", value: String(model.participants.length) }')
  ) {
    fail(errors, "Trim Editor must render overview, result, plane/region, enabled, gap, miter, and member-end rows through generated field descriptors bound at the panel edge");
  }
  for (const localFieldBuilder of ["checkboxControl", "numericControl", "readout(", "miterModePicker", "onMiterModeChange", "trimTypePicker", "trimTypeIcon", "trimOptionGroup", "endToggle", "onEndChange", 'field("Result"', 'field("Planes"', 'field("Regions"', 'button("Pick Plane"', "trim-region-button", "trim-plane-list", "trim-plane-chip", "trim-member-end-toggle", "trim-end-option", "onTypeChange", "onPlanePick", "onPlaneRemove", "onRegionToggle"]) {
    if (trimJointEditorPanelText.includes(localFieldBuilder)) {
      fail(errors, `Trim Editor must not privately build generated-compatible overview/result/plane/region/enabled/gap/miter/member-end rows with ${localFieldBuilder}`);
    }
  }
  if (viewerEditorPanelsText.includes(".trim-type-grid") || viewerEditorPanelsText.includes(".trim-type-button") || viewerEditorPanelsText.includes(".trim-type-label") || viewerEditorPanelsText.includes(".trim-plane-list") || viewerEditorPanelsText.includes(".trim-region-list") || viewerEditorPanelsText.includes(".trim-plane-chip") || viewerEditorPanelsText.includes(".trim-plane-name") || viewerEditorPanelsText.includes(".trim-region-button") || viewerEditorPanelsText.includes(".trim-member-end-toggle") || viewerEditorPanelsText.includes(".trim-end-option")) {
    fail(errors, "Trim result, plane/region action, and member-end segmented styling must live in shared generated design-system recipes, not Trim-specific CSS");
  }
  if (!viewerEditorPanelsText.includes(".trim-member-picker .bc-segmented-field")) {
    fail(errors, "Trim Editor member picker may only keep a small layout adapter for generated member-end segmented fields");
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
    || !trimJointEditorPanelText.includes("memberColor(api, member.id, TRIM_MEMBER_SWATCH_FALLBACK)")
  ) {
    fail(errors, "Trim Editor member swatches must use design-token fallback colors instead of hardcoded UI hex values");
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
  if (!viewerRuntimeTextForInspector.includes("editorApi?.refresh?.()") || !viewerRuntimeTextForInspector.includes("editorApi?.clearSelection?.({ silent: true })")) {
    fail(errors, "Viewer runtime must refresh the Inspector and clear stale selection when active modeling command state changes");
  }
  if (
    !viewerRuntimeTextForInspector.includes("function showInspectorProperties")
    || !viewerRuntimeTextForInspector.includes("if (activeCommandId) showInspectorProperties()")
    || !viewerRuntimeTextForInspector.includes("showInspectorProperties();")
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
  const viewerRuntimeDataText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
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
    || !viewerRuntimeDataText.includes("projectFilesPanelUi?.showRow?.(action.rowId)")
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
    || !viewerRuntimeDataText.includes("legacyActiveTabStorageKey: INSPECTOR_ACTIVE_CONTEXT_STORAGE_KEY")
  ) {
    fail(errors, "Viewer runtime must derive Inspector Dock contexts and legacy active-tab migration from inspector-dock-metadata");
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
    { id: "settings.visibility.fasteners.toggle", renderVisibilityKey: "fasteners", label: "Fasteners", icon: "fastener", settingsStripOrder: 2 }
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
  const viewerRuntimeText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
  const viewerSettingsStripText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.mjs"), "utf8");
  const viewerSettingsStripCssText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-settings-strip.css"), "utf8");
  const sceneGeometryBuilderText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/scene-geometry-builder.mjs"), "utf8");
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
    !viewerRuntimeText.includes("GRID_CREATE_DISABLED_REASON")
    || !viewerRuntimeText.includes("plannedModelCommandState(command)")
    || !viewerRuntimeText.includes('command.id !== "model.grid.create"')
    || !viewerRuntimeText.includes("enabled: false")
    || !viewerRuntimeText.includes("disabledReason: GRID_CREATE_DISABLED_REASON")
    || viewerRuntimeText.includes("Grid creator is not wired yet.")
  ) {
    fail(errors, "Viewer runtime must expose planned Grid creation as a disabled command state instead of a runnable placeholder");
  }
  if (!viewerRuntimeText.includes("...snapScopeCommandHandlers") || !viewerRuntimeText.includes("...snapTargetCommandHandlers")) {
    fail(errors, "Viewer runtime must register selection scope and snap target command handlers");
  }
  if (
    !viewerRuntimeText.includes("renderVisibilityCommandState(command)")
    || !viewerRuntimeText.includes("toggleRenderVisibilityCommand")
    || !viewerRuntimeText.includes('settings.visibility.cuts.toggle')
    || !viewerRuntimeText.includes('settings.visibility.fasteners.toggle')
    || !viewerRuntimeText.includes('settings.visibility.planes.toggle')
    || !viewerRuntimeText.includes("renderVisibilitySettings()[key] = nextVisible")
    || !viewerRuntimeText.includes("rerender(api.project())")
    || !viewerRuntimeText.includes("...renderVisibilityCommandHandlers")
  ) {
    fail(errors, "Viewer runtime must expose settings-strip render visibility state and handlers for cutting objects, fasteners, and reference planes");
  }
  if (
    !sceneGeometryBuilderText.includes('return renderVisibilityEnabled("cuttingObjects");')
    || !sceneGeometryBuilderText.includes('return renderVisibilityEnabled("fasteners");')
    || !sceneGeometryBuilderText.includes('return renderVisibilityEnabled("referencePlanes");')
    || !sceneGeometryBuilderText.includes('operation.type === "plane-trim" && renderReferencePlanes')
    || !sceneGeometryBuilderText.includes("if (renderCuttingObjects) {")
    || !sceneGeometryBuilderText.includes("if (shouldRenderCuttingObjects()) {")
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
    || !viewerRuntimeText.includes("legacyActiveTabStorageKey: DATA_DOCK_LEGACY_TAB_STORAGE_KEY")
  ) {
    fail(errors, "Viewer runtime must derive Data Dock tabs from workspace-normalized metadata and preserve legacy active-tab migration");
  }
  if (viewerRuntimeText.includes("storageKey: DATA_DOCK_LEGACY_TAB_STORAGE_KEY")) {
    fail(errors, "Viewer runtime must not pass the legacy Data Dock active-tab key into dock-tabs; legacy tab storage is migration-only");
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
  if (!viewerRuntimeText.includes("commands: () => viewerCommandItems()") || !viewerRuntimeText.includes("workspace: defaultWorkspace?.viewerSettingsStrip") || !viewerRuntimeText.includes("viewerSettingsUi?.setWorkspace?.(workspace?.viewerSettingsStrip)") || !viewerRuntimeText.includes("orientation: viewOrientation") || !viewerRuntimeText.includes("onOrientationChange") || !viewerRuntimeText.includes("viewerSettingsUi?.setOrientation?.(viewOrientation)")) {
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
    "--bc-shell-toolbar-max-height-offset:",
    "--bc-shell-toolbar-available-height:",
    "--bc-shell-dock-top-offset:",
    "--bc-shell-dock-top-offset-mobile:",
    "--bc-shell-dock-screen-margin:",
    "--bc-shell-floating-dock-screen-margin:",
    "--bc-shell-floating-dock-height:",
    "--bc-shell-floating-dock-max-height:",
    "--bc-shell-floating-dock-top-offset:",
    "--bc-shell-floating-dock-tall-height:",
    "--bc-shell-inspector-wide-min-width:",
    "--bc-nav-cube-toolbar-clearance:",
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
    "max-height: var(--bc-shell-toolbar-available-height)",
    "top: var(--bc-shell-dock-top-offset)",
    "bottom: var(--bc-statusbar-height)",
    "calc(100vw - var(--bc-shell-dock-screen-margin))",
    "calc(100vw - var(--bc-shell-floating-dock-screen-margin))",
    "height: var(--bc-shell-floating-dock-height)",
    "max-height: var(--bc-shell-floating-dock-max-height)",
    "top: var(--bc-shell-floating-dock-top-offset)",
    "height: var(--bc-shell-floating-dock-tall-height)",
    "var(--bc-shell-inspector-wide-min-width)",
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
    "var(--bc-nav-cube-toolbar-clearance)",
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
  const workspaceCustomizerText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/workspace-customizer-panel.mjs"), "utf8");
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
    "toolbarDragHandleControl",
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
    !uiElementsText.includes('className: "bc-toolbar-drag-handle"')
    || !uiElementsText.includes('className: "bc-dock-resize-handle"')
    || !uiElementsText.includes('className: "bc-dock-reveal-toggle"')
    || !uiElementsText.includes('className: "bc-dock-pin-toggle"')
    || !uiElementsText.includes('item.className = "bc-toolbar-overflow-item"')
    || !uiElementsText.includes('iconNode.className = "bc-toolbar-overflow-icon"')
    || !uiElementsText.includes('copy.className = "bc-toolbar-overflow-copy"')
    || !uiElementsText.includes('labelNode.className = "bc-toolbar-overflow-label"')
    || !uiElementsText.includes('descriptionNode.className = "bc-toolbar-overflow-description"')
    || workspaceCustomizerText.includes('className = "bc-toolbar-drag-handle"')
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
    fail(errors, "Toolbar drag, dock resize, reveal, pin, and overflow shell controls must inherit shared design-system chrome primitives");
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
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-dock-options"')
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-segment-options"')
    || !workspaceCustomizerText.includes('className: "bc-workspace-customizer-panel-dock-options"')
    || workspaceCustomizerText.includes('className = "bc-segment-button"')
    || /(^|\n)\s*\.bc-segment-button\b/.test(workspaceCustomizerCssText)
  ) {
    fail(errors, "Workspace customizer theme, density, toolbar dock, and panel dock choices must use shared segmentedControl without owning global bc-segment-button CSS");
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
    || !workspaceShellText.includes('[data-inspector-context-panel="trim"]')
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
  if (!viewerRuntimeText.includes("visibleFeatureNavbarGroups") || !viewerRuntimeText.includes("groups: featureNavbarGroups")) {
    fail(errors, "Viewer runtime must pass workspace-driven feature navbar groups into mountFeatureNavbar");
  }
  if (!viewerRuntimeText.includes("featureNavbar?.refresh?.()")) {
    fail(errors, "Viewer runtime must refresh the feature navbar when workspace navigation state changes");
  }
  for (const [relative, token] of [
    ["bobercad/app/ui/shell/status-bar.mjs", "BOTTOM_STRIP_DEFAULT_ITEM_IDS"],
    ["bobercad/app/ui/shell/workspace-customizer-panel.mjs", "BOTTOM_STRIP_ITEM_SPECS"],
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
  const workspaceCustomizerTextForBottomStrip = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/shell/workspace-customizer-panel.mjs"), "utf8");
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
  const viewerRuntimeTextForSnapControls = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
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

function checkFolderRegister(errors, registerRelative, key) {
  const registerPath = path.join(ROOT, registerRelative);
  const register = readJson(registerRelative);
  for (const item of register[key] || []) {
    const target = path.resolve(path.dirname(registerPath), item);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      fail(errors, `${registerRelative}: registered folder does not exist: ${item}`);
    }
  }
}

function checkSmartComponentFolders(errors) {
  const registerRelative = "bobercad/data/libraries/smart-components/smart-component-register.json";
  const registerPath = path.join(ROOT, registerRelative);
  const register = readJson(registerRelative);
  if (typeof register.libraryUi !== "string") {
    fail(errors, `${registerRelative}: missing libraryUi`);
  } else {
    const libraryUiPath = path.resolve(path.dirname(registerPath), register.libraryUi);
    if (!fs.existsSync(libraryUiPath) || !fs.statSync(libraryUiPath).isFile()) {
      fail(errors, `${registerRelative}: libraryUi file does not exist: ${register.libraryUi}`);
    }
  }
  for (const item of register.components || []) {
    const folder = path.resolve(path.dirname(registerPath), item);
    for (const fileName of ["config.json"]) {
      const filePath = path.join(folder, fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(errors, `${registerRelative}: ${item} missing ${fileName}`);
      }
    }
    const definition = JSON.parse(fs.readFileSync(path.join(folder, "config.json"), "utf8"));
    if (!definition.kind) fail(errors, `${registerRelative}: ${item} must declare kind`);
    const buildPath = path.join(folder, "build.mjs");
    if ((!Array.isArray(definition.recipe) || !definition.recipe.length) && (!fs.existsSync(buildPath) || !fs.statSync(buildPath).isFile())) {
      fail(errors, `${registerRelative}: ${item} must declare a recipe or build.mjs`);
    }
    if (Object.hasOwn(definition, "componentRefs")) fail(errors, `${registerRelative}: ${item} must not declare componentRefs`);
    const normalizedItem = item.replaceAll("\\", "/");
    if (definition.kind === "connection" && !normalizedItem.includes("/connections/")) {
      fail(errors, `${registerRelative}: connection Smart Component should live under components/connections: ${item}`);
    }
    if (item.endsWith("fin-plate")) {
      if (definition.parameters?.["holes.memberDepth"]) {
        fail(errors, `${item}: fin plate should not expose member hole depth as a user parameter`);
      }
      if (JSON.stringify(definition.ui || {}).includes("holes.memberDepth")) {
        fail(errors, `${item}: fin plate UI should not expose member hole depth`);
      }
      if ((definition.dimensions || []).some((entry) => entry.parameter === "holes.memberDepth")) {
        fail(errors, `${item}: fin plate dimensions should not show member hole depth`);
      }
    }
  }
}

async function checkSmartComponentQuickProperties(errors) {
  const parameterValuesPath = path.join(ROOT, "bobercad/data/libraries/smart-components/parameter-values.mjs");
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
  if (!inspectorText.includes("uiQuickParameterEntries(definition")) {
    fail(errors, "Smart Component quick properties: Inspector must generate quick fields from definition.ui order");
  }
  if (!inspectorText.includes("parameterFieldDescriptor(definition")) {
    fail(errors, "Smart Component quick properties: Inspector must render quick fields through parameterFieldDescriptor");
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
  const smartComponentParameterUiText = fs.readFileSync(path.join(ROOT, "bobercad/data/libraries/smart-components/smart-component-parameter-ui.mjs"), "utf8");
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

function checkViewerHasNoDomainFiles(errors) {
  const viewerDir = path.join(ROOT, "bobercad/app/ui/viewer");
  if (!fs.existsSync(viewerDir)) return;
  for (const file of walk(viewerDir)) {
    const name = path.basename(file);
    if (FORBIDDEN_VIEWER_FILE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      fail(errors, `domain-specific viewer file should live in data libraries, not app UI: ${path.relative(ROOT, file)}`);
    }
  }
}

function checkProjectJsonIsolation(errors, relative, project) {
  const visit = (value, pathSegments = []) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...pathSegments, String(index)]));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...pathSegments, key];
      const location = childPath.join(".");
      if (key === "schema" && typeof child === "string" && PROJECT_UI_SCHEMA_VALUES.has(child)) {
        fail(errors, `${relative}: project JSON must not embed UI/viewer schema value at ${location}: ${child}`);
      }
      if (
        key === "$schema"
        && typeof child === "string"
        && PROJECT_UI_SCHEMA_SUFFIXES.some((suffix) => child.replaceAll("\\", "/").endsWith(suffix))
      ) {
        fail(errors, `${relative}: project JSON must not reference UI/viewer schema at ${location}: ${child}`);
      }
      if (
        PROJECT_UI_CONFIG_KEYS.has(key)
        && (pathSegments.length === 0 || pathSegments[0] === "settings")
      ) {
        fail(errors, `${relative}: project JSON must not store UI/viewer preference key at ${location}`);
      }
      if (PROJECT_GENERATED_CACHE_KEYS.has(key)) {
        fail(errors, `${relative}: project JSON must not store generated/runtime cache key at ${location}`);
      }
      if (key === "vertices") {
        if (childPath.slice(-2).join(".") !== "sketch.vertices") {
          fail(errors, `${relative}: project JSON must not store vertices outside semantic sketch source geometry at ${location}`);
        }
      } else if (PROJECT_MESH_PAYLOAD_KEYS.has(key)) {
        fail(errors, `${relative}: project JSON must not store mesh/render payload key at ${location}`);
      }
      visit(child, childPath);
    }
  };
  visit(project);
}

function checkProjectFiles(errors) {
  const projectsDir = path.join(ROOT, "bobercad/data/projects");
  if (!fs.existsSync(projectsDir)) return;

  for (const name of fs.readdirSync(projectsDir).filter((item) => item.endsWith(".json")).sort()) {
    const relative = `bobercad/data/projects/${name}`;
    let project;
    try {
      project = readJson(relative);
    } catch (error) {
      fail(errors, `invalid project JSON: ${relative}: ${error.message}`);
      continue;
    }
    checkProjectJsonIsolation(errors, relative, project);

    const model = project.model || {};
    if (model.patterns) fail(errors, `${relative}: use model.holePatterns, not model.patterns`);

    for (const [objectId, entry] of Object.entries(project.objectIndex || {})) {
      const collection = entry.collection;
      if (collection === "patterns") {
        fail(errors, `${relative}: objectIndex.${objectId} still points to old patterns collection`);
        continue;
      }
      if (!model[collection]) {
        fail(errors, `${relative}: objectIndex.${objectId} points to missing collection ${collection}`);
        continue;
      }
      if (!model[collection][objectId]) {
        fail(errors, `${relative}: objectIndex.${objectId} does not match model.${collection}`);
      }
    }

    if (model.connections) fail(errors, `${relative}: use model.smartComponentInstances, not model.connections`);

    for (const smartComponent of Object.values(model.smartComponentInstances || {})) {
      if (smartComponent.sourcePreset || smartComponent.manualParts || smartComponent.generator) {
        fail(errors, `${relative}: ${smartComponent.id} still has old connection generator fields`);
      }
      const zoneId = smartComponent.inputs?.connectionZoneId;
      const assemblyId = smartComponent.inputs?.assemblyId;
      if (!zoneId || !assemblyId) continue;
      const zone = model.connectionZones?.[zoneId];
      const assembly = model.assemblies?.[assemblyId];
      if (!zone) {
        fail(errors, `${relative}: ${smartComponent.id} points to missing connection zone ${zoneId}`);
        continue;
      }
      if (!assembly) {
        fail(errors, `${relative}: ${smartComponent.id} points to missing assembly ${assemblyId}`);
        continue;
      }
      if (!(assembly.connectionZoneIds || []).includes(zoneId)) {
        fail(errors, `${relative}: ${assemblyId} must list connectionZoneIds entry ${zoneId}`);
      }
      if (!(zone.smartComponentInstanceIds || []).includes(smartComponent.id)) {
        fail(errors, `${relative}: ${zoneId} must list smartComponentInstanceIds entry ${smartComponent.id}`);
      }
      if (!(assembly.smartComponentInstanceIds || []).includes(smartComponent.id)) {
        fail(errors, `${relative}: ${assemblyId} must list smartComponentInstanceIds entry ${smartComponent.id}`);
      }
    }
  }
}

function checkViewerSettingsSnapApi(errors) {
  const settingsRelative = "bobercad/app/ui/viewer/viewer-settings.json";
  const schemaRelative = "bobercad/app/schemas/viewer-settings.schema.json";
  const settings = readJson(settingsRelative);
  const settingsText = fs.readFileSync(path.join(ROOT, settingsRelative), "utf8");
  const schemaText = fs.readFileSync(path.join(ROOT, schemaRelative), "utf8");
  const viewerMainText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/viewer-runtime.mjs"), "utf8");
  const plateCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/plate-create-controller.mjs"), "utf8");
  const plateSketchEditText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/plate-sketch-drag-edit-controller.mjs"), "utf8");
  const modelingToolbarText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs"), "utf8");
  const snapSettingsControlText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/controls/snap-settings-control.mjs"), "utf8");
  if (
    !modelingToolbarText.includes('commandGroup.dataset.workspaceToolbarGroup = "model"')
    || !modelingToolbarText.includes('settingsGroup.dataset.fixedToolbarGroup = "snap-settings"')
    || !modelingToolbarText.includes('commandGroup.setAttribute("aria-label", "Model toolbar commands")')
    || !modelingToolbarText.includes('settingsGroup.setAttribute("aria-label", "Snap and relation settings")')
  ) {
    fail(errors, "Modeling toolbar must mark workspace-managed commands separately from fixed snap/relation settings");
  }
  const snapMetadataText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/commands/snap-metadata.mjs"), "utf8");
  const sketchCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/sketch-create-controller.mjs"), "utf8");
  const workPlaneCreateText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/work-plane-controller.mjs"), "utf8");
  const memberOverlaysText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/scene/authoring/member-overlays.mjs"), "utf8");
  const snapOverlaysPath = path.join(ROOT, "bobercad/app/rendering/scene/authoring/snap-overlays.mjs");
  const snapOverlaysText = fs.existsSync(snapOverlaysPath) ? fs.readFileSync(snapOverlaysPath, "utf8") : "";
  const qaConnectionCaptureText = fs.readFileSync(path.join(ROOT, "tools/qa/capture_connection_views.mjs"), "utf8");
  const stressMemberDragText = fs.readFileSync(path.join(ROOT, "tools/stress/interactive_member_drag.mjs"), "utf8");
  const apiRegisterText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/api-register.json"), "utf8");
  const snapSolverText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/interaction/snap-solver.mjs"), "utf8");
  const snapProvidersText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/snap-candidate-providers.mjs"), "utf8");
  const selectionControllerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/selection-controller.mjs"), "utf8");
  const webglRendererText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs"), "utf8");
  for (const token of [
    "front: [1, 0, 0]",
    "back: [-1, 0, 0]",
    "right: [0, -1, 0]",
    "left: [0, 1, 0]",
    "top: [0, 0, -1]",
    "bottom: [0, 0, 1]"
  ]) {
    if (!webglRendererText.includes(token)) {
      fail(errors, `viewer orientation camera directions must look from the named nav-cube face toward the model: ${token}`);
    }
  }
  if (
    settings.render?.visibility?.cuttingObjects !== true
    || settings.render?.visibility?.fasteners !== true
    || settings.render?.visibility?.referencePlanes !== true
  ) {
    fail(errors, "viewer settings render visibility: cuttingObjects, fasteners, and referencePlanes must default to visible");
  }
  if (!schemaText.includes('"visibility"') || !schemaText.includes('"cuttingObjects"') || !schemaText.includes('"fasteners"') || !schemaText.includes('"referencePlanes"')) {
    fail(errors, "viewer settings schema must define render.visibility cuttingObjects/fasteners/referencePlanes");
  }
  const deadSnapSettings = [
    "pointSnapBiasPx",
    "intersectionSnapBiasPx",
    "faceAxisSnapBiasPx",
    "multiSnapTolerancePx",
    "startAxisIntersectionBiasPx",
    "startAxisSnapBiasPx",
    "profileAxisSnapBiasPx",
    "globalAxisSnapTolerancePx",
    "profileAxisSnapTolerancePx",
    "profileAxisSnapSpan",
    "creationAxisSnapTolerancePx",
    "creationAxisSnapSpan",
    "activeReferenceAxisSnapTolerancePx",
    "compositeSnapTolerancePx",
    "plateSketchEdgeSnapTolerancePx",
    "plateSketchVertexSnapTolerancePx",
    "plateSketchAngleSnapTolerancePx",
    "snapTolerancePx",
    "plateSketchGridSteps",
    "plateSketchGridMinScreenPx",
    "plateSketchCreateGridMaxStep",
    "plateSketchEdgeGridMaxStep",
    "plateSketchVertexGridMaxStep",
    "plateSketchRelationGridMaxStep",
    "plateSketchNotchGridMaxStep",
    "plateSketchEdgeSnapMaxWorld",
    "plateSketchVertexRelationSnapMaxWorld",
    "plateSketchVertexAngleSnapMaxWorld",
    "plateSketchVertexEqualLengthSnapMaxWorld"
  ];
  for (const name of deadSnapSettings) {
    if (settingsText.includes(`"${name}"`) || schemaText.includes(`"${name}"`)) {
      fail(errors, `viewer settings snap api: legacy snap setting should not exist: ${name}`);
    }
  }
  const snap = settings.authoring?.snap || {};
  const memberCreateShortcuts = settings.shortcuts?.memberCreate || {};
  if (snap.cycleKey !== "Tab" || memberCreateShortcuts.cycleSnap !== snap.cycleKey) {
    fail(errors, `viewer settings snap api: snap cycling must use the central cycle key, got snap=${snap.cycleKey} memberCreate=${memberCreateShortcuts.cycleSnap}`);
  }
  if (memberCreateShortcuts.toggleAxisGuideMode !== "Shift+Tab") {
    fail(errors, `viewer settings snap api: member axis guide toggle should stay on Shift+Tab, got ${memberCreateShortcuts.toggleAxisGuideMode}`);
  }
  if (snap.scope?.welds !== false || snap.scope?.trimJoints !== false) {
    fail(errors, "viewer settings snap api: inactive weld/trim scopes should default off until they have real snap providers");
  }
  if (snap.profiles?.normal?.includeSurfaceTargets !== "faces") {
    fail(errors, `viewer settings snap api: normal snapping must include member faces, face centers, edges, edge midpoints, and corners; got ${snap.profiles?.normal?.includeSurfaceTargets}`);
  }
  if (snap.profiles?.normal?.gridMaxSteps?.fine !== 1 || snap.profiles?.normal?.gridMaxSteps?.micro !== 0.5) {
    fail(errors, `viewer settings snap api: plate/detail grid limits must live in normal snap profile gridMaxSteps, got ${JSON.stringify(snap.profiles?.normal?.gridMaxSteps)}`);
  }
  if (!Number.isFinite(snap.profiles?.normal?.projectionBiasPx) || !schemaText.includes("\"projectionBiasPx\"")) {
    fail(errors, "viewer settings snap api: projection bias must be a schema-backed central snap profile value");
  }
  if (!Number.isInteger(snap.profiles?.normal?.maxIntersectionSources) || !schemaText.includes("\"maxIntersectionSources\"")) {
    fail(errors, "viewer settings snap api: intersection source limits must be schema-backed central snap profile values");
  }
  if (snap.profiles?.normal?.sketchWorldTolerance?.edge !== 10 || snap.profiles?.normal?.sketchWorldTolerance?.equalLength !== 20) {
    fail(errors, `viewer settings snap api: sketch relation world tolerances must live in normal snap profile, got ${JSON.stringify(snap.profiles?.normal?.sketchWorldTolerance)}`);
  }
  for (const key of ["members", "plates", "features", "fasteners", "activeSketch", "selectedObjectsOnly", "currentSmartComponentOnly"]) {
    if (!snapMetadataText.includes(`key: "${key}"`)) {
      fail(errors, `viewer settings snap api: snap metadata must expose scope filter ${key}`);
    }
  }
  if (
    !modelingToolbarText.includes("snap-settings-control.mjs")
    || !modelingToolbarText.includes("createSnapSettingsControl")
    || !snapSettingsControlText.includes("SNAP_TARGET_SPECS")
    || !snapSettingsControlText.includes("snap-metadata.mjs")
  ) {
    fail(errors, "viewer settings snap api: snap manager toolbar must render visible targets through the shared snap settings control");
  }
  if (!viewerMainText.includes("Object.defineProperty(window, \"__boberCadQa\"") || !viewerMainText.includes("dataset.qaApiReady") || !viewerMainText.includes("bobercad:qa-request") || !viewerMainText.includes("qaSnapSmoke")) {
    fail(errors, "viewer settings snap api: QA API must expose a stable window contract, DOM ready marker, DOM request bridge, and startup snap smoke");
  }
  if (!viewerMainText.includes("diagnostics: (result.diagnostics || []).slice")) {
    fail(errors, "viewer settings snap api: QA snap diagnostics must expose bounded candidate diagnostic details");
  }
  if (!plateCreateText.includes("adaptiveGrid: plateCreateAdaptiveGrid") || !snapProvidersText.includes("function addAdaptiveGridCandidates") || !snapProvidersText.includes("providerId: \"precision.adaptiveGrid\"")) {
    fail(errors, "viewer settings snap api: adaptive grid snapping must flow through snap-providers via context.adaptiveGrid");
  }
  if (!sketchCreateText.includes("snapManager?.point") || !workPlaneCreateText.includes("snapManager?.point")) {
    fail(errors, "viewer settings snap api: sketch and workplane creation must resolve points through the central snap manager");
  }
  if (qaConnectionCaptureText.includes("connectionSummaries") || qaConnectionCaptureText.includes("captureConnectionView") || stressMemberDragText.includes("memberConnectionPoints")) {
    fail(errors, "viewer settings snap api: QA/stress tools must use smart component API names, not legacy connection-only aliases");
  }
  if (apiRegisterText.includes("project.nearestSnapPoint") || snapSolverText.includes("nearestSnapPoint")) {
    fail(errors, "viewer settings snap api: nearestSnapPoint must not remain as a public parallel snap route");
  }
  const snapManagerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/snap-manager.mjs"), "utf8");
  if (snapManagerText.includes("resolveSnapPoint")) {
    fail(errors, "viewer settings snap api: snap-manager must not expose one-off resolveSnapPoint outside the shared selection-scoped manager");
  }
  if (snapManagerText.includes("extraCandidates") || snapProvidersText.includes("extraCandidates") || viewerMainText.includes("extraCandidates") || plateCreateText.includes("extraCandidates")) {
    fail(errors, "viewer settings snap api: extraCandidates must not remain as a public snap route; use provider context instead");
  }
  if (!snapSolverText.includes("planeHit(") || !snapSolverText.includes("projectionPriorityBiasPx") || !snapSolverText.includes("function biasedDistance") || !snapSolverText.includes("intersectionSourceLimit") || !snapManagerText.includes("projectionPriorityBiasPx: activeProfile.projectionBiasPx") || !snapManagerText.includes("maxIntersectionSources: activeProfile.maxIntersectionSources") || !snapProvidersText.includes("type: \"member-profile-face\"") || !snapProvidersText.includes("kind: \"plane\"")) {
    fail(errors, "viewer settings snap api: member faces must be first-class plane snap candidates through the shared solver/provider path");
  }
  if (!snapSolverText.includes("allowIntersections === false") || !snapProvidersText.includes("type: \"member-profile-face-centerline\"") || !snapProvidersText.includes("allowIntersections: false")) {
    fail(errors, "viewer settings snap api: member surface snap lines must not generate noisy automatic intersection snaps");
  }
  if (!snapProvidersText.includes("function addActiveSketchCandidates") || !snapProvidersText.includes("providerId: \"sketch.active\"") || !snapProvidersText.includes("\"activeSketch\"")) {
    fail(errors, "viewer settings snap api: active sketch snap candidates must be normalized by snap-providers, not by a tool controller");
  }
  if (plateSketchEditText.includes("providerId: \"sketch.active\"") || plateSketchEditText.includes("extraCandidates: localCandidates")) {
    fail(errors, "viewer settings snap api: plate sketch edit controller must route local sketch candidates through context.activeSketch, not extraCandidates");
  }
  if (!snapOverlaysText.includes("export function snapPointOverlay") || !snapOverlaysText.includes("export function snapAxisSourceLines")) {
    fail(errors, "viewer settings snap api: snap marker, label, link, and source guide overlays must share snap-overlays.mjs");
  }
  if (!memberOverlaysText.includes("snapPointOverlay") || !plateSketchEditText.includes("snapPointOverlay")) {
    fail(errors, "viewer settings snap api: member, plate creation, and focused plate sketch overlays must use the shared snap overlay primitive");
  }
  if (memberOverlaysText.includes("plate-create-model-snap-link") || memberOverlaysText.includes("plate-model-snap") || plateSketchEditText.includes("plate-sketch-snap-link") || plateSketchEditText.includes("kind: \"plate-sketch-snap\"")) {
    fail(errors, "viewer settings snap api: per-tool snap overlay marker names should not replace the shared snap overlay primitive");
  }
  if (!snapSolverText.includes("candidateId(") || !snapSolverText.includes("snapDiagnostic(") || !snapSolverText.includes("selected by rank/cycle")) {
    fail(errors, "viewer settings snap api: snap solver must return sorted candidate diagnostics with stable ids and reasons");
  }
  if (!selectionControllerText.includes("scopeManager.pickOptions") || !selectionControllerText.includes("collection: \"members\"") || !selectionControllerText.includes("objectIdsForScope")) {
    fail(errors, "viewer settings snap api: selection controller must feed shared scope filters into renderer picking");
  }
  if (!webglRendererText.includes("pickHandlerOptions") || !webglRendererText.includes("const filteredPick = Boolean(options.objectIds || options.componentKind)") || !webglRendererText.includes("pickScene(x, y, pickHandlerOptions)")) {
    fail(errors, "viewer settings snap api: renderer picking must apply selection scope filters before hit testing filtered picks");
  }
}

function emptyGeneratedSmartComponentModel(project) {
  const next = clone(project);
  for (const collection of ["groups", "interfaces", "connectionZones", "assemblies", "plates", "sketches", "holePatterns", "objectPatterns", "features", "fastenerGroups", "welds", "relations", "smartComponentInstances"]) {
    next.model[collection] = {};
  }
  next.objectIndex = {};
  for (const memberId of ["column_1", "beam_1"]) {
    next.objectIndex[memberId] = { collection: "members", type: next.model.members[memberId].type };
    delete next.model.members[memberId].assemblyId;
    next.model.members[memberId].featureIds = [];
  }
  next.model.members.beam_1.layoutAxis = {
    start: [0, 0, 1500],
    end: [2300, 0, 1500],
    notes: "Virtual authoring axis stays on the column grid while the physical beam starts at the column face."
  };
  return next;
}

function assertNoObjects(errors, project, collection, scope) {
  const ids = Object.keys(project.model[collection] || {});
  if (ids.length) fail(errors, `${scope}: expected no ${collection}, found ${ids.join(", ")}`);
}

async function withFileFetch(callback) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = typeof url === "string" ? url : url?.href;
    if (target?.startsWith("file:")) {
      return {
        ok: true,
        json: async () => JSON.parse(fs.readFileSync(fileURLToPath(target), "utf8"))
      };
    }
    if (previousFetch) return previousFetch(url);
    throw new Error(`unsupported fetch URL ${target}`);
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function checkAutoSmartComponentLifecycle(errors) {
  await withFileFetch(async () => {
    const { loadSmartComponentDefinitions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/modules/smart-components/smart-component-registry.mjs")).href);
    const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/store/project-command-store.mjs")).href);
    const { buildSmartComponentDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/annotations/build-dimensions.mjs")).href);
    const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/scene-geometry-builder.mjs")).href);

    const baseProject = readJson("bobercad/data/projects/sample_beam_to_column_fin_plate.json");
    const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
    const profiles = profilesLibrary.profiles;
    const fasteners = readJson("bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json");
    const materials = readJson("bobercad/data/libraries/materials/material-libraries/starter-materials/config.json");
    const viewerSettings = readJson("bobercad/app/ui/viewer/viewer-settings.json");
    const smartComponentCatalog = await loadSmartComponentDefinitions();
    const sceneHasObject = (scene, objectId, predicate = () => true) => [...scene.faces, ...scene.lines].some((item) => item.objectId === objectId && predicate(item));
    const sceneVisibilityCounts = (scene) => ({
      cutObjects: [...scene.faces, ...scene.lines].filter((item) => item.collection === "features").length,
      fasteners: [...scene.faces, ...scene.lines].filter((item) => item.collection === "fastenerGroups").length,
      planeMarkers: scene.lines.filter((item) => item.referencePlaneId).length,
      trimCallouts: scene.callouts.filter((item) => item.collection === "trimJoints").length,
      trimHandles: scene.lines.filter((item) => item.componentKind === "trim-operation" && !item.referencePlaneId).length
    });

    const booleanTrimProject = readJson("bobercad/data/projects/sample_boolean_beam.json");
    const visibleScene = buildScene(booleanTrimProject, profilesLibrary, fasteners, viewerSettings);
    const hiddenCutSettings = clone(viewerSettings);
    hiddenCutSettings.render.visibility.cuttingObjects = false;
    const hiddenCutScene = buildScene(booleanTrimProject, profilesLibrary, fasteners, hiddenCutSettings);
    const hiddenPlaneSettings = clone(viewerSettings);
    hiddenPlaneSettings.render.visibility.referencePlanes = false;
    const hiddenPlaneScene = buildScene(booleanTrimProject, profilesLibrary, fasteners, hiddenPlaneSettings);
    const visibleCounts = sceneVisibilityCounts(visibleScene);
    const hiddenCutCounts = sceneVisibilityCounts(hiddenCutScene);
    const hiddenPlaneCounts = sceneVisibilityCounts(hiddenPlaneScene);
    if (visibleCounts.cutObjects <= 0 || visibleCounts.planeMarkers <= 0 || visibleCounts.trimCallouts <= 0 || visibleCounts.trimHandles <= 0) {
      fail(errors, `Scene render visibility: sample_boolean_beam must expose cut objects, plane markers, trim callouts, and trim handles, got ${JSON.stringify(visibleCounts)}`);
    }
    if (hiddenCutCounts.cutObjects !== 0 || hiddenCutCounts.trimCallouts !== 0 || hiddenCutCounts.trimHandles !== 0 || hiddenCutCounts.planeMarkers <= 0) {
      fail(errors, `Scene render visibility: cuttingObjects=false must hide cut visuals/callouts while leaving plane markers visible, got ${JSON.stringify(hiddenCutCounts)}`);
    }
    if (hiddenPlaneCounts.planeMarkers !== 0 || hiddenPlaneCounts.cutObjects <= 0 || hiddenPlaneCounts.trimCallouts <= 0 || hiddenPlaneCounts.trimHandles <= 0) {
      fail(errors, `Scene render visibility: referencePlanes=false must hide plane markers while leaving cut visuals visible, got ${JSON.stringify(hiddenPlaneCounts)}`);
    }

    const beamToBeamProject = readJson("bobercad/data/projects/sample_beam_to_beam_fin_plate.json");
    const beamToBeamSmartComponentId = "connection_beam_to_beam_fin_plate_1";
    const beamToBeamSmartComponent = beamToBeamProject.model.smartComponentInstances[beamToBeamSmartComponentId];
    if (!beamToBeamSmartComponent) fail(errors, "Smart Component lifecycle: beam-to-beam sample should store a smartComponentInstances entry");
    const beamToBeamScene = buildScene(beamToBeamProject, profilesLibrary, fasteners, viewerSettings);
    const hiddenFastenerSettings = clone(viewerSettings);
    hiddenFastenerSettings.render.visibility.fasteners = false;
    const hiddenFastenerScene = buildScene(beamToBeamProject, profilesLibrary, fasteners, hiddenFastenerSettings);
    const visibleFastenerCounts = sceneVisibilityCounts(beamToBeamScene);
    const hiddenFastenerCounts = sceneVisibilityCounts(hiddenFastenerScene);
    if (visibleFastenerCounts.fasteners <= 0) {
      fail(errors, `Scene render visibility: beam-to-beam sample must expose fasteners, got ${JSON.stringify(visibleFastenerCounts)}`);
    }
    if (hiddenFastenerCounts.fasteners !== 0) {
      fail(errors, `Scene render visibility: fasteners=false must hide fastener geometry, got ${JSON.stringify(hiddenFastenerCounts)}`);
    }
    const activeBeamToBeamScene = buildScene(beamToBeamProject, profilesLibrary, fasteners, viewerSettings, { activeSmartComponentId: beamToBeamSmartComponentId });
    for (const notchRole of ["topNotch", "bottomNotch"]) {
      const notchId = beamToBeamSmartComponent?.objectRoles?.[notchRole];
      const notch = beamToBeamProject.model.features[notchId];
      if (notch?.display?.visible !== true || notch.display?.suppressed !== true) {
        fail(errors, `Smart Component lifecycle: beam-to-beam notch ${notchId} should be active-component-only cutter geometry`);
      }
      if (sceneHasObject(beamToBeamScene, notchId)) {
        fail(errors, `Smart Component lifecycle: beam-to-beam notch ${notchId} should stay hidden outside Smart Component editing`);
      }
      if (!sceneHasObject(activeBeamToBeamScene, notchId)) {
        fail(errors, `Smart Component lifecycle: beam-to-beam notch ${notchId} should render while editing its Smart Component`);
      }
    }

    const storedStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners, materials });
    const storedBefore = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    storedStore.moveMemberWithLayout("beam_1", [0, 0, 125]);
    const storedAfter = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    if (Math.abs(storedAfter[2] - (storedBefore[2] + 125)) > 1e-6) {
      fail(errors, `Smart Component lifecycle: stored fin plate should follow secondary member vertical moves, got ${JSON.stringify(storedAfter)}`);
    }

    const diagnosticsStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners, materials });
    const finPlateId = "connection_fin_plate_1";
    const badParameters = diagnosticsStore.smartComponent(finPlateId).referenceParameters;
    diagnosticsStore.updateSmartComponent(finPlateId, {
      ...badParameters,
      plate: { ...badParameters.plate, height: 1000 },
      bolts: { ...badParameters.bolts, columns: 2, gauge: 0 }
    });
    const diagnostics = diagnosticsStore.smartComponent(finPlateId).diagnostics || [];
    if (!diagnostics.some((entry) => entry.code === "fin-plate-bolt-gauge-required")) {
      fail(errors, `Smart Component lifecycle: invalid bolt columns should report a diagnostic, got ${JSON.stringify(diagnostics)}`);
    }
    const diagnosticDimensions = buildSmartComponentDimensions({
      project: diagnosticsStore.project(),
      profiles,
      definition: diagnosticsStore.definition(finPlateId),
      smartComponentId: finPlateId
    });
    const issueParameters = new Set((diagnosticDimensions.labels || [])
      .filter((label) => label.issueSeverity === "error")
      .map((label) => label.parameter));
    if (!issueParameters.has("plate.height")) {
      fail(errors, `Smart Component lifecycle: diagnostic dimensions should highlight bad parameters, got ${[...issueParameters].join(", ")}`);
    }
    diagnosticsStore.resolveSmartComponentDiagnostics(finPlateId);
    if ((diagnosticsStore.smartComponent(finPlateId).diagnostics || []).length) {
      fail(errors, "Smart Component lifecycle: resolver should clear adjustable fin plate diagnostics");
    }

    const fastenerHoleStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners, materials });
    const normalParameters = fastenerHoleStore.smartComponent(finPlateId).referenceParameters;
    fastenerHoleStore.updateSmartComponent(finPlateId, {
      ...normalParameters,
      holes: { ...normalParameters.holes, tolerance: "normal" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 18) {
      fail(errors, "Smart Component lifecycle: normal hole tolerance should use the selected fastener default hole diameter");
    }
    const hookParameters = fastenerHoleStore.smartComponent(finPlateId).referenceParameters;
    fastenerHoleStore.updateSmartComponent(finPlateId, {
      ...hookParameters,
      bolts: { ...hookParameters.bolts, fastenerRef: "HOOK_M12" },
      holes: { ...hookParameters.holes, tolerance: "normal" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 14) {
      fail(errors, "Smart Component lifecycle: changing fastener should change normal hole diameter from fastener catalog data");
    }

    const project = emptyGeneratedSmartComponentModel(baseProject);
    const store = createProjectStore({ project, profiles, smartComponentCatalog, fasteners, materials });
    const created = store.createSmartComponentFromPreset("beam_to_column_fin_plate_m16_1x3", ["column_1", "beam_1"]);
    const afterCreate = store.project();
    const smartComponent = afterCreate.model.smartComponentInstances?.[created.smartComponentId];
    const zone = afterCreate.model.connectionZones?.[smartComponent?.inputs?.connectionZoneId];
    const assembly = afterCreate.model.assemblies?.[smartComponent?.inputs?.assemblyId];

    if (!smartComponent) fail(errors, "Smart Component lifecycle: Smart Component was not created");
    if (smartComponent?.status !== "generated" || smartComponent?.health !== "ok") {
      fail(errors, `Smart Component lifecycle: created Smart Component should be generated and healthy, got ${smartComponent?.status}/${smartComponent?.health}`);
    }
    if (zone?.authoring?.componentInstanceId !== created.smartComponentId || zone.authoring?.lifecycle !== "delete-with-smart-component") {
      fail(errors, "Smart Component lifecycle: generated zone is not tagged for delete-with-smart-component");
    }
    if (assembly?.authoring?.componentInstanceId !== created.smartComponentId || assembly.authoring?.lifecycle !== "delete-with-smart-component") {
      fail(errors, "Smart Component lifecycle: generated assembly is not tagged for delete-with-smart-component");
    }
    if ((zone?.interfaceIds || []).length !== 2) fail(errors, "Smart Component lifecycle: generated zone should have two interfaces");
    for (const interfaceId of zone?.interfaceIds || []) {
      const iface = afterCreate.model.interfaces?.[interfaceId];
      if (iface?.authoring?.componentInstanceId !== created.smartComponentId || iface.authoring?.lifecycle !== "delete-with-smart-component") {
        fail(errors, `Smart Component lifecycle: generated interface is not tagged for delete-with-smart-component: ${interfaceId}`);
      }
    }
    if (!afterCreate.model.plates?.[smartComponent?.objectRoles?.finPlate]) fail(errors, "Smart Component lifecycle: fin plate was not generated");
    if (Object.keys(afterCreate.model.fastenerGroups || {}).length < 1) fail(errors, "Smart Component lifecycle: fastener group was not generated");

    const optionalRole = store.smartComponentRoleOptions(created.smartComponentId).find((option) => !option.required)?.role;
    if (optionalRole) {
      store.setSmartComponentRoleActive(created.smartComponentId, optionalRole, false);
      const toggled = store.smartComponent(created.smartComponentId);
      if (!(toggled.suppressedRoles || []).includes(optionalRole)) {
        fail(errors, `Smart Component lifecycle: optional role ${optionalRole} should be suppressible`);
      }
    }

    const plateBeforeMove = afterCreate.model.plates?.[smartComponent?.objectRoles?.finPlate];
    store.moveMemberWithLayout("beam_1", [0, 0, 250]);
    const afterMove = store.project();
    const movedSmartComponent = afterMove.model.smartComponentInstances?.[created.smartComponentId];
    const plateAfterMove = afterMove.model.plates?.[movedSmartComponent?.objectRoles?.finPlate];
    if (Math.abs((plateAfterMove?.center?.[2] || 0) - ((plateBeforeMove?.center?.[2] || 0) + 250)) > 1e-6) {
      fail(errors, `Smart Component lifecycle: fin plate should follow secondary member vertical moves, got ${JSON.stringify(plateAfterMove?.center)}`);
    }

    store.deleteSmartComponent(created.smartComponentId);
    const afterDelete = store.project();
    for (const collection of ["smartComponentInstances", "connectionZones", "interfaces", "assemblies", "plates", "holePatterns", "features", "fastenerGroups", "welds"]) {
      assertNoObjects(errors, afterDelete, collection, "Smart Component lifecycle");
    }
    for (const member of Object.values(afterDelete.model.members || {})) {
      if ((member.featureIds || []).length) fail(errors, `Smart Component lifecycle: ${member.id} still references deleted features`);
    }

    const warehouseStore = createProjectStore({ project: emptyGeneratedSmartComponentModel(baseProject), profiles, smartComponentCatalog, fasteners, materials });
    const warehouse = warehouseStore.createSmartComponentFromPreset("warehouse_demo", []);
    const warehouseProject = warehouseStore.project();
    const warehouseInstances = Object.values(warehouseProject.model.smartComponentInstances || {});
    if (!warehouseProject.model.smartComponentInstances?.[warehouse.smartComponentId]) fail(errors, "Smart Component lifecycle: warehouse parent Smart Component was not created");
    if (!warehouseInstances.some((instance) => instance.kind === "frame") || !warehouseInstances.some((instance) => instance.type === "stair-system")) {
      fail(errors, `Smart Component lifecycle: warehouse should create nested frame and stair Smart Components, got ${warehouseInstances.map((instance) => instance.kind).join(", ")}`);
    }
    if (!warehouseInstances.some((instance) => instance.type === "stair-system" && instance.parentRole === "accessStair")) {
      fail(errors, "Smart Component lifecycle: warehouse access stair should use stair-system, not the legacy stair generator");
    }
  });
}

async function checkStairSystemGenerator(errors) {
  await withFileFetch(async () => {
    const { loadSmartComponentDefinitions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/modules/smart-components/smart-component-registry.mjs")).href);
    const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/store/project-command-store.mjs")).href);
    const baseProject = readJson("bobercad/data/projects/sample_beam_to_column_fin_plate.json");
    const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
    const fasteners = readJson("bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json");
    const materials = readJson("bobercad/data/libraries/materials/material-libraries/starter-materials/config.json");
    const catalog = await loadSmartComponentDefinitions();
    const baseParameters = catalog.smartComponents?.stair_system_straight_basic?.parameters;

    if (!catalog.definitions?.["stair-system"]) fail(errors, "stair-system generator: missing top-level stair-system definition");
    for (const type of ["path-flight", "plate-tread", "grating-tread", "twin-stringer", "mono-stringer", "post-and-rail", "stair-hardware", "member-splice", "transport-sections"]) {
      if (!catalog.definitions?.[type]) fail(errors, `stair-system generator: missing family definition ${type}`);
    }

    const emptyProject = () => {
      const project = clone(baseProject);
      project.objectIndex = {};
      for (const collection of ["groups", "interfaces", "connectionZones", "assemblies", "members", "plates", "sketches", "holePatterns", "objectPatterns", "features", "trimJoints", "fastenerGroups", "welds", "relations", "smartComponentInstances"]) {
        project.model[collection] = {};
      }
      return project;
    };
    const store = () => createProjectStore({ project: emptyProject(), profiles: profilesLibrary.profiles, smartComponentCatalog: catalog, fasteners, materials });
    const topInstance = (project) => Object.values(project.model.smartComponentInstances || {}).find((instance) => instance.type === "stair-system");
    const child = (project, parent, role) => project.model.smartComponentInstances?.[parent.childComponentRoles?.[role]];
    const roleCount = (instance, pattern) => Object.keys(instance?.objectRoles || {}).filter((role) => pattern.test(role)).length;
    const plateSketchPoints = (plate) => (plate.sketch?.vertices || []).map((vertex) => vertex.point).filter((point) => Array.isArray(point) && point.length >= 2);

    const straightStore = store();
    const created = straightStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    let project = straightStore.project();
    let top = project.model.smartComponentInstances[created.smartComponentId];
    if (!top?.childComponentRoles?.support || !top.childComponentRoles?.treads || !top.childComponentRoles?.connections || !top.childComponentRoles?.railing) {
      fail(errors, `stair-system generator: straight preset should create support/treads/connections/railing children, got ${JSON.stringify(top?.childComponentRoles)}`);
    }
    const straightTreadsChild = child(project, top, "treads");
    if (roleCount(straightTreadsChild, /^tread\d+$/) !== 8) {
      fail(errors, "stair-system generator: straight preset should create 8 tread roles");
    }
    if (roleCount(straightTreadsChild, /^frontPlate\d+$/) !== 0) {
      fail(errors, "stair-system generator: timber treads should not create folded tray front plates");
    }
    const firstBackingPlate = project.model.plates?.[straightTreadsChild?.objectRoles?.tread1];
    const firstWoodBoard = project.model.plates?.[straightTreadsChild?.objectRoles?.woodTread1];
    if (firstBackingPlate?.type !== "timber-backing-plate" || firstWoodBoard?.placementIntent?.host?.backingPlateId !== firstBackingPlate?.id) {
      fail(errors, "stair-system generator: folded-tray timber tread should use a flat backing plate hosted by the timber board");
    }
    if (Math.abs((firstBackingPlate?.width ?? NaN) - (firstWoodBoard?.width ?? NaN)) > 1e-6 || Math.abs((firstBackingPlate?.height ?? NaN) - (firstWoodBoard?.height ?? NaN)) > 1e-6) {
      fail(errors, "stair-system generator: timber backing plate should match timber board width and depth");
    }
    const standardHardware = child(project, top, "connections");
    const standardHardwareZone = project.model.connectionZones?.[standardHardware?.inputs?.connectionZoneId];
    if (standardHardware?.type !== "stair-hardware" || standardHardware.kind !== "connection" || !standardHardwareZone?.interfaceIds?.length || Object.keys(project.model.fastenerGroups || {}).length < 1) {
      fail(errors, "stair-system generator: straight preset should create stair-hardware as a real connection with zone/interfaces and fasteners");
    }

    straightStore.updateSmartComponent(created.smartComponentId, {
      ...top.referenceParameters,
      levels: { ...top.referenceParameters.levels, ffl2: 900 }
    });
    project = straightStore.project();
    top = project.model.smartComponentInstances[created.smartComponentId];
    if (roleCount(child(project, top, "treads"), /^tread\d+$/) !== 5) {
      fail(errors, "stair-system generator: FFL edit should leave exactly 5 managed treads");
    }
    if (project.model.plates?.sc_stair_system_treads_tread_8 || project.objectIndex?.sc_stair_system_treads_tread_8) {
      fail(errors, "stair-system generator: removed nested tread should be deleted from model and objectIndex");
    }

    const treadsChildId = top.childComponentRoles.treads;
    straightStore.updateSmartComponent(created.smartComponentId, {
      ...top.referenceParameters,
      treads: { ...top.referenceParameters.treads, family: "grating-tread" }
    });
    project = straightStore.project();
    top = project.model.smartComponentInstances[created.smartComponentId];
    if (top.childComponentRoles.treads !== treadsChildId || child(project, top, "treads")?.type !== "grating-tread") {
      fail(errors, "stair-system generator: changing tread family should keep child role id and update child type");
    }

    const overrideStore = store();
    const overrideCreated = overrideStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    project = overrideStore.project();
    top = project.model.smartComponentInstances[overrideCreated.smartComponentId];
    const supportChild = child(project, top, "support");
    const supportMemberId = Object.values(supportChild.objectRoles || {}).find((id) => project.model.members?.[id]);
    const supportBefore = project.model.members[supportMemberId];
    const movedStart = [supportBefore.start[0], supportBefore.start[1] + 125, supportBefore.start[2]];
    overrideStore.moveMemberWithLayout(supportMemberId, [0, 125, 0], { regenerateSmartComponents: false });
    if (JSON.stringify(overrideStore.project().model.smartComponentInstances[supportChild.id].fieldOverrides?.[supportMemberId]?.start) !== JSON.stringify(movedStart)) {
      fail(errors, "stair-system generator: nested support member move should be stored as child field override");
    }
    top = overrideStore.project().model.smartComponentInstances[overrideCreated.smartComponentId];
    overrideStore.updateSmartComponent(overrideCreated.smartComponentId, {
      ...top.referenceParameters,
      geometry: { ...top.referenceParameters.geometry, width: top.referenceParameters.geometry.width + 100 }
    });
    if (JSON.stringify(overrideStore.project().model.members[supportMemberId]?.start) !== JSON.stringify(movedStart)) {
      fail(errors, "stair-system generator: parent regeneration should preserve nested child field override");
    }

    const detachStore = store();
    const detachCreated = detachStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    project = detachStore.project();
    top = project.model.smartComponentInstances[detachCreated.smartComponentId];
    const detachSupportChild = child(project, top, "support");
    const detachMemberId = Object.values(detachSupportChild.objectRoles || {}).find((id) => project.model.members?.[id]);
    detachStore.detachSmartComponentObject(detachSupportChild.id, detachMemberId);
    project = detachStore.project();
    const detachedChild = project.model.smartComponentInstances[detachSupportChild.id];
    const replacementIds = Object.values(detachedChild.objectRoles || {});
    if (!detachedChild.detachedObjectIds?.includes(detachMemberId) || !project.model.members?.[detachMemberId] || replacementIds.includes(detachMemberId)) {
      fail(errors, "stair-system generator: detach should keep old object and replace the managed role id");
    }
    detachStore.reattachSmartComponentObject(detachSupportChild.id, detachMemberId);
    project = detachStore.project();
    if (project.model.members?.[detachMemberId] || project.objectIndex?.[detachMemberId] || project.model.smartComponentInstances[detachSupportChild.id].detachedObjectIds?.includes(detachMemberId)) {
      fail(errors, "stair-system generator: reattach should remove detached object and clear detachedObjectIds");
    }

    const landingStore = store();
    const landingCreated = landingStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    landingStore.updateSmartComponent(landingCreated.smartComponentId, {
      ...baseParameters,
      route: {
        ...baseParameters.route,
        modules: [
          { id: "flight_1", type: "flight.straight" },
          { id: "landing_1", type: "landing.straight" },
          { id: "flight_2", type: "flight.straight" }
        ]
      },
      landings: { ...baseParameters.landings, family: "framed-landing" }
    });
    project = landingStore.project();
    top = project.model.smartComponentInstances[landingCreated.smartComponentId];
    if (!top.childComponentRoles.landings || roleCount(child(project, top, "landings"), /^landing\d+$/) < 1) {
      fail(errors, "stair-system generator: straight-landing route should create a landing child with landing roles");
    }

    const mixedCurvedStore = store();
    const mixedCurvedCreated = mixedCurvedStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    mixedCurvedStore.updateSmartComponent(mixedCurvedCreated.smartComponentId, {
      ...baseParameters,
      levels: { ...baseParameters.levels, ffl2: 2160 },
      route: {
        ...baseParameters.route,
        modules: [
          { id: "flight_1", type: "flight.straight", stepCountOverride: 4 },
          { id: "landing_1", type: "landing.l", turnDirection: "left", entryExtensionLength: 500, exitExtensionLength: 300 },
          { id: "flight_2", type: "flight.straight", stepCountOverride: 4 },
          { id: "landing_2", type: "landing.l", turnDirection: "right", entryExtensionLength: 700, exitExtensionLength: 400 },
          { id: "flight_3", type: "flight.curved", radius: 1800, turnDirection: "left" },
          { id: "flight_4", type: "flight.straight" }
        ]
      }
    });
    project = mixedCurvedStore.project();
    top = project.model.smartComponentInstances[mixedCurvedCreated.smartComponentId];
    const mixedCurvedDiagnosticCodes = new Set((top.diagnostics || []).map((diagnostic) => diagnostic.code));
    if (top.health === "error" || mixedCurvedDiagnosticCodes.has("stair-special-route-modules-unsupported")) {
      fail(errors, `stair-system generator: mixed straight/landing/curved route should be valid, got health=${top.health} diagnostics=${[...mixedCurvedDiagnosticCodes].join(",")}`);
    }
    if (roleCount(child(project, top, "treads"), /^tread\d+$/) < 8) {
      fail(errors, "stair-system generator: mixed straight/landing/curved route should keep tread roles after curved module");
    }
    const curvedTreadOutlines = Object.values(project.model.plates || {}).filter((plate) => (
      plate.placementIntent?.footprintKind === "curved-strip"
      && plateSketchPoints(plate).length >= 6
    ));
    if (!curvedTreadOutlines.length) {
      fail(errors, "stair-system generator: curved flight treads should use curved strip outlines, not rectangular plates");
    }
    if (curvedTreadOutlines.some((plate) => Math.abs((plate.placementIntent?.centerWidth ?? NaN) - baseParameters.geometry.width) > 1e-6)) {
      fail(errors, "stair-system generator: curved flight tread width should be measured on the tread center line, not from outline bounds");
    }
    const expectedCurvedOverlap = baseParameters.treads.overlap ?? Math.max(0, baseParameters.treads.depth - baseParameters.geometry.going);
    const expectedCurvedDepth = baseParameters.geometry.going + expectedCurvedOverlap;
    if (curvedTreadOutlines.some((plate) => Math.abs((plate.placementIntent?.centerDepth ?? NaN) - expectedCurvedDepth) > 1e-6)) {
      fail(errors, "stair-system generator: curved flight tread going/depth should be measured on the tread center line including overlap, not from outline bounds");
    }
    if (curvedTreadOutlines.some((plate) => Math.abs((plate.placementIntent?.overlap ?? NaN) - expectedCurvedOverlap) > 1e-6)) {
      fail(errors, "stair-system generator: curved flight treads should store tread overlap in placementIntent");
    }
    if (curvedTreadOutlines.some((plate) => Math.abs((plate.fabrication?.overlap ?? NaN) - expectedCurvedOverlap) > 1e-6)) {
      fail(errors, "stair-system generator: curved flight treads should store tread overlap in fabrication metadata");
    }
    const curvedTreadOutlineBounds = curvedTreadOutlines.map((plate) => {
      const points = plateSketchPoints(plate);
      const ys = points.map((point) => point[0]);
      const zs = points.map((point) => point[1]);
      return {
        width: Math.max(...ys) - Math.min(...ys),
        depth: Math.max(...zs) - Math.min(...zs)
      };
    });
    if (curvedTreadOutlineBounds.some((bounds) => bounds.width > baseParameters.geometry.width * 1.5 || bounds.depth > expectedCurvedDepth * 1.5)) {
      fail(errors, "stair-system generator: curved tread outlines should stay local to the curved flight and not fan across adjacent landing segments");
    }

    const sectionStore = store();
    const sectionCreated = sectionStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    sectionStore.updateSmartComponent(sectionCreated.smartComponentId, {
      ...baseParameters,
      levels: { ...baseParameters.levels, ffl2: 2520 },
      sections: { ...baseParameters.sections, strategy: "max-weight", maxWeightKg: 90, targetLength: 1800 }
    });
    project = sectionStore.project();
    top = project.model.smartComponentInstances[sectionCreated.smartComponentId];
    if (!top.childComponentRoles.sections || Object.values(project.model.assemblies || {}).filter((assembly) => assembly.type === "transport-section").length < 2) {
      fail(errors, "stair-system generator: max-weight sectioning should create multiple transport-section assemblies");
    }
    const spliceChild = child(project, top, "sectionSplices");
    const spliceZone = project.model.connectionZones?.[spliceChild?.inputs?.connectionZoneId];
    if (spliceChild?.type !== "member-splice" || spliceChild.kind !== "connection" || !spliceZone?.interfaceIds?.length) {
      fail(errors, "stair-system generator: section splits should use generic member-splice as a real connection");
    }

    const complianceStore = store();
    const complianceCreated = complianceStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    complianceStore.updateSmartComponent(complianceCreated.smartComponentId, {
      ...baseParameters,
      geometry: { ...baseParameters.geometry, maxStepHeight: 230, going: 180 },
      levels: { ...baseParameters.levels, ffl2: 1610 },
      compliance: { ...baseParameters.compliance, rulePack: "uk-part-k", category: "utility", headroom: 1800 },
      railings: { ...baseParameters.railings, height: 760 }
    });
    top = complianceStore.project().model.smartComponentInstances[complianceCreated.smartComponentId];
    const diagnosticCodes = new Set((top.diagnostics || []).map((diagnostic) => diagnostic.code));
    if (top.health !== "error" || !diagnosticCodes.has("uk-part-k-rise") || !diagnosticCodes.has("uk-part-k-going")) {
      fail(errors, `stair-system generator: compliance failures should report rise/going errors, got health=${top.health} diagnostics=${[...diagnosticCodes].join(",")}`);
    }

    const healthySamples = [
      "sample_stair_straight_basic.json",
      "sample_stair_straight_with_landing.json",
      "sample_stair_l_shape.json",
      "sample_stair_u_switchback.json",
      "sample_stair_winder.json",
      "sample_stair_curved.json",
      "sample_stair_spiral.json",
      "sample_stair_helical.json",
      "sample_stair_mono_stringer.json",
      "sample_stair_grating_treads.json",
      "sample_stair_glass_rail.json",
      "sample_stair_max_weight_transport_split.json",
      "sample_stair_manual_station_split.json"
    ];
    for (const sample of healthySamples) {
      const sampleTop = topInstance(readJson(`bobercad/data/projects/${sample}`));
      if (!sampleTop || sampleTop.health !== "ok") fail(errors, `stair-system sample should have ok top-level health: ${sample}`);
    }
    const failureTop = topInstance(readJson("bobercad/data/projects/sample_stair_compliance_failures.json"));
    if (!failureTop || failureTop.health !== "error") fail(errors, "stair-system compliance failure sample should have error health");
  });
}
async function checkMemberAuthoringApi(errors) {
  const membersApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/project/members.mjs")).href);
  const snapSolverApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/interaction/snap-solver.mjs")).href);
  const snapManagerApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/snap-manager.mjs")).href);
  const snapProfilesApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/snap-profiles.mjs")).href);
  const snapProvidersApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/snap-candidate-providers.mjs")).href);
  const snapSelectionApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/snap-selection-manager.mjs")).href);
  const snapOverlayApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/authoring/snap-overlays.mjs")).href);
  const manipulatorMath = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/manipulator-math.mjs")).href);
  const axisSpace = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/authoring/member-axis-space.mjs")).href);
  const memberCreateControllerText = fs.readFileSync(path.join(ROOT, "bobercad/app/rendering/interaction/member-create-controller.mjs"), "utf8");
  if (
    !memberCreateControllerText.includes("function stationSourceFromSnapSource")
    || !memberCreateControllerText.includes('type === "layout-axis" || type === "layout-endpoint"')
    || !memberCreateControllerText.includes('type === "member-axis" || type.startsWith("member-")')
    || !memberCreateControllerText.includes("stationSourceFromSnapSource(snapSource)")
    || !memberCreateControllerText.includes("catch {")
  ) {
    fail(errors, "member authoring api: member create must normalize member/layout snap sources before stationing and avoid throwing during pointer hover");
  }
  const member = {
    id: "test_member",
    type: "member",
    start: [0, 0, 0],
    end: [100, 0, 0],
    layoutAxis: { start: [0, 10, 0], end: [100, 10, 0] }
  };
  const moved = membersApi.moveMemberWithLayout(member, [5, 0, 0]);
  if (JSON.stringify(moved.start) !== "[5,0,0]" || JSON.stringify(moved.layoutAxis.start) !== "[5,10,0]") {
    fail(errors, "member authoring api: moveMemberWithLayout must move physical and explicit virtual endpoints together");
  }

  const aligned = {
    id: "aligned_member",
    type: "member",
    start: [0, 0, 0],
    end: [100, 0, 0],
    layoutAxis: { start: [0, 0, 0], end: [100, 0, 0] }
  };
  const physical = membersApi.setMemberPhysicalEndpoint(aligned, "start", [10, 0, 0]);
  if (JSON.stringify(physical.layoutAxis.start) !== "[10,0,0]") {
    fail(errors, "member authoring api: matching layout endpoint should follow physical endpoint edits");
  }
  const offset = membersApi.setMemberPhysicalEndpoint(member, "start", [10, 0, 0]);
  if (JSON.stringify(offset.layoutAxis.start) !== "[0,10,0]") {
    fail(errors, "member authoring api: offset virtual endpoint should stay independent from physical endpoint edits");
  }
  const layout = membersApi.setMemberLayoutEndpoint(offset, "end", [120, 10, 0]);
  if (JSON.stringify(layout.end) !== "[100,0,0]" || JSON.stringify(layout.layoutAxis.end) !== "[120,10,0]") {
    fail(errors, "member authoring api: layout endpoint edits should not force physical endpoints");
  }

  const project = readJson("bobercad/data/projects/sample_beam_to_column_fin_plate.json");
  project.model.members.beam_1.layoutAxis = { start: [0, 0, 1500], end: [2300, 0, 1500] };
  const starterProfiles = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
  const normalSnapProfile = snapProfilesApi.snapProfile({ snap: { enabled: true, strength: "normal" } });
  if (normalSnapProfile.includeSurfaceTargets !== "faces") {
    fail(errors, `member authoring api: normal snap profile must expose full member surface targets, got ${normalSnapProfile.includeSurfaceTargets}`);
  }
  const candidates = snapProvidersApi.collectSnapCandidates({
    project,
    profiles: starterProfiles.profiles,
    context: { includeLines: true },
    scope: {},
    profile: { enabled: true, includeSurfaceTargets: "faces", screenTolerancePx: 16 }
  });
  for (const type of [
    "member-endpoint",
    "layout-endpoint",
    "member-profile-corner",
    "member-profile-edge",
    "member-profile-edge-midpoint",
    "member-profile-section-edge",
    "member-profile-section-edge-midpoint",
    "member-profile-face",
    "member-profile-face-center",
    "member-profile-face-centerline",
    "plate-center",
    "plate-sketch-vertex",
    "plate-sketch-edge",
    "plate-sketch-edge-midpoint",
    "fastener-center",
    "fastener-axis"
  ]) {
    if (!candidates.some((candidate) => candidate.type === type)) fail(errors, `member authoring api: missing snap candidate type ${type}`);
  }
  const memberFaceCandidate = candidates.find((candidate) => candidate.type === "member-profile-face");
  if (memberFaceCandidate?.kind !== "plane" || !Array.isArray(memberFaceCandidate.points) || memberFaceCandidate.points.length < 4 || !memberFaceCandidate.bounds) {
    fail(errors, "member authoring api: member face snap must be a bounded plane candidate with face points and local bounds");
  }
  const faceViewer = {
    projectPoint: (point) => ({ x: point[0], y: point[2] }),
    screenRay: (x, y) => ({ origin: [x, -1000, y], direction: [0, 1, 0] })
  };
  const faceSnap = snapSolverApi.solveSnap({
    candidates: [memberFaceCandidate],
    viewer: faceViewer,
    screen: faceViewer.projectPoint(memberFaceCandidate.point),
    rawPoint: memberFaceCandidate.point,
    screenTolerance: 16
  });
  if (faceSnap.snap?.type !== "member-profile-face" || !faceSnap.diagnostics?.some((diagnostic) => diagnostic.status === "accepted" && diagnostic.reason === "selected by rank/cycle")) {
    fail(errors, "member authoring api: bounded member face planes must resolve through solveSnap with accepted diagnostics");
  }
  const cappedIntersectionSnap = snapSolverApi.solveSnap({
    candidates,
    viewer: faceViewer,
    screen: { x: 0, y: 0 },
    rawPoint: [0, 0, 0],
    screenTolerance: 100000,
    intersectionTolerancePx: 100000,
    maxIntersectionSources: 4
  });
  const cappedIntersections = (cappedIntersectionSnap.candidates || []).filter((candidate) => candidate.type === "axis-intersection").length;
  if (cappedIntersections > 6) {
    fail(errors, `member authoring api: solver should cap noisy line intersections from profile/settings limits, got ${cappedIntersections}`);
  }
  const noMemberCandidates = snapProvidersApi.collectSnapCandidates({
    project,
    profiles: starterProfiles.profiles,
    context: { includeLines: true },
    scope: { members: false },
    profile: { enabled: true, includeSurfaceTargets: "faces", screenTolerancePx: 16 }
  });
  if (noMemberCandidates.some((candidate) => candidate.target?.collection === "members")) {
    fail(errors, "member authoring api: members scope off should remove all member snap candidates");
  }
  const noFastenerCandidates = snapProvidersApi.collectSnapCandidates({
    project,
    profiles: starterProfiles.profiles,
    context: { includeLines: true },
    scope: { fasteners: false },
    profile: { enabled: true, includeSurfaceTargets: "faces", screenTolerancePx: 16 }
  });
  if (noFastenerCandidates.some((candidate) => candidate.target?.collection === "fastenerGroups")) {
    fail(errors, "member authoring api: fasteners scope off should remove all fastener snap candidates");
  }
  const samplePlate = Object.values(project.model?.plates || {})[0];
  const activeSketchCandidates = snapProvidersApi.collectSnapCandidates({
    project,
    profiles: starterProfiles.profiles,
    context: {
      includeLines: false,
      activeSketch: {
        plate: samplePlate,
        candidates: [{
          point: [0, 0],
          label: "Active sketch snap",
          relations: [{ type: "coincident", vertexIds: ["a", "b"] }]
        }]
      }
    },
    scope: {},
    profile: { enabled: true, includeSurfaceTargets: "faces", screenTolerancePx: 16 }
  });
  const activeSketchCandidate = activeSketchCandidates.find((candidate) => candidate.providerId === "sketch.active");
  if (!activeSketchCandidate || activeSketchCandidate.target?.collection !== "activeSketch" || !Array.isArray(activeSketchCandidate.localPoint) || !activeSketchCandidate.relationHints?.length) {
    fail(errors, "member authoring api: active sketch candidates must keep target, local point, and relation hints through the shared provider path");
  }
  const scopedOutSketchCandidates = snapProvidersApi.collectSnapCandidates({
    project,
    profiles: starterProfiles.profiles,
    context: {
      includeLines: false,
      activeSketch: {
        plate: samplePlate,
        candidates: [{ point: [0, 0], label: "Active sketch snap" }]
      }
    },
    scope: { activeSketch: false },
    profile: { enabled: true, includeSurfaceTargets: "faces", screenTolerancePx: 16 }
  });
  if (scopedOutSketchCandidates.some((candidate) => candidate.providerId === "sketch.active")) {
    fail(errors, "member authoring api: activeSketch scope off should remove focused sketch snap candidates");
  }
  const fakeViewer = { projectPoint: (point) => ({ x: point[0], y: point[2] }) };
  const manager = snapManagerApi.createSnapManager({
    viewer: fakeViewer,
    api: { project: () => project },
    profiles: starterProfiles.profiles,
    settings: { authoring: { snap: { enabled: true, strength: "normal" } } },
    selectionScope: { scope: () => ({}), candidateAllowed: () => true }
  });
  const cycleRequest = {
    screen: { x: 171, y: 1500 },
    rawPoint: [171, 0, 1500],
    context: {
      tool: "qa",
      phase: "cycle",
      projectToPlane: false,
      includeLines: false
    }
  };
  manager.resolve(cycleRequest);
  manager.cycle();
  const cycled = manager.resolve(cycleRequest);
  if (cycled.cycleIndex !== 1 || manager.snapshot()?.cycleIndex !== 1) {
    fail(errors, "member authoring api: snap manager should cycle candidates for the current snap request");
  }
  if (!cycled.diagnostics?.some((diagnostic) => diagnostic.status === "accepted" && diagnostic.candidateId && diagnostic.reason === "selected by rank/cycle")) {
    fail(errors, `member authoring api: snap manager should expose accepted candidate diagnostics, got ${JSON.stringify(cycled.diagnostics?.slice(0, 3))}`);
  }
  const sketchCandidate = {
    type: "plate-sketch-grid",
    point: [0, 0],
    label: "Sketch grid",
    priority: 200,
    relations: [{ type: "horizontal", edgeId: "edge_1" }],
    subId: "grid",
    semanticRole: "adaptive-grid"
  };
  const sketchScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { activeSketch: true } } } }
  });
  const sketchManager = snapManagerApi.createSnapManager({
    viewer: fakeViewer,
    api: { project: () => project },
    profiles: starterProfiles.profiles,
    settings: { authoring: { snap: { enabled: true, strength: "normal" } } },
    selectionScope: sketchScope
  });
  const sketchSnap = sketchManager.resolve({
    screen: fakeViewer.projectPoint(samplePlate.center),
    rawPoint: samplePlate.center,
    context: {
      tool: "plate-sketch",
      phase: "vertex-drag",
      projectToPlane: false,
      includeLines: false,
      includeGlobalAxes: false,
      activeSketch: {
        plate: samplePlate,
        candidates: [sketchCandidate]
      }
    }
  });
  if (!sketchSnap.accepted || sketchSnap.providerId !== "sketch.active" || sketchSnap.relationHints[0]?.type !== "horizontal") {
    fail(errors, `member authoring api: active sketch candidates should resolve through snap manager with relation hints, got ${JSON.stringify(sketchSnap.diagnostics?.[0])}`);
  }
  sketchScope.setScope({ activeSketch: false });
  const disabledSketchSnap = sketchManager.resolve({
    screen: fakeViewer.projectPoint(samplePlate.center),
    rawPoint: samplePlate.center,
    scope: {
      members: false,
      plates: false,
      fasteners: false,
      workPoints: false,
      referencePlanes: false,
      grids: false,
      constructionGuides: false,
      activeSketch: false
    },
    context: {
      tool: "plate-sketch",
      phase: "vertex-drag-disabled",
      projectToPlane: false,
      includeLines: false,
      includeGlobalAxes: false,
      activeSketch: {
        plate: samplePlate,
        candidates: [sketchCandidate]
      }
    }
  });
  if (disabledSketchSnap.accepted) {
    fail(errors, "member authoring api: activeSketch scope off should remove focused sketch snap candidates");
  }
  const snapOverlay = snapOverlayApi.snapPointOverlay({
    snap: {
      kind: "point",
      type: "member-endpoint",
      point: [1, 0, 0],
      label: "Endpoint",
      sources: [{ kind: "line", type: "member-axis", a: [0, 0, 0], b: [10, 0, 0], point: [0, 0, 0], label: "Axis" }]
    },
    rawPoint: [1, 10, 0]
  });
  if (snapOverlay.handles?.[0]?.kind !== "snap" || snapOverlay.labels?.[0]?.className !== "snap" || !snapOverlay.lines?.some((line) => line.kind === "snap-link") || !snapOverlay.lines?.some((line) => line.kind === "snap-axis-active")) {
    fail(errors, `member authoring api: shared snap overlay should produce marker, label, link, and source guide, got ${JSON.stringify(snapOverlay)}`);
  }
  const pickScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { members: false, plates: true } } } }
  });
  const pickOptions = pickScope.pickOptions(project, { objectIds: Object.keys(project.objectIndex || {}) });
  if ((pickOptions.objectIds || []).some((objectId) => project.objectIndex?.[objectId]?.collection === "members")) {
    fail(errors, `member authoring api: pick options should share selection/snap scope filters, got ${JSON.stringify(pickOptions.objectIds)}`);
  }
  const selectedPlateId = Object.entries(project.objectIndex || {}).find(([, entry]) => entry?.collection === "plates")?.[0];
  const unselectedMemberId = Object.entries(project.objectIndex || {}).find(([, entry]) => entry?.collection === "members")?.[0];
  const selectedOnlyScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { selectedObjectsOnly: true } } } }
  });
  selectedOnlyScope.setSelected([selectedPlateId]);
  if (!selectedOnlyScope.candidateAllowed(project, { target: { collection: "plates", objectId: selectedPlateId } })) {
    fail(errors, "member authoring api: selected-only scope should keep snap candidates for selected objects");
  }
  if (selectedOnlyScope.candidateAllowed(project, { target: { collection: "members", objectId: unselectedMemberId } })) {
    fail(errors, "member authoring api: selected-only scope should reject snap candidates for unselected objects");
  }
  const smartScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { currentSmartComponentOnly: true } } } }
  });
  smartScope.setActiveSmartComponent("connection_fin_plate_1");
  if (!smartScope.candidateAllowed(project, { target: { collection: "plates", objectId: "connection_fin_plate_1_fin_plate" } })) {
    fail(errors, "member authoring api: smart component scope should allow owned object roles");
  }
  if (smartScope.candidateAllowed(project, { target: { collection: "members", objectId: "beam_1" } })) {
    fail(errors, "member authoring api: smart component scope should reject objects outside the active smart component");
  }
  const stairScopeProject = readJson("bobercad/data/projects/sample_stair_l_shape.json");
  const recursiveSmartScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { currentSmartComponentOnly: true } } } }
  });
  recursiveSmartScope.setActiveSmartComponent("sc_stair_system");
  if (!recursiveSmartScope.candidateAllowed(stairScopeProject, { target: { collection: "plates", objectId: "sc_stair_system_treads_tread_1" } })) {
    fail(errors, "member authoring api: root smart component scope should include owned objects from child smart components");
  }
  const precisionScope = snapSelectionApi.createSnapSelectionManager({
    settings: { authoring: { snap: { scope: { constructionGuides: true } } } }
  });
  const precisionCandidate = { providerId: "precision.adaptiveGrid", type: "adaptive-grid", point: [0, 0, 0] };
  if (!precisionScope.candidateAllowed(project, precisionCandidate)) {
    fail(errors, "member authoring api: adaptive precision grid should be allowed by default through the shared scope manager");
  }
  precisionScope.setScope({ constructionGuides: false });
  if (precisionScope.candidateAllowed(project, precisionCandidate)) {
    fail(errors, "member authoring api: adaptive precision grid should follow the Guides snap scope filter");
  }

  const closeStep = manipulatorMath.translationStepForScale({ minStep: 1, maxStep: 100, targetPixelsPerStep: 8 }, 4);
  const farStep = manipulatorMath.translationStepForScale({ minStep: 1, maxStep: 100, targetPixelsPerStep: 8 }, 0.04);
  if (closeStep !== 2 || farStep !== 100) {
    fail(errors, `member manipulator math: adaptive step should refine near the camera and coarsen far away, got ${closeStep}/${farStep}`);
  }
  if (manipulatorMath.quantizeDistance(13, 5) !== 15 || manipulatorMath.quantizeDegrees(12.4, 1) !== 12) {
    fail(errors, "member manipulator math: drag distances and degrees should quantize to configured steps");
  }
  const rotated = manipulatorMath.rotatePointAroundAxis([1, 0, 0], [0, 0, 0], [0, 0, 1], 90);
  if (Math.abs(rotated[0]) > 1e-9 || Math.abs(rotated[1] - 1) > 1e-9 || Math.abs(rotated[2]) > 1e-9) {
    fail(errors, `member manipulator math: point rotation around Z failed, got ${JSON.stringify(rotated)}`);
  }
  const beam = { id: "m1", start: [-10, 0, 0], end: [10, 0, 0], rotation: 0 };
  const rotatedBeam = manipulatorMath.rotateMemberAroundAxis(beam, [0, 0, 0], [0, 0, 1], 90);
  if (Math.abs(rotatedBeam.start[0]) > 1e-9 || Math.abs(rotatedBeam.start[1] + 10) > 1e-9 || Math.abs(rotatedBeam.end[0]) > 1e-9 || Math.abs(rotatedBeam.end[1] - 10) > 1e-9) {
    fail(errors, `member manipulator math: member should rotate around selected world axis, got ${JSON.stringify(rotatedBeam)}`);
  }
  const rolledBeam = manipulatorMath.rotateMemberAroundAxis(beam, [0, 0, 0], [1, 0, 0], 15);
  if (JSON.stringify(rolledBeam.start) !== JSON.stringify(beam.start) || JSON.stringify(rolledBeam.end) !== JSON.stringify(beam.end) || Math.abs(rolledBeam.rotation - 15) > 1e-9) {
    fail(errors, `member manipulator math: member-axis rotation should preserve roll around member axis, got ${JSON.stringify(rolledBeam)}`);
  }
  const localAxes = axisSpace.memberAxesForTarget({ id: "m2", start: [0, 0, 0], end: [0, 10, 0], rotation: 0 }, "center", "local");
  if (Math.abs(localAxes.x.axis[1] - 1) > 1e-9 || localAxes.x.coordinateSpace !== "local") {
    fail(errors, `member axis space: local X should follow member start-end axis, got ${JSON.stringify(localAxes.x)}`);
  }
  const globalAxes = axisSpace.memberAxesForTarget({ id: "m3", start: [0, 0, 0], end: [0, 10, 0], rotation: 0 }, "center", "global");
  if (Math.abs(globalAxes.x.axis[0] - 1) > 1e-9 || globalAxes.x.coordinateSpace !== "global") {
    fail(errors, `member axis space: global X should stay world X, got ${JSON.stringify(globalAxes.x)}`);
  }
}

async function checkGenericPathApi(errors) {
  const paths = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/geometry/paths.mjs")).href);
  const line = paths.normalizePath({ type: "line", start: [0, 0, 0], end: [100, 0, 0] });
  if (Math.abs(line.length - 100) > 1e-9) fail(errors, `path api: line length should be 100, got ${line.length}`);
  if (JSON.stringify(paths.pointAtStation(line, 40)) !== "[40,0,0]") {
    fail(errors, `path api: line point at station 40 is wrong, got ${JSON.stringify(paths.pointAtStation(line, 40))}`);
  }

  const polyline = paths.normalizePath({ type: "polyline", points: [[0, 0, 0], [100, 0, 0], [100, 100, 0]] });
  if (Math.abs(polyline.length - 200) > 1e-9 || JSON.stringify(paths.pointAtStation(polyline, 150)) !== "[100,50,0]") {
    fail(errors, `path api: polyline stationing failed, length=${polyline.length} point=${JSON.stringify(paths.pointAtStation(polyline, 150))}`);
  }

  const arc = paths.normalizePath({ type: "arc", center: [0, 0, 0], radius: 10, startAngle: 0, endAngle: Math.PI / 2, axisX: [1, 0, 0], axisY: [0, 1, 0] });
  const arcEnd = paths.pointAtStation(arc, arc.length);
  if (Math.abs(arc.length - Math.PI * 5) > 1e-9 || Math.abs(arcEnd[0]) > 1e-9 || Math.abs(arcEnd[1] - 10) > 1e-9) {
    fail(errors, `path api: quarter arc failed, length=${arc.length} end=${JSON.stringify(arcEnd)}`);
  }

  const helix = paths.normalizePath({ type: "helix", center: [0, 0, 0], radius: 10, startAngle: 0, endAngle: Math.PI * 2, height: 100, axisX: [1, 0, 0], axisY: [0, 1, 0], axisZ: [0, 0, 1] });
  const expectedHelixLength = Math.hypot(Math.PI * 20, 100);
  const helixEnd = paths.pointAtStation(helix, helix.length);
  if (Math.abs(helix.length - expectedHelixLength) > 1e-9 || Math.abs(helixEnd[2] - 100) > 1e-9) {
    fail(errors, `path api: helix failed, length=${helix.length} end=${JSON.stringify(helixEnd)}`);
  }

  const frame = paths.frameAtStation(line, 25);
  if (Math.abs(frame.tangent[0] - 1) > 1e-9 || Math.abs(frame.origin[0] - 25) > 1e-9) {
    fail(errors, `path api: frame at station failed, got ${JSON.stringify(frame)}`);
  }
  const offset = paths.offsetPath(line, 50, { count: 3 });
  if (offset.type !== "polyline" || offset.points.length !== 3) {
    fail(errors, `path api: offset path should return sampled polyline, got ${JSON.stringify(offset)}`);
  }
}

async function checkGenericSolverApi(errors) {
  const solver = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/model/solver-result.mjs")).href);
  const result = solver.createSolverResult({
    inputParameters: { target: 10 },
    resolvedParameters: { target: 10, count: 2 },
    computedValues: { spacing: 5 },
    objectRoleHints: { first: "object_1" },
    diagnostics: [{
      severity: "warning",
      code: "demo-warning",
      message: "Demo warning",
      parameterPaths: ["target"],
      objectRoles: ["first"],
      measured: 12,
      allowed: { max: 10 }
    }]
  });
  if (result.resolvedParameters.count !== 2 || result.diagnostics[0]?.severity !== "warning") {
    fail(errors, `solver api: createSolverResult normalized wrong result ${JSON.stringify(result)}`);
  }
  const withError = solver.addSolverDiagnostic(result, {
    severity: "error",
    code: "demo-error",
    message: "Demo error",
    parameterPaths: ["count"]
  });
  if (!solver.hasSolverErrors(withError) || withError.diagnostics.length !== 2) {
    fail(errors, `solver api: addSolverDiagnostic/hasSolverErrors failed ${JSON.stringify(withError)}`);
  }
  const merged = solver.mergeSolverResults(result, {
    computedValues: { width: 900 },
    objectRoleHints: { second: "object_2" }
  });
  if (merged.computedValues.spacing !== 5 || merged.computedValues.width !== 900 || merged.objectRoleHints.second !== "object_2") {
    fail(errors, `solver api: mergeSolverResults failed ${JSON.stringify(merged)}`);
  }
}

async function checkGenericComplianceApi(errors) {
  const compliance = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/model/compliance.mjs")).href);
  const pack = compliance.createRulePack({
    id: "demo-pack",
    title: "Demo Pack",
    jurisdiction: "test",
    sourceReferences: [],
    applicableComponentKinds: ["demo-system"],
    rules: [{
      id: "demo-range",
      type: "number-range",
      severity: "warning",
      measurementPath: "height",
      min: 100,
      max: 200,
      parameterPaths: ["geometry.height"],
      objectRoles: ["body"],
      clause: "D1",
      message: "Height is outside the demo range."
    }]
  });
  const skipped = compliance.runRulePack(pack, { componentKind: "other", measurements: { height: 250 } }, {});
  if (skipped.diagnostics.length) fail(errors, `compliance api: rule pack should skip other component kinds, got ${JSON.stringify(skipped)}`);
  const result = compliance.runRulePack(pack, { componentKind: "demo-system", measurements: { height: 250 } }, {});
  const diagnostic = result.diagnostics[0];
  if (diagnostic?.severity !== "warning" || diagnostic.measured !== 250 || diagnostic.allowed?.max !== 200 || diagnostic.parameterPaths?.[0] !== "geometry.height") {
    fail(errors, `compliance api: number-range diagnostic is wrong, got ${JSON.stringify(result)}`);
  }
  const custom = compliance.runRule({
    id: "custom-rule",
    check: () => [{ code: "custom-rule", message: "Custom rule", severity: "info" }]
  }, { componentKind: "demo-system" }, {});
  if (custom[0]?.severity !== "info") fail(errors, `compliance api: function rule failed, got ${JSON.stringify(custom)}`);
}

async function checkGenericSectioningApi(errors) {
  const sectioning = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/model/transport-sectioning.mjs")).href);
  const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
  const materialsLibrary = readJson("bobercad/data/libraries/materials/material-libraries/starter-materials/config.json");
  const project = {
    modelDefaults: {
      resolutionOrder: ["collections"],
      collections: {
        members: {},
        plates: {}
      }
    },
    objectIndex: {
      m1: { collection: "members", type: "beam" },
      p1: { collection: "plates", type: "plate" }
    },
    model: {
      members: {
        m1: { id: "m1", type: "beam", profile: "DEMO_I_200X100X8X12", material: "S355", start: [0, 0, 0], end: [1000, 0, 0] }
      },
      plates: {
        p1: {
          id: "p1",
          type: "plate",
          material: "S355",
          thickness: 10,
          center: [0, 0, 0],
          normal: [0, 0, 1],
          localAxisY: [1, 0, 0],
          localAxisZ: [0, 1, 0],
          sketch: {
            type: "plate-sketch",
            vertices: [
              { id: "p1_v1", point: [-500, -500] },
              { id: "p1_v2", point: [500, -500] },
              { id: "p1_v3", point: [500, 500] },
              { id: "p1_v4", point: [-500, 500] }
            ],
            edges: [
              { id: "p1_e1", from: "p1_v1", to: "p1_v2" },
              { id: "p1_e2", from: "p1_v2", to: "p1_v3" },
              { id: "p1_e3", from: "p1_v3", to: "p1_v4" },
              { id: "p1_e4", from: "p1_v4", to: "p1_v1" }
            ]
          }
        }
      }
    }
  };
  const libraries = { profiles: profilesLibrary, materials: materialsLibrary };
  const memberEstimate = sectioning.estimateObject(project, libraries, "m1");
  const plateEstimate = sectioning.estimateObject(project, libraries, "p1");
  if (Math.abs(memberEstimate.weightKg - 29.89) > 1e-6) {
    fail(errors, `sectioning api: member weight should use profile massPerLength, got ${memberEstimate.weightKg}`);
  }
  if (Math.abs(plateEstimate.weightKg - 78.5) > 1e-6) {
    fail(errors, `sectioning api: plate weight should use material density, got ${plateEstimate.weightKg}`);
  }
  const sections = sectioning.splitByMaxWeight(project, libraries, ["m1", "p1"], { maxWeightKg: 50, idPrefix: "demo_section" });
  const schedule = sectioning.sectionSchedule(sections);
  if (sections.length !== 2 || schedule[0]?.id !== "demo_section_1" || schedule[1]?.objectCount !== 1) {
    fail(errors, `sectioning api: split/schedule failed, got ${JSON.stringify(schedule)}`);
  }
}

async function main() {
  const errors = [];

  for (const relative of REQUIRED_FILES) {
    if (!exists(relative)) fail(errors, `missing required file: ${relative}`);
  }

  for (const relative of FORBIDDEN_ROOT_DIRS) {
    if (exists(relative)) fail(errors, `legacy root folder should not exist: ${relative}`);
  }

  for (const relative of FORBIDDEN_PATHS) {
    if (exists(relative)) fail(errors, `folder should not exist: ${relative}`);
  }

  if (exists("bobercad")) {
    const productRootChildren = fs.readdirSync(path.join(ROOT, "bobercad")).sort();
    const allowed = ["app", "data"];
    for (const child of productRootChildren) {
      if (!allowed.includes(child)) fail(errors, `bobercad product root should only contain app and data, found: ${child}`);
    }
  }

  checkJsonSchemaRefs(errors);
  checkJsonSchemas(errors);
  checkProjectSchemaIsolation(errors);
  await checkUiWorkspace(errors);
  checkFolderRegister(errors, "bobercad/data/libraries/materials/material-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/profiles/profile-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/fasteners/fastener-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/frames/frame-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/smart-components/smart-component-register.json", "components");
  checkSmartComponentFolders(errors);
  await checkSmartComponentQuickProperties(errors);
  checkViewerHasNoDomainFiles(errors);
  checkProjectFiles(errors);
  checkViewerSettingsSnapApi(errors);
  await checkApiRegister(errors);
  await checkAutoSmartComponentLifecycle(errors);
  await checkStairSystemGenerator(errors);
  await checkMemberAuthoringApi(errors);
  await checkGenericPathApi(errors);
  await checkGenericSolverApi(errors);
  await checkGenericComplianceApi(errors);
  await checkGenericSectioningApi(errors);

  if (errors.length) {
    console.error("FAILED: repository structure check failed");
    for (const error of errors) console.error(`ERROR: ${error}`);
    return 1;
  }

  console.log("OK: repository structure matches the current app/data layout");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
