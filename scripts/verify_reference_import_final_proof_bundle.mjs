#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_ID = "referenceImportFinalProofBundleCheck";
const CHECK_VERSION = "0.1.0";
const FINAL_ACCEPTANCE_CHECK_ID = "referenceImportFinalAcceptanceCheck";
const SOURCE_CHECK_ID = "referenceImportCompletionEvidenceSourceCheck";
const COMPLETION_EVIDENCE_CHECK_ID = "referenceImportCompletionEvidenceCheck";
const FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID = "full-private-reference-import-acceptance";
const UPSTREAM_CORPUS_RUN_PROFILE_ID = "full-private-reference-import-corpus-run";
const COMPLETION_EVIDENCE_PROFILE_ID = "reference-import-goal-completion-evidence";
const SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID = "reference-import-completion-source-evidence-semantics-v1";
const SOURCE_EVIDENCE_SEMANTICS_MODE = "build-time-semantic-evidence-files";
const REQUIRED_TARGET_FORMAT_TOKENS = ["dxf", "dwg", "step", "ifc", "e57pointcloud"];
const REQUIRED_SOURCE_FAMILIES = ["dxf", "dwg", "step", "ifc", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_FAMILIES = ["dwg", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = ["dwg", "e57pointcloud"];
const REQUIRED_POINT_CLOUD_FAMILIES = ["e57"];
const REQUIRED_POINT_CLOUD_TARGET_FORMAT_TOKENS = ["e57pointcloud"];
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
const REQUIRED_COMPLETION_ARTIFACT_KINDS = [
  "private-source-family",
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "point-cloud-family",
  "promoted-import-corpus-report",
  "fingerprint-pinned-verifier-output",
  "final-acceptance-check-report",
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
];
const REQUIRED_COMPLETION_ARTIFACT_COUNT_MINIMUMS = [
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
const MIN_SOURCE_ITEM_COUNT = 13;
const MIN_EVIDENCE_ITEM_COUNT = 16;
const MIN_COMPLETION_EVIDENCE_ITEM_COUNT = 16;
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const STAT_SHA256_FINGERPRINT = /^stat-sha256:[0-9a-f]{64}$/;
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_REQUIREMENT_TOKEN = /^[a-z0-9-]+:(?:[a-z0-9-]+|all):[1-9][0-9]*$/;
const FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT = "sha256:0dfa480ed4f08afce2aeb1f2d71910f7d2498565533262d09dabeef59ad568d3";
const RESERVED_ADAPTER_KEYS = new Set(["__proto__", "prototype", "constructor"]);
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
const SOURCE_CHECK_SUMMARY_FIELDS = [
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
const COMPLETION_EVIDENCE_CHECK_FIELDS = [
  "id",
  "version",
  "ok",
  "finalAcceptanceCheckPath",
  "evidenceManifestPath",
  "completionEvidenceCheckPath",
  "evidenceSourcesFingerprint",
  "finalAcceptanceCheckFingerprint",
  "acceptanceReportFingerprint",
  "corpusReportFingerprint",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const COMPLETION_EVIDENCE_GATE_FIELDS = [
  "finalAcceptanceCheckShapeOk",
  "finalAcceptanceCheckAcceptedOk",
  "finalAcceptanceCheckAcceptedVerifierValuePolicyOk",
  "finalAcceptanceCheckFingerprintMatchesManifest",
  "expectedFinalAcceptanceCheckFingerprintMatches",
  "completionEvidenceShapeOk",
  "completionEvidenceValueShapeOk",
  "requiredSourceFamilyEvidenceOk",
  "requiredExternalAdapterEvidenceOk",
  "requiredExternalAdapterSourceAdapterAssertionEvidenceOk",
  "requiredPointCloudEvidenceOk",
  "sourceAdapterEvidenceMatchesFinalAcceptanceCheck",
  "reportFingerprintEvidenceOk",
  "requiredArtifactKindsOk",
  "artifactCountEvidenceOk",
  "completionEvidenceOutputWritableOk"
];
const COMPLETION_EVIDENCE_SUMMARY_FIELDS = [
  "sourceFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterPreflightEvidenceFamilies",
  "missingExternalAdapterPreflightEvidenceFamilies",
  "externalAdapterSourceAdapterAssertionFamilies",
  "missingExternalAdapterSourceAdapterAssertionFamilies",
  "externalAdapterSourceAdapterKeys",
  "externalAdapterSourceAdapterRequestEvidenceFingerprints",
  "externalAdapterSourceAdapterConfigStatFingerprints",
  "externalAdapterSourceAdapterRegistryAggregateFingerprints",
  "externalAdapterSourceAdapterRegistryFingerprints",
  "externalAdapterSourceAdapterPreflightFingerprints",
  "pointCloudFamilies",
  "sourceEvidenceSemanticsProfileId",
  "sourceEvidenceSemanticsProfileFingerprint",
  "sourceEvidenceSemanticArtifactKinds",
  "proofPlanFingerprint",
  "evidenceItemCount",
  "requiredArtifactKinds",
  "requiredValuePolicy",
  "missingArtifactKinds",
  "artifactCountMinimums",
  "insufficientArtifactCounts"
];
const OUTPUT_FIELDS = [
  "id",
  "version",
  "ok",
  "finalAcceptanceCheckPath",
  "sourceCheckPath",
  "completionEvidenceCheckPath",
  "proofBundleReportPath",
  "finalAcceptanceCheckFingerprint",
  "sourceCheckFingerprint",
  "completionEvidenceCheckFingerprint",
  "evidenceSourcesFingerprint",
  "acceptanceReportFingerprint",
  "corpusReportFingerprint",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const GATE_FIELDS = [
  "finalAcceptanceCheckReadableOk",
  "sourceCheckReadableOk",
  "completionEvidenceCheckReadableOk",
  "finalAcceptanceCheckShapeOk",
  "sourceCheckShapeOk",
  "completionEvidenceCheckShapeOk",
  "finalAcceptanceCheckAcceptedOk",
  "finalAcceptanceCheckAcceptedVerifierValuePolicyOk",
  "sourceCheckAcceptedOk",
  "completionEvidenceCheckAcceptedOk",
  "finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck",
  "evidenceSourcesFingerprintAlignedOk",
  "expectedFinalAcceptanceCheckFingerprintMatches",
  "expectedSourceCheckFingerprintMatches",
  "expectedCompletionEvidenceCheckFingerprintMatches",
  "reportFingerprintsAlignedOk",
  "sourceAdapterEvidenceAlignedAcrossInputReportsOk",
  "requiredFamilySummariesOk",
  "sourceEvidenceSemanticsProfileOk",
  "completionEvidenceRequiredValuePolicyOk",
  "completionEvidenceArtifactPolicyOk",
  "requiredEvidenceCountsOk",
  "pathFreeBundleValuesOk",
  "bundleOutputWritableOk"
];
const SUMMARY_FIELDS = [
  "sourceFamilies",
  "externalAdapterFamilies",
  "externalAdapterTargetFormatTokens",
  "externalAdapterPreflightEvidenceFamilies",
  "missingExternalAdapterPreflightEvidenceFamilies",
  "externalAdapterSourceAdapterAssertionFamilies",
  "missingExternalAdapterSourceAdapterAssertionFamilies",
  "externalAdapterSourceAdapterKeys",
  "externalAdapterSourceAdapterRequestEvidenceFingerprints",
  "externalAdapterSourceAdapterConfigStatFingerprints",
  "externalAdapterSourceAdapterRegistryAggregateFingerprints",
  "externalAdapterSourceAdapterRegistryFingerprints",
  "externalAdapterSourceAdapterPreflightFingerprints",
  "pointCloudFamilies",
  "sourceEvidenceSemanticsProfileId",
  "sourceEvidenceSemanticsProfileFingerprint",
  "sourceEvidenceSemanticArtifactKinds",
  "proofPlanFingerprint",
  "sourceItemCount",
  "evidenceItemCount",
  "completionEvidenceItemCount",
  "requiredEvidenceMinimums",
  "requiredCompletionArtifactKinds",
  "requiredCompletionArtifactCountMinimums",
  "requiredTargetFormatTokens",
  "requiredExternalAdapterTargetFormatTokens",
  "requiredPointCloudTargetFormatTokens",
  "requiredFamilySummaries",
  "requiredSourceEvidenceSemanticsProfile",
  "requiredInputReports",
  "requiredFingerprintPins",
  "requiredSavedInputReportGates",
  "requiredCrossReportGates",
  "requiredValuePolicy",
  "evidenceCountDeficits",
  "failedGateFields",
  "missingSourceItems",
  "insufficientSourceCounts",
  "missingCompletionArtifactKinds",
  "insufficientCompletionArtifactCounts"
];
const EVIDENCE_COUNT_DEFICIT_FIELDS = [
  "sourceItemCountDeficit",
  "evidenceItemCountDeficit",
  "completionEvidenceItemCountDeficit"
];
const FINAL_PROOF_BUNDLE_MISSING_EVIDENCE_LIST_FIELDS = [
  "missingSourceItems",
  "insufficientSourceCounts",
  "missingCompletionArtifactKinds",
  "insufficientCompletionArtifactCounts"
];
const SOURCE_ADAPTER_KEY_POLICY_PATHS = [
  ["summary", "acceptedVerifierValuePolicy", "sourceAdapterKeyPolicy"]
];
const REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS = [
  "finalAcceptanceCheck",
  "sourceCheck",
  "completionEvidenceCheck"
];
const REQUIRED_CROSS_REPORT_GATE_FIELDS = [
  "finalAcceptanceToCompletionEvidenceCheck",
  "sourceCheckToCompletionEvidenceCheck",
  "finalAcceptanceToCompletionEvidenceReports"
];

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_final_proof_bundle.mjs --final-acceptance-check <check.json> --source-check <source-check.json> --completion-evidence-check <completion-check.json> [options]",
    "",
    "Verifies the saved final private proof bundle without reading private source files, source manifests, completion evidence manifests, corpus reports, projects, chunks, adapter configs, workflow runners, or external adapters.",
    "",
    "Options:",
    "  --final-acceptance-check <path>  Saved referenceImportFinalAcceptanceCheck output.",
    "  --source-check <path>            Saved referenceImportCompletionEvidenceSourceCheck output.",
    "  --completion-evidence-check <path>  Saved referenceImportCompletionEvidenceCheck output.",
    "  --expect-final-acceptance-check-fingerprint <sha256:hex>  Require final check bytes to match this fingerprint.",
    "  --expect-source-check-fingerprint <sha256:hex>  Require source-check bytes to match this fingerprint.",
    "  --expect-completion-evidence-check-fingerprint <sha256:hex>  Require completion-check bytes to match this fingerprint.",
    "  --output <path>                  Optional machine-readable JSON proof bundle check path.",
    "  --list-contract                  Print the final proof bundle checker contract and exit.",
    "  --help                           Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    finalAcceptanceCheckPath: "",
    sourceCheckPath: "",
    completionEvidenceCheckPath: "",
    outputPath: "",
    expectedFinalAcceptanceCheckFingerprint: "",
    expectedSourceCheckFingerprint: "",
    expectedCompletionEvidenceCheckFingerprint: "",
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
    if (arg === "--final-acceptance-check") {
      options.finalAcceptanceCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--source-check") {
      options.sourceCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--completion-evidence-check") {
      options.completionEvidenceCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-final-acceptance-check-fingerprint") {
      options.expectedFinalAcceptanceCheckFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-source-check-fingerprint") {
      options.expectedSourceCheckFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-completion-evidence-check-fingerprint") {
      options.expectedCompletionEvidenceCheckFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
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

function fingerprintValue(value, flag) {
  const text = String(value || "");
  if (!SHA256_FINGERPRINT.test(text)) {
    throw new Error(`${flag} must be sha256:<64 lowercase hex>`);
  }
  return text;
}

function contract() {
  return {
    id: "referenceImportFinalProofBundleCheckContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    inputBoundary: {
      readsSavedFinalAcceptanceCheckOnly: true,
      readsSavedCompletionEvidenceSourceCheckOnly: true,
      readsSavedCompletionEvidenceCheckOnly: true,
      readsPrivateSourceFiles: false,
      readsCompletionEvidenceSourceManifest: false,
      readsCompletionEvidenceManifest: false,
      readsSavedCorpusReport: false,
      readsProjectFiles: false,
      readsReferenceManifests: false,
      readsPointCloudChunkSidecars: false,
      readsAdapterConfigs: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    requiredInputReports: requiredInputReports(),
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      requiredFingerprintPins: requiredFingerprintPins(),
      requiredSavedInputReportGateFields: REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS,
      requiredSavedInputReportGates: requiredSavedInputReportGates(),
      requiredCrossReportGateFields: REQUIRED_CROSS_REPORT_GATE_FIELDS,
      requiredCrossReportGates: requiredCrossReportGates(),
      requiredCompletionEvidenceValuePolicy: completionEvidenceValuePolicy(),
      sourceEvidenceSemanticsProfileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
      sourceEvidenceSemanticsProfileFingerprint: sourceEvidenceSemanticsProfileFingerprint(),
      sourceEvidenceSemanticArtifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
      requiredTargetFormatTokens: requiredTargetFormatTokens(),
      requiredExternalAdapterTargetFormatTokens: requiredExternalAdapterTargetFormatTokens(),
      requiredPointCloudTargetFormatTokens: requiredPointCloudTargetFormatTokens(),
      requiredCompletionArtifactKinds: requiredCompletionArtifactKinds(),
      requiredCompletionArtifactCountMinimums: requiredCompletionArtifactCountMinimums(),
      requiredSourceEvidenceSemanticsProfile: requiredSourceEvidenceSemanticsProfile(),
      requiredFamilySummaries: requiredFamilySummaries(),
      requiredInputReports: requiredInputReports(),
      summaryFields: SUMMARY_FIELDS,
      finalAcceptanceCheckFields: FINAL_ACCEPTANCE_CHECK_FIELDS,
      finalAcceptanceGateFields: FINAL_ACCEPTANCE_GATE_FIELDS,
      finalAcceptanceSummaryFields: FINAL_ACCEPTANCE_SUMMARY_FIELDS,
      sourceCheckFields: SOURCE_CHECK_FIELDS,
      sourceCheckGateFields: SOURCE_CHECK_GATE_FIELDS,
      sourceCheckSummaryFields: SOURCE_CHECK_SUMMARY_FIELDS,
      completionEvidenceCheckFields: COMPLETION_EVIDENCE_CHECK_FIELDS,
      completionEvidenceGateFields: COMPLETION_EVIDENCE_GATE_FIELDS,
      completionEvidenceSummaryFields: COMPLETION_EVIDENCE_SUMMARY_FIELDS,
      valuePolicy: valuePolicy(),
      sourceAdapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
      },
      requiredEvidenceMinimums: requiredEvidenceMinimums(),
      evidenceCountDeficitFields: EVIDENCE_COUNT_DEFICIT_FIELDS,
      finalProofBundleMissingEvidenceListFields: FINAL_PROOF_BUNDLE_MISSING_EVIDENCE_LIST_FIELDS,
      proofBundleOutputPathField: "proofBundleReportPath",
      pathPrivacyFields: ["finalAcceptanceCheckPath", "sourceCheckPath", "completionEvidenceCheckPath", "proofBundleReportPath"]
    },
    cliFlags: ["--final-acceptance-check", "--source-check", "--completion-evidence-check", "--expect-final-acceptance-check-fingerprint", "--expect-source-check-fingerprint", "--expect-completion-evidence-check-fingerprint", "--output", "--list-contract", "--help"]
  };
}

function pathFreeInputFileName(value = "") {
  const base = path.basename(String(value || "").replace(/\\/g, "/"));
  return SAFE_LABEL.test(base) ? base : "";
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

function finalAcceptanceAcceptedVerifierValuePolicy() {
  return {
    requiresPathFreeReportPath: true,
    requiresEmptyFailuresAndWarnings: true,
    requiresExactSourceFamilySummarySets: true,
    requiresExactExternalAdapterFamilySummarySets: true,
    requiresExactExternalAdapterTargetFormatTokens: true,
    requiresExactOneSourceAdapterEvidenceValuePerExternalAdapterFamily: true,
    sourceAdapterKeyPolicy: sourceAdapterKeyPolicy(),
    requiresAtLeastOneCasePerRequiredSourceFamily: true
  };
}

function finalAcceptanceAcceptedVerifierValuePolicyOk(value = {}) {
  return JSON.stringify(value) === JSON.stringify(finalAcceptanceAcceptedVerifierValuePolicy());
}

function sourceAdapterKeyPolicyValueOk(value = {}) {
  return JSON.stringify(value) === JSON.stringify(sourceAdapterKeyPolicy());
}

function sourceAdapterKeyPolicyPathOk(pathSegments = []) {
  return SOURCE_ADAPTER_KEY_POLICY_PATHS.some((expectedPath) => (
    expectedPath.length === pathSegments.length
    && expectedPath.every((segment, index) => segment === pathSegments[index])
  ));
}

function sourceEvidenceSemanticsProfilePayload() {
  return {
    profileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
    builderId: "referenceImportCompletionEvidenceBuilder",
    builderVersion: CHECK_VERSION,
    gate: "sourceEvidenceSemanticsOk",
    mode: SOURCE_EVIDENCE_SEMANTICS_MODE,
    artifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
    sourceAdapterKeyPolicy: sourceAdapterKeyPolicy()
  };
}

function sourceEvidenceSemanticsProfileFingerprint() {
  return fileFingerprint(JSON.stringify(sourceEvidenceSemanticsProfilePayload()));
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

function sameStrings(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
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

function adapterKeyMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => safeAdapterKey(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function sourceAdapterKeysOk(value = {}) {
  return adapterKeyMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function safeAdapterKeyListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeAdapterKeys(value?.[family])
  ]));
}

function safeFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && SHA256_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function fingerprintListMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => typeof entry === "string" && SHA256_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function sourceAdapterRequestEvidenceFingerprintsOk(value = {}) {
  return fingerprintListMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function sourceAdapterRegistryAggregateFingerprintsOk(value = {}) {
  return fingerprintListMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function sourceAdapterRegistryFingerprintsOk(value = {}) {
  return fingerprintListMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function sourceAdapterPreflightFingerprintsOk(value = {}) {
  return fingerprintListMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function safeFingerprintListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeFingerprints(value?.[family])
  ]));
}

function safeStatFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && STAT_SHA256_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function statFingerprintListMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].every((entry) => typeof entry === "string" && STAT_SHA256_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function sourceAdapterConfigStatFingerprintsOk(value = {}) {
  return statFingerprintListMapOk(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => value[family].length === 1);
}

function safeStatFingerprintListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeStatFingerprints(value?.[family])
  ]));
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sourceAdapterEvidenceAlignedAcrossInputReports(finalSummary = {}, completionSummary = {}) {
  return sourceAdapterKeysOk(finalSummary.externalAdapterSourceAdapterKeys)
    && sourceAdapterKeysOk(completionSummary.externalAdapterSourceAdapterKeys)
    && sameJsonValue(safeAdapterKeyListMap(finalSummary.externalAdapterSourceAdapterKeys), safeAdapterKeyListMap(completionSummary.externalAdapterSourceAdapterKeys))
    && sourceAdapterRequestEvidenceFingerprintsOk(finalSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && sourceAdapterRequestEvidenceFingerprintsOk(completionSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints), safeFingerprintListMap(completionSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints))
    && sourceAdapterConfigStatFingerprintsOk(finalSummary.externalAdapterSourceAdapterConfigStatFingerprints)
    && sourceAdapterConfigStatFingerprintsOk(completionSummary.externalAdapterSourceAdapterConfigStatFingerprints)
    && sameJsonValue(safeStatFingerprintListMap(finalSummary.externalAdapterSourceAdapterConfigStatFingerprints), safeStatFingerprintListMap(completionSummary.externalAdapterSourceAdapterConfigStatFingerprints))
    && sourceAdapterRegistryAggregateFingerprintsOk(finalSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && sourceAdapterRegistryAggregateFingerprintsOk(completionSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints), safeFingerprintListMap(completionSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints))
    && sourceAdapterRegistryFingerprintsOk(finalSummary.externalAdapterSourceAdapterRegistryFingerprints)
    && sourceAdapterRegistryFingerprintsOk(completionSummary.externalAdapterSourceAdapterRegistryFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRegistryFingerprints), safeFingerprintListMap(completionSummary.externalAdapterSourceAdapterRegistryFingerprints))
    && sourceAdapterPreflightFingerprintsOk(finalSummary.externalAdapterSourceAdapterPreflightFingerprints)
    && sourceAdapterPreflightFingerprintsOk(completionSummary.externalAdapterSourceAdapterPreflightFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterPreflightFingerprints), safeFingerprintListMap(completionSummary.externalAdapterSourceAdapterPreflightFingerprints));
}

function requiredEvidenceMinimums() {
  return {
    minSourceItemCount: MIN_SOURCE_ITEM_COUNT,
    minEvidenceItemCount: MIN_EVIDENCE_ITEM_COUNT,
    minCompletionEvidenceItemCount: MIN_COMPLETION_EVIDENCE_ITEM_COUNT
  };
}

function requiredCompletionArtifactKinds() {
  return [...REQUIRED_COMPLETION_ARTIFACT_KINDS];
}

function requiredCompletionArtifactCountMinimums() {
  return REQUIRED_COMPLETION_ARTIFACT_COUNT_MINIMUMS.map((entry) => ({ ...entry }));
}

function valuePolicy() {
  return {
    pathFreeGateField: "pathFreeBundleValuesOk",
    protectedInputReports: ["referenceImportFinalAcceptanceCheck", "referenceImportCompletionEvidenceSourceCheck", "referenceImportCompletionEvidenceCheck"],
    acceptsRawPrivatePaths: false,
    acceptsRawPrivatePayloads: false,
    allowedValueKinds: ["safe-label", "safe-requirement-token", "known-family-token", "known-target-token", "sha256-fingerprint", "stat-sha256-fingerprint", "safe-integer", "boolean", "null", "empty-string"],
    allowedSourceAdapterKeyPolicyPaths: SOURCE_ADAPTER_KEY_POLICY_PATHS.map((segments) => segments.join("."))
  };
}

function completionEvidenceValuePolicy() {
  return {
    pathFreeGateField: "completionEvidenceValueShapeOk",
    protectedArtifact: "referenceImportCompletionEvidence manifest",
    acceptsRawPrivatePaths: false,
    acceptsRawPrivatePayloads: false,
    allowedValueKinds: ["safe-label", "known-family-token", "known-artifact-kind-token", "positive-count", "sha256-fingerprint", "stat-sha256-fingerprint", "empty-string"],
    allowedSourceAdapterKeyPolicyPaths: ["sourceEvidenceSemantics.sourceAdapterKeyPolicy"]
  };
}

function requiredTargetFormatTokens() {
  return [...REQUIRED_TARGET_FORMAT_TOKENS];
}

function requiredExternalAdapterTargetFormatTokens() {
  return [...REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS];
}

function requiredPointCloudTargetFormatTokens() {
  return [...REQUIRED_POINT_CLOUD_TARGET_FORMAT_TOKENS];
}

function requiredFamilySummaries() {
  return {
    sourceFamilies: [...REQUIRED_SOURCE_FAMILIES],
    externalAdapterFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    externalAdapterPreflightEvidenceFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    missingExternalAdapterPreflightEvidenceFamilies: [],
    externalAdapterSourceAdapterAssertionFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    missingExternalAdapterSourceAdapterAssertionFamilies: [],
    pointCloudFamilies: [...REQUIRED_POINT_CLOUD_FAMILIES]
  };
}

function requiredSourceEvidenceSemanticsProfile() {
  return {
    sourceEvidenceSemanticsProfileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
    sourceEvidenceSemanticsProfileFingerprint: sourceEvidenceSemanticsProfileFingerprint(),
    sourceEvidenceSemanticArtifactKinds: [...SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS],
    sourceAdapterKeyPolicy: sourceAdapterKeyPolicy()
  };
}

function requiredInputReports() {
  return {
    finalAcceptanceCheckId: FINAL_ACCEPTANCE_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    completionEvidenceCheckId: COMPLETION_EVIDENCE_CHECK_ID
  };
}

function requiredFingerprintPins() {
  return [
    "--expect-final-acceptance-check-fingerprint",
    "--expect-source-check-fingerprint",
    "--expect-completion-evidence-check-fingerprint"
  ];
}

function requiredSavedInputReportGates() {
  return {
    finalAcceptanceCheck: [
      "requiredExternalAdapterTargetFormatTokensOk",
      "finalAcceptanceOutputWritableOk"
    ],
    sourceCheck: ["sourceCheckOutputWritableOk"],
    completionEvidenceCheck: [
      "expectedFinalAcceptanceCheckFingerprintMatches",
      "completionEvidenceOutputWritableOk"
    ]
  };
}

function requiredCrossReportGates() {
  return {
    finalAcceptanceToCompletionEvidenceCheck: ["finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck"],
    sourceCheckToCompletionEvidenceCheck: ["evidenceSourcesFingerprintAlignedOk"],
    finalAcceptanceToCompletionEvidenceReports: [
      "reportFingerprintsAlignedOk",
      "sourceAdapterEvidenceAlignedAcrossInputReportsOk"
    ]
  };
}

function completionArtifactCountMinimumsOk(value = []) {
  return JSON.stringify(value) === JSON.stringify(requiredCompletionArtifactCountMinimums());
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function evidenceCountDeficits(sourceItemCount, evidenceItemCount, completionEvidenceItemCount) {
  return {
    sourceItemCountDeficit: Math.max(0, MIN_SOURCE_ITEM_COUNT - safeCount(sourceItemCount)),
    evidenceItemCountDeficit: Math.max(0, MIN_EVIDENCE_ITEM_COUNT - safeCount(evidenceItemCount)),
    completionEvidenceItemCountDeficit: Math.max(0, MIN_COMPLETION_EVIDENCE_ITEM_COUNT - safeCount(completionEvidenceItemCount))
  };
}

function gateFailureFields(gates = {}) {
  return GATE_FIELDS.filter((field) => gates[field] !== true);
}

function safeLabel(value = "") {
  const text = String(value || "");
  return SAFE_LABEL.test(text) && !RESERVED_ADAPTER_KEYS.has(text) && !/[\\/:]/.test(text) && !text.includes("..");
}

function safeRequirementToken(value = "") {
  return SAFE_REQUIREMENT_TOKEN.test(String(value || ""));
}

function safeFamilyList(value = [], allowedFamilies = []) {
  return Array.isArray(value)
    ? value.filter((family, index, families) => allowedFamilies.includes(family) && families.indexOf(family) === index)
    : [];
}

function safeTokenList(value = [], allowedTokens = []) {
  return Array.isArray(value)
    ? value.filter((token, index, tokens) => allowedTokens.includes(token) && tokens.indexOf(token) === index)
    : [];
}

function sharedExternalAdapterTargetFormatTokens(sourceSummary = {}, completionSummary = {}) {
  const sourceTokens = safeTokenList(sourceSummary.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS);
  const completionTokens = safeTokenList(completionSummary.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS);
  return REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS.filter((token) => sourceTokens.includes(token) && completionTokens.includes(token));
}

function sharedExternalAdapterSourceAdapterAssertionFamilies(sourceSummary = {}, completionSummary = {}) {
  const sourceFamilies = safeFamilyList(sourceSummary.externalAdapterSourceAdapterAssertionFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  const completionFamilies = safeFamilyList(completionSummary.externalAdapterSourceAdapterAssertionFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.filter((family) => sourceFamilies.includes(family) && completionFamilies.includes(family));
}

function sharedExternalAdapterPreflightEvidenceFamilies(sourceSummary = {}, completionSummary = {}) {
  const sourceFamilies = safeFamilyList(sourceSummary.externalAdapterPreflightEvidenceFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  const completionFamilies = safeFamilyList(completionSummary.externalAdapterPreflightEvidenceFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.filter((family) => sourceFamilies.includes(family) && completionFamilies.includes(family));
}

function missingExternalAdapterPreflightEvidenceFamilies(sourceSummary = {}, completionSummary = {}) {
  const sharedFamilies = sharedExternalAdapterPreflightEvidenceFamilies(sourceSummary, completionSummary);
  return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.filter((family) => !sharedFamilies.includes(family));
}

function missingExternalAdapterSourceAdapterAssertionFamilies(sourceSummary = {}, completionSummary = {}) {
  const sharedFamilies = sharedExternalAdapterSourceAdapterAssertionFamilies(sourceSummary, completionSummary);
  return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.filter((family) => !sharedFamilies.includes(family));
}

function pathFreeValuesOk(value, pathSegments = []) {
  if (typeof value === "string") {
    return safeLabel(value)
      || safeRequirementToken(value)
      || SHA256_FINGERPRINT.test(value)
      || STAT_SHA256_FINGERPRINT.test(value)
      || REQUIRED_SOURCE_FAMILIES.includes(value)
      || REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(value)
      || value === "";
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return true;
  if (Array.isArray(value)) return value.every((entry) => pathFreeValuesOk(entry, pathSegments));
  if (value && typeof value === "object") {
    return (sourceAdapterKeyPolicyPathOk(pathSegments) && sourceAdapterKeyPolicyValueOk(value))
      || Object.entries(value).every(([key, entry]) => pathFreeValuesOk(entry, [...pathSegments, key]));
  }
  return false;
}

function finalAcceptanceAcceptedOk(report = {}) {
  const gates = report?.gates || {};
  return report?.id === FINAL_ACCEPTANCE_CHECK_ID
    && report?.version === CHECK_VERSION
    && report?.ok === true
    && report?.finalPrivateAcceptanceProfileId === FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID
    && report?.upstreamCorpusRunProfileId === UPSTREAM_CORPUS_RUN_PROFILE_ID
    && report?.completionEvidenceId === COMPLETION_EVIDENCE_PROFILE_ID
    && SHA256_FINGERPRINT.test(report?.acceptanceReportFingerprint || "")
    && SHA256_FINGERPRINT.test(report?.corpusReportFingerprint || "")
    && report?.summary?.accepted === true
    && sameStrings(report?.summary?.acceptedFormatFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(report?.summary?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(report?.summary?.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && sourceAdapterKeysOk(report?.summary?.externalAdapterSourceAdapterKeys)
    && sourceAdapterRequestEvidenceFingerprintsOk(report?.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && sourceAdapterConfigStatFingerprintsOk(report?.summary?.externalAdapterSourceAdapterConfigStatFingerprints)
    && sourceAdapterRegistryAggregateFingerprintsOk(report?.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && sourceAdapterRegistryFingerprintsOk(report?.summary?.externalAdapterSourceAdapterRegistryFingerprints)
    && sourceAdapterPreflightFingerprintsOk(report?.summary?.externalAdapterSourceAdapterPreflightFingerprints)
    && sameStrings(report?.summary?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && report?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT
    && finalAcceptanceAcceptedVerifierValuePolicyOk(report?.summary?.acceptedVerifierValuePolicy)
    && report?.summary?.missingEvidenceRecommendedAction === "run-private-end-to-end-proof-plan"
    && Object.values(gates).every((value) => value === true || (Array.isArray(value) && value.length === 0) || SHA256_FINGERPRINT.test(String(value || "")))
    && Array.isArray(report?.failures)
    && report.failures.length === 0
    && Array.isArray(report?.warnings)
    && report.warnings.length === 0;
}

function sourceCheckAcceptedOk(report = {}) {
  const gates = report?.gates || {};
  return report?.id === SOURCE_CHECK_ID
    && report?.version === CHECK_VERSION
    && report?.ok === true
    && SOURCE_CHECK_GATE_FIELDS.every((field) => gates[field] === true)
    && Array.isArray(report?.failures)
    && report.failures.length === 0
    && Array.isArray(report?.warnings)
    && report.warnings.length === 0;
}

function completionEvidenceCheckAcceptedOk(report = {}) {
  const gates = report?.gates || {};
  return report?.id === COMPLETION_EVIDENCE_CHECK_ID
    && report?.version === CHECK_VERSION
    && report?.ok === true
    && COMPLETION_EVIDENCE_GATE_FIELDS.every((field) => gates[field] === true)
    && Array.isArray(report?.failures)
    && report.failures.length === 0
    && Array.isArray(report?.warnings)
    && report.warnings.length === 0;
}

function verifyBundle(finalFile, sourceFile, completionFile, options) {
  const failures = [];
  const finalReport = finalFile.value || {};
  const sourceReport = sourceFile.value || {};
  const completionReport = completionFile.value || {};
  const finalAcceptanceCheckShapeOk = exactObjectFieldsOk(finalReport, FINAL_ACCEPTANCE_CHECK_FIELDS)
    && exactObjectFieldsOk(finalReport?.gates, FINAL_ACCEPTANCE_GATE_FIELDS)
    && exactObjectFieldsOk(finalReport?.summary, FINAL_ACCEPTANCE_SUMMARY_FIELDS);
  const sourceCheckShapeOk = exactObjectFieldsOk(sourceReport, SOURCE_CHECK_FIELDS)
    && exactObjectFieldsOk(sourceReport?.gates, SOURCE_CHECK_GATE_FIELDS)
    && exactObjectFieldsOk(sourceReport?.summary, SOURCE_CHECK_SUMMARY_FIELDS);
  const completionEvidenceCheckShapeOk = exactObjectFieldsOk(completionReport, COMPLETION_EVIDENCE_CHECK_FIELDS)
    && exactObjectFieldsOk(completionReport?.gates, COMPLETION_EVIDENCE_GATE_FIELDS)
    && exactObjectFieldsOk(completionReport?.summary, COMPLETION_EVIDENCE_SUMMARY_FIELDS);
  const finalAcceptanceCheckAcceptedVerifierValuePolicyOk = finalAcceptanceAcceptedVerifierValuePolicyOk(finalReport?.summary?.acceptedVerifierValuePolicy);
  const expectedFinalAcceptanceCheckFingerprintMatches = options.expectedFinalAcceptanceCheckFingerprint
    ? finalFile.fingerprint === options.expectedFinalAcceptanceCheckFingerprint
    : false;
  const expectedSourceCheckFingerprintMatches = options.expectedSourceCheckFingerprint
    ? sourceFile.fingerprint === options.expectedSourceCheckFingerprint
    : false;
  const expectedCompletionEvidenceCheckFingerprintMatches = options.expectedCompletionEvidenceCheckFingerprint
    ? completionFile.fingerprint === options.expectedCompletionEvidenceCheckFingerprint
    : false;
  const finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck = SHA256_FINGERPRINT.test(finalFile.fingerprint)
    && completionReport?.finalAcceptanceCheckFingerprint === finalFile.fingerprint;
  const evidenceSourcesFingerprintAlignedOk = SHA256_FINGERPRINT.test(sourceReport?.evidenceSourcesFingerprint || "")
    && sourceReport.evidenceSourcesFingerprint === completionReport?.evidenceSourcesFingerprint;
  const reportFingerprintsAlignedOk = finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck
    && completionReport?.acceptanceReportFingerprint === finalReport?.acceptanceReportFingerprint
    && completionReport?.corpusReportFingerprint === finalReport?.corpusReportFingerprint;
  const sourceAdapterEvidenceAlignedAcrossInputReportsOk = sourceAdapterEvidenceAlignedAcrossInputReports(finalReport?.summary, completionReport?.summary);
  const requiredFamilySummariesOk = sameStrings(sourceReport?.summary?.sourceFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(sourceReport?.summary?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(sourceReport?.summary?.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && sameStrings(sourceReport?.summary?.externalAdapterPreflightEvidenceFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(sourceReport?.summary?.missingExternalAdapterPreflightEvidenceFamilies, [])
    && sameStrings(sourceReport?.summary?.externalAdapterSourceAdapterAssertionFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(sourceReport?.summary?.missingExternalAdapterSourceAdapterAssertionFamilies, [])
    && sameStrings(sourceReport?.summary?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && sameStrings(completionReport?.summary?.sourceFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(completionReport?.summary?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(completionReport?.summary?.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && sameStrings(completionReport?.summary?.externalAdapterPreflightEvidenceFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(completionReport?.summary?.missingExternalAdapterPreflightEvidenceFamilies, [])
    && sameStrings(completionReport?.summary?.externalAdapterSourceAdapterAssertionFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(completionReport?.summary?.missingExternalAdapterSourceAdapterAssertionFamilies, [])
    && sourceAdapterKeysOk(completionReport?.summary?.externalAdapterSourceAdapterKeys)
    && sourceAdapterRequestEvidenceFingerprintsOk(completionReport?.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && sourceAdapterConfigStatFingerprintsOk(completionReport?.summary?.externalAdapterSourceAdapterConfigStatFingerprints)
    && sourceAdapterRegistryAggregateFingerprintsOk(completionReport?.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && sourceAdapterRegistryFingerprintsOk(completionReport?.summary?.externalAdapterSourceAdapterRegistryFingerprints)
    && sourceAdapterPreflightFingerprintsOk(completionReport?.summary?.externalAdapterSourceAdapterPreflightFingerprints)
    && sameStrings(completionReport?.summary?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES);
  const sourceEvidenceSemanticsProfileOk = completionReport?.summary?.sourceEvidenceSemanticsProfileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID
    && completionReport?.summary?.sourceEvidenceSemanticsProfileFingerprint === sourceEvidenceSemanticsProfileFingerprint()
    && sameStrings(completionReport?.summary?.sourceEvidenceSemanticArtifactKinds, SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS)
    && completionReport?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT;
  const completionEvidenceRequiredValuePolicyOk = JSON.stringify(completionReport?.summary?.requiredValuePolicy) === JSON.stringify(completionEvidenceValuePolicy());
  const completionEvidenceArtifactPolicyOk = sameStrings(completionReport?.summary?.requiredArtifactKinds, REQUIRED_COMPLETION_ARTIFACT_KINDS)
    && completionArtifactCountMinimumsOk(completionReport?.summary?.artifactCountMinimums);
  const requiredEvidenceCountsOk = Number.isSafeInteger(sourceReport?.summary?.sourceItemCount)
    && sourceReport.summary.sourceItemCount >= MIN_SOURCE_ITEM_COUNT
    && Number.isSafeInteger(sourceReport?.summary?.evidenceItemCount)
    && sourceReport.summary.evidenceItemCount >= MIN_EVIDENCE_ITEM_COUNT
    && Number.isSafeInteger(completionReport?.summary?.evidenceItemCount)
    && completionReport.summary.evidenceItemCount >= MIN_COMPLETION_EVIDENCE_ITEM_COUNT;
  const pathFreeBundleValuesOk = pathFreeValuesOk(finalReport) && pathFreeValuesOk(sourceReport) && pathFreeValuesOk(completionReport);
  const gateResults = {
    finalAcceptanceCheckReadableOk: finalFile.failures.length === 0,
    sourceCheckReadableOk: sourceFile.failures.length === 0,
    completionEvidenceCheckReadableOk: completionFile.failures.length === 0,
    finalAcceptanceCheckShapeOk,
    sourceCheckShapeOk,
    completionEvidenceCheckShapeOk,
    finalAcceptanceCheckAcceptedOk: finalAcceptanceAcceptedOk(finalReport),
    finalAcceptanceCheckAcceptedVerifierValuePolicyOk,
    sourceCheckAcceptedOk: sourceCheckAcceptedOk(sourceReport),
    completionEvidenceCheckAcceptedOk: completionEvidenceCheckAcceptedOk(completionReport),
    finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck,
    evidenceSourcesFingerprintAlignedOk,
    expectedFinalAcceptanceCheckFingerprintMatches,
    expectedSourceCheckFingerprintMatches,
    expectedCompletionEvidenceCheckFingerprintMatches,
    reportFingerprintsAlignedOk,
    sourceAdapterEvidenceAlignedAcrossInputReportsOk,
    requiredFamilySummariesOk,
    sourceEvidenceSemanticsProfileOk,
    completionEvidenceRequiredValuePolicyOk,
    completionEvidenceArtifactPolicyOk,
    requiredEvidenceCountsOk,
    pathFreeBundleValuesOk,
    bundleOutputWritableOk: true
  };
  for (const [field, value] of Object.entries(gateResults)) {
    if (value !== true) failures.push(`${field} failed`);
  }
  const sourceItemCount = safeCount(sourceReport?.summary?.sourceItemCount);
  const evidenceItemCount = safeCount(sourceReport?.summary?.evidenceItemCount);
  const completionEvidenceItemCount = safeCount(completionReport?.summary?.evidenceItemCount);
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: failures.length === 0,
    finalAcceptanceCheckPath: pathFreeInputFileName(options.finalAcceptanceCheckPath),
    sourceCheckPath: pathFreeInputFileName(options.sourceCheckPath),
    completionEvidenceCheckPath: pathFreeInputFileName(options.completionEvidenceCheckPath),
    proofBundleReportPath: pathFreeInputFileName(options.outputPath),
    finalAcceptanceCheckFingerprint: SHA256_FINGERPRINT.test(finalFile.fingerprint) ? finalFile.fingerprint : "",
    sourceCheckFingerprint: SHA256_FINGERPRINT.test(sourceFile.fingerprint) ? sourceFile.fingerprint : "",
    completionEvidenceCheckFingerprint: SHA256_FINGERPRINT.test(completionFile.fingerprint) ? completionFile.fingerprint : "",
    evidenceSourcesFingerprint: SHA256_FINGERPRINT.test(sourceReport?.evidenceSourcesFingerprint || "") ? sourceReport.evidenceSourcesFingerprint : "",
    acceptanceReportFingerprint: SHA256_FINGERPRINT.test(finalReport?.acceptanceReportFingerprint || "") ? finalReport.acceptanceReportFingerprint : "",
    corpusReportFingerprint: SHA256_FINGERPRINT.test(finalReport?.corpusReportFingerprint || "") ? finalReport.corpusReportFingerprint : "",
    gates: gateResults,
    summary: {
      sourceFamilies: Array.isArray(sourceReport?.summary?.sourceFamilies) ? sourceReport.summary.sourceFamilies.filter((family) => REQUIRED_SOURCE_FAMILIES.includes(family)) : [],
      externalAdapterFamilies: Array.isArray(sourceReport?.summary?.externalAdapterFamilies) ? sourceReport.summary.externalAdapterFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
      externalAdapterTargetFormatTokens: sharedExternalAdapterTargetFormatTokens(sourceReport?.summary, completionReport?.summary),
      externalAdapterPreflightEvidenceFamilies: sharedExternalAdapterPreflightEvidenceFamilies(sourceReport?.summary, completionReport?.summary),
      missingExternalAdapterPreflightEvidenceFamilies: missingExternalAdapterPreflightEvidenceFamilies(sourceReport?.summary, completionReport?.summary),
      externalAdapterSourceAdapterAssertionFamilies: sharedExternalAdapterSourceAdapterAssertionFamilies(sourceReport?.summary, completionReport?.summary),
      missingExternalAdapterSourceAdapterAssertionFamilies: missingExternalAdapterSourceAdapterAssertionFamilies(sourceReport?.summary, completionReport?.summary),
      externalAdapterSourceAdapterKeys: safeAdapterKeyListMap(completionReport?.summary?.externalAdapterSourceAdapterKeys),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: safeFingerprintListMap(completionReport?.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints),
      externalAdapterSourceAdapterConfigStatFingerprints: safeStatFingerprintListMap(completionReport?.summary?.externalAdapterSourceAdapterConfigStatFingerprints),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: safeFingerprintListMap(completionReport?.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints),
      externalAdapterSourceAdapterRegistryFingerprints: safeFingerprintListMap(completionReport?.summary?.externalAdapterSourceAdapterRegistryFingerprints),
      externalAdapterSourceAdapterPreflightFingerprints: safeFingerprintListMap(completionReport?.summary?.externalAdapterSourceAdapterPreflightFingerprints),
      pointCloudFamilies: Array.isArray(sourceReport?.summary?.pointCloudFamilies) ? sourceReport.summary.pointCloudFamilies.filter((family) => REQUIRED_POINT_CLOUD_FAMILIES.includes(family)) : [],
      sourceEvidenceSemanticsProfileId: completionReport?.summary?.sourceEvidenceSemanticsProfileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID ? SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID : "",
      sourceEvidenceSemanticsProfileFingerprint: SHA256_FINGERPRINT.test(completionReport?.summary?.sourceEvidenceSemanticsProfileFingerprint || "") ? completionReport.summary.sourceEvidenceSemanticsProfileFingerprint : "",
      sourceEvidenceSemanticArtifactKinds: Array.isArray(completionReport?.summary?.sourceEvidenceSemanticArtifactKinds)
        ? completionReport.summary.sourceEvidenceSemanticArtifactKinds.filter((kind) => SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS.includes(kind))
        : [],
      proofPlanFingerprint: completionReport?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT ? FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT : "",
      sourceItemCount,
      evidenceItemCount,
      completionEvidenceItemCount,
      requiredEvidenceMinimums: requiredEvidenceMinimums(),
      requiredCompletionArtifactKinds: Array.isArray(completionReport?.summary?.requiredArtifactKinds)
        ? completionReport.summary.requiredArtifactKinds.filter((kind) => REQUIRED_COMPLETION_ARTIFACT_KINDS.includes(kind))
        : [],
      requiredCompletionArtifactCountMinimums: completionArtifactCountMinimumsOk(completionReport?.summary?.artifactCountMinimums)
        ? requiredCompletionArtifactCountMinimums()
        : [],
      requiredTargetFormatTokens: requiredTargetFormatTokens(),
      requiredExternalAdapterTargetFormatTokens: requiredExternalAdapterTargetFormatTokens(),
      requiredPointCloudTargetFormatTokens: requiredPointCloudTargetFormatTokens(),
      requiredFamilySummaries: requiredFamilySummaries(),
      requiredSourceEvidenceSemanticsProfile: requiredSourceEvidenceSemanticsProfile(),
      requiredInputReports: requiredInputReports(),
      requiredFingerprintPins: requiredFingerprintPins(),
      requiredSavedInputReportGates: requiredSavedInputReportGates(),
      requiredCrossReportGates: requiredCrossReportGates(),
      requiredValuePolicy: valuePolicy(),
      evidenceCountDeficits: evidenceCountDeficits(sourceItemCount, evidenceItemCount, completionEvidenceItemCount),
      failedGateFields: gateFailureFields(gateResults),
      missingSourceItems: Array.isArray(sourceReport?.summary?.missingSourceItems) ? sourceReport.summary.missingSourceItems.filter(safeRequirementToken) : [],
      insufficientSourceCounts: Array.isArray(sourceReport?.summary?.insufficientSourceCounts) ? sourceReport.summary.insufficientSourceCounts.filter(safeRequirementToken) : [],
      missingCompletionArtifactKinds: Array.isArray(completionReport?.summary?.missingArtifactKinds) ? completionReport.summary.missingArtifactKinds.filter(safeLabel) : [],
      insufficientCompletionArtifactCounts: Array.isArray(completionReport?.summary?.insufficientArtifactCounts) ? completionReport.summary.insufficientArtifactCounts.filter(safeRequirementToken) : []
    },
    failures,
    warnings: []
  };
}

function failureOutput(options = {}, failures = []) {
  const gates = {
    finalAcceptanceCheckReadableOk: false,
    sourceCheckReadableOk: false,
    completionEvidenceCheckReadableOk: false,
    finalAcceptanceCheckShapeOk: false,
    sourceCheckShapeOk: false,
    completionEvidenceCheckShapeOk: false,
    finalAcceptanceCheckAcceptedOk: false,
    finalAcceptanceCheckAcceptedVerifierValuePolicyOk: false,
    sourceCheckAcceptedOk: false,
    completionEvidenceCheckAcceptedOk: false,
    finalAcceptanceCheckFingerprintMatchesCompletionEvidenceCheck: false,
    evidenceSourcesFingerprintAlignedOk: false,
    expectedFinalAcceptanceCheckFingerprintMatches: false,
    expectedSourceCheckFingerprintMatches: false,
    expectedCompletionEvidenceCheckFingerprintMatches: false,
    reportFingerprintsAlignedOk: false,
    requiredFamilySummariesOk: false,
    sourceEvidenceSemanticsProfileOk: false,
    completionEvidenceRequiredValuePolicyOk: false,
    completionEvidenceArtifactPolicyOk: false,
    requiredEvidenceCountsOk: false,
    pathFreeBundleValuesOk: false,
    bundleOutputWritableOk: true
  };
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    finalAcceptanceCheckPath: pathFreeInputFileName(options.finalAcceptanceCheckPath),
    sourceCheckPath: pathFreeInputFileName(options.sourceCheckPath),
    completionEvidenceCheckPath: pathFreeInputFileName(options.completionEvidenceCheckPath),
    proofBundleReportPath: pathFreeInputFileName(options.outputPath),
    finalAcceptanceCheckFingerprint: "",
    sourceCheckFingerprint: "",
    completionEvidenceCheckFingerprint: "",
    evidenceSourcesFingerprint: "",
    acceptanceReportFingerprint: "",
    corpusReportFingerprint: "",
    gates,
    summary: {
      sourceFamilies: [],
      externalAdapterFamilies: [],
      externalAdapterTargetFormatTokens: [],
      externalAdapterPreflightEvidenceFamilies: [],
      missingExternalAdapterPreflightEvidenceFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
      externalAdapterSourceAdapterAssertionFamilies: [],
      missingExternalAdapterSourceAdapterAssertionFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
      externalAdapterSourceAdapterKeys: safeAdapterKeyListMap(),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterConfigStatFingerprints: safeStatFingerprintListMap(),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterRegistryFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterPreflightFingerprints: safeFingerprintListMap(),
      pointCloudFamilies: [],
      sourceEvidenceSemanticsProfileId: "",
      sourceEvidenceSemanticsProfileFingerprint: "",
      sourceEvidenceSemanticArtifactKinds: [],
      sourceItemCount: 0,
      evidenceItemCount: 0,
      completionEvidenceItemCount: 0,
      requiredEvidenceMinimums: requiredEvidenceMinimums(),
      requiredCompletionArtifactKinds: [],
      requiredCompletionArtifactCountMinimums: [],
      requiredTargetFormatTokens: requiredTargetFormatTokens(),
      requiredExternalAdapterTargetFormatTokens: requiredExternalAdapterTargetFormatTokens(),
      requiredPointCloudTargetFormatTokens: requiredPointCloudTargetFormatTokens(),
      requiredFamilySummaries: requiredFamilySummaries(),
      requiredSourceEvidenceSemanticsProfile: requiredSourceEvidenceSemanticsProfile(),
      requiredInputReports: requiredInputReports(),
      requiredFingerprintPins: requiredFingerprintPins(),
      requiredSavedInputReportGates: requiredSavedInputReportGates(),
      requiredCrossReportGates: requiredCrossReportGates(),
      requiredValuePolicy: valuePolicy(),
      evidenceCountDeficits: evidenceCountDeficits(0, 0, 0),
      failedGateFields: gateFailureFields(gates),
      missingSourceItems: [],
      insufficientSourceCounts: [],
      missingCompletionArtifactKinds: [],
      insufficientCompletionArtifactCounts: []
    },
    failures,
    warnings: []
  };
}

function writeReport(outputPath, report) {
  if (!outputPath) return true;
  try {
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
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
  const finalFile = readJsonFile(options.finalAcceptanceCheckPath, "final acceptance check");
  const sourceFile = readJsonFile(options.sourceCheckPath, "completion evidence source check");
  const completionFile = readJsonFile(options.completionEvidenceCheckPath, "completion evidence check");
  const loadFailures = [...finalFile.failures, ...sourceFile.failures, ...completionFile.failures];
  const report = loadFailures.length > 0
    ? failureOutput(options, loadFailures)
    : verifyBundle(finalFile, sourceFile, completionFile, options);
  if (!writeReport(options.outputPath, report)) {
    report.gates.bundleOutputWritableOk = false;
    report.ok = false;
    if (!report.failures.includes("bundleOutputWritableOk failed")) {
      report.failures.push("bundleOutputWritableOk failed");
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = failureOutput(activeOptions, [error?.message === "Unknown option." ? "Unknown option." : "reference import final proof bundle check failed"]);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
