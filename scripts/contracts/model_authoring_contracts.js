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
    projection: faceViewer,
    screen: faceViewer.projectPoint(memberFaceCandidate.point),
    rawPoint: memberFaceCandidate.point,
    screenTolerance: 16
  });
  if (faceSnap.snap?.type !== "member-profile-face" || !faceSnap.diagnostics?.some((diagnostic) => diagnostic.status === "accepted" && diagnostic.reason === "selected by rank/cycle")) {
    fail(errors, "member authoring api: bounded member face planes must resolve through solveSnap with accepted diagnostics");
  }
  const cappedIntersectionSnap = snapSolverApi.solveSnap({
    candidates,
    projection: faceViewer,
    screen: { x: 0, y: 0 },
    rawPoint: [0, 0, 0],
    screenTolerance: 100000,
    intersectionTolerancePx: 100000,
    maxIntersectionSources: 4
  });
  const cappedIntersections = (cappedIntersectionSnap.candidates || []).filter((candidate) => candidate.intersectionSemanticType === "axis-intersection").length;
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

module.exports = {
  checkMemberAuthoringApi,
  checkGenericPathApi,
  checkGenericSolverApi,
  checkGenericComplianceApi,
  checkGenericSectioningApi
};
