const path = require("path");
const { pathToFileURL } = require("url");
const { assertNavCubeCameraRotations, createDetailFreeMemberProject, readJson } = require("./contracts/viewer_runtime_contract_helpers");

const ROOT = path.resolve(__dirname, "..");

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function referencePrimitiveSignature(scene) {
  const pickPrimitive = (item) => ({
    points: item.points,
    color: item.color,
    objectId: item.objectId,
    referenceAssetId: item.referenceAssetId,
    referenceObjectId: item.referenceObjectId,
    referenceObjectKind: item.referenceObjectKind,
    referenceSnapEnabled: item.referenceSnapEnabled,
    opacity: item.opacity ?? null
  });
  return JSON.stringify({
    faces: (scene.faces || []).filter((face) => face.collection === "referenceGeometry").map(pickPrimitive),
    lines: (scene.lines || []).filter((line) => line.collection === "referenceGeometry").map(pickPrimitive),
    previewStats: scene.referenceGeometryPreviewStats || null
  });
}

async function main() {
  const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "scene-geometry-builder.mjs")).href);
  const { createProjectStore } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "store", "project-command-store.mjs")).href);
  const { createCamera } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "camera.mjs")).href);
  const { navCubeRotationForCameraAngles } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "nav-cube.mjs")).href);
  const { referenceAssetUrl, referenceChunkLoadError, referenceChunkUrl, referenceGeometryRootUrl, referenceManifestChunkLoadError, referenceManifestLoadError, referenceObjectLoadError, referencePreviewChunkIds, referenceProjectAssetLoadError, runtimeReferenceAssetBoundsError, runtimeReferenceGeometryData } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "reference-geometry-runtime-paths.mjs")).href);
  const { ccwPoints } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "csg.mjs")).href);
  const { signedArea2d, triangulateFace } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "geometry", "polygon.mjs")).href);
  const { triangulateSceneFace } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "webgl", "webgl-reference-triangulation.mjs")).href);
  const { solveSnap } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "interaction", "snap-solver.mjs")).href);
  const { sketchFromRectangle } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "api", "project", "plate-sketch-relations-and-bends.mjs")).href);
  const { collectSnapCandidates } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-candidate-providers.mjs")).href);
  const { createSnapManager } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "snap-manager.mjs")).href);
  const { createMemberCreateController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "member-create-controller.mjs")).href);
  const { createPlateCreateController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-create-controller.mjs")).href);
  const { createPlateSketchEditController } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "interaction", "plate-sketch-drag-edit-controller.mjs")).href);
  const { snapAxisSourceLines, snapPointOverlay } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "authoring", "snap-overlays.mjs")).href);
  const { buildSmartComponentDimensions } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "annotations", "build-dimensions.mjs")).href);
  const { projectReferenceGeometryFileEntries } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "project-files-panel.mjs")).href);
  const { dataSourceDescriptor, projectReferenceGeometryRuntimeFileSources, referenceGeometryImportSessionState, referenceGeometryImportWorkspaceResponse, referenceGeometryImportWorkspaceResponseEnvelope } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "commands", "data-surface-metadata.mjs")).href);
  const { createViewerQaBridge } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-qa-bridge.mjs")).href);
  const { loadSmartComponentDefinitions, smartComponentDefinition } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "engine", "modules", "smart-components", "smart-component-registry.mjs")).href);
  const settingsPath = path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-settings.json");
  const settings = readJson(settingsPath);
  const navCubeRotationError = assertNavCubeCameraRotations(navCubeRotationForCameraAngles);
  if (navCubeRotationError) {
    console.error(navCubeRotationError);
    return 1;
  }
  const referenceFallbackTriangles = triangulateSceneFace({
    collection: "referenceGeometry",
    points: [
      [9.435895792335941, 911.0000108148267, -683.2904847861446],
      [309.436081514501, 911.0000108148267, -683.2901643515743],
      [309.43623410239707, 911.0000108148267, -839.1234315640231],
      [609.4359594452199, 911.0000108148267, -839.1230958706637],
      [609.4360815155324, 911.0000108148267, -994.9563478243235],
      [909.4363256571833, 911.0000108148267, -994.9560426485423],
      [9.43577633769928, 911.0000108148267, -571.4535096881064]
    ]
  });
  if (!referenceFallbackTriangles.length) {
    console.error("FAILED: reference geometry WebGL fallback should render difficult imported IFC faces");
    return 1;
  }
  const projectPath = path.resolve(path.dirname(settingsPath), settings.project.path);
  const project = readJson(projectPath);
  const referenceFileEntries = projectReferenceGeometryFileEntries(project);
  const sampleReferenceFileEntry = referenceFileEntries.find((entry) => entry.id === "reference-sample_reference_geometry");
  const ifcReferenceFileEntry = referenceFileEntries.find((entry) => entry.id === "reference-a7614_lego_full_mock_up_ifc");
  if (
    referenceFileEntries.length !== 2
    || sampleReferenceFileEntry?.kind !== "Reference"
    || sampleReferenceFileEntry?.path !== "../references/sample_reference_geometry.json"
    || sampleReferenceFileEntry?.status !== "visible"
    || !sampleReferenceFileEntry?.meta?.includes("snap off")
    || !sampleReferenceFileEntry?.meta?.includes("display override")
    || !sampleReferenceFileEntry?.meta?.includes("transform")
    || ifcReferenceFileEntry?.kind !== "Reference"
    || ifcReferenceFileEntry?.path !== "../references/a7614_lego_full_mock_up_ifc.reference.json"
    || ifcReferenceFileEntry?.status !== "visible"
  ) {
    console.error("FAILED: Project Files panel should expose project.referenceGeometry.assets as pointer-only reference file rows with pointer status metadata");
    return 1;
  }
  const guardedReferenceFileEntries = projectReferenceGeometryFileEntries({
    referenceGeometry: {
      assets: {
        good_reference: { path: "../references/good.reference.json" },
        outside_reference: { path: "../../app/schemas/project.schema.json" },
        url_reference: { path: "https://example.invalid/reference.json" },
        backslash_reference: { path: "../references\\bad.reference.json" },
        encoded_reference: { path: "../references/%2e%2e/projects/sample_boolean_beam.json" },
        "bad reference id": { path: "../references/bad.reference.json" },
        constructor: { path: "../references/constructor.reference.json" }
      }
    }
  });
  if (guardedReferenceFileEntries.length !== 1 || guardedReferenceFileEntries[0].id !== "reference-good_reference") {
    console.error("FAILED: Project Files panel should filter unsafe referenceGeometry.assets ids and paths before creating source links");
    return 1;
  }
  const profiles = readJson(path.resolve(path.dirname(projectPath), project.libraries.profiles.path));
  const fasteners = readJson(path.resolve(path.dirname(projectPath), project.libraries.fasteners.path));
  const scene = buildScene(project, profiles, fasteners, settings);
  const referenceGeometryPath = path.join(ROOT, "bobercad", "data", "references", "sample_reference_geometry.json");
  const referenceChunkPath = path.join(ROOT, "bobercad", "data", "references", "chunks", "sample_reference_scan_points.chunk.json");
  const projectUrl = pathToFileURL(projectPath);
  const referenceRootUrl = referenceGeometryRootUrl(projectUrl);
  const sampleReferenceUrl = referenceAssetUrl("../references/sample_reference_geometry.json", projectUrl);
  if (!sampleReferenceUrl || !sampleReferenceUrl.href.endsWith("/bobercad/data/references/sample_reference_geometry.json")) {
    console.error(`FAILED: browser reference geometry loader should accept repo reference asset paths, got ${sampleReferenceUrl?.href || "<null>"}`);
    return 1;
  }
  const rejectedAssetPaths = [
    "../../app/schemas/project.schema.json",
    "../references/../projects/sample_boolean_beam.json",
    "../references/%2e%2e/projects/sample_boolean_beam.json",
    "../references/chunks/%2e%2e/sample_reference_geometry.json",
    "../references/chunks/sample_reference_scan_points.chunk.json",
    "../references/sample_reference_geometry",
    "../references/sample_reference_geometry.JSON",
    "../references/sample reference.geometry.json",
    "../references/sample%2ereference.json",
    "../references\\sample_reference_geometry.json",
    "/bobercad/data/references/sample_reference_geometry.json",
    "https://example.com/reference.json"
  ];
  if (rejectedAssetPaths.some((candidate) => referenceAssetUrl(candidate, projectUrl))) {
    console.error("FAILED: browser reference geometry loader should reject unsafe project reference asset paths");
    return 1;
  }
  const sampleProjectReferenceAsset = project.referenceGeometry.assets.sample_reference_geometry;
  if (referenceProjectAssetLoadError("sample_reference_geometry", sampleProjectReferenceAsset)) {
    console.error("FAILED: browser reference geometry loader should accept valid project reference transform metadata");
    return 1;
  }
  if (referenceProjectAssetLoadError("sample_reference_geometry", { path: "../references/sample_reference_geometry.json" })) {
    console.error("FAILED: browser reference geometry loader should accept project reference assets without explicit transforms");
    return 1;
  }
  if (referenceProjectAssetLoadError("styled_reference_geometry", {
    path: "../references/sample_reference_geometry.json",
    visible: true,
    snapEnabled: false,
    display: {
      visible: true,
      color: "#aabbcc",
      edgeColor: "#AABBCC",
      opacity: 0.25,
      pointSize: 12
    }
  })) {
    console.error("FAILED: browser reference geometry loader should accept valid project reference display metadata");
    return 1;
  }
  const rejectedProjectReferenceAssetCases = [
    {
      label: "unsafe project asset id",
      id: "bad asset",
      asset: sampleProjectReferenceAsset
    },
    {
      label: "reserved project asset id",
      id: "constructor",
      asset: sampleProjectReferenceAsset
    },
    {
      label: "non-object project asset",
      asset: []
    },
    {
      label: "missing project asset path",
      asset: (({ path: _path, ...asset }) => asset)(sampleProjectReferenceAsset)
    },
    {
      label: "unsafe project asset path",
      asset: { ...sampleProjectReferenceAsset, path: "../projects/sample_boolean_beam.json" }
    },
    {
      label: "unsupported project asset field",
      asset: { ...sampleProjectReferenceAsset, objects: {} }
    },
    {
      label: "non-boolean project asset visible flag",
      asset: { ...sampleProjectReferenceAsset, visible: "false" }
    },
    {
      label: "non-boolean project asset snap flag",
      asset: { ...sampleProjectReferenceAsset, snapEnabled: "true" }
    },
    {
      label: "non-object project asset display",
      asset: { ...sampleProjectReferenceAsset, display: [] }
    },
    {
      label: "invalid project asset display color",
      asset: { ...sampleProjectReferenceAsset, display: { color: "red" } }
    },
    {
      label: "invalid project asset display edgeColor",
      asset: { ...sampleProjectReferenceAsset, display: { edgeColor: "#12345" } }
    },
    {
      label: "unsupported project asset display field",
      asset: { ...sampleProjectReferenceAsset, display: { transparent: true } }
    },
    {
      label: "out-of-range project asset display opacity",
      asset: { ...sampleProjectReferenceAsset, display: { opacity: 1.2 } }
    },
    {
      label: "non-positive project asset display pointSize",
      asset: { ...sampleProjectReferenceAsset, display: { pointSize: 0 } }
    },
    {
      label: "non-object project transform",
      asset: { ...sampleProjectReferenceAsset, transform: [] }
    },
    {
      label: "unsupported project transform field",
      asset: { ...sampleProjectReferenceAsset, transform: { ...sampleProjectReferenceAsset.transform, matrix: [1, 0, 0, 1] } }
    },
    {
      label: "non-finite project transform origin",
      asset: { ...sampleProjectReferenceAsset, transform: { ...sampleProjectReferenceAsset.transform, origin: [Infinity, 0, 0] } }
    },
    {
      label: "non-positive project transform scale",
      asset: { ...sampleProjectReferenceAsset, transform: { ...sampleProjectReferenceAsset.transform, scale: 0 } }
    },
    {
      label: "zero project transform axis",
      asset: { ...sampleProjectReferenceAsset, transform: { ...sampleProjectReferenceAsset.transform, axisX: [0, 0, 0] } }
    },
    {
      label: "degenerate project transform basis",
      asset: { ...sampleProjectReferenceAsset, transform: { ...sampleProjectReferenceAsset.transform, axisY: [1, 0, 0] } }
    }
  ];
  for (const { label, id, asset } of rejectedProjectReferenceAssetCases) {
    if (!referenceProjectAssetLoadError(id || "sample_reference_geometry", asset)) {
      console.error(`FAILED: browser reference geometry loader should reject ${label}`);
      return 1;
    }
  }
  const sampleChunkUrl = referenceChunkUrl("chunks/sample_reference_scan_points.chunk.json", sampleReferenceUrl, referenceRootUrl);
  if (!sampleChunkUrl || !sampleChunkUrl.href.endsWith("/bobercad/data/references/chunks/sample_reference_scan_points.chunk.json")) {
    console.error(`FAILED: browser reference geometry loader should accept manifest-local point-cloud chunk paths, got ${sampleChunkUrl?.href || "<null>"}`);
    return 1;
  }
  const rejectedChunkPaths = [
    "../projects/sample_boolean_beam.json",
    "chunks/../sample_reference_geometry.json",
    "chunks/%2e%2e/sample_reference_geometry.json",
    "chunks/%2f/sidecar.json",
    "chunks\\sidecar.json",
    "/bobercad/data/references/chunks/sample_reference_scan_points.chunk.json",
    "https://example.com/chunk.json"
  ];
  if (rejectedChunkPaths.some((candidate) => referenceChunkUrl(candidate, sampleReferenceUrl, referenceRootUrl))) {
    console.error("FAILED: browser reference geometry loader should reject unsafe point-cloud chunk sidecar paths");
    return 1;
  }
  const referenceGeometry = readJson(referenceGeometryPath);
  const privateReferenceSourceFileName = "C:/private/customer/source.dwg";
  const privateReferenceDiagnosticPath = "C:/private/customer/adapter.log";
  const privateReferenceDisplayName = "C:/private/customer/reference.step";
  if (referenceManifestLoadError("sample_reference_geometry", referenceGeometry)) {
    console.error("FAILED: browser reference geometry loader should accept matching canonical reference manifests");
    return 1;
  }
  const chunkBudgetReference = {
    objects: {
      chunk_budget_scan: {
        id: "chunk_budget_scan",
        kind: "point-cloud",
        chunkIds: ["budget_chunk_1", "budget_chunk_2", "budget_chunk_3"]
      }
    },
    chunks: [
      {
        id: "budget_chunk_1",
        kind: "point-cloud",
        objectId: "chunk_budget_scan",
        path: "chunks/budget_chunk_1.json",
        pointCount: 1,
        bounds: { min: [0, 0, 0], max: [0, 0, 0] }
      },
      {
        id: "budget_chunk_2",
        kind: "point-cloud",
        objectId: "chunk_budget_scan",
        path: "chunks/budget_chunk_2.json",
        pointCount: 1,
        bounds: { min: [1, 0, 0], max: [1, 0, 0] }
      },
      {
        id: "budget_chunk_3",
        kind: "point-cloud",
        objectId: "chunk_budget_scan",
        path: "chunks/budget_chunk_3.json",
        pointCount: 1,
        bounds: { min: [2, 0, 0], max: [2, 0, 0] }
      }
    ]
  };
  const pointBudgetChunkIds = [...referencePreviewChunkIds(chunkBudgetReference, {
    render: { referenceGeometry: { pointPreviewLimit: 2, pointPreviewChunkLimit: 10 } }
  })];
  if (pointBudgetChunkIds.join(",") !== "budget_chunk_1,budget_chunk_2") {
    console.error(`FAILED: browser reference geometry loader should stop selecting point-cloud chunks at pointPreviewLimit, got ${pointBudgetChunkIds.join(",")}`);
    return 1;
  }
  const chunkBudgetChunkIds = [...referencePreviewChunkIds(chunkBudgetReference, {
    render: { referenceGeometry: { pointPreviewLimit: 10, pointPreviewChunkLimit: 2 } }
  })];
  if (chunkBudgetChunkIds.join(",") !== "budget_chunk_1,budget_chunk_2") {
    console.error(`FAILED: browser reference geometry loader should stop selecting point-cloud chunks at pointPreviewChunkLimit, got ${chunkBudgetChunkIds.join(",")}`);
    return 1;
  }
  const zeroChunkBudgetIds = [...referencePreviewChunkIds(chunkBudgetReference, {
    render: { referenceGeometry: { pointPreviewLimit: 10, pointPreviewChunkLimit: 0 } }
  })];
  if (zeroChunkBudgetIds.length !== 0) {
    console.error("FAILED: browser reference geometry loader should allow pointPreviewChunkLimit 0 to disable point-cloud chunk sidecar preview loading");
    return 1;
  }
  if (!referenceManifestLoadError("bad asset", { ...referenceGeometry, asset: { ...referenceGeometry.asset, id: "bad asset" } })) {
    console.error("FAILED: browser reference geometry loader should reject unsafe project/manifest asset ids");
    return 1;
  }
  const rejectedManifestCases = [
    {
      label: "missing manifest schema ref",
      data: { ...referenceGeometry, $schema: undefined }
    },
    {
      label: "empty manifest schema ref",
      data: { ...referenceGeometry, $schema: "" }
    },
    {
      label: "missing schema",
      data: { ...referenceGeometry, schema: undefined }
    },
    {
      label: "unsupported schema version",
      data: { ...referenceGeometry, schemaVersion: "99.0.0" }
    },
    {
      label: "unsupported manifest field",
      data: { ...referenceGeometry, adapterLocalPath: "C:/adapter/cache" }
    },
    {
      label: "missing asset metadata",
      data: { ...referenceGeometry, asset: undefined }
    },
    {
      label: "unsupported asset field",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, adapterLocalPath: "C:/adapter/cache" } }
    },
    {
      label: "missing asset name",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, name: undefined } }
    },
    {
      label: "empty asset name",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, name: "" } }
    },
    {
      label: "path-like asset name",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, name: privateReferenceDisplayName } }
    },
    {
      label: "missing asset source",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: undefined } }
    },
    {
      label: "unsupported asset source format",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { format: "gltf" } } }
    },
    {
      label: "unsupported asset source field",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, sdkPath: "C:/secret/sdk" } } }
    },
    {
      label: "empty source fileName",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, fileName: "" } } }
    },
    {
      label: "path-like source fileName",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, fileName: privateReferenceSourceFileName } } }
    },
    {
      label: "uppercase source fileExtension",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, fileExtension: "IFC" } } }
    },
    {
      label: "dotted source fileExtension",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, fileExtension: ".ifc" } } }
    },
    {
      label: "mismatched source fileExtension family",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, format: "ifc", fileExtension: "e57" } } }
    },
    {
      label: "empty source requestedFormat",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, requestedFormat: "" } } }
    },
    {
      label: "uppercase source requestedFormat",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, requestedFormat: "IFC" } } }
    },
    {
      label: "mismatched source requestedFormat family",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, format: "e57", requestedFormat: "ifczip" } } }
    },
    {
      label: "unknown source requestedFormat family",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, format: "unknown", requestedFormat: "ifc" } } }
    },
    {
      label: "negative source fileSizeBytes",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, fileSizeBytes: -1 } } }
    },
    {
      label: "invalid source modifiedTime",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, modifiedTime: "not-a-date" } } }
    },
    {
      label: "date-only source modifiedTime",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, modifiedTime: "2026-06-27" } } }
    },
    {
      label: "loose source modifiedTime",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, modifiedTime: "June 27, 2026" } } }
    },
    {
      label: "invalid calendar source modifiedTime",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, modifiedTime: "2026-02-31T00:00:00Z" } } }
    },
    {
      label: "invalid offset source modifiedTime",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, modifiedTime: "2026-06-27T00:00:00+24:00" } } }
    },
    {
      label: "invalid source statFingerprint",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, statFingerprint: "sha256:abc" } } }
    },
    {
      label: "empty source checksum",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, checksum: "" } } }
    },
    {
      label: "malformed source checksum",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, checksum: "A".repeat(64) } } }
    },
    {
      label: "path-like source translator",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, translator: "C:/private/adapter.mjs" } } }
    },
    {
      label: "path-like source translatorVersion",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, translatorVersion: "C:/private/adapter-version.txt" } } }
    },
    {
      label: "empty source translator",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, translator: "" } } }
    },
    {
      label: "unsafe source adapterKey",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, source: { ...referenceGeometry.asset.source, adapterKey: "bad adapter" } } }
    },
    {
      label: "unsupported asset units",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, units: "cm" } }
    },
    {
      label: "non-finite asset coordinate origin",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          coordinateSystem: {
            ...referenceGeometry.asset.coordinateSystem,
            origin: [Infinity, 0, 0]
          }
        }
      }
    },
    {
      label: "zero asset coordinate axis",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          coordinateSystem: {
            ...referenceGeometry.asset.coordinateSystem,
            axisX: [0, 0, 0]
          }
        }
      }
    },
    {
      label: "unsupported asset coordinate field",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          coordinateSystem: {
            ...referenceGeometry.asset.coordinateSystem,
            handedness: "right"
          }
        }
      }
    },
    {
      label: "degenerate asset coordinate basis",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          coordinateSystem: {
            ...referenceGeometry.asset.coordinateSystem,
            axisY: [1, 0, 0]
          }
        }
      }
    },
    {
      label: "inverted asset bounds",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          bounds: {
            min: [10, 0, 0],
            max: [0, 0, 0]
          }
        }
      }
    },
    {
      label: "unsupported asset bounds field",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          bounds: {
            ...referenceGeometry.asset.bounds,
            units: "mm"
          }
        }
      }
    },
    {
      label: "stale manifest asset bounds",
      data: {
        ...referenceGeometry,
        asset: {
          ...referenceGeometry.asset,
          bounds: {
            ...referenceGeometry.asset.bounds,
            min: [-999, -520, -90]
          }
        }
      }
    },
    {
      label: "asset id mismatch",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, id: "other_reference_asset" } }
    },
    {
      label: "reserved manifest asset id",
      data: { ...referenceGeometry, asset: { ...referenceGeometry.asset, id: "constructor" } }
    },
    {
      label: "missing manifest layers",
      data: { ...referenceGeometry, layers: undefined }
    },
    {
      label: "non-object manifest layers",
      data: { ...referenceGeometry, layers: [] }
    },
    {
      label: "missing manifest objects",
      data: { ...referenceGeometry, objects: undefined }
    },
    {
      label: "non-object manifest objects",
      data: { ...referenceGeometry, objects: [] }
    },
    {
      label: "manifest asset bounds with no object payloads",
      data: {
        ...referenceGeometry,
        objects: {}
      }
    },
    {
      label: "invalid manifest layer metadata",
      data: {
        ...referenceGeometry,
        layers: {
          ...referenceGeometry.layers,
          survey_lines: {
            ...referenceGeometry.layers.survey_lines,
            display: { color: "red" }
          }
        }
      }
    },
    {
      label: "path-like manifest layer name",
      data: {
        ...referenceGeometry,
        layers: {
          ...referenceGeometry.layers,
          survey_lines: {
            ...referenceGeometry.layers.survey_lines,
            name: privateReferenceDisplayName
          }
        }
      }
    },
    {
      label: "invalid manifest object payload",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_grid_lines: {
            ...referenceGeometry.objects.reference_grid_lines,
            lineSegments: []
          }
        }
      }
    },
    {
      label: "path-like manifest object name",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_grid_lines: {
            ...referenceGeometry.objects.reference_grid_lines,
            name: privateReferenceDisplayName
          }
        }
      }
    },
    {
      label: "manifest object with wrong-kind geometry payload",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_grid_lines: {
            ...referenceGeometry.objects.reference_grid_lines,
            faces: [[0, 1, 2]]
          }
        }
      }
    },
    {
      label: "manifest asset bounds with incomplete chunk bounds",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_scan_points_chunked: (({ bounds, ...object }) => object)(referenceGeometry.objects.reference_scan_points_chunked)
        },
        chunks: referenceGeometry.chunks.map((chunk) => chunk.id === "sample_reference_scan_chunk_1"
          ? (({ bounds, ...chunkWithoutBounds }) => chunkWithoutBounds)(chunk)
          : chunk)
      }
    },
    {
      label: "missing manifest chunks",
      data: { ...referenceGeometry, chunks: undefined }
    },
    {
      label: "non-array manifest chunks",
      data: { ...referenceGeometry, chunks: {} }
    },
    {
      label: "non-object manifest chunk entry",
      data: { ...referenceGeometry, chunks: [[]] }
    },
    {
      label: "unsupported manifest chunk field",
      data: { ...referenceGeometry, chunks: [{ ...referenceGeometry.chunks[0], adapterLocalPath: "C:/adapter/chunks" }] }
    },
    {
      label: "unsafe manifest chunk id",
      data: { ...referenceGeometry, chunks: [{ ...referenceGeometry.chunks[0], id: "bad chunk" }] }
    },
    {
      label: "reserved manifest chunk id",
      data: { ...referenceGeometry, chunks: [{ ...referenceGeometry.chunks[0], id: "constructor" }] }
    },
    {
      label: "duplicate manifest chunk id",
      data: { ...referenceGeometry, chunks: [referenceGeometry.chunks[0], { ...referenceGeometry.chunks[0], path: "chunks/duplicate.chunk.json" }] }
    },
    {
      label: "missing manifest chunk owner",
      data: { ...referenceGeometry, chunks: [{ ...referenceGeometry.chunks[0], objectId: "missing_point_cloud" }] }
    },
    {
      label: "manifest chunk owner with mismatched id",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_scan_points_chunked: {
            ...referenceGeometry.objects.reference_scan_points_chunked,
            id: "other_point_cloud"
          }
        }
      }
    },
    {
      label: "manifest chunk owned by non-point-cloud object",
      data: { ...referenceGeometry, chunks: [{ ...referenceGeometry.chunks[0], objectId: "reference_grid_lines" }] }
    },
    {
      label: "manifest chunk not listed by owner",
      data: {
        ...referenceGeometry,
        objects: {
          ...referenceGeometry.objects,
          reference_scan_points_chunked: {
            ...referenceGeometry.objects.reference_scan_points_chunked,
            chunkIds: []
          }
        }
      }
    },
    {
      label: "missing manifest diagnostics",
      data: { ...referenceGeometry, diagnostics: undefined }
    },
    {
      label: "non-array manifest diagnostics",
      data: { ...referenceGeometry, diagnostics: {} }
    },
    {
      label: "non-object manifest diagnostic entry",
      data: { ...referenceGeometry, diagnostics: [[]] }
    },
    {
      label: "unsupported manifest diagnostic severity",
      data: { ...referenceGeometry, diagnostics: [{ severity: "debug", code: "debug-diagnostic", message: "Debug diagnostic" }] }
    },
    {
      label: "empty manifest diagnostic code",
      data: { ...referenceGeometry, diagnostics: [{ severity: "info", code: "", message: "Empty code" }] }
    },
    {
      label: "path-like manifest diagnostic code",
      data: { ...referenceGeometry, diagnostics: [{ severity: "info", code: "C:/private/diagnostic-code", message: "Unsafe code" }] }
    },
    {
      label: "empty manifest diagnostic message",
      data: { ...referenceGeometry, diagnostics: [{ severity: "info", code: "empty-message", message: "" }] }
    },
    {
      label: "path-like manifest diagnostic message",
      data: { ...referenceGeometry, diagnostics: [{ severity: "info", code: "unsafe-message", message: `Adapter log at ${privateReferenceDiagnosticPath}` }] }
    },
    {
      label: "unsafe manifest diagnostic objectId",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "bad-object", message: "Bad object id", objectId: "bad object" }] }
    },
    {
      label: "missing manifest diagnostic objectId",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "missing-object", message: "Missing object id", objectId: "missing_reference_object" }] }
    },
    {
      label: "empty manifest diagnostic objectRefs",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "empty-object-refs", message: "Empty object refs", objectRefs: [] }] }
    },
    {
      label: "duplicate manifest diagnostic objectRefs",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "duplicate-object-refs", message: "Duplicate object refs", objectRefs: ["reference_grid_lines", "reference_grid_lines"] }] }
    },
    {
      label: "unsafe manifest diagnostic objectRefs",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "bad-object-refs", message: "Bad object refs", objectRefs: ["bad object"] }] }
    },
    {
      label: "missing manifest diagnostic objectRefs",
      data: { ...referenceGeometry, diagnostics: [{ severity: "warning", code: "missing-object-refs", message: "Missing object refs", objectRefs: ["missing_reference_object"] }] }
    },
    {
      label: "unsupported manifest diagnostic field",
      data: { ...referenceGeometry, diagnostics: [{ severity: "info", code: "extra-field", message: "Extra field", sourceHandle: "42" }] }
    },
    {
      label: "non-object manifest",
      data: []
    }
  ];
  for (const { label, data } of rejectedManifestCases) {
    if (!referenceManifestLoadError("sample_reference_geometry", data)) {
      console.error(`FAILED: browser reference geometry loader should reject ${label}`);
      return 1;
    }
  }
  const unsafeSourceFileNameManifestError = referenceManifestLoadError("sample_reference_geometry", {
    ...referenceGeometry,
    asset: {
      ...referenceGeometry.asset,
      source: {
        ...referenceGeometry.asset.source,
        fileName: privateReferenceSourceFileName
      }
    }
  });
  if (
    !unsafeSourceFileNameManifestError
    || !/asset\.source\.fileName must be a path-free source basename/.test(unsafeSourceFileNameManifestError)
    || unsafeSourceFileNameManifestError.includes(privateReferenceSourceFileName)
    || unsafeSourceFileNameManifestError.includes("source.dwg")
  ) {
    console.error(`FAILED: browser reference geometry loader should reject path-like source fileName without echoing private values, got ${unsafeSourceFileNameManifestError || "<none>"}`);
    return 1;
  }
  const unsafeDisplayNameManifestError = referenceManifestLoadError("sample_reference_geometry", {
    ...referenceGeometry,
    asset: {
      ...referenceGeometry.asset,
      name: privateReferenceDisplayName
    }
  });
  if (
    !unsafeDisplayNameManifestError
    || !/asset\.name must be a bounded path-free display name/.test(unsafeDisplayNameManifestError)
    || unsafeDisplayNameManifestError.includes(privateReferenceDisplayName)
    || unsafeDisplayNameManifestError.includes("reference.step")
  ) {
    console.error(`FAILED: browser reference geometry loader should reject path-like display names without echoing private values, got ${unsafeDisplayNameManifestError || "<none>"}`);
    return 1;
  }
  const unsafeDiagnosticMessageManifestError = referenceManifestLoadError("sample_reference_geometry", {
    ...referenceGeometry,
    diagnostics: [{
      severity: "warning",
      code: "adapter-warning",
      message: `Adapter warning log at ${privateReferenceDiagnosticPath}`
    }]
  });
  if (
    !unsafeDiagnosticMessageManifestError
    || !/diagnostics\[0\]\.message must be bounded path-free diagnostic text/.test(unsafeDiagnosticMessageManifestError)
    || unsafeDiagnosticMessageManifestError.includes(privateReferenceDiagnosticPath)
    || unsafeDiagnosticMessageManifestError.includes("adapter.log")
  ) {
    console.error(`FAILED: browser reference geometry loader should reject path-like diagnostic messages without echoing private values, got ${unsafeDiagnosticMessageManifestError || "<none>"}`);
    return 1;
  }
  const referencePointCloudChunk = readJson(referenceChunkPath);
  const sampleManifestChunk = referenceGeometry.chunks.find((chunk) => chunk.id === "sample_reference_scan_chunk_1");
  const sampleChunkedPointCloud = referenceGeometry.objects?.reference_scan_points_chunked;
  if (referenceManifestChunkLoadError(sampleChunkedPointCloud, "sample_reference_scan_chunk_1", sampleManifestChunk)) {
    console.error("FAILED: browser reference geometry loader should accept matching manifest point-cloud chunk entries before fetch");
    return 1;
  }
  if (!referenceManifestChunkLoadError(sampleChunkedPointCloud, "bad chunk", { ...sampleManifestChunk, id: "bad chunk" })) {
    console.error("FAILED: browser reference geometry loader should reject unsafe manifest chunk ids");
    return 1;
  }
  const rejectedManifestChunkCases = [
    {
      label: "non-object manifest chunk",
      chunk: []
    },
    {
      label: "unsupported manifest chunk field",
      chunk: { ...sampleManifestChunk, adapterLocalPath: "C:/adapter/chunks" }
    },
    {
      label: "manifest chunk id mismatch",
      chunk: { ...sampleManifestChunk, id: "other_chunk" }
    },
    {
      label: "manifest chunk kind mismatch",
      chunk: { ...sampleManifestChunk, kind: "mesh" }
    },
    {
      label: "manifest chunk object mismatch",
      chunk: { ...sampleManifestChunk, objectId: "other_point_cloud" }
    },
    {
      label: "manifest chunk unsafe object id",
      chunk: { ...sampleManifestChunk, objectId: "bad object" }
    },
    {
      label: "manifest chunk unsafe path",
      chunk: { ...sampleManifestChunk, path: "../projects/sample_boolean_beam.json" }
    },
    {
      label: "manifest chunk non-integer pointCount",
      chunk: { ...sampleManifestChunk, pointCount: 1.5 }
    },
    {
      label: "manifest chunk zero pointCount",
      chunk: { ...sampleManifestChunk, pointCount: 0 }
    },
    {
      label: "manifest chunk non-finite bounds",
      chunk: { ...sampleManifestChunk, bounds: { ...sampleManifestChunk.bounds, max: [Infinity, 0, 0] } }
    },
    {
      label: "manifest chunk inverted bounds",
      chunk: { ...sampleManifestChunk, bounds: { min: [10, 0, 0], max: [0, 0, 0] } }
    },
    {
      label: "manifest chunk unsupported bounds field",
      chunk: { ...sampleManifestChunk, bounds: { ...sampleManifestChunk.bounds, units: "mm" } }
    }
  ];
  for (const { label, chunk } of rejectedManifestChunkCases) {
    if (!referenceManifestChunkLoadError(sampleChunkedPointCloud, "sample_reference_scan_chunk_1", chunk)) {
      console.error(`FAILED: browser reference geometry loader should reject ${label}`);
      return 1;
    }
  }
  if (referenceChunkLoadError(sampleManifestChunk, referencePointCloudChunk)) {
    console.error("FAILED: browser reference geometry loader should accept matching canonical point-cloud chunk sidecars");
    return 1;
  }
  if (referenceChunkLoadError(sampleManifestChunk, { ...referencePointCloudChunk, metadata: { captureId: "scan-01" } })) {
    console.error("FAILED: browser reference geometry loader should accept canonical point-cloud chunk metadata records");
    return 1;
  }
  const privateReferenceMetadataPath = "C:/private/reference/source.dwg";
  const unsafeChunkMetadataError = referenceChunkLoadError(sampleManifestChunk, {
    ...referencePointCloudChunk,
    metadata: {
      rawPayload: privateReferenceMetadataPath
    }
  });
  if (
    !unsafeChunkMetadataError
    || !/chunk\.metadata must be bounded path-free canonical metadata/.test(unsafeChunkMetadataError)
    || unsafeChunkMetadataError.includes(privateReferenceMetadataPath)
    || unsafeChunkMetadataError.includes("source.dwg")
  ) {
    console.error(`FAILED: browser reference geometry loader should reject unsafe chunk metadata without echoing private values, got ${unsafeChunkMetadataError || "<none>"}`);
    return 1;
  }
  if (!referenceChunkLoadError({ ...sampleManifestChunk, id: "bad chunk" }, { ...referencePointCloudChunk, id: "bad chunk" })) {
    console.error("FAILED: browser reference geometry loader should reject unsafe point-cloud chunk sidecar ids");
    return 1;
  }
  const rejectedChunkCases = [
    {
      label: "unsupported chunk field",
      data: { ...referencePointCloudChunk, adapterLocalPath: "C:/adapter/chunks" }
    },
    {
      label: "missing chunk schema ref",
      data: { ...referencePointCloudChunk, $schema: undefined }
    },
    {
      label: "empty chunk schema ref",
      data: { ...referencePointCloudChunk, $schema: "" }
    },
    {
      label: "unsupported chunk schema",
      data: { ...referencePointCloudChunk, schema: "not-a-point-cloud-chunk" }
    },
    {
      label: "unsupported chunk schema version",
      data: { ...referencePointCloudChunk, schemaVersion: "99.0.0" }
    },
    {
      label: "chunk id mismatch",
      data: { ...referencePointCloudChunk, id: "other_chunk" }
    },
    {
      label: "chunk objectId mismatch",
      data: { ...referencePointCloudChunk, objectId: "other_object" }
    },
    {
      label: "chunk unsafe objectId",
      data: { ...referencePointCloudChunk, objectId: "bad object" }
    },
    {
      label: "chunk pointCount mismatch",
      data: { ...referencePointCloudChunk, pointCount: referencePointCloudChunk.pointCount + 1 }
    },
    {
      label: "chunk point payload length mismatch",
      data: { ...referencePointCloudChunk, points: referencePointCloudChunk.points.slice(1) }
    },
    {
      label: "chunk non-finite point payload",
      data: { ...referencePointCloudChunk, points: [[Infinity, 0, 0], ...referencePointCloudChunk.points.slice(1)] }
    },
    {
      label: "chunk missing sidecar bounds",
      data: (({ bounds, ...chunk }) => chunk)(referencePointCloudChunk)
    },
    {
      label: "chunk non-finite sidecar bounds",
      data: { ...referencePointCloudChunk, bounds: { ...referencePointCloudChunk.bounds, max: [Infinity, 0, 0] } }
    },
    {
      label: "chunk inverted sidecar bounds",
      data: { ...referencePointCloudChunk, bounds: { min: [10, 0, 0], max: [0, 0, 0] } }
    },
    {
      label: "chunk sidecar bounds mismatch",
      data: { ...referencePointCloudChunk, bounds: { ...referencePointCloudChunk.bounds, max: [999, 999, 999] } }
    },
    {
      label: "chunk unsupported sidecar bounds field",
      data: { ...referencePointCloudChunk, bounds: { ...referencePointCloudChunk.bounds, units: "mm" } }
    },
    {
      label: "chunk payload bounds mismatch",
      manifestChunk: { ...sampleManifestChunk, bounds: { ...referencePointCloudChunk.bounds, max: [999, 999, 999] } },
      data: { ...referencePointCloudChunk, bounds: { ...referencePointCloudChunk.bounds, max: [999, 999, 999] } }
    },
    {
      label: "chunk pointAttributes length mismatch",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          intensities: [1]
        }
      }
    },
    {
      label: "chunk non-object pointAttributes",
      data: { ...referencePointCloudChunk, pointAttributes: [] }
    },
    {
      label: "chunk unsupported pointAttributes key",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          temperatures: referencePointCloudChunk.points.map(() => 20)
        }
      }
    },
    {
      label: "chunk pointAttributes color out of range",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          colors: referencePointCloudChunk.points.map((_, index) => index === 0 ? [256, 0, 0] : [0, 0, 0])
        }
      }
    },
    {
      label: "chunk pointAttributes non-finite intensity",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          intensities: referencePointCloudChunk.points.map((_, index) => index === 0 ? Infinity : 0)
        }
      }
    },
    {
      label: "chunk pointAttributes negative classification",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          classifications: referencePointCloudChunk.points.map((_, index) => index === 0 ? -1 : 0)
        }
      }
    },
    {
      label: "chunk pointAttributes non-finite normal",
      data: {
        ...referencePointCloudChunk,
        pointAttributes: {
          ...(referencePointCloudChunk.pointAttributes || {}),
          normals: referencePointCloudChunk.points.map((_, index) => index === 0 ? [0, Infinity, 0] : [0, 0, 1])
        }
      }
    },
    {
      label: "non-object chunk metadata",
      data: { ...referencePointCloudChunk, metadata: [] }
    },
    {
      label: "non-object chunk",
      data: []
    }
  ];
  for (const { label, manifestChunk, data } of rejectedChunkCases) {
    if (!referenceChunkLoadError(manifestChunk || sampleManifestChunk, data)) {
      console.error(`FAILED: browser reference geometry loader should reject ${label}`);
      return 1;
    }
  }
  const referenceGeometryWithChunkIndex = {
    ...referenceGeometry,
    chunksById: Object.fromEntries(referenceGeometry.chunks.map((chunk) => [chunk.id, chunk]))
  };
  for (const [objectId, object] of Object.entries(referenceGeometry.objects)) {
    if (referenceObjectLoadError(referenceGeometryWithChunkIndex, objectId, object)) {
      console.error(`FAILED: browser reference geometry loader should accept canonical reference object ${objectId}`);
      return 1;
    }
  }
  if (referenceObjectLoadError(referenceGeometryWithChunkIndex, "reference_grid_lines", {
    ...referenceGeometry.objects.reference_grid_lines,
    metadata: { sourceHandle: "LINE-42" }
  })) {
    console.error("FAILED: browser reference geometry loader should accept canonical object metadata records");
    return 1;
  }
  const unsafeObjectMetadataError = referenceObjectLoadError(referenceGeometryWithChunkIndex, "reference_grid_lines", {
    ...referenceGeometry.objects.reference_grid_lines,
    metadata: {
      sourcePath: privateReferenceMetadataPath
    }
  });
  if (
    !unsafeObjectMetadataError
    || !/object reference_grid_lines\.metadata must be bounded path-free canonical metadata/.test(unsafeObjectMetadataError)
    || unsafeObjectMetadataError.includes(privateReferenceMetadataPath)
    || unsafeObjectMetadataError.includes("source.dwg")
  ) {
    console.error(`FAILED: browser reference geometry loader should reject unsafe object metadata without echoing private values, got ${unsafeObjectMetadataError || "<none>"}`);
    return 1;
  }
  const unsafeManifestMetadataError = referenceManifestLoadError("sample_reference_geometry", {
    ...referenceGeometry,
    objects: {
      ...referenceGeometry.objects,
      reference_grid_lines: {
        ...referenceGeometry.objects.reference_grid_lines,
        metadata: {
          sourcePath: privateReferenceMetadataPath
        }
      }
    }
  });
  if (
    !unsafeManifestMetadataError
    || !/object reference_grid_lines\.metadata must be bounded path-free canonical metadata/.test(unsafeManifestMetadataError)
    || unsafeManifestMetadataError.includes(privateReferenceMetadataPath)
    || unsafeManifestMetadataError.includes("source.dwg")
  ) {
    console.error(`FAILED: browser reference geometry manifest loader should reject unsafe object metadata without echoing private values, got ${unsafeManifestMetadataError || "<none>"}`);
    return 1;
  }
  const runtimeReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    asset: {
      ...referenceGeometry.asset,
      source: {
        ...referenceGeometry.asset.source,
        format: "step",
        requestedFormat: "p21"
      }
    }
  });
  const runtimeE57PointCloudReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    asset: {
      ...referenceGeometry.asset,
      id: "e57_point_cloud_reference",
      name: "E57 Point Cloud Reference",
      source: {
        ...referenceGeometry.asset.source,
        format: "e57pointcloud"
      }
    }
  });
  if (Object.keys(runtimeReferenceGeometry.layers || {}).length !== Object.keys(referenceGeometry.layers || {}).length) {
    console.error("FAILED: browser reference geometry loader should accept canonical reference layer display metadata");
    return 1;
  }
  if (Object.keys(runtimeE57PointCloudReferenceGeometry.objects || {}).length !== Object.keys(referenceGeometry.objects || {}).length) {
    console.error("FAILED: browser reference geometry loader should accept E57 point-cloud source provenance aliases without changing canonical objects");
    return 1;
  }
  const runtimeReferenceFileSources = projectReferenceGeometryRuntimeFileSources({
    referenceGeometry: {
      assets: {
        sample_reference_geometry: project.referenceGeometry.assets.sample_reference_geometry,
        e57_point_cloud_reference: { path: "../references/e57-point-cloud.reference.json" },
        invalid_loaded_source_reference: { path: "../references/invalid-loaded-source.reference.json" },
        missing_reference: { path: "../references/missing.reference.json" }
      }
    }
  }, {
    loadedAssets: [
      {
        id: "sample_reference_geometry",
        data: {
          ...runtimeReferenceGeometry,
          objects: {
            ...(runtimeReferenceGeometry.objects || {}),
            "bad object": {
              id: "bad object",
              kind: "mesh"
            }
          },
          chunks: [
            ...(runtimeReferenceGeometry.chunks || []),
            { id: "bad chunk" },
            { id: "sample_reference_scan_chunk_1" }
          ]
        },
        loadedChunks: {
          sample_reference_scan_chunk_1: {
            id: "sample_reference_scan_chunk_1"
          },
          sample_reference_scan_chunk_rogue: {
            id: "sample_reference_scan_chunk_rogue"
          },
          stale_scan_chunk: {
            id: "other_scan_chunk"
          },
          unsafe_scan_chunk: {
            id: "../private_chunk"
          }
        }
      },
      {
        id: "sample_reference_geometry",
        data: {
          ...runtimeReferenceGeometry,
          asset: {
            ...runtimeReferenceGeometry.asset,
            id: "spoofed_reference_geometry",
            name: "Spoofed Reference Geometry",
            source: {
              format: "dwg"
            }
          }
        },
        loadedChunks: {}
      },
      {
        id: "e57_point_cloud_reference",
        data: runtimeE57PointCloudReferenceGeometry,
        loadedChunks: {}
      },
      {
        id: "invalid_loaded_source_reference",
        data: {
          ...runtimeReferenceGeometry,
          asset: {
            ...runtimeReferenceGeometry.asset,
            id: "invalid_loaded_source_reference",
            name: "C:/private/reference.step",
            source: {
              format: "C:/private/reference.step",
              requestedFormat: "../private"
            }
          }
        },
        loadedChunks: {}
      }
    ],
    diagnostics: [
      {
        assetId: "sample_reference_geometry",
        severity: "warning",
        code: "reference-object-rejected",
        message: "Filtered one reference object"
      },
      {
        assetId: "sample_reference_geometry",
        severity: "warning",
        code: "C:/private/reference-object-rejected",
        message: "Reference diagnostic leaked C:/private/stage and ../private/chunks"
      },
      {
        assetId: "../private_reference",
        severity: "warning",
        code: "private-reference-leak",
        message: "Invalid diagnostic asset id"
      },
      {
        assetId: "missing_reference",
        severity: "error",
        code: "reference-manifest-load-failed",
        message: "Missing reference manifest"
      }
    ]
  });
  const runtimeReferenceFileSourceMap = Object.fromEntries(runtimeReferenceFileSources.map((source) => [source.id, source]));
  const runtimeSampleReferenceSource = runtimeReferenceFileSourceMap["reference-sample_reference_geometry"];
  const runtimeE57PointCloudReferenceSource = runtimeReferenceFileSourceMap["reference-e57_point_cloud_reference"];
  const runtimeInvalidLoadedSourceReference = runtimeReferenceFileSourceMap["reference-invalid_loaded_source_reference"];
  const runtimeMissingReferenceSource = runtimeReferenceFileSourceMap["reference-missing_reference"];
  const runtimeSampleReferenceObjectCount = Object.keys(referenceGeometry.objects || {}).length;
  const runtimeSampleReferenceDescriptor = dataSourceDescriptor(runtimeSampleReferenceSource);
  const runtimeE57PointCloudReferenceDescriptor = dataSourceDescriptor(runtimeE57PointCloudReferenceSource);
  const runtimeMissingReferenceDescriptor = dataSourceDescriptor(runtimeMissingReferenceSource);
  const structuredIfcSourceDescriptor = dataSourceDescriptor({
    id: "structured-ifc-reference-source",
    label: "Structured IFC Reference Source",
    kind: "Reference",
    sourceFormat: "ifc",
    sourceRequestedFormat: "ifczip",
    sourceRequestedFormatFamily: "ifc",
    sourceRequestedFormatAliases: ["ifc", "ifczip"]
  });
  const structuredE57SourceDescriptor = dataSourceDescriptor({
    id: "structured-e57-reference-source",
    label: "Structured E57 Reference Source",
    kind: "Reference",
    sourceFormat: "e57",
    sourceRequestedFormat: "e57pointcloud",
    sourceRequestedFormatFamily: "e57",
    sourceRequestedFormatAliases: ["e57", "C:/private/e57", "../e57", "e57pointcloud", "scan.e57", "e57pc"]
  });
  const unsafeSourceMetadataDescriptor = dataSourceDescriptor({
    id: "unsafe-source-metadata",
    label: "Unsafe Source Metadata",
    kind: "Reference",
    sourceFormat: "C:/private/source.ifc",
    sourceRequestedFormat: "../ifczip",
    sourceRequestedFormatFamily: "file://ifc",
    sourceRequestedFormatAliases: ["ifc", "C:/private/ifc", "../ifc", "scan.ifc"]
  });
  const mismatchedSourceMetadataDescriptor = dataSourceDescriptor({
    id: "mismatched-source-metadata",
    label: "Mismatched Source Metadata",
    kind: "Reference",
    sourceFormat: "ifc",
    sourceRequestedFormat: "e57pointcloud",
    sourceRequestedFormatFamily: "e57",
    sourceRequestedFormatAliases: ["ifc", "ifczip", "e57", "e57pointcloud"]
  });
  const mismatchedWorkspaceResponse = referenceGeometryImportWorkspaceResponse({
    stageId: "plan-only",
    exitCode: 0,
    request: { requestId: "reference-import-mismatched-source-metadata", stageId: "plan-only" },
    resultJson: {
      ok: true,
      referenceImportExecutionMode: "plan-only",
      referenceImportWorkflowStatus: { workflowStage: "plan-only" },
      referenceImportPlanDecision: {
        assetId: "mismatched_source_metadata",
        sourceFormat: "ifc",
        sourceRequestedFormat: "e57pointcloud",
        sourceRequestedFormatFamily: "e57",
        sourceRequestedFormatAliases: ["ifc", "ifczip", "e57", "e57pointcloud"],
        sourceRequestedFormatMatchesFamily: true,
        translationMode: "external-adapter",
        projectPointerReady: false,
        safeNextExecutionMode: "adapter-request",
        availableNextExecutionModes: ["adapter-request"],
        safeNextAction: "run-adapter-request",
        recommendedNextAction: "run-adapter-request"
      }
    }
  });
  const mismatchedWorkspaceEnvelope = referenceGeometryImportWorkspaceResponseEnvelope({
    stageId: "plan-only",
    responseStatus: "succeeded",
    ok: true,
    resultOk: true,
    resultJsonAccepted: true,
    requestId: "reference-import-mismatched-source-envelope",
    stageDecision: {
      sourceFormat: "ifc",
      sourceRequestedFormat: "e57pointcloud",
      sourceRequestedFormatFamily: "e57",
      sourceRequestedFormatAliases: ["ifc", "ifczip", "e57", "e57pointcloud"],
      sourceRequestedFormatMatchesFamily: true,
      translationMode: "external-adapter",
      projectPointerReady: false,
      safeNextExecutionMode: "adapter-request",
      availableNextExecutionModes: ["adapter-request"],
      safeNextAction: "run-adapter-request",
      recommendedNextAction: "run-adapter-request"
    },
    referencePlanSummary: {
      sourceFormat: "ifc",
      sourceRequestedFormat: "e57pointcloud",
      sourceRequestedFormatFamily: "e57",
      sourceRequestedFormatAliases: ["ifc", "ifczip", "e57", "e57pointcloud"],
      sourceRequestedFormatMatchesFamily: true,
      translationMode: "external-adapter",
      projectPointerReady: false,
      safeNextExecutionMode: "adapter-request",
      availableNextExecutionModes: ["adapter-request"],
      safeNextAction: "run-adapter-request",
      recommendedNextAction: "run-adapter-request"
    }
  });
  const mismatchedEnvelopeSession = referenceGeometryImportSessionState({
    path: "../references/mismatched-source.ifc",
    formatToken: "ifc",
    lastWorkspaceResponse: mismatchedWorkspaceEnvelope
  });
  if (
    runtimeSampleReferenceSource?.status !== "loaded-with-warnings"
    || !runtimeSampleReferenceSource?.meta?.includes("loaded")
    || !runtimeSampleReferenceSource?.meta?.includes("source step")
    || !runtimeSampleReferenceSource?.meta?.includes("requested p21")
    || !runtimeSampleReferenceSource?.meta?.includes("family step")
    || runtimeSampleReferenceSource?.label === "Spoofed Reference Geometry"
    || runtimeSampleReferenceSource?.sourceFormat !== "step"
    || runtimeSampleReferenceSource?.sourceRequestedFormat !== "p21"
    || runtimeSampleReferenceSource?.sourceRequestedFormatFamily !== "step"
    || !Array.isArray(runtimeSampleReferenceSource?.sourceRequestedFormatAliases)
    || !runtimeSampleReferenceSource.sourceRequestedFormatAliases.includes("p21")
    || runtimeSampleReferenceSource?.sourceRequestedFormatMatchesFamily !== true
    || !runtimeSampleReferenceSource?.meta?.includes(`${runtimeSampleReferenceObjectCount} objects`)
    || runtimeSampleReferenceSource?.meta?.includes(`${runtimeSampleReferenceObjectCount + 1} objects`)
    || runtimeInvalidLoadedSourceReference?.status !== "not-loaded"
    || runtimeInvalidLoadedSourceReference?.label !== "invalid_loaded_source_reference"
    || runtimeInvalidLoadedSourceReference?.sourceFormat !== ""
    || runtimeInvalidLoadedSourceReference?.meta?.includes("C:/private")
    || runtimeInvalidLoadedSourceReference?.meta?.includes("../private")
    || runtimeE57PointCloudReferenceSource?.status !== "loaded"
    || !runtimeE57PointCloudReferenceSource?.meta?.includes("source e57pointcloud")
    || runtimeE57PointCloudReferenceSource?.meta?.includes("requested e57pointcloud")
    || !runtimeE57PointCloudReferenceSource?.meta?.includes("family e57")
    || runtimeE57PointCloudReferenceSource?.sourceFormat !== "e57pointcloud"
    || runtimeE57PointCloudReferenceSource?.sourceRequestedFormat !== ""
    || runtimeE57PointCloudReferenceSource?.sourceRequestedFormatFamily !== "e57"
    || !Array.isArray(runtimeE57PointCloudReferenceSource?.sourceRequestedFormatAliases)
    || !runtimeE57PointCloudReferenceSource.sourceRequestedFormatAliases.includes("e57pc")
    || runtimeE57PointCloudReferenceSource?.sourceRequestedFormatMatchesFamily !== null
    || !runtimeSampleReferenceSource?.meta?.includes("1/1 preview chunks loaded")
    || runtimeSampleReferenceSource?.declaredChunkCount !== 1
    || runtimeSampleReferenceSource?.loadedPreviewChunkCount !== 1
    || !runtimeSampleReferenceSource?.meta?.includes("warnings")
    || !runtimeSampleReferenceSource?.meta?.includes("diagnostics reference-object-rejected")
    || runtimeSampleReferenceSource?.meta?.includes("C:/private")
    || runtimeSampleReferenceSource?.meta?.includes("../private")
    || runtimeSampleReferenceDescriptor?.searchText?.includes("C:/private")
    || runtimeSampleReferenceDescriptor?.searchText?.includes("../private")
    || runtimeSampleReferenceDescriptor?.searchText?.includes("private-reference-leak")
    || runtimeMissingReferenceSource?.status !== "not-loaded"
    || !runtimeMissingReferenceSource?.meta?.includes("not loaded")
    || !runtimeMissingReferenceSource?.meta?.includes("diagnostics reference-manifest-load-failed")
    || !runtimeSampleReferenceDescriptor?.statusMeta?.includes("loaded-with-warnings")
    || !runtimeSampleReferenceDescriptor?.description?.includes("loaded-with-warnings")
    || !runtimeSampleReferenceDescriptor?.description?.includes("requested p21")
    || !runtimeSampleReferenceDescriptor?.description?.includes("family step")
    || !runtimeSampleReferenceDescriptor?.keywords?.includes("requested p21")
    || !runtimeSampleReferenceDescriptor?.keywords?.includes("family step")
    || !runtimeSampleReferenceDescriptor?.description?.includes("1/1 preview chunks loaded")
    || !runtimeSampleReferenceDescriptor?.description?.includes("diagnostics reference-object-rejected")
    || runtimeE57PointCloudReferenceDescriptor?.description?.includes("requested e57pointcloud")
    || !runtimeE57PointCloudReferenceDescriptor?.description?.includes("family e57")
    || !runtimeE57PointCloudReferenceDescriptor?.keywords?.includes("source e57pointcloud")
    || runtimeE57PointCloudReferenceDescriptor?.keywords?.includes("requested e57pointcloud")
    || !runtimeE57PointCloudReferenceDescriptor?.keywords?.includes("family e57")
    || !runtimeE57PointCloudReferenceDescriptor?.keywords?.includes("e57pc")
    || !structuredIfcSourceDescriptor?.keywords?.includes("source ifc")
    || !structuredIfcSourceDescriptor?.keywords?.includes("requested ifczip")
    || !structuredIfcSourceDescriptor?.keywords?.includes("family ifc")
    || !structuredIfcSourceDescriptor?.searchText?.includes("requested ifczip")
    || !structuredE57SourceDescriptor?.keywords?.includes("source e57")
    || !structuredE57SourceDescriptor?.keywords?.includes("requested e57pointcloud")
    || !structuredE57SourceDescriptor?.keywords?.includes("family e57")
    || !structuredE57SourceDescriptor?.keywords?.includes("e57pc")
    || structuredE57SourceDescriptor?.searchText?.includes("C:/private")
    || structuredE57SourceDescriptor?.searchText?.includes("../e57")
    || structuredE57SourceDescriptor?.searchText?.includes("scan.e57")
    || !structuredE57SourceDescriptor?.searchText?.includes("requested e57pointcloud")
    || unsafeSourceMetadataDescriptor?.keywords?.includes("ifc")
    || unsafeSourceMetadataDescriptor?.searchText?.includes("C:/private")
    || unsafeSourceMetadataDescriptor?.searchText?.includes("../ifc")
    || unsafeSourceMetadataDescriptor?.searchText?.includes("file://ifc")
    || unsafeSourceMetadataDescriptor?.searchText?.includes("scan.ifc")
    || !mismatchedSourceMetadataDescriptor?.keywords?.includes("source ifc")
    || !mismatchedSourceMetadataDescriptor?.keywords?.includes("family ifc")
    || mismatchedSourceMetadataDescriptor?.keywords?.includes("requested e57pointcloud")
    || mismatchedSourceMetadataDescriptor?.keywords?.includes("family e57")
    || mismatchedSourceMetadataDescriptor?.keywords?.includes("e57pointcloud")
    || mismatchedWorkspaceResponse?.stageDecision?.sourceFormat !== "ifc"
    || mismatchedWorkspaceResponse?.stageDecision?.sourceRequestedFormat !== ""
    || mismatchedWorkspaceResponse?.stageDecision?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedWorkspaceResponse?.stageDecision?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || mismatchedWorkspaceResponse?.stageDecision?.sourceRequestedFormatMatchesFamily !== false
    || mismatchedWorkspaceResponse?.referencePlanSummary?.sourceFormat !== "ifc"
    || mismatchedWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormat !== ""
    || mismatchedWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || mismatchedWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormatMatchesFamily !== false
    || mismatchedWorkspaceEnvelope?.stageDecision?.sourceFormat !== "ifc"
    || mismatchedWorkspaceEnvelope?.stageDecision?.sourceRequestedFormat !== ""
    || mismatchedWorkspaceEnvelope?.stageDecision?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedWorkspaceEnvelope?.stageDecision?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || mismatchedWorkspaceEnvelope?.stageDecision?.sourceRequestedFormatMatchesFamily !== false
    || mismatchedWorkspaceEnvelope?.referencePlanSummary?.sourceFormat !== "ifc"
    || mismatchedWorkspaceEnvelope?.referencePlanSummary?.sourceRequestedFormat !== ""
    || mismatchedWorkspaceEnvelope?.referencePlanSummary?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedWorkspaceEnvelope?.referencePlanSummary?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || mismatchedWorkspaceEnvelope?.referencePlanSummary?.sourceRequestedFormatMatchesFamily !== false
    || mismatchedEnvelopeSession?.lastWorkspaceResponse?.stageDecision?.sourceRequestedFormat !== ""
    || mismatchedEnvelopeSession?.lastWorkspaceResponse?.stageDecision?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedEnvelopeSession?.lastWorkspaceResponse?.stageDecision?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || mismatchedEnvelopeSession?.lastWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormat !== ""
    || mismatchedEnvelopeSession?.lastWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormatFamily !== "ifc"
    || JSON.stringify(mismatchedEnvelopeSession?.lastWorkspaceResponse?.referencePlanSummary?.sourceRequestedFormatAliases) !== JSON.stringify(["ifc", "ifczip"])
    || !runtimeMissingReferenceDescriptor?.statusMeta?.includes("not-loaded")
    || !runtimeMissingReferenceDescriptor?.description?.includes("not-loaded")
    || !runtimeMissingReferenceDescriptor?.description?.includes("diagnostics reference-manifest-load-failed")
    || Object.hasOwn(runtimeSampleReferenceSource || {}, "data")
    || Object.hasOwn(runtimeSampleReferenceSource || {}, "objects")
    || Object.hasOwn(runtimeSampleReferenceSource || {}, "loadedChunks")
    || Object.hasOwn(runtimeE57PointCloudReferenceSource || {}, "data")
    || Object.hasOwn(runtimeE57PointCloudReferenceSource || {}, "objects")
    || Object.hasOwn(runtimeE57PointCloudReferenceSource || {}, "loadedChunks")
  ) {
    console.error("FAILED: Project Files runtime reference rows should expose structured source requested-format family metadata, preview chunk counts, and diagnostics without geometry payloads");
    return 1;
  }
  const rejectedObjectCases = [
    {
      label: "non-object reference object",
      id: "bad_object",
      object: []
    },
    {
      label: "unsafe object key",
      id: "bad object",
      object: { ...referenceGeometry.objects.reference_grid_lines, id: "bad object" }
    },
    {
      label: "reserved object id",
      id: "constructor",
      object: { ...referenceGeometry.objects.reference_grid_lines, id: "constructor" }
    },
    {
      label: "object id mismatch",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, id: "other_grid_lines" }
    },
    {
      label: "unsupported object field",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, adapterLocalPath: "C:/adapter/object-cache" }
    },
    {
      label: "unsupported object bounds field",
      id: "reference_grid_lines",
      object: {
        ...referenceGeometry.objects.reference_grid_lines,
        bounds: {
          ...referenceGeometry.objects.reference_grid_lines.bounds,
          units: "mm"
        }
      }
    },
    {
      label: "empty object name",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, name: "" }
    },
    {
      label: "non-object object metadata",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, metadata: [] }
    },
    {
      label: "unsafe object layer id",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, layer: "bad layer" }
    },
    {
      label: "missing object layer",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, layer: "missing_layer" }
    },
    {
      label: "unsupported object kind",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, kind: "brep" }
    },
    {
      label: "invalid object display color",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, display: { color: "red" } }
    },
    {
      label: "unsupported object display key",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, display: { lineWidth: 2 } }
    },
    {
      label: "line-set invalid segment index",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, lineSegments: [[0, 999]] }
    },
    {
      label: "line-set degenerate segment",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, lineSegments: [[0, 0]] }
    },
    {
      label: "line-set mesh payload field",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, faces: [[0, 1, 2]] }
    },
    {
      label: "line-set point-cloud payload field",
      id: "reference_grid_lines",
      object: { ...referenceGeometry.objects.reference_grid_lines, points: [[0, 0, 0]] }
    },
    {
      label: "mesh invalid face index",
      id: "reference_equipment_box",
      object: { ...referenceGeometry.objects.reference_equipment_box, faces: [[0, 1, 999]] }
    },
    {
      label: "mesh degenerate face",
      id: "reference_equipment_box",
      object: { ...referenceGeometry.objects.reference_equipment_box, faces: [[0, 0, 1]] }
    },
    {
      label: "mesh line-set payload field",
      id: "reference_equipment_box",
      object: { ...referenceGeometry.objects.reference_equipment_box, lineSegments: [[0, 1]] }
    },
    {
      label: "mesh point-cloud payload field",
      id: "reference_equipment_box",
      object: { ...referenceGeometry.objects.reference_equipment_box, chunkIds: ["sample_reference_scan_chunk_1"] }
    },
    {
      label: "inline point-cloud non-finite point",
      id: "reference_scan_points",
      object: { ...referenceGeometry.objects.reference_scan_points, points: [[Infinity, 0, 0]] }
    },
    {
      label: "inline point-cloud attribute length mismatch",
      id: "reference_scan_points",
      object: {
        ...referenceGeometry.objects.reference_scan_points,
        pointAttributes: {
          ...(referenceGeometry.objects.reference_scan_points.pointAttributes || {}),
          intensities: [1]
        }
      }
    },
    {
      label: "inline point-cloud invalid color attribute",
      id: "reference_scan_points",
      object: {
        ...referenceGeometry.objects.reference_scan_points,
        pointAttributes: {
          ...(referenceGeometry.objects.reference_scan_points.pointAttributes || {}),
          colors: referenceGeometry.objects.reference_scan_points.points.map((_, index) => index === 0 ? [0, -1, 0] : [0, 0, 0])
        }
      }
    },
    {
      label: "point-cloud line-set payload field",
      id: "reference_scan_points",
      object: { ...referenceGeometry.objects.reference_scan_points, vertices: [[0, 0, 0], [1, 0, 0]] }
    },
    {
      label: "point-cloud mesh payload field",
      id: "reference_scan_points",
      object: { ...referenceGeometry.objects.reference_scan_points, faces: [[0, 1, 2]] }
    },
    {
      label: "point-cloud mixed storage",
      id: "reference_scan_points",
      object: { ...referenceGeometry.objects.reference_scan_points, chunkIds: ["sample_reference_scan_chunk_1"] }
    },
    {
      label: "chunked point-cloud repeated chunk",
      id: "reference_scan_points_chunked",
      object: { ...referenceGeometry.objects.reference_scan_points_chunked, chunkIds: ["sample_reference_scan_chunk_1", "sample_reference_scan_chunk_1"] }
    },
    {
      label: "chunked point-cloud missing chunk",
      id: "reference_scan_points_chunked",
      object: { ...referenceGeometry.objects.reference_scan_points_chunked, chunkIds: ["missing_chunk"] }
    },
    {
      label: "chunked point-cloud manifest chunk kind mismatch",
      id: "reference_scan_points_chunked",
      assetData: {
        ...referenceGeometryWithChunkIndex,
        chunksById: {
          ...referenceGeometryWithChunkIndex.chunksById,
          sample_reference_scan_chunk_1: { ...sampleManifestChunk, kind: "mesh" }
        }
      },
      object: referenceGeometry.objects.reference_scan_points_chunked
    },
    {
      label: "chunked point-cloud manifest chunk unsafe path",
      id: "reference_scan_points_chunked",
      assetData: {
        ...referenceGeometryWithChunkIndex,
        chunksById: {
          ...referenceGeometryWithChunkIndex.chunksById,
          sample_reference_scan_chunk_1: { ...sampleManifestChunk, path: "../projects/sample_boolean_beam.json" }
        }
      },
      object: referenceGeometry.objects.reference_scan_points_chunked
    },
    {
      label: "chunked point-cloud manifest chunk zero pointCount",
      id: "reference_scan_points_chunked",
      assetData: {
        ...referenceGeometryWithChunkIndex,
        chunksById: {
          ...referenceGeometryWithChunkIndex.chunksById,
          sample_reference_scan_chunk_1: { ...sampleManifestChunk, pointCount: 0 }
        }
      },
      object: referenceGeometry.objects.reference_scan_points_chunked
    },
    {
      label: "chunked point-cloud manifest chunk invalid bounds",
      id: "reference_scan_points_chunked",
      assetData: {
        ...referenceGeometryWithChunkIndex,
        chunksById: {
          ...referenceGeometryWithChunkIndex.chunksById,
          sample_reference_scan_chunk_1: { ...sampleManifestChunk, bounds: { min: [10, 0, 0], max: [0, 0, 0] } }
        }
      },
      object: referenceGeometry.objects.reference_scan_points_chunked
    },
    {
      label: "chunked point-cloud manifest chunk missing bounds with object bounds",
      id: "reference_scan_points_chunked",
      assetData: {
        ...referenceGeometryWithChunkIndex,
        chunksById: {
          ...referenceGeometryWithChunkIndex.chunksById,
          sample_reference_scan_chunk_1: (({ bounds, ...chunk }) => chunk)(sampleManifestChunk)
        }
      },
      object: referenceGeometry.objects.reference_scan_points_chunked
    },
    {
      label: "chunked point-cloud unsafe chunk id",
      id: "reference_scan_points_chunked",
      object: { ...referenceGeometry.objects.reference_scan_points_chunked, chunkIds: ["bad chunk"] }
    },
    {
      label: "chunked point-cloud object-level attributes",
      id: "reference_scan_points_chunked",
      object: { ...referenceGeometry.objects.reference_scan_points_chunked, pointAttributes: { intensities: [1] } }
    }
  ];
  for (const { label, id, object, assetData } of rejectedObjectCases) {
    if (!referenceObjectLoadError(assetData || referenceGeometryWithChunkIndex, id, object)) {
      console.error(`FAILED: browser reference geometry loader should reject ${label}`);
      return 1;
    }
  }
  const invalidLayerReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    layers: {
      ...referenceGeometry.layers,
      invalid_display_layer: {
        id: "invalid_display_layer",
        name: "Invalid Display Layer",
        display: {
          color: "blue"
        }
      },
      empty_name_layer: {
        id: "empty_name_layer",
        name: ""
      },
      unsupported_field_layer: {
        id: "unsupported_field_layer",
        name: "Unsupported Field Layer",
        adapterLocalPath: "C:/adapter/layers"
      }
    },
    objects: {
      ...referenceGeometry.objects,
      invalid_display_layer_line: {
        id: "invalid_display_layer_line",
        kind: "line-set",
        layer: "invalid_display_layer",
        vertices: [[0, 0, 0], [1, 0, 0]],
        lineSegments: [[0, 1]]
      },
      empty_name_layer_line: {
        id: "empty_name_layer_line",
        kind: "line-set",
        layer: "empty_name_layer",
        vertices: [[0, 0, 0], [0, 1, 0]],
        lineSegments: [[0, 1]]
      },
      unsupported_field_layer_line: {
        id: "unsupported_field_layer_line",
        kind: "line-set",
        layer: "unsupported_field_layer",
        vertices: [[0, 0, 0], [0, 0, 1]],
        lineSegments: [[0, 1]]
      }
    }
  });
  if (invalidLayerReferenceGeometry.layers.invalid_display_layer
    || invalidLayerReferenceGeometry.layers.empty_name_layer
    || invalidLayerReferenceGeometry.layers.unsupported_field_layer
    || invalidLayerReferenceGeometry.objects.invalid_display_layer_line
    || invalidLayerReferenceGeometry.objects.empty_name_layer_line
    || invalidLayerReferenceGeometry.objects.unsupported_field_layer_line) {
    console.error("FAILED: browser reference geometry loader should filter invalid canonical layer metadata before rendering");
    return 1;
  }
  const invalidLayerIdReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    layers: {
      ...referenceGeometry.layers,
      "bad layer": {
        id: "bad layer",
        name: "Unsafe Layer"
      },
      constructor: {
        id: "constructor",
        name: "Reserved Layer"
      }
    },
    objects: {
      ...referenceGeometry.objects,
      unsafe_layer_line: {
        id: "unsafe_layer_line",
        kind: "line-set",
        layer: "bad layer",
        vertices: [[0, 0, 0], [1, 0, 0]],
        lineSegments: [[0, 1]]
      },
      reserved_layer_line: {
        id: "reserved_layer_line",
        kind: "line-set",
        layer: "constructor",
        vertices: [[0, 0, 0], [0, 1, 0]],
        lineSegments: [[0, 1]]
      }
    }
  });
  if (Object.hasOwn(invalidLayerIdReferenceGeometry.layers, "bad layer")
    || Object.hasOwn(invalidLayerIdReferenceGeometry.layers, "constructor")
    || Object.hasOwn(invalidLayerIdReferenceGeometry.objects, "unsafe_layer_line")
    || Object.hasOwn(invalidLayerIdReferenceGeometry.objects, "reserved_layer_line")) {
    console.error("FAILED: browser reference geometry loader should filter unsafe canonical layer ids before rendering");
    return 1;
  }
  const filteredReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    objects: {
      ...referenceGeometry.objects,
      invalid_runtime_line: {
        id: "invalid_runtime_line",
        kind: "line-set",
        layer: "survey_lines",
        vertices: [[0, 0, 0]],
        lineSegments: []
      }
    }
  });
  if (filteredReferenceGeometry.objects.invalid_runtime_line || !filteredReferenceGeometry.objects.reference_grid_lines) {
    console.error("FAILED: browser reference geometry loader should filter invalid runtime objects while preserving valid objects");
    return 1;
  }
  const diagnosticRejections = [];
  const diagnosticFilteredReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    diagnostics: [
      [],
      { severity: "debug", code: "debug-diagnostic", message: "Debug diagnostic" },
      { severity: "warning", code: "extra-field", message: "Extra field", sourceHandle: "42" },
      { severity: "warning", code: "bad-object", message: "Bad object id", objectId: "bad object" },
      { severity: "warning", code: "bad-object-refs", message: "Bad object refs", objectRefs: ["bad object"] },
      { severity: "warning", code: "filtered-object", message: "Filtered object", objectId: "invalid_runtime_line" },
      { severity: "warning", code: "filtered-object-refs", message: "Filtered object refs", objectRefs: ["reference_grid_lines", "invalid_runtime_line"] },
      { severity: "info", code: "accepted-object", message: "Accepted object", objectId: "reference_grid_lines" },
      { severity: "info", code: "accepted-object-refs", message: "Accepted object refs", objectRefs: ["reference_grid_lines", "reference_equipment_box"] },
      { severity: "info", code: "global-diagnostic", message: "Global diagnostic" }
    ],
    objects: {
      ...referenceGeometry.objects,
      invalid_runtime_line: {
        id: "invalid_runtime_line",
        kind: "line-set",
        layer: "survey_lines",
        vertices: [[0, 0, 0]],
        lineSegments: []
      }
    }
  }, (id, error) => diagnosticRejections.push({ id, error }));
  if (diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => diagnostic.objectId === "invalid_runtime_line")
    || diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => diagnostic.objectRefs?.includes("invalid_runtime_line"))
    || diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => ["debug-diagnostic", "extra-field", "bad-object", "bad-object-refs", "filtered-object", "filtered-object-refs"].includes(diagnostic.code))
    || !diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => diagnostic.objectId === "reference_grid_lines")
    || !diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => diagnostic.code === "accepted-object-refs" && diagnostic.objectRefs?.length === 2)
    || !diagnosticFilteredReferenceGeometry.diagnostics.some((diagnostic) => diagnostic.code === "global-diagnostic")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:0")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:1")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:2")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:3")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:4")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:5")
    || !diagnosticRejections.some((rejection) => rejection.id === "diagnostic:6")) {
    console.error("FAILED: browser reference geometry loader should drop malformed diagnostics and diagnostics tied to filtered runtime objects only");
    return 1;
  }
  const chunkFilteredReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    objects: {
      ...referenceGeometry.objects,
      reference_scan_points_chunked: {
        ...referenceGeometry.objects.reference_scan_points_chunked,
        points: [[0, 0, 0]]
      }
    }
  });
  if (chunkFilteredReferenceGeometry.objects.reference_scan_points_chunked
    || chunkFilteredReferenceGeometry.chunks.some((chunk) => chunk.id === "sample_reference_scan_chunk_1")) {
    console.error("FAILED: browser reference geometry loader should drop chunks owned only by filtered runtime objects");
    return 1;
  }
  const duplicateChunkRuntimeReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    chunks: [
      sampleManifestChunk,
      {
        ...sampleManifestChunk,
        path: "chunks/duplicate_sample_reference_scan_points.chunk.json"
      }
    ]
  });
  if (duplicateChunkRuntimeReferenceGeometry.objects.reference_scan_points_chunked
    || duplicateChunkRuntimeReferenceGeometry.chunks.some((chunk) => chunk.id === "sample_reference_scan_chunk_1")) {
    console.error("FAILED: browser reference geometry runtime data should reject point-cloud objects that reference duplicate manifest chunk ids");
    return 1;
  }
  const inheritedChunkRuntimeReferenceGeometry = runtimeReferenceGeometryData({
    ...referenceGeometry,
    chunks: [
      {
        ...sampleManifestChunk,
        id: "__proto__",
        inherited_chunk: {
          ...sampleManifestChunk,
          id: "inherited_chunk"
        }
      }
    ],
    objects: {
      ...referenceGeometry.objects,
      reference_scan_points_chunked: {
        ...referenceGeometry.objects.reference_scan_points_chunked,
        chunkIds: ["inherited_chunk"]
      }
    }
  });
  if (inheritedChunkRuntimeReferenceGeometry.objects.reference_scan_points_chunked
    || inheritedChunkRuntimeReferenceGeometry.chunks.some((chunk) => chunk.id === "inherited_chunk")) {
    console.error("FAILED: browser reference geometry runtime chunk index should ignore unsafe chunk ids instead of exposing inherited pseudo-chunks");
    return 1;
  }
  const assetBoundsReferenceGeometry = {
    ...referenceGeometry,
    asset: {
      ...referenceGeometry.asset,
      bounds: {
        min: [-1100, -520, -90],
        max: [1100, 520, 420]
      }
    }
  };
  if (runtimeReferenceAssetBoundsError(runtimeReferenceGeometryData(assetBoundsReferenceGeometry))) {
    console.error("FAILED: browser reference geometry loader should accept asset bounds matching accepted runtime object payload bounds");
    return 1;
  }
  if (!runtimeReferenceAssetBoundsError({
    ...assetBoundsReferenceGeometry,
    chunks: [
      ...assetBoundsReferenceGeometry.chunks,
      {
        ...sampleManifestChunk,
        path: "chunks/duplicate_bounds_reference_scan_points.chunk.json"
      }
    ]
  })) {
    console.error("FAILED: browser reference geometry asset bounds should reject direct data with duplicated referenced chunk ids");
    return 1;
  }
  if (!runtimeReferenceAssetBoundsError({
    ...assetBoundsReferenceGeometry,
    objects: {
      ...assetBoundsReferenceGeometry.objects,
      reference_grid_lines: {
        ...assetBoundsReferenceGeometry.objects.reference_grid_lines,
        lineSegments: []
      }
    }
  })) {
    console.error("FAILED: browser reference geometry asset bounds should reject direct data with invalid object payloads");
    return 1;
  }
  if (!runtimeReferenceAssetBoundsError({
    ...assetBoundsReferenceGeometry,
    layers: {
      ...assetBoundsReferenceGeometry.layers,
      survey_lines: {
        ...assetBoundsReferenceGeometry.layers.survey_lines,
        display: {
          color: "red"
        }
      }
    }
  })) {
    console.error("FAILED: browser reference geometry asset bounds should reject direct data whose objects reference invalid runtime layers");
    return 1;
  }
  const emptyBoundedReferenceGeometry = {
    ...assetBoundsReferenceGeometry,
    objects: {}
  };
  if (!runtimeReferenceAssetBoundsError(runtimeReferenceGeometryData(emptyBoundedReferenceGeometry))) {
    console.error("FAILED: browser reference geometry loader should reject asset bounds when no accepted runtime object payload bounds exist");
    return 1;
  }
  const incompleteChunkBoundsAssetReferenceGeometry = {
    ...assetBoundsReferenceGeometry,
    objects: {
      ...assetBoundsReferenceGeometry.objects,
      reference_scan_points_chunked: (({ bounds, ...object }) => object)(assetBoundsReferenceGeometry.objects.reference_scan_points_chunked)
    },
    chunks: assetBoundsReferenceGeometry.chunks.map((chunk) => chunk.id === "sample_reference_scan_chunk_1"
      ? (({ bounds, ...chunkWithoutBounds }) => chunkWithoutBounds)(chunk)
      : chunk)
  };
  if (!runtimeReferenceAssetBoundsError(runtimeReferenceGeometryData(incompleteChunkBoundsAssetReferenceGeometry))) {
    console.error("FAILED: browser reference geometry loader should reject asset bounds when a retained chunked object lacks complete manifest chunk bounds");
    return 1;
  }
  const staleAssetBoundsReferenceGeometry = {
    ...assetBoundsReferenceGeometry,
    asset: {
      ...assetBoundsReferenceGeometry.asset,
      bounds: {
        min: [-999, -520, -90],
        max: [1100, 520, 420]
      }
    }
  };
  if (!runtimeReferenceAssetBoundsError(runtimeReferenceGeometryData(staleAssetBoundsReferenceGeometry))) {
    console.error("FAILED: browser reference geometry loader should reject stale asset bounds before rendering");
    return 1;
  }
  const filteredObjectAssetBoundsReferenceGeometry = {
    ...assetBoundsReferenceGeometry,
    objects: {
      ...assetBoundsReferenceGeometry.objects,
      stale_runtime_mesh: {
        id: "stale_runtime_mesh",
        kind: "mesh",
        layer: "equipment_mesh",
        vertices: [[999, 999, 999], [1000, 999, 999], [999, 1000, 999]],
        faces: [[0, 1, 2]],
        bounds: {
          min: [0, 0, 0],
          max: [1, 1, 1]
        }
      }
    },
    asset: {
      ...assetBoundsReferenceGeometry.asset,
      bounds: {
        min: [-1100, -520, -90],
        max: [1000, 1000, 999]
      }
    }
  };
  if (!runtimeReferenceAssetBoundsError(runtimeReferenceGeometryData(filteredObjectAssetBoundsReferenceGeometry))) {
    console.error("FAILED: browser reference geometry loader should reject asset bounds that only match filtered-out runtime objects");
    return 1;
  }
  const referenceScene = buildScene(project, profiles, fasteners, settings, {
    referenceGeometryAssets: [
      {
        id: "sample_reference_geometry",
        projectAsset: project.referenceGeometry?.assets?.sample_reference_geometry,
        data: referenceGeometry,
        loadedChunks: {
          sample_reference_scan_chunk_1: {
            id: "sample_reference_scan_chunk_1",
            data: referencePointCloudChunk
          }
        }
      }
    ]
  });
  if (project.objectIndex?.sample_reference_geometry) {
    console.error("FAILED: reference geometry assets must not be stored in project.objectIndex");
    return 1;
  }
  if (!referenceScene.faces.some((face) => face.collection === "referenceGeometry" && face.referenceObjectId === "reference_equipment_box")) {
    console.error("FAILED: canonical reference mesh should render as referenceGeometry faces");
    return 1;
  }
  if (!referenceScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "reference_grid_lines")) {
    console.error("FAILED: canonical reference line-set should render as referenceGeometry lines");
    return 1;
  }
  if (!referenceScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectKind === "point-cloud")) {
    console.error("FAILED: canonical reference point cloud should render as referenceGeometry preview lines");
    return 1;
  }
  if (!referenceScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "reference_scan_points_chunked")) {
    console.error("FAILED: chunked canonical reference point cloud should render as referenceGeometry preview lines");
    return 1;
  }
  if (!referenceScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "reference_scan_points" && line.color === "#2e2e2e")) {
    console.error("FAILED: inline reference point cloud should render preview lines with per-point intensity colors");
    return 1;
  }
  if (!referenceScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "reference_scan_points_chunked" && line.color === "#292929")) {
    console.error("FAILED: chunked reference point cloud should render preview lines with chunked per-point intensity colors");
    return 1;
  }
  const referenceSceneSignature = referencePrimitiveSignature(referenceScene);
  for (const source of [
    { format: "dxf", requestedFormat: "dxf" },
    { format: "dwg", requestedFormat: "dwg" },
    { format: "step", requestedFormat: "p21" },
    { format: "ifc", requestedFormat: "ifczip" },
    { format: "e57", requestedFormat: "e57pointcloud" },
    { format: "e57pointcloud", requestedFormat: "e57pointcloud" },
    { format: "json", requestedFormat: "json" }
  ]) {
    const sourceVariantReferenceGeometry = cloneJson(referenceGeometry);
    sourceVariantReferenceGeometry.asset.source = {
      ...(sourceVariantReferenceGeometry.asset.source || {}),
      format: source.format,
      requestedFormat: source.requestedFormat
    };
    const sourceVariantScene = buildScene(project, profiles, fasteners, settings, {
      referenceGeometryAssets: [
        {
          id: "sample_reference_geometry",
          projectAsset: project.referenceGeometry?.assets?.sample_reference_geometry,
          data: sourceVariantReferenceGeometry,
          loadedChunks: {
            sample_reference_scan_chunk_1: {
              id: "sample_reference_scan_chunk_1",
              data: referencePointCloudChunk
            }
          }
        }
      ]
    });
    if (referencePrimitiveSignature(sourceVariantScene) !== referenceSceneSignature) {
      console.error(`FAILED: reference geometry rendering should depend on canonical payload, not asset.source.format ${source.format}`);
      return 1;
    }
  }
  const styledIfcReference = readJson(path.join(ROOT, "bobercad", "data", "references", "a7614_lego_full_mock_up_ifc.reference.json"));
  const styledIfcScene = buildScene(project, profiles, fasteners, settings, {
    referenceGeometryAssets: [
      {
        id: "a7614_lego_full_mock_up_ifc",
        projectAsset: project.referenceGeometry?.assets?.a7614_lego_full_mock_up_ifc,
        data: styledIfcReference
      }
    ]
  });
  const styledIfcFaceColors = new Set(styledIfcScene.faces
    .filter((face) => face.collection === "referenceGeometry")
    .map((face) => face.color));
  if (styledIfcFaceColors.size < 3 || !styledIfcFaceColors.has("#e7535c") || !styledIfcFaceColors.has("#ffe500")) {
    console.error("FAILED: IFC reference mesh surface colors should reach rendered referenceGeometry faces");
    return 1;
  }
  const limitedPointCloudSettings = JSON.parse(JSON.stringify(settings));
  limitedPointCloudSettings.render.referenceGeometry = {
    ...(limitedPointCloudSettings.render.referenceGeometry || {}),
    pointPreviewLimit: 2,
    pointPreviewChunkLimit: 1
  };
  const limitedPointCloudReference = {
    $schema: "../../app/schemas/reference-geometry.schema.json",
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: "limited_point_cloud_reference",
      name: "Limited Point Cloud Reference",
      source: {
        format: "e57pointcloud",
        requestedFormat: "e57pointcloud"
      },
      units: "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: {
        min: [1, 0, 0],
        max: [3, 0, 0]
      }
    },
    layers: {
      scan_points: {
        id: "scan_points",
        name: "Scan Points"
      }
    },
    objects: {
      limited_scan: {
        id: "limited_scan",
        kind: "point-cloud",
        name: "Limited Scan",
        layer: "scan_points",
        chunkIds: ["limited_scan_chunk"]
      }
    },
    chunks: [
      {
        id: "limited_scan_chunk",
        kind: "point-cloud",
        objectId: "limited_scan",
        path: "chunks/limited_scan_chunk.json",
        pointCount: 3,
        bounds: {
          min: [1, 0, 0],
          max: [3, 0, 0]
        }
      }
    ],
    diagnostics: []
  };
  const limitedPointCloudChunkData = {
    $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
    schema: "bobercad-reference-point-cloud-chunk",
    schemaVersion: "0.1.0",
    id: "limited_scan_chunk",
    kind: "point-cloud",
    objectId: "limited_scan",
    pointCount: 3,
    bounds: {
      min: [1, 0, 0],
      max: [3, 0, 0]
    },
    points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]]
  };
  const limitedPointCloudScene = buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: "../references/limited.reference.json" },
        data: limitedPointCloudReference,
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk",
            data: {
              $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
              schema: "bobercad-reference-point-cloud-chunk",
              schemaVersion: "0.1.0",
              id: "limited_scan_chunk",
              kind: "point-cloud",
              objectId: "limited_scan",
              pointCount: 3,
              bounds: {
                min: [1, 0, 0],
                max: [3, 0, 0]
              },
              points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]],
              pointAttributes: {
                intensities: [1, 2, 3]
              }
            }
          }
        }
      }
    ]
  });
  const limitedPointCloudLines = limitedPointCloudScene.lines.filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan");
  if (limitedPointCloudLines.length !== 6) {
    console.error(`FAILED: point-cloud preview should honor render.referenceGeometry.pointPreviewLimit before expanding preview lines, got ${limitedPointCloudLines.length}`);
    return 1;
  }
  const limitedPointCloudStats = limitedPointCloudScene.referenceGeometryPreviewStats;
  const limitedPointCloudEntry = limitedPointCloudStats?.objects?.find((entry) => entry.objectId === "limited_scan");
  if (
    limitedPointCloudStats?.limits?.pointPreviewLimit !== 2
    || limitedPointCloudStats?.limits?.pointPreviewChunkLimit !== 1
    || limitedPointCloudStats?.totals?.renderedPointCount !== 2
    || limitedPointCloudStats?.totals?.omittedPointCount !== 1
    || limitedPointCloudStats?.totals?.clippedObjectCount !== 1
    || limitedPointCloudEntry?.candidatePointCount !== 3
    || limitedPointCloudEntry?.renderedPointCount !== 2
    || limitedPointCloudEntry?.omittedPointCount !== 1
    || limitedPointCloudEntry?.clipped !== true
  ) {
    console.error("FAILED: point-cloud preview limit should be reported in referenceGeometryPreviewStats");
    return 1;
  }
  const invalidRgbPointCloudReference = cloneJson(limitedPointCloudReference);
  const invalidRgbPointCloudScene = buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: "../references/invalid-rgb.reference.json" },
        data: invalidRgbPointCloudReference,
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk",
            data: {
              $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
              schema: "bobercad-reference-point-cloud-chunk",
              schemaVersion: "0.1.0",
              id: "limited_scan_chunk",
              kind: "point-cloud",
              objectId: "limited_scan",
              pointCount: 3,
              bounds: {
                min: [1, 0, 0],
                max: [3, 0, 0]
              },
              points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]],
              pointAttributes: {
                colors: [[-1, 0, 0], [0, 0, 999], [0, 0, 0]],
                intensities: [0.25, 0.5, 0.75]
              }
            }
          }
        }
      }
    ]
  });
  const invalidRgbPointCloudColors = new Set(invalidRgbPointCloudScene.lines
    .filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan")
    .map((line) => line.color));
  if (
    !invalidRgbPointCloudColors.has("#808080")
    || !invalidRgbPointCloudColors.has("#404040")
    || invalidRgbPointCloudColors.has("#ff0000")
    || invalidRgbPointCloudColors.has("#000000")
  ) {
    console.error("FAILED: direct reference point-cloud preview should reject out-of-range RGB attributes before falling back to intensity colors");
    return 1;
  }
  const mismatchedAttributePointCloudReference = cloneJson(limitedPointCloudReference);
  const mismatchedAttributePointCloudScene = buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: "../references/mismatched-attribute.reference.json" },
        data: mismatchedAttributePointCloudReference,
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk",
            data: {
              $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
              schema: "bobercad-reference-point-cloud-chunk",
              schemaVersion: "0.1.0",
              id: "limited_scan_chunk",
              kind: "point-cloud",
              objectId: "limited_scan",
              pointCount: 3,
              bounds: {
                min: [1, 0, 0],
                max: [3, 0, 0]
              },
              points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]],
              pointAttributes: {
                colors: [[17, 34, 51]],
                intensities: [0.25, 0.5, 0.75]
              }
            }
          }
        }
      }
    ]
  });
  const mismatchedAttributePointCloudColors = new Set(mismatchedAttributePointCloudScene.lines
    .filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan")
    .map((line) => line.color));
  if (
    !mismatchedAttributePointCloudColors.has("#808080")
    || !mismatchedAttributePointCloudColors.has("#404040")
    || mismatchedAttributePointCloudColors.has("#112233")
    || mismatchedAttributePointCloudColors.has("#445566")
  ) {
    console.error("FAILED: direct reference point-cloud preview should ignore misaligned RGB attribute arrays before falling back to aligned intensity colors");
    return 1;
  }
  const mixedStoragePointCloudReference = cloneJson(limitedPointCloudReference);
  mixedStoragePointCloudReference.objects.limited_scan.points = [[0, 0, 0]];
  mixedStoragePointCloudReference.objects.limited_scan.pointAttributes = {
    intensities: [0.5]
  };
  const duplicateChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  duplicateChunkPointCloudReference.objects.limited_scan.chunkIds = ["limited_scan_chunk", "limited_scan_chunk"];
  const objectAttributesChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  objectAttributesChunkPointCloudReference.objects.limited_scan.pointAttributes = {
    intensities: [0.5]
  };
  const unsafeChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  unsafeChunkPointCloudReference.objects.limited_scan.chunkIds = ["../private_chunk"];
  const invalidPointCloudStorageScenes = [
    ["mixed", mixedStoragePointCloudReference],
    ["duplicate", duplicateChunkPointCloudReference],
    ["object-attributes", objectAttributesChunkPointCloudReference],
    ["unsafe-chunk", unsafeChunkPointCloudReference]
  ].map(([id, data]) => buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: `../references/invalid-${id}.reference.json` },
        data,
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk",
            data: {
              $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
              schema: "bobercad-reference-point-cloud-chunk",
              schemaVersion: "0.1.0",
              id: "limited_scan_chunk",
              kind: "point-cloud",
              objectId: "limited_scan",
              pointCount: 3,
              bounds: {
                min: [1, 0, 0],
                max: [3, 0, 0]
              },
              points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]]
            }
          }
        }
      }
    ]
  }));
  if (invalidPointCloudStorageScenes.some((scene) => (
    scene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan")
    || scene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "limited_scan")
  ))) {
    console.error("FAILED: direct reference point-cloud preview should reject mixed, duplicate, object-level attribute, or unsafe chunk storage before primitives or preview stats are emitted");
    return 1;
  }
  const missingManifestChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  missingManifestChunkPointCloudReference.chunks = [];
  const unsafeManifestChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  unsafeManifestChunkPointCloudReference.chunks[0].path = "../private/limited_scan_chunk.json";
  const mismatchedManifestChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  mismatchedManifestChunkPointCloudReference.chunks[0].objectId = "other_scan";
  const duplicateManifestChunkPointCloudReference = cloneJson(limitedPointCloudReference);
  duplicateManifestChunkPointCloudReference.chunks = [
    limitedPointCloudReference.chunks[0],
    { ...limitedPointCloudReference.chunks[0], path: "chunks/limited_scan_chunk_duplicate.json" }
  ];
  const invalidManifestChunkScenes = [
    ["missing-manifest-chunk", missingManifestChunkPointCloudReference],
    ["unsafe-manifest-chunk", unsafeManifestChunkPointCloudReference],
    ["mismatched-manifest-chunk", mismatchedManifestChunkPointCloudReference],
    ["duplicate-manifest-chunk", duplicateManifestChunkPointCloudReference]
  ].map(([id, data]) => buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: `../references/${id}.reference.json` },
        data,
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk",
            data: {
              $schema: "../../app/schemas/reference-point-cloud-chunk.schema.json",
              schema: "bobercad-reference-point-cloud-chunk",
              schemaVersion: "0.1.0",
              id: "limited_scan_chunk",
              kind: "point-cloud",
              objectId: "limited_scan",
              pointCount: 3,
              bounds: {
                min: [1, 0, 0],
                max: [3, 0, 0]
              },
              points: [[1, 0, 0], [2, 0, 0], [3, 0, 0]]
            }
          }
        }
      }
    ]
  }));
  if (invalidManifestChunkScenes.some((scene) => (
    scene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan")
    || scene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "limited_scan")
  ))) {
    console.error("FAILED: direct reference point-cloud preview should reject missing, unsafe, mismatched, or duplicate manifest chunk entries before primitives or preview stats are emitted");
    return 1;
  }
  const invalidLoadedChunkScenes = [
    ["non-object-loaded-chunks", []],
    ["non-object-loaded-chunk-entry", { limited_scan_chunk: [] }],
    ["unsafe-loaded-chunk-wrapper-id", { limited_scan_chunk: { id: "../private_chunk", data: limitedPointCloudChunkData } }],
    ["mismatched-loaded-chunk-wrapper-id", { limited_scan_chunk: { id: "other_scan_chunk", data: limitedPointCloudChunkData } }],
    ["missing-loaded-chunk-schema-ref", { limited_scan_chunk: { id: "limited_scan_chunk", data: { ...limitedPointCloudChunkData, $schema: "" } } }],
    ["unsupported-loaded-chunk-field", { limited_scan_chunk: { id: "limited_scan_chunk", data: { ...limitedPointCloudChunkData, adapterLocalPath: "C:/private/chunk" } } }],
    ["non-object-loaded-chunk-point-attributes", { limited_scan_chunk: { id: "limited_scan_chunk", data: { ...limitedPointCloudChunkData, pointAttributes: [] } } }],
    ["unsupported-loaded-chunk-point-attributes", { limited_scan_chunk: { id: "limited_scan_chunk", data: { ...limitedPointCloudChunkData, pointAttributes: { temperatures: [1, 2, 3] } } } }],
    ["non-object-loaded-chunk-metadata", { limited_scan_chunk: { id: "limited_scan_chunk", data: { ...limitedPointCloudChunkData, metadata: [] } } }]
  ].map(([id, loadedChunks]) => buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: `../references/${id}.reference.json` },
        data: limitedPointCloudReference,
        loadedChunks
      }
    ]
  }));
  if (invalidLoadedChunkScenes.some((scene) => (
    scene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_scan")
    || scene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "limited_scan")
  ))) {
    console.error("FAILED: direct reference point-cloud preview should reject malformed loaded chunk sidecars before primitives or preview stats are emitted");
    return 1;
  }
  const limitedLineMeshSettings = JSON.parse(JSON.stringify(settings));
  limitedLineMeshSettings.render.referenceGeometry = {
    ...(limitedLineMeshSettings.render.referenceGeometry || {}),
    pointPreviewChunkLimit: 0,
    lineSegmentPreviewLimit: 2,
    meshFacePreviewLimit: 1
  };
  const limitedLineMeshReference = {
    $schema: "../../app/schemas/reference-geometry.schema.json",
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: "limited_line_mesh_reference",
      name: "Limited Line Mesh Reference",
      source: {
        format: "step",
        requestedFormat: "p21"
      },
      units: "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      }
    },
    layers: {
      reference_limits: {
        id: "reference_limits",
        name: "Reference Limits"
      }
    },
    objects: {
      limited_lines: {
        id: "limited_lines",
        kind: "line-set",
        layer: "reference_limits",
        vertices: [[0, 0, 0], [100, 0, 0], [200, 0, 0], [300, 0, 0], [400, 0, 0]],
        lineSegments: [[0, 1], [1, 2], [2, 3], [3, 4]]
      },
      limited_mesh: {
        id: "limited_mesh",
        kind: "mesh",
        layer: "reference_limits",
        vertices: [[0, 0, 0], [100, 0, 0], [100, 100, 0], [0, 100, 0], [0, 0, 100], [100, 0, 100], [100, 100, 100], [0, 100, 100]],
        faces: [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1]]
      }
    },
    chunks: [],
    diagnostics: []
  };
  const limitedLineMeshScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/limited-line-mesh.reference.json" },
        data: limitedLineMeshReference
      }
    ]
  });
  const limitedReferenceLines = limitedLineMeshScene.lines.filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_lines");
  if (limitedReferenceLines.length !== 2) {
    console.error(`FAILED: line-set preview should honor render.referenceGeometry.lineSegmentPreviewLimit, got ${limitedReferenceLines.length}`);
    return 1;
  }
  const limitedReferenceFaces = limitedLineMeshScene.faces.filter((face) => face.collection === "referenceGeometry" && face.referenceObjectId === "limited_mesh");
  if (limitedReferenceFaces.length !== 1) {
    console.error(`FAILED: mesh preview should honor render.referenceGeometry.meshFacePreviewLimit, got ${limitedReferenceFaces.length}`);
    return 1;
  }
  const limitedLineMeshStats = limitedLineMeshScene.referenceGeometryPreviewStats;
  const limitedLineEntry = limitedLineMeshStats?.objects?.find((entry) => entry.objectId === "limited_lines");
  const limitedMeshEntry = limitedLineMeshStats?.objects?.find((entry) => entry.objectId === "limited_mesh");
  if (
    limitedLineMeshStats?.limits?.lineSegmentPreviewLimit !== 2
    || limitedLineMeshStats?.limits?.meshFacePreviewLimit !== 1
    || limitedLineMeshStats?.totals?.renderedLineSegmentCount !== 2
    || limitedLineMeshStats?.totals?.omittedLineSegmentCount !== 2
    || limitedLineMeshStats?.totals?.renderedMeshFaceCount !== 1
    || limitedLineMeshStats?.totals?.omittedMeshFaceCount !== 2
    || limitedLineMeshStats?.totals?.clippedObjectCount !== 2
    || limitedLineEntry?.lineSegmentCount !== 4
    || limitedLineEntry?.renderedLineSegmentCount !== 2
    || limitedLineEntry?.omittedLineSegmentCount !== 2
    || limitedMeshEntry?.meshFaceCount !== 3
    || limitedMeshEntry?.renderedMeshFaceCount !== 1
    || limitedMeshEntry?.omittedMeshFaceCount !== 2
  ) {
    console.error("FAILED: line-set and mesh preview limits should be reported in referenceGeometryPreviewStats");
    return 1;
  }
  const unsafeDirectReferenceAssetScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "C:/private/reference",
        projectAsset: { path: "../references/private.reference.json" },
        data: limitedLineMeshReference
      }
    ]
  });
  const unsafeDirectObjectReference = cloneJson(limitedLineMeshReference);
  unsafeDirectObjectReference.objects.limited_lines.id = "../private_lines";
  const unsafeDirectReferenceObjectScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/private.reference.json" },
        data: unsafeDirectObjectReference
      }
    ]
  });
  if (
    unsafeDirectReferenceAssetScene.referenceGeometryPreviewStats?.totals?.assetCount !== undefined
    || unsafeDirectReferenceAssetScene.lines.some((line) => line.collection === "referenceGeometry")
    || unsafeDirectReferenceAssetScene.faces.some((face) => face.collection === "referenceGeometry")
    || unsafeDirectReferenceObjectScene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "../private_lines")
    || unsafeDirectReferenceObjectScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "../private_lines")
    || JSON.stringify(unsafeDirectReferenceObjectScene.referenceGeometryPreviewStats || {}).includes("../private_lines")
    || JSON.stringify(unsafeDirectReferenceObjectScene.lines.filter((line) => line.collection === "referenceGeometry")).includes("../private_lines")
  ) {
    console.error("FAILED: direct reference scene construction should reject unsafe reference asset/object ids before primitives or preview stats are emitted");
    return 1;
  }
  const unsafeDirectMetadataReference = cloneJson(limitedLineMeshReference);
  unsafeDirectMetadataReference.objects.limited_lines.metadata = {
    sourcePath: privateReferenceMetadataPath
  };
  const unsafeDirectMetadataScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/unsafe-metadata.reference.json" },
        data: unsafeDirectMetadataReference
      }
    ]
  });
  if (
    unsafeDirectMetadataScene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_lines")
    || unsafeDirectMetadataScene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "limited_lines")
    || JSON.stringify(unsafeDirectMetadataScene.referenceGeometryPreviewStats || {}).includes(privateReferenceMetadataPath)
    || JSON.stringify(unsafeDirectMetadataScene.lines.filter((line) => line.collection === "referenceGeometry")).includes(privateReferenceMetadataPath)
  ) {
    console.error("FAILED: direct reference scene construction should reject unsafe object metadata before primitives or preview stats are emitted");
    return 1;
  }
  const degenerateDirectGeometryReference = cloneJson(limitedLineMeshReference);
  degenerateDirectGeometryReference.objects.limited_lines.lineSegments = [[0, 0], [0, 1]];
  degenerateDirectGeometryReference.objects.limited_mesh.faces = [[0, 0, 1], [0, 1, 2]];
  const degenerateDirectGeometryScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/degenerate-geometry.reference.json" },
        data: degenerateDirectGeometryReference
      }
    ]
  });
  if (
    degenerateDirectGeometryScene.lines.some((line) => line.collection === "referenceGeometry")
    || degenerateDirectGeometryScene.faces.some((face) => face.collection === "referenceGeometry")
    || degenerateDirectGeometryScene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === "limited_lines" || entry.objectId === "limited_mesh")
    || degenerateDirectGeometryScene.referenceGeometryPreviewStats?.totals?.objectCount > 0
  ) {
    console.error("FAILED: direct reference scene construction should reject degenerate line-set/mesh payloads before primitives or preview stats are emitted");
    return 1;
  }
  const invalidProjectOverrideStyleScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: {
          path: "../references/invalid-style.reference.json",
          display: {
            color: "https://example.invalid/private-color",
            edgeColor: "C:/private/asset-edge",
            opacity: 2
          }
        },
        data: limitedLineMeshReference
      }
    ]
  });
  const invalidStyleLineColors = new Set(invalidProjectOverrideStyleScene.lines
    .filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_lines")
    .map((line) => line.color));
  const invalidStyleMeshFaceColors = new Set(invalidProjectOverrideStyleScene.faces
    .filter((face) => face.collection === "referenceGeometry" && face.referenceObjectId === "limited_mesh")
    .map((face) => face.color));
  const invalidStyleMeshEdgeColors = new Set(invalidProjectOverrideStyleScene.lines
    .filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_mesh")
    .map((line) => line.color));
  const invalidStyleOpacities = new Set([
    ...invalidProjectOverrideStyleScene.lines.filter((line) => line.collection === "referenceGeometry").map((line) => line.opacity),
    ...invalidProjectOverrideStyleScene.faces.filter((face) => face.collection === "referenceGeometry").map((face) => face.opacity)
  ]);
  const invalidStylePrimitives = JSON.stringify({
    lines: invalidProjectOverrideStyleScene.lines.filter((line) => line.collection === "referenceGeometry"),
    faces: invalidProjectOverrideStyleScene.faces.filter((face) => face.collection === "referenceGeometry")
  });
  if (
    invalidStyleLineColors.size !== 1
    || !invalidStyleLineColors.has("#2563eb")
    || invalidStyleMeshFaceColors.size !== 1
    || !invalidStyleMeshFaceColors.has("#2563eb")
    || invalidStyleMeshEdgeColors.size !== 1
    || !invalidStyleMeshEdgeColors.has("#1e3a8a")
    || invalidStyleOpacities.size !== 1
    || !invalidStyleOpacities.has(0.36)
    || invalidStylePrimitives.includes("C:/private")
    || invalidStylePrimitives.includes("file:///private")
    || invalidStylePrimitives.includes("https://example.invalid")
    || invalidStylePrimitives.includes("../private")
    || invalidStylePrimitives.includes("rgb(255")
  ) {
    console.error("FAILED: direct reference scene construction should sanitize invalid project display overrides before scene primitives are emitted");
    return 1;
  }
  const fallbackDirectReferenceStyle = cloneJson(limitedLineMeshReference);
  fallbackDirectReferenceStyle.layers.reference_limits.display = {
    opacity: 0.42
  };
  const fallbackDirectReferenceStyleScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: {
          path: "../references/fallback-style.reference.json",
          display: {
            opacity: 0.84
          }
        },
        data: fallbackDirectReferenceStyle
      }
    ]
  });
  const fallbackLineOpacities = new Set(fallbackDirectReferenceStyleScene.lines
    .filter((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "limited_lines")
    .map((line) => line.opacity));
  if (fallbackLineOpacities.size !== 1 || !fallbackLineOpacities.has(0.42)) {
    console.error("FAILED: direct reference scene construction should prefer valid canonical layer display opacity over project asset opacity");
    return 1;
  }
  const directReferenceObjectRendered = (scene, objectId) => {
    const statsRendered = scene.referenceGeometryPreviewStats?.objects?.some((entry) => entry.objectId === objectId);
    const lineRendered = scene.lines.some((line) => line.collection === "referenceGeometry" && line.referenceObjectId === objectId);
    const faceRendered = scene.faces.some((face) => face.collection === "referenceGeometry" && face.referenceObjectId === objectId);
    return Boolean(statsRendered || lineRendered || faceRendered);
  };
  const anyDirectReferenceObjectRendered = (scene) => (
    scene.lines.some((line) => line.collection === "referenceGeometry")
    || scene.faces.some((face) => face.collection === "referenceGeometry")
    || (scene.referenceGeometryPreviewStats?.objects || []).length > 0
    || scene.referenceGeometryPreviewStats?.totals?.objectCount > 0
  );
  const directReferenceAssetAccepted = (scene) => (
    scene.referenceGeometryPreviewStats?.totals?.assetCount !== undefined
    || anyDirectReferenceObjectRendered(scene)
  );
  const invalidDirectProjectAssetRefs = [
    ["unsafe-project-path", { path: "C:/private/reference.json" }],
    ["unsupported-project-field", { path: "../references/limited-line-mesh.reference.json", manifestUrl: "https://example.invalid/reference.json" }],
    ["invalid-project-visible", { path: "../references/limited-line-mesh.reference.json", visible: "false" }],
    ["invalid-project-snap", { path: "../references/limited-line-mesh.reference.json", snapEnabled: "true" }],
    ["invalid-project-display-container", { path: "../references/limited-line-mesh.reference.json", display: [] }],
    ["unsupported-project-display-field", { path: "../references/limited-line-mesh.reference.json", display: { sourcePath: "C:/private/display" } }],
    ["invalid-project-display-visible", { path: "../references/limited-line-mesh.reference.json", display: { visible: "false" } }],
    ["invalid-project-display-point-size", { path: "../references/limited-line-mesh.reference.json", display: { pointSize: "C:/private/point-size" } }],
    ["invalid-project-transform-container", { path: "../references/limited-line-mesh.reference.json", transform: [] }],
    ["unsupported-project-transform-field", { path: "../references/limited-line-mesh.reference.json", transform: { matrix: [1, 0, 0, 1] } }],
    ["degenerate-project-transform", {
      path: "../references/limited-line-mesh.reference.json",
      transform: {
        axisX: [1, 0, 0],
        axisY: [1, 0, 0],
        axisZ: [0, 0, 1]
      }
    }]
  ].map(([id, projectAsset]) => buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset,
        data: limitedLineMeshReference
      }
    ]
  }));
  if (invalidDirectProjectAssetRefs.some(directReferenceAssetAccepted)) {
    console.error("FAILED: direct reference scene construction should reject malformed project reference asset pointers before asset stats or primitives are emitted");
    return 1;
  }
  const mismatchedDirectAssetReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectAssetReference.asset.id = "other_reference_asset";
  const unsupportedDirectSchemaVersionReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectSchemaVersionReference.schemaVersion = "99.0.0";
  const missingDirectSchemaRefReference = cloneJson(limitedLineMeshReference);
  missingDirectSchemaRefReference.$schema = "";
  const unsupportedDirectManifestFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectManifestFieldReference.adapterLocalPath = "C:/adapter/cache";
  const missingDirectAssetNameReference = cloneJson(limitedLineMeshReference);
  missingDirectAssetNameReference.asset.name = "";
  const unsafeDirectAssetNameReference = cloneJson(limitedLineMeshReference);
  unsafeDirectAssetNameReference.asset.name = privateReferenceDisplayName;
  const unsupportedDirectAssetFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectAssetFieldReference.asset.adapterLocalPath = "C:/adapter/cache";
  const unsupportedDirectSourceFormatReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectSourceFormatReference.asset.source.format = "gltf";
  const unsupportedDirectSourceFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectSourceFieldReference.asset.source.sdkPath = "C:/secret/sdk";
  const unsafeDirectSourceFileNameReference = cloneJson(limitedLineMeshReference);
  unsafeDirectSourceFileNameReference.asset.source.fileName = privateReferenceSourceFileName;
  const invalidDirectSourceChecksumReference = cloneJson(limitedLineMeshReference);
  invalidDirectSourceChecksumReference.asset.source.checksum = "A".repeat(64);
  const invalidDirectSourceTranslatorReference = cloneJson(limitedLineMeshReference);
  invalidDirectSourceTranslatorReference.asset.source.translator = "C:/private/adapter.mjs";
  const invalidDirectSourceTranslatorVersionReference = cloneJson(limitedLineMeshReference);
  invalidDirectSourceTranslatorVersionReference.asset.source.translatorVersion = "C:/private/adapter-version.txt";
  const mismatchedDirectSourceExtensionReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectSourceExtensionReference.asset.source.format = "ifc";
  mismatchedDirectSourceExtensionReference.asset.source.fileExtension = "e57";
  const mismatchedDirectRequestedFormatReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectRequestedFormatReference.asset.source.format = "e57";
  mismatchedDirectRequestedFormatReference.asset.source.requestedFormat = "ifczip";
  const unknownDirectRequestedFormatReference = cloneJson(limitedLineMeshReference);
  unknownDirectRequestedFormatReference.asset.source.format = "unknown";
  unknownDirectRequestedFormatReference.asset.source.requestedFormat = "ifc";
  const unsafeDirectSourceAdapterReference = cloneJson(limitedLineMeshReference);
  unsafeDirectSourceAdapterReference.asset.source.adapterKey = "bad adapter";
  const invalidDirectSourceDateReference = cloneJson(limitedLineMeshReference);
  invalidDirectSourceDateReference.asset.source.modifiedTime = "2026-02-31T00:00:00Z";
  const invalidDirectDiagnosticsContainerReference = cloneJson(limitedLineMeshReference);
  invalidDirectDiagnosticsContainerReference.diagnostics = {};
  const unsupportedDirectAssetBoundsFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectAssetBoundsFieldReference.asset.bounds = {
    min: [0, 0, 0],
    max: [400, 100, 100],
    units: "mm"
  };
  const unsupportedDirectObjectBoundsFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectObjectBoundsFieldReference.objects.limited_lines.bounds = {
    min: [0, 0, 0],
    max: [400, 0, 0],
    units: "mm"
  };
  const staleDirectObjectBoundsReference = cloneJson(limitedLineMeshReference);
  staleDirectObjectBoundsReference.objects.limited_lines.bounds = {
    min: [-1, 0, 0],
    max: [400, 0, 0]
  };
  const staleDirectAssetBoundsReference = cloneJson(limitedLineMeshReference);
  staleDirectAssetBoundsReference.asset.bounds = {
    min: [-1, 0, 0],
    max: [400, 100, 100]
  };
  const invalidDirectDiagnosticEntryReference = cloneJson(limitedLineMeshReference);
  invalidDirectDiagnosticEntryReference.diagnostics = [[]];
  const unsafeDirectDiagnosticCodeReference = cloneJson(limitedLineMeshReference);
  unsafeDirectDiagnosticCodeReference.diagnostics = [{
    severity: "warning",
    code: "C:/private/diagnostic-code",
    message: "Unsafe diagnostic code"
  }];
  const unsafeDirectDiagnosticMessageReference = cloneJson(limitedLineMeshReference);
  unsafeDirectDiagnosticMessageReference.diagnostics = [{
    severity: "warning",
    code: "unsafe-diagnostic-message",
    message: `Adapter warning log at ${privateReferenceDiagnosticPath}`
  }];
  const unsupportedDirectDiagnosticFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectDiagnosticFieldReference.diagnostics = [{
    severity: "info",
    code: "extra-field",
    message: "Extra field",
    sourceHandle: "42"
  }];
  const missingDirectDiagnosticObjectReference = cloneJson(limitedLineMeshReference);
  missingDirectDiagnosticObjectReference.diagnostics = [{
    severity: "warning",
    code: "missing-object",
    message: "Missing object id",
    objectId: "missing_reference_object"
  }];
  const duplicateDirectDiagnosticObjectRefsReference = cloneJson(limitedLineMeshReference);
  duplicateDirectDiagnosticObjectRefsReference.diagnostics = [{
    severity: "warning",
    code: "duplicate-object-refs",
    message: "Duplicate object refs",
    objectRefs: ["limited_lines", "limited_lines"]
  }];
  const unsupportedDirectUnitsReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectUnitsReference.asset.units = "cm";
  const invalidDirectContainerReference = cloneJson(limitedLineMeshReference);
  invalidDirectContainerReference.objects = [];
  const mismatchedDirectObjectKeyReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectObjectKeyReference.objects.limited_lines.id = "other_lines";
  const mismatchedDirectLayerKeyReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectLayerKeyReference.layers.reference_limits.id = "other_layer";
  const unsafeDirectObjectKeyReference = cloneJson(limitedLineMeshReference);
  unsafeDirectObjectKeyReference.objects = {
    "../private_lines": {
      ...unsafeDirectObjectKeyReference.objects.limited_lines,
      id: "limited_lines"
    },
    limited_mesh: unsafeDirectObjectKeyReference.objects.limited_mesh
  };
  const unsafeDirectLayerKeyReference = cloneJson(limitedLineMeshReference);
  unsafeDirectLayerKeyReference.layers = {
    "../private_layer": {
      ...unsafeDirectLayerKeyReference.layers.reference_limits,
      id: "reference_limits"
    }
  };
  const unsupportedDirectLayerFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectLayerFieldReference.layers.reference_limits.adapterLayerPath = "C:/private/layer";
  const emptyDirectLayerNameReference = cloneJson(limitedLineMeshReference);
  emptyDirectLayerNameReference.layers.reference_limits.name = "";
  const unsafeDirectLayerNameReference = cloneJson(limitedLineMeshReference);
  unsafeDirectLayerNameReference.layers.reference_limits.name = privateReferenceDisplayName;
  const invalidDirectLayerDisplayReference = cloneJson(limitedLineMeshReference);
  invalidDirectLayerDisplayReference.layers.reference_limits.display = {
    color: "C:/private/layer-color",
    edgeColor: "url(file:///private-edge)",
    opacity: -0.2
  };
  const unsupportedDirectObjectFieldReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectObjectFieldReference.objects.limited_lines.adapterObjectPath = "C:/private/object";
  const emptyDirectObjectNameReference = cloneJson(limitedLineMeshReference);
  emptyDirectObjectNameReference.objects.limited_lines.name = "";
  const unsafeDirectObjectNameReference = cloneJson(limitedLineMeshReference);
  unsafeDirectObjectNameReference.objects.limited_lines.name = privateReferenceDisplayName;
  const invalidDirectObjectMetadataReference = cloneJson(limitedLineMeshReference);
  invalidDirectObjectMetadataReference.objects.limited_lines.metadata = [];
  const invalidDirectObjectDisplayReference = cloneJson(limitedLineMeshReference);
  invalidDirectObjectDisplayReference.objects.limited_lines.display = {
    visible: "yes",
    color: "red",
    pointSize: -1
  };
  const unsupportedDirectObjectKindReference = cloneJson(limitedLineMeshReference);
  unsupportedDirectObjectKindReference.objects.limited_lines.kind = "brep";
  const wrongDirectKindPayloadReference = cloneJson(limitedLineMeshReference);
  wrongDirectKindPayloadReference.objects.limited_lines.faces = [[0, 1, 2]];
  const invalidDirectManifestScenes = [
    ["asset-id-mismatch", mismatchedDirectAssetReference],
    ["unsupported-schema-version", unsupportedDirectSchemaVersionReference],
    ["missing-schema-ref", missingDirectSchemaRefReference],
    ["unsupported-manifest-field", unsupportedDirectManifestFieldReference],
    ["missing-asset-name", missingDirectAssetNameReference],
    ["unsafe-asset-name", unsafeDirectAssetNameReference],
    ["unsupported-asset-field", unsupportedDirectAssetFieldReference],
    ["unsupported-source-format", unsupportedDirectSourceFormatReference],
    ["unsupported-source-field", unsupportedDirectSourceFieldReference],
    ["unsafe-source-file-name", unsafeDirectSourceFileNameReference],
    ["invalid-source-checksum", invalidDirectSourceChecksumReference],
    ["invalid-source-translator", invalidDirectSourceTranslatorReference],
    ["invalid-source-translator-version", invalidDirectSourceTranslatorVersionReference],
    ["mismatched-source-extension", mismatchedDirectSourceExtensionReference],
    ["mismatched-requested-format", mismatchedDirectRequestedFormatReference],
    ["unknown-requested-format", unknownDirectRequestedFormatReference],
    ["unsafe-source-adapter", unsafeDirectSourceAdapterReference],
    ["invalid-source-date", invalidDirectSourceDateReference],
    ["invalid-diagnostics-container", invalidDirectDiagnosticsContainerReference],
    ["unsupported-asset-bounds-field", unsupportedDirectAssetBoundsFieldReference],
    ["unsupported-object-bounds-field", unsupportedDirectObjectBoundsFieldReference],
    ["stale-object-bounds", staleDirectObjectBoundsReference],
    ["stale-asset-bounds", staleDirectAssetBoundsReference],
    ["invalid-diagnostic-entry", invalidDirectDiagnosticEntryReference],
    ["unsafe-diagnostic-code", unsafeDirectDiagnosticCodeReference],
    ["unsafe-diagnostic-message", unsafeDirectDiagnosticMessageReference],
    ["unsupported-diagnostic-field", unsupportedDirectDiagnosticFieldReference],
    ["missing-diagnostic-object", missingDirectDiagnosticObjectReference],
    ["duplicate-diagnostic-object-refs", duplicateDirectDiagnosticObjectRefsReference],
    ["unsupported-units", unsupportedDirectUnitsReference],
    ["invalid-objects-container", invalidDirectContainerReference],
    ["object-key-mismatch", mismatchedDirectObjectKeyReference],
    ["layer-key-mismatch", mismatchedDirectLayerKeyReference],
    ["unsafe-object-key", unsafeDirectObjectKeyReference],
    ["unsafe-layer-key", unsafeDirectLayerKeyReference],
    ["unsupported-layer-field", unsupportedDirectLayerFieldReference],
    ["empty-layer-name", emptyDirectLayerNameReference],
    ["unsafe-layer-name", unsafeDirectLayerNameReference],
    ["invalid-layer-display", invalidDirectLayerDisplayReference],
    ["unsupported-object-field", unsupportedDirectObjectFieldReference],
    ["empty-object-name", emptyDirectObjectNameReference],
    ["unsafe-object-name", unsafeDirectObjectNameReference],
    ["invalid-object-metadata", invalidDirectObjectMetadataReference],
    ["invalid-object-display", invalidDirectObjectDisplayReference],
    ["unsupported-object-kind", unsupportedDirectObjectKindReference],
    ["wrong-kind-payload", wrongDirectKindPayloadReference]
  ].map(([id, data]) => buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: `../references/${id}.reference.json` },
        data
      }
    ]
  }));
  if (invalidDirectManifestScenes.some(directReferenceAssetAccepted)) {
    console.error("FAILED: direct reference scene construction should reject manifest identity, schema, source metadata, bounds, diagnostics, layer/object metadata, unit, container, or map-key/id mismatches before asset stats or primitives are emitted");
    return 1;
  }
  const nonObjectDirectObjectPointAttributesReference = cloneJson(limitedPointCloudReference);
  nonObjectDirectObjectPointAttributesReference.objects.limited_scan.pointAttributes = [];
  const unsupportedDirectObjectPointAttributesReference = cloneJson(limitedPointCloudReference);
  unsupportedDirectObjectPointAttributesReference.objects.limited_scan.pointAttributes = {
    temperatures: [1, 2, 3]
  };
  const invalidDirectPointAttributeScenes = [
    ["non-object-object-point-attributes", nonObjectDirectObjectPointAttributesReference],
    ["unsupported-object-point-attributes", unsupportedDirectObjectPointAttributesReference]
  ].map(([id, data]) => buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: `../references/${id}.reference.json` },
        data,
        loadedChunks: {}
      }
    ]
  }));
  if (invalidDirectPointAttributeScenes.some(directReferenceAssetAccepted)) {
    console.error("FAILED: direct reference scene construction should reject malformed object pointAttributes metadata before asset stats or primitives are emitted");
    return 1;
  }
  const unsupportedDirectChunkFieldReference = cloneJson(limitedPointCloudReference);
  unsupportedDirectChunkFieldReference.chunks[0].adapterChunkPath = "C:/private/chunk";
  const duplicateDirectChunkReference = cloneJson(limitedPointCloudReference);
  duplicateDirectChunkReference.chunks = [
    limitedPointCloudReference.chunks[0],
    { ...limitedPointCloudReference.chunks[0], path: "chunks/limited_scan_chunk_duplicate.json" }
  ];
  const unsafeDirectChunkPathReference = cloneJson(limitedPointCloudReference);
  unsafeDirectChunkPathReference.chunks[0].path = "../private/limited_scan_chunk.json";
  const missingDirectChunkOwnerReference = cloneJson(limitedPointCloudReference);
  missingDirectChunkOwnerReference.chunks[0].objectId = "missing_scan";
  const unlistedDirectChunkReference = cloneJson(limitedPointCloudReference);
  unlistedDirectChunkReference.chunks[0].id = "unlisted_scan_chunk";
  unlistedDirectChunkReference.chunks[0].path = "chunks/unlisted_scan_chunk.json";
  const unsupportedDirectChunkBoundsFieldReference = cloneJson(limitedPointCloudReference);
  unsupportedDirectChunkBoundsFieldReference.chunks[0].bounds.units = "mm";
  const incompleteDirectChunkObjectBoundsReference = cloneJson(limitedPointCloudReference);
  incompleteDirectChunkObjectBoundsReference.objects.limited_scan.bounds = {
    min: [1, 0, 0],
    max: [3, 0, 0]
  };
  delete incompleteDirectChunkObjectBoundsReference.chunks[0].bounds;
  const staleDirectChunkObjectBoundsReference = cloneJson(limitedPointCloudReference);
  staleDirectChunkObjectBoundsReference.objects.limited_scan.bounds = {
    min: [0, 0, 0],
    max: [3, 0, 0]
  };
  const incompleteDirectChunkAssetBoundsReference = cloneJson(limitedPointCloudReference);
  incompleteDirectChunkAssetBoundsReference.asset.bounds = {
    min: [1, 0, 0],
    max: [3, 0, 0]
  };
  delete incompleteDirectChunkAssetBoundsReference.chunks[0].bounds;
  const invalidDirectChunkScenes = [
    ["unsupported-chunk-field", unsupportedDirectChunkFieldReference],
    ["duplicate-chunk", duplicateDirectChunkReference],
    ["unsafe-chunk-path", unsafeDirectChunkPathReference],
    ["missing-chunk-owner", missingDirectChunkOwnerReference],
    ["unlisted-chunk", unlistedDirectChunkReference],
    ["unsupported-chunk-bounds-field", unsupportedDirectChunkBoundsFieldReference],
    ["incomplete-chunk-object-bounds", incompleteDirectChunkObjectBoundsReference],
    ["stale-chunk-object-bounds", staleDirectChunkObjectBoundsReference],
    ["incomplete-chunk-asset-bounds", incompleteDirectChunkAssetBoundsReference]
  ].map(([id, data]) => buildScene(project, profiles, fasteners, limitedPointCloudSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_point_cloud_reference",
        projectAsset: { path: `../references/${id}.reference.json` },
        data,
        loadedChunks: {}
      }
    ]
  }));
  if (invalidDirectChunkScenes.some(directReferenceAssetAccepted)) {
    console.error("FAILED: direct reference scene construction should reject malformed manifest chunk metadata before asset stats or primitives are emitted");
    return 1;
  }
  const unsafeDirectLayerReference = cloneJson(limitedLineMeshReference);
  unsafeDirectLayerReference.objects.limited_lines.layer = "../private_layer";
  const missingDirectLayerReference = cloneJson(limitedLineMeshReference);
  missingDirectLayerReference.objects.limited_lines.layer = "missing_layer";
  const mismatchedDirectLayerReference = cloneJson(limitedLineMeshReference);
  mismatchedDirectLayerReference.layers.reference_limits.id = "../private_layer";
  const unsafeDirectLayerScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/unsafe-layer.reference.json" },
        data: unsafeDirectLayerReference
      }
    ]
  });
  const missingDirectLayerScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/missing-layer.reference.json" },
        data: missingDirectLayerReference
      }
    ]
  });
  const mismatchedDirectLayerScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/mismatched-layer.reference.json" },
        data: mismatchedDirectLayerReference
      }
    ]
  });
  if (
    directReferenceObjectRendered(unsafeDirectLayerScene, "limited_lines")
    || !directReferenceObjectRendered(unsafeDirectLayerScene, "limited_mesh")
    || directReferenceObjectRendered(missingDirectLayerScene, "limited_lines")
    || !directReferenceObjectRendered(missingDirectLayerScene, "limited_mesh")
    || mismatchedDirectLayerScene.lines.some((line) => line.collection === "referenceGeometry")
    || mismatchedDirectLayerScene.faces.some((face) => face.collection === "referenceGeometry")
    || (mismatchedDirectLayerScene.referenceGeometryPreviewStats?.objects || []).length > 0
  ) {
    console.error("FAILED: direct reference scene construction should reject unsafe, missing, or mismatched reference layers before primitives or preview stats are emitted");
    return 1;
  }
  const invalidDirectCoordinateReference = cloneJson(limitedLineMeshReference);
  invalidDirectCoordinateReference.asset.coordinateSystem.axisY = [1, 0, 0];
  const invalidDirectCoordinateScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: { path: "../references/invalid-coordinate.reference.json" },
        data: invalidDirectCoordinateReference
      }
    ]
  });
  const invalidDirectProjectTransformScene = buildScene(project, profiles, fasteners, limitedLineMeshSettings, {
    referenceGeometryAssets: [
      {
        id: "limited_line_mesh_reference",
        projectAsset: {
          path: "../references/invalid-project-transform.reference.json",
          transform: {
            axisX: [1, 0, 0],
            axisY: [1, 0, 0],
            axisZ: [0, 0, 1]
          }
        },
        data: limitedLineMeshReference
      }
    ]
  });
  if (
    anyDirectReferenceObjectRendered(invalidDirectCoordinateScene)
    || anyDirectReferenceObjectRendered(invalidDirectProjectTransformScene)
  ) {
    console.error("FAILED: direct reference scene construction should reject invalid asset coordinate systems or project transforms before primitives or preview stats are emitted");
    return 1;
  }
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const qaDocument = (() => {
    const nodes = new Map();
    const listeners = new Map();
    const remember = (node) => {
      if (node?.id) nodes.set(node.id, node);
      return node;
    };
    const root = { dataset: {}, append: (node) => remember(node) };
    const body = { dataset: {}, append: (node) => remember(node) };
    return {
      documentElement: root,
      body,
      addEventListener: (type, handler) => listeners.set(type, handler),
      getElementById: (id) => nodes.get(id) || null,
      createElement: (tagName) => {
        let nodeId = "";
        const node = {
          tagName,
          dataset: {},
          style: {},
          hidden: false,
          textContent: "",
          type: "",
          value: "",
          append() {},
          setAttribute(name, value) {
            this[name] = String(value);
          },
          set id(value) {
            nodeId = String(value);
            remember(node);
          },
          get id() {
            return nodeId;
          }
        };
        return node;
      },
      elementFromPoint: () => null,
      listeners
    };
  })();
  try {
    globalThis.window = {};
    globalThis.document = qaDocument;
    globalThis.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    const qaViewer = {
      get scene() {
        return limitedLineMeshScene;
      },
      authoringOverlaySnapshot: () => null,
      projectPoint: () => null,
      objectPoints: () => [],
      fitPoints: () => {},
      canvasDataUrl: () => "",
      setDimensionOverlay: () => {},
      setHighlightedObjects: () => {}
    };
    const qaProject = {
      ...project,
      referenceGeometry: {
        assets: {
          limited_line_mesh_reference: {
            path: "../references/limited-line-mesh.reference.json",
            snapEnabled: true
          },
          limited_point_cloud_reference: {
            path: "../references/limited.reference.json"
          },
          missing_reference: {
            path: "../references/missing.reference.json"
          }
        }
      }
    };
    const qaReferenceGeometryAssets = [
      {
        id: "limited_line_mesh_reference",
        projectAsset: qaProject.referenceGeometry.assets.limited_line_mesh_reference,
        url: new URL("file:///references/limited-line-mesh.reference.json"),
        data: {
          ...limitedLineMeshReference,
          layers: {
            ...(limitedLineMeshReference.layers || {}),
            "bad layer": {
              id: "bad layer",
              name: "Bad Layer"
            }
          },
          objects: {
            ...(limitedLineMeshReference.objects || {}),
            "bad object": {
              id: "bad object",
              kind: "mesh"
            }
          }
        },
        loadedChunks: {}
      },
      {
        id: "limited_line_mesh_reference",
        projectAsset: qaProject.referenceGeometry.assets.limited_line_mesh_reference,
        url: new URL("file:///references/spoofed.reference.json"),
        data: {
          ...limitedLineMeshReference,
          asset: {
            ...limitedLineMeshReference.asset,
            id: "spoofed_line_mesh_reference",
            name: "Spoofed Line Mesh Reference",
            source: {
              format: "dwg"
            }
          }
        },
        loadedChunks: {}
      },
      {
        id: "limited_point_cloud_reference",
        projectAsset: qaProject.referenceGeometry.assets.limited_point_cloud_reference,
        url: new URL("file:///references/limited.reference.json"),
        data: {
          ...limitedPointCloudReference,
          chunks: [
            ...(limitedPointCloudReference.chunks || []),
            { id: "bad chunk" },
            { id: "limited_scan_chunk" }
          ]
        },
        loadedChunks: {
          limited_scan_chunk: {
            id: "limited_scan_chunk"
          }
        }
      }
    ];
    const qaReferenceGeometryLoadDiagnostics = [
      {
        assetId: "limited_line_mesh_reference",
        objectId: "filtered_mesh",
        stage: "object",
        severity: "warning",
        code: "reference-object-rejected",
        message: "Reference geometry object rejected: limited_line_mesh_reference/filtered_mesh: invalid mesh"
      },
      {
        assetId: "missing_reference",
        stage: "manifest-fetch",
        severity: "error",
        code: "reference-manifest-load-failed",
        message: "Reference geometry failed to load: missing_reference: 404"
      },
      {
        assetId: "limited_line_mesh_reference",
        objectId: "C:/private/filtered_mesh",
        chunkId: "../private_chunk",
        stage: "../object",
        severity: "debug",
        code: "C:/private/reference-object-rejected",
        message: "Reference geometry diagnostic leaked C:/private/stage and ../private/chunks"
      }
    ];
    const qaBridge = createViewerQaBridge({
      viewer: qaViewer,
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      settings: limitedLineMeshSettings,
      searchParams: new URLSearchParams(),
      renderProject: () => {},
      getReferenceGeometryAssets: () => qaReferenceGeometryAssets,
      getReferenceGeometryLoadDiagnostics: () => qaReferenceGeometryLoadDiagnostics
    });
    const qaApi = qaBridge.mountQaApi({
      api: { project: () => qaProject },
      profiles: {},
      snapManager: null
    });
    const qaRuntimeStatus = qaApi.referenceGeometryRuntimeStatus();
    const qaRuntimeEntries = Object.fromEntries((qaRuntimeStatus.entries || []).map((entry) => [entry.assetId, entry]));
    if (
      qaRuntimeStatus.assetCount !== 3
      || qaRuntimeStatus.loadedAssetCount !== 2
      || qaRuntimeStatus.readyAssetCount !== 2
      || qaRuntimeStatus.notLoadedAssetCount !== 1
      || qaRuntimeStatus.diagnosticCount !== 3
      || qaRuntimeStatus.warningCount !== 1
      || qaRuntimeStatus.errorCount !== 2
      || qaRuntimeStatus.diagnosticCodeCounts?.["reference-object-rejected"] !== 1
      || qaRuntimeStatus.diagnosticCodeCounts?.["reference-manifest-load-failed"] !== 1
      || qaRuntimeStatus.diagnosticCodeCounts?.["reference-load-error"] !== 1
      || qaRuntimeStatus.missingPreviewChunkCount !== 0
      || qaRuntimeStatus.omittedPreviewChunkCount !== 1
      || qaRuntimeEntries.limited_line_mesh_reference?.status !== "ready"
      || qaRuntimeEntries.limited_line_mesh_reference?.snapEnabled !== true
      || qaRuntimeEntries.limited_line_mesh_reference?.sourceFormat !== "step"
      || qaRuntimeEntries.limited_line_mesh_reference?.requestedFormat !== "p21"
      || qaRuntimeEntries.limited_line_mesh_reference?.sourceRequestedFormat !== "p21"
      || qaRuntimeEntries.limited_line_mesh_reference?.sourceRequestedFormatFamily !== "step"
      || JSON.stringify(qaRuntimeEntries.limited_line_mesh_reference?.sourceRequestedFormatAliases) !== JSON.stringify(["step", "stp", "p21", "stpnc"])
      || qaRuntimeEntries.limited_line_mesh_reference?.sourceRequestedFormatMatchesFamily !== true
      || qaRuntimeEntries.limited_line_mesh_reference?.layerCount !== Object.keys(limitedLineMeshReference.layers || {}).length
      || qaRuntimeEntries.limited_line_mesh_reference?.objectCount !== 2
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticCount !== 2
      || qaRuntimeEntries.limited_line_mesh_reference?.warningCount !== 1
      || qaRuntimeEntries.limited_line_mesh_reference?.errorCount !== 1
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticCodeCounts?.["reference-object-rejected"] !== 1
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticCodeCounts?.["reference-load-error"] !== 1
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[0]?.objectId !== "filtered_mesh"
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.stage !== "load"
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.severity !== "error"
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.code !== "reference-load-error"
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.message !== ""
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.objectId !== null
      || qaRuntimeEntries.limited_line_mesh_reference?.diagnosticEntries?.[1]?.chunkId !== null
      || qaRuntimeEntries.limited_point_cloud_reference?.sourceFormat !== "e57pointcloud"
      || qaRuntimeEntries.limited_point_cloud_reference?.requestedFormat !== "e57pointcloud"
      || qaRuntimeEntries.limited_point_cloud_reference?.sourceRequestedFormat !== "e57pointcloud"
      || qaRuntimeEntries.limited_point_cloud_reference?.sourceRequestedFormatFamily !== "e57"
      || JSON.stringify(qaRuntimeEntries.limited_point_cloud_reference?.sourceRequestedFormatAliases) !== JSON.stringify(["e57", "e57pointcloud", "e57pc"])
      || qaRuntimeEntries.limited_point_cloud_reference?.sourceRequestedFormatMatchesFamily !== true
      || qaRuntimeEntries.limited_point_cloud_reference?.declaredChunkCount !== 1
      || qaRuntimeEntries.limited_point_cloud_reference?.selectedPreviewChunkCount !== 0
      || qaRuntimeEntries.limited_point_cloud_reference?.loadedPreviewChunkCount !== 0
      || qaRuntimeEntries.limited_point_cloud_reference?.missingPreviewChunkCount !== 0
      || qaRuntimeEntries.limited_point_cloud_reference?.omittedPreviewChunkCount !== 1
      || qaRuntimeEntries.limited_point_cloud_reference?.previewChunkLoading !== "budgeted-subset"
      || qaRuntimeEntries.missing_reference?.status !== "not-loaded"
      || qaRuntimeEntries.missing_reference?.errorCount !== 1
      || qaRuntimeEntries.missing_reference?.diagnosticCodeCounts?.["reference-manifest-load-failed"] !== 1
      || qaRuntimeEntries.missing_reference?.diagnosticEntries?.[0]?.code !== "reference-manifest-load-failed"
      || JSON.stringify(qaRuntimeStatus).includes("C:/private")
      || JSON.stringify(qaRuntimeStatus).includes("../private")
      || JSON.stringify(qaRuntimeStatus).includes("file:///references/")
      || "manifestUrl" in qaRuntimeEntries.limited_line_mesh_reference
      || "data" in qaRuntimeEntries.limited_line_mesh_reference
      || "objects" in qaRuntimeEntries.limited_line_mesh_reference
    ) {
      console.error("FAILED: QA API should expose pointer-only reference geometry runtime status");
      return 1;
    }
    qaRuntimeStatus.entries[0].status = "mutated";
    if (qaApi.referenceGeometryRuntimeStatus().entries[0].status === "mutated") {
      console.error("FAILED: QA referenceGeometryRuntimeStatus should return fresh status entries");
      return 1;
    }
    const qaStats = qaApi.referenceGeometryPreviewStats();
    if (
      qaStats?.totals?.renderedLineSegmentCount !== limitedLineMeshStats.totals.renderedLineSegmentCount
      || qaStats?.totals?.renderedMeshFaceCount !== limitedLineMeshStats.totals.renderedMeshFaceCount
      || globalThis.window.__boberCadQa !== qaApi
      || qaDocument.documentElement.dataset.qaApiReady !== "true"
    ) {
      console.error("FAILED: QA API should expose runtime referenceGeometryPreviewStats from the current scene");
      return 1;
    }
    qaStats.totals.renderedLineSegmentCount = -1;
    if (qaApi.referenceGeometryPreviewStats().totals.renderedLineSegmentCount !== limitedLineMeshStats.totals.renderedLineSegmentCount) {
      console.error("FAILED: QA referenceGeometryPreviewStats should return a defensive copy");
      return 1;
    }
    qaDocument.listeners.get("bobercad:qa-request")?.({
      detail: {
        id: "reference-preview-stats",
        method: "referenceGeometryPreviewStats",
        args: []
      }
    });
    await Promise.resolve();
    await Promise.resolve();
    const qaDomResult = JSON.parse(qaDocument.getElementById("bober-cad-qa-result")?.textContent || "{}");
    if (
      qaDomResult.ok !== true
      || qaDomResult.result?.totals?.renderedLineSegmentCount !== limitedLineMeshStats.totals.renderedLineSegmentCount
      || qaDocument.documentElement.dataset.qaLastRequestId !== "reference-preview-stats"
    ) {
      console.error("FAILED: QA DOM bridge should return runtime referenceGeometryPreviewStats");
      return 1;
    }
    qaDocument.listeners.get("bobercad:qa-request")?.({
      detail: {
        id: "reference-runtime-status",
        method: "referenceGeometryRuntimeStatus",
        args: []
      }
    });
    await Promise.resolve();
    await Promise.resolve();
    const qaStatusDomResult = JSON.parse(qaDocument.getElementById("bober-cad-qa-result")?.textContent || "{}");
    if (
      qaStatusDomResult.ok !== true
      || qaStatusDomResult.result?.loadedAssetCount !== 2
      || qaStatusDomResult.result?.errorCount !== 2
      || qaStatusDomResult.result?.diagnosticCodeCounts?.["reference-manifest-load-failed"] !== 1
      || qaStatusDomResult.result?.diagnosticCodeCounts?.["reference-load-error"] !== 1
      || JSON.stringify(qaStatusDomResult.result || {}).includes("C:/private")
      || JSON.stringify(qaStatusDomResult.result || {}).includes("../private")
      || JSON.stringify(qaStatusDomResult.result || {}).includes("file:///references/")
      || "manifestUrl" in (qaStatusDomResult.result?.entries?.find((entry) => entry.assetId === "limited_line_mesh_reference") || {})
      || qaStatusDomResult.result?.entries?.find((entry) => entry.assetId === "missing_reference")?.status !== "not-loaded"
      || qaStatusDomResult.result?.entries?.find((entry) => entry.assetId === "missing_reference")?.diagnosticEntries?.[0]?.stage !== "manifest-fetch"
      || qaDocument.documentElement.dataset.qaLastRequestId !== "reference-runtime-status"
    ) {
      console.error("FAILED: QA DOM bridge should return pointer-only reference geometry runtime status");
      return 1;
    }
    const unsafeProjectPointerBridge = createViewerQaBridge({
      viewer: qaViewer,
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      settings: limitedLineMeshSettings,
      searchParams: new URLSearchParams(),
      renderProject: () => {},
      getReferenceGeometryAssets: () => [{
        id: "unsafe_url_reference",
        projectAsset: {
          path: "https://example.invalid/private.reference.json"
        },
        data: limitedLineMeshReference,
        loadedChunks: {}
      }],
      getReferenceGeometryLoadDiagnostics: () => [{
        assetId: "unsafe_url_reference",
        stage: "manifest-fetch",
        severity: "error",
        code: "reference-manifest-load-failed",
        message: "Unsafe project reference pointer"
      }]
    });
    const unsafeProjectPointerApi = unsafeProjectPointerBridge.mountQaApi({
      api: {
        project: () => ({
          ...project,
          referenceGeometry: {
            assets: {
              unsafe_url_reference: {
                path: "https://example.invalid/private.reference.json"
              },
              "bad reference id": {
                path: "../references/good.reference.json"
              }
            }
          }
        })
      },
      profiles: {},
      snapManager: null
    });
    const unsafeProjectPointerStatus = unsafeProjectPointerApi.referenceGeometryRuntimeStatus();
    if (
      unsafeProjectPointerStatus.assetCount !== 1
      || unsafeProjectPointerStatus.notLoadedAssetCount !== 1
      || unsafeProjectPointerStatus.loadedAssetCount !== 0
      || unsafeProjectPointerStatus.entries?.[0]?.assetId !== "unsafe_url_reference"
      || unsafeProjectPointerStatus.entries?.[0]?.loaded !== false
      || unsafeProjectPointerStatus.entries?.[0]?.status !== "not-loaded"
      || unsafeProjectPointerStatus.entries?.[0]?.path !== null
      || unsafeProjectPointerStatus.entries?.[0]?.visible !== false
      || unsafeProjectPointerStatus.entries?.[0]?.objectCount !== 0
      || unsafeProjectPointerStatus.entries?.[0]?.sourceFormat !== null
      || unsafeProjectPointerStatus.entries?.[0]?.diagnosticCodeCounts?.["reference-manifest-load-failed"] !== 1
      || JSON.stringify(unsafeProjectPointerStatus).includes("https://example.invalid")
      || JSON.stringify(unsafeProjectPointerStatus).includes("bad reference id")
    ) {
      console.error("FAILED: QA reference geometry runtime status should ignore loaded reference data for unsafe project reference asset ids and paths before DOM exposure");
      return 1;
    }
    const invalidLoadedSourceBridge = createViewerQaBridge({
      viewer: qaViewer,
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      settings: limitedLineMeshSettings,
      searchParams: new URLSearchParams(),
      renderProject: () => {},
      getReferenceGeometryAssets: () => [{
        id: "invalid_loaded_source_reference",
        data: {
          ...limitedLineMeshReference,
          asset: {
            ...limitedLineMeshReference.asset,
            id: "invalid_loaded_source_reference",
            source: {
              format: "C:/private/reference.step",
              requestedFormat: "../private"
            }
          }
        },
        loadedChunks: {}
      }],
      getReferenceGeometryLoadDiagnostics: () => []
    });
    const invalidLoadedSourceApi = invalidLoadedSourceBridge.mountQaApi({
      api: {
        project: () => ({
          ...project,
          referenceGeometry: {
            assets: {
              invalid_loaded_source_reference: {
                path: "../references/invalid-loaded-source.reference.json"
              }
            }
          }
        })
      },
      profiles: {},
      snapManager: null
    });
    const invalidLoadedSourceStatus = invalidLoadedSourceApi.referenceGeometryRuntimeStatus();
    if (
      invalidLoadedSourceStatus.assetCount !== 1
      || invalidLoadedSourceStatus.loadedAssetCount !== 0
      || invalidLoadedSourceStatus.notLoadedAssetCount !== 1
      || invalidLoadedSourceStatus.entries?.[0]?.status !== "not-loaded"
      || invalidLoadedSourceStatus.entries?.[0]?.sourceFormat !== null
      || invalidLoadedSourceStatus.entries?.[0]?.objectCount !== 0
      || JSON.stringify(invalidLoadedSourceStatus).includes("C:/private")
      || JSON.stringify(invalidLoadedSourceStatus).includes("../private")
    ) {
      console.error("FAILED: QA reference geometry runtime status should ignore matching-id loaded reference data with invalid canonical source metadata before DOM exposure");
      return 1;
    }
    const missingSelectedChunkSettings = cloneJson(limitedLineMeshSettings);
    missingSelectedChunkSettings.render.referenceGeometry = {
      ...(missingSelectedChunkSettings.render.referenceGeometry || {}),
      pointPreviewLimit: 2,
      pointPreviewChunkLimit: 1
    };
    const missingSelectedChunkReference = cloneJson(limitedPointCloudReference);
    missingSelectedChunkReference.asset.id = "missing_preview_chunk_reference";
    missingSelectedChunkReference.asset.name = "Missing Preview Chunk Reference";
    const missingSelectedChunkBridge = createViewerQaBridge({
      viewer: qaViewer,
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      settings: missingSelectedChunkSettings,
      searchParams: new URLSearchParams(),
      renderProject: () => {},
      getReferenceGeometryAssets: () => [
        {
          id: "missing_preview_chunk_reference",
          projectAsset: { path: "../references/missing-preview-chunk.reference.json" },
          url: new URL("file:///references/missing-preview-chunk.reference.json"),
          data: missingSelectedChunkReference,
          loadedChunks: {
            limited_scan_chunk: {
              id: "../private_chunk"
            }
          }
        }
      ],
      getReferenceGeometryLoadDiagnostics: () => []
    });
    const missingSelectedChunkApi = missingSelectedChunkBridge.mountQaApi({
      api: {
        project: () => ({
          ...project,
          referenceGeometry: {
            assets: {
              missing_preview_chunk_reference: {
                path: "../references/missing-preview-chunk.reference.json"
              }
            }
          }
        })
      },
      profiles: {},
      snapManager: null
    });
    const missingSelectedChunkStatus = missingSelectedChunkApi.referenceGeometryRuntimeStatus();
    const missingSelectedChunkEntry = missingSelectedChunkStatus.entries?.[0] || {};
    if (
      missingSelectedChunkStatus.assetCount !== 1
      || missingSelectedChunkStatus.readyAssetCount !== 0
      || missingSelectedChunkStatus.previewChunkMissingAssetCount !== 1
      || missingSelectedChunkStatus.missingPreviewChunkCount !== 1
      || missingSelectedChunkStatus.omittedPreviewChunkCount !== 0
      || missingSelectedChunkEntry.status !== "preview-chunks-missing"
      || missingSelectedChunkEntry.selectedPreviewChunkCount !== 1
      || missingSelectedChunkEntry.loadedPreviewChunkCount !== 0
      || missingSelectedChunkEntry.missingPreviewChunkCount !== 1
      || missingSelectedChunkEntry.omittedPreviewChunkCount !== 0
      || missingSelectedChunkEntry.previewChunkLoading !== "all"
    ) {
      console.error("FAILED: QA reference geometry runtime status should distinguish missing or invalid selected point-cloud chunks from budget-omitted chunks");
      return 1;
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRequestAnimationFrame;
  }
  const disabledReferenceSnapCandidates = collectSnapCandidates({
    project,
    profiles,
    context: {
      includeGlobalAxes: false,
      referenceGeometryLines: referenceScene.lines
    },
    scope: {},
    rawPoint: [0, 0, 0]
  }).filter((candidate) => candidate.providerId === "referenceGeometry");
  if (disabledReferenceSnapCandidates.length) {
    console.error("FAILED: reference geometry snap candidates should be opt-in through project reference asset snapEnabled");
    return 1;
  }
  const snapEnabledReferenceScene = buildScene(project, profiles, fasteners, settings, {
    referenceGeometryAssets: [
      {
        id: "sample_reference_geometry",
        projectAsset: {
          ...(project.referenceGeometry?.assets?.sample_reference_geometry || {}),
          snapEnabled: true
        },
        data: referenceGeometry,
        loadedChunks: {
          sample_reference_scan_chunk_1: {
            id: "sample_reference_scan_chunk_1",
            data: referencePointCloudChunk
          }
        }
      }
    ]
  });
  const referenceSnapCandidates = collectSnapCandidates({
    project,
    profiles,
    context: {
      includeGlobalAxes: false,
      referenceGeometryLines: snapEnabledReferenceScene.lines
    },
    scope: {},
    rawPoint: [0, 0, 0]
  }).filter((candidate) => candidate.providerId === "referenceGeometry");
  if (!referenceSnapCandidates.some((candidate) => candidate.type === "reference-geometry-line" && candidate.target?.collection === "referenceGeometry")) {
    console.error("FAILED: snap-enabled reference linework should produce referenceGeometry line snap candidates");
    return 1;
  }
  if (!referenceSnapCandidates.some((candidate) => candidate.type === "reference-geometry-endpoint")) {
    console.error("FAILED: snap-enabled reference linework should expose endpoint snap candidates");
    return 1;
  }
  if (referenceSnapCandidates.some((candidate) => candidate.referenceObjectKind === "point-cloud")) {
    console.error("FAILED: point-cloud preview lines should not become reference snap candidates");
    return 1;
  }
  const pointKey = (point) => point.map((value) => Math.round(value * 1000) / 1000).join(",");
  const framedReferenceGeometry = {
    $schema: "../../app/schemas/reference-geometry.schema.json",
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: "framed_reference",
      name: "Framed Reference",
      source: {
        format: "json"
      },
      units: "m",
      coordinateSystem: {
        origin: [0.1, 0.005, 0.002],
        axisX: [0, 1, 0],
        axisY: [-1, 0, 0],
        axisZ: [0, 0, 1]
      },
      bounds: {
        min: [0, 0, 0],
        max: [0.01, 0, 0]
      }
    },
    layers: {
      framed_layer: {
        id: "framed_layer",
        name: "Framed Layer"
      }
    },
    objects: {
      framed_line: {
        id: "framed_line",
        kind: "line-set",
        layer: "framed_layer",
        vertices: [
          [0, 0, 0],
          [0.01, 0, 0]
        ],
        lineSegments: [
          [0, 1]
        ]
      }
    },
    chunks: [],
    diagnostics: []
  };
  const framedScene = buildScene(project, profiles, fasteners, settings, {
    referenceGeometryAssets: [
      {
        id: "framed_reference",
        projectAsset: {
          path: "../references/framed.reference.json",
          transform: {
            origin: [1000, 2000, 0],
            scale: 2
          }
        },
        data: framedReferenceGeometry,
        loadedChunks: {}
      }
    ]
  });
  const framedLine = framedScene.lines.find((line) => line.collection === "referenceGeometry" && line.referenceObjectId === "framed_line");
  if (!framedLine) {
    console.error("FAILED: framed canonical reference line should render");
    return 1;
  }
  const framedPoints = new Set(framedLine.points.map(pointKey));
  if (!framedPoints.has("1200,2010,4") || !framedPoints.has("1200,2030,4")) {
    console.error(`FAILED: reference asset units and coordinateSystem should compose with project transform, got ${[...framedPoints].join(" | ")}`);
    return 1;
  }
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
