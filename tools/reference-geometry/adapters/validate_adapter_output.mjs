#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  REFERENCE_ADAPTER_OUTPUT_CONTRACT_VERSION,
  describeValidatedReferenceGeometry,
  referenceGeometryAdapterOutputValidationContractMetadata
} from "../translate_reference_geometry.mjs";
import { assertAdapterRequestContract } from "./adapter_request_contract.mjs";
import { assertAdapterOutputContract } from "./adapter_output_contract.mjs";

function usage() {
  return [
    "Usage:",
    "  node tools/reference-geometry/adapters/validate_adapter_output.mjs --list-contract",
    "  node tools/reference-geometry/adapters/validate_adapter_output.mjs --request <request.json> [--output <manifest.json>] [--json]",
    "",
    "Validates a canonical reference geometry manifest against the staged adapter request without running the importer or viewer.",
    "With --json, reports manifest, chunk-file-set, and complete artifact fingerprints for adapter CI comparisons."
  ].join("\n");
}

function requiredOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw adapterOutputValidationError(`${option} requires a non-empty value`, "adapter-output-cli-option-missing", "cli");
  }
  return value;
}

function optionEqualsValue(arg, prefix, option) {
  const value = arg.slice(prefix.length);
  if (value === "") {
    throw adapterOutputValidationError(`${option} requires a non-empty value`, "adapter-output-cli-option-missing", "cli");
  }
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--list-contract") args.listContract = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--request") args.request = requiredOptionValue(argv, index++, "--request");
    else if (arg.startsWith("--request=")) args.request = optionEqualsValue(arg, "--request=", "--request");
    else if (arg === "--output") args.output = requiredOptionValue(argv, index++, "--output");
    else if (arg.startsWith("--output=")) args.output = optionEqualsValue(arg, "--output=", "--output");
    else throw adapterOutputValidationError(`Unknown argument: ${arg}`, "adapter-output-cli-option-unknown", "cli");
  }
  return args;
}

function adapterOutputValidationError(message, adapterOutputErrorCode, adapterOutputValidationKind, cause = null) {
  const error = new Error(message);
  error.adapterOutputErrorCode = adapterOutputErrorCode;
  error.adapterOutputValidationKind = adapterOutputValidationKind;
  if (cause) error.cause = cause;
  return error;
}

function wrapAdapterOutputValidationError(error, adapterOutputErrorCode, adapterOutputValidationKind) {
  if (error?.adapterOutputErrorCode) return error;
  return adapterOutputValidationError(error?.message || String(error), adapterOutputErrorCode, adapterOutputValidationKind, error);
}

function validationMessageDetail(message) {
  const schemaPathMatch = message.match(/\s(\$(?:\.|\[)[\s\S]*)$/);
  if (schemaPathMatch) return schemaPathMatch[1];
  const delimiter = message.indexOf(": ");
  return delimiter === -1 ? message : message.slice(delimiter + 2);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathVariants(value) {
  if (typeof value !== "string" || !/\S/.test(value)) return [];
  const resolved = path.resolve(value);
  return [...new Set([
    value,
    resolved,
    value.replaceAll("\\", "/"),
    resolved.replaceAll("\\", "/")
  ])].filter((entry) => entry && /\S/.test(entry));
}

function redactKnownPaths(message, paths = []) {
  let result = String(message || "");
  const variants = paths
    .flatMap((entry) => pathVariants(entry))
    .sort((a, b) => b.length - a.length);
  for (const variant of variants) {
    result = result.replace(new RegExp(escapeRegex(variant), "g"), "<path>");
  }
  return result;
}

function publicValidationMessage(message, paths = []) {
  const detail = redactKnownPaths(validationMessageDetail(String(message || "")), paths)
    .replace(/\s+/g, " ")
    .trim();
  if (/^adapter output contract output file does not exist:\s*<path>$/.test(detail)) {
    return "adapter output contract output file does not exist";
  }
  return detail;
}

function readRequestJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw wrapAdapterOutputValidationError(error, "adapter-output-request-read-error", "request");
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw wrapAdapterOutputValidationError(error, "adapter-output-request-json-invalid", "request");
  }
}

function classifyAdapterOutputContractError(error) {
  if (error?.adapterOutputErrorCode) return error;
  const message = error?.message || String(error);
  const detail = validationMessageDetail(message);
  if (/outputPath must match request\.output|request\.outputDir must match output directory|outputPath must resolve inside request\.stageDir/.test(detail)) {
    return wrapAdapterOutputValidationError(error, "adapter-output-path-mismatch", "manifest");
  }
  if (/output file does not exist/.test(detail)) {
    return wrapAdapterOutputValidationError(error, "adapter-output-missing", "manifest");
  }
  if (/asset\.(id|name|units) must match|asset\.source\.[A-Za-z0-9_]+ must match|asset\.source\.checksum must be omitted|asset\.source\.translator(?:Version)? must be/.test(detail)) {
    return wrapAdapterOutputValidationError(error, "adapter-output-identity-mismatch", "manifest");
  }
  if (/chunk|sidecar/i.test(detail)) {
    return wrapAdapterOutputValidationError(error, "adapter-output-chunk-invalid", "point-cloud-chunk");
  }
  if (/\bbounds\b/i.test(detail)) {
    return wrapAdapterOutputValidationError(error, "adapter-output-bounds-invalid", "manifest");
  }
  return wrapAdapterOutputValidationError(error, "adapter-output-invalid", "manifest");
}

function countByKind(objects) {
  const counts = {};
  for (const object of Object.values(objects || {})) {
    if (!object?.kind) continue;
    counts[object.kind] = (counts[object.kind] || 0) + 1;
  }
  return counts;
}

function publicStatFingerprint(kind, publicIdentity, fileSizeBytes, fileModifiedTime) {
  const input = [
    kind || "",
    publicIdentity || "",
    Number.isInteger(fileSizeBytes) ? String(fileSizeBytes) : "",
    fileModifiedTime || ""
  ].join("\0");
  return `stat-sha256:${crypto.createHash("sha256").update(input).digest("hex")}`;
}

function adapterConfigStatFingerprint(fileSizeBytes, fileModifiedTime) {
  return publicStatFingerprint("adapter-config", "json", fileSizeBytes, fileModifiedTime);
}

function adapterConfigCorrelation(request = {}) {
  if (!request.adapterConfigPath) {
    return {
      adapterConfigPath: null,
      adapterConfigDir: null,
      adapterConfigFileSizeBytes: null,
      adapterConfigFileModifiedTime: null,
      adapterConfigStatFingerprint: null
    };
  }
  return {
    adapterConfigPath: path.resolve(request.adapterConfigPath),
    adapterConfigDir: request.adapterConfigDir ? path.resolve(request.adapterConfigDir) : null,
    adapterConfigFileSizeBytes: Number.isInteger(request.adapterConfigFileSizeBytes) ? request.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: request.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: adapterConfigStatFingerprint(
      request.adapterConfigFileSizeBytes,
      request.adapterConfigFileModifiedTime
    )
  };
}

function adapterRequestCorrelation(request) {
  return {
    adapterRequestFingerprint: request?.adapterRequestFingerprint || null,
    adapterRequestEvidenceFingerprint: request?.adapterRequestEvidenceFingerprint || null,
    adapterRunId: request?.adapterRunId || null,
    adapterKey: request?.adapterKey || null,
    adapterRegistryFingerprint: request?.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: request?.adapterRegistryAdapterFingerprint || null,
    ...adapterConfigCorrelation(request),
    adapterOutputMode: request?.outputMode || null,
    sourceFormat: request?.format || null,
    sourceRequestedFormat: request?.requestedFormat || null,
    sourceFileName: request?.sourceFileName || null,
    sourceFileExtension: typeof request?.sourceFileExtension === "string" ? request.sourceFileExtension : null,
    sourceFileSizeBytes: Number.isInteger(request?.sourceFileSizeBytes) ? request.sourceFileSizeBytes : null,
    sourceFileModifiedTime: request?.sourceFileModifiedTime || null,
    sourceStatFingerprint: request?.sourceStatFingerprint || null,
    assetId: request?.assetId || null,
    assetName: request?.name || null,
    assetUnits: request?.units || null,
    adapterRequestSchemaVersion: request?.schemaVersions?.adapterRequest || null,
    referenceGeometrySchemaVersion: request?.schemaVersions?.referenceGeometry || null,
    pointCloudChunkSchemaVersion: request?.schemaVersions?.pointCloudChunk || null,
    adapterRequestSchemaPath: request?.schemas?.adapterRequest || null,
    referenceGeometrySchemaPath: request?.schemas?.referenceGeometry || null,
    pointCloudChunkSchemaPath: request?.schemas?.pointCloudChunk || null
  };
}

function attachAdapterRequestCorrelation(error, request, outputPath = null) {
  const correlation = adapterRequestCorrelation(request);
  error.adapterRequestCorrelation = correlation;
  if (outputPath) error.adapterOutputPath = path.resolve(outputPath);
  for (const [key, value] of Object.entries(correlation)) {
    if (value !== null && error[key] === undefined) error[key] = value;
  }
  return error;
}

function argvRequestsJson(argv) {
  return argv.includes("--json");
}

function optionValueFromArgv(argv, optionName) {
  const equalsPrefix = `${optionName}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith(equalsPrefix)) {
      const value = arg.slice(equalsPrefix.length);
      return value && !value.startsWith("--") ? value : null;
    }
    if (arg === optionName) {
      const value = argv[index + 1];
      return value && !value.startsWith("--") ? value : null;
    }
  }
  return null;
}

export function validateAdapterOutputForRequest({ requestPath, outputPath = null }) {
  if (typeof requestPath !== "string" || !/\S/.test(requestPath)) {
    throw adapterOutputValidationError("--request is required", "adapter-output-request-missing", "request");
  }
  const absoluteRequestPath = path.resolve(requestPath);
  const request = readRequestJson(absoluteRequestPath);
  try {
    assertAdapterRequestContract(request, absoluteRequestPath);
  } catch (error) {
    throw attachAdapterRequestCorrelation(
      wrapAdapterOutputValidationError(error, "adapter-output-request-invalid", "request"),
      request
    );
  }
  const absoluteOutputPath = path.resolve(outputPath || request.output);
  let data;
  try {
    data = assertAdapterOutputContract(absoluteOutputPath, request, absoluteRequestPath);
  } catch (error) {
    throw attachAdapterRequestCorrelation(classifyAdapterOutputContractError(error), request, absoluteOutputPath);
  }
  const canonicalSummary = describeValidatedReferenceGeometry(absoluteOutputPath);
  return {
    ok: true,
    adapterOutputContractVersion: REFERENCE_ADAPTER_OUTPUT_CONTRACT_VERSION,
    requestPath: absoluteRequestPath,
    outputPath: absoluteOutputPath,
    ...adapterRequestCorrelation(request),
    referenceManifestFingerprint: canonicalSummary.referenceManifestFingerprint,
    referenceChunkFileSetFingerprint: canonicalSummary.referenceChunkFileSetFingerprint,
    referenceArtifactFingerprint: canonicalSummary.referenceArtifactFingerprint,
    referenceFileSizeBytes: canonicalSummary.referenceFileSizeBytes,
    referenceFileModifiedTime: canonicalSummary.referenceFileModifiedTime,
    referenceChunkFileCount: canonicalSummary.referenceChunkFileCount,
    referenceChunkFileSizeBytes: canonicalSummary.referenceChunkFileSizeBytes,
    referenceChunkFileModifiedTimeLatest: canonicalSummary.referenceChunkFileModifiedTimeLatest,
    referenceChunkFileEntries: canonicalSummary.referenceChunkFileEntries,
    referenceChunkFileOmittedCount: canonicalSummary.referenceChunkFileOmittedCount,
    assetId: data.asset?.id || null,
    assetName: data.asset?.name || null,
    assetUnits: data.asset?.units || null,
    schema: data.schema || null,
    schemaVersion: data.schemaVersion || null,
    referenceLayerCount: Object.keys(data.layers || {}).length,
    referenceObjectCount: Object.keys(data.objects || {}).length,
    referenceChunkCount: Array.isArray(data.chunks) ? data.chunks.length : 0,
    referenceObjectKindCounts: countByKind(data.objects),
    chunkDir: path.resolve(request.chunkDir),
    chunkPathPrefix: request.chunkPathPrefix
  };
}

function describeError(error, args = {}, argv = []) {
  const requestPath = args.request || optionValueFromArgv(argv, "--request");
  const outputPath = args.output || optionValueFromArgv(argv, "--output");
  const errorOutputPath = error?.adapterOutputPath || null;
  const correlation = error?.adapterRequestCorrelation || adapterRequestCorrelation(error || {});
  const validationKind = error?.adapterOutputValidationKind || "unknown";
  const rawMessage = error?.message || String(error);
  const messagePaths = [
    requestPath,
    outputPath,
    errorOutputPath,
    correlation.adapterConfigPath,
    correlation.adapterConfigDir
  ];
  return {
    ok: false,
    adapterOutputContractVersion: REFERENCE_ADAPTER_OUTPUT_CONTRACT_VERSION,
    errors: [
      {
        message: validationKind === "cli" ? rawMessage : publicValidationMessage(rawMessage, messagePaths),
        adapterOutputErrorCode: error?.adapterOutputErrorCode || "adapter-output-validation-error",
        adapterOutputValidationKind: validationKind,
        requestPath: requestPath ? path.resolve(requestPath) : null,
        outputPath: outputPath ? path.resolve(outputPath) : (errorOutputPath ? path.resolve(errorOutputPath) : null),
        ...correlation
      }
    ]
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.listContract) {
    console.log(JSON.stringify(referenceGeometryAdapterOutputValidationContractMetadata(), null, 2));
    return 0;
  }
  const summary = validateAdapterOutputForRequest({
    requestPath: args.request,
    outputPath: args.output || null
  });
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`OK: adapter output ${summary.outputPath} matches request ${summary.requestPath}`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args = {};
  const argv = process.argv.slice(2);
  try {
    args = parseArgs(argv);
    if (args.help) {
      console.log(usage());
      process.exit(0);
    }
    if (args.listContract) {
      console.log(JSON.stringify(referenceGeometryAdapterOutputValidationContractMetadata(), null, 2));
      process.exit(0);
    }
    const summary = validateAdapterOutputForRequest({
      requestPath: args.request,
      outputPath: args.output || null
    });
    if (args.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`OK: adapter output ${summary.outputPath} matches request ${summary.requestPath}`);
    }
    process.exit(0);
  } catch (error) {
    if (args.json || argvRequestsJson(argv)) {
      console.log(JSON.stringify(describeError(error, args, argv), null, 2));
    } else {
      console.error(error.message || String(error));
    }
    process.exit(1);
  }
}
