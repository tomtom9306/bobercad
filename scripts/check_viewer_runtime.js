const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { assertNavCubeCameraRotations, createDetailFreeMemberProject, readJson } = require("./contracts/viewer_runtime_contract_helpers");

const ROOT = path.resolve(__dirname, "..");
const RUN_VIEWER_RUNTIME_CHECKS = process.env.BOBERCAD_RUN_VIEWER_RUNTIME_CHECKS === "1";

if (!RUN_VIEWER_RUNTIME_CHECKS) {
  console.log("OK: viewer runtime checks skipped. Set BOBERCAD_RUN_VIEWER_RUNTIME_CHECKS=1 to run them.");
  process.exit(0);
}

async function main() {
  const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "scene-geometry-builder.mjs")).href);
  const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "store", "project-command-store.mjs")).href);
  const { createGeometryApi } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "model", "geometry.mjs")).href);
  const { createCheckApi } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "model", "checks.mjs")).href);
  const { evaluateWeld } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "evaluators", "weld-evaluator.mjs")).href);
  const { build: buildSecondaryWebBolting } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "model", "connection-primitives", "fasteners", "secondary-web-bolting.mjs")).href);
  const { createCamera } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "camera.mjs")).href);
  const { navCubeRotationForCameraAngles } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "nav-cube.mjs")).href);
  const { ccwPoints } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "csg.mjs")).href);
  const { cutBodiesForFeature } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "cut-features.mjs")).href);
  const { faceNormal, signedArea2d, triangulateFace } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "polygon.mjs")).href);
  const { solveSnap } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "interaction", "snap-solver.mjs")).href);
  const {
    filletSketchCorner,
    flipSketchEdgeArc,
    insertPlateSketchVertex,
    insertSketchVertex,
    removeSketchVertex,
    setPlateSketchEdgeRadius,
    setPlateSketchEdgeRadiusMode,
    setPlateSketchVertices,
    setSketchEdgeAngle,
    setSketchEdgeArc,
    setSketchEdgeLength,
    setSketchEdgeRadius,
    setSketchPointDistance,
    setSketchVertex,
    sketchEdgeIsCircularArc,
    sketchEdgeMidpoint,
    sketchEdgeSamplePoints,
    sketchEdgeTangentAtVertex,
    sketchEdges,
    sketchFromCenterArc,
    sketchFromRectangle,
    sketchFromRoundedRectangle,
    canonicalPlateCornerReliefType,
    cornerReliefRequiredFields,
    plateCornerReliefs,
    resolvePlateCornerReliefSpec,
    sketchRelationHealth,
    sketchRelations,
    sketchVertices,
    splitSketchEdgeArc,
    upsertSketchRelation
  } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "project", "plate-sketch-relations-and-bends.mjs")).href);
  const { dimensionOverlayForPlate } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch", "dimension-overlay.mjs")).href);
  const { overlayForPlate, relationActionOverlayForSelection } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch", "drag-edit-overlays.mjs")).href);
  const { edgeDragContext, edgeSnapCandidates, vertexDragContext, vertexSnapCandidates } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch", "drag-edit-snap.mjs")).href);
  const { collectSnapCandidates } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-candidate-providers.mjs")).href);
  const { createSnapManager } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-manager.mjs")).href);
  const { createCommandController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "command-controller.mjs")).href);
  const { createMemberCreateController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "member-create-controller.mjs")).href);
  const { createPlateCreateController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-create-controller.mjs")).href);
  const { createPlateBendController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-bend-controller.mjs")).href);
  const { createPlateSketchEditController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch-drag-edit-controller.mjs")).href);
  const { inspectorEditableObjectPropertySections } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "commands", "inspector-editable-object-property-metadata.mjs")).href);
  const { inspectorActiveToolSections } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "commands", "inspector-property-metadata.mjs")).href);
  const { commandPaletteSpecs } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "commands", "command-registry.mjs")).href);
  const { createViewerAppController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-app-controller.mjs")).href);
  const { createViewerCommandRegistration } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-command-registration.mjs")).href);
  const { snapAxisSourceLines, snapPointOverlay } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "authoring", "snap-overlays.mjs")).href);
  const { plateBendGeometry } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "plate-bend-geometry.mjs")).href);
  const { evaluateCornerReliefSites } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "relief-sites.mjs")).href);
  const { applyReliefCutoutsToCharts, buildClippedReliefChartDomains, buildReliefCutout2d, buildReliefCutoutsForCharts, circularCutoutEquationError, resolveReliefSpecsForSites } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "relief-cutouts.mjs")).href);
  const { buildPlateSheetCharts } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "sheet-charts.mjs")).href);
  const { chartReliefGeometrySupport, evaluateBentPlateChartGeometry, evaluateBentPlateChartGeometryFromEvaluation } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "chart-scene-geometry.mjs")).href);
  const { chartDomainBoundary2d } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "chart-domain.mjs")).href);
  const { buildSmartComponentDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "annotations", "build-dimensions.mjs")).href);
  const { loadSmartComponentDefinitions, smartComponentDefinition } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "modules", "smart-components", "smart-component-registry.mjs")).href);
  const settingsPath = path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-settings.json");
  const viewerQaBridgeSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-qa-bridge.mjs"), "utf8");
  const viewerRuntimeSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-runtime.mjs"), "utf8");
  const viewerCommandRegistrationSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-command-registration.mjs"), "utf8");
  const viewerWorkspaceBindingsSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-workspace-bindings.mjs"), "utf8");
  const webglViewerRuntimeSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "webgl-viewer-runtime.mjs"), "utf8");
  const webglRenderOrchestratorSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "webgl-render-orchestrator.mjs"), "utf8");
  const webglPickerSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "webgl-picker.mjs"), "utf8");
  const modelingToolbarSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "toolbar", "modeling-toolbar.mjs"), "utf8");
  const dragEditOverlaysSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch", "drag-edit-overlays.mjs"), "utf8");
  const plateSketchInspectorSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "viewer", "panels", "contributions", "plate-sketch-inspector.mjs"), "utf8");
  const inspectorEditableObjectPropertySource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "ui", "commands", "inspector-editable-object-property-metadata.mjs"), "utf8");
  const sheetChartsSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "sheet-charts.mjs"), "utf8");
  const chartSceneGeometrySource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "chart-scene-geometry.mjs"), "utf8");
  const chartDomainSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "chart-domain.mjs"), "utf8");
  const sceneObjectGeometryAdapterSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "scene", "scene-object-geometry-adapters.mjs"), "utf8");
  const plateBendGeometrySource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "rendering", "scene", "plate-bend-geometry.mjs"), "utf8");
  const settings = readJson(settingsPath);
  const viewerSettingsSchema = readJson(path.join(ROOT, "bobercad", "app", "schemas", "viewer-settings.schema.json"));
  if (!(settings.render?.curves?.segmentLength > 0)) {
    console.error("FAILED: viewer settings should define render.curves.segmentLength as the display tessellation segment length");
    return 1;
  }
  const reliefEvaluatorModes = viewerSettingsSchema.properties?.geometry?.properties?.sheetMetalReliefEvaluator?.enum || [];
  if (
    reliefEvaluatorModes.includes("charts-circular")
      || reliefEvaluatorModes.includes("charts")
      || !reliefEvaluatorModes.includes("legacy")
      || !reliefEvaluatorModes.includes("charts-supported")
      || sceneObjectGeometryAdapterSource.includes('mode === "charts-circular"')
      || sceneObjectGeometryAdapterSource.includes('mode === "charts"')
  ) {
    console.error("FAILED: sheet-metal relief evaluator settings should expose only charts-supported plus explicit legacy migration mode, not old chart aliases");
    return 1;
  }
  if (
    !viewerCommandRegistrationSource.includes('new Set(["plateBend", "trim"])')
      || !viewerWorkspaceBindingsSource.includes("revealInspectorDock();")
      || !viewerWorkspaceBindingsSource.includes('dock.dataset.workspacePanelRevealed = "true"')
  ) {
    console.error("FAILED: Plate Bend active command should keep the Properties side dock visible and force-reveal it when Bend Properties opens");
    return 1;
  }
  if (
    !webglViewerRuntimeSource.includes("displayOnlySamplePoints")
      || !webglViewerRuntimeSource.includes("screenPointNearAny(cursor, projectedDisplayOnlyPoints, displayOnlyTolerance)")
  ) {
    console.error("FAILED: WebGL authoring picker should ignore display-only sampled arc points so visual tessellation corners are not edge grab handles");
    return 1;
  }
  if (
    !viewerRuntimeSource.includes("face.cornerReliefVertexId")
      || !viewerRuntimeSource.includes("cornerReliefVertexId: face.cornerReliefVertexId")
      || !viewerRuntimeSource.includes("vertexIds: [face.cornerReliefVertexId]")
  ) {
    console.error("FAILED: viewer runtime should route clicked 3D corner relief faces into the selected Corner Relief properties state");
    return 1;
  }
  if (
    inspectorEditableObjectPropertySource.includes("inspectorCornerReliefResolvedSpec")
      || inspectorEditableObjectPropertySource.includes("positiveOr(relief?.radius")
      || inspectorEditableObjectPropertySource.includes("positiveOr(relief?.width")
      || inspectorEditableObjectPropertySource.includes("positiveOr(relief?.depth")
  ) {
    console.error("FAILED: Corner Relief properties should not carry a private dimension resolver; effective dimensions must come from model resolved state");
    return 1;
  }
  if (chartSceneGeometrySource.includes("for (const cutout of evaluation.cutouts || [])")) {
    console.error("FAILED: chart scene bend geometry should consume chart-local cutoutApplications instead of rediscovering cutouts from global evaluation state");
    return 1;
  }
  if (
    chartSceneGeometrySource.includes("endpointInsetAtU")
      || chartSceneGeometrySource.includes("profile.edgeInsetAt")
  ) {
    console.error("FAILED: chart scene bend geometry should render from clippedBoundary2d instead of recomputing endpoint relief insets from cutout profiles");
    return 1;
  }
  if (
    chartSceneGeometrySource.includes("sheet-metal.chart-domain.multi-interval")
      || !chartSceneGeometrySource.includes("sheet-metal.chart-domain.odd-horizontal-intersections")
      || !chartSceneGeometrySource.includes("pairedRowIntervals")
      || !chartSceneGeometrySource.includes("for (const [current, next] of pairedRowIntervals")
      || !chartSceneGeometrySource.includes("horizontalBoundaryIntervals(boundary, u, length)")
  ) {
    console.error("FAILED: chart scene bend geometry should render supported multi-interval developed bend domains and reject only invalid odd horizontal intersections");
    return 1;
  }
  const chartEvaluatedReturnIndex = sceneObjectGeometryAdapterSource.indexOf("return addChartEvaluatedBentPlate(scene, plate, color, edgeColor, meta);");
  const legacyPlateBendGeometryIndex = sceneObjectGeometryAdapterSource.indexOf("const geometry = plateBendGeometry(plate, scene.tessellation);");
  if (
    chartEvaluatedReturnIndex < 0
      || legacyPlateBendGeometryIndex < 0
      || chartEvaluatedReturnIndex > legacyPlateBendGeometryIndex
      || !sceneObjectGeometryAdapterSource.includes('sheetMetalReliefEvaluatorMode(scene) === "legacy" && chartSupportHasActiveRelief(chartSupport)')
      || !sceneObjectGeometryAdapterSource.includes("legacy sheet-metal relief evaluator is disabled for active corner reliefs")
  ) {
    console.error("FAILED: supported chart-evaluated bent plates should return before the scene adapter can call legacy plateBendGeometry");
    return 1;
  }
  const legacySceneReliefSymbols = [
    "endpointReliefs",
    "cornerReliefSideFaceMetaByEdge",
    "start-relief-wall",
    "end-relief-wall",
    "startReliefCut",
    "endReliefCut",
    "circularEndpointRelief"
  ];
  if (legacySceneReliefSymbols.some((symbol) => sceneObjectGeometryAdapterSource.includes(symbol))) {
    console.error("FAILED: scene-object geometry adapter should not rebuild corner relief side walls or metadata from legacy bend strips");
    return 1;
  }
  const legacyPlateReliefSymbols = [
    "evaluateLegacyCornerReliefs",
    "reliefAdjustedOutline2d",
    "reliefCornerPoints",
    "reliefCornerPoints3",
    "anchoredReliefCornerPoints",
    "projectedReliefInsetAtBendOffset",
    "projectedBendEndpointPoint",
    "cornerReliefEndpointTrim",
    "cornerReliefCoreEndpointTrim",
    "plateCornerReliefs(plate)"
  ];
  if (legacyPlateReliefSymbols.some((symbol) => plateBendGeometrySource.includes(symbol))) {
    console.error("FAILED: legacy plateBendGeometry should not contain an alternate corner relief evaluator; relief geometry belongs to the sheet-metal chart pipeline");
    return 1;
  }
  const reliefCutoutsSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "engine", "geometry", "sheet-metal", "relief-cutouts.mjs"), "utf8");
  const cornerReliefsSource = fs.readFileSync(path.join(ROOT, "bobercad", "app", "engine", "api", "project", "plate-sketch", "corner-reliefs.mjs"), "utf8");
  if (
    !reliefCutoutsSource.includes("function clipChartDomainByCutouts")
      || !reliefCutoutsSource.includes("domainClip")
      || !reliefCutoutsSource.includes("chartDomain2d")
      || !reliefCutoutsSource.includes("differenceSingleLoopChartDomainByCutoutRegions")
      || reliefCutoutsSource.includes("differenceSingleLoopChartDomain(")
      || reliefCutoutsSource.includes("createSingleLoopChartDomain")
      || reliefCutoutsSource.includes("boundaryReplacement")
      || reliefCutoutsSource.includes("endpoint-flange-overlap-step-domain")
      || reliefCutoutsSource.includes("endpointExtensionStartHeight")
      || reliefCutoutsSource.includes("touchExtension")
      || reliefCutoutsSource.includes("contactSide")
      || reliefCutoutsSource.includes("endpointTouchContactForChart")
      || !chartDomainSource.includes("supportedTopology")
      || !sheetChartsSource.includes("createSingleLoopChartDomain")
      || !sheetChartsSource.includes("chartDomain2d")
      || !chartDomainSource.includes("createSingleLoopPolygonSet2d")
      || !chartDomainSource.includes("differenceSingleLoopChartDomainByCutoutRegions")
      || !chartDomainSource.includes("function differenceSingleLoopByOneCutoutRegion")
      || !chartDomainSource.includes("simple-polygon-segment-graph")
      || chartDomainSource.includes("export function differenceSingleLoopChartDomain(")
      || chartDomainSource.includes("boundary-replacement-difference")
      || chartDomainSource.includes("replacementInterval(")
      || chartDomainSource.includes("cutoutRegionIntervalFromGeometry")
      || chartDomainSource.includes("normalizedCutoutInterval")
      || chartDomainSource.includes("domainNodesBetween")
      || chartDomainSource.includes("booleanBackend: metadata.booleanBackend || \"single-loop-region-boundary-walk\"")
      || !chartDomainSource.includes('domainOperation: "cutout-region-difference"')
      || !reliefCutoutsSource.includes("cutoutRegion2d")
      || !reliefCutoutsSource.includes("appliedCutoutApplications")
      || !reliefCutoutsSource.includes("sourceCutoutRegion2d")
      || !chartSceneGeometrySource.includes("chartRuntimeDomain")
      || !chartSceneGeometrySource.includes("chartDomainDiagnostics(domain, chart)")
      || chartSceneGeometrySource.includes("legacy-boundary-array")
      || chartSceneGeometrySource.includes("createSingleLoopChartDomain")
      || sceneObjectGeometryAdapterSource.includes("chartSupportLegacyFallbackReason")
      || reliefCutoutsSource.includes("function boundaryFromNodes")
      || reliefCutoutsSource.includes("function appendNode(nodes")
      || reliefCutoutsSource.includes('const boundary = chart.kind === "base"')
      || !cornerReliefsSource.includes("PLATE_CORNER_RELIEF_PROPERTY_TABLE")
      || cornerReliefsSource.includes("function resolvedDimension")
      || cornerReliefsSource.includes("relief || defaultPlateCornerRelief")
      || inspectorEditableObjectPropertySource.includes("unresolvedCornerReliefSpec")
      || inspectorEditableObjectPropertySource.includes("switch (resolved.type)")
  ) {
    console.error("FAILED: relief cutout clipping should route every chart through one runtime chart-domain clipping entrypoint with explicit strategy metadata, and corner relief properties should come from the model property table instead of local fallbacks");
    return 1;
  }
  if (
    !dragEditOverlaysSource.includes('kind: "plate-corner-relief"')
      || !viewerRuntimeSource.includes('input?.handle?.kind === "plate-corner-relief"')
      || !viewerRuntimeSource.includes("cornerReliefVertexId: vertexId")
  ) {
    console.error("FAILED: selected bent plates should expose a clickable corner relief authoring marker routed to Corner Relief properties");
    return 1;
  }
  if (
    !webglRenderOrchestratorSource.includes("for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1)")
      || !webglRenderOrchestratorSource.includes("clipPoint(points[pointIndex - 1])")
      || !webglRenderOrchestratorSource.includes("clipPoint(points[pointIndex])")
  ) {
    console.error("FAILED: WebGL authoring line renderer should draw every sampled segment so hovered circular arcs highlight as one full arc");
    return 1;
  }
  const geometryApi = createGeometryApi();
  const navCubeRotationError = assertNavCubeCameraRotations(navCubeRotationForCameraAngles);
  if (navCubeRotationError) {
    console.error(navCubeRotationError);
    return 1;
  }
  const projectPath = path.resolve(path.dirname(settingsPath), settings.project.path);
  const project = readJson(projectPath);
  const profiles = readJson(path.resolve(path.dirname(projectPath), project.libraries.profiles.path));
  const fasteners = readJson(path.resolve(path.dirname(projectPath), project.libraries.fasteners.path));
  const scene = buildScene(project, profiles, fasteners, settings);
  const pointKey = (point) => point.map((value) => Math.round(value * 1000) / 1000).join(",");
  const pointProjectedToSegment = (point, from, to) => {
    const line = [to[0] - from[0], to[1] - from[1]];
    const lengthSq = line[0] * line[0] + line[1] * line[1];
    if (lengthSq <= 1e-9) return [...from];
    const relative = [point[0] - from[0], point[1] - from[1]];
    const t = Math.max(0, Math.min(1, (relative[0] * line[0] + relative[1] * line[1]) / lengthSq));
    return [
      from[0] + line[0] * t,
      from[1] + line[1] * t
    ];
  };
  const sceneGeometrySignature = (sourceScene) => ({
    faces: sourceScene.faces.map((face) => face.points.map(pointKey).sort().join("|")).sort(),
    lines: sourceScene.lines.map((line) => line.points.map(pointKey).sort().join("|")).sort()
  });
  const trimProjectPath = path.join(ROOT, "bobercad", "data", "projects", "sample_connection_test_frame.json");
  const trimProject = readJson(trimProjectPath);
  const trimProfiles = readJson(path.resolve(path.dirname(trimProjectPath), trimProject.libraries.profiles.path));
  const trimFasteners = readJson(path.resolve(path.dirname(trimProjectPath), trimProject.libraries.fasteners.path));
  const trimResult = createProjectStore({ project: trimProject }).createTrimJoint({
    memberIds: ["column_c1", "beam_b1_south"],
    operationType: "end-butt-both"
  });
  const trimScene = buildScene(trimResult.project, trimProfiles, trimFasteners, settings);
  if (!Object.prototype.hasOwnProperty.call(trimResult.project.model.trimJoints || {}, trimResult.trimJointId)) {
    console.error("FAILED: trim create should store the new trim joint");
    return 1;
  }
  if (!trimScene.lines.some((line) => line.collection === "trimJoints" && line.objectId === trimResult.trimJointId)) {
    console.error("FAILED: created member-to-member trim should render trim markers");
    return 1;
  }

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
  const evaluatedMemberEdges = scene.lines.filter((line) => line.snapRole === "member-evaluated-edge");
  if (!evaluatedMemberEdges.length) {
    console.error("FAILED: detailed member CSG edges should expose evaluated snap edges");
    return 1;
  }
  const evaluatedCutEdge = evaluatedMemberEdges.find((line) => (
    line.edgeRef?.kind === "evaluated-edge"
      && line.edgeRef.owner?.collection === "members"
      && line.edgeRef.owner?.objectId === line.objectId
      && line.edgeRef.surfaces?.some((surface) => surface.kind === "cut-face" && surface.featureId)
  ));
  if (!evaluatedCutEdge) {
    console.error("FAILED: boolean/notched member edges should carry cut-face provenance in edgeRef");
    return 1;
  }
  const evaluatedCutCutEdge = evaluatedMemberEdges.find((line) => (
    (line.edgeRef?.surfaces || []).filter((surface) => surface.kind === "cut-face" && surface.featureId).length >= 2
  ));
  if (!evaluatedCutCutEdge) {
    console.error("FAILED: intersecting/notch-on-notch cuts should preserve both cut-face refs on evaluated edges");
    return 1;
  }
  if (JSON.stringify(evaluatedCutEdge.edgeRef).includes("[") && evaluatedCutEdge.edgeRef.points) {
    console.error("FAILED: evaluated edgeRef must not store generated mesh coordinates");
    return 1;
  }
  const evaluatedCutEdgeMid = evaluatedCutEdge.points.reduce((sum, point) => (
    [sum[0] + point[0] / evaluatedCutEdge.points.length, sum[1] + point[1] / evaluatedCutEdge.points.length, sum[2] + point[2] / evaluatedCutEdge.points.length]
  ), [0, 0, 0]);
  const evaluatedEdgeCandidates = collectSnapCandidates({
    project,
    profiles,
    context: {
      includeGlobalAxes: false,
      evaluatedEdges: [evaluatedCutEdge]
    },
    scope: {},
    profile: { includeSurfaceTargets: "edges" },
    rawPoint: evaluatedCutEdgeMid
  }).filter((candidate) => candidate.type?.startsWith("member-evaluated-edge"));
  if (!evaluatedEdgeCandidates.some((candidate) => candidate.target?.edgeRef?.kind === "evaluated-edge")) {
    console.error("FAILED: evaluated member edge snap candidates should carry stable edgeRef targets");
    return 1;
  }
  const evaluatedEdgeSnapManager = createSnapManager({
    viewer: {
      projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
      screenRay: (x, y) => ({ origin: [x, y, 100000], direction: [0, 0, -1] }),
      snapVisibilityAt: () => ({
        depth: evaluatedCutEdgeMid[2],
        point: evaluatedCutEdgeMid,
        face: { objectId: evaluatedCutEdge.objectId }
      }),
      evaluatedSnapEdges: ({ objectIds = [] } = {}) => (
        objectIds.includes(evaluatedCutEdge.objectId) ? [evaluatedCutEdge] : []
      )
    },
    api: { project: () => project },
    profiles,
    settings
  });
  const evaluatedEdgeSnap = evaluatedEdgeSnapManager.resolve({
    screen: { x: evaluatedCutEdgeMid[0], y: evaluatedCutEdgeMid[1] },
    rawPoint: evaluatedCutEdgeMid,
    context: { includeGlobalAxes: false, snapVisibilityRadiusPx: 0 }
  });
  if (!evaluatedEdgeSnap.snap?.type?.startsWith("member-evaluated-edge") || evaluatedEdgeSnap.snap?.target?.edgeRef?.kind !== "evaluated-edge") {
    console.error(`FAILED: snap manager should resolve visible cut/notch edges through evaluated edgeRef candidates, got ${evaluatedEdgeSnap.snap?.type || "none"}`);
    return 1;
  }

  const largeCount = 6000;
  const stressProfileId = Object.keys(profiles.profiles)[0];
  const largeProject = createDetailFreeMemberProject(project, stressProfileId, {
    count: largeCount,
    idPrefix: "stress_member",
    name: "Synthetic Large Member Scene",
    spacing: 12,
    baseLength: 1000,
    lengthJitter: 0.01
  });
  const largeScene = buildScene(largeProject, profiles, fasteners, settings);
  if (largeScene.memberInstances.length !== largeCount) {
    console.error(`FAILED: detail-free members should use the instanced path, got ${largeScene.memberInstances.length}/${largeCount}`);
    return 1;
  }
  if (largeScene.faces.length) {
    console.error(`FAILED: detail-free synthetic members should not build exact member faces, got ${largeScene.faces.length}`);
    return 1;
  }

  const smallProject = createDetailFreeMemberProject(project, stressProfileId, {
    count: 2,
    idPrefix: "simple_member",
    name: "Synthetic Small Member Scene",
    spacing: 1200,
    baseLength: 900
  });
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
  let plateLikeOverlay = null;
  let editablePlateLikeProject = JSON.parse(JSON.stringify(plateLikeProject));
  const plateLikeEditApi = {
    project: () => editablePlateLikeProject,
    subscribe: () => {},
    setFeatureBody: (featureId, patch) => {
      editablePlateLikeProject = JSON.parse(JSON.stringify(editablePlateLikeProject));
      const feature = editablePlateLikeProject.model.features?.[featureId];
      if (!feature) throw new Error(`feature not found: ${featureId}`);
      feature.body = { ...feature.body, ...patch };
      return editablePlateLikeProject;
    },
    updatePlate: (plateId, patch) => {
      editablePlateLikeProject = JSON.parse(JSON.stringify(editablePlateLikeProject));
      const plate = editablePlateLikeProject.model.plates?.[plateId];
      if (!plate) throw new Error(`plate not found: ${plateId}`);
      Object.assign(plate, patch);
      return editablePlateLikeProject;
    }
  };
  const plateLikeSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        plateLikeOverlay = overlay;
      },
      screenScale: () => 1
    },
    api: plateLikeEditApi,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      editablePlateLikeProject = nextProject;
    }
  });
  if (!plateLikeSketchEdit.selectObject("plate_like_cut", { sketchMode: "clean" })) {
    console.error("FAILED: polygonal cutting body should select as a plate-like sketch target");
    return 1;
  }
  if (!plateLikeOverlay?.handles?.some((handle) => handle.kind === "plate-sketch-center")) {
    console.error("FAILED: plate-like cutting body sketch overlay should expose a movable center handle");
    return 1;
  }
  if (!plateLikeOverlay.handles.some((handle) => handle.kind === "plate-sketch-vertex") || !plateLikeOverlay.labels?.some((label) => label.dimensionId?.includes(":length"))) {
    console.error("FAILED: plate-like cutting body sketch overlay should expose plate sketch vertices and dimensions");
    return 1;
  }
  const cutVertexHandle = plateLikeOverlay.handles.find((handle) => handle.kind === "plate-sketch-vertex");
  cutVertexHandle.dragAxesScreen = {
    x: { unit: { x: 1, y: 0 }, scalePxPerWorld: 1 },
    y: { unit: { x: 0, y: 1 }, scalePxPerWorld: 1 }
  };
  if (!plateLikeSketchEdit.authoringHandler.beginDrag({ handle: cutVertexHandle, event: { button: 0, detail: 1 }, modifiers: {} })) {
    console.error("FAILED: plate-like cutting body sketch vertex should begin drag");
    return 1;
  }
  plateLikeSketchEdit.authoringHandler.drag({ totalDx: 10, totalDy: 0, dx: 10, dy: 0, screen: { x: 0, y: 0 } });
  plateLikeSketchEdit.authoringHandler.end();
  const movedCutOutline = editablePlateLikeProject.model.features.plate_like_cut.body.outline;
  if (!Array.isArray(movedCutOutline) || Math.abs(movedCutOutline[0][0] - -40) > 1e-6) {
    console.error(`FAILED: plate-like cutting body vertex drag should update body.outline, got ${JSON.stringify(movedCutOutline)}`);
    return 1;
  }

  const roundedCutBodySketch = sketchFromRoundedRectangle(100, 50, 12, "rounded_cut_body", [0, 0]);
  const roundedCutBodyFeature = {
    id: "rounded_cut_body",
    type: "boolean-part",
    booleanType: "BOOLEAN_CUT",
    ownerId: "rounded_cut_source",
    body: {
      type: "polygonal-prism",
      center: [0, 0, 0],
      axisX: [1, 0, 0],
      axisY: [0, 1, 0],
      axisZ: [0, 0, 1],
      depth: 40,
      sketch: roundedCutBodySketch
    }
  };
  const roundedCutProject = JSON.parse(JSON.stringify(project));
  roundedCutProject.objectIndex = {
    rounded_cut_source: { collection: "plates", type: "plate" },
    rounded_cut_body: { collection: "features", type: "boolean-part" }
  };
  roundedCutProject.model.members = {};
  roundedCutProject.model.plates = {
    rounded_cut_source: {
      id: "rounded_cut_source",
      type: "plate",
      center: [0, 0, 0],
      normal: [1, 0, 0],
      localAxisY: [0, 1, 0],
      localAxisZ: [0, 0, 1],
      thickness: 30,
      featureIds: ["rounded_cut_body"],
      sketch: sketchFromRectangle(220, 140, "rounded_cut_source")
    }
  };
  roundedCutProject.model.features = {
    rounded_cut_body: roundedCutBodyFeature
  };
  roundedCutProject.model.holePatterns = {};
  roundedCutProject.model.objectPatterns = {};
  roundedCutProject.model.trimJoints = {};
  roundedCutProject.model.fastenerGroups = {};
  roundedCutProject.model.welds = {};
  roundedCutProject.model.smartComponentInstances = {};
  roundedCutProject.model.assemblies = {};
  if (Object.prototype.hasOwnProperty.call(roundedCutBodyFeature.body, "outline")) {
    console.error("FAILED: rounded boolean cutting body source should not store a generated outline");
    return 1;
  }
  const roundedCutResolvedBody = cutBodiesForFeature(roundedCutProject, profiles, roundedCutBodyFeature, { tessellation: settings.render?.curves || {} })[0];
  const roundedCutSourcePoints = sketchVertices(roundedCutBodySketch).map((vertex) => vertex.point);
  const roundedCutSourcePointKeys = new Set(roundedCutSourcePoints.map(pointKey));
  const roundedCutArcEdges = sketchEdges(roundedCutBodySketch).filter((edge) => sketchEdgeIsCircularArc(roundedCutBodySketch, edge));
  const roundedCutIntermediatePoints = roundedCutResolvedBody.outline.filter((point) => !roundedCutSourcePointKeys.has(pointKey(point)));
  if (roundedCutArcEdges.length !== 4 || roundedCutResolvedBody.outline.length <= sketchEdges(roundedCutBodySketch).length || roundedCutIntermediatePoints.length < 4) {
    console.error("FAILED: rounded boolean cutting body should resolve semantic arc sketch into sampled runtime outline points");
    return 1;
  }
  const roundedCutUncutProject = JSON.parse(JSON.stringify(roundedCutProject));
  roundedCutUncutProject.model.plates.rounded_cut_source.featureIds = [];
  const roundedCutScene = buildScene(roundedCutProject, profiles, fasteners, settings, { renderObjectIds: ["rounded_cut_source"] });
  const roundedCutUncutScene = buildScene(roundedCutUncutProject, profiles, fasteners, settings, { renderObjectIds: ["rounded_cut_source"] });
  if (JSON.stringify(sceneGeometrySignature(roundedCutScene)) === JSON.stringify(sceneGeometrySignature(roundedCutUncutScene))) {
    console.error("FAILED: rounded boolean cutting body sketch should affect plate CSG geometry");
    return 1;
  }
  const roundedCutBodyScene = buildScene(roundedCutProject, profiles, fasteners, settings, { renderObjectIds: ["rounded_cut_body"] });
  const roundedCutLinePoints = roundedCutBodyScene.lines
    .filter((line) => line.objectId === "rounded_cut_body")
    .flatMap((line) => line.points);
  if (!roundedCutLinePoints.some((point) => roundedCutIntermediatePoints.some((candidate) => pointKey([point[1], point[2]]) === pointKey(candidate)))) {
    console.error("FAILED: rounded boolean cutting body render path should draw sampled arc outline points");
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
    projection: snapViewer,
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
    projection: snapViewer,
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
    projection: snapViewer,
    screen: { x: 25, y: 0 },
    candidates: [
      plateEdge,
      { kind: "line", type: "plate-sketch-edge", label: "Plate edge", a: [25, -5, 0], b: [25, 5, 0], priority: 72 }
    ],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (offSegmentIntersection.snap?.intersectionSemanticType === "axis-intersection") {
    console.error("FAILED: finite plate edge intersection should not use extended segments");
    return 1;
  }
  const qArcSnap = Math.SQRT1_2 * 10;
  const activeRoundSketchPlate = {
    id: "active_round_sketch",
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    sketch: {
      type: "plate-sketch",
      vertices: [
        { id: "v1", point: [qArcSnap, qArcSnap] },
        { id: "v2", point: [-qArcSnap, qArcSnap] },
        { id: "v3", point: [-qArcSnap, -qArcSnap] },
        { id: "v4", point: [qArcSnap, -qArcSnap] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v3", to: "v4" },
        { id: "e4", from: "v4", to: "v1" }
      ],
      relations: []
    }
  };
  const activeRoundSnapCandidates = collectSnapCandidates({
    project: { model: { plates: {}, members: {}, fastenerGroups: {}, workPoints: {}, referencePlanes: {} } },
    context: {
      activeSketch: { plate: activeRoundSketchPlate },
      includeGlobalAxes: false,
      includeLines: true
    },
    scope: {
      members: false,
      plates: false,
      fasteners: false,
      workPoints: false,
      gridSystems: false,
      levels: false,
      referencePlanes: false,
      constructionGuides: false,
      activeSketch: true
    }
  }).filter((candidate) => candidate.providerId === "sketch.active");
  const activeRoundSnapCount = (type) => activeRoundSnapCandidates.filter((candidate) => candidate.type === type).length;
  if (activeRoundSnapCount("plate-sketch-arc-center") !== 1 || activeRoundSnapCount("plate-sketch-arc-midpoint") !== 1 || activeRoundSnapCount("plate-sketch-arc-quadrant") !== 1) {
    console.error("FAILED: active rounded sketch snaps should include arc center, midpoint, and quadrant candidates");
    return 1;
  }
  if (activeRoundSnapCount("plate-sketch-arc") < 2) {
    console.error("FAILED: active rounded sketch snaps should include sampled point-on-arc line candidates");
    return 1;
  }
  const segmentLengthRoundSnapCandidates = collectSnapCandidates({
    project: { model: { plates: {}, members: {}, fastenerGroups: {}, workPoints: {}, referencePlanes: {} } },
    context: {
      activeSketch: { plate: activeRoundSketchPlate },
      includeGlobalAxes: false,
      includeLines: true,
      circleSegments: 128,
      curveSegmentLength: 5
    },
    scope: {
      members: false,
      plates: false,
      fasteners: false,
      workPoints: false,
      gridSystems: false,
      levels: false,
      referencePlanes: false,
      constructionGuides: false,
      activeSketch: true
    }
  }).filter((candidate) => candidate.providerId === "sketch.active");
  const segmentLengthArcCandidates = segmentLengthRoundSnapCandidates.filter((candidate) => candidate.type === "plate-sketch-arc");
  const expectedSegmentLengthArcCandidates = Math.ceil((Math.PI / 2 * 10) / 5);
  if (
    segmentLengthArcCandidates.length !== expectedSegmentLengthArcCandidates
      || segmentLengthArcCandidates.some((candidate) => candidate.target?.subId !== "e1" || candidate.target?.semanticRole !== "sketch-arc")
      || segmentLengthArcCandidates.some((candidate) => String(candidate.target?.subId || "").includes("segment"))
  ) {
    console.error("FAILED: sampled sketch arc snap segments should use render.curves.segmentLength while referencing only the semantic arc edge id");
    return 1;
  }
  if (activeRoundSnapCandidates.some((candidate) => candidate.objectId === activeRoundSketchPlate.id)) {
    console.error("FAILED: active sketch snap candidates should not be excluded as the active object");
    return 1;
  }
  const activeArcSnap = solveSnap({
    projection: snapViewer,
    screen: { x: 5, y: 8.66 },
    candidates: activeRoundSnapCandidates,
    excludeObjectId: activeRoundSketchPlate.id,
    screenTolerance: 1,
    intersectionTolerancePx: 0,
    maxIntersectionSources: 0
  });
  if (activeArcSnap.snap?.type !== "plate-sketch-arc") {
    console.error(`FAILED: active rounded sketch should snap to point-on-arc, got ${activeArcSnap.snap?.type || "none"}`);
    return 1;
  }
  const arcDragPlacement = {
    center: [0, 0, 0],
    normal: [1, 0, 0],
    localAxisY: [0, 1, 0],
    localAxisZ: [0, 0, 1]
  };
  const arcDragSketch = {
    vertices: [
      { id: "v1", point: [10, 0] },
      { id: "v2", point: [0, 10] },
      { id: "v3", point: [0, 0] }
    ],
    edges: [
      { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
      { id: "e2", from: "v2", to: "v3" },
      { id: "e3", from: "v3", to: "v1" }
    ],
    relations: [
      { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" }
    ]
  };
  const movedStandaloneSketch = setSketchVertex({
    id: "arc_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: arcDragSketch
  }, "v2", [0, 12]);
  const movedStandaloneArc = movedStandaloneSketch.sketch.edges.find((edge) => edge.id === "e1");
  if (
    Math.abs(Math.hypot(movedStandaloneArc.center[0] - 10, movedStandaloneArc.center[1] - 0) - movedStandaloneArc.radius) > 1e-6
    || Math.abs(Math.hypot(movedStandaloneArc.center[0] - 0, movedStandaloneArc.center[1] - 12) - movedStandaloneArc.radius) > 1e-6
  ) {
    console.error("FAILED: moving a standalone circular-arc endpoint should keep both endpoints on the updated arc radius");
    return 1;
  }
  const pointOnCircleSketch = {
    id: "point_on_circle_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [0, 0] }
      ],
      constructionVertices: [
        { id: "v4", point: [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v3", to: "v1" }
      ],
      relations: [
        { id: "poc1", type: "point-on-circle", vertexId: "v4", edgeId: "e1" }
      ]
    }
  };
  const movedPointOnCircleSketch = setSketchVertex(pointOnCircleSketch, "v4", [12, 12]);
  const movedPointOnCircleVertex = movedPointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  const movedPointOnCircleRelations = sketchRelations(movedPointOnCircleSketch.sketch);
  if (
    !movedPointOnCircleVertex
      || Math.abs(Math.hypot(movedPointOnCircleVertex.point[0], movedPointOnCircleVertex.point[1]) - 10) > 1e-6
      || !movedPointOnCircleRelations.some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: moving a standalone sketch construction point should preserve and solve Point On Circle");
    return 1;
  }
  const sourceEndpointMovedPointOnCircleSketch = setSketchVertex(pointOnCircleSketch, "v2", [0, 12]);
  const sourceEndpointMovedPointOnCircleArc = sketchEdges(sourceEndpointMovedPointOnCircleSketch.sketch).find((edge) => edge.id === "e1");
  const sourceEndpointMovedPointOnCircleVertex = sourceEndpointMovedPointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  if (
    !sourceEndpointMovedPointOnCircleArc
      || !sourceEndpointMovedPointOnCircleVertex
      || Math.abs(Math.hypot(
        sourceEndpointMovedPointOnCircleVertex.point[0] - sourceEndpointMovedPointOnCircleArc.center[0],
        sourceEndpointMovedPointOnCircleVertex.point[1] - sourceEndpointMovedPointOnCircleArc.center[1]
      ) - sourceEndpointMovedPointOnCircleArc.radius) > 1e-6
      || Math.hypot(
        sourceEndpointMovedPointOnCircleVertex.point[0] - (Math.SQRT1_2 * 10),
        sourceEndpointMovedPointOnCircleVertex.point[1] - (Math.SQRT1_2 * 10)
      ) <= 1e-6
      || !sketchRelations(sourceEndpointMovedPointOnCircleSketch.sketch).some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: dragging a circular-arc endpoint should keep Point On Circle construction points on the updated analytic radius");
    return 1;
  }
  const resizedPointOnCircleSketch = setSketchEdgeRadius(pointOnCircleSketch, "e1", 15, { mode: "driving" });
  const resizedPointOnCircleVertex = resizedPointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  const resizedPointOnCircleArc = sketchEdges(resizedPointOnCircleSketch.sketch).find((edge) => edge.id === "e1");
  if (
    !resizedPointOnCircleVertex
      || resizedPointOnCircleArc?.radius !== 15
      || Math.abs(Math.hypot(resizedPointOnCircleVertex.point[0], resizedPointOnCircleVertex.point[1]) - 15) > 1e-6
      || !sketchRelations(resizedPointOnCircleSketch.sketch).some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: driving radius edits should move Point On Circle construction points onto the new analytic radius");
    return 1;
  }
  const flippedPointOnCircleSketch = flipSketchEdgeArc(pointOnCircleSketch, "e1");
  const flippedPointOnCircleArc = sketchEdges(flippedPointOnCircleSketch.sketch).find((edge) => edge.id === "e1");
  const flippedPointOnCircleVertex = flippedPointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  if (
    !flippedPointOnCircleArc
      || !flippedPointOnCircleVertex
      || Math.abs(Math.hypot(
        flippedPointOnCircleVertex.point[0] - flippedPointOnCircleArc.center[0],
        flippedPointOnCircleVertex.point[1] - flippedPointOnCircleArc.center[1]
      ) - flippedPointOnCircleArc.radius) > 1e-6
      || !sketchRelations(flippedPointOnCircleSketch.sketch).some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: Flip Arc should project Point On Circle vertices onto the flipped analytic radius");
    return 1;
  }
  const updatedPointOnCircleArcSketch = setSketchEdgeArc(pointOnCircleSketch, "e1", { throughPoint: [4, 12], mode: "driven" });
  const updatedPointOnCircleArc = sketchEdges(updatedPointOnCircleArcSketch.sketch).find((edge) => edge.id === "e1");
  const updatedPointOnCircleVertex = updatedPointOnCircleArcSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  if (
    !updatedPointOnCircleArc
      || !updatedPointOnCircleVertex
      || Math.abs(Math.hypot(
        updatedPointOnCircleVertex.point[0] - updatedPointOnCircleArc.center[0],
        updatedPointOnCircleVertex.point[1] - updatedPointOnCircleArc.center[1]
      ) - updatedPointOnCircleArc.radius) > 1e-6
      || !sketchRelations(updatedPointOnCircleArcSketch.sketch).some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: Edge Arc updates should project Point On Circle vertices onto the updated analytic radius");
    return 1;
  }
  const splitPointOnCircleSketch = splitSketchEdgeArc(pointOnCircleSketch, "e1", {
    vertexId: "v_split",
    firstEdgeId: "e_first",
    secondEdgeId: "e_second"
  });
  const splitPointOnCircleRelation = sketchRelations(splitPointOnCircleSketch.sketch.sketch).find((relation) => (
    relation.type === "point-on-circle" && relation.vertexId === "v4"
  ));
  if (splitPointOnCircleRelation?.edgeId !== "e_first") {
    console.error("FAILED: Split Arc should carry Point On Circle onto the child arc containing the constrained point");
    return 1;
  }
  const insertArcPoint = sketchEdgeMidpoint(arcDragSketch, "e1");
  const insertedStandaloneArc = insertSketchVertex({
    id: "insert_arc_standalone_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: arcDragSketch
  }, "e1", insertArcPoint);
  const insertedStandaloneEdges = sketchEdges(insertedStandaloneArc.sketch.sketch);
  const insertedStandaloneChildArcs = insertedStandaloneEdges.filter((edge) => edge.kind === "circular-arc" && edge.authoring?.sourceEdgeId === "e1");
  const insertedStandaloneVertex = sketchVertices(insertedStandaloneArc.sketch.sketch).find((vertex) => vertex.id === insertedStandaloneArc.vertexId);
  const insertedStandaloneRelations = sketchRelations(insertedStandaloneArc.sketch.sketch);
  const insertedStandaloneFirstChild = insertedStandaloneChildArcs.find((edge) => edge.from === "v1" && edge.to === insertedStandaloneArc.vertexId);
  const insertedStandaloneSecondChild = insertedStandaloneChildArcs.find((edge) => edge.from === insertedStandaloneArc.vertexId && edge.to === "v2");
  if (
    !insertedStandaloneVertex
      || Math.hypot(insertedStandaloneVertex.point[0] - insertArcPoint[0], insertedStandaloneVertex.point[1] - insertArcPoint[1]) > 1e-6
      || insertedStandaloneChildArcs.length !== 2
      || !insertedStandaloneFirstChild
      || !insertedStandaloneSecondChild
      || insertedStandaloneChildArcs.some((edge) => Math.abs(edge.radius - 10) > 1e-6 || Math.hypot(edge.center[0], edge.center[1]) > 1e-6 || edge.direction !== "ccw")
      || !insertedStandaloneRelations.some((relation) => relation.type === "tangent" && relation.edgeIds?.every((edgeId) => insertedStandaloneChildArcs.some((edge) => edge.id === edgeId)))
      || insertedStandaloneChildArcs.some((edge) => !insertedStandaloneRelations.some((relation) => relation.type === "radius" && relation.edgeId === edge.id && Math.abs(relation.value - 10) <= 1e-6))
  ) {
    console.error("FAILED: inserting a vertex on a standalone circular arc should split it into two tangent semantic arcs");
    return 1;
  }
  const insertedPlateArc = insertPlateSketchVertex({
    id: "insert_arc_plate_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: arcDragSketch
  }, "e1", insertArcPoint);
  const insertedPlateChildArcs = sketchEdges(insertedPlateArc.plate.sketch).filter((edge) => edge.kind === "circular-arc" && edge.authoring?.sourceEdgeId === "e1");
  if (
    !sketchVertices(insertedPlateArc.plate.sketch).some((vertex) => vertex.id === insertedPlateArc.vertexId)
      || insertedPlateChildArcs.length !== 2
      || insertedPlateChildArcs.some((edge) => Math.abs(edge.radius - 10) > 1e-6 || Math.hypot(edge.center[0], edge.center[1]) > 1e-6 || edge.direction !== "ccw")
  ) {
    console.error("FAILED: inserting a vertex on a plate-hosted circular arc should preserve semantic arc geometry");
    return 1;
  }
  const mergedPointOnCircleSketch = removeSketchVertex({
    id: "merge_arc_point_on_circle_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10] },
        { id: "v3", point: [0, 10] },
        { id: "v5", point: [0, 0] }
      ],
      constructionVertices: [
        { id: "v4", point: [Math.cos(Math.PI / 8) * 10, Math.sin(Math.PI / 8) * 10] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e3", from: "v3", to: "v5" },
        { id: "e4", from: "v5", to: "v1" }
      ],
      relations: [
        { id: "poc1", type: "point-on-circle", vertexId: "v4", edgeId: "e1" },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" },
        { id: "r2", type: "radius", edgeId: "e2", value: 10, mode: "driven" }
      ]
    }
  }, "v2");
  const mergedPointOnCircleArcs = sketchEdges(mergedPointOnCircleSketch.sketch).filter((edge) => edge.kind === "circular-arc");
  const mergedPointOnCircleRelation = sketchRelations(mergedPointOnCircleSketch.sketch).find((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4");
  const mergedPointOnCircleVertex = mergedPointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  if (
    mergedPointOnCircleArcs.length !== 1
      || !mergedPointOnCircleRelation
      || mergedPointOnCircleRelation.edgeId !== mergedPointOnCircleArcs[0].id
      || !mergedPointOnCircleVertex
      || Math.abs(Math.hypot(mergedPointOnCircleVertex.point[0], mergedPointOnCircleVertex.point[1]) - mergedPointOnCircleArcs[0].radius) > 1e-6
  ) {
    console.error("FAILED: deleting the split vertex between same-circle arcs should preserve Point On Circle on the merged arc");
    return 1;
  }
  const movedPlateSketch = setPlateSketchVertices({
    id: "arc_drag_plate_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: arcDragSketch
  }, [
    { vertexId: "v1", point: [15, 0] },
    { vertexId: "v2", point: [5, 10] }
  ]);
  const movedPlateArc = movedPlateSketch.sketch.edges.find((edge) => edge.id === "e1");
  if (Math.abs(movedPlateArc.radius - 10) > 1e-6 || Math.hypot(movedPlateArc.center[0] - 5, movedPlateArc.center[1]) > 1e-6) {
    console.error("FAILED: moving both circular-arc endpoints by the same delta should translate the arc center and preserve radius");
    return 1;
  }
  const movedPlatePointOnCircleSketch = setPlateSketchVertices({
    id: "plate_point_on_circle_arc_drag_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: pointOnCircleSketch.sketch
  }, [
    { vertexId: "v2", point: [0, 12] }
  ]);
  const movedPlatePointOnCircleArc = sketchEdges(movedPlatePointOnCircleSketch.sketch).find((edge) => edge.id === "e1");
  const movedPlatePointOnCircleVertex = movedPlatePointOnCircleSketch.sketch.constructionVertices.find((vertex) => vertex.id === "v4");
  if (
    !movedPlatePointOnCircleArc
      || !movedPlatePointOnCircleVertex
      || Math.abs(Math.hypot(
        movedPlatePointOnCircleVertex.point[0] - movedPlatePointOnCircleArc.center[0],
        movedPlatePointOnCircleVertex.point[1] - movedPlatePointOnCircleArc.center[1]
      ) - movedPlatePointOnCircleArc.radius) > 1e-6
      || !sketchRelations(movedPlatePointOnCircleSketch.sketch).some((relation) => relation.type === "point-on-circle" && relation.vertexId === "v4" && relation.edgeId === "e1")
  ) {
    console.error("FAILED: dragging a plate sketch circular-arc endpoint should keep Point On Circle construction points on the updated analytic radius");
    return 1;
  }
  const filletDragBase = {
    id: "fillet_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: sketchFromRectangle(100, 60, "fd")
  };
  const filletDragResult = filletSketchCorner(filletDragBase, sketchVertices(filletDragBase.sketch)[0].id, { radius: 10 });
  const filletDragArc = sketchEdges(filletDragResult.sketch.sketch).find((edge) => edge.id === filletDragResult.edgeId);
  const filletStartPoint = sketchVertices(filletDragResult.sketch.sketch).find((vertex) => vertex.id === filletDragArc.from)?.point;
  const filletStartTangent = sketchEdgeTangentAtVertex(filletDragResult.sketch.sketch, filletDragArc.id, filletDragArc.from);
  const tangentPreservedPoint = [
    filletStartPoint[0] + filletStartTangent[0] * 5,
    filletStartPoint[1] + filletStartTangent[1] * 5
  ];
  const tangentPreservedSketch = setSketchVertex(filletDragResult.sketch, filletDragArc.from, tangentPreservedPoint);
  const tangentPreservedArc = sketchEdges(tangentPreservedSketch.sketch).find((edge) => edge.id === filletDragArc.id);
  const tangentPreservedTangents = sketchRelations(tangentPreservedSketch.sketch).filter((relation) => (
    relation.type === "tangent" && relation.edgeIds.includes(filletDragArc.id)
  ));
  if (
    tangentPreservedTangents.length !== 1
      || Math.abs(tangentPreservedArc.radius - filletDragArc.radius) <= 1e-6
  ) {
    console.error("FAILED: dragging a fillet arc endpoint along its tangent line should preserve the touched tangent relation and allow the radius to update");
    return 1;
  }
  const largeFilletDragBase = {
    id: "large_fillet_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: sketchFromRectangle(10000, 6000, "lfd")
  };
  const largeFilletDragResult = filletSketchCorner(largeFilletDragBase, sketchVertices(largeFilletDragBase.sketch)[0].id, { radius: 1000 });
  const largeFilletDragArc = sketchEdges(largeFilletDragResult.sketch.sketch).find((edge) => edge.id === largeFilletDragResult.edgeId);
  const largeFilletStartPoint = sketchVertices(largeFilletDragResult.sketch.sketch).find((vertex) => vertex.id === largeFilletDragArc.from)?.point;
  const largeFilletStartTangent = sketchEdgeTangentAtVertex(largeFilletDragResult.sketch.sketch, largeFilletDragArc.id, largeFilletDragArc.from);
  const largeFilletNoisyPoint = [
    largeFilletStartPoint[0] + largeFilletStartTangent[0] * 500 - largeFilletStartTangent[1] * 0.0005,
    largeFilletStartPoint[1] + largeFilletStartTangent[1] * 500 + largeFilletStartTangent[0] * 0.0005
  ];
  const largeFilletNoisySketch = setSketchVertex(largeFilletDragResult.sketch, largeFilletDragArc.from, largeFilletNoisyPoint);
  const largeFilletNoisyArc = sketchEdges(largeFilletNoisySketch.sketch).find((edge) => edge.id === largeFilletDragArc.id);
  const largeFilletNoisyTangents = sketchRelations(largeFilletNoisySketch.sketch).filter((relation) => (
    relation.type === "tangent" && relation.edgeIds.includes(largeFilletDragArc.id)
  ));
  if (
    largeFilletNoisyTangents.length !== 1
      || Math.abs(largeFilletNoisyArc.radius - largeFilletDragArc.radius) <= 1e-6
  ) {
    console.error("FAILED: dragging a large fillet arc endpoint with scale-level tangent-line noise should preserve the touched tangent relation");
    return 1;
  }
  const filletMovedPoint = [filletDragArc.center[0] + 5, filletDragArc.center[1] + 10];
  const filletDraggedSketch = setSketchVertex(filletDragResult.sketch, filletDragArc.from, filletMovedPoint);
  const filletDraggedArc = sketchEdges(filletDraggedSketch.sketch).find((edge) => edge.id === filletDragArc.id);
  const filletFixedPoint = sketchVertices(filletDraggedSketch.sketch).find((vertex) => vertex.id === filletDragArc.to)?.point;
  const filletDraggedTangents = sketchRelations(filletDraggedSketch.sketch).filter((relation) => (
    relation.type === "tangent" && relation.edgeIds.includes(filletDragArc.id)
  ));
  if (filletDraggedTangents.length) {
    console.error("FAILED: dragging a fillet arc endpoint should relax stale tangent relations on that arc");
    return 1;
  }
  if (
    Math.abs(Math.hypot(filletDraggedArc.center[0] - filletMovedPoint[0], filletDraggedArc.center[1] - filletMovedPoint[1]) - filletDraggedArc.radius) > 1e-6
    || !filletFixedPoint
    || Math.abs(Math.hypot(filletDraggedArc.center[0] - filletFixedPoint[0], filletDraggedArc.center[1] - filletFixedPoint[1]) - filletDraggedArc.radius) > 1e-6
  ) {
    console.error("FAILED: dragging a fillet arc endpoint should keep the arc endpoints on the updated radius");
    return 1;
  }
  const arcArcTangentSketch = {
    id: "arc_arc_tangent_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [-10, 20] },
        { id: "v4", point: [20, 20] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3", kind: "circular-arc", center: [0, 20], radius: 10, direction: "cw" },
        { id: "e3", from: "v3", to: "v4" },
        { id: "e4", from: "v4", to: "v1" }
      ],
      relations: [
        { id: "t1", type: "tangent", edgeIds: ["e1", "e2"] },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" },
        { id: "r2", type: "radius", edgeId: "e2", value: 10, mode: "driven" }
      ]
    }
  };
  const arcArcTangentMoved = setSketchVertex(arcArcTangentSketch, "v2", [-2, 10]);
  const arcArcTangentRelations = sketchRelations(arcArcTangentMoved.sketch).filter((relation) => (
    relation.type === "tangent" && relation.edgeIds.includes("e1") && relation.edgeIds.includes("e2")
  ));
  const arcArcTangentFirst = sketchEdges(arcArcTangentMoved.sketch).find((edge) => edge.id === "e1");
  const arcArcTangentSecond = sketchEdges(arcArcTangentMoved.sketch).find((edge) => edge.id === "e2");
  const arcArcFirstTangent = sketchEdgeTangentAtVertex(arcArcTangentMoved.sketch, "e1", "v2");
  const arcArcSecondTangent = sketchEdgeTangentAtVertex(arcArcTangentMoved.sketch, "e2", "v2");
  if (
    arcArcTangentRelations.length !== 1
      || Math.abs(arcArcTangentFirst.radius - 12.2) > 1e-6
      || Math.abs(arcArcTangentSecond.radius - 8.2) > 1e-6
      || Math.abs(Math.abs(arcArcFirstTangent[0] * arcArcSecondTangent[0] + arcArcFirstTangent[1] * arcArcSecondTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: dragging a shared arc-arc tangent endpoint along the previous tangent should preserve tangent and update both arc radii");
    return 1;
  }
  const arcArcTangentOffLine = setSketchVertex(arcArcTangentSketch, "v2", [-2, 9]);
  if (sketchRelations(arcArcTangentOffLine.sketch).some((relation) => (
    relation.type === "tangent" && relation.edgeIds.includes("e1") && relation.edgeIds.includes("e2")
  ))) {
    console.error("FAILED: dragging a shared arc-arc tangent endpoint off the previous tangent should relax the stale tangent relation");
    return 1;
  }
  const multiTangentFallbackSketch = {
    id: "multi_tangent_fallback_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v5", point: [10, 20] }
      ],
      constructionVertices: [
        { id: "v3", point: [-10, 10] },
        { id: "v4", point: [0, 20] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e4", from: "v2", to: "v5" },
        { id: "e5", from: "v5", to: "v1" }
      ],
      constructionEdges: [
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v2", to: "v4" }
      ],
      relations: [
        { id: "t_bad", type: "tangent", edgeIds: ["e1", "e3"] },
        { id: "t_good", type: "tangent", edgeIds: ["e1", "e2"] },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" }
      ]
    }
  };
  const multiTangentFallbackMoved = setSketchVertex(multiTangentFallbackSketch, "v2", [-2, 10]);
  const multiTangentFallbackArc = sketchEdges(multiTangentFallbackMoved.sketch).find((edge) => edge.id === "e1");
  const multiTangentFallbackRelations = sketchRelations(multiTangentFallbackMoved.sketch);
  const multiTangentFallbackArcTangent = sketchEdgeTangentAtVertex(multiTangentFallbackMoved.sketch, "e1", "v2");
  const multiTangentFallbackGuideTangent = sketchEdgeTangentAtVertex(multiTangentFallbackMoved.sketch, "e2", "v2");
  if (
    multiTangentFallbackRelations.some((relation) => relation.id === "t_bad")
      || !multiTangentFallbackRelations.some((relation) => relation.id === "t_good")
      || Math.abs(multiTangentFallbackArc.radius - 10) <= 1e-6
      || Math.abs(Math.abs(multiTangentFallbackArcTangent[0] * multiTangentFallbackGuideTangent[0] + multiTangentFallbackArcTangent[1] * multiTangentFallbackGuideTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: dragging an arc endpoint should skip stale tangent relations and preserve a later valid tangent candidate");
    return 1;
  }
  const tangentLineEndpointSketch = {
    id: "tangent_line_endpoint_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [-10, 10] },
        { id: "v4", point: [-10, -10] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v3", to: "v4" },
        { id: "e4", from: "v4", to: "v1" }
      ],
      relations: [
        { id: "t1", type: "tangent", edgeIds: ["e1", "e2"] },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" }
      ]
    }
  };
  const tangentLineEndpointMoved = setSketchVertex(tangentLineEndpointSketch, "v3", [-10, 12]);
  const tangentLineEndpointRelations = sketchRelations(tangentLineEndpointMoved.sketch);
  const tangentLineEndpointArc = sketchEdges(tangentLineEndpointMoved.sketch).find((edge) => edge.id === "e1");
  const tangentLineEndpointArcTangent = sketchEdgeTangentAtVertex(tangentLineEndpointMoved.sketch, "e1", "v2");
  const tangentLineEndpointGuideTangent = sketchEdgeTangentAtVertex(tangentLineEndpointMoved.sketch, "e2", "v2");
  if (
    !tangentLineEndpointRelations.some((relation) => relation.id === "t1")
      || Math.abs(tangentLineEndpointArc.radius - 10) <= 1e-6
      || Math.abs(Math.abs(tangentLineEndpointArcTangent[0] * tangentLineEndpointGuideTangent[0] + tangentLineEndpointArcTangent[1] * tangentLineEndpointGuideTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: dragging the far endpoint of a tangent line should preserve the tangent relation by updating the connected circular arc");
    return 1;
  }
  const tangentLineTranslated = setPlateSketchVertices({
    id: "tangent_line_translate_drag_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: tangentLineEndpointSketch.sketch
  }, [
    { vertexId: "v2", point: [0, 12] },
    { vertexId: "v3", point: [-10, 12] }
  ]);
  const tangentLineTranslatedRelations = sketchRelations(tangentLineTranslated.sketch);
  const tangentLineTranslatedArc = sketchEdges(tangentLineTranslated.sketch).find((edge) => edge.id === "e1");
  const tangentLineTranslatedArcTangent = sketchEdgeTangentAtVertex(tangentLineTranslated.sketch, "e1", "v2");
  const tangentLineTranslatedGuideTangent = sketchEdgeTangentAtVertex(tangentLineTranslated.sketch, "e2", "v2");
  if (
    !tangentLineTranslatedRelations.some((relation) => relation.id === "t1")
      || Math.abs(tangentLineTranslatedArc.radius - 10) <= 1e-6
      || Math.abs(Math.abs(tangentLineTranslatedArcTangent[0] * tangentLineTranslatedGuideTangent[0] + tangentLineTranslatedArcTangent[1] * tangentLineTranslatedGuideTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: translating a tangent line should preserve the tangent relation by updating the connected circular arc");
    return 1;
  }
  const tangentArcEndpointSketch = {
    id: "tangent_arc_endpoint_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [-10, 20] },
        { id: "v4", point: [20, 20] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3", kind: "circular-arc", center: [0, 20], radius: 10, direction: "cw" },
        { id: "e3", from: "v3", to: "v4" },
        { id: "e4", from: "v4", to: "v1" }
      ],
      relations: [
        { id: "t1", type: "tangent", edgeIds: ["e1", "e2"] },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" },
        { id: "r2", type: "radius", edgeId: "e2", value: 10, mode: "driven" }
      ]
    }
  };
  const tangentArcEndpointMoved = setSketchVertex(tangentArcEndpointSketch, "v3", [-12, 20]);
  const tangentArcEndpointRelations = sketchRelations(tangentArcEndpointMoved.sketch);
  const tangentArcEndpointFirst = sketchEdges(tangentArcEndpointMoved.sketch).find((edge) => edge.id === "e1");
  const tangentArcEndpointFirstTangent = sketchEdgeTangentAtVertex(tangentArcEndpointMoved.sketch, "e1", "v2");
  const tangentArcEndpointSecondTangent = sketchEdgeTangentAtVertex(tangentArcEndpointMoved.sketch, "e2", "v2");
  if (
    !tangentArcEndpointRelations.some((relation) => relation.id === "t1")
      || Math.abs(tangentArcEndpointFirst.radius - 10) <= 1e-6
      || Math.abs(Math.abs(tangentArcEndpointFirstTangent[0] * tangentArcEndpointSecondTangent[0] + tangentArcEndpointFirstTangent[1] * tangentArcEndpointSecondTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: dragging the far endpoint of a tangent arc should preserve the shared tangent relation by updating the connected circular arc");
    return 1;
  }
  const tangentArcTranslated = setPlateSketchVertices({
    id: "tangent_arc_translate_drag_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: tangentArcEndpointSketch.sketch
  }, [
    { vertexId: "v2", point: [2, 10] },
    { vertexId: "v3", point: [-8, 20] }
  ]);
  const tangentArcTranslatedRelations = sketchRelations(tangentArcTranslated.sketch);
  const tangentArcTranslatedFirst = sketchEdges(tangentArcTranslated.sketch).find((edge) => edge.id === "e1");
  const tangentArcTranslatedFirstTangent = sketchEdgeTangentAtVertex(tangentArcTranslated.sketch, "e1", "v2");
  const tangentArcTranslatedSecondTangent = sketchEdgeTangentAtVertex(tangentArcTranslated.sketch, "e2", "v2");
  if (
    !tangentArcTranslatedRelations.some((relation) => relation.id === "t1")
      || Math.abs(tangentArcTranslatedFirst.radius - 10) <= 1e-6
      || Math.abs(Math.abs(tangentArcTranslatedFirstTangent[0] * tangentArcTranslatedSecondTangent[0] + tangentArcTranslatedFirstTangent[1] * tangentArcTranslatedSecondTangent[1]) - 1) > 1e-6
  ) {
    console.error("FAILED: translating a tangent arc should preserve the shared tangent relation by updating the connected circular arc");
    return 1;
  }
  const equalRadiusSketch = {
    id: "equal_radius_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: sketchFromRoundedRectangle(100, 60, 10, "er")
  };
  const equalRadiusArc = sketchEdges(equalRadiusSketch.sketch).find((edge) => edge.kind === "circular-arc");
  const equalRadiusUpdated = setSketchEdgeRadius(equalRadiusSketch, equalRadiusArc.id, 15, { mode: "driving" });
  const equalRadiusValues = sketchEdges(equalRadiusUpdated.sketch)
    .filter((edge) => edge.kind === "circular-arc")
    .map((edge) => edge.radius);
  if (equalRadiusValues.length !== 4 || equalRadiusValues.some((radius) => Math.abs(radius - 15) > 1e-6)) {
    console.error(`FAILED: driving radius should propagate through equal-radius standalone arcs, got ${equalRadiusValues.join(",")}`);
    return 1;
  }
  const equalRadiusDragSketch = {
    id: "equal_radius_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [-10, 20] },
        { id: "v4", point: [0, 30] },
        { id: "v5", point: [20, 30] },
        { id: "v6", point: [20, 0] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v3", to: "v4", kind: "circular-arc", center: [0, 20], radius: 10, direction: "cw" },
        { id: "e4", from: "v4", to: "v5" },
        { id: "e5", from: "v5", to: "v6" },
        { id: "e6", from: "v6", to: "v1" }
      ],
      relations: [
        { id: "er_drag", type: "equal-radius", edgeIds: ["e1", "e3"] },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" },
        { id: "r3", type: "radius", edgeId: "e3", value: 10, mode: "driven" }
      ]
    }
  };
  const equalRadiusDragged = setSketchVertex(equalRadiusDragSketch, "v2", [0, 25]);
  const equalRadiusDraggedEdges = sketchEdges(equalRadiusDragged.sketch);
  const equalRadiusDraggedFirst = equalRadiusDraggedEdges.find((edge) => edge.id === "e1");
  const equalRadiusDraggedSecond = equalRadiusDraggedEdges.find((edge) => edge.id === "e3");
  if (
    !sketchRelations(equalRadiusDragged.sketch).some((relation) => relation.id === "er_drag")
      || Math.abs(equalRadiusDraggedFirst.radius - 10) <= 1e-6
      || Math.abs(equalRadiusDraggedFirst.radius - equalRadiusDraggedSecond.radius) > 1e-6
  ) {
    console.error("FAILED: direct arc endpoint drag should preserve equal-radius by resizing related semantic arcs");
    return 1;
  }
  const concentricDragSketch = {
    id: "concentric_drag_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      vertices: [
        { id: "v1", point: [10, 0] },
        { id: "v2", point: [0, 10] },
        { id: "v3", point: [-20, 0] },
        { id: "v4", point: [0, -20] },
        { id: "v5", point: [30, -20] },
        { id: "v6", point: [30, 0] }
      ],
      constructionVertices: [
        { id: "v7", point: [0, 20] }
      ],
      edges: [
        { id: "e1", from: "v1", to: "v2", kind: "circular-arc", center: [0, 0], radius: 10, direction: "ccw" },
        { id: "e2", from: "v2", to: "v3" },
        { id: "e3", from: "v3", to: "v4", kind: "circular-arc", center: [0, 0], radius: 20, direction: "ccw" },
        { id: "e4", from: "v4", to: "v5" },
        { id: "e5", from: "v5", to: "v6" },
        { id: "e6", from: "v6", to: "v1" }
      ],
      relations: [
        { id: "con_drag", type: "concentric", edgeIds: ["e1", "e3"] },
        { id: "poc_con_drag", type: "point-on-circle", vertexId: "v7", edgeId: "e3" },
        { id: "r1", type: "radius", edgeId: "e1", value: 10, mode: "driven" },
        { id: "r3", type: "radius", edgeId: "e3", value: 20, mode: "driven" }
      ]
    }
  };
  const concentricDragged = setSketchVertex(concentricDragSketch, "v2", [0, 25]);
  const concentricDraggedEdges = sketchEdges(concentricDragged.sketch);
  const concentricDraggedFirst = concentricDraggedEdges.find((edge) => edge.id === "e1");
  const concentricDraggedSecond = concentricDraggedEdges.find((edge) => edge.id === "e3");
  const concentricMovedVertex = sketchVertices(concentricDragged.sketch).find((vertex) => vertex.id === "v3");
  const concentricPointOnCircleVertex = (concentricDragged.sketch.constructionVertices || []).find((vertex) => vertex.id === "v7");
  if (
    !sketchRelations(concentricDragged.sketch).some((relation) => relation.id === "con_drag")
      || !sketchRelations(concentricDragged.sketch).some((relation) => relation.id === "poc_con_drag")
      || Math.hypot(concentricDraggedFirst.center[0] - concentricDraggedSecond.center[0], concentricDraggedFirst.center[1] - concentricDraggedSecond.center[1]) > 1e-6
      || Math.hypot(concentricDraggedSecond.center[0], concentricDraggedSecond.center[1]) <= 1e-6
      || !concentricMovedVertex
      || Math.hypot(concentricMovedVertex.point[0] + 20, concentricMovedVertex.point[1]) <= 1e-6
      || !concentricPointOnCircleVertex
      || Math.abs(Math.hypot(
        concentricPointOnCircleVertex.point[0] - concentricDraggedSecond.center[0],
        concentricPointOnCircleVertex.point[1] - concentricDraggedSecond.center[1]
      ) - concentricDraggedSecond.radius) > 1e-6
      || Math.hypot(concentricPointOnCircleVertex.point[0], concentricPointOnCircleVertex.point[1] - 20) <= 1e-6
  ) {
    console.error("FAILED: direct arc endpoint drag should preserve concentric by translating related semantic arcs and their point-on-circle vertices to the new center");
    return 1;
  }
  const equalRadiusPlate = {
    id: "equal_radius_plate_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: sketchFromRoundedRectangle(100, 60, 10, "erp")
  };
  const equalRadiusPlateArc = sketchEdges(equalRadiusPlate.sketch).find((edge) => edge.kind === "circular-arc");
  const equalRadiusPlateUpdated = setPlateSketchEdgeRadius(equalRadiusPlate, equalRadiusPlateArc.id, 12, { mode: "driving" });
  const equalRadiusPlateValues = sketchEdges(equalRadiusPlateUpdated.sketch)
    .filter((edge) => edge.kind === "circular-arc")
    .map((edge) => edge.radius);
  if (equalRadiusPlateValues.length !== 4 || equalRadiusPlateValues.some((radius) => Math.abs(radius - 12) > 1e-6)) {
    console.error(`FAILED: driving radius should propagate through equal-radius plate arcs, got ${equalRadiusPlateValues.join(",")}`);
    return 1;
  }
  const diameterPlate = {
    id: "diameter_plate_smoke",
    type: "plate",
    thickness: 8,
    ...arcDragPlacement,
    sketch: sketchFromRoundedRectangle(100, 60, 10, "diam")
  };
  const diameterArc = sketchEdges(diameterPlate.sketch).find((edge) => edge.kind === "circular-arc");
  const diameterReferencePlate = setPlateSketchEdgeRadius(diameterPlate, diameterArc.id, 10, { mode: "driven", display: "diameter" });
  const diameterReferenceRelation = sketchRelations(diameterReferencePlate.sketch).find((relation) => relation.type === "radius" && relation.edgeId === diameterArc.id);
  if (diameterReferenceRelation?.display !== "diameter" || Math.abs(diameterReferenceRelation.value - 10) > 1e-6) {
    console.error("FAILED: diameter dimension should store as a radius relation with display=diameter");
    return 1;
  }
  const diameterDrivingPlate = setPlateSketchEdgeRadiusMode(diameterReferencePlate, diameterArc.id, "driving");
  const diameterDrivingRelation = sketchRelations(diameterDrivingPlate.sketch).find((relation) => relation.type === "radius" && relation.edgeId === diameterArc.id);
  if (diameterDrivingRelation?.display !== "diameter" || diameterDrivingRelation.mode !== "driving") {
    console.error("FAILED: toggling a diameter dimension should preserve display=diameter");
    return 1;
  }
  const diameterEditedPlate = setPlateSketchEdgeRadius(diameterDrivingPlate, diameterArc.id, 15, { mode: "driving" });
  const diameterEditedRelation = sketchRelations(diameterEditedPlate.sketch).find((relation) => relation.type === "radius" && relation.edgeId === diameterArc.id);
  if (diameterEditedRelation?.display !== "diameter" || Math.abs(diameterEditedRelation.value - 15) > 1e-6) {
    console.error("FAILED: editing an existing diameter dimension should preserve display=diameter and store radius value");
    return 1;
  }
  const diameterOverlay = dimensionOverlayForPlate(
    diameterEditedPlate,
    sketchEdges(diameterEditedPlate.sketch),
    new Map(sketchVertices(diameterEditedPlate.sketch).map((vertex) => [vertex.id, vertex])),
    {},
    {},
    { showRelationControls: true }
  );
  if (
    !diameterOverlay.labels.some((label) => String(label.text || label.displayText || "").startsWith("\u00d830"))
      || !diameterOverlay.handles.some((handle) => handle.kind === "plate-sketch-diameter-dimension" && handle.dimensionType === "diameter")
  ) {
    console.error("FAILED: diameter dimensions should render with Ø label and diameter handle metadata");
    return 1;
  }
  const radiusDisplayPlate = setPlateSketchEdgeRadius(diameterEditedPlate, diameterArc.id, 15, { mode: "driven", display: "radius" });
  const radiusDisplayRelation = sketchRelations(radiusDisplayPlate.sketch).find((relation) => relation.type === "radius" && relation.edgeId === diameterArc.id);
  if (radiusDisplayRelation?.display === "diameter") {
    console.error("FAILED: Radius command path should be able to clear diameter display metadata");
    return 1;
  }
  const outlineArcOverlay = overlayForPlate(diameterEditedPlate, { settings: { plateSketchCircleSegments: 128, curveSegmentLength: 5 } });
  const editedDiameterArc = sketchEdges(diameterEditedPlate.sketch).find((edge) => edge.id === diameterArc.id);
  const outlineArcHandle = outlineArcOverlay.handles.find((handle) => handle.kind === "plate-sketch-edge" && handle.edgeId === editedDiameterArc.id);
  const expectedOutlineArcPoints = sketchEdgeSamplePoints(diameterEditedPlate.sketch, editedDiameterArc, { circleSegments: 128, segmentLength: 5 });
  const outlineArcMidDistance = outlineArcHandle?.point
    ? Math.hypot(outlineArcHandle.point[1] - editedDiameterArc.center[0], outlineArcHandle.point[2] - editedDiameterArc.center[1])
    : Infinity;
  if (
    !outlineArcHandle
      || outlineArcHandle.points.length !== expectedOutlineArcPoints.length
      || outlineArcHandle.displayOnlySamplePoints.length !== Math.max(0, expectedOutlineArcPoints.length - 2)
      || outlineArcHandle.target !== `${editedDiameterArc.id}:edge`
      || Math.abs(outlineArcMidDistance - editedDiameterArc.radius) > 1e-6
  ) {
    console.error("FAILED: outline circular arc handles should expose render-segment-length sampled arc points as display-only internals while keeping one semantic edge handle for WebGL picking");
    return 1;
  }
  const pointOnCircleBaseSketch = sketchFromRoundedRectangle(100, 60, 10, "poc");
  const pointOnCircleArc = sketchEdges(pointOnCircleBaseSketch).find((edge) => edge.kind === "circular-arc");
  const pointOnCircleObject = {
    id: "point_on_circle_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      ...pointOnCircleBaseSketch,
      constructionVertices: [{
        id: "poc_cv",
        point: [pointOnCircleArc.center[0] + pointOnCircleArc.radius * 1.7, pointOnCircleArc.center[1]]
      }]
    }
  };
  const pointOnCircleSolved = upsertSketchRelation(pointOnCircleObject, {
    type: "point-on-circle",
    vertexId: "poc_cv",
    edgeId: pointOnCircleArc.id
  });
  const pointOnCircleRelation = sketchRelations(pointOnCircleSolved.sketch).find((relation) => relation.type === "point-on-circle");
  const pointOnCircleVertex = (pointOnCircleSolved.sketch.constructionVertices || []).find((vertex) => vertex.id === "poc_cv");
  const pointOnCircleDistance = Math.hypot(
    pointOnCircleVertex.point[0] - pointOnCircleArc.center[0],
    pointOnCircleVertex.point[1] - pointOnCircleArc.center[1]
  );
  const pointOnCircleHealth = pointOnCircleRelation ? sketchRelationHealth(pointOnCircleSolved.sketch)[pointOnCircleRelation.id] : null;
  if (
    !pointOnCircleRelation
      || pointOnCircleHealth?.status !== "ok"
      || Math.abs(pointOnCircleDistance - pointOnCircleArc.radius) > 1e-6
  ) {
    console.error("FAILED: point-on-circle relation should solve a selected point onto the selected circular arc radius");
    return 1;
  }
  const dimensionSketchObject = {
    id: "dimension_smoke",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: sketchFromRectangle(100, 60, "dim")
  };
  const dimensionEdge = sketchEdges(dimensionSketchObject.sketch).find((edge) => edge.kind !== "circular-arc");
  const lengthDimensionSketch = setSketchEdgeLength(dimensionSketchObject, dimensionEdge.id, 100, { mode: "driven" });
  if (!sketchRelations(lengthDimensionSketch.sketch).some((relation) => (
    relation.type === "length" && relation.edgeId === dimensionEdge.id && relation.mode === "driven"
  ))) {
    console.error("FAILED: standalone sketch length dimension should store a driven reference relation");
    return 1;
  }
  const dimensionAngleEdgeIds = sketchEdges(dimensionSketchObject.sketch).slice(0, 2).map((edge) => edge.id);
  const angleDimensionSketch = setSketchEdgeAngle(dimensionSketchObject, dimensionAngleEdgeIds, 90, { mode: "driven" });
  if (!sketchRelations(angleDimensionSketch.sketch).some((relation) => (
    relation.type === "angle"
      && relation.mode === "driven"
      && dimensionAngleEdgeIds.every((edgeId) => relation.edgeIds.includes(edgeId))
  ))) {
    console.error("FAILED: standalone sketch angle dimension should store a driven reference relation");
    return 1;
  }
  const lineOnlyGuardSketchObject = {
    id: "line_only_relation_guard",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      ...sketchFromRoundedRectangle(100, 60, 10, "line_only_guard"),
      constructionVertices: [{ id: "line_only_guard_cv", point: [60, 40] }]
    }
  };
  const lineOnlyGuardArc = sketchEdges(lineOnlyGuardSketchObject.sketch).find((edge) => edge.kind === "circular-arc");
  const lineOnlyGuardLine = sketchEdges(lineOnlyGuardSketchObject.sketch).find((edge) => edge.kind !== "circular-arc");
  const expectLineOnlyArcRejection = (label, callback) => {
    try {
      callback();
    } catch (error) {
      if (String(error?.message || "").includes("requires straight sketch edges")) return true;
      console.error(`FAILED: ${label} on a circular arc rejected with the wrong message: ${error?.message || error}`);
      return false;
    }
    console.error(`FAILED: ${label} should reject circular arc edges instead of storing chord-based line semantics`);
    return false;
  };
  if (
    !expectLineOnlyArcRejection("Length relation", () => setSketchEdgeLength(lineOnlyGuardSketchObject, lineOnlyGuardArc.id, 100, { mode: "driven" }))
      || !expectLineOnlyArcRejection("Angle relation", () => setSketchEdgeAngle(lineOnlyGuardSketchObject, [lineOnlyGuardLine.id, lineOnlyGuardArc.id], 45, { mode: "driven" }))
      || !expectLineOnlyArcRejection("Parallel relation", () => upsertSketchRelation(lineOnlyGuardSketchObject, { type: "parallel", edgeIds: [lineOnlyGuardLine.id, lineOnlyGuardArc.id] }))
      || !expectLineOnlyArcRejection("Point on line relation", () => upsertSketchRelation(lineOnlyGuardSketchObject, {
        type: "point-on-line",
        vertexId: "line_only_guard_cv",
        edgeId: lineOnlyGuardArc.id
      }))
  ) {
    return 1;
  }
  const lineOnlyGuardEdges = sketchEdges(lineOnlyGuardSketchObject.sketch);
  const lineOnlyGuardVertexMap = new Map([
    ...sketchVertices(lineOnlyGuardSketchObject.sketch),
    ...(lineOnlyGuardSketchObject.sketch.constructionVertices || [])
  ].map((vertex) => [vertex.id, vertex]));
  const quickRelationItemsForSelection = ({
    edgeIds = [],
    vertexIds = [],
    object = lineOnlyGuardSketchObject,
    edges = lineOnlyGuardEdges,
    vertexMap = lineOnlyGuardVertexMap,
    constructionEdgeIds = new Set()
  }) => {
    const actionOverlay = relationActionOverlayForSelection(object, {
      edges,
      vertexMap,
      constructionEdgeIds,
      selectedEdgeIds: edgeIds,
      selectedVertexIds: vertexIds
    });
    return actionOverlay.quickLists[0]?.items || [];
  };
  const quickRelationTypesForSelection = (selectionOptions) => (
    quickRelationItemsForSelection(selectionOptions)
      .map((item) => item.handle?.relationType || null)
      .filter(Boolean)
  );
  const vertexArcQuickTypes = quickRelationTypesForSelection({
    edgeIds: [lineOnlyGuardArc.id],
    vertexIds: ["line_only_guard_cv"]
  });
  if (
    !vertexArcQuickTypes.includes("point-on-circle")
      || vertexArcQuickTypes.includes("point-on-line")
      || vertexArcQuickTypes.includes("midpoint")
  ) {
    console.error(`FAILED: point + circular arc quick actions should offer Point On Circle only, got ${vertexArcQuickTypes.join(",")}`);
    return 1;
  }
  const symmetricArcQuickTypes = quickRelationTypesForSelection({
    edgeIds: [lineOnlyGuardArc.id],
    vertexIds: ["line_only_guard_cv", "line_only_guard_v1"]
  });
  if (symmetricArcQuickTypes.includes("symmetric")) {
    console.error(`FAILED: two points + circular arc quick actions should hide Symmetric, got ${symmetricArcQuickTypes.join(",")}`);
    return 1;
  }
  const singleArcQuickTypes = quickRelationTypesForSelection({ edgeIds: [lineOnlyGuardArc.id] });
  if (
    !singleArcQuickTypes.includes("radius")
      || singleArcQuickTypes.includes("horizontal")
      || singleArcQuickTypes.includes("vertical")
      || singleArcQuickTypes.includes("construction-line")
  ) {
    console.error(`FAILED: single circular arc quick actions should hide line-only actions and show Radius, got ${singleArcQuickTypes.join(",")}`);
    return 1;
  }
  const constructionArcQuickObject = {
    id: "construction_arc_quick_guard",
    type: "plate-sketch",
    ...arcDragPlacement,
    sketch: {
      ...sketchFromRectangle(100, 60, "construction_arc_guard"),
      constructionVertices: [
        { id: "construction_arc_guard_cv1", point: [0, 10] },
        { id: "construction_arc_guard_cv2", point: [10, 0] }
      ],
      constructionEdges: [
        {
          id: "construction_arc_guard_ce1",
          from: "construction_arc_guard_cv1",
          to: "construction_arc_guard_cv2",
          kind: "circular-arc",
          center: [0, 0],
          radius: 10,
          direction: "cw"
        }
      ]
    }
  };
  const constructionArcQuickEdges = [
    ...sketchEdges(constructionArcQuickObject.sketch),
    ...(constructionArcQuickObject.sketch.constructionEdges || [])
  ];
  const constructionArcQuickVertexMap = new Map([
    ...sketchVertices(constructionArcQuickObject.sketch),
    ...(constructionArcQuickObject.sketch.constructionVertices || [])
  ].map((vertex) => [vertex.id, vertex]));
  const constructionArcQuickTypes = quickRelationTypesForSelection({
    object: constructionArcQuickObject,
    edges: constructionArcQuickEdges,
    vertexMap: constructionArcQuickVertexMap,
    constructionEdgeIds: new Set(["construction_arc_guard_ce1"]),
    edgeIds: ["construction_arc_guard_ce1"]
  });
  if (
    !constructionArcQuickTypes.includes("fixed")
      || !constructionArcQuickTypes.includes("clear")
      || !constructionArcQuickTypes.includes("radius")
      || !constructionArcQuickTypes.includes("diameter")
      || ["flip-arc", "split-arc", "horizontal", "vertical", "construction-line"].some((type) => constructionArcQuickTypes.includes(type))
  ) {
    console.error(`FAILED: construction circular arc quick actions should expose arc dimension actions without outline modifiers, got ${constructionArcQuickTypes.join(",")}`);
    return 1;
  }
  const lineArcQuickTypes = quickRelationTypesForSelection({ edgeIds: [lineOnlyGuardLine.id, lineOnlyGuardArc.id] });
  if (
    !lineArcQuickTypes.includes("tangent")
      || ["parallel", "collinear", "perpendicular", "equal-length", "angle"].some((type) => lineArcQuickTypes.includes(type))
  ) {
    console.error(`FAILED: line + circular arc quick actions should expose arc relations only, got ${lineArcQuickTypes.join(",")}`);
    return 1;
  }
  const secondLineOnlyGuardArc = lineOnlyGuardEdges.find((edge) => edge.kind === "circular-arc" && edge.id !== lineOnlyGuardArc.id);
  const arcArcQuickItems = quickRelationItemsForSelection({ edgeIds: [lineOnlyGuardArc.id, secondLineOnlyGuardArc.id] });
  const arcArcQuickTypes = arcArcQuickItems
    .map((item) => item.handle?.relationType || null)
    .filter(Boolean);
  if (
    !arcArcQuickTypes.includes("tangent")
      || !arcArcQuickTypes.includes("concentric")
      || !arcArcQuickTypes.includes("equal-radius")
      || ["parallel", "collinear", "perpendicular", "equal-length", "angle"].some((type) => arcArcQuickTypes.includes(type))
  ) {
    console.error(`FAILED: arc + arc quick actions should expose only arc-aware edge relations, got ${arcArcQuickTypes.join(",")}`);
    return 1;
  }
  const arcArcTangentQuickItem = arcArcQuickItems.find((item) => item.handle?.relationType === "tangent");
  const arcArcConcentricQuickItem = arcArcQuickItems.find((item) => item.handle?.relationType === "concentric");
  const arcArcEqualRadiusQuickItem = arcArcQuickItems.find((item) => item.handle?.relationType === "equal-radius");
  if (
    arcArcTangentQuickItem?.tone !== "conflicted"
      || !String(arcArcTangentQuickItem?.title || "").includes("Tangent relation is not satisfied")
      || arcArcConcentricQuickItem?.tone !== "conflicted"
      || !String(arcArcConcentricQuickItem?.title || "").includes("Concentric relation is not satisfied")
      || arcArcEqualRadiusQuickItem?.tone === "conflicted"
  ) {
    console.error("FAILED: arc + arc quick actions should surface concrete conflict reasons for unsatisfied Tangent/Concentric while keeping Equal Radius non-conflicted");
    return 1;
  }
  const lineOnlySnapRelationTypes = new Set(["horizontal", "vertical", "parallel", "collinear", "perpendicular", "equal-length", "angle"]);
  const invalidArcSnapRelation = (relation) => {
    if (!relation || !lineOnlySnapRelationTypes.has(relation.type)) return false;
    if (relation.edgeId === lineOnlyGuardArc.id) return true;
    return Array.isArray(relation.edgeIds) && relation.edgeIds.includes(lineOnlyGuardArc.id);
  };
  const lineOnlyGuardVertexDrag = vertexDragContext(lineOnlyGuardSketchObject, "line_only_guard_v2", {});
  const vertexSnapRelations = vertexSnapCandidates(lineOnlyGuardVertexDrag, [42, -25], {}, {}, { dx: 0, dy: 0 })
    .flatMap((candidate) => candidate.relations || [])
    .filter(Boolean);
  if (vertexSnapRelations.some(invalidArcSnapRelation)) {
    console.error(`FAILED: vertex snap candidates should not attach line-only relations to adjacent circular arcs, got ${JSON.stringify(vertexSnapRelations)}`);
    return 1;
  }
  const arcEdgeDrag = edgeDragContext(lineOnlyGuardSketchObject, lineOnlyGuardArc.id, {}, {});
  const arcEdgeSnapRelations = (arcEdgeDrag?.snapCandidates || [])
    .flatMap((candidate) => candidate.relations || [])
    .filter(Boolean);
  if (arcEdgeSnapRelations.some(invalidArcSnapRelation)) {
    console.error(`FAILED: arc edge drag snap candidates should not attach collinear relations to circular arcs, got ${JSON.stringify(arcEdgeSnapRelations)}`);
    return 1;
  }
  const lineEdgeDrag = edgeDragContext(lineOnlyGuardSketchObject, lineOnlyGuardLine.id, {}, {});
  const lineEdgeSnapRelations = (lineEdgeDrag?.snapCandidates || [])
    .flatMap((candidate) => candidate.relations || [])
    .filter(Boolean);
  if (lineEdgeSnapRelations.some(invalidArcSnapRelation)) {
    console.error(`FAILED: line edge drag snap candidates should skip circular arc collinear targets, got ${JSON.stringify(lineEdgeSnapRelations)}`);
    return 1;
  }
  const dimensionVertexIds = sketchVertices(dimensionSketchObject.sketch).slice(0, 2).map((vertex) => vertex.id);
  const distanceDimensionSketch = setSketchPointDistance(dimensionSketchObject, dimensionVertexIds, 100, { mode: "driven" });
  if (!sketchRelations(distanceDimensionSketch.sketch).some((relation) => (
    relation.type === "distance"
      && relation.mode === "driven"
      && dimensionVertexIds.every((vertexId) => relation.vertexIds.includes(vertexId))
  ))) {
    console.error("FAILED: standalone sketch distance dimension should store a driven reference relation");
    return 1;
  }
  const centerArcContourSketch = sketchFromCenterArc(25, 90, "center_arc_contour_smoke", [10, 5], 0);
  if (sketchEdges(centerArcContourSketch).length !== 3 || sketchEdges(centerArcContourSketch).filter((edge) => edge.kind === "circular-arc").length !== 1) {
    console.error("FAILED: sketchFromCenterArc should create a closed three-edge arc-sector contour with one semantic circular arc");
    return 1;
  }
  if (!sketchRelations(centerArcContourSketch).some((relation) => relation.type === "radius" && relation.mode === "driven")) {
    console.error("FAILED: sketchFromCenterArc should store a driven radius relation");
    return 1;
  }
  const roundedSketchProject = readJson(path.join(ROOT, "bobercad", "data", "projects", "sample_rounded_sketch.json"));
  const roundedSketchSampleObject = roundedSketchProject.model?.sketches?.rounded_sketch_arc_demo;
  const roundedSketchSample = roundedSketchSampleObject?.sketch || {};
  const roundedSketchSampleEdges = sketchEdges(roundedSketchSample);
  const roundedSketchSampleArcs = roundedSketchSampleEdges.filter((edge) => edge.kind === "circular-arc");
  const generatedGeometryKeys = [];
  const generatedGeometryKeyPattern = /^(mesh|meshes|triangles|faces|brep|sceneGraph|polyline|polylines|sampledPoints|tessellatedPoints|displayPoints|generatedGeometry)$/i;
  const collectGeneratedGeometryKeys = (value, trail = [], output = generatedGeometryKeys) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectGeneratedGeometryKeys(item, [...trail, String(index)], output));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const nextTrail = [...trail, key];
      if (generatedGeometryKeyPattern.test(key)) output.push(nextTrail.join("."));
      collectGeneratedGeometryKeys(child, nextTrail, output);
    }
  };
  collectGeneratedGeometryKeys(roundedSketchSampleObject);
  const arcEdgeAllowedKeys = new Set(["id", "from", "to", "kind", "center", "radius", "direction"]);
  const lineEdgeAllowedKeys = new Set(["id", "from", "to"]);
  const roundedSketchSampleUnexpectedEdgeKeys = roundedSketchSampleEdges.flatMap((edge) => {
    const allowed = edge.kind === "circular-arc" ? arcEdgeAllowedKeys : lineEdgeAllowedKeys;
    return Object.keys(edge).filter((key) => !allowed.has(key)).map((key) => `${edge.id}.${key}`);
  });
  if (
    sketchVertices(roundedSketchSample).length !== 8
      || roundedSketchSampleEdges.length !== 8
      || roundedSketchSampleArcs.length !== 4
      || roundedSketchSampleArcs.some((edge) => (
        !Array.isArray(edge.center)
          || edge.center.length !== 2
          || !Number.isFinite(Number(edge.radius))
          || Number(edge.radius) <= 0
          || !["cw", "ccw"].includes(edge.direction)
      ))
      || generatedGeometryKeys.length
      || roundedSketchSampleUnexpectedEdgeKeys.length
  ) {
    console.error(`FAILED: sample_rounded_sketch should store analytic circular arcs only, without generated tessellation (${[
      ...generatedGeometryKeys,
      ...roundedSketchSampleUnexpectedEdgeKeys
    ].join(", ")})`);
    return 1;
  }
  const cornerReliefCircularSpec = resolvePlateCornerReliefSpec(
    { type: "round", radius: 16, gap: 2, flangeGap: -4, flangeGapMode: "butt" },
    { thickness: 8 }
  );
  const cornerReliefRectSpec = resolvePlateCornerReliefSpec(
    { type: "rect", width: 12, depth: 18, gap: 3 },
    { thickness: 8 }
  );
  const cornerReliefObroundSpec = resolvePlateCornerReliefSpec(
    { type: "obround", width: 10, depth: 24 },
    { thickness: 8 }
  );
  const cornerReliefUnsupportedTearSpec = resolvePlateCornerReliefSpec(
    { type: "tear", depth: 16 },
    { thickness: 8 }
  );
  const cornerReliefVNotchSpec = resolvePlateCornerReliefSpec(
    { type: "v-notch", width: 10, depth: 18, gap: 1 },
    { thickness: 8 }
  );
  const cornerReliefMissingSpec = resolvePlateCornerReliefSpec(
    { type: "circular" },
    { thickness: 8 }
  );
  const cornerReliefZeroRadiusSpec = resolvePlateCornerReliefSpec(
    { type: "circular", radius: 0 },
    { thickness: 8 }
  );
  const cornerReliefZeroRectSpec = resolvePlateCornerReliefSpec(
    { type: "rectangular", width: 0, depth: 0 },
    { thickness: 8 }
  );
  const cornerReliefNegativeRadiusSpec = resolvePlateCornerReliefSpec(
    { type: "circular", radius: -5 },
    { thickness: 8 }
  );
  const cornerReliefNegativeGapSpec = resolvePlateCornerReliefSpec(
    { type: "rectangular", width: 10, depth: 10, gap: -2 },
    { thickness: 8 }
  );
  const cornerReliefObroundNegativeSpec = resolvePlateCornerReliefSpec(
    { type: "obround", width: -4, depth: 20 },
    { thickness: 8 }
  );
  const cornerReliefCircularSizeSpec = resolvePlateCornerReliefSpec(
    { type: "circular", size: 1.5 },
    { thickness: 8 }
  );
  const cornerReliefRectSizeSpec = resolvePlateCornerReliefSpec(
    { type: "rectangular", size: 1.25 },
    { thickness: 8 }
  );
  if (
    canonicalPlateCornerReliefType("round") !== "circular"
      || canonicalPlateCornerReliefType("rect") !== "rectangular"
      || canonicalPlateCornerReliefType("v-notch") !== "circular"
      || canonicalPlateCornerReliefType("none") !== "circular"
      || JSON.stringify(cornerReliefRequiredFields("obround")) !== JSON.stringify([])
      || cornerReliefCircularSpec.type !== "circular"
      || cornerReliefCircularSpec.size !== 2
      || cornerReliefCircularSpec.radius !== 16
      || cornerReliefCircularSpec.clearance !== 0
      || cornerReliefCircularSpec.flangeGap !== -4
      || cornerReliefCircularSpec.flangeGapExplicit !== true
      || cornerReliefCircularSpec.flangeGapMode !== "butt"
      || cornerReliefCircularSpec.flangeGapSwapped !== false
      || !cornerReliefCircularSpec.properties?.some((property) => property.key === "size" && property.required === true && property.value === 2)
      || cornerReliefRectSpec.type !== "rectangular"
      || cornerReliefRectSpec.size !== 2.25
      || cornerReliefRectSpec.width !== 18
      || cornerReliefRectSpec.depth !== 18
      || cornerReliefRectSpec.clearance !== 3
      || cornerReliefObroundSpec.type !== "obround"
      || cornerReliefObroundSpec.size !== 3
      || cornerReliefObroundSpec.width !== 24
      || cornerReliefObroundSpec.radius !== 2
      || cornerReliefObroundSpec.depth !== 24
      || cornerReliefObroundSpec.flangeGapExplicit !== true
      || cornerReliefUnsupportedTearSpec.type !== "tear"
      || cornerReliefUnsupportedTearSpec.status !== "invalid"
      || !cornerReliefUnsupportedTearSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.type.unsupported" && diagnostic.severity === "error")
      || cornerReliefVNotchSpec.status !== "invalid"
      || !cornerReliefVNotchSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.type.unsupported" && diagnostic.severity === "error")
      || cornerReliefMissingSpec.status !== "invalid"
      || cornerReliefMissingSpec.radius !== null
      || !cornerReliefMissingSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.size.missing" && diagnostic.severity === "error")
      || cornerReliefZeroRadiusSpec.radius !== 0
      || cornerReliefZeroRectSpec.width !== 0
      || cornerReliefZeroRectSpec.depth !== 0
      || cornerReliefNegativeRadiusSpec.status !== "invalid"
      || !cornerReliefNegativeRadiusSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.radius.invalid" && diagnostic.severity === "error")
      || cornerReliefNegativeGapSpec.status !== "invalid"
      || cornerReliefNegativeGapSpec.clearance !== 0
      || !cornerReliefNegativeGapSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.gap.invalid" && diagnostic.severity === "error")
      || cornerReliefObroundNegativeSpec.status !== "invalid"
      || !cornerReliefObroundNegativeSpec.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.width.invalid" && diagnostic.severity === "error")
      || cornerReliefCircularSizeSpec.radius !== 12
      || cornerReliefRectSizeSpec.width !== 10
      || cornerReliefRectSizeSpec.depth !== 10
  ) {
    console.error("FAILED: corner relief spec resolver should canonicalize aliases, expose a single thickness-relative size property, remove none/v-notch/tear as supported types, and reject invalid or missing required dimensions instead of applying fallbacks");
    return 1;
  }
  const reliefSiteSketch = sketchFromRectangle(100, 80, "relief_site");
  const reliefSiteEdges = sketchEdges(reliefSiteSketch);
  const reliefSitePlate = (bends) => ({
    id: "relief_site_plate",
    type: bends.length ? "bent-plate" : "plate",
    thickness: 8,
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    sketch: reliefSiteSketch,
    fabrication: { bends }
  });
  const reliefInspectorFallbackPlate = {
    ...reliefSitePlate([
      { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
    ]),
    fabrication: {
      bends: [
        { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
      ],
      reliefDefaults: { type: "circular", radius: 16 }
    }
  };
  const reliefInspectorSections = inspectorEditableObjectPropertySections({
    collection: "plates",
    object: reliefInspectorFallbackPlate,
    objectId: reliefInspectorFallbackPlate.id,
    objectState: {
      bends: reliefInspectorFallbackPlate.fabrication.bends,
      cornerReliefs: plateCornerReliefs(reliefInspectorFallbackPlate),
      resolvedReliefDefaults: resolvePlateCornerReliefSpec(reliefInspectorFallbackPlate.fabrication.reliefDefaults, reliefInspectorFallbackPlate),
      definition: { label: "Defined" },
      outlineVertices: 4
    }
  });
  const reliefInspectorDefaultSection = reliefInspectorSections.find((section) => section.id === "inspector.properties.object.plate.cornerRelief");
  if (
    !reliefInspectorDefaultSection
      || !reliefInspectorDefaultSection.fields.some((field) => field.label === "Size" && field.value === 2)
      || reliefInspectorDefaultSection.fields.some((field) => field.label === "Diagnostics")
  ) {
    console.error("FAILED: Corner Relief properties should use the model resolver for effective dimensions without private UI fallbacks");
    return 1;
  }
  const reliefInspectorUnresolvedSections = inspectorEditableObjectPropertySections({
    collection: "plates",
    object: reliefInspectorFallbackPlate,
    objectId: reliefInspectorFallbackPlate.id,
    objectState: {
      bends: reliefInspectorFallbackPlate.fabrication.bends,
      cornerReliefs: plateCornerReliefs(reliefInspectorFallbackPlate),
      definition: { label: "Defined" },
      outlineVertices: 4
    }
  });
  const reliefInspectorUnresolvedDefaultSection = reliefInspectorUnresolvedSections.find((section) => section.id === "inspector.properties.object.plate.cornerRelief");
  if (
    !reliefInspectorUnresolvedDefaultSection?.fields?.some((field) => field.label === "Diagnostics" && String(field.value || "").includes("resolved model state was not provided"))
      || reliefInspectorUnresolvedDefaultSection.fields.some((field) => field.label === "Size" && field.value === 2)
  ) {
    console.error("FAILED: Corner Relief properties should not synthesize effective dimensions when resolved model state is missing");
    return 1;
  }
  const reliefSiteNoBends = evaluateCornerReliefSites(reliefSitePlate([]));
  const reliefSiteSingleBend = evaluateCornerReliefSites(reliefSitePlate([
    { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
  ]));
  const reliefSiteOppositeBends = evaluateCornerReliefSites(reliefSitePlate([
    { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b3", edgeId: reliefSiteEdges[2].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
  ]));
  const reliefSiteAdjacentBends = evaluateCornerReliefSites(reliefSitePlate([
    { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
  ]));
  const reliefSiteWithChildBendPlate = reliefSitePlate([
    { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b1_start_side", parentBendId: "relief_site_b1", parentEdge: "start", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
  ]);
  const reliefSiteWithEndChildBend = evaluateCornerReliefSites(reliefSitePlate([
    { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
    { id: "relief_site_b2_end_side", parentBendId: "relief_site_b2", parentEdge: "end", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
  ]));
  const reliefSiteWithChildBend = evaluateCornerReliefSites(reliefSiteWithChildBendPlate);
  const reliefSiteSketchCorner = reliefSiteAdjacentBends.find((site) => site.kind === "sketch-corner");
  const reliefSiteChildCorners = reliefSiteWithChildBend.filter((site) => site.kind === "bend-corner");
  const reliefSiteEndChildCorner = reliefSiteWithEndChildBend.find((site) => site.kind === "bend-corner");
  const reliefSiteChildChartResult = buildPlateSheetCharts(reliefSiteWithChildBendPlate, settings.render?.curves || {});
  const reliefSiteChildBendChart = reliefSiteChildChartResult.chartById.get("bend:relief_site_b1_start_side");
  const reliefSiteChildFlangeChart = reliefSiteChildChartResult.chartById.get("flange:relief_site_b1_start_side");
  const reliefSiteChildChartsAreRuntimeOnly = reliefSiteChildBendChart?.parentBendId === "relief_site_b1"
    && reliefSiteChildBendChart?.parentEdge === "start"
    && reliefSiteChildBendChart?.sourceChartId === "flange:relief_site_b1"
    && reliefSiteChildBendChart?.length === 20
    && reliefSiteChildBendChart?.developedWidth > 0
    && reliefSiteChildFlangeChart?.flangeLength === 12
    && [reliefSiteChildBendChart, reliefSiteChildFlangeChart].every((chart) => (
      chart?.domain2d?.length === 4
        && chart.mapTo3d([0, 0])?.every(Number.isFinite)
        && chart.mapTo3d([chart.length, chart.kind === "bend" ? chart.developedWidth : chart.flangeLength])?.every(Number.isFinite)
    ));
  const reliefSiteChildAffectedChartsExist = reliefSiteChildCorners.every((site) => (
    site.affectedChartIds.every((chartId) => reliefSiteChildChartResult.chartById.has(chartId))
  ));
  if (
    reliefSiteNoBends.length !== 0
      || reliefSiteSingleBend.length !== 0
      || reliefSiteOppositeBends.length !== 0
      || reliefSiteAdjacentBends.length !== 1
      || reliefSiteSketchCorner?.key !== `sketch:${reliefSiteEdges[0].to}`
      || reliefSiteSketchCorner?.target?.kind !== "sketchVertex"
      || reliefSiteSketchCorner?.bends?.map((bend) => bend.bendId).join(",") !== "relief_site_b1,relief_site_b2"
      || !reliefSiteSketchCorner?.affectedChartIds?.includes("base")
      || !reliefSiteSketchCorner?.affectedChartIds?.includes("bend:relief_site_b1")
      || !reliefSiteSketchCorner?.affectedChartIds?.includes("flange:relief_site_b2")
      || reliefSiteChildCorners.length !== 1
      || !reliefSiteChildCorners.some((site) => site.key === "bend:relief_site_b1:start:relief_site_b1_start_side:start")
      || reliefSiteEndChildCorner?.key !== "bend:relief_site_b2:end:relief_site_b2_end_side:start"
      || reliefSiteEndChildCorner?.target?.parentEndpoint !== "end"
      || reliefSiteEndChildCorner?.bends?.find((bend) => bend.bendId === "relief_site_b2")?.endpoint !== "end"
      || reliefSiteEndChildCorner?.bends?.find((bend) => bend.bendId === "relief_site_b2_end_side")?.endpoint !== "start"
      || !reliefSiteChildChartsAreRuntimeOnly
      || !reliefSiteChildAffectedChartsExist
  ) {
    console.error("FAILED: corner relief site/chart evaluators should create explicit sketch-corner sites only for adjacent root bends, separate bend-corner sites for child bends, and runtime-only child bend/flange charts");
    return 1;
  }
  const reliefChartDistance3 = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[1] || 0) - (b?.[1] || 0), (a?.[2] || 0) - (b?.[2] || 0));
  const reliefChartMinDistance3 = (point, points) => (
    Math.min(...(points || []).map((candidate) => reliefChartDistance3(point, candidate)))
  );
  const reliefChartSharedBoundaryConsistent = (evaluation, site) => {
    const baseCutout = (evaluation.cutouts || []).find((cutout) => cutout.chartId === "base" && cutout.siteKey === site?.key);
    const bendCutouts = (evaluation.cutouts || []).filter((cutout) => cutout.type !== "flange-spacing" && cutout.chartKind === "bend" && cutout.siteKey === site?.key);
    const flangeCutouts = (evaluation.cutouts || []).filter((cutout) => cutout.type !== "flange-spacing" && cutout.chartKind === "flange" && cutout.siteKey === site?.key);
    const baseChart = evaluation.chartById.get("base");
    const baseReliefPointIndexes = new Set();
    for (const edge of baseChart?.boundaryEdges || []) {
      if (edge.source !== "relief" || edge.reliefSiteKey !== site?.key) continue;
      baseReliefPointIndexes.add(edge.startIndex);
      baseReliefPointIndexes.add(edge.endIndex);
    }
    const baseReliefPoints3d = baseReliefPointIndexes.size
      ? [...baseReliefPointIndexes]
        .map((index) => baseChart?.mapTo3d(baseChart?.clippedBoundary2d?.[index]))
        .filter(Boolean)
      : (baseCutout?.points3d || []);
    if (!baseReliefPoints3d.length || !bendCutouts.length || !flangeCutouts.length) return false;
    const baseJoinsBends = bendCutouts.every((cutout) => {
      const chart = evaluation.chartById.get(cutout.chartId);
      const first = cutout.points2d?.[0];
      if (!chart || !first) return false;
      const basePoint2d = [
        chart.edgeStart2d[0] + chart.tangent2d[0] * first[0],
        chart.edgeStart2d[1] + chart.tangent2d[1] * first[0]
      ];
      const basePoint3d = baseChart?.mapTo3d(basePoint2d);
      return basePoint3d
        && reliefChartDistance3(cutout.points3d[0], basePoint3d) <= 1e-6
        && reliefChartMinDistance3(basePoint3d, baseReliefPoints3d) <= 1e-6;
    });
    const bendsJoinFlanges = flangeCutouts.every((flangeCutout) => {
      if (!flangeCutout.points3d?.length) return true;
      const bendCutout = bendCutouts.find((cutout) => cutout.chartId === `bend:${flangeCutout.chartId.slice("flange:".length)}`);
      if (!bendCutout?.points3d?.length) return false;
      return reliefChartDistance3(bendCutout.points3d[bendCutout.points3d.length - 1], flangeCutout.points3d[0]) <= 1e-6;
    });
    return baseJoinsBends && bendsJoinFlanges;
  };
  const obroundEndpointCutsAreStraightAtOpenEndForSite = (evaluation, site) => (
    (evaluation.cutouts || [])
      .filter((cutout) => cutout.siteKey === site?.key && cutout.type === "obround" && cutout.endpoint && cutout.chartKind !== "base")
      .every((cutout) => {
        const chart = evaluation.chartById.get(cutout.chartId);
        const expectedInset = cutout.axisIndex === 1 ? cutout.effectiveDepth : cutout.effectiveWidth;
        return cutout.sLimit > 0
          && Math.abs(cutout.sLimit - expectedInset) <= 1e-7
          && (cutout.points2d || []).every((point) => {
            const endpointDistance = chart.distanceFromEndpoint(point, cutout.endpoint);
            const closesEndpointRegion = endpointDistance <= 1e-7
              && Math.abs((point?.[1] || 0) - (cutout.chartDepthLimit || 0)) <= 1e-7;
            return closesEndpointRegion || Math.abs(endpointDistance - expectedInset) <= 1e-7;
          });
      })
  );
  const baseReliefBoundaryPointsStayInCornerWedge = (evaluation, site) => {
    const chart = evaluation.chartById.get("base");
    const boundary = chart?.clippedBoundary2d || [];
    const index = boundary.findIndex((point) => Math.hypot(point[0] - site.basePoint2d[0], point[1] - site.basePoint2d[1]) <= 1e-7);
    const original = chart?.domain2d || [];
    const originalIndex = original.findIndex((point) => Math.hypot(point[0] - site.basePoint2d[0], point[1] - site.basePoint2d[1]) <= 1e-7);
    if (!chart || index >= 0 || originalIndex < 0) return false;
    const reliefIndexes = new Set();
    for (const edge of chart.boundaryEdges || []) {
      if (edge.source !== "relief" || edge.reliefSiteKey !== site.key) continue;
      reliefIndexes.add(edge.startIndex);
      reliefIndexes.add(edge.endIndex);
    }
    if (!reliefIndexes.size) return false;
    const xs = original.map((point) => point[0]);
    const ys = original.map((point) => point[1]);
    const minX = Math.min(...xs) - 1e-6;
    const maxX = Math.max(...xs) + 1e-6;
    const minY = Math.min(...ys) - 1e-6;
    const maxY = Math.max(...ys) + 1e-6;
    return [...reliefIndexes].every((pointIndex) => {
      const point = boundary[pointIndex];
      return Array.isArray(point)
        && point.length === 2
        && point.every(Number.isFinite)
        && point[0] >= minX
        && point[0] <= maxX
        && point[1] >= minY
        && point[1] <= maxY;
    });
  };
  const baseChartHasNoReliefForSite = (evaluation, site, type) => {
    const chart = evaluation.chartById.get("base");
    if (!chart || !site) return false;
    return !(chart.boundaryEdges || []).some((edge) => (
      edge.source === "relief"
        && edge.reliefSiteKey === site.key
    )) && !(chart.cutoutApplications || []).some((application) => (
      application.type === type
        && application.siteKey === site.key
    ));
  };
  const endpointCutoutPointsStayWithinChartLength = (evaluation, site) => (
    (evaluation.cutouts || [])
      .filter((cutout) => cutout.siteKey === site?.key && (cutout.chartKind === "bend" || cutout.chartKind === "flange"))
      .every((cutout) => {
        const chart = evaluation.chartById.get(cutout.chartId);
        return chart
          && (cutout.points2d || []).every((point) => (
            point[0] >= -1e-6
              && point[0] <= (chart.length || 0) + 1e-6
              && point[1] >= -1e-6
          ));
      })
  );
  const reliefChartPlate = (radius = 20, circularGap = 0) => ({
    ...reliefSitePlate([
      { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
    ]),
    fabrication: {
      bends: [
        { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
      ],
      reliefDefaults: { type: "circular", radius, gap: circularGap }
    }
  });
  const reliefChartFlangeGapPlate = (flangeGap, flangeGapMode = "symmetric", flangeGapSwapped = false) => ({
    ...reliefChartPlate(18, 0),
    fabrication: {
      bends: [
        { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
      ],
      reliefDefaults: { type: "circular", radius: 18, flangeGap, flangeGapMode, flangeGapSwapped }
    }
  });
  const reliefChartZeroFlangeGapEval = buildClippedReliefChartDomains(reliefChartFlangeGapPlate(0), settings.render?.curves || {});
  const reliefChartOverlapFlangeGapEval = buildClippedReliefChartDomains(reliefChartFlangeGapPlate(-8), settings.render?.curves || {});
  const reliefChartButtLapEval = buildClippedReliefChartDomains(reliefChartFlangeGapPlate(-8, "butt"), settings.render?.curves || {});
  const reliefChartSwappedButtLapEval = buildClippedReliefChartDomains(reliefChartFlangeGapPlate(-8, "butt", true), settings.render?.curves || {});
  const reliefChartZeroFlangeGapSpacing = (reliefChartZeroFlangeGapEval.cutouts || []).filter((cutout) => cutout.type === "flange-spacing");
  const reliefChartOverlapFlangeGapSpacing = (reliefChartOverlapFlangeGapEval.cutouts || []).filter((cutout) => cutout.type === "flange-spacing");
  const reliefChartButtLapSpacing = (reliefChartButtLapEval.cutouts || []).filter((cutout) => cutout.type === "flange-spacing");
  const reliefChartSwappedButtLapSpacing = (reliefChartSwappedButtLapEval.cutouts || []).filter((cutout) => cutout.type === "flange-spacing");
  const reliefChartButtLapOffsets = {
    incoming: reliefChartButtLapSpacing.filter((cutout) => cutout.flangeGapRole === "incoming"),
    outgoing: reliefChartButtLapSpacing.filter((cutout) => cutout.flangeGapRole === "outgoing")
  };
  const reliefChartSwappedButtLapOffsets = {
    incoming: reliefChartSwappedButtLapSpacing.filter((cutout) => cutout.flangeGapRole === "incoming"),
    outgoing: reliefChartSwappedButtLapSpacing.filter((cutout) => cutout.flangeGapRole === "outgoing")
  };
  const reliefChartFlangeGapControlsPhysicalDistance = reliefChartZeroFlangeGapSpacing.length === 2
    && reliefChartZeroFlangeGapSpacing.every((cutout) => cutout.flangeContactOffset > 0 && Math.abs(cutout.endpointOffset + cutout.flangeContactOffset) <= 1e-6)
    && reliefChartOverlapFlangeGapSpacing.length === 2
    && reliefChartOverlapFlangeGapSpacing.every((cutout) => cutout.flangeGapMode === "symmetric" && cutout.flangeContactOffset > 0 && Math.abs(cutout.endpointOffset - (-4 - cutout.flangeContactOffset)) <= 1e-6)
    && reliefChartButtLapSpacing.length === 1
    && reliefChartButtLapOffsets.incoming.length === 1
    && reliefChartButtLapOffsets.outgoing.length === 0
    && reliefChartButtLapOffsets.incoming.every((cutout) => cutout.flangeGapMode === "butt" && cutout.flangeGapSwapped === false && Math.abs(cutout.endpointOffset - (-8 - cutout.flangeContactOffset)) <= 1e-6)
    && reliefChartSwappedButtLapSpacing.length === 1
    && reliefChartSwappedButtLapOffsets.incoming.length === 0
    && reliefChartSwappedButtLapOffsets.outgoing.length === 1
    && reliefChartSwappedButtLapOffsets.outgoing.every((cutout) => cutout.flangeGapMode === "butt" && cutout.flangeGapSwapped === true && Math.abs(cutout.endpointOffset - (-8 - cutout.flangeContactOffset)) <= 1e-6)
    && !reliefChartZeroFlangeGapEval.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    && !reliefChartOverlapFlangeGapEval.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    && !reliefChartButtLapEval.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    && !reliefChartSwappedButtLapEval.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const reliefChartEval = buildReliefCutoutsForCharts(reliefChartPlate(20, 0), settings.render?.curves || {});
  const reliefChartExplicitPlate = reliefChartPlate(20, 0);
  const reliefChartExplicitCharts = buildPlateSheetCharts(reliefChartExplicitPlate, settings.render?.curves || {});
  const reliefChartInitialDomains = reliefChartExplicitCharts.charts.every((chart) => (
    chart.chartDomain2d?.kind === "polygon-set"
      && chart.chartDomain2d.supportedTopology === "single-outer-loop"
      && chart.chartDomain2d.operation === "identity"
      && chartDomainBoundary2d(chart.chartDomain2d).length === chart.domain2d.length
  ));
  const reliefChartExplicitSites = evaluateCornerReliefSites(reliefChartExplicitPlate);
  const reliefChartExplicitSpecs = resolveReliefSpecsForSites(reliefChartExplicitPlate, reliefChartExplicitSites);
  const reliefChartExplicitEval = applyReliefCutoutsToCharts(reliefChartExplicitCharts, reliefChartExplicitSites, reliefChartExplicitSpecs, settings.render?.curves || {});
  const reliefChartImplicitEval = buildClippedReliefChartDomains(reliefChartExplicitPlate, settings.render?.curves || {});
  const reliefChartMissingDomainEval = {
    ...reliefChartExplicitEval,
    charts: reliefChartExplicitEval.charts.map((chart, index) => (
      index === 0 ? (({ chartDomain2d, ...rest }) => rest)(chart) : chart
    ))
  };
  reliefChartMissingDomainEval.chartById = new Map(reliefChartMissingDomainEval.charts.map((chart) => [chart.id, chart]));
  const reliefChartMissingDomainGeometry = evaluateBentPlateChartGeometryFromEvaluation(reliefChartMissingDomainEval, reliefChartExplicitPlate, settings.render?.curves || {});
  const reliefChartMissingDomainRejected = reliefChartMissingDomainGeometry.diagnostics.some((diagnostic) => (
    diagnostic.code === "sheet-metal.chart-domain.invalid"
      && diagnostic.severity === "error"
  ));
  const reliefChartExplicitPipelineMatches = reliefChartExplicitEval.cutouts.length === reliefChartImplicitEval.cutouts.length
    && reliefChartExplicitEval.charts.length === reliefChartImplicitEval.charts.length
    && reliefChartExplicitEval.charts.every((chart, index) => (
      chart.clippedBoundary2d?.length === reliefChartImplicitEval.charts[index]?.clippedBoundary2d?.length
        && chart.boundaryEdges?.length === reliefChartImplicitEval.charts[index]?.boundaryEdges?.length
    ))
    && reliefChartInitialDomains
    && reliefChartMissingDomainRejected
    && reliefChartExplicitSites.every((site) => reliefChartExplicitSpecs.get(site.key))
    && !reliefChartExplicitEval.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const reliefChartSite = reliefChartEval.sites.find((site) => site.kind === "sketch-corner");
  const reliefChartBase = reliefChartEval.chartById.get("base");
  const reliefChartDevelopedCutout = buildReliefCutout2d(
    reliefChartSite,
    reliefChartEval.specs.get(reliefChartSite?.key),
    settings.render?.curves || {}
  );
  const reliefChartDevelopedCutoutBoundary = chartDomainBoundary2d(reliefChartDevelopedCutout?.cutoutRegion2d);
  const reliefChartDevelopedCutoutIsSingleCircle = reliefChartDevelopedCutout?.coordinateSystem === "developed-site"
    && reliefChartDevelopedCutout?.type === "circular"
    && reliefChartDevelopedCutout?.nominalRadius === 20
    && reliefChartDevelopedCutout?.effectiveRadius === 20
    && reliefChartDevelopedCutout.cutoutRegion2d?.kind === "polygon-set"
    && reliefChartDevelopedCutout.cutoutRegion2d.coordinateSystem === "developed-site"
    && reliefChartDevelopedCutout.cutoutRegion2d.metadata?.purpose === "cutout"
    && reliefChartDevelopedCutoutBoundary.length === reliefChartDevelopedCutout.points2d.length + 1
    && Math.hypot(reliefChartDevelopedCutoutBoundary[0][0] - reliefChartSite.basePoint2d[0], reliefChartDevelopedCutoutBoundary[0][1] - reliefChartSite.basePoint2d[1]) <= 1e-7
    && reliefChartDevelopedCutout.points2d.every((point) => Math.abs(Math.hypot(point[0] - reliefChartSite.basePoint2d[0], point[1] - reliefChartSite.basePoint2d[1]) - 20) <= 1e-6)
    && reliefChartDevelopedCutoutBoundary.slice(1).every((point) => Math.abs(Math.hypot(point[0] - reliefChartSite.basePoint2d[0], point[1] - reliefChartSite.basePoint2d[1]) - 20) <= 1e-6)
    && Math.abs(reliefChartDevelopedCutout.profile.edgeInsetAt(12) - Math.sqrt(20 * 20 - 12 * 12)) <= 1e-6;
  const reliefChartCutouts = reliefChartEval.cutouts.filter((cutout) => cutout.siteKey === reliefChartSite?.key);
  const reliefChartReliefCutouts = reliefChartCutouts.filter((cutout) => cutout.type !== "flange-spacing");
  const reliefChartEquationErrors = reliefChartReliefCutouts.flatMap((cutout) => (
    circularCutoutEquationError(cutout, reliefChartEval.chartById.get(cutout.chartId), reliefChartSite)
  ));
  const reliefChartPointsAreFinite = reliefChartReliefCutouts.every((cutout) => (
    cutout.points2d.every((point) => point.length === 2 && point.every(Number.isFinite))
      && cutout.points3d.every((point) => point.length === 3 && point.every(Number.isFinite))
      && cutout.points2d.length === cutout.points3d.length
  ));
  const reliefChartCutoutRegionsAreRuntimePolygons = reliefChartReliefCutouts.every((cutout) => {
    if (!cutout.points2d.length) return !cutout.cutoutRegion2d;
    const regionBoundary = chartDomainBoundary2d(cutout.cutoutRegion2d);
    return cutout.cutoutRegion2d?.kind === "polygon-set"
      && cutout.cutoutRegion2d.coordinateSystem === "chart-2d"
      && cutout.cutoutRegion2d.operation === "cutout-region"
      && cutout.cutoutRegion2d.metadata?.purpose === "cutout"
      && cutout.cutoutRegion2d.metadata?.chartId === cutout.chartId
      && regionBoundary.length >= 3
      && regionBoundary.every((point) => point.length === 2 && point.every(Number.isFinite));
  });
  const reliefChartBendCutouts = reliefChartReliefCutouts.filter((cutout) => cutout.chartKind === "bend");
  const reliefChartFlangeCutouts = reliefChartReliefCutouts.filter((cutout) => cutout.chartKind === "flange");
  const reliefChartSharedBoundary = reliefChartSharedBoundaryConsistent(reliefChartEval, reliefChartSite);
  const reliefChartCircularGapEval = buildReliefCutoutsForCharts(reliefChartPlate(20, 5), settings.render?.curves || {});
  const reliefChartCircularGapSite = reliefChartCircularGapEval.sites.find((site) => site.kind === "sketch-corner");
  const reliefChartCircularGapSpec = reliefChartCircularGapEval.specs.get(reliefChartCircularGapSite?.key);
  const reliefChartCircularGapBaseCutout = reliefChartCircularGapEval.cutouts.find((cutout) => cutout.chartId === "base");
  const reliefChartCircularGapIgnoredAcrossBendRadii = [2, 8, 24].every((bendRadius) => {
    const plate = reliefChartPlate(20, 5);
    plate.fabrication = {
      ...plate.fabrication,
      bends: plate.fabrication.bends.map((bend) => ({ ...bend, radius: bendRadius }))
    };
    const evaluation = buildReliefCutoutsForCharts(plate, settings.render?.curves || {});
    const site = evaluation.sites.find((candidate) => candidate.kind === "sketch-corner");
    const spec = evaluation.specs.get(site?.key);
    const cutouts = evaluation.cutouts.filter((cutout) => cutout.siteKey === site?.key && cutout.type !== "flange-spacing");
    const equationErrors = cutouts.flatMap((cutout) => (
      circularCutoutEquationError(cutout, evaluation.chartById.get(cutout.chartId), site)
    ));
    return spec?.radius === 20
      && spec?.clearance === 0
      && cutouts.length >= 3
      && cutouts.every((cutout) => cutout.nominalRadius === 20 && cutout.effectiveRadius === 20)
      && equationErrors.every((error) => error <= 1e-6);
  });
  const reliefChartLargeRadiusClippedEval = buildClippedReliefChartDomains(reliefChartPlate(90, 0), settings.render?.curves || {});
  const reliefChartLargeRadiusClampWarnings = reliefChartLargeRadiusClippedEval.diagnostics.filter((diagnostic) => (
    diagnostic.code === "corner-relief.cutout.clamped-by-edge"
  ));
  const reliefChartLargeRadiusHasNoBaseClampWarning = !reliefChartLargeRadiusClampWarnings.some((diagnostic) => diagnostic.chartId === "base");
  const reliefChartSmallRadiusEval = buildReliefCutoutsForCharts(reliefChartPlate(4, 0), settings.render?.curves || {});
  const reliefChartSmallRadiusFlangesEmpty = reliefChartSmallRadiusEval.cutouts
    .filter((cutout) => cutout.type !== "flange-spacing" && cutout.chartKind === "flange")
    .every((cutout) => cutout.points2d.length === 0 && cutout.points3d.length === 0);
  if (
    !reliefChartSite
      || !reliefChartBase
      || !reliefChartDevelopedCutoutIsSingleCircle
      || !reliefChartCutouts.some((cutout) => cutout.chartId === "base")
      || !reliefChartBendCutouts.some((cutout) => cutout.chartId === "bend:relief_site_b1")
      || !reliefChartBendCutouts.some((cutout) => cutout.chartId === "bend:relief_site_b2")
      || !reliefChartFlangeCutouts.some((cutout) => cutout.chartId === "flange:relief_site_b1")
      || !reliefChartFlangeCutouts.some((cutout) => cutout.chartId === "flange:relief_site_b2")
      || reliefChartEquationErrors.some((error) => error > 1e-6)
      || !reliefChartPointsAreFinite
      || !reliefChartCutoutRegionsAreRuntimePolygons
      || !reliefChartSharedBoundary
      || reliefChartCircularGapSpec?.radius !== 20
      || reliefChartCircularGapSpec?.clearance !== 0
      || reliefChartCircularGapBaseCutout?.nominalRadius !== 20
      || reliefChartCircularGapBaseCutout?.effectiveRadius !== 20
      || !reliefChartCircularGapIgnoredAcrossBendRadii
      || !reliefChartLargeRadiusHasNoBaseClampWarning
      || !reliefChartSmallRadiusFlangesEmpty
      || !reliefChartExplicitPipelineMatches
      || !reliefChartFlangeGapControlsPhysicalDistance
  ) {
    console.error("FAILED: sheet-metal chart cutouts should define circular relief once in developed coordinates across base, bend, and flange charts, keep circular gap from changing radius, convert flange gap into physical flange contact endpoint offsets, use explicit charts/sites/specs pipeline, and no base-side cutout resampling/clamping");
    return 1;
  }
  const reliefClippedEval = buildClippedReliefChartDomains(reliefChartPlate(20, 0), settings.render?.curves || {});
  const reliefClippedSite = reliefClippedEval.sites.find((site) => site.kind === "sketch-corner");
  const reliefClippedCharts = ["base", "bend:relief_site_b1", "bend:relief_site_b2", "flange:relief_site_b1", "flange:relief_site_b2"]
    .map((chartId) => reliefClippedEval.chartById.get(chartId));
  const clippedBoundaryHasNoDuplicates = reliefClippedCharts.every((chart) => (
    chart?.clippedBoundary2d?.length >= 3
      && chart.clippedBoundary2d.every((point) => point.length === 2 && point.every(Number.isFinite))
      && chart.clippedBoundary2d.every((point, index, points) => (
        index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 1e-7
      ))
  ));
  const clippedBoundaryHasReliefMetadata = reliefClippedCharts.every((chart) => (
    chart?.boundaryEdges?.some((edge) => (
      edge.source === "relief"
        && edge.reliefSiteKey === reliefClippedSite?.key
        && edge.cornerReliefRole === "cut-boundary"
    ))
  ));
  const clippedBoundaryPreservesChartDomain = reliefClippedCharts.every((chart) => (
    chart?.boundaryEdges?.some((edge) => edge.source === "domain")
  ));
  const clippedChartsExposeLocalCutoutApplications = reliefClippedCharts.every((chart) => {
    const expected = reliefClippedEval.cutouts.filter((cutout) => (
      cutout.chartId === chart?.id
        && (cutout.type !== "flange-spacing" || cutout.endpointOffset > 0)
    ));
    return Array.isArray(chart?.cutoutApplications)
      && chart.cutoutApplications.length === expected.length
      && chart.cutoutApplications.every((application) => (
        application.chartId === chart.id
          && application.siteKey === reliefClippedSite?.key
          && application.cornerReliefVertexId
          && application.cutoutRegion2d?.kind === "polygon-set"
          && application.cutoutRegion2d.coordinateSystem === "chart-2d"
      ));
  });
  const clippedBaseCutoutApplicationUsesAppliedRegion = (() => {
    const baseChart = reliefClippedEval.chartById.get("base");
    const baseApplication = baseChart?.cutoutApplications?.[0];
    const appliedBoundary = chartDomainBoundary2d(baseApplication?.cutoutRegion2d);
    const sourceBoundary = chartDomainBoundary2d(baseApplication?.sourceCutoutRegion2d);
    return baseApplication?.chartId === "base"
      && baseApplication.cutoutRegion2d?.metadata?.strategy === "circular-base-cutout"
      && sourceBoundary.length === appliedBoundary.length
      && appliedBoundary.length > 8
      && appliedBoundary.every((point, index) => (
        Math.hypot(point[0] - sourceBoundary[index][0], point[1] - sourceBoundary[index][1]) <= 1e-7
      ));
  })();
  const clippedChartsExposeDomainClipStrategy = reliefClippedCharts.every((chart) => {
    const expected = reliefClippedEval.cutouts.filter((cutout) => cutout.chartId === chart?.id);
    return chart?.domainClip?.coordinateSystem === "chart-2d"
      && chart.domainClip.operation === "difference"
      && chart.domainClip.strategy === (chart.kind === "base" ? "base-corner-cutouts" : "endpoint-cutouts")
      && chart.domainClip.domainOperation === "cutout-region-difference"
      && chart.domainClip.booleanBackend === "simple-polygon-segment-graph"
      && chart.domainClip.topology === "single-outer-loop"
      && chart.domainClip.cutoutCount === expected.length
      && chart.domainClip.cutoutRegionCount === expected.filter((cutout) => cutout.cutoutRegion2d).length
      && chart.chartDomain2d?.kind === "polygon-set"
      && chart.chartDomain2d.supportedTopology === "single-outer-loop"
      && chart.chartDomain2d.metadata?.domainOperation === "cutout-region-difference"
      && chart.chartDomain2d.metadata?.booleanBackend === "simple-polygon-segment-graph"
      && chart.chartDomain2d.metadata?.cutoutRegionCount === expected.filter((cutout) => cutout.cutoutRegion2d).length
      && chartDomainBoundary2d(chart.chartDomain2d).length === chart.clippedBoundary2d.length;
  });
  const clippedSmallRadiusEval = buildClippedReliefChartDomains(reliefChartPlate(4, 0), settings.render?.curves || {});
  const clippedSmallRadiusFlangesStayFiniteWithoutReliefEdges = ["flange:relief_site_b1", "flange:relief_site_b2"].every((chartId) => {
    const chart = clippedSmallRadiusEval.chartById.get(chartId);
    return chart?.clippedBoundary2d?.length >= 4
      && chart.clippedBoundary2d.every((point) => point.length === 2 && point.every(Number.isFinite))
      && !chart.boundaryEdges?.some((edge) => edge.source === "relief");
  });
  const clippedSmallRadiusOverlapPlate = reliefChartFlangeGapPlate(-8, "butt");
  clippedSmallRadiusOverlapPlate.fabrication = {
    ...clippedSmallRadiusOverlapPlate.fabrication,
    reliefDefaults: {
      ...clippedSmallRadiusOverlapPlate.fabrication.reliefDefaults,
      radius: 2
    }
  };
  const clippedSmallRadiusOverlapEval = buildClippedReliefChartDomains(clippedSmallRadiusOverlapPlate, settings.render?.curves || {});
  const unbackedSmallRadiusOverlapCharts = clippedSmallRadiusOverlapEval.charts.filter((chart) => {
    const hasNegativeSpacing = clippedSmallRadiusOverlapEval.cutouts.some((cutout) => (
      cutout.type === "flange-spacing"
        && cutout.chartId === chart.id
        && cutout.endpointOffset < -1e-7
    ));
    const hasReliefApplication = (chart.cutoutApplications || []).some((application) => application.type !== "flange-spacing");
    return (chart.kind === "bend" || chart.kind === "flange")
      && hasNegativeSpacing
      && !hasReliefApplication;
  });
  const clippedSmallRadiusOverlapUsesExplicitContactExtension = unbackedSmallRadiusOverlapCharts.length >= 1
    && unbackedSmallRadiusOverlapCharts.every((chart) => {
      const boundary = chartDomainBoundary2d(chart.chartDomain2d);
      const xs = boundary.map((point) => point[0]);
      const spacing = clippedSmallRadiusOverlapEval.cutouts.find((cutout) => (
        cutout.type === "flange-spacing"
          && cutout.chartId === chart.id
          && cutout.endpointOffset < -1e-7
      ));
      const extension = Math.max(0, -spacing.endpointOffset);
      return boundary.length >= 4
        && chart.chartDomain2d?.metadata?.strategy !== "endpoint-flange-overlap-step-domain"
        && chart.domainClip?.strategy === "endpoint-cutouts"
        && chart.domainClip?.domainOperation === "cutout-region-difference"
        && spacing.flangeContactOffset > 0
        && Number.isFinite(extension)
        && extension > 0
        && Math.min(...xs) >= -extension - 1e-6
        && Math.max(...xs) <= (chart.length || 0) + extension + 1e-6
        && boundary.every((point) => point.length === 2 && point.every(Number.isFinite));
    });
  if (
    !clippedBoundaryHasNoDuplicates
      || !clippedBoundaryHasReliefMetadata
      || !clippedBoundaryPreservesChartDomain
      || !clippedChartsExposeLocalCutoutApplications
      || !clippedBaseCutoutApplicationUsesAppliedRegion
      || !clippedChartsExposeDomainClipStrategy
      || !clippedSmallRadiusFlangesStayFiniteWithoutReliefEdges
      || !clippedSmallRadiusOverlapUsesExplicitContactExtension
  ) {
    console.error("FAILED: sheet-metal chart clipping should attach circular relief cut boundaries with stable chart-local metadata, explicit domain clip strategy, and keep small-radius flange domains finite while explicit contact/overlap extensions stay finite");
    return 1;
  }
  const chartGeometryFinite = (geometry) => [...(geometry.faces || [])].every((face) => {
    try {
      return face.points?.length >= 3
        && face.points.every((point) => point.length === 3 && point.every(Number.isFinite))
        && faceNormal(face.points).every(Number.isFinite)
        && face.points.slice(1, -1).some((point, index) => {
          const next = face.points[index + 2];
          const ab = [
            point[0] - face.points[0][0],
            point[1] - face.points[0][1],
            point[2] - face.points[0][2]
          ];
          const ac = [
            next[0] - face.points[0][0],
            next[1] - face.points[0][1],
            next[2] - face.points[0][2]
          ];
          return Math.hypot(
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0]
          ) > 1e-8;
        });
    } catch (error) {
      return false;
    }
  }) && [...(geometry.lines || [])].every((line) => (
    line.points?.length >= 2
      && line.points.every((point) => point.length === 3 && point.every(Number.isFinite))
      && line.points.slice(1).some((point) => (
        Math.hypot(
          point[0] - line.points[0][0],
          point[1] - line.points[0][1],
          point[2] - line.points[0][2]
        ) > 1e-8
      ))
  ));
  const reliefChartAngleDirectionVariants = [30, 60, 90, 135].flatMap((angle) => (
    ["up", "down"].map((direction) => ({ angle, direction }))
  ));
  const reliefChartAngleDirectionVariantsOk = reliefChartAngleDirectionVariants.every(({ angle, direction }) => {
    const plate = reliefChartPlate(20, 0);
    plate.fabrication.bends = plate.fabrication.bends.map((bend) => ({ ...bend, angle, direction }));
    const evaluation = buildReliefCutoutsForCharts(plate, settings.render?.curves || {});
    const site = evaluation.sites.find((candidate) => candidate.kind === "sketch-corner");
    const geometry = evaluateBentPlateChartGeometry(plate, settings.render?.curves || {});
    const equationErrors = evaluation.cutouts
      .filter((cutout) => cutout.siteKey === site?.key && cutout.type === "circular")
      .flatMap((cutout) => circularCutoutEquationError(cutout, evaluation.chartById.get(cutout.chartId), site));
    return chartReliefGeometrySupport(plate, settings.render?.curves || {}).supported
      && site
      && reliefChartSharedBoundaryConsistent(evaluation, site)
      && !geometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      && chartGeometryFinite(geometry)
      && equationErrors.length
      && equationErrors.every((error) => error <= 1e-6);
  });
  const skewedCornerReliefPlate = (label, cornerPoint, reliefType) => {
    const sketch = {
      type: "plate-sketch",
      vertices: [
        { id: `${label}_v1`, point: [0, 0] },
        { id: `${label}_v2`, point: [100, 0] },
        { id: `${label}_v3`, point: cornerPoint },
        { id: `${label}_v4`, point: [0, 80] }
      ],
      edges: [
        { id: `${label}_e1`, from: `${label}_v1`, to: `${label}_v2` },
        { id: `${label}_e2`, from: `${label}_v2`, to: `${label}_v3` },
        { id: `${label}_e3`, from: `${label}_v3`, to: `${label}_v4` },
        { id: `${label}_e4`, from: `${label}_v4`, to: `${label}_v1` }
      ],
      relations: []
    };
    return {
      ...reliefSitePlate([]),
      id: `${label}_plate`,
      type: "bent-plate",
      sketch,
      fabrication: {
        bends: [
          { id: `${label}_b1`, edgeId: `${label}_e1`, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
          { id: `${label}_b2`, edgeId: `${label}_e2`, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
        ],
        reliefDefaults: {
          type: reliefType,
          radius: 14,
          width: 12,
          depth: 18,
          gap: 1
        }
      }
    };
  };
  const reliefChartCornerAngleVariantsOk = [
    { label: "corner_60", point: [60, 70] },
    { label: "corner_90", point: [100, 80] },
    { label: "corner_120", point: [150, 86.6] }
  ].every(({ label, point }) => (
    ["circular", "rectangular", "obround"].every((reliefType) => {
      const plate = skewedCornerReliefPlate(`${label}_${reliefType.replace(/[^a-z0-9]+/gi, "_")}`, point, reliefType);
      const support = chartReliefGeometrySupport(plate, settings.render?.curves || {});
      const evaluation = buildReliefCutoutsForCharts(plate, settings.render?.curves || {});
      const clipped = buildClippedReliefChartDomains(plate, settings.render?.curves || {});
      const geometry = evaluateBentPlateChartGeometry(plate, settings.render?.curves || {});
      const site = evaluation.sites.find((candidate) => candidate.kind === "sketch-corner");
      const boundaryContractOk = reliefType === "obround"
        ? obroundEndpointCutsAreStraightAtOpenEndForSite(evaluation, site)
        : reliefChartSharedBoundaryConsistent(clipped, site);
      return support.supported
        && site
        && boundaryContractOk
        && baseReliefBoundaryPointsStayInCornerWedge(clipped, site)
        && !geometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
        && chartGeometryFinite(geometry);
    })
  ));
  const obtuseCircularEndpointRegionsUseEndpointCurves = (() => {
    const plate = skewedCornerReliefPlate("corner_120_circular_endpoint_regions", [150, 86.6], "circular");
    plate.fabrication.reliefDefaults.radius = 18;
    plate.fabrication.reliefDefaults.flangeGap = -8;
    plate.fabrication.reliefDefaults.flangeGapMode = "butt";
    const clipped = buildClippedReliefChartDomains(plate, settings.render?.curves || {});
    const geometry = evaluateBentPlateChartGeometry(plate, settings.render?.curves || {});
    const endpointApplications = clipped.charts
      .filter((chart) => chart.kind === "bend" || chart.kind === "flange")
      .flatMap((chart) => (chart.cutoutApplications || []).map((application) => ({ chart, application })))
      .filter(({ application }) => application.type === "circular");
    return endpointApplications.length === 4
      && endpointApplications.every(({ chart, application }) => {
        const regionBoundary = chartDomainBoundary2d(application.cutoutRegion2d);
        const height = chart.kind === "bend" ? chart.developedWidth : chart.flangeLength;
        const endpointExtension = Math.max(0, Number(application.cutoutRegion2d?.metadata?.endpointExtension) || 0);
        const minX = application.endpoint === "start" ? -endpointExtension : 0;
        const maxX = application.endpoint === "end" ? (chart.length || 0) + endpointExtension : (chart.length || 0);
        return regionBoundary.length >= 3
          && regionBoundary.length <= (application.points2d?.length || 0) + 2
          && regionBoundary.every((point) => (
            Array.isArray(point)
              && point.length === 2
              && point.every(Number.isFinite)
              && point[0] >= minX - 1e-6
              && point[0] <= maxX + 1e-6
              && point[1] >= -1e-6
              && point[1] <= height + 1e-6
          ));
      })
      && !clipped.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      && !geometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      && chartGeometryFinite(geometry);
  })();
  if (!obtuseCircularEndpointRegionsUseEndpointCurves) {
    console.error("FAILED: obtuse circular corner relief endpoint cutout regions should be built from chart-local endpoint curves, not projected full developed cutout regions");
    return 1;
  }
  const reliefChartSceneSupport = chartReliefGeometrySupport(reliefChartPlate(20, 0), settings.render?.curves || {});
  const reliefChartSceneGeometry = evaluateBentPlateChartGeometry(reliefChartPlate(20, 0), settings.render?.curves || {});
  const reliefChartSmallSceneGeometry = evaluateBentPlateChartGeometry(reliefChartPlate(4, 0), settings.render?.curves || {});
  const invalidReliefChartPlate = reliefChartPlate(-5, 0);
  const invalidReliefChartEval = buildReliefCutoutsForCharts(invalidReliefChartPlate, settings.render?.curves || {});
  const invalidReliefChartSupport = chartReliefGeometrySupport(invalidReliefChartPlate, settings.render?.curves || {});
  const invalidReliefChartSceneGeometry = evaluateBentPlateChartGeometry(invalidReliefChartPlate, settings.render?.curves || {});
  const chartSceneReliefSideFaces = reliefChartSceneGeometry.faces.filter((face) => (
    face.cornerReliefSiteKey === reliefClippedSite?.key
      && face.cornerReliefRole === "side"
      && face.cornerReliefBoundaryRole === "cut-boundary"
  ));
  const chartSceneHasBaseBendFlange = ["base", "bend", "flange"].every((kind) => (
    reliefChartSceneGeometry.faces.some((face) => face.sheetChartKind === kind)
  ));
  const chartSceneHasBendTessellation = reliefChartSceneGeometry.faces.filter((face) => (
    face.sheetChartKind === "bend" && (face.sheetChartFaceRole === "front" || face.sheetChartFaceRole === "back")
  )).length > 4;
  const chartSupportedSettings = {
    ...settings,
    geometry: {
      ...(settings.geometry || {}),
      sheetMetalReliefEvaluator: "charts-supported"
    }
  };
  const chartImplicitSupportedSettings = {
    ...settings,
    geometry: { ...(settings.geometry || {}) }
  };
  delete chartImplicitSupportedSettings.geometry.sheetMetalReliefEvaluator;
  const reliefChartScenePlate = reliefChartPlate(20, 0);
  const reliefChartSceneProjectForPlate = (plate) => ({
    schemaVersion: "0.1.0",
    units: { length: "mm" },
    settings: {},
    libraries: {},
    modelDefaults: {
      resolutionOrder: ["object"],
      collections: {}
    },
    objectIndex: {
      relief_site_plate: { collection: "plates", type: "bent-plate" }
    },
    model: {
      profiles: {},
      members: {},
      plates: { relief_site_plate: plate },
      sketches: {},
      features: {},
      trimJoints: {},
      fastenerGroups: {},
      welds: {},
      smartComponentInstances: {}
    }
  });
  const smallReliefChartSceneCases = [
    { type: "circular", spec: { radius: 0, gap: 0 } },
    { type: "circular", spec: { radius: 0.1, gap: 0 } },
    { type: "rectangular", spec: { width: 0, depth: 0, gap: 0 } },
    { type: "rectangular", spec: { width: 0.01, depth: 0.01, gap: 0 } },
    { type: "obround", spec: { width: 1, depth: 0.1, gap: 0 } }
  ];
  const zeroDimensionReliefCutoutsAreNoop = smallReliefChartSceneCases
    .filter(({ spec }) => Object.values(spec).some((value) => value === 0))
    .filter(({ type, spec }) => (
      type === "circular" && spec.radius === 0
    ) || (
      type === "rectangular" && spec.width === 0 && spec.depth === 0
    ))
    .every(({ type, spec }) => {
      const plate = {
        ...reliefChartScenePlate,
        fabrication: {
          ...reliefChartScenePlate.fabrication,
          reliefDefaults: { type, ...spec }
        }
      };
      const evaluation = buildClippedReliefChartDomains(plate, settings.render?.curves || {});
      const geometry = evaluateBentPlateChartGeometry(plate, settings.render?.curves || {});
      return evaluation.cutouts.every((cutout) => cutout.type === "flange-spacing")
        && evaluation.charts.every((chart) => !chart.boundaryEdges?.some((edge) => edge.source === "relief"))
        && !geometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
        && chartGeometryFinite(geometry);
    });
  const smallReliefChartScenesStayClean = smallReliefChartSceneCases.every(({ type, spec }) => {
    const plate = {
      ...reliefChartScenePlate,
      fabrication: {
        ...reliefChartScenePlate.fabrication,
        reliefDefaults: { type, ...spec }
      }
    };
    const support = chartReliefGeometrySupport(plate, settings.render?.curves || {});
    const geometry = evaluateBentPlateChartGeometry(plate, settings.render?.curves || {});
    return support.supported
      && !support.reason
      && geometry.faces.length
      && geometry.lines.length
      && !geometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      && chartGeometryFinite(geometry);
  });
  const reliefChartSceneProject = reliefChartSceneProjectForPlate(reliefChartScenePlate);
  const rectangularReliefChartPlate = {
    ...reliefChartScenePlate,
    fabrication: {
      ...reliefChartScenePlate.fabrication,
      reliefDefaults: { type: "rectangular", width: 16, depth: 22, gap: 3 }
    }
  };
  const rectangularReliefChartEval = buildReliefCutoutsForCharts(rectangularReliefChartPlate, settings.render?.curves || {});
  const rectangularReliefSite = rectangularReliefChartEval.sites.find((site) => site.kind === "sketch-corner");
  const rectangularDevelopedCutout = buildReliefCutout2d(
    rectangularReliefSite,
    rectangularReliefChartEval.specs.get(rectangularReliefSite?.key),
    settings.render?.curves || {}
  );
  const rectangularDevelopedCutoutHasAxisProfile = rectangularDevelopedCutout?.coordinateSystem === "developed-site"
    && rectangularDevelopedCutout?.type === "rectangular"
    && rectangularDevelopedCutout?.effectiveWidth === 25
    && rectangularDevelopedCutout?.effectiveDepth === 25
    && rectangularDevelopedCutout?.basePreviousDistance === 25
    && rectangularDevelopedCutout?.baseNextDistance === 25
    && rectangularDevelopedCutout.points2d.length === 3
    && rectangularDevelopedCutout.profile.edgeInsetAt(0, 0) === 25
    && Math.abs(rectangularDevelopedCutout.profile.axisLimit(0) - 34.56637061435917) <= 1e-6
    && rectangularDevelopedCutout.profile.edgeInsetAt(0, 1) === 25
    && Math.abs(rectangularDevelopedCutout.profile.axisLimit(1) - 34.56637061435917) <= 1e-6;
  const rectangularBaseCutout = rectangularReliefChartEval.cutouts.find((cutout) => cutout.chartId === "base" && cutout.siteKey === rectangularReliefSite?.key);
  const rectangularClippedEval = buildClippedReliefChartDomains(rectangularReliefChartPlate, settings.render?.curves || {});
  const rectangularClippedCharts = ["base", "bend:relief_site_b1", "bend:relief_site_b2", "flange:relief_site_b1", "flange:relief_site_b2"]
    .map((chartId) => rectangularClippedEval.chartById.get(chartId));
  const rectangularClippedBoundaryHasMetadata = rectangularClippedCharts.every((chart) => (
    chart?.clippedBoundary2d?.length >= 3
      && chart.boundaryEdges?.some((edge) => edge.source === "relief" && edge.reliefSiteKey === rectangularReliefSite?.key)
  ));
  const rectangularSharedBoundary = reliefChartSharedBoundaryConsistent(rectangularReliefChartEval, rectangularReliefSite);
  const rectangularChartSupport = chartReliefGeometrySupport(rectangularReliefChartPlate, settings.render?.curves || {});
  const rectangularChartSceneGeometry = evaluateBentPlateChartGeometry(rectangularReliefChartPlate, settings.render?.curves || {});
  const rectangularChartSceneReliefSideFaces = rectangularChartSceneGeometry.faces.filter((face) => (
    face.cornerReliefSiteKey === rectangularReliefSite?.key
      && face.cornerReliefRole === "side"
      && face.cornerReliefBoundaryRole === "cut-boundary"
  ));
  const chartSupportedRectScene = buildScene(
    reliefChartSceneProjectForPlate(rectangularReliefChartPlate),
    { profiles: {} },
    { fasteners: {} },
    chartSupportedSettings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const chartDefaultRectScene = buildScene(
    reliefChartSceneProjectForPlate(rectangularReliefChartPlate),
    { profiles: {} },
    { fasteners: {} },
    settings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const chartImplicitRectScene = buildScene(
    reliefChartSceneProjectForPlate(rectangularReliefChartPlate),
    { profiles: {} },
    { fasteners: {} },
    chartImplicitSupportedSettings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const noReliefSingleBendPlate = reliefSitePlate([
    { id: "relief_site_single_bend", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 }
  ]);
  const chartSupportedNoReliefScene = buildScene(
    reliefChartSceneProjectForPlate(noReliefSingleBendPlate),
    { profiles: {} },
    { fasteners: {} },
    chartSupportedSettings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const sceneObjectFacesUseOnlyCharts = (sourceScene, objectId) => (
    sourceScene.faces
      .filter((face) => face.objectId === objectId)
      .every((face) => face.sheetChartId)
  );
  const chartSupportedRectSceneUsesCharts = chartSupportedRectScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.sheetChartId && face.cornerReliefSiteKey
  )) && sceneObjectFacesUseOnlyCharts(chartSupportedRectScene, "relief_site_plate");
  const chartDefaultRectSceneUsesCharts = settings.geometry?.sheetMetalReliefEvaluator === "charts-supported"
    && chartDefaultRectScene.faces.some((face) => (
      face.objectId === "relief_site_plate" && face.sheetChartId && face.cornerReliefSiteKey
    ))
    && sceneObjectFacesUseOnlyCharts(chartDefaultRectScene, "relief_site_plate");
  const chartImplicitRectSceneUsesCharts = chartImplicitRectScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.sheetChartId && face.cornerReliefSiteKey
  )) && sceneObjectFacesUseOnlyCharts(chartImplicitRectScene, "relief_site_plate");
  const chartSupportedNoReliefSceneUsesCharts = chartSupportedNoReliefScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.sheetChartId && face.sheetChartKind === "bend"
  )) && !chartSupportedNoReliefScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.cornerReliefSiteKey
  )) && sceneObjectFacesUseOnlyCharts(chartSupportedNoReliefScene, "relief_site_plate");
  const obroundReliefChartPlate = {
    ...reliefChartScenePlate,
    fabrication: {
      ...reliefChartScenePlate.fabrication,
      reliefDefaults: { type: "obround", width: 16, depth: 24, gap: 2 }
    }
  };
  const obroundReliefChartEval = buildReliefCutoutsForCharts(obroundReliefChartPlate, settings.render?.curves || {});
  const obroundReliefSite = obroundReliefChartEval.sites.find((site) => site.kind === "sketch-corner");
  const obroundDevelopedCutout = buildReliefCutout2d(
    obroundReliefSite,
    obroundReliefChartEval.specs.get(obroundReliefSite?.key),
    settings.render?.curves || {}
  );
  const obroundDevelopedCutoutHasProfile = obroundDevelopedCutout?.coordinateSystem === "developed-site"
    && obroundDevelopedCutout?.type === "obround"
    && obroundDevelopedCutout?.effectiveWidth === 26
    && obroundDevelopedCutout?.effectiveDepth === 26
    && obroundDevelopedCutout?.effectiveRadius === 2
    && obroundDevelopedCutout.points2d.length >= 8
    && obroundDevelopedCutout.profile.edgeInsetAt(0) === 26
    && obroundDevelopedCutout.profile.edgeInsetAt(4) === 26
    && obroundDevelopedCutout.profile.endpointEdgeInsetAt(0) === 26
    && obroundDevelopedCutout.profile.endpointEdgeInsetAt(4) === 26
    && Math.abs(obroundDevelopedCutout.profile.axisLimit(0) - 36.56637061435917) <= 1e-6
    && obroundDevelopedCutout.profile.edgeInsetAt(26) === 26
    && obroundDevelopedCutout.profile.endpointEdgeInsetAt(26) === 26
    && obroundDevelopedCutout.profile.edgeInsetAt(0, 1) === 26
    && obroundDevelopedCutout.profile.edgeInsetAt(4, 1) === 26
    && obroundDevelopedCutout.profile.edgeInsetAt(18, 1) === 26
    && obroundDevelopedCutout.profile.edgeInsetAt(27) === 26;
  const obroundClippedEval = buildClippedReliefChartDomains(obroundReliefChartPlate, settings.render?.curves || {});
  const obroundClippedCharts = ["base", "bend:relief_site_b1", "bend:relief_site_b2", "flange:relief_site_b1", "flange:relief_site_b2"]
    .map((chartId) => obroundClippedEval.chartById.get(chartId));
  const obroundClippedBoundaryHasMetadata = obroundClippedCharts.every((chart) => (
    chart?.clippedBoundary2d?.length >= 3
      && chart.boundaryEdges?.some((edge) => edge.source === "relief" && edge.reliefSiteKey === obroundReliefSite?.key)
  ));
  const obroundEndpointCutsAreStraightAtOpenEnd = obroundEndpointCutsAreStraightAtOpenEndForSite(obroundReliefChartEval, obroundReliefSite);
  const obroundExplicitZeroFlangeGapCreatesSpacing = obroundReliefChartEval.cutouts
    .filter((cutout) => cutout.siteKey === obroundReliefSite?.key && cutout.type === "flange-spacing")
    .every((cutout) => Math.abs(cutout.endpointOffset + cutout.flangeContactOffset) <= 1e-6)
    && obroundReliefChartEval.cutouts
      .filter((cutout) => cutout.siteKey === obroundReliefSite?.key && cutout.type === "flange-spacing").length === 2;
  const obroundChartSupport = chartReliefGeometrySupport(obroundReliefChartPlate, settings.render?.curves || {});
  const obroundChartSceneGeometry = evaluateBentPlateChartGeometry(obroundReliefChartPlate, settings.render?.curves || {});
  const obroundChartSceneReliefSideFaces = obroundChartSceneGeometry.faces.filter((face) => (
    face.cornerReliefSiteKey === obroundReliefSite?.key
      && face.cornerReliefRole === "side"
      && face.cornerReliefBoundaryRole === "cut-boundary"
  ));
  const chartSupportedObroundScene = buildScene(
    reliefChartSceneProjectForPlate(obroundReliefChartPlate),
    { profiles: {} },
    { fasteners: {} },
    chartSupportedSettings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const chartSupportedObroundSceneUsesCharts = chartSupportedObroundScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.sheetChartId && face.cornerReliefSiteKey
  ));
  const oversizedReliefPlate = (type) => ({
    ...reliefChartScenePlate,
    fabrication: {
      ...reliefChartScenePlate.fabrication,
      reliefDefaults: {
        type,
        ...(type === "rectangular" ? { width: 160, depth: 140 } : {}),
        ...(type === "obround" ? { width: 160, depth: 140 } : {})
      }
    }
  });
  const oversizedNonCircularReliefsStayInBaseCornerWedge = ["rectangular", "obround"].every((type) => {
    const evaluation = buildClippedReliefChartDomains(oversizedReliefPlate(type), settings.render?.curves || {});
    const site = evaluation.sites.find((candidate) => candidate.kind === "sketch-corner");
    const endpointClampWarnings = evaluation.diagnostics.filter((diagnostic) => (
      diagnostic.code === "corner-relief.cutout.clamped-by-edge"
        && (diagnostic.edgeRole || "").includes(":")
    ));
    const baseClampWarnings = evaluation.diagnostics.filter((diagnostic) => (
      diagnostic.code === "corner-relief.cutout.clamped-by-edge"
        && diagnostic.chartId === "base"
    ));
    return baseReliefBoundaryPointsStayInCornerWedge(evaluation, site)
      && endpointCutoutPointsStayWithinChartLength(evaluation, site)
      && !baseClampWarnings.length
      && endpointClampWarnings.every((diagnostic) => (
        (diagnostic.chartKind === "bend" || diagnostic.chartKind === "flange")
          && diagnostic.chartId
      ));
  });
  const bendOnBendReliefChartPlate = {
    ...reliefSitePlate([
      { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b1_start_side", parentBendId: "relief_site_b1", parentEdge: "start", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
    ]),
    fabrication: {
      bends: [
        { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b1_start_side", parentBendId: "relief_site_b1", parentEdge: "start", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
      ],
      reliefDefaults: { type: "circular", radius: 20, gap: 0 }
    }
  };
  const bendOnBendChartSupport = chartReliefGeometrySupport(bendOnBendReliefChartPlate, settings.render?.curves || {});
  const bendOnBendChartSceneGeometry = evaluateBentPlateChartGeometry(bendOnBendReliefChartPlate, settings.render?.curves || {});
  const chartSupportedBendOnBendScene = buildScene(
    reliefChartSceneProjectForPlate(bendOnBendReliefChartPlate),
    { profiles: {} },
    { fasteners: {} },
    chartSupportedSettings,
    { renderObjectIds: ["relief_site_plate"] }
  );
  const chartSupportedBendOnBendSceneUsesCharts = chartSupportedBendOnBendScene.faces.some((face) => (
    face.objectId === "relief_site_plate" && face.sheetChartId && face.cornerReliefSiteKey
  ));
  const bendOnBendSupportHasRuntimeCharts = bendOnBendChartSupport.evaluation?.chartById?.has("bend:relief_site_b1_start_side")
    && bendOnBendChartSupport.evaluation?.chartById?.has("flange:relief_site_b1_start_side")
    && bendOnBendChartSupport.bendOnBend === true
    && !String(bendOnBendChartSupport.reason || "").includes("charts are not implemented");
  const bendOnBendEndpointConflictDiagnostic = bendOnBendChartSupport.evaluation?.diagnostics?.some((diagnostic) => (
    diagnostic.code === "corner-relief.endpoint-cutout.conflict"
      && diagnostic.severity === "error"
      && diagnostic.chartId === "bend:relief_site_b1"
      && Array.isArray(diagnostic.siteKeys)
      && diagnostic.siteKeys.length >= 2
  ));
  const conflictingBendOnBendReliefChartPlate = {
    ...reliefSitePlate([
      { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
      { id: "relief_site_b1_end_side", parentBendId: "relief_site_b1", parentEdge: "end", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
    ]),
    fabrication: {
      bends: [
        { id: "relief_site_b1", edgeId: reliefSiteEdges[0].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b2", edgeId: reliefSiteEdges[1].id, direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "relief_site_b1_end_side", parentBendId: "relief_site_b1", parentEdge: "end", direction: "up", angle: 90, radius: 8, flangeLength: 12 }
      ],
      reliefDefaults: { type: "circular", radius: 20, gap: 0 }
    }
  };
  const conflictingBendOnBendChartSupport = chartReliefGeometrySupport(conflictingBendOnBendReliefChartPlate, settings.render?.curves || {});
  let conflictingBendOnBendSupportedSceneBlocked = false;
  try {
    buildScene(
      reliefChartSceneProjectForPlate(conflictingBendOnBendReliefChartPlate),
      { profiles: {} },
      { fasteners: {} },
      chartSupportedSettings,
      { renderObjectIds: ["relief_site_plate"] }
    );
  } catch (error) {
    conflictingBendOnBendSupportedSceneBlocked = String(error?.message || error).includes("multiple corner relief cutouts");
  }
  let conflictingBendOnBendPreviewSceneDoesNotThrow = false;
  let conflictingBendOnBendPreviewUsesLegacy = false;
  try {
    const previewScene = buildScene(
      reliefChartSceneProjectForPlate(conflictingBendOnBendReliefChartPlate),
      { profiles: {} },
      { fasteners: {} },
      chartSupportedSettings,
      {
        renderObjectIds: [],
        previewPlates: [conflictingBendOnBendReliefChartPlate]
      }
    );
    conflictingBendOnBendPreviewSceneDoesNotThrow = true;
    conflictingBendOnBendPreviewUsesLegacy = previewScene.faces.some((face) => (
      face.objectId === "relief_site_plate" && !face.sheetChartId
    ));
  } catch (error) {
    conflictingBendOnBendPreviewSceneDoesNotThrow = false;
  }
  const selfIntersectingReliefSketch = {
    type: "plate-sketch",
    vertices: [
      { id: "self_relief_v1", point: [0, 0] },
      { id: "self_relief_v2", point: [100, 0] },
      { id: "self_relief_v3", point: [0, 100] },
      { id: "self_relief_v4", point: [100, 100] },
      { id: "self_relief_v5", point: [50, 150] }
    ],
    edges: [
      { id: "self_relief_e1", from: "self_relief_v1", to: "self_relief_v2" },
      { id: "self_relief_e2", from: "self_relief_v2", to: "self_relief_v3" },
      { id: "self_relief_e3", from: "self_relief_v3", to: "self_relief_v4" },
      { id: "self_relief_e4", from: "self_relief_v4", to: "self_relief_v5" },
      { id: "self_relief_e5", from: "self_relief_v5", to: "self_relief_v1" }
    ],
    relations: []
  };
  const selfIntersectingReliefPlate = {
    id: "self_intersecting_relief_plate",
    type: "bent-plate",
    thickness: 8,
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    sketch: selfIntersectingReliefSketch,
    fabrication: {
      bends: [
        { id: "self_relief_b1", edgeId: "self_relief_e1", direction: "up", angle: 90, radius: 8, flangeLength: 20 },
        { id: "self_relief_b2", edgeId: "self_relief_e2", direction: "up", angle: 90, radius: 8, flangeLength: 20 }
      ],
      reliefDefaults: { type: "circular", radius: 12, gap: 0 }
    }
  };
  const selfIntersectingChartSupport = chartReliefGeometrySupport(selfIntersectingReliefPlate, settings.render?.curves || {});
  const selfIntersectingChartSceneGeometry = evaluateBentPlateChartGeometry(selfIntersectingReliefPlate, settings.render?.curves || {});
  const selfIntersectingNoReliefPlate = {
    ...selfIntersectingReliefPlate,
    id: "relief_site_plate",
    fabrication: {
      bends: [
        { id: "self_relief_b1", edgeId: "self_relief_e1", direction: "up", angle: 90, radius: 8, flangeLength: 20 }
      ]
    }
  };
  let selfIntersectingNoReliefSupportedSceneBlocked = false;
  try {
    buildScene(
      reliefChartSceneProjectForPlate(selfIntersectingNoReliefPlate),
      { profiles: {} },
      { fasteners: {} },
      chartSupportedSettings,
      { renderObjectIds: ["relief_site_plate"] }
    );
  } catch (error) {
    selfIntersectingNoReliefSupportedSceneBlocked = String(error?.message || error).includes("self-intersects");
  }
  let invalidReliefChartSupportedSceneBlocked = false;
  try {
    buildScene(
      reliefChartSceneProjectForPlate(invalidReliefChartPlate),
      { profiles: {} },
      { fasteners: {} },
      chartSupportedSettings,
      { renderObjectIds: ["relief_site_plate"] }
    );
  } catch (error) {
    invalidReliefChartSupportedSceneBlocked = String(error?.message || error).includes("Corner relief radius must be zero or positive");
  }
  let invalidReliefChartImplicitSceneBlocked = false;
  try {
    buildScene(
      reliefChartSceneProjectForPlate(invalidReliefChartPlate),
      { profiles: {} },
      { fasteners: {} },
      chartImplicitSupportedSettings,
      { renderObjectIds: ["relief_site_plate"] }
    );
  } catch (error) {
    invalidReliefChartImplicitSceneBlocked = String(error?.message || error).includes("Corner relief radius must be zero or positive");
  }
  const chartSupportMatchesSceneDiagnostics = [
    [reliefChartSceneSupport, reliefChartSceneGeometry],
    [rectangularChartSupport, rectangularChartSceneGeometry],
    [obroundChartSupport, obroundChartSceneGeometry],
    [bendOnBendChartSupport, bendOnBendChartSceneGeometry],
    [conflictingBendOnBendChartSupport, evaluateBentPlateChartGeometry(conflictingBendOnBendReliefChartPlate, settings.render?.curves || {})],
    [selfIntersectingChartSupport, selfIntersectingChartSceneGeometry],
    [invalidReliefChartSupport, invalidReliefChartSceneGeometry]
  ].every(([support, geometry]) => (
    Boolean(support?.supported) === !(geometry?.diagnostics || []).some((diagnostic) => diagnostic.severity === "error")
  ));
  if (
    !reliefChartSceneSupport.supported
      || reliefChartSceneGeometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      || !reliefChartSceneGeometry.faces.length
      || !reliefChartSceneGeometry.lines.length
      || !chartGeometryFinite(reliefChartSceneGeometry)
      || !chartGeometryFinite(reliefChartSmallSceneGeometry)
      || !reliefChartAngleDirectionVariantsOk
      || !reliefChartCornerAngleVariantsOk
      || !chartSceneReliefSideFaces.length
      || !chartSceneHasBaseBendFlange
      || !chartSceneHasBendTessellation
      || !smallReliefChartScenesStayClean
      || !zeroDimensionReliefCutoutsAreNoop
      || !rectangularDevelopedCutoutHasAxisProfile
      || rectangularBaseCutout?.effectiveWidth !== 25
      || rectangularBaseCutout?.effectiveDepth !== 25
      || !rectangularClippedBoundaryHasMetadata
      || !rectangularSharedBoundary
      || !rectangularChartSupport.supported
      || rectangularChartSceneGeometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      || !chartGeometryFinite(rectangularChartSceneGeometry)
      || !rectangularChartSceneReliefSideFaces.length
      || !chartSupportedRectSceneUsesCharts
      || !chartDefaultRectSceneUsesCharts
      || !chartImplicitRectSceneUsesCharts
      || !chartSupportedNoReliefSceneUsesCharts
      || !obroundDevelopedCutoutHasProfile
      || !obroundClippedBoundaryHasMetadata
      || !obroundEndpointCutsAreStraightAtOpenEnd
      || !obroundExplicitZeroFlangeGapCreatesSpacing
      || !obroundChartSupport.supported
      || obroundChartSceneGeometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      || !chartGeometryFinite(obroundChartSceneGeometry)
      || !obroundChartSceneReliefSideFaces.length
      || !chartSupportedObroundSceneUsesCharts
      || !oversizedNonCircularReliefsStayInBaseCornerWedge
      || !bendOnBendChartSupport.supported
      || bendOnBendChartSupport.reason
      || !bendOnBendSupportHasRuntimeCharts
      || bendOnBendEndpointConflictDiagnostic
      || bendOnBendChartSceneGeometry.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      || !chartGeometryFinite(bendOnBendChartSceneGeometry)
      || !chartSupportedBendOnBendSceneUsesCharts
      || conflictingBendOnBendChartSupport.supported
      || !conflictingBendOnBendChartSupport.evaluation?.diagnostics?.some((diagnostic) => diagnostic.code === "corner-relief.endpoint-cutout.conflict" && diagnostic.severity === "error")
      || !conflictingBendOnBendSupportedSceneBlocked
      || !conflictingBendOnBendPreviewSceneDoesNotThrow
      || conflictingBendOnBendPreviewUsesLegacy
      || selfIntersectingChartSupport.supported
      || !String(selfIntersectingChartSupport.reason || "").includes("self-intersects")
      || !selfIntersectingNoReliefSupportedSceneBlocked
      || !chartSupportMatchesSceneDiagnostics
      || invalidReliefChartEval.cutouts.length !== 0
      || !invalidReliefChartEval.diagnostics.some((diagnostic) => diagnostic.code === "corner-relief.radius.invalid" && diagnostic.severity === "error")
      || invalidReliefChartSupport.supported
      || !String(invalidReliefChartSupport.reason || "").includes("radius")
      || !invalidReliefChartSceneGeometry.diagnostics.some((diagnostic) => diagnostic.severity === "error" && String(diagnostic.message || "").includes("radius"))
      || !invalidReliefChartSupportedSceneBlocked
      || !invalidReliefChartImplicitSceneBlocked
  ) {
    console.error("FAILED: chart-based sheet-metal relief scene geometry should be finite, metadata-rich, support ordinary bent plates plus circular/rectangular/obround reliefs plus simple bend-on-bend reliefs, and keep self-intersecting, invalid-spec, or conflicting bend-on-bend charts explicit without falling back to legacy for invalid active reliefs");
    return 1;
  }
  const roundedDemoBentPlate = roundedSketchProject.model?.plates?.rounded_demo_bent_plate;
  const roundedDemoSideBends = (roundedDemoBentPlate?.fabrication?.bends || []).filter((bend) => bend.parentBendId);
  const roundedDemoSideBendEdges = new Set(roundedDemoSideBends.map((bend) => `${bend.parentBendId}:${bend.parentEdge}`));
  const roundedDemoGeneratedCornerReliefs = plateCornerReliefs(roundedDemoBentPlate).filter((corner) => corner.scope === "bend");
  const roundedDemoGeneratedCornerEndpoints = new Set(roundedDemoGeneratedCornerReliefs.map((corner) => `${corner.outgoingBendId}:${corner.targetEndpoint}`));
  const roundedDemoGeneratedCornerSiteKeys = new Set(roundedDemoGeneratedCornerReliefs.map((corner) => corner.siteKey));
  const roundedDemoBendGeometry = plateBendGeometry(roundedDemoBentPlate, settings.render?.curves || {});
  const roundedDemoSourcePanels = roundedDemoBendGeometry.panels.filter((panel) => (
    panel.bend?.id === "rounded_demo_bend_1" || panel.bend?.id === "rounded_demo_bend_2"
  ));
  const roundedDemoSourcePanelsUsePlainLegacyGeometry = roundedDemoSourcePanels.every((panel) => (
    panel.points?.length === 4
      && !(panel.smoothVertexIndices?.length)
      && !(panel.cornerReliefs?.length)
  ));
  const roundedDemoSidePanels = roundedDemoBendGeometry.panels.filter((panel) => panel.bend?.parentBendId);
  if (
    roundedDemoSideBends.length !== 2
      || !roundedDemoSideBendEdges.has("rounded_demo_bend_1:start")
      || !roundedDemoSideBendEdges.has("rounded_demo_bend_2:end")
      || roundedDemoGeneratedCornerReliefs.length !== 2
      || !roundedDemoGeneratedCornerEndpoints.has("rounded_demo_bend_1_start_side:start")
      || !roundedDemoGeneratedCornerEndpoints.has("rounded_demo_bend_2_end_side:start")
      || !roundedDemoGeneratedCornerSiteKeys.has("bend:rounded_demo_bend_1:start:rounded_demo_bend_1_start_side:start")
      || !roundedDemoGeneratedCornerSiteKeys.has("bend:rounded_demo_bend_2:end:rounded_demo_bend_2_end_side:start")
      || roundedDemoGeneratedCornerReliefs.some((corner) => (
        corner.target?.kind !== "bendEndpoint"
          || corner.target?.endpoint !== "start"
          || corner.target?.parentEndpoint !== (corner.parentEdge === "end" ? "end" : "start")
      ))
      || roundedDemoSourcePanels.length !== 2
      || !roundedDemoSourcePanelsUsePlainLegacyGeometry
      || roundedDemoSidePanels.length !== 2
      || roundedDemoSidePanels.some((panel) => panel.points?.length !== 4 || panel.smoothVertexIndices?.length || panel.cornerReliefs?.length)
  ) {
    console.error("FAILED: sample_rounded_sketch should include side child bend examples with stable generated corner relief metadata without relying on legacy panel relief geometry");
    return 1;
  }
  const cornerReliefDemoPath = path.join(ROOT, "bobercad", "data", "projects", "sample_sheet_metal_corner_reliefs.json");
  const cornerReliefDemoProject = readJson(cornerReliefDemoPath);
  const cornerReliefDemoProfiles = readJson(path.resolve(path.dirname(cornerReliefDemoPath), cornerReliefDemoProject.libraries.profiles.path));
  const cornerReliefDemoFasteners = readJson(path.resolve(path.dirname(cornerReliefDemoPath), cornerReliefDemoProject.libraries.fasteners.path));
  const cornerReliefDemoExpectedTypes = new Map([
    ["corner_relief_rectangular", "rectangular"],
    ["corner_relief_circular", "circular"],
    ["corner_relief_obround", "obround"]
  ]);
  const cornerReliefDistance3 = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[1] || 0) - (b?.[1] || 0), (a?.[2] || 0) - (b?.[2] || 0));
  const cornerReliefMaxStripProjection = (geometry) => Math.max(0, ...(geometry?.bendSurfaceStrips || []).flatMap((strip) => (
    (strip.samples || []).flatMap((sample) => [
      cornerReliefDistance3(sample.start, sample.unadjustedStart),
      cornerReliefDistance3(sample.end, sample.unadjustedEnd)
    ])
  )));
  const cornerReliefDemoSummaries = [...cornerReliefDemoExpectedTypes].map(([plateId, reliefType]) => {
    const plate = cornerReliefDemoProject.model?.plates?.[plateId];
    const geometry = plate ? plateBendGeometry(plate, settings.render?.curves || {}) : null;
    const reliefs = plate ? plateCornerReliefs(plate) : [];
    const panelSketchReliefs = (geometry?.panels || []).flatMap((panel) => (
      (panel.cornerReliefs || []).filter((corner) => corner.scope !== "bend")
    ));
    const hasBendSurfaceEndpointProjection = cornerReliefMaxStripProjection(geometry) > 1e-6;
    return {
      plateId,
      reliefType,
      plate,
      geometry,
      reliefs,
      defaultType: plate?.fabrication?.reliefDefaults?.type || "",
      basePoints: geometry?.basePoints?.length || 0,
      smoothPoints: geometry?.baseSmoothVertexIndices?.length || 0,
      panelSketchReliefs,
      panelSmoothPoints: (geometry?.panels || []).reduce((sum, panel) => sum + (panel.smoothVertexIndices?.length || 0), 0),
      hasBendSurfaceEndpointProjection
    };
  });
  const cornerReliefRectangular = cornerReliefDemoSummaries.find((summary) => summary.reliefType === "rectangular");
  const cornerReliefCircular = cornerReliefDemoSummaries.find((summary) => summary.reliefType === "circular");
  const cornerReliefObround = cornerReliefDemoSummaries.find((summary) => summary.reliefType === "obround");
  const cornerReliefCircularPlate = (gap, bendRadius) => {
    const plate = JSON.parse(JSON.stringify(cornerReliefDemoProject.model.plates.corner_relief_circular));
    plate.fabrication.reliefDefaults.gap = gap;
    plate.fabrication.reliefDefaults.radius = 18;
    plate.fabrication.bends = (plate.fabrication.bends || []).map((bend) => ({ ...bend, radius: bendRadius }));
    return plate;
  };
  const cornerReliefCircularZeroGapPlate = cornerReliefCircularPlate(0, 10);
  const cornerReliefCircularZeroGapGeometry = plateBendGeometry(cornerReliefCircularZeroGapPlate, settings.render?.curves || {});
  const cornerReliefCircularZeroGapBendRadiusPlates = [4, 10, 24].map((bendRadius) => (
    cornerReliefCircularPlate(0, bendRadius)
  ));
  const cornerReliefCircularZeroGapBendRadiusGeometries = cornerReliefCircularZeroGapBendRadiusPlates.map((plate) => (
    plateBendGeometry(plate, settings.render?.curves || {})
  ));
  const cornerReliefCircularDefaultGapBendRadiusPlates = [4, 10, 24].map((bendRadius) => (
    cornerReliefCircularPlate(6, bendRadius)
  ));
  const cornerReliefCircularDefaultGapBendRadiusGeometries = cornerReliefCircularDefaultGapBendRadiusPlates.map((plate) => (
    plateBendGeometry(plate, settings.render?.curves || {})
  ));
  const cornerReliefCircularLargeGapBendRadiusPlates = [4, 10, 24].map((bendRadius) => (
    cornerReliefCircularPlate(18, bendRadius)
  ));
  const cornerReliefCircularLargeGapBendRadiusGeometries = cornerReliefCircularLargeGapBendRadiusPlates.map((plate) => (
    plateBendGeometry(plate, settings.render?.curves || {})
  ));
  const cornerReliefCircularUndersizedRadiusPlates = [8, 10, 12, 14, 16].map((radius) => {
    const plate = cornerReliefCircularPlate(6, 10);
    plate.fabrication.reliefDefaults.radius = radius;
    return plate;
  });
  const cornerReliefCircularUndersizedRadiusGeometries = cornerReliefCircularUndersizedRadiusPlates.map((plate) => (
    plateBendGeometry(plate, settings.render?.curves || {})
  ));
  const cornerReliefPanelPoints = (geometry) => (geometry?.panels || []).flatMap((panel) => panel.points || []);
  const cornerReliefSamePointList = (a, b) => {
    if (a.length !== b.length) return false;
    return a.every((point, index) => cornerReliefDistance3(point, b[index]) <= 1e-6);
  };
  const cornerReliefCircularClearanceDoesNotMoveLegacyPanelBoundary = cornerReliefCircularZeroGapBendRadiusGeometries.every((geometry, index) => (
    cornerReliefSamePointList(cornerReliefPanelPoints(geometry), cornerReliefPanelPoints(cornerReliefCircularDefaultGapBendRadiusGeometries[index]))
      && cornerReliefSamePointList(cornerReliefPanelPoints(geometry), cornerReliefPanelPoints(cornerReliefCircularLargeGapBendRadiusGeometries[index]))
  ));
  const cornerReliefCircularUndersizedRadiusDoesNotCreateBrokenPanelReliefs = cornerReliefCircularUndersizedRadiusGeometries.every((geometry, plateIndex) => {
    const plate = cornerReliefCircularUndersizedRadiusPlates[plateIndex];
    const bendRadius = Math.max(0, ...(plate.fabrication?.bends || []).map((bend) => bend.radius || 0));
    return (geometry?.panels || [])
      .filter((panel) => panel.bend?.id?.includes("corner_relief_circular_bend"))
      .every((panel) => (
        panel.points?.every((point) => point[2] >= bendRadius - 1e-6)
          && (panel.cornerReliefs || []).every((corner) => (
            corner.panelPointCount !== 1
              && (corner.sideFaceIndices || []).length > 0
          ))
      ));
  });
  const legacyReliefSettings = {
    ...settings,
    geometry: {
      ...(settings.geometry || {}),
      sheetMetalReliefEvaluator: "legacy"
    }
  };
  const cornerReliefDemoScene = buildScene(cornerReliefDemoProject, cornerReliefDemoProfiles, cornerReliefDemoFasteners, settings);
  let cornerReliefLegacyDemoSceneBlocked = false;
  try {
    buildScene(cornerReliefDemoProject, cornerReliefDemoProfiles, cornerReliefDemoFasteners, legacyReliefSettings);
  } catch (error) {
    cornerReliefLegacyDemoSceneBlocked = String(error?.message || error).includes("legacy sheet-metal relief evaluator is disabled for active corner reliefs");
  }
  const cornerReliefDefaultSceneUsesChartsForSupportedTypes = ["corner_relief_rectangular", "corner_relief_circular", "corner_relief_obround"].every((plateId) => (
    cornerReliefDemoScene.faces.some((face) => face.objectId === plateId && face.sheetChartId && face.cornerReliefSiteKey)
  ));
  const cornerReliefCircularTinyRadiusScenes = [2, 4, 6, 8].map((radius) => {
    const plate = cornerReliefCircularPlate(6, 10);
    plate.fabrication.reliefDefaults.radius = radius;
    return buildScene(cornerReliefDemoProject, cornerReliefDemoProfiles, cornerReliefDemoFasteners, settings, {
      renderObjectIds: [],
      previewPlates: [plate]
    });
  });
  const cornerReliefCircularActiveRadiusScenes = [16, 18, 20].map((radius) => {
    const plate = cornerReliefCircularPlate(6, 10);
    plate.fabrication.reliefDefaults.radius = radius;
    return buildScene(cornerReliefDemoProject, cornerReliefDemoProfiles, cornerReliefDemoFasteners, settings, {
      renderObjectIds: [],
      previewPlates: [plate]
    });
  });
  const chartSceneUsesOnlyChartFacesForObject = (sourceScene, objectId) => (
    sourceScene.faces.filter((face) => face.objectId === objectId).every((face) => face.sheetChartId)
  );
  const cornerReliefCircularTinyRadiusClipsBendLocally = [
    ...cornerReliefCircularTinyRadiusScenes,
    ...cornerReliefCircularActiveRadiusScenes
  ].every((scene) => (
    scene.faces.some((face) => face.objectId === "corner_relief_circular" && face.sheetChartId && face.cornerReliefSiteKey)
      && chartSceneUsesOnlyChartFacesForObject(scene, "corner_relief_circular")
      && !scene.faces.some((face) => face.objectId === "corner_relief_circular" && face.bendSurfaceStripFaceRole)
  ));
  const cornerReliefCircularSceneUsesLocalEndpointCutWalls = cornerReliefDemoScene.faces.some((face) => (
    face.objectId === "corner_relief_circular"
      && face.sheetChartId
      && face.cornerReliefSiteKey
      && face.cornerReliefRole === "side"
      && face.cornerReliefBoundaryRole === "cut-boundary"
  )) && chartSceneUsesOnlyChartFacesForObject(cornerReliefDemoScene, "corner_relief_circular");
  const cornerReliefCircularSections = inspectorEditableObjectPropertySections({
    collection: "plates",
    object: cornerReliefDemoProject.model.plates.corner_relief_circular,
    objectId: "corner_relief_circular",
    objectState: {
      definition: { label: "Corner relief demo" },
      bends: cornerReliefDemoProject.model.plates.corner_relief_circular.fabrication.bends,
      cornerReliefs: plateCornerReliefs(cornerReliefDemoProject.model.plates.corner_relief_circular),
      resolvedReliefDefaults: resolvePlateCornerReliefSpec(
        cornerReliefDemoProject.model.plates.corner_relief_circular.fabrication.reliefDefaults,
        cornerReliefDemoProject.model.plates.corner_relief_circular,
        { source: "default" }
      )
    },
    objectDetail: {
      cornerReliefVertexId: "corner_relief_circular_v2"
    }
  });
  const cornerReliefCircularDefaultSection = cornerReliefCircularSections.find((section) => section.id === "inspector.properties.object.plate.cornerRelief");
  const cornerReliefCircularSelectedSection = cornerReliefCircularSections.find((section) => section.id === "inspector.properties.object.plate.cornerRelief.corner_relief_circular_v2");
  const cornerReliefCircularBendSections = cornerReliefCircularSections.filter((section) => section.id?.startsWith("inspector.properties.object.plate.bend."));
  if (
    settings.project?.demos?.["sheet-metal-corner-reliefs-1"]?.path !== "../../../data/projects/sample_sheet_metal_corner_reliefs.json"
      || cornerReliefDemoSummaries.some((summary) => (
        !summary.plate
          || cornerReliefDemoProject.objectIndex?.[summary.plateId]?.collection !== "plates"
          || cornerReliefDemoProject.objectIndex?.[summary.plateId]?.type !== "bent-plate"
          || summary.defaultType !== summary.reliefType
          || summary.reliefs.length !== 1
          || summary.reliefs[0]?.relief?.type !== summary.reliefType
          || summary.geometry?.panels?.length !== 2
          || !cornerReliefDemoScene.faces.some((face) => face.objectId === summary.plateId)
      ))
      || cornerReliefCircular?.reliefs?.[0]?.relief?.gap !== undefined
      || cornerReliefCircular?.reliefs?.[0]?.relief?.flangeGap !== -8
      || cornerReliefCircular?.reliefs?.[0]?.relief?.flangeGapMode !== "butt"
      || cornerReliefCircular?.reliefs?.[0]?.relief?.flangeGapSwapped !== false
      || cornerReliefCircularDefaultSection
      || !cornerReliefCircularSelectedSection?.fields?.some((field) => field.label === "Type" && field.type === "select" && field.value === "circular" && field.commit?.childKey === "type")
      || !cornerReliefCircularSelectedSection?.fields?.some((field) => field.label === "Size" && field.type === "number" && field.value === 2.25 && field.commit?.childKey === "size")
      || !cornerReliefCircularSelectedSection?.fields?.some((field) => field.label === "Flange gap" && field.type === "number" && field.value === -8 && field.commit?.childKey === "flangeGap")
      || !cornerReliefCircularSelectedSection?.fields?.some((field) => field.label === "Flange offset" && field.type === "select" && field.value === "butt" && field.commit?.childKey === "flangeGapMode")
      || !cornerReliefCircularSelectedSection?.fields?.some((field) => field.label === "Swap" && field.type === "action" && field.icon === "swap" && field.action === "object.plate.patch")
      || cornerReliefCircularSelectedSection?.fields?.some((field) => ["Radius", "Width", "Depth", "Kerf", "Clearance", "Flange gap / overlap", "Vertex", "Bends", "Source", "Select Corner"].includes(field.label))
      || cornerReliefCircularBendSections.some((section) => section.fields?.some((field) => field.label === "Default mode" || field.label === "Corner mode" || field.label === "Default Clearance" || field.label === "Corner Clearance" || field.label === "Default gap" || field.label === "Corner gap" || field.label === "Default flange gap" || field.label === "Flange gap"))
      || [cornerReliefRectangular, cornerReliefCircular, cornerReliefObround].some((summary) => (
        summary?.panelSketchReliefs?.length !== 0
          || summary?.hasBendSurfaceEndpointProjection
          || summary?.geometry?.cornerReliefs?.length !== 0
      ))
      || !cornerReliefDefaultSceneUsesChartsForSupportedTypes
      || !cornerReliefLegacyDemoSceneBlocked
      || !cornerReliefCircularClearanceDoesNotMoveLegacyPanelBoundary
      || !cornerReliefCircularUndersizedRadiusDoesNotCreateBrokenPanelReliefs
      || !cornerReliefCircularSceneUsesLocalEndpointCutWalls
      || !cornerReliefCircularTinyRadiusClipsBendLocally
      || [cornerReliefRectangular, cornerReliefCircular, cornerReliefObround].some((summary) => (
        summary?.basePoints < 4
          || summary?.smoothPoints !== 0
          || summary?.panelSmoothPoints !== 0
          || summary?.geometry?.cornerReliefs?.length !== 0
      ))
  ) {
    console.error("FAILED: sample_sheet_metal_corner_reliefs should expose rectangular, circular, and obround SolidWorks-style 2-bend corner relief examples");
    return 1;
  }
  const roundedSketchScene = buildScene(roundedSketchProject, profiles, fasteners, settings);
  const roundedSketchSceneLines = roundedSketchScene.lines.filter((line) => (
    line.collection === "sketches" && line.objectId === "rounded_sketch_arc_demo"
  ));
  const roundedSketchSourceWorldPoints = new Set(sketchVertices(roundedSketchSample).map((vertex) => (
    pointKey([vertex.point[0], vertex.point[1], 0])
  )));
  const roundedSketchRenderedWorldPoints = new Set(roundedSketchSceneLines.flatMap((line) => (
    (line.points || []).map(pointKey)
  )));
  const roundedSketchRenderedIntermediatePoints = [...roundedSketchRenderedWorldPoints]
    .filter((key) => !roundedSketchSourceWorldPoints.has(key));
  const roundedSketchChordLines = roundedSketchSampleArcs.filter((edge) => {
    const from = (roundedSketchSample.vertices || []).find((vertex) => vertex.id === edge.from)?.point;
    const to = (roundedSketchSample.vertices || []).find((vertex) => vertex.id === edge.to)?.point;
    if (!from || !to) return true;
    const fromKey = pointKey([from[0], from[1], 0]);
    const toKey = pointKey([to[0], to[1], 0]);
    return roundedSketchSceneLines.some((line) => {
      const points = line.points || [];
      if (points.length !== 2) return false;
      const a = pointKey(points[0]);
      const b = pointKey(points[1]);
      return (a === fromKey && b === toKey) || (a === toKey && b === fromKey);
    });
  });
  if (
    roundedSketchSceneLines.length <= roundedSketchSampleEdges.length
      || roundedSketchRenderedIntermediatePoints.length < 20
      || roundedSketchChordLines.length
      || !roundedSketchScene.faces.some((face) => face.collection === "sketches" && face.objectId === "rounded_sketch_arc_demo")
  ) {
    console.error(`FAILED: rounded sketch sample should render circular arcs as sampled curves, not straight source-edge chords (${roundedSketchSceneLines.length} scene lines, ${roundedSketchRenderedIntermediatePoints.length} intermediate points)`);
    return 1;
  }
  const roundedPlateProjectPath = path.join(ROOT, "bobercad", "data", "projects", "sample_rounded_plate.json");
  const roundedPlateProject = readJson(roundedPlateProjectPath);
  const roundedPlateProfiles = readJson(path.resolve(path.dirname(roundedPlateProjectPath), roundedPlateProject.libraries.profiles.path));
  const roundedPlateFasteners = readJson(path.resolve(path.dirname(roundedPlateProjectPath), roundedPlateProject.libraries.fasteners.path));
  const roundedPlateObject = roundedPlateProject.model?.plates?.rounded_plate_arc_demo;
  const roundedPlateSketch = roundedPlateObject?.sketch || {};
  const roundedPlateEdges = sketchEdges(roundedPlateSketch);
  const roundedPlateArcs = roundedPlateEdges.filter((edge) => edge.kind === "circular-arc");
  const roundedPlateGeneratedGeometryKeys = [];
  collectGeneratedGeometryKeys(roundedPlateObject, [], roundedPlateGeneratedGeometryKeys);
  const roundedPlateUnexpectedEdgeKeys = roundedPlateEdges.flatMap((edge) => {
    const allowed = edge.kind === "circular-arc" ? arcEdgeAllowedKeys : lineEdgeAllowedKeys;
    return Object.keys(edge).filter((key) => !allowed.has(key)).map((key) => `${edge.id}.${key}`);
  });
  if (
    !roundedPlateObject
      || roundedPlateObject.type !== "rounded-plate"
      || Number(roundedPlateObject.thickness) !== 12
      || sketchVertices(roundedPlateSketch).length !== 8
      || roundedPlateEdges.length !== 8
      || roundedPlateArcs.length !== 4
      || roundedPlateArcs.some((edge) => (
        !Array.isArray(edge.center)
          || edge.center.length !== 2
          || !Number.isFinite(Number(edge.radius))
          || Number(edge.radius) <= 0
          || !["cw", "ccw"].includes(edge.direction)
      ))
      || roundedPlateGeneratedGeometryKeys.length
      || roundedPlateUnexpectedEdgeKeys.length
  ) {
    console.error(`FAILED: sample_rounded_plate should store one analytic rounded plate without generated tessellation (${[
      ...roundedPlateGeneratedGeometryKeys,
      ...roundedPlateUnexpectedEdgeKeys
    ].join(", ")})`);
    return 1;
  }
  const roundedPlateScene = buildScene(roundedPlateProject, roundedPlateProfiles, roundedPlateFasteners, settings);
  const roundedPlateSceneLines = roundedPlateScene.lines.filter((line) => (
    line.collection === "plates" && line.objectId === "rounded_plate_arc_demo"
  ));
  const roundedPlateSourceWorldPoints = new Set(sketchVertices(roundedPlateSketch).map((vertex) => (
    pointKey([vertex.point[0], vertex.point[1], 0])
  )));
  const roundedPlateRenderedWorldPoints = new Set(roundedPlateSceneLines.flatMap((line) => (
    (line.points || []).map(pointKey)
  )));
  const roundedPlateRenderedIntermediatePoints = [...roundedPlateRenderedWorldPoints]
    .filter((key) => !roundedPlateSourceWorldPoints.has(key));
  const roundedPlateChordLines = roundedPlateArcs.filter((edge) => {
    const from = (roundedPlateSketch.vertices || []).find((vertex) => vertex.id === edge.from)?.point;
    const to = (roundedPlateSketch.vertices || []).find((vertex) => vertex.id === edge.to)?.point;
    if (!from || !to) return true;
    const fromKey = pointKey([from[0], from[1], 0]);
    const toKey = pointKey([to[0], to[1], 0]);
    return roundedPlateSceneLines.some((line) => {
      const points = line.points || [];
      if (points.length !== 2) return false;
      const a = pointKey(points[0]);
      const b = pointKey(points[1]);
      return (a === fromKey && b === toKey) || (a === toKey && b === fromKey);
    });
  });
  if (
    !roundedPlateScene.faces.some((face) => face.collection === "plates" && face.objectId === "rounded_plate_arc_demo")
      || roundedPlateSceneLines.length <= roundedPlateEdges.length
      || roundedPlateRenderedIntermediatePoints.length < 20
      || roundedPlateChordLines.length
  ) {
    console.error(`FAILED: rounded plate sample should validate and render circular arcs as sampled plate edges (${roundedPlateSceneLines.length} scene lines, ${roundedPlateRenderedIntermediatePoints.length} intermediate points)`);
    return 1;
  }
  const roundedPlateGeometryOutline = geometryApi.plateOutline(roundedPlateObject, settings.render?.curves || {});
  const roundedPlateGeometryOutlineKeys = new Set(roundedPlateGeometryOutline.map((point) => pointKey([point[0], point[1], 0])));
  const roundedPlateGeometryIntermediatePoints = [...roundedPlateGeometryOutlineKeys]
    .filter((key) => !roundedPlateSourceWorldPoints.has(key));
  if (
    roundedPlateGeometryOutline.length <= roundedPlateEdges.length
      || roundedPlateGeometryIntermediatePoints.length < 20
      || roundedPlateArcs.some((edge) => {
        const from = (roundedPlateSketch.vertices || []).find((vertex) => vertex.id === edge.from)?.point;
        const to = (roundedPlateSketch.vertices || []).find((vertex) => vertex.id === edge.to)?.point;
        if (!from || !to) return true;
        const fromKey = pointKey([from[0], from[1], 0]);
        const toKey = pointKey([to[0], to[1], 0]);
        const fromIndex = roundedPlateGeometryOutline.findIndex((point) => pointKey([point[0], point[1], 0]) === fromKey);
        const toIndex = roundedPlateGeometryOutline.findIndex((point) => pointKey([point[0], point[1], 0]) === toKey);
        return Math.abs(fromIndex - toIndex) === 1 || Math.abs(fromIndex - toIndex) === roundedPlateGeometryOutline.length - 1;
      })
  ) {
    console.error(`FAILED: model geometry API should derive rounded plate outline from sampled semantic arcs for exporter-facing consumers (${roundedPlateGeometryOutline.length} points, ${roundedPlateGeometryIntermediatePoints.length} intermediate points)`);
    return 1;
  }
  const roundedPlateWeldProject = JSON.parse(JSON.stringify(roundedPlateProject));
  const roundedPlateWeldSupportPoint = [115 + 35 / Math.SQRT2, -55 - 35 / Math.SQRT2, 0];
  const roundedPlateWeldSupportNormal = [1 / Math.SQRT2, -1 / Math.SQRT2, 0];
  const roundedPlateWeldInterfaceId = "rounded_plate_runtime_arc_support_face";
  const roundedPlateWeld = {
    id: "rounded_plate_runtime_arc_weld",
    type: "fillet-weld",
    size: 6,
    participants: ["rounded_plate_arc_demo"],
    reference: {
      kind: "plate-support-edge",
      plateId: "rounded_plate_arc_demo",
      supportInterfaceId: roundedPlateWeldInterfaceId,
      runs: [
        { edge: "support", side: "front", size: 6 }
      ]
    }
  };
  roundedPlateWeldProject.objectIndex[roundedPlateWeldInterfaceId] = {
    collection: "interfaces",
    type: "plate-face"
  };
  roundedPlateWeldProject.model.interfaces[roundedPlateWeldInterfaceId] = {
    id: roundedPlateWeldInterfaceId,
    type: "plate-face",
    ownerId: "rounded_plate_arc_demo",
    role: "runtime-rounded-arc-weld-support",
    origin: roundedPlateWeldSupportPoint,
    normal: roundedPlateWeldSupportNormal,
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0]
  };
  const roundedPlateWeldEvaluation = evaluateWeld(roundedPlateWeldProject, roundedPlateProfiles.profiles || {}, roundedPlateWeld);
  const roundedPlateWeldFace = roundedPlateWeldEvaluation.faces?.[0];
  const roundedPlateWeldEdgeKeys = (roundedPlateWeldFace?.points || []).slice(0, 2).map((point) => (
    pointKey([point[0], point[1], 0])
  ));
  if (
    roundedPlateWeldEvaluation.kind !== "plate-support-edge"
      || roundedPlateWeldEvaluation.plateId !== "rounded_plate_arc_demo"
      || roundedPlateWeldEvaluation.supportInterfaceId !== roundedPlateWeldInterfaceId
      || !roundedPlateWeldFace
      || roundedPlateWeldFace.edge !== "support"
      || roundedPlateWeldEdgeKeys.length !== 2
      || roundedPlateWeldEdgeKeys.every((key) => roundedPlateSourceWorldPoints.has(key))
  ) {
    console.error("FAILED: plate-support-edge weld evaluation should consume sampled rounded plate outline segments, not only source arc endpoint chords");
    return 1;
  }
  const roundedPlateHolePattern = {
    id: "rounded_plate_runtime_corner_hole_grid",
    positions: [[130, -80]],
    holeDiameter: 2
  };
  const roundedPlateChordOutline = sketchVertices(roundedPlateSketch).map((vertex) => vertex.point);
  const roundedPlateCheckCtx = {
    geometry: geometryApi,
    fail: (message) => {
      throw new Error(message);
    },
    diagnostics: [],
    error(code, message, options = {}) {
      this.diagnostics.push({ code, message, options });
    }
  };
  createCheckApi(roundedPlateCheckCtx).gridFitsPlate(roundedPlateHolePattern, roundedPlateObject, {
    code: "rounded-plate-hole-outside",
    message: "rounded plate hole should fit sampled arc outline"
  });
  if (
    geometryApi.circleFitsPolygon(roundedPlateHolePattern.positions[0], roundedPlateHolePattern.holeDiameter / 2, roundedPlateChordOutline)
      || roundedPlateCheckCtx.diagnostics.length
  ) {
    console.error("FAILED: rounded plate feature grid check should use sampled arc outline, accepting holes inside the rounded corner that a chord-only outline would reject");
    return 1;
  }
  const roundedPlatePrimitiveParameters = {
    "bolts.rows": 1,
    "bolts.columns": 1,
    "bolts.pitch": 0,
    "bolts.gauge": 0,
    "bolts.fastenerRef": "M16_8_8",
    "bolts.length": 40,
    "bolts.nutPositionMode": "auto",
    "bolts.verticalPositionMode": "custom",
    "bolts.horizontalPositionMode": "custom",
    "bolts.rowSpacingMode": "equal",
    "bolts.columnSpacingMode": "equal",
    "bolts.parallelToSupport": false,
    "bolts.topEdgeDistance": 170,
    "bolts.supportEdgeDistance": 280,
    "holes.tolerance": "custom",
    "holes.customDiameter": 2,
    "washers.head": true,
    "washers.nut": true
  };
  const roundedPlatePrimitiveReference = {
    origin: [0, 0, 0],
    webFaceOrigin: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    webThickness: 8,
    extents: {
      length: 500,
      height: 500
    }
  };
  const roundedPlatePrimitiveDiagnostics = [];
  const roundedPlatePrimitiveObjects = {
    patterns: {},
    features: {},
    fastenerGroups: {}
  };
  const roundedPlatePrimitiveBackPlate = {
    ...roundedPlateObject,
    id: "rounded_plate_arc_demo_back_runtime",
    center: [0, 0, -24]
  };
  const roundedPlatePrimitiveCtx = {
    geometry: geometryApi,
    fasteners: roundedPlateFasteners,
    check: null,
    fail(message) {
      throw new Error(message);
    },
    error(code, message, options = {}) {
      roundedPlatePrimitiveDiagnostics.push({ code, message, options });
    },
    params(spec) {
      return Object.fromEntries(Object.entries(spec).map(([key, pathValue]) => [key, roundedPlatePrimitiveParameters[pathValue]]));
    },
    parameterValue(pathValue, options = {}) {
      if (Object.prototype.hasOwnProperty.call(roundedPlatePrimitiveParameters, pathValue)) {
        return roundedPlatePrimitiveParameters[pathValue];
      }
      if (options.required === false) return undefined;
      this.fail(`missing primitive parameter ${pathValue}`);
    },
    roleActive(role) {
      return role !== "backFinPlate";
    },
    pattern: {
      rectangularGrid(role, data) {
        const pattern = { id: `${role}_runtime`, type: "rectangular-grid", ...data };
        roundedPlatePrimitiveObjects.patterns[role] = pattern;
        return pattern;
      }
    },
    feature: {
      holePattern(role, data) {
        const feature = { id: `${role}_runtime`, type: "hole-pattern", ...data };
        roundedPlatePrimitiveObjects.features[role] = feature;
        return feature;
      }
    },
    fastener: {
      group(role, data) {
        const fastenerGroup = { id: `${role}_runtime`, type: "fastener-group", ...data };
        roundedPlatePrimitiveObjects.fastenerGroups[role] = fastenerGroup;
        return fastenerGroup;
      }
    }
  };
  roundedPlatePrimitiveCtx.check = createCheckApi(roundedPlatePrimitiveCtx);
  const roundedPlatePrimitiveResult = buildSecondaryWebBolting(roundedPlatePrimitiveCtx, {
    recipeContext: {
      finPlate: roundedPlateObject,
      backFinPlate: roundedPlatePrimitiveBackPlate,
      connectionContext: {
        plate: {
          thickness: roundedPlateObject.thickness,
          length: 400,
          height: 200,
          edgeOffset: 0
        },
        supportedBeam: { id: "rounded_plate_runtime_supported_beam" },
        supportInterface: {
          id: "rounded_plate_runtime_support_interface",
          origin: [0, 0, 0],
          normal: [1, 0, 0],
          localAxisY: [1, 0, 0],
          localAxisZ: [0, 1, 0]
        },
        supportNormal: [1, 0, 0],
        beamHoleReference: roundedPlatePrimitiveReference,
        layoutReference: roundedPlatePrimitiveReference,
        holeReference: roundedPlatePrimitiveReference,
        beamWebThickness: 8
      }
    }
  });
  const roundedPlatePrimitivePosition = roundedPlatePrimitiveResult.boltGrid.positions?.[0] || [];
  if (
    roundedPlatePrimitiveDiagnostics.length
      || roundedPlatePrimitiveResult.effectiveHoleDiameter !== 2
      || Math.abs(roundedPlatePrimitivePosition[0] - 130) > 1e-6
      || Math.abs(roundedPlatePrimitivePosition[1] + 80) > 1e-6
      || roundedPlatePrimitiveResult.plateHoles?.ownerId !== "rounded_plate_arc_demo"
      || roundedPlatePrimitiveResult.fasteners?.through?.fromFeatureId !== roundedPlatePrimitiveResult.plateHoles?.id
  ) {
    console.error(`FAILED: secondary-web bolting primitive should place and validate a hole inside a sampled rounded plate corner without chord-only outline diagnostics (${JSON.stringify(roundedPlatePrimitiveDiagnostics)})`);
    return 1;
  }
  const standaloneFilletStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  standaloneFilletStore.setSketchCenterRectangle("rounded_sketch_arc_demo", {
    width: 120,
    height: 80,
    center: [0, 0],
    idPrefix: "standalone_fillet_rect"
  });
  const standaloneFilletRectSketch = standaloneFilletStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (sketchEdges(standaloneFilletRectSketch).length !== 4 || sketchEdges(standaloneFilletRectSketch).some((edge) => edge.kind === "circular-arc")) {
    console.error("FAILED: standalone fillet workflow should start from a straight center rectangle sketch");
    return 1;
  }
  const standaloneFilletCornerVertexId = sketchVertices(standaloneFilletRectSketch)[0]?.id;
  const standaloneFilletResult = standaloneFilletStore.filletSketchCorner("rounded_sketch_arc_demo", standaloneFilletCornerVertexId, { radius: 12 });
  const standaloneFilletSketch = standaloneFilletResult.project.model.sketches.rounded_sketch_arc_demo.sketch;
  const standaloneFilletArc = sketchEdges(standaloneFilletSketch).find((edge) => edge.kind === "circular-arc");
  if (
    !standaloneFilletResult.edgeId
      || standaloneFilletArc?.id !== standaloneFilletResult.edgeId
      || sketchEdges(standaloneFilletSketch).length !== 5
      || sketchEdges(standaloneFilletSketch).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !sketchRelations(standaloneFilletSketch).some((relation) => (
        relation.type === "radius"
          && relation.edgeId === standaloneFilletResult.edgeId
          && Math.abs(Number(relation.value) - 12) <= 1e-6
      ))
  ) {
    console.error("FAILED: standalone sketch fillet should replace one sharp corner with one semantic radius arc and relation");
    return 1;
  }
  const standaloneFilletPlateStore = createProjectStore({ project: standaloneFilletResult.project });
  const standaloneFilletPlateResult = standaloneFilletPlateStore.createPlateFromSketch("rounded_sketch_arc_demo", {
    id: "standalone_fillet_plate_runtime",
    thickness: 10
  });
  const standaloneFilletPlate = standaloneFilletPlateResult.project.model.plates.standalone_fillet_plate_runtime;
  const standaloneFilletPlateEdges = sketchEdges(standaloneFilletPlate?.sketch);
  const standaloneFilletPlateScene = buildScene(standaloneFilletPlateResult.project, profiles, fasteners, settings);
  if (
    !standaloneFilletPlate
      || standaloneFilletPlate.placementIntent?.sourceSketchId !== "rounded_sketch_arc_demo"
      || standaloneFilletPlateEdges.length !== 5
      || standaloneFilletPlateEdges.filter((edge) => edge.kind === "circular-arc").length !== 1
      || !standaloneFilletPlateScene.faces.some((face) => face.collection === "plates" && face.objectId === "standalone_fillet_plate_runtime")
  ) {
    console.error("FAILED: standalone filleted sketch should create and render a plate preserving the semantic radius arc");
    return 1;
  }
  const plateHostedFilletStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const plateHostedCreateResult = plateHostedFilletStore.createPlate({
    id: "plate_hosted_fillet_runtime",
    thickness: 10,
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    sketch: sketchFromRectangle(120, 80, "plate_hosted_fillet_rect", [0, 0])
  });
  const plateHostedRectSketch = plateHostedCreateResult.plate.sketch;
  if (sketchEdges(plateHostedRectSketch).length !== 4 || sketchEdges(plateHostedRectSketch).some((edge) => edge.kind === "circular-arc")) {
    console.error("FAILED: plate-hosted fillet workflow should start from a straight plate sketch");
    return 1;
  }
  const plateHostedCornerVertexId = sketchVertices(plateHostedRectSketch)[0]?.id;
  const plateHostedFilletResult = plateHostedFilletStore.filletPlateSketchCorner("plate_hosted_fillet_runtime", plateHostedCornerVertexId, { radius: 12 });
  const plateHostedFilletPlate = plateHostedFilletResult.project.model.plates.plate_hosted_fillet_runtime;
  const plateHostedFilletSketch = plateHostedFilletPlate.sketch;
  const plateHostedFilletArc = sketchEdges(plateHostedFilletSketch).find((edge) => edge.kind === "circular-arc");
  const plateHostedFilletScene = buildScene(plateHostedFilletResult.project, profiles, fasteners, settings);
  if (
    !plateHostedFilletResult.edgeId
      || plateHostedFilletArc?.id !== plateHostedFilletResult.edgeId
      || sketchEdges(plateHostedFilletSketch).length !== 5
      || sketchEdges(plateHostedFilletSketch).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !sketchRelations(plateHostedFilletSketch).some((relation) => (
        relation.type === "radius"
          && relation.edgeId === plateHostedFilletResult.edgeId
          && Math.abs(Number(relation.value) - 12) <= 1e-6
      ))
      || !plateHostedFilletScene.faces.some((face) => face.collection === "plates" && face.objectId === "plate_hosted_fillet_runtime")
  ) {
    console.error("FAILED: plate-hosted sketch fillet should add one semantic radius arc, relation, and keep the plate renderable");
    return 1;
  }
  const edgeRelationControllerStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let edgeRelationControllerStatus = "";
  let edgeRelationControllerProject = null;
  const edgeRelationControllerEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: edgeRelationControllerStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      edgeRelationControllerProject = nextProject;
    },
    onStatusChange: (message) => {
      edgeRelationControllerStatus = message;
    }
  });
  if (!edgeRelationControllerEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: edge relation controller smoke should select the rounded standalone sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v3"]
  }, { render: false });
  if (
    edgeRelationControllerEdit.addTangentRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("select only two sketch edges")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Tangent relation should reject ambiguous edge+point selections before mutating the sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e3"]
  }, { render: false });
  if (
    edgeRelationControllerEdit.addTangentRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("at least one circular sketch edge")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Tangent relation should explain that two straight edges need a circular arc");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"]
  }, { render: false });
  if (
    edgeRelationControllerEdit.addEqualRadiusRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("both selected sketch edges must be circular arcs")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Equal Radius relation should reject line+arc selections before mutating the sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"]
  }, { render: false });
  if (
    edgeRelationControllerEdit.addConcentricRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("both selected sketch edges must be circular arcs")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Concentric relation should reject line+arc selections before mutating the sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e4"]
  }, { render: false });
  edgeRelationControllerProject = null;
  if (
    edgeRelationControllerEdit.addTangentRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("not tangent")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Tangent relation should reject non-tangent edge pairs before mutating the sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2", "rounded_sketch_arc_demo_e4"]
  }, { render: false });
  edgeRelationControllerProject = null;
  if (
    edgeRelationControllerEdit.addConcentricRelationForSelection() !== false
      || !edgeRelationControllerStatus.includes("not concentric")
      || edgeRelationControllerProject
  ) {
    console.error("FAILED: controller Concentric relation should reject non-concentric arc pairs before mutating the sketch");
    return 1;
  }
  edgeRelationControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"]
  }, { render: false });
  if (!edgeRelationControllerEdit.addTangentRelationForSelection()) {
    console.error("FAILED: controller Tangent relation should still accept a valid line+arc selection");
    return 1;
  }
  const edgeRelationControllerSketch = edgeRelationControllerProject?.model?.sketches?.rounded_sketch_arc_demo?.sketch;
  if (!sketchRelations(edgeRelationControllerSketch).some((relation) => (
    relation.type === "tangent"
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e1")
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e2")
  ))) {
    console.error("FAILED: controller Tangent relation should store the valid line+arc relation");
    return 1;
  }
  const unequalRadiusControllerProjectSeed = JSON.parse(JSON.stringify(roundedSketchProject));
  unequalRadiusControllerProjectSeed.model.sketches.rounded_sketch_arc_demo.sketch = {
    ...unequalRadiusControllerProjectSeed.model.sketches.rounded_sketch_arc_demo.sketch,
    constructionVertices: [
      { id: "uneq_cv1", point: [10, 0] },
      { id: "uneq_cv2", point: [0, 10] },
      { id: "uneq_cv3", point: [-12, 0] },
      { id: "uneq_cv4", point: [0, -12] }
    ],
    constructionEdges: [
      {
        id: "uneq_ce1",
        from: "uneq_cv1",
        to: "uneq_cv2",
        kind: "circular-arc",
        center: [0, 0],
        radius: 10,
        direction: "ccw"
      },
      {
        id: "uneq_ce2",
        from: "uneq_cv3",
        to: "uneq_cv4",
        kind: "circular-arc",
        center: [0, 0],
        radius: 12,
        direction: "ccw"
      }
    ]
  };
  const unequalRadiusControllerStore = createProjectStore({ project: unequalRadiusControllerProjectSeed });
  let unequalRadiusControllerStatus = "";
  let unequalRadiusControllerProject = null;
  const unequalRadiusControllerEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: unequalRadiusControllerStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      unequalRadiusControllerProject = nextProject;
    },
    onStatusChange: (message) => {
      unequalRadiusControllerStatus = message;
    }
  });
  unequalRadiusControllerEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  unequalRadiusControllerEdit.selectEntities({ edgeIds: ["uneq_ce1", "uneq_ce2"] }, { render: false });
  if (
    unequalRadiusControllerEdit.addEqualRadiusRelationForSelection() !== false
      || !unequalRadiusControllerStatus.includes("do not have equal radius")
      || unequalRadiusControllerProject
  ) {
    console.error("FAILED: controller Equal Radius relation should reject unequal-radius arc pairs before mutating the sketch");
    return 1;
  }
  const equalRadiusControllerStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let equalRadiusControllerProject = null;
  const equalRadiusControllerEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: equalRadiusControllerStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      equalRadiusControllerProject = nextProject;
    },
    onStatusChange: () => {}
  });
  equalRadiusControllerEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  equalRadiusControllerEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2", "rounded_sketch_arc_demo_e4"]
  }, { render: false });
  if (!equalRadiusControllerEdit.addEqualRadiusRelationForSelection()) {
    console.error("FAILED: controller Equal Radius relation should accept two same-radius circular arcs");
    return 1;
  }
  const equalRadiusControllerSketch = equalRadiusControllerProject?.model?.sketches?.rounded_sketch_arc_demo?.sketch;
  if (!sketchRelations(equalRadiusControllerSketch).some((relation) => (
    relation.type === "equal-radius"
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e2")
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e4")
  ))) {
    console.error("FAILED: controller Equal Radius relation should store the valid arc+arc relation");
    return 1;
  }
  const concentricControllerProjectSeed = JSON.parse(JSON.stringify(roundedSketchProject));
  concentricControllerProjectSeed.model.sketches.rounded_sketch_arc_demo.sketch = {
    ...concentricControllerProjectSeed.model.sketches.rounded_sketch_arc_demo.sketch,
    constructionVertices: [
      { id: "conc_cv1", point: [10, 0] },
      { id: "conc_cv2", point: [0, 10] },
      { id: "conc_cv3", point: [-10, 0] },
      { id: "conc_cv4", point: [0, -10] }
    ],
    constructionEdges: [
      {
        id: "conc_ce1",
        from: "conc_cv1",
        to: "conc_cv2",
        kind: "circular-arc",
        center: [0, 0],
        radius: 10,
        direction: "ccw"
      },
      {
        id: "conc_ce2",
        from: "conc_cv3",
        to: "conc_cv4",
        kind: "circular-arc",
        center: [0, 0],
        radius: 10,
        direction: "ccw"
      }
    ]
  };
  const concentricControllerStore = createProjectStore({ project: concentricControllerProjectSeed });
  let concentricControllerProject = null;
  const concentricControllerEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: concentricControllerStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      concentricControllerProject = nextProject;
    },
    onStatusChange: () => {}
  });
  concentricControllerEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  concentricControllerEdit.selectEntities({ edgeIds: ["conc_ce1", "conc_ce2"] }, { render: false });
  if (!concentricControllerEdit.addConcentricRelationForSelection()) {
    console.error("FAILED: controller Concentric relation should accept two concentric circular arcs");
    return 1;
  }
  const concentricControllerSketch = concentricControllerProject?.model?.sketches?.rounded_sketch_arc_demo?.sketch;
  if (!sketchRelations(concentricControllerSketch).some((relation) => (
    relation.type === "concentric"
      && relation.edgeIds.includes("conc_ce1")
      && relation.edgeIds.includes("conc_ce2")
  ))) {
    console.error("FAILED: controller Concentric relation should store the valid construction arc relation");
    return 1;
  }
  const roundedSketchConvertStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const roundedSketchConvertResult = roundedSketchConvertStore.createPlateFromSketch("rounded_sketch_arc_demo", {
    id: "rounded_sketch_arc_demo_plate_runtime",
    thickness: 9
  });
  const convertedRoundedPlate = roundedSketchConvertResult.project.model.plates.rounded_sketch_arc_demo_plate_runtime;
  const convertedRoundedPlateEdges = sketchEdges(convertedRoundedPlate?.sketch);
  const convertedRoundedPlateScene = buildScene(roundedSketchConvertResult.project, profiles, fasteners, settings);
  const convertedRoundedPlateFaces = convertedRoundedPlateScene.faces.filter((face) => (
    face.collection === "plates" && face.objectId === "rounded_sketch_arc_demo_plate_runtime"
  ));
  if (
    !convertedRoundedPlate
      || roundedSketchConvertResult.project.objectIndex.rounded_sketch_arc_demo_plate_runtime?.collection !== "plates"
      || roundedSketchConvertResult.project.model.sketches.rounded_sketch_arc_demo?.id !== "rounded_sketch_arc_demo"
      || convertedRoundedPlate.placementIntent?.sourceSketchId !== "rounded_sketch_arc_demo"
      || convertedRoundedPlate.thickness !== 9
      || convertedRoundedPlateEdges.length !== 8
      || convertedRoundedPlateEdges.filter((edge) => edge.kind === "circular-arc").length !== 4
      || !convertedRoundedPlateFaces.length
  ) {
    console.error("FAILED: createPlateFromSketch should preserve semantic rounded sketch edges and render the converted plate");
    return 1;
  }
  const roundedSketchControllerStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let roundedSketchControllerStatus = "";
  let roundedSketchControllerProject = null;
  let roundedSketchControllerSelection = null;
  let roundedSketchControllerPromptKind = "";
  const roundedSketchControllerEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: roundedSketchControllerStore,
    settings: {},
    requestDimensionInput: ({ kind }) => {
      roundedSketchControllerPromptKind = kind;
      return "11";
    },
    onProjectChange: (nextProject) => {
      roundedSketchControllerProject = nextProject;
    },
    onStatusChange: (message) => {
      roundedSketchControllerStatus = message;
    },
    onSelectionChange: (nextSelection) => {
      roundedSketchControllerSelection = nextSelection;
    }
  });
  if (!roundedSketchControllerEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: Convert To Plate controller smoke should select the rounded standalone sketch");
    return 1;
  }
  if (!roundedSketchControllerEdit.convertSketchToPlate()) {
    console.error("FAILED: Convert To Plate controller should convert the selected rounded standalone sketch");
    return 1;
  }
  const roundedControllerPlate = roundedSketchControllerStore.project().model.plates.rounded_sketch_arc_demo_plate;
  const roundedControllerPlateEdges = sketchEdges(roundedControllerPlate?.sketch);
  const roundedControllerActiveState = roundedSketchControllerEdit.activeState();
  if (
    roundedSketchControllerPromptKind !== "convert-sketch-plate-thickness"
      || !roundedSketchControllerProject?.model?.plates?.rounded_sketch_arc_demo_plate
      || !roundedControllerPlate
      || roundedControllerPlate.thickness !== 11
      || roundedControllerPlate.placementIntent?.sourceSketchId !== "rounded_sketch_arc_demo"
      || roundedControllerPlateEdges.filter((edge) => edge.kind === "circular-arc").length !== 4
      || roundedControllerActiveState.plateId !== "rounded_sketch_arc_demo_plate"
      || roundedControllerActiveState.collection !== "plates"
      || roundedSketchControllerSelection?.plateId !== "rounded_sketch_arc_demo_plate"
      || !roundedSketchControllerStatus.includes("created plate rounded_sketch_arc_demo_plate thickness 11")
  ) {
    console.error("FAILED: Convert To Plate controller should prompt thickness, create a rounded plate, and activate it");
    return 1;
  }
  const roundedBendSketch = sketchFromRoundedRectangle(100, 80, 12, "rounded_bend_plate");
  const roundedBendProject = JSON.parse(JSON.stringify(roundedSketchProject));
  roundedBendProject.objectIndex.rounded_bend_plate = { collection: "plates", type: "bent-plate" };
  roundedBendProject.model.plates.rounded_bend_plate = {
    id: "rounded_bend_plate",
    type: "bent-plate",
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    thickness: 8,
    sketch: roundedBendSketch,
    fabrication: { bends: [] }
  };
  const roundedBendStore = createProjectStore({ project: roundedBendProject });
  const roundedBendArcEdge = sketchEdges(roundedBendSketch).find((edge) => edge.kind === "circular-arc");
  const roundedBendLineEdge = sketchEdges(roundedBendSketch).find((edge) => edge.kind !== "circular-arc");
  let roundedArcBendError = null;
  try {
    roundedBendStore.upsertPlateBend("rounded_bend_plate", {
      id: "bend_on_arc",
      edgeId: roundedBendArcEdge.id,
      direction: "up",
      angle: 90,
      radius: 8,
      flangeLength: 40
    });
  } catch (error) {
    roundedArcBendError = error;
  }
  if (
    !String(roundedArcBendError?.message || "").includes("must be a straight sketch edge")
      || roundedBendStore.project().model.plates.rounded_bend_plate.fabrication.bends.length !== 0
  ) {
    console.error("FAILED: plate bend normalization should reject circular-arc sketch edges without mutating the plate");
    return 1;
  }
  const roundedStraightBendProject = roundedBendStore.upsertPlateBend("rounded_bend_plate", {
    id: "bend_on_line",
    edgeId: roundedBendLineEdge.id,
    direction: "up",
    angle: 90,
    radius: 8,
    flangeLength: 40
  });
  if (!roundedStraightBendProject.model.plates.rounded_bend_plate.fabrication.bends.some((bend) => bend.id === "bend_on_line")) {
    console.error("FAILED: plate bend normalization should still accept straight sketch edges on rounded plates");
    return 1;
  }
  const roundedBendRemoveStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedStraightBendProject)) });
  const roundedBendRemoveProject = roundedBendRemoveStore.removePlateBend("rounded_bend_plate", "bend_on_line");
  if (
    roundedBendRemoveProject.model.plates.rounded_bend_plate.type !== "plate"
      || roundedBendRemoveProject.model.plates.rounded_bend_plate.fabrication.bends.length !== 0
      || roundedBendRemoveProject.objectIndex.rounded_bend_plate?.type !== "plate"
  ) {
    console.error("FAILED: removing the last plate bend should return a bent plate to a plain plate without store type-change errors");
    return 1;
  }
  const roundedStraightBendPlate = roundedStraightBendProject.model.plates.rounded_bend_plate;
  const roundedStraightBendGeometry = plateBendGeometry(roundedStraightBendPlate, settings.render?.curves || {});
  const legacySheetMetalReliefSettings = {
    ...settings,
    geometry: {
      ...(settings.geometry || {}),
      sheetMetalReliefEvaluator: "legacy"
    }
  };
  const roundedStraightBendChildTargets = roundedStraightBendGeometry.targetEdges.filter((target) => target.parentBendId === "bend_on_line");
  const roundedStraightBendChildTargetEdges = new Set(roundedStraightBendChildTargets.map((target) => target.parentEdge));
  const roundedStraightBendSideStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedStraightBendProject)) });
  const roundedStraightBendSideProject = roundedStraightBendSideStore.upsertPlateBend("rounded_bend_plate", {
    id: "bend_on_line_start_side",
    parentBendId: "bend_on_line",
    parentEdge: "start",
    direction: "up",
    angle: 90,
    radius: 8,
    flangeLength: 24
  });
  const roundedStraightBendSidePlate = roundedStraightBendSideProject.model.plates.rounded_bend_plate;
  const roundedStraightBendSideGeometry = plateBendGeometry(roundedStraightBendSidePlate, settings.render?.curves || {});
  const roundedStraightBendSideScene = buildScene(roundedStraightBendSideProject, profiles, fasteners, settings, { renderObjectIds: ["rounded_bend_plate"] });
  const roundedStraightBendStartSideTarget = roundedStraightBendChildTargets.find((target) => target.parentEdge === "start");
  const roundedStraightBendSideLargeReliefProject = JSON.parse(JSON.stringify(roundedStraightBendSideProject));
  roundedStraightBendSideLargeReliefProject.model.plates.rounded_bend_plate.fabrication.reliefDefaults.radius = 28;
  const roundedStraightBendSideLargeReliefPlate = roundedStraightBendSideLargeReliefProject.model.plates.rounded_bend_plate;
  const roundedStraightBendSideLargeReliefGeometry = plateBendGeometry(roundedStraightBendSideLargeReliefPlate, settings.render?.curves || {});
  const roundedStraightBendSideLargeReliefFirstSurface = roundedStraightBendSideLargeReliefGeometry.bendSurfaces.find((surface) => surface.bend?.id === "bend_on_line_start_side");
  const roundedStraightBendSideGapStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedStraightBendProject)) });
  const roundedStraightBendSideGapProject = roundedStraightBendSideGapStore.upsertPlateBend("rounded_bend_plate", {
    id: "bend_on_line_start_side_gap",
    parentBendId: "bend_on_line",
    parentEdge: "start",
    direction: "up",
    angle: 90,
    radius: 8,
    flangeLength: 24,
    gap: 6
  });
  const roundedStraightBendSideGapPlate = roundedStraightBendSideGapProject.model.plates.rounded_bend_plate;
  const roundedStraightBendSideGapGeometry = plateBendGeometry(roundedStraightBendSideGapPlate, settings.render?.curves || {});
  const roundedStraightBendSideGapFirstSurface = roundedStraightBendSideGapGeometry.bendSurfaces.find((surface) => surface.bend?.id === "bend_on_line_start_side_gap");
  const roundedStraightBendSideCornerReliefs = plateCornerReliefs(roundedStraightBendSidePlate);
  const roundedStraightBendGeneratedCorners = roundedStraightBendSideCornerReliefs.filter((corner) => (
    corner.scope === "bend"
      && corner.parentBendId === "bend_on_line"
      && corner.parentEdge === "start"
      && corner.outgoingBendId === "bend_on_line_start_side"
  ));
  const roundedStraightBendSideOverlay = overlayForPlate(roundedStraightBendSidePlate, {
    settings: settings.authoring || {},
    showRelations: true
  });
  const roundedStraightBendGeneratedStartCorner = roundedStraightBendGeneratedCorners.find((corner) => corner.targetEndpoint === "start");
  const roundedStraightBendGeneratedCornerSiteKeys = new Set(roundedStraightBendGeneratedCorners.map((corner) => corner.siteKey));
  const roundedStraightBendReliefParentPanel = roundedStraightBendSideGeometry.panels.find((panel) => panel.bend?.id === "bend_on_line");
  const roundedStraightBendSideFirstSurface = roundedStraightBendSideGeometry.bendSurfaces.find((surface) => surface.bend?.id === "bend_on_line_start_side");
  const distance3 = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[1] || 0) - (b?.[1] || 0), (a?.[2] || 0) - (b?.[2] || 0));
  const pointOutwardDistance = (point, edge) => (
    ((point?.[0] || 0) - (edge?.start?.[0] || 0)) * (edge?.outward?.[0] || 0)
      + ((point?.[1] || 0) - (edge?.start?.[1] || 0)) * (edge?.outward?.[1] || 0)
      + ((point?.[2] || 0) - (edge?.start?.[2] || 0)) * (edge?.outward?.[2] || 0)
  );
  const edgeTangent = (edge) => {
    const length = distance3(edge?.start, edge?.end);
    if (length <= 1e-6) return [0, 0, 0];
    return [
      ((edge?.end?.[0] || 0) - (edge?.start?.[0] || 0)) / length,
      ((edge?.end?.[1] || 0) - (edge?.start?.[1] || 0)) / length,
      ((edge?.end?.[2] || 0) - (edge?.start?.[2] || 0)) / length
    ];
  };
  const edgeStartInset = (point, edge) => {
    const tangent = edgeTangent(edge);
    return ((point?.[0] || 0) - (edge?.start?.[0] || 0)) * tangent[0]
      + ((point?.[1] || 0) - (edge?.start?.[1] || 0)) * tangent[1]
      + ((point?.[2] || 0) - (edge?.start?.[2] || 0)) * tangent[2];
  };
  const edgeEndInset = (point, edge) => {
    const tangent = edgeTangent(edge);
    return ((edge?.end?.[0] || 0) - (point?.[0] || 0)) * tangent[0]
      + ((edge?.end?.[1] || 0) - (point?.[1] || 0)) * tangent[1]
      + ((edge?.end?.[2] || 0) - (point?.[2] || 0)) * tangent[2];
  };
  const edgeInwardInset = (point, edge) => -pointOutwardDistance(point, edge);
  const maxOutwardExcess = (points, edge) => Math.max(0, ...(points || []).map((point) => pointOutwardDistance(point, edge)));
  const roundedStraightBendChildStartGapInset = edgeStartInset(roundedStraightBendSideFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildEndGapInset = edgeEndInset(roundedStraightBendSideFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildStartRadiusInset = edgeInwardInset(roundedStraightBendSideFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildEndRadiusInset = edgeInwardInset(roundedStraightBendSideFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildLargeReliefStartGapInset = edgeStartInset(roundedStraightBendSideLargeReliefFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildLargeReliefEndGapInset = edgeEndInset(roundedStraightBendSideLargeReliefFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildLargeReliefStartRadiusInset = edgeInwardInset(roundedStraightBendSideLargeReliefFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildLargeReliefEndRadiusInset = edgeInwardInset(roundedStraightBendSideLargeReliefFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildConfiguredStartGapInset = edgeStartInset(roundedStraightBendSideGapFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildConfiguredEndGapInset = edgeEndInset(roundedStraightBendSideGapFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildConfiguredStartRadiusInset = edgeInwardInset(roundedStraightBendSideGapFirstSurface?.points?.[0], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildConfiguredEndRadiusInset = edgeInwardInset(roundedStraightBendSideGapFirstSurface?.points?.[1], roundedStraightBendStartSideTarget);
  const roundedStraightBendChildInnerEdgeInset = 0;
  const roundedStraightBendChildRadiusInset = 4;
  const roundedStraightBendGeneratedCornerVertexIds = new Set(roundedStraightBendGeneratedCorners.map((corner) => corner.vertexId));
  const roundedStraightBendGeneratedCornerMarkers = roundedStraightBendSideOverlay.handles.filter((handle) => {
    return handle.kind === "plate-corner-relief" && roundedStraightBendGeneratedCornerVertexIds.has(handle.cornerReliefVertexId);
  });
  const roundedStraightBendChildReliefPanel = roundedStraightBendSideGeometry.panels.find((panel) => panel.bend?.id === "bend_on_line_start_side");
  const roundedStraightBendGeneratedCornerFaces = roundedStraightBendSideScene.faces.filter((face) => {
    return face.objectId === "rounded_bend_plate" && roundedStraightBendGeneratedCornerVertexIds.has(face.cornerReliefVertexId);
  });
  const samePoint3 = (a, b) => distance3(a, b) <= 1e-6;
  const roundedStraightBendGeneratedReliefThicknessLines = roundedStraightBendSideScene.lines.filter((line) => {
    if (line.objectId !== "rounded_bend_plate" || line.points?.length !== 2) return false;
    return (roundedStraightBendReliefParentPanel?.smoothVertexIndices || []).some((vertexIndex) => {
      const point = roundedStraightBendReliefParentPanel.points?.[vertexIndex];
      const normal = roundedStraightBendReliefParentPanel.normal;
      if (!point || !normal) return false;
      const back = [
        point[0] - normal[0] * roundedStraightBendSidePlate.thickness / 2,
        point[1] - normal[1] * roundedStraightBendSidePlate.thickness / 2,
        point[2] - normal[2] * roundedStraightBendSidePlate.thickness / 2
      ];
      const front = [
        point[0] + normal[0] * roundedStraightBendSidePlate.thickness / 2,
        point[1] + normal[1] * roundedStraightBendSidePlate.thickness / 2,
        point[2] + normal[2] * roundedStraightBendSidePlate.thickness / 2
      ];
      return (samePoint3(line.points[0], back) && samePoint3(line.points[1], front))
        || (samePoint3(line.points[0], front) && samePoint3(line.points[1], back));
    });
  });
  const roundedStraightBendFirstSurface = roundedStraightBendGeometry.bendSurfaces[0];
  const roundedStraightBendLastSurface = roundedStraightBendGeometry.bendSurfaces[roundedStraightBendGeometry.bendSurfaces.length - 1];
  const roundedStraightBendScene = buildScene(roundedStraightBendProject, profiles, fasteners, legacySheetMetalReliefSettings, { renderObjectIds: ["rounded_bend_plate"] });
  const roundedStraightBendSceneFaces = roundedStraightBendScene.faces.filter((face) => face.objectId === "rounded_bend_plate");
  const roundedStraightBendStripFaces = roundedStraightBendSceneFaces.filter((face) => face.bendSurfaceRole === "curved-bend-strip");
  const roundedStraightBendSketchTarget = roundedStraightBendGeometry.targetEdges.find((target) => target.id === `sketch:${roundedBendLineEdge.id}`);
  const roundedStraightBendRadiusPoints = (roundedStraightBendGeometry.bendSurfaceStrips?.[0]?.samples || []).flatMap((sample) => [
    sample.start,
    sample.end,
    sample.unadjustedStart,
    sample.unadjustedEnd
  ]);
  const roundedStraightBendRadiusOutwardExcess = maxOutwardExcess(roundedStraightBendRadiusPoints, roundedStraightBendSketchTarget);
  const roundedStraightBendBaseOutwardExcess = maxOutwardExcess(roundedStraightBendGeometry.basePoints, roundedStraightBendSketchTarget);
  const roundedStraightBendBoundaryLines = roundedStraightBendScene.lines.filter((line) => {
    return line.objectId === "rounded_bend_plate" && line.bendEdgeRole === "curved-bend-boundary";
  });
  const expectedRoundedStraightBendSegments = Math.max(2, Math.ceil((Math.PI / 2 * 8) / settings.render.curves.segmentLength));
  const roundedStraightBendBoundaryCurves = roundedStraightBendBoundaryLines.filter((line) => {
    return line.points?.length === expectedRoundedStraightBendSegments + 1;
  });
  const roundedStraightBendFlangeFaces = roundedStraightBendSceneFaces.filter((face) => {
    return face.bendId === "bend_on_line" && face.bendFaceRole === "flange";
  });
  const roundedStraightBendNonBendTaggedFaces = roundedStraightBendSceneFaces.filter((face) => {
    return face.bendId && face.bendFaceRole !== "flange" && face.bendSurfaceRole !== "curved-bend-strip";
  });
  const reliefSmoothThicknessLines = roundedStraightBendScene.lines.filter((line) => {
    if (line.objectId !== "rounded_bend_plate" || line.points?.length !== 2) return false;
    return (roundedStraightBendGeometry.baseSmoothVertexIndices || []).some((vertexIndex) => {
      const point = roundedStraightBendGeometry.basePoints[vertexIndex];
      if (!point) return false;
      const sameYz = line.points.every((linePoint) => {
        return Math.abs(linePoint[0] - point[0]) <= 1e-6 && Math.abs(linePoint[1] - point[1]) <= 1e-6;
      });
      return sameYz && Math.abs(Math.abs(line.points[0][2] - line.points[1][2]) - roundedStraightBendPlate.thickness) <= 1e-6;
    });
  });
  const reliefSmoothAutoEdgeFaces = roundedStraightBendSceneFaces.filter((face) => {
    if (face.hideEdges === true || !Array.isArray(face.points) || face.points.length !== 4) return false;
    return (roundedStraightBendGeometry.baseSmoothVertexIndices || []).some((vertexIndex) => {
      const point = roundedStraightBendGeometry.basePoints[vertexIndex];
      if (!point) return false;
      const sameYzPoints = face.points.filter((facePoint) => {
        return Math.abs(facePoint[0] - point[0]) <= 1e-6 && Math.abs(facePoint[1] - point[1]) <= 1e-6;
      });
      return sameYzPoints.length >= 2
        && Math.abs(Math.abs(sameYzPoints[0][2] - sameYzPoints[1][2]) - roundedStraightBendPlate.thickness) <= 1e-6;
    });
  });
  if (
    roundedStraightBendGeometry.bendSurfaces.length !== expectedRoundedStraightBendSegments
      || roundedStraightBendGeometry.bendSurfaceStrips?.length !== 1
      || roundedStraightBendGeometry.bendSurfaceStrips[0]?.samples?.length !== expectedRoundedStraightBendSegments + 1
      || roundedStraightBendGeometry.panels.length !== 1
      || !roundedStraightBendChildTargetEdges.has("outer")
      || !roundedStraightBendChildTargetEdges.has("start")
      || !roundedStraightBendChildTargetEdges.has("end")
      || roundedStraightBendSidePlate.fabrication.bends.length !== 2
      || !roundedStraightBendSidePlate.fabrication.reliefDefaults
      || roundedStraightBendGeneratedCorners.length !== 1
      || !roundedStraightBendGeneratedStartCorner
      || !roundedStraightBendGeneratedCornerSiteKeys.has("bend:bend_on_line:start:bend_on_line_start_side:start")
      || roundedStraightBendGeneratedStartCorner.target?.kind !== "bendEndpoint"
      || roundedStraightBendGeneratedStartCorner.target?.parentEndpoint !== "start"
      || roundedStraightBendGeneratedStartCorner.target?.endpoint !== "start"
      || !roundedStraightBendSidePlate.fabrication.bends.some((bend) => bend.parentBendId === "bend_on_line" && bend.parentEdge === "start")
      || roundedStraightBendSideGeometry.panels.length !== 2
      || roundedStraightBendSideGeometry.cornerReliefs?.length !== 0
      || roundedStraightBendReliefParentPanel?.points?.length !== 4
      || roundedStraightBendReliefParentPanel?.smoothVertexIndices?.length
      || roundedStraightBendReliefParentPanel?.cornerReliefs?.length
      || roundedStraightBendChildReliefPanel?.points?.length !== 4
      || roundedStraightBendChildReliefPanel?.smoothVertexIndices?.length
      || roundedStraightBendChildReliefPanel?.cornerReliefs?.length
      || roundedStraightBendGeneratedCornerMarkers.length !== 1
      || roundedStraightBendGeneratedCornerMarkers.some((handle) => !Array.isArray(handle.point) || handle.point.length !== 3)
      || roundedStraightBendGeneratedCornerFaces.length < 1
      || roundedStraightBendGeneratedCornerFaces.some((face) => face.hideEdges !== true)
      || roundedStraightBendGeneratedReliefThicknessLines.length
      || Math.abs(roundedStraightBendChildStartGapInset - roundedStraightBendChildInnerEdgeInset) > 1e-6
      || Math.abs(roundedStraightBendChildEndGapInset - roundedStraightBendChildInnerEdgeInset) > 1e-6
      || Math.abs(roundedStraightBendChildStartRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || Math.abs(roundedStraightBendChildEndRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || Math.abs(roundedStraightBendChildLargeReliefStartGapInset - roundedStraightBendChildInnerEdgeInset) > 1e-6
      || Math.abs(roundedStraightBendChildLargeReliefEndGapInset - roundedStraightBendChildInnerEdgeInset) > 1e-6
      || Math.abs(roundedStraightBendChildLargeReliefStartRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || Math.abs(roundedStraightBendChildLargeReliefEndRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || Math.abs(roundedStraightBendChildConfiguredStartGapInset - 6) > 1e-6
      || Math.abs(roundedStraightBendChildConfiguredEndGapInset - 6) > 1e-6
      || Math.abs(roundedStraightBendChildConfiguredStartRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || Math.abs(roundedStraightBendChildConfiguredEndRadiusInset - roundedStraightBendChildRadiusInset) > 1e-6
      || roundedStraightBendSideGapPlate.fabrication.bends.find((bend) => bend.id === "bend_on_line_start_side_gap")?.gap !== 6
      || !roundedStraightBendSideGeometry.targetEdges.some((target) => target.parentBendId === "bend_on_line_start_side" && target.parentEdge === "outer")
      || roundedStraightBendGeometry.basePoints.length < 4
      || roundedStraightBendGeometry.baseSmoothVertexIndices?.length !== 0
      || roundedStraightBendGeometry.cornerReliefs?.length !== 0
      || reliefSmoothThicknessLines.length
      || reliefSmoothAutoEdgeFaces.length
      || roundedStraightBendRadiusOutwardExcess > 1e-6
      || roundedStraightBendBaseOutwardExcess > 1e-6
      || Math.abs(roundedStraightBendFirstSurface?.points?.[0]?.[2] || 0) > 1e-6
      || Math.abs((roundedStraightBendLastSurface?.points?.[3]?.[2] || 0) - 8) > 1e-6
      || Math.abs((roundedStraightBendGeometry.panels[0]?.edgeStart?.[2] || 0) - 8) > 1e-6
      || roundedStraightBendStripFaces.length !== expectedRoundedStraightBendSegments * 4
      || roundedStraightBendStripFaces.some((face) => face.hideEdges !== true)
      || roundedStraightBendStripFaces.some((face) => face.bendId !== "bend_on_line" || face.bendFaceRole !== "radius")
      || !roundedStraightBendFlangeFaces.length
      || roundedStraightBendNonBendTaggedFaces.length
      || roundedStraightBendBoundaryLines.length !== 12
      || roundedStraightBendBoundaryCurves.length !== 4
      || roundedStraightBendBoundaryLines.some((line) => line.depthTest === false)
  ) {
    console.error("FAILED: positive plate bend radius should render as one continuous selectable bend strip, expose child bend targets, keep corner relief size independent from bend gap, and avoid legacy relief panel geometry");
    return 1;
  }
  const cornerReliefSketch = sketchFromRectangle(120, 90, "corner_relief_plate");
  const cornerReliefProject = JSON.parse(JSON.stringify(roundedSketchProject));
  cornerReliefProject.objectIndex.corner_relief_plate = { collection: "plates", type: "bent-plate" };
  cornerReliefProject.model.plates.corner_relief_plate = {
    id: "corner_relief_plate",
    type: "bent-plate",
    center: [0, 0, 0],
    normal: [0, 0, 1],
    localAxisY: [1, 0, 0],
    localAxisZ: [0, 1, 0],
    thickness: 8,
    sketch: cornerReliefSketch,
    fabrication: { bends: [] }
  };
  const cornerReliefStore = createProjectStore({ project: cornerReliefProject });
  const cornerReliefEdges = sketchEdges(cornerReliefSketch);
  const cornerReliefFirstProject = cornerReliefStore.upsertPlateBend("corner_relief_plate", {
    id: "corner_relief_bend_1",
    edgeId: cornerReliefEdges[0].id,
    direction: "up",
    angle: 90,
    radius: 8,
    flangeLength: 35
  });
  const cornerReliefFirstPlate = cornerReliefFirstProject.model.plates.corner_relief_plate;
  const cornerReliefFirstGeometry = plateBendGeometry(cornerReliefFirstPlate, settings.render?.curves || {});
  const cornerReliefSecondProject = cornerReliefStore.upsertPlateBend("corner_relief_plate", {
    id: "corner_relief_bend_2",
    edgeId: cornerReliefEdges[1].id,
    direction: "up",
    angle: 90,
    radius: 8,
    flangeLength: 30
  });
  const cornerReliefPlate = cornerReliefSecondProject.model.plates.corner_relief_plate;
  const cornerReliefGeometry = plateBendGeometry(cornerReliefPlate, settings.render?.curves || {});
  const cornerReliefBaseReliefs = plateCornerReliefs(cornerReliefPlate).filter((corner) => (
    corner.scope !== "bend" && corner.vertexId === cornerReliefEdges[0].to
  ));
  const cornerReliefBaseRelief = cornerReliefBaseReliefs[0] || null;
  const cornerReliefScene = buildScene(cornerReliefSecondProject, profiles, fasteners, settings, { renderObjectIds: ["corner_relief_plate"] });
  const cornerReliefOverlay = overlayForPlate(cornerReliefPlate, {
    settings: settings.authoring || {},
    selection: { vertexIds: [cornerReliefEdges[0].to] },
    showRelations: true
  });
  const cornerReliefMarker = cornerReliefOverlay.handles.find((handle) => (
    handle.kind === "plate-corner-relief"
      && handle.objectId === "corner_relief_plate"
      && handle.cornerReliefVertexId === cornerReliefEdges[0].to
  ));
  const cornerReliefSelectableFaces = cornerReliefScene.faces.filter((face) => (
    face.objectId === "corner_relief_plate"
      && face.cornerReliefVertexId === cornerReliefEdges[0].to
      && face.cornerReliefRole === "side"
  ));
  if (
    cornerReliefFirstPlate.fabrication.reliefDefaults
      || cornerReliefFirstGeometry.cornerReliefs?.length
      || !cornerReliefPlate.fabrication.reliefDefaults
      || cornerReliefGeometry.cornerReliefs?.length
      || cornerReliefBaseReliefs.length !== 1
      || cornerReliefBaseRelief?.vertexId !== cornerReliefEdges[0].to
      || !(cornerReliefSelectableFaces.length > 0)
      || cornerReliefSelectableFaces.some((face) => face.collection !== "plates" || face.hideEdges !== true)
      || !cornerReliefMarker
      || cornerReliefMarker.draggable !== false
      || cornerReliefMarker.radius < 10
      || !cornerReliefOverlay.labels.some((label) => label.className?.includes("plate-corner-relief"))
  ) {
    console.error("FAILED: plate corner relief should be created only when adjacent bends form a shared sketch vertex, tag real 3D relief side faces, and expose a selected-plate edit marker");
    return 1;
  }
  const sheetMetalCornerReliefProjectPath = path.join(ROOT, "bobercad", "data", "projects", "sample_sheet_metal_corner_reliefs.json");
  const sheetMetalCornerReliefProject = readJson(sheetMetalCornerReliefProjectPath);
  const sheetMetalCornerReliefProfiles = readJson(path.resolve(path.dirname(sheetMetalCornerReliefProjectPath), sheetMetalCornerReliefProject.libraries.profiles.path));
  const sheetMetalCornerReliefFasteners = readJson(path.resolve(path.dirname(sheetMetalCornerReliefProjectPath), sheetMetalCornerReliefProject.libraries.fasteners.path));
  const circularCornerReliefPlate = sheetMetalCornerReliefProject.model.plates.corner_relief_circular;
  const circularCornerReliefGeometry = plateBendGeometry(circularCornerReliefPlate, settings.render?.curves || {});
  const degeneratePreviewFaces = [];
  for (const target of circularCornerReliefGeometry.targetEdges.filter((edge) => edge.parentBendId)) {
    const previewBend = {
      id: `bend_${target.parentBendId}_${target.parentEdge}`,
      parentBendId: target.parentBendId,
      parentEdge: target.parentEdge,
      direction: "up",
      angle: 90,
      radius: 8,
      kFactor: 0.33,
      flangeLength: 80
    };
    const previewPlate = {
      ...circularCornerReliefPlate,
      display: {
        ...(circularCornerReliefPlate.display || {}),
        opacity: 0.42,
        transparent: true
      },
      fabrication: {
        ...(circularCornerReliefPlate.fabrication || {}),
        bends: [...Object.values(circularCornerReliefPlate.fabrication?.bends || []), previewBend]
      }
    };
    const previewScene = buildScene(sheetMetalCornerReliefProject, sheetMetalCornerReliefProfiles, sheetMetalCornerReliefFasteners, settings, {
      renderObjectIds: [],
      previewPlates: [previewPlate]
    });
    for (const [faceIndex, face] of previewScene.faces.entries()) {
      try {
        faceNormal(face.points);
      } catch (error) {
        degeneratePreviewFaces.push({ targetId: target.id, faceIndex, bendId: face.bendId, message: error.message });
      }
    }
  }
  if (degeneratePreviewFaces.length) {
    console.error(`FAILED: plate bend ghost preview should not emit degenerate faces for generated bend edges: ${JSON.stringify(degeneratePreviewFaces.slice(0, 3))}`);
    return 1;
  }
  const gpuHitBendProject = JSON.parse(JSON.stringify(roundedBendProject));
  const gpuHitBendStore = createProjectStore({ project: gpuHitBendProject });
  let gpuHitBendProjectChange = null;
  let gpuHitBendStatus = "";
  let gpuHitBendOverlay = null;
  let gpuHitBendPreview = null;
  let gpuHitBendPreviewChanges = 0;
  let gpuHitBendToolChanges = 0;
  const gpuHitBendController = createPlateBendController({
    viewer: {
      projectPoint: (point) => ({ x: point[0], y: point[1] }),
      screenScale: () => 1,
      pickScene: () => ({
        point: [0, -40, 0],
        face: { collection: "plates", objectId: "rounded_bend_plate" }
      })
    },
    api: gpuHitBendStore,
    onPreviewChange: (preview) => {
      gpuHitBendPreview = preview;
      gpuHitBendPreviewChanges += 1;
    },
    onOverlayChange: (overlay) => {
      gpuHitBendOverlay = overlay;
    },
    onProjectChange: (nextProject) => {
      gpuHitBendProjectChange = nextProject;
    },
    onStatusChange: (message) => {
      gpuHitBendStatus = message;
    },
    onToolStateChange: () => {
      gpuHitBendToolChanges += 1;
    }
  });
  if (gpuHitBendController.needsPrecisePointerHit?.() !== true) {
    console.error("FAILED: Plate Bend should request precise pointer hits so edge selection gets a 3D point");
    return 1;
  }
  gpuHitBendController.start();
  const gpuHitBendApp = createViewerAppController({
    getCommandController: () => ({ activeCommand: () => gpuHitBendController }),
    getActiveCommandId: () => "model.plateBend.add"
  });
  const gpuHitBendInitialSections = inspectorActiveToolSections({
    command: { id: "model.plateBend.add", title: "Plate Bend" },
    commandState: { active: true, activeCommandId: "model.plateBend.add" },
    toolState: gpuHitBendApp.activeToolState()
  });
  const gpuHitBendInitialProperties = gpuHitBendInitialSections.find((section) => section.label === "Bend Properties");
  if (
    !gpuHitBendInitialProperties?.fields?.some((field) => field.label === "Direction" && field.type === "select" && field.commit?.action === "activeTool.bend.set")
      || !gpuHitBendInitialProperties?.fields?.some((field) => field.label === "Radius" && field.type === "number" && field.commit?.option === "radius")
      || !gpuHitBendInitialProperties?.fields?.some((field) => field.label === "K factor" && field.type === "number" && field.commit?.option === "kFactor")
      || gpuHitBendInitialProperties?.fields?.some((field) => field.label === "Gap")
  ) {
    console.error("FAILED: Plate Bend should expose editable Bend Properties immediately after the command starts without corner relief Gap");
    return 1;
  }
  gpuHitBendApp.setActiveToolOption("direction", "down");
  gpuHitBendApp.setActiveToolOption("angle", 87);
  gpuHitBendApp.setActiveToolOption("radius", 22);
  gpuHitBendApp.setActiveToolOption("kFactor", 0.42);
  gpuHitBendApp.setActiveToolOption("flangeLength", 95);
  const gpuHitBendRejectedGapOption = gpuHitBendApp.setActiveToolOption("gap", 7);
  const gpuHitBendHoverHandled = gpuHitBendController.pointerMove({
    screen: { x: 0, y: -40 },
    hit: { face: { collection: "plates", objectId: "rounded_bend_plate" }, point: [0, -40, 0] },
    event: {}
  });
  const gpuHitBendToolState = gpuHitBendController.toolState?.() || {};
  const gpuHitBendAppToolState = gpuHitBendApp.activeToolState();
  const gpuHitBendSections = inspectorActiveToolSections({
    command: { id: "model.plateBend.add", title: "Plate Bend" },
    commandState: { active: true, activeCommandId: "model.plateBend.add" },
    toolState: gpuHitBendAppToolState
  });
  const gpuHitBendProperties = gpuHitBendSections.find((section) => section.label === "Bend Properties");
  if (
    !gpuHitBendHoverHandled
      || !gpuHitBendOverlay?.lines?.some((line) => line.kind === "plate-bend-target-preview" && line.edgeId === roundedBendLineEdge.id)
      || !gpuHitBendOverlay?.labels?.some((label) => label.className === "plate-bend-target-preview" && label.text === "Bend")
      || gpuHitBendToolChanges < 2
      || gpuHitBendToolState.targetEdgeId !== roundedBendLineEdge.id
      || gpuHitBendRejectedGapOption !== false
      || gpuHitBendToolState.bend?.direction !== "down"
      || gpuHitBendToolState.bend?.angle !== 87
      || gpuHitBendToolState.bend?.radius !== 22
      || gpuHitBendToolState.bend?.kFactor !== 0.42
      || gpuHitBendToolState.bend?.flangeLength !== 95
      || gpuHitBendToolState.bend?.gap !== undefined
      || gpuHitBendAppToolState.targetEdgeId !== roundedBendLineEdge.id
      || !gpuHitBendProperties?.fields?.some((field) => field.label === "Target edge" && String(field.value || "").includes(roundedBendLineEdge.id))
      || !gpuHitBendProperties?.fields?.some((field) => field.label === "Radius" && field.type === "number" && field.value === 22)
      || !gpuHitBendProperties?.fields?.some((field) => field.label === "K factor" && field.type === "number" && field.value === 0.42)
      || gpuHitBendProperties?.fields?.some((field) => field.label === "Gap")
  ) {
    console.error("FAILED: Plate Bend hover should highlight the target edge and expose bend properties to the active tool inspector");
    return 1;
  }
  const gpuHitBendBeginHandled = gpuHitBendController.pointerDown({
    screen: { x: 0, y: -40 },
    hit: { face: { collection: "plates", objectId: "rounded_bend_plate" }, point: null },
    event: {}
  });
  const gpuHitBendPreviewBends = gpuHitBendPreview?.plates?.[0]?.fabrication?.bends || [];
  if (
    !gpuHitBendBeginHandled
      || !gpuHitBendController.active()
      || gpuHitBendProjectChange !== null
      || gpuHitBendPreviewChanges < 1
      || gpuHitBendPreviewBends.length !== 1
      || gpuHitBendPreviewBends[0].edgeId !== roundedBendLineEdge.id
      || gpuHitBendPreviewBends[0].flangeLength !== 95
      || gpuHitBendPreviewBends[0].gap !== undefined
  ) {
    console.error("FAILED: Plate Bend first edge click should start a ghost preview without mutating the project");
    return 1;
  }
  const gpuHitBendTargetLine = gpuHitBendOverlay?.lines?.find((line) => line.kind === "plate-bend-target-preview" && line.edgeId === roundedBendLineEdge.id);
  const gpuHitBendTargetStart = gpuHitBendTargetLine?.points?.[0];
  const gpuHitBendTargetEnd = gpuHitBendTargetLine?.points?.[1];
  const gpuHitBendTargetDx = (gpuHitBendTargetEnd?.[0] || 0) - (gpuHitBendTargetStart?.[0] || 0);
  const gpuHitBendTargetDy = (gpuHitBendTargetEnd?.[1] || 0) - (gpuHitBendTargetStart?.[1] || 0);
  const gpuHitBendTargetLength = Math.hypot(gpuHitBendTargetDx, gpuHitBendTargetDy);
  const gpuHitBendPlacementScreen = {
    x: ((gpuHitBendTargetStart?.[0] || 0) + (gpuHitBendTargetEnd?.[0] || 0)) / 2 - gpuHitBendTargetDy / gpuHitBendTargetLength * 125,
    y: ((gpuHitBendTargetStart?.[1] || 0) + (gpuHitBendTargetEnd?.[1] || 0)) / 2 + gpuHitBendTargetDx / gpuHitBendTargetLength * 125
  };
  const gpuHitBendDragHandled = gpuHitBendController.pointerMove({
    screen: gpuHitBendPlacementScreen,
    hit: null,
    event: {}
  });
  const gpuHitBendDragState = gpuHitBendController.toolState?.() || {};
  const gpuHitBendDragPreviewBends = gpuHitBendPreview?.plates?.[0]?.fabrication?.bends || [];
  if (
    !gpuHitBendDragHandled
      || Math.abs((gpuHitBendDragState.bend?.flangeLength || 0) - 125) > 1e-6
      || gpuHitBendDragState.bend?.direction !== "up"
      || Math.abs((gpuHitBendDragPreviewBends[0]?.flangeLength || 0) - 125) > 1e-6
      || gpuHitBendDragPreviewBends[0]?.direction !== "up"
      || gpuHitBendDragPreviewBends[0]?.gap !== undefined
  ) {
    console.error("FAILED: Plate Bend ghost preview should update flange length and direction from mouse movement");
    return 1;
  }
  const gpuHitBendHandled = gpuHitBendController.pointerDown({
    screen: gpuHitBendPlacementScreen,
    hit: null,
    event: {}
  });
  const gpuHitBends = gpuHitBendProjectChange?.model?.plates?.rounded_bend_plate?.fabrication?.bends || [];
  if (
    !gpuHitBendHandled
      || gpuHitBendController.active()
      || gpuHitBends.length !== 1
      || gpuHitBends[0].edgeId !== roundedBendLineEdge.id
      || gpuHitBends[0].direction !== "up"
      || gpuHitBends[0].angle !== 87
      || gpuHitBends[0].radius !== 22
      || gpuHitBends[0].kFactor !== 0.42
      || gpuHitBends[0].gap !== undefined
      || Math.abs((gpuHitBends[0].flangeLength || 0) - 125) > 1e-6
      || gpuHitBends[0].relief !== undefined
      || !gpuHitBendStatus.includes("No modeling command")
  ) {
    console.error("FAILED: Plate Bend should commit the ghost preview on the second click");
    return 1;
  }
  const arcDirectionStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const arcDirectionSketch = arcDirectionStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcDirectionEdge = sketchEdges(arcDirectionSketch).find((edge) => edge.kind === "circular-arc");
  let arcDirectionOverlay = null;
  let arcDirectionStatus = "";
  const arcDirectionEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        arcDirectionOverlay = overlay;
      },
      screenScale: () => 1
    },
    api: arcDirectionStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcDirectionStatus = message;
    }
  });
  arcDirectionEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcDirectionEdit.selectEntities({ edgeIds: [arcDirectionEdge.id] }, { render: true });
  const arcDirectionHandle = arcDirectionOverlay?.handles?.find((handle) => (
    handle.kind === "plate-sketch-arc-direction" && handle.edgeId === arcDirectionEdge.id
  ));
  const arcDirectionLabel = arcDirectionEdge.direction === "cw" ? "CW" : "CCW";
  if (
    !arcDirectionHandle
      || arcDirectionHandle.draggable !== false
      || arcDirectionHandle.direction !== (arcDirectionEdge.direction === "cw" ? "cw" : "ccw")
      || !String(arcDirectionHandle.hoverLabel || "").includes(arcDirectionLabel)
      || !arcDirectionOverlay.labels.some((label) => label.className === "plate-sketch-arc-direction" && label.text === arcDirectionLabel)
  ) {
    console.error("FAILED: selected circular arcs should expose a visible direction handle and CW/CCW label");
    return 1;
  }
  const flippedFromDirection = arcDirectionEdge.direction;
  const arcDirectionClickResult = arcDirectionEdit.authoringHandler.beginDrag({
    handle: arcDirectionHandle,
    event: { button: 0, detail: 1 },
    modifiers: {}
  });
  const flippedArcDirection = sketchEdges(arcDirectionStore.project().model.sketches.rounded_sketch_arc_demo.sketch)
    .find((edge) => edge.id === arcDirectionEdge.id)?.direction;
  if (arcDirectionClickResult !== true || flippedArcDirection === flippedFromDirection || arcDirectionStatus !== "Plate sketch: arc flipped") {
    console.error("FAILED: clicking the selected arc direction handle should flip the arc and report status");
    return 1;
  }
  let arcEdgeDragOverlay = null;
  let arcEdgeDragStatus = "";
  const arcEdgeDragStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const arcEdgeDragEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        arcEdgeDragOverlay = overlay;
      },
      screenScale: () => 1
    },
    api: arcEdgeDragStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcEdgeDragStatus = message;
    }
  });
  arcEdgeDragEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  const arcEdgeDragBefore = arcEdgeDragStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcEdgeDragBeforeEdge = sketchEdges(arcEdgeDragBefore).find((edge) => edge.kind === "circular-arc");
  const arcEdgeDragHandle = arcEdgeDragOverlay?.handles?.find((handle) => handle.kind === "plate-sketch-edge" && handle.edgeId === arcEdgeDragBeforeEdge?.id);
  if (!arcEdgeDragBeforeEdge || !arcEdgeDragHandle) {
    console.error("FAILED: arc edge drag smoke should expose an edge drag handle for a semantic circular arc");
    return 1;
  }
  arcEdgeDragHandle.dragAxesScreen = {
    x: { unit: { x: 1, y: 0 }, scalePxPerWorld: 1 },
    y: { unit: { x: 0, y: 1 }, scalePxPerWorld: 1 }
  };
  if (!arcEdgeDragEdit.authoringHandler.beginDrag({ handle: arcEdgeDragHandle, event: { button: 0, detail: 1 }, modifiers: {} })) {
    console.error("FAILED: arc edge drag smoke should begin dragging a semantic circular arc edge");
    return 1;
  }
  arcEdgeDragEdit.authoringHandler.drag({ totalDx: 12, totalDy: -8, dx: 12, dy: -8, screen: { x: 0, y: 0 }, event: {} });
  arcEdgeDragEdit.authoringHandler.end();
  const arcEdgeDragAfter = arcEdgeDragStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcEdgeDragAfterEdge = sketchEdges(arcEdgeDragAfter).find((edge) => edge.id === arcEdgeDragBeforeEdge.id);
  if (
    arcEdgeDragAfterEdge?.kind !== "circular-arc"
      || Math.abs(arcEdgeDragAfterEdge.radius - arcEdgeDragBeforeEdge.radius) > 1e-6
      || Math.hypot(
        arcEdgeDragAfterEdge.center[0] - arcEdgeDragBeforeEdge.center[0],
        arcEdgeDragAfterEdge.center[1] - arcEdgeDragBeforeEdge.center[1]
      ) <= 1e-6
      || !arcEdgeDragStatus.startsWith("Plate sketch: arc edge offset ")
  ) {
    console.error("FAILED: whole-edge dragging a semantic circular arc should preserve arc data and report an arc edge offset status");
    return 1;
  }
  let arcInsertDragOverlay = null;
  const arcInsertDragStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const arcInsertDragEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        arcInsertDragOverlay = overlay;
      },
      screenScale: () => 1
    },
    api: arcInsertDragStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue
  });
  arcInsertDragEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  const arcInsertDragBefore = arcInsertDragStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcInsertDragBeforeArc = sketchEdges(arcInsertDragBefore).find((edge) => edge.kind === "circular-arc");
  const arcInsertDragHandle = arcInsertDragOverlay?.handles?.find((handle) => (
    handle.kind === "plate-sketch-insert-vertex" && handle.edgeId === arcInsertDragBeforeArc?.id
  ));
  if (!arcInsertDragBeforeArc || !arcInsertDragHandle) {
    console.error("FAILED: semantic circular arcs should expose a drag-to-insert vertex handle");
    return 1;
  }
  arcInsertDragHandle.dragAxesScreen = {
    x: { unit: { x: 1, y: 0 }, scalePxPerWorld: 1 },
    y: { unit: { x: 0, y: 1 }, scalePxPerWorld: 1 }
  };
  if (!arcInsertDragEdit.authoringHandler.beginDrag({ handle: arcInsertDragHandle, event: { button: 0, detail: 1 }, modifiers: {} })) {
    console.error("FAILED: drag-to-insert vertex should begin from a circular arc insert handle");
    return 1;
  }
  arcInsertDragEdit.authoringHandler.drag({ totalDx: 8, totalDy: 0, dx: 8, dy: 0, screen: { x: 0, y: 0 }, event: {} });
  arcInsertDragEdit.authoringHandler.end();
  const arcInsertDragAfter = arcInsertDragStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcInsertDragChildArcs = sketchEdges(arcInsertDragAfter).filter((edge) => edge.kind === "circular-arc" && edge.authoring?.sourceEdgeId === arcInsertDragBeforeArc.id);
  const arcInsertDragSelection = arcInsertDragEdit.activeState().selection;
  if (
    sketchVertices(arcInsertDragAfter).length !== sketchVertices(arcInsertDragBefore).length + 1
      || sketchEdges(arcInsertDragAfter).length !== sketchEdges(arcInsertDragBefore).length + 1
      || arcInsertDragChildArcs.length !== 2
      || arcInsertDragChildArcs.some((edge) => !Number.isFinite(edge.radius) || edge.radius <= 0 || edge.kind !== "circular-arc")
      || arcInsertDragSelection.vertexIds.length !== 1
      || !sketchVertices(arcInsertDragAfter).some((vertex) => vertex.id === arcInsertDragSelection.vertexIds[0])
  ) {
    console.error("FAILED: dragging a circular arc insert handle should split the arc and select the inserted semantic vertex");
    return 1;
  }
  const lineContourStoreProject = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) }).setSketchOutline("rounded_sketch_arc_demo", {
    outline: [[0, 0], [60, 0], [30, 35]],
    idPrefix: "line_contour_store"
  });
  const lineContourStoreSketch = lineContourStoreProject.model.sketches.rounded_sketch_arc_demo.sketch;
  if (sketchEdges(lineContourStoreSketch).length !== 3 || sketchEdges(lineContourStoreSketch).some((edge) => edge.kind === "circular-arc")) {
    console.error("FAILED: createProjectStore.setSketchOutline should replace a standalone sketch with a closed straight-edge contour");
    return 1;
  }
  const apiRegisterForLineContour = readJson(path.join(ROOT, "bobercad", "app", "engine", "api", "api-register.json"));
  const lineContourApiIds = new Set((apiRegisterForLineContour.apis || []).map((apiSpec) => apiSpec.id));
  if (!lineContourApiIds.has("store.setSketchOutline") || !lineContourApiIds.has("store.setPlateSketchOutline")) {
    console.error("FAILED: api-register should include setSketchOutline and setPlateSketchOutline");
    return 1;
  }
  let diameterCircleOverlay = null;
  let diameterCircleStatus = "";
  const diameterCircleStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const diameterCircleEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        diameterCircleOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: diameterCircleStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      diameterCircleStatus = message;
    }
  });
  diameterCircleEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  if (!diameterCircleEdit.createDiameterCircleSketch() || diameterCircleEdit.activeState().activeSketchTool !== "diameterCircle") {
    console.error("FAILED: createDiameterCircleSketch should start the diameter circle tool");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Diameter Circle should accept the first diameter point");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.pointerMove({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Diameter Circle pointer move should preview the opposite diameter point");
    return 1;
  }
  if (
    !diameterCircleOverlay?.handles?.some((handle) => handle.target === "rounded_sketch_arc_demo:diameter-circle-preview-first")
      || !diameterCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
      || diameterCircleStatus !== "Plate sketch Diameter Circle: pick opposite diameter point"
  ) {
    console.error("FAILED: Diameter Circle should show first-point and sampled runtime-only circle preview after the first point");
    return 1;
  }
  if (
    !diameterCircleEdit.handleKey?.({ key: "Escape", code: "Escape" })
      || diameterCircleEdit.activeState().activeSketchTool
      || diameterCircleStatus !== "Plate sketch: sketch tool cancelled"
      || diameterCircleOverlay?.handles?.some((handle) => handle.target === "rounded_sketch_arc_demo:diameter-circle-preview-first")
      || diameterCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
  ) {
    console.error("FAILED: Diameter Circle Escape should cancel the active round sketch tool and clear its preview before generic viewer cancel runs");
    return 1;
  }
  if (!diameterCircleEdit.createDiameterCircleSketch() || diameterCircleEdit.activeState().activeSketchTool !== "diameterCircle") {
    console.error("FAILED: createDiameterCircleSketch should restart Diameter Circle after Escape cancellation");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Diameter Circle should accept the first diameter point after Escape cancellation");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.pointerMove({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Diameter Circle pointer move should preview again after Escape cancellation");
    return 1;
  }
  if (
    !diameterCircleEdit.handleKey?.({ key: "Backspace", code: "Backspace" })
      || diameterCircleEdit.activeState().activeSketchTool !== "diameterCircle"
      || diameterCircleStatus !== "Plate sketch Diameter Circle: pick first diameter point"
      || diameterCircleOverlay?.handles?.some((handle) => handle.target === "rounded_sketch_arc_demo:diameter-circle-preview-first")
      || diameterCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
  ) {
    console.error("FAILED: Diameter Circle Backspace should clear the first diameter point and keep the tool active");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Diameter Circle should accept the first diameter point before Delete backtracking");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.pointerMove({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Diameter Circle pointer move should preview before Delete backtracking");
    return 1;
  }
  if (
    !diameterCircleEdit.handleKey?.({ key: "Delete", code: "Delete" })
      || diameterCircleEdit.activeState().activeSketchTool !== "diameterCircle"
      || diameterCircleStatus !== "Plate sketch Diameter Circle: pick first diameter point"
      || diameterCircleOverlay?.handles?.some((handle) => handle.target === "rounded_sketch_arc_demo:diameter-circle-preview-first")
      || diameterCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
  ) {
    console.error("FAILED: Diameter Circle Delete should clear the first diameter point before generic object deletion can run");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Diameter Circle should accept the first diameter point again after Backspace");
    return 1;
  }
  if (!diameterCircleEdit.authoringHandler.pointerMove({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Diameter Circle pointer move should preview the opposite diameter point after Backspace");
    return 1;
  }
  if (!diameterCircleEdit.handleKey?.({ key: "Enter", code: "Enter" })) {
    console.error("FAILED: Diameter Circle Enter should accept the current opposite-point preview");
    return 1;
  }
  const diameterCircleSketch = diameterCircleStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const diameterCircleKeys = new Set(sketchVertices(diameterCircleSketch).map((vertex) => pointKey(vertex.point)));
  const diameterCircleArcs = sketchEdges(diameterCircleSketch).filter((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(diameterCircleSketch).length !== 4
      || sketchVertices(diameterCircleSketch).length !== 4
      || diameterCircleArcs.length !== 4
      || !diameterCircleKeys.has(pointKey([80, 0]))
      || !diameterCircleKeys.has(pointKey([40, 40]))
      || !diameterCircleKeys.has(pointKey([0, 0]))
      || !diameterCircleKeys.has(pointKey([40, -40]))
      || !diameterCircleArcs.every((edge) => pointKey(edge.center) === pointKey([40, 0]) && Math.abs(edge.radius - 40) <= 1e-6)
      || !sketchRelations(diameterCircleSketch).some((relation) => relation.type === "radius" && relation.mode === "driven" && Math.abs(relation.value - 40) <= 1e-6)
      || diameterCircleEdit.activeState().activeSketchTool !== "diameterCircle"
      || diameterCircleStatus !== "Plate sketch Diameter Circle: circle diameter 80 mm created; pick first diameter point"
  ) {
    console.error("FAILED: Diameter Circle should create a semantic four-arc circle from two diameter endpoint picks");
    return 1;
  }
  let threePointCircleOverlay = null;
  let threePointCircleStatus = "";
  const threePointCircleStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const threePointCircleEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        threePointCircleOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: threePointCircleStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      threePointCircleStatus = message;
    }
  });
  threePointCircleEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  if (!threePointCircleEdit.createThreePointCircleSketch() || threePointCircleEdit.activeState().activeSketchTool !== "threePointCircle") {
    console.error("FAILED: createThreePointCircleSketch should start the 3 Point Circle tool");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: 3 Point Circle should accept the first point");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.click({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: 3 Point Circle should accept the second point");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.pointerMove({ screen: { x: 40, y: 40 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: 3 Point Circle pointer move should preview the third point");
    return 1;
  }
  if (
    !threePointCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
      || threePointCircleStatus !== "Plate sketch 3 Point Circle: pick third point"
  ) {
    console.error("FAILED: 3 Point Circle should show a sampled runtime-only circle preview after the second point");
    return 1;
  }
  if (
    !threePointCircleEdit.handleKey?.({ key: "Backspace", code: "Backspace" })
      || threePointCircleEdit.activeState().activeSketchTool !== "threePointCircle"
      || threePointCircleStatus !== "Plate sketch 3 Point Circle: pick second point"
      || threePointCircleOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
  ) {
    console.error("FAILED: 3 Point Circle Backspace should clear the second circle point and keep the tool active");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.click({ screen: { x: 80, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: 3 Point Circle should accept the second point again after Backspace");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.pointerMove({ screen: { x: 40, y: 40 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: 3 Point Circle pointer move should preview the third point again after Backspace");
    return 1;
  }
  if (!threePointCircleEdit.authoringHandler.click({ screen: { x: 40, y: 40 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: 3 Point Circle should accept the third point");
    return 1;
  }
  const threePointCircleSketch = threePointCircleStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const threePointCircleKeys = new Set(sketchVertices(threePointCircleSketch).map((vertex) => pointKey(vertex.point)));
  const threePointCircleArcs = sketchEdges(threePointCircleSketch).filter((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(threePointCircleSketch).length !== 4
      || sketchVertices(threePointCircleSketch).length !== 4
      || threePointCircleArcs.length !== 4
      || !threePointCircleKeys.has(pointKey([80, 0]))
      || !threePointCircleKeys.has(pointKey([40, 40]))
      || !threePointCircleKeys.has(pointKey([0, 0]))
      || !threePointCircleKeys.has(pointKey([40, -40]))
      || !threePointCircleArcs.every((edge) => pointKey(edge.center) === pointKey([40, 0]) && Math.abs(edge.radius - 40) <= 1e-6)
      || !sketchRelations(threePointCircleSketch).some((relation) => relation.type === "radius" && relation.mode === "driven" && Math.abs(relation.value - 40) <= 1e-6)
      || threePointCircleEdit.activeState().activeSketchTool !== "threePointCircle"
      || threePointCircleStatus !== "Plate sketch 3 Point Circle: circle radius 40 mm created; pick first point"
  ) {
    console.error("FAILED: 3 Point Circle should create a semantic four-arc circle through three picked points");
    return 1;
  }
  let collinearThreePointCircleStatus = "";
  const collinearThreePointCircleStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const collinearThreePointCircleEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: collinearThreePointCircleStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      collinearThreePointCircleStatus = message;
    }
  });
  collinearThreePointCircleEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  collinearThreePointCircleEdit.createThreePointCircleSketch();
  for (const point of [[0, 0], [80, 0], [40, 0]]) {
    if (!collinearThreePointCircleEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: 3 Point Circle collinear setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const collinearThreePointCircleSketch = collinearThreePointCircleStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(collinearThreePointCircleSketch).length !== sketchEdges(roundedSketchProject.model.sketches.rounded_sketch_arc_demo.sketch).length
      || collinearThreePointCircleEdit.activeState().activeSketchTool !== "threePointCircle"
      || collinearThreePointCircleStatus !== "Plate sketch 3 Point Circle: points must not be collinear"
  ) {
    console.error("FAILED: 3 Point Circle should reject collinear points without replacing the stored sketch");
    return 1;
  }
  let centerSlotOverlay = null;
  let centerSlotStatus = "";
  const centerSlotStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const centerSlotEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        centerSlotOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: centerSlotStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      centerSlotStatus = message;
    }
  });
  centerSlotEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  if (!centerSlotEdit.createCenterSlotSketch() || centerSlotEdit.activeState().activeSketchTool !== "centerSlot") {
    console.error("FAILED: createCenterSlotSketch should start the center slot tool");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Center Slot should accept the center point");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.pointerMove({ screen: { x: 40, y: 0 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Center Slot pointer move should preview the end-center axis");
    return 1;
  }
  if (
    !centerSlotOverlay?.handles?.some((handle) => handle.target === "rounded_sketch_arc_demo:center-slot-preview-center")
      || !centerSlotOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview")
      || centerSlotStatus !== "Plate sketch Center Slot: pick end-center point"
  ) {
    console.error("FAILED: Center Slot should show a center handle and axis preview after the first point");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.click({ screen: { x: 40, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Center Slot should accept the end-center axis point");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.pointerMove({ screen: { x: 40, y: 10 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Center Slot pointer move should preview the slot radius");
    return 1;
  }
  if (!centerSlotOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)) {
    console.error("FAILED: Center Slot should render a sampled runtime-only slot preview after the axis point");
    return 1;
  }
  if (
    !centerSlotEdit.handleKey?.({ key: "Backspace", code: "Backspace" })
      || centerSlotEdit.activeState().activeSketchTool !== "centerSlot"
      || centerSlotStatus !== "Plate sketch Center Slot: pick end-center point"
      || centerSlotOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview" && line.points.length > 4)
  ) {
    console.error("FAILED: Center Slot Backspace should clear the end-center point and keep the tool active");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.click({ screen: { x: 40, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Center Slot should accept the end-center axis point again after Backspace");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.pointerMove({ screen: { x: 40, y: 10 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Center Slot pointer move should preview the slot radius again after Backspace");
    return 1;
  }
  if (!centerSlotEdit.authoringHandler.click({ screen: { x: 40, y: 10 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Center Slot should accept the radius point");
    return 1;
  }
  const centerSlotSketch = centerSlotStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const centerSlotKeys = new Set(sketchVertices(centerSlotSketch).map((vertex) => pointKey(vertex.point)));
  const centerSlotArcs = sketchEdges(centerSlotSketch).filter((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(centerSlotSketch).length !== 4
      || sketchVertices(centerSlotSketch).length !== 4
      || centerSlotArcs.length !== 2
      || !centerSlotKeys.has(pointKey([-40, -10]))
      || !centerSlotKeys.has(pointKey([40, -10]))
      || !centerSlotKeys.has(pointKey([40, 10]))
      || !centerSlotKeys.has(pointKey([-40, 10]))
      || !centerSlotArcs.every((edge) => Math.abs(edge.radius - 10) <= 1e-6)
      || !sketchRelations(centerSlotSketch).some((relation) => relation.type === "radius" && relation.mode === "driven" && Math.abs(relation.value - 10) <= 1e-6)
      || !sketchRelations(centerSlotSketch).some((relation) => relation.type === "equal-radius")
      || sketchRelations(centerSlotSketch).filter((relation) => relation.type === "tangent").length !== 4
      || centerSlotEdit.activeState().activeSketchTool !== "centerSlot"
      || centerSlotStatus !== "Plate sketch Center Slot: slot length 100 mm radius 10 mm created; pick center point"
  ) {
    console.error("FAILED: Center Slot should create a semantic rounded slot from center, end-center, and radius picks");
    return 1;
  }
  let lineContourOverlay = null;
  let lineContourStatus = "";
  const lineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const lineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        lineContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: lineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      lineContourStatus = message;
    }
  });
  if (!lineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: Line Contour smoke should select the standalone rounded sketch");
    return 1;
  }
  if (!lineContourEdit.createLineContourSketch() || lineContourEdit.activeState().activeSketchTool !== "lineContour") {
    console.error("FAILED: createLineContourSketch should start a distinct line contour tool");
    return 1;
  }
  for (const point of [[0, 0], [60, 0]]) {
    if (!lineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Line Contour click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!lineContourEdit.authoringHandler.pointerMove({ screen: { x: 30, y: 35 }, event: { button: 0, detail: 0 } })) {
    console.error("FAILED: Line Contour pointer move should preview the third contour point");
    return 1;
  }
  if (!lineContourEdit.handleKey?.({ key: "Enter", code: "Enter" })) {
    console.error("FAILED: Line Contour Enter should accept the current preview point");
    return 1;
  }
  const lineContourResult = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (sketchEdges(lineContourResult).length !== 3 || sketchEdges(lineContourResult).some((edge) => edge.kind === "circular-arc")) {
    console.error("FAILED: interactive Line Contour should create a closed three-edge straight contour");
    return 1;
  }
  const lineContourState = lineContourEdit.activeState();
  if (
    lineContourState.activeSketchTool !== "lineContour"
      || lineContourState.selection.edgeIds.length !== 1
      || !lineContourStatus.includes("latest segment selected")
      || !lineContourOverlay
  ) {
    console.error("FAILED: interactive Line Contour should stay active, select the latest contour segment, report status, and refresh overlay");
    return 1;
  }
  const lineContourDuplicatePointBefore = JSON.stringify(lineContourStore.project());
  if (!lineContourEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour duplicate existing-point click should be handled");
    return 1;
  }
  const lineContourDuplicatePointAfter = JSON.stringify(lineContourStore.project());
  const lineContourDuplicatePointSketch = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const lineContourDuplicatePointCounts = sketchVertices(lineContourDuplicatePointSketch).reduce((counts, vertex) => {
    counts.set(pointKey(vertex.point), (counts.get(pointKey(vertex.point)) || 0) + 1);
    return counts;
  }, new Map());
  if (
    lineContourDuplicatePointAfter !== lineContourDuplicatePointBefore
      || lineContourDuplicatePointCounts.get(pointKey([0, 0])) !== 1
      || sketchEdges(lineContourDuplicatePointSketch).length !== 3
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || lineContourStatus !== "Plate sketch Line Contour: point must differ from existing contour points"
  ) {
    console.error("FAILED: Line Contour should reject appending an existing contour point without mutating the sketch");
    return 1;
  }
  let lineContourEscapeOverlay = null;
  let lineContourEscapeStatus = "";
  const lineContourEscapeStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const lineContourEscapeProjectBefore = JSON.stringify(lineContourEscapeStore.project());
  const lineContourEscapeEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        lineContourEscapeOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: lineContourEscapeStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      lineContourEscapeStatus = message;
    }
  });
  lineContourEscapeEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  lineContourEscapeEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!lineContourEscapeEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Line Contour Escape setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (
    !lineContourEscapeEdit.authoringHandler.click({
      screen: { x: 30, y: 20 },
      event: { button: 0, detail: 1, altKey: true },
      modifiers: { altKey: true }
    })
      || lineContourEscapeEdit.activeState().activeSketchTool !== "lineContour"
      || !lineContourEscapeOverlay?.lines?.some((line) => String(line.kind || "").startsWith("plate-sketch-tool-preview"))
      || !lineContourEscapeStatus.includes("first segment arc staged")
  ) {
    console.error("FAILED: Line Contour Escape setup should stage a first-segment arc preview");
    return 1;
  }
  if (
    !lineContourEscapeEdit.handleKey?.({ key: "Escape", code: "Escape" })
      || lineContourEscapeEdit.activeState().activeSketchTool
      || lineContourEscapeEdit.activeState().selection.edgeIds.length
      || lineContourEscapeEdit.activeState().selection.vertexIds.length
      || lineContourEscapeStatus !== "Plate sketch: sketch tool cancelled"
      || JSON.stringify(lineContourEscapeStore.project()) !== lineContourEscapeProjectBefore
      || lineContourEscapeOverlay?.lines?.some((line) => String(line.kind || "").startsWith("plate-sketch-tool-preview"))
      || lineContourEscapeOverlay?.handles?.some((handle) => String(handle.kind || "").startsWith("plate-sketch-tool-preview"))
  ) {
    console.error("FAILED: Line Contour Escape should cancel staged arc authoring, clear preview/selection, and leave project JSON unchanged");
    return 1;
  }
  if (!lineContourEscapeEdit.createLineContourSketch() || lineContourEscapeEdit.activeState().activeSketchTool !== "lineContour") {
    console.error("FAILED: Line Contour should restart after Escape cancellation");
    return 1;
  }
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!lineContourEscapeEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Line Contour should accept point ${point.join(",")} after Escape cancellation`);
      return 1;
    }
  }
  const lineContourEscapeRestartSketch = lineContourEscapeStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(lineContourEscapeRestartSketch).length !== 3
      || sketchEdges(lineContourEscapeRestartSketch).some((edge) => edge.kind === "circular-arc")
      || lineContourEscapeEdit.activeState().activeSketchTool !== "lineContour"
      || !lineContourEscapeStatus.includes("3-point contour created")
  ) {
    console.error("FAILED: Line Contour should create a clean replacement contour after Escape cancellation");
    return 1;
  }
  let backtrackLineContourStatus = "";
  const backtrackLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const backtrackLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: backtrackLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      backtrackLineContourStatus = message;
    }
  });
  backtrackLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  backtrackLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!backtrackLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: backtrack Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!backtrackLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: backtrack Line Contour should stage the first segment arc");
    return 1;
  }
  if (!backtrackLineContourEdit.removeSelectedSketchEntity() || backtrackLineContourStatus !== "Plate sketch Line Contour: first segment arc unstaged; pick third point") {
    console.error("FAILED: Sketch Delete should clear a staged first Line Contour arc before removing contour points");
    return 1;
  }
  if (!backtrackLineContourEdit.removeSelectedSketchEntity() || !backtrackLineContourStatus.includes("pick second point")) {
    console.error("FAILED: Sketch Delete should backtrack the second uncommitted Line Contour point");
    return 1;
  }
  for (const point of [[80, 0], [40, 35]]) {
    if (!backtrackLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: backtracked Line Contour should accept replacement point ${point.join(",")}`);
      return 1;
    }
  }
  const backtrackedLineContourSketch = backtrackLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const backtrackedVertexKeys = new Set(sketchVertices(backtrackedLineContourSketch).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(backtrackedLineContourSketch).length !== 3
      || sketchEdges(backtrackedLineContourSketch).some((edge) => edge.kind === "circular-arc")
      || !backtrackedVertexKeys.has(pointKey([80, 0]))
      || backtrackedVertexKeys.has(pointKey([60, 0]))
      || backtrackLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !backtrackLineContourStatus.includes("3-point contour created")
  ) {
    console.error("FAILED: backtracked Line Contour should commit the replacement straight contour without the unstaged arc");
    return 1;
  }
  let thirdPointBacktrackStatus = "";
  const thirdPointBacktrackStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const thirdPointBacktrackEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: thirdPointBacktrackStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      thirdPointBacktrackStatus = message;
    }
  });
  thirdPointBacktrackEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  thirdPointBacktrackEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!thirdPointBacktrackEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: third-point backtrack Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!thirdPointBacktrackEdit.removeSelectedSketchEntity() || thirdPointBacktrackStatus !== "Plate sketch Line Contour: backtracked third point; pick replacement third point") {
    console.error("FAILED: Line Contour Delete should backtrack the committed third point into replacement-third-point mode");
    return 1;
  }
  if (thirdPointBacktrackEdit.activeState().activeSketchTool !== "lineContour" || thirdPointBacktrackEdit.activeState().selection.edgeIds.length) {
    console.error("FAILED: third-point Line Contour backtrack should keep the tool active and clear latest-edge selection");
    return 1;
  }
  if (!thirdPointBacktrackEdit.authoringHandler.click({ screen: { x: 35, y: 45 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: third-point backtracked Line Contour should accept a replacement third point");
    return 1;
  }
  const thirdPointBacktrackSketch = thirdPointBacktrackStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const thirdPointBacktrackVertexKeys = new Set(sketchVertices(thirdPointBacktrackSketch).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(thirdPointBacktrackSketch).length !== 3
      || !thirdPointBacktrackVertexKeys.has(pointKey([35, 45]))
      || thirdPointBacktrackVertexKeys.has(pointKey([30, 35]))
      || thirdPointBacktrackEdit.activeState().activeSketchTool !== "lineContour"
      || !thirdPointBacktrackStatus.includes("3-point contour created")
  ) {
    console.error("FAILED: replacement third point should replace the previous committed three-point Line Contour outline");
    return 1;
  }
  let firstArcThirdBacktrackStatus = "";
  const firstArcThirdBacktrackStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const firstArcThirdBacktrackEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: firstArcThirdBacktrackStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      firstArcThirdBacktrackStatus = message;
    }
  });
  firstArcThirdBacktrackEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  firstArcThirdBacktrackEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!firstArcThirdBacktrackEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: first-arc third-point replacement setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!firstArcThirdBacktrackEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: first-arc third-point replacement setup should stage the first arc");
    return 1;
  }
  if (!firstArcThirdBacktrackEdit.authoringHandler.click({ screen: { x: 30, y: 35 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: first-arc third-point replacement setup should commit the first rounded contour");
    return 1;
  }
  if (!firstArcThirdBacktrackEdit.removeSelectedSketchEntity() || firstArcThirdBacktrackStatus !== "Plate sketch Line Contour: backtracked third point with first arc; pick replacement third point") {
    console.error("FAILED: Line Contour Delete should backtrack the committed third point while preserving the first arc staging");
    return 1;
  }
  if (!firstArcThirdBacktrackEdit.authoringHandler.click({ screen: { x: 35, y: 45 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: first-arc third-point replacement should accept a replacement third point");
    return 1;
  }
  const firstArcThirdBacktrackSketch = firstArcThirdBacktrackStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const firstArcThirdBacktrackArc = sketchEdges(firstArcThirdBacktrackSketch).find((edge) => edge.kind === "circular-arc");
  const firstArcThirdBacktrackVertices = new Map(sketchVertices(firstArcThirdBacktrackSketch).map((vertex) => [vertex.id, vertex]));
  const firstArcThirdEndpointKeys = firstArcThirdBacktrackArc
    ? [firstArcThirdBacktrackVertices.get(firstArcThirdBacktrackArc.from)?.point, firstArcThirdBacktrackVertices.get(firstArcThirdBacktrackArc.to)?.point].map(pointKey).sort()
    : [];
  const firstArcThirdVertexKeys = new Set(sketchVertices(firstArcThirdBacktrackSketch).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(firstArcThirdBacktrackSketch).length !== 3
      || sketchEdges(firstArcThirdBacktrackSketch).filter((edge) => edge.kind === "circular-arc").length !== 1
      || firstArcThirdEndpointKeys.join("|") !== [[0, 0], [60, 0]].map(pointKey).sort().join("|")
      || !firstArcThirdVertexKeys.has(pointKey([35, 45]))
      || firstArcThirdVertexKeys.has(pointKey([30, 35]))
      || !firstArcThirdBacktrackStatus.includes("3-point contour created with first arc")
  ) {
    console.error("FAILED: replacing the third point of a first-arc Line Contour should preserve the semantic first arc");
    return 1;
  }
  let firstArcLineContourOverlay = null;
  let firstArcLineContourStatus = "";
  const firstArcLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const firstArcLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        firstArcLineContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: firstArcLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      firstArcLineContourStatus = message;
    }
  });
  firstArcLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  firstArcLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!firstArcLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: first-arc Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!firstArcLineContourEdit.authoringHandler.pointerMove({
    screen: { x: 30, y: 20 },
    event: { altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: Alt Line Contour pointer move should preview the uncommitted first segment arc");
    return 1;
  }
  if (!firstArcLineContourOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview-arc" && line.points.length >= 3)) {
    console.error("FAILED: Alt Line Contour first-segment pointer move should render a sampled arc preview");
    return 1;
  }
  if (!firstArcLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: Alt-click should stage the first Line Contour segment as an arc before contour creation");
    return 1;
  }
  if (
    firstArcLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !firstArcLineContourStatus.includes("first segment arc staged")
  ) {
    console.error("FAILED: first-segment Alt-click should keep Line Contour active and report a staged arc");
    return 1;
  }
  if (!firstArcLineContourEdit.authoringHandler.pointerMove({
    screen: { x: 30, y: 35 },
    event: {},
    modifiers: {}
  })) {
    console.error("FAILED: Line Contour third-point pointer move should stay active after first arc staging");
    return 1;
  }
  if (
    !firstArcLineContourOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview-arc" && line.points.length >= 3)
      || !firstArcLineContourStatus.includes("with first arc")
  ) {
    console.error("FAILED: Line Contour should keep the staged first arc preview visible while picking the third point");
    return 1;
  }
  if (!firstArcLineContourEdit.authoringHandler.click({ screen: { x: 30, y: 35 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour third click should commit a contour with the staged first arc");
    return 1;
  }
  const firstArcLineContourResult = firstArcLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const firstArcLineContourEdges = sketchEdges(firstArcLineContourResult);
  const firstArcLineContourArc = firstArcLineContourEdges.find((edge) => edge.kind === "circular-arc");
  const firstArcLineContourVertices = new Map(sketchVertices(firstArcLineContourResult).map((vertex) => [vertex.id, vertex]));
  const firstArcEndpointKeys = firstArcLineContourArc
    ? [firstArcLineContourVertices.get(firstArcLineContourArc.from)?.point, firstArcLineContourVertices.get(firstArcLineContourArc.to)?.point].map(pointKey).sort()
    : [];
  if (
    firstArcLineContourEdges.length !== 3
      || firstArcLineContourEdges.filter((edge) => edge.kind === "circular-arc").length !== 1
      || firstArcEndpointKeys.join("|") !== [[0, 0], [60, 0]].map(pointKey).sort().join("|")
      || !firstArcLineContourStatus.includes("3-point contour created with first arc")
      || firstArcLineContourEdit.activeState().activeSketchTool !== "lineContour"
  ) {
    console.error("FAILED: Line Contour should commit the staged first segment as one semantic circular arc");
    return 1;
  }
  if (!lineContourEdit.convertSelectedEdgeToArc() || lineContourEdit.activeState().activeSketchTool !== "edgeArc") {
    console.error("FAILED: Line Contour's latest selected segment should immediately start Edge Arc conversion");
    return 1;
  }
  if (!lineContourEdit.authoringHandler.click({ screen: { x: 60, y: 35 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Edge Arc should accept a through point for the latest Line Contour segment");
    return 1;
  }
  const mixedLineArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (sketchEdges(mixedLineArcContour).length !== 3 || sketchEdges(mixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1) {
    console.error("FAILED: Line Contour followed by Edge Arc should create one mixed line/arc contour");
    return 1;
  }
  if (lineContourEdit.activeState().activeSketchTool !== "lineContour" || !lineContourStatus.includes("arc segment created radius")) {
    console.error("FAILED: Edge Arc invoked from Line Contour should resume the Line Contour tool after creating the arc");
    return 1;
  }
  const edgeArcCreatedArc = sketchEdges(mixedLineArcContour).find((edge) => edge.kind === "circular-arc");
  if (!lineContourEdit.convertSelectedEdgeToArc() || lineContourEdit.activeState().activeSketchTool !== "edgeArc") {
    console.error("FAILED: Edge Arc should restart from a selected existing circular arc");
    return 1;
  }
  if (!lineContourEdit.authoringHandler.click({ screen: { x: 55, y: 45 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Edge Arc should accept a replacement through point for an existing circular arc");
    return 1;
  }
  const updatedEdgeArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const edgeArcUpdatedArc = sketchEdges(updatedEdgeArcContour).find((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(updatedEdgeArcContour).length !== 3
      || sketchEdges(updatedEdgeArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !edgeArcCreatedArc
      || !edgeArcUpdatedArc
      || Math.abs(edgeArcUpdatedArc.radius - edgeArcCreatedArc.radius) <= 1e-6
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || lineContourEdit.activeState().selection.edgeIds.length !== 1
      || !lineContourStatus.includes("arc segment updated radius")
  ) {
    console.error("FAILED: Edge Arc should update a selected existing circular arc in place and resume Line Contour");
    return 1;
  }
  if (!lineContourEdit.flipSelectedArc()) {
    console.error("FAILED: Flip Arc should flip the selected Line Contour arc while the contour tool is active");
    return 1;
  }
  const flippedEdgeArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const edgeArcFlippedArc = sketchEdges(flippedEdgeArcContour).find((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(flippedEdgeArcContour).length !== 3
      || sketchEdges(flippedEdgeArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !edgeArcFlippedArc
      || edgeArcFlippedArc.direction === edgeArcUpdatedArc.direction
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || lineContourEdit.activeState().selection.edgeIds.length !== 1
      || lineContourStatus !== "Plate sketch Line Contour: arc flipped; pick next point"
  ) {
    console.error("FAILED: Flip Arc should preserve active Line Contour state and select the flipped arc");
    return 1;
  }
  let splitLineContourStatus = "";
  const splitLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const splitLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: splitLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      splitLineContourStatus = message;
    }
  });
  splitLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  splitLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!splitLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: split-resume Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!splitLineContourEdit.convertSelectedEdgeToArc() || !splitLineContourEdit.authoringHandler.click({ screen: { x: 60, y: 35 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: split-resume Line Contour setup should create one latest arc");
    return 1;
  }
  if (!splitLineContourEdit.splitSelectedArc()) {
    console.error("FAILED: Split Arc should split the latest Line Contour arc while the contour tool is active");
    return 1;
  }
  const splitLineContourSketch = splitLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const splitInsertedVertexKeys = new Set(sketchVertices(splitLineContourSketch)
    .map((vertex) => pointKey(vertex.point))
    .filter((key) => !new Set([[0, 0], [60, 0], [30, 35]].map(pointKey)).has(key)));
  if (
    sketchEdges(splitLineContourSketch).length !== 4
      || sketchVertices(splitLineContourSketch).length !== 4
      || sketchEdges(splitLineContourSketch).filter((edge) => edge.kind === "circular-arc").length !== 2
      || splitLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || splitInsertedVertexKeys.size !== 1
      || splitLineContourStatus !== "Plate sketch Line Contour: arc split; pick next point"
  ) {
    console.error("FAILED: Split Arc should add one contour point, preserve two semantic arcs, and keep Line Contour active");
    return 1;
  }
  if (!splitLineContourEdit.authoringHandler.click({ screen: { x: 0, y: 50 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should accept the next point after splitting the latest arc");
    return 1;
  }
  const splitExtendedLineContour = splitLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const splitExtendedVertexKeys = new Set(sketchVertices(splitExtendedLineContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(splitExtendedLineContour).length !== 5
      || sketchVertices(splitExtendedLineContour).length !== 5
      || sketchEdges(splitExtendedLineContour).filter((edge) => edge.kind === "circular-arc").length !== 2
      || ![...splitInsertedVertexKeys].every((key) => splitExtendedVertexKeys.has(key))
      || splitLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !splitLineContourStatus.includes("5-point contour created")
  ) {
    console.error("FAILED: Line Contour should preserve a split arc point and both semantic arcs when extending after Split Arc");
    return 1;
  }
  let splitClosingLineContourStatus = "";
  const splitClosingLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const splitClosingLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: splitClosingLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      splitClosingLineContourStatus = message;
    }
  });
  splitClosingLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  splitClosingLineContourEdit.createLineContourSketch();
  const splitClosingBasePoints = [[0, 0], [60, 0], [30, 35]];
  for (const point of splitClosingBasePoints) {
    if (!splitClosingLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: closing split-resume Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const splitClosingBaseSketch = splitClosingLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const splitClosingBaseVertices = new Map(sketchVertices(splitClosingBaseSketch).map((vertex) => [vertex.id, vertex]));
  const splitClosingEdge = sketchEdges(splitClosingBaseSketch).find((edge) => (
    pointKey(splitClosingBaseVertices.get(edge.from)?.point || []) === pointKey([30, 35])
      && pointKey(splitClosingBaseVertices.get(edge.to)?.point || []) === pointKey([0, 0])
  ));
  if (!splitClosingEdge) {
    console.error("FAILED: closing split-resume Line Contour setup should expose the closing contour edge");
    return 1;
  }
  splitClosingLineContourEdit.selectEntities({ edgeIds: [splitClosingEdge.id] }, { sketchMode: "relations" });
  if (!splitClosingLineContourEdit.convertSelectedEdgeToArc() || !splitClosingLineContourEdit.authoringHandler.click({ screen: { x: 0, y: 35 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: closing split-resume Line Contour setup should create an arc on the closing edge");
    return 1;
  }
  if (!splitClosingLineContourEdit.splitSelectedArc()) {
    console.error("FAILED: Split Arc should split the closing Line Contour arc while the contour tool is active");
    return 1;
  }
  const splitClosingLineContourSketch = splitClosingLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const splitClosingBasePointKeys = new Set(splitClosingBasePoints.map(pointKey));
  const splitClosingInsertedVertexKeys = new Set(sketchVertices(splitClosingLineContourSketch)
    .map((vertex) => pointKey(vertex.point))
    .filter((key) => !splitClosingBasePointKeys.has(key)));
  if (
    sketchEdges(splitClosingLineContourSketch).length !== 4
      || sketchVertices(splitClosingLineContourSketch).length !== 4
      || sketchEdges(splitClosingLineContourSketch).filter((edge) => edge.kind === "circular-arc").length !== 2
      || splitClosingLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || splitClosingInsertedVertexKeys.size !== 1
      || splitClosingLineContourStatus !== "Plate sketch Line Contour: arc split; pick next point"
  ) {
    console.error("FAILED: Split Arc should add one point to the closing contour arc and keep Line Contour active");
    return 1;
  }
  if (!splitClosingLineContourEdit.authoringHandler.click({ screen: { x: -20, y: 20 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should accept the next point after splitting the closing arc");
    return 1;
  }
  const splitClosingExtendedLineContour = splitClosingLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const splitClosingExtendedVertexKeys = new Set(sketchVertices(splitClosingExtendedLineContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(splitClosingExtendedLineContour).length !== 5
      || sketchVertices(splitClosingExtendedLineContour).length !== 5
      || sketchEdges(splitClosingExtendedLineContour).filter((edge) => edge.kind === "circular-arc").length !== 2
      || ![...splitClosingInsertedVertexKeys].every((key) => splitClosingExtendedVertexKeys.has(key))
      || splitClosingLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !splitClosingLineContourStatus.includes("5-point contour created")
  ) {
    console.error("FAILED: Line Contour should preserve both closing-arc split halves when extending after Split Arc");
    return 1;
  }
  if (!lineContourEdit.authoringHandler.click({ screen: { x: 0, y: 50 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: resumed Line Contour should accept the next point after an arc segment");
    return 1;
  }
  const extendedMixedLineArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const extendedMixedLineArc = sketchEdges(extendedMixedLineArcContour).find((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(extendedMixedLineArcContour).length !== 4
      || sketchEdges(extendedMixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || extendedMixedLineArc?.direction !== edgeArcFlippedArc.direction
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || lineContourEdit.activeState().selection.edgeIds.length !== 1
      || !lineContourStatus.includes("4-point contour created")
  ) {
    console.error("FAILED: resumed Line Contour should extend the contour while preserving the existing arc segment and latest-edge selection");
    return 1;
  }
  if (!lineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should backtrack an already committed extra contour point");
    return 1;
  }
  const backtrackedMixedLineArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(backtrackedMixedLineArcContour).length !== 3
      || sketchEdges(backtrackedMixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || sketchVertices(backtrackedMixedLineArcContour).some((vertex) => pointKey(vertex.point) === pointKey([0, 50]))
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || lineContourEdit.activeState().selection.edgeIds.length !== 1
      || !lineContourStatus.includes("reverted to 3-point contour")
  ) {
    console.error("FAILED: Line Contour Delete should revert the committed contour to the previous point chain while preserving surviving arc segments");
    return 1;
  }
  if (!lineContourEdit.authoringHandler.click({ screen: { x: 10, y: 55 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: backtracked Line Contour should accept a replacement committed point");
    return 1;
  }
  const reextendedMixedLineArcContour = lineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(reextendedMixedLineArcContour).length !== 4
      || sketchEdges(reextendedMixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !sketchVertices(reextendedMixedLineArcContour).some((vertex) => pointKey(vertex.point) === pointKey([10, 55]))
      || lineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !lineContourStatus.includes("4-point contour created")
  ) {
    console.error("FAILED: backtracked Line Contour should re-extend with a replacement point while preserving surviving arcs");
    return 1;
  }
  let keyBacktrackLineContourStatus = "";
  const keyBacktrackLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const keyBacktrackLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: keyBacktrackLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      keyBacktrackLineContourStatus = message;
    }
  });
  keyBacktrackLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  keyBacktrackLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!keyBacktrackLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: key-backtrack Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!keyBacktrackLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: key-backtrack Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!keyBacktrackLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: key-backtrack Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!keyBacktrackLineContourEdit.handleKey?.({ key: "Delete", code: "Delete" })) {
    console.error("FAILED: Line Contour Delete key should backtrack the committed latest point before generic object deletion");
    return 1;
  }
  const keyBacktrackedLineContour = keyBacktrackLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const keyBacktrackedPointKeys = new Set(sketchVertices(keyBacktrackedLineContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(keyBacktrackedLineContour).length !== 3
      || sketchEdges(keyBacktrackedLineContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || keyBacktrackedPointKeys.has(pointKey([0, 50]))
      || !keyBacktrackedPointKeys.has(pointKey([30, 35]))
      || keyBacktrackLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || keyBacktrackLineContourEdit.activeState().selection.edgeIds.length !== 1
      || keyBacktrackLineContourStatus !== "Plate sketch Line Contour: reverted to 3-point contour; latest segment selected"
  ) {
    console.error("FAILED: Line Contour Delete key should revert the latest committed point, preserve the semantic arc, and keep Line Contour active");
    return 1;
  }
  if (!keyBacktrackLineContourEdit.authoringHandler.click({ screen: { x: 10, y: 55 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: key-backtracked Line Contour should accept a replacement latest point");
    return 1;
  }
  const keyBacktrackedReextendedContour = keyBacktrackLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(keyBacktrackedReextendedContour).length !== 4
      || sketchEdges(keyBacktrackedReextendedContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !sketchVertices(keyBacktrackedReextendedContour).some((vertex) => pointKey(vertex.point) === pointKey([10, 55]))
      || keyBacktrackLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !keyBacktrackLineContourStatus.includes("4-point contour created")
  ) {
    console.error("FAILED: key-backtracked Line Contour should re-extend from the replacement point while preserving the semantic arc");
    return 1;
  }
  let selectedPointDeleteLineContourStatus = "";
  const selectedPointDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedPointDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedPointDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedPointDeleteLineContourStatus = message;
    }
  });
  selectedPointDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedPointDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedPointDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-point delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedPointDeleteLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-point delete Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedPointDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-point delete Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedPointDeleteBefore = selectedPointDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedPointDeleteVertex = sketchVertices(selectedPointDeleteBefore).find((vertex) => pointKey(vertex.point) === pointKey([30, 35]));
  if (!selectedPointDeleteVertex) {
    console.error("FAILED: selected-point delete Line Contour setup should contain the removable middle point");
    return 1;
  }
  selectedPointDeleteLineContourEdit.selectEntities({ vertexIds: [selectedPointDeleteVertex.id] }, { sketchMode: "relations" });
  if (!selectedPointDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected non-latest committed contour point");
    return 1;
  }
  const selectedPointDeleteContour = selectedPointDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedPointDeleteKeys = new Set(sketchVertices(selectedPointDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedPointDeleteContour).length !== 3
      || sketchEdges(selectedPointDeleteContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedPointDeleteKeys.has(pointKey([30, 35]))
      || !selectedPointDeleteKeys.has(pointKey([0, 50]))
      || selectedPointDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedPointDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedPointDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected point; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should remove a selected earlier point, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let selectedArcSplitPointDeleteLineContourStatus = "";
  const selectedArcSplitPointDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedArcSplitPointDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedArcSplitPointDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedArcSplitPointDeleteLineContourStatus = message;
    }
  });
  selectedArcSplitPointDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedArcSplitPointDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedArcSplitPointDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected arc split-point delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (
    !selectedArcSplitPointDeleteLineContourEdit.authoringHandler.click({
      screen: { x: 30, y: 20 },
      event: { button: 0, detail: 1, altKey: true },
      modifiers: { altKey: true }
    })
      || !selectedArcSplitPointDeleteLineContourEdit.authoringHandler.click({ screen: { x: 30, y: 35 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected arc split-point delete Line Contour setup should create a first-arc contour");
    return 1;
  }
  const selectedArcSplitPointDeleteBeforeSplit = selectedArcSplitPointDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcSplitPointDeleteSourceArc = sketchEdges(selectedArcSplitPointDeleteBeforeSplit).find((edge) => edge.kind === "circular-arc");
  const selectedArcSplitPointDeleteSplitPoint = selectedArcSplitPointDeleteSourceArc
    ? sketchEdgeMidpoint(selectedArcSplitPointDeleteBeforeSplit, selectedArcSplitPointDeleteSourceArc.id)
    : null;
  if (!selectedArcSplitPointDeleteSourceArc || !selectedArcSplitPointDeleteSplitPoint) {
    console.error("FAILED: selected arc split-point delete Line Contour setup should expose a semantic first arc");
    return 1;
  }
  selectedArcSplitPointDeleteLineContourEdit.selectEntities({ edgeIds: [selectedArcSplitPointDeleteSourceArc.id] }, { sketchMode: "relations" });
  if (!selectedArcSplitPointDeleteLineContourEdit.authoringHandler.click({
    screen: { x: selectedArcSplitPointDeleteSplitPoint[0], y: selectedArcSplitPointDeleteSplitPoint[1] },
    event: { button: 0, detail: 1 }
  })) {
    console.error("FAILED: selected arc split-point delete Line Contour setup should split the selected contour arc");
    return 1;
  }
  const selectedArcSplitPointDeleteAfterSplit = selectedArcSplitPointDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcSplitPointDeleteVertex = sketchVertices(selectedArcSplitPointDeleteAfterSplit).find((vertex) => pointKey(vertex.point) === pointKey(selectedArcSplitPointDeleteSplitPoint));
  if (
    !selectedArcSplitPointDeleteVertex
      || sketchEdges(selectedArcSplitPointDeleteAfterSplit).filter((edge) => edge.kind === "circular-arc").length !== 2
  ) {
    console.error("FAILED: selected arc split-point delete Line Contour setup should produce a split vertex between two semantic arcs");
    return 1;
  }
  selectedArcSplitPointDeleteLineContourEdit.selectEntities({ vertexIds: [selectedArcSplitPointDeleteVertex.id] }, { sketchMode: "relations" });
  if (!selectedArcSplitPointDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected split point between same-circle arcs");
    return 1;
  }
  const selectedArcSplitPointDeleteContour = selectedArcSplitPointDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcSplitPointDeleteArcs = sketchEdges(selectedArcSplitPointDeleteContour).filter((edge) => edge.kind === "circular-arc");
  const selectedArcSplitPointDeleteVertices = new Map(sketchVertices(selectedArcSplitPointDeleteContour).map((vertex) => [vertex.id, vertex]));
  const selectedArcSplitPointDeleteMergedArc = selectedArcSplitPointDeleteArcs[0];
  const selectedArcSplitPointDeleteEndpointKeys = selectedArcSplitPointDeleteMergedArc
    ? [
        selectedArcSplitPointDeleteVertices.get(selectedArcSplitPointDeleteMergedArc.from)?.point,
        selectedArcSplitPointDeleteVertices.get(selectedArcSplitPointDeleteMergedArc.to)?.point
      ].map(pointKey).sort()
    : [];
  const selectedArcSplitPointDeleteKeys = new Set(sketchVertices(selectedArcSplitPointDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedArcSplitPointDeleteContour).length !== 3
      || selectedArcSplitPointDeleteArcs.length !== 1
      || selectedArcSplitPointDeleteKeys.has(pointKey(selectedArcSplitPointDeleteSplitPoint))
      || selectedArcSplitPointDeleteEndpointKeys.join("|") !== [[0, 0], [60, 0]].map(pointKey).sort().join("|")
      || selectedArcSplitPointDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedArcSplitPointDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedArcSplitPointDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected arc split point; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should merge same-circle child arcs when removing their selected split point");
    return 1;
  }
  let selectedPointReplaceLineContourStatus = "";
  const selectedPointReplaceLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedPointReplaceLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedPointReplaceLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedPointReplaceLineContourStatus = message;
    }
  });
  selectedPointReplaceLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedPointReplaceLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-point replace Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedPointReplaceLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-point replace Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-point replace Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedPointReplaceBefore = selectedPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedPointReplaceVertex = sketchVertices(selectedPointReplaceBefore).find((vertex) => pointKey(vertex.point) === pointKey([30, 35]));
  if (!selectedPointReplaceVertex) {
    console.error("FAILED: selected-point replace Line Contour setup should contain the replaceable middle point");
    return 1;
  }
  selectedPointReplaceLineContourEdit.selectEntities({ vertexIds: [selectedPointReplaceVertex.id] }, { sketchMode: "relations" });
  if (!selectedPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 38, y: 42 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should replace a selected committed contour point");
    return 1;
  }
  const selectedPointReplaceContour = selectedPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedPointReplaceKeys = new Set(sketchVertices(selectedPointReplaceContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedPointReplaceContour).length !== 4
      || sketchEdges(selectedPointReplaceContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedPointReplaceKeys.has(pointKey([30, 35]))
      || !selectedPointReplaceKeys.has(pointKey([38, 42]))
      || !selectedPointReplaceKeys.has(pointKey([0, 50]))
      || selectedPointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedPointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedPointReplaceLineContourStatus !== "Plate sketch Line Contour: replaced selected point; 4-point contour active"
  ) {
    console.error("FAILED: Line Contour click should replace the selected point, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let duplicatePointReplaceLineContourStatus = "";
  const duplicatePointReplaceLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const duplicatePointReplaceLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: duplicatePointReplaceLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      duplicatePointReplaceLineContourStatus = message;
    }
  });
  duplicatePointReplaceLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  duplicatePointReplaceLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!duplicatePointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: duplicate-point replace Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!duplicatePointReplaceLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: duplicate-point replace Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!duplicatePointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: duplicate-point replace Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const duplicatePointReplaceBefore = duplicatePointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const duplicatePointReplaceVertex = sketchVertices(duplicatePointReplaceBefore).find((vertex) => pointKey(vertex.point) === pointKey([30, 35]));
  if (!duplicatePointReplaceVertex) {
    console.error("FAILED: duplicate-point replace Line Contour setup should contain the selected point");
    return 1;
  }
  duplicatePointReplaceLineContourEdit.selectEntities({ vertexIds: [duplicatePointReplaceVertex.id] }, { sketchMode: "relations" });
  const duplicatePointReplaceProjectBefore = JSON.stringify(duplicatePointReplaceLineContourStore.project());
  if (!duplicatePointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 0, y: 0 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: duplicate-point replacement click should be handled by Line Contour");
    return 1;
  }
  const duplicatePointReplaceProjectAfter = JSON.stringify(duplicatePointReplaceLineContourStore.project());
  const duplicatePointReplaceAfter = duplicatePointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const duplicatePointReplacePointCounts = sketchVertices(duplicatePointReplaceAfter).reduce((counts, vertex) => {
    counts.set(pointKey(vertex.point), (counts.get(pointKey(vertex.point)) || 0) + 1);
    return counts;
  }, new Map());
  if (
    duplicatePointReplaceProjectAfter !== duplicatePointReplaceProjectBefore
      || duplicatePointReplacePointCounts.get(pointKey([0, 0])) !== 1
      || !sketchVertices(duplicatePointReplaceAfter).some((vertex) => pointKey(vertex.point) === pointKey([30, 35]))
      || sketchEdges(duplicatePointReplaceAfter).filter((edge) => edge.kind === "circular-arc").length !== 1
      || duplicatePointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || duplicatePointReplaceLineContourStatus !== "Plate sketch Line Contour: replacement point must differ from existing contour points"
  ) {
    console.error("FAILED: Line Contour should reject replacing a point with another existing contour point without mutating the sketch");
    return 1;
  }
  let selectedArcEndpointReplaceLineContourStatus = "";
  const selectedArcEndpointReplaceLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedArcEndpointReplaceLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedArcEndpointReplaceLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedArcEndpointReplaceLineContourStatus = message;
    }
  });
  selectedArcEndpointReplaceLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedArcEndpointReplaceLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc-endpoint replace Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-arc-endpoint replace Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc-endpoint replace Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedArcEndpointReplaceBefore = selectedArcEndpointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcEndpointReplaceVertex = sketchVertices(selectedArcEndpointReplaceBefore).find((vertex) => pointKey(vertex.point) === pointKey([0, 0]));
  if (!selectedArcEndpointReplaceVertex) {
    console.error("FAILED: selected-arc-endpoint replace Line Contour setup should expose the first arc endpoint");
    return 1;
  }
  selectedArcEndpointReplaceLineContourEdit.selectEntities({ vertexIds: [selectedArcEndpointReplaceVertex.id] }, { sketchMode: "relations" });
  if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({ screen: { x: -4, y: 4 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should replace a selected endpoint of a semantic arc");
    return 1;
  }
  const selectedArcEndpointReplaceContour = selectedArcEndpointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcEndpointReplaceVertices = new Map(sketchVertices(selectedArcEndpointReplaceContour).map((vertex) => [vertex.id, vertex]));
  const selectedArcEndpointReplaceArcs = sketchEdges(selectedArcEndpointReplaceContour).filter((edge) => edge.kind === "circular-arc");
  const selectedArcEndpointReplaceEndpointKeys = selectedArcEndpointReplaceArcs[0]
    ? [
        selectedArcEndpointReplaceVertices.get(selectedArcEndpointReplaceArcs[0].from)?.point,
        selectedArcEndpointReplaceVertices.get(selectedArcEndpointReplaceArcs[0].to)?.point
      ].map(pointKey).sort()
    : [];
  const selectedArcEndpointReplaceKeys = new Set(sketchVertices(selectedArcEndpointReplaceContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedArcEndpointReplaceContour).length !== 4
      || selectedArcEndpointReplaceArcs.length !== 1
      || selectedArcEndpointReplaceKeys.has(pointKey([0, 0]))
      || !selectedArcEndpointReplaceKeys.has(pointKey([-4, 4]))
      || !selectedArcEndpointReplaceKeys.has(pointKey([-4, 50]))
      || selectedArcEndpointReplaceEndpointKeys.join("|") !== [[-4, 4], [60, 0]].map(pointKey).sort().join("|")
      || selectedArcEndpointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedArcEndpointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedArcEndpointReplaceLineContourStatus !== "Plate sketch Line Contour: replaced selected point; 4-point contour active"
  ) {
    console.error("FAILED: Line Contour click should replace an arc endpoint while preserving the semantic arc");
    return 1;
  }
  if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 42, y: 62 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue after replacing an arc endpoint");
    return 1;
  }
  const selectedArcEndpointReplaceContinued = selectedArcEndpointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcEndpointReplaceContinuedKeys = new Set(sketchVertices(selectedArcEndpointReplaceContinued).map((vertex) => pointKey(vertex.point)));
  const selectedArcEndpointReplaceContinuedVertexPoints = new Map(sketchVertices(selectedArcEndpointReplaceContinued).map((vertex) => [vertex.id, vertex.point]));
  const selectedArcEndpointReplaceContinuationEdge = sketchEdges(selectedArcEndpointReplaceContinued).find((edge) => {
    const from = selectedArcEndpointReplaceContinuedVertexPoints.get(edge.from);
    const to = selectedArcEndpointReplaceContinuedVertexPoints.get(edge.to);
    return pointKey(from) === pointKey([-4, 50]) && pointKey(to) === pointKey([42, 62]);
  });
  if (
    sketchEdges(selectedArcEndpointReplaceContinued).length !== 5
      || sketchEdges(selectedArcEndpointReplaceContinued).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedArcEndpointReplaceContinuedKeys.has(pointKey([-4, 4]))
      || !selectedArcEndpointReplaceContinuedKeys.has(pointKey([-4, 50]))
      || !selectedArcEndpointReplaceContinuedKeys.has(pointKey([42, 62]))
      || !selectedArcEndpointReplaceContinuationEdge
      || selectedArcEndpointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedArcEndpointReplaceLineContourStatus !== "Plate sketch Line Contour: 5-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from an arc-endpoint replacement while preserving the semantic arc");
    return 1;
  }
  if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({
    screen: { x: 20, y: 70 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: Line Contour should convert the post-replacement latest segment to an arc");
    return 1;
  }
  const selectedArcEndpointReplaceLatestArc = selectedArcEndpointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcEndpointReplaceLatestArcVertexPoints = new Map(sketchVertices(selectedArcEndpointReplaceLatestArc).map((vertex) => [vertex.id, vertex.point]));
  const selectedArcEndpointReplaceLatestArcs = sketchEdges(selectedArcEndpointReplaceLatestArc).filter((edge) => edge.kind === "circular-arc");
  const selectedArcEndpointReplaceNewArc = selectedArcEndpointReplaceLatestArcs.find((edge) => {
    const from = selectedArcEndpointReplaceLatestArcVertexPoints.get(edge.from);
    const to = selectedArcEndpointReplaceLatestArcVertexPoints.get(edge.to);
    return pointKey(from) === pointKey([-4, 50]) && pointKey(to) === pointKey([42, 62]);
  });
  if (
    sketchEdges(selectedArcEndpointReplaceLatestArc).length !== 5
      || selectedArcEndpointReplaceLatestArcs.length !== 2
      || !selectedArcEndpointReplaceNewArc
      || selectedArcEndpointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedArcEndpointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || !selectedArcEndpointReplaceLineContourStatus.startsWith("Plate sketch Line Contour: arc segment created radius ")
  ) {
    console.error("FAILED: Line Contour should add an arc after an arc-endpoint replacement");
    return 1;
  }
  if (!selectedArcEndpointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 70, y: 75 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue after adding a post-replacement arc");
    return 1;
  }
  const selectedArcEndpointReplaceArcContinued = selectedArcEndpointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcEndpointReplaceArcContinuedKeys = new Set(sketchVertices(selectedArcEndpointReplaceArcContinued).map((vertex) => pointKey(vertex.point)));
  const selectedArcEndpointReplaceArcContinuedVertexPoints = new Map(sketchVertices(selectedArcEndpointReplaceArcContinued).map((vertex) => [vertex.id, vertex.point]));
  const selectedArcEndpointReplaceArcContinuationEdge = sketchEdges(selectedArcEndpointReplaceArcContinued).find((edge) => {
    const from = selectedArcEndpointReplaceArcContinuedVertexPoints.get(edge.from);
    const to = selectedArcEndpointReplaceArcContinuedVertexPoints.get(edge.to);
    return pointKey(from) === pointKey([42, 62]) && pointKey(to) === pointKey([70, 75]);
  });
  if (
    sketchEdges(selectedArcEndpointReplaceArcContinued).length !== 6
      || sketchEdges(selectedArcEndpointReplaceArcContinued).filter((edge) => edge.kind === "circular-arc").length !== 2
      || !selectedArcEndpointReplaceArcContinuedKeys.has(pointKey([-4, 4]))
      || !selectedArcEndpointReplaceArcContinuedKeys.has(pointKey([-4, 50]))
      || !selectedArcEndpointReplaceArcContinuedKeys.has(pointKey([42, 62]))
      || !selectedArcEndpointReplaceArcContinuedKeys.has(pointKey([70, 75]))
      || !selectedArcEndpointReplaceArcContinuationEdge
      || selectedArcEndpointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedArcEndpointReplaceLineContourStatus !== "Plate sketch Line Contour: 6-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from a post-replacement arc while preserving both semantic arcs");
    return 1;
  }
  let selectedClosingPointReplaceLineContourStatus = "";
  const selectedClosingPointReplaceLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedClosingPointReplaceLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedClosingPointReplaceLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedClosingPointReplaceLineContourStatus = message;
    }
  });
  selectedClosingPointReplaceLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedClosingPointReplaceLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35], [0, 50]]) {
    if (!selectedClosingPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-closing-point replace Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedClosingPointReplaceBeforeArc = selectedClosingPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingPointReplaceBeforeVertexById = new Map(sketchVertices(selectedClosingPointReplaceBeforeArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingPointReplaceArcEdge = sketchEdges(selectedClosingPointReplaceBeforeArc).find((edge) => {
    const from = selectedClosingPointReplaceBeforeVertexById.get(edge.from)?.point;
    const to = selectedClosingPointReplaceBeforeVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedClosingPointReplaceArcEdge) {
    console.error("FAILED: selected-closing-point replace Line Contour setup should expose an interior edge to round");
    return 1;
  }
  selectedClosingPointReplaceLineContourEdit.selectEntities({ edgeIds: [selectedClosingPointReplaceArcEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingPointReplaceLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 50, y: 28 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-point replace Line Contour setup should create a surviving interior arc");
    return 1;
  }
  const selectedClosingPointReplaceBefore = selectedClosingPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingPointReplaceVertex = sketchVertices(selectedClosingPointReplaceBefore).find((vertex) => pointKey(vertex.point) === pointKey([0, 0]));
  if (!selectedClosingPointReplaceVertex) {
    console.error("FAILED: selected-closing-point replace Line Contour setup should expose the first closing point");
    return 1;
  }
  selectedClosingPointReplaceLineContourEdit.selectEntities({ vertexIds: [selectedClosingPointReplaceVertex.id] }, { sketchMode: "relations" });
  if (!selectedClosingPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: -12, y: 8 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should replace a selected closing contour point");
    return 1;
  }
  const selectedClosingPointReplaceContour = selectedClosingPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingPointReplaceKeys = new Set(sketchVertices(selectedClosingPointReplaceContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingPointReplaceContour).length !== 4
      || sketchEdges(selectedClosingPointReplaceContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedClosingPointReplaceKeys.has(pointKey([0, 0]))
      || !selectedClosingPointReplaceKeys.has(pointKey([-12, 8]))
      || !selectedClosingPointReplaceKeys.has(pointKey([30, 35]))
      || selectedClosingPointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedClosingPointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingPointReplaceLineContourStatus !== "Plate sketch Line Contour: replaced selected point; 4-point contour active"
  ) {
    console.error("FAILED: Line Contour click should replace the closing point, preserve unrelated arcs, and keep the contour active");
    return 1;
  }
  if (!selectedClosingPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 42, y: 62 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue after replacing the selected closing point");
    return 1;
  }
  const selectedClosingPointReplaceContinued = selectedClosingPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingPointReplaceContinuedKeys = new Set(sketchVertices(selectedClosingPointReplaceContinued).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingPointReplaceContinued).length !== 5
      || sketchEdges(selectedClosingPointReplaceContinued).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedClosingPointReplaceContinuedKeys.has(pointKey([-12, 8]))
      || !selectedClosingPointReplaceContinuedKeys.has(pointKey([42, 62]))
      || selectedClosingPointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingPointReplaceLineContourStatus !== "Plate sketch Line Contour: 5-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from the replaced closing point state while preserving the semantic arc");
    return 1;
  }
  let selectedLatestPointReplaceLineContourStatus = "";
  const selectedLatestPointReplaceLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedLatestPointReplaceLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedLatestPointReplaceLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedLatestPointReplaceLineContourStatus = message;
    }
  });
  selectedLatestPointReplaceLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedLatestPointReplaceLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedLatestPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-latest-point replace Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedLatestPointReplaceLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-latest-point replace Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedLatestPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-latest-point replace Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedLatestPointReplaceBefore = selectedLatestPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedLatestPointReplaceVertex = sketchVertices(selectedLatestPointReplaceBefore).find((vertex) => pointKey(vertex.point) === pointKey([0, 50]));
  if (!selectedLatestPointReplaceVertex) {
    console.error("FAILED: selected-latest-point replace Line Contour setup should expose the latest contour point");
    return 1;
  }
  selectedLatestPointReplaceLineContourEdit.selectEntities({ vertexIds: [selectedLatestPointReplaceVertex.id] }, { sketchMode: "relations" });
  if (!selectedLatestPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: -10, y: 60 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should replace the selected latest contour point");
    return 1;
  }
  const selectedLatestPointReplaceContour = selectedLatestPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedLatestPointReplaceKeys = new Set(sketchVertices(selectedLatestPointReplaceContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedLatestPointReplaceContour).length !== 4
      || sketchEdges(selectedLatestPointReplaceContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedLatestPointReplaceKeys.has(pointKey([0, 50]))
      || !selectedLatestPointReplaceKeys.has(pointKey([-10, 60]))
      || !selectedLatestPointReplaceKeys.has(pointKey([30, 35]))
      || selectedLatestPointReplaceLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedLatestPointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedLatestPointReplaceLineContourStatus !== "Plate sketch Line Contour: replaced selected point; 4-point contour active"
  ) {
    console.error("FAILED: Line Contour click should replace the latest point, preserve the first arc, and keep the contour active");
    return 1;
  }
  if (!selectedLatestPointReplaceLineContourEdit.authoringHandler.click({ screen: { x: 42, y: 62 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue from the replaced latest point");
    return 1;
  }
  const selectedLatestPointReplaceContinued = selectedLatestPointReplaceLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedLatestPointReplaceContinuedKeys = new Set(sketchVertices(selectedLatestPointReplaceContinued).map((vertex) => pointKey(vertex.point)));
  const selectedLatestPointReplaceContinuedEdges = sketchEdges(selectedLatestPointReplaceContinued);
  const selectedLatestContinuationEdge = selectedLatestPointReplaceContinuedEdges.find((edge) => {
    const vertices = new Map(sketchVertices(selectedLatestPointReplaceContinued).map((vertex) => [vertex.id, vertex.point]));
    const from = vertices.get(edge.from);
    const to = vertices.get(edge.to);
    return pointKey(from) === pointKey([-10, 60]) && pointKey(to) === pointKey([42, 62]);
  });
  if (
    selectedLatestPointReplaceContinuedEdges.length !== 5
      || selectedLatestPointReplaceContinuedEdges.filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedLatestPointReplaceContinuedKeys.has(pointKey([-10, 60]))
      || !selectedLatestPointReplaceContinuedKeys.has(pointKey([42, 62]))
      || !selectedLatestContinuationEdge
      || selectedLatestPointReplaceLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedLatestPointReplaceLineContourStatus !== "Plate sketch Line Contour: 5-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from the replacement latest point while preserving the semantic arc");
    return 1;
  }
  let selectedEdgeDeleteLineContourStatus = "";
  const selectedEdgeDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedEdgeDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedEdgeDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedEdgeDeleteLineContourStatus = message;
    }
  });
  selectedEdgeDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedEdgeDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedEdgeDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-edge delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedEdgeDeleteLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-edge delete Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedEdgeDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-edge delete Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedEdgeDeleteBefore = selectedEdgeDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedEdgeDeleteVertexById = new Map(sketchVertices(selectedEdgeDeleteBefore).map((vertex) => [vertex.id, vertex]));
  const selectedEdgeDeleteEdge = sketchEdges(selectedEdgeDeleteBefore).find((edge) => {
    const from = selectedEdgeDeleteVertexById.get(edge.from)?.point;
    const to = selectedEdgeDeleteVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedEdgeDeleteEdge) {
    console.error("FAILED: selected-edge delete Line Contour setup should expose the removable non-latest edge");
    return 1;
  }
  selectedEdgeDeleteLineContourEdit.selectEntities({ edgeIds: [selectedEdgeDeleteEdge.id] }, { sketchMode: "relations" });
  if (!selectedEdgeDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected non-latest committed contour edge");
    return 1;
  }
  const selectedEdgeDeleteContour = selectedEdgeDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedEdgeDeleteKeys = new Set(sketchVertices(selectedEdgeDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedEdgeDeleteContour).length !== 3
      || sketchEdges(selectedEdgeDeleteContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedEdgeDeleteKeys.has(pointKey([30, 35]))
      || !selectedEdgeDeleteKeys.has(pointKey([0, 50]))
      || selectedEdgeDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedEdgeDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedEdgeDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected edge; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should remove a selected earlier edge, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let selectedArcDeleteLineContourStatus = "";
  const selectedArcDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedArcDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedArcDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedArcDeleteLineContourStatus = message;
    }
  });
  selectedArcDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedArcDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedArcDeleteLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-arc delete Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc delete Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedArcDeleteBeforeArc = selectedArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcDeleteBeforeVertexById = new Map(sketchVertices(selectedArcDeleteBeforeArc).map((vertex) => [vertex.id, vertex]));
  const selectedArcDeleteTarget = sketchEdges(selectedArcDeleteBeforeArc).find((edge) => {
    const from = selectedArcDeleteBeforeVertexById.get(edge.from)?.point;
    const to = selectedArcDeleteBeforeVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedArcDeleteTarget) {
    console.error("FAILED: selected-arc delete Line Contour setup should expose the removable interior edge");
    return 1;
  }
  selectedArcDeleteLineContourEdit.selectEntities({ edgeIds: [selectedArcDeleteTarget.id] }, { sketchMode: "relations" });
  if (
    !selectedArcDeleteLineContourEdit.convertSelectedEdgeToArc()
      || !selectedArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: 50, y: 28 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-arc delete Line Contour setup should convert the interior edge into an arc");
    return 1;
  }
  const selectedArcDeleteBefore = selectedArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcDeleteArc = sketchEdges(selectedArcDeleteBefore).find((edge) => edge.id === selectedArcDeleteTarget.id);
  if (selectedArcDeleteArc?.kind !== "circular-arc") {
    console.error("FAILED: selected-arc delete Line Contour setup should keep the selected interior edge as a semantic arc");
    return 1;
  }
  selectedArcDeleteLineContourEdit.selectEntities({ edgeIds: [selectedArcDeleteArc.id] }, { sketchMode: "relations" });
  if (!selectedArcDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected non-latest committed contour arc");
    return 1;
  }
  const selectedArcDeleteContour = selectedArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcDeleteKeys = new Set(sketchVertices(selectedArcDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedArcDeleteContour).length !== 3
      || sketchEdges(selectedArcDeleteContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedArcDeleteKeys.has(pointKey([30, 35]))
      || !selectedArcDeleteKeys.has(pointKey([0, 50]))
      || selectedArcDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedArcDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedArcDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected arc; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should remove a selected earlier arc, preserve other arcs, and keep the contour active");
    return 1;
  }
  let selectedEdgeInsertLineContourStatus = "";
  const selectedEdgeInsertLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedEdgeInsertLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedEdgeInsertLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedEdgeInsertLineContourStatus = message;
    }
  });
  selectedEdgeInsertLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedEdgeInsertLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-edge insert Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedEdgeInsertLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-edge insert Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-edge insert Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedEdgeInsertBefore = selectedEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedEdgeInsertVertexById = new Map(sketchVertices(selectedEdgeInsertBefore).map((vertex) => [vertex.id, vertex]));
  const selectedEdgeInsertEdge = sketchEdges(selectedEdgeInsertBefore).find((edge) => {
    const from = selectedEdgeInsertVertexById.get(edge.from)?.point;
    const to = selectedEdgeInsertVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedEdgeInsertEdge) {
    console.error("FAILED: selected-edge insert Line Contour setup should expose the edge to receive a point");
    return 1;
  }
  selectedEdgeInsertLineContourEdit.selectEntities({ edgeIds: [selectedEdgeInsertEdge.id] }, { sketchMode: "relations" });
  const selectedEdgeInsertClick = [45, 38];
  const selectedEdgeInsertedPoint = pointProjectedToSegment(selectedEdgeInsertClick, [60, 0], [30, 35]);
  if (!selectedEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: selectedEdgeInsertClick[0], y: selectedEdgeInsertClick[1] }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should insert a point on the selected committed contour edge");
    return 1;
  }
  const selectedEdgeInsertContour = selectedEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedEdgeInsertKeys = new Set(sketchVertices(selectedEdgeInsertContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedEdgeInsertContour).length !== 5
      || sketchEdges(selectedEdgeInsertContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedEdgeInsertKeys.has(pointKey(selectedEdgeInsertedPoint))
      || selectedEdgeInsertKeys.has(pointKey(selectedEdgeInsertClick))
      || !selectedEdgeInsertKeys.has(pointKey([30, 35]))
      || !selectedEdgeInsertKeys.has(pointKey([0, 50]))
      || selectedEdgeInsertLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedEdgeInsertLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedEdgeInsertLineContourStatus !== "Plate sketch Line Contour: inserted point on selected edge; 5-point contour active"
  ) {
    console.error("FAILED: Line Contour click should project insertion onto the selected edge, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let selectedArcInsertLineContourStatus = "";
  const selectedArcInsertLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedArcInsertLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedArcInsertLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedArcInsertLineContourStatus = message;
    }
  });
  selectedArcInsertLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedArcInsertLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0]]) {
    if (!selectedArcInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc insert Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!selectedArcInsertLineContourEdit.authoringHandler.click({
    screen: { x: 30, y: 20 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: selected-arc insert Line Contour setup should stage a first-segment arc");
    return 1;
  }
  for (const point of [[30, 35], [0, 50]]) {
    if (!selectedArcInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-arc insert Line Contour setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedArcInsertBefore = selectedArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcInsertEdge = sketchEdges(selectedArcInsertBefore).find((edge) => edge.kind === "circular-arc");
  const selectedArcInsertPoint = selectedArcInsertEdge ? sketchEdgeMidpoint(selectedArcInsertBefore, selectedArcInsertEdge.id) : null;
  if (!selectedArcInsertEdge || !selectedArcInsertPoint) {
    console.error("FAILED: selected-arc insert Line Contour setup should expose the arc to receive a point");
    return 1;
  }
  selectedArcInsertLineContourEdit.selectEntities({ edgeIds: [selectedArcInsertEdge.id] }, { sketchMode: "relations" });
  if (!selectedArcInsertLineContourEdit.authoringHandler.click({ screen: { x: selectedArcInsertPoint[0], y: selectedArcInsertPoint[1] }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should insert a point on the selected committed contour arc");
    return 1;
  }
  const selectedArcInsertContour = selectedArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedArcInsertKeys = new Set(sketchVertices(selectedArcInsertContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedArcInsertContour).length !== 5
      || sketchEdges(selectedArcInsertContour).filter((edge) => edge.kind === "circular-arc").length !== 2
      || !selectedArcInsertKeys.has(pointKey(selectedArcInsertPoint))
      || !selectedArcInsertKeys.has(pointKey([30, 35]))
      || !selectedArcInsertKeys.has(pointKey([0, 50]))
      || selectedArcInsertLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedArcInsertLineContourEdit.activeState().selection.edgeIds.length !== 2
      || selectedArcInsertLineContourStatus !== "Plate sketch Line Contour: inserted point on selected arc; 5-point contour active"
  ) {
    console.error("FAILED: Line Contour click should split the selected arc at the clicked point, preserve semantic arcs, and keep the contour active");
    return 1;
  }
  let selectedClosingEdgeInsertLineContourStatus = "";
  const selectedClosingEdgeInsertLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedClosingEdgeInsertLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedClosingEdgeInsertLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedClosingEdgeInsertLineContourStatus = message;
    }
  });
  selectedClosingEdgeInsertLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedClosingEdgeInsertLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35], [0, 50]]) {
    if (!selectedClosingEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-closing-edge insert Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedClosingEdgeInsertBeforeArc = selectedClosingEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeInsertBeforeVertexById = new Map(sketchVertices(selectedClosingEdgeInsertBeforeArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingEdgeInsertArcEdge = sketchEdges(selectedClosingEdgeInsertBeforeArc).find((edge) => {
    const from = selectedClosingEdgeInsertBeforeVertexById.get(edge.from)?.point;
    const to = selectedClosingEdgeInsertBeforeVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedClosingEdgeInsertArcEdge) {
    console.error("FAILED: selected-closing-edge insert Line Contour setup should expose the interior edge to round");
    return 1;
  }
  selectedClosingEdgeInsertLineContourEdit.selectEntities({ edgeIds: [selectedClosingEdgeInsertArcEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingEdgeInsertLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: 50, y: 28 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-edge insert Line Contour setup should create a surviving interior arc");
    return 1;
  }
  const selectedClosingEdgeInsertBefore = selectedClosingEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeInsertVertexById = new Map(sketchVertices(selectedClosingEdgeInsertBefore).map((vertex) => [vertex.id, vertex]));
  const selectedClosingEdgeInsertClosingEdge = sketchEdges(selectedClosingEdgeInsertBefore).find((edge) => {
    const from = selectedClosingEdgeInsertVertexById.get(edge.from)?.point;
    const to = selectedClosingEdgeInsertVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([0, 50]) && pointKey(to) === pointKey([0, 0]);
  });
  if (!selectedClosingEdgeInsertClosingEdge) {
    console.error("FAILED: selected-closing-edge insert Line Contour setup should expose the closing contour edge");
    return 1;
  }
  selectedClosingEdgeInsertLineContourEdit.selectEntities({ edgeIds: [selectedClosingEdgeInsertClosingEdge.id] }, { sketchMode: "relations" });
  const selectedClosingEdgeInsertClick = [9, 25];
  const selectedClosingEdgeInsertedPoint = pointProjectedToSegment(selectedClosingEdgeInsertClick, [0, 50], [0, 0]);
  if (!selectedClosingEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: selectedClosingEdgeInsertClick[0], y: selectedClosingEdgeInsertClick[1] }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should insert a point on the selected closing contour edge");
    return 1;
  }
  const selectedClosingEdgeInsertContour = selectedClosingEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeInsertKeys = new Set(sketchVertices(selectedClosingEdgeInsertContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingEdgeInsertContour).length !== 5
      || sketchEdges(selectedClosingEdgeInsertContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedClosingEdgeInsertKeys.has(pointKey(selectedClosingEdgeInsertedPoint))
      || selectedClosingEdgeInsertKeys.has(pointKey(selectedClosingEdgeInsertClick))
      || selectedClosingEdgeInsertLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedClosingEdgeInsertLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingEdgeInsertLineContourStatus !== "Plate sketch Line Contour: inserted point on selected edge; 5-point contour active"
  ) {
    console.error("FAILED: Line Contour click should project insertion onto the selected closing edge, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  if (!selectedClosingEdgeInsertLineContourEdit.authoringHandler.click({ screen: { x: 42, y: 62 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue after inserting a point on the selected closing edge");
    return 1;
  }
  const selectedClosingEdgeInsertContinued = selectedClosingEdgeInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeInsertContinuedKeys = new Set(sketchVertices(selectedClosingEdgeInsertContinued).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingEdgeInsertContinued).length !== 6
      || sketchEdges(selectedClosingEdgeInsertContinued).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !selectedClosingEdgeInsertContinuedKeys.has(pointKey(selectedClosingEdgeInsertedPoint))
      || !selectedClosingEdgeInsertContinuedKeys.has(pointKey([42, 62]))
      || selectedClosingEdgeInsertLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingEdgeInsertLineContourStatus !== "Plate sketch Line Contour: 6-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from a closing-edge insertion while preserving the semantic arc");
    return 1;
  }
  let selectedClosingArcInsertLineContourStatus = "";
  const selectedClosingArcInsertLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedClosingArcInsertLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedClosingArcInsertLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedClosingArcInsertLineContourStatus = message;
    }
  });
  selectedClosingArcInsertLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedClosingArcInsertLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35], [0, 50]]) {
    if (!selectedClosingArcInsertLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-closing-arc insert Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedClosingArcInsertBeforeArc = selectedClosingArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcInsertBeforeVertexById = new Map(sketchVertices(selectedClosingArcInsertBeforeArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingArcInsertClosingEdge = sketchEdges(selectedClosingArcInsertBeforeArc).find((edge) => {
    const from = selectedClosingArcInsertBeforeVertexById.get(edge.from)?.point;
    const to = selectedClosingArcInsertBeforeVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([0, 50]) && pointKey(to) === pointKey([0, 0]);
  });
  if (!selectedClosingArcInsertClosingEdge) {
    console.error("FAILED: selected-closing-arc insert Line Contour setup should expose the closing contour edge");
    return 1;
  }
  selectedClosingArcInsertLineContourEdit.selectEntities({ edgeIds: [selectedClosingArcInsertClosingEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingArcInsertLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingArcInsertLineContourEdit.authoringHandler.click({ screen: { x: -20, y: 25 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-arc insert Line Contour setup should convert the closing edge to an arc");
    return 1;
  }
  const selectedClosingArcInsertBefore = selectedClosingArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcInsertArc = sketchEdges(selectedClosingArcInsertBefore).find((edge) => edge.kind === "circular-arc");
  const selectedClosingArcInsertPoint = selectedClosingArcInsertArc ? sketchEdgeMidpoint(selectedClosingArcInsertBefore, selectedClosingArcInsertArc.id) : null;
  if (!selectedClosingArcInsertArc || !selectedClosingArcInsertPoint) {
    console.error("FAILED: selected-closing-arc insert Line Contour setup should expose the closing arc to split");
    return 1;
  }
  selectedClosingArcInsertLineContourEdit.selectEntities({ edgeIds: [selectedClosingArcInsertArc.id] }, { sketchMode: "relations" });
  if (!selectedClosingArcInsertLineContourEdit.authoringHandler.click({ screen: { x: selectedClosingArcInsertPoint[0], y: selectedClosingArcInsertPoint[1] }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour click should split the selected closing contour arc");
    return 1;
  }
  const selectedClosingArcInsertContour = selectedClosingArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcInsertKeys = new Set(sketchVertices(selectedClosingArcInsertContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingArcInsertContour).length !== 5
      || sketchEdges(selectedClosingArcInsertContour).filter((edge) => edge.kind === "circular-arc").length !== 2
      || !selectedClosingArcInsertKeys.has(pointKey(selectedClosingArcInsertPoint))
      || selectedClosingArcInsertLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedClosingArcInsertLineContourEdit.activeState().selection.edgeIds.length !== 2
      || selectedClosingArcInsertLineContourStatus !== "Plate sketch Line Contour: inserted point on selected arc; 5-point contour active"
  ) {
    console.error("FAILED: Line Contour click should split the selected closing arc, keep both child arcs semantic, and keep the contour active");
    return 1;
  }
  if (!selectedClosingArcInsertLineContourEdit.authoringHandler.click({ screen: { x: 42, y: 62 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should continue after splitting the selected closing arc");
    return 1;
  }
  const selectedClosingArcInsertContinued = selectedClosingArcInsertLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcInsertContinuedKeys = new Set(sketchVertices(selectedClosingArcInsertContinued).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingArcInsertContinued).length !== 6
      || sketchEdges(selectedClosingArcInsertContinued).filter((edge) => edge.kind === "circular-arc").length !== 2
      || !selectedClosingArcInsertContinuedKeys.has(pointKey(selectedClosingArcInsertPoint))
      || !selectedClosingArcInsertContinuedKeys.has(pointKey([42, 62]))
      || selectedClosingArcInsertLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingArcInsertLineContourStatus !== "Plate sketch Line Contour: 6-point contour created; latest segment selected"
  ) {
    console.error("FAILED: Line Contour should continue from a closing-arc split while preserving both semantic child arcs");
    return 1;
  }
  let selectedClosingEdgeDeleteLineContourStatus = "";
  const selectedClosingEdgeDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedClosingEdgeDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedClosingEdgeDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedClosingEdgeDeleteLineContourStatus = message;
    }
  });
  selectedClosingEdgeDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedClosingEdgeDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35], [0, 50]]) {
    if (!selectedClosingEdgeDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-closing-edge delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedClosingEdgeDeleteBeforeArc = selectedClosingEdgeDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeDeleteBeforeVertexById = new Map(sketchVertices(selectedClosingEdgeDeleteBeforeArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingEdgeDeleteArcEdge = sketchEdges(selectedClosingEdgeDeleteBeforeArc).find((edge) => {
    const from = selectedClosingEdgeDeleteBeforeVertexById.get(edge.from)?.point;
    const to = selectedClosingEdgeDeleteBeforeVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedClosingEdgeDeleteArcEdge) {
    console.error("FAILED: selected-closing-edge delete Line Contour setup should expose the interior edge to round");
    return 1;
  }
  selectedClosingEdgeDeleteLineContourEdit.selectEntities({ edgeIds: [selectedClosingEdgeDeleteArcEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingEdgeDeleteLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingEdgeDeleteLineContourEdit.authoringHandler.click({ screen: { x: 50, y: 28 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-edge delete Line Contour setup should create a surviving interior arc");
    return 1;
  }
  const selectedClosingEdgeDeleteBefore = selectedClosingEdgeDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeDeleteVertexById = new Map(sketchVertices(selectedClosingEdgeDeleteBefore).map((vertex) => [vertex.id, vertex]));
  const selectedClosingEdgeDeleteClosingEdge = sketchEdges(selectedClosingEdgeDeleteBefore).find((edge) => {
    const from = selectedClosingEdgeDeleteVertexById.get(edge.from)?.point;
    const to = selectedClosingEdgeDeleteVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([0, 50]) && pointKey(to) === pointKey([0, 0]);
  });
  if (!selectedClosingEdgeDeleteClosingEdge) {
    console.error("FAILED: selected-closing-edge delete Line Contour setup should expose the closing contour edge");
    return 1;
  }
  selectedClosingEdgeDeleteLineContourEdit.selectEntities({ edgeIds: [selectedClosingEdgeDeleteClosingEdge.id] }, { sketchMode: "relations" });
  if (!selectedClosingEdgeDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected closing contour edge");
    return 1;
  }
  const selectedClosingEdgeDeleteContour = selectedClosingEdgeDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingEdgeDeleteKeys = new Set(sketchVertices(selectedClosingEdgeDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingEdgeDeleteContour).length !== 3
      || sketchEdges(selectedClosingEdgeDeleteContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedClosingEdgeDeleteKeys.has(pointKey([0, 0]))
      || !selectedClosingEdgeDeleteKeys.has(pointKey([0, 50]))
      || selectedClosingEdgeDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedClosingEdgeDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingEdgeDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected edge; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should remove the selected closing edge, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let selectedClosingArcDeleteLineContourStatus = "";
  const selectedClosingArcDeleteLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const selectedClosingArcDeleteLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: selectedClosingArcDeleteLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      selectedClosingArcDeleteLineContourStatus = message;
    }
  });
  selectedClosingArcDeleteLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  selectedClosingArcDeleteLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35], [0, 50]]) {
    if (!selectedClosingArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: selected-closing-arc delete Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const selectedClosingArcDeleteBeforeInteriorArc = selectedClosingArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcDeleteBeforeInteriorVertexById = new Map(sketchVertices(selectedClosingArcDeleteBeforeInteriorArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingArcDeleteInteriorEdge = sketchEdges(selectedClosingArcDeleteBeforeInteriorArc).find((edge) => {
    const from = selectedClosingArcDeleteBeforeInteriorVertexById.get(edge.from)?.point;
    const to = selectedClosingArcDeleteBeforeInteriorVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([60, 0]) && pointKey(to) === pointKey([30, 35]);
  });
  if (!selectedClosingArcDeleteInteriorEdge) {
    console.error("FAILED: selected-closing-arc delete Line Contour setup should expose the interior edge to round");
    return 1;
  }
  selectedClosingArcDeleteLineContourEdit.selectEntities({ edgeIds: [selectedClosingArcDeleteInteriorEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingArcDeleteLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: 50, y: 28 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-arc delete Line Contour setup should create a surviving interior arc");
    return 1;
  }
  const selectedClosingArcDeleteBeforeClosingArc = selectedClosingArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcDeleteBeforeClosingVertexById = new Map(sketchVertices(selectedClosingArcDeleteBeforeClosingArc).map((vertex) => [vertex.id, vertex]));
  const selectedClosingArcDeleteClosingEdge = sketchEdges(selectedClosingArcDeleteBeforeClosingArc).find((edge) => {
    const from = selectedClosingArcDeleteBeforeClosingVertexById.get(edge.from)?.point;
    const to = selectedClosingArcDeleteBeforeClosingVertexById.get(edge.to)?.point;
    return pointKey(from) === pointKey([0, 50]) && pointKey(to) === pointKey([0, 0]);
  });
  if (!selectedClosingArcDeleteClosingEdge) {
    console.error("FAILED: selected-closing-arc delete Line Contour setup should expose the closing contour edge");
    return 1;
  }
  selectedClosingArcDeleteLineContourEdit.selectEntities({ edgeIds: [selectedClosingArcDeleteClosingEdge.id] }, { sketchMode: "relations" });
  if (
    !selectedClosingArcDeleteLineContourEdit.convertSelectedEdgeToArc()
      || !selectedClosingArcDeleteLineContourEdit.authoringHandler.click({ screen: { x: -20, y: 25 }, event: { button: 0, detail: 1 } })
  ) {
    console.error("FAILED: selected-closing-arc delete Line Contour setup should convert the closing edge to an arc");
    return 1;
  }
  const selectedClosingArcDeleteBefore = selectedClosingArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcDeleteVertexById = new Map(sketchVertices(selectedClosingArcDeleteBefore).map((vertex) => [vertex.id, vertex]));
  const selectedClosingArcDeleteArc = sketchEdges(selectedClosingArcDeleteBefore).find((edge) => {
    const from = selectedClosingArcDeleteVertexById.get(edge.from)?.point;
    const to = selectedClosingArcDeleteVertexById.get(edge.to)?.point;
    return edge.kind === "circular-arc" && pointKey(from) === pointKey([0, 50]) && pointKey(to) === pointKey([0, 0]);
  });
  if (!selectedClosingArcDeleteArc) {
    console.error("FAILED: selected-closing-arc delete Line Contour setup should expose the closing arc");
    return 1;
  }
  selectedClosingArcDeleteLineContourEdit.selectEntities({ edgeIds: [selectedClosingArcDeleteArc.id] }, { sketchMode: "relations" });
  if (!selectedClosingArcDeleteLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should remove a selected closing contour arc");
    return 1;
  }
  const selectedClosingArcDeleteContour = selectedClosingArcDeleteLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const selectedClosingArcDeleteKeys = new Set(sketchVertices(selectedClosingArcDeleteContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(selectedClosingArcDeleteContour).length !== 3
      || sketchEdges(selectedClosingArcDeleteContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || selectedClosingArcDeleteKeys.has(pointKey([0, 0]))
      || !selectedClosingArcDeleteKeys.has(pointKey([0, 50]))
      || selectedClosingArcDeleteLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || selectedClosingArcDeleteLineContourEdit.activeState().selection.edgeIds.length !== 1
      || selectedClosingArcDeleteLineContourStatus !== "Plate sketch Line Contour: removed selected arc; 3-point contour active"
  ) {
    console.error("FAILED: Line Contour Delete should remove the selected closing arc, preserve surviving arcs, and keep the contour active");
    return 1;
  }
  let altLineContourStatus = "";
  let altLineContourOverlay = null;
  const altLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const altLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        altLineContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: altLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      altLineContourStatus = message;
    }
  });
  altLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  altLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!altLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Alt Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!altLineContourEdit.authoringHandler.pointerMove({
    screen: { x: 60, y: 35 },
    event: { altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: Alt Line Contour pointer move should update the arc preview");
    return 1;
  }
  if (!altLineContourOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview-arc" && line.points.length >= 3)) {
    console.error("FAILED: Alt Line Contour pointer move should render a sampled arc preview for the latest segment");
    return 1;
  }
  if (!altLineContourEdit.handleKey?.({ key: "Enter", code: "Enter", altKey: true })) {
    console.error("FAILED: Alt+Enter in Line Contour should accept the current arc preview");
    return 1;
  }
  const altMixedLineArcContour = altLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(altMixedLineArcContour).length !== 3
      || sketchEdges(altMixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || altLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !altLineContourStatus.includes("arc segment created radius")
  ) {
    console.error("FAILED: Alt+Enter Line Contour should create an arc segment and keep Line Contour active");
    return 1;
  }
  const altArc = sketchEdges(altMixedLineArcContour).find((edge) => edge.kind === "circular-arc");
  if (!altLineContourEdit.authoringHandler.click({
    screen: { x: 55, y: 48 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: Alt-click Line Contour should accept a new through point for the latest arc segment");
    return 1;
  }
  const updatedAltMixedLineArcContour = altLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const updatedAltArc = sketchEdges(updatedAltMixedLineArcContour).find((edge) => edge.kind === "circular-arc");
  if (
    sketchEdges(updatedAltMixedLineArcContour).length !== 3
      || sketchEdges(updatedAltMixedLineArcContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !altArc
      || !updatedAltArc
      || Math.abs(updatedAltArc.radius - altArc.radius) <= 1e-6
      || altLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || !altLineContourStatus.includes("arc segment updated radius")
  ) {
    console.error("FAILED: Alt-click on an existing latest Line Contour arc should update that semantic arc in place");
    return 1;
  }
  let arcBacktrackLineContourStatus = "";
  const arcBacktrackLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const arcBacktrackLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: arcBacktrackLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcBacktrackLineContourStatus = message;
    }
  });
  arcBacktrackLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcBacktrackLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!arcBacktrackLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: latest-arc backtrack Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!arcBacktrackLineContourEdit.authoringHandler.click({
    screen: { x: 60, y: 35 },
    event: { button: 0, detail: 1, altKey: true },
    modifiers: { altKey: true }
  })) {
    console.error("FAILED: latest-arc backtrack setup should convert the latest segment into an arc");
    return 1;
  }
  if (!arcBacktrackLineContourEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Line Contour Delete should revert the latest arc segment before removing points");
    return 1;
  }
  const arcBacktrackedLineContour = arcBacktrackLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcBacktrackedVertexKeys = new Set(sketchVertices(arcBacktrackedLineContour).map((vertex) => pointKey(vertex.point)));
  if (
    sketchEdges(arcBacktrackedLineContour).length !== 3
      || sketchEdges(arcBacktrackedLineContour).some((edge) => edge.kind === "circular-arc")
      || !arcBacktrackedVertexKeys.has(pointKey([30, 35]))
      || arcBacktrackLineContourEdit.activeState().activeSketchTool !== "lineContour"
      || arcBacktrackLineContourEdit.activeState().selection.edgeIds.length !== 1
      || arcBacktrackLineContourStatus !== "Plate sketch Line Contour: latest arc reverted to line; pick next point"
  ) {
    console.error("FAILED: Line Contour Delete should keep the latest point and active tool when reverting the latest arc to a line");
    return 1;
  }
  if (!arcBacktrackLineContourEdit.authoringHandler.click({ screen: { x: 0, y: 50 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Line Contour should accept another point after reverting the latest arc to a line");
    return 1;
  }
  const arcBacktrackedExtendedContour = arcBacktrackLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(arcBacktrackedExtendedContour).length !== 4
      || sketchEdges(arcBacktrackedExtendedContour).some((edge) => edge.kind === "circular-arc")
      || !arcBacktrackLineContourStatus.includes("4-point contour created")
  ) {
    console.error("FAILED: Line Contour should continue as a straight contour after reverting the latest arc");
    return 1;
  }
  let flippedAltLineContourStatus = "";
  let flippedAltLineContourOverlay = null;
  const flippedAltLineContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const flippedAltLineContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        flippedAltLineContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: flippedAltLineContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      flippedAltLineContourStatus = message;
    }
  });
  flippedAltLineContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  flippedAltLineContourEdit.createLineContourSketch();
  for (const point of [[0, 0], [60, 0], [30, 35]]) {
    if (!flippedAltLineContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Shift+Alt Line Contour setup click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!flippedAltLineContourEdit.authoringHandler.pointerMove({
    screen: { x: 60, y: 35 },
    event: { altKey: true, shiftKey: true },
    modifiers: { altKey: true, shiftKey: true }
  })) {
    console.error("FAILED: Shift+Alt Line Contour pointer move should update the flipped arc preview");
    return 1;
  }
  if (
    !flippedAltLineContourOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview-arc" && line.points.length >= 3)
      || !flippedAltLineContourOverlay?.labels?.some((label) => label.text === "Arc preview flipped")
  ) {
    console.error("FAILED: Shift+Alt Line Contour pointer move should render a flipped sampled arc preview");
    return 1;
  }
  if (!flippedAltLineContourEdit.handleKey?.({ key: "Enter", code: "Enter", altKey: true, shiftKey: true })) {
    console.error("FAILED: Shift+Alt+Enter in Line Contour should accept the flipped arc preview");
    return 1;
  }
  const flippedAltMixedLineArcContour = flippedAltLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const flippedAltArc = sketchEdges(flippedAltMixedLineArcContour).find((edge) => edge.kind === "circular-arc");
  if (
    !flippedAltArc
      || !flippedAltLineContourStatus.includes("flipped")
      || !altArc
      || flippedAltArc.direction === altArc.direction
      || flippedAltLineContourEdit.activeState().activeSketchTool !== "lineContour"
  ) {
    console.error("FAILED: Shift+Alt+Enter Line Contour should create a flipped-direction arc and keep Line Contour active");
    return 1;
  }
  if (!altLineContourEdit.authoringHandler.click({ screen: { x: 0, y: 50 }, event: { button: 0, detail: 1 } })) {
    console.error("FAILED: Alt-click Line Contour should continue accepting contour points after arc insertion");
    return 1;
  }
  const altExtendedMixedContour = altLineContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(altExtendedMixedContour).length !== 4
      || sketchEdges(altExtendedMixedContour).filter((edge) => edge.kind === "circular-arc").length !== 1
      || !altLineContourStatus.includes("4-point contour created")
  ) {
    console.error("FAILED: Alt-click Line Contour should preserve the arc when extending the contour");
    return 1;
  }
  if (!altLineContourEdit.authoringHandler.pointerMove({
    screen: { x: 15, y: 65 },
    event: { altKey: true, shiftKey: true },
    modifiers: { altKey: true, shiftKey: true }
  })) {
    console.error("FAILED: Shift+Alt Line Contour pointer move should still work after extending a mixed contour");
    return 1;
  }
  if (
    !altLineContourOverlay?.lines?.some((line) => line.kind === "plate-sketch-tool-preview-arc" && line.points.length >= 3)
      || !altLineContourOverlay?.labels?.some((label) => label.text === "Arc preview flipped")
  ) {
    console.error("FAILED: Shift+Alt Line Contour should preview a flipped arc on the newly extended latest segment");
    return 1;
  }
  const hasSketchToolPreview = (overlay) => Boolean(
    overlay?.lines?.some((line) => String(line.kind || "").startsWith("plate-sketch-tool-preview"))
      || overlay?.handles?.some((handle) => String(handle.kind || "").startsWith("plate-sketch-tool-preview"))
  );
  let centerArcContourEscapeOverlay = null;
  let centerArcContourEscapeStatus = "";
  const centerArcContourEscapeStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const centerArcContourEscapeProjectBefore = JSON.stringify(centerArcContourEscapeStore.project());
  const centerArcContourEscapeEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        centerArcContourEscapeOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: centerArcContourEscapeStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      centerArcContourEscapeStatus = message;
    }
  });
  if (!centerArcContourEscapeEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: Center Arc Contour Escape setup should select the standalone rounded sketch");
    return 1;
  }
  if (!centerArcContourEscapeEdit.createCenterArcContourSketch() || centerArcContourEscapeEdit.activeState().activeSketchTool !== "centerArcContour") {
    console.error("FAILED: Center Arc Contour Escape setup should start the contour tool");
    return 1;
  }
  for (const point of [[0, 0], [30, 0]]) {
    if (!centerArcContourEscapeEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Center Arc Contour Escape setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (
    !centerArcContourEscapeEdit.authoringHandler.pointerMove({ screen: { x: 0, y: 30 }, event: { button: 0, detail: 0 } })
      || centerArcContourEscapeEdit.activeState().activeSketchTool !== "centerArcContour"
      || !hasSketchToolPreview(centerArcContourEscapeOverlay)
      || centerArcContourEscapeStatus !== "Plate sketch Center Arc Contour: pick end point"
  ) {
    console.error("FAILED: Center Arc Contour Escape setup should preview the arc-sector end point");
    return 1;
  }
  if (
    !centerArcContourEscapeEdit.handleKey?.({ key: "Escape", code: "Escape" })
      || centerArcContourEscapeEdit.activeState().activeSketchTool
      || centerArcContourEscapeStatus !== "Plate sketch: sketch tool cancelled"
      || JSON.stringify(centerArcContourEscapeStore.project()) !== centerArcContourEscapeProjectBefore
      || hasSketchToolPreview(centerArcContourEscapeOverlay)
  ) {
    console.error("FAILED: Center Arc Contour Escape should cancel the active arc contour, clear preview, and leave project JSON unchanged");
    return 1;
  }
  if (!centerArcContourEscapeEdit.createCenterArcContourSketch() || centerArcContourEscapeEdit.activeState().activeSketchTool !== "centerArcContour") {
    console.error("FAILED: Center Arc Contour should restart after Escape cancellation");
    return 1;
  }
  let centerArcContourOverlay = null;
  let centerArcContourStatus = "";
  const centerArcContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const centerArcContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        centerArcContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: centerArcContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      centerArcContourStatus = message;
    }
  });
  if (!centerArcContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: Center Arc Contour smoke should select the standalone rounded sketch");
    return 1;
  }
  if (!centerArcContourEdit.createCenterArcContourSketch() || centerArcContourEdit.activeState().activeSketchTool !== "centerArcContour") {
    console.error("FAILED: createCenterArcContourSketch should start a distinct center-arc contour tool");
    return 1;
  }
  for (const point of [[0, 0], [30, 0]]) {
    if (!centerArcContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Center Arc Contour click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!centerArcContourEdit.handleKey?.({ key: "Backspace", code: "Backspace" })) {
    console.error("FAILED: Center Arc Contour Backspace should clear the start point and keep the contour tool active");
    return 1;
  }
  if (
    centerArcContourEdit.activeState().activeSketchTool !== "centerArcContour"
      || centerArcContourStatus !== "Plate sketch Center Arc Contour: pick start point"
  ) {
    console.error("FAILED: Center Arc Contour Backspace should keep the center point and ask for a replacement start point");
    return 1;
  }
  for (const point of [[30, 0], [0, 30]]) {
    if (!centerArcContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: Center Arc Contour click after Backspace should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const centerArcContourResult = centerArcContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const centerArcContourEdges = sketchEdges(centerArcContourResult);
  const centerArcContourArcEdges = centerArcContourEdges.filter((edge) => edge.kind === "circular-arc");
  if (centerArcContourEdges.length !== 3 || centerArcContourArcEdges.length !== 1) {
    console.error("FAILED: interactive Center Arc Contour should replace the active sketch with one closed arc-sector contour");
    return 1;
  }
  if (!sketchRelations(centerArcContourResult).some((relation) => relation.type === "radius" && relation.edgeId === centerArcContourArcEdges[0].id)) {
    console.error("FAILED: interactive Center Arc Contour should add a radius relation to the created arc");
    return 1;
  }
  if (centerArcContourEdit.activeState().activeSketchTool !== "centerArcContour" || !centerArcContourStatus.includes("contour created radius") || !centerArcContourOverlay) {
    console.error("FAILED: interactive Center Arc Contour should stay active, report creation status, and refresh overlay");
    return 1;
  }
  let threePointArcContourEscapeOverlay = null;
  let threePointArcContourEscapeStatus = "";
  const threePointArcContourEscapeStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const threePointArcContourEscapeProjectBefore = JSON.stringify(threePointArcContourEscapeStore.project());
  const threePointArcContourEscapeEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        threePointArcContourEscapeOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: threePointArcContourEscapeStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      threePointArcContourEscapeStatus = message;
    }
  });
  if (!threePointArcContourEscapeEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: 3 Point Arc Contour Escape setup should select the standalone rounded sketch");
    return 1;
  }
  if (!threePointArcContourEscapeEdit.createThreePointArcContourSketch() || threePointArcContourEscapeEdit.activeState().activeSketchTool !== "threePointArcContour") {
    console.error("FAILED: 3 Point Arc Contour Escape setup should start the contour tool");
    return 1;
  }
  for (const point of [[30, 0], [30, 30]]) {
    if (!threePointArcContourEscapeEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: 3 Point Arc Contour Escape setup should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (
    !threePointArcContourEscapeEdit.authoringHandler.pointerMove({ screen: { x: 0, y: 30 }, event: { button: 0, detail: 0 } })
      || threePointArcContourEscapeEdit.activeState().activeSketchTool !== "threePointArcContour"
      || !hasSketchToolPreview(threePointArcContourEscapeOverlay)
      || threePointArcContourEscapeStatus !== "Plate sketch 3 Point Arc Contour: pick end point"
  ) {
    console.error("FAILED: 3 Point Arc Contour Escape setup should preview the arc-sector end point");
    return 1;
  }
  if (
    !threePointArcContourEscapeEdit.handleKey?.({ key: "Escape", code: "Escape" })
      || threePointArcContourEscapeEdit.activeState().activeSketchTool
      || threePointArcContourEscapeStatus !== "Plate sketch: sketch tool cancelled"
      || JSON.stringify(threePointArcContourEscapeStore.project()) !== threePointArcContourEscapeProjectBefore
      || hasSketchToolPreview(threePointArcContourEscapeOverlay)
  ) {
    console.error("FAILED: 3 Point Arc Contour Escape should cancel the active arc contour, clear preview, and leave project JSON unchanged");
    return 1;
  }
  if (!threePointArcContourEscapeEdit.createThreePointArcContourSketch() || threePointArcContourEscapeEdit.activeState().activeSketchTool !== "threePointArcContour") {
    console.error("FAILED: 3 Point Arc Contour should restart after Escape cancellation");
    return 1;
  }
  let threePointArcContourOverlay = null;
  let threePointArcContourStatus = "";
  const threePointArcContourStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const threePointArcContourEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        threePointArcContourOverlay = overlay;
      },
      screenScale: () => 1,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] })
    },
    api: threePointArcContourStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      threePointArcContourStatus = message;
    }
  });
  if (!threePointArcContourEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" })) {
    console.error("FAILED: 3 Point Arc Contour smoke should select the standalone rounded sketch");
    return 1;
  }
  if (!threePointArcContourEdit.createThreePointArcContourSketch() || threePointArcContourEdit.activeState().activeSketchTool !== "threePointArcContour") {
    console.error("FAILED: createThreePointArcContourSketch should start a distinct 3 point arc contour tool");
    return 1;
  }
  for (const point of [[30, 0], [30, 30]]) {
    if (!threePointArcContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: 3 Point Arc Contour click should accept point ${point.join(",")}`);
      return 1;
    }
  }
  if (!threePointArcContourEdit.handleKey?.({ key: "Backspace", code: "Backspace" })) {
    console.error("FAILED: 3 Point Arc Contour Backspace should clear the through point and keep the contour tool active");
    return 1;
  }
  if (
    threePointArcContourEdit.activeState().activeSketchTool !== "threePointArcContour"
      || threePointArcContourStatus !== "Plate sketch 3 Point Arc Contour: pick through point"
  ) {
    console.error("FAILED: 3 Point Arc Contour Backspace should keep the start point and ask for a replacement through point");
    return 1;
  }
  for (const point of [[30, 30], [0, 30]]) {
    if (!threePointArcContourEdit.authoringHandler.click({ screen: { x: point[0], y: point[1] }, event: { button: 0, detail: 1 } })) {
      console.error(`FAILED: 3 Point Arc Contour click after Backspace should accept point ${point.join(",")}`);
      return 1;
    }
  }
  const threePointArcContourResult = threePointArcContourStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const threePointArcContourEdges = sketchEdges(threePointArcContourResult);
  const threePointArcContourArcEdges = threePointArcContourEdges.filter((edge) => edge.kind === "circular-arc");
  if (threePointArcContourEdges.length !== 3 || threePointArcContourArcEdges.length !== 1) {
    console.error("FAILED: interactive 3 Point Arc Contour should replace the active sketch with one closed arc-sector contour");
    return 1;
  }
  if (!sketchRelations(threePointArcContourResult).some((relation) => relation.type === "radius" && relation.edgeId === threePointArcContourArcEdges[0].id)) {
    console.error("FAILED: interactive 3 Point Arc Contour should add a radius relation to the created arc");
    return 1;
  }
  if (threePointArcContourEdit.activeState().activeSketchTool !== "threePointArcContour" || !threePointArcContourStatus.includes("contour created radius") || !threePointArcContourOverlay) {
    console.error("FAILED: interactive 3 Point Arc Contour should stay active, report creation status, and refresh overlay");
    return 1;
  }
  const roundedSketchStore = createProjectStore({ project: roundedSketchProject });
  roundedSketchStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "trim_arc_ce",
    fromVertexId: "trim_arc_cv1",
    toVertexId: "trim_arc_cv2"
  });
  let trimArcOverlay = null;
  let trimArcStatus = "";
  const trimArcSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: (overlay) => {
        trimArcOverlay = overlay;
      },
      screenScale: () => 1
    },
    api: roundedSketchStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      trimArcStatus = message;
    }
  });
  trimArcSketchEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  trimArcSketchEdit.selectEntities({ edgeIds: ["trim_arc_ce"] }, { render: true });
  if (!trimArcOverlay?.handles?.some((handle) => handle.kind === "plate-sketch-construction-edge" && handle.edgeId === "trim_arc_ce")) {
    console.error("FAILED: construction arc should be selectable as a construction edge handle");
    return 1;
  }
  const constructionArcModifierGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  constructionArcModifierGuardStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "guard_arc_ce",
    fromVertexId: "guard_arc_cv1",
    toVertexId: "guard_arc_cv2"
  });
  let constructionArcModifierGuardStatus = "";
  const constructionArcModifierGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: constructionArcModifierGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      constructionArcModifierGuardStatus = message;
    }
  });
  constructionArcModifierGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  constructionArcModifierGuardEdit.selectEntities({ edgeIds: ["guard_arc_ce"] }, { render: true });
  if (constructionArcModifierGuardEdit.convertSelectedEdgeToArc() || constructionArcModifierGuardStatus !== "Plate sketch: Edge Arc works on outline sketch edges") {
    console.error("FAILED: Edge Arc command should reject selected construction arcs before starting the tool");
    return 1;
  }
  if (constructionArcModifierGuardEdit.flipSelectedArc() || constructionArcModifierGuardStatus !== "Plate sketch: Flip Arc works on outline circular arcs") {
    console.error("FAILED: Flip Arc command should reject selected construction arcs before mutating geometry");
    return 1;
  }
  if (constructionArcModifierGuardEdit.splitSelectedArc() || constructionArcModifierGuardStatus !== "Plate sketch: Split Arc works on outline circular arcs") {
    console.error("FAILED: Split Arc command should reject selected construction arcs before mutating geometry");
    return 1;
  }
  const constructionArcModifierGuardSketch = constructionArcModifierGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    !(constructionArcModifierGuardSketch.constructionEdges || []).some((edge) => edge.id === "guard_arc_ce")
      || !(constructionArcModifierGuardSketch.constructionVertices || []).some((vertex) => vertex.id === "guard_arc_cv1")
      || !(constructionArcModifierGuardSketch.constructionVertices || []).some((vertex) => vertex.id === "guard_arc_cv2")
      || constructionArcModifierGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected construction arc modifiers should leave construction geometry and active tool state unchanged");
    return 1;
  }
  const directArcModifierSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directArcModifierSelectionGuardStatus = "";
  const directArcModifierSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directArcModifierSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      directArcModifierSelectionGuardStatus = message;
    }
  });
  directArcModifierSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directArcModifierSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5"]
  }, { render: true });
  const directArcModifierSelectionGuardBefore = JSON.stringify(directArcModifierSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directArcModifierSelectionGuardEdit.convertSelectedEdgeToArc() || directArcModifierSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Edge Arc") {
    console.error("FAILED: direct Edge Arc command should reject a selected arc with extra selected points");
    return 1;
  }
  if (directArcModifierSelectionGuardEdit.flipSelectedArc() || directArcModifierSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Flip Arc") {
    console.error("FAILED: direct Flip Arc command should reject a selected arc with extra selected points");
    return 1;
  }
  if (directArcModifierSelectionGuardEdit.splitSelectedArc() || directArcModifierSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Split Arc") {
    console.error("FAILED: direct Split Arc command should reject a selected arc with extra selected points");
    return 1;
  }
  const directArcModifierSelectionGuardAfter = JSON.stringify(directArcModifierSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directArcModifierSelectionGuardBefore !== directArcModifierSelectionGuardAfter
      || directArcModifierSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct arc modifier commands should not mutate sketch geometry or start a tool");
    return 1;
  }
  const directArcDimensionSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directArcDimensionSelectionGuardStatus = "";
  let directArcDimensionSelectionGuardProject = null;
  const directArcDimensionSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directArcDimensionSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      directArcDimensionSelectionGuardProject = nextProject;
    },
    onStatusChange: (message) => {
      directArcDimensionSelectionGuardStatus = message;
    }
  });
  directArcDimensionSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directArcDimensionSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5"]
  }, { render: true });
  const directArcDimensionSelectionGuardBefore = JSON.stringify(directArcDimensionSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directArcDimensionSelectionGuardEdit.addRadiusDimensionForSelection() || directArcDimensionSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Radius") {
    console.error("FAILED: direct Radius command should reject a selected arc with extra selected points");
    return 1;
  }
  if (directArcDimensionSelectionGuardEdit.addDiameterDimensionForSelection() || directArcDimensionSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Diameter") {
    console.error("FAILED: direct Diameter command should reject a selected arc with extra selected points");
    return 1;
  }
  const directArcDimensionSelectionGuardAfter = JSON.stringify(directArcDimensionSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directArcDimensionSelectionGuardBefore !== directArcDimensionSelectionGuardAfter
      || directArcDimensionSelectionGuardProject
      || directArcDimensionSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct arc dimension commands should not mutate sketch geometry, publish a project update, or start a tool");
    return 1;
  }
  const directLineDimensionSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directLineDimensionSelectionGuardStatus = "";
  let directLineDimensionSelectionGuardProject = null;
  const directLineDimensionSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directLineDimensionSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      directLineDimensionSelectionGuardProject = nextProject;
    },
    onStatusChange: (message) => {
      directLineDimensionSelectionGuardStatus = message;
    }
  });
  directLineDimensionSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directLineDimensionSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5"]
  }, { render: true });
  const directLineDimensionSelectionGuardBefore = JSON.stringify(directLineDimensionSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directLineDimensionSelectionGuardEdit.addLengthDimensionForSelection() || directLineDimensionSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Length") {
    console.error("FAILED: direct Length command should reject a selected arc with extra selected points");
    return 1;
  }
  directLineDimensionSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v3"]
  }, { render: true });
  if (directLineDimensionSelectionGuardEdit.addAngleDimensionForSelection() || directLineDimensionSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using Angle") {
    console.error("FAILED: direct Angle command should reject selected edges with extra selected points");
    return 1;
  }
  directLineDimensionSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5", "rounded_sketch_arc_demo_cp1"]
  }, { render: true });
  if (directLineDimensionSelectionGuardEdit.addDistanceDimensionForSelection() || directLineDimensionSelectionGuardStatus !== "Plate sketch: clear selected sketch edges before using Distance") {
    console.error("FAILED: direct Distance command should reject two selected points with an extra selected edge");
    return 1;
  }
  const directLineDimensionSelectionGuardAfter = JSON.stringify(directLineDimensionSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directLineDimensionSelectionGuardBefore !== directLineDimensionSelectionGuardAfter
      || directLineDimensionSelectionGuardProject
      || directLineDimensionSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct line dimension commands should not mutate sketch geometry, publish a project update, or start a tool");
    return 1;
  }
  const directFilletSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directFilletSelectionGuardStatus = "";
  let directFilletSelectionGuardProject = null;
  const directFilletSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directFilletSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      directFilletSelectionGuardProject = nextProject;
    },
    onStatusChange: (message) => {
      directFilletSelectionGuardStatus = message;
    }
  });
  directFilletSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directFilletSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1"],
    vertexIds: ["rounded_sketch_arc_demo_v1"]
  }, { render: true });
  const directFilletSelectionGuardBefore = JSON.stringify(directFilletSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directFilletSelectionGuardEdit.filletSelectedCorner() || directFilletSelectionGuardStatus !== "Plate sketch: clear selected sketch edges before using Fillet") {
    console.error("FAILED: direct Fillet command should reject a selected outline corner with extra selected edges");
    return 1;
  }
  const directFilletSelectionGuardAfter = JSON.stringify(directFilletSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directFilletSelectionGuardBefore !== directFilletSelectionGuardAfter
      || directFilletSelectionGuardProject
      || directFilletSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct Fillet command should not mutate sketch geometry, publish a project update, or start a tool");
    return 1;
  }
  const directCoincidentSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directCoincidentSelectionGuardStatus = "";
  let directCoincidentSelectionGuardProject = null;
  const directCoincidentSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directCoincidentSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      directCoincidentSelectionGuardProject = nextProject;
    },
    onStatusChange: (message) => {
      directCoincidentSelectionGuardStatus = message;
    }
  });
  directCoincidentSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directCoincidentSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5", "rounded_sketch_arc_demo_cp1"]
  }, { render: true });
  const directCoincidentSelectionGuardBefore = JSON.stringify(directCoincidentSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directCoincidentSelectionGuardEdit.addCoincidentRelationForSelection() || directCoincidentSelectionGuardStatus !== "Plate sketch: clear selected sketch edges before using Coincident") {
    console.error("FAILED: direct Coincident command should reject two selected sketch points with an extra selected edge");
    return 1;
  }
  const directCoincidentSelectionGuardAfter = JSON.stringify(directCoincidentSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directCoincidentSelectionGuardBefore !== directCoincidentSelectionGuardAfter
      || directCoincidentSelectionGuardProject
      || directCoincidentSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct Coincident command should not mutate sketch relations, publish a project update, or start a tool");
    return 1;
  }
  const directPointOnCircleSelectionGuardStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let directPointOnCircleSelectionGuardStatus = "";
  let directPointOnCircleSelectionGuardProject = null;
  const directPointOnCircleSelectionGuardEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: directPointOnCircleSelectionGuardStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      directPointOnCircleSelectionGuardProject = nextProject;
    },
    onStatusChange: (message) => {
      directPointOnCircleSelectionGuardStatus = message;
    }
  });
  directPointOnCircleSelectionGuardEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  directPointOnCircleSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_v5", "rounded_sketch_arc_demo_cp1"]
  }, { render: true });
  const directPointOnCircleSelectionGuardBefore = JSON.stringify(directPointOnCircleSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (directPointOnCircleSelectionGuardEdit.addPointOnCircleRelationForSelection() || directPointOnCircleSelectionGuardStatus !== "Plate sketch: clear selected sketch points before using On Circle") {
    console.error("FAILED: direct Point On Circle command should reject one selected arc with extra selected points");
    return 1;
  }
  directPointOnCircleSelectionGuardEdit.selectEntities({
    edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"],
    vertexIds: ["rounded_sketch_arc_demo_cp1"]
  }, { render: true });
  if (directPointOnCircleSelectionGuardEdit.addPointOnCircleRelationForSelection() || directPointOnCircleSelectionGuardStatus !== "Plate sketch: clear selected sketch edges before using On Circle") {
    console.error("FAILED: direct Point On Circle command should reject one selected point with extra selected edges");
    return 1;
  }
  const directPointOnCircleSelectionGuardAfter = JSON.stringify(directPointOnCircleSelectionGuardStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  if (
    directPointOnCircleSelectionGuardBefore !== directPointOnCircleSelectionGuardAfter
      || directPointOnCircleSelectionGuardProject
      || directPointOnCircleSelectionGuardEdit.activeState().activeSketchTool
  ) {
    console.error("FAILED: rejected direct Point On Circle commands should not mutate sketch relations, publish a project update, or start a tool");
    return 1;
  }
  const standaloneInferProject = JSON.parse(JSON.stringify(roundedSketchProject));
  standaloneInferProject.model.sketches.rounded_sketch_arc_demo.sketch.relations = [];
  const standaloneInferStore = createProjectStore({ project: standaloneInferProject });
  let standaloneInferStatus = "";
  let standaloneInferProjectUpdate = null;
  const standaloneInferEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: standaloneInferStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onProjectChange: (nextProject) => {
      standaloneInferProjectUpdate = nextProject;
    },
    onStatusChange: (message) => {
      standaloneInferStatus = message;
    }
  });
  standaloneInferEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  if (!standaloneInferEdit.inferRelations() || standaloneInferStatus !== "Plate sketch: inferred sketch relations") {
    console.error("FAILED: direct Infer Relations should run on a standalone rounded sketch");
    return 1;
  }
  const standaloneInferredRelations = sketchRelations(standaloneInferStore.project().model.sketches.rounded_sketch_arc_demo.sketch);
  const standaloneInferredSketch = standaloneInferStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    !standaloneInferProjectUpdate
      || !standaloneInferredRelations.some((relation) => relation.type === "horizontal")
      || !standaloneInferredRelations.some((relation) => relation.type === "vertical")
      || standaloneInferredRelations.filter((relation) => relation.type === "tangent").length < 4
      || !standaloneInferredRelations.some((relation) => relation.type === "equal-radius")
      || standaloneInferredRelations.some((relation) => (
        ["horizontal", "vertical", "perpendicular", "parallel", "equal-length"].includes(relation.type)
          && (relation.edgeId
            ? sketchEdgeIsCircularArc(standaloneInferredSketch, relation.edgeId)
            : (relation.edgeIds || []).some((edgeId) => sketchEdgeIsCircularArc(standaloneInferredSketch, edgeId)))
      ))
  ) {
    console.error("FAILED: standalone Infer Relations should publish line-only and arc-aware inferred relations without attaching line-only relations to circular arcs");
    return 1;
  }
  const constructionArcDimensionCommandStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  constructionArcDimensionCommandStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "dimension_arc_ce",
    fromVertexId: "dimension_arc_cv1",
    toVertexId: "dimension_arc_cv2"
  });
  let constructionArcDimensionCommandStatus = "";
  const constructionArcDimensionCommandEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: constructionArcDimensionCommandStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      constructionArcDimensionCommandStatus = message;
    }
  });
  constructionArcDimensionCommandEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  constructionArcDimensionCommandEdit.selectEntities({ edgeIds: ["dimension_arc_ce"] }, { render: true });
  if (!constructionArcDimensionCommandEdit.addRadiusDimensionForSelection() || !constructionArcDimensionCommandStatus.includes("added reference radius")) {
    console.error("FAILED: direct Radius command should add a reference radius to a selected construction arc");
    return 1;
  }
  const constructionRadiusRelation = sketchRelations(constructionArcDimensionCommandStore.project().model.sketches.rounded_sketch_arc_demo.sketch)
    .find((relation) => relation.type === "radius" && relation.edgeId === "dimension_arc_ce");
  if (!constructionRadiusRelation || constructionRadiusRelation.display === "diameter" || constructionRadiusRelation.mode !== "driven") {
    console.error("FAILED: direct Radius command should store a driven radius-display relation on the construction arc");
    return 1;
  }
  constructionArcDimensionCommandEdit.selectEntities({ edgeIds: ["dimension_arc_ce"] }, { render: true });
  if (!constructionArcDimensionCommandEdit.addDiameterDimensionForSelection() || !constructionArcDimensionCommandStatus.includes("added reference diameter")) {
    console.error("FAILED: direct Diameter command should update the selected construction arc radius relation");
    return 1;
  }
  const constructionDiameterSketch = constructionArcDimensionCommandStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const constructionDiameterRelations = sketchRelations(constructionDiameterSketch)
    .filter((relation) => relation.type === "radius" && relation.edgeId === "dimension_arc_ce");
  if (
    constructionDiameterRelations.length !== 1
      || constructionDiameterRelations[0].display !== "diameter"
      || constructionDiameterRelations[0].mode !== "driven"
      || !(constructionDiameterSketch.constructionEdges || []).some((edge) => edge.id === "dimension_arc_ce" && edge.kind === "circular-arc")
  ) {
    console.error("FAILED: direct Diameter command should keep one driven diameter-display relation while preserving the semantic construction arc");
    return 1;
  }
  if (!trimArcSketchEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should remove a selected construction arc");
    return 1;
  }
  const trimmedArcSketch = roundedSketchStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(trimmedArcSketch).some((edge) => edge.id === "trim_arc_ce")
      || (trimmedArcSketch.constructionEdges || []).some((edge) => edge.id === "trim_arc_ce")
      || sketchVertices(trimmedArcSketch).some((vertex) => vertex.id === "trim_arc_cv1" || vertex.id === "trim_arc_cv2")
      || (trimmedArcSketch.constructionVertices || []).some((vertex) => vertex.id === "trim_arc_cv1" || vertex.id === "trim_arc_cv2")
      || trimArcStatus !== "Plate sketch: construction edge trimmed"
  ) {
    console.error("FAILED: Sketch Trim should remove construction arc edge, orphaned vertices, and report construction edge status");
    return 1;
  }
  const deleteArcStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  deleteArcStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "delete_arc_ce",
    fromVertexId: "delete_arc_cv1",
    toVertexId: "delete_arc_cv2"
  });
  let deleteArcStatus = "";
  const deleteArcSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: deleteArcStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      deleteArcStatus = message;
    }
  });
  deleteArcSketchEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  deleteArcSketchEdit.selectEntities({ edgeIds: ["delete_arc_ce"] }, { render: true });
  if (!deleteArcSketchEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Sketch Delete should remove a selected construction arc");
    return 1;
  }
  const deletedArcSketch = deleteArcStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    (deletedArcSketch.constructionEdges || []).some((edge) => edge.id === "delete_arc_ce")
      || (deletedArcSketch.constructionVertices || []).some((vertex) => vertex.id === "delete_arc_cv1" || vertex.id === "delete_arc_cv2")
      || deleteArcSketchEdit.activeState().selection.edgeIds.length
      || deleteArcStatus !== "Plate sketch: construction arc deleted"
  ) {
    console.error("FAILED: Sketch Delete should remove construction arc edge, orphaned vertices, clear selection, and report construction arc status");
    return 1;
  }
  const deleteOutlineArcStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  let deleteOutlineArcStatus = "";
  const deleteOutlineArcSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: deleteOutlineArcStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      deleteOutlineArcStatus = message;
    }
  });
  deleteOutlineArcSketchEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  deleteOutlineArcSketchEdit.selectEntities({ edgeIds: ["rounded_sketch_arc_demo_e2"] }, { render: true });
  if (!deleteOutlineArcSketchEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Sketch Delete should remove a selected outline circular arc");
    return 1;
  }
  const deletedOutlineArcSketch = deleteOutlineArcStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const deletedOutlineArcEdges = sketchEdges(deletedOutlineArcSketch);
  if (
    deletedOutlineArcEdges.some((edge) => edge.id === "rounded_sketch_arc_demo_e2")
      || sketchVertices(deletedOutlineArcSketch).some((vertex) => vertex.id === "rounded_sketch_arc_demo_v3")
      || deletedOutlineArcEdges.filter((edge) => edge.kind === "circular-arc").length !== 3
      || !deletedOutlineArcEdges.some((edge) => edge.id === "rounded_sketch_arc_demo_e4" && edge.kind === "circular-arc")
      || sketchRelations(deletedOutlineArcSketch).some((relation) => relation.edgeId === "rounded_sketch_arc_demo_e2" || relation.edgeIds?.includes("rounded_sketch_arc_demo_e2"))
      || deleteOutlineArcSketchEdit.activeState().selection.edgeIds.length
      || deleteOutlineArcStatus !== "Plate sketch: arc deleted"
  ) {
    console.error("FAILED: Sketch Delete should remove selected outline arc while preserving surviving semantic arcs and clearing stale relations");
    return 1;
  }
  const deleteArcPointStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  deleteArcPointStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "delete_arc_point_ce",
    fromVertexId: "delete_arc_point_cv1",
    toVertexId: "delete_arc_point_cv2"
  });
  let deleteArcPointStatus = "";
  const deleteArcPointSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: deleteArcPointStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      deleteArcPointStatus = message;
    }
  });
  deleteArcPointSketchEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  deleteArcPointSketchEdit.selectEntities({ vertexIds: ["delete_arc_point_cv1"] }, { render: true });
  if (!deleteArcPointSketchEdit.removeSelectedSketchEntity()) {
    console.error("FAILED: Sketch Delete should remove a construction arc from one selected construction endpoint");
    return 1;
  }
  const deletedArcPointSketch = deleteArcPointStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    (deletedArcPointSketch.constructionEdges || []).some((edge) => edge.id === "delete_arc_point_ce")
      || (deletedArcPointSketch.constructionVertices || []).some((vertex) => vertex.id === "delete_arc_point_cv1" || vertex.id === "delete_arc_point_cv2")
      || deleteArcPointSketchEdit.activeState().selection.vertexIds.length
      || deleteArcPointStatus !== "Plate sketch: construction arc deleted"
  ) {
    console.error("FAILED: Sketch Delete should treat a selected construction endpoint as deleting its construction arc and clear orphaned construction vertices");
    return 1;
  }
  const fixConstructionPointStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  fixConstructionPointStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "fix_point_ce",
    fromVertexId: "fix_point_cv1",
    toVertexId: "fix_point_cv2"
  });
  let fixConstructionPointStatus = "";
  const fixConstructionPointEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: fixConstructionPointStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      fixConstructionPointStatus = message;
    }
  });
  fixConstructionPointEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  fixConstructionPointEdit.selectEntities({ vertexIds: ["fix_point_cv1"] }, { render: true });
  if (!fixConstructionPointEdit.toggleFixedRelationForSelection()) {
    console.error("FAILED: Sketch Fix should accept a selected construction point");
    return 1;
  }
  const fixedConstructionPointSketch = fixConstructionPointStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    !sketchRelations(fixedConstructionPointSketch).some((relation) => relation.type === "fixed" && relation.vertexId === "fix_point_cv1")
      || fixConstructionPointStatus !== "Plate sketch: construction point fixed"
  ) {
    console.error("FAILED: Sketch Fix should add a fixed relation to a construction point and report construction point status");
    return 1;
  }
  fixConstructionPointEdit.selectEntities({ vertexIds: ["fix_point_cv1"] }, { render: true });
  if (!fixConstructionPointEdit.toggleFixedRelationForSelection()) {
    console.error("FAILED: Sketch Fix should unfix a selected construction point");
    return 1;
  }
  const unfixedConstructionPointSketch = fixConstructionPointStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchRelations(unfixedConstructionPointSketch).some((relation) => relation.type === "fixed" && relation.vertexId === "fix_point_cv1")
      || fixConstructionPointStatus !== "Plate sketch: construction point unfixed"
  ) {
    console.error("FAILED: Sketch Fix should remove a fixed relation from a construction point and report construction point status");
    return 1;
  }
  const filletConstructionPointStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  filletConstructionPointStore.addSketchConstructionArc("rounded_sketch_arc_demo", [0, 0], [40, 0], [0, 40], {
    edgeId: "fillet_point_ce",
    fromVertexId: "fillet_point_cv1",
    toVertexId: "fillet_point_cv2"
  });
  let filletConstructionPointStatus = "";
  const filletConstructionPointEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: filletConstructionPointStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      filletConstructionPointStatus = message;
    }
  });
  filletConstructionPointEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  filletConstructionPointEdit.selectEntities({ vertexIds: ["fillet_point_cv1"] }, { render: true });
  if (filletConstructionPointEdit.filletSelectedCorner() || filletConstructionPointStatus !== "Plate sketch: Fillet works on outline sketch corners") {
    console.error("FAILED: Sketch Fillet should reject a selected construction point before calling topology fillet");
    return 1;
  }
  const filletConstructionPointSketch = filletConstructionPointStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    !(filletConstructionPointSketch.constructionEdges || []).some((edge) => edge.id === "fillet_point_ce")
      || !(filletConstructionPointSketch.constructionVertices || []).some((vertex) => vertex.id === "fillet_point_cv1")
      || !(filletConstructionPointSketch.constructionVertices || []).some((vertex) => vertex.id === "fillet_point_cv2")
  ) {
    console.error("FAILED: rejected construction-point Fillet should leave construction geometry unchanged");
    return 1;
  }
  let outlineTrimStatus = "";
  const outlineTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const outlineTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: outlineTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      outlineTrimStatus = message;
    }
  });
  outlineTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  outlineTrimEdit.selectEntities({ edgeIds: ["rounded_sketch_arc_demo_e2"] }, { render: true });
  if (!outlineTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim a selected outline arc while preserving a closed contour");
    return 1;
  }
  const trimmedOutlineArcSketch = outlineTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    sketchEdges(trimmedOutlineArcSketch).length !== 7
      || sketchVertices(trimmedOutlineArcSketch).length !== 7
      || sketchEdges(trimmedOutlineArcSketch).some((edge) => edge.id === "rounded_sketch_arc_demo_e2")
      || sketchEdges(trimmedOutlineArcSketch).filter((edge) => edge.kind === "circular-arc").length !== 3
      || outlineTrimStatus !== "Plate sketch: outline arc trimmed"
  ) {
    console.error("FAILED: Sketch Trim should remove the selected outline arc endpoint, drop the arc, keep the loop closed, and report outline arc status");
    return 1;
  }
  let singleLineEndpointTrimStatus = "";
  const singleLineEndpointTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  singleLineEndpointTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [60, 0],
      [60, 40],
      [0, 40]
    ],
    idPrefix: "single_line_endpoint_trim"
  });
  const singleLineEndpointTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: singleLineEndpointTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      singleLineEndpointTrimStatus = message;
    }
  });
  singleLineEndpointTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  singleLineEndpointTrimEdit.selectEntities({
    edgeIds: ["single_line_endpoint_trim_e1"],
    vertexIds: ["single_line_endpoint_trim_v1"]
  }, { render: true });
  if (!singleLineEndpointTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim a selected single outline line endpoint");
    return 1;
  }
  const singleLineEndpointTrimSketch = singleLineEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    singleLineEndpointTrimStatus !== "Plate sketch: outline edge trimmed"
      || sketchEdges(singleLineEndpointTrimSketch).length !== 3
      || sketchVertices(singleLineEndpointTrimSketch).length !== 3
      || sketchVertices(singleLineEndpointTrimSketch).some((vertex) => vertex.id === "single_line_endpoint_trim_v1")
      || !sketchVertices(singleLineEndpointTrimSketch).some((vertex) => vertex.id === "single_line_endpoint_trim_v2")
      || !sketchVertices(singleLineEndpointTrimSketch).some((vertex) => pointKey(vertex.point) === pointKey([60, 0]))
  ) {
    console.error("FAILED: Sketch Trim should remove the selected line endpoint rather than the default endpoint");
    return 1;
  }
  let singleArcEndpointTrimStatus = "";
  const singleArcEndpointTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const singleArcEndpointTrimBefore = singleArcEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const singleArcEndpointTrimEdge = sketchEdges(singleArcEndpointTrimBefore).find((edge) => edge.id === "rounded_sketch_arc_demo_e2");
  if (!singleArcEndpointTrimEdge?.from || !singleArcEndpointTrimEdge?.to) {
    console.error("FAILED: single arc endpoint trim fixture should include rounded_sketch_arc_demo_e2 endpoints");
    return 1;
  }
  const singleArcEndpointTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: singleArcEndpointTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      singleArcEndpointTrimStatus = message;
    }
  });
  singleArcEndpointTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  singleArcEndpointTrimEdit.selectEntities({
    edgeIds: [singleArcEndpointTrimEdge.id],
    vertexIds: [singleArcEndpointTrimEdge.from]
  }, { render: true });
  if (!singleArcEndpointTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim a selected single outline arc endpoint");
    return 1;
  }
  const singleArcEndpointTrimSketch = singleArcEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    singleArcEndpointTrimStatus !== "Plate sketch: outline arc trimmed"
      || sketchEdges(singleArcEndpointTrimSketch).length !== sketchEdges(singleArcEndpointTrimBefore).length - 1
      || sketchVertices(singleArcEndpointTrimSketch).length !== sketchVertices(singleArcEndpointTrimBefore).length - 1
      || sketchEdges(singleArcEndpointTrimSketch).some((edge) => edge.id === singleArcEndpointTrimEdge.id)
      || sketchVertices(singleArcEndpointTrimSketch).some((vertex) => vertex.id === singleArcEndpointTrimEdge.from)
      || !sketchVertices(singleArcEndpointTrimSketch).some((vertex) => vertex.id === singleArcEndpointTrimEdge.to)
  ) {
    console.error("FAILED: Sketch Trim should remove the selected arc endpoint rather than the default endpoint");
    return 1;
  }
  let singleEdgeMultiEndpointTrimStatus = "";
  const singleEdgeMultiEndpointTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  const singleEdgeMultiEndpointTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: singleEdgeMultiEndpointTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      singleEdgeMultiEndpointTrimStatus = message;
    }
  });
  singleEdgeMultiEndpointTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  const singleEdgeMultiEndpointSketchBefore = singleEdgeMultiEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const singleEndpointChoiceEdge = sketchEdges(singleEdgeMultiEndpointSketchBefore)
    .find((edge) => edge.id === "rounded_sketch_arc_demo_e2");
  if (!singleEndpointChoiceEdge) {
    console.error("FAILED: Sketch Trim endpoint-choice fixture should include rounded_sketch_arc_demo_e2");
    return 1;
  }
  singleEdgeMultiEndpointTrimEdit.selectEntities({
    edgeIds: [singleEndpointChoiceEdge.id],
    vertexIds: [singleEndpointChoiceEdge.from, singleEndpointChoiceEdge.to]
  }, { render: true });
  if (!singleEdgeMultiEndpointTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should handle multiple selected endpoints on one selected outline edge");
    return 1;
  }
  const singleEdgeMultiEndpointSketchAfter = singleEdgeMultiEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    singleEdgeMultiEndpointTrimStatus !== "Plate sketch: Trim accepts at most one endpoint on the selected edge."
      || sketchEdges(singleEdgeMultiEndpointSketchAfter).length !== sketchEdges(singleEdgeMultiEndpointSketchBefore).length
      || sketchVertices(singleEdgeMultiEndpointSketchAfter).length !== sketchVertices(singleEdgeMultiEndpointSketchBefore).length
      || !sketchEdges(singleEdgeMultiEndpointSketchAfter).some((edge) => edge.id === singleEndpointChoiceEdge.id)
      || !sketchVertices(singleEdgeMultiEndpointSketchAfter).some((vertex) => vertex.id === singleEndpointChoiceEdge.from)
      || !sketchVertices(singleEdgeMultiEndpointSketchAfter).some((vertex) => vertex.id === singleEndpointChoiceEdge.to)
  ) {
    console.error("FAILED: Sketch Trim should reject multiple endpoint choices on one selected outline edge with a specific status and no geometry change");
    return 1;
  }
  let intersectionTrimStatus = "";
  const intersectionTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  intersectionTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [60, 0],
      [0, 60],
      [60, 60]
    ],
    idPrefix: "partial_trim"
  });
  const intersectionTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: intersectionTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      intersectionTrimStatus = message;
    }
  });
  intersectionTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  intersectionTrimEdit.selectEntities({ edgeIds: ["partial_trim_e2", "partial_trim_e4"] }, { render: true });
  if (!intersectionTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim a selected outline line to a selected crossing outline line");
    return 1;
  }
  const intersectionTrimSketch = intersectionTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const intersectionVertex = sketchVertices(intersectionTrimSketch).find((vertex) => (
    Math.abs(vertex.point[0] - 30) <= 1e-6 && Math.abs(vertex.point[1] - 30) <= 1e-6
  ));
  if (
    !intersectionVertex
      || sketchVertices(intersectionTrimSketch).some((vertex) => vertex.id === "partial_trim_v3")
      || sketchEdges(intersectionTrimSketch).length !== 4
      || sketchVertices(intersectionTrimSketch).length !== 4
      || intersectionTrimStatus !== "Plate sketch: outline edge trimmed to intersection"
  ) {
    console.error("FAILED: Sketch Trim should split the first selected outline line at the crossing, remove the default endpoint side, and keep a closed outline");
    return 1;
  }
  let multiEndpointTrimStatus = "";
  const multiEndpointTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  multiEndpointTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [60, 0],
      [0, 60],
      [60, 60]
    ],
    idPrefix: "multi_endpoint_trim"
  });
  const multiEndpointTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: multiEndpointTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      multiEndpointTrimStatus = message;
    }
  });
  multiEndpointTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  multiEndpointTrimEdit.selectEntities({
    edgeIds: ["multi_endpoint_trim_e2", "multi_endpoint_trim_e4"],
    vertexIds: ["multi_endpoint_trim_v2", "multi_endpoint_trim_v4"]
  }, { render: true });
  if (!multiEndpointTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should handle multiple selected endpoints on intersecting outline edges");
    return 1;
  }
  const multiEndpointTrimSketch = multiEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    multiEndpointTrimStatus !== "Plate sketch: intersection Trim accepts at most one endpoint across the selected edges."
      || sketchEdges(multiEndpointTrimSketch).length !== 4
      || sketchVertices(multiEndpointTrimSketch).length !== 4
      || !sketchVertices(multiEndpointTrimSketch).some((vertex) => vertex.id === "multi_endpoint_trim_v2")
      || !sketchVertices(multiEndpointTrimSketch).some((vertex) => vertex.id === "multi_endpoint_trim_v4")
  ) {
    console.error("FAILED: Sketch Trim should reject multiple endpoint choices with a specific status and no geometry change");
    return 1;
  }
  let extendTrimStatus = "";
  const extendTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  extendTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "extend_trim"
  });
  const extendTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: extendTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      extendTrimStatus = message;
    }
  });
  extendTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  extendTrimEdit.selectEntities({ edgeIds: ["extend_trim_e1", "extend_trim_e3"] }, { render: true });
  if (!extendTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should extend the first selected outline line to the second selected outline line");
    return 1;
  }
  const extendTrimSketch = extendTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const extendedVertex = sketchVertices(extendTrimSketch).find((vertex) => vertex.id === "extend_trim_v2");
  if (
    !extendedVertex
      || Math.abs(extendedVertex.point[0] - 60) > 1e-6
      || Math.abs(extendedVertex.point[1]) > 1e-6
      || sketchEdges(extendTrimSketch).length !== 4
      || sketchVertices(extendTrimSketch).length !== 4
      || extendTrimStatus !== "Plate sketch: outline edge extended to intersection"
  ) {
    console.error("FAILED: Sketch Trim should move the natural endpoint to the extended intersection while preserving closed topology");
    return 1;
  }
  let explicitExtendStatus = "";
  const explicitExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  explicitExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "explicit_extend"
  });
  const explicitExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: explicitExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      explicitExtendStatus = message;
    }
  });
  explicitExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  explicitExtendEdit.selectEntities({ edgeIds: ["explicit_extend_e1", "explicit_extend_e3"] }, { render: true });
  if (!explicitExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should extend the first selected outline line to the second selected outline line");
    return 1;
  }
  const explicitExtendSketch = explicitExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitExtendedVertex = sketchVertices(explicitExtendSketch).find((vertex) => vertex.id === "explicit_extend_v2");
  if (
    !explicitExtendedVertex
      || Math.abs(explicitExtendedVertex.point[0] - 60) > 1e-6
      || Math.abs(explicitExtendedVertex.point[1]) > 1e-6
      || sketchEdges(explicitExtendSketch).length !== 4
      || sketchVertices(explicitExtendSketch).length !== 4
      || explicitExtendStatus !== "Plate sketch: outline edge extended to intersection"
  ) {
    console.error("FAILED: Sketch Extend should move the natural endpoint to the extended intersection while preserving closed topology");
    return 1;
  }
  let intersectingExtendStatus = "";
  const intersectingExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  intersectingExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [60, 0],
      [0, 60],
      [60, 60]
    ],
    idPrefix: "intersecting_extend"
  });
  const intersectingExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: intersectingExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      intersectingExtendStatus = message;
    }
  });
  intersectingExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  intersectingExtendEdit.selectEntities({ edgeIds: ["intersecting_extend_e2", "intersecting_extend_e4"] }, { render: true });
  if (!intersectingExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should handle already-intersecting outline edges without running Trim");
    return 1;
  }
  const intersectingExtendSketch = intersectingExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  if (
    intersectingExtendStatus !== "Plate sketch: selected outline edges already intersect; use Trim to remove a side."
      || sketchEdges(intersectingExtendSketch).length !== 4
      || sketchVertices(intersectingExtendSketch).length !== 4
      || !sketchVertices(intersectingExtendSketch).some((vertex) => vertex.id === "intersecting_extend_v3")
      || sketchVertices(intersectingExtendSketch).some((vertex) => (
        Math.abs(vertex.point[0] - 30) <= 1e-6 && Math.abs(vertex.point[1] - 30) <= 1e-6
      ))
  ) {
    console.error("FAILED: Sketch Extend should reject already-intersecting edges with a specific status and no trim mutation");
    return 1;
  }
  let arcExtendTrimStatus = "";
  const arcExtendTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcExtendTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "arc_extend_trim"
  });
  arcExtendTrimStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_extend_trim_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const arcExtendTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcExtendTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcExtendTrimStatus = message;
    }
  });
  arcExtendTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcExtendTrimEdit.selectEntities({ edgeIds: ["arc_extend_trim_e1", "arc_extend_trim_e3"] }, { render: true });
  if (!arcExtendTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should extend the first selected outline line to a selected circular arc");
    return 1;
  }
  const arcExtendTrimSketch = arcExtendTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcExtendedVertex = sketchVertices(arcExtendTrimSketch).find((vertex) => vertex.id === "arc_extend_trim_v2");
  const arcCutEdge = sketchEdges(arcExtendTrimSketch).find((edge) => edge.id === "arc_extend_trim_e3");
  if (
    !arcExtendedVertex
      || Math.abs(arcExtendedVertex.point[0] - 50) > 1e-6
      || Math.abs(arcExtendedVertex.point[1]) > 1e-6
      || arcCutEdge?.kind !== "circular-arc"
      || sketchEdges(arcExtendTrimSketch).length !== 4
      || sketchVertices(arcExtendTrimSketch).length !== 4
      || arcExtendTrimStatus !== "Plate sketch: outline edge extended to arc"
  ) {
    console.error("FAILED: Sketch Trim should extend a straight outline endpoint to the selected analytic arc while preserving closed topology");
    return 1;
  }
  let reversedEndpointTrimStatus = "";
  const reversedEndpointTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  reversedEndpointTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "reversed_endpoint_trim"
  });
  reversedEndpointTrimStore.setSketchEdgeArc("rounded_sketch_arc_demo", "reversed_endpoint_trim_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const reversedEndpointTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: reversedEndpointTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      reversedEndpointTrimStatus = message;
    }
  });
  reversedEndpointTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  reversedEndpointTrimEdit.selectEntities({
    edgeIds: ["reversed_endpoint_trim_e3", "reversed_endpoint_trim_e1"],
    vertexIds: ["reversed_endpoint_trim_v2"]
  }, { render: true });
  if (!reversedEndpointTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should use a selected endpoint on the second selected edge as the trim side");
    return 1;
  }
  const reversedEndpointTrimSketch = reversedEndpointTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const reversedEndpointTrimVertex = sketchVertices(reversedEndpointTrimSketch).find((vertex) => vertex.id === "reversed_endpoint_trim_v2");
  const reversedEndpointTrimArc = sketchEdges(reversedEndpointTrimSketch).find((edge) => edge.id === "reversed_endpoint_trim_e3");
  if (
    !reversedEndpointTrimVertex
      || Math.abs(reversedEndpointTrimVertex.point[0] - 50) > 1e-6
      || Math.abs(reversedEndpointTrimVertex.point[1]) > 1e-6
      || reversedEndpointTrimArc?.kind !== "circular-arc"
      || sketchEdges(reversedEndpointTrimSketch).length !== 4
      || sketchVertices(reversedEndpointTrimSketch).length !== 4
      || reversedEndpointTrimStatus !== "Plate sketch: outline edge extended to arc"
  ) {
    console.error("FAILED: Sketch Trim should swap trim/cut edges when the selected endpoint belongs to the second edge");
    return 1;
  }
  let arcExtendWrongEndpointStatus = "";
  const arcExtendWrongEndpointStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcExtendWrongEndpointStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "arc_extend_wrong_endpoint"
  });
  arcExtendWrongEndpointStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_extend_wrong_endpoint_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const arcExtendWrongEndpointEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcExtendWrongEndpointStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcExtendWrongEndpointStatus = message;
    }
  });
  arcExtendWrongEndpointEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcExtendWrongEndpointEdit.selectEntities({
    edgeIds: ["arc_extend_wrong_endpoint_e1", "arc_extend_wrong_endpoint_e3"],
    vertexIds: ["arc_extend_wrong_endpoint_v1"]
  }, { render: true });
  if (!arcExtendWrongEndpointEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should handle a selected wrong endpoint for line-to-arc extend");
    return 1;
  }
  const arcExtendWrongEndpointSketch = arcExtendWrongEndpointStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcExtendWrongEndpointStart = sketchVertices(arcExtendWrongEndpointSketch).find((vertex) => vertex.id === "arc_extend_wrong_endpoint_v1");
  const arcExtendWrongEndpointEnd = sketchVertices(arcExtendWrongEndpointSketch).find((vertex) => vertex.id === "arc_extend_wrong_endpoint_v2");
  if (
    arcExtendWrongEndpointStatus !== "Plate sketch: selected endpoint is not on the side that extends to the selected arc."
      || !arcExtendWrongEndpointStart
      || !arcExtendWrongEndpointEnd
      || Math.abs(arcExtendWrongEndpointStart.point[0]) > 1e-6
      || Math.abs(arcExtendWrongEndpointStart.point[1]) > 1e-6
      || Math.abs(arcExtendWrongEndpointEnd.point[0] - 40) > 1e-6
      || Math.abs(arcExtendWrongEndpointEnd.point[1]) > 1e-6
  ) {
    console.error("FAILED: Sketch Trim should reject the wrong selected line endpoint with a specific line-to-arc extend status and no geometry change");
    return 1;
  }
  let arcToLineTrimStatus = "";
  const arcToLineTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcToLineTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 30],
      [120, 30],
      [100, 0],
      [100, 60]
    ],
    idPrefix: "arc_line_trim"
  });
  arcToLineTrimStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_line_trim_e3", {
    throughPoint: [70, 30],
    mode: "driven"
  });
  const arcToLineTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcToLineTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcToLineTrimStatus = message;
    }
  });
  arcToLineTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcToLineTrimEdit.selectEntities({ edgeIds: ["arc_line_trim_e3", "arc_line_trim_e1"] }, { render: true });
  if (!arcToLineTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim the first selected circular arc to the second selected line");
    return 1;
  }
  const arcToLineTrimSketch = arcToLineTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcTrimVertex = sketchVertices(arcToLineTrimSketch).find((vertex) => (
    Math.abs(vertex.point[0] - 70) <= 1e-6 && Math.abs(vertex.point[1] - 30) <= 1e-6
  ));
  if (
    !arcTrimVertex
      || sketchVertices(arcToLineTrimSketch).some((vertex) => vertex.id === "arc_line_trim_v4")
      || sketchEdges(arcToLineTrimSketch).length !== 4
      || sketchVertices(arcToLineTrimSketch).length !== 4
      || sketchEdges(arcToLineTrimSketch).filter((edge) => edge.kind === "circular-arc").length !== 1
      || arcToLineTrimStatus !== "Plate sketch: outline arc trimmed to line"
  ) {
    console.error("FAILED: Sketch Trim should split the selected arc at the line crossing, remove the default endpoint side, and preserve one analytic arc");
    return 1;
  }
  let arcToLineExtendStatus = "";
  const arcToLineExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcToLineExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [50, -20],
      [50, 20]
    ],
    idPrefix: "arc_line_extend"
  });
  arcToLineExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_line_extend_e1", {
    throughPoint: [20, 4],
    mode: "driven"
  });
  const arcToLineExtendBeforeSketch = arcToLineExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToLineExtendBeforeFirst = sketchEdges(arcToLineExtendBeforeSketch).find((edge) => edge.id === "arc_line_extend_e1");
  const arcToLineExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcToLineExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcToLineExtendStatus = message;
    }
  });
  arcToLineExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcToLineExtendEdit.selectEntities({ edgeIds: ["arc_line_extend_e1", "arc_line_extend_e3"] }, { render: true });
  if (!arcToLineExtendEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should extend the first selected circular arc to the selected outline line");
    return 1;
  }
  const arcToLineExtendSketch = arcToLineExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToLineExtendedVertex = sketchVertices(arcToLineExtendSketch).find((vertex) => vertex.id === "arc_line_extend_v2");
  const arcToLineExtendedFirst = sketchEdges(arcToLineExtendSketch).find((edge) => edge.id === "arc_line_extend_e1");
  if (
    !arcToLineExtendedVertex
      || Math.abs(arcToLineExtendedVertex.point[0] - 50) > 1e-6
      || Math.abs(arcToLineExtendedVertex.point[1] + 5.526478836809396) > 1e-6
      || arcToLineExtendedFirst?.kind !== "circular-arc"
      || Math.abs(arcToLineExtendedFirst.radius - arcToLineExtendBeforeFirst.radius) > 1e-6
      || sketchEdges(arcToLineExtendSketch).length !== 4
      || sketchVertices(arcToLineExtendSketch).length !== 4
      || arcToLineExtendStatus !== "Plate sketch: outline arc extended to line"
  ) {
    console.error("FAILED: Sketch Trim should move the natural arc endpoint to the selected outline line while preserving closed topology and the semantic arc");
    return 1;
  }
  let arcToArcTrimStatus = "";
  const arcToArcTrimStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcToArcTrimStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 50],
      [100, 50],
      [100, -50],
      [0, -50]
    ],
    idPrefix: "arc_arc_trim"
  });
  arcToArcTrimStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_arc_trim_e1", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  arcToArcTrimStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_arc_trim_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const arcToArcBeforeSketch = arcToArcTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToArcBeforeCut = sketchEdges(arcToArcBeforeSketch).find((edge) => edge.id === "arc_arc_trim_e3");
  const arcToArcTrimEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcToArcTrimStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcToArcTrimStatus = message;
    }
  });
  arcToArcTrimEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcToArcTrimEdit.selectEntities({ edgeIds: ["arc_arc_trim_e1", "arc_arc_trim_e3"] }, { render: true });
  if (!arcToArcTrimEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should trim the first selected circular arc to the second selected circular arc");
    return 1;
  }
  const arcToArcTrimSketch = arcToArcTrimStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToArcTrimVertex = sketchVertices(arcToArcTrimSketch).find((vertex) => (
    Math.abs(vertex.point[0] - 50) <= 1e-6 && Math.abs(vertex.point[1]) <= 1e-6
  ));
  const arcToArcCut = sketchEdges(arcToArcTrimSketch).find((edge) => edge.id === "arc_arc_trim_e3");
  if (
    !arcToArcTrimVertex
      || sketchVertices(arcToArcTrimSketch).some((vertex) => vertex.id === "arc_arc_trim_v2")
      || sketchEdges(arcToArcTrimSketch).length !== 4
      || sketchVertices(arcToArcTrimSketch).length !== 4
      || sketchEdges(arcToArcTrimSketch).filter((edge) => edge.kind === "circular-arc").length !== 2
      || arcToArcCut?.kind !== "circular-arc"
      || Math.abs(arcToArcCut.radius - arcToArcBeforeCut.radius) > 1e-6
      || arcToArcTrimStatus !== "Plate sketch: outline arc trimmed to arc"
  ) {
    console.error("FAILED: Sketch Trim should split the selected arc at an analytic arc-arc crossing, remove the default endpoint side, and preserve analytic arcs");
    return 1;
  }
  let arcToArcExtendStatus = "";
  const arcToArcExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  arcToArcExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "arc_arc_extend"
  });
  arcToArcExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_arc_extend_e1", {
    throughPoint: [20, 4],
    mode: "driven"
  });
  arcToArcExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "arc_arc_extend_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const arcToArcExtendBeforeSketch = arcToArcExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToArcExtendBeforeFirst = sketchEdges(arcToArcExtendBeforeSketch).find((edge) => edge.id === "arc_arc_extend_e1");
  const arcToArcExtendBeforeCut = sketchEdges(arcToArcExtendBeforeSketch).find((edge) => edge.id === "arc_arc_extend_e3");
  const arcToArcExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: arcToArcExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      arcToArcExtendStatus = message;
    }
  });
  arcToArcExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  arcToArcExtendEdit.selectEntities({ edgeIds: ["arc_arc_extend_e1", "arc_arc_extend_e3"] }, { render: true });
  if (!arcToArcExtendEdit.trimSelectedSketchEntity()) {
    console.error("FAILED: Sketch Trim should extend the first selected circular arc to the second selected circular arc");
    return 1;
  }
  const arcToArcExtendSketch = arcToArcExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const arcToArcExtendedVertex = sketchVertices(arcToArcExtendSketch).find((vertex) => vertex.id === "arc_arc_extend_v2");
  const arcToArcExtendedFirst = sketchEdges(arcToArcExtendSketch).find((edge) => edge.id === "arc_arc_extend_e1");
  const arcToArcExtendedCut = sketchEdges(arcToArcExtendSketch).find((edge) => edge.id === "arc_arc_extend_e3");
  if (
    !arcToArcExtendedVertex
      || Math.abs(arcToArcExtendedVertex.point[0] - 50.746520070931375) > 1e-6
      || Math.abs(arcToArcExtendedVertex.point[1] + 6.063720914608865) > 1e-6
      || arcToArcExtendedFirst?.kind !== "circular-arc"
      || arcToArcExtendedCut?.kind !== "circular-arc"
      || Math.abs(arcToArcExtendedFirst.radius - arcToArcExtendBeforeFirst.radius) > 1e-6
      || Math.abs(arcToArcExtendedCut.radius - arcToArcExtendBeforeCut.radius) > 1e-6
      || sketchEdges(arcToArcExtendSketch).length !== 4
      || sketchVertices(arcToArcExtendSketch).length !== 4
      || arcToArcExtendStatus !== "Plate sketch: outline arc extended to arc"
  ) {
    console.error("FAILED: Sketch Trim should move the natural arc endpoint to the selected analytic arc while preserving closed topology and semantic arcs");
    return 1;
  }
  let explicitLineToArcExtendStatus = "";
  const explicitLineToArcExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  explicitLineToArcExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "explicit_line_arc_extend"
  });
  explicitLineToArcExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "explicit_line_arc_extend_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const explicitLineToArcExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: explicitLineToArcExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      explicitLineToArcExtendStatus = message;
    }
  });
  explicitLineToArcExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  explicitLineToArcExtendEdit.selectEntities({ edgeIds: ["explicit_line_arc_extend_e1", "explicit_line_arc_extend_e3"] }, { render: true });
  if (!explicitLineToArcExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should extend a selected outline line to a selected circular arc");
    return 1;
  }
  const explicitLineToArcExtendSketch = explicitLineToArcExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitLineToArcExtendedVertex = sketchVertices(explicitLineToArcExtendSketch).find((vertex) => vertex.id === "explicit_line_arc_extend_v2");
  const explicitLineToArcCutEdge = sketchEdges(explicitLineToArcExtendSketch).find((edge) => edge.id === "explicit_line_arc_extend_e3");
  if (
    !explicitLineToArcExtendedVertex
      || Math.abs(explicitLineToArcExtendedVertex.point[0] - 50) > 1e-6
      || Math.abs(explicitLineToArcExtendedVertex.point[1]) > 1e-6
      || explicitLineToArcCutEdge?.kind !== "circular-arc"
      || sketchEdges(explicitLineToArcExtendSketch).length !== 4
      || sketchVertices(explicitLineToArcExtendSketch).length !== 4
      || explicitLineToArcExtendStatus !== "Plate sketch: outline edge extended to arc"
  ) {
    console.error("FAILED: Sketch Extend should move a straight endpoint to the selected analytic arc while preserving closed topology");
    return 1;
  }
  let explicitReversedEndpointExtendStatus = "";
  const explicitReversedEndpointExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  explicitReversedEndpointExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "explicit_reversed_endpoint_extend"
  });
  explicitReversedEndpointExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "explicit_reversed_endpoint_extend_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const explicitReversedEndpointExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: explicitReversedEndpointExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      explicitReversedEndpointExtendStatus = message;
    }
  });
  explicitReversedEndpointExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  explicitReversedEndpointExtendEdit.selectEntities({
    edgeIds: ["explicit_reversed_endpoint_extend_e3", "explicit_reversed_endpoint_extend_e1"],
    vertexIds: ["explicit_reversed_endpoint_extend_v2"]
  }, { render: true });
  if (!explicitReversedEndpointExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should use a selected endpoint on the second selected edge as the extend side");
    return 1;
  }
  const explicitReversedEndpointExtendSketch = explicitReversedEndpointExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitReversedEndpointExtendVertex = sketchVertices(explicitReversedEndpointExtendSketch).find((vertex) => vertex.id === "explicit_reversed_endpoint_extend_v2");
  const explicitReversedEndpointExtendArc = sketchEdges(explicitReversedEndpointExtendSketch).find((edge) => edge.id === "explicit_reversed_endpoint_extend_e3");
  if (
    !explicitReversedEndpointExtendVertex
      || Math.abs(explicitReversedEndpointExtendVertex.point[0] - 50) > 1e-6
      || Math.abs(explicitReversedEndpointExtendVertex.point[1]) > 1e-6
      || explicitReversedEndpointExtendArc?.kind !== "circular-arc"
      || sketchEdges(explicitReversedEndpointExtendSketch).length !== 4
      || sketchVertices(explicitReversedEndpointExtendSketch).length !== 4
      || explicitReversedEndpointExtendStatus !== "Plate sketch: outline edge extended to arc"
  ) {
    console.error("FAILED: Sketch Extend should swap trim/cut edges when the selected endpoint belongs to the second edge");
    return 1;
  }
  let explicitArcToLineExtendStatus = "";
  const explicitArcToLineExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  explicitArcToLineExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [50, -20],
      [50, 20]
    ],
    idPrefix: "explicit_arc_line_extend"
  });
  explicitArcToLineExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "explicit_arc_line_extend_e1", {
    throughPoint: [20, 4],
    mode: "driven"
  });
  const explicitArcToLineExtendBeforeSketch = explicitArcToLineExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitArcToLineExtendBeforeFirst = sketchEdges(explicitArcToLineExtendBeforeSketch).find((edge) => edge.id === "explicit_arc_line_extend_e1");
  const explicitArcToLineExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: explicitArcToLineExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      explicitArcToLineExtendStatus = message;
    }
  });
  explicitArcToLineExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  explicitArcToLineExtendEdit.selectEntities({ edgeIds: ["explicit_arc_line_extend_e1", "explicit_arc_line_extend_e3"] }, { render: true });
  if (!explicitArcToLineExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should extend a selected circular arc to a selected outline line");
    return 1;
  }
  const explicitArcToLineExtendSketch = explicitArcToLineExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitArcToLineExtendedVertex = sketchVertices(explicitArcToLineExtendSketch).find((vertex) => vertex.id === "explicit_arc_line_extend_v2");
  const explicitArcToLineExtendedFirst = sketchEdges(explicitArcToLineExtendSketch).find((edge) => edge.id === "explicit_arc_line_extend_e1");
  if (
    !explicitArcToLineExtendedVertex
      || Math.abs(explicitArcToLineExtendedVertex.point[0] - 50) > 1e-6
      || Math.abs(explicitArcToLineExtendedVertex.point[1] + 5.526478836809396) > 1e-6
      || explicitArcToLineExtendedFirst?.kind !== "circular-arc"
      || Math.abs(explicitArcToLineExtendedFirst.radius - explicitArcToLineExtendBeforeFirst.radius) > 1e-6
      || sketchEdges(explicitArcToLineExtendSketch).length !== 4
      || sketchVertices(explicitArcToLineExtendSketch).length !== 4
      || explicitArcToLineExtendStatus !== "Plate sketch: outline arc extended to line"
  ) {
    console.error("FAILED: Sketch Extend should move an arc endpoint to the selected outline line while preserving semantic arc data");
    return 1;
  }
  let explicitArcToArcExtendStatus = "";
  const explicitArcToArcExtendStore = createProjectStore({ project: JSON.parse(JSON.stringify(roundedSketchProject)) });
  explicitArcToArcExtendStore.setSketchOutline("rounded_sketch_arc_demo", {
    outline: [
      [0, 0],
      [40, 0],
      [60, -20],
      [60, 20]
    ],
    idPrefix: "explicit_arc_arc_extend"
  });
  explicitArcToArcExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "explicit_arc_arc_extend_e1", {
    throughPoint: [20, 4],
    mode: "driven"
  });
  explicitArcToArcExtendStore.setSketchEdgeArc("rounded_sketch_arc_demo", "explicit_arc_arc_extend_e3", {
    throughPoint: [50, 0],
    mode: "driven"
  });
  const explicitArcToArcExtendBeforeSketch = explicitArcToArcExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitArcToArcExtendBeforeFirst = sketchEdges(explicitArcToArcExtendBeforeSketch).find((edge) => edge.id === "explicit_arc_arc_extend_e1");
  const explicitArcToArcExtendBeforeCut = sketchEdges(explicitArcToArcExtendBeforeSketch).find((edge) => edge.id === "explicit_arc_arc_extend_e3");
  const explicitArcToArcExtendEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: explicitArcToArcExtendStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue,
    onStatusChange: (message) => {
      explicitArcToArcExtendStatus = message;
    }
  });
  explicitArcToArcExtendEdit.selectObject("rounded_sketch_arc_demo", { sketchMode: "relations" });
  explicitArcToArcExtendEdit.selectEntities({ edgeIds: ["explicit_arc_arc_extend_e1", "explicit_arc_arc_extend_e3"] }, { render: true });
  if (!explicitArcToArcExtendEdit.extendSelectedSketchEntity()) {
    console.error("FAILED: Sketch Extend should extend a selected circular arc to a selected circular arc");
    return 1;
  }
  const explicitArcToArcExtendSketch = explicitArcToArcExtendStore.project().model.sketches.rounded_sketch_arc_demo.sketch;
  const explicitArcToArcExtendedVertex = sketchVertices(explicitArcToArcExtendSketch).find((vertex) => vertex.id === "explicit_arc_arc_extend_v2");
  const explicitArcToArcExtendedFirst = sketchEdges(explicitArcToArcExtendSketch).find((edge) => edge.id === "explicit_arc_arc_extend_e1");
  const explicitArcToArcExtendedCut = sketchEdges(explicitArcToArcExtendSketch).find((edge) => edge.id === "explicit_arc_arc_extend_e3");
  if (
    !explicitArcToArcExtendedVertex
      || Math.abs(explicitArcToArcExtendedVertex.point[0] - 50.746520070931375) > 1e-6
      || Math.abs(explicitArcToArcExtendedVertex.point[1] + 6.063720914608865) > 1e-6
      || explicitArcToArcExtendedFirst?.kind !== "circular-arc"
      || explicitArcToArcExtendedCut?.kind !== "circular-arc"
      || Math.abs(explicitArcToArcExtendedFirst.radius - explicitArcToArcExtendBeforeFirst.radius) > 1e-6
      || Math.abs(explicitArcToArcExtendedCut.radius - explicitArcToArcExtendBeforeCut.radius) > 1e-6
      || sketchEdges(explicitArcToArcExtendSketch).length !== 4
      || sketchVertices(explicitArcToArcExtendSketch).length !== 4
      || explicitArcToArcExtendStatus !== "Plate sketch: outline arc extended to arc"
  ) {
    console.error("FAILED: Sketch Extend should move an arc endpoint to the selected analytic arc while preserving semantic arc data");
    return 1;
  }
  const storeLengthProject = roundedSketchStore.setSketchEdgeLength("rounded_sketch_arc_demo", "rounded_sketch_arc_demo_e1", 230, { mode: "driven" });
  const storeLengthSketch = storeLengthProject.model.sketches.rounded_sketch_arc_demo.sketch;
  if (!sketchRelations(storeLengthSketch).some((relation) => relation.type === "length" && relation.edgeId === "rounded_sketch_arc_demo_e1")) {
    console.error("FAILED: createProjectStore.setSketchEdgeLength should store standalone sketch length dimensions");
    return 1;
  }
  const storeAngleProject = roundedSketchStore.setSketchEdgeAngle("rounded_sketch_arc_demo", [
    "rounded_sketch_arc_demo_e1",
    "rounded_sketch_arc_demo_e3"
  ], 90, { mode: "driven" });
  const storeAngleSketch = storeAngleProject.model.sketches.rounded_sketch_arc_demo.sketch;
  if (!sketchRelations(storeAngleSketch).some((relation) => (
    relation.type === "angle"
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e1")
      && relation.edgeIds.includes("rounded_sketch_arc_demo_e3")
  ))) {
    console.error("FAILED: createProjectStore.setSketchEdgeAngle should store standalone sketch angle dimensions");
    return 1;
  }
  const storeDistanceProject = roundedSketchStore.setSketchPointDistance("rounded_sketch_arc_demo", [
    "rounded_sketch_arc_demo_v1",
    "rounded_sketch_arc_demo_v2"
  ], 230, { mode: "driven" });
  const storeDistanceSketch = storeDistanceProject.model.sketches.rounded_sketch_arc_demo.sketch;
  if (!sketchRelations(storeDistanceSketch).some((relation) => (
    relation.type === "distance"
      && relation.vertexIds.includes("rounded_sketch_arc_demo_v1")
      && relation.vertexIds.includes("rounded_sketch_arc_demo_v2")
  ))) {
    console.error("FAILED: createProjectStore.setSketchPointDistance should store standalone sketch distance dimensions");
    return 1;
  }
  const commandSpecs = commandPaletteSpecs();
  const commandIds = new Set(commandSpecs.map((spec) => spec.id));
  for (const commandId of [
    "sketch.dimension.length",
    "sketch.dimension.angle",
    "sketch.dimension.distance",
    "sketch.dimension.radius",
    "sketch.dimension.diameter",
    "sketch.circle.diameter",
    "sketch.circle.threePoint",
    "sketch.line.contour",
    "sketch.slot.center",
    "sketch.arc.centerContour",
    "sketch.arc.threePointContour",
    "sketch.modify.extend",
    "sketch.view.clean",
    "sketch.relation.pointOnCircle",
    "sketch.exit"
  ]) {
    if (!commandIds.has(commandId)) {
      console.error(`FAILED: commandPaletteSpecs should include ${commandId}`);
      return 1;
    }
  }
  const lineCommandSpec = commandSpecs.find((spec) => spec.id === "sketch.line.create");
  const lineContourCommandSpec = commandSpecs.find((spec) => spec.id === "sketch.line.contour");
  const edgeArcCommandSpec = commandSpecs.find((spec) => spec.id === "sketch.edge.arc");
  if (lineCommandSpec?.title !== "Create construction line" || !lineCommandSpec?.description?.includes("construction line")) {
    console.error("FAILED: sketch.line.create metadata should clearly present the Line tool as construction-line authoring");
    return 1;
  }
  if (
    lineContourCommandSpec?.title !== "Create line/arc contour"
      || !lineContourCommandSpec?.description?.includes("semantic arcs")
      || !lineContourCommandSpec?.description?.includes("Alt")
  ) {
    console.error("FAILED: sketch.line.contour metadata should advertise mixed line/arc contour authoring");
    return 1;
  }
  if (
    edgeArcCommandSpec?.title !== "Convert or update edge arc"
      || !edgeArcCommandSpec?.description?.includes("selected straight sketch edge")
      || !edgeArcCommandSpec?.description?.includes("update a selected circular arc")
      || !edgeArcCommandSpec?.description?.includes("through point")
  ) {
    console.error("FAILED: sketch.edge.arc metadata should describe both straight-edge conversion and existing-arc update");
    return 1;
  }
  const qaSketchSelectEntitiesStart = viewerQaBridgeSource.indexOf("const sketchSelectEntities = (objectId, selection = {}, options = {}) =>");
  const qaSketchSelectEntitiesEnd = qaSketchSelectEntitiesStart >= 0
    ? viewerQaBridgeSource.indexOf("const sketchActiveState = () =>", qaSketchSelectEntitiesStart)
    : -1;
  const qaSketchSelectEntitiesSource = qaSketchSelectEntitiesStart >= 0 && qaSketchSelectEntitiesEnd > qaSketchSelectEntitiesStart
    ? viewerQaBridgeSource.slice(qaSketchSelectEntitiesStart, qaSketchSelectEntitiesEnd)
    : "";
  const qaViewerCommandContracts = [
    {
      label: "viewer-qa-bridge should expose viewerCommands through the QA API",
      pass: viewerQaBridgeSource.includes("const viewerCommands = (options = {})")
        && viewerQaBridgeSource.includes("viewerCommands,")
    },
    {
      label: "viewer-qa-bridge should use injected viewer command diagnostics",
      pass: viewerQaBridgeSource.includes("getViewerCommandItems = null")
        && viewerQaBridgeSource.includes("const commandItemsForQa")
        && viewerRuntimeSource.includes("getViewerCommandItems: workspaceBindings.workspaceCommandItems")
    },
    {
      label: "viewerCommands should force command state and support toolbar filtering",
      pass: viewerQaBridgeSource.includes("includeState: true")
        && viewerQaBridgeSource.includes("options.prefix")
        && viewerQaBridgeSource.includes("options.navSurface")
    },
    {
      label: "viewerCommands should report command enabled, active, and disabled reason fields",
      pass: viewerQaBridgeSource.includes("enabled: command.enabled !== false")
        && viewerQaBridgeSource.includes("active: Boolean(command.active)")
        && viewerQaBridgeSource.includes("disabledReason: command.disabledReason ||")
    },
    {
      label: "viewer-qa-bridge should expose compact Sketch quick-list diagnostics",
      pass: viewerQaBridgeSource.includes("const sketchQuickLists = () =>")
        && viewerQaBridgeSource.includes("relationActionOverlayForSelection")
        && viewerQaBridgeSource.includes("sketchQuickLists,")
        && viewerQaBridgeSource.includes("tone: item?.tone ||")
        && viewerQaBridgeSource.includes("relationType: item?.handle?.relationType ||")
    },
    {
      label: "viewer-qa-bridge sketchSelectEntities should not cancel the active sketch tool before selecting entities",
      pass: qaSketchSelectEntitiesSource.includes("plateSketchEdit.selectObject(objectId")
        && qaSketchSelectEntitiesSource.includes("plateSketchEdit.selectEntities({")
        && !qaSketchSelectEntitiesSource.includes("clearSelection")
    },
    {
      label: "WebGL static rendering should skip untriangulatable faces instead of blocking snap/pick",
      pass: webglRenderOrchestratorSource.includes("function renderableFaceTriangles(points)")
        && webglRenderOrchestratorSource.includes("return triangulateFace(points)")
        && webglRenderOrchestratorSource.includes("return []")
        && webglRenderOrchestratorSource.includes("for (const triangle of renderableFaceTriangles(face.points))")
    },
    {
      label: "WebGL CPU picker should skip untriangulatable faces instead of blocking snap/pick",
      pass: webglPickerSource.includes("function pickableFaceTriangles(points)")
        && webglPickerSource.includes("return triangulateFace(points)")
        && webglPickerSource.includes("return []")
        && webglPickerSource.includes("for (const triangle of pickableFaceTriangles(face.points))")
    },
    {
      label: "plate sketch inspector should ignore stale selected sketch detail ids after topology changes",
      pass: plateSketchInspectorSource.includes("const relationIds = new Set(relations.map((relation) => relation.id))")
        && plateSketchInspectorSource.includes("relationIds.has(selectedDetail.relationId)")
        && plateSketchInspectorSource.includes("arrayValues(selectedDetail.edgeIds).filter((edgeId) => edgeById.has(edgeId))")
        && plateSketchInspectorSource.includes("arrayValues(selectedDetail.vertexIds).filter((vertexId) => vertexIds.has(vertexId))")
    },
    {
      label: "viewer runtime should route sketch key input before generic delete handling",
      pass: viewerRuntimeSource.indexOf("plateSketchEdit?.handleKey?.(event)") >= 0
        && viewerRuntimeSource.indexOf("plateSketchEdit?.handleKey?.(event)") < viewerRuntimeSource.indexOf("handleViewerKeyDelete(event)")
    }
  ];
  for (const contract of qaViewerCommandContracts) {
    if (!contract.pass) {
      console.error(`FAILED: ${contract.label}`);
      return 1;
    }
  }
  const registeredViewerCommands = {};
  let exitSketchCleared = false;
  let exitSketchStatus = "";
  let exitSketchRefreshCount = 0;
  let sketchExtendCalled = 0;
  let sketchInferCalled = 0;
  let cleanSketchMode = null;
  let cleanSketchStatus = "";
  let activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selection: { edgeIds: [], vertexIds: [], relationId: null }
  };
  const exitCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(registeredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => registeredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof registeredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { exitSketchRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => activeSketchState,
      clear: (options = {}) => {
        exitSketchCleared = options.overlay === true;
        activeSketchState = { plateId: null, selection: { edgeIds: [], vertexIds: [], relationId: null } };
      },
      extendSelectedSketchEntity: () => {
        sketchExtendCalled += 1;
        return true;
      },
      inferRelations: () => {
        sketchInferCalled += 1;
        return true;
      },
      setSketchMode: (mode) => {
        cleanSketchMode = mode;
        activeSketchState = {
          ...activeSketchState,
          sketchMode: mode,
          selection: { edgeIds: [], vertexIds: [], relationId: null }
        };
        return true;
      },
      toggleRelations: () => {
        const nextMode = activeSketchState.sketchMode === "relations" ? "clean" : "relations";
        activeSketchState = {
          ...activeSketchState,
          sketchMode: nextMode,
          selection: nextMode === "clean" ? { edgeIds: [], vertexIds: [], relationId: null } : activeSketchState.selection
        };
        return true;
      }
    }),
    updateModelingStatus: (message) => {
      exitSketchStatus = message;
      cleanSketchStatus = message;
    }
  });
  exitCommandRegistration.registerCommands();
  const activeSketchFeatureItems = exitCommandRegistration.viewerCommandItems()
    .filter((item) => item.navSurface === "feature-navbar");
  const activeSketchFeatureIds = new Set(activeSketchFeatureItems.map((item) => item.id));
  const activeSketchToolbarItems = activeSketchFeatureItems.filter((item) => item.id.startsWith("sketch."));
  const activeModelToolbarItems = activeSketchFeatureItems.filter((item) => item.id.startsWith("model."));
  if (
    activeModelToolbarItems.length
      || activeSketchToolbarItems.length < 30
      || !activeSketchFeatureIds.has("sketch.roundedRectangle.create")
      || !activeSketchFeatureIds.has("sketch.dimension.radius")
      || !activeSketchFeatureIds.has("sketch.modify.extend")
      || !activeSketchFeatureIds.has("sketch.relations.infer")
      || !activeSketchFeatureIds.has("sketch.view.clean")
      || activeSketchToolbarItems.some((item) => (
        item.groupLabel !== "Sketch"
          || item.groupIcon !== "sketch"
          || item.groupDescription !== "Sketch editing tools for the active sketch."
      ))
  ) {
    console.error("FAILED: active sketch context should replace Model feature navbar commands with Sketch commands");
    return 1;
  }
  const sketchPaletteSpecs = commandPaletteSpecs().filter((item) => String(item.id || "").startsWith("sketch."));
  const relationSettingsSpec = commandPaletteSpecs().find((item) => item.id === "settings.relations.toggle");
  if (
    sketchPaletteSpecs.length < 30
      || sketchPaletteSpecs.some((item) => item.groupDescription !== "Sketch editing tools for the active sketch.")
      || !String(relationSettingsSpec?.description || "").includes("active sketch relation overlay")
  ) {
    console.error("FAILED: Sketch command specs should describe active sketch editing without restricting wording to plate-hosted sketches");
    return 1;
  }
  if (
    !modelingToolbarSource.includes("\"Hide sketch relations\"")
      || !modelingToolbarSource.includes("\"Show sketch relations\"")
      || modelingToolbarSource.includes("plate sketch relations")
  ) {
    console.error("FAILED: modeling toolbar relation toggle should use active sketch wording for standalone and plate-hosted sketches");
    return 1;
  }
  if (!dragEditOverlaysSource.includes('text: "Sketch"') || dragEditOverlaysSource.includes('text: "Plate sketch"')) {
    console.error("FAILED: visible active sketch overlay heading should say Sketch, not Plate sketch");
    return 1;
  }
  const standaloneInferItem = activeSketchFeatureItems.find((item) => item.id === "sketch.relations.infer");
  if (!standaloneInferItem?.enabled || standaloneInferItem.disabledReason) {
    console.error("FAILED: standalone sketch context should enable Infer Relations in the Sketch toolbar");
    return 1;
  }
  if (registeredViewerCommands["sketch.relations.infer"]?.() !== true || sketchInferCalled !== 1 || exitSketchRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route standalone Sketch Infer Relations to the edit controller and refresh state");
    return 1;
  }
  activeSketchState = {
    plateId: null,
    selection: { edgeIds: [], vertexIds: [], relationId: null }
  };
  const inactiveSketchFeatureIds = new Set(exitCommandRegistration.viewerCommandItems()
    .filter((item) => item.navSurface === "feature-navbar")
    .map((item) => item.id));
  if (
    inactiveSketchFeatureIds.has("sketch.roundedRectangle.create")
      || inactiveSketchFeatureIds.has("sketch.dimension.radius")
      || !inactiveSketchFeatureIds.has("model.beam.create")
      || !inactiveSketchFeatureIds.has("model.sketch.create")
  ) {
    console.error("FAILED: leaving sketch context should restore Model feature navbar commands and hide Sketch-only commands");
    return 1;
  }
  const commandSketchProject = {
    project: { name: "Command sketch handoff test" },
    objectIndex: {},
    model: {
      members: {},
      plates: {},
      sketches: {},
      fastenerGroups: {},
      features: {},
      trimJoints: {},
      workPoints: {},
      referencePlanes: {},
      gridSystems: {},
      levels: {}
    }
  };
  const commandSketchStore = createProjectStore({ project: commandSketchProject });
  const commandSketchEdit = createPlateSketchEditController({
    viewer: {
      setAuthoringOverlay: () => {},
      screenScale: () => 1
    },
    api: commandSketchStore,
    settings: {},
    requestDimensionInput: ({ defaultValue }) => defaultValue
  });
  let commandSketchHandler = null;
  let commandSketchCreated = null;
  let commandSketchOverlay = null;
  function overlayKindCount(overlay, collection, kind) {
    return (overlay?.[collection] || []).filter((item) => item.kind === kind).length;
  }
  const commandSketchController = createCommandController({
    viewer: {
      setCommandHandler: (handler) => { commandSketchHandler = handler; },
      currentPointer: () => null,
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] }),
      projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
      screenScale: () => 1
    },
    api: commandSketchStore,
    profiles: profiles.profiles,
    snapManager: {
      resetCycle: () => {},
      point: (input) => ({ point: input.rawPoint, snap: null })
    },
    settings,
    onPreviewChange: () => {},
    onOverlayChange: (overlay) => { commandSketchOverlay = overlay; },
    onProjectChange: () => {},
    onSketchCreated: (result) => {
      commandSketchCreated = result;
      commandSketchEdit.selectObject(result.sketchId, { sketchMode: "relations" });
    },
    onStatusChange: () => {},
    onCommandStart: () => {},
    keyboardTarget: { addEventListener: () => {} }
  });
  commandSketchController.startSketch();
  commandSketchHandler.pointerDown({ screen: { x: 0, y: 0 }, event: {} });
  commandSketchHandler.pointerDown({ screen: { x: 100, y: 0 }, event: {} });
  commandSketchHandler.pointerDown({ screen: { x: 0, y: 50 }, event: {} });
  if (commandSketchCreated || !commandSketchHandler.active()) {
    console.error("FAILED: model.sketch.create should keep collecting sketch points after the third point until Enter or double-click");
    return 1;
  }
  if (
    overlayKindCount(commandSketchOverlay, "handles", "sketch-create-point") !== 3
      || overlayKindCount(commandSketchOverlay, "lines", "sketch-create-preview-edge") !== 2
      || overlayKindCount(commandSketchOverlay, "lines", "sketch-create-preview-close") !== 1
  ) {
    console.error("FAILED: model.sketch.create should show a closed authoring preview after the third sketch point");
    return 1;
  }
  commandSketchHandler.pointerDown({ screen: { x: 100, y: 50 }, event: {} });
  if (
    overlayKindCount(commandSketchOverlay, "handles", "sketch-create-point") !== 4
      || overlayKindCount(commandSketchOverlay, "lines", "sketch-create-preview-edge") !== 3
      || overlayKindCount(commandSketchOverlay, "lines", "sketch-create-preview-close") !== 1
  ) {
    console.error("FAILED: model.sketch.create should update the closed authoring preview as more sketch points are added");
    return 1;
  }
  commandSketchController.activeCommand()?.handleKey?.({ key: "Enter" });
  const commandSketchActive = commandSketchEdit.activeState();
  const commandSketchCreatedObject = commandSketchCreated?.sketchId
    ? commandSketchStore.project().model.sketches[commandSketchCreated.sketchId]
    : null;
  if (
    !commandSketchCreated?.sketchId
      || !commandSketchCreatedObject
      || commandSketchStore.project().objectIndex?.[commandSketchCreated.sketchId]?.collection !== "sketches"
      || sketchEdges(commandSketchCreatedObject.sketch).length !== 4
      || commandSketchActive.plateId !== commandSketchCreated.sketchId
      || commandSketchActive.collection !== "sketches"
      || commandSketchActive.sketchMode !== "relations"
      || commandSketchHandler.active()
      || commandSketchOverlay !== null
  ) {
    console.error("FAILED: model.sketch.create should clear preview and hand off the new multi-point standalone sketch into active Sketch mode");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: [], relationId: null }
  };
  const edgeArcItemForSelectedArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.edge.arc");
  if (!edgeArcItemForSelectedArc?.enabled) {
    console.error("FAILED: sketch.edge.arc should stay enabled for a selected circular arc so Edge Arc can edit its through point");
    return 1;
  }
  const lengthForSelectedArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.length");
  if (lengthForSelectedArcItem?.enabled || !String(lengthForSelectedArcItem?.disabledReason || "").includes("Use Radius or Diameter")) {
    console.error("FAILED: sketch.dimension.length should point circular arc selections toward Radius/Diameter instead of a generic straight-edge prompt");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_v5"], relationId: null }
  };
  const invalidPointOnCircleItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.pointOnCircle");
  if (invalidPointOnCircleItem?.enabled || !String(invalidPointOnCircleItem?.disabledReason || "").includes("endpoint of another circular arc")) {
    console.error("FAILED: sketch.relation.pointOnCircle should be disabled when the selected point is already an endpoint of another circular arc");
    return 1;
  }
  const edgeArcWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.edge.arc");
  const flipArcWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.arc.flip");
  const splitArcWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.arc.split");
  if (
    edgeArcWithExtraPointItem?.enabled
      || flipArcWithExtraPointItem?.enabled
      || splitArcWithExtraPointItem?.enabled
      || !String(edgeArcWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
      || !String(flipArcWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
      || !String(splitArcWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
  ) {
    console.error("FAILED: arc modifier toolbar commands should reject circular arc selections with extra selected points");
    return 1;
  }
  const radiusWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.radius");
  const diameterWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.diameter");
  const lengthWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.length");
  if (
    radiusWithExtraPointItem?.enabled
      || diameterWithExtraPointItem?.enabled
      || lengthWithExtraPointItem?.enabled
      || !String(radiusWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
      || !String(diameterWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
      || !String(lengthWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")
  ) {
    console.error("FAILED: arc dimension commands should explain that extra selected points must be cleared when a circular arc is selected");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: ["rounded_sketch_arc_demo_cp1"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_v5", "rounded_sketch_arc_demo_cp1"], relationId: null }
  };
  const pointOnCircleWithExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.pointOnCircle");
  if (pointOnCircleWithExtraPointItem?.enabled || !String(pointOnCircleWithExtraPointItem?.disabledReason || "").includes("Clear selected sketch points")) {
    console.error("FAILED: Point On Circle toolbar command should explain that extra selected points must be cleared");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: ["rounded_sketch_arc_demo_cp1"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_cp1"], relationId: null }
  };
  const pointOnCircleWithExtraEdgeItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.pointOnCircle");
  if (pointOnCircleWithExtraEdgeItem?.enabled || !String(pointOnCircleWithExtraEdgeItem?.disabledReason || "").includes("Clear selected sketch edges")) {
    console.error("FAILED: Point On Circle toolbar command should explain that extra selected edges must be cleared");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: ["rounded_sketch_arc_demo_cp1"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_cp1"], relationId: null }
  };
  const validPointOnCircleItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.pointOnCircle");
  if (!validPointOnCircleItem?.enabled) {
    console.error("FAILED: sketch.relation.pointOnCircle should be enabled for one free construction point plus one circular arc");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: ["rounded_sketch_arc_demo_cp1"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_v5", "rounded_sketch_arc_demo_cp1"], relationId: null }
  };
  const distanceWithExtraEdgeItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.distance");
  const coincidentWithExtraEdgeItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.coincident");
  if (
    distanceWithExtraEdgeItem?.enabled
      || coincidentWithExtraEdgeItem?.enabled
      || !String(distanceWithExtraEdgeItem?.disabledReason || "").includes("Clear selected sketch edges")
      || !String(coincidentWithExtraEdgeItem?.disabledReason || "").includes("Clear selected sketch edges")
  ) {
    console.error("FAILED: two-point Sketch toolbar commands should explain that extra selected edges must be cleared");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"], vertexIds: [], relationId: null }
  };
  const tangentLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.tangent");
  if (!tangentLineArcItem?.enabled) {
    console.error("FAILED: sketch.relation.tangent should be enabled for one line edge plus one circular arc");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"], vertexIds: ["rounded_sketch_arc_demo_v3"], relationId: null }
  };
  const tangentExtraPointItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.tangent");
  if (tangentExtraPointItem?.enabled || !String(tangentExtraPointItem?.disabledReason || "").includes("only two sketch edges")) {
    console.error("FAILED: sketch.relation.tangent should explain that extra selected points make the edge relation ambiguous");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e3"], vertexIds: [], relationId: null }
  };
  const tangentStraightEdgesItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.tangent");
  if (tangentStraightEdgesItem?.enabled || !String(tangentStraightEdgesItem?.disabledReason || "").includes("at least one circular sketch edge")) {
    console.error("FAILED: sketch.relation.tangent should explain that two straight edges cannot use the arc tangent relation");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1"], vertexIds: [], relationId: null }
  };
  const radiusForLineItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.radius");
  const diameterForLineItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.diameter");
  if (
    radiusForLineItem?.enabled
      || diameterForLineItem?.enabled
      || !String(radiusForLineItem?.disabledReason || "").includes("must be circular")
      || !String(diameterForLineItem?.disabledReason || "").includes("must be circular")
  ) {
    console.error("FAILED: Radius/Diameter should explain that a selected straight sketch edge is not circular");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e2"], vertexIds: [], relationId: null }
  };
  const concentricLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.concentric");
  const equalRadiusLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.equalRadius");
  const angleLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.angle");
  const trimLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  const extendLineArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.extend");
  if (
    concentricLineArcItem?.enabled
      || equalRadiusLineArcItem?.enabled
      || angleLineArcItem?.enabled
      || !String(concentricLineArcItem?.disabledReason || "").includes("Both selected sketch edges must be circular arcs")
      || !String(equalRadiusLineArcItem?.disabledReason || "").includes("Both selected sketch edges must be circular arcs")
      || !String(angleLineArcItem?.disabledReason || "").includes("Angle currently works on straight sketch edges")
  ) {
    console.error("FAILED: line+arc command feedback should distinguish two-arc relations from straight-edge Angle dimensions");
    return 1;
  }
  if (!trimLineArcItem?.enabled || !extendLineArcItem?.enabled) {
    console.error("FAILED: Sketch toolbar should keep Trim and Extend enabled for mixed line+arc outline selections");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2", "rounded_sketch_arc_demo_e4"],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2", "rounded_sketch_arc_demo_e4"], vertexIds: [], relationId: null }
  };
  const concentricArcArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.concentric");
  const equalRadiusArcArcItem = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.equalRadius");
  if (!concentricArcArcItem?.enabled || !equalRadiusArcArcItem?.enabled) {
    console.error("FAILED: concentric/equal-radius relation commands should be enabled for two selected circular arcs");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e3"], vertexIds: [], relationId: null }
  };
  const trimItemForOutlineEdges = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  const extendItemForOutlineEdges = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.extend");
  if (!trimItemForOutlineEdges?.enabled) {
    console.error("FAILED: sketch.modify.trim should be enabled for two selected outline edges");
    return 1;
  }
  if (!extendItemForOutlineEdges?.enabled) {
    console.error("FAILED: sketch.modify.extend should be enabled for two selected outline edges");
    return 1;
  }
  if (registeredViewerCommands["sketch.modify.extend"]?.() !== true || sketchExtendCalled !== 1) {
    console.error("FAILED: viewer-command-registration should route sketch.modify.extend to extendSelectedSketchEntity");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: {
      edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e3"],
      vertexIds: ["rounded_sketch_arc_demo_v3"],
      relationId: null
    }
  };
  const extendItemForEndpointChoice = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.extend");
  if (!extendItemForEndpointChoice?.enabled) {
    console.error("FAILED: sketch.modify.extend should stay enabled when one endpoint selects the extend side");
    return 1;
  }
  const cleanViewItemBeforeRun = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.view.clean");
  if (!cleanViewItemBeforeRun?.enabled || cleanViewItemBeforeRun.active) {
    console.error("FAILED: sketch.view.clean should be enabled and inactive while relations are visible");
    return 1;
  }
  if (registeredViewerCommands["sketch.view.clean"]?.() !== true || cleanSketchMode !== "clean" || cleanSketchStatus !== "Sketch clean view.") {
    console.error("FAILED: viewer-command-registration should route sketch.view.clean to setSketchMode(clean) and report status");
    return 1;
  }
  const cleanViewItemAfterRun = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.view.clean");
  if (!cleanViewItemAfterRun?.active || activeSketchState.sketchMode !== "clean" || activeSketchState.selection.edgeIds.length || activeSketchState.selection.vertexIds.length) {
    console.error("FAILED: sketch.view.clean should become active and clear sketch selection in clean mode");
    return 1;
  }
  const relationsItemInCleanView = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relations.toggle");
  if (relationsItemInCleanView?.active || relationsItemInCleanView?.label !== "Show Relations") {
    console.error("FAILED: sketch.relations.toggle should offer Show Relations while Clean View is active");
    return 1;
  }
  const relationsRefreshBefore = exitSketchRefreshCount;
  if (
    registeredViewerCommands["sketch.relations.toggle"]?.() !== true
      || activeSketchState.sketchMode !== "relations"
      || exitSketchStatus !== "Sketch relations shown."
      || exitSketchRefreshCount <= relationsRefreshBefore
  ) {
    console.error("FAILED: sketch.relations.toggle should restore relation overlays from Clean View and refresh command state");
    return 1;
  }
  const relationsItemAfterToggle = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relations.toggle");
  const cleanViewItemAfterToggle = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.view.clean");
  if (!relationsItemAfterToggle?.active || relationsItemAfterToggle?.label !== "Hide Relations" || cleanViewItemAfterToggle?.active) {
    console.error("FAILED: returning from Clean View should mark Relations active and Clean View inactive in the Sketch toolbar");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: {
      edgeIds: ["rounded_sketch_arc_demo_e1"],
      vertexIds: ["rounded_sketch_arc_demo_v1", "rounded_sketch_arc_demo_v2"],
      relationId: null
    }
  };
  const trimItemForOneEdgeEndpointChoice = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  if (!trimItemForOneEdgeEndpointChoice?.enabled) {
    console.error("FAILED: sketch.modify.trim should stay enabled for one selected outline edge with multiple endpoint choices");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: {
      edgeIds: ["rounded_sketch_arc_demo_e1", "rounded_sketch_arc_demo_e3"],
      vertexIds: ["rounded_sketch_arc_demo_v1", "rounded_sketch_arc_demo_v3"],
      relationId: null
    }
  };
  const trimItemForTwoEdgeEndpointChoice = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  if (!trimItemForTwoEdgeEndpointChoice?.enabled) {
    console.error("FAILED: sketch.modify.trim should stay enabled for two selected outline edges with multiple endpoint choices");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: ["delete_arc_ce"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["delete_arc_ce"], vertexIds: [], relationId: null }
  };
  const deleteItemForConstructionEdge = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.delete");
  const trimItemForConstructionEdge = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  if (!deleteItemForConstructionEdge?.enabled || !trimItemForConstructionEdge?.enabled) {
    console.error("FAILED: sketch toolbar should enable Delete and Trim for one selected construction edge");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["rounded_sketch_arc_demo_e2"],
    selectedConstructionEdgeIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e2"], vertexIds: [], relationId: null }
  };
  const deleteItemForOutlineArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.delete");
  if (!deleteItemForOutlineArc?.enabled) {
    console.error("FAILED: sketch toolbar should enable Delete for one selected outline circular arc");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: ["delete_arc_ce"],
    selectedConstructionEdgeIds: ["delete_arc_ce"],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["delete_arc_ce"], vertexIds: [], relationId: null }
  };
  const edgeArcItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.edge.arc");
  const flipItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.arc.flip");
  const splitItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.arc.split");
  const radiusItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.radius");
  const diameterItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.dimension.diameter");
  const trimItemForConstructionArc = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.modify.trim");
  if (
    edgeArcItemForConstructionArc?.enabled
      || flipItemForConstructionArc?.enabled
      || splitItemForConstructionArc?.enabled
      || !radiusItemForConstructionArc?.enabled
      || !diameterItemForConstructionArc?.enabled
      || !trimItemForConstructionArc?.enabled
  ) {
    console.error("FAILED: sketch toolbar should disable outline arc modifiers but keep Radius, Diameter, and Trim enabled for a selected construction arc");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: ["fix_point_cv1"],
    selectedFixedRelationIds: [],
    selection: { edgeIds: [], vertexIds: ["fix_point_cv1"], relationId: null }
  };
  const filletItemForConstructionPoint = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.corner.fillet");
  const fixItemForConstructionPoint = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.relation.fix");
  if (filletItemForConstructionPoint?.enabled || !fixItemForConstructionPoint?.enabled) {
    console.error("FAILED: sketch toolbar should disable Fillet but keep Fix enabled for a selected construction point");
    return 1;
  }
  activeSketchState = {
    plateId: "rounded_sketch_arc_demo",
    collection: "sketches",
    sketchMode: "relations",
    selectedArcEdgeIds: [],
    selectedConstructionEdgeIds: [],
    selectedConstructionVertexIds: [],
    selectedFixedRelationIds: [],
    selection: { edgeIds: ["rounded_sketch_arc_demo_e1"], vertexIds: ["rounded_sketch_arc_demo_v1"], relationId: null }
  };
  const filletItemForMixedSelection = exitCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.corner.fillet");
  if (filletItemForMixedSelection?.enabled || !String(filletItemForMixedSelection?.disabledReason || "").includes("Clear selected sketch edges")) {
    console.error("FAILED: sketch toolbar should explain that selected edges must be cleared before using Fillet on one corner");
    return 1;
  }
  let contourStarted = false;
  const contourRegisteredViewerCommands = {};
  let contourRefreshCount = 0;
  const contourCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(contourRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => contourRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof contourRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { contourRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: contourStarted ? "centerArcContour" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createCenterArcContourSketch: () => {
        contourStarted = true;
        return true;
      }
    })
  });
  contourCommandRegistration.registerCommands();
  const contourItemsBeforeRun = contourCommandRegistration.viewerCommandItems();
  const contourItemBeforeRun = contourItemsBeforeRun.find((item) => item.id === "sketch.arc.centerContour");
  if (!contourItemBeforeRun?.enabled || contourItemBeforeRun.active) {
    console.error("FAILED: sketch.arc.centerContour should be enabled and inactive before the contour tool starts");
    return 1;
  }
  if (contourRegisteredViewerCommands["sketch.arc.centerContour"]?.() !== true || !contourStarted || contourRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.arc.centerContour to createCenterArcContourSketch and refresh state");
    return 1;
  }
  const contourItemsAfterRun = contourCommandRegistration.viewerCommandItems();
  const contourItemAfterRun = contourItemsAfterRun.find((item) => item.id === "sketch.arc.centerContour");
  const centerArcItemAfterRun = contourItemsAfterRun.find((item) => item.id === "sketch.arc.center");
  if (!contourItemAfterRun?.active || centerArcItemAfterRun?.active) {
    console.error("FAILED: Center Arc Contour should have a distinct active command state from Center Arc");
    return 1;
  }
  let threePointContourStarted = false;
  const threePointContourRegisteredViewerCommands = {};
  let threePointContourRefreshCount = 0;
  const threePointContourCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(threePointContourRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => threePointContourRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof threePointContourRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { threePointContourRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: threePointContourStarted ? "threePointArcContour" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createThreePointArcContourSketch: () => {
        threePointContourStarted = true;
        return true;
      }
    })
  });
  threePointContourCommandRegistration.registerCommands();
  const threePointContourItemBeforeRun = threePointContourCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.arc.threePointContour");
  if (!threePointContourItemBeforeRun?.enabled || threePointContourItemBeforeRun.active) {
    console.error("FAILED: sketch.arc.threePointContour should be enabled and inactive before the contour tool starts");
    return 1;
  }
  if (threePointContourRegisteredViewerCommands["sketch.arc.threePointContour"]?.() !== true || !threePointContourStarted || threePointContourRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.arc.threePointContour to createThreePointArcContourSketch and refresh state");
    return 1;
  }
  const threePointContourItemsAfterRun = threePointContourCommandRegistration.viewerCommandItems();
  const threePointContourItemAfterRun = threePointContourItemsAfterRun.find((item) => item.id === "sketch.arc.threePointContour");
  const threePointArcItemAfterRun = threePointContourItemsAfterRun.find((item) => item.id === "sketch.arc.threePoint");
  if (!threePointContourItemAfterRun?.active || threePointArcItemAfterRun?.active) {
    console.error("FAILED: 3 Point Arc Contour should have a distinct active command state from 3 Point Arc");
    return 1;
  }
  let lineContourStarted = false;
  const lineContourRegisteredViewerCommands = {};
  let lineContourRefreshCount = 0;
  const lineContourCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(lineContourRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => lineContourRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof lineContourRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { lineContourRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: lineContourStarted ? "lineContour" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createLineContourSketch: () => {
        lineContourStarted = true;
        return true;
      }
    })
  });
  lineContourCommandRegistration.registerCommands();
  const lineContourItemBeforeRun = lineContourCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.line.contour");
  if (!lineContourItemBeforeRun?.enabled || lineContourItemBeforeRun.active) {
    console.error("FAILED: sketch.line.contour should be enabled and inactive before the contour tool starts");
    return 1;
  }
  if (lineContourRegisteredViewerCommands["sketch.line.contour"]?.() !== true || !lineContourStarted || lineContourRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.line.contour to createLineContourSketch and refresh state");
    return 1;
  }
  const lineContourItemsAfterRun = lineContourCommandRegistration.viewerCommandItems();
  const lineContourItemAfterRun = lineContourItemsAfterRun.find((item) => item.id === "sketch.line.contour");
  const lineItemAfterRun = lineContourItemsAfterRun.find((item) => item.id === "sketch.line.create");
  if (!lineContourItemAfterRun?.active || lineItemAfterRun?.active) {
    console.error("FAILED: Line Contour should have a distinct active command state from Line");
    return 1;
  }
  let diameterCircleStarted = false;
  const diameterCircleRegisteredViewerCommands = {};
  let diameterCircleRefreshCount = 0;
  const diameterCircleCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(diameterCircleRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => diameterCircleRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof diameterCircleRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { diameterCircleRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: diameterCircleStarted ? "diameterCircle" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createDiameterCircleSketch: () => {
        diameterCircleStarted = true;
        return true;
      }
    })
  });
  diameterCircleCommandRegistration.registerCommands();
  const diameterCircleItemBeforeRun = diameterCircleCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.circle.diameter");
  if (!diameterCircleItemBeforeRun?.enabled || diameterCircleItemBeforeRun.active) {
    console.error("FAILED: sketch.circle.diameter should be enabled and inactive before the diameter circle tool starts");
    return 1;
  }
  if (diameterCircleRegisteredViewerCommands["sketch.circle.diameter"]?.() !== true || !diameterCircleStarted || diameterCircleRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.circle.diameter to createDiameterCircleSketch and refresh state");
    return 1;
  }
  const diameterCircleItemsAfterRun = diameterCircleCommandRegistration.viewerCommandItems();
  const diameterCircleItemAfterRun = diameterCircleItemsAfterRun.find((item) => item.id === "sketch.circle.diameter");
  const circleItemAfterDiameterRun = diameterCircleItemsAfterRun.find((item) => item.id === "sketch.circle.create");
  if (!diameterCircleItemAfterRun?.active || circleItemAfterDiameterRun?.active) {
    console.error("FAILED: Diameter Circle should have a distinct active command state from Circle");
    return 1;
  }
  let threePointCircleStarted = false;
  const threePointCircleRegisteredViewerCommands = {};
  let threePointCircleRefreshCount = 0;
  const threePointCircleCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(threePointCircleRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => threePointCircleRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof threePointCircleRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { threePointCircleRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: threePointCircleStarted ? "threePointCircle" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createThreePointCircleSketch: () => {
        threePointCircleStarted = true;
        return true;
      }
    })
  });
  threePointCircleCommandRegistration.registerCommands();
  const threePointCircleItemBeforeRun = threePointCircleCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.circle.threePoint");
  if (!threePointCircleItemBeforeRun?.enabled || threePointCircleItemBeforeRun.active) {
    console.error("FAILED: sketch.circle.threePoint should be enabled and inactive before the 3 Point Circle tool starts");
    return 1;
  }
  if (threePointCircleRegisteredViewerCommands["sketch.circle.threePoint"]?.() !== true || !threePointCircleStarted || threePointCircleRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.circle.threePoint to createThreePointCircleSketch and refresh state");
    return 1;
  }
  const threePointCircleItemsAfterRun = threePointCircleCommandRegistration.viewerCommandItems();
  const threePointCircleItemAfterRun = threePointCircleItemsAfterRun.find((item) => item.id === "sketch.circle.threePoint");
  const circleItemAfterThreePointCircleRun = threePointCircleItemsAfterRun.find((item) => item.id === "sketch.circle.create");
  const diameterItemAfterThreePointCircleRun = threePointCircleItemsAfterRun.find((item) => item.id === "sketch.circle.diameter");
  if (!threePointCircleItemAfterRun?.active || circleItemAfterThreePointCircleRun?.active || diameterItemAfterThreePointCircleRun?.active) {
    console.error("FAILED: 3 Point Circle should have a distinct active command state from other circle tools");
    return 1;
  }
  let centerSlotStarted = false;
  const centerSlotRegisteredViewerCommands = {};
  let centerSlotRefreshCount = 0;
  const centerSlotCommandRegistration = createViewerCommandRegistration({
    settings: {},
    viewer: {
      viewOrientation: () => "iso",
      viewCamera: () => ({ orientation: "iso" })
    },
    viewerApp: {
      registerCommands: (commands) => {
        Object.assign(centerSlotRegisteredViewerCommands, commands);
        return commands;
      },
      runCommand: (commandId) => centerSlotRegisteredViewerCommands[commandId]?.(),
      canRunCommand: (commandId) => typeof centerSlotRegisteredViewerCommands[commandId] === "function",
      commandState: () => ({ activeCommandId: null }),
      selectionState: () => ({ selectedObjectIds: ["rounded_sketch_arc_demo"] })
    },
    api: { project: () => roundedSketchProject },
    selection: {},
    smartComponentCatalog: {},
    workspaceBindings: {
      refreshCommandState: () => { centerSlotRefreshCount += 1; }
    },
    getEditorApi: () => ({
      selectedState: () => ({ objectId: "rounded_sketch_arc_demo" })
    }),
    getPlateSketchEdit: () => ({
      activeState: () => ({
        plateId: "rounded_sketch_arc_demo",
        collection: "sketches",
        sketchMode: "relations",
        activeSketchTool: centerSlotStarted ? "centerSlot" : null,
        selection: { edgeIds: [], vertexIds: [], relationId: null }
      }),
      createCenterSlotSketch: () => {
        centerSlotStarted = true;
        return true;
      }
    })
  });
  centerSlotCommandRegistration.registerCommands();
  const centerSlotItemBeforeRun = centerSlotCommandRegistration.viewerCommandItems().find((item) => item.id === "sketch.slot.center");
  if (!centerSlotItemBeforeRun?.enabled || centerSlotItemBeforeRun.active) {
    console.error("FAILED: sketch.slot.center should be enabled and inactive before the center slot tool starts");
    return 1;
  }
  if (centerSlotRegisteredViewerCommands["sketch.slot.center"]?.() !== true || !centerSlotStarted || centerSlotRefreshCount < 1) {
    console.error("FAILED: viewer-command-registration should route sketch.slot.center to createCenterSlotSketch and refresh state");
    return 1;
  }
  const centerSlotItemsAfterRun = centerSlotCommandRegistration.viewerCommandItems();
  const centerSlotItemAfterRun = centerSlotItemsAfterRun.find((item) => item.id === "sketch.slot.center");
  const slotItemAfterCenterSlotRun = centerSlotItemsAfterRun.find((item) => item.id === "sketch.slot.create");
  if (!centerSlotItemAfterRun?.active || slotItemAfterCenterSlotRun?.active) {
    console.error("FAILED: Center Slot should have a distinct active command state from Slot");
    return 1;
  }
  if (registeredViewerCommands["sketch.exit"]?.() !== true || !exitSketchCleared || exitSketchStatus !== "Sketch mode closed." || exitSketchRefreshCount < 1) {
    console.error("FAILED: sketch.exit should clear active sketch mode, refresh command state, and report status");
    return 1;
  }
  const apiRegister = readJson(path.join(ROOT, "bobercad", "app", "engine", "api", "api-register.json"));
  const apiSpecsById = new Map((apiRegister.apis || []).map((apiSpec) => [apiSpec.id, apiSpec]));
  for (const apiId of [
    "store.addSketchConstructionArc",
    "store.addSketchConstructionLine",
    "store.filletSketchCorner",
    "store.flipSketchEdgeArc",
    "store.inferSketchRelations",
    "store.insertSketchVertex",
    "store.removeSketchConstructionLine",
    "store.removeSketchRelation",
    "store.removeSketchVertex",
    "store.setSketchCenterArc",
    "store.setSketchCenterRectangle",
    "store.setSketchCircle",
    "store.setSketchEdgeAngle",
    "store.setSketchEdgeAngleMode",
    "store.setSketchEdgeArc",
    "store.setSketchEdgeLength",
    "store.setSketchEdgeLengthMode",
    "store.setSketchEdgeRadius",
    "store.setSketchEdgeRadiusMode",
    "store.setSketchOutline",
    "store.setSketchPointDistance",
    "store.setSketchPointDistanceMode",
    "store.setSketchRoundedRectangle",
    "store.setSketchSlot",
    "store.setSketchThreePointArc",
    "store.setSketchVertex",
    "store.setSketchVertices",
    "store.splitSketchEdgeArc",
    "store.upsertSketchRelation"
  ]) {
    const apiSpec = apiSpecsById.get(apiId);
    if (!apiSpec) {
      console.error(`FAILED: api-register should include ${apiId}`);
      return 1;
    }
    if (!String(apiSpec.description || "").toLowerCase().includes("standalone sketch")) {
      console.error(`FAILED: api-register ${apiId} should describe standalone sketch behavior`);
      return 1;
    }
  }
  const guideSnap = solveSnap({
    projection: snapViewer,
    screen: { x: 25, y: 2 },
    candidates: [{ ...plateEdge, type: "creation-axis", label: "Start X axis", screenIntersectionMode: "self" }],
    screenTolerance: 5,
    intersectionTolerancePx: 5
  });
  if (guideSnap.snap?.label !== "Start X axis") {
    console.error("FAILED: construction guide lines should still snap beyond their finite endpoints");
    return 1;
  }
  const memberProfileEdgeOverlay = snapAxisSourceLines({
    kind: "line",
    providerId: "model.members",
    type: "member-profile-edge",
    objectId: "snap_member_edge",
    label: "Member edge",
    a: [0, 0, 0],
    b: [0, 0, 100],
    point: [0, 0, 10]
  }, { snapAxisHighlightSpan: 1600 })[0];
  if (JSON.stringify(memberProfileEdgeOverlay?.points) !== JSON.stringify([[0, 0, 0], [0, 0, 100]])) {
    console.error(`FAILED: member profile edge overlay should highlight the exact physical edge, got ${JSON.stringify(memberProfileEdgeOverlay?.points)}`);
    return 1;
  }
  const creationAxisOverlay = snapAxisSourceLines({
    kind: "line",
    providerId: "construction.memberCreateAxes",
    type: "creation-axis",
    label: "Start X axis",
    a: [0, 0, 0],
    b: [10, 0, 0],
    point: [0, 0, 0]
  }, { snapAxisHighlightSpan: 1600 })[0];
  if (JSON.stringify(creationAxisOverlay?.points) !== JSON.stringify([[-1600, 0, 0], [1600, 0, 0]])) {
    console.error(`FAILED: construction guide overlay should remain an extended guide axis, got ${JSON.stringify(creationAxisOverlay?.points)}`);
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
    projection: snapViewer,
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
    projection: snapViewer,
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
  const memberFaceInteriorBeatsSameFaceGuides = solveSnap({
    projection: snapViewer,
    screen: { x: 5, y: 5 },
    rawPoint: [5, 5, 0],
    candidates: [
      {
        kind: "line",
        type: "member-profile-face-centerline",
        objectId: "visible_member",
        label: "Member face centerline",
        a: [0, 5, 0],
        b: [10, 5, 0],
        point: [5, 5, 0],
        priority: 74
      },
      {
        kind: "point",
        type: "member-profile-face-center",
        objectId: "visible_member",
        label: "Member face center",
        point: [5, 5, 0],
        priority: 82
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
  if (memberFaceInteriorBeatsSameFaceGuides.snap?.type !== "member-profile-face") {
    console.error(`FAILED: member face plane should beat same-face helper snaps in the face interior, got ${memberFaceInteriorBeatsSameFaceGuides.snap?.type || "none"}`);
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
      gridSystems: {},
      levels: {}
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
  const memberCreateProject = {
    modelDefaults: {
      collections: {
        members: {
          "*": { profile: "DEMO_FLAT_100X10" }
        }
      }
    },
    model: {
      members: {},
      plates: {},
      fastenerGroups: {},
      features: {},
      workPoints: {},
      referencePlanes: {},
      gridSystems: {},
      levels: {}
    }
  };
  const memberCreateContexts = [];
  const memberCreateController = createMemberCreateController({
    viewer: {},
    api: {
      project: () => memberCreateProject,
      profiles: () => profiles.profiles,
      createMember: (options) => ({
        project: memberCreateProject,
        member: {
          id: "created_snap_beam",
          ...options
        }
      })
    },
    profiles,
    settings,
    snapManager: {
      resetCycle: () => {},
      resolve: (input) => {
        memberCreateContexts.push(input.context || {});
        return {
          accepted: true,
          pointWorld: input.rawPoint,
          snap: {
            kind: "point",
            type: "test-snap",
            label: "Test snap",
            point: input.rawPoint
          }
        };
      }
    },
    onPreviewChange: () => {},
    onOverlayChange: () => {},
    onProjectChange: () => {},
    onStatusChange: () => {}
  });
  memberCreateController.start("beam");
  memberCreateController.pointerDown({ screen: { x: 0, y: 0 }, hit: { point: [0, 0, 0] }, event: {} });
  memberCreateController.pointerDown({ screen: { x: 10, y: 0 }, hit: { point: [10, 0, 0] }, event: {} });
  if (memberCreateContexts.length < 2) {
    console.error("FAILED: member create should resolve snaps for both start and end picks");
    return 1;
  }
  if (memberCreateContexts.some((context) => Object.prototype.hasOwnProperty.call(context, "includeSurfaceTargets"))) {
    console.error("FAILED: member create should not downgrade snap profile surface targets away from beam faces");
    return 1;
  }
  if (memberCreateContexts.some((context) => Object.prototype.hasOwnProperty.call(context, "snapVisibilityRequirePrecise"))) {
    console.error("FAILED: member create should keep precise visibility filtering for member face snaps");
    return 1;
  }
  const plateCreateContexts = [];
  const plateCreatePlane = {
    origin: [0, 0, 0],
    normal: [0, 0, 1],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0]
  };
  const plateCreateController = createPlateCreateController({
    viewer: {
      screenRay: (x, y) => ({ origin: [x, y, 100], direction: [0, 0, -1] }),
      projectPoint: ([x, y, z = 0]) => ({ x, y, depth: z }),
      screenScale: () => 1
    },
    api: { project: () => memberCreateProject },
    snapManager: {
      resetCycle: () => {},
      point: (input) => {
        plateCreateContexts.push(input.context || {});
        return {
          point: [input.rawPoint[0], input.rawPoint[1], 5],
          snap: {
            kind: "plane",
            type: "member-profile-face",
            label: "Member face",
            point: [input.rawPoint[0], input.rawPoint[1], 5]
          }
        };
      }
    },
    getWorkPlane: () => plateCreatePlane,
    settings,
    onPreviewChange: () => {},
    onOverlayChange: () => {},
    onProjectChange: () => {},
    onStatusChange: () => {}
  });
  plateCreateController.start({ screen: { x: 0, y: 0 }, event: {} });
  plateCreateController.pointerDown({ screen: { x: 0, y: 0 }, event: {} });
  if (!plateCreateContexts.length) {
    console.error("FAILED: plate create should resolve snap context for face picks");
    return 1;
  }
  if (plateCreateContexts.some((context) => context.projectToPlane !== false)) {
    console.error("FAILED: plate create should preserve visible face snap points instead of projecting them back to the active work plane");
    return 1;
  }
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
      gridSystems: {},
      levels: {}
    }
  };
  const memberFaceCandidates = collectSnapCandidates({
    project: memberCenterlineProject,
    profiles,
    context: { includeGlobalAxes: false },
    scope: {},
    profile: { includeSurfaceTargets: "faces" },
    rawPoint: [25, 0, 5]
  });
  const memberFaceCenterlineCandidates = memberFaceCandidates.filter((candidate) => candidate.type === "member-profile-face-centerline");
  const memberFaceCenterCandidates = memberFaceCandidates.filter((candidate) => candidate.type === "member-profile-face-center");
  if (!memberFaceCenterlineCandidates.length) {
    console.error("FAILED: member face centerline candidates should be generated for profile faces");
    return 1;
  }
  if (memberFaceCenterlineCandidates.some((candidate) => candidate.visibilityPolicy !== "visible-surface" || !candidate.snapFacePoints?.length || !candidate.bounds || !candidate.normal)) {
    console.error("FAILED: member face centerline snaps should carry visible-surface source-face metadata");
    return 1;
  }
  if (!memberFaceCenterCandidates.length) {
    console.error("FAILED: member face center candidates should be generated for profile faces");
    return 1;
  }
  if (memberFaceCenterCandidates.some((candidate) => candidate.visibilityPolicy !== "visible-surface" || !candidate.snapFacePoints?.length)) {
    console.error("FAILED: member face center snaps should require the same visible source face as their parent surface");
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
  if (visibleMemberFaceCenterlineSnap.snap?.type !== "member-profile-face") {
    console.error(`FAILED: visible member face plane should win over same-face centerline in the face interior, got ${visibleMemberFaceCenterlineSnap.snap?.label || "none"}`);
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
      gridSystems: {},
      levels: {}
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
    projection: snapViewer,
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
    projection: snapViewer,
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
    projection: snapViewer,
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
