const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "scene-geometry-builder.mjs")).href);
  const { createCamera } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "camera.mjs")).href);
  const { ccwPoints } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "csg.mjs")).href);
  const { signedArea2d, triangulateFace } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "polygon.mjs")).href);
  const { solveSnap } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "interaction", "snap-solver.mjs")).href);
  const { sketchFromRectangle } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "project", "plate-sketch-relations-and-bends.mjs")).href);
  const { collectSnapCandidates } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-candidate-providers.mjs")).href);
  const { createSnapManager } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-manager.mjs")).href);
  const { snapPointOverlay } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "authoring", "snap-overlays.mjs")).href);
  const { buildSmartComponentDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "annotations", "build-dimensions.mjs")).href);
  const { loadSmartComponentDefinitions, smartComponentDefinition } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "modules", "smart-components", "smart-component-registry.mjs")).href);
  const settingsPath = path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-settings.json");
  const settings = readJson(settingsPath);
  const projectPath = path.resolve(path.dirname(settingsPath), settings.project.path);
  const project = readJson(projectPath);
  const profiles = readJson(path.resolve(path.dirname(projectPath), project.libraries.profiles.path));
  const fasteners = readJson(path.resolve(path.dirname(projectPath), project.libraries.fasteners.path));
  const scene = buildScene(project, profiles, fasteners, settings);
  const pointKey = (point) => point.map((value) => Math.round(value * 1000) / 1000).join(",");
  const sceneGeometrySignature = (sourceScene) => ({
    faces: sourceScene.faces.map((face) => face.points.map(pointKey).sort().join("|")).sort(),
    lines: sourceScene.lines.map((line) => line.points.map(pointKey).sort().join("|")).sort()
  });

  for (const profileId of ["DEMO_I_200X100X8X12", "DEMO_I_300X150X8X12", "DEMO_L_75X75X8"]) {
    const contour = profiles.profiles?.[profileId]?.section?.contours?.find((item) => item.role === "solid");
    const points = ccwPoints(contour?.points || []);
    const area = Math.abs(signedArea2d(points));
    const triangles = triangulateFace(points.map(([y, z]) => [0, y, z]));
    const triangleArea = triangles.reduce((sum, triangle) => (
      sum + Math.abs(signedArea2d(triangle.map(([, y, z]) => [y, z])))
    ), 0);
    if (Math.abs(triangleArea - area) > 1e-6) {
      console.error(`FAILED: ${profileId} cap triangulation area ${triangleArea} does not match profile area ${area}`);
      return 1;
    }
  }

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
  largeProject.model.trimJoints = {};
  largeProject.model.fastenerGroups = {};
  largeProject.model.welds = {};
  largeProject.model.smartComponentInstances = {};
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

  const plateLikeProject = JSON.parse(JSON.stringify(project));
  plateLikeProject.objectIndex = {
    plate_like_source: { collection: "plates", type: "plate" },
    plate_like_cut: { collection: "features", type: "boolean-part" }
  };
  plateLikeProject.model.members = {};
  plateLikeProject.model.plates = {
    plate_like_source: {
      id: "plate_like_source",
      type: "plate",
      center: [0, 0, 0],
      normal: [1, 0, 0],
      localAxisY: [0, 1, 0],
      localAxisZ: [0, 0, 1],
      thickness: 30,
      sketch: sketchFromRectangle(100, 50, "plate_like_source")
    }
  };
  plateLikeProject.model.features = {
    plate_like_cut: {
      id: "plate_like_cut",
      type: "boolean-part",
      booleanType: "BOOLEAN_CUT",
      ownerId: "plate_like_source",
      body: {
        type: "polygonal-prism",
        center: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1],
        depth: 30,
        outline: [[-50, -25], [50, -25], [50, 25], [-50, 25]]
      }
    }
  };
  plateLikeProject.model.holePatterns = {};
  plateLikeProject.model.objectPatterns = {};
  plateLikeProject.model.trimJoints = {};
  plateLikeProject.model.fastenerGroups = {};
  plateLikeProject.model.welds = {};
  plateLikeProject.model.smartComponentInstances = {};
  plateLikeProject.model.assemblies = {};
  const plateLikePlateScene = buildScene(plateLikeProject, profiles, fasteners, settings, { renderObjectIds: ["plate_like_source"] });
  const plateLikeCutScene = buildScene(plateLikeProject, profiles, fasteners, settings, { renderObjectIds: ["plate_like_cut"] });
  if (JSON.stringify(sceneGeometrySignature(plateLikePlateScene)) !== JSON.stringify(sceneGeometrySignature(plateLikeCutScene))) {
    console.error("FAILED: polygonal cutting body should use the same scene geometry path as a matching plate");
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
  const smartComponentCatalog = await loadSmartComponentDefinitions();
  const [finPlateSmartComponentId] = Object.keys(finPlateProject.model.smartComponentInstances || {});
  const finPlateDefinition = smartComponentDefinition(smartComponentCatalog, finPlateProject.model.smartComponentInstances[finPlateSmartComponentId]);
  const dimensionOverlay = buildSmartComponentDimensions({
    project: finPlateProject,
    profiles: finPlateProfiles.profiles,
    definition: finPlateDefinition,
    smartComponentId: finPlateSmartComponentId
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
  twoColumnProject.model.smartComponentInstances[finPlateSmartComponentId].referenceParameters.bolts.columns = 2;
  const twoColumnOverlay = buildSmartComponentDimensions({
    project: twoColumnProject,
    profiles: finPlateProfiles.profiles,
    definition: finPlateDefinition,
    smartComponentId: finPlateSmartComponentId
  });
  if (!twoColumnOverlay.labels.some((label) => label.text === "bolts 3x2")) {
    console.error("FAILED: fin plate bolt pattern dimension should display requested row/column parameters even when generated columns overlap");
    return 1;
  }

  const snapViewer = {
    projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
    screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
  };
  const plateEdge = {
    kind: "line",
    type: "plate-sketch-edge",
    label: "Plate edge",
    a: [0, 0, 0],
    b: [10, 0, 0],
    priority: 72
  };
  const offSegmentSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 25, y: 2 },
    candidates: [plateEdge],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (offSegmentSnap.snap) {
    console.error(`FAILED: finite plate edge snapped beyond its endpoint: ${offSegmentSnap.snap.label}`);
    return 1;
  }
  const onSegmentSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 5, y: 2 },
    candidates: [plateEdge],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (onSegmentSnap.snap?.label !== "Plate edge") {
    console.error("FAILED: finite plate edge should still snap near the segment");
    return 1;
  }
  const offSegmentIntersection = solveSnap({
    viewer: snapViewer,
    screen: { x: 25, y: 0 },
    candidates: [
      plateEdge,
      { kind: "line", type: "plate-sketch-edge", label: "Plate edge", a: [25, -5, 0], b: [25, 5, 0], priority: 72 }
    ],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (offSegmentIntersection.snap?.type === "axis-intersection") {
    console.error("FAILED: finite plate edge intersection should not use extended segments");
    return 1;
  }
  const guideSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 25, y: 2 },
    candidates: [{ ...plateEdge, type: "creation-axis", label: "Start X axis", screenIntersectionMode: "self" }],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (guideSnap.snap?.label !== "Start X axis") {
    console.error("FAILED: construction guide lines should still snap beyond their finite endpoints");
    return 1;
  }
  const hiddenBackFace = {
    kind: "plane",
    type: "plate-face",
    objectId: "back_plate",
    visibilityPolicy: "visible-surface",
    label: "Back plate face",
    points: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
    origin: [0, 0, 0],
    axisU: [1, 0, 0],
    axisV: [0, 1, 0],
    normal: [0, 0, 1],
    bounds: { minU: 0, maxU: 10, minV: 0, maxV: 10 },
    point: [5, 5, 0],
    priority: 90
  };
  const visibleFrontFace = {
    ...hiddenBackFace,
    objectId: "front_plate",
    label: "Front plate face",
    points: [[0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]],
    origin: [0, 0, 10],
    point: [5, 5, 10],
    priority: 10
  };
  const visibilityFilteredSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 5, y: 5 },
    rawPoint: [5, 5, 10],
    candidates: [hiddenBackFace, visibleFrontFace],
    screenTolerance: 5,
    projectionPriorityBiasPx: 5,
    visibilityFilter: (hit) => hit.visibilityPolicy && hit.objectId !== "front_plate"
      ? { accepted: false, reason: "occluded by front_plate" }
      : { accepted: true }
  });
  if (visibilityFilteredSnap.snap?.objectId !== "front_plate") {
    console.error(`FAILED: visibility filter should reject hidden snap face, got ${visibilityFilteredSnap.snap?.objectId || "none"}`);
    return 1;
  }
  if (visibilityFilteredSnap.candidates.some((candidate) => candidate.objectId === "back_plate")) {
    console.error("FAILED: hidden snap face should not remain in accepted candidates");
    return 1;
  }
  if (!visibilityFilteredSnap.diagnostics.some((item) => item.candidateId?.includes("back_plate") && item.status === "rejected")) {
    console.error("FAILED: hidden snap face rejection should be reported in diagnostics");
    return 1;
  }
  const memberFaceInteriorSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 5, y: 5 },
    rawPoint: [5, 5, 0],
    candidates: [
      {
        kind: "point",
        type: "plate-sketch-vertex",
        objectId: "near_plate",
        label: "Plate corner",
        point: [6, 5, 0],
        priority: 120
      },
      {
        kind: "plane",
        type: "member-profile-face",
        objectId: "visible_member",
        visibilityPolicy: "visible-surface",
        label: "Member face",
        points: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
        origin: [0, 0, 0],
        axisU: [1, 0, 0],
        axisV: [0, 1, 0],
        normal: [0, 0, 1],
        bounds: { minU: 0, maxU: 10, minV: 0, maxV: 10 },
        point: [5, 5, 0],
        priority: 52,
        preferInteriorSnap: true,
        interiorSnapEdgeBiasPx: 3
      }
    ],
    screenTolerance: 8,
    pointPriorityBiasPx: 12,
    projectionPriorityBiasPx: 5,
    visibilityFilter: () => ({ accepted: true })
  });
  if (memberFaceInteriorSnap.snap?.type !== "member-profile-face") {
    console.error(`FAILED: member face interior should beat nearby unrelated point snaps, got ${memberFaceInteriorSnap.snap?.label || "none"}`);
    return 1;
  }
  const plateSnapProject = {
    model: {
      members: {},
      plates: {
        snap_plate_1: {
          id: "snap_plate_1",
          type: "plate",
          center: [0, 0, 0],
          normal: [0, 0, 1],
          localAxisY: [1, 0, 0],
          localAxisZ: [0, 1, 0],
          thickness: 8,
          sketch: sketchFromRectangle(20, 10, "snap_plate_1")
        }
      },
      fastenerGroups: {},
      features: {},
      workPoints: {},
      referencePlanes: {},
      gridSystems: {}
    }
  };
  const plateCandidates = collectSnapCandidates({
    project: plateSnapProject,
    context: { includeLines: true },
    scope: {},
    profile: { includeSurfaceTargets: "faces" },
    rawPoint: [3, 2, 0]
  });
  const plateFaces = plateCandidates.filter((candidate) => candidate.type === "plate-face");
  const plateFace = plateFaces.find((candidate) => candidate.faceSide === "front");
  const backPlateFace = plateFaces.find((candidate) => candidate.faceSide === "back");
  if (!plateFace || !backPlateFace) {
    console.error("FAILED: plate snap candidates should include rendered front/back plate-face planes");
    return 1;
  }
  if (plateFaces.some((candidate) => candidate.faceSide === "mid")) {
    console.error("FAILED: thick plate snap candidates should not expose the hidden center plane as a plate face");
    return 1;
  }
  if (plateFace.visibilityPolicy !== "visible-surface") {
    console.error(`FAILED: plate face snap should require visible surface, got ${plateFace.visibilityPolicy || "none"}`);
    return 1;
  }
  const plateEdgeCandidate = plateCandidates.find((candidate) => candidate.type === "plate-sketch-edge");
  if (plateEdgeCandidate?.visibilityPolicy !== "visible-edge") {
    console.error(`FAILED: plate edge snap should require visible object, got ${plateEdgeCandidate?.visibilityPolicy || "none"}`);
    return 1;
  }
  const plateVertexCandidate = plateCandidates.find((candidate) => candidate.type === "plate-sketch-vertex");
  if (plateVertexCandidate?.visibilityPolicy !== "visible-point") {
    console.error(`FAILED: plate vertex snap should require visible point, got ${plateVertexCandidate?.visibilityPolicy || "none"}`);
    return 1;
  }
  const edgeOnlySnapSettings = {
    authoring: {
      snap: {
        enabled: true,
        strength: "normal",
        profiles: {
          normal: {
            includeSurfaceTargets: "edges"
          }
        }
      }
    }
  };
  const occludedPlateViewer = {
    projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
    screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] }),
    snapVisibilityAt: (screen) => ({
      depth: 10,
      point: [screen.x, screen.y, 10],
      normal: [0, 0, 1],
      face: { objectId: "snap_plate_1", normal: [0, 0, 1] }
    })
  };
  const hiddenEdgeSnapManager = createSnapManager({
    viewer: occludedPlateViewer,
    api: { project: () => plateSnapProject },
    settings: edgeOnlySnapSettings
  });
  const hiddenEdgeSnap = hiddenEdgeSnapManager.resolve({
    screen: { x: 4, y: 4.5 },
    rawPoint: [4, 4.5, 0],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (hiddenEdgeSnap.snap) {
    console.error(`FAILED: hidden same-object edge snap should be depth-rejected, got ${hiddenEdgeSnap.snap.label || hiddenEdgeSnap.snap.type}`);
    return 1;
  }
  if (!hiddenEdgeSnap.diagnostics.some((item) => item.reason === "hidden behind visible surface")) {
    console.error("FAILED: hidden same-object edge rejection should report depth visibility diagnostics");
    return 1;
  }
  const wireframeEdgeSnap = hiddenEdgeSnapManager.resolve({
    screen: { x: 4, y: 4.5 },
    rawPoint: [4, 4.5, 0],
    context: { includeGlobalAxes: false, wireframeMode: true, snapVisibilityRadiusPx: 0 }
  });
  if (!wireframeEdgeSnap.snap) {
    console.error("FAILED: wireframe mode should allow otherwise hidden edge snap candidates");
    return 1;
  }
  const faceSnapSettings = {
    authoring: {
      snap: {
        enabled: true,
        strength: "normal",
        profiles: {
          normal: {
            includeSurfaceTargets: "faces"
          }
        }
      }
    }
  };
  const hiddenFaceSnapManager = createSnapManager({
    viewer: occludedPlateViewer,
    api: { project: () => plateSnapProject },
    settings: faceSnapSettings
  });
  const visiblePlateFaceViewer = {
    ...occludedPlateViewer,
    snapVisibilityAt: (screen) => ({
      depth: 4,
      point: [screen.x, screen.y, 4],
      normal: [0, 0, 1],
      face: { objectId: "snap_plate_1", normal: [0, 0, 1] }
    })
  };
  const visibleFaceSnapManager = createSnapManager({
    viewer: visiblePlateFaceViewer,
    api: { project: () => plateSnapProject },
    settings: faceSnapSettings
  });
  const visibleFaceSnap = visibleFaceSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 4],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (visibleFaceSnap.snap?.type !== "plate-face" || visibleFaceSnap.snap?.faceSide !== "front") {
    console.error(`FAILED: visible same-object front face snap should be accepted, got ${visibleFaceSnap.snap?.faceSide || visibleFaceSnap.snap?.label || "none"}`);
    return 1;
  }
  const visibleNearEdgeFaceSnap = visibleFaceSnapManager.resolve({
    screen: { x: 4, y: 4.5 },
    rawPoint: [4, 4.5, 4],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (visibleNearEdgeFaceSnap.candidates.some((candidate) => candidate.type === "plate-face" && candidate.faceSide !== "front")) {
    console.error("FAILED: adjacent plate side faces should not survive visibility filtering when cursor is on the front face");
    return 1;
  }
  const coarseOnlyVisibleViewer = {
    ...visiblePlateFaceViewer,
    snapVisibilityAt: () => ({
      depth: 4,
      point: null,
      face: { objectId: "snap_plate_1" }
    })
  };
  const coarseOnlyVisibleSnapManager = createSnapManager({
    viewer: coarseOnlyVisibleViewer,
    api: { project: () => plateSnapProject },
    settings: faceSnapSettings
  });
  const coarseOnlyVisibleSnap = coarseOnlyVisibleSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 4],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (coarseOnlyVisibleSnap.snap) {
    console.error(`FAILED: coarse object-only visibility should not allow surface snap, got ${coarseOnlyVisibleSnap.snap.label || coarseOnlyVisibleSnap.snap.type}`);
    return 1;
  }
  if (!coarseOnlyVisibleSnap.diagnostics.some((item) => item.reason === "missing precise visible surface")) {
    console.error("FAILED: coarse object-only visibility should report missing precise visible surface");
    return 1;
  }
  const emptyVisibleViewer = {
    ...visiblePlateFaceViewer,
    snapVisibilityAt: () => null
  };
  const emptyVisibleSnapManager = createSnapManager({
    viewer: emptyVisibleViewer,
    api: { project: () => plateSnapProject },
    settings: faceSnapSettings
  });
  const emptyVisibleSnap = emptyVisibleSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 4],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (emptyVisibleSnap.snap) {
    console.error(`FAILED: physical model snaps should not survive when no visible object is under cursor, got ${emptyVisibleSnap.snap.label || emptyVisibleSnap.snap.type}`);
    return 1;
  }
  if (!emptyVisibleSnap.diagnostics.some((item) => item.reason === "no visible scene object at snap point")) {
    console.error("FAILED: empty visible hit should report physical candidate visibility rejection");
    return 1;
  }
  const hiddenFaceSnap = hiddenFaceSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 4],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (hiddenFaceSnap.snap) {
    console.error(`FAILED: hidden same-object face snap should be depth-rejected, got ${hiddenFaceSnap.snap.label || hiddenFaceSnap.snap.type}`);
    return 1;
  }
  if (!hiddenFaceSnap.diagnostics.some((item) => item.type === "plate-face" && (item.reason === "hidden behind visible surface" || item.reason === "not the visible surface under cursor"))) {
    console.error("FAILED: hidden same-object face rejection should report visibility diagnostics");
    return 1;
  }
  const memberCenterlineProject = {
    model: {
      members: {
        snap_member_1: {
          id: "snap_member_1",
          type: "member",
          profile: "DEMO_FLAT_100X10",
          start: [0, 0, 0],
          end: [100, 0, 0],
          rotation: 0,
          featureIds: []
        }
      },
      plates: {},
      fastenerGroups: {},
      features: {},
      workPoints: {},
      referencePlanes: {},
      gridSystems: {}
    }
  };
  const memberFaceCenterlineCandidates = collectSnapCandidates({
    project: memberCenterlineProject,
    profiles,
    context: { includeGlobalAxes: false },
    scope: {},
    profile: { includeSurfaceTargets: "faces" },
    rawPoint: [25, 0, 5]
  }).filter((candidate) => candidate.type === "member-profile-face-centerline");
  if (!memberFaceCenterlineCandidates.length) {
    console.error("FAILED: member face centerline candidates should be generated for profile faces");
    return 1;
  }
  if (memberFaceCenterlineCandidates.some((candidate) => candidate.visibilityPolicy !== "visible-surface" || !candidate.snapFacePoints?.length || !candidate.bounds || !candidate.normal)) {
    console.error("FAILED: member face centerline snaps should carry visible-surface source-face metadata");
    return 1;
  }
  const memberTopFaceViewer = {
    projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
    screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] }),
    snapVisibilityAt: (screen) => ({
      depth: 5,
      point: [screen.x, screen.y, 5],
      normal: [0, 0, -1],
      face: { objectId: "snap_member_1", normal: [0, 0, -1] }
    })
  };
  const memberCenterlineSnapManager = createSnapManager({
    viewer: memberTopFaceViewer,
    api: { project: () => memberCenterlineProject },
    profiles,
    settings: faceSnapSettings
  });
  const visibleMemberFaceCenterlineSnap = memberCenterlineSnapManager.resolve({
    screen: { x: 25, y: 0 },
    rawPoint: [25, 0, 5],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (visibleMemberFaceCenterlineSnap.snap?.type !== "member-profile-face-centerline") {
    console.error(`FAILED: visible member face centerline should be selectable when its source face is visible, got ${visibleMemberFaceCenterlineSnap.snap?.label || "none"}`);
    return 1;
  }
  if (visibleMemberFaceCenterlineSnap.candidates.some((candidate) => (
    candidate.type === "member-profile-face-centerline"
      && Math.abs((candidate.point?.[2] ?? 0) - 5) > 0.001
  ))) {
    console.error("FAILED: hidden member face centerlines should not survive visible-surface filtering");
    return 1;
  }
  if (!visibleMemberFaceCenterlineSnap.diagnostics.some((item) => item.type === "member-profile-face-centerline" && (item.reason === "hidden behind visible surface" || item.reason === "not the visible surface under cursor"))) {
    console.error("FAILED: hidden member face centerline rejection should report source-face visibility diagnostics");
    return 1;
  }
  const wireframeMemberCenterlineSnap = memberCenterlineSnapManager.resolve({
    screen: { x: 25, y: 0 },
    rawPoint: [25, 0, 5],
    context: { includeGlobalAxes: false, wireframeMode: true, snapVisibilityRadiusPx: 0 }
  });
  if (wireframeMemberCenterlineSnap.candidates.filter((candidate) => candidate.type === "member-profile-face-centerline").length < 2) {
    console.error("FAILED: wireframe mode should keep overlapping member face centerline candidates");
    return 1;
  }
  const overlappingPlateSnapProject = {
    model: {
      members: {},
      plates: {
        back_plate: {
          id: "back_plate",
          type: "plate",
          center: [0, 0, 0],
          normal: [0, 0, 1],
          localAxisY: [1, 0, 0],
          localAxisZ: [0, 1, 0],
          thickness: 8,
          sketch: sketchFromRectangle(20, 10, "back_plate")
        },
        front_plate: {
          id: "front_plate",
          type: "plate",
          center: [0, 0, 10],
          normal: [0, 0, 1],
          localAxisY: [1, 0, 0],
          localAxisZ: [0, 1, 0],
          thickness: 8,
          sketch: sketchFromRectangle(20, 10, "front_plate")
        }
      },
      fastenerGroups: {},
      features: {},
      workPoints: {},
      referencePlanes: {},
      gridSystems: {}
    }
  };
  const frontPlateViewer = {
    projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
    screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] }),
    snapVisibilityAt: (screen) => ({
      depth: 14,
      point: [screen.x, screen.y, 14],
      normal: [0, 0, 1],
      face: { objectId: "front_plate", normal: [0, 0, 1] }
    })
  };
  const overlappingSnapManager = createSnapManager({
    viewer: frontPlateViewer,
    api: { project: () => overlappingPlateSnapProject },
    settings: faceSnapSettings
  });
  const overlappingSnap = overlappingSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 14],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (overlappingSnap.snap?.objectId !== "front_plate" || overlappingSnap.snap?.type !== "plate-face" || overlappingSnap.snap?.faceSide !== "front") {
    console.error(`FAILED: snap manager should select the visible front plate surface, got ${overlappingSnap.snap?.objectId || "none"}:${overlappingSnap.snap?.type || "none"}:${overlappingSnap.snap?.faceSide || "none"}`);
    return 1;
  }
  if (overlappingSnap.candidates.some((candidate) => candidate.objectId === "back_plate")) {
    console.error("FAILED: hidden back plate candidates should be removed before snap ranking");
    return 1;
  }
  const wireframeFaceSnap = hiddenFaceSnapManager.resolve({
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 0],
    context: { includeGlobalAxes: false, wireframeMode: true, snapVisibilityRadiusPx: 0 }
  });
  if (!wireframeFaceSnap.candidates.some((candidate) => candidate.type === "plate-face")) {
    console.error(`FAILED: wireframe mode should keep otherwise hidden face candidates, got ${wireframeFaceSnap.snap?.label || "none"}`);
    return 1;
  }
  const plateFaceSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 3, y: 2 },
    rawPoint: [3, 2, 4],
    candidates: [plateFace],
    screenTolerance: 5,
    projectionPriorityBiasPx: 5
  });
  if (plateFaceSnap.snap?.type !== "plate-face") {
    console.error(`FAILED: plate face plane should be snap-solvable, got ${plateFaceSnap.snap?.label || "none"}`);
    return 1;
  }
  const plateInteriorSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 4, y: 0 },
    rawPoint: [4, 0, 4],
    candidates: plateCandidates,
    screenTolerance: 5,
    pointPriorityBiasPx: 12,
    linePriorityBiasPx: 10,
    projectionPriorityBiasPx: 5
  });
  if (plateInteriorSnap.snap?.type !== "plate-face") {
    console.error(`FAILED: plate interior should prefer plate face over nearby plate center/edges, got ${plateInteriorSnap.snap?.label || "none"}`);
    return 1;
  }
  const plateEdgeSnap = solveSnap({
    viewer: snapViewer,
    screen: { x: 4, y: 4.5 },
    rawPoint: [4, 4.5, 4],
    candidates: plateCandidates,
    screenTolerance: 5,
    pointPriorityBiasPx: 12,
    linePriorityBiasPx: 10,
    projectionPriorityBiasPx: 5
  });
  if (plateEdgeSnap.snap?.type === "plate-face") {
    console.error("FAILED: plate face should not override snaps very close to a plate edge");
    return 1;
  }
  const plateFaceOverlay = snapPointOverlay({
    snap: plateFaceSnap.snap,
    rawPoint: [3, 2, 4],
    settings: { snapColor: "#38bdf8" }
  });
  if (plateFaceOverlay.faces.length !== 1 || plateFaceOverlay.faces[0].sourceType !== "plate-face") {
    console.error("FAILED: plate face snap should create one highlighted face");
    return 1;
  }
  if (plateFaceOverlay.faces[0].depthTest !== true) {
    console.error("FAILED: plate face snap highlight should be depth-tested, not x-ray");
    return 1;
  }
  const stairProject = readJson(path.join(ROOT, "bobercad", "data", "projects", "sample_stair_treads_and_landings_only_all_variants.json"));
  const stairVisibleTreadViewer = {
    projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
    screenRay: (x, y) => ({ origin: [x, y, 10000], direction: [0, 0, -1] }),
    snapVisibilityAt: (screen) => ({
      depth: 214,
      point: [screen.x, screen.y, 214],
      normal: [0, 0, 1],
      face: { objectId: "sc_stair_system_treads_wood_tread_1", normal: [0, 0, 1] }
    })
  };
  const stairSnapManager = createSnapManager({
    viewer: stairVisibleTreadViewer,
    api: { project: () => stairProject },
    settings: faceSnapSettings
  });
  const stairVisibleTreadSnap = stairSnapManager.resolve({
    screen: { x: 142.5, y: 0 },
    rawPoint: [142.5, 0, 214],
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (stairVisibleTreadSnap.snap?.objectId !== "sc_stair_system_treads_wood_tread_1" || stairVisibleTreadSnap.snap?.faceSide !== "front") {
    console.error(`FAILED: stair demo snap should choose the visible wood tread top face, got ${stairVisibleTreadSnap.snap?.objectId || "none"}:${stairVisibleTreadSnap.snap?.faceSide || "none"}`);
    return 1;
  }
  if (stairVisibleTreadSnap.candidates.some((candidate) => candidate.objectId === "sc_stair_system_treads_tread_1")) {
    console.error("FAILED: stair demo lower metal tread candidates should not survive visible-surface filtering under the wood tread");
    return 1;
  }
  const snapFaceOverlay = snapPointOverlay({
    snap: {
      kind: "plane",
      type: "member-profile-face",
      label: "Member face",
      objectId: "snap_face_test_member",
      point: [5, 5, 0],
      points: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]
    },
    rawPoint: [5, 4, 0],
    settings: { snapColor: "#38bdf8" }
  });
  if (snapFaceOverlay.faces.length !== 1 || snapFaceOverlay.faces[0].points.length !== 4) {
    console.error(`FAILED: member face snap should create one highlighted face, got ${snapFaceOverlay.faces.length}`);
    return 1;
  }
  const snapFaceCenterlineOverlay = snapPointOverlay({
    snap: {
      kind: "line",
      type: "member-profile-face-centerline",
      label: "Member face centerline",
      objectId: "snap_face_test_member",
      point: [5, 5, 0],
      a: [0, 5, 0],
      b: [10, 5, 0],
      snapFacePoints: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]]
    },
    rawPoint: [5, 4, 0],
    settings: { snapColor: "#38bdf8" }
  });
  if (snapFaceCenterlineOverlay.faces.length !== 1 || snapFaceCenterlineOverlay.faces[0].sourceType !== "member-profile-face-centerline") {
    console.error("FAILED: member face centerline snap should highlight its source face");
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
