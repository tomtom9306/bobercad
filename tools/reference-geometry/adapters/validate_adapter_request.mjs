#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  referenceGeometryAdapterRequestContractMetadata
} from "../translate_reference_geometry.mjs";
import { assertAdapterRequestContract } from "./adapter_request_contract.mjs";

function usage() {
  return [
    "Usage:",
    "  node tools/reference-geometry/adapters/validate_adapter_request.mjs --list-contract",
    "  node tools/reference-geometry/adapters/validate_adapter_request.mjs --request <request.json> [--json]",
    "",
    "Validates a staged reference geometry adapter request without running the adapter, importer, or viewer.",
    "With --json, reports request fingerprint, run metadata, staged paths, source identity, and schema contract paths."
  ].join("\n");
}

function adapterRequestValidationError(message, adapterRequestErrorCode, adapterRequestValidationKind, cause = null) {
  const error = new Error(message);
  error.adapterRequestErrorCode = adapterRequestErrorCode;
  error.adapterRequestValidationKind = adapterRequestValidationKind;
  if (cause) error.cause = cause;
  return error;
}

function requiredOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) {
    throw adapterRequestValidationError(`${option} requires a non-empty value`, "adapter-request-cli-option-missing", "cli");
  }
  return value;
}

function optionEqualsValue(arg, prefix, option) {
  const value = arg.slice(prefix.length);
  if (value === "") {
    throw adapterRequestValidationError(`${option} requires a non-empty value`, "adapter-request-cli-option-missing", "cli");
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
    else throw adapterRequestValidationError(`Unknown argument: ${arg}`, "adapter-request-cli-option-unknown", "cli");
  }
  return args;
}

function wrapAdapterRequestValidationError(error, adapterRequestErrorCode, adapterRequestValidationKind) {
  if (error?.adapterRequestErrorCode) return error;
  return adapterRequestValidationError(error?.message || String(error), adapterRequestErrorCode, adapterRequestValidationKind, error);
}

function readRequestJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw wrapAdapterRequestValidationError(error, "adapter-request-read-error", "request");
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw wrapAdapterRequestValidationError(error, "adapter-request-json-invalid", "request");
  }
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

function recordOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function resolvedPathOrNull(value) {
  return typeof value === "string" && /\S/.test(value) ? path.resolve(value) : null;
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
  const redacted = redactKnownPaths(message, paths)
    .replace(/\s+/g, " ")
    .trim();
  return redacted.startsWith("<path>: ") ? redacted.slice("<path>: ".length) : redacted;
}

function contractPathSummary(request) {
  const source = recordOrEmpty(request);
  const schemaVersions = recordOrEmpty(source.schemaVersions);
  const schemas = recordOrEmpty(source.schemas);
  return {
    adapterRequestSchemaVersion: stringOrNull(schemaVersions.adapterRequest),
    referenceGeometrySchemaVersion: stringOrNull(schemaVersions.referenceGeometry),
    pointCloudChunkSchemaVersion: stringOrNull(schemaVersions.pointCloudChunk),
    adapterRequestSchemaPath: stringOrNull(schemas.adapterRequest),
    referenceGeometrySchemaPath: stringOrNull(schemas.referenceGeometry),
    pointCloudChunkSchemaPath: stringOrNull(schemas.pointCloudChunk)
  };
}

function adapterRequestContractVersion() {
  return referenceGeometryAdapterRequestContractMetadata().schemaVersion;
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

function adapterConfigSummary(request = {}) {
  const source = recordOrEmpty(request);
  const adapterConfigPath = typeof source.adapterConfigPath === "string" && /\S/.test(source.adapterConfigPath)
    ? source.adapterConfigPath
    : null;
  if (!adapterConfigPath) {
    return {
      adapterConfigPath: null,
      adapterConfigDir: null,
      adapterConfigFileSizeBytes: null,
      adapterConfigFileModifiedTime: null,
      adapterConfigStatFingerprint: null
    };
  }
  return {
    adapterConfigPath: path.resolve(adapterConfigPath),
    adapterConfigDir: resolvedPathOrNull(source.adapterConfigDir),
    adapterConfigFileSizeBytes: integerOrNull(source.adapterConfigFileSizeBytes),
    adapterConfigFileModifiedTime: stringOrNull(source.adapterConfigFileModifiedTime),
    adapterConfigStatFingerprint: adapterConfigStatFingerprint(
      source.adapterConfigFileSizeBytes,
      source.adapterConfigFileModifiedTime
    )
  };
}

function adapterRequestCorrelation(request = {}) {
  const source = recordOrEmpty(request);
  return {
    adapterRequestFingerprint: stringOrNull(source.adapterRequestFingerprint),
    adapterRequestEvidenceFingerprint: stringOrNull(source.adapterRequestEvidenceFingerprint),
    adapterRunId: stringOrNull(source.adapterRunId),
    adapterKey: stringOrNull(source.adapterKey),
    adapterRegistryFingerprint: stringOrNull(source.adapterRegistryFingerprint),
    adapterRegistryAdapterFingerprint: stringOrNull(source.adapterRegistryAdapterFingerprint),
    ...adapterConfigSummary(source),
    adapterOutputMode: stringOrNull(source.outputMode),
    sourceFormat: stringOrNull(source.format),
    sourceRequestedFormat: stringOrNull(source.requestedFormat),
    sourceFileName: stringOrNull(source.sourceFileName),
    sourceFileExtension: stringOrNull(source.sourceFileExtension),
    sourceFileSizeBytes: integerOrNull(source.sourceFileSizeBytes),
    sourceFileModifiedTime: stringOrNull(source.sourceFileModifiedTime),
    sourceStatFingerprint: stringOrNull(source.sourceStatFingerprint),
    inputPath: resolvedPathOrNull(source.input),
    outputPath: resolvedPathOrNull(source.output),
    outputDir: resolvedPathOrNull(source.outputDir),
    stageDir: resolvedPathOrNull(source.stageDir),
    scratchDir: resolvedPathOrNull(source.scratchDir),
    chunkDir: resolvedPathOrNull(source.chunkDir),
    chunkPathPrefix: stringOrNull(source.chunkPathPrefix),
    adapterLogPath: resolvedPathOrNull(source.adapterLogPath),
    adapterStdoutPath: resolvedPathOrNull(source.adapterStdoutPath),
    adapterStderrPath: resolvedPathOrNull(source.adapterStderrPath),
    assetId: stringOrNull(source.assetId),
    assetUnits: stringOrNull(source.units),
    pointCloudChunkSize: integerOrNull(source.pointCloudChunkSize),
    timeoutMs: integerOrNull(source.timeoutMs),
    ...contractPathSummary(source)
  };
}

function requestSummary(request, absoluteRequestPath) {
  return {
    ok: true,
    adapterRequestContractVersion: adapterRequestContractVersion(),
    requestPath: absoluteRequestPath,
    adapterRequestFingerprint: request.adapterRequestFingerprint,
    adapterRequestEvidenceFingerprint: request.adapterRequestEvidenceFingerprint || null,
    adapterRunId: request.adapterRunId,
    adapterKey: request.adapterKey || null,
    adapterRegistryFingerprint: request.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: request.adapterRegistryAdapterFingerprint || null,
    ...adapterConfigSummary(request),
    adapterOutputMode: request.outputMode,
    sourceFormat: request.format,
    sourceRequestedFormat: request.requestedFormat,
    sourceFileName: request.sourceFileName,
    sourceFileExtension: request.sourceFileExtension,
    sourceFileSizeBytes: request.sourceFileSizeBytes,
    sourceFileModifiedTime: request.sourceFileModifiedTime,
    sourceStatFingerprint: request.sourceStatFingerprint,
    inputPath: path.resolve(request.input),
    outputPath: path.resolve(request.output),
    outputDir: path.resolve(request.outputDir),
    stageDir: path.resolve(request.stageDir),
    scratchDir: path.resolve(request.scratchDir),
    chunkDir: path.resolve(request.chunkDir),
    chunkPathPrefix: request.chunkPathPrefix,
    adapterLogPath: path.resolve(request.adapterLogPath),
    adapterStdoutPath: path.resolve(request.adapterStdoutPath),
    adapterStderrPath: path.resolve(request.adapterStderrPath),
    assetId: request.assetId,
    assetUnits: request.units,
    pointCloudChunkSize: request.pointCloudChunkSize,
    timeoutMs: request.timeoutMs,
    ...contractPathSummary(request)
  };
}

export function validateAdapterRequestFile({ requestPath }) {
  if (typeof requestPath !== "string" || !/\S/.test(requestPath)) {
    throw adapterRequestValidationError("--request is required", "adapter-request-missing", "request");
  }
  const absoluteRequestPath = path.resolve(requestPath);
  const request = readRequestJson(absoluteRequestPath);
  try {
    assertAdapterRequestContract(request, absoluteRequestPath);
  } catch (error) {
    const wrapped = wrapAdapterRequestValidationError(error, "adapter-request-invalid", "request");
    wrapped.adapterRequestCorrelation = adapterRequestCorrelation(request);
    throw wrapped;
  }
  return requestSummary(request, absoluteRequestPath);
}

function describeError(error, args = {}, argv = []) {
  const requestPath = args.request || optionValueFromArgv(argv, "--request");
  const correlation = recordOrEmpty(error?.adapterRequestCorrelation);
  const validationKind = error?.adapterRequestValidationKind || "unknown";
  const rawMessage = error?.message || String(error);
  const messagePaths = [
    requestPath,
    correlation.inputPath,
    correlation.outputPath,
    correlation.outputDir,
    correlation.stageDir,
    correlation.scratchDir,
    correlation.chunkDir,
    correlation.adapterLogPath,
    correlation.adapterStdoutPath,
    correlation.adapterStderrPath,
    correlation.adapterConfigPath,
    correlation.adapterConfigDir
  ];
  return {
    ok: false,
    adapterRequestContractVersion: adapterRequestContractVersion(),
    errors: [
      {
        message: validationKind === "cli" ? rawMessage : publicValidationMessage(rawMessage, messagePaths),
        adapterRequestErrorCode: error?.adapterRequestErrorCode || "adapter-request-validation-error",
        adapterRequestValidationKind: validationKind,
        requestPath: requestPath ? path.resolve(requestPath) : null,
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
    console.log(JSON.stringify(referenceGeometryAdapterRequestContractMetadata(), null, 2));
    return 0;
  }
  const summary = validateAdapterRequestFile({ requestPath: args.request });
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`OK: adapter request ${summary.requestPath} matches ${summary.adapterRequestFingerprint}`);
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
      console.log(JSON.stringify(referenceGeometryAdapterRequestContractMetadata(), null, 2));
      process.exit(0);
    }
    const summary = validateAdapterRequestFile({ requestPath: args.request });
    if (args.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`OK: adapter request ${summary.requestPath} matches ${summary.adapterRequestFingerprint}`);
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
