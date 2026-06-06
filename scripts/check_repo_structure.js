const fs = require("fs");
const path = require("path");
const { fileURLToPath, pathToFileURL } = require("url");
const { validateFile, formatError } = require("./validate_json_schema");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "AGENTS.md",
  "docs/README.md",
  "docs/architecture/data-model.md",
  "docs/architecture/folder-structure.md",
  "docs/workflows/codex-workflow.md",
  "scripts/check_repo.js",
  "scripts/check_repo_structure.js",
  "scripts/generate_stair_samples.mjs",
  "scripts/validate_json_schema.js",
  "scripts/check_viewer_geometry.js",

  "bobercad/app/schemas/project.schema.json",
  "bobercad/app/schemas/viewer-settings.schema.json",
  "bobercad/app/schemas/api-register.schema.json",
  "bobercad/app/schemas/material-library.schema.json",
  "bobercad/app/schemas/profile-library.schema.json",
  "bobercad/app/schemas/fastener-library.schema.json",
  "bobercad/app/schemas/model-library.schema.json",
  "bobercad/app/schemas/smart-component.schema.json",
  "bobercad/app/schemas/smart-component-register.schema.json",
  "bobercad/app/schemas/rule-pack.schema.json",

  "bobercad/app/engine/api/api-register.json",
  "bobercad/app/engine/api/project/project-api.mjs",
  "bobercad/app/engine/api/project/members.mjs",
  "bobercad/app/engine/api/project/objects.mjs",
  "bobercad/app/engine/api/project/snapping.mjs",
  "bobercad/app/engine/api/geometry/geometry-api.mjs",
  "bobercad/app/engine/api/geometry/vectors.mjs",
  "bobercad/app/engine/api/geometry/planes.mjs",
  "bobercad/app/engine/api/geometry/paths.mjs",
  "bobercad/app/engine/api/model/authoring-context.mjs",
  "bobercad/app/engine/api/model/builders.mjs",
  "bobercad/app/engine/api/model/checks.mjs",
  "bobercad/app/engine/api/model/compliance.mjs",
  "bobercad/app/engine/api/model/connection-primitives.mjs",
  "bobercad/app/engine/api/model/sectioning.mjs",
  "bobercad/app/engine/api/model/solver-result.mjs",
  "bobercad/app/engine/api/model/geometry.mjs",
  "bobercad/app/engine/core/math.mjs",
  "bobercad/app/engine/core/model.mjs",
  "bobercad/app/engine/geometry/csg.mjs",
  "bobercad/app/engine/geometry/member-evaluator.mjs",
  "bobercad/app/engine/geometry/member-geometry.mjs",
  "bobercad/app/engine/geometry/polygon.mjs",
  "bobercad/app/engine/store/project-store.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-registry.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-generator.mjs",
  "bobercad/app/engine/modules/smart-components/smart-component-recipe.mjs",
  "bobercad/app/engine/modules/smart-components/parameters.mjs",
  "bobercad/app/engine/modules/drawings/drawing-generator.mjs",
  "bobercad/app/engine/modules/reports/report-generator.mjs",

  "bobercad/app/rendering/annotations/README.md",
  "bobercad/app/rendering/scene/build-authoring-overlays.mjs",
  "bobercad/app/rendering/scene/build-scene.mjs",
  "bobercad/app/rendering/interaction/member-edit-controller.mjs",
  "bobercad/app/rendering/interaction/selection-controller.mjs",
  "bobercad/app/rendering/webgl/camera.mjs",
  "bobercad/app/rendering/webgl/webgl-renderer.mjs",

  "bobercad/app/ui/viewer/index.html",
  "bobercad/app/ui/viewer/README.md",
  "bobercad/app/ui/viewer/style.css",
  "bobercad/app/ui/viewer/viewer-settings.json",
  "bobercad/app/ui/viewer/main.mjs",
  "bobercad/app/ui/viewer/workbench/workbench.mjs",
  "bobercad/app/ui/viewer/workbench/layout-store.mjs",
  "bobercad/app/ui/viewer/workbench/command-registry.mjs",
  "bobercad/app/ui/viewer/navigation/navigation-ui.mjs",
  "bobercad/app/ui/viewer/navigation/toolbar-ui.mjs",
  "bobercad/app/ui/viewer/panels/panel-host.mjs",
  "bobercad/app/ui/viewer/panels/panel-registry.mjs",
  "bobercad/app/ui/viewer/panels/property-panel.mjs",
  "bobercad/app/ui/viewer/panels/viewport-panel.mjs",
  "bobercad/app/ui/viewer/controls/form-controls.mjs",
  "bobercad/app/ui/viewer/controls/menu-controls.mjs",
  "bobercad/app/ui/viewer/themes/theme.mjs",

  "bobercad/data/projects/sample_structure.json",
  "bobercad/data/projects/sample_portal_frame.json",
  "bobercad/data/projects/sample_fin_plate.json",
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
  "bobercad/data/projects/sample_stair_transport_split_weight.json",
  "bobercad/data/projects/sample_stair_manual_split.json",
  "bobercad/data/projects/sample_stair_compliance_failures.json",
  "bobercad/data/libraries/materials/material-register.json",
  "bobercad/data/libraries/materials/material-libraries/starter-materials/config.json",
  "bobercad/data/libraries/profiles/profile-register.json",
  "bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json",
  "bobercad/data/libraries/fasteners/fastener-register.json",
  "bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json",
  "bobercad/data/libraries/model-library/model-register.json",
  "bobercad/data/libraries/model-library/models/starter-frames/config.json",
  "bobercad/data/libraries/smart-components/smart-component-register.json",
  "bobercad/data/libraries/smart-components/smart-component-library-ui.mjs",
  "bobercad/data/libraries/smart-components/smart-component-ui.mjs",
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

function fail(errors, message) {
  errors.push(message);
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

function emptyGeneratedSmartComponentModel(project) {
  const next = clone(project);
  for (const collection of ["groups", "interfaces", "connectionZones", "assemblies", "plates", "holePatterns", "objectPatterns", "features", "fastenerGroups", "welds", "smartComponentInstances"]) {
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
    const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/store/project-store.mjs")).href);
    const { buildSmartComponentDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/annotations/build-dimensions.mjs")).href);
    const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/build-scene.mjs")).href);

    const baseProject = readJson("bobercad/data/projects/sample_fin_plate.json");
    const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
    const profiles = profilesLibrary.profiles;
    const fasteners = readJson("bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json");
    const viewerSettings = readJson("bobercad/app/ui/viewer/viewer-settings.json");
    const smartComponentCatalog = await loadSmartComponentDefinitions();
    const sceneHasObject = (scene, objectId, predicate = () => true) => [...scene.faces, ...scene.lines].some((item) => item.objectId === objectId && predicate(item));

    const beamToBeamProject = readJson("bobercad/data/projects/sample_beam_to_beam_fin_plate.json");
    const beamToBeamSmartComponentId = "connection_beam_to_beam_fin_plate_1";
    const beamToBeamSmartComponent = beamToBeamProject.model.smartComponentInstances[beamToBeamSmartComponentId];
    if (!beamToBeamSmartComponent) fail(errors, "Smart Component lifecycle: beam-to-beam sample should store a smartComponentInstances entry");
    const beamToBeamScene = buildScene(beamToBeamProject, profilesLibrary, fasteners, viewerSettings);
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

    const storedStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners });
    const storedBefore = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    storedStore.moveMemberWithLayout("beam_1", [0, 0, 125]);
    const storedAfter = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    if (Math.abs(storedAfter[2] - (storedBefore[2] + 125)) > 1e-6) {
      fail(errors, `Smart Component lifecycle: stored fin plate should follow secondary member vertical moves, got ${JSON.stringify(storedAfter)}`);
    }

    const diagnosticsStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners });
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

    const fastenerHoleStore = createProjectStore({ project: baseProject, profiles, smartComponentCatalog, fasteners });
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
    const store = createProjectStore({ project, profiles, smartComponentCatalog, fasteners });
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

    const warehouseStore = createProjectStore({ project: emptyGeneratedSmartComponentModel(baseProject), profiles, smartComponentCatalog, fasteners });
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
    const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/store/project-store.mjs")).href);
    const baseProject = readJson("bobercad/data/projects/sample_fin_plate.json");
    const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
    const fasteners = readJson("bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json");
    const catalog = await loadSmartComponentDefinitions();
    const baseParameters = catalog.smartComponents?.stair_system_straight_basic?.parameters;

    if (!catalog.definitions?.["stair-system"]) fail(errors, "stair-system generator: missing top-level stair-system definition");
    for (const type of ["path-flight", "plate-tread", "grating-tread", "twin-stringer", "mono-stringer", "post-and-rail", "standard-hardware", "member-splice", "transport-sections"]) {
      if (!catalog.definitions?.[type]) fail(errors, `stair-system generator: missing family definition ${type}`);
    }

    const emptyProject = () => {
      const project = clone(baseProject);
      project.objectIndex = {};
      for (const collection of ["groups", "interfaces", "connectionZones", "assemblies", "members", "plates", "holePatterns", "objectPatterns", "features", "trimJoints", "fastenerGroups", "welds", "smartComponentInstances"]) {
        project.model[collection] = {};
      }
      return project;
    };
    const store = () => createProjectStore({ project: emptyProject(), profiles: profilesLibrary.profiles, smartComponentCatalog: catalog, fasteners });
    const topInstance = (project) => Object.values(project.model.smartComponentInstances || {}).find((instance) => instance.type === "stair-system");
    const child = (project, parent, role) => project.model.smartComponentInstances?.[parent.childComponentRoles?.[role]];
    const roleCount = (instance, pattern) => Object.keys(instance?.objectRoles || {}).filter((role) => pattern.test(role)).length;

    const straightStore = store();
    const created = straightStore.createSmartComponentFromPreset("stair_system_straight_basic", []);
    let project = straightStore.project();
    let top = project.model.smartComponentInstances[created.smartComponentId];
    if (!top?.childComponentRoles?.support || !top.childComponentRoles?.treads || !top.childComponentRoles?.connections || !top.childComponentRoles?.railing) {
      fail(errors, `stair-system generator: straight preset should create support/treads/connections/railing children, got ${JSON.stringify(top?.childComponentRoles)}`);
    }
    if (roleCount(child(project, top, "treads"), /^tread\d+$/) !== 8) {
      fail(errors, "stair-system generator: straight preset should create 8 tread roles");
    }
    const standardHardware = child(project, top, "connections");
    const standardHardwareZone = project.model.connectionZones?.[standardHardware?.inputs?.connectionZoneId];
    if (standardHardware?.type !== "standard-hardware" || standardHardware.kind !== "connection" || !standardHardwareZone?.interfaceIds?.length || Object.keys(project.model.fastenerGroups || {}).length < 1) {
      fail(errors, "stair-system generator: straight preset should create standard-hardware as a real connection with zone/interfaces and fasteners");
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
      "sample_stair_transport_split_weight.json",
      "sample_stair_manual_split.json"
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
  const snappingApi = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/project/snapping.mjs")).href);
  const manipulatorMath = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/interaction/manipulator-math.mjs")).href);
  const axisSpace = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/authoring/member-axis-space.mjs")).href);
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

  const project = readJson("bobercad/data/projects/sample_fin_plate.json");
  project.model.members.beam_1.layoutAxis = { start: [0, 0, 1500], end: [2300, 0, 1500] };
  const candidates = snappingApi.snapCandidates(project);
  for (const type of ["member-endpoint", "layout-endpoint", "grid-intersection"]) {
    if (!candidates.some((candidate) => candidate.type === type)) fail(errors, `member authoring api: missing snap candidate type ${type}`);
  }
  const snap = snappingApi.nearestSnapPoint(project, [171, 0, 1500], { tolerance: 5, candidates });
  if (snap?.type !== "member-endpoint" || snap.objectId !== "beam_1") {
    fail(errors, "member authoring api: nearestSnapPoint should find nearby member endpoints");
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

  const arc = paths.normalizePath({ type: "arc", center: [0, 0, 0], radius: 10, startAngle: 0, endAngle: Math.PI / 2 });
  const arcEnd = paths.pointAtStation(arc, arc.length);
  if (Math.abs(arc.length - Math.PI * 5) > 1e-9 || Math.abs(arcEnd[0]) > 1e-9 || Math.abs(arcEnd[1] - 10) > 1e-9) {
    fail(errors, `path api: quarter arc failed, length=${arc.length} end=${JSON.stringify(arcEnd)}`);
  }

  const helix = paths.normalizePath({ type: "helix", center: [0, 0, 0], radius: 10, startAngle: 0, endAngle: Math.PI * 2, height: 100 });
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
    applicableComponentKinds: ["demo-system"],
    rules: [{
      id: "demo-range",
      type: "number-range",
      severity: "warning",
      measurementPath: "height",
      min: 100,
      max: 200,
      parameterPath: "geometry.height",
      objectRoles: ["body"],
      clause: "D1"
    }]
  });
  const skipped = compliance.runRulePack(pack, { componentKind: "other", measurements: { height: 250 } });
  if (skipped.diagnostics.length) fail(errors, `compliance api: rule pack should skip other component kinds, got ${JSON.stringify(skipped)}`);
  const result = compliance.runRulePack(pack, { componentKind: "demo-system", measurements: { height: 250 } });
  const diagnostic = result.diagnostics[0];
  if (diagnostic?.severity !== "warning" || diagnostic.measured !== 250 || diagnostic.allowed?.max !== 200 || diagnostic.parameterPaths?.[0] !== "geometry.height") {
    fail(errors, `compliance api: number-range diagnostic is wrong, got ${JSON.stringify(result)}`);
  }
  const custom = compliance.runRule({
    id: "custom-rule",
    check: () => ({ code: "custom-rule", message: "Custom rule", severity: "info" })
  }, { componentKind: "demo-system" });
  if (custom[0]?.severity !== "info") fail(errors, `compliance api: function rule failed, got ${JSON.stringify(custom)}`);
}

async function checkGenericSectioningApi(errors) {
  const sectioning = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/api/model/sectioning.mjs")).href);
  const profilesLibrary = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
  const materialsLibrary = readJson("bobercad/data/libraries/materials/material-libraries/starter-materials/config.json");
  const project = {
    objectIndex: {
      m1: { collection: "members", type: "beam" },
      p1: { collection: "plates", type: "plate" }
    },
    model: {
      members: {
        m1: { id: "m1", type: "beam", profile: "DEMO_I_200X100X8X12", material: "S355", start: [0, 0, 0], end: [1000, 0, 0] }
      },
      plates: {
        p1: { id: "p1", type: "plate", material: "S355", thickness: 10, width: 1000, height: 1000, center: [0, 0, 0] }
      }
    }
  };
  const libraries = { profiles: profilesLibrary.profiles, materials: materialsLibrary.materials };
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
  checkFolderRegister(errors, "bobercad/data/libraries/materials/material-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/profiles/profile-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/fasteners/fastener-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/model-library/model-register.json", "libraries");
  checkFolderRegister(errors, "bobercad/data/libraries/smart-components/smart-component-register.json", "components");
  checkSmartComponentFolders(errors);
  checkViewerHasNoDomainFiles(errors);
  checkProjectFiles(errors);
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
