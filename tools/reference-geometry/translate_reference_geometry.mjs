#!/usr/bin/env node
import crypto from "crypto";
import { spawnSync } from "child_process";
import fs from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../..");
const REFERENCE_GEOMETRY_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");
const POINT_CLOUD_CHUNK_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-point-cloud-chunk.schema.json");
const ADAPTER_REQUEST_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry-adapter-request.schema.json");
const ADAPTER_CONFIG_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry-adapters.schema.json");
const REFERENCE_TRANSLATION_CONTRACT_VERSION = "0.1.0";
export const REFERENCE_ADAPTER_OUTPUT_CONTRACT_VERSION = "0.1.0";
const REFERENCE_GEOMETRY_SCHEMA_NAME = schemaNameFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_NAME = schemaNameFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA, "point-cloud chunk");
const ADAPTER_REQUEST_SCHEMA_NAME = schemaNameFromSchemaFile(ADAPTER_REQUEST_SCHEMA, "adapter request");
const ADAPTER_CONFIG_SCHEMA_NAME = schemaNameFromSchemaFile(ADAPTER_CONFIG_SCHEMA, "adapter config");
const REFERENCE_GEOMETRY_SCHEMA_VERSION = schemaVersionFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_VERSION = schemaVersionFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA, "point-cloud chunk");
const ADAPTER_REQUEST_SCHEMA_VERSION = schemaVersionFromSchemaFile(ADAPTER_REQUEST_SCHEMA, "adapter request");
const ADAPTER_CONFIG_SCHEMA_VERSION = schemaVersionFromSchemaFile(ADAPTER_CONFIG_SCHEMA, "adapter config");
const REFERENCE_CHUNK_FILE_ENTRY_LIMIT = 20;
const REFERENCE_STRUCTURE_ENTRY_LIMIT = 20;
const REFERENCE_METADATA_MAX_JSON_LENGTH = 8192;
const REFERENCE_METADATA_MAX_DEPTH = 3;
const REFERENCE_METADATA_MAX_ENTRY_COUNT = 32;
const REFERENCE_METADATA_MAX_ARRAY_LENGTH = 128;
const REFERENCE_METADATA_MAX_STRING_LENGTH = 512;
const REFERENCE_METADATA_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const REFERENCE_METADATA_ALLOWED_SLASH_STRINGS = new Set([
  "tools/reference-geometry/translate_reference_geometry.mjs"
]);
const REFERENCE_METADATA_FORBIDDEN_NORMALIZED_KEYS = new Set([
  "absolutepath",
  "adapterlogpath",
  "adapterstderrpath",
  "adapterstdoutpath",
  "chunkpath",
  "filecontents",
  "filepath",
  "inputpath",
  "localpath",
  "outputpath",
  "payload",
  "raw",
  "rawcontents",
  "rawpayload",
  "requestpath",
  "resolvedpath",
  "scratchpath",
  "sourcedirectory",
  "sourcepath",
  "stagepath"
]);
const RESERVED_REFERENCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const REFERENCE_FORMAT_TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const SOURCE_FILE_NAME_MAX_LENGTH = 255;
const SOURCE_FILE_NAME_PATTERN_SOURCE = "^(?!\\.\\.?$)(?!\\s)(?!.*\\s$)[^\\\\/:?#\\u0000-\\u001f\\u007f]{1,255}$";
const DIAGNOSTIC_CODE_PATTERN_SOURCE = "^[a-z0-9][a-z0-9_.-]{0,127}$";
const DIAGNOSTIC_CODE_MAX_LENGTH = 128;
const DIAGNOSTIC_MESSAGE_MAX_LENGTH = 2048;
const DISPLAY_NAME_MAX_LENGTH = 255;
const DIAGNOSTIC_MESSAGE_FORBIDDEN_PATTERNS = Object.freeze([
  /[\u0000-\u001f\u007f]/,
  /[A-Za-z][A-Za-z0-9+.-]*:[\\/]/,
  /(?:^|[\s"'(])(?:\.{1,2}[\\/]|[\\/]{1,2}|[\\/])/,
  /%(?:2[fF]|5[cC])/,
  /[A-Za-z0-9_-][\\/][A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8}/
]);
const DISPLAY_NAME_FORBIDDEN_PATTERNS = Object.freeze([
  /[\u0000-\u001f\u007f]/,
  /\\/,
  /^[/]/,
  /[A-Za-z][A-Za-z0-9+.-]*:\//,
  /(?:^|[\s"'(])\.{1,2}\//,
  /\/{2}/,
  /%(?:2[fF]|5[cC])/,
  /[A-Za-z0-9_-]\/[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8}/
]);
const EXTERNAL_TRANSLATOR_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const ADAPTER_PLACEHOLDER_KEYS = Object.freeze([
  "input",
  "output",
  "outputDir",
  "stageDir",
  "scratchDir",
  "outputFileName",
  "outputFileStem",
  "chunkDir",
  "chunkPathPrefix",
  "adapterLogPath",
  "adapterStdoutPath",
  "adapterStderrPath",
  "outputMode",
  "request",
  "format",
  "requestedFormat",
  "adapterKey",
  "adapterRunId",
  "adapterConfigPath",
  "adapterConfigDir",
  "adapterConfigFileSizeBytes",
  "adapterConfigFileModifiedTime",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "sourceDirectory",
  "sourceFileName",
  "sourceFileStem",
  "sourceFileExtension",
  "sourceFileSizeBytes",
  "sourceFileModifiedTime",
  "sourceStatFingerprint",
  "pointCloudChunkSize",
  "timeoutMs",
  "adapterRequestSchemaPath",
  "referenceGeometrySchemaPath",
  "pointCloudChunkSchemaPath",
  "referenceGeometrySchemaVersion",
  "pointCloudChunkSchemaVersion",
  "adapterRequestSchemaVersion",
  "name",
  "units",
  "assetId"
]);
const ADAPTER_PLACEHOLDER_KEY_SET = new Set(ADAPTER_PLACEHOLDER_KEYS);
const CHECKED_IN_BRIDGE_SCALAR_PLACEHOLDER_KEYS = Object.freeze([
  "schema",
  "schemaVersion",
  "adapterRunId",
  "input",
  "sourceDirectory",
  "sourceFileName",
  "sourceFileStem",
  "sourceFileExtension",
  "sourceFileSizeBytes",
  "sourceFileModifiedTime",
  "sourceStatFingerprint",
  "output",
  "outputDir",
  "stageDir",
  "request",
  "scratchDir",
  "outputFileName",
  "outputFileStem",
  "chunkDir",
  "chunkPathPrefix",
  "adapterLogPath",
  "adapterStdoutPath",
  "adapterStderrPath",
  "outputMode",
  "format",
  "requestedFormat",
  "assetId",
  "name",
  "units",
  "pointCloudChunkSize",
  "timeoutMs",
  "adapterKey",
  "adapterConfigPath",
  "adapterConfigDir",
  "adapterConfigFileSizeBytes",
  "adapterConfigFileModifiedTime",
  "adapterConfigStatFingerprint",
  "adapterRegistryFingerprint",
  "adapterRegistryAdapterFingerprint",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint"
]);

function schemaNameFromSchemaFile(filePath, label) {
  const schemaName = readJson(filePath)?.properties?.schema?.const;
  if (typeof schemaName !== "string" || !schemaName) {
    throw new Error(`${label} schema is missing properties.schema.const`);
  }
  return schemaName;
}

function schemaVersionFromSchemaFile(filePath, label) {
  const schemaVersion = readJson(filePath)?.properties?.schemaVersion?.const;
  if (typeof schemaVersion !== "string" || !schemaVersion) {
    throw new Error(`${label} schema is missing properties.schemaVersion.const`);
  }
  return schemaVersion;
}

function referenceChunkPathPatternFromSchema() {
  const pattern = readJson(REFERENCE_GEOMETRY_SCHEMA)?.$defs?.chunk?.properties?.path?.pattern;
  if (typeof pattern !== "string" || !pattern) {
    throw new Error("reference geometry schema is missing $defs.chunk.properties.path.pattern");
  }
  return pattern;
}

function createAdapterRunId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

const DXF_ARC_SEGMENTS = 32;
const DXF_CIRCLE_SEGMENTS = 48;
const DXF_BULGE_SEGMENTS = 32;
const DXF_ELLIPSE_SEGMENTS = 64;
const DXF_SPLINE_SEGMENTS = 64;
const DXF_RASTER_REFERENCE_TYPES = new Set(["IMAGE", "WIPEOUT", "PDFUNDERLAY", "DGNUNDERLAY", "DWFUNDERLAY"]);
const DXF_ACIS_ENTITY_TYPES = new Set(["3DSOLID", "BODY", "REGION", "SURFACE", "PLANESURFACE", "EXTRUDEDSURFACE", "REVOLVEDSURFACE", "LOFTEDSURFACE", "SWEPTSURFACE"]);
const DXF_PROXY_ENTITY_TYPES = new Set(["ACAD_PROXY_ENTITY", "ACAD_PROXY_OBJECT"]);
const DXF_METADATA_RECORD_TYPES = new Set([
  "ACDBDICTIONARYWDFLT",
  "APPID",
  "BLOCK_RECORD",
  "DICTIONARY",
  "DICTIONARYVAR",
  "DIMSTYLE",
  "DGNDEFINITION",
  "DWFDEFINITION",
  "GROUP",
  "IDBUFFER",
  "IMAGEDEF",
  "IMAGEDEF_REACTOR",
  "LAYOUT",
  "LTYPE",
  "MATERIAL",
  "MLEADERSTYLE",
  "MLINESTYLE",
  "PDFDEFINITION",
  "PLOTSETTINGS",
  "RASTERVARIABLES",
  "STYLE",
  "UCS",
  "VIEW",
  "VIEWPORT",
  "VPORT",
  "WIPEOUTVARIABLES",
  "XRECORD"
]);
const STEP_CIRCLE_PROFILE_SEGMENTS = 48;
const STEP_ELLIPSE_SEGMENTS = 64;
const STEP_BSPLINE_SEGMENTS = 64;
const STEP_REVOLVED_PROFILE_SEGMENTS = 32;
const STEP_SWEPT_DISK_SEGMENTS = 16;
const IFC_CIRCLE_PROFILE_SEGMENTS = 48;
const IFC_ELLIPSE_SEGMENTS = 64;
const IFC_BSPLINE_SEGMENTS = 64;
const IFC_REVOLVED_PROFILE_SEGMENTS = 32;
const IFC_SWEPT_DISK_SEGMENTS = 16;
const IFC_INDEXED_POLYCURVE_ARC_SEGMENTS = 32;
const DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS = 120000;
const DEFAULT_EXTERNAL_ADAPTER_STREAM_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const DEFAULT_POINT_CLOUD_CHUNK_SIZE = 50000;
const DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX = "chunks/";
const DEFAULT_REFERENCE_UNITS = "mm";
const ADAPTER_OUTPUT_ERROR_LIMIT = 4000;
const ADAPTER_SCRATCH_FILE_ENTRY_LIMIT = 20;
const require = createRequire(import.meta.url);
const { validateFile, formatError } = require("../../scripts/validate_json_schema.js");

const FORMAT_REGISTRY = {
  dxf: {
    state: "implemented",
    adapterCapable: true,
    description: "ASCII DXF linework and lightweight face import"
  },
  json: {
    state: "implemented",
    adapterCapable: false,
    description: "Validated canonical bobercad-reference-geometry JSON passthrough"
  },
  dwg: {
    state: "external-adapter-required",
    adapterCapable: true,
    description: "Use an external DWG reader or DWG-to-DXF bridge, then emit canonical reference geometry"
  },
  step: {
    state: "implemented",
    adapterCapable: true,
    description: "Initial ASCII STEP faceted poly-loop/edge-loop plus extruded/revolved/tapered/swept-disk mesh import; use an external adapter for full CAD tessellation"
  },
  stp: {
    state: "implemented",
    aliasFor: "step",
    adapterCapable: true,
    description: "Alias for STEP"
  },
  p21: {
    state: "implemented",
    aliasFor: "step",
    adapterCapable: true,
    description: "Alias for STEP Part 21"
  },
  stpnc: {
    state: "implemented",
    aliasFor: "step",
    adapterCapable: true,
    description: "Alias for STEP NC / STEP Part 21"
  },
  ifc: {
    state: "implemented",
    adapterCapable: true,
    description: "Initial IFC faceted poly-loop/edge-loop BREP plus extruded/revolved/tapered/swept-disk mesh import with local product placement; use an external adapter for full IFC geometry"
  },
  ifcxml: {
    state: "external-adapter-required",
    aliasFor: "ifc",
    adapterCapable: true,
    description: "Alias for IFC XML; use an external adapter for XML-specific parsing"
  },
  ifczip: {
    state: "external-adapter-required",
    aliasFor: "ifc",
    adapterCapable: true,
    description: "Alias for IFC ZIP; use an external adapter for compressed IFC payloads"
  },
  e57: {
    state: "external-adapter-required",
    adapterCapable: true,
    description: "Use an external E57 point-cloud adapter, then emit canonical point-cloud chunks"
  },
  e57pointcloud: {
    state: "external-adapter-required",
    aliasFor: "e57",
    fileExtension: false,
    adapterCapable: true,
    description: "Alias for E57 point-cloud import"
  },
  e57pc: {
    state: "external-adapter-required",
    aliasFor: "e57",
    fileExtension: false,
    adapterCapable: true,
    description: "Alias for E57 point-cloud import"
  }
};
const REFERENCE_TARGET_FORMAT_TOKENS = ["dxf", "dwg", "step", "ifc", "e57pointcloud"];
const REFERENCE_ADAPTER_REQUEST_CANONICAL_FORMAT_TOKENS = ["dxf", "dwg", "step", "ifc", "e57"];

function isAdapterCapableFormat(format) {
  return FORMAT_REGISTRY[format]?.adapterCapable === true;
}

const ACI_COLORS = {
  1: "#ff0000",
  2: "#ffff00",
  3: "#00ff00",
  4: "#00ffff",
  5: "#0000ff",
  6: "#ff00ff",
  7: "#f8fafc",
  8: "#64748b",
  9: "#94a3b8"
};

function usage() {
  return [
    "Usage:",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --input <source> --output <target.json> [--format dxf] [--name \"Name\"]",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --input <source> --output <target.json> --format step --adapter-config <adapters.json>",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --input <source> --output <target.json> --format e57 --write-adapter-request <request.json>",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --input <source> --output <target.json> --format e57 --plan-only --adapter-config <adapters.json>",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --input <reference.json> --validate-only [--json]",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --describe-source --input <source> [--format dxf]",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --list-translation-discovery",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --list-formats",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --list-format-groups",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --adapter-config <adapters.json> --list-adapters",
    "  node tools/reference-geometry/translate_reference_geometry.mjs --adapter-config <adapters.json> --check-adapters [--format dwg] [--adapter <name>]",
    "  Add --json to print translation results and failures as machine-readable JSON.",
    "  Add --adapter-timeout-ms <positive-integer-ms> to override the selected external adapter timeout for a translation run or generated adapter request.",
    "  Add --keep-stage while debugging external adapter runs to preserve staging files after success or failure; not valid with --plan-only or --write-adapter-request.",
    "  Add --keep-stage-on-error while debugging external adapter runs to preserve failed staging files; not valid with --plan-only or --write-adapter-request.",
    "",
    "Implemented now:",
    "  dxf, step/stp/p21 faceted and swept-area mesh, ifc faceted BREP/swept-area solids, json",
    "",
    "Adapter-capable formats:",
    "  dxf, dwg, step/stp/p21/stpnc, ifc/ifcxml/ifczip, e57/e57pointcloud/e57pc",
    "",
    "External adapters must write canonical bobercad-reference-geometry JSON to the provided output path, or set outputMode: \"stdout\" and write that JSON to stdout.",
    "Use --write-adapter-request to generate and validate the staged adapter request JSON without launching an adapter.",
    "Passing --adapter-config forces the configured external adapter, including for built-in formats such as DXF, STEP, or IFC.",
    "Built-in translators detect supported source length units where the format declares them; --units mm|m|in|ft overrides detection.",
    "Canonical JSON input is validated and copied with referenced point-cloud chunks.",
    "Inline point-cloud payloads above --point-cloud-chunk-size <positive-integer-count> are moved to validated chunk sidecars."
  ].join("\n");
}

function cliOptionError(message, code) {
  const error = new Error(message);
  error.adapterErrorCode = code;
  return error;
}

function missingOptionValueError(optionName) {
  return cliOptionError(`${optionName} requires a value`, "cli-option-value-missing");
}

function requiredOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (value === undefined || String(value).startsWith("--")) {
    throw missingOptionValueError(optionName);
  }
  return value;
}

function optionEqualsValue(arg, prefix, optionName) {
  const value = arg.slice(prefix.length);
  if (!value) throw missingOptionValueError(optionName);
  return value;
}

function unknownOptionError(arg) {
  return cliOptionError(`Unknown argument: ${arg}`, "cli-option-unknown");
}

export function normalizedReferenceFormatToken(value, label = "--format") {
  const token = String(value ?? "").trim().toLowerCase();
  if (!REFERENCE_FORMAT_TOKEN_PATTERN.test(token)) {
    throw cliOptionError(`${label} must be a source format token such as dxf, dwg, step, ifc, e57, or e57pointcloud; do not pass paths, MIME strings, leading dots, or whitespace`, "reference-format-invalid");
  }
  return token;
}

function optionalReferenceFormatToken(value, label = "--format") {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return normalizedReferenceFormatToken(value, label);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--validate-only") args.validateOnly = true;
    else if (arg === "--plan-only") args.planOnly = true;
    else if (arg.startsWith("--plan-only=")) args.planOnly = optionEqualsValue(arg, "--plan-only=", "--plan-only");
    else if (arg === "--describe-source") args.describeSource = true;
    else if (arg === "--list-translation-discovery") args.listTranslationDiscovery = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--list-formats") args.listFormats = true;
    else if (arg === "--list-format-groups") args.listFormatGroups = true;
    else if (arg === "--list-adapters") args.listAdapters = true;
    else if (arg === "--check-adapters") args.checkAdapters = true;
    else if (arg === "--input" || arg === "-i") args.input = requiredOptionValue(argv, index++, "--input");
    else if (arg.startsWith("--input=")) args.input = optionEqualsValue(arg, "--input=", "--input");
    else if (arg === "--output" || arg === "-o") args.output = requiredOptionValue(argv, index++, "--output");
    else if (arg.startsWith("--output=")) args.output = optionEqualsValue(arg, "--output=", "--output");
    else if (arg === "--format" || arg === "-f") args.format = normalizedReferenceFormatToken(requiredOptionValue(argv, index++, "--format"));
    else if (arg.startsWith("--format=")) args.format = normalizedReferenceFormatToken(optionEqualsValue(arg, "--format=", "--format"));
    else if (arg === "--name") args.name = requiredOptionValue(argv, index++, "--name");
    else if (arg.startsWith("--name=")) args.name = optionEqualsValue(arg, "--name=", "--name");
    else if (arg === "--asset-id") args.assetId = requiredOptionValue(argv, index++, "--asset-id");
    else if (arg.startsWith("--asset-id=")) args.assetId = optionEqualsValue(arg, "--asset-id=", "--asset-id");
    else if (arg === "--units") args.units = requiredOptionValue(argv, index++, "--units");
    else if (arg.startsWith("--units=")) args.units = optionEqualsValue(arg, "--units=", "--units");
    else if (arg === "--adapter-config") args.adapterConfig = requiredOptionValue(argv, index++, "--adapter-config");
    else if (arg.startsWith("--adapter-config=")) args.adapterConfig = optionEqualsValue(arg, "--adapter-config=", "--adapter-config");
    else if (arg === "--adapter") args.adapter = requiredOptionValue(argv, index++, "--adapter");
    else if (arg.startsWith("--adapter=")) args.adapter = optionEqualsValue(arg, "--adapter=", "--adapter");
    else if (arg === "--adapter-timeout-ms") args.adapterTimeoutMs = Number(requiredOptionValue(argv, index++, "--adapter-timeout-ms"));
    else if (arg.startsWith("--adapter-timeout-ms=")) args.adapterTimeoutMs = Number(optionEqualsValue(arg, "--adapter-timeout-ms=", "--adapter-timeout-ms"));
    else if (arg === "--keep-stage") args.keepStage = true;
    else if (arg.startsWith("--keep-stage=")) args.keepStage = optionEqualsValue(arg, "--keep-stage=", "--keep-stage");
    else if (arg === "--keep-stage-on-error") args.keepStageOnError = true;
    else if (arg.startsWith("--keep-stage-on-error=")) args.keepStageOnError = optionEqualsValue(arg, "--keep-stage-on-error=", "--keep-stage-on-error");
    else if (arg === "--write-adapter-request") args.writeAdapterRequest = requiredOptionValue(argv, index++, "--write-adapter-request");
    else if (arg.startsWith("--write-adapter-request=")) args.writeAdapterRequest = optionEqualsValue(arg, "--write-adapter-request=", "--write-adapter-request");
    else if (arg === "--point-cloud-chunk-size") args.pointCloudChunkSize = Number(requiredOptionValue(argv, index++, "--point-cloud-chunk-size"));
    else if (arg.startsWith("--point-cloud-chunk-size=")) args.pointCloudChunkSize = Number(optionEqualsValue(arg, "--point-cloud-chunk-size=", "--point-cloud-chunk-size"));
    else throw unknownOptionError(arg);
  }
  return args;
}

function normalizeFormat(formatOrPath) {
  const raw = formatToken(formatOrPath);
  if (raw === "stp" || raw === "p21" || raw === "stpnc") return "step";
  if (raw === "ifcxml" || raw === "ifczip") return "ifc";
  if (raw === "e57pointcloud" || raw === "e57pc") return "e57";
  return raw;
}

function formatToken(formatOrPath) {
  return String(formatOrPath || "").toLowerCase().replace(/^\./, "");
}

function rawFormatFromPath(filePath) {
  return formatToken(path.extname(filePath));
}

function requestedFormatToken(format, inputPath) {
  if (typeof format === "string" && format.trim()) return normalizedReferenceFormatToken(format);
  return rawFormatFromPath(inputPath);
}

function formatFromPath(filePath) {
  return normalizeFormat(path.extname(filePath));
}

function checksum(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sanitizeId(value, fallback = "reference") {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  if (isReferenceId(id)) return id;
  const fallbackId = String(fallback || "reference")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  return isReferenceId(fallbackId) ? fallbackId : "reference";
}

function isReferenceId(value) {
  return typeof value === "string" && REFERENCE_ID_PATTERN.test(value) && !RESERVED_REFERENCE_IDS.has(value);
}

function normalizedExternalSourceTranslator(value, adapterKey) {
  if (typeof value === "string") {
    const token = value.trim();
    if (token === value && token.startsWith("external:")) {
      const externalToken = token.slice("external:".length);
      if (isReferenceId(externalToken)) return token;
    } else if (token === value && isReferenceId(token)) {
      return token;
    }
  }
  return `external:${sanitizeId(adapterKey, "external_adapter")}`;
}

function normalizedExternalSourceTranslatorVersion(value) {
  if (typeof value === "string") {
    const token = value.trim();
    if (token === value && EXTERNAL_TRANSLATOR_VERSION_PATTERN.test(token)) return token;
  }
  return "external";
}

export function normalizedExplicitReferenceAssetId(value, label = "--asset-id") {
  if (value === null || value === undefined) return null;
  const id = String(value);
  if (!isReferenceId(id)) {
    throw adapterConfigurationError(`${label} must use a safe canonical reference id: start with a letter or digit, use only letters, digits, "_" or "-", and avoid reserved keys`, {
      code: "reference-asset-id-invalid"
    });
  }
  return id;
}

function safeCanonicalDisplayName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= DISPLAY_NAME_MAX_LENGTH
    && value.trim() === value
    && DISPLAY_NAME_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

export function normalizedExplicitReferenceName(value, label = "--name") {
  if (value === null || value === undefined) return null;
  const name = String(value).trim();
  if (!safeCanonicalDisplayName(name)) {
    throw adapterConfigurationError(`${label} must be a bounded path-free display name`, {
      code: "reference-name-invalid"
    });
  }
  return name;
}

function sourceReferenceId(value, usedIds, fallback = "reference") {
  const id = String(value || "").trim();
  if (isReferenceId(id) && !usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }
  return uniqueSanitizedId(id, usedIds, fallback);
}

function assetIdForInput(inputPath, assetId, fallback = "reference") {
  return normalizedExplicitReferenceAssetId(assetId) || sanitizeId(path.basename(inputPath, path.extname(inputPath)), fallback);
}

function uniqueSanitizedId(value, usedIds, fallback = "reference") {
  const base = sanitizeId(value, fallback);
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  for (let index = 2; index < 100000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Unable to create unique id from ${base}`);
}

function schemaRefForOutput(outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  return path.relative(path.dirname(absoluteOutput), REFERENCE_GEOMETRY_SCHEMA).replaceAll(path.sep, "/");
}

function chunkSchemaRefForOutput(outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  return path.relative(path.dirname(absoluteOutput), POINT_CLOUD_CHUNK_SCHEMA).replaceAll(path.sep, "/");
}

function adapterRequestSchemaRefForRequest(requestPath) {
  const absoluteRequest = path.resolve(requestPath);
  return path.relative(path.dirname(absoluteRequest), ADAPTER_REQUEST_SCHEMA).replaceAll(path.sep, "/");
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function vec3(x = 0, y = 0, z = 0) {
  return [Number(x) || 0, Number(y) || 0, Number(z) || 0];
}

function samePoint(a, b) {
  return Array.isArray(a) && Array.isArray(b) && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] - b[2]) < 1e-9;
}

function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecMul(a, scalar) {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function transformBasisIsDegenerate(axisX, axisY, axisZ) {
  if (!finiteVec3(axisX) || !finiteVec3(axisY) || !finiteVec3(axisZ)) return true;
  return Math.abs(vecDot(vecCross(axisX, axisY), axisZ)) <= 1e-9;
}

function vecUnit(a, fallback = [0, 0, 1]) {
  const length = vecLength(a);
  return length > 1e-9 ? vecMul(a, 1 / length) : [...fallback];
}

function rotatePointAroundAxis(point, origin, axis, angle) {
  const unitAxis = vecUnit(axis, [0, 0, 1]);
  const relative = vecSub(point, origin);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return vecAdd(
    origin,
    vecAdd(
      vecAdd(vecMul(relative, cos), vecMul(vecCross(unitAxis, relative), sin)),
      vecMul(unitAxis, vecDot(unitAxis, relative) * (1 - cos))
    )
  );
}

function boundsFor(points) {
  const clean = points.filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
  if (!clean.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  const min = [...clean[0]];
  const max = [...clean[0]];
  for (const point of clean.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

function unionBounds(boundsList) {
  const validBounds = boundsList.filter((bounds) => finiteVec3(bounds?.min) && finiteVec3(bounds?.max));
  if (!validBounds.length) return null;
  const min = [...validBounds[0].min];
  const max = [...validBounds[0].max];
  for (const bounds of validBounds.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bounds.min[axis]);
      max[axis] = Math.max(max[axis], bounds.max[axis]);
    }
  }
  return { min, max };
}

function completeUnionBounds(boundsList) {
  const values = boundsList || [];
  if (!values.length) return null;
  if (values.some((bounds) => !finiteVec3(bounds?.min) || !finiteVec3(bounds?.max))) return null;
  return unionBounds(values);
}

function parseDxfPairs(text) {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const pairs = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    const code = Number(lines[index].trim());
    if (!Number.isFinite(code)) continue;
    if (code === 999) continue;
    pairs.push({
      code,
      value: lines[index + 1].trim()
    });
  }
  return pairs;
}

function assertSupportedDxfAsciiSource(text, pairs) {
  const sourceText = String(text || "").replace(/^\uFEFF/, "");
  if (/^AutoCAD Binary DXF/i.test(sourceText)) {
    throw new Error("Binary DXF input is not supported by the built-in reference geometry translator; use an external adapter or convert the source to ASCII DXF first.");
  }
  if (!pairs.length) {
    throw new Error("DXF input does not contain ASCII group-code/value records; use an external adapter or verify the source file.");
  }
  if (!pairs.some((pair) => pair.code === 0 && dxfRecordType(pair) === "SECTION")) {
    throw new Error("DXF input does not contain an ASCII SECTION record; use an external adapter or verify the source file.");
  }
}

function pairNumber(pair, fallback = 0) {
  const raw = String(pair?.value ?? "").trim();
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  const value = Number(raw.replace(/[dD]/g, "E"));
  return Number.isFinite(value) ? value : fallback;
}

function entityEnd(pairs, startIndex) {
  let index = startIndex + 1;
  while (index < pairs.length && pairs[index].code !== 0) index += 1;
  return index;
}

function firstPairValue(entityPairs, code, fallback = null) {
  return entityPairs.find((pair) => pair.code === code)?.value ?? fallback;
}

function firstPairNumber(entityPairs, code, fallback = 0) {
  const pair = entityPairs.find((item) => item.code === code);
  return pair ? pairNumber(pair, fallback) : fallback;
}

function finitePairNumberByCode(entityPairs, code) {
  const pair = entityPairs.find((item) => item.code === code);
  if (!pair) return null;
  const value = pairNumber(pair, NaN);
  return Number.isFinite(value) ? value : null;
}

function dxfRequiredPoint(entityPairs, xCode, yCode, zCode, defaultZ = 0) {
  const x = finitePairNumberByCode(entityPairs, xCode);
  const y = finitePairNumberByCode(entityPairs, yCode);
  const z = finitePairNumberByCode(entityPairs, zCode);
  if (x === null || y === null || (entityPairs.some((pair) => pair.code === zCode) && z === null)) return null;
  return [x, y, z ?? defaultZ];
}

function dxfOptionalPoint(entityPairs, xCode, yCode, zCode, defaultZ = 0) {
  const present = entityPairs.some((pair) => pair.code === xCode || pair.code === yCode || pair.code === zCode);
  if (!present) return { point: null, invalid: false };
  const point = dxfRequiredPoint(entityPairs, xCode, yCode, zCode, defaultZ);
  return { point, invalid: !point };
}

function dxfNumberParameter(entityPairs, code, fallback = 0) {
  const pair = entityPairs.find((item) => item.code === code);
  if (!pair) return { value: fallback, invalid: false };
  const value = pairNumber(pair, NaN);
  return { value: Number.isFinite(value) ? value : fallback, invalid: !Number.isFinite(value) };
}

function dxfExtrusionParameter(entityPairs) {
  const x = dxfNumberParameter(entityPairs, 210, 0);
  const y = dxfNumberParameter(entityPairs, 220, 0);
  const z = dxfNumberParameter(entityPairs, 230, 1);
  const extrusion = vec3(x.value, y.value, z.value);
  const hasExplicitExtrusion = entityPairs.some((pair) => pair.code === 210 || pair.code === 220 || pair.code === 230);
  const invalidNumberCount = (x.invalid ? 1 : 0) + (y.invalid ? 1 : 0) + (z.invalid ? 1 : 0);
  const invalidZeroNormalCount = hasExplicitExtrusion && vecLength(extrusion) <= 1e-9 ? 1 : 0;
  return {
    extrusion,
    invalidParameterCount: invalidNumberCount + invalidZeroNormalCount
  };
}

function layerName(entityPairs) {
  return firstPairValue(entityPairs, 8, "0") || "0";
}

function addDiagnostic(diagnostics, severity, code, message, objectId = undefined, objectRefs = undefined) {
  diagnostics.push({
    severity,
    code,
    message,
    ...(objectId ? { objectId } : {}),
    ...(Array.isArray(objectRefs) && objectRefs.length ? { objectRefs } : {})
  });
}

function addDiagnosticOnce(diagnostics, severity, code, message, objectId = undefined, objectRefs = undefined) {
  if (diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.message === message)) return;
  addDiagnostic(diagnostics, severity, code, message, objectId, objectRefs);
}

function normalizeCanonicalUnits(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(normalized)) return "mm";
  if (["m", "meter", "meters", "metre", "metres"].includes(normalized)) return "m";
  if (["in", "inch", "inches"].includes(normalized)) return "in";
  if (["ft", "foot", "feet"].includes(normalized)) return "ft";
  return normalized || null;
}

function canonicalUnitsFromLengthLabel(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!normalized) return null;
  if (["mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(normalized)) return "mm";
  if (["m", "meter", "meters", "metre", "metres"].includes(normalized)) return "m";
  if (["in", "inch", "inches"].includes(normalized)) return "in";
  if (["ft", "foot", "feet"].includes(normalized)) return "ft";
  return null;
}

function canonicalUnitsFromSiMetrePrefix(prefix) {
  const normalized = String(prefix || "").trim().replace(/[.$]/g, "").toUpperCase();
  if (!normalized) return "m";
  if (normalized === "MILLI") return "mm";
  return null;
}

function canonicalUnitsFromMetreConversionFactor(value) {
  const factor = Number(value);
  if (!Number.isFinite(factor)) return null;
  const tolerance = 1e-9;
  const candidates = [
    ["m", 1],
    ["mm", 0.001],
    ["in", 0.0254],
    ["ft", 0.3048]
  ];
  for (const [units, expected] of candidates) {
    if (Math.abs(factor - expected) <= Math.max(tolerance, Math.abs(expected) * tolerance)) return units;
  }
  return null;
}

function conversionMeasureFactor(entity) {
  if (!entity || !/^(MEASURE_WITH_UNIT|IFCMEASUREWITHUNIT)$/i.test(entity.type || "")) return null;
  const args = splitStepArguments(entity.args);
  const values = stepNumberList(args[0] || entity.args);
  return values.length ? values[0] : null;
}

function stepStringValue(raw) {
  const match = String(raw || "").match(/'((?:''|[^'])*)'/);
  return match ? match[1].replace(/''/g, "'") : null;
}

function reportUnsupportedDeclaredUnits(diagnostics, code, sourceLabel, declared) {
  addDiagnostic(
    diagnostics,
    "warning",
    code,
    `${sourceLabel} declares ${declared} units, which are not representable in the canonical unit set; using fallback units.`
  );
}

function resolveDetectedUnits({ explicitUnits, detectedUnits, diagnostics, codePrefix, sourceLabel }) {
  const explicit = normalizeCanonicalUnits(explicitUnits);
  if (explicit) {
    if (detectedUnits && detectedUnits !== explicit) {
      addDiagnostic(
        diagnostics,
        "info",
        `${codePrefix}-units-overridden`,
        `${sourceLabel} declares ${detectedUnits} units; using explicit --units ${explicit}.`
      );
    }
    return explicit;
  }
  if (detectedUnits) {
    addDiagnostic(diagnostics, "info", `${codePrefix}-units-detected`, `${sourceLabel} declares ${detectedUnits} units.`);
    return detectedUnits;
  }
  return DEFAULT_REFERENCE_UNITS;
}

function dxfRecordType(pair) {
  return String(pair?.value || "").toUpperCase();
}

const DXF_INSUNITS_TO_CANONICAL_UNITS = new Map([
  [1, "in"],
  [2, "ft"],
  [4, "mm"],
  [6, "m"]
]);

function detectDxfUnits(pairs, diagnostics) {
  const unitVariableIndex = pairs.findIndex((pair) => pair.code === 9 && String(pair.value || "").toUpperCase() === "$INSUNITS");
  if (unitVariableIndex < 0) return null;
  const unitPair = pairs.slice(unitVariableIndex + 1, unitVariableIndex + 5).find((pair) => pair.code === 70 || pair.code === 280);
  const unitCode = Number(unitPair?.value);
  if (!Number.isInteger(unitCode) || unitCode === 0) return null;
  const units = DXF_INSUNITS_TO_CANONICAL_UNITS.get(unitCode);
  if (units) return units;
  addDiagnostic(
    diagnostics,
    "warning",
    "dxf-units-unsupported",
    `DXF $INSUNITS code ${unitCode} is not representable in the canonical unit set; using fallback units.`
  );
  return null;
}

function effectiveLayerName(entityPairs, context = {}) {
  const layer = layerName(entityPairs);
  return layer === "0" && context.insertLayer ? context.insertLayer : layer;
}

function dxfTrueColor(entityPairs) {
  const pair = entityPairs.find((item) => item.code === 420);
  const value = Number(pair?.value);
  if (!Number.isInteger(value) || value < 0) return null;
  const rgb = value % 0x1000000;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function dxfOpacity(entityPairs) {
  const pair = entityPairs.find((item) => item.code === 440);
  if (!pair) return null;
  const value = Number(pair.value);
  if (!Number.isInteger(value) || value === 0) return null;
  const type = (value >>> 24) & 0xff;
  if (type === 1) return "byblock";
  if (type !== 2) return null;
  return canonicalOpacity((value & 0xff) / 255);
}

function effectiveLayerColor(entityPairs, layerColors, layer, context = {}) {
  const trueColor = dxfTrueColor(entityPairs);
  if (trueColor) return trueColor;
  const colorPair = entityPairs.find((item) => item.code === 62);
  if (colorPair) {
    const rawEntityColor = Math.trunc(pairNumber(colorPair, 256));
    if (rawEntityColor === 0) return context.insertColor || layerColors.get(layer) || "#2563eb";
    const entityColor = Math.abs(rawEntityColor);
    if (ACI_COLORS[entityColor]) return ACI_COLORS[entityColor];
  }
  return layerColors.get(layer) || context.insertColor || "#2563eb";
}

function effectiveLayerOpacity(entityPairs, layerOpacities, layer, context = {}) {
  const opacity = dxfOpacity(entityPairs);
  if (opacity === "byblock") return Number.isFinite(context.insertOpacity) ? context.insertOpacity : null;
  if (Number.isFinite(opacity)) return opacity;
  return layerOpacities.get(layer) ?? null;
}

function collectDxfLayers(pairs) {
  const layerColors = new Map();
  const layerOpacities = new Map();
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index].code !== 0 || dxfRecordType(pairs[index]) !== "LAYER") continue;
    const end = entityEnd(pairs, index);
    const data = pairs.slice(index + 1, end);
    const name = firstPairValue(data, 2, null);
    const trueColor = dxfTrueColor(data);
    const opacity = dxfOpacity(data);
    const color = Math.abs(Math.trunc(firstPairNumber(data, 62, 0)));
    if (name && trueColor) layerColors.set(name, trueColor);
    else if (name && ACI_COLORS[color]) layerColors.set(name, ACI_COLORS[color]);
    if (name && Number.isFinite(opacity)) layerOpacities.set(name, opacity);
    index = end - 1;
  }
  return { layerColors, layerOpacities };
}

function collectDxfBlocks(pairs, diagnostics = []) {
  const blocks = new Map();
  const skipStarts = new Map();
  const invalidBlocks = new Set();
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index].code !== 0 || dxfRecordType(pairs[index]) !== "BLOCK") continue;
    const headerEnd = entityEnd(pairs, index);
    const headerPairs = pairs.slice(index + 1, headerEnd);
    const name = firstPairValue(headerPairs, 2, null);
    let endBlockStart = headerEnd;
    let endBlockEnd = headerEnd;
    while (endBlockStart < pairs.length) {
      if (pairs[endBlockStart].code === 0 && dxfRecordType(pairs[endBlockStart]) === "ENDBLK") {
        endBlockEnd = entityEnd(pairs, endBlockStart);
        break;
      }
      endBlockStart += 1;
    }
    if (!endBlockEnd || endBlockEnd <= headerEnd) endBlockEnd = endBlockStart;
    if (name && !blocks.has(name) && !invalidBlocks.has(name)) {
      const base = dxfRequiredPoint(headerPairs, 10, 20, 30);
      if (!base) {
        invalidBlocks.add(name);
        addDiagnostic(diagnostics, "info", "dxf-block-invalid-base-skipped", `Skipped DXF BLOCK ${name}; required block base point coordinates were missing or invalid.`);
      } else {
        blocks.set(name, {
          name,
          base: vec3(...base),
          pairs: pairs.slice(headerEnd, endBlockStart)
        });
      }
    }
    skipStarts.set(index, endBlockEnd);
    index = endBlockEnd - 1;
  }
  return { blocks, skipStarts, invalidBlocks };
}

function dxfScale(entityPairs, code) {
  const pair = entityPairs.find((item) => item.code === code);
  return pair ? pairNumber(pair, 1) : 1;
}

function dxfScaleParameter(entityPairs, code) {
  return dxfNumberParameter(entityPairs, code, 1);
}

function identityTransform(point) {
  return point;
}

function dxfOcsPoint(point, extrusion) {
  const axisZ = vecUnit(extrusion, [0, 0, 1]);
  const arbitraryAxis = Math.abs(axisZ[0]) < 1 / 64 && Math.abs(axisZ[1]) < 1 / 64
    ? [0, 1, 0]
    : [0, 0, 1];
  const axisX = vecUnit(vecCross(arbitraryAxis, axisZ), [1, 0, 0]);
  const axisY = vecUnit(vecCross(axisZ, axisX), [0, 1, 0]);
  return vecAdd(vecAdd(vecMul(axisX, point[0]), vecMul(axisY, point[1])), vecMul(axisZ, point[2]));
}

function dxfInsertArrayItems(entityPairs) {
  const columnCountParameter = dxfNumberParameter(entityPairs, 70, 1);
  const rowCountParameter = dxfNumberParameter(entityPairs, 71, 1);
  const columnSpacingParameter = dxfNumberParameter(entityPairs, 44, 0);
  const rowSpacingParameter = dxfNumberParameter(entityPairs, 45, 0);
  const invalidParameterCount = (columnCountParameter.invalid ? 1 : 0)
    + (rowCountParameter.invalid ? 1 : 0)
    + (columnSpacingParameter.invalid ? 1 : 0)
    + (rowSpacingParameter.invalid ? 1 : 0);
  const columnCount = Math.max(1, Math.trunc(columnCountParameter.value));
  const rowCount = Math.max(1, Math.trunc(rowCountParameter.value));
  const columnSpacing = columnSpacingParameter.value;
  const rowSpacing = rowSpacingParameter.value;
  const items = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      items.push([column * columnSpacing, row * rowSpacing, 0]);
    }
  }
  return { items, invalidParameterCount };
}

function dxfInsertTransform(entityPairs, blockBase, parentTransform = identityTransform, arrayOffset = [0, 0, 0]) {
  const insert = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const extrusionX = dxfNumberParameter(entityPairs, 210, 0);
  const extrusionY = dxfNumberParameter(entityPairs, 220, 0);
  const extrusionZ = dxfNumberParameter(entityPairs, 230, 1);
  const scaleX = dxfScaleParameter(entityPairs, 41);
  const scaleY = dxfScaleParameter(entityPairs, 42);
  const scaleZ = dxfScaleParameter(entityPairs, 43);
  const angleParameter = dxfNumberParameter(entityPairs, 50, 0);
  const invalidParameterCount = (insert ? 0 : 1)
    + (extrusionX.invalid ? 1 : 0)
    + (extrusionY.invalid ? 1 : 0)
    + (extrusionZ.invalid ? 1 : 0)
    + (scaleX.invalid ? 1 : 0)
    + (scaleY.invalid ? 1 : 0)
    + (scaleZ.invalid ? 1 : 0)
    + (angleParameter.invalid ? 1 : 0);
  if (invalidParameterCount > 0) return { transform: parentTransform, invalidParameterCount };
  const extrusion = vec3(extrusionX.value, extrusionY.value, extrusionZ.value);
  const scale = [scaleX.value, scaleY.value, scaleZ.value];
  const angle = angleParameter.value * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { transform: (point) => {
    const x = (point[0] - blockBase[0]) * scale[0] + arrayOffset[0];
    const y = (point[1] - blockBase[1]) * scale[1] + arrayOffset[1];
    const z = (point[2] - blockBase[2]) * scale[2];
    return parentTransform(dxfOcsPoint([
      insert[0] + x * cos - y * sin,
      insert[1] + x * sin + y * cos,
      insert[2] + z + arrayOffset[2]
    ], extrusion));
  }, invalidParameterCount: 0 };
}

function transformDxfPoints(points, transform = identityTransform) {
  return points.map((point) => transform(point));
}

function ensureMapEntry(map, key, create) {
  if (!map.has(key)) map.set(key, create());
  return map.get(key);
}

function dxfGeometrySetKey(layer, color, opacity) {
  return geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity);
}

function canonicalOpacity(value) {
  if (value === null || value === undefined || value === "") return null;
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return null;
  return Math.max(0, Math.min(1, opacity));
}

function geometryAppearanceKey(color, opacity) {
  return `${color || ""}\u0000${Number.isFinite(opacity) ? opacity : ""}`;
}

function ensureLineSet(lineSets, layer, color) {
  return ensureMapEntry(lineSets, layer, () => ({
    layer,
    vertices: [],
    lineSegments: [],
    color
  }));
}

function ensureAppearanceLineSet(lineSets, layer, color, opacity) {
  return ensureMapEntry(lineSets, geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity), () => ({
    layer,
    vertices: [],
    lineSegments: [],
    color,
    opacity
  }));
}

function ensureMeshSet(meshSets, layer, color) {
  return ensureMapEntry(meshSets, layer, () => ({
    layer,
    vertices: [],
    faces: [],
    color
  }));
}

function ensurePointSet(pointSets, layer, color) {
  return ensureMapEntry(pointSets, layer, () => ({
    layer,
    points: [],
    color
  }));
}

function ensureDxfLineSet(lineSets, layer, color, opacity) {
  return ensureMapEntry(lineSets, dxfGeometrySetKey(layer, color, opacity), () => ({
    layer,
    vertices: [],
    lineSegments: [],
    color,
    opacity
  }));
}

function ensureDxfMeshSet(meshSets, layer, color, opacity) {
  return ensureMapEntry(meshSets, dxfGeometrySetKey(layer, color, opacity), () => ({
    layer,
    vertices: [],
    faces: [],
    color,
    opacity
  }));
}

function ensureDxfPointSet(pointSets, layer, color, opacity) {
  return ensureMapEntry(pointSets, dxfGeometrySetKey(layer, color, opacity), () => ({
    layer,
    points: [],
    color,
    opacity
  }));
}

function sortedDxfGeometrySets(map) {
  return [...map.values()].sort((left, right) => (
    String(left.layer).localeCompare(String(right.layer))
    || String(left.color || "").localeCompare(String(right.color || ""))
    || String(Number.isFinite(left.opacity) ? left.opacity : "").localeCompare(String(Number.isFinite(right.opacity) ? right.opacity : ""))
  ));
}

function sortedLineSetsForLayer(map, layer) {
  return [...map.values()]
    .filter((lineSet) => lineSet.layer === layer && lineSet.lineSegments.length)
    .sort((left, right) => (
      String(left.color || "").localeCompare(String(right.color || ""))
      || String(Number.isFinite(left.opacity) ? left.opacity : "").localeCompare(String(Number.isFinite(right.opacity) ? right.opacity : ""))
    ));
}

function firstDxfGeometryColor(layer, ...maps) {
  for (const map of maps) {
    const set = sortedDxfGeometrySets(map).find((item) => item.layer === layer && item.color);
    if (set) return set.color;
  }
  return null;
}

function dxfObjectAppearanceSuffix(map, set) {
  const sameLayerCount = [...map.values()].filter((item) => item.layer === set.layer).length;
  if (sameLayerCount <= 1) return "";
  const opacitySuffix = Number.isFinite(set.opacity) ? `_opacity_${Math.round(set.opacity * 255)}` : "";
  return `_${set.color || "default"}${opacitySuffix}`;
}

function addLineSegment(lineSets, layer, color, a, b) {
  if (!a || !b || samePoint(a, b)) return;
  const lineSet = ensureLineSet(lineSets, layer, color);
  const start = lineSet.vertices.length;
  lineSet.vertices.push(a, b);
  lineSet.lineSegments.push([start, start + 1]);
}

function addAppearanceLineSegment(lineSets, layer, defaultColor, segment) {
  const a = segment?.start;
  const b = segment?.end;
  if (!a || !b || samePoint(a, b)) return;
  const color = segment.color || defaultColor;
  const opacity = canonicalOpacity(segment.opacity);
  const lineSet = ensureAppearanceLineSet(lineSets, layer, color, opacity);
  const start = lineSet.vertices.length;
  lineSet.vertices.push(a, b);
  lineSet.lineSegments.push([start, start + 1]);
}

function addDxfLineSegment(lineSets, layer, color, opacity, a, b) {
  if (!a || !b || samePoint(a, b)) return;
  const lineSet = ensureDxfLineSet(lineSets, layer, color, opacity);
  const start = lineSet.vertices.length;
  lineSet.vertices.push(a, b);
  lineSet.lineSegments.push([start, start + 1]);
}

function addPolyline(lineSets, layer, color, points, closed = false) {
  const clean = points.filter(Boolean);
  for (let index = 1; index < clean.length; index += 1) addLineSegment(lineSets, layer, color, clean[index - 1], clean[index]);
  if (closed && clean.length > 2) addLineSegment(lineSets, layer, color, clean[clean.length - 1], clean[0]);
}

function addDxfPolyline(lineSets, layer, color, opacity, points, closed = false) {
  const clean = points.filter(Boolean);
  for (let index = 1; index < clean.length; index += 1) addDxfLineSegment(lineSets, layer, color, opacity, clean[index - 1], clean[index]);
  if (closed && clean.length > 2) addDxfLineSegment(lineSets, layer, color, opacity, clean[clean.length - 1], clean[0]);
}

function addPolylineSegments(lineSets, layer, color, segments) {
  for (const segment of segments || []) {
    if (!segment?.start || !segment?.end) continue;
    addLineSegment(lineSets, layer, color, segment.start, segment.end);
  }
}

function addDxfPolylineSegments(lineSets, layer, color, opacity, segments) {
  for (const segment of segments || []) {
    if (!segment?.start || !segment?.end) continue;
    addDxfLineSegment(lineSets, layer, color, opacity, segment.start, segment.end);
  }
}

function addDxfSampledCurve(lineSets, diagnostics, type, layer, color, opacity, points, closed = false) {
  const clean = (points || []).filter(Boolean);
  if (!hasAtLeastTwoDistinctPoints(clean)) {
    addDiagnostic(diagnostics, "info", "dxf-curve-empty-skipped", `Skipped DXF ${type} on layer ${layer}; no supported curve segments were found.`);
    return;
  }
  addDxfPolyline(lineSets, layer, color, opacity, clean, closed);
}

function addDxfCurveEntity(state, type, layer, color, opacity, curve, transform, closed = false) {
  if (curve.invalidParameterCount > 0) {
    addDiagnostic(state.diagnostics, "info", "dxf-curve-invalid-parameter-skipped", `Skipped DXF ${type} on layer ${layer}; ${curve.invalidParameterCount} required curve parameter(s) were missing or invalid.`);
    return;
  }
  addDxfSampledCurve(state.lineSets, state.diagnostics, type, layer, color, opacity, transformDxfPoints(curve.points, transform), closed);
}

function addFace(meshSets, layer, color, points) {
  const clean = points.filter(Boolean);
  if (clean.length < 3) return;
  const meshSet = ensureMeshSet(meshSets, layer, color);
  const start = meshSet.vertices.length;
  meshSet.vertices.push(...clean);
  meshSet.faces.push(clean.map((_, index) => start + index));
}

function addDxfFace(meshSets, layer, color, opacity, points) {
  const clean = points.filter(Boolean);
  if (clean.length < 3) return;
  const meshSet = ensureDxfMeshSet(meshSets, layer, color, opacity);
  const start = meshSet.vertices.length;
  meshSet.vertices.push(...clean);
  meshSet.faces.push(clean.map((_, index) => start + index));
}

function addPoint(pointSets, layer, color, point) {
  if (!point) return;
  ensurePointSet(pointSets, layer, color).points.push(point);
}

function uniqueFinitePoints(points = []) {
  const unique = [];
  for (const point of points) {
    if (!finiteVec3(point)) continue;
    if (!unique.some((candidate) => samePoint(candidate, point))) unique.push(point);
  }
  return unique;
}

function hasAtLeastThreeDistinctPoints(points = []) {
  return uniqueFinitePoints(points).length >= 3;
}

function hasAtLeastTwoDistinctPoints(points = []) {
  return uniqueFinitePoints(points).length >= 2;
}

function addDxfPoint(pointSets, layer, color, opacity, point) {
  if (!point) return;
  ensureDxfPointSet(pointSets, layer, color, opacity).points.push(point);
}

function lineEntity(entityPairs) {
  const a = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const b = dxfRequiredPoint(entityPairs, 11, 21, 31);
  if (!a || !b) return null;
  return {
    a,
    b
  };
}

function dxfRequiredPointSeries(entityPairs, xCode, yCode, zCode, defaultZ = 0) {
  const points = [];
  let invalidPointCount = 0;
  let current = null;
  const pushCurrent = () => {
    if (!current) return;
    if (!Number.isFinite(current.x) || !Number.isFinite(current.y) || !Number.isFinite(current.z) || current.hasY !== true) {
      invalidPointCount += 1;
      return;
    }
    points.push([current.x, current.y, current.z]);
  };
  for (const pair of entityPairs) {
    if (pair.code === xCode) {
      pushCurrent();
      current = { x: pairNumber(pair, NaN), y: NaN, z: defaultZ, hasY: false };
    } else if (pair.code === yCode && current) {
      current.y = pairNumber(pair, NaN);
      current.hasY = true;
    } else if (pair.code === zCode && current) {
      current.z = pairNumber(pair, NaN);
    }
  }
  pushCurrent();
  return { points, invalidPointCount };
}

function leaderPath(entityPairs) {
  return dxfRequiredPointSeries(entityPairs, 10, 20, 30);
}

function dxfBulgePoints(start, end, bulge) {
  if (!start || !end || Math.abs(bulge) < 1e-9) return [start, end].filter(Boolean);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return [start];
  const theta = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  if (!Number.isFinite(radius) || radius <= 0) return [start, end];
  const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const normal = [-dy / chord, dx / chord];
  const centerOffset = chord * (1 - bulge * bulge) / (4 * bulge);
  const center = [
    midpoint[0] + normal[0] * centerOffset,
    midpoint[1] + normal[1] * centerOffset
  ];
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const steps = Math.max(4, Math.ceil(DXF_BULGE_SEGMENTS * Math.min(Math.abs(theta), Math.PI * 2) / (Math.PI * 2)));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = startAngle + theta * t;
    points.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      start[2] + (end[2] - start[2]) * t
    ]);
  }
  points[0] = start;
  points[points.length - 1] = end;
  return points;
}

function dxfSegmentsFromBulgeVertices(vertices, closed = false) {
  const segments = [];
  const segmentCount = Math.max(0, vertices.length - 1 + (closed && vertices.length > 2 ? 1 : 0));
  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const points = dxfBulgePoints(start.point, end.point, start.bulge || 0);
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      segments.push({ start: points[pointIndex - 1], end: points[pointIndex] });
    }
  }
  return segments;
}

function lwPolylineEntity(entityPairs) {
  const vertices = [];
  let current = null;
  let invalidVertexCount = 0;
  let invalidBulgeCount = 0;
  const elevation = firstPairNumber(entityPairs, 38, 0);
  const flags = Math.trunc(firstPairNumber(entityPairs, 70, 0));
  const extrusionParameter = dxfExtrusionParameter(entityPairs);
  const extrusion = extrusionParameter.extrusion;
  const pushCurrent = () => {
    if (!current) return;
    if (!Number.isFinite(current.x) || !Number.isFinite(current.y) || !Number.isFinite(current.z) || current.hasY !== true) {
      invalidVertexCount += 1;
      return;
    }
    if (!Number.isFinite(current.bulge)) {
      invalidBulgeCount += 1;
      return;
    }
    vertices.push({ point: [current.x, current.y, current.z], bulge: current.bulge || 0 });
  };

  for (const pair of entityPairs) {
    if (pair.code === 10) {
      pushCurrent();
      current = { x: pairNumber(pair, NaN), y: NaN, z: elevation, hasY: false, bulge: 0 };
    } else if (pair.code === 20 && current) {
      current.y = pairNumber(pair, NaN);
      current.hasY = true;
    } else if (pair.code === 30 && current) {
      current.z = pairNumber(pair, NaN);
    } else if (pair.code === 42 && current) {
      current.bulge = pairNumber(pair, NaN);
    }
  }
  pushCurrent();
  const transformPoint = (point) => dxfOcsPoint(point, extrusion);
  return {
    vertices: vertices.map((vertex) => transformPoint(vertex.point)),
    segments: dxfSegmentsFromBulgeVertices(vertices, (flags & 1) === 1).map((segment) => ({
      start: transformPoint(segment.start),
      end: transformPoint(segment.end)
    })),
    closed: (flags & 1) === 1,
    invalidVertexCount,
    invalidBulgeCount,
    invalidExtrusionCount: extrusionParameter.invalidParameterCount
  };
}

function dxfPolyfaceIndices(vertexPairs, vertexCount) {
  const seen = new Set();
  const indices = [];
  for (const code of [71, 72, 73, 74]) {
    const raw = Math.trunc(firstPairNumber(vertexPairs, code, 0));
    if (raw === 0) continue;
    const index = Math.abs(raw) - 1;
    if (index < 0 || index >= vertexCount || seen.has(index)) continue;
    seen.add(index);
    indices.push(index);
  }
  return indices;
}

function dxfPolygonMeshFaces(points, mCount, nCount, closedM = false, closedN = false) {
  const safeM = Math.trunc(mCount);
  const safeN = Math.trunc(nCount);
  if (safeM < 2 || safeN < 2 || points.length < safeM * safeN) return [];
  const mLimit = closedM ? safeM : safeM - 1;
  const nLimit = closedN ? safeN : safeN - 1;
  const faces = [];
  const indexAt = (m, n) => n * safeM + m;
  for (let n = 0; n < nLimit; n += 1) {
    for (let m = 0; m < mLimit; m += 1) {
      const nextM = (m + 1) % safeM;
      const nextN = (n + 1) % safeN;
      faces.push([
        indexAt(m, n),
        indexAt(nextM, n),
        indexAt(nextM, nextN),
        indexAt(m, nextN)
      ]);
    }
  }
  return faces;
}

function polylineEntity(pairs, startIndex) {
  const headerEnd = entityEnd(pairs, startIndex);
  const headerPairs = pairs.slice(startIndex + 1, headerEnd);
  const flags = Math.trunc(firstPairNumber(headerPairs, 70, 0));
  const elevation = firstPairNumber(headerPairs, 30, 0);
  const extrusionParameter = dxfExtrusionParameter(headerPairs);
  const extrusion = extrusionParameter.extrusion;
  const points = [];
  const vertices = [];
  const faces = [];
  let invalidVertexCount = 0;
  let invalidBulgeCount = 0;
  let next = headerEnd;
  while (next < pairs.length) {
    if (pairs[next].code !== 0) {
      next += 1;
      continue;
    }
    const type = String(pairs[next].value).toUpperCase();
    if (type === "SEQEND") {
      next = entityEnd(pairs, next);
      break;
    }
    if (type !== "VERTEX") break;
    const end = entityEnd(pairs, next);
    const vertexPairs = pairs.slice(next + 1, end);
    const vertexFlags = Math.trunc(firstPairNumber(vertexPairs, 70, 0));
    const isPolyfaceRecord = (flags & 64) === 64 || (vertexFlags & 128) === 128;
    if (isPolyfaceRecord && (vertexFlags & 128) === 128) {
      const face = dxfPolyfaceIndices(vertexPairs, points.length);
      if (face.length >= 3) faces.push(face);
    } else {
      const point = dxfRequiredPoint(vertexPairs, 10, 20, 30, elevation);
      if (!point) {
        invalidVertexCount += 1;
        next = end;
        continue;
      }
      points.push(point);
      const bulge = dxfNumberParameter(vertexPairs, 42, 0);
      if (bulge.invalid) {
        invalidBulgeCount += 1;
        next = end;
        continue;
      }
      vertices.push({ point, bulge: bulge.value });
    }
    next = end;
  }
  if (!faces.length && (flags & 16) === 16 && (flags & 64) !== 64) {
    faces.push(...dxfPolygonMeshFaces(
      points,
      firstPairNumber(headerPairs, 71, 0),
      firstPairNumber(headerPairs, 72, 0),
      (flags & 1) === 1,
      (flags & 32) === 32
    ));
  }
  const transformPoint = (point) => dxfOcsPoint(point, extrusion);
  return {
    headerPairs,
    points: points.map(transformPoint),
    faces,
    segments: dxfSegmentsFromBulgeVertices(vertices, (flags & 1) === 1).map((segment) => ({
      start: transformPoint(segment.start),
      end: transformPoint(segment.end)
    })),
    closed: (flags & 1) === 1,
    invalidVertexCount,
    invalidBulgeCount,
    invalidExtrusionCount: extrusionParameter.invalidParameterCount,
    next
  };
}

function readHatchPolylineBoundary(entityPairs, index, elevation) {
  let hasBulge = false;
  let closed = false;
  let vertexCount = 0;
  let invalidParameterCount = 0;
  while (index < entityPairs.length) {
    const pair = entityPairs[index];
    if (pair.code === 72) {
      const value = pairNumber(pair, NaN);
      if (Number.isFinite(value)) hasBulge = value !== 0;
      else invalidParameterCount += 1;
    } else if (pair.code === 73) {
      const value = pairNumber(pair, NaN);
      if (Number.isFinite(value)) closed = value !== 0;
      else invalidParameterCount += 1;
    }
    else if (pair.code === 93) {
      const value = pairNumber(pair, NaN);
      if (Number.isFinite(value)) vertexCount = Math.max(0, Math.trunc(value));
      else invalidParameterCount += 1;
      index += 1;
      break;
    } else if (pair.code === 92) {
      break;
    }
    index += 1;
  }

  const vertices = [];
  let readVertexCount = 0;
  for (let vertexIndex = 0; vertexIndex < vertexCount && index < entityPairs.length; vertexIndex += 1) {
    while (index < entityPairs.length && entityPairs[index].code !== 10) {
      if (entityPairs[index].code === 92) {
        invalidParameterCount += vertexCount - readVertexCount;
        return { index, segments: dxfSegmentsFromBulgeVertices(vertices, closed), invalidParameterCount };
      }
      index += 1;
    }
    if (index >= entityPairs.length) break;
    const vertex = { x: pairNumber(entityPairs[index], NaN), y: NaN, z: elevation, bulge: 0, hasY: false };
    index += 1;
    while (index < entityPairs.length && entityPairs[index].code !== 10 && entityPairs[index].code !== 92) {
      const pair = entityPairs[index];
      if (pair.code === 20) {
        vertex.y = pairNumber(pair, NaN);
        vertex.hasY = true;
      } else if (pair.code === 30) vertex.z = pairNumber(pair, NaN);
      else if (pair.code === 42 && hasBulge) vertex.bulge = pairNumber(pair, NaN);
      index += 1;
    }
    readVertexCount += 1;
    if (
      !Number.isFinite(vertex.x)
      || !Number.isFinite(vertex.y)
      || !Number.isFinite(vertex.z)
      || !Number.isFinite(vertex.bulge)
      || vertex.hasY !== true
    ) {
      invalidParameterCount += 1;
      continue;
    }
    vertices.push({ point: vec3(vertex.x, vertex.y, vertex.z), bulge: vertex.bulge });
  }
  if (readVertexCount < vertexCount) invalidParameterCount += vertexCount - readVertexCount;
  return { index, segments: dxfSegmentsFromBulgeVertices(vertices, closed), invalidParameterCount };
}

function dxfSegmentsFromPoints(points) {
  const segments = [];
  const clean = points.filter(Boolean);
  for (let index = 1; index < clean.length; index += 1) {
    segments.push({ start: clean[index - 1], end: clean[index] });
  }
  return segments;
}

function dxfAngleSpan(start, end, period, counterClockwise) {
  let normalizedStart = start;
  let normalizedEnd = end;
  if (counterClockwise) {
    while (normalizedEnd <= normalizedStart) normalizedEnd += period;
  } else {
    while (normalizedStart <= normalizedEnd) normalizedStart += period;
  }
  return { start: normalizedStart, span: normalizedEnd - normalizedStart };
}

function hatchArcEdgePoints(edgePairs, elevation) {
  const center = dxfRequiredPoint(edgePairs, 10, 20, 30, elevation);
  const radiusParameter = dxfNumberParameter(edgePairs, 40, 0);
  const startParameter = dxfNumberParameter(edgePairs, 50, 0);
  const endParameter = dxfNumberParameter(edgePairs, 51, 360);
  const counterClockwiseParameter = dxfNumberParameter(edgePairs, 73, 1);
  const invalidParameterCount = (center ? 0 : 1)
    + (radiusParameter.invalid ? 1 : 0)
    + (startParameter.invalid ? 1 : 0)
    + (endParameter.invalid ? 1 : 0)
    + (counterClockwiseParameter.invalid ? 1 : 0);
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const radius = radiusParameter.value;
  if (radius <= 0) return { points: [], invalidParameterCount: 0 };
  const startDeg = startParameter.value;
  const endDeg = endParameter.value;
  const counterClockwise = Math.trunc(counterClockwiseParameter.value) !== 0;
  const angle = dxfAngleSpan(startDeg, endDeg, 360, counterClockwise);
  const steps = Math.max(4, Math.ceil(DXF_ARC_SEGMENTS * Math.min(Math.abs(angle.span), 360) / 360));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const radians = (angle.start + angle.span * index / steps) * Math.PI / 180;
    points.push([center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius, center[2]]);
  }
  return { points, invalidParameterCount: 0 };
}

function hatchEllipseEdgePoints(edgePairs, elevation) {
  const center = dxfRequiredPoint(edgePairs, 10, 20, 30, elevation);
  const major = dxfRequiredPoint(edgePairs, 11, 21, 31);
  const ratioParameter = dxfNumberParameter(edgePairs, 40, 0);
  const startParameter = dxfNumberParameter(edgePairs, 50, 0);
  const endParameter = dxfNumberParameter(edgePairs, 51, 360);
  const counterClockwiseParameter = dxfNumberParameter(edgePairs, 73, 1);
  const invalidParameterCount = (center ? 0 : 1)
    + (major ? 0 : 1)
    + (ratioParameter.invalid ? 1 : 0)
    + (startParameter.invalid ? 1 : 0)
    + (endParameter.invalid ? 1 : 0)
    + (counterClockwiseParameter.invalid ? 1 : 0);
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const ratio = ratioParameter.value;
  const majorLength = vecLength(major);
  if (majorLength <= 1e-9 || ratio <= 0) return { points: [], invalidParameterCount: 0 };
  const normal = vecUnit(vec3(firstPairNumber(edgePairs, 210), firstPairNumber(edgePairs, 220), firstPairNumber(edgePairs, 230, 1)), [0, 0, 1]);
  let minorDirection = vecCross(normal, vecUnit(major, [1, 0, 0]));
  if (vecLength(minorDirection) <= 1e-9) minorDirection = vecCross([0, 0, 1], vecUnit(major, [1, 0, 0]));
  minorDirection = vecUnit(minorDirection, [0, 1, 0]);
  const minor = vecMul(minorDirection, majorLength * ratio);
  const startDeg = startParameter.value;
  const endDeg = endParameter.value;
  const counterClockwise = Math.trunc(counterClockwiseParameter.value) !== 0;
  const angle = dxfAngleSpan(startDeg, endDeg, 360, counterClockwise);
  const steps = Math.max(6, Math.ceil(DXF_ELLIPSE_SEGMENTS * Math.min(Math.abs(angle.span), 360) / 360));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const radians = (angle.start + angle.span * index / steps) * Math.PI / 180;
    points.push(vecAdd(center, vecAdd(vecMul(major, Math.cos(radians)), vecMul(minor, Math.sin(radians)))));
  }
  return { points, invalidParameterCount: 0 };
}

function hatchSplineEdgePoints(edgePairs, elevation) {
  const degreeParameter = dxfNumberParameter(edgePairs, 94, 3);
  const controlPointSeries = dxfRequiredPointSeries(edgePairs, 10, 20, 30, elevation);
  const fitPointSeries = dxfRequiredPointSeries(edgePairs, 11, 21, 31, elevation);
  const knotSeries = dxfStrictNumbers(edgePairs, 40);
  const weightSeries = dxfStrictNumbers(edgePairs, 42);
  const invalidParameterCount = (degreeParameter.invalid ? 1 : 0)
    + controlPointSeries.invalidPointCount
    + fitPointSeries.invalidPointCount
    + knotSeries.invalidNumberCount
    + weightSeries.invalidNumberCount;
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const degree = Math.max(1, Math.trunc(degreeParameter.value));
  const controlPoints = controlPointSeries.points;
  const fitPoints = fitPointSeries.points;
  const knots = knotSeries.values;
  const weights = weightSeries.values;
  const bspline = sampleBSpline(controlPoints, knots, degree, weights);
  if (bspline.length > 1) return { points: bspline, invalidParameterCount: 0 };
  if (fitPoints.length > 1) return { points: sampleCatmullRom(fitPoints), invalidParameterCount: 0 };
  if (controlPoints.length > 1) return { points: sampleCatmullRom(controlPoints), invalidParameterCount: 0 };
  return { points: [], invalidParameterCount: 0 };
}

function hatchEdgeSegments(edgeType, edgePairs, elevation) {
  if (edgeType === 1) {
    const start = dxfRequiredPoint(edgePairs, 10, 20, 30, elevation);
    const end = dxfRequiredPoint(edgePairs, 11, 21, 31, elevation);
    const invalidParameterCount = (start ? 0 : 1) + (end ? 0 : 1);
    return {
      segments: start && end ? [{ start, end }] : [],
      invalidParameterCount
    };
  }
  if (edgeType === 2) {
    const result = hatchArcEdgePoints(edgePairs, elevation);
    return { segments: dxfSegmentsFromPoints(result.points), invalidParameterCount: result.invalidParameterCount };
  }
  if (edgeType === 3) {
    const result = hatchEllipseEdgePoints(edgePairs, elevation);
    return { segments: dxfSegmentsFromPoints(result.points), invalidParameterCount: result.invalidParameterCount };
  }
  if (edgeType === 4) {
    const result = hatchSplineEdgePoints(edgePairs, elevation);
    return { segments: dxfSegmentsFromPoints(result.points), invalidParameterCount: result.invalidParameterCount };
  }
  return { segments: [], invalidParameterCount: 0 };
}

function readHatchEdgeBoundary(entityPairs, index, edgeCount, elevation) {
  const segments = [];
  let invalidParameterCount = 0;
  for (let edgeIndex = 0; edgeIndex < edgeCount && index < entityPairs.length;) {
    while (index < entityPairs.length && entityPairs[index].code !== 72) {
      if (entityPairs[index].code === 92) return { index, segments, invalidParameterCount };
      index += 1;
    }
    if (index >= entityPairs.length || entityPairs[index].code === 92) break;
    const edgeTypeValue = pairNumber(entityPairs[index], NaN);
    const edgeType = Math.trunc(edgeTypeValue);
    if (!Number.isFinite(edgeTypeValue)) invalidParameterCount += 1;
    index += 1;
    const edgePairs = [];
    while (index < entityPairs.length && entityPairs[index].code !== 72 && entityPairs[index].code !== 92) {
      edgePairs.push(entityPairs[index]);
      index += 1;
    }
    const result = Number.isFinite(edgeTypeValue) ? hatchEdgeSegments(edgeType, edgePairs, elevation) : { segments: [], invalidParameterCount: 0 };
    segments.push(...result.segments);
    invalidParameterCount += result.invalidParameterCount;
    edgeIndex += 1;
  }
  return { index, segments, invalidParameterCount };
}

function hatchBoundarySegments(entityPairs) {
  const elevationParameter = dxfNumberParameter(entityPairs, 30, 0);
  const elevation = elevationParameter.value;
  const extrusionParameter = dxfExtrusionParameter(entityPairs);
  const extrusion = extrusionParameter.extrusion;
  const segments = [];
  let invalidParameterCount = (elevationParameter.invalid ? 1 : 0) + extrusionParameter.invalidParameterCount;
  let index = 0;
  while (index < entityPairs.length) {
    if (entityPairs[index].code !== 92) {
      index += 1;
      continue;
    }
    const pathFlagsValue = pairNumber(entityPairs[index], NaN);
    const pathFlags = Math.trunc(pathFlagsValue);
    if (!Number.isFinite(pathFlagsValue)) invalidParameterCount += 1;
    index += 1;
    if (Number.isFinite(pathFlagsValue) && (pathFlags & 2) === 2) {
      const result = readHatchPolylineBoundary(entityPairs, index, elevation);
      segments.push(...result.segments);
      invalidParameterCount += result.invalidParameterCount;
      index = result.index;
      continue;
    }

    let edgeCount = 0;
    while (index < entityPairs.length) {
      const pair = entityPairs[index];
      if (pair.code === 93) {
        const edgeCountValue = pairNumber(pair, NaN);
        if (Number.isFinite(edgeCountValue)) edgeCount = Math.max(0, Math.trunc(edgeCountValue));
        else invalidParameterCount += 1;
        index += 1;
        break;
      }
      if (pair.code === 92) break;
      index += 1;
    }
    const result = readHatchEdgeBoundary(entityPairs, index, edgeCount, elevation);
    segments.push(...result.segments);
    invalidParameterCount += result.invalidParameterCount;
    index = result.index;
  }
  return {
    segments: segments.map((segment) => ({
      start: dxfOcsPoint(segment.start, extrusion),
      end: dxfOcsPoint(segment.end, extrusion)
    })),
    invalidParameterCount
  };
}

function arcPoints(entityPairs, fullCircle = false) {
  const center = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const radiusParameter = dxfNumberParameter(entityPairs, 40, 0);
  const startParameter = fullCircle ? { value: 0, invalid: false } : dxfNumberParameter(entityPairs, 50, 0);
  const endParameter = fullCircle ? { value: 360, invalid: false } : dxfNumberParameter(entityPairs, 51, 360);
  const extrusionParameter = dxfExtrusionParameter(entityPairs);
  const invalidParameterCount = (center ? 0 : 1)
    + (radiusParameter.invalid ? 1 : 0)
    + (startParameter.invalid ? 1 : 0)
    + (endParameter.invalid ? 1 : 0)
    + extrusionParameter.invalidParameterCount;
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const extrusion = extrusionParameter.extrusion;
  const radius = radiusParameter.value;
  if (radius <= 0) return { points: [], invalidParameterCount: 0 };
  const startDeg = startParameter.value;
  let endDeg = endParameter.value;
  while (endDeg <= startDeg) endDeg += 360;
  const span = endDeg - startDeg;
  const segments = fullCircle ? DXF_CIRCLE_SEGMENTS : Math.max(4, Math.ceil(DXF_ARC_SEGMENTS * Math.min(span, 360) / 360));
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (startDeg + span * index / segments) * Math.PI / 180;
    points.push(dxfOcsPoint([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius, center[2]], extrusion));
  }
  return { points, invalidParameterCount: 0 };
}

function ellipsePoints(entityPairs) {
  const center = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const major = dxfRequiredPoint(entityPairs, 11, 21, 31);
  const ratioParameter = dxfNumberParameter(entityPairs, 40, 0);
  const startParameter = dxfNumberParameter(entityPairs, 41, 0);
  const endParameter = dxfNumberParameter(entityPairs, 42, Math.PI * 2);
  const extrusionParameter = dxfExtrusionParameter(entityPairs);
  const invalidParameterCount = (center ? 0 : 1)
    + (major ? 0 : 1)
    + (ratioParameter.invalid ? 1 : 0)
    + (startParameter.invalid ? 1 : 0)
    + (endParameter.invalid ? 1 : 0)
    + extrusionParameter.invalidParameterCount;
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const ratio = ratioParameter.value;
  const majorLength = vecLength(major);
  if (majorLength <= 1e-9 || ratio <= 0) return { points: [], invalidParameterCount: 0 };
  // DXF ELLIPSE center and major-axis vectors are WCS; extrusion only supplies the curve plane normal.
  const normal = vecUnit(extrusionParameter.extrusion, [0, 0, 1]);
  let minorDirection = vecCross(normal, vecUnit(major, [1, 0, 0]));
  if (vecLength(minorDirection) <= 1e-9) minorDirection = vecCross([0, 0, 1], vecUnit(major, [1, 0, 0]));
  minorDirection = vecUnit(minorDirection, [0, 1, 0]);
  const minor = vecMul(minorDirection, majorLength * ratio);
  const startParam = startParameter.value;
  let endParam = endParameter.value;
  while (endParam <= startParam) endParam += Math.PI * 2;
  const span = endParam - startParam;
  const fullEllipse = Math.abs(span - Math.PI * 2) < 1e-6 || span >= Math.PI * 2;
  const steps = fullEllipse
    ? DXF_ELLIPSE_SEGMENTS
    : Math.max(6, Math.ceil(DXF_ELLIPSE_SEGMENTS * Math.min(span, Math.PI * 2) / (Math.PI * 2)));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const param = startParam + span * index / steps;
    points.push(vecAdd(center, vecAdd(vecMul(major, Math.cos(param)), vecMul(minor, Math.sin(param)))));
  }
  return { points, invalidParameterCount: 0 };
}

function dxfPointSeries(entityPairs, xCode, yCode, zCode, defaultZ = 0) {
  const points = [];
  let current = null;
  for (const pair of entityPairs) {
    if (pair.code === xCode) {
      if (current) points.push(vec3(current.x, current.y, current.z));
      current = { x: pairNumber(pair), y: 0, z: defaultZ };
    } else if (pair.code === yCode && current) {
      current.y = pairNumber(pair);
    } else if (pair.code === zCode && current) {
      current.z = pairNumber(pair, defaultZ);
    }
  }
  if (current) points.push(vec3(current.x, current.y, current.z));
  return points;
}

function dxfNumbers(entityPairs, code) {
  return entityPairs.filter((pair) => pair.code === code).map((pair) => pairNumber(pair)).filter(Number.isFinite);
}

function dxfStrictNumbers(entityPairs, code) {
  const values = [];
  let invalidNumberCount = 0;
  for (const pair of entityPairs.filter((item) => item.code === code)) {
    const value = pairNumber(pair, NaN);
    if (Number.isFinite(value)) values.push(value);
    else invalidNumberCount += 1;
  }
  return { values, invalidNumberCount };
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1, 2].map((axis) => 0.5 * (
    (2 * p1[axis])
    + (-p0[axis] + p2[axis]) * t
    + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
    + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
  ));
}

function sampleCatmullRom(points, samplesPerSpan = 12) {
  if (points.length < 3) return points;
  const sampled = [points[0]];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 1; step <= samplesPerSpan; step += 1) {
      sampled.push(catmullRomPoint(p0, p1, p2, p3, step / samplesPerSpan));
    }
  }
  return sampled;
}

function knotSpan(controlPointCount, degree, knots, value) {
  const n = controlPointCount - 1;
  if (value >= knots[n + 1]) return n;
  if (value <= knots[degree]) return degree;
  let low = degree;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);
  while (value < knots[mid] || value >= knots[mid + 1]) {
    if (value < knots[mid]) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

function homogeneousPoint(point, weight) {
  return [point[0] * weight, point[1] * weight, point[2] * weight, weight];
}

function mixHomogeneous(a, b, t) {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t,
    a[3] * (1 - t) + b[3] * t
  ];
}

function deBoorPoint(controlPoints, knots, degree, weights, value) {
  const span = knotSpan(controlPoints.length, degree, knots, value);
  const work = [];
  for (let index = 0; index <= degree; index += 1) {
    const pointIndex = span - degree + index;
    work[index] = homogeneousPoint(controlPoints[pointIndex], weights[pointIndex] || 1);
  }
  for (let level = 1; level <= degree; level += 1) {
    for (let index = degree; index >= level; index -= 1) {
      const knotIndex = span - degree + index;
      const denominator = knots[knotIndex + degree - level + 1] - knots[knotIndex];
      const alpha = Math.abs(denominator) > 1e-12 ? (value - knots[knotIndex]) / denominator : 0;
      work[index] = mixHomogeneous(work[index - 1], work[index], alpha);
    }
  }
  const result = work[degree];
  return Math.abs(result[3]) > 1e-12 ? [result[0] / result[3], result[1] / result[3], result[2] / result[3]] : controlPoints[span];
}

function sampleBSplineRange(controlPoints, knots, degree, weights, minimumSegments = DXF_SPLINE_SEGMENTS, startParameter = null, endParameter = null) {
  if (controlPoints.length < 2) return [];
  const safeDegree = Math.max(1, Math.min(Math.trunc(degree) || 1, controlPoints.length - 1));
  if (knots.length < controlPoints.length + safeDegree + 1) return [];
  const domainStart = knots[safeDegree];
  const domainEnd = knots[controlPoints.length];
  if (!Number.isFinite(domainStart) || !Number.isFinite(domainEnd) || domainEnd <= domainStart) return [];
  const requestedStart = Number.isFinite(startParameter) ? startParameter : domainStart;
  const requestedEnd = Number.isFinite(endParameter) ? endParameter : domainEnd;
  const rangeStart = Math.max(domainStart, Math.min(domainEnd, requestedStart));
  const rangeEnd = Math.max(domainStart, Math.min(domainEnd, requestedEnd));
  if (rangeEnd <= rangeStart) return [];
  const steps = Math.max(minimumSegments, controlPoints.length * 8);
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = rangeStart + (rangeEnd - rangeStart) * index / steps;
    points.push(deBoorPoint(controlPoints, knots, safeDegree, weights, t));
  }
  return points;
}

function sampleBSpline(controlPoints, knots, degree, weights, minimumSegments = DXF_SPLINE_SEGMENTS) {
  return sampleBSplineRange(controlPoints, knots, degree, weights, minimumSegments);
}

function splinePoints(entityPairs) {
  const degreeParameter = dxfNumberParameter(entityPairs, 71, 3);
  const controlPointSeries = dxfRequiredPointSeries(entityPairs, 10, 20, 30);
  const fitPointSeries = dxfRequiredPointSeries(entityPairs, 11, 21, 31);
  const knotSeries = dxfStrictNumbers(entityPairs, 40);
  const weightSeries = dxfStrictNumbers(entityPairs, 41);
  const invalidParameterCount = (degreeParameter.invalid ? 1 : 0)
    + controlPointSeries.invalidPointCount
    + fitPointSeries.invalidPointCount
    + knotSeries.invalidNumberCount
    + weightSeries.invalidNumberCount;
  if (invalidParameterCount > 0) return { points: [], invalidParameterCount };
  const degree = Math.max(1, Math.trunc(degreeParameter.value));
  const controlPoints = controlPointSeries.points;
  const fitPoints = fitPointSeries.points;
  const knots = knotSeries.values;
  const weights = weightSeries.values;
  const bspline = sampleBSpline(controlPoints, knots, degree, weights);
  if (bspline.length > 1) return { points: bspline, invalidParameterCount: 0 };
  if (fitPoints.length > 1) return { points: sampleCatmullRom(fitPoints), invalidParameterCount: 0 };
  if (controlPoints.length > 1) return { points: sampleCatmullRom(controlPoints), invalidParameterCount: 0 };
  return { points: [], invalidParameterCount: 0 };
}

function face3dEntity(entityPairs) {
  const a = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const b = dxfRequiredPoint(entityPairs, 11, 21, 31);
  const c = dxfRequiredPoint(entityPairs, 12, 22, 32);
  const d = dxfOptionalPoint(entityPairs, 13, 23, 33);
  const invalidVertexCount = [a, b, c].filter((point) => !point).length + (d.invalid ? 1 : 0);
  if (invalidVertexCount > 0) return { points: [], invalidVertexCount };
  const points = [a, b, c];
  if (d.point && !samePoint(c, d.point)) points.push(d.point);
  return { points, invalidVertexCount: 0 };
}

function solidTraceEntity(entityPairs) {
  const extrusionParameter = dxfExtrusionParameter(entityPairs);
  const extrusion = extrusionParameter.extrusion;
  const transformPoint = (point) => dxfOcsPoint(point, extrusion);
  const a = dxfRequiredPoint(entityPairs, 10, 20, 30);
  const b = dxfRequiredPoint(entityPairs, 11, 21, 31);
  const c = dxfRequiredPoint(entityPairs, 12, 22, 32);
  const d = dxfOptionalPoint(entityPairs, 13, 23, 33);
  const invalidVertexCount = [a, b, c].filter((point) => !point).length + (d.invalid ? 1 : 0);
  if (invalidVertexCount > 0) return { points: [], invalidVertexCount, invalidExtrusionCount: extrusionParameter.invalidParameterCount };
  const transformedA = transformPoint(a);
  const transformedB = transformPoint(b);
  const transformedC = transformPoint(c);
  if (!d.point) return { points: [transformedA, transformedB, transformedC], invalidVertexCount: 0, invalidExtrusionCount: extrusionParameter.invalidParameterCount };
  const transformedD = transformPoint(d.point);
  return {
    points: samePoint(transformedC, transformedD) ? [transformedA, transformedB, transformedC] : [transformedA, transformedB, transformedD, transformedC],
    invalidVertexCount: 0,
    invalidExtrusionCount: extrusionParameter.invalidParameterCount
  };
}

function meshEntity(entityPairs) {
  const vertexSeries = dxfRequiredPointSeries(entityPairs, 10, 20, 30);
  const vertices = vertexSeries.points;
  const declaredVertexCount = Math.trunc(firstPairNumber(entityPairs, 92, NaN));
  const missingVertexCount = Number.isFinite(declaredVertexCount)
    ? Math.max(0, declaredVertexCount - vertices.length - vertexSeries.invalidPointCount)
    : 0;
  const faces = [];
  const faceListStart = entityPairs.findIndex((pair) => pair.code === 93);
  if (faceListStart < 0) return { vertices, faces, invalidVertexCount: vertexSeries.invalidPointCount + missingVertexCount };
  let index = faceListStart + 1;
  while (index < entityPairs.length && entityPairs[index].code === 90) {
    const vertexCount = Math.max(0, Math.trunc(pairNumber(entityPairs[index])));
    index += 1;
    const face = [];
    for (let item = 0; item < vertexCount && index < entityPairs.length && entityPairs[index].code === 90; item += 1) {
      const vertexIndex = Math.trunc(pairNumber(entityPairs[index]));
      if (vertexIndex >= 0 && vertexIndex < vertices.length) face.push(vertexIndex);
      index += 1;
    }
    if (face.length >= 3) faces.push(face);
  }
  return { vertices, faces, invalidVertexCount: vertexSeries.invalidPointCount + missingVertexCount };
}

function pointEntity(entityPairs) {
  return dxfRequiredPoint(entityPairs, 10, 20, 30);
}

function mlineCenterlinePath(entityPairs) {
  return dxfRequiredPointSeries(entityPairs, 10, 20, 30);
}

function lineObject(id, name, layer, lineSet) {
  return {
    id,
    kind: "line-set",
    name,
    layer,
    display: {
      color: lineSet.color,
      ...(Number.isFinite(lineSet.opacity) ? { opacity: lineSet.opacity } : {})
    },
    vertices: lineSet.vertices,
    lineSegments: lineSet.lineSegments,
    bounds: boundsFor(lineSet.vertices)
  };
}

function meshObject(id, name, layer, meshSet) {
  return {
    id,
    kind: "mesh",
    name,
    layer,
    display: {
      color: meshSet.color,
      opacity: Number.isFinite(meshSet.opacity) ? meshSet.opacity : 0.32
    },
    vertices: meshSet.vertices,
    faces: meshSet.faces,
    bounds: boundsFor(meshSet.vertices)
  };
}

function pointObject(id, name, layer, pointSet) {
  return {
    id,
    kind: "point-cloud",
    name,
    layer,
    display: {
      color: pointSet.color,
      pointSize: 24,
      ...(Number.isFinite(pointSet.opacity) ? { opacity: pointSet.opacity } : {})
    },
    points: pointSet.points,
    bounds: boundsFor(pointSet.points)
  };
}

function addDxfInsert(entityPairs, state, context) {
  const blockName = firstPairValue(entityPairs, 2, null);
  if (blockName && state.invalidBlocks?.has(blockName)) return;
  const block = blockName ? state.blocks.get(blockName) : null;
  if (!block) {
    addDiagnostic(state.diagnostics, "warning", "dxf-missing-block", `Skipped DXF INSERT for missing block ${blockName || "<unnamed>"}.`);
    return;
  }
  const depth = context.depth || 0;
  if (depth >= 8) {
    addDiagnostic(state.diagnostics, "warning", "dxf-nested-insert-limit", `Skipped nested DXF INSERT for block ${blockName}; nesting limit reached.`);
    return;
  }
  const insertLayer = effectiveLayerName(entityPairs, context);
  const insertColor = effectiveLayerColor(entityPairs, state.layerColors, insertLayer, context);
  const insertOpacity = effectiveLayerOpacity(entityPairs, state.layerOpacities, insertLayer, context);
  const arrayItems = dxfInsertArrayItems(entityPairs);
  const baseTransform = dxfInsertTransform(entityPairs, block.base, context.transform || identityTransform);
  const invalidParameterCount = arrayItems.invalidParameterCount + baseTransform.invalidParameterCount;
  if (invalidParameterCount > 0) {
    addDiagnostic(state.diagnostics, "info", "dxf-insert-invalid-transform-skipped", `Skipped DXF INSERT for block ${blockName}; ${invalidParameterCount} required insert transform parameter(s) were missing or invalid.`);
    return;
  }
  for (const arrayOffset of arrayItems.items) {
    const insertTransform = dxfInsertTransform(entityPairs, block.base, context.transform || identityTransform, arrayOffset);
    addDxfEntities(block.pairs, state, {
      transform: insertTransform.transform,
      insertLayer,
      insertColor,
      insertOpacity,
      depth: depth + 1,
      skipBlockDefinitions: false
    });
  }
}

function addDxfDimension(entityPairs, state, context) {
  const blockName = firstPairValue(entityPairs, 2, null);
  if (blockName && state.invalidBlocks?.has(blockName)) return;
  const block = blockName ? state.blocks.get(blockName) : null;
  if (!block) {
    addDiagnostic(state.diagnostics, "warning", "dxf-missing-dimension-block", `Skipped DXF DIMENSION for missing block ${blockName || "<unnamed>"}.`);
    return;
  }
  const depth = context.depth || 0;
  if (depth >= 8) {
    addDiagnostic(state.diagnostics, "warning", "dxf-nested-dimension-limit", `Skipped nested DXF DIMENSION for block ${blockName}; nesting limit reached.`);
    return;
  }
  const insertLayer = effectiveLayerName(entityPairs, context);
  const insertColor = effectiveLayerColor(entityPairs, state.layerColors, insertLayer, context);
  const insertOpacity = effectiveLayerOpacity(entityPairs, state.layerOpacities, insertLayer, context);
  addDxfEntities(block.pairs, state, {
    transform: context.transform || identityTransform,
    insertLayer,
    insertColor,
    insertOpacity,
    depth: depth + 1,
    skipBlockDefinitions: false
  });
}

function addDxfEntityGeometry(pairs, index, state, context) {
  if (pairs[index].code !== 0) return index + 1;
  const type = dxfRecordType(pairs[index]);
  if (!type) return index + 1;
  if (context.skipBlockDefinitions && state.blockSkipStarts.has(index)) return state.blockSkipStarts.get(index);
  if (state.ignoredTypes.has(type)) return entityEnd(pairs, index);

  if (type === "POLYLINE") {
    const parsed = polylineEntity(pairs, index);
    const layer = effectiveLayerName(parsed.headerPairs, context);
    const color = effectiveLayerColor(parsed.headerPairs, state.layerColors, layer, context);
    const opacity = effectiveLayerOpacity(parsed.headerPairs, state.layerOpacities, layer, context);
    const transform = context.transform || identityTransform;
    if (parsed.invalidVertexCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-vertex-skipped", `Skipped DXF POLYLINE on layer ${layer}; ${parsed.invalidVertexCount} required vertex coordinate set(s) were missing or invalid.`);
    } else if (parsed.invalidBulgeCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-bulge-skipped", `Skipped DXF POLYLINE on layer ${layer}; ${parsed.invalidBulgeCount} vertex bulge value(s) were invalid.`);
    } else if (parsed.invalidExtrusionCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-extrusion-skipped", `Skipped DXF POLYLINE on layer ${layer}; explicit extrusion normal parameters were malformed or zero-length.`);
    } else if (parsed.faces.length) {
      for (const face of parsed.faces) {
        addDxfFace(state.meshSets, layer, color, opacity, transformDxfPoints(face.map((vertexIndex) => parsed.points[vertexIndex]), transform));
      }
    } else if (parsed.segments.length) {
      addDxfPolylineSegments(
        state.lineSets,
        layer,
        color,
        opacity,
        parsed.segments.map((segment) => ({
          start: transform(segment.start),
          end: transform(segment.end)
        }))
      );
    } else {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-empty-skipped", `Skipped DXF POLYLINE on layer ${layer}; no supported line or face segments were found.`);
    }
    return parsed.next;
  }

  const end = entityEnd(pairs, index);
  const entityPairs = pairs.slice(index + 1, end);
  const layer = effectiveLayerName(entityPairs, context);
  const color = effectiveLayerColor(entityPairs, state.layerColors, layer, context);
  const opacity = effectiveLayerOpacity(entityPairs, state.layerOpacities, layer, context);
  const transform = context.transform || identityTransform;

  if (type === "LINE" || type === "3DLINE") {
    const line = lineEntity(entityPairs);
    if (!line) {
      addDiagnostic(state.diagnostics, "info", "dxf-line-invalid-skipped", `Skipped DXF ${type} on layer ${layer}; required line endpoint coordinates were missing or invalid.`);
    } else {
      const start = transform(line.a);
      const endPoint = transform(line.b);
      if (samePoint(start, endPoint)) {
        addDiagnostic(state.diagnostics, "info", "dxf-degenerate-line-skipped", `Skipped zero-length DXF ${type} on layer ${layer}.`);
      } else {
        addDxfLineSegment(state.lineSets, layer, color, opacity, start, endPoint);
      }
    }
  } else if (type === "LWPOLYLINE") {
    const polyline = lwPolylineEntity(entityPairs);
    if (polyline.invalidVertexCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-vertex-skipped", `Skipped DXF LWPOLYLINE on layer ${layer}; ${polyline.invalidVertexCount} required vertex coordinate set(s) were missing or invalid.`);
    } else if (polyline.invalidBulgeCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-bulge-skipped", `Skipped DXF LWPOLYLINE on layer ${layer}; ${polyline.invalidBulgeCount} vertex bulge value(s) were invalid.`);
    } else if (polyline.invalidExtrusionCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-invalid-extrusion-skipped", `Skipped DXF LWPOLYLINE on layer ${layer}; explicit extrusion normal parameters were malformed or zero-length.`);
    } else if (polyline.segments.length) {
      addDxfPolylineSegments(
        state.lineSets,
        layer,
        color,
        opacity,
        polyline.segments.map((segment) => ({
          start: transform(segment.start),
          end: transform(segment.end)
        }))
      );
    } else {
      addDiagnostic(state.diagnostics, "info", "dxf-polyline-empty-skipped", `Skipped DXF LWPOLYLINE on layer ${layer}; no supported line or face segments were found.`);
    }
  } else if (type === "CIRCLE") {
    addDxfCurveEntity(state, type, layer, color, opacity, arcPoints(entityPairs, true), transform, true);
  } else if (type === "ARC") {
    addDxfCurveEntity(state, type, layer, color, opacity, arcPoints(entityPairs, false), transform, false);
  } else if (type === "ELLIPSE") {
    addDxfCurveEntity(state, type, layer, color, opacity, ellipsePoints(entityPairs), transform, false);
  } else if (type === "SPLINE") {
    addDxfCurveEntity(state, type, layer, color, opacity, splinePoints(entityPairs), transform, false);
  } else if (type === "LEADER") {
    const path = leaderPath(entityPairs);
    const points = transformDxfPoints(path.points, transform);
    if (path.invalidPointCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-leader-invalid-vertex-skipped", `Skipped DXF LEADER on layer ${layer}; ${path.invalidPointCount} required leader vertex coordinate set(s) were missing or invalid.`);
    } else if (hasAtLeastTwoDistinctPoints(points)) {
      addDxfPolyline(state.lineSets, layer, color, opacity, points, false);
    } else {
      addDiagnostic(state.diagnostics, "info", "dxf-leader-empty-skipped", `Skipped DXF LEADER on layer ${layer}; no supported leader path segments were found.`);
    }
  } else if (type === "MLINE") {
    const path = mlineCenterlinePath(entityPairs);
    const points = transformDxfPoints(path.points, transform);
    if (path.invalidPointCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-mline-invalid-vertex-skipped", `Skipped DXF MLINE on layer ${layer}; ${path.invalidPointCount} required centerline vertex coordinate set(s) were missing or invalid.`);
    } else if (hasAtLeastTwoDistinctPoints(points)) {
      addDxfPolyline(state.lineSets, layer, color, opacity, points, false);
      addDiagnostic(state.diagnostics, "warning", "dxf-mline-centerline-fallback", `Translated DXF MLINE on layer ${layer} as centerline fallback; MLINE style offsets and fills are not interpreted.`);
    } else {
      addDiagnostic(state.diagnostics, "info", "dxf-mline-empty-skipped", `Skipped DXF MLINE on layer ${layer}; no supported centerline segments were found.`);
    }
  } else if (type === "HELIX") {
    addDiagnostic(state.diagnostics, "info", "dxf-helix-skipped", `Skipped DXF HELIX curve on layer ${layer}; use an external reference geometry adapter to tessellate it into canonical linework or mesh payloads.`);
  } else if (type === "TEXT" || type === "MTEXT" || type === "MLEADER" || type === "MULTILEADER" || type === "TOLERANCE" || type === "ATTDEF" || type === "ATTRIB") {
    addDiagnostic(state.diagnostics, "info", "dxf-annotation-skipped", `Skipped DXF ${type} annotation on layer ${layer}; annotation text is not reference geometry.`);
  } else if (type === "XLINE" || type === "RAY") {
    addDiagnostic(state.diagnostics, "info", "dxf-infinite-construction-skipped", `Skipped DXF ${type} construction geometry on layer ${layer}; canonical reference geometry requires bounded payloads.`);
  } else if (DXF_RASTER_REFERENCE_TYPES.has(type)) {
    addDiagnostic(state.diagnostics, "info", "dxf-raster-reference-skipped", `Skipped DXF ${type} raster or underlay reference on layer ${layer}; canonical reference geometry stores vector, mesh, or point-cloud payloads only.`);
  } else if (DXF_ACIS_ENTITY_TYPES.has(type)) {
    addDiagnostic(state.diagnostics, "info", "dxf-acis-entity-skipped", `Skipped DXF ${type} ACIS/BREP entity on layer ${layer}; use an external reference geometry adapter to tessellate it into canonical mesh payloads.`);
  } else if (DXF_PROXY_ENTITY_TYPES.has(type)) {
    addDiagnostic(state.diagnostics, "info", "dxf-proxy-entity-skipped", `Skipped DXF ${type} proxy payload on layer ${layer}; use an external reference geometry adapter that understands the originating application data.`);
  } else if (type === "HATCH") {
    const hatch = hatchBoundarySegments(entityPairs);
    if (hatch.invalidParameterCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-hatch-invalid-boundary-skipped", `Skipped DXF HATCH on layer ${layer}; ${hatch.invalidParameterCount} required hatch boundary parameter(s) were missing or invalid.`);
    } else if (!hatch.segments.length) {
      addDiagnostic(state.diagnostics, "info", "dxf-hatch-empty-skipped", `Skipped DXF HATCH on layer ${layer}; no supported boundary segments were found.`);
    } else {
      addDxfPolylineSegments(
        state.lineSets,
        layer,
        color,
        opacity,
        hatch.segments.map((segment) => ({
          start: transform(segment.start),
          end: transform(segment.end)
        }))
      );
    }
  } else if (type === "POINT") {
    const point = pointEntity(entityPairs);
    if (point) {
      addDxfPoint(state.pointSets, layer, color, opacity, transform(point));
    } else {
      addDiagnostic(state.diagnostics, "info", "dxf-point-invalid-skipped", `Skipped DXF POINT on layer ${layer}; required point coordinates were missing or invalid.`);
    }
  } else if (type === "3DFACE") {
    const face = face3dEntity(entityPairs);
    const points = transformDxfPoints(face.points, transform);
    if (face.invalidVertexCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-face-invalid-vertex-skipped", `Skipped DXF ${type} on layer ${layer}; ${face.invalidVertexCount} required face vertex coordinate set(s) were missing or invalid.`);
    } else if (!hasAtLeastThreeDistinctPoints(points)) {
      addDiagnostic(state.diagnostics, "info", "dxf-degenerate-face-skipped", `Skipped degenerate DXF ${type} on layer ${layer}; fewer than three distinct points were found.`);
    } else {
      addDxfFace(state.meshSets, layer, color, opacity, points);
    }
  } else if (type === "SOLID" || type === "TRACE") {
    const face = solidTraceEntity(entityPairs);
    const points = transformDxfPoints(face.points, transform);
    if (face.invalidVertexCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-face-invalid-vertex-skipped", `Skipped DXF ${type} on layer ${layer}; ${face.invalidVertexCount} required face vertex coordinate set(s) were missing or invalid.`);
    } else if (face.invalidExtrusionCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-face-invalid-extrusion-skipped", `Skipped DXF ${type} on layer ${layer}; explicit extrusion normal parameters were malformed or zero-length.`);
    } else if (!hasAtLeastThreeDistinctPoints(points)) {
      addDiagnostic(state.diagnostics, "info", "dxf-degenerate-face-skipped", `Skipped degenerate DXF ${type} on layer ${layer}; fewer than three distinct points were found.`);
    } else {
      addDxfFace(state.meshSets, layer, color, opacity, points);
    }
  } else if (type === "MESH") {
    const mesh = meshEntity(entityPairs);
    if (mesh.invalidVertexCount > 0) {
      addDiagnostic(state.diagnostics, "info", "dxf-mesh-invalid-vertex-skipped", `Skipped DXF MESH on layer ${layer}; ${mesh.invalidVertexCount} required mesh vertex coordinate set(s) were missing or invalid.`);
    } else if (!mesh.faces.length) {
      addDiagnostic(state.diagnostics, "info", "dxf-mesh-empty-skipped", `Skipped DXF MESH on layer ${layer}; no supported face-list records were found.`);
    } else {
      for (const face of mesh.faces) {
        addDxfFace(state.meshSets, layer, color, opacity, transformDxfPoints(face.map((vertexIndex) => mesh.vertices[vertexIndex]), transform));
      }
    }
  } else if (type === "INSERT") {
    addDxfInsert(entityPairs, state, context);
  } else if (type === "DIMENSION") {
    addDxfDimension(entityPairs, state, context);
  } else if (!state.handledTypes.has(type)) {
    state.unsupported.set(type, (state.unsupported.get(type) || 0) + 1);
  }

  return end;
}

function addDxfEntities(pairs, state, context = {}) {
  for (let index = 0; index < pairs.length;) {
    index = addDxfEntityGeometry(pairs, index, state, {
      transform: identityTransform,
      depth: 0,
      skipBlockDefinitions: true,
      ...context
    });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const POINT_ATTRIBUTE_KEYS = ["colors", "intensities", "classifications", "normals"];

function assertPointAttributeLengths(attributes, pointCount, label) {
  if (!attributes) return;
  if (!isRecord(attributes)) throw new Error(`${label}: pointAttributes must be an object`);
  for (const key of POINT_ATTRIBUTE_KEYS) {
    const values = attributes[key];
    if (!Array.isArray(values)) continue;
    if (values.length !== pointCount) {
      throw new Error(`${label}: pointAttributes.${key} has ${values.length} item(s), expected ${pointCount}`);
    }
  }
}

function assertPointAttributeValues(attributes, label) {
  if (!attributes) return;
  if (!isRecord(attributes)) throw new Error(`${label}: pointAttributes must be an object`);
  if (Array.isArray(attributes.normals)) {
    for (const [index, normal] of attributes.normals.entries()) {
      if (!Array.isArray(normal) || normal.length !== 3 || normal.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error(`${label}: pointAttributes.normals[${index}] must be a finite vec3`);
      }
      if (vecLength(normal) <= 1e-9) {
        throw new Error(`${label}: pointAttributes.normals[${index}] must be non-zero`);
      }
    }
  }
}

function slicePointAttributes(attributes, start, end) {
  if (!isRecord(attributes)) return null;
  const sliced = {};
  for (const key of POINT_ATTRIBUTE_KEYS) {
    if (Array.isArray(attributes[key])) sliced[key] = attributes[key].slice(start, end);
  }
  return Object.keys(sliced).length ? sliced : null;
}

function isSubpath(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validationMessages(result) {
  return result.errors.map((error) => formatError(result, error));
}

function assertSchemaValid(filePath) {
  const result = validateFile(filePath);
  if (result.errors.length) {
    throw new Error(validationMessages(result).join("\n"));
  }
}

function assertSchemaVersion(filePath, data, expectedVersion, label) {
  if (data?.schemaVersion !== expectedVersion) {
    throw new Error(`${filePath}: unsupported ${label} schemaVersion ${data?.schemaVersion || "<missing>"}; expected ${expectedVersion}`);
  }
}

function tempJsonPath(targetPath, label) {
  const absoluteTarget = path.resolve(targetPath);
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(absoluteTarget), `.${path.basename(absoluteTarget)}.${label}.${suffix}.tmp.json`);
}

function writeJsonAtomic(filePath, value, label, validateTemp = null) {
  const absolutePath = path.resolve(filePath);
  const tempPath = tempJsonPath(absolutePath, label);
  try {
    writeJson(tempPath, value);
    if (validateTemp) validateTemp(tempPath);
    fs.renameSync(tempPath, absolutePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function restoreBackupFile(backupPath, targetPath) {
  fs.copyFileSync(backupPath, targetPath);
  fs.rmSync(backupPath, { force: true });
}

function addRollbackRecovery(error, detail) {
  if (!error || typeof error !== "object") return;
  if (!Array.isArray(error.rollbackRecovery)) error.rollbackRecovery = [];
  error.rollbackRecovery.push({
    kind: detail.kind,
    targetPath: path.resolve(detail.targetPath),
    backupPath: detail.backupPath ? path.resolve(detail.backupPath) : null,
    message: detail.message || null
  });
}

function assertReferenceGeometryChunk(chunkPath, chunk) {
  assertSchemaValid(chunkPath);
  const data = readJson(chunkPath);
  if (data.schema !== POINT_CLOUD_CHUNK_SCHEMA_NAME) {
    throw new Error(`${chunkPath}: expected ${POINT_CLOUD_CHUNK_SCHEMA_NAME}`);
  }
  assertSchemaVersion(chunkPath, data, POINT_CLOUD_CHUNK_SCHEMA_VERSION, POINT_CLOUD_CHUNK_SCHEMA_NAME);
  if (data.id !== chunk.id) {
    throw new Error(`${chunkPath}: chunk id ${data.id || "<missing>"} does not match manifest chunk ${chunk.id}`);
  }
  if (data.objectId !== chunk.objectId) {
    throw new Error(`${chunkPath}: chunk objectId ${data.objectId || "<missing>"} does not match manifest object ${chunk.objectId}`);
  }
  assertReferenceBounds(chunkPath, `chunk ${data.id}.bounds`, data.bounds);
  assertReferenceBounds(chunkPath, `manifest chunk ${chunk.id}.bounds`, chunk.bounds);
  if (chunk.bounds && data.bounds && !sameBounds(chunk.bounds, data.bounds)) {
    throw new Error(`${chunkPath}: manifest chunk bounds do not match chunk sidecar bounds for ${chunk.id}`);
  }
  if (Array.isArray(data.points) && Number.isInteger(data.pointCount) && data.points.length !== data.pointCount) {
    throw new Error(`${chunkPath}: pointCount ${data.pointCount} does not match ${data.points.length} point(s)`);
  }
  if (Array.isArray(data.points) && data.bounds && !sameBounds(data.bounds, boundsFor(data.points))) {
    throw new Error(`${chunkPath}: chunk ${data.id}.bounds do not match point payload bounds`);
  }
  const pointCount = Array.isArray(data.points) ? data.points.length : data.pointCount;
  if (Number.isInteger(pointCount) && pointCount <= 0) {
    throw new Error(`${chunkPath}: point-cloud chunk ${data.id} must contain at least one point`);
  }
  if (Number.isInteger(chunk.pointCount) && Number.isInteger(pointCount) && chunk.pointCount !== pointCount) {
    throw new Error(`${chunkPath}: manifest pointCount ${chunk.pointCount} does not match chunk sidecar point count ${pointCount}`);
  }
  if (Number.isInteger(pointCount)) {
    assertPointAttributeLengths(data.pointAttributes, pointCount, `${chunkPath}: chunk ${data.id}`);
    assertPointAttributeValues(data.pointAttributes, `${chunkPath}: chunk ${data.id}`);
  }
  assertReferenceMetadataRecord(chunkPath, `chunk ${data.id}`, data.metadata);
}

function assertReferenceIndex(index, count, context) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`${context} index ${index} is outside 0..${Math.max(0, count - 1)}`);
  }
}

function assertReferenceObjectGeometry(absoluteOutput, objectId, object) {
  if (object?.kind !== "line-set" && object?.kind !== "mesh") return;
  const vertices = Array.isArray(object.vertices) ? object.vertices : [];
  if (object.kind === "line-set") {
    const lineSegments = Array.isArray(object.lineSegments) ? object.lineSegments : [];
    if (!lineSegments.length) throw new Error(`${absoluteOutput}: line-set ${objectId}.lineSegments must contain at least one segment`);
    for (const [segmentIndex, segment] of lineSegments.entries()) {
      assertReferenceIndex(segment?.[0], vertices.length, `${absoluteOutput}: line-set ${objectId}.lineSegments[${segmentIndex}][0]`);
      assertReferenceIndex(segment?.[1], vertices.length, `${absoluteOutput}: line-set ${objectId}.lineSegments[${segmentIndex}][1]`);
      if (segment?.[0] === segment?.[1]) {
        throw new Error(`${absoluteOutput}: line-set ${objectId}.lineSegments[${segmentIndex}] must reference two distinct vertices`);
      }
    }
  } else if (object.kind === "mesh") {
    const faces = Array.isArray(object.faces) ? object.faces : [];
    if (!faces.length) throw new Error(`${absoluteOutput}: mesh ${objectId}.faces must contain at least one face`);
    for (const [faceIndex, face] of faces.entries()) {
      for (const [indexIndex, vertexIndex] of (face || []).entries()) {
        assertReferenceIndex(vertexIndex, vertices.length, `${absoluteOutput}: mesh ${objectId}.faces[${faceIndex}][${indexIndex}]`);
      }
      if (new Set(face || []).size < 3) {
        throw new Error(`${absoluteOutput}: mesh ${objectId}.faces[${faceIndex}] must reference at least three distinct vertices`);
      }
    }
  }
}

function assertReferenceCoordinateSystem(absoluteOutput, coordinateSystem) {
  if (!coordinateSystem || typeof coordinateSystem !== "object" || Array.isArray(coordinateSystem)) {
    throw new Error(`${absoluteOutput}: asset.coordinateSystem must be an object`);
  }
  if (!finiteVec3(coordinateSystem.origin)) throw new Error(`${absoluteOutput}: asset.coordinateSystem.origin must be a finite vec3`);
  for (const key of ["axisX", "axisY", "axisZ"]) {
    const axis = coordinateSystem[key];
    if (!finiteVec3(axis)) throw new Error(`${absoluteOutput}: asset.coordinateSystem.${key} must be a finite vec3`);
    if (vecLength(axis) <= 1e-9) throw new Error(`${absoluteOutput}: asset.coordinateSystem.${key} must be non-zero`);
  }
  const determinant = vecDot(vecCross(coordinateSystem.axisX, coordinateSystem.axisY), coordinateSystem.axisZ);
  if (Math.abs(determinant) <= 1e-9) {
    throw new Error(`${absoluteOutput}: asset.coordinateSystem axes must form a non-degenerate 3D basis`);
  }
}

function assertReferenceBounds(absoluteOutput, label, bounds) {
  if (bounds === undefined) return;
  if (!bounds || typeof bounds !== "object" || Array.isArray(bounds)) {
    throw new Error(`${absoluteOutput}: ${label} must be an object`);
  }
  if (!finiteVec3(bounds.min)) throw new Error(`${absoluteOutput}: ${label}.min must be a finite vec3`);
  if (!finiteVec3(bounds.max)) throw new Error(`${absoluteOutput}: ${label}.max must be a finite vec3`);
  for (let axis = 0; axis < 3; axis += 1) {
    if (bounds.min[axis] > bounds.max[axis]) {
      throw new Error(`${absoluteOutput}: ${label}.min[${axis}] must be <= ${label}.max[${axis}]`);
    }
  }
}

function referenceMetadataError(absoluteOutput, label) {
  return new Error(`${absoluteOutput}: ${label}.metadata must be bounded path-free canonical metadata`);
}

function normalizedReferenceMetadataKey(key) {
  return String(key || "").replace(/[_.-]/g, "").toLowerCase();
}

function safeReferenceMetadataKey(key) {
  if (typeof key !== "string" || !REFERENCE_METADATA_KEY_PATTERN.test(key) || RESERVED_REFERENCE_IDS.has(key)) return false;
  const normalized = normalizedReferenceMetadataKey(key);
  if (REFERENCE_METADATA_FORBIDDEN_NORMALIZED_KEYS.has(normalized)) return false;
  return !normalized.endsWith("path") && !normalized.endsWith("directory");
}

function safeReferenceMetadataString(value) {
  if (typeof value !== "string") return false;
  if (!value || value.length > REFERENCE_METADATA_MAX_STRING_LENGTH) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (REFERENCE_METADATA_ALLOWED_SLASH_STRINGS.has(value)) return true;
  if (value.includes("\\") || value.includes("/")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return true;
}

function assertReferenceMetadataValue(absoluteOutput, label, value, depth = 0) {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw referenceMetadataError(absoluteOutput, label);
    return;
  }
  if (typeof value === "string") {
    if (!safeReferenceMetadataString(value)) throw referenceMetadataError(absoluteOutput, label);
    return;
  }
  if (Array.isArray(value)) {
    if (depth >= REFERENCE_METADATA_MAX_DEPTH || value.length > REFERENCE_METADATA_MAX_ARRAY_LENGTH) {
      throw referenceMetadataError(absoluteOutput, label);
    }
    for (const item of value) assertReferenceMetadataValue(absoluteOutput, label, item, depth + 1);
    return;
  }
  if (isRecord(value)) {
    if (depth >= REFERENCE_METADATA_MAX_DEPTH) throw referenceMetadataError(absoluteOutput, label);
    const entries = Object.entries(value);
    if (entries.length > REFERENCE_METADATA_MAX_ENTRY_COUNT) throw referenceMetadataError(absoluteOutput, label);
    for (const [key, child] of entries) {
      if (!safeReferenceMetadataKey(key)) throw referenceMetadataError(absoluteOutput, label);
      assertReferenceMetadataValue(absoluteOutput, label, child, depth + 1);
    }
    return;
  }
  throw referenceMetadataError(absoluteOutput, label);
}

function assertReferenceMetadataRecord(absoluteOutput, label, metadata) {
  if (metadata === undefined) return;
  if (!isRecord(metadata)) throw referenceMetadataError(absoluteOutput, label);
  const encoded = JSON.stringify(metadata);
  if (typeof encoded !== "string" || encoded.length > REFERENCE_METADATA_MAX_JSON_LENGTH) {
    throw referenceMetadataError(absoluteOutput, label);
  }
  assertReferenceMetadataValue(absoluteOutput, label, metadata);
}

function sameBounds(a, b) {
  return samePoint(a?.min, b?.min) && samePoint(a?.max, b?.max);
}

function payloadBoundsForReferenceObject(object, chunksById = new Map()) {
  if (object?.kind === "line-set" || object?.kind === "mesh") {
    return Array.isArray(object.vertices) && object.vertices.length ? boundsFor(object.vertices) : null;
  }
  if (object?.kind === "point-cloud") {
    if (Array.isArray(object.points) && object.points.length) return boundsFor(object.points);
    if (Array.isArray(object.chunkIds) && object.chunkIds.length) {
      return completeUnionBounds(object.chunkIds.map((chunkId) => chunksById.get(chunkId)?.bounds));
    }
  }
  return null;
}

export function validateReferenceGeometryOutput(outputPath, { allowChunkableInlinePointCloudBounds = false, pointCloudChunkSize = null } = {}) {
  const absoluteOutput = path.resolve(outputPath);
  assertSchemaValid(absoluteOutput);
  const data = readJson(absoluteOutput);
  if (data.schema !== REFERENCE_GEOMETRY_SCHEMA_NAME) {
    throw new Error(`${absoluteOutput}: expected ${REFERENCE_GEOMETRY_SCHEMA_NAME}`);
  }
  assertSchemaVersion(absoluteOutput, data, REFERENCE_GEOMETRY_SCHEMA_VERSION, REFERENCE_GEOMETRY_SCHEMA_NAME);
  const chunkableInlinePointCloudSize = allowChunkableInlinePointCloudBounds ? normalizedPointCloudChunkSize(pointCloudChunkSize) : null;
  assertReferenceCoordinateSystem(absoluteOutput, data.asset?.coordinateSystem);
  assertReferenceBounds(absoluteOutput, "asset.bounds", data.asset?.bounds);
  const layers = data.layers || {};
  const objects = data.objects || {};
  const chunkIds = new Set();
  const chunksById = new Map();
  const referencedChunkIds = new Set();
  for (const [layerId, layer] of Object.entries(layers)) {
    if (layer?.id !== layerId) throw new Error(`${absoluteOutput}: layer key ${layerId} does not match id ${layer?.id || "<missing>"}`);
  }
  for (const chunk of data.chunks || []) {
    if (!chunk?.id) continue;
    if (chunkIds.has(chunk.id)) throw new Error(`${absoluteOutput}: duplicate chunk id ${chunk.id}`);
    chunkIds.add(chunk.id);
    chunksById.set(chunk.id, chunk);
    const chunkOwner = objects[chunk.objectId];
    if (!chunkOwner) throw new Error(`${absoluteOutput}: chunk ${chunk.id} points to missing object ${chunk.objectId}`);
    if (chunkOwner.kind !== "point-cloud") {
      throw new Error(`${absoluteOutput}: chunk ${chunk.id} points to non-point-cloud object ${chunk.objectId}`);
    }
    if (!chunk.path) throw new Error(`${absoluteOutput}: chunk ${chunk.id} is missing path`);
    if (Number.isInteger(chunk.pointCount) && chunk.pointCount <= 0) {
      throw new Error(`${absoluteOutput}: chunk ${chunk.id}.pointCount must be greater than zero`);
    }
    assertReferenceBounds(absoluteOutput, `chunk ${chunk.id}.bounds`, chunk.bounds);
    const chunkPath = safeManifestSidecarPath(absoluteOutput, chunk.path, `chunk ${chunk.id}`);
    if (!fs.existsSync(chunkPath)) throw new Error(`${absoluteOutput}: chunk ${chunk.id} points to missing file ${chunk.path}`);
    assertReferenceGeometryChunk(chunkPath, chunk);
  }
  for (const [objectId, object] of Object.entries(objects)) {
    if (object?.id !== objectId) throw new Error(`${absoluteOutput}: object key ${objectId} does not match id ${object?.id || "<missing>"}`);
    if (object.layer && !layers[object.layer]) throw new Error(`${absoluteOutput}: object ${objectId} references missing layer ${object.layer}`);
    assertReferenceBounds(absoluteOutput, `object ${objectId}.bounds`, object.bounds);
    assertReferenceMetadataRecord(absoluteOutput, `object ${objectId}`, object.metadata);
    assertReferenceObjectGeometry(absoluteOutput, objectId, object);
    const payloadBounds = object?.kind === "line-set" || object?.kind === "mesh"
      ? payloadBoundsForReferenceObject(object, chunksById)
      : null;
    if (object.bounds && payloadBounds && !sameBounds(object.bounds, payloadBounds)) {
      throw new Error(`${absoluteOutput}: object ${objectId}.bounds do not match object payload bounds`);
    }
    if (object?.kind !== "point-cloud") continue;
    if (Array.isArray(object.points) && Array.isArray(object.chunkIds) && object.chunkIds.length) {
      throw new Error(`${absoluteOutput}: point-cloud ${objectId} must not mix inline points and chunkIds`);
    }
    if (Array.isArray(object.points) && !object.points.length) {
      throw new Error(`${absoluteOutput}: point-cloud ${objectId}.points must contain at least one point`);
    }
    if (!Array.isArray(object.points) && Array.isArray(object.chunkIds) && !object.chunkIds.length) {
      throw new Error(`${absoluteOutput}: point-cloud ${objectId}.chunkIds must contain at least one chunk id`);
    }
    if (Array.isArray(object.chunkIds)) {
      const objectChunkIds = new Set();
      for (const chunkId of object.chunkIds) {
        if (objectChunkIds.has(chunkId)) throw new Error(`${absoluteOutput}: point-cloud ${objectId}.chunkIds contains duplicate chunk id ${chunkId}`);
        objectChunkIds.add(chunkId);
        referencedChunkIds.add(chunkId);
      }
    }
    if (object.pointAttributes && !Array.isArray(object.points)) {
      throw new Error(`${absoluteOutput}: point-cloud ${objectId} stores pointAttributes without inline points; chunked attributes must live in point-cloud chunk sidecars`);
    }
    if (Array.isArray(object.points)) {
      assertPointAttributeLengths(object.pointAttributes, object.points.length, `${absoluteOutput}: point-cloud ${objectId}`);
      assertPointAttributeValues(object.pointAttributes, `${absoluteOutput}: point-cloud ${objectId}`);
      if (object.bounds && !sameBounds(object.bounds, boundsFor(object.points))) {
        const boundsWillBeRecomputedDuringChunking = chunkableInlinePointCloudSize && object.points.length > chunkableInlinePointCloudSize;
        if (!boundsWillBeRecomputedDuringChunking) {
          throw new Error(`${absoluteOutput}: point-cloud ${objectId}.bounds do not match point payload bounds`);
        }
      }
    }
    for (const chunkId of object.chunkIds || []) {
      if (!chunkIds.has(chunkId)) throw new Error(`${absoluteOutput}: point-cloud ${objectId} references missing chunk ${chunkId}`);
      const chunk = (data.chunks || []).find((item) => item?.id === chunkId);
      if (chunk?.objectId !== objectId) throw new Error(`${absoluteOutput}: point-cloud ${objectId} references chunk ${chunkId} owned by ${chunk?.objectId || "<missing>"}`);
    }
    if (object.bounds && Array.isArray(object.chunkIds) && object.chunkIds.length) {
      const objectChunkBounds = completeUnionBounds(object.chunkIds.map((chunkId) => chunksById.get(chunkId)?.bounds));
      if (!objectChunkBounds) {
        throw new Error(`${absoluteOutput}: point-cloud ${objectId}.bounds cannot be verified without complete referenced chunk bounds`);
      }
      if (!sameBounds(object.bounds, objectChunkBounds)) {
        throw new Error(`${absoluteOutput}: point-cloud ${objectId}.bounds do not match referenced chunk bounds`);
      }
    }
  }
  if (data.asset?.bounds) {
    const objectBounds = Object.values(objects).map((object) => payloadBoundsForReferenceObject(object, chunksById));
    const assetPayloadBounds = completeUnionBounds(objectBounds);
    if (!assetPayloadBounds) {
      throw new Error(`${absoluteOutput}: asset.bounds cannot be verified without complete reference object payload bounds`);
    }
    if (!sameBounds(data.asset.bounds, assetPayloadBounds)) {
      throw new Error(`${absoluteOutput}: asset.bounds do not match reference object payload bounds`);
    }
  }
  for (const chunk of data.chunks || []) {
    if (chunk?.id && !referencedChunkIds.has(chunk.id)) {
      throw new Error(`${absoluteOutput}: chunk ${chunk.id} is not referenced by point-cloud ${chunk.objectId}.chunkIds`);
    }
  }
  for (const [diagnosticIndex, diagnostic] of (data.diagnostics || []).entries()) {
    if (diagnostic?.objectId && !objects[diagnostic.objectId]) {
      throw new Error(`${absoluteOutput}: diagnostics[${diagnosticIndex}].objectId ${diagnostic.objectId} points to a missing reference object`);
    }
    for (const [objectRefIndex, objectRef] of (diagnostic?.objectRefs || []).entries()) {
      if (!objects[objectRef]) {
        throw new Error(`${absoluteOutput}: diagnostics[${diagnosticIndex}].objectRefs[${objectRefIndex}] ${objectRef} points to a missing reference object`);
      }
    }
  }
  return data;
}

function loadAdapterConfig(configPath) {
  if (!configPath) return null;
  const absolutePath = path.resolve(configPath);
  assertSchemaValid(absolutePath);
  const config = readJson(absolutePath);
  if (!isRecord(config) || !isRecord(config.adapters)) {
    throw new Error(`${absolutePath}: external adapter config must contain an adapters object`);
  }
  validateAdapterConfigPlaceholders(absolutePath, config);
  return { path: absolutePath, data: config };
}

function adapterPlaceholderKeysInValue(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{([a-zA-Z0-9_-]+)\}/g)].map((match) => match[1]);
}

function hasAdapterPlaceholderSyntax(value) {
  return adapterPlaceholderKeysInValue(value).length > 0;
}

function validateAdapterPlaceholderValue(errors, adapterKey, field, value) {
  for (const key of adapterPlaceholderKeysInValue(value)) {
    if (!ADAPTER_PLACEHOLDER_KEY_SET.has(key)) {
      errors.push(`adapters.${adapterKey}.${field} uses unsupported placeholder {${key}}`);
    }
  }
}

function validateAdapterConfigPlaceholders(configPath, config) {
  const errors = [];
  for (const [adapterKey, adapter] of Object.entries(config.adapters || {})) {
    validateAdapterPlaceholderValue(errors, adapterKey, "command", adapter.command);
    if (typeof adapter.cwd === "string") validateAdapterPlaceholderValue(errors, adapterKey, "cwd", adapter.cwd);
    for (const [index, arg] of (adapter.args || []).entries()) {
      validateAdapterPlaceholderValue(errors, adapterKey, `args[${index}]`, arg);
    }
    for (const [index, requiredFile] of (adapter.requiredFiles || []).entries()) {
      validateAdapterPlaceholderValue(errors, adapterKey, `requiredFiles[${index}]`, requiredFile);
    }
    for (const [index, requiredDirectory] of (adapter.requiredDirectories || []).entries()) {
      validateAdapterPlaceholderValue(errors, adapterKey, `requiredDirectories[${index}]`, requiredDirectory);
    }
    for (const [index, requiredCommand] of (adapter.requiredCommands || []).entries()) {
      validateAdapterPlaceholderValue(errors, adapterKey, `requiredCommands[${index}]`, requiredCommand);
    }
    if (isRecord(adapter.env)) {
      for (const [envKey, value] of Object.entries(adapter.env)) {
        validateAdapterPlaceholderValue(errors, adapterKey, `env.${envKey}`, value);
      }
    }
  }
  if (errors.length) {
    throw new Error(`${configPath}: unsupported adapter placeholder(s): ${uniqueValues(errors).join("; ")}`);
  }
}

function adapterFormats(adapter, key) {
  if (Array.isArray(adapter.formats)) return adapter.formats.map(normalizeFormat);
  if (adapter.format) return [normalizeFormat(adapter.format)];
  return [normalizeFormat(key)];
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function adapterRequestContractFingerprint(contract) {
  const payload = {
    schema: contract.schema || null,
    schemaVersion: contract.schemaVersion || null,
    schemaPath: contract.schemaPath || null,
    requiredRequestFields: Array.isArray(contract.requiredRequestFields) ? contract.requiredRequestFields : [],
    optionalAdapterContextFields: Array.isArray(contract.optionalAdapterContextFields) ? contract.optionalAdapterContextFields : [],
    sourceIdentityFields: Array.isArray(contract.sourceIdentityFields) ? contract.sourceIdentityFields : [],
    stagePathFields: Array.isArray(contract.stagePathFields) ? contract.stagePathFields : [],
    schemaContractFields: Array.isArray(contract.schemaContractFields) ? contract.schemaContractFields : [],
    requestedFormatPolicy: isRecord(contract.requestedFormatPolicy) ? contract.requestedFormatPolicy : null,
    placeholderKeys: Array.isArray(contract.placeholderKeys) ? contract.placeholderKeys : [],
    outputModes: Array.isArray(contract.outputModes) ? contract.outputModes : [],
    defaultAdapterTimeoutMs: Number.isInteger(contract.defaultAdapterTimeoutMs) ? contract.defaultAdapterTimeoutMs : null,
    defaultPointCloudChunkSize: Number.isInteger(contract.defaultPointCloudChunkSize) ? contract.defaultPointCloudChunkSize : null,
    defaultReferenceUnits: contract.defaultReferenceUnits || null,
    defaultPointCloudChunkPathPrefix: contract.defaultPointCloudChunkPathPrefix || null,
    requestFingerprintField: contract.requestFingerprintField || null,
    stagePaths: isRecord(contract.stagePaths) ? contract.stagePaths : null,
    validatorCliPath: contract.validatorCliPath || null,
    validatorCliFlags: Array.isArray(contract.validatorCliFlags) ? contract.validatorCliFlags : [],
    validatorSuccessFields: Array.isArray(contract.validatorSuccessFields) ? contract.validatorSuccessFields : [],
    validatorRequestCorrelationFields: Array.isArray(contract.validatorRequestCorrelationFields) ? contract.validatorRequestCorrelationFields : [],
    validatorErrorEnvelopeFields: Array.isArray(contract.validatorErrorEnvelopeFields) ? contract.validatorErrorEnvelopeFields : [],
    validatorErrorPrimaryFields: Array.isArray(contract.validatorErrorPrimaryFields) ? contract.validatorErrorPrimaryFields : [],
    validatorErrorCodes: Array.isArray(contract.validatorErrorCodes) ? contract.validatorErrorCodes : [],
    validatorErrorKinds: Array.isArray(contract.validatorErrorKinds) ? contract.validatorErrorKinds : []
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function requestedFormatAliasesByCanonicalFormat() {
  const aliasesByFormat = Object.fromEntries(REFERENCE_ADAPTER_REQUEST_CANONICAL_FORMAT_TOKENS.map((format) => [format, []]));
  for (const [format, spec] of Object.entries(FORMAT_REGISTRY)) {
    const canonicalFormat = spec.aliasFor || format;
    if (!aliasesByFormat[canonicalFormat] || spec.adapterCapable !== true) continue;
    pushUnique(aliasesByFormat[canonicalFormat], format);
  }
  return aliasesByFormat;
}

function sourceRequestedFormatAliasesByFormat() {
  const aliasesByCanonicalFormat = requestedFormatAliasesByCanonicalFormat();
  return {
    ...aliasesByCanonicalFormat,
    e57pointcloud: [...aliasesByCanonicalFormat.e57],
    json: ["json"]
  };
}

function sourceFileExtensionsByFormat() {
  return {
    dxf: canonicalFileExtensions("dxf"),
    dwg: canonicalFileExtensions("dwg"),
    step: canonicalFileExtensions("step"),
    ifc: canonicalFileExtensions("ifc"),
    e57: canonicalFileExtensions("e57"),
    e57pointcloud: canonicalFileExtensions("e57"),
    json: canonicalFileExtensions("json")
  };
}

function adapterConfigContractFingerprint(contract) {
  const payload = {
    schema: contract.schema || null,
    schemaVersion: contract.schemaVersion || null,
    schemaPath: contract.schemaPath || null,
    configFields: Array.isArray(contract.configFields) ? contract.configFields : [],
    adapterFields: Array.isArray(contract.adapterFields) ? contract.adapterFields : [],
    adapterFormatSelectionFields: Array.isArray(contract.adapterFormatSelectionFields) ? contract.adapterFormatSelectionFields : [],
    dependencyFields: Array.isArray(contract.dependencyFields) ? contract.dependencyFields : [],
    templatedFields: Array.isArray(contract.templatedFields) ? contract.templatedFields : [],
    rawConfigFields: Array.isArray(contract.rawConfigFields) ? contract.rawConfigFields : [],
    placeholderKeys: Array.isArray(contract.placeholderKeys) ? contract.placeholderKeys : [],
    rawConfigPlaceholderPolicy: contract.rawConfigPlaceholderPolicy || null,
    outputModes: Array.isArray(contract.outputModes) ? contract.outputModes : [],
    defaultOutputMode: contract.defaultOutputMode || null,
    defaultAdapterTimeoutMs: Number.isInteger(contract.defaultAdapterTimeoutMs) ? contract.defaultAdapterTimeoutMs : null,
    defaultAdapterStreamMaxBufferBytes: Number.isInteger(contract.defaultAdapterStreamMaxBufferBytes) ? contract.defaultAdapterStreamMaxBufferBytes : null,
    adapterFormatTokens: Array.isArray(contract.adapterFormatTokens) ? contract.adapterFormatTokens : [],
    adapterKeyPattern: contract.adapterKeyPattern || null,
    envNamePattern: contract.envNamePattern || null,
    supportsShell: contract.supportsShell ?? null,
    adapterRegistryFingerprintFields: Array.isArray(contract.adapterRegistryFingerprintFields) ? contract.adapterRegistryFingerprintFields : [],
    exampleConfigPath: contract.exampleConfigPath || null,
    bundledAdapterWrapperFields: Array.isArray(contract.bundledAdapterWrapperFields) ? contract.bundledAdapterWrapperFields : [],
    bundledAdapterWrappers: Array.isArray(contract.bundledAdapterWrappers) ? contract.bundledAdapterWrappers : []
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterPreflightContractFingerprint(contract = {}) {
  const payload = {
    discoveryCommand: contract.discoveryCommand || null,
    relatedDiscoveryCommands: Array.isArray(contract.relatedDiscoveryCommands) ? contract.relatedDiscoveryCommands : [],
    cliFlags: Array.isArray(contract.cliFlags) ? contract.cliFlags : [],
    requiredInputs: Array.isArray(contract.requiredInputs) ? contract.requiredInputs : [],
    optionalInputs: Array.isArray(contract.optionalInputs) ? contract.optionalInputs : [],
    sideEffects: isRecord(contract.sideEffects) ? contract.sideEffects : null,
    topLevelFields: Array.isArray(contract.topLevelFields) ? contract.topLevelFields : [],
    registryDecisionField: contract.registryDecisionField || null,
    registryDecisionFields: Array.isArray(contract.registryDecisionFields) ? contract.registryDecisionFields : [],
    preflightDecisionField: contract.preflightDecisionField || null,
    preflightDecisionFields: Array.isArray(contract.preflightDecisionFields) ? contract.preflightDecisionFields : [],
    adapterTargetFormatCoverageField: contract.adapterTargetFormatCoverageField || null,
    adapterTargetFormatCoverageFields: Array.isArray(contract.adapterTargetFormatCoverageFields) ? contract.adapterTargetFormatCoverageFields : [],
    requestedFields: Array.isArray(contract.requestedFields) ? contract.requestedFields : [],
    adapterEntryFields: Array.isArray(contract.adapterEntryFields) ? contract.adapterEntryFields : [],
    requiredFileEntryFields: Array.isArray(contract.requiredFileEntryFields) ? contract.requiredFileEntryFields : [],
    requiredDirectoryEntryFields: Array.isArray(contract.requiredDirectoryEntryFields) ? contract.requiredDirectoryEntryFields : [],
    requiredCommandEntryFields: Array.isArray(contract.requiredCommandEntryFields) ? contract.requiredCommandEntryFields : [],
    requiredEnvEntryFields: Array.isArray(contract.requiredEnvEntryFields) ? contract.requiredEnvEntryFields : [],
    diagnosticFields: Array.isArray(contract.diagnosticFields) ? contract.diagnosticFields : [],
    diagnosticCodes: Array.isArray(contract.diagnosticCodes) ? contract.diagnosticCodes : [],
    registryFingerprintField: contract.registryFingerprintField || null,
    preflightFingerprintField: contract.preflightFingerprintField || null,
    adapterRegistryFingerprintField: contract.adapterRegistryFingerprintField || null,
    adapterPreflightFingerprintField: contract.adapterPreflightFingerprintField || null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterRequestFingerprint(request = {}) {
  const { adapterRequestFingerprint: _fingerprint, ...payload } = request;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterRequestEvidenceFingerprint(request = {}) {
  const payload = {
    schema: request.schema || null,
    schemaVersion: request.schemaVersion || null,
    schemaVersions: isRecord(request.schemaVersions) ? {
      adapterRequest: request.schemaVersions.adapterRequest || null,
      referenceGeometry: request.schemaVersions.referenceGeometry || null,
      pointCloudChunk: request.schemaVersions.pointCloudChunk || null
    } : null,
    format: request.format || null,
    requestedFormat: request.requestedFormat || null,
    outputMode: request.outputMode || null,
    sourceFileExtension: typeof request.sourceFileExtension === "string" ? request.sourceFileExtension : null,
    sourceFileSizeBytes: Number.isInteger(request.sourceFileSizeBytes) ? request.sourceFileSizeBytes : null,
    sourceFileModifiedTime: request.sourceFileModifiedTime || null,
    sourceStatFingerprint: request.sourceStatFingerprint || null,
    adapterKey: request.adapterKey || null,
    adapterConfigFileSizeBytes: Number.isInteger(request.adapterConfigFileSizeBytes) ? request.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: request.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: request.adapterConfigStatFingerprint || null,
    adapterRegistryFingerprint: request.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: request.adapterRegistryAdapterFingerprint || null,
    assetId: request.assetId || null,
    units: request.units || null,
    pointCloudChunkSize: Number.isInteger(request.pointCloudChunkSize) ? request.pointCloudChunkSize : null,
    timeoutMs: Number.isInteger(request.timeoutMs) ? request.timeoutMs : null,
    chunkPathPrefix: request.chunkPathPrefix || null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function referenceGeometryAdapterRequestContractMetadata() {
  const contract = {
    schema: ADAPTER_REQUEST_SCHEMA_NAME,
    schemaVersion: ADAPTER_REQUEST_SCHEMA_VERSION,
    schemaPath: ADAPTER_REQUEST_SCHEMA,
    requiredRequestFields: [
      "$schema",
      "schema",
      "schemaVersion",
      "schemaVersions",
      "schemas",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "input",
      "sourceDirectory",
      "sourceFileName",
      "sourceFileStem",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "output",
      "outputDir",
      "stageDir",
      "request",
      "scratchDir",
      "outputFileName",
      "outputFileStem",
      "chunkDir",
      "chunkPathPrefix",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "outputMode",
      "format",
      "requestedFormat",
      "assetId",
      "name",
      "units",
      "pointCloudChunkSize",
      "timeoutMs"
    ],
    optionalAdapterContextFields: [
      "adapterKey",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint"
    ],
    sourceIdentityFields: [
      "input",
      "sourceDirectory",
      "sourceFileName",
      "sourceFileStem",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "format",
      "requestedFormat"
    ],
    stagePathFields: [
      "output",
      "outputDir",
      "stageDir",
      "request",
      "scratchDir",
      "chunkDir",
      "chunkPathPrefix",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath"
    ],
    schemaContractFields: [
      "schemaVersions",
      "schemas",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    requestedFormatPolicy: {
      canonicalFormatField: "format",
      requestedFormatField: "requestedFormat",
      canonicalFormatTokens: [...REFERENCE_ADAPTER_REQUEST_CANONICAL_FORMAT_TOKENS],
      requestedFormatAliasesByFormat: requestedFormatAliasesByCanonicalFormat(),
      schemaEnforced: true,
      standaloneValidatorEnforced: true,
      checkedInBridgeWrappersEnforced: true,
      mismatchErrorCode: "adapter-request-invalid",
      policy: "requestedFormat must be a canonical token or alias belonging to the requested canonical format family"
    },
    sourceFileExtensionPolicy: {
      canonicalFormatField: "format",
      sourceFileExtensionField: "sourceFileExtension",
      canonicalFormatTokens: [...REFERENCE_ADAPTER_REQUEST_CANONICAL_FORMAT_TOKENS],
      sourceFileExtensionsByFormat: {
        dxf: ["", "dxf"],
        dwg: ["", "dwg"],
        step: ["", "step", "stp", "p21", "stpnc"],
        ifc: ["", "ifc", "ifcxml", "ifczip"],
        e57: ["", "e57"]
      },
      schemaEnforced: true,
      standaloneValidatorEnforced: true,
      checkedInBridgeWrappersEnforced: true,
      mismatchErrorCode: "adapter-request-invalid",
      policy: "sourceFileExtension must be empty or a real source extension belonging to the requested canonical format family"
    },
    placeholderKeys: [...ADAPTER_PLACEHOLDER_KEYS],
    outputModes: ["file", "stdout"],
    defaultAdapterTimeoutMs: DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS,
    defaultPointCloudChunkSize: DEFAULT_POINT_CLOUD_CHUNK_SIZE,
    defaultReferenceUnits: DEFAULT_REFERENCE_UNITS,
    defaultPointCloudChunkPathPrefix: DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX,
    requestFingerprintField: "adapterRequestFingerprint",
    requestEvidenceFingerprintField: "adapterRequestEvidenceFingerprint",
    requestEvidenceFingerprintPolicy: "path-free-source-adapter-config-and-request-options",
    stagePaths: {
      scratchDirName: "scratch",
      chunkDirName: "chunks",
      adapterLogFileName: "reference-adapter.log",
      adapterStdoutFileName: "reference-adapter.stdout.log",
      adapterStderrFileName: "reference-adapter.stderr.log"
    },
    validatorCliPath: path.join(ROOT, "tools/reference-geometry/adapters/validate_adapter_request.mjs"),
    validatorCliFlags: ["--request", "--json", "--list-contract"],
    validatorSuccessFields: [
      "ok",
      "adapterRequestContractVersion",
      "requestPath",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "inputPath",
      "outputPath",
      "outputDir",
      "stageDir",
      "scratchDir",
      "chunkDir",
      "chunkPathPrefix",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "assetId",
      "assetUnits",
      "pointCloudChunkSize",
      "timeoutMs",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    validatorErrorEnvelopeFields: [
      "ok",
      "adapterRequestContractVersion",
      "errors"
    ],
    validatorErrorPrimaryFields: [
      "message",
      "adapterRequestErrorCode",
      "adapterRequestValidationKind",
      "requestPath",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "inputPath",
      "outputPath",
      "outputDir",
      "stageDir",
      "scratchDir",
      "chunkDir",
      "chunkPathPrefix",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "assetId",
      "assetUnits",
      "pointCloudChunkSize",
      "timeoutMs",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    validatorRequestCorrelationFields: [
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "inputPath",
      "outputPath",
      "outputDir",
      "stageDir",
      "scratchDir",
      "chunkDir",
      "chunkPathPrefix",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "assetId",
      "assetUnits",
      "pointCloudChunkSize",
      "timeoutMs",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    validatorErrorCodes: [
      "adapter-request-cli-option-missing",
      "adapter-request-cli-option-unknown",
      "adapter-request-missing",
      "adapter-request-read-error",
      "adapter-request-json-invalid",
      "adapter-request-invalid"
    ],
    validatorErrorKinds: [
      "cli",
      "request"
    ]
  };
  contract.adapterRequestContractFingerprint = adapterRequestContractFingerprint(contract);
  return contract;
}

export function referenceGeometryAdapterConfigContractMetadata() {
  const bundledAdapterWrappers = [
    {
      key: "dwg-dxf-bridge",
      cliPath: path.join(ROOT, "tools/reference-geometry/adapters/dwg_to_dxf_bridge_adapter.mjs"),
      targetFormatTokens: ["dxf", "dwg"],
      sourceFormatTokens: ["dwg", "dxf"],
      externalToolEnvironmentVariables: [
        "BOBERCAD_DWG_TO_DXF_COMMAND",
        "BOBERCAD_DWG_TO_DXF_OUTPUT",
        "BOBERCAD_DWG_TO_DXF_ARG_<index>",
        "BOBERCAD_DWG_TO_DXF_ARGS_JSON",
        "BOBERCAD_DWG_TO_DXF_ARGS",
        "BOBERCAD_DWG_TO_DXF_CWD",
        "BOBERCAD_DWG_TO_DXF_SHELL",
        "BOBERCAD_DWG_TO_DXF_STREAM_MAX_BUFFER_BYTES"
      ],
      externalToolTemplatedEnvKeys: [
        "BOBERCAD_DWG_TO_DXF_COMMAND",
        "BOBERCAD_DWG_TO_DXF_OUTPUT",
        "BOBERCAD_DWG_TO_DXF_ARG_<index>",
        "BOBERCAD_DWG_TO_DXF_ARGS_JSON",
        "BOBERCAD_DWG_TO_DXF_ARGS",
        "BOBERCAD_DWG_TO_DXF_CWD"
      ],
      externalToolRawConfigEnvKeys: [
        "BOBERCAD_DWG_TO_DXF_SHELL",
        "BOBERCAD_DWG_TO_DXF_STREAM_MAX_BUFFER_BYTES"
      ],
      externalToolRawConfigPlaceholderPolicy: "no-placeholders",
      externalToolArgumentTemplateModes: ["indexed-env", "json-array-env", "no-shell-string-env", "default"],
      externalToolArgumentPrecedence: [
        "BOBERCAD_DWG_TO_DXF_ARG_<index>",
        "BOBERCAD_DWG_TO_DXF_ARGS_JSON",
        "BOBERCAD_DWG_TO_DXF_ARGS",
        "default"
      ],
      externalToolDefaultArgumentTemplate: ["--input", "{input}", "--output", "{dxf}"],
      emitsCanonicalKinds: ["line-set", "mesh", "point-cloud"],
      validatesAdapterRequest: true,
      validatesAdapterOutput: true
    },
    {
      key: "cad-obj-mesh",
      cliPath: path.join(ROOT, "tools/reference-geometry/adapters/cad_obj_mesh_adapter.mjs"),
      targetFormatTokens: ["step", "ifc"],
      sourceFormatTokens: ["step", "stp", "p21", "stpnc", "ifc", "ifcxml", "ifczip"],
      externalToolEnvironmentVariables: [
        "BOBERCAD_CAD_TO_OBJ_COMMAND",
        "BOBERCAD_CAD_TO_OBJ_OUTPUT",
        "BOBERCAD_CAD_TO_OBJ_ARG_<index>",
        "BOBERCAD_CAD_TO_OBJ_ARGS_JSON",
        "BOBERCAD_CAD_TO_OBJ_ARGS",
        "BOBERCAD_CAD_TO_OBJ_CWD",
        "BOBERCAD_CAD_TO_OBJ_SHELL",
        "BOBERCAD_CAD_TO_OBJ_STREAM_MAX_BUFFER_BYTES",
        "BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT"
      ],
      externalToolTemplatedEnvKeys: [
        "BOBERCAD_CAD_TO_OBJ_COMMAND",
        "BOBERCAD_CAD_TO_OBJ_OUTPUT",
        "BOBERCAD_CAD_TO_OBJ_ARG_<index>",
        "BOBERCAD_CAD_TO_OBJ_ARGS_JSON",
        "BOBERCAD_CAD_TO_OBJ_ARGS",
        "BOBERCAD_CAD_TO_OBJ_CWD"
      ],
      externalToolRawConfigEnvKeys: [
        "BOBERCAD_CAD_TO_OBJ_SHELL",
        "BOBERCAD_CAD_TO_OBJ_STREAM_MAX_BUFFER_BYTES",
        "BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT"
      ],
      externalToolRawConfigPlaceholderPolicy: "no-placeholders",
      externalToolArgumentTemplateModes: ["indexed-env", "json-array-env", "no-shell-string-env", "default"],
      externalToolArgumentPrecedence: [
        "BOBERCAD_CAD_TO_OBJ_ARG_<index>",
        "BOBERCAD_CAD_TO_OBJ_ARGS_JSON",
        "BOBERCAD_CAD_TO_OBJ_ARGS",
        "default"
      ],
      externalToolDefaultArgumentTemplate: ["--input", "{input}", "--output", "{obj}"],
      emitsCanonicalKinds: ["line-set", "mesh", "point-cloud"],
      validatesAdapterRequest: true,
      validatesAdapterOutput: true
    },
    {
      key: "e57-xyz-pointcloud",
      cliPath: path.join(ROOT, "tools/reference-geometry/adapters/e57_xyz_pointcloud_adapter.mjs"),
      targetFormatTokens: ["e57pointcloud"],
      sourceFormatTokens: ["e57", "e57pointcloud", "e57pc"],
      externalToolEnvironmentVariables: [
        "BOBERCAD_E57_TO_XYZ_COMMAND",
        "BOBERCAD_E57_TO_XYZ_OUTPUT",
        "BOBERCAD_E57_TO_XYZ_ARG_<index>",
        "BOBERCAD_E57_TO_XYZ_ARGS_JSON",
        "BOBERCAD_E57_TO_XYZ_ARGS",
        "BOBERCAD_E57_TO_XYZ_CWD",
        "BOBERCAD_E57_TO_XYZ_SHELL",
        "BOBERCAD_E57_TO_XYZ_STREAM_MAX_BUFFER_BYTES",
        "BOBERCAD_E57_XYZ_COLUMNS",
        "BOBERCAD_E57_XYZ_DELIMITER",
        "BOBERCAD_E57_XYZ_RGB_NORMALIZED"
      ],
      externalToolTemplatedEnvKeys: [
        "BOBERCAD_E57_TO_XYZ_COMMAND",
        "BOBERCAD_E57_TO_XYZ_OUTPUT",
        "BOBERCAD_E57_TO_XYZ_ARG_<index>",
        "BOBERCAD_E57_TO_XYZ_ARGS_JSON",
        "BOBERCAD_E57_TO_XYZ_ARGS",
        "BOBERCAD_E57_TO_XYZ_CWD"
      ],
      externalToolRawConfigEnvKeys: [
        "BOBERCAD_E57_TO_XYZ_SHELL",
        "BOBERCAD_E57_TO_XYZ_STREAM_MAX_BUFFER_BYTES",
        "BOBERCAD_E57_XYZ_COLUMNS",
        "BOBERCAD_E57_XYZ_DELIMITER",
        "BOBERCAD_E57_XYZ_RGB_NORMALIZED"
      ],
      externalToolRawConfigPlaceholderPolicy: "no-placeholders",
      externalToolArgumentTemplateModes: ["indexed-env", "json-array-env", "no-shell-string-env", "default"],
      externalToolArgumentPrecedence: [
        "BOBERCAD_E57_TO_XYZ_ARG_<index>",
        "BOBERCAD_E57_TO_XYZ_ARGS_JSON",
        "BOBERCAD_E57_TO_XYZ_ARGS",
        "default"
      ],
      externalToolDefaultArgumentTemplate: ["--input", "{input}", "--output", "{xyz}"],
      emitsCanonicalKinds: ["point-cloud"],
      validatesAdapterRequest: true,
      validatesAdapterOutput: true
    }
  ];
  const contract = {
    schema: ADAPTER_CONFIG_SCHEMA_NAME,
    schemaVersion: ADAPTER_CONFIG_SCHEMA_VERSION,
    schemaPath: ADAPTER_CONFIG_SCHEMA,
    configFields: ["$schema", "schema", "schemaVersion", "adapters"],
    adapterFields: [
      "format",
      "formats",
      "command",
      "args",
      "cwd",
      "env",
      "requiredFiles",
      "requiredDirectories",
      "requiredCommands",
      "requiredEnv",
      "outputMode",
      "timeoutMs",
      "streamMaxBufferBytes",
      "shell",
      "description"
    ],
    adapterFormatSelectionFields: ["format", "formats"],
    dependencyFields: ["requiredFiles", "requiredDirectories", "requiredCommands", "requiredEnv"],
    templatedFields: ["command", "args", "cwd", "env", "requiredFiles", "requiredDirectories", "requiredCommands"],
    rawConfigFields: ["env"],
    placeholderKeys: [...ADAPTER_PLACEHOLDER_KEYS],
    rawConfigPlaceholderPolicy: "wrapper raw config env values must not contain {placeholder} tokens; use launcher command/args/output/cwd env for templated values",
    outputModes: ["file", "stdout"],
    defaultOutputMode: "file",
    defaultAdapterTimeoutMs: DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS,
    defaultAdapterStreamMaxBufferBytes: DEFAULT_EXTERNAL_ADAPTER_STREAM_MAX_BUFFER_BYTES,
    adapterFormatTokens: Object.entries(supportedReferenceGeometryFormats())
      .filter(([, spec]) => spec.adapterCapable === true)
      .map(([format]) => format),
    adapterKeyPattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$",
    envNamePattern: "^[A-Za-z_][A-Za-z0-9_]*$",
    supportsShell: true,
    adapterRegistryFingerprintFields: [
      "adapterRegistryFingerprint"
    ],
    exampleConfigPath: path.join(ROOT, "tools/reference-geometry/reference_geometry_adapters.example.json"),
    bundledAdapterWrapperFields: [
      "key",
      "cliPath",
      "targetFormatTokens",
      "sourceFormatTokens",
      "externalToolEnvironmentVariables",
      "externalToolTemplatedEnvKeys",
      "externalToolRawConfigEnvKeys",
      "externalToolRawConfigPlaceholderPolicy",
      "externalToolArgumentTemplateModes",
      "externalToolArgumentPrecedence",
      "externalToolDefaultArgumentTemplate",
      "emitsCanonicalKinds",
      "validatesAdapterRequest",
      "validatesAdapterOutput"
    ],
    bundledAdapterWrappers
  };
  contract.adapterConfigContractFingerprint = adapterConfigContractFingerprint(contract);
  return contract;
}

export function referenceGeometryAdapterPreflightContractMetadata() {
  const contract = {
    discoveryCommand: "--check-adapters",
    relatedDiscoveryCommands: ["--list-adapters", "--list-translation-discovery", "--list-import-discovery"],
    cliFlags: ["--adapter-config", "--check-adapters", "--format", "--adapter"],
    requiredInputs: ["adapterConfigPath"],
    optionalInputs: ["format", "adapterName"],
    sideEffects: {
      readsAdapterConfig: true,
      validatesAdapterConfig: true,
      resolvesAdapterCwd: true,
      checksMainAdapterCommand: true,
      checksRequiredFiles: true,
      checksRequiredDirectories: true,
      checksRequiredCommands: true,
      checksRequiredEnv: true,
      runsTranslator: false,
      launchesAdapters: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      writesFiles: false,
      writesProjectJson: false,
      writesReferenceManifest: false,
      writesReferenceChunks: false
    },
    topLevelFields: [
      "path",
      "adapterConfigPath",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "schemaVersion",
      "placeholderKeys",
      "requested",
      "ok",
      "diagnostics",
      "adapters",
      "adapterRegistryDecision",
      "adapterTargetFormatCoverage",
      "adapterTargetFormatCoverageFingerprint",
      "adapterRegistryFingerprint",
      "adapterPreflightFingerprint",
      "adapterPreflightDecision"
    ],
    registryDecisionField: "adapterRegistryDecision",
    registryDecisionFields: [
      "adapterConfigReady",
      "adapterCount",
      "adapterKeys",
      "sourceFormatTokens",
      "targetFormatTokens",
      "externalAdapterRequiredTargetFormatTokens",
      "missingExternalAdapterTargetFormatTokens",
      "allExternalAdapterRequiredTargetsConfigured",
      "canListAdapters",
      "canCheckAdapters",
      "mayLaunchExternalAdapter",
      "writesProjectJson",
      "writesReferenceManifest",
      "safeNextAction",
      "recommendedNextAction"
    ],
    preflightDecisionField: "adapterPreflightDecision",
    preflightDecisionFields: [
      "adapterPreflightReady",
      "requestedFormat",
      "requestedFormatToken",
      "requestedAdapter",
      "adapterCount",
      "adapterKeys",
      "selectedAdapterKeys",
      "blockingDiagnosticCount",
      "warningDiagnosticCount",
      "blockingDiagnosticCodes",
      "warningDiagnosticCodes",
      "likelyFixArea",
      "mayLaunchExternalAdapter",
      "writesProjectJson",
      "writesReferenceManifest",
      "safeNextAction",
      "recommendedNextAction"
    ],
    adapterTargetFormatCoverageField: "adapterTargetFormatCoverage",
    adapterTargetFormatCoverageFields: [
      "adapterTargetFormatCoverageFingerprint",
      "targetFormatTokens",
      "adapterConfiguredTargetFormatTokens",
      "externalAdapterRequiredTargetFormatTokens",
      "externalAdapterConfiguredTargetFormatTokens",
      "missingExternalAdapterTargetFormatTokens",
      "allExternalAdapterRequiredTargetsConfigured",
      "builtInTargetFormatTokens",
      "builtInTargetFormatsWithOptionalAdapters",
      "targetFormatEntries"
    ],
    requestedFields: ["format", "requestedFormat", "adapter"],
    adapterEntryFields: [
      "formats",
      "declaredFormats",
      "command",
      "commandChecked",
      "commandFound",
      "resolvedCommand",
      "resolvedCommandFileSizeBytes",
      "resolvedCommandFileModifiedTime",
      "resolvedCommandFileStatFingerprint",
      "cwd",
      "cwdExists",
      "requiredFiles",
      "requiredDirectories",
      "requiredCommands",
      "requiredEnv",
      "envKeys",
      "externalToolArgumentTemplateMode",
      "externalToolArgumentTemplateSource",
      "externalToolArgumentTemplateSources",
      "externalToolArgumentTemplateShadowedSources",
      "externalToolTemplatedEnvKeys",
      "externalToolRawConfigEnvKeys",
      "externalToolRawConfigPlaceholderPolicy",
      "outputMode",
      "timeoutMs",
      "streamMaxBufferBytes",
      "shell",
      "ok",
      "diagnostics",
      "adapterRegistryFingerprint",
      "adapterPreflightFingerprint"
    ],
    requiredFileEntryFields: ["path", "resolvedPath", "exists", "fileSizeBytes", "fileModifiedTime", "fileStatFingerprint"],
    requiredDirectoryEntryFields: [
      "path",
      "resolvedPath",
      "exists",
      "directoryModifiedTime",
      "directoryEntryCount",
      "directoryFileCount",
      "directoryDirectoryCount",
      "directoryFileSizeBytes",
      "directoryLatestModifiedTime",
      "directoryStatFingerprint"
    ],
    requiredCommandEntryFields: ["command", "found", "resolvedCommand", "commandFileSizeBytes", "commandFileModifiedTime", "commandFileStatFingerprint"],
    requiredEnvEntryFields: ["name", "exists"],
    diagnosticFields: ["level", "code", "message"],
    diagnosticCodes: [
      "adapter-not-found",
      "adapter-format-unsupported",
      "adapter-format-mismatch",
      "adapter-format-unconfigured",
      "adapter-cwd-missing",
      "adapter-shell-command-not-checked",
      "adapter-argument-template-default-used",
      "adapter-argument-template-source-shadowed",
      "adapter-external-tool-command-unchecked",
      "adapter-external-tool-cwd-outside-stage",
      "adapter-external-tool-output-outside-scratch",
      "adapter-external-tool-placeholder-unsupported",
      "adapter-external-tool-args-json-invalid",
      "adapter-external-tool-args-string-invalid",
      "adapter-external-tool-shell-invalid",
      "adapter-external-tool-stream-max-buffer-invalid",
      "adapter-external-tool-point-columns-invalid",
      "adapter-external-tool-point-delimiter-invalid",
      "adapter-external-tool-point-rgb-normalized-invalid",
      "adapter-external-tool-obj-vertex-color-layout-invalid",
      "adapter-command-missing",
      "adapter-required-file-missing",
      "adapter-required-directory-missing",
      "adapter-required-command-missing",
      "adapter-required-env-missing"
    ],
    registryFingerprintField: "adapterRegistryFingerprint",
    preflightFingerprintField: "adapterPreflightFingerprint",
    adapterRegistryFingerprintField: "adapterRegistryFingerprint",
    adapterPreflightFingerprintField: "adapterPreflightFingerprint"
  };
  contract.adapterPreflightContractFingerprint = adapterPreflightContractFingerprint(contract);
  return contract;
}

export function describeReferenceGeometryAdapters(adapterConfigPath) {
  const config = loadAdapterConfig(adapterConfigPath);
  const adapters = Object.fromEntries(Object.entries(config.data.adapters).map(([key, adapter]) => {
    const externalToolArgumentTemplate = externalToolArgumentTemplateMetadata(adapter);
    const adapterSummary = {
      formats: uniqueValues(adapterFormats(adapter, key)),
      declaredFormats: Array.isArray(adapter.formats) ? [...adapter.formats] : [adapter.format || key],
      command: adapter.command,
      args: Array.isArray(adapter.args) ? [...adapter.args] : [],
      cwd: adapter.cwd || null,
      requiredFiles: Array.isArray(adapter.requiredFiles) ? [...adapter.requiredFiles] : [],
      requiredDirectories: Array.isArray(adapter.requiredDirectories) ? [...adapter.requiredDirectories] : [],
      requiredCommands: Array.isArray(adapter.requiredCommands) ? [...adapter.requiredCommands] : [],
      requiredEnv: Array.isArray(adapter.requiredEnv) ? [...adapter.requiredEnv] : [],
      envKeys: isRecord(adapter.env) ? Object.keys(adapter.env).sort() : [],
      externalToolArgumentTemplateMode: externalToolArgumentTemplate.mode,
      externalToolArgumentTemplateSource: externalToolArgumentTemplate.source,
      externalToolArgumentTemplateSources: externalToolArgumentTemplate.sources,
      externalToolArgumentTemplateShadowedSources: externalToolArgumentTemplate.shadowedSources,
      externalToolTemplatedEnvKeys: externalToolArgumentTemplate.templatedEnvKeys,
      externalToolRawConfigEnvKeys: externalToolArgumentTemplate.rawConfigEnvKeys,
      externalToolRawConfigPlaceholderPolicy: externalToolArgumentTemplate.rawConfigPlaceholderPolicy,
      outputMode: adapter.outputMode || "file",
      timeoutMs: Number.isFinite(adapter.timeoutMs) ? adapter.timeoutMs : DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS,
      streamMaxBufferBytes: Number.isFinite(adapter.streamMaxBufferBytes) ? adapter.streamMaxBufferBytes : DEFAULT_EXTERNAL_ADAPTER_STREAM_MAX_BUFFER_BYTES,
      shell: adapter.shell === true,
      description: adapter.description || ""
    };
    adapterSummary.adapterRegistryFingerprint = adapterRegistryAdapterFingerprint(adapterSummary);
    return [key, adapterSummary];
  }));
  const summary = {
    path: config.path,
    ...adapterConfigFileMetadata(config.path),
    schemaVersion: config.data.schemaVersion,
    placeholderKeys: [...ADAPTER_PLACEHOLDER_KEYS],
    adapters,
    adapterTargetFormatCoverage: adapterTargetFormatCoverage(adapters)
  };
  summary.adapterTargetFormatCoverageFingerprint = summary.adapterTargetFormatCoverage.adapterTargetFormatCoverageFingerprint;
  summary.adapterRegistryFingerprint = adapterRegistryFingerprint(summary);
  summary.adapterRegistryDecision = adapterRegistryDecision(summary);
  return summary;
}

function externalToolArgumentTemplateMetadata(adapter) {
  const envKeys = isRecord(adapter?.env) ? Object.keys(adapter.env).sort() : [];
  const knownTools = [
    {
      command: "BOBERCAD_DWG_TO_DXF_COMMAND",
      indexed: /^BOBERCAD_DWG_TO_DXF_ARG_\d+$/,
      indexedSource: "BOBERCAD_DWG_TO_DXF_ARG_<index>",
      json: "BOBERCAD_DWG_TO_DXF_ARGS_JSON",
      string: "BOBERCAD_DWG_TO_DXF_ARGS",
      output: "BOBERCAD_DWG_TO_DXF_OUTPUT",
      outputLabel: "convertedDxfPath",
      outputSuffix: ".converted.dxf",
      outputToken: "dxf",
      cwd: "BOBERCAD_DWG_TO_DXF_CWD",
      shell: "BOBERCAD_DWG_TO_DXF_SHELL",
      streamMaxBufferBytes: "BOBERCAD_DWG_TO_DXF_STREAM_MAX_BUFFER_BYTES"
    },
    {
      command: "BOBERCAD_CAD_TO_OBJ_COMMAND",
      indexed: /^BOBERCAD_CAD_TO_OBJ_ARG_\d+$/,
      indexedSource: "BOBERCAD_CAD_TO_OBJ_ARG_<index>",
      json: "BOBERCAD_CAD_TO_OBJ_ARGS_JSON",
      string: "BOBERCAD_CAD_TO_OBJ_ARGS",
      output: "BOBERCAD_CAD_TO_OBJ_OUTPUT",
      outputLabel: "objPath",
      outputSuffix: ".mesh.obj",
      outputToken: "obj",
      cwd: "BOBERCAD_CAD_TO_OBJ_CWD",
      shell: "BOBERCAD_CAD_TO_OBJ_SHELL",
      streamMaxBufferBytes: "BOBERCAD_CAD_TO_OBJ_STREAM_MAX_BUFFER_BYTES",
      objVertexColorLayout: "BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT"
    },
    {
      command: "BOBERCAD_E57_TO_XYZ_COMMAND",
      indexed: /^BOBERCAD_E57_TO_XYZ_ARG_\d+$/,
      indexedSource: "BOBERCAD_E57_TO_XYZ_ARG_<index>",
      json: "BOBERCAD_E57_TO_XYZ_ARGS_JSON",
      string: "BOBERCAD_E57_TO_XYZ_ARGS",
      output: "BOBERCAD_E57_TO_XYZ_OUTPUT",
      outputLabel: "pointTextPath",
      outputSuffix: ".points.xyz",
      outputToken: "xyz",
      cwd: "BOBERCAD_E57_TO_XYZ_CWD",
      shell: "BOBERCAD_E57_TO_XYZ_SHELL",
      streamMaxBufferBytes: "BOBERCAD_E57_TO_XYZ_STREAM_MAX_BUFFER_BYTES",
      pointColumns: "BOBERCAD_E57_XYZ_COLUMNS",
      pointDelimiter: "BOBERCAD_E57_XYZ_DELIMITER",
      pointRgbNormalized: "BOBERCAD_E57_XYZ_RGB_NORMALIZED"
    }
  ];
  const tool = knownTools.find((entry) => envKeys.includes(entry.command));
  if (!tool) {
    return {
      mode: null,
      source: null,
      sources: [],
      shadowedSources: [],
      commandEnvKey: null,
      outputEnvKey: null,
      outputLabel: null,
      outputSuffix: null,
      outputToken: null,
      cwdEnvKey: null,
      indexedPattern: null,
      jsonEnvKey: null,
      stringEnvKey: null,
      shellEnvKey: null,
      templatedEnvKeys: [],
      rawConfigEnvKeys: [],
      rawConfigPlaceholderPolicy: null,
      pointColumnsEnvKey: null,
      pointDelimiterEnvKey: null,
      pointRgbNormalizedEnvKey: null,
      objVertexColorLayoutEnvKey: null,
      streamMaxBufferEnvKey: null
    };
  }
  const sources = [];
  if (envKeys.some((key) => tool.indexed.test(key))) sources.push(tool.indexedSource);
  if (envKeys.includes(tool.json)) sources.push(tool.json);
  if (envKeys.includes(tool.string)) sources.push(tool.string);
  const source = sources[0] || "default";
  const modeBySource = {
    [tool.indexedSource]: "indexed-env",
    [tool.json]: "json-array-env",
    [tool.string]: "no-shell-string-env",
    default: "default"
  };
  const templatedEnvKeys = [];
  const rawConfigEnvKeys = [];
  const addTemplated = (envKey) => {
    if (envKey && envKeys.includes(envKey)) templatedEnvKeys.push(envKey);
  };
  const addRawConfig = (envKey) => {
    if (envKey && envKeys.includes(envKey)) rawConfigEnvKeys.push(envKey);
  };
  addTemplated(tool.command);
  addTemplated(tool.output);
  for (const key of envKeys) {
    if (tool.indexed.test(key)) templatedEnvKeys.push(key);
  }
  addTemplated(tool.json);
  addTemplated(tool.string);
  addTemplated(tool.cwd);
  addRawConfig(tool.shell);
  addRawConfig(tool.streamMaxBufferBytes);
  addRawConfig(tool.pointColumns);
  addRawConfig(tool.pointDelimiter);
  addRawConfig(tool.pointRgbNormalized);
  addRawConfig(tool.objVertexColorLayout);
  return {
    mode: modeBySource[source],
    source,
    sources: sources.length ? sources : ["default"],
    shadowedSources: sources.slice(1),
    commandEnvKey: tool.command,
    outputEnvKey: tool.output,
    outputLabel: tool.outputLabel,
    outputSuffix: tool.outputSuffix,
    outputToken: tool.outputToken,
    cwdEnvKey: tool.cwd,
    shellEnvKey: tool.shell,
    indexedPattern: tool.indexed,
    jsonEnvKey: tool.json,
    stringEnvKey: tool.string,
    templatedEnvKeys: uniqueValues(templatedEnvKeys).sort((left, right) => left.localeCompare(right)),
    rawConfigEnvKeys: uniqueValues(rawConfigEnvKeys).sort((left, right) => left.localeCompare(right)),
    rawConfigPlaceholderPolicy: rawConfigEnvKeys.length ? "no-placeholders" : null,
    pointColumnsEnvKey: tool.pointColumns || null,
    pointDelimiterEnvKey: tool.pointDelimiter || null,
    pointRgbNormalizedEnvKey: tool.pointRgbNormalized || null,
    objVertexColorLayoutEnvKey: tool.objVertexColorLayout || null,
    streamMaxBufferEnvKey: tool.streamMaxBufferBytes || null
  };
}

function unsupportedExternalToolTemplatePlaceholders(adapter, replacements, externalToolArgumentTemplate) {
  if (!isRecord(adapter?.env) || !externalToolArgumentTemplate?.commandEnvKey) return [];
  const defaultAllowedPlaceholders = new Set([
    ...CHECKED_IN_BRIDGE_SCALAR_PLACEHOLDER_KEYS,
    externalToolArgumentTemplate.outputToken
  ].filter(Boolean));
  const entries = [];
  const addEntry = (envKey, allowedPlaceholders = defaultAllowedPlaceholders) => {
    if (envKey && Object.hasOwn(adapter.env, envKey)) entries.push([envKey, adapter.env[envKey], allowedPlaceholders]);
  };
  addEntry(externalToolArgumentTemplate.outputEnvKey);
  addEntry(externalToolArgumentTemplate.cwdEnvKey);
  for (const key of Object.keys(adapter.env).sort()) {
    if (externalToolArgumentTemplate.indexedPattern?.test?.(key)) addEntry(key);
  }
  addEntry(externalToolArgumentTemplate.jsonEnvKey);
  addEntry(externalToolArgumentTemplate.stringEnvKey);
  for (const envKey of externalToolArgumentTemplate.rawConfigEnvKeys || []) {
    addEntry(envKey, new Set());
  }
  const violations = [];
  for (const [envKey, rawValue, allowedPlaceholders] of entries) {
    for (const match of String(rawValue ?? "").matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
      const placeholder = match[1];
      if (!allowedPlaceholders.has(placeholder)) {
        violations.push({ envKey, placeholder });
      }
    }
  }
  return violations;
}

function externalToolArgsJsonViolation(adapter, externalToolArgumentTemplate) {
  const jsonEnvKey = externalToolArgumentTemplate?.jsonEnvKey;
  if (externalToolArgumentTemplate?.source !== jsonEnvKey) return null;
  if (!jsonEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, jsonEnvKey)) return null;
  const rawJson = adapter.env[jsonEnvKey];
  if (!rawJson) return null;
  let parsed;
  try {
    parsed = JSON.parse(String(rawJson));
  } catch {
    return { jsonEnvKey };
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return { jsonEnvKey };
  return null;
}

function parseExternalToolArgsString(raw) {
  const args = [];
  let current = "";
  let quote = null;
  const text = String(raw || "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\\" && next !== undefined && (next === "\\" || next === "\"" || next === "'" || /\s/.test(next))) {
      current += next;
      index += 1;
    } else if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (quote) throw new Error("unterminated quoted argument");
  if (current) args.push(current);
  if (!args.length) throw new Error("empty argument string");
  return args;
}

function externalToolArgsStringViolation(adapter, externalToolArgumentTemplate) {
  const stringEnvKey = externalToolArgumentTemplate?.stringEnvKey;
  if (externalToolArgumentTemplate?.source !== stringEnvKey) return null;
  if (!stringEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, stringEnvKey)) return null;
  try {
    parseExternalToolArgsString(adapter.env[stringEnvKey]);
  } catch {
    return { stringEnvKey };
  }
  return null;
}

function externalToolShellEnvViolation(adapter, externalToolArgumentTemplate) {
  const shellEnvKey = externalToolArgumentTemplate?.shellEnvKey;
  if (!shellEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, shellEnvKey)) return null;
  const rawValue = String(adapter.env[shellEnvKey] ?? "").trim();
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  if (/^(1|0|true|false|yes|no|on|off)$/i.test(rawValue)) return null;
  return { shellEnvKey };
}

function externalToolStreamMaxBufferViolation(adapter, externalToolArgumentTemplate) {
  const streamMaxBufferEnvKey = externalToolArgumentTemplate?.streamMaxBufferEnvKey;
  if (!streamMaxBufferEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, streamMaxBufferEnvKey)) return null;
  const rawValue = String(adapter.env[streamMaxBufferEnvKey] ?? "").trim();
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  if (/^[1-9]\d*$/.test(rawValue)) return null;
  return { streamMaxBufferEnvKey };
}

const E57_POINT_COLUMN_ALIASES = new Map([
  ["x", "x"],
  ["east", "x"],
  ["easting", "x"],
  ["xcoord", "x"],
  ["xcoordinate", "x"],
  ["xpos", "x"],
  ["xposition", "x"],
  ["posx", "x"],
  ["positionx", "x"],
  ["cartesianx", "x"],
  ["coordinatex", "x"],
  ["coordx", "x"],
  ["y", "y"],
  ["north", "y"],
  ["northing", "y"],
  ["ycoord", "y"],
  ["ycoordinate", "y"],
  ["ypos", "y"],
  ["yposition", "y"],
  ["posy", "y"],
  ["positiony", "y"],
  ["cartesiany", "y"],
  ["coordinatey", "y"],
  ["coordy", "y"],
  ["z", "z"],
  ["height", "z"],
  ["altitude", "z"],
  ["zcoord", "z"],
  ["zcoordinate", "z"],
  ["zpos", "z"],
  ["zposition", "z"],
  ["posz", "z"],
  ["positionz", "z"],
  ["cartesianz", "z"],
  ["coordinatez", "z"],
  ["coordz", "z"],
  ["sphericalrange", "sphericalrange"],
  ["sphericalr", "sphericalrange"],
  ["range", "sphericalrange"],
  ["distance", "sphericalrange"],
  ["sphericalazimuth", "sphericalazimuth"],
  ["azimuth", "sphericalazimuth"],
  ["sphericalelevation", "sphericalelevation"],
  ["elev", "elevation"],
  ["elevation", "elevation"],
  ["intensity", "intensity"],
  ["intensities", "intensity"],
  ["cartesianintensity", "intensity"],
  ["i", "intensity"],
  ["intensityraw", "intensity"],
  ["intensityvalue", "intensity"],
  ["r", "r"],
  ["red", "r"],
  ["colorr", "r"],
  ["colourr", "r"],
  ["colorred", "r"],
  ["colourred", "r"],
  ["g", "g"],
  ["green", "g"],
  ["colorg", "g"],
  ["colourg", "g"],
  ["colorgreen", "g"],
  ["colourgreen", "g"],
  ["b", "b"],
  ["blue", "b"],
  ["colorb", "b"],
  ["colourb", "b"],
  ["colorblue", "b"],
  ["colourblue", "b"],
  ["rgb", "packedrgb"],
  ["rgbhex", "packedrgb"],
  ["packedrgb", "packedrgb"],
  ["color", "packedrgb"],
  ["colour", "packedrgb"],
  ["colorhex", "packedrgb"],
  ["colourhex", "packedrgb"],
  ["rgba", "packedrgba"],
  ["rgbahex", "packedrgba"],
  ["packedrgba", "packedrgba"],
  ["colorrgba", "packedrgba"],
  ["colourrgba", "packedrgba"],
  ["classification", "classification"],
  ["classcode", "classification"],
  ["classid", "classification"],
  ["classvalue", "classification"],
  ["classificationcode", "classification"],
  ["classificationid", "classification"],
  ["classificationvalue", "classification"],
  ["class", "classification"],
  ["cls", "classification"],
  ["nx", "nx"],
  ["cartesiannormalx", "nx"],
  ["normalx", "nx"],
  ["ny", "ny"],
  ["cartesiannormaly", "ny"],
  ["normaly", "ny"],
  ["nz", "nz"],
  ["cartesiannormalz", "nz"],
  ["normalz", "nz"]
]);

function normalizeE57PointColumnName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const base = raw.replace(/\s*(?:\[[^\]]*\]|\([^)]*\))\s*$/, "").trim();
  const compact = base.replace(/[^a-z0-9]+/g, "");
  return E57_POINT_COLUMN_ALIASES.get(compact) || raw;
}

function normalizeE57PointColumnNames(values) {
  const columns = values.map(normalizeE57PointColumnName);
  const hasSphericalContext = columns.includes("sphericalrange") && columns.includes("sphericalazimuth");
  const hasCartesianContext = columns.includes("x") && columns.includes("y");
  return columns.map((column) => {
    if (column !== "elevation") return column;
    if (hasSphericalContext) return "sphericalelevation";
    if (hasCartesianContext) return "z";
    return column;
  });
}

function firstDuplicateE57PointColumnName(columns) {
  const seen = new Set();
  for (const column of columns) {
    if (!column) continue;
    if (seen.has(column)) return column;
    seen.add(column);
  }
  return null;
}

function partialE57PointColumnGroup(columns, group) {
  const present = group.filter((name) => columns.includes(name));
  if (!present.length || present.length === group.length) return null;
  return { group, present };
}

function partialE57PointAttributeColumnGroup(columns) {
  return partialE57PointColumnGroup(columns, ["r", "g", "b"])
    || partialE57PointColumnGroup(columns, ["nx", "ny", "nz"]);
}

function splitE57PointColumnConfig(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return [];
  const delimiter = raw.includes(",")
    ? ","
    : raw.includes(";")
      ? ";"
      : raw.includes("|")
        ? "|"
        : null;
  const values = [];
  let current = "";
  let quote = null;
  let tokenStarted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];
    if (quote) {
      if (char === quote) {
        if (quote === "\"" && next === "\"") {
          current += "\"";
          index += 1;
        } else {
          quote = null;
        }
      } else {
        current += char;
      }
      continue;
    }
    if ((char === "\"" || char === "'") && current.trim() === "") {
      current = "";
      quote = char;
      tokenStarted = true;
    } else if ((delimiter && char === delimiter) || (!delimiter && /\s/.test(char))) {
      if (delimiter || tokenStarted || current) {
        values.push(current.trim());
        current = "";
        tokenStarted = false;
      }
    } else {
      current += char;
      tokenStarted = true;
    }
  }
  if (tokenStarted || current) values.push(current.trim());
  return values;
}

function externalToolPointColumnsViolation(adapter, externalToolArgumentTemplate) {
  const pointColumnsEnvKey = externalToolArgumentTemplate?.pointColumnsEnvKey;
  if (!pointColumnsEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, pointColumnsEnvKey)) return null;
  const rawValue = adapter.env[pointColumnsEnvKey];
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  const columns = normalizeE57PointColumnNames(splitE57PointColumnConfig(rawValue));
  if (columns.some((column) => !column)) return { pointColumnsEnvKey, reason: "empty-column" };
  const hasCartesian = ["x", "y", "z"].every((name) => columns.includes(name));
  const hasSpherical = ["sphericalrange", "sphericalazimuth", "sphericalelevation"].every((name) => columns.includes(name));
  if (!hasCartesian && !hasSpherical) return { pointColumnsEnvKey, reason: "missing-coordinate-columns" };
  const duplicateColumn = firstDuplicateE57PointColumnName(columns);
  if (duplicateColumn) return { pointColumnsEnvKey, reason: "duplicate-column", duplicateColumn };
  const partialGroup = partialE57PointAttributeColumnGroup(columns);
  if (partialGroup) {
    return {
      pointColumnsEnvKey,
      reason: "partial-attribute-group",
      group: partialGroup.group,
      present: partialGroup.present
    };
  }
  return null;
}

function externalToolPointDelimiterViolation(adapter, externalToolArgumentTemplate) {
  const pointDelimiterEnvKey = externalToolArgumentTemplate?.pointDelimiterEnvKey;
  if (!pointDelimiterEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, pointDelimiterEnvKey)) return null;
  const rawValue = String(adapter.env[pointDelimiterEnvKey] ?? "").trim().toLowerCase();
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  if (["auto", "space", "whitespace", "tab", "tsv", "\\t", "comma", "csv", ",", "semicolon", ";", "semi", "pipe", "|", "bar"].includes(rawValue)) return null;
  return { pointDelimiterEnvKey };
}

function externalToolPointRgbNormalizedViolation(adapter, externalToolArgumentTemplate) {
  const pointRgbNormalizedEnvKey = externalToolArgumentTemplate?.pointRgbNormalizedEnvKey;
  if (!pointRgbNormalizedEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, pointRgbNormalizedEnvKey)) return null;
  const rawValue = String(adapter.env[pointRgbNormalizedEnvKey] ?? "").trim();
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  if (/^(1|0|true|false|yes|no|on|off)$/i.test(rawValue)) return null;
  return { pointRgbNormalizedEnvKey };
}

function externalToolObjVertexColorLayoutViolation(adapter, externalToolArgumentTemplate) {
  const objVertexColorLayoutEnvKey = externalToolArgumentTemplate?.objVertexColorLayoutEnvKey;
  if (!objVertexColorLayoutEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, objVertexColorLayoutEnvKey)) return null;
  const rawValue = String(adapter.env[objVertexColorLayoutEnvKey] ?? "").trim().toLowerCase();
  if (!rawValue) return null;
  if (hasAdapterPlaceholderSyntax(rawValue)) return null;
  if (["auto", "weighted-rgb", "rgba"].includes(rawValue)) return null;
  return { objVertexColorLayoutEnvKey };
}

function normalizeAdapterCommandReference(command, cwd) {
  const value = String(command || "").trim();
  if (!value) return "";
  if (!commandHasPathSegment(value)) return value;
  const resolved = path.isAbsolute(value) ? value : path.resolve(cwd, value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function externalToolCommandCoveredByRequiredCommands(adapter, replacements, cwd, externalToolArgumentTemplate) {
  const commandEnvKey = externalToolArgumentTemplate?.commandEnvKey;
  if (!commandEnvKey || !isRecord(adapter?.env)) return true;
  const externalToolCommand = adapterValue(adapter.env[commandEnvKey], replacements);
  const normalizedExternalToolCommand = normalizeAdapterCommandReference(externalToolCommand, cwd);
  if (!normalizedExternalToolCommand) return true;
  return (adapter.requiredCommands || []).some((requiredCommand) => (
    normalizeAdapterCommandReference(adapterValue(requiredCommand, replacements), cwd) === normalizedExternalToolCommand
  ));
}

function externalToolOutputScratchViolation(adapter, replacements, cwd, externalToolArgumentTemplate) {
  const outputEnvKey = externalToolArgumentTemplate?.outputEnvKey;
  if (!outputEnvKey || !isRecord(adapter?.env)) return null;
  const rawOutput = adapter.env[outputEnvKey];
  const defaultOutputPath = path.join(
    replacements.scratchDir,
    `${replacements.sourceFileStem || "__reference_adapter_preflight_input__"}${externalToolArgumentTemplate.outputSuffix || ".tmp"}`
  );
  if (/^(-|stdout)$/i.test(String(rawOutput || "").trim())) return null;
  const expandedOutput = adapterValue(rawOutput || defaultOutputPath, replacements);
  const resolvedOutput = path.isAbsolute(expandedOutput)
    ? path.resolve(expandedOutput)
    : path.resolve(cwd, expandedOutput);
  const resolvedScratchDir = path.resolve(replacements.scratchDir);
  if (isSubpath(resolvedScratchDir, resolvedOutput)) return null;
  return {
    outputEnvKey,
    outputLabel: externalToolArgumentTemplate.outputLabel || "converterOutput"
  };
}

function externalToolCwdStageViolation(adapter, replacements, cwd, externalToolArgumentTemplate) {
  const cwdEnvKey = externalToolArgumentTemplate?.cwdEnvKey;
  if (!cwdEnvKey || !isRecord(adapter?.env) || !Object.hasOwn(adapter.env, cwdEnvKey)) return null;
  const expandedCwd = adapterValue(adapter.env[cwdEnvKey], replacements);
  const resolvedCwd = path.isAbsolute(expandedCwd)
    ? path.resolve(expandedCwd)
    : path.resolve(cwd, expandedCwd);
  const resolvedStageDir = path.resolve(replacements.stageDir);
  if (isSubpath(resolvedStageDir, resolvedCwd)) return null;
  return { cwdEnvKey };
}

function adapterExternalToolBlockingDiagnostics(adapter, replacements, cwd, externalToolArgumentTemplate) {
  const diagnostics = [];
  const dwgConverterEnvInactive = externalToolArgumentTemplate?.commandEnvKey === "BOBERCAD_DWG_TO_DXF_COMMAND"
    && normalizeFormat(replacements?.format) === "dxf";
  const shouldSkipInactiveDwgConverterEnv = (envKey) => (
    dwgConverterEnvInactive
    && typeof envKey === "string"
    && envKey.startsWith("BOBERCAD_DWG_TO_DXF_")
    && envKey !== "BOBERCAD_DWG_TO_DXF_STREAM_MAX_BUFFER_BYTES"
  );
  for (const violation of unsupportedExternalToolTemplatePlaceholders(adapter, replacements, externalToolArgumentTemplate)) {
    if (shouldSkipInactiveDwgConverterEnv(violation.envKey)) continue;
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-placeholder-unsupported",
      message: `Adapter external-tool env ${violation.envKey} uses unsupported placeholder {${violation.placeholder}}.`
    });
  }
  const argsJsonViolation = externalToolArgsJsonViolation(adapter, externalToolArgumentTemplate);
  if (argsJsonViolation && !shouldSkipInactiveDwgConverterEnv(argsJsonViolation.jsonEnvKey)) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-args-json-invalid",
      message: `Adapter external-tool args env ${argsJsonViolation.jsonEnvKey} must be a JSON string array.`
    });
  }
  const argsStringViolation = externalToolArgsStringViolation(adapter, externalToolArgumentTemplate);
  if (argsStringViolation && !shouldSkipInactiveDwgConverterEnv(argsStringViolation.stringEnvKey)) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-args-string-invalid",
      message: `Adapter external-tool args env ${argsStringViolation.stringEnvKey} must be a non-empty no-shell argument string with balanced quotes.`
    });
  }
  const shellEnvViolation = externalToolShellEnvViolation(adapter, externalToolArgumentTemplate);
  if (shellEnvViolation && !shouldSkipInactiveDwgConverterEnv(shellEnvViolation.shellEnvKey)) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-shell-invalid",
      message: `Adapter external-tool shell env ${shellEnvViolation.shellEnvKey} must be one of 1, 0, true, false, yes, no, on, or off.`
    });
  }
  const streamMaxBufferViolation = externalToolStreamMaxBufferViolation(adapter, externalToolArgumentTemplate);
  if (streamMaxBufferViolation) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-stream-max-buffer-invalid",
      message: `Adapter external-tool stream max buffer env ${streamMaxBufferViolation.streamMaxBufferEnvKey} must be a positive integer byte count.`
    });
  }
  const pointColumnsViolation = externalToolPointColumnsViolation(adapter, externalToolArgumentTemplate);
  if (pointColumnsViolation) {
    const pointColumnsMessage = pointColumnsViolation.reason === "duplicate-column"
      ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} maps ${pointColumnsViolation.duplicateColumn} more than once.`
      : pointColumnsViolation.reason === "empty-column"
        ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must not include empty column names.`
        : pointColumnsViolation.reason === "partial-attribute-group"
          ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must include ${pointColumnsViolation.group.join(",")} together.`
          : `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must include x, y, and z columns or sphericalRange, sphericalAzimuth, and sphericalElevation columns.`;
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-point-columns-invalid",
      message: pointColumnsMessage
    });
  }
  const pointDelimiterViolation = externalToolPointDelimiterViolation(adapter, externalToolArgumentTemplate);
  if (pointDelimiterViolation) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-point-delimiter-invalid",
      message: `Adapter external-tool point delimiter env ${pointDelimiterViolation.pointDelimiterEnvKey} must be one of auto, space, whitespace, tab, tsv, '\\t', comma, csv, ',', semicolon, or pipe.`
    });
  }
  const pointRgbNormalizedViolation = externalToolPointRgbNormalizedViolation(adapter, externalToolArgumentTemplate);
  if (pointRgbNormalizedViolation) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-point-rgb-normalized-invalid",
      message: `Adapter external-tool point RGB normalized env ${pointRgbNormalizedViolation.pointRgbNormalizedEnvKey} must be one of 1, 0, true, false, yes, no, on, or off.`
    });
  }
  const objVertexColorLayoutViolation = externalToolObjVertexColorLayoutViolation(adapter, externalToolArgumentTemplate);
  if (objVertexColorLayoutViolation) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-obj-vertex-color-layout-invalid",
      message: `Adapter external-tool OBJ vertex color layout env ${objVertexColorLayoutViolation.objVertexColorLayoutEnvKey} must be one of auto, weighted-rgb, or rgba.`
    });
  }
  const externalToolCwdViolation = externalToolCwdStageViolation(adapter, replacements, cwd, externalToolArgumentTemplate);
  if (externalToolCwdViolation && !shouldSkipInactiveDwgConverterEnv(externalToolCwdViolation.cwdEnvKey)) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-cwd-outside-stage",
      message: `Adapter external-tool cwd env ${externalToolCwdViolation.cwdEnvKey} must resolve inside stageDir.`
    });
  }
  const externalToolOutputViolation = externalToolOutputScratchViolation(adapter, replacements, cwd, externalToolArgumentTemplate);
  if (externalToolOutputViolation && !shouldSkipInactiveDwgConverterEnv(externalToolOutputViolation.outputEnvKey)) {
    diagnostics.push({
      level: "error",
      code: "adapter-external-tool-output-outside-scratch",
      message: `Adapter external-tool output env ${externalToolOutputViolation.outputEnvKey} must resolve ${externalToolOutputViolation.outputLabel} inside scratchDir.`
    });
  }
  return diagnostics;
}

function adapterPreflightReplacements(format, configPath, adapterKey = "__reference_adapter_preflight_adapter__", requestedFormat = null, outputMode = "file", timeoutMs = DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS) {
  const baseDir = path.dirname(configPath);
  const requested = formatToken(requestedFormat || format || "source");
  const adapterConfigMetadata = adapterConfigFileMetadata(configPath);
  const adapterRegistry = describeReferenceGeometryAdapters(configPath);
  return {
    input: path.join(baseDir, "__reference_adapter_preflight_input__"),
    output: path.join(baseDir, "__reference_adapter_preflight_output__.json"),
    outputDir: baseDir,
    stageDir: baseDir,
    scratchDir: path.join(baseDir, "scratch"),
    outputFileName: "__reference_adapter_preflight_output__.json",
    outputFileStem: "__reference_adapter_preflight_output__",
    chunkDir: path.join(baseDir, "chunks"),
    chunkPathPrefix: DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX,
    adapterLogPath: path.join(baseDir, "reference-adapter.log"),
    adapterStdoutPath: path.join(baseDir, "reference-adapter.stdout.log"),
    adapterStderrPath: path.join(baseDir, "reference-adapter.stderr.log"),
    outputMode,
    request: path.join(baseDir, "__reference_adapter_preflight_request__.json"),
    format,
    requestedFormat: requested,
    adapterKey,
    adapterRunId: "__reference_adapter_preflight_run_id__",
    adapterConfigPath: configPath,
    adapterConfigDir: path.dirname(configPath),
    adapterConfigFileSizeBytes: String(adapterConfigMetadata.adapterConfigFileSizeBytes),
    adapterConfigFileModifiedTime: adapterConfigMetadata.adapterConfigFileModifiedTime,
    adapterConfigStatFingerprint: adapterConfigMetadata.adapterConfigStatFingerprint,
    adapterRegistryFingerprint: adapterRegistry.adapterRegistryFingerprint,
    adapterRegistryAdapterFingerprint: adapterRegistry.adapters?.[adapterKey]?.adapterRegistryFingerprint || "",
    sourceDirectory: baseDir,
    sourceFileName: `__reference_adapter_preflight_input__.${format || "source"}`,
    sourceFileStem: "__reference_adapter_preflight_input__",
    sourceFileExtension: format || "source",
    sourceFileSizeBytes: "0",
    sourceFileModifiedTime: "1970-01-01T00:00:00.000Z",
    sourceStatFingerprint: sourceStatFingerprint({
      sourceFileName: `__reference_adapter_preflight_input__.${format || "source"}`,
      sourceFileSizeBytes: 0,
      sourceFileModifiedTime: "1970-01-01T00:00:00.000Z"
    }),
    pointCloudChunkSize: String(DEFAULT_POINT_CLOUD_CHUNK_SIZE),
    timeoutMs: String(timeoutMs),
    adapterRequestSchemaPath: ADAPTER_REQUEST_SCHEMA,
    referenceGeometrySchemaPath: REFERENCE_GEOMETRY_SCHEMA,
    pointCloudChunkSchemaPath: POINT_CLOUD_CHUNK_SCHEMA,
    referenceGeometrySchemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    pointCloudChunkSchemaVersion: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
    adapterRequestSchemaVersion: ADAPTER_REQUEST_SCHEMA_VERSION,
    name: "Reference Adapter Preflight",
    units: DEFAULT_REFERENCE_UNITS,
    assetId: "reference_adapter_preflight"
  };
}

function existingExecutablePath(candidatePath) {
  const candidates = process.platform === "win32" && !path.extname(candidatePath)
    ? [
        candidatePath,
        ...String(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter(Boolean)
          .map((extension) => `${candidatePath}${extension.toLowerCase()}`)
      ]
    : [candidatePath];
  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isFile()) continue;
      if (process.platform !== "win32") fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function commandHasPathSegment(command) {
  return path.isAbsolute(command) || command.includes("/") || command.includes("\\");
}

function resolveAdapterCommand(command, cwd, env = process.env) {
  if (commandHasPathSegment(command)) {
    const resolved = path.isAbsolute(command) ? command : path.resolve(cwd, command);
    return {
      checked: true,
      found: existingExecutablePath(resolved) !== null,
      resolvedPath: existingExecutablePath(resolved)
    };
  }
  for (const searchDir of String(env.PATH || process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    const found = existingExecutablePath(path.join(searchDir, command));
    if (found) return { checked: true, found: true, resolvedPath: found };
  }
  return { checked: true, found: false, resolvedPath: null };
}

function directoryExists(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function adapterDependencyStatFingerprint(fileName, fileSizeBytes, fileModifiedTime) {
  return `stat-sha256:${crypto.createHash("sha256").update([fileName || "", String(fileSizeBytes), fileModifiedTime || ""].join("\0")).digest("hex")}`;
}

function adapterDependencyFileStatMetadata(filePath) {
  const metadata = {
    fileSizeBytes: null,
    fileModifiedTime: null,
    fileStatFingerprint: null
  };
  if (!filePath) return metadata;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return metadata;
    metadata.fileSizeBytes = stat.size;
    metadata.fileModifiedTime = stat.mtime.toISOString();
    metadata.fileStatFingerprint = adapterDependencyStatFingerprint(path.basename(filePath), metadata.fileSizeBytes, metadata.fileModifiedTime);
  } catch {
    return metadata;
  }
  return metadata;
}

function adapterDependencyDirectoryStatFingerprint(
  directoryName,
  directoryModifiedTime,
  directoryEntryCount,
  directoryFileCount,
  directoryDirectoryCount,
  directoryFileSizeBytes,
  directoryLatestModifiedTime
) {
  return `stat-sha256:${crypto.createHash("sha256").update([
    directoryName || "",
    directoryModifiedTime || "",
    Number.isInteger(directoryEntryCount) ? String(directoryEntryCount) : "",
    Number.isInteger(directoryFileCount) ? String(directoryFileCount) : "",
    Number.isInteger(directoryDirectoryCount) ? String(directoryDirectoryCount) : "",
    Number.isInteger(directoryFileSizeBytes) ? String(directoryFileSizeBytes) : "",
    directoryLatestModifiedTime || ""
  ].join("\0")).digest("hex")}`;
}

function adapterRequiredFileChecks(adapter, replacements, cwd) {
  return (adapter.requiredFiles || []).map((requiredFile) => {
    const expanded = adapterValue(requiredFile, replacements);
    const resolvedPath = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
    let exists = false;
    const fileMetadata = adapterDependencyFileStatMetadata(resolvedPath);
    try {
      const stat = fs.statSync(resolvedPath);
      exists = stat.isFile();
    } catch {
      exists = false;
    }
    return {
      path: expanded,
      resolvedPath,
      exists,
      fileSizeBytes: fileMetadata.fileSizeBytes,
      fileModifiedTime: fileMetadata.fileModifiedTime,
      fileStatFingerprint: fileMetadata.fileStatFingerprint
    };
  });
}

function adapterRequiredDirectoryChecks(adapter, replacements, cwd) {
  return (adapter.requiredDirectories || []).map((requiredDirectory) => {
    const expanded = adapterValue(requiredDirectory, replacements);
    const resolvedPath = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
    let exists = false;
    let directoryModifiedTime = null;
    let directoryEntryCount = null;
    let directoryFileCount = null;
    let directoryDirectoryCount = null;
    let directoryFileSizeBytes = null;
    let directoryLatestModifiedTime = null;
    let directoryStatFingerprint = null;
    try {
      const stat = fs.statSync(resolvedPath);
      exists = stat.isDirectory();
      if (exists) {
        directoryModifiedTime = stat.mtime.toISOString();
        directoryEntryCount = 0;
        directoryFileCount = 0;
        directoryDirectoryCount = 0;
        directoryFileSizeBytes = 0;
        let latestModifiedMs = stat.mtime.getTime();
        const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name));
        directoryEntryCount = entries.length;
        for (const entry of entries) {
          const entryPath = path.join(resolvedPath, entry.name);
          let entryStat = null;
          try {
            entryStat = fs.statSync(entryPath);
          } catch {
            continue;
          }
          if (entryStat.isFile()) {
            directoryFileCount += 1;
            directoryFileSizeBytes += entryStat.size;
          } else if (entryStat.isDirectory()) {
            directoryDirectoryCount += 1;
          }
          latestModifiedMs = Math.max(latestModifiedMs, entryStat.mtime.getTime());
        }
        directoryLatestModifiedTime = new Date(latestModifiedMs).toISOString();
        directoryStatFingerprint = adapterDependencyDirectoryStatFingerprint(
          path.basename(resolvedPath),
          directoryModifiedTime,
          directoryEntryCount,
          directoryFileCount,
          directoryDirectoryCount,
          directoryFileSizeBytes,
          directoryLatestModifiedTime
        );
      }
    } catch {
      exists = false;
    }
    return {
      path: expanded,
      resolvedPath,
      exists,
      directoryModifiedTime,
      directoryEntryCount,
      directoryFileCount,
      directoryDirectoryCount,
      directoryFileSizeBytes,
      directoryLatestModifiedTime,
      directoryStatFingerprint
    };
  });
}

function adapterRequiredCommandChecks(adapter, replacements, cwd, env) {
  return (adapter.requiredCommands || []).map((requiredCommand) => {
    const command = adapterValue(requiredCommand, replacements);
    const commandCheck = resolveAdapterCommand(command, cwd, env);
    const commandMetadata = adapterDependencyFileStatMetadata(commandCheck.resolvedPath);
    return {
      command,
      found: commandCheck.found === true,
      resolvedCommand: commandCheck.resolvedPath,
      commandFileSizeBytes: commandMetadata.fileSizeBytes,
      commandFileModifiedTime: commandMetadata.fileModifiedTime,
      commandFileStatFingerprint: commandMetadata.fileStatFingerprint
    };
  });
}

function adapterRequiredEnvChecks(adapter, env) {
  return (adapter.requiredEnv || []).map((name) => ({
    name,
    exists: Object.hasOwn(env, name) && String(env[name]).length > 0
  }));
}

function adapterCheckSelection(config, { format = null, adapterName = null } = {}) {
  const requestedFormat = optionalReferenceFormatToken(format);
  const normalizedFormat = requestedFormat ? normalizeFormat(requestedFormat) : null;
  const diagnostics = [];
  let entries = Object.entries(config.data.adapters);
  if (adapterName) {
    const adapter = config.data.adapters[adapterName];
    if (!adapter) {
      diagnostics.push({
        level: "error",
        code: "adapter-not-found",
        message: `Adapter not found: ${adapterName}`
      });
      entries = [];
    } else {
      entries = [[adapterName, adapter]];
    }
  }
  if (normalizedFormat) {
    if (!FORMAT_REGISTRY[normalizedFormat]) {
      diagnostics.push({
        level: "error",
        code: "adapter-format-unsupported",
        message: `Unsupported reference geometry adapter format: ${normalizedFormat}`
      });
      entries = [];
    } else if (adapterName && entries.length && !adapterFormats(entries[0][1], adapterName).includes(normalizedFormat)) {
      diagnostics.push({
        level: "error",
        code: "adapter-format-mismatch",
        message: `Adapter ${adapterName} does not support ${normalizedFormat}`
      });
    } else if (!adapterName) {
      entries = entries.filter(([key, adapter]) => adapterFormats(adapter, key).includes(normalizedFormat));
      if (!entries.length) {
        diagnostics.push({
          level: "error",
          code: "adapter-format-unconfigured",
          message: `No external adapter configured for ${normalizedFormat}`
        });
      }
    }
  }
  return { entries, diagnostics, normalizedFormat, requestedFormat };
}

function adapterPreflightAdapterFingerprint(adapterSummary = {}) {
  const payload = {
    formats: Array.isArray(adapterSummary.formats) ? adapterSummary.formats : [],
    declaredFormats: Array.isArray(adapterSummary.declaredFormats) ? adapterSummary.declaredFormats : [],
    command: adapterSummary.command || null,
    commandChecked: adapterSummary.commandChecked ?? null,
    commandFound: adapterSummary.commandFound ?? null,
    resolvedCommand: adapterSummary.resolvedCommand || null,
    resolvedCommandFileSizeBytes: Number.isInteger(adapterSummary.resolvedCommandFileSizeBytes) ? adapterSummary.resolvedCommandFileSizeBytes : null,
    resolvedCommandFileModifiedTime: adapterSummary.resolvedCommandFileModifiedTime || null,
    resolvedCommandFileStatFingerprint: adapterSummary.resolvedCommandFileStatFingerprint || null,
    cwd: adapterSummary.cwd || null,
    cwdExists: adapterSummary.cwdExists ?? null,
    requiredFiles: Array.isArray(adapterSummary.requiredFiles) ? adapterSummary.requiredFiles : [],
    requiredDirectories: Array.isArray(adapterSummary.requiredDirectories) ? adapterSummary.requiredDirectories : [],
    requiredCommands: Array.isArray(adapterSummary.requiredCommands) ? adapterSummary.requiredCommands : [],
    requiredEnv: Array.isArray(adapterSummary.requiredEnv) ? adapterSummary.requiredEnv : [],
    envKeys: Array.isArray(adapterSummary.envKeys) ? adapterSummary.envKeys : [],
    externalToolArgumentTemplateMode: adapterSummary.externalToolArgumentTemplateMode || null,
    externalToolArgumentTemplateSource: adapterSummary.externalToolArgumentTemplateSource || null,
    externalToolArgumentTemplateSources: Array.isArray(adapterSummary.externalToolArgumentTemplateSources) ? adapterSummary.externalToolArgumentTemplateSources : [],
    externalToolArgumentTemplateShadowedSources: Array.isArray(adapterSummary.externalToolArgumentTemplateShadowedSources) ? adapterSummary.externalToolArgumentTemplateShadowedSources : [],
    externalToolTemplatedEnvKeys: Array.isArray(adapterSummary.externalToolTemplatedEnvKeys) ? adapterSummary.externalToolTemplatedEnvKeys : [],
    externalToolRawConfigEnvKeys: Array.isArray(adapterSummary.externalToolRawConfigEnvKeys) ? adapterSummary.externalToolRawConfigEnvKeys : [],
    externalToolRawConfigPlaceholderPolicy: adapterSummary.externalToolRawConfigPlaceholderPolicy || null,
    outputMode: adapterSummary.outputMode || null,
    timeoutMs: Number.isInteger(adapterSummary.timeoutMs) ? adapterSummary.timeoutMs : null,
    streamMaxBufferBytes: Number.isInteger(adapterSummary.streamMaxBufferBytes) ? adapterSummary.streamMaxBufferBytes : null,
    shell: adapterSummary.shell ?? null,
    ok: adapterSummary.ok ?? null,
    diagnostics: Array.isArray(adapterSummary.diagnostics) ? adapterSummary.diagnostics : []
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterRegistryAdapterFingerprint(adapterSummary = {}) {
  const payload = {
    formats: Array.isArray(adapterSummary.formats) ? adapterSummary.formats : [],
    declaredFormats: Array.isArray(adapterSummary.declaredFormats) ? adapterSummary.declaredFormats : [],
    command: adapterSummary.command || null,
    args: Array.isArray(adapterSummary.args) ? adapterSummary.args : [],
    cwd: adapterSummary.cwd || null,
    requiredFiles: Array.isArray(adapterSummary.requiredFiles) ? adapterSummary.requiredFiles : [],
    requiredDirectories: Array.isArray(adapterSummary.requiredDirectories) ? adapterSummary.requiredDirectories : [],
    requiredCommands: Array.isArray(adapterSummary.requiredCommands) ? adapterSummary.requiredCommands : [],
    requiredEnv: Array.isArray(adapterSummary.requiredEnv) ? adapterSummary.requiredEnv : [],
    envKeys: Array.isArray(adapterSummary.envKeys) ? adapterSummary.envKeys : [],
    externalToolArgumentTemplateMode: adapterSummary.externalToolArgumentTemplateMode || null,
    externalToolArgumentTemplateSource: adapterSummary.externalToolArgumentTemplateSource || null,
    externalToolArgumentTemplateSources: Array.isArray(adapterSummary.externalToolArgumentTemplateSources) ? adapterSummary.externalToolArgumentTemplateSources : [],
    externalToolArgumentTemplateShadowedSources: Array.isArray(adapterSummary.externalToolArgumentTemplateShadowedSources) ? adapterSummary.externalToolArgumentTemplateShadowedSources : [],
    externalToolTemplatedEnvKeys: Array.isArray(adapterSummary.externalToolTemplatedEnvKeys) ? adapterSummary.externalToolTemplatedEnvKeys : [],
    externalToolRawConfigEnvKeys: Array.isArray(adapterSummary.externalToolRawConfigEnvKeys) ? adapterSummary.externalToolRawConfigEnvKeys : [],
    externalToolRawConfigPlaceholderPolicy: adapterSummary.externalToolRawConfigPlaceholderPolicy || null,
    outputMode: adapterSummary.outputMode || null,
    timeoutMs: Number.isInteger(adapterSummary.timeoutMs) ? adapterSummary.timeoutMs : null,
    streamMaxBufferBytes: Number.isInteger(adapterSummary.streamMaxBufferBytes) ? adapterSummary.streamMaxBufferBytes : null,
    shell: adapterSummary.shell ?? null,
    description: adapterSummary.description || ""
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterTargetFormatCoverageFingerprint(coverage = {}) {
  const { adapterTargetFormatCoverageFingerprint: _fingerprint, ...payload } = coverage;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterTargetFormatCoverage(adapters = {}) {
  const adapterEntries = Object.entries(adapters || {});
  const formatSpecs = supportedReferenceGeometryFormats();
  const targetFormatEntries = Object.fromEntries(REFERENCE_TARGET_FORMAT_TOKENS.map((token) => {
    const formatSpec = formatSpecs[token] || {};
    const canonicalFormat = normalizeFormat(formatSpec.canonicalFormat || formatSpec.aliasFor || token);
    const adapterKeys = adapterEntries
      .filter(([, adapter]) => (Array.isArray(adapter?.formats) ? adapter.formats : []).includes(canonicalFormat))
      .map(([key]) => key)
      .sort((left, right) => left.localeCompare(right));
    const builtInAvailable = formatSpec.builtInAvailable === true || formatSpec.state === "implemented";
    const externalAdapterRequired = formatSpec.externalAdapterRequired === true || formatSpec.state === "external-adapter-required";
    const adapterConfigured = adapterKeys.length > 0;
    return [token, {
      formatToken: token,
      canonicalFormat,
      builtInAvailable,
      externalAdapterRequired,
      adapterConfigured,
      adapterKeys,
      cliOnlyToken: formatSpec.isFileExtension === false,
      adapterCoverageStatus: externalAdapterRequired
        ? adapterConfigured ? "required-adapter-configured" : "required-adapter-missing"
        : adapterConfigured ? "optional-adapter-configured" : "built-in-without-adapter"
    }];
  }));
  const entries = Object.values(targetFormatEntries);
  const coverage = {
    targetFormatTokens: [...REFERENCE_TARGET_FORMAT_TOKENS],
    adapterConfiguredTargetFormatTokens: entries.filter((entry) => entry.adapterConfigured === true).map((entry) => entry.formatToken),
    externalAdapterRequiredTargetFormatTokens: entries.filter((entry) => entry.externalAdapterRequired === true).map((entry) => entry.formatToken),
    externalAdapterConfiguredTargetFormatTokens: entries.filter((entry) => entry.externalAdapterRequired === true && entry.adapterConfigured === true).map((entry) => entry.formatToken),
    missingExternalAdapterTargetFormatTokens: entries.filter((entry) => entry.externalAdapterRequired === true && entry.adapterConfigured !== true).map((entry) => entry.formatToken),
    allExternalAdapterRequiredTargetsConfigured: entries.every((entry) => entry.externalAdapterRequired !== true || entry.adapterConfigured === true),
    builtInTargetFormatTokens: entries.filter((entry) => entry.builtInAvailable === true).map((entry) => entry.formatToken),
    builtInTargetFormatsWithOptionalAdapters: entries.filter((entry) => entry.builtInAvailable === true && entry.adapterConfigured === true).map((entry) => entry.formatToken),
    targetFormatEntries
  };
  coverage.adapterTargetFormatCoverageFingerprint = adapterTargetFormatCoverageFingerprint(coverage);
  return coverage;
}

function adapterRegistryFingerprint(summary = {}) {
  const adapterFingerprints = Object.fromEntries(
    Object.entries(summary.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterRegistryFingerprint || adapterRegistryAdapterFingerprint(adapter)])
  );
  const payload = {
    path: summary.path || null,
    adapterConfigPath: summary.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(summary.adapterConfigFileSizeBytes) ? summary.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: summary.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: summary.adapterConfigStatFingerprint || null,
    schemaVersion: summary.schemaVersion || null,
    placeholderKeys: Array.isArray(summary.placeholderKeys) ? summary.placeholderKeys : [],
    adapterTargetFormatCoverageFingerprint: summary.adapterTargetFormatCoverageFingerprint || summary.adapterTargetFormatCoverage?.adapterTargetFormatCoverageFingerprint || null,
    adapters: adapterFingerprints
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterRegistryDecision(summary = {}) {
  const adapterEntries = Object.entries(summary.adapters || {});
  const adapterKeys = adapterEntries.map(([key]) => key).sort();
  const sourceFormatTokens = uniqueValues(adapterEntries
    .flatMap(([, adapter]) => Array.isArray(adapter.formats) ? adapter.formats : []))
    .sort((left, right) => left.localeCompare(right));
  const adapterCoverage = summary.adapterTargetFormatCoverage || adapterTargetFormatCoverage(summary.adapters || {});
  return {
    adapterConfigReady: adapterKeys.length > 0,
    adapterCount: adapterKeys.length,
    adapterKeys,
    sourceFormatTokens,
    targetFormatTokens: Array.isArray(adapterCoverage.targetFormatTokens) ? adapterCoverage.targetFormatTokens : [],
    externalAdapterRequiredTargetFormatTokens: Array.isArray(adapterCoverage.externalAdapterRequiredTargetFormatTokens) ? adapterCoverage.externalAdapterRequiredTargetFormatTokens : [],
    missingExternalAdapterTargetFormatTokens: Array.isArray(adapterCoverage.missingExternalAdapterTargetFormatTokens) ? adapterCoverage.missingExternalAdapterTargetFormatTokens : [],
    allExternalAdapterRequiredTargetsConfigured: adapterCoverage.allExternalAdapterRequiredTargetsConfigured === true,
    canListAdapters: true,
    canCheckAdapters: adapterKeys.length > 0,
    mayLaunchExternalAdapter: false,
    writesProjectJson: false,
    writesReferenceManifest: false,
    safeNextAction: adapterKeys.length > 0 ? "run-check-adapters-or-plan-import" : "add-adapter-config-entry",
    recommendedNextAction: adapterKeys.length > 0 ? "check-adapter-dependencies" : "add-adapter-config-entry"
  };
}

function adapterPreflightDecision(summary = {}) {
  const adapterEntries = Object.entries(summary.adapters || {});
  const adapterKeys = adapterEntries.map(([key]) => key).sort((left, right) => left.localeCompare(right));
  const selectedAdapterKeys = adapterEntries
    .filter(([, adapter]) => adapter?.ok === true)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
  const topLevelDiagnostics = Array.isArray(summary.diagnostics) ? summary.diagnostics : [];
  const adapterDiagnostics = adapterEntries.flatMap(([key, adapter]) => (
    Array.isArray(adapter?.diagnostics)
      ? adapter.diagnostics.map((diagnostic) => ({ adapter: key, ...diagnostic }))
      : []
  ));
  const allDiagnostics = [...topLevelDiagnostics, ...adapterDiagnostics];
  const blockingDiagnostics = allDiagnostics.filter((diagnostic) => diagnostic?.level === "error");
  const warningDiagnostics = allDiagnostics.filter((diagnostic) => diagnostic?.level === "warning");
  const blockingDiagnosticCodes = uniqueValues(blockingDiagnostics
    .map((diagnostic) => diagnostic?.code)
    .filter(Boolean))
    .sort((left, right) => left.localeCompare(right));
  const warningDiagnosticCodes = uniqueValues(warningDiagnostics
    .map((diagnostic) => diagnostic?.code)
    .filter(Boolean))
    .sort((left, right) => left.localeCompare(right));
  const adapterConfigCodes = new Set([
    "adapter-not-found",
    "adapter-format-unsupported",
    "adapter-format-mismatch",
    "adapter-format-unconfigured",
    "adapter-external-tool-cwd-outside-stage",
    "adapter-external-tool-output-outside-scratch",
    "adapter-external-tool-placeholder-unsupported",
    "adapter-external-tool-args-json-invalid",
    "adapter-external-tool-args-string-invalid",
    "adapter-external-tool-shell-invalid",
    "adapter-external-tool-stream-max-buffer-invalid",
    "adapter-external-tool-point-columns-invalid",
    "adapter-external-tool-point-delimiter-invalid",
    "adapter-external-tool-point-rgb-normalized-invalid",
    "adapter-external-tool-obj-vertex-color-layout-invalid"
  ]);
  const adapterDependencyCodes = new Set([
    "adapter-cwd-missing",
    "adapter-command-missing",
    "adapter-required-file-missing",
    "adapter-required-directory-missing",
    "adapter-required-command-missing",
    "adapter-required-env-missing"
  ]);
  let likelyFixArea = "none";
  if (blockingDiagnosticCodes.some((code) => adapterConfigCodes.has(code))) {
    likelyFixArea = "adapter-config";
  } else if (blockingDiagnosticCodes.some((code) => adapterDependencyCodes.has(code))) {
    likelyFixArea = "adapter-dependency";
  } else if (blockingDiagnosticCodes.length) {
    likelyFixArea = "adapter-preflight";
  }
  const adapterPreflightReady = summary.ok === true;
  return {
    adapterPreflightReady,
    requestedFormat: summary.requested?.format || null,
    requestedFormatToken: summary.requested?.requestedFormat || null,
    requestedAdapter: summary.requested?.adapter || null,
    adapterCount: adapterKeys.length,
    adapterKeys,
    selectedAdapterKeys,
    blockingDiagnosticCount: blockingDiagnostics.length,
    warningDiagnosticCount: warningDiagnostics.length,
    blockingDiagnosticCodes,
    warningDiagnosticCodes,
    likelyFixArea,
    mayLaunchExternalAdapter: false,
    writesProjectJson: false,
    writesReferenceManifest: false,
    safeNextAction: adapterPreflightReady ? "run-plan-only-or-dry-run" : "fix-adapter-preflight",
    recommendedNextAction: adapterPreflightReady
      ? "run-plan-only"
      : likelyFixArea === "adapter-config"
        ? "fix-adapter-selection"
        : likelyFixArea === "adapter-dependency"
          ? "fix-adapter-dependencies"
          : "review-adapter-preflight"
  };
}

function adapterPreflightFingerprint(summary = {}) {
  const adapterFingerprints = Object.fromEntries(
    Object.entries(summary.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterPreflightFingerprint || adapterPreflightAdapterFingerprint(adapter)])
  );
  const payload = {
    path: summary.path || null,
    adapterConfigPath: summary.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(summary.adapterConfigFileSizeBytes) ? summary.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: summary.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: summary.adapterConfigStatFingerprint || null,
    schemaVersion: summary.schemaVersion || null,
    placeholderKeys: Array.isArray(summary.placeholderKeys) ? summary.placeholderKeys : [],
    adapterTargetFormatCoverageFingerprint: summary.adapterTargetFormatCoverageFingerprint || summary.adapterTargetFormatCoverage?.adapterTargetFormatCoverageFingerprint || null,
    requested: isRecord(summary.requested) ? summary.requested : null,
    ok: summary.ok ?? null,
    diagnostics: Array.isArray(summary.diagnostics) ? summary.diagnostics : [],
    adapters: adapterFingerprints
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function checkReferenceGeometryAdapters(adapterConfigPath, options = {}) {
  const config = loadAdapterConfig(adapterConfigPath);
  const registry = describeReferenceGeometryAdapters(config.path);
  const selection = adapterCheckSelection(config, options);
  const adapters = Object.fromEntries(selection.entries.map(([key, adapter]) => {
    const formats = uniqueValues(adapterFormats(adapter, key));
    const replacements = adapterPreflightReplacements(
      selection.normalizedFormat || formats[0] || key,
      config.path,
      key,
      selection.requestedFormat || selection.normalizedFormat || formats[0] || key,
      adapter.outputMode || "file",
      Number.isFinite(adapter.timeoutMs) ? adapter.timeoutMs : DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS
    );
    const cwd = adapterCwd(config, adapter, replacements);
    const cwdExists = directoryExists(cwd);
    const command = adapterValue(adapter.command, replacements);
    const env = adapterEnvironment(adapter, replacements);
    const requiredFiles = adapterRequiredFileChecks(adapter, replacements, cwd);
    const requiredDirectories = adapterRequiredDirectoryChecks(adapter, replacements, cwd);
    const requiredCommands = adapterRequiredCommandChecks(adapter, replacements, cwd, env);
    const requiredEnv = adapterRequiredEnvChecks(adapter, env);
    const externalToolArgumentTemplate = externalToolArgumentTemplateMetadata(adapter);
    const shell = adapter.shell === true;
    const commandCheck = shell
      ? { checked: false, found: null, resolvedPath: null }
      : resolveAdapterCommand(command, cwd, env);
    const commandMetadata = adapterDependencyFileStatMetadata(commandCheck.resolvedPath);
    const diagnostics = [];
    if (externalToolArgumentTemplate.source === "default") {
      diagnostics.push({
        level: "warning",
        code: "adapter-argument-template-default-used",
        message: "Adapter external-tool argument template uses the wrapper default; set the indexed, JSON-array, or no-shell string argument env keys when the local converter needs custom arguments."
      });
    }
    if (externalToolArgumentTemplate.shadowedSources.length) {
      diagnostics.push({
        level: "warning",
        code: "adapter-argument-template-source-shadowed",
        message: `Adapter external-tool argument template uses ${externalToolArgumentTemplate.source}; shadowed source(s): ${externalToolArgumentTemplate.shadowedSources.join(", ")}`
      });
    }
    for (const violation of unsupportedExternalToolTemplatePlaceholders(adapter, replacements, externalToolArgumentTemplate)) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-placeholder-unsupported",
        message: `Adapter external-tool env ${violation.envKey} uses unsupported placeholder {${violation.placeholder}}.`
      });
    }
    const argsJsonViolation = externalToolArgsJsonViolation(adapter, externalToolArgumentTemplate);
    if (argsJsonViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-args-json-invalid",
        message: `Adapter external-tool args env ${argsJsonViolation.jsonEnvKey} must be a JSON string array.`
      });
    }
    const argsStringViolation = externalToolArgsStringViolation(adapter, externalToolArgumentTemplate);
    if (argsStringViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-args-string-invalid",
        message: `Adapter external-tool args env ${argsStringViolation.stringEnvKey} must be a non-empty no-shell argument string with balanced quotes.`
      });
    }
    const shellEnvViolation = externalToolShellEnvViolation(adapter, externalToolArgumentTemplate);
    if (shellEnvViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-shell-invalid",
        message: `Adapter external-tool shell env ${shellEnvViolation.shellEnvKey} must be one of 1, 0, true, false, yes, no, on, or off.`
      });
    }
    const streamMaxBufferViolation = externalToolStreamMaxBufferViolation(adapter, externalToolArgumentTemplate);
    if (streamMaxBufferViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-stream-max-buffer-invalid",
        message: `Adapter external-tool stream max buffer env ${streamMaxBufferViolation.streamMaxBufferEnvKey} must be a positive integer byte count.`
      });
    }
    const pointColumnsViolation = externalToolPointColumnsViolation(adapter, externalToolArgumentTemplate);
    if (pointColumnsViolation) {
      const pointColumnsMessage = pointColumnsViolation.reason === "duplicate-column"
        ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} maps ${pointColumnsViolation.duplicateColumn} more than once.`
        : pointColumnsViolation.reason === "empty-column"
          ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must not include empty column names.`
          : pointColumnsViolation.reason === "partial-attribute-group"
            ? `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must include ${pointColumnsViolation.group.join(",")} together.`
            : `Adapter external-tool point columns env ${pointColumnsViolation.pointColumnsEnvKey} must include x, y, and z columns or sphericalRange, sphericalAzimuth, and sphericalElevation columns.`;
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-point-columns-invalid",
        message: pointColumnsMessage
      });
    }
    const pointDelimiterViolation = externalToolPointDelimiterViolation(adapter, externalToolArgumentTemplate);
    if (pointDelimiterViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-point-delimiter-invalid",
        message: `Adapter external-tool point delimiter env ${pointDelimiterViolation.pointDelimiterEnvKey} must be one of auto, space, whitespace, tab, tsv, '\\t', comma, csv, ',', semicolon, or pipe.`
      });
    }
    const pointRgbNormalizedViolation = externalToolPointRgbNormalizedViolation(adapter, externalToolArgumentTemplate);
    if (pointRgbNormalizedViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-point-rgb-normalized-invalid",
        message: `Adapter external-tool point RGB normalized env ${pointRgbNormalizedViolation.pointRgbNormalizedEnvKey} must be one of 1, 0, true, false, yes, no, on, or off.`
      });
    }
    const objVertexColorLayoutViolation = externalToolObjVertexColorLayoutViolation(adapter, externalToolArgumentTemplate);
    if (objVertexColorLayoutViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-obj-vertex-color-layout-invalid",
        message: `Adapter external-tool OBJ vertex color layout env ${objVertexColorLayoutViolation.objVertexColorLayoutEnvKey} must be one of auto, weighted-rgb, or rgba.`
      });
    }
    if (!externalToolCommandCoveredByRequiredCommands(adapter, replacements, cwd, externalToolArgumentTemplate)) {
      diagnostics.push({
        level: "warning",
        code: "adapter-external-tool-command-unchecked",
        message: `Adapter external-tool command env ${externalToolArgumentTemplate.commandEnvKey} is not listed in requiredCommands, so --check-adapters cannot verify the local converter dependency before launch.`
      });
    }
    const externalToolCwdViolation = externalToolCwdStageViolation(adapter, replacements, cwd, externalToolArgumentTemplate);
    if (externalToolCwdViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-cwd-outside-stage",
        message: `Adapter external-tool cwd env ${externalToolCwdViolation.cwdEnvKey} must resolve inside stageDir.`
      });
    }
    const externalToolOutputViolation = externalToolOutputScratchViolation(adapter, replacements, cwd, externalToolArgumentTemplate);
    if (externalToolOutputViolation) {
      diagnostics.push({
        level: "error",
        code: "adapter-external-tool-output-outside-scratch",
        message: `Adapter external-tool output env ${externalToolOutputViolation.outputEnvKey} must resolve ${externalToolOutputViolation.outputLabel} inside scratchDir.`
      });
    }
    if (!cwdExists) {
      diagnostics.push({
        level: "error",
        code: "adapter-cwd-missing",
        message: `Adapter working directory does not exist: ${cwd}`
      });
    }
    if (shell) {
      diagnostics.push({
        level: "warning",
        code: "adapter-shell-command-not-checked",
        message: "Adapter uses shell:true, so command availability cannot be verified without launching a shell."
      });
    } else if (!commandCheck.found) {
      diagnostics.push({
        level: "error",
        code: "adapter-command-missing",
        message: `Adapter command could not be resolved without launching it: ${command}`
      });
    }
    for (const requiredFile of requiredFiles) {
      if (!requiredFile.exists) {
        diagnostics.push({
          level: "error",
          code: "adapter-required-file-missing",
          message: `Adapter required file is missing: ${requiredFile.resolvedPath}`
        });
      }
    }
    for (const requiredDirectory of requiredDirectories) {
      if (!requiredDirectory.exists) {
        diagnostics.push({
          level: "error",
          code: "adapter-required-directory-missing",
          message: `Adapter required directory is missing: ${requiredDirectory.resolvedPath}`
        });
      }
    }
    for (const requiredCommand of requiredCommands) {
      if (!requiredCommand.found) {
        diagnostics.push({
          level: "error",
          code: "adapter-required-command-missing",
          message: `Adapter required command could not be resolved without launching it: ${requiredCommand.command}`
        });
      }
    }
    for (const requiredEnvEntry of requiredEnv) {
      if (!requiredEnvEntry.exists) {
        diagnostics.push({
          level: "error",
          code: "adapter-required-env-missing",
          message: `Adapter required environment variable is missing: ${requiredEnvEntry.name}`
        });
      }
    }
    const ok = cwdExists
      && (shell || commandCheck.found === true)
      && requiredFiles.every((requiredFile) => requiredFile.exists)
      && requiredDirectories.every((requiredDirectory) => requiredDirectory.exists)
      && requiredCommands.every((requiredCommand) => requiredCommand.found)
      && requiredEnv.every((requiredEnvEntry) => requiredEnvEntry.exists)
      && diagnostics.every((diagnostic) => diagnostic.level !== "error");
    const adapterSummary = {
      formats,
      declaredFormats: Array.isArray(adapter.formats) ? [...adapter.formats] : [adapter.format || key],
      command,
      commandChecked: commandCheck.checked,
      commandFound: commandCheck.found,
      resolvedCommand: commandCheck.resolvedPath,
      resolvedCommandFileSizeBytes: commandMetadata.fileSizeBytes,
      resolvedCommandFileModifiedTime: commandMetadata.fileModifiedTime,
      resolvedCommandFileStatFingerprint: commandMetadata.fileStatFingerprint,
      cwd,
      cwdExists,
      requiredFiles,
      requiredDirectories,
      requiredCommands,
      requiredEnv,
      envKeys: isRecord(adapter.env) ? Object.keys(adapter.env).sort() : [],
      externalToolArgumentTemplateMode: externalToolArgumentTemplate.mode,
      externalToolArgumentTemplateSource: externalToolArgumentTemplate.source,
      externalToolArgumentTemplateSources: externalToolArgumentTemplate.sources,
      externalToolArgumentTemplateShadowedSources: externalToolArgumentTemplate.shadowedSources,
      externalToolTemplatedEnvKeys: externalToolArgumentTemplate.templatedEnvKeys,
      externalToolRawConfigEnvKeys: externalToolArgumentTemplate.rawConfigEnvKeys,
      externalToolRawConfigPlaceholderPolicy: externalToolArgumentTemplate.rawConfigPlaceholderPolicy,
      outputMode: adapter.outputMode || "file",
      timeoutMs: Number.isFinite(adapter.timeoutMs) ? adapter.timeoutMs : DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS,
      streamMaxBufferBytes: Number.isFinite(adapter.streamMaxBufferBytes) ? adapter.streamMaxBufferBytes : DEFAULT_EXTERNAL_ADAPTER_STREAM_MAX_BUFFER_BYTES,
      shell,
      ok,
      diagnostics
    };
    adapterSummary.adapterRegistryFingerprint = registry.adapters?.[key]?.adapterRegistryFingerprint || null;
    adapterSummary.adapterPreflightFingerprint = adapterPreflightAdapterFingerprint(adapterSummary);
    return [
      key,
      adapterSummary
    ];
  }));
  const summary = {
    path: config.path,
    ...adapterConfigFileMetadata(config.path),
    schemaVersion: config.data.schemaVersion,
    placeholderKeys: [...ADAPTER_PLACEHOLDER_KEYS],
    requested: {
      format: selection.normalizedFormat || null,
      requestedFormat: selection.requestedFormat || null,
      adapter: options.adapterName || null
    },
    ok: selection.diagnostics.every((diagnostic) => diagnostic.level !== "error")
      && Object.values(adapters).every((adapter) => adapter.ok),
    diagnostics: selection.diagnostics,
    adapters,
    adapterTargetFormatCoverage: registry.adapterTargetFormatCoverage || adapterTargetFormatCoverage(registry.adapters || adapters)
  };
  summary.adapterTargetFormatCoverageFingerprint = summary.adapterTargetFormatCoverage.adapterTargetFormatCoverageFingerprint;
  summary.adapterRegistryFingerprint = registry.adapterRegistryFingerprint || null;
  summary.adapterPreflightFingerprint = adapterPreflightFingerprint(summary);
  summary.adapterPreflightDecision = adapterPreflightDecision(summary);
  return summary;
}

function selectExternalAdapter(config, format, adapterName = null) {
  if (!config) {
    throw adapterConfigurationError(`Reference geometry format ${format} requires --adapter-config. External adapters are intentionally outside the app runtime.`, {
      code: "adapter-config-missing"
    });
  }
  if (adapterName) {
    const adapter = config.data.adapters[adapterName];
    if (!adapter) {
      throw adapterConfigurationError(`${config.path}: adapter not found: ${adapterName}`, {
        adapter: adapterName,
        adapterConfigPath: config.path,
        code: "adapter-not-found"
      });
    }
    if (!adapterFormats(adapter, adapterName).includes(format)) {
      throw adapterConfigurationError(`${config.path}: adapter ${adapterName} does not support ${format}`, {
        adapter: adapterName,
        adapterConfigPath: config.path,
        code: "adapter-format-mismatch"
      });
    }
    return { key: adapterName, adapter };
  }
  for (const [key, adapter] of Object.entries(config.data.adapters)) {
    if (adapterFormats(adapter, key).includes(format)) return { key, adapter };
  }
  throw adapterConfigurationError(`${config.path}: no external adapter configured for ${format}`, {
    adapterConfigPath: config.path,
    code: "adapter-format-unconfigured"
  });
}

function adapterValue(value, replacements) {
  return String(value || "").replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, key) => (
    Object.hasOwn(replacements, key) ? replacements[key] : match
  ));
}

function adapterCwd(config, adapter, replacements) {
  if (!adapter.cwd) return path.dirname(config.path);
  const cwd = adapterValue(adapter.cwd, replacements);
  return path.isAbsolute(cwd) ? cwd : path.resolve(path.dirname(config.path), cwd);
}

function adapterEnvironment(adapter, replacements) {
  const env = { ...process.env };
  if (!isRecord(adapter.env)) return env;
  for (const [key, value] of Object.entries(adapter.env)) {
    env[key] = adapterValue(value, replacements);
  }
  return env;
}

function clippedAdapterOutput(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= ADAPTER_OUTPUT_ERROR_LIMIT) return text;
  return `${text.slice(0, ADAPTER_OUTPUT_ERROR_LIMIT)}\n[truncated ${text.length - ADAPTER_OUTPUT_ERROR_LIMIT} character(s)]`;
}

function assignAdapterSourceErrorMetadata(error, details = {}) {
  for (const key of [
    "sourceDirectory",
    "sourceFileName",
    "sourceFileStem",
    "sourceFileExtension",
    "sourceFileSizeBytes",
    "sourceFileModifiedTime",
    "sourceStatFingerprint",
    "sourceFormat",
    "sourceRequestedFormat",
    "adapterRequestFingerprint",
    "adapterRunId",
    "stageDir",
    "scratchDir",
    "adapterLogPath"
  ]) {
    if (details[key] !== undefined && details[key] !== null && !Object.hasOwn(error, key)) {
      error[key] = key === "adapterLogPath" || key === "stageDir" || key === "scratchDir"
        ? path.resolve(details[key])
        : details[key];
    }
  }
}

function adapterProcessError(message, details = {}) {
  const error = new Error(message);
  error.adapter = details.adapter || null;
  error.adapterErrorCode = details.code
    || (details.timedOut === true
      ? "adapter-timeout"
      : details.startErrorCode
        ? "adapter-start-error"
        : Number.isInteger(details.exitCode)
          ? "adapter-exit-nonzero"
          : "adapter-process-error");
  if (details.adapterConfigPath) Object.assign(error, adapterConfigFileMetadata(details.adapterConfigPath));
  if (details.adapterRequestPath) error.adapterRequestPath = path.resolve(details.adapterRequestPath);
  if (details.adapterOutputPath) error.adapterOutputPath = path.resolve(details.adapterOutputPath);
  if (details.adapterStdoutPath) error.adapterStdoutPath = path.resolve(details.adapterStdoutPath);
  if (details.adapterStderrPath) error.adapterStderrPath = path.resolve(details.adapterStderrPath);
  if (details.adapterCwd) error.adapterCwd = path.resolve(details.adapterCwd);
  if (typeof details.adapterCwdExists === "boolean") error.adapterCwdExists = details.adapterCwdExists;
  if (details.adapterCommand) error.adapterCommand = details.adapterCommand;
  if (typeof details.adapterCommandFound === "boolean") error.adapterCommandFound = details.adapterCommandFound;
  if (details.adapterResolvedCommand) error.adapterResolvedCommand = path.resolve(details.adapterResolvedCommand);
  if (details.adapterOutputMode) error.adapterOutputMode = details.adapterOutputMode;
  error.adapterExitCode = Number.isInteger(details.exitCode) ? details.exitCode : null;
  error.adapterSignal = details.signal || null;
  error.adapterTimedOut = details.timedOut === true;
  error.adapterTimeoutMs = Number.isFinite(details.timeoutMs) ? details.timeoutMs : null;
  error.adapterStreamMaxBufferBytes = Number.isInteger(details.streamMaxBufferBytes) ? details.streamMaxBufferBytes : null;
  error.adapterStartErrorCode = details.startErrorCode || null;
  error.adapterStdout = clippedAdapterOutput(details.stdout || "");
  error.adapterStderr = clippedAdapterOutput(details.stderr || "");
  assignAdapterSourceErrorMetadata(error, details);
  return error;
}

function adapterConfigurationError(message, details = {}) {
  const error = new Error(message);
  error.adapter = details.adapter || null;
  error.adapterErrorCode = details.code || null;
  if (details.adapterConfigPath) Object.assign(error, adapterConfigFileMetadata(details.adapterConfigPath));
  if (details.adapterRequestPath) error.adapterRequestPath = path.resolve(details.adapterRequestPath);
  if (details.adapterOutputPath) error.adapterOutputPath = path.resolve(details.adapterOutputPath);
  if (details.adapterStdoutPath) error.adapterStdoutPath = path.resolve(details.adapterStdoutPath);
  if (details.adapterStderrPath) error.adapterStderrPath = path.resolve(details.adapterStderrPath);
  if (details.adapterCwd) error.adapterCwd = path.resolve(details.adapterCwd);
  if (typeof details.adapterCwdExists === "boolean") error.adapterCwdExists = details.adapterCwdExists;
  if (details.adapterCommand) error.adapterCommand = details.adapterCommand;
  if (typeof details.adapterCommandFound === "boolean") error.adapterCommandFound = details.adapterCommandFound;
  if (details.adapterResolvedCommand) error.adapterResolvedCommand = path.resolve(details.adapterResolvedCommand);
  if (details.adapterOutputMode) error.adapterOutputMode = details.adapterOutputMode;
  if (typeof details.adapterPreflightOk === "boolean") error.adapterPreflightOk = details.adapterPreflightOk;
  if (details.adapterPreflightRequested) error.adapterPreflightRequested = details.adapterPreflightRequested;
  if (details.adapterPreflightSelectedAdapter) error.adapterPreflightSelectedAdapter = details.adapterPreflightSelectedAdapter;
  if (Array.isArray(details.adapterPreflightAdapterKeys)) error.adapterPreflightAdapterKeys = [...details.adapterPreflightAdapterKeys];
  if (isRecord(details.adapterPreflightFingerprints)) error.adapterPreflightFingerprints = { ...details.adapterPreflightFingerprints };
  if (details.adapterPreflightFingerprint) error.adapterPreflightFingerprint = details.adapterPreflightFingerprint;
  if (isRecord(details.adapterPreflightDecision)) error.adapterPreflightDecision = { ...details.adapterPreflightDecision };
  if (Array.isArray(details.adapterPreflightDiagnostics)) error.adapterPreflightDiagnostics = details.adapterPreflightDiagnostics.map((diagnostic) => ({ ...diagnostic }));
  if (details.stdout !== undefined) error.adapterStdout = clippedAdapterOutput(details.stdout || "");
  if (details.stderr !== undefined) error.adapterStderr = clippedAdapterOutput(details.stderr || "");
  for (const key of [
    "adapterMissingRequiredFiles",
    "adapterMissingRequiredDirectories",
    "adapterMissingRequiredCommands",
    "adapterMissingRequiredEnv"
  ]) {
    if (Array.isArray(details[key]) && details[key].length) {
      error[key] = details[key].map((entry) => ({ ...entry }));
    }
  }
  assignAdapterSourceErrorMetadata(error, details);
  return error;
}

function namedAdapterRequiresConfigTranslationError({ adapterName, sourceFormat, requestedFormat, inputPath }) {
  return adapterConfigurationError(`--adapter requires --adapter-config when translating reference geometry for ${sourceFormat}`, {
    adapter: adapterName,
    code: "adapter-config-missing",
    sourceFormat,
    sourceRequestedFormat: requestedFormatToken(requestedFormat, inputPath),
    ...adapterSourceFileMetadata(inputPath)
  });
}

function adapterDebugOptionsRequireConfigTranslationError({ optionNames, sourceFormat, requestedFormat, inputPath }) {
  const optionList = optionNames.join(", ");
  return adapterConfigurationError(`${optionList} require --adapter-config when translating built-in reference geometry for ${sourceFormat}`, {
    code: "adapter-config-missing",
    sourceFormat,
    sourceRequestedFormat: requestedFormatToken(requestedFormat, inputPath),
    ...adapterSourceFileMetadata(inputPath)
  });
}

export function adapterStagePreservationOptionsRequestOnlyError(optionNames) {
  const optionList = optionNames.join(", ");
  return adapterConfigurationError(`${optionList} cannot be used with --write-adapter-request; request-only mode does not launch an adapter or keep adapter run staging artifacts`, {
    code: "adapter-stage-option-unsupported"
  });
}

export function adapterRunOptionsPlanOnlyError(optionNames) {
  const optionList = optionNames.join(", ");
  return adapterConfigurationError(`${optionList} cannot be used with --plan-only; plan-only validates the reference candidate and optional adapter preflight without running the translator or launching an adapter`, {
    code: "adapter-run-option-unsupported"
  });
}

function unsupportedReferenceFormatError(format) {
  return adapterConfigurationError(`Unsupported reference geometry source format: ${format || "unknown"}`, {
    code: "reference-format-unsupported"
  });
}

function normalizedAdapterTimeoutOverride(adapterTimeoutMs) {
  if (adapterTimeoutMs === null || adapterTimeoutMs === undefined) return null;
  if (!Number.isInteger(adapterTimeoutMs) || adapterTimeoutMs < 1) {
    throw adapterConfigurationError("--adapter-timeout-ms must be a positive integer number of milliseconds", {
      code: "adapter-timeout-invalid"
    });
  }
  return adapterTimeoutMs;
}

function normalizedAdapterStreamMaxBufferBytes(value, label = "adapter streamMaxBufferBytes") {
  if (value === null || value === undefined) return DEFAULT_EXTERNAL_ADAPTER_STREAM_MAX_BUFFER_BYTES;
  if (!Number.isInteger(value) || value < 1) {
    throw adapterConfigurationError(`${label} must be a positive integer byte count`, {
      code: "adapter-stream-max-buffer-invalid"
    });
  }
  return value;
}

function pointCloudChunkSizeOptionError() {
  return adapterConfigurationError("--point-cloud-chunk-size must be a positive integer point count", {
    code: "point-cloud-chunk-size-invalid"
  });
}

export function normalizedExplicitReferenceUnits(value) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeCanonicalUnits(value);
  if (!["mm", "m", "in", "ft"].includes(normalized)) {
    throw adapterConfigurationError("--units must be one of mm, m, in, or ft", {
      code: "reference-units-invalid"
    });
  }
  return normalized;
}

function adapterOutputErrorCode(error, details = {}) {
  const message = String(error?.message || error || "");
  const adapterOutputPath = details.adapterOutputPath ? path.resolve(details.adapterOutputPath) : "";
  const stageDir = details.stageDir ? path.resolve(details.stageDir) : "";
  if ((adapterOutputPath && message.includes(adapterOutputPath)) || (stageDir && message.includes(stageDir))) {
    if (/\bbounds\b/i.test(message)) return "adapter-output-bounds-invalid";
    return "adapter-output-invalid";
  }
  return "adapter-output-error";
}

function isAdapterOutputValidationErrorCode(code) {
  return code === "adapter-output-invalid" || code === "adapter-output-bounds-invalid";
}

function adapterOutputValidationMessage(error) {
  return clippedAdapterOutput(String(error?.message || error || "").trim());
}

function adapterOutputValidationPath(error, details = {}) {
  const message = String(error?.message || error || "");
  const match = message.match(/^(.+?\.json):\s+/);
  if (!match) return null;
  const candidate = match[1];
  return path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(details.stageDir || process.cwd(), candidate);
}

function adapterOutputValidationKind(validationPath, details = {}) {
  if (!validationPath) return null;
  const resolved = path.resolve(validationPath);
  if (details.adapterOutputPath && resolved === path.resolve(details.adapterOutputPath)) return "manifest";
  const parent = path.basename(path.dirname(resolved)).toLowerCase();
  if (parent === "chunks") return "point-cloud-chunk";
  return "sidecar";
}

function annotateExternalAdapterOutputError(error, details = {}) {
  const annotated = error && typeof error === "object" ? error : new Error(String(error));
  if (details.adapter && !annotated.adapter) annotated.adapter = details.adapter;
  if (!annotated.adapterErrorCode && details.adapterOutputPath) {
    annotated.adapterErrorCode = adapterOutputErrorCode(annotated, details);
  }
  if (isAdapterOutputValidationErrorCode(annotated.adapterErrorCode) && !annotated.adapterOutputValidationMessage) {
    annotated.adapterOutputValidationMessage = adapterOutputValidationMessage(annotated);
  }
  if (isAdapterOutputValidationErrorCode(annotated.adapterErrorCode) && !annotated.adapterOutputValidationPath) {
    const validationPath = adapterOutputValidationPath(annotated, details);
    if (validationPath) {
      annotated.adapterOutputValidationPath = validationPath;
      annotated.adapterOutputValidationKind = adapterOutputValidationKind(validationPath, details);
    }
  }
  if (details.adapterConfigPath && !annotated.adapterConfigPath) {
    Object.assign(annotated, adapterConfigFileMetadata(details.adapterConfigPath));
  }
  if (details.adapterRequestPath && !annotated.adapterRequestPath) {
    annotated.adapterRequestPath = path.resolve(details.adapterRequestPath);
  }
  if (details.adapterOutputPath && !annotated.adapterOutputPath) {
    annotated.adapterOutputPath = path.resolve(details.adapterOutputPath);
  }
  if (details.adapterStdoutPath && !annotated.adapterStdoutPath) {
    annotated.adapterStdoutPath = path.resolve(details.adapterStdoutPath);
  }
  if (details.adapterStderrPath && !annotated.adapterStderrPath) {
    annotated.adapterStderrPath = path.resolve(details.adapterStderrPath);
  }
  if (details.adapterStdout && !annotated.adapterStdout) {
    annotated.adapterStdout = clippedAdapterOutput(details.adapterStdout);
  }
  if (details.adapterStderr && !annotated.adapterStderr) {
    annotated.adapterStderr = clippedAdapterOutput(details.adapterStderr);
  }
  assignAdapterSourceErrorMetadata(annotated, details);
  return annotated;
}

function adapterOutputDiagnosticText(value) {
  return clippedAdapterOutput(value || "").trim().replace(/\s+/g, " ");
}

function safeCanonicalDiagnosticMessage(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= DIAGNOSTIC_MESSAGE_MAX_LENGTH
    && DIAGNOSTIC_MESSAGE_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

function safeCanonicalDiagnosticCode(value) {
  return typeof value === "string" && new RegExp(DIAGNOSTIC_CODE_PATTERN_SOURCE).test(value);
}

function pathFreeDiagnosticMessagePrefix(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (safeCanonicalDiagnosticMessage(text)) return text;
  let end = text.length;
  for (const pattern of DIAGNOSTIC_MESSAGE_FORBIDDEN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) end = Math.min(end, match.index);
  }
  const prefix = text.slice(0, end).replace(/[\s:;,.]+$/g, "");
  const candidate = prefix
    ? `${prefix}; path-like diagnostic detail omitted.`
    : "External adapter diagnostic detail omitted because it is not path-free diagnostic text.";
  return safeCanonicalDiagnosticMessage(candidate)
    ? candidate
    : "External adapter diagnostic detail omitted because it is not path-free diagnostic text.";
}

function normalizeReferenceDiagnostics(data) {
  if (!Array.isArray(data?.diagnostics)) return;
  data.diagnostics = data.diagnostics.map((diagnostic) => {
    if (!isRecord(diagnostic)) {
      return {
        severity: "warning",
        code: "external-adapter-diagnostic-omitted",
        message: "External adapter diagnostic omitted because it is not a canonical diagnostic object."
      };
    }
    const severity = ["info", "warning", "error"].includes(diagnostic.severity) ? diagnostic.severity : "warning";
    const code = safeCanonicalDiagnosticCode(diagnostic.code)
      ? diagnostic.code
      : "external-adapter-diagnostic-omitted";
    const message = code === diagnostic.code
      ? pathFreeDiagnosticMessagePrefix(diagnostic.message)
      : "External adapter diagnostic omitted because its code is not a safe diagnostic token.";
    const normalized = { severity, code, message };
    if (typeof diagnostic.objectId === "string") normalized.objectId = diagnostic.objectId;
    if (Array.isArray(diagnostic.objectRefs)) normalized.objectRefs = diagnostic.objectRefs;
    return normalized;
  });
}

function externalAdapterOutputDiagnosticMessage(adapterKey, streamName, text) {
  const prefix = `External reference adapter ${adapterKey} wrote ${streamName}`;
  const message = `${prefix}: ${text}`;
  if (safeCanonicalDiagnosticMessage(message)) return message;
  return `${prefix}; output omitted because it is not path-free diagnostic text.`;
}

function addExternalAdapterOutputDiagnostics(data, { adapterKey, stdout = "", stderr = "" }) {
  if (!Object.hasOwn(data, "diagnostics")) data.diagnostics = [];
  if (!Array.isArray(data.diagnostics)) return;
  const stdoutText = adapterOutputDiagnosticText(stdout);
  if (stdoutText) {
    addDiagnostic(
      data.diagnostics,
      "info",
      "external-adapter-stdout",
      externalAdapterOutputDiagnosticMessage(adapterKey, "stdout", stdoutText)
    );
  }
  const stderrText = adapterOutputDiagnosticText(stderr);
  if (stderrText) {
    addDiagnostic(
      data.diagnostics,
      "info",
      "external-adapter-stderr",
      externalAdapterOutputDiagnosticMessage(adapterKey, "stderr", stderrText)
    );
  }
}

function redactAdapterRunIdFromReferenceValue(value, adapterRunId) {
  if (!adapterRunId) return value;
  if (typeof value === "string") return value.split(adapterRunId).join("<adapterRunId>");
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = redactAdapterRunIdFromReferenceValue(value[index], adapterRunId);
    }
    return value;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      value[key] = redactAdapterRunIdFromReferenceValue(child, adapterRunId);
    }
  }
  return value;
}

export function sourceFileMetadata(inputPath, label = "source input") {
  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) throw new Error(`${inputPath}: ${label} must be a file`);
  const metadata = {
    sourceDirectory: path.dirname(inputPath),
    sourceFileName: path.basename(inputPath),
    sourceFileStem: path.basename(inputPath, path.extname(inputPath)),
    sourceFileExtension: path.extname(inputPath).replace(/^\./, "").toLowerCase(),
    sourceFileSizeBytes: stat.size,
    sourceFileModifiedTime: stat.mtime.toISOString()
  };
  metadata.sourceStatFingerprint = sourceStatFingerprint(metadata);
  return metadata;
}

const PUBLIC_SOURCE_STAT_EXTENSIONS = new Set(["dxf", "dwg", "step", "stp", "p21", "stpnc", "ifc", "ifcxml", "ifczip", "e57", "json"]);

function publicSourceStatExtension(sourceFile = {}) {
  const raw = typeof sourceFile.sourceFileExtension === "string"
    ? sourceFile.sourceFileExtension
    : (typeof sourceFile.fileExtension === "string"
      ? sourceFile.fileExtension
      : path.extname(sourceFile.sourceFileName || sourceFile.fileName || "").replace(/^\./, ""));
  const token = formatToken(raw);
  return PUBLIC_SOURCE_STAT_EXTENSIONS.has(token) ? token : "";
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

function sourceStatFingerprint(sourceFile) {
  return publicStatFingerprint(
    "source-file",
    publicSourceStatExtension(sourceFile),
    sourceFile.sourceFileSizeBytes,
    sourceFile.sourceFileModifiedTime
  );
}

function adapterConfigStatFingerprint(fileSizeBytes, fileModifiedTime) {
  return publicStatFingerprint("adapter-config", "json", fileSizeBytes, fileModifiedTime);
}

function referenceFileMetadata(filePath) {
  const stat = fs.statSync(filePath);
  return {
    referenceFileSizeBytes: stat.size,
    referenceFileModifiedTime: stat.mtime.toISOString(),
    referenceManifestFingerprint: referenceManifestFingerprint(filePath)
  };
}

function referenceManifestFingerprint(filePath) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function referenceChunkFileSetFingerprint(entries) {
  const normalizedEntries = entries
    .map((entry) => ({
      chunkId: entry.chunkId || null,
      path: entry.path || null,
      fileSizeBytes: Number.isInteger(entry.fileSizeBytes) ? entry.fileSizeBytes : null,
      fileModifiedTime: entry.fileModifiedTime || null
    }))
    .sort((left, right) => `${left.path || ""}\0${left.chunkId || ""}`.localeCompare(`${right.path || ""}\0${right.chunkId || ""}`));
  return `stat-sha256:${crypto.createHash("sha256").update(JSON.stringify(normalizedEntries)).digest("hex")}`;
}

function referenceArtifactFingerprint(manifestFingerprint, chunkFileSetFingerprint) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify({
    manifest: manifestFingerprint || null,
    chunks: chunkFileSetFingerprint || null
  })).digest("hex")}`;
}

function adapterConfigFileMetadata(configPath) {
  if (!configPath) {
    return {
      adapterConfigPath: null,
      adapterConfigFileSizeBytes: null,
      adapterConfigFileModifiedTime: null,
      adapterConfigStatFingerprint: null
    };
  }
  const absolutePath = path.resolve(configPath);
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) throw new Error(`${absolutePath}: adapter config must be a file`);
  const modifiedTime = stat.mtime.toISOString();
  return {
    adapterConfigPath: absolutePath,
    adapterConfigFileSizeBytes: stat.size,
    adapterConfigFileModifiedTime: modifiedTime,
    adapterConfigStatFingerprint: adapterConfigStatFingerprint(stat.size, modifiedTime)
  };
}

function referenceChunkFileMetadata(manifestPath, data) {
  const chunks = Array.isArray(data?.chunks) ? data.chunks : [];
  const summary = {
    referenceChunkFileCount: 0,
    referenceChunkFileSizeBytes: 0,
    referenceChunkFileModifiedTimeLatest: null,
    referenceChunkFileMissingCount: 0,
    referenceChunkFileInvalidCount: 0,
    referenceChunkFileInvalidEntries: [],
    referenceChunkFileInvalidOmittedCount: 0,
    referenceChunkPointCount: 0,
    referenceChunkFileEntries: [],
    referenceChunkFileOmittedCount: 0,
    referenceChunkFileSetFingerprint: null,
    referenceArtifactFingerprint: null
  };
  const chunkFileEntries = [];
  let latestMtimeMs = -Infinity;
  for (const chunk of chunks) {
    if (!chunk?.path) continue;
    if (Number.isInteger(chunk.pointCount)) summary.referenceChunkPointCount += chunk.pointCount;
    const chunkPath = safeManifestSidecarPath(manifestPath, chunk.path, `chunk ${chunk.id || "<unknown>"}`);
    const stat = fs.statSync(chunkPath);
    if (!stat.isFile()) throw new Error(`${chunkPath}: reference chunk sidecar must be a file`);
    const fileModifiedTime = stat.mtime.toISOString();
    summary.referenceChunkFileCount += 1;
    summary.referenceChunkFileSizeBytes += stat.size;
    chunkFileEntries.push({
      chunkId: typeof chunk.id === "string" ? chunk.id : null,
      path: chunk.path,
      pointCount: Number.isInteger(chunk.pointCount) ? chunk.pointCount : null,
      fileSizeBytes: stat.size,
      fileModifiedTime
    });
    if (stat.mtimeMs > latestMtimeMs) {
      latestMtimeMs = stat.mtimeMs;
      summary.referenceChunkFileModifiedTimeLatest = fileModifiedTime;
    }
  }
  summary.referenceChunkFileEntries = chunkFileEntries.slice(0, REFERENCE_CHUNK_FILE_ENTRY_LIMIT);
  summary.referenceChunkFileOmittedCount = Math.max(0, chunkFileEntries.length - summary.referenceChunkFileEntries.length);
  summary.referenceChunkFileSetFingerprint = referenceChunkFileSetFingerprint(chunkFileEntries);
  summary.referenceArtifactFingerprint = referenceArtifactFingerprint(referenceManifestFingerprint(manifestPath), summary.referenceChunkFileSetFingerprint);
  return summary;
}

function adapterScratchFileMetadata(scratchDir) {
  const summary = {
    adapterScratchFileCount: 0,
    adapterScratchFileSizeBytes: 0,
    adapterScratchFileModifiedTimeLatest: null,
    adapterScratchFileEntries: [],
    adapterScratchFileOmittedCount: 0
  };
  if (!scratchDir || !fs.existsSync(scratchDir)) return summary;
  let latestMtimeMs = -Infinity;
  const root = path.resolve(scratchDir);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(entryPath);
        const relativePath = path.relative(root, entryPath).replaceAll(path.sep, "/");
        summary.adapterScratchFileCount += 1;
        summary.adapterScratchFileSizeBytes += stat.size;
        if (summary.adapterScratchFileEntries.length < ADAPTER_SCRATCH_FILE_ENTRY_LIMIT) {
          summary.adapterScratchFileEntries.push({
            path: relativePath,
            sizeBytes: stat.size,
            modifiedTime: stat.mtime.toISOString()
          });
        }
        if (stat.mtimeMs > latestMtimeMs) {
          latestMtimeMs = stat.mtimeMs;
          summary.adapterScratchFileModifiedTimeLatest = stat.mtime.toISOString();
        }
      }
    }
  }
  summary.adapterScratchFileOmittedCount = Math.max(0, summary.adapterScratchFileCount - summary.adapterScratchFileEntries.length);
  return summary;
}

function referencePointCloudPointCount(data) {
  const chunksById = new Map((data?.chunks || []).map((chunk) => [chunk?.id, chunk]));
  let pointCount = 0;
  for (const object of Object.values(data?.objects || {})) {
    if (object?.kind !== "point-cloud") continue;
    if (Array.isArray(object.points)) pointCount += object.points.length;
    for (const chunkId of object.chunkIds || []) {
      const chunk = chunksById.get(chunkId);
      if (Number.isInteger(chunk?.pointCount)) pointCount += chunk.pointCount;
    }
  }
  return pointCount;
}

function referencePrimitiveCounts(data) {
  const counts = {
    referenceLineSegmentCount: 0,
    referenceMeshFaceCount: 0
  };
  for (const object of Object.values(data?.objects || {})) {
    if (object?.kind === "line-set" && Array.isArray(object.lineSegments)) {
      counts.referenceLineSegmentCount += object.lineSegments.length;
    } else if (object?.kind === "mesh" && Array.isArray(object.faces)) {
      counts.referenceMeshFaceCount += object.faces.length;
    }
  }
  return counts;
}

function referenceAssetMetadata(data) {
  const coordinateSystem = data?.asset?.coordinateSystem || null;
  return {
    referenceUnits: data?.asset?.units || null,
    referenceBoundsMin: Array.isArray(data?.asset?.bounds?.min) ? data.asset.bounds.min : null,
    referenceBoundsMax: Array.isArray(data?.asset?.bounds?.max) ? data.asset.bounds.max : null,
    referenceCoordinateSystem: coordinateSystem,
    referenceCoordinateSystemOrigin: Array.isArray(coordinateSystem?.origin) ? coordinateSystem.origin : null,
    referenceCoordinateSystemAxisX: Array.isArray(coordinateSystem?.axisX) ? coordinateSystem.axisX : null,
    referenceCoordinateSystemAxisY: Array.isArray(coordinateSystem?.axisY) ? coordinateSystem.axisY : null,
    referenceCoordinateSystemAxisZ: Array.isArray(coordinateSystem?.axisZ) ? coordinateSystem.axisZ : null
  };
}

function referenceSchemaMetadata(data) {
  return {
    schema: data?.schema || null,
    schemaVersion: data?.schemaVersion || null,
    referenceSchema: data?.schema || null,
    referenceSchemaVersion: data?.schemaVersion || null
  };
}

function boundedEntries(entries, limit) {
  const values = Array.isArray(entries) ? entries : [];
  return {
    entries: values.slice(0, limit),
    omittedCount: Math.max(0, values.length - limit)
  };
}

function referenceObjectSummaryEntry(object = {}, chunksById = new Map()) {
  const chunkIds = Array.isArray(object?.chunkIds)
    ? object.chunkIds.filter((chunkId) => typeof chunkId === "string" && chunkId)
    : [];
  const chunkPointCount = chunkIds.reduce((total, chunkId) => {
    const chunk = chunksById.get(chunkId);
    return total + (Number.isInteger(chunk?.pointCount) ? chunk.pointCount : 0);
  }, 0);
  const inlinePointCount = Array.isArray(object?.points) ? object.points.length : null;
  const pointCount = object?.kind === "point-cloud"
    ? (inlinePointCount || 0) + chunkPointCount
    : null;
  return {
    id: typeof object?.id === "string" ? object.id : null,
    kind: typeof object?.kind === "string" ? object.kind : null,
    name: typeof object?.name === "string" ? object.name : null,
    layer: typeof object?.layer === "string" ? object.layer : null,
    boundsMin: Array.isArray(object?.bounds?.min) ? object.bounds.min : null,
    boundsMax: Array.isArray(object?.bounds?.max) ? object.bounds.max : null,
    vertexCount: Array.isArray(object?.vertices) ? object.vertices.length : null,
    lineSegmentCount: Array.isArray(object?.lineSegments) ? object.lineSegments.length : null,
    faceCount: Array.isArray(object?.faces) ? object.faces.length : null,
    inlinePointCount,
    chunkCount: chunkIds.length,
    chunkPointCount,
    pointCount
  };
}

function referenceLayerObjectCounts(objects) {
  const counts = new Map();
  for (const object of Object.values(objects || {})) {
    if (typeof object?.layer !== "string" || !object.layer) continue;
    counts.set(object.layer, (counts.get(object.layer) || 0) + 1);
  }
  return counts;
}

function referenceLayerSummaryEntry(layer = {}, objectCounts = new Map()) {
  const display = isRecord(layer?.display) ? layer.display : null;
  const id = typeof layer?.id === "string" ? layer.id : null;
  return {
    id,
    name: typeof layer?.name === "string" ? layer.name : null,
    objectCount: id ? objectCounts.get(id) || 0 : 0,
    displayVisible: typeof display?.visible === "boolean" ? display.visible : null,
    displayColor: typeof display?.color === "string" ? display.color : null,
    displayEdgeColor: typeof display?.edgeColor === "string" ? display.edgeColor : null,
    displayOpacity: Number.isFinite(display?.opacity) ? display.opacity : null,
    displayPointSize: Number.isFinite(display?.pointSize) ? display.pointSize : null
  };
}

function referenceStructureSummary(data) {
  const objects = data?.objects || {};
  const layers = data?.layers || {};
  const chunks = Array.isArray(data?.chunks) ? data.chunks : [];
  const chunksById = new Map(chunks.map((chunk) => [chunk?.id, chunk]));
  const objectKindCounts = Object.fromEntries(Object.entries(objects).reduce((counts, [, object]) => {
    const kind = object?.kind || "unknown";
    counts.set(kind, (counts.get(kind) || 0) + 1);
    return counts;
  }, new Map()));
  const objectIds = Object.keys(objects);
  const layerIds = Object.keys(layers);
  const chunkIds = chunks.map((chunk) => chunk?.id).filter((id) => typeof id === "string" && id);
  const objectCount = objectIds.length;
  const layerCount = layerIds.length;
  const chunkCount = chunkIds.length;
  const layerObjectCounts = referenceLayerObjectCounts(objects);
  const boundedObjectIds = boundedEntries(objectIds, REFERENCE_STRUCTURE_ENTRY_LIMIT);
  const boundedLayerIds = boundedEntries(layerIds, REFERENCE_STRUCTURE_ENTRY_LIMIT);
  const boundedChunkIds = boundedEntries(chunkIds, REFERENCE_STRUCTURE_ENTRY_LIMIT);
  const boundedObjectEntries = boundedEntries(
    Object.values(objects).map((object) => referenceObjectSummaryEntry(object, chunksById)),
    REFERENCE_STRUCTURE_ENTRY_LIMIT
  );
  const boundedLayerEntries = boundedEntries(
    Object.values(layers).map((layer) => referenceLayerSummaryEntry(layer, layerObjectCounts)),
    REFERENCE_STRUCTURE_ENTRY_LIMIT
  );
  return {
    objectCount,
    layerCount,
    chunkCount,
    objectKinds: objectKindCounts,
    objectKindCounts,
    referenceObjectCount: objectCount,
    referenceLayerCount: layerCount,
    referenceChunkCount: chunkCount,
    referenceObjectKindCounts: objectKindCounts,
    referenceObjectIds: boundedObjectIds.entries,
    referenceObjectIdOmittedCount: boundedObjectIds.omittedCount,
    referenceLayerIds: boundedLayerIds.entries,
    referenceLayerIdOmittedCount: boundedLayerIds.omittedCount,
    referenceChunkIds: boundedChunkIds.entries,
    referenceChunkIdOmittedCount: boundedChunkIds.omittedCount,
    referenceObjectEntries: boundedObjectEntries.entries,
    referenceObjectEntryOmittedCount: boundedObjectEntries.omittedCount,
    referenceLayerEntries: boundedLayerEntries.entries,
    referenceLayerEntryOmittedCount: boundedLayerEntries.omittedCount
  };
}

function adapterSourceFileMetadata(inputPath) {
  return sourceFileMetadata(inputPath, "adapter input");
}

function withSourceFileMetadata(source, options = {}) {
  const next = { ...source };
  if (typeof options.sourceFileExtension === "string") {
    next.fileExtension = options.sourceFileExtension;
  } else if (typeof next.fileName === "string" && !Object.hasOwn(next, "fileExtension")) {
    next.fileExtension = path.extname(next.fileName).replace(/^\./, "").toLowerCase();
  }
  if (typeof options.requestedFormat === "string" && options.requestedFormat) {
    next.requestedFormat = formatToken(options.requestedFormat);
  }
  if (Number.isInteger(options.sourceFileSizeBytes) && options.sourceFileSizeBytes >= 0) {
    next.fileSizeBytes = options.sourceFileSizeBytes;
  }
  if (typeof options.sourceFileModifiedTime === "string" && options.sourceFileModifiedTime) {
    next.modifiedTime = options.sourceFileModifiedTime;
  }
  if (typeof options.sourceStatFingerprint === "string" && options.sourceStatFingerprint) {
    next.statFingerprint = options.sourceStatFingerprint;
  } else if (
    typeof next.fileName === "string"
    && Number.isInteger(next.fileSizeBytes)
    && typeof next.modifiedTime === "string"
    && next.modifiedTime
  ) {
    next.statFingerprint = sourceStatFingerprint({
      sourceFileName: next.fileName,
      sourceFileSizeBytes: next.fileSizeBytes,
      sourceFileModifiedTime: next.modifiedTime
    });
  }
  return next;
}

function adapterRequestPayload({ inputPath, outputPath, requestPath, format, requestedFormat = null, outputMode = "file", adapterKey = null, adapterRunId = createAdapterRunId(), adapterConfigPath = null, name, units, assetId, pointCloudChunkSize, timeoutMs = DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS }) {
  const sourceFile = adapterSourceFileMetadata(inputPath);
  const outputDir = path.dirname(outputPath);
  const stageDir = outputDir;
  const scratchDir = path.join(outputDir, "scratch");
  const outputFileName = path.basename(outputPath);
  const outputFileStem = path.basename(outputPath, path.extname(outputPath));
  const adapterLogPath = path.join(outputDir, "reference-adapter.log");
  const adapterStdoutPath = path.join(outputDir, "reference-adapter.stdout.log");
  const adapterStderrPath = path.join(outputDir, "reference-adapter.stderr.log");
  const requested = requestedFormatToken(requestedFormat, inputPath);
  const absoluteAdapterConfigPath = adapterConfigPath ? path.resolve(adapterConfigPath) : null;
  const request = {
    $schema: adapterRequestSchemaRefForRequest(requestPath),
    schema: ADAPTER_REQUEST_SCHEMA_NAME,
    schemaVersion: ADAPTER_REQUEST_SCHEMA_VERSION,
    adapterRunId,
    input: inputPath,
    sourceDirectory: sourceFile.sourceDirectory,
    sourceFileName: sourceFile.sourceFileName,
    sourceFileStem: sourceFile.sourceFileStem,
    sourceFileExtension: sourceFile.sourceFileExtension,
    sourceFileSizeBytes: sourceFile.sourceFileSizeBytes,
    sourceFileModifiedTime: sourceFile.sourceFileModifiedTime,
    sourceStatFingerprint: sourceFile.sourceStatFingerprint,
    output: outputPath,
    outputDir,
    stageDir,
    request: requestPath,
    scratchDir,
    outputFileName,
    outputFileStem,
    chunkDir: path.join(outputDir, "chunks"),
    chunkPathPrefix: DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX,
    adapterLogPath,
    adapterStdoutPath,
    adapterStderrPath,
    outputMode: outputMode === "stdout" ? "stdout" : "file",
    format,
    requestedFormat: requested,
    assetId,
    name: name || path.basename(inputPath),
    units,
    pointCloudChunkSize,
    timeoutMs,
    schemaVersions: {
      adapterRequest: ADAPTER_REQUEST_SCHEMA_VERSION,
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA_VERSION,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA_VERSION
    },
    schemas: {
      adapterRequest: ADAPTER_REQUEST_SCHEMA,
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA
    }
  };
  if (adapterKey) request.adapterKey = adapterKey;
  if (absoluteAdapterConfigPath) {
    const adapterConfigMetadata = adapterConfigFileMetadata(absoluteAdapterConfigPath);
    request.adapterConfigPath = absoluteAdapterConfigPath;
    request.adapterConfigDir = path.dirname(absoluteAdapterConfigPath);
    request.adapterConfigFileSizeBytes = adapterConfigMetadata.adapterConfigFileSizeBytes;
    request.adapterConfigFileModifiedTime = adapterConfigMetadata.adapterConfigFileModifiedTime;
    request.adapterConfigStatFingerprint = adapterConfigMetadata.adapterConfigStatFingerprint;
    if (adapterKey) {
      const adapterRegistry = describeReferenceGeometryAdapters(absoluteAdapterConfigPath);
      request.adapterRegistryFingerprint = adapterRegistry.adapterRegistryFingerprint;
      const adapterRegistryAdapterFingerprint = adapterRegistry.adapters?.[adapterKey]?.adapterRegistryFingerprint || null;
      if (adapterRegistryAdapterFingerprint) request.adapterRegistryAdapterFingerprint = adapterRegistryAdapterFingerprint;
    }
  }
  request.adapterRequestEvidenceFingerprint = adapterRequestEvidenceFingerprint(request);
  request.adapterRequestFingerprint = adapterRequestFingerprint(request);
  return request;
}

export function writeReferenceGeometryAdapterRequest({
  inputPath,
  outputPath,
  requestPath,
  format = null,
  name = null,
  units = DEFAULT_REFERENCE_UNITS,
  assetId = null,
  pointCloudChunkSize = DEFAULT_POINT_CLOUD_CHUNK_SIZE,
  adapterTimeoutMs = null,
  adapterKey = null,
  adapterConfigPath = null
}) {
  if (!inputPath) throw new Error("Missing inputPath");
  if (!outputPath) throw new Error("Missing outputPath");
  if (!requestPath) throw new Error("Missing requestPath");
  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);
  const absoluteRequest = path.resolve(requestPath);
  const stageDir = path.dirname(absoluteOutput);
  if (!isSubpath(stageDir, path.dirname(absoluteRequest))) {
    throw adapterConfigurationError(`--write-adapter-request path must resolve inside the planned adapter stage directory: ${stageDir}`, {
      code: "adapter-request-path-invalid",
      adapterRequestPath: absoluteRequest,
      adapterOutputPath: absoluteOutput,
      stageDir
    });
  }
  const requestedFormat = requestedFormatToken(format, absoluteInput);
  const sourceFormat = normalizeFormat(format || formatFromPath(absoluteInput));
  const adapterConfig = adapterConfigPath ? loadAdapterConfig(adapterConfigPath) : null;
  if (!FORMAT_REGISTRY[sourceFormat]) throw unsupportedReferenceFormatError(sourceFormat);
  if (!isAdapterCapableFormat(sourceFormat)) {
    throw new Error(`Reference adapter request generation is only supported for adapter-capable source formats; got ${sourceFormat}`);
  }
  if (adapterKey && !adapterConfig) {
    throw adapterConfigurationError(`--adapter requires --adapter-config when generating a reference adapter request for ${sourceFormat}`, {
      adapter: adapterKey,
      code: "adapter-config-missing"
    });
  }
  const selectedAdapter = adapterConfig
    ? selectExternalAdapter(adapterConfig, sourceFormat, adapterKey)
    : null;
  const selectedAdapterKey = selectedAdapter?.key || adapterKey;
  const selectedOutputMode = selectedAdapter?.adapter?.outputMode === "stdout" ? "stdout" : "file";
  const adapterTimeoutOverride = normalizedAdapterTimeoutOverride(adapterTimeoutMs);
  const effectivePointCloudChunkSize = normalizedPointCloudChunkSize(pointCloudChunkSize) ?? DEFAULT_POINT_CLOUD_CHUNK_SIZE;
  const effectiveUnits = normalizedExplicitReferenceUnits(units) || DEFAULT_REFERENCE_UNITS;
  const effectiveName = normalizedExplicitReferenceName(name);
  const requestedAssetId = assetIdForInput(absoluteInput, assetId, "reference_geometry");
  const data = adapterRequestPayload({
    inputPath: absoluteInput,
    outputPath: absoluteOutput,
    requestPath: absoluteRequest,
    format: sourceFormat,
    requestedFormat,
    outputMode: selectedOutputMode,
    adapterKey: selectedAdapterKey,
    adapterConfigPath: adapterConfig?.path || null,
    name: effectiveName,
    units: effectiveUnits,
    assetId: requestedAssetId,
    pointCloudChunkSize: effectivePointCloudChunkSize,
    timeoutMs: adapterTimeoutOverride ?? DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS
  });
  const tempPath = tempJsonPath(absoluteRequest, "adapter-request");
  try {
    writeJson(tempPath, data);
    assertSchemaValid(tempPath);
    fs.mkdirSync(data.scratchDir, { recursive: true });
    fs.mkdirSync(data.chunkDir, { recursive: true });
    fs.renameSync(tempPath, absoluteRequest);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
  return data;
}

function selectedAdapterPreflightErrorMetadata(adapterConfigPath, format, adapterName) {
  const preflightSummary = checkReferenceGeometryAdapters(adapterConfigPath, { format, adapterName });
  return {
    adapterPreflightOk: preflightSummary.ok === true,
    adapterPreflightRequested: preflightSummary.requested || null,
    adapterPreflightSelectedAdapter: adapterName || Object.keys(preflightSummary.adapters || {})[0] || null,
    adapterPreflightAdapterKeys: Object.keys(preflightSummary.adapters || {}).sort(),
    adapterPreflightFingerprints: Object.fromEntries(Object.entries(preflightSummary.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapterSummary]) => [key, adapterSummary.adapterPreflightFingerprint || null])),
    adapterPreflightFingerprint: preflightSummary.adapterPreflightFingerprint || null,
    adapterPreflightDecision: isRecord(preflightSummary.adapterPreflightDecision) ? preflightSummary.adapterPreflightDecision : adapterPreflightDecision(preflightSummary),
    adapterPreflightDiagnostics: adapterPreflightDiagnostics(preflightSummary)
  };
}

function runExternalAdapter({ inputPath, outputPath, format, requestedFormat = null, name, units, assetId, adapterConfigPath, adapterName, adapterTimeoutMs, pointCloudChunkSize }) {
  const adapterRunId = createAdapterRunId();
  const sourceFile = adapterSourceFileMetadata(inputPath);
  const requestPath = path.join(path.dirname(outputPath), "reference-adapter-request.json");
  const outputDir = path.dirname(outputPath);
  const stageDir = outputDir;
  const scratchDir = path.join(outputDir, "scratch");
  const outputFileName = path.basename(outputPath);
  const outputFileStem = path.basename(outputPath, path.extname(outputPath));
  const chunkDir = path.join(outputDir, "chunks");
  const adapterLogPath = path.join(outputDir, "reference-adapter.log");
  const adapterStdoutPath = path.join(outputDir, "reference-adapter.stdout.log");
  const adapterStderrPath = path.join(outputDir, "reference-adapter.stderr.log");
  const sourceErrorMetadata = {
    ...sourceFile,
    sourceFormat: format,
    sourceRequestedFormat: requestedFormatToken(requestedFormat, inputPath),
    adapterRunId,
    scratchDir
  };
  if (!adapterConfigPath) {
    throw adapterConfigurationError(`Reference geometry format ${format} requires --adapter-config. External adapters are intentionally outside the app runtime.`, {
      adapter: adapterName || null,
      code: "adapter-config-missing",
      adapterOutputPath: outputPath,
      stageDir,
      scratchDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...sourceErrorMetadata
    });
  }

  const config = loadAdapterConfig(adapterConfigPath);
  const { key, adapter } = selectExternalAdapter(config, format, adapterName);
  const outputMode = adapter.outputMode === "stdout" ? "stdout" : "file";
  const effectivePointCloudChunkSize = normalizedPointCloudChunkSize(pointCloudChunkSize) ?? DEFAULT_POINT_CLOUD_CHUNK_SIZE;
  const effectiveUnits = normalizedExplicitReferenceUnits(units) || DEFAULT_REFERENCE_UNITS;
  const effectiveName = normalizedExplicitReferenceName(name);
  sourceErrorMetadata.adapterOutputMode = outputMode;
  if (!adapter.command) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} is missing command`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-command-missing",
      adapterOutputPath: outputPath,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }

  const adapterConfigMetadata = adapterConfigFileMetadata(config.path);
  const adapterRegistry = describeReferenceGeometryAdapters(config.path);
  const adapterRegistryAdapterFingerprint = adapterRegistry.adapters?.[key]?.adapterRegistryFingerprint || "";
  const adapterTimeoutOverride = normalizedAdapterTimeoutOverride(adapterTimeoutMs);
  const timeout = adapterTimeoutOverride
    ?? (Number.isFinite(adapter.timeoutMs)
      ? adapter.timeoutMs
      : DEFAULT_EXTERNAL_ADAPTER_TIMEOUT_MS);
  const streamMaxBufferBytes = normalizedAdapterStreamMaxBufferBytes(adapter.streamMaxBufferBytes);
  const replacements = {
    input: inputPath,
    output: outputPath,
    outputDir,
    stageDir,
    scratchDir,
    outputFileName,
    outputFileStem,
    chunkDir,
    chunkPathPrefix: DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX,
    adapterLogPath,
    adapterStdoutPath,
    adapterStderrPath,
    outputMode,
    request: requestPath,
    format,
    requestedFormat: requestedFormatToken(requestedFormat, inputPath),
    adapterKey: key,
    adapterRunId,
    adapterConfigPath: config.path,
    adapterConfigDir: path.dirname(config.path),
    adapterConfigFileSizeBytes: String(adapterConfigMetadata.adapterConfigFileSizeBytes),
    adapterConfigFileModifiedTime: adapterConfigMetadata.adapterConfigFileModifiedTime,
    adapterConfigStatFingerprint: adapterConfigMetadata.adapterConfigStatFingerprint,
    adapterRegistryFingerprint: adapterRegistry.adapterRegistryFingerprint,
    adapterRegistryAdapterFingerprint,
    sourceDirectory: sourceFile.sourceDirectory,
    sourceFileName: sourceFile.sourceFileName,
    sourceFileStem: sourceFile.sourceFileStem,
    sourceFileExtension: sourceFile.sourceFileExtension,
    sourceFileSizeBytes: String(sourceFile.sourceFileSizeBytes),
    sourceFileModifiedTime: sourceFile.sourceFileModifiedTime,
    sourceStatFingerprint: sourceFile.sourceStatFingerprint,
    pointCloudChunkSize: String(effectivePointCloudChunkSize),
    timeoutMs: String(timeout),
    adapterRequestSchemaPath: ADAPTER_REQUEST_SCHEMA,
    referenceGeometrySchemaPath: REFERENCE_GEOMETRY_SCHEMA,
    pointCloudChunkSchemaPath: POINT_CLOUD_CHUNK_SCHEMA,
    referenceGeometrySchemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    pointCloudChunkSchemaVersion: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
    adapterRequestSchemaVersion: ADAPTER_REQUEST_SCHEMA_VERSION,
    name: effectiveName || path.basename(inputPath),
    units: effectiveUnits,
    assetId
  };
  const cwd = adapterCwd(config, adapter, replacements);
  const env = adapterEnvironment(adapter, replacements);
  if (!directoryExists(cwd)) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} working directory does not exist: ${cwd}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-cwd-missing",
      adapterOutputPath: outputPath,
      adapterCwd: cwd,
      adapterCwdExists: false,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const command = adapterValue(adapter.command, replacements);
  const commandCheck = adapter.shell === true
    ? { checked: false, found: null, resolvedPath: null }
    : resolveAdapterCommand(command, cwd, env);
  if (adapter.shell !== true && !commandCheck.found) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} command could not be resolved without launching it: ${command}`, {
      adapter: key,
      adapterConfigPath: config.path,
      adapterOutputPath: outputPath,
      code: "adapter-command-missing",
      adapterCwd: cwd,
      adapterCwdExists: true,
      adapterCommand: command,
      adapterCommandFound: false,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const missingRequiredFiles = adapterRequiredFileChecks(adapter, replacements, cwd).filter((requiredFile) => !requiredFile.exists);
  if (missingRequiredFiles.length) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} missing required file(s): ${missingRequiredFiles.map((requiredFile) => requiredFile.resolvedPath).join("; ")}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-required-file-missing",
      adapterOutputPath: outputPath,
      adapterMissingRequiredFiles: missingRequiredFiles,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const missingRequiredDirectories = adapterRequiredDirectoryChecks(adapter, replacements, cwd).filter((requiredDirectory) => !requiredDirectory.exists);
  if (missingRequiredDirectories.length) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} missing required directory(s): ${missingRequiredDirectories.map((requiredDirectory) => requiredDirectory.resolvedPath).join("; ")}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-required-directory-missing",
      adapterOutputPath: outputPath,
      adapterMissingRequiredDirectories: missingRequiredDirectories,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const missingRequiredCommands = adapterRequiredCommandChecks(adapter, replacements, cwd, env).filter((requiredCommand) => !requiredCommand.found);
  if (missingRequiredCommands.length) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} missing required command(s): ${missingRequiredCommands.map((requiredCommand) => requiredCommand.command).join("; ")}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-required-command-missing",
      adapterOutputPath: outputPath,
      adapterMissingRequiredCommands: missingRequiredCommands,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const missingRequiredEnv = adapterRequiredEnvChecks(adapter, env).filter((entry) => !entry.exists);
  if (missingRequiredEnv.length) {
    throw adapterConfigurationError(`${config.path}: adapter ${key} missing required environment variable(s): ${missingRequiredEnv.map((entry) => entry.name).join("; ")}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: "adapter-required-env-missing",
      adapterOutputPath: outputPath,
      adapterMissingRequiredEnv: missingRequiredEnv,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  const externalToolArgumentTemplate = externalToolArgumentTemplateMetadata(adapter);
  const externalToolBlockingDiagnostics = adapterExternalToolBlockingDiagnostics(adapter, replacements, cwd, externalToolArgumentTemplate);
  if (externalToolBlockingDiagnostics.length) {
    const blockingCodes = uniqueValues(externalToolBlockingDiagnostics.map((diagnostic) => diagnostic.code).filter(Boolean));
    throw adapterConfigurationError(`${config.path}: adapter ${key} has invalid external tool configuration: ${blockingCodes.join("; ")}`, {
      adapter: key,
      adapterConfigPath: config.path,
      code: blockingCodes[0] || "adapter-config-invalid",
      adapterOutputPath: outputPath,
      adapterOutputMode: outputMode,
      adapterCwd: cwd,
      adapterCwdExists: true,
      adapterCommand: command,
      adapterCommandFound: adapter.shell === true ? null : commandCheck.found === true,
      adapterResolvedCommand: commandCheck.resolvedPath,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      ...selectedAdapterPreflightErrorMetadata(config.path, format, key),
      ...sourceErrorMetadata
    });
  }
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(chunkDir, { recursive: true });
  const requestPayload = adapterRequestPayload({
    inputPath,
    outputPath,
    requestPath,
    format,
    requestedFormat,
    outputMode,
    adapterKey: key,
    adapterRunId,
    adapterConfigPath: config.path,
    name: effectiveName,
    units: effectiveUnits,
    assetId,
    pointCloudChunkSize: effectivePointCloudChunkSize,
    timeoutMs: timeout
  });
  sourceErrorMetadata.adapterRequestFingerprint = requestPayload.adapterRequestFingerprint;
  sourceErrorMetadata.adapterRequestEvidenceFingerprint = requestPayload.adapterRequestEvidenceFingerprint;
  sourceErrorMetadata.adapterRegistryFingerprint = requestPayload.adapterRegistryFingerprint || null;
  sourceErrorMetadata.adapterRegistryAdapterFingerprint = requestPayload.adapterRegistryAdapterFingerprint || null;
  writeJsonAtomic(requestPath, requestPayload, "adapter-request", assertSchemaValid);
  const args = (adapter.args || []).map((arg) => adapterValue(arg, replacements));
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    shell: adapter.shell === true,
    timeout,
    maxBuffer: streamMaxBufferBytes,
    windowsHide: true
  });
  fs.writeFileSync(adapterStdoutPath, result.stdout || "", "utf8");
  fs.writeFileSync(adapterStderrPath, result.stderr || "", "utf8");

  if (result.error) {
    if (result.error.code === "ENOBUFS") {
      throw adapterProcessError(`External reference adapter ${key} exceeded the ${streamMaxBufferBytes} byte process stream buffer; use file output or raise adapter streamMaxBufferBytes in the local adapter config`, {
        adapter: key,
        adapterConfigPath: config.path,
        adapterRequestPath: requestPath,
        adapterOutputPath: outputPath,
        adapterCwd: cwd,
        adapterCwdExists: true,
        adapterCommand: command,
        adapterCommandFound: adapter.shell === true ? null : true,
        adapterResolvedCommand: commandCheck.resolvedPath,
        stageDir,
        adapterLogPath,
        adapterStdoutPath,
        adapterStderrPath,
        code: "adapter-stream-buffer-exceeded",
        startErrorCode: result.error.code || null,
        streamMaxBufferBytes,
        timeoutMs: timeout,
        stdout: result.stdout,
        stderr: result.stderr,
        ...sourceErrorMetadata
      });
    }
    if (result.error.code === "ETIMEDOUT") {
      throw adapterProcessError(`External reference adapter ${key} timed out after ${timeout}ms`, {
        adapter: key,
        adapterConfigPath: config.path,
        adapterRequestPath: requestPath,
        adapterOutputPath: outputPath,
        adapterCwd: cwd,
        adapterCwdExists: true,
        adapterCommand: command,
        adapterCommandFound: adapter.shell === true ? null : true,
        adapterResolvedCommand: commandCheck.resolvedPath,
        stageDir,
        adapterLogPath,
        adapterStdoutPath,
        adapterStderrPath,
        timedOut: true,
        timeoutMs: timeout,
        streamMaxBufferBytes,
        stdout: result.stdout,
        stderr: result.stderr,
        ...sourceErrorMetadata
      });
    }
    throw adapterProcessError(`External reference adapter ${key} failed to start: ${result.error.message}`, {
      adapter: key,
      adapterConfigPath: config.path,
      adapterRequestPath: requestPath,
      adapterOutputPath: outputPath,
      adapterCwd: cwd,
      adapterCwdExists: true,
      adapterCommand: command,
      adapterCommandFound: adapter.shell === true ? null : true,
      adapterResolvedCommand: commandCheck.resolvedPath,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      startErrorCode: result.error.code || null,
      streamMaxBufferBytes,
      stdout: result.stdout,
      stderr: result.stderr,
      ...sourceErrorMetadata
    });
  }
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw adapterProcessError(`External reference adapter ${key} failed with exit code ${result.status}${detail ? `:\n${detail}` : ""}`, {
      adapter: key,
      adapterConfigPath: config.path,
      adapterRequestPath: requestPath,
      adapterOutputPath: outputPath,
      adapterCwd: cwd,
      adapterCwdExists: true,
      adapterCommand: command,
      adapterCommandFound: adapter.shell === true ? null : true,
      adapterResolvedCommand: commandCheck.resolvedPath,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      exitCode: result.status,
      signal: result.signal,
      streamMaxBufferBytes,
      stdout: result.stdout,
      stderr: result.stderr,
      ...sourceErrorMetadata
    });
  }
  if (outputMode === "stdout") {
    if (!result.stdout?.trim()) {
      throw adapterConfigurationError(`External reference adapter ${key} did not write canonical JSON to stdout`, {
        adapter: key,
        adapterConfigPath: config.path,
        adapterRequestPath: requestPath,
        adapterOutputPath: outputPath,
        code: "adapter-output-missing",
        adapterCwd: cwd,
        adapterCwdExists: true,
        adapterCommand: command,
        adapterCommandFound: adapter.shell === true ? null : true,
        adapterResolvedCommand: commandCheck.resolvedPath,
        stageDir,
        adapterLogPath,
        adapterStdoutPath,
        adapterStderrPath,
        stdout: result.stdout,
        stderr: result.stderr,
        ...sourceErrorMetadata
      });
    }
    fs.writeFileSync(outputPath, result.stdout, "utf8");
  }
  if (!fs.existsSync(outputPath)) {
    throw adapterConfigurationError(`External reference adapter ${key} did not write output: ${outputPath}`, {
      adapter: key,
      adapterConfigPath: config.path,
      adapterRequestPath: requestPath,
      adapterOutputPath: outputPath,
      code: "adapter-output-missing",
      adapterCwd: cwd,
      adapterCwdExists: true,
      adapterCommand: command,
      adapterCommandFound: adapter.shell === true ? null : true,
      adapterResolvedCommand: commandCheck.resolvedPath,
      stageDir,
      adapterLogPath,
      adapterStdoutPath,
      adapterStderrPath,
      stdout: result.stdout,
      stderr: result.stderr,
      ...sourceErrorMetadata
    });
  }
  return {
    key,
    adapterRunId,
    adapterRequestFingerprint: requestPayload.adapterRequestFingerprint,
    adapterRequestEvidenceFingerprint: requestPayload.adapterRequestEvidenceFingerprint,
    requestPath,
    stageDir,
    scratchDir,
    adapterCwd: cwd,
    adapterCwdExists: true,
    adapterCommand: command,
    adapterCommandFound: adapter.shell === true ? null : true,
    adapterResolvedCommand: commandCheck.resolvedPath,
    adapterLogPath,
    adapterStdoutPath,
    adapterStderrPath,
    stdout: outputMode === "stdout" ? "" : result.stdout || "",
    stderr: result.stderr || "",
    ...sourceErrorMetadata
  };
}

function normalizeExternalReferenceGeometryMetadata(filePath, options) {
  const data = readJson(filePath);
  const effectiveName = normalizedExplicitReferenceName(options.name);
  if (!isRecord(data)) throw new Error(`${filePath}: external adapter output must be a JSON object`);
  data.$schema = schemaRefForOutput(filePath);
  if (!isRecord(data.asset)) data.asset = {};
  data.asset.id = sanitizeId(options.assetId || data.asset.id || path.basename(options.inputPath, path.extname(options.inputPath)));
  if (effectiveName) data.asset.name = effectiveName;
  if (!data.asset.name) data.asset.name = path.basename(options.inputPath);
  if (!isRecord(data.asset.source)) data.asset.source = {};
  const sourceFile = sourceFileMetadata(options.inputPath);
  data.asset.source.format = formatSourceValue(options.format);
  data.asset.source.fileName = path.basename(options.inputPath);
  data.asset.source.fileExtension = sourceFile.sourceFileExtension;
  data.asset.source.requestedFormat = requestedFormatToken(options.requestedFormat, options.inputPath);
  data.asset.source.fileSizeBytes = sourceFile.sourceFileSizeBytes;
  data.asset.source.modifiedTime = sourceFile.sourceFileModifiedTime;
  data.asset.source.statFingerprint = sourceFile.sourceStatFingerprint;
  delete data.asset.source.checksum;
  data.asset.source.translator = normalizedExternalSourceTranslator(data.asset.source.translator, options.adapterKey);
  data.asset.source.translatorVersion = normalizedExternalSourceTranslatorVersion(data.asset.source.translatorVersion);
  data.asset.source.adapterKey = options.adapterKey;
  if (!data.asset.units && options.units) data.asset.units = options.units;
  addExternalAdapterOutputDiagnostics(data, {
    adapterKey: options.adapterKey,
    stdout: options.adapterStdout,
    stderr: options.adapterStderr
  });
  redactAdapterRunIdFromReferenceValue(data, options.adapterRunId || null);
  normalizeReferenceDiagnostics(data);
  writeJsonAtomic(filePath, data, "external-normalize");
}

function formatSourceValue(format) {
  return format === "e57pointcloud" ? "e57" : normalizeFormat(format);
}

function createReferenceGeometryStage(outputPath, prefix = "bobercad-reference-stage-") {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    stageDir,
    outputPath: path.join(stageDir, path.basename(path.resolve(outputPath)))
  };
}

function safeDecodedSidecarSegment(segment) {
  if (!segment || /%(?:2f|5c)/i.test(segment)) return false;
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return decoded
    && decoded !== "."
    && decoded !== ".."
    && !decoded.includes("/")
    && !decoded.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(decoded);
}

function safeReferenceSidecarPathValue(relativePath) {
  return typeof relativePath === "string"
    && relativePath.length > 0
    && relativePath.trim() === relativePath
    && !path.isAbsolute(relativePath)
    && !relativePath.startsWith("//")
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(relativePath)
    && !/[\\?#]|[\u0000-\u001f\u007f]/.test(relativePath)
    && relativePath.split("/").every(safeDecodedSidecarSegment);
}

function safeManifestSidecarPath(manifestPath, relativePath, label) {
  if (!safeReferenceSidecarPathValue(relativePath)) {
    throw new Error(`${manifestPath}: ${label} path is unsafe`);
  }
  if (path.isAbsolute(relativePath)) throw new Error(`${manifestPath}: ${label} path must be relative`);
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const resolved = path.resolve(manifestDir, relativePath);
  if (!isSubpath(manifestDir, resolved)) {
    throw new Error(`${manifestPath}: ${label} path must stay under the manifest directory`);
  }
  return resolved;
}

function copyCanonicalReferenceChunks(inputPath, outputPath, data) {
  for (const chunk of data.chunks || []) {
    if (!chunk?.path) continue;
    const sourcePath = safeManifestSidecarPath(inputPath, chunk.path, `chunk ${chunk.id}`);
    const targetPath = safeManifestSidecarPath(outputPath, chunk.path, `chunk ${chunk.id}`);
    if (path.resolve(sourcePath) === path.resolve(targetPath)) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const chunkData = readJson(sourcePath);
    chunkData.$schema = chunkSchemaRefForOutput(targetPath);
    writeJsonAtomic(targetPath, chunkData, "chunk-promote", (tempPath) => {
      assertReferenceGeometryChunk(tempPath, chunk);
    });
  }
}

function rollbackPromotedReferenceChunks(promotedChunks, ownerError = null) {
  for (const promoted of [...promotedChunks].reverse()) {
    try {
      if (promoted.backupPath) {
        restoreBackupFile(promoted.backupPath, promoted.targetPath);
      } else {
        fs.rmSync(promoted.targetPath, { force: true });
      }
    } catch (error) {
      if (!ownerError) throw error;
      addRollbackRecovery(ownerError, {
        kind: promoted.backupPath ? "chunk-restore" : "chunk-cleanup",
        targetPath: promoted.targetPath,
        backupPath: promoted.backupPath,
        message: error.message || String(error)
      });
    }
  }
}

function backupReferenceManifest(targetPath) {
  const absoluteTarget = path.resolve(targetPath);
  if (!fs.existsSync(absoluteTarget)) return null;
  const stat = fs.statSync(absoluteTarget);
  if (!stat.isFile()) throw new Error(`${absoluteTarget}: reference manifest target exists but is not a file`);
  const backupPath = tempJsonPath(absoluteTarget, "reference-backup");
  fs.copyFileSync(absoluteTarget, backupPath);
  return backupPath;
}

function rollbackReferenceManifest(targetPath, backupPath, ownerError = null) {
  const absoluteTarget = path.resolve(targetPath);
  try {
    if (backupPath) {
      restoreBackupFile(backupPath, absoluteTarget);
    } else {
      fs.rmSync(absoluteTarget, { force: true });
    }
  } catch (error) {
    if (!ownerError) throw error;
    addRollbackRecovery(ownerError, {
      kind: backupPath ? "manifest-restore" : "manifest-cleanup",
      targetPath: absoluteTarget,
      backupPath,
      message: error.message || String(error)
    });
  }
}

function commitReferenceManifestBackup(backupPath) {
  if (backupPath) fs.rmSync(backupPath, { force: true });
}

function promoteCanonicalReferenceChunks(inputPath, outputPath, data) {
  const promotedChunks = [];
  try {
    for (const chunk of data.chunks || []) {
      if (!chunk?.path) continue;
      const sourcePath = safeManifestSidecarPath(inputPath, chunk.path, `chunk ${chunk.id}`);
      const targetPath = safeManifestSidecarPath(outputPath, chunk.path, `chunk ${chunk.id}`);
      if (path.resolve(sourcePath) === path.resolve(targetPath)) continue;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const backupPath = fs.existsSync(targetPath) ? tempJsonPath(targetPath, "chunk-backup") : null;
      if (backupPath) fs.copyFileSync(targetPath, backupPath);
      const chunkData = readJson(sourcePath);
      chunkData.$schema = chunkSchemaRefForOutput(targetPath);
      writeJsonAtomic(targetPath, chunkData, "chunk-promote", (tempPath) => {
        assertReferenceGeometryChunk(tempPath, chunk);
      });
      promotedChunks.push({ targetPath, backupPath });
    }
  } catch (error) {
    rollbackPromotedReferenceChunks(promotedChunks, error);
    throw error;
  }
  return {
    commit() {
      for (const promoted of promotedChunks) {
        if (promoted.backupPath) fs.rmSync(promoted.backupPath, { force: true });
      }
    },
    rollback(ownerError = null) {
      rollbackPromotedReferenceChunks(promotedChunks, ownerError);
    }
  };
}

export function normalizedPointCloudChunkSize(value) {
  if (value === null || value === undefined) return null;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) throw pointCloudChunkSizeOptionError();
  return size;
}

function uniqueChunkId(baseId, usedIds) {
  return uniqueSanitizedId(baseId, usedIds, "point_cloud_chunk");
}

function chunkInlinePointClouds(data, outputPath, pointCloudChunkSize) {
  const chunkSize = normalizedPointCloudChunkSize(pointCloudChunkSize);
  if (!chunkSize) return data;
  if (!Array.isArray(data.chunks)) data.chunks = [];
  if (!Array.isArray(data.diagnostics)) data.diagnostics = [];

  const usedChunkIds = new Set((data.chunks || []).map((chunk) => chunk?.id).filter(Boolean));
  for (const [objectId, object] of Object.entries(data.objects || {})) {
    if (object?.kind !== "point-cloud" || !Array.isArray(object.points)) continue;
    if (object.points.length <= chunkSize) continue;
    if (Array.isArray(object.chunkIds) && object.chunkIds.length) continue;

    const chunkIds = [];
    for (let offset = 0, index = 1; offset < object.points.length; offset += chunkSize, index += 1) {
      const points = object.points.slice(offset, offset + chunkSize);
      const pointAttributes = slicePointAttributes(object.pointAttributes, offset, offset + chunkSize);
      const chunkId = uniqueChunkId(`${objectId}_chunk_${String(index).padStart(4, "0")}`, usedChunkIds);
      const chunkPath = `${DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX}${chunkId}.json`;
      const targetPath = safeManifestSidecarPath(outputPath, chunkPath, `generated chunk ${chunkId}`);
      const chunkBounds = boundsFor(points);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const chunkData = {
        $schema: chunkSchemaRefForOutput(targetPath),
        schema: POINT_CLOUD_CHUNK_SCHEMA_NAME,
        schemaVersion: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
        id: chunkId,
        kind: "point-cloud",
        objectId,
        pointCount: points.length,
        bounds: chunkBounds,
        points,
        metadata: {
          generatedBy: "tools/reference-geometry/translate_reference_geometry.mjs",
          source: "inline-point-cloud"
        }
      };
      if (pointAttributes) chunkData.pointAttributes = pointAttributes;
      const manifestChunk = {
        id: chunkId,
        kind: "point-cloud",
        objectId,
        path: chunkPath,
        pointCount: points.length,
        bounds: chunkBounds
      };
      writeJsonAtomic(targetPath, chunkData, "inline-chunk", (tempPath) => {
        assertReferenceGeometryChunk(tempPath, manifestChunk);
      });
      data.chunks.push(manifestChunk);
      chunkIds.push(chunkId);
    }

    object.chunkIds = chunkIds;
    object.bounds = boundsFor(object.points);
    delete object.points;
    delete object.pointAttributes;
    addDiagnostic(
      data.diagnostics,
      "info",
      "reference-inline-point-cloud-chunked",
      `Split ${objectId} inline point-cloud data into ${chunkIds.length} chunk sidecar file(s).`,
      objectId
    );
  }
  return data;
}

function referenceGeometrySummary(data) {
  const source = isRecord(data.asset?.source) ? data.asset.source : {};
  const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
  return {
    assetId: data.asset?.id || null,
    assetName: data.asset?.name || null,
    sourceFormat: source.format || null,
    sourceFileName: source.fileName || null,
    sourceFileExtension: source.fileExtension || null,
    sourceRequestedFormat: source.requestedFormat || null,
    sourceFileSizeBytes: Number.isInteger(source.fileSizeBytes) ? source.fileSizeBytes : null,
    sourceFileModifiedTime: source.modifiedTime || null,
    sourceStatFingerprint: source.statFingerprint || null,
    sourceChecksum: source.checksum || null,
    sourceTranslator: source.translator || null,
    sourceTranslatorVersion: source.translatorVersion || null,
    sourceAdapter: source.adapterKey || null,
    units: data.asset?.units || null,
    ...referenceSchemaMetadata(data),
    ...referenceAssetMetadata(data),
    diagnosticCount: diagnostics.length,
    diagnosticSeverityCounts: Object.fromEntries(diagnostics.reduce((counts, diagnostic) => {
      const severity = diagnostic?.severity || "unknown";
      counts.set(severity, (counts.get(severity) || 0) + 1);
      return counts;
    }, new Map())),
    diagnosticCodeCounts: Object.fromEntries(diagnostics.reduce((counts, diagnostic) => {
      const code = diagnostic?.code || "unknown";
      counts.set(code, (counts.get(code) || 0) + 1);
      return counts;
    }, new Map())),
    ...referencePrimitiveCounts(data),
    referencePointCloudPointCount: referencePointCloudPointCount(data),
    ...referenceStructureSummary(data)
  };
}

export function describeValidatedReferenceGeometry(inputPath) {
  const absoluteInput = path.resolve(inputPath);
  const data = validateReferenceGeometryOutput(absoluteInput);
  return attachReferenceTranslationWorkflowStatus({
    ok: true,
    ...referenceTranslationExecutionMetadata("validate-only", {
      translationMode: "canonical-json"
    }),
    path: absoluteInput,
    ...referenceFileMetadata(absoluteInput),
    ...referenceChunkFileMetadata(absoluteInput, data),
    ...referenceGeometrySummary(data)
  }, "validate-only");
}

function describeTranslatedReferenceGeometry(outputPath, data, { adapterConfigPath = null } = {}) {
  const absoluteOutput = path.resolve(outputPath);
  const translationMode = referenceTranslationModeFromManifest(data, { adapterConfigPath });
  const summary = {
    ok: true,
    ...referenceTranslationExecutionMetadata("translate", { translationMode }),
    translationMode,
    path: absoluteOutput,
    outputPath: absoluteOutput,
    ...adapterConfigFileMetadata(adapterConfigPath),
    ...referenceFileMetadata(absoluteOutput),
    ...referenceChunkFileMetadata(absoluteOutput, data),
    ...referenceGeometrySummary(data)
  };
  if (data && typeof data === "object" && data.__adapterStageDir) {
    summary.stageDir = data.__adapterStageDir;
  }
  if (data && typeof data === "object" && isRecord(data.__adapterRunMetadata)) {
    Object.assign(summary, data.__adapterRunMetadata);
  }
  if (data && typeof data === "object" && isRecord(data.__adapterStageMetadata)) {
    Object.assign(summary, data.__adapterStageMetadata);
  }
  return attachReferenceTranslationWorkflowStatus(summary, "translate");
}

function wantsJsonOutput(argv) {
  return argv.includes("--json")
    || argv.includes("--list-formats")
    || argv.includes("--list-format-groups")
    || argv.includes("--list-translation-discovery")
    || argv.includes("--describe-source")
    || argv.includes("--list-adapters")
    || argv.includes("--check-adapters");
}

function describeCliError(error) {
  const result = {
    ok: false,
    referenceTranslationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    errors: [
      {
        message: error?.message || String(error)
      }
    ]
  };
  const primary = result.errors[0];
  if (isRecord(error?.referenceTranslationContext)) {
    Object.assign(result, error.referenceTranslationContext);
    if (error.referenceTranslationContext.referenceTranslationPlanFingerprint) {
      primary.referenceTranslationPlanFingerprint = error.referenceTranslationContext.referenceTranslationPlanFingerprint;
    }
  }
  if (error?.adapter) primary.adapter = error.adapter;
  if (error?.adapterErrorCode) primary.adapterErrorCode = error.adapterErrorCode;
  if (error?.referenceTranslationContractVersion) primary.referenceTranslationContractVersion = error.referenceTranslationContractVersion;
  if (error?.referenceTranslationExecutionMode) primary.referenceTranslationExecutionMode = error.referenceTranslationExecutionMode;
  if (isRecord(error?.referenceTranslationSideEffectPlan)) primary.referenceTranslationSideEffectPlan = error.referenceTranslationSideEffectPlan;
  if (error?.referenceTranslationPlanFingerprint) primary.referenceTranslationPlanFingerprint = error.referenceTranslationPlanFingerprint;
  if (error?.adapterOutputValidationMessage) primary.adapterOutputValidationMessage = error.adapterOutputValidationMessage;
  if (error?.adapterOutputValidationPath) primary.adapterOutputValidationPath = error.adapterOutputValidationPath;
  if (error?.adapterOutputValidationKind) primary.adapterOutputValidationKind = error.adapterOutputValidationKind;
  if (error?.adapterRequestFingerprint) primary.adapterRequestFingerprint = error.adapterRequestFingerprint;
  if (error?.adapterRequestEvidenceFingerprint) primary.adapterRequestEvidenceFingerprint = error.adapterRequestEvidenceFingerprint;
  if (error?.adapterRegistryFingerprint) primary.adapterRegistryFingerprint = error.adapterRegistryFingerprint;
  if (isRecord(error?.adapterRegistryFingerprints)) primary.adapterRegistryFingerprints = error.adapterRegistryFingerprints;
  if (error?.adapterRegistryAdapterFingerprint) primary.adapterRegistryAdapterFingerprint = error.adapterRegistryAdapterFingerprint;
  if (error?.adapterRunId) primary.adapterRunId = error.adapterRunId;
  if (error?.sourceFormat) primary.sourceFormat = error.sourceFormat;
  if (error?.sourceRequestedFormat) primary.sourceRequestedFormat = error.sourceRequestedFormat;
  if (error?.sourceDirectory) primary.sourceDirectory = error.sourceDirectory;
  if (error?.sourceFileName) primary.sourceFileName = error.sourceFileName;
  if (error?.sourceFileStem) primary.sourceFileStem = error.sourceFileStem;
  if (error?.sourceFileExtension) primary.sourceFileExtension = error.sourceFileExtension;
  if (Number.isInteger(error?.sourceFileSizeBytes)) primary.sourceFileSizeBytes = error.sourceFileSizeBytes;
  if (error?.sourceFileModifiedTime) primary.sourceFileModifiedTime = error.sourceFileModifiedTime;
  if (error?.sourceStatFingerprint) primary.sourceStatFingerprint = error.sourceStatFingerprint;
  if (error?.stageDir) primary.stageDir = error.stageDir;
  if (error?.scratchDir) primary.scratchDir = error.scratchDir;
  if (Number.isInteger(error?.adapterScratchFileCount)) primary.adapterScratchFileCount = error.adapterScratchFileCount;
  if (Number.isInteger(error?.adapterScratchFileSizeBytes)) primary.adapterScratchFileSizeBytes = error.adapterScratchFileSizeBytes;
  if (error?.adapterScratchFileModifiedTimeLatest) primary.adapterScratchFileModifiedTimeLatest = error.adapterScratchFileModifiedTimeLatest;
  if (Array.isArray(error?.adapterScratchFileEntries)) primary.adapterScratchFileEntries = error.adapterScratchFileEntries;
  if (Number.isInteger(error?.adapterScratchFileOmittedCount)) primary.adapterScratchFileOmittedCount = error.adapterScratchFileOmittedCount;
  if (error?.adapterLogPath) primary.adapterLogPath = error.adapterLogPath;
  if (error?.adapterStdoutPath) primary.adapterStdoutPath = error.adapterStdoutPath;
  if (error?.adapterStderrPath) primary.adapterStderrPath = error.adapterStderrPath;
  if (error?.adapterConfigPath) primary.adapterConfigPath = error.adapterConfigPath;
  if (Number.isInteger(error?.adapterConfigFileSizeBytes)) primary.adapterConfigFileSizeBytes = error.adapterConfigFileSizeBytes;
  if (error?.adapterConfigFileModifiedTime) primary.adapterConfigFileModifiedTime = error.adapterConfigFileModifiedTime;
  if (error?.adapterConfigStatFingerprint) primary.adapterConfigStatFingerprint = error.adapterConfigStatFingerprint;
  if (error?.adapterRequestPath) primary.adapterRequestPath = error.adapterRequestPath;
  if (error?.adapterCwd) primary.adapterCwd = error.adapterCwd;
  if (typeof error?.adapterCwdExists === "boolean") primary.adapterCwdExists = error.adapterCwdExists;
  if (error?.adapterCommand) primary.adapterCommand = error.adapterCommand;
  if (typeof error?.adapterCommandFound === "boolean") primary.adapterCommandFound = error.adapterCommandFound;
  if (error?.adapterResolvedCommand) primary.adapterResolvedCommand = error.adapterResolvedCommand;
  if (error?.adapterOutputMode) primary.adapterOutputMode = error.adapterOutputMode;
  if (typeof error?.adapterPreflightOk === "boolean") primary.adapterPreflightOk = error.adapterPreflightOk;
  if (error?.adapterPreflightRequested) primary.adapterPreflightRequested = error.adapterPreflightRequested;
  if (error?.adapterPreflightSelectedAdapter) primary.adapterPreflightSelectedAdapter = error.adapterPreflightSelectedAdapter;
  if (Array.isArray(error?.adapterPreflightAdapterKeys)) primary.adapterPreflightAdapterKeys = error.adapterPreflightAdapterKeys;
  if (isRecord(error?.adapterPreflightFingerprints)) primary.adapterPreflightFingerprints = error.adapterPreflightFingerprints;
  if (error?.adapterPreflightFingerprint) primary.adapterPreflightFingerprint = error.adapterPreflightFingerprint;
  if (isRecord(error?.adapterPreflightDecision)) primary.adapterPreflightDecision = error.adapterPreflightDecision;
  if (Array.isArray(error?.adapterPreflightDiagnostics)) primary.adapterPreflightDiagnostics = error.adapterPreflightDiagnostics;
  if (error?.adapterOutputPath) primary.adapterOutputPath = error.adapterOutputPath;
  if (Number.isInteger(error?.adapterExitCode)) primary.adapterExitCode = error.adapterExitCode;
  if (error?.adapterSignal) primary.adapterSignal = error.adapterSignal;
  if (error?.adapterTimedOut === true) primary.adapterTimedOut = true;
  if (Number.isFinite(error?.adapterTimeoutMs)) primary.adapterTimeoutMs = error.adapterTimeoutMs;
  if (Number.isInteger(error?.adapterStreamMaxBufferBytes)) primary.adapterStreamMaxBufferBytes = error.adapterStreamMaxBufferBytes;
  if (error?.adapterStartErrorCode) primary.adapterStartErrorCode = error.adapterStartErrorCode;
  if (error?.adapterStdout) primary.adapterStdout = error.adapterStdout;
  if (error?.adapterStderr) primary.adapterStderr = error.adapterStderr;
  if (Array.isArray(error?.adapterMissingRequiredFiles) && error.adapterMissingRequiredFiles.length) {
    primary.adapterMissingRequiredFiles = error.adapterMissingRequiredFiles;
  }
  if (Array.isArray(error?.adapterMissingRequiredDirectories) && error.adapterMissingRequiredDirectories.length) {
    primary.adapterMissingRequiredDirectories = error.adapterMissingRequiredDirectories;
  }
  if (Array.isArray(error?.adapterMissingRequiredCommands) && error.adapterMissingRequiredCommands.length) {
    primary.adapterMissingRequiredCommands = error.adapterMissingRequiredCommands;
  }
  if (Array.isArray(error?.adapterMissingRequiredEnv) && error.adapterMissingRequiredEnv.length) {
    primary.adapterMissingRequiredEnv = error.adapterMissingRequiredEnv;
  }
  if (Array.isArray(error?.rollbackRecovery) && error.rollbackRecovery.length) {
    primary.rollbackRecovery = error.rollbackRecovery;
  }
  if (error?.keepStageDir) result.stageDir = error.keepStageDir;
  if (error?.keepScratchDir) result.scratchDir = error.keepScratchDir;
  if (error?.keepScratchDir) Object.assign(result, adapterScratchFileMetadata(error.keepScratchDir));
  if (!isRecord(result.referenceTranslationWorkflowStatus)) {
    const failedStage = referenceTranslationWorkflowStageForSummary(result);
    if (failedStage) attachReferenceTranslationWorkflowStatus(result, failedStage, { stageComplete: false });
  }
  return result;
}

function flagEnabled(value) {
  return value === true || value === "true" || value === "1";
}

function stagePreservationOptionNamesFromArgs(args) {
  const optionNames = [];
  if (flagEnabled(args.keepStage)) optionNames.push("--keep-stage");
  if (flagEnabled(args.keepStageOnError)) optionNames.push("--keep-stage-on-error");
  return optionNames;
}

function promoteReferenceGeometryOutput(stageOutput, outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  const data = validateReferenceGeometryOutput(stageOutput);
  const nextData = JSON.parse(JSON.stringify(data));
  nextData.$schema = schemaRefForOutput(absoluteOutput);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  const manifestBackupPath = backupReferenceManifest(absoluteOutput);
  let promotedChunks = null;
  try {
    promotedChunks = promoteCanonicalReferenceChunks(stageOutput, absoluteOutput, nextData);
    writeJsonAtomic(absoluteOutput, nextData, "reference-promote", validateReferenceGeometryOutput);
    validateReferenceGeometryOutput(absoluteOutput);
    promotedChunks.commit();
    commitReferenceManifestBackup(manifestBackupPath);
    return nextData;
  } catch (error) {
    if (promotedChunks) promotedChunks.rollback(error);
    rollbackReferenceManifest(absoluteOutput, manifestBackupPath, error);
    throw error;
  }
}

function writeReferenceGeometryOutput(outputPath, data, { pointCloudChunkSize = DEFAULT_POINT_CLOUD_CHUNK_SIZE, sourceManifestPath = null } = {}) {
  const absoluteOutput = path.resolve(outputPath);
  const stage = createReferenceGeometryStage(absoluteOutput, "bobercad-reference-output-");
  try {
    const stageData = JSON.parse(JSON.stringify(data));
    stageData.$schema = schemaRefForOutput(stage.outputPath);
    if (sourceManifestPath) copyCanonicalReferenceChunks(sourceManifestPath, stage.outputPath, stageData);
    chunkInlinePointClouds(stageData, stage.outputPath, pointCloudChunkSize);
    writeJson(stage.outputPath, stageData);
    validateReferenceGeometryOutput(stage.outputPath);
    return promoteReferenceGeometryOutput(stage.outputPath, absoluteOutput);
  } finally {
    fs.rmSync(stage.stageDir, { recursive: true, force: true });
  }
}

function copyCanonicalReferenceGeometryFile({ inputPath, outputPath, name = null, units = DEFAULT_REFERENCE_UNITS, assetId = null, pointCloudChunkSize = DEFAULT_POINT_CLOUD_CHUNK_SIZE }) {
  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);
  const explicitAssetId = normalizedExplicitReferenceAssetId(assetId);
  const explicitName = normalizedExplicitReferenceName(name);
  const data = validateReferenceGeometryOutput(absoluteInput, {
    allowChunkableInlinePointCloudBounds: true,
    pointCloudChunkSize
  });
  const nextData = JSON.parse(JSON.stringify(data));
  nextData.$schema = schemaRefForOutput(absoluteOutput);
  if (!isRecord(nextData.asset)) throw new Error(`${absoluteInput}: canonical reference asset is missing`);
  nextData.asset.id = explicitAssetId || sanitizeId(nextData.asset.id || path.basename(absoluteInput, path.extname(absoluteInput)));
  if (explicitName) nextData.asset.name = explicitName;
  if (!nextData.asset.units && units) nextData.asset.units = units;
  return writeReferenceGeometryOutput(absoluteOutput, nextData, { pointCloudChunkSize, sourceManifestPath: absoluteInput });
}

function translateReferenceGeometryWithExternalAdapter({
  inputPath,
  outputPath,
  format,
  requestedFormat = null,
  name = null,
  units = DEFAULT_REFERENCE_UNITS,
  assetId = null,
  adapterConfigPath = null,
  adapterName = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = DEFAULT_POINT_CLOUD_CHUNK_SIZE,
  keepStage = false,
  keepStageOnError = false
}) {
  const stage = createReferenceGeometryStage(outputPath, "bobercad-reference-adapter-");
  const requestedAssetId = assetIdForInput(inputPath, assetId, "reference_geometry");
  const shouldKeepStage = flagEnabled(keepStage);
  const shouldKeepStageOnError = flagEnabled(keepStageOnError);
  let removeStage = true;
  let adapterResult = null;
  try {
    adapterResult = runExternalAdapter({
      inputPath,
      outputPath: stage.outputPath,
      format,
      requestedFormat,
      name,
      units,
      assetId: requestedAssetId,
      adapterConfigPath,
      adapterName,
      adapterTimeoutMs,
      pointCloudChunkSize
    });
    normalizeExternalReferenceGeometryMetadata(stage.outputPath, {
      inputPath,
      format,
      requestedFormat,
      name,
      units,
      assetId: requestedAssetId,
      adapterKey: adapterResult.key,
      adapterRunId: adapterResult.adapterRunId,
      adapterStdout: adapterResult.stdout,
      adapterStderr: adapterResult.stderr
    });
    const promoted = copyCanonicalReferenceGeometryFile({
      inputPath: stage.outputPath,
      outputPath,
      name,
      units,
      assetId: requestedAssetId,
      pointCloudChunkSize
    });
    const adapterRunMetadata = {
      adapterRunId: adapterResult.adapterRunId,
      adapterRequestFingerprint: adapterResult.adapterRequestFingerprint,
      adapterRequestEvidenceFingerprint: adapterResult.adapterRequestEvidenceFingerprint,
      adapterRegistryFingerprint: adapterResult.adapterRegistryFingerprint || null,
      adapterRegistryAdapterFingerprint: adapterResult.adapterRegistryAdapterFingerprint || null,
      adapterOutputMode: adapterResult.adapterOutputMode,
      adapterCwd: adapterResult.adapterCwd,
      adapterCwdExists: adapterResult.adapterCwdExists,
      adapterCommand: adapterResult.adapterCommand
    };
    if (typeof adapterResult.adapterCommandFound === "boolean") {
      adapterRunMetadata.adapterCommandFound = adapterResult.adapterCommandFound;
    }
    if (adapterResult.adapterResolvedCommand) {
      adapterRunMetadata.adapterResolvedCommand = adapterResult.adapterResolvedCommand;
    }
    Object.defineProperty(promoted, "__adapterRunMetadata", {
      value: adapterRunMetadata,
      enumerable: false
    });
    if (shouldKeepStage) {
      removeStage = false;
      const stageMetadata = {
        stageDir: stage.stageDir,
        scratchDir: adapterResult.scratchDir,
        ...adapterScratchFileMetadata(adapterResult.scratchDir),
        adapterRequestPath: adapterResult.requestPath,
        adapterOutputPath: stage.outputPath,
        adapterLogPath: adapterResult.adapterLogPath,
        adapterStdoutPath: adapterResult.adapterStdoutPath,
        adapterStderrPath: adapterResult.adapterStderrPath
      };
      Object.defineProperty(promoted, "__adapterStageMetadata", {
        value: stageMetadata,
        enumerable: false
      });
    }
    return promoted;
  } catch (error) {
    const outputError = adapterResult
      ? annotateExternalAdapterOutputError(error, {
        adapter: adapterResult.key,
        adapterRunId: adapterResult.adapterRunId,
        adapterRequestFingerprint: adapterResult.adapterRequestFingerprint,
        adapterRequestEvidenceFingerprint: adapterResult.adapterRequestEvidenceFingerprint,
        adapterRegistryFingerprint: adapterResult.adapterRegistryFingerprint || null,
        adapterRegistryAdapterFingerprint: adapterResult.adapterRegistryAdapterFingerprint || null,
        adapterConfigPath,
        adapterRequestPath: adapterResult.requestPath,
        adapterOutputPath: stage.outputPath,
        stageDir: adapterResult.stageDir,
        scratchDir: adapterResult.scratchDir,
        adapterLogPath: adapterResult.adapterLogPath,
        adapterStdoutPath: adapterResult.adapterStdoutPath,
        adapterStderrPath: adapterResult.adapterStderrPath,
        adapterStdout: adapterResult.stdout,
        adapterStderr: adapterResult.stderr,
        sourceDirectory: adapterResult.sourceDirectory,
        sourceFileName: adapterResult.sourceFileName,
        sourceFileStem: adapterResult.sourceFileStem,
        sourceFileExtension: adapterResult.sourceFileExtension,
        sourceFileSizeBytes: adapterResult.sourceFileSizeBytes,
        sourceFileModifiedTime: adapterResult.sourceFileModifiedTime,
        sourceStatFingerprint: adapterResult.sourceStatFingerprint,
        sourceFormat: adapterResult.sourceFormat,
        sourceRequestedFormat: adapterResult.sourceRequestedFormat
      })
      : error;
    if (shouldKeepStage || shouldKeepStageOnError) {
      removeStage = false;
      outputError.keepStageDir = stage.stageDir;
      outputError.keepScratchDir = path.join(stage.stageDir, "scratch");
      fs.mkdirSync(outputError.keepScratchDir, { recursive: true });
      outputError.stageDir = stage.stageDir;
      outputError.scratchDir = outputError.keepScratchDir;
      Object.assign(outputError, adapterScratchFileMetadata(outputError.keepScratchDir));
      outputError.message = `${outputError.message || outputError}\nExternal adapter stage kept at: ${stage.stageDir}`;
    }
    throw outputError;
  } finally {
    if (removeStage) fs.rmSync(stage.stageDir, { recursive: true, force: true });
  }
}

function stepStatements(text) {
  const statements = [];
  let buffer = "";
  let inString = false;
  let inBlockComment = false;
  let collecting = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inBlockComment) {
      if (char === "*" && text[index + 1] === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inString && char === "/" && text[index + 1] === "*") {
      inBlockComment = true;
      if (collecting && buffer && !/\s$/.test(buffer)) buffer += " ";
      index += 1;
      continue;
    }
    if (!collecting) {
      if (char === "'") {
        if (text[index + 1] === "'") index += 1;
        else inString = !inString;
      } else if (!inString && char === "#" && /\d/.test(text[index + 1] || "")) {
        collecting = true;
        buffer = "#";
        inString = false;
      }
      continue;
    }
    buffer += char;
    if (char === "'") {
      if (text[index + 1] === "'") {
        buffer += text[index + 1];
        index += 1;
      } else {
        inString = !inString;
      }
    }
    if (!inString && char === ";") {
      statements.push(buffer.slice(0, -1).trim());
      collecting = false;
      buffer = "";
    }
  }
  if (inBlockComment) throw new Error("Part 21 input contains an unterminated block comment.");
  return statements;
}

function parseStepEntityComponents(raw) {
  const components = [];
  let index = 0;
  while (index < raw.length) {
    while (/\s/.test(raw[index] || "")) index += 1;
    const typeMatch = raw.slice(index).match(/^([A-Z0-9_]+)\s*\(/i);
    if (!typeMatch) break;
    const type = typeMatch[1].toUpperCase();
    index += typeMatch[0].length;
    const start = index;
    let depth = 1;
    let inString = false;
    while (index < raw.length && depth > 0) {
      const char = raw[index];
      if (char === "'") {
        if (raw[index + 1] === "'") index += 1;
        else inString = !inString;
      } else if (!inString && char === "(") {
        depth += 1;
      } else if (!inString && char === ")") {
        depth -= 1;
      }
      index += 1;
    }
    components.push({ type, args: raw.slice(start, index - 1).trim() });
  }
  return components;
}

function stepComplexBSplineEntity(id, raw) {
  const componentMap = new Map(parseStepEntityComponents(raw).map((component) => [component.type, component.args]));
  const baseArgsRaw = componentMap.get("B_SPLINE_CURVE");
  const knotArgsRaw = componentMap.get("B_SPLINE_CURVE_WITH_KNOTS");
  if (!baseArgsRaw || !knotArgsRaw) return null;
  const baseArgs = splitStepArguments(baseArgsRaw);
  const knotArgs = splitStepArguments(knotArgsRaw);
  const rationalArgsRaw = componentMap.get("RATIONAL_B_SPLINE_CURVE");
  const rationalArgs = rationalArgsRaw ? splitStepArguments(rationalArgsRaw) : [];
  const args = [
    "''",
    baseArgs[0] || "",
    baseArgs[1] || "",
    baseArgs[2] || "",
    baseArgs[3] || "",
    baseArgs[4] || "",
    knotArgs[0] || "",
    knotArgs[1] || "",
    knotArgs[2] || "",
    rationalArgs[0] || ""
  ];
  return {
    id,
    type: rationalArgsRaw ? "RATIONAL_B_SPLINE_CURVE_WITH_KNOTS" : "B_SPLINE_CURVE_WITH_KNOTS",
    args: args.join(", ")
  };
}

function parseStepEntities(text) {
  const entities = new Map();
  for (const statement of stepStatements(text)) {
    const match = statement.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)$/i);
    if (!match) {
      const complexMatch = statement.match(/^#(\d+)\s*=\s*\(([\s\S]*)\)$/i);
      const complexEntity = complexMatch ? stepComplexBSplineEntity(complexMatch[1], complexMatch[2]) : null;
      if (complexEntity) entities.set(complexEntity.id, complexEntity);
      continue;
    }
    entities.set(match[1], {
      id: match[1],
      type: match[2].toUpperCase(),
      args: match[3].trim()
    });
  }
  return entities;
}

function assertStepEntitySource(entities, sourceLabel, adapterLabel) {
  if (entities.size) return;
  throw new Error(`${sourceLabel} input does not contain Part 21 entity records (#id = TYPE(...)); use an external ${adapterLabel} adapter or verify the source file.`);
}

function splitStepArguments(raw) {
  const args = [];
  let start = 0;
  let depth = 0;
  let inString = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "'") {
      if (raw[index + 1] === "'") index += 1;
      else inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      args.push(raw.slice(start, index).trim());
      start = index + 1;
    }
  }
  args.push(raw.slice(start).trim());
  return args;
}

function stepRefs(raw) {
  const refs = [];
  const text = String(raw || "");
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'") {
      if (text[index + 1] === "'") index += 1;
      else inString = !inString;
      continue;
    }
    if (inString || char !== "#" || !/\d/.test(text[index + 1] || "")) continue;
    let end = index + 1;
    while (/\d/.test(text[end] || "")) end += 1;
    refs.push(text.slice(index + 1, end));
    index = end - 1;
  }
  return refs;
}

const STEP_NUMBER_PATTERN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?/g;

function parseStepNumber(raw, fallback = NaN) {
  const value = Number(String(raw ?? "").trim().replace(/[dD]/g, "E"));
  return Number.isFinite(value) ? value : fallback;
}

function stepArgNumber(raw, fallback = null) {
  return parseStepNumber(raw, fallback);
}

function isStepMissingArgument(raw) {
  const text = String(raw ?? "").trim();
  return !text || text === "$" || text === "*";
}

function stepOptionalNumberArgument(raw, label) {
  if (isStepMissingArgument(raw)) return { value: NaN, invalid: false, label };
  const value = stepArgNumber(raw, NaN);
  return { value, invalid: !Number.isFinite(value), label };
}

function stepRequiredPositiveNumberArgument(raw, label) {
  const value = stepArgNumber(raw, NaN);
  return { value, invalid: isStepMissingArgument(raw) || !Number.isFinite(value) || value <= 1e-9, label };
}

function stepOptionalNonNegativeNumberArgument(raw, label) {
  if (isStepMissingArgument(raw)) return { value: NaN, invalid: false, label };
  const value = stepArgNumber(raw, NaN);
  return { value, invalid: !Number.isFinite(value) || value < 0, label };
}

function stepNumberList(raw) {
  return [...String(raw || "").matchAll(STEP_NUMBER_PATTERN)]
    .map((match) => parseStepNumber(match[0], NaN))
    .filter((value) => Number.isFinite(value));
}

function stepNumberTuples(raw) {
  const tuples = [];
  const pattern = /\(([^()#']*)\)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    const values = match[1]
      .split(",")
      .map((item) => parseStepNumber(item, NaN))
      .filter((value) => Number.isFinite(value));
    if (values.length >= 2) tuples.push(values);
  }
  return tuples;
}

function stepNumberTuplesDetailed(raw, minLength = 2) {
  const tuples = [];
  let invalidTupleCount = 0;
  const pattern = /\(([^()#']*)\)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    const items = match[1].split(",").map((item) => item.trim());
    const values = items.map((item) => parseStepNumber(item, NaN));
    if (items.length < minLength || values.some((value) => !Number.isFinite(value))) {
      invalidTupleCount += 1;
      continue;
    }
    tuples.push(values);
  }
  return { tuples, invalidTupleCount };
}

function stepIntegerTuples(raw) {
  return stepIntegerTuplesAtLeast(raw, 3);
}

function stepIntegerTuplesAtLeast(raw, minLength) {
  const tuples = [];
  const pattern = /\(([^()#A-Za-z'.]*)\)/g;
  let match;
  while ((match = pattern.exec(raw))) {
    const values = match[1]
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isInteger(value));
    if (values.length >= minLength) tuples.push(values);
  }
  return tuples;
}

function firstStepNumberTuple(raw) {
  return stepNumberTuples(raw)[0] || null;
}

function stepCartesianPoints(entities) {
  const points = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "CARTESIAN_POINT") continue;
    const { tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    if (tuple) points.set(entity.id, vec3(tuple[0], tuple[1], tuple[2]));
  }
  return points;
}

function stepInvalidCartesianPointRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "CARTESIAN_POINT") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 2);
    if (invalidTupleCount > 0 || !tuples.length) refs.add(entity.id);
  }
  return refs;
}

function stepPointLists(entities) {
  const pointLists = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "CARTESIAN_POINT_LIST_3D") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 3);
    if (invalidTupleCount > 0) continue;
    const points = tuples.map((tuple) => vec3(tuple[0], tuple[1], tuple[2]));
    if (points.length) pointLists.set(entity.id, points);
  }
  return pointLists;
}

function stepInvalidPointListRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "CARTESIAN_POINT_LIST_3D") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 3);
    if (invalidTupleCount > 0 || !tuples.length) refs.add(entity.id);
  }
  return refs;
}

function addStepMeshFace(mesh, points) {
  const clean = points.filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
  if (clean.length < 3) return false;
  const face = [];
  for (const point of clean) {
    const key = point.map((value) => Number(value).toPrecision(12)).join(",");
    let index = mesh.indexByPoint.get(key);
    if (index === undefined) {
      index = mesh.vertices.length;
      mesh.vertices.push(point);
      mesh.indexByPoint.set(key, index);
    }
    face.push(index);
  }
  const unique = new Set(face);
  if (unique.size < 3) return false;
  mesh.faces.push(face);
  return true;
}

function stepDirectionVectors(entities) {
  const directions = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "DIRECTION") continue;
    const { tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    if (!tuple) continue;
    directions.set(entity.id, vecUnit(vec3(tuple[0], tuple[1], tuple[2] || 0), [1, 0, 0]));
  }
  return directions;
}

function stepInvalidDirectionRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "DIRECTION") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    const zeroLengthDirection = tuple ? vecLength(vec3(tuple[0], tuple[1], tuple[2] || 0)) <= 1e-9 : false;
    if (invalidTupleCount > 0 || !tuples.length || zeroLengthDirection) refs.add(entity.id);
  }
  return refs;
}

function identityStepTransform() {
  return {
    origin: [0, 0, 0],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0],
    axisZ: [0, 0, 1]
  };
}

function stepTransformPoint(transform, point) {
  return vecAdd(
    transform.origin,
    vecAdd(vecAdd(vecMul(transform.axisX, point[0]), vecMul(transform.axisY, point[1])), vecMul(transform.axisZ, point[2]))
  );
}

function stepTransformVector(transform, vector) {
  return vecAdd(vecAdd(vecMul(transform.axisX, vector[0]), vecMul(transform.axisY, vector[1])), vecMul(transform.axisZ, vector[2]));
}

function transformStepFaces(faces, transform) {
  return faces.map((face) => face.map((point) => stepTransformPoint(transform, point)));
}

function transformStepSegments(segments, transform) {
  return segments.map((segment) => ({
    ...segment,
    start: stepTransformPoint(transform, segment.start),
    end: stepTransformPoint(transform, segment.end)
  }));
}

function transformStepPoints(points, transform) {
  return (points || []).map((point) => stepTransformPoint(transform, point));
}

function composeStepTransforms(parent, local) {
  return {
    origin: stepTransformPoint(parent, local.origin),
    axisX: stepTransformVector(parent, local.axisX),
    axisY: stepTransformVector(parent, local.axisY),
    axisZ: stepTransformVector(parent, local.axisZ)
  };
}

function stepAxisPlacementTransforms(entities) {
  const points = stepCartesianPoints(entities);
  const directions = stepDirectionVectors(entities);
  const placements = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "AXIS2_PLACEMENT_3D" && entity.type !== "AXIS2_PLACEMENT_2D") continue;
    const refs = stepRefs(entity.args);
    const originRef = refs.find((ref) => points.has(ref));
    const directionRefs = refs.filter((ref) => directions.has(ref));
    const origin = points.get(originRef) || [0, 0, 0];
    const axisZ = entity.type === "AXIS2_PLACEMENT_2D" ? [0, 0, 1] : vecUnit(directions.get(directionRefs[0]) || [0, 0, 1], [0, 0, 1]);
    let axisX = vecUnit(directions.get(entity.type === "AXIS2_PLACEMENT_2D" ? directionRefs[0] : directionRefs[1]) || [1, 0, 0], [1, 0, 0]);
    let axisY = vecUnit(vecCross(axisZ, axisX), [0, 1, 0]);
    axisX = vecUnit(vecCross(axisY, axisZ), axisX);
    placements.set(entity.id, { origin, axisX, axisY, axisZ });
  }
  return placements;
}

function stepInvalidAxisPlacementRefs(entities) {
  const invalidPointRefs = stepInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const directions = stepDirectionVectors(entities);
  const placementRefs = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "AXIS2_PLACEMENT_3D" && entity.type !== "AXIS2_PLACEMENT_2D") continue;
    const args = splitStepArguments(entity.args);
    const originRef = stepRefs(args[1] || "").find((ref) => invalidPointRefs.has(ref));
    if (originRef) {
      placementRefs.set(entity.id, { kind: "point", ref: originRef });
      continue;
    }
    const explicitDirectionRefs = entity.type === "AXIS2_PLACEMENT_2D"
      ? stepRefs(args[2] || "")
      : [...stepRefs(args[2] || ""), ...stepRefs(args[3] || "")];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      placementRefs.set(entity.id, { kind: "direction", ref: invalidDirectionRef });
      continue;
    }
    const axisZRef = entity.type === "AXIS2_PLACEMENT_3D" ? stepRefs(args[2] || "")[0] : null;
    const axisXRef = entity.type === "AXIS2_PLACEMENT_2D" ? stepRefs(args[2] || "")[0] : stepRefs(args[3] || "")[0];
    const axisZ = entity.type === "AXIS2_PLACEMENT_2D" ? [0, 0, 1] : vecUnit(directions.get(axisZRef) || [0, 0, 1], [0, 0, 1]);
    const axisX = vecUnit(directions.get(axisXRef) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecCross(axisZ, axisX);
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) placementRefs.set(entity.id, { kind: "basis" });
  }
  return placementRefs;
}

function stepInvalidAxisPlacementDetailText(detail) {
  const ref = detail?.ref || "?";
  if (detail?.kind === "direction") return `invalid DIRECTION #${ref}`;
  if (detail?.kind === "basis") return "degenerate placement basis";
  return `malformed CARTESIAN_POINT #${ref}`;
}

function stepAxis1Placements(entities) {
  const points = stepCartesianPoints(entities);
  const directions = stepDirectionVectors(entities);
  const placements = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "AXIS1_PLACEMENT") continue;
    const refs = stepRefs(entity.args);
    const originRef = refs.find((ref) => points.has(ref));
    const directionRef = refs.find((ref) => directions.has(ref));
    placements.set(entity.id, {
      origin: points.get(originRef) || [0, 0, 0],
      axis: vecUnit(directions.get(directionRef) || [0, 0, 1], [0, 0, 1])
    });
  }
  return placements;
}

function stepInvalidAxis1PlacementRefs(entities) {
  const points = stepCartesianPoints(entities);
  const invalidPointRefs = stepInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const directions = stepDirectionVectors(entities);
  const placementRefs = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "AXIS1_PLACEMENT") continue;
    const args = splitStepArguments(entity.args);
    const originRefs = stepRefs(args[1] || "");
    const originRef = originRefs[0] || null;
    if (originRef && invalidPointRefs.has(originRef)) {
      placementRefs.set(entity.id, { kind: "point", ref: originRef });
      continue;
    }
    if (!originRefs.some((ref) => points.has(ref))) {
      placementRefs.set(entity.id, { kind: "point-missing" });
      continue;
    }
    const directionRefs = stepRefs(args[2] || "");
    const invalidDirectionRef = directionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      placementRefs.set(entity.id, { kind: "direction", ref: invalidDirectionRef });
      continue;
    }
    if (directionRefs.length && !directionRefs.some((ref) => directions.has(ref))) {
      placementRefs.set(entity.id, { kind: "direction-missing" });
    }
  }
  return placementRefs;
}

function stepInvalidAxis1PlacementDetailText(detail) {
  const ref = detail?.ref || "?";
  if (detail?.kind === "direction") return `invalid DIRECTION #${ref}`;
  if (detail?.kind === "direction-missing") return "missing valid DIRECTION";
  if (detail?.kind === "point-missing") return "missing valid CARTESIAN_POINT";
  return `malformed CARTESIAN_POINT #${ref}`;
}

function stepCartesianTransformationOperators(entities) {
  const points = stepCartesianPoints(entities);
  const invalidPointRefs = stepInvalidCartesianPointRefs(entities);
  const directions = stepDirectionVectors(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const operators = new Map();
  for (const entity of entities.values()) {
    const is2d = entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_2D" || entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_2D_NON_UNIFORM";
    const is3d = entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_3D" || entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_3D_NON_UNIFORM";
    if (!is2d && !is3d) continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const explicitOriginRefs = stepRefs(args[3] || "");
    const invalidOriginRef = explicitOriginRefs.find((ref) => invalidPointRefs.has(ref));
    if (invalidOriginRef) continue;
    const explicitDirectionRefs = [
      ...stepRefs(args[1] || ""),
      ...stepRefs(args[2] || ""),
      ...(is3d ? stepRefs(args[5] || "") : [])
    ];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) continue;
    const scaleInfo = stepTransformationOperatorScaleInfo(Object.assign([...args], { type: entity.type }), { is2d, is3d });
    if (scaleInfo.invalid) continue;
    const originRef = explicitOriginRefs.find((ref) => points.has(ref)) || refs.find((ref) => points.has(ref));
    const directionRefs = refs.filter((ref) => directions.has(ref));
    const axisX = vecUnit(directions.get(directionRefs[0]) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecUnit(directions.get(directionRefs[1]) || [0, 1, 0], [0, 1, 0]);
    const origin = points.get(originRef) || [0, 0, 0];
    const axisZ = is3d ? vecUnit(directions.get(directionRefs[2]) || vecCross(axisX, axisY), [0, 0, 1]) : [0, 0, 1];
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) continue;
    operators.set(entity.id, {
      origin,
      axisX: vecMul(axisX, scaleInfo.scale1),
      axisY: vecMul(axisY, scaleInfo.scale2),
      axisZ: vecMul(axisZ, scaleInfo.scale3)
    });
  }
  return operators;
}

function stepTransformationScaleArgument(raw, fallback, label) {
  if (isStepMissingArgument(raw)) return { value: fallback, invalid: false };
  const value = stepArgNumber(raw, NaN);
  if (!Number.isFinite(value) || Math.abs(value) <= 1e-9) return { value: fallback, invalid: true, label };
  return { value, invalid: false };
}

function stepTransformationOperatorScaleInfo(args, { is2d, is3d }) {
  const isNonUniform = String(args?.type || "").endsWith("_NON_UNIFORM");
  const nonUniform = Boolean(isNonUniform);
  const scale1Arg = args?.[4];
  const scale1 = stepTransformationScaleArgument(scale1Arg, 1, "scale1");
  if (scale1.invalid) return { invalid: true, kind: "scale", label: scale1.label };
  const scale2Arg = is2d ? args?.[5] : args?.[6];
  const scale2 = nonUniform
    ? stepTransformationScaleArgument(scale2Arg, scale1.value, "scale2")
    : { value: scale1.value, invalid: false };
  if (scale2.invalid) return { invalid: true, kind: "scale", label: scale2.label };
  const scale3 = is3d && nonUniform
    ? stepTransformationScaleArgument(args?.[7], scale1.value, "scale3")
    : { value: scale1.value, invalid: false };
  if (scale3.invalid) return { invalid: true, kind: "scale", label: scale3.label };
  return {
    invalid: false,
    scale1: scale1.value,
    scale2: scale2.value,
    scale3: scale3.value
  };
}

function stepInvalidCartesianTransformationOperatorRefs(entities) {
  const invalidPointRefs = stepInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const directions = stepDirectionVectors(entities);
  const operatorRefs = new Map();
  for (const entity of entities.values()) {
    const is2d = entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_2D" || entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_2D_NON_UNIFORM";
    const is3d = entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_3D" || entity.type === "CARTESIAN_TRANSFORMATION_OPERATOR_3D_NON_UNIFORM";
    if (!is2d && !is3d) continue;
    const args = splitStepArguments(entity.args);
    const invalidOriginRef = stepRefs(args[3] || "").find((ref) => invalidPointRefs.has(ref));
    if (invalidOriginRef) {
      operatorRefs.set(entity.id, { ref: invalidOriginRef, kind: "point" });
      continue;
    }
    const explicitDirectionRefs = [
      ...stepRefs(args[1] || ""),
      ...stepRefs(args[2] || ""),
      ...(is3d ? stepRefs(args[5] || "") : [])
    ];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      operatorRefs.set(entity.id, { ref: invalidDirectionRef, kind: "direction" });
      continue;
    }
    const scaleInfo = stepTransformationOperatorScaleInfo(Object.assign([...args], { type: entity.type }), { is2d, is3d });
    if (scaleInfo.invalid) {
      operatorRefs.set(entity.id, { kind: "scale", label: scaleInfo.label });
      continue;
    }
    const refs = stepRefs(entity.args);
    const directionRefs = refs.filter((ref) => directions.has(ref));
    const axisX = vecUnit(directions.get(directionRefs[0]) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecUnit(directions.get(directionRefs[1]) || [0, 1, 0], [0, 1, 0]);
    const axisZ = is3d ? vecUnit(directions.get(directionRefs[2]) || vecCross(axisX, axisY), [0, 0, 1]) : [0, 0, 1];
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) operatorRefs.set(entity.id, { kind: "basis" });
  }
  return operatorRefs;
}

function stepInvalidTransformationOperatorDetailText(detail) {
  const ref = detail?.ref || detail?.originRef || "?";
  if (detail?.kind === "scale") return `invalid ${detail.label || "scale"} value`;
  if (detail?.kind === "basis") return "degenerate transform basis";
  if (detail?.kind === "direction") return `invalid DIRECTION #${ref}`;
  return `malformed CARTESIAN_POINT #${ref}`;
}

function cleanStepProfileLoop(points) {
  const clean = (points || []).filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
  if (clean.length > 2 && samePoint(clean[0], clean[clean.length - 1])) clean.pop();
  return clean.length >= 3 ? clean : [];
}

function sweptProfileFaces(bottom, top) {
  if (!Array.isArray(bottom) || !Array.isArray(top) || bottom.length < 3 || bottom.length !== top.length) return [];
  const faces = [
    [...bottom].reverse(),
    [...top]
  ];
  for (let index = 0; index < bottom.length; index += 1) {
    const next = (index + 1) % bottom.length;
    faces.push([bottom[index], bottom[next], top[next], top[index]]);
  }
  return faces;
}

function revolvedProfileFaces(profile, axisPlacement, angle, segmentCount) {
  const clean = cleanStepProfileLoop(profile);
  if (clean.length < 3 || !Number.isFinite(angle) || Math.abs(angle) < 1e-9) return [];
  const fullRevolution = Math.abs(Math.abs(angle) - Math.PI * 2) < 1e-6 || Math.abs(angle) > Math.PI * 2;
  const sweepAngle = fullRevolution ? Math.sign(angle || 1) * Math.PI * 2 : angle;
  const segments = fullRevolution
    ? segmentCount
    : Math.max(3, Math.ceil((Math.abs(sweepAngle) / (Math.PI * 2)) * segmentCount));
  const ringCount = fullRevolution ? segments : segments + 1;
  const origin = axisPlacement?.origin || [0, 0, 0];
  const axis = axisPlacement?.axis || [0, 0, 1];
  const rings = [];
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const ringAngle = fullRevolution ? (sweepAngle * ringIndex) / segments : (sweepAngle * ringIndex) / segments;
    rings.push(clean.map((point) => rotatePointAroundAxis(point, origin, axis, ringAngle)));
  }

  const faces = [];
  for (let ringIndex = 0; ringIndex < segments; ringIndex += 1) {
    const nextRingIndex = fullRevolution ? (ringIndex + 1) % ringCount : ringIndex + 1;
    for (let pointIndex = 0; pointIndex < clean.length; pointIndex += 1) {
      const nextPointIndex = (pointIndex + 1) % clean.length;
      faces.push([
        rings[ringIndex][pointIndex],
        rings[ringIndex][nextPointIndex],
        rings[nextRingIndex][nextPointIndex],
        rings[nextRingIndex][pointIndex]
      ]);
    }
  }
  if (!fullRevolution) {
    faces.push([...rings[0]].reverse());
    faces.push([...rings[rings.length - 1]]);
  }
  return faces;
}

function revolvedProfileLoopRings(loops, axisPlacement, angle, segmentCount, cleanLoop = cleanStepProfileLoop) {
  if (!Array.isArray(loops) || !Number.isFinite(angle) || Math.abs(angle) < 1e-9) return [];
  const fullRevolution = Math.abs(Math.abs(angle) - Math.PI * 2) < 1e-6 || Math.abs(angle) > Math.PI * 2;
  const sweepAngle = fullRevolution ? Math.sign(angle || 1) * Math.PI * 2 : angle;
  const segments = fullRevolution
    ? segmentCount
    : Math.max(3, Math.ceil((Math.abs(sweepAngle) / (Math.PI * 2)) * segmentCount));
  const ringCount = fullRevolution ? segments : segments + 1;
  const origin = axisPlacement?.origin || [0, 0, 0];
  const axis = axisPlacement?.axis || [0, 0, 1];
  const rings = [];
  for (const loop of loops) {
    const clean = cleanLoop(loop);
    if (clean.length < 3) continue;
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const ringAngle = fullRevolution ? (sweepAngle * ringIndex) / segments : (sweepAngle * ringIndex) / segments;
      rings.push(clean.map((point) => rotatePointAroundAxis(point, origin, axis, ringAngle)));
    }
  }
  return rings;
}

function segmentChains(segments) {
  const chains = [];
  let current = [];
  for (const segment of segments || []) {
    const start = segment?.start;
    const end = segment?.end;
    if (!finiteVec3(start) || !finiteVec3(end) || samePoint(start, end)) continue;
    if (!current.length) {
      current = [start, end];
      continue;
    }
    const last = current[current.length - 1];
    if (samePoint(last, start)) {
      current.push(end);
    } else if (samePoint(last, end)) {
      current.push(start);
    } else {
      if (current.length >= 2) chains.push(current);
      current = [start, end];
    }
  }
  if (current.length >= 2) chains.push(current);
  return chains;
}

function lerpPoint(a, b, ratio) {
  return [
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio,
    a[2] + (b[2] - a[2]) * ratio
  ];
}

function trimSegmentsByPathDistance(segments, startParam, endParam) {
  if (!Number.isFinite(startParam) && !Number.isFinite(endParam)) return segments || [];
  const cleanSegments = (segments || []).filter((segment) => (
    finiteVec3(segment?.start) && finiteVec3(segment?.end) && !samePoint(segment.start, segment.end)
  ));
  const totalLength = cleanSegments.reduce((total, segment) => total + vecLength(vecSub(segment.end, segment.start)), 0);
  if (totalLength <= 1e-9) return [];

  let start = Number.isFinite(startParam) ? startParam : 0;
  let end = Number.isFinite(endParam) ? endParam : totalLength;
  if (end < start) [start, end] = [end, start];
  start = Math.max(0, Math.min(totalLength, start));
  end = Math.max(0, Math.min(totalLength, end));
  if (end - start <= 1e-9) return [];

  const trimmed = [];
  let distance = 0;
  for (const segment of cleanSegments) {
    const length = vecLength(vecSub(segment.end, segment.start));
    const segmentStart = distance;
    const segmentEnd = distance + length;
    distance = segmentEnd;
    if (segmentEnd <= start + 1e-9 || segmentStart >= end - 1e-9) continue;
    const localStart = Math.max(start, segmentStart);
    const localEnd = Math.min(end, segmentEnd);
    if (localEnd - localStart <= 1e-9) continue;
    trimmed.push({
      start: lerpPoint(segment.start, segment.end, (localStart - segmentStart) / length),
      end: lerpPoint(segment.start, segment.end, (localEnd - segmentStart) / length)
    });
  }
  return trimmed;
}

function pathDistanceTrimParameterIssue(segments, startParam, endParam) {
  if (!Number.isFinite(startParam) && !Number.isFinite(endParam)) return null;
  const cleanSegments = (segments || []).filter((segment) => (
    finiteVec3(segment?.start) && finiteVec3(segment?.end) && !samePoint(segment.start, segment.end)
  ));
  const totalLength = cleanSegments.reduce((total, segment) => total + vecLength(vecSub(segment.end, segment.start)), 0);
  if (totalLength <= 1e-9) return null;
  const issues = [];
  if (Number.isFinite(startParam) && (startParam < -1e-9 || startParam > totalLength + 1e-9)) issues.push("start path-distance");
  if (Number.isFinite(endParam) && (endParam < -1e-9 || endParam > totalLength + 1e-9)) issues.push("end path-distance");
  const start = Number.isFinite(startParam) ? startParam : 0;
  const end = Number.isFinite(endParam) ? endParam : totalLength;
  if (end - start <= 1e-9) issues.push("start/end path-distance range");
  return issues.length ? issues : null;
}

function fallbackSweptDiskNormal(tangent) {
  const reference = Math.abs(vecDot(tangent, [0, 0, 1])) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  return vecUnit(vecCross(reference, tangent), [1, 0, 0]);
}

function sweptDiskRing(center, tangent, radius, segmentCount, previousNormal = null) {
  let normal = null;
  if (previousNormal) {
    const projected = vecSub(previousNormal, vecMul(tangent, vecDot(previousNormal, tangent)));
    if (vecLength(projected) > 1e-9) normal = vecUnit(projected, previousNormal);
  }
  if (!normal) normal = fallbackSweptDiskNormal(tangent);
  let binormal = vecUnit(vecCross(tangent, normal), [0, 1, 0]);
  normal = vecUnit(vecCross(binormal, tangent), normal);
  binormal = vecUnit(vecCross(tangent, normal), binormal);

  const ring = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    ring.push(vecAdd(center, vecAdd(
      vecMul(normal, Math.cos(angle) * radius),
      vecMul(binormal, Math.sin(angle) * radius)
    )));
  }
  return { ring, normal };
}

function sweptDiskFacesFromSegments(segments, radius, segmentCount) {
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isInteger(segmentCount) || segmentCount < 6) return [];
  const faces = [];
  for (const chain of segmentChains(segments)) {
    const closed = chain.length > 2 && samePoint(chain[0], chain[chain.length - 1]);
    const centers = closed ? chain.slice(0, -1) : chain;
    if (centers.length < 2) continue;
    const rings = [];
    let previousNormal = null;
    for (let index = 0; index < centers.length; index += 1) {
      const previous = index === 0 ? (closed ? centers[centers.length - 1] : centers[0]) : centers[index - 1];
      const next = index === centers.length - 1 ? (closed ? centers[0] : centers[centers.length - 1]) : centers[index + 1];
      const tangent = vecUnit(vecSub(next, previous), [0, 0, 1]);
      const { ring, normal } = sweptDiskRing(centers[index], tangent, radius, segmentCount, previousNormal);
      rings.push(ring);
      previousNormal = normal;
    }

    const spanCount = closed ? rings.length : rings.length - 1;
    for (let ringIndex = 0; ringIndex < spanCount; ringIndex += 1) {
      const nextRingIndex = (ringIndex + 1) % rings.length;
      for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
        const nextPointIndex = (pointIndex + 1) % segmentCount;
        faces.push([
          rings[ringIndex][pointIndex],
          rings[ringIndex][nextPointIndex],
          rings[nextRingIndex][nextPointIndex],
          rings[nextRingIndex][pointIndex]
        ]);
      }
    }
    if (!closed) {
      faces.push([...rings[0]].reverse());
      faces.push([...rings[rings.length - 1]]);
    }
  }
  return faces;
}

function stepPolylineCurves(entities) {
  const points = stepCartesianPoints(entities);
  const curves = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "POLYLINE") continue;
    const loop = cleanStepProfileLoop(stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean));
    if (loop.length >= 3) curves.set(entity.id, loop);
  }
  return curves;
}

function stepProfileCurveRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (!entity.type.endsWith("PROFILE_DEF")) continue;
    for (const ref of stepRefs(entity.args)) refs.add(ref);
  }
  return refs;
}

function stepInternalCurveRefs(entities) {
  const refs = stepProfileCurveRefs(entities);
  for (const entity of entities.values()) {
    if (entity.type === "EDGE_CURVE" || entity.type === "TRIMMED_CURVE") {
      for (const ref of stepRefs(entity.args)) refs.add(ref);
    } else if (entity.type === "SWEPT_DISK_SOLID" || entity.type === "SWEPT_DISK_SOLID_POLYGONAL") {
      const args = splitStepArguments(entity.args);
      for (const ref of stepRefs(args[1] || "")) refs.add(ref);
    }
  }
  return refs;
}

function stepAnalyticCurveDefinition(entity, placements, invalidPlacementRefs = new Map(), diagnostics = null) {
  const args = splitStepArguments(entity.args);
  if (entity.type === "CIRCLE") {
    const placementRefs = stepRefs(args[1] || entity.args);
    const invalidPlacementRef = placementRefs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPlacementRef) {
      if (Array.isArray(diagnostics)) {
        const detail = invalidPlacementRefs.get(invalidPlacementRef);
        addDiagnostic(
          diagnostics,
          "warning",
          "step-curve-invalid-placement-skipped",
          `STEP CIRCLE #${entity.id} references AXIS2_PLACEMENT #${invalidPlacementRef} with ${stepInvalidAxisPlacementDetailText(detail)}; skipping curve linework.`
        );
      }
      return null;
    }
    const placementRef = placementRefs.find((ref) => placements.has(ref));
    const radius = stepArgNumber(args[2], NaN);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    return {
      semiAxis1: radius,
      semiAxis2: radius,
      segments: STEP_CIRCLE_PROFILE_SEGMENTS,
      transform: placements.get(placementRef) || identityStepTransform()
    };
  }
  if (entity.type === "ELLIPSE") {
    const placementRefs = stepRefs(args[1] || entity.args);
    const invalidPlacementRef = placementRefs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPlacementRef) {
      if (Array.isArray(diagnostics)) {
        const detail = invalidPlacementRefs.get(invalidPlacementRef);
        addDiagnostic(
          diagnostics,
          "warning",
          "step-curve-invalid-placement-skipped",
          `STEP ELLIPSE #${entity.id} references AXIS2_PLACEMENT #${invalidPlacementRef} with ${stepInvalidAxisPlacementDetailText(detail)}; skipping curve linework.`
        );
      }
      return null;
    }
    const placementRef = placementRefs.find((ref) => placements.has(ref));
    const semiAxis1 = stepArgNumber(args[2], NaN);
    const semiAxis2 = stepArgNumber(args[3], NaN);
    if (!Number.isFinite(semiAxis1) || semiAxis1 <= 0 || !Number.isFinite(semiAxis2) || semiAxis2 <= 0) return null;
    return {
      semiAxis1,
      semiAxis2,
      segments: STEP_ELLIPSE_SEGMENTS,
      transform: placements.get(placementRef) || identityStepTransform()
    };
  }
  return null;
}

function stepAnalyticCurveDefinitions(entities, diagnostics = null, options = {}) {
  const placements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const entityTypes = Array.isArray(options.entityTypes) ? new Set(options.entityTypes) : null;
  const definitions = new Map();
  for (const entity of entities.values()) {
    if (entityTypes && !entityTypes.has(entity.type)) continue;
    const definition = stepAnalyticCurveDefinition(entity, placements, invalidPlacementRefs, diagnostics);
    if (definition) definitions.set(entity.id, definition);
  }
  return definitions;
}

function stepVectorDefinitions(entities, diagnostics = null) {
  const directions = stepDirectionVectors(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const vectors = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "VECTOR") continue;
    const args = splitStepArguments(entity.args);
    const directionRef = stepRefs(args[1] || entity.args).find((ref) => directions.has(ref));
    const invalidDirectionRef = stepRefs(args[1] || entity.args).find((ref) => invalidDirectionRefs.has(ref));
    const magnitude = stepArgNumber(args[2], NaN);
    if (!directionRef) {
      if (invalidDirectionRef) {
        addDiagnostic(
          diagnostics,
          "warning",
          "step-vector-invalid-direction-skipped",
          `STEP VECTOR #${entity.id} references malformed DIRECTION #${invalidDirectionRef}; skipping dependent line geometry.`
        );
      }
      continue;
    }
    if (!Number.isFinite(magnitude)) continue;
    vectors.set(entity.id, vecMul(directions.get(directionRef), magnitude));
  }
  return vectors;
}

function stepLineDefinitions(entities, diagnostics = null) {
  const points = stepCartesianPoints(entities);
  const vectors = stepVectorDefinitions(entities, diagnostics);
  const definitions = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "LINE") continue;
    const args = splitStepArguments(entity.args);
    const pointRef = stepRefs(args[1] || entity.args).find((ref) => points.has(ref));
    const vectorRef = stepRefs(args[2] || entity.args).find((ref) => vectors.has(ref));
    const origin = points.get(pointRef);
    const vector = vectors.get(vectorRef);
    if (!origin || !finiteVec3(vector) || vecLength(vector) < 1e-9) continue;
    definitions.set(entity.id, { origin, vector });
  }
  return definitions;
}

function stepAnalyticCurvePoints(definition, startAngle, span, steps, closed) {
  const points = [];
  const pointCount = closed ? steps : steps + 1;
  for (let index = 0; index < pointCount; index += 1) {
    const ratio = closed ? index / steps : index / Math.max(1, steps);
    const angle = startAngle + span * ratio;
    points.push(stepTransformPoint(definition.transform, [
      Math.cos(angle) * definition.semiAxis1,
      Math.sin(angle) * definition.semiAxis2,
      0
    ]));
  }
  return points;
}

function stepSegmentsFromCurvePoints(points, closed) {
  const segments = [];
  const limit = closed ? points.length : points.length - 1;
  for (let index = 0; index < limit; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (start && end && !samePoint(start, end)) segments.push({ start, end });
  }
  return segments;
}

function reverseCurveSegments(segments) {
  return [...segments].reverse().map((segment) => ({
    start: segment.end,
    end: segment.start
  }));
}

function stepFullAnalyticCurveSegments(definition) {
  const points = stepAnalyticCurvePoints(definition, 0, Math.PI * 2, definition.segments, true);
  return stepSegmentsFromCurvePoints(points, true);
}

function stepPolylineSegmentGroups(entities, diagnostics, options = {}) {
  const points = stepCartesianPoints(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "POLYLINE" || internalCurveRefs.has(entity.id)) continue;
    const vertices = stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean);
    const segments = [];
    for (let index = 1; index < vertices.length; index += 1) {
      if (!samePoint(vertices[index - 1], vertices[index])) segments.push({ start: vertices[index - 1], end: vertices[index] });
    }
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-polyline-linework",
      `Translated ${groups.size} STEP POLYLINE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepCircleCurveSegments(entities, diagnostics, options = {}) {
  const definitions = stepAnalyticCurveDefinitions(entities, diagnostics, { entityTypes: ["CIRCLE"] });
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "CIRCLE" || internalCurveRefs.has(entity.id)) continue;
    const definition = definitions.get(entity.id);
    if (!definition) continue;
    const segments = stepFullAnalyticCurveSegments(definition);
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-circle-linework",
      `Sampled ${groups.size} STEP CIRCLE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepEllipseCurveSegments(entities, diagnostics, options = {}) {
  const definitions = stepAnalyticCurveDefinitions(entities, diagnostics, { entityTypes: ["ELLIPSE"] });
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "ELLIPSE" || internalCurveRefs.has(entity.id)) continue;
    const definition = definitions.get(entity.id);
    if (!definition) continue;
    const segments = stepFullAnalyticCurveSegments(definition);
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-ellipse-linework",
      `Sampled ${groups.size} STEP ELLIPSE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepOpenUniformKnots(controlPointCount, degree) {
  const safeDegree = Math.max(1, Math.min(Math.trunc(degree) || 1, controlPointCount - 1));
  const interiorCount = Math.max(0, controlPointCount - safeDegree - 1);
  const knots = [];
  for (let index = 0; index <= safeDegree; index += 1) knots.push(0);
  for (let index = 1; index <= interiorCount; index += 1) knots.push(index / (interiorCount + 1));
  for (let index = 0; index <= safeDegree; index += 1) knots.push(1);
  return knots;
}

function stepBSplineKnots(args, controlPointCount, degree) {
  const multiplicities = stepNumberList(args[6])
    .map((value) => Math.max(0, Math.trunc(value)))
    .filter((value) => value > 0);
  const knotValues = stepNumberList(args[7]);
  const expanded = [];
  if (multiplicities.length === knotValues.length) {
    for (let index = 0; index < knotValues.length; index += 1) {
      for (let repeat = 0; repeat < multiplicities[index]; repeat += 1) expanded.push(knotValues[index]);
    }
  }
  const safeDegree = Math.max(1, Math.min(Math.trunc(degree) || 1, controlPointCount - 1));
  return expanded.length >= controlPointCount + safeDegree + 1
    ? expanded
    : stepOpenUniformKnots(controlPointCount, safeDegree);
}

function stepBSplineWeights(args, controlPointCount) {
  const weights = stepNumberList(args[9]);
  return weights.length === controlPointCount && weights.every((weight) => weight > 0) ? weights : [];
}

function stepBSplineCurveDefinitions(entities) {
  const points = stepCartesianPoints(entities);
  const definitions = new Map();
  for (const entity of entities.values()) {
    const rational = entity.type === "RATIONAL_B_SPLINE_CURVE_WITH_KNOTS";
    if (entity.type !== "B_SPLINE_CURVE_WITH_KNOTS" && !rational) continue;
    const args = splitStepArguments(entity.args);
    const degree = stepArgNumber(args[1], NaN);
    if (!Number.isFinite(degree)) continue;
    const controlPoints = stepRefs(args[2] || "").map((ref) => points.get(ref)).filter(Boolean);
    if (controlPoints.length < 2) continue;
    const knots = stepBSplineKnots(args, controlPoints.length, degree);
    const weights = stepBSplineWeights(args, controlPoints.length);
    if (rational && weights.length !== controlPoints.length) continue;
    definitions.set(entity.id, {
      degree,
      controlPoints,
      knots,
      weights,
      closed: /\.T\./i.test(args[4] || ""),
      rational
    });
  }
  return definitions;
}

function stepBSplineCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = stepBSplineCurveDefinitions(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  let rationalCount = 0;
  for (const [entityId, definition] of definitions.entries()) {
    if (internalCurveRefs.has(entityId)) continue;
    const curvePoints = sampleBSpline(definition.controlPoints, definition.knots, definition.degree, definition.weights, STEP_BSPLINE_SEGMENTS);
    const segments = stepSegmentsFromCurvePoints(curvePoints, definition.closed);
    if (segments.length) {
      groups.set(entityId, segments);
      if (definition.rational) rationalCount += 1;
    }
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-bspline-linework",
      `Sampled ${groups.size} STEP B_SPLINE_CURVE_WITH_KNOTS item(s) into canonical reference linework.`
    );
  }
  if (rationalCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-rational-bspline-linework",
      `Sampled ${rationalCount} STEP rational B-spline curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepTrimParameterValue(raw) {
  const text = String(raw || "").trim();
  const parameterMatch = text.match(/(?:IFC)?PARAMETER_?VALUE\s*\(\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?)\s*\)/i);
  if (parameterMatch) return stepArgNumber(parameterMatch[1], NaN);
  const tuple = firstStepNumberTuple(text);
  if (tuple?.length) return tuple[0];
  const compact = text.replace(/[()]/g, "").trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][-+]?\d+)?$/.test(compact) ? stepArgNumber(compact, NaN) : NaN;
}

function analyticCurveAngleForPoint(definition, point) {
  if (!finiteVec3(point)) return NaN;
  const offset = vecSub(point, definition.transform.origin);
  const localX = vecDot(offset, definition.transform.axisX) / definition.semiAxis1;
  const localY = vecDot(offset, definition.transform.axisY) / definition.semiAxis2;
  return Number.isFinite(localX) && Number.isFinite(localY) ? Math.atan2(localY, localX) : NaN;
}

function trimAngleFromArgument(raw, mode, definition, points) {
  if (/\.PARAMETER\./i.test(mode || "")) return stepTrimParameterValue(raw);
  if (/\.CARTESIAN\./i.test(mode || "")) {
    const pointRef = stepRefs(raw).find((ref) => points.has(ref));
    return analyticCurveAngleForPoint(definition, points.get(pointRef));
  }
  const parameter = stepTrimParameterValue(raw);
  if (Number.isFinite(parameter)) return parameter;
  const pointRef = stepRefs(raw).find((ref) => points.has(ref));
  return analyticCurveAngleForPoint(definition, points.get(pointRef));
}

function linePointAtParameter(definition, parameter) {
  return Number.isFinite(parameter) ? vecAdd(definition.origin, vecMul(definition.vector, parameter)) : null;
}

function trimPointFromLineArgument(raw, mode, definition, points) {
  if (/\.CARTESIAN\./i.test(mode || "")) {
    const pointRef = stepRefs(raw).find((ref) => points.has(ref));
    const point = points.get(pointRef);
    if (finiteVec3(point)) return point;
  }
  const parameter = stepTrimParameterValue(raw);
  const parameterPoint = linePointAtParameter(definition, parameter);
  if (parameterPoint) return parameterPoint;
  const pointRef = stepRefs(raw).find((ref) => points.has(ref));
  const point = points.get(pointRef);
  return finiteVec3(point) ? point : null;
}

function stepTrimmedCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = stepAnalyticCurveDefinitions(entities);
  const lineDefinitions = stepLineDefinitions(entities, diagnostics);
  const bsplineDefinitions = stepBSplineCurveDefinitions(entities);
  const points = stepCartesianPoints(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  let lineCount = 0;
  let bsplineCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "TRIMMED_CURVE") continue;
    if (internalCurveRefs.has(entity.id)) continue;
    const args = splitStepArguments(entity.args);
    const baseCurveRef = stepRefs(args[1] || "").find((ref) => definitions.has(ref) || lineDefinitions.has(ref) || bsplineDefinitions.has(ref));
    const definition = definitions.get(baseCurveRef);
    if (definition) {
      const startAngle = trimAngleFromArgument(args[2], args[5], definition, points);
      const endAngle = trimAngleFromArgument(args[3], args[5], definition, points);
      if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) continue;
      const span = angleDeltaCcw(startAngle, endAngle);
      if (span <= 1e-9) continue;
      const steps = Math.max(4, Math.ceil(definition.segments * Math.min(span, Math.PI * 2) / (Math.PI * 2)));
      const curvePoints = stepAnalyticCurvePoints(definition, startAngle, span, steps, false);
      if (/\.F\./i.test(args[4] || "")) curvePoints.reverse();
      const segments = stepSegmentsFromCurvePoints(curvePoints, false);
      if (segments.length) groups.set(entity.id, segments);
      continue;
    }
    const lineDefinition = lineDefinitions.get(baseCurveRef);
    if (lineDefinition) {
      let start = trimPointFromLineArgument(args[2], args[5], lineDefinition, points);
      let end = trimPointFromLineArgument(args[3], args[5], lineDefinition, points);
      if (!finiteVec3(start) || !finiteVec3(end) || samePoint(start, end)) continue;
      if (/\.F\./i.test(args[4] || "")) [start, end] = [end, start];
      groups.set(entity.id, [{ start, end }]);
      lineCount += 1;
      continue;
    }
    const bsplineDefinition = bsplineDefinitions.get(baseCurveRef);
    if (!bsplineDefinition || !/\.PARAMETER\./i.test(args[5] || "")) continue;
    const startParameter = stepTrimParameterValue(args[2]);
    const endParameter = stepTrimParameterValue(args[3]);
    if (!Number.isFinite(startParameter) || !Number.isFinite(endParameter) || Math.abs(startParameter - endParameter) < 1e-12) continue;
    const rangeStart = Math.min(startParameter, endParameter);
    const rangeEnd = Math.max(startParameter, endParameter);
    const curvePoints = sampleBSplineRange(
      bsplineDefinition.controlPoints,
      bsplineDefinition.knots,
      bsplineDefinition.degree,
      bsplineDefinition.weights,
      STEP_BSPLINE_SEGMENTS,
      rangeStart,
      rangeEnd
    );
    if (startParameter > endParameter) curvePoints.reverse();
    if (/\.F\./i.test(args[4] || "")) curvePoints.reverse();
    const segments = stepSegmentsFromCurvePoints(curvePoints, false);
    if (segments.length) {
      groups.set(entity.id, segments);
      bsplineCount += 1;
    }
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-trimmed-curve-linework",
      `Sampled ${groups.size} STEP TRIMMED_CURVE item(s) into canonical reference linework.`
    );
  }
  if (lineCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-trimmed-line-linework",
      `Translated ${lineCount} STEP TRIMMED_CURVE line item(s) into canonical reference linework.`
    );
  }
  if (bsplineCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-trimmed-bspline-linework",
      `Sampled ${bsplineCount} STEP TRIMMED_CURVE B-spline item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepCompositeCurveSegmentRecords(entities) {
  const records = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "COMPOSITE_CURVE_SEGMENT") continue;
    const args = splitStepArguments(entity.args);
    const parentCurveRef = stepRefs(args[2] || "").find((ref) => entities.has(ref));
    if (!parentCurveRef) continue;
    records.set(entity.id, {
      parentCurveRef,
      sameSense: !/\.F\./i.test(args[1] || "")
    });
  }
  return records;
}

function stepCompositeSourceCurveRefs(entities) {
  const records = stepCompositeCurveSegmentRecords(entities);
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "COMPOSITE_CURVE") continue;
    for (const ref of stepRefs(entity.args)) {
      const record = records.get(ref);
      if (record) refs.add(record.parentCurveRef);
    }
  }
  return refs;
}

function stepCompositeCurveSegmentGroups(entities, curveGroups, diagnostics, options = {}) {
  const records = stepCompositeCurveSegmentRecords(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : stepInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "COMPOSITE_CURVE") continue;
    if (internalCurveRefs.has(entity.id)) continue;
    const args = splitStepArguments(entity.args);
    const segmentRefs = stepRefs(args[1] || entity.args).filter((ref) => records.has(ref));
    const segments = [];
    for (const segmentRef of segmentRefs) {
      const record = records.get(segmentRef);
      const childSegments = curveGroups.get(record.parentCurveRef);
      if (!childSegments?.length) continue;
      segments.push(...(record.sameSense ? childSegments : reverseCurveSegments(childSegments)));
    }
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-composite-curve-linework",
      `Translated ${groups.size} STEP COMPOSITE_CURVE item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function stepCurveSegmentGroups(entities, diagnostics, options = {}) {
  const baseSegmentGroups = new Map([
    ...stepPolylineSegmentGroups(entities, diagnostics, options),
    ...stepCircleCurveSegments(entities, diagnostics, options),
    ...stepEllipseCurveSegments(entities, diagnostics, options),
    ...stepBSplineCurveSegmentGroups(entities, diagnostics, options),
    ...stepTrimmedCurveSegmentGroups(entities, diagnostics, options)
  ]);
  return new Map([
    ...baseSegmentGroups,
    ...stepCompositeCurveSegmentGroups(entities, baseSegmentGroups, diagnostics, options)
  ]);
}

function stepCircleProfile(radius) {
  const points = [];
  for (let index = 0; index < STEP_CIRCLE_PROFILE_SEGMENTS; index += 1) {
    const angle = index / STEP_CIRCLE_PROFILE_SEGMENTS * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
  }
  return points;
}

function ellipseProfileLoop(semiAxis1, semiAxis2, segments) {
  if (
    !Number.isFinite(semiAxis1) || semiAxis1 <= 0
    || !Number.isFinite(semiAxis2) || semiAxis2 <= 0
    || !Number.isInteger(segments) || segments < 8
  ) {
    return [];
  }

  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    points.push([Math.cos(angle) * semiAxis1, Math.sin(angle) * semiAxis2, 0]);
  }
  return points;
}

function circleHollowProfileLoops(radius, wallThickness, segments = STEP_CIRCLE_PROFILE_SEGMENTS) {
  if (
    !Number.isFinite(radius) || radius <= 0
    || !Number.isFinite(wallThickness) || wallThickness <= 0 || wallThickness >= radius
  ) {
    return { outer: [], inner: [] };
  }
  const circleLoop = (loopRadius) => {
    const points = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      points.push([Math.cos(angle) * loopRadius, Math.sin(angle) * loopRadius, 0]);
    }
    return points;
  };
  return {
    outer: circleLoop(radius),
    inner: circleLoop(radius - wallThickness)
  };
}

function rectangleProfileLoop(xDim, yDim) {
  if (!Number.isFinite(xDim) || xDim <= 0 || !Number.isFinite(yDim) || yDim <= 0) return [];
  const halfX = xDim / 2;
  const halfY = yDim / 2;
  return [
    [-halfX, -halfY, 0],
    [halfX, -halfY, 0],
    [halfX, halfY, 0],
    [-halfX, halfY, 0]
  ];
}

function roundedRectangleProfileLoop(xDim, yDim, radius, segments = IFC_CIRCLE_PROFILE_SEGMENTS) {
  if (!Number.isFinite(radius) || radius < 0) return [];
  if (radius === 0) return rectangleProfileLoop(xDim, yDim);
  if (
    !Number.isFinite(xDim) || xDim <= 0
    || !Number.isFinite(yDim) || yDim <= 0
    || radius * 2 > xDim
    || radius * 2 > yDim
  ) {
    return [];
  }

  const halfX = xDim / 2;
  const halfY = yDim / 2;
  const innerX = halfX - radius;
  const innerY = halfY - radius;
  const perCornerSegments = Math.max(2, Math.floor(segments / 4));
  const arcs = [
    [innerX, -innerY, -Math.PI / 2, 0],
    [innerX, innerY, 0, Math.PI / 2],
    [-innerX, innerY, Math.PI / 2, Math.PI],
    [-innerX, -innerY, Math.PI, Math.PI * 1.5]
  ];
  const points = [];
  for (const [cx, cy, startAngle, endAngle] of arcs) {
    for (let index = 0; index < perCornerSegments; index += 1) {
      const t = index / (perCornerSegments - 1);
      const angle = startAngle + (endAngle - startAngle) * t;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0]);
    }
  }
  return points;
}

function rectangleHollowProfileLoops(xDim, yDim, wallThickness) {
  const outer = rectangleProfileLoop(xDim, yDim);
  if (!outer.length || !Number.isFinite(wallThickness) || wallThickness <= 0 || wallThickness * 2 >= xDim || wallThickness * 2 >= yDim) {
    return { outer: [], inner: [] };
  }
  return {
    outer,
    inner: rectangleProfileLoop(xDim - wallThickness * 2, yDim - wallThickness * 2)
  };
}

function roundedRectangleHollowProfileLoops(xDim, yDim, wallThickness, innerRadius = 0, outerRadius = 0, segments = IFC_CIRCLE_PROFILE_SEGMENTS) {
  if (!Number.isFinite(wallThickness) || wallThickness <= 0 || wallThickness * 2 >= xDim || wallThickness * 2 >= yDim) {
    return { outer: [], inner: [] };
  }
  const outer = roundedRectangleProfileLoop(xDim, yDim, Number.isFinite(outerRadius) ? outerRadius : 0, segments);
  const inner = roundedRectangleProfileLoop(
    xDim - wallThickness * 2,
    yDim - wallThickness * 2,
    Number.isFinite(innerRadius) ? innerRadius : 0,
    segments
  );
  return outer.length && inner.length ? { outer, inner } : { outer: [], inner: [] };
}

function trapeziumProfileLoop(bottomXDim, topXDim, yDim, topXOffset) {
  if (
    !Number.isFinite(bottomXDim) || bottomXDim <= 0
    || !Number.isFinite(topXDim) || topXDim <= 0
    || !Number.isFinite(yDim) || yDim <= 0
    || !Number.isFinite(topXOffset)
  ) {
    return [];
  }

  const halfBottom = bottomXDim / 2;
  const halfY = yDim / 2;
  const topStart = -halfBottom + topXOffset;
  const topEnd = topStart + topXDim;
  const minX = Math.min(-halfBottom, halfBottom, topStart, topEnd);
  const maxX = Math.max(-halfBottom, halfBottom, topStart, topEnd);
  const centerX = (minX + maxX) / 2;
  return [
    [-halfBottom - centerX, -halfY, 0],
    [halfBottom - centerX, -halfY, 0],
    [topEnd - centerX, halfY, 0],
    [topStart - centerX, halfY, 0]
  ];
}

function lShapeProfileLoop(width, depth, thickness) {
  if (
    !Number.isFinite(width) || width <= 0
    || !Number.isFinite(depth) || depth <= 0
    || !Number.isFinite(thickness) || thickness <= 0 || thickness >= width || thickness >= depth
  ) {
    return [];
  }

  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  return [
    [-halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth + thickness, 0],
    [-halfWidth + thickness, -halfDepth + thickness, 0],
    [-halfWidth + thickness, halfDepth, 0],
    [-halfWidth, halfDepth, 0]
  ];
}

function cShapeProfileLoop(width, depth, wallThickness, girth) {
  if (
    !Number.isFinite(width) || width <= 0
    || !Number.isFinite(depth) || depth <= 0
    || !Number.isFinite(wallThickness) || wallThickness <= 0 || wallThickness * 2 >= width || wallThickness * 2 >= depth
    || !Number.isFinite(girth) || girth <= wallThickness || girth >= depth / 2
  ) {
    return [];
  }

  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const innerRight = halfWidth - wallThickness;
  const innerLeft = -halfWidth + wallThickness;
  return [
    [-halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth + girth, 0],
    [innerRight, -halfDepth + girth, 0],
    [innerRight, -halfDepth + wallThickness, 0],
    [innerLeft, -halfDepth + wallThickness, 0],
    [innerLeft, halfDepth - wallThickness, 0],
    [innerRight, halfDepth - wallThickness, 0],
    [innerRight, halfDepth - girth, 0],
    [halfWidth, halfDepth - girth, 0],
    [halfWidth, halfDepth, 0],
    [-halfWidth, halfDepth, 0]
  ];
}

function uShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness) {
  if (
    !Number.isFinite(flangeWidth) || flangeWidth <= 0
    || !Number.isFinite(depth) || depth <= 0
    || !Number.isFinite(webThickness) || webThickness <= 0 || webThickness >= flangeWidth
    || !Number.isFinite(flangeThickness) || flangeThickness <= 0 || flangeThickness * 2 >= depth
  ) {
    return [];
  }

  const halfFlange = flangeWidth / 2;
  const halfDepth = depth / 2;
  const innerWeb = -halfFlange + webThickness;
  const bottomFlangeTop = -halfDepth + flangeThickness;
  const topFlangeBottom = halfDepth - flangeThickness;
  return [
    [-halfFlange, -halfDepth, 0],
    [halfFlange, -halfDepth, 0],
    [halfFlange, bottomFlangeTop, 0],
    [innerWeb, bottomFlangeTop, 0],
    [innerWeb, topFlangeBottom, 0],
    [halfFlange, topFlangeBottom, 0],
    [halfFlange, halfDepth, 0],
    [-halfFlange, halfDepth, 0]
  ];
}

function tShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness) {
  if (
    !Number.isFinite(flangeWidth) || flangeWidth <= 0
    || !Number.isFinite(depth) || depth <= 0
    || !Number.isFinite(webThickness) || webThickness <= 0 || webThickness >= flangeWidth
    || !Number.isFinite(flangeThickness) || flangeThickness <= 0 || flangeThickness >= depth
  ) {
    return [];
  }

  const halfFlange = flangeWidth / 2;
  const halfDepth = depth / 2;
  const halfWeb = webThickness / 2;
  const flangeBottom = halfDepth - flangeThickness;
  return [
    [-halfFlange, flangeBottom, 0],
    [-halfFlange, halfDepth, 0],
    [halfFlange, halfDepth, 0],
    [halfFlange, flangeBottom, 0],
    [halfWeb, flangeBottom, 0],
    [halfWeb, -halfDepth, 0],
    [-halfWeb, -halfDepth, 0],
    [-halfWeb, flangeBottom, 0]
  ];
}

function zShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness) {
  if (
    !Number.isFinite(flangeWidth) || flangeWidth <= 0
    || !Number.isFinite(depth) || depth <= 0
    || !Number.isFinite(webThickness) || webThickness <= 0 || webThickness >= flangeWidth
    || !Number.isFinite(flangeThickness) || flangeThickness <= 0 || flangeThickness * 2 >= depth
  ) {
    return [];
  }

  const halfFlange = flangeWidth / 2;
  const halfDepth = depth / 2;
  const halfWeb = webThickness / 2;
  const bottomFlangeTop = -halfDepth + flangeThickness;
  const topFlangeBottom = halfDepth - flangeThickness;
  return [
    [-halfFlange, -halfDepth, 0],
    [halfWeb, -halfDepth, 0],
    [halfWeb, topFlangeBottom, 0],
    [halfFlange, topFlangeBottom, 0],
    [halfFlange, halfDepth, 0],
    [-halfWeb, halfDepth, 0],
    [-halfWeb, bottomFlangeTop, 0],
    [-halfFlange, bottomFlangeTop, 0]
  ];
}

function iShapeProfileLoop(overallWidth, overallDepth, webThickness, flangeThickness) {
  if (
    !Number.isFinite(overallWidth) || overallWidth <= 0
    || !Number.isFinite(overallDepth) || overallDepth <= 0
    || !Number.isFinite(webThickness) || webThickness <= 0 || webThickness >= overallWidth
    || !Number.isFinite(flangeThickness) || flangeThickness <= 0 || flangeThickness * 2 >= overallDepth
  ) {
    return [];
  }

  const halfWidth = overallWidth / 2;
  const halfDepth = overallDepth / 2;
  const halfWeb = webThickness / 2;
  const bottomWebStart = -halfDepth + flangeThickness;
  const topWebEnd = halfDepth - flangeThickness;
  return [
    [-halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth, 0],
    [halfWidth, bottomWebStart, 0],
    [halfWeb, bottomWebStart, 0],
    [halfWeb, topWebEnd, 0],
    [halfWidth, topWebEnd, 0],
    [halfWidth, halfDepth, 0],
    [-halfWidth, halfDepth, 0],
    [-halfWidth, topWebEnd, 0],
    [-halfWeb, topWebEnd, 0],
    [-halfWeb, bottomWebStart, 0],
    [-halfWidth, bottomWebStart, 0]
  ];
}

function asymmetricIShapeProfileLoop(bottomFlangeWidth, overallDepth, webThickness, bottomFlangeThickness, topFlangeWidth, topFlangeThickness) {
  if (
    !Number.isFinite(bottomFlangeWidth) || bottomFlangeWidth <= 0
    || !Number.isFinite(overallDepth) || overallDepth <= 0
    || !Number.isFinite(webThickness) || webThickness <= 0 || webThickness >= bottomFlangeWidth || webThickness >= topFlangeWidth
    || !Number.isFinite(bottomFlangeThickness) || bottomFlangeThickness <= 0
    || !Number.isFinite(topFlangeWidth) || topFlangeWidth <= 0
    || !Number.isFinite(topFlangeThickness) || topFlangeThickness <= 0
    || bottomFlangeThickness + topFlangeThickness >= overallDepth
  ) {
    return [];
  }

  const halfBottomFlange = bottomFlangeWidth / 2;
  const halfTopFlange = topFlangeWidth / 2;
  const halfDepth = overallDepth / 2;
  const halfWeb = webThickness / 2;
  const bottomWebStart = -halfDepth + bottomFlangeThickness;
  const topWebEnd = halfDepth - topFlangeThickness;
  return [
    [-halfBottomFlange, -halfDepth, 0],
    [halfBottomFlange, -halfDepth, 0],
    [halfBottomFlange, bottomWebStart, 0],
    [halfWeb, bottomWebStart, 0],
    [halfWeb, topWebEnd, 0],
    [halfTopFlange, topWebEnd, 0],
    [halfTopFlange, halfDepth, 0],
    [-halfTopFlange, halfDepth, 0],
    [-halfTopFlange, topWebEnd, 0],
    [-halfWeb, topWebEnd, 0],
    [-halfWeb, bottomWebStart, 0],
    [-halfBottomFlange, bottomWebStart, 0]
  ];
}

function stepNumericArgs(args) {
  return args
    .map((arg) => stepArgNumber(arg, NaN))
    .filter((value) => Number.isFinite(value));
}

const STEP_PROFILE_DEF_TYPES = new Set([
  "RECTANGLE_PROFILE_DEF",
  "ROUNDED_RECTANGLE_PROFILE_DEF",
  "RECTANGLE_HOLLOW_PROFILE_DEF",
  "RECTANGULAR_HOLLOW_PROFILE_DEF",
  "CIRCLE_PROFILE_DEF",
  "ELLIPSE_PROFILE_DEF",
  "CIRCLE_HOLLOW_PROFILE_DEF",
  "TRAPEZIUM_PROFILE_DEF",
  "L_SHAPE_PROFILE_DEF",
  "ANGLE_PROFILE_DEF",
  "C_SHAPE_PROFILE_DEF",
  "U_SHAPE_PROFILE_DEF",
  "T_SHAPE_PROFILE_DEF",
  "Z_SHAPE_PROFILE_DEF",
  "I_SHAPE_PROFILE_DEF",
  "ASYMMETRIC_I_SHAPE_PROFILE_DEF",
  "ARBITRARY_CLOSED_PROFILE_DEF",
  "ARBITRARY_PROFILE_DEF_WITH_VOIDS"
]);

function stepProfiles(entities, diagnostics) {
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const transformationOperators = stepCartesianTransformationOperators(entities);
  const polylines = stepPolylineCurves(entities);
  const profiles = new Map();

  for (const entity of entities.values()) {
    if (!STEP_PROFILE_DEF_TYPES.has(entity.type)) continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "step-profile-invalid-placement-skipped",
        `STEP ${entity.type} #${entity.id} references AXIS2_PLACEMENT #${invalidPositionRef} with ${stepInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping profile geometry.`
      );
      continue;
    }
    const positionRef = refs.find((ref) => axisPlacements.has(ref));
    const placement = axisPlacements.get(positionRef) || identityStepTransform();
    const numericArgs = stepNumericArgs(args);

    if (entity.type === "RECTANGLE_PROFILE_DEF") {
      const [xDim, yDim] = numericArgs.slice(-2);
      const loop = rectangleProfileLoop(xDim, yDim);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "ROUNDED_RECTANGLE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 3);
      const xDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const yDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const radius = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const loop = roundedRectangleProfileLoop(xDim, yDim, radius, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "RECTANGLE_HOLLOW_PROFILE_DEF" || entity.type === "RECTANGULAR_HOLLOW_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 3);
      const xDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const yDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const innerFilletRadius = stepArgNumber(args[6], 0);
      const outerFilletRadius = stepArgNumber(args[7], 0);
      const { outer } = roundedRectangleHollowProfileLoops(xDim, yDim, wallThickness, innerFilletRadius, outerFilletRadius, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (outer.length >= 3) profiles.set(entity.id, outer.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "CIRCLE_PROFILE_DEF") {
      const radius = numericArgs[numericArgs.length - 1];
      if (!Number.isFinite(radius) || radius <= 0) continue;
      profiles.set(entity.id, stepCircleProfile(radius).map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "ELLIPSE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 2);
      const semiAxis1 = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const semiAxis2 = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const loop = ellipseProfileLoop(semiAxis1, semiAxis2, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "CIRCLE_HOLLOW_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 2);
      const radius = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const wallThickness = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const { outer } = circleHollowProfileLoops(radius, wallThickness, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (outer.length >= 3) profiles.set(entity.id, outer.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "TRAPEZIUM_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const bottomXDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const topXDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const yDim = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const topXOffset = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = trapeziumProfileLoop(bottomXDim, topXDim, yDim, topXOffset);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "L_SHAPE_PROFILE_DEF" || entity.type === "ANGLE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 3);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const width = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const thickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const loop = lShapeProfileLoop(width, depth, thickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "C_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const width = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const girth = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = cShapeProfileLoop(width, depth, wallThickness, girth);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "U_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = uShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "T_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = tShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "Z_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = zShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "I_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 4);
      const overallWidth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const overallDepth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = iShapeProfileLoop(overallWidth, overallDepth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "ASYMMETRIC_I_SHAPE_PROFILE_DEF") {
      const fallbackDims = numericArgs.slice(0, 6);
      const bottomFlangeWidth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const overallDepth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const bottomFlangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const topFlangeWidth = stepArgNumber(args[8], fallbackDims[4] ?? NaN);
      const topFlangeThickness = stepArgNumber(args[9], fallbackDims[5] ?? NaN);
      const loop = asymmetricIShapeProfileLoop(bottomFlangeWidth, overallDepth, webThickness, bottomFlangeThickness, topFlangeWidth, topFlangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => stepTransformPoint(placement, point)));
    } else if (entity.type === "ARBITRARY_CLOSED_PROFILE_DEF" || entity.type === "ARBITRARY_PROFILE_DEF_WITH_VOIDS") {
      const curveRef = refs.find((ref) => polylines.has(ref));
      const loop = cleanStepProfileLoop(polylines.get(curveRef));
      if (loop.length >= 3) profiles.set(entity.id, loop);
    }
  }

  const derivedProfiles = [...entities.values()].filter((entity) => entity.type === "DERIVED_PROFILE_DEF" || entity.type === "MIRRORED_PROFILE_DEF");
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of derivedProfiles) {
      if (profiles.has(entity.id)) continue;
      const refs = stepRefs(entity.args);
      const parentRef = refs.find((ref) => profiles.has(ref));
      const parent = profiles.get(parentRef);
      if (!parent) continue;
      let loop = [];
      if (entity.type === "MIRRORED_PROFILE_DEF") {
        loop = cleanStepProfileLoop(parent.map((point) => [-point[0], point[1], point[2]]));
      } else {
        const operatorRef = refs.find((ref) => transformationOperators.has(ref));
        const operator = transformationOperators.get(operatorRef);
        if (!operator) continue;
        loop = cleanStepProfileLoop(parent.map((point) => stepTransformPoint(operator, point)));
      }
      if (loop.length >= 3) {
        profiles.set(entity.id, loop);
        changed = true;
      }
    }
  }
  return profiles;
}

function stepProfileVoidLoops(entities) {
  const polylines = stepPolylineCurves(entities);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const profileVoids = new Map();
  for (const entity of entities.values()) {
    const args = splitStepArguments(entity.args);
    if (entity.type === "ARBITRARY_PROFILE_DEF_WITH_VOIDS") {
      const voidLoops = stepRefs(args[3] || "")
        .map((ref) => cleanStepProfileLoop(polylines.get(ref)))
        .filter((loop) => loop.length >= 3);
      if (voidLoops.length) profileVoids.set(entity.id, voidLoops);
    } else if (entity.type === "RECTANGLE_HOLLOW_PROFILE_DEF" || entity.type === "RECTANGULAR_HOLLOW_PROFILE_DEF") {
      const refs = stepRefs(entity.args);
      const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
      if (invalidPositionRef) continue;
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityStepTransform();
      const numericArgs = stepNumericArgs(args);
      const fallbackDims = numericArgs.slice(0, 3);
      const xDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const yDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const innerFilletRadius = stepArgNumber(args[6], 0);
      const outerFilletRadius = stepArgNumber(args[7], 0);
      const { inner } = roundedRectangleHollowProfileLoops(xDim, yDim, wallThickness, innerFilletRadius, outerFilletRadius, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (inner.length >= 3) profileVoids.set(entity.id, [inner.map((point) => stepTransformPoint(placement, point))]);
    } else if (entity.type === "CIRCLE_HOLLOW_PROFILE_DEF") {
      const refs = stepRefs(entity.args);
      const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
      if (invalidPositionRef) continue;
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityStepTransform();
      const numericArgs = stepNumericArgs(args);
      const fallbackDims = numericArgs.slice(0, 2);
      const radius = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const wallThickness = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const { inner } = circleHollowProfileLoops(radius, wallThickness, STEP_CIRCLE_PROFILE_SEGMENTS);
      if (inner.length >= 3) profileVoids.set(entity.id, [inner.map((point) => stepTransformPoint(placement, point))]);
    }
  }
  return profileVoids;
}

function stepExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics) {
  const directionArgRefs = stepRefs(args[3] || "");
  const invalidDirectionRef = directionArgRefs.find((ref) => invalidDirectionRefs.has(ref));
  if (invalidDirectionRef) {
    addDiagnosticOnce(
      diagnostics,
      "warning",
      "step-extruded-solid-invalid-direction-skipped",
      `STEP ${entity.type} #${entity.id} references invalid DIRECTION #${invalidDirectionRef}; skipping swept solid mesh.`
    );
    return null;
  }
  const directionRef = directionArgRefs.find((ref) => directions.has(ref));
  if (!directionRef) {
    addDiagnosticOnce(
      diagnostics,
      "warning",
      "step-extruded-solid-invalid-direction-skipped",
      `STEP ${entity.type} #${entity.id} is missing a valid extrusion DIRECTION; skipping swept solid mesh.`
    );
    return null;
  }
  return directionRef;
}

function stepExtrudedSolidFaceGroups(entities, diagnostics) {
  const profiles = stepProfiles(entities, diagnostics);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const directions = stepDirectionVectors(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const faceGroups = new Map();
  let regularCount = 0;
  let taperedCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "EXTRUDED_AREA_SOLID" && entity.type !== "EXTRUDED_AREA_SOLID_TAPERED") continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const sweptAreaRef = stepRefs(args[1] || "").find((ref) => profiles.has(ref)) || refs.find((ref) => profiles.has(ref));
    const endSweptAreaRef = entity.type === "EXTRUDED_AREA_SOLID_TAPERED"
      ? stepRefs(args[5] || "").find((ref) => profiles.has(ref)) || refs.find((ref) => ref !== sweptAreaRef && profiles.has(ref))
      : null;
    const positionRef = stepRefs(args[2] || "").find((ref) => axisPlacements.has(ref)) || refs.find((ref) => axisPlacements.has(ref));
    const invalidPositionRef = stepRefs(args[2] || "").find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-extruded-solid-invalid-placement-skipped",
        `STEP ${entity.type} #${entity.id} references AXIS2_PLACEMENT #${invalidPositionRef} with ${stepInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const directionRef = stepExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics);
    if (!directionRef) continue;
    const numericArgs = stepNumericArgs(args);
    const depth = stepArgNumber(args[4], NaN);
    const extrusionDepth = Number.isFinite(depth) ? depth : numericArgs[numericArgs.length - 1];
    const profile = cleanStepProfileLoop(profiles.get(sweptAreaRef));
    const endProfile = entity.type === "EXTRUDED_AREA_SOLID_TAPERED" ? cleanStepProfileLoop(profiles.get(endSweptAreaRef)) : profile;
    if (profile.length < 3 || !Number.isFinite(extrusionDepth) || extrusionDepth <= 0) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-extruded-solid-skipped",
        `Skipped ${entity.type} #${entity.id} because its profile or depth is unsupported.`
      );
      continue;
    }
    if (entity.type === "EXTRUDED_AREA_SOLID_TAPERED" && (endProfile.length < 3 || endProfile.length !== profile.length)) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-extruded-solid-tapered-skipped",
        `Skipped EXTRUDED_AREA_SOLID_TAPERED #${entity.id} because its start and end profiles are unsupported or have incompatible point counts.`
      );
      continue;
    }
    const placement = axisPlacements.get(positionRef) || identityStepTransform();
    const extrusion = vecMul(vecUnit(directions.get(directionRef) || [0, 0, 1], [0, 0, 1]), extrusionDepth);
    const bottom = profile.map((point) => stepTransformPoint(placement, point));
    const top = endProfile.map((point) => stepTransformPoint(placement, vecAdd(point, extrusion)));
    const faces = sweptProfileFaces(bottom, top);
    if (!faces.length) continue;
    faceGroups.set(entity.id, faces);
    if (entity.type === "EXTRUDED_AREA_SOLID_TAPERED") taperedCount += 1;
    else regularCount += 1;
  }

  if (regularCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-extruded-solid-applied",
      `Translated ${regularCount} EXTRUDED_AREA_SOLID swept solid(s) into canonical mesh faces.`
    );
  }
  if (taperedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-extruded-solid-tapered-applied",
      `Translated ${taperedCount} EXTRUDED_AREA_SOLID_TAPERED swept solid(s) into canonical tapered mesh faces.`
    );
  }
  return faceGroups;
}

function stepExtrudedSolidVoidLoopGroups(entities, diagnostics) {
  const profileVoids = stepProfileVoidLoops(entities);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const directions = stepDirectionVectors(entities);
  const invalidDirectionRefs = stepInvalidDirectionRefs(entities);
  const loopGroups = new Map();
  let voidLoopCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "EXTRUDED_AREA_SOLID" && entity.type !== "EXTRUDED_AREA_SOLID_TAPERED") continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const sweptAreaRef = stepRefs(args[1] || "").find((ref) => profileVoids.has(ref)) || refs.find((ref) => profileVoids.has(ref));
    const endSweptAreaRef = entity.type === "EXTRUDED_AREA_SOLID_TAPERED"
      ? stepRefs(args[5] || "").find((ref) => profileVoids.has(ref)) || refs.find((ref) => ref !== sweptAreaRef && profileVoids.has(ref))
      : sweptAreaRef;
    const positionRef = stepRefs(args[2] || "").find((ref) => axisPlacements.has(ref)) || refs.find((ref) => axisPlacements.has(ref));
    if (stepRefs(args[2] || "").some((ref) => invalidPlacementRefs.has(ref))) continue;
    const directionRef = stepExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics);
    if (!directionRef) continue;
    const numericArgs = stepNumericArgs(args);
    const depth = stepArgNumber(args[4], NaN);
    const extrusionDepth = Number.isFinite(depth) ? depth : numericArgs[numericArgs.length - 1];
    const voidLoops = profileVoids.get(sweptAreaRef) || [];
    const endVoidLoops = profileVoids.get(endSweptAreaRef) || [];
    if ((!voidLoops.length && !endVoidLoops.length) || !Number.isFinite(extrusionDepth) || extrusionDepth <= 0) continue;
    const placement = axisPlacements.get(positionRef) || identityStepTransform();
    const extrusion = vecMul(vecUnit(directions.get(directionRef) || [0, 0, 1], [0, 0, 1]), extrusionDepth);
    const loops = [];
    for (const loop of voidLoops) {
      const clean = cleanStepProfileLoop(loop);
      if (clean.length < 3) continue;
      loops.push(clean.map((point) => stepTransformPoint(placement, point)));
    }
    for (const loop of endVoidLoops) {
      const clean = cleanStepProfileLoop(loop);
      if (clean.length < 3) continue;
      loops.push(clean.map((point) => stepTransformPoint(placement, vecAdd(point, extrusion))));
    }
    if (!loops.length) continue;
    loopGroups.set(entity.id, loops);
    voidLoopCount += loops.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-profile-void-linework",
      `Preserved ${voidLoopCount} STEP extruded profile void loop(s) as canonical reference linework; mesh faces still use outer profiles only.`
    );
  }
  return loopGroups;
}

function stepRevolvedSolidFaceGroups(entities, diagnostics) {
  const profiles = stepProfiles(entities, diagnostics);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const axis1Placements = stepAxis1Placements(entities);
  const invalidAxis1PlacementRefs = stepInvalidAxis1PlacementRefs(entities);
  const faceGroups = new Map();

  for (const entity of entities.values()) {
    if (entity.type !== "REVOLVED_AREA_SOLID") continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const sweptAreaRef = stepRefs(args[1] || "").find((ref) => profiles.has(ref)) || refs.find((ref) => profiles.has(ref));
    const positionRef = stepRefs(args[2] || "").find((ref) => axisPlacements.has(ref)) || refs.find((ref) => axisPlacements.has(ref));
    const invalidPositionRef = stepRefs(args[2] || "").find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-revolved-solid-invalid-placement-skipped",
        `STEP REVOLVED_AREA_SOLID #${entity.id} references AXIS2_PLACEMENT #${invalidPositionRef} with ${stepInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisArgRefs = stepRefs(args[3] || "");
    const invalidAxisRef = axisArgRefs.find((ref) => invalidAxis1PlacementRefs.has(ref));
    if (invalidAxisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "step-revolved-solid-invalid-axis-skipped",
        `STEP REVOLVED_AREA_SOLID #${entity.id} references AXIS1_PLACEMENT #${invalidAxisRef} with ${stepInvalidAxis1PlacementDetailText(invalidAxis1PlacementRefs.get(invalidAxisRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisRef = axisArgRefs.find((ref) => axis1Placements.has(ref));
    if (!axisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "step-revolved-solid-invalid-axis-skipped",
        `STEP REVOLVED_AREA_SOLID #${entity.id} is missing a valid AXIS1_PLACEMENT; skipping swept solid mesh.`
      );
      continue;
    }
    const numericArgs = stepNumericArgs(args);
    const angle = stepArgNumber(args[4], numericArgs[numericArgs.length - 1] ?? NaN);
    const profile = cleanStepProfileLoop(profiles.get(sweptAreaRef));
    const axisPlacement = axis1Placements.get(axisRef) || { origin: [0, 0, 0], axis: [0, 0, 1] };
    const localFaces = revolvedProfileFaces(profile, axisPlacement, angle, STEP_REVOLVED_PROFILE_SEGMENTS);
    if (!localFaces.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-revolved-solid-skipped",
        `Skipped REVOLVED_AREA_SOLID #${entity.id} because its profile, axis, or angle is unsupported.`
      );
      continue;
    }
    const placement = axisPlacements.get(positionRef) || identityStepTransform();
    faceGroups.set(entity.id, transformStepFaces(localFaces, placement));
  }

  if (faceGroups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-revolved-solid-applied",
      `Translated ${faceGroups.size} REVOLVED_AREA_SOLID swept solid(s) into sampled canonical mesh faces.`
    );
  }
  return faceGroups;
}

function stepRevolvedSolidVoidLoopGroups(entities, diagnostics) {
  const profileVoids = stepProfileVoidLoops(entities);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const invalidPlacementRefs = stepInvalidAxisPlacementRefs(entities);
  const axis1Placements = stepAxis1Placements(entities);
  const invalidAxis1PlacementRefs = stepInvalidAxis1PlacementRefs(entities);
  const loopGroups = new Map();
  let voidLoopCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "REVOLVED_AREA_SOLID") continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const sweptAreaRef = stepRefs(args[1] || "").find((ref) => profileVoids.has(ref)) || refs.find((ref) => profileVoids.has(ref));
    const positionRef = stepRefs(args[2] || "").find((ref) => axisPlacements.has(ref)) || refs.find((ref) => axisPlacements.has(ref));
    if (stepRefs(args[2] || "").some((ref) => invalidPlacementRefs.has(ref))) continue;
    const axisArgRefs = stepRefs(args[3] || "");
    const invalidAxisRef = axisArgRefs.find((ref) => invalidAxis1PlacementRefs.has(ref));
    if (invalidAxisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "step-revolved-solid-invalid-axis-skipped",
        `STEP REVOLVED_AREA_SOLID #${entity.id} references AXIS1_PLACEMENT #${invalidAxisRef} with ${stepInvalidAxis1PlacementDetailText(invalidAxis1PlacementRefs.get(invalidAxisRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisRef = axisArgRefs.find((ref) => axis1Placements.has(ref));
    if (!axisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "step-revolved-solid-invalid-axis-skipped",
        `STEP REVOLVED_AREA_SOLID #${entity.id} is missing a valid AXIS1_PLACEMENT; skipping swept solid mesh.`
      );
      continue;
    }
    const numericArgs = stepNumericArgs(args);
    const angle = stepArgNumber(args[4], numericArgs[numericArgs.length - 1] ?? NaN);
    const voidLoops = profileVoids.get(sweptAreaRef) || [];
    if (!voidLoops.length) continue;
    const axisPlacement = axis1Placements.get(axisRef) || { origin: [0, 0, 0], axis: [0, 0, 1] };
    const localRings = revolvedProfileLoopRings(voidLoops, axisPlacement, angle, STEP_REVOLVED_PROFILE_SEGMENTS, cleanStepProfileLoop);
    if (!localRings.length) continue;
    const placement = axisPlacements.get(positionRef) || identityStepTransform();
    const rings = transformStepFaces(localRings, placement);
    loopGroups.set(entity.id, rings);
    voidLoopCount += rings.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-revolved-profile-void-linework",
      `Preserved ${voidLoopCount} STEP revolved profile void ring(s) as canonical reference linework; mesh faces still use outer profiles only.`
    );
  }
  return loopGroups;
}

function stepPolyLoops(entities) {
  const points = stepCartesianPoints(entities);
  const loops = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "POLY_LOOP") continue;
    const loopPoints = stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean);
    if (loopPoints.length >= 3) loops.set(entity.id, loopPoints);
  }

  const vertices = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "VERTEX_POINT") continue;
    const pointRef = stepRefs(entity.args).find((ref) => points.has(ref));
    if (pointRef) vertices.set(entity.id, points.get(pointRef));
  }

  const edgeCurves = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "EDGE_CURVE") continue;
    const vertexRefs = stepRefs(entity.args).filter((ref) => vertices.has(ref));
    if (vertexRefs.length >= 2) edgeCurves.set(entity.id, [vertices.get(vertexRefs[0]), vertices.get(vertexRefs[1])]);
  }

  const orientedEdges = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "ORIENTED_EDGE") continue;
    const edgeRef = stepRefs(entity.args).find((ref) => edgeCurves.has(ref));
    const edge = edgeCurves.get(edgeRef);
    if (!edge) continue;
    const args = splitStepArguments(entity.args);
    const sameSense = !/\.F\./i.test(args[args.length - 1] || "");
    orientedEdges.set(entity.id, sameSense ? edge : [edge[1], edge[0]]);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "EDGE_LOOP") continue;
    const segments = stepRefs(entity.args).map((ref) => orientedEdges.get(ref)).filter(Boolean);
    if (segments.length < 3) continue;
    const loopPoints = [segments[0][0], segments[0][1]];
    let connected = true;
    for (const segment of segments.slice(1)) {
      const lastPoint = loopPoints[loopPoints.length - 1];
      if (samePoint(lastPoint, segment[0])) {
        loopPoints.push(segment[1]);
      } else if (samePoint(lastPoint, segment[1])) {
        loopPoints.push(segment[0]);
      } else {
        connected = false;
        break;
      }
    }
    if (!connected) continue;
    if (samePoint(loopPoints[0], loopPoints[loopPoints.length - 1])) loopPoints.pop();
    if (loopPoints.length >= 3) loops.set(entity.id, loopPoints);
  }

  return loops;
}

function stepStandaloneVertexPointGroups(entities, diagnostics = null) {
  const points = stepCartesianPoints(entities);
  const invalidPointRefs = stepInvalidCartesianPointRefs(entities);
  const edgeVertexRefs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "EDGE_CURVE") continue;
    for (const ref of stepRefs(entity.args)) {
      if (entities.get(ref)?.type === "VERTEX_POINT") edgeVertexRefs.add(ref);
    }
  }
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "VERTEX_POINT" || edgeVertexRefs.has(entity.id)) continue;
    const pointRefs = stepRefs(entity.args);
    const pointRef = pointRefs.find((ref) => points.has(ref));
    const point = pointRef ? points.get(pointRef) : null;
    if (finiteVec3(point)) groups.set(entity.id, [point]);
    else if (diagnostics && pointRefs.some((ref) => invalidPointRefs.has(ref))) {
      addDiagnostic(diagnostics, "info", "step-vertex-point-invalid-skipped", `Skipped STEP VERTEX_POINT #${entity.id}; referenced CARTESIAN_POINT coordinates were missing or invalid.`);
    }
  }
  return groups;
}

function stepPolyLoopFaceGroups(entities, diagnostics) {
  const loops = stepPolyLoops(entities);
  const outerBounds = new Map();
  const faceBounds = new Map();
  for (const entity of entities.values()) {
    if (entity.type === "FACE_OUTER_BOUND") {
      const [loopRef] = stepRefs(entity.args);
      if (loopRef && loops.has(loopRef)) outerBounds.set(entity.id, loops.get(loopRef));
    } else if (entity.type === "FACE_BOUND") {
      const [loopRef] = stepRefs(entity.args);
      if (loopRef && loops.has(loopRef)) faceBounds.set(entity.id, loops.get(loopRef));
    }
  }

  const faceGroups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "ADVANCED_FACE" && entity.type !== "FACE_SURFACE") continue;
    const refs = stepRefs(entity.args);
    const outer = refs.map((ref) => outerBounds.get(ref)).find(Boolean)
      || refs.map((ref) => faceBounds.get(ref)).find(Boolean);
    if (outer) faceGroups.set(entity.id, [outer]);
  }

  if (!faceGroups.size) {
    for (const [loopRef, loopPoints] of loops.entries()) faceGroups.set(loopRef, [loopPoints]);
  }
  return faceGroups;
}

function stepPolyLoopInnerBoundGroups(entities, diagnostics) {
  const loops = stepPolyLoops(entities);
  const outerBounds = new Map();
  const innerBounds = new Map();
  for (const entity of entities.values()) {
    const [loopRef] = stepRefs(entity.args);
    if (!loopRef || !loops.has(loopRef)) continue;
    if (entity.type === "FACE_OUTER_BOUND") {
      outerBounds.set(entity.id, loops.get(loopRef));
    } else if (entity.type === "FACE_BOUND") {
      innerBounds.set(entity.id, loops.get(loopRef));
    }
  }

  const loopGroups = new Map();
  let innerLoopCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "ADVANCED_FACE" && entity.type !== "FACE_SURFACE") continue;
    const refs = stepRefs(entity.args);
    const hasExplicitOuter = refs.some((ref) => outerBounds.has(ref));
    const innerRefs = refs.filter((ref) => innerBounds.has(ref));
    const effectiveInnerRefs = hasExplicitOuter ? innerRefs : innerRefs.slice(1);
    const loopsForFace = effectiveInnerRefs.map((ref) => innerBounds.get(ref));
    if (!loopsForFace.length) continue;
    loopGroups.set(entity.id, loopsForFace);
    innerLoopCount += loopsForFace.length;
  }

  if (innerLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-inner-bound-linework",
      `Preserved ${innerLoopCount} STEP FACE_BOUND inner loop(s) as canonical reference linework; mesh faces still use outer loops only.`
    );
  }
  return loopGroups;
}

function stepTriangulatedFaceGroups(entities, diagnostics) {
  const pointLists = stepPointLists(entities);
  const invalidPointListRefs = stepInvalidPointListRefs(entities);
  const faceGroups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "TRIANGULATED_FACE_SET") continue;
    const args = splitStepArguments(entity.args);
    const pointListRef = stepRefs(args[1] || "")[0] || stepRefs(entity.args).find((ref) => pointLists.has(ref));
    const invalidPointListRef = stepRefs(args[1] || "").find((ref) => invalidPointListRefs.has(ref)) || stepRefs(entity.args).find((ref) => invalidPointListRefs.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) {
      if (invalidPointListRef) {
        addDiagnostic(diagnostics, "warning", "step-tessellated-points-invalid-skipped", `STEP TRIANGULATED_FACE_SET #${entity.id} points to malformed CARTESIAN_POINT_LIST_3D #${invalidPointListRef}; skipping tessellated face set.`);
      } else {
        addDiagnostic(diagnostics, "warning", "step-tessellated-points-missing", `STEP TRIANGULATED_FACE_SET #${entity.id} points to a missing CARTESIAN_POINT_LIST_3D.`);
      }
      continue;
    }
    const faces = [];
    const indexTuples = stepIntegerTuples(args[5] || entity.args);
    for (const tuple of indexTuples) {
      const face = tuple.map((index) => points[index - 1]).filter(Boolean);
      if (face.length >= 3) faces.push(face);
    }
    if (faces.length) faceGroups.set(entity.id, faces);
  }
  return faceGroups;
}

function stepPolygonalFaceGroups(entities, diagnostics) {
  const pointLists = stepPointLists(entities);
  const invalidPointListRefs = stepInvalidPointListRefs(entities);
  const indexedFaces = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "INDEXED_POLYGONAL_FACE" && entity.type !== "INDEXED_POLYGONAL_FACE_WITH_VOIDS") continue;
    const [outerFace] = stepIntegerTuples(entity.args);
    if (!outerFace) continue;
    indexedFaces.set(entity.id, outerFace);
  }

  const faceGroups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "POLYGONAL_FACE_SET") continue;
    const refs = stepRefs(entity.args);
    const pointListRef = refs.find((ref) => pointLists.has(ref));
    const invalidPointListRef = refs.find((ref) => invalidPointListRefs.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) {
      if (invalidPointListRef) {
        addDiagnostic(diagnostics, "warning", "step-polygonal-points-invalid-skipped", `STEP POLYGONAL_FACE_SET #${entity.id} points to malformed CARTESIAN_POINT_LIST_3D #${invalidPointListRef}; skipping polygonal face set.`);
      } else {
        addDiagnostic(diagnostics, "warning", "step-polygonal-points-missing", `STEP POLYGONAL_FACE_SET #${entity.id} points to a missing CARTESIAN_POINT_LIST_3D.`);
      }
      continue;
    }
    const faces = [];
    const faceRefs = refs.filter((ref) => indexedFaces.has(ref));
    for (const faceRef of faceRefs) {
      const face = indexedFaces.get(faceRef).map((index) => points[index - 1]).filter(Boolean);
      if (face.length >= 3) faces.push(face);
    }
    if (faces.length) faceGroups.set(entity.id, faces);
  }
  return faceGroups;
}

function stepPolygonalVoidLoopGroups(entities, diagnostics) {
  const pointLists = stepPointLists(entities);
  const indexedVoids = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "INDEXED_POLYGONAL_FACE_WITH_VOIDS") continue;
    const voids = stepIntegerTuples(entity.args).slice(1).filter((tuple) => tuple.length >= 3);
    if (voids.length) indexedVoids.set(entity.id, voids);
  }

  const loopGroups = new Map();
  let voidLoopCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "POLYGONAL_FACE_SET") continue;
    const refs = stepRefs(entity.args);
    const pointListRef = refs.find((ref) => pointLists.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) continue;
    const loops = [];
    for (const faceRef of refs.filter((ref) => indexedVoids.has(ref))) {
      for (const voidFace of indexedVoids.get(faceRef)) {
        const loop = voidFace.map((index) => points[index - 1]).filter(Boolean);
        if (loop.length >= 3) loops.push(loop);
      }
    }
    if (!loops.length) continue;
    loopGroups.set(entity.id, loops);
    voidLoopCount += loops.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-polygonal-void-linework",
      `Preserved ${voidLoopCount} STEP INDEXED_POLYGONAL_FACE_WITH_VOIDS inner loop(s) as canonical reference linework; mesh faces still use outer loops only.`
    );
  }
  return loopGroups;
}

function stepSweptDiskSolidFaceGroups(entities, diagnostics) {
  const curveGroups = stepCurveSegmentGroups(entities, [], { includeInternal: true });
  const faceGroups = new Map();
  let sweptDiskCount = 0;
  let ignoredInnerRadiusCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "SWEPT_DISK_SOLID" && entity.type !== "SWEPT_DISK_SOLID_POLYGONAL") continue;
    const args = splitStepArguments(entity.args);
    const directrixRef = stepRefs(args[1] || "").find((ref) => curveGroups.has(ref))
      || stepRefs(entity.args).find((ref) => curveGroups.has(ref));
    const radiusParameter = stepRequiredPositiveNumberArgument(args[2], "radius");
    const innerRadiusParameter = stepOptionalNonNegativeNumberArgument(args[3], "inner radius");
    const startParameter = stepOptionalNumberArgument(args[4], "start path-distance");
    const endParameter = stepOptionalNumberArgument(args[5], "end path-distance");
    const invalidParameterLabels = [radiusParameter, innerRadiusParameter, startParameter, endParameter]
      .filter((parameter) => parameter.invalid)
      .map((parameter) => parameter.label);
    if (!radiusParameter.invalid && Number.isFinite(innerRadiusParameter.value) && innerRadiusParameter.value >= radiusParameter.value) {
      invalidParameterLabels.push("inner radius");
    }
    if (invalidParameterLabels.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-swept-disk-invalid-parameter-skipped",
        `Skipped ${entity.type} #${entity.id} because its ${invalidParameterLabels.join("/")} parameter(s) were malformed or unsupported.`
      );
      continue;
    }
    const radius = radiusParameter.value;
    const innerRadius = innerRadiusParameter.value;
    const startParam = startParameter.value;
    const endParam = endParameter.value;
    const sourceDirectrixSegments = curveGroups.get(directrixRef);
    const trimRangeIssues = pathDistanceTrimParameterIssue(sourceDirectrixSegments, startParam, endParam);
    if (trimRangeIssues) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-swept-disk-invalid-parameter-skipped",
        `Skipped ${entity.type} #${entity.id} because its ${trimRangeIssues.join("/")} parameter(s) were outside the supported directrix range.`
      );
      continue;
    }
    const directrixSegments = trimSegmentsByPathDistance(sourceDirectrixSegments, startParam, endParam);
    const faces = sweptDiskFacesFromSegments(directrixSegments, radius, STEP_SWEPT_DISK_SEGMENTS);
    if (!faces.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "step-swept-disk-solid-skipped",
        `Skipped ${entity.type} #${entity.id} because its directrix or radius is unsupported.`
      );
      continue;
    }
    if (Number.isFinite(innerRadius) && innerRadius > 0 && innerRadius < radius) ignoredInnerRadiusCount += 1;
    if (Number.isFinite(startParam) || Number.isFinite(endParam)) {
      addDiagnostic(
        diagnostics,
        "info",
        "step-swept-disk-directrix-trimmed",
        `Applied STEP swept disk start/end path-distance parameters to ${entity.type} #${entity.id}.`
      );
    }
    faceGroups.set(entity.id, faces);
    sweptDiskCount += 1;
  }
  if (sweptDiskCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-swept-disk-solid-applied",
      `Translated ${sweptDiskCount} STEP SWEPT_DISK_SOLID item(s) into sampled canonical tube mesh faces.`
    );
  }
  if (ignoredInnerRadiusCount) {
    addDiagnostic(
      diagnostics,
      "warning",
      "step-swept-disk-inner-radius-ignored",
      `Rendered ${ignoredInnerRadiusCount} STEP swept disk solid(s) with their outer radius only; inner pipe walls are left to an external tessellator adapter.`
    );
  }
  return faceGroups;
}

function stepFacetedFaceGroups(entities, diagnostics) {
  return new Map([
    ...stepPolyLoopFaceGroups(entities, diagnostics),
    ...stepTriangulatedFaceGroups(entities, diagnostics),
    ...stepPolygonalFaceGroups(entities, diagnostics),
    ...stepExtrudedSolidFaceGroups(entities, diagnostics),
    ...stepRevolvedSolidFaceGroups(entities, diagnostics),
    ...stepSweptDiskSolidFaceGroups(entities, diagnostics)
  ]);
}

const STEP_REPRESENTATION_WRAPPER_TYPES = new Set([
  "BREP_WITH_VOIDS",
  "CLOSED_SHELL",
  "CONNECTED_FACE_SET",
  "FACETED_BREP",
  "GEOMETRIC_CURVE_SET",
  "FACE_BASED_SURFACE_MODEL",
  "GEOMETRIC_SET",
  "MANIFOLD_SOLID_BREP",
  "OPEN_SHELL",
  "SHELL_BASED_SURFACE_MODEL"
]);

const STEP_DEFAULT_MESH_COLOR = "#64748b";

const PREDEFINED_STYLE_COLORS = new Map([
  ["black", "#000000"],
  ["blue", "#0000ff"],
  ["cyan", "#00ffff"],
  ["gray", "#808080"],
  ["grey", "#808080"],
  ["green", "#00ff00"],
  ["magenta", "#ff00ff"],
  ["red", "#ff0000"],
  ["white", "#ffffff"],
  ["yellow", "#ffff00"]
]);

function predefinedStyleColorHex(raw) {
  const name = stepStringValue(raw);
  if (!name) return null;
  return PREDEFINED_STYLE_COLORS.get(name.trim().toLowerCase().replace(/[\s_-]+/g, "")) || null;
}

function stepColorComponentHex(value) {
  const normalized = Math.max(0, Math.min(1, parseStepNumber(value, NaN)));
  return Math.round(normalized * 255).toString(16).padStart(2, "0");
}

function stepRgbHex(raw) {
  const args = splitStepArguments(raw);
  const red = stepArgNumber(args[1], NaN);
  const green = stepArgNumber(args[2], NaN);
  const blue = stepArgNumber(args[3], NaN);
  if (![red, green, blue].every(Number.isFinite)) return null;
  return `#${stepColorComponentHex(red)}${stepColorComponentHex(green)}${stepColorComponentHex(blue)}`;
}

function styleRatioArgument(raw, fallback = null) {
  const direct = stepArgNumber(raw, null);
  if (Number.isFinite(direct)) return direct;
  const values = stepNumberList(raw);
  return Number.isFinite(values[0]) ? values[0] : fallback;
}

function opacityFromTransparencyArgument(raw) {
  const transparency = styleRatioArgument(raw, null);
  if (!Number.isFinite(transparency) || transparency <= 0) return null;
  return canonicalOpacity(1 - transparency);
}

const STEP_STYLE_COLOR_WRAPPER_TYPES = new Set([
  "FILL_AREA_STYLE",
  "FILL_AREA_STYLE_COLOUR",
  "PRESENTATION_STYLE_ASSIGNMENT",
  "CURVE_STYLE",
  "SURFACE_SIDE_STYLE",
  "SURFACE_STYLE_FILL_AREA",
  "SURFACE_STYLE_RENDERING",
  "SURFACE_STYLE_SHADING",
  "SURFACE_STYLE_USAGE"
]);

function stepStyleColors(entities) {
  const colors = new Map();
  for (const entity of entities.values()) {
    let color = null;
    if (entity.type === "COLOUR_RGB") color = stepRgbHex(entity.args);
    else if (entity.type === "DRAUGHTING_PRE_DEFINED_COLOUR" || entity.type === "PRE_DEFINED_COLOUR") {
      color = predefinedStyleColorHex(entity.args);
    }
    if (color) colors.set(entity.id, color);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities.values()) {
      if (colors.has(entity.id) || !STEP_STYLE_COLOR_WRAPPER_TYPES.has(entity.type)) continue;
      const colorRef = stepRefs(entity.args).find((ref) => colors.has(ref));
      const color = colors.get(colorRef);
      if (!color) continue;
      colors.set(entity.id, color);
      changed = true;
    }
  }

  return colors;
}

function stepStyleOpacities(entities) {
  const opacities = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "SURFACE_STYLE_RENDERING" && entity.type !== "SURFACE_STYLE_SHADING") continue;
    const args = splitStepArguments(entity.args);
    const opacity = opacityFromTransparencyArgument(args[1]);
    if (Number.isFinite(opacity)) opacities.set(entity.id, opacity);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities.values()) {
      if (opacities.has(entity.id) || !STEP_STYLE_COLOR_WRAPPER_TYPES.has(entity.type)) continue;
      const opacityRef = stepRefs(entity.args).find((ref) => opacities.has(ref));
      const opacity = opacities.get(opacityRef);
      if (!Number.isFinite(opacity)) continue;
      opacities.set(entity.id, opacity);
      changed = true;
    }
  }

  return opacities;
}

function stepStyledItemColors(entities) {
  const styleColors = stepStyleColors(entities);
  const itemColors = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "STYLED_ITEM") continue;
    const args = splitStepArguments(entity.args);
    const itemRef = stepRefs(args[0] || "")[0] || stepRefs(args[args.length - 1] || "").find((ref) => entities.has(ref));
    if (!itemRef) continue;
    const styleRefs = stepRefs(args.slice(1).join(","));
    const colorRef = styleRefs.find((ref) => styleColors.has(ref));
    const color = styleColors.get(colorRef);
    if (color) itemColors.set(itemRef, color);
  }
  propagateStepRepresentationStyleMap(entities, itemColors, Boolean);
  return itemColors;
}

function stepStyledItemOpacities(entities) {
  const styleOpacities = stepStyleOpacities(entities);
  const itemOpacities = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "STYLED_ITEM") continue;
    const args = splitStepArguments(entity.args);
    const itemRef = stepRefs(args[0] || "")[0] || stepRefs(args[args.length - 1] || "").find((ref) => entities.has(ref));
    if (!itemRef) continue;
    const styleRefs = stepRefs(args.slice(1).join(","));
    const opacityRef = styleRefs.find((ref) => styleOpacities.has(ref));
    const opacity = styleOpacities.get(opacityRef);
    if (Number.isFinite(opacity)) itemOpacities.set(itemRef, opacity);
  }
  propagateStepRepresentationStyleMap(entities, itemOpacities, Number.isFinite);
  return itemOpacities;
}

function propagateStepRepresentationStyleMap(entities, itemValues, hasValue) {
  const shapeRepresentations = stepShapeRepresentationItems(entities);
  let changed = true;
  while (changed) {
    changed = false;
    const propagate = (parentRef, childRefs) => {
      const value = itemValues.get(parentRef);
      if (!hasValue(value)) return;
      for (const childRef of childRefs || []) {
        if (!childRef || hasValue(itemValues.get(childRef))) continue;
        itemValues.set(childRef, value);
        changed = true;
      }
    };

    for (const [representationRef, itemRefs] of shapeRepresentations.entries()) {
      propagate(representationRef, itemRefs);
    }
    for (const entity of entities.values()) {
      if (!STEP_REPRESENTATION_WRAPPER_TYPES.has(entity.type)) continue;
      propagate(entity.id, stepRefs(entity.args));
    }
  }
}

function stepItemColorResolver(entities) {
  const representationMaps = stepRepresentationMaps(entities);
  const colors = stepStyledItemColors(entities);
  const resolving = new Set();

  function resolve(ref) {
    if (!ref) return null;
    if (colors.has(ref)) return colors.get(ref);
    if (resolving.has(ref)) return null;
    const entity = entities.get(ref);
    if (!entity) return null;

    resolving.add(ref);
    let color = null;
    const refs = stepRefs(entity.args);
    if (STEP_REPRESENTATION_WRAPPER_TYPES.has(entity.type)) {
      color = refs.map((sourceRef) => resolve(sourceRef)).find(Boolean) || null;
    } else if (entity.type === "MAPPED_ITEM") {
      const sourceRef = refs.find((candidate) => representationMaps.has(candidate));
      const representationMap = representationMaps.get(sourceRef);
      color = (representationMap?.itemRefs || []).map((itemRef) => resolve(itemRef)).find(Boolean) || null;
    }
    resolving.delete(ref);

    if (color) colors.set(ref, color);
    return color;
  }

  return resolve;
}

function stepItemOpacityResolver(entities) {
  const representationMaps = stepRepresentationMaps(entities);
  const opacities = stepStyledItemOpacities(entities);
  const resolving = new Set();

  function resolve(ref) {
    if (!ref) return null;
    if (opacities.has(ref)) return opacities.get(ref);
    if (resolving.has(ref)) return null;
    const entity = entities.get(ref);
    if (!entity) return null;

    resolving.add(ref);
    let opacity = null;
    const refs = stepRefs(entity.args);
    if (STEP_REPRESENTATION_WRAPPER_TYPES.has(entity.type)) {
      opacity = refs.map((sourceRef) => resolve(sourceRef)).find((value) => Number.isFinite(value)) ?? null;
    } else if (entity.type === "MAPPED_ITEM") {
      const sourceRef = refs.find((candidate) => representationMaps.has(candidate));
      const representationMap = representationMaps.get(sourceRef);
      opacity = (representationMap?.itemRefs || []).map((itemRef) => resolve(itemRef)).find((value) => Number.isFinite(value)) ?? null;
    }
    resolving.delete(ref);

    if (Number.isFinite(opacity)) opacities.set(ref, opacity);
    return opacity;
  }

  return resolve;
}

function stepItemAppearanceResolver(entities) {
  const resolveColor = stepItemColorResolver(entities);
  const resolveOpacity = stepItemOpacityResolver(entities);
  return (ref) => ({
    color: resolveColor(ref),
    opacity: resolveOpacity(ref)
  });
}

function stepRepresentationItemGroupEntries(entities, directGroups) {
  const entries = new Map();
  for (const [itemRef, groups] of directGroups.entries()) {
    entries.set(itemRef, {
      groups,
      sourceRefs: new Set([itemRef])
    });
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities.values()) {
      if (!STEP_REPRESENTATION_WRAPPER_TYPES.has(entity.type) || entries.has(entity.id)) continue;
      const groups = [];
      const sourceRefs = new Set();
      for (const ref of stepRefs(entity.args)) {
        const entry = entries.get(ref);
        if (!entry) continue;
        groups.push(...entry.groups);
        for (const sourceRef of entry.sourceRefs) sourceRefs.add(sourceRef);
      }
      if (!groups.length) continue;
      entries.set(entity.id, { groups, sourceRefs });
      changed = true;
    }
  }

  return entries;
}

function stepShapeRepresentationItems(entities) {
  const representations = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "SHAPE_REPRESENTATION" && !entity.type.endsWith("_SHAPE_REPRESENTATION")) continue;
    const args = splitStepArguments(entity.args);
    const itemRefs = stepRefs(args[1] || "");
    if (itemRefs.length) representations.set(entity.id, itemRefs);
  }
  return representations;
}

function sourcePresentationLayer(prefix, name) {
  const layerName = String(name || "").trim();
  if (!layerName) return null;
  return {
    id: sanitizeId(`${prefix}_layer_${layerName}`, `${prefix}_layer`),
    name: layerName
  };
}

function stepPresentationLayerAssignments(entities) {
  const layers = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "PRESENTATION_LAYER_ASSIGNMENT") continue;
    const args = splitStepArguments(entity.args);
    const layer = sourcePresentationLayer("step", stepStringValue(args[0] || entity.args));
    if (!layer) continue;
    for (const ref of stepRefs(args[2] || entity.args)) {
      if (!layers.has(ref)) layers.set(ref, layer);
    }
  }
  return layers;
}

function stepPresentationLayerResolver(entities) {
  const layers = stepPresentationLayerAssignments(entities);
  const shapeRepresentations = stepShapeRepresentationItems(entities);
  const representationMaps = stepRepresentationMaps(entities);
  let changed = true;
  while (changed) {
    changed = false;
    const propagate = (parentRef, childRefs) => {
      const layer = layers.get(parentRef);
      if (!layer) return;
      for (const childRef of childRefs || []) {
        if (!childRef || layers.has(childRef)) continue;
        layers.set(childRef, layer);
        changed = true;
      }
    };

    for (const [representationRef, itemRefs] of shapeRepresentations.entries()) {
      propagate(representationRef, itemRefs);
    }
    for (const [mapRef, representationMap] of representationMaps.entries()) {
      propagate(mapRef, representationMap.itemRefs);
    }
    for (const entity of entities.values()) {
      if (!STEP_REPRESENTATION_WRAPPER_TYPES.has(entity.type)) continue;
      propagate(entity.id, stepRefs(entity.args));
    }
  }
  return (ref) => layers.get(ref) || null;
}

function stepRepresentationMaps(entities) {
  const shapeRepresentations = stepShapeRepresentationItems(entities);
  const axisPlacements = stepAxisPlacementTransforms(entities);
  const maps = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "REPRESENTATION_MAP") continue;
    const refs = stepRefs(entity.args);
    const originRef = refs.find((ref) => axisPlacements.has(ref));
    const representationRef = refs.find((ref) => shapeRepresentations.has(ref));
    const itemRefs = shapeRepresentations.get(representationRef) || [];
    if (itemRefs.length) {
      maps.set(entity.id, {
        transform: axisPlacements.get(originRef) || identityStepTransform(),
        itemRefs
      });
    }
  }
  return maps;
}

function stepMappedItemFaces(entities, faceGroups, diagnostics) {
  const representationMaps = stepRepresentationMaps(entities);
  const representationItemGroups = stepRepresentationItemGroupEntries(entities, faceGroups);
  const operators = stepCartesianTransformationOperators(entities);
  const invalidOperators = stepInvalidCartesianTransformationOperatorRefs(entities);
  const sourceItemRefs = new Set();
  const mappedFaces = [];
  let mappedCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "MAPPED_ITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidMappedEntries = representationMap.itemRefs
        .map((itemRef) => ({ itemRef, entry: representationItemGroups.get(itemRef) }))
        .filter(({ entry }) => entry);
      if (!invalidMappedEntries.length) continue;
      for (const { itemRef, entry } of invalidMappedEntries) {
        sourceItemRefs.add(itemRef);
        for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      }
      addDiagnostic(
        diagnostics,
        "warning",
        "step-mapped-item-invalid-transform-skipped",
        `STEP MAPPED_ITEM #${entity.id} references CARTESIAN_TRANSFORMATION_OPERATOR #${invalidTargetRef} with ${stepInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped mesh geometry.`
      );
      continue;
    }
    const transform = composeStepTransforms(operators.get(targetRef) || identityStepTransform(), representationMap.transform);
    const itemFaces = [];
    for (const itemRef of representationMap.itemRefs) {
      const entry = representationItemGroups.get(itemRef);
      if (!entry) continue;
      sourceItemRefs.add(itemRef);
      for (const sourceRef of entry.sourceRefs) sourceItemRefs.add(sourceRef);
      itemFaces.push(...transformStepFaces(entry.groups, transform));
    }
    if (itemFaces.length) {
      mappedCount += 1;
      mappedFaces.push(...itemFaces);
    }
  }

  if (mappedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-mapped-representation-applied",
      `Applied STEP MAPPED_ITEM representation maps to ${mappedCount} mapped item(s).`
    );
  }

  return { mappedFaces, sourceItemRefs };
}

function stepFaceRecords(sourceFaces, appearance, metadata = {}) {
  const color = typeof appearance === "string" ? appearance : appearance?.color;
  const opacity = canonicalOpacity(appearance?.opacity);
  const sourceLayer = metadata?.sourceLayer || null;
  return (sourceFaces || []).map((points) => ({
    points,
    color: color || STEP_DEFAULT_MESH_COLOR,
    ...(Number.isFinite(opacity) ? { opacity } : {}),
    ...(sourceLayer ? { sourceLayer } : {})
  }));
}

function styledSegmentRecords(sourceSegments, appearance, metadata = {}) {
  const color = typeof appearance === "string" ? appearance : appearance?.color;
  const opacity = canonicalOpacity(appearance?.opacity);
  const sourceLayer = metadata?.sourceLayer || null;
  return (sourceSegments || []).map((segment) => ({
    ...segment,
    ...(color ? { color } : {}),
    ...(Number.isFinite(opacity) ? { opacity } : {}),
    ...(sourceLayer ? { sourceLayer } : {})
  }));
}

function styledPointRecords(sourcePoints, appearance, metadata = {}) {
  const color = typeof appearance === "string" ? appearance : appearance?.color;
  const opacity = canonicalOpacity(appearance?.opacity);
  const sourceLayer = metadata?.sourceLayer || null;
  return (sourcePoints || []).map((point) => ({
    point,
    ...(color ? { color } : {}),
    ...(Number.isFinite(opacity) ? { opacity } : {}),
    ...(sourceLayer ? { sourceLayer } : {})
  }));
}

function appearanceWithOverride(sourceAppearance, overrideAppearance) {
  const sourceOpacity = canonicalOpacity(sourceAppearance?.opacity);
  const overrideOpacity = canonicalOpacity(overrideAppearance?.opacity);
  return {
    color: overrideAppearance?.color || sourceAppearance?.color || null,
    opacity: Number.isFinite(overrideOpacity) ? overrideOpacity : Number.isFinite(sourceOpacity) ? sourceOpacity : null
  };
}

function stepMappedItemFaceRecords(entities, faceGroups, diagnostics, resolveItemAppearance, resolveItemLayer = () => null) {
  const representationMaps = stepRepresentationMaps(entities);
  const representationItemGroups = stepRepresentationItemGroupEntries(entities, faceGroups);
  const operators = stepCartesianTransformationOperators(entities);
  const invalidOperators = stepInvalidCartesianTransformationOperatorRefs(entities);
  const sourceItemRefs = new Set();
  const mappedFaceRecords = [];
  let mappedCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "MAPPED_ITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidMappedEntries = representationMap.itemRefs
        .map((itemRef) => ({ itemRef, entry: representationItemGroups.get(itemRef) }))
        .filter(({ entry }) => entry);
      if (!invalidMappedEntries.length) continue;
      for (const { itemRef, entry } of invalidMappedEntries) {
        sourceItemRefs.add(itemRef);
        for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      }
      addDiagnostic(
        diagnostics,
        "warning",
        "step-mapped-item-invalid-transform-skipped",
        `STEP MAPPED_ITEM #${entity.id} references CARTESIAN_TRANSFORMATION_OPERATOR #${invalidTargetRef} with ${stepInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped mesh geometry.`
      );
      continue;
    }
    const transform = composeStepTransforms(operators.get(targetRef) || identityStepTransform(), representationMap.transform);
    const mappedAppearance = resolveItemAppearance(entity.id);
    const mappedLayer = resolveItemLayer(entity.id);
    let mappedItemHasFaces = false;
    for (const itemRef of representationMap.itemRefs) {
      const entry = representationItemGroups.get(itemRef);
      if (!entry) continue;
      sourceItemRefs.add(itemRef);
      for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      const itemFaces = transformStepFaces(entry.groups, transform);
      if (!itemFaces.length) continue;
      mappedItemHasFaces = true;
      mappedFaceRecords.push(...stepFaceRecords(
        itemFaces,
        appearanceWithOverride(resolveItemAppearance(itemRef), mappedAppearance),
        { sourceLayer: mappedLayer || resolveItemLayer(itemRef) }
      ));
    }
    if (mappedItemHasFaces) {
      mappedCount += 1;
    }
  }

  if (mappedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-mapped-representation-applied",
      `Applied STEP MAPPED_ITEM representation maps to ${mappedCount} mapped item(s).`
    );
  }

  return { mappedFaceRecords, sourceItemRefs };
}

function stepMappedItemLoops(entities, loopGroups) {
  const representationMaps = stepRepresentationMaps(entities);
  const representationItemGroups = stepRepresentationItemGroupEntries(entities, loopGroups);
  const operators = stepCartesianTransformationOperators(entities);
  const sourceItemRefs = new Set();
  const mappedLoops = [];

  for (const entity of entities.values()) {
    if (entity.type !== "MAPPED_ITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    const transform = composeStepTransforms(operators.get(targetRef) || identityStepTransform(), representationMap.transform);
    for (const itemRef of representationMap.itemRefs) {
      const entry = representationItemGroups.get(itemRef);
      if (!entry) continue;
      sourceItemRefs.add(itemRef);
      for (const sourceRef of entry.sourceRefs) sourceItemRefs.add(sourceRef);
      mappedLoops.push(...transformStepFaces(entry.groups, transform));
    }
  }

  return { mappedLoops, sourceItemRefs };
}

function stepMappedItemSegments(entities, segmentGroups, diagnostics, resolveItemAppearance, resolveItemLayer = () => null) {
  const representationMaps = stepRepresentationMaps(entities);
  const representationItemGroups = stepRepresentationItemGroupEntries(entities, segmentGroups);
  const operators = stepCartesianTransformationOperators(entities);
  const invalidOperators = stepInvalidCartesianTransformationOperatorRefs(entities);
  const sourceItemRefs = new Set();
  const mappedSegments = [];
  let mappedCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "MAPPED_ITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidMappedEntries = representationMap.itemRefs
        .map((itemRef) => ({ itemRef, entry: representationItemGroups.get(itemRef) }))
        .filter(({ entry }) => entry);
      if (!invalidMappedEntries.length) continue;
      for (const { itemRef, entry } of invalidMappedEntries) {
        sourceItemRefs.add(itemRef);
        for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      }
      addDiagnostic(
        diagnostics,
        "warning",
        "step-mapped-item-invalid-transform-skipped",
        `STEP MAPPED_ITEM #${entity.id} references CARTESIAN_TRANSFORMATION_OPERATOR #${invalidTargetRef} with ${stepInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped curve linework.`
      );
      continue;
    }
    const transform = composeStepTransforms(operators.get(targetRef) || identityStepTransform(), representationMap.transform);
    const mappedAppearance = resolveItemAppearance(entity.id);
    const mappedLayer = resolveItemLayer(entity.id);
    for (const itemRef of representationMap.itemRefs) {
      const entry = representationItemGroups.get(itemRef);
      if (!entry) continue;
      sourceItemRefs.add(itemRef);
      for (const sourceRef of entry.sourceRefs) sourceItemRefs.add(sourceRef);
      mappedSegments.push(...styledSegmentRecords(
        transformStepSegments(entry.groups, transform),
        appearanceWithOverride(resolveItemAppearance(itemRef), mappedAppearance),
        { sourceLayer: mappedLayer || resolveItemLayer(itemRef) }
      ));
      mappedCount += 1;
    }
  }

  if (mappedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-mapped-curve-linework-applied",
      `Applied STEP MAPPED_ITEM representation maps to ${mappedCount} curve linework item(s).`
    );
  }
  return { mappedSegments, sourceItemRefs };
}

function stepMappedItemPoints(entities, pointGroups, diagnostics, resolveItemAppearance, resolveItemLayer = () => null) {
  const representationMaps = stepRepresentationMaps(entities);
  const representationItemGroups = stepRepresentationItemGroupEntries(entities, pointGroups);
  const operators = stepCartesianTransformationOperators(entities);
  const invalidOperators = stepInvalidCartesianTransformationOperatorRefs(entities);
  const sourceItemRefs = new Set();
  const mappedPointRecords = [];
  let mappedCount = 0;
  let mappedPointCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "MAPPED_ITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidMappedEntries = representationMap.itemRefs
        .map((itemRef) => ({ itemRef, entry: representationItemGroups.get(itemRef) }))
        .filter(({ entry }) => entry);
      if (!invalidMappedEntries.length) continue;
      for (const { itemRef, entry } of invalidMappedEntries) {
        sourceItemRefs.add(itemRef);
        for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      }
      addDiagnostic(
        diagnostics,
        "warning",
        "step-mapped-item-invalid-transform-skipped",
        `STEP MAPPED_ITEM #${entity.id} references CARTESIAN_TRANSFORMATION_OPERATOR #${invalidTargetRef} with ${stepInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped point geometry.`
      );
      continue;
    }
    const transform = composeStepTransforms(operators.get(targetRef) || identityStepTransform(), representationMap.transform);
    const mappedAppearance = resolveItemAppearance(entity.id);
    const mappedLayer = resolveItemLayer(entity.id);
    let mappedItemHasPoints = false;
    for (const itemRef of representationMap.itemRefs) {
      const entry = representationItemGroups.get(itemRef);
      if (!entry) continue;
      sourceItemRefs.add(itemRef);
      for (const sourceItemRef of entry.sourceRefs) sourceItemRefs.add(sourceItemRef);
      const itemPoints = transformStepPoints(entry.groups, transform).filter(finiteVec3);
      if (!itemPoints.length) continue;
      mappedItemHasPoints = true;
      mappedPointCount += itemPoints.length;
      mappedPointRecords.push(...styledPointRecords(
        itemPoints,
        appearanceWithOverride(resolveItemAppearance(itemRef), mappedAppearance),
        { sourceLayer: mappedLayer || resolveItemLayer(itemRef) }
      ));
    }
    if (mappedItemHasPoints) mappedCount += 1;
  }

  if (mappedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "step-mapped-vertex-points-applied",
      `Applied STEP MAPPED_ITEM representation maps to ${mappedPointCount} standalone VERTEX_POINT item(s) from ${mappedCount} mapped item(s).`
    );
  }

  return { mappedPointRecords, sourceItemRefs };
}

function stepStandaloneVertexPointRecords(entities, diagnostics = []) {
  const pointGroups = stepStandaloneVertexPointGroups(entities, diagnostics);
  const resolveItemAppearance = stepItemAppearanceResolver(entities);
  const resolveItemLayer = stepPresentationLayerResolver(entities);
  const { mappedPointRecords, sourceItemRefs } = stepMappedItemPoints(entities, pointGroups, diagnostics, resolveItemAppearance, resolveItemLayer);
  const directPointRecords = [...pointGroups.entries()]
    .filter(([itemRef]) => !sourceItemRefs.has(itemRef))
    .flatMap(([itemRef, points]) => styledPointRecords(points, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
  const records = [];
  for (const record of [...mappedPointRecords, ...directPointRecords]) {
    if (!finiteVec3(record.point)) continue;
    if (records.some((candidate) => samePoint(candidate.point, record.point))) continue;
    records.push(record);
  }
  return records;
}

function stepTranslatedFacetedFaces(entities, diagnostics) {
  return stepTranslatedFacetedFaceRecords(entities, diagnostics).map((record) => record.points);
}

function stepTranslatedFacetedFaceRecords(entities, diagnostics) {
  const faceGroups = stepFacetedFaceGroups(entities, diagnostics);
  const resolveItemAppearance = stepItemAppearanceResolver(entities);
  const resolveItemLayer = stepPresentationLayerResolver(entities);
  const { mappedFaceRecords, sourceItemRefs } = stepMappedItemFaceRecords(entities, faceGroups, diagnostics, resolveItemAppearance, resolveItemLayer);
  const directFaceRecords = [];
  for (const [itemRef, faces] of faceGroups.entries()) {
    if (sourceItemRefs.has(itemRef)) continue;
    directFaceRecords.push(...stepFaceRecords(faces, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
  }
  return [...directFaceRecords, ...mappedFaceRecords];
}

function stepTranslatedInnerBoundLoops(entities, diagnostics) {
  const loopGroups = new Map([
    ...stepPolyLoopInnerBoundGroups(entities, diagnostics),
    ...stepPolygonalVoidLoopGroups(entities, diagnostics),
    ...stepExtrudedSolidVoidLoopGroups(entities, diagnostics),
    ...stepRevolvedSolidVoidLoopGroups(entities, diagnostics)
  ]);
  const { mappedLoops, sourceItemRefs } = stepMappedItemLoops(entities, loopGroups);
  const directLoops = [];
  for (const [itemRef, loops] of loopGroups.entries()) {
    if (sourceItemRefs.has(itemRef)) continue;
    directLoops.push(...loops);
  }
  return [...directLoops, ...mappedLoops];
}

function stepTranslatedCurveSegments(entities, diagnostics) {
  const internalCurveRefs = stepInternalCurveRefs(entities);
  const compositeSourceRefs = stepCompositeSourceCurveRefs(entities);
  const segmentGroups = stepCurveSegmentGroups(entities, diagnostics);
  const resolveItemAppearance = stepItemAppearanceResolver(entities);
  const resolveItemLayer = stepPresentationLayerResolver(entities);
  const { mappedSegments, sourceItemRefs } = stepMappedItemSegments(entities, segmentGroups, diagnostics, resolveItemAppearance, resolveItemLayer);
  const directSegments = [];
  for (const [itemRef, segments] of segmentGroups.entries()) {
    if (sourceItemRefs.has(itemRef)) continue;
    if (compositeSourceRefs.has(itemRef)) continue;
    if (internalCurveRefs.has(itemRef)) continue;
    directSegments.push(...styledSegmentRecords(segments, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
  }
  return [...directSegments, ...mappedSegments];
}

function detectStepUnits(text, diagnostics) {
  const entities = parseStepEntities(text);
  const lengthUnitStatements = stepStatements(text).filter((statement) => /\bLENGTH_UNIT\b/i.test(statement));
  for (const statement of lengthUnitStatements) {
    const conversionMatch = statement.match(/CONVERSION_BASED_UNIT\s*\(\s*'((?:''|[^'])*)'\s*,\s*#(\d+)/i);
    if (!conversionMatch) continue;
    const declared = conversionMatch[1].replace(/''/g, "'");
    const units = canonicalUnitsFromLengthLabel(declared);
    if (units) return units;
    const factorUnits = canonicalUnitsFromMetreConversionFactor(conversionMeasureFactor(entities.get(conversionMatch[2])));
    if (factorUnits) return factorUnits;
    reportUnsupportedDeclaredUnits(diagnostics, "step-units-unsupported", "STEP file", declared);
    return null;
  }

  for (const statement of lengthUnitStatements) {
    const siMatch = statement.match(/SI_UNIT\s*\(\s*(\$|\.[A-Z_]+\.)\s*,\s*\.METRE\.\s*\)/i);
    if (!siMatch) continue;
    const units = canonicalUnitsFromSiMetrePrefix(siMatch[1]);
    if (units) return units;
    reportUnsupportedDeclaredUnits(diagnostics, "step-units-unsupported", "STEP file", siMatch[1]);
    return null;
  }

  return null;
}

function translateStepText(text, options = {}) {
  const entities = parseStepEntities(text);
  assertStepEntitySource(entities, "STEP", "STEP");
  const diagnostics = [];
  const assetUnits = resolveDetectedUnits({
    explicitUnits: options.units,
    detectedUnits: detectStepUnits(text, diagnostics),
    diagnostics,
    codePrefix: "step",
    sourceLabel: "STEP file"
  });
  const meshSets = new Map();
  const stepMeshSourceLayers = new Map();
  for (const record of stepTranslatedFacetedFaceRecords(entities, diagnostics)) {
    const color = record.color || STEP_DEFAULT_MESH_COLOR;
    const opacity = canonicalOpacity(record.opacity);
    const sourceLayer = record.sourceLayer || null;
    const layer = sourceLayer?.id || "step_mesh";
    if (sourceLayer) stepMeshSourceLayers.set(sourceLayer.id, sourceLayer);
    const key = geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity);
    if (!meshSets.has(key)) {
      meshSets.set(key, {
        layer,
        color,
        opacity,
        vertices: [],
        faces: [],
        indexByPoint: new Map()
      });
    }
    addStepMeshFace(meshSets.get(key), record.points);
  }
  const meshes = [...meshSets.values()].filter((meshSet) => meshSet.faces.length);
  const meshLayerIds = [...new Set(meshes.map((meshSet) => meshSet.layer || "step_mesh"))]
    .sort((left, right) => (left === "step_mesh" ? -1 : right === "step_mesh" ? 1 : left.localeCompare(right)));
  const meshFaceCount = meshes.reduce((total, meshSet) => total + meshSet.faces.length, 0);
  const lineSets = new Map();
  for (const loop of stepTranslatedInnerBoundLoops(entities, diagnostics)) {
    addPolyline(lineSets, "step_inner_bounds", "#0f766e", loop, true);
  }
  const stepCurveSourceLayers = new Map();
  for (const segment of stepTranslatedCurveSegments(entities, diagnostics)) {
    const sourceLayer = segment?.sourceLayer || null;
    const layer = sourceLayer?.id || "step_curve_linework";
    if (sourceLayer) stepCurveSourceLayers.set(sourceLayer.id, sourceLayer);
    addAppearanceLineSegment(lineSets, layer, "#9333ea", segment);
  }
  const stepPointSets = new Map();
  const stepPointSourceLayers = new Map();
  for (const record of stepStandaloneVertexPointRecords(entities, diagnostics)) {
    const color = record.color || "#2563eb";
    const opacity = canonicalOpacity(record.opacity);
    const sourceLayer = record.sourceLayer || null;
    const layer = sourceLayer?.id || "step_points";
    if (sourceLayer) stepPointSourceLayers.set(sourceLayer.id, sourceLayer);
    const key = geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity);
    if (!stepPointSets.has(key)) {
      stepPointSets.set(key, {
        layer,
        points: [],
        color,
        opacity
      });
    }
    stepPointSets.get(key).points.push(record.point);
  }
  const stepPointSetEntries = [...stepPointSets.values()]
    .filter((pointSet) => pointSet.points.length)
    .sort((left, right) => (
      String(left.layer || "").localeCompare(String(right.layer || ""))
      || String(left.color || "").localeCompare(String(right.color || ""))
      || String(Number.isFinite(left.opacity) ? left.opacity : "").localeCompare(String(Number.isFinite(right.opacity) ? right.opacity : ""))
    ));
  const pointLayerIds = [...new Set(stepPointSetEntries.map((pointSet) => pointSet.layer || "step_points"))]
    .sort((left, right) => (left === "step_points" ? -1 : right === "step_points" ? 1 : left.localeCompare(right)));
  const innerBoundLineSets = sortedLineSetsForLayer(lineSets, "step_inner_bounds");
  const curveLayerIds = [...new Set([...lineSets.values()]
    .filter((lineSet) => lineSet.layer !== "step_inner_bounds" && lineSet.lineSegments.length)
    .map((lineSet) => lineSet.layer))]
    .sort((left, right) => (left === "step_curve_linework" ? -1 : right === "step_curve_linework" ? 1 : left.localeCompare(right)));
  const curveLineSets = curveLayerIds.flatMap((layer) => sortedLineSetsForLayer(lineSets, layer));

  const layers = {
    step_mesh: {
      id: "step_mesh",
      name: "STEP Mesh",
      display: {
        color: "#64748b",
        edgeColor: "#334155",
        opacity: 0.34
      }
    }
  };
  for (const layerId of meshLayerIds.filter((layerId) => layerId !== "step_mesh")) {
    const sourceLayer = stepMeshSourceLayers.get(layerId);
    const firstMesh = meshes.find((meshSet) => meshSet.layer === layerId);
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `STEP Layer: ${sourceLayer.name}` : "STEP Mesh",
      display: {
        color: firstMesh?.color || "#64748b",
        edgeColor: "#334155",
        opacity: Number.isFinite(firstMesh?.opacity) ? firstMesh.opacity : 0.34
      }
    };
  }
  if (innerBoundLineSets.length) {
    layers.step_inner_bounds = {
      id: "step_inner_bounds",
      name: "STEP Inner Bounds",
      display: {
        color: "#0f766e"
      }
    };
  }
  for (const layerId of curveLayerIds) {
    const sourceLayer = stepCurveSourceLayers.get(layerId);
    const firstLineSet = sortedLineSetsForLayer(lineSets, layerId)[0];
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `STEP Layer: ${sourceLayer.name}` : "STEP Curve Linework",
      display: {
        color: firstLineSet?.color || "#9333ea"
      }
    };
  }
  for (const layerId of pointLayerIds) {
    const sourceLayer = stepPointSourceLayers.get(layerId);
    const firstPointSet = stepPointSetEntries.find((pointSet) => pointSet.layer === layerId);
    if (layers[layerId]) continue;
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `STEP Layer: ${sourceLayer.name}` : "STEP Points",
      display: {
        color: firstPointSet?.color || "#2563eb"
      }
    };
  }
  const objects = {};
  meshes.forEach((meshSet, index) => {
    const baseId = meshSet.layer === "step_mesh" ? "step_faceted_mesh" : `step_faceted_mesh_${meshSet.layer}`;
    const id = index === 0 && baseId === "step_faceted_mesh"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "step_faceted_mesh");
    const layerName = layers[meshSet.layer]?.name || "STEP Mesh";
    const name = meshSet.layer === "step_mesh"
      ? index === 0 ? "STEP faceted mesh" : `STEP faceted mesh ${index + 1}`
      : `${layerName} mesh`;
    const object = meshObject(id, name, meshSet.layer, meshSet);
    object.display.edgeColor = "#334155";
    object.display.opacity = Number.isFinite(meshSet.opacity) ? meshSet.opacity : 0.34;
    object.metadata = {
      sourceEntity: "STEP-FACETED-MESH"
    };
    objects[id] = object;
  });
  innerBoundLineSets.forEach((lineSet, index) => {
    const id = index === 0 ? "step_inner_bound_linework" : `step_inner_bound_linework_${index + 1}`;
    objects[id] = lineObject(id, index === 0 ? "STEP inner boundary linework" : `STEP inner boundary linework ${index + 1}`, "step_inner_bounds", lineSet);
  });
  curveLineSets.forEach((lineSet, index) => {
    const baseId = lineSet.layer === "step_curve_linework" ? "step_curve_linework" : `step_curve_linework_${lineSet.layer}`;
    const id = index === 0 && baseId === "step_curve_linework"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "step_curve_linework");
    const layerName = layers[lineSet.layer]?.name || "STEP Curve Linework";
    const name = lineSet.layer === "step_curve_linework"
      ? index === 0 ? "STEP curve linework" : `STEP curve linework ${index + 1}`
      : `${layerName} curve linework`;
    objects[id] = lineObject(id, name, lineSet.layer, lineSet);
  });
  stepPointSetEntries.forEach((pointSet, index) => {
    const baseId = pointSet.layer === "step_points" ? "step_vertex_points" : `step_vertex_points_${pointSet.layer}`;
    const id = index === 0 && baseId === "step_vertex_points"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "step_vertex_points");
    const layerName = layers[pointSet.layer]?.name || "STEP Points";
    const name = pointSet.layer === "step_points"
      ? index === 0 ? "STEP vertex points" : `STEP vertex points ${index + 1}`
      : `${layerName} points`;
    const object = pointObject(id, name, pointSet.layer, pointSet);
    object.metadata = {
      sourceEntity: "STEP-VERTEX-POINT"
    };
    objects[id] = object;
  });
  if (!meshFaceCount && !innerBoundLineSets.length && !curveLineSets.length && !stepPointSetEntries.length) {
    addDiagnostic(
      diagnostics,
      "warning",
      "step-no-supported-faceted-geometry",
      "STEP file did not contain supported POLY_LOOP, EDGE_LOOP, TRIANGULATED_FACE_SET, POLYGONAL_FACE_SET, standalone VERTEX_POINT point geometry, POLYLINE/COMPOSITE_CURVE/CIRCLE/ELLIPSE/B_SPLINE_CURVE_WITH_KNOTS/RATIONAL_B_SPLINE_CURVE/TRIMMED_CURVE-over-LINE/TRIMMED_CURVE-over-B_SPLINE curve linework, or supported EXTRUDED_AREA_SOLID/EXTRUDED_AREA_SOLID_TAPERED/REVOLVED_AREA_SOLID/SWEPT_DISK_SOLID geometry; use an external tessellator adapter for full CAD solids."
    );
  }

  const sourceFileName = options.sourceFileName || "source.step";
  const assetId = normalizedExplicitReferenceAssetId(options.assetId) || sanitizeId(path.basename(sourceFileName, path.extname(sourceFileName)), "step_reference");
  const allPoints = meshes.flatMap((meshSet) => meshSet.vertices);
  for (const lineSet of [...innerBoundLineSets, ...curveLineSets]) allPoints.push(...lineSet.vertices);
  for (const pointSet of stepPointSetEntries) allPoints.push(...pointSet.points);
  return {
    $schema: options.schemaRef || "../../app/schemas/reference-geometry.schema.json",
    schema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    schemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    asset: {
      id: assetId,
      name: options.name || path.basename(sourceFileName),
      source: withSourceFileMetadata({
        format: "step",
        fileName: path.basename(sourceFileName),
        checksum: checksum(text),
        translator: "tools/reference-geometry/translate_reference_geometry.mjs",
        translatorVersion: "0.1.0"
      }, options),
      units: assetUnits,
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: boundsFor(allPoints)
    },
    layers,
    objects,
    chunks: [],
    diagnostics
  };
}

function ifcCartesianPoints(entities) {
  const points = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCARTESIANPOINT") continue;
    const { tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    if (!tuple) continue;
    points.set(entity.id, vec3(tuple[0], tuple[1], tuple[2] || 0));
  }
  return points;
}

function ifcInvalidCartesianPointRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCARTESIANPOINT") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 2);
    if (invalidTupleCount > 0 || !tuples.length) refs.add(entity.id);
  }
  return refs;
}

function ifcPointLists(entities) {
  const pointLists = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCARTESIANPOINTLIST2D" && entity.type !== "IFCCARTESIANPOINTLIST3D") continue;
    const minLength = entity.type === "IFCCARTESIANPOINTLIST3D" ? 3 : 2;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, minLength);
    if (invalidTupleCount > 0) continue;
    const points = tuples.map((tuple) => vec3(tuple[0], tuple[1], tuple[2] || 0));
    if (points.length) pointLists.set(entity.id, points);
  }
  return pointLists;
}

function ifcInvalidPointListRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCARTESIANPOINTLIST2D" && entity.type !== "IFCCARTESIANPOINTLIST3D") continue;
    const minLength = entity.type === "IFCCARTESIANPOINTLIST3D" ? 3 : 2;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, minLength);
    if (invalidTupleCount > 0 || !tuples.length) refs.add(entity.id);
  }
  return refs;
}

function ifcDirectionVectors(entities) {
  const directions = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCDIRECTION") continue;
    const { tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    if (!tuple) continue;
    directions.set(entity.id, vecUnit(vec3(tuple[0], tuple[1], tuple[2] || 0), [1, 0, 0]));
  }
  return directions;
}

function ifcInvalidDirectionRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCDIRECTION") continue;
    const { invalidTupleCount, tuples } = stepNumberTuplesDetailed(entity.args, 2);
    const tuple = tuples[0] || null;
    const zeroLengthDirection = tuple ? vecLength(vec3(tuple[0], tuple[1], tuple[2] || 0)) <= 1e-9 : false;
    if (invalidTupleCount > 0 || !tuples.length || zeroLengthDirection) refs.add(entity.id);
  }
  return refs;
}

function identityIfcTransform() {
  return {
    origin: [0, 0, 0],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0],
    axisZ: [0, 0, 1]
  };
}

function ifcTransformPoint(transform, point) {
  return vecAdd(
    transform.origin,
    vecAdd(vecAdd(vecMul(transform.axisX, point[0]), vecMul(transform.axisY, point[1])), vecMul(transform.axisZ, point[2]))
  );
}

function ifcTransformVector(transform, vector) {
  return vecAdd(vecAdd(vecMul(transform.axisX, vector[0]), vecMul(transform.axisY, vector[1])), vecMul(transform.axisZ, vector[2]));
}

function transformIfcFaces(faces, transform) {
  return faces.map((face) => face.map((point) => ifcTransformPoint(transform, point)));
}

function ifcFaceEntryPoints(entry) {
  return Array.isArray(entry?.points) ? entry.points : entry;
}

function ifcFaceEntryAppearance(entry) {
  if (!entry || !Array.isArray(entry.points)) return {};
  return {
    color: entry.color,
    opacity: canonicalOpacity(entry.opacity),
    sourceLayer: entry.sourceLayer || null
  };
}

function ifcFaceEntry(points, appearance = null) {
  const color = appearance?.color;
  const opacity = canonicalOpacity(appearance?.opacity);
  const sourceLayer = appearance?.sourceLayer || null;
  if (!color && !Number.isFinite(opacity) && !sourceLayer) return points;
  return {
    points,
    ...(color ? { color } : {}),
    ...(Number.isFinite(opacity) ? { opacity } : {}),
    ...(sourceLayer ? { sourceLayer } : {})
  };
}

function ifcFaceEntriesWithSourceLayer(entries, sourceLayer) {
  if (!sourceLayer) return entries || [];
  return (entries || []).map((entry) => ifcFaceEntry(ifcFaceEntryPoints(entry), {
    ...ifcFaceEntryAppearance(entry),
    sourceLayer
  }));
}

function transformIfcFaceEntries(entries, transform) {
  return (entries || []).map((entry) => {
    const points = ifcFaceEntryPoints(entry);
    const transformed = (points || []).map((point) => ifcTransformPoint(transform, point));
    return ifcFaceEntry(transformed, ifcFaceEntryAppearance(entry));
  });
}

function transformIfcSegments(segments, transform) {
  return segments.map((segment) => ({
    ...segment,
    start: ifcTransformPoint(transform, segment.start),
    end: ifcTransformPoint(transform, segment.end)
  }));
}

function transformIfcPoints(points, transform) {
  return (points || []).map((point) => ifcTransformPoint(transform, point));
}

function composeIfcTransforms(parent, local) {
  return {
    origin: ifcTransformPoint(parent, local.origin),
    axisX: ifcTransformVector(parent, local.axisX),
    axisY: ifcTransformVector(parent, local.axisY),
    axisZ: ifcTransformVector(parent, local.axisZ)
  };
}

function ifcAxisPlacementTransforms(entities) {
  const points = ifcCartesianPoints(entities);
  const directions = ifcDirectionVectors(entities);
  const placements = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCAXIS2PLACEMENT3D" && entity.type !== "IFCAXIS2PLACEMENT2D") continue;
    const refs = stepRefs(entity.args);
    const origin = points.get(refs[0]) || [0, 0, 0];
    const axisZ = entity.type === "IFCAXIS2PLACEMENT2D" ? [0, 0, 1] : vecUnit(directions.get(refs[1]) || [0, 0, 1], [0, 0, 1]);
    const refDirectionRef = entity.type === "IFCAXIS2PLACEMENT2D" ? refs[1] : refs[2];
    let axisX = vecUnit(directions.get(refDirectionRef) || [1, 0, 0], [1, 0, 0]);
    let axisY = vecUnit(vecCross(axisZ, axisX), [0, 1, 0]);
    axisX = vecUnit(vecCross(axisY, axisZ), axisX);
    placements.set(entity.id, { origin, axisX, axisY, axisZ });
  }
  return placements;
}

function ifcInvalidAxisPlacementRefs(entities) {
  const invalidPointRefs = ifcInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const placementRefs = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCAXIS2PLACEMENT3D" && entity.type !== "IFCAXIS2PLACEMENT2D") continue;
    const args = splitStepArguments(entity.args);
    const originRef = stepRefs(args[0] || "").find((ref) => invalidPointRefs.has(ref));
    if (originRef) {
      placementRefs.set(entity.id, { kind: "point", ref: originRef });
      continue;
    }
    const explicitDirectionRefs = entity.type === "IFCAXIS2PLACEMENT2D"
      ? stepRefs(args[1] || "")
      : [...stepRefs(args[1] || ""), ...stepRefs(args[2] || "")];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      placementRefs.set(entity.id, { kind: "direction", ref: invalidDirectionRef });
      continue;
    }
    const axisZRef = entity.type === "IFCAXIS2PLACEMENT3D" ? stepRefs(args[1] || "")[0] : null;
    const axisXRef = entity.type === "IFCAXIS2PLACEMENT2D" ? stepRefs(args[1] || "")[0] : stepRefs(args[2] || "")[0];
    const axisZ = entity.type === "IFCAXIS2PLACEMENT2D" ? [0, 0, 1] : vecUnit(directions.get(axisZRef) || [0, 0, 1], [0, 0, 1]);
    const axisX = vecUnit(directions.get(axisXRef) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecCross(axisZ, axisX);
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) placementRefs.set(entity.id, { kind: "basis" });
  }
  return placementRefs;
}

function ifcInvalidAxisPlacementDetailText(detail) {
  const ref = detail?.ref || "?";
  if (detail?.kind === "direction") return `invalid IFCDIRECTION #${ref}`;
  if (detail?.kind === "basis") return "degenerate placement basis";
  return `malformed IFCCARTESIANPOINT #${ref}`;
}

function ifcAxis1Placements(entities) {
  const points = ifcCartesianPoints(entities);
  const directions = ifcDirectionVectors(entities);
  const placements = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCAXIS1PLACEMENT") continue;
    const refs = stepRefs(entity.args);
    placements.set(entity.id, {
      origin: points.get(refs[0]) || [0, 0, 0],
      axis: vecUnit(directions.get(refs[1]) || [0, 0, 1], [0, 0, 1])
    });
  }
  return placements;
}

function ifcInvalidAxis1PlacementRefs(entities) {
  const points = ifcCartesianPoints(entities);
  const invalidPointRefs = ifcInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const placementRefs = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCAXIS1PLACEMENT") continue;
    const args = splitStepArguments(entity.args);
    const originRefs = stepRefs(args[0] || "");
    const originRef = originRefs[0] || null;
    if (originRef && invalidPointRefs.has(originRef)) {
      placementRefs.set(entity.id, { kind: "point", ref: originRef });
      continue;
    }
    if (!originRefs.some((ref) => points.has(ref))) {
      placementRefs.set(entity.id, { kind: "point-missing" });
      continue;
    }
    const directionRefs = stepRefs(args[1] || "");
    const invalidDirectionRef = directionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      placementRefs.set(entity.id, { kind: "direction", ref: invalidDirectionRef });
      continue;
    }
    if (directionRefs.length && !directionRefs.some((ref) => directions.has(ref))) {
      placementRefs.set(entity.id, { kind: "direction-missing" });
    }
  }
  return placementRefs;
}

function ifcInvalidAxis1PlacementDetailText(detail) {
  const ref = detail?.ref || "?";
  if (detail?.kind === "direction") return `invalid IFCDIRECTION #${ref}`;
  if (detail?.kind === "direction-missing") return "missing valid IFCDIRECTION";
  if (detail?.kind === "point-missing") return "missing valid IFCCARTESIANPOINT";
  return `malformed IFCCARTESIANPOINT #${ref}`;
}

function ifcInvalidLocalPlacementRefs(entities) {
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidAxisPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const placementRefs = new Map();
  const localPlacementEntities = new Map();
  const parentPlacementRefs = new Map();

  for (const entity of entities.values()) {
    if (entity.type !== "IFCLOCALPLACEMENT") continue;
    localPlacementEntities.set(entity.id, entity);
  }

  for (const entity of localPlacementEntities.values()) {
    const args = splitStepArguments(entity.args);
    const relativePlacementRefs = stepRefs(args[1] || "");
    const invalidRelativePlacementRef = relativePlacementRefs.find((ref) => invalidAxisPlacementRefs.has(ref));
    if (invalidRelativePlacementRef) {
      placementRefs.set(entity.id, {
        kind: "relative-placement",
        ref: invalidRelativePlacementRef,
        detail: invalidAxisPlacementRefs.get(invalidRelativePlacementRef)
      });
      continue;
    }
    if (!relativePlacementRefs.some((ref) => axisPlacements.has(ref))) {
      placementRefs.set(entity.id, { kind: "relative-placement-missing" });
      continue;
    }
    const parentRefs = stepRefs(args[0] || "");
    const parentPlacementRef = parentRefs.find((ref) => localPlacementEntities.has(ref) || entities.get(ref)?.type === "IFCLOCALPLACEMENT");
    if (parentPlacementRef) parentPlacementRefs.set(entity.id, parentPlacementRef);
    if (parentRefs.length && !parentRefs.some((ref) => localPlacementEntities.has(ref) || entities.get(ref)?.type === "IFCLOCALPLACEMENT")) {
      placementRefs.set(entity.id, { kind: "parent-placement-missing" });
    }
  }

  for (const entity of localPlacementEntities.values()) {
    if (placementRefs.has(entity.id)) continue;
    const seen = new Map();
    let currentRef = entity.id;
    while (currentRef && localPlacementEntities.has(currentRef) && !placementRefs.has(currentRef)) {
      if (seen.has(currentRef)) {
        const cycleRefs = [...seen.keys()].slice(seen.get(currentRef));
        for (const cycleRef of cycleRefs) {
          placementRefs.set(cycleRef, { kind: "parent-placement-cycle", ref: parentPlacementRefs.get(cycleRef) || cycleRef });
        }
        break;
      }
      seen.set(currentRef, seen.size);
      currentRef = parentPlacementRefs.get(currentRef);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of localPlacementEntities.values()) {
      if (placementRefs.has(entity.id)) continue;
      const parentRef = parentPlacementRefs.get(entity.id);
      if (parentRef && placementRefs.has(parentRef)) {
        placementRefs.set(entity.id, { kind: "parent-placement", ref: parentRef, detail: placementRefs.get(parentRef) });
        changed = true;
      }
    }
  }

  return placementRefs;
}

function ifcInvalidLocalPlacementDetailText(detail) {
  if (detail?.kind === "relative-placement") {
    return `relative IFCAXIS2PLACEMENT #${detail.ref || "?"} with ${ifcInvalidAxisPlacementDetailText(detail.detail)}`;
  }
  if (detail?.kind === "relative-placement-missing") return "missing valid relative IFCAXIS2PLACEMENT";
  if (detail?.kind === "parent-placement-cycle") return `cyclic parent IFCLOCALPLACEMENT #${detail.ref || "?"}`;
  if (detail?.kind === "parent-placement") return `invalid parent IFCLOCALPLACEMENT #${detail.ref || "?"}`;
  if (detail?.kind === "parent-placement-missing") return "missing valid parent IFCLOCALPLACEMENT";
  return "invalid IFCLOCALPLACEMENT";
}

function ifcLocalPlacementTransforms(entities) {
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidLocalPlacementRefs = ifcInvalidLocalPlacementRefs(entities);
  const localPlacements = new Map();
  const resolving = new Set();

  function resolvePlacement(placementRef) {
    if (!placementRef) return identityIfcTransform();
    if (localPlacements.has(placementRef)) return localPlacements.get(placementRef);
    if (invalidLocalPlacementRefs.has(placementRef)) return null;
    const entity = entities.get(placementRef);
    if (!entity || entity.type !== "IFCLOCALPLACEMENT" || resolving.has(placementRef)) return null;
    resolving.add(placementRef);
    const refs = stepRefs(entity.args);
    const relativePlacementRef = refs.find((ref) => axisPlacements.has(ref));
    const parentPlacementRef = refs.find((ref) => ref !== relativePlacementRef && entities.get(ref)?.type === "IFCLOCALPLACEMENT");
    const parent = resolvePlacement(parentPlacementRef);
    const local = axisPlacements.get(relativePlacementRef) || identityIfcTransform();
    if (!parent) {
      resolving.delete(placementRef);
      return null;
    }
    const transform = composeIfcTransforms(parent, local);
    resolving.delete(placementRef);
    localPlacements.set(placementRef, transform);
    return transform;
  }

  for (const entity of entities.values()) {
    if (entity.type === "IFCLOCALPLACEMENT") resolvePlacement(entity.id);
  }
  return localPlacements;
}

function ifcCartesianTransformationOperators(entities) {
  const points = ifcCartesianPoints(entities);
  const invalidPointRefs = ifcInvalidCartesianPointRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const operators = new Map();
  for (const entity of entities.values()) {
    const is2d = entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR2D" || entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM";
    const is3d = entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR3D" || entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM";
    if (!is2d && !is3d) continue;
    const args = splitStepArguments(entity.args);
    const axis1Ref = stepRefs(args[0] || "")[0];
    const axis2Ref = stepRefs(args[1] || "")[0];
    const originRefs = stepRefs(args[2] || "");
    const invalidOriginRef = originRefs.find((ref) => invalidPointRefs.has(ref));
    if (invalidOriginRef) continue;
    const explicitDirectionRefs = [
      ...stepRefs(args[0] || ""),
      ...stepRefs(args[1] || ""),
      ...(is3d ? stepRefs(args[4] || "") : [])
    ];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) continue;
    const scaleInfo = ifcTransformationOperatorScaleInfo(Object.assign([...args], { type: entity.type }), { is2d, is3d });
    if (scaleInfo.invalid) continue;
    const originRef = originRefs[0];
    const axisX = vecUnit(directions.get(axis1Ref) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecUnit(directions.get(axis2Ref) || [0, 1, 0], [0, 1, 0]);
    const origin = points.get(originRef) || [0, 0, 0];
    const axis3Ref = is3d ? stepRefs(args[4] || "")[0] : null;
    const axisZ = is3d ? vecUnit(directions.get(axis3Ref) || vecCross(axisX, axisY), [0, 0, 1]) : [0, 0, 1];
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) continue;
    operators.set(entity.id, {
      origin,
      axisX: vecMul(axisX, scaleInfo.scale1),
      axisY: vecMul(axisY, scaleInfo.scale2),
      axisZ: vecMul(axisZ, scaleInfo.scale3)
    });
  }
  return operators;
}

function ifcTransformationScaleArgument(raw, fallback, label) {
  if (isStepMissingArgument(raw)) return { value: fallback, invalid: false };
  const value = stepArgNumber(raw, NaN);
  if (!Number.isFinite(value) || Math.abs(value) <= 1e-9) return { value: fallback, invalid: true, label };
  return { value, invalid: false };
}

function ifcTransformationOperatorScaleInfo(args, { is2d, is3d }) {
  const type = String(args?.type || "");
  const isNonUniform = type.endsWith("NONUNIFORM");
  const scale1 = ifcTransformationScaleArgument(args?.[3], 1, "scale1");
  if (scale1.invalid) return { invalid: true, kind: "scale", label: scale1.label };
  const scale2Arg = is2d ? args?.[4] : args?.[5];
  const scale2 = isNonUniform
    ? ifcTransformationScaleArgument(scale2Arg, scale1.value, "scale2")
    : { value: scale1.value, invalid: false };
  if (scale2.invalid) return { invalid: true, kind: "scale", label: scale2.label };
  const scale3 = is3d && isNonUniform
    ? ifcTransformationScaleArgument(args?.[6], scale1.value, "scale3")
    : { value: scale1.value, invalid: false };
  if (scale3.invalid) return { invalid: true, kind: "scale", label: scale3.label };
  return {
    invalid: false,
    scale1: scale1.value,
    scale2: scale2.value,
    scale3: scale3.value
  };
}

function ifcInvalidCartesianTransformationOperatorRefs(entities) {
  const invalidPointRefs = ifcInvalidCartesianPointRefs(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const operatorRefs = new Map();
  for (const entity of entities.values()) {
    const is2d = entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR2D" || entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM";
    const is3d = entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR3D" || entity.type === "IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM";
    if (!is2d && !is3d) continue;
    const args = splitStepArguments(entity.args);
    const invalidOriginRef = stepRefs(args[2] || "").find((ref) => invalidPointRefs.has(ref));
    if (invalidOriginRef) {
      operatorRefs.set(entity.id, { ref: invalidOriginRef, kind: "point" });
      continue;
    }
    const explicitDirectionRefs = [
      ...stepRefs(args[0] || ""),
      ...stepRefs(args[1] || ""),
      ...(is3d ? stepRefs(args[4] || "") : [])
    ];
    const invalidDirectionRef = explicitDirectionRefs.find((ref) => invalidDirectionRefs.has(ref));
    if (invalidDirectionRef) {
      operatorRefs.set(entity.id, { ref: invalidDirectionRef, kind: "direction" });
      continue;
    }
    const scaleInfo = ifcTransformationOperatorScaleInfo(Object.assign([...args], { type: entity.type }), { is2d, is3d });
    if (scaleInfo.invalid) {
      operatorRefs.set(entity.id, { kind: "scale", label: scaleInfo.label });
      continue;
    }
    const axis1Ref = stepRefs(args[0] || "")[0];
    const axis2Ref = stepRefs(args[1] || "")[0];
    const axisX = vecUnit(directions.get(axis1Ref) || [1, 0, 0], [1, 0, 0]);
    const axisY = vecUnit(directions.get(axis2Ref) || [0, 1, 0], [0, 1, 0]);
    const axis3Ref = is3d ? stepRefs(args[4] || "")[0] : null;
    const axisZ = is3d ? vecUnit(directions.get(axis3Ref) || vecCross(axisX, axisY), [0, 0, 1]) : [0, 0, 1];
    if (transformBasisIsDegenerate(axisX, axisY, axisZ)) operatorRefs.set(entity.id, { kind: "basis" });
  }
  return operatorRefs;
}

function ifcInvalidTransformationOperatorDetailText(detail) {
  const ref = detail?.ref || detail?.originRef || "?";
  if (detail?.kind === "scale") return `invalid ${detail.label || "scale"} value`;
  if (detail?.kind === "basis") return "degenerate transform basis";
  if (detail?.kind === "direction") return `invalid IFCDIRECTION #${ref}`;
  return `malformed IFCCARTESIANPOINT #${ref}`;
}

function cleanIfcProfileLoop(points) {
  const clean = (points || []).filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
  if (clean.length > 2 && samePoint(clean[0], clean[clean.length - 1])) clean.pop();
  return clean.length >= 3 ? clean : [];
}

function ifcPolylineCurves(entities) {
  const points = ifcCartesianPoints(entities);
  const curves = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPOLYLINE") continue;
    const loop = cleanIfcProfileLoop(stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean));
    if (loop.length >= 3) curves.set(entity.id, loop);
  }
  return curves;
}

function ifcCircleProfile(radius) {
  const points = [];
  for (let index = 0; index < IFC_CIRCLE_PROFILE_SEGMENTS; index += 1) {
    const angle = index / IFC_CIRCLE_PROFILE_SEGMENTS * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
  }
  return points;
}

function ifcInternalCurveRefs(entities) {
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type === "IFCEDGECURVE" || entity.type === "IFCTRIMMEDCURVE" || entity.type.endsWith("PROFILEDEF")) {
      for (const ref of stepRefs(entity.args)) refs.add(ref);
    } else if (entity.type === "IFCSWEPTDISKSOLID" || entity.type === "IFCSWEPTDISKSOLIDPOLYGONAL") {
      const args = splitStepArguments(entity.args);
      for (const ref of stepRefs(args[0] || "")) refs.add(ref);
    }
  }
  return refs;
}

function ifcAnalyticCurveDefinition(entity, placements, invalidPlacementRefs = new Map(), diagnostics = null) {
  const args = splitStepArguments(entity.args);
  if (entity.type === "IFCCIRCLE") {
    const placementRefs = stepRefs(args[0] || entity.args);
    const invalidPlacementRef = placementRefs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPlacementRef) {
      if (Array.isArray(diagnostics)) {
        const detail = invalidPlacementRefs.get(invalidPlacementRef);
        addDiagnostic(
          diagnostics,
          "warning",
          "ifc-curve-invalid-placement-skipped",
          `IFC IFCCIRCLE #${entity.id} references IFCAXIS2PLACEMENT #${invalidPlacementRef} with ${ifcInvalidAxisPlacementDetailText(detail)}; skipping curve linework.`
        );
      }
      return null;
    }
    const placementRef = placementRefs.find((ref) => placements.has(ref));
    const radius = stepArgNumber(args[1], NaN);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    return {
      semiAxis1: radius,
      semiAxis2: radius,
      segments: IFC_CIRCLE_PROFILE_SEGMENTS,
      transform: placements.get(placementRef) || identityIfcTransform()
    };
  }
  if (entity.type === "IFCELLIPSE") {
    const placementRefs = stepRefs(args[0] || entity.args);
    const invalidPlacementRef = placementRefs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPlacementRef) {
      if (Array.isArray(diagnostics)) {
        const detail = invalidPlacementRefs.get(invalidPlacementRef);
        addDiagnostic(
          diagnostics,
          "warning",
          "ifc-curve-invalid-placement-skipped",
          `IFC IFCELLIPSE #${entity.id} references IFCAXIS2PLACEMENT #${invalidPlacementRef} with ${ifcInvalidAxisPlacementDetailText(detail)}; skipping curve linework.`
        );
      }
      return null;
    }
    const placementRef = placementRefs.find((ref) => placements.has(ref));
    const semiAxis1 = stepArgNumber(args[1], NaN);
    const semiAxis2 = stepArgNumber(args[2], NaN);
    if (!Number.isFinite(semiAxis1) || semiAxis1 <= 0 || !Number.isFinite(semiAxis2) || semiAxis2 <= 0) return null;
    return {
      semiAxis1,
      semiAxis2,
      segments: IFC_ELLIPSE_SEGMENTS,
      transform: placements.get(placementRef) || identityIfcTransform()
    };
  }
  return null;
}

function ifcAnalyticCurveDefinitions(entities, diagnostics = null, options = {}) {
  const placements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const entityTypes = Array.isArray(options.entityTypes) ? new Set(options.entityTypes) : null;
  const definitions = new Map();
  for (const entity of entities.values()) {
    if (entityTypes && !entityTypes.has(entity.type)) continue;
    const definition = ifcAnalyticCurveDefinition(entity, placements, invalidPlacementRefs, diagnostics);
    if (definition) definitions.set(entity.id, definition);
  }
  return definitions;
}

function ifcVectorDefinitions(entities, diagnostics = null) {
  const directions = ifcDirectionVectors(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const vectors = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCVECTOR") continue;
    const args = splitStepArguments(entity.args);
    const directionRef = stepRefs(args[0] || entity.args).find((ref) => directions.has(ref));
    const invalidDirectionRef = stepRefs(args[0] || entity.args).find((ref) => invalidDirectionRefs.has(ref));
    const magnitude = stepArgNumber(args[1], NaN);
    if (!directionRef) {
      if (invalidDirectionRef) {
        addDiagnostic(
          diagnostics,
          "warning",
          "ifc-vector-invalid-direction-skipped",
          `IFC IFCVECTOR #${entity.id} references malformed IFCDIRECTION #${invalidDirectionRef}; skipping dependent line geometry.`
        );
      }
      continue;
    }
    if (!Number.isFinite(magnitude)) continue;
    vectors.set(entity.id, vecMul(directions.get(directionRef), magnitude));
  }
  return vectors;
}

function ifcLineDefinitions(entities, diagnostics = null) {
  const points = ifcCartesianPoints(entities);
  const vectors = ifcVectorDefinitions(entities, diagnostics);
  const definitions = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCLINE") continue;
    const args = splitStepArguments(entity.args);
    const pointRef = stepRefs(args[0] || entity.args).find((ref) => points.has(ref));
    const vectorRef = stepRefs(args[1] || entity.args).find((ref) => vectors.has(ref));
    const origin = points.get(pointRef);
    const vector = vectors.get(vectorRef);
    if (!origin || !finiteVec3(vector) || vecLength(vector) < 1e-9) continue;
    definitions.set(entity.id, { origin, vector });
  }
  return definitions;
}

function ifcAnalyticCurvePoints(definition, startAngle, span, steps, closed) {
  const points = [];
  const pointCount = closed ? steps : steps + 1;
  for (let index = 0; index < pointCount; index += 1) {
    const ratio = closed ? index / steps : index / Math.max(1, steps);
    const angle = startAngle + span * ratio;
    points.push(ifcTransformPoint(definition.transform, [
      Math.cos(angle) * definition.semiAxis1,
      Math.sin(angle) * definition.semiAxis2,
      0
    ]));
  }
  return points;
}

function ifcFullAnalyticCurveSegments(definition) {
  const points = ifcAnalyticCurvePoints(definition, 0, Math.PI * 2, definition.segments, true);
  return stepSegmentsFromCurvePoints(points, true);
}

function ifcPolylineSegmentGroups(entities, diagnostics, options = {}) {
  const points = ifcCartesianPoints(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPOLYLINE" || internalCurveRefs.has(entity.id)) continue;
    const vertices = stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean);
    const segments = [];
    for (let index = 1; index < vertices.length; index += 1) {
      if (!samePoint(vertices[index - 1], vertices[index])) segments.push({ start: vertices[index - 1], end: vertices[index] });
    }
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-polyline-linework",
      `Translated ${groups.size} IFC IFCPOLYLINE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcCircleCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = ifcAnalyticCurveDefinitions(entities, diagnostics, { entityTypes: ["IFCCIRCLE"] });
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCIRCLE" || internalCurveRefs.has(entity.id)) continue;
    const definition = definitions.get(entity.id);
    if (!definition) continue;
    const segments = ifcFullAnalyticCurveSegments(definition);
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-circle-linework",
      `Sampled ${groups.size} IFC IFCCIRCLE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcEllipseCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = ifcAnalyticCurveDefinitions(entities, diagnostics, { entityTypes: ["IFCELLIPSE"] });
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCELLIPSE" || internalCurveRefs.has(entity.id)) continue;
    const definition = definitions.get(entity.id);
    if (!definition) continue;
    const segments = ifcFullAnalyticCurveSegments(definition);
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-ellipse-linework",
      `Sampled ${groups.size} IFC IFCELLIPSE curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcBSplineKnots(args, controlPointCount, degree) {
  const multiplicities = stepNumberList(args[5])
    .map((value) => Math.max(0, Math.trunc(value)))
    .filter((value) => value > 0);
  const knotValues = stepNumberList(args[6]);
  const expanded = [];
  if (multiplicities.length === knotValues.length) {
    for (let index = 0; index < knotValues.length; index += 1) {
      for (let repeat = 0; repeat < multiplicities[index]; repeat += 1) expanded.push(knotValues[index]);
    }
  }
  const safeDegree = Math.max(1, Math.min(Math.trunc(degree) || 1, controlPointCount - 1));
  return expanded.length >= controlPointCount + safeDegree + 1
    ? expanded
    : stepOpenUniformKnots(controlPointCount, safeDegree);
}

function ifcBSplineWeights(args, controlPointCount) {
  const weights = stepNumberList(args[8]);
  return weights.length === controlPointCount && weights.every((weight) => weight > 0) ? weights : [];
}

function ifcBSplineCurveDefinitions(entities) {
  const points = ifcCartesianPoints(entities);
  const definitions = new Map();
  for (const entity of entities.values()) {
    const rational = entity.type === "IFCRATIONALBSPLINECURVEWITHKNOTS";
    if (entity.type !== "IFCBSPLINECURVEWITHKNOTS" && !rational) continue;
    const args = splitStepArguments(entity.args);
    const degree = stepArgNumber(args[0], NaN);
    if (!Number.isFinite(degree)) continue;
    const controlPoints = stepRefs(args[1] || "").map((ref) => points.get(ref)).filter(Boolean);
    if (controlPoints.length < 2) continue;
    const knots = ifcBSplineKnots(args, controlPoints.length, degree);
    const weights = ifcBSplineWeights(args, controlPoints.length);
    if (rational && weights.length !== controlPoints.length) continue;
    definitions.set(entity.id, {
      degree,
      controlPoints,
      knots,
      weights,
      closed: /\.T\./i.test(args[3] || ""),
      rational
    });
  }
  return definitions;
}

function ifcBSplineCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = ifcBSplineCurveDefinitions(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  let rationalCount = 0;
  for (const [entityId, definition] of definitions.entries()) {
    if (internalCurveRefs.has(entityId)) continue;
    const curvePoints = sampleBSpline(definition.controlPoints, definition.knots, definition.degree, definition.weights, IFC_BSPLINE_SEGMENTS);
    const segments = stepSegmentsFromCurvePoints(curvePoints, definition.closed);
    if (segments.length) {
      groups.set(entityId, segments);
      if (definition.rational) rationalCount += 1;
    }
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-bspline-linework",
      `Sampled ${groups.size} IFC IFCBSPLINECURVEWITHKNOTS item(s) into canonical reference linework.`
    );
  }
  if (rationalCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-rational-bspline-linework",
      `Sampled ${rationalCount} IFC rational B-spline curve item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcTrimmedCurveSegmentGroups(entities, diagnostics, options = {}) {
  const definitions = ifcAnalyticCurveDefinitions(entities);
  const lineDefinitions = ifcLineDefinitions(entities, diagnostics);
  const bsplineDefinitions = ifcBSplineCurveDefinitions(entities);
  const points = ifcCartesianPoints(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  let lineCount = 0;
  let bsplineCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "IFCTRIMMEDCURVE") continue;
    if (internalCurveRefs.has(entity.id)) continue;
    const args = splitStepArguments(entity.args);
    const baseCurveRef = stepRefs(args[0] || "").find((ref) => definitions.has(ref) || lineDefinitions.has(ref) || bsplineDefinitions.has(ref));
    const definition = definitions.get(baseCurveRef);
    if (definition) {
      const startAngle = trimAngleFromArgument(args[1], args[4], definition, points);
      const endAngle = trimAngleFromArgument(args[2], args[4], definition, points);
      if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) continue;
      const span = angleDeltaCcw(startAngle, endAngle);
      if (span <= 1e-9) continue;
      const steps = Math.max(4, Math.ceil(definition.segments * Math.min(span, Math.PI * 2) / (Math.PI * 2)));
      const curvePoints = ifcAnalyticCurvePoints(definition, startAngle, span, steps, false);
      if (/\.F\./i.test(args[3] || "")) curvePoints.reverse();
      const segments = stepSegmentsFromCurvePoints(curvePoints, false);
      if (segments.length) groups.set(entity.id, segments);
      continue;
    }
    const lineDefinition = lineDefinitions.get(baseCurveRef);
    if (lineDefinition) {
      let start = trimPointFromLineArgument(args[1], args[4], lineDefinition, points);
      let end = trimPointFromLineArgument(args[2], args[4], lineDefinition, points);
      if (!finiteVec3(start) || !finiteVec3(end) || samePoint(start, end)) continue;
      if (/\.F\./i.test(args[3] || "")) [start, end] = [end, start];
      groups.set(entity.id, [{ start, end }]);
      lineCount += 1;
      continue;
    }
    const bsplineDefinition = bsplineDefinitions.get(baseCurveRef);
    if (!bsplineDefinition || !/\.PARAMETER\./i.test(args[4] || "")) continue;
    const startParameter = stepTrimParameterValue(args[1]);
    const endParameter = stepTrimParameterValue(args[2]);
    if (!Number.isFinite(startParameter) || !Number.isFinite(endParameter) || Math.abs(startParameter - endParameter) < 1e-12) continue;
    const rangeStart = Math.min(startParameter, endParameter);
    const rangeEnd = Math.max(startParameter, endParameter);
    const curvePoints = sampleBSplineRange(
      bsplineDefinition.controlPoints,
      bsplineDefinition.knots,
      bsplineDefinition.degree,
      bsplineDefinition.weights,
      IFC_BSPLINE_SEGMENTS,
      rangeStart,
      rangeEnd
    );
    if (startParameter > endParameter) curvePoints.reverse();
    if (/\.F\./i.test(args[3] || "")) curvePoints.reverse();
    const segments = stepSegmentsFromCurvePoints(curvePoints, false);
    if (segments.length) {
      groups.set(entity.id, segments);
      bsplineCount += 1;
    }
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-trimmed-curve-linework",
      `Sampled ${groups.size} IFC IFCTRIMMEDCURVE item(s) into canonical reference linework.`
    );
  }
  if (lineCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-trimmed-line-linework",
      `Translated ${lineCount} IFC IFCTRIMMEDCURVE line item(s) into canonical reference linework.`
    );
  }
  if (bsplineCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-trimmed-bspline-linework",
      `Sampled ${bsplineCount} IFC IFCTRIMMEDCURVE B-spline item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcCompositeCurveSegmentRecords(entities) {
  const records = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCOMPOSITECURVESEGMENT") continue;
    const args = splitStepArguments(entity.args);
    const parentCurveRef = stepRefs(args[2] || "").find((ref) => entities.has(ref));
    if (!parentCurveRef) continue;
    records.set(entity.id, {
      parentCurveRef,
      sameSense: !/\.F\./i.test(args[1] || "")
    });
  }
  return records;
}

function ifcCompositeSourceCurveRefs(entities) {
  const records = ifcCompositeCurveSegmentRecords(entities);
  const refs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCOMPOSITECURVE") continue;
    for (const ref of stepRefs(entity.args)) {
      const record = records.get(ref);
      if (record) refs.add(record.parentCurveRef);
    }
  }
  return refs;
}

function ifcCompositeCurveSegmentGroups(entities, curveGroups, diagnostics, options = {}) {
  const records = ifcCompositeCurveSegmentRecords(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCOMPOSITECURVE") continue;
    if (internalCurveRefs.has(entity.id)) continue;
    const args = splitStepArguments(entity.args);
    const segmentRefs = stepRefs(args[0] || entity.args).filter((ref) => records.has(ref));
    const segments = [];
    for (const segmentRef of segmentRefs) {
      const record = records.get(segmentRef);
      const childSegments = curveGroups.get(record.parentCurveRef);
      if (!childSegments?.length) continue;
      segments.push(...(record.sameSense ? childSegments : reverseCurveSegments(childSegments)));
    }
    if (segments.length) groups.set(entity.id, segments);
  }
  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-composite-curve-linework",
      `Translated ${groups.size} IFC IFCCOMPOSITECURVE item(s) into canonical reference linework.`
    );
  }
  return groups;
}

function ifcCurveSegmentGroups(entities, diagnostics, options = {}) {
  const baseSegmentGroups = new Map([
    ...ifcPolylineSegmentGroups(entities, diagnostics, options),
    ...ifcIndexedPolyCurveSegmentGroups(entities, diagnostics, options),
    ...ifcCircleCurveSegmentGroups(entities, diagnostics, options),
    ...ifcEllipseCurveSegmentGroups(entities, diagnostics, options),
    ...ifcBSplineCurveSegmentGroups(entities, diagnostics, options),
    ...ifcTrimmedCurveSegmentGroups(entities, diagnostics, options)
  ]);
  return new Map([
    ...baseSegmentGroups,
    ...ifcCompositeCurveSegmentGroups(entities, baseSegmentGroups, diagnostics, options)
  ]);
}

const IFC_PROFILE_DEF_TYPES = new Set([
  "IFCRECTANGLEPROFILEDEF",
  "IFCROUNDEDRECTANGLEPROFILEDEF",
  "IFCRECTANGLEHOLLOWPROFILEDEF",
  "IFCCIRCLEPROFILEDEF",
  "IFCELLIPSEPROFILEDEF",
  "IFCCIRCLEHOLLOWPROFILEDEF",
  "IFCTRAPEZIUMPROFILEDEF",
  "IFCLSHAPEPROFILEDEF",
  "IFCCSHAPEPROFILEDEF",
  "IFCUSHAPEPROFILEDEF",
  "IFCTSHAPEPROFILEDEF",
  "IFCZSHAPEPROFILEDEF",
  "IFCISHAPEPROFILEDEF",
  "IFCASYMMETRICISHAPEPROFILEDEF",
  "IFCARBITRARYCLOSEDPROFILEDEF",
  "IFCARBITRARYPROFILEDEFWITHVOIDS"
]);

function ifcProfiles(entities, diagnostics) {
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const transformationOperators = ifcCartesianTransformationOperators(entities);
  const polylines = ifcPolylineCurves(entities);
  const profiles = new Map();

  for (const entity of entities.values()) {
    if (!IFC_PROFILE_DEF_TYPES.has(entity.type)) continue;
    const args = splitStepArguments(entity.args);
    const refs = stepRefs(entity.args);
    const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "ifc-profile-invalid-placement-skipped",
        `IFC ${entity.type} #${entity.id} references IFCAXIS2PLACEMENT #${invalidPositionRef} with ${ifcInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping profile geometry.`
      );
      continue;
    }
    const numericArgs = stepNumericArgs(args);
    if (entity.type === "IFCRECTANGLEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const xDim = stepArgNumber(args[3], NaN);
      const yDim = stepArgNumber(args[4], NaN);
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const loop = rectangleProfileLoop(xDim, yDim);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCROUNDEDRECTANGLEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const xDim = stepArgNumber(args[3], NaN);
      const yDim = stepArgNumber(args[4], NaN);
      const radius = stepArgNumber(args[5], NaN);
      const loop = roundedRectangleProfileLoop(xDim, yDim, radius, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCRECTANGLEHOLLOWPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 3);
      const xDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const yDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const innerFilletRadius = stepArgNumber(args[6], 0);
      const outerFilletRadius = stepArgNumber(args[7], 0);
      const { outer } = roundedRectangleHollowProfileLoops(xDim, yDim, wallThickness, innerFilletRadius, outerFilletRadius, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (outer.length >= 3) profiles.set(entity.id, outer.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCCIRCLEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const radius = stepArgNumber(args[3], NaN);
      if (!Number.isFinite(radius) || radius <= 0) continue;
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      profiles.set(entity.id, ifcCircleProfile(radius).map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCELLIPSEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 2);
      const semiAxis1 = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const semiAxis2 = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const loop = ellipseProfileLoop(semiAxis1, semiAxis2, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCCIRCLEHOLLOWPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 2);
      const radius = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const wallThickness = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const { outer } = circleHollowProfileLoops(radius, wallThickness, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (outer.length >= 3) profiles.set(entity.id, outer.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCTRAPEZIUMPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const bottomXDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const topXDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const yDim = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const topXOffset = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = trapeziumProfileLoop(bottomXDim, topXDim, yDim, topXOffset);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCLSHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 3);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const width = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const thickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const loop = lShapeProfileLoop(width, depth, thickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCCSHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const width = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const girth = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = cShapeProfileLoop(width, depth, wallThickness, girth);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCUSHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = uShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCTSHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = tShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCZSHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const depth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const flangeWidth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = zShapeProfileLoop(flangeWidth, depth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCISHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 4);
      const overallWidth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const overallDepth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const flangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const loop = iShapeProfileLoop(overallWidth, overallDepth, webThickness, flangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCASYMMETRICISHAPEPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const fallbackDims = numericArgs.slice(0, 6);
      const bottomFlangeWidth = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const overallDepth = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const webThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const bottomFlangeThickness = stepArgNumber(args[6], fallbackDims[3] ?? NaN);
      const topFlangeWidth = stepArgNumber(args[8], fallbackDims[4] ?? NaN);
      const topFlangeThickness = stepArgNumber(args[9], fallbackDims[5] ?? NaN);
      const loop = asymmetricIShapeProfileLoop(bottomFlangeWidth, overallDepth, webThickness, bottomFlangeThickness, topFlangeWidth, topFlangeThickness);
      if (loop.length >= 3) profiles.set(entity.id, loop.map((point) => ifcTransformPoint(placement, point)));
    } else if (entity.type === "IFCARBITRARYCLOSEDPROFILEDEF" || entity.type === "IFCARBITRARYPROFILEDEFWITHVOIDS") {
      const curveRef = stepRefs(args[2] || entity.args).find((ref) => polylines.has(ref));
      const loop = cleanIfcProfileLoop(polylines.get(curveRef));
      if (loop.length >= 3) profiles.set(entity.id, loop);
    }
  }

  const derivedProfiles = [...entities.values()].filter((entity) => entity.type === "IFCDERIVEDPROFILEDEF" || entity.type === "IFCMIRROREDPROFILEDEF");
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of derivedProfiles) {
      if (profiles.has(entity.id)) continue;
      const refs = stepRefs(entity.args);
      const parentRef = refs.find((ref) => profiles.has(ref));
      const parent = profiles.get(parentRef);
      if (!parent) continue;
      let loop = [];
      if (entity.type === "IFCMIRROREDPROFILEDEF") {
        loop = cleanIfcProfileLoop(parent.map((point) => [-point[0], point[1], point[2]]));
      } else {
        const operatorRef = refs.find((ref) => transformationOperators.has(ref));
        const operator = transformationOperators.get(operatorRef);
        if (!operator) continue;
        loop = cleanIfcProfileLoop(parent.map((point) => ifcTransformPoint(operator, point)));
      }
      if (loop.length >= 3) {
        profiles.set(entity.id, loop);
        changed = true;
      }
    }
  }
  return profiles;
}

function ifcProfileVoidLoops(entities) {
  const polylines = ifcPolylineCurves(entities);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const profileVoids = new Map();
  for (const entity of entities.values()) {
    const args = splitStepArguments(entity.args);
    if (entity.type === "IFCARBITRARYPROFILEDEFWITHVOIDS") {
      const voidLoops = stepRefs(args[3] || "")
        .map((ref) => cleanIfcProfileLoop(polylines.get(ref)))
        .filter((loop) => loop.length >= 3);
      if (voidLoops.length) profileVoids.set(entity.id, voidLoops);
    } else if (entity.type === "IFCRECTANGLEHOLLOWPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
      if (invalidPositionRef) continue;
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const numericArgs = stepNumericArgs(args);
      const fallbackDims = numericArgs.slice(0, 3);
      const xDim = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const yDim = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const wallThickness = stepArgNumber(args[5], fallbackDims[2] ?? NaN);
      const innerFilletRadius = stepArgNumber(args[6], 0);
      const outerFilletRadius = stepArgNumber(args[7], 0);
      const { inner } = roundedRectangleHollowProfileLoops(xDim, yDim, wallThickness, innerFilletRadius, outerFilletRadius, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (inner.length >= 3) profileVoids.set(entity.id, [inner.map((point) => ifcTransformPoint(placement, point))]);
    } else if (entity.type === "IFCCIRCLEHOLLOWPROFILEDEF") {
      const refs = stepRefs(entity.args);
      const invalidPositionRef = refs.find((ref) => invalidPlacementRefs.has(ref));
      if (invalidPositionRef) continue;
      const positionRef = refs.find((ref) => axisPlacements.has(ref));
      const placement = axisPlacements.get(positionRef) || identityIfcTransform();
      const numericArgs = stepNumericArgs(args);
      const fallbackDims = numericArgs.slice(0, 2);
      const radius = stepArgNumber(args[3], fallbackDims[0] ?? NaN);
      const wallThickness = stepArgNumber(args[4], fallbackDims[1] ?? NaN);
      const { inner } = circleHollowProfileLoops(radius, wallThickness, IFC_CIRCLE_PROFILE_SEGMENTS);
      if (inner.length >= 3) profileVoids.set(entity.id, [inner.map((point) => ifcTransformPoint(placement, point))]);
    }
  }
  return profileVoids;
}

function ifcExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics) {
  const directionArgRefs = stepRefs(args[2] || "");
  const invalidDirectionRef = directionArgRefs.find((ref) => invalidDirectionRefs.has(ref));
  if (invalidDirectionRef) {
    addDiagnosticOnce(
      diagnostics,
      "warning",
      "ifc-extruded-solid-invalid-direction-skipped",
      `IFC ${entity.type} #${entity.id} references invalid IFCDIRECTION #${invalidDirectionRef}; skipping swept solid mesh.`
    );
    return null;
  }
  const directionRef = directionArgRefs.find((ref) => directions.has(ref));
  if (!directionRef) {
    addDiagnosticOnce(
      diagnostics,
      "warning",
      "ifc-extruded-solid-invalid-direction-skipped",
      `IFC ${entity.type} #${entity.id} is missing a valid extrusion IFCDIRECTION; skipping swept solid mesh.`
    );
    return null;
  }
  return directionRef;
}

function ifcExtrudedSolidFaces(entities, diagnostics) {
  const profiles = ifcProfiles(entities, diagnostics);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const solids = new Map();
  let regularCount = 0;
  let taperedCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "IFCEXTRUDEDAREASOLID" && entity.type !== "IFCEXTRUDEDAREASOLIDTAPERED") continue;
    const args = splitStepArguments(entity.args);
    const sweptAreaRef = stepRefs(args[0] || "")[0];
    const positionRef = stepRefs(args[1] || "")[0];
    const invalidPositionRef = stepRefs(args[1] || "").find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-extruded-solid-invalid-placement-skipped",
        `IFC ${entity.type} #${entity.id} references IFCAXIS2PLACEMENT #${invalidPositionRef} with ${ifcInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const directionRef = ifcExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics);
    if (!directionRef) continue;
    const depth = stepArgNumber(args[3], NaN);
    const profile = cleanIfcProfileLoop(profiles.get(sweptAreaRef));
    const endSweptAreaRef = entity.type === "IFCEXTRUDEDAREASOLIDTAPERED" ? stepRefs(args[4] || "")[0] : null;
    const endProfile = entity.type === "IFCEXTRUDEDAREASOLIDTAPERED" ? cleanIfcProfileLoop(profiles.get(endSweptAreaRef)) : profile;
    if (profile.length < 3 || !Number.isFinite(depth) || depth <= 0) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-extruded-solid-skipped",
        `Skipped ${entity.type} #${entity.id} because its profile or depth is unsupported.`
      );
      continue;
    }
    if (entity.type === "IFCEXTRUDEDAREASOLIDTAPERED" && (endProfile.length < 3 || endProfile.length !== profile.length)) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-extruded-solid-tapered-skipped",
        `Skipped IFCEXTRUDEDAREASOLIDTAPERED #${entity.id} because its start and end profiles are unsupported or have incompatible point counts.`
      );
      continue;
    }
    const placement = axisPlacements.get(positionRef) || identityIfcTransform();
    const extrusion = vecMul(vecUnit(directions.get(directionRef) || [0, 0, 1], [0, 0, 1]), depth);
    const bottom = profile.map((point) => ifcTransformPoint(placement, point));
    const top = endProfile.map((point) => ifcTransformPoint(placement, vecAdd(point, extrusion)));
    const faces = sweptProfileFaces(bottom, top);
    if (!faces.length) continue;
    solids.set(entity.id, faces);
    if (entity.type === "IFCEXTRUDEDAREASOLIDTAPERED") taperedCount += 1;
    else regularCount += 1;
  }

  if (regularCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-extruded-solid-applied",
      `Translated ${regularCount} IFCEXTRUDEDAREASOLID swept solid(s) into canonical mesh faces.`
    );
  }
  if (taperedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-extruded-solid-tapered-applied",
      `Translated ${taperedCount} IFCEXTRUDEDAREASOLIDTAPERED swept solid(s) into canonical tapered mesh faces.`
    );
  }
  return solids;
}

function ifcExtrudedSolidVoidLoopGroups(entities, diagnostics) {
  const profileVoids = ifcProfileVoidLoops(entities);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const directions = ifcDirectionVectors(entities);
  const invalidDirectionRefs = ifcInvalidDirectionRefs(entities);
  const solids = new Map();
  let voidLoopCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "IFCEXTRUDEDAREASOLID" && entity.type !== "IFCEXTRUDEDAREASOLIDTAPERED") continue;
    const args = splitStepArguments(entity.args);
    const sweptAreaRef = stepRefs(args[0] || "")[0];
    const endSweptAreaRef = entity.type === "IFCEXTRUDEDAREASOLIDTAPERED" ? stepRefs(args[4] || "")[0] : sweptAreaRef;
    const positionRef = stepRefs(args[1] || "")[0];
    if (stepRefs(args[1] || "").some((ref) => invalidPlacementRefs.has(ref))) continue;
    const directionRef = ifcExtrudedDirectionRef(entity, args, directions, invalidDirectionRefs, diagnostics);
    if (!directionRef) continue;
    const depth = stepArgNumber(args[3], NaN);
    const voidLoops = profileVoids.get(sweptAreaRef) || [];
    const endVoidLoops = profileVoids.get(endSweptAreaRef) || [];
    if ((!voidLoops.length && !endVoidLoops.length) || !Number.isFinite(depth) || depth <= 0) continue;
    const placement = axisPlacements.get(positionRef) || identityIfcTransform();
    const extrusion = vecMul(vecUnit(directions.get(directionRef) || [0, 0, 1], [0, 0, 1]), depth);
    const loops = [];
    for (const loop of voidLoops) {
      const clean = cleanIfcProfileLoop(loop);
      if (clean.length < 3) continue;
      loops.push(clean.map((point) => ifcTransformPoint(placement, point)));
    }
    for (const loop of endVoidLoops) {
      const clean = cleanIfcProfileLoop(loop);
      if (clean.length < 3) continue;
      loops.push(clean.map((point) => ifcTransformPoint(placement, vecAdd(point, extrusion))));
    }
    if (!loops.length) continue;
    solids.set(entity.id, loops);
    voidLoopCount += loops.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-profile-void-linework",
      `Preserved ${voidLoopCount} IFC extruded profile void loop(s) as canonical reference linework; mesh faces still use outer profiles only.`
    );
  }
  return solids;
}

function ifcRevolvedSolidFaces(entities, diagnostics) {
  const profiles = ifcProfiles(entities, diagnostics);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const axis1Placements = ifcAxis1Placements(entities);
  const invalidAxis1PlacementRefs = ifcInvalidAxis1PlacementRefs(entities);
  const solids = new Map();

  for (const entity of entities.values()) {
    if (entity.type !== "IFCREVOLVEDAREASOLID") continue;
    const args = splitStepArguments(entity.args);
    const sweptAreaRef = stepRefs(args[0] || "")[0];
    const positionRef = stepRefs(args[1] || "")[0];
    const invalidPositionRef = stepRefs(args[1] || "").find((ref) => invalidPlacementRefs.has(ref));
    if (invalidPositionRef) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-revolved-solid-invalid-placement-skipped",
        `IFC IFCREVOLVEDAREASOLID #${entity.id} references IFCAXIS2PLACEMENT #${invalidPositionRef} with ${ifcInvalidAxisPlacementDetailText(invalidPlacementRefs.get(invalidPositionRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisArgRefs = stepRefs(args[2] || "");
    const invalidAxisRef = axisArgRefs.find((ref) => invalidAxis1PlacementRefs.has(ref));
    if (invalidAxisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "ifc-revolved-solid-invalid-axis-skipped",
        `IFC IFCREVOLVEDAREASOLID #${entity.id} references IFCAXIS1PLACEMENT #${invalidAxisRef} with ${ifcInvalidAxis1PlacementDetailText(invalidAxis1PlacementRefs.get(invalidAxisRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisRef = axisArgRefs.find((ref) => axis1Placements.has(ref));
    if (!axisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "ifc-revolved-solid-invalid-axis-skipped",
        `IFC IFCREVOLVEDAREASOLID #${entity.id} is missing a valid IFCAXIS1PLACEMENT; skipping swept solid mesh.`
      );
      continue;
    }
    const angle = stepArgNumber(args[3], NaN);
    const profile = cleanIfcProfileLoop(profiles.get(sweptAreaRef));
    const axisPlacement = axis1Placements.get(axisRef) || { origin: [0, 0, 0], axis: [0, 0, 1] };
    const localFaces = revolvedProfileFaces(profile, axisPlacement, angle, IFC_REVOLVED_PROFILE_SEGMENTS);
    if (!localFaces.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-revolved-solid-skipped",
        `Skipped IFCREVOLVEDAREASOLID #${entity.id} because its profile, axis, or angle is unsupported.`
      );
      continue;
    }
    const placement = axisPlacements.get(positionRef) || identityIfcTransform();
    solids.set(entity.id, transformIfcFaces(localFaces, placement));
  }

  if (solids.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-revolved-solid-applied",
      `Translated ${solids.size} IFCREVOLVEDAREASOLID swept solid(s) into sampled canonical mesh faces.`
    );
  }
  return solids;
}

function ifcRevolvedSolidVoidLoopGroups(entities, diagnostics) {
  const profileVoids = ifcProfileVoidLoops(entities);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const invalidPlacementRefs = ifcInvalidAxisPlacementRefs(entities);
  const axis1Placements = ifcAxis1Placements(entities);
  const invalidAxis1PlacementRefs = ifcInvalidAxis1PlacementRefs(entities);
  const solids = new Map();
  let voidLoopCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "IFCREVOLVEDAREASOLID") continue;
    const args = splitStepArguments(entity.args);
    const sweptAreaRef = stepRefs(args[0] || "")[0];
    const positionRef = stepRefs(args[1] || "")[0];
    if (stepRefs(args[1] || "").some((ref) => invalidPlacementRefs.has(ref))) continue;
    const axisArgRefs = stepRefs(args[2] || "");
    const invalidAxisRef = axisArgRefs.find((ref) => invalidAxis1PlacementRefs.has(ref));
    if (invalidAxisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "ifc-revolved-solid-invalid-axis-skipped",
        `IFC IFCREVOLVEDAREASOLID #${entity.id} references IFCAXIS1PLACEMENT #${invalidAxisRef} with ${ifcInvalidAxis1PlacementDetailText(invalidAxis1PlacementRefs.get(invalidAxisRef))}; skipping swept solid mesh.`
      );
      continue;
    }
    const axisRef = axisArgRefs.find((ref) => axis1Placements.has(ref));
    if (!axisRef) {
      addDiagnosticOnce(
        diagnostics,
        "warning",
        "ifc-revolved-solid-invalid-axis-skipped",
        `IFC IFCREVOLVEDAREASOLID #${entity.id} is missing a valid IFCAXIS1PLACEMENT; skipping swept solid mesh.`
      );
      continue;
    }
    const angle = stepArgNumber(args[3], NaN);
    const voidLoops = profileVoids.get(sweptAreaRef) || [];
    if (!voidLoops.length) continue;
    const axisPlacement = axis1Placements.get(axisRef) || { origin: [0, 0, 0], axis: [0, 0, 1] };
    const localRings = revolvedProfileLoopRings(voidLoops, axisPlacement, angle, IFC_REVOLVED_PROFILE_SEGMENTS, cleanIfcProfileLoop);
    if (!localRings.length) continue;
    const placement = axisPlacements.get(positionRef) || identityIfcTransform();
    const rings = transformIfcFaces(localRings, placement);
    solids.set(entity.id, rings);
    voidLoopCount += rings.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-revolved-profile-void-linework",
      `Preserved ${voidLoopCount} IFC revolved profile void ring(s) as canonical reference linework; mesh faces still use outer profiles only.`
    );
  }
  return solids;
}

function ifcSweptDiskSolidFaces(entities, diagnostics) {
  const curveGroups = ifcCurveSegmentGroups(entities, [], { includeInternal: true });
  const solids = new Map();
  let sweptDiskCount = 0;
  let ignoredInnerRadiusCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "IFCSWEPTDISKSOLID" && entity.type !== "IFCSWEPTDISKSOLIDPOLYGONAL") continue;
    const args = splitStepArguments(entity.args);
    const directrixRef = stepRefs(args[0] || "").find((ref) => curveGroups.has(ref))
      || stepRefs(entity.args).find((ref) => curveGroups.has(ref));
    const radiusParameter = stepRequiredPositiveNumberArgument(args[1], "radius");
    const innerRadiusParameter = stepOptionalNonNegativeNumberArgument(args[2], "inner radius");
    const startParameter = stepOptionalNumberArgument(args[3], "start path-distance");
    const endParameter = stepOptionalNumberArgument(args[4], "end path-distance");
    const invalidParameterLabels = [radiusParameter, innerRadiusParameter, startParameter, endParameter]
      .filter((parameter) => parameter.invalid)
      .map((parameter) => parameter.label);
    if (!radiusParameter.invalid && Number.isFinite(innerRadiusParameter.value) && innerRadiusParameter.value >= radiusParameter.value) {
      invalidParameterLabels.push("inner radius");
    }
    if (invalidParameterLabels.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-swept-disk-invalid-parameter-skipped",
        `Skipped ${entity.type} #${entity.id} because its ${invalidParameterLabels.join("/")} parameter(s) were malformed or unsupported.`
      );
      continue;
    }
    const radius = radiusParameter.value;
    const innerRadius = innerRadiusParameter.value;
    const startParam = startParameter.value;
    const endParam = endParameter.value;
    const sourceDirectrixSegments = curveGroups.get(directrixRef);
    const trimRangeIssues = pathDistanceTrimParameterIssue(sourceDirectrixSegments, startParam, endParam);
    if (trimRangeIssues) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-swept-disk-invalid-parameter-skipped",
        `Skipped ${entity.type} #${entity.id} because its ${trimRangeIssues.join("/")} parameter(s) were outside the supported directrix range.`
      );
      continue;
    }
    const directrixSegments = trimSegmentsByPathDistance(sourceDirectrixSegments, startParam, endParam);
    const faces = sweptDiskFacesFromSegments(directrixSegments, radius, IFC_SWEPT_DISK_SEGMENTS);
    if (!faces.length) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-swept-disk-solid-skipped",
        `Skipped ${entity.type} #${entity.id} because its directrix or radius is unsupported.`
      );
      continue;
    }
    if (Number.isFinite(innerRadius) && innerRadius > 0 && innerRadius < radius) ignoredInnerRadiusCount += 1;
    if (Number.isFinite(startParam) || Number.isFinite(endParam)) {
      addDiagnostic(
        diagnostics,
        "info",
        "ifc-swept-disk-directrix-trimmed",
        `Applied IFC swept disk start/end path-distance parameters to ${entity.type} #${entity.id}.`
      );
    }
    solids.set(entity.id, faces);
    sweptDiskCount += 1;
  }
  if (sweptDiskCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-swept-disk-solid-applied",
      `Translated ${sweptDiskCount} IFC IFCSWEPTDISKSOLID item(s) into sampled canonical tube mesh faces.`
    );
  }
  if (ignoredInnerRadiusCount) {
    addDiagnostic(
      diagnostics,
      "warning",
      "ifc-swept-disk-inner-radius-ignored",
      `Rendered ${ignoredInnerRadiusCount} IFC swept disk solid(s) with their outer radius only; inner pipe walls are left to an external IFC adapter.`
    );
  }
  return solids;
}

function ifcPolyLoops(entities) {
  const points = ifcCartesianPoints(entities);
  const loops = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPOLYLOOP") continue;
    const loopPoints = stepRefs(entity.args).map((ref) => points.get(ref)).filter(Boolean);
    if (loopPoints.length >= 3) loops.set(entity.id, loopPoints);
  }

  const vertices = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCVERTEXPOINT") continue;
    const pointRef = stepRefs(entity.args).find((ref) => points.has(ref));
    if (pointRef) vertices.set(entity.id, points.get(pointRef));
  }

  const edgeCurves = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCEDGE" && entity.type !== "IFCEDGECURVE") continue;
    const vertexRefs = stepRefs(entity.args).filter((ref) => vertices.has(ref));
    if (vertexRefs.length >= 2) edgeCurves.set(entity.id, [vertices.get(vertexRefs[0]), vertices.get(vertexRefs[1])]);
  }

  const orientedEdges = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCORIENTEDEDGE") continue;
    const edgeRef = stepRefs(entity.args).find((ref) => edgeCurves.has(ref));
    const edge = edgeCurves.get(edgeRef);
    if (!edge) continue;
    const args = splitStepArguments(entity.args);
    const sameSense = !/\.F\./i.test(args[args.length - 1] || "");
    orientedEdges.set(entity.id, sameSense ? edge : [edge[1], edge[0]]);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCEDGELOOP") continue;
    const segments = stepRefs(entity.args).map((ref) => orientedEdges.get(ref)).filter(Boolean);
    if (segments.length < 3) continue;
    const loopPoints = [segments[0][0], segments[0][1]];
    let connected = true;
    for (const segment of segments.slice(1)) {
      const lastPoint = loopPoints[loopPoints.length - 1];
      if (samePoint(lastPoint, segment[0])) {
        loopPoints.push(segment[1]);
      } else if (samePoint(lastPoint, segment[1])) {
        loopPoints.push(segment[0]);
      } else {
        connected = false;
        break;
      }
    }
    if (!connected) continue;
    if (samePoint(loopPoints[0], loopPoints[loopPoints.length - 1])) loopPoints.pop();
    if (loopPoints.length >= 3) loops.set(entity.id, loopPoints);
  }

  return loops;
}

function ifcStandaloneVertexPointGroups(entities, diagnostics = null) {
  const points = ifcCartesianPoints(entities);
  const invalidPointRefs = ifcInvalidCartesianPointRefs(entities);
  const edgeVertexRefs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCEDGE" && entity.type !== "IFCEDGECURVE") continue;
    for (const ref of stepRefs(entity.args)) {
      if (entities.get(ref)?.type === "IFCVERTEXPOINT") edgeVertexRefs.add(ref);
    }
  }
  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCVERTEXPOINT" || edgeVertexRefs.has(entity.id)) continue;
    const refs = stepRefs(entity.args);
    const pointRef = refs.find((ref) => points.has(ref));
    const invalidPointRef = refs.find((ref) => invalidPointRefs.has(ref));
    if (!pointRef && invalidPointRef) {
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-vertex-point-invalid-skipped",
        `IFC IFCVERTEXPOINT #${entity.id} references malformed IFCCARTESIANPOINT #${invalidPointRef}; skipping standalone point.`
      );
      continue;
    }
    const point = pointRef ? points.get(pointRef) : null;
    if (finiteVec3(point)) groups.set(entity.id, [point]);
  }
  return groups;
}

function transformIfcPointRecords(records, transform) {
  return (records || [])
    .map((record) => ({
      ...record,
      point: ifcTransformPoint(transform, record.point)
    }))
    .filter((record) => finiteVec3(record.point));
}

function ifcMappedItemPointRecords(entities, pointGroups, diagnostics, resolveItemAppearance, resolveItemLayer = () => null) {
  const representationMaps = ifcRepresentationMaps(entities);
  const operators = ifcCartesianTransformationOperators(entities);
  const invalidOperators = ifcInvalidCartesianTransformationOperatorRefs(entities);
  const mappedItems = new Map();
  const sourceItemRefs = new Set();
  let mappedCount = 0;
  let mappedPointCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "IFCMAPPEDITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidPointItemRefs = representationMap.itemRefs.filter((itemRef) => pointGroups.get(itemRef)?.length);
      if (!invalidPointItemRefs.length) continue;
      for (const itemRef of invalidPointItemRefs) sourceItemRefs.add(itemRef);
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-mapped-item-invalid-transform-skipped",
        `IFC IFCMAPPEDITEM #${entity.id} references IFCCARTESIANTRANSFORMATIONOPERATOR #${invalidTargetRef} with ${ifcInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped point geometry.`
      );
      continue;
    }
    const operator = operators.get(targetRef) || identityIfcTransform();
    const transform = composeIfcTransforms(operator, representationMap.transform);
    const mappedAppearance = resolveItemAppearance(entity.id);
    const mappedLayer = resolveItemLayer(entity.id);
    const pointRecords = [];
    for (const itemRef of representationMap.itemRefs) {
      const sourcePoints = pointGroups.get(itemRef);
      if (!sourcePoints?.length) continue;
      sourceItemRefs.add(itemRef);
      const points = transformIfcPoints(sourcePoints, transform).filter(finiteVec3);
      pointRecords.push(...styledPointRecords(
        points,
        appearanceWithOverride(resolveItemAppearance(itemRef), mappedAppearance),
        { sourceLayer: mappedLayer || resolveItemLayer(itemRef) }
      ));
      mappedPointCount += points.length;
    }
    if (!pointRecords.length) continue;
    mappedItems.set(entity.id, pointRecords);
    mappedCount += 1;
  }

  if (mappedCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-mapped-vertex-points-applied",
      `Applied IFCMAPPEDITEM representation maps to ${mappedPointCount} standalone IFCVERTEXPOINT item(s) from ${mappedCount} mapped item(s).`
    );
  }

  return { mappedItems, sourceItemRefs };
}

function ifcStandaloneVertexPointRecords(entities, diagnostics = []) {
  const pointGroups = ifcStandaloneVertexPointGroups(entities, diagnostics);
  const resolveItemAppearance = ifcItemAppearanceResolver(entities);
  const resolveItemLayer = ifcPresentationLayerResolver(entities);
  const { mappedItems, sourceItemRefs } = ifcMappedItemPointRecords(entities, pointGroups, diagnostics, resolveItemAppearance, resolveItemLayer);
  const placements = ifcLocalPlacementTransforms(entities);
  const invalidLocalPlacementRefs = ifcInvalidLocalPlacementRefs(entities);
  const definitions = ifcProductDefinitionItems(entities);
  const placedItemRefs = new Set();
  const suppressedItemRefs = new Set();
  const placedPointRecords = [];
  let placedProductCount = 0;
  let placedPointCount = 0;

  for (const entity of entities.values()) {
    if (!IFC_PRODUCT_TYPES.has(entity.type)) continue;
    const refs = stepRefs(entity.args);
    const definitionRef = refs.find((ref) => definitions.has(ref));
    if (!definitionRef) continue;
    const invalidPlacementRef = ifcInvalidProductPlacementRef(entity, invalidLocalPlacementRefs);
    if (invalidPlacementRef) {
      ifcReportInvalidProductPlacement(diagnostics, entity, invalidPlacementRef, invalidLocalPlacementRefs.get(invalidPlacementRef));
      suppressProductDefinitionItems(suppressedItemRefs, definitions, definitionRef);
      continue;
    }
    const placementRef = refs.find((ref) => placements.has(ref));
    const transform = placements.get(placementRef) || identityIfcTransform();
    let productPointCount = 0;
    for (const itemRef of definitions.get(definitionRef) || []) {
      const directPoints = pointGroups.get(itemRef);
      if (directPoints?.length) {
        placedItemRefs.add(itemRef);
        const points = transformIfcPoints(directPoints, transform).filter(finiteVec3);
        placedPointRecords.push(...styledPointRecords(points, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
        productPointCount += directPoints.length;
        continue;
      }
      const mappedPointRecords = mappedItems.get(itemRef);
      if (mappedPointRecords?.length) {
        placedItemRefs.add(itemRef);
        placedPointRecords.push(...transformIfcPointRecords(mappedPointRecords, transform));
        productPointCount += mappedPointRecords.length;
      }
    }
    if (productPointCount) {
      placedProductCount += 1;
      placedPointCount += productPointCount;
    }
  }

  if (placedPointCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-vertex-point-placement-applied",
      `Applied IFCLOCALPLACEMENT transforms to ${placedPointCount} standalone IFCVERTEXPOINT item(s) from ${placedProductCount} product(s).`
    );
  }

  const records = [
    ...placedPointRecords,
    ...[...mappedItems.entries()].filter(([itemRef]) => !placedItemRefs.has(itemRef) && !suppressedItemRefs.has(itemRef)).flatMap(([, pointRecords]) => pointRecords),
    ...[...pointGroups.entries()]
      .filter(([itemRef]) => !placedItemRefs.has(itemRef) && !suppressedItemRefs.has(itemRef) && !sourceItemRefs.has(itemRef))
      .flatMap(([itemRef, points]) => styledPointRecords(points, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }))
  ];
  const uniqueRecords = [];
  for (const record of records) {
    if (!finiteVec3(record.point)) continue;
    if (uniqueRecords.some((candidate) => samePoint(candidate.point, record.point))) continue;
    uniqueRecords.push(record);
  }
  return uniqueRecords;
}

function ifcFacetedBreps(entities, diagnostics) {
  const loops = ifcPolyLoops(entities);
  const outerBounds = new Map();
  const faceBounds = new Map();
  for (const entity of entities.values()) {
    const [loopRef] = stepRefs(entity.args);
    if (!loopRef || !loops.has(loopRef)) continue;
    if (entity.type === "IFCFACEOUTERBOUND") outerBounds.set(entity.id, loops.get(loopRef));
    else if (entity.type === "IFCFACEBOUND") faceBounds.set(entity.id, loops.get(loopRef));
  }

  const faceMap = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACE") continue;
    const refs = stepRefs(entity.args);
    const outer = refs.map((ref) => outerBounds.get(ref)).find(Boolean)
      || refs.map((ref) => faceBounds.get(ref)).find(Boolean);
    if (outer) faceMap.set(entity.id, outer);
  }

  const shellMap = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCLOSEDSHELL" && entity.type !== "IFCOPENSHELL") continue;
    const shellFaces = stepRefs(entity.args).map((ref) => faceMap.get(ref)).filter(Boolean);
    if (shellFaces.length) shellMap.set(entity.id, shellFaces);
  }

  const breps = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACETEDBREP") continue;
    const brepFaces = stepRefs(entity.args).flatMap((ref) => shellMap.get(ref) || []);
    if (brepFaces.length) breps.set(entity.id, brepFaces);
  }

  if (!breps.size) {
    const fallbackFaces = [...faceMap.values()];
    if (!fallbackFaces.length) fallbackFaces.push(...loops.values());
    if (fallbackFaces.length) breps.set("IFC-FACE-LOOPS", fallbackFaces);
  }
  return breps;
}

function ifcFacetedRepresentationFaceGroups(entities) {
  const loops = ifcPolyLoops(entities);
  const outerBounds = new Map();
  const faceBounds = new Map();
  for (const entity of entities.values()) {
    const [loopRef] = stepRefs(entity.args);
    if (!loopRef || !loops.has(loopRef)) continue;
    if (entity.type === "IFCFACEOUTERBOUND") outerBounds.set(entity.id, loops.get(loopRef));
    else if (entity.type === "IFCFACEBOUND") faceBounds.set(entity.id, loops.get(loopRef));
  }

  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACE") continue;
    const refs = stepRefs(entity.args);
    const outer = refs.map((ref) => outerBounds.get(ref)).find(Boolean)
      || refs.map((ref) => faceBounds.get(ref)).find(Boolean);
    if (outer) groups.set(entity.id, [outer]);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCCLOSEDSHELL" && entity.type !== "IFCOPENSHELL") continue;
    const shellFaces = stepRefs(entity.args).flatMap((ref) => groups.get(ref) || []);
    if (shellFaces.length) groups.set(entity.id, shellFaces);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACETEDBREP") continue;
    const brepFaces = stepRefs(entity.args).flatMap((ref) => groups.get(ref) || []);
    if (brepFaces.length) groups.set(entity.id, brepFaces);
  }

  return groups;
}

function ifcColourRgbLists(entities) {
  const lists = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCOLOURRGBLIST") continue;
    const colors = stepNumberTuples(entity.args)
      .map((tuple) => tuple.length >= 3 ? `#${ifcColorComponentHex(tuple[0])}${ifcColorComponentHex(tuple[1])}${ifcColorComponentHex(tuple[2])}` : null)
      .filter(Boolean);
    if (colors.length) lists.set(entity.id, colors);
  }
  return lists;
}

function ifcIndexedColourMapOpacity(raw) {
  const opacity = styleRatioArgument(raw, null);
  if (!Number.isFinite(opacity) || opacity >= 1) return null;
  return canonicalOpacity(opacity);
}

function ifcIndexedColourMaps(entities, diagnostics) {
  const colourLists = ifcColourRgbLists(entities);
  const maps = new Map();
  let missingColourListCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "IFCINDEXEDCOLOURMAP") continue;
    const args = splitStepArguments(entity.args);
    const targetRef = stepRefs(args[0] || "")[0];
    const colourListRef = stepRefs(args[2] || "").find((ref) => colourLists.has(ref));
    const colours = colourLists.get(colourListRef);
    const colourIndices = stepNumberList(args[3] || "")
      .filter((value) => Number.isInteger(value) && value > 0);
    if (!targetRef || !colours || !colourIndices.length) {
      missingColourListCount += 1;
      continue;
    }
    maps.set(targetRef, {
      colours,
      colourIndices,
      opacity: ifcIndexedColourMapOpacity(args[1])
    });
  }
  if (maps.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-indexed-colour-map-applied",
      `Applied IFC indexed colour maps to ${maps.size} tessellated face set(s).`
    );
  }
  if (missingColourListCount) {
    addDiagnostic(
      diagnostics,
      "warning",
      "ifc-indexed-colour-map-skipped",
      `Skipped ${missingColourListCount} IFC indexed colour map(s) because their target, colour list, or colour indices were unsupported.`
    );
  }
  return maps;
}

function ifcIndexedColourMapAppearance(indexedColourMap, faceIndex) {
  if (!indexedColourMap) return null;
  const colourIndex = indexedColourMap.colourIndices[faceIndex];
  const color = indexedColourMap.colours[colourIndex - 1];
  if (!color && !Number.isFinite(indexedColourMap.opacity)) return null;
  return {
    color,
    opacity: indexedColourMap.opacity
  };
}

function ifcTriangulatedFaceGroups(entities, diagnostics, indexedColourMaps = new Map()) {
  const pointLists = ifcPointLists(entities);
  const invalidPointListRefs = ifcInvalidPointListRefs(entities);
  const faceGroups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCTRIANGULATEDFACESET") continue;
    const args = splitStepArguments(entity.args);
    const pointListRef = stepRefs(args[0] || "").find((ref) => pointLists.has(ref)) || stepRefs(entity.args).find((ref) => pointLists.has(ref));
    const invalidPointListRef = stepRefs(args[0] || "").find((ref) => invalidPointListRefs.has(ref)) || stepRefs(entity.args).find((ref) => invalidPointListRefs.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) {
      if (invalidPointListRef) {
        addDiagnostic(diagnostics, "warning", "ifc-tessellated-points-invalid-skipped", `IFC IFCTRIANGULATEDFACESET #${entity.id} points to malformed IFCCARTESIANPOINTLIST #${invalidPointListRef}; skipping tessellated face set.`);
      } else {
        addDiagnostic(diagnostics, "warning", "ifc-tessellated-points-missing", `IFC IFCTRIANGULATEDFACESET #${entity.id} points to a missing IFCCARTESIANPOINTLIST3D.`);
      }
      continue;
    }
    const faces = [];
    const indexTuples = stepIntegerTuples(args[2] || entity.args);
    for (const tuple of indexTuples) {
      const face = tuple.map((index) => points[index - 1]).filter(Boolean);
      if (face.length >= 3) faces.push(ifcFaceEntry(face, ifcIndexedColourMapAppearance(indexedColourMaps.get(entity.id), faces.length)));
    }
    if (faces.length) faceGroups.set(entity.id, faces);
  }
  return faceGroups;
}

function ifcPolygonalFaceGroups(entities, diagnostics, indexedColourMaps = new Map()) {
  const pointLists = ifcPointLists(entities);
  const invalidPointListRefs = ifcInvalidPointListRefs(entities);
  const indexedFaces = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCINDEXEDPOLYGONALFACE" && entity.type !== "IFCINDEXEDPOLYGONALFACEWITHVOIDS") continue;
    const [outerFace] = stepIntegerTuples(entity.args);
    if (!outerFace) continue;
    indexedFaces.set(entity.id, outerFace);
  }

  const faceGroups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPOLYGONALFACESET") continue;
    const refs = stepRefs(entity.args);
    const pointListRef = refs.find((ref) => pointLists.has(ref));
    const invalidPointListRef = refs.find((ref) => invalidPointListRefs.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) {
      if (invalidPointListRef) {
        addDiagnostic(diagnostics, "warning", "ifc-polygonal-points-invalid-skipped", `IFC IFCPOLYGONALFACESET #${entity.id} points to malformed IFCCARTESIANPOINTLIST #${invalidPointListRef}; skipping polygonal face set.`);
      } else {
        addDiagnostic(diagnostics, "warning", "ifc-polygonal-points-missing", `IFC IFCPOLYGONALFACESET #${entity.id} points to a missing IFCCARTESIANPOINTLIST3D.`);
      }
      continue;
    }
    const faces = [];
    for (const faceRef of refs.filter((ref) => indexedFaces.has(ref))) {
      const face = indexedFaces.get(faceRef).map((index) => points[index - 1]).filter(Boolean);
      if (face.length >= 3) faces.push(ifcFaceEntry(face, ifcIndexedColourMapAppearance(indexedColourMaps.get(entity.id), faces.length)));
    }
    if (faces.length) faceGroups.set(entity.id, faces);
  }
  return faceGroups;
}

function ifcPolygonalVoidLoopGroups(entities, diagnostics) {
  const pointLists = ifcPointLists(entities);
  const indexedVoids = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCINDEXEDPOLYGONALFACEWITHVOIDS") continue;
    const voids = stepIntegerTuples(entity.args).slice(1).filter((tuple) => tuple.length >= 3);
    if (voids.length) indexedVoids.set(entity.id, voids);
  }

  const loopGroups = new Map();
  let voidLoopCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPOLYGONALFACESET") continue;
    const refs = stepRefs(entity.args);
    const pointListRef = refs.find((ref) => pointLists.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) continue;
    const loops = [];
    for (const faceRef of refs.filter((ref) => indexedVoids.has(ref))) {
      for (const voidFace of indexedVoids.get(faceRef)) {
        const loop = voidFace.map((index) => points[index - 1]).filter(Boolean);
        if (loop.length >= 3) loops.push(loop);
      }
    }
    if (!loops.length) continue;
    loopGroups.set(entity.id, loops);
    voidLoopCount += loops.length;
  }

  if (voidLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-polygonal-void-linework",
      `Preserved ${voidLoopCount} IFC IFCINDEXEDPOLYGONALFACEWITHVOIDS inner loop(s) as canonical reference linework; mesh faces still use outer loops only.`
    );
  }
  return loopGroups;
}

function angleDeltaCcw(from, to) {
  const full = Math.PI * 2;
  return ((to - from) % full + full) % full;
}

function ifcArcIndexPoints(points) {
  const [start, middle, end] = points;
  if (!start || !middle || !end || samePoint(start, middle) || samePoint(middle, end) || samePoint(start, end)) {
    return points.filter(Boolean);
  }

  const startToMiddle = vecSub(middle, start);
  const startToEnd = vecSub(end, start);
  const normal = vecCross(startToMiddle, startToEnd);
  const normalLength = vecLength(normal);
  if (normalLength < 1e-9) return [start, middle, end];

  const axisX = vecUnit(startToMiddle, [1, 0, 0]);
  const axisY = vecUnit(vecCross(vecUnit(normal), axisX), [0, 1, 0]);
  const middleX = vecLength(startToMiddle);
  const endX = vecDot(startToEnd, axisX);
  const endY = vecDot(startToEnd, axisY);
  if (Math.abs(endY) < 1e-9) return [start, middle, end];

  const centerX = middleX / 2;
  const centerY = (endX * endX + endY * endY - middleX * endX) / (2 * endY);
  const radius = Math.hypot(centerX, centerY);
  if (!Number.isFinite(radius) || radius < 1e-9) return [start, middle, end];

  const center = vecAdd(start, vecAdd(vecMul(axisX, centerX), vecMul(axisY, centerY)));
  const startAngle = Math.atan2(-centerY, -centerX);
  const middleAngle = Math.atan2(-centerY, middleX - centerX);
  const endAngle = Math.atan2(endY - centerY, endX - centerX);
  const ccwSpan = angleDeltaCcw(startAngle, endAngle);
  const middleCcw = angleDeltaCcw(startAngle, middleAngle);
  const span = middleCcw <= ccwSpan + 1e-9 ? ccwSpan : ccwSpan - Math.PI * 2;
  const steps = Math.max(4, Math.ceil(IFC_INDEXED_POLYCURVE_ARC_SEGMENTS * Math.min(Math.abs(span), Math.PI * 2) / (Math.PI * 2)));
  const arc = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = startAngle + span * (index / steps);
    arc.push(vecAdd(center, vecAdd(vecMul(axisX, Math.cos(angle) * radius), vecMul(axisY, Math.sin(angle) * radius))));
  }
  arc[0] = start;
  arc[arc.length - 1] = end;
  return arc;
}

function ifcIndexedPolyCurveSegmentGroups(entities, diagnostics, options = {}) {
  const pointLists = ifcPointLists(entities);
  const invalidPointListRefs = ifcInvalidPointListRefs(entities);
  const internalCurveRefs = options.includeInternal ? new Set() : ifcInternalCurveRefs(entities);
  const indexedSegments = new Map();
  let sampledArcCount = 0;
  let chordedArcCount = 0;

  for (const entity of entities.values()) {
    if (entity.type !== "IFCLINEINDEX" && entity.type !== "IFCARCINDEX") continue;
    const [indices] = stepIntegerTuplesAtLeast(entity.args, entity.type === "IFCLINEINDEX" ? 2 : 3);
    if (!indices) continue;
    indexedSegments.set(entity.id, {
      indices,
      arc: entity.type === "IFCARCINDEX"
    });
  }

  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCINDEXEDPOLYCURVE") continue;
    if (internalCurveRefs.has(entity.id)) continue;
    const refs = stepRefs(entity.args);
    const pointListRef = refs.find((ref) => pointLists.has(ref));
    const invalidPointListRef = refs.find((ref) => invalidPointListRefs.has(ref));
    const points = pointLists.get(pointListRef);
    if (!points) {
      if (invalidPointListRef) {
        addDiagnostic(diagnostics, "warning", "ifc-indexed-polycurve-points-invalid-skipped", `IFC IFCINDEXEDPOLYCURVE #${entity.id} points to malformed IFCCARTESIANPOINTLIST #${invalidPointListRef}; skipping indexed polycurve.`);
      } else {
        addDiagnostic(diagnostics, "warning", "ifc-indexed-polycurve-points-missing", `IFC IFCINDEXEDPOLYCURVE #${entity.id} points to a missing IFCCARTESIANPOINTLIST2D/3D.`);
      }
      continue;
    }
    const segments = [];
    const segmentRefs = refs.filter((ref) => indexedSegments.has(ref));
    const segmentSpecs = segmentRefs.length
      ? segmentRefs.map((ref) => indexedSegments.get(ref))
      : [{ indices: points.map((_, index) => index + 1), arc: false }];
    for (const spec of segmentSpecs) {
      if (spec.arc) {
        const arcPoints = ifcArcIndexPoints(spec.indices.map((pointIndex) => points[pointIndex - 1]).filter(Boolean));
        if (arcPoints.length > 3) {
          sampledArcCount += 1;
          for (let index = 1; index < arcPoints.length; index += 1) {
            if (!samePoint(arcPoints[index - 1], arcPoints[index])) segments.push({ start: arcPoints[index - 1], end: arcPoints[index] });
          }
          continue;
        }
        chordedArcCount += 1;
      }
      for (let index = 1; index < spec.indices.length; index += 1) {
        const start = points[spec.indices[index - 1] - 1];
        const end = points[spec.indices[index] - 1];
        if (start && end && !samePoint(start, end)) segments.push({ start, end });
      }
    }
    if (segments.length) groups.set(entity.id, segments);
  }

  if (groups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-indexed-polycurve-linework",
      `Translated ${groups.size} IFC IFCINDEXEDPOLYCURVE item(s) into canonical reference linework.`
    );
  }
  if (sampledArcCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-indexed-polycurve-arc-sampled",
      `Sampled ${sampledArcCount} IFC IFCARCINDEX segment(s) into canonical reference linework.`
    );
  }
  if (chordedArcCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-indexed-polycurve-arc-chorded",
      `Approximated ${chordedArcCount} degenerate IFC IFCARCINDEX segment(s) as canonical chord linework.`
    );
  }
  return groups;
}

function ifcTessellatedFaceGroups(entities, diagnostics) {
  const indexedColourMaps = ifcIndexedColourMaps(entities, diagnostics);
  const faceGroups = new Map([
    ...ifcTriangulatedFaceGroups(entities, diagnostics, indexedColourMaps),
    ...ifcPolygonalFaceGroups(entities, diagnostics, indexedColourMaps)
  ]);
  if (faceGroups.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-tessellated-face-set-applied",
      `Translated ${faceGroups.size} IFC tessellated face set(s) into canonical mesh faces.`
    );
  }
  return faceGroups;
}

function ifcInnerBoundGroups(entities, diagnostics) {
  const loops = ifcPolyLoops(entities);
  const outerBounds = new Map();
  const innerBounds = new Map();
  for (const entity of entities.values()) {
    const [loopRef] = stepRefs(entity.args);
    if (!loopRef || !loops.has(loopRef)) continue;
    if (entity.type === "IFCFACEOUTERBOUND") outerBounds.set(entity.id, loops.get(loopRef));
    else if (entity.type === "IFCFACEBOUND") innerBounds.set(entity.id, loops.get(loopRef));
  }

  const faceInnerLoops = new Map();
  let innerLoopCount = 0;
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACE") continue;
    const refs = stepRefs(entity.args);
    const hasExplicitOuter = refs.some((ref) => outerBounds.has(ref));
    const innerRefs = refs.filter((ref) => innerBounds.has(ref));
    const effectiveInnerRefs = hasExplicitOuter ? innerRefs : innerRefs.slice(1);
    const loopsForFace = effectiveInnerRefs.map((ref) => innerBounds.get(ref));
    if (!loopsForFace.length) continue;
    faceInnerLoops.set(entity.id, loopsForFace);
    innerLoopCount += loopsForFace.length;
  }

  const shellInnerLoops = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCLOSEDSHELL" && entity.type !== "IFCOPENSHELL") continue;
    const shellLoops = stepRefs(entity.args).flatMap((ref) => faceInnerLoops.get(ref) || []);
    if (shellLoops.length) shellInnerLoops.set(entity.id, shellLoops);
  }

  const brepInnerLoops = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACETEDBREP") continue;
    const brepLoops = stepRefs(entity.args).flatMap((ref) => shellInnerLoops.get(ref) || []);
    if (brepLoops.length) brepInnerLoops.set(entity.id, brepLoops);
  }

  if (!brepInnerLoops.size && faceInnerLoops.size) {
    brepInnerLoops.set("IFC-FACE-LOOPS", [...faceInnerLoops.values()].flat());
  }

  if (innerLoopCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-inner-bound-linework",
      `Preserved ${innerLoopCount} IFCFACEBOUND inner loop(s) as canonical reference linework; mesh faces still use outer loops only.`
    );
  }
  return brepInnerLoops;
}

function ifcInnerBoundRepresentationLoopGroups(entities) {
  const loops = ifcPolyLoops(entities);
  const outerBounds = new Map();
  const innerBounds = new Map();
  for (const entity of entities.values()) {
    const [loopRef] = stepRefs(entity.args);
    if (!loopRef || !loops.has(loopRef)) continue;
    if (entity.type === "IFCFACEOUTERBOUND") outerBounds.set(entity.id, loops.get(loopRef));
    else if (entity.type === "IFCFACEBOUND") innerBounds.set(entity.id, loops.get(loopRef));
  }

  const groups = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACE") continue;
    const refs = stepRefs(entity.args);
    const hasExplicitOuter = refs.some((ref) => outerBounds.has(ref));
    const innerRefs = refs.filter((ref) => innerBounds.has(ref));
    const effectiveInnerRefs = hasExplicitOuter ? innerRefs : innerRefs.slice(1);
    const loopsForFace = effectiveInnerRefs.map((ref) => innerBounds.get(ref));
    if (loopsForFace.length) groups.set(entity.id, loopsForFace);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCCLOSEDSHELL" && entity.type !== "IFCOPENSHELL") continue;
    const shellLoops = stepRefs(entity.args).flatMap((ref) => groups.get(ref) || []);
    if (shellLoops.length) groups.set(entity.id, shellLoops);
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCFACETEDBREP") continue;
    const brepLoops = stepRefs(entity.args).flatMap((ref) => groups.get(ref) || []);
    if (brepLoops.length) groups.set(entity.id, brepLoops);
  }

  return groups;
}

function ifcShapeRepresentationItems(entities) {
  const representations = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCSHAPEREPRESENTATION") continue;
    const refs = stepRefs(entity.args);
    if (refs.length) representations.set(entity.id, refs);
  }
  return representations;
}

function ifcProductDefinitionItems(entities) {
  const shapeRepresentations = ifcShapeRepresentationItems(entities);
  const definitions = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPRODUCTDEFINITIONSHAPE") continue;
    const refs = stepRefs(entity.args);
    const itemRefs = refs.flatMap((ref) => shapeRepresentations.get(ref) || [ref]);
    if (itemRefs.length) definitions.set(entity.id, itemRefs);
  }
  return definitions;
}

function ifcInvalidProductPlacementRef(entity, invalidLocalPlacementRefs) {
  return stepRefs(entity.args).find((ref) => invalidLocalPlacementRefs.has(ref)) || null;
}

function ifcReportInvalidProductPlacement(diagnostics, entity, placementRef, detail) {
  addDiagnosticOnce(
    diagnostics,
    "warning",
    "ifc-local-placement-invalid-skipped",
    `IFC ${entity.type} #${entity.id} references IFCLOCALPLACEMENT #${placementRef} with ${ifcInvalidLocalPlacementDetailText(detail)}; skipping product reference geometry.`
  );
}

function suppressProductDefinitionItems(suppressedItemRefs, definitions, definitionRef) {
  for (const itemRef of definitions.get(definitionRef) || []) suppressedItemRefs.add(itemRef);
}

function ifcPresentationLayerAssignments(entities) {
  const layers = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCPRESENTATIONLAYERASSIGNMENT" && entity.type !== "IFCPRESENTATIONLAYERWITHSTYLE") continue;
    const args = splitStepArguments(entity.args);
    const layer = sourcePresentationLayer("ifc", stepStringValue(args[0] || entity.args));
    if (!layer) continue;
    for (const ref of stepRefs(args[2] || entity.args)) {
      if (!layers.has(ref)) layers.set(ref, layer);
    }
  }
  return layers;
}

function ifcPresentationLayerResolver(entities) {
  const layers = ifcPresentationLayerAssignments(entities);
  const shapeRepresentations = ifcShapeRepresentationItems(entities);
  const productDefinitions = ifcProductDefinitionItems(entities);
  const representationMaps = ifcRepresentationMaps(entities);
  let changed = true;
  while (changed) {
    changed = false;
    const propagate = (parentRef, childRefs) => {
      const layer = layers.get(parentRef);
      if (!layer) return;
      for (const childRef of childRefs || []) {
        if (!childRef || layers.has(childRef)) continue;
        layers.set(childRef, layer);
        changed = true;
      }
    };

    for (const [representationRef, itemRefs] of shapeRepresentations.entries()) {
      propagate(representationRef, itemRefs);
    }
    for (const [mapRef, representationMap] of representationMaps.entries()) {
      propagate(mapRef, representationMap.itemRefs);
    }
    for (const [definitionRef, itemRefs] of productDefinitions.entries()) {
      propagate(definitionRef, itemRefs);
    }
  }
  return (ref) => layers.get(ref) || null;
}

function ifcRepresentationMaps(entities) {
  const shapeRepresentations = ifcShapeRepresentationItems(entities);
  const axisPlacements = ifcAxisPlacementTransforms(entities);
  const maps = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCREPRESENTATIONMAP") continue;
    const refs = stepRefs(entity.args);
    const originRef = refs.find((ref) => axisPlacements.has(ref));
    const representationRef = refs.find((ref) => shapeRepresentations.has(ref));
    const itemRefs = shapeRepresentations.get(representationRef) || [];
    if (itemRefs.length) {
      maps.set(entity.id, {
        transform: axisPlacements.get(originRef) || identityIfcTransform(),
        itemRefs
      });
    }
  }
  return maps;
}

const IFC_DEFAULT_MESH_COLOR = "#475569";

function ifcColorComponentHex(value) {
  const normalized = Math.max(0, Math.min(1, parseStepNumber(value, NaN)));
  return Math.round(normalized * 255).toString(16).padStart(2, "0");
}

function ifcRatioArgument(raw, fallback = null) {
  return styleRatioArgument(raw, fallback);
}

function ifcRgbHex(raw) {
  const args = splitStepArguments(raw);
  const red = ifcRatioArgument(args[1]);
  const green = ifcRatioArgument(args[2]);
  const blue = ifcRatioArgument(args[3]);
  if (![red, green, blue].every(Number.isFinite)) return null;
  return `#${ifcColorComponentHex(red)}${ifcColorComponentHex(green)}${ifcColorComponentHex(blue)}`;
}

function ifcStyleColors(entities) {
  const colors = new Map();
  for (const entity of entities.values()) {
    let color = null;
    if (entity.type === "IFCCOLOURRGB") color = ifcRgbHex(entity.args);
    else if (entity.type === "IFCDRAUGHTINGPREDEFINEDCOLOUR" || entity.type === "IFCPREDEFINEDCOLOUR") {
      color = predefinedStyleColorHex(entity.args);
    }
    if (color) colors.set(entity.id, color);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities.values()) {
      if (colors.has(entity.id)) continue;
      if (
        entity.type !== "IFCSURFACESTYLERENDERING"
        && entity.type !== "IFCSURFACESTYLESHADING"
        && entity.type !== "IFCCURVESTYLE"
        && entity.type !== "IFCSURFACESTYLE"
        && entity.type !== "IFCPRESENTATIONSTYLEASSIGNMENT"
      ) {
        continue;
      }
      const colorRef = stepRefs(entity.args).find((ref) => colors.has(ref));
      const color = colors.get(colorRef);
      if (!color) continue;
      colors.set(entity.id, color);
      changed = true;
    }
  }

  return colors;
}

function ifcStyleOpacities(entities) {
  const opacities = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCSURFACESTYLERENDERING" && entity.type !== "IFCSURFACESTYLESHADING") continue;
    const args = splitStepArguments(entity.args);
    const opacity = opacityFromTransparencyArgument(args[1]);
    if (Number.isFinite(opacity)) opacities.set(entity.id, opacity);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities.values()) {
      if (opacities.has(entity.id)) continue;
      if (
        entity.type !== "IFCSURFACESTYLE"
        && entity.type !== "IFCPRESENTATIONSTYLEASSIGNMENT"
      ) {
        continue;
      }
      const opacityRef = stepRefs(entity.args).find((ref) => opacities.has(ref));
      const opacity = opacities.get(opacityRef);
      if (!Number.isFinite(opacity)) continue;
      opacities.set(entity.id, opacity);
      changed = true;
    }
  }

  return opacities;
}

function ifcStyledItemColors(entities) {
  const styleColors = ifcStyleColors(entities);
  const itemColors = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCSTYLEDITEM") continue;
    const args = splitStepArguments(entity.args);
    const itemRef = stepRefs(args[0] || "")[0];
    if (!itemRef) continue;
    const styleRefs = stepRefs(args.slice(1).join(","));
    const colorRef = styleRefs.find((ref) => styleColors.has(ref));
    const color = styleColors.get(colorRef);
    if (color) itemColors.set(itemRef, color);
  }
  propagateIfcRepresentationStyleMap(entities, itemColors, Boolean);
  return itemColors;
}

function ifcStyledItemOpacities(entities) {
  const styleOpacities = ifcStyleOpacities(entities);
  const itemOpacities = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCSTYLEDITEM") continue;
    const args = splitStepArguments(entity.args);
    const itemRef = stepRefs(args[0] || "")[0];
    if (!itemRef) continue;
    const styleRefs = stepRefs(args.slice(1).join(","));
    const opacityRef = styleRefs.find((ref) => styleOpacities.has(ref));
    const opacity = styleOpacities.get(opacityRef);
    if (Number.isFinite(opacity)) itemOpacities.set(itemRef, opacity);
  }
  propagateIfcRepresentationStyleMap(entities, itemOpacities, Number.isFinite);
  return itemOpacities;
}

function propagateIfcRepresentationStyleMap(entities, itemValues, hasValue) {
  const shapeRepresentations = ifcShapeRepresentationItems(entities);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [representationRef, itemRefs] of shapeRepresentations.entries()) {
      const value = itemValues.get(representationRef);
      if (!hasValue(value)) continue;
      for (const itemRef of itemRefs || []) {
        if (!itemRef || hasValue(itemValues.get(itemRef))) continue;
        itemValues.set(itemRef, value);
        changed = true;
      }
    }
  }
}

function ifcItemColorResolver(entities) {
  const representationMaps = ifcRepresentationMaps(entities);
  const colors = ifcStyledItemColors(entities);
  const resolving = new Set();

  function resolve(ref) {
    if (!ref) return null;
    if (colors.has(ref)) return colors.get(ref);
    if (resolving.has(ref)) return null;
    const entity = entities.get(ref);
    if (!entity) return null;

    resolving.add(ref);
    let color = null;
    const refs = stepRefs(entity.args);
    if (entity.type === "IFCBOOLEANRESULT" || entity.type === "IFCBOOLEANCLIPPINGRESULT") {
      color = refs.map((sourceRef) => resolve(sourceRef)).find(Boolean) || null;
    } else if (entity.type === "IFCMAPPEDITEM") {
      const sourceRef = refs.find((candidate) => representationMaps.has(candidate));
      const representationMap = representationMaps.get(sourceRef);
      color = (representationMap?.itemRefs || []).map((itemRef) => resolve(itemRef)).find(Boolean) || null;
    }
    resolving.delete(ref);

    if (color) colors.set(ref, color);
    return color;
  }

  return resolve;
}

function ifcItemOpacityResolver(entities) {
  const representationMaps = ifcRepresentationMaps(entities);
  const opacities = ifcStyledItemOpacities(entities);
  const resolving = new Set();

  function resolve(ref) {
    if (!ref) return null;
    if (opacities.has(ref)) return opacities.get(ref);
    if (resolving.has(ref)) return null;
    const entity = entities.get(ref);
    if (!entity) return null;

    resolving.add(ref);
    let opacity = null;
    const refs = stepRefs(entity.args);
    if (entity.type === "IFCBOOLEANRESULT" || entity.type === "IFCBOOLEANCLIPPINGRESULT") {
      opacity = refs.map((sourceRef) => resolve(sourceRef)).find((value) => Number.isFinite(value)) ?? null;
    } else if (entity.type === "IFCMAPPEDITEM") {
      const sourceRef = refs.find((candidate) => representationMaps.has(candidate));
      const representationMap = representationMaps.get(sourceRef);
      opacity = (representationMap?.itemRefs || []).map((itemRef) => resolve(itemRef)).find((value) => Number.isFinite(value)) ?? null;
    }
    resolving.delete(ref);

    if (Number.isFinite(opacity)) opacities.set(ref, opacity);
    return opacity;
  }

  return resolve;
}

function ifcItemAppearanceResolver(entities) {
  const resolveColor = ifcItemColorResolver(entities);
  const resolveOpacity = ifcItemOpacityResolver(entities);
  return (ref) => ({
    color: resolveColor(ref),
    opacity: resolveOpacity(ref)
  });
}

function ifcDirectItemAppearanceResolver(entities) {
  const colors = ifcStyledItemColors(entities);
  const opacities = ifcStyledItemOpacities(entities);
  return (ref) => ({
    color: colors.get(ref) || null,
    opacity: opacities.get(ref)
  });
}

function ifcMappedItemFaces(entities, itemFaces, diagnostics, resolveItemLayer = () => null) {
  const representationMaps = ifcRepresentationMaps(entities);
  const representationItemFaces = new Map([...ifcFacetedRepresentationFaceGroups(entities), ...itemFaces]);
  const operators = ifcCartesianTransformationOperators(entities);
  const invalidOperators = ifcInvalidCartesianTransformationOperatorRefs(entities);
  const mappedItems = new Map();
  const sourceItemRefs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCMAPPEDITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidFaceItemRefs = representationMap.itemRefs.filter((itemRef) => representationItemFaces.get(itemRef)?.length);
      if (!invalidFaceItemRefs.length) continue;
      for (const itemRef of invalidFaceItemRefs) sourceItemRefs.add(itemRef);
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-mapped-item-invalid-transform-skipped",
        `IFC IFCMAPPEDITEM #${entity.id} references IFCCARTESIANTRANSFORMATIONOPERATOR #${invalidTargetRef} with ${ifcInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped mesh geometry.`
      );
      continue;
    }
    const operator = operators.get(targetRef) || identityIfcTransform();
    const transform = composeIfcTransforms(operator, representationMap.transform);
    const mappedLayer = resolveItemLayer(entity.id);
    const faces = [];
    for (const itemRef of representationMap.itemRefs) {
      const sourceFaces = representationItemFaces.get(itemRef);
      if (sourceFaces) {
        sourceItemRefs.add(itemRef);
        const transformedFaces = transformIfcFaceEntries(sourceFaces, transform);
        faces.push(...ifcFaceEntriesWithSourceLayer(transformedFaces, mappedLayer || resolveItemLayer(itemRef)));
      }
    }
    if (faces.length) mappedItems.set(entity.id, faces);
  }
  if (mappedItems.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-mapped-representation-applied",
      `Applied IFCMAPPEDITEM representation maps to ${mappedItems.size} mapped item(s).`
    );
  }
  return { mappedItems, sourceItemRefs };
}

function ifcBooleanFallbackFaceGroups(entities, itemFaces, diagnostics) {
  const groups = new Map(itemFaces);
  const booleanEntities = [...entities.values()].filter((entity) => (
    entity.type === "IFCBOOLEANRESULT" || entity.type === "IFCBOOLEANCLIPPINGRESULT"
  ));
  let fallbackCount = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of booleanEntities) {
      if (groups.has(entity.id)) continue;
      const sourceRef = stepRefs(entity.args).find((ref) => groups.has(ref));
      const sourceFaces = groups.get(sourceRef);
      if (!sourceFaces?.length) continue;
      groups.set(entity.id, sourceFaces);
      fallbackCount += 1;
      changed = true;
    }
  }
  if (fallbackCount) {
    addDiagnostic(
      diagnostics,
      "warning",
      "ifc-boolean-fallback-applied",
      `Rendered ${fallbackCount} IFC boolean/clipping result item(s) using their first supported operand; subtractive cuts are not evaluated by the built-in IFC reference translator.`
    );
  }
  return groups;
}

function ifcMappedItemLoops(entities, itemLoops) {
  const representationMaps = ifcRepresentationMaps(entities);
  const representationItemLoops = new Map([...ifcInnerBoundRepresentationLoopGroups(entities), ...itemLoops]);
  const operators = ifcCartesianTransformationOperators(entities);
  const mappedItems = new Map();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCMAPPEDITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    const operator = operators.get(targetRef) || identityIfcTransform();
    if (!representationMap) continue;
    const transform = composeIfcTransforms(operator, representationMap.transform);
    const loops = [];
    for (const itemRef of representationMap.itemRefs) {
      const sourceLoops = representationItemLoops.get(itemRef);
      if (sourceLoops) loops.push(...transformIfcFaces(sourceLoops, transform));
    }
    if (loops.length) mappedItems.set(entity.id, loops);
  }
  return mappedItems;
}

function ifcMappedItemSegments(entities, itemSegments, diagnostics, resolveItemAppearance, resolveItemLayer = () => null) {
  const representationMaps = ifcRepresentationMaps(entities);
  const operators = ifcCartesianTransformationOperators(entities);
  const invalidOperators = ifcInvalidCartesianTransformationOperatorRefs(entities);
  const mappedItems = new Map();
  const sourceItemRefs = new Set();
  for (const entity of entities.values()) {
    if (entity.type !== "IFCMAPPEDITEM") continue;
    const refs = stepRefs(entity.args);
    const sourceRef = refs.find((ref) => representationMaps.has(ref));
    const targetRef = refs.find((ref) => operators.has(ref));
    const invalidTargetRef = refs.find((ref) => invalidOperators.has(ref));
    const representationMap = representationMaps.get(sourceRef);
    if (!representationMap) continue;
    if (!targetRef && invalidTargetRef) {
      const invalidCurveItemRefs = representationMap.itemRefs.filter((itemRef) => itemSegments.get(itemRef)?.length);
      if (!invalidCurveItemRefs.length) continue;
      for (const itemRef of invalidCurveItemRefs) sourceItemRefs.add(itemRef);
      addDiagnostic(
        diagnostics,
        "warning",
        "ifc-mapped-item-invalid-transform-skipped",
        `IFC IFCMAPPEDITEM #${entity.id} references IFCCARTESIANTRANSFORMATIONOPERATOR #${invalidTargetRef} with ${ifcInvalidTransformationOperatorDetailText(invalidOperators.get(invalidTargetRef))}; skipping mapped curve linework.`
      );
      continue;
    }
    const operator = operators.get(targetRef) || identityIfcTransform();
    const transform = composeIfcTransforms(operator, representationMap.transform);
    const mappedAppearance = resolveItemAppearance(entity.id);
    const mappedLayer = resolveItemLayer(entity.id);
    const segments = [];
    for (const itemRef of representationMap.itemRefs) {
      const sourceSegments = itemSegments.get(itemRef);
      if (sourceSegments) {
        sourceItemRefs.add(itemRef);
        segments.push(...styledSegmentRecords(
          transformIfcSegments(sourceSegments, transform),
          appearanceWithOverride(resolveItemAppearance(itemRef), mappedAppearance),
          { sourceLayer: mappedLayer || resolveItemLayer(itemRef) }
        ));
      }
    }
    if (segments.length) mappedItems.set(entity.id, segments);
  }
  if (mappedItems.size) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-mapped-curve-linework-applied",
      `Applied IFCMAPPEDITEM representation maps to ${mappedItems.size} curve linework item(s).`
    );
  }
  return { mappedItems, sourceItemRefs };
}

const IFC_PRODUCT_TYPES = new Set([
  "IFCBUILDINGELEMENTPART",
  "IFCBUILDINGELEMENTPROXY",
  "IFCBEAM",
  "IFCBEAMSTANDARDCASE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY",
  "IFCAIRTERMINAL",
  "IFCAIRTERMINALBOX",
  "IFCAIRTOAIRHEATRECOVERY",
  "IFCAUDIOVISUALAPPLIANCE",
  "IFCCOLUMN",
  "IFCCOLUMNSTANDARDCASE",
  "IFCBOILER",
  "IFCBURNER",
  "IFCCABLECARRIERFITTING",
  "IFCCABLECARRIERSEGMENT",
  "IFCCABLEFITTING",
  "IFCCABLESEGMENT",
  "IFCCHILLER",
  "IFCCOIL",
  "IFCCOMMUNICATIONSAPPLIANCE",
  "IFCCOMPRESSOR",
  "IFCCONDENSER",
  "IFCCOOLEDBEAM",
  "IFCCOOLINGTOWER",
  "IFCCOVERING",
  "IFCCURTAINWALL",
  "IFCDAMPER",
  "IFCDISCRETEACCESSORY",
  "IFCDISTRIBUTIONCHAMBERELEMENT",
  "IFCDISTRIBUTIONCONTROLELEMENT",
  "IFCDISTRIBUTIONELEMENT",
  "IFCDISTRIBUTIONFLOWELEMENT",
  "IFCDOOR",
  "IFCDUCTFITTING",
  "IFCDUCTSEGMENT",
  "IFCDUCTSILENCER",
  "IFCELEMENTASSEMBLY",
  "IFCELECTRICAPPLIANCE",
  "IFCELECTRICDISTRIBUTIONBOARD",
  "IFCELECTRICFLOWSTORAGEDEVICE",
  "IFCELECTRICGENERATOR",
  "IFCELECTRICMOTOR",
  "IFCELECTRICTIMECONTROL",
  "IFCENERGYCONVERSIONDEVICE",
  "IFCENGINE",
  "IFCEVAPORATIVECOOLER",
  "IFCEVAPORATOR",
  "IFCFASTENER",
  "IFCFILTER",
  "IFCFIRESUPPRESSIONTERMINAL",
  "IFCFLOWCONTROLLER",
  "IFCFLOWFITTING",
  "IFCFLOWMOVINGDEVICE",
  "IFCFLOWSEGMENT",
  "IFCFLOWSTORAGEDEVICE",
  "IFCFLOWTERMINAL",
  "IFCFLOWTREATMENTDEVICE",
  "IFCFOOTING",
  "IFCHEATEXCHANGER",
  "IFCHUMIDIFIER",
  "IFCINTERCEPTOR",
  "IFCLAMP",
  "IFCLIGHTFIXTURE",
  "IFCMEDICALDEVICE",
  "IFCMEMBER",
  "IFCMEMBERSTANDARDCASE",
  "IFCMECHANICALFASTENER",
  "IFCMOTORCONNECTION",
  "IFCOUTLET",
  "IFCPILE",
  "IFCPIPEFITTING",
  "IFCPIPESEGMENT",
  "IFCPLATE",
  "IFCPLATESTANDARDCASE",
  "IFCPROTECTIVEDEVICE",
  "IFCPUMP",
  "IFCRAILING",
  "IFCRAMP",
  "IFCREINFORCINGBAR",
  "IFCREINFORCINGMESH",
  "IFCROOF",
  "IFCSANITARYTERMINAL",
  "IFCSLAB",
  "IFCSLABSTANDARDCASE",
  "IFCSOLARDEVICE",
  "IFCSPACE",
  "IFCSPACEHEATER",
  "IFCSTAIR",
  "IFCSTACKTERMINAL",
  "IFCSWITCHINGDEVICE",
  "IFCTANK",
  "IFCTRANSFORMER",
  "IFCTUBEBUNDLE",
  "IFCUNITARYEQUIPMENT",
  "IFCVALVE",
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCWASTETERMINAL",
  "IFCWINDOW"
]);

function ifcFaceRecords(sourceFaces, transform, appearance, metadata = {}) {
  const color = typeof appearance === "string" ? appearance : appearance?.color;
  const opacity = canonicalOpacity(appearance?.opacity);
  const overrideColor = appearance?.overrideColor === true;
  const overrideOpacity = appearance?.overrideOpacity === true;
  const sourceLayer = metadata?.sourceLayer || null;
  const records = [];
  const transformedFaces = transform ? transformIfcFaceEntries(sourceFaces, transform) : sourceFaces;
  for (const entry of transformedFaces) {
    const points = ifcFaceEntryPoints(entry);
    const entryAppearance = ifcFaceEntryAppearance(entry);
    const entryOpacity = canonicalOpacity(entryAppearance.opacity);
    const fallbackOpacity = canonicalOpacity(opacity);
    const recordColor = overrideColor ? color || entryAppearance.color || IFC_DEFAULT_MESH_COLOR : entryAppearance.color || color || IFC_DEFAULT_MESH_COLOR;
    const recordOpacity = overrideOpacity
      ? Number.isFinite(fallbackOpacity) ? fallbackOpacity : entryOpacity
      : Number.isFinite(entryOpacity) ? entryOpacity : fallbackOpacity;
    const recordLayer = entryAppearance.sourceLayer || sourceLayer;
    records.push({
      points,
      color: recordColor,
      ...(Number.isFinite(recordOpacity) ? { opacity: recordOpacity } : {}),
      ...(recordLayer ? { sourceLayer: recordLayer } : {})
    });
  }
  return records;
}

function ifcPlacedGeometryFaceRecords(entities, diagnostics) {
  const breps = ifcFacetedBreps(entities, diagnostics);
  const sweptSolids = new Map([
    ...ifcExtrudedSolidFaces(entities, diagnostics),
    ...ifcRevolvedSolidFaces(entities, diagnostics),
    ...ifcSweptDiskSolidFaces(entities, diagnostics)
  ]);
  const tessellatedFaceSets = ifcTessellatedFaceGroups(entities, diagnostics);
  const itemFaces = ifcBooleanFallbackFaceGroups(
    entities,
    new Map([...breps.entries(), ...sweptSolids.entries(), ...tessellatedFaceSets.entries()]),
    diagnostics
  );
  const resolveItemLayer = ifcPresentationLayerResolver(entities);
  const { mappedItems, sourceItemRefs } = ifcMappedItemFaces(entities, itemFaces, diagnostics, resolveItemLayer);
  const placements = ifcLocalPlacementTransforms(entities);
  const invalidLocalPlacementRefs = ifcInvalidLocalPlacementRefs(entities);
  const definitions = ifcProductDefinitionItems(entities);
  const resolveItemAppearance = ifcItemAppearanceResolver(entities);
  const resolveDirectItemAppearance = ifcDirectItemAppearanceResolver(entities);
  const records = [];
  const placedBreps = new Set();
  const placedSweptSolids = new Set();
  const placedTessellatedFaceSets = new Set();
  const placedMappedItems = new Set();
  const suppressedItemRefs = new Set();

  for (const entity of entities.values()) {
    if (!IFC_PRODUCT_TYPES.has(entity.type)) continue;
    const refs = stepRefs(entity.args);
    const definitionRef = refs.find((ref) => definitions.has(ref));
    if (!definitionRef) continue;
    const invalidPlacementRef = ifcInvalidProductPlacementRef(entity, invalidLocalPlacementRefs);
    if (invalidPlacementRef) {
      ifcReportInvalidProductPlacement(diagnostics, entity, invalidPlacementRef, invalidLocalPlacementRefs.get(invalidPlacementRef));
      suppressProductDefinitionItems(suppressedItemRefs, definitions, definitionRef);
      continue;
    }
    const placementRef = refs.find((ref) => placements.has(ref));
    if (!placementRef) continue;
    const transform = placements.get(placementRef);
    for (const itemRef of definitions.get(definitionRef)) {
      const sourceFaces = itemFaces.get(itemRef);
      if (sourceFaces) {
        if (sweptSolids.has(itemRef)) {
          placedSweptSolids.add(itemRef);
        } else if (tessellatedFaceSets.has(itemRef)) {
          placedTessellatedFaceSets.add(itemRef);
        } else {
          placedBreps.add(itemRef);
        }
        records.push(...ifcFaceRecords(sourceFaces, transform, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
        continue;
      }
      const mappedFaces = mappedItems.get(itemRef);
      if (mappedFaces) {
        placedMappedItems.add(itemRef);
        const directAppearance = resolveDirectItemAppearance(itemRef);
        const mappedAppearance = {
          ...resolveItemAppearance(itemRef),
          overrideColor: Boolean(directAppearance.color),
          overrideOpacity: Number.isFinite(canonicalOpacity(directAppearance.opacity))
        };
        records.push(...ifcFaceRecords(mappedFaces, transform, mappedAppearance, { sourceLayer: resolveItemLayer(itemRef) }));
      }
    }
  }

  if (records.length) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-local-placement-applied",
      `Applied IFCLOCALPLACEMENT transforms to ${placedBreps.size} faceted BREP item(s), ${placedSweptSolids.size} swept solid item(s), ${placedTessellatedFaceSets.size} tessellated face set item(s), and ${placedMappedItems.size} mapped item(s).`
    );
    return records;
  }

  return [...itemFaces.entries()]
    .filter(([itemRef]) => !sourceItemRefs.has(itemRef) && !suppressedItemRefs.has(itemRef))
    .flatMap(([itemRef, sourceFaces]) => (
      ifcFaceRecords(sourceFaces, null, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) })
    ));
}

function ifcPlacedInnerBoundLoops(entities, diagnostics) {
  const itemLoops = new Map([
    ...ifcInnerBoundGroups(entities, diagnostics),
    ...ifcPolygonalVoidLoopGroups(entities, diagnostics),
    ...ifcExtrudedSolidVoidLoopGroups(entities, diagnostics),
    ...ifcRevolvedSolidVoidLoopGroups(entities, diagnostics)
  ]);
  const mappedItems = ifcMappedItemLoops(entities, itemLoops);
  const placements = ifcLocalPlacementTransforms(entities);
  const invalidLocalPlacementRefs = ifcInvalidLocalPlacementRefs(entities);
  const definitions = ifcProductDefinitionItems(entities);
  const loops = [];
  const suppressedItemRefs = new Set();

  for (const entity of entities.values()) {
    if (!IFC_PRODUCT_TYPES.has(entity.type)) continue;
    const refs = stepRefs(entity.args);
    const definitionRef = refs.find((ref) => definitions.has(ref));
    if (!definitionRef) continue;
    const invalidPlacementRef = ifcInvalidProductPlacementRef(entity, invalidLocalPlacementRefs);
    if (invalidPlacementRef) {
      ifcReportInvalidProductPlacement(diagnostics, entity, invalidPlacementRef, invalidLocalPlacementRefs.get(invalidPlacementRef));
      suppressProductDefinitionItems(suppressedItemRefs, definitions, definitionRef);
      continue;
    }
    const placementRef = refs.find((ref) => placements.has(ref));
    if (!placementRef) continue;
    const transform = placements.get(placementRef);
    for (const itemRef of definitions.get(definitionRef)) {
      const sourceLoops = itemLoops.get(itemRef);
      if (sourceLoops) {
        loops.push(...transformIfcFaces(sourceLoops, transform));
        continue;
      }
      const mappedLoops = mappedItems.get(itemRef);
      if (mappedLoops) loops.push(...transformIfcFaces(mappedLoops, transform));
    }
  }

  return loops.length ? loops : [...itemLoops.entries()]
    .filter(([itemRef]) => !suppressedItemRefs.has(itemRef))
    .flatMap(([, sourceLoops]) => sourceLoops);
}

function ifcPlacedIndexedPolyCurveSegments(entities, diagnostics) {
  const internalCurveRefs = ifcInternalCurveRefs(entities);
  const compositeSourceRefs = ifcCompositeSourceCurveRefs(entities);
  const itemSegments = ifcCurveSegmentGroups(entities, diagnostics);
  const resolveItemAppearance = ifcItemAppearanceResolver(entities);
  const resolveItemLayer = ifcPresentationLayerResolver(entities);
  const { mappedItems, sourceItemRefs } = ifcMappedItemSegments(entities, itemSegments, diagnostics, resolveItemAppearance, resolveItemLayer);
  const placements = ifcLocalPlacementTransforms(entities);
  const invalidLocalPlacementRefs = ifcInvalidLocalPlacementRefs(entities);
  const definitions = ifcProductDefinitionItems(entities);
  const segments = [];
  const suppressedItemRefs = new Set();

  for (const entity of entities.values()) {
    if (!IFC_PRODUCT_TYPES.has(entity.type)) continue;
    const refs = stepRefs(entity.args);
    const definitionRef = refs.find((ref) => definitions.has(ref));
    if (!definitionRef) continue;
    const invalidPlacementRef = ifcInvalidProductPlacementRef(entity, invalidLocalPlacementRefs);
    if (invalidPlacementRef) {
      ifcReportInvalidProductPlacement(diagnostics, entity, invalidPlacementRef, invalidLocalPlacementRefs.get(invalidPlacementRef));
      suppressProductDefinitionItems(suppressedItemRefs, definitions, definitionRef);
      continue;
    }
    const placementRef = refs.find((ref) => placements.has(ref));
    if (!placementRef) continue;
    const transform = placements.get(placementRef);
    for (const itemRef of definitions.get(definitionRef)) {
      if (compositeSourceRefs.has(itemRef)) continue;
      const sourceSegments = itemSegments.get(itemRef);
      if (sourceSegments) {
        segments.push(...styledSegmentRecords(
          transformIfcSegments(sourceSegments, transform),
          resolveItemAppearance(itemRef),
          { sourceLayer: resolveItemLayer(itemRef) }
        ));
        continue;
      }
      const mappedSegments = mappedItems.get(itemRef);
      if (mappedSegments) segments.push(...transformIfcSegments(mappedSegments, transform));
    }
  }

  if (segments.length) return segments;
  const directSegments = [];
  for (const [itemRef, sourceSegments] of itemSegments.entries()) {
    if (suppressedItemRefs.has(itemRef)) continue;
    if (sourceItemRefs.has(itemRef)) continue;
    if (compositeSourceRefs.has(itemRef)) continue;
    if (internalCurveRefs.has(itemRef)) continue;
    directSegments.push(...styledSegmentRecords(sourceSegments, resolveItemAppearance(itemRef), { sourceLayer: resolveItemLayer(itemRef) }));
  }
  return directSegments;
}

function detectIfcUnits(entities, diagnostics) {
  for (const entity of entities.values()) {
    if (entity.type !== "IFCCONVERSIONBASEDUNIT") continue;
    const args = splitStepArguments(entity.args);
    if (!args.some((arg) => /\.LENGTHUNIT\./i.test(arg))) continue;
    const declared = stepStringValue(args[2] || entity.args);
    const units = canonicalUnitsFromLengthLabel(declared);
    if (units) return units;
    const measureRef = stepRefs(args[3] || entity.args)[0];
    const factorUnits = canonicalUnitsFromMetreConversionFactor(conversionMeasureFactor(entities.get(measureRef)));
    if (factorUnits) return factorUnits;
    if (declared) reportUnsupportedDeclaredUnits(diagnostics, "ifc-units-unsupported", "IFC file", declared);
    return null;
  }

  for (const entity of entities.values()) {
    if (entity.type !== "IFCSIUNIT") continue;
    const args = splitStepArguments(entity.args);
    if (!args.some((arg) => /\.LENGTHUNIT\./i.test(arg)) || !args.some((arg) => /\.METRE\./i.test(arg))) continue;
    const prefixArg = args.find((arg) => /^\s*\.[A-Z_]+\.\s*$/i.test(arg) && !/\.LENGTHUNIT\.|\.METRE\./i.test(arg));
    const units = canonicalUnitsFromSiMetrePrefix(prefixArg || "");
    if (units) return units;
    reportUnsupportedDeclaredUnits(diagnostics, "ifc-units-unsupported", "IFC file", prefixArg || "<none>");
    return null;
  }

  return null;
}

function translateIfcText(text, options = {}) {
  const entities = parseStepEntities(text);
  assertStepEntitySource(entities, "IFC", "IFC");
  const diagnostics = [];
  const assetUnits = resolveDetectedUnits({
    explicitUnits: options.units,
    detectedUnits: detectIfcUnits(entities, diagnostics),
    diagnostics,
    codePrefix: "ifc",
    sourceLabel: "IFC file"
  });
  const meshSets = new Map();
  const ifcMeshSourceLayers = new Map();
  for (const record of ifcPlacedGeometryFaceRecords(entities, diagnostics)) {
    const color = record.color || IFC_DEFAULT_MESH_COLOR;
    const opacity = canonicalOpacity(record.opacity);
    const sourceLayer = record.sourceLayer || null;
    const layer = sourceLayer?.id || "ifc_mesh";
    if (sourceLayer) ifcMeshSourceLayers.set(sourceLayer.id, sourceLayer);
    const key = geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity);
    if (!meshSets.has(key)) {
      meshSets.set(key, {
        layer,
        color,
        opacity,
        vertices: [],
        faces: [],
        indexByPoint: new Map()
      });
    }
    addStepMeshFace(meshSets.get(key), record.points);
  }
  const meshes = [...meshSets.values()].filter((meshSet) => meshSet.faces.length);
  const meshLayerIds = [...new Set(meshes.map((meshSet) => meshSet.layer || "ifc_mesh"))]
    .sort((left, right) => (left === "ifc_mesh" ? -1 : right === "ifc_mesh" ? 1 : left.localeCompare(right)));
  const meshFaceCount = meshes.reduce((total, meshSet) => total + meshSet.faces.length, 0);
  const lineSets = new Map();
  for (const loop of ifcPlacedInnerBoundLoops(entities, diagnostics)) {
    addPolyline(lineSets, "ifc_inner_bounds", "#0e7490", loop, true);
  }
  const ifcCurveSourceLayers = new Map();
  for (const segment of ifcPlacedIndexedPolyCurveSegments(entities, diagnostics)) {
    const sourceLayer = segment?.sourceLayer || null;
    const layer = sourceLayer?.id || "ifc_indexed_polycurves";
    if (sourceLayer) ifcCurveSourceLayers.set(sourceLayer.id, sourceLayer);
    addAppearanceLineSegment(lineSets, layer, "#7c3aed", segment);
  }
  const ifcPointSets = new Map();
  const ifcPointSourceLayers = new Map();
  for (const record of ifcStandaloneVertexPointRecords(entities, diagnostics)) {
    const color = record.color || "#2563eb";
    const opacity = canonicalOpacity(record.opacity);
    const sourceLayer = record.sourceLayer || null;
    const layer = sourceLayer?.id || "ifc_points";
    if (sourceLayer) ifcPointSourceLayers.set(sourceLayer.id, sourceLayer);
    const key = geometryAppearanceKey(`${layer}\u0000${color || ""}`, opacity);
    if (!ifcPointSets.has(key)) {
      ifcPointSets.set(key, {
        layer,
        points: [],
        color,
        opacity
      });
    }
    ifcPointSets.get(key).points.push(record.point);
  }
  const ifcPointSetEntries = [...ifcPointSets.values()]
    .filter((pointSet) => pointSet.points.length)
    .sort((left, right) => (
      String(left.layer || "").localeCompare(String(right.layer || ""))
      || String(left.color || "").localeCompare(String(right.color || ""))
      || String(Number.isFinite(left.opacity) ? left.opacity : "").localeCompare(String(Number.isFinite(right.opacity) ? right.opacity : ""))
    ));
  const pointLayerIds = [...new Set(ifcPointSetEntries.map((pointSet) => pointSet.layer || "ifc_points"))]
    .sort((left, right) => (left === "ifc_points" ? -1 : right === "ifc_points" ? 1 : left.localeCompare(right)));
  const innerBoundLineSets = sortedLineSetsForLayer(lineSets, "ifc_inner_bounds");
  const indexedPolycurveLayerIds = [...new Set([...lineSets.values()]
    .filter((lineSet) => lineSet.layer !== "ifc_inner_bounds" && lineSet.lineSegments.length)
    .map((lineSet) => lineSet.layer))]
    .sort((left, right) => (left === "ifc_indexed_polycurves" ? -1 : right === "ifc_indexed_polycurves" ? 1 : left.localeCompare(right)));
  const indexedPolycurveLineSets = indexedPolycurveLayerIds.flatMap((layer) => sortedLineSetsForLayer(lineSets, layer));

  const hasFacetedBrep = [...entities.values()].some((entity) => entity.type === "IFCFACETEDBREP");
  const hasSweptSolid = [...entities.values()].some((entity) => (
    entity.type === "IFCEXTRUDEDAREASOLID"
    || entity.type === "IFCEXTRUDEDAREASOLIDTAPERED"
    || entity.type === "IFCREVOLVEDAREASOLID"
    || entity.type === "IFCSWEPTDISKSOLID"
    || entity.type === "IFCSWEPTDISKSOLIDPOLYGONAL"
  ));
  const hasTessellatedFaceSet = [...entities.values()].some((entity) => entity.type === "IFCTRIANGULATEDFACESET" || entity.type === "IFCPOLYGONALFACESET");
  if (!hasFacetedBrep && !hasSweptSolid && !hasTessellatedFaceSet && meshFaceCount) {
    addDiagnostic(
      diagnostics,
      "info",
      "ifc-faces-without-faceted-brep",
      "Imported IFC face loops even though no IFCFACETEDBREP wrapper was present."
    );
  }

  const layers = {
    ifc_mesh: {
      id: "ifc_mesh",
      name: "IFC Mesh",
      display: {
        color: IFC_DEFAULT_MESH_COLOR,
        edgeColor: "#1f2937",
        opacity: 0.34
      }
    }
  };
  for (const layerId of meshLayerIds.filter((layerId) => layerId !== "ifc_mesh")) {
    const sourceLayer = ifcMeshSourceLayers.get(layerId);
    const firstMesh = meshes.find((meshSet) => meshSet.layer === layerId);
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `IFC Layer: ${sourceLayer.name}` : "IFC Mesh",
      display: {
        color: firstMesh?.color || IFC_DEFAULT_MESH_COLOR,
        edgeColor: "#1f2937",
        opacity: Number.isFinite(firstMesh?.opacity) ? firstMesh.opacity : 0.34
      }
    };
  }
  if (innerBoundLineSets.length) {
    layers.ifc_inner_bounds = {
      id: "ifc_inner_bounds",
      name: "IFC Inner Bounds",
      display: {
        color: "#0e7490"
      }
    };
  }
  for (const layerId of indexedPolycurveLayerIds) {
    const sourceLayer = ifcCurveSourceLayers.get(layerId);
    const firstLineSet = sortedLineSetsForLayer(lineSets, layerId)[0];
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `IFC Layer: ${sourceLayer.name}` : "IFC Indexed Polycurves",
      display: {
        color: firstLineSet?.color || "#7c3aed"
      }
    };
  }
  for (const layerId of pointLayerIds) {
    const sourceLayer = ifcPointSourceLayers.get(layerId);
    const firstPointSet = ifcPointSetEntries.find((pointSet) => pointSet.layer === layerId);
    if (layers[layerId]) continue;
    layers[layerId] = {
      id: layerId,
      name: sourceLayer ? `IFC Layer: ${sourceLayer.name}` : "IFC Points",
      display: {
        color: firstPointSet?.color || "#2563eb"
      }
    };
  }
  const objects = {};
  meshes.forEach((meshSet, index) => {
    const baseId = meshSet.layer === "ifc_mesh" ? "ifc_faceted_mesh" : `ifc_faceted_mesh_${meshSet.layer}`;
    const id = index === 0 && baseId === "ifc_faceted_mesh"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "ifc_faceted_mesh");
    const layerName = layers[meshSet.layer]?.name || "IFC Mesh";
    const name = meshSet.layer === "ifc_mesh"
      ? index === 0 ? "IFC reference mesh" : `IFC reference mesh ${index + 1}`
      : `${layerName} mesh`;
    const object = meshObject(id, name, meshSet.layer, meshSet);
    object.display.edgeColor = "#1f2937";
    object.display.opacity = Number.isFinite(meshSet.opacity) ? meshSet.opacity : 0.34;
    object.metadata = {
      sourceEntity: hasFacetedBrep ? "IFC-FACETED-BREP" : hasSweptSolid ? "IFC-SWEPT-SOLID" : hasTessellatedFaceSet ? "IFC-TESSELLATED-FACE-SET" : "IFC-FACE-LOOPS"
    };
    objects[id] = object;
  });
  innerBoundLineSets.forEach((lineSet, index) => {
    const id = index === 0 ? "ifc_inner_bound_linework" : `ifc_inner_bound_linework_${index + 1}`;
    objects[id] = lineObject(id, index === 0 ? "IFC inner boundary linework" : `IFC inner boundary linework ${index + 1}`, "ifc_inner_bounds", lineSet);
  });
  indexedPolycurveLineSets.forEach((lineSet, index) => {
    const baseId = lineSet.layer === "ifc_indexed_polycurves" ? "ifc_indexed_polycurve_linework" : `ifc_indexed_polycurve_linework_${lineSet.layer}`;
    const id = index === 0 && baseId === "ifc_indexed_polycurve_linework"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "ifc_indexed_polycurve_linework");
    const layerName = layers[lineSet.layer]?.name || "IFC Indexed Polycurves";
    const name = lineSet.layer === "ifc_indexed_polycurves"
      ? index === 0 ? "IFC indexed polycurve linework" : `IFC indexed polycurve linework ${index + 1}`
      : `${layerName} linework`;
    objects[id] = lineObject(id, name, lineSet.layer, lineSet);
  });
  ifcPointSetEntries.forEach((pointSet, index) => {
    const baseId = pointSet.layer === "ifc_points" ? "ifc_vertex_points" : `ifc_vertex_points_${pointSet.layer}`;
    const id = index === 0 && baseId === "ifc_vertex_points"
      ? baseId
      : uniqueSanitizedId(baseId, new Set(Object.keys(objects)), "ifc_vertex_points");
    const layerName = layers[pointSet.layer]?.name || "IFC Points";
    const name = pointSet.layer === "ifc_points"
      ? index === 0 ? "IFC vertex points" : `IFC vertex points ${index + 1}`
      : `${layerName} points`;
    const object = pointObject(id, name, pointSet.layer, pointSet);
    object.metadata = {
      sourceEntity: "IFC-VERTEX-POINT"
    };
    objects[id] = object;
  });
  if (!meshFaceCount && !innerBoundLineSets.length && !indexedPolycurveLineSets.length && !ifcPointSetEntries.length) {
    addDiagnostic(
      diagnostics,
      "warning",
      "ifc-no-supported-geometry",
      "IFC file did not contain supported IFCFACETEDBREP/IFCFACE/IFCPOLYLOOP/IFCEDGELOOP faceted geometry, IFCTRIANGULATEDFACESET/IFCPOLYGONALFACESET tessellated geometry, standalone IFCVERTEXPOINT point geometry, IFCPOLYLINE/IFCINDEXEDPOLYCURVE/IFCCOMPOSITECURVE/IFCCIRCLE/IFCELLIPSE/IFCBSPLINECURVEWITHKNOTS/IFCRATIONALBSPLINECURVEWITHKNOTS/IFCTRIMMEDCURVE-over-IFCLINE/IFCTRIMMEDCURVE-over-IFCBSPLINE linework, or supported IFCEXTRUDEDAREASOLID/IFCEXTRUDEDAREASOLIDTAPERED/IFCREVOLVEDAREASOLID/IFCSWEPTDISKSOLID swept profiles; use an external IFC adapter for full geometry."
    );
  }

  const sourceFileName = options.sourceFileName || "source.ifc";
  const assetId = normalizedExplicitReferenceAssetId(options.assetId) || sanitizeId(path.basename(sourceFileName, path.extname(sourceFileName)), "ifc_reference");
  const allPoints = meshes.flatMap((meshSet) => meshSet.vertices);
  for (const lineSet of [...innerBoundLineSets, ...indexedPolycurveLineSets]) allPoints.push(...lineSet.vertices);
  for (const pointSet of ifcPointSetEntries) allPoints.push(...pointSet.points);
  return {
    $schema: options.schemaRef || "../../app/schemas/reference-geometry.schema.json",
    schema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    schemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    asset: {
      id: assetId,
      name: options.name || path.basename(sourceFileName),
      source: withSourceFileMetadata({
        format: "ifc",
        fileName: path.basename(sourceFileName),
        checksum: checksum(text),
        translator: "tools/reference-geometry/translate_reference_geometry.mjs",
        translatorVersion: "0.1.0"
      }, options),
      units: assetUnits,
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: boundsFor(allPoints)
    },
    layers,
    objects,
    chunks: [],
    diagnostics
  };
}

function canonicalFormatTokens(canonicalFormat) {
  return Object.entries(FORMAT_REGISTRY)
    .filter(([entryFormat, entrySpec]) => (entrySpec.aliasFor || entryFormat) === canonicalFormat)
    .map(([entryFormat]) => entryFormat);
}

function tokenFileExtensions(format, spec) {
  return spec.fileExtension === false ? [] : [format];
}

function canonicalFileExtensions(canonicalFormat) {
  return Object.entries(FORMAT_REGISTRY)
    .filter(([entryFormat, entrySpec]) => (entrySpec.aliasFor || entryFormat) === canonicalFormat && entrySpec.fileExtension !== false)
    .map(([entryFormat]) => entryFormat);
}

function acceptExtensions(extensions) {
  return extensions.map((extension) => `.${extension}`);
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function formatDiscoveryEntry(format, spec) {
  const canonicalFormat = spec.aliasFor || format;
  const isFileExtension = spec.fileExtension !== false;
  const fileExtensions = tokenFileExtensions(format, spec);
  const fileAcceptExtensions = acceptExtensions(fileExtensions);
  const groupedExtensions = canonicalFileExtensions(canonicalFormat);
  const groupedAcceptExtensions = acceptExtensions(groupedExtensions);
  return {
    format,
    canonicalFormat,
    canonicalFormatTokens: canonicalFormatTokens(canonicalFormat),
    isAlias: Boolean(spec.aliasFor),
    isFileExtension,
    primaryExtension: fileExtensions[0] || null,
    canonicalPrimaryExtension: groupedExtensions[0] || null,
    fileExtensions,
    acceptExtensions: fileAcceptExtensions,
    accept: fileAcceptExtensions.join(","),
    canonicalFileExtensions: groupedExtensions,
    canonicalAcceptExtensions: groupedAcceptExtensions,
    canonicalAccept: groupedAcceptExtensions.join(","),
    ...spec
  };
}

export function supportedReferenceGeometryFormats() {
  return Object.fromEntries(Object.entries(FORMAT_REGISTRY).map(([format, spec]) => [format, formatDiscoveryEntry(format, spec)]));
}

export function supportedReferenceGeometryFormatGroups() {
  const formats = supportedReferenceGeometryFormats();
  const groups = {};
  for (const [format, spec] of Object.entries(formats)) {
    const canonicalFormat = spec.canonicalFormat;
    const canonicalSpec = formats[canonicalFormat] || spec;
    if (!groups[canonicalFormat]) {
      groups[canonicalFormat] = {
        format: canonicalFormat,
        canonicalFormat,
        state: canonicalSpec.state,
        description: canonicalSpec.description,
        primaryExtension: null,
        canonicalPrimaryExtension: null,
        fileExtensions: [],
        canonicalFileExtensions: [],
        acceptExtensions: [],
        canonicalAcceptExtensions: [],
        accept: "",
        canonicalAccept: "",
        formatTokens: [],
        canonicalFormatTokens: [],
        aliases: [],
        cliOnlyTokens: [],
        tokenStates: {},
        adapterCapable: false,
        builtInAvailable: false,
        externalAdapterRequired: false,
        hasExternalAdapterOnlyTokens: false,
        builtInTokens: [],
        externalAdapterRequiredTokens: []
      };
    }
    const group = groups[canonicalFormat];
    pushUnique(group.formatTokens, format);
    pushUnique(group.canonicalFormatTokens, format);
    if (spec.isAlias) pushUnique(group.aliases, format);
    if (!spec.isFileExtension) pushUnique(group.cliOnlyTokens, format);
    for (const extension of spec.fileExtensions || []) pushUnique(group.fileExtensions, extension);
    group.tokenStates[format] = spec.state;
    if (spec.adapterCapable === true) group.adapterCapable = true;
    if (spec.state === "implemented") {
      group.builtInAvailable = true;
      pushUnique(group.builtInTokens, format);
    }
    if (spec.state === "external-adapter-required") {
      group.hasExternalAdapterOnlyTokens = true;
      pushUnique(group.externalAdapterRequiredTokens, format);
    }
  }
  for (const group of Object.values(groups)) {
    group.primaryExtension = group.fileExtensions[0] || null;
    group.canonicalPrimaryExtension = group.primaryExtension;
    group.canonicalFileExtensions = [...group.fileExtensions];
    group.acceptExtensions = acceptExtensions(group.fileExtensions);
    group.canonicalAcceptExtensions = [...group.acceptExtensions];
    group.accept = group.acceptExtensions.join(",");
    group.canonicalAccept = group.accept;
    group.externalAdapterRequired = group.externalAdapterRequiredTokens.length > 0 && !group.builtInAvailable;
  }
  return groups;
}

export function referenceGeometryTargetFormatCoverage({
  formats = supportedReferenceGeometryFormats(),
  formatGroups = supportedReferenceGeometryFormatGroups()
} = {}) {
  const targetFormatEntries = Object.fromEntries(REFERENCE_TARGET_FORMAT_TOKENS.map((token) => {
    const entry = formats[token] || {};
    const canonicalFormat = entry.canonicalFormat || entry.aliasFor || token;
    const group = formatGroups[canonicalFormat] || {};
    const builtInAvailable = entry.builtInAvailable === true || entry.state === "implemented";
    const externalAdapterRequired = entry.externalAdapterRequired === true || entry.state === "external-adapter-required";
    const adapterCapable = entry.adapterCapable === true;
    return [token, {
      formatToken: token,
      supported: Boolean(formats[token]),
      canonicalFormat,
      state: entry.state || null,
      translationMode: externalAdapterRequired ? "external-adapter" : builtInAvailable ? "built-in" : null,
      importerTranslationMode: entry.importerTranslationMode || null,
      builtInAvailable,
      externalAdapterRequired,
      adapterCapable,
      adapterRequestCapable: entry.adapterRequestCapable ?? adapterCapable,
      cliOnlyToken: entry.isFileExtension === false,
      fileExtensions: Array.isArray(entry.fileExtensions) ? entry.fileExtensions : [],
      accept: entry.accept || "",
      canonicalAccept: entry.canonicalAccept || group.canonicalAccept || group.accept || "",
      groupAccept: group.accept || ""
    }];
  }));
  const entries = Object.values(targetFormatEntries);
  const coverage = {
    targetFormatTokens: [...REFERENCE_TARGET_FORMAT_TOKENS],
    allTargetFormatsSupported: entries.every((entry) => entry.supported === true),
    missingTargetFormatTokens: entries.filter((entry) => entry.supported !== true).map((entry) => entry.formatToken),
    builtInTargetFormatTokens: entries.filter((entry) => entry.builtInAvailable === true).map((entry) => entry.formatToken),
    externalAdapterRequiredTargetFormatTokens: entries.filter((entry) => entry.externalAdapterRequired === true).map((entry) => entry.formatToken),
    adapterCapableTargetFormatTokens: entries.filter((entry) => entry.adapterCapable === true).map((entry) => entry.formatToken),
    cliOnlyTargetFormatTokens: entries.filter((entry) => entry.cliOnlyToken === true).map((entry) => entry.formatToken),
    targetFormatEntries
  };
  coverage.referenceTargetFormatCoverageFingerprint = referenceTargetFormatCoverageFingerprint(coverage);
  return coverage;
}

function referenceTargetFormatCoverageFingerprint(coverage = {}) {
  const { referenceTargetFormatCoverageFingerprint: _fingerprint, ...payload } = coverage;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceTranslationResultContractFingerprint(contract = {}) {
  const { resultContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceTranslationCommandContractFingerprint(contract = {}) {
  const { translationCommandContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceTranslationWorkflowContractFingerprint(contract = {}) {
  const { workflowContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function canonicalOutputContractFingerprint(contract = {}) {
  const { canonicalOutputContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterOutputValidationContractFingerprint(contract = {}) {
  const { adapterOutputValidationContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceSourceDescriptionContractFingerprint(contract = {}) {
  const { sourceDescriptionContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function referenceGeometryCanonicalOutputContractMetadata() {
  const contract = {
    referenceGeometrySchema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    referenceGeometrySchemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    referenceGeometrySchemaPath: REFERENCE_GEOMETRY_SCHEMA,
    pointCloudChunkSchema: POINT_CLOUD_CHUNK_SCHEMA_NAME,
    pointCloudChunkSchemaVersion: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
    pointCloudChunkSchemaPath: POINT_CLOUD_CHUNK_SCHEMA,
    manifestRequiredFields: [
      "$schema",
      "schema",
      "schemaVersion",
      "asset",
      "layers",
      "objects",
      "chunks",
      "diagnostics"
    ],
    assetRequiredFields: [
      "id",
      "name",
      "source",
      "units",
      "coordinateSystem"
    ],
    layerRequiredFields: [
      "id",
      "name"
    ],
    referenceObjectRequiredFields: [
      "id",
      "kind"
    ],
    referenceObjectKinds: [
      "line-set",
      "mesh",
      "point-cloud"
    ],
    geometryFieldsByKind: {
      "line-set": ["vertices", "lineSegments"],
      mesh: ["vertices", "faces"],
      "point-cloud": ["points", "chunkIds"]
    },
    forbiddenGeometryFieldsByKind: {
      "line-set": ["faces", "points", "pointAttributes", "chunkIds"],
      mesh: ["lineSegments", "points", "pointAttributes", "chunkIds"],
      "point-cloud": ["vertices", "lineSegments", "faces"]
    },
    pointCloudStorageModes: [
      "inline-points",
      "chunked-sidecars"
    ],
    inlinePointCloudFields: [
      "points",
      "pointAttributes"
    ],
    chunkedPointCloudFields: [
      "chunkIds"
    ],
    pointAttributeFields: [
      "colors",
      "intensities",
      "classifications",
      "normals"
    ],
    manifestChunkRequiredFields: [
      "id",
      "kind",
      "objectId",
      "path",
      "pointCount"
    ],
    pointCloudChunkRequiredFields: [
      "$schema",
      "schema",
      "schemaVersion",
      "id",
      "kind",
      "objectId",
      "pointCount",
      "bounds",
      "points"
    ],
    diagnosticRequiredFields: [
      "severity",
      "code",
      "message"
    ],
    diagnosticPolicy: {
      codeField: "code",
      codePattern: DIAGNOSTIC_CODE_PATTERN_SOURCE,
      codeMaxLength: DIAGNOSTIC_CODE_MAX_LENGTH,
      messageField: "message",
      messageMaxLength: DIAGNOSTIC_MESSAGE_MAX_LENGTH,
      boundedPathFree: true,
      forbiddenStringClasses: [
        "control-character",
        "absolute-or-uri-path-prefix",
        "leading-slash-path",
        "traversal-path",
        "encoded-path-separator",
        "file-like-path-separator"
      ],
      schemaEnforced: true,
      browserRuntimeEnforced: true,
      directSceneEnforced: true
    },
    displayNamePolicy: {
      fields: [
        "asset.name",
        "layers.*.name",
        "objects.*.name"
      ],
      boundedPathFree: true,
      maxLength: DISPLAY_NAME_MAX_LENGTH,
      forbiddenStringClasses: [
        "control-character",
        "absolute-or-uri-path-prefix",
        "leading-slash-path",
        "traversal-path",
        "encoded-path-separator",
        "file-like-path-separator",
        "leading-or-trailing-whitespace"
      ],
      schemaEnforced: true,
      translatorOptionEnforced: true,
      browserRuntimeEnforced: true,
      directSceneEnforced: true
    },
    sourceProvenanceFields: [
      "format",
      "fileName",
      "fileExtension",
      "requestedFormat",
      "fileSizeBytes",
      "modifiedTime",
      "statFingerprint",
      "checksum",
      "translator",
      "translatorVersion",
      "adapterKey"
    ],
    sourceProvenancePolicy: {
      requiredFields: ["format"],
      optionalFields: [
        "fileName",
        "fileExtension",
        "requestedFormat",
        "fileSizeBytes",
        "modifiedTime",
        "statFingerprint",
        "checksum",
        "translator",
        "translatorVersion",
        "adapterKey"
      ],
      statFingerprintField: "statFingerprint",
      statFingerprintPattern: "^stat-sha256:[0-9a-f]{64}$",
      checksumField: "checksum",
      checksumPattern: "^[0-9a-f]{64}$",
      checksumOptional: true,
      checksumRequiredForAdapterOutput: false,
      builtInTranslatorsMayHashSourceContent: true,
      externalAdaptersMayOmitChecksum: true,
      externalAdapterOutputChecksumPolicy: "discard-unverified-adapter-checksum",
      translatorField: "translator",
      translatorPolicy: "built-in-id-or-safe-machine-token-or-external-adapter-key",
      translatorSchemaEnforced: true,
      builtInTranslatorId: "tools/reference-geometry/translate_reference_geometry.mjs",
      safeMachineTranslatorPattern: "^[a-z0-9][a-z0-9-]*$",
      translatorVersionField: "translatorVersion",
      translatorVersionPattern: "^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$",
      translatorVersionMaxLength: 64,
      translatorVersionSchemaEnforced: true,
      externalAdapterOutputTranslatorPolicy: "safe-adapter-token-or-external-adapter-key",
      externalAdapterOutputTranslatorVersionPolicy: "short-path-free-token-or-external",
      safeExternalTranslatorPattern: "^(external:)?[A-Za-z0-9][A-Za-z0-9_-]*$",
      safeExternalTranslatorReservedTokens: Array.from(RESERVED_REFERENCE_IDS),
      safeExternalTranslatorVersionPattern: "^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$",
      safeExternalTranslatorVersionMaxLength: 64,
      adapterKeyField: "adapterKey",
      fileNameField: "fileName",
      fileNamePolicy: "path-free-source-basename-only",
      fileNamePattern: SOURCE_FILE_NAME_PATTERN_SOURCE,
      fileNameMaxLength: SOURCE_FILE_NAME_MAX_LENGTH,
      fileNameSchemaEnforced: true,
      fileExtensionField: "fileExtension",
      fileExtensionAliasesByFormat: sourceFileExtensionsByFormat(),
      fileExtensionSchemaEnforced: true,
      fileExtensionKnownFormatPolicy: "empty-or-real-extension-for-source-family",
      fileExtensionUnknownFormatPolicy: "safe-token-only",
      requestedFormatField: "requestedFormat",
      requestedFormatAliasesByFormat: sourceRequestedFormatAliasesByFormat(),
      requestedFormatSchemaEnforced: true,
      requestedFormatUnknownFormatPolicy: "reject-requested-format"
    },
    referenceMetadataPolicy: {
      appliesTo: [
        "objects.*.metadata",
        "point-cloud chunk metadata"
      ],
      validator: "validateReferenceGeometryOutput",
      boundedPathFree: true,
      maxJsonLength: REFERENCE_METADATA_MAX_JSON_LENGTH,
      maxDepth: REFERENCE_METADATA_MAX_DEPTH,
      maxEntryCount: REFERENCE_METADATA_MAX_ENTRY_COUNT,
      maxArrayLength: REFERENCE_METADATA_MAX_ARRAY_LENGTH,
      maxStringLength: REFERENCE_METADATA_MAX_STRING_LENGTH,
      keyPattern: REFERENCE_METADATA_KEY_PATTERN.source,
      forbiddenNormalizedKeys: Array.from(REFERENCE_METADATA_FORBIDDEN_NORMALIZED_KEYS),
      forbiddenKeySuffixes: ["path", "directory"],
      forbiddenStringClasses: [
        "absolute-path",
        "path-separator",
        "uri-scheme",
        "control-character"
      ],
      allowedSlashStrings: Array.from(REFERENCE_METADATA_ALLOWED_SLASH_STRINGS)
    },
    sourceNeutralityPolicy: {
      canonicalObjectKindsAreFormatIndependent: true,
      formatSpecificTranslatorsMapToCommonKinds: true,
      rendererGeometryInputs: ["layers", "objects", "chunks", "point-cloud chunk sidecars"],
      appMayIgnoreAssetSourceForGeometry: true,
      sourceSpecificFieldsAllowedOnlyIn: ["asset.source", "diagnostics"],
      sourceSpecificGeometryFieldsAllowed: false,
      rendererConsumesSourceFormatForGeometry: false,
      projectModelStoresCanonicalPayloads: false
    },
    supportedUnits: ["mm", "m", "in", "ft"],
    sourceFormatValues: ["dxf", "dwg", "step", "ifc", "e57", "e57pointcloud", "json", "unknown"],
    safeIdPattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$",
    chunkPathPolicy: "manifest-relative-forward-slash-contained",
    boundsFields: ["min", "max"]
  };
  contract.canonicalOutputContractFingerprint = canonicalOutputContractFingerprint(contract);
  return contract;
}

export function referenceGeometryAdapterOutputValidationContractMetadata() {
  const contract = {
    adapterOutputContractVersion: REFERENCE_ADAPTER_OUTPUT_CONTRACT_VERSION,
    validatorCliPath: path.join(ROOT, "tools/reference-geometry/adapters/validate_adapter_output.mjs"),
    validatorModulePath: path.join(ROOT, "tools/reference-geometry/adapters/adapter_output_contract.mjs"),
    discoveryCommand: "--list-contract",
    cliFlags: ["--request", "--output", "--json", "--list-contract"],
    requiredInputs: ["requestPath"],
    optionalInputs: ["outputPath"],
    requestContractFields: [
      "schema",
      "schemaVersion",
      "schemaVersions",
      "schemas",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "request",
      "output",
      "stageDir",
      "chunkDir",
      "chunkPathPrefix",
      "format",
      "requestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "adapterKey",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "assetId",
      "name",
      "units",
      "pointCloudChunkSize"
    ],
    validates: [
      "adapter-request-schema",
      "adapter-request-schema-version-alignment",
      "adapter-request-schema-path-alignment",
      "adapter-request-fingerprint",
      "canonical-reference-manifest",
      "point-cloud-chunk-sidecars",
      "output-path-alignment",
      "asset-id-alignment",
      "asset-name-alignment",
      "units-alignment",
      "source-format-alignment",
      "source-requested-format-alignment",
      "request-source-provenance-alignment",
      "request-source-adapter-key-alignment",
      "external-adapter-checksum-omission",
      "external-adapter-source-provenance-safety",
      "chunk-path-prefix",
      "chunk-directory-containment"
    ],
    pathPolicy: {
      outputPathField: "outputPath",
      requestOutputField: "output",
      requestOutputDirField: "outputDir",
      requestStageDirField: "stageDir",
      outputPathMustMatchRequestOutput: true,
      outputDirMustMatchOutputDirectory: true,
      outputPathMustResolveInsideRequestStageDir: true,
      outputFileMustExist: true,
      chunkPathField: "chunks[].path",
      chunkPathSchemaPattern: referenceChunkPathPatternFromSchema(),
      chunkPathSchemaPatternSource: "bobercad/app/schemas/reference-geometry.schema.json#/$defs/chunk/properties/path/pattern",
      requestChunkPathPrefixField: "chunkPathPrefix",
      requiredChunkPathPrefix: DEFAULT_POINT_CLOUD_CHUNK_PATH_PREFIX,
      requestChunkDirField: "chunkDir",
      chunkPathMustStartWithRequestChunkPathPrefix: true,
      chunkPathMustResolveInsideRequestChunkDir: true
    },
    externalAdapterSourceProvenancePolicy: {
      selectedAdapterOnly: true,
      checksumField: "checksum",
      checksumPolicy: "reject-unverified-adapter-checksum",
      translatorField: "translator",
      translatorPolicy: "safe-adapter-token-or-external-adapter-key",
      safeExternalTranslatorPattern: "^(external:)?[A-Za-z0-9][A-Za-z0-9_-]*$",
      safeExternalTranslatorReservedTokens: Array.from(RESERVED_REFERENCE_IDS),
      translatorVersionField: "translatorVersion",
      translatorVersionPolicy: "short-path-free-token",
      safeExternalTranslatorVersionPattern: "^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$",
      safeExternalTranslatorVersionMaxLength: 64,
      mismatchErrorCode: "adapter-output-identity-mismatch",
      validationKind: "manifest"
    },
    successFields: [
      "ok",
      "adapterOutputContractVersion",
      "requestPath",
      "outputPath",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "assetId",
      "assetName",
      "assetUnits",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath",
      "schema",
      "schemaVersion",
      "referenceLayerCount",
      "referenceObjectCount",
      "referenceChunkCount",
      "referenceObjectKindCounts",
      "chunkDir",
      "chunkPathPrefix"
    ],
    fingerprintFields: [
      "referenceManifestFingerprint",
      "referenceChunkFileSetFingerprint",
      "referenceArtifactFingerprint"
    ],
    fileMetadataFields: [
      "referenceFileSizeBytes",
      "referenceFileModifiedTime"
    ],
    chunkFileMetadataFields: [
      "referenceChunkFileCount",
      "referenceChunkFileSizeBytes",
      "referenceChunkFileModifiedTimeLatest",
      "referenceChunkFileEntries",
      "referenceChunkFileOmittedCount"
    ],
    errorEnvelopeFields: [
      "ok",
      "adapterOutputContractVersion",
      "errors"
    ],
    errorPrimaryFields: [
      "message",
      "adapterOutputErrorCode",
      "adapterOutputValidationKind",
      "requestPath",
      "outputPath",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "assetId",
      "assetName",
      "assetUnits",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    requestCorrelationFields: [
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "adapterKey",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterConfigPath",
      "adapterConfigDir",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint",
      "adapterOutputMode",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceFileName",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint",
      "assetId",
      "assetName",
      "assetUnits",
      "adapterRequestSchemaVersion",
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath"
    ],
    errorCodes: [
      "adapter-output-cli-option-missing",
      "adapter-output-cli-option-unknown",
      "adapter-output-request-missing",
      "adapter-output-request-read-error",
      "adapter-output-request-json-invalid",
      "adapter-output-request-invalid",
      "adapter-output-path-mismatch",
      "adapter-output-missing",
      "adapter-output-identity-mismatch",
      "adapter-output-chunk-invalid",
      "adapter-output-bounds-invalid",
      "adapter-output-invalid"
    ],
    errorKinds: [
      "cli",
      "request",
      "manifest",
      "point-cloud-chunk"
    ]
  };
  contract.adapterOutputValidationContractFingerprint = adapterOutputValidationContractFingerprint(contract);
  return contract;
}

function referenceTranslationResultContractMetadata() {
  const contract = {
    translationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    executionModes: ["plan-only", "validate-only", "adapter-request", "translate"],
    sideEffectPlanFields: Object.keys(referenceTranslationSideEffectPlan("translate")),
    workflowStatusField: "referenceTranslationWorkflowStatus",
    workflowStatusFields: [
      "workflowStage",
      "workflowStageComplete",
      "completedWorkflowStages",
      "nextWorkflowStages",
      "recommendedNextWorkflowStage",
      "workflowDecisionField",
      "workflowFingerprintFields",
      "noProjectWrites",
      "noTargetReferenceWrites",
      "promotedReferenceWriteStage",
      "writesTargetReferenceManifest",
      "mayLaunchExternalAdapter",
      "sideEffectBoundary"
    ],
    planFingerprintField: "referenceTranslationPlanFingerprint",
    planDecisionField: "referenceTranslationPlanDecision",
    planDecisionFields: [
      "inputPath",
      "outputPath",
      "sourceFormat",
      "sourceRequestedFormat",
      "translationMode",
      "outputPlanReady",
      "adapterRequestCapable",
      "canWriteAdapterRequest",
      "adapterConfigProvided",
      "adapterPreflightOk",
      "adapterPreflightReady",
      "adapterPreflightLikelyFixArea",
      "adapterPreflightRecommendedNextAction",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "writesTargetReferenceManifest",
      "mayWriteTargetReferenceChunks",
      "safeNextExecutionMode",
      "availableNextExecutionModes",
      "recommendedNextAction"
    ],
    outputModes: ["file", "stdout"],
    schemaVersionFields: [
      "referenceGeometrySchemaVersion",
      "pointCloudChunkSchemaVersion",
      "adapterRequestSchemaVersion",
      "adapterConfigSchemaVersion"
    ],
    schemaIdentityFields: [
      "referenceGeometrySchemaVersion",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaVersion",
      "pointCloudChunkSchemaPath",
      "adapterRequestSchemaVersion",
      "adapterRequestSchemaPath",
      "adapterConfigSchemaVersion",
      "schemaVersions",
      "schemas"
    ],
    outputFingerprintFields: [
      "referenceManifestFingerprint",
      "referenceArtifactFingerprint"
    ],
    adapterRequestDecisionField: "referenceTranslationAdapterRequestDecision",
    adapterRequestDecisionFields: [
      "inputPath",
      "outputPath",
      "adapterRequestPath",
      "adapterRequestFingerprint",
      "adapterRunId",
      "sourceFormat",
      "sourceRequestedFormat",
      "translationMode",
      "adapterKey",
      "adapterOutputMode",
      "adapterConfigProvided",
      "adapterPreflightOk",
      "adapterPreflightReady",
      "adapterPreflightLikelyFixArea",
      "adapterPreflightRecommendedNextAction",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "stageDir",
      "scratchDir",
      "chunkDir",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "adapterRequestReady",
      "adapterStageDirectoriesReady",
      "runsTranslator",
      "launchesAdapter",
      "writesTargetReferenceManifest",
      "validatesCanonicalOutput",
      "outputValidationRequired",
      "safeNextAction",
      "recommendedNextAction"
    ],
    adapterConfigMetadataFields: [
      "adapterConfigPath",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint"
    ],
    adapterPreflightFingerprintFields: [
      "adapterPreflightFingerprint",
      "adapterPreflightFingerprints",
      "adapterRegistryFingerprint",
      "adapterRegistryFingerprints",
      "adapterRegistryAdapterFingerprint",
      "adapterTargetFormatCoverageFingerprint",
      "adapterPreflightDecision"
    ],
    outputFingerprintAvailabilityByMode: {
      "plan-only": "null",
      "adapter-request": "null",
      "validate-only": "sha256",
      translate: "sha256"
    },
    errorEnvelopeFields: [
      "ok",
      "referenceTranslationContractVersion",
      "errors"
    ],
    errorExecutionContextFields: [
      "referenceTranslationExecutionMode",
      "referenceTranslationSideEffectPlan",
      "translationMode"
    ],
    errorPrimaryFields: [
      "message",
      "referenceTranslationPlanFingerprint",
      "adapter",
      "adapterErrorCode",
      "adapterOutputValidationMessage",
      "adapterOutputValidationPath",
      "adapterOutputValidationKind",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRegistryFingerprint",
      "adapterRegistryFingerprints",
      "adapterRegistryAdapterFingerprint",
      "adapterRunId",
      "adapterOutputMode",
      "adapterConfigStatFingerprint",
      "adapterCommand",
      "adapterCommandFound",
      "adapterResolvedCommand",
      "adapterCwd",
      "adapterCwdExists",
      "adapterOutputPath",
      "adapterPreflightOk",
      "adapterPreflightRequested",
      "adapterPreflightSelectedAdapter",
      "adapterPreflightAdapterKeys",
      "adapterPreflightFingerprint",
      "adapterPreflightFingerprints",
      "adapterPreflightDecision",
      "adapterPreflightDiagnostics",
      "adapterExitCode",
      "adapterTimedOut",
      "adapterTimeoutMs",
      "adapterStreamMaxBufferBytes",
      "adapterMissingRequiredFiles",
      "adapterMissingRequiredDirectories",
      "adapterMissingRequiredCommands",
      "adapterMissingRequiredEnv",
      "rollbackRecovery"
    ],
    adapterRequestFingerprintField: "adapterRequestFingerprint",
    adapterRequestEvidenceFingerprintField: "adapterRequestEvidenceFingerprint",
    adapterRunMetadataFields: [
      "adapterRunId",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRegistryFingerprint",
      "adapterRegistryAdapterFingerprint",
      "adapterOutputMode",
      "adapterCwd",
      "adapterCwdExists",
      "adapterCommand",
      "adapterCommandFound",
      "adapterResolvedCommand"
    ],
    stageMetadataFields: [
      "stageDir",
      "scratchDir",
      "adapterRequestPath",
      "adapterOutputPath",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath"
    ]
  };
  contract.resultContractFingerprint = referenceTranslationResultContractFingerprint(contract);
  return contract;
}

function referenceTranslationCommandContractMetadata() {
  const executionModes = ["plan-only", "validate-only", "adapter-request", "translate"];
  const translationModes = ["built-in", "external-adapter", "canonical-json"];
  const sideEffectPlansByModeAndTranslationMode = Object.fromEntries(translationModes.map((translationMode) => [
    translationMode,
    Object.fromEntries(executionModes.map((mode) => [
      mode,
      referenceTranslationSideEffectPlan(mode, { translationMode })
    ]))
  ]));
  const contract = {
    translationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    discoveryCommand: "--list-translation-discovery",
    sourceDiscoveryCommand: "--describe-source",
    cliPath: path.join(ROOT, "tools/reference-geometry/translate_reference_geometry.mjs"),
    cliFlags: [
      "--input",
      "--output",
      "--format",
      "--name",
      "--asset-id",
      "--units",
      "--adapter-config",
      "--adapter",
      "--adapter-timeout-ms",
      "--point-cloud-chunk-size",
      "--plan-only",
      "--validate-only",
      "--write-adapter-request",
      "--json",
      "--keep-stage",
      "--keep-stage-on-error"
    ],
    executionModes,
    modeFlags: {
      "plan-only": ["--plan-only"],
      "validate-only": ["--validate-only"],
      "adapter-request": ["--write-adapter-request"],
      translate: []
    },
    requiredInputsByMode: {
      "plan-only": ["inputPath", "outputPath"],
      "validate-only": ["inputPath"],
      "adapter-request": ["inputPath", "outputPath", "requestPath"],
      translate: ["inputPath", "outputPath"]
    },
    optionalInputs: [
      "format",
      "name",
      "units",
      "assetId",
      "adapterConfigPath",
      "adapterName",
      "adapterTimeoutMs",
      "pointCloudChunkSize",
      "keepStage",
      "keepStageOnError"
    ],
    translationModes,
    adapterRequestCapableTranslationModes: [
      "built-in",
      "external-adapter"
    ],
    sideEffectPlansByModeAndTranslationMode,
    targetOutputFields: [
      "outputPath",
      "referenceManifestFingerprint",
      "referenceArtifactFingerprint",
      "referenceFileSizeBytes",
      "referenceFileModifiedTime"
    ],
    outputFingerprintFieldsByMode: referenceTranslationResultContractMetadata().outputFingerprintAvailabilityByMode,
    jsonSuccessEnvelopeFields: [
      "ok",
      "referenceTranslationContractVersion",
      "referenceTranslationExecutionMode",
      "referenceTranslationSideEffectPlan",
      "referenceTranslationPlanFingerprint"
    ],
    jsonErrorEnvelopeFields: [
      "ok",
      "referenceTranslationContractVersion",
      "errors"
    ],
    jsonErrorPrimaryFields: [
      "message",
      "referenceTranslationPlanFingerprint",
      "adapterErrorCode",
      "adapterRequestFingerprint",
      "adapterRegistryFingerprint",
      "adapterConfigStatFingerprint"
    ]
  };
  contract.translationCommandContractFingerprint = referenceTranslationCommandContractFingerprint(contract);
  return contract;
}

function referenceTranslationWorkflowStageOrder() {
  return [
    "source-discovery",
    "plan-only",
    "adapter-request",
    "external-adapter-wrapper",
    "translate",
    "validate-only"
  ];
}

function referenceTranslationWorkflowContractMetadata() {
  const workflowStages = referenceTranslationWorkflowStageOrder();
  const contract = {
    translationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    discoveryCommand: "--list-translation-discovery",
    workflowPurpose: "staged-reference-geometry-translation",
    isolationBoundary: {
      sourceFormatOwnership: "translator-or-external-adapter",
      applicationInput: "canonical-reference-json",
      projectStoragePolicy: "none",
      promotedGeometryStorage: "reference-manifest-and-point-cloud-chunk-sidecars"
    },
    workflowStages,
    optionalStages: [
      "adapter-request",
      "external-adapter-wrapper",
      "validate-only"
    ],
    safeWorkflowOrder: workflowStages,
    stageCommandFlags: {
      "source-discovery": ["--describe-source"],
      "plan-only": ["--plan-only"],
      "adapter-request": ["--write-adapter-request"],
      "external-adapter-wrapper": [],
      translate: [],
      "validate-only": ["--validate-only"]
    },
    stageExecutionModes: {
      "source-discovery": null,
      "plan-only": "plan-only",
      "adapter-request": "adapter-request",
      "external-adapter-wrapper": null,
      translate: "translate",
      "validate-only": "validate-only"
    },
    stageRequiredInputs: {
      "source-discovery": ["inputPath"],
      "plan-only": ["inputPath", "outputPath"],
      "adapter-request": ["inputPath", "outputPath", "requestPath"],
      "external-adapter-wrapper": ["adapterRequestPath"],
      translate: ["inputPath", "outputPath"],
      "validate-only": ["inputPath"]
    },
    stageDecisionFields: {
      "source-discovery": "referenceTranslationSourceDecision",
      "plan-only": "referenceTranslationPlanDecision",
      "adapter-request": "referenceTranslationAdapterRequestDecision",
      "external-adapter-wrapper": "referenceTranslationAdapterRequestDecision",
      translate: null,
      "validate-only": null
    },
    stageFingerprintFields: {
      "source-discovery": [
        "referenceSourceDescriptionFingerprint"
      ],
      "plan-only": [
        "referenceTranslationPlanFingerprint"
      ],
      "adapter-request": [
        "referenceTranslationPlanFingerprint",
        "adapterRequestFingerprint",
        "adapterRequestEvidenceFingerprint"
      ],
      "external-adapter-wrapper": [
        "adapterRequestFingerprint",
        "adapterRequestEvidenceFingerprint",
        "referenceManifestFingerprint",
        "referenceArtifactFingerprint"
      ],
      translate: [
        "referenceManifestFingerprint",
        "referenceArtifactFingerprint"
      ],
      "validate-only": [
        "referenceManifestFingerprint",
        "referenceArtifactFingerprint"
      ]
    },
    stageDecisionFingerprintPolicy: {
      "source-discovery": {
        decisionField: "referenceTranslationSourceDecision",
        fingerprintField: "referenceSourceDescriptionFingerprint",
        includedInStageFingerprint: true
      },
      "plan-only": {
        decisionField: "referenceTranslationPlanDecision",
        fingerprintField: "referenceTranslationPlanFingerprint",
        includedInStageFingerprint: false
      },
      "adapter-request": {
        decisionField: "referenceTranslationAdapterRequestDecision",
        fingerprintField: "referenceTranslationPlanFingerprint",
        includedInStageFingerprint: false
      },
      "external-adapter-wrapper": {
        decisionField: "referenceTranslationAdapterRequestDecision",
        fingerprintField: "adapterRequestFingerprint",
        includedInStageFingerprint: false
      },
      translate: {
        decisionField: null,
        fingerprintField: "referenceArtifactFingerprint",
        includedInStageFingerprint: false
      },
      "validate-only": {
        decisionField: null,
        fingerprintField: "referenceArtifactFingerprint",
        includedInStageFingerprint: false
      }
    },
    stageSideEffectBoundaries: {
      "source-discovery": {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        requiresOutputPath: false,
        validatesOutputPlan: false,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        validatesExistingReferenceManifest: false
      },
      "plan-only": {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        requiresOutputPath: true,
        validatesOutputPlan: true,
        mayPreflightAdapter: true,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        validatesExistingReferenceManifest: false
      },
      "adapter-request": {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        requiresOutputPath: true,
        validatesOutputPlan: true,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: true,
        preparesAdapterStageDirectories: true,
        writesProjectJson: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        validatesExistingReferenceManifest: false
      },
      "external-adapter-wrapper": {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        requiresOutputPath: true,
        validatesOutputPlan: true,
        externalProcessOwnedByWrapper: true,
        runsTranslator: false,
        mayLaunchExternalAdapter: true,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesTargetReferenceManifest: true,
        mayWriteTargetReferenceChunks: true,
        validatesExistingReferenceManifest: true
      },
      translate: {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        requiresOutputPath: true,
        validatesOutputPlan: true,
        preflightsAdapter: false,
        runsTranslator: true,
        mayLaunchExternalAdapter: true,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesTargetReferenceManifest: true,
        mayWriteTargetReferenceChunks: true,
        validatesExistingReferenceManifest: true
      },
      "validate-only": {
        requiresProjectPath: false,
        readsSourceFileMetadata: false,
        requiresOutputPath: false,
        validatesOutputPlan: false,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        validatesExistingReferenceManifest: true
      }
    },
    noProjectWriteStages: [
      "source-discovery",
      "plan-only",
      "adapter-request",
      "external-adapter-wrapper",
      "translate",
      "validate-only"
    ],
    noTargetReferenceWriteStages: [
      "source-discovery",
      "plan-only",
      "adapter-request",
      "validate-only"
    ],
    promotedWriteStages: [
      "external-adapter-wrapper",
      "translate"
    ],
    recommendedGateDecisionFields: [
      "referenceTranslationAdapterRequestDecision"
    ],
    workflowStatusField: "referenceTranslationWorkflowStatus",
    workflowStatusFields: [
      "workflowStage",
      "workflowStageComplete",
      "completedWorkflowStages",
      "nextWorkflowStages",
      "recommendedNextWorkflowStage",
      "workflowDecisionField",
      "workflowFingerprintFields",
      "noProjectWrites",
      "noTargetReferenceWrites",
      "promotedReferenceWriteStage",
      "writesTargetReferenceManifest",
      "mayLaunchExternalAdapter",
      "sideEffectBoundary"
    ],
    workflowFailureStatusPolicy: {
      statusField: "referenceTranslationWorkflowStatus",
      failedStageComplete: false,
      completedStagesExcludeFailedStage: true,
      preservesPlanFingerprint: true
    }
  };
  contract.workflowContractFingerprint = referenceTranslationWorkflowContractFingerprint(contract);
  return contract;
}

function referenceTranslationSchemaContractMetadata() {
  return {
    referenceTranslationSchemaNames: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA_NAME,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA_NAME,
      adapterRequest: ADAPTER_REQUEST_SCHEMA_NAME,
      adapterConfig: ADAPTER_CONFIG_SCHEMA_NAME
    },
    referenceTranslationSchemaVersions: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA_VERSION,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
      adapterRequest: ADAPTER_REQUEST_SCHEMA_VERSION,
      adapterConfig: ADAPTER_CONFIG_SCHEMA_VERSION
    },
    referenceTranslationSchemaPaths: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA,
      adapterRequest: ADAPTER_REQUEST_SCHEMA,
      adapterConfig: ADAPTER_CONFIG_SCHEMA
    },
    referenceCanonicalOutputContract: referenceGeometryCanonicalOutputContractMetadata(),
    referenceAdapterOutputValidationContract: referenceGeometryAdapterOutputValidationContractMetadata()
  };
}

function referenceTranslationDiscoveryFingerprint(catalog = {}) {
  const payload = {
    referenceTranslationContractVersion: catalog.referenceTranslationContractVersion || null,
    referenceTranslationSchemaNames: isRecord(catalog.referenceTranslationSchemaNames) ? catalog.referenceTranslationSchemaNames : null,
    referenceTranslationSchemaVersions: isRecord(catalog.referenceTranslationSchemaVersions) ? catalog.referenceTranslationSchemaVersions : null,
    referenceTranslationSchemaPaths: isRecord(catalog.referenceTranslationSchemaPaths) ? catalog.referenceTranslationSchemaPaths : null,
    referenceCanonicalOutputContract: isRecord(catalog.referenceCanonicalOutputContract) ? catalog.referenceCanonicalOutputContract : null,
    referenceAdapterOutputValidationContract: isRecord(catalog.referenceAdapterOutputValidationContract) ? catalog.referenceAdapterOutputValidationContract : null,
    referenceSourceDescriptionContract: isRecord(catalog.referenceSourceDescriptionContract) ? catalog.referenceSourceDescriptionContract : null,
    referenceTranslationCommandContract: isRecord(catalog.referenceTranslationCommandContract) ? catalog.referenceTranslationCommandContract : null,
    referenceTranslationResultContract: isRecord(catalog.referenceTranslationResultContract) ? catalog.referenceTranslationResultContract : null,
    referenceTranslationWorkflowContract: isRecord(catalog.referenceTranslationWorkflowContract) ? catalog.referenceTranslationWorkflowContract : null,
    referenceTranslationAdapterRequestContract: isRecord(catalog.referenceTranslationAdapterRequestContract) ? catalog.referenceTranslationAdapterRequestContract : null,
    referenceTranslationAdapterConfigContract: isRecord(catalog.referenceTranslationAdapterConfigContract) ? catalog.referenceTranslationAdapterConfigContract : null,
    referenceTranslationAdapterPreflightContract: isRecord(catalog.referenceTranslationAdapterPreflightContract) ? catalog.referenceTranslationAdapterPreflightContract : null,
    referenceTargetFormatCoverage: isRecord(catalog.referenceTargetFormatCoverage) ? catalog.referenceTargetFormatCoverage : null,
    formats: isRecord(catalog.formats) ? catalog.formats : null,
    formatGroups: isRecord(catalog.formatGroups) ? catalog.formatGroups : null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function referenceGeometryTranslationDiscoveryCatalog() {
  const formats = supportedReferenceGeometryFormats();
  const formatGroups = supportedReferenceGeometryFormatGroups();
  const catalog = {
    referenceTranslationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    ...referenceTranslationSchemaContractMetadata(),
    referenceSourceDescriptionContract: referenceSourceDescriptionContractMetadata(),
    referenceTranslationCommandContract: referenceTranslationCommandContractMetadata(),
    referenceTranslationResultContract: referenceTranslationResultContractMetadata(),
    referenceTranslationWorkflowContract: referenceTranslationWorkflowContractMetadata(),
    referenceTranslationAdapterRequestContract: referenceGeometryAdapterRequestContractMetadata(),
    referenceTranslationAdapterConfigContract: referenceGeometryAdapterConfigContractMetadata(),
    referenceTranslationAdapterPreflightContract: referenceGeometryAdapterPreflightContractMetadata(),
    referenceTargetFormatCoverage: referenceGeometryTargetFormatCoverage({ formats, formatGroups }),
    formats,
    formatGroups,
    formatCount: Object.keys(formats).length,
    formatGroupCount: Object.keys(formatGroups).length
  };
  catalog.referenceTranslationDiscoveryFingerprint = referenceTranslationDiscoveryFingerprint(catalog);
  return catalog;
}

function referenceTranslationSideEffectPlan(mode, { translationMode = null } = {}) {
  const runsTranslator = mode === "translate";
  return {
    validatesSourceFormat: true,
    validatesOutputPlan: mode === "plan-only" || mode === "adapter-request" || mode === "translate",
    preflightsAdapter: mode === "plan-only" && translationMode === "external-adapter",
    runsTranslator,
    mayLaunchExternalAdapter: runsTranslator && translationMode === "external-adapter",
    writesAdapterRequest: mode === "adapter-request",
    preparesAdapterStageDirectories: mode === "adapter-request",
    writesTargetReferenceManifest: mode === "translate",
    mayWriteTargetReferenceChunks: mode === "translate",
    validatesExistingReferenceManifest: mode === "validate-only"
  };
}

function referenceTranslationExecutionMetadata(mode, { translationMode = null } = {}) {
  return {
    referenceTranslationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    referenceTranslationExecutionMode: mode,
    referenceTranslationSideEffectPlan: referenceTranslationSideEffectPlan(mode, { translationMode })
  };
}

function referenceTranslationWorkflowStageFromExecutionMode(mode) {
  if (mode === "plan-only") return "plan-only";
  if (mode === "adapter-request") return "adapter-request";
  if (mode === "translate") return "translate";
  if (mode === "validate-only") return "validate-only";
  return null;
}

function referenceTranslationWorkflowStagesFromExecutionModes(modes = []) {
  return modes
    .map((mode) => referenceTranslationWorkflowStageFromExecutionMode(mode))
    .filter((stage) => typeof stage === "string" && stage);
}

function referenceTranslationWorkflowDefaultNextStages(stage) {
  if (stage === "source-discovery") return ["plan-only"];
  if (stage === "plan-only") return ["adapter-request", "translate"];
  if (stage === "adapter-request") return ["external-adapter-wrapper", "validate-only"];
  if (stage === "external-adapter-wrapper") return ["validate-only"];
  if (stage === "translate") return ["validate-only"];
  if (stage === "validate-only") return [];
  return [];
}

function referenceTranslationWorkflowStageForSummary(summary = {}) {
  const modeStage = referenceTranslationWorkflowStageFromExecutionMode(summary.referenceTranslationExecutionMode);
  if (modeStage) return modeStage;
  if (summary.referenceSourceDescriptionFingerprint) return "source-discovery";
  return null;
}

function referenceTranslationWorkflowDecisionForStage(summary = {}, stage) {
  if (stage === "source-discovery") {
    return isRecord(summary.referenceTranslationSourceDecision) ? summary.referenceTranslationSourceDecision : null;
  }
  if (stage === "plan-only") {
    return isRecord(summary.referenceTranslationPlanDecision) ? summary.referenceTranslationPlanDecision : null;
  }
  if (stage === "adapter-request" || stage === "external-adapter-wrapper") {
    return isRecord(summary.referenceTranslationAdapterRequestDecision) ? summary.referenceTranslationAdapterRequestDecision : null;
  }
  return null;
}

function referenceTranslationWorkflowStatus({ stage, stageComplete = true, decision = null } = {}) {
  const contract = referenceTranslationWorkflowContractMetadata();
  const stageIndex = contract.workflowStages.indexOf(stage);
  const decisionNextStages = Array.isArray(decision?.availableNextExecutionModes)
    ? referenceTranslationWorkflowStagesFromExecutionModes(decision.availableNextExecutionModes)
    : null;
  const nextWorkflowStages = Array.isArray(decisionNextStages) && decisionNextStages.length
    ? decisionNextStages
    : referenceTranslationWorkflowDefaultNextStages(stage);
  const recommendedNextWorkflowStage = decision?.safeNextAction === "run-external-adapter-wrapper"
    ? "external-adapter-wrapper"
    : referenceTranslationWorkflowStageFromExecutionMode(decision?.safeNextExecutionMode)
      || nextWorkflowStages[0]
      || null;
  const sideEffectBoundary = isRecord(contract.stageSideEffectBoundaries?.[stage])
    ? contract.stageSideEffectBoundaries[stage]
    : {};
  return {
    workflowStage: stage || null,
    workflowStageComplete: Boolean(stageComplete && stageIndex >= 0),
    completedWorkflowStages: stageIndex >= 0 && stageComplete ? [stage] : [],
    nextWorkflowStages,
    recommendedNextWorkflowStage,
    workflowDecisionField: contract.stageDecisionFields?.[stage] || null,
    workflowFingerprintFields: Array.isArray(contract.stageFingerprintFields?.[stage])
      ? contract.stageFingerprintFields[stage]
      : [],
    noProjectWrites: contract.noProjectWriteStages.includes(stage),
    noTargetReferenceWrites: contract.noTargetReferenceWriteStages.includes(stage),
    promotedReferenceWriteStage: contract.promotedWriteStages.includes(stage),
    writesTargetReferenceManifest: sideEffectBoundary.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter: sideEffectBoundary.mayLaunchExternalAdapter === true,
    sideEffectBoundary
  };
}

function attachReferenceTranslationWorkflowStatus(summary, stage = null, { stageComplete = true } = {}) {
  const workflowStage = stage || referenceTranslationWorkflowStageForSummary(summary);
  if (!workflowStage) return summary;
  summary.referenceTranslationWorkflowStatus = referenceTranslationWorkflowStatus({
    stage: workflowStage,
    stageComplete,
    decision: referenceTranslationWorkflowDecisionForStage(summary, workflowStage)
  });
  return summary;
}

function referenceTranslationModeFromManifest(data, { adapterConfigPath = null } = {}) {
  const source = isRecord(data?.asset?.source) ? data.asset.source : {};
  if (source.adapterKey || adapterConfigPath) return "external-adapter";
  if (source.format === "json") return "canonical-json";
  return "built-in";
}

function referenceTranslationExecutionErrorMetadata(mode, { translationMode = null } = {}) {
  return {
    ...referenceTranslationExecutionMetadata(mode, { translationMode }),
    ...(translationMode ? { translationMode } : {})
  };
}

function referenceTranslationModeFromCliArgs(args) {
  if (!args?.input) return null;
  try {
    return describeReferenceGeometrySource({
      inputPath: args.input,
      format: args.format,
      adapterConfigPath: args.adapterConfig || null
    }).translationMode || null;
  } catch {
    return null;
  }
}

function referenceTranslationOptionMetadata({ name = null, units = null, pointCloudChunkSize = undefined, assetId = null, adapterTimeoutMs = null } = {}) {
  const effectiveName = normalizedExplicitReferenceName(name);
  const effectiveAssetId = normalizedExplicitReferenceAssetId(assetId);
  return {
    referenceTranslationName: effectiveName || effectiveAssetId || null,
    referenceTranslationUnitsOverride: normalizedExplicitReferenceUnits(units),
    referenceTranslationPointCloudChunkSize: normalizedPointCloudChunkSize(pointCloudChunkSize),
    referenceTranslationAssetId: effectiveAssetId,
    referenceTranslationAdapterTimeoutMs: normalizedAdapterTimeoutOverride(adapterTimeoutMs)
  };
}

function sourcePlanMetadata(inputPath, format = null, adapterConfigPath = null) {
  const source = describeReferenceGeometrySource({ inputPath, format, adapterConfigPath });
  return {
    inputPath: source.inputPath,
    sourceFormat: source.sourceFormat,
    sourceRequestedFormat: source.sourceRequestedFormat,
    sourceRequestedFormatFamily: source.sourceRequestedFormatFamily,
    sourceRequestedFormatAliases: source.sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: source.sourceRequestedFormatMatchesFamily,
    sourceFileName: source.sourceFileName,
    sourceFileStem: source.sourceFileStem,
    sourceFileExtension: source.sourceFileExtension,
    sourceFileSizeBytes: Number.isInteger(source.sourceFileSizeBytes) ? source.sourceFileSizeBytes : null,
    sourceFileModifiedTime: source.sourceFileModifiedTime || null,
    sourceStatFingerprint: source.sourceStatFingerprint || null,
    inputExists: source.inputExists,
    inputIsFile: source.inputIsFile,
    translationMode: source.translationMode,
    builtInAvailable: source.builtInAvailable,
    externalAdapterRequired: source.externalAdapterRequired,
    adapterCapable: source.adapterCapable,
    accept: source.accept,
    acceptExtensions: source.acceptExtensions,
    fileExtensions: source.fileExtensions,
    formatTokens: source.formatTokens,
    cliOnlyTokens: source.cliOnlyTokens
  };
}

function plannedOutputMetadata(outputPath) {
  const absoluteOutput = path.resolve(outputPath);
  return {
    outputPath: absoluteOutput,
    outputDir: path.dirname(absoluteOutput),
    outputFileName: path.basename(absoluteOutput),
    outputFileStem: path.basename(absoluteOutput, path.extname(absoluteOutput)),
    plannedAdapterStageDir: path.dirname(absoluteOutput),
    plannedAdapterRequestPath: path.join(path.dirname(absoluteOutput), "reference-adapter-request.json"),
    plannedAdapterScratchDir: path.join(path.dirname(absoluteOutput), "scratch"),
    plannedAdapterChunkDir: path.join(path.dirname(absoluteOutput), "chunks"),
    plannedAdapterLogPath: path.join(path.dirname(absoluteOutput), "reference-adapter.log"),
    plannedAdapterStdoutPath: path.join(path.dirname(absoluteOutput), "reference-adapter.stdout.log"),
    plannedAdapterStderrPath: path.join(path.dirname(absoluteOutput), "reference-adapter.stderr.log")
  };
}

function adapterPreflightDiagnostics(result) {
  const diagnostics = [...(Array.isArray(result?.diagnostics) ? result.diagnostics : [])];
  for (const [adapterKey, adapter] of Object.entries(result?.adapters || {})) {
    for (const diagnostic of adapter.diagnostics || []) {
      diagnostics.push({
        adapter: adapterKey,
        ...diagnostic
      });
    }
  }
  return diagnostics;
}

function adapterPreflightSelectionMetadata(result) {
  const [selectedAdapterKey, selectedAdapter] = Object.entries(result?.adapters || {})[0] || [];
  return {
    adapterPreflightSelectedAdapter: selectedAdapterKey || null,
    adapterOutputMode: selectedAdapter ? selectedAdapter.outputMode || "file" : null
  };
}

function adapterRegistryPlanMetadata(result) {
  const [selectedAdapterKey, selectedAdapter] = Object.entries(result?.adapters || {})[0] || [];
  return {
    adapterRegistryFingerprint: result?.adapterRegistryFingerprint || null,
    adapterRegistryFingerprints: Object.fromEntries(Object.entries(result?.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterRegistryFingerprint || null])),
    adapterRegistryAdapterFingerprint: selectedAdapterKey ? selectedAdapter?.adapterRegistryFingerprint || null : null
  };
}

function namedAdapterRequiresConfigError(adapterName, context) {
  const error = new Error(`${context}: --adapter requires --adapter-config`);
  error.adapter = adapterName;
  error.adapterErrorCode = "adapter-config-missing";
  return error;
}

function assertTranslationAdapterPlanPreflight(adapterConfigPath, { format, adapterName }) {
  if (!adapterConfigPath) {
    return {
      adapterPreflightOk: null,
      adapterPreflightRequested: null,
      adapterPreflightSelectedAdapter: null,
      adapterOutputMode: null,
      adapterPreflightAdapterKeys: [],
      adapterPreflightFingerprints: {},
      adapterPreflightFingerprint: null,
      adapterRegistryFingerprint: null,
      adapterRegistryFingerprints: {},
      adapterRegistryAdapterFingerprint: null,
      adapterPreflightDecision: null,
      adapterPreflightDiagnostics: []
    };
  }
  const result = checkReferenceGeometryAdapters(adapterConfigPath, { format, adapterName });
  const diagnostics = adapterPreflightDiagnostics(result);
  const selection = adapterPreflightSelectionMetadata(result);
  const registry = adapterRegistryPlanMetadata(result);
  if (!result.ok) {
    const errorMessages = diagnostics
      .filter((diagnostic) => diagnostic.level === "error")
      .map((diagnostic) => diagnostic.adapter
        ? `${diagnostic.adapter}: ${diagnostic.message}`
        : diagnostic.message)
      .filter(Boolean);
    const error = new Error(`${path.resolve(adapterConfigPath)}: adapter preflight failed for translation plan${errorMessages.length ? `: ${errorMessages.join("; ")}` : ""}`);
    Object.assign(error, adapterConfigFileMetadata(adapterConfigPath));
    if (selection.adapterPreflightSelectedAdapter) error.adapter = selection.adapterPreflightSelectedAdapter;
    else if (adapterName) error.adapter = adapterName;
    error.adapterErrorCode = "adapter-preflight-failed";
    error.adapterPreflightOk = false;
    error.adapterPreflightRequested = result.requested || null;
    Object.assign(error, selection);
    error.adapterPreflightAdapterKeys = Object.keys(result.adapters || {}).sort();
    error.adapterPreflightFingerprints = Object.fromEntries(Object.entries(result.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterPreflightFingerprint || null]));
    error.adapterPreflightFingerprint = result.adapterPreflightFingerprint || null;
    error.adapterPreflightDecision = isRecord(result.adapterPreflightDecision) ? result.adapterPreflightDecision : null;
    Object.assign(error, registry);
    error.adapterPreflightDiagnostics = diagnostics;
    throw error;
  }
  return {
    adapterPreflightOk: true,
    adapterPreflightRequested: result.requested || null,
    ...selection,
    adapterPreflightAdapterKeys: Object.keys(result.adapters || {}).sort(),
    adapterPreflightFingerprints: Object.fromEntries(Object.entries(result.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterPreflightFingerprint || null])),
    adapterPreflightFingerprint: result.adapterPreflightFingerprint || null,
    adapterPreflightDecision: isRecord(result.adapterPreflightDecision) ? result.adapterPreflightDecision : null,
    ...registry,
    adapterPreflightDiagnostics: diagnostics
  };
}

function adapterPlanMetadata({ translationMode, adapterConfigPath, format, adapterName }) {
  if (adapterName && !adapterConfigPath && translationMode !== "canonical-json") {
    throw namedAdapterRequiresConfigError(adapterName, "translation plan");
  }
  if (translationMode !== "external-adapter") {
    return {
      ...adapterConfigFileMetadata(null),
      ...assertTranslationAdapterPlanPreflight(null, { format, adapterName })
    };
  }
  return {
    ...adapterConfigFileMetadata(adapterConfigPath),
    ...assertTranslationAdapterPlanPreflight(adapterConfigPath, { format, adapterName })
  };
}

function referenceTranslationPlanFingerprint(summary = {}) {
  const adapterKey = summary.adapterPreflightSelectedAdapter || summary.adapterKey || summary.sourceAdapter || null;
  const payload = {
    referenceTranslationContractVersion: summary.referenceTranslationContractVersion || null,
    inputPath: summary.inputPath || null,
    outputPath: summary.outputPath || null,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
    sourceFileName: summary.sourceFileName || null,
    sourceFileSizeBytes: Number.isInteger(summary.sourceFileSizeBytes) ? summary.sourceFileSizeBytes : null,
    sourceFileModifiedTime: summary.sourceFileModifiedTime || null,
    sourceStatFingerprint: summary.sourceStatFingerprint || null,
    translationMode: summary.translationMode || null,
    referenceTranslationName: summary.referenceTranslationName || null,
    referenceTranslationUnitsOverride: summary.referenceTranslationUnitsOverride || null,
    referenceTranslationPointCloudChunkSize: Number.isInteger(summary.referenceTranslationPointCloudChunkSize) ? summary.referenceTranslationPointCloudChunkSize : null,
    referenceTranslationAssetId: summary.referenceTranslationAssetId || null,
    referenceTranslationAdapterTimeoutMs: Number.isInteger(summary.referenceTranslationAdapterTimeoutMs) ? summary.referenceTranslationAdapterTimeoutMs : null,
    adapterConfigPath: summary.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(summary.adapterConfigFileSizeBytes) ? summary.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: summary.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: summary.adapterConfigStatFingerprint || null,
    adapterKey,
    adapterRegistryFingerprint: summary.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: summary.adapterRegistryAdapterFingerprint || null,
    adapterOutputMode: summary.adapterOutputMode || null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceTranslationPlanNextAction({
  translationMode = null,
  adapterConfigProvided = false,
  adapterPreflightOk = null
} = {}) {
  if (translationMode === "external-adapter" && adapterConfigProvided && adapterPreflightOk === false) return "fix-adapter-preflight";
  if (translationMode === "external-adapter" && !adapterConfigProvided) return "write-adapter-request-or-select-adapter-config";
  if (translationMode === "external-adapter") return "write-adapter-request-or-run-translate";
  if (translationMode === "canonical-json") return "validate-canonical-json-or-run-translate";
  return "run-translate";
}

function referenceTranslationPlanNextExecutionMode({
  translationMode = null,
  adapterConfigProvided = false,
  adapterPreflightOk = null
} = {}) {
  if (translationMode === "external-adapter" && adapterConfigProvided && adapterPreflightOk === false) return "plan-only";
  if (translationMode === "external-adapter") return "adapter-request";
  if (translationMode === "canonical-json") return "validate-only";
  return "translate";
}

function referenceTranslationPlanAvailableNextExecutionModes(summary = {}) {
  if (summary.translationMode === "canonical-json") return ["validate-only", "translate"];
  if (summary.adapterCapable === true) return ["adapter-request", "translate"];
  return ["translate"];
}

function referenceTranslationPlanDecision(summary = {}) {
  const adapterConfigProvided = Boolean(summary.adapterConfigPath);
  const adapterPreflightOk = summary.adapterPreflightOk ?? null;
  const preflightDecision = isRecord(summary.adapterPreflightDecision) ? summary.adapterPreflightDecision : null;
  const adapterRequestCapable = summary.translationMode !== "canonical-json" && summary.adapterCapable === true;
  return {
    inputPath: summary.inputPath || null,
    outputPath: summary.outputPath || null,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    translationMode: summary.translationMode || null,
    outputPlanReady: true,
    adapterRequestCapable,
    canWriteAdapterRequest: adapterRequestCapable,
    adapterConfigProvided,
    adapterPreflightOk,
    adapterPreflightReady: preflightDecision?.adapterPreflightReady ?? null,
    adapterPreflightLikelyFixArea: preflightDecision?.likelyFixArea || null,
    adapterPreflightRecommendedNextAction: preflightDecision?.recommendedNextAction || null,
    adapterRegistryFingerprint: summary.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: summary.adapterRegistryAdapterFingerprint || null,
    writesTargetReferenceManifest: false,
    mayWriteTargetReferenceChunks: false,
    safeNextExecutionMode: referenceTranslationPlanNextExecutionMode({
      translationMode: summary.translationMode,
      adapterConfigProvided,
      adapterPreflightOk
    }),
    availableNextExecutionModes: referenceTranslationPlanAvailableNextExecutionModes(summary),
    recommendedNextAction: referenceTranslationPlanNextAction({
      translationMode: summary.translationMode,
      adapterConfigProvided,
      adapterPreflightOk
    })
  };
}

function attachReferenceTranslationPlanFingerprint(summary) {
  summary.referenceTranslationContractVersion = REFERENCE_TRANSLATION_CONTRACT_VERSION;
  summary.referenceTranslationPlanFingerprint = referenceTranslationPlanFingerprint(summary);
  if (!isRecord(summary.referenceTranslationPlanDecision)) {
    summary.referenceTranslationPlanDecision = referenceTranslationPlanDecision(summary);
  }
  return summary;
}

function adapterConfigPlanErrorMetadata(adapterConfigPath) {
  if (!adapterConfigPath) return adapterConfigFileMetadata(null);
  try {
    return adapterConfigFileMetadata(adapterConfigPath);
  } catch {
    return {
      adapterConfigPath: path.resolve(adapterConfigPath),
      adapterConfigFileSizeBytes: null,
      adapterConfigFileModifiedTime: null,
      adapterConfigStatFingerprint: null
    };
  }
}

function adapterPlanErrorMetadata(error, { adapterConfigPath = null, adapterName = null } = {}) {
  return {
    ...adapterConfigPlanErrorMetadata(adapterConfigPath),
    adapterPreflightOk: typeof error?.adapterPreflightOk === "boolean" ? error.adapterPreflightOk : false,
    adapterPreflightRequested: error?.adapterPreflightRequested || null,
    adapterPreflightSelectedAdapter: error?.adapterPreflightSelectedAdapter || error?.adapter || adapterName || null,
    adapterOutputMode: error?.adapterOutputMode || null,
    adapterPreflightAdapterKeys: Array.isArray(error?.adapterPreflightAdapterKeys) ? error.adapterPreflightAdapterKeys : [],
    adapterPreflightFingerprints: isRecord(error?.adapterPreflightFingerprints) ? error.adapterPreflightFingerprints : {},
    adapterPreflightFingerprint: error?.adapterPreflightFingerprint || null,
    adapterRegistryFingerprint: error?.adapterRegistryFingerprint || null,
    adapterRegistryFingerprints: isRecord(error?.adapterRegistryFingerprints) ? error.adapterRegistryFingerprints : {},
    adapterRegistryAdapterFingerprint: error?.adapterRegistryAdapterFingerprint || null,
    adapterPreflightDecision: isRecord(error?.adapterPreflightDecision) ? error.adapterPreflightDecision : null,
    adapterPreflightDiagnostics: Array.isArray(error?.adapterPreflightDiagnostics) ? error.adapterPreflightDiagnostics : []
  };
}

function referenceTranslationPlanBase({
  inputPath,
  outputPath,
  format = null,
  name = null,
  units = null,
  assetId = null,
  adapterConfigPath = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = undefined
} = {}) {
  const source = sourcePlanMetadata(inputPath, format, adapterConfigPath);
  return {
    referenceTranslationExecutionMode: "plan-only",
    referenceTranslationSideEffectPlan: referenceTranslationSideEffectPlan("plan-only", {
      translationMode: source.translationMode
    }),
    ...source,
    ...plannedOutputMetadata(outputPath),
    ...referenceTranslationOptionMetadata({ name, units, pointCloudChunkSize, assetId, adapterTimeoutMs }),
    referenceManifestFingerprint: null,
    referenceArtifactFingerprint: null
  };
}

function attachReferenceTranslationErrorContext(error, context) {
  if (isRecord(context)) error.referenceTranslationContext = attachReferenceTranslationPlanFingerprint(context);
  return error;
}

function attachReferenceTranslationExecutionErrorContext(error, context) {
  if (!isRecord(error) || !isRecord(context)) return error;
  const existing = isRecord(error.referenceTranslationContext) ? error.referenceTranslationContext : {};
  error.referenceTranslationContext = {
    referenceTranslationContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    ...context,
    ...existing
  };
  return error;
}

function adapterRequestPreflightMetadata({ adapterConfigPath = null, format = null, adapterName = null } = {}) {
  if (!adapterConfigPath) {
    return {
      adapterPreflightOk: null,
      adapterPreflightRequested: null,
      adapterPreflightSelectedAdapter: adapterName || null,
      adapterPreflightAdapterKeys: [],
      adapterPreflightFingerprints: {},
      adapterPreflightFingerprint: null,
      adapterPreflightDecision: null,
      adapterPreflightDiagnostics: []
    };
  }
  const result = checkReferenceGeometryAdapters(adapterConfigPath, {
    format,
    adapterName
  });
  return {
    adapterPreflightOk: result.ok === true,
    adapterPreflightRequested: result.requested || null,
    ...adapterPreflightSelectionMetadata(result),
    adapterPreflightAdapterKeys: Object.keys(result.adapters || {}).sort(),
    adapterPreflightFingerprints: Object.fromEntries(Object.entries(result.adapters || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, adapter]) => [key, adapter.adapterPreflightFingerprint || null])),
    adapterPreflightFingerprint: result.adapterPreflightFingerprint || null,
    adapterPreflightDecision: isRecord(result.adapterPreflightDecision) ? result.adapterPreflightDecision : null,
    ...adapterRegistryPlanMetadata(result),
    adapterPreflightDiagnostics: adapterPreflightDiagnostics(result)
  };
}

function referenceTranslationAdapterRequestDecision(summary = {}) {
  const preflightDecision = isRecord(summary.adapterPreflightDecision) ? summary.adapterPreflightDecision : null;
  return {
    inputPath: summary.inputPath || summary.input || null,
    outputPath: summary.outputPath || summary.output || null,
    adapterRequestPath: summary.adapterRequestPath || summary.path || summary.request || null,
    adapterRequestFingerprint: summary.adapterRequestFingerprint || null,
    adapterRequestEvidenceFingerprint: summary.adapterRequestEvidenceFingerprint || null,
    adapterRunId: summary.adapterRunId || null,
    sourceFormat: summary.format || summary.sourceFormat || null,
    sourceRequestedFormat: summary.requestedFormat || summary.sourceRequestedFormat || null,
    translationMode: summary.translationMode || null,
    adapterKey: summary.adapterKey || null,
    adapterOutputMode: summary.adapterOutputMode || summary.outputMode || null,
    adapterConfigProvided: Boolean(summary.adapterConfigPath),
    adapterPreflightOk: summary.adapterPreflightOk ?? null,
    adapterPreflightReady: preflightDecision?.adapterPreflightReady ?? null,
    adapterPreflightLikelyFixArea: preflightDecision?.likelyFixArea || null,
    adapterPreflightRecommendedNextAction: preflightDecision?.recommendedNextAction || null,
    adapterRegistryFingerprint: summary.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: summary.adapterRegistryAdapterFingerprint || null,
    stageDir: summary.stageDir || null,
    scratchDir: summary.scratchDir || null,
    chunkDir: summary.chunkDir || null,
    adapterLogPath: summary.adapterLogPath || null,
    adapterStdoutPath: summary.adapterStdoutPath || null,
    adapterStderrPath: summary.adapterStderrPath || null,
    adapterRequestReady: true,
    adapterStageDirectoriesReady: true,
    runsTranslator: false,
    launchesAdapter: false,
    writesTargetReferenceManifest: false,
    validatesCanonicalOutput: false,
    outputValidationRequired: true,
    safeNextAction: "run-external-adapter-wrapper",
    recommendedNextAction: "run-external-adapter-and-validate-output"
  };
}

function referenceTranslationAdapterRequestSummary(request, {
  inputPath,
  outputPath,
  format = null,
  name = null,
  units = null,
  assetId = null,
  adapterConfigPath = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = undefined
} = {}) {
  const adapterConfigMetadata = adapterConfigFileMetadata(request.adapterConfigPath || adapterConfigPath || null);
  const preflightMetadata = adapterRequestPreflightMetadata({
    adapterConfigPath: request.adapterConfigPath || adapterConfigPath || null,
    format: request.requestedFormat || request.format || format,
    adapterName: request.adapterKey || null
  });
  const planBase = referenceTranslationPlanBase({
    inputPath: inputPath || request.input,
    outputPath: outputPath || request.output,
    format: format || request.requestedFormat || request.format,
    name: name ?? request.name,
    units,
    assetId: assetId || request.assetId,
    adapterConfigPath: request.adapterConfigPath || adapterConfigPath || null,
    adapterTimeoutMs,
    pointCloudChunkSize
  });
  const summary = attachReferenceTranslationPlanFingerprint({
    ...planBase,
    referenceTranslationExecutionMode: "adapter-request",
    referenceTranslationSideEffectPlan: referenceTranslationSideEffectPlan("adapter-request", {
      translationMode: "external-adapter"
    }),
    translationMode: "external-adapter",
    ...adapterConfigMetadata,
    ...preflightMetadata,
    adapterKey: request.adapterKey || null,
    adapterOutputMode: request.outputMode || null,
    path: request.request,
    request: request.request,
    schemaVersion: request.schemaVersion,
    adapterRequestFingerprint: request.adapterRequestFingerprint,
    adapterRequestEvidenceFingerprint: request.adapterRequestEvidenceFingerprint || null,
    adapterRunId: request.adapterRunId,
    adapterRegistryFingerprint: request.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: request.adapterRegistryAdapterFingerprint || null,
    input: request.input,
    output: request.output,
    sourceDirectory: request.sourceDirectory,
    stageDir: request.stageDir,
    adapterRequestPath: request.request,
    scratchDir: request.scratchDir,
    outputFileName: request.outputFileName,
    outputFileStem: request.outputFileStem,
    chunkDir: request.chunkDir,
    chunkPathPrefix: request.chunkPathPrefix,
    adapterLogPath: request.adapterLogPath,
    adapterStdoutPath: request.adapterStdoutPath,
    adapterStderrPath: request.adapterStderrPath,
    outputMode: request.outputMode,
    format: request.format,
    requestedFormat: request.requestedFormat,
    adapterConfigDir: request.adapterConfigDir || null,
    assetId: request.assetId,
    units: request.units,
    pointCloudChunkSize: request.pointCloudChunkSize,
    timeoutMs: request.timeoutMs,
    adapterRequestSchemaPath: request.schemas?.adapterRequest || null,
    referenceGeometrySchemaPath: request.schemas?.referenceGeometry || null,
    pointCloudChunkSchemaPath: request.schemas?.pointCloudChunk || null,
    schemaVersions: request.schemaVersions,
    schemas: request.schemas
  });
  summary.referenceTranslationAdapterRequestDecision = referenceTranslationAdapterRequestDecision(summary);
  return attachReferenceTranslationWorkflowStatus(summary, "adapter-request");
}

export function planReferenceGeometryTranslation({
  inputPath,
  outputPath,
  format = null,
  name = null,
  units = null,
  assetId = null,
  adapterConfigPath = null,
  adapterName = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = undefined
} = {}) {
  if (!inputPath) throw new Error("Missing inputPath");
  if (!outputPath) throw new Error("Missing outputPath");
  const base = referenceTranslationPlanBase({
    inputPath,
    outputPath,
    format,
    name,
    units,
    assetId,
    adapterConfigPath,
    adapterTimeoutMs,
    pointCloudChunkSize
  });
  try {
    return attachReferenceTranslationWorkflowStatus(attachReferenceTranslationPlanFingerprint({
      ...base,
      ...adapterPlanMetadata({
        translationMode: base.translationMode,
        adapterConfigPath,
        format,
        adapterName
      })
    }), "plan-only");
  } catch (error) {
    throw attachReferenceTranslationErrorContext(error, attachReferenceTranslationWorkflowStatus(attachReferenceTranslationPlanFingerprint({
      ...base,
      ...adapterPlanErrorMetadata(error, { adapterConfigPath, adapterName })
    }), "plan-only", { stageComplete: false }));
  }
}

function sourceInputFileProbe(absoluteInputPath) {
  const summary = {
    inputPath: absoluteInputPath,
    inputExists: false,
    inputIsFile: null,
    sourceFileName: path.basename(absoluteInputPath) || null,
    sourceFileStem: path.basename(absoluteInputPath, path.extname(absoluteInputPath)) || null,
    sourceFileExtension: path.extname(absoluteInputPath).slice(1).toLowerCase() || null,
    sourceFileSizeBytes: null,
    sourceFileModifiedTime: null,
    sourceStatFingerprint: null
  };
  if (!fs.existsSync(absoluteInputPath)) return summary;
  const stat = fs.statSync(absoluteInputPath);
  summary.inputExists = true;
  summary.inputIsFile = stat.isFile();
  if (!summary.inputIsFile) return summary;
  return {
    ...summary,
    ...sourceFileMetadata(absoluteInputPath)
  };
}

function sourceDescriptionTranslationMode({ sourceFormat, requestedFormat, adapterConfigPath }) {
  if (sourceFormat === "json") return "canonical-json";
  const requestedSpec = FORMAT_REGISTRY[requestedFormat];
  const spec = FORMAT_REGISTRY[sourceFormat];
  if (adapterConfigPath && spec?.adapterCapable === true) return "external-adapter";
  if (requestedSpec?.state === "external-adapter-required" || spec?.state === "external-adapter-required") return "external-adapter";
  if (spec?.state === "implemented") return "built-in";
  return spec?.state || null;
}

function adapterRegistrySourceMetadata(adapterConfigPath, sourceFormat) {
  if (!adapterConfigPath) {
    return {
      ...adapterConfigFileMetadata(null),
      adapterRegistryFingerprint: null,
      adapterRegistryFingerprints: {},
      adapterRegistryAdapterKeys: [],
      adapterRegistrySourceFormatAdapterKeys: [],
      adapterRegistrySupportsSourceFormat: null
    };
  }
  const registry = describeReferenceGeometryAdapters(adapterConfigPath);
  const adapters = registry.adapters || {};
  const adapterKeys = Object.keys(adapters).sort();
  const sourceFormatAdapterKeys = adapterKeys
    .filter((key) => adapterFormats(adapters[key], key).includes(sourceFormat));
  return {
    adapterConfigPath: registry.adapterConfigPath || registry.path || path.resolve(adapterConfigPath),
    adapterConfigFileSizeBytes: Number.isInteger(registry.adapterConfigFileSizeBytes) ? registry.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: registry.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: registry.adapterConfigStatFingerprint || null,
    adapterRegistryFingerprint: registry.adapterRegistryFingerprint || null,
    adapterRegistryFingerprints: Object.fromEntries(adapterKeys.map((key) => [
      key,
      adapters[key]?.adapterRegistryFingerprint || null
    ])),
    adapterRegistryAdapterKeys: adapterKeys,
    adapterRegistrySourceFormatAdapterKeys: sourceFormatAdapterKeys,
    adapterRegistrySupportsSourceFormat: sourceFormatAdapterKeys.length > 0
  };
}

export function referenceSourceDescriptionContractMetadata() {
  const contract = {
    sourceDescriptionContractVersion: REFERENCE_TRANSLATION_CONTRACT_VERSION,
    discoveryCommand: "--describe-source",
    cliFlags: [
      "--describe-source",
      "--input",
      "--format",
      "--adapter-config"
    ],
    requiredInputs: [
      "inputPath"
    ],
    optionalInputs: [
      "format",
      "adapterConfigPath"
    ],
    sideEffects: {
      requiresOutputPath: false,
      requiresProjectPath: false,
      requiresExistingSourceFile: false,
      createsDirectories: false,
      preflightsAdapters: false,
      launchesAdapters: false,
      writesProjectJson: false,
      writesReferenceManifest: false,
      writesReferenceChunks: false
    },
    sourceIdentityFields: [
      "inputPath",
      "inputExists",
      "inputIsFile",
      "sourceFileName",
      "sourceFileStem",
      "sourceFileExtension",
      "sourceFileSizeBytes",
      "sourceFileModifiedTime",
      "sourceStatFingerprint"
    ],
    formatFields: [
      "explicitFormat",
      "formatInferredFromExtension",
      "explicitFormatOverridesExtension",
      "format",
      "canonicalFormat",
      "sourceFormat",
      "requestedFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "requestedFormatIsAlias",
      "requestedFormatIsFileExtension",
      "requestedFormatState",
      "canonicalFormatState",
      "translationMode",
      "builtInAvailable",
      "canonicalBuiltInAvailable",
      "externalAdapterRequired",
      "adapterCapable",
      "adapterSelected"
    ],
    requestedFormatPolicy: {
      sourceFormatField: "sourceFormat",
      requestedFormatField: "sourceRequestedFormat",
      canonicalFormatField: "canonicalFormat",
      requestedFormatAliasesByFormat: sourceRequestedFormatAliasesByFormat(),
      unknownFormatPolicy: "reject-before-source-description",
      sideEffectFreeDiscovery: true,
      policy: "sourceRequestedFormat is the explicit source token or inferred extension before canonical normalization; canonicalFormat/sourceFormat selects the canonical family"
    },
    adapterConfigMetadataFields: [
      "adapterConfigPath",
      "adapterConfigFileSizeBytes",
      "adapterConfigFileModifiedTime",
      "adapterConfigStatFingerprint"
    ],
    adapterRegistryMetadataFields: [
      "adapterRegistryFingerprint",
      "adapterRegistryFingerprints",
      "adapterRegistryAdapterKeys",
      "adapterRegistrySourceFormatAdapterKeys",
      "adapterRegistrySupportsSourceFormat"
    ],
    filePickerFields: [
      "accept",
      "acceptExtensions",
      "fileExtensions",
      "formatTokens",
      "cliOnlyTokens"
    ],
    nestedMetadataFields: [
      "formatInfo",
      "formatGroup"
    ],
    sourceDecisionField: "referenceTranslationSourceDecision",
    sourceDecisionFields: [
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "canonicalFormat",
      "inputExists",
      "inputIsFile",
      "sourceFileReadyForTranslation",
      "translationMode",
      "canonicalJsonPassthrough",
      "builtInAvailable",
      "externalAdapterRequired",
      "adapterConfigProvided",
      "adapterRegistrySupportsSourceFormat",
      "adapterRequestCapable",
      "canWriteAdapterRequest",
      "sideEffectFreeDiscovery",
      "requiresOutputForNextStep",
      "safeFirstExecutionMode",
      "availableExecutionModes",
      "recommendedNextAction"
    ],
    fingerprintField: "referenceSourceDescriptionFingerprint",
    jsonErrorEnvelopeFields: [
      "ok",
      "referenceTranslationContractVersion",
      "errors"
    ],
    jsonErrorPrimaryFields: [
      "message",
      "adapterErrorCode",
      "adapterConfigPath",
      "adapterConfigStatFingerprint"
    ]
  };
  contract.sourceDescriptionContractFingerprint = referenceSourceDescriptionContractFingerprint(contract);
  return contract;
}

function referenceTranslationSourceExecutionModes(source = {}) {
  const canonicalJson = source.sourceFormat === "json";
  const modes = ["plan-only"];
  if (source.adapterCapable === true && !canonicalJson) modes.push("adapter-request");
  modes.push("translate");
  if (canonicalJson) modes.push("validate-only");
  return modes;
}

function referenceTranslationSourceNextAction({
  sourceFileReadyForTranslation = false,
  canonicalJson = false,
  externalAdapterRequired = false,
  adapterConfigProvided = false,
  adapterRegistrySupportsSourceFormat = null
} = {}) {
  if (!sourceFileReadyForTranslation) return "choose-existing-file";
  if (canonicalJson) return "validate-canonical-json-or-plan-passthrough";
  if (!externalAdapterRequired) return "run-plan-only";
  if (!adapterConfigProvided) return "select-adapter-config-or-check-adapter-preflight";
  if (adapterRegistrySupportsSourceFormat === false) return "select-compatible-adapter-config";
  return "check-adapter-preflight";
}

function referenceTranslationSourceDecision(source = {}) {
  const canonicalJson = source.sourceFormat === "json";
  const externalAdapterRequired = source.translationMode === "external-adapter";
  const adapterConfigProvided = Boolean(source.adapterConfigPath);
  const sourceFileReadyForTranslation = source.inputExists === true && source.inputIsFile === true;
  const adapterRegistrySupportsSourceFormat = source.adapterRegistrySupportsSourceFormat ?? null;
  const adapterRequestCapable = source.adapterCapable === true && !canonicalJson;
  return {
    sourceFormat: source.sourceFormat || source.canonicalFormat || source.format || null,
    sourceRequestedFormat: source.sourceRequestedFormat || source.requestedFormat || null,
    sourceRequestedFormatFamily: source.sourceRequestedFormatFamily || source.canonicalFormat || source.sourceFormat || null,
    sourceRequestedFormatAliases: Array.isArray(source.sourceRequestedFormatAliases) ? source.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: source.sourceRequestedFormatMatchesFamily ?? null,
    canonicalFormat: source.canonicalFormat || source.sourceFormat || null,
    inputExists: source.inputExists ?? null,
    inputIsFile: source.inputIsFile ?? null,
    sourceFileReadyForTranslation,
    translationMode: source.translationMode || null,
    canonicalJsonPassthrough: canonicalJson,
    builtInAvailable: source.builtInAvailable === true,
    externalAdapterRequired,
    adapterConfigProvided,
    adapterRegistrySupportsSourceFormat,
    adapterRequestCapable,
    canWriteAdapterRequest: adapterRequestCapable,
    sideEffectFreeDiscovery: true,
    requiresOutputForNextStep: true,
    safeFirstExecutionMode: "plan-only",
    availableExecutionModes: referenceTranslationSourceExecutionModes(source),
    recommendedNextAction: referenceTranslationSourceNextAction({
      sourceFileReadyForTranslation,
      canonicalJson,
      externalAdapterRequired,
      adapterConfigProvided,
      adapterRegistrySupportsSourceFormat
    })
  };
}

function referenceSourceDescriptionFingerprint(description = {}) {
  const payload = {
    inputPath: description.inputPath || null,
    inputExists: description.inputExists ?? null,
    inputIsFile: description.inputIsFile ?? null,
    sourceFileName: description.sourceFileName || null,
    sourceFileStem: description.sourceFileStem || null,
    sourceFileExtension: description.sourceFileExtension || null,
    sourceFileSizeBytes: Number.isInteger(description.sourceFileSizeBytes) ? description.sourceFileSizeBytes : null,
    sourceFileModifiedTime: description.sourceFileModifiedTime || null,
    sourceStatFingerprint: description.sourceStatFingerprint || null,
    explicitFormat: description.explicitFormat ?? null,
    formatInferredFromExtension: description.formatInferredFromExtension ?? null,
    explicitFormatOverridesExtension: description.explicitFormatOverridesExtension ?? null,
    format: description.format || null,
    canonicalFormat: description.canonicalFormat || null,
    sourceFormat: description.sourceFormat || null,
    requestedFormat: description.requestedFormat || null,
    sourceRequestedFormat: description.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: description.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(description.sourceRequestedFormatAliases) ? description.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: description.sourceRequestedFormatMatchesFamily ?? null,
    requestedFormatIsAlias: description.requestedFormatIsAlias ?? null,
    requestedFormatIsFileExtension: description.requestedFormatIsFileExtension ?? null,
    requestedFormatState: description.requestedFormatState || null,
    canonicalFormatState: description.canonicalFormatState || null,
    translationMode: description.translationMode || null,
    builtInAvailable: description.builtInAvailable ?? null,
    canonicalBuiltInAvailable: description.canonicalBuiltInAvailable ?? null,
    externalAdapterRequired: description.externalAdapterRequired ?? null,
    adapterCapable: description.adapterCapable ?? null,
    adapterConfigPath: description.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(description.adapterConfigFileSizeBytes) ? description.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: description.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: description.adapterConfigStatFingerprint || null,
    adapterRegistryFingerprint: description.adapterRegistryFingerprint || null,
    adapterRegistryFingerprints: isRecord(description.adapterRegistryFingerprints) ? description.adapterRegistryFingerprints : null,
    adapterRegistryAdapterKeys: Array.isArray(description.adapterRegistryAdapterKeys) ? description.adapterRegistryAdapterKeys : null,
    adapterRegistrySourceFormatAdapterKeys: Array.isArray(description.adapterRegistrySourceFormatAdapterKeys) ? description.adapterRegistrySourceFormatAdapterKeys : null,
    adapterRegistrySupportsSourceFormat: description.adapterRegistrySupportsSourceFormat ?? null,
    adapterSelected: description.adapterSelected ?? null,
    accept: description.accept || "",
    acceptExtensions: Array.isArray(description.acceptExtensions) ? description.acceptExtensions : null,
    fileExtensions: Array.isArray(description.fileExtensions) ? description.fileExtensions : null,
    formatTokens: Array.isArray(description.formatTokens) ? description.formatTokens : null,
    cliOnlyTokens: Array.isArray(description.cliOnlyTokens) ? description.cliOnlyTokens : null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export function describeReferenceGeometrySource({ inputPath, format = null, adapterConfigPath = null } = {}) {
  if (!inputPath) throw new Error("Missing inputPath");
  const absoluteInputPath = path.resolve(inputPath);
  const explicitFormat = typeof format === "string" && format.trim() !== "";
  const requestedFormat = requestedFormatToken(format, absoluteInputPath);
  const sourceFormat = normalizeFormat(explicitFormat ? format : formatFromPath(absoluteInputPath));
  const formats = supportedReferenceGeometryFormats();
  const groups = supportedReferenceGeometryFormatGroups();
  const requestedSpec = formats[requestedFormat];
  const canonicalSpec = formats[sourceFormat];
  if (!requestedSpec || !canonicalSpec) throw unsupportedReferenceFormatError(sourceFormat || requestedFormat);
  const sourceFile = sourceInputFileProbe(absoluteInputPath);
  const extensionFormat = sourceFile.sourceFileExtension ? normalizeFormat(sourceFile.sourceFileExtension) : null;
  const externalAdapterRequired = requestedSpec.state === "external-adapter-required" || canonicalSpec.state === "external-adapter-required";
  const adapterCapable = canonicalSpec.adapterCapable === true;
  const adapterConfig = adapterConfigPath ? path.resolve(adapterConfigPath) : null;
  const adapterRegistryMetadata = adapterRegistrySourceMetadata(adapterConfig, sourceFormat);
  const sourceRequestedFormatAliases = sourceRequestedFormatAliasesByFormat()[sourceFormat] || [];
  const description = {
    ...sourceFile,
    explicitFormat,
    formatInferredFromExtension: !explicitFormat,
    explicitFormatOverridesExtension: Boolean(explicitFormat && extensionFormat && extensionFormat !== sourceFormat),
    format: sourceFormat,
    canonicalFormat: sourceFormat,
    sourceFormat,
    requestedFormat,
    sourceRequestedFormat: requestedFormat,
    sourceRequestedFormatFamily: sourceFormat,
    sourceRequestedFormatAliases,
    sourceRequestedFormatMatchesFamily: sourceRequestedFormatAliases.includes(requestedFormat),
    requestedFormatIsAlias: requestedSpec.isAlias === true,
    requestedFormatIsFileExtension: requestedSpec.isFileExtension === true,
    requestedFormatState: requestedSpec.state,
    canonicalFormatState: canonicalSpec.state,
    translationMode: sourceDescriptionTranslationMode({ sourceFormat, requestedFormat, adapterConfigPath }),
    builtInAvailable: canonicalSpec.state === "implemented" && requestedSpec.state !== "external-adapter-required",
    canonicalBuiltInAvailable: canonicalSpec.state === "implemented",
    externalAdapterRequired,
    adapterCapable,
    ...adapterRegistryMetadata,
    adapterSelected: Boolean(adapterConfig && adapterCapable),
    accept: groups[sourceFormat]?.accept || canonicalSpec.canonicalAccept || "",
    acceptExtensions: groups[sourceFormat]?.acceptExtensions || canonicalSpec.canonicalAcceptExtensions || [],
    fileExtensions: groups[sourceFormat]?.fileExtensions || canonicalSpec.canonicalFileExtensions || [],
    formatTokens: groups[sourceFormat]?.formatTokens || canonicalSpec.canonicalFormatTokens || [sourceFormat],
    cliOnlyTokens: groups[sourceFormat]?.cliOnlyTokens || [],
    formatInfo: requestedSpec,
    formatGroup: groups[sourceFormat] || null
  };
  description.referenceSourceDescriptionFingerprint = referenceSourceDescriptionFingerprint(description);
  description.referenceTranslationSourceDecision = referenceTranslationSourceDecision(description);
  return attachReferenceTranslationWorkflowStatus(description, "source-discovery");
}

export function translateDxfText(text, options = {}) {
  const pairs = parseDxfPairs(text);
  assertSupportedDxfAsciiSource(text, pairs);
  const { layerColors, layerOpacities } = collectDxfLayers(pairs);
  const diagnostics = [];
  const blockDefinitions = collectDxfBlocks(pairs, diagnostics);
  const lineSets = new Map();
  const meshSets = new Map();
  const pointSets = new Map();
  const assetUnits = resolveDetectedUnits({
    explicitUnits: options.units,
    detectedUnits: detectDxfUnits(pairs, diagnostics),
    diagnostics,
    codePrefix: "dxf",
    sourceLabel: "DXF file"
  });
  const unsupported = new Map();
  const handledTypes = new Set(["LINE", "3DLINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "LEADER", "MLINE", "HELIX", "TEXT", "MTEXT", "MLEADER", "MULTILEADER", "TOLERANCE", "ATTDEF", "ATTRIB", "XLINE", "RAY", ...DXF_RASTER_REFERENCE_TYPES, ...DXF_ACIS_ENTITY_TYPES, ...DXF_PROXY_ENTITY_TYPES, "HATCH", "POINT", "3DFACE", "SOLID", "TRACE", "MESH", "INSERT", "DIMENSION"]);
  const ignoredTypes = new Set(["SECTION", "ENDSEC", "EOF", "TABLE", "ENDTAB", "LAYER", "VERTEX", "SEQEND", "BLOCK", "ENDBLK", ...DXF_METADATA_RECORD_TYPES]);
  addDxfEntities(pairs, {
    layerColors,
    layerOpacities,
    blocks: blockDefinitions.blocks,
    blockSkipStarts: blockDefinitions.skipStarts,
    invalidBlocks: blockDefinitions.invalidBlocks,
    lineSets,
    meshSets,
    pointSets,
    diagnostics,
    unsupported,
    handledTypes,
    ignoredTypes
  });

  for (const [type, count] of [...unsupported.entries()].sort()) {
    addDiagnostic(diagnostics, "warning", "dxf-unsupported-entity", `Skipped ${count} unsupported DXF ${type} entity record(s).`);
  }

  const layers = {};
  const objects = {};
  const usedObjectIds = new Set();
  const usedLayerIds = new Set();
  const layerIds = new Map();
  const allPoints = [];
  const allLayerNames = new Set([
    ...[...lineSets.values()].map((set) => set.layer),
    ...[...meshSets.values()].map((set) => set.layer),
    ...[...pointSets.values()].map((set) => set.layer)
  ]);
  for (const layer of [...allLayerNames].sort()) {
    const layerId = sourceReferenceId(layer, usedLayerIds, "dxf_layer");
    layerIds.set(layer, layerId);
    layers[layerId] = {
      id: layerId,
      name: layer,
      display: {
        color: layerColors.get(layer) || firstDxfGeometryColor(layer, lineSets, meshSets, pointSets) || "#2563eb",
        ...(Number.isFinite(layerOpacities.get(layer)) ? { opacity: layerOpacities.get(layer) } : {})
      }
    };
  }

  for (const lineSet of sortedDxfGeometrySets(lineSets)) {
    if (!lineSet.lineSegments.length) continue;
    const layer = lineSet.layer;
    const layerId = layerIds.get(layer);
    const id = uniqueSanitizedId(`dxf_lines_${layer}${dxfObjectAppearanceSuffix(lineSets, lineSet)}`, usedObjectIds, "dxf_lines");
    objects[id] = lineObject(id, `DXF linework ${layer}`, layerId, lineSet);
    allPoints.push(...lineSet.vertices);
  }
  for (const meshSet of sortedDxfGeometrySets(meshSets)) {
    if (!meshSet.faces.length) continue;
    const layer = meshSet.layer;
    const layerId = layerIds.get(layer);
    const id = uniqueSanitizedId(`dxf_faces_${layer}${dxfObjectAppearanceSuffix(meshSets, meshSet)}`, usedObjectIds, "dxf_faces");
    objects[id] = meshObject(id, `DXF faces ${layer}`, layerId, meshSet);
    allPoints.push(...meshSet.vertices);
  }
  for (const pointSet of sortedDxfGeometrySets(pointSets)) {
    if (!pointSet.points.length) continue;
    const layer = pointSet.layer;
    const layerId = layerIds.get(layer);
    const id = uniqueSanitizedId(`dxf_points_${layer}${dxfObjectAppearanceSuffix(pointSets, pointSet)}`, usedObjectIds, "dxf_points");
    objects[id] = pointObject(id, `DXF points ${layer}`, layerId, pointSet);
    allPoints.push(...pointSet.points);
  }

  if (!Object.keys(objects).length) {
    addDiagnostic(diagnostics, "warning", "dxf-no-supported-geometry", "DXF contained no supported reference geometry entities.");
  }

  const sourceFileName = options.sourceFileName || "source.dxf";
  const assetId = normalizedExplicitReferenceAssetId(options.assetId) || sanitizeId(path.basename(sourceFileName, path.extname(sourceFileName)), "dxf_reference");
  return {
    $schema: options.schemaRef || "../../app/schemas/reference-geometry.schema.json",
    schema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    schemaVersion: REFERENCE_GEOMETRY_SCHEMA_VERSION,
    asset: {
      id: assetId,
      name: options.name || path.basename(sourceFileName),
      source: withSourceFileMetadata({
        format: "dxf",
        fileName: path.basename(sourceFileName),
        checksum: checksum(text),
        translator: "tools/reference-geometry/translate_reference_geometry.mjs",
        translatorVersion: "0.1.0"
      }, options),
      units: assetUnits,
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: boundsFor(allPoints)
    },
    layers,
    objects,
    chunks: [],
    diagnostics
  };
}

export function translateReferenceGeometryText(text, options = {}) {
  const effectiveName = normalizedExplicitReferenceName(options.name);
  const nextOptions = { ...options, name: effectiveName };
  const requestedFormat = requestedFormatToken(options.format, options.sourceFileName || "");
  const requestedSpec = FORMAT_REGISTRY[requestedFormat];
  if (requestedSpec?.state === "external-adapter-required") {
    throw new Error(`Reference geometry format ${requestedFormat} requires an external adapter; ${requestedSpec.description}`);
  }
  const format = normalizeFormat(options.format || options.sourceFileName && formatFromPath(options.sourceFileName));
  const spec = FORMAT_REGISTRY[format];
  if (!spec) throw unsupportedReferenceFormatError(format);
  if (spec.state !== "implemented") {
    throw new Error(`Reference geometry format ${format} is registered as ${spec.state}; ${spec.description}`);
  }
  if (format === "dxf") return translateDxfText(text, nextOptions);
  if (format === "step") return translateStepText(text, nextOptions);
  if (format === "ifc") return translateIfcText(text, nextOptions);
  throw new Error(`No translator implemented for format: ${format}`);
}

export function translateReferenceGeometryFile({
  inputPath,
  outputPath,
  format = null,
  name = null,
  units = null,
  assetId = null,
  adapterConfigPath = null,
  adapterName = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = DEFAULT_POINT_CLOUD_CHUNK_SIZE,
  keepStage = false,
  keepStageOnError = false
}) {
  if (!inputPath) throw new Error("Missing inputPath");
  if (!outputPath) throw new Error("Missing outputPath");
  const absoluteInput = path.resolve(inputPath);
  const absoluteOutput = path.resolve(outputPath);
  const requestedFormat = requestedFormatToken(format, absoluteInput);
  const sourceFormat = normalizeFormat(format || formatFromPath(absoluteInput));
  const requestedSpec = FORMAT_REGISTRY[requestedFormat];
  const spec = FORMAT_REGISTRY[sourceFormat];
  if (!spec) throw unsupportedReferenceFormatError(sourceFormat);
  const effectivePointCloudChunkSize = normalizedPointCloudChunkSize(pointCloudChunkSize) ?? DEFAULT_POINT_CLOUD_CHUNK_SIZE;
  const explicitUnits = normalizedExplicitReferenceUnits(units);
  const explicitAssetId = normalizedExplicitReferenceAssetId(assetId);
  const explicitName = normalizedExplicitReferenceName(name);
  const targetUnits = explicitUnits || DEFAULT_REFERENCE_UNITS;
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });

  if (sourceFormat === "json") {
    return copyCanonicalReferenceGeometryFile({
      inputPath: absoluteInput,
      outputPath: absoluteOutput,
      name: explicitName,
      units: targetUnits,
      assetId: explicitAssetId,
      pointCloudChunkSize: effectivePointCloudChunkSize
    });
  }

  if (adapterName && !adapterConfigPath && requestedSpec?.state !== "external-adapter-required") {
    throw namedAdapterRequiresConfigTranslationError({
      adapterName,
      sourceFormat,
      requestedFormat,
      inputPath: absoluteInput
    });
  }

  const externalAdapterPathRequested = adapterConfigPath || requestedSpec?.state === "external-adapter-required";
  if (!externalAdapterPathRequested) {
    const adapterDebugOptions = [];
    if (adapterTimeoutMs !== null && adapterTimeoutMs !== undefined) adapterDebugOptions.push("--adapter-timeout-ms");
    if (flagEnabled(keepStage)) adapterDebugOptions.push("--keep-stage");
    if (flagEnabled(keepStageOnError)) adapterDebugOptions.push("--keep-stage-on-error");
    if (adapterDebugOptions.length) {
      throw adapterDebugOptionsRequireConfigTranslationError({
        optionNames: adapterDebugOptions,
        sourceFormat,
        requestedFormat,
        inputPath: absoluteInput
      });
    }
  }

  if (externalAdapterPathRequested) {
    return translateReferenceGeometryWithExternalAdapter({
      inputPath: absoluteInput,
      outputPath: absoluteOutput,
      format: sourceFormat,
      requestedFormat,
      name: explicitName,
      units: targetUnits,
      assetId: explicitAssetId,
      adapterConfigPath,
      adapterName,
      adapterTimeoutMs,
      pointCloudChunkSize: effectivePointCloudChunkSize,
      keepStage,
      keepStageOnError
    });
  }

  if (spec.state === "implemented") {
    const sourceFile = sourceFileMetadata(absoluteInput);
    const sourceText = fs.readFileSync(absoluteInput, "utf8");
    const result = translateReferenceGeometryText(sourceText, {
      format: sourceFormat,
      requestedFormat,
      sourceFileName: absoluteInput,
      sourceFileExtension: sourceFile.sourceFileExtension,
      sourceFileSizeBytes: sourceFile.sourceFileSizeBytes,
      sourceFileModifiedTime: sourceFile.sourceFileModifiedTime,
      sourceStatFingerprint: sourceFile.sourceStatFingerprint,
      schemaRef: schemaRefForOutput(absoluteOutput),
      name: explicitName,
      units: explicitUnits,
      assetId: explicitAssetId
    });
    return writeReferenceGeometryOutput(absoluteOutput, result, { pointCloudChunkSize: effectivePointCloudChunkSize });
  }

  if (spec.state === "external-adapter-required") {
    return translateReferenceGeometryWithExternalAdapter({
      inputPath: absoluteInput,
      outputPath: absoluteOutput,
      format: sourceFormat,
      requestedFormat,
      name: explicitName,
      units: targetUnits,
      assetId: explicitAssetId,
      adapterConfigPath,
      adapterName,
      adapterTimeoutMs,
      pointCloudChunkSize: effectivePointCloudChunkSize,
      keepStage,
      keepStageOnError
    });
  }

  throw new Error(`Reference geometry format ${sourceFormat} is registered as ${spec.state}; ${spec.description}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.listTranslationDiscovery) {
    console.log(JSON.stringify(referenceGeometryTranslationDiscoveryCatalog(), null, 2));
    return 0;
  }
  if (args.listFormats) {
    console.log(JSON.stringify(supportedReferenceGeometryFormats(), null, 2));
    return 0;
  }
  if (args.listFormatGroups) {
    console.log(JSON.stringify(supportedReferenceGeometryFormatGroups(), null, 2));
    return 0;
  }
  if (args.describeSource) {
    if (!args.input) throw new Error("--describe-source requires --input");
    console.log(JSON.stringify(describeReferenceGeometrySource({
      inputPath: args.input,
      format: args.format,
      adapterConfigPath: args.adapterConfig || null
    }), null, 2));
    return 0;
  }
  if (args.listAdapters) {
    if (!args.adapterConfig) throw new Error("--list-adapters requires --adapter-config");
    console.log(JSON.stringify(describeReferenceGeometryAdapters(args.adapterConfig), null, 2));
    return 0;
  }
  if (args.checkAdapters) {
    if (!args.adapterConfig) throw new Error("--check-adapters requires --adapter-config");
    const result = checkReferenceGeometryAdapters(args.adapterConfig, {
      format: args.format,
      adapterName: args.adapter
    });
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }
  if (flagEnabled(args.planOnly)) {
    const incompatibleOptions = [];
    if (args.validateOnly) incompatibleOptions.push("--validate-only");
    if (args.writeAdapterRequest) incompatibleOptions.push("--write-adapter-request");
    if (incompatibleOptions.length) {
      throw cliOptionError(`--plan-only cannot be combined with ${incompatibleOptions.join(", ")}`, "cli-option-combination-invalid");
    }
    const stagePreservationOptions = stagePreservationOptionNamesFromArgs(args);
    if (stagePreservationOptions.length) throw adapterRunOptionsPlanOnlyError(stagePreservationOptions);
    if (!args.input || !args.output) throw new Error("--plan-only requires --input and --output");
    const result = planReferenceGeometryTranslation({
      inputPath: args.input,
      outputPath: args.output,
      format: args.format,
      name: args.name,
      units: args.units,
      assetId: args.assetId,
      adapterConfigPath: args.adapterConfig || null,
      adapterName: args.adapter || null,
      adapterTimeoutMs: args.adapterTimeoutMs,
      pointCloudChunkSize: args.pointCloudChunkSize
    });
    if (args.json) console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    else {
      console.log(`Translation plan: ${result.inputPath} -> ${result.outputPath}`);
      console.log(`Mode: ${result.translationMode}`);
    }
    return 0;
  }
  if (args.validateOnly) {
    if (!args.input) throw new Error("--validate-only requires --input");
    try {
      console.log(JSON.stringify(describeValidatedReferenceGeometry(args.input), null, 2));
    } catch (error) {
      throw attachReferenceTranslationExecutionErrorContext(error, referenceTranslationExecutionErrorMetadata("validate-only", {
        translationMode: "canonical-json"
      }));
    }
    return 0;
  }
  if (args.writeAdapterRequest) {
    if (!args.input || !args.output) throw new Error("--write-adapter-request requires --input and --output");
    const stagePreservationOptions = stagePreservationOptionNamesFromArgs(args);
    if (stagePreservationOptions.length) throw adapterStagePreservationOptionsRequestOnlyError(stagePreservationOptions);
    const request = writeReferenceGeometryAdapterRequest({
      inputPath: args.input,
      outputPath: args.output,
      requestPath: args.writeAdapterRequest,
      format: args.format,
      name: args.name,
      units: args.units,
      assetId: args.assetId,
      pointCloudChunkSize: args.pointCloudChunkSize,
      adapterTimeoutMs: args.adapterTimeoutMs,
      adapterKey: args.adapter || null,
      adapterConfigPath: args.adapterConfig || null
    });
    if (args.json) {
      console.log(JSON.stringify({
        ok: true,
        ...referenceTranslationAdapterRequestSummary(request, {
          inputPath: args.input,
          outputPath: args.output,
          format: args.format,
          name: args.name,
          units: args.units,
          assetId: args.assetId,
          adapterConfigPath: args.adapterConfig || null,
          adapterTimeoutMs: args.adapterTimeoutMs,
          pointCloudChunkSize: args.pointCloudChunkSize
        })
      }, null, 2));
    } else {
      console.log(`OK: wrote reference adapter request to ${path.resolve(args.writeAdapterRequest)}`);
    }
    return 0;
  }
  if (!args.input || !args.output) throw new Error("Both --input and --output are required.\n\n" + usage());
  const translationMode = referenceTranslationModeFromCliArgs(args);
  try {
    const result = translateReferenceGeometryFile({
      inputPath: args.input,
      outputPath: args.output,
      format: args.format,
      name: args.name,
      units: args.units,
      assetId: args.assetId,
      adapterConfigPath: args.adapterConfig,
      adapterName: args.adapter,
      adapterTimeoutMs: args.adapterTimeoutMs,
      pointCloudChunkSize: args.pointCloudChunkSize,
      keepStage: flagEnabled(args.keepStage),
      keepStageOnError: flagEnabled(args.keepStageOnError)
    });
    if (args.json) {
      console.log(JSON.stringify(describeTranslatedReferenceGeometry(args.output, result, {
        adapterConfigPath: args.adapterConfig || null
      }), null, 2));
    } else {
      console.log(`OK: wrote ${Object.keys(result.objects).length} reference object(s) to ${path.resolve(args.output)}`);
    }
  } catch (error) {
    throw attachReferenceTranslationExecutionErrorContext(error, referenceTranslationExecutionErrorMetadata("translate", {
      translationMode
    }));
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      if (wantsJsonOutput(process.argv.slice(2))) {
        console.log(JSON.stringify(describeCliError(error), null, 2));
      } else {
        console.error(error.message || error);
      }
      process.exit(1);
    });
}
