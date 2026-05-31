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
  "scripts/validate_json_schema.js",
  "scripts/check_viewer_geometry.js",

  "bobercad/app/schemas/project.schema.json",
  "bobercad/app/schemas/viewer-settings.schema.json",
  "bobercad/app/schemas/api-register.schema.json",
  "bobercad/app/schemas/material-library.schema.json",
  "bobercad/app/schemas/profile-library.schema.json",
  "bobercad/app/schemas/fastener-library.schema.json",
  "bobercad/app/schemas/model-library.schema.json",
  "bobercad/app/schemas/connection.schema.json",
  "bobercad/app/schemas/connection-register.schema.json",
  "bobercad/app/schemas/connection-component.schema.json",
  "bobercad/app/schemas/connection-component-register.schema.json",

  "bobercad/app/engine/api/api-register.json",
  "bobercad/app/engine/api/project/project-api.mjs",
  "bobercad/app/engine/api/project/members.mjs",
  "bobercad/app/engine/api/project/objects.mjs",
  "bobercad/app/engine/api/project/snapping.mjs",
  "bobercad/app/engine/api/geometry/geometry-api.mjs",
  "bobercad/app/engine/api/geometry/vectors.mjs",
  "bobercad/app/engine/api/geometry/planes.mjs",
  "bobercad/app/engine/api/connections/connection-api.mjs",
  "bobercad/app/engine/api/connections/builders.mjs",
  "bobercad/app/engine/api/connections/checks.mjs",
  "bobercad/app/engine/api/connections/geometry.mjs",
  "bobercad/app/engine/core/math.mjs",
  "bobercad/app/engine/core/model.mjs",
  "bobercad/app/engine/geometry/csg.mjs",
  "bobercad/app/engine/geometry/member-evaluator.mjs",
  "bobercad/app/engine/geometry/member-geometry.mjs",
  "bobercad/app/engine/geometry/polygon.mjs",
  "bobercad/app/engine/store/project-store.mjs",
  "bobercad/app/engine/modules/connections/connection-registry.mjs",
  "bobercad/app/engine/modules/connections/component-registry.mjs",
  "bobercad/app/engine/modules/connections/component-config-groups.mjs",
  "bobercad/app/engine/modules/connections/connection-generator.mjs",
  "bobercad/app/engine/modules/connections/connection-recipe.mjs",
  "bobercad/app/engine/modules/connections/connection-schema.mjs",
  "bobercad/app/engine/modules/connections/README.md",
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
  "bobercad/data/libraries/materials/material-register.json",
  "bobercad/data/libraries/materials/material-libraries/starter-materials/config.json",
  "bobercad/data/libraries/profiles/profile-register.json",
  "bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json",
  "bobercad/data/libraries/fasteners/fastener-register.json",
  "bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json",
  "bobercad/data/libraries/model-library/model-register.json",
  "bobercad/data/libraries/model-library/models/starter-frames/config.json",
  "bobercad/data/libraries/connections/connection-register.json",
  "bobercad/data/libraries/connections/README.md",
  "bobercad/data/libraries/connections/connection-library-ui.mjs",
  "bobercad/data/libraries/connections/connection-ui.mjs",
  "bobercad/data/libraries/connections/parameter-values.mjs",
  "bobercad/data/libraries/connections/connections/fin-plate/config.json",
  "bobercad/data/libraries/connections/connections/moment-end-plate/config.json",
  "bobercad/data/libraries/connection-components/component-register.json",
  "bobercad/data/libraries/connection-components/README.md",
  "bobercad/data/libraries/connection-components/components/metadata/design-status/config.json",
  "bobercad/data/libraries/connection-components/components/metadata/design-status/build.mjs",
  "bobercad/data/libraries/connection-components/components/plates/secondary-web-plate/config.json",
  "bobercad/data/libraries/connection-components/components/plates/secondary-web-plate/build.mjs",
  "bobercad/data/libraries/connection-components/components/features/secondary-member-gap-trim/config.json",
  "bobercad/data/libraries/connection-components/components/features/secondary-member-gap-trim/build.mjs",
  "bobercad/data/libraries/connection-components/components/fasteners/web-bolt-pattern/config.json",
  "bobercad/data/libraries/connection-components/components/fasteners/web-bolt-pattern/build.mjs",
  "bobercad/data/libraries/connection-components/components/cuts/support-flange-clearance/config.json",
  "bobercad/data/libraries/connection-components/components/cuts/support-flange-clearance/build.mjs",
  "bobercad/data/libraries/connection-components/components/welds/support-edge-fillet/config.json",
  "bobercad/data/libraries/connection-components/components/welds/support-edge-fillet/build.mjs",
  "bobercad/data/libraries/connection-components/components/stiffeners/support-web-stiffeners/config.json",
  "bobercad/data/libraries/connection-components/components/stiffeners/support-web-stiffeners/build.mjs",
  "bobercad/data/libraries/connection-components/components/plates/member-end-plate/config.json",
  "bobercad/data/libraries/connection-components/components/plates/member-end-plate/build.mjs"
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
    ...walk(path.join(ROOT, "bobercad/data/libraries/connections/connections")).filter((item) => item.endsWith(`${path.sep}config.json`)),
    path.join(ROOT, "bobercad/data/libraries/connection-components/component-register.json"),
    ...walk(path.join(ROOT, "bobercad/data/libraries/connection-components/components")).filter((item) => item.endsWith(`${path.sep}config.json`))
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

function checkConnectionFolders(errors) {
  const registerRelative = "bobercad/data/libraries/connections/connection-register.json";
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
  for (const item of register.connections || []) {
    const folder = path.resolve(path.dirname(registerPath), item);
    for (const fileName of ["config.json"]) {
      const filePath = path.join(folder, fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(errors, `${registerRelative}: ${item} missing ${fileName}`);
      }
    }
    for (const fileName of ["build.mjs", "ui.mjs"]) {
      const filePath = path.join(folder, fileName);
      if (fs.existsSync(filePath)) fail(errors, `${registerRelative}: ${item} should use recipe/component JSON, not ${fileName}`);
    }
    const definition = JSON.parse(fs.readFileSync(path.join(folder, "config.json"), "utf8"));
    if (!Array.isArray(definition.recipe) || !definition.recipe.length) {
      fail(errors, `${registerRelative}: ${item} must declare a recipe`);
    }
    if (!Array.isArray(definition.componentRefs) || !definition.componentRefs.length) {
      fail(errors, `${registerRelative}: ${item} must declare componentRefs`);
    }
    for (const ownedField of ["roles", "requiredPlateRoles", "components", "parameters", "dimensions", "ui"]) {
      if (Object.hasOwn(definition, ownedField)) {
        fail(errors, `${registerRelative}: ${item} should keep ${ownedField} in reusable connection components, not the connection config`);
      }
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

function checkConnectionComponentFolders(errors) {
  const registerRelative = "bobercad/data/libraries/connection-components/component-register.json";
  const registerPath = path.join(ROOT, registerRelative);
  const register = readJson(registerRelative);
  const forbiddenComponentPathWords = ["fin-plate", "moment-end-plate", "assembly"];
  for (const item of register.components || []) {
    if (forbiddenComponentPathWords.some((word) => item.includes(word))) {
      fail(errors, `${registerRelative}: component folder should be generic, not connection-specific: ${item}`);
    }
    const folder = path.resolve(path.dirname(registerPath), item);
    for (const fileName of ["config.json", "build.mjs"]) {
      const filePath = path.join(folder, fileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        fail(errors, `${registerRelative}: ${item} missing ${fileName}`);
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

    for (const connection of Object.values(model.connections || {})) {
      if (!connection.connectionZoneId || !connection.assemblyId) continue;
      const zone = model.connectionZones?.[connection.connectionZoneId];
      const assembly = model.assemblies?.[connection.assemblyId];
      if (!zone) {
        fail(errors, `${relative}: ${connection.id} points to missing connection zone ${connection.connectionZoneId}`);
        continue;
      }
      if (!assembly) {
        fail(errors, `${relative}: ${connection.id} points to missing assembly ${connection.assemblyId}`);
        continue;
      }
      if (!(assembly.connectionZoneIds || []).includes(connection.connectionZoneId)) {
        fail(errors, `${relative}: ${connection.assemblyId} must list connectionZoneIds entry ${connection.connectionZoneId}`);
      }
    }
  }
}

function emptyGeneratedConnectionModel(project) {
  const next = clone(project);
  for (const collection of ["groups", "interfaces", "connectionZones", "assemblies", "plates", "holePatterns", "objectPatterns", "features", "fastenerGroups", "welds", "connections"]) {
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

async function checkAutoConnectionLifecycle(errors) {
  await withFileFetch(async () => {
    const { loadConnectionDefinitions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/modules/connections/connection-registry.mjs")).href);
    const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/store/project-store.mjs")).href);
    const { buildConnectionDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/annotations/build-dimensions.mjs")).href);
    const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/scene/build-scene.mjs")).href);
    const { resolveInterface } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/geometry/member-geometry.mjs")).href);
    const { requiredReferencePlane } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/geometry/feature-plane.mjs")).href);
    const { v } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/core/math.mjs")).href);
    const project = emptyGeneratedConnectionModel(readJson("bobercad/data/projects/sample_fin_plate.json"));
    const profiles = readJson("bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json");
    const fasteners = readJson("bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json");
    const viewerSettings = readJson("bobercad/app/ui/viewer/viewer-settings.json");
    const connectionCatalog = await loadConnectionDefinitions();
    const beamToBeamProject = readJson("bobercad/data/projects/sample_beam_to_beam_fin_plate.json");
    const beamToBeamConnectionId = "connection_beam_to_beam_fin_plate_1";
    const beamToBeamScene = buildScene(beamToBeamProject, profiles, fasteners, viewerSettings);
    const activeBeamToBeamScene = buildScene(beamToBeamProject, profiles, fasteners, viewerSettings, { activeConnectionId: beamToBeamConnectionId });
    for (const notchId of ["connection_beam_to_beam_fin_plate_1_top_flange_notch", "connection_beam_to_beam_fin_plate_1_bottom_flange_notch"]) {
      const notch = beamToBeamProject.model.features[notchId];
      if (notch?.display?.visible !== true || notch.display?.suppressed !== true) {
        fail(errors, `beam-to-beam notch ${notchId} should be active-connection-only cutter geometry`);
      }
      if (beamToBeamScene.lines.some((line) => line.objectId === notchId)) {
        fail(errors, `beam-to-beam notch ${notchId} should stay hidden outside connection editing`);
      }
      if (!activeBeamToBeamScene.lines.some((line) => line.objectId === notchId)) {
        fail(errors, `beam-to-beam notch ${notchId} should contribute visible cutter edges while editing its connection`);
      }
    }
    const beamToBeamStore = createProjectStore({ project: beamToBeamProject, profiles, connectionCatalog, fasteners });
    const beamToBeamParameters = beamToBeamStore.project().model.connections[beamToBeamConnectionId].referenceParameters;
    beamToBeamStore.updateConnection(beamToBeamConnectionId, beamToBeamParameters);
    for (const notchId of ["connection_beam_to_beam_fin_plate_1_top_flange_notch", "connection_beam_to_beam_fin_plate_1_bottom_flange_notch"]) {
      const regeneratedNotch = beamToBeamStore.project().model.features[notchId];
      if (regeneratedNotch?.display?.visible !== true || regeneratedNotch.display?.suppressed !== true || regeneratedNotch.display?.opacity < 0.2) {
        fail(errors, `generated beam-to-beam notch ${notchId} should be stored as active-connection-only cutter geometry`);
      }
    }
    const storedStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const storedBefore = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    storedStore.moveMemberWithLayout("beam_1", [0, 0, 125]);
    const storedAfter = storedStore.project().model.plates.connection_fin_plate_1_fin_plate.center;
    if (Math.abs(storedAfter[2] - (storedBefore[2] + 125)) > 1e-6) {
      fail(errors, `auto connection lifecycle: stored fin plate should follow secondary member vertical moves, got ${JSON.stringify(storedAfter)}`);
    }
    const angledStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const angledBeam = angledStore.project().model.members.beam_1;
    angledStore.setMemberPhysicalEndpoint("beam_1", "end", [angledBeam.end[0], angledBeam.end[1], angledBeam.end[2] + 450]);
    const angledProject = angledStore.project();
    const angledPlate = angledProject.model.plates.connection_fin_plate_1_fin_plate;
    if (!Array.isArray(angledPlate.outline) || angledPlate.outline.length < 4) {
      fail(errors, `auto connection lifecycle: angled fin plate should store a clipped outline, got ${JSON.stringify(angledPlate.outline)}`);
    }
    const secondaryInterface = resolveInterface(angledProject, profiles, "if_beam_1_start_web");
    const supportInterface = resolveInterface(angledProject, profiles, "if_column_1_x_plus_fin_plate", {
      referencePoint: secondaryInterface.origin,
      preferReferencePoint: true
    });
    const activeTrim = angledProject.model.trimJoints.connection_fin_plate_1_beam_gap_trim;
    const activeTrimPlane = requiredReferencePlane(angledProject, activeTrim.operations[0].referencePlaneIds[0]);
    const supportNormalDot = Math.abs(v.dot(v.norm(activeTrimPlane.normal), v.norm(supportInterface.normal)));
    if (supportNormalDot < 0.99) fail(errors, "auto connection lifecycle: active beam trim should clip to the support face plane");
    const beamGapDistance = v.dot(v.sub(angledProject.model.members.beam_1.start, supportInterface.origin), supportInterface.normal);
    const beamGap = angledProject.model.connections.connection_fin_plate_1.referenceParameters.fit.beamGap;
    if (Math.abs(beamGapDistance - beamGap) > 1e-6) {
      fail(errors, `auto connection lifecycle: active beam trim should keep the requested support gap, got ${beamGapDistance}`);
    }
    const platePoint = (point) => v.add(angledPlate.center, v.add(v.mul(angledPlate.localAxisY, point[0]), v.mul(angledPlate.localAxisZ, point[1])));
    const behindSupport = (angledPlate.outline || []).some((point) => v.dot(v.sub(platePoint(point), supportInterface.origin), supportInterface.normal) < -1e-6);
    if (behindSupport) fail(errors, "auto connection lifecycle: angled fin plate outline crosses behind the support face");
    const supportEdge = (angledPlate.outline || [])
      .map((point) => ({ point, distance: Math.abs(v.dot(v.sub(platePoint(point), supportInterface.origin), supportInterface.normal)) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map((entry) => entry.point);
    const supportEdgeHeight = Math.abs((supportEdge[0]?.[1] || 0) - (supportEdge[1]?.[1] || 0));
    if (supportEdgeHeight < (angledPlate.height || 0) - 1e-6) {
      fail(errors, `auto connection lifecycle: angled fin plate should extend before trimming, support edge height ${supportEdgeHeight}`);
    }
    const highGapStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const highGapBeam = highGapStore.project().model.members.beam_1;
    highGapStore.setMemberPhysicalEndpoint("beam_1", "end", [highGapBeam.end[0], highGapBeam.end[1], highGapBeam.end[2] + 450]);
    const highGapParameters = highGapStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    highGapStore.updateConnection("connection_fin_plate_1", {
      ...highGapParameters,
      fit: { ...highGapParameters.fit, beamGap: 200 }
    });
    const highGapProject = highGapStore.project();
    const highGapPlate = highGapProject.model.plates.connection_fin_plate_1_fin_plate;
    const highGapPlateHoles = highGapProject.model.features.connection_fin_plate_1_holes_plate;
    const highGapSecondary = resolveInterface(highGapProject, profiles, "if_beam_1_start_web");
    const highGapSupport = resolveInterface(highGapProject, profiles, "if_column_1_x_plus_fin_plate", {
      referencePoint: highGapSecondary.origin,
      preferReferencePoint: true
    });
    const highGapSupportNormal = v.dot(highGapSupport.normal, highGapPlate.localAxisY) < 0 ? v.mul(highGapSupport.normal, -1) : highGapSupport.normal;
    const highGapSupportPlane = v.add(highGapSupport.origin, v.mul(highGapSupportNormal, highGapParameters.plate.edgeOffset || 0));
    const highGapLineDenominator = v.dot(highGapPlate.localAxisY, highGapSupportNormal);
    const highGapSupportEdge = Math.abs(highGapLineDenominator) <= 1e-9
      ? highGapSupportPlane
      : v.add(
        highGapProject.model.members.beam_1.start,
        v.mul(highGapPlate.localAxisY, v.dot(v.sub(highGapSupportPlane, highGapProject.model.members.beam_1.start), highGapSupportNormal) / highGapLineDenominator)
      );
    const highGapToBeam = v.dot(v.sub(highGapProject.model.members.beam_1.start, highGapSupportEdge), highGapPlate.localAxisY);
    const expectedHighGapWidth = highGapParameters.plate.length;
    const highGapCenterStation = v.dot(v.sub(highGapPlate.center, highGapSupportEdge), highGapPlate.localAxisY);
    const highGapHoleStation = v.dot(v.sub(highGapPlateHoles.reference.origin, highGapSupportEdge), highGapPlate.localAxisY);
    if (Math.abs(highGapPlate.width - expectedHighGapWidth) > 1e-6 || Math.abs(highGapCenterStation - expectedHighGapWidth / 2) > 1e-6) {
      fail(errors, `auto connection lifecycle: fin plate should keep its parameter length across large beam gaps, width ${highGapPlate.width}, center station ${highGapCenterStation}, expected width ${expectedHighGapWidth}`);
    }
    if (Math.abs(highGapHoleStation - (highGapToBeam + highGapParameters.plate.length / 2)) > 1e-6) {
      fail(errors, `auto connection lifecycle: fin plate holes should stay referenced from the fitted beam end, station ${highGapHoleStation}`);
    }
    const twoColumnStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const twoColumnParameters = twoColumnStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    twoColumnStore.updateConnection("connection_fin_plate_1", {
      ...twoColumnParameters,
      bolts: { ...twoColumnParameters.bolts, columns: 2, gauge: 0 }
    });
    const twoColumnConnection = twoColumnStore.project().model.connections.connection_fin_plate_1;
    const twoColumnDiagnostics = twoColumnConnection.generator?.diagnostics || [];
    if (!twoColumnDiagnostics.some((entry) => entry.code === "fin-plate-bolt-gauge-required")) {
      fail(errors, `auto connection lifecycle: two bolt columns with zero gauge should report a diagnostic, got ${JSON.stringify(twoColumnDiagnostics)}`);
    }
    const twoColumnPattern = twoColumnStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid;
    const distinctColumns = new Set((twoColumnPattern.positions || []).map((point) => Math.round(point[0] * 1000) / 1000));
    if (distinctColumns.size !== 1) {
      fail(errors, `auto connection lifecycle: zero gauge should stay literal instead of auto-spacing, got ${JSON.stringify(twoColumnPattern.positions)}`);
    }
    const resolverStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const resolverParameters = resolverStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    resolverStore.updateConnection("connection_fin_plate_1", {
      ...resolverParameters,
      plate: { ...resolverParameters.plate, height: 1000 },
      bolts: { ...resolverParameters.bolts, columns: 2, gauge: 0 }
    });
    const diagnosticProject = resolverStore.project();
    const diagnosticDimensions = buildConnectionDimensions({
      project: diagnosticProject,
      profiles: profiles.profiles,
      definition: connectionCatalog.connectionDefinitions?.["fin-plate"] || resolverStore.definition("connection_fin_plate_1"),
      connectionId: "connection_fin_plate_1"
    });
    const issueParameters = new Set((diagnosticDimensions.labels || [])
      .filter((label) => label.issueSeverity === "error")
      .map((label) => label.parameter));
    if (!issueParameters.has("plate.height")) {
      fail(errors, `auto connection lifecycle: diagnostic dimensions should highlight bad parameters, got ${[...issueParameters].join(", ")}`);
    }
    resolverStore.resolveConnectionDiagnostics("connection_fin_plate_1");
    const resolvedConnection = resolverStore.project().model.connections.connection_fin_plate_1;
    if (resolvedConnection.generator?.diagnostics?.length) {
      fail(errors, `auto connection lifecycle: resolver should clear adjustable fin plate diagnostics, got ${resolvedConnection.generator.diagnostics.map((item) => item.code).join(", ")}`);
    }
    const fastenerHoleStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const fastenerHoleParameters = fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleParameters,
      holes: { ...fastenerHoleParameters.holes, tolerance: "normal" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 18) {
      fail(errors, "auto connection lifecycle: normal hole tolerance should use the selected fastener default hole diameter");
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      bolts: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.bolts, fastenerRef: "HOOK_M12" },
      holes: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.holes, tolerance: "normal" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 14) {
      fail(errors, "auto connection lifecycle: changing fastener should change normal hole diameter from fastener catalog data");
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      bolts: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.bolts, fastenerRef: "M16_8_8" },
      holes: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.holes, tolerance: "tight" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 17) {
      fail(errors, "auto connection lifecycle: tight tolerance should use fastener catalog tight hole diameter");
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      holes: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.holes, tolerance: "loose" }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 20) {
      fail(errors, "auto connection lifecycle: loose tolerance should use fastener catalog loose hole diameter");
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      holes: { ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.holes, tolerance: "custom", customDiameter: 21 }
    });
    if (fastenerHoleStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid.holeDiameter !== 21) {
      fail(errors, "auto connection lifecycle: custom hole tolerance should use custom diameter");
    }
    const washerParameters = fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...washerParameters,
      bolts: { ...washerParameters.bolts, length: 80 },
      washers: { head: false, nut: true }
    });
    const washerFastenerGroup = fastenerHoleStore.project().model.fastenerGroups.connection_fin_plate_1_bolts;
    const washerAssembly = washerFastenerGroup.assembly?.washers;
    if (washerAssembly?.head !== false || washerAssembly?.nut !== true) {
      fail(errors, `auto connection lifecycle: fin plate washer options should be stored on the generated fastener group, got ${JSON.stringify(washerAssembly)}`);
    }
    if (washerFastenerGroup.assembly?.length !== 80) {
      fail(errors, `auto connection lifecycle: fin plate bolt length should be stored on the generated fastener group, got ${washerFastenerGroup.assembly?.length}`);
    }
    if (Math.abs((washerFastenerGroup.assembly?.gripLength || 0) - 18) > 1e-6) {
      fail(errors, `auto connection lifecycle: fin plate grip length should be plate plus secondary web thickness, got ${washerFastenerGroup.assembly?.gripLength}`);
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      bolts: {
        ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.bolts,
        nutPositionMode: "custom",
        nutOffset: 7
      }
    });
    if (fastenerHoleStore.project().model.fastenerGroups.connection_fin_plate_1_bolts.assembly?.nutOffset !== 7) {
      fail(errors, "auto connection lifecycle: custom fin plate nut offset should be stored only when custom nut position is selected");
    }
    fastenerHoleStore.updateConnection("connection_fin_plate_1", {
      ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters,
      bolts: {
        ...fastenerHoleStore.project().model.connections.connection_fin_plate_1.referenceParameters.bolts,
        nutPositionMode: "auto",
        nutOffset: 7
      }
    });
    if (Object.hasOwn(fastenerHoleStore.project().model.fastenerGroups.connection_fin_plate_1_bolts.assembly || {}, "nutOffset")) {
      fail(errors, "auto connection lifecycle: auto fin plate nut position should not store custom nut offset on the generated fastener group");
    }
    const customPatternStore = createProjectStore({ project: readJson("bobercad/data/projects/sample_fin_plate.json"), profiles, connectionCatalog, fasteners });
    const customPatternParameters = customPatternStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    customPatternStore.updateConnection("connection_fin_plate_1", {
      ...customPatternParameters,
      plate: { ...customPatternParameters.plate, height: 176 },
      bolts: {
        ...customPatternParameters.bolts,
        rows: 4,
        columns: 2,
        verticalPositionMode: "custom",
        horizontalPositionMode: "custom",
        topEdgeDistance: 25,
        supportEdgeDistance: 35,
        rowSpacingMode: "custom",
        columnSpacingMode: "custom",
        rowSpacings: [35, 40, 45],
        columnSpacings: [50]
      }
    });
    const customPatternProject = customPatternStore.project();
    const customPatternConnection = customPatternProject.model.connections.connection_fin_plate_1;
    if (customPatternConnection.generator?.diagnostics?.length) {
      fail(errors, `auto connection lifecycle: custom fin plate bolt pattern should be valid, got ${customPatternConnection.generator.diagnostics.map((item) => item.code).join(", ")}`);
    }
    const customPattern = customPatternProject.model.holePatterns.connection_fin_plate_1_bolt_grid;
    const customFeature = customPatternProject.model.features.connection_fin_plate_1_holes_plate;
    const customPlate = customPatternProject.model.plates.connection_fin_plate_1_fin_plate;
    const toPlateLocal = (position) => {
      const world = v.add(customFeature.reference.origin, v.add(v.mul(customFeature.reference.localAxisY, position[0]), v.mul(customFeature.reference.localAxisZ, position[1])));
      const offset = v.sub(world, customPlate.center);
      return [
        Math.round(v.dot(offset, customPlate.localAxisY) * 1000) / 1000,
        Math.round(v.dot(offset, customPlate.localAxisZ) * 1000) / 1000
      ];
    };
    const customPlatePositions = customPattern.positions.map(toPlateLocal);
    const customYs = [...new Set(customPlatePositions.map((position) => position[0]))].sort((a, b) => a - b);
    const customZs = [...new Set(customPlatePositions.map((position) => position[1]))].sort((a, b) => b - a);
    if (JSON.stringify(customYs) !== JSON.stringify([-55, -5]) || JSON.stringify(customZs) !== JSON.stringify([63, 28, -12, -57])) {
      fail(errors, `auto connection lifecycle: custom fin plate bolt positions are wrong, got y=${JSON.stringify(customYs)} z=${JSON.stringify(customZs)}`);
    }
    const washerGroup = washerFastenerGroup;
    const washerPlate = fastenerHoleStore.project().model.plates.connection_fin_plate_1_fin_plate;
    if (v.dot(v.norm(washerGroup.orientation.axis), v.norm(washerPlate.normal)) > -0.99) {
      fail(errors, "auto connection lifecycle: fin plate fastener axis should run from the fin plate side into the secondary web");
    }
    const angledParameters = angledProject.model.connections.connection_fin_plate_1.referenceParameters;
    angledStore.updateConnection("connection_fin_plate_1", {
      ...angledParameters,
      bolts: { ...angledParameters.bolts, parallelToSupport: true }
    });
    const supportAlignedPlate = angledStore.project().model.plates.connection_fin_plate_1_fin_plate;
    const plateYDot = Math.abs(v.dot(v.norm(supportAlignedPlate.localAxisY), v.norm(angledPlate.localAxisY)));
    const plateZDot = Math.abs(v.dot(v.norm(supportAlignedPlate.localAxisZ), v.norm(angledPlate.localAxisZ)));
    if (plateYDot < 0.999 || plateZDot < 0.999) fail(errors, "auto connection lifecycle: support-parallel bolts should not rotate the fin plate");
    const supportAlignedPlateHoles = angledStore.project().model.features.connection_fin_plate_1_holes_plate;
    const supportAlignedPattern = angledStore.project().model.holePatterns.connection_fin_plate_1_bolt_grid;
    const layout = supportAlignedPattern.layoutReference;
    if (!layout) fail(errors, "auto connection lifecycle: parallel fin plate bolts should store a placement layout reference");
    const beamAxisDot = Math.abs(v.dot(v.norm(layout.localAxisY), v.norm(supportAlignedPlateHoles.reference.localAxisY)));
    const plateNormal = supportAlignedPlate.normal;
    const projectedSupportZ = v.norm(v.sub(
      supportInterface.localAxisZ,
      v.mul(plateNormal, v.dot(supportInterface.localAxisZ, plateNormal))
    ));
    const supportAxisDot = Math.abs(v.dot(v.norm(layout.localAxisZ), projectedSupportZ));
    if (beamAxisDot < 0.99 || supportAxisDot < 0.99) {
      fail(errors, "auto connection lifecycle: parallel fin plate bolts should place one axis with the beam and one with the support");
    }
    const alignedParameters = angledStore.project().model.connections.connection_fin_plate_1.referenceParameters;
    angledStore.updateConnection("connection_fin_plate_1", {
      ...alignedParameters,
      fit: { ...alignedParameters.fit, clipBeam: false }
    });
    const disabledTrim = angledStore.project().model.trimJoints.connection_fin_plate_1_beam_gap_trim;
    if (disabledTrim?.operations?.[0]?.enabled !== false) {
      fail(errors, "auto connection lifecycle: disabled beam clip should leave the trim operation stored but inactive");
    }
    angledStore.setMemberPhysicalEndpoint("beam_1", "start", [0, 0, 1500]);
    const unclippedStart = angledStore.project().model.members.beam_1.start;
    if (Math.abs(unclippedStart[0]) > 1e-6 || Math.abs(unclippedStart[1]) > 1e-6 || Math.abs(unclippedStart[2] - 1500) > 1e-6) {
      fail(errors, `auto connection lifecycle: disabled beam clip should not force the secondary member end to the trim plane, got ${JSON.stringify(unclippedStart)}`);
    }
    const store = createProjectStore({ project, profiles, connectionCatalog, fasteners });
    const created = store.createConnectionFromPreset("beam_to_column_fin_plate_m16_1x3", ["column_1", "beam_1"]);
    const afterCreate = store.project();
    const connection = afterCreate.model.connections?.[created.connectionId];
    const zone = afterCreate.model.connectionZones?.[connection?.connectionZoneId];
    const assembly = afterCreate.model.assemblies?.[connection?.assemblyId];

    if (!connection) fail(errors, "auto connection lifecycle: connection was not created");
    if (zone?.authoring?.generatedBy !== created.connectionId || zone.authoring?.lifecycle !== "delete-with-connection") {
      fail(errors, "auto connection lifecycle: generated zone is not tagged for delete-with-connection");
    }
    if (assembly?.authoring?.generatedBy !== created.connectionId || assembly.authoring?.lifecycle !== "delete-with-connection") {
      fail(errors, "auto connection lifecycle: generated assembly is not tagged for delete-with-connection");
    }
    if ((zone?.interfaceIds || []).length !== 2) fail(errors, "auto connection lifecycle: generated zone should have two interfaces");
    for (const interfaceId of zone?.interfaceIds || []) {
      const iface = afterCreate.model.interfaces?.[interfaceId];
      if (iface?.authoring?.generatedBy !== created.connectionId || iface.authoring?.lifecycle !== "delete-with-connection") {
        fail(errors, `auto connection lifecycle: generated interface is not tagged for delete-with-connection: ${interfaceId}`);
      }
    }
    if (!afterCreate.model.plates?.[connection.generator.objectRoles.finPlate]) fail(errors, "auto connection lifecycle: fin plate was not generated");
    if (Object.keys(afterCreate.model.fastenerGroups || {}).length !== 1) fail(errors, "auto connection lifecycle: fastener group was not generated");
    const beamStart = afterCreate.model.members.beam_1.start;
    if (JSON.stringify(beamStart) !== JSON.stringify([170, 0, 1500])) {
      fail(errors, `auto connection lifecycle: beam gap should fit beam start to [170,0,1500], got ${JSON.stringify(beamStart)}`);
    }
    const weld = Object.values(afterCreate.model.welds || {})[0];
    const runKeys = (weld?.reference?.runs || []).map((run) => `${run.edge}:${run.side || ""}:${run.size}`).sort();
    if (runKeys.join("|") !== "support:back:6|support:front:6") {
      fail(errors, `auto connection lifecycle: fin plate weld runs are not explicit front/back runs: ${runKeys.join("|")}`);
    }
    const plateToggleStore = createProjectStore({ project: afterCreate, profiles, connectionCatalog, fasteners });
    plateToggleStore.toggleConnectionComponentFromFace({ objectId: connection.generator.objectRoles.finPlate });
    const plateToggleProject = plateToggleStore.project();
    const hiddenWeld = plateToggleProject.model.welds?.[plateToggleProject.model.connections[created.connectionId].generator.objectRoles.weld];
    if (!hiddenWeld?.display?.suppressed) {
      fail(errors, "auto connection lifecycle: suppressing the fin plate should also suppress its weld");
    }
    const sceneHasObject = (scene, objectId, predicate = () => true) => {
      return [...scene.faces, ...scene.lines].some((item) => item.objectId === objectId && predicate(item));
    };
    const hiddenPlateId = connection.generator.objectRoles.finPlate;
    const hiddenWeldId = connection.generator.objectRoles.weld;
    const inactivePlateScene = buildScene(plateToggleProject, profiles, fasteners, viewerSettings);
    if (sceneHasObject(inactivePlateScene, hiddenPlateId) || sceneHasObject(inactivePlateScene, hiddenWeldId)) {
      fail(errors, "auto connection lifecycle: suppressed plate ghosts should not render without an active connection editor");
    }
    const activePlateScene = buildScene(plateToggleProject, profiles, fasteners, viewerSettings, { activeConnectionId: created.connectionId });
    if (!sceneHasObject(activePlateScene, hiddenPlateId, (item) => item.suppressed) || !sceneHasObject(activePlateScene, hiddenWeldId, (item) => item.suppressed)) {
      fail(errors, "auto connection lifecycle: suppressed plate and weld ghosts should render while editing their connection");
    }

    const boltToggleStore = createProjectStore({ project: afterCreate, profiles, connectionCatalog, fasteners });
    boltToggleStore.toggleConnectionComponentFromFace({ objectId: connection.generator.objectRoles.fasteners, positionIndex: 0 });
    const boltToggleProject = boltToggleStore.project();
    const skippedBoltPattern = boltToggleProject.model.holePatterns?.[boltToggleProject.model.connections[created.connectionId].generator.objectRoles.holePattern];
    if (!skippedBoltPattern?.suppressedPositionIndices?.includes(0)) {
      fail(errors, "auto connection lifecycle: suppressing one bolt should also suppress the matching hole");
    }
    const hiddenFastenerId = connection.generator.objectRoles.fasteners;
    const inactiveBoltScene = buildScene(boltToggleProject, profiles, fasteners, viewerSettings);
    if (sceneHasObject(inactiveBoltScene, hiddenFastenerId, (item) => item.positionIndex === 0)) {
      fail(errors, "auto connection lifecycle: suppressed bolt ghosts should not render without an active connection editor");
    }
    const activeBoltScene = buildScene(boltToggleProject, profiles, fasteners, viewerSettings, { activeConnectionId: created.connectionId });
    if (!sceneHasObject(activeBoltScene, hiddenFastenerId, (item) => item.positionIndex === 0 && item.suppressed)) {
      fail(errors, "auto connection lifecycle: suppressed bolt ghosts should render while editing their connection");
    }

    const fastenerToggleStore = createProjectStore({ project: afterCreate, profiles, connectionCatalog, fasteners });
    fastenerToggleStore.toggleConnectionComponentFromFace({ objectId: connection.generator.objectRoles.fasteners });
    const fastenerToggleProject = fastenerToggleStore.project();
    const hiddenFastenerPattern = fastenerToggleProject.model.holePatterns?.[fastenerToggleProject.model.connections[created.connectionId].generator.objectRoles.holePattern];
    if ((hiddenFastenerPattern?.suppressedPositionIndices || []).length !== (hiddenFastenerPattern?.positions || []).length) {
      fail(errors, "auto connection lifecycle: suppressing the fastener group should also suppress all matching holes");
    }

    const plateBeforeMove = afterCreate.model.plates?.[connection.generator.objectRoles.finPlate];
    store.moveMemberWithLayout("beam_1", [0, 0, 250]);
    const afterMove = store.project();
    const movedConnection = afterMove.model.connections?.[created.connectionId];
    const plateAfterMove = afterMove.model.plates?.[movedConnection?.generator?.objectRoles?.finPlate];
    if (Math.abs((plateAfterMove?.center?.[2] || 0) - ((plateBeforeMove?.center?.[2] || 0) + 250)) > 1e-6) {
      fail(errors, `auto connection lifecycle: fin plate should follow secondary member vertical moves, got ${JSON.stringify(plateAfterMove?.center)}`);
    }

    store.deleteConnection(created.connectionId);
    const afterDelete = store.project();
    for (const collection of ["connections", "connectionZones", "interfaces", "assemblies", "plates", "holePatterns", "features", "fastenerGroups", "welds"]) {
      assertNoObjects(errors, afterDelete, collection, "auto connection lifecycle");
    }
    for (const member of Object.values(afterDelete.model.members || {})) {
      if ((member.featureIds || []).length) fail(errors, `auto connection lifecycle: ${member.id} still references deleted features`);
    }
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
  checkFolderRegister(errors, "bobercad/data/libraries/connections/connection-register.json", "connections");
  checkFolderRegister(errors, "bobercad/data/libraries/connection-components/component-register.json", "components");
  checkConnectionFolders(errors);
  checkConnectionComponentFolders(errors);
  checkViewerHasNoDomainFiles(errors);
  checkProjectFiles(errors);
  await checkApiRegister(errors);
  await checkAutoConnectionLifecycle(errors);
  await checkMemberAuthoringApi(errors);

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
