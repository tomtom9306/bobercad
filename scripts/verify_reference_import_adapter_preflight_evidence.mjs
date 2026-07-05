#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHECK_ID = "referenceImportAdapterPreflightEvidenceCheck";
const CHECK_VERSION = "0.1.0";
const REQUIRED_EXTERNAL_ADAPTER_FAMILIES = ["dwg", "e57"];
const FAMILY_TARGET_FORMAT_TOKENS = {
  dwg: "dwg",
  e57: "e57pointcloud"
};
const REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS = Object.values(FAMILY_TARGET_FORMAT_TOKENS);
const FAMILY_REQUESTED_FORMAT_ALIASES = {
  dwg: ["dwg"],
  e57: ["e57", "e57pointcloud", "e57pc"]
};
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const STAT_FINGERPRINT = /^stat-sha256:[a-f0-9]{64}$/;
const SAFE_ADAPTER_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_DIAGNOSTIC_CODE = /^[a-z0-9][a-z0-9_-]*$/;
const RESERVED_ADAPTER_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const REQUESTED_SUMMARY_FIELD_PRIVACY_POLICY = "known-family-alias-or-safe-adapter-key-else-null";
const DIAGNOSTIC_SUMMARY_FIELD_PRIVACY_POLICY = "safe-lowercase-token-else-omitted";
const OUTPUT_FIELDS = [
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
const GATE_FIELDS = [
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
const PREFLIGHT_REPORT_FIELDS = [
  "ok",
  "requested",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapters",
  "adapterTargetFormatCoverage",
  "adapterTargetFormatCoverageFingerprint",
  "adapterPreflightFingerprint",
  "adapterPreflightDecision",
  "diagnostics"
];
const SUMMARY_FIELDS = [
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

function usage() {
  return [
    "Usage: node scripts/verify_reference_import_adapter_preflight_evidence.mjs --preflight <check-adapters.json> --family <dwg|e57> --output <evidence-check.json> [options]",
    "",
    "Verifies a saved --check-adapters report as private DWG/E57 adapter-preflight completion evidence without launching adapters, reading adapter configs, or reading source files.",
    "",
    "Options:",
    "  --preflight <path>                         Saved translator/importer --check-adapters JSON report.",
    "  --family <dwg|e57>                         Required external adapter family proved by this report.",
    "  --expect-preflight-report-fingerprint <sha256:hex>  Require saved preflight report bytes to match this fingerprint.",
    "  --output <path>                            Machine-readable JSON adapter-preflight evidence check path.",
    "  --list-contract                           Print the adapter-preflight evidence checker contract and exit.",
    "  --help                                    Show this help text."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    preflightPath: "",
    family: "",
    expectedPreflightReportFingerprint: "",
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
    if (arg === "--preflight") {
      options.preflightPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--family") {
      options.family = familyValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--expect-preflight-report-fingerprint") {
      options.expectedPreflightReportFingerprint = fingerprintValue(requiredValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
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

function familyValue(value, flag) {
  const family = String(value || "").trim().toLowerCase();
  if (!REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(family)) {
    throw new Error(`${flag} must be one of ${REQUIRED_EXTERNAL_ADAPTER_FAMILIES.join(", ")}`);
  }
  return family;
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
    id: "referenceImportAdapterPreflightEvidenceCheckContract",
    version: CHECK_VERSION,
    checkId: CHECK_ID,
    inputBoundary: {
      readsSavedAdapterPreflightReportOnly: true,
      readsAdapterConfig: false,
      readsPrivateSourceFiles: false,
      readsProjectFiles: false,
      readsReferenceManifests: false,
      readsPointCloudChunkSidecars: false,
      launchesWorkflowRunner: false,
      launchesExternalAdapters: false,
      resolvesAdapterDependencies: false,
      shell: false
    },
    requiredInputReports: {
      savedPreflightCommand: "translator/importer --check-adapters",
      requiredFamilies: REQUIRED_EXTERNAL_ADAPTER_FAMILIES,
      requiredTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
      requiredRequestedFamilyScopedReports: true
    },
    familyPolicy: {
      targetFormatTokens: FAMILY_TARGET_FORMAT_TOKENS,
      requiredExternalAdapterTargetFormatTokens: REQUIRED_EXTERNAL_ADAPTER_TARGET_FORMAT_TOKENS,
      requestedFormatAliases: FAMILY_REQUESTED_FORMAT_ALIASES,
      adapterKeyPolicy: {
        safeAdapterKeyPattern: SAFE_ADAPTER_KEY.source,
        reservedAdapterKeys: [...RESERVED_ADAPTER_KEYS]
      },
      requiresSelectedAdapter: true,
      requiresExplicitSelectedAdapterDecisionKeys: true,
      requiresExactlyOneSelectedAdapter: true,
      requiresRequestedAdapterMatch: true,
      requiresSelectedAdapterTargetCoverageEntry: true,
      requiresAdapterTargetCoverageFingerprintContentMatch: true,
      requiresAdapterPreflightReady: true,
      requiresAdapterTargetFormatCoverage: true,
      requiresSavedOutput: true
    },
    outputContract: {
      topLevelFields: OUTPUT_FIELDS,
      gateFields: GATE_FIELDS,
      preflightReportFields: PREFLIGHT_REPORT_FIELDS,
      summaryFields: SUMMARY_FIELDS,
      adapterPreflightEvidenceOutputPathField: "adapterPreflightEvidenceCheckPath",
      requestedSummaryFieldPrivacyPolicy: REQUESTED_SUMMARY_FIELD_PRIVACY_POLICY,
      diagnosticSummaryFieldPrivacyPolicy: DIAGNOSTIC_SUMMARY_FIELD_PRIVACY_POLICY,
      fingerprintFields: [
        "preflightReportFingerprint",
        "adapterConfigStatFingerprint",
        "adapterRegistryFingerprint",
        "adapterPreflightFingerprint",
        "adapterTargetFormatCoverageFingerprint"
      ],
      pathPrivacyFields: ["preflightReportPath", "adapterPreflightEvidenceCheckPath"]
    },
    cliFlags: ["--preflight", "--family", "--expect-preflight-report-fingerprint", "--output", "--list-contract", "--help"]
  };
}

function fileFingerprint(raw) {
  return `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
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

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function diagnosticCodes(diagnostics = [], level) {
  return [...new Set(diagnosticsByLevel(diagnostics, level)
    .map((diagnostic) => diagnostic.code)
    .filter((code) => typeof code === "string" && SAFE_DIAGNOSTIC_CODE.test(code)))]
    .sort((left, right) => left.localeCompare(right));
}

function diagnosticsByLevel(diagnostics = [], level) {
  return (Array.isArray(diagnostics) ? diagnostics : [])
    .filter((diagnostic) => isRecord(diagnostic) && diagnostic.level === level);
}

function allDiagnostics(report = {}) {
  const topLevel = Array.isArray(report.diagnostics) ? report.diagnostics : [];
  const adapterDiagnostics = Object.values(isRecord(report.adapters) ? report.adapters : {})
    .flatMap((adapter) => Array.isArray(adapter?.diagnostics) ? adapter.diagnostics : []);
  return [...topLevel, ...adapterDiagnostics];
}

function safeAdapterKeys(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => safeAdapterKey(value))
    .sort((left, right) => left.localeCompare(right));
}

function safeAdapterKey(value = "") {
  return typeof value === "string"
    && SAFE_ADAPTER_KEY.test(value)
    && !RESERVED_ADAPTER_KEYS.has(value);
}

function selectedAdapterEntryMatchesFamily(adapter = {}, family = "") {
  return isRecord(adapter)
    && adapter.ok === true
    && Array.isArray(adapter.formats)
    && adapter.formats.includes(family)
    && SHA256_FINGERPRINT.test(adapter.adapterPreflightFingerprint || "");
}

function selectedAdapterKeys(report = {}, family = "") {
  const adapters = isRecord(report.adapters) ? report.adapters : {};
  const decisionKeys = safeAdapterKeys(report.adapterPreflightDecision?.selectedAdapterKeys);
  return decisionKeys
    .filter((key) => safeAdapterKey(key) && selectedAdapterEntryMatchesFamily(adapters[key], family))
    .sort((left, right) => left.localeCompare(right));
}

function selectedAdapterRegistryAdapterFingerprints(report = {}, family = "") {
  const adapters = isRecord(report.adapters) ? report.adapters : {};
  return selectedAdapterKeys(report, family)
    .map((key) => adapters[key]?.adapterRegistryFingerprint)
    .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint || ""))
    .filter((fingerprint, index, entries) => entries.indexOf(fingerprint) === index)
    .sort((left, right) => left.localeCompare(right));
}

function selectedAdapterRegistryAdapterFingerprintsPresentOk(report = {}, family = "", selectedKeys = []) {
  const adapters = isRecord(report.adapters) ? report.adapters : {};
  return selectedKeys.length === 1
    && selectedKeys.every((key) => SHA256_FINGERPRINT.test(adapters[key]?.adapterRegistryFingerprint || ""));
}

function selectedAdapterEvidenceOk(report = {}, family = "", selectedKeys = []) {
  const requestedAdapter = report.requested?.adapter;
  if (selectedKeys.length !== 1) return false;
  return safeAdapterKey(requestedAdapter)
    && selectedKeys[0] === requestedAdapter;
}

function adapterCount(report = {}) {
  return Object.keys(isRecord(report.adapters) ? report.adapters : {}).length;
}

function hasCoverageForFamily(report = {}, family = "") {
  const targetFormatToken = FAMILY_TARGET_FORMAT_TOKENS[family];
  const coverage = report.adapterTargetFormatCoverage;
  if (!isRecord(coverage)) return false;
  const configuredTargetTokens = Array.isArray(coverage.externalAdapterConfiguredTargetFormatTokens)
    ? coverage.externalAdapterConfiguredTargetFormatTokens
    : Array.isArray(coverage.adapterConfiguredTargetFormatTokens)
      ? coverage.adapterConfiguredTargetFormatTokens
      : [];
  const missingTargetTokens = Array.isArray(coverage.missingExternalAdapterTargetFormatTokens)
    ? coverage.missingExternalAdapterTargetFormatTokens
    : [];
  const targetEntries = isRecord(coverage.targetFormatEntries) ? coverage.targetFormatEntries : {};
  const matchingEntry = isRecord(targetEntries[targetFormatToken])
    ? targetEntries[targetFormatToken]
    : null;
  return configuredTargetTokens.includes(targetFormatToken)
    && !missingTargetTokens.includes(targetFormatToken)
    && (
      matchingEntry?.formatToken === targetFormatToken
      || (Array.isArray(coverage.targetFormatTokens) && coverage.targetFormatTokens.includes(targetFormatToken))
    );
}

function targetCoverageEntryForFamily(report = {}, family = "") {
  const targetFormatToken = FAMILY_TARGET_FORMAT_TOKENS[family] || "";
  const entries = report.adapterTargetFormatCoverage?.targetFormatEntries;
  if (!targetFormatToken || !isRecord(entries) || !isRecord(entries[targetFormatToken])) return null;
  return entries[targetFormatToken];
}

function selectedAdapterTargetCoverageKeys(report = {}, family = "") {
  const entry = targetCoverageEntryForFamily(report, family);
  return safeAdapterKeys(entry?.adapterKeys);
}

function selectedAdapterTargetCoverageOk(report = {}, family = "", selectedKeys = []) {
  const targetFormatToken = FAMILY_TARGET_FORMAT_TOKENS[family] || "";
  const entry = targetCoverageEntryForFamily(report, family);
  const coverageKeys = selectedAdapterTargetCoverageKeys(report, family);
  return selectedKeys.length === 1
    && isRecord(entry)
    && entry.formatToken === targetFormatToken
    && entry.canonicalFormat === family
    && entry.externalAdapterRequired === true
    && entry.adapterConfigured === true
    && entry.adapterCoverageStatus === "required-adapter-configured"
    && coverageKeys.includes(selectedKeys[0]);
}

function adapterTargetFormatCoverageFingerprintFromContent(report = {}) {
  const coverage = report.adapterTargetFormatCoverage;
  if (!isRecord(coverage)) return "";
  const { adapterTargetFormatCoverageFingerprint: _fingerprint, ...payload } = coverage;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterTargetFormatCoverageFingerprintMatchesContent(report = {}) {
  const fingerprint = adapterTargetFormatCoverageFingerprintFromContent(report);
  return SHA256_FINGERPRINT.test(fingerprint)
    && report.adapterTargetFormatCoverage?.adapterTargetFormatCoverageFingerprint === fingerprint
    && report.adapterTargetFormatCoverageFingerprint === fingerprint;
}

function requestedFamilyOk(report = {}, family = "") {
  const requested = report.requested;
  if (!isRecord(requested)) return false;
  const aliases = FAMILY_REQUESTED_FORMAT_ALIASES[family] || [];
  return requested.format === family && aliases.includes(requested.requestedFormat || family);
}

function requestedFormatForSummary(report = {}) {
  const value = report.requested?.format;
  return REQUIRED_EXTERNAL_ADAPTER_FAMILIES.includes(value) ? value : null;
}

function requestedFormatTokenForSummary(report = {}) {
  const value = report.requested?.requestedFormat;
  const family = requestedFormatForSummary(report);
  const aliases = FAMILY_REQUESTED_FORMAT_ALIASES[family] || [];
  return aliases.includes(value) ? value : null;
}

function requestedAdapterForSummary(report = {}) {
  const value = report.requested?.adapter;
  return safeAdapterKey(value) ? value : null;
}

function externalAdapterTargetFormatTokensForFamily(report = {}, family = "") {
  const targetFormatToken = FAMILY_TARGET_FORMAT_TOKENS[family] || "";
  if (!targetFormatToken) return [];
  if (!requestedFamilyOk(report, family)) return [];
  if (!hasCoverageForFamily(report, family)) return [];
  return [targetFormatToken];
}

function adapterPreflightEvidenceSummary(report = {}, family = "") {
  const diagnostics = allDiagnostics(report);
  return {
    family,
    targetFormatToken: FAMILY_TARGET_FORMAT_TOKENS[family] || "",
    externalAdapterTargetFormatTokens: externalAdapterTargetFormatTokensForFamily(report, family),
    requestedFormat: requestedFormatForSummary(report),
    requestedFormatToken: requestedFormatTokenForSummary(report),
    requestedAdapter: requestedAdapterForSummary(report),
    selectedAdapterKeys: selectedAdapterKeys(report, family),
    selectedAdapterTargetCoverageKeys: selectedAdapterTargetCoverageKeys(report, family),
    adapterConfigStatFingerprint: STAT_FINGERPRINT.test(report.adapterConfigStatFingerprint || "") ? report.adapterConfigStatFingerprint : "",
    adapterRegistryFingerprint: SHA256_FINGERPRINT.test(report.adapterRegistryFingerprint || "") ? report.adapterRegistryFingerprint : "",
    adapterRegistryAdapterFingerprints: selectedAdapterRegistryAdapterFingerprints(report, family),
    adapterCount: adapterCount(report),
    blockingDiagnosticCodes: diagnosticCodes(diagnostics, "error"),
    warningDiagnosticCodes: diagnosticCodes(diagnostics, "warning"),
    adapterPreflightReady: report.adapterPreflightDecision?.adapterPreflightReady === true,
    adapterTargetFormatCoverageFingerprint: SHA256_FINGERPRINT.test(report.adapterTargetFormatCoverageFingerprint || "") ? report.adapterTargetFormatCoverageFingerprint : "",
    adapterPreflightFingerprint: SHA256_FINGERPRINT.test(report.adapterPreflightFingerprint || "") ? report.adapterPreflightFingerprint : ""
  };
}

function verifyAdapterPreflightEvidence(options = {}) {
  const preflightFile = readJsonFile(options.preflightPath, "adapter preflight report");
  const report = preflightFile.value;
  const reportShapeOk = isRecord(report);
  const diagnostics = reportShapeOk ? allDiagnostics(report) : [];
  const selectedKeys = reportShapeOk ? selectedAdapterKeys(report, options.family) : [];
  const gates = {
    preflightReportReadableOk: preflightFile.failures.length === 0,
    preflightReportShapeOk: reportShapeOk,
    preflightReportAcceptedOk: reportShapeOk && report.ok === true && report.adapterPreflightDecision?.adapterPreflightReady === true && diagnosticsByLevel(diagnostics, "error").length === 0,
    requestedFamilyOk: reportShapeOk && requestedFamilyOk(report, options.family),
    adapterConfigStatFingerprintPresentOk: reportShapeOk && STAT_FINGERPRINT.test(report.adapterConfigStatFingerprint || ""),
    adapterRegistryFingerprintPresentOk: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterRegistryFingerprint || ""),
    selectedAdapterEvidenceOk: reportShapeOk && selectedAdapterEvidenceOk(report, options.family, selectedKeys),
    adapterTargetFormatCoverageOk: reportShapeOk && hasCoverageForFamily(report, options.family),
    selectedAdapterTargetCoverageOk: reportShapeOk && selectedAdapterTargetCoverageOk(report, options.family, selectedKeys),
    adapterRegistryAdapterFingerprintsPresentOk: reportShapeOk && selectedAdapterRegistryAdapterFingerprintsPresentOk(report, options.family, selectedKeys),
    adapterPreflightFingerprintPresentOk: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterPreflightFingerprint || ""),
    adapterTargetFormatCoverageFingerprintPresentOk: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterTargetFormatCoverageFingerprint || ""),
    adapterTargetFormatCoverageFingerprintMatchesContentOk: reportShapeOk && adapterTargetFormatCoverageFingerprintMatchesContent(report),
    expectedPreflightReportFingerprintMatches: options.expectedPreflightReportFingerprint
      ? preflightFile.fingerprint === options.expectedPreflightReportFingerprint
      : true,
    adapterPreflightEvidenceOutputWritableOk: false
  };
  const failures = [...preflightFile.failures];
  if (!options.family) failures.push("--family is required");
  if (!options.outputPath) failures.push("--output is required for accepted adapter preflight evidence");
  for (const [field, value] of Object.entries(gates)) {
    if (field !== "adapterPreflightEvidenceOutputWritableOk" && value !== true) {
      failures.push(`${field} failed`);
    }
  }
  const output = {
    id: CHECK_ID,
    version: CHECK_VERSION,
    ok: false,
    family: options.family || "",
    targetFormatToken: FAMILY_TARGET_FORMAT_TOKENS[options.family] || "",
    externalAdapterTargetFormatTokens: reportShapeOk ? externalAdapterTargetFormatTokensForFamily(report, options.family) : [],
    preflightReportPath: options.preflightPath ? path.basename(options.preflightPath) : "",
    adapterPreflightEvidenceCheckPath: options.outputPath ? path.basename(options.outputPath) : "",
    preflightReportFingerprint: SHA256_FINGERPRINT.test(preflightFile.fingerprint) ? preflightFile.fingerprint : "",
    adapterConfigStatFingerprint: reportShapeOk && STAT_FINGERPRINT.test(report.adapterConfigStatFingerprint || "") ? report.adapterConfigStatFingerprint : "",
    adapterRegistryFingerprint: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterRegistryFingerprint || "") ? report.adapterRegistryFingerprint : "",
    adapterPreflightFingerprint: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterPreflightFingerprint || "") ? report.adapterPreflightFingerprint : "",
    adapterTargetFormatCoverageFingerprint: reportShapeOk && SHA256_FINGERPRINT.test(report.adapterTargetFormatCoverageFingerprint || "") ? report.adapterTargetFormatCoverageFingerprint : "",
    gates,
    summary: reportShapeOk ? adapterPreflightEvidenceSummary(report, options.family) : adapterPreflightEvidenceSummary({}, options.family),
    failures,
    warnings: diagnosticCodes(diagnostics, "warning").map((code) => `saved preflight warning: ${code}`)
  };
  output.ok = Object.values(gates).every((value) => value === true) && output.failures.length === 0;
  if (options.outputPath) {
    try {
      fs.mkdirSync(path.dirname(path.resolve(options.outputPath)), { recursive: true });
      const pendingOutput = {
        ...output,
        gates: {
          ...output.gates,
          adapterPreflightEvidenceOutputWritableOk: true
        }
      };
      pendingOutput.failures = pendingOutput.failures.filter((failure) => failure !== "adapterPreflightEvidenceOutputWritableOk failed");
      pendingOutput.ok = Object.values(pendingOutput.gates).every((value) => value === true) && pendingOutput.failures.length === 0;
      fs.writeFileSync(options.outputPath, `${JSON.stringify(pendingOutput, null, 2)}\n`);
      return pendingOutput;
    } catch {
      output.failures.push("adapterPreflightEvidenceOutputWritableOk failed");
    }
  }
  return output;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      return;
    }
    if (options.listContract) {
      process.stdout.write(`${JSON.stringify(contract(), null, 2)}\n`);
      return;
    }
    const result = verifyAdapterPreflightEvidence(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}

main();
