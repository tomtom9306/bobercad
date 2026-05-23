const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "build-scene.mjs")).href);
  const { createCamera } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "camera.mjs")).href);
  const { buildConnectionDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "annotations", "build-dimensions.mjs")).href);
  const { loadConnectionDefinitions, connectionDefinition } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "modules", "connections", "connection-registry.mjs")).href);
  const settingsPath = path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-settings.json");
  const settings = readJson(settingsPath);
  const projectPath = path.resolve(path.dirname(settingsPath), settings.project.path);
  const project = readJson(projectPath);
  const profiles = readJson(path.resolve(path.dirname(projectPath), project.libraries.profiles.path));
  const fasteners = readJson(path.resolve(path.dirname(projectPath), project.libraries.fasteners.path));
  const scene = buildScene(project, profiles, fasteners, settings);

  if (!scene.faces.length) {
    console.error("FAILED: viewer produced no faces");
    return 1;
  }

  const largeProject = JSON.parse(JSON.stringify(project));
  const largeCount = 6000;
  const stressProfileId = Object.keys(profiles.profiles)[0];
  largeProject.project.name = "Synthetic Large Member Scene";
  largeProject.objectIndex = {};
  largeProject.model.members = {};
  largeProject.model.plates = {};
  largeProject.model.holePatterns = {};
  largeProject.model.objectPatterns = {};
  largeProject.model.features = {};
  largeProject.model.fastenerGroups = {};
  largeProject.model.welds = {};
  largeProject.model.connections = {};
  largeProject.model.assemblies = {};
  for (let index = 0; index < largeCount; index += 1) {
    const id = `stress_member_${index}`;
    largeProject.objectIndex[id] = { collection: "members", type: "boolean-demo-beam" };
    largeProject.model.members[id] = {
      id,
      type: "boolean-demo-beam",
      profile: stressProfileId,
      start: [index * 12, 0, 0],
      end: [index * 12 + 1000 + index * 0.01, 0, 0],
      featureIds: []
    };
  }
  const largeScene = buildScene(largeProject, profiles, fasteners, settings);
  if (largeScene.memberInstances.length !== largeCount) {
    console.error(`FAILED: detail-free members should use the instanced path, got ${largeScene.memberInstances.length}/${largeCount}`);
    return 1;
  }
  if (largeScene.faces.length) {
    console.error(`FAILED: detail-free synthetic members should not build exact member faces, got ${largeScene.faces.length}`);
    return 1;
  }

  const smallProject = JSON.parse(JSON.stringify(largeProject));
  smallProject.project.name = "Synthetic Small Member Scene";
  smallProject.objectIndex = {};
  smallProject.model.members = {};
  for (let index = 0; index < 2; index += 1) {
    const id = `simple_member_${index}`;
    smallProject.objectIndex[id] = { collection: "members", type: "boolean-demo-beam" };
    smallProject.model.members[id] = {
      id,
      type: "boolean-demo-beam",
      profile: stressProfileId,
      start: [index * 1200, 0, 0],
      end: [index * 1200 + 900, 0, 0],
      featureIds: []
    };
  }
  const smallScene = buildScene(smallProject, profiles, fasteners, settings);
  if (smallScene.memberInstances.length !== 2 || smallScene.faces.length) {
    console.error(`FAILED: small detail-free scenes should use the same instanced path, got ${smallScene.memberInstances.length} instances and ${smallScene.faces.length} faces`);
    return 1;
  }

  const camera = createCamera(settings);
  const viewport = { width: 1300, height: 1000 };
  camera.fit(scene, viewport);
  camera.setOrbitPivot(scene.bounds.max, scene, viewport);
  const clippedDepths = scene.vertices.filter((point) => Math.abs(camera.projectPoint(point, scene, viewport).depth) >= 0.999999);
  if (clippedDepths.length) {
    console.error(`FAILED: camera clipped ${clippedDepths.length} scene vertices after local orbit pivot`);
    return 1;
  }

  const finPlatePath = path.resolve(path.dirname(settingsPath), settings.project.demos["fin-plate-1"].path);
  const finPlateProject = readJson(finPlatePath);
  const finPlateProfiles = readJson(path.resolve(path.dirname(finPlatePath), finPlateProject.libraries.profiles.path));
  const connectionCatalog = await loadConnectionDefinitions();
  const [finPlateConnectionId] = Object.keys(finPlateProject.model.connections || {});
  const finPlateDefinition = connectionDefinition(connectionCatalog, finPlateProject.model.connections[finPlateConnectionId]);
  const dimensionOverlay = buildConnectionDimensions({
    project: finPlateProject,
    profiles: finPlateProfiles.profiles,
    definition: finPlateDefinition,
    connectionId: finPlateConnectionId
  });
  const invalidDimensionPoints = [
    ...dimensionOverlay.labels.map((label) => label.point),
    ...dimensionOverlay.lines.flatMap((line) => line.points)
  ].filter((point) => !point.every(Number.isFinite));
  if (!dimensionOverlay.labels.length || invalidDimensionPoints.length) {
    console.error(`FAILED: fin plate dimensions produced ${dimensionOverlay.labels.length} labels and ${invalidDimensionPoints.length} invalid points`);
    return 1;
  }
  const dimensionLabels = dimensionOverlay.labels.map((label) => label.text);
  for (const expected of ["bolts 3x1", "topW no weld", "botW no weld"]) {
    if (!dimensionLabels.includes(expected)) {
      console.error(`FAILED: missing fin plate dimension label: ${expected}`);
      return 1;
    }
  }
  const boltPatternLabel = dimensionOverlay.labels.find((label) => label.dimensionId.endsWith(":bolt-pattern"));
  if (boltPatternLabel?.editKind !== "positiveIntegerPair" || boltPatternLabel.editPaths?.first !== "bolts.rows" || boltPatternLabel.editPaths?.second !== "bolts.columns") {
    console.error(`FAILED: fin plate bolt pattern dimension should edit rows and columns, got ${JSON.stringify(boltPatternLabel)}`);
    return 1;
  }
  const twoColumnProject = JSON.parse(JSON.stringify(finPlateProject));
  twoColumnProject.model.connections[finPlateConnectionId].referenceParameters.bolts.columns = 2;
  const twoColumnOverlay = buildConnectionDimensions({
    project: twoColumnProject,
    profiles: finPlateProfiles.profiles,
    definition: finPlateDefinition,
    connectionId: finPlateConnectionId
  });
  if (!twoColumnOverlay.labels.some((label) => label.text === "bolts 3x2")) {
    console.error("FAILED: fin plate bolt pattern dimension should display requested row/column parameters even when generated columns overlap");
    return 1;
  }

  console.log(`OK: viewer geometry built ${scene.faces.length} faces and ${scene.lines.length} lines for ${project.project.name}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
