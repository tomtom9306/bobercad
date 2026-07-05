#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_ID = "referenceImportFinalAcceptanceCheck";
const CHECK_VERSION = "0.1.0";
const ACCEPTANCE_REPORT_ID = "referenceImportCorpusAcceptanceReport";
const ACCEPTED_CORPUS_REPORT_ID = "referenceImportCorpusCheck";
const FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID = "full-private-reference-import-acceptance";
const UPSTREAM_CORPUS_RUN_PROFILE_ID = "full-private-reference-import-corpus-run";
const COMPLETION_EVIDENCE_ID = "reference-import-goal-completion-evidence";
const REQUIRED_SOURCE_FAMILIES = ["dxf", "dwg", "step", "ifc", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_FAMILIES = ["dwg", "e57"];
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = ["dwg", "e57pointcloud"];
const REQUIRED_POINT_CLOUD_FAMILIES = ["e57"];
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const STAT_FINGERPRINT = /^stat-sha256:[a-f0-9]{64}$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const RESERVED_ADAPTER_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT = "sha256:0dfa480ed4f08afce2aeb1f2d71910f7d2498565533262d09dabeef59ad568d3";
const REQUIRED_PRIVATE_EVIDENCE = [
  "real private DXF/DWG/STEP/IFC/E57 source files",
  "accepted DWG adapter-preflight evidence check report",
  "accepted E57 point-cloud adapter-preflight evidence check report",
  "accepted DWG/E57 external-adapter sourceAdapter assertion evidence",
  "accepted promoted-import corpus report",
  "accepted fingerprint-pinned verifier output",
  "saved completion evidence source check report",
  "path-free completion evidence manifest",
  "accepted completion evidence manifest check report with completionEvidenceOutputWritableOk",
  "saved path-free artifact fingerprint reports",
  "accepted final proof bundle check report with bundleOutputWritableOk",
  "final proof bundle with finalAcceptanceCheckAcceptedVerifierValuePolicyOk proving final-acceptance verifier value policy",
  "final proof bundle with completionEvidenceRequiredValuePolicyOk proving completion-evidence value policy",
  "final proof bundle with proofPlanFingerprint proving final private proof-plan shape",
  "final proof bundle with sourceEvidenceSemantics profile proving semantic completion-evidence builder coverage",
  "final proof bundle with evidenceSourcesFingerprintAlignedOk proving source-check/completion-evidence source manifest linkage",
  "final proof bundle with sourceAdapterEvidenceAlignedAcrossInputReportsOk proving final-acceptance/completion-evidence sourceAdapter map linkage",
  "final proof bundle with accepted DWG/E57 adapter preflight completion evidence",
  "final proof bundle with accepted DWG/E57 sourceAdapter assertion completion evidence",
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
  "accepted goal completion audit report at 100 percent with goalCompletionOutputWritableOk",
  "saved goal completion audit report with goalCompletionOutputWritableOk",
  "disposable project copies with promoted reference pointers",
  "promoted canonical reference manifests and point-cloud chunk sidecars"
];
const FINAL_COMPLETION_GATE = "fingerprint-pinned finalPrivateAcceptanceProfile verifier output plus path-free completion evidence manifest with sourceEvidenceSemantics, accepted final proof bundle check with finalAcceptanceCheckAcceptedVerifierValuePolicyOk, completionEvidenceRequiredValuePolicyOk, completionEvidenceArtifactPolicyOk, proofPlanFingerprint, sourceEvidenceSemanticsProfileOk, evidenceSourcesFingerprintAlignedOk, adapter preflight/sourceAdapter evidence, target-format policy, family/source-evidence policy, saved-report identity/fingerprint/gate/linkage policy, completion-artifact policy, pathFreeBundleValuesOk, finalProofBundleInputPathsOk, finalProofBundlePathPrivacyOk, requiredEvidenceMinimums, expected final proof bundle check fingerprint, saved 100 percent goal completion audit with goalCompletionOutputWritableOk, and disposable project/reference artifacts";
const OUTPUT_FIELDS = [
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
const GATE_FIELDS = [
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
const SUMMARY_FIELDS = [
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
const ACCEPTED_VERIFIER_OUTPUT_FIELDS = [
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
const ACCEPTED_VERIFIER_FINAL_PRIVATE_ACCEPTANCE_SUMMARY_FIELDS = [
  "profileId",
  "upstreamCorpusRunProfile",
  "completionEvidenceId",
  "requiredSourceFamilies",
  "requiredExternalAdapterFamilies",
  "requiredExternalAdapterTargetFormatTokens",
  "requiredPointCloudFamilies",
  "requiredPrivateEvidence",
  "finalCompletionGate",
  "checkedInSmokeDoesNotCompleteGoal",
  "requiresPrivateCorpus",
  "requiresReportFingerprintPin",
  "requiresSourceEvidenceSemanticsProfileGate",
  "requiresDisposableProjectCopies",
  "requiresPromotedReferenceSidecars",
  "proofPlanFingerprint",
  "missingEvidenceRecommendedAction"
];
const ACCEPTED_VERIFIER_GATE_FIELDS = [
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
  "requireNonemptyReferenceGeometry",
  "requirePromotedImportWrites",
  "sourceSizeFailedCaseIds",
  "emptyReferenceGeometryCaseIds",
  "promotedImportEvidenceMissingCaseIds"
];
const ACCEPTED_VERIFIER_SUMMARY_FIELDS = [
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
const EMPTY_GATE_LIST_FIELDS = [
  "missingFormatFamilies",
  "acceptedFormatMissingFamilies",
  "duplicateAcceptedCaseIds",
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
  "pointCloudMissingFamilies",
  "sourceSizeFailedCaseIds",
  "emptyReferenceGeometryCaseIds",
  "promotedImportEvidenceMissingCaseIds"
];

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_final_acceptance.mjs --report <acceptance-report.json> [options]",
    "",
    "Verifies a saved referenceImportCorpusAcceptanceReport as the final fingerprint-pinned private acceptance artifact.",
    "This command reads only that saved verifier output; it does not read source files, corpus reports, projects, or adapter configs.",
    "",
    "Options:",
    "  --report <path>   Saved report emitted by verify_reference_import_corpus_report.mjs --output.",
    "  --output <path>   Optional machine-readable JSON final acceptance check path.",
    "  --expect-acceptance-report-fingerprint <sha256:hex>  Require the saved verifier output bytes to match this fingerprint.",
    "  --list-contract   Print the final acceptance artifact checker contract and exit.",
    "  --help            Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    reportPath: "",
    outputPath: "",
    expectedAcceptanceReportFingerprint: "",
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
    if (arg === "--report") {
      options.reportPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-acceptance-report-fingerprint") {
      options.expectedAcceptanceReportFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    throw new Error("Unknown option.");
  }
  return options;
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1] || "";
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
    id: "referenceImportFinalAcceptanceCheckContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    acceptedReportId: ACCEPTANCE_REPORT_ID,
    acceptedCorpusReportId: ACCEPTED_CORPUS_REPORT_ID,
    inputBoundary: {
      readsSavedVerifierOutputOnly: true,
      readsSavedCorpusReport: false,
      readsPrivateSourceFiles: false,
      readsProjectFiles: false,
      readsAdapterConfigs: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    finalPrivateAcceptanceRequirements: {
      profileId: FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID,
      upstreamCorpusRunProfile: UPSTREAM_CORPUS_RUN_PROFILE_ID,
      completionEvidenceId: COMPLETION_EVIDENCE_ID,
      requiredSourceFamilies: REQUIRED_SOURCE_FAMILIES,
      requiredExternalAdapterFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
      requiredExternalAdapterTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
      requiredPointCloudFamilies: REQUIRED_POINT_CLOUD_FAMILIES,
      requiredPrivateEvidence: REQUIRED_PRIVATE_EVIDENCE,
      finalCompletionGate: FINAL_COMPLETION_GATE,
      requiresCorpusReportFingerprintPin: true,
      requiresNonemptyReferenceGeometryGate: true,
      requiresPromotedImportWritesGate: true,
      supportsAcceptanceReportFingerprintPin: true,
      checkedInSmokeDoesNotCompleteGoal: true
    },
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      summaryFields: SUMMARY_FIELDS,
      acceptedVerifierOutputFields: ACCEPTED_VERIFIER_OUTPUT_FIELDS,
      acceptedVerifierGateFields: ACCEPTED_VERIFIER_GATE_FIELDS,
      acceptedVerifierSummaryFields: ACCEPTED_VERIFIER_SUMMARY_FIELDS,
      acceptedVerifierFinalPrivateAcceptanceSummaryFields: ACCEPTED_VERIFIER_FINAL_PRIVATE_ACCEPTANCE_SUMMARY_FIELDS,
      acceptedVerifierValuePolicy: acceptedVerifierValuePolicy(),
      failureListGateFields: EMPTY_GATE_LIST_FIELDS,
      finalAcceptanceOutputPathField: "finalAcceptanceCheckPath",
      pathPrivacyFields: ["reportPath", "finalAcceptanceCheckPath"],
      pathPrivacyPolicy: "reportPath is reduced to a path-free file name; verifier output paths and local corpus/source/project paths are not echoed"
    },
    cliFlags: ["--report", "--output", "--expect-acceptance-report-fingerprint", "--list-contract", "--help"]
  };
}

function pathFreeInputFileName(value = "") {
  const base = path.basename(String(value || "").replace(/\\/g, "/"));
  return /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/.test(base) ? base : "";
}

function fileFingerprint(raw) {
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

function acceptedVerifierValuePolicy() {
  return {
    requiresPathFreeReportPath: true,
    requiresEmptyFailuresAndWarnings: true,
    requiresExactSourceFamilySummarySets: true,
    requiresExactExternalAdapterFamilySummarySets: true,
    requiresExactExternalAdapterTargetFormatTokens: true,
    requiresExactOneSourceAdapterEvidenceValuePerExternalAdapterFamily: true,
    sourceAdapterKeyPolicy: {
      safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
      reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
    },
    requiresAtLeastOneCasePerRequiredSourceFamily: true
  };
}

function readJsonReport(reportPath = "") {
  if (!reportPath) {
    return { report: null, raw: "", fingerprint: "", failures: ["--report is required"] };
  }
  try {
    const raw = fs.readFileSync(reportPath, "utf8");
    const fingerprint = fileFingerprint(raw);
    try {
      return { report: JSON.parse(raw), raw, fingerprint, failures: [] };
    } catch {
      return { report: null, raw, fingerprint, failures: ["final acceptance report must be valid JSON"] };
    }
  } catch {
    return { report: null, raw: "", fingerprint: "", failures: ["final acceptance report must be readable JSON"] };
  }
}

function sameStrings(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
}

function adapterKeyMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].length === 1
      && value[family].every((entry) => safeAdapterKey(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function safeAdapterKey(value = "") {
  return typeof value === "string"
    && SAFE_ADAPTER_KEY.test(value)
    && !RESERVED_ADAPTER_KEYS.has(value);
}

function safeAdapterKeys(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => safeAdapterKey(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function safeAdapterKeyListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeAdapterKeys(value?.[family])
  ]));
}

function strictAdapterKeyListMap(value = {}) {
  return adapterKeyMapOk(value) ? safeAdapterKeyListMap(value) : safeAdapterKeyListMap();
}

function fingerprintListMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].length === 1
      && value[family].every((entry) => typeof entry === "string" && SHA256_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function safeFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && SHA256_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function safeFingerprintListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeFingerprints(value?.[family])
  ]));
}

function strictFingerprintListMap(value = {}) {
  return fingerprintListMapOk(value) ? safeFingerprintListMap(value) : safeFingerprintListMap();
}

function statFingerprintListMapOk(value = {}) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => Array.isArray(value[family]))
    && Object.keys(value).every((family) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family))
    && REQUIRED_EXTERNAL_ADAPTER_FAMILIES.every((family) => (
      value[family].length === 1
      && value[family].every((entry) => typeof entry === "string" && STAT_FINGERPRINT.test(entry))
      && value[family].every((entry, index, entries) => entries.indexOf(entry) === index)
    ));
}

function safeStatFingerprints(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && STAT_FINGERPRINT.test(value))
    .filter((value, index, entries) => entries.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function safeStatFingerprintListMap(value = {}) {
  return Object.fromEntries(REQUIRED_EXTERNAL_ADAPTER_FAMILIES.map((family) => [
    family,
    safeStatFingerprints(value?.[family])
  ]));
}

function strictStatFingerprintListMap(value = {}) {
  return statFingerprintListMapOk(value) ? safeStatFingerprintListMap(value) : safeStatFingerprintListMap();
}

function sameStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry) => expected.includes(entry))
    && expected.every((entry) => actual.includes(entry));
}

function includesAll(actual, expected) {
  return Array.isArray(actual) && expected.every((entry) => actual.includes(entry));
}

function exactObjectFieldsOk(value, expectedFields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedFields.length && keys.every((field) => expectedFields.includes(field));
}

function pathFreeSavedReportPathOk(value) {
  return typeof value === "string" && value !== "" && value === pathFreeInputFileName(value);
}

function emptyGateEvidence(gates = {}) {
  return EMPTY_GATE_LIST_FIELDS.filter((field) => {
    const value = gates[field];
    return !Array.isArray(value) || value.length > 0;
  });
}

function verifyFinalAcceptanceReport(report, options, acceptanceReportFingerprint) {
  const failures = [];
  const gates = report?.gates && typeof report.gates === "object" && !Array.isArray(report.gates)
    ? report.gates
    : {};
  const summary = report?.summary && typeof report.summary === "object" && !Array.isArray(report.summary)
    ? report.summary
    : {};
  const finalSummary = report?.finalPrivateAcceptanceSummary
    && typeof report.finalPrivateAcceptanceSummary === "object"
    && !Array.isArray(report.finalPrivateAcceptanceSummary)
    ? report.finalPrivateAcceptanceSummary
    : {};
  const missingGateEvidence = emptyGateEvidence(gates);
  const acceptanceReportShapeOk = exactObjectFieldsOk(report, ACCEPTED_VERIFIER_OUTPUT_FIELDS)
    && exactObjectFieldsOk(gates, ACCEPTED_VERIFIER_GATE_FIELDS)
    && exactObjectFieldsOk(summary, ACCEPTED_VERIFIER_SUMMARY_FIELDS)
    && exactObjectFieldsOk(finalSummary, ACCEPTED_VERIFIER_FINAL_PRIVATE_ACCEPTANCE_SUMMARY_FIELDS)
    && Array.isArray(report?.failures)
    && Array.isArray(report?.warnings);
  const acceptanceReportValueShapeOk = pathFreeSavedReportPathOk(report?.reportPath)
    && SHA256_FINGERPRINT.test(report?.reportFingerprint || "")
    && Array.isArray(report?.failures)
    && report.failures.length === 0
    && Array.isArray(report?.warnings)
    && report.warnings.length === 0
    && Number.isSafeInteger(summary.caseCount)
    && summary.caseCount >= REQUIRED_SOURCE_FAMILIES.length
    && summary.accepted === true
    && summary.coverageOk === true
    && sameStringSet(summary.presentFormatFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStringSet(summary.acceptedFormatFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStringSet(summary.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(summary.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && adapterKeyMapOk(summary.externalAdapterSourceAdapterKeys)
    && fingerprintListMapOk(summary.externalAdapterSourceAdapterRequestEvidenceFingerprints)
    && statFingerprintListMapOk(summary.externalAdapterSourceAdapterConfigStatFingerprints)
    && fingerprintListMapOk(summary.externalAdapterSourceAdapterRegistryAggregateFingerprints)
    && fingerprintListMapOk(summary.externalAdapterSourceAdapterRegistryFingerprints)
    && fingerprintListMapOk(summary.externalAdapterSourceAdapterPreflightFingerprints)
    && sameStringSet(summary.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && summary.performanceEvidenceReady === true
    && summary.sourceEvidenceReady === true;
  const acceptedReportIdentityOk = report?.id === ACCEPTANCE_REPORT_ID
    && report?.version === CHECK_VERSION
    && report?.reportId === ACCEPTED_CORPUS_REPORT_ID
    && report?.reportVersion === CHECK_VERSION;
  const acceptedReportOk = report?.ok === true
    && Array.isArray(report?.failures)
    && report.failures.length === 0
    && summary.accepted === true
    && summary.coverageOk === true
    && summary.sourceEvidenceReady === true
    && summary.performanceEvidenceReady === true;
  const corpusReportFingerprintPresent = SHA256_FINGERPRINT.test(report?.reportFingerprint || "");
  const acceptanceReportFingerprintMatchesExpected = options.expectedAcceptanceReportFingerprint
    ? acceptanceReportFingerprint === options.expectedAcceptanceReportFingerprint
    : null;
  const corpusReportFingerprintPinned = corpusReportFingerprintPresent
    && gates.expectedReportFingerprint === report.reportFingerprint
    && gates.reportFingerprintMatchesExpected === true;
  const requiredFormatFamiliesOk = sameStrings(gates.requiredFormatFamilies, REQUIRED_SOURCE_FAMILIES)
    && includesAll(summary.acceptedFormatFamilies, REQUIRED_SOURCE_FAMILIES);
  const requiredExternalAdapterFamiliesOk = sameStrings(gates.requiredExternalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && includesAll(summary.externalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES);
  const requiredExternalAdapterTargetFormatTokensOk = sameStrings(summary.externalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS);
  const requiredPointCloudFamiliesOk = sameStrings(gates.requiredPointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && includesAll(summary.pointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES);
  const sourceSizeGatePresent = Number.isSafeInteger(gates.minSourceFileSizeBytes)
    && gates.minSourceFileSizeBytes > 0;
  const nonemptyReferenceGeometryRequired = gates.requireNonemptyReferenceGeometry === true;
  const promotedImportWritesRequired = gates.requirePromotedImportWrites === true;
  const finalPrivateAcceptanceSummaryOk = finalSummary.profileId === FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID
    && finalSummary.upstreamCorpusRunProfile === UPSTREAM_CORPUS_RUN_PROFILE_ID
    && finalSummary.completionEvidenceId === COMPLETION_EVIDENCE_ID
    && sameStrings(finalSummary.requiredSourceFamilies, REQUIRED_SOURCE_FAMILIES)
    && sameStrings(finalSummary.requiredExternalAdapterFamilies, REQUIRED_EXTERNAL_ADAPTER_FAMILIES)
    && sameStrings(finalSummary.requiredExternalAdapterTargetFormatTokens, REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS)
    && sameStrings(finalSummary.requiredPointCloudFamilies, REQUIRED_POINT_CLOUD_FAMILIES)
    && finalSummary.finalCompletionGate === FINAL_COMPLETION_GATE
    && finalSummary.checkedInSmokeDoesNotCompleteGoal === true
    && finalSummary.requiresPrivateCorpus === true
    && finalSummary.requiresReportFingerprintPin === true
    && finalSummary.requiresSourceEvidenceSemanticsProfileGate === true
    && finalSummary.requiresDisposableProjectCopies === true
    && finalSummary.requiresPromotedReferenceSidecars === true
    && finalSummary.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT
    && finalSummary.missingEvidenceRecommendedAction === "run-private-end-to-end-proof-plan";
  const requiredPrivateEvidenceOk = sameStrings(finalSummary.requiredPrivateEvidence, REQUIRED_PRIVATE_EVIDENCE);
  const gateResults = {
    acceptanceReportShapeOk,
    acceptanceReportValueShapeOk,
    acceptedReportIdentityOk,
    acceptedReportOk,
    expectedAcceptanceReportFingerprint: options.expectedAcceptanceReportFingerprint || "",
    acceptanceReportFingerprintMatchesExpected,
    corpusReportFingerprintPresent,
    corpusReportFingerprintPinned,
    requiredFormatFamiliesOk,
    requiredExternalAdapterFamiliesOk,
    requiredExternalAdapterTargetFormatTokensOk,
    requiredPointCloudFamiliesOk,
    sourceSizeGatePresent,
    nonemptyReferenceGeometryRequired,
    promotedImportWritesRequired,
    missingGateEvidence,
    finalPrivateAcceptanceSummaryOk,
    requiredPrivateEvidenceOk,
    finalAcceptanceOutputWritableOk: true
  };
  for (const [field, value] of Object.entries(gateResults)) {
    if (field === "expectedAcceptanceReportFingerprint") continue;
    if (field === "acceptanceReportFingerprintMatchesExpected" && value === null) continue;
    if (Array.isArray(value) ? value.length > 0 : value !== true) {
      failures.push(`${field} failed`);
    }
  }
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: failures.length === 0,
    reportPath: pathFreeInputFileName(options.reportPath),
    finalAcceptanceCheckPath: pathFreeInputFileName(options.outputPath),
    acceptanceReportId: report?.id === ACCEPTANCE_REPORT_ID ? ACCEPTANCE_REPORT_ID : "",
    acceptanceReportVersion: report?.version === CHECK_VERSION ? CHECK_VERSION : "",
    acceptanceReportFingerprint: SHA256_FINGERPRINT.test(acceptanceReportFingerprint) ? acceptanceReportFingerprint : "",
    corpusReportFingerprint: SHA256_FINGERPRINT.test(report?.reportFingerprint || "") ? report.reportFingerprint : "",
    finalPrivateAcceptanceProfileId: finalSummary.profileId === FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID ? FINAL_PRIVATE_ACCEPTANCE_PROFILE_ID : "",
    upstreamCorpusRunProfileId: finalSummary.upstreamCorpusRunProfile === UPSTREAM_CORPUS_RUN_PROFILE_ID ? UPSTREAM_CORPUS_RUN_PROFILE_ID : "",
    completionEvidenceId: finalSummary.completionEvidenceId === COMPLETION_EVIDENCE_ID ? COMPLETION_EVIDENCE_ID : "",
    gates: gateResults,
    summary: {
      accepted: summary.accepted === true,
      acceptedFormatFamilies: Array.isArray(summary.acceptedFormatFamilies) ? summary.acceptedFormatFamilies.filter((entry) => REQUIRED_SOURCE_FAMILIES.includes(entry)) : [],
      externalAdapterFamilies: Array.isArray(summary.externalAdapterFamilies) ? summary.externalAdapterFamilies.filter((entry) => REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(entry)) : [],
      externalAdapterTargetFormatTokens: Array.isArray(summary.externalAdapterTargetFormatTokens) ? summary.externalAdapterTargetFormatTokens.filter((entry) => REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS.includes(entry)) : [],
      externalAdapterSourceAdapterKeys: strictAdapterKeyListMap(summary.externalAdapterSourceAdapterKeys),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: strictFingerprintListMap(summary.externalAdapterSourceAdapterRequestEvidenceFingerprints),
      externalAdapterSourceAdapterConfigStatFingerprints: strictStatFingerprintListMap(summary.externalAdapterSourceAdapterConfigStatFingerprints),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: strictFingerprintListMap(summary.externalAdapterSourceAdapterRegistryAggregateFingerprints),
      externalAdapterSourceAdapterRegistryFingerprints: strictFingerprintListMap(summary.externalAdapterSourceAdapterRegistryFingerprints),
      externalAdapterSourceAdapterPreflightFingerprints: strictFingerprintListMap(summary.externalAdapterSourceAdapterPreflightFingerprints),
      pointCloudFamilies: Array.isArray(summary.pointCloudFamilies) ? summary.pointCloudFamilies.filter((entry) => REQUIRED_POINT_CLOUD_FAMILIES.includes(entry)) : [],
      proofPlanFingerprint: finalSummary.proofPlanFingerprint === FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT ? FINAL_PRIVATE_PROOF_PLAN_FINGERPRINT : "",
      acceptedVerifierValuePolicy: acceptedVerifierValuePolicy(),
      missingEvidenceRecommendedAction: finalSummary.missingEvidenceRecommendedAction === "run-private-end-to-end-proof-plan"
        ? "run-private-end-to-end-proof-plan"
        : ""
    },
    failures,
    warnings: []
  };
}

function failureOutput(options = {}, failures = []) {
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    reportPath: pathFreeInputFileName(options.reportPath),
    finalAcceptanceCheckPath: pathFreeInputFileName(options.outputPath),
    acceptanceReportId: "",
    acceptanceReportVersion: "",
    acceptanceReportFingerprint: "",
    corpusReportFingerprint: "",
    finalPrivateAcceptanceProfileId: "",
    upstreamCorpusRunProfileId: "",
    completionEvidenceId: "",
    gates: {
      acceptanceReportShapeOk: false,
      acceptanceReportValueShapeOk: false,
      acceptedReportIdentityOk: false,
      acceptedReportOk: false,
      expectedAcceptanceReportFingerprint: options.expectedAcceptanceReportFingerprint || "",
      acceptanceReportFingerprintMatchesExpected: null,
      corpusReportFingerprintPresent: false,
      corpusReportFingerprintPinned: false,
      requiredFormatFamiliesOk: false,
      requiredExternalAdapterFamiliesOk: false,
      requiredExternalAdapterTargetFormatTokensOk: false,
      requiredPointCloudFamiliesOk: false,
      sourceSizeGatePresent: false,
      nonemptyReferenceGeometryRequired: false,
      promotedImportWritesRequired: false,
      missingGateEvidence: [],
      finalPrivateAcceptanceSummaryOk: false,
      requiredPrivateEvidenceOk: false,
      finalAcceptanceOutputWritableOk: true
    },
    summary: {
      accepted: false,
      acceptedFormatFamilies: [],
      externalAdapterFamilies: [],
      externalAdapterTargetFormatTokens: [],
      externalAdapterSourceAdapterKeys: safeAdapterKeyListMap(),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterConfigStatFingerprints: safeStatFingerprintListMap(),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterRegistryFingerprints: safeFingerprintListMap(),
      externalAdapterSourceAdapterPreflightFingerprints: safeFingerprintListMap(),
      pointCloudFamilies: [],
      proofPlanFingerprint: "",
      acceptedVerifierValuePolicy: acceptedVerifierValuePolicy(),
      missingEvidenceRecommendedAction: ""
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

function markFinalAcceptanceOutputUnwritable(report) {
  report.gates.finalAcceptanceOutputWritableOk = false;
  report.ok = false;
  if (!report.failures.includes("finalAcceptanceOutputWritableOk failed")) {
    report.failures.push("finalAcceptanceOutputWritableOk failed");
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
  const loaded = readJsonReport(options.reportPath);
  const report = loaded.failures.length > 0
    ? failureOutput(options, loaded.failures)
    : verifyFinalAcceptanceReport(loaded.report, options, loaded.fingerprint);
  if (!writeReport(options.outputPath, report)) {
    markFinalAcceptanceOutputUnwritable(report);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = failureOutput(activeOptions, [error?.message === "Unknown option." ? "Unknown option." : "final acceptance check failed"]);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
