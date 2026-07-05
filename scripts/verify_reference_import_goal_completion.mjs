#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_ID = "referenceImportGoalCompletionAudit";
const CHECK_VERSION = "0.1.0";
const FINAL_PROOF_BUNDLE_CHECK_ID = "referenceImportFinalProofBundleCheck";
const LOCAL_PROOF_READY_PERCENT = 99.996;
const FINAL_PRIVATE_PROOF_PERCENT = 0.004;
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
const FINAL_PROOF_BUNDLE_FIELDS = [
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
const FINAL_PROOF_BUNDLE_GATE_FIELDS = [
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
const FINAL_PROOF_BUNDLE_SUMMARY_FIELDS = [
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
const FINAL_PROOF_BUNDLE_ACCEPTANCE_FAILURE_FIELDS = [
  "finalProofBundleIdentityOk",
  "finalProofBundleAllGatesOk",
  "finalProofBundlePathFreeBundleValuesOk",
  "finalProofBundleFingerprintsOk",
  "finalProofBundleInputPathsOk",
  "finalProofBundleSavedPathOk",
  "finalProofBundlePathPrivacyOk",
  "finalProofBundleSourceFamiliesOk",
  "finalProofBundleExternalAdapterFamiliesOk",
  "finalProofBundleExternalAdapterTargetFormatTokensOk",
  "finalProofBundleExternalAdapterPreflightEvidenceFamiliesOk",
  "finalProofBundleNoMissingExternalAdapterPreflightEvidenceFamiliesOk",
  "finalProofBundleSourceAdapterAssertionFamiliesOk",
  "finalProofBundleNoMissingSourceAdapterAssertionFamiliesOk",
  "finalProofBundleSourceAdapterKeysOk",
  "finalProofBundleSourceAdapterRequestEvidenceFingerprintsOk",
  "finalProofBundleSourceAdapterConfigStatFingerprintsOk",
  "finalProofBundleSourceAdapterRegistryAggregateFingerprintsOk",
  "finalProofBundleSourceAdapterRegistryFingerprintsOk",
  "finalProofBundleSourceAdapterPreflightFingerprintsOk",
  "finalProofBundlePointCloudFamiliesOk",
  "finalProofBundleSourceEvidenceSemanticsOk",
  "finalProofBundleProofPlanFingerprintOk",
  "finalProofBundleFinalAcceptanceAcceptedVerifierValuePolicyOk",
  "finalProofBundleCompletionEvidenceRequiredValuePolicyOk",
  "finalProofBundleCompletionEvidenceArtifactPolicyOk",
  "finalProofBundleEvidenceSourcesFingerprintAlignedOk",
  "finalProofBundleSourceAdapterEvidenceAlignedAcrossInputReportsOk",
  "finalProofBundleRequiredTargetFormatTokensOk",
  "finalProofBundleRequiredExternalAdapterTargetFormatTokensOk",
  "finalProofBundleRequiredPointCloudTargetFormatTokensOk",
  "finalProofBundleRequiredFamilySummariesOk",
  "finalProofBundleRequiredSourceEvidenceSemanticsProfileOk",
  "finalProofBundleRequiredInputReportsOk",
  "finalProofBundleRequiredFingerprintPinsOk",
  "finalProofBundleRequiredSavedInputReportGatesOk",
  "finalProofBundleRequiredCrossReportGatesOk",
  "finalProofBundleRequiredValuePolicyOk",
  "finalProofBundleRequiredCompletionArtifactKindsOk",
  "finalProofBundleRequiredCompletionArtifactCountMinimumsOk",
  "finalProofBundleEvidenceCountsOk",
  "finalProofBundleEvidenceCountDeficitsOk",
  "finalProofBundleRequiredEvidenceMinimumsOk",
  "finalProofBundleMissingEvidenceListsOk",
  "finalProofBundleNoFailedGateFieldsOk",
  "finalProofBundleNoFailuresOrWarningsOk"
];
const FINAL_PROOF_BUNDLE_PATH_PRIVACY_FAILURE_FIELDS = [
  "finalProofBundleInputPathsOk",
  "finalProofBundleSavedPathOk",
  "finalProofBundlePathPrivacyOk"
];
const OUTPUT_FIELDS = [
  "id",
  "version",
  "ok",
  "finalProofBundleCheckPath",
  "goalCompletionAuditPath",
  "finalProofBundleCheckFingerprint",
  "completedPercent",
  "remainingPercent",
  "gates",
  "summary",
  "failures",
  "warnings"
];
const GATE_FIELDS = [
  "finalProofBundleCheckReadableOk",
  "finalProofBundleCheckShapeOk",
  "finalProofBundleCheckAcceptedOk",
  "expectedFinalProofBundleCheckFingerprintMatches",
  "completionEvidenceReadyOk",
  "goalCompletionOutputWritableOk"
];
const SUMMARY_FIELDS = [
  "completionBasis",
  "completedPercent",
  "remainingPercent",
  "completedAreas",
  "remainingAreas",
  "remainingGateFailures",
  "finalProofBundleFailedGateFields",
  "finalProofBundleAcceptanceFailures",
  "requiredFinalEvidence",
  "finalProofBundleRequiredTargetFormatTokens",
  "finalProofBundleRequiredExternalAdapterTargetFormatTokens",
  "finalProofBundleRequiredPointCloudTargetFormatTokens",
  "finalProofBundleRequiredFamilySummaries",
  "finalProofBundleRequiredSourceEvidenceSemanticsProfile",
  "finalProofBundleRequiredInputReports",
  "finalProofBundleRequiredFingerprintPins",
  "finalProofBundleRequiredSavedInputReportGates",
  "finalProofBundleRequiredCrossReportGates",
  "finalProofBundleRequiredValuePolicy",
  "finalProofBundleRequiredCompletionArtifactKinds",
  "finalProofBundleRequiredCompletionArtifactCountMinimums",
  "finalProofBundleCheckFingerprint",
  "proofChainFingerprints",
  "evidenceCounts",
  "evidenceCountDeficits",
  "finalProofBundleMissingSourceItems",
  "finalProofBundleInsufficientSourceCounts",
  "finalProofBundleMissingCompletionArtifactKinds",
  "finalProofBundleInsufficientCompletionArtifactCounts",
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
  "proofPlanFingerprint"
];
const PROOF_CHAIN_FINGERPRINT_FIELDS = [
  "finalProofBundleCheckFingerprint",
  "finalAcceptanceCheckFingerprint",
  "sourceCheckFingerprint",
  "completionEvidenceCheckFingerprint",
  "evidenceSourcesFingerprint",
  "acceptanceReportFingerprint",
  "corpusReportFingerprint"
];
const EVIDENCE_COUNT_FIELDS = [
  "sourceItemCount",
  "minSourceItemCount",
  "evidenceItemCount",
  "minEvidenceItemCount",
  "completionEvidenceItemCount",
  "minCompletionEvidenceItemCount"
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
const FINAL_PROOF_BUNDLE_PATH_PRIVACY_FIELDS = [
  "finalAcceptanceCheckPath",
  "sourceCheckPath",
  "completionEvidenceCheckPath",
  "proofBundleReportPath"
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
const REQUIRED_FINAL_EVIDENCE = [
  "accepted final proof bundle check report with bundleOutputWritableOk",
  "final proof bundle with accepted DWG/E57 adapter preflight completion evidence",
  "final proof bundle with accepted DWG/E57 sourceAdapter assertion completion evidence",
  "final proof bundle with finalAcceptanceCheckAcceptedVerifierValuePolicyOk proving final-acceptance verifier value policy",
  "final proof bundle with completionEvidenceRequiredValuePolicyOk proving completion-evidence value policy",
  "final proof bundle with proofPlanFingerprint proving final private proof-plan shape",
  "final proof bundle with sourceEvidenceSemantics profile proving semantic completion-evidence builder coverage",
  "final proof bundle with evidenceSourcesFingerprintAlignedOk proving source-check/completion-evidence source manifest linkage",
  "final proof bundle with sourceAdapterEvidenceAlignedAcrossInputReportsOk proving final-acceptance/completion-evidence sourceAdapter map linkage",
  "final proof bundle with requiredTargetFormatTokens proving DXF/DWG/STEP/IFC/e57pointcloud target policy",
  "final proof bundle with requiredExternalAdapterTargetFormatTokens proving DWG/e57pointcloud adapter-backed target policy",
  "final proof bundle with requiredPointCloudTargetFormatTokens proving e57pointcloud remains the point-cloud target token",
  "final proof bundle with requiredFamilySummaries proving DXF/DWG/STEP/IFC/E57 family policy",
  "final proof bundle with requiredSourceEvidenceSemanticsProfile proving semantic evidence profile policy",
  "final proof bundle with requiredInputReports proving saved input report identities",
  "final proof bundle with requiredFingerprintPins proving saved input report fingerprint pin policy",
  "final proof bundle with requiredSavedInputReportGates proving upstream saved-report gate policy",
  "final proof bundle with requiredCrossReportGates proving saved-report linkage policy",
  "final proof bundle with requiredCompletionArtifactKinds proving completion-evidence artifact-kind policy",
  "final proof bundle with requiredCompletionArtifactCountMinimums proving completion-evidence artifact-count policy",
  "final proof bundle with pathFreeBundleValuesOk proving path-free proof bundle value policy",
  "final proof bundle with finalProofBundleInputPathsOk proving saved input report paths are path-free",
  "final proof bundle with finalProofBundlePathPrivacyOk proving all saved proof-bundle path fields are path-free",
  "final proof bundle evidence counts meeting 13/16/16 requiredEvidenceMinimums",
  "expected final proof bundle check fingerprint",
  "saved goal completion audit report with goalCompletionOutputWritableOk"
];
const COMPLETED_AREA_VALUES = [
  "isolated source-neutral reference geometry JSON boundary",
  "viewer/runtime reads canonical reference JSON instead of source formats",
  "DXF/DWG/STEP/IFC/E57 corpus proof tooling",
  "external DWG/E57 adapter proof boundary",
  "DWG/E57 adapter preflight evidence gates",
  "DWG/E57 sourceAdapter assertion evidence gates",
  "path-free completion evidence and final proof bundle checks"
];
const COMPLETION_BASIS = {
  complete: "accepted fingerprint-pinned final proof bundle check plus saved goal completion audit output proves the private reference import goal",
  pathMetadataRepairRequired: "accepted private proof content is present; path-free final proof bundle report path metadata is still required",
  acceptedBundleAwaitingAuditOutput: "accepted fingerprint-pinned final proof bundle is ready; saved goal completion audit output is still required",
  acceptedBundleAwaitingPinOrOutput: "accepted final proof bundle is present; fingerprint pinning or saved audit output is still required",
  localProofReady: "local implementation and proof tooling are ready; final private proof evidence is still required"
};
const COMPLETION_BASIS_VALUES = Object.values(COMPLETION_BASIS);
const REMAINING_AREAS = {
  finalProofBundle: "accepted private DXF/DWG/STEP/IFC/E57 final proof bundle",
  realAdapterEvidence: "real DWG/E57 adapter preflight and sourceAdapter assertion evidence",
  finalProofBundlePathMetadata: "path-free final proof bundle report path metadata",
  expectedFingerprint: "expected final proof bundle check fingerprint",
  savedGoalCompletionAudit: "saved goal completion audit generated from a fingerprint-pinned final proof bundle",
  acceptedFingerprintPinnedBundle: "accepted fingerprint-pinned final proof bundle"
};
const REMAINING_AREA_VALUES = Object.values(REMAINING_AREAS);

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_goal_completion.mjs --final-proof-bundle-check <final-proof-bundle-check.json> --expect-final-proof-bundle-check-fingerprint <sha256:hex> [options]",
    "",
    "Audits whether the reference import goal is complete without reading private source files, source manifests, corpus reports, projects, chunks, adapter configs, workflow runners, or external adapters.",
    "",
    "Options:",
    "  --final-proof-bundle-check <path>  Saved referenceImportFinalProofBundleCheck output.",
    "  --expect-final-proof-bundle-check-fingerprint <sha256:hex>  Require final proof bundle check bytes to match this fingerprint.",
    "  --output <path>                    Machine-readable JSON goal-completion audit path required for a 100 percent audit.",
    "  --list-contract                    Print the goal-completion audit contract and exit.",
    "  --help                             Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    finalProofBundleCheckPath: "",
    expectedFinalProofBundleCheckFingerprint: "",
    outputPath: "",
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
    if (arg === "--final-proof-bundle-check") {
      options.finalProofBundleCheckPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-final-proof-bundle-check-fingerprint") {
      options.expectedFinalProofBundleCheckFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
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

function fingerprintValue(value, flag) {
  const text = String(value || "");
  if (!SHA256_FINGERPRINT.test(text)) {
    throw new Error(`${flag} must be sha256:<64 lowercase hex>`);
  }
  return text;
}

function contract() {
  return {
    id: "referenceImportGoalCompletionAuditContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    inputBoundary: {
      readsSavedFinalProofBundleCheckOnly: true,
      readsSavedFinalAcceptanceCheck: false,
      readsSavedCompletionEvidenceSourceCheck: false,
      readsSavedCompletionEvidenceCheck: false,
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
    requiredInputReports: {
      finalProofBundleCheckId: FINAL_PROOF_BUNDLE_CHECK_ID
    },
    progressPolicy: {
      localProofReadyPercentWithoutPrivateEvidence: LOCAL_PROOF_READY_PERCENT,
      finalPrivateProofPercent: FINAL_PRIVATE_PROOF_PERCENT,
    completionRequiresAcceptedFinalProofBundleCheck: true,
    completionRequiresFinalProofBundleCheckFingerprintPin: true,
    completionRequiresSavedAuditOutput: true,
    completionRequiresAuditOutputGate: true
    },
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      remainingGateFailureFields: GATE_FIELDS,
      summaryFields: SUMMARY_FIELDS,
      finalProofBundleCheckFields: FINAL_PROOF_BUNDLE_FIELDS,
      finalProofBundleGateFields: FINAL_PROOF_BUNDLE_GATE_FIELDS,
      finalProofBundleSummaryFields: FINAL_PROOF_BUNDLE_SUMMARY_FIELDS,
      finalProofBundleAcceptanceFailureFields: FINAL_PROOF_BUNDLE_ACCEPTANCE_FAILURE_FIELDS,
      proofChainFingerprintFields: PROOF_CHAIN_FINGERPRINT_FIELDS,
      evidenceCountFields: EVIDENCE_COUNT_FIELDS,
      evidenceCountDeficitFields: EVIDENCE_COUNT_DEFICIT_FIELDS,
      finalProofBundleMissingEvidenceListFields: FINAL_PROOF_BUNDLE_MISSING_EVIDENCE_LIST_FIELDS,
      finalProofBundlePathPrivacyFields: FINAL_PROOF_BUNDLE_PATH_PRIVACY_FIELDS,
      finalProofBundlePathPrivacyGateField: "finalProofBundlePathPrivacyOk",
      completedAreaValues: COMPLETED_AREA_VALUES,
      completionBasisValues: COMPLETION_BASIS_VALUES,
      remainingAreaValues: REMAINING_AREA_VALUES,
      sourceEvidenceSemanticsProfileId: SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID,
      sourceEvidenceSemanticsProfileFingerprint: sourceEvidenceSemanticsProfileFingerprint(),
      sourceEvidenceSemanticArtifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
      requiredFinalProofBundleTargetFormatTokens: requiredTargetFormatTokens(),
      requiredFinalProofBundleExternalAdapterTargetFormatTokens: requiredExternalAdapterTargetFormatTokens(),
      requiredFinalProofBundlePointCloudTargetFormatTokens: requiredPointCloudTargetFormatTokens(),
      requiredFinalProofBundleFamilySummaries: requiredFamilySummaries(),
      requiredFinalProofBundleSourceEvidenceSemanticsProfile: requiredSourceEvidenceSemanticsProfile(),
      requiredFinalProofBundleInputReports: requiredInputReports(),
      requiredFinalProofBundleFingerprintPins: requiredFingerprintPins(),
      requiredFinalProofBundleSavedInputReportGateFields: REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS,
      requiredFinalProofBundleSavedInputReportGates: requiredSavedInputReportGates(),
      requiredFinalProofBundleCrossReportGateFields: REQUIRED_CROSS_REPORT_GATE_FIELDS,
      requiredFinalProofBundleCrossReportGates: requiredCrossReportGates(),
      requiredFinalProofBundleValuePolicy: requiredFinalProofBundleValuePolicy(),
      requiredFinalProofBundleCompletionArtifactKinds: requiredCompletionArtifactKinds(),
      requiredFinalProofBundleCompletionArtifactCountMinimums: requiredCompletionArtifactCountMinimums(),
      sourceAdapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
      },
      requiredFinalEvidence: REQUIRED_FINAL_EVIDENCE,
      requiredEvidenceMinimums: {
        minSourceItemCount: MIN_SOURCE_ITEM_COUNT,
        minEvidenceItemCount: MIN_EVIDENCE_ITEM_COUNT,
        minCompletionEvidenceItemCount: MIN_COMPLETION_EVIDENCE_ITEM_COUNT
      },
      goalCompletionAuditOutputPathField: "goalCompletionAuditPath",
      pathPrivacyFields: ["finalProofBundleCheckPath", "goalCompletionAuditPath"]
    },
    cliFlags: ["--final-proof-bundle-check", "--expect-final-proof-bundle-check-fingerprint", "--output", "--list-contract", "--help"]
  };
}

function pathFreeInputFileName(value = "") {
  const base = path.basename(String(value || "").replace(/\\/g, "/"));
  return SAFE_LABEL.test(base) ? base : "";
}

function safeLabel(value = "") {
  const text = String(value || "");
  return SAFE_LABEL.test(text) && !/[\\/:]/.test(text) && !text.includes("..");
}

function safeRequirementToken(value = "") {
  return SAFE_REQUIREMENT_TOKEN.test(String(value || ""));
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
    builderId: "referenceImportCompletionEvidenceBuilder",
    builderVersion: CHECK_VERSION,
    gate: "sourceEvidenceSemanticsOk",
    mode: SOURCE_EVIDENCE_SEMANTICS_MODE,
    artifactKinds: SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS,
    sourceAdapterKeyPolicy: sourceAdapterKeyPolicy()
  };
}

function requiredFinalProofBundleValuePolicy() {
  return {
    pathFreeGateField: "pathFreeBundleValuesOk",
    protectedInputReports: ["referenceImportFinalAcceptanceCheck", "referenceImportCompletionEvidenceSourceCheck", "referenceImportCompletionEvidenceCheck"],
    acceptsRawPrivatePaths: false,
    acceptsRawPrivatePayloads: false,
    allowedValueKinds: ["safe-label", "safe-requirement-token", "known-family-token", "known-target-token", "sha256-fingerprint", "stat-sha256-fingerprint", "safe-integer", "boolean", "null", "empty-string"],
    allowedSourceAdapterKeyPolicyPaths: ["summary.acceptedVerifierValuePolicy.sourceAdapterKeyPolicy"]
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

function requiredEvidenceMinimumsOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 3
    && value.minSourceItemCount === MIN_SOURCE_ITEM_COUNT
    && value.minEvidenceItemCount === MIN_EVIDENCE_ITEM_COUNT
    && value.minCompletionEvidenceItemCount === MIN_COMPLETION_EVIDENCE_ITEM_COUNT;
}

function requiredCompletionArtifactKinds() {
  return [...REQUIRED_COMPLETION_ARTIFACT_KINDS];
}

function requiredCompletionArtifactKindsOk(value = []) {
  return sameStrings(value, requiredCompletionArtifactKinds());
}

function safeRequiredCompletionArtifactKinds(value = []) {
  const expected = new Set(REQUIRED_COMPLETION_ARTIFACT_KINDS);
  return Array.isArray(value) ? value.filter((kind) => expected.has(kind)) : [];
}

function requiredCompletionArtifactCountMinimums() {
  return REQUIRED_COMPLETION_ARTIFACT_COUNT_MINIMUMS.map((entry) => ({ ...entry }));
}

function requiredCompletionArtifactCountMinimumsOk(value = []) {
  return JSON.stringify(value) === JSON.stringify(requiredCompletionArtifactCountMinimums());
}

function safeRequiredCompletionArtifactCountMinimums(value = []) {
  return requiredCompletionArtifactCountMinimumsOk(value) ? requiredCompletionArtifactCountMinimums() : [];
}

function requiredTargetFormatTokens() {
  return [...REQUIRED_TARGET_FORMAT_TOKENS];
}

function requiredTargetFormatTokensOk(value = []) {
  return sameStrings(value, requiredTargetFormatTokens());
}

function requiredExternalAdapterTargetFormatTokens() {
  return [...REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS];
}

function requiredExternalAdapterTargetFormatTokensOk(value = []) {
  return sameStrings(value, requiredExternalAdapterTargetFormatTokens());
}

function requiredPointCloudTargetFormatTokens() {
  return [...REQUIRED_POINT_CLOUD_TARGET_FORMAT_TOKENS];
}

function requiredPointCloudTargetFormatTokensOk(value = []) {
  return sameStrings(value, requiredPointCloudTargetFormatTokens());
}

function safeRequiredTargetFormatTokens(value = []) {
  const expected = new Set(REQUIRED_TARGET_FORMAT_TOKENS);
  return Array.isArray(value) ? value.filter((token) => expected.has(token)) : [];
}

function safeRequiredExternalAdapterTargetFormatTokens(value = []) {
  const expected = new Set(REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS);
  return Array.isArray(value) ? value.filter((token) => expected.has(token)) : [];
}

function safeRequiredPointCloudTargetFormatTokens(value = []) {
  const expected = new Set(REQUIRED_POINT_CLOUD_TARGET_FORMAT_TOKENS);
  return Array.isArray(value) ? value.filter((token) => expected.has(token)) : [];
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

function requiredFamilySummariesOk(value = {}) {
  const expected = requiredFamilySummaries();
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 7
    && sameStrings(value.sourceFamilies, expected.sourceFamilies)
    && sameStrings(value.externalAdapterFamilies, expected.externalAdapterFamilies)
    && sameStrings(value.externalAdapterPreflightEvidenceFamilies, expected.externalAdapterPreflightEvidenceFamilies)
    && sameStrings(value.missingExternalAdapterPreflightEvidenceFamilies, expected.missingExternalAdapterPreflightEvidenceFamilies)
    && sameStrings(value.externalAdapterSourceAdapterAssertionFamilies, expected.externalAdapterSourceAdapterAssertionFamilies)
    && sameStrings(value.missingExternalAdapterSourceAdapterAssertionFamilies, expected.missingExternalAdapterSourceAdapterAssertionFamilies)
    && sameStrings(value.pointCloudFamilies, expected.pointCloudFamilies);
}

function safeRequiredFamilySummaries(value = {}) {
  if (requiredFamilySummariesOk(value)) return requiredFamilySummaries();
  return {
    sourceFamilies: Array.isArray(value?.sourceFamilies) ? value.sourceFamilies.filter((family) => REQUIRED_SOURCE_FAMILIES.includes(family)) : [],
    externalAdapterFamilies: Array.isArray(value?.externalAdapterFamilies) ? value.externalAdapterFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
    externalAdapterPreflightEvidenceFamilies: Array.isArray(value?.externalAdapterPreflightEvidenceFamilies) ? value.externalAdapterPreflightEvidenceFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
    missingExternalAdapterPreflightEvidenceFamilies: Array.isArray(value?.missingExternalAdapterPreflightEvidenceFamilies) ? value.missingExternalAdapterPreflightEvidenceFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
    externalAdapterSourceAdapterAssertionFamilies: Array.isArray(value?.externalAdapterSourceAdapterAssertionFamilies) ? value.externalAdapterSourceAdapterAssertionFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
    missingExternalAdapterSourceAdapterAssertionFamilies: Array.isArray(value?.missingExternalAdapterSourceAdapterAssertionFamilies) ? value.missingExternalAdapterSourceAdapterAssertionFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) : [],
    pointCloudFamilies: Array.isArray(value?.pointCloudFamilies) ? value.pointCloudFamilies.filter((family) => REQUIRED_POINT_CLOUD_FAMILIES.includes(family)) : []
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

function requiredSourceEvidenceSemanticsProfileOk(value = {}) {
  const expected = requiredSourceEvidenceSemanticsProfile();
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 4
    && value.sourceEvidenceSemanticsProfileId === expected.sourceEvidenceSemanticsProfileId
    && value.sourceEvidenceSemanticsProfileFingerprint === expected.sourceEvidenceSemanticsProfileFingerprint
    && sameStrings(value.sourceEvidenceSemanticArtifactKinds, expected.sourceEvidenceSemanticArtifactKinds)
    && JSON.stringify(value.sourceAdapterKeyPolicy) === JSON.stringify(expected.sourceAdapterKeyPolicy);
}

function safeRequiredSourceEvidenceSemanticsProfile(value = {}) {
  if (requiredSourceEvidenceSemanticsProfileOk(value)) return requiredSourceEvidenceSemanticsProfile();
  return {
    sourceEvidenceSemanticsProfileId: value?.sourceEvidenceSemanticsProfileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID ? SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID : "",
    sourceEvidenceSemanticsProfileFingerprint: SHA256_FINGERPRINT.test(value?.sourceEvidenceSemanticsProfileFingerprint || "") ? value.sourceEvidenceSemanticsProfileFingerprint : "",
    sourceEvidenceSemanticArtifactKinds: Array.isArray(value?.sourceEvidenceSemanticArtifactKinds)
      ? value.sourceEvidenceSemanticArtifactKinds.filter((kind) => SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS.includes(kind))
      : []
  };
}

function requiredInputReports() {
  return {
    finalAcceptanceCheckId: "referenceImportFinalAcceptanceCheck",
    sourceCheckId: "referenceImportCompletionEvidenceSourceCheck",
    completionEvidenceCheckId: "referenceImportCompletionEvidenceCheck"
  };
}

function requiredInputReportsOk(value = {}) {
  const expected = requiredInputReports();
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 3
    && value.finalAcceptanceCheckId === expected.finalAcceptanceCheckId
    && value.sourceCheckId === expected.sourceCheckId
    && value.completionEvidenceCheckId === expected.completionEvidenceCheckId;
}

function safeRequiredInputReports(value = {}) {
  const expected = requiredInputReports();
  return {
    finalAcceptanceCheckId: value?.finalAcceptanceCheckId === expected.finalAcceptanceCheckId ? expected.finalAcceptanceCheckId : "",
    sourceCheckId: value?.sourceCheckId === expected.sourceCheckId ? expected.sourceCheckId : "",
    completionEvidenceCheckId: value?.completionEvidenceCheckId === expected.completionEvidenceCheckId ? expected.completionEvidenceCheckId : ""
  };
}

function requiredFingerprintPins() {
  return [
    "--expect-final-acceptance-check-fingerprint",
    "--expect-source-check-fingerprint",
    "--expect-completion-evidence-check-fingerprint"
  ];
}

function requiredFingerprintPinsOk(value = []) {
  return sameStrings(value, requiredFingerprintPins());
}

function safeRequiredFingerprintPins(value = []) {
  const expected = requiredFingerprintPins();
  return Array.isArray(value) ? value.filter((entry) => expected.includes(entry)) : [];
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

function requiredSavedInputReportGatesOk(value = {}) {
  const expected = requiredSavedInputReportGates();
  return exactObjectFieldsOk(value, REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS)
    && REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS.every((field) => sameStrings(value[field], expected[field]));
}

function safeRequiredSavedInputReportGates(value = {}) {
  if (requiredSavedInputReportGatesOk(value)) return requiredSavedInputReportGates();
  return REQUIRED_SAVED_INPUT_REPORT_GATE_FIELDS.reduce((accumulator, field) => {
    const entries = Array.isArray(value?.[field]) ? value[field] : [];
    accumulator[field] = entries.filter((entry) => FINAL_PROOF_BUNDLE_GATE_FIELDS.includes(entry));
    return accumulator;
  }, {});
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

function requiredCrossReportGatesOk(value = {}) {
  const expected = requiredCrossReportGates();
  return exactObjectFieldsOk(value, REQUIRED_CROSS_REPORT_GATE_FIELDS)
    && REQUIRED_CROSS_REPORT_GATE_FIELDS.every((field) => sameStrings(value[field], expected[field]));
}

function safeRequiredCrossReportGates(value = {}) {
  if (requiredCrossReportGatesOk(value)) return requiredCrossReportGates();
  return REQUIRED_CROSS_REPORT_GATE_FIELDS.reduce((accumulator, field) => {
    const entries = Array.isArray(value?.[field]) ? value[field] : [];
    accumulator[field] = entries.filter((entry) => FINAL_PROOF_BUNDLE_GATE_FIELDS.includes(entry));
    return accumulator;
  }, {});
}

function requiredFinalProofBundleValuePolicyOk(value = {}) {
  return JSON.stringify(value) === JSON.stringify(requiredFinalProofBundleValuePolicy());
}

function safeRequiredFinalProofBundleValuePolicy(value = {}) {
  return requiredFinalProofBundleValuePolicyOk(value)
    ? requiredFinalProofBundleValuePolicy()
    : {
      pathFreeGateField: "",
      protectedInputReports: [],
      acceptsRawPrivatePaths: null,
      acceptsRawPrivatePayloads: null,
      allowedValueKinds: [],
      allowedSourceAdapterKeyPolicyPaths: []
    };
}

function evidenceCountDeficitsFromCounts(sourceItemCount, evidenceItemCount, completionEvidenceItemCount) {
  return {
    sourceItemCountDeficit: Math.max(0, MIN_SOURCE_ITEM_COUNT - safeCount(sourceItemCount)),
    evidenceItemCountDeficit: Math.max(0, MIN_EVIDENCE_ITEM_COUNT - safeCount(evidenceItemCount)),
    completionEvidenceItemCountDeficit: Math.max(0, MIN_COMPLETION_EVIDENCE_ITEM_COUNT - safeCount(completionEvidenceItemCount))
  };
}

function evidenceCountDeficitsOk(summary = {}) {
  const expected = evidenceCountDeficitsFromCounts(
    summary?.sourceItemCount,
    summary?.evidenceItemCount,
    summary?.completionEvidenceItemCount
  );
  const actual = summary?.evidenceCountDeficits;
  return exactObjectFieldsOk(actual, EVIDENCE_COUNT_DEFICIT_FIELDS)
    && EVIDENCE_COUNT_DEFICIT_FIELDS.every((field) => actual[field] === expected[field]);
}

function finalProofBundleCheckShapeOk(report = {}) {
  return exactObjectFieldsOk(report, FINAL_PROOF_BUNDLE_FIELDS)
    && exactObjectFieldsOk(report?.gates, FINAL_PROOF_BUNDLE_GATE_FIELDS)
    && exactObjectFieldsOk(report?.summary, FINAL_PROOF_BUNDLE_SUMMARY_FIELDS);
}

function savedReportPathOk(value = "") {
  return typeof value === "string"
    && value.length > 0
    && pathFreeInputFileName(value) === value;
}

function finalProofBundleAcceptanceChecks(report = {}) {
  const gates = report?.gates || {};
  const summary = report?.summary || {};
  const finalProofBundleInputPathsOk = savedReportPathOk(report?.finalAcceptanceCheckPath)
    && savedReportPathOk(report?.sourceCheckPath)
    && savedReportPathOk(report?.completionEvidenceCheckPath);
  const finalProofBundleSavedPathOk = savedReportPathOk(report?.proofBundleReportPath);
  return {
    finalProofBundleIdentityOk: report?.id === FINAL_PROOF_BUNDLE_CHECK_ID
      && report?.version === CHECK_VERSION
      && report?.ok === true,
    finalProofBundleAllGatesOk: FINAL_PROOF_BUNDLE_GATE_FIELDS.every((field) => gates[field] === true),
    finalProofBundlePathFreeBundleValuesOk: gates.pathFreeBundleValuesOk === true,
    finalProofBundleFingerprintsOk: SHA256_FINGERPRINT.test(report?.finalAcceptanceCheckFingerprint || "")
      && SHA256_FINGERPRINT.test(report?.sourceCheckFingerprint || "")
      && SHA256_FINGERPRINT.test(report?.completionEvidenceCheckFingerprint || "")
      && SHA256_FINGERPRINT.test(report?.evidenceSourcesFingerprint || "")
      && SHA256_FINGERPRINT.test(report?.acceptanceReportFingerprint || "")
      && SHA256_FINGERPRINT.test(report?.corpusReportFingerprint || ""),
    finalProofBundleInputPathsOk,
    finalProofBundleSavedPathOk,
    finalProofBundlePathPrivacyOk: finalProofBundleInputPathsOk && finalProofBundleSavedPathOk,
    finalProofBundleSourceFamiliesOk: sameStrings(summary?.sourceFamilies, REQUIRED_SOURCE_FAMILIES),
    finalProofBundleExternalAdapterFamiliesOk: sameStrings(summary?.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES),
    finalProofBundleExternalAdapterTargetFormatTokensOk: sameStrings(summary?.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS),
    finalProofBundleExternalAdapterPreflightEvidenceFamiliesOk: sameStrings(summary?.externalAdapterPreflightEvidenceFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES),
    finalProofBundleNoMissingExternalAdapterPreflightEvidenceFamiliesOk: sameStrings(summary?.missingExternalAdapterPreflightEvidenceFamilies, []),
    finalProofBundleSourceAdapterAssertionFamiliesOk: sameStrings(summary?.externalAdapterSourceAdapterAssertionFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES),
    finalProofBundleNoMissingSourceAdapterAssertionFamiliesOk: sameStrings(summary?.missingExternalAdapterSourceAdapterAssertionFamilies, []),
    finalProofBundleSourceAdapterKeysOk: sourceAdapterKeysOk(summary?.externalAdapterSourceAdapterKeys),
    finalProofBundleSourceAdapterRequestEvidenceFingerprintsOk: sourceAdapterRequestEvidenceFingerprintsOk(summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints),
    finalProofBundleSourceAdapterConfigStatFingerprintsOk: sourceAdapterConfigStatFingerprintsOk(summary?.externalAdapterSourceAdapterConfigStatFingerprints),
    finalProofBundleSourceAdapterRegistryAggregateFingerprintsOk: sourceAdapterRegistryAggregateFingerprintsOk(summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints),
    finalProofBundleSourceAdapterRegistryFingerprintsOk: sourceAdapterRegistryFingerprintsOk(summary?.externalAdapterSourceAdapterRegistryFingerprints),
    finalProofBundleSourceAdapterPreflightFingerprintsOk: sourceAdapterPreflightFingerprintsOk(summary?.externalAdapterSourceAdapterPreflightFingerprints),
    finalProofBundlePointCloudFamiliesOk: sameStrings(summary?.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES),
    finalProofBundleSourceEvidenceSemanticsOk: summary?.sourceEvidenceSemanticsProfileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID
      && summary?.sourceEvidenceSemanticsProfileFingerprint === sourceEvidenceSemanticsProfileFingerprint()
      && sameStrings(summary?.sourceEvidenceSemanticArtifactKinds, SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS),
    finalProofBundleProofPlanFingerprintOk: summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT,
    finalProofBundleFinalAcceptanceAcceptedVerifierValuePolicyOk: gates.finalAcceptanceCheckAcceptedVerifierValuePolicyOk === true,
    finalProofBundleCompletionEvidenceRequiredValuePolicyOk: gates.completionEvidenceRequiredValuePolicyOk === true,
    finalProofBundleCompletionEvidenceArtifactPolicyOk: gates.completionEvidenceArtifactPolicyOk === true,
    finalProofBundleEvidenceSourcesFingerprintAlignedOk: gates.evidenceSourcesFingerprintAlignedOk === true,
    finalProofBundleSourceAdapterEvidenceAlignedAcrossInputReportsOk: gates.sourceAdapterEvidenceAlignedAcrossInputReportsOk === true,
    finalProofBundleRequiredTargetFormatTokensOk: requiredTargetFormatTokensOk(summary?.requiredTargetFormatTokens),
    finalProofBundleRequiredExternalAdapterTargetFormatTokensOk: requiredExternalAdapterTargetFormatTokensOk(summary?.requiredExternalAdapterTargetFormatTokens),
    finalProofBundleRequiredPointCloudTargetFormatTokensOk: requiredPointCloudTargetFormatTokensOk(summary?.requiredPointCloudTargetFormatTokens),
    finalProofBundleRequiredFamilySummariesOk: requiredFamilySummariesOk(summary?.requiredFamilySummaries),
    finalProofBundleRequiredSourceEvidenceSemanticsProfileOk: requiredSourceEvidenceSemanticsProfileOk(summary?.requiredSourceEvidenceSemanticsProfile),
    finalProofBundleRequiredInputReportsOk: requiredInputReportsOk(summary?.requiredInputReports),
    finalProofBundleRequiredFingerprintPinsOk: requiredFingerprintPinsOk(summary?.requiredFingerprintPins),
    finalProofBundleRequiredSavedInputReportGatesOk: requiredSavedInputReportGatesOk(summary?.requiredSavedInputReportGates),
    finalProofBundleRequiredCrossReportGatesOk: requiredCrossReportGatesOk(summary?.requiredCrossReportGates),
    finalProofBundleRequiredValuePolicyOk: requiredFinalProofBundleValuePolicyOk(summary?.requiredValuePolicy),
    finalProofBundleRequiredCompletionArtifactKindsOk: requiredCompletionArtifactKindsOk(summary?.requiredCompletionArtifactKinds),
    finalProofBundleRequiredCompletionArtifactCountMinimumsOk: requiredCompletionArtifactCountMinimumsOk(summary?.requiredCompletionArtifactCountMinimums),
    finalProofBundleEvidenceCountsOk: Number.isSafeInteger(summary?.sourceItemCount)
      && summary.sourceItemCount >= MIN_SOURCE_ITEM_COUNT
      && Number.isSafeInteger(summary?.evidenceItemCount)
      && summary.evidenceItemCount >= MIN_EVIDENCE_ITEM_COUNT
      && Number.isSafeInteger(summary?.completionEvidenceItemCount)
      && summary.completionEvidenceItemCount >= MIN_COMPLETION_EVIDENCE_ITEM_COUNT,
    finalProofBundleEvidenceCountDeficitsOk: evidenceCountDeficitsOk(summary),
    finalProofBundleRequiredEvidenceMinimumsOk: requiredEvidenceMinimumsOk(summary?.requiredEvidenceMinimums),
    finalProofBundleMissingEvidenceListsOk: Array.isArray(summary?.missingSourceItems)
      && summary.missingSourceItems.length === 0
      && Array.isArray(summary?.insufficientSourceCounts)
      && summary.insufficientSourceCounts.length === 0
      && Array.isArray(summary?.missingCompletionArtifactKinds)
      && summary.missingCompletionArtifactKinds.length === 0
      && Array.isArray(summary?.insufficientCompletionArtifactCounts)
      && summary.insufficientCompletionArtifactCounts.length === 0,
    finalProofBundleNoFailedGateFieldsOk: Array.isArray(summary?.failedGateFields)
      && summary.failedGateFields.length === 0,
    finalProofBundleNoFailuresOrWarningsOk: Array.isArray(report?.failures)
      && report.failures.length === 0
      && Array.isArray(report?.warnings)
      && report.warnings.length === 0
  };
}

function finalProofBundleAcceptanceFailures(report = {}) {
  const checks = finalProofBundleAcceptanceChecks(report);
  return FINAL_PROOF_BUNDLE_ACCEPTANCE_FAILURE_FIELDS.filter((field) => checks[field] !== true);
}

function finalProofBundleFailedGateFields(report = {}) {
  const summaryFields = Array.isArray(report?.summary?.failedGateFields) ? report.summary.failedGateFields : [];
  if (summaryFields.length > 0) {
    return FINAL_PROOF_BUNDLE_GATE_FIELDS.filter((field) => summaryFields.includes(field));
  }
  const gates = report?.gates || {};
  return FINAL_PROOF_BUNDLE_GATE_FIELDS.filter((field) => gates[field] !== true);
}

function finalProofBundleCheckAcceptedOk(report = {}) {
  return finalProofBundleAcceptanceFailures(report).length === 0;
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeFingerprint(value = "") {
  return SHA256_FINGERPRINT.test(value) ? value : "";
}

function proofChainFingerprintsSummary(proofReport = {}, finalProofBundleCheckFingerprint = "") {
  return {
    finalProofBundleCheckFingerprint: safeFingerprint(finalProofBundleCheckFingerprint),
    finalAcceptanceCheckFingerprint: safeFingerprint(proofReport?.finalAcceptanceCheckFingerprint || ""),
    sourceCheckFingerprint: safeFingerprint(proofReport?.sourceCheckFingerprint || ""),
    completionEvidenceCheckFingerprint: safeFingerprint(proofReport?.completionEvidenceCheckFingerprint || ""),
    evidenceSourcesFingerprint: safeFingerprint(proofReport?.evidenceSourcesFingerprint || ""),
    acceptanceReportFingerprint: safeFingerprint(proofReport?.acceptanceReportFingerprint || ""),
    corpusReportFingerprint: safeFingerprint(proofReport?.corpusReportFingerprint || "")
  };
}

function evidenceCountsSummary(report = {}) {
  return {
    sourceItemCount: safeCount(report?.summary?.sourceItemCount),
    minSourceItemCount: MIN_SOURCE_ITEM_COUNT,
    evidenceItemCount: safeCount(report?.summary?.evidenceItemCount),
    minEvidenceItemCount: MIN_EVIDENCE_ITEM_COUNT,
    completionEvidenceItemCount: safeCount(report?.summary?.completionEvidenceItemCount),
    minCompletionEvidenceItemCount: MIN_COMPLETION_EVIDENCE_ITEM_COUNT
  };
}

function evidenceCountDeficitsSummary(report = {}) {
  return evidenceCountDeficitsFromCounts(
    report?.summary?.sourceItemCount,
    report?.summary?.evidenceItemCount,
    report?.summary?.completionEvidenceItemCount
  );
}

function safeRequirementTokenList(value = []) {
  return Array.isArray(value) ? value.filter(safeRequirementToken) : [];
}

function safeLabelList(value = []) {
  return Array.isArray(value) ? value.filter(safeLabel) : [];
}

function appendUnique(target, value) {
  if (!target.includes(value)) target.push(value);
}

function remainingAreasForGates(ok, gates = {}, proofReport = {}) {
  if (ok) return [];
  const remainingAreas = [];
  if (
    gates.finalProofBundleCheckReadableOk !== true
    || gates.finalProofBundleCheckShapeOk !== true
    || gates.finalProofBundleCheckAcceptedOk !== true
  ) {
    appendUnique(remainingAreas, REMAINING_AREAS.finalProofBundle);
    const inspectableProofBundle = gates.finalProofBundleCheckReadableOk === true
      && gates.finalProofBundleCheckShapeOk === true;
    const acceptanceFailures = inspectableProofBundle ? finalProofBundleAcceptanceFailures(proofReport) : [];
    const pathPrivacyFailures = acceptanceFailures.filter((field) => FINAL_PROOF_BUNDLE_PATH_PRIVACY_FAILURE_FIELDS.includes(field));
    const nonPathPrivacyFailures = acceptanceFailures.filter((field) => !FINAL_PROOF_BUNDLE_PATH_PRIVACY_FAILURE_FIELDS.includes(field));
    if (pathPrivacyFailures.length > 0) {
      appendUnique(remainingAreas, REMAINING_AREAS.finalProofBundlePathMetadata);
    }
    if (
      gates.finalProofBundleCheckReadableOk !== true
      || gates.finalProofBundleCheckShapeOk !== true
      || nonPathPrivacyFailures.length > 0
      || !inspectableProofBundle
    ) {
      appendUnique(remainingAreas, REMAINING_AREAS.realAdapterEvidence);
    }
  }
  if (gates.expectedFinalProofBundleCheckFingerprintMatches !== true) {
    appendUnique(remainingAreas, REMAINING_AREAS.expectedFingerprint);
  }
  if (gates.goalCompletionOutputWritableOk !== true) {
    appendUnique(remainingAreas, REMAINING_AREAS.savedGoalCompletionAudit);
  }
  if (gates.completionEvidenceReadyOk !== true && remainingAreas.length === 0) {
    appendUnique(remainingAreas, REMAINING_AREAS.acceptedFingerprintPinnedBundle);
  }
  return remainingAreas;
}

function remainingGateFailuresForGates(ok, gates = {}) {
  if (ok) return [];
  return GATE_FIELDS.filter((field) => gates[field] !== true);
}

function completionBasisForGates(ok, gates = {}, proofReport = {}) {
  if (ok) return COMPLETION_BASIS.complete;
  if (
    gates.finalProofBundleCheckReadableOk === true
    && gates.finalProofBundleCheckShapeOk === true
  ) {
    const acceptanceFailures = finalProofBundleAcceptanceFailures(proofReport);
    if (
      gates.expectedFinalProofBundleCheckFingerprintMatches === true
      && gates.goalCompletionOutputWritableOk === true
      && acceptanceFailures.length > 0
      && acceptanceFailures.every((field) => FINAL_PROOF_BUNDLE_PATH_PRIVACY_FAILURE_FIELDS.includes(field))
    ) {
      return COMPLETION_BASIS.pathMetadataRepairRequired;
    }
  }
  if (
    gates.finalProofBundleCheckAcceptedOk === true
    && gates.expectedFinalProofBundleCheckFingerprintMatches === true
    && gates.goalCompletionOutputWritableOk !== true
  ) {
    return COMPLETION_BASIS.acceptedBundleAwaitingAuditOutput;
  }
  if (gates.finalProofBundleCheckAcceptedOk === true) {
    return COMPLETION_BASIS.acceptedBundleAwaitingPinOrOutput;
  }
  return COMPLETION_BASIS.localProofReady;
}

function completionSummary(ok, proofReport = {}, finalProofBundleCheckFingerprint = "", gates = {}) {
  return {
    completionBasis: completionBasisForGates(ok, gates, proofReport),
    completedPercent: ok ? 100 : LOCAL_PROOF_READY_PERCENT,
    remainingPercent: ok ? 0 : FINAL_PRIVATE_PROOF_PERCENT,
    completedAreas: COMPLETED_AREA_VALUES,
    remainingAreas: remainingAreasForGates(ok, gates, proofReport),
    remainingGateFailures: remainingGateFailuresForGates(ok, gates),
    finalProofBundleFailedGateFields: finalProofBundleFailedGateFields(proofReport),
    finalProofBundleAcceptanceFailures: finalProofBundleAcceptanceFailures(proofReport),
    requiredFinalEvidence: REQUIRED_FINAL_EVIDENCE,
    finalProofBundleRequiredTargetFormatTokens: safeRequiredTargetFormatTokens(proofReport?.summary?.requiredTargetFormatTokens),
    finalProofBundleRequiredExternalAdapterTargetFormatTokens: safeRequiredExternalAdapterTargetFormatTokens(proofReport?.summary?.requiredExternalAdapterTargetFormatTokens),
    finalProofBundleRequiredPointCloudTargetFormatTokens: safeRequiredPointCloudTargetFormatTokens(proofReport?.summary?.requiredPointCloudTargetFormatTokens),
    finalProofBundleRequiredFamilySummaries: safeRequiredFamilySummaries(proofReport?.summary?.requiredFamilySummaries),
    finalProofBundleRequiredSourceEvidenceSemanticsProfile: safeRequiredSourceEvidenceSemanticsProfile(proofReport?.summary?.requiredSourceEvidenceSemanticsProfile),
    finalProofBundleRequiredInputReports: safeRequiredInputReports(proofReport?.summary?.requiredInputReports),
    finalProofBundleRequiredFingerprintPins: safeRequiredFingerprintPins(proofReport?.summary?.requiredFingerprintPins),
    finalProofBundleRequiredSavedInputReportGates: safeRequiredSavedInputReportGates(proofReport?.summary?.requiredSavedInputReportGates),
    finalProofBundleRequiredCrossReportGates: safeRequiredCrossReportGates(proofReport?.summary?.requiredCrossReportGates),
    finalProofBundleRequiredValuePolicy: safeRequiredFinalProofBundleValuePolicy(proofReport?.summary?.requiredValuePolicy),
    finalProofBundleRequiredCompletionArtifactKinds: safeRequiredCompletionArtifactKinds(proofReport?.summary?.requiredCompletionArtifactKinds),
    finalProofBundleRequiredCompletionArtifactCountMinimums: safeRequiredCompletionArtifactCountMinimums(proofReport?.summary?.requiredCompletionArtifactCountMinimums),
    finalProofBundleCheckFingerprint: SHA256_FINGERPRINT.test(finalProofBundleCheckFingerprint) ? finalProofBundleCheckFingerprint : "",
    proofChainFingerprints: proofChainFingerprintsSummary(proofReport, finalProofBundleCheckFingerprint),
    evidenceCounts: evidenceCountsSummary(proofReport),
    evidenceCountDeficits: evidenceCountDeficitsSummary(proofReport),
    finalProofBundleMissingSourceItems: safeRequirementTokenList(proofReport?.summary?.missingSourceItems),
    finalProofBundleInsufficientSourceCounts: safeRequirementTokenList(proofReport?.summary?.insufficientSourceCounts),
    finalProofBundleMissingCompletionArtifactKinds: safeLabelList(proofReport?.summary?.missingCompletionArtifactKinds),
    finalProofBundleInsufficientCompletionArtifactCounts: safeRequirementTokenList(proofReport?.summary?.insufficientCompletionArtifactCounts),
    sourceFamilies: Array.isArray(proofReport?.summary?.sourceFamilies)
      ? proofReport.summary.sourceFamilies.filter((family) => REQUIRED_SOURCE_FAMILIES.includes(family))
      : [],
    externalAdapterFamilies: Array.isArray(proofReport?.summary?.externalAdapterFamilies)
      ? proofReport.summary.externalAdapterFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
      : [],
    externalAdapterTargetFormatTokens: Array.isArray(proofReport?.summary?.externalAdapterTargetFormatTokens)
      ? proofReport.summary.externalAdapterTargetFormatTokens.filter((token) => REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS.includes(token))
      : [],
    externalAdapterPreflightEvidenceFamilies: Array.isArray(proofReport?.summary?.externalAdapterPreflightEvidenceFamilies)
      ? proofReport.summary.externalAdapterPreflightEvidenceFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
      : [],
    missingExternalAdapterPreflightEvidenceFamilies: Array.isArray(proofReport?.summary?.missingExternalAdapterPreflightEvidenceFamilies)
      ? proofReport.summary.missingExternalAdapterPreflightEvidenceFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
      : [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    externalAdapterSourceAdapterAssertionFamilies: Array.isArray(proofReport?.summary?.externalAdapterSourceAdapterAssertionFamilies)
      ? proofReport.summary.externalAdapterSourceAdapterAssertionFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
      : [],
    missingExternalAdapterSourceAdapterAssertionFamilies: Array.isArray(proofReport?.summary?.missingExternalAdapterSourceAdapterAssertionFamilies)
      ? proofReport.summary.missingExternalAdapterSourceAdapterAssertionFamilies.filter((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
      : [...REQUIRED_EXTERNAL_ADAPTER_FAMILIES],
    externalAdapterSourceAdapterKeys: safeAdapterKeyListMap(proofReport?.summary?.externalAdapterSourceAdapterKeys),
    externalAdapterSourceAdapterRequestEvidenceFingerprints: safeFingerprintListMap(proofReport?.summary?.externalAdapterSourceAdapterRequestEvidenceFingerprints),
    externalAdapterSourceAdapterConfigStatFingerprints: safeStatFingerprintListMap(proofReport?.summary?.externalAdapterSourceAdapterConfigStatFingerprints),
    externalAdapterSourceAdapterRegistryAggregateFingerprints: safeFingerprintListMap(proofReport?.summary?.externalAdapterSourceAdapterRegistryAggregateFingerprints),
    externalAdapterSourceAdapterRegistryFingerprints: safeFingerprintListMap(proofReport?.summary?.externalAdapterSourceAdapterRegistryFingerprints),
    externalAdapterSourceAdapterPreflightFingerprints: safeFingerprintListMap(proofReport?.summary?.externalAdapterSourceAdapterPreflightFingerprints),
    pointCloudFamilies: Array.isArray(proofReport?.summary?.pointCloudFamilies)
      ? proofReport.summary.pointCloudFamilies.filter((family) => REQUIRED_POINT_CLOUD_FAMILIES.includes(family))
      : [],
    sourceEvidenceSemanticsProfileId: proofReport?.summary?.sourceEvidenceSemanticsProfileId === SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID ? SOURCE_EVIDENCE_SEMANTICS_PROFILE_ID : "",
    sourceEvidenceSemanticsProfileFingerprint: SHA256_FINGERPRINT.test(proofReport?.summary?.sourceEvidenceSemanticsProfileFingerprint || "") ? proofReport.summary.sourceEvidenceSemanticsProfileFingerprint : "",
    sourceEvidenceSemanticArtifactKinds: Array.isArray(proofReport?.summary?.sourceEvidenceSemanticArtifactKinds)
      ? proofReport.summary.sourceEvidenceSemanticArtifactKinds.filter((kind) => SOURCE_EVIDENCE_SEMANTIC_ARTIFACT_KINDS.includes(kind))
      : [],
    proofPlanFingerprint: proofReport?.summary?.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT ? FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT : ""
  };
}

function buildAudit(options, proofFile) {
  const report = proofFile.value || {};
  const gates = {
    finalProofBundleCheckReadableOk: proofFile.failures.length === 0,
    finalProofBundleCheckShapeOk: proofFile.failures.length === 0 && finalProofBundleCheckShapeOk(report),
    finalProofBundleCheckAcceptedOk: proofFile.failures.length === 0 && finalProofBundleCheckAcceptedOk(report),
    expectedFinalProofBundleCheckFingerprintMatches: options.expectedFinalProofBundleCheckFingerprint
      ? proofFile.fingerprint === options.expectedFinalProofBundleCheckFingerprint
      : false,
    completionEvidenceReadyOk: false,
    goalCompletionOutputWritableOk: pathFreeInputFileName(options.outputPath).length > 0
  };
  gates.completionEvidenceReadyOk = gates.finalProofBundleCheckAcceptedOk
    && gates.expectedFinalProofBundleCheckFingerprintMatches === true;
  const failures = [
    ...proofFile.failures,
    ...Object.entries(gates)
      .filter(([, value]) => value !== true)
      .map(([field]) => `${field} failed`)
  ];
  return finalizeAudit({
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    finalProofBundleCheckPath: pathFreeInputFileName(options.finalProofBundleCheckPath),
    goalCompletionAuditPath: pathFreeInputFileName(options.outputPath),
    finalProofBundleCheckFingerprint: SHA256_FINGERPRINT.test(proofFile.fingerprint) ? proofFile.fingerprint : "",
    completedPercent: LOCAL_PROOF_READY_PERCENT,
    remainingPercent: FINAL_PRIVATE_PROOF_PERCENT,
    gates,
    summary: completionSummary(false, report, proofFile.fingerprint, gates),
    failures: [...new Set(failures)],
    warnings: []
  }, report, proofFile.fingerprint);
}

function finalizeAudit(report, proofReport = {}, finalProofBundleCheckFingerprint = report.finalProofBundleCheckFingerprint) {
  const ok = GATE_FIELDS.every((field) => report.gates[field] === true);
  report.ok = ok;
  report.completedPercent = ok ? 100 : LOCAL_PROOF_READY_PERCENT;
  report.remainingPercent = ok ? 0 : FINAL_PRIVATE_PROOF_PERCENT;
  report.summary = completionSummary(ok, proofReport, finalProofBundleCheckFingerprint, report.gates);
  if (ok) {
    report.failures = [];
  } else if (report.failures.length === 0) {
    report.failures = Object.entries(report.gates)
      .filter(([, value]) => value !== true)
      .map(([field]) => `${field} failed`);
  }
  return report;
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
  const proofFile = readJsonFile(options.finalProofBundleCheckPath, "final proof bundle check");
  const report = buildAudit(options, proofFile);
  if (!writeReport(options.outputPath, report)) {
    report.gates.goalCompletionOutputWritableOk = false;
    if (!report.failures.includes("goalCompletionOutputWritableOk failed")) {
      report.failures.push("goalCompletionOutputWritableOk failed");
    }
    finalizeAudit(report, proofFile.value || {}, proofFile.fingerprint);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error?.message === "Unknown option." ? "Unknown option." : "reference import goal completion audit failed";
  const report = finalizeAudit({
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    finalProofBundleCheckPath: pathFreeInputFileName(activeOptions.finalProofBundleCheckPath),
    goalCompletionAuditPath: pathFreeInputFileName(activeOptions.outputPath),
    finalProofBundleCheckFingerprint: "",
    completedPercent: LOCAL_PROOF_READY_PERCENT,
    remainingPercent: FINAL_PRIVATE_PROOF_PERCENT,
    gates: {
      finalProofBundleCheckReadableOk: false,
      finalProofBundleCheckShapeOk: false,
      finalProofBundleCheckAcceptedOk: false,
      expectedFinalProofBundleCheckFingerprintMatches: false,
      completionEvidenceReadyOk: false,
      goalCompletionOutputWritableOk: pathFreeInputFileName(activeOptions.outputPath).length > 0
    },
    summary: completionSummary(false),
    failures: [message],
    warnings: []
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
