#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKFLOW_RUNNER = path.join(ROOT, "scripts/run_reference_import_workflow.mjs");
const WORKFLOW_RUNNER_REPORT_PATH = "scripts/run_reference_import_workflow.mjs";
const CHECK_ID = "referenceImportCorpusCheck";
const CONFIG_SCHEMA = "bobercad-reference-import-corpus";
const CHECK_VERSION = "0.1.0";
const DEFAULT_UNTIL_STAGE = "dry-run";
const SAFE_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_TAG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_PUBLIC_WORKFLOW_TEXT = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,199}$/;
const SAFE_CASE_METADATA_MAX_LENGTH = 200;
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
const SOURCE_FORMAT_FAMILY_TOKENS = new Set(SOURCE_FORMAT_FAMILIES.values());
const PROOF_PLAN_ORDERED_STEP_FIELDS = [
  "id",
  "command",
  "commandFlags",
  "expectArgsSource",
  "produces",
  "sideEffects"
];
const PROOF_PLAN_STEP_EXPECT_ARGS_SOURCE_FIELDS = [
  "sourceStepId",
  "expectProfile",
  "reportPath",
  "commandPlaceholder",
  "generatedFields"
];
const FINAL_PRIVATE_CORPUS_RUN_PROFILE = {
  id: "full-private-reference-import-corpus-run",
  purpose: "pre-run setup contract for real DXF/DWG/STEP/IFC/E57 private corpus checks before saved-report verification",
  requiredFormatFamilies: ["dxf", "dwg", "step", "ifc", "e57"],
  requiredExternalAdapterFamilies: ["dwg", "e57"],
  recommendedCorpusFlags: [
    "--require-format-families",
    "--require-external-adapter-families",
    "--min-source-file-size-bytes",
    "--allow-import-writes",
    "--require-promoted-import-writes",
    "--output",
    "--print-final-example-config"
  ],
  recommendedPreflightFlags: [
    "--check-config-only",
    "--require-format-families",
    "--require-external-adapter-families",
    "--min-source-file-size-bytes",
    "--allow-import-writes",
    "--require-promoted-import-writes"
  ],
  downstreamVerifierProfile: "full-private-reference-import-acceptance",
  downstreamVerifierFlags: [
    "--expect-report-fingerprint",
    "--require-format-families",
    "--require-external-adapter-families",
    "--require-point-cloud-families",
    "--min-source-file-size-bytes",
    "--require-nonempty-reference-geometry",
    "--require-promoted-import-writes"
  ],
  requiredCaseFields: [
    "projectPath",
    "inputPath",
    "formatToken",
    "untilStage",
    "confirmImport",
    "expected.sourceRequestedFormatFamily",
    "expected.translationMode"
  ],
  externalAdapterCaseRequirements: {
    families: ["dwg", "e57"],
    fields: ["adapterConfigPath", "adapterName", "expected.translationMode", "expected.sourceAdapter"],
    expectedTranslationMode: "external-adapter"
  },
  pointCloudAcceptance: {
    family: "e57",
    verifiedBy: "scripts/verify_reference_import_corpus_report.mjs --require-point-cloud-families e57"
  },
  exampleConfigRole: "safe-dry-run-template",
  finalConfigOverlay: {
    defaults: {
      untilStage: "import"
    },
    cases: {
      confirmImport: true,
      projectPath: "disposable project copy path"
    },
    externalAdapterCases: {
      adapterConfigPath: "real local adapter config path",
      adapterName: "real selected adapter key"
    },
    requiresAllowImportWritesFlag: true,
    requiresOutputReportPath: true
  },
  endToEndProofPlan: {
    id: "full-private-reference-import-proof-plan",
    purpose: "ordered artifact contract for final private DXF/DWG/STEP/IFC/E57 acceptance without changing app/runtime code",
    orderedStepFields: PROOF_PLAN_ORDERED_STEP_FIELDS,
    stepExpectArgsSourceFields: PROOF_PLAN_STEP_EXPECT_ARGS_SOURCE_FIELDS,
    orderedSteps: [
      {
        id: "generate-final-config",
        command: "node scripts/check_reference_import_corpus.mjs --print-final-example-config",
        produces: "private final corpus config",
        sideEffects: false
      },
      {
        id: "preflight-final-config",
        command: "node scripts/check_reference_import_corpus.mjs --config <final-corpus-config.json> --check-config-only --require-format-families dxf,dwg,step,ifc,e57 --require-external-adapter-families dwg,e57 --min-source-file-size-bytes <min-real-source-file-size-bytes> --output <config-preflight-report.json>",
        commandFlags: ["--config", "--check-config-only", "--require-format-families", "--require-external-adapter-families", "--min-source-file-size-bytes", "--output"],
        produces: "saved config-preflight report",
        sideEffects: false
      },
      {
        id: "run-promoted-import-corpus",
        command: "node scripts/check_reference_import_corpus.mjs --config <final-corpus-config.json> --require-format-families dxf,dwg,step,ifc,e57 --require-external-adapter-families dwg,e57 --min-source-file-size-bytes <min-real-source-file-size-bytes> --allow-import-writes --require-promoted-import-writes --output <promoted-import-report.json>",
        commandFlags: ["--config", "--require-format-families", "--require-external-adapter-families", "--min-source-file-size-bytes", "--allow-import-writes", "--require-promoted-import-writes", "--output"],
        produces: "saved referenceImportCorpusCheck report",
        sideEffects: "writes only selected disposable project copies and their promoted reference manifests"
      },
      {
        id: "verify-promoted-report",
        command: "node scripts/verify_reference_import_corpus_report.mjs --report <promoted-import-report.json> --require-format-families dxf,dwg,step,ifc,e57 --require-external-adapter-families dwg,e57 --require-point-cloud-families e57 --min-source-file-size-bytes <min-real-source-file-size-bytes> --require-nonempty-reference-geometry --require-promoted-import-writes",
        commandFlags: ["--report", "--require-format-families", "--require-external-adapter-families", "--require-point-cloud-families", "--min-source-file-size-bytes", "--require-nonempty-reference-geometry", "--require-promoted-import-writes"],
        produces: "verifier output with reportFingerprint",
        sideEffects: false
      },
      {
        id: "fingerprint-promoted-corpus-report",
        command: "node scripts/fingerprint_reference_import_artifacts.mjs --artifact promoted-import-corpus-report=<promoted-import-report.json> --expect-profile corpus-report-verification --output <promoted-import-corpus-fingerprint.json>",
        commandFlags: ["--artifact", "--expect-profile", "--output"],
        produces: "saved promoted corpus report fingerprint report",
        sideEffects: false
      },
      {
        id: "verify-pinned-report-fingerprint",
        command: "node scripts/verify_reference_import_corpus_report.mjs --report <promoted-import-report.json> <corpus-report-verification.expectArgs> --require-format-families dxf,dwg,step,ifc,e57 --require-external-adapter-families dwg,e57 --require-point-cloud-families e57 --min-source-file-size-bytes <min-real-source-file-size-bytes> --require-nonempty-reference-geometry --require-promoted-import-writes --output <verification-output.json>",
        commandFlags: ["--report", "--expect-report-fingerprint", "--require-format-families", "--require-external-adapter-families", "--require-point-cloud-families", "--min-source-file-size-bytes", "--require-nonempty-reference-geometry", "--require-promoted-import-writes", "--output"],
        expectArgsSource: {
          sourceStepId: "fingerprint-promoted-corpus-report",
          expectProfile: "corpus-report-verification",
          reportPath: "<promoted-import-corpus-fingerprint.json>",
          commandPlaceholder: "<corpus-report-verification.expectArgs>",
          generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
        },
        produces: "saved referenceImportCorpusAcceptanceReport verifier output",
        sideEffects: false
      },
      {
        id: "fingerprint-final-acceptance-input",
        command: "node scripts/fingerprint_reference_import_artifacts.mjs --artifact fingerprint-pinned-verifier-output=<verification-output.json> --expect-profile final-acceptance-input --output <final-acceptance-input-fingerprint.json>",
        commandFlags: ["--artifact", "--expect-profile", "--output"],
        produces: "saved final acceptance input fingerprint report",
        sideEffects: false
      },
      {
        id: "verify-saved-final-acceptance-output",
        command: "node scripts/verify_reference_import_final_acceptance.mjs --report <verification-output.json> <final-acceptance-input.expectArgs> --output <final-acceptance-check.json>",
        commandFlags: ["--report", "--expect-acceptance-report-fingerprint", "--output"],
        expectArgsSource: {
          sourceStepId: "fingerprint-final-acceptance-input",
          expectProfile: "final-acceptance-input",
          reportPath: "<final-acceptance-input-fingerprint.json>",
          commandPlaceholder: "<final-acceptance-input.expectArgs>",
          generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
        },
        produces: "saved final acceptance artifact check report",
        sideEffects: false
      },
      {
        id: "generate-completion-evidence-template",
        command: "node scripts/verify_reference_import_completion_evidence.mjs --final-acceptance-check <final-acceptance-check.json> --print-evidence-template",
        commandFlags: ["--final-acceptance-check", "--print-evidence-template"],
        produces: "path-free completion evidence manifest template",
        sideEffects: false
      },
      {
        id: "verify-dwg-adapter-preflight-evidence",
        command: "node scripts/verify_reference_import_adapter_preflight_evidence.mjs --preflight <dwg-check-adapters.json> --family dwg --output <dwg-adapter-preflight-evidence-check.json>",
        commandFlags: ["--preflight", "--family", "--output"],
        produces: "saved DWG adapter-preflight evidence check report",
        sideEffects: false
      },
      {
        id: "verify-e57-adapter-preflight-evidence",
        command: "node scripts/verify_reference_import_adapter_preflight_evidence.mjs --preflight <e57-check-adapters.json> --family e57 --output <e57-adapter-preflight-evidence-check.json>",
        commandFlags: ["--preflight", "--family", "--output"],
        produces: "saved E57 adapter-preflight evidence check report",
        sideEffects: false
      },
      {
        id: "preflight-completion-evidence-sources",
        command: "node scripts/build_reference_import_completion_evidence.mjs --evidence-sources <completion-evidence.sources.json> --check-sources-only --output <completion-evidence.sources-check.json>",
        commandFlags: ["--evidence-sources", "--check-sources-only", "--output"],
        produces: "saved completion evidence source check report",
        sideEffects: false
      },
      {
        id: "build-completion-evidence-manifest",
        command: "node scripts/build_reference_import_completion_evidence.mjs --final-acceptance-check <final-acceptance-check.json> --evidence-sources <completion-evidence.sources.json> --output <completion-evidence.json>",
        commandFlags: ["--final-acceptance-check", "--evidence-sources", "--output"],
        produces: "path-free completion evidence manifest",
        sideEffects: false
      },
      {
        id: "fingerprint-completion-evidence-input",
        command: "node scripts/fingerprint_reference_import_artifacts.mjs --artifact final-acceptance-check=<final-acceptance-check.json> --expect-profile completion-evidence-input --output <completion-evidence-input-fingerprint.json>",
        commandFlags: ["--artifact", "--expect-profile", "--output"],
        produces: "saved completion evidence input fingerprint report",
        sideEffects: false
      },
      {
        id: "verify-completion-evidence-manifest",
        command: "node scripts/verify_reference_import_completion_evidence.mjs --final-acceptance-check <final-acceptance-check.json> --evidence <completion-evidence.json> <completion-evidence-input.expectArgs> --output <completion-evidence-check.json>",
        commandFlags: ["--final-acceptance-check", "--evidence", "--expect-final-acceptance-check-fingerprint", "--output"],
        expectArgsSource: {
          sourceStepId: "fingerprint-completion-evidence-input",
          expectProfile: "completion-evidence-input",
          reportPath: "<completion-evidence-input-fingerprint.json>",
          commandPlaceholder: "<completion-evidence-input.expectArgs>",
          generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
        },
        produces: "saved completion evidence manifest check report",
        sideEffects: false
      },
      {
        id: "fingerprint-final-proof-bundle-inputs",
        command: "node scripts/fingerprint_reference_import_artifacts.mjs --artifact final-acceptance-check=<final-acceptance-check.json> --artifact completion-evidence-sources-check=<completion-evidence.sources-check.json> --artifact completion-evidence-check=<completion-evidence-check.json> --expect-profile final-proof-bundle-inputs --output <final-proof-bundle-input-fingerprints.json>",
        commandFlags: ["--artifact", "--expect-profile", "--output"],
        produces: "saved final proof bundle input fingerprint report",
        sideEffects: false
      },
      {
        id: "verify-final-proof-bundle",
        command: "node scripts/verify_reference_import_final_proof_bundle.mjs --final-acceptance-check <final-acceptance-check.json> --source-check <completion-evidence.sources-check.json> --completion-evidence-check <completion-evidence-check.json> <final-proof-bundle-inputs.expectArgs> --output <final-proof-bundle-check.json>",
        commandFlags: ["--final-acceptance-check", "--source-check", "--completion-evidence-check", "--expect-final-acceptance-check-fingerprint", "--expect-source-check-fingerprint", "--expect-completion-evidence-check-fingerprint", "--output"],
        expectArgsSource: {
          sourceStepId: "fingerprint-final-proof-bundle-inputs",
          expectProfile: "final-proof-bundle-inputs",
          reportPath: "<final-proof-bundle-input-fingerprints.json>",
          commandPlaceholder: "<final-proof-bundle-inputs.expectArgs>",
          generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
        },
        produces: "saved final proof bundle check report",
        sideEffects: false
      },
      {
        id: "fingerprint-goal-completion-input",
        command: "node scripts/fingerprint_reference_import_artifacts.mjs --artifact final-proof-bundle-check=<final-proof-bundle-check.json> --expect-profile goal-completion-input --output <goal-completion-input-fingerprint.json>",
        commandFlags: ["--artifact", "--expect-profile", "--output"],
        produces: "saved goal completion input fingerprint report",
        sideEffects: false
      },
      {
        id: "audit-goal-completion",
        command: "node scripts/verify_reference_import_goal_completion.mjs --final-proof-bundle-check <final-proof-bundle-check.json> <goal-completion-input.expectArgs> --output <goal-completion-audit.json>",
        commandFlags: ["--final-proof-bundle-check", "--expect-final-proof-bundle-check-fingerprint", "--output"],
        expectArgsSource: {
          sourceStepId: "fingerprint-goal-completion-input",
          expectProfile: "goal-completion-input",
          reportPath: "<goal-completion-input-fingerprint.json>",
          commandPlaceholder: "<goal-completion-input.expectArgs>",
          generatedFields: ["expectArgs", "expectArgPairs", "expectArgsByFlag"]
        },
        produces: "saved goal completion audit report with goalCompletionOutputWritableOk",
        sideEffects: false
      }
    ],
    requiredArtifacts: [
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
    requiredInvariants: [
      "all source families dxf/dwg/step/ifc/e57 accepted",
      "dwg/e57 accepted through external-adapter evidence",
      "dwg/e57 external-adapter cases prove the executed sourceAdapter matches the expected adapter key",
      "dwg/e57 adapter preflight evidence check reports are accepted before completion evidence source preflight",
      "e57 accepted with point-cloud evidence",
      "all accepted cases prove nonempty reference geometry",
      "promoted import evidence exists only on disposable project copies",
      "final verifier output is pinned to the saved corpus report fingerprint",
      "final acceptance checker saves a review artifact with finalAcceptanceOutputWritableOk",
      "completion evidence manifest starts from the path-free template generated from the pinned final acceptance check",
      "completion evidence source manifest passes path-free source preflight before private evidence hashing",
      "completion evidence manifest fingerprints match the final acceptance check, verifier output, and corpus report",
      "completion evidence manifest checker saves a review artifact with completionEvidenceOutputWritableOk",
      "every expected fingerprint handoff is backed by a path-free artifact fingerprint report",
      "artifact fingerprint helper emits path-free labels, sha256 values, expectArgs, expectArgPairs, and expectArgsByFlag for final proof handoff",
      "final proof bundle checker ties together final acceptance, source preflight, and completion evidence reports",
      "final proof bundle checker requires sourceEvidenceSemanticsProfileOk from the completion evidence check summary",
      "final proof bundle checker requires evidenceSourcesFingerprintAlignedOk tying source-check and completion-evidence check to the same source manifest",
      "final proof bundle checker saves the last review artifact with bundleOutputWritableOk",
      "goal completion audit reports 100 percent only from an accepted fingerprint-pinned final proof bundle and saved output with goalCompletionOutputWritableOk"
    ]
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
  disposableProjectCopyRequired: true
};

function stableJsonFingerprint(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function proofPlanFingerprintPayload(plan = {}) {
  const { proofPlanFingerprint, ...payload } = plan;
  return payload;
}

FINAL_PRIVATE_CORPUS_RUN_PROFILE.endToEndProofPlan.proofPlanFingerprint = stableJsonFingerprint(
  proofPlanFingerprintPayload(FINAL_PRIVATE_CORPUS_RUN_PROFILE.endToEndProofPlan)
);

const PATH_OPTION_FIELDS = new Set([
  "projectPath",
  "inputPath",
  "adapterConfigPath",
  "requestPath",
  "referencesDir",
  "workflowOutputPath"
]);
const WORKFLOW_OPTION_FIELDS = [
  "projectPath",
  "inputPath",
  "formatToken",
  "adapterConfigPath",
  "adapterName",
  "adapterTimeoutMs",
  "pointCloudChunkSize",
  "units",
  "requestPath",
  "referencesDir",
  "assetId",
  "name",
  "replaceExisting",
  "visible",
  "snapEnabled",
  "opacity",
  "color",
  "edgeColor",
  "pointSize",
  "origin",
  "axisX",
  "axisY",
  "axisZ",
  "scale",
  "startStage",
  "untilStage",
  "confirmImport",
  "summaryOnly",
  "timeoutMs",
  "maxSteps",
  "includeRawResponses"
];
const CONFIG_TOP_LEVEL_FIELDS = new Set([
  "schema",
  "schemaVersion",
  "defaults",
  "requiredFormatFamilies",
  "requiredExternalAdapterFamilies",
  "cases"
]);
const CASE_FIELDS = new Set([
  "id",
  "label",
  "description",
  "tags",
  "enabled",
  "expected",
  "caseTimeoutMs",
  "format",
  "formatToken",
  "workflowOutputPath",
  ...PATH_OPTION_FIELDS,
  ...WORKFLOW_OPTION_FIELDS
]);
const DEFAULTS_FIELDS = new Set([...CASE_FIELDS].filter((field) => field !== "id"));
const EXPECTED_ASSERTION_FIELDS = [
  "runStatus",
  "finalStage",
  "sourceFormat",
  "sourceRequestedFormat",
  "sourceRequestedFormatFamily",
  "translationMode",
  "sourceAdapter",
  "minSourceFileSizeBytes",
  "maxDurationMs",
  "minReferenceObjectCount",
  "minReferenceLayerCount",
  "minReferenceChunkCount",
  "minReferenceLineSegmentCount",
  "minReferenceMeshFaceCount",
  "minReferencePointCloudPointCount"
];
const EXPECTED_ASSERTION_FIELD_SET = new Set(EXPECTED_ASSERTION_FIELDS);
const EXPECTED_INTEGER_ASSERTION_FIELDS = new Set([
  "minSourceFileSizeBytes",
  "maxDurationMs",
  "minReferenceObjectCount",
  "minReferenceLayerCount",
  "minReferenceChunkCount",
  "minReferenceLineSegmentCount",
  "minReferenceMeshFaceCount",
  "minReferencePointCloudPointCount"
]);
const WORKFLOW_RUN_STATUS_TOKENS = new Set(["completed", "failed", "stopped", "host-error"]);
const TRANSLATION_MODE_TOKENS = new Set(["built-in", "external-adapter", "canonical-json"]);
const TOP_LEVEL_REPORT_FIELDS = [
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
  "configPreflight",
  "errors",
  "runtimeBoundary",
  "cases"
];
const CONFIG_PREFLIGHT_CASE_FIELDS = [
  "id",
  "label",
  "ok",
  "enabled",
  "tags",
  "sourceFile",
  "adapterConfigFile",
  "adapterConfigSupport",
  "writePolicy",
  "sourceSizeExpectation",
  "promotedImportExpectation",
  "request",
  "errors"
];
const CASE_REPORT_FIELDS = [
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
];
const WORKFLOW_SUMMARY_FIELDS = [
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
];
const TOP_LEVEL_RUNTIME_BOUNDARY_REPORT_FIELDS = [
  "invokesWorkflowRunnerOnly",
  "workflowRunnerUsesWorkspaceHost",
  "shell",
  "browserRuntimeExecutesCli",
  "defaultTargetStage",
  "importWritesRequireAllowFlag"
];
const WORKFLOW_RUNTIME_BOUNDARY_REPORT_FIELDS = [
  "browserRuntimeExecutesCli",
  "workflowRunnerUsesWorkspaceHost",
  "workflowRunnerRunsShell",
  "browserRuntimeWritesProjectJson",
  "browserRuntimeWritesReferenceFiles"
];

function usage() {
  return [
    "Usage: node scripts/check_reference_import_corpus.mjs --config <corpus.json> [options]",
    "",
    "Runs configured reference import workflow cases through scripts/run_reference_import_workflow.mjs.",
    "The default target stage is dry-run, so corpus checks do not write project JSON or target reference manifests.",
    "",
    "Options:",
    "  --config <path>          JSON config with defaults and cases.",
    "  --output <path>          Optional machine-readable JSON report path.",
    "  --max-cases <count>      Optional cap for enabled cases.",
    "  --case-timeout-ms <ms>   Optional per-case process timeout; 0 disables timeout.",
    "  --min-source-file-size-bytes <bytes>  Require every selected source file to be at least this large.",
    "  --tag <csv>              Include only enabled cases with at least one selected tag.",
    "  --exclude-tag <csv>      Exclude enabled cases with any selected tag.",
    "  --require-format-families <csv>  Require selected cases to cover source families before running.",
    "  --require-external-adapter-families <csv>  Require selected cases to declare external-adapter coverage for these source families before running.",
    "  --fail-fast             Stop after the first failed case.",
    "  --allow-import-writes    Permit cases with untilStage=import and confirmImport=true.",
  "  --require-promoted-import-writes  Require every selected case to run a confirmed promoted import write.",
  "  --list-contract         Print the corpus config/report contract and exit without running cases.",
  "  --print-example-config  Print a private corpus config template and exit without running cases.",
  "  --print-final-example-config  Print a final promoted-import private corpus config template and exit without running cases.",
  "  --check-config-only     Validate corpus config, source files, coverage, and write gates without running workflows.",
    "  --help                  Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    configPath: "",
    outputPath: "",
    maxCases: 0,
    caseTimeoutMs: 0,
    minSourceFileSizeBytes: 0,
    includeTags: [],
    excludeTags: [],
    requiredFormatFamilies: [],
    requiredExternalAdapterFamilies: [],
    failFast: false,
    allowImportWrites: false,
    requirePromotedImportWrites: false,
    listContract: false,
    printExampleConfig: false,
    printFinalExampleConfig: false,
    checkConfigOnly: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--config") {
      options.configPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--max-cases") {
      options.maxCases = positiveInteger(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--case-timeout-ms") {
      options.caseTimeoutMs = positiveInteger(requiredValue(argv, index, arg), arg, { allowZero: true });
      index += 1;
      continue;
    }
    if (arg === "--min-source-file-size-bytes") {
      options.minSourceFileSizeBytes = positiveInteger(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--tag") {
      options.includeTags = mergeUnique(options.includeTags, tagList(requiredValue(argv, index, arg), arg));
      index += 1;
      continue;
    }
    if (arg === "--exclude-tag") {
      options.excludeTags = mergeUnique(options.excludeTags, tagList(requiredValue(argv, index, arg), arg));
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
    if (arg === "--fail-fast") {
      options.failFast = true;
      continue;
    }
    if (arg === "--allow-import-writes") {
      options.allowImportWrites = true;
      continue;
    }
    if (arg === "--require-promoted-import-writes") {
      options.requirePromotedImportWrites = true;
      continue;
    }
    if (arg === "--list-contract") {
      options.listContract = true;
      continue;
    }
    if (arg === "--print-example-config") {
      options.printExampleConfig = true;
      continue;
    }
    if (arg === "--print-final-example-config") {
      options.printFinalExampleConfig = true;
      continue;
    }
    if (arg === "--check-config-only") {
      options.checkConfigOnly = true;
      continue;
    }
    throw new Error("Unknown option.");
  }
  return options;
}

function corpusCheckContract() {
  return {
    id: "referenceImportCorpusCheckContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    checkVersion: CHECK_VERSION,
    defaultTargetStage: DEFAULT_UNTIL_STAGE,
    supportedWorkflowStages: [...STAGE_IDS],
    configContract: {
      topLevelFields: ["schema", "schemaVersion", "defaults", "requiredFormatFamilies", "requiredExternalAdapterFamilies", "cases"],
      requiredTopLevelFields: ["cases"],
      defaultsField: "defaults",
      casesField: "cases",
      caseIdPattern: SAFE_CASE_ID.source,
      caseFields: [...CASE_FIELDS].sort(),
      caseTagPattern: SAFE_TAG.source,
      workflowOptionFields: [...WORKFLOW_OPTION_FIELDS],
      pathOptionFields: [...PATH_OPTION_FIELDS],
      expectedAssertionFields: [...EXPECTED_ASSERTION_FIELDS],
      coverageFields: ["requiredFormatFamilies", "requiredExternalAdapterFamilies"],
      knownFormatFamilies: [...new Set(SOURCE_FORMAT_FAMILIES.values())],
      formatAliasField: "format",
      canonicalFormatField: "formatToken",
      disabledCaseField: "enabled",
      enabledFalseSkipsCase: true,
      relativePathsResolveAgainstConfigFile: true
    },
    reportContract: {
      reportId: CHECK_ID,
      reportVersion: CHECK_VERSION,
      topLevelFields: [...TOP_LEVEL_REPORT_FIELDS],
      selectionField: "selection",
      selectionReportFields: ["includeTags", "excludeTags", "selectedCaseCount", "runCaseCount", "skippedCaseCount", "skippedCaseIds"],
      caseFields: [...CASE_REPORT_FIELDS],
      workflowSummaryFields: [...WORKFLOW_SUMMARY_FIELDS],
      coverageField: "coverage",
      coverageReportFields: ["requiredFormatFamilies", "presentFormatFamilies", "missingFormatFamilies", "caseFormatFamilies", "coverageOk"],
      performanceField: "performance",
      performanceReportFields: ["totalDurationMs", "maxDurationMs", "maxDurationCaseId", "caseDurations"],
      globalAcceptanceGateFields: ["minSourceFileSizeBytes", "requiredExternalAdapterFamilies", "requirePromotedImportWrites"],
      setupFailureReportFields: [...TOP_LEVEL_REPORT_FIELDS],
      topLevelRuntimeBoundaryField: "runtimeBoundary",
      topLevelRuntimeBoundaryFields: [...TOP_LEVEL_RUNTIME_BOUNDARY_REPORT_FIELDS],
      workflowRuntimeBoundaryPath: "cases[].workflow.runtimeBoundary",
      workflowRuntimeBoundaryFields: [...WORKFLOW_RUNTIME_BOUNDARY_REPORT_FIELDS],
      acceptanceField: "acceptance",
      acceptanceReportFields: ["accepted", "recommendedNextAction", "reason", "caseCount", "allCasesPassed", "requiredFormatCoverageOk", "externalAdapterCoverageOk", "requiredExternalAdapterFamilies", "presentExternalAdapterFamilies", "externalAdapterMissingFamilies", "sourceEvidenceReady", "performanceEvidenceReady", "failedCaseIds", "missingFormatFamilies", "sourceEvidenceMissingCaseIds", "performanceEvidenceMissingCaseIds"],
      configPreflightField: "configPreflight",
      configPreflightCaseFields: [...CONFIG_PREFLIGHT_CASE_FIELDS],
      configPreflightReportFields: ["ok", "recommendedNextAction", "reason", "caseCount", "coverageOk", "missingFormatFamilies", "externalAdapterCoverageOk", "requiredExternalAdapterFamilies", "presentExternalAdapterFamilies", "externalAdapterMissingFamilies", "sourceFilesOk", "adapterConfigsOk", "adapterConfigFilesOk", "adapterConfigJsonOk", "adapterConfigSupportOk", "writePolicyOk", "sourceSizeExpectationsOk", "promotedImportExpectationsOk", "sourceFileMissingCaseIds", "adapterConfigMissingCaseIds", "adapterConfigInvalidCaseIds", "adapterConfigUnsupportedCaseIds", "writePolicyErrorCaseIds", "sourceSizeExpectationFailedCaseIds", "promotedImportRequirementFailedCaseIds"],
      adapterConfigFileSummaryFields: ["required", "provided", "exists", "isFile", "jsonReadable", "schemaOk", "adapterCount", "sizeBytes", "modifiedTime", "statFingerprint"],
      adapterConfigSupportSummaryFields: ["required", "ok", "formatFamily", "selectedAdapterKey", "selectedAdapterFound", "selectedAdapterSupportsFormatFamily", "supportingAdapterKeys", "supportedFormatFamilies"],
      workflowSourceSummaryFields: ["sourceFormat", "sourceRequestedFormat", "sourceRequestedFormatFamily", "sourceRequestedFormatAliases", "translationMode", "sourceAdapter", "adapterConfigProvided", "adapterPreflightOk", "adapterRequestEvidenceFingerprint", "adapterConfigStatFingerprint", "adapterRegistryFingerprint", "adapterRegistryAdapterFingerprint", "adapterPreflightFingerprint"],
      sourceFileSummaryFields: ["exists", "isFile", "extension", "formatFamily", "sizeBytes", "modifiedTime", "statFingerprint"],
      pathPrivacyFields: ["configPath", "workflowRunnerPath"],
      pathPrivacyPolicy: "configPath is a path-free file name; workflowRunnerPath is the stable repository-relative workflow runner path; workflow summary status/action text is reduced to short path-free public tokens",
      fingerprintSummaryField: "finalFingerprintSummary",
      fingerprintPattern: "^sha256:[a-f0-9]{64}$",
      boundedStderrExcerptBytes: 2000,
      rawWorkflowResponsesIncludedByDefault: false,
      rawHostResponsesIncludedByDefault: false,
      canonicalGeometryPayloadsIncluded: false
    },
    executionBoundary: {
      invokesWorkflowRunnerOnly: true,
      workflowRunnerCli: "scripts/run_reference_import_workflow.mjs",
      workflowOptionsTransport: "--options-json-base64",
      shell: false,
      browserRuntimeExecutesCli: false,
      importsTranslatorModules: false,
      launchesExternalAdaptersDirectly: false
    },
    safetyPolicy: {
      defaultPromotedWrites: false,
      defaultUntilStage: DEFAULT_UNTIL_STAGE,
      importWritesRequireCaseConfirmImport: true,
      importWritesRequireAllowImportWritesFlag: true,
      promotedImportAcceptanceRequiresRequirePromotedImportWritesFlag: true,
      dryRunWritesProjectJson: false,
      dryRunWritesTargetReferenceManifest: false,
      caseTimeoutDefaultMs: 0
    },
    finalPrivateCorpusRunProfile: FINAL_PRIVATE_CORPUS_RUN_PROFILE,
    cliFlags: [
      "--config",
      "--output",
      "--max-cases",
      "--case-timeout-ms",
      "--min-source-file-size-bytes",
      "--tag",
      "--exclude-tag",
      "--require-format-families",
      "--require-external-adapter-families",
      "--fail-fast",
      "--allow-import-writes",
      "--require-promoted-import-writes",
      "--list-contract",
      "--print-example-config",
      "--print-final-example-config",
      "--check-config-only",
      "--help"
    ]
  };
}

function exampleCorpusConfig() {
  return {
    schema: CONFIG_SCHEMA,
    schemaVersion: CHECK_VERSION,
    defaults: {
      projectPath: "C:/boberos/agent4/bobercad/data/projects/sample_boolean_beam.json",
      untilStage: "dry-run",
      caseTimeoutMs: 900000,
      units: "mm"
    },
    requiredFormatFamilies: ["dxf", "dwg", "step", "ifc", "e57"],
    requiredExternalAdapterFamilies: ["dwg", "e57"],
    cases: [
      exampleCorpusCase("dxf_large_reference", "large/source-reference.dxf", "dxf", ["large", "dxf"], {
        sourceRequestedFormatFamily: "dxf",
        translationMode: "built-in"
      }),
      exampleCorpusCase("dwg_large_reference", "large/source-reference.dwg", "dwg", ["large", "dwg", "external-adapter"], {
        sourceRequestedFormatFamily: "dwg",
        translationMode: "external-adapter",
        sourceAdapter: "dwg-dxf-bridge",
        adapterConfigPath: "adapters/reference_geometry_adapters.local.json",
        adapterName: "dwg-dxf-bridge"
      }),
      exampleCorpusCase("step_large_reference", "large/source-reference.step", "step", ["large", "step"], {
        sourceRequestedFormatFamily: "step",
        translationMode: "built-in"
      }),
      exampleCorpusCase("ifc_large_reference", "large/source-reference.ifc", "ifc", ["large", "ifc"], {
        sourceRequestedFormatFamily: "ifc",
        translationMode: "built-in"
      }),
      exampleCorpusCase("e57_large_reference", "large/site-scan.e57", "e57pointcloud", ["large", "e57", "point-cloud", "external-adapter"], {
        sourceRequestedFormatFamily: "e57",
        translationMode: "external-adapter",
        sourceAdapter: "e57-xyz-pointcloud",
        adapterConfigPath: "adapters/reference_geometry_adapters.local.json",
        adapterName: "e57-xyz-pointcloud",
        pointCloudChunkSize: 100000
      })
    ]
  };
}

function finalExampleCorpusConfig() {
  const config = exampleCorpusConfig();
  delete config.defaults.projectPath;
  config.defaults.untilStage = "import";
  config.defaults.description = "Final promoted-import template: replace disposable project paths and adapter placeholders before running.";
  config.cases = config.cases.map((entry) => ({
    ...entry,
    projectPath: `disposable-projects/${entry.id}.project.json`,
    untilStage: "import",
    confirmImport: true,
    expected: {
      ...entry.expected,
      finalStage: "import"
    }
  }));
  return config;
}

function exampleCorpusCase(id, inputPath, formatToken, tags, options = {}) {
  const entry = {
    id,
    tags,
    inputPath,
    format: formatToken,
    assetId: id,
    expected: {
      runStatus: "completed",
      finalStage: "dry-run",
      sourceRequestedFormatFamily: options.sourceRequestedFormatFamily || "",
      translationMode: options.translationMode || "",
      ...(options.sourceAdapter ? { sourceAdapter: options.sourceAdapter } : {}),
      minSourceFileSizeBytes: 100000000,
      maxDurationMs: 900000,
      minReferenceObjectCount: 1
    }
  };
  if (options.adapterConfigPath) entry.adapterConfigPath = options.adapterConfigPath;
  if (options.adapterName) entry.adapterName = options.adapterName;
  if (options.pointCloudChunkSize) {
    entry.pointCloudChunkSize = options.pointCloudChunkSize;
    entry.expected.minReferencePointCloudPointCount = 1;
    delete entry.expected.minReferenceObjectCount;
  }
  return entry;
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function positiveInteger(value, flag, { allowZero = false } = {}) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${flag} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  }
  return parsed;
}

function mergeUnique(base = [], next = []) {
  const merged = [...base];
  const seen = new Set(base);
  for (const value of next) {
    if (seen.has(value)) continue;
    seen.add(value);
    merged.push(value);
  }
  return merged;
}

function tagList(value, flag = "tags", { allowEmpty = false } = {}) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const tags = [];
  const seen = new Set();
  for (const item of values) {
    if (typeof item !== "string") {
      throw new Error(`${flag} contains unsupported tag`);
    }
    const tag = item.trim();
    if (!tag) continue;
    if (!SAFE_TAG.test(tag)) {
      throw new Error(`${flag} contains unsupported tag`);
    }
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  if (tags.length < 1 && allowEmpty !== true) {
    throw new Error(`${flag} must contain at least one tag`);
  }
  return tags;
}

function formatFamilyList(value, flag = "requiredFormatFamilies") {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const families = [];
  const seen = new Set();
  for (const item of values) {
    if (typeof item !== "string") {
      throw new Error(`${flag} contains unsupported source format family`);
    }
    const token = item.trim();
    if (!token) continue;
    const family = canonicalFormatFamilyToken(item);
    if (!SOURCE_FORMAT_FAMILIES.has(family)) {
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

function canonicalFormatFamilyToken(value) {
  if (typeof value !== "string") return "";
  const token = value.trim().toLowerCase();
  if (!token) return "";
  return SOURCE_FORMAT_FAMILIES.get(token) || "";
}

function isPathFreeReportName(value) {
  const text = String(value || "");
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

function readJsonFile(filePath, label) {
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label} must be readable JSON`);
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function loadConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const config = readJsonFile(absoluteConfigPath, "corpus config");
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("corpus config must be a JSON object");
  }
  const unknownTopLevelFields = Object.keys(config).filter((field) => !CONFIG_TOP_LEVEL_FIELDS.has(field));
  if (unknownTopLevelFields.length > 0) {
    throw new Error("corpus config has unsupported fields");
  }
  if (config.schema !== CONFIG_SCHEMA) {
    throw new Error(`corpus config schema must be ${CONFIG_SCHEMA}`);
  }
  if (config.schemaVersion !== CHECK_VERSION) {
    throw new Error(`corpus config schemaVersion must be ${CHECK_VERSION}`);
  }
  const defaults = config.defaults === undefined ? {} : config.defaults;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    throw new Error("corpus config defaults must be a JSON object when present");
  }
  const unknownDefaultsFields = Object.keys(defaults).filter((field) => !DEFAULTS_FIELDS.has(field));
  if (unknownDefaultsFields.length > 0) {
    throw new Error("corpus config defaults has unsupported fields");
  }
  if (!Array.isArray(config.cases) || config.cases.length < 1) {
    throw new Error("corpus config must contain a non-empty cases array");
  }
  return {
    absoluteConfigPath,
    configDir: path.dirname(absoluteConfigPath),
    defaults,
    requiredFormatFamilies: config.requiredFormatFamilies === undefined
      ? []
      : formatFamilyList(config.requiredFormatFamilies, "requiredFormatFamilies"),
    requiredExternalAdapterFamilies: config.requiredExternalAdapterFamilies === undefined
      ? []
      : formatFamilyList(config.requiredExternalAdapterFamilies, "requiredExternalAdapterFamilies"),
    cases: config.cases
  };
}

function mergeCase(defaults, caseConfig, index, configDir) {
  if (!caseConfig || typeof caseConfig !== "object" || Array.isArray(caseConfig)) {
    throw new Error(`cases[${index}] must be a JSON object`);
  }
  const unknownFields = Object.keys(caseConfig).filter((field) => !CASE_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw new Error(`cases[${index}] has unsupported fields`);
  }
  const merged = { ...defaults, ...caseConfig };
  if (caseConfig.format !== undefined && caseConfig.formatToken === undefined) {
    merged.formatToken = caseConfig.format;
  }
  if (defaults.format !== undefined && defaults.formatToken === undefined && merged.formatToken === undefined) {
    merged.formatToken = defaults.format;
  }
  merged.untilStage = merged.untilStage || DEFAULT_UNTIL_STAGE;
  if (!STAGE_IDS.has(merged.untilStage)) {
    throw new Error(`cases[${index}] uses unknown untilStage`);
  }
  if (merged.startStage !== undefined && merged.startStage !== "" && !STAGE_IDS.has(merged.startStage)) {
    throw new Error(`cases[${index}] uses unknown startStage`);
  }
  if (typeof merged.id !== "string") {
    throw new Error(`cases[${index}].id must be a string id`);
  }
  const id = merged.id.trim();
  if (!SAFE_CASE_ID.test(id)) {
    throw new Error(`cases[${index}].id must match ${SAFE_CASE_ID}`);
  }
  const normalized = { ...merged, id };
  if (normalized.formatToken !== undefined && normalized.formatToken !== null && normalized.formatToken !== "") {
    if (typeof normalized.formatToken !== "string") {
      throw new Error(`cases[${index}].formatToken must be a string source format token`);
    }
    if (!isSourceFormatToken(normalized.formatToken)) {
      throw new Error(`cases[${index}].formatToken must be a supported source format token`);
    }
  }
  if (normalized.adapterName !== undefined && normalized.adapterName !== null && normalized.adapterName !== "" && typeof normalized.adapterName !== "string") {
    throw new Error(`cases[${index}].adapterName must be a string adapter key`);
  }
  if (normalized.tags !== undefined && normalized.tags !== null && !Array.isArray(normalized.tags)) {
    throw new Error(`cases[${index}].tags must be an array`);
  }
  normalized.tags = tagList(normalized.tags || [], `cases[${index}].tags`, { allowEmpty: true });
  validateCaseMetadata(normalized, index);
  validateExpectedAssertions(normalized.expected, index);
  for (const field of PATH_OPTION_FIELDS) {
    if (normalized[field] !== undefined && normalized[field] !== null && normalized[field] !== "") {
      if (typeof normalized[field] !== "string") {
        throw new Error(`cases[${index}].${field} must be a string path`);
      }
      normalized[field] = path.resolve(configDir, normalized[field]);
    }
  }
  return normalized;
}

function validateCaseMetadata(caseConfig, index) {
  for (const field of ["label", "description"]) {
    if (caseConfig[field] !== undefined && caseConfig[field] !== null && safeOptionalCaseMetadata(caseConfig[field]) !== true) {
      throw new Error(`cases[${index}].${field} must be empty or short path-free text`);
    }
  }
}

function safeOptionalCaseMetadata(value) {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  return value.trim().length > 0
    && value.length <= SAFE_CASE_METADATA_MAX_LENGTH
    && !/[\\/:]/.test(value)
    && !value.includes("..")
    && !/[\u0000-\u001f]/.test(value);
}

function validateExpectedAssertions(expected, index) {
  if (expected === undefined || expected === null) return;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    throw new Error(`cases[${index}].expected must be a JSON object`);
  }
  if (!Object.keys(expected).every((field) => EXPECTED_ASSERTION_FIELD_SET.has(field))) {
    throw new Error(`cases[${index}].expected has unsupported fields`);
  }
  for (const field of EXPECTED_INTEGER_ASSERTION_FIELDS) {
    if (expected[field] !== undefined && !isNonnegativeSafeInteger(expected[field])) {
      throw new Error(`cases[${index}].expected.${field} must be a non-negative integer`);
    }
  }
  if (expected.runStatus !== undefined && (typeof expected.runStatus !== "string" || !WORKFLOW_RUN_STATUS_TOKENS.has(expected.runStatus))) {
    throw new Error(`cases[${index}].expected.runStatus must be a supported workflow status token`);
  }
  if (expected.finalStage !== undefined && (typeof expected.finalStage !== "string" || !STAGE_IDS.has(expected.finalStage))) {
    throw new Error(`cases[${index}].expected.finalStage must be a supported workflow stage token`);
  }
  if (expected.sourceFormat !== undefined && !isSourceFormatToken(expected.sourceFormat)) {
    throw new Error(`cases[${index}].expected.sourceFormat must be a supported source format token`);
  }
  if (expected.sourceRequestedFormat !== undefined && !isSourceFormatToken(expected.sourceRequestedFormat)) {
    throw new Error(`cases[${index}].expected.sourceRequestedFormat must be a supported source format token`);
  }
  if (expected.sourceRequestedFormatFamily !== undefined && !isSourceFormatFamilyToken(expected.sourceRequestedFormatFamily)) {
    throw new Error(`cases[${index}].expected.sourceRequestedFormatFamily must be a supported source format family token`);
  }
  if (expected.translationMode !== undefined && (typeof expected.translationMode !== "string" || !TRANSLATION_MODE_TOKENS.has(expected.translationMode))) {
    throw new Error(`cases[${index}].expected.translationMode must be a supported translation mode token`);
  }
  if (expected.sourceAdapter !== undefined && !safeAdapterKeyToken(expected.sourceAdapter)) {
    throw new Error(`cases[${index}].expected.sourceAdapter must be a safe adapter key`);
  }
  if (expected.translationMode === "external-adapter" && !safeAdapterKeyToken(expected.sourceAdapter)) {
    throw new Error(`cases[${index}].expected.sourceAdapter is required for external-adapter cases`);
  }
}

function isSourceFormatToken(value) {
  if (typeof value !== "string") return false;
  const text = value;
  return text === text.toLowerCase() && SOURCE_FORMAT_FAMILIES.has(text);
}

function isSourceFormatFamilyToken(value) {
  if (typeof value !== "string") return false;
  const text = value;
  return text === text.toLowerCase() && SOURCE_FORMAT_FAMILY_TOKENS.has(text);
}

function caseMatchesSelection(caseConfig = {}, runtimeOptions = {}) {
  const tags = Array.isArray(caseConfig.tags) ? caseConfig.tags : [];
  if (runtimeOptions.includeTags.length > 0 && !runtimeOptions.includeTags.some((tag) => tags.includes(tag))) {
    return false;
  }
  if (runtimeOptions.excludeTags.length > 0 && runtimeOptions.excludeTags.some((tag) => tags.includes(tag))) {
    return false;
  }
  return true;
}

function workflowOptions(caseConfig) {
  const options = {};
  for (const field of WORKFLOW_OPTION_FIELDS) {
    if (caseConfig[field] !== undefined && caseConfig[field] !== null && caseConfig[field] !== "") {
      options[field] = caseConfig[field];
    }
  }
  if (caseConfig.workflowOutputPath) {
    options.outputPath = caseConfig.workflowOutputPath;
  }
  return options;
}

function caseFormatFamily(caseConfig = {}) {
  const explicitToken = safeSourceExtensionToken(caseConfig.formatToken || "");
  const explicitFamily = canonicalFormatFamilyToken(explicitToken);
  if (explicitFamily) {
    return {
      family: explicitFamily,
      token: explicitToken,
      source: "formatToken"
    };
  }
  const inputPath = caseConfig.inputPath ? String(caseConfig.inputPath) : "";
  const extensionToken = safeSourceExtensionToken(inputPath ? path.extname(inputPath).replace(/^\./, "") : "");
  const extensionFamily = canonicalFormatFamilyToken(extensionToken);
  return {
    family: extensionFamily,
    token: extensionToken,
    source: extensionToken ? "inputPathExtension" : ""
  };
}

function corpusCoverage(cases = [], requiredFormatFamilies = []) {
  const caseFormatFamilies = cases.map((caseConfig) => {
    const family = caseFormatFamily(caseConfig);
    return {
      id: caseConfig.id,
      formatFamily: family.family,
      sourceToken: family.token,
      source: family.source
    };
  });
  const presentFormatFamilies = [...new Set(caseFormatFamilies.map((entry) => entry.formatFamily).filter(Boolean))].sort();
  const missingFormatFamilies = requiredFormatFamilies.filter((family) => !presentFormatFamilies.includes(family));
  return {
    requiredFormatFamilies: [...requiredFormatFamilies],
    presentFormatFamilies,
    missingFormatFamilies,
    caseFormatFamilies,
    coverageOk: missingFormatFamilies.length === 0
  };
}

function corpusExternalAdapterCoverage(cases = [], requiredExternalAdapterFamilies = []) {
  const requiredFamilies = Array.isArray(requiredExternalAdapterFamilies) ? [...requiredExternalAdapterFamilies] : [];
  const externalAdapterFamilies = new Set();
  for (const caseConfig of cases) {
    if (caseConfig?.expected?.translationMode !== "external-adapter") continue;
    const family = caseFormatFamily(caseConfig).family;
    if (family) externalAdapterFamilies.add(family);
  }
  const presentExternalAdapterFamilies = [...externalAdapterFamilies].sort();
  const externalAdapterMissingFamilies = requiredFamilies.filter((family) => !externalAdapterFamilies.has(family));
  return {
    requiredExternalAdapterFamilies: requiredFamilies,
    presentExternalAdapterFamilies,
    externalAdapterMissingFamilies,
    externalAdapterCoverageOk: externalAdapterMissingFamilies.length === 0
  };
}

function assertSafeCaseWrites(caseConfig, runtimeOptions) {
  const importTarget = caseConfig.untilStage === "import" || caseConfig.startStage === "import";
  if (importTarget && caseConfig.confirmImport === true && runtimeOptions.allowImportWrites !== true) {
    throw new Error("case requests confirmed import writes; rerun with --allow-import-writes if this is intentional");
  }
}

function promotedImportExpectation(caseConfig, runtimeOptions) {
  const promotedWriteTarget = caseConfig.untilStage === "import" || caseConfig.startStage === "import";
  const confirmImport = caseConfig.confirmImport === true;
  const allowImportWrites = runtimeOptions.allowImportWrites === true;
  const checked = runtimeOptions.requirePromotedImportWrites === true;
  const ok = !checked || (promotedWriteTarget && confirmImport && allowImportWrites);
  return {
    checked,
    ok,
    required: checked,
    promotedWriteTarget,
    confirmImport,
    allowImportWrites
  };
}

function promotedImportRequirementErrors(selectedCases = [], runtimeOptions = {}) {
  if (runtimeOptions.requirePromotedImportWrites !== true) return [];
  return selectedCases
    .filter((caseConfig) => promotedImportExpectation(caseConfig, runtimeOptions).ok !== true)
    .map(() => "promoted import writes required but selected case is not a confirmed import write target or --allow-import-writes is missing");
}

function runCase(caseConfig, runtimeOptions) {
  assertSafeCaseWrites(caseConfig, runtimeOptions);
  const options = workflowOptions(caseConfig);
  const args = [
    WORKFLOW_RUNNER,
    "--options-json-base64",
    Buffer.from(JSON.stringify(options), "utf8").toString("base64")
  ];
  const timeout = positiveCaseTimeout(caseConfig, runtimeOptions);
  const spawnOptions = {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    maxBuffer: 1024 * 1024 * 64
  };
  if (timeout > 0) spawnOptions.timeout = timeout;
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const result = spawnSync(process.execPath, args, spawnOptions);
  const durationMs = Date.now() - startedAtMs;
  const finishedAt = new Date().toISOString();
  const parsed = parseStdoutJson(result.stdout);
  return caseReport({
    caseConfig,
    workflowOptions: options,
    runtimeOptions,
    result,
    parsed,
    startedAt,
    finishedAt,
    durationMs,
    timeout
  });
}

function positiveCaseTimeout(caseConfig, runtimeOptions) {
  if (caseConfig.caseTimeoutMs !== undefined && caseConfig.caseTimeoutMs !== null && caseConfig.caseTimeoutMs !== "") {
    return positiveInteger(String(caseConfig.caseTimeoutMs), "caseTimeoutMs", { allowZero: true });
  }
  return runtimeOptions.caseTimeoutMs || 0;
}

function parseStdoutJson(stdout = "") {
  try {
    return {
      json: JSON.parse(stdout),
      error: ""
    };
  } catch (error) {
    return {
      json: null,
      error: "stdout-json-parse-failed"
    };
  }
}

function sourceFileSummary(caseConfig = {}) {
  const inputPath = caseConfig.inputPath ? String(caseConfig.inputPath) : "";
  const extension = safeSourceExtensionToken(inputPath ? path.extname(inputPath).replace(/^\./, "") : "");
  const formatFamily = caseFormatFamily(caseConfig).family;
  const summary = {
    exists: false,
    isFile: false,
    extension,
    formatFamily,
    sizeBytes: null,
    modifiedTime: "",
    statFingerprint: ""
  };
  if (!inputPath) return summary;
  try {
    const stat = fs.statSync(inputPath);
    summary.exists = true;
    summary.isFile = stat.isFile();
    summary.sizeBytes = Number.isSafeInteger(stat.size) ? stat.size : null;
    summary.modifiedTime = stat.mtime.toISOString();
    if (summary.isFile && Number.isSafeInteger(stat.size)) {
      summary.statFingerprint = corpusStatFingerprintFromParts("source-file", `${summary.formatFamily}:${summary.extension}`, stat.size, summary.modifiedTime);
    }
  } catch {
    summary.exists = false;
  }
  return summary;
}

function safeSourceExtensionToken(value) {
  if (typeof value !== "string") return "";
  const text = value.trim().toLowerCase();
  return SOURCE_FORMAT_FAMILIES.has(text) ? text : "";
}

function corpusStatFingerprintFromParts(kind, publicIdentity, sourceFileSizeBytes, sourceFileModifiedTime) {
  const text = [
    kind || "",
    publicIdentity || "",
    Number.isInteger(sourceFileSizeBytes) ? String(sourceFileSizeBytes) : "",
    sourceFileModifiedTime || ""
  ].join("\0");
  return `stat-sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

function isSourceStatFingerprint(value) {
  return typeof value === "string" && /^stat-sha256:[0-9a-f]{64}$/.test(value);
}

function isNonnegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSha256Fingerprint(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function safeAdapterKeyToken(value) {
  const text = String(value || "");
  if (!SAFE_ADAPTER_KEY.test(text) || ["__proto__", "prototype", "constructor"].includes(text)) return "";
  return text;
}

function safeWorkflowText(value) {
  const text = String(value || "").trim();
  if (!SAFE_PUBLIC_WORKFLOW_TEXT.test(text)) return "";
  if (text.startsWith("--") || text.includes("..") || /[\\/:]/.test(text) || /[\u0000-\u001f]/.test(text)) return "";
  return text;
}

function safeWorkflowRunStatus(value) {
  const text = String(value || "");
  return WORKFLOW_RUN_STATUS_TOKENS.has(text) ? text : "";
}

function safeWorkflowStage(value) {
  const text = String(value || "");
  return STAGE_IDS.has(text) ? text : "";
}

function safeProcessSignal(value) {
  const text = String(value || "");
  if (!text) return "";
  return /^SIG[A-Z0-9]+$/.test(text) ? text : "signal-present";
}

function safeWorkflowSourceFormat(value) {
  const text = String(value || "");
  return isSourceFormatToken(text) ? text : "";
}

function safeWorkflowSourceFamily(value) {
  const text = String(value || "");
  return isSourceFormatFamilyToken(text) ? text : "";
}

function safeWorkflowTranslationMode(value) {
  const text = String(value || "");
  return TRANSLATION_MODE_TOKENS.has(text) ? text : "";
}

function adapterConfigFileSummary(caseConfig = {}) {
  const adapterConfigPath = caseConfig.adapterConfigPath ? String(caseConfig.adapterConfigPath) : "";
  const required = adapterConfigRequired(caseConfig);
  const summary = {
    required,
    provided: Boolean(adapterConfigPath),
    exists: false,
    isFile: false,
    jsonReadable: false,
    schemaOk: false,
    adapterCount: 0,
    sizeBytes: null,
    modifiedTime: "",
    statFingerprint: "",
    errors: []
  };
  if (!adapterConfigPath) return summary;
  try {
    const stat = fs.statSync(adapterConfigPath);
    summary.exists = true;
    summary.isFile = stat.isFile();
    summary.sizeBytes = Number.isSafeInteger(stat.size) ? stat.size : null;
    summary.modifiedTime = stat.mtime.toISOString();
    if (summary.isFile && Number.isSafeInteger(stat.size)) {
      summary.statFingerprint = corpusStatFingerprintFromParts("adapter-config", "json", stat.size, summary.modifiedTime);
    }
    if (summary.isFile) {
      const config = readAdapterConfigFile(adapterConfigPath, summary);
      if (config) {
        summary.adapterCount = Object.keys(config.adapters).length;
      }
    }
  } catch {
    summary.exists = false;
  }
  return summary;
}

function readAdapterConfigFile(adapterConfigPath, summary = null) {
  try {
    const config = JSON.parse(fs.readFileSync(adapterConfigPath, "utf8").replace(/^\uFEFF/, ""));
    if (summary) summary.jsonReadable = true;
    const errors = adapterConfigShapeErrors(config);
    if (summary) {
      summary.schemaOk = errors.length === 0;
      summary.errors.push(...errors);
    }
    return errors.length === 0 ? config : null;
  } catch (error) {
    if (summary) {
      summary.jsonReadable = false;
      summary.schemaOk = false;
      summary.errors.push("adapter config JSON is not readable");
    }
    return null;
  }
}

function adapterConfigShapeErrors(config) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return ["adapter config must be a JSON object"];
  }
  if (config.schema !== "bobercad-reference-geometry-adapters") {
    errors.push("adapter config schema must be bobercad-reference-geometry-adapters");
  }
  if (config.schemaVersion !== CHECK_VERSION) {
    errors.push(`adapter config schemaVersion must be ${CHECK_VERSION}`);
  }
  if (!config.adapters || typeof config.adapters !== "object" || Array.isArray(config.adapters) || Object.keys(config.adapters).length < 1) {
    errors.push("adapter config adapters must be a non-empty object");
    return errors;
  }
  for (const [adapterKey, adapter] of Object.entries(config.adapters)) {
    const safeAdapterKey = safeAdapterKeyToken(adapterKey);
    if (!safeAdapterKey) {
      errors.push("adapter config contains unsupported adapter key");
      continue;
    }
    if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
      errors.push("adapter config adapter entry must be an object");
      continue;
    }
    if (adapter.format !== undefined && adapter.formats !== undefined) {
      errors.push("adapter config adapter entry must declare only one of format or formats");
    }
    const formatTokens = adapterFormatTokens(adapter);
    if (formatTokens === null) {
      errors.push("adapter config adapter format tokens must be strings");
      continue;
    }
    if (formatTokens.length < 1) {
      errors.push("adapter config adapter entry must declare format or formats");
    }
    for (const token of formatTokens) {
      if (!SOURCE_FORMAT_FAMILIES.has(token)) {
        errors.push("adapter config adapter entry declares unsupported format token");
      }
    }
    if (typeof adapter.command !== "string" || !/\S/.test(adapter.command)) {
      errors.push("adapter config adapter entry must declare a non-empty command");
    }
  }
  return errors;
}

function adapterFormatTokens(adapter = {}) {
  if (Array.isArray(adapter.formats)) {
    if (!adapter.formats.every((entry) => typeof entry === "string")) return null;
    return adapter.formats.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  }
  if (adapter.format !== undefined && adapter.format !== null && adapter.format !== "") {
    if (typeof adapter.format !== "string") return null;
    return [adapter.format.trim().toLowerCase()].filter(Boolean);
  }
  return [];
}

function adapterSupportedFormatFamilies(adapter = {}) {
  const tokens = adapterFormatTokens(adapter);
  return Array.isArray(tokens)
    ? [...new Set(tokens.map((token) => canonicalFormatFamilyToken(token)).filter(Boolean))].sort()
    : [];
}

function adapterConfigSupportSummary(caseConfig = {}, adapterConfigFile = {}) {
  const required = adapterConfigFile.required === true;
  const selectedAdapterRaw = caseConfig.adapterName ? String(caseConfig.adapterName) : "";
  const selectedAdapterKey = safeAdapterKeyToken(selectedAdapterRaw);
  const selectedAdapterProvided = Boolean(selectedAdapterRaw);
  const formatFamily = caseFormatFamily(caseConfig).family;
  const summary = {
    required,
    ok: true,
    formatFamily,
    selectedAdapterKey: "",
    selectedAdapterFound: selectedAdapterProvided ? false : null,
    selectedAdapterSupportsFormatFamily: selectedAdapterProvided ? false : null,
    supportingAdapterKeys: [],
    supportedFormatFamilies: [],
    errors: []
  };
  if (!required) return summary;
  if (adapterConfigFile.exists !== true || adapterConfigFile.isFile !== true || adapterConfigFile.schemaOk !== true) {
    summary.ok = false;
    summary.errors.push("adapter config support could not be checked because the config file is missing or invalid");
    return summary;
  }
  const config = readAdapterConfigFile(String(caseConfig.adapterConfigPath), null);
  if (!config) {
    summary.ok = false;
    summary.errors.push("adapter config support could not be checked because the config JSON is invalid");
    return summary;
  }
  const adapters = config.adapters || {};
  const supportedFamilies = new Set();
  const supportingAdapterKeys = [];
  for (const [adapterKey, adapter] of Object.entries(adapters)) {
    const families = adapterSupportedFormatFamilies(adapter);
    for (const family of families) supportedFamilies.add(family);
    if (formatFamily && families.includes(formatFamily)) {
      supportingAdapterKeys.push(adapterKey);
    }
  }
  summary.supportedFormatFamilies = [...supportedFamilies].sort();
  if (selectedAdapterProvided && !selectedAdapterKey) {
    summary.ok = false;
    summary.errors.push("selected adapter key is invalid");
  } else if (selectedAdapterKey) {
    const selectedAdapter = adapters[selectedAdapterKey];
    summary.selectedAdapterFound = Boolean(selectedAdapter);
    const selectedFamilies = selectedAdapter ? adapterSupportedFormatFamilies(selectedAdapter) : [];
    summary.selectedAdapterSupportsFormatFamily = Boolean(formatFamily && selectedFamilies.includes(formatFamily));
    if (!summary.selectedAdapterFound) {
      summary.ok = false;
      summary.errors.push("selected adapter is not declared in adapter config");
    } else if (!summary.selectedAdapterSupportsFormatFamily) {
      summary.ok = false;
      summary.errors.push("selected adapter does not support the requested source format family");
    } else {
      summary.selectedAdapterKey = selectedAdapterKey;
    }
  } else if (supportingAdapterKeys.length < 1) {
    summary.ok = false;
    summary.errors.push(`adapter config does not declare an adapter for source format family ${formatFamily || "unknown"}`);
  }
  if (summary.ok === true) {
    summary.supportingAdapterKeys = supportingAdapterKeys.sort().slice(0, 20);
  }
  return summary;
}

function expectedSourceAdapterPreflight(caseConfig = {}) {
  const translationMode = caseConfig.expected?.translationMode || "";
  const expectedSourceAdapter = caseConfig.expected?.sourceAdapter || "";
  const adapterName = caseConfig.adapterName ? String(caseConfig.adapterName) : "";
  const checked = translationMode === "external-adapter" || expectedSourceAdapter !== "" || adapterName !== "";
  const expectedAdapterKey = safeAdapterKeyToken(expectedSourceAdapter);
  const selectedAdapterKey = safeAdapterKeyToken(adapterName);
  const requiresExpectedAdapter = translationMode === "external-adapter";
  const ok = !checked || (
    (!requiresExpectedAdapter || Boolean(expectedAdapterKey))
    && (!expectedSourceAdapter || Boolean(expectedAdapterKey))
    && (!adapterName || Boolean(selectedAdapterKey))
    && (!expectedAdapterKey || !selectedAdapterKey || expectedAdapterKey === selectedAdapterKey)
  );
  return {
    checked,
    ok,
    error: ok
      ? ""
      : "expected sourceAdapter must be a safe adapter key and match adapterName for external-adapter corpus cases"
  };
}

function adapterConfigRequired(caseConfig = {}) {
  if (caseConfig.adapterConfigPath || caseConfig.adapterName) return true;
  if (caseConfig.expected?.translationMode === "external-adapter") return true;
  const formatFamily = caseFormatFamily(caseConfig).family;
  if (formatFamily === "dwg" || formatFamily === "e57") return true;
  const token = String(caseConfig.formatToken || caseConfig.format || "").trim().toLowerCase();
  return token === "ifczip" || token === "ifcxml";
}

function sourceFileRequired(caseConfig = {}) {
  if (caseConfig.untilStage === "check-references") return false;
  if (caseConfig.startStage === "adapter-preflight" && !caseConfig.inputPath) return false;
  return true;
}

function sourceSizeExpectation(caseConfig = {}, sourceFile = {}, runtimeOptions = {}) {
  const caseMinimum = Number(caseConfig.expected?.minSourceFileSizeBytes);
  const cliMinimum = Number(runtimeOptions.minSourceFileSizeBytes);
  const minimumCandidates = [
    Number.isFinite(caseMinimum) && caseMinimum > 0 ? caseMinimum : 0,
    Number.isFinite(cliMinimum) && cliMinimum > 0 ? cliMinimum : 0
  ].filter((value) => value > 0);
  const expectedMinimum = minimumCandidates.length > 0 ? Math.max(...minimumCandidates) : 0;
  const expectedMinimumSource = expectedMinimum <= 0
    ? ""
    : [
      Number.isFinite(caseMinimum) && caseMinimum > 0 ? "case" : "",
      Number.isFinite(cliMinimum) && cliMinimum > 0 ? "cli" : ""
    ].filter(Boolean).join("+");
  if (expectedMinimum <= 0) {
    return {
      checked: false,
      ok: true,
      expectedMinimum: null,
      expectedMinimumSource,
      cliMinimum: Number.isFinite(cliMinimum) && cliMinimum > 0 ? cliMinimum : null,
      actual: isNonnegativeSafeInteger(sourceFile.sizeBytes) ? sourceFile.sizeBytes : null
    };
  }
  const actual = isNonnegativeSafeInteger(sourceFile.sizeBytes) ? sourceFile.sizeBytes : null;
  return {
    checked: true,
    ok: isNonnegativeSafeInteger(actual) && actual >= expectedMinimum,
    expectedMinimum,
    expectedMinimumSource,
    cliMinimum: Number.isFinite(cliMinimum) && cliMinimum > 0 ? cliMinimum : null,
    actual
  };
}

function writePolicyPreflight(caseConfig, runtimeOptions) {
  try {
    assertSafeCaseWrites(caseConfig, runtimeOptions);
    return {
      ok: true,
      promotedWriteTarget: caseConfig.untilStage === "import" || caseConfig.startStage === "import",
      confirmImport: caseConfig.confirmImport === true,
      allowImportWrites: runtimeOptions.allowImportWrites === true,
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      promotedWriteTarget: caseConfig.untilStage === "import" || caseConfig.startStage === "import",
      confirmImport: caseConfig.confirmImport === true,
      allowImportWrites: runtimeOptions.allowImportWrites === true,
      error: error?.message || "import write policy failed"
    };
  }
}

function configPreflightCaseReport(caseConfig, runtimeOptions) {
  const sourceFile = sourceFileSummary(caseConfig);
  const adapterConfigFile = adapterConfigFileSummary(caseConfig);
  const adapterConfigSupport = adapterConfigSupportSummary(caseConfig, adapterConfigFile);
  const expectedSourceAdapter = expectedSourceAdapterPreflight(caseConfig);
  const writePolicy = writePolicyPreflight(caseConfig, runtimeOptions);
  const sourceSize = sourceSizeExpectation(caseConfig, sourceFile, runtimeOptions);
  const promotedImport = promotedImportExpectation(caseConfig, runtimeOptions);
  const { errors: adapterConfigFileErrors = [], ...adapterConfigFileReport } = adapterConfigFile;
  const requiresSourceFile = sourceFileRequired(caseConfig);
  const sourceFileOk = !requiresSourceFile || (
    sourceFile.exists === true
    && sourceFile.isFile === true
    && isSourceStatFingerprint(sourceFile.statFingerprint)
  );
  const adapterConfigOk = !adapterConfigFile.required || (
    adapterConfigFile.provided === true
    && adapterConfigFile.exists === true
    && adapterConfigFile.isFile === true
    && isSourceStatFingerprint(adapterConfigFile.statFingerprint)
    && adapterConfigFile.jsonReadable === true
    && adapterConfigFile.schemaOk === true
    && adapterConfigSupport.ok === true
  );
  const errors = [];
  if (!sourceFileOk) errors.push("source file is missing, is not a file, or is missing a stat fingerprint");
  if (!adapterConfigOk) errors.push("adapter config is required but missing, invalid, or missing a stat fingerprint");
  for (const error of adapterConfigFileErrors) errors.push(error);
  for (const error of adapterConfigSupport.errors || []) errors.push(error);
  if (expectedSourceAdapter.ok !== true && expectedSourceAdapter.error) errors.push(expectedSourceAdapter.error);
  if (writePolicy.ok !== true && writePolicy.error) errors.push(writePolicy.error);
  if (sourceSize.ok !== true) errors.push(`source file size expected at least ${sourceSize.expectedMinimum} but got ${JSON.stringify(sourceSize.actual)}`);
  if (promotedImport.ok !== true) errors.push("promoted import writes are required but this case is not a confirmed import write target or the global write gate is missing");
  return {
    id: caseConfig.id,
    label: caseConfig.label || "",
    ok: sourceFileOk && adapterConfigOk && expectedSourceAdapter.ok === true && writePolicy.ok === true && sourceSize.ok === true && promotedImport.ok === true,
    enabled: caseConfig.enabled !== false,
    tags: Array.isArray(caseConfig.tags) ? [...caseConfig.tags] : [],
    sourceFile: {
      ...sourceFile,
      required: requiresSourceFile
    },
    adapterConfigFile: adapterConfigFileReport,
    adapterConfigSupport,
    writePolicy,
    sourceSizeExpectation: sourceSize,
    promotedImportExpectation: promotedImport,
    request: {
      targetStage: caseConfig.untilStage || DEFAULT_UNTIL_STAGE,
      startStage: caseConfig.startStage || "",
      confirmImport: caseConfig.confirmImport === true,
      includeRawResponses: caseConfig.includeRawResponses === true
    },
    errors
  };
}

function caseReport({ caseConfig, workflowOptions, runtimeOptions, result, parsed, startedAt, finishedAt, durationMs, timeout }) {
  const workflow = parsed.json;
  const exitCode = Number.isInteger(result.status) ? result.status : null;
  const sourceFile = sourceFileSummary(caseConfig);
  const workflowSummary = workflow ? summarizeWorkflow(workflow) : null;
  const assertions = workflow
    ? [
      ...evaluateExpected(caseConfig.expected, workflow, { sourceFile, durationMs }, runtimeOptions),
      ...evaluateRuntimeAcceptanceGates({ caseConfig, workflowOptions, workflow, runtimeOptions })
    ]
    : [];
  const processOk = exitCode === 0 && !result.error && !result.signal;
  const workflowOk = workflow?.ok === true && workflow?.runStatus === "completed";
  const assertionOk = assertions.every((entry) => entry.ok === true);
  const ok = processOk && workflowOk && assertionOk;
  return {
    id: caseConfig.id,
    label: caseConfig.label || "",
    ok,
    enabled: caseConfig.enabled !== false,
    startedAt,
    finishedAt,
    durationMs,
    timeoutMs: timeout,
    sourceFile,
    process: {
      exitCode,
      signal: safeProcessSignal(result.signal),
      timedOut: result.error?.code === "ETIMEDOUT",
      error: processErrorSummary(result.error)
    },
    workflow: workflowSummary,
    assertions,
    errors: caseErrors({ result, parsed, workflow, workflowSummary, processOk, workflowOk, assertions }),
    stderrExcerpt: stderrSummary(result.stderr),
    stdoutParseError: parsed.error,
    request: {
      targetStage: workflowOptions.untilStage || DEFAULT_UNTIL_STAGE,
      startStage: workflowOptions.startStage || "",
      confirmImport: workflowOptions.confirmImport === true,
      includeRawResponses: workflowOptions.includeRawResponses === true
    }
  };
}

function evaluateRuntimeAcceptanceGates({ caseConfig, workflowOptions, workflow, runtimeOptions }) {
  const checks = [];
  const promotedImport = promotedImportExpectation(caseConfig, runtimeOptions);
  const finalStage = safeWorkflowStage(workflow?.finalStage);
  if (promotedImport.checked === true) {
    checks.push({
      field: "promotedImportWritesRequired",
      ok: (
        promotedImport.ok === true
        && workflowOptions.confirmImport === true
        && (workflowOptions.untilStage || DEFAULT_UNTIL_STAGE) === "import"
        && finalStage === "import"
      ),
      expected: "confirmed promoted import workflow",
      actual: {
        targetStage: workflowOptions.untilStage || DEFAULT_UNTIL_STAGE,
        confirmImport: workflowOptions.confirmImport === true,
        finalStage
      }
    });
  }
  return checks;
}

function summarizeWorkflow(workflow) {
  const responseEntries = Array.isArray(workflow.responseEntries) ? workflow.responseEntries : [];
  const finalEnvelope = workflow.finalWorkspaceResponseEnvelope || {};
  const finalSummary = firstObject(
    finalEnvelope.referenceOutputSummary,
    finalEnvelope.referencePromotionSummary,
    finalEnvelope.referenceAuditSummary,
    finalEnvelope.referencePlanSummary,
    finalEnvelope.referenceSourceSummary,
    latestResponseSummary(responseEntries, "referenceOutputSummary"),
    latestResponseSummary(responseEntries, "referencePromotionSummary"),
    latestResponseSummary(responseEntries, "referenceAuditSummary"),
    latestResponseSummary(responseEntries, "referencePlanSummary"),
    latestResponseSummary(responseEntries, "referenceSourceSummary")
  );
  const auditSummary = firstObject(finalEnvelope.referenceAuditSummary, finalSummary.referenceAuditSummary);
  return {
    id: safeWorkflowText(workflow.id),
    ok: workflow.ok === true,
    runStatus: safeWorkflowRunStatus(workflow.runStatus),
    stopReason: safeWorkflowText(workflow.stopReason),
    startStage: safeWorkflowStage(workflow.startStage),
    targetStage: safeWorkflowStage(workflow.targetStage),
    finalStage: safeWorkflowStage(workflow.finalStage),
    completedStages: Array.isArray(workflow.completedStages) ? workflow.completedStages.map(safeWorkflowStage).filter(Boolean) : [],
    responseCount: numberOrNull(workflow.responseCount),
    finalResponseStatus: safeWorkflowText(workflow.finalResponseStatus),
    finalSafeNextAction: safeWorkflowText(workflow.finalSafeNextAction),
    blockedStage: safeWorkflowStage(workflow.blockedStage),
    blockedReason: safeWorkflowText(workflow.blockedReason),
    blockedSafeNextAction: safeWorkflowText(workflow.blockedSafeNextAction),
    finalFingerprintSummary: safeFingerprintSummary(workflow.finalFingerprintSummary),
    source: {
      sourceFormat: safeWorkflowSourceFormat(finalSummary.sourceFormat),
      sourceRequestedFormat: safeWorkflowSourceFormat(finalSummary.sourceRequestedFormat),
      sourceRequestedFormatFamily: safeWorkflowSourceFamily(finalSummary.sourceRequestedFormatFamily),
      sourceRequestedFormatAliases: Array.isArray(finalSummary.sourceRequestedFormatAliases) ? finalSummary.sourceRequestedFormatAliases.map(safeWorkflowSourceFormat).filter(Boolean) : [],
      translationMode: safeWorkflowTranslationMode(finalSummary.translationMode || finalSummary.importerTranslationMode),
      sourceAdapter: safeAdapterKeyToken(finalSummary.sourceAdapter),
      adapterConfigProvided: finalSummary.adapterConfigProvided === true,
      adapterPreflightOk: finalSummary.adapterPreflightOk ?? null,
      adapterRequestEvidenceFingerprint: isSha256Fingerprint(finalSummary.adapterRequestEvidenceFingerprint) ? finalSummary.adapterRequestEvidenceFingerprint : "",
      adapterConfigStatFingerprint: isSourceStatFingerprint(finalSummary.adapterConfigStatFingerprint) ? finalSummary.adapterConfigStatFingerprint : "",
      adapterRegistryFingerprint: isSha256Fingerprint(finalSummary.adapterRegistryFingerprint) ? finalSummary.adapterRegistryFingerprint : "",
      adapterRegistryAdapterFingerprint: isSha256Fingerprint(finalSummary.adapterRegistryAdapterFingerprint) ? finalSummary.adapterRegistryAdapterFingerprint : "",
      adapterPreflightFingerprint: isSha256Fingerprint(finalSummary.adapterPreflightFingerprint) ? finalSummary.adapterPreflightFingerprint : ""
    },
    referenceCounts: {
      objectCount: numberOrNull(finalSummary.referenceObjectCount),
      layerCount: numberOrNull(finalSummary.referenceLayerCount),
      chunkCount: numberOrNull(finalSummary.referenceChunkCount),
      lineSegmentCount: numberOrNull(finalSummary.referenceLineSegmentCount),
      meshFaceCount: numberOrNull(finalSummary.referenceMeshFaceCount),
      pointCloudPointCount: numberOrNull(finalSummary.referencePointCloudPointCount),
      chunkPointCount: numberOrNull(finalSummary.referenceChunkPointCount),
      diagnosticCount: numberOrNull(finalSummary.diagnosticCount)
    },
    audit: {
      readyCount: numberOrNull(auditSummary.referenceReadyCount),
      needsAttentionCount: numberOrNull(auditSummary.referenceNeedsAttentionCount),
      errorCount: numberOrNull(auditSummary.referenceAuditErrorCount),
      likelyFixArea: safeWorkflowText(auditSummary.referenceAuditDecision?.likelyFixArea),
      recommendedNextAction: safeWorkflowText(auditSummary.referenceAuditDecision?.recommendedNextAction)
    },
    rawResponsesIncluded: workflow.rawResponsesIncluded === true,
    runtimeBoundary: {
      browserRuntimeExecutesCli: workflow.runtimeBoundary?.browserRuntimeExecutesCli === true,
      workflowRunnerUsesWorkspaceHost: workflow.runtimeBoundary?.workflowRunnerUsesWorkspaceHost === true,
      workflowRunnerRunsShell: workflow.runtimeBoundary?.workflowRunnerRunsShell === true,
      browserRuntimeWritesProjectJson: workflow.runtimeBoundary?.browserRuntimeWritesProjectJson === true,
      browserRuntimeWritesReferenceFiles: workflow.runtimeBoundary?.browserRuntimeWritesReferenceFiles === true
    }
  };
}

function latestResponseSummary(responseEntries = [], field = "") {
  for (let index = responseEntries.length - 1; index >= 0; index -= 1) {
    const summary = responseEntries[index]?.[field];
    if (summary && typeof summary === "object" && !Array.isArray(summary)) return summary;
  }
  return null;
}

function firstObject(...values) {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return {};
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function safeFingerprintSummary(summary = {}) {
  const allowed = {};
  for (const [key, value] of Object.entries(summary || {})) {
    if (/^[A-Za-z][A-Za-z0-9]*Fingerprint$/.test(key) && isSha256Fingerprint(value)) {
      allowed[key] = value;
    }
  }
  return allowed;
}

function processErrorSummary(error) {
  if (!error) return "";
  if (error.code === "ETIMEDOUT") return "process-timeout";
  return safeWorkflowText(error.message) || "process-error";
}

function evaluateExpected(expected, workflow, evidence = {}, runtimeOptions = {}) {
  const checks = [];
  addMinimumCheck(checks, "sourceFileSizeBytesCliMinimum", evidence.sourceFile?.sizeBytes, runtimeOptions.minSourceFileSizeBytes);
  if (expected === undefined || expected === null) return checks;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    checks.push({ field: "expected", ok: false, message: "expected must be an object" });
    return checks;
  }
  const summary = summarizeWorkflow(workflow);
  addEqualsCheck(checks, "runStatus", summary.runStatus, expected.runStatus);
  addEqualsCheck(checks, "finalStage", summary.finalStage, expected.finalStage);
  addEqualsCheck(checks, "sourceFormat", summary.source.sourceFormat, expected.sourceFormat);
  addEqualsCheck(checks, "sourceRequestedFormat", summary.source.sourceRequestedFormat, expected.sourceRequestedFormat);
  addEqualsCheck(checks, "sourceRequestedFormatFamily", summary.source.sourceRequestedFormatFamily, expected.sourceRequestedFormatFamily);
  addEqualsCheck(checks, "translationMode", summary.source.translationMode, expected.translationMode);
  addEqualsCheck(checks, "sourceAdapter", summary.source.sourceAdapter, expected.sourceAdapter);
  addMinimumCheck(checks, "sourceFileSizeBytes", evidence.sourceFile?.sizeBytes, expected.minSourceFileSizeBytes);
  addMaximumCheck(checks, "durationMs", evidence.durationMs, expected.maxDurationMs);
  addMinimumCheck(checks, "referenceObjectCount", summary.referenceCounts.objectCount, expected.minReferenceObjectCount);
  addMinimumCheck(checks, "referenceLayerCount", summary.referenceCounts.layerCount, expected.minReferenceLayerCount);
  addMinimumCheck(checks, "referenceChunkCount", summary.referenceCounts.chunkCount, expected.minReferenceChunkCount);
  addMinimumCheck(checks, "referenceLineSegmentCount", summary.referenceCounts.lineSegmentCount, expected.minReferenceLineSegmentCount);
  addMinimumCheck(checks, "referenceMeshFaceCount", summary.referenceCounts.meshFaceCount, expected.minReferenceMeshFaceCount);
  addMinimumCheck(checks, "referencePointCloudPointCount", summary.referenceCounts.pointCloudPointCount, expected.minReferencePointCloudPointCount);
  return checks;
}

function addEqualsCheck(checks, field, actual, expected) {
  if (expected === undefined) return;
  checks.push({
    field,
    ok: actual === expected,
    expected,
    actual,
    message: actual === expected ? "" : `${field} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
  });
}

function addMinimumCheck(checks, field, actual, expected) {
  if (expected === undefined) return;
  const expectedNumber = isNonnegativeSafeInteger(expected) ? expected : null;
  const ok = isNonnegativeSafeInteger(actual) && isNonnegativeSafeInteger(expectedNumber) && actual >= expectedNumber;
  checks.push({
    field,
    ok,
    expectedMinimum: expectedNumber,
    actual,
    message: ok ? "" : `${field} expected at least ${expectedNumber} but got ${JSON.stringify(actual)}`
  });
}

function addMaximumCheck(checks, field, actual, expected) {
  if (expected === undefined) return;
  const expectedNumber = isNonnegativeSafeInteger(expected) ? expected : null;
  const ok = isNonnegativeSafeInteger(actual) && isNonnegativeSafeInteger(expectedNumber) && actual <= expectedNumber;
  checks.push({
    field,
    ok,
    expectedMaximum: expectedNumber,
    actual,
    message: ok ? "" : `${field} expected at most ${expectedNumber} but got ${JSON.stringify(actual)}`
  });
}

function caseErrors({ result, parsed, workflow, workflowSummary, processOk, workflowOk, assertions }) {
  const errors = [];
  if (!processOk) {
    errors.push(`workflow process failed with exitCode=${Number.isInteger(result.status) ? result.status : "null"} signal=${safeProcessSignal(result.signal) || "none"}`);
  }
  if (parsed.error) {
    errors.push("workflow stdout was not JSON");
  }
  if (workflow && !workflowOk) {
    errors.push(`workflow did not complete: ok=${workflow.ok === true} runStatus=${workflowSummary?.runStatus || "unknown"} stopReason=${workflowSummary?.stopReason || "unknown"}`);
  }
  for (const assertion of assertions || []) {
    if (assertion.ok !== true && assertion.message) errors.push(assertion.message);
  }
  return errors;
}

function stderrSummary(value = "", limit = 2000) {
  const text = String(value || "");
  if (!text) return "";
  const boundedLength = Math.min(text.length, limit);
  return `stderr-present-bytes:${boundedLength}${text.length > limit ? "+" : ""}`;
}

function writeReport(outputPath, report) {
  if (!outputPath) return;
  const absoluteOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${JSON.stringify(report, null, 2)}\n`);
}

function pathFreeFailureMessage(error) {
  const text = String(error?.message || "");
  if (
    !text
    || /[\\/]/.test(text)
    || text.includes("..")
    || /[\u0000-\u001f]/.test(text)
  ) {
    return "reference import corpus check failed";
  }
  return text;
}

function corpusSetupFailureReport(runtimeOptions = {}, failures = []) {
  const coverage = corpusCoverage([], runtimeOptions.requiredFormatFamilies || []);
  const externalAdapterCoverage = corpusExternalAdapterCoverage([], runtimeOptions.requiredExternalAdapterFamilies || []);
  const errors = failures.length > 0 ? failures : ["reference import corpus check failed"];
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    configPath: pathFreeInputFileName(runtimeOptions.configPath),
    workflowRunnerPath: WORKFLOW_RUNNER_REPORT_PATH,
    caseCount: 0,
    skippedCaseCount: 0,
    passedCaseCount: 0,
    failedCaseCount: 0,
    failedCaseIds: [],
    skippedCaseIds: [],
    defaults: {
      targetStage: DEFAULT_UNTIL_STAGE,
      caseTimeoutMs: runtimeOptions.caseTimeoutMs || 0,
      minSourceFileSizeBytes: runtimeOptions.minSourceFileSizeBytes || 0,
      requiredFormatFamilies: coverage.requiredFormatFamilies,
      requiredExternalAdapterFamilies: runtimeOptions.requiredExternalAdapterFamilies || [],
      failFast: runtimeOptions.failFast === true,
      allowImportWrites: runtimeOptions.allowImportWrites === true,
      requirePromotedImportWrites: runtimeOptions.requirePromotedImportWrites === true
    },
    selection: {
      includeTags: Array.isArray(runtimeOptions.includeTags) ? [...runtimeOptions.includeTags] : [],
      excludeTags: Array.isArray(runtimeOptions.excludeTags) ? [...runtimeOptions.excludeTags] : [],
      selectedCaseCount: 0,
      runCaseCount: 0,
      preflightCaseCount: 0,
      skippedCaseCount: 0,
      skippedCaseIds: []
    },
    coverage,
    performance: corpusPerformance([]),
    acceptance: {
      accepted: false,
      recommendedNextAction: "inspect-corpus-errors",
      reason: "corpus-setup-error",
      caseCount: 0,
      allCasesPassed: false,
      requiredFormatCoverageOk: coverage.coverageOk === true,
      externalAdapterCoverageOk: externalAdapterCoverage.externalAdapterCoverageOk === true,
      requiredExternalAdapterFamilies: externalAdapterCoverage.requiredExternalAdapterFamilies,
      presentExternalAdapterFamilies: externalAdapterCoverage.presentExternalAdapterFamilies,
      externalAdapterMissingFamilies: externalAdapterCoverage.externalAdapterMissingFamilies,
      sourceEvidenceReady: false,
      performanceEvidenceReady: false,
      failedCaseIds: [],
      missingFormatFamilies: coverage.missingFormatFamilies,
      sourceEvidenceMissingCaseIds: [],
      performanceEvidenceMissingCaseIds: []
    },
    configPreflight: {
      ok: false,
      recommendedNextAction: "inspect-corpus-errors",
      reason: "corpus-setup-error",
      caseCount: 0,
      coverageOk: coverage.coverageOk === true,
      missingFormatFamilies: coverage.missingFormatFamilies,
      externalAdapterCoverageOk: externalAdapterCoverage.externalAdapterCoverageOk === true,
      requiredExternalAdapterFamilies: externalAdapterCoverage.requiredExternalAdapterFamilies,
      presentExternalAdapterFamilies: externalAdapterCoverage.presentExternalAdapterFamilies,
      externalAdapterMissingFamilies: externalAdapterCoverage.externalAdapterMissingFamilies,
      sourceFilesOk: false,
      adapterConfigsOk: false,
      adapterConfigFilesOk: false,
      adapterConfigJsonOk: false,
      adapterConfigSupportOk: false,
      writePolicyOk: false,
      sourceSizeExpectationsOk: false,
      promotedImportExpectationsOk: false,
      sourceFileMissingCaseIds: [],
      adapterConfigMissingCaseIds: [],
      adapterConfigInvalidCaseIds: [],
      adapterConfigUnsupportedCaseIds: [],
      writePolicyErrorCaseIds: [],
      sourceSizeExpectationFailedCaseIds: [],
      promotedImportRequirementFailedCaseIds: []
    },
    errors,
    runtimeBoundary: {
      invokesWorkflowRunnerOnly: false,
      workflowRunnerUsesWorkspaceHost: false,
      launchesWorkflowRunner: false,
      launchesExternalAdaptersDirectly: false,
      shell: false,
      defaultTargetStage: DEFAULT_UNTIL_STAGE,
      importWritesRequireAllowFlag: true
    },
    cases: []
  };
}

function corpusPerformance(caseReports = []) {
  const caseDurations = caseReports.map((entry) => ({
    id: entry.id,
    durationMs: isNonnegativeSafeInteger(entry.durationMs) ? entry.durationMs : null,
    sourceFileSizeBytes: isNonnegativeSafeInteger(entry.sourceFile?.sizeBytes) ? entry.sourceFile.sizeBytes : null,
    sourceStatFingerprint: isSourceStatFingerprint(entry.sourceFile?.statFingerprint) ? entry.sourceFile.statFingerprint : ""
  }));
  const numericDurations = caseDurations.filter((entry) => isNonnegativeSafeInteger(entry.durationMs));
  const totalDurationMs = numericDurations.reduce((sum, entry) => sum + entry.durationMs, 0);
  const maxEntry = numericDurations.reduce((current, entry) => (
    !current || entry.durationMs > current.durationMs ? entry : current
  ), null);
  return {
    totalDurationMs,
    maxDurationMs: maxEntry?.durationMs ?? null,
    maxDurationCaseId: maxEntry?.id || "",
    caseDurations
  };
}

function corpusAcceptance({ caseReports = [], failedCases = [], coverage = null, externalAdapterCoverage = null, errors = [] } = {}) {
  const promotedImportRequirementFailed = errors.some((entry) => String(entry || "").includes("promoted import writes required"));
  const externalAdapterRequirementFailed = errors.some((entry) => String(entry || "").includes("missing required external-adapter source families"));
  const sourceEvidenceMissingCaseIds = caseReports
    .filter((entry) => (
      entry.sourceFile?.isFile !== true
      || !isNonnegativeSafeInteger(entry.sourceFile?.sizeBytes)
      || !isSourceStatFingerprint(entry.sourceFile?.statFingerprint)
    ))
    .map((entry) => entry.id);
  const performanceEvidenceMissingCaseIds = caseReports
    .filter((entry) => !isNonnegativeSafeInteger(entry.durationMs))
    .map((entry) => entry.id);
  const requiredFormatCoverageOk = !coverage || coverage.coverageOk === true;
  const externalAdapterCoverageOk = !externalAdapterCoverage || externalAdapterCoverage.externalAdapterCoverageOk === true;
  const allCasesPassed = caseReports.length > 0 && failedCases.length === 0;
  const sourceEvidenceReady = caseReports.length > 0 && sourceEvidenceMissingCaseIds.length === 0;
  const performanceEvidenceReady = caseReports.length > 0 && performanceEvidenceMissingCaseIds.length === 0;
  const accepted = (
    errors.length === 0
    && requiredFormatCoverageOk
    && externalAdapterCoverageOk
    && allCasesPassed
    && sourceEvidenceReady
    && performanceEvidenceReady
  );
  let recommendedNextAction = "accept-reference-import-corpus";
  let reason = "corpus-accepted";
  if (coverage?.coverageOk === false) {
    recommendedNextAction = "add-missing-format-cases";
    reason = "missing-required-format-families";
  } else if (promotedImportRequirementFailed) {
    recommendedNextAction = "fix-corpus-write-gates";
    reason = "promoted-import-write-required";
  } else if (externalAdapterRequirementFailed) {
    recommendedNextAction = "add-external-adapter-cases";
    reason = "missing-required-external-adapter-families";
  } else if (caseReports.length < 1) {
    recommendedNextAction = "add-corpus-cases";
    reason = "no-enabled-cases-ran";
  } else if (failedCases.length > 0) {
    recommendedNextAction = "inspect-failed-cases";
    reason = "case-failures";
  } else if (sourceEvidenceMissingCaseIds.length > 0) {
    recommendedNextAction = "fix-source-file-evidence";
    reason = "missing-source-file-evidence";
  } else if (performanceEvidenceMissingCaseIds.length > 0) {
    recommendedNextAction = "inspect-corpus-harness";
    reason = "missing-performance-evidence";
  } else if (errors.length > 0) {
    recommendedNextAction = "inspect-corpus-errors";
    reason = "corpus-errors";
  }
  return {
    accepted,
    recommendedNextAction,
    reason,
    caseCount: caseReports.length,
    allCasesPassed,
    requiredFormatCoverageOk,
    externalAdapterCoverageOk,
    requiredExternalAdapterFamilies: externalAdapterCoverage?.requiredExternalAdapterFamilies || [],
    presentExternalAdapterFamilies: externalAdapterCoverage?.presentExternalAdapterFamilies || [],
    externalAdapterMissingFamilies: externalAdapterCoverage?.externalAdapterMissingFamilies || [],
    sourceEvidenceReady,
    performanceEvidenceReady,
    failedCaseIds: failedCases.map((entry) => entry.id),
    missingFormatFamilies: coverage?.missingFormatFamilies || [],
    sourceEvidenceMissingCaseIds,
    performanceEvidenceMissingCaseIds
  };
}

function selectCases(loaded, runtimeOptions) {
  const skippedCases = [];
  const selectedCases = [];
  const mergedCaseIds = new Set();
  for (let index = 0; index < loaded.cases.length; index += 1) {
    const caseConfig = mergeCase(loaded.defaults, loaded.cases[index], index, loaded.configDir);
    if (mergedCaseIds.has(caseConfig.id)) {
      throw new Error("case ids must be unique");
    }
    mergedCaseIds.add(caseConfig.id);
    if (caseConfig.enabled === false) {
      skippedCases.push(caseConfig.id);
      continue;
    }
    if (!caseMatchesSelection(caseConfig, runtimeOptions)) {
      skippedCases.push(caseConfig.id);
      continue;
    }
    if (runtimeOptions.maxCases > 0 && selectedCases.length >= runtimeOptions.maxCases) {
      skippedCases.push(caseConfig.id);
      continue;
    }
    selectedCases.push(caseConfig);
  }
  return { selectedCases, skippedCases };
}

function corpusConfigPreflight(caseReports = [], coverage = null, errors = [], externalAdapterCoverage = null) {
  const externalAdapterRequirementFailed = errors.some((entry) => String(entry || "").includes("missing required external-adapter source families"));
  const sourceFileMissingCaseIds = caseReports
    .filter((entry) => entry.sourceFile?.required === true && (
      entry.sourceFile?.exists !== true
      || entry.sourceFile?.isFile !== true
      || !isSourceStatFingerprint(entry.sourceFile?.statFingerprint)
    ))
    .map((entry) => entry.id);
  const adapterConfigMissingCaseIds = caseReports
    .filter((entry) => entry.adapterConfigFile?.required === true && (
      entry.adapterConfigFile?.provided !== true
      || entry.adapterConfigFile?.exists !== true
      || entry.adapterConfigFile?.isFile !== true
      || !isSourceStatFingerprint(entry.adapterConfigFile?.statFingerprint)
    ))
    .map((entry) => entry.id);
  const adapterConfigInvalidCaseIds = caseReports
    .filter((entry) => entry.adapterConfigFile?.required === true && (
      entry.adapterConfigFile?.exists === true
      && entry.adapterConfigFile?.isFile === true
      && (entry.adapterConfigFile?.jsonReadable !== true || entry.adapterConfigFile?.schemaOk !== true)
    ))
    .map((entry) => entry.id);
  const adapterConfigUnsupportedCaseIds = caseReports
    .filter((entry) => entry.adapterConfigFile?.required === true && (
      entry.adapterConfigFile?.schemaOk === true
      && entry.adapterConfigSupport?.ok !== true
    ))
    .map((entry) => entry.id);
  const writePolicyErrorCaseIds = caseReports
    .filter((entry) => entry.writePolicy?.ok !== true)
    .map((entry) => entry.id);
  const sourceSizeExpectationFailedCaseIds = caseReports
    .filter((entry) => entry.sourceSizeExpectation?.ok !== true)
    .map((entry) => entry.id);
  const promotedImportRequirementFailedCaseIds = caseReports
    .filter((entry) => entry.promotedImportExpectation?.ok !== true)
    .map((entry) => entry.id);
  const coverageOk = !coverage || coverage.coverageOk === true;
  const externalAdapterCoverageOk = !externalAdapterCoverage || externalAdapterCoverage.externalAdapterCoverageOk === true;
  const sourceFilesOk = sourceFileMissingCaseIds.length === 0;
  const adapterConfigFilesOk = adapterConfigMissingCaseIds.length === 0;
  const adapterConfigJsonOk = adapterConfigInvalidCaseIds.length === 0;
  const adapterConfigSupportOk = adapterConfigUnsupportedCaseIds.length === 0;
  const adapterConfigsOk = adapterConfigFilesOk && adapterConfigJsonOk && adapterConfigSupportOk;
  const writePolicyOk = writePolicyErrorCaseIds.length === 0;
  const sourceSizeExpectationsOk = sourceSizeExpectationFailedCaseIds.length === 0;
  const promotedImportExpectationsOk = promotedImportRequirementFailedCaseIds.length === 0;
  const ok = (
    errors.length === 0
    && coverageOk
    && externalAdapterCoverageOk
    && caseReports.length > 0
    && sourceFilesOk
    && adapterConfigsOk
    && writePolicyOk
    && sourceSizeExpectationsOk
    && promotedImportExpectationsOk
  );
  let recommendedNextAction = "run-reference-import-corpus";
  let reason = "config-preflight-ok";
  if (coverage?.coverageOk === false) {
    recommendedNextAction = "add-missing-format-cases";
    reason = "missing-required-format-families";
  } else if (externalAdapterRequirementFailed) {
    recommendedNextAction = "add-external-adapter-cases";
    reason = "missing-required-external-adapter-families";
  } else if (caseReports.length < 1) {
    recommendedNextAction = "add-corpus-cases";
    reason = "no-enabled-cases-selected";
  } else if (!sourceFilesOk) {
    recommendedNextAction = "fix-corpus-source-files";
    reason = "missing-source-files";
  } else if (!adapterConfigFilesOk) {
    recommendedNextAction = "fix-corpus-adapter-config";
    reason = "missing-adapter-config";
  } else if (!adapterConfigJsonOk) {
    recommendedNextAction = "fix-corpus-adapter-config";
    reason = "invalid-adapter-config";
  } else if (!adapterConfigSupportOk) {
    recommendedNextAction = "fix-corpus-adapter-selection";
    reason = "unsupported-adapter-format";
  } else if (!writePolicyOk) {
    recommendedNextAction = "fix-corpus-write-gates";
    reason = "import-write-gate-blocked";
  } else if (!sourceSizeExpectationsOk) {
    recommendedNextAction = "fix-source-file-evidence";
    reason = "source-size-expectation-failed";
  } else if (!promotedImportExpectationsOk) {
    recommendedNextAction = "fix-corpus-write-gates";
    reason = "promoted-import-write-required";
  } else if (errors.length > 0) {
    recommendedNextAction = "inspect-corpus-errors";
    reason = "corpus-errors";
  }
  return {
    ok,
    recommendedNextAction,
    reason,
    caseCount: caseReports.length,
    coverageOk,
    missingFormatFamilies: coverage?.missingFormatFamilies || [],
    externalAdapterCoverageOk,
    requiredExternalAdapterFamilies: externalAdapterCoverage?.requiredExternalAdapterFamilies || [],
    presentExternalAdapterFamilies: externalAdapterCoverage?.presentExternalAdapterFamilies || [],
    externalAdapterMissingFamilies: externalAdapterCoverage?.externalAdapterMissingFamilies || [],
    sourceFilesOk,
    adapterConfigsOk,
    adapterConfigFilesOk,
    adapterConfigJsonOk,
    adapterConfigSupportOk,
    writePolicyOk,
    sourceSizeExpectationsOk,
    promotedImportExpectationsOk,
    sourceFileMissingCaseIds,
    adapterConfigMissingCaseIds,
    adapterConfigInvalidCaseIds,
    adapterConfigUnsupportedCaseIds,
    writePolicyErrorCaseIds,
    sourceSizeExpectationFailedCaseIds,
    promotedImportRequirementFailedCaseIds
  };
}

function configPreflightAcceptance(preflight) {
  return {
    accepted: false,
    recommendedNextAction: preflight.ok ? "run-reference-import-corpus" : preflight.recommendedNextAction,
    reason: preflight.ok ? "config-preflight-only" : preflight.reason,
    caseCount: 0,
    allCasesPassed: false,
    requiredFormatCoverageOk: preflight.coverageOk === true,
    externalAdapterCoverageOk: preflight.externalAdapterCoverageOk === true,
    requiredExternalAdapterFamilies: preflight.requiredExternalAdapterFamilies || [],
    presentExternalAdapterFamilies: preflight.presentExternalAdapterFamilies || [],
    externalAdapterMissingFamilies: preflight.externalAdapterMissingFamilies || [],
    sourceEvidenceReady: preflight.sourceFilesOk === true,
    performanceEvidenceReady: false,
    failedCaseIds: [],
    missingFormatFamilies: preflight.missingFormatFamilies || [],
    sourceEvidenceMissingCaseIds: preflight.sourceFileMissingCaseIds || [],
    performanceEvidenceMissingCaseIds: []
  };
}

function buildConfigPreflightReport({ loaded, runtimeOptions, selectedCases, skippedCases, coverage, externalAdapterCoverage = null, errors = [] }) {
  const caseReports = selectedCases.map((caseConfig) => configPreflightCaseReport(caseConfig, runtimeOptions));
  const failedCases = caseReports.filter((entry) => entry.ok !== true);
  const preflight = corpusConfigPreflight(caseReports, coverage, errors, externalAdapterCoverage);
  const acceptance = configPreflightAcceptance(preflight);
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: preflight.ok === true,
    configPath: path.basename(loaded.absoluteConfigPath),
    workflowRunnerPath: WORKFLOW_RUNNER_REPORT_PATH,
    caseCount: caseReports.length,
    skippedCaseCount: skippedCases.length,
    passedCaseCount: caseReports.length - failedCases.length,
    failedCaseCount: failedCases.length,
    failedCaseIds: failedCases.map((entry) => entry.id),
    skippedCaseIds: skippedCases,
    defaults: {
      targetStage: loaded.defaults.untilStage || DEFAULT_UNTIL_STAGE,
      caseTimeoutMs: runtimeOptions.caseTimeoutMs || loaded.defaults.caseTimeoutMs || 0,
      minSourceFileSizeBytes: runtimeOptions.minSourceFileSizeBytes || 0,
      requiredFormatFamilies: coverage?.requiredFormatFamilies || [],
      requiredExternalAdapterFamilies: runtimeOptions.requiredExternalAdapterFamilies || loaded.requiredExternalAdapterFamilies || [],
      failFast: runtimeOptions.failFast === true,
      allowImportWrites: runtimeOptions.allowImportWrites === true,
      requirePromotedImportWrites: runtimeOptions.requirePromotedImportWrites === true
    },
    selection: {
      includeTags: [...runtimeOptions.includeTags],
      excludeTags: [...runtimeOptions.excludeTags],
      selectedCaseCount: selectedCases.length,
      runCaseCount: 0,
      preflightCaseCount: caseReports.length,
      skippedCaseCount: skippedCases.length,
      skippedCaseIds: [...skippedCases]
    },
    coverage: coverage || corpusCoverage([], []),
    performance: corpusPerformance([]),
    acceptance,
    configPreflight: preflight,
    errors,
    runtimeBoundary: {
      invokesWorkflowRunnerOnly: false,
      workflowRunnerUsesWorkspaceHost: false,
      launchesWorkflowRunner: false,
      launchesExternalAdaptersDirectly: false,
      shell: false,
      defaultTargetStage: DEFAULT_UNTIL_STAGE,
      importWritesRequireAllowFlag: true
    },
    cases: caseReports
  };
}

function buildReport({ loaded, runtimeOptions, caseReports, skippedCases, selectedCaseCount = caseReports.length, coverage, externalAdapterCoverage = null, errors = [] }) {
  const failedCases = caseReports.filter((entry) => entry.ok !== true);
  const coverageOk = !coverage || coverage.coverageOk === true;
  const externalAdapterCoverageOk = !externalAdapterCoverage || externalAdapterCoverage.externalAdapterCoverageOk === true;
  const acceptance = corpusAcceptance({ caseReports, failedCases, coverage, externalAdapterCoverage, errors });
  return {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: failedCases.length === 0 && coverageOk && externalAdapterCoverageOk && errors.length === 0 && acceptance.accepted === true,
    configPath: path.basename(loaded.absoluteConfigPath),
    workflowRunnerPath: WORKFLOW_RUNNER_REPORT_PATH,
    caseCount: caseReports.length,
    skippedCaseCount: skippedCases.length,
    passedCaseCount: caseReports.length - failedCases.length,
    failedCaseCount: failedCases.length,
    failedCaseIds: failedCases.map((entry) => entry.id),
    skippedCaseIds: skippedCases,
    defaults: {
      targetStage: loaded.defaults.untilStage || DEFAULT_UNTIL_STAGE,
      caseTimeoutMs: runtimeOptions.caseTimeoutMs || loaded.defaults.caseTimeoutMs || 0,
      minSourceFileSizeBytes: runtimeOptions.minSourceFileSizeBytes || 0,
      requiredFormatFamilies: coverage?.requiredFormatFamilies || [],
      requiredExternalAdapterFamilies: runtimeOptions.requiredExternalAdapterFamilies || loaded.requiredExternalAdapterFamilies || [],
      failFast: runtimeOptions.failFast === true,
      allowImportWrites: runtimeOptions.allowImportWrites === true,
      requirePromotedImportWrites: runtimeOptions.requirePromotedImportWrites === true
    },
    selection: {
      includeTags: [...runtimeOptions.includeTags],
      excludeTags: [...runtimeOptions.excludeTags],
      selectedCaseCount,
      runCaseCount: caseReports.length,
      skippedCaseCount: skippedCases.length,
      skippedCaseIds: [...skippedCases]
    },
    coverage: coverage || corpusCoverage([], []),
    performance: corpusPerformance(caseReports),
    acceptance,
    errors,
    runtimeBoundary: {
      invokesWorkflowRunnerOnly: true,
      workflowRunnerUsesWorkspaceHost: true,
      shell: false,
      browserRuntimeExecutesCli: false,
      defaultTargetStage: DEFAULT_UNTIL_STAGE,
      importWritesRequireAllowFlag: true
    },
    cases: caseReports
  };
}

let activeRuntimeOptions = {};

function main() {
  const runtimeOptions = parseArgs(process.argv.slice(2));
  activeRuntimeOptions = runtimeOptions;
  if (runtimeOptions.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (runtimeOptions.listContract) {
    process.stdout.write(`${JSON.stringify(corpusCheckContract(), null, 2)}\n`);
    return 0;
  }
  if (runtimeOptions.printExampleConfig) {
    process.stdout.write(`${JSON.stringify(exampleCorpusConfig(), null, 2)}\n`);
    return 0;
  }
  if (runtimeOptions.printFinalExampleConfig) {
    process.stdout.write(`${JSON.stringify(finalExampleCorpusConfig(), null, 2)}\n`);
    return 0;
  }
  if (!runtimeOptions.configPath) {
    throw new Error("--config is required");
  }
  if (!fs.existsSync(WORKFLOW_RUNNER)) {
    throw new Error(`workflow runner not found: ${WORKFLOW_RUNNER}`);
  }
  const loaded = loadConfig(runtimeOptions.configPath);
  const requiredFormatFamilies = runtimeOptions.requiredFormatFamilies.length > 0
    ? runtimeOptions.requiredFormatFamilies
    : loaded.requiredFormatFamilies;
  const requiredExternalAdapterFamilies = runtimeOptions.requiredExternalAdapterFamilies.length > 0
    ? runtimeOptions.requiredExternalAdapterFamilies
    : loaded.requiredExternalAdapterFamilies;
  const { selectedCases, skippedCases } = selectCases(loaded, runtimeOptions);
  const coverage = corpusCoverage(selectedCases, requiredFormatFamilies);
  const coverageErrors = coverage.coverageOk
    ? []
    : [`missing required source format families: ${coverage.missingFormatFamilies.join(", ")}`];
  const externalAdapterCoverage = corpusExternalAdapterCoverage(selectedCases, requiredExternalAdapterFamilies);
  const externalAdapterCoverageErrors = externalAdapterCoverage.externalAdapterCoverageOk
    ? []
    : [`missing required external-adapter source families: ${externalAdapterCoverage.externalAdapterMissingFamilies.join(", ")}`];
  const preRunErrors = [
    ...coverageErrors,
    ...externalAdapterCoverageErrors,
    ...promotedImportRequirementErrors(selectedCases, runtimeOptions)
  ];
  if (runtimeOptions.checkConfigOnly) {
    const report = buildConfigPreflightReport({
      loaded,
      runtimeOptions: { ...runtimeOptions, requiredExternalAdapterFamilies },
      selectedCases,
      skippedCases,
      coverage,
      externalAdapterCoverage,
      errors: [...coverageErrors, ...externalAdapterCoverageErrors]
    });
    writeReport(runtimeOptions.outputPath, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  const caseReports = [];
  for (const caseConfig of preRunErrors.length > 0 ? [] : selectedCases) {
    const report = runCase(caseConfig, runtimeOptions);
    caseReports.push(report);
    if (runtimeOptions.failFast && report.ok !== true) break;
  }
  const report = buildReport({
    loaded,
    runtimeOptions: { ...runtimeOptions, requiredExternalAdapterFamilies },
    caseReports,
    skippedCases,
    selectedCaseCount: selectedCases.length,
    coverage,
    externalAdapterCoverage,
    errors: preRunErrors
  });
  writeReport(runtimeOptions.outputPath, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = corpusSetupFailureReport(activeRuntimeOptions, [pathFreeFailureMessage(error)]);
  try {
    writeReport(activeRuntimeOptions.outputPath, report);
  } catch {
    // Keep stdout as the stable path-free failure channel when optional output writes fail.
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
