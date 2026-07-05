export const DATA_LIBRARY_SPECS = Object.freeze([
  library("profiles", "Profiles", "library", "profiles"),
  library("materials", "Materials", "library", "materials"),
  library("fasteners", "Fasteners", "library", "fasteners"),
  library("frames", "Frames", "library", "frames"),
  library("smartComponents", "Smart Components", "smart-component", "smartComponents")
]);

export const DATA_LIBRARY_DEFAULT_IDS = Object.freeze(DATA_LIBRARY_SPECS.map((spec) => spec.id));

const LIBRARY_BY_ID = new Map(DATA_LIBRARY_SPECS.map((spec) => [spec.id, spec]));
const LIBRARY_ORDER_BY_ID = new Map(DATA_LIBRARY_DEFAULT_IDS.map((id, index) => [id, index]));
const REFERENCE_SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const REFERENCE_DIAGNOSTIC_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const REFERENCE_RUNTIME_TEXT_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|(?:^|[\s"'`])\.\.[\\/]|https?:|file:|\\\\)/i;
const RESERVED_REFERENCE_SOURCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_GEOMETRY_IMPORT_BOOLEAN_TRUE_TOKENS = new Set(["true", "1", "yes", "y", "on"]);
const REFERENCE_GEOMETRY_IMPORT_BOOLEAN_FALSE_TOKENS = new Set(["false", "0", "no", "n", "off"]);
const REFERENCE_GEOMETRY_CANONICAL_SCHEMA_NAME = "bobercad-reference-geometry";
const REFERENCE_GEOMETRY_CANONICAL_SCHEMA_VERSION = "0.1.0";
const REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID = "tools/reference-geometry/translate_reference_geometry.mjs";
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_UNIT_TOKENS = Object.freeze([
  "mm",
  "m",
  "in",
  "ft"
]);

export const REFERENCE_GEOMETRY_IMPORT_SOURCE_GROUPS = Object.freeze([
  referenceGeometryImportGroup({
    canonicalFormat: "dxf",
    label: "DXF",
    fileExtensions: ["dxf"],
    formatTokens: ["dxf"],
    defaultImporterTranslationMode: "built-in",
    importerTranslationModes: ["built-in"],
    importerTranslationModesByToken: { dxf: "built-in" },
    builtInAvailable: true,
    adapterRequestCapable: true
  }),
  referenceGeometryImportGroup({
    canonicalFormat: "json",
    label: "Canonical JSON",
    fileExtensions: ["json"],
    formatTokens: ["json"],
    defaultImporterTranslationMode: "canonical-json",
    importerTranslationModes: ["canonical-json"],
    importerTranslationModesByToken: { json: "canonical-json" },
    builtInAvailable: true,
    canonicalJsonPassthrough: true
  }),
  referenceGeometryImportGroup({
    canonicalFormat: "dwg",
    label: "DWG",
    fileExtensions: ["dwg"],
    formatTokens: ["dwg"],
    defaultImporterTranslationMode: "external-adapter",
    importerTranslationModes: ["external-adapter"],
    importerTranslationModesByToken: { dwg: "external-adapter" },
    externalAdapterRequired: true,
    hasExternalAdapterOnlyTokens: true,
    externalAdapterRequiredTokens: ["dwg"],
    adapterRequestCapable: true
  }),
  referenceGeometryImportGroup({
    canonicalFormat: "step",
    label: "STEP",
    fileExtensions: ["step", "stp", "p21", "stpnc"],
    formatTokens: ["step", "stp", "p21", "stpnc"],
    defaultImporterTranslationMode: "built-in",
    importerTranslationModes: ["built-in"],
    importerTranslationModesByToken: {
      step: "built-in",
      stp: "built-in",
      p21: "built-in",
      stpnc: "built-in"
    },
    builtInAvailable: true,
    adapterRequestCapable: true
  }),
  referenceGeometryImportGroup({
    canonicalFormat: "ifc",
    label: "IFC",
    fileExtensions: ["ifc", "ifcxml", "ifczip"],
    formatTokens: ["ifc", "ifcxml", "ifczip"],
    defaultImporterTranslationMode: "built-in",
    importerTranslationModes: ["built-in", "external-adapter"],
    importerTranslationModesByToken: {
      ifc: "built-in",
      ifcxml: "external-adapter",
      ifczip: "external-adapter"
    },
    builtInAvailable: true,
    hasExternalAdapterOnlyTokens: true,
    externalAdapterRequiredTokens: ["ifcxml", "ifczip"],
    adapterRequestCapable: true
  }),
  referenceGeometryImportGroup({
    canonicalFormat: "e57",
    label: "E57 Point Cloud",
    fileExtensions: ["e57"],
    formatTokens: ["e57", "e57pointcloud", "e57pc"],
    cliOnlyTokens: ["e57pointcloud", "e57pc"],
    defaultImporterTranslationMode: "external-adapter",
    importerTranslationModes: ["external-adapter"],
    importerTranslationModesByToken: {
      e57: "external-adapter",
      e57pointcloud: "external-adapter",
      e57pc: "external-adapter"
    },
    externalAdapterRequired: true,
    hasExternalAdapterOnlyTokens: true,
    externalAdapterRequiredTokens: ["e57", "e57pointcloud", "e57pc"],
    adapterRequestCapable: true
  })
]);

export const REFERENCE_GEOMETRY_IMPORT_FILE_EXTENSIONS = Object.freeze(
  flattenReferenceGeometryImportGroupValues("fileExtensions")
);
export const REFERENCE_GEOMETRY_IMPORT_ACCEPT_EXTENSIONS = Object.freeze(
  flattenReferenceGeometryImportGroupValues("acceptExtensions")
);
export const REFERENCE_GEOMETRY_IMPORT_ACCEPT = REFERENCE_GEOMETRY_IMPORT_ACCEPT_EXTENSIONS.join(",");
export const REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS = Object.freeze(
  flattenReferenceGeometryImportGroupValues("cliOnlyTokens")
);
export const REFERENCE_GEOMETRY_IMPORT_FORMAT_TOKENS = Object.freeze(
  flattenReferenceGeometryImportGroupValues("formatTokens")
);
const REFERENCE_GEOMETRY_RUNTIME_SOURCE_FORMAT_TOKENS = new Set([
  "dxf",
  "dwg",
  "step",
  "ifc",
  "e57",
  "e57pointcloud",
  "json",
  "unknown"
]);
export const REFERENCE_GEOMETRY_IMPORT_TARGET_FORMAT_TOKENS = Object.freeze(["dxf", "dwg", "step", "ifc", "e57pointcloud"]);
export const REFERENCE_GEOMETRY_IMPORT_SAFE_GATE_ORDER = Object.freeze([
  "--describe-source",
  "--plan-only",
  "--dry-run",
  "import"
]);
export const REFERENCE_GEOMETRY_IMPORT_EXTERNAL_ADAPTER_GATE_ORDER = Object.freeze([
  "--describe-source",
  "--check-adapters",
  "--plan-only",
  "--write-adapter-request",
  "external-adapter-wrapper",
  "--dry-run",
  "import"
]);
export const REFERENCE_GEOMETRY_IMPORT_TRANSLATION_MODE_TOKENS = Object.freeze([
  "built-in",
  "external-adapter",
  "canonical-json"
]);
export const REFERENCE_GEOMETRY_IMPORT_EXECUTION_MODE_TOKENS = Object.freeze([
  "source-discovery",
  "adapter-preflight",
  "plan-only",
  "adapter-request",
  "dry-run",
  "import",
  "check-references",
  "translate",
  "validate-only",
  "external-adapter-wrapper"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_OUTPUT_MODE_TOKENS = Object.freeze([
  "file",
  "stdout"
]);
export const REFERENCE_GEOMETRY_IMPORT_FIX_AREA_TOKENS = Object.freeze([
  "none",
  "adapter-config",
  "adapter-dependency",
  "adapter-preflight",
  "adapter-request",
  "adapter-process",
  "canonical-reference",
  "import-options",
  "cli-options",
  "project-pointer",
  "mixed",
  "unknown"
]);
export const REFERENCE_GEOMETRY_IMPORT_FAILURE_KIND_TOKENS = Object.freeze([
  "adapter-config",
  "adapter-dependency",
  "adapter-request",
  "adapter-process",
  "canonical-reference",
  "import-options",
  "cli-options",
  "unknown"
]);
export const REFERENCE_GEOMETRY_IMPORT_AUDIT_STATUS_TOKENS = Object.freeze([
  "ready",
  "unchecked",
  "invalid-reference",
  "missing-chunks",
  "asset-id-mismatch",
  "unsupported-schema",
  "read-error",
  "missing-manifest",
  "outside-references-dir",
  "missing-path",
  "missing-asset"
]);
export const REFERENCE_GEOMETRY_IMPORT_AUDIT_SEVERITY_TOKENS = Object.freeze([
  "ok",
  "warning",
  "error"
]);
export const REFERENCE_GEOMETRY_IMPORT_DIAGNOSTIC_SEVERITY_TOKENS = Object.freeze([
  "info",
  "warning",
  "error"
]);
export const REFERENCE_GEOMETRY_IMPORT_OBJECT_KIND_TOKENS = Object.freeze([
  "line-set",
  "mesh",
  "point-cloud"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_OUTPUT_VALIDATION_KIND_TOKENS = Object.freeze([
  "cli",
  "request",
  "manifest",
  "point-cloud-chunk",
  "sidecar",
  "unknown"
]);
export const REFERENCE_GEOMETRY_IMPORT_ACTION_TOKENS = Object.freeze([
  "add-adapter-config-entry",
  "audit-imported-reference",
  "audit-replaced-reference",
  "check-adapter-dependencies",
  "check-adapter-preflight",
  "check-references",
  "check-references-after-import",
  "choose-existing-file",
  "choose-supported-reference-source",
  "choose-workflow-stage",
  "collect-required-inputs",
  "confirm-import",
  "confirm-import-after-dry-run",
  "confirm-promoted-write",
  "fix-adapter-dependencies",
  "fix-adapter-preflight",
  "fix-adapter-request",
  "fix-adapter-selection",
  "fix-canonical-reference-output",
  "fix-command-options",
  "fix-import-options",
  "fix-project-reference-pointer",
  "fix-reference-audit-findings",
  "import-reference-geometry",
  "inspect-adapter-run",
  "inspect-command-host-error",
  "inspect-command-host-result",
  "inspect-reference-import-failure",
  "inspect-reference-import-result",
  "load-reference-overlays",
  "optionally-write-adapter-request",
  "plan-canonical-json-import",
  "review-adapter-preflight",
  "review-import-error",
  "review-reference-audit",
  "review-reference-import-result",
  "review-replacement-dry-run-before-import",
  "review-source-description",
  "review-workspace-request",
  "run-check-adapters-or-plan-import",
  "run-check-references",
  "run-dry-run",
  "run-dry-run-before-import",
  "run-dry-run-before-replace-existing",
  "run-external-adapter-and-validate-output",
  "run-external-adapter-wrapper",
  "run-import",
  "run-plan-only",
  "run-plan-only-or-dry-run",
  "run-translate",
  "run-validate-only",
  "select-adapter-config",
  "select-adapter-config-or-check-adapter-preflight",
  "select-compatible-adapter-config",
  "skip-adapter-request",
  "submit-workspace-command",
  "validate-canonical-json-or-plan-passthrough",
  "validate-canonical-json-or-run-translate",
  "use-reference-overlays",
  "wait-for-supported-reference-source",
  "write-adapter-request",
  "write-adapter-request-or-run-translate",
  "write-adapter-request-or-select-adapter-config"
]);
export const REFERENCE_GEOMETRY_IMPORT_WORKFLOW_ISOLATION_BOUNDARY = Object.freeze({
  sourceFormatOwnership: "translator-or-external-adapter",
  applicationInput: "canonical-reference-json",
  projectStoragePolicy: "project-json-pointer-only",
  promotedGeometryStorage: "reference-manifest-and-point-cloud-chunk-sidecars"
});
export const REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES = Object.freeze([
  referenceGeometryImportWorkflowStage({
    id: "source-discovery",
    label: "Source Discovery",
    commandFlags: ["--describe-source"],
    executionMode: null,
    requiredInputs: ["inputPath"],
    decisionField: "referenceImportSourceDecision",
    fingerprintFields: ["referenceSourceDescriptionFingerprint", "referenceImportDiscoveryFingerprint"],
    sideEffectBoundary: {
      requiresProjectPath: false,
      readsSourceFileMetadata: true,
      validatesProjectPointer: false,
      preflightsAdapter: false,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "plan-only",
    label: "Plan Only",
    commandFlags: ["--plan-only"],
    executionMode: "plan-only",
    requiredInputs: ["projectPath", "inputPath"],
    decisionField: "referenceImportPlanDecision",
    fingerprintFields: ["referenceImportPlanFingerprint"],
    sideEffectBoundary: {
      requiresProjectPath: true,
      validatesProjectPointer: true,
      mayPreflightAdapter: true,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "adapter-preflight",
    label: "Adapter Preflight",
    commandFlags: ["--check-adapters"],
    executionMode: null,
    requiredInputs: ["adapterConfigPath"],
    decisionField: "adapterPreflightDecision",
    fingerprintFields: ["adapterRegistryFingerprint", "adapterTargetFormatCoverageFingerprint", "adapterPreflightFingerprint"],
    optional: true,
    sideEffectBoundary: {
      requiresProjectPath: false,
      validatesProjectPointer: false,
      preflightsAdapter: true,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "adapter-request",
    label: "Adapter Request",
    commandFlags: ["--write-adapter-request"],
    executionMode: "adapter-request",
    requiredInputs: ["projectPath", "inputPath", "requestPath"],
    decisionField: "referenceImportAdapterRequestDecision",
    fingerprintFields: ["referenceImportPlanFingerprint", "adapterRequestFingerprint", "adapterRequestEvidenceFingerprint"],
    optional: true,
    sideEffectBoundary: {
      requiresProjectPath: true,
      validatesProjectPointer: true,
      preflightsAdapter: false,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: true,
      preparesAdapterStageDirectories: true,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "dry-run",
    label: "Dry Run",
    commandFlags: ["--dry-run"],
    executionMode: "dry-run",
    requiredInputs: ["projectPath", "inputPath"],
    decisionField: "referenceImportDryRunDecision",
    fingerprintFields: ["referenceImportPlanFingerprint", "referenceTranslatedManifestFingerprint", "referenceTranslatedArtifactFingerprint"],
    sideEffectBoundary: {
      requiresProjectPath: true,
      validatesProjectPointer: true,
      preflightsAdapter: false,
      runsTranslator: true,
      mayLaunchExternalAdapter: true,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesTemporaryReferenceManifest: true,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "import",
    label: "Import",
    commandFlags: [],
    executionMode: "import",
    requiredInputs: ["projectPath", "inputPath"],
    decisionField: "referenceImportPromotionDecision",
    fingerprintFields: ["referenceImportPlanFingerprint", "referenceTranslatedManifestFingerprint", "referenceTranslatedArtifactFingerprint", "referenceManifestFingerprint", "referenceArtifactFingerprint"],
    sideEffectBoundary: {
      requiresProjectPath: true,
      validatesProjectPointer: true,
      preflightsAdapter: false,
      runsTranslator: true,
      mayLaunchExternalAdapter: true,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: true,
      writesProjectPointer: true,
      writesTargetReferenceManifest: true,
      mayWriteTargetReferenceChunks: true,
      readsReferenceManifests: false,
      mayReadPointCloudChunkSidecars: false
    }
  }),
  referenceGeometryImportWorkflowStage({
    id: "check-references",
    label: "Check References",
    commandFlags: ["--check-references"],
    executionMode: null,
    requiredInputs: ["projectPath"],
    decisionField: "referenceAuditDecision",
    fingerprintFields: ["referenceAuditFingerprint"],
    sideEffectBoundary: {
      requiresProjectPath: true,
      readsProjectJson: true,
      validatesProjectPointer: true,
      preflightsAdapter: false,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      readsReferenceManifests: true,
      mayReadPointCloudChunkSidecars: true
    }
  })
]);
export const REFERENCE_GEOMETRY_IMPORT_OPTIONAL_WORKFLOW_STAGES = Object.freeze(
  REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.filter((stage) => stage.optional).map((stage) => stage.id)
);
export const REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER = Object.freeze(
  REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.map((stage) => stage.id)
);
export const REFERENCE_GEOMETRY_IMPORT_NO_PROJECT_OR_TARGET_WRITE_STAGES = Object.freeze(
  REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES
    .filter((stage) => stage.noProjectOrTargetWrites)
    .map((stage) => stage.id)
);
export const REFERENCE_GEOMETRY_IMPORT_PROMOTED_WRITE_STAGES = Object.freeze(
  REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES
    .filter((stage) => stage.promotedWriteStage)
    .map((stage) => stage.id)
);
export const REFERENCE_GEOMETRY_IMPORT_RECOMMENDED_GATE_DECISION_FIELDS = Object.freeze([
  "referenceImportSourceDecision",
  "referenceImportPlanDecision",
  "adapterPreflightDecision",
  "referenceImportDryRunDecision",
  "referenceImportPromotionDecision",
  "referenceAuditDecision"
]);
export const REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STATUS_FIELD = "referenceImportWorkflowStatus";
export const REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTOR_ID = "referenceGeometryImportInputs";
export const REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY = Object.freeze({
  importsTranslatorModules: false,
  readsSourceFiles: false,
  writesAdapterRequests: false,
  writesProjectJson: false,
  writesReferenceFiles: false,
  launchesExternalAdapters: false
});
export const REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTORS = Object.freeze([
  referenceGeometryImportInputDescriptor({
    id: "projectPath",
    label: "Project JSON",
    kind: "project-json-path",
    role: "input",
    source: "current-workspace-project",
    pathPolicy: "existing-project-json-file",
    pathBacked: true,
    requiredForStages: ["plan-only", "adapter-request", "dry-run", "import", "check-references"]
  }),
  referenceGeometryImportInputDescriptor({
    id: "inputPath",
    label: "Reference Source File",
    kind: "reference-source-file",
    role: "input",
    source: "user-selected-local-file",
    pathPolicy: "existing-source-file",
    pathBacked: true,
    accept: REFERENCE_GEOMETRY_IMPORT_ACCEPT,
    fileExtensions: REFERENCE_GEOMETRY_IMPORT_FILE_EXTENSIONS,
    acceptExtensions: REFERENCE_GEOMETRY_IMPORT_ACCEPT_EXTENSIONS,
    formatTokens: REFERENCE_GEOMETRY_IMPORT_FORMAT_TOKENS,
    cliOnlyTokens: REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS,
    requiredForStages: ["source-discovery", "plan-only", "adapter-request", "dry-run", "import"],
    sourceFormatField: "sourceRequestedFormat",
    sourceDecisionField: "referenceImportSourceDecision"
  }),
  referenceGeometryImportInputDescriptor({
    id: "formatToken",
    label: "Source Format Token",
    kind: "source-format-token",
    role: "option",
    source: "file-extension-or-explicit-format-token",
    pathBacked: false,
    optional: true,
    formatTokens: REFERENCE_GEOMETRY_IMPORT_FORMAT_TOKENS,
    cliOnlyTokens: REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS,
    sourceFormatField: "sourceRequestedFormat",
    sourceDecisionField: "referenceImportSourceDecision"
  }),
  referenceGeometryImportInputDescriptor({
    id: "adapterConfigPath",
    label: "Adapter Config",
    kind: "adapter-config-json-path",
    role: "input",
    source: "user-selected-adapter-config",
    pathPolicy: "existing-adapter-config-json-file",
    pathBacked: true,
    optional: true,
    requiredWhen: "external-adapter-execution",
    relevantStages: ["adapter-preflight", "plan-only", "dry-run", "import"]
  }),
  referenceGeometryImportInputDescriptor({
    id: "requestPath",
    label: "Adapter Request JSON",
    kind: "adapter-request-json-output",
    role: "artifact-output",
    source: "translator-cli-output",
    pathPolicy: "stage-contained-json-output",
    pathBacked: true,
    writesArtifact: true,
    outputForStages: ["adapter-request"],
    requiredForStages: ["adapter-request"],
    sideEffectClass: "adapter-request-write-only"
  }),
  referenceGeometryImportInputDescriptor({
    id: "importOptions",
    label: "Import Options",
    kind: "import-options",
    role: "option-bundle",
    source: "user-options-or-cli-flags",
    pathBacked: false,
    optional: true,
    optionFields: ["referencesDir", "assetId", "name", "units", "adapterName", "adapterTimeoutMs", "pointCloudChunkSize", "replaceExisting", "visibility", "snapEnabled", "display", "transform", "summaryOnly"]
  })
]);
export const REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID = "referenceGeometryImportCliBlueprints";
export const REFERENCE_GEOMETRY_IMPORT_CLI_FLAG_BINDINGS = Object.freeze({
  projectPath: "--project",
  inputPath: "--input",
  requestPath: "--write-adapter-request",
  referencesDir: "--references-dir",
  formatToken: "--format",
  adapterConfigPath: "--adapter-config",
  adapterName: "--adapter",
  adapterTimeoutMs: "--adapter-timeout-ms",
  pointCloudChunkSize: "--point-cloud-chunk-size",
  assetId: "--asset-id",
  name: "--name",
  units: "--units",
  replaceExisting: "--replace-existing",
  visible: "--visible",
  snapEnabled: "--snap-enabled",
  opacity: "--opacity",
  color: "--color",
  edgeColor: "--edge-color",
  pointSize: "--point-size",
  origin: "--origin",
  axisX: "--axis-x",
  axisY: "--axis-y",
  axisZ: "--axis-z",
  scale: "--scale",
  summaryOnly: "--summary-only",
  json: "--json"
});
export const REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID = "referenceGeometryImportCommandPlan";
export const REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_FIELDS = Object.freeze([
  "runtimeCommand",
  "cliEntrypoint",
  "stageId",
  "executionMode",
  "cliArgs",
  "cliArgsTemplate",
  "argv",
  "argvTemplate",
  "missingInputDescriptorIds",
  "invalidInputDescriptorIds",
  "invalidImportOptionFields",
  "requiredInputDescriptorIds",
  "requiredCliFlags",
  "optionalCliFlags",
  "sideEffectClass",
  "appRuntimeBoundary"
]);
export const REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_NO_VALUE_FLAGS = Object.freeze([
  "--describe-source",
  "--plan-only",
  "--check-adapters",
  "--dry-run",
  "--check-references",
  "--replace-existing",
  "--summary-only",
  "--json"
]);
export const REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_RUNTIME_BOUNDARY = Object.freeze({
  importsTranslatorModules: false,
  readsSourceFiles: false,
  writesAdapterRequests: false,
  writesProjectJson: false,
  writesReferenceFiles: false,
  launchesExternalAdapters: false,
  executesCli: false,
  buildsShellCommand: false
});
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID = "referenceGeometryImportWorkspaceRequest";
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_FIELDS = Object.freeze([
  "requestId",
  "requestKind",
  "commandId",
  "stageId",
  "executionMode",
  "argv",
  "argvTemplate",
  "missingInputDescriptorIds",
  "invalidInputDescriptorIds",
  "invalidImportOptionFields",
  "resultRouting",
  "sideEffectClass",
  "requiresWriteConfirmation",
  "writeConfirmed",
  "canSubmitToCommandHost",
  "blockedReason",
  "appRuntimeBoundary",
  "commandHostBoundary"
]);
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_KIND = "reference-geometry-import-workspace-command";
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_COMMAND_ID = "model.referenceGeometry.import";
export const REFERENCE_GEOMETRY_IMPORT_COMMAND_HOST_BOUNDARY = Object.freeze({
  ownsCliExecution: true,
  receivesArgvArray: true,
  acceptsShellString: false,
  mustRunFromWorkspaceRoot: true,
  mustPreserveExitCode: true,
  mustCaptureStdout: true,
  mustCaptureStderr: true,
  mustParseJsonStdout: true,
  mustNotParseHumanOutput: true,
  mustReturnResultEnvelope: true
});
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID = "referenceGeometryImportWorkspaceResponse";
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_FIELDS = Object.freeze([
  "responseId",
  "requestId",
  "requestKind",
  "commandId",
  "stageId",
  "executionMode",
  "exitCode",
  "responseStatus",
  "resultOk",
  "resultJsonAccepted",
  "resultRouting",
  "stageDecision",
  "failureDecision",
  "workflowStatus",
  "fingerprintSummary",
  "referenceSourceSummary",
  "adapterPreflightSummary",
  "referencePlanSummary",
  "referenceAdapterRequestSummary",
  "referenceOutputSummary",
  "referencePromotionSummary",
  "referenceAuditSummary",
  "referenceFailureSummary",
  "safeNextAction",
  "recommendedNextAction",
  "humanOutputParsed",
  "stdoutTextIgnored",
  "stderrTextIgnored",
  "appRuntimeBoundary"
]);
const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_PAYLOAD_FIELDS = Object.freeze([
  "resultJson",
  "jsonResult",
  "parsedJson",
  "stdoutJson",
  "hostResult",
  "result",
  "layers",
  "objects",
  "chunks",
  "vertices",
  "faces",
  "points",
  "data",
  "loadedChunks"
]);
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES = Object.freeze([
  "succeeded",
  "failed",
  "missing-json-result",
  "host-error",
  "request-blocked"
]);
export const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_RUNTIME_BOUNDARY = Object.freeze({
  importsTranslatorModules: false,
  readsSourceFiles: false,
  writesAdapterRequests: false,
  writesProjectJson: false,
  writesReferenceFiles: false,
  launchesExternalAdapters: false,
  executesCli: false,
  parsesHumanOutput: false,
  acceptsParsedJsonOnly: true
});
export const REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID = "referenceGeometryImportSession";
export const REFERENCE_GEOMETRY_IMPORT_SESSION_FIELDS = Object.freeze([
  "sessionId",
  "sourceDecision",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "currentStageId",
  "recommendedWorkflowStage",
  "nextActionToken",
  "completedWorkflowStages",
  "failedWorkflowStage",
  "retryWorkflowStage",
  "lastResponseStatus",
  "lastResponseSafeNextAction",
  "lastWorkspaceResponse",
  "stageStates",
  "nextWorkspaceRequest",
  "canSubmitNextRequest",
  "blockedReason",
  "invalidInputDescriptorIds",
  "invalidImportOptionFields",
  "importAllowed",
  "requiresWriteConfirmation",
  "writeConfirmed",
  "appRuntimeBoundary"
]);
export const REFERENCE_GEOMETRY_IMPORT_SESSION_STAGE_STATE_FIELDS = Object.freeze([
  "id",
  "label",
  "availability",
  "actionState",
  "actionToken",
  "completed",
  "failed",
  "current",
  "canBuildArgv",
  "canSubmitWorkspaceRequest",
  "missingInputDescriptorIds",
  "invalidInputDescriptorIds",
  "invalidImportOptionFields",
  "requiresWriteConfirmation",
  "sideEffectClass"
]);
export const REFERENCE_GEOMETRY_IMPORT_SESSION_RUNTIME_BOUNDARY = Object.freeze({
  importsTranslatorModules: false,
  readsSourceFiles: false,
  writesAdapterRequests: false,
  writesProjectJson: false,
  writesReferenceFiles: false,
  launchesExternalAdapters: false,
  executesCli: false,
  buildsShellCommand: false,
  parsesHumanOutput: false,
  acceptsParsedJsonOnly: true
});
export const REFERENCE_GEOMETRY_IMPORT_STAGE_CLI_BLUEPRINTS = Object.freeze([
  referenceGeometryImportCliStageBlueprint({
    stageId: "source-discovery",
    executionMode: null,
    commandPurpose: "source-description",
    commandFlags: ["--describe-source"],
    requiredInputDescriptorIds: ["inputPath"],
    optionalInputDescriptorIds: ["formatToken", "adapterConfigPath"],
    requiredCliFlags: ["--describe-source", "--input"],
    optionalCliFlags: ["--format", "--adapter-config", "--json"]
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "plan-only",
    executionMode: "plan-only",
    commandPurpose: "import-plan",
    commandFlags: ["--plan-only"],
    requiredInputDescriptorIds: ["projectPath", "inputPath"],
    optionalInputDescriptorIds: ["formatToken", "adapterConfigPath", "importOptions"],
    requiredCliFlags: ["--project", "--input", "--plan-only"],
    optionalCliFlags: ["--format", "--references-dir", "--asset-id", "--name", "--units", "--adapter-config", "--adapter", "--adapter-timeout-ms", "--point-cloud-chunk-size", "--replace-existing", "--json"]
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "adapter-preflight",
    executionMode: null,
    commandPurpose: "adapter-dependency-preflight",
    commandFlags: ["--check-adapters"],
    requiredInputDescriptorIds: ["adapterConfigPath"],
    optionalInputDescriptorIds: ["formatToken", "importOptions"],
    requiredCliFlags: ["--adapter-config", "--check-adapters"],
    optionalCliFlags: ["--format", "--adapter", "--json"]
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "adapter-request",
    executionMode: "adapter-request",
    commandPurpose: "adapter-request-write",
    commandFlags: ["--write-adapter-request"],
    requiredInputDescriptorIds: ["projectPath", "inputPath", "requestPath"],
    optionalInputDescriptorIds: ["formatToken", "adapterConfigPath", "importOptions"],
    artifactDescriptorIds: ["requestPath"],
    requiredCliFlags: ["--project", "--input", "--write-adapter-request"],
    optionalCliFlags: ["--format", "--references-dir", "--asset-id", "--name", "--units", "--adapter-config", "--adapter", "--adapter-timeout-ms", "--point-cloud-chunk-size", "--replace-existing", "--json"],
    sideEffectClass: "adapter-request-write-only"
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "dry-run",
    executionMode: "dry-run",
    commandPurpose: "translated-output-validation",
    commandFlags: ["--dry-run"],
    requiredInputDescriptorIds: ["projectPath", "inputPath"],
    optionalInputDescriptorIds: ["formatToken", "adapterConfigPath", "importOptions"],
    requiredCliFlags: ["--project", "--input", "--dry-run"],
    optionalCliFlags: ["--format", "--references-dir", "--asset-id", "--name", "--units", "--adapter-config", "--adapter", "--adapter-timeout-ms", "--point-cloud-chunk-size", "--replace-existing", "--visible", "--snap-enabled", "--opacity", "--color", "--edge-color", "--point-size", "--origin", "--axis-x", "--axis-y", "--axis-z", "--scale", "--json"]
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "import",
    executionMode: "import",
    commandPurpose: "project-pointer-and-reference-promotion",
    commandFlags: [],
    requiredInputDescriptorIds: ["projectPath", "inputPath"],
    optionalInputDescriptorIds: ["formatToken", "adapterConfigPath", "importOptions"],
    requiredCliFlags: ["--project", "--input"],
    optionalCliFlags: ["--format", "--references-dir", "--asset-id", "--name", "--units", "--adapter-config", "--adapter", "--adapter-timeout-ms", "--point-cloud-chunk-size", "--replace-existing", "--visible", "--snap-enabled", "--opacity", "--color", "--edge-color", "--point-size", "--origin", "--axis-x", "--axis-y", "--axis-z", "--scale", "--json"],
    requiresWriteConfirmation: true,
    sideEffectClass: "promoted-project-and-reference-write"
  }),
  referenceGeometryImportCliStageBlueprint({
    stageId: "check-references",
    executionMode: null,
    commandPurpose: "project-reference-audit",
    commandFlags: ["--check-references"],
    requiredInputDescriptorIds: ["projectPath"],
    optionalInputDescriptorIds: ["importOptions"],
    requiredCliFlags: ["--project", "--check-references"],
    optionalCliFlags: ["--references-dir", "--asset-id", "--summary-only", "--json"]
  })
]);
export const REFERENCE_GEOMETRY_IMPORT_RESULT_DESCRIPTOR_ID = "referenceGeometryImportResults";
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_DESCRIPTOR_ID = "referenceGeometryImportAdapterPreflight";
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_CLI_FLAGS = Object.freeze([
  "--adapter-config",
  "--check-adapters",
  "--format",
  "--adapter"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_TOP_LEVEL_FIELDS = Object.freeze([
  "path",
  "adapterConfigPath",
  "adapterConfigFileSizeBytes",
  "adapterConfigFileModifiedTime",
  "adapterConfigStatFingerprint",
  "schemaVersion",
  "placeholderKeys",
  "requested",
  "ok",
  "diagnostics",
  "adapters",
  "adapterRegistryDecision",
  "adapterTargetFormatCoverage",
  "adapterTargetFormatCoverageFingerprint",
  "adapterRegistryFingerprint",
  "adapterPreflightFingerprint",
  "adapterPreflightDecision"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_REGISTRY_DECISION_FIELDS = Object.freeze([
  "adapterConfigReady",
  "adapterCount",
  "adapterKeys",
  "sourceFormatTokens",
  "targetFormatTokens",
  "externalAdapterRequiredTargetFormatTokens",
  "missingExternalAdapterTargetFormatTokens",
  "allExternalAdapterRequiredTargetsConfigured",
  "canListAdapters",
  "canCheckAdapters",
  "mayLaunchExternalAdapter",
  "writesProjectJson",
  "writesReferenceManifest",
  "safeNextAction",
  "recommendedNextAction"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_TARGET_FORMAT_COVERAGE_FIELDS = Object.freeze([
  "adapterTargetFormatCoverageFingerprint",
  "targetFormatTokens",
  "adapterConfiguredTargetFormatTokens",
  "externalAdapterRequiredTargetFormatTokens",
  "externalAdapterConfiguredTargetFormatTokens",
  "missingExternalAdapterTargetFormatTokens",
  "allExternalAdapterRequiredTargetsConfigured",
  "builtInTargetFormatTokens",
  "builtInTargetFormatsWithOptionalAdapters",
  "targetFormatEntries"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_DECISION_FIELDS = Object.freeze([
  "adapterPreflightReady",
  "requestedFormat",
  "requestedFormatToken",
  "requestedAdapter",
  "adapterCount",
  "adapterKeys",
  "selectedAdapterKeys",
  "blockingDiagnosticCount",
  "warningDiagnosticCount",
  "blockingDiagnosticCodes",
  "warningDiagnosticCodes",
  "likelyFixArea",
  "mayLaunchExternalAdapter",
  "writesProjectJson",
  "writesReferenceManifest",
  "safeNextAction",
  "recommendedNextAction"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "adapterPreflightReady",
  "requestedFormat",
  "requestedFormatToken",
  "requestedAdapter",
  "adapterCount",
  "adapterKeys",
  "selectedAdapterKeys",
  "blockingDiagnosticCount",
  "warningDiagnosticCount",
  "blockingDiagnosticCodes",
  "warningDiagnosticCodes",
  "likelyFixArea",
  "safeNextAction",
  "recommendedNextAction",
  "missingRequiredFileCount",
  "missingRequiredDirectoryCount",
  "missingRequiredCommandCount",
  "missingRequiredEnvCount",
  "missingRequiredFilePaths",
  "missingRequiredDirectoryPaths",
  "missingRequiredCommands",
  "missingRequiredEnvNames",
  "allExternalAdapterRequiredTargetsConfigured",
  "missingExternalAdapterTargetFormatTokens",
  "adapterRegistryFingerprint",
  "adapterTargetFormatCoverageFingerprint",
  "adapterPreflightFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_SOURCE_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "canonicalFormat",
  "sourceFileExtension",
  "sourceFileReadyForImport",
  "importerTranslationMode",
  "canonicalJsonPassthrough",
  "builtInAvailable",
  "externalAdapterRequired",
  "adapterConfigProvided",
  "adapterRegistrySupportsSourceFormat",
  "adapterRequestCapable",
  "canWriteAdapterRequest",
  "projectRequiredForImport",
  "sideEffectFreeDiscovery",
  "safeFirstExecutionMode",
  "availableExecutionModes",
  "recommendedNextAction",
  "accept",
  "acceptExtensions",
  "fileExtensions",
  "formatTokens",
  "cliOnlyTokens",
  "referenceSourceDescriptionFingerprint",
  "referenceImportDiscoveryFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_PLAN_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "planOnly",
  "translationMode",
  "assetId",
  "referenceImportName",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "projectPointerReady",
  "adapterRequestCapable",
  "canWriteAdapterRequest",
  "adapterConfigProvided",
  "adapterPreflightOk",
  "safeNextExecutionMode",
  "availableNextExecutionModes",
  "safeNextAction",
  "recommendedNextAction",
  "referenceImportPlanFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterPreflightFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_ADAPTER_REQUEST_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "adapterRequestReady",
  "adapterStageDirectoriesReady",
  "adapterRequestWritten",
  "adapterRequestOnly",
  "translationMode",
  "assetId",
  "referenceImportName",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "adapterKey",
  "adapterOutputMode",
  "adapterConfigProvided",
  "adapterPreflightOk",
  "adapterPreflightReady",
  "adapterPreflightLikelyFixArea",
  "adapterPreflightRecommendedNextAction",
  "validatesCanonicalOutput",
  "outputValidationRequired",
  "safeNextAction",
  "recommendedNextAction",
  "referenceImportPlanFingerprint",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterPreflightFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_OUTPUT_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "dryRun",
  "replacedExisting",
  "translationMode",
  "assetId",
  "referenceImportName",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "sourceAdapter",
  "sourceTranslator",
  "sourceTranslatorVersion",
  "referenceSchema",
  "referenceSchemaVersion",
  "referenceUnits",
  "referenceBoundsMin",
  "referenceBoundsMax",
  "referenceObjectCount",
  "referenceLayerCount",
  "referenceChunkCount",
  "referenceLineSegmentCount",
  "referenceMeshFaceCount",
  "referencePointCloudPointCount",
  "referenceChunkPointCount",
  "referenceChunkFileCount",
  "referenceChunkFileMissingCount",
  "diagnosticCount",
  "diagnosticSeverityCounts",
  "diagnosticCodeCounts",
  "referenceObjectKindCounts",
  "referenceTranslatedManifestFingerprint",
  "referenceTranslatedArtifactFingerprint",
  "referenceManifestFingerprint",
  "referenceArtifactFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_PROMOTION_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "replacedExisting",
  "translationMode",
  "assetId",
  "referenceImportName",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "sourceAdapter",
  "sourceTranslator",
  "sourceTranslatorVersion",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint",
  "referenceSchema",
  "referenceSchemaVersion",
  "referenceUnits",
  "referenceObjectCount",
  "referenceLayerCount",
  "referenceChunkCount",
  "referenceChunkFileCount",
  "referenceChunkFileMissingCount",
  "diagnosticCount",
  "projectPointerReady",
  "projectJsonWritten",
  "projectPointerWritten",
  "targetReferenceManifestWritten",
  "targetReferenceManifestValidated",
  "translatedOutputPromoted",
  "promotedOutputFingerprintsReady",
  "chunkSidecarsReady",
  "safeNextAction",
  "recommendedNextAction",
  "referenceImportPlanFingerprint",
  "referenceTranslatedManifestFingerprint",
  "referenceTranslatedArtifactFingerprint",
  "referenceManifestFingerprint",
  "referenceArtifactFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_AUDIT_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "summaryOnly",
  "requestedAssetId",
  "referenceAssetCount",
  "referenceReadyCount",
  "referenceNeedsAttentionCount",
  "referenceAuditErrorCount",
  "auditPassed",
  "referenceOverlayReady",
  "blockingStatuses",
  "highestPriorityStatus",
  "highestPrioritySeverity",
  "highestPriorityAssetId",
  "likelyFixArea",
  "safeNextAction",
  "recommendedNextAction",
  "referenceAuditStatusCounts",
  "referenceAuditSeverityCounts",
  "selectedAssetCount",
  "readyAssetCount",
  "needsAttentionAssetCount",
  "canonicalManifestCount",
  "readyCanonicalManifestCount",
  "objectCount",
  "layerCount",
  "chunkCount",
  "lineSegmentCount",
  "meshFaceCount",
  "pointCloudPointCount",
  "chunkFileCount",
  "chunkFileMissingCount",
  "chunkFileInvalidCount",
  "chunkPointCount",
  "diagnosticCount",
  "sourceFormatCounts",
  "sourceAdapterCounts",
  "objectKindCounts",
  "referenceAuditFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_REFERENCE_FAILURE_SUMMARY_FIELDS = Object.freeze([
  "ok",
  "stageId",
  "executionMode",
  "responseStatus",
  "failedWorkflowStage",
  "workflowStageComplete",
  "adapterErrorCode",
  "failureKind",
  "likelyFixArea",
  "safeNextAction",
  "recommendedNextAction",
  "retryWorkflowStage",
  "adapterConfigRequired",
  "adapterDependencyReviewRequired",
  "adapterRequestReviewRequired",
  "adapterRunInspectionRequired",
  "canonicalOutputFixRequired",
  "importOptionFixRequired",
  "cliOptionFixRequired",
  "adapterOutputValidationKind",
  "referenceImportPlanFingerprint",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterPreflightFingerprint",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "translationMode",
  "sourceAdapter",
  "errorCount"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_ENTRY_FIELDS = Object.freeze([
  "formats",
  "declaredFormats",
  "command",
  "commandChecked",
  "commandFound",
  "resolvedCommand",
  "resolvedCommandFileSizeBytes",
  "resolvedCommandFileModifiedTime",
  "resolvedCommandFileStatFingerprint",
  "cwd",
  "cwdExists",
  "requiredFiles",
  "requiredDirectories",
  "requiredCommands",
  "requiredEnv",
  "envKeys",
  "externalToolArgumentTemplateMode",
  "externalToolArgumentTemplateSource",
  "externalToolArgumentTemplateSources",
  "externalToolArgumentTemplateShadowedSources",
  "externalToolTemplatedEnvKeys",
  "externalToolRawConfigEnvKeys",
  "externalToolRawConfigPlaceholderPolicy",
  "outputMode",
  "timeoutMs",
  "streamMaxBufferBytes",
  "shell",
  "ok",
  "diagnostics",
  "adapterRegistryFingerprint",
  "adapterPreflightFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_ADAPTER_DIAGNOSTIC_CODES = Object.freeze([
  "adapter-not-found",
  "adapter-format-unsupported",
  "adapter-format-mismatch",
  "adapter-format-unconfigured",
  "adapter-cwd-missing",
  "adapter-shell-command-not-checked",
  "adapter-argument-template-default-used",
  "adapter-argument-template-source-shadowed",
  "adapter-external-tool-command-unchecked",
  "adapter-external-tool-cwd-outside-stage",
  "adapter-external-tool-output-outside-scratch",
  "adapter-external-tool-placeholder-unsupported",
  "adapter-external-tool-args-json-invalid",
  "adapter-external-tool-args-string-invalid",
  "adapter-external-tool-shell-invalid",
  "adapter-external-tool-stream-max-buffer-invalid",
  "adapter-external-tool-point-columns-invalid",
  "adapter-external-tool-point-delimiter-invalid",
  "adapter-external-tool-point-rgb-normalized-invalid",
  "adapter-external-tool-obj-vertex-color-layout-invalid",
  "adapter-command-missing",
  "adapter-required-file-missing",
  "adapter-required-directory-missing",
  "adapter-required-command-missing",
  "adapter-required-env-missing"
]);
export const REFERENCE_GEOMETRY_IMPORT_RESULT_SUCCESS_ENVELOPE_FIELDS = Object.freeze([
  "ok",
  "referenceImportContractVersion",
  "referenceImportExecutionMode",
  "referenceImportSideEffectPlan",
  "referenceImportWorkflowStatus",
  "referenceImportPlanFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_RESULT_ERROR_ENVELOPE_FIELDS = Object.freeze([
  "ok",
  "referenceImportContractVersion",
  "referenceImportFailureDecision",
  "errors"
]);
export const REFERENCE_GEOMETRY_IMPORT_FAILURE_DECISION_FIELDS = Object.freeze([
  "failedWorkflowStage",
  "workflowStageComplete",
  "adapterErrorCode",
  "failureKind",
  "likelyFixArea",
  "safeNextAction",
  "recommendedNextAction",
  "retryWorkflowStage",
  "adapterConfigRequired",
  "adapterDependencyReviewRequired",
  "adapterRequestReviewRequired",
  "adapterRunInspectionRequired",
  "canonicalOutputFixRequired",
  "importOptionFixRequired",
  "cliOptionFixRequired"
]);
export const REFERENCE_GEOMETRY_IMPORT_ERROR_PLAN_CONTEXT_FIELDS = Object.freeze([
  "referenceImportExecutionMode",
  "referenceImportSideEffectPlan",
  "referenceImportWorkflowStatus",
  "referenceImportPlanFingerprint",
  "projectPath",
  "inputPath",
  "referencePath",
  "assetId",
  "dryRun",
  "planOnly",
  "adapterRequestOnly",
  "replacedExisting",
  "translationMode",
  "referenceImportName",
  "referenceImportUnitsOverride",
  "referenceImportPointCloudChunkSize",
  "projectReferenceVisible",
  "projectReferenceSnapEnabled",
  "projectReferenceDisplay",
  "projectReferenceTransform",
  "adapterConfigPath",
  "adapterConfigStatFingerprint",
  "adapterPreflightOk",
  "adapterPreflightRequested",
  "adapterPreflightSelectedAdapter",
  "adapterPreflightAdapterKeys",
  "adapterPreflightFingerprint",
  "adapterPreflightFingerprints",
  "adapterPreflightDecision",
  "adapterPreflightDiagnostics",
  "adapterRegistryFingerprint",
  "adapterRegistryFingerprints",
  "adapterRegistryAdapterFingerprint",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "sourceRequestedFormatMatchesFamily",
  "sourceStatFingerprint"
]);
export const REFERENCE_GEOMETRY_IMPORT_ERROR_PRIMARY_FIELDS = Object.freeze([
  "message",
  "referenceImportPlanFingerprint",
  "adapter",
  "adapterErrorCode",
  "adapterOutputValidationMessage",
  "adapterOutputValidationPath",
  "adapterOutputValidationKind",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryFingerprints",
  "adapterRegistryAdapterFingerprint",
  "adapterRunId",
  "adapterOutputMode",
  "adapterConfigStatFingerprint",
  "adapterCommand",
  "adapterCommandFound",
  "adapterResolvedCommand",
  "adapterPreflightOk",
  "adapterPreflightRequested",
  "adapterPreflightSelectedAdapter",
  "adapterPreflightAdapterKeys",
  "adapterPreflightFingerprint",
  "adapterPreflightFingerprints",
  "adapterPreflightDecision",
  "adapterPreflightDiagnostics",
  "adapterCwd",
  "adapterCwdExists",
  "adapterOutputPath",
  "adapterExitCode",
  "adapterTimedOut",
  "adapterTimeoutMs",
  "adapterStreamMaxBufferBytes",
  "adapterMissingRequiredFiles",
  "adapterMissingRequiredDirectories",
  "adapterMissingRequiredCommands",
  "adapterMissingRequiredEnv",
  "rollbackRecovery"
]);
export const REFERENCE_GEOMETRY_IMPORT_OUTPUT_FINGERPRINT_AVAILABILITY_BY_STAGE = Object.freeze({
  "source-discovery": Object.freeze({
    translatedOutputFingerprintFields: "null",
    promotedOutputFingerprintFields: "null"
  }),
  "plan-only": Object.freeze({
    translatedOutputFingerprintFields: "null",
    promotedOutputFingerprintFields: "null"
  }),
  "adapter-preflight": Object.freeze({
    translatedOutputFingerprintFields: "null",
    promotedOutputFingerprintFields: "null"
  }),
  "adapter-request": Object.freeze({
    translatedOutputFingerprintFields: "null",
    promotedOutputFingerprintFields: "null"
  }),
  "dry-run": Object.freeze({
    translatedOutputFingerprintFields: "sha256",
    promotedOutputFingerprintFields: "null"
  }),
  import: Object.freeze({
    translatedOutputFingerprintFields: "sha256",
    promotedOutputFingerprintFields: "sha256"
  }),
  "check-references": Object.freeze({
    translatedOutputFingerprintFields: "null",
    promotedOutputFingerprintFields: "null",
    auditFingerprintField: "referenceAuditFingerprint"
  })
});

export function dataLibrarySpec(libraryId) {
  return LIBRARY_BY_ID.get(libraryId) || null;
}

export function dataLibraryFallbackSpec(libraryId) {
  const spec = dataLibrarySpec(libraryId);
  if (spec) return spec;
  return Object.freeze({
    id: libraryId,
    label: titleCase(libraryId),
    icon: "library",
    entryKey: libraryId
  });
}

export function normalizeDataLibraryIds(ids = [], fallbackIds = DATA_LIBRARY_DEFAULT_IDS) {
  const normalized = [];
  const seen = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!LIBRARY_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized.length ? normalized : [...fallbackIds];
}

export function sortDataLibraryEntries(entries = []) {
  return [...entries].sort((a, b) => (
    dataLibraryOrder(a?.id) - dataLibraryOrder(b?.id)
    || String(a?.id || "").localeCompare(String(b?.id || ""))
  ));
}

export function dataSourceDescriptor(source = {}) {
  const label = cleanString(source.label);
  const path = cleanString(source.path);
  const displayPath = dataSourceDisplayPath(path);
  const kind = cleanString(source.kind || "JSON");
  const meta = cleanString(source.meta);
  const status = cleanString(source.status);
  const statusMeta = dataSourceStatusMeta({ status, meta });
  const metaKeywords = meta.split(",").map(cleanString).filter(Boolean);
  const sourceMetadataKeywords = dataSourceSourceMetadataKeywords(source);
  const id = cleanString(source.id || label || path || "source");
  const keywords = uniqueStrings([id, label, kind, meta, status, ...metaKeywords, ...sourceMetadataKeywords, path, displayPath]);
  return Object.freeze({
    id,
    label,
    icon: cleanString(source.icon || "file"),
    kind,
    meta,
    status,
    statusMeta,
    path,
    displayPath,
    description: [kind, statusMeta, displayPath].filter(Boolean).join(" - "),
    keywords,
    searchText: keywords.join(" ")
  });
}

export function dataSourceStatusMeta(source = {}) {
  const meta = cleanString(source.meta);
  const status = cleanString(source.status);
  if (!status) return meta;
  if (meta.toLowerCase().includes(status.toLowerCase())) return meta;
  return uniqueStrings([status, meta]).join(", ");
}

function referenceGeometryImportSourceMetadataFields(source = {}, { defaultAliases = false } = {}) {
  const sourceFormat = referenceGeometryImportFormatToken(source.sourceFormat || source.format);
  const requestedToken = referenceGeometryImportFormatToken(source.sourceRequestedFormat || source.requestedFormat);
  const sourceGroup = referenceGeometryImportGroupForToken(sourceFormat);
  const requestedGroup = referenceGeometryImportGroupForToken(requestedToken);
  const group = sourceGroup || requestedGroup;
  const groupTokens = Array.isArray(group?.formatTokens) ? group.formatTokens : [];
  const sourceRequestedFormat = groupTokens.includes(requestedToken) ? requestedToken : "";
  const rawAliases = referenceGeometryImportFormatTokenArray(source.sourceRequestedFormatAliases || source.requestedFormatAliases);
  const aliasCandidates = rawAliases.length ? rawAliases : (defaultAliases ? groupTokens : []);
  const sourceRequestedFormatAliases = group
    ? Object.freeze(uniqueStrings(aliasCandidates.filter((alias) => groupTokens.includes(alias))))
    : Object.freeze([]);
  return Object.freeze({
    sourceFormat,
    sourceRequestedFormat,
    sourceRequestedFormatFamily: group?.canonicalFormat || "",
    sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: requestedToken ? Boolean(sourceRequestedFormat) : null
  });
}

function dataSourceSourceMetadataKeywords(source = {}) {
  const sourceMetadata = referenceGeometryImportSourceMetadataFields(source);
  return uniqueStrings([
    sourceMetadata.sourceFormat,
    sourceMetadata.sourceRequestedFormat,
    sourceMetadata.sourceRequestedFormatFamily,
    ...sourceMetadata.sourceRequestedFormatAliases,
    sourceMetadata.sourceFormat ? `source ${sourceMetadata.sourceFormat}` : "",
    sourceMetadata.sourceRequestedFormat ? `requested ${sourceMetadata.sourceRequestedFormat}` : "",
    sourceMetadata.sourceRequestedFormatFamily ? `family ${sourceMetadata.sourceRequestedFormatFamily}` : ""
  ]);
}

export function referenceGeometryImportFilePickerDescriptor() {
  const sourceGroups = REFERENCE_GEOMETRY_IMPORT_SOURCE_GROUPS.map((group) => referenceGeometryImportGroupCopy(group));
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const targetFormatCoverage = referenceGeometryImportTargetFormatCoverage();
  const keywords = uniqueStrings([
    "reference geometry import",
    "reference import",
    "canonical json",
    REFERENCE_GEOMETRY_IMPORT_ACCEPT,
    ...REFERENCE_GEOMETRY_IMPORT_FILE_EXTENSIONS,
    ...REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS,
    ...sourceGroups.flatMap((group) => [group.canonicalFormat, group.label])
  ]);
  return Object.freeze({
    id: "referenceGeometryImport",
    label: "Reference Geometry Import",
    icon: "reference-plane",
    kind: "Reference Import",
    inputDescriptorId: inputs.id,
    cliBlueprintId: cliBlueprints.id,
    sourceInputDescriptorId: "inputPath",
    formatTokenInputDescriptorId: "formatToken",
    accept: REFERENCE_GEOMETRY_IMPORT_ACCEPT,
    fileExtensions: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_FILE_EXTENSIONS]),
    acceptExtensions: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ACCEPT_EXTENSIONS]),
    sourceGroups: Object.freeze(sourceGroups),
    cliOnlyTokens: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS]),
    targetFormatCoverage,
    safeFirstExecutionMode: "plan-only",
    recommendedPrewriteValidationMode: "dry-run",
    targetPromotionExecutionMode: "import",
    safeGateOrder: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SAFE_GATE_ORDER]),
    externalAdapterGateOrder: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_EXTERNAL_ADAPTER_GATE_ORDER]),
    keywords: Object.freeze(keywords),
    searchText: keywords.join(" ")
  });
}

export function referenceGeometryImportWorkflowDescriptor() {
  const stages = REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.map((stage) => referenceGeometryImportWorkflowStageCopy(stage));
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const results = referenceGeometryImportResultDescriptors();
  const adapterPreflight = referenceGeometryImportAdapterPreflightDescriptors();
  const keywords = uniqueStrings([
    "reference geometry import workflow",
    "staged reference geometry import",
    "canonical reference json",
    ...REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER,
    ...REFERENCE_GEOMETRY_IMPORT_RECOMMENDED_GATE_DECISION_FIELDS
  ]);
  return Object.freeze({
    id: "referenceGeometryImportWorkflow",
    label: "Reference Geometry Import Workflow",
    icon: "reference-plane",
    kind: "Reference Import Workflow",
    workflowPurpose: "staged-reference-geometry-import",
    isolationBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKFLOW_ISOLATION_BOUNDARY }),
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    commandPlanDescriptorId: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    resultDescriptorId: results.id,
    adapterPreflightDescriptorId: adapterPreflight.id,
    stageCliBlueprintIds: Object.freeze([...cliBlueprints.stageIds]),
    stageResultDescriptorIds: Object.freeze([...results.stageIds]),
    stageRequiredCliFlags: freezeRecordOfArrays(cliBlueprints.stageRequiredCliFlags),
    stageOptionalCliFlags: freezeRecordOfArrays(cliBlueprints.stageOptionalCliFlags),
    stageRequiredInputDescriptorIds: freezeRecordOfArrays(inputs.requiredByStage),
    stageArtifactDescriptorIds: freezeRecordOfArrays(inputs.artifactsByStage),
    workflowStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER]),
    optionalStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_OPTIONAL_WORKFLOW_STAGES]),
    safeWorkflowOrder: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER]),
    stageCommandFlags: freezeRecordOfArrays(Object.fromEntries(stages.map((stage) => [stage.id, stage.commandFlags]))),
    stageExecutionModes: freezeFlatRecord(Object.fromEntries(stages.map((stage) => [stage.id, stage.executionMode]))),
    stageRequiredInputs: freezeRecordOfArrays(Object.fromEntries(stages.map((stage) => [stage.id, stage.requiredInputs]))),
    stageDecisionFields: freezeFlatRecord(Object.fromEntries(stages.map((stage) => [stage.id, stage.decisionField]))),
    stageFingerprintFields: freezeRecordOfArrays(Object.fromEntries(stages.map((stage) => [stage.id, stage.fingerprintFields]))),
    stageSideEffectBoundaries: freezeRecordOfRecords(Object.fromEntries(stages.map((stage) => [stage.id, stage.sideEffectBoundary]))),
    noProjectOrTargetWriteStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_NO_PROJECT_OR_TARGET_WRITE_STAGES]),
    promotedWriteStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_PROMOTED_WRITE_STAGES]),
    recommendedGateDecisionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RECOMMENDED_GATE_DECISION_FIELDS]),
    workflowStatusField: REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STATUS_FIELD,
    stages: Object.freeze(stages),
    keywords: Object.freeze(keywords),
    searchText: keywords.join(" ")
  });
}

export function referenceGeometryImportInputDescriptors() {
  const descriptors = REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTORS.map((descriptor) => referenceGeometryImportInputDescriptorCopy(descriptor));
  const descriptorIds = descriptors.map((descriptor) => descriptor.id);
  const requiredByStage = Object.fromEntries(
    REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.map((stage) => [stage.id, stage.requiredInputs || []])
  );
  const artifactsByStage = Object.fromEntries(
    REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.map((stage) => [
      stage.id,
      descriptors
        .filter((descriptor) => descriptor.role === "artifact-output" && (descriptor.outputForStages || []).includes(stage.id))
        .map((descriptor) => descriptor.id)
    ])
  );
  const requiredStageIds = uniqueStrings(Object.values(requiredByStage).flat());
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTOR_ID,
    label: "Reference Geometry Import Inputs",
    icon: "reference-plane",
    kind: "Reference Import Inputs",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    descriptorIds: Object.freeze(descriptorIds),
    optionalDescriptorIds: Object.freeze(descriptors.filter((descriptor) => descriptor.optional).map((descriptor) => descriptor.id)),
    requiredDescriptorIds: Object.freeze(descriptorIds.filter((id) => requiredStageIds.includes(id))),
    artifactDescriptorIds: Object.freeze(descriptors.filter((descriptor) => descriptor.role === "artifact-output").map((descriptor) => descriptor.id)),
    sourceInputDescriptorId: "inputPath",
    projectInputDescriptorId: "projectPath",
    formatTokenInputDescriptorId: "formatToken",
    adapterConfigInputDescriptorId: "adapterConfigPath",
    adapterRequestArtifactDescriptorId: "requestPath",
    importOptionsDescriptorId: "importOptions",
    requiredByStage: freezeRecordOfArrays(requiredByStage),
    artifactsByStage: freezeRecordOfArrays(artifactsByStage),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY }),
    descriptors: Object.freeze(descriptors)
  });
}

export function referenceGeometryImportCliBlueprints() {
  const stageBlueprints = REFERENCE_GEOMETRY_IMPORT_STAGE_CLI_BLUEPRINTS.map((blueprint) => referenceGeometryImportCliStageBlueprintCopy(blueprint));
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    label: "Reference Geometry Import CLI Blueprints",
    icon: "reference-plane",
    kind: "Reference Import CLI Blueprints",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTOR_ID,
    cliEntrypoint: "tools/reference-geometry/import_reference_geometry_asset.mjs",
    sourceDiscoveryCommand: "--describe-source",
    adapterRegistryCommand: "--list-adapters",
    adapterPreflightCommand: "--check-adapters",
    auditCommand: "--check-references",
    jsonFlag: "--json",
    commandPlanDescriptorId: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    appRuntimeExecutesCli: false,
    requiresWorkspaceCommandHost: true,
    stageIds: Object.freeze(stageBlueprints.map((blueprint) => blueprint.stageId)),
    stageCommandFlags: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.commandFlags]))),
    stageRequiredCliFlags: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.requiredCliFlags]))),
    stageOptionalCliFlags: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.optionalCliFlags]))),
    stageRequiredInputDescriptorIds: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.requiredInputDescriptorIds]))),
    stageOptionalInputDescriptorIds: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.optionalInputDescriptorIds]))),
    stageArtifactDescriptorIds: freezeRecordOfArrays(Object.fromEntries(stageBlueprints.map((blueprint) => [blueprint.stageId, blueprint.artifactDescriptorIds]))),
    cliFlagBindings: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_CLI_FLAG_BINDINGS }),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY }),
    stageBlueprints: Object.freeze(stageBlueprints)
  });
}

export function referenceGeometryImportResultDescriptors() {
  const stageDescriptors = REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STAGES.map((stage) => referenceGeometryImportStageResultDescriptor(stage));
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_RESULT_DESCRIPTOR_ID,
    label: "Reference Geometry Import Results",
    icon: "reference-plane",
    kind: "Reference Import Results",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTOR_ID,
    cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    workflowStatusField: REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STATUS_FIELD,
    planFingerprintField: "referenceImportPlanFingerprint",
    adapterRequestFingerprintField: "adapterRequestFingerprint",
    adapterRequestEvidenceFingerprintField: "adapterRequestEvidenceFingerprint",
    failureDecisionField: "referenceImportFailureDecision",
    successEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULT_SUCCESS_ENVELOPE_FIELDS]),
    errorEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULT_ERROR_ENVELOPE_FIELDS]),
    failureDecisionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_FAILURE_DECISION_FIELDS]),
    errorPlanContextFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ERROR_PLAN_CONTEXT_FIELDS]),
    errorPrimaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ERROR_PRIMARY_FIELDS]),
    translatedOutputFingerprintFields: Object.freeze(["referenceTranslatedManifestFingerprint", "referenceTranslatedArtifactFingerprint"]),
    promotedOutputFingerprintFields: Object.freeze(["referenceManifestFingerprint", "referenceArtifactFingerprint"]),
    outputFingerprintAvailabilityByStage: freezeRecordOfRecords(REFERENCE_GEOMETRY_IMPORT_OUTPUT_FINGERPRINT_AVAILABILITY_BY_STAGE),
    stageIds: Object.freeze(stageDescriptors.map((descriptor) => descriptor.stageId)),
    stageDecisionFields: freezeFlatRecord(Object.fromEntries(stageDescriptors.map((descriptor) => [descriptor.stageId, descriptor.decisionField]))),
    stageFingerprintFields: freezeRecordOfArrays(Object.fromEntries(stageDescriptors.map((descriptor) => [descriptor.stageId, descriptor.fingerprintFields]))),
    stageOutputFingerprintAvailability: freezeRecordOfRecords(Object.fromEntries(stageDescriptors.map((descriptor) => [descriptor.stageId, descriptor.outputFingerprintAvailability]))),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY }),
    stageDescriptors: Object.freeze(stageDescriptors)
  });
}

export function referenceGeometryImportAdapterPreflightDescriptors() {
  const externalAdapterTokens = uniqueStrings(
    REFERENCE_GEOMETRY_IMPORT_SOURCE_GROUPS.flatMap((group) => group.externalAdapterRequiredTokens || [])
  );
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_DESCRIPTOR_ID,
    label: "Reference Geometry Adapter Preflight",
    icon: "reference-plane",
    kind: "Reference Import Adapter Preflight",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUT_DESCRIPTOR_ID,
    cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    resultDescriptorId: REFERENCE_GEOMETRY_IMPORT_RESULT_DESCRIPTOR_ID,
    discoveryCommand: "--check-adapters",
    relatedDiscoveryCommands: Object.freeze(["--list-adapters", "--list-translation-discovery", "--list-import-discovery"]),
    cliFlags: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_CLI_FLAGS]),
    requiredInputDescriptorIds: Object.freeze(["adapterConfigPath"]),
    optionalInputDescriptorIds: Object.freeze(["formatToken", "importOptions"]),
    externalAdapterFormatTokens: Object.freeze(externalAdapterTokens),
    adapterConfigInputDescriptorId: "adapterConfigPath",
    formatTokenInputDescriptorId: "formatToken",
    adapterNameOptionField: "adapterName",
    topLevelFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_TOP_LEVEL_FIELDS]),
    registryDecisionField: "adapterRegistryDecision",
    registryDecisionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_REGISTRY_DECISION_FIELDS]),
    preflightDecisionField: "adapterPreflightDecision",
    preflightDecisionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_DECISION_FIELDS]),
    preflightSummaryField: "adapterPreflightSummary",
    preflightSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_SUMMARY_FIELDS]),
    adapterTargetFormatCoverageField: "adapterTargetFormatCoverage",
    adapterTargetFormatCoverageFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_TARGET_FORMAT_COVERAGE_FIELDS]),
    requestedFields: Object.freeze(["format", "requestedFormat", "adapter"]),
    adapterEntryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_ENTRY_FIELDS]),
    requiredFileEntryFields: Object.freeze(["path", "resolvedPath", "exists", "fileSizeBytes", "fileModifiedTime", "fileStatFingerprint"]),
    requiredDirectoryEntryFields: Object.freeze(["path", "resolvedPath", "exists", "directoryModifiedTime", "directoryEntryCount", "directoryFileCount", "directoryDirectoryCount", "directoryFileSizeBytes", "directoryLatestModifiedTime", "directoryStatFingerprint"]),
    requiredCommandEntryFields: Object.freeze(["command", "found", "resolvedCommand", "commandFileSizeBytes", "commandFileModifiedTime", "commandFileStatFingerprint"]),
    requiredEnvEntryFields: Object.freeze(["name", "exists"]),
    diagnosticFields: Object.freeze(["level", "code", "message"]),
    diagnosticCodes: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_DIAGNOSTIC_CODES]),
    registryFingerprintField: "adapterRegistryFingerprint",
    preflightFingerprintField: "adapterPreflightFingerprint",
    sideEffects: Object.freeze({
      readsAdapterConfig: true,
      validatesAdapterConfig: true,
      resolvesAdapterCwd: true,
      checksMainAdapterCommand: true,
      checksRequiredFiles: true,
      checksRequiredDirectories: true,
      checksRequiredCommands: true,
      checksRequiredEnv: true,
      runsTranslator: false,
      launchesAdapters: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      writesFiles: false,
      writesProjectJson: false,
      writesReferenceManifest: false,
      writesReferenceChunks: false
    }),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportSourceDecision({
  fileName = "",
  path = "",
  formatToken = ""
} = {}) {
  const explicitToken = normalizeReferenceImportToken(formatToken);
  const fileToken = referenceGeometryImportFileExtension(fileName || path);
  const requestedToken = explicitToken || fileToken;
  const group = referenceGeometryImportGroupForToken(requestedToken);
  const tokenIsCliOnly = Boolean(requestedToken && REFERENCE_GEOMETRY_IMPORT_CLI_ONLY_TOKENS.includes(requestedToken));
  const sourceFilePickerEligible = Boolean(group && requestedToken && group.fileExtensions.includes(requestedToken));
  if (!group) {
    return Object.freeze({
      ok: false,
      reason: requestedToken ? "unsupported-format" : "missing-format",
      sourceRequestedFormat: requestedToken || "",
      sourceRequestedFormatFamily: "",
      sourceRequestedFormatAliases: Object.freeze([]),
      sourceRequestedFormatMatchesFamily: false,
      sourceFileExtension: fileToken || "",
      sourceFilePickerEligible: false,
      cliOnlyToken: tokenIsCliOnly,
      supportedAccept: REFERENCE_GEOMETRY_IMPORT_ACCEPT,
      safeFirstExecutionMode: "plan-only",
      recommendedNextAction: "choose-supported-reference-source"
    });
  }
  const importerTranslationMode = group.importerTranslationModesByToken[requestedToken] || group.defaultImporterTranslationMode;
  const externalAdapterRequired = importerTranslationMode === "external-adapter";
  const canonicalJsonPassthrough = importerTranslationMode === "canonical-json";
  return Object.freeze({
    ok: true,
    sourceRequestedFormat: requestedToken,
    sourceRequestedFormatFamily: group.canonicalFormat,
    sourceRequestedFormatAliases: Object.freeze([...(group.formatTokens || [])]),
    sourceRequestedFormatMatchesFamily: (group.formatTokens || []).includes(requestedToken),
    sourceFileExtension: fileToken || "",
    canonicalFormat: group.canonicalFormat,
    sourceFilePickerEligible,
    cliOnlyToken: tokenIsCliOnly,
    accept: group.accept,
    importerTranslationMode,
    builtInAvailable: group.builtInAvailable === true,
    externalAdapterRequired,
    adapterRequestCapable: group.adapterRequestCapable === true,
    canonicalJsonPassthrough,
    safeFirstExecutionMode: "plan-only",
    recommendedPrewriteValidationMode: "dry-run",
    targetPromotionExecutionMode: "import",
    safeGateOrder: Object.freeze([...(externalAdapterRequired ? REFERENCE_GEOMETRY_IMPORT_EXTERNAL_ADAPTER_GATE_ORDER : REFERENCE_GEOMETRY_IMPORT_SAFE_GATE_ORDER)]),
    recommendedNextAction: canonicalJsonPassthrough
      ? "plan-canonical-json-import"
      : externalAdapterRequired
        ? "select-adapter-config-or-check-adapter-preflight"
        : "run-plan-only"
  });
}

export function referenceGeometryImportFileExtension(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  const pathPart = text.split(/[\\\/]/).pop() || text;
  const cleanPathPart = pathPart.split(/[?#]/)[0] || pathPart;
  const dotIndex = cleanPathPart.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= cleanPathPart.length - 1) return "";
  return normalizeReferenceImportToken(cleanPathPart.slice(dotIndex + 1));
}

export function referenceGeometryImportReadinessPreview(input = {}) {
  const sourceDecision = referenceGeometryImportSourceDecision(input);
  const workflow = referenceGeometryImportWorkflowDescriptor();
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const results = referenceGeometryImportResultDescriptors();
  const adapterPreflight = referenceGeometryImportAdapterPreflightDescriptors();
  const stagePreviews = workflow.stages.map((stage) => referenceGeometryImportStagePreview(stage, sourceDecision));
  const recommendedWorkflowStage = referenceGeometryImportRecommendedWorkflowStage(sourceDecision);
  return Object.freeze({
    id: "referenceGeometryImportReadinessPreview",
    label: "Reference Geometry Import Readiness",
    icon: "reference-plane",
    kind: "Reference Import Readiness",
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    commandPlanDescriptorId: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    resultDescriptorId: results.id,
    adapterPreflightDescriptorId: adapterPreflight.id,
    sourceDecision,
    ok: sourceDecision.ok === true,
    supportedAccept: REFERENCE_GEOMETRY_IMPORT_ACCEPT,
    sourceRequestedFormat: sourceDecision.sourceRequestedFormat || "",
    sourceRequestedFormatFamily: sourceDecision.sourceRequestedFormatFamily || "",
    sourceRequestedFormatAliases: Object.freeze([...(sourceDecision.sourceRequestedFormatAliases || [])]),
    sourceRequestedFormatMatchesFamily: sourceDecision.sourceRequestedFormatMatchesFamily ?? null,
    canonicalFormat: sourceDecision.canonicalFormat || "",
    importerTranslationMode: sourceDecision.importerTranslationMode || "",
    externalAdapterRequired: sourceDecision.externalAdapterRequired === true,
    canonicalJsonPassthrough: sourceDecision.canonicalJsonPassthrough === true,
    safeFirstExecutionMode: sourceDecision.safeFirstExecutionMode || "plan-only",
    recommendedNextAction: sourceDecision.recommendedNextAction || "choose-supported-reference-source",
    recommendedWorkflowStage,
    workflowStatusField: workflow.workflowStatusField,
    noProjectOrTargetWriteStages: Object.freeze([...workflow.noProjectOrTargetWriteStages]),
    promotedWriteStages: Object.freeze([...workflow.promotedWriteStages]),
    stagePreviews: Object.freeze(stagePreviews)
  });
}

export function referenceGeometryImportActionPreview(input = {}) {
  const readiness = referenceGeometryImportReadinessPreview(input);
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const results = referenceGeometryImportResultDescriptors();
  const adapterPreflight = referenceGeometryImportAdapterPreflightDescriptors();
  const stageActions = readiness.stagePreviews.map((stage) => referenceGeometryImportStageActionPreview(stage, readiness));
  const primaryStageId = referenceGeometryImportPrimaryActionStage(stageActions, readiness);
  const primaryAction = stageActions.find((stage) => stage.id === primaryStageId) || null;
  return Object.freeze({
    id: "referenceGeometryImportActionPreview",
    label: "Reference Geometry Import Actions",
    icon: "reference-plane",
    kind: "Reference Import Actions",
    readinessPreviewId: readiness.id,
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    commandPlanDescriptorId: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    resultDescriptorId: results.id,
    adapterPreflightDescriptorId: adapterPreflight.id,
    stageRequiredCliFlags: freezeRecordOfArrays(cliBlueprints.stageRequiredCliFlags),
    successEnvelopeFields: Object.freeze([...results.successEnvelopeFields]),
    errorEnvelopeFields: Object.freeze([...results.errorEnvelopeFields]),
    failureDecisionField: results.failureDecisionField,
    errorPrimaryFields: Object.freeze([...results.errorPrimaryFields]),
    primaryRequiredInputDescriptorIds: Object.freeze([...(primaryAction?.requiredInputDescriptorIds || [])]),
    primaryRequiredCliFlags: Object.freeze([...(primaryAction?.requiredCliFlags || [])]),
    ok: readiness.ok === true,
    supportedAccept: readiness.supportedAccept,
    sourceDecision: readiness.sourceDecision,
    sourceRequestedFormat: readiness.sourceRequestedFormat || "",
    sourceRequestedFormatFamily: readiness.sourceRequestedFormatFamily || "",
    sourceRequestedFormatAliases: Object.freeze([...(readiness.sourceRequestedFormatAliases || [])]),
    sourceRequestedFormatMatchesFamily: readiness.sourceRequestedFormatMatchesFamily ?? null,
    recommendedWorkflowStage: readiness.recommendedWorkflowStage,
    primaryStageId,
    primaryActionToken: primaryAction?.actionToken || "choose-supported-reference-source",
    workflowStatusField: readiness.workflowStatusField,
    noProjectOrTargetWriteStages: Object.freeze([...readiness.noProjectOrTargetWriteStages]),
    promotedWriteStages: Object.freeze([...readiness.promotedWriteStages]),
    appRuntimeBoundary: Object.freeze({
      importsTranslatorModules: false,
      readsSourceFiles: false,
      writesAdapterRequests: false,
      writesProjectJson: false,
      writesReferenceFiles: false,
      launchesExternalAdapters: false
    }),
    stageActions: Object.freeze(stageActions)
  });
}

export function referenceGeometryImportCommandPlanDescriptor() {
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const actionPreview = referenceGeometryImportActionPreview();
  const valueFlags = Object.values(REFERENCE_GEOMETRY_IMPORT_CLI_FLAG_BINDINGS)
    .filter((flag) => !REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_NO_VALUE_FLAGS.includes(flag));
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    label: "Reference Geometry Import Command Plan",
    icon: "reference-plane",
    kind: "Reference Import Command Plan",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    actionPreviewDescriptorId: actionPreview.id,
    workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    runtimeCommand: "node",
    cliEntrypoint: cliBlueprints.cliEntrypoint,
    commandPlanFunction: "referenceGeometryImportCommandPlan",
    commandPlanFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_FIELDS]),
    stageIds: Object.freeze([...cliBlueprints.stageIds]),
    stageRequiredInputDescriptorIds: freezeRecordOfArrays(cliBlueprints.stageRequiredInputDescriptorIds),
    stageArtifactDescriptorIds: freezeRecordOfArrays(cliBlueprints.stageArtifactDescriptorIds),
    stageRequiredCliFlags: freezeRecordOfArrays(cliBlueprints.stageRequiredCliFlags),
    stageOptionalCliFlags: freezeRecordOfArrays(cliBlueprints.stageOptionalCliFlags),
    cliFlagBindings: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_CLI_FLAG_BINDINGS }),
    valueCliFlags: Object.freeze(valueFlags),
    noValueCliFlags: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_NO_VALUE_FLAGS]),
    defaultJson: true,
    shellStringAvailable: false,
    requiresWorkspaceCommandHost: true,
    appRuntimeExecutesCli: false,
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportCommandPlan(input = {}) {
  const values = referenceGeometryImportCommandInputValues(input);
  const previewInput = {
    ...input,
    path: cleanString(input.path || values.inputPath),
    formatToken: values.formatToken || cleanString(input.formatToken || input.format)
  };
  const actionPreview = referenceGeometryImportActionPreview(previewInput);
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const descriptor = referenceGeometryImportCommandPlanDescriptor();
  const requestedStageId = cleanString(input.stageId || input.workflowStage || input.referenceImportStage || actionPreview.primaryStageId || "source-discovery");
  const stageBlueprint = referenceGeometryImportCliBlueprintForStage(requestedStageId);
  const stageAction = (actionPreview.stageActions || []).find((stage) => stage.id === requestedStageId) || null;
  const requiredInputDescriptorIds = Object.freeze([...(stageBlueprint?.requiredInputDescriptorIds || [])]);
  const missingInputDescriptorIds = Object.freeze(
    requiredInputDescriptorIds.filter((id) => !referenceGeometryImportCommandValueProvided(values[id]))
  );
  const invalidImportOptionFields = Object.freeze(referenceGeometryImportInvalidImportOptionFields(values));
  const invalidInputDescriptorIds = Object.freeze(uniqueStrings([
    stageBlueprint ? "" : "stageId",
    referenceGeometryImportFormatTokenOptionInvalid(values.formatToken) ? "formatToken" : "",
    invalidImportOptionFields.length ? "importOptions" : ""
  ]));
  const canBuildArgv = Boolean(
    stageBlueprint
    && missingInputDescriptorIds.length === 0
    && invalidInputDescriptorIds.length === 0
    && (
      actionPreview.ok === true
      || requestedStageId === "source-discovery"
      || requestedStageId === "adapter-preflight"
      || requestedStageId === "check-references"
    )
  );
  const cliArgsTemplate = stageBlueprint
    ? referenceGeometryImportCliArgs(stageBlueprint, values, { template: true })
    : Object.freeze([]);
  const cliArgs = canBuildArgv
    ? referenceGeometryImportCliArgs(stageBlueprint, values, { template: false })
    : Object.freeze([]);
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_DESCRIPTOR_ID,
    label: "Reference Geometry Import Command Plan",
    icon: "reference-plane",
    kind: "Reference Import Command Plan",
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: descriptor.inputDescriptorId,
    cliBlueprintId: cliBlueprints.id,
    actionPreviewDescriptorId: actionPreview.id,
    runtimeCommand: descriptor.runtimeCommand,
    cliEntrypoint: descriptor.cliEntrypoint,
    stageId: requestedStageId,
    stageKnown: Boolean(stageBlueprint),
    executionMode: stageBlueprint?.executionMode || null,
    actionToken: stageAction?.actionToken || "",
    actionState: stageAction?.actionState || "",
    ok: canBuildArgv,
    canBuildArgv,
    sourceDecision: actionPreview.sourceDecision,
    recommendedWorkflowStage: actionPreview.recommendedWorkflowStage,
    primaryStageId: actionPreview.primaryStageId,
    primaryActionToken: actionPreview.primaryActionToken,
    missingInputDescriptorIds,
    invalidInputDescriptorIds,
    invalidImportOptionFields,
    requiredInputDescriptorIds,
    artifactDescriptorIds: Object.freeze([...(stageBlueprint?.artifactDescriptorIds || [])]),
    requiredCliFlags: Object.freeze([...(stageBlueprint?.requiredCliFlags || [])]),
    optionalCliFlags: Object.freeze([...(stageBlueprint?.optionalCliFlags || [])]),
    cliArgs,
    cliArgsTemplate,
    argv: Object.freeze(canBuildArgv ? [descriptor.runtimeCommand, ...cliArgs] : []),
    argvTemplate: Object.freeze([descriptor.runtimeCommand, ...cliArgsTemplate]),
    shellStringAvailable: false,
    requiresWorkspaceCommandHost: true,
    appRuntimeExecutesCli: false,
    noProjectOrTargetWrites: stageAction?.noProjectOrTargetWrites === true,
    promotedWriteStage: stageAction?.promotedWriteStage === true,
    writesAdapterRequest: stageAction?.writesAdapterRequest === true,
    writesProjectJson: stageAction?.writesProjectJson === true,
    writesReferenceFiles: stageAction?.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter: stageAction?.mayLaunchExternalAdapter === true,
    requiresWriteConfirmation: stageAction?.requiresWriteConfirmation === true,
    sideEffectClass: stageAction?.sideEffectClass || stageBlueprint?.sideEffectClass || "",
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportWorkspaceRequestDescriptor() {
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const commandPlan = referenceGeometryImportCommandPlanDescriptor();
  const results = referenceGeometryImportResultDescriptors();
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    label: "Reference Geometry Import Workspace Request",
    icon: "reference-plane",
    kind: "Reference Import Workspace Request",
    requestKind: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_KIND,
    commandId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_COMMAND_ID,
    workflowDescriptorId: "referenceGeometryImportWorkflow",
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    commandPlanDescriptorId: commandPlan.id,
    resultDescriptorId: results.id,
    workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    requestBuilderFunction: "referenceGeometryImportWorkspaceRequest",
    requestFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_FIELDS]),
    resultRoutingFields: Object.freeze([
      "successEnvelopeFields",
      "errorEnvelopeFields",
      "workflowStatusField",
      "failureDecisionField",
      "stageDecisionField",
      "stageFingerprintFields",
      "outputFingerprintAvailability"
    ]),
    stageIds: Object.freeze([...cliBlueprints.stageIds]),
    requiresWriteConfirmationStages: Object.freeze(
      cliBlueprints.stageBlueprints
        .filter((stage) => stage.requiresWriteConfirmation)
        .map((stage) => stage.stageId)
    ),
    shellStringAvailable: false,
    appRuntimeExecutesCli: false,
    requiresWorkspaceCommandHost: true,
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_RUNTIME_BOUNDARY }),
    commandHostBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_HOST_BOUNDARY })
  });
}

export function referenceGeometryImportWorkspaceRequest(input = {}) {
  const plan = referenceGeometryImportCommandPlan(input);
  const descriptor = referenceGeometryImportWorkspaceRequestDescriptor();
  const resultRouting = referenceGeometryImportWorkspaceResultRouting(plan.stageId);
  const writeConfirmed = input.writeConfirmed === true;
  const canSubmitToCommandHost = Boolean(plan.canBuildArgv && (!plan.requiresWriteConfirmation || writeConfirmed));
  const blockedReason = referenceGeometryImportWorkspaceRequestBlockedReason(plan, { writeConfirmed });
  const requestPayloadForId = {
    requestKind: descriptor.requestKind,
    commandId: descriptor.commandId,
    stageId: plan.stageId,
    executionMode: plan.executionMode,
    argv: plan.argv,
    sideEffectClass: plan.sideEffectClass,
    writeConfirmed
  };
  const requestId = referenceGeometryImportRequestId(input.requestId, requestPayloadForId);
  return Object.freeze({
    id: descriptor.id,
    requestId,
    requestKind: descriptor.requestKind,
    commandId: descriptor.commandId,
    label: "Reference Geometry Import Workspace Request",
    icon: "reference-plane",
    kind: "Reference Import Workspace Request",
    workflowDescriptorId: descriptor.workflowDescriptorId,
    inputDescriptorId: descriptor.inputDescriptorId,
    cliBlueprintId: descriptor.cliBlueprintId,
    commandPlanDescriptorId: descriptor.commandPlanDescriptorId,
    resultDescriptorId: descriptor.resultDescriptorId,
    stageId: plan.stageId,
    stageKnown: plan.stageKnown,
    executionMode: plan.executionMode,
    actionToken: plan.actionToken,
    actionState: plan.actionState,
    ok: canSubmitToCommandHost,
    canBuildArgv: plan.canBuildArgv,
    canSubmitToCommandHost,
    blockedReason,
    safeNextAction: canSubmitToCommandHost ? "submit-workspace-command" : referenceGeometryImportWorkspaceSafeNextAction(blockedReason),
    missingInputDescriptorIds: Object.freeze([...plan.missingInputDescriptorIds]),
    invalidInputDescriptorIds: Object.freeze([...(plan.invalidInputDescriptorIds || [])]),
    invalidImportOptionFields: Object.freeze([...(plan.invalidImportOptionFields || [])]),
    requiredInputDescriptorIds: Object.freeze([...plan.requiredInputDescriptorIds]),
    requiredCliFlags: Object.freeze([...plan.requiredCliFlags]),
    optionalCliFlags: Object.freeze([...plan.optionalCliFlags]),
    argv: Object.freeze([...plan.argv]),
    argvTemplate: Object.freeze([...plan.argvTemplate]),
    cliArgs: Object.freeze([...plan.cliArgs]),
    cliArgsTemplate: Object.freeze([...plan.cliArgsTemplate]),
    shellStringAvailable: false,
    resultRouting,
    noProjectOrTargetWrites: plan.noProjectOrTargetWrites,
    promotedWriteStage: plan.promotedWriteStage,
    writesAdapterRequest: plan.writesAdapterRequest,
    writesProjectJson: plan.writesProjectJson,
    writesReferenceFiles: plan.writesReferenceFiles,
    mayLaunchExternalAdapter: plan.mayLaunchExternalAdapter,
    requiresWriteConfirmation: plan.requiresWriteConfirmation,
    writeConfirmed,
    sideEffectClass: plan.sideEffectClass,
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_RUNTIME_BOUNDARY }),
    commandHostBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_HOST_BOUNDARY })
  });
}

export function referenceGeometryImportWorkspaceResponseDescriptor() {
  const requestDescriptor = referenceGeometryImportWorkspaceRequestDescriptor();
  const results = referenceGeometryImportResultDescriptors();
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    label: "Reference Geometry Import Workspace Response",
    icon: "reference-plane",
    kind: "Reference Import Workspace Response",
    requestDescriptorId: requestDescriptor.id,
    requestKind: requestDescriptor.requestKind,
    commandId: requestDescriptor.commandId,
    workflowDescriptorId: requestDescriptor.workflowDescriptorId,
    resultDescriptorId: results.id,
    sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    responseBuilderFunction: "referenceGeometryImportWorkspaceResponse",
    responseFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_FIELDS]),
    responseStatuses: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES]),
    referenceSourceSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_SOURCE_SUMMARY_FIELDS]),
    adapterPreflightSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT_SUMMARY_FIELDS]),
    referencePlanSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_PLAN_SUMMARY_FIELDS]),
    referenceAdapterRequestSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_ADAPTER_REQUEST_SUMMARY_FIELDS]),
    referenceOutputSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_OUTPUT_SUMMARY_FIELDS]),
    referencePromotionSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_PROMOTION_SUMMARY_FIELDS]),
    referenceAuditSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_AUDIT_SUMMARY_FIELDS]),
    referenceFailureSummaryFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_REFERENCE_FAILURE_SUMMARY_FIELDS]),
    resultRoutingFields: Object.freeze([...requestDescriptor.resultRoutingFields]),
    parsePolicy: Object.freeze({
      acceptsParsedJsonOnly: true,
      parsesJsonStdoutText: false,
      parsesHumanOutput: false,
      requiresOkBoolean: true,
      preservesExitCode: true,
      preservesStderr: true
    }),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportWorkspaceResponse(input = {}) {
  const request = plainObject(input.request) ? input.request : (plainObject(input.workspaceRequest) ? input.workspaceRequest : {});
  const resultJson = referenceGeometryImportWorkspaceParsedResult(input);
  const stageId = referenceGeometryImportKnownStageId(
    input.stageId
    || request.stageId
    || resultJson?.referenceImportWorkflowStatus?.workflowStage
    || resultJson?.referenceImportFailureDecision?.failedWorkflowStage
  );
  const routing = referenceGeometryImportWorkspaceResultRouting(stageId);
  const exitCode = referenceGeometryImportExitCode(input.exitCode);
  const hostError = cleanString(input.hostError || input.error || "");
  const requestBlocked = request.canSubmitToCommandHost === false || Boolean(cleanString(request.blockedReason));
  const primaryError = referenceGeometryImportPrimaryError(resultJson);
  const responseStatus = referenceGeometryImportWorkspaceResponseStatus({
    requestBlocked,
    hostError,
    resultJson,
    exitCode
  });
  const stageDecision = referenceGeometryImportWorkspaceStageDecision(
    referenceGeometryImportObjectField(resultJson, routing.stageDecisionField)
      || referenceGeometryImportObjectField(primaryError, routing.stageDecisionField),
    stageId
  );
  const failureDecision = referenceGeometryImportWorkspaceFailureDecision(
    referenceGeometryImportObjectField(resultJson, routing.failureDecisionField)
  );
  const workflowStatus = referenceGeometryImportWorkspaceWorkflowStatus(
    referenceGeometryImportObjectField(resultJson, routing.workflowStatusField)
  );
  const safeNextAction = referenceGeometryImportWorkspaceResponseSafeNextAction({
    responseStatus,
    request,
    stageId,
    stageDecision,
    failureDecision
  });
  const recommendedNextAction = referenceGeometryImportWorkspaceResponseRecommendedNextAction({
    safeNextAction,
    stageDecision,
    failureDecision
  });
  const referenceSourceSummary = referenceGeometryImportReferenceSourceSummary(resultJson, stageId);
  const adapterPreflightSummary = referenceGeometryImportAdapterPreflightSummary(resultJson, stageId);
  const referencePlanSummary = referenceGeometryImportReferencePlanSummary(resultJson, stageId);
  const referenceAdapterRequestSummary = referenceGeometryImportReferenceAdapterRequestSummary(resultJson, stageId);
  const referenceOutputSummary = referenceGeometryImportReferenceOutputSummary(resultJson, stageId);
  const referencePromotionSummary = referenceGeometryImportReferencePromotionSummary(resultJson, stageId);
  const referenceAuditSummary = referenceGeometryImportReferenceAuditSummary(resultJson, stageId);
  const referenceFailureSummary = referenceGeometryImportReferenceFailureSummary(resultJson, stageId, responseStatus, safeNextAction, recommendedNextAction);
  const safeRequestId = referenceGeometryImportRequestId(request.requestId || input.requestId, {
    stageId,
    responseStatus
  });
  const responsePayloadForId = {
    requestId: safeRequestId,
    stageId,
    exitCode,
    responseStatus,
    resultOk: resultJson?.ok === true
  };
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    responseId: referenceGeometryImportResponseId(input.responseId, responsePayloadForId),
    requestId: safeRequestId,
    requestKind: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_KIND,
    commandId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_COMMAND_ID,
    label: "Reference Geometry Import Workspace Response",
    icon: "reference-plane",
    kind: "Reference Import Workspace Response",
    requestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    resultDescriptorId: REFERENCE_GEOMETRY_IMPORT_RESULT_DESCRIPTOR_ID,
    stageId,
    executionMode: referenceGeometryImportExecutionMode(input.executionMode || request.executionMode || resultJson?.referenceImportExecutionMode) || null,
    exitCode,
    responseStatus,
    ok: responseStatus === "succeeded",
    resultOk: resultJson?.ok === true,
    resultJsonAccepted: plainObject(resultJson),
    resultRouting: routing,
    stageDecision,
    failureDecision,
    workflowStatus,
    fingerprintSummary: referenceGeometryImportWorkspaceFingerprintSummary(resultJson, routing),
    referenceSourceSummary,
    adapterPreflightSummary,
    referencePlanSummary,
    referenceAdapterRequestSummary,
    referenceOutputSummary,
    referencePromotionSummary,
    referenceAuditSummary,
    referenceFailureSummary,
    safeNextAction,
    recommendedNextAction,
    humanOutputParsed: false,
    stdoutTextIgnored: Boolean(cleanString(input.stdoutText || input.stdout)),
    stderrTextIgnored: Boolean(cleanString(input.stderrText || input.stderr)),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportWorkspaceResponseEnvelope(input = {}) {
  if (!plainObject(input)) return null;
  const stageId = referenceGeometryImportKnownStageId(input.stageId);
  const resultRouting = referenceGeometryImportWorkspaceResultRouting(stageId);
  const responseStatus = referenceGeometryImportWorkspaceResponseStatusToken(input.responseStatus);
  const safeNextAction = referenceGeometryImportRoutingActionToken(input.safeNextAction);
  const recommendedNextAction = referenceGeometryImportFirstRoutingActionToken(input.recommendedNextAction, safeNextAction);
  const safeRequestId = referenceGeometryImportRequestId(input.requestId, {
    stageId,
    responseStatus
  });
  const responsePayloadForId = {
    requestId: safeRequestId,
    stageId,
    exitCode: referenceGeometryImportExitCode(input.exitCode),
    responseStatus,
    resultOk: input.resultOk === true
  };
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID,
    responseId: referenceGeometryImportResponseId(input.responseId, responsePayloadForId),
    requestId: safeRequestId,
    requestKind: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_KIND,
    commandId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_COMMAND_ID,
    label: "Reference Geometry Import Workspace Response",
    icon: "reference-plane",
    kind: "Reference Import Workspace Response",
    requestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST_DESCRIPTOR_ID,
    resultDescriptorId: REFERENCE_GEOMETRY_IMPORT_RESULT_DESCRIPTOR_ID,
    stageId,
    executionMode: referenceGeometryImportExecutionMode(input.executionMode) || null,
    exitCode: responsePayloadForId.exitCode,
    responseStatus,
    ok: input.ok === true,
    resultOk: input.resultOk === true,
    resultJsonAccepted: input.resultJsonAccepted === true,
    resultRouting,
    stageDecision: referenceGeometryImportWorkspaceStageDecision(input.stageDecision, stageId),
    failureDecision: referenceGeometryImportWorkspaceFailureDecision(input.failureDecision),
    workflowStatus: referenceGeometryImportWorkspaceWorkflowStatus(input.workflowStatus),
    fingerprintSummary: referenceGeometryImportWorkspaceFingerprintSummary(input.fingerprintSummary, resultRouting),
    referenceSourceSummary: referenceGeometryImportReferenceSourceSummary(input.referenceSourceSummary, stageId),
    adapterPreflightSummary: referenceGeometryImportAdapterPreflightSummary(input.adapterPreflightSummary, stageId),
    referencePlanSummary: referenceGeometryImportReferencePlanSummary(input.referencePlanSummary, stageId),
    referenceAdapterRequestSummary: referenceGeometryImportReferenceAdapterRequestSummary(input.referenceAdapterRequestSummary, stageId),
    referenceOutputSummary: referenceGeometryImportReferenceOutputSummary(input.referenceOutputSummary, stageId),
    referencePromotionSummary: referenceGeometryImportReferencePromotionSummary(input.referencePromotionSummary, stageId),
    referenceAuditSummary: referenceGeometryImportReferenceAuditSummary(input.referenceAuditSummary, stageId),
    referenceFailureSummary: referenceGeometryImportReferenceFailureSummary(input.referenceFailureSummary, stageId, responseStatus, safeNextAction, recommendedNextAction),
    safeNextAction,
    recommendedNextAction,
    humanOutputParsed: false,
    stdoutTextIgnored: input.stdoutTextIgnored === true,
    stderrTextIgnored: input.stderrTextIgnored === true,
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportSessionDescriptor() {
  const workflow = referenceGeometryImportWorkflowDescriptor();
  const inputs = referenceGeometryImportInputDescriptors();
  const cliBlueprints = referenceGeometryImportCliBlueprints();
  const actionPreview = referenceGeometryImportActionPreview();
  const commandPlan = referenceGeometryImportCommandPlanDescriptor();
  const workspaceRequest = referenceGeometryImportWorkspaceRequestDescriptor();
  const workspaceResponse = referenceGeometryImportWorkspaceResponseDescriptor();
  return Object.freeze({
    id: REFERENCE_GEOMETRY_IMPORT_SESSION_DESCRIPTOR_ID,
    label: "Reference Geometry Import Session",
    icon: "reference-plane",
    kind: "Reference Import Session",
    workflowDescriptorId: workflow.id,
    inputDescriptorId: inputs.id,
    inputDescriptorIds: Object.freeze([...inputs.descriptorIds]),
    cliBlueprintId: cliBlueprints.id,
    actionPreviewDescriptorId: actionPreview.id,
    commandPlanDescriptorId: commandPlan.id,
    workspaceRequestDescriptorId: workspaceRequest.id,
    workspaceResponseDescriptorId: workspaceResponse.id,
    sessionBuilderFunction: "referenceGeometryImportSessionState",
    sessionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SESSION_FIELDS]),
    stageStateFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SESSION_STAGE_STATE_FIELDS]),
    stageIds: Object.freeze([...workflow.workflowStages]),
    completedWorkflowStageSources: Object.freeze([
      "input.completedWorkflowStages",
      "workspaceResponse.workflowStatus.completedWorkflowStages",
      "workspaceResponse.succeededStageId"
    ]),
    failedWorkflowStageSources: Object.freeze([
      "workspaceResponse.failureDecision.failedWorkflowStage",
      "workspaceResponse.workflowStatus.failedWorkflowStage",
      "workspaceResponse.stageId"
    ]),
    dryRunRequiredBeforeImport: true,
    nextRequestPolicy: Object.freeze({
      buildsWorkspaceRequest: true,
      submitsWorkspaceRequest: false,
      blocksImportBeforeDryRun: true,
      acceptsParsedWorkspaceResponseOnly: true,
      parsesHumanOutput: false
    }),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_SESSION_RUNTIME_BOUNDARY })
  });
}

export function referenceGeometryImportSessionState(input = {}) {
  const descriptor = referenceGeometryImportSessionDescriptor();
  const values = referenceGeometryImportCommandInputValues(input);
  const previewInput = {
    ...input,
    path: cleanString(input.path || values.inputPath),
    formatToken: values.formatToken || cleanString(input.formatToken || input.format)
  };
  const actionPreview = referenceGeometryImportActionPreview(previewInput);
  const lastWorkspaceResponse = referenceGeometryImportSessionLastResponse(input);
  const completedWorkflowStages = referenceGeometryImportSessionCompletedStages(input, lastWorkspaceResponse);
  const failedWorkflowStage = referenceGeometryImportSessionFailedStage(lastWorkspaceResponse);
  const retryWorkflowStage = referenceGeometryImportSessionRetryStage(lastWorkspaceResponse);
  const requestedStageId = referenceGeometryImportSessionRequestedStage(input);
  const currentStageId = referenceGeometryImportSessionCurrentStage({
    requestedStageId,
    actionPreview,
    lastWorkspaceResponse,
    failedWorkflowStage,
    retryWorkflowStage
  });
  const importAllowed = completedWorkflowStages.includes("dry-run");
  const dryRunGateBlocked = currentStageId === "import" && importAllowed !== true;
  const nextWorkspaceRequest = currentStageId
    ? referenceGeometryImportWorkspaceRequest({ ...input, stageId: currentStageId })
    : null;
  const requestBlockedReason = cleanString(nextWorkspaceRequest?.blockedReason);
  const blockedReason = dryRunGateBlocked ? "dry-run-required-before-import" : requestBlockedReason;
  const canSubmitNextRequest = Boolean(nextWorkspaceRequest?.canSubmitToCommandHost && !dryRunGateBlocked);
  const invalidInputDescriptorIds = Object.freeze([...(nextWorkspaceRequest?.invalidInputDescriptorIds || [])]);
  const invalidImportOptionFields = Object.freeze([...(nextWorkspaceRequest?.invalidImportOptionFields || [])]);
  const nextActionToken = referenceGeometryImportSessionNextActionToken({
    actionPreview,
    nextWorkspaceRequest,
    lastWorkspaceResponse,
    canSubmitNextRequest,
    dryRunGateBlocked,
    blockedReason
  });
  const stageStates = referenceGeometryImportSessionStageStates({
    input,
    actionPreview,
    completedWorkflowStages,
    failedWorkflowStage,
    currentStageId
  });
  const sessionPayloadForId = {
    currentStageId,
    completedWorkflowStages,
    failedWorkflowStage,
    retryWorkflowStage,
    lastResponseStatus: lastWorkspaceResponse?.responseStatus || "",
    blockedReason,
    canSubmitNextRequest,
    invalidInputDescriptorIds,
    invalidImportOptionFields
  };
  return Object.freeze({
    id: descriptor.id,
    sessionId: referenceGeometryImportSessionId(input.sessionId, sessionPayloadForId),
    label: descriptor.label,
    icon: descriptor.icon,
    kind: descriptor.kind,
    workflowDescriptorId: descriptor.workflowDescriptorId,
    inputDescriptorId: descriptor.inputDescriptorId,
    cliBlueprintId: descriptor.cliBlueprintId,
    actionPreviewDescriptorId: descriptor.actionPreviewDescriptorId,
    commandPlanDescriptorId: descriptor.commandPlanDescriptorId,
    workspaceRequestDescriptorId: descriptor.workspaceRequestDescriptorId,
    workspaceResponseDescriptorId: descriptor.workspaceResponseDescriptorId,
    sourceDecision: actionPreview.sourceDecision,
    sourceRequestedFormat: actionPreview.sourceRequestedFormat || "",
    sourceRequestedFormatFamily: actionPreview.sourceRequestedFormatFamily || "",
    sourceRequestedFormatAliases: Object.freeze([...(actionPreview.sourceRequestedFormatAliases || [])]),
    sourceRequestedFormatMatchesFamily: actionPreview.sourceRequestedFormatMatchesFamily ?? null,
    ok: actionPreview.ok === true,
    currentStageId,
    recommendedWorkflowStage: currentStageId,
    nextActionToken,
    completedWorkflowStages: Object.freeze([...completedWorkflowStages]),
    failedWorkflowStage,
    retryWorkflowStage,
    lastResponseStatus: lastWorkspaceResponse?.responseStatus || "",
    lastResponseSafeNextAction: referenceGeometryImportRoutingActionToken(lastWorkspaceResponse?.safeNextAction),
    lastWorkspaceResponse,
    stageStates,
    nextWorkspaceRequest,
    canSubmitNextRequest,
    blockedReason,
    invalidInputDescriptorIds,
    invalidImportOptionFields,
    importAllowed,
    requiresWriteConfirmation: nextWorkspaceRequest?.requiresWriteConfirmation === true,
    writeConfirmed: nextWorkspaceRequest?.writeConfirmed === true,
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_SESSION_RUNTIME_BOUNDARY })
  });
}

export function projectReferenceGeometryFileSources(project = {}) {
  const assets = project?.referenceGeometry?.assets;
  if (!assets || typeof assets !== "object" || Array.isArray(assets)) return [];
  return Object.entries(assets)
    .filter(([assetId, asset]) => isSafeProjectReferenceGeometryAssetId(assetId) && isSafeProjectReferenceGeometryPath(asset?.path))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([assetId, asset]) => ({
      id: `reference-${assetId}`,
      icon: "reference-plane",
      label: assetId,
      kind: "Reference",
      meta: projectReferenceGeometryPointerMeta(asset),
      status: projectReferenceGeometryPointerStatus(asset),
      path: asset.path
    }));
}

export function projectReferenceGeometryRuntimeFileSources(project = {}, {
  loadedAssets = [],
  diagnostics = []
} = {}) {
  const loadedById = referenceGeometryRuntimeLoadedAssetsById(loadedAssets);
  const diagnosticsById = referenceGeometryDiagnosticsByAsset(diagnostics);
  return projectReferenceGeometryFileSources(project).map((source) => {
    const assetId = source.id.replace(/^reference-/, "");
    const loaded = loadedById.get(assetId) || null;
    const assetDiagnostics = diagnosticsById.get(assetId) || [];
    const chunkCounts = referenceGeometryRuntimeChunkCounts(loaded);
    const sourceMetadata = referenceGeometryRuntimeSourceFormatMetadata(loaded?.data?.asset?.source);
    return {
      ...source,
      label: referenceGeometryRuntimeAssetLabel(loaded, source.label),
      status: referenceGeometryRuntimeSourceStatus(loaded, assetDiagnostics),
      meta: referenceGeometryRuntimeSourceMeta(source.meta, loaded, assetDiagnostics, sourceMetadata),
      ...sourceMetadata,
      ...chunkCounts
    };
  });
}

function referenceGeometryRuntimeLoadedAssetsById(loadedAssets = []) {
  const loadedById = new Map();
  for (const entry of Array.isArray(loadedAssets) ? loadedAssets : []) {
    const assetId = referenceGeometryRuntimeLoadedAssetId(entry);
    if (assetId && !loadedById.has(assetId)) loadedById.set(assetId, entry);
  }
  return loadedById;
}

function referenceGeometryRuntimeLoadedAssetId(entry) {
  if (!plainObject(entry)) return "";
  const assetId = cleanString(entry.id);
  const manifestAssetId = cleanString(entry.data?.asset?.id);
  const sourceMetadata = referenceGeometryRuntimeSourceFormatMetadata(entry.data?.asset?.source);
  if (!isSafeProjectReferenceGeometryAssetId(assetId) || manifestAssetId !== assetId || !sourceMetadata.sourceFormat) return "";
  return assetId;
}

function referenceGeometryRuntimeAssetLabel(loaded, fallback = "") {
  const label = cleanString(loaded?.data?.asset?.name);
  if (!label || REFERENCE_RUNTIME_TEXT_PATH_PATTERN.test(label)) return fallback;
  return label.slice(0, 120);
}

export function isSafeProjectReferenceGeometryAssetId(value) {
  const text = cleanString(value);
  return REFERENCE_SOURCE_ID_PATTERN.test(text) && !RESERVED_REFERENCE_SOURCE_IDS.has(text);
}

export function isSafeProjectReferenceGeometryPath(pathValue) {
  if (typeof pathValue !== "string") return false;
  if (!pathValue || pathValue.trim() !== pathValue) return false;
  if (/[\\?#]|[\u0000-\u001f\u007f]/.test(pathValue)) return false;
  const segments = pathValue.split("/");
  if (segments.length < 3 || segments[0] !== ".." || segments[1] !== "references") return false;
  return segments.slice(2).every(safeDecodedPathSegment);
}

export function projectReferenceGeometryPointerMeta(asset = {}) {
  const parts = [
    projectReferenceGeometryPointerStatus(asset),
    referenceSnapLabel(asset),
    referenceDisplayLabel(asset),
    referenceTransformLabel(asset)
  ];
  return uniqueStrings(parts).join(", ");
}

export function projectReferenceGeometryPointerStatus(asset = {}) {
  if (asset?.visible === false || asset?.display?.visible === false) return "hidden";
  return "visible";
}

export function dataLibraryDescriptor(libraryId, config = {}, loaded = {}) {
  const spec = dataLibraryFallbackSpec(libraryId);
  const count = finiteCount(loaded?.count);
  const unit = cleanString(loaded?.unit || "entries");
  const loadedName = cleanString(loaded?.name);
  const configuredLibraryId = cleanString(config?.libraryId);
  const libraryName = cleanString(loadedName || configuredLibraryId || "");
  const version = cleanString(config?.version);
  const path = cleanString(config?.path);
  const displayPath = dataSourceDisplayPath(path);
  const status = count !== null ? "loaded" : (config ? "declared" : "default");
  const meta = count !== null ? `${count} ${unit}` : (version || status);
  const keywords = uniqueStrings([
    spec.id,
    spec.label,
    spec.entryKey,
    libraryName,
    configuredLibraryId,
    version,
    path,
    displayPath,
    status,
    meta
  ]);
  return Object.freeze({
    id: spec.id,
    label: spec.label,
    icon: spec.icon,
    entryKey: spec.entryKey,
    value: libraryName || "-",
    meta,
    status,
    version,
    configuredLibraryId,
    path,
    displayPath,
    count,
    unit,
    keywords,
    description: [
      libraryName || `${spec.label} library`,
      configuredLibraryId && configuredLibraryId !== libraryName ? configuredLibraryId : "",
      meta,
      displayPath
    ].filter(Boolean).join(" - "),
    sourceLabel: `${spec.label} library`,
    sourceKind: "Library",
    searchText: keywords.join(" ")
  });
}

export function dataSourceDisplayPath(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return text;
  try {
    const url = new URL(text, "file:///viewer/");
    return decodeURIComponent(url.pathname).replace(/^\/+/, "") || text;
  } catch {
    return text;
  }
}

function library(id, label, icon, entryKey) {
  return Object.freeze({ id, label, icon, entryKey });
}

function dataLibraryOrder(id) {
  return LIBRARY_ORDER_BY_ID.get(id) ?? 1000;
}

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function referenceGeometryImportGroup(group = {}) {
  const canonicalFormat = cleanString(group.canonicalFormat);
  const fileExtensions = uniqueStrings(group.fileExtensions || []).map((value) => value.toLowerCase());
  const acceptExtensions = uniqueStrings(group.acceptExtensions || fileExtensions.map((extension) => `.${extension}`))
    .map((value) => value.toLowerCase());
  const formatTokens = uniqueStrings(group.formatTokens || [canonicalFormat, ...fileExtensions])
    .map((value) => value.toLowerCase());
  const cliOnlyTokens = uniqueStrings(group.cliOnlyTokens || []).map((value) => value.toLowerCase());
  const externalAdapterRequiredTokens = uniqueStrings(group.externalAdapterRequiredTokens || [])
    .map((value) => value.toLowerCase());
  return Object.freeze({
    canonicalFormat,
    label: cleanString(group.label || canonicalFormat.toUpperCase()),
    fileExtensions: Object.freeze(fileExtensions),
    acceptExtensions: Object.freeze(acceptExtensions),
    accept: acceptExtensions.join(","),
    formatTokens: Object.freeze(formatTokens),
    cliOnlyTokens: Object.freeze(cliOnlyTokens),
    defaultImporterTranslationMode: cleanString(group.defaultImporterTranslationMode),
    importerTranslationModes: Object.freeze(uniqueStrings(group.importerTranslationModes || [])),
    importerTranslationModesByToken: Object.freeze({ ...(group.importerTranslationModesByToken || {}) }),
    builtInAvailable: group.builtInAvailable === true,
    externalAdapterRequired: group.externalAdapterRequired === true,
    hasExternalAdapterOnlyTokens: group.hasExternalAdapterOnlyTokens === true,
    externalAdapterRequiredTokens: Object.freeze(externalAdapterRequiredTokens),
    adapterRequestCapable: group.adapterRequestCapable === true,
    canonicalJsonPassthrough: group.canonicalJsonPassthrough === true
  });
}

function referenceGeometryImportGroupCopy(group = {}) {
  return Object.freeze({
    canonicalFormat: group.canonicalFormat,
    label: group.label,
    fileExtensions: Object.freeze([...(group.fileExtensions || [])]),
    acceptExtensions: Object.freeze([...(group.acceptExtensions || [])]),
    accept: group.accept,
    formatTokens: Object.freeze([...(group.formatTokens || [])]),
    cliOnlyTokens: Object.freeze([...(group.cliOnlyTokens || [])]),
    defaultImporterTranslationMode: group.defaultImporterTranslationMode,
    importerTranslationModes: Object.freeze([...(group.importerTranslationModes || [])]),
    importerTranslationModesByToken: Object.freeze({ ...(group.importerTranslationModesByToken || {}) }),
    builtInAvailable: group.builtInAvailable === true,
    externalAdapterRequired: group.externalAdapterRequired === true,
    hasExternalAdapterOnlyTokens: group.hasExternalAdapterOnlyTokens === true,
    externalAdapterRequiredTokens: Object.freeze([...(group.externalAdapterRequiredTokens || [])]),
    adapterRequestCapable: group.adapterRequestCapable === true,
    canonicalJsonPassthrough: group.canonicalJsonPassthrough === true
  });
}

function referenceGeometryImportInputDescriptor(descriptor = {}) {
  const id = cleanString(descriptor.id);
  const role = cleanString(descriptor.role || "input");
  return Object.freeze({
    id,
    label: cleanString(descriptor.label || titleCase(id)),
    kind: cleanString(descriptor.kind || role),
    role,
    source: cleanString(descriptor.source),
    pathPolicy: cleanString(descriptor.pathPolicy),
    pathBacked: descriptor.pathBacked === true,
    optional: descriptor.optional === true,
    requiredWhen: cleanString(descriptor.requiredWhen),
    requiredForStages: Object.freeze(uniqueStrings(descriptor.requiredForStages || [])),
    relevantStages: Object.freeze(uniqueStrings(descriptor.relevantStages || [])),
    outputForStages: Object.freeze(uniqueStrings(descriptor.outputForStages || [])),
    accept: cleanString(descriptor.accept),
    fileExtensions: Object.freeze(uniqueStrings(descriptor.fileExtensions || []).map((value) => value.toLowerCase())),
    acceptExtensions: Object.freeze(uniqueStrings(descriptor.acceptExtensions || []).map((value) => value.toLowerCase())),
    formatTokens: Object.freeze(uniqueStrings(descriptor.formatTokens || []).map((value) => value.toLowerCase())),
    cliOnlyTokens: Object.freeze(uniqueStrings(descriptor.cliOnlyTokens || []).map((value) => value.toLowerCase())),
    optionFields: Object.freeze(uniqueStrings(descriptor.optionFields || [])),
    sourceFormatField: cleanString(descriptor.sourceFormatField),
    sourceDecisionField: cleanString(descriptor.sourceDecisionField),
    writesArtifact: descriptor.writesArtifact === true,
    sideEffectClass: cleanString(descriptor.sideEffectClass),
    appRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY })
  });
}

function referenceGeometryImportInputDescriptorCopy(descriptor = {}) {
  return Object.freeze({
    id: descriptor.id,
    label: descriptor.label,
    kind: descriptor.kind,
    role: descriptor.role,
    source: descriptor.source,
    pathPolicy: descriptor.pathPolicy,
    pathBacked: descriptor.pathBacked === true,
    optional: descriptor.optional === true,
    requiredWhen: descriptor.requiredWhen,
    requiredForStages: Object.freeze([...(descriptor.requiredForStages || [])]),
    relevantStages: Object.freeze([...(descriptor.relevantStages || [])]),
    outputForStages: Object.freeze([...(descriptor.outputForStages || [])]),
    accept: descriptor.accept,
    fileExtensions: Object.freeze([...(descriptor.fileExtensions || [])]),
    acceptExtensions: Object.freeze([...(descriptor.acceptExtensions || [])]),
    formatTokens: Object.freeze([...(descriptor.formatTokens || [])]),
    cliOnlyTokens: Object.freeze([...(descriptor.cliOnlyTokens || [])]),
    optionFields: Object.freeze([...(descriptor.optionFields || [])]),
    sourceFormatField: descriptor.sourceFormatField,
    sourceDecisionField: descriptor.sourceDecisionField,
    writesArtifact: descriptor.writesArtifact === true,
    sideEffectClass: descriptor.sideEffectClass,
    appRuntimeBoundary: Object.freeze({ ...(descriptor.appRuntimeBoundary || REFERENCE_GEOMETRY_IMPORT_INPUT_RUNTIME_BOUNDARY) })
  });
}

function referenceGeometryImportCliStageBlueprint(blueprint = {}) {
  const stageId = cleanString(blueprint.stageId);
  return Object.freeze({
    stageId,
    id: cleanString(blueprint.id || `${stageId}-cli-blueprint`),
    label: cleanString(blueprint.label || titleCase(stageId)),
    kind: "reference-import-cli-stage-blueprint",
    commandPurpose: cleanString(blueprint.commandPurpose),
    executionMode: cleanString(blueprint.executionMode) || null,
    commandFlags: Object.freeze(uniqueStrings(blueprint.commandFlags || [])),
    requiredInputDescriptorIds: Object.freeze(uniqueStrings(blueprint.requiredInputDescriptorIds || [])),
    optionalInputDescriptorIds: Object.freeze(uniqueStrings(blueprint.optionalInputDescriptorIds || [])),
    artifactDescriptorIds: Object.freeze(uniqueStrings(blueprint.artifactDescriptorIds || [])),
    requiredCliFlags: Object.freeze(uniqueStrings(blueprint.requiredCliFlags || [])),
    optionalCliFlags: Object.freeze(uniqueStrings(blueprint.optionalCliFlags || [])),
    jsonRecommended: blueprint.jsonRecommended !== false,
    appRuntimeExecutesCli: false,
    requiresWorkspaceCommandHost: true,
    requiresExplicitUserAction: true,
    requiresWriteConfirmation: blueprint.requiresWriteConfirmation === true,
    sideEffectClass: cleanString(blueprint.sideEffectClass || "no-project-or-target-write")
  });
}

function referenceGeometryImportCliStageBlueprintCopy(blueprint = {}) {
  return Object.freeze({
    stageId: blueprint.stageId,
    id: blueprint.id,
    label: blueprint.label,
    kind: blueprint.kind,
    commandPurpose: blueprint.commandPurpose,
    executionMode: blueprint.executionMode || null,
    commandFlags: Object.freeze([...(blueprint.commandFlags || [])]),
    requiredInputDescriptorIds: Object.freeze([...(blueprint.requiredInputDescriptorIds || [])]),
    optionalInputDescriptorIds: Object.freeze([...(blueprint.optionalInputDescriptorIds || [])]),
    artifactDescriptorIds: Object.freeze([...(blueprint.artifactDescriptorIds || [])]),
    requiredCliFlags: Object.freeze([...(blueprint.requiredCliFlags || [])]),
    optionalCliFlags: Object.freeze([...(blueprint.optionalCliFlags || [])]),
    jsonRecommended: blueprint.jsonRecommended !== false,
    appRuntimeExecutesCli: false,
    requiresWorkspaceCommandHost: true,
    requiresExplicitUserAction: true,
    requiresWriteConfirmation: blueprint.requiresWriteConfirmation === true,
    sideEffectClass: blueprint.sideEffectClass
  });
}

function referenceGeometryImportStageResultDescriptor(stage = {}) {
  const stageId = cleanString(stage.id);
  const outputFingerprintAvailability = REFERENCE_GEOMETRY_IMPORT_OUTPUT_FINGERPRINT_AVAILABILITY_BY_STAGE[stageId] || {};
  return Object.freeze({
    stageId,
    id: `${stageId}-result-descriptor`,
    label: `${cleanString(stage.label || titleCase(stageId))} Result`,
    kind: "reference-import-stage-result",
    executionMode: stage.executionMode || null,
    decisionField: stage.decisionField,
    fingerprintFields: Object.freeze([...(stage.fingerprintFields || [])]),
    workflowStatusField: REFERENCE_GEOMETRY_IMPORT_WORKFLOW_STATUS_FIELD,
    successEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULT_SUCCESS_ENVELOPE_FIELDS]),
    errorEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULT_ERROR_ENVELOPE_FIELDS]),
    failureDecisionField: "referenceImportFailureDecision",
    outputFingerprintAvailability: freezeFlatRecord(outputFingerprintAvailability),
    noProjectOrTargetWrites: stage.noProjectOrTargetWrites === true,
    promotedWriteStage: stage.promotedWriteStage === true,
    appRuntimeParsesHumanMessages: false
  });
}

function flattenReferenceGeometryImportGroupValues(fieldName) {
  return uniqueStrings(REFERENCE_GEOMETRY_IMPORT_SOURCE_GROUPS.flatMap((group) => group[fieldName] || []));
}

function referenceGeometryImportGroupForToken(token) {
  const normalized = normalizeReferenceImportToken(token);
  if (!normalized) return null;
  return REFERENCE_GEOMETRY_IMPORT_SOURCE_GROUPS.find((group) => group.formatTokens.includes(normalized)) || null;
}

export function referenceGeometryImportTargetFormatCoverage() {
  const targetFormatEntries = Object.freeze(Object.fromEntries(REFERENCE_GEOMETRY_IMPORT_TARGET_FORMAT_TOKENS.map((token) => {
    const group = referenceGeometryImportGroupForToken(token);
    const importerTranslationMode = group?.importerTranslationModesByToken?.[token] || group?.defaultImporterTranslationMode || null;
    return [token, Object.freeze({
      formatToken: token,
      supported: Boolean(group),
      canonicalFormat: group?.canonicalFormat || token,
      importerTranslationMode,
      builtInAvailable: group?.builtInAvailable === true,
      externalAdapterRequired: importerTranslationMode === "external-adapter" || (group?.externalAdapterRequiredTokens || []).includes(token),
      adapterRequestCapable: group?.adapterRequestCapable === true,
      cliOnlyToken: (group?.cliOnlyTokens || []).includes(token),
      accept: group?.accept || "",
      canonicalAccept: group?.accept || ""
    })];
  })));
  const entries = Object.values(targetFormatEntries);
  return Object.freeze({
    targetFormatTokens: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_TARGET_FORMAT_TOKENS]),
    allTargetFormatsSupported: entries.every((entry) => entry.supported === true),
    missingTargetFormatTokens: Object.freeze(entries.filter((entry) => entry.supported !== true).map((entry) => entry.formatToken)),
    builtInTargetFormatTokens: Object.freeze(entries.filter((entry) => entry.builtInAvailable === true).map((entry) => entry.formatToken)),
    externalAdapterRequiredTargetFormatTokens: Object.freeze(entries.filter((entry) => entry.externalAdapterRequired === true).map((entry) => entry.formatToken)),
    adapterRequestCapableTargetFormatTokens: Object.freeze(entries.filter((entry) => entry.adapterRequestCapable === true).map((entry) => entry.formatToken)),
    cliOnlyTargetFormatTokens: Object.freeze(entries.filter((entry) => entry.cliOnlyToken === true).map((entry) => entry.formatToken)),
    targetFormatEntries
  });
}

function referenceGeometryImportCliBlueprintForStage(stageId) {
  const normalized = cleanString(stageId);
  return REFERENCE_GEOMETRY_IMPORT_STAGE_CLI_BLUEPRINTS.find((blueprint) => blueprint.stageId === normalized) || null;
}

function normalizeReferenceImportToken(value = "") {
  return cleanString(value).replace(/^\.+/, "").toLowerCase();
}

function referenceGeometryImportStagePreview(stage = {}, sourceDecision = {}) {
  const availability = referenceGeometryImportStageAvailability(stage, sourceDecision);
  const cliBlueprint = referenceGeometryImportCliBlueprintForStage(stage.id);
  return Object.freeze({
    id: stage.id,
    label: stage.label,
    commandFlags: Object.freeze([...(stage.commandFlags || [])]),
    executionMode: stage.executionMode || null,
    requiredInputs: Object.freeze([...(stage.requiredInputs || [])]),
    requiredInputDescriptorIds: Object.freeze([...(stage.requiredInputs || [])]),
    cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    cliStageBlueprintId: cliBlueprint?.id || "",
    requiredCliFlags: Object.freeze([...(cliBlueprint?.requiredCliFlags || [])]),
    optionalCliFlags: Object.freeze([...(cliBlueprint?.optionalCliFlags || [])]),
    decisionField: stage.decisionField,
    fingerprintFields: Object.freeze([...(stage.fingerprintFields || [])]),
    optional: stage.optional === true,
    availability,
    noProjectOrTargetWrites: stage.noProjectOrTargetWrites === true,
    promotedWriteStage: stage.promotedWriteStage === true,
    writesProjectJson: stage.writesProjectJson === true,
    writesTargetReferenceManifest: stage.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter: stage.mayLaunchExternalAdapter === true,
    sideEffectBoundary: freezeFlatRecord(stage.sideEffectBoundary || {})
  });
}

function referenceGeometryImportStageAvailability(stage = {}, sourceDecision = {}) {
  if (sourceDecision.ok !== true) {
    if (stage.id === "source-discovery") return "needs-source";
    if (stage.id === "adapter-preflight") return "optional";
    return "blocked";
  }
  if (stage.id === "source-discovery") return "complete";
  if (stage.id === "adapter-preflight") return sourceDecision.externalAdapterRequired === true ? "recommended" : "optional";
  if (stage.id === "adapter-request") {
    if (sourceDecision.adapterRequestCapable !== true || sourceDecision.canonicalJsonPassthrough === true) return "not-applicable";
    return sourceDecision.externalAdapterRequired === true ? "recommended" : "optional";
  }
  if (stage.id === "dry-run") return "available";
  if (stage.id === "import") return "requires-dry-run";
  if (stage.id === "check-references") return "post-import";
  return "available";
}

function referenceGeometryImportRecommendedWorkflowStage(sourceDecision = {}) {
  if (sourceDecision.ok !== true) return "source-discovery";
  if (sourceDecision.externalAdapterRequired === true) return "adapter-preflight";
  return "plan-only";
}

function referenceGeometryImportStageActionPreview(stage = {}, readiness = {}) {
  const sourceDecision = readiness.sourceDecision || {};
  const actionState = referenceGeometryImportActionState(stage, readiness);
  const actionToken = referenceGeometryImportActionToken(stage, readiness);
  const mayLaunchExternalAdapter = stage.mayLaunchExternalAdapter === true && sourceDecision.externalAdapterRequired === true;
  const writesAdapterRequest = stage.sideEffectBoundary?.writesAdapterRequest === true;
  const actionable = ["primary", "available", "optional", "recommended", "guarded"].includes(actionState);
  return Object.freeze({
    id: stage.id,
    label: stage.label,
    commandFlags: Object.freeze([...(stage.commandFlags || [])]),
    executionMode: stage.executionMode || null,
    requiredInputs: Object.freeze([...(stage.requiredInputs || [])]),
    requiredInputDescriptorIds: Object.freeze([...(stage.requiredInputDescriptorIds || stage.requiredInputs || [])]),
    cliBlueprintId: stage.cliBlueprintId || REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    cliStageBlueprintId: stage.cliStageBlueprintId || "",
    requiredCliFlags: Object.freeze([...(stage.requiredCliFlags || [])]),
    optionalCliFlags: Object.freeze([...(stage.optionalCliFlags || [])]),
    decisionField: stage.decisionField,
    fingerprintFields: Object.freeze([...(stage.fingerprintFields || [])]),
    availability: stage.availability,
    actionState,
    actionToken,
    actionable,
    disabled: !actionable,
    optional: stage.optional === true,
    noProjectOrTargetWrites: stage.noProjectOrTargetWrites === true,
    promotedWriteStage: stage.promotedWriteStage === true,
    writesAdapterRequest,
    writesProjectJson: stage.writesProjectJson === true,
    writesTargetReferenceManifest: stage.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter,
    requiresExplicitUserAction: actionable,
    requiresWriteConfirmation: stage.promotedWriteStage === true,
    sideEffectClass: referenceGeometryImportActionSideEffectClass(stage, mayLaunchExternalAdapter, writesAdapterRequest)
  });
}

function referenceGeometryImportActionState(stage = {}, readiness = {}) {
  if (stage.availability === "needs-source") return "input-required";
  if (stage.availability === "blocked") return "blocked";
  if (stage.availability === "not-applicable") return "not-applicable";
  if (stage.availability === "post-import") return "post-import";
  if (stage.availability === "requires-dry-run") return "guarded";
  if (stage.availability === "complete") return "complete";
  if (stage.availability === "recommended") return "recommended";
  if (stage.availability === "optional") return "optional";
  if (stage.id === readiness.recommendedWorkflowStage) return "primary";
  return "available";
}

function referenceGeometryImportActionToken(stage = {}, readiness = {}) {
  if (stage.availability === "blocked") return "wait-for-supported-reference-source";
  if (stage.availability === "needs-source") return "choose-supported-reference-source";
  if (stage.id === "source-discovery") return readiness.ok ? "review-source-description" : "choose-supported-reference-source";
  if (stage.id === "plan-only") return "run-plan-only";
  if (stage.id === "adapter-preflight") return "check-adapter-preflight";
  if (stage.id === "adapter-request") {
    if (stage.availability === "not-applicable") return "skip-adapter-request";
    return readiness.externalAdapterRequired ? "write-adapter-request" : "optionally-write-adapter-request";
  }
  if (stage.id === "dry-run") return "run-dry-run";
  if (stage.id === "import") return "confirm-import-after-dry-run";
  if (stage.id === "check-references") return "check-references-after-import";
  return stage.availability || "available";
}

function referenceGeometryImportPrimaryActionStage(stageActions = [], readiness = {}) {
  if (readiness.ok !== true) return "source-discovery";
  const preferred = stageActions.find((stage) => stage.id === readiness.recommendedWorkflowStage && stage.actionable);
  if (preferred) return preferred.id;
  const fallback = stageActions.find((stage) => stage.actionable);
  return fallback?.id || "source-discovery";
}

function referenceGeometryImportActionSideEffectClass(stage = {}, mayLaunchExternalAdapter = false, writesAdapterRequest = false) {
  if (stage.promotedWriteStage === true) return "promoted-project-and-reference-write";
  if (writesAdapterRequest) return "adapter-request-write-only";
  if (mayLaunchExternalAdapter) return "no-project-or-target-write-may-launch-adapter";
  if (stage.noProjectOrTargetWrites === true) return "no-project-or-target-write";
  return "read-only";
}

function referenceGeometryImportCommandInputValues(input = {}) {
  const options = plainObject(input.importOptions) ? input.importOptions : {};
  const display = plainObject(input.display) ? input.display : (plainObject(options.display) ? options.display : {});
  const transform = plainObject(input.transform) ? input.transform : (plainObject(options.transform) ? options.transform : {});
  return Object.freeze({
    projectPath: cleanString(firstDefined(input.projectPath, input.project, options.projectPath)),
    inputPath: cleanString(firstDefined(input.inputPath, input.path, input.filePath, options.inputPath)),
    requestPath: cleanString(firstDefined(input.requestPath, options.requestPath)),
    referencesDir: cleanString(firstDefined(input.referencesDir, options.referencesDir)),
    formatToken: normalizeReferenceImportToken(firstDefined(input.formatToken, input.format, options.formatToken, options.format)),
    adapterConfigPath: cleanString(firstDefined(input.adapterConfigPath, input.adapterConfig, options.adapterConfigPath, options.adapterConfig)),
    adapterName: cleanString(firstDefined(input.adapterName, input.adapter, options.adapterName, options.adapter)),
    adapterTimeoutMs: firstDefined(input.adapterTimeoutMs, options.adapterTimeoutMs),
    pointCloudChunkSize: firstDefined(input.pointCloudChunkSize, options.pointCloudChunkSize),
    assetId: cleanString(firstDefined(input.assetId, options.assetId)),
    name: cleanString(firstDefined(input.name, options.name)),
    units: cleanString(firstDefined(input.units, options.units)),
    replaceExisting: firstDefined(input.replaceExisting, options.replaceExisting),
    visible: firstDefined(input.visible, options.visible, input.visibility, options.visibility, display.visible),
    snapEnabled: firstDefined(input.snapEnabled, options.snapEnabled),
    opacity: firstDefined(input.opacity, options.opacity, display.opacity),
    color: cleanString(firstDefined(input.color, options.color, display.color)),
    edgeColor: cleanString(firstDefined(input.edgeColor, options.edgeColor, display.edgeColor)),
    pointSize: firstDefined(input.pointSize, options.pointSize, display.pointSize),
    origin: firstDefined(input.origin, options.origin, transform.origin),
    axisX: firstDefined(input.axisX, options.axisX, transform.axisX),
    axisY: firstDefined(input.axisY, options.axisY, transform.axisY),
    axisZ: firstDefined(input.axisZ, options.axisZ, transform.axisZ),
    scale: firstDefined(input.scale, options.scale, transform.scale),
    summaryOnly: firstDefined(input.summaryOnly, options.summaryOnly),
    json: firstDefined(input.json, options.json)
  });
}

function referenceGeometryImportInvalidImportOptionFields(values = {}) {
  return uniqueStrings([
    referenceGeometryImportAssetIdOptionInvalid(values.assetId) ? "assetId" : "",
    referenceGeometryImportUnitsOptionInvalid(values.units) ? "units" : "",
    referenceGeometryImportAdapterNameOptionInvalid(values.adapterName) ? "adapterName" : "",
    referenceGeometryImportBooleanOptionInvalid(values.replaceExisting) ? "replaceExisting" : "",
    referenceGeometryImportBooleanOptionInvalid(values.visible) ? "visible" : "",
    referenceGeometryImportBooleanOptionInvalid(values.snapEnabled) ? "snapEnabled" : "",
    referenceGeometryImportBooleanOptionInvalid(values.summaryOnly) ? "summaryOnly" : "",
    referenceGeometryImportPositiveIntegerOptionInvalid(values.adapterTimeoutMs) ? "adapterTimeoutMs" : "",
    referenceGeometryImportPositiveIntegerOptionInvalid(values.pointCloudChunkSize) ? "pointCloudChunkSize" : "",
    referenceGeometryImportOpacityOptionInvalid(values.opacity) ? "opacity" : "",
    referenceGeometryImportColorOptionInvalid(values.color) ? "color" : "",
    referenceGeometryImportColorOptionInvalid(values.edgeColor) ? "edgeColor" : "",
    referenceGeometryImportPositiveNumberOptionInvalid(values.pointSize) ? "pointSize" : "",
    ...referenceGeometryImportInvalidTransformOptionFields(values)
  ]);
}

function referenceGeometryImportFormatTokenOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  const token = referenceGeometryImportCommandValueString(value);
  return !REFERENCE_SOURCE_ID_PATTERN.test(token) || RESERVED_REFERENCE_SOURCE_IDS.has(token);
}

function referenceGeometryImportAssetIdOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  return !isSafeProjectReferenceGeometryAssetId(referenceGeometryImportCommandValueString(value));
}

function referenceGeometryImportUnitsOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  return !REFERENCE_GEOMETRY_IMPORT_REFERENCE_UNIT_TOKENS.includes(referenceGeometryImportNormalizedUnitsOption(value));
}

function referenceGeometryImportAdapterNameOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  return !referenceGeometryImportAdapterId(referenceGeometryImportCommandValueString(value));
}

function referenceGeometryImportNormalizedUnitsOption(value) {
  const normalized = referenceGeometryImportCommandValueString(value).toLowerCase();
  if (["mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(normalized)) return "mm";
  if (["m", "meter", "meters", "metre", "metres"].includes(normalized)) return "m";
  if (["in", "inch", "inches"].includes(normalized)) return "in";
  if (["ft", "foot", "feet"].includes(normalized)) return "ft";
  return normalized;
}

function referenceGeometryImportBooleanOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  return referenceGeometryImportBooleanOptionValue(value, null) === null;
}

function referenceGeometryImportBooleanOptionValue(value, fallback = false) {
  if (!referenceGeometryImportCommandValueProvided(value)) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = referenceGeometryImportCommandValueString(value).toLowerCase();
  if (REFERENCE_GEOMETRY_IMPORT_BOOLEAN_TRUE_TOKENS.has(normalized)) return true;
  if (REFERENCE_GEOMETRY_IMPORT_BOOLEAN_FALSE_TOKENS.has(normalized)) return false;
  return null;
}

function referenceGeometryImportPositiveIntegerOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  const number = Number(value);
  return !Number.isInteger(number) || number < 1;
}

function referenceGeometryImportPositiveNumberOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  const number = Number(value);
  return !Number.isFinite(number) || number <= 0;
}

function referenceGeometryImportOpacityOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  const number = Number(value);
  return !Number.isFinite(number) || number < 0 || number > 1;
}

function referenceGeometryImportColorOptionInvalid(value) {
  if (!referenceGeometryImportCommandValueProvided(value)) return false;
  return !/^#[0-9A-Fa-f]{6}$/.test(referenceGeometryImportCommandValueString(value));
}

function referenceGeometryImportInvalidTransformOptionFields(values = {}) {
  const invalidFields = [];
  const vectors = {
    origin: referenceGeometryImportVectorOption(values.origin, [0, 0, 0]),
    axisX: referenceGeometryImportVectorOption(values.axisX, [1, 0, 0]),
    axisY: referenceGeometryImportVectorOption(values.axisY, [0, 1, 0]),
    axisZ: referenceGeometryImportVectorOption(values.axisZ, [0, 0, 1])
  };
  for (const field of ["origin", "axisX", "axisY", "axisZ"]) {
    if (vectors[field].invalid) invalidFields.push(field);
  }
  if (referenceGeometryImportPositiveNumberOptionInvalid(values.scale)) invalidFields.push("scale");
  for (const field of ["axisX", "axisY", "axisZ"]) {
    if (!vectors[field].invalid && referenceGeometryImportVectorLength(vectors[field].value) <= 1e-9) invalidFields.push(field);
  }
  if (invalidFields.length) return invalidFields;
  const determinant = referenceGeometryImportVectorDot(
    referenceGeometryImportVectorCross(vectors.axisX.value, vectors.axisY.value),
    vectors.axisZ.value
  );
  if (Math.abs(determinant) <= 1e-9) {
    invalidFields.push(...["axisX", "axisY", "axisZ"].filter((field) => vectors[field].provided));
  }
  return invalidFields;
}

function referenceGeometryImportVectorOption(value, fallback) {
  if (!referenceGeometryImportCommandValueProvided(value)) {
    return { invalid: false, provided: false, value: [...fallback] };
  }
  const items = Array.isArray(value) ? value : String(value).split(",");
  if (items.length !== 3) return { invalid: true, provided: true, value: [...fallback] };
  const vector = items.map((item) => Number(item));
  if (!vector.every(Number.isFinite)) return { invalid: true, provided: true, value: [...fallback] };
  return { invalid: false, provided: true, value: vector };
}

function referenceGeometryImportVectorCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function referenceGeometryImportVectorDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function referenceGeometryImportVectorLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function referenceGeometryImportCliArgs(stageBlueprint = {}, values = {}, { template = false } = {}) {
  const args = [referenceGeometryImportCliBlueprints().cliEntrypoint];
  const seen = new Set();
  const appendFlag = (flag, required = false) => {
    if (seen.has(flag)) return;
    const field = referenceGeometryImportFieldForCliFlag(flag);
    const value = field ? values[field] : undefined;
    if (REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN_NO_VALUE_FLAGS.includes(flag)) {
      if (referenceGeometryImportCommandFlagEnabled(flag, value, required)) {
        args.push(flag);
        seen.add(flag);
      }
      return;
    }
    if (!field) return;
    if (!referenceGeometryImportCommandValueProvided(value)) {
      if (required && template) {
        args.push(flag, `<${field}>`);
        seen.add(flag);
      }
      return;
    }
    args.push(flag, referenceGeometryImportCommandValueString(value));
    seen.add(flag);
  };
  for (const flag of stageBlueprint.requiredCliFlags || []) appendFlag(flag, true);
  for (const flag of stageBlueprint.optionalCliFlags || []) appendFlag(flag, false);
  return Object.freeze(args);
}

function referenceGeometryImportFieldForCliFlag(flag) {
  return Object.entries(REFERENCE_GEOMETRY_IMPORT_CLI_FLAG_BINDINGS)
    .find(([, candidate]) => candidate === flag)?.[0] || "";
}

function referenceGeometryImportCommandFlagEnabled(flag, value, required = false) {
  if (required) return true;
  if (flag === "--json") return referenceGeometryImportBooleanOptionValue(value, true) !== false;
  return referenceGeometryImportBooleanOptionValue(value, false) === true;
}

function referenceGeometryImportCommandValueProvided(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function referenceGeometryImportCommandValueString(value) {
  if (Array.isArray(value)) return value.map((entry) => cleanString(entry)).join(",");
  if (typeof value === "boolean") return value ? "true" : "false";
  return cleanString(value);
}

function referenceGeometryImportWorkspaceResultRouting(stageId) {
  const results = referenceGeometryImportResultDescriptors();
  return Object.freeze({
    stageId: cleanString(stageId),
    successEnvelopeFields: Object.freeze([...results.successEnvelopeFields]),
    errorEnvelopeFields: Object.freeze([...results.errorEnvelopeFields]),
    workflowStatusField: results.workflowStatusField,
    failureDecisionField: results.failureDecisionField,
    errorPrimaryFields: Object.freeze([...results.errorPrimaryFields]),
    stageDecisionField: cleanString(results.stageDecisionFields?.[stageId]),
    stageFingerprintFields: Object.freeze([...(results.stageFingerprintFields?.[stageId] || [])]),
    outputFingerprintAvailability: freezeFlatRecord(results.stageOutputFingerprintAvailability?.[stageId] || {}),
    parsePolicy: Object.freeze({
      parseJsonStdout: true,
      parseHumanOutput: false,
      requireOkBoolean: true,
      preserveExitCode: true,
      preserveStderr: true
    })
  });
}

function referenceGeometryImportWorkspaceParsedResult(input = {}) {
  const candidates = [
    input.resultJson,
    input.jsonResult,
    input.parsedJson,
    input.stdoutJson,
    input.result?.json,
    input.result?.resultJson,
    input.hostResult?.json,
    input.hostResult?.resultJson
  ];
  return candidates.find((candidate) => plainObject(candidate)) || null;
}

function referenceGeometryImportPrimaryError(resultJson = null) {
  if (!plainObject(resultJson) || !Array.isArray(resultJson.errors)) return {};
  return plainObject(resultJson.errors[0]) ? resultJson.errors[0] : {};
}

function referenceGeometryImportWorkspaceResponseCleanPayloadObject(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => referenceGeometryImportWorkspaceResponseCleanPayloadValue(entry)));
  }
  if (!plainObject(value)) return null;
  return referenceGeometryImportWorkspaceResponseCleanPayloadValue(value);
}

function referenceGeometryImportWorkspaceStageDecision(value, stageId = "") {
  if (!plainObject(value)) return null;
  const stage = cleanString(stageId);
  if (stage === "source-discovery") {
    const sourceMetadata = referenceGeometryImportSourceMetadataFields({
      sourceFormat: value.sourceFormat || value.format,
      sourceRequestedFormat: value.sourceRequestedFormat || value.requestedFormat,
      sourceRequestedFormatAliases: value.sourceRequestedFormatAliases
    });
    return Object.freeze({
      sourceFormat: sourceMetadata.sourceFormat,
      sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
      sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
      sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
      sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
      canonicalFormat: referenceGeometryImportFormatToken(value.canonicalFormat),
      inputExists: nullableBoolean(value.inputExists),
      inputIsFile: nullableBoolean(value.inputIsFile),
      sourceFileReadyForImport: nullableBoolean(value.sourceFileReadyForImport),
      importerTranslationMode: referenceGeometryImportFirstTranslationMode(value.importerTranslationMode, value.translationMode),
      canonicalJsonPassthrough: nullableBoolean(value.canonicalJsonPassthrough),
      builtInAvailable: nullableBoolean(value.builtInAvailable),
      externalAdapterRequired: nullableBoolean(value.externalAdapterRequired),
      adapterConfigProvided: nullableBoolean(value.adapterConfigProvided),
      adapterRegistrySupportsSourceFormat: nullableBoolean(value.adapterRegistrySupportsSourceFormat),
      adapterRequestCapable: nullableBoolean(value.adapterRequestCapable),
      canWriteAdapterRequest: nullableBoolean(value.canWriteAdapterRequest),
      projectRequiredForImport: nullableBoolean(value.projectRequiredForImport),
      sideEffectFreeDiscovery: nullableBoolean(value.sideEffectFreeDiscovery),
      safeFirstExecutionMode: referenceGeometryImportExecutionMode(value.safeFirstExecutionMode),
      availableExecutionModes: Object.freeze(referenceGeometryImportExecutionModeArray(value.availableExecutionModes)),
      safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
      recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
      referenceSourceDescriptionFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceSourceDescriptionFingerprint),
      referenceImportDiscoveryFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceImportDiscoveryFingerprint)
    });
  }
  if (stage === "plan-only") {
    const sourceMetadata = referenceGeometryImportSourceMetadataFields({
      sourceFormat: value.sourceFormat || value.format,
      sourceRequestedFormat: value.sourceRequestedFormat || value.requestedFormat,
      sourceRequestedFormatAliases: value.sourceRequestedFormatAliases
    });
    return Object.freeze({
      assetId: referenceGeometryImportAssetId(value.assetId),
      replacedExisting: nullableBoolean(value.replacedExisting),
      sourceFormat: sourceMetadata.sourceFormat,
      sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
      sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
      sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
      sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
      translationMode: referenceGeometryImportTranslationMode(value.translationMode),
      projectPointerReady: nullableBoolean(value.projectPointerReady),
      adapterRequestCapable: nullableBoolean(value.adapterRequestCapable),
      canWriteAdapterRequest: nullableBoolean(value.canWriteAdapterRequest),
      adapterConfigProvided: nullableBoolean(value.adapterConfigProvided),
      adapterPreflightOk: nullableBoolean(value.adapterPreflightOk),
      safeNextExecutionMode: referenceGeometryImportExecutionMode(value.safeNextExecutionMode),
      availableNextExecutionModes: Object.freeze(referenceGeometryImportExecutionModeArray(value.availableNextExecutionModes)),
      safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
      recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction)
    });
  }
  if (stage === "import") {
    return referenceGeometryImportReferencePromotionSummary(value, stage);
  }
  if (stage === "dry-run") {
    const sourceMetadata = referenceGeometryImportSourceMetadataFields({
      sourceFormat: value.sourceFormat || value.format,
      sourceRequestedFormat: value.sourceRequestedFormat || value.requestedFormat,
      sourceRequestedFormatAliases: value.sourceRequestedFormatAliases
    });
    return Object.freeze({
      assetId: referenceGeometryImportAssetId(value.assetId),
      replacedExisting: nullableBoolean(value.replacedExisting),
      sourceFormat: sourceMetadata.sourceFormat,
      sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
      sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
      sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
      sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
      translationMode: referenceGeometryImportTranslationMode(value.translationMode),
      projectPointerReady: nullableBoolean(value.projectPointerReady),
      canonicalOutputValidated: nullableBoolean(value.canonicalOutputValidated),
      projectJsonUnchanged: nullableBoolean(value.projectJsonUnchanged),
      targetReferenceManifestUnchanged: nullableBoolean(value.targetReferenceManifestUnchanged),
      translatedOutputFingerprintsReady: nullableBoolean(value.translatedOutputFingerprintsReady),
      safeNextExecutionMode: referenceGeometryImportExecutionMode(value.safeNextExecutionMode),
      safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
      recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
      referenceImportPlanFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceImportPlanFingerprint),
      referenceTranslatedManifestFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceTranslatedManifestFingerprint),
      referenceTranslatedArtifactFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceTranslatedArtifactFingerprint)
    });
  }
  if (stage === "adapter-preflight") {
    return Object.freeze({
      adapterPreflightReady: nullableBoolean(value.adapterPreflightReady),
      requestedFormat: referenceGeometryImportFormatToken(value.requestedFormat),
      requestedFormatToken: referenceGeometryImportFormatToken(value.requestedFormatToken),
      requestedAdapter: referenceGeometryImportFirstAdapterId(value.requestedAdapter),
      adapterCount: nullableNonNegativeInteger(value.adapterCount),
      adapterKeys: Object.freeze(referenceGeometryImportAdapterIdArray(value.adapterKeys)),
      selectedAdapterKeys: Object.freeze(referenceGeometryImportAdapterIdArray(value.selectedAdapterKeys)),
      blockingDiagnosticCount: nullableNonNegativeInteger(value.blockingDiagnosticCount),
      warningDiagnosticCount: nullableNonNegativeInteger(value.warningDiagnosticCount),
      blockingDiagnosticCodes: Object.freeze(referenceGeometryImportMachineTokenArray(value.blockingDiagnosticCodes)),
      warningDiagnosticCodes: Object.freeze(referenceGeometryImportMachineTokenArray(value.warningDiagnosticCodes)),
      likelyFixArea: referenceGeometryImportFixAreaToken(value.likelyFixArea),
      safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
      recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
      adapterRegistryFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterRegistryFingerprint),
      adapterTargetFormatCoverageFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterTargetFormatCoverageFingerprint),
      adapterPreflightFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterPreflightFingerprint)
    });
  }
  if (stage === "check-references") {
    return Object.freeze({
      summaryOnly: nullableBoolean(value.summaryOnly),
      requestedAssetId: referenceGeometryImportAssetId(value.requestedAssetId),
      referenceAssetCount: nullableNonNegativeInteger(value.referenceAssetCount),
      referenceReadyCount: nullableNonNegativeInteger(value.referenceReadyCount),
      referenceNeedsAttentionCount: nullableNonNegativeInteger(value.referenceNeedsAttentionCount),
      referenceAuditErrorCount: nullableNonNegativeInteger(value.referenceAuditErrorCount),
      auditPassed: typeof value.auditPassed === "boolean" ? value.auditPassed : null,
      referenceOverlayReady: typeof value.referenceOverlayReady === "boolean" ? value.referenceOverlayReady : null,
      blockingStatuses: Object.freeze(referenceGeometryImportAuditStatusArray(value.blockingStatuses)),
      highestPriorityStatus: referenceGeometryImportAuditStatusToken(value.highestPriorityStatus),
      highestPrioritySeverity: referenceGeometryImportAuditSeverityToken(value.highestPrioritySeverity),
      highestPriorityAssetId: referenceGeometryImportAssetId(value.highestPriorityAssetId),
      likelyFixArea: referenceGeometryImportFixAreaToken(value.likelyFixArea),
      safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
      recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
      referenceAuditFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceAuditFingerprint)
    });
  }
  if (stage !== "adapter-request") {
    return referenceGeometryImportWorkspaceResponseCleanPayloadObject(value);
  }
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: value.sourceFormat || value.format,
    sourceRequestedFormat: value.sourceRequestedFormat || value.requestedFormat,
    sourceRequestedFormatAliases: value.sourceRequestedFormatAliases
  });
  return Object.freeze({
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    translationMode: referenceGeometryImportTranslationMode(value.translationMode),
    adapterKey: referenceGeometryImportFirstAdapterId(value.adapterKey, value.sourceAdapter),
    adapterOutputMode: referenceGeometryImportFirstAdapterOutputMode(value.adapterOutputMode, value.outputMode),
    adapterConfigProvided: nullableBoolean(value.adapterConfigProvided),
    adapterPreflightOk: nullableBoolean(value.adapterPreflightOk),
    adapterPreflightReady: nullableBoolean(value.adapterPreflightReady),
    adapterPreflightLikelyFixArea: referenceGeometryImportFixAreaToken(value.adapterPreflightLikelyFixArea),
    adapterPreflightRecommendedNextAction: referenceGeometryImportRoutingActionToken(value.adapterPreflightRecommendedNextAction),
    projectPointerReady: nullableBoolean(value.projectPointerReady),
    adapterRequestReady: nullableBoolean(value.adapterRequestReady),
    adapterStageDirectoriesReady: nullableBoolean(value.adapterStageDirectoriesReady),
    runsTranslator: nullableBoolean(value.runsTranslator),
    launchesAdapter: nullableBoolean(value.launchesAdapter),
    writesProjectJson: nullableBoolean(value.writesProjectJson),
    writesTargetReferenceManifest: nullableBoolean(value.writesTargetReferenceManifest),
    validatesCanonicalOutput: nullableBoolean(value.validatesCanonicalOutput),
    outputValidationRequired: nullableBoolean(value.outputValidationRequired),
    safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
    recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
    referenceImportPlanFingerprint: referenceGeometryImportSha256Fingerprint(value.referenceImportPlanFingerprint),
    adapterRequestFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterRequestFingerprint),
    adapterRegistryFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterRegistryFingerprint),
    adapterRegistryAdapterFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterRegistryAdapterFingerprint),
    adapterPreflightFingerprint: referenceGeometryImportSha256Fingerprint(value.adapterPreflightFingerprint)
  });
}

function referenceGeometryImportWorkspaceFailureDecision(value) {
  if (!plainObject(value)) return null;
  return Object.freeze({
    failedWorkflowStage: referenceGeometryImportKnownStageId(value.failedWorkflowStage),
    workflowStageComplete: typeof value.workflowStageComplete === "boolean" ? value.workflowStageComplete : null,
    adapterErrorCode: referenceGeometryImportMachineToken(value.adapterErrorCode),
    failureKind: referenceGeometryImportFailureKindToken(value.failureKind),
    likelyFixArea: referenceGeometryImportFixAreaToken(value.likelyFixArea),
    safeNextAction: referenceGeometryImportRoutingActionToken(value.safeNextAction),
    recommendedNextAction: referenceGeometryImportRoutingActionToken(value.recommendedNextAction),
    retryWorkflowStage: referenceGeometryImportKnownStageId(value.retryWorkflowStage),
    adapterConfigRequired: value.adapterConfigRequired === true,
    adapterDependencyReviewRequired: value.adapterDependencyReviewRequired === true,
    adapterRequestReviewRequired: value.adapterRequestReviewRequired === true,
    adapterRunInspectionRequired: value.adapterRunInspectionRequired === true,
    canonicalOutputFixRequired: value.canonicalOutputFixRequired === true,
    importOptionFixRequired: value.importOptionFixRequired === true,
    cliOptionFixRequired: value.cliOptionFixRequired === true
  });
}

function referenceGeometryImportWorkspaceWorkflowStatus(value) {
  if (!plainObject(value)) return null;
  return Object.freeze({
    workflowStage: referenceGeometryImportKnownStageId(value.workflowStage),
    workflowStageComplete: typeof value.workflowStageComplete === "boolean" ? value.workflowStageComplete : null,
    completedWorkflowStages: referenceGeometryImportOrderedWorkflowStages(value.completedWorkflowStages),
    completedStages: referenceGeometryImportOrderedWorkflowStages(value.completedStages),
    nextWorkflowStages: referenceGeometryImportOrderedWorkflowStages(value.nextWorkflowStages),
    nextWorkflowStage: referenceGeometryImportKnownStageId(value.nextWorkflowStage),
    recommendedNextWorkflowStage: referenceGeometryImportKnownStageId(value.recommendedNextWorkflowStage),
    recommendedWorkflowStage: referenceGeometryImportKnownStageId(value.recommendedWorkflowStage),
    failedWorkflowStage: referenceGeometryImportKnownStageId(value.failedWorkflowStage),
    workflowDecisionField: referenceGeometryImportKnownWorkflowDecisionField(value.workflowDecisionField),
    workflowFingerprintFields: referenceGeometryImportKnownWorkflowFingerprintFields(value.workflowFingerprintFields),
    noProjectOrTargetWrites: typeof value.noProjectOrTargetWrites === "boolean" ? value.noProjectOrTargetWrites : null,
    promotedWriteStage: typeof value.promotedWriteStage === "boolean" ? value.promotedWriteStage : null,
    writesProjectJson: typeof value.writesProjectJson === "boolean" ? value.writesProjectJson : null,
    writesTargetReferenceManifest: typeof value.writesTargetReferenceManifest === "boolean" ? value.writesTargetReferenceManifest : null,
    mayLaunchExternalAdapter: typeof value.mayLaunchExternalAdapter === "boolean" ? value.mayLaunchExternalAdapter : null,
    sideEffectBoundary: referenceGeometryImportWorkspaceWorkflowSideEffectBoundary(value.sideEffectBoundary)
  });
}

function referenceGeometryImportKnownWorkflowDecisionField(value) {
  const field = cleanString(value);
  const knownFields = [
    "referenceImportSourceDecision",
    "referenceImportPlanDecision",
    "adapterPreflightDecision",
    "referenceImportAdapterRequestDecision",
    "referenceImportDryRunDecision",
    "referenceImportPromotionDecision",
    "referenceAuditDecision"
  ];
  return knownFields.includes(field) ? field : "";
}

function referenceGeometryImportKnownWorkflowFingerprintFields(value) {
  const knownFields = [
    "referenceSourceDescriptionFingerprint",
    "referenceImportDiscoveryFingerprint",
    "referenceImportPlanFingerprint",
    "adapterRegistryFingerprint",
    "adapterTargetFormatCoverageFingerprint",
    "adapterPreflightFingerprint",
    "adapterRequestFingerprint",
    "referenceTranslatedManifestFingerprint",
    "referenceTranslatedArtifactFingerprint",
    "referenceManifestFingerprint",
    "referenceArtifactFingerprint",
    "referenceAuditFingerprint"
  ];
  return Object.freeze(arrayStrings(value).filter((field) => knownFields.includes(field)));
}

function referenceGeometryImportWorkspaceWorkflowSideEffectBoundary(value) {
  if (!plainObject(value)) return Object.freeze({});
  return Object.freeze({
    requiresProjectPath: typeof value.requiresProjectPath === "boolean" ? value.requiresProjectPath : null,
    readsProjectJson: typeof value.readsProjectJson === "boolean" ? value.readsProjectJson : null,
    readsSourceFileMetadata: typeof value.readsSourceFileMetadata === "boolean" ? value.readsSourceFileMetadata : null,
    validatesProjectPointer: typeof value.validatesProjectPointer === "boolean" ? value.validatesProjectPointer : null,
    mayPreflightAdapter: typeof value.mayPreflightAdapter === "boolean" ? value.mayPreflightAdapter : null,
    preflightsAdapter: typeof value.preflightsAdapter === "boolean" ? value.preflightsAdapter : null,
    runsTranslator: typeof value.runsTranslator === "boolean" ? value.runsTranslator : null,
    mayLaunchExternalAdapter: typeof value.mayLaunchExternalAdapter === "boolean" ? value.mayLaunchExternalAdapter : null,
    writesAdapterRequest: typeof value.writesAdapterRequest === "boolean" ? value.writesAdapterRequest : null,
    preparesAdapterStageDirectories: typeof value.preparesAdapterStageDirectories === "boolean" ? value.preparesAdapterStageDirectories : null,
    writesTemporaryReferenceManifest: typeof value.writesTemporaryReferenceManifest === "boolean" ? value.writesTemporaryReferenceManifest : null,
    writesProjectJson: typeof value.writesProjectJson === "boolean" ? value.writesProjectJson : null,
    writesProjectPointer: typeof value.writesProjectPointer === "boolean" ? value.writesProjectPointer : null,
    writesTargetReferenceManifest: typeof value.writesTargetReferenceManifest === "boolean" ? value.writesTargetReferenceManifest : null,
    mayWriteTargetReferenceChunks: typeof value.mayWriteTargetReferenceChunks === "boolean" ? value.mayWriteTargetReferenceChunks : null,
    readsReferenceManifests: typeof value.readsReferenceManifests === "boolean" ? value.readsReferenceManifests : null,
    mayReadPointCloudChunkSidecars: typeof value.mayReadPointCloudChunkSidecars === "boolean" ? value.mayReadPointCloudChunkSidecars : null
  });
}

function referenceGeometryImportWorkspaceResponseCleanPayloadValue(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => referenceGeometryImportWorkspaceResponseCleanPayloadValue(entry)));
  }
  if (!plainObject(value)) return value;
  const entries = [];
  for (const [field, fieldValue] of Object.entries(value)) {
    if (REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_PAYLOAD_FIELDS.includes(field)) continue;
    entries.push([field, referenceGeometryImportWorkspaceResponseCleanPayloadValue(fieldValue)]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function referenceGeometryImportWorkspaceResponseStatus({
  requestBlocked = false,
  hostError = "",
  resultJson = null,
  exitCode = null
} = {}) {
  if (requestBlocked && !plainObject(resultJson)) return "request-blocked";
  if (hostError) return "host-error";
  if (!plainObject(resultJson)) return "missing-json-result";
  if (resultJson.ok === true && (exitCode === null || exitCode === 0)) return "succeeded";
  return "failed";
}

function referenceGeometryImportWorkspaceResponseStatusToken(value = "") {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_STATUSES);
}

function referenceGeometryImportWorkspaceResponseSafeNextAction({
  responseStatus = "",
  request = {},
  stageId = "",
  stageDecision = null,
  failureDecision = null
} = {}) {
  if (responseStatus === "request-blocked") {
    return referenceGeometryImportRoutingActionToken(request.safeNextAction)
      || referenceGeometryImportWorkspaceSafeNextAction(request.blockedReason);
  }
  if (responseStatus === "missing-json-result") return "inspect-command-host-result";
  if (responseStatus === "host-error") return "inspect-command-host-error";
  if (responseStatus === "failed") {
    return referenceGeometryImportFirstRoutingActionToken(
      failureDecision?.safeNextAction,
      failureDecision?.recommendedNextAction,
      stageDecision?.safeNextAction,
      stageDecision?.recommendedNextAction
    )
      || "inspect-reference-import-failure";
  }
  return referenceGeometryImportFirstRoutingActionToken(stageDecision?.safeNextAction, stageDecision?.recommendedNextAction)
    || referenceGeometryImportWorkspaceSuccessNextAction(stageId);
}

function referenceGeometryImportWorkspaceResponseRecommendedNextAction({
  safeNextAction = "",
  stageDecision = null,
  failureDecision = null
} = {}) {
  return referenceGeometryImportFirstRoutingActionToken(
    stageDecision?.recommendedNextAction,
    failureDecision?.recommendedNextAction,
    safeNextAction
  );
}

function referenceGeometryImportWorkspaceSuccessNextAction(stageId = "") {
  if (stageId === "source-discovery") return "run-plan-only";
  if (stageId === "adapter-preflight") return "run-plan-only";
  if (stageId === "plan-only") return "run-dry-run";
  if (stageId === "adapter-request") return "run-external-adapter-wrapper";
  if (stageId === "dry-run") return "confirm-import";
  if (stageId === "import") return "run-check-references";
  if (stageId === "check-references") return "review-reference-audit";
  return "review-reference-import-result";
}

function referenceGeometryImportWorkspaceFingerprintSummary(resultJson = null, routing = {}) {
  if (!plainObject(resultJson)) return Object.freeze({});
  const fields = uniqueStrings([
    ...(routing.stageFingerprintFields || []),
    "referenceTranslatedManifestFingerprint",
    "referenceTranslatedArtifactFingerprint",
    "referenceManifestFingerprint",
    "referenceArtifactFingerprint",
    "referenceAuditFingerprint"
  ]);
  return Object.freeze(Object.fromEntries(
    fields
      .filter((field) => resultJson[field] !== undefined && resultJson[field] !== null)
      .map((field) => [field, referenceGeometryImportSha256Fingerprint(resultJson[field])])
      .filter(([_field, value]) => value)
  ));
}

function referenceGeometryImportSha256Fingerprint(value) {
  const fingerprint = cleanString(value);
  return /^sha256:[0-9a-f]{64}$/.test(fingerprint) ? fingerprint : "";
}

function referenceGeometryImportFirstSha256Fingerprint(...values) {
  for (const value of values) {
    const fingerprint = referenceGeometryImportSha256Fingerprint(value);
    if (fingerprint) return fingerprint;
  }
  return "";
}

function referenceGeometryImportReferenceSourceSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const decision = plainObject(resultJson.referenceImportSourceDecision)
    ? resultJson.referenceImportSourceDecision
    : (plainObject(resultJson.referenceTranslationSourceDecision) ? resultJson.referenceTranslationSourceDecision : resultJson);
  const hasSourcePayload = stage === "source-discovery"
    || plainObject(resultJson.referenceImportSourceDecision)
    || plainObject(resultJson.referenceTranslationSourceDecision)
    || referenceGeometryImportFirstSha256Fingerprint(resultJson.referenceSourceDescriptionFingerprint, resultJson.referenceImportDiscoveryFingerprint)
    || resultJson.sourceFileReadyForImport !== undefined
    || decision.sourceFileReadyForImport !== undefined;
  if (!hasSourcePayload) return null;
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: decision.sourceFormat || resultJson.sourceFormat || resultJson.format,
    sourceRequestedFormat: decision.sourceRequestedFormat || resultJson.sourceRequestedFormat || resultJson.requestedFormat,
    sourceRequestedFormatAliases: decision.sourceRequestedFormatAliases || resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    canonicalFormat: referenceGeometryImportFormatToken(decision.canonicalFormat || resultJson.canonicalFormat),
    sourceFileExtension: referenceGeometryImportFormatToken(resultJson.sourceFileExtension),
    sourceFileReadyForImport: decision.sourceFileReadyForImport === true,
    importerTranslationMode: referenceGeometryImportFirstTranslationMode(decision.importerTranslationMode, resultJson.importerTranslationMode, resultJson.translationMode),
    canonicalJsonPassthrough: decision.canonicalJsonPassthrough === true || resultJson.canonicalJsonPassthrough === true,
    builtInAvailable: decision.builtInAvailable === true || resultJson.builtInAvailable === true,
    externalAdapterRequired: decision.externalAdapterRequired === true || resultJson.externalAdapterRequired === true,
    adapterConfigProvided: decision.adapterConfigProvided === true || Boolean(cleanString(resultJson.adapterConfigStatFingerprint)),
    adapterRegistrySupportsSourceFormat: firstNullableBoolean(decision.adapterRegistrySupportsSourceFormat, resultJson.adapterRegistrySupportsSourceFormat),
    adapterRequestCapable: decision.adapterRequestCapable === true || resultJson.adapterRequestCapable === true,
    canWriteAdapterRequest: decision.canWriteAdapterRequest === true,
    projectRequiredForImport: decision.projectRequiredForImport === true || resultJson.projectRequiredForImport === true,
    sideEffectFreeDiscovery: decision.sideEffectFreeDiscovery === true,
    safeFirstExecutionMode: referenceGeometryImportExecutionMode(decision.safeFirstExecutionMode || resultJson.safeFirstExecutionMode),
    availableExecutionModes: Object.freeze(referenceGeometryImportExecutionModeArray(decision.availableExecutionModes || resultJson.availableExecutionModes || resultJson.referenceImportExecutionModes)),
    recommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.recommendedNextAction, resultJson.recommendedNextAction),
    accept: referenceGeometryImportAcceptString(resultJson.accept),
    acceptExtensions: Object.freeze(referenceGeometryImportAcceptExtensionArray(resultJson.acceptExtensions)),
    fileExtensions: Object.freeze(referenceGeometryImportFormatTokenArray(resultJson.fileExtensions)),
    formatTokens: Object.freeze(referenceGeometryImportFormatTokenArray(resultJson.formatTokens)),
    cliOnlyTokens: Object.freeze(referenceGeometryImportFormatTokenArray(resultJson.cliOnlyTokens)),
    referenceSourceDescriptionFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceSourceDescriptionFingerprint),
    referenceImportDiscoveryFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceImportDiscoveryFingerprint)
  });
}

function referenceGeometryImportAdapterPreflightSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const primaryError = referenceGeometryImportPrimaryError(resultJson);
  const preflightSource = plainObject(resultJson.adapterPreflightDecision)
    || resultJson.adapterPreflightReady !== undefined
    || resultJson.adapterPreflightFingerprint !== undefined
    ? resultJson
    : primaryError;
  const stage = cleanString(stageId || resultJson.stageId);
  const decision = plainObject(preflightSource.adapterPreflightDecision) ? preflightSource.adapterPreflightDecision : preflightSource;
  const coverage = plainObject(resultJson.adapterTargetFormatCoverage)
    ? resultJson.adapterTargetFormatCoverage
    : (plainObject(preflightSource.adapterTargetFormatCoverage) ? preflightSource.adapterTargetFormatCoverage : preflightSource);
  const adapters = plainObject(preflightSource.adapters) ? preflightSource.adapters : (plainObject(resultJson.adapters) ? resultJson.adapters : {});
  const hasPreflightPayload = stage === "adapter-preflight"
    || plainObject(resultJson.adapterPreflightDecision)
    || plainObject(primaryError.adapterPreflightDecision)
    || resultJson.adapterPreflightReady !== undefined
    || primaryError.adapterPreflightOk !== undefined
    || resultJson.adapterPreflightFingerprint !== undefined
    || primaryError.adapterPreflightFingerprint !== undefined;
  if (!hasPreflightPayload) return null;
  const missing = referenceGeometryImportAdapterMissingDependencySummary(preflightSource);
  const decisionAdapterKeys = referenceGeometryImportAdapterIdArray(decision.adapterKeys || preflightSource.adapterPreflightAdapterKeys);
  const adapterKeys = decisionAdapterKeys.length
    ? decisionAdapterKeys
    : referenceGeometryImportAdapterIdArray(Object.keys(adapters));
  const selectedAdapterKeys = referenceGeometryImportAdapterIdArray(decision.selectedAdapterKeys);
  const requested = plainObject(preflightSource.requested)
    ? preflightSource.requested
    : (plainObject(preflightSource.adapterPreflightRequested) ? preflightSource.adapterPreflightRequested : {});
  const requestedAdapter = referenceGeometryImportFirstAdapterId(decision.requestedAdapter, requested.adapter);
  const selectedAdapter = referenceGeometryImportFirstAdapterId(preflightSource.adapterPreflightSelectedAdapter, requestedAdapter);
  return Object.freeze({
    ok: resultJson.ok === true,
    adapterPreflightReady: decision.adapterPreflightReady === true,
    requestedFormat: referenceGeometryImportFormatToken(decision.requestedFormat || requested.format),
    requestedFormatToken: referenceGeometryImportFormatToken(decision.requestedFormatToken || requested.requestedFormat || requested.format),
    requestedAdapter,
    adapterCount: nonNegativeInteger(decision.adapterCount, adapterKeys.length),
    adapterKeys: Object.freeze(adapterKeys),
    selectedAdapterKeys: Object.freeze(selectedAdapterKeys.length ? selectedAdapterKeys : (selectedAdapter ? [selectedAdapter] : [])),
    blockingDiagnosticCount: nonNegativeInteger(decision.blockingDiagnosticCount, 0),
    warningDiagnosticCount: nonNegativeInteger(decision.warningDiagnosticCount, 0),
    blockingDiagnosticCodes: Object.freeze(referenceGeometryImportMachineTokenArray(decision.blockingDiagnosticCodes)),
    warningDiagnosticCodes: Object.freeze(referenceGeometryImportMachineTokenArray(decision.warningDiagnosticCodes)),
    likelyFixArea: referenceGeometryImportFixAreaToken(decision.likelyFixArea),
    safeNextAction: referenceGeometryImportRoutingActionToken(decision.safeNextAction),
    recommendedNextAction: referenceGeometryImportRoutingActionToken(decision.recommendedNextAction),
    missingRequiredFileCount: missing.missingRequiredFileCount,
    missingRequiredDirectoryCount: missing.missingRequiredDirectoryCount,
    missingRequiredCommandCount: missing.missingRequiredCommandCount,
    missingRequiredEnvCount: missing.missingRequiredEnvCount,
    missingRequiredFilePaths: Object.freeze(missing.missingRequiredFilePaths),
    missingRequiredDirectoryPaths: Object.freeze(missing.missingRequiredDirectoryPaths),
    missingRequiredCommands: Object.freeze(missing.missingRequiredCommands),
    missingRequiredEnvNames: Object.freeze(missing.missingRequiredEnvNames),
    allExternalAdapterRequiredTargetsConfigured: coverage.allExternalAdapterRequiredTargetsConfigured === true,
    missingExternalAdapterTargetFormatTokens: Object.freeze(referenceGeometryImportFormatTokenArray(coverage.missingExternalAdapterTargetFormatTokens)),
    adapterRegistryFingerprint: referenceGeometryImportFirstSha256Fingerprint(resultJson.adapterRegistryFingerprint, preflightSource.adapterRegistryFingerprint),
    adapterTargetFormatCoverageFingerprint: referenceGeometryImportFirstSha256Fingerprint(resultJson.adapterTargetFormatCoverageFingerprint, coverage.adapterTargetFormatCoverageFingerprint),
    adapterPreflightFingerprint: referenceGeometryImportFirstSha256Fingerprint(resultJson.adapterPreflightFingerprint, preflightSource.adapterPreflightFingerprint)
  });
}

function referenceGeometryImportAdapterMissingDependencySummary(resultJson = {}) {
  const fromSummary = {
    missingRequiredFilePaths: arrayStrings(resultJson.missingRequiredFilePaths),
    missingRequiredDirectoryPaths: arrayStrings(resultJson.missingRequiredDirectoryPaths),
    missingRequiredCommands: arrayStrings(resultJson.missingRequiredCommands),
    missingRequiredEnvNames: arrayStrings(resultJson.missingRequiredEnvNames)
  };
  const adapters = plainObject(resultJson.adapters) ? Object.values(resultJson.adapters) : [];
  const missingRequiredFilePaths = uniqueStrings([
    ...fromSummary.missingRequiredFilePaths,
    ...arrayObjects(resultJson.adapterMissingRequiredFiles)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.path)),
    ...adapters.flatMap((adapter) => arrayObjects(adapter?.requiredFiles)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.path)))
  ]).map((entry) => referenceGeometryImportSafeAdapterDependencyToken(entry)).filter(Boolean);
  const missingRequiredDirectoryPaths = uniqueStrings([
    ...fromSummary.missingRequiredDirectoryPaths,
    ...arrayObjects(resultJson.adapterMissingRequiredDirectories)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.path)),
    ...adapters.flatMap((adapter) => arrayObjects(adapter?.requiredDirectories)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.path)))
  ]).map((entry) => referenceGeometryImportSafeAdapterDependencyToken(entry)).filter(Boolean);
  const missingRequiredCommands = uniqueStrings([
    ...fromSummary.missingRequiredCommands,
    ...arrayObjects(resultJson.adapterMissingRequiredCommands)
      .filter((entry) => entry.found === false)
      .map((entry) => cleanString(entry.command)),
    ...adapters.flatMap((adapter) => arrayObjects(adapter?.requiredCommands)
      .filter((entry) => entry.found === false)
      .map((entry) => cleanString(entry.command)))
  ]).map((entry) => referenceGeometryImportSafeAdapterDependencyToken(entry)).filter(Boolean);
  const missingRequiredEnvNames = uniqueStrings([
    ...fromSummary.missingRequiredEnvNames,
    ...arrayObjects(resultJson.adapterMissingRequiredEnv)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.name)),
    ...adapters.flatMap((adapter) => arrayObjects(adapter?.requiredEnv)
      .filter((entry) => entry.exists === false)
      .map((entry) => cleanString(entry.name)))
  ]).filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry));
  return Object.freeze({
    missingRequiredFileCount: nonNegativeInteger(resultJson.missingRequiredFileCount, missingRequiredFilePaths.length),
    missingRequiredDirectoryCount: nonNegativeInteger(resultJson.missingRequiredDirectoryCount, missingRequiredDirectoryPaths.length),
    missingRequiredCommandCount: nonNegativeInteger(resultJson.missingRequiredCommandCount, missingRequiredCommands.length),
    missingRequiredEnvCount: nonNegativeInteger(resultJson.missingRequiredEnvCount, missingRequiredEnvNames.length),
    missingRequiredFilePaths,
    missingRequiredDirectoryPaths,
    missingRequiredCommands,
    missingRequiredEnvNames
  });
}

function referenceGeometryImportSafeAdapterDependencyToken(value) {
  const token = cleanString(value).replaceAll("\\", "/");
  if (!token) return "";
  if (/^[A-Za-z]:/.test(token)) return "";
  if (token.startsWith("/") || token.startsWith("//")) return "";
  if (token.includes("://")) return "";
  if (token.includes("?") || token.includes("#")) return "";
  if (token.split("/").some((segment) => segment === "." || segment === "..")) return "";
  return token;
}

function referenceGeometryImportFormatToken(value) {
  const token = cleanString(value).toLowerCase();
  return /^[a-z0-9][a-z0-9_-]*$/.test(token) ? token : "";
}

function referenceGeometryImportFormatTokenArray(value) {
  return Array.isArray(value) ? uniqueStrings(value.map(referenceGeometryImportFormatToken).filter(Boolean)) : [];
}

function referenceGeometryImportAcceptExtension(value) {
  const extension = cleanString(value).toLowerCase();
  if (!extension.startsWith(".")) return "";
  const token = referenceGeometryImportFormatToken(extension.slice(1));
  return token ? `.${token}` : "";
}

function referenceGeometryImportAcceptExtensionArray(value) {
  return Array.isArray(value) ? uniqueStrings(value.map(referenceGeometryImportAcceptExtension).filter(Boolean)) : [];
}

function referenceGeometryImportAcceptString(value) {
  return uniqueStrings(cleanString(value).split(",").map(referenceGeometryImportAcceptExtension).filter(Boolean)).join(",");
}

function referenceGeometryImportKnownToken(value, allowedTokens = []) {
  const token = cleanString(value);
  return allowedTokens.includes(token) ? token : "";
}

function referenceGeometryImportKnownTokenArray(value, tokenFilter) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(tokenFilter)
    .filter(Boolean)
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function referenceGeometryImportTranslationMode(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_TRANSLATION_MODE_TOKENS);
}

function referenceGeometryImportFirstTranslationMode(...values) {
  for (const value of values) {
    const mode = referenceGeometryImportTranslationMode(value);
    if (mode) return mode;
  }
  return "";
}

function referenceGeometryImportExecutionMode(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_EXECUTION_MODE_TOKENS);
}

function referenceGeometryImportExecutionModeArray(value) {
  return referenceGeometryImportKnownTokenArray(value, referenceGeometryImportExecutionMode);
}

function referenceGeometryImportAdapterOutputMode(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_ADAPTER_OUTPUT_MODE_TOKENS);
}

function referenceGeometryImportFirstAdapterOutputMode(...values) {
  for (const value of values) {
    const mode = referenceGeometryImportAdapterOutputMode(value);
    if (mode) return mode;
  }
  return "";
}

function referenceGeometryImportRoutingActionToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_ACTION_TOKENS);
}

function referenceGeometryImportFirstRoutingActionToken(...values) {
  for (const value of values) {
    const token = referenceGeometryImportRoutingActionToken(value);
    if (token) return token;
  }
  return "";
}

function referenceGeometryImportFixAreaToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_FIX_AREA_TOKENS);
}

function referenceGeometryImportFirstFixAreaToken(...values) {
  for (const value of values) {
    const token = referenceGeometryImportFixAreaToken(value);
    if (token) return token;
  }
  return "";
}

function referenceGeometryImportFailureKindToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_FAILURE_KIND_TOKENS);
}

function referenceGeometryImportReferenceSchemaName(value) {
  return cleanString(value) === REFERENCE_GEOMETRY_CANONICAL_SCHEMA_NAME ? REFERENCE_GEOMETRY_CANONICAL_SCHEMA_NAME : "";
}

function referenceGeometryImportReferenceSchemaVersion(value) {
  return cleanString(value) === REFERENCE_GEOMETRY_CANONICAL_SCHEMA_VERSION ? REFERENCE_GEOMETRY_CANONICAL_SCHEMA_VERSION : "";
}

function referenceGeometryImportReferenceUnits(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_REFERENCE_UNIT_TOKENS);
}

function referenceGeometryImportSourceTranslator(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (text === REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID) return text;
  if (text.startsWith("external:")) {
    const adapterId = referenceGeometryImportAdapterId(text.slice("external:".length));
    return adapterId ? `external:${adapterId}` : "";
  }
  return referenceGeometryImportMachineToken(text);
}

function referenceGeometryImportSourceTranslatorVersion(value) {
  const text = cleanString(value);
  return /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(text) ? text : "";
}

function referenceGeometryImportFirstReferenceSchemaName(...values) {
  for (const value of values) {
    const schema = referenceGeometryImportReferenceSchemaName(value);
    if (schema) return schema;
  }
  return "";
}

function referenceGeometryImportFirstReferenceSchemaVersion(...values) {
  for (const value of values) {
    const version = referenceGeometryImportReferenceSchemaVersion(value);
    if (version) return version;
  }
  return "";
}

function referenceGeometryImportFirstReferenceUnits(...values) {
  for (const value of values) {
    const units = referenceGeometryImportReferenceUnits(value);
    if (units) return units;
  }
  return "";
}

function referenceGeometryImportAuditStatusToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_AUDIT_STATUS_TOKENS);
}

function referenceGeometryImportAuditStatusArray(value) {
  return referenceGeometryImportKnownTokenArray(value, referenceGeometryImportAuditStatusToken);
}

function referenceGeometryImportAuditSeverityToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_AUDIT_SEVERITY_TOKENS);
}

function referenceGeometryImportDiagnosticSeverityToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_DIAGNOSTIC_SEVERITY_TOKENS);
}

function referenceGeometryImportObjectKindToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_OBJECT_KIND_TOKENS);
}

function referenceGeometryImportAdapterOutputValidationKindToken(value) {
  return referenceGeometryImportKnownToken(value, REFERENCE_GEOMETRY_IMPORT_ADAPTER_OUTPUT_VALIDATION_KIND_TOKENS);
}

function referenceGeometryImportMachineToken(value) {
  const token = cleanString(value);
  return /^[a-z0-9][a-z0-9-]*$/.test(token) ? token : "";
}

function referenceGeometryImportMachineTokenArray(value) {
  return referenceGeometryImportKnownTokenArray(value, referenceGeometryImportMachineToken);
}

function referenceGeometryImportFirstMachineToken(...values) {
  for (const value of values) {
    const token = referenceGeometryImportMachineToken(value);
    if (token) return token;
  }
  return "";
}

function referenceGeometryImportAdapterId(value) {
  const id = cleanString(value);
  return REFERENCE_SOURCE_ID_PATTERN.test(id) && !RESERVED_REFERENCE_SOURCE_IDS.has(id) ? id : "";
}

function referenceGeometryImportAssetId(value) {
  return isSafeProjectReferenceGeometryAssetId(value) ? cleanString(value) : "";
}

function referenceGeometryImportFirstAssetId(...values) {
  for (const value of values) {
    const id = referenceGeometryImportAssetId(value);
    if (id) return id;
  }
  return "";
}

function referenceGeometryImportFirstAdapterId(...values) {
  for (const value of values) {
    const id = referenceGeometryImportAdapterId(value);
    if (id) return id;
  }
  return "";
}

function referenceGeometryImportAdapterIdArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(referenceGeometryImportAdapterId)
    .filter(Boolean)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function referenceGeometryImportReferencePlanSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const decision = plainObject(resultJson.referenceImportPlanDecision)
    ? resultJson.referenceImportPlanDecision
    : (plainObject(resultJson.referenceTranslationPlanDecision) ? resultJson.referenceTranslationPlanDecision : resultJson);
  const preflightDecision = plainObject(resultJson.adapterPreflightDecision) ? resultJson.adapterPreflightDecision : {};
  const hasPlanPayload = stage === "plan-only"
    || plainObject(resultJson.referenceImportPlanDecision)
    || plainObject(resultJson.referenceTranslationPlanDecision)
    || resultJson.planOnly === true
    || referenceGeometryImportFirstSha256Fingerprint(resultJson.referenceImportPlanFingerprint, resultJson.referenceTranslationPlanFingerprint);
  if (!hasPlanPayload) return null;
  const safeNextExecutionMode = referenceGeometryImportExecutionMode(decision.safeNextExecutionMode || resultJson.safeNextExecutionMode);
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: decision.sourceFormat || resultJson.sourceFormat || resultJson.format,
    sourceRequestedFormat: decision.sourceRequestedFormat || resultJson.sourceRequestedFormat || resultJson.requestedFormat,
    sourceRequestedFormatAliases: decision.sourceRequestedFormatAliases || resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode || resultJson.referenceTranslationExecutionMode || resultJson.executionMode),
    planOnly: resultJson.planOnly === true || referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode || resultJson.referenceTranslationExecutionMode) === "plan-only",
    translationMode: referenceGeometryImportFirstTranslationMode(decision.translationMode, resultJson.translationMode),
    assetId: referenceGeometryImportFirstAssetId(decision.assetId, resultJson.assetId),
    referenceImportName: cleanString(resultJson.referenceImportName),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    projectPointerReady: firstNullableBoolean(decision.projectPointerReady, resultJson.projectPointerReady),
    adapterRequestCapable: firstNullableBoolean(decision.adapterRequestCapable, resultJson.adapterRequestCapable),
    canWriteAdapterRequest: firstNullableBoolean(decision.canWriteAdapterRequest, resultJson.canWriteAdapterRequest),
    adapterConfigProvided: firstNullableBoolean(decision.adapterConfigProvided, resultJson.adapterConfigProvided, cleanString(resultJson.adapterConfigStatFingerprint || resultJson.adapterConfigPath) ? true : null),
    adapterPreflightOk: firstNullableBoolean(decision.adapterPreflightOk, resultJson.adapterPreflightOk),
    safeNextExecutionMode,
    availableNextExecutionModes: Object.freeze(referenceGeometryImportExecutionModeArray(decision.availableNextExecutionModes || resultJson.availableNextExecutionModes)),
    safeNextAction: referenceGeometryImportFirstRoutingActionToken(decision.safeNextAction, resultJson.safeNextAction, safeNextExecutionMode ? `run-${safeNextExecutionMode}` : ""),
    recommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.recommendedNextAction, resultJson.recommendedNextAction),
    referenceImportPlanFingerprint: referenceGeometryImportFirstSha256Fingerprint(resultJson.referenceImportPlanFingerprint, resultJson.referenceTranslationPlanFingerprint),
    adapterRegistryFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.adapterRegistryFingerprint),
    adapterRegistryAdapterFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.adapterRegistryAdapterFingerprint),
    adapterPreflightFingerprint: referenceGeometryImportFirstSha256Fingerprint(resultJson.adapterPreflightFingerprint, preflightDecision.adapterPreflightFingerprint)
  });
}

function referenceGeometryImportReferenceAdapterRequestSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const decision = plainObject(resultJson.referenceImportAdapterRequestDecision)
    ? resultJson.referenceImportAdapterRequestDecision
    : (plainObject(resultJson.referenceTranslationAdapterRequestDecision) ? resultJson.referenceTranslationAdapterRequestDecision : resultJson);
  const preflightDecision = plainObject(resultJson.adapterPreflightDecision) ? resultJson.adapterPreflightDecision : {};
  const hasAdapterRequestPayload = stage === "adapter-request"
    || plainObject(resultJson.referenceImportAdapterRequestDecision)
    || plainObject(resultJson.referenceTranslationAdapterRequestDecision)
    || resultJson.adapterRequestOnly === true
    || decision.adapterRequestOnly === true
    || decision.adapterRequestReady !== undefined
    || resultJson.adapterRequestReady !== undefined
    || referenceGeometryImportFirstSha256Fingerprint(decision.adapterRequestFingerprint, resultJson.adapterRequestFingerprint);
  if (!hasAdapterRequestPayload) return null;
  const adapterRequestReady = firstNullableBoolean(decision.adapterRequestReady, resultJson.adapterRequestReady);
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: decision.sourceFormat || resultJson.sourceFormat || resultJson.format,
    sourceRequestedFormat: decision.sourceRequestedFormat || resultJson.sourceRequestedFormat || resultJson.requestedFormat,
    sourceRequestedFormatAliases: decision.sourceRequestedFormatAliases || resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode || resultJson.referenceTranslationExecutionMode || resultJson.executionMode),
    adapterRequestReady,
    adapterStageDirectoriesReady: firstNullableBoolean(decision.adapterStageDirectoriesReady, resultJson.adapterStageDirectoriesReady),
    adapterRequestWritten: firstNullableBoolean(decision.adapterRequestWritten, resultJson.adapterRequestWritten, adapterRequestReady === true ? true : null),
    adapterRequestOnly: resultJson.adapterRequestOnly === true || decision.adapterRequestOnly === true || referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode || resultJson.referenceTranslationExecutionMode) === "adapter-request",
    translationMode: referenceGeometryImportFirstTranslationMode(decision.translationMode, resultJson.translationMode),
    assetId: referenceGeometryImportFirstAssetId(decision.assetId, resultJson.assetId),
    referenceImportName: cleanString(resultJson.referenceImportName),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    adapterKey: referenceGeometryImportFirstAdapterId(decision.adapterKey, resultJson.adapterKey, resultJson.sourceAdapter),
    adapterOutputMode: referenceGeometryImportFirstAdapterOutputMode(decision.adapterOutputMode, resultJson.adapterOutputMode, resultJson.outputMode),
    adapterConfigProvided: firstNullableBoolean(decision.adapterConfigProvided, resultJson.adapterConfigProvided, cleanString(resultJson.adapterConfigStatFingerprint || resultJson.adapterConfigPath) ? true : null),
    adapterPreflightOk: firstNullableBoolean(decision.adapterPreflightOk, resultJson.adapterPreflightOk),
    adapterPreflightReady: firstNullableBoolean(decision.adapterPreflightReady, preflightDecision.adapterPreflightReady, resultJson.adapterPreflightReady),
    adapterPreflightLikelyFixArea: referenceGeometryImportFirstFixAreaToken(decision.adapterPreflightLikelyFixArea, preflightDecision.likelyFixArea, resultJson.adapterPreflightLikelyFixArea),
    adapterPreflightRecommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.adapterPreflightRecommendedNextAction, preflightDecision.recommendedNextAction, resultJson.adapterPreflightRecommendedNextAction),
    validatesCanonicalOutput: firstNullableBoolean(decision.validatesCanonicalOutput, resultJson.validatesCanonicalOutput),
    outputValidationRequired: firstNullableBoolean(decision.outputValidationRequired, resultJson.outputValidationRequired),
    safeNextAction: referenceGeometryImportFirstRoutingActionToken(decision.safeNextAction, resultJson.safeNextAction),
    recommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.recommendedNextAction, resultJson.recommendedNextAction),
    referenceImportPlanFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceImportPlanFingerprint, resultJson.referenceImportPlanFingerprint),
    adapterRequestFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.adapterRequestFingerprint, resultJson.adapterRequestFingerprint),
    adapterRegistryFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.adapterRegistryFingerprint, resultJson.adapterRegistryFingerprint),
    adapterRegistryAdapterFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.adapterRegistryAdapterFingerprint, resultJson.adapterRegistryAdapterFingerprint),
    adapterPreflightFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.adapterPreflightFingerprint, resultJson.adapterPreflightFingerprint)
  });
}

function referenceGeometryImportReferenceOutputSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const hasReferenceOutput = ["dry-run", "import"].includes(stage)
    || referenceGeometryImportFirstSha256Fingerprint(resultJson.referenceTranslatedManifestFingerprint, resultJson.referenceManifestFingerprint)
    || resultJson.referenceObjectCount !== undefined
    || resultJson.referencePointCloudPointCount !== undefined;
  if (!hasReferenceOutput) return null;
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: resultJson.sourceFormat,
    sourceRequestedFormat: resultJson.sourceRequestedFormat,
    sourceRequestedFormatAliases: resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode),
    dryRun: resultJson.dryRun === true,
    replacedExisting: resultJson.replacedExisting === true,
    translationMode: referenceGeometryImportTranslationMode(resultJson.translationMode),
    assetId: referenceGeometryImportAssetId(resultJson.assetId),
    referenceImportName: cleanString(resultJson.referenceImportName),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    sourceAdapter: referenceGeometryImportAdapterId(resultJson.sourceAdapter),
    sourceTranslator: referenceGeometryImportSourceTranslator(resultJson.sourceTranslator),
    sourceTranslatorVersion: referenceGeometryImportSourceTranslatorVersion(resultJson.sourceTranslatorVersion),
    referenceSchema: referenceGeometryImportReferenceSchemaName(resultJson.referenceSchema),
    referenceSchemaVersion: referenceGeometryImportReferenceSchemaVersion(resultJson.referenceSchemaVersion),
    referenceUnits: referenceGeometryImportReferenceUnits(resultJson.referenceUnits),
    referenceBoundsMin: finiteNumberTuple(resultJson.referenceBoundsMin, 3),
    referenceBoundsMax: finiteNumberTuple(resultJson.referenceBoundsMax, 3),
    referenceObjectCount: nullableNonNegativeInteger(resultJson.referenceObjectCount),
    referenceLayerCount: nullableNonNegativeInteger(resultJson.referenceLayerCount),
    referenceChunkCount: nullableNonNegativeInteger(resultJson.referenceChunkCount),
    referenceLineSegmentCount: nullableNonNegativeInteger(resultJson.referenceLineSegmentCount),
    referenceMeshFaceCount: nullableNonNegativeInteger(resultJson.referenceMeshFaceCount),
    referencePointCloudPointCount: nullableNonNegativeInteger(resultJson.referencePointCloudPointCount),
    referenceChunkPointCount: nullableNonNegativeInteger(resultJson.referenceChunkPointCount),
    referenceChunkFileCount: nullableNonNegativeInteger(resultJson.referenceChunkFileCount),
    referenceChunkFileMissingCount: nullableNonNegativeInteger(resultJson.referenceChunkFileMissingCount),
    diagnosticCount: nullableNonNegativeInteger(resultJson.diagnosticCount),
    diagnosticSeverityCounts: cleanDiagnosticSeverityCountRecord(resultJson.diagnosticSeverityCounts),
    diagnosticCodeCounts: cleanMachineTokenCountRecord(resultJson.diagnosticCodeCounts),
    referenceObjectKindCounts: cleanObjectKindCountRecord(resultJson.referenceObjectKindCounts),
    referenceTranslatedManifestFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceTranslatedManifestFingerprint),
    referenceTranslatedArtifactFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceTranslatedArtifactFingerprint),
    referenceManifestFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceManifestFingerprint),
    referenceArtifactFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceArtifactFingerprint)
  });
}

function referenceGeometryImportReferencePromotionSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const decision = plainObject(resultJson.referenceImportPromotionDecision) ? resultJson.referenceImportPromotionDecision : resultJson;
  const hasPromotionPayload = stage === "import"
    || plainObject(resultJson.referenceImportPromotionDecision)
    || decision.projectJsonWritten !== undefined
    || decision.targetReferenceManifestWritten !== undefined
    || decision.promotedOutputFingerprintsReady !== undefined
    || referenceGeometryImportFirstSha256Fingerprint(decision.referenceManifestFingerprint, resultJson.referenceManifestFingerprint);
  if (!hasPromotionPayload) return null;
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: decision.sourceFormat || resultJson.sourceFormat || resultJson.format,
    sourceRequestedFormat: decision.sourceRequestedFormat || resultJson.sourceRequestedFormat || resultJson.requestedFormat,
    sourceRequestedFormatAliases: decision.sourceRequestedFormatAliases || resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode || resultJson.executionMode),
    replacedExisting: firstNullableBoolean(decision.replacedExisting, resultJson.replacedExisting),
    translationMode: referenceGeometryImportFirstTranslationMode(decision.translationMode, resultJson.translationMode),
    assetId: referenceGeometryImportFirstAssetId(decision.assetId, resultJson.assetId),
    referenceImportName: cleanString(resultJson.referenceImportName),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    sourceAdapter: referenceGeometryImportFirstAdapterId(decision.adapterKey, resultJson.sourceAdapter, resultJson.adapterKey),
    sourceTranslator: referenceGeometryImportSourceTranslator(resultJson.sourceTranslator),
    sourceTranslatorVersion: referenceGeometryImportSourceTranslatorVersion(resultJson.sourceTranslatorVersion),
    adapterRequestFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.adapterRequestFingerprint, resultJson.adapterRequestFingerprint),
    referenceSchema: referenceGeometryImportFirstReferenceSchemaName(decision.referenceSchema, resultJson.referenceSchema),
    referenceSchemaVersion: referenceGeometryImportFirstReferenceSchemaVersion(decision.referenceSchemaVersion, resultJson.referenceSchemaVersion),
    referenceUnits: referenceGeometryImportFirstReferenceUnits(decision.referenceUnits, resultJson.referenceUnits),
    referenceObjectCount: nullableNonNegativeInteger(decision.referenceObjectCount ?? resultJson.referenceObjectCount),
    referenceLayerCount: nullableNonNegativeInteger(decision.referenceLayerCount ?? resultJson.referenceLayerCount),
    referenceChunkCount: nullableNonNegativeInteger(decision.referenceChunkCount ?? resultJson.referenceChunkCount),
    referenceChunkFileCount: nullableNonNegativeInteger(decision.referenceChunkFileCount ?? resultJson.referenceChunkFileCount),
    referenceChunkFileMissingCount: nullableNonNegativeInteger(decision.referenceChunkFileMissingCount ?? resultJson.referenceChunkFileMissingCount),
    diagnosticCount: nullableNonNegativeInteger(decision.diagnosticCount ?? resultJson.diagnosticCount),
    projectPointerReady: firstNullableBoolean(decision.projectPointerReady, resultJson.projectPointerReady),
    projectJsonWritten: firstNullableBoolean(decision.projectJsonWritten, resultJson.projectJsonWritten),
    projectPointerWritten: firstNullableBoolean(decision.projectPointerWritten, resultJson.projectPointerWritten),
    targetReferenceManifestWritten: firstNullableBoolean(decision.targetReferenceManifestWritten, resultJson.targetReferenceManifestWritten),
    targetReferenceManifestValidated: firstNullableBoolean(decision.targetReferenceManifestValidated, resultJson.targetReferenceManifestValidated),
    translatedOutputPromoted: firstNullableBoolean(decision.translatedOutputPromoted, resultJson.translatedOutputPromoted),
    promotedOutputFingerprintsReady: firstNullableBoolean(decision.promotedOutputFingerprintsReady, resultJson.promotedOutputFingerprintsReady),
    chunkSidecarsReady: firstNullableBoolean(decision.chunkSidecarsReady, resultJson.chunkSidecarsReady),
    safeNextAction: referenceGeometryImportFirstRoutingActionToken(decision.safeNextAction, resultJson.safeNextAction),
    recommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.recommendedNextAction, resultJson.recommendedNextAction),
    referenceImportPlanFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceImportPlanFingerprint, resultJson.referenceImportPlanFingerprint),
    referenceTranslatedManifestFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceTranslatedManifestFingerprint, resultJson.referenceTranslatedManifestFingerprint),
    referenceTranslatedArtifactFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceTranslatedArtifactFingerprint, resultJson.referenceTranslatedArtifactFingerprint),
    referenceManifestFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceManifestFingerprint, resultJson.referenceManifestFingerprint),
    referenceArtifactFingerprint: referenceGeometryImportFirstSha256Fingerprint(decision.referenceArtifactFingerprint, resultJson.referenceArtifactFingerprint)
  });
}

function referenceGeometryImportReferenceAuditSummary(resultJson = null, stageId = "") {
  if (!plainObject(resultJson)) return null;
  const stage = cleanString(stageId || resultJson.stageId || resultJson.referenceImportWorkflowStatus?.workflowStage);
  const decision = plainObject(resultJson.referenceAuditDecision) ? resultJson.referenceAuditDecision : resultJson;
  const aggregate = plainObject(resultJson.referenceAggregate) ? resultJson.referenceAggregate : {};
  const aggregateValue = (field) => resultJson[field] ?? aggregate[field];
  const hasAuditPayload = stage === "check-references"
    || plainObject(resultJson.referenceAuditDecision)
    || referenceGeometryImportSha256Fingerprint(resultJson.referenceAuditFingerprint)
    || resultJson.referenceReadyCount !== undefined
    || resultJson.referenceNeedsAttentionCount !== undefined;
  if (!hasAuditPayload) return null;
  return Object.freeze({
    ok: resultJson.ok === true,
    summaryOnly: resultJson.summaryOnly === true,
    requestedAssetId: referenceGeometryImportFirstAssetId(resultJson.requestedAssetId, decision.requestedAssetId),
    referenceAssetCount: nullableNonNegativeInteger(resultJson.referenceAssetCount ?? decision.referenceAssetCount),
    referenceReadyCount: nullableNonNegativeInteger(resultJson.referenceReadyCount ?? decision.referenceReadyCount),
    referenceNeedsAttentionCount: nullableNonNegativeInteger(resultJson.referenceNeedsAttentionCount ?? decision.referenceNeedsAttentionCount),
    referenceAuditErrorCount: nullableNonNegativeInteger(resultJson.referenceAuditErrorCount ?? decision.referenceAuditErrorCount),
    auditPassed: decision.auditPassed === true,
    referenceOverlayReady: decision.referenceOverlayReady === true,
    blockingStatuses: Object.freeze(referenceGeometryImportAuditStatusArray(decision.blockingStatuses)),
    highestPriorityStatus: referenceGeometryImportAuditStatusToken(decision.highestPriorityStatus),
    highestPrioritySeverity: referenceGeometryImportAuditSeverityToken(decision.highestPrioritySeverity),
    highestPriorityAssetId: referenceGeometryImportAssetId(decision.highestPriorityAssetId),
    likelyFixArea: referenceGeometryImportFixAreaToken(decision.likelyFixArea),
    safeNextAction: referenceGeometryImportRoutingActionToken(decision.safeNextAction),
    recommendedNextAction: referenceGeometryImportRoutingActionToken(decision.recommendedNextAction),
    referenceAuditStatusCounts: cleanAuditStatusCountRecord(resultJson.referenceAuditStatusCounts || aggregate.auditStatusCounts),
    referenceAuditSeverityCounts: cleanAuditSeverityCountRecord(resultJson.referenceAuditSeverityCounts || aggregate.auditSeverityCounts),
    selectedAssetCount: nullableNonNegativeInteger(aggregateValue("selectedAssetCount")),
    readyAssetCount: nullableNonNegativeInteger(aggregateValue("readyAssetCount")),
    needsAttentionAssetCount: nullableNonNegativeInteger(aggregateValue("needsAttentionAssetCount")),
    canonicalManifestCount: nullableNonNegativeInteger(aggregateValue("canonicalManifestCount")),
    readyCanonicalManifestCount: nullableNonNegativeInteger(aggregateValue("readyCanonicalManifestCount")),
    objectCount: nullableNonNegativeInteger(aggregateValue("objectCount")),
    layerCount: nullableNonNegativeInteger(aggregateValue("layerCount")),
    chunkCount: nullableNonNegativeInteger(aggregateValue("chunkCount")),
    lineSegmentCount: nullableNonNegativeInteger(aggregateValue("lineSegmentCount")),
    meshFaceCount: nullableNonNegativeInteger(aggregateValue("meshFaceCount")),
    pointCloudPointCount: nullableNonNegativeInteger(aggregateValue("pointCloudPointCount")),
    chunkFileCount: nullableNonNegativeInteger(aggregateValue("chunkFileCount")),
    chunkFileMissingCount: nullableNonNegativeInteger(aggregateValue("chunkFileMissingCount")),
    chunkFileInvalidCount: nullableNonNegativeInteger(aggregateValue("chunkFileInvalidCount")),
    chunkPointCount: nullableNonNegativeInteger(aggregateValue("chunkPointCount")),
    diagnosticCount: nullableNonNegativeInteger(aggregateValue("diagnosticCount")),
    sourceFormatCounts: cleanTokenCountRecord(resultJson.sourceFormatCounts || aggregate.sourceFormatCounts, referenceGeometryImportFormatToken),
    sourceAdapterCounts: cleanTokenCountRecord(resultJson.sourceAdapterCounts || aggregate.sourceAdapterCounts, referenceGeometryImportAdapterId),
    objectKindCounts: cleanObjectKindCountRecord(resultJson.objectKindCounts || aggregate.objectKindCounts),
    referenceAuditFingerprint: referenceGeometryImportSha256Fingerprint(resultJson.referenceAuditFingerprint)
  });
}

function referenceGeometryImportReferenceFailureSummary(
  resultJson = null,
  stageId = "",
  responseStatus = "",
  safeNextAction = "",
  recommendedNextAction = ""
) {
  if (!plainObject(resultJson)) return null;
  const workflowStatus = plainObject(resultJson.referenceImportWorkflowStatus) ? resultJson.referenceImportWorkflowStatus : {};
  const decision = plainObject(resultJson.referenceImportFailureDecision) ? resultJson.referenceImportFailureDecision : resultJson;
  const errors = Array.isArray(resultJson.errors) ? resultJson.errors : [];
  const primary = plainObject(errors[0]) ? errors[0] : {};
  const hasPrimaryPreflightDecision = plainObject(primary.adapterPreflightDecision);
  const hasTopLevelPreflightDecision = plainObject(resultJson.adapterPreflightDecision);
  const preflightDecision = hasPrimaryPreflightDecision
    ? primary.adapterPreflightDecision
    : (hasTopLevelPreflightDecision ? resultJson.adapterPreflightDecision : {});
  const stage = referenceGeometryImportKnownStageId(stageId || decision.failedWorkflowStage || workflowStatus.workflowStage);
  if (stage === "check-references" && plainObject(resultJson.referenceAuditDecision)) return null;
  const adapterErrorCode = referenceGeometryImportFirstMachineToken(decision.adapterErrorCode, primary.adapterErrorCode, resultJson.adapterErrorCode);
  const preflightLikelyFixArea = referenceGeometryImportFixAreaToken(preflightDecision.likelyFixArea);
  const preflightRetryWorkflowStage = stage === "adapter-preflight" && (hasPrimaryPreflightDecision || hasTopLevelPreflightDecision) ? "adapter-preflight" : "";
  const safeResponseStatus = referenceGeometryImportWorkspaceResponseStatusToken(responseStatus);
  const hasFailurePayload = resultJson.ok === false
    || safeResponseStatus === "failed"
    || plainObject(resultJson.referenceImportFailureDecision)
    || adapterErrorCode
    || errors.length > 0;
  if (!hasFailurePayload) return null;
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat: primary.sourceFormat || resultJson.sourceFormat,
    sourceRequestedFormat: primary.sourceRequestedFormat || resultJson.sourceRequestedFormat,
    sourceRequestedFormatAliases: resultJson.sourceRequestedFormatAliases
  });
  return Object.freeze({
    ok: resultJson.ok === true,
    stageId: stage,
    executionMode: referenceGeometryImportExecutionMode(resultJson.referenceImportExecutionMode),
    responseStatus: safeResponseStatus,
    failedWorkflowStage: referenceGeometryImportKnownStageId(decision.failedWorkflowStage || workflowStatus.workflowStage || stage),
    workflowStageComplete: firstNullableBoolean(decision.workflowStageComplete, workflowStatus.workflowStageComplete),
    adapterErrorCode,
    failureKind: referenceGeometryImportFailureKindToken(decision.failureKind) || (stage === "adapter-preflight" ? referenceGeometryImportFailureKindToken(preflightLikelyFixArea) : ""),
    likelyFixArea: referenceGeometryImportFirstFixAreaToken(decision.likelyFixArea, preflightDecision.likelyFixArea),
    safeNextAction: referenceGeometryImportFirstRoutingActionToken(decision.safeNextAction, preflightDecision.safeNextAction, safeNextAction),
    recommendedNextAction: referenceGeometryImportFirstRoutingActionToken(decision.recommendedNextAction, preflightDecision.recommendedNextAction, recommendedNextAction),
    retryWorkflowStage: referenceGeometryImportKnownStageId(decision.retryWorkflowStage || preflightRetryWorkflowStage),
    adapterConfigRequired: decision.adapterConfigRequired === true,
    adapterDependencyReviewRequired: decision.adapterDependencyReviewRequired === true || (stage === "adapter-preflight" && preflightLikelyFixArea === "adapter-dependency"),
    adapterRequestReviewRequired: decision.adapterRequestReviewRequired === true,
    adapterRunInspectionRequired: decision.adapterRunInspectionRequired === true,
    canonicalOutputFixRequired: decision.canonicalOutputFixRequired === true,
    importOptionFixRequired: decision.importOptionFixRequired === true,
    cliOptionFixRequired: decision.cliOptionFixRequired === true,
    adapterOutputValidationKind: referenceGeometryImportAdapterOutputValidationKindToken(primary.adapterOutputValidationKind || resultJson.adapterOutputValidationKind),
    referenceImportPlanFingerprint: referenceGeometryImportFirstSha256Fingerprint(primary.referenceImportPlanFingerprint, resultJson.referenceImportPlanFingerprint),
    adapterRequestFingerprint: referenceGeometryImportFirstSha256Fingerprint(primary.adapterRequestFingerprint, resultJson.adapterRequestFingerprint),
    adapterRegistryFingerprint: referenceGeometryImportFirstSha256Fingerprint(primary.adapterRegistryFingerprint, resultJson.adapterRegistryFingerprint),
    adapterRegistryAdapterFingerprint: referenceGeometryImportFirstSha256Fingerprint(primary.adapterRegistryAdapterFingerprint, resultJson.adapterRegistryAdapterFingerprint),
    adapterPreflightFingerprint: referenceGeometryImportFirstSha256Fingerprint(primary.adapterPreflightFingerprint, resultJson.adapterPreflightFingerprint),
    sourceFormat: sourceMetadata.sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily,
    translationMode: referenceGeometryImportTranslationMode(resultJson.translationMode),
    sourceAdapter: referenceGeometryImportFirstAdapterId(primary.adapter, resultJson.sourceAdapter),
    errorCount: nullableNonNegativeInteger(errors.length)
  });
}

function arrayStrings(value) {
  return Array.isArray(value) ? uniqueStrings(value.map((entry) => cleanString(entry)).filter(Boolean)) : [];
}

function arrayObjects(value) {
  return Array.isArray(value) ? value.filter(plainObject) : [];
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function nullableNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function firstNullableBoolean(...values) {
  for (const value of values) {
    const bool = nullableBoolean(value);
    if (bool !== null) return bool;
  }
  return null;
}

function finiteNumberTuple(value, length) {
  if (!Array.isArray(value) || value.length !== length) return null;
  const numbers = value.map((entry) => Number(entry));
  return numbers.every(Number.isFinite) ? Object.freeze(numbers) : null;
}

function cleanCountRecord(value) {
  if (!plainObject(value)) return Object.freeze({});
  return Object.freeze(Object.fromEntries(Object.entries(value)
    .map(([key, count]) => [cleanString(key), nullableNonNegativeInteger(count)])
    .filter(([key, count]) => key && count !== null)));
}

function cleanTokenCountRecord(value, keyFilter) {
  if (!plainObject(value)) return Object.freeze({});
  return Object.freeze(Object.fromEntries(Object.entries(value)
    .map(([key, count]) => [keyFilter(key), nullableNonNegativeInteger(count)])
    .filter(([key, count]) => key && count !== null)));
}

function cleanMachineTokenCountRecord(value) {
  return cleanTokenCountRecord(value, referenceGeometryImportMachineToken);
}

function cleanDiagnosticSeverityCountRecord(value) {
  return cleanTokenCountRecord(value, referenceGeometryImportDiagnosticSeverityToken);
}

function cleanAuditStatusCountRecord(value) {
  return cleanTokenCountRecord(value, referenceGeometryImportAuditStatusToken);
}

function cleanAuditSeverityCountRecord(value) {
  return cleanTokenCountRecord(value, referenceGeometryImportAuditSeverityToken);
}

function cleanObjectKindCountRecord(value) {
  return cleanTokenCountRecord(value, referenceGeometryImportObjectKindToken);
}

function referenceGeometryImportObjectField(source, fieldName = "") {
  const field = cleanString(fieldName);
  if (!field || !plainObject(source?.[field])) return null;
  return Object.freeze({ ...source[field] });
}

function referenceGeometryImportExitCode(value) {
  if (value === undefined || value === null || value === "") return null;
  const code = Number(value);
  return Number.isInteger(code) ? code : null;
}

function referenceGeometryImportWorkspaceRequestBlockedReason(plan = {}, { writeConfirmed = false } = {}) {
  if (plan.stageKnown !== true) return "unknown-stage";
  if ((plan.missingInputDescriptorIds || []).length > 0) return "missing-required-inputs";
  if ((plan.invalidInputDescriptorIds || []).length > 0 || (plan.invalidImportOptionFields || []).length > 0) return "invalid-input-values";
  if (plan.canBuildArgv !== true) return "unsupported-source-or-stage";
  if (plan.requiresWriteConfirmation === true && writeConfirmed !== true) return "write-confirmation-required";
  return "";
}

function referenceGeometryImportWorkspaceSafeNextAction(blockedReason = "") {
  if (blockedReason === "missing-required-inputs") return "collect-required-inputs";
  if (blockedReason === "invalid-input-values") return "fix-import-options";
  if (blockedReason === "write-confirmation-required") return "confirm-promoted-write";
  if (blockedReason === "unknown-stage") return "choose-workflow-stage";
  if (blockedReason === "unsupported-source-or-stage") return "choose-supported-reference-source";
  return "review-workspace-request";
}

function referenceGeometryImportSessionLastResponse(input = {}) {
  const directCandidates = [
    input.lastWorkspaceResponse,
    input.workspaceResponse,
    input.lastResponse
  ];
  for (const candidate of directCandidates) {
    if (!plainObject(candidate)) continue;
    if (candidate.id === REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID || cleanString(candidate.responseStatus)) {
      return referenceGeometryImportWorkspaceResponseEnvelope(candidate);
    }
    if (referenceGeometryImportSessionResponseCandidate(candidate)) {
      return referenceGeometryImportWorkspaceResponse(candidate);
    }
  }
  const hostCandidates = [
    input.response,
    input.hostResponse,
    input.workspaceHostResponse,
    input.commandHostResponse
  ];
  for (const candidate of hostCandidates) {
    if (!plainObject(candidate)) continue;
    if (candidate.id === REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE_DESCRIPTOR_ID || cleanString(candidate.responseStatus)) {
      return referenceGeometryImportWorkspaceResponseEnvelope(candidate);
    }
    return referenceGeometryImportWorkspaceResponse({
      ...candidate,
      request: candidate.request || input.workspaceRequest || input.request
    });
  }
  if (referenceGeometryImportSessionResponseCandidate(input)) {
    return referenceGeometryImportWorkspaceResponse({
      ...input,
      request: input.workspaceRequest || input.request
    });
  }
  return null;
}

function referenceGeometryImportSessionResponseCandidate(input = {}) {
  return Boolean(
    plainObject(input)
    && (
      plainObject(referenceGeometryImportWorkspaceParsedResult(input))
      || cleanString(input.hostError || input.error)
      || input.exitCode !== undefined
      || plainObject(input.result)
      || plainObject(input.hostResult)
    )
  );
}

function referenceGeometryImportSessionCompletedStages(input = {}, lastWorkspaceResponse = null) {
  const workflowStatus = plainObject(lastWorkspaceResponse?.workflowStatus) ? lastWorkspaceResponse.workflowStatus : {};
  const completed = [
    ...(Array.isArray(input.completedWorkflowStages) ? input.completedWorkflowStages : []),
    ...(Array.isArray(input.completedStages) ? input.completedStages : []),
    ...(Array.isArray(input.completedStageIds) ? input.completedStageIds : []),
    ...(Array.isArray(workflowStatus.completedWorkflowStages) ? workflowStatus.completedWorkflowStages : []),
    ...(Array.isArray(workflowStatus.completedStages) ? workflowStatus.completedStages : [])
  ];
  if (lastWorkspaceResponse?.responseStatus === "succeeded") completed.push(lastWorkspaceResponse.stageId);
  return referenceGeometryImportOrderedWorkflowStages(completed);
}

function referenceGeometryImportSessionFailedStage(lastWorkspaceResponse = null) {
  if (!plainObject(lastWorkspaceResponse)) return "";
  if (lastWorkspaceResponse.responseStatus === "succeeded") return "";
  return referenceGeometryImportKnownStageId(
    lastWorkspaceResponse.failureDecision?.failedWorkflowStage
    || lastWorkspaceResponse.workflowStatus?.failedWorkflowStage
    || lastWorkspaceResponse.failureDecision?.retryWorkflowStage
    || lastWorkspaceResponse.stageId
  );
}

function referenceGeometryImportSessionRetryStage(lastWorkspaceResponse = null) {
  if (!plainObject(lastWorkspaceResponse)) return "";
  if (lastWorkspaceResponse.responseStatus === "succeeded") return "";
  return referenceGeometryImportKnownStageId(
    lastWorkspaceResponse.failureDecision?.retryWorkflowStage
    || lastWorkspaceResponse.referenceFailureSummary?.retryWorkflowStage
  );
}

function referenceGeometryImportSessionRequestedStage(input = {}) {
  return referenceGeometryImportKnownStageId(
    input.currentStageId
    || input.stageId
    || input.workflowStage
    || input.referenceImportStage
    || input.requestedStageId
  );
}

function referenceGeometryImportSessionCurrentStage({
  requestedStageId = "",
  actionPreview = {},
  lastWorkspaceResponse = null,
  failedWorkflowStage = "",
  retryWorkflowStage = ""
} = {}) {
  if (requestedStageId) return requestedStageId;
  if (plainObject(lastWorkspaceResponse)) {
    if (lastWorkspaceResponse.responseStatus === "succeeded") {
      const explicitNextStage = referenceGeometryImportSessionResponseNextStage(lastWorkspaceResponse);
      if (explicitNextStage) return explicitNextStage;
      return referenceGeometryImportSessionSuccessFallbackStage(lastWorkspaceResponse.stageId, actionPreview)
        || "source-discovery";
    }
    return retryWorkflowStage
      || failedWorkflowStage
      || referenceGeometryImportKnownStageId(lastWorkspaceResponse.stageId)
      || referenceGeometryImportKnownStageId(actionPreview.primaryStageId)
      || "source-discovery";
  }
  return referenceGeometryImportKnownStageId(actionPreview.primaryStageId)
    || referenceGeometryImportKnownStageId(actionPreview.recommendedWorkflowStage)
    || "source-discovery";
}

function referenceGeometryImportSessionResponseNextStage(lastWorkspaceResponse = {}) {
  return referenceGeometryImportKnownStageId(
    lastWorkspaceResponse.stageDecision?.nextWorkflowStage
    || lastWorkspaceResponse.stageDecision?.recommendedWorkflowStage
    || lastWorkspaceResponse.workflowStatus?.nextWorkflowStage
    || lastWorkspaceResponse.workflowStatus?.recommendedNextWorkflowStage
    || lastWorkspaceResponse.workflowStatus?.recommendedWorkflowStage
    || (Array.isArray(lastWorkspaceResponse.workflowStatus?.nextWorkflowStages)
      ? lastWorkspaceResponse.workflowStatus.nextWorkflowStages[0]
      : "")
    || lastWorkspaceResponse.failureDecision?.retryWorkflowStage
  );
}

function referenceGeometryImportSessionSuccessFallbackStage(stageId = "", actionPreview = {}) {
  const stage = cleanString(stageId);
  if (stage === "source-discovery") {
    return referenceGeometryImportKnownStageId(actionPreview.primaryStageId)
      || referenceGeometryImportKnownStageId(actionPreview.recommendedWorkflowStage)
      || referenceGeometryImportSessionSuccessNextStage(stage);
  }
  return referenceGeometryImportSessionSuccessNextStage(stage)
    || referenceGeometryImportKnownStageId(actionPreview.primaryStageId)
    || referenceGeometryImportKnownStageId(actionPreview.recommendedWorkflowStage);
}

function referenceGeometryImportSessionSuccessNextStage(stageId = "") {
  const stage = cleanString(stageId);
  if (stage === "adapter-preflight") return "plan-only";
  if (stage === "source-discovery") return "plan-only";
  if (stage === "plan-only") return "dry-run";
  if (stage === "adapter-request") return "dry-run";
  if (stage === "dry-run") return "import";
  if (stage === "import") return "check-references";
  if (stage === "check-references") return "check-references";
  return "";
}

function referenceGeometryImportSessionNextActionToken({
  actionPreview = {},
  nextWorkspaceRequest = null,
  lastWorkspaceResponse = null,
  canSubmitNextRequest = false,
  dryRunGateBlocked = false,
  blockedReason = ""
} = {}) {
  if (dryRunGateBlocked) return "run-dry-run-before-import";
  if (plainObject(lastWorkspaceResponse) && lastWorkspaceResponse.responseStatus !== "succeeded") {
    return referenceGeometryImportRoutingActionToken(lastWorkspaceResponse.safeNextAction) || "inspect-reference-import-result";
  }
  if (canSubmitNextRequest) return "submit-workspace-command";
  return referenceGeometryImportRoutingActionToken(nextWorkspaceRequest?.safeNextAction)
    || referenceGeometryImportSessionSafeNextAction(blockedReason)
    || referenceGeometryImportRoutingActionToken(lastWorkspaceResponse?.safeNextAction)
    || referenceGeometryImportRoutingActionToken(actionPreview.primaryActionToken)
    || "choose-supported-reference-source";
}

function referenceGeometryImportSessionSafeNextAction(blockedReason = "") {
  if (blockedReason === "dry-run-required-before-import") return "run-dry-run-before-import";
  return "";
}

function referenceGeometryImportSessionStageStates({
  input = {},
  actionPreview = {},
  completedWorkflowStages = [],
  failedWorkflowStage = "",
  currentStageId = ""
} = {}) {
  const completed = new Set(completedWorkflowStages);
  return Object.freeze((actionPreview.stageActions || []).map((stageAction) => {
    const plan = referenceGeometryImportCommandPlan({ ...input, stageId: stageAction.id });
    const canSubmitWorkspaceRequest = Boolean(plan.canBuildArgv && (!plan.requiresWriteConfirmation || input.writeConfirmed === true));
    return Object.freeze({
      id: stageAction.id,
      label: stageAction.label,
      availability: stageAction.availability,
      actionState: stageAction.actionState,
      actionToken: stageAction.actionToken,
      completed: completed.has(stageAction.id),
      failed: failedWorkflowStage === stageAction.id,
      current: currentStageId === stageAction.id,
      canBuildArgv: plan.canBuildArgv === true,
      canSubmitWorkspaceRequest,
      missingInputDescriptorIds: Object.freeze([...(plan.missingInputDescriptorIds || [])]),
      invalidInputDescriptorIds: Object.freeze([...(plan.invalidInputDescriptorIds || [])]),
      invalidImportOptionFields: Object.freeze([...(plan.invalidImportOptionFields || [])]),
      requiresWriteConfirmation: plan.requiresWriteConfirmation === true,
      sideEffectClass: plan.sideEffectClass || stageAction.sideEffectClass || ""
    });
  }));
}

function referenceGeometryImportOrderedWorkflowStages(values = []) {
  const stages = uniqueStrings(values).filter((stage) => REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER.includes(stage));
  return Object.freeze(stages.sort((left, right) => (
    REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER.indexOf(left) - REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER.indexOf(right)
  )));
}

function referenceGeometryImportKnownStageId(stageId = "") {
  const stage = cleanString(stageId);
  return REFERENCE_GEOMETRY_IMPORT_SAFE_WORKFLOW_ORDER.includes(stage) ? stage : "";
}

function referenceGeometryImportRequestId(requestId, payload = {}) {
  const requested = cleanString(requestId);
  if (REFERENCE_SOURCE_ID_PATTERN.test(requested) && !RESERVED_REFERENCE_SOURCE_IDS.has(requested)) return requested;
  return `reference-import-${referenceGeometryImportStableHash(payload)}`;
}

function referenceGeometryImportSessionId(sessionId, payload = {}) {
  const requested = cleanString(sessionId);
  if (REFERENCE_SOURCE_ID_PATTERN.test(requested) && !RESERVED_REFERENCE_SOURCE_IDS.has(requested)) return requested;
  return `reference-import-session-${referenceGeometryImportStableHash(payload)}`;
}

function referenceGeometryImportResponseId(responseId, payload = {}) {
  const requested = cleanString(responseId);
  if (REFERENCE_SOURCE_ID_PATTERN.test(requested) && !RESERVED_REFERENCE_SOURCE_IDS.has(requested)) return requested;
  return `reference-import-response-${referenceGeometryImportStableHash(payload)}`;
}

function referenceGeometryImportStableHash(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function referenceGeometryImportWorkflowStage(stage = {}) {
  const sideEffectBoundary = freezeFlatRecord(stage.sideEffectBoundary || {});
  const writesProjectJson = sideEffectBoundary.writesProjectJson === true;
  const writesTargetReferenceManifest = sideEffectBoundary.writesTargetReferenceManifest === true;
  const mayWriteTargetReferenceChunks = sideEffectBoundary.mayWriteTargetReferenceChunks === true;
  return Object.freeze({
    id: cleanString(stage.id),
    label: cleanString(stage.label || stage.id),
    commandFlags: Object.freeze(uniqueStrings(stage.commandFlags || [])),
    executionMode: cleanString(stage.executionMode) || null,
    requiredInputs: Object.freeze(uniqueStrings(stage.requiredInputs || [])),
    requiredInputDescriptorIds: Object.freeze(uniqueStrings(stage.requiredInputs || [])),
    decisionField: cleanString(stage.decisionField),
    fingerprintFields: Object.freeze(uniqueStrings(stage.fingerprintFields || [])),
    optional: stage.optional === true,
    noProjectOrTargetWrites: !writesProjectJson && !writesTargetReferenceManifest && !mayWriteTargetReferenceChunks,
    promotedWriteStage: writesProjectJson || writesTargetReferenceManifest || mayWriteTargetReferenceChunks,
    writesProjectJson,
    writesTargetReferenceManifest,
    mayLaunchExternalAdapter: sideEffectBoundary.mayLaunchExternalAdapter === true,
    sideEffectBoundary
  });
}

function referenceGeometryImportWorkflowStageCopy(stage = {}) {
  const cliBlueprint = referenceGeometryImportCliBlueprintForStage(stage.id);
  return Object.freeze({
    id: stage.id,
    label: stage.label,
    commandFlags: Object.freeze([...(stage.commandFlags || [])]),
    executionMode: stage.executionMode || null,
    requiredInputs: Object.freeze([...(stage.requiredInputs || [])]),
    requiredInputDescriptorIds: Object.freeze([...(stage.requiredInputDescriptorIds || stage.requiredInputs || [])]),
    cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINT_ID,
    cliStageBlueprintId: cliBlueprint?.id || "",
    requiredCliFlags: Object.freeze([...(cliBlueprint?.requiredCliFlags || [])]),
    optionalCliFlags: Object.freeze([...(cliBlueprint?.optionalCliFlags || [])]),
    decisionField: stage.decisionField,
    fingerprintFields: Object.freeze([...(stage.fingerprintFields || [])]),
    optional: stage.optional === true,
    noProjectOrTargetWrites: stage.noProjectOrTargetWrites === true,
    promotedWriteStage: stage.promotedWriteStage === true,
    writesProjectJson: stage.writesProjectJson === true,
    writesTargetReferenceManifest: stage.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter: stage.mayLaunchExternalAdapter === true,
    sideEffectBoundary: freezeFlatRecord(stage.sideEffectBoundary || {})
  });
}

function freezeFlatRecord(record = {}) {
  return Object.freeze({ ...(record || {}) });
}

function freezeRecordOfArrays(record = {}) {
  return Object.freeze(Object.fromEntries(
    Object.entries(record || {}).map(([key, values]) => [key, Object.freeze([...(values || [])])])
  ));
}

function freezeRecordOfRecords(record = {}) {
  return Object.freeze(Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [key, freezeFlatRecord(value || {})])
  ));
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function referenceSnapLabel(asset = {}) {
  if (asset?.snapEnabled === true) return "snap on";
  if (asset?.snapEnabled === false) return "snap off";
  return "";
}

function referenceDisplayLabel(asset = {}) {
  const display = asset?.display;
  if (!display || typeof display !== "object" || Array.isArray(display)) return "";
  const keys = ["color", "edgeColor", "opacity", "pointSize"].filter((key) => display[key] !== undefined);
  return keys.length ? "display override" : "";
}

function referenceTransformLabel(asset = {}) {
  const transform = asset?.transform;
  if (!transform || typeof transform !== "object" || Array.isArray(transform)) return "";
  const keys = ["origin", "axisX", "axisY", "axisZ", "scale"].filter((key) => transform[key] !== undefined);
  return keys.length ? "transform" : "";
}

function referenceGeometryDiagnosticsByAsset(diagnostics = []) {
  const grouped = new Map();
  for (const diagnostic of Array.isArray(diagnostics) ? diagnostics : []) {
    const assetId = cleanString(diagnostic?.assetId);
    if (!isSafeProjectReferenceGeometryAssetId(assetId)) continue;
    if (!grouped.has(assetId)) grouped.set(assetId, []);
    grouped.get(assetId).push({
      severity: referenceGeometryRuntimeDiagnosticSeverity(diagnostic?.severity),
      code: referenceGeometryRuntimeDiagnosticCode(diagnostic?.code)
    });
  }
  return grouped;
}

function referenceGeometryRuntimeDiagnosticSeverity(value) {
  return cleanString(value) === "warning" ? "warning" : "error";
}

function referenceGeometryRuntimeDiagnosticCode(value) {
  const code = cleanString(value);
  return REFERENCE_DIAGNOSTIC_CODE_PATTERN.test(code) ? code : "reference-load-error";
}

function referenceGeometryRuntimeSourceStatus(loaded, diagnostics = []) {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic?.severity !== "warning").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic?.severity === "warning").length;
  if (!loaded) return "not-loaded";
  if (errorCount) return "needs-attention";
  if (warningCount) return "loaded-with-warnings";
  return "loaded";
}

function referenceGeometryRuntimeSourceMeta(pointerMeta, loaded, diagnostics = [], sourceMetadata = referenceGeometryRuntimeSourceFormatMetadata(loaded?.data?.asset?.source)) {
  const objectCount = referenceGeometryRuntimeMapEntryCount(loaded?.data?.objects);
  const chunkCount = referenceGeometryRuntimeDeclaredChunkIds(loaded).length;
  const loadedPreviewChunkCount = referenceGeometryRuntimeLoadedPreviewChunkCount(loaded);
  const errorCount = diagnostics.filter((diagnostic) => diagnostic?.severity !== "warning").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic?.severity === "warning").length;
  const diagnosticCodes = uniqueStrings(diagnostics.map((diagnostic) => diagnostic?.code)).slice(0, 3);
  return uniqueStrings([
    pointerMeta,
    loaded ? "loaded" : "not loaded",
    sourceMetadata.sourceFormat && `source ${sourceMetadata.sourceFormat}`,
    sourceMetadata.sourceRequestedFormat && `requested ${sourceMetadata.sourceRequestedFormat}`,
    referenceGeometryRuntimeSourceFamilyMetaVisible(sourceMetadata)
      ? `family ${sourceMetadata.sourceRequestedFormatFamily}`
      : "",
    Number.isInteger(objectCount) ? `${objectCount} objects` : "",
    Number.isInteger(chunkCount) && chunkCount > 0 ? `${chunkCount} chunks` : "",
    Number.isInteger(chunkCount) && chunkCount > 0 ? `${loadedPreviewChunkCount}/${chunkCount} preview chunks loaded` : "",
    errorCount ? `${errorCount} errors` : "",
    warningCount ? `${warningCount} warnings` : "",
    diagnosticCodes.length ? `diagnostics ${diagnosticCodes.join("/")}` : ""
  ]).join(", ");
}

function referenceGeometryRuntimeSourceFamilyMetaVisible(sourceMetadata = {}) {
  const family = cleanString(sourceMetadata.sourceRequestedFormatFamily);
  if (!family) return false;
  if (cleanString(sourceMetadata.sourceRequestedFormat)) return true;
  const sourceFormat = cleanString(sourceMetadata.sourceFormat);
  return Boolean(sourceFormat && sourceFormat !== family);
}

function referenceGeometryRuntimeSourceFormatMetadata(source = {}) {
  const sourceFormat = referenceGeometryRuntimeSourceFormatToken(source?.format);
  const sourceMetadata = referenceGeometryImportSourceMetadataFields({
    sourceFormat,
    sourceRequestedFormat: source?.requestedFormat
  }, { defaultAliases: true });
  return {
    sourceFormat,
    sourceRequestedFormat: sourceMetadata.sourceRequestedFormat,
    sourceRequestedFormatFamily: sourceMetadata.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: sourceMetadata.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceMetadata.sourceRequestedFormatMatchesFamily
  };
}

function referenceGeometryRuntimeSourceFormatToken(value) {
  const token = referenceGeometryImportFormatToken(value);
  return REFERENCE_GEOMETRY_RUNTIME_SOURCE_FORMAT_TOKENS.has(token) ? token : "";
}

function referenceGeometryRuntimeChunkCounts(loaded) {
  const declaredChunkCount = referenceGeometryRuntimeDeclaredChunkIds(loaded).length;
  if (!Number.isInteger(declaredChunkCount) || declaredChunkCount <= 0) return {};
  return {
    declaredChunkCount,
    loadedPreviewChunkCount: referenceGeometryRuntimeLoadedPreviewChunkCount(loaded)
  };
}

function referenceGeometryRuntimeLoadedPreviewChunkCount(loaded) {
  if (!plainObject(loaded?.loadedChunks)) return 0;
  return referenceGeometryRuntimeDeclaredChunkIds(loaded).filter((chunkId) => {
    const loadedChunk = loaded.loadedChunks[chunkId];
    const loadedChunkId = cleanString(loadedChunk?.id);
    return plainObject(loadedChunk)
      && isSafeProjectReferenceGeometryAssetId(loadedChunkId)
      && loadedChunkId === chunkId;
  }).length;
}

function referenceGeometryRuntimeDeclaredChunkIds(loaded) {
  const chunks = Array.isArray(loaded?.data?.chunks) ? loaded.data.chunks : [];
  const seen = new Set();
  return chunks
    .map((chunk) => cleanString(chunk?.id))
    .filter((chunkId) => isSafeProjectReferenceGeometryAssetId(chunkId))
    .filter((chunkId) => {
      if (seen.has(chunkId)) return false;
      seen.add(chunkId);
      return true;
    });
}

function referenceGeometryRuntimeMapEntryCount(record) {
  if (!plainObject(record)) return null;
  return Object.entries(record).filter(([entryId, entry]) => {
    return isSafeProjectReferenceGeometryAssetId(entryId)
      && plainObject(entry)
      && cleanString(entry.id) === entryId;
  }).length;
}

function cleanString(value = "") {
  return String(value ?? "").trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function safeDecodedPathSegment(segment) {
  if (!segment || /%(?:2f|5c)/i.test(segment)) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return decoded
    && decoded !== "."
    && decoded !== ".."
    && !decoded.includes("/")
    && !decoded.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(decoded);
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
