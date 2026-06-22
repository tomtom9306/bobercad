const fs = require("fs");
const path = require("path");
const { fileURLToPath, pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
    const { renderSceneThumbnailDataUrl, sceneRenderableCounts } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/rendering/preview/scene-thumbnail-renderer.mjs")).href);
    const { createSmartComponentPreviewService } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/ui/viewer/smart-component-preview-service.mjs")).href);
    const { knownSmartComponentPreviewContextIds, smartComponentPreviewContextsForPreset } = await import(pathToFileURL(path.join(ROOT, "bobercad/app/engine/modules/smart-components/smart-component-preview-contexts.mjs")).href);

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

    const previewStore = createProjectStore({
      project: readJson("bobercad/data/projects/sample_connection_test_frame.json"),
      profiles,
      smartComponentCatalog,
      fasteners,
      materials
    });
    const beforePreview = JSON.stringify(previewStore.project());
    const preview = previewStore.previewSmartComponentFromPreset("moment-end-plate", ["column_c1", "beam_b1_south"]);
    const afterPreview = JSON.stringify(previewStore.project());
    if (beforePreview !== afterPreview) fail(errors, "Smart Component preview: dry-run must not mutate the active store project");
    if (!preview.project?.model?.smartComponentInstances?.[preview.smartComponentId]) fail(errors, "Smart Component preview: dry-run project should contain the preview Smart Component");
    if (!preview.focusObjectIds?.includes("column_c1") || !preview.focusObjectIds?.includes("beam_b1_south") || !preview.ownedObjectIds?.length) {
      fail(errors, `Smart Component preview: expected selected members and generated objects in preview focus ids, got ${JSON.stringify(preview.focusObjectIds)}`);
    }
    const previewScene = buildScene(preview.project, profiles, fasteners, viewerSettings, {
      activeSmartComponentId: preview.smartComponentId,
      renderObjectIds: preview.focusObjectIds
    });
    const previewCounts = sceneRenderableCounts(previewScene, [...preview.ownedObjectIds, ...preview.helperObjectIds]);
    if (previewCounts.faces <= 0 && previewCounts.lines <= 0) {
      fail(errors, `Smart Component preview: expected generated scene geometry, got ${JSON.stringify(previewCounts)}`);
    }
    const previewDataUrl = renderSceneThumbnailDataUrl(previewScene, { objectIds: preview.focusObjectIds });
    if (!previewDataUrl?.startsWith("data:image/svg+xml")) {
      fail(errors, "Smart Component preview: thumbnail renderer must return a generated SVG data URL");
    }
    const currentPreviewStore = createProjectStore({
      project: readJson("bobercad/data/projects/sample_connection_test_frame.json"),
      profiles,
      smartComponentCatalog,
      fasteners,
      materials
    });
    const currentPreviewCreated = currentPreviewStore.createSmartComponentFromPreset("moment-end-plate", ["column_c1", "beam_b1_south"]);
    const currentPreviewService = createSmartComponentPreviewService({
      api: currentPreviewStore,
      profiles,
      fasteners,
      materials,
      smartComponentCatalog,
      viewerSettings
    });
    const currentPreview = await currentPreviewService.resolveSmartComponentInstancePreview({ smartComponentId: currentPreviewCreated.smartComponentId });
    if (currentPreview.state !== "available" || !currentPreview.dataUrl?.startsWith("data:image/svg+xml")) {
      fail(errors, `Smart Component preview: current-project instance preview should return an available data URL, got ${JSON.stringify({ state: currentPreview.state, reason: currentPreview.reason })}`);
    }
    const connectionPresetIds = Object.values(smartComponentCatalog.smartComponents || {})
      .filter((preset) => preset.kind === "connection")
      .map((preset) => preset.id);
    const nestedSystemConnectionPresetIds = new Set(["stair-hardware", "member-splice"]);
    const knownPreviewContextIds = new Set(knownSmartComponentPreviewContextIds());
    for (const presetId of connectionPresetIds) {
      const preset = smartComponentCatalog.smartComponents[presetId];
      const definition = smartComponentCatalog.definitions?.[preset.type];
      const contextIds = preset.preview?.contexts || definition?.preview?.contexts || [];
      if (!Array.isArray(contextIds) || !contextIds.length) {
        fail(errors, `Smart Component preview: connection preset ${presetId} must declare preview.contexts in its Smart Component definition or preset`);
        continue;
      }
      for (const contextId of contextIds) {
        if (!knownPreviewContextIds.has(contextId)) {
          fail(errors, `Smart Component preview: connection preset ${presetId} references unknown preview context ${contextId}`);
        }
      }
      const orderedContexts = smartComponentPreviewContextsForPreset(preset);
      if (orderedContexts[0]?.id !== contextIds[0]) {
        fail(errors, `Smart Component preview: preset ${presetId} must resolve preview contexts from metadata, got first=${orderedContexts[0]?.id || "none"} expected=${contextIds[0]}`);
      }
    }
    for (const presetId of connectionPresetIds) {
      const presetPreview = await currentPreviewService.resolvePresetPreview({ presetId, selectedObjectIds: [] });
      if (presetPreview.state !== "available" || !presetPreview.dataUrl?.startsWith("data:image/svg+xml")) {
        fail(errors, `Smart Component preview: connection preset ${presetId} should have a real default preview, got ${JSON.stringify({ state: presetPreview.state, reason: presetPreview.reason, source: presetPreview.source })}`);
      }
      if (!nestedSystemConnectionPresetIds.has(presetId) && presetPreview.generationMode !== "dry-run") {
        fail(errors, `Smart Component preview: connection preset ${presetId} default preview must be generated by dry-run, got ${JSON.stringify({ source: presetPreview.source, generationMode: presetPreview.generationMode })}`);
      }
      if (nestedSystemConnectionPresetIds.has(presetId) && presetPreview.generationMode !== "context-regenerate") {
        fail(errors, `Smart Component preview: nested connection preset ${presetId} default preview must regenerate an existing context instance, got ${JSON.stringify({ source: presetPreview.source, generationMode: presetPreview.generationMode })}`);
      }
    }
    const selectionPreviewStore = createProjectStore({
      project: readJson("bobercad/data/projects/sample_connection_test_frame.json"),
      profiles,
      smartComponentCatalog,
      fasteners,
      materials
    });
    const selectionPreviewService = createSmartComponentPreviewService({
      api: selectionPreviewStore,
      profiles,
      fasteners,
      materials,
      smartComponentCatalog,
      viewerSettings
    });
    const compatibleSelectedPreview = await selectionPreviewService.resolvePresetPreview({
      presetId: "moment-end-plate",
      selectedObjectIds: ["column_c1", "beam_b1_south"]
    });
    if (compatibleSelectedPreview.state !== "available" || compatibleSelectedPreview.selectionActive !== true) {
      fail(errors, `Smart Component preview: compatible selected members should rank as available, got ${JSON.stringify({ state: compatibleSelectedPreview.state, reason: compatibleSelectedPreview.reason })}`);
    }
    const singleSelectedPreview = await selectionPreviewService.resolvePresetPreview({
      presetId: "moment-end-plate",
      selectedObjectIds: ["beam_b1_south"]
    });
    if (singleSelectedPreview.state !== "available" || singleSelectedPreview.selectionActive !== true || singleSelectedPreview.source !== "selection-member") {
      fail(errors, `Smart Component preview: one selected member should evaluate compatible connection candidates, got ${JSON.stringify({ state: singleSelectedPreview.state, source: singleSelectedPreview.source, reason: singleSelectedPreview.reason })}`);
    }
    const incompatibleSelectedPreview = await selectionPreviewService.resolvePresetPreview({
      presetId: "fin-plate",
      selectedObjectIds: ["column_c1", "beam_b1_south"]
    });
    if (incompatibleSelectedPreview.state !== "unavailable" || incompatibleSelectedPreview.selectionActive !== true || !incompatibleSelectedPreview.reason) {
      fail(errors, `Smart Component preview: incompatible selected members should remain visible with an unavailable reason, got ${JSON.stringify({ state: incompatibleSelectedPreview.state, reason: incompatibleSelectedPreview.reason })}`);
    }

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
    const created = store.createSmartComponentFromPreset("fin-plate", ["column_1", "beam_1"]);
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

module.exports = { checkAutoSmartComponentLifecycle, checkStairSystemGenerator };
