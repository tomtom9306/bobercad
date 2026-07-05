#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BUILDER_ID = "referenceImportCompletionEvidenceBuilder";
const BUILDER_VERSION = "0.1.0";
const SOURCE_MANIFEST_ID = "referenceImportCompletionEvidenceSources";
const SOURCE_CHECK_ID = "referenceImportCompletionEvidenceSourceCheck";
const COMPLETION_EVIDENCE_ID = "referenceImportCompletionEvidence";
const ADAPTER_PREFLIGHT_EVIDENCE_CHECK_ID = "referenceImportAdapterPreflightEvidenceCheck";
const FINAL_ACCEPTANCE_CHECK_ID = "referenceImportFinalAcceptanceCheck";
const FINAL_ACCEPTANCE_REPORT_ID = "referenceImportCorpusAcceptanceReport";
const CORPUS_REPORT_ID = "referenceImportCorpusCheck";
const FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID = "full-private-reference-import-acceptance";
const UPSTREAM_CORPUS_RUN_PROFILE_ID = "full-private-reference-import-corpus-run";
const COMPLETION_EVIDENCE_PROFILE_ID = "reference-import-goal-completion-evidence";
const REQUIRED_SOURCE_FAMILIES = ["dxf", "dwg", "step", "ifc", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_FAMILIES = ["dwg", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = ["dwg", "e57pointcloud"];
const REQUIRED_POINT_CLOUD_FAMILIES = ["e57"];
const SOURCE_FORMAT_FAMILY_ALIASES = {
  dxf: "dxf",
  dwg: "dwg",
  step: "step",
  stp: "step",
  p21: "step",
  stpnc: "step",
  ifc: "ifc",
  ifcxml: "ifc",
  ifczip: "ifc",
  e57: "e57",
  e57pointcloud: "e57",
  e57pc: "e57"
};
const SOURCE_REQUESTED_FORMAT_TOKENS_BY_FORMAT = {
  dxf: ["dxf"],
  dwg: ["dwg"],
  step: ["step", "stp", "p21", "stpnc"],
  ifc: ["ifc", "ifcxml", "ifczip"],
  e57: ["e57", "e57pointcloud", "e57pc"],
  e57pointcloud: ["e57", "e57pointcloud", "e57pc"],
  json: ["json"]
};
const SOURCE_FILE_EXTENSION_TOKENS_BY_FORMAT = {
  dxf: ["", "dxf"],
  dwg: ["", "dwg"],
  step: ["", "step", "stp", "p21", "stpnc"],
  ifc: ["", "ifc", "ifcxml", "ifczip"],
  e57: ["", "e57"],
  e57pointcloud: ["", "e57"],
  json: ["", "json"]
};
const FAMILY_TARGET_FORMAT_TOKENS = {
  dwg: "dwg",
  e57: "e57pointcloud"
};
const AUTO_EVIDENCE_KINDS = [
  "promoted-import-corpus-report",
  "fingerprint-pinned-verifier-output",
  "final-acceptance-check-report"
];
const SOURCE_EVIDENCE_KINDS = [
  "private-source-family",
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "point-cloud-family",
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
];
const SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID = "reference-import-completion-source-evidence-semantics-v1";
const SOURCE_EVIDENCE_SEMANTICS_MODE = "build-time-semantic-evidence-files";
const SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS = [
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "external-adapter-key-linkage",
  "external-adapter-request-evidence-fingerprint-summary",
  "external-adapter-config-stat-fingerprint-linkage",
  "external-adapter-registry-aggregate-fingerprint-linkage",
  "external-adapter-registry-fingerprint-linkage",
  "external-adapter-preflight-fingerprint-linkage",
  "point-cloud-family",
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
];
const REQUIRED_ARTIFACT_KINDS = [
  "private-source-family",
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "point-cloud-family",
  ...AUTO_EVIDENCE_KINDS,
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
];
const GLOBAL_SOURCE_KINDS = new Set([
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
]);
const FAMILY_SOURCE_KINDS = new Set([
  "private-source-family",
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "point-cloud-family"
]);
const SOURCE_REQUIREMENTS = [
  ...REQUIRED_SOURCE_FAMILIES.map((family) => ({
    kind: "private-source-family",
    family,
    minCount: 1,
    reason: "one real private source file for each required source family"
  })),
  ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => ({
    kind: "external-adapter-preflight",
    family,
    minCount: 1,
    reason: "one accepted adapter-preflight evidence check report for each required adapter family"
  })),
  ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => ({
    kind: "external-adapter-source-adapter-assertion",
    family,
    minCount: 1,
    reason: "one accepted sourceAdapter assertion evidence artifact for each required adapter family"
  })),
  ...REQUIRED_POINT_CLOUD_FAMILIES.map((family) => ({
    kind: "point-cloud-family",
    family,
    minCount: 1,
    reason: "one real point-cloud evidence artifact for each required point-cloud family"
  })),
  {
    kind: "disposable-project-copy",
    family: "",
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    reason: "one disposable project copy per required source family"
  },
  {
    kind: "promoted-reference-manifest",
    family: "",
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    reason: "one promoted reference manifest per required source family"
  },
  {
    kind: "point-cloud-chunk-sidecar",
    family: "",
    minCount: REQUIRED_POINT_CLOUD_FAMILIES.length,
    reason: "at least one point-cloud chunk sidecar for required E57 point-cloud evidence"
  }
];
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const STAT_SHA256_FINGERPRINT = /^stat-sha256:[0-9a-f]{64}$/;
const CHECKSUM_SHA256 = /^[0-9a-f]{64}$/;
const FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT = "sha256:0dfa480ed4f08afce2aeb1f2d71910f7d2498565533262d09dabeef59ad568d3";
const SAFE_COLOR = /^#[0-9A-Fa-f]{6}$/;
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_SOURCE_TOKEN = /^[a-z0-9][a-z0-9_-]*$/;
const SAFE_TRANSLATOR_TOKEN = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_EXTERNAL_TRANSLATOR = /^external:(?!__proto__$|prototype$|constructor$)[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_TRANSLATOR_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SAFE_REFERENCE_CHUNK_PATH = /^(?!\s)(?!.*\s$)(?!\/)(?!\/\/)(?![A-Za-z][A-Za-z0-9+.-]*:)(?!.*[\\?#\u0000-\u001f\u007f])(?!.*%(?![0-9A-Fa-f]{2}))(?!.*%(?:2[fF]|5[cC]))(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*(?:^|\/)(?:\.|%2[eE]){1,2}(?:\/|$)).+$/;
const RFC3339_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);
const RESERVED_ADAPTER_KEYS = RESERVED_IDS;
const COMPLETION_EVIDENCE_FIELDS = [
  "id",
  "version",
  "finalAcceptanceCheckFingerprint",
  "acceptanceReportFingerprint",
  "corpusReportFingerprint",
  "evidenceSourcesFingerprint",
  "sourceFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterSourceAdapterKeys",
  "externalAdapterSourceAdapterRequestEvidenceFingerprints",
  "externalAdapterSourceAdapterConfigStatFingerprints",
  "externalAdapterSourceAdapterRegistryAggregateFingerprints",
  "externalAdapterSourceAdapterRegistryFingerprints",
  "externalAdapterSourceAdapterPreflightFingerprints",
  "pointCloudFamilies",
  "sourceEvidenceSemantics",
  "evidenceItems"
];
const SOURCE_EVIDENCE_SEMANTICS_FIELDS = [
  "profileId",
  "builderId",
  "builderVersion",
  "gate",
  "mode",
  "artifactKinds",
  "sourceAdapterKeyPolicy",
  "profileFingerprint"
];
const COMPLETION_EVIDENCE_ITEM_FIELDS = [
  "kind",
  "family",
  "fingerprint",
  "count",
  "label"
];
const SOURCE_MANIFEST_FIELDS = ["id", "version", "items"];
const SOURCE_MANIFEST_ITEM_FIELDS = ["kind", "family", "label", "paths"];
const REFERENCE_SOURCE_FIELDS = ["format", "fileName", "fileExtension", "requestedFormat", "fileSizeBytes", "modifiedTime", "statFingerprint", "checksum", "translator", "translatorVersion", "adapterKey"];
const REFERENCE_GEOMETRY_FIELDS = [
  "$schema",
  "schema",
  "schemaVersion",
  "asset",
  "layers",
  "objects",
  "chunks",
  "diagnostics"
];
const REFERENCE_ASSET_FIELDS = ["id", "name", "source", "units", "coordinateSystem", "bounds"];
const REFERENCE_ASSET_REQUIRED_FIELDS = ["id", "name", "source", "units", "coordinateSystem"];
const REFERENCE_DISPLAY_FIELDS = ["visible", "color", "edgeColor", "opacity", "pointSize"];
const REFERENCE_LAYER_FIELDS = ["id", "name", "display"];
const REFERENCE_OBJECT_FIELDS = ["id", "kind", "name", "layer", "display", "metadata", "bounds", "vertices", "lineSegments", "faces", "points", "pointAttributes", "chunkIds"];
const REFERENCE_CHUNK_FIELDS = ["id", "kind", "objectId", "path", "pointCount", "bounds"];
const REFERENCE_DIAGNOSTIC_FIELDS = ["severity", "code", "message", "objectId", "objectRefs"];
const REFERENCE_UNITS = new Set(["mm", "m", "in", "ft"]);
const REFERENCE_OBJECT_KINDS = new Set(["line-set", "mesh", "point-cloud"]);
const REFERENCE_DIAGNOSTIC_SEVERITIES = new Set(["info", "warning", "error"]);
const POINT_CLOUD_CHUNK_FIELDS = [
  "$schema",
  "schema",
  "schemaVersion",
  "id",
  "kind",
  "objectId",
  "pointCount",
  "bounds",
  "points",
  "pointAttributes",
  "metadata"
];
const POINT_CLOUD_CHUNK_REQUIRED_FIELDS = [
  "$schema",
  "schema",
  "schemaVersion",
  "id",
  "kind",
  "objectId",
  "pointCount",
  "bounds",
  "points"
];
const PROJECT_REFERENCE_ASSET_FIELDS = ["path", "visible", "snapEnabled", "display", "transform"];
const PROJECT_REFERENCE_FORBIDDEN_POINTER_FIELDS = [
  "$schema",
  "schema",
  "schemaVersion",
  "asset",
  "layers",
  "objects",
  "chunks",
  "diagnostics",
  "points",
  "vertices",
  "faces",
  "lineSegments",
  "pointAttributes",
  "metadata",
  "adapterRequest",
  "stage",
  "scratch",
  "source",
  "output",
  "targetManifestPath"
];
const PROJECT_REFERENCE_PATH = /^\.\.\/references\/[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/;
const SOURCE_EVIDENCE_ARTIFACT_CONTRACT_FIELDS = [
  "kind",
  "families",
  "minCount",
  "countScope",
  "evidenceSource",
  "proofRequirement",
  "privacyBoundary"
];
const SOURCE_EVIDENCE_ARTIFACT_CONTRACTS = [
  {
    kind: "private-source-family",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "real-private-source-file",
    proofRequirement: "one non-placeholder private source file for each required source family used by the accepted private corpus run",
    privacyBoundary: "opaque-bytes"
  },
  {
    kind: "external-adapter-preflight",
    families: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "accepted-adapter-preflight-evidence-check-report",
    proofRequirement: "one saved successful adapter-preflight evidence check report for each required real external adapter family",
    privacyBoundary: "accepted-verifier-output-json"
  },
  {
    kind: "external-adapter-source-adapter-assertion",
    families: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "accepted-corpus-sourceAdapter-assertion",
    proofRequirement: "one accepted external-adapter corpus assertion proving expected sourceAdapter equals the workflow selected adapter key for each required adapter family",
    privacyBoundary: "accepted-corpus-verifier-output-json"
  },
  {
    kind: "point-cloud-family",
    families: REQUIRED_POINT_CLOUD_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "real-point-cloud-import-evidence",
    proofRequirement: "one real E57 point-cloud import evidence artifact with nonempty canonical point-cloud output",
    privacyBoundary: "accepted-corpus-verifier-output-json"
  },
  {
    kind: "disposable-project-copy",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    countScope: "global",
    evidenceSource: "disposable-project-after-private-promotion",
    proofRequirement: "one disposable project copy per required source family after promoted reference import writes",
    privacyBoundary: "project-reference-pointer-json"
  },
  {
    kind: "promoted-reference-manifest",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    countScope: "global",
    evidenceSource: "promoted-canonical-reference-manifest",
    proofRequirement: "one promoted canonical reference manifest per required source family",
    privacyBoundary: "canonical-reference-manifest-json"
  },
  {
    kind: "point-cloud-chunk-sidecar",
    families: REQUIRED_POINT_CLOUD_FAMILIES,
    minCount: REQUIRED_POINT_CLOUD_FAMILIES.length,
    countScope: "global",
    evidenceSource: "promoted-point-cloud-chunk-sidecar",
    proofRequirement: "at least one promoted point-cloud chunk sidecar for required E57 point-cloud evidence",
    privacyBoundary: "canonical-point-cloud-chunk-json"
  }
];
const COMPLETION_EVIDENCE_ARTIFACT_CONTRACT_FIELDS = SOURCE_EVIDENCE_ARTIFACT_CONTRACT_FIELDS;
const COMPLETION_EVIDENCE_ARTIFACT_CONTRACTS = [
  {
    kind: "private-source-family",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "real-private-source-file",
    proofRequirement: "one non-placeholder private source file for each required source family used by the accepted private corpus run",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "external-adapter-preflight",
    families: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "accepted-adapter-preflight-evidence-check-report",
    proofRequirement: "one saved successful adapter-preflight evidence check report for each required real external adapter family",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "external-adapter-source-adapter-assertion",
    families: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "accepted-corpus-sourceAdapter-assertion",
    proofRequirement: "one accepted external-adapter corpus assertion proving expected sourceAdapter equals the workflow selected adapter key for each required adapter family",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "point-cloud-family",
    families: REQUIRED_POINT_CLOUD_FAMILIES,
    minCount: 1,
    countScope: "per-family",
    evidenceSource: "real-point-cloud-import-evidence",
    proofRequirement: "one real E57 point-cloud import evidence artifact with nonempty canonical point-cloud output",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "promoted-import-corpus-report",
    families: [],
    minCount: 1,
    countScope: "global",
    evidenceSource: "accepted-promoted-import-corpus-report",
    proofRequirement: "one promoted corpus report fingerprint aligned with the final acceptance check",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "fingerprint-pinned-verifier-output",
    families: [],
    minCount: 1,
    countScope: "global",
    evidenceSource: "fingerprint-pinned-corpus-report-verifier-output",
    proofRequirement: "one saved verifier output whose fingerprint is pinned by the final acceptance check",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "final-acceptance-check-report",
    families: [],
    minCount: 1,
    countScope: "global",
    evidenceSource: "saved-final-acceptance-check-report",
    proofRequirement: "one saved final acceptance check report with finalAcceptanceOutputWritableOk",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "disposable-project-copy",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    countScope: "global",
    evidenceSource: "disposable-project-after-private-promotion",
    proofRequirement: "one disposable project copy per required source family after promoted reference import writes",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "promoted-reference-manifest",
    families: REQUIRED_SOURCE_FAMILIES,
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    countScope: "global",
    evidenceSource: "promoted-canonical-reference-manifest",
    proofRequirement: "one promoted canonical reference manifest per required source family",
    privacyBoundary: "path-free-fingerprint-only"
  },
  {
    kind: "point-cloud-chunk-sidecar",
    families: REQUIRED_POINT_CLOUD_FAMILIES,
    minCount: REQUIRED_POINT_CLOUD_FAMILIES.length,
    countScope: "global",
    evidenceSource: "promoted-point-cloud-chunk-sidecar",
    proofRequirement: "at least one promoted point-cloud chunk sidecar for required E57 point-cloud evidence",
    privacyBoundary: "path-free-fingerprint-only"
  }
];
const COMPLETION_EVIDENCE_ARTIFACT_COUNT_MINIMUMS = [
  {
    kind: "disposable-project-copy",
    family: "",
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    reason: "one disposable project copy per required source family"
  },
  {
    kind: "promoted-reference-manifest",
    family: "",
    minCount: REQUIRED_SOURCE_FAMILIES.length,
    reason: "one promoted reference manifest per required source family"
  },
  {
    kind: "point-cloud-chunk-sidecar",
    family: "",
    minCount: REQUIRED_POINT_CLOUD_FAMILIES.length,
    reason: "at least one point-cloud chunk sidecar for required E57 point-cloud evidence"
  }
];
const SOURCE_CHECK_FIELDS = [
  "id",
  "version",
  "ok",
  "evidenceSourcesPath",
  "sourceCheckReportPath",
  "evidenceSourcesFingerprint",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const SOURCE_CHECK_GATE_FIELDS = [
  "evidenceSourcesReadableOk",
  "evidenceSourcesShapeOk",
  "evidenceSourcesValueShapeOk",
  "requiredEvidenceSourcesOk",
  "artifactCountEvidenceOk",
  "sourceCheckOutputWritableOk"
];
const FINAL_ACCEPTANCE_CHECK_FIELDS = [
  "id",
  "version",
  "ok",
  "reportPath",
  "finalAcceptanceCheckPath",
  "acceptanceReportId",
  "acceptanceReportVersion",
  "acceptanceReportFingerprint",
  "corpusReportFingerprint",
  "finalPrivateAcceptanceProfileId",
  "upstreamCorpusRunProfileId",
  "completionEvidenceId",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const FINAL_ACCEPTANCE_GATE_FIELDS = [
  "acceptanceReportShapeOk",
  "acceptanceReportValueShapeOk",
  "acceptedReportIdentityOk",
  "acceptedReportOk",
  "expectedAcceptanceReportFingerprint",
  "acceptanceReportFingerprintMatchesExpected",
  "corpusReportFingerprintPresent",
  "corpusReportFingerprintPinned",
  "requiredFormatFamiliesOk",
  "requiredExternalAdapterFamiliesOk",
  "requiredExternalAdapterTargetFormatTokensOk",
  "requiredPointCloudFamiliesOk",
  "sourceSizeGatePresent",
  "nonemptyReferenceGeometryRequired",
  "promotedImportWritesRequired",
  "missingGateEvidence",
  "finalPrivateAcceptanceSummaryOk",
  "requiredPrivateEvidenceOk",
  "finalAcceptanceOutputWritableOk"
];
const FINAL_ACCEPTANCE_SUMMARY_FIELDS = [
  "accepted",
  "acceptedFormatFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterSourceAdapterKeys",
  "externalAdapterSourceAdapterRequestEvidenceFingerprints",
  "externalAdapterSourceAdapterConfigStatFingerprints",
  "externalAdapterSourceAdapterRegistryAggregateFingerprints",
  "externalAdapterSourceAdapterRegistryFingerprints",
  "externalAdapterSourceAdapterPreflightFingerprints",
  "pointCloudFamilies",
  "proofPlanFingerprint",
  "acceptedVerifierValuePolicy",
  "missingEvidenceRecommendedAction"
];
const FAILURE_OUTPUT_FIELDS = [
  "id",
  "version",
  "ok",
  "finalAcceptanceCheckPath",
  "evidenceSourcesPath",
  "outputManifestPath",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const FAILURE_GATE_FIELDS = [
  "finalAcceptanceCheckReadableOk",
  "finalAcceptanceCheckShapeOk",
  "finalAcceptanceCheckAcceptedOk",
  "evidenceSourcesReadableOk",
  "evidenceSourcesShapeOk",
  "evidenceSourcesValueShapeOk",
  "requiredEvidenceSourcesOk",
  "artifactCountEvidenceOk",
  "sourceFilesReadableOk",
  "sourceEvidenceSemanticsOk",
  "outputManifestWritableOk"
];
const ADAPTER_PREFLIGHT_EVIDENCE_CHECK_FIELDS = [
  "id",
  "version",
  "ok",
  "family",
  "targetFormatToken",
  "externalAdapterTargetFormatTokens",
  "preflightReportPath",
  "adapterPreflightEvidenceCheckPath",
  "preflightReportFingerprint",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterPreflightFingerprint",
  "adapterTargetFormatCoverageFingerprint",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const ADAPTER_PREFLIGHT_EVIDENCE_GATE_FIELDS = [
  "preflightReportReadableOk",
  "preflightReportShapeOk",
  "preflightReportAcceptedOk",
  "requestedFamilyOk",
  "adapterConfigStatFingerprintPresentOk",
  "adapterRegistryFingerprintPresentOk",
  "selectedAdapterEvidenceOk",
  "adapterTargetFormatCoverageOk",
  "selectedAdapterTargetCoverageOk",
  "adapterRegistryAdapterFingerprintsPresentOk",
  "adapterPreflightFingerprintPresentOk",
  "adapterTargetFormatCoverageFingerprintPresentOk",
  "adapterTargetFormatCoverageFingerprintMatchesContentOk",
  "expectedPreflightReportFingerprintMatches",
  "adapterPreflightEvidenceOutputWritableOk"
];
const ADAPTER_PREFLIGHT_EVIDENCE_SUMMARY_FIELDS = [
  "family",
  "targetFormatToken",
  "externalAdapterTargetFormatTokens",
  "requestedFormat",
  "requestedFormatToken",
  "requestedAdapter",
  "selectedAdapterKeys",
  "selectedAdapterTargetCoverageKeys",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprints",
  "adapterCount",
  "blockingDiagnosticCodes",
  "warningDiagnosticCodes",
  "adapterPreflightReady",
  "adapterTargetFormatCoverageFingerprint",
  "adapterPreflightFingerprint"
];
const CORPUS_ACCEPTANCE_REPORT_FIELDS = [
  "id",
  "version",
  "ok",
  "reportId",
  "reportVersion",
  "reportPath",
  "reportFingerprint",
  "finalPrivateAcceptanceSummary",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const CORPUS_ACCEPTANCE_GATE_FIELDS = [
  "requiredFormatFamilies",
  "missingFormatFamilies",
  "expectedReportFingerprint",
  "reportFingerprintMatchesExpected",
  "acceptedFormatMissingFamilies",
  "duplicateAcceptedCaseIds",
  "requiredExternalAdapterFamilies",
  "externalAdapterMissingFamilies",
  "weakExternalAdapterEvidenceCaseIds",
  "missingExternalAdapterSourceAdapterAssertionCaseIds",
  "sourceFamilyMismatchCaseIds",
  "coverageCaseFamilyMismatchCaseIds",
  "sourceEvidenceMissingCaseIds",
  "sourceFileSummaryInvalidCaseIds",
  "sourceExtensionInvalidCaseIds",
  "sourceSummaryInvalidCaseIds",
  "sourceFormatSummaryInvalidCaseIds",
  "sourceModifiedTimeInvalidCaseIds",
  "caseTimingInvalidCaseIds",
  "topLevelReportMetadataIssues",
  "acceptanceMetadataIssues",
  "coverageMetadataIssues",
  "defaultsMetadataIssues",
  "performanceMetadataIssues",
  "performanceDurationSummaryInvalidCaseIds",
  "performanceEvidenceMismatchCaseIds",
  "referenceCountInvalidCaseIds",
  "fingerprintSummaryInvalidCaseIds",
  "caseSummaryInvalidCaseIds",
  "caseIdentityInvalidCaseIds",
  "assertionSummaryInvalidCaseIds",
  "workflowSummaryInvalidCaseIds",
  "workflowRuntimeBoundaryInvalidCaseIds",
  "workflowResponseSummaryInvalidCaseIds",
  "workflowStageInvalidCaseIds",
  "caseDiagnosticPayloadCaseIds",
  "processSummaryInvalidCaseIds",
  "requestSummaryInvalidCaseIds",
  "rawDebugRequestCaseIds",
  "topLevelCaseMetadataIssues",
  "topLevelRuntimeBoundaryIssues",
  "requiredPointCloudFamilies",
  "pointCloudMissingFamilies",
  "minSourceFileSizeBytes",
  "sourceSizeFailedCaseIds",
  "requireNonemptyReferenceGeometry",
  "emptyReferenceGeometryCaseIds",
  "requirePromotedImportWrites",
  "promotedImportEvidenceMissingCaseIds"
];
const CORPUS_ACCEPTANCE_SUMMARY_FIELDS = [
  "caseCount",
  "accepted",
  "coverageOk",
  "presentFormatFamilies",
  "acceptedFormatFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterSourceAdapterKeys",
  "externalAdapterSourceAdapterRequestEvidenceFingerprints",
  "externalAdapterSourceAdapterConfigStatFingerprints",
  "externalAdapterSourceAdapterRegistryAggregateFingerprints",
  "externalAdapterSourceAdapterRegistryFingerprints",
  "externalAdapterSourceAdapterPreflightFingerprints",
  "pointCloudFamilies",
  "performanceEvidenceReady",
  "sourceEvidenceReady"
];
const FAILURE_SUMMARY_FIELDS = [
  "sourceItemCount",
  "evidenceItemCount",
  "sourceFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterPreflightEvidenceFamilies",
  "missingExternalAdapterPreflightEvidenceFamilies",
  "externalAdapterSourceAdapterAssertionFamilies",
  "missingExternalAdapterSourceAdapterAssertionFamilies",
  "pointCloudFamilies",
  "requiredSourceItems",
  "missingSourceItems",
  "insufficientSourceCounts"
];

function usage() {
  return [
    "Usage: node scripts/build_reference_import_completion_evidence.mjs --final-acceptance-check <check.json> --evidence-sources <sources.json> [--output <completion-evidence.json>]",
    "",
    "Builds a path-free referenceImportCompletionEvidence manifest from explicit private evidence source files.",
    "The builder may read only the files named in the evidence sources manifest. Private sources and projects stay opaque bytes; promoted reference manifests, point-cloud chunk sidecars, and verifier evidence files must be accepted canonical JSON.",
    "",
    "Options:",
    "  --final-acceptance-check <path>  Saved output from verify_reference_import_final_acceptance.mjs.",
    "  --evidence-sources <path>        Private source manifest listing explicit evidence files.",
    "  --output <path>                  Optional output path for the completion manifest, or source check report with --check-sources-only.",
    "  --print-example-sources          Print a source-manifest template and exit without reading private files.",
    "  --check-sources-only             Validate the source manifest shape/counts without reading evidence files.",
    "  --list-contract                  Print the builder contract and exit.",
    "  --help                           Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    finalAcceptanceCheckPath: "",
    evidenceSourcesPath: "",
    outputPath: "",
    printExampleSources: false,
    checkSourcesOnly: false,
    listContract: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--list-contract") {
      options.listContract = true;
      continue;
    }
    if (arg === "--print-example-sources") {
      options.printExampleSources = true;
      continue;
    }
    if (arg === "--check-sources-only") {
      options.checkSourcesOnly = true;
      continue;
    }
    if (arg === "--final-acceptance-check") {
      options.finalAcceptanceCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--evidence-sources") {
      options.evidenceSourcesPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error("Unknown option.");
  }
  return options;
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function contract() {
  return {
    id: "referenceImportCompletionEvidenceBuilderContract",
    version: BUILDER_VERSION,
    builderId: BUILDER_ID,
    sourceManifestId: SOURCE_MANIFEST_ID,
    completionEvidenceId: COMPLETION_EVIDENCE_ID,
    inputBoundary: {
      readsSavedFinalAcceptanceCheck: true,
      readsEvidenceSourcesManifest: true,
      readsOnlyExplicitEvidenceSourcePaths: true,
      readsPrivateSourceFilesAsOpaqueEvidenceBytes: true,
      readsDisposableProjectsAsOpaqueEvidenceBytes: false,
      readsDisposableProjectCopiesSemantically: true,
      readsPromotedReferenceManifestsAsOpaqueEvidenceBytes: false,
      readsPromotedReferenceManifestsSemantically: true,
      readsPointCloudChunkSidecarsAsOpaqueEvidenceBytes: false,
      readsPointCloudChunkSidecarsSemantically: true,
      readsSavedVerifierOutput: true,
      readsSavedAdapterPreflightEvidenceChecksSemantically: true,
      readsOnlyAdapterPreflightEvidenceChecksSemantically: true,
      readsSavedCorpusAcceptanceReportsForSourceAdapterAssertionsSemantically: true,
      readsSavedCorpusAcceptanceReportsForPointCloudEvidenceSemantically: true,
      readsSavedCorpusReport: false,
      readsProjectFilesSemantically: false,
      readsReferenceManifestsSemantically: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    sourceManifestContract: {
      id: SOURCE_MANIFEST_ID,
      version: BUILDER_VERSION,
      topLevelFields: SOURCE_MANIFEST_FIELDS,
      evidenceSourceItemFields: SOURCE_MANIFEST_ITEM_FIELDS,
      evidenceSourceItemKinds: SOURCE_EVIDENCE_KINDS,
      evidenceArtifactContractFields: SOURCE_EVIDENCE_ARTIFACT_CONTRACT_FIELDS,
      evidenceArtifactContracts: SOURCE_EVIDENCE_ARTIFACT_CONTRACTS,
      reservedAutoEvidenceKinds: AUTO_EVIDENCE_KINDS,
      requiredSourceItems: SOURCE_REQUIREMENTS,
      relativePathsResolveAgainstEvidenceSourcesFile: true,
      exampleTemplateFlag: "--print-example-sources",
      exampleTemplateReadsPrivateFiles: false,
      exampleTemplateUsesRelativePlaceholders: true,
      checkSourcesOnlyFlag: "--check-sources-only",
      checkSourcesOnlyReadsFinalAcceptanceCheck: false,
      checkSourcesOnlyReadsEvidenceFiles: false,
      checkSourcesOnlySupportsOutput: true,
      acceptsUtf8Bom: true,
      pathPrivacyPolicy: "The source manifest may contain local private paths, but builder reports and the built completion evidence manifest never echo those paths or raw file names. Labels must be generic path-free tokens."
    },
    outputContract: {
      successOutputId: COMPLETION_EVIDENCE_ID,
      successTopLevelFields: COMPLETION_EVIDENCE_FIELDS,
      successSourceEvidenceSemanticsFields: SOURCE_EVIDENCE_SEMANTICS_FIELDS,
      successSourceEvidenceSemanticsProfileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
      successSourceEvidenceSemanticsMode: SOURCE_EVIDENCE_SEMANTICS_MODE,
      successSourceEvidenceSemanticArtifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
      successSourceEvidenceSemanticsProfileFingerprint: sourceEvidenceSemanticsProfileFingerprint(),
      successEvidenceItemFields: COMPLETION_EVIDENCE_ITEM_FIELDS,
      successEvidenceItemKinds: REQUIRED_ARTIFACT_KINDS,
      successEvidenceArtifactContractFields: COMPLETION_EVIDENCE_ARTIFACT_CONTRACT_FIELDS,
      successEvidenceArtifactContracts: COMPLETION_EVIDENCE_ARTIFACT_CONTRACTS,
      successArtifactCountMinimums: COMPLETION_EVIDENCE_ARTIFACT_COUNT_MINIMUMS,
      sourceCheckOutputId: SOURCE_CHECK_ID,
      sourceCheckTopLevelFields: SOURCE_CHECK_FIELDS,
      sourceCheckGateFields: SOURCE_CHECK_GATE_FIELDS,
      sourceCheckSummaryFields: FAILURE_SUMMARY_FIELDS,
      sourceCheckOutputPathField: "sourceCheckReportPath",
      savedFinalAcceptanceCheckFields: FINAL_ACCEPTANCE_CHECK_FIELDS,
      savedFinalAcceptanceGateFields: FINAL_ACCEPTANCE_GATE_FIELDS,
      savedFinalAcceptanceSummaryFields: FINAL_ACCEPTANCE_SUMMARY_FIELDS,
      failureOutputId: BUILDER_ID,
      failureTopLevelFields: FAILURE_OUTPUT_FIELDS,
      failureGateFields: FAILURE_GATE_FIELDS,
      adapterPreflightEvidenceCheckId: ADAPTER_PREFLIGHT_EVIDENCE_CHECK_ID,
      adapterPreflightEvidenceCheckFields: ADAPTER_PREFLIGHT_EVIDENCE_CHECK_FIELDS,
      adapterPreflightEvidenceGateFields: ADAPTER_PREFLIGHT_EVIDENCE_GATE_FIELDS,
      adapterPreflightEvidenceSummaryFields: ADAPTER_PREFLIGHT_EVIDENCE_SUMMARY_FIELDS,
      sourceAdapterAssertionEvidenceCheckId: FINAL_ACCEPTANCE_REPORT_ID,
      sourceAdapterAssertionEvidenceCheckFields: CORPUS_ACCEPTANCE_REPORT_FIELDS,
      sourceAdapterAssertionEvidenceGateFields: CORPUS_ACCEPTANCE_GATE_FIELDS,
      sourceAdapterAssertionEvidenceSummaryFields: CORPUS_ACCEPTANCE_SUMMARY_FIELDS,
      pointCloudEvidenceCheckId: FINAL_ACCEPTANCE_REPORT_ID,
      pointCloudEvidenceCheckFields: CORPUS_ACCEPTANCE_REPORT_FIELDS,
      pointCloudEvidenceGateFields: CORPUS_ACCEPTANCE_GATE_FIELDS,
      sourceAdapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
      },
      canonicalReferenceManifestFields: REFERENCE_GEOMETRY_FIELDS,
      canonicalReferenceManifestRequiredFamilies: REQUIRED_SOURCE_FAMILIES,
      canonicalPointCloudChunkFields: POINT_CLOUD_CHUNK_FIELDS,
      disposableProjectReferencePointerPolicy: "disposable project copies must be steel-bim-project JSON with safe referenceGeometry.assets pointers to ../references/*.json, no canonical geometry payload fields inside project pointers, and reference asset ids backed by promoted reference manifest asset ids",
      failureSummaryFields: FAILURE_SUMMARY_FIELDS,
      successOutputIsPathFree: true,
      opaqueSourceFileFingerprintPolicy: "Each evidence item fingerprint is an aggregate sha256 over source-file byte fingerprints plus kind/family/count metadata; source paths and file names are excluded. disposable-project-copy files are additionally required to be project JSON with safe referenceGeometry asset pointers whose asset ids are backed by promoted reference manifest asset ids. promoted-reference-manifest files are additionally required to be canonical reference manifest JSON covering dxf/dwg/step/ifc/e57 with non-empty schema reference fields, finite nondegenerate coordinate systems, closed asset source provenance fields, path-free source file-name provenance, strict RFC3339 source modified-time provenance, source format/requested-format/file-extension alias policy, safe translator provenance tokens, closed layer/object/chunk field envelopes, closed diagnostic field envelopes with existing object references, canonical display controls, object metadata records, kind-specific geometry payload fields, finite ordered bounds matching object/asset payloads, bounded nondegenerate line/mesh topology indices, canonical inline pointAttributes values with nonzero point normal vectors, schema-safe point-cloud chunk sidecar paths, and each manifest chunk owned by the matching point-cloud object chunkIds. every promoted reference manifest point-cloud chunk must have matching sidecar evidence. every point-cloud-chunk-sidecar file is additionally required to be canonical point-cloud chunk JSON with non-empty schema reference fields and canonical pointAttributes values with nonzero point normal vectors, whose id/objectId pair is referenced by promoted reference manifest chunks, whose finite ordered bounds match its point payload, and whose pointCount/bounds match the promoted manifest chunk, so duplicate sidecar refs cannot mask mismatched sidecar evidence. external-adapter-preflight files are additionally required to be accepted path-free adapter-preflight evidence check JSON. external-adapter-source-adapter-assertion and point-cloud-family files are additionally required to be accepted path-free corpus verifier output JSON; sourceAdapter assertion reports must include summary.externalAdapterSourceAdapterRequestEvidenceFingerprints for each required adapter family. for each required DWG/E57 family, external-adapter-preflight selectedAdapterKeys must overlap the accepted corpus verifier summary.externalAdapterSourceAdapterKeys, external-adapter-preflight adapterConfigStatFingerprint must overlap the accepted corpus verifier summary.externalAdapterSourceAdapterConfigStatFingerprints, external-adapter-preflight adapterRegistryFingerprint must overlap the accepted corpus verifier summary.externalAdapterSourceAdapterRegistryAggregateFingerprints, external-adapter-preflight adapterRegistryAdapterFingerprints must overlap the accepted corpus verifier summary.externalAdapterSourceAdapterRegistryFingerprints, and external-adapter-preflight adapterPreflightFingerprint must overlap the accepted corpus verifier summary.externalAdapterSourceAdapterPreflightFingerprints for sourceAdapter assertion evidence, so unrelated preflight/sourceAdapter proof artifacts, same-key different-config artifacts, same-key different-registry artifacts, same-key different-registry-entry artifacts, or same-key different-preflight artifacts cannot be combined."
    },
    cliFlags: ["--final-acceptance-check", "--evidence-sources", "--output", "--print-example-sources", "--check-sources-only", "--list-contract", "--help"]
  };
}

function pathFreeInputFileName(value = "") {
  const base = path.basename(String(value || "").replace(/\\/g, "/"));
  return /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/.test(base) ? base : "";
}

function fileFingerprint(raw) {
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

function sourceAdapterKeyPolicy() {
  return {
    safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
    reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
  };
}

function sourceEvidenceSemanticsProfilePayload() {
  return {
    profileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
    builderId: BUILDER_ID,
    builderVersion: BUILDER_VERSION,
    gate: "sourceEvidenceSemanticsOk",
    mode: SOURCE_EVIDENCE_SEMANTICS_MODE,
    artifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
    sourceAdapterKeyPolicy: sourceAdapterKeyPolicy()
  };
}

function sourceEvidenceSemanticsProfileFingerprint() {
  return fileFingerprint(JSON.stringify(sourceEvidenceSemanticsProfilePayload()));
}

function sourceEvidenceSemantics() {
  return {
    ...sourceEvidenceSemanticsProfilePayload(),
    artifactKinds: [...SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS],
    profileFingerprint: sourceEvidenceSemanticsProfileFingerprint()
  };
}

function readJsonFile(filePath = "", label = "JSON artifact") {
  if (!filePath) {
    return { value: null, raw: "", fingerprint: "", failures: [`${label} path is required`] };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const fingerprint = fileFingerprint(raw);
    try {
      return { value: JSON.parse(raw.replace(/^\uFEFF/, "")), raw, fingerprint, failures: [] };
    } catch {
      return { value: null, raw, fingerprint, failures: [`${label} must be valid JSON`] };
    }
  } catch {
    return { value: null, raw: "", fingerprint: "", failures: [`${label} must be readable JSON`] };
  }
}

function exactObjectFieldsOk(value, expectedFields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedFields.length && keys.every((field) => expectedFields.includes(field));
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function sameStrings(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
}

function safeId(value = "") {
  return typeof value === "string" && SAFE_ID.test(value) && !RESERVED_IDS.has(value);
}

function safeLabel(value = "") {
  const text = String(value || "");
  return SAFE_LABEL.test(text) && !/[\\/:]/.test(text) && !text.includes("..");
}

function safeChunkPath(value = "") {
  return typeof value === "string" && SAFE_REFERENCE_CHUNK_PATH.test(value);
}

function schemaRefOk(value = "") {
  return typeof value === "string" && value.length > 0;
}

function displayOk(display = {}) {
  if (!isRecord(display)) return false;
  const keys = Object.keys(display);
  return keys.every((field) => REFERENCE_DISPLAY_FIELDS.includes(field))
    && (!Object.hasOwn(display, "visible") || typeof display.visible === "boolean")
    && (!Object.hasOwn(display, "color") || (typeof display.color === "string" && SAFE_COLOR.test(display.color)))
    && (!Object.hasOwn(display, "edgeColor") || (typeof display.edgeColor === "string" && SAFE_COLOR.test(display.edgeColor)))
    && (!Object.hasOwn(display, "opacity") || (Number.isFinite(display.opacity) && display.opacity >= 0 && display.opacity <= 1))
    && (!Object.hasOwn(display, "pointSize") || (Number.isFinite(display.pointSize) && display.pointSize > 0));
}

function vec3Ok(value = []) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => Number.isFinite(entry));
}

function sameVec3(left = [], right = []) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === 3
    && right.length === 3
    && left.every((entry, index) => Number.isFinite(entry) && Number.isFinite(right[index]) && Math.abs(entry - right[index]) < 1e-9);
}

function boundsOk(value = {}) {
  return isRecord(value)
    && exactObjectFieldsOk(value, ["min", "max"])
    && vec3Ok(value.min)
    && vec3Ok(value.max)
    && value.min.every((entry, index) => entry <= value.max[index]);
}

function sameBounds(left = {}, right = {}) {
  return sameVec3(left?.min, right?.min) && sameVec3(left?.max, right?.max);
}

function pointPayloadBounds(points = []) {
  if (!Array.isArray(points) || points.length === 0 || !points.every(vec3Ok)) return null;
  const min = [...points[0]];
  const max = [...points[0]];
  for (const point of points.slice(1)) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }
  return { min, max };
}

function pointPayloadBoundsMatch(points = [], bounds = {}) {
  const payloadBounds = pointPayloadBounds(points);
  return payloadBounds !== null && sameBounds(payloadBounds, bounds);
}

function mergeBounds(boundsList = []) {
  if (!Array.isArray(boundsList) || boundsList.length === 0 || !boundsList.every(boundsOk)) return null;
  const min = [...boundsList[0].min];
  const max = [...boundsList[0].max];
  for (const bounds of boundsList.slice(1)) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], bounds.min[index]);
      max[index] = Math.max(max[index], bounds.max[index]);
    }
  }
  return { min, max };
}

function appendMapList(map, key, value) {
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

function dot3(a = [], b = []) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a = [], b = []) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function nonzeroVec3(value = []) {
  return vec3Ok(value) && dot3(value, value) > 0;
}

function nondegenerateBasisOk(axisX = [], axisY = [], axisZ = []) {
  return nonzeroVec3(axisX)
    && nonzeroVec3(axisY)
    && nonzeroVec3(axisZ)
    && Math.abs(dot3(cross3(axisX, axisY), axisZ)) > 0;
}

function coordinateSystemOk(value = {}) {
  return isRecord(value)
    && exactObjectFieldsOk(value, ["origin", "axisX", "axisY", "axisZ"])
    && vec3Ok(value.origin)
    && vec3Ok(value.axisX)
    && vec3Ok(value.axisY)
    && vec3Ok(value.axisZ)
    && nondegenerateBasisOk(value.axisX, value.axisY, value.axisZ);
}

function sourceFamilyToken(value = "") {
  return SOURCE_FORMAT_FAMILY_ALIASES[String(value || "").trim().toLowerCase()] || "";
}

function safeTranslator(value = "") {
  return value === "tools/reference-geometry/translate_reference_geometry.mjs"
    || SAFE_TRANSLATOR_TOKEN.test(value)
    || SAFE_EXTERNAL_TRANSLATOR.test(value);
}

function sourceRequestedFormatOk(format = "", value = "") {
  return typeof value === "string"
    && SAFE_SOURCE_TOKEN.test(value)
    && Array.isArray(SOURCE_REQUESTED_FORMAT_TOKENS_BY_FORMAT[format])
    && SOURCE_REQUESTED_FORMAT_TOKENS_BY_FORMAT[format].includes(value);
}

function sourceFileExtensionOk(format = "", value = "") {
  return typeof value === "string"
    && (value === "" || SAFE_SOURCE_TOKEN.test(value))
    && Array.isArray(SOURCE_FILE_EXTENSION_TOKENS_BY_FORMAT[format])
    && SOURCE_FILE_EXTENSION_TOKENS_BY_FORMAT[format].includes(value);
}

function sourceFileNameOk(value = "") {
  return typeof value === "string"
    && value.length > 0
    && value.trim() === value
    && path.basename(value.replace(/\\/g, "/")) === value
    && value !== "."
    && value !== ".."
    && !/[\\/:?\u0000-\u001f\u007f]/.test(value);
}

function dateTimeOk(value = "") {
  const match = typeof value === "string" ? RFC3339_DATE_TIME_PATTERN.exec(value) : null;
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDay) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== "Z" && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false;
  return true;
}

function sourceRecordOk(source = {}) {
  if (!isRecord(source)) return false;
  const keys = Object.keys(source);
  if (!keys.every((field) => REFERENCE_SOURCE_FIELDS.includes(field))) return false;
  if (!Object.hasOwn(source, "format") || typeof source.format !== "string") return false;
  if (!Object.hasOwn(SOURCE_REQUESTED_FORMAT_TOKENS_BY_FORMAT, source.format) && source.format !== "unknown") return false;
  if (source.format === "unknown" && Object.hasOwn(source, "requestedFormat")) return false;
  return (!Object.hasOwn(source, "fileName") || sourceFileNameOk(source.fileName))
    && (!Object.hasOwn(source, "fileExtension") || sourceFileExtensionOk(source.format, source.fileExtension))
    && (!Object.hasOwn(source, "requestedFormat") || sourceRequestedFormatOk(source.format, source.requestedFormat))
    && (!Object.hasOwn(source, "fileSizeBytes") || (Number.isSafeInteger(source.fileSizeBytes) && source.fileSizeBytes >= 0))
    && (!Object.hasOwn(source, "modifiedTime") || dateTimeOk(source.modifiedTime))
    && (!Object.hasOwn(source, "statFingerprint") || (typeof source.statFingerprint === "string" && STAT_SHA256_FINGERPRINT.test(source.statFingerprint)))
    && (!Object.hasOwn(source, "checksum") || (typeof source.checksum === "string" && CHECKSUM_SHA256.test(source.checksum)))
    && (!Object.hasOwn(source, "translator") || (typeof source.translator === "string" && source.translator.length > 0 && safeTranslator(source.translator)))
    && (!Object.hasOwn(source, "translatorVersion") || (typeof source.translatorVersion === "string" && SAFE_TRANSLATOR_VERSION.test(source.translatorVersion)))
    && (!Object.hasOwn(source, "adapterKey") || safeId(source.adapterKey));
}

function sourceRecordFamily(source = {}) {
  if (!isRecord(source)) return "";
  return sourceFamilyToken(source.format);
}

function referenceAssetOk(asset = {}) {
  if (!isRecord(asset)) return false;
  const keys = Object.keys(asset);
  if (!keys.every((field) => REFERENCE_ASSET_FIELDS.includes(field))) return false;
  if (!REFERENCE_ASSET_REQUIRED_FIELDS.every((field) => Object.hasOwn(asset, field))) return false;
  return safeId(asset.id)
    && typeof asset.name === "string"
    && asset.name.length > 0
    && sourceRecordOk(asset.source)
    && sourceRecordFamily(asset.source)
    && REFERENCE_UNITS.has(asset.units)
    && coordinateSystemOk(asset.coordinateSystem)
    && (!Object.hasOwn(asset, "bounds") || boundsOk(asset.bounds));
}

function referenceLayersOk(layers = {}) {
  return isRecord(layers)
    && Object.keys(layers).length > 0
    && Object.entries(layers).every(([key, layer]) => (
      safeId(key)
      && isRecord(layer)
      && Object.keys(layer).every((field) => REFERENCE_LAYER_FIELDS.includes(field))
      && safeId(layer.id)
      && layer.id === key
      && typeof layer.name === "string"
      && layer.name.length > 0
      && (!Object.hasOwn(layer, "display") || displayOk(layer.display))
    ));
}

function referenceChunksOk(chunks = [], objects = {}) {
  if (!Array.isArray(chunks)) return false;
  const chunkIds = new Set();
  return chunks.every((chunk) => {
    const object = isRecord(chunk) && safeId(chunk.objectId) ? objects[chunk.objectId] : null;
    const chunkOk = isRecord(chunk)
      && Object.keys(chunk).every((field) => REFERENCE_CHUNK_FIELDS.includes(field))
      && safeId(chunk.id)
      && !chunkIds.has(chunk.id)
      && chunk.kind === "point-cloud"
      && safeId(chunk.objectId)
      && isRecord(object)
      && safeId(object.id)
      && object.id === chunk.objectId
      && object.kind === "point-cloud"
      && Array.isArray(object.chunkIds)
      && object.chunkIds.includes(chunk.id)
      && safeChunkPath(chunk.path)
      && Number.isSafeInteger(chunk.pointCount)
      && chunk.pointCount > 0
      && (!Object.hasOwn(chunk, "bounds") || boundsOk(chunk.bounds));
    if (chunkOk) chunkIds.add(chunk.id);
    return chunkOk;
  });
}

function referenceChunkRefsByObjectId(chunks = []) {
  const refsByObjectId = new Map();
  for (const chunk of chunks) {
    const refs = refsByObjectId.get(chunk.objectId) || new Set();
    refs.add(chunk.id);
    refsByObjectId.set(chunk.objectId, refs);
  }
  return refsByObjectId;
}

function referenceChunksByObjectId(chunks = []) {
  const chunksByObjectId = new Map();
  for (const chunk of chunks) {
    const objectChunks = chunksByObjectId.get(chunk.objectId) || [];
    objectChunks.push(chunk);
    chunksByObjectId.set(chunk.objectId, objectChunks);
  }
  return chunksByObjectId;
}

function topologyIndexOk(index, vertexCount) {
  return Number.isSafeInteger(index) && index >= 0 && index < vertexCount;
}

function lineSegmentOk(segment = [], vertexCount = 0) {
  return Array.isArray(segment)
    && segment.length === 2
    && new Set(segment).size === segment.length
    && segment.every((index) => topologyIndexOk(index, vertexCount));
}

function faceOk(face = [], vertexCount = 0) {
  return Array.isArray(face)
    && face.length >= 3
    && new Set(face).size === face.length
    && face.every((index) => topologyIndexOk(index, vertexCount));
}

function referenceObjectPayloadBounds(object = {}, chunksByObjectId = new Map()) {
  if (object.kind === "line-set" || object.kind === "mesh") {
    return pointPayloadBounds(object.vertices);
  }
  if (object.kind === "point-cloud" && Array.isArray(object.points)) {
    return pointPayloadBounds(object.points);
  }
  if (object.kind === "point-cloud" && Array.isArray(object.chunkIds)) {
    const objectChunks = chunksByObjectId.get(object.id) || [];
    const chunkBounds = object.chunkIds.map((chunkId) => objectChunks.find((chunk) => chunk.id === chunkId)?.bounds || null);
    return chunkBounds.every((bounds) => bounds !== null) ? mergeBounds(chunkBounds) : null;
  }
  return null;
}

function referenceObjectBoundsOk(object = {}, chunksByObjectId = new Map()) {
  const payloadBounds = referenceObjectPayloadBounds(object, chunksByObjectId);
  return payloadBounds !== null
    && (!Object.hasOwn(object, "bounds") || sameBounds(object.bounds, payloadBounds));
}

function referenceObjectHasGeometry(object = {}, chunkRefsByObjectId = new Map()) {
  if (object.kind === "line-set") {
    return Array.isArray(object.vertices)
      && object.vertices.length >= 2
      && object.vertices.every(vec3Ok)
      && Array.isArray(object.lineSegments)
      && object.lineSegments.length > 0
      && object.lineSegments.every((segment) => lineSegmentOk(segment, object.vertices.length))
      && !Object.hasOwn(object, "faces")
      && !Object.hasOwn(object, "points")
      && !Object.hasOwn(object, "pointAttributes")
      && !Object.hasOwn(object, "chunkIds");
  }
  if (object.kind === "mesh") {
    return Array.isArray(object.vertices)
      && object.vertices.length >= 3
      && object.vertices.every(vec3Ok)
      && Array.isArray(object.faces)
      && object.faces.length > 0
      && object.faces.every((face) => faceOk(face, object.vertices.length))
      && !Object.hasOwn(object, "lineSegments")
      && !Object.hasOwn(object, "points")
      && !Object.hasOwn(object, "pointAttributes")
      && !Object.hasOwn(object, "chunkIds");
  }
  if (object.kind === "point-cloud") {
    const ownedChunkIds = chunkRefsByObjectId.get(object.id) || new Set();
    const inlinePointsOk = Array.isArray(object.points)
      && object.points.length > 0
      && object.points.every(vec3Ok)
      && (!Object.hasOwn(object, "pointAttributes") || pointAttributesOk(object.pointAttributes, object.points.length))
      && !Object.hasOwn(object, "vertices")
      && !Object.hasOwn(object, "lineSegments")
      && !Object.hasOwn(object, "faces")
      && !Array.isArray(object.chunkIds);
    const chunkedPointsOk = Array.isArray(object.chunkIds)
      && object.chunkIds.length > 0
      && new Set(object.chunkIds).size === object.chunkIds.length
      && object.chunkIds.every((id) => safeId(id) && ownedChunkIds.has(id))
      && !Object.hasOwn(object, "vertices")
      && !Object.hasOwn(object, "lineSegments")
      && !Object.hasOwn(object, "faces")
      && !Object.hasOwn(object, "pointAttributes")
      && !Array.isArray(object.points);
    return inlinePointsOk || chunkedPointsOk;
  }
  return false;
}

function referenceObjectsOk(objects = {}, layers = {}, chunks = []) {
  if (!isRecord(objects) || Object.keys(objects).length === 0) return false;
  const layerIds = new Set(Object.keys(layers || {}));
  const chunksOk = referenceChunksOk(chunks, objects);
  if (!chunksOk) return false;
  const chunkRefsByObjectId = referenceChunkRefsByObjectId(chunks);
  const chunksByObjectId = referenceChunksByObjectId(chunks);
  return Object.entries(objects).every(([key, object]) => (
    safeId(key)
    && isRecord(object)
    && Object.keys(object).every((field) => REFERENCE_OBJECT_FIELDS.includes(field))
    && safeId(object.id)
    && object.id === key
    && REFERENCE_OBJECT_KINDS.has(object.kind)
    && (!Object.hasOwn(object, "name") || (typeof object.name === "string" && object.name.length > 0))
    && (!Object.hasOwn(object, "layer") || (safeId(object.layer) && layerIds.has(object.layer)))
    && (!Object.hasOwn(object, "display") || displayOk(object.display))
    && (!Object.hasOwn(object, "metadata") || isRecord(object.metadata))
    && (!Object.hasOwn(object, "bounds") || boundsOk(object.bounds))
    && referenceObjectBoundsOk(object, chunksByObjectId)
    && referenceObjectHasGeometry(object, chunkRefsByObjectId)
  ));
}

function referenceDiagnosticOk(diagnostic = {}, objectIds = new Set()) {
  if (!isRecord(diagnostic)) return false;
  const keys = Object.keys(diagnostic);
  return keys.every((field) => REFERENCE_DIAGNOSTIC_FIELDS.includes(field))
    && REFERENCE_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity)
    && typeof diagnostic.code === "string"
    && diagnostic.code.length > 0
    && typeof diagnostic.message === "string"
    && diagnostic.message.length > 0
    && (!Object.hasOwn(diagnostic, "objectId") || (safeId(diagnostic.objectId) && objectIds.has(diagnostic.objectId)))
    && (!Object.hasOwn(diagnostic, "objectRefs") || (
      Array.isArray(diagnostic.objectRefs)
      && diagnostic.objectRefs.length > 0
      && new Set(diagnostic.objectRefs).size === diagnostic.objectRefs.length
      && diagnostic.objectRefs.every((objectId) => safeId(objectId) && objectIds.has(objectId))
    ));
}

function referenceDiagnosticsOk(diagnostics = [], objects = {}) {
  if (!Array.isArray(diagnostics)) return false;
  const objectIds = new Set(Object.keys(objects || {}));
  return diagnostics.every((diagnostic) => referenceDiagnosticOk(diagnostic, objectIds));
}

function referenceAssetBoundsOk(asset = {}, objects = {}, chunks = []) {
  if (!Object.hasOwn(asset, "bounds")) return true;
  const chunksByObjectId = referenceChunksByObjectId(chunks);
  const objectBounds = Object.values(objects).map((object) => referenceObjectPayloadBounds(object, chunksByObjectId));
  const payloadBounds = objectBounds.every((bounds) => bounds !== null) ? mergeBounds(objectBounds) : null;
  return payloadBounds !== null && sameBounds(asset.bounds, payloadBounds);
}

function rgbOk(value = []) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255);
}

function pointAttributesOk(pointAttributes = {}, pointCount = 0) {
  if (!isRecord(pointAttributes)) return false;
  const allowed = ["colors", "intensities", "classifications", "normals"];
  if (!Object.keys(pointAttributes).every((field) => allowed.includes(field))) return false;
  if (!allowed.some((field) => Object.hasOwn(pointAttributes, field))) return false;
  if (Object.hasOwn(pointAttributes, "colors") && (!Array.isArray(pointAttributes.colors) || pointAttributes.colors.length !== pointCount || !pointAttributes.colors.every(rgbOk))) return false;
  if (Object.hasOwn(pointAttributes, "intensities") && (!Array.isArray(pointAttributes.intensities) || pointAttributes.intensities.length !== pointCount || !pointAttributes.intensities.every((value) => Number.isFinite(value)))) return false;
  if (Object.hasOwn(pointAttributes, "classifications") && (!Array.isArray(pointAttributes.classifications) || pointAttributes.classifications.length !== pointCount || !pointAttributes.classifications.every((value) => Number.isSafeInteger(value) && value >= 0))) return false;
  if (Object.hasOwn(pointAttributes, "normals") && (!Array.isArray(pointAttributes.normals) || pointAttributes.normals.length !== pointCount || !pointAttributes.normals.every(nonzeroVec3))) return false;
  return true;
}

function pathFreeReportPath(value = "") {
  return typeof value === "string" && value.length > 0 && pathFreeInputFileName(value) === value;
}

function adapterKeyListOk(values = []) {
  return Array.isArray(values)
    && values.length > 0
    && values.every((value) => safeAdapterKey(value));
}

function singleAdapterKeyListOk(values = []) {
  return adapterKeyListOk(values) && values.length === 1;
}

function adapterKeyMapOk(value = {}) {
  return isRecord(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => safeAdapterKey(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function fingerprintListMapOk(value = {}) {
  return isRecord(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => typeof entry === "string" && SHA256_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function singleFingerprintListOk(values = []) {
  return Array.isArray(values)
    && values.length === 1
    && typeof values[0] === "string"
    && SHA256_FINGERPRINT.test(values[0]);
}

function statFingerprintListMapOk(value = {}) {
  return isRecord(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => typeof entry === "string" && STAT_SHA256_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function singleStatFingerprintListOk(values = []) {
  return Array.isArray(values)
    && values.length === 1
    && typeof values[0] === "string"
    && STAT_SHA256_FINGERPRINT.test(values[0]);
}

function safeAdapterKeys(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => safeAdapterKey(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function safeAdapterKey(value = "") {
  return typeof value === "string"
    && SAFE_ADAPTER_KEY.test(value)
    && !RESERVED_ADAPTER_KEYS.has(value);
}

function addAdapterKeys(targetMap, family = "", keys = []) {
  if (!REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) return;
  const target = targetMap.get(family) || new Set();
  safeAdapterKeys(keys).forEach((key) => target.add(key));
  targetMap.set(family, target);
}

function adapterKeysForFamily(targetMap, family = "") {
  return [...(targetMap.get(family) || new Set())]
    .filter((key) => safeAdapterKey(key))
    .sort((left, right) => left.localeCompare(right));
}

function adapterKeyListMapSummary(keysByFamily = new Map()) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    adapterKeysForFamily(keysByFamily, family)
  ]));
}

function adapterKeySetsOverlap(leftMap, rightMap, family = "") {
  const rightKeys = new Set(adapterKeysForFamily(rightMap, family));
  return adapterKeysForFamily(leftMap, family).some((key) => rightKeys.has(key));
}

function safeFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && SHA256_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function addFingerprints(targetMap, family = "", fingerprints = []) {
  if (!REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) return;
  const target = targetMap.get(family) || new Set();
  safeFingerprints(fingerprints).forEach((fingerprint) => target.add(fingerprint));
  targetMap.set(family, target);
}

function fingerprintsForFamily(targetMap, family = "") {
  return [...(targetMap.get(family) || new Set())]
    .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint))
    .sort((left, right) => left.localeCompare(right));
}

function fingerprintListMapSummary(fingerprintsByFamily = new Map()) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    fingerprintsForFamily(fingerprintsByFamily, family)
  ]));
}

function fingerprintSetsOverlap(leftMap, rightMap, family = "") {
  const rightFingerprints = new Set(fingerprintsForFamily(rightMap, family));
  return fingerprintsForFamily(leftMap, family).some((fingerprint) => rightFingerprints.has(fingerprint));
}

function safeStatFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && STAT_SHA256_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function addStatFingerprints(targetMap, family = "", fingerprints = []) {
  if (!REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) return;
  const target = targetMap.get(family) || new Set();
  safeStatFingerprints(fingerprints).forEach((fingerprint) => target.add(fingerprint));
  targetMap.set(family, target);
}

function statFingerprintsForFamily(targetMap, family = "") {
  return [...(targetMap.get(family) || new Set())]
    .filter((fingerprint) => STAT_SHA256_FINGERPRINT.test(fingerprint))
    .sort((left, right) => left.localeCompare(right));
}

function statFingerprintListMapSummary(configStatFingerprintsByFamily = new Map()) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    statFingerprintsForFamily(configStatFingerprintsByFamily, family)
  ]));
}

function statFingerprintSetsOverlap(leftMap, rightMap, family = "") {
  const rightFingerprints = new Set(statFingerprintsForFamily(rightMap, family));
  return statFingerprintsForFamily(leftMap, family).some((fingerprint) => rightFingerprints.has(fingerprint));
}

function parseJsonBytes(raw) {
  return JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8").replace(/^\uFEFF/, "") : String(raw || "").replace(/^\uFEFF/, ""));
}

function allGateValuesTrue(gates = {}, expectedFields = []) {
  return exactObjectFieldsOk(gates, expectedFields)
    && expectedFields.every((field) => gates[field] === true);
}

function adapterPreflightEvidenceCheckAcceptedOk(report = {}, family = "") {
  const targetFormatToken = FAMILY_TARGET_FORMAT_TOKENS[family] || "";
  const targetFormatTokens = targetFormatToken ? [targetFormatToken] : [];
  return exactObjectFieldsOk(report, ADAPTER_PREFLIGHT_EVIDENCE_CHECK_FIELDS)
    && exactObjectFieldsOk(report?.summary, ADAPTER_PREFLIGHT_EVIDENCE_SUMMARY_FIELDS)
    && report.id === ADAPTER_PREFLIGHT_EVIDENCE_CHECK_ID
    && report.version === BUILDER_VERSION
    && report.ok === true
    && report.family === family
    && report.targetFormatToken === targetFormatToken
    && JSON.stringify(report.externalAdapterTargetFormatTokens) === JSON.stringify(targetFormatTokens)
    && pathFreeReportPath(report.preflightReportPath)
    && pathFreeReportPath(report.adapterPreflightEvidenceCheckPath)
    && SHA256_FINGERPRINT.test(report.preflightReportFingerprint || "")
    && STAT_SHA256_FINGERPRINT.test(report.adapterConfigStatFingerprint || "")
    && SHA256_FINGERPRINT.test(report.adapterRegistryFingerprint || "")
    && SHA256_FINGERPRINT.test(report.adapterPreflightFingerprint || "")
    && SHA256_FINGERPRINT.test(report.adapterTargetFormatCoverageFingerprint || "")
    && allGateValuesTrue(report.gates, ADAPTER_PREFLIGHT_EVIDENCE_GATE_FIELDS)
    && report.summary.family === family
    && report.summary.targetFormatToken === targetFormatToken
    && JSON.stringify(report.summary.externalAdapterTargetFormatTokens) === JSON.stringify(targetFormatTokens)
    && report.summary.adapterPreflightReady === true
    && Number.isSafeInteger(report.summary.adapterCount)
    && report.summary.adapterCount > 0
    && singleAdapterKeyListOk(report.summary.selectedAdapterKeys)
    && Array.isArray(report.summary.selectedAdapterTargetCoverageKeys)
    && JSON.stringify(safeAdapterKeys(report.summary.selectedAdapterTargetCoverageKeys)) === JSON.stringify(report.summary.selectedAdapterTargetCoverageKeys)
    && report.summary.selectedAdapterTargetCoverageKeys.includes(report.summary.selectedAdapterKeys[0])
    && typeof report.summary.requestedAdapter === "string"
    && report.summary.requestedAdapter === report.summary.selectedAdapterKeys[0]
    && STAT_SHA256_FINGERPRINT.test(report.summary.adapterConfigStatFingerprint || "")
    && SHA256_FINGERPRINT.test(report.summary.adapterRegistryFingerprint || "")
    && singleFingerprintListOk(report.summary.adapterRegistryAdapterFingerprints)
    && SHA256_FINGERPRINT.test(report.summary.adapterPreflightFingerprint || "")
    && SHA256_FINGERPRINT.test(report.summary.adapterTargetFormatCoverageFingerprint || "")
    && report.adapterConfigStatFingerprint === report.summary.adapterConfigStatFingerprint
    && report.adapterRegistryFingerprint === report.summary.adapterRegistryFingerprint
    && report.adapterPreflightFingerprint === report.summary.adapterPreflightFingerprint
    && report.adapterTargetFormatCoverageFingerprint === report.summary.adapterTargetFormatCoverageFingerprint
    && Array.isArray(report.summary.blockingDiagnosticCodes)
    && report.summary.blockingDiagnosticCodes.length === 0
    && Array.isArray(report.summary.warningDiagnosticCodes)
    && Array.isArray(report.failures)
    && report.failures.length === 0
    && Array.isArray(report.warnings);
}

function adapterPreflightEvidenceBytesAccepted(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family);
  } catch {
    return false;
  }
}

function adapterPreflightSelectedKeysFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family)
      ? safeAdapterKeys(report.summary?.selectedAdapterKeys)
      : [];
  } catch {
    return [];
  }
}

function adapterPreflightConfigStatFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family)
      ? safeStatFingerprints([report.summary?.adapterConfigStatFingerprint])
      : [];
  } catch {
    return [];
  }
}

function adapterPreflightFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family)
      ? safeFingerprints([report.summary?.adapterPreflightFingerprint])
      : [];
  } catch {
    return [];
  }
}

function adapterPreflightRegistryFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family)
      ? safeFingerprints(report.summary?.adapterRegistryAdapterFingerprints)
      : [];
  } catch {
    return [];
  }
}

function adapterPreflightRegistryAggregateFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return adapterPreflightEvidenceCheckAcceptedOk(report, family)
      ? safeFingerprints([report.summary?.adapterRegistryFingerprint])
      : [];
  } catch {
    return [];
  }
}

function stringListIncludesOnlySafeFamilies(values = [], allowedFamilies = []) {
  return Array.isArray(values)
    && values.every((value) => typeof value === "string" && allowedFamilies.includes(value));
}

function emptySafeCaseIdList(values = []) {
  return Array.isArray(values) && values.length === 0;
}

function corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report = {}, family = "") {
  return exactObjectFieldsOk(report, CORPUS_ACCEPTANCE_REPORT_FIELDS)
    && exactObjectFieldsOk(report?.gates, CORPUS_ACCEPTANCE_GATE_FIELDS)
    && exactObjectFieldsOk(report?.summary, CORPUS_ACCEPTANCE_SUMMARY_FIELDS)
    && report.id === FINAL_ACCEPTANCE_REPORT_ID
    && report.version === BUILDER_VERSION
    && report.ok === true
    && report.reportId === CORPUS_REPORT_ID
    && report.reportVersion === BUILDER_VERSION
    && pathFreeReportPath(report.reportPath)
    && SHA256_FINGERPRINT.test(report.reportFingerprint || "")
    && stringListIncludesOnlySafeFamilies(report.gates.requiredExternalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && report.gates.requiredExternalAdapterFamilies.includes(family)
    && stringListIncludesOnlySafeFamilies(report.gates.externalAdapterMissingFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && !report.gates.externalAdapterMissingFamilies.includes(family)
    && emptySafeCaseIdList(report.gates.weakExternalAdapterEvidenceCaseIds)
    && emptySafeCaseIdList(report.gates.missingExternalAdapterSourceAdapterAssertionCaseIds)
    && stringListIncludesOnlySafeFamilies(report.summary.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && report.summary.externalAdapterFamilies.includes(family)
    && JSON.stringify(report.summary.externalAdapterTargetFormatTokens) === JSON.stringify(REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && adapterKeyMapOk(report.summary.externalAdapterSourceAdapterKeys)
    && singleAdapterKeyListOk(report.summary.externalAdapterSourceAdapterKeys[family])
    && fingerprintListMapOk(report.summary.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && singleFingerprintListOk(report.summary.externalAdapterSourceAdapterRequestEvidenceFingerprints[family])
    && statFingerprintListMapOk(report.summary.externalAdapterSourceAdapterConfigStatFingerprints)
    && singleStatFingerprintListOk(report.summary.externalAdapterSourceAdapterConfigStatFingerprints[family])
    && fingerprintListMapOk(report.summary.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && singleFingerprintListOk(report.summary.externalAdapterSourceAdapterRegistryAggregateFingerprints[family])
    && fingerprintListMapOk(report.summary.externalAdapterSourceAdapterRegistryFingerprints)
    && singleFingerprintListOk(report.summary.externalAdapterSourceAdapterRegistryFingerprints[family])
    && fingerprintListMapOk(report.summary.externalAdapterSourceAdapterPreflightFingerprints)
    && singleFingerprintListOk(report.summary.externalAdapterSourceAdapterPreflightFingerprints[family])
    && report.summary.accepted === true
    && report.summary.coverageOk === true
    && report.summary.sourceEvidenceReady === true
    && Array.isArray(report.finalPrivateAcceptanceSummary?.requiredPrivateEvidence)
    && report.finalPrivateAcceptanceSummary.requiredPrivateEvidence.includes("accepted DWG/E57 external-adapter sourceAdapter assertion evidence")
    && JSON.stringify(report.finalPrivateAcceptanceSummary?.requiredExternalAdapterTargetFormatTokens) === JSON.stringify(REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && Array.isArray(report.failures)
    && report.failures.length === 0
    && Array.isArray(report.warnings);
}

function sourceAdapterAssertionEvidenceBytesAccepted(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family);
  } catch {
    return false;
  }
}

function sourceAdapterAssertionKeysFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeAdapterKeys(report.summary?.externalAdapterSourceAdapterKeys?.[family])
      : [];
  } catch {
    return [];
  }
}

function sourceAdapterAssertionRequestEvidenceFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeFingerprints(report.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints?.[family])
      : [];
  } catch {
    return [];
  }
}

function sourceAdapterAssertionConfigStatFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeStatFingerprints(report.summary?.externalAdapterSourceAdapterConfigStatFingerprints?.[family])
      : [];
  } catch {
    return [];
  }
}

function sourceAdapterAssertionPreflightFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeFingerprints(report.summary?.externalAdapterSourceAdapterPreflightFingerprints?.[family])
      : [];
  } catch {
    return [];
  }
}

function sourceAdapterAssertionRegistryFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeFingerprints(report.summary?.externalAdapterSourceAdapterRegistryFingerprints?.[family])
      : [];
  } catch {
    return [];
  }
}

function sourceAdapterAssertionRegistryAggregateFingerprintsFromBytes(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportSourceAdapterAssertionAcceptedOk(report, family)
      ? safeFingerprints(report.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints?.[family])
      : [];
  } catch {
    return [];
  }
}

function corpusAcceptanceReportPointCloudEvidenceAcceptedOk(report = {}, family = "") {
  return exactObjectFieldsOk(report, CORPUS_ACCEPTANCE_REPORT_FIELDS)
    && exactObjectFieldsOk(report?.gates, CORPUS_ACCEPTANCE_GATE_FIELDS)
    && exactObjectFieldsOk(report?.summary, CORPUS_ACCEPTANCE_SUMMARY_FIELDS)
    && report.id === FINAL_ACCEPTANCE_REPORT_ID
    && report.version === BUILDER_VERSION
    && report.ok === true
    && report.reportId === CORPUS_REPORT_ID
    && report.reportVersion === BUILDER_VERSION
    && pathFreeReportPath(report.reportPath)
    && SHA256_FINGERPRINT.test(report.reportFingerprint || "")
    && stringListIncludesOnlySafeFamilies(report.gates.requiredPointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && report.gates.requiredPointCloudFamilies.includes(family)
    && stringListIncludesOnlySafeFamilies(report.gates.pointCloudMissingFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && !report.gates.pointCloudMissingFamilies.includes(family)
    && emptySafeCaseIdList(report.gates.emptyReferenceGeometryCaseIds)
    && stringListIncludesOnlySafeFamilies(report.summary.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && report.summary.pointCloudFamilies.includes(family)
    && report.summary.accepted === true
    && report.summary.coverageOk === true
    && report.summary.sourceEvidenceReady === true
    && Array.isArray(report.failures)
    && report.failures.length === 0
    && Array.isArray(report.warnings);
}

function pointCloudEvidenceBytesAccepted(raw, family = "") {
  try {
    const report = parseJsonBytes(raw);
    return corpusAcceptanceReportPointCloudEvidenceAcceptedOk(report, family);
  } catch {
    return false;
  }
}

function canonicalReferenceManifestEvidence(manifest = {}) {
  if (
    !exactObjectFieldsOk(manifest, REFERENCE_GEOMETRY_FIELDS)
    || !schemaRefOk(manifest.$schema)
    || manifest.schema !== "bobercad-reference-geometry"
    || manifest.schemaVersion !== BUILDER_VERSION
    || !referenceAssetOk(manifest.asset)
    || !referenceLayersOk(manifest.layers)
    || !Array.isArray(manifest.chunks)
    || !referenceObjectsOk(manifest.objects, manifest.layers, manifest.chunks)
    || !referenceAssetBoundsOk(manifest.asset, manifest.objects, manifest.chunks)
    || !referenceDiagnosticsOk(manifest.diagnostics, manifest.objects)
  ) {
    return null;
  }
  const family = sourceRecordFamily(manifest.asset.source);
  return family
    ? {
      family,
      assetId: manifest.asset.id,
      pointCloudChunks: manifest.chunks.map((chunk) => ({
        chunkRef: `${chunk.id}:${chunk.objectId}`,
        pointCount: chunk.pointCount,
        bounds: chunk.bounds || null
      }))
    }
    : null;
}

function canonicalReferenceManifestFamily(manifest = {}) {
  return canonicalReferenceManifestEvidence(manifest)?.family || "";
}

function promotedReferenceManifestEvidenceFromBytes(raw) {
  try {
    const manifest = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8").replace(/^\uFEFF/, "") : String(raw || "").replace(/^\uFEFF/, ""));
    return canonicalReferenceManifestEvidence(manifest);
  } catch {
    return null;
  }
}

function promotedReferenceManifestFamilyFromBytes(raw) {
  return promotedReferenceManifestEvidenceFromBytes(raw)?.family || "";
}

function pointCloudChunkSidecarOk(chunk = {}) {
  if (!isRecord(chunk)) return false;
  const keys = Object.keys(chunk);
  if (!keys.every((field) => POINT_CLOUD_CHUNK_FIELDS.includes(field))) return false;
  if (!POINT_CLOUD_CHUNK_REQUIRED_FIELDS.every((field) => Object.hasOwn(chunk, field))) return false;
  return schemaRefOk(chunk.$schema)
    && chunk.schema === "bobercad-reference-point-cloud-chunk"
    && chunk.schemaVersion === BUILDER_VERSION
    && safeId(chunk.id)
    && chunk.kind === "point-cloud"
    && safeId(chunk.objectId)
    && Number.isSafeInteger(chunk.pointCount)
    && chunk.pointCount > 0
    && boundsOk(chunk.bounds)
    && Array.isArray(chunk.points)
    && chunk.points.length === chunk.pointCount
    && chunk.points.every(vec3Ok)
    && pointPayloadBoundsMatch(chunk.points, chunk.bounds)
    && (!Object.hasOwn(chunk, "pointAttributes") || pointAttributesOk(chunk.pointAttributes, chunk.pointCount))
    && (!Object.hasOwn(chunk, "metadata") || isRecord(chunk.metadata));
}

function pointCloudChunkSidecarEvidence(chunk = {}) {
  return pointCloudChunkSidecarOk(chunk)
    ? {
      chunkRef: `${chunk.id}:${chunk.objectId}`,
      pointCount: chunk.pointCount,
      bounds: chunk.bounds
    }
    : null;
}

function pointCloudChunkSidecarBytesAccepted(raw) {
  try {
    const chunk = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8").replace(/^\uFEFF/, "") : String(raw || "").replace(/^\uFEFF/, ""));
    return pointCloudChunkSidecarOk(chunk);
  } catch {
    return false;
  }
}

function pointCloudChunkSidecarEvidenceFromBytes(raw) {
  try {
    const chunk = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8").replace(/^\uFEFF/, "") : String(raw || "").replace(/^\uFEFF/, ""));
    return pointCloudChunkSidecarEvidence(chunk);
  } catch {
    return null;
  }
}

function projectReferenceAssetPointerOk(asset = {}) {
  if (!isRecord(asset)) return false;
  const keys = Object.keys(asset);
  return keys.length > 0
    && keys.every((field) => PROJECT_REFERENCE_ASSET_FIELDS.includes(field))
    && !keys.some((field) => PROJECT_REFERENCE_FORBIDDEN_POINTER_FIELDS.includes(field))
    && typeof asset.path === "string"
    && PROJECT_REFERENCE_PATH.test(asset.path)
    && (!Object.hasOwn(asset, "visible") || typeof asset.visible === "boolean")
    && (!Object.hasOwn(asset, "snapEnabled") || typeof asset.snapEnabled === "boolean")
    && (!Object.hasOwn(asset, "display") || isRecord(asset.display))
    && (!Object.hasOwn(asset, "transform") || isRecord(asset.transform));
}

function disposableProjectCopyReferencePointers(project = {}) {
  if (
    !isRecord(project)
    || project.schema !== "steel-bim-project"
    || typeof project.schemaVersion !== "string"
    || project.schemaVersion.length === 0
    || !isRecord(project.referenceGeometry)
    || !isRecord(project.referenceGeometry.assets)
  ) {
    return [];
  }
  const assets = project.referenceGeometry.assets;
  const entries = Object.entries(assets);
  if (!entries.length) return [];
  if (!entries.every(([id, asset]) => safeId(id) && projectReferenceAssetPointerOk(asset))) return [];
  if (isRecord(project.objectIndex) && entries.some(([id]) => Object.hasOwn(project.objectIndex, id))) return [];
  if (isRecord(project.model) && entries.some(([id]) => Object.hasOwn(project.model, id))) return [];
  if (isRecord(project.model?.addonData) && entries.some(([id]) => Object.hasOwn(project.model.addonData, id))) return [];
  return entries.map(([assetId, asset]) => ({ assetId, path: asset.path }));
}

function disposableProjectCopyReferencePaths(project = {}) {
  return disposableProjectCopyReferencePointers(project).map((entry) => entry.path);
}

function disposableProjectCopyReferencePointersFromBytes(raw) {
  try {
    const project = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8").replace(/^\uFEFF/, "") : String(raw || "").replace(/^\uFEFF/, ""));
    return disposableProjectCopyReferencePointers(project);
  } catch {
    return [];
  }
}

function disposableProjectCopyReferencePathsFromBytes(raw) {
  return disposableProjectCopyReferencePointersFromBytes(raw).map((entry) => entry.path);
}

function finalAcceptanceCheckAcceptedOk(check = {}) {
  const gates = check?.gates || {};
  return check?.id === FINAL_ACCEPTANCE_CHECK_ID
    && check?.version === BUILDER_VERSION
    && check?.ok === true
    && check?.acceptanceReportId === FINAL_ACCEPTANCE_REPORT_ID
    && check?.acceptanceReportVersion === BUILDER_VERSION
    && check?.finalPrivateAcceptanceProfileId === FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID
    && check?.upstreamCorpusRunProfileId === UPSTREAM_CORPUS_RUN_PROFILE_ID
    && check?.completionEvidenceId === COMPLETION_EVIDENCE_PROFILE_ID
    && SHA256_FINGERPRINT.test(check?.acceptanceReportFingerprint || "")
    && SHA256_FINGERPRINT.test(check?.corpusReportFingerprint || "")
    && gates.acceptanceReportShapeOk === true
    && gates.acceptanceReportValueShapeOk === true
    && gates.acceptedReportIdentityOk === true
    && gates.acceptedReportOk === true
    && gates.expectedAcceptanceReportFingerprint === check.acceptanceReportFingerprint
    && gates.acceptanceReportFingerprintMatchesExpected === true
    && gates.corpusReportFingerprintPresent === true
    && gates.corpusReportFingerprintPinned === true
    && gates.requiredFormatFamiliesOk === true
    && gates.requiredExternalAdapterFamiliesOk === true
    && gates.requiredExternalAdapterTargetFormatTokensOk === true
    && gates.requiredPointCloudFamiliesOk === true
    && gates.sourceSizeGatePresent === true
    && gates.nonemptyReferenceGeometryRequired === true
    && gates.promotedImportWritesRequired === true
    && Array.isArray(gates.missingGateEvidence)
    && gates.missingGateEvidence.length === 0
    && gates.finalPrivateAcceptanceSummaryOk === true
    && gates.requiredPrivateEvidenceOk === true
    && gates.finalAcceptanceOutputWritableOk === true
    && JSON.stringify(check?.summary?.externalAdapterTargetFormatTokens) === JSON.stringify(REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && adapterKeyMapOk(check?.summary?.externalAdapterSourceAdapterKeys)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleAdapterKeyListOk(check.summary.externalAdapterSourceAdapterKeys[family]))
    && fingerprintListMapOk(check?.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleFingerprintListOk(check.summary.externalAdapterSourceAdapterRequestEvidenceFingerprints[family]))
    && statFingerprintListMapOk(check?.summary?.externalAdapterSourceAdapterConfigStatFingerprints)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleStatFingerprintListOk(check.summary.externalAdapterSourceAdapterConfigStatFingerprints[family]))
    && fingerprintListMapOk(check?.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleFingerprintListOk(check.summary.externalAdapterSourceAdapterRegistryAggregateFingerprints[family]))
    && fingerprintListMapOk(check?.summary?.externalAdapterSourceAdapterRegistryFingerprints)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleFingerprintListOk(check.summary.externalAdapterSourceAdapterRegistryFingerprints[family]))
    && fingerprintListMapOk(check?.summary?.externalAdapterSourceAdapterPreflightFingerprints)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => singleFingerprintListOk(check.summary.externalAdapterSourceAdapterPreflightFingerprints[family]))
    && check?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT
    && Array.isArray(check?.failures)
    && check.failures.length === 0
    && Array.isArray(check?.warnings)
    && check.warnings.length === 0;
}

function finalAcceptanceCheckShapeOk(check = {}) {
  return exactObjectFieldsOk(check, FINAL_ACCEPTANCE_CHECK_FIELDS)
    && exactObjectFieldsOk(check?.gates, FINAL_ACCEPTANCE_GATE_FIELDS)
    && exactObjectFieldsOk(check?.summary, FINAL_ACCEPTANCE_SUMMARY_FIELDS);
}

function validKindFamily(kind = "", family = "") {
  if (GLOBAL_SOURCE_KINDS.has(kind)) return family === "";
  if (kind === "private-source-family") return REQUIRED_SOURCE_FAMILIES.includes(family);
  if (kind === "external-adapter-preflight") return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family);
  if (kind === "external-adapter-source-adapter-assertion") return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family);
  if (kind === "point-cloud-family") return REQUIRED_POINT_CLOUD_FAMILIES.includes(family);
  return false;
}

function validSourceItem(item) {
  return exactObjectFieldsOk(item, SOURCE_MANIFEST_ITEM_FIELDS)
    && SOURCE_EVIDENCE_KINDS.includes(item.kind)
    && (GLOBAL_SOURCE_KINDS.has(item.kind) || FAMILY_SOURCE_KINDS.has(item.kind))
    && validKindFamily(item.kind, item.family)
    && safeLabel(item.label)
    && Array.isArray(item.paths)
    && item.paths.length > 0
    && item.paths.every((entry) => typeof entry === "string" && entry.length > 0);
}

function exampleSourceManifest() {
  return {
    id: SOURCE_MANIFEST_ID,
    version: BUILDER_VERSION,
    items: [
      ...REQUIRED_SOURCE_FAMILIES.map((family) => ({
        kind: "private-source-family",
        family,
        label: `${family}-private-source`,
        paths: [`sources/${family}/replace-with-real-${family}-source`]
      })),
      ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => ({
        kind: "external-adapter-preflight",
        family,
        label: `${family}-adapter-preflight`,
        paths: [`adapter-preflight/${family}/replace-with-accepted-${family}-adapter-preflight-evidence-check.json`]
      })),
      ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => ({
        kind: "external-adapter-source-adapter-assertion",
        family,
        label: `${family}-source-adapter-assertion`,
        paths: [`adapter-source-adapter-assertion/${family}/replace-with-real-${family}-source-adapter-assertion.json`]
      })),
      ...REQUIRED_POINT_CLOUD_FAMILIES.map((family) => ({
        kind: "point-cloud-family",
        family,
        label: `${family}-point-cloud-evidence`,
        paths: [`point-cloud/${family}/replace-with-real-${family}-point-cloud-evidence.json`]
      })),
      {
        kind: "disposable-project-copy",
        family: "",
        label: "disposable-project-copies",
        paths: REQUIRED_SOURCE_FAMILIES.map((family) => `projects/${family}/replace-with-real-disposable-project-copy.json`)
      },
      {
        kind: "promoted-reference-manifest",
        family: "",
        label: "promoted-reference-manifests",
        paths: REQUIRED_SOURCE_FAMILIES.map((family) => `references/${family}/replace-with-real-promoted-reference-manifest.json`)
      },
      {
        kind: "point-cloud-chunk-sidecar",
        family: "",
        label: "point-cloud-chunk-sidecars",
        paths: ["point-cloud/e57/replace-with-real-point-cloud-chunk-sidecar.json"]
      }
    ]
  };
}

function sourceManifestShapeOk(manifest = {}) {
  return exactObjectFieldsOk(manifest, SOURCE_MANIFEST_FIELDS)
    && Array.isArray(manifest?.items)
    && manifest.items.every((item) => exactObjectFieldsOk(item, SOURCE_MANIFEST_ITEM_FIELDS));
}

function sourceManifestValueShapeOk(manifest = {}) {
  return manifest?.id === SOURCE_MANIFEST_ID
    && manifest?.version === BUILDER_VERSION
    && Array.isArray(manifest?.items)
    && manifest.items.length > 0
    && manifest.items.every(validSourceItem);
}

function sourceCount(items, kind, family) {
  return items
    .filter((item) => item.kind === kind && item.family === family && validSourceItem(item))
    .reduce((total, item) => total + item.paths.length, 0);
}

function requirementToken(requirement) {
  return `${requirement.kind}:${requirement.family || "all"}:${requirement.minCount}`;
}

function evidenceSourceSummary(manifest = {}) {
  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  const validItems = items.filter(validSourceItem);
  const externalAdapterPreflightEvidenceFamilies = validItems
    .filter((item) => item.kind === "external-adapter-preflight")
    .map((item) => item.family)
    .filter((family, index, families) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family) && families.indexOf(family) === index);
  const externalAdapterSourceAdapterAssertionFamilies = validItems
    .filter((item) => item.kind === "external-adapter-source-adapter-assertion")
    .map((item) => item.family)
    .filter((family, index, families) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family) && families.indexOf(family) === index);
  const missingSourceItems = SOURCE_REQUIREMENTS
    .filter((requirement) => !validItems.some((item) => item.kind === requirement.kind && item.family === requirement.family))
    .map(requirementToken);
  const insufficientSourceCounts = SOURCE_REQUIREMENTS
    .filter((requirement) => sourceCount(validItems, requirement.kind, requirement.family) < requirement.minCount)
    .map(requirementToken);
  return {
    sourceItemCount: validItems.length,
    evidenceItemCount: validItems.length + AUTO_EVIDENCE_KINDS.length,
    sourceFamilies: validItems
      .filter((item) => item.kind === "private-source-family")
      .map((item) => item.family)
      .filter((family, index, families) => REQUIRED_SOURCE_FAMILIES.includes(family) && families.indexOf(family) === index),
    externalAdapterFamilies: externalAdapterPreflightEvidenceFamilies,
    externalAdapterTargetFormatTokens: externalAdapterPreflightEvidenceFamilies
      .map((family) => FAMILY_TARGET_FORMAT_TOKENS[family])
      .filter((token, index, tokens) => REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS.includes(token) && tokens.indexOf(token) === index),
    externalAdapterPreflightEvidenceFamilies,
    missingExternalAdapterPreflightEvidenceFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES
      .filter((family) => !externalAdapterPreflightEvidenceFamilies.includes(family)),
    externalAdapterSourceAdapterAssertionFamilies,
    missingExternalAdapterSourceAdapterAssertionFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES
      .filter((family) => !externalAdapterSourceAdapterAssertionFamilies.includes(family)),
    pointCloudFamilies: validItems
      .filter((item) => item.kind === "point-cloud-family")
      .map((item) => item.family)
      .filter((family, index, families) => REQUIRED_POINT_CLOUD_FAMILIES.includes(family) && families.indexOf(family) === index),
    requiredSourceItems: SOURCE_REQUIREMENTS.map((requirement) => ({
      kind: requirement.kind,
      family: requirement.family,
      minCount: requirement.minCount,
      reason: requirement.reason
    })),
    missingSourceItems,
    insufficientSourceCounts
  };
}

function resolveEvidencePath(evidenceSourcesPath, evidencePath) {
  if (path.isAbsolute(evidencePath)) return path.normalize(evidencePath);
  return path.resolve(path.dirname(evidenceSourcesPath), evidencePath);
}

function aggregateEvidenceFingerprint(kind, family, fileFingerprints) {
  const payload = JSON.stringify({
    kind,
    family,
    count: fileFingerprints.length,
    fileFingerprints: [...fileFingerprints].sort()
  });
  return fileFingerprint(payload);
}

function buildEvidenceItems(manifest, evidenceSourcesPath) {
  const evidenceItems = [];
  const readFailures = new Set();
  const semanticFailures = new Set();
  const disposableProjectReferenceAssetIds = new Set();
  const disposableProjectReferencePaths = new Set();
  const promotedReferenceAssetIds = new Set();
  const promotedReferenceFamilies = new Set();
  const promotedPointCloudChunksByRef = new Map();
  const pointCloudSidecarChunksByRef = new Map();
  const preflightAdapterKeysByFamily = new Map();
  const sourceAssertionAdapterKeysByFamily = new Map();
  const preflightConfigStatFingerprintsByFamily = new Map();
  const sourceAssertionConfigStatFingerprintsByFamily = new Map();
  const preflightRegistryAggregateFingerprintsByFamily = new Map();
  const sourceAssertionRegistryAggregateFingerprintsByFamily = new Map();
  const preflightRegistryFingerprintsByFamily = new Map();
  const sourceAssertionRegistryFingerprintsByFamily = new Map();
  const preflightFingerprintsByFamily = new Map();
  const sourceAssertionPreflightFingerprintsByFamily = new Map();
  const sourceAssertionRequestEvidenceFingerprintsByFamily = new Map();
  for (const item of manifest.items.filter(validSourceItem)) {
    const fileFingerprints = [];
    let itemFilesReadable = true;
    let itemSemanticsOk = true;
    for (const evidencePath of item.paths) {
      try {
        const resolved = resolveEvidencePath(evidenceSourcesPath, evidencePath);
        const stats = fs.statSync(resolved);
        if (!stats.isFile()) {
          itemFilesReadable = false;
          readFailures.add("source evidence files must be readable regular files");
          continue;
        }
        const raw = fs.readFileSync(resolved);
        if (item.kind === "external-adapter-preflight" && !adapterPreflightEvidenceBytesAccepted(raw, item.family)) {
          itemSemanticsOk = false;
          semanticFailures.add("external adapter preflight evidence files must be accepted path-free verifier outputs");
        } else if (item.kind === "external-adapter-preflight") {
          addAdapterKeys(preflightAdapterKeysByFamily, item.family, adapterPreflightSelectedKeysFromBytes(raw, item.family));
          addStatFingerprints(preflightConfigStatFingerprintsByFamily, item.family, adapterPreflightConfigStatFingerprintsFromBytes(raw, item.family));
          addFingerprints(preflightRegistryAggregateFingerprintsByFamily, item.family, adapterPreflightRegistryAggregateFingerprintsFromBytes(raw, item.family));
          addFingerprints(preflightRegistryFingerprintsByFamily, item.family, adapterPreflightRegistryFingerprintsFromBytes(raw, item.family));
          addFingerprints(preflightFingerprintsByFamily, item.family, adapterPreflightFingerprintsFromBytes(raw, item.family));
        }
        if (item.kind === "external-adapter-source-adapter-assertion" && !sourceAdapterAssertionEvidenceBytesAccepted(raw, item.family)) {
          itemSemanticsOk = false;
          semanticFailures.add("external adapter sourceAdapter assertion evidence files must be accepted path-free corpus verifier outputs");
        } else if (item.kind === "external-adapter-source-adapter-assertion") {
          addAdapterKeys(sourceAssertionAdapterKeysByFamily, item.family, sourceAdapterAssertionKeysFromBytes(raw, item.family));
          addFingerprints(sourceAssertionRequestEvidenceFingerprintsByFamily, item.family, sourceAdapterAssertionRequestEvidenceFingerprintsFromBytes(raw, item.family));
          addStatFingerprints(sourceAssertionConfigStatFingerprintsByFamily, item.family, sourceAdapterAssertionConfigStatFingerprintsFromBytes(raw, item.family));
          addFingerprints(sourceAssertionRegistryAggregateFingerprintsByFamily, item.family, sourceAdapterAssertionRegistryAggregateFingerprintsFromBytes(raw, item.family));
          addFingerprints(sourceAssertionRegistryFingerprintsByFamily, item.family, sourceAdapterAssertionRegistryFingerprintsFromBytes(raw, item.family));
          addFingerprints(sourceAssertionPreflightFingerprintsByFamily, item.family, sourceAdapterAssertionPreflightFingerprintsFromBytes(raw, item.family));
        }
        if (item.kind === "point-cloud-family" && !pointCloudEvidenceBytesAccepted(raw, item.family)) {
          itemSemanticsOk = false;
          semanticFailures.add("point-cloud family evidence files must be accepted path-free corpus verifier outputs");
        }
        if (item.kind === "promoted-reference-manifest") {
          const manifestEvidence = promotedReferenceManifestEvidenceFromBytes(raw);
          if (!manifestEvidence) {
            itemSemanticsOk = false;
            semanticFailures.add("promoted reference manifest evidence files must be canonical reference manifest JSON");
          } else {
            promotedReferenceFamilies.add(manifestEvidence.family);
            promotedReferenceAssetIds.add(manifestEvidence.assetId);
            manifestEvidence.pointCloudChunks.forEach((chunk) => appendMapList(promotedPointCloudChunksByRef, chunk.chunkRef, chunk));
          }
        }
        if (item.kind === "point-cloud-chunk-sidecar") {
          const sidecarEvidence = pointCloudChunkSidecarEvidenceFromBytes(raw);
          if (!sidecarEvidence) {
            itemSemanticsOk = false;
            semanticFailures.add("point-cloud chunk sidecar evidence files must be canonical point-cloud chunk JSON");
          } else {
            appendMapList(pointCloudSidecarChunksByRef, sidecarEvidence.chunkRef, sidecarEvidence);
          }
        }
        if (item.kind === "disposable-project-copy") {
          const referencePointers = disposableProjectCopyReferencePointersFromBytes(raw);
          if (!referencePointers.length) {
            itemSemanticsOk = false;
            semanticFailures.add("disposable project copy evidence files must contain safe referenceGeometry asset pointers");
          } else {
            referencePointers.forEach((referencePointer) => {
              disposableProjectReferenceAssetIds.add(referencePointer.assetId);
              disposableProjectReferencePaths.add(referencePointer.path);
            });
          }
        }
        fileFingerprints.push(fileFingerprint(raw));
      } catch {
        itemFilesReadable = false;
        readFailures.add("source evidence files must be readable regular files");
      }
    }
    if (item.kind === "promoted-reference-manifest") {
      const coversRequiredFamilies = REQUIRED_SOURCE_FAMILIES.every((family) => promotedReferenceFamilies.has(family));
      if (!coversRequiredFamilies) {
        itemSemanticsOk = false;
        semanticFailures.add("promoted reference manifest evidence files must cover dxf/dwg/step/ifc/e57 canonical manifests");
      }
    }
    if (item.kind === "disposable-project-copy" && disposableProjectReferencePaths.size < REQUIRED_SOURCE_FAMILIES.length) {
      itemSemanticsOk = false;
      semanticFailures.add("disposable project copy evidence files must include five distinct promoted reference pointers");
    }
    if (itemFilesReadable && itemSemanticsOk && fileFingerprints.length === item.paths.length) {
      evidenceItems.push({
        kind: item.kind,
        family: item.family,
        fingerprint: aggregateEvidenceFingerprint(item.kind, item.family, fileFingerprints),
        count: item.paths.length,
        label: item.label
      });
    }
  }
  if (
    disposableProjectReferenceAssetIds.size > 0
    && promotedReferenceAssetIds.size > 0
    && [...disposableProjectReferenceAssetIds].some((assetId) => !promotedReferenceAssetIds.has(assetId))
  ) {
    semanticFailures.add("disposable project copy reference asset ids must be backed by promoted reference manifest asset ids");
  }
  if (
    pointCloudSidecarChunksByRef.size > 0
    && [...pointCloudSidecarChunksByRef.keys()].some((chunkRef) => !promotedPointCloudChunksByRef.has(chunkRef))
  ) {
    semanticFailures.add("point-cloud chunk sidecar evidence files must be referenced by promoted reference manifest chunks");
  }
  if (
    promotedPointCloudChunksByRef.size > 0
    && [...promotedPointCloudChunksByRef.keys()].some((chunkRef) => !pointCloudSidecarChunksByRef.has(chunkRef))
  ) {
    semanticFailures.add("promoted reference manifest point-cloud chunks must have matching sidecar evidence files");
  }
  if (
    pointCloudSidecarChunksByRef.size > 0
    && [...pointCloudSidecarChunksByRef.entries()].some(([chunkRef, sidecarChunks]) => {
      const manifestChunks = promotedPointCloudChunksByRef.get(chunkRef) || [];
      return manifestChunks.some((manifestChunk) => sidecarChunks.some((sidecarChunk) => (
        manifestChunk.pointCount !== sidecarChunk.pointCount
        || !sameBounds(manifestChunk.bounds, sidecarChunk.bounds)
      )));
    })
  ) {
    semanticFailures.add("point-cloud chunk sidecar evidence files must match promoted reference manifest chunk pointCount and bounds");
  }
  for (const family of REQUIRED_EXTERNAL_ADAPTER_FAMILIES) {
    if (
      adapterKeysForFamily(preflightAdapterKeysByFamily, family).length > 0
      && adapterKeysForFamily(sourceAssertionAdapterKeysByFamily, family).length > 0
      && !adapterKeySetsOverlap(preflightAdapterKeysByFamily, sourceAssertionAdapterKeysByFamily, family)
    ) {
      semanticFailures.add("external adapter preflight selectedAdapterKeys must overlap accepted sourceAdapter assertion keys for each required family");
    }
    if (
      fingerprintsForFamily(preflightFingerprintsByFamily, family).length > 0
      && fingerprintsForFamily(sourceAssertionPreflightFingerprintsByFamily, family).length > 0
      && !fingerprintSetsOverlap(preflightFingerprintsByFamily, sourceAssertionPreflightFingerprintsByFamily, family)
    ) {
      semanticFailures.add("external adapter preflight fingerprints must overlap accepted sourceAdapter assertion preflight fingerprints for each required family");
    }
    if (
      statFingerprintsForFamily(preflightConfigStatFingerprintsByFamily, family).length > 0
      && statFingerprintsForFamily(sourceAssertionConfigStatFingerprintsByFamily, family).length > 0
      && !statFingerprintSetsOverlap(preflightConfigStatFingerprintsByFamily, sourceAssertionConfigStatFingerprintsByFamily, family)
    ) {
      semanticFailures.add("external adapter config stat fingerprints must overlap accepted sourceAdapter assertion config stat fingerprints for each required family");
    }
    if (
      fingerprintsForFamily(preflightRegistryFingerprintsByFamily, family).length > 0
      && fingerprintsForFamily(sourceAssertionRegistryFingerprintsByFamily, family).length > 0
      && !fingerprintSetsOverlap(preflightRegistryFingerprintsByFamily, sourceAssertionRegistryFingerprintsByFamily, family)
    ) {
      semanticFailures.add("external adapter registry fingerprints must overlap accepted sourceAdapter assertion registry fingerprints for each required family");
    }
    if (
      fingerprintsForFamily(preflightRegistryAggregateFingerprintsByFamily, family).length > 0
      && fingerprintsForFamily(sourceAssertionRegistryAggregateFingerprintsByFamily, family).length > 0
      && !fingerprintSetsOverlap(preflightRegistryAggregateFingerprintsByFamily, sourceAssertionRegistryAggregateFingerprintsByFamily, family)
    ) {
      semanticFailures.add("external adapter registry aggregate fingerprints must overlap accepted sourceAdapter assertion registry aggregate fingerprints for each required family");
    }
  }
  return {
    evidenceItems,
    externalAdapterSourceAdapterKeys: adapterKeyListMapSummary(sourceAssertionAdapterKeysByFamily),
    externalAdapterSourceAdapterRequestEvidenceFingerprints: fingerprintListMapSummary(sourceAssertionRequestEvidenceFingerprintsByFamily),
    externalAdapterSourceAdapterConfigStatFingerprints: statFingerprintListMapSummary(sourceAssertionConfigStatFingerprintsByFamily),
    externalAdapterSourceAdapterRegistryAggregateFingerprints: fingerprintListMapSummary(sourceAssertionRegistryAggregateFingerprintsByFamily),
    externalAdapterSourceAdapterRegistryFingerprints: fingerprintListMapSummary(sourceAssertionRegistryFingerprintsByFamily),
    externalAdapterSourceAdapterPreflightFingerprints: fingerprintListMapSummary(sourceAssertionPreflightFingerprintsByFamily),
    readFailures: [...readFailures],
    semanticFailures: [...semanticFailures],
    failures: [...readFailures, ...semanticFailures]
  };
}

function autoEvidenceItems(finalCheck, finalCheckFingerprint) {
  return [
    {
      kind: "promoted-import-corpus-report",
      family: "",
      fingerprint: finalCheck.corpusReportFingerprint,
      count: 1,
      label: "promoted-import-corpus-report"
    },
    {
      kind: "fingerprint-pinned-verifier-output",
      family: "",
      fingerprint: finalCheck.acceptanceReportFingerprint,
      count: 1,
      label: "fingerprint-pinned-verifier-output"
    },
    {
      kind: "final-acceptance-check-report",
      family: "",
      fingerprint: finalCheckFingerprint,
      count: 1,
      label: "final-acceptance-check-report"
    }
  ];
}

function completionEvidenceManifest(
  finalCheck,
  finalCheckFingerprint,
  evidenceSourcesFingerprint,
  evidenceItems,
  externalAdapterSourceAdapterKeys,
  externalAdapterSourceAdapterRequestEvidenceFingerprints,
  externalAdapterSourceAdapterConfigStatFingerprints,
  externalAdapterSourceAdapterRegistryAggregateFingerprints,
  externalAdapterSourceAdapterRegistryFingerprints,
  externalAdapterSourceAdapterPreflightFingerprints
) {
  return {
    id: COMPLETION_EVIDENCE_ID,
    version: BUILDER_VERSION,
    finalAcceptanceCheckFingerprint: finalCheckFingerprint,
    acceptanceReportFingerprint: finalCheck.acceptanceReportFingerprint,
    corpusReportFingerprint: finalCheck.corpusReportFingerprint,
    evidenceSourcesFingerprint,
    sourceFamilies: [...REQUIRED_SOURCE_FAMILIES],
    externalAdapterFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    externalAdapterTargetFormatTokens: [...REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS],
    externalAdapterSourceAdapterKeys,
    externalAdapterSourceAdapterRequestEvidenceFingerprints,
    externalAdapterSourceAdapterConfigStatFingerprints,
    externalAdapterSourceAdapterRegistryAggregateFingerprints,
    externalAdapterSourceAdapterRegistryFingerprints,
    externalAdapterSourceAdapterPreflightFingerprints,
    pointCloudFamilies: [...REQUIRED_POINT_CLOUD_FAMILIES],
    sourceEvidenceSemantics: sourceEvidenceSemantics(),
    evidenceItems: [
      ...evidenceItems,
      ...autoEvidenceItems(finalCheck, finalCheckFingerprint)
    ]
  };
}

function defaultGates() {
  return {
    finalAcceptanceCheckReadableOk: false,
    finalAcceptanceCheckShapeOk: false,
    finalAcceptanceCheckAcceptedOk: false,
    evidenceSourcesReadableOk: false,
    evidenceSourcesShapeOk: false,
    evidenceSourcesValueShapeOk: false,
    requiredEvidenceSourcesOk: false,
    artifactCountEvidenceOk: false,
    sourceFilesReadableOk: false,
    sourceEvidenceSemanticsOk: false,
    outputManifestWritableOk: false
  };
}

function failureOutput(options = {}, gates = defaultGates(), summary = evidenceSourceSummary(), failures = []) {
  const normalizedFailures = failures.length > 0
    ? failures
    : Object.entries(gates)
      .filter(([, value]) => value !== true)
      .map(([field]) => `${field} failed`);
  return {
    id: BUILDER_ID,
    version: BUILDER_VERSION,
    ok: false,
    finalAcceptanceCheckPath: pathFreeInputFileName(options.finalAcceptanceCheckPath),
    evidenceSourcesPath: pathFreeInputFileName(options.evidenceSourcesPath),
    outputManifestPath: pathFreeInputFileName(options.outputPath),
    gates,
    summary,
    failures: [...new Set(normalizedFailures)],
    warnings: []
  };
}

function sourceCheckOutput(options = {}, gates = {}, summary = evidenceSourceSummary(), failures = [], evidenceSourcesFingerprint = "") {
  const normalizedFailures = failures.length > 0
    ? failures
    : Object.entries(gates)
      .filter(([, value]) => value !== true)
      .map(([field]) => `${field} failed`);
  return {
    id: SOURCE_CHECK_ID,
    version: BUILDER_VERSION,
    ok: normalizedFailures.length === 0,
    evidenceSourcesPath: pathFreeInputFileName(options.evidenceSourcesPath),
    sourceCheckReportPath: pathFreeInputFileName(options.outputPath),
    evidenceSourcesFingerprint: SHA256_FINGERPRINT.test(evidenceSourcesFingerprint) ? evidenceSourcesFingerprint : "",
    gates,
    summary,
    failures: [...new Set(normalizedFailures)],
    warnings: []
  };
}

function writeManifest(outputPath, manifest) {
  if (!outputPath) return true;
  try {
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

function build(options) {
  const finalCheckFile = readJsonFile(options.finalAcceptanceCheckPath, "final acceptance check");
  const sourceFile = readJsonFile(options.evidenceSourcesPath, "evidence sources manifest");
  const gates = defaultGates();
  gates.finalAcceptanceCheckReadableOk = finalCheckFile.failures.length === 0;
  gates.finalAcceptanceCheckShapeOk = gates.finalAcceptanceCheckReadableOk && finalAcceptanceCheckShapeOk(finalCheckFile.value);
  gates.finalAcceptanceCheckAcceptedOk = gates.finalAcceptanceCheckReadableOk && finalAcceptanceCheckAcceptedOk(finalCheckFile.value);
  gates.evidenceSourcesReadableOk = sourceFile.failures.length === 0;
  gates.evidenceSourcesShapeOk = gates.evidenceSourcesReadableOk && sourceManifestShapeOk(sourceFile.value);
  gates.evidenceSourcesValueShapeOk = gates.evidenceSourcesReadableOk && sourceManifestValueShapeOk(sourceFile.value);

  const summary = evidenceSourceSummary(sourceFile.value);
  gates.requiredEvidenceSourcesOk = gates.evidenceSourcesValueShapeOk && summary.missingSourceItems.length === 0;
  gates.artifactCountEvidenceOk = gates.evidenceSourcesValueShapeOk && summary.insufficientSourceCounts.length === 0;

  const loadFailures = [...finalCheckFile.failures, ...sourceFile.failures];
  if (loadFailures.length > 0) {
    return { ok: false, output: failureOutput(options, gates, summary, loadFailures), exitCode: 1 };
  }

  const readyForFileReads = gates.finalAcceptanceCheckShapeOk
    && gates.finalAcceptanceCheckAcceptedOk
    && gates.evidenceSourcesShapeOk
    && gates.evidenceSourcesValueShapeOk
    && gates.requiredEvidenceSourcesOk
    && gates.artifactCountEvidenceOk;
  const evidenceBuild = readyForFileReads
    ? buildEvidenceItems(sourceFile.value, options.evidenceSourcesPath)
    : {
      evidenceItems: [],
      externalAdapterSourceAdapterKeys: adapterKeyListMapSummary(),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: fingerprintListMapSummary(),
      externalAdapterSourceAdapterConfigStatFingerprints: statFingerprintListMapSummary(),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: fingerprintListMapSummary(),
      externalAdapterSourceAdapterRegistryFingerprints: fingerprintListMapSummary(),
      externalAdapterSourceAdapterPreflightFingerprints: fingerprintListMapSummary(),
      readFailures: [],
      semanticFailures: [],
      failures: []
    };
  gates.sourceFilesReadableOk = readyForFileReads && evidenceBuild.readFailures.length === 0;
  gates.sourceEvidenceSemanticsOk = gates.sourceFilesReadableOk && evidenceBuild.semanticFailures.length === 0;
  gates.outputManifestWritableOk = gates.sourceEvidenceSemanticsOk;

  const gateFailures = Object.entries(gates)
    .filter(([, value]) => value !== true)
    .map(([field]) => `${field} failed`);
  const failures = [...gateFailures, ...evidenceBuild.failures];
  if (failures.length > 0) {
    return { ok: false, output: failureOutput(options, gates, summary, failures), exitCode: 1 };
  }

  const manifest = completionEvidenceManifest(
    finalCheckFile.value,
    finalCheckFile.fingerprint,
    sourceFile.fingerprint,
    evidenceBuild.evidenceItems,
    evidenceBuild.externalAdapterSourceAdapterKeys,
    evidenceBuild.externalAdapterSourceAdapterRequestEvidenceFingerprints,
    evidenceBuild.externalAdapterSourceAdapterConfigStatFingerprints,
    evidenceBuild.externalAdapterSourceAdapterRegistryAggregateFingerprints,
    evidenceBuild.externalAdapterSourceAdapterRegistryFingerprints,
    evidenceBuild.externalAdapterSourceAdapterPreflightFingerprints
  );
  if (!writeManifest(options.outputPath, manifest)) {
    gates.outputManifestWritableOk = false;
    return {
      ok: false,
      output: failureOutput(options, gates, summary, ["outputManifestWritableOk failed"]),
      exitCode: 1
    };
  }
  return { ok: true, output: manifest, exitCode: 0 };
}

function checkSourcesOnly(options) {
  const sourceFile = readJsonFile(options.evidenceSourcesPath, "evidence sources manifest");
  const gates = {
    evidenceSourcesReadableOk: sourceFile.failures.length === 0,
    evidenceSourcesShapeOk: false,
    evidenceSourcesValueShapeOk: false,
    requiredEvidenceSourcesOk: false,
    artifactCountEvidenceOk: false,
    sourceCheckOutputWritableOk: false
  };
  gates.evidenceSourcesShapeOk = gates.evidenceSourcesReadableOk && sourceManifestShapeOk(sourceFile.value);
  gates.evidenceSourcesValueShapeOk = gates.evidenceSourcesReadableOk && sourceManifestValueShapeOk(sourceFile.value);
  const summary = evidenceSourceSummary(sourceFile.value);
  gates.requiredEvidenceSourcesOk = gates.evidenceSourcesValueShapeOk && summary.missingSourceItems.length === 0;
  gates.artifactCountEvidenceOk = gates.evidenceSourcesValueShapeOk && summary.insufficientSourceCounts.length === 0;
  gates.sourceCheckOutputWritableOk = true;
  const gateFailures = Object.entries(gates)
    .filter(([, value]) => value !== true)
    .map(([field]) => `${field} failed`);
  const failures = [...sourceFile.failures, ...gateFailures];
  let output = sourceCheckOutput(options, gates, summary, failures, sourceFile.fingerprint);
  if (!writeManifest(options.outputPath, output)) {
    gates.sourceCheckOutputWritableOk = false;
    output = sourceCheckOutput(options, gates, summary, [...failures, "sourceCheckOutputWritableOk failed"], sourceFile.fingerprint);
  }
  return { ok: output.ok, output, exitCode: output.ok ? 0 : 1 };
}

let activeOptions = {};

function main() {
  const options = parseArgs(process.argv.slice(2));
  activeOptions = options;
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (options.listContract) {
    process.stdout.write(`${JSON.stringify(contract(), null, 2)}\n`);
    return 0;
  }
  if (options.printExampleSources) {
    process.stdout.write(`${JSON.stringify(exampleSourceManifest(), null, 2)}\n`);
    return 0;
  }
  if (options.checkSourcesOnly) {
    const result = checkSourcesOnly(options);
    process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
    return result.exitCode;
  }
  const result = build(options);
  process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
  return result.exitCode;
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error?.message === "Unknown option." ? "Unknown option." : "reference import completion evidence build failed";
  process.stdout.write(`${JSON.stringify(failureOutput(activeOptions, defaultGates(), evidenceSourceSummary(), [message]), null, 2)}\n`);
  process.exitCode = 1;
}
