#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REPORT_ID = "referenceImportArtifactFingerprintReport";
const REPORT_VERSION = "0.1.0";
const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9_. -]{0,127}$/;
const EXPECT_PROFILES = {
  "corpus-report-verification": [
    { label: "promoted-import-corpus-report", flag: "--expect-report-fingerprint" }
  ],
  "final-acceptance-input": [
    { label: "fingerprint-pinned-verifier-output", flag: "--expect-acceptance-report-fingerprint" }
  ],
  "completion-evidence-input": [
    { label: "final-acceptance-check", flag: "--expect-final-acceptance-check-fingerprint" }
  ],
  "final-proof-bundle-inputs": [
    { label: "final-acceptance-check", flag: "--expect-final-acceptance-check-fingerprint" },
    { label: "completion-evidence-sources-check", flag: "--expect-source-check-fingerprint" },
    { label: "completion-evidence-check", flag: "--expect-completion-evidence-check-fingerprint" }
  ],
  "goal-completion-input": [
    { label: "final-proof-bundle-check", flag: "--expect-final-proof-bundle-check-fingerprint" }
  ]
};
const OUTPUT_FIELDS = [
  "id",
  "version",
  "ok",
  "fingerprintReportPath",
  "expectProfile",
  "artifactCount",
  "gates",
  "summary",
  "artifacts",
  "expectArgs",
  "expectArgPairs",
  "expectArgsByFlag",
  "failures",
  "warnings"
];
const GATE_FIELDS = [
  "artifactSpecsShapeOk",
  "artifactLabelsUniqueOk",
  "artifactFilesReadableOk",
  "artifactBytesNonemptyOk",
  "expectProfileLabelsOk",
  "outputWritableOk"
];
const SUMMARY_FIELDS = [
  "artifactLabels",
  "unreadableArtifactLabels",
  "emptyArtifactLabels",
  "missingExpectLabels"
];
const ARTIFACT_FIELDS = [
  "label",
  "fingerprint",
  "sizeBytes"
];
const EXPECT_ARG_PAIR_FIELDS = [
  "label",
  "flag",
  "fingerprint"
];

function usage() {
  return [
    "Usage: node scripts/fingerprint_reference_import_artifacts.mjs --artifact <safe-label>=<path> [--artifact <safe-label>=<path> ...] [options]",
    "",
    "Computes path-free sha256 fingerprints for reference-import proof artifacts. Artifact files are read as opaque bytes and are never parsed.",
    "",
    "Options:",
    "  --artifact <safe-label>=<path>  Artifact to fingerprint. Repeat for multiple files. Only the safe label is emitted.",
    `  --expect-profile <profile>       Optional expect-args profile: ${Object.keys(EXPECT_PROFILES).join(", ")}.`,
    "  --output <path>                 Optional machine-readable JSON fingerprint report path.",
    "  --list-contract                 Print the artifact fingerprint report contract and exit.",
    "  --help                          Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    artifactSpecs: [],
    expectProfile: "",
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
    if (arg === "--artifact") {
      options.artifactSpecs.push(parseArtifactSpec(requiredValue(argv, index, arg)));
      index += 1;
      continue;
    }
    if (arg === "--expect-profile") {
      options.expectProfile = expectProfileValue(requiredValue(argv, index, arg), arg);
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

function parseArtifactSpec(spec = "") {
  const separator = String(spec).indexOf("=");
  if (separator <= 0) {
    return { label: "", filePath: "", valid: false };
  }
  const label = String(spec).slice(0, separator);
  const filePath = String(spec).slice(separator + 1);
  return { label, filePath, valid: SAFE_LABEL.test(label) && filePath.length > 0 };
}

function expectProfileValue(value, flag) {
  const text = String(value || "");
  if (!Object.hasOwn(EXPECT_PROFILES, text)) {
    throw new Error(`${flag} must be one of: ${Object.keys(EXPECT_PROFILES).join(", ")}`);
  }
  return text;
}

function contract() {
  return {
    id: "referenceImportArtifactFingerprintReportContract",
    version: REPORT_VERSION,
    reportId: REPORT_ID,
    inputBoundary: {
      readsExplicitArtifactFilesOnly: true,
      readsArtifactFilesAsOpaqueBytes: true,
      parsesArtifactJson: false,
      emitsArtifactPaths: false,
      emitsArtifactFileNames: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      shell: false
    },
    artifactSpecContract: {
      flag: "--artifact",
      shape: "<safe-label>=<path>",
      emittedArtifactIdentity: "safe label only",
      safeLabelPattern: SAFE_LABEL.source
    },
    expectProfiles: Object.fromEntries(Object.entries(EXPECT_PROFILES).map(([profile, entries]) => [
      profile,
      entries.map((entry) => ({ label: entry.label, flag: entry.flag }))
    ])),
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      summaryFields: SUMMARY_FIELDS,
      artifactFields: ARTIFACT_FIELDS,
      expectArgPairFields: EXPECT_ARG_PAIR_FIELDS,
      outputPathField: "fingerprintReportPath",
      pathPrivacyFields: ["fingerprintReportPath"],
      fingerprintFormat: "sha256:<64 lowercase hex>",
      expectArgsShape: ["--expect-*", "sha256:<64 lowercase hex>"],
      expectArgsByFlagShape: { "--expect-*": "sha256:<64 lowercase hex>" },
      expectArgsEmissionPolicy: "expectArgs, expectArgPairs, and expectArgsByFlag are emitted only when artifact specs, labels, file reads, nonempty bytes, expect-profile labels, and optional report output writes are valid"
    },
    cliFlags: ["--artifact", "--expect-profile", "--output", "--list-contract", "--help"]
  };
}

function pathFreeInputFileName(value = "") {
  const base = path.basename(String(value || "").replace(/\\/g, "/"));
  return SAFE_LABEL.test(base) ? base : "";
}

function fileFingerprint(raw) {
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
}

function readArtifact(spec) {
  if (!spec.valid) {
    return { label: spec.label, artifact: null, readable: false, nonempty: false };
  }
  try {
    const stat = fs.statSync(spec.filePath);
    if (!stat.isFile()) {
      return { label: spec.label, artifact: null, readable: false, nonempty: false };
    }
    const raw = fs.readFileSync(spec.filePath);
    return {
      label: spec.label,
      artifact: {
        label: spec.label,
        fingerprint: fileFingerprint(raw),
        sizeBytes: raw.length
      },
      readable: true,
      nonempty: raw.length > 0
    };
  } catch {
    return { label: spec.label, artifact: null, readable: false, nonempty: false };
  }
}

function buildReport(options = {}) {
  const labels = options.artifactSpecs.map((spec) => spec.label).filter((label) => SAFE_LABEL.test(label));
  const uniqueLabels = new Set(labels);
  const artifactSpecsShapeOk = options.artifactSpecs.length > 0 && options.artifactSpecs.every((spec) => spec.valid);
  const artifactLabelsUniqueOk = labels.length === options.artifactSpecs.length && uniqueLabels.size === labels.length;
  const reads = options.artifactSpecs.map(readArtifact);
  const unreadableArtifactLabels = reads.filter((entry) => !entry.readable && SAFE_LABEL.test(entry.label)).map((entry) => entry.label);
  const emptyArtifactLabels = reads.filter((entry) => entry.readable && !entry.nonempty && SAFE_LABEL.test(entry.label)).map((entry) => entry.label);
  const artifacts = reads
    .map((entry) => entry.artifact)
    .filter(Boolean);
  const artifactByLabel = new Map(artifacts.map((artifact) => [artifact.label, artifact]));
  const expectProfileEntries = options.expectProfile ? EXPECT_PROFILES[options.expectProfile] : [];
  const missingExpectLabels = expectProfileEntries
    .filter((entry) => !artifactByLabel.has(entry.label))
    .map((entry) => entry.label);
  const expectArgEligible = artifactSpecsShapeOk
    && artifactLabelsUniqueOk
    && unreadableArtifactLabels.length === 0
    && emptyArtifactLabels.length === 0
    && missingExpectLabels.length === 0;
  const expectArgPairs = expectArgEligible
    ? expectProfileEntries.map((entry) => ({
      label: entry.label,
      flag: entry.flag,
      fingerprint: artifactByLabel.get(entry.label).fingerprint
    }))
    : [];
  const expectArgs = expectArgPairs.flatMap((entry) => [entry.flag, entry.fingerprint]);
  const expectArgsByFlag = Object.fromEntries(expectArgPairs.map((entry) => [entry.flag, entry.fingerprint]));
  const gates = {
    artifactSpecsShapeOk,
    artifactLabelsUniqueOk,
    artifactFilesReadableOk: artifactSpecsShapeOk && unreadableArtifactLabels.length === 0,
    artifactBytesNonemptyOk: artifactSpecsShapeOk && emptyArtifactLabels.length === 0,
    expectProfileLabelsOk: missingExpectLabels.length === 0,
    outputWritableOk: true
  };
  return finalizeReport({
    id: REPORT_ID,
    version: REPORT_VERSION,
    ok: false,
    fingerprintReportPath: pathFreeInputFileName(options.outputPath),
    expectProfile: options.expectProfile || "",
    artifactCount: artifacts.length,
    gates,
    summary: {
      artifactLabels: labels,
      unreadableArtifactLabels,
      emptyArtifactLabels,
      missingExpectLabels
    },
    artifacts,
    expectArgs,
    expectArgPairs,
    expectArgsByFlag,
    failures: [],
    warnings: []
  });
}

function finalizeReport(report) {
  report.ok = GATE_FIELDS.every((field) => report.gates[field] === true);
  if (report.ok) {
    report.failures = [];
  } else {
    const gateFailures = Object.entries(report.gates)
      .filter(([, value]) => value !== true)
      .map(([field]) => `${field} failed`);
    report.failures = [...new Set([...(report.failures || []), ...gateFailures])];
  }
  return report;
}

function clearExpectArgs(report) {
  report.expectArgs = [];
  report.expectArgPairs = [];
  report.expectArgsByFlag = {};
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

let activeOptions = { artifactSpecs: [], expectProfile: "", outputPath: "" };

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
  const report = buildReport(options);
  if (!writeReport(options.outputPath, report)) {
    report.gates.outputWritableOk = false;
    clearExpectArgs(report);
    finalizeReport(report);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  const report = finalizeReport({
    id: REPORT_ID,
    version: REPORT_VERSION,
    ok: false,
    fingerprintReportPath: pathFreeInputFileName(activeOptions.outputPath),
    expectProfile: activeOptions.expectProfile || "",
    artifactCount: 0,
    gates: {
      artifactSpecsShapeOk: false,
      artifactLabelsUniqueOk: false,
      artifactFilesReadableOk: false,
      artifactBytesNonemptyOk: false,
      expectProfileLabelsOk: false,
      outputWritableOk: true
    },
    summary: {
      artifactLabels: [],
      unreadableArtifactLabels: [],
      emptyArtifactLabels: [],
      missingExpectLabels: []
    },
    artifacts: [],
    expectArgs: [],
    expectArgPairs: [],
    expectArgsByFlag: {},
    failures: [error?.message === "Unknown option." ? "Unknown option." : "reference import artifact fingerprinting failed"],
    warnings: []
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}
