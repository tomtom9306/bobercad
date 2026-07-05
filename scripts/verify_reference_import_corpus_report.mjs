#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";

const CHECK_ID = "referenceImportCorpusAcceptanceReport";
const CHECK_VERSION = "0.1.0";
const CORPUS_REPORT_ID = "referenceImportCorpusCheck";
const WORKFLOW_RUNNER_REPORT_PATH = "scripts/run_reference_import_workflow.mjs";
const CASE_TIMING_DURATION_TOLERANCE_MS = 5000;
const STAGE_IDS = new Set([
  "source-discovery",
  "plan-only",
  "adapter-preflight",
  "adapter-request",
  "dry-run",
  "import",
  "check-references"
]);
const SOURCE_FORMAT_FAMILIES = new Map([
  ["dxf", "dxf"],
  ["dwg", "dwg"],
  ["step", "step"],
  ["stp", "step"],
  ["p21", "step"],
  ["stpnc", "step"],
  ["ifc", "ifc"],
  ["ifcxml", "ifc"],
  ["ifczip", "ifc"],
  ["e57", "e57"],
  ["e57pointcloud", "e57"],
  ["e57pc", "e57"],
  ["json", "json"]
]);
const FAMILY_TARGET_FORMAT_TOKENS = {
  dwg: "dwg",
  e57: "e57pointcloud"
};
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = Object.values(FAMILY_TARGET_FORMAT_TOKENS);
const TRANSLATION_MODES = new Set(["built-in", "external-adapter", "canonical-json"]);
const SAFE_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_TAG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const RESERVED_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_SOURCE_EXTENSION = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SAFE_WORKFLOW_TEXT = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,199}$/;
const ASSERTION_VALUE_MAX_DEPTH = 4;
const ASSERTION_VALUE_MAX_ITEMS = 20;
const SELECTION_TAG_LIST_MAX_ITEMS = 100;
const STAT_FINGERPRINT = /^stat-sha256:[a-f0-9]{64}$/;
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const FORBIDDEN_TOP_LEVEL_FIELDS = new Set([
  "responseEnvelopes",
  "finalWorkspaceResponseEnvelope",
  "rawWorkflowResponses",
  "rawHostResponses",
  "canonicalGeometry",
  "referenceGeometryAssets"
]);
const ACCEPTED_REPORT_FIELDS = new Set([
  "id",
  "version",
  "ok",
  "configPath",
  "workflowRunnerPath",
  "caseCount",
  "skippedCaseCount",
  "passedCaseCount",
  "failedCaseCount",
  "failedCaseIds",
  "skippedCaseIds",
  "defaults",
  "selection",
  "coverage",
  "performance",
  "acceptance",
  "errors",
  "runtimeBoundary",
  "cases"
]);
const VERIFICATION_REPORT_FIELDS = [
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
const FINAL_PRIVATE_ACCEPTANCE_SUMMARY_FIELDS = [
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
const PROOF_PLAN_EXPECT_ARGS_SOURCE_FIELDS = [
  "consumerStepId",
  "sourceStepId",
  "expectProfile",
  "reportPath",
  "commandPlaceholder",
  "generatedFields"
];
const VERIFICATION_GATE_FIELDS = [
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
const VERIFICATION_SUMMARY_FIELDS = [
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
const REFERENCE_COUNT_FIELDS = [
  "objectCount",
  "layerCount",
  "chunkCount",
  "lineSegmentCount",
  "meshFaceCount",
  "pointCloudPointCount",
  "chunkPointCount",
  "diagnosticCount"
];
const REQUEST_SUMMARY_FIELDS = new Set([
  "targetStage",
  "startStage",
  "confirmImport",
  "includeRawResponses"
]);
const PROCESS_SUMMARY_FIELDS = new Set([
  "exitCode",
  "signal",
  "timedOut",
  "error"
]);
const SOURCE_SUMMARY_FIELDS = new Set([
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "sourceRequestedFormatAliases",
  "translationMode",
  "sourceAdapter",
  "adapterConfigProvided",
  "adapterPreflightOk",
  "adapterRequestEvidenceFingerprint",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterPreflightFingerprint"
]);
const EXTERNAL_ADAPTER_EVIDENCE_FIELDS = [
  "translationMode",
  "sourceRequestedFormatFamily",
  "sourceAdapter",
  "adapterConfigProvided",
  "adapterPreflightOk",
  "adapterRequestEvidenceFingerprint",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterPreflightFingerprint"
];
const STRICT_STRING_EVIDENCE_CONTRACT = {
  policy: "saved-report evidence fields must be literal strings; arrays and objects that stringify to accepted tokens are rejected",
  scalarFields: [
    "configPath",
    "cases[].id",
    "cases[].startedAt",
    "cases[].finishedAt",
    "cases[].sourceFile.extension",
    "cases[].sourceFile.formatFamily",
    "cases[].sourceFile.modifiedTime",
    "cases[].sourceFile.statFingerprint",
    "cases[].workflow.stopReason",
    "cases[].workflow.blockedReason",
    "cases[].workflow.source.sourceFormat",
    "cases[].workflow.source.sourceRequestedFormat",
    "cases[].workflow.source.sourceRequestedFormatFamily",
    "cases[].workflow.source.translationMode",
    "cases[].workflow.source.sourceAdapter",
    "cases[].workflow.source.adapterRequestEvidenceFingerprint",
    "cases[].workflow.source.adapterConfigStatFingerprint",
    "cases[].workflow.source.adapterRegistryFingerprint",
    "cases[].workflow.source.adapterRegistryAdapterFingerprint",
    "cases[].workflow.source.adapterPreflightFingerprint",
    "cases[].request.startStage",
    "cases[].request.targetStage",
    "coverage.caseFormatFamilies[].id",
    "coverage.caseFormatFamilies[].formatFamily",
    "coverage.caseFormatFamilies[].sourceToken",
    "coverage.caseFormatFamilies[].source",
    "performance.maxDurationCaseId",
    "performance.caseDurations[].id",
    "performance.caseDurations[].sourceStatFingerprint",
    "defaults.targetStage"
  ],
  arrayElementFields: [
    "skippedCaseIds[]",
    "selection.skippedCaseIds[]",
    "selection.includeTags[]",
    "selection.excludeTags[]",
    "coverage.presentFormatFamilies[]",
    "coverage.requiredFormatFamilies[]",
    "coverage.missingFormatFamilies[]",
    "defaults.requiredFormatFamilies[]",
    "defaults.requiredExternalAdapterFamilies[]",
    "acceptance.requiredExternalAdapterFamilies[]",
    "acceptance.presentExternalAdapterFamilies[]",
    "acceptance.externalAdapterMissingFamilies[]",
    "cases[].workflow.completedStages[]",
    "cases[].workflow.source.sourceRequestedFormatAliases[]"
  ],
  gateFields: [
    "topLevelReportMetadataIssues",
    "topLevelCaseMetadataIssues",
    "coverageMetadataIssues",
    "defaultsMetadataIssues",
    "sourceFileSummaryInvalidCaseIds",
    "sourceSummaryInvalidCaseIds",
    "sourceFormatSummaryInvalidCaseIds",
    "sourceModifiedTimeInvalidCaseIds",
    "caseTimingInvalidCaseIds",
    "workflowSummaryInvalidCaseIds",
    "workflowStageInvalidCaseIds",
    "requestSummaryInvalidCaseIds",
    "performanceDurationSummaryInvalidCaseIds",
    "fingerprintSummaryInvalidCaseIds"
  ]
};
const STRICT_BOOLEAN_EVIDENCE_CONTRACT = {
  policy: "saved-report boolean evidence fields must be literal booleans; strings, numbers, arrays, and objects are rejected",
  trueFields: [
    "runtimeBoundary.invokesWorkflowRunnerOnly",
    "runtimeBoundary.workflowRunnerUsesWorkspaceHost",
    "runtimeBoundary.importWritesRequireAllowFlag",
    "acceptance.accepted",
    "acceptance.allCasesPassed",
    "acceptance.requiredFormatCoverageOk",
    "acceptance.externalAdapterCoverageOk",
    "acceptance.sourceEvidenceReady",
    "acceptance.performanceEvidenceReady",
    "coverage.coverageOk",
    "cases[].ok",
    "cases[].enabled",
    "cases[].sourceFile.exists",
    "cases[].sourceFile.isFile",
    "cases[].workflow.ok",
    "cases[].workflow.runtimeBoundary.workflowRunnerUsesWorkspaceHost"
  ],
  falseFields: [
    "runtimeBoundary.shell",
    "runtimeBoundary.browserRuntimeExecutesCli",
    "cases[].workflow.rawResponsesIncluded",
    "cases[].workflow.runtimeBoundary.browserRuntimeExecutesCli",
    "cases[].workflow.runtimeBoundary.workflowRunnerRunsShell",
    "cases[].workflow.runtimeBoundary.browserRuntimeWritesProjectJson",
    "cases[].workflow.runtimeBoundary.browserRuntimeWritesReferenceFiles",
    "cases[].request.includeRawResponses"
  ],
  booleanOrNullFields: [
    "cases[].workflow.source.adapterPreflightOk"
  ],
  gateFields: [
    "topLevelRuntimeBoundaryIssues",
    "acceptanceMetadataIssues",
    "coverageMetadataIssues",
    "caseSummaryInvalidCaseIds",
    "caseIdentityInvalidCaseIds",
    "sourceFileSummaryInvalidCaseIds",
    "sourceEvidenceMissingCaseIds",
    "sourceSummaryInvalidCaseIds",
    "workflowSummaryInvalidCaseIds",
    "workflowRuntimeBoundaryInvalidCaseIds",
    "workflowStageInvalidCaseIds",
    "requestSummaryInvalidCaseIds",
    "rawDebugRequestCaseIds"
  ]
};
const STRICT_INTEGER_EVIDENCE_CONTRACT = {
  policy: "saved-report integer evidence fields must be nonnegative safe integers; numeric strings, floats, arrays, and objects are rejected",
  nonnegativeSafeIntegerFields: [
    "caseCount",
    "skippedCaseCount",
    "passedCaseCount",
    "failedCaseCount",
    "acceptance.caseCount",
    "defaults.caseTimeoutMs",
    "defaults.minSourceFileSizeBytes",
    "selection.selectedCaseCount",
    "selection.runCaseCount",
    "selection.skippedCaseCount",
    "performance.totalDurationMs",
    "performance.maxDurationMs",
    "performance.caseDurations[].durationMs",
    "performance.caseDurations[].sourceFileSizeBytes",
    "cases[].durationMs",
    "cases[].timeoutMs",
    "cases[].sourceFile.sizeBytes",
    "cases[].process.exitCode",
    "cases[].workflow.responseCount"
  ],
  nullableNonnegativeSafeIntegerFields: [
    "cases[].workflow.audit.readyCount",
    "cases[].workflow.audit.needsAttentionCount",
    "cases[].workflow.audit.errorCount",
    "cases[].workflow.referenceCounts.objectCount",
    "cases[].workflow.referenceCounts.layerCount",
    "cases[].workflow.referenceCounts.chunkCount",
    "cases[].workflow.referenceCounts.lineSegmentCount",
    "cases[].workflow.referenceCounts.meshFaceCount",
    "cases[].workflow.referenceCounts.pointCloudPointCount",
    "cases[].workflow.referenceCounts.chunkPointCount",
    "cases[].workflow.referenceCounts.diagnosticCount"
  ],
  gateFields: [
    "acceptanceMetadataIssues",
    "topLevelCaseMetadataIssues",
    "defaultsMetadataIssues",
    "performanceMetadataIssues",
    "performanceDurationSummaryInvalidCaseIds",
    "sourceFileSummaryInvalidCaseIds",
    "sourceEvidenceMissingCaseIds",
    "caseTimingInvalidCaseIds",
    "processSummaryInvalidCaseIds",
    "workflowSummaryInvalidCaseIds",
    "workflowResponseSummaryInvalidCaseIds",
    "referenceCountInvalidCaseIds"
  ]
};
const FINAL_PRIVATE_ACCEPTANCE_PROFILE = {
  id: "full-private-reference-import-acceptance",
  purpose: "side-effect-free review of a saved private corpus report after real DXF/DWG/STEP/IFC/E57 translator and promoted-import runs",
  requiredSourceFamilies: ["dxf", "dwg", "step", "ifc", "e57"],
  requiredExternalAdapterFamilies: ["dwg", "e57"],
  requiredExternalAdapterTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
  requiredPointCloudFamilies: ["e57"],
  recommendedVerifierFlags: [
    "--expect-report-fingerprint",
    "--require-format-families",
    "--require-external-adapter-families",
    "--require-point-cloud-families",
    "--min-source-file-size-bytes",
    "--require-nonempty-reference-geometry",
    "--require-promoted-import-writes"
  ],
  requiredGateFields: [
    "expectedReportFingerprint",
    "reportFingerprintMatchesExpected",
    "requiredFormatFamilies",
    "acceptedFormatMissingFamilies",
    "requiredExternalAdapterFamilies",
    "externalAdapterMissingFamilies",
    "requiredPointCloudFamilies",
    "pointCloudMissingFamilies",
    "minSourceFileSizeBytes",
    "sourceSizeFailedCaseIds",
    "requireNonemptyReferenceGeometry",
    "emptyReferenceGeometryCaseIds",
    "requirePromotedImportWrites",
    "promotedImportEvidenceMissingCaseIds"
  ],
  requiredEvidenceContracts: [
    "runtimeBoundaryEvidenceContract",
    "externalAdapterEvidenceContract",
    "strictStringEvidenceContract",
    "strictBooleanEvidenceContract",
    "strictIntegerEvidenceContract"
  ],
  proofArtifacts: [
    "saved referenceImportCorpusCheck report",
    "saved referenceImportCorpusAcceptanceReport verifier output",
    "saved final acceptance artifact check report",
    "path-free completion evidence manifest template",
    "saved path-free artifact fingerprint reports",
    "saved DWG adapter-preflight evidence check report",
    "saved E57 adapter-preflight evidence check report",
    "saved completion evidence source check report",
    "path-free completion evidence manifest",
    "saved completion evidence manifest check report",
    "saved final proof bundle check report",
    "saved goal completion audit report with goalCompletionOutputWritableOk",
    "disposable project copy with promoted reference pointer",
    "promoted canonical reference manifest and point-cloud chunk sidecars"
  ],
  endToEndProofPlan: {
    id: "full-private-reference-import-proof-plan",
    upstreamCorpusRunProfile: "full-private-reference-import-corpus-run",
    requiredRunArtifacts: [
      "private final corpus config",
      "saved config-preflight report",
      "saved promoted-import corpus report",
      "saved promoted corpus report fingerprint report",
      "saved fingerprint-pinned verifier output",
      "saved final acceptance input fingerprint report",
      "saved final acceptance artifact check report with finalAcceptanceOutputWritableOk",
      "path-free completion evidence manifest template",
      "saved DWG adapter-preflight evidence check report",
      "saved E57 adapter-preflight evidence check report",
      "saved completion evidence source check report",
      "path-free completion evidence manifest",
      "saved completion evidence input fingerprint report",
      "saved completion evidence manifest check report",
      "saved final proof bundle input fingerprint report",
      "saved final proof bundle check report",
      "saved goal completion input fingerprint report",
      "saved goal completion audit report with goalCompletionOutputWritableOk",
      "disposable project copies",
      "promoted canonical reference manifests and point-cloud chunk sidecars"
    ],
    requiredVerificationSteps: [
      "run verifier once to capture reportFingerprint",
      "run path-free artifact fingerprint helper for promoted corpus report with expectArgs/expectArgPairs/expectArgsByFlag",
      "rerun verifier with --expect-report-fingerprint",
      "save fingerprint-pinned referenceImportCorpusAcceptanceReport verifier output",
      "run path-free artifact fingerprint helper for final acceptance input with expectArgs/expectArgPairs/expectArgsByFlag",
      "run final acceptance artifact checker on saved verifier output",
      "rerun final acceptance artifact checker with --expect-acceptance-report-fingerprint, --output, and finalAcceptanceOutputWritableOk",
      "generate completion evidence manifest template from pinned final acceptance check",
      "run completion evidence source preflight with --check-sources-only --output",
      "build path-free completion evidence manifest from preflighted evidence sources",
      "run path-free artifact fingerprint helper for completion evidence input with expectArgs/expectArgPairs/expectArgsByFlag",
      "run completion evidence manifest checker with --expect-final-acceptance-check-fingerprint, --output, and completionEvidenceOutputWritableOk",
      "run path-free artifact fingerprint helper for final proof bundle inputs with expectArgs/expectArgPairs/expectArgsByFlag",
      "run final proof bundle checker with expected final/source/completion check fingerprints, --output, bundleOutputWritableOk, finalAcceptanceCheckAcceptedVerifierValuePolicyOk, completionEvidenceRequiredValuePolicyOk, completionEvidenceArtifactPolicyOk, proofPlanFingerprint, sourceEvidenceSemanticsProfileOk, evidenceSourcesFingerprintAlignedOk, accepted DWG/E57 adapter preflight/sourceAdapter evidence, requiredTargetFormatTokens, requiredExternalAdapterTargetFormatTokens, requiredPointCloudTargetFormatTokens, requiredFamilySummaries, requiredSourceEvidenceSemanticsProfile, requiredInputReports, requiredFingerprintPins, requiredSavedInputReportGates, requiredCrossReportGates, requiredCompletionArtifactKinds, requiredCompletionArtifactCountMinimums, pathFreeBundleValuesOk, and requiredEvidenceMinimums",
      "run path-free artifact fingerprint helper for goal completion input with expectArgs/expectArgPairs/expectArgsByFlag",
      "run goal completion audit with expected final proof bundle check fingerprint, --output, and goalCompletionOutputWritableOk"
    ],
    expectArgsSourceFields: PROOF_PLAN_EXPECT_ARGS_SOURCE_FIELDS,
    expectArgsSources: [
      {
        consumerStepId: "verify-pinned-report-fingerprint",
        sourceStepId: "fingerprint-promoted-corpus-report",
        expectProfile: "corpus-report-verification",
        reportPath: "<promoted-import-corpus-fingerprint.json>",
        commandPlaceholder: "<corpus-report-verification.expectArgs>",
        generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
      },
      {
        consumerStepId: "verify-saved-final-acceptance-output",
        sourceStepId: "fingerprint-final-acceptance-input",
        expectProfile: "final-acceptance-input",
        reportPath: "<final-acceptance-input-fingerprint.json>",
        commandPlaceholder: "<final-acceptance-input.expectArgs>",
        generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
      },
      {
        consumerStepId: "verify-completion-evidence-manifest",
        sourceStepId: "fingerprint-completion-evidence-input",
        expectProfile: "completion-evidence-input",
        reportPath: "<completion-evidence-input-fingerprint.json>",
        commandPlaceholder: "<completion-evidence-input.expectArgs>",
        generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
      },
      {
        consumerStepId: "verify-final-proof-bundle",
        sourceStepId: "fingerprint-final-proof-bundle-inputs",
        expectProfile: "final-proof-bundle-inputs",
        reportPath: "<final-proof-bundle-input-fingerprints.json>",
        commandPlaceholder: "<final-proof-bundle-inputs.expectArgs>",
        generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
      },
      {
        consumerStepId: "audit-goal-completion",
        sourceStepId: "fingerprint-goal-completion-input",
        expectProfile: "goal-completion-input",
        reportPath: "<goal-completion-input-fingerprint.json>",
        commandPlaceholder: "<goal-completion-input.expectArgs>",
        generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
      }
    ],
    requiresSavedVerifierOutput: true,
    requiresReportFingerprintPin: true,
    requiresAcceptanceReportFingerprintPin: true,
    requiresFinalProofBundleOutputGate: true,
    requiresSourceEvidenceSemanticsProfileGate: true,
    requiresEvidenceSourcesFingerprintLinkageGate: true,
    requiresPathFreeArtifactFingerprintReports: true,
    requiresGoalCompletionAudit: true,
    requiresDisposableProjectCopies: true,
    requiresPromotedReferenceSidecars: true
  },
  completionEvidenceRequirements: {
    id: "reference-import-goal-completion-evidence",
    checkedInSmokeDoesNotCompleteGoal: true,
    requiresPrivateCorpus: true,
    requiredPrivateEvidence: [
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
    ],
    finalCompletionGate: "fingerprint-pinned finalPrivateAcceptanceProfile verifier output plus path-free completion evidence manifest with sourceEvidenceSemantics, accepted final proof bundle check with finalAcceptanceCheckAcceptedVerifierValuePolicyOk, completionEvidenceRequiredValuePolicyOk, completionEvidenceArtifactPolicyOk, proofPlanFingerprint, sourceEvidenceSemanticsProfileOk, evidenceSourcesFingerprintAlignedOk, adapter preflight/sourceAdapter evidence, target-format policy, family/source-evidence policy, saved-report identity/fingerprint/gate/linkage policy, completion-artifact policy, pathFreeBundleValuesOk, finalProofBundleInputPathsOk, finalProofBundlePathPrivacyOk, requiredEvidenceMinimums, expected final proof bundle check fingerprint, saved 100 percent goal completion audit with goalCompletionOutputWritableOk, and disposable project/reference artifacts",
    missingEvidenceRecommendedAction: "run-private-end-to-end-proof-plan"
  },
  scaleGate: {
    flag: "--min-source-file-size-bytes",
    valueSource: "private production threshold",
    exampleBytes: 100000000
  }
};

function proofPlanFingerprintPayload(plan = {}) {
  const { proofPlanFingerprint, ...payload } = plan;
  return payload;
}

FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.proofPlanFingerprint = fileFingerprint(
  JSON.stringify(proofPlanFingerprintPayload(FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan))
);

const SOURCE_FILE_SUMMARY_FIELDS = new Set([
  "exists",
  "isFile",
  "extension",
  "formatFamily",
  "sizeBytes",
  "modifiedTime",
  "statFingerprint"
]);
const WORKFLOW_SUMMARY_FIELDS = new Set([
  "id",
  "ok",
  "runStatus",
  "stopReason",
  "startStage",
  "targetStage",
  "finalStage",
  "completedStages",
  "responseCount",
  "finalResponseStatus",
  "finalSafeNextAction",
  "blockedStage",
  "blockedReason",
  "blockedSafeNextAction",
  "finalFingerprintSummary",
  "source",
  "referenceCounts",
  "audit",
  "rawResponsesIncluded",
  "runtimeBoundary"
]);
const WORKFLOW_RUNTIME_BOUNDARY_FIELDS = new Set([
  "browserRuntimeExecutesCli",
  "workflowRunnerUsesWorkspaceHost",
  "workflowRunnerRunsShell",
  "browserRuntimeWritesProjectJson",
  "browserRuntimeWritesReferenceFiles"
]);
const AUDIT_SUMMARY_FIELDS = new Set([
  "readyCount",
  "needsAttentionCount",
  "errorCount",
  "likelyFixArea",
  "recommendedNextAction"
]);
const TOP_LEVEL_RUNTIME_BOUNDARY_FIELDS = new Set([
  "shell",
  "invokesWorkflowRunnerOnly",
  "workflowRunnerUsesWorkspaceHost",
  "browserRuntimeExecutesCli",
  "defaultTargetStage",
  "importWritesRequireAllowFlag"
]);
const ACCEPTANCE_FIELDS = new Set([
  "accepted",
  "recommendedNextAction",
  "reason",
  "caseCount",
  "allCasesPassed",
  "requiredFormatCoverageOk",
  "externalAdapterCoverageOk",
  "requiredExternalAdapterFamilies",
  "presentExternalAdapterFamilies",
  "externalAdapterMissingFamilies",
  "sourceEvidenceReady",
  "performanceEvidenceReady",
  "failedCaseIds",
  "missingFormatFamilies",
  "sourceEvidenceMissingCaseIds",
  "performanceEvidenceMissingCaseIds"
]);
const PERFORMANCE_FIELDS = new Set([
  "totalDurationMs",
  "maxDurationMs",
  "maxDurationCaseId",
  "caseDurations"
]);
const PERFORMANCE_CASE_DURATION_FIELDS = new Set([
  "id",
  "durationMs",
  "sourceFileSizeBytes",
  "sourceStatFingerprint"
]);
const COVERAGE_FIELDS = new Set([
  "coverageOk",
  "requiredFormatFamilies",
  "presentFormatFamilies",
  "missingFormatFamilies",
  "caseFormatFamilies"
]);
const COVERAGE_CASE_FORMAT_FIELDS = new Set([
  "id",
  "formatFamily",
  "sourceToken",
  "source"
]);
const COVERAGE_CASE_SOURCES = new Set([
  "formatToken",
  "inputPathExtension"
]);
const DEFAULTS_FIELDS = new Set([
  "targetStage",
  "caseTimeoutMs",
  "minSourceFileSizeBytes",
  "requiredFormatFamilies",
  "requiredExternalAdapterFamilies",
  "failFast",
  "allowImportWrites",
  "requirePromotedImportWrites"
]);
const SELECTION_FIELDS = new Set([
  "includeTags",
  "excludeTags",
  "selectedCaseCount",
  "runCaseCount",
  "skippedCaseCount",
  "skippedCaseIds"
]);
const CASE_REPORT_FIELDS = new Set([
  "id",
  "label",
  "ok",
  "enabled",
  "startedAt",
  "finishedAt",
  "durationMs",
  "timeoutMs",
  "sourceFile",
  "process",
  "workflow",
  "assertions",
  "errors",
  "stderrExcerpt",
  "stdoutParseError",
  "request"
]);
const ASSERTION_SUMMARY_FIELDS = new Set([
  "field",
  "ok",
  "expected",
  "expectedMinimum",
  "expectedMaximum",
  "actual",
  "message"
]);

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_corpus_report.mjs --report <report.json> [options]",
    "",
    "Verifies a saved referenceImportCorpusCheck report as final private/production corpus evidence.",
    "This command reads only the bounded report JSON; it does not read source files, project files, or adapter configs.",
    "",
    "Options:",
    "  --report <path>         Saved report emitted by check_reference_import_corpus.mjs --output.",
    "  --output <path>         Optional machine-readable verification report path.",
    "  --expect-report-fingerprint <sha256:hex>  Require the saved report bytes to match this fingerprint.",
    "  --require-format-families <csv>  Require accepted report coverage for these source families.",
    "  --require-external-adapter-families <csv>  Require these source families to have accepted external-adapter cases with adapter id/request/config/preflight fingerprint evidence.",
    "  --require-point-cloud-families <csv>  Require these source families to have accepted point-cloud point evidence.",
    "  --min-source-file-size-bytes <bytes>  Require every accepted case source summary to meet this size.",
    "  --require-nonempty-reference-geometry  Require every accepted case to report at least one canonical object and primitive.",
    "  --require-promoted-import-writes  Require accepted report to prove confirmed import-stage cases.",
    "  --list-contract         Print the verifier contract and exit.",
    "  --help                  Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    reportPath: "",
    outputPath: "",
    expectedReportFingerprint: "",
    requiredFormatFamilies: [],
    requiredExternalAdapterFamilies: [],
    requiredPointCloudFamilies: [],
    minSourceFileSizeBytes: 0,
    requireNonemptyReferenceGeometry: false,
    requirePromotedImportWrites: false,
    listContract: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
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
    if (arg === "--expect-report-fingerprint") {
      options.expectedReportFingerprint = reportFingerprintValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--require-format-families") {
      options.requiredFormatFamilies = formatFamilyList(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--require-external-adapter-families") {
      options.requiredExternalAdapterFamilies = formatFamilyList(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--require-point-cloud-families") {
      options.requiredPointCloudFamilies = formatFamilyList(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--min-source-file-size-bytes") {
      options.minSourceFileSizeBytes = positiveInteger(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--require-promoted-import-writes") {
      options.requirePromotedImportWrites = true;
      continue;
    }
    if (arg === "--require-nonempty-reference-geometry") {
      options.requireNonemptyReferenceGeometry = true;
      continue;
    }
    if (arg === "--list-contract") {
      options.listContract = true;
      continue;
    }
    throw new Error("Unknown option.");
  }
  return options;
}

function contract() {
  return {
    id: "referenceImportCorpusAcceptanceReportContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    acceptedReportId: CORPUS_REPORT_ID,
    inputBoundary: {
      readsSavedCorpusReportOnly: true,
      readsPrivateSourceFiles: false,
      readsProjectFiles: false,
      readsAdapterConfigs: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    verificationOutputContract: {
      topLevelFields: VERIFICATION_REPORT_FIELDS,
      finalPrivateAcceptanceSummaryFields: FINAL_PRIVATE_ACCEPTANCE_SUMMARY_FIELDS,
      gateFields: VERIFICATION_GATE_FIELDS,
      summaryFields: VERIFICATION_SUMMARY_FIELDS
    },
    runtimeBoundaryEvidenceContract: {
      topLevelPath: "runtimeBoundary",
      topLevelFields: [...TOP_LEVEL_RUNTIME_BOUNDARY_FIELDS],
      topLevelRequiredValues: {
        invokesWorkflowRunnerOnly: true,
        workflowRunnerUsesWorkspaceHost: true,
        shell: false,
        browserRuntimeExecutesCli: false,
        defaultTargetStage: "dry-run",
        importWritesRequireAllowFlag: true
      },
      workflowPath: "cases[].workflow.runtimeBoundary",
      workflowFields: [...WORKFLOW_RUNTIME_BOUNDARY_FIELDS],
      workflowRequiredValues: {
        browserRuntimeExecutesCli: false,
        workflowRunnerUsesWorkspaceHost: true,
        workflowRunnerRunsShell: false,
        browserRuntimeWritesProjectJson: false,
        browserRuntimeWritesReferenceFiles: false
      },
      topLevelGateField: "topLevelRuntimeBoundaryIssues",
      workflowGateField: "workflowRuntimeBoundaryInvalidCaseIds"
    },
    externalAdapterEvidenceContract: {
      sourceSummaryPath: "cases[].workflow.source",
      fields: EXTERNAL_ADAPTER_EVIDENCE_FIELDS,
      targetFormatTokens: FAMILY_TARGET_FORMAT_TOKENS,
      requiredTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
      requiredForTranslationMode: "external-adapter",
      forbiddenForTranslationModes: ["built-in", "canonical-json"],
      selectedFamilyGateFlag: "--require-external-adapter-families",
      reportDefaultGateField: "defaults.requiredExternalAdapterFamilies",
      cliOverridesReportDefault: true,
      weakEvidenceGateField: "weakExternalAdapterEvidenceCaseIds",
      sourceAdapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_OBJECT_KEYS]
      },
      sourceAdapterAssertionField: "sourceAdapter",
      sourceAdapterAssertionGateField: "missingExternalAdapterSourceAdapterAssertionCaseIds",
      sourceAdapterKeysSummaryField: "summary.externalAdapterSourceAdapterKeys",
      sourceAdapterRequestEvidenceFingerprintsSummaryField: "summary.externalAdapterSourceAdapterRequestEvidenceFingerprints",
      sourceAdapterConfigStatFingerprintsSummaryField: "summary.externalAdapterSourceAdapterConfigStatFingerprints",
      sourceAdapterRegistryAggregateFingerprintsSummaryField: "summary.externalAdapterSourceAdapterRegistryAggregateFingerprints",
      sourceAdapterRegistryFingerprintsSummaryField: "summary.externalAdapterSourceAdapterRegistryFingerprints",
      sourceAdapterPreflightFingerprintsSummaryField: "summary.externalAdapterSourceAdapterPreflightFingerprints"
    },
    strictStringEvidenceContract: STRICT_STRING_EVIDENCE_CONTRACT,
    strictBooleanEvidenceContract: STRICT_BOOLEAN_EVIDENCE_CONTRACT,
    strictIntegerEvidenceContract: STRICT_INTEGER_EVIDENCE_CONTRACT,
    finalPrivateAcceptanceProfile: FINAL_PRIVATE_ACCEPTANCE_PROFILE,
    requiredAcceptedReportFields: [
      "id",
      "version",
      "ok",
      "caseCount",
      "failedCaseCount",
      "selection",
      "coverage",
      "performance",
      "acceptance",
      "runtimeBoundary",
      "cases"
    ],
    acceptanceGates: [
      "acceptance.accepted",
      "accepted report version evidence",
      "accepted report identity/path metadata evidence",
      "top-level accepted report bounded field evidence",
      "top-level numeric count type evidence",
      "acceptance summary bounded field evidence",
      "acceptance missing/evidence metadata consistency",
      "accepted case id uniqueness evidence",
      "required format family coverage",
      "coverage case/present/missing metadata consistency",
      "coverage case source-token metadata consistency",
      "coverage summary bounded field evidence",
      "defaults metadata consistency",
      "defaults summary bounded field evidence",
      "per-case source stat fingerprint",
      "per-case source exists/isFile literal evidence",
      "per-case source file summary bounded field evidence",
      "per-case source file size safe-integer evidence",
      "per-case source extension/family evidence",
      "per-case workflow source summary bounded field evidence",
      "non-external translation modes have empty adapter request/config/preflight fingerprint evidence",
      "per-case source format token/alias evidence",
      "per-case source modified-time evidence",
      "per-case workflow/source/coverage family alignment",
      "per-case timing/timeout evidence",
      "per-case duration/timestamp alignment evidence",
      "per-case source size",
      "per-case duration/performance evidence aligned to case/source summaries",
      "performance summary nonnegative duration/id evidence",
      "performance summary bounded field evidence",
      "performance duration summary nonnegative duration/source-stat evidence",
      "top-level case id/count/selection consistency",
      "top-level skipped case id uniqueness/disjoint evidence",
      "top-level selection bounded field evidence",
      "top-level runtime boundary/write-safety consistency",
      "top-level runtime boundary bounded field evidence",
      "path-free corpus metadata",
      "path-free verifier output metadata",
      "path-free verifier report identity output metadata",
      "verified report content fingerprint",
      "optional expected report fingerprint gate",
      "path-free verifier error metadata",
      "path-free verifier failure-label metadata",
      "bounded workflow summaries without raw response envelopes",
      "accepted case summary bounded field evidence",
      "accepted assertion summary bounded field evidence",
      "accepted assertion summary bounded value evidence",
      "accepted workflow summary bounded field evidence",
      "accepted workflow audit summary bounded field evidence",
      "accepted workflow runtime boundary browser no-cli evidence",
      "accepted workflow runtime boundary evidence",
      "accepted workflow runtime boundary bounded field evidence",
      "accepted workflow response summary evidence",
      "accepted workflow stage completion evidence",
      "accepted case error/stderr/stdout-parse payload absence",
      "accepted process summary success/no-error evidence",
      "accepted process summary bounded field evidence",
      "accepted case identity metadata evidence",
      "accepted request summary stage/no-raw evidence",
      "accepted request summary bounded field evidence",
      "accepted request start-stage workflow alignment evidence",
      "per-case reference count summary evidence",
      "per-case final fingerprint summary evidence",
      "optional nonempty canonical reference geometry evidence",
      "complete external-adapter adapter id/request/config/preflight fingerprint evidence for every accepted external-adapter case",
      "optional point-cloud evidence for selected source families",
      "optional promoted import write evidence"
    ],
    cliFlags: [
      "--report",
      "--output",
      "--expect-report-fingerprint",
      "--require-format-families",
      "--require-external-adapter-families",
      "--require-point-cloud-families",
      "--min-source-file-size-bytes",
      "--require-nonempty-reference-geometry",
      "--require-promoted-import-writes",
      "--list-contract",
      "--help"
    ]
  };
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function positiveInteger(value, flag) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${flag} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function reportFingerprintValue(value, flag) {
  const text = String(value || "").trim();
  if (!SHA256_FINGERPRINT.test(text)) {
    throw new Error(`${flag} must be sha256:<64 lowercase hex>`);
  }
  return text;
}

function reportFingerprintMatchesExpected(options = {}, reportFingerprint = "") {
  if (!options.expectedReportFingerprint) return null;
  return reportFingerprint === options.expectedReportFingerprint;
}

function formatFamilyList(value, flag = "requiredFormatFamilies") {
  const families = [];
  const seen = new Set();
  for (const item of String(value || "").split(",")) {
    const family = SOURCE_FORMAT_FAMILIES.get(String(item || "").trim().toLowerCase()) || "";
    if (!family) {
      throw new Error(`${flag} contains unsupported source format family`);
    }
    if (seen.has(family)) continue;
    seen.add(family);
    families.push(family);
  }
  if (families.length < 1) {
    throw new Error(`${flag} must contain at least one source format family`);
  }
  return families;
}

function formatFamilyToken(value) {
  if (typeof value !== "string") return "";
  return SOURCE_FORMAT_FAMILIES.get(String(value || "").trim().toLowerCase()) || "";
}

function canonicalFormatFamilyTokenOk(value) {
  if (typeof value !== "string") return false;
  const text = value;
  return text.length > 0 && SOURCE_FORMAT_FAMILIES.get(text) === text;
}

function requiredStageTokenOk(value) {
  return typeof value === "string" && STAGE_IDS.has(value);
}

function optionalStageTokenOk(value) {
  return typeof value === "string" && (value === "" || STAGE_IDS.has(value));
}

function isPathFreeReportName(value) {
  if (typeof value !== "string") return false;
  const text = value;
  return text.length > 0
    && text.length <= 200
    && !/[\\/:]/.test(text)
    && !text.includes("..")
    && !/[\u0000-\u001f]/.test(text);
}

function pathFreeInputFileName(value) {
  const text = String(value || "");
  const name = text.split(/[\\/]/).pop() || "";
  return isPathFreeReportName(name) ? name : "";
}

function safeTokenList(value, pattern) {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  const tokens = value;
  return tokens.every((entry) => pattern.test(entry)) ? tokens : null;
}

function safeCaseId(value) {
  return typeof value === "string" && SAFE_CASE_ID.test(value);
}

function fingerprintValueOk(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

function canonicalFamilyList(value) {
  if (!Array.isArray(value)) return null;
  const families = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const text = entry;
    const family = SOURCE_FORMAT_FAMILIES.get(text) || "";
    if (!family || family !== text || seen.has(family)) return null;
    seen.add(family);
    families.push(family);
  }
  return families;
}

function sameStringList(left = [], right = []) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function uniqueStringList(value = []) {
  return Array.isArray(value) && new Set(value).size === value.length;
}

function disjointStringLists(left = [], right = []) {
  const rightValues = new Set(right);
  return left.every((entry) => !rightValues.has(entry));
}

function safeIntegerEquals(value, expected) {
  return Number.isSafeInteger(value) && value === expected;
}

function isIsoModifiedTime(value) {
  if (typeof value !== "string") return false;
  const text = value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) return false;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === text;
}

function sourceExtensionMatchesFamily(extension, family) {
  if (typeof extension !== "string") return false;
  const text = extension;
  if (text === "") return true;
  return SAFE_SOURCE_EXTENSION.test(text) && formatFamilyToken(text) === family;
}

function coverageCaseSourceTokenMatchesFamily(entry, family) {
  if (typeof entry?.sourceToken !== "string") return false;
  const rawSourceToken = entry.sourceToken;
  const sourceToken = rawSourceToken.trim().toLowerCase();
  return sourceToken.length > 0
    && rawSourceToken === sourceToken
    && SOURCE_FORMAT_FAMILIES.has(sourceToken)
    && formatFamilyToken(sourceToken) === family;
}

function coverageCaseSourceBounded(entry) {
  return typeof entry?.source === "string" && COVERAGE_CASE_SOURCES.has(entry.source);
}

function fileFingerprint(raw) {
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

function readReportFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`${label} must be readable JSON`);
  }
  const reportFingerprint = fileFingerprint(raw);
  try {
    return {
      report: JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, "")),
      reportFingerprint,
      failures: []
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { report: null, reportFingerprint, failures: [`${label} must be valid JSON`] };
    }
    return { report: null, reportFingerprint, failures: [`${label} must be readable JSON`] };
  }
}

function verifyReport(report, options, reportFingerprint = "") {
  const failures = [];
  const warnings = [];
  const cases = Array.isArray(report?.cases) ? report.cases : [];
  const performanceEntries = Array.isArray(report?.performance?.caseDurations) ? report.performance.caseDurations : [];
  const performanceDurationsByCaseId = new Map();
  const performanceMetadataIssues = [];
  const unsafePerformanceCaseIds = [];
  const duplicatePerformanceCaseIds = [];
  const performanceDurationSummaryInvalidCaseIds = [];
  if (!report?.performance || typeof report.performance !== "object" || Array.isArray(report.performance)) {
    performanceMetadataIssues.push("performance-object");
  } else if (!Object.keys(report.performance).every((field) => PERFORMANCE_FIELDS.has(field))) {
    performanceMetadataIssues.push("performance-fields-bounded");
  }
  for (const [index, entry] of performanceEntries.entries()) {
    const id = safeCaseId(entry?.id) ? entry.id : "";
    if (!id) {
      unsafePerformanceCaseIds.push(`unsafe_id_${index + 1}`);
      continue;
    }
    if (
      performanceDurationSummaryShapeOk(entry) !== true
    ) {
      performanceDurationSummaryInvalidCaseIds.push(id);
    }
    if (performanceDurationsByCaseId.has(id)) {
      duplicatePerformanceCaseIds.push(id);
      continue;
    }
    performanceDurationsByCaseId.set(id, entry);
  }
  const coverageCaseEntries = Array.isArray(report?.coverage?.caseFormatFamilies) ? report.coverage.caseFormatFamilies : [];
  const coverageCaseFamilies = new Map();
  const coverageMetadataIssues = [];
  if (!report?.coverage || typeof report.coverage !== "object" || Array.isArray(report.coverage)) {
    coverageMetadataIssues.push("coverage-object");
  } else if (!Object.keys(report.coverage).every((field) => COVERAGE_FIELDS.has(field))) {
    coverageMetadataIssues.push("coverage-fields-bounded");
  }
  if (!Array.isArray(report?.coverage?.caseFormatFamilies)) {
    coverageMetadataIssues.push("coverage.caseFormatFamilies-array");
  } else if (coverageCaseEntries.length !== cases.length) {
    coverageMetadataIssues.push("coverage.caseFormatFamilies-count-aligned");
  }
  for (const entry of coverageCaseEntries) {
    const id = safeCaseId(entry?.id) ? entry.id : "";
    const rawFamily = typeof entry?.formatFamily === "string" ? entry.formatFamily : "";
    const family = formatFamilyToken(rawFamily);
    if (!id) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-safe-ids");
      continue;
    }
    if (
      !entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || !Object.keys(entry).every((field) => COVERAGE_CASE_FORMAT_FIELDS.has(field))
    ) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-fields-bounded");
    }
    if (coverageCaseFamilies.has(id)) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-unique-ids");
      continue;
    }
    if (!canonicalFormatFamilyTokenOk(rawFamily)) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-canonical-families");
      continue;
    }
    if (!coverageCaseSourceTokenMatchesFamily(entry, family)) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-source-token-aligned");
    }
    if (!coverageCaseSourceBounded(entry)) {
      coverageMetadataIssues.push("coverage.caseFormatFamilies-source-bounded");
    }
    coverageCaseFamilies.set(id, family);
  }
  const reportPresentFormatFamilies = canonicalFamilyList(report?.coverage?.presentFormatFamilies);
  const reportRequiredFormatFamilies = canonicalFamilyList(report?.coverage?.requiredFormatFamilies);
  const reportMissingFormatFamilies = canonicalFamilyList(report?.coverage?.missingFormatFamilies);
  const presentFormatFamilies = reportPresentFormatFamilies || [];
  const requiredFormatFamilies = options.requiredFormatFamilies.length > 0
    ? options.requiredFormatFamilies
    : reportRequiredFormatFamilies || [];
  const missingFormatFamilies = requiredFormatFamilies.filter((family) => !presentFormatFamilies.includes(family));
  const defaultsRequiredFormatFamilies = canonicalFamilyList(report?.defaults?.requiredFormatFamilies);
  const defaultsRequiredExternalAdapterFamilies = canonicalFamilyList(report?.defaults?.requiredExternalAdapterFamilies);
  const effectiveRequiredExternalAdapterFamilies = options.requiredExternalAdapterFamilies.length > 0
    ? options.requiredExternalAdapterFamilies
    : defaultsRequiredExternalAdapterFamilies || [];
  if (!reportPresentFormatFamilies) coverageMetadataIssues.push("coverage.presentFormatFamilies-canonical-unique-array");
  if (!reportRequiredFormatFamilies) coverageMetadataIssues.push("coverage.requiredFormatFamilies-canonical-unique-array");
  if (!reportMissingFormatFamilies) {
    coverageMetadataIssues.push("coverage.missingFormatFamilies-canonical-unique-array");
  } else if (reportMissingFormatFamilies.length !== 0) {
    coverageMetadataIssues.push("coverage.missingFormatFamilies-empty");
  }
  if (reportMissingFormatFamilies && !sameStringList(reportMissingFormatFamilies, missingFormatFamilies)) {
    coverageMetadataIssues.push("coverage.missingFormatFamilies-aligned");
  }
  const failedCaseIds = [];
  const acceptedCaseIds = [];
  const duplicateAcceptedCaseIds = [];
  const sourceEvidenceMissingCaseIds = [];
  const sourceSizeFailedCaseIds = [];
  const performanceEvidenceMissingCaseIds = [];
  const performanceEvidenceMismatchCaseIds = [];
  const promotedImportEvidenceMissingCaseIds = [];
  const acceptedFormatFamilyCaseIds = new Map();
  const sourceFamilyMismatchCaseIds = [];
  const coverageCaseFamilyMismatchCaseIds = [];
  const sourceFileSummaryInvalidCaseIds = [];
  const sourceExtensionInvalidCaseIds = [];
  const sourceSummaryInvalidCaseIds = [];
  const sourceFormatSummaryInvalidCaseIds = [];
  const sourceModifiedTimeInvalidCaseIds = [];
  const caseTimingInvalidCaseIds = [];
  const externalAdapterFamilyCaseIds = new Map();
  const externalAdapterSourceAdapterKeys = new Map();
  const externalAdapterSourceAdapterRequestEvidenceFingerprints = new Map();
  const externalAdapterSourceAdapterConfigStatFingerprints = new Map();
  const externalAdapterSourceAdapterRegistryAggregateFingerprints = new Map();
  const externalAdapterSourceAdapterRegistryFingerprints = new Map();
  const externalAdapterSourceAdapterPreflightFingerprints = new Map();
  const weakExternalAdapterEvidenceCaseIds = [];
  const missingExternalAdapterSourceAdapterAssertionCaseIds = [];
  const pointCloudFamilyCaseIds = new Map();
  const emptyReferenceGeometryCaseIds = [];
  const referenceCountInvalidCaseIds = [];
  const rawPayloadLeakCaseIds = [];
  const caseSummaryInvalidCaseIds = [];
  const caseIdentityInvalidCaseIds = [];
  const assertionSummaryInvalidCaseIds = [];
  const workflowSummaryInvalidCaseIds = [];
  const workflowRuntimeBoundaryInvalidCaseIds = [];
  const workflowResponseSummaryInvalidCaseIds = [];
  const workflowStageInvalidCaseIds = [];
  const caseDiagnosticPayloadCaseIds = [];
  const processSummaryInvalidCaseIds = [];
  const requestSummaryInvalidCaseIds = [];
  const rawDebugRequestCaseIds = [];
  const fingerprintSummaryInvalidCaseIds = [];
  const topLevelReportMetadataIssues = [];
  const acceptanceMetadataIssues = [];
  const topLevelCaseMetadataIssues = [];
  const topLevelRuntimeBoundaryIssues = [];
  const defaultsMetadataIssues = [];
  if (options.expectedReportFingerprint && reportFingerprint !== options.expectedReportFingerprint) {
    failures.push("report fingerprint mismatch");
  }
  let acceptanceRequiredExternalAdapterFamilies = null;
  let acceptancePresentExternalAdapterFamilies = null;
  let acceptanceMissingExternalAdapterFamilies = null;

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    failures.push("report must be a JSON object");
    topLevelReportMetadataIssues.push("report-object");
  } else if (!Object.keys(report).every((field) => ACCEPTED_REPORT_FIELDS.has(field))) {
    topLevelReportMetadataIssues.push("report-fields-bounded");
  }
  if (report?.id !== CORPUS_REPORT_ID) topLevelReportMetadataIssues.push("report.id-supported");
  if (report?.version !== CHECK_VERSION) topLevelReportMetadataIssues.push("report.version-supported");
  if (report?.ok !== true) failures.push("report.ok must be true");
  if (!report?.acceptance || typeof report.acceptance !== "object" || Array.isArray(report.acceptance)) {
    acceptanceMetadataIssues.push("acceptance-object");
  } else {
    if (!Object.keys(report.acceptance).every((field) => ACCEPTANCE_FIELDS.has(field))) {
      acceptanceMetadataIssues.push("acceptance-fields-bounded");
    }
    if (!safeIntegerEquals(report.acceptance.caseCount, cases.length)) {
      acceptanceMetadataIssues.push("acceptance.caseCount-aligned");
    }
    const acceptanceMissingFormatFamilies = canonicalFamilyList(report.acceptance.missingFormatFamilies);
    if (!acceptanceMissingFormatFamilies) {
      acceptanceMetadataIssues.push("acceptance.missingFormatFamilies-canonical-unique-array");
    } else {
      if (acceptanceMissingFormatFamilies.length !== 0) {
        acceptanceMetadataIssues.push("acceptance.missingFormatFamilies-empty");
      }
      if (reportMissingFormatFamilies && !sameStringList(acceptanceMissingFormatFamilies, reportMissingFormatFamilies)) {
        acceptanceMetadataIssues.push("acceptance.missingFormatFamilies-aligned");
      }
    }
    acceptanceRequiredExternalAdapterFamilies = canonicalFamilyList(report.acceptance.requiredExternalAdapterFamilies);
    acceptancePresentExternalAdapterFamilies = canonicalFamilyList(report.acceptance.presentExternalAdapterFamilies);
    acceptanceMissingExternalAdapterFamilies = canonicalFamilyList(report.acceptance.externalAdapterMissingFamilies);
    if (report.acceptance.externalAdapterCoverageOk !== true) {
      acceptanceMetadataIssues.push("acceptance.externalAdapterCoverageOk-true");
    }
    if (!acceptanceRequiredExternalAdapterFamilies) {
      acceptanceMetadataIssues.push("acceptance.requiredExternalAdapterFamilies-canonical-unique-array");
    } else if (
      defaultsRequiredExternalAdapterFamilies
      && !sameStringList(acceptanceRequiredExternalAdapterFamilies, defaultsRequiredExternalAdapterFamilies)
    ) {
      acceptanceMetadataIssues.push("acceptance.requiredExternalAdapterFamilies-defaults-aligned");
    }
    if (!acceptancePresentExternalAdapterFamilies) {
      acceptanceMetadataIssues.push("acceptance.presentExternalAdapterFamilies-canonical-unique-array");
    }
    if (!acceptanceMissingExternalAdapterFamilies) {
      acceptanceMetadataIssues.push("acceptance.externalAdapterMissingFamilies-canonical-unique-array");
    } else if (acceptanceMissingExternalAdapterFamilies.length !== 0) {
      acceptanceMetadataIssues.push("acceptance.externalAdapterMissingFamilies-empty");
    }
    const acceptanceSourceEvidenceMissingCaseIds = safeTokenList(report.acceptance.sourceEvidenceMissingCaseIds, SAFE_CASE_ID);
    if (!acceptanceSourceEvidenceMissingCaseIds) {
      acceptanceMetadataIssues.push("acceptance.sourceEvidenceMissingCaseIds-safe-array");
    } else if (acceptanceSourceEvidenceMissingCaseIds.length !== 0) {
      acceptanceMetadataIssues.push("acceptance.sourceEvidenceMissingCaseIds-empty");
    }
    const acceptancePerformanceEvidenceMissingCaseIds = safeTokenList(report.acceptance.performanceEvidenceMissingCaseIds, SAFE_CASE_ID);
    if (!acceptancePerformanceEvidenceMissingCaseIds) {
      acceptanceMetadataIssues.push("acceptance.performanceEvidenceMissingCaseIds-safe-array");
    } else if (acceptancePerformanceEvidenceMissingCaseIds.length !== 0) {
      acceptanceMetadataIssues.push("acceptance.performanceEvidenceMissingCaseIds-empty");
    }
  }
  if (report?.acceptance?.accepted !== true) failures.push("acceptance.accepted must be true");
  if (report?.acceptance?.recommendedNextAction !== "accept-reference-import-corpus") failures.push("acceptance.recommendedNextAction must be accept-reference-import-corpus");
  if (report?.acceptance?.reason !== "corpus-accepted") failures.push("acceptance.reason must be corpus-accepted");
  if (report?.acceptance?.allCasesPassed !== true) failures.push("acceptance.allCasesPassed must be true");
  if (report?.acceptance?.requiredFormatCoverageOk !== true) failures.push("acceptance.requiredFormatCoverageOk must be true");
  if (report?.acceptance?.externalAdapterCoverageOk !== true) failures.push("acceptance.externalAdapterCoverageOk must be true");
  if (report?.acceptance?.sourceEvidenceReady !== true) failures.push("acceptance.sourceEvidenceReady must be true");
  if (report?.acceptance?.performanceEvidenceReady !== true) failures.push("acceptance.performanceEvidenceReady must be true");
  if (!isPathFreeReportName(report?.configPath)) topLevelReportMetadataIssues.push("report.configPath-path-free");
  if (report?.workflowRunnerPath !== WORKFLOW_RUNNER_REPORT_PATH) {
    topLevelReportMetadataIssues.push("report.workflowRunnerPath-supported");
  }
  if (topLevelReportMetadataIssues.length > 0) {
    failures.push(`invalid top-level report metadata: ${[...new Set(topLevelReportMetadataIssues)].sort().join(", ")}`);
  }
  if (report?.coverage?.coverageOk !== true) failures.push("coverage.coverageOk must be true");
  if (missingFormatFamilies.length > 0) failures.push(`required format families missing: ${missingFormatFamilies.join(", ")}`);
  if (coverageMetadataIssues.length > 0) {
    failures.push(`invalid coverage metadata: ${[...new Set(coverageMetadataIssues)].sort().join(", ")}`);
  }
  if (!report?.defaults || typeof report.defaults !== "object" || Array.isArray(report.defaults)) {
    defaultsMetadataIssues.push("defaults-object");
  } else {
    if (!Object.keys(report.defaults).every((field) => DEFAULTS_FIELDS.has(field))) {
      defaultsMetadataIssues.push("defaults-fields-bounded");
    }
    if (typeof report.defaults.targetStage !== "string" || !STAGE_IDS.has(report.defaults.targetStage)) {
      defaultsMetadataIssues.push("defaults.targetStage-known");
    }
    if (!Number.isSafeInteger(report.defaults.caseTimeoutMs) || report.defaults.caseTimeoutMs < 0) {
      defaultsMetadataIssues.push("defaults.caseTimeoutMs-nonnegative-integer");
    }
    if (!Number.isSafeInteger(report.defaults.minSourceFileSizeBytes) || report.defaults.minSourceFileSizeBytes < 0) {
      defaultsMetadataIssues.push("defaults.minSourceFileSizeBytes-nonnegative-integer");
    }
    if (!defaultsRequiredFormatFamilies) {
      defaultsMetadataIssues.push("defaults.requiredFormatFamilies-canonical-unique-array");
    } else if (reportRequiredFormatFamilies && !sameStringList(defaultsRequiredFormatFamilies, reportRequiredFormatFamilies)) {
      defaultsMetadataIssues.push("defaults.requiredFormatFamilies-aligned");
    }
    if (!defaultsRequiredExternalAdapterFamilies) {
      defaultsMetadataIssues.push("defaults.requiredExternalAdapterFamilies-canonical-unique-array");
    }
    for (const field of ["failFast", "allowImportWrites", "requirePromotedImportWrites"]) {
      if (typeof report.defaults[field] !== "boolean") defaultsMetadataIssues.push(`defaults.${field}-boolean`);
    }
  }
  if (defaultsMetadataIssues.length > 0) {
    failures.push(`invalid defaults metadata: ${[...new Set(defaultsMetadataIssues)].sort().join(", ")}`);
  }
  if (!Array.isArray(report?.errors) || report.errors.length !== 0) failures.push("report.errors must be an empty array");
  if (!Array.isArray(report?.cases) || cases.length < 1) failures.push("cases must contain at least one accepted case");
  if (!safeIntegerEquals(report?.caseCount, cases.length)) failures.push("caseCount must be a safe integer matching cases.length");
  if (!safeIntegerEquals(report?.failedCaseCount, 0)) failures.push("failedCaseCount must be the safe integer 0");
  if (!safeIntegerEquals(report?.passedCaseCount, cases.length)) failures.push("passedCaseCount must be a safe integer matching cases.length");
  const reportFailedCaseIds = safeTokenList(report?.failedCaseIds, SAFE_CASE_ID);
  const acceptanceFailedCaseIds = safeTokenList(report?.acceptance?.failedCaseIds, SAFE_CASE_ID);
  const reportSkippedCaseIds = safeTokenList(report?.skippedCaseIds, SAFE_CASE_ID);
  const selectionSkippedCaseIds = safeTokenList(report?.selection?.skippedCaseIds, SAFE_CASE_ID);
  const selectionIncludeTags = safeTokenList(report?.selection?.includeTags, SAFE_TAG);
  const selectionExcludeTags = safeTokenList(report?.selection?.excludeTags, SAFE_TAG);
  const reportCaseIds = cases
    .map((entry) => (safeCaseId(entry?.id) ? entry.id : ""))
    .filter((id) => id);
  if (!report?.selection || typeof report.selection !== "object" || Array.isArray(report.selection)) {
    topLevelCaseMetadataIssues.push("selection-object");
  } else if (!Object.keys(report.selection).every((field) => SELECTION_FIELDS.has(field))) {
    topLevelCaseMetadataIssues.push("selection-fields-bounded");
  }
  if (!reportFailedCaseIds || reportFailedCaseIds.length !== 0) topLevelCaseMetadataIssues.push("failedCaseIds-empty-safe");
  if (!acceptanceFailedCaseIds || acceptanceFailedCaseIds.length !== 0) topLevelCaseMetadataIssues.push("acceptance.failedCaseIds-empty-safe");
  if (!reportSkippedCaseIds) topLevelCaseMetadataIssues.push("skippedCaseIds-safe-array");
  if (!selectionSkippedCaseIds) topLevelCaseMetadataIssues.push("selection.skippedCaseIds-safe-array");
  if (reportSkippedCaseIds && !uniqueStringList(reportSkippedCaseIds)) {
    topLevelCaseMetadataIssues.push("skippedCaseIds-unique");
  }
  if (selectionSkippedCaseIds && !uniqueStringList(selectionSkippedCaseIds)) {
    topLevelCaseMetadataIssues.push("selection.skippedCaseIds-unique");
  }
  if (reportSkippedCaseIds && !disjointStringLists(reportSkippedCaseIds, reportCaseIds)) {
    topLevelCaseMetadataIssues.push("skippedCaseIds-disjoint-from-accepted");
  }
  if (selectionSkippedCaseIds && !disjointStringLists(selectionSkippedCaseIds, reportCaseIds)) {
    topLevelCaseMetadataIssues.push("selection.skippedCaseIds-disjoint-from-accepted");
  }
  if (reportSkippedCaseIds && selectionSkippedCaseIds && !sameStringList(reportSkippedCaseIds, selectionSkippedCaseIds)) {
    topLevelCaseMetadataIssues.push("skippedCaseIds-selection-aligned");
  }
  if (reportSkippedCaseIds && !safeIntegerEquals(report?.skippedCaseCount, reportSkippedCaseIds.length)) {
    topLevelCaseMetadataIssues.push("skippedCaseCount-aligned");
  }
  if (selectionSkippedCaseIds && !safeIntegerEquals(report?.selection?.skippedCaseCount, selectionSkippedCaseIds.length)) {
    topLevelCaseMetadataIssues.push("selection.skippedCaseCount-aligned");
  }
  if (!safeIntegerEquals(report?.selection?.selectedCaseCount, cases.length)) topLevelCaseMetadataIssues.push("selection.selectedCaseCount-aligned");
  if (!safeIntegerEquals(report?.selection?.runCaseCount, cases.length)) topLevelCaseMetadataIssues.push("selection.runCaseCount-aligned");
  if (!selectionIncludeTags) topLevelCaseMetadataIssues.push("selection.includeTags-safe-array");
  if (!selectionExcludeTags) topLevelCaseMetadataIssues.push("selection.excludeTags-safe-array");
  if (selectionIncludeTags && selectionIncludeTags.length > SELECTION_TAG_LIST_MAX_ITEMS) {
    topLevelCaseMetadataIssues.push("selection.includeTags-bounded-count");
  }
  if (selectionExcludeTags && selectionExcludeTags.length > SELECTION_TAG_LIST_MAX_ITEMS) {
    topLevelCaseMetadataIssues.push("selection.excludeTags-bounded-count");
  }
  if (topLevelCaseMetadataIssues.length > 0) {
    failures.push(`invalid top-level case metadata: ${topLevelCaseMetadataIssues.join(", ")}`);
  }
  if (!report?.runtimeBoundary || typeof report.runtimeBoundary !== "object" || Array.isArray(report.runtimeBoundary)) {
    topLevelRuntimeBoundaryIssues.push("runtimeBoundary-object");
  } else {
    if (!Object.keys(report.runtimeBoundary).every((field) => TOP_LEVEL_RUNTIME_BOUNDARY_FIELDS.has(field))) {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary-fields-bounded");
    }
    if (report.runtimeBoundary.shell !== false) topLevelRuntimeBoundaryIssues.push("runtimeBoundary.shell-false");
    if (report.runtimeBoundary.invokesWorkflowRunnerOnly !== true) {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary.invokesWorkflowRunnerOnly-true");
    }
    if (report.runtimeBoundary.workflowRunnerUsesWorkspaceHost !== true) {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary.workflowRunnerUsesWorkspaceHost-true");
    }
    if (report.runtimeBoundary.browserRuntimeExecutesCli !== false) {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary.browserRuntimeExecutesCli-false");
    }
    if (report.runtimeBoundary.defaultTargetStage !== "dry-run") {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary.defaultTargetStage-dry-run");
    }
    if (report.runtimeBoundary.importWritesRequireAllowFlag !== true) {
      topLevelRuntimeBoundaryIssues.push("runtimeBoundary.importWritesRequireAllowFlag-true");
    }
  }
  if (topLevelRuntimeBoundaryIssues.length > 0) {
    failures.push(`invalid top-level runtime boundary metadata: ${[...new Set(topLevelRuntimeBoundaryIssues)].sort().join(", ")}`);
  }
  if (!Number.isSafeInteger(report?.performance?.totalDurationMs) || report.performance.totalDurationMs < 0) {
    performanceMetadataIssues.push("performance.totalDurationMs-nonnegative-integer");
  }
  if (!Number.isSafeInteger(report?.performance?.maxDurationMs) || report.performance.maxDurationMs < 0) {
    performanceMetadataIssues.push("performance.maxDurationMs-nonnegative-integer");
  }
  const performanceMaxDurationCaseId = safeCaseId(report?.performance?.maxDurationCaseId)
    ? report.performance.maxDurationCaseId
    : "";
  if (!reportCaseIds.includes(performanceMaxDurationCaseId)) {
    performanceMetadataIssues.push("performance.maxDurationCaseId-accepted-case");
  }
  if (!Number.isFinite(report?.performance?.totalDurationMs)) failures.push("performance.totalDurationMs must be finite");
  if (!Number.isFinite(report?.performance?.maxDurationMs)) failures.push("performance.maxDurationMs must be finite");
  if (!safeCaseId(report?.performance?.maxDurationCaseId)) failures.push("performance.maxDurationCaseId must be a safe case id");
  if (!Array.isArray(report?.performance?.caseDurations) || report.performance.caseDurations.length !== cases.length) {
    failures.push("performance.caseDurations must match accepted cases");
  }
  if (performanceMetadataIssues.length > 0) {
    failures.push(`invalid performance metadata: ${[...new Set(performanceMetadataIssues)].sort().join(", ")}`);
  }
  pushCaseFailures(failures, "unsafe performance case ids", unsafePerformanceCaseIds);
  pushCaseFailures(failures, "duplicate performance case ids", duplicatePerformanceCaseIds);
  pushCaseFailures(failures, "invalid performance duration summary field evidence", performanceDurationSummaryInvalidCaseIds);
  if (options.minSourceFileSizeBytes > 0 && Number(report?.defaults?.minSourceFileSizeBytes || 0) < options.minSourceFileSizeBytes) {
    failures.push(`defaults.minSourceFileSizeBytes must be at least ${options.minSourceFileSizeBytes}`);
  }
  if (options.requirePromotedImportWrites && report?.defaults?.requirePromotedImportWrites !== true) {
    failures.push("defaults.requirePromotedImportWrites must be true");
  }

  for (const entry of cases) {
    const caseId = safeCaseId(entry?.id) ? entry.id : "";
    if (!caseId) {
      failures.push("case id is unsafe");
      continue;
    }
    if (acceptedCaseIds.includes(caseId)) {
      duplicateAcceptedCaseIds.push(caseId);
    }
    acceptedCaseIds.push(caseId);
    if (
      !entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || !Object.keys(entry).every((field) => CASE_REPORT_FIELDS.has(field))
    ) {
      caseSummaryInvalidCaseIds.push(caseId);
    }
    if (caseIdentitySummaryOk(entry) !== true) {
      caseIdentityInvalidCaseIds.push(caseId);
    }
    if (caseTimingSummaryOk(entry) !== true) {
      caseTimingInvalidCaseIds.push(caseId);
    }
    if (entry.ok !== true) failedCaseIds.push(caseId);
    if (entry.process?.exitCode !== 0) failedCaseIds.push(caseId);
    const processSummaryOk = processSummaryShapeOk(entry.process)
      && entry.process.exitCode === 0
      && entry.process.signal === ""
      && entry.process.timedOut === false
      && entry.process.error === "";
    if (processSummaryOk !== true) {
      processSummaryInvalidCaseIds.push(caseId);
    }
    if (entry.workflow?.runStatus !== "completed") failedCaseIds.push(caseId);
    if (workflowSummaryShapeOk(entry.workflow) !== true || workflowSummaryValuesOk(entry.workflow) !== true) {
      workflowSummaryInvalidCaseIds.push(caseId);
    }
    if (entry.workflow?.rawResponsesIncluded !== false) rawPayloadLeakCaseIds.push(caseId);
    if (
      (Object.hasOwn(entry, "errors") && (!Array.isArray(entry.errors) || entry.errors.length !== 0))
      || (Object.hasOwn(entry, "stderrExcerpt") && entry.stderrExcerpt !== "")
      || (Object.hasOwn(entry, "stdoutParseError") && entry.stdoutParseError !== "")
    ) {
      caseDiagnosticPayloadCaseIds.push(caseId);
    }
    const runtimeBoundary = entry.workflow?.runtimeBoundary;
    const workflowRuntimeBoundaryOk = workflowRuntimeBoundaryShapeOk(runtimeBoundary)
      && runtimeBoundary.browserRuntimeExecutesCli === false
      && runtimeBoundary.workflowRunnerUsesWorkspaceHost === true
      && runtimeBoundary.workflowRunnerRunsShell === false
      && runtimeBoundary.browserRuntimeWritesProjectJson === false
      && runtimeBoundary.browserRuntimeWritesReferenceFiles === false;
    if (workflowRuntimeBoundaryOk !== true) {
      workflowRuntimeBoundaryInvalidCaseIds.push(caseId);
    }
    const request = entry.request;
    const requestTargetStage = typeof request?.targetStage === "string" ? request.targetStage : "";
    const requestStartStage = typeof request?.startStage === "string" ? request.startStage : null;
    const workflow = entry.workflow;
    const workflowStartStage = typeof workflow?.startStage === "string" ? workflow.startStage : "";
    const workflowTargetStage = typeof workflow?.targetStage === "string" ? workflow.targetStage : "";
    const workflowFinalStage = typeof workflow?.finalStage === "string" ? workflow.finalStage : "";
    const workflowBlockedStage = typeof workflow?.blockedStage === "string" ? workflow.blockedStage : null;
    const workflowCompletedStages = Array.isArray(workflow?.completedStages)
      ? workflow.completedStages
      : null;
    const workflowResponseSummaryOk = workflow
      && typeof workflow === "object"
      && !Array.isArray(workflow)
      && Number.isSafeInteger(workflow.responseCount)
      && workflow.responseCount > 0
      && workflow.responseCount === (workflowCompletedStages ? workflowCompletedStages.length : -1)
      && workflow.finalResponseStatus === "succeeded";
    if (workflowResponseSummaryOk !== true) {
      workflowResponseSummaryInvalidCaseIds.push(caseId);
    }
    const workflowStageOk = workflow
      && typeof workflow === "object"
      && !Array.isArray(workflow)
      && workflow.ok === true
      && workflow.runStatus === "completed"
      && requiredStageTokenOk(workflowTargetStage)
      && workflowTargetStage === requestTargetStage
      && workflowFinalStage === workflowTargetStage
      && Array.isArray(workflowCompletedStages)
      && workflowCompletedStages.length > 0
      && workflowCompletedStages.includes(workflowTargetStage)
      && workflowCompletedStages.every((stage) => requiredStageTokenOk(stage))
      && (workflow.stopReason === "" || workflow.stopReason === "target-stage-complete")
      && workflowBlockedStage === ""
      && workflow.blockedReason === "";
    if (workflowStageOk !== true) {
      workflowStageInvalidCaseIds.push(caseId);
    }
    const requestShapeOk = requestSummaryShapeOk(request)
      && requiredStageTokenOk(requestTargetStage)
      && optionalStageTokenOk(requestStartStage)
      && typeof request.confirmImport === "boolean"
      && typeof request.includeRawResponses === "boolean"
      && requestStartStage === workflowStartStage
      && requestTargetStage === workflowTargetStage;
    if (requestShapeOk !== true) {
      requestSummaryInvalidCaseIds.push(caseId);
    }
    if (request?.includeRawResponses === true) {
      rawDebugRequestCaseIds.push(caseId);
    }
    const workflowSourceFamily = formatFamilyToken(entry.workflow?.source?.sourceRequestedFormatFamily);
    const sourceFileFamily = formatFamilyToken(entry.sourceFile?.formatFamily);
    const coverageCaseFamily = coverageCaseFamilies.get(caseId) || "";
    const sourceFamily = workflowSourceFamily;
    if (sourceFileSummaryShapeOk(entry.sourceFile) !== true) {
      sourceFileSummaryInvalidCaseIds.push(caseId);
    }
    if (sourceSummaryShapeOk(entry.workflow?.source) !== true || sourceSummaryValuesOk(entry.workflow?.source) !== true) {
      sourceSummaryInvalidCaseIds.push(caseId);
    }
    if (sourceFormatSummaryOk(entry.workflow?.source, sourceFamily) !== true) {
      sourceFormatSummaryInvalidCaseIds.push(caseId);
    }
    if (!workflowSourceFamily || !sourceFileFamily || workflowSourceFamily !== sourceFileFamily) {
      sourceFamilyMismatchCaseIds.push(caseId);
    }
    if (sourceExtensionMatchesFamily(entry.sourceFile?.extension, sourceFileFamily) !== true) {
      sourceExtensionInvalidCaseIds.push(caseId);
    }
    if (!coverageCaseFamily || coverageCaseFamily !== workflowSourceFamily) {
      coverageCaseFamilyMismatchCaseIds.push(caseId);
    }
    if (sourceFamily) {
      const ids = acceptedFormatFamilyCaseIds.get(sourceFamily) || [];
      ids.push(caseId);
      acceptedFormatFamilyCaseIds.set(sourceFamily, ids);
    }
    const translationMode = typeof entry.workflow?.source?.translationMode === "string"
      ? entry.workflow.source.translationMode
      : "";
    const sourceAdapter = typeof entry.workflow?.source?.sourceAdapter === "string"
      ? entry.workflow.source.sourceAdapter
      : "";
    const externalAdapterEvidenceOk = translationMode === "external-adapter"
      && entry.workflow?.source?.adapterConfigProvided === true
      && entry.workflow?.source?.adapterPreflightOk === true
      && isSafeAdapterKey(sourceAdapter)
      && fingerprintValueOk(entry.workflow?.source?.adapterRequestEvidenceFingerprint, SHA256_FINGERPRINT)
      && fingerprintValueOk(entry.workflow?.source?.adapterConfigStatFingerprint, STAT_FINGERPRINT)
      && fingerprintValueOk(entry.workflow?.source?.adapterRegistryFingerprint, SHA256_FINGERPRINT)
      && fingerprintValueOk(entry.workflow?.source?.adapterRegistryAdapterFingerprint, SHA256_FINGERPRINT)
      && fingerprintValueOk(entry.workflow?.source?.adapterPreflightFingerprint, SHA256_FINGERPRINT);
    const externalAdapterSourceAdapterAssertionOkValue = translationMode === "external-adapter"
      && isSafeAdapterKey(sourceAdapter)
      && externalAdapterSourceAdapterAssertionOk(entry.assertions, sourceAdapter) === true;
    const referenceCounts = entry.workflow?.referenceCounts || {};
    if (referenceCountsShapeOk(referenceCounts) !== true) {
      referenceCountInvalidCaseIds.push(caseId);
    }
    if (options.requireNonemptyReferenceGeometry && !hasNonemptyReferenceGeometry(referenceCounts)) {
      emptyReferenceGeometryCaseIds.push(caseId);
    }
    if (sourceFamily && hasPointCloudEvidence(referenceCounts)) {
      const ids = pointCloudFamilyCaseIds.get(sourceFamily) || [];
      ids.push(caseId);
      pointCloudFamilyCaseIds.set(sourceFamily, ids);
    }
    if (sourceFamily && translationMode === "external-adapter" && externalAdapterEvidenceOk !== true) {
      weakExternalAdapterEvidenceCaseIds.push(caseId);
    }
    if (
      sourceFamily
      && translationMode === "external-adapter"
      && isSafeAdapterKey(sourceAdapter)
      && externalAdapterSourceAdapterAssertionOkValue !== true
    ) {
      missingExternalAdapterSourceAdapterAssertionCaseIds.push(caseId);
    }
    if (sourceFamily && externalAdapterEvidenceOk) {
      const ids = externalAdapterFamilyCaseIds.get(sourceFamily) || [];
      ids.push(caseId);
      externalAdapterFamilyCaseIds.set(sourceFamily, ids);
      if (externalAdapterSourceAdapterAssertionOkValue) {
        const keys = externalAdapterSourceAdapterKeys.get(sourceFamily) || new Set();
        keys.add(sourceAdapter);
        externalAdapterSourceAdapterKeys.set(sourceFamily, keys);
        const requestEvidenceFingerprints = externalAdapterSourceAdapterRequestEvidenceFingerprints.get(sourceFamily) || new Set();
        requestEvidenceFingerprints.add(entry.workflow.source.adapterRequestEvidenceFingerprint);
        externalAdapterSourceAdapterRequestEvidenceFingerprints.set(sourceFamily, requestEvidenceFingerprints);
        const configStatFingerprints = externalAdapterSourceAdapterConfigStatFingerprints.get(sourceFamily) || new Set();
        configStatFingerprints.add(entry.workflow.source.adapterConfigStatFingerprint);
        externalAdapterSourceAdapterConfigStatFingerprints.set(sourceFamily, configStatFingerprints);
        const registryAggregateFingerprints = externalAdapterSourceAdapterRegistryAggregateFingerprints.get(sourceFamily) || new Set();
        registryAggregateFingerprints.add(entry.workflow.source.adapterRegistryFingerprint);
        externalAdapterSourceAdapterRegistryAggregateFingerprints.set(sourceFamily, registryAggregateFingerprints);
        const registryFingerprints = externalAdapterSourceAdapterRegistryFingerprints.get(sourceFamily) || new Set();
        registryFingerprints.add(entry.workflow.source.adapterRegistryAdapterFingerprint);
        externalAdapterSourceAdapterRegistryFingerprints.set(sourceFamily, registryFingerprints);
        const fingerprints = externalAdapterSourceAdapterPreflightFingerprints.get(sourceFamily) || new Set();
        fingerprints.add(entry.workflow.source.adapterPreflightFingerprint);
        externalAdapterSourceAdapterPreflightFingerprints.set(sourceFamily, fingerprints);
      }
    }
    for (const field of FORBIDDEN_TOP_LEVEL_FIELDS) {
      if (Object.hasOwn(entry, field) || Object.hasOwn(entry.workflow || {}, field)) {
        rawPayloadLeakCaseIds.push(caseId);
      }
    }
    if (finalFingerprintSummaryOk(entry.workflow?.finalFingerprintSummary) !== true) {
      fingerprintSummaryInvalidCaseIds.push(caseId);
    }
    if (
      entry.sourceFile?.exists !== true
      || entry.sourceFile?.isFile !== true
      || !Number.isSafeInteger(entry.sourceFile?.sizeBytes)
      || entry.sourceFile.sizeBytes < 0
      || !fingerprintValueOk(entry.sourceFile?.statFingerprint, STAT_FINGERPRINT)
    ) {
      sourceEvidenceMissingCaseIds.push(caseId);
    }
    if (isIsoModifiedTime(entry.sourceFile?.modifiedTime) !== true) {
      sourceModifiedTimeInvalidCaseIds.push(caseId);
    }
    if (options.minSourceFileSizeBytes > 0 && Number(entry.sourceFile?.sizeBytes || 0) < options.minSourceFileSizeBytes) {
      sourceSizeFailedCaseIds.push(caseId);
    }
    if (!Number.isFinite(entry.durationMs)) {
      performanceEvidenceMissingCaseIds.push(caseId);
    } else {
      const performanceEntry = performanceDurationsByCaseId.get(caseId);
      if (
        !performanceEntry
        || performanceEntry.durationMs !== entry.durationMs
        || performanceEntry.sourceFileSizeBytes !== entry.sourceFile?.sizeBytes
        || performanceEntry.sourceStatFingerprint !== entry.sourceFile?.statFingerprint
      ) {
        performanceEvidenceMismatchCaseIds.push(caseId);
      }
    }
    if (assertionSummariesShapeOk(entry.assertions) !== true || assertionSummariesValuesOk(entry.assertions) !== true) {
      assertionSummaryInvalidCaseIds.push(caseId);
    }
    if (!Array.isArray(entry.assertions) || entry.assertions.some((assertion) => assertion?.ok !== true)) {
      failedCaseIds.push(caseId);
    }
    if (options.requirePromotedImportWrites) {
      const hasAssertion = Array.isArray(entry.assertions)
        && entry.assertions.some((assertion) => assertion?.field === "promotedImportWritesRequired" && assertion?.ok === true);
      if (
        entry.request?.targetStage !== "import"
        || entry.request?.confirmImport !== true
        || entry.workflow?.finalStage !== "import"
        || hasAssertion !== true
      ) {
        promotedImportEvidenceMissingCaseIds.push(caseId);
      }
    }
  }

  const externalAdapterMissingFamilies = effectiveRequiredExternalAdapterFamilies
    .filter((family) => !(externalAdapterFamilyCaseIds.get(family) || []).length);
  const acceptedExternalAdapterFamilies = [...externalAdapterFamilyCaseIds.keys()].sort();
  const acceptanceDeclaredMissingExternalAdapterFamilies = (acceptanceRequiredExternalAdapterFamilies || [])
    .filter((family) => !(externalAdapterFamilyCaseIds.get(family) || []).length);
  if (
    acceptancePresentExternalAdapterFamilies
    && !sameStringList(acceptancePresentExternalAdapterFamilies, acceptedExternalAdapterFamilies)
  ) {
    acceptanceMetadataIssues.push("acceptance.presentExternalAdapterFamilies-aligned");
  }
  if (
    acceptanceMissingExternalAdapterFamilies
    && !sameStringList(acceptanceMissingExternalAdapterFamilies, acceptanceDeclaredMissingExternalAdapterFamilies)
  ) {
    acceptanceMetadataIssues.push("acceptance.externalAdapterMissingFamilies-aligned");
  }
  if (acceptanceMetadataIssues.length > 0) {
    failures.push(`invalid acceptance metadata: ${[...new Set(acceptanceMetadataIssues)].sort().join(", ")}`);
  }
  if (externalAdapterMissingFamilies.length > 0) {
    failures.push(`required external-adapter source families missing: ${externalAdapterMissingFamilies.join(", ")}`);
  }
  const pointCloudMissingFamilies = options.requiredPointCloudFamilies
    .filter((family) => !(pointCloudFamilyCaseIds.get(family) || []).length);
  if (pointCloudMissingFamilies.length > 0) {
    failures.push(`required point-cloud source families missing: ${pointCloudMissingFamilies.join(", ")}`);
  }
  const acceptedFormatMissingFamilies = requiredFormatFamilies
    .filter((family) => !(acceptedFormatFamilyCaseIds.get(family) || []).length);
  if (acceptedFormatMissingFamilies.length > 0) {
    failures.push(`required format families missing accepted case evidence: ${acceptedFormatMissingFamilies.join(", ")}`);
  }
  pushCaseFailures(failures, "duplicate accepted case ids", duplicateAcceptedCaseIds);
  const acceptedCaseIdsSorted = [...acceptedCaseIds].sort();
  const coverageCaseIdsSorted = [...coverageCaseFamilies.keys()].sort();
  if (!sameStringList(coverageCaseIdsSorted, acceptedCaseIdsSorted)) {
    coverageMetadataIssues.push("coverage.caseFormatFamilies-case-ids-aligned");
  }
  const acceptedFormatFamilies = [...acceptedFormatFamilyCaseIds.keys()].sort();
  if (reportPresentFormatFamilies && !sameStringList(reportPresentFormatFamilies, acceptedFormatFamilies)) {
    coverageMetadataIssues.push("coverage.presentFormatFamilies-aligned");
  }
  if (coverageMetadataIssues.length > 0 && !failures.some((entry) => entry.startsWith("invalid coverage metadata:"))) {
    failures.push(`invalid coverage metadata: ${[...new Set(coverageMetadataIssues)].sort().join(", ")}`);
  }
  const numericDurations = cases
    .map((entry) => ({ id: safeCaseId(entry?.id) ? entry.id : "", durationMs: entry?.durationMs }))
    .filter((entry) => Number.isFinite(entry.durationMs));
  const expectedTotalDurationMs = numericDurations.reduce((sum, entry) => sum + entry.durationMs, 0);
  const expectedMaxDurationEntry = numericDurations.reduce((current, entry) => (
    !current || entry.durationMs > current.durationMs ? entry : current
  ), null);
  if (Number.isFinite(report?.performance?.totalDurationMs) && report.performance.totalDurationMs !== expectedTotalDurationMs) {
    failures.push("performance.totalDurationMs must equal the sum of accepted case durations");
  }
  if (expectedMaxDurationEntry && report?.performance?.maxDurationMs !== expectedMaxDurationEntry.durationMs) {
    failures.push("performance.maxDurationMs must equal the slowest accepted case duration");
  }
  if (expectedMaxDurationEntry && report?.performance?.maxDurationCaseId !== expectedMaxDurationEntry.id) {
    failures.push("performance.maxDurationCaseId must identify the slowest accepted case");
  }

  pushCaseFailures(failures, "failed case evidence", failedCaseIds);
  pushCaseFailures(failures, "source family mismatch evidence", sourceFamilyMismatchCaseIds);
  pushCaseFailures(failures, "coverage case family mismatch evidence", coverageCaseFamilyMismatchCaseIds);
  pushCaseFailures(failures, "invalid source file summary field evidence", sourceFileSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid source extension evidence", sourceExtensionInvalidCaseIds);
  pushCaseFailures(failures, "invalid workflow source summary field evidence", sourceSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid source format token/alias evidence", sourceFormatSummaryInvalidCaseIds);
  pushCaseFailures(failures, "missing source evidence", sourceEvidenceMissingCaseIds);
  pushCaseFailures(failures, "invalid source modified-time evidence", sourceModifiedTimeInvalidCaseIds);
  pushCaseFailures(failures, "invalid case timing evidence", caseTimingInvalidCaseIds);
  pushCaseFailures(failures, "source files below required size", sourceSizeFailedCaseIds);
  pushCaseFailures(failures, "missing performance evidence", performanceEvidenceMissingCaseIds);
  pushCaseFailures(failures, "mismatched performance evidence", performanceEvidenceMismatchCaseIds);
  pushCaseFailures(failures, "invalid reference count summary evidence", referenceCountInvalidCaseIds);
  pushCaseFailures(failures, "empty reference geometry evidence", emptyReferenceGeometryCaseIds);
  pushCaseFailures(failures, "invalid final fingerprint summary evidence", fingerprintSummaryInvalidCaseIds);
  pushCaseFailures(failures, "raw workflow/canonical payload leak", rawPayloadLeakCaseIds);
  pushCaseFailures(failures, "invalid accepted case summary field evidence", caseSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted case identity metadata", caseIdentityInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted assertion summary field evidence", assertionSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted workflow summary field evidence", workflowSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted workflow runtime boundary evidence", workflowRuntimeBoundaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted workflow response summary evidence", workflowResponseSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted workflow stage evidence", workflowStageInvalidCaseIds);
  pushCaseFailures(failures, "accepted case diagnostic payload evidence", caseDiagnosticPayloadCaseIds);
  pushCaseFailures(failures, "invalid accepted process summary evidence", processSummaryInvalidCaseIds);
  pushCaseFailures(failures, "invalid accepted request summary evidence", requestSummaryInvalidCaseIds);
  pushCaseFailures(failures, "accepted raw-response request evidence", rawDebugRequestCaseIds);
  pushCaseFailures(failures, "missing promoted import evidence", promotedImportEvidenceMissingCaseIds);
  pushCaseFailures(failures, "weak external-adapter evidence", weakExternalAdapterEvidenceCaseIds);
  pushCaseFailures(failures, "missing external-adapter sourceAdapter assertion evidence", missingExternalAdapterSourceAdapterAssertionCaseIds);

  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: failures.length === 0,
    reportId: report?.id === CORPUS_REPORT_ID ? CORPUS_REPORT_ID : "",
    reportVersion: report?.version === CHECK_VERSION ? CHECK_VERSION : "",
    reportPath: pathFreeInputFileName(options.reportPath),
    reportFingerprint: SHA256_FINGERPRINT.test(reportFingerprint) ? reportFingerprint : "",
    finalPrivateAcceptanceSummary: finalPrivateAcceptanceSummary(),
    gates: {
      requiredFormatFamilies,
      missingFormatFamilies,
      expectedReportFingerprint: options.expectedReportFingerprint || "",
      reportFingerprintMatchesExpected: reportFingerprintMatchesExpected(options, reportFingerprint),
      acceptedFormatMissingFamilies,
      duplicateAcceptedCaseIds: [...new Set(duplicateAcceptedCaseIds)].sort(),
      requiredExternalAdapterFamilies: effectiveRequiredExternalAdapterFamilies,
      externalAdapterMissingFamilies,
      weakExternalAdapterEvidenceCaseIds: [...new Set(weakExternalAdapterEvidenceCaseIds)].sort(),
      missingExternalAdapterSourceAdapterAssertionCaseIds: [...new Set(missingExternalAdapterSourceAdapterAssertionCaseIds)].sort(),
      sourceFamilyMismatchCaseIds: [...new Set(sourceFamilyMismatchCaseIds)].sort(),
      coverageCaseFamilyMismatchCaseIds: [...new Set(coverageCaseFamilyMismatchCaseIds)].sort(),
      sourceEvidenceMissingCaseIds: [...new Set(sourceEvidenceMissingCaseIds)].sort(),
      sourceFileSummaryInvalidCaseIds: [...new Set(sourceFileSummaryInvalidCaseIds)].sort(),
      sourceExtensionInvalidCaseIds: [...new Set(sourceExtensionInvalidCaseIds)].sort(),
      sourceSummaryInvalidCaseIds: [...new Set(sourceSummaryInvalidCaseIds)].sort(),
      sourceFormatSummaryInvalidCaseIds: [...new Set(sourceFormatSummaryInvalidCaseIds)].sort(),
      sourceModifiedTimeInvalidCaseIds: [...new Set(sourceModifiedTimeInvalidCaseIds)].sort(),
      caseTimingInvalidCaseIds: [...new Set(caseTimingInvalidCaseIds)].sort(),
      topLevelReportMetadataIssues: [...new Set(topLevelReportMetadataIssues)].sort(),
      acceptanceMetadataIssues: [...new Set(acceptanceMetadataIssues)].sort(),
      coverageMetadataIssues: [...new Set(coverageMetadataIssues)].sort(),
      defaultsMetadataIssues: [...new Set(defaultsMetadataIssues)].sort(),
      performanceMetadataIssues: [...new Set(performanceMetadataIssues)].sort(),
      performanceDurationSummaryInvalidCaseIds: [...new Set(performanceDurationSummaryInvalidCaseIds)].sort(),
      performanceEvidenceMismatchCaseIds: [...new Set(performanceEvidenceMismatchCaseIds)].sort(),
      referenceCountInvalidCaseIds: [...new Set(referenceCountInvalidCaseIds)].sort(),
      fingerprintSummaryInvalidCaseIds: [...new Set(fingerprintSummaryInvalidCaseIds)].sort(),
      caseSummaryInvalidCaseIds: [...new Set(caseSummaryInvalidCaseIds)].sort(),
      caseIdentityInvalidCaseIds: [...new Set(caseIdentityInvalidCaseIds)].sort(),
      assertionSummaryInvalidCaseIds: [...new Set(assertionSummaryInvalidCaseIds)].sort(),
      workflowSummaryInvalidCaseIds: [...new Set(workflowSummaryInvalidCaseIds)].sort(),
      workflowRuntimeBoundaryInvalidCaseIds: [...new Set(workflowRuntimeBoundaryInvalidCaseIds)].sort(),
      workflowResponseSummaryInvalidCaseIds: [...new Set(workflowResponseSummaryInvalidCaseIds)].sort(),
      workflowStageInvalidCaseIds: [...new Set(workflowStageInvalidCaseIds)].sort(),
      caseDiagnosticPayloadCaseIds: [...new Set(caseDiagnosticPayloadCaseIds)].sort(),
      processSummaryInvalidCaseIds: [...new Set(processSummaryInvalidCaseIds)].sort(),
      requestSummaryInvalidCaseIds: [...new Set(requestSummaryInvalidCaseIds)].sort(),
      rawDebugRequestCaseIds: [...new Set(rawDebugRequestCaseIds)].sort(),
      topLevelCaseMetadataIssues: [...new Set(topLevelCaseMetadataIssues)].sort(),
      topLevelRuntimeBoundaryIssues: [...new Set(topLevelRuntimeBoundaryIssues)].sort(),
      requiredPointCloudFamilies: options.requiredPointCloudFamilies,
      pointCloudMissingFamilies,
      minSourceFileSizeBytes: options.minSourceFileSizeBytes || 0,
      sourceSizeFailedCaseIds: [...new Set(sourceSizeFailedCaseIds)].sort(),
      requireNonemptyReferenceGeometry: options.requireNonemptyReferenceGeometry === true,
      emptyReferenceGeometryCaseIds: [...new Set(emptyReferenceGeometryCaseIds)].sort(),
      requirePromotedImportWrites: options.requirePromotedImportWrites === true,
      promotedImportEvidenceMissingCaseIds: [...new Set(promotedImportEvidenceMissingCaseIds)].sort()
    },
    summary: {
      caseCount: cases.length,
      accepted: report?.acceptance?.accepted === true,
      coverageOk: report?.coverage?.coverageOk === true,
      presentFormatFamilies,
      acceptedFormatFamilies,
      externalAdapterFamilies: [...externalAdapterFamilyCaseIds.keys()].sort(),
      externalAdapterTargetFormatTokens: externalAdapterTargetFormatTokensForFamilies([...externalAdapterFamilyCaseIds.keys()].sort()),
      externalAdapterSourceAdapterKeys: externalAdapterSourceAdapterKeysSummary(externalAdapterSourceAdapterKeys),
      externalAdapterSourceAdapterRequestEvidenceFingerprints: externalAdapterSourceAdapterRequestEvidenceFingerprintsSummary(externalAdapterSourceAdapterRequestEvidenceFingerprints),
      externalAdapterSourceAdapterConfigStatFingerprints: externalAdapterSourceAdapterConfigStatFingerprintsSummary(externalAdapterSourceAdapterConfigStatFingerprints),
      externalAdapterSourceAdapterRegistryAggregateFingerprints: externalAdapterSourceAdapterRegistryAggregateFingerprintsSummary(externalAdapterSourceAdapterRegistryAggregateFingerprints),
      externalAdapterSourceAdapterRegistryFingerprints: externalAdapterSourceAdapterRegistryFingerprintsSummary(externalAdapterSourceAdapterRegistryFingerprints),
      externalAdapterSourceAdapterPreflightFingerprints: externalAdapterSourceAdapterPreflightFingerprintsSummary(externalAdapterSourceAdapterPreflightFingerprints),
      pointCloudFamilies: [...pointCloudFamilyCaseIds.keys()].sort(),
      performanceEvidenceReady: report?.acceptance?.performanceEvidenceReady === true,
      sourceEvidenceReady: report?.acceptance?.sourceEvidenceReady === true
    },
    failures,
    warnings
  };
}

function workflowSummaryShapeOk(workflow = {}) {
  return workflow
    && typeof workflow === "object"
    && !Array.isArray(workflow)
    && Object.keys(workflow).every((field) => WORKFLOW_SUMMARY_FIELDS.has(field));
}

function workflowSummaryValuesOk(workflow = {}) {
  return workflowSummaryShapeOk(workflow)
    && safeWorkflowTextOk(workflow.id)
    && safeWorkflowTextOk(workflow.stopReason)
    && safeWorkflowTextOk(workflow.finalResponseStatus)
    && safeWorkflowTextOk(workflow.finalSafeNextAction)
    && safeWorkflowTextOk(workflow.blockedReason)
    && safeWorkflowTextOk(workflow.blockedSafeNextAction)
    && auditSummaryShapeOk(workflow.audit);
}

function auditSummaryShapeOk(audit = {}) {
  return audit
    && typeof audit === "object"
    && !Array.isArray(audit)
    && Object.keys(audit).every((field) => AUDIT_SUMMARY_FIELDS.has(field))
    && ["readyCount", "needsAttentionCount", "errorCount"].every((field) => audit[field] === null || (Number.isSafeInteger(audit[field]) && audit[field] >= 0))
    && safeWorkflowTextOk(audit.likelyFixArea)
    && safeWorkflowTextOk(audit.recommendedNextAction);
}

function workflowRuntimeBoundaryShapeOk(runtimeBoundary = {}) {
  return runtimeBoundary
    && typeof runtimeBoundary === "object"
    && !Array.isArray(runtimeBoundary)
    && Object.keys(runtimeBoundary).every((field) => WORKFLOW_RUNTIME_BOUNDARY_FIELDS.has(field));
}

function sourceSummaryShapeOk(source = {}) {
  return source
    && typeof source === "object"
    && !Array.isArray(source)
    && Object.keys(source).every((field) => SOURCE_SUMMARY_FIELDS.has(field));
}

function safeWorkflowTextOk(value = "") {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text === "") return true;
  return SAFE_WORKFLOW_TEXT.test(text)
    && !text.startsWith("--")
    && !text.includes("..")
    && !/[\\/:]/.test(text)
    && !/[\u0000-\u001f]/.test(text);
}

function sourceSummaryValuesOk(source = {}) {
  const translationMode = typeof source.translationMode === "string" ? source.translationMode : "";
  const sourceAdapter = typeof source.sourceAdapter === "string" ? source.sourceAdapter : null;
  const adapterFingerprintFields = [
    source.adapterRequestEvidenceFingerprint,
    source.adapterConfigStatFingerprint,
    source.adapterRegistryFingerprint,
    source.adapterRegistryAdapterFingerprint,
    source.adapterPreflightFingerprint
  ];
  const nonExternalAdapterEvidenceOk = translationMode === "external-adapter" || (
    sourceAdapter === ""
    && source.adapterConfigProvided === false
    && source.adapterPreflightOk === null
    && adapterFingerprintFields.every((value) => value === "")
  );
  return sourceSummaryShapeOk(source)
    && TRANSLATION_MODES.has(translationMode)
    && canonicalFormatFamilyTokenOk(source.sourceRequestedFormatFamily)
    && sourceAdapter !== null
    && (sourceAdapter === "" || isSafeAdapterKey(sourceAdapter))
    && typeof source.adapterConfigProvided === "boolean"
    && (source.adapterPreflightOk === null || typeof source.adapterPreflightOk === "boolean")
    && optionalFingerprint(source.adapterRequestEvidenceFingerprint, SHA256_FINGERPRINT)
    && optionalFingerprint(source.adapterConfigStatFingerprint, STAT_FINGERPRINT)
    && optionalFingerprint(source.adapterRegistryFingerprint, SHA256_FINGERPRINT)
    && optionalFingerprint(source.adapterRegistryAdapterFingerprint, SHA256_FINGERPRINT)
    && optionalFingerprint(source.adapterPreflightFingerprint, SHA256_FINGERPRINT)
    && nonExternalAdapterEvidenceOk;
}

function optionalFingerprint(value = "", pattern) {
  return typeof value === "string" && (value === "" || pattern.test(value));
}

function isSafeAdapterKey(value = "") {
  return typeof value === "string" && SAFE_ADAPTER_KEY.test(value) && !RESERVED_OBJECT_KEYS.has(value);
}

function sourceFileSummaryShapeOk(sourceFile = {}) {
  return sourceFile
    && typeof sourceFile === "object"
    && !Array.isArray(sourceFile)
    && Object.keys(sourceFile).every((field) => SOURCE_FILE_SUMMARY_FIELDS.has(field))
    && sourceFile.exists === true
    && sourceFile.isFile === true
    && typeof sourceFile.extension === "string"
    && canonicalFormatFamilyTokenOk(sourceFile.formatFamily)
    && Number.isSafeInteger(sourceFile.sizeBytes)
    && sourceFile.sizeBytes >= 0
    && typeof sourceFile.modifiedTime === "string"
    && typeof sourceFile.statFingerprint === "string";
}

function performanceDurationSummaryShapeOk(entry = {}) {
  return entry
    && typeof entry === "object"
    && !Array.isArray(entry)
    && Object.keys(entry).every((field) => PERFORMANCE_CASE_DURATION_FIELDS.has(field))
    && safeCaseId(entry.id)
    && Number.isSafeInteger(entry.durationMs)
    && entry.durationMs >= 0
    && Number.isSafeInteger(entry.sourceFileSizeBytes)
    && entry.sourceFileSizeBytes >= 0
    && fingerprintValueOk(entry.sourceStatFingerprint, STAT_FINGERPRINT);
}

function requestSummaryShapeOk(request = {}) {
  return request
    && typeof request === "object"
    && !Array.isArray(request)
    && Object.keys(request).every((field) => REQUEST_SUMMARY_FIELDS.has(field));
}

function processSummaryShapeOk(process = {}) {
  return process
    && typeof process === "object"
    && !Array.isArray(process)
    && Object.keys(process).every((field) => PROCESS_SUMMARY_FIELDS.has(field));
}

function caseTimingSummaryOk(entry = {}) {
  const startedAtMs = isIsoModifiedTime(entry.startedAt) ? Date.parse(entry.startedAt) : NaN;
  const finishedAtMs = isIsoModifiedTime(entry.finishedAt) ? Date.parse(entry.finishedAt) : NaN;
  const timestampDurationMs = finishedAtMs - startedAtMs;
  return Number.isFinite(startedAtMs)
    && Number.isFinite(finishedAtMs)
    && finishedAtMs >= startedAtMs
    && Number.isSafeInteger(entry.durationMs)
    && entry.durationMs >= 0
    && Math.abs(timestampDurationMs - entry.durationMs) <= CASE_TIMING_DURATION_TOLERANCE_MS
    && Number.isSafeInteger(entry.timeoutMs)
    && entry.timeoutMs >= 0;
}

function caseIdentitySummaryOk(entry = {}) {
  return entry?.enabled === true && safeOptionalReportLabel(entry?.label);
}

function safeOptionalReportLabel(value) {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  return value.trim().length > 0
    && value.length <= 200
    && !/[\\/:]/.test(value)
    && !value.includes("..")
    && !/[\u0000-\u001f]/.test(value);
}

function assertionSummariesShapeOk(assertions = []) {
  return Array.isArray(assertions)
    && assertions.every((assertion) => (
      assertion
      && typeof assertion === "object"
      && !Array.isArray(assertion)
      && Object.keys(assertion).every((field) => ASSERTION_SUMMARY_FIELDS.has(field))
    ));
}

function assertionSummariesValuesOk(assertions = []) {
  return assertionSummariesShapeOk(assertions)
    && assertions.every((assertion) => (
      assertion.ok === true
      && safeWorkflowTextOk(assertion.field)
      && safeAssertionValueOk(assertion.expected)
      && safeAssertionValueOk(assertion.expectedMinimum)
      && safeAssertionValueOk(assertion.expectedMaximum)
      && safeAssertionValueOk(assertion.actual)
      && safeWorkflowTextOk(assertion.message)
      && String(assertion.message || "") === ""
    ));
}

function externalAdapterSourceAdapterAssertionOk(assertions = [], sourceAdapter = "") {
  if (!isSafeAdapterKey(sourceAdapter) || !Array.isArray(assertions)) return false;
  const sourceAdapterAssertions = assertions.filter((assertion) => (
    assertion
    && typeof assertion === "object"
    && !Array.isArray(assertion)
    && assertion.field === "sourceAdapter"
  ));
  return sourceAdapterAssertions.length === 1 && sourceAdapterAssertions.every((assertion) => (
    assertion
    && typeof assertion === "object"
    && !Array.isArray(assertion)
    && assertion.field === "sourceAdapter"
    && assertion.ok === true
    && assertion.expected === sourceAdapter
    && assertion.expectedMinimum === null
    && assertion.expectedMaximum === null
    && assertion.actual === sourceAdapter
    && assertion.message === ""
  ));
}

function safeAssertionValueOk(value, depth = 0) {
  if (depth > ASSERTION_VALUE_MAX_DEPTH) return false;
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return true;
  if (Number.isInteger(value)) return Number.isSafeInteger(value) && value >= 0;
  if (typeof value === "string") return safeWorkflowTextOk(value);
  if (Array.isArray(value)) {
    return value.length <= ASSERTION_VALUE_MAX_ITEMS
      && value.every((entry) => safeAssertionValueOk(entry, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length <= ASSERTION_VALUE_MAX_ITEMS
      && entries.every(([key, entry]) => safeWorkflowTextOk(key) && safeAssertionValueOk(entry, depth + 1));
  }
  return false;
}

function sourceFormatSummaryOk(source = {}, family = "") {
  if (!family) return false;
  if (!source || typeof source !== "object" || Array.isArray(source)) return false;
  return optionalSourceFormatTokenMatchesFamily(source.sourceFormat, family)
    && optionalSourceFormatTokenMatchesFamily(source.sourceRequestedFormat, family)
    && sourceRequestedFormatAliasesOk(source.sourceRequestedFormatAliases, family);
}

function optionalSourceFormatTokenMatchesFamily(value, family) {
  if (typeof value !== "string") return false;
  const text = value;
  const normalized = text.trim().toLowerCase();
  return text === "" || (text === normalized && formatFamilyToken(text) === family);
}

function sourceRequestedFormatAliasesOk(aliases = [], family = "") {
  if (!Array.isArray(aliases)) return false;
  const seen = new Set();
  for (const entry of aliases) {
    if (typeof entry !== "string") return false;
    const text = entry;
    const normalized = text.trim().toLowerCase();
    if (!text || text !== normalized || seen.has(normalized) || formatFamilyToken(text) !== family) return false;
    seen.add(normalized);
  }
  return true;
}

function finalFingerprintSummaryOk(summary = {}) {
  return summary
    && typeof summary === "object"
    && !Array.isArray(summary)
    && Object.keys(summary).length > 0
    && Object.entries(summary).every(([key, value]) => (
      /^[A-Za-z][A-Za-z0-9]*Fingerprint$/.test(key)
      && fingerprintValueOk(value, SHA256_FINGERPRINT)
    ));
}

function referenceCountsShapeOk(referenceCounts = {}) {
  return referenceCounts
    && typeof referenceCounts === "object"
    && !Array.isArray(referenceCounts)
    && Object.keys(referenceCounts).every((field) => REFERENCE_COUNT_FIELDS.includes(field))
    && REFERENCE_COUNT_FIELDS.every((field) => (
      referenceCounts[field] === null
      || (Number.isSafeInteger(referenceCounts[field]) && referenceCounts[field] >= 0)
    ));
}

function hasNonemptyReferenceGeometry(referenceCounts = {}) {
  if (!Number.isFinite(referenceCounts.objectCount) || referenceCounts.objectCount < 1) return false;
  return [
    referenceCounts.lineSegmentCount,
    referenceCounts.meshFaceCount,
    referenceCounts.pointCloudPointCount,
    referenceCounts.chunkPointCount,
    referenceCounts.chunkCount
  ].some((value) => Number.isFinite(value) && value > 0);
}

function hasPointCloudEvidence(referenceCounts = {}) {
  return [
    referenceCounts.pointCloudPointCount,
    referenceCounts.chunkPointCount
  ].some((value) => Number.isFinite(value) && value > 0);
}

function externalAdapterTargetFormatTokensForFamilies(families = []) {
  const presentFamilies = new Set(Array.isArray(families) ? families : []);
  return Object.entries(FAMILY_TARGET_FORMAT_TOKENS)
    .filter(([family]) => presentFamilies.has(family))
    .map(([, targetFormatToken]) => targetFormatToken);
}

function externalAdapterSourceAdapterKeysSummary(sourceAdapterKeysByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(sourceAdapterKeysByFamily.get(family) || new Set())]
      .filter(isSafeAdapterKey)
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function externalAdapterSourceAdapterPreflightFingerprintsSummary(preflightFingerprintsByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(preflightFingerprintsByFamily.get(family) || new Set())]
      .filter((fingerprint) => fingerprintValueOk(fingerprint, SHA256_FINGERPRINT))
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function externalAdapterSourceAdapterRequestEvidenceFingerprintsSummary(requestEvidenceFingerprintsByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(requestEvidenceFingerprintsByFamily.get(family) || new Set())]
      .filter((fingerprint) => fingerprintValueOk(fingerprint, SHA256_FINGERPRINT))
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function externalAdapterSourceAdapterConfigStatFingerprintsSummary(configStatFingerprintsByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(configStatFingerprintsByFamily.get(family) || new Set())]
      .filter((fingerprint) => fingerprintValueOk(fingerprint, STAT_FINGERPRINT))
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function externalAdapterSourceAdapterRegistryAggregateFingerprintsSummary(registryAggregateFingerprintsByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(registryAggregateFingerprintsByFamily.get(family) || new Set())]
      .filter((fingerprint) => fingerprintValueOk(fingerprint, SHA256_FINGERPRINT))
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function externalAdapterSourceAdapterRegistryFingerprintsSummary(registryFingerprintsByFamily = new Map()) {
  return Object.fromEntries(Object.keys(FAMILY_TARGET_FORMAT_TOKENS).map((family) => [
    family,
    [...(registryFingerprintsByFamily.get(family) || new Set())]
      .filter((fingerprint) => fingerprintValueOk(fingerprint, SHA256_FINGERPRINT))
      .sort((left, right) => left.localeCompare(right))
  ]));
}

function emptyVerificationGates(options = {}, overrides = {}) {
  return {
    requiredFormatFamilies: Array.isArray(options.requiredFormatFamilies) ? options.requiredFormatFamilies : [],
    missingFormatFamilies: [],
    expectedReportFingerprint: options.expectedReportFingerprint || "",
    reportFingerprintMatchesExpected: reportFingerprintMatchesExpected(options, overrides.reportFingerprint || ""),
    acceptedFormatMissingFamilies: [],
    duplicateAcceptedCaseIds: [],
    requiredExternalAdapterFamilies: Array.isArray(options.requiredExternalAdapterFamilies) ? options.requiredExternalAdapterFamilies : [],
    externalAdapterMissingFamilies: [],
    weakExternalAdapterEvidenceCaseIds: [],
    missingExternalAdapterSourceAdapterAssertionCaseIds: [],
    sourceFamilyMismatchCaseIds: [],
    coverageCaseFamilyMismatchCaseIds: [],
    sourceEvidenceMissingCaseIds: [],
    sourceFileSummaryInvalidCaseIds: [],
    sourceExtensionInvalidCaseIds: [],
    sourceSummaryInvalidCaseIds: [],
    sourceFormatSummaryInvalidCaseIds: [],
    sourceModifiedTimeInvalidCaseIds: [],
    caseTimingInvalidCaseIds: [],
    topLevelReportMetadataIssues: [],
    acceptanceMetadataIssues: [],
    coverageMetadataIssues: [],
    defaultsMetadataIssues: [],
    performanceMetadataIssues: [],
    performanceDurationSummaryInvalidCaseIds: [],
    performanceEvidenceMismatchCaseIds: [],
    referenceCountInvalidCaseIds: [],
    fingerprintSummaryInvalidCaseIds: [],
    caseSummaryInvalidCaseIds: [],
    caseIdentityInvalidCaseIds: [],
    assertionSummaryInvalidCaseIds: [],
    workflowSummaryInvalidCaseIds: [],
    workflowRuntimeBoundaryInvalidCaseIds: [],
    workflowResponseSummaryInvalidCaseIds: [],
    workflowStageInvalidCaseIds: [],
    caseDiagnosticPayloadCaseIds: [],
    processSummaryInvalidCaseIds: [],
    requestSummaryInvalidCaseIds: [],
    rawDebugRequestCaseIds: [],
    topLevelCaseMetadataIssues: [],
    topLevelRuntimeBoundaryIssues: [],
    requiredPointCloudFamilies: Array.isArray(options.requiredPointCloudFamilies) ? options.requiredPointCloudFamilies : [],
    pointCloudMissingFamilies: [],
    minSourceFileSizeBytes: options.minSourceFileSizeBytes || 0,
    sourceSizeFailedCaseIds: [],
    requireNonemptyReferenceGeometry: options.requireNonemptyReferenceGeometry === true,
    emptyReferenceGeometryCaseIds: [],
    requirePromotedImportWrites: options.requirePromotedImportWrites === true,
    promotedImportEvidenceMissingCaseIds: []
  };
}

function emptyVerificationSummary() {
  return {
    caseCount: 0,
    accepted: false,
    coverageOk: false,
    presentFormatFamilies: [],
    acceptedFormatFamilies: [],
    externalAdapterFamilies: [],
    externalAdapterTargetFormatTokens: [],
    externalAdapterSourceAdapterKeys: externalAdapterSourceAdapterKeysSummary(),
    externalAdapterSourceAdapterRequestEvidenceFingerprints: externalAdapterSourceAdapterRequestEvidenceFingerprintsSummary(),
    externalAdapterSourceAdapterConfigStatFingerprints: externalAdapterSourceAdapterConfigStatFingerprintsSummary(),
    externalAdapterSourceAdapterRegistryAggregateFingerprints: externalAdapterSourceAdapterRegistryAggregateFingerprintsSummary(),
    externalAdapterSourceAdapterRegistryFingerprints: externalAdapterSourceAdapterRegistryFingerprintsSummary(),
    externalAdapterSourceAdapterPreflightFingerprints: externalAdapterSourceAdapterPreflightFingerprintsSummary(),
    pointCloudFamilies: [],
    performanceEvidenceReady: false,
    sourceEvidenceReady: false
  };
}

function finalPrivateAcceptanceSummary() {
  return {
    profileId: FINAL_PRIVATE_ACCEPTANCE_PROFILE.id,
    upstreamCorpusRunProfile: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.upstreamCorpusRunProfile,
    completionEvidenceId: FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.id,
    requiredSourceFamilies: [...FINAL_PRIVATE_ACCEPTANCE_PROFILE.requiredSourceFamilies],
    requiredExternalAdapterFamilies: [...FINAL_PRIVATE_ACCEPTANCE_PROFILE.requiredExternalAdapterFamilies],
    requiredExternalAdapterTargetFormatTokens: [...FINAL_PRIVATE_ACCEPTANCE_PROFILE.requiredExternalAdapterTargetFormatTokens],
    requiredPointCloudFamilies: [...FINAL_PRIVATE_ACCEPTANCE_PROFILE.requiredPointCloudFamilies],
    requiredPrivateEvidence: [...FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.requiredPrivateEvidence],
    finalCompletionGate: FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.finalCompletionGate,
    checkedInSmokeDoesNotCompleteGoal: FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.checkedInSmokeDoesNotCompleteGoal,
    requiresPrivateCorpus: FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.requiresPrivateCorpus,
    requiresReportFingerprintPin: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.requiresReportFingerprintPin,
    requiresSourceEvidenceSemanticsProfileGate: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.requiresSourceEvidenceSemanticsProfileGate,
    requiresDisposableProjectCopies: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.requiresDisposableProjectCopies,
    requiresPromotedReferenceSidecars: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.requiresPromotedReferenceSidecars,
    proofPlanFingerprint: FINAL_PRIVATE_ACCEPTANCE_PROFILE.endToEndProofPlan.proofPlanFingerprint,
    missingEvidenceRecommendedAction: FINAL_PRIVATE_ACCEPTANCE_PROFILE.completionEvidenceRequirements.missingEvidenceRecommendedAction
  };
}

function verificationFailureOutput(options = {}, failures = [], overrides = {}) {
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    reportId: overrides.reportId || "",
    reportVersion: overrides.reportVersion || "",
    reportPath: pathFreeInputFileName(options.reportPath),
    reportFingerprint: SHA256_FINGERPRINT.test(overrides.reportFingerprint || "") ? overrides.reportFingerprint : "",
    finalPrivateAcceptanceSummary: finalPrivateAcceptanceSummary(),
    gates: emptyVerificationGates(options, overrides),
    summary: emptyVerificationSummary(),
    failures,
    warnings: []
  };
}

function safeFailureId(value) {
  const text = String(value || "");
  return SAFE_CASE_ID.test(text) ? text : "unsafe_id";
}

function pushCaseFailures(failures, label, caseIds) {
  const uniqueIds = [...new Set(caseIds.map(safeFailureId))].filter(Boolean);
  if (uniqueIds.length > 0) {
    failures.push(`${label}: ${uniqueIds.join(", ")}`);
  }
}

function writeReport(outputPath, report) {
  if (!outputPath) return;
  try {
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  } catch {
    throw new Error("verification output must be writable");
  }
}

function pathFreeFailureMessage(error) {
  const text = String(error?.message || "");
  if (
    !text
    || /[\\/]/.test(text)
    || text.includes("..")
    || /[\u0000-\u001f]/.test(text)
  ) {
    return "reference import corpus acceptance report verification failed";
  }
  return text;
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
  if (!options.reportPath) {
    throw new Error("--report is required");
  }
  const loadedReport = readReportFile(options.reportPath, "reference import corpus report");
  if (loadedReport.failures.length > 0) {
    const failures = [...loadedReport.failures];
    if (
      options.expectedReportFingerprint
      && loadedReport.reportFingerprint
      && loadedReport.reportFingerprint !== options.expectedReportFingerprint
    ) {
      failures.unshift("report fingerprint mismatch");
    }
    const failureReport = verificationFailureOutput(options, failures, {
      reportFingerprint: loadedReport.reportFingerprint
    });
    process.stdout.write(`${JSON.stringify(failureReport, null, 2)}\n`);
    return 1;
  }
  const verification = verifyReport(loadedReport.report, options, loadedReport.reportFingerprint);
  try {
    writeReport(options.outputPath, verification);
  } catch (error) {
    const failureReport = verificationFailureOutput(options, [pathFreeFailureMessage(error)], {
      reportId: verification.reportId,
      reportVersion: verification.reportVersion,
      reportFingerprint: verification.reportFingerprint
    });
    process.stdout.write(`${JSON.stringify(failureReport, null, 2)}\n`);
    return 1;
  }
  process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
  return verification.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = verificationFailureOutput(activeOptions, [pathFreeFailureMessage(error)]);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
