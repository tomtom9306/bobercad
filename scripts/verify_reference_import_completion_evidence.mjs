#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_ID = "referenceImportCompletionEvidenceCheck";
const CHECK_VERSION = "0.1.0";
const COMPLETION_EVIDENCE_ID = "referenceImportCompletionEvidence";
const COMPLETION_EVIDENCE_TEMPLATE_ID = "referenceImportCompletionEvidenceTemplate";
const COMPLETION_EVIDENCE_BUILDER_ID = "referenceImportCompletionEvidenceBuilder";
const FINAL_ACCEPTANCE_CHECK_ID = "referenceImportFinalAcceptanceCheck";
const FINAL_ACCEPTANCE_REPORT_ID = "referenceImportCorpusAcceptanceReport";
const FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID = "full-private-reference-import-acceptance";
const UPSTREAM_CORPUS_RUN_PROFILE_ID = "full-private-reference-import-corpus-run";
const COMPLETION_EVIDENCE_PROFILE_ID = "reference-import-goal-completion-evidence";
const SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID = "reference-import-completion-source-evidence-semantics-v1";
const SOURCE_EVIDENCE_SEMANTICS_MODE = "build-time-semantic-evidence-files";
const REQUIRED_SOURCE_FAMILIES = ["dxf", "dwg", "step", "ifc", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_FAMILIES = ["dwg", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = ["dwg", "e57pointcloud"];
const REQUIRED_POINT_CLOUD_FAMILIES = ["e57"];
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
  "promoted-import-corpus-report",
  "fingerprint-pinned-verifier-output",
  "final-acceptance-check-report",
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
];
const REQUIRED_ARTIFACT_COUNT_MINIMUMS = [
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
const GLOBAL_ARTIFACT_KINDS = new Set([
  "promoted-import-corpus-report",
  "fingerprint-pinned-verifier-output",
  "final-acceptance-check-report",
  "disposable-project-copy",
  "promoted-reference-manifest",
  "point-cloud-chunk-sidecar"
]);
const FAMILY_ARTIFACT_KINDS = new Set([
  "private-source-family",
  "external-adapter-preflight",
  "external-adapter-source-adapter-assertion",
  "point-cloud-family"
]);
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const STAT_SHA256_FINGERPRINT = /^stat-sha256:[0-9a-f]{64}$/;
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT = "sha256:0dfa480ed4f08afce2aeb1f2d71910f7d2498565533262d09dabeef59ad568d3";
const RESERVED_ADAPTER_KEYS = new Set(["__proto__", "prototype", "constructor"]);
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
const EVIDENCE_ARTIFACT_CONTRACT_FIELDS = [
  "kind",
  "families",
  "minCount",
  "countScope",
  "evidenceSource",
  "proofRequirement",
  "privacyBoundary"
];
const EVIDENCE_ARTIFACT_CONTRACTS = [
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
const OUTPUT_FIELDS = [
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
const GATE_FIELDS = [
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
  "evidenceItemCount",
  "requiredArtifactKinds",
  "requiredValuePolicy",
  "missingArtifactKinds",
  "artifactCountMinimums",
  "insufficientArtifactCounts"
];
const TEMPLATE_PLACEHOLDER_FINGERPRINT = "replace-with-sha256-fingerprint";
const SOURCE_ADAPTER_KEY_POLICY_PATHS = [
  ["sourceEvidenceSemantics", "sourceAdapterKeyPolicy"]
];

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_completion_evidence.mjs --final-acceptance-check <check.json> --evidence <evidence.json> [options]",
    "",
    "Verifies a path-free private completion evidence manifest against a saved final acceptance check output.",
    "This command reads only those two saved JSON artifacts; it does not read private source files, corpus reports, projects, reference manifests, chunks, adapter configs, workflow runners, or external adapters.",
    "",
    "Options:",
    "  --final-acceptance-check <path>  Saved output from verify_reference_import_final_acceptance.mjs.",
    "  --evidence <path>                Path-free completion evidence manifest.",
    "  --output <path>                  Optional machine-readable JSON completion evidence check path.",
    "  --expect-final-acceptance-check-fingerprint <sha256:hex>  Require final check bytes to match this fingerprint.",
    "  --print-evidence-template        Print a path-free completion evidence manifest template from the final check and exit.",
    "  --list-contract                  Print the completion evidence checker contract and exit.",
    "  --help                           Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    finalAcceptanceCheckPath: "",
    evidencePath: "",
    outputPath: "",
    expectedFinalAcceptanceCheckFingerprint: "",
    printEvidenceTemplate: false,
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
    if (arg === "--print-evidence-template") {
      options.printEvidenceTemplate = true;
      continue;
    }
    if (arg === "--final-acceptance-check") {
      options.finalAcceptanceCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--evidence") {
      options.evidencePath = requiredValue(argv, index, arg);
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
    id: "referenceImportCompletionEvidenceCheckContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    completionEvidenceId: COMPLETION_EVIDENCE_ID,
    inputBoundary: {
      readsSavedFinalAcceptanceCheckOnly: true,
      readsCompletionEvidenceManifestOnly: true,
      readsSavedVerifierOutput: false,
      readsSavedCorpusReport: false,
      readsPrivateSourceFiles: false,
      readsProjectFiles: false,
      readsReferenceManifests: false,
      readsPointCloudChunkSidecars: false,
      readsAdapterConfigs: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    finalPrivateAcceptanceRequirements: {
      finalAcceptanceCheckId: FINAL_ACCEPTANCE_CHECK_ID,
      finalAcceptanceReportId: FINAL_ACCEPTANCE_REPORT_ID,
      finalPrivateAcceptanceProfileId: FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID,
      upstreamCorpusRunProfileId: UPSTREAM_CORPUS_RUN_PROFILE_ID,
      completionEvidenceProfileId: COMPLETION_EVIDENCE_PROFILE_ID,
      requiredSourceFamilies: REQUIRED_SOURCE_FAMILIES,
      requiredExternalAdapterFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
      requiredExternalAdapterTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
      requiredPointCloudFamilies: REQUIRED_POINT_CLOUD_FAMILIES,
      requiredArtifactKinds: REQUIRED_ARTIFACT_KINDS
    },
    evidenceManifestContract: {
      id: COMPLETION_EVIDENCE_ID,
      version: CHECK_VERSION,
      topLevelFields: COMPLETION_EVIDENCE_FIELDS,
      sourceEvidenceSemanticsFields: SOURCE_EVIDENCE_SEMANTICS_FIELDS,
      sourceEvidenceSemanticsProfileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
      sourceEvidenceSemanticsMode: SOURCE_EVIDENCE_SEMANTICS_MODE,
      sourceEvidenceSemanticArtifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
      sourceEvidenceSemanticsProfileFingerprint: sourceEvidenceSemanticsProfileFingerprint(),
      evidenceItemFields: COMPLETION_EVIDENCE_ITEM_FIELDS,
      evidenceItemKinds: REQUIRED_ARTIFACT_KINDS,
      evidenceArtifactContractFields: EVIDENCE_ARTIFACT_CONTRACT_FIELDS,
      evidenceArtifactContracts: EVIDENCE_ARTIFACT_CONTRACTS,
      artifactCountMinimums: REQUIRED_ARTIFACT_COUNT_MINIMUMS,
      pathPrivacyPolicy: "Evidence manifest values must be path-free labels, known family/kind tokens, positive counts, and sha256 fingerprints; local paths and raw private payloads are rejected and never echoed."
    },
    evidenceTemplateContract: {
      id: COMPLETION_EVIDENCE_TEMPLATE_ID,
      modeFlag: "--print-evidence-template",
      readsSavedFinalAcceptanceCheckOnly: true,
      outputId: COMPLETION_EVIDENCE_ID,
      fillsFinalAcceptanceCheckFingerprint: true,
      fillsAcceptanceReportFingerprint: true,
      fillsCorpusReportFingerprint: true,
      privateEvidenceFingerprintPlaceholder: TEMPLATE_PLACEHOLDER_FINGERPRINT,
      placeholderPolicy: "Template placeholders are intentionally not valid sha256 fingerprints; replace every placeholder with externally computed private evidence fingerprints before verification."
    },
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      summaryFields: SUMMARY_FIELDS,
      finalAcceptanceCheckFields: FINAL_ACCEPTANCE_CHECK_FIELDS,
      finalAcceptanceGateFields: FINAL_ACCEPTANCE_GATE_FIELDS,
      finalAcceptanceSummaryFields: FINAL_ACCEPTANCE_SUMMARY_FIELDS,
      completionEvidenceOutputPathField: "completionEvidenceCheckPath",
      valuePolicy: valuePolicy(),
      sourceAdapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
      },
      pathPrivacyFields: ["finalAcceptanceCheckPath", "evidenceManifestPath", "completionEvidenceCheckPath"]
    },
    cliFlags: ["--final-acceptance-check", "--evidence", "--output", "--expect-final-acceptance-check-fingerprint", "--print-evidence-template", "--list-contract", "--help"]
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

function valuePolicy() {
  return {
    pathFreeGateField: "completionEvidenceValueShapeOk",
    protectedArtifact: "referenceImportCompletionEvidence manifest",
    acceptsRawPrivatePaths: false,
    acceptsRawPrivatePayloads: false,
    allowedValueKinds: ["safe-label", "known-family-token", "known-artifact-kind-token", "positive-count", "sha256-fingerprint", "stat-sha256-fingerprint", "empty-string"],
    allowedSourceAdapterKeyPolicyPaths: SOURCE_ADAPTER_KEY_POLICY_PATHS.map((segments) => segments.join("."))
  };
}

function sourceEvidenceSemanticsProfilePayload() {
  return {
    profileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
    builderId: COMPLETION_EVIDENCE_BUILDER_ID,
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

function sourceEvidenceSemanticsValueShapeOk(value = {}) {
  return exactObjectFieldsOk(value, SOURCE_EVIDENCE_SEMANTICS_FIELDS)
    && value.profileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID
    && value.builderId === COMPLETION_EVIDENCE_BUILDER_ID
    && value.builderVersion === CHECK_VERSION
    && value.gate === "sourceEvidenceSemanticsOk"
    && value.mode === SOURCE_EVIDENCE_SEMANTICS_MODE
    && sameStrings(value.artifactKinds, SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS)
    && JSON.stringify(value.sourceAdapterKeyPolicy) === JSON.stringify(sourceAdapterKeyPolicy())
    && value.profileFingerprint === sourceEvidenceSemanticsProfileFingerprint();
}

function readJsonFile(filePath = "", label = "JSON artifact") {
  if (!filePath) {
    return { value: null, raw: "", fingerprint: "", failures: [`${label} path is required`] };
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const fingerprint = fileFingerprint(raw);
    try {
      return { value: JSON.parse(raw), raw, fingerprint, failures: [] };
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

function singleAdapterKeyListMapOk(value = {}) {
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

function singleFingerprintListMapOk(value = {}) {
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

function singleStatFingerprintListMapOk(value = {}) {
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

function sourceAdapterEvidenceAlignedWithFinalAcceptanceCheck(finalSummary = {}, evidence = {}) {
  return adapterKeyMapOk(finalSummary.externalAdapterSourceAdapterKeys)
    && singleAdapterKeyListMapOk(evidence.externalAdapterSourceAdapterKeys)
    && sameJsonValue(safeAdapterKeyListMap(finalSummary.externalAdapterSourceAdapterKeys), safeAdapterKeyListMap(evidence.externalAdapterSourceAdapterKeys))
    && fingerprintListMapOk(finalSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && singleFingerprintListMapOk(evidence.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRequestEvidenceFingerprints), safeFingerprintListMap(evidence.externalAdapterSourceAdapterRequestEvidenceFingerprints))
    && statFingerprintListMapOk(finalSummary.externalAdapterSourceAdapterConfigStatFingerprints)
    && singleStatFingerprintListMapOk(evidence.externalAdapterSourceAdapterConfigStatFingerprints)
    && sameJsonValue(safeStatFingerprintListMap(finalSummary.externalAdapterSourceAdapterConfigStatFingerprints), safeStatFingerprintListMap(evidence.externalAdapterSourceAdapterConfigStatFingerprints))
    && fingerprintListMapOk(finalSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && singleFingerprintListMapOk(evidence.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRegistryAggregateFingerprints), safeFingerprintListMap(evidence.externalAdapterSourceAdapterRegistryAggregateFingerprints))
    && fingerprintListMapOk(finalSummary.externalAdapterSourceAdapterRegistryFingerprints)
    && singleFingerprintListMapOk(evidence.externalAdapterSourceAdapterRegistryFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterRegistryFingerprints), safeFingerprintListMap(evidence.externalAdapterSourceAdapterRegistryFingerprints))
    && fingerprintListMapOk(finalSummary.externalAdapterSourceAdapterPreflightFingerprints)
    && singleFingerprintListMapOk(evidence.externalAdapterSourceAdapterPreflightFingerprints)
    && sameJsonValue(safeFingerprintListMap(finalSummary.externalAdapterSourceAdapterPreflightFingerprints), safeFingerprintListMap(evidence.externalAdapterSourceAdapterPreflightFingerprints));
}

function safeLabel(value = "") {
  const text = String(value || "");
  return SAFE_LABEL.test(text) && !RESERVED_ADAPTER_KEYS.has(text) && !/[\\/:]/.test(text) && !text.includes("..");
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

function pathFreeValuesOk(value, pathSegments = []) {
  if (typeof value === "string") return safeLabel(value) || SHA256_FINGERPRINT.test(value) || STAT_SHA256_FINGERPRINT.test(value) || REQUIRED_SOURCE_FAMILIES.includes(value) || REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(value) || REQUIRED_ARTIFACT_KINDS.includes(value) || value === "";
  if (typeof value === "number" || typeof value === "boolean" || value === null) return true;
  if (Array.isArray(value)) return value.every((entry) => pathFreeValuesOk(entry, pathSegments));
  if (value && typeof value === "object") {
    return (sourceAdapterKeyPolicyPathOk(pathSegments) && sourceAdapterKeyPolicyValueOk(value))
      || Object.entries(value).every(([key, entry]) => pathFreeValuesOk(entry, [...pathSegments, key]));
  }
  return false;
}

function validEvidenceItem(item) {
  if (!exactObjectFieldsOk(item, COMPLETION_EVIDENCE_ITEM_FIELDS)) return false;
  if (!REQUIRED_ARTIFACT_KINDS.includes(item.kind)) return false;
  if (!SHA256_FINGERPRINT.test(item.fingerprint || "")) return false;
  if (!Number.isSafeInteger(item.count) || item.count <= 0) return false;
  if (!safeLabel(item.label)) return false;
  if (GLOBAL_ARTIFACT_KINDS.has(item.kind)) return item.family === "";
  if (item.kind === "private-source-family") return REQUIRED_SOURCE_FAMILIES.includes(item.family);
  if (item.kind === "external-adapter-preflight") return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(item.family);
  if (item.kind === "external-adapter-source-adapter-assertion") return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(item.family);
  if (item.kind === "point-cloud-family") return REQUIRED_POINT_CLOUD_FAMILIES.includes(item.family);
  return false;
}

function hasEvidence(items, kind, family = "") {
  return items.some((item) => item.kind === kind && item.family === family && validEvidenceItem(item));
}

function evidenceCount(items, kind, family = "") {
  return items
    .filter((item) => item.kind === kind && item.family === family && validEvidenceItem(item))
    .reduce((total, item) => total + item.count, 0);
}

function evidenceFamilies(items, kind, allowedFamilies) {
  return items
    .filter((item) => item.kind === kind && validEvidenceItem(item) && allowedFamilies.includes(item.family))
    .map((item) => item.family)
    .filter((family, index, families) => families.indexOf(family) === index);
}

function finalAcceptanceCheckAcceptedOk(check = {}) {
  const gates = check?.gates || {};
  return check?.id === FINAL_ACCEPTANCE_CHECK_ID
    && check?.version === CHECK_VERSION
    && check?.ok === true
    && check?.acceptanceReportId === FINAL_ACCEPTANCE_REPORT_ID
    && check?.acceptanceReportVersion === CHECK_VERSION
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
    && check?.summary?.accepted === true
    && sameStrings(check?.summary?.acceptedFormatFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(check?.summary?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && JSON.stringify(check?.summary?.externalAdapterTargetFormatTokens) === JSON.stringify(REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && sourceAdapterEvidenceAlignedWithFinalAcceptanceCheck(check?.summary, check?.summary)
    && sameStrings(check?.summary?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && check?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT
    && finalAcceptanceAcceptedVerifierValuePolicyOk(check?.summary?.acceptedVerifierValuePolicy)
    && check?.summary?.missingEvidenceRecommendedAction === "run-private-end-to-end-proof-plan"
    && Array.isArray(check?.failures)
    && check.failures.length === 0
    && Array.isArray(check?.warnings)
    && check.warnings.length === 0;
}

function verifyCompletionEvidence(finalCheck, finalCheckFingerprint, evidence, options) {
  const failures = [];
  const finalAcceptanceCheckShapeOk = exactObjectFieldsOk(finalCheck, FINAL_ACCEPTANCE_CHECK_FIELDS)
    && exactObjectFieldsOk(finalCheck?.gates, FINAL_ACCEPTANCE_GATE_FIELDS)
    && exactObjectFieldsOk(finalCheck?.summary, FINAL_ACCEPTANCE_SUMMARY_FIELDS);
  const finalAcceptanceCheckAcceptedVerifierValuePolicyOkValue = finalAcceptanceAcceptedVerifierValuePolicyOk(finalCheck?.summary?.acceptedVerifierValuePolicy);
  const finalAcceptanceCheckAcceptedOkValue = finalAcceptanceCheckAcceptedOk(finalCheck);
  const expectedFinalAcceptanceCheckFingerprintMatches = options.expectedFinalAcceptanceCheckFingerprint
    ? finalCheckFingerprint === options.expectedFinalAcceptanceCheckFingerprint
    : null;
  const completionEvidenceShapeOk = exactObjectFieldsOk(evidence, COMPLETION_EVIDENCE_FIELDS)
    && Array.isArray(evidence?.evidenceItems)
    && evidence.evidenceItems.every((item) => exactObjectFieldsOk(item, COMPLETION_EVIDENCE_ITEM_FIELDS));
  const evidenceItems = Array.isArray(evidence?.evidenceItems) ? evidence.evidenceItems : [];
  const completionEvidenceValueShapeOk = evidence?.id === COMPLETION_EVIDENCE_ID
    && evidence?.version === CHECK_VERSION
    && SHA256_FINGERPRINT.test(evidence?.finalAcceptanceCheckFingerprint || "")
    && SHA256_FINGERPRINT.test(evidence?.acceptanceReportFingerprint || "")
    && SHA256_FINGERPRINT.test(evidence?.corpusReportFingerprint || "")
    && SHA256_FINGERPRINT.test(evidence?.evidenceSourcesFingerprint || "")
    && sameStrings(evidence?.sourceFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(evidence?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(evidence?.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && singleAdapterKeyListMapOk(evidence?.externalAdapterSourceAdapterKeys)
    && singleFingerprintListMapOk(evidence?.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && singleStatFingerprintListMapOk(evidence?.externalAdapterSourceAdapterConfigStatFingerprints)
    && singleFingerprintListMapOk(evidence?.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && singleFingerprintListMapOk(evidence?.externalAdapterSourceAdapterRegistryFingerprints)
    && singleFingerprintListMapOk(evidence?.externalAdapterSourceAdapterPreflightFingerprints)
    && sameStrings(evidence?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && sourceEvidenceSemanticsValueShapeOk(evidence?.sourceEvidenceSemantics)
    && evidenceItems.length >= REQUIRED_ARTIFACT_KINDS.length
    && evidenceItems.every(validEvidenceItem)
    && pathFreeValuesOk(evidence);
  const requiredSourceFamilyEvidenceOk = REQUIRED_SOURCE_FAMILIES.every((family) => hasEvidence(evidenceItems, "private-source-family", family));
  const externalAdapterPreflightEvidenceFamilies = evidenceFamilies(evidenceItems, "external-adapter-preflight", REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  const requiredExternalAdapterEvidenceOk = REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => hasEvidence(evidenceItems, "external-adapter-preflight", family));
  const externalAdapterSourceAdapterAssertionFamilies = evidenceFamilies(evidenceItems, "external-adapter-source-adapter-assertion", REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  const requiredExternalAdapterSourceAdapterAssertionEvidenceOk = REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => hasEvidence(evidenceItems, "external-adapter-source-adapter-assertion", family));
  const requiredPointCloudEvidenceOk = REQUIRED_POINT_CLOUD_FAMILIES.every((family) => hasEvidence(evidenceItems, "point-cloud-family", family));
  const finalAcceptanceCheckFingerprintMatchesManifest = SHA256_FINGERPRINT.test(finalCheckFingerprint)
    && evidence?.finalAcceptanceCheckFingerprint === finalCheckFingerprint;
  const reportFingerprintEvidenceOk = finalAcceptanceCheckFingerprintMatchesManifest
    && evidence?.acceptanceReportFingerprint === finalCheck?.acceptanceReportFingerprint
    && evidence?.corpusReportFingerprint === finalCheck?.corpusReportFingerprint
    && hasEvidence(evidenceItems, "final-acceptance-check-report")
    && evidenceItems.some((item) => item.kind === "final-acceptance-check-report" && item.fingerprint === finalCheckFingerprint)
    && evidenceItems.some((item) => item.kind === "fingerprint-pinned-verifier-output" && item.fingerprint === finalCheck?.acceptanceReportFingerprint)
    && evidenceItems.some((item) => item.kind === "promoted-import-corpus-report" && item.fingerprint === finalCheck?.corpusReportFingerprint);
  const sourceAdapterEvidenceMatchesFinalAcceptanceCheck = sourceAdapterEvidenceAlignedWithFinalAcceptanceCheck(finalCheck?.summary, evidence);
  const missingArtifactKinds = REQUIRED_ARTIFACT_KINDS.filter((kind) => !evidenceItems.some((item) => item.kind === kind && validEvidenceItem(item)));
  const requiredArtifactKindsOk = missingArtifactKinds.length === 0
    && hasEvidence(evidenceItems, "disposable-project-copy")
    && hasEvidence(evidenceItems, "promoted-reference-manifest")
    && hasEvidence(evidenceItems, "point-cloud-chunk-sidecar");
  const insufficientArtifactCounts = REQUIRED_ARTIFACT_COUNT_MINIMUMS
    .filter((entry) => evidenceCount(evidenceItems, entry.kind, entry.family) < entry.minCount)
    .map((entry) => `${entry.kind}:${entry.family || "all"}:${entry.minCount}`);
  const artifactCountEvidenceOk = insufficientArtifactCounts.length === 0;
  const gateResults = {
    finalAcceptanceCheckShapeOk,
    finalAcceptanceCheckAcceptedOk: finalAcceptanceCheckAcceptedOkValue,
    finalAcceptanceCheckAcceptedVerifierValuePolicyOk: finalAcceptanceCheckAcceptedVerifierValuePolicyOkValue,
    finalAcceptanceCheckFingerprintMatchesManifest,
    expectedFinalAcceptanceCheckFingerprintMatches,
    completionEvidenceShapeOk,
    completionEvidenceValueShapeOk,
    requiredSourceFamilyEvidenceOk,
    requiredExternalAdapterEvidenceOk,
    requiredExternalAdapterSourceAdapterAssertionEvidenceOk,
    requiredPointCloudEvidenceOk,
    sourceAdapterEvidenceMatchesFinalAcceptanceCheck,
    reportFingerprintEvidenceOk,
    requiredArtifactKindsOk,
    artifactCountEvidenceOk,
    completionEvidenceOutputWritableOk: true
  };
  for (const [field, value] of Object.entries(gateResults)) {
    if (field === "expectedFinalAcceptanceCheckFingerprintMatches" && value === null) continue;
    if (value !== true) failures.push(`${field} failed`);
  }
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: failures.length === 0,
    finalAcceptanceCheckPath: pathFreeInputFileName(options.finalAcceptanceCheckPath),
    evidenceManifestPath: pathFreeInputFileName(options.evidencePath),
    completionEvidenceCheckPath: pathFreeInputFileName(options.outputPath),
    evidenceSourcesFingerprint: SHA256_FINGERPRINT.test(evidence?.evidenceSourcesFingerprint || "") ? evidence.evidenceSourcesFingerprint : "",
    finalAcceptanceCheckFingerprint: SHA256_FINGERPRINT.test(finalCheckFingerprint) ? finalCheckFingerprint : "",
    acceptanceReportFingerprint: SHA256_FINGERPRINT.test(finalCheck?.acceptanceReportFingerprint || "") ? finalCheck.acceptanceReportFingerprint : "",
    corpusReportFingerprint: SHA256_FINGERPRINT.test(finalCheck?.corpusReportFingerprint || "") ? finalCheck.corpusReportFingerprint : "",
    gates: gateResults,
    summary: {
      sourceFamilies: Array.isArray(evidence?.sourceFamilies) ? evidence.sourceFamilies.filter((family) => REQUIRED_SOURCE_FAMILIES.includes(family)) : [],
      externalAdapterFamilies: Array.isArray(evidence?.externalAdapterFamilies) ? evidence.externalAdapterFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
      externalAdapterTargetFormatTokens: Array.isArray(evidence?.externalAdapterTargetFormatTokens) ? evidence.externalAdapterTargetFormatTokens.filter((token) => REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS.includes(token)) : [],
      externalAdapterPreflightEvidenceFamilies,
      missingExternalAdapterPreflightEvidenceFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES
        .filter((family) => !externalAdapterPreflightEvidenceFamilies.includes(family)),
      externalAdapterSourceAdapterAssertionFamilies,
      missingExternalAdapterSourceAdapterAssertionFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES
        .filter((family) => !externalAdapterSourceAdapterAssertionFamilies.includes(family)),
      externalAdapterSourceAdapterKeys: safeAdapterKeyListMap(evidence?.externalAdapterSourceAdapterKeys),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: safeFingerprintListMap(evidence?.externalAdapterSourceAdapterRequestEvidenceFingerprints),
      externalAdapterSourceAdapterConfigStatFingerprints: safeStatFingerprintListMap(evidence?.externalAdapterSourceAdapterConfigStatFingerprints),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: safeFingerprintListMap(evidence?.externalAdapterSourceAdapterRegistryAggregateFingerprints),
      externalAdapterSourceAdapterRegistryFingerprints: safeFingerprintListMap(evidence?.externalAdapterSourceAdapterRegistryFingerprints),
      externalAdapterSourceAdapterPreflightFingerprints: safeFingerprintListMap(evidence?.externalAdapterSourceAdapterPreflightFingerprints),
      pointCloudFamilies: Array.isArray(evidence?.pointCloudFamilies) ? evidence.pointCloudFamilies.filter((family) => REQUIRED_POINT_CLOUD_FAMILIES.includes(family)) : [],
      sourceEvidenceSemanticsProfileId: evidence?.sourceEvidenceSemantics?.profileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID ? SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID : "",
      sourceEvidenceSemanticsProfileFingerprint: SHA256_FINGERPRINT.test(evidence?.sourceEvidenceSemantics?.profileFingerprint || "") ? evidence.sourceEvidenceSemantics.profileFingerprint : "",
      sourceEvidenceSemanticArtifactKinds: Array.isArray(evidence?.sourceEvidenceSemantics?.artifactKinds)
        ? evidence.sourceEvidenceSemantics.artifactKinds.filter((kind) => SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS.includes(kind))
        : [],
      proofPlanFingerprint: finalCheck?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT ? FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT : "",
      evidenceItemCount: evidenceItems.filter(validEvidenceItem).length,
      requiredArtifactKinds: REQUIRED_ARTIFACT_KINDS,
      requiredValuePolicy: valuePolicy(),
      missingArtifactKinds,
      artifactCountMinimums: REQUIRED_ARTIFACT_COUNT_MINIMUMS.map((entry) => ({
        kind: entry.kind,
        family: entry.family,
        minCount: entry.minCount,
        reason: entry.reason
      })),
      insufficientArtifactCounts
    },
    failures,
    warnings: []
  };
}

function templateItem(kind, family, fingerprint, count, label) {
  return { kind, family, fingerprint, count, label };
}

function completionEvidenceTemplate(finalCheck, finalCheckFingerprint) {
  return {
    id: COMPLETION_EVIDENCE_ID,
    version: CHECK_VERSION,
    finalAcceptanceCheckFingerprint: SHA256_FINGERPRINT.test(finalCheckFingerprint) ? finalCheckFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT,
    acceptanceReportFingerprint: SHA256_FINGERPRINT.test(finalCheck?.acceptanceReportFingerprint || "") ? finalCheck.acceptanceReportFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT,
    corpusReportFingerprint: SHA256_FINGERPRINT.test(finalCheck?.corpusReportFingerprint || "") ? finalCheck.corpusReportFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT,
    evidenceSourcesFingerprint: TEMPLATE_PLACEHOLDER_FINGERPRINT,
    sourceFamilies: [...REQUIRED_SOURCE_FAMILIES],
    externalAdapterFamilies: [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    externalAdapterTargetFormatTokens: [...REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS],
    externalAdapterSourceAdapterKeys: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      [`replace-with-${family}-adapter-key`]
    ])),
    externalAdapterSourceAdapterRequestEvidenceFingerprints: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      [TEMPLATE_PLACEHOLDER_FINGERPRINT]
    ])),
    externalAdapterSourceAdapterConfigStatFingerprints: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      ["replace-with-stat-sha256-fingerprint"]
    ])),
    externalAdapterSourceAdapterRegistryAggregateFingerprints: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      [TEMPLATE_PLACEHOLDER_FINGERPRINT]
    ])),
    externalAdapterSourceAdapterRegistryFingerprints: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      [TEMPLATE_PLACEHOLDER_FINGERPRINT]
    ])),
    externalAdapterSourceAdapterPreflightFingerprints: Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
      family,
      [TEMPLATE_PLACEHOLDER_FINGERPRINT]
    ])),
    pointCloudFamilies: [...REQUIRED_POINT_CLOUD_FAMILIES],
    sourceEvidenceSemantics: {
      ...sourceEvidenceSemanticsProfilePayload(),
      artifactKinds: [...SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS],
      profileFingerprint: sourceEvidenceSemanticsProfileFingerprint()
    },
    evidenceItems: [
      ...REQUIRED_SOURCE_FAMILIES.map((family) => templateItem("private-source-family", family, TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, `${family}-private-source`)),
      ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => templateItem("external-adapter-preflight", family, TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, `${family}-adapter-preflight`)),
      ...REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => templateItem("external-adapter-source-adapter-assertion", family, TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, `${family}-source-adapter-assertion`)),
      ...REQUIRED_POINT_CLOUD_FAMILIES.map((family) => templateItem("point-cloud-family", family, TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, `${family}-point-cloud-evidence`)),
      templateItem("promoted-import-corpus-report", "", SHA256_FINGERPRINT.test(finalCheck?.corpusReportFingerprint || "") ? finalCheck.corpusReportFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, "promoted-import-corpus-report"),
      templateItem("fingerprint-pinned-verifier-output", "", SHA256_FINGERPRINT.test(finalCheck?.acceptanceReportFingerprint || "") ? finalCheck.acceptanceReportFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, "fingerprint-pinned-verifier-output"),
      templateItem("final-acceptance-check-report", "", SHA256_FINGERPRINT.test(finalCheckFingerprint) ? finalCheckFingerprint : TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, "final-acceptance-check-report"),
      templateItem("disposable-project-copy", "", TEMPLATE_PLACEHOLDER_FINGERPRINT, REQUIRED_SOURCE_FAMILIES.length, "disposable-project-copies"),
      templateItem("promoted-reference-manifest", "", TEMPLATE_PLACEHOLDER_FINGERPRINT, REQUIRED_SOURCE_FAMILIES.length, "promoted-reference-manifests"),
      templateItem("point-cloud-chunk-sidecar", "", TEMPLATE_PLACEHOLDER_FINGERPRINT, 1, "point-cloud-chunk-sidecars")
    ]
  };
}

function failureOutput(options = {}, failures = []) {
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    finalAcceptanceCheckPath: pathFreeInputFileName(options.finalAcceptanceCheckPath),
    evidenceManifestPath: pathFreeInputFileName(options.evidencePath),
    completionEvidenceCheckPath: pathFreeInputFileName(options.outputPath),
    evidenceSourcesFingerprint: "",
    finalAcceptanceCheckFingerprint: "",
    acceptanceReportFingerprint: "",
    corpusReportFingerprint: "",
    gates: {
      finalAcceptanceCheckShapeOk: false,
      finalAcceptanceCheckAcceptedOk: false,
      finalAcceptanceCheckAcceptedVerifierValuePolicyOk: false,
      finalAcceptanceCheckFingerprintMatchesManifest: false,
      expectedFinalAcceptanceCheckFingerprintMatches: null,
      completionEvidenceShapeOk: false,
      completionEvidenceValueShapeOk: false,
      requiredSourceFamilyEvidenceOk: false,
      requiredExternalAdapterEvidenceOk: false,
      requiredExternalAdapterSourceAdapterAssertionEvidenceOk: false,
      requiredPointCloudEvidenceOk: false,
      sourceAdapterEvidenceMatchesFinalAcceptanceCheck: false,
      reportFingerprintEvidenceOk: false,
      requiredArtifactKindsOk: false,
      artifactCountEvidenceOk: false,
      completionEvidenceOutputWritableOk: true
    },
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
      evidenceItemCount: 0,
      requiredArtifactKinds: REQUIRED_ARTIFACT_KINDS,
      requiredValuePolicy: valuePolicy(),
      missingArtifactKinds: REQUIRED_ARTIFACT_KINDS,
      artifactCountMinimums: REQUIRED_ARTIFACT_COUNT_MINIMUMS.map((entry) => ({
        kind: entry.kind,
        family: entry.family,
        minCount: entry.minCount,
        reason: entry.reason
      })),
      insufficientArtifactCounts: REQUIRED_ARTIFACT_COUNT_MINIMUMS.map((entry) => `${entry.kind}:${entry.family || "all"}:${entry.minCount}`)
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

function markCompletionEvidenceOutputUnwritable(report) {
  report.gates.completionEvidenceOutputWritableOk = false;
  report.ok = false;
  if (!report.failures.includes("completionEvidenceOutputWritableOk failed")) {
    report.failures.push("completionEvidenceOutputWritableOk failed");
  }
  return report;
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
  const finalCheckFile = readJsonFile(options.finalAcceptanceCheckPath, "final acceptance check");
  if (options.printEvidenceTemplate) {
    if (finalCheckFile.failures.length > 0) {
      const report = failureOutput(options, finalCheckFile.failures);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 1;
    }
    if (!finalAcceptanceCheckAcceptedOk(finalCheckFile.value)) {
      const report = failureOutput(options, ["final acceptance check must be accepted before printing completion evidence template"]);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 1;
    }
    process.stdout.write(`${JSON.stringify(completionEvidenceTemplate(finalCheckFile.value, finalCheckFile.fingerprint), null, 2)}\n`);
    return 0;
  }
  const evidenceFile = readJsonFile(options.evidencePath, "completion evidence manifest");
  const loadFailures = [...finalCheckFile.failures, ...evidenceFile.failures];
  const report = loadFailures.length > 0
    ? failureOutput(options, loadFailures)
    : verifyCompletionEvidence(finalCheckFile.value, finalCheckFile.fingerprint, evidenceFile.value, options);
  if (!writeReport(options.outputPath, report)) {
    markCompletionEvidenceOutputUnwritable(report);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = failureOutput(activeOptions, [error?.message === "Unknown option." ? "Unknown option." : "reference import completion evidence check failed"]);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
