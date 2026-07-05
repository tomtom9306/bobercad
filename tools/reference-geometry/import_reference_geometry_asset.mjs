#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  adapterRunOptionsPlanOnlyError,
  adapterStagePreservationOptionsRequestOnlyError,
  checkReferenceGeometryAdapters,
  describeReferenceGeometryAdapters,
  describeReferenceGeometrySource,
  normalizedExplicitReferenceUnits,
  normalizedPointCloudChunkSize,
  normalizedReferenceFormatToken,
  normalizedExplicitReferenceAssetId,
  normalizedExplicitReferenceName,
  referenceGeometryAdapterConfigContractMetadata,
  referenceGeometryAdapterOutputValidationContractMetadata,
  referenceGeometryAdapterPreflightContractMetadata,
  referenceGeometryAdapterRequestContractMetadata,
  referenceGeometryCanonicalOutputContractMetadata,
  referenceGeometryTargetFormatCoverage,
  referenceSourceDescriptionContractMetadata,
  sourceFileMetadata,
  supportedReferenceGeometryFormatGroups,
  supportedReferenceGeometryFormats,
  translateReferenceGeometryFile,
  writeReferenceGeometryAdapterRequest
} from "./translate_reference_geometry.mjs";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../..");
const DEFAULT_REFERENCES_DIR = path.join(ROOT, "bobercad/data/references");
const PROJECT_SCHEMA = path.join(ROOT, "bobercad/app/schemas/project.schema.json");
const REFERENCE_GEOMETRY_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");
const POINT_CLOUD_CHUNK_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-point-cloud-chunk.schema.json");
const ADAPTER_REQUEST_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry-adapter-request.schema.json");
const ADAPTER_CONFIG_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry-adapters.schema.json");
const REFERENCE_GEOMETRY_SCHEMA_NAME = schemaNameFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_NAME = schemaNameFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA, "point-cloud chunk");
const ADAPTER_REQUEST_SCHEMA_NAME = schemaNameFromSchemaFile(ADAPTER_REQUEST_SCHEMA, "adapter request");
const ADAPTER_CONFIG_SCHEMA_NAME = schemaNameFromSchemaFile(ADAPTER_CONFIG_SCHEMA, "adapter config");
const REFERENCE_GEOMETRY_SCHEMA_VERSION = schemaVersionFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_VERSION = schemaVersionFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA, "point-cloud chunk");
const ADAPTER_REQUEST_SCHEMA_VERSION = schemaVersionFromSchemaFile(ADAPTER_REQUEST_SCHEMA, "adapter request");
const ADAPTER_CONFIG_SCHEMA_VERSION = schemaVersionFromSchemaFile(ADAPTER_CONFIG_SCHEMA, "adapter config");
const REFERENCE_IMPORT_CONTRACT_VERSION = "0.2.0";
const REFERENCE_AUDIT_CONTRACT_VERSION = "0.1.0";
const PROJECT_DISPLAY_FIELDS_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/display/properties";
const PROJECT_DISPLAY_ADDITIONAL_PROPERTIES_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/display/additionalProperties";
const PROJECT_REFERENCE_GEOMETRY_ASSET_ID_PATTERN_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/referenceGeometryAssetId/pattern";
const PROJECT_REFERENCE_GEOMETRY_ASSET_ID_RESERVED_KEYS_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/referenceGeometryAssetId/not/enum";
const PROJECT_REFERENCE_GEOMETRY_ASSET_REQUIRED_FIELDS_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/projectReferenceGeometryAsset/required";
const PROJECT_REFERENCE_GEOMETRY_ASSET_PROPERTIES_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/projectReferenceGeometryAsset/properties";
const PROJECT_REFERENCE_GEOMETRY_PATH_PATTERN_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/projectReferenceGeometryAsset/properties/path/pattern";
const PROJECT_REFERENCE_GEOMETRY_TRANSFORM_FIELDS_SOURCE = "bobercad/app/schemas/project.schema.json#/$defs/referenceGeometryTransform/properties";
const PROJECT_REFERENCE_DISPLAY_OVERRIDE_FIELDS = Object.freeze(["color", "edgeColor", "opacity", "pointSize"]);
const PROJECT_REFERENCE_DISPLAY_OVERRIDE_FIELDS_SOURCE = "project-reference-importer-supported-display-overrides";
const PROJECT_REFERENCE_TRANSFORM_DEFAULTS_SOURCE = "project-reference-importer-runtime-default-transform";
const PROJECT_REFERENCE_TRANSFORM_DEFAULTS_POLICY = "missing-fields-use-project-basis";
const PROJECT_REFERENCE_FORBIDDEN_GEOMETRY_PAYLOAD_FIELDS = Object.freeze([
  "$schema",
  "schema",
  "schemaVersion",
  "asset",
  "layers",
  "objects",
  "chunks",
  "vertices",
  "lineSegments",
  "faces",
  "points",
  "pointAttributes",
  "chunkIds",
  "bounds",
  "diagnostics",
  "metadata",
  "loadedChunks"
]);
const PROJECT_REFERENCE_FORBIDDEN_GEOMETRY_PAYLOAD_FIELDS_SOURCE = "project-reference-pointer-forbidden-canonical-geometry-fields";
const PROJECT_REFERENCE_FORBIDDEN_IMPORT_RUNTIME_FIELDS = Object.freeze([
  "adapterRequestPath",
  "adapterRequestFingerprint",
  "adapterRequestEvidenceFingerprint",
  "adapterConfigPath",
  "stageDir",
  "scratchDir",
  "chunkDir",
  "adapterLogPath",
  "adapterStdoutPath",
  "adapterStderrPath",
  "adapterOutputPath",
  "sourcePath",
  "outputPath",
  "targetReferenceManifestPath"
]);
const PROJECT_REFERENCE_FORBIDDEN_IMPORT_RUNTIME_FIELDS_SOURCE = "project-reference-pointer-forbidden-import-runtime-fields";
const REFERENCE_SOURCE_FORMAT_TOKENS = new Set(["dxf", "dwg", "step", "ifc", "e57", "e57pointcloud", "json", "unknown"]);
const REFERENCE_SOURCE_FILE_NAME_MAX_LENGTH = 255;
const REFERENCE_SOURCE_FILE_NAME_PATTERN = /^(?!\.{1,2}$)(?!\s)(?!.*\s$)[^\\/:?#\u0000-\u001f\u007f]{1,255}$/;
const REFERENCE_SOURCE_EXTENSION_PATTERN = /^$|^[a-z0-9][a-z0-9_-]*$/;
const REFERENCE_SOURCE_REQUESTED_FORMAT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const REFERENCE_SOURCE_STAT_FINGERPRINT_PATTERN = /^stat-sha256:[0-9a-f]{64}$/;
const REFERENCE_SOURCE_CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const REFERENCE_SOURCE_TRANSLATOR_BUILT_IN_ID = "tools/reference-geometry/translate_reference_geometry.mjs";
const REFERENCE_SOURCE_TRANSLATOR_MACHINE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const REFERENCE_SOURCE_TRANSLATOR_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const REFERENCE_SOURCE_RFC3339_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const REFERENCE_OBJECT_KIND_TOKENS = new Set(["line-set", "mesh", "point-cloud"]);
const REFERENCE_DIAGNOSTIC_SEVERITY_TOKENS = new Set(["info", "warning", "error"]);
const REFERENCE_DIAGNOSTIC_CODE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
const REFERENCE_DIAGNOSTIC_MESSAGE_MAX_LENGTH = 2048;
const REFERENCE_DISPLAY_NAME_MAX_LENGTH = 255;
const REFERENCE_DISPLAY_NAME_FORBIDDEN_PATTERNS = Object.freeze([
  /[\u0000-\u001f\u007f]/,
  /\\/,
  /^[/]/,
  /[A-Za-z][A-Za-z0-9+.-]*:\//,
  /(?:^|[\s"'(])\.{1,2}\//,
  /\/{2}/,
  /%(?:2[fF]|5[cC])/,
  /[A-Za-z0-9_-]\/[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8}/
]);
const REFERENCE_GEOMETRY_SCHEMA_NAME_SOURCE = "bobercad/app/schemas/reference-geometry.schema.json#/properties/schema/const";
const REFERENCE_GEOMETRY_SCHEMA_VERSION_SOURCE = "bobercad/app/schemas/reference-geometry.schema.json#/properties/schemaVersion/const";
const REFERENCE_GEOMETRY_ID_PATTERN_SOURCE = "bobercad/app/schemas/reference-geometry.schema.json#/$defs/id/pattern";
const REFERENCE_GEOMETRY_ID_RESERVED_KEYS_SOURCE = "bobercad/app/schemas/reference-geometry.schema.json#/$defs/id/not/enum";
const REFERENCE_ASSET_ENTRY_LIMIT = 20;
const REFERENCE_NEEDS_ATTENTION_ENTRY_LIMIT = 20;
const REFERENCE_CHUNK_MISSING_ENTRY_LIMIT = 20;
const REFERENCE_CHUNK_INVALID_ENTRY_LIMIT = 20;
const REFERENCE_CHUNK_FILE_ENTRY_LIMIT = 20;
const REFERENCE_AUDIT_ERROR_ENTRY_LIMIT = 5;
const REFERENCE_AUDIT_TOP_LEVEL_ERROR_ENTRY_LIMIT = 20;
const REFERENCE_SUMMARY_ENTRY_LIMIT = 20;
const REFERENCE_DIAGNOSTIC_ENTRY_LIMIT = 20;
const REFERENCE_INVALID_PROJECT_ASSET_ID_JSONPATH_TOKEN = "<invalid-reference-asset-id>";
const REFERENCE_INVALID_PROJECT_ASSET_FIELD_JSONPATH_TOKEN = "<invalid-reference-asset-field>";
const REFERENCE_INVALID_PROJECT_TRANSFORM_FIELD_JSONPATH_TOKEN = "<invalid-reference-transform-field>";
const REFERENCE_HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const REFERENCE_AUDIT_STATUS_DEFINITIONS = {
  ready: { rank: 0, severity: "ok" },
  unchecked: { rank: 10, severity: "warning" },
  "invalid-reference": { rank: 20, severity: "error" },
  "missing-chunks": { rank: 30, severity: "error" },
  "asset-id-mismatch": { rank: 40, severity: "error" },
  "unsupported-schema": { rank: 50, severity: "error" },
  "read-error": { rank: 60, severity: "error" },
  "missing-manifest": { rank: 70, severity: "error" },
  "outside-references-dir": { rank: 80, severity: "error" },
  "missing-path": { rank: 90, severity: "error" },
  "missing-asset": { rank: 95, severity: "error" }
};
const require = createRequire(import.meta.url);
const { validateFile, formatError } = require("../../scripts/validate_json_schema.js");
const { validateReferenceGeometry } = require("../../scripts/validate_domain_model.js");

function usage() {
  return [
    "Usage:",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --list-import-discovery",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --list-formats",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --list-format-groups",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --describe-source --input <source> [--format dxf]",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --adapter-config <adapters.json> --list-adapters",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --adapter-config <adapters.json> --check-adapters [--format dwg] [--adapter <name>]",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --project <project.json> --input <source> [--references-dir <dir>] [--asset-id <id>] [--format dxf] [--name \"Name\"]",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --project <project.json> --input <source.step> --format step --adapter-config <adapters.json>",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --project <project.json> --input <source.e57> --format e57 --adapter-config <adapters.json> --write-adapter-request <request.json>",
    "  node tools/reference-geometry/import_reference_geometry_asset.mjs --project <project.json> --check-references [--asset-id <id>] [--summary-only]",
    "  Add --point-cloud-chunk-size <positive-integer-count> to force inline point-cloud payloads into chunk sidecars above the given point count.",
    "  Add --adapter-timeout-ms <positive-integer-ms> to override the selected external adapter timeout for an import, dry-run, or generated adapter request; not valid with --plan-only.",
    "  Add --replace-existing to refresh an existing project.referenceGeometry.assets entry without changing its path, transform, or display defaults.",
    "  Add --plan-only to validate the project reference pointer candidate and report the target asset/path without running the translator or writing files.",
    "  Add --write-adapter-request <request.json> to write the adapter request for the planned project asset without running the translator, writing the project, or writing a reference manifest.",
    "  Add --dry-run to validate project pointer metadata and translator output without writing the project or target reference file.",
    "  Add --summary-only to --check-references to omit full per-asset summaries and print only the bounded audit index, needs-attention index, aggregate, bounded error summary, fingerprint, and errors.",
    "  Add --json to print import or dry-run results as machine-readable JSON.",
    "  Add --keep-stage while debugging external adapter runs to preserve translator staging files after success or failure; not valid with --plan-only or --write-adapter-request.",
    "  Add --keep-stage-on-error while debugging external adapter runs to preserve failed translator staging files; not valid with --plan-only or --write-adapter-request.",
    "  Use --units mm|m|in|ft, --origin x,y,z, --axis-x x,y,z, --axis-y x,y,z, --axis-z x,y,z, --scale, --visible, --snap-enabled, --opacity, --color, --edge-color, and --point-size to place and style the project reference asset.",
    "",
    "The importer writes canonical reference geometry JSON and updates project.referenceGeometry.assets with a path pointer only."
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

function schemaVersionFromSchemaFile(filePath, label) {
  const schemaVersion = readJson(filePath)?.properties?.schemaVersion?.const;
  if (typeof schemaVersion !== "string" || !schemaVersion) {
    throw new Error(`${label} schema is missing properties.schemaVersion.const`);
  }
  return schemaVersion;
}

function schemaNameFromSchemaFile(filePath, label) {
  const schemaName = readJson(filePath)?.properties?.schema?.const;
  if (typeof schemaName !== "string" || !schemaName) {
    throw new Error(`${label} schema is missing properties.schema.const`);
  }
  return schemaName;
}

function unknownOptionError(arg) {
  return cliOptionError(`Unknown argument: ${arg}`, "cli-option-unknown");
}

function optionCombinationError(message) {
  return cliOptionError(message, "cli-option-combination-invalid");
}

function referenceMetadataError(message, code) {
  const error = new Error(message);
  error.adapterErrorCode = code;
  return error;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--list-import-discovery") args.listImportDiscovery = true;
    else if (arg === "--list-formats") args.listFormats = true;
    else if (arg === "--list-format-groups") args.listFormatGroups = true;
    else if (arg === "--describe-source") args.describeSource = true;
    else if (arg === "--list-adapters") args.listAdapters = true;
    else if (arg === "--check-adapters") args.checkAdapters = true;
    else if (arg === "--check-references") args.checkReferences = true;
    else if (arg === "--summary-only") args.summaryOnly = true;
    else if (arg.startsWith("--summary-only=")) args.summaryOnly = optionEqualsValue(arg, "--summary-only=", "--summary-only");
    else if (arg === "--json") args.json = true;
    else if (arg === "--project" || arg === "-p") args.project = requiredOptionValue(argv, index++, "--project");
    else if (arg.startsWith("--project=")) args.project = optionEqualsValue(arg, "--project=", "--project");
    else if (arg === "--input" || arg === "-i") args.input = requiredOptionValue(argv, index++, "--input");
    else if (arg.startsWith("--input=")) args.input = optionEqualsValue(arg, "--input=", "--input");
    else if (arg === "--references-dir") args.referencesDir = requiredOptionValue(argv, index++, "--references-dir");
    else if (arg.startsWith("--references-dir=")) args.referencesDir = optionEqualsValue(arg, "--references-dir=", "--references-dir");
    else if (arg === "--asset-id") args.assetId = requiredOptionValue(argv, index++, "--asset-id");
    else if (arg.startsWith("--asset-id=")) args.assetId = optionEqualsValue(arg, "--asset-id=", "--asset-id");
    else if (arg === "--replace-existing") args.replaceExisting = true;
    else if (arg.startsWith("--replace-existing=")) args.replaceExisting = optionEqualsValue(arg, "--replace-existing=", "--replace-existing");
    else if (arg === "--plan-only") args.planOnly = true;
    else if (arg.startsWith("--plan-only=")) args.planOnly = optionEqualsValue(arg, "--plan-only=", "--plan-only");
    else if (arg === "--write-adapter-request") args.writeAdapterRequest = requiredOptionValue(argv, index++, "--write-adapter-request");
    else if (arg.startsWith("--write-adapter-request=")) args.writeAdapterRequest = optionEqualsValue(arg, "--write-adapter-request=", "--write-adapter-request");
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--dry-run=")) args.dryRun = optionEqualsValue(arg, "--dry-run=", "--dry-run");
    else if (arg === "--format" || arg === "-f") args.format = normalizedReferenceFormatToken(requiredOptionValue(argv, index++, "--format"));
    else if (arg.startsWith("--format=")) args.format = normalizedReferenceFormatToken(optionEqualsValue(arg, "--format=", "--format"));
    else if (arg === "--name") args.name = requiredOptionValue(argv, index++, "--name");
    else if (arg.startsWith("--name=")) args.name = optionEqualsValue(arg, "--name=", "--name");
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
    else if (arg === "--point-cloud-chunk-size") args.pointCloudChunkSize = Number(requiredOptionValue(argv, index++, "--point-cloud-chunk-size"));
    else if (arg.startsWith("--point-cloud-chunk-size=")) args.pointCloudChunkSize = Number(optionEqualsValue(arg, "--point-cloud-chunk-size=", "--point-cloud-chunk-size"));
    else if (arg === "--origin") args.origin = requiredOptionValue(argv, index++, "--origin");
    else if (arg.startsWith("--origin=")) args.origin = optionEqualsValue(arg, "--origin=", "--origin");
    else if (arg === "--axis-x") args.axisX = requiredOptionValue(argv, index++, "--axis-x");
    else if (arg.startsWith("--axis-x=")) args.axisX = optionEqualsValue(arg, "--axis-x=", "--axis-x");
    else if (arg === "--axis-y") args.axisY = requiredOptionValue(argv, index++, "--axis-y");
    else if (arg.startsWith("--axis-y=")) args.axisY = optionEqualsValue(arg, "--axis-y=", "--axis-y");
    else if (arg === "--axis-z") args.axisZ = requiredOptionValue(argv, index++, "--axis-z");
    else if (arg.startsWith("--axis-z=")) args.axisZ = optionEqualsValue(arg, "--axis-z=", "--axis-z");
    else if (arg === "--scale") args.scale = Number(requiredOptionValue(argv, index++, "--scale"));
    else if (arg.startsWith("--scale=")) args.scale = Number(optionEqualsValue(arg, "--scale=", "--scale"));
    else if (arg === "--visible") args.visible = requiredOptionValue(argv, index++, "--visible");
    else if (arg.startsWith("--visible=")) args.visible = optionEqualsValue(arg, "--visible=", "--visible");
    else if (arg === "--snap-enabled") args.snapEnabled = requiredOptionValue(argv, index++, "--snap-enabled");
    else if (arg.startsWith("--snap-enabled=")) args.snapEnabled = optionEqualsValue(arg, "--snap-enabled=", "--snap-enabled");
    else if (arg === "--opacity") args.opacity = Number(requiredOptionValue(argv, index++, "--opacity"));
    else if (arg.startsWith("--opacity=")) args.opacity = Number(optionEqualsValue(arg, "--opacity=", "--opacity"));
    else if (arg === "--color") args.color = requiredOptionValue(argv, index++, "--color");
    else if (arg.startsWith("--color=")) args.color = optionEqualsValue(arg, "--color=", "--color");
    else if (arg === "--edge-color") args.edgeColor = requiredOptionValue(argv, index++, "--edge-color");
    else if (arg.startsWith("--edge-color=")) args.edgeColor = optionEqualsValue(arg, "--edge-color=", "--edge-color");
    else if (arg === "--point-size") args.pointSize = Number(requiredOptionValue(argv, index++, "--point-size"));
    else if (arg.startsWith("--point-size=")) args.pointSize = Number(optionEqualsValue(arg, "--point-size=", "--point-size"));
    else throw unknownOptionError(arg);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

let cachedProjectSchema = null;
function projectSchema() {
  if (cachedProjectSchema !== null) {
    return cachedProjectSchema;
  }
  cachedProjectSchema = readJson(PROJECT_SCHEMA);
  return cachedProjectSchema;
}

let cachedProjectReferenceGeometryAssetIdPattern = null;
function projectReferenceGeometryAssetIdPattern() {
  if (cachedProjectReferenceGeometryAssetIdPattern !== null) {
    return cachedProjectReferenceGeometryAssetIdPattern;
  }
  const pattern = projectSchema()?.$defs?.referenceGeometryAssetId?.pattern;
  if (typeof pattern !== "string" || !pattern) {
    throw new Error(`project schema is missing ${PROJECT_REFERENCE_GEOMETRY_ASSET_ID_PATTERN_SOURCE}`);
  }
  cachedProjectReferenceGeometryAssetIdPattern = pattern;
  return cachedProjectReferenceGeometryAssetIdPattern;
}

let cachedProjectReferenceGeometryAssetIdReservedKeys = null;
function projectReferenceGeometryAssetIdReservedKeys() {
  if (cachedProjectReferenceGeometryAssetIdReservedKeys !== null) {
    return cachedProjectReferenceGeometryAssetIdReservedKeys;
  }
  const reservedKeys = projectSchema()?.$defs?.referenceGeometryAssetId?.not?.enum;
  if (!Array.isArray(reservedKeys) || reservedKeys.some((key) => typeof key !== "string" || !key)) {
    throw new Error(`project schema is missing ${PROJECT_REFERENCE_GEOMETRY_ASSET_ID_RESERVED_KEYS_SOURCE}`);
  }
  cachedProjectReferenceGeometryAssetIdReservedKeys = reservedKeys.slice();
  return cachedProjectReferenceGeometryAssetIdReservedKeys;
}

function nonEmptyStringArray(value, source) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error(`project schema is missing ${source}`);
  }
  return value.slice();
}

function schemaObjectPropertyKeys(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`project schema is missing ${source}`);
  }
  return Object.keys(value);
}

let cachedProjectDisplaySchemaFields = null;
function projectDisplaySchemaFields() {
  if (cachedProjectDisplaySchemaFields !== null) {
    return cachedProjectDisplaySchemaFields;
  }
  cachedProjectDisplaySchemaFields = schemaObjectPropertyKeys(
    projectSchema()?.$defs?.display?.properties,
    PROJECT_DISPLAY_FIELDS_SOURCE
  );
  return cachedProjectDisplaySchemaFields;
}

let cachedProjectDisplaySchemaAllowsAdditionalProperties = null;
function projectDisplaySchemaAllowsAdditionalProperties() {
  if (cachedProjectDisplaySchemaAllowsAdditionalProperties !== null) {
    return cachedProjectDisplaySchemaAllowsAdditionalProperties;
  }
  const allowsAdditionalProperties = projectSchema()?.$defs?.display?.additionalProperties;
  if (typeof allowsAdditionalProperties !== "boolean") {
    throw new Error(`project schema is missing ${PROJECT_DISPLAY_ADDITIONAL_PROPERTIES_SOURCE}`);
  }
  cachedProjectDisplaySchemaAllowsAdditionalProperties = allowsAdditionalProperties;
  return cachedProjectDisplaySchemaAllowsAdditionalProperties;
}

let cachedProjectReferenceGeometryAssetRequiredFields = null;
function projectReferenceGeometryAssetRequiredFields() {
  if (cachedProjectReferenceGeometryAssetRequiredFields !== null) {
    return cachedProjectReferenceGeometryAssetRequiredFields;
  }
  cachedProjectReferenceGeometryAssetRequiredFields = nonEmptyStringArray(
    projectSchema()?.$defs?.projectReferenceGeometryAsset?.required,
    PROJECT_REFERENCE_GEOMETRY_ASSET_REQUIRED_FIELDS_SOURCE
  );
  return cachedProjectReferenceGeometryAssetRequiredFields;
}

let cachedProjectReferenceGeometryAssetOptionalFields = null;
function projectReferenceGeometryAssetOptionalFields() {
  if (cachedProjectReferenceGeometryAssetOptionalFields !== null) {
    return cachedProjectReferenceGeometryAssetOptionalFields;
  }
  const requiredFields = new Set(projectReferenceGeometryAssetRequiredFields());
  cachedProjectReferenceGeometryAssetOptionalFields = schemaObjectPropertyKeys(
    projectSchema()?.$defs?.projectReferenceGeometryAsset?.properties,
    PROJECT_REFERENCE_GEOMETRY_ASSET_PROPERTIES_SOURCE
  ).filter((field) => !requiredFields.has(field));
  return cachedProjectReferenceGeometryAssetOptionalFields;
}

let cachedProjectReferenceGeometryAssetFields = null;
function projectReferenceGeometryAssetFields() {
  if (cachedProjectReferenceGeometryAssetFields !== null) {
    return cachedProjectReferenceGeometryAssetFields;
  }
  cachedProjectReferenceGeometryAssetFields = [
    ...projectReferenceGeometryAssetRequiredFields(),
    ...projectReferenceGeometryAssetOptionalFields()
  ];
  return cachedProjectReferenceGeometryAssetFields;
}

let cachedProjectReferenceGeometryPathPattern = null;
function projectReferenceGeometryPathPattern() {
  if (cachedProjectReferenceGeometryPathPattern !== null) {
    return cachedProjectReferenceGeometryPathPattern;
  }
  const pattern = projectSchema()?.$defs?.projectReferenceGeometryAsset?.properties?.path?.pattern;
  if (typeof pattern !== "string" || !pattern) {
    throw new Error(`project schema is missing ${PROJECT_REFERENCE_GEOMETRY_PATH_PATTERN_SOURCE}`);
  }
  cachedProjectReferenceGeometryPathPattern = pattern;
  return cachedProjectReferenceGeometryPathPattern;
}

let cachedProjectReferenceGeometryTransformFields = null;
function projectReferenceGeometryTransformFields() {
  if (cachedProjectReferenceGeometryTransformFields !== null) {
    return cachedProjectReferenceGeometryTransformFields;
  }
  cachedProjectReferenceGeometryTransformFields = schemaObjectPropertyKeys(
    projectSchema()?.$defs?.referenceGeometryTransform?.properties,
    PROJECT_REFERENCE_GEOMETRY_TRANSFORM_FIELDS_SOURCE
  );
  return cachedProjectReferenceGeometryTransformFields;
}

let cachedReferenceGeometrySchema = null;
function referenceGeometrySchema() {
  if (cachedReferenceGeometrySchema !== null) {
    return cachedReferenceGeometrySchema;
  }
  cachedReferenceGeometrySchema = readJson(REFERENCE_GEOMETRY_SCHEMA);
  return cachedReferenceGeometrySchema;
}

let cachedReferenceGeometrySchemaName = null;
function referenceGeometrySchemaName() {
  if (cachedReferenceGeometrySchemaName !== null) {
    return cachedReferenceGeometrySchemaName;
  }
  const schemaName = referenceGeometrySchema()?.properties?.schema?.const;
  if (typeof schemaName !== "string" || !schemaName) {
    throw new Error(`reference geometry schema is missing ${REFERENCE_GEOMETRY_SCHEMA_NAME_SOURCE}`);
  }
  cachedReferenceGeometrySchemaName = schemaName;
  return cachedReferenceGeometrySchemaName;
}

let cachedReferenceGeometrySchemaVersionFromSchema = null;
function referenceGeometrySchemaVersionFromSchema() {
  if (cachedReferenceGeometrySchemaVersionFromSchema !== null) {
    return cachedReferenceGeometrySchemaVersionFromSchema;
  }
  const schemaVersion = referenceGeometrySchema()?.properties?.schemaVersion?.const;
  if (typeof schemaVersion !== "string" || !schemaVersion) {
    throw new Error(`reference geometry schema is missing ${REFERENCE_GEOMETRY_SCHEMA_VERSION_SOURCE}`);
  }
  cachedReferenceGeometrySchemaVersionFromSchema = schemaVersion;
  return cachedReferenceGeometrySchemaVersionFromSchema;
}

let cachedReferenceGeometryIdPattern = null;
function referenceGeometryIdPattern() {
  if (cachedReferenceGeometryIdPattern !== null) {
    return cachedReferenceGeometryIdPattern;
  }
  const pattern = referenceGeometrySchema()?.$defs?.id?.pattern;
  if (typeof pattern !== "string" || !pattern) {
    throw new Error(`reference geometry schema is missing ${REFERENCE_GEOMETRY_ID_PATTERN_SOURCE}`);
  }
  cachedReferenceGeometryIdPattern = pattern;
  return cachedReferenceGeometryIdPattern;
}

let cachedReferenceGeometryIdPatternRegex = null;
function referenceGeometryIdPatternRegex() {
  if (cachedReferenceGeometryIdPatternRegex !== null) {
    return cachedReferenceGeometryIdPatternRegex;
  }
  cachedReferenceGeometryIdPatternRegex = new RegExp(referenceGeometryIdPattern());
  return cachedReferenceGeometryIdPatternRegex;
}

let cachedReferenceGeometryIdReservedKeys = null;
function referenceGeometryIdReservedKeys() {
  if (cachedReferenceGeometryIdReservedKeys !== null) {
    return cachedReferenceGeometryIdReservedKeys;
  }
  const reservedKeys = referenceGeometrySchema()?.$defs?.id?.not?.enum;
  if (!Array.isArray(reservedKeys) || reservedKeys.some((key) => typeof key !== "string" || !key)) {
    throw new Error(`reference geometry schema is missing ${REFERENCE_GEOMETRY_ID_RESERVED_KEYS_SOURCE}`);
  }
  cachedReferenceGeometryIdReservedKeys = reservedKeys.slice();
  return cachedReferenceGeometryIdReservedKeys;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function tempJsonPath(targetPath, label) {
  const absoluteTarget = path.resolve(targetPath);
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(absoluteTarget), `.${path.basename(absoluteTarget)}.${label}.${suffix}.tmp.json`);
}

function validationMessages(result) {
  return result.errors.map((error) => formatError(result, error));
}

function assertProjectSchemaValid(projectPath, project) {
  const tempPath = tempJsonPath(projectPath, "validate");
  try {
    writeJson(tempPath, project);
    const result = validateFile(tempPath);
    if (result.errors.length) throw new Error(validationMessages(result).join("\n"));
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function writeProjectAtomically(projectPath, project) {
  const absoluteProjectPath = path.resolve(projectPath);
  const tempPath = tempJsonPath(absoluteProjectPath, "write");
  try {
    writeJson(tempPath, project);
    const result = validateFile(tempPath);
    if (result.errors.length) throw new Error(validationMessages(result).join("\n"));
    fs.renameSync(tempPath, absoluteProjectPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeReferenceSourceFileName(value) {
  return typeof value === "string"
    && value.length <= REFERENCE_SOURCE_FILE_NAME_MAX_LENGTH
    && REFERENCE_SOURCE_FILE_NAME_PATTERN.test(value);
}

function safeReferenceSourceModifiedTime(value) {
  const match = typeof value === "string" ? REFERENCE_SOURCE_RFC3339_DATE_TIME_PATTERN.exec(value) : null;
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12) return false;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDay) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== "Z" && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false;
  return true;
}

function safeReferenceSourceTranslator(value) {
  if (typeof value !== "string" || !value) return false;
  if (value === REFERENCE_SOURCE_TRANSLATOR_BUILT_IN_ID) return true;
  if (REFERENCE_SOURCE_TRANSLATOR_MACHINE_TOKEN_PATTERN.test(value)) return true;
  if (!value.startsWith("external:")) return false;
  const adapterId = value.slice("external:".length);
  return referenceGeometryIdPatternRegex().test(adapterId) && !referenceGeometryIdReservedKeys().includes(adapterId);
}

function safeReferenceSourceValue(value, predicate) {
  return typeof value === "string" && predicate(value) ? value : null;
}

function safeReferenceId(value) {
  return typeof value === "string"
    && referenceGeometryIdPatternRegex().test(value)
    && !referenceGeometryIdReservedKeys().includes(value);
}

function safeReferenceIdValue(value) {
  return safeReferenceId(value) ? value : null;
}

function safeReferenceDisplayName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= REFERENCE_DISPLAY_NAME_MAX_LENGTH
    && value.trim() === value
    && REFERENCE_DISPLAY_NAME_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

function safeReferenceDiagnosticMessage(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= REFERENCE_DIAGNOSTIC_MESSAGE_MAX_LENGTH
    && REFERENCE_DISPLAY_NAME_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

function referenceSourceFormatGroup(sourceFormat) {
  if (!sourceFormat || !REFERENCE_SOURCE_FORMAT_TOKENS.has(sourceFormat) || sourceFormat === "unknown") return null;
  const formats = supportedReferenceGeometryFormats();
  const sourceFamily = formats[sourceFormat]?.canonicalFormat || sourceFormat;
  return supportedReferenceGeometryFormatGroups()[sourceFamily] || null;
}

function safeReferenceSourceFileExtensionForFormat(sourceFormat, value) {
  return safeReferenceSourceValue(value, (extension) => {
    if (!REFERENCE_SOURCE_EXTENSION_PATTERN.test(extension)) return false;
    if (extension === "") return true;
    if (sourceFormat === "unknown") return true;
    const group = referenceSourceFormatGroup(sourceFormat);
    return Array.isArray(group?.fileExtensions) && group.fileExtensions.includes(extension);
  });
}

function safeReferenceSourceRequestedFormatForFormat(sourceFormat, value) {
  return safeReferenceSourceValue(value, (requestedFormat) => {
    if (!REFERENCE_SOURCE_REQUESTED_FORMAT_PATTERN.test(requestedFormat)) return false;
    const group = referenceSourceFormatGroup(sourceFormat);
    return Array.isArray(group?.formatTokens) && group.formatTokens.includes(requestedFormat);
  });
}

const POINT_ATTRIBUTE_KEYS = Object.freeze(["colors", "intensities", "classifications", "normals"]);

function sanitizeId(value, fallback = "reference_geometry") {
  const id = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return id || fallback;
}

function projectRelativePath(fromProjectPath, targetPath) {
  return path.relative(path.dirname(path.resolve(fromProjectPath)), path.resolve(targetPath)).replaceAll(path.sep, "/");
}

function repoRelativePath(targetPath) {
  return path.relative(ROOT, path.resolve(targetPath)).replaceAll(path.sep, "/");
}

function isSubpath(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function referenceSidecarPath(manifestPath, relativePath) {
  if (!safeReferenceSidecarPathValue(relativePath)) return null;
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const resolved = path.resolve(manifestDir, relativePath);
  return isSubpath(manifestDir, resolved) ? resolved : null;
}

function projectReferenceManifestPath(projectPath, assetPath, referencesDir = DEFAULT_REFERENCES_DIR) {
  if (typeof assetPath !== "string" || !assetPath) return null;
  const resolved = path.resolve(path.dirname(projectPath), assetPath);
  return isSubpath(path.resolve(referencesDir), resolved) ? resolved : null;
}

function referenceFileMetadata(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      referenceFileSizeBytes: null,
      referenceFileModifiedTime: null,
      referenceManifestFingerprint: null
    };
  }
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

function nullReferenceTranslatedOutputMetadata() {
  return {
    referenceTranslatedManifestFingerprint: null,
    referenceTranslatedArtifactFingerprint: null
  };
}

function referenceTranslatedOutputMetadata(manifestPath, reference) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return nullReferenceTranslatedOutputMetadata();
  const manifestFingerprint = referenceManifestFingerprint(manifestPath);
  const chunkMetadata = referenceChunkFileMetadata(manifestPath, reference);
  return {
    referenceTranslatedManifestFingerprint: manifestFingerprint,
    referenceTranslatedArtifactFingerprint: chunkMetadata.referenceArtifactFingerprint
  };
}

function publicStatFingerprint(kind, publicIdentity, fileSizeBytes, fileModifiedTime) {
  const text = [
    kind || "",
    publicIdentity || "",
    Number.isInteger(fileSizeBytes) ? String(fileSizeBytes) : "",
    fileModifiedTime || ""
  ].join("\0");
  return `stat-sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

function adapterConfigStatFingerprint(fileSizeBytes, fileModifiedTime) {
  return publicStatFingerprint("adapter-config", "json", fileSizeBytes, fileModifiedTime);
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

function nullReferenceChunkFileMetadata() {
  return {
    referenceChunkFileCount: null,
    referenceChunkFileSizeBytes: null,
    referenceChunkFileModifiedTimeLatest: null,
    referenceChunkFileMissingCount: null,
    referenceChunkFileMissingEntries: null,
    referenceChunkFileMissingOmittedCount: null,
    referenceChunkFileInvalidCount: null,
    referenceChunkFileInvalidEntries: null,
    referenceChunkFileInvalidOmittedCount: null,
    referenceChunkPointCount: null,
    referenceChunkFileEntries: null,
    referenceChunkFileOmittedCount: null,
    referenceChunkFileSetFingerprint: null,
    referenceArtifactFingerprint: null
  };
}

function noteMissingReferenceChunk(summary, chunk, reason) {
  summary.referenceChunkFileMissingCount += 1;
  if (summary.referenceChunkFileMissingEntries.length < REFERENCE_CHUNK_MISSING_ENTRY_LIMIT) {
    summary.referenceChunkFileMissingEntries.push({
      chunkId: safeReferenceIdValue(chunk?.id),
      path: typeof chunk?.path === "string" ? chunk.path : null,
      reason
    });
  }
}

function noteInvalidReferenceChunk(summary, chunk, reason, message = "") {
  summary.referenceChunkFileInvalidCount += 1;
  if (summary.referenceChunkFileInvalidEntries.length < REFERENCE_CHUNK_INVALID_ENTRY_LIMIT) {
    summary.referenceChunkFileInvalidEntries.push({
      chunkId: safeReferenceIdValue(chunk?.id),
      path: typeof chunk?.path === "string" ? chunk.path : null,
      reason,
      message: safeReferenceDiagnosticMessage(message)
        ? boundedText(message, 320)
        : referenceChunkInvalidClassMessage({ reason })
    });
  }
}

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function sameReferenceBounds(left, right) {
  return finiteVec3(left?.min)
    && finiteVec3(left?.max)
    && finiteVec3(right?.min)
    && finiteVec3(right?.max)
    && left.min.every((value, index) => Math.abs(value - right.min[index]) <= 1e-9)
    && left.max.every((value, index) => Math.abs(value - right.max[index]) <= 1e-9);
}

function referencePointPayloadBounds(points) {
  if (!Array.isArray(points) || !points.length) return null;
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const point of points) {
    if (!finiteVec3(point)) return null;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
    }
  }
  return bounds;
}

function referencePointAttributeLengthIssue(pointAttributes, pointCount, context) {
  if (pointAttributes === undefined) return null;
  if (!isRecord(pointAttributes)) {
    return {
      reason: "point-attribute-length-mismatch",
      message: `${context}.pointAttributes must be an object`
    };
  }
  for (const key of POINT_ATTRIBUTE_KEYS) {
    const values = pointAttributes[key];
    if (!Array.isArray(values)) continue;
    if (values.length !== pointCount) {
      return {
        reason: "point-attribute-length-mismatch",
        message: `${context}.pointAttributes.${key} has ${values.length} item(s), expected ${pointCount}`
      };
    }
  }
  return null;
}

function referenceChunkSidecarValidationIssue(chunk, chunkPath) {
  let chunkData;
  try {
    chunkData = readJson(chunkPath);
  } catch {
    return {
      reason: "invalid-json",
      message: "point-cloud chunk JSON parse failed"
    };
  }
  let schemaResult;
  try {
    schemaResult = validateFile(chunkPath);
  } catch {
    return {
      reason: "schema-check-error",
      message: "point-cloud chunk schema check failed"
    };
  }
  if (schemaResult.errors.length) {
    return {
      reason: "schema-invalid",
      message: "point-cloud chunk schema is invalid"
    };
  }
  if (chunkData.id !== chunk.id) {
    return {
      reason: "id-mismatch",
      message: `sidecar id ${chunkData.id || "<missing>"} must match manifest chunk ${chunk.id || "<missing>"}`
    };
  }
  if (chunkData.objectId !== chunk.objectId) {
    return {
      reason: "object-id-mismatch",
      message: `sidecar objectId ${chunkData.objectId || "<missing>"} must match manifest objectId ${chunk.objectId || "<missing>"}`
    };
  }
  const sidecarPointCount = Array.isArray(chunkData.points) ? chunkData.points.length : chunkData.pointCount;
  if (Number.isInteger(chunk.pointCount) && Number.isInteger(sidecarPointCount) && chunk.pointCount !== sidecarPointCount) {
    return {
      reason: "point-count-mismatch",
      message: `manifest pointCount ${chunk.pointCount} must match sidecar point count ${sidecarPointCount}`
    };
  }
  if (Number.isInteger(sidecarPointCount)) {
    const attributeIssue = referencePointAttributeLengthIssue(chunkData.pointAttributes, sidecarPointCount, `chunk ${chunk.id || "<missing>"}`);
    if (attributeIssue) return attributeIssue;
  }
  if (chunk.bounds && chunkData.bounds && !sameReferenceBounds(chunk.bounds, chunkData.bounds)) {
    return {
      reason: "bounds-manifest-mismatch",
      message: `manifest chunk ${chunk.id || "<missing>"}.bounds must match sidecar bounds`
    };
  }
  if (Array.isArray(chunkData.points) && chunkData.bounds) {
    const payloadBounds = referencePointPayloadBounds(chunkData.points);
    if (payloadBounds && !sameReferenceBounds(chunkData.bounds, payloadBounds)) {
      return {
        reason: "bounds-payload-mismatch",
        message: `chunk ${chunk.id || "<missing>"}.bounds must match point payload bounds`
      };
    }
  }
  return null;
}

function referenceChunkFileMetadata(manifestPath, reference) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return nullReferenceChunkFileMetadata();
  const chunks = Array.isArray(reference?.chunks) ? reference.chunks : [];
  const summary = {
    referenceChunkFileCount: 0,
    referenceChunkFileSizeBytes: 0,
    referenceChunkFileModifiedTimeLatest: null,
    referenceChunkFileMissingCount: 0,
    referenceChunkFileMissingEntries: [],
    referenceChunkFileMissingOmittedCount: 0,
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
    if (Number.isInteger(chunk?.pointCount)) summary.referenceChunkPointCount += chunk.pointCount;
    const chunkPath = typeof chunk?.path === "string" ? referenceSidecarPath(manifestPath, chunk.path) : null;
    if (!chunkPath) {
      noteMissingReferenceChunk(summary, chunk, "unsafe-or-invalid-path");
      continue;
    }
    if (!fs.existsSync(chunkPath)) {
      noteMissingReferenceChunk(summary, chunk, "missing-file");
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(chunkPath);
    } catch {
      noteMissingReferenceChunk(summary, chunk, "stat-error");
      continue;
    }
    if (!stat.isFile()) {
      noteMissingReferenceChunk(summary, chunk, "not-file");
      continue;
    }
    const fileModifiedTime = stat.mtime.toISOString();
    const validationIssue = referenceChunkSidecarValidationIssue(chunk, chunkPath);
    if (validationIssue) {
      noteInvalidReferenceChunk(summary, chunk, validationIssue.reason, validationIssue.message);
    }
    summary.referenceChunkFileCount += 1;
    summary.referenceChunkFileSizeBytes += stat.size;
    chunkFileEntries.push({
      chunkId: safeReferenceIdValue(chunk?.id),
      path: typeof chunk?.path === "string" ? chunk.path : null,
      pointCount: Number.isInteger(chunk?.pointCount) ? chunk.pointCount : null,
      fileSizeBytes: stat.size,
      fileModifiedTime
    });
    if (stat.mtimeMs > latestMtimeMs) {
      latestMtimeMs = stat.mtimeMs;
      summary.referenceChunkFileModifiedTimeLatest = fileModifiedTime;
    }
  }
  summary.referenceChunkFileMissingOmittedCount = Math.max(0, summary.referenceChunkFileMissingCount - summary.referenceChunkFileMissingEntries.length);
  summary.referenceChunkFileInvalidOmittedCount = Math.max(0, summary.referenceChunkFileInvalidCount - summary.referenceChunkFileInvalidEntries.length);
  summary.referenceChunkFileEntries = chunkFileEntries.slice(0, REFERENCE_CHUNK_FILE_ENTRY_LIMIT);
  summary.referenceChunkFileOmittedCount = Math.max(0, chunkFileEntries.length - summary.referenceChunkFileEntries.length);
  summary.referenceChunkFileSetFingerprint = referenceChunkFileSetFingerprint(chunkFileEntries);
  if (summary.referenceChunkFileMissingCount === 0 && summary.referenceChunkFileInvalidCount === 0) {
    summary.referenceArtifactFingerprint = referenceArtifactFingerprint(referenceManifestFingerprint(manifestPath), summary.referenceChunkFileSetFingerprint);
  }
  return summary;
}

function referencePointCloudPointCount(reference) {
  const chunksById = new Map((reference?.chunks || []).map((chunk) => [chunk?.id, chunk]));
  let pointCount = 0;
  for (const object of Object.values(reference?.objects || {})) {
    if (object?.kind !== "point-cloud") continue;
    if (Array.isArray(object.points)) pointCount += object.points.length;
    for (const chunkId of object.chunkIds || []) {
      const chunk = chunksById.get(chunkId);
      if (Number.isInteger(chunk?.pointCount)) pointCount += chunk.pointCount;
    }
  }
  return pointCount;
}

function referencePrimitiveCounts(reference) {
  const counts = {
    referenceLineSegmentCount: 0,
    referenceMeshFaceCount: 0
  };
  for (const object of Object.values(reference?.objects || {})) {
    if (object?.kind === "line-set" && Array.isArray(object.lineSegments)) {
      counts.referenceLineSegmentCount += object.lineSegments.length;
    } else if (object?.kind === "mesh" && Array.isArray(object.faces)) {
      counts.referenceMeshFaceCount += object.faces.length;
    }
  }
  return counts;
}

function referenceAssetMetadata(reference) {
  const coordinateSystem = reference?.asset?.coordinateSystem || null;
  return {
    referenceUnits: reference?.asset?.units || null,
    referenceBoundsMin: Array.isArray(reference?.asset?.bounds?.min) ? reference.asset.bounds.min : null,
    referenceBoundsMax: Array.isArray(reference?.asset?.bounds?.max) ? reference.asset.bounds.max : null,
    referenceCoordinateSystem: coordinateSystem,
    referenceCoordinateSystemOrigin: Array.isArray(coordinateSystem?.origin) ? coordinateSystem.origin : null,
    referenceCoordinateSystemAxisX: Array.isArray(coordinateSystem?.axisX) ? coordinateSystem.axisX : null,
    referenceCoordinateSystemAxisY: Array.isArray(coordinateSystem?.axisY) ? coordinateSystem.axisY : null,
    referenceCoordinateSystemAxisZ: Array.isArray(coordinateSystem?.axisZ) ? coordinateSystem.axisZ : null
  };
}

function referenceSchemaMetadata(reference) {
  return {
    schema: reference?.schema || null,
    schemaVersion: reference?.schemaVersion || null,
    referenceSchema: reference?.schema || null,
    referenceSchemaVersion: reference?.schemaVersion || null
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
    id: safeReferenceIdValue(object?.id),
    kind: typeof object?.kind === "string" && REFERENCE_OBJECT_KIND_TOKENS.has(object.kind) ? object.kind : null,
    name: safeReferenceDisplayName(object?.name) ? object.name : null,
    layer: safeReferenceIdValue(object?.layer),
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
    const layerId = safeReferenceIdValue(object?.layer);
    if (!layerId) continue;
    counts.set(layerId, (counts.get(layerId) || 0) + 1);
  }
  return counts;
}

function referenceLayerSummaryEntry(layer = {}, objectCounts = new Map()) {
  const display = isRecord(layer?.display) ? layer.display : null;
  const id = safeReferenceIdValue(layer?.id);
  return {
    id,
    name: safeReferenceDisplayName(layer?.name) ? layer.name : null,
    objectCount: id ? objectCounts.get(id) || 0 : 0,
    displayVisible: typeof display?.visible === "boolean" ? display.visible : null,
    displayColor: typeof display?.color === "string" ? display.color : null,
    displayEdgeColor: typeof display?.edgeColor === "string" ? display.edgeColor : null,
    displayOpacity: Number.isFinite(display?.opacity) ? display.opacity : null,
    displayPointSize: Number.isFinite(display?.pointSize) ? display.pointSize : null
  };
}

function referenceStructureSummary(reference) {
  const objectKindCounts = referenceObjectKindCounts(reference);
  const objects = reference?.objects || {};
  const layers = reference?.layers || {};
  const chunks = Array.isArray(reference?.chunks) ? reference.chunks : [];
  const chunksById = new Map(chunks.map((chunk) => [chunk?.id, chunk]));
  const objectIds = Object.keys(objects);
  const layerIds = Object.keys(layers);
  const chunkIds = chunks.map((chunk) => chunk?.id).filter((id) => typeof id === "string" && id);
  const objectCount = objectIds.length;
  const layerCount = layerIds.length;
  const chunkCount = chunkIds.length;
  const layerObjectCounts = referenceLayerObjectCounts(objects);
  const boundedObjectIds = boundedEntries(objectIds.filter(safeReferenceId), REFERENCE_SUMMARY_ENTRY_LIMIT);
  const boundedLayerIds = boundedEntries(layerIds.filter(safeReferenceId), REFERENCE_SUMMARY_ENTRY_LIMIT);
  const boundedChunkIds = boundedEntries(chunkIds.filter(safeReferenceId), REFERENCE_SUMMARY_ENTRY_LIMIT);
  const boundedObjectEntries = boundedEntries(
    Object.values(objects).map((object) => referenceObjectSummaryEntry(object, chunksById)),
    REFERENCE_SUMMARY_ENTRY_LIMIT
  );
  const boundedLayerEntries = boundedEntries(
    Object.values(layers).map((layer) => referenceLayerSummaryEntry(layer, layerObjectCounts)),
    REFERENCE_SUMMARY_ENTRY_LIMIT
  );
  return {
    objectCount,
    layerCount,
    chunkCount,
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

function projectReferenceAssetPointerMetadata(asset) {
  const display = safeProjectReferenceDisplay(asset?.display);
  const transform = safeProjectReferenceTransform(asset?.transform);
  const visible = safeProjectReferenceBoolean(asset?.visible);
  const snapEnabled = safeProjectReferenceBoolean(asset?.snapEnabled);
  return {
    visible,
    snapEnabled,
    projectReferenceVisible: visible,
    projectReferenceSnapEnabled: snapEnabled,
    projectReferenceDisplay: display,
    projectReferenceDisplayColor: typeof display?.color === "string" ? display.color : null,
    projectReferenceDisplayEdgeColor: typeof display?.edgeColor === "string" ? display.edgeColor : null,
    projectReferenceDisplayOpacity: Number.isFinite(display?.opacity) ? display.opacity : null,
    projectReferenceDisplayPointSize: Number.isFinite(display?.pointSize) ? display.pointSize : null,
    projectReferenceTransform: transform,
    projectReferenceTransformOrigin: Array.isArray(transform?.origin) ? transform.origin : null,
    projectReferenceTransformAxisX: Array.isArray(transform?.axisX) ? transform.axisX : null,
    projectReferenceTransformAxisY: Array.isArray(transform?.axisY) ? transform.axisY : null,
    projectReferenceTransformAxisZ: Array.isArray(transform?.axisZ) ? transform.axisZ : null,
    projectReferenceTransformScale: Number.isFinite(transform?.scale) ? transform.scale : null
  };
}

function safeProjectReferenceBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function safeProjectReferenceDisplay(display) {
  if (!isRecord(display)) return null;
  const result = {};
  for (const [key, value] of Object.entries(display)) {
    if ((key === "color" || key === "edgeColor") && typeof value === "string" && REFERENCE_HEX_COLOR_PATTERN.test(value)) {
      result[key] = value;
    } else if (key === "opacity" && Number.isFinite(value) && value >= 0 && value <= 1) {
      result.opacity = value;
    } else if (key === "pointSize" && Number.isFinite(value) && value > 0) {
      result.pointSize = value;
    }
  }
  return Object.keys(result).length ? result : null;
}

function safeProjectReferenceTransformVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? value : null;
}

function safeProjectReferenceTransform(transform) {
  if (!isRecord(transform)) return null;
  const result = {};
  const origin = safeProjectReferenceTransformVector(transform.origin);
  const axisX = safeProjectReferenceTransformVector(transform.axisX);
  const axisY = safeProjectReferenceTransformVector(transform.axisY);
  const axisZ = safeProjectReferenceTransformVector(transform.axisZ);
  if (origin) result.origin = origin;
  if (axisX) result.axisX = axisX;
  if (axisY) result.axisY = axisY;
  if (axisZ) result.axisZ = axisZ;
  if (Number.isFinite(transform.scale) && transform.scale > 0) result.scale = transform.scale;
  return Object.keys(result).length ? result : null;
}

function referenceImportOptionMetadata({ name, units = null, pointCloudChunkSize = undefined, assetId = null } = {}) {
  const effectiveName = normalizedExplicitReferenceName(name);
  return {
    referenceImportName: effectiveName || assetId || null,
    referenceImportUnitsOverride: normalizedExplicitReferenceUnits(units),
    referenceImportPointCloudChunkSize: normalizedPointCloudChunkSize(pointCloudChunkSize)
  };
}

function referenceImportExecutionMode({ planOnly = false, adapterRequestOnly = false, dryRun = false } = {}) {
  if (planOnly) return "plan-only";
  if (adapterRequestOnly) return "adapter-request";
  if (dryRun) return "dry-run";
  return "import";
}

function referenceImportSideEffectPlan(mode, { translationMode = null } = {}) {
  if (mode === "source-discovery") {
    return {
      validatesProjectPointer: false,
      preflightsAdapter: false,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesAdapterRequest: false,
      preparesAdapterStageDirectories: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false,
      writesTemporaryReferenceManifest: false
    };
  }
  const runsTranslator = mode === "dry-run" || mode === "import";
  return {
    validatesProjectPointer: true,
    preflightsAdapter: mode === "plan-only" && translationMode === "external-adapter",
    runsTranslator,
    mayLaunchExternalAdapter: runsTranslator && translationMode === "external-adapter",
    writesAdapterRequest: mode === "adapter-request",
    preparesAdapterStageDirectories: mode === "adapter-request",
    writesProjectJson: mode === "import",
    writesProjectPointer: mode === "import",
    writesTargetReferenceManifest: mode === "import",
    mayWriteTargetReferenceChunks: mode === "import",
    writesTemporaryReferenceManifest: mode === "dry-run"
  };
}

function referenceImportExecutionModes({ adapterRequestCapable = true } = {}) {
  const executionModes = ["plan-only"];
  if (adapterRequestCapable) executionModes.push("adapter-request");
  executionModes.push("dry-run", "import");
  return executionModes;
}

function referenceImportExecutionMetadata({ planOnly = false, adapterRequestOnly = false, dryRun = false, translationMode = null } = {}) {
  const mode = referenceImportExecutionMode({ planOnly, adapterRequestOnly, dryRun });
  return {
    referenceImportExecutionMode: mode,
    referenceImportSideEffectPlan: referenceImportSideEffectPlan(mode, { translationMode })
  };
}

function referenceImportDiscoveryMetadata({ translationMode = null, adapterRequestCapable = true } = {}) {
  const executionModes = referenceImportExecutionModes({ adapterRequestCapable });
  return {
    referenceImportContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    referenceImportExecutionModes: executionModes,
    referenceImportSideEffectPlansByMode: Object.fromEntries(executionModes.map((mode) => [
      mode,
      referenceImportSideEffectPlan(mode, { translationMode })
    ]))
  };
}

function referenceImportResultContractFingerprint(contract = {}) {
  const { resultContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceImportCommandContractFingerprint(contract = {}) {
  const { importCommandContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceProjectPointerContractFingerprint(contract = {}) {
  const { projectPointerContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceAuditContractFingerprint(contract = {}) {
  const { auditContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceImportWorkflowContractFingerprint(contract = {}) {
  const { workflowContractFingerprint: _fingerprint, ...payload } = contract;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceImportWorkflowStageOrder() {
  return [
    "source-discovery",
    "plan-only",
    "adapter-preflight",
    "adapter-request",
    "dry-run",
    "import",
    "check-references"
  ];
}

function referenceImportResultContractMetadata() {
  const translatedOutputFingerprintFields = [
    "referenceTranslatedManifestFingerprint",
    "referenceTranslatedArtifactFingerprint"
  ];
  const promotedOutputFingerprintFields = [
    "referenceManifestFingerprint",
    "referenceArtifactFingerprint"
  ];
  const contract = {
    importContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    executionModes: referenceImportExecutionModes({ adapterRequestCapable: true }),
    sideEffectPlanFields: Object.keys(referenceImportSideEffectPlan("import")),
    workflowStatusField: "referenceImportWorkflowStatus",
    planFingerprintField: "referenceImportPlanFingerprint",
    adapterRequestFingerprintField: "adapterRequestFingerprint",
    adapterRequestEvidenceFingerprintField: "adapterRequestEvidenceFingerprint",
    adapterRequestDecisionField: "referenceImportAdapterRequestDecision",
    adapterRequestDecisionFields: [
      "projectPath",
      "inputPath",
      "referencePath",
      "assetId",
      "adapterRequestPath",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "translationMode",
      "adapterKey",
      "adapterOutputMode",
      "adapterConfigProvided",
      "adapterPreflightOk",
      "adapterPreflightReady",
      "adapterPreflightLikelyFixArea",
      "adapterPreflightRecommendedNextAction",
      "stageDir",
      "scratchDir",
      "chunkDir",
      "adapterLogPath",
      "adapterStdoutPath",
      "adapterStderrPath",
      "projectPointerReady",
      "adapterRequestReady",
      "adapterStageDirectoriesReady",
      "runsTranslator",
      "launchesAdapter",
      "writesProjectJson",
      "writesTargetReferenceManifest",
      "validatesCanonicalOutput",
      "outputValidationRequired",
      "safeNextAction",
      "recommendedNextAction"
    ],
    dryRunDecisionField: "referenceImportDryRunDecision",
    dryRunDecisionFields: [
      "projectPath",
      "inputPath",
      "referencePath",
      "assetId",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "translationMode",
      "replacedExisting",
      "adapterKey",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "referenceTranslatedManifestFingerprint",
      "referenceTranslatedArtifactFingerprint",
      "referenceSchema",
      "referenceSchemaVersion",
      "referenceUnits",
      "referenceObjectCount",
      "referenceLineSegmentCount",
      "referenceMeshFaceCount",
      "referencePointCloudPointCount",
      "diagnosticCount",
      "projectPointerReady",
      "canonicalOutputValidated",
      "projectJsonUnchanged",
      "targetReferenceManifestUnchanged",
      "translatedOutputFingerprintsReady",
      "safeNextExecutionMode",
      "recommendedNextAction"
    ],
    promotionDecisionField: "referenceImportPromotionDecision",
    promotionDecisionFields: [
      "projectPath",
      "inputPath",
      "referencePath",
      "assetId",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "translationMode",
      "replacedExisting",
      "adapterKey",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRunId",
      "referenceManifestFingerprint",
      "referenceArtifactFingerprint",
      "referenceTranslatedManifestFingerprint",
      "referenceTranslatedArtifactFingerprint",
      "referenceSchema",
      "referenceSchemaVersion",
      "referenceUnits",
      "referenceObjectCount",
      "referenceLineSegmentCount",
      "referenceMeshFaceCount",
      "referencePointCloudPointCount",
      "referenceChunkFileCount",
      "referenceChunkFileMissingCount",
      "diagnosticCount",
      "projectPointerReady",
      "projectJsonWritten",
      "projectPointerWritten",
      "targetReferenceManifestWritten",
      "targetReferenceManifestValidated",
      "translatedOutputPromoted",
      "promotedOutputFingerprintsReady",
      "chunkSidecarsReady",
      "safeNextAction",
      "recommendedNextAction"
    ],
    translatedOutputFingerprintFields,
    promotedOutputFingerprintFields,
    schemaIdentityFields: [
      "referenceSchema",
      "referenceSchemaVersion",
      "adapterRequestSchema",
      "adapterRequestSchemaVersion",
      "adapterRequestSchemaPath",
      "referenceGeometrySchemaPath",
      "pointCloudChunkSchemaPath",
      "schemaVersions",
      "schemas"
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
      "plan-only": {
        translatedOutputFingerprintFields: "null",
        promotedOutputFingerprintFields: "null"
      },
      "adapter-request": {
        translatedOutputFingerprintFields: "null",
        promotedOutputFingerprintFields: "null"
      },
      "dry-run": {
        translatedOutputFingerprintFields: "sha256",
        promotedOutputFingerprintFields: "null"
      },
      import: {
        translatedOutputFingerprintFields: "sha256",
        promotedOutputFingerprintFields: "sha256"
      }
    },
    errorEnvelopeFields: [
      "ok",
      "referenceImportContractVersion",
      "referenceImportFailureDecision",
      "errors"
    ],
    failureDecisionField: "referenceImportFailureDecision",
    failureDecisionFields: [
      "failedWorkflowStage",
      "workflowStageComplete",
      "adapterErrorCode",
      "failureKind",
      "likelyFixArea",
      "safeNextAction",
      "recommendedNextAction",
      "retryWorkflowStage",
      "adapterConfigRequired",
      "adapterDependencyReviewRequired",
      "adapterRequestReviewRequired",
      "adapterRunInspectionRequired",
      "canonicalOutputFixRequired",
      "importOptionFixRequired",
      "cliOptionFixRequired"
    ],
    errorPlanContextFields: [
      "referenceImportExecutionMode",
      "referenceImportSideEffectPlan",
      "referenceImportWorkflowStatus",
      "referenceImportPlanFingerprint",
      "projectPath",
      "inputPath",
      "referencePath",
      "assetId",
      "dryRun",
      "planOnly",
      "adapterRequestOnly",
      "replacedExisting",
      "translationMode",
      "referenceImportName",
      "referenceImportUnitsOverride",
      "referenceImportPointCloudChunkSize",
      "projectReferenceVisible",
      "projectReferenceSnapEnabled",
      "projectReferenceDisplay",
      "projectReferenceTransform",
      "adapterConfigPath",
      "adapterConfigStatFingerprint",
      "adapterPreflightOk",
      "adapterPreflightRequested",
      "adapterPreflightSelectedAdapter",
      "adapterPreflightAdapterKeys",
      "adapterPreflightFingerprint",
      "adapterPreflightFingerprints",
      "adapterPreflightDecision",
      "adapterPreflightDiagnostics",
      "adapterRegistryFingerprint",
      "adapterRegistryFingerprints",
      "adapterRegistryAdapterFingerprint",
      "sourceFormat",
      "sourceRequestedFormat",
      "sourceRequestedFormatFamily",
      "sourceRequestedFormatAliases",
      "sourceRequestedFormatMatchesFamily",
      "sourceStatFingerprint"
    ],
    errorPrimaryFields: [
      "message",
      "referenceImportPlanFingerprint",
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
      "adapterPreflightOk",
      "adapterPreflightRequested",
      "adapterPreflightSelectedAdapter",
      "adapterPreflightAdapterKeys",
      "adapterPreflightFingerprint",
      "adapterPreflightFingerprints",
      "adapterPreflightDecision",
      "adapterPreflightDiagnostics",
      "adapterCwd",
      "adapterCwdExists",
      "adapterOutputPath",
      "adapterExitCode",
      "adapterTimedOut",
      "adapterTimeoutMs",
      "adapterStreamMaxBufferBytes",
      "adapterMissingRequiredFiles",
      "adapterMissingRequiredDirectories",
      "adapterMissingRequiredCommands",
      "adapterMissingRequiredEnv",
      "rollbackRecovery"
    ]
  };
  contract.resultContractFingerprint = referenceImportResultContractFingerprint(contract);
  return contract;
}

function referenceImportCommandContractMetadata() {
  const executionModes = referenceImportExecutionModes({ adapterRequestCapable: true });
  const translationModes = ["built-in", "external-adapter", "canonical-json"];
  const sideEffectPlansByModeAndTranslationMode = Object.fromEntries(translationModes.map((translationMode) => [
    translationMode,
    Object.fromEntries(executionModes.map((mode) => [
      mode,
      referenceImportSideEffectPlan(mode, { translationMode })
    ]))
  ]));
  const uiSafeImportPolicy = {
    safeFirstExecutionMode: "plan-only",
    recommendedPrewriteValidationMode: "dry-run",
    targetPromotionExecutionMode: "import",
    projectPointerPromotionExecutionMode: "import",
    noProjectOrTargetWriteModes: ["plan-only", "adapter-request", "dry-run"],
    adapterRequestOnlyModes: ["adapter-request"],
    promotedWriteModes: ["import"],
    recommendedUiGateOrder: ["--describe-source", "--plan-only", "--dry-run", "import"],
    externalAdapterGateOrder: [
      "--describe-source",
      "--check-adapters",
      "--plan-only",
      "--write-adapter-request",
      "external-adapter-wrapper",
      "--dry-run",
      "import"
    ],
    dryRunValidatesCanonicalOutputBeforePromotion: true,
    importWritesProjectPointerAndReferenceManifest: true,
    planOnlyRunsTranslator: false,
    dryRunWritesProjectJson: false
  };
  const contract = {
    importContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    discoveryCommand: "--list-import-discovery",
    sourceDiscoveryCommand: "--describe-source",
    adapterRegistryCommand: "--list-adapters",
    adapterPreflightCommand: "--check-adapters",
    cliPath: path.join(ROOT, "tools/reference-geometry/import_reference_geometry_asset.mjs"),
    cliFlags: [
      "--project",
      "--input",
      "--references-dir",
      "--asset-id",
      "--format",
      "--name",
      "--units",
      "--adapter-config",
      "--list-adapters",
      "--check-adapters",
      "--adapter",
      "--adapter-timeout-ms",
      "--point-cloud-chunk-size",
      "--replace-existing",
      "--plan-only",
      "--write-adapter-request",
      "--dry-run",
      "--json",
      "--visible",
      "--snap-enabled",
      "--opacity",
      "--color",
      "--edge-color",
      "--point-size",
      "--origin",
      "--axis-x",
      "--axis-y",
      "--axis-z",
      "--scale"
    ],
    executionModes,
    modeFlags: {
      "plan-only": ["--plan-only"],
      "adapter-request": ["--write-adapter-request"],
      "dry-run": ["--dry-run"],
      import: []
    },
    requiredInputsByMode: {
      "plan-only": ["projectPath", "inputPath"],
      "adapter-request": ["projectPath", "inputPath", "requestPath"],
      "dry-run": ["projectPath", "inputPath"],
      import: ["projectPath", "inputPath"]
    },
    optionalInputs: [
      "referencesDir",
      "assetId",
      "format",
      "name",
      "units",
      "adapterConfigPath",
      "adapterName",
      "adapterTimeoutMs",
      "pointCloudChunkSize",
      "replaceExisting",
      "visible",
      "snapEnabled",
      "display",
      "transform"
    ],
    translationModes,
    adapterRequestCapableTranslationModes: [
      "built-in",
      "external-adapter"
    ],
    uiSafeImportPolicy,
    sideEffectPlansByModeAndTranslationMode,
    projectPointerFields: [
      "path",
      "visible",
      "snapEnabled",
      "display",
      "transform"
    ],
    outputFingerprintFieldsByMode: referenceImportResultContractMetadata().outputFingerprintAvailabilityByMode,
    jsonSuccessEnvelopeFields: [
      "ok",
      "referenceImportContractVersion",
      "referenceImportExecutionMode",
      "referenceImportSideEffectPlan",
      "referenceImportWorkflowStatus",
      "referenceImportPlanFingerprint"
    ],
    jsonErrorEnvelopeFields: [
      "ok",
      "referenceImportContractVersion",
      "referenceImportFailureDecision",
      "errors"
    ],
    jsonErrorPrimaryFields: [
      "message",
      "referenceImportPlanFingerprint",
      "adapterErrorCode",
      "adapterRequestFingerprint",
      "adapterRequestEvidenceFingerprint",
      "adapterRegistryFingerprint",
      "adapterConfigStatFingerprint"
    ]
  };
  contract.importCommandContractFingerprint = referenceImportCommandContractFingerprint(contract);
  return contract;
}

function referenceProjectPointerContractMetadata() {
  const contract = {
    importContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    projectSchemaPath: PROJECT_SCHEMA,
    pointerRoot: "referenceGeometry.assets",
    assetIdPattern: projectReferenceGeometryAssetIdPattern(),
    assetIdPatternSource: PROJECT_REFERENCE_GEOMETRY_ASSET_ID_PATTERN_SOURCE,
    assetIdReservedKeys: projectReferenceGeometryAssetIdReservedKeys(),
    assetIdReservedKeysSource: PROJECT_REFERENCE_GEOMETRY_ASSET_ID_RESERVED_KEYS_SOURCE,
    storagePolicy: "project-json-pointer-only",
    geometryStoragePolicy: {
      storesMeshes: false,
      storesVertices: false,
      storesTriangles: false,
      storesPointCloudPayloads: false,
      storesBReps: false,
      storesSceneGraph: false
    },
    forbiddenGeometryPayloadFields: PROJECT_REFERENCE_FORBIDDEN_GEOMETRY_PAYLOAD_FIELDS.slice(),
    forbiddenGeometryPayloadFieldsSource: PROJECT_REFERENCE_FORBIDDEN_GEOMETRY_PAYLOAD_FIELDS_SOURCE,
    forbiddenImportRuntimeFields: PROJECT_REFERENCE_FORBIDDEN_IMPORT_RUNTIME_FIELDS.slice(),
    forbiddenImportRuntimeFieldsSource: PROJECT_REFERENCE_FORBIDDEN_IMPORT_RUNTIME_FIELDS_SOURCE,
    requiredAssetFields: projectReferenceGeometryAssetRequiredFields(),
    requiredAssetFieldsSource: PROJECT_REFERENCE_GEOMETRY_ASSET_REQUIRED_FIELDS_SOURCE,
    optionalAssetFields: projectReferenceGeometryAssetOptionalFields(),
    optionalAssetFieldsSource: PROJECT_REFERENCE_GEOMETRY_ASSET_PROPERTIES_SOURCE,
    displaySchemaFields: projectDisplaySchemaFields(),
    displaySchemaFieldsSource: PROJECT_DISPLAY_FIELDS_SOURCE,
    displaySchemaAllowsAdditionalProperties: projectDisplaySchemaAllowsAdditionalProperties(),
    displaySchemaAllowsAdditionalPropertiesSource: PROJECT_DISPLAY_ADDITIONAL_PROPERTIES_SOURCE,
    displayOverrideFields: PROJECT_REFERENCE_DISPLAY_OVERRIDE_FIELDS.slice(),
    displayOverrideFieldsSource: PROJECT_REFERENCE_DISPLAY_OVERRIDE_FIELDS_SOURCE,
    displayOverrideFieldsOutsideProjectDisplaySchema: PROJECT_REFERENCE_DISPLAY_OVERRIDE_FIELDS.filter((field) => !projectDisplaySchemaFields().includes(field)),
    transformFields: projectReferenceGeometryTransformFields(),
    transformFieldsSource: PROJECT_REFERENCE_GEOMETRY_TRANSFORM_FIELDS_SOURCE,
    transformDefaults: {
      origin: [0, 0, 0],
      axisX: [1, 0, 0],
      axisY: [0, 1, 0],
      axisZ: [0, 0, 1],
      scale: 1
    },
    transformDefaultsSource: PROJECT_REFERENCE_TRANSFORM_DEFAULTS_SOURCE,
    transformDefaultsPolicy: PROJECT_REFERENCE_TRANSFORM_DEFAULTS_POLICY,
    transformDefaultsAreSchemaDefaults: false,
    transformDefaultsAppliedWhenFieldsAreMissing: true,
    transformDefaultsStillRequireNonDegenerateBasis: true,
    pathPolicy: {
      schemaGuarded: true,
      schemaPattern: projectReferenceGeometryPathPattern(),
      schemaPatternSource: PROJECT_REFERENCE_GEOMETRY_PATH_PATTERN_SOURCE,
      projectRelative: true,
      requiredReferenceDirectory: "../references/",
      rejectsAbsolutePaths: true,
      rejectsUrls: true,
      rejectsBackslashes: true,
      rejectsTraversal: true,
      rejectsEncodedTraversal: true,
      rejectsEncodedSeparators: true,
      rejectsQueryOrFragment: true,
      rejectsControlCharacters: true,
      rejectsMalformedPercentEncoding: true,
      rejectsEmptySegments: true,
      rejectsTrailingWhitespace: true,
      rejectsWrongReferenceDirectory: true,
      rejectsNestedManifestDirectories: true,
      requiresDirectManifestFile: true,
      requiresJsonManifestExtension: true,
      rejectsPercentEncodedFilenames: true
    },
    manifestAlignment: {
      assetKeyMatchesManifestAssetId: true,
      manifestSchema: referenceGeometrySchemaName(),
      manifestSchemaSource: REFERENCE_GEOMETRY_SCHEMA_NAME_SOURCE,
      manifestSchemaVersion: referenceGeometrySchemaVersionFromSchema(),
      manifestSchemaVersionSource: REFERENCE_GEOMETRY_SCHEMA_VERSION_SOURCE,
      manifestIdPattern: referenceGeometryIdPattern(),
      manifestIdPatternSource: REFERENCE_GEOMETRY_ID_PATTERN_SOURCE,
      manifestIdReservedKeys: referenceGeometryIdReservedKeys(),
      manifestIdReservedKeysSource: REFERENCE_GEOMETRY_ID_RESERVED_KEYS_SOURCE,
      projectAssetIdPatternMatchesManifestIdPattern: projectReferenceGeometryAssetIdPattern() === referenceGeometryIdPattern(),
      projectAssetIdReservedKeysMatchManifestIdReservedKeys: JSON.stringify(projectReferenceGeometryAssetIdReservedKeys()) === JSON.stringify(referenceGeometryIdReservedKeys())
    },
    importerValidation: [
      "safe-asset-id",
      "pointer-path-contained-in-references-dir",
      "display-overrides",
      "non-degenerate-transform",
      "manifest-asset-id-alignment",
      "canonical-manifest-schema"
    ],
    runtimeValidation: [
      "safe-asset-id",
      "safe-reference-url",
      "pointer-display-transform",
      "canonical-manifest-schema",
      "chunk-sidecar-url-containment"
    ],
    auditFields: [
      "referencePathWithinReferencesDir",
      "referenceAuditStatus",
      "referenceReady",
      "referenceAuditSeverity",
      "referenceAuditStatusRank"
    ]
  };
  contract.projectPointerContractFingerprint = referenceProjectPointerContractFingerprint(contract);
  return contract;
}

function referenceAuditContractMetadata() {
  const contract = {
    auditContractVersion: REFERENCE_AUDIT_CONTRACT_VERSION,
    discoveryCommand: "--list-import-discovery",
    auditCommand: "--check-references",
    cliFlags: [
      "--project",
      "--check-references",
      "--asset-id",
      "--references-dir",
      "--summary-only",
      "--json"
    ],
    requiredInputs: [
      "projectPath"
    ],
    optionalInputs: [
      "assetId",
      "referencesDir",
      "summaryOnly"
    ],
    sideEffects: {
      validatesProjectPointer: true,
      readsProjectJson: true,
      readsReferenceManifests: true,
      mayReadPointCloudChunkSidecars: true,
      runsTranslator: false,
      mayLaunchExternalAdapter: false,
      writesProjectJson: false,
      writesProjectPointer: false,
      writesTargetReferenceManifest: false,
      mayWriteTargetReferenceChunks: false
    },
    statusDefinitions: referenceAuditStatusDefinitions(),
    limits: referenceAuditLimits(),
    fingerprintField: "referenceAuditFingerprint",
    auditDecisionField: "referenceAuditDecision",
    auditDecisionFields: [
      "projectPath",
      "requestedAssetId",
      "referenceAssetCount",
      "referenceReadyCount",
      "referenceNeedsAttentionCount",
      "referenceAuditErrorCount",
      "auditPassed",
      "referenceOverlayReady",
      "blockingStatuses",
      "highestPriorityStatus",
      "highestPrioritySeverity",
      "highestPriorityAssetId",
      "likelyFixArea",
      "safeNextAction",
      "recommendedNextAction"
    ],
    projectFileMetadataFields: [
      "projectFileName",
      "projectFileSizeBytes",
      "projectFileModifiedTime",
      "projectStatFingerprint"
    ],
    aggregateFields: [
      "selectedAssetCount",
      "readyAssetCount",
      "needsAttentionAssetCount",
      "canonicalManifestCount",
      "objectCount",
      "layerCount",
      "chunkCount",
      "lineSegmentCount",
      "meshFaceCount",
      "pointCloudPointCount",
      "chunkFileCount",
      "chunkFileMissingCount",
      "chunkFileInvalidCount",
      "diagnosticCount",
      "auditStatusCounts",
      "auditSeverityCounts",
      "sourceFormatCounts",
      "sourceAdapterCounts",
      "objectKindCounts"
    ],
    assetEntryFields: [
      "assetId",
      "path",
      "resolvedPath",
      "referenceReady",
      "referenceAuditStatus",
      "referenceAuditStatusRank",
      "referenceAuditSeverity",
      "referencePathWithinReferencesDir",
      "exists",
      "visible",
      "snapEnabled",
      "displayColor",
      "displayEdgeColor",
      "displayOpacity",
      "displayPointSize",
      "transformOrigin",
      "transformAxisX",
      "transformAxisY",
      "transformAxisZ",
      "transformScale",
      "sourceFormat",
      "sourceAdapter",
      "manifestAssetId",
      "referenceSchema",
      "referenceSchemaVersion",
      "referenceManifestFingerprint",
      "referenceArtifactFingerprint",
      "referenceObjectCount",
      "referenceLayerCount",
      "referenceChunkCount",
      "referenceLineSegmentCount",
      "referenceMeshFaceCount",
      "referencePointCloudPointCount",
      "referenceChunkFileMissingCount",
      "referenceChunkFileInvalidCount",
      "diagnosticCount",
      "referenceAuditErrorCount"
    ],
    needsAttentionEntryFields: [
      "assetId",
      "path",
      "resolvedPath",
      "referenceReady",
      "referenceAuditStatus",
      "referenceAuditStatusRank",
      "referenceAuditSeverity",
      "referencePathWithinReferencesDir",
      "exists",
      "readError",
      "manifestAssetId",
      "referenceSchema",
      "referenceSchemaVersion",
      "referenceChunkFileMissingCount",
      "referenceChunkFileInvalidCount",
      "referenceChunkFileInvalidEntries",
      "referenceChunkFileInvalidOmittedCount",
      "referenceAuditErrorCount",
      "referenceAuditErrorEntries",
      "referenceAuditErrorOmittedCount"
    ],
    fullResultFields: [
      "ok",
      "referenceAuditContractVersion",
      "referenceAuditLimits",
      "referenceAuditStatusDefinitions",
      "projectFileName",
      "projectFileSizeBytes",
      "projectFileModifiedTime",
      "projectStatFingerprint",
      "referenceAuditDecision",
      "referenceImportWorkflowStatus",
      "assets",
      "referenceAssetEntries",
      "referenceNeedsAttentionEntries",
      "referenceAggregate",
      "referenceAuditFingerprint",
      "errors"
    ],
    summaryOnlyFields: [
      "ok",
      "referenceAuditContractVersion",
      "referenceAuditLimits",
      "referenceAuditStatusDefinitions",
      "projectFileName",
      "projectStatFingerprint",
      "referenceAuditDecision",
      "referenceImportWorkflowStatus",
      "referenceAssetEntries",
      "referenceNeedsAttentionEntries",
      "referenceAggregate",
      "referenceAuditFingerprint",
      "errors"
    ],
    summaryOnlyOmittedLocalPathFields: [
      "projectPath",
      "referencesDir",
      "referenceAuditDecision.projectPath",
      "referenceAssetEntries[].resolvedPath",
      "referenceNeedsAttentionEntries[].resolvedPath"
    ]
  };
  contract.auditContractFingerprint = referenceAuditContractFingerprint(contract);
  return contract;
}

function referenceImportWorkflowContractMetadata() {
  const workflowStages = referenceImportWorkflowStageOrder();
  const contract = {
    importContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    auditContractVersion: REFERENCE_AUDIT_CONTRACT_VERSION,
    discoveryCommand: "--list-import-discovery",
    workflowPurpose: "staged-reference-geometry-import",
    isolationBoundary: {
      sourceFormatOwnership: "translator-or-external-adapter",
      applicationInput: "canonical-reference-json",
      projectStoragePolicy: "project-json-pointer-only",
      promotedGeometryStorage: "reference-manifest-and-point-cloud-chunk-sidecars"
    },
    workflowStages,
    optionalStages: [
      "adapter-preflight",
      "adapter-request"
    ],
    safeWorkflowOrder: workflowStages,
    stageCommandFlags: {
      "source-discovery": ["--describe-source"],
      "plan-only": ["--plan-only"],
      "adapter-preflight": ["--check-adapters"],
      "adapter-request": ["--write-adapter-request"],
      "dry-run": ["--dry-run"],
      import: [],
      "check-references": ["--check-references"]
    },
    stageExecutionModes: {
      "source-discovery": null,
      "plan-only": "plan-only",
      "adapter-preflight": null,
      "adapter-request": "adapter-request",
      "dry-run": "dry-run",
      import: "import",
      "check-references": null
    },
    stageRequiredInputs: {
      "source-discovery": ["inputPath"],
      "plan-only": ["projectPath", "inputPath"],
      "adapter-preflight": ["adapterConfigPath"],
      "adapter-request": ["projectPath", "inputPath", "requestPath"],
      "dry-run": ["projectPath", "inputPath"],
      import: ["projectPath", "inputPath"],
      "check-references": ["projectPath"]
    },
    stageDecisionFields: {
      "source-discovery": "referenceImportSourceDecision",
      "plan-only": "referenceImportPlanDecision",
      "adapter-preflight": "adapterPreflightDecision",
      "adapter-request": "referenceImportAdapterRequestDecision",
      "dry-run": "referenceImportDryRunDecision",
      import: "referenceImportPromotionDecision",
      "check-references": "referenceAuditDecision"
    },
    stageFingerprintFields: {
      "source-discovery": [
        "referenceSourceDescriptionFingerprint",
        "referenceImportDiscoveryFingerprint"
      ],
      "plan-only": [
        "referenceImportPlanFingerprint"
      ],
      "adapter-preflight": [
        "adapterRegistryFingerprint",
        "adapterTargetFormatCoverageFingerprint",
        "adapterPreflightFingerprint"
      ],
      "adapter-request": [
        "referenceImportPlanFingerprint",
        "adapterRequestFingerprint",
        "adapterRequestEvidenceFingerprint"
      ],
      "dry-run": [
        "referenceImportPlanFingerprint",
        "referenceTranslatedManifestFingerprint",
        "referenceTranslatedArtifactFingerprint"
      ],
      import: [
        "referenceImportPlanFingerprint",
        "referenceTranslatedManifestFingerprint",
        "referenceTranslatedArtifactFingerprint",
        "referenceManifestFingerprint",
        "referenceArtifactFingerprint"
      ],
      "check-references": [
        "referenceAuditFingerprint"
      ]
    },
    stageDecisionFingerprintPolicy: {
      "source-discovery": {
        decisionField: "referenceImportSourceDecision",
        fingerprintField: "referenceImportDiscoveryFingerprint",
        includedInStageFingerprint: true
      },
      "plan-only": {
        decisionField: "referenceImportPlanDecision",
        fingerprintField: "referenceImportPlanFingerprint",
        includedInStageFingerprint: true
      },
      "adapter-preflight": {
        decisionField: "adapterPreflightDecision",
        fingerprintField: "adapterPreflightFingerprint",
        includedInStageFingerprint: true
      },
      "adapter-request": {
        decisionField: "referenceImportAdapterRequestDecision",
        fingerprintField: "referenceImportPlanFingerprint",
        includedInStageFingerprint: false
      },
      "dry-run": {
        decisionField: "referenceImportDryRunDecision",
        fingerprintField: "referenceImportPlanFingerprint",
        includedInStageFingerprint: false
      },
      import: {
        decisionField: "referenceImportPromotionDecision",
        fingerprintField: "referenceImportPlanFingerprint",
        includedInStageFingerprint: false
      },
      "check-references": {
        decisionField: "referenceAuditDecision",
        fingerprintField: "referenceAuditFingerprint",
        includedInStageFingerprint: false
      }
    },
    stageSideEffectBoundaries: {
      "source-discovery": {
        requiresProjectPath: false,
        readsSourceFileMetadata: true,
        validatesProjectPointer: false,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      "plan-only": {
        requiresProjectPath: true,
        validatesProjectPointer: true,
        mayPreflightAdapter: true,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      "adapter-preflight": {
        requiresProjectPath: false,
        validatesProjectPointer: false,
        preflightsAdapter: true,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      "adapter-request": {
        requiresProjectPath: true,
        validatesProjectPointer: true,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: true,
        preparesAdapterStageDirectories: true,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      "dry-run": {
        requiresProjectPath: true,
        validatesProjectPointer: true,
        preflightsAdapter: false,
        runsTranslator: true,
        mayLaunchExternalAdapter: true,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesTemporaryReferenceManifest: true,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      import: {
        requiresProjectPath: true,
        validatesProjectPointer: true,
        preflightsAdapter: false,
        runsTranslator: true,
        mayLaunchExternalAdapter: true,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: true,
        writesProjectPointer: true,
        writesTargetReferenceManifest: true,
        mayWriteTargetReferenceChunks: true,
        readsReferenceManifests: false,
        mayReadPointCloudChunkSidecars: false
      },
      "check-references": {
        requiresProjectPath: true,
        readsProjectJson: true,
        validatesProjectPointer: true,
        preflightsAdapter: false,
        runsTranslator: false,
        mayLaunchExternalAdapter: false,
        writesAdapterRequest: false,
        preparesAdapterStageDirectories: false,
        writesProjectJson: false,
        writesProjectPointer: false,
        writesTargetReferenceManifest: false,
        mayWriteTargetReferenceChunks: false,
        readsReferenceManifests: true,
        mayReadPointCloudChunkSidecars: true
      }
    },
    noProjectOrTargetWriteStages: [
      "source-discovery",
      "plan-only",
      "adapter-preflight",
      "adapter-request",
      "dry-run",
      "check-references"
    ],
    promotedWriteStages: [
      "import"
    ],
    recommendedGateDecisionFields: [
      "referenceImportSourceDecision",
      "referenceImportPlanDecision",
      "adapterPreflightDecision",
      "referenceImportDryRunDecision",
      "referenceImportPromotionDecision",
      "referenceAuditDecision"
    ],
    workflowStatusField: "referenceImportWorkflowStatus",
    workflowStatusFields: [
      "workflowStage",
      "workflowStageComplete",
      "completedWorkflowStages",
      "nextWorkflowStages",
      "recommendedNextWorkflowStage",
      "workflowDecisionField",
      "workflowFingerprintFields",
      "noProjectOrTargetWrites",
      "promotedWriteStage",
      "writesProjectJson",
      "writesTargetReferenceManifest",
      "mayLaunchExternalAdapter",
      "sideEffectBoundary"
    ],
    workflowFailureStatusPolicy: {
      statusField: "referenceImportWorkflowStatus",
      failureDecisionField: "referenceImportFailureDecision",
      failedStageComplete: false,
      completedStagesExcludeFailedStage: true,
      preservesPlanFingerprint: true
    }
  };
  contract.workflowContractFingerprint = referenceImportWorkflowContractFingerprint(contract);
  return contract;
}

function referenceImportWorkflowStageFromExecutionMode(mode) {
  if (mode === "plan-only") return "plan-only";
  if (mode === "adapter-request") return "adapter-request";
  if (mode === "dry-run") return "dry-run";
  if (mode === "import") return "import";
  return null;
}

function referenceImportWorkflowStagesFromExecutionModes(modes = []) {
  return modes
    .map((mode) => referenceImportWorkflowStageFromExecutionMode(mode))
    .filter((stage) => typeof stage === "string" && stage);
}

function referenceImportWorkflowDefaultNextStages(stage) {
  if (stage === "source-discovery") return ["plan-only"];
  if (stage === "plan-only") return ["adapter-preflight", "adapter-request", "dry-run", "import"];
  if (stage === "adapter-preflight") return ["plan-only", "dry-run"];
  if (stage === "adapter-request") return ["dry-run"];
  if (stage === "dry-run") return ["import"];
  if (stage === "import") return ["check-references"];
  return [];
}

function referenceImportWorkflowStageForSummary(summary = {}) {
  const modeStage = referenceImportWorkflowStageFromExecutionMode(summary.referenceImportExecutionMode);
  if (modeStage) return modeStage;
  if (summary.adapterRequestOnly === true) return "adapter-request";
  if (summary.planOnly === true) return "plan-only";
  if (summary.dryRun === true) return "dry-run";
  return null;
}

function referenceImportWorkflowDecisionForStage(summary = {}, stage) {
  if (stage === "source-discovery") return isRecord(summary.referenceImportSourceDecision) ? summary.referenceImportSourceDecision : null;
  if (stage === "plan-only") return isRecord(summary.referenceImportPlanDecision) ? summary.referenceImportPlanDecision : null;
  if (stage === "adapter-preflight") return isRecord(summary.adapterPreflightDecision) ? summary.adapterPreflightDecision : null;
  if (stage === "adapter-request") return isRecord(summary.referenceImportAdapterRequestDecision) ? summary.referenceImportAdapterRequestDecision : null;
  if (stage === "dry-run") return isRecord(summary.referenceImportDryRunDecision) ? summary.referenceImportDryRunDecision : null;
  if (stage === "import") return isRecord(summary.referenceImportPromotionDecision) ? summary.referenceImportPromotionDecision : null;
  if (stage === "check-references") return isRecord(summary.referenceAuditDecision) ? summary.referenceAuditDecision : null;
  return null;
}

function referenceImportWorkflowNextStagesFromDecision(stage, decision = null) {
  if (stage === "source-discovery") {
    if (decision?.sourceFileReadyForImport !== true) return ["source-discovery"];
    if (decision?.externalAdapterRequired === true) return ["adapter-preflight", "plan-only"];
    return ["plan-only"];
  }
  if (Array.isArray(decision?.availableNextExecutionModes)) {
    return referenceImportWorkflowStagesFromExecutionModes(decision.availableNextExecutionModes);
  }
  return [];
}

function referenceImportWorkflowRecommendedNextStage(stage, decision = null, nextWorkflowStages = []) {
  if (stage === "source-discovery") {
    if (decision?.sourceFileReadyForImport !== true) return "source-discovery";
    if (decision?.externalAdapterRequired === true) return "adapter-preflight";
  }
  return referenceImportWorkflowStageFromExecutionMode(decision?.safeNextExecutionMode)
    || nextWorkflowStages[0]
    || null;
}

function referenceImportWorkflowStatus({ stage, stageComplete = true, decision = null } = {}) {
  const contract = referenceImportWorkflowContractMetadata();
  const stageIndex = contract.workflowStages.indexOf(stage);
  const completedWorkflowStages = stageIndex >= 0 && stageComplete ? [stage] : [];
  const decisionNextStages = referenceImportWorkflowNextStagesFromDecision(stage, decision);
  const nextWorkflowStages = decisionNextStages.length
    ? decisionNextStages
    : referenceImportWorkflowDefaultNextStages(stage);
  const recommendedNextWorkflowStage = referenceImportWorkflowRecommendedNextStage(stage, decision, nextWorkflowStages);
  const sideEffectBoundary = isRecord(contract.stageSideEffectBoundaries?.[stage])
    ? contract.stageSideEffectBoundaries[stage]
    : {};
  return {
    workflowStage: stage || null,
    workflowStageComplete: Boolean(stageComplete && stageIndex >= 0),
    completedWorkflowStages,
    nextWorkflowStages,
    recommendedNextWorkflowStage,
    workflowDecisionField: contract.stageDecisionFields?.[stage] || null,
    workflowFingerprintFields: Array.isArray(contract.stageFingerprintFields?.[stage])
      ? contract.stageFingerprintFields[stage]
      : [],
    noProjectOrTargetWrites: contract.noProjectOrTargetWriteStages.includes(stage),
    promotedWriteStage: contract.promotedWriteStages.includes(stage),
    writesProjectJson: sideEffectBoundary.writesProjectJson === true,
    writesTargetReferenceManifest: sideEffectBoundary.writesTargetReferenceManifest === true,
    mayLaunchExternalAdapter: sideEffectBoundary.mayLaunchExternalAdapter === true,
    sideEffectBoundary
  };
}

function attachReferenceImportWorkflowStatus(summary, stage = null, { stageComplete = true } = {}) {
  const workflowStage = stage || referenceImportWorkflowStageForSummary(summary);
  if (!workflowStage) return summary;
  summary.referenceImportWorkflowStatus = referenceImportWorkflowStatus({
    stage: workflowStage,
    stageComplete,
    decision: referenceImportWorkflowDecisionForStage(summary, workflowStage)
  });
  return summary;
}

function referenceImportDiscoveryMetadataByToken(tokenSpecs) {
  const tokenMetadata = tokenSpecs.map((spec) => [
    spec.format,
    referenceImportDiscoveryMetadata({
      translationMode: spec.importerTranslationMode,
      adapterRequestCapable: spec.adapterRequestCapable === true
    })
  ]);
  return {
    referenceImportExecutionModesByToken: Object.fromEntries(tokenMetadata.map(([format, metadata]) => [
      format,
      metadata.referenceImportExecutionModes
    ])),
    referenceImportSideEffectPlansByToken: Object.fromEntries(tokenMetadata.map(([format, metadata]) => [
      format,
      metadata.referenceImportSideEffectPlansByMode
    ]))
  };
}

function referenceImportDiscoveryFingerprint(entry = {}) {
  const payload = {
    referenceImportContractVersion: entry.referenceImportContractVersion || null,
    referenceSourceDescriptionFingerprint: entry.referenceSourceDescriptionFingerprint || null,
    format: entry.format || null,
    canonicalFormat: entry.canonicalFormat || entry.sourceFormat || null,
    sourceRequestedFormat: entry.sourceRequestedFormat || entry.requestedFormat || null,
    importerTranslationMode: entry.importerTranslationMode || null,
    defaultImporterTranslationMode: entry.defaultImporterTranslationMode || null,
    importerTranslationModes: Array.isArray(entry.importerTranslationModes) ? entry.importerTranslationModes : null,
    importerTranslationModesByToken: isRecord(entry.importerTranslationModesByToken) ? entry.importerTranslationModesByToken : null,
    state: entry.state || null,
    canonicalFormatState: entry.canonicalFormatState || null,
    requestedFormatState: entry.requestedFormatState || null,
    builtInAvailable: entry.builtInAvailable ?? null,
    externalAdapterRequired: entry.externalAdapterRequired ?? null,
    hasExternalAdapterOnlyTokens: entry.hasExternalAdapterOnlyTokens ?? null,
    externalAdapterRequiredTokens: Array.isArray(entry.externalAdapterRequiredTokens) ? entry.externalAdapterRequiredTokens : null,
    adapterCapable: entry.adapterCapable ?? null,
    adapterRequestCapable: entry.adapterRequestCapable ?? null,
    adapterConfigPath: entry.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(entry.adapterConfigFileSizeBytes) ? entry.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: entry.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: entry.adapterConfigStatFingerprint || null,
    adapterRegistryFingerprint: entry.adapterRegistryFingerprint || null,
    adapterRegistryFingerprints: isRecord(entry.adapterRegistryFingerprints) ? entry.adapterRegistryFingerprints : null,
    adapterRegistryAdapterKeys: Array.isArray(entry.adapterRegistryAdapterKeys) ? entry.adapterRegistryAdapterKeys : null,
    adapterRegistrySourceFormatAdapterKeys: Array.isArray(entry.adapterRegistrySourceFormatAdapterKeys) ? entry.adapterRegistrySourceFormatAdapterKeys : null,
    adapterRegistrySupportsSourceFormat: entry.adapterRegistrySupportsSourceFormat ?? null,
    planOnlyPreflightsAdapters: entry.planOnlyPreflightsAdapters ?? null,
    dryRunValidatesTranslatorOutput: entry.dryRunValidatesTranslatorOutput ?? null,
    canonicalJsonPassthrough: entry.canonicalJsonPassthrough ?? null,
    projectRequiredForImport: entry.projectRequiredForImport ?? null,
    writesProjectPointer: entry.writesProjectPointer ?? null,
    writesCanonicalReferenceManifest: entry.writesCanonicalReferenceManifest ?? null,
    fileExtensions: Array.isArray(entry.fileExtensions) ? entry.fileExtensions : null,
    acceptExtensions: Array.isArray(entry.acceptExtensions) ? entry.acceptExtensions : null,
    accept: entry.accept || "",
    canonicalFileExtensions: Array.isArray(entry.canonicalFileExtensions) ? entry.canonicalFileExtensions : null,
    canonicalAcceptExtensions: Array.isArray(entry.canonicalAcceptExtensions) ? entry.canonicalAcceptExtensions : null,
    canonicalAccept: entry.canonicalAccept || "",
    formatTokens: Array.isArray(entry.formatTokens) ? entry.formatTokens : null,
    canonicalFormatTokens: Array.isArray(entry.canonicalFormatTokens) ? entry.canonicalFormatTokens : null,
    aliases: Array.isArray(entry.aliases) ? entry.aliases : null,
    cliOnlyTokens: Array.isArray(entry.cliOnlyTokens) ? entry.cliOnlyTokens : null,
    referenceImportExecutionModes: Array.isArray(entry.referenceImportExecutionModes) ? entry.referenceImportExecutionModes : null,
    referenceImportSideEffectPlansByMode: isRecord(entry.referenceImportSideEffectPlansByMode) ? entry.referenceImportSideEffectPlansByMode : null,
    referenceImportExecutionModesByToken: isRecord(entry.referenceImportExecutionModesByToken) ? entry.referenceImportExecutionModesByToken : null,
    referenceImportSideEffectPlansByToken: isRecord(entry.referenceImportSideEffectPlansByToken) ? entry.referenceImportSideEffectPlansByToken : null,
    referenceImportSourceDecision: isRecord(entry.referenceImportSourceDecision) ? entry.referenceImportSourceDecision : null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function attachReferenceImportDiscoveryFingerprint(entry) {
  entry.referenceImportDiscoveryFingerprint = referenceImportDiscoveryFingerprint(entry);
  return entry;
}

function referenceImportDiscoveryCatalogFingerprint(catalog = {}) {
  const formatFingerprints = Object.fromEntries(Object.entries(catalog.formats || {}).map(([format, entry]) => [
    format,
    entry.referenceImportDiscoveryFingerprint || null
  ]));
  const formatGroupFingerprints = Object.fromEntries(Object.entries(catalog.formatGroups || {}).map(([format, entry]) => [
    format,
    entry.referenceImportDiscoveryFingerprint || null
  ]));
  const payload = {
    referenceImportContractVersion: catalog.referenceImportContractVersion || null,
    referenceImportSchemaNames: isRecord(catalog.referenceImportSchemaNames) ? catalog.referenceImportSchemaNames : null,
    referenceImportSchemaVersions: isRecord(catalog.referenceImportSchemaVersions) ? catalog.referenceImportSchemaVersions : null,
    referenceImportSchemaPaths: isRecord(catalog.referenceImportSchemaPaths) ? catalog.referenceImportSchemaPaths : null,
    referenceCanonicalOutputContract: isRecord(catalog.referenceCanonicalOutputContract) ? catalog.referenceCanonicalOutputContract : null,
    referenceAdapterOutputValidationContract: isRecord(catalog.referenceAdapterOutputValidationContract) ? catalog.referenceAdapterOutputValidationContract : null,
    referenceSourceDescriptionContract: isRecord(catalog.referenceSourceDescriptionContract) ? catalog.referenceSourceDescriptionContract : null,
    referenceImportCommandContract: isRecord(catalog.referenceImportCommandContract) ? catalog.referenceImportCommandContract : null,
    referenceProjectPointerContract: isRecord(catalog.referenceProjectPointerContract) ? catalog.referenceProjectPointerContract : null,
    referenceAuditContract: isRecord(catalog.referenceAuditContract) ? catalog.referenceAuditContract : null,
    referenceImportResultContract: isRecord(catalog.referenceImportResultContract) ? catalog.referenceImportResultContract : null,
    referenceImportWorkflowContract: isRecord(catalog.referenceImportWorkflowContract) ? catalog.referenceImportWorkflowContract : null,
    referenceImportAdapterRequestContract: isRecord(catalog.referenceImportAdapterRequestContract) ? catalog.referenceImportAdapterRequestContract : null,
    referenceImportAdapterConfigContract: isRecord(catalog.referenceImportAdapterConfigContract) ? catalog.referenceImportAdapterConfigContract : null,
    referenceImportAdapterPreflightContract: isRecord(catalog.referenceImportAdapterPreflightContract) ? catalog.referenceImportAdapterPreflightContract : null,
    referenceImportDecisionSummary: isRecord(catalog.referenceImportDecisionSummary) ? catalog.referenceImportDecisionSummary : null,
    referenceTargetFormatCoverage: isRecord(catalog.referenceTargetFormatCoverage) ? catalog.referenceTargetFormatCoverage : null,
    formatFingerprints,
    formatGroupFingerprints
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function referenceImportDecisionSummary({ formats = {}, formatGroups = {} } = {}) {
  const formatEntries = Object.entries(formats);
  const formatGroupEntries = Object.entries(formatGroups);
  const sourceFormatsByMode = (mode) => formatEntries
    .filter(([, entry]) => entry.importerTranslationMode === mode)
    .map(([format]) => format);
  const canonicalFormatsByMode = (mode) => formatGroupEntries
    .filter(([, entry]) => Array.isArray(entry.importerTranslationModes) && entry.importerTranslationModes.includes(mode))
    .map(([format]) => format);
  const filePickerAcceptExtensions = uniqueValues(formatGroupEntries.flatMap(([, entry]) => (
    Array.isArray(entry.acceptExtensions) ? entry.acceptExtensions : []
  )));
  return {
    canonicalFormats: formatGroupEntries.map(([format]) => format),
    sourceFormatTokens: formatEntries.map(([format]) => format),
    filePickerFileExtensions: uniqueValues(formatGroupEntries.flatMap(([, entry]) => (
      Array.isArray(entry.fileExtensions) ? entry.fileExtensions : []
    ))),
    filePickerAcceptExtensions,
    filePickerAccept: filePickerAcceptExtensions.join(","),
    filePickerGroups: referenceImportFilePickerGroups(formatGroupEntries),
    builtInFormats: sourceFormatsByMode("built-in"),
    externalAdapterRequiredFormats: sourceFormatsByMode("external-adapter"),
    canonicalJsonPassthroughFormats: sourceFormatsByMode("canonical-json"),
    adapterCapableFormats: formatEntries
      .filter(([, entry]) => entry.adapterCapable === true)
      .map(([format]) => format),
    adapterRequestCapableFormats: formatEntries
      .filter(([, entry]) => entry.adapterRequestCapable === true)
      .map(([format]) => format),
    builtInCanonicalFormats: canonicalFormatsByMode("built-in"),
    externalAdapterRequiredCanonicalFormats: formatGroupEntries
      .filter(([, entry]) => entry.externalAdapterRequired === true)
      .map(([format]) => format),
    mixedModeCanonicalFormats: formatGroupEntries
      .filter(([, entry]) => Array.isArray(entry.importerTranslationModes) && entry.importerTranslationModes.length > 1)
      .map(([format]) => format),
    canonicalJsonPassthroughCanonicalFormats: canonicalFormatsByMode("canonical-json"),
    adapterCapableCanonicalFormats: formatGroupEntries
      .filter(([, entry]) => entry.adapterCapable === true)
      .map(([format]) => format),
    adapterRequestCapableCanonicalFormats: formatGroupEntries
      .filter(([, entry]) => entry.adapterRequestCapable === true)
      .map(([format]) => format),
    cliOnlyTokens: uniqueValues(formatGroupEntries.flatMap(([, entry]) => (
      Array.isArray(entry.cliOnlyTokens) ? entry.cliOnlyTokens : []
    )))
  };
}

function referenceImportFilePickerGroups(formatGroupEntries = []) {
  return formatGroupEntries.map(([format, entry]) => ({
    canonicalFormat: format,
    fileExtensions: Array.isArray(entry.fileExtensions) ? entry.fileExtensions : [],
    acceptExtensions: Array.isArray(entry.acceptExtensions) ? entry.acceptExtensions : [],
    accept: entry.accept || "",
    formatTokens: Array.isArray(entry.formatTokens) ? entry.formatTokens : [],
    cliOnlyTokens: Array.isArray(entry.cliOnlyTokens) ? entry.cliOnlyTokens : [],
    defaultImporterTranslationMode: entry.defaultImporterTranslationMode || null,
    importerTranslationModes: Array.isArray(entry.importerTranslationModes) ? entry.importerTranslationModes : [],
    importerTranslationModesByToken: isRecord(entry.importerTranslationModesByToken) ? entry.importerTranslationModesByToken : {},
    builtInAvailable: entry.builtInAvailable === true,
    externalAdapterRequired: entry.externalAdapterRequired === true,
    hasExternalAdapterOnlyTokens: entry.hasExternalAdapterOnlyTokens === true,
    externalAdapterRequiredTokens: Array.isArray(entry.externalAdapterRequiredTokens) ? entry.externalAdapterRequiredTokens : [],
    adapterRequestCapable: entry.adapterRequestCapable === true,
    canonicalJsonPassthrough: entry.canonicalJsonPassthrough === true
  }));
}

function referenceImportSchemaContractMetadata() {
  return {
    referenceImportSchemaNames: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA_NAME,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA_NAME,
      adapterRequest: ADAPTER_REQUEST_SCHEMA_NAME,
      adapterConfig: ADAPTER_CONFIG_SCHEMA_NAME
    },
    referenceImportSchemaVersions: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA_VERSION,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA_VERSION,
      adapterRequest: ADAPTER_REQUEST_SCHEMA_VERSION,
      adapterConfig: ADAPTER_CONFIG_SCHEMA_VERSION
    },
    referenceImportSchemaPaths: {
      referenceGeometry: REFERENCE_GEOMETRY_SCHEMA,
      pointCloudChunk: POINT_CLOUD_CHUNK_SCHEMA,
      adapterRequest: ADAPTER_REQUEST_SCHEMA,
      adapterConfig: ADAPTER_CONFIG_SCHEMA
    },
    referenceCanonicalOutputContract: referenceGeometryCanonicalOutputContractMetadata(),
    referenceAdapterOutputValidationContract: referenceGeometryAdapterOutputValidationContractMetadata()
  };
}

function referenceImportPlanFingerprint(summary = {}) {
  const adapterKey = summary.adapterPreflightSelectedAdapter || summary.sourceAdapter || summary.adapterKey || null;
  const payload = {
    referenceImportContractVersion: summary.referenceImportContractVersion || null,
    projectPath: summary.projectPath || null,
    inputPath: summary.inputPath || null,
    referencePath: summary.referencePath || null,
    assetId: summary.assetId || null,
    replacedExisting: summary.replacedExisting ?? null,
    translationMode: summary.translationMode || null,
    referenceImportName: summary.referenceImportName || null,
    referenceImportUnitsOverride: summary.referenceImportUnitsOverride || null,
    referenceImportPointCloudChunkSize: Number.isInteger(summary.referenceImportPointCloudChunkSize) ? summary.referenceImportPointCloudChunkSize : null,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
    sourceFileName: summary.sourceFileName || null,
    sourceFileSizeBytes: Number.isInteger(summary.sourceFileSizeBytes) ? summary.sourceFileSizeBytes : null,
    sourceFileModifiedTime: summary.sourceFileModifiedTime || null,
    sourceStatFingerprint: summary.sourceStatFingerprint || null,
    adapterConfigPath: summary.adapterConfigPath || null,
    adapterConfigFileSizeBytes: Number.isInteger(summary.adapterConfigFileSizeBytes) ? summary.adapterConfigFileSizeBytes : null,
    adapterConfigFileModifiedTime: summary.adapterConfigFileModifiedTime || null,
    adapterConfigStatFingerprint: summary.adapterConfigStatFingerprint || null,
    adapterKey,
    adapterRegistryFingerprint: summary.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: summary.adapterRegistryAdapterFingerprint || null,
    adapterOutputMode: summary.adapterOutputMode || null,
    projectReferenceVisible: summary.projectReferenceVisible ?? null,
    projectReferenceSnapEnabled: summary.projectReferenceSnapEnabled ?? null,
    projectReferenceDisplayColor: summary.projectReferenceDisplayColor || null,
    projectReferenceDisplayEdgeColor: summary.projectReferenceDisplayEdgeColor || null,
    projectReferenceDisplayOpacity: Number.isFinite(summary.projectReferenceDisplayOpacity) ? summary.projectReferenceDisplayOpacity : null,
    projectReferenceDisplayPointSize: Number.isFinite(summary.projectReferenceDisplayPointSize) ? summary.projectReferenceDisplayPointSize : null,
    projectReferenceTransformOrigin: Array.isArray(summary.projectReferenceTransformOrigin) ? summary.projectReferenceTransformOrigin : null,
    projectReferenceTransformAxisX: Array.isArray(summary.projectReferenceTransformAxisX) ? summary.projectReferenceTransformAxisX : null,
    projectReferenceTransformAxisY: Array.isArray(summary.projectReferenceTransformAxisY) ? summary.projectReferenceTransformAxisY : null,
    projectReferenceTransformAxisZ: Array.isArray(summary.projectReferenceTransformAxisZ) ? summary.projectReferenceTransformAxisZ : null,
    projectReferenceTransformScale: Number.isFinite(summary.projectReferenceTransformScale) ? summary.projectReferenceTransformScale : null,
    referenceImportPlanDecision: isRecord(summary.referenceImportPlanDecision) ? summary.referenceImportPlanDecision : null
  };
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function attachReferenceImportPlanFingerprint(summary) {
  summary.referenceImportContractVersion = REFERENCE_IMPORT_CONTRACT_VERSION;
  if (!isRecord(summary.referenceImportPlanDecision)) {
    summary.referenceImportPlanDecision = referenceImportPlanDecision(summary);
  }
  summary.referenceImportPlanFingerprint = referenceImportPlanFingerprint(summary);
  return attachReferenceImportWorkflowStatus(summary);
}

function referenceImportPlanDecision(summary = {}) {
  const adapterRequestCapable = summary.translationMode !== "canonical-json";
  const adapterConfigProvided = Boolean(summary.adapterConfigPath);
  const adapterPreflightOk = summary.adapterPreflightOk ?? null;
  return {
    projectPath: summary.projectPath || null,
    inputPath: summary.inputPath || null,
    referencePath: summary.referencePath || null,
    assetId: summary.assetId || null,
    replacedExisting: summary.replacedExisting === true,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
    translationMode: summary.translationMode || null,
    projectPointerReady: true,
    adapterRequestCapable,
    canWriteAdapterRequest: adapterRequestCapable,
    adapterConfigProvided,
    adapterPreflightOk,
    safeNextExecutionMode: "dry-run",
    availableNextExecutionModes: adapterRequestCapable ? ["adapter-request", "dry-run", "import"] : ["dry-run", "import"],
    recommendedNextAction: referenceImportPlanNextAction({
      translationMode: summary.translationMode,
      replacedExisting: summary.replacedExisting === true,
      adapterConfigProvided,
      adapterPreflightOk
    })
  };
}

function referenceImportPlanNextAction({
  translationMode = null,
  replacedExisting = false,
  adapterConfigProvided = false,
  adapterPreflightOk = null
} = {}) {
  if (translationMode === "external-adapter" && adapterConfigProvided && adapterPreflightOk === false) return "fix-adapter-preflight";
  if (translationMode === "external-adapter" && !adapterConfigProvided) return "write-adapter-request-or-select-adapter-config";
  if (replacedExisting) return "run-dry-run-before-replace-existing";
  return "run-dry-run";
}

function referenceImportAdapterRequestDecision(summary = {}) {
  const preflightDecision = isRecord(summary.adapterPreflightDecision) ? summary.adapterPreflightDecision : null;
  return {
    projectPath: summary.projectPath || null,
    inputPath: summary.inputPath || null,
    referencePath: summary.referencePath || null,
    assetId: summary.assetId || null,
    adapterRequestPath: summary.adapterRequestPath || summary.path || null,
    adapterRequestFingerprint: summary.adapterRequestFingerprint || null,
    adapterRequestEvidenceFingerprint: summary.adapterRequestEvidenceFingerprint || null,
    adapterRunId: summary.adapterRunId || null,
    sourceFormat: summary.sourceFormat || summary.format || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || summary.requestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
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
    projectPointerReady: true,
    adapterRequestReady: true,
    adapterStageDirectoriesReady: true,
    runsTranslator: false,
    launchesAdapter: false,
    writesProjectJson: false,
    writesTargetReferenceManifest: false,
    validatesCanonicalOutput: false,
    outputValidationRequired: true,
    safeNextAction: "run-external-adapter-wrapper",
    recommendedNextAction: "run-external-adapter-and-validate-output"
  };
}

function referenceImportDryRunDecision(summary = {}) {
  return {
    projectPath: summary.projectPath || null,
    inputPath: summary.inputPath || null,
    referencePath: summary.referencePath || null,
    assetId: summary.assetId || null,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
    translationMode: summary.translationMode || null,
    replacedExisting: summary.replacedExisting === true,
    adapterKey: summary.sourceAdapter || summary.adapterKey || null,
    adapterRequestFingerprint: summary.adapterRequestFingerprint || null,
    adapterRequestEvidenceFingerprint: summary.adapterRequestEvidenceFingerprint || null,
    adapterRunId: summary.adapterRunId || null,
    referenceTranslatedManifestFingerprint: summary.referenceTranslatedManifestFingerprint || null,
    referenceTranslatedArtifactFingerprint: summary.referenceTranslatedArtifactFingerprint || null,
    referenceSchema: summary.referenceSchema || null,
    referenceSchemaVersion: summary.referenceSchemaVersion || null,
    referenceUnits: summary.referenceUnits || null,
    referenceObjectCount: Number.isInteger(summary.referenceObjectCount) ? summary.referenceObjectCount : null,
    referenceLineSegmentCount: Number.isInteger(summary.referenceLineSegmentCount) ? summary.referenceLineSegmentCount : null,
    referenceMeshFaceCount: Number.isInteger(summary.referenceMeshFaceCount) ? summary.referenceMeshFaceCount : null,
    referencePointCloudPointCount: Number.isInteger(summary.referencePointCloudPointCount) ? summary.referencePointCloudPointCount : null,
    diagnosticCount: Number.isInteger(summary.diagnosticCount) ? summary.diagnosticCount : null,
    projectPointerReady: true,
    canonicalOutputValidated: true,
    projectJsonUnchanged: true,
    targetReferenceManifestUnchanged: true,
    translatedOutputFingerprintsReady: Boolean(summary.referenceTranslatedManifestFingerprint && summary.referenceTranslatedArtifactFingerprint),
    safeNextExecutionMode: "import",
    recommendedNextAction: summary.replacedExisting === true ? "review-replacement-dry-run-before-import" : "run-import"
  };
}

function referenceImportPromotionDecision(summary = {}) {
  const translatedOutputPromoted = Boolean(
    summary.referenceTranslatedManifestFingerprint
    && summary.referenceTranslatedArtifactFingerprint
    && summary.referenceTranslatedManifestFingerprint === summary.referenceManifestFingerprint
    && summary.referenceTranslatedArtifactFingerprint === summary.referenceArtifactFingerprint
  );
  return {
    projectPath: summary.projectPath || null,
    inputPath: summary.inputPath || null,
    referencePath: summary.referencePath || null,
    assetId: summary.assetId || null,
    sourceFormat: summary.sourceFormat || null,
    sourceRequestedFormat: summary.sourceRequestedFormat || null,
    sourceRequestedFormatFamily: summary.sourceRequestedFormatFamily || null,
    sourceRequestedFormatAliases: Array.isArray(summary.sourceRequestedFormatAliases) ? summary.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: summary.sourceRequestedFormatMatchesFamily ?? null,
    translationMode: summary.translationMode || null,
    replacedExisting: summary.replacedExisting === true,
    adapterKey: summary.sourceAdapter || summary.adapterKey || null,
    adapterRequestFingerprint: summary.adapterRequestFingerprint || null,
    adapterRequestEvidenceFingerprint: summary.adapterRequestEvidenceFingerprint || null,
    adapterRunId: summary.adapterRunId || null,
    referenceManifestFingerprint: summary.referenceManifestFingerprint || null,
    referenceArtifactFingerprint: summary.referenceArtifactFingerprint || null,
    referenceTranslatedManifestFingerprint: summary.referenceTranslatedManifestFingerprint || null,
    referenceTranslatedArtifactFingerprint: summary.referenceTranslatedArtifactFingerprint || null,
    referenceSchema: summary.referenceSchema || null,
    referenceSchemaVersion: summary.referenceSchemaVersion || null,
    referenceUnits: summary.referenceUnits || null,
    referenceObjectCount: Number.isInteger(summary.referenceObjectCount) ? summary.referenceObjectCount : null,
    referenceLineSegmentCount: Number.isInteger(summary.referenceLineSegmentCount) ? summary.referenceLineSegmentCount : null,
    referenceMeshFaceCount: Number.isInteger(summary.referenceMeshFaceCount) ? summary.referenceMeshFaceCount : null,
    referencePointCloudPointCount: Number.isInteger(summary.referencePointCloudPointCount) ? summary.referencePointCloudPointCount : null,
    referenceChunkFileCount: Number.isInteger(summary.referenceChunkFileCount) ? summary.referenceChunkFileCount : null,
    referenceChunkFileMissingCount: Number.isInteger(summary.referenceChunkFileMissingCount) ? summary.referenceChunkFileMissingCount : null,
    diagnosticCount: Number.isInteger(summary.diagnosticCount) ? summary.diagnosticCount : null,
    projectPointerReady: true,
    projectJsonWritten: true,
    projectPointerWritten: true,
    targetReferenceManifestWritten: true,
    targetReferenceManifestValidated: true,
    translatedOutputPromoted,
    promotedOutputFingerprintsReady: Boolean(summary.referenceManifestFingerprint && summary.referenceArtifactFingerprint),
    chunkSidecarsReady: summary.referenceChunkFileMissingCount === 0,
    safeNextAction: "run-check-references",
    recommendedNextAction: summary.replacedExisting === true ? "audit-replaced-reference" : "audit-imported-reference"
  };
}

function selectedReferenceAssets(project, assetId = null) {
  const assets = isRecord(project?.referenceGeometry?.assets) ? project.referenceGeometry.assets : {};
  const safeAssets = Object.fromEntries(Object.entries(assets).filter(([candidateId]) => safeReferenceId(candidateId)));
  if (!assetId) return safeAssets;
  return Object.hasOwn(assets, assetId) ? { [assetId]: assets[assetId] } : {};
}

function projectWithSelectedReferenceAssets(project, assetId = null) {
  const nextProject = cloneJson(project);
  if (!isRecord(nextProject.referenceGeometry)) nextProject.referenceGeometry = {};
  nextProject.referenceGeometry.assets = selectedReferenceAssets(project, assetId);
  return nextProject;
}

function projectReferenceAssetSummary(project, projectPath, assetId = null, referencesDir = DEFAULT_REFERENCES_DIR) {
  const assets = selectedReferenceAssets(project, assetId);
  const absoluteReferencesDir = path.resolve(referencesDir);
  return Object.fromEntries(Object.entries(assets).map(([assetId, asset]) => {
    const assetPath = safeProjectReferenceAuditPath(asset?.path);
    const absoluteReferencePath = assetPath ? path.resolve(path.dirname(projectPath), assetPath) : null;
    const readableReferencePath = projectReferenceManifestPath(projectPath, assetPath, absoluteReferencesDir);
    const summary = {
      assetId,
      path: assetPath,
      resolvedPath: absoluteReferencePath ? repoRelativePath(absoluteReferencePath) : null,
      exists: absoluteReferencePath ? fs.existsSync(absoluteReferencePath) : false,
      referencePathWithinReferencesDir: Boolean(readableReferencePath),
      ...projectReferenceAssetPointerMetadata(asset)
    };
    if (readableReferencePath && fs.existsSync(readableReferencePath)) {
      try {
        Object.assign(summary, referenceFileMetadata(readableReferencePath));
        let reference;
        try {
          reference = readJson(readableReferencePath);
        } catch {
          summary.readError = "reference manifest JSON parse failed";
          return [assetId, summary];
        }
        try {
          validateFile(readableReferencePath);
        } catch {
          summary.readError = "reference manifest schema check failed";
          return [assetId, summary];
        }
        Object.assign(summary, referenceSchemaMetadata(reference));
        if (reference?.schema !== referenceGeometrySchemaName() || reference?.schemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION) {
          return [assetId, summary];
        }
        const source = isRecord(reference.asset?.source) ? reference.asset.source : {};
        summary.manifestAssetId = reference.asset?.id || null;
        summary.sourceFormat = safeReferenceSourceValue(source.format, (value) => REFERENCE_SOURCE_FORMAT_TOKENS.has(value));
        summary.sourceFileName = safeReferenceSourceValue(source.fileName, safeReferenceSourceFileName);
        summary.sourceFileExtension = safeReferenceSourceFileExtensionForFormat(summary.sourceFormat, source.fileExtension);
        summary.sourceRequestedFormat = safeReferenceSourceRequestedFormatForFormat(summary.sourceFormat, source.requestedFormat);
        Object.assign(summary, sourceRequestedFormatFamilyMetadata(summary.sourceFormat, summary.sourceRequestedFormat));
        summary.sourceFileSizeBytes = Number.isInteger(source.fileSizeBytes) && source.fileSizeBytes >= 0 ? source.fileSizeBytes : null;
        summary.sourceFileModifiedTime = safeReferenceSourceValue(source.modifiedTime, safeReferenceSourceModifiedTime);
        summary.sourceStatFingerprint = safeReferenceSourceValue(source.statFingerprint, (value) => REFERENCE_SOURCE_STAT_FINGERPRINT_PATTERN.test(value));
        summary.sourceChecksum = safeReferenceSourceValue(source.checksum, (value) => REFERENCE_SOURCE_CHECKSUM_PATTERN.test(value));
        summary.sourceTranslator = safeReferenceSourceValue(source.translator, safeReferenceSourceTranslator);
        summary.sourceTranslatorVersion = safeReferenceSourceValue(source.translatorVersion, (value) => REFERENCE_SOURCE_TRANSLATOR_VERSION_PATTERN.test(value));
        summary.sourceAdapter = safeReferenceSourceValue(source.adapterKey, (value) => referenceGeometryIdPatternRegex().test(value) && !referenceGeometryIdReservedKeys().includes(value));
        Object.assign(summary, referenceStructureSummary(reference));
        Object.assign(summary, referenceAssetMetadata(reference));
        Object.assign(summary, referencePrimitiveCounts(reference));
        summary.referencePointCloudPointCount = referencePointCloudPointCount(reference);
        Object.assign(summary, referenceChunkFileMetadata(readableReferencePath, reference));
        Object.assign(summary, referenceDiagnosticSummary(reference));
      } catch {
        summary.readError = "reference manifest read failed";
      }
    }
    return [assetId, summary];
  }));
}

function safeProjectReferenceAuditPath(value) {
  return typeof value === "string"
    && value.length > 0
    && value.trim() === value
    && !path.isAbsolute(value)
    && !value.startsWith("//")
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    && !/[\\?#\u0000-\u001f\u007f]/.test(value)
    && !/%(?:2[fF]|5[cC])/.test(value)
    ? value
    : null;
}

function referenceAssetAuditErrors(errors, assetId, summary, selectedAssetCount) {
  const assetPathToken = `referenceGeometry.assets.${assetId}`;
  const manifestPrefix = summary?.resolvedPath ? `${summary.resolvedPath}:` : null;
  const directErrors = (errors || []).filter((error) => {
    const text = String(error || "");
    return text.includes(assetPathToken) || (manifestPrefix && text.startsWith(manifestPrefix));
  });
  if (directErrors.length || selectedAssetCount !== 1) return directErrors;
  return [...(errors || [])];
}

function slashPathToken(value) {
  return String(value || "").replace(/\\/g, "/");
}

function referenceChunkInvalidClassMessage(entry) {
  switch (entry?.reason) {
    case "invalid-json":
      return "point-cloud chunk JSON parse failed";
    case "schema-check-error":
      return "point-cloud chunk schema check failed";
    case "schema-invalid":
      return "point-cloud chunk schema is invalid";
    case "id-mismatch":
      return "point-cloud chunk id does not match manifest chunk id";
    case "object-id-mismatch":
      return "point-cloud chunk objectId does not match manifest objectId";
    case "point-count-mismatch":
      return "point-cloud chunk point count does not match manifest point count";
    case "point-attribute-length-mismatch":
      return "point-cloud chunk pointAttributes length does not match point count";
    case "bounds-manifest-mismatch":
      return "point-cloud chunk bounds do not match manifest bounds";
    case "bounds-payload-mismatch":
      return "point-cloud chunk bounds do not match point payload bounds";
    default:
      return "point-cloud chunk is invalid";
  }
}

function pathFreeReferenceChunkAuditError(assetId, entry) {
  return `referenceGeometry.assets.${assetId}.${slashPathToken(entry.path)}: ${referenceChunkInvalidClassMessage(entry)}`;
}

function pathFreeMissingReferenceChunkAuditError(assetId, entry) {
  const entryPath = slashPathToken(entry?.path || entry?.chunkId || "<unknown>");
  const message = entry?.reason === "unsafe-or-invalid-path"
    ? "point-cloud chunk path is unsafe or invalid"
    : "point-cloud chunk file is missing";
  return `referenceGeometry.assets.${assetId}.${entryPath}: ${message}`;
}

function pathFreeReferenceChunkMetadataAuditError(assetId, entry) {
  const entryPath = slashPathToken(entry?.path || entry?.chunkId || "<unknown>");
  return `referenceGeometry.assets.${assetId}.${entryPath}: point-cloud chunk metadata is not path-free`;
}

function referenceManifestUnsupportedSchemaMessage(summary) {
  const schema = summary?.referenceSchema || summary?.schema || null;
  const schemaVersion = summary?.referenceSchemaVersion || summary?.schemaVersion || null;
  if (!schema) return "";
  if (schema !== referenceGeometrySchemaName()) return "reference manifest schema is unsupported";
  if (schemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION) return "reference manifest schemaVersion is unsupported";
  return "";
}

function referenceManifestAssetIdMismatchMessage(summary) {
  if (!summary?.manifestAssetId || summary.manifestAssetId === summary.assetId) return "";
  return "reference manifest asset id does not match project asset id";
}

function referenceManifestInvalidMessage(error) {
  const text = String(error || "");
  if (/(?:reference )?object [^.]+\.bounds must match object payload bounds/.test(text)) {
    return "reference manifest object bounds do not match object payload bounds";
  }
  if (
    /\$\.asset\.source\.fileName: (?:must match pattern|must be (?:a )?string|must (?:be|contain) at (?:least 1|most 255) characters)/.test(text)
    || /asset\.source\.fileName must be a path-free source basename/.test(text)
  ) {
    return "reference manifest source fileName is not path-free";
  }
  if (
    /\$\.(?:asset|layers\.[^:\s]+|objects\.[^:\s]+)\.name: (?:must match pattern|must be (?:a )?string|must (?:be|contain) at (?:least 1|most 255) characters)/.test(text)
    || /(?:asset|layer|object) [^:]+\.name must be a bounded path-free display name/.test(text)
  ) {
    return "reference manifest display name is not path-free";
  }
  if (
    /\$\.(?:asset\.id|(?:objects|layers)(?:\.|:).*|objects\..*\.(?:id|layer|chunkIds(?:\.\d+|\[\d+\]))|layers\..*\.id|chunks(?:\.\d+|\[\d+\])\.(?:id|objectId)|diagnostics(?:\.\d+|\[\d+\])\.(?:objectId|objectRefs(?:\.\d+|\[\d+\]))): (?:must match pattern|must be (?:a )?string|must (?:be|contain) at least 1 characters|must NOT be valid)/.test(text)
    || /(?:reference )?(?:object|layer|chunk|diagnostic) [^:]+ (?:id|objectId|objectRefs) must use a safe canonical reference id/.test(text)
  ) {
    return "reference manifest id is not path-free";
  }
  if (
    /\$\.diagnostics(?:\.\d+|\[\d+\])\.(?:code|message): (?:must match pattern|must be (?:a )?string|must (?:be|contain) at (?:least 1|most 2048) characters)/.test(text)
    || /diagnostic [^:]+\.(?:code|message) must be bounded path-free/.test(text)
  ) {
    return "reference manifest diagnostic text is not path-free";
  }
  if (
    /\$\.asset\.source\.(?:format|fileExtension|requestedFormat|fileSizeBytes|modifiedTime|statFingerprint|checksum|translator|translatorVersion|adapterKey):/.test(text)
    || /\$\.asset\.source: (?:must (?:match "then" schema|NOT be valid)|matches a forbidden schema)/.test(text)
  ) {
    return "reference manifest source provenance is invalid";
  }
  if (/point-cloud [^.]+\.bounds must match point payload bounds/.test(text)) {
    return "reference manifest point-cloud bounds do not match point payload bounds";
  }
  if (/point-cloud [^.]+\.bounds must match referenced chunk bounds/.test(text)) {
    return "reference manifest point-cloud bounds do not match referenced chunk bounds";
  }
  if (/point-cloud [^.]+\.bounds cannot be verified without complete referenced chunk bounds/.test(text)) {
    return "reference manifest point-cloud bounds cannot be verified";
  }
  if (/point-cloud [^:]+\.pointAttributes(?:\.[A-Za-z]+)? (?:must be an object|has \d+ item\(s\), expected \d+)/.test(text)) {
    return "reference manifest point-cloud pointAttributes do not match point payload";
  }
  if (
    /\$\.objects\.[^:\s]+\.points: must contain at least 1 items/.test(text)
    || /point-cloud [^:]+\.points must contain at least 1 items/.test(text)
  ) {
    return "reference manifest point-cloud points are empty";
  }
  if (
    /\$\.objects\.[^:\s]+\.chunkIds: must contain at least 1 items/.test(text)
    || /point-cloud [^:]+\.chunkIds must contain at least 1 items/.test(text)
  ) {
    return "reference manifest point-cloud chunkIds are empty";
  }
  if (
    /\$\.objects\.[^:\s]+: matches 0 oneOf branches/.test(text)
    || /point-cloud [^:]+ must not mix inline points and chunkIds/.test(text)
    || /point-cloud [^:]+ stores pointAttributes without inline points/.test(text)
  ) {
    return "reference manifest point-cloud storage mode is invalid";
  }
  if (/diagnostics\[\d+\]\.(?:objectId|objectRefs\[\d+\]) [^:]+ points to a missing reference object/.test(text)) {
    return "reference manifest diagnostic object reference is missing";
  }
  if (/(?:reference )?object [^:]+ (?:references|points to) missing layer [^:]+/.test(text)) {
    return "reference manifest object layer is missing";
  }
  if (/\$\.objects\.[^:\s]+: matches a forbidden schema/.test(text)) {
    return "reference manifest object geometry fields do not match object kind";
  }
  if (/object [^:]+\.metadata must be bounded path-free canonical metadata/.test(text)) {
    return "reference manifest object metadata is not path-free";
  }
  if (/reference object [^:]+ from [^:]+ collides with project\.objectIndex/.test(text)) {
    return "reference manifest object id collides with project object index";
  }
  if (/asset\.coordinateSystem\.(?:axisX|axisY|axisZ) must be non-zero/.test(text)) {
    return "reference manifest coordinate system axis is zero";
  }
  if (/asset\.coordinateSystem axes must form a non-degenerate 3D basis/.test(text)) {
    return "reference manifest coordinate system axes are degenerate";
  }
  if (
    /\$\.objects\.[^:\s]+\.lineSegments: must contain at least 1 items/.test(text)
    || /line-set [^:]+\.lineSegments must contain at least 1 items/.test(text)
  ) {
    return "reference manifest line-set segments are empty";
  }
  if (
    /\$\.objects\.[^:\s]+\.vertices: must contain at least 2 items/.test(text)
    || /line-set [^:]+\.vertices must contain at least 2 items/.test(text)
  ) {
    return "reference manifest line-set vertices are too few";
  }
  if (/line-set [^:]+\.lineSegments\[\d+\] must reference two distinct vertices/.test(text)) {
    return "reference manifest line-set segment is degenerate";
  }
  if (/line-set [^:]+\.lineSegments\[\d+\]\[\d+\] index [^:]+ is outside 0\.\.[^:]+/.test(text)) {
    return "reference manifest line-set segment references a missing vertex";
  }
  if (
    /\$\.objects\.[^:\s]+\.faces: must contain at least 1 items/.test(text)
    || /mesh [^:]+\.faces must contain at least 1 items/.test(text)
  ) {
    return "reference manifest mesh faces are empty";
  }
  if (
    /\$\.objects\.[^:\s]+\.vertices: must contain at least 3 items/.test(text)
    || /mesh [^:]+\.vertices must contain at least 3 items/.test(text)
  ) {
    return "reference manifest mesh vertices are too few";
  }
  if (/mesh [^:]+\.faces\[\d+\] must reference at least three distinct vertices/.test(text)) {
    return "reference manifest mesh face is degenerate";
  }
  if (/mesh [^:]+\.faces\[\d+\]\[\d+\] index [^:]+ is outside 0\.\.[^:]+/.test(text)) {
    return "reference manifest mesh face references a missing vertex";
  }
  if (/(?:reference )?layer key [^:]+ (?:must|does not) match id [^:]+/.test(text)) {
    return "reference manifest layer id does not match map key";
  }
  if (/(?:reference )?object key [^:]+ (?:must|does not) match id [^:]+/.test(text)) {
    return "reference manifest object id does not match map key";
  }
  if (/point-cloud [^:]+ references missing chunk [^:]+/.test(text)) {
    return "reference manifest point-cloud chunk reference is missing";
  }
  if (/\$\.objects\.[^:\s]+\.chunkIds: must contain unique items/.test(text)) {
    return "reference manifest point-cloud chunkIds contain duplicates";
  }
  if (/(?:reference )?duplicate chunk id [^:]+/.test(text)) {
    return "reference manifest point-cloud chunk id is duplicated";
  }
  if (
    /chunk [^.]+\.objectId [^:]+ must match point-cloud object [^:]+/.test(text)
    || /point-cloud [^:]+ references chunk [^:]+ owned by [^:]+/.test(text)
  ) {
    return "reference manifest point-cloud chunk owner does not match object";
  }
  if (/chunk [^:]+ points to missing object [^:]+/.test(text)) {
    return "reference manifest point-cloud chunk owner object is missing";
  }
  if (/chunk [^:]+ points to non-point-cloud object [^:]+/.test(text)) {
    return "reference manifest point-cloud chunk owner is not a point-cloud object";
  }
  if (/chunk [^:]+ is not referenced by point-cloud [^:]+\.chunkIds/.test(text)) {
    return "reference manifest point-cloud chunk is not referenced by owner";
  }
  if (/asset\.bounds must match reference object payload bounds/.test(text)) {
    return "reference manifest asset bounds do not match reference object payload bounds";
  }
  if (/asset\.bounds cannot be verified without complete reference object payload bounds/.test(text)) {
    return "reference manifest asset bounds cannot be verified";
  }
  return "";
}

function sanitizedReferenceChunkAuditError(error, assets = {}) {
  const text = String(error || "");
  const slashText = slashPathToken(text);
  for (const [assetId, summary] of Object.entries(assets || {})) {
    const manifestPath = slashPathToken(summary?.resolvedPath || "");
    const manifestDirectory = manifestPath ? path.posix.dirname(manifestPath) : "";
    const entries = Array.isArray(summary?.referenceChunkFileInvalidEntries)
      ? summary.referenceChunkFileInvalidEntries
      : [];
    for (const entry of entries) {
      if (typeof entry.path !== "string" || !entry.path) continue;
      const entryPath = slashPathToken(entry.path);
      const resolvedEntryPath = manifestDirectory ? path.posix.normalize(`${manifestDirectory}/${entryPath}`) : "";
      if (slashText.includes(entryPath) || (resolvedEntryPath && slashText.includes(resolvedEntryPath))) {
        return pathFreeReferenceChunkAuditError(assetId, entry);
      }
    }
    const fileEntries = Array.isArray(summary?.referenceChunkFileEntries)
      ? summary.referenceChunkFileEntries
      : [];
    for (const entry of fileEntries) {
      if (typeof entry.path !== "string" || !entry.path) continue;
      if (!/chunk [^:]+\.metadata must be bounded path-free canonical metadata/.test(text)) continue;
      const entryPath = slashPathToken(entry.path);
      const resolvedEntryPath = manifestDirectory ? path.posix.normalize(`${manifestDirectory}/${entryPath}`) : "";
      if (
        slashText.includes(entryPath)
        || (resolvedEntryPath && slashText.includes(resolvedEntryPath))
        || (entry.chunkId && text.includes(`chunk ${entry.chunkId}.metadata`))
      ) {
        return pathFreeReferenceChunkMetadataAuditError(assetId, entry);
      }
    }
    const missingEntries = Array.isArray(summary?.referenceChunkFileMissingEntries)
      ? summary.referenceChunkFileMissingEntries
      : [];
    for (const entry of missingEntries) {
      if (!["missing-file", "unsafe-or-invalid-path"].includes(entry?.reason)) continue;
      if (typeof entry.path !== "string" || !entry.path) continue;
      const entryPath = slashPathToken(entry.path);
      const resolvedEntryPath = manifestDirectory ? path.posix.normalize(`${manifestDirectory}/${entryPath}`) : "";
      const unsafeChunkPathError = entry.reason === "unsafe-or-invalid-path"
        && manifestPath
        && slashText.includes(manifestPath)
        && (/chunks(?:\.\d+|\[\d+\])\.path/.test(text) || (entry.chunkId && text.includes(`chunk ${entry.chunkId}.path`)));
      if (
        slashText.includes(entryPath)
        || (resolvedEntryPath && slashText.includes(resolvedEntryPath))
        || unsafeChunkPathError
      ) {
        return pathFreeMissingReferenceChunkAuditError(assetId, entry);
      }
    }
  }
  return text;
}

function sanitizedReferenceManifestAuditError(error, assets = {}) {
  const text = String(error || "");
  const slashText = slashPathToken(text);
  for (const [assetId, summary] of Object.entries(assets || {})) {
    if (
      summary?.exists === false
      && text.includes(`referenceGeometry.assets.${assetId}.path points to missing file`)
    ) {
      return `referenceGeometry.assets.${assetId}.path points to missing file`;
    }
    const manifestError = typeof summary?.readError === "string" && summary.readError
      ? summary.readError
      : referenceManifestUnsupportedSchemaMessage(summary)
        || referenceManifestAssetIdMismatchMessage(summary)
        || referenceManifestInvalidMessage(text);
    if (!manifestError) continue;
    const manifestPath = slashPathToken(summary.resolvedPath || "");
    const projectPointerPath = slashPathToken(summary.path || "");
    if (
      (manifestPath && slashText.includes(manifestPath))
      || (projectPointerPath && slashText.includes(projectPointerPath))
      || (/reference object [^:]+ from [^:]+ collides with project\.objectIndex/.test(text) && text.includes(` from ${assetId} `))
    ) {
      return `referenceGeometry.assets.${assetId}.path: ${manifestError}`;
    }
  }
  return text;
}

function sanitizeReferenceAuditErrors(result) {
  result.errors = (Array.isArray(result.errors) ? result.errors : [])
    .map((error) => sanitizedReferenceChunkAuditError(error, result.assets))
    .map((error) => sanitizedReferenceManifestAuditError(error, result.assets));
  return result;
}

function referenceAssetAuditStatus(summary, assetErrors = []) {
  if (!summary?.path) return "missing-path";
  if (!summary.referencePathWithinReferencesDir) return "outside-references-dir";
  if (!summary.exists) return "missing-manifest";
  if (summary.readError) return "read-error";
  if (summary.schema && (summary.schema !== referenceGeometrySchemaName() || summary.schemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION)) {
    return "unsupported-schema";
  }
  if (summary.manifestAssetId && summary.manifestAssetId !== summary.assetId) return "asset-id-mismatch";
  if (summary.referenceChunkFileMissingCount > 0) return "missing-chunks";
  if (summary.referenceChunkFileInvalidCount > 0) return "invalid-reference";
  if (assetErrors.length) return "invalid-reference";
  if (summary.schema === referenceGeometrySchemaName() && summary.schemaVersion === REFERENCE_GEOMETRY_SCHEMA_VERSION) return "ready";
  return "unchecked";
}

function referenceAuditStatusRank(status) {
  return REFERENCE_AUDIT_STATUS_DEFINITIONS[status]?.rank ?? 100;
}

function referenceAuditStatusSeverity(status) {
  return REFERENCE_AUDIT_STATUS_DEFINITIONS[status]?.severity || "error";
}

function referenceAuditStatusDefinitions() {
  return Object.fromEntries(Object.entries(REFERENCE_AUDIT_STATUS_DEFINITIONS).map(([status, definition]) => [
    status,
    {
      rank: definition.rank,
      severity: definition.severity
    }
  ]));
}

function referenceAuditLimits() {
  return {
    assetEntryLimit: REFERENCE_ASSET_ENTRY_LIMIT,
    needsAttentionEntryLimit: REFERENCE_NEEDS_ATTENTION_ENTRY_LIMIT,
    perAssetErrorEntryLimit: REFERENCE_AUDIT_ERROR_ENTRY_LIMIT,
    topLevelErrorEntryLimit: REFERENCE_AUDIT_TOP_LEVEL_ERROR_ENTRY_LIMIT,
    structureSummaryEntryLimit: REFERENCE_SUMMARY_ENTRY_LIMIT,
    chunkFileEntryLimit: REFERENCE_CHUNK_FILE_ENTRY_LIMIT,
    chunkMissingEntryLimit: REFERENCE_CHUNK_MISSING_ENTRY_LIMIT,
    chunkInvalidEntryLimit: REFERENCE_CHUNK_INVALID_ENTRY_LIMIT,
    diagnosticEntryLimit: REFERENCE_DIAGNOSTIC_ENTRY_LIMIT
  };
}

function projectFileAuditMetadata(projectPath) {
  try {
    const metadata = sourceFileMetadata(projectPath, "project file");
    return {
      projectFileName: metadata.sourceFileName,
      projectFileSizeBytes: metadata.sourceFileSizeBytes,
      projectFileModifiedTime: metadata.sourceFileModifiedTime,
      projectStatFingerprint: metadata.sourceStatFingerprint
    };
  } catch {
    return {
      projectFileName: path.basename(projectPath),
      projectFileSizeBytes: null,
      projectFileModifiedTime: null,
      projectStatFingerprint: null
    };
  }
}

function attachReferenceAuditStatus(result) {
  const statusCounts = {};
  const severityCounts = {};
  let readyCount = 0;
  let needsAttentionCount = 0;
  const assetEntries = Object.entries(result.assets || {});
  for (const [assetId, summary] of assetEntries) {
    const assetErrors = referenceAssetAuditErrors(result.errors, assetId, summary, assetEntries.length);
    const status = referenceAssetAuditStatus(summary, assetErrors);
    const severity = referenceAuditStatusSeverity(status);
    summary.referenceAuditStatus = status;
    summary.referenceAuditStatusRank = referenceAuditStatusRank(status);
    summary.referenceAuditSeverity = severity;
    summary.referenceReady = status === "ready";
    summary.referenceAuditErrorCount = assetErrors.length;
    summary.referenceAuditErrorEntries = assetErrors.slice(0, REFERENCE_AUDIT_ERROR_ENTRY_LIMIT);
    summary.referenceAuditErrorOmittedCount = Math.max(0, assetErrors.length - summary.referenceAuditErrorEntries.length);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    if (summary.referenceReady) readyCount += 1;
    else needsAttentionCount += 1;
  }
  if (requestedReferenceAssetMissing(result)) {
    statusCounts["missing-asset"] = (statusCounts["missing-asset"] || 0) + 1;
    severityCounts.error = (severityCounts.error || 0) + 1;
  }
  result.referenceReadyCount = readyCount;
  result.referenceNeedsAttentionCount = needsAttentionCount;
  result.referenceAuditStatusCounts = statusCounts;
  result.referenceAuditSeverityCounts = severityCounts;
  return result;
}

function incrementCount(counts, key) {
  if (typeof key !== "string" || !key) return;
  counts[key] = (counts[key] || 0) + 1;
}

function addFiniteCount(aggregate, key, value) {
  if (!Number.isFinite(value)) return;
  aggregate[key] += value;
}

function attachReferenceAggregate(result) {
  const aggregate = {
    selectedAssetCount: Object.keys(result.assets || {}).length,
    readyAssetCount: result.referenceReadyCount || 0,
    needsAttentionAssetCount: result.referenceNeedsAttentionCount || 0,
    canonicalManifestCount: 0,
    readyCanonicalManifestCount: 0,
    objectCount: 0,
    layerCount: 0,
    chunkCount: 0,
    lineSegmentCount: 0,
    meshFaceCount: 0,
    pointCloudPointCount: 0,
    chunkFileCount: 0,
    chunkFileSizeBytes: 0,
    chunkFileMissingCount: 0,
    chunkFileInvalidCount: 0,
    chunkPointCount: 0,
    diagnosticCount: 0,
    auditStatusCounts: { ...(result.referenceAuditStatusCounts || {}) },
    auditSeverityCounts: { ...(result.referenceAuditSeverityCounts || {}) },
    sourceFormatCounts: {},
    sourceAdapterCounts: {},
    objectKindCounts: {}
  };
  for (const summary of Object.values(result.assets || {})) {
    if (summary?.referenceSchema !== referenceGeometrySchemaName() || summary.referenceSchemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION) continue;
    aggregate.canonicalManifestCount += 1;
    if (summary.referenceReady) aggregate.readyCanonicalManifestCount += 1;
    addFiniteCount(aggregate, "objectCount", summary.referenceObjectCount);
    addFiniteCount(aggregate, "layerCount", summary.referenceLayerCount);
    addFiniteCount(aggregate, "chunkCount", summary.referenceChunkCount);
    addFiniteCount(aggregate, "lineSegmentCount", summary.referenceLineSegmentCount);
    addFiniteCount(aggregate, "meshFaceCount", summary.referenceMeshFaceCount);
    addFiniteCount(aggregate, "pointCloudPointCount", summary.referencePointCloudPointCount);
    addFiniteCount(aggregate, "chunkFileCount", summary.referenceChunkFileCount);
    addFiniteCount(aggregate, "chunkFileSizeBytes", summary.referenceChunkFileSizeBytes);
    addFiniteCount(aggregate, "chunkFileMissingCount", summary.referenceChunkFileMissingCount);
    addFiniteCount(aggregate, "chunkFileInvalidCount", summary.referenceChunkFileInvalidCount);
    addFiniteCount(aggregate, "chunkPointCount", summary.referenceChunkPointCount);
    addFiniteCount(aggregate, "diagnosticCount", summary.diagnosticCount);
    incrementCount(aggregate.sourceFormatCounts, summary.sourceFormat);
    incrementCount(aggregate.sourceAdapterCounts, summary.sourceAdapter || "built-in-or-none");
    for (const [kind, count] of Object.entries(summary.referenceObjectKindCounts || {})) {
      if (Number.isFinite(count)) aggregate.objectKindCounts[kind] = (aggregate.objectKindCounts[kind] || 0) + count;
    }
  }
  result.referenceAggregate = aggregate;
  return result;
}

function referenceAssetEntry(assetId, summary = {}) {
  return {
    assetId,
    path: summary.path || null,
    resolvedPath: summary.resolvedPath || null,
    referenceReady: summary.referenceReady ?? null,
    referenceAuditStatus: summary.referenceAuditStatus || null,
    referenceAuditStatusRank: Number.isFinite(summary.referenceAuditStatusRank) ? summary.referenceAuditStatusRank : null,
    referenceAuditSeverity: summary.referenceAuditSeverity || null,
    referencePathWithinReferencesDir: summary.referencePathWithinReferencesDir ?? null,
    exists: summary.exists ?? null,
    visible: summary.projectReferenceVisible ?? null,
    snapEnabled: summary.projectReferenceSnapEnabled ?? null,
    displayColor: summary.projectReferenceDisplayColor || null,
    displayEdgeColor: summary.projectReferenceDisplayEdgeColor || null,
    displayOpacity: Number.isFinite(summary.projectReferenceDisplayOpacity) ? summary.projectReferenceDisplayOpacity : null,
    displayPointSize: Number.isFinite(summary.projectReferenceDisplayPointSize) ? summary.projectReferenceDisplayPointSize : null,
    transformOrigin: Array.isArray(summary.projectReferenceTransformOrigin) ? summary.projectReferenceTransformOrigin : null,
    transformAxisX: Array.isArray(summary.projectReferenceTransformAxisX) ? summary.projectReferenceTransformAxisX : null,
    transformAxisY: Array.isArray(summary.projectReferenceTransformAxisY) ? summary.projectReferenceTransformAxisY : null,
    transformAxisZ: Array.isArray(summary.projectReferenceTransformAxisZ) ? summary.projectReferenceTransformAxisZ : null,
    transformScale: Number.isFinite(summary.projectReferenceTransformScale) ? summary.projectReferenceTransformScale : null,
    sourceFormat: summary.sourceFormat || null,
    sourceAdapter: summary.sourceAdapter || null,
    manifestAssetId: summary.manifestAssetId || null,
    referenceSchema: summary.referenceSchema || null,
    referenceSchemaVersion: summary.referenceSchemaVersion || null,
    referenceManifestFingerprint: summary.referenceManifestFingerprint || null,
    referenceArtifactFingerprint: summary.referenceArtifactFingerprint || null,
    referenceObjectCount: Number.isFinite(summary.referenceObjectCount) ? summary.referenceObjectCount : null,
    referenceLayerCount: Number.isFinite(summary.referenceLayerCount) ? summary.referenceLayerCount : null,
    referenceChunkCount: Number.isFinite(summary.referenceChunkCount) ? summary.referenceChunkCount : null,
    referenceLineSegmentCount: Number.isFinite(summary.referenceLineSegmentCount) ? summary.referenceLineSegmentCount : null,
    referenceMeshFaceCount: Number.isFinite(summary.referenceMeshFaceCount) ? summary.referenceMeshFaceCount : null,
    referencePointCloudPointCount: Number.isFinite(summary.referencePointCloudPointCount) ? summary.referencePointCloudPointCount : null,
    referenceChunkFileMissingCount: Number.isFinite(summary.referenceChunkFileMissingCount) ? summary.referenceChunkFileMissingCount : null,
    referenceChunkFileInvalidCount: Number.isFinite(summary.referenceChunkFileInvalidCount) ? summary.referenceChunkFileInvalidCount : null,
    diagnosticCount: Number.isFinite(summary.diagnosticCount) ? summary.diagnosticCount : null,
    referenceAuditErrorCount: Number.isFinite(summary.referenceAuditErrorCount) ? summary.referenceAuditErrorCount : null
  };
}

function attachReferenceAssetEntries(result) {
  const entries = Object.entries(result.assets || {}).map(([assetId, summary]) => referenceAssetEntry(assetId, summary));
  result.referenceAssetEntries = entries.slice(0, REFERENCE_ASSET_ENTRY_LIMIT);
  result.referenceAssetEntryOmittedCount = Math.max(0, entries.length - result.referenceAssetEntries.length);
  return result;
}

function referenceNeedsAttentionEntry(assetId, summary = {}) {
  return {
    assetId,
    path: summary.path || null,
    resolvedPath: summary.resolvedPath || null,
    referenceReady: summary.referenceReady ?? null,
    referenceAuditStatus: summary.referenceAuditStatus || null,
    referenceAuditStatusRank: Number.isFinite(summary.referenceAuditStatusRank) ? summary.referenceAuditStatusRank : null,
    referenceAuditSeverity: summary.referenceAuditSeverity || null,
    referencePathWithinReferencesDir: summary.referencePathWithinReferencesDir ?? null,
    exists: summary.exists ?? null,
    readError: summary.readError || null,
    manifestAssetId: summary.manifestAssetId || null,
    referenceSchema: summary.referenceSchema || null,
    referenceSchemaVersion: summary.referenceSchemaVersion || null,
    referenceChunkFileMissingCount: Number.isFinite(summary.referenceChunkFileMissingCount) ? summary.referenceChunkFileMissingCount : null,
    referenceChunkFileInvalidCount: Number.isFinite(summary.referenceChunkFileInvalidCount) ? summary.referenceChunkFileInvalidCount : null,
    referenceChunkFileInvalidEntries: Array.isArray(summary.referenceChunkFileInvalidEntries) ? summary.referenceChunkFileInvalidEntries : [],
    referenceChunkFileInvalidOmittedCount: Number.isFinite(summary.referenceChunkFileInvalidOmittedCount) ? summary.referenceChunkFileInvalidOmittedCount : 0,
    referenceAuditErrorCount: Number.isFinite(summary.referenceAuditErrorCount) ? summary.referenceAuditErrorCount : null,
    referenceAuditErrorEntries: Array.isArray(summary.referenceAuditErrorEntries) ? summary.referenceAuditErrorEntries : [],
    referenceAuditErrorOmittedCount: Number.isFinite(summary.referenceAuditErrorOmittedCount) ? summary.referenceAuditErrorOmittedCount : 0
  };
}

function attachReferenceNeedsAttentionEntries(result) {
  const entries = Object.entries(result.assets || {})
    .filter(([, summary]) => summary?.referenceReady !== true)
    .sort(([leftAssetId, leftSummary], [rightAssetId, rightSummary]) => {
      const rankDelta = (rightSummary?.referenceAuditStatusRank ?? -1) - (leftSummary?.referenceAuditStatusRank ?? -1);
      if (rankDelta) return rankDelta;
      return leftAssetId.localeCompare(rightAssetId);
    })
    .map(([assetId, summary]) => referenceNeedsAttentionEntry(assetId, summary));
  result.referenceNeedsAttentionEntries = entries.slice(0, REFERENCE_NEEDS_ATTENTION_ENTRY_LIMIT);
  result.referenceNeedsAttentionEntryOmittedCount = Math.max(0, entries.length - result.referenceNeedsAttentionEntries.length);
  return result;
}

function referenceAuditErrorEntry(error) {
  return boundedText(typeof error === "string" ? error : String(error ?? ""), 320);
}

function attachReferenceErrorSummary(result) {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  result.referenceAuditErrorCount = errors.length;
  result.referenceAuditErrorEntries = errors
    .slice(0, REFERENCE_AUDIT_TOP_LEVEL_ERROR_ENTRY_LIMIT)
    .map(referenceAuditErrorEntry);
  result.referenceAuditErrorOmittedCount = Math.max(0, errors.length - result.referenceAuditErrorEntries.length);
  return result;
}

function referenceAuditLikelyFixArea(statuses = []) {
  const uniqueStatuses = new Set(statuses);
  if (!uniqueStatuses.size) return "none";
  const pointerStatuses = new Set(["missing-asset", "missing-path", "outside-references-dir", "missing-manifest", "asset-id-mismatch", "unchecked"]);
  const canonicalStatuses = new Set(["unsupported-schema", "missing-chunks", "invalid-reference", "read-error"]);
  let hasPointer = false;
  let hasCanonical = false;
  for (const status of uniqueStatuses) {
    if (pointerStatuses.has(status)) hasPointer = true;
    if (canonicalStatuses.has(status)) hasCanonical = true;
    if (!pointerStatuses.has(status) && !canonicalStatuses.has(status)) {
      hasPointer = true;
      hasCanonical = true;
    }
  }
  if (hasPointer && hasCanonical) return "mixed";
  if (hasCanonical) return "canonical-reference";
  return "project-pointer";
}

function requestedReferenceAssetMissing(result = {}) {
  if (!result.requestedAssetId || result.referenceAssetCount !== 0) return false;
  const token = `referenceGeometry.assets.${result.requestedAssetId} does not exist`;
  return (result.errors || []).some((error) => String(error || "").includes(token));
}

function referenceAuditRecommendedNextAction({
  referenceOverlayReady = false,
  referenceAssetCount = 0,
  referenceAuditErrorCount = 0,
  likelyFixArea = "none"
} = {}) {
  if (referenceOverlayReady) return "use-reference-overlays";
  if (referenceAssetCount === 0 && referenceAuditErrorCount === 0) return "import-reference-geometry";
  if (likelyFixArea === "canonical-reference") return "fix-canonical-reference-output";
  if (likelyFixArea === "project-pointer") return "fix-project-reference-pointer";
  return "fix-reference-audit-findings";
}

function referenceAuditDecision(result = {}) {
  const needsAttentionEntries = Array.isArray(result.referenceNeedsAttentionEntries) ? result.referenceNeedsAttentionEntries : [];
  const blockingStatuses = Object.entries(result.referenceAuditStatusCounts || {})
    .filter(([status, count]) => status !== "ready" && Number.isFinite(count) && count > 0)
    .map(([status]) => status)
    .sort((left, right) => referenceAuditStatusRank(right) - referenceAuditStatusRank(left) || left.localeCompare(right));
  const highestPriorityEntry = needsAttentionEntries[0] || null;
  const referenceAssetCount = Number.isInteger(result.referenceAssetCount) ? result.referenceAssetCount : 0;
  const referenceReadyCount = Number.isInteger(result.referenceReadyCount) ? result.referenceReadyCount : 0;
  const referenceNeedsAttentionCount = Number.isInteger(result.referenceNeedsAttentionCount) ? result.referenceNeedsAttentionCount : 0;
  const referenceAuditErrorCount = Number.isInteger(result.referenceAuditErrorCount) ? result.referenceAuditErrorCount : 0;
  const missingRequestedAsset = requestedReferenceAssetMissing(result);
  const auditPassed = result.ok === true && referenceAuditErrorCount === 0;
  const referenceOverlayReady = auditPassed
    && referenceAssetCount > 0
    && referenceNeedsAttentionCount === 0
    && referenceReadyCount === referenceAssetCount;
  const likelyFixArea = referenceAuditLikelyFixArea(blockingStatuses);
  const highestPriorityStatus = highestPriorityEntry?.referenceAuditStatus || blockingStatuses[0] || null;
  return {
    projectPath: result.projectPath || null,
    requestedAssetId: result.requestedAssetId || null,
    referenceAssetCount,
    referenceReadyCount,
    referenceNeedsAttentionCount,
    referenceAuditErrorCount,
    auditPassed,
    referenceOverlayReady,
    blockingStatuses,
    highestPriorityStatus,
    highestPrioritySeverity: highestPriorityEntry?.referenceAuditSeverity || (highestPriorityStatus ? referenceAuditStatusSeverity(highestPriorityStatus) : null),
    highestPriorityAssetId: highestPriorityEntry?.assetId || (missingRequestedAsset ? result.requestedAssetId : null),
    likelyFixArea,
    safeNextAction: referenceOverlayReady ? "load-reference-overlays" : "review-reference-audit",
    recommendedNextAction: referenceAuditRecommendedNextAction({
      referenceOverlayReady,
      referenceAssetCount,
      referenceAuditErrorCount,
      likelyFixArea
    })
  };
}

function attachReferenceAuditDecision(result) {
  result.referenceAuditDecision = referenceAuditDecision(result);
  return result;
}

function referenceAuditFingerprint(result) {
  const assetEntries = Object.entries(result.assets || {})
    .map(([assetId, summary]) => ({
      assetId,
      path: summary?.path || null,
      exists: summary?.exists ?? null,
      referencePathWithinReferencesDir: summary?.referencePathWithinReferencesDir ?? null,
      referenceAuditStatus: summary?.referenceAuditStatus || null,
      referenceAuditStatusRank: Number.isFinite(summary?.referenceAuditStatusRank) ? summary.referenceAuditStatusRank : null,
      referenceAuditSeverity: summary?.referenceAuditSeverity || null,
      referenceReady: summary?.referenceReady ?? null,
      projectReferenceVisible: summary?.projectReferenceVisible ?? null,
      projectReferenceSnapEnabled: summary?.projectReferenceSnapEnabled ?? null,
      projectReferenceDisplayColor: summary?.projectReferenceDisplayColor || null,
      projectReferenceDisplayEdgeColor: summary?.projectReferenceDisplayEdgeColor || null,
      projectReferenceDisplayOpacity: Number.isFinite(summary?.projectReferenceDisplayOpacity) ? summary.projectReferenceDisplayOpacity : null,
      projectReferenceDisplayPointSize: Number.isFinite(summary?.projectReferenceDisplayPointSize) ? summary.projectReferenceDisplayPointSize : null,
      projectReferenceTransformOrigin: Array.isArray(summary?.projectReferenceTransformOrigin) ? summary.projectReferenceTransformOrigin : null,
      projectReferenceTransformAxisX: Array.isArray(summary?.projectReferenceTransformAxisX) ? summary.projectReferenceTransformAxisX : null,
      projectReferenceTransformAxisY: Array.isArray(summary?.projectReferenceTransformAxisY) ? summary.projectReferenceTransformAxisY : null,
      projectReferenceTransformAxisZ: Array.isArray(summary?.projectReferenceTransformAxisZ) ? summary.projectReferenceTransformAxisZ : null,
      projectReferenceTransformScale: Number.isFinite(summary?.projectReferenceTransformScale) ? summary.projectReferenceTransformScale : null,
      referenceSchema: summary?.referenceSchema || null,
      referenceSchemaVersion: summary?.referenceSchemaVersion || null,
      manifestAssetId: summary?.manifestAssetId || null,
      referenceManifestFingerprint: summary?.referenceManifestFingerprint || null,
      referenceChunkFileSetFingerprint: summary?.referenceChunkFileSetFingerprint || null,
      referenceArtifactFingerprint: summary?.referenceArtifactFingerprint || null,
      referenceChunkFileMissingCount: Number.isFinite(summary?.referenceChunkFileMissingCount) ? summary.referenceChunkFileMissingCount : null,
      referenceChunkFileInvalidCount: Number.isFinite(summary?.referenceChunkFileInvalidCount) ? summary.referenceChunkFileInvalidCount : null,
      referenceObjectCount: Number.isFinite(summary?.referenceObjectCount) ? summary.referenceObjectCount : null,
      referenceLayerCount: Number.isFinite(summary?.referenceLayerCount) ? summary.referenceLayerCount : null,
      referenceChunkCount: Number.isFinite(summary?.referenceChunkCount) ? summary.referenceChunkCount : null,
      diagnosticCount: Number.isFinite(summary?.diagnosticCount) ? summary.diagnosticCount : null,
      referenceAuditErrorCount: Number.isFinite(summary?.referenceAuditErrorCount) ? summary.referenceAuditErrorCount : null
    }))
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify({
    referenceAuditContractVersion: result.referenceAuditContractVersion || null,
    referenceAuditLimits: result.referenceAuditLimits || null,
    requestedAssetId: result.requestedAssetId || null,
    referenceAssetCount: result.referenceAssetCount || 0,
    referenceReadyCount: result.referenceReadyCount || 0,
    referenceNeedsAttentionCount: result.referenceNeedsAttentionCount || 0,
    referenceAuditStatusCounts: result.referenceAuditStatusCounts || {},
    referenceAuditSeverityCounts: result.referenceAuditSeverityCounts || {},
    referenceAggregate: result.referenceAggregate || null,
    referenceAuditErrorCount: result.referenceAuditErrorCount || 0,
    referenceAuditErrorEntries: result.referenceAuditErrorEntries || [],
    referenceAuditErrorOmittedCount: result.referenceAuditErrorOmittedCount || 0,
    assets: assetEntries
  })).digest("hex")}`;
}

function attachReferenceAuditFingerprint(result) {
  result.referenceAuditFingerprint = referenceAuditFingerprint(result);
  return result;
}

function referenceAuditSummaryOnlyDecision(decision = {}) {
  if (!isRecord(decision)) return decision;
  const { projectPath, ...summaryOnlyDecision } = decision;
  return summaryOnlyDecision;
}

function referenceAuditSummaryOnlyEntry(entry = {}) {
  if (!isRecord(entry)) return entry;
  const { resolvedPath, ...summaryOnlyEntry } = entry;
  return summaryOnlyEntry;
}

function finalizeReferenceCheckResult(result) {
  result.referenceAuditContractVersion = REFERENCE_AUDIT_CONTRACT_VERSION;
  result.referenceAuditLimits = referenceAuditLimits();
  result.referenceAuditStatusDefinitions = referenceAuditStatusDefinitions();
  return attachReferenceImportWorkflowStatus(attachReferenceAuditDecision(
    attachReferenceAuditFingerprint(
      attachReferenceErrorSummary(
        attachReferenceNeedsAttentionEntries(
          attachReferenceAssetEntries(
            attachReferenceAggregate(
              attachReferenceAuditStatus(result)
            )
          )
        )
      )
    )
  ), "check-references");
}

function referenceAuditSummaryOnlyResult(result) {
  return {
    ok: result.ok,
    requestedAssetId: result.requestedAssetId,
    summaryOnly: true,
    projectFileName: result.projectFileName,
    projectFileSizeBytes: result.projectFileSizeBytes,
    projectFileModifiedTime: result.projectFileModifiedTime,
    projectStatFingerprint: result.projectStatFingerprint,
    referenceAuditContractVersion: result.referenceAuditContractVersion,
    referenceAuditLimits: result.referenceAuditLimits,
    referenceAssetCount: result.referenceAssetCount,
    referenceReadyCount: result.referenceReadyCount,
    referenceNeedsAttentionCount: result.referenceNeedsAttentionCount,
    referenceAuditStatusCounts: result.referenceAuditStatusCounts,
    referenceAuditSeverityCounts: result.referenceAuditSeverityCounts,
    referenceAuditStatusDefinitions: result.referenceAuditStatusDefinitions,
    referenceAuditDecision: referenceAuditSummaryOnlyDecision(result.referenceAuditDecision),
    referenceImportWorkflowStatus: result.referenceImportWorkflowStatus,
    referenceAggregate: result.referenceAggregate,
    referenceAssetEntries: Array.isArray(result.referenceAssetEntries)
      ? result.referenceAssetEntries.map(referenceAuditSummaryOnlyEntry)
      : result.referenceAssetEntries,
    referenceAssetEntryOmittedCount: result.referenceAssetEntryOmittedCount,
    referenceNeedsAttentionEntries: Array.isArray(result.referenceNeedsAttentionEntries)
      ? result.referenceNeedsAttentionEntries.map(referenceAuditSummaryOnlyEntry)
      : result.referenceNeedsAttentionEntries,
    referenceNeedsAttentionEntryOmittedCount: result.referenceNeedsAttentionEntryOmittedCount,
    referenceAuditErrorCount: result.referenceAuditErrorCount,
    referenceAuditErrorEntries: result.referenceAuditErrorEntries,
    referenceAuditErrorOmittedCount: result.referenceAuditErrorOmittedCount,
    referenceAuditFingerprint: result.referenceAuditFingerprint,
    errors: result.errors
  };
}

function referenceAuditJsonPathLabel(parts = []) {
  if (!Array.isArray(parts) || !parts.length) return "$";
  return `$${parts.map((part, index) => {
    if (typeof part === "number") return `[${part}]`;
    if (
      index === 2
      && parts[0] === "referenceGeometry"
      && parts[1] === "assets"
      && !safeReferenceId(part)
    ) {
      return `.${REFERENCE_INVALID_PROJECT_ASSET_ID_JSONPATH_TOKEN}`;
    }
    if (
      index === 3
      && parts[0] === "referenceGeometry"
      && parts[1] === "assets"
      && !projectReferenceGeometryAssetFields().includes(part)
    ) {
      return `.${REFERENCE_INVALID_PROJECT_ASSET_FIELD_JSONPATH_TOKEN}`;
    }
    if (
      index === 4
      && parts[0] === "referenceGeometry"
      && parts[1] === "assets"
      && parts[3] === "transform"
      && !projectReferenceGeometryTransformFields().includes(part)
    ) {
      return `.${REFERENCE_INVALID_PROJECT_TRANSFORM_FIELD_JSONPATH_TOKEN}`;
    }
    return `.${part}`;
  }).join("")}`;
}

function referenceAuditSchemaValidationMessages(schemaResult, label) {
  return (schemaResult?.errors || [])
    .map((error) => `${label} ${referenceAuditJsonPathLabel(error?.path)}: ${error?.message || "schema validation failed"}`);
}

export function checkProjectReferenceGeometry({ projectPath, assetId = null, referencesDir = DEFAULT_REFERENCES_DIR }) {
  const absoluteProjectPath = path.resolve(projectPath);
  const absoluteReferencesDir = path.resolve(referencesDir);
  const requestedAssetId = normalizedExplicitReferenceAssetId(assetId);
  const result = {
    ok: false,
    projectPath: absoluteProjectPath,
    referencesDir: absoluteReferencesDir,
    requestedAssetId,
    ...projectFileAuditMetadata(absoluteProjectPath),
    referenceAssetCount: 0,
    assets: {},
    errors: []
  };
  let projectSchemaCheckError = null;
  try {
    const schemaResult = validateFile(absoluteProjectPath);
    if (schemaResult.errors.length) {
      result.errors.push(...referenceAuditSchemaValidationMessages(schemaResult, "project JSON"));
    }
  } catch {
    projectSchemaCheckError = "project JSON schema check failed";
  }
  let project;
  try {
    project = readJson(absoluteProjectPath);
  } catch {
    result.errors.push("project JSON parse failed");
    return finalizeReferenceCheckResult(result);
  }
  if (projectSchemaCheckError) result.errors.push(projectSchemaCheckError);
  if (requestedAssetId && !Object.hasOwn(selectedReferenceAssets(project), requestedAssetId)) {
    result.errors.push(`referenceGeometry.assets.${requestedAssetId} does not exist`);
  }
  result.assets = projectReferenceAssetSummary(project, absoluteProjectPath, requestedAssetId, absoluteReferencesDir);
  result.referenceAssetCount = Object.keys(result.assets).length;
  const referenceErrors = [];
  validateReferenceGeometry(referenceErrors, repoRelativePath(absoluteProjectPath), projectWithSelectedReferenceAssets(project, requestedAssetId), absoluteProjectPath, absoluteReferencesDir);
  result.errors.push(...referenceErrors);
  sanitizeReferenceAuditErrors(result);
  result.ok = result.errors.length === 0;
  return finalizeReferenceCheckResult(result);
}

function uniqueAssetId(project, base) {
  const assets = project.referenceGeometry?.assets || {};
  if (!Object.hasOwn(assets, base)) return base;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!Object.hasOwn(assets, candidate)) return candidate;
  }
  throw new Error(`Unable to create unique reference asset id from ${base}`);
}

function targetAssetId(project, requestedId, replaceExisting, { explicit = false } = {}) {
  const base = explicit
    ? normalizedExplicitReferenceAssetId(requestedId)
    : sanitizeId(requestedId);
  return replaceExisting ? base : uniqueAssetId(project, base);
}

function assertProjectShape(project, projectPath) {
  if (!project || typeof project !== "object" || Array.isArray(project)) throw new Error(`${projectPath}: project must be a JSON object`);
  if (project.schema !== "steel-bim-project") throw new Error(`${projectPath}: expected steel-bim-project`);
  if (!project.model || typeof project.model !== "object" || Array.isArray(project.model)) throw new Error(`${projectPath}: project.model must be an object`);
  if (!project.objectIndex || typeof project.objectIndex !== "object" || Array.isArray(project.objectIndex)) throw new Error(`${projectPath}: project.objectIndex must be an object`);
}

function referenceOutputPath(referencesDir, assetId) {
  return path.join(path.resolve(referencesDir), `${assetId}.reference.json`);
}

function createDryRunOutputPath(targetPath) {
  const dryRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "bobercad-reference-import-dry-run-"));
  return {
    dryRunDir,
    outputPath: path.join(dryRunDir, path.basename(path.resolve(targetPath)))
  };
}

function parseVec3(value, label) {
  if (value === undefined) return undefined;
  const items = Array.isArray(value) ? value : String(value).split(",");
  if (items.length !== 3) throw referenceMetadataError(`${label} must contain exactly three numbers`, "reference-vector-invalid");
  const result = items.map((item) => Number(item));
  if (!result.every(Number.isFinite)) throw referenceMetadataError(`${label} must contain finite numbers`, "reference-vector-invalid");
  return result;
}

function parseBoolean(value, label, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw referenceMetadataError(`${label} must be true or false`, "cli-boolean-invalid");
}

function stagePreservationOptionNamesFromArgs(args) {
  const optionNames = [];
  if (parseBoolean(args.keepStage, "keepStage", false)) optionNames.push("--keep-stage");
  if (parseBoolean(args.keepStageOnError, "keepStageOnError", false)) optionNames.push("--keep-stage-on-error");
  return optionNames;
}

function adapterRunOptionNamesFromArgs(args) {
  const optionNames = [];
  if (args.adapterTimeoutMs !== undefined && args.adapterTimeoutMs !== null) optionNames.push("--adapter-timeout-ms");
  optionNames.push(...stagePreservationOptionNamesFromArgs(args));
  return optionNames;
}

function finiteNumber(value, label) {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw referenceMetadataError(`${label} must be a finite number`, "reference-number-invalid");
  return number;
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label);
  if (number === undefined) return undefined;
  if (number <= 0) throw referenceMetadataError(`${label} must be greater than zero`, "reference-positive-number-invalid");
  return number;
}

function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function assertReferenceTransformBasis(transform) {
  for (const key of ["axisX", "axisY", "axisZ"]) {
    if (vecLength(transform[key]) <= 1e-9) throw referenceMetadataError(`reference transform ${key} must be non-zero`, "reference-transform-invalid");
  }
  const determinant = vecDot(vecCross(transform.axisX, transform.axisY), transform.axisZ);
  if (Math.abs(determinant) <= 1e-9) throw referenceMetadataError("reference transform axes must form a non-degenerate 3D basis", "reference-transform-invalid");
}

function normalizedColor(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const color = String(value);
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw referenceMetadataError(`${label} must be a #RRGGBB color`, "reference-color-invalid");
  return color;
}

function definedEntries(value = {}) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function referenceTransform(transform = {}) {
  const result = {
    origin: parseVec3(transform.origin, "reference transform origin") || [0, 0, 0],
    axisX: parseVec3(transform.axisX, "reference transform axisX") || [1, 0, 0],
    axisY: parseVec3(transform.axisY, "reference transform axisY") || [0, 1, 0],
    axisZ: parseVec3(transform.axisZ, "reference transform axisZ") || [0, 0, 1],
    scale: positiveNumber(transform.scale, "reference transform scale") || 1
  };
  assertReferenceTransformBasis(result);
  return result;
}

function referenceDisplay(display = {}) {
  const result = {};
  const opacity = finiteNumber(display.opacity, "reference display opacity");
  if (opacity !== undefined) {
    if (opacity < 0 || opacity > 1) throw referenceMetadataError("reference display opacity must be between 0 and 1", "reference-opacity-invalid");
    result.opacity = opacity;
  } else {
    result.opacity = 0.42;
  }
  const color = normalizedColor(display.color, "reference display color");
  if (color) result.color = color;
  const edgeColor = normalizedColor(display.edgeColor, "reference display edgeColor");
  if (edgeColor) result.edgeColor = edgeColor;
  const pointSize = positiveNumber(display.pointSize, "reference display pointSize");
  if (pointSize !== undefined) result.pointSize = pointSize;
  return result;
}

function referenceObjectKindCounts(reference) {
  const counts = {};
  for (const object of Object.values(reference?.objects || {})) {
    const kind = typeof object?.kind === "string" && REFERENCE_OBJECT_KIND_TOKENS.has(object.kind)
      ? object.kind
      : null;
    if (!kind) continue;
    counts[kind] = (counts[kind] || 0) + 1;
  }
  return counts;
}

function referenceDiagnosticSummary(reference) {
  const diagnostics = Array.isArray(reference?.diagnostics) ? reference.diagnostics : [];
  const boundedDiagnostics = boundedEntries(diagnostics, REFERENCE_DIAGNOSTIC_ENTRY_LIMIT);
  return {
    diagnosticCount: diagnostics.length,
    diagnosticSeverityCounts: Object.fromEntries(diagnostics.reduce((counts, diagnostic) => {
      const severity = REFERENCE_DIAGNOSTIC_SEVERITY_TOKENS.has(diagnostic?.severity) ? diagnostic.severity : "unknown";
      counts.set(severity, (counts.get(severity) || 0) + 1);
      return counts;
    }, new Map())),
    diagnosticCodeCounts: Object.fromEntries(diagnostics.reduce((counts, diagnostic) => {
      const code = typeof diagnostic?.code === "string" && REFERENCE_DIAGNOSTIC_CODE_PATTERN.test(diagnostic.code)
        ? diagnostic.code
        : "unknown";
      counts.set(code, (counts.get(code) || 0) + 1);
      return counts;
    }, new Map())),
    diagnosticEntries: boundedDiagnostics.entries.map(referenceDiagnosticEntry),
    diagnosticOmittedCount: boundedDiagnostics.omittedCount
  };
}

function boundedEntries(entries, limit) {
  const values = Array.isArray(entries) ? entries : [];
  return {
    entries: values.slice(0, limit),
    omittedCount: Math.max(0, values.length - limit)
  };
}

function referenceDiagnosticEntry(diagnostic = {}) {
  return {
    severity: REFERENCE_DIAGNOSTIC_SEVERITY_TOKENS.has(diagnostic?.severity) ? diagnostic.severity : null,
    code: typeof diagnostic?.code === "string" && REFERENCE_DIAGNOSTIC_CODE_PATTERN.test(diagnostic.code) ? diagnostic.code : null,
    objectId: safeReferenceIdValue(diagnostic?.objectId),
    objectRefs: Array.isArray(diagnostic?.objectRefs) ? diagnostic.objectRefs.map(safeReferenceIdValue).filter(Boolean) : null,
    message: safeReferenceDiagnosticMessage(diagnostic?.message) ? boundedText(diagnostic.message, 240) : null
  };
}

function boundedText(value, limit) {
  if (typeof value !== "string") return null;
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function wantsJsonOutput(argv) {
  return argv.includes("--json")
    || argv.includes("--list-import-discovery")
    || argv.includes("--list-formats")
    || argv.includes("--list-format-groups")
    || argv.includes("--list-adapters")
    || argv.includes("--check-adapters")
    || argv.includes("--describe-source");
}

function referenceImportFailureKind(adapterErrorCode = null) {
  const code = typeof adapterErrorCode === "string" ? adapterErrorCode : "";
  if (
    code === "adapter-config-missing"
    || code === "adapter-not-found"
    || code === "adapter-format-unsupported"
    || code === "adapter-format-mismatch"
    || code === "adapter-format-unconfigured"
  ) {
    return "adapter-config";
  }
  if (
    code === "adapter-preflight-failed"
    || code === "adapter-cwd-missing"
    || code === "adapter-shell-command-not-checked"
    || code === "adapter-command-missing"
    || code === "adapter-required-file-missing"
    || code === "adapter-required-directory-missing"
    || code === "adapter-required-command-missing"
    || code === "adapter-required-env-missing"
  ) {
    return "adapter-dependency";
  }
  if (
    code === "adapter-request-path-invalid"
    || code.startsWith("adapter-request-")
  ) {
    return "adapter-request";
  }
  if (
    code === "adapter-timeout"
    || code === "adapter-start-error"
    || code === "adapter-exit-nonzero"
  ) {
    return "adapter-process";
  }
  if (
    code === "adapter-output-missing"
    || code === "adapter-output-bounds-invalid"
    || code === "adapter-output-invalid"
    || code === "adapter-output-error"
  ) {
    return "canonical-reference";
  }
  if (
    code === "reference-format-invalid"
    || code === "reference-format-unsupported"
    || code === "reference-units-invalid"
    || code === "reference-asset-id-invalid"
    || code === "reference-name-invalid"
    || code === "reference-color-invalid"
    || code === "reference-number-invalid"
    || code === "reference-opacity-invalid"
    || code === "reference-positive-number-invalid"
    || code === "reference-vector-invalid"
    || code === "reference-transform-invalid"
    || code === "point-cloud-chunk-size-invalid"
    || code === "adapter-timeout-invalid"
  ) {
    return "import-options";
  }
  if (
    code.startsWith("cli-")
    || code === "cli-option-combination-invalid"
    || code === "adapter-run-option-unsupported"
    || code === "adapter-stage-option-unsupported"
  ) {
    return "cli-options";
  }
  return "unknown";
}

function referenceImportFailureAction(failureKind) {
  if (failureKind === "adapter-config") return "select-adapter-config";
  if (failureKind === "adapter-dependency") return "fix-adapter-dependencies";
  if (failureKind === "adapter-request") return "fix-adapter-request";
  if (failureKind === "adapter-process") return "inspect-adapter-run";
  if (failureKind === "canonical-reference") return "fix-canonical-reference-output";
  if (failureKind === "import-options") return "fix-import-options";
  if (failureKind === "cli-options") return "fix-command-options";
  return "review-import-error";
}

function referenceImportFailureDecision(result = {}, primary = {}) {
  const workflowStatus = isRecord(result.referenceImportWorkflowStatus) ? result.referenceImportWorkflowStatus : {};
  const adapterErrorCode = primary.adapterErrorCode || null;
  const preflightDecision = isRecord(primary.adapterPreflightDecision) ? primary.adapterPreflightDecision : null;
  const preflightFixArea = typeof preflightDecision?.likelyFixArea === "string" ? preflightDecision.likelyFixArea : "";
  const preflightFailureKind = adapterErrorCode === "adapter-preflight-failed" && preflightFixArea && preflightFixArea !== "none"
    ? ["adapter-config", "adapter-dependency", "adapter-request", "adapter-process", "canonical-reference", "import-options", "cli-options"].includes(preflightFixArea)
      ? preflightFixArea
      : null
    : null;
  const failureKind = preflightFailureKind || referenceImportFailureKind(adapterErrorCode);
  const recommendedNextAction = preflightDecision?.recommendedNextAction || referenceImportFailureAction(failureKind);
  const safeNextAction = preflightDecision?.safeNextAction || recommendedNextAction;
  const retryWorkflowStage = preflightDecision ? "adapter-preflight" : workflowStatus.workflowStage || null;
  return {
    failedWorkflowStage: workflowStatus.workflowStage || (preflightDecision ? "adapter-preflight" : null),
    workflowStageComplete: workflowStatus.workflowStageComplete ?? null,
    adapterErrorCode,
    failureKind,
    likelyFixArea: preflightFixArea && preflightFixArea !== "none" ? preflightFixArea : failureKind,
    safeNextAction,
    recommendedNextAction,
    retryWorkflowStage,
    adapterConfigRequired: failureKind === "adapter-config",
    adapterDependencyReviewRequired: failureKind === "adapter-dependency",
    adapterRequestReviewRequired: failureKind === "adapter-request",
    adapterRunInspectionRequired: failureKind === "adapter-process",
    canonicalOutputFixRequired: failureKind === "canonical-reference",
    importOptionFixRequired: failureKind === "import-options",
    cliOptionFixRequired: failureKind === "cli-options"
  };
}

function describeCliError(error) {
  const result = {
    ok: false,
    referenceImportContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    errors: [
      {
        message: error?.message || String(error)
      }
    ]
  };
  const primary = result.errors[0];
  if (isRecord(error?.referenceImportContext)) {
    Object.assign(result, error.referenceImportContext);
    if (error.referenceImportContext.referenceImportPlanFingerprint) {
      primary.referenceImportPlanFingerprint = error.referenceImportContext.referenceImportPlanFingerprint;
    }
  }
  if (error?.adapter) primary.adapter = error.adapter;
  if (error?.adapterErrorCode) primary.adapterErrorCode = error.adapterErrorCode;
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
  if (Number.isInteger(error?.adapterScratchFileCount)) result.adapterScratchFileCount = error.adapterScratchFileCount;
  if (Number.isInteger(error?.adapterScratchFileSizeBytes)) result.adapterScratchFileSizeBytes = error.adapterScratchFileSizeBytes;
  if (error?.adapterScratchFileModifiedTimeLatest) result.adapterScratchFileModifiedTimeLatest = error.adapterScratchFileModifiedTimeLatest;
  if (Array.isArray(error?.adapterScratchFileEntries)) result.adapterScratchFileEntries = error.adapterScratchFileEntries;
  if (Number.isInteger(error?.adapterScratchFileOmittedCount)) result.adapterScratchFileOmittedCount = error.adapterScratchFileOmittedCount;
  result.referenceImportFailureDecision = referenceImportFailureDecision(result, primary);
  return result;
}

function referenceImportErrorContext(importOptions, { planOnly = false, adapterRequestOnly = false, requestPath = null, context = null } = {}) {
  if (isRecord(context)) {
    return attachReferenceImportWorkflowStatus(attachReferenceImportPlanFingerprint({
      referenceImportContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
      ...context
    }), null, { stageComplete: false });
  }
  try {
    const plan = buildReferenceGeometryImportCandidate({
      projectPath: importOptions.projectPath,
      inputPath: importOptions.inputPath,
      referencesDir: importOptions.referencesDir,
      assetId: importOptions.assetId,
      replaceExisting: importOptions.replaceExisting,
      dryRun: importOptions.dryRun,
      visible: importOptions.visible,
      snapEnabled: importOptions.snapEnabled,
      display: importOptions.display,
      transform: importOptions.transform
    });
    const translationMode = importTranslationMode({
      inputPath: plan.inputPath,
      format: importOptions.format,
      adapterConfigPath: importOptions.adapterConfigPath
    });
    const base = {
      referenceImportContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
      projectPath: plan.projectPath,
      inputPath: plan.inputPath,
      referencePath: plan.referencePath,
      assetId: plan.assetId,
      dryRun: plan.dryRun,
      planOnly,
      adapterRequestOnly,
      replacedExisting: plan.replacedExisting,
      translationMode,
      ...(requestPath ? { adapterRequestPath: path.resolve(requestPath) } : {}),
      ...referenceImportExecutionMetadata({
        planOnly,
        adapterRequestOnly,
        dryRun: plan.dryRun,
        translationMode
      }),
      ...referenceImportOptionMetadata({
        name: importOptions.name,
        units: importOptions.units,
        pointCloudChunkSize: importOptions.pointCloudChunkSize,
        assetId: plan.assetId
      }),
      ...projectReferenceAssetPointerMetadata(plan.asset),
      ...sourcePlanMetadata(plan.inputPath, importOptions.format)
    };
    let adapterMetadata;
    try {
      adapterMetadata = {
        ...adapterConfigFileMetadata(importOptions.adapterConfigPath),
        ...adapterPlanMetadata({
          translationMode,
          adapterConfigPath: importOptions.adapterConfigPath,
          format: importOptions.format,
          adapterName: importOptions.adapterName
        })
      };
    } catch (error) {
      adapterMetadata = adapterPlanErrorMetadata(error, {
        adapterConfigPath: importOptions.adapterConfigPath,
        adapterName: importOptions.adapterName
      });
    }
    const summary = {
      ...base,
      ...adapterMetadata
    };
    return attachReferenceImportWorkflowStatus(attachReferenceImportPlanFingerprint(summary), null, { stageComplete: false });
  } catch {
    return null;
  }
}

function attachReferenceImportErrorContext(error, importOptions, options = {}) {
  const context = referenceImportErrorContext(importOptions, options);
  if (context) error.referenceImportContext = context;
  return error;
}

function importInputFormatToken({ inputPath, format }) {
  if (typeof format === "string" && format.trim()) return normalizedReferenceFormatToken(format);
  return String(path.extname(inputPath || "").slice(1) || "").trim().toLowerCase();
}

function importFormatInfo({ inputPath, format }) {
  const token = importInputFormatToken({ inputPath, format });
  const spec = supportedReferenceGeometryFormats()[token];
  if (!spec) throw referenceMetadataError(`Unsupported reference geometry source format: ${token || "unknown"}`, "reference-format-unsupported");
  return {
    token,
    sourceFormat: spec.aliasFor || token,
    spec
  };
}

function importTranslationMode({ inputPath, format, adapterConfigPath }) {
  const formatInfo = importFormatInfo({ inputPath, format });
  if (formatInfo.token === "json") return "canonical-json";
  if (adapterConfigPath) return "external-adapter";
  return formatInfo.spec.state === "external-adapter-required" ? "external-adapter" : "built-in";
}

function sourceRequestedFormatFamilyMetadata(sourceFormat, requestedFormat = null) {
  let sourceToken = null;
  let requestedToken = null;
  try {
    sourceToken = sourceFormat ? normalizedReferenceFormatToken(sourceFormat, "source.format") : null;
  } catch {
    sourceToken = sourceFormat ? String(sourceFormat).trim().toLowerCase() : null;
  }
  try {
    requestedToken = requestedFormat ? normalizedReferenceFormatToken(requestedFormat, "source.requestedFormat") : null;
  } catch {
    requestedToken = requestedFormat ? String(requestedFormat).trim().toLowerCase() : null;
  }
  const formats = supportedReferenceGeometryFormats();
  const sourceFamily = sourceToken ? formats[sourceToken]?.canonicalFormat || sourceToken : null;
  const aliases = sourceFamily ? supportedReferenceGeometryFormatGroups()[sourceFamily]?.formatTokens || [] : [];
  return {
    sourceRequestedFormatFamily: sourceFamily,
    sourceRequestedFormatAliases: aliases,
    sourceRequestedFormatMatchesFamily: requestedToken ? aliases.includes(requestedToken) : null
  };
}

export function supportedReferenceGeometryImportFormats() {
  return Object.fromEntries(Object.entries(supportedReferenceGeometryFormats()).map(([format, spec]) => {
    const normalizedFormat = spec.aliasFor || format;
    const canonicalJson = normalizedFormat === "json";
    const adapterRequired = spec.state === "external-adapter-required";
    const builtInAvailable = spec.state === "implemented" && !adapterRequired;
    const importerTranslationMode = canonicalJson ? "canonical-json" : adapterRequired ? "external-adapter" : "built-in";
    const adapterRequestCapable = spec.adapterCapable === true;
    const entry = {
      ...spec,
      importerTranslationMode,
      builtInAvailable,
      externalAdapterRequired: adapterRequired,
      adapterRequestCapable,
      planOnlyPreflightsAdapters: adapterRequestCapable && !canonicalJson,
      dryRunValidatesTranslatorOutput: true,
      canonicalJsonPassthrough: canonicalJson,
      writesProjectPointer: true,
      writesCanonicalReferenceManifest: true,
      ...referenceImportDiscoveryMetadata({
        translationMode: importerTranslationMode,
        adapterRequestCapable
      })
    };
    return [format, attachReferenceImportDiscoveryFingerprint(entry)];
  }));
}

function uniqueValues(values) {
  return [...new Set(values)];
}

export function supportedReferenceGeometryImportFormatGroups() {
  const importFormats = supportedReferenceGeometryImportFormats();
  return Object.fromEntries(Object.entries(supportedReferenceGeometryFormatGroups()).map(([format, group]) => {
    const tokenSpecs = group.formatTokens.map((token) => importFormats[token]).filter(Boolean);
    const canonicalSpec = importFormats[format] || tokenSpecs[0] || {};
    const translationModesByToken = Object.fromEntries(tokenSpecs.map((spec) => [spec.format, spec.importerTranslationMode]));
    const translationModes = uniqueValues(tokenSpecs.map((spec) => spec.importerTranslationMode).filter(Boolean));
    const builtInAvailable = tokenSpecs.some((spec) => spec.builtInAvailable === true);
    const externalAdapterRequiredTokens = tokenSpecs
      .filter((spec) => spec.externalAdapterRequired === true)
      .map((spec) => spec.format);
    const canonicalJson = format === "json";
    const adapterRequestCapable = tokenSpecs.some((spec) => spec.adapterRequestCapable === true);
    const entry = {
      ...group,
      defaultImporterTranslationMode: canonicalSpec.importerTranslationMode || null,
      importerTranslationModes: translationModes,
      importerTranslationModesByToken: translationModesByToken,
      builtInAvailable,
      externalAdapterRequired: externalAdapterRequiredTokens.length > 0 && !builtInAvailable,
      hasExternalAdapterOnlyTokens: externalAdapterRequiredTokens.length > 0,
      externalAdapterRequiredTokens,
      adapterRequestCapable,
      planOnlyPreflightsAdapters: adapterRequestCapable && !canonicalJson,
      dryRunValidatesTranslatorOutput: true,
      canonicalJsonPassthrough: canonicalJson,
      writesProjectPointer: true,
      writesCanonicalReferenceManifest: true,
      ...referenceImportDiscoveryMetadata({
        translationMode: canonicalSpec.importerTranslationMode || null,
        adapterRequestCapable
      }),
      ...referenceImportDiscoveryMetadataByToken(tokenSpecs)
    };
    return [format, attachReferenceImportDiscoveryFingerprint(entry)];
  }));
}

export function referenceGeometryImportDiscoveryCatalog() {
  const formats = supportedReferenceGeometryImportFormats();
  const formatGroups = supportedReferenceGeometryImportFormatGroups();
  const catalog = {
    referenceImportContractVersion: REFERENCE_IMPORT_CONTRACT_VERSION,
    ...referenceImportSchemaContractMetadata(),
    referenceSourceDescriptionContract: referenceSourceDescriptionContractMetadata(),
    referenceImportCommandContract: referenceImportCommandContractMetadata(),
    referenceProjectPointerContract: referenceProjectPointerContractMetadata(),
    referenceAuditContract: referenceAuditContractMetadata(),
    referenceImportResultContract: referenceImportResultContractMetadata(),
    referenceImportWorkflowContract: referenceImportWorkflowContractMetadata(),
    referenceImportAdapterRequestContract: referenceGeometryAdapterRequestContractMetadata(),
    referenceImportAdapterConfigContract: referenceGeometryAdapterConfigContractMetadata(),
    referenceImportAdapterPreflightContract: referenceGeometryAdapterPreflightContractMetadata(),
    referenceImportDecisionSummary: referenceImportDecisionSummary({ formats, formatGroups }),
    referenceTargetFormatCoverage: referenceGeometryTargetFormatCoverage({ formats, formatGroups }),
    formats,
    formatGroups,
    formatCount: Object.keys(formats).length,
    formatGroupCount: Object.keys(formatGroups).length
  };
  catalog.referenceImportDiscoveryFingerprint = referenceImportDiscoveryCatalogFingerprint(catalog);
  return catalog;
}

export function describeReferenceGeometryImportSource({ inputPath, format = null, adapterConfigPath = null } = {}) {
  const source = describeReferenceGeometrySource({ inputPath, format, adapterConfigPath });
  const importerTranslationMode = importTranslationMode({
    inputPath: source.inputPath,
    format,
    adapterConfigPath
  });
  const canonicalJson = source.sourceFormat === "json";
  const adapterRequestCapable = source.adapterCapable === true;
  const discoveryMetadata = referenceImportDiscoveryMetadata({
    translationMode: importerTranslationMode,
    adapterRequestCapable
  });
  return attachReferenceImportWorkflowStatus(attachReferenceImportDiscoveryFingerprint({
    ok: true,
    ...source,
    referenceImportExecutionMode: "source-discovery",
    referenceImportSideEffectPlan: referenceImportSideEffectPlan("source-discovery", {
      translationMode: importerTranslationMode
    }),
    importerTranslationMode,
    defaultImporterTranslationMode: importerTranslationMode,
    adapterRequestCapable,
    planOnlyPreflightsAdapters: adapterRequestCapable && !canonicalJson,
    dryRunValidatesTranslatorOutput: true,
    canonicalJsonPassthrough: canonicalJson,
    projectRequiredForImport: true,
    writesProjectPointer: true,
    writesCanonicalReferenceManifest: true,
    ...discoveryMetadata,
    referenceImportSourceDecision: referenceImportSourceDecision(source, {
      importerTranslationMode,
      canonicalJson,
      adapterRequestCapable,
      discoveryMetadata
    })
  }), "source-discovery");
}

function referenceImportSourceDecision(source = {}, {
  importerTranslationMode = null,
  canonicalJson = false,
  adapterRequestCapable = false,
  discoveryMetadata = {}
} = {}) {
  const externalAdapterRequired = importerTranslationMode === "external-adapter";
  const adapterConfigProvided = Boolean(source.adapterConfigPath);
  const sourceFileReadyForImport = source.inputExists === true && source.inputIsFile === true;
  const adapterRegistrySupportsSourceFormat = source.adapterRegistrySupportsSourceFormat ?? null;
  return {
    sourceFormat: source.sourceFormat || source.canonicalFormat || source.format || null,
    sourceRequestedFormat: source.sourceRequestedFormat || source.requestedFormat || null,
    sourceRequestedFormatFamily: source.sourceRequestedFormatFamily || source.canonicalFormat || source.sourceFormat || null,
    sourceRequestedFormatAliases: Array.isArray(source.sourceRequestedFormatAliases) ? source.sourceRequestedFormatAliases : null,
    sourceRequestedFormatMatchesFamily: source.sourceRequestedFormatMatchesFamily ?? null,
    canonicalFormat: source.canonicalFormat || source.sourceFormat || null,
    inputExists: source.inputExists ?? null,
    inputIsFile: source.inputIsFile ?? null,
    sourceFileReadyForImport,
    importerTranslationMode,
    canonicalJsonPassthrough: canonicalJson === true,
    externalAdapterRequired,
    adapterConfigProvided,
    adapterRegistrySupportsSourceFormat,
    adapterRequestCapable: adapterRequestCapable === true,
    canWriteAdapterRequest: adapterRequestCapable === true,
    projectRequiredForImport: true,
    sideEffectFreeDiscovery: true,
    safeFirstExecutionMode: "plan-only",
    availableExecutionModes: Array.isArray(discoveryMetadata.referenceImportExecutionModes)
      ? discoveryMetadata.referenceImportExecutionModes
      : [],
    recommendedNextAction: referenceImportSourceNextAction({
      sourceFileReadyForImport,
      canonicalJson,
      externalAdapterRequired,
      adapterConfigProvided,
      adapterRegistrySupportsSourceFormat
    })
  };
}

function referenceImportSourceNextAction({
  sourceFileReadyForImport = false,
  canonicalJson = false,
  externalAdapterRequired = false,
  adapterConfigProvided = false,
  adapterRegistrySupportsSourceFormat = null
} = {}) {
  if (!sourceFileReadyForImport) return "choose-existing-file";
  if (canonicalJson) return "plan-canonical-json-import";
  if (!externalAdapterRequired) return "run-plan-only";
  if (!adapterConfigProvided) return "select-adapter-config-or-check-adapter-preflight";
  if (adapterRegistrySupportsSourceFormat === false) return "select-compatible-adapter-config";
  return "check-adapter-preflight";
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

function assertAdapterPlanPreflight(adapterConfigPath, { format, adapterName }) {
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
  const result = checkReferenceGeometryAdapters(adapterConfigPath, {
    format,
    adapterName
  });
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
    const error = new Error(`${path.resolve(adapterConfigPath)}: adapter preflight failed for import plan${errorMessages.length ? `: ${errorMessages.join("; ")}` : ""}`);
    Object.assign(error, adapterConfigFileMetadata(adapterConfigPath));
    if (selection.adapterPreflightSelectedAdapter) error.adapter = selection.adapterPreflightSelectedAdapter;
    else if (adapterName) error.adapter = adapterName;
    if (selection.adapterOutputMode) error.adapterOutputMode = selection.adapterOutputMode;
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
    throw namedAdapterRequiresConfigError(adapterName, "import plan");
  }
  if (translationMode !== "external-adapter") {
    return {
      ...adapterConfigFileMetadata(null),
      ...assertAdapterPlanPreflight(null, { format, adapterName })
    };
  }
  return {
    ...adapterConfigFileMetadata(adapterConfigPath),
    ...assertAdapterPlanPreflight(adapterConfigPath, { format, adapterName })
  };
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

function sourcePlanMetadata(inputPath, format) {
  const absoluteInputPath = path.resolve(inputPath);
  const sourceFileExtension = path.extname(absoluteInputPath).slice(1).toLowerCase() || null;
  const formatInfo = importFormatInfo({ inputPath: absoluteInputPath, format });
  const requestedFormatFamilyMetadata = sourceRequestedFormatFamilyMetadata(formatInfo.sourceFormat, formatInfo.token);
  const result = {
    sourceFormat: formatInfo.sourceFormat,
    sourceFileName: path.basename(absoluteInputPath) || null,
    sourceFileExtension,
    sourceRequestedFormat: formatInfo.token,
    ...requestedFormatFamilyMetadata,
    sourceFileSizeBytes: null,
    sourceFileModifiedTime: null,
    sourceStatFingerprint: null,
    sourceChecksum: null,
    sourceTranslator: null,
    sourceTranslatorVersion: null,
    sourceAdapter: null
  };
  if (fs.existsSync(absoluteInputPath)) {
    const stat = fs.statSync(absoluteInputPath);
    if (stat.isFile()) {
      const sourceFile = sourceFileMetadata(absoluteInputPath);
      result.sourceFileName = sourceFile.sourceFileName;
      result.sourceFileExtension = sourceFile.sourceFileExtension || sourceFileExtension;
      result.sourceFileSizeBytes = sourceFile.sourceFileSizeBytes;
      result.sourceFileModifiedTime = sourceFile.sourceFileModifiedTime;
      result.sourceStatFingerprint = sourceFile.sourceStatFingerprint;
    }
  }
  return result;
}

function buildReferenceGeometryImportCandidate({
  projectPath,
  inputPath,
  referencesDir = DEFAULT_REFERENCES_DIR,
  assetId = null,
  replaceExisting = false,
  dryRun = false,
  visible = undefined,
  snapEnabled = undefined,
  display = {},
  transform = {}
}) {
  if (!projectPath) throw new Error("Missing projectPath");
  if (!inputPath) throw new Error("Missing inputPath");
  const absoluteProjectPath = path.resolve(projectPath);
  const absoluteInputPath = path.resolve(inputPath);
  const project = readJson(absoluteProjectPath);
  assertProjectShape(project, absoluteProjectPath);

  const shouldReplaceExisting = parseBoolean(replaceExisting, "replaceExisting", false);
  const shouldDryRun = parseBoolean(dryRun, "dryRun", false);
  const hasExplicitAssetId = assetId !== null && assetId !== undefined;
  const requestedAssetId = hasExplicitAssetId ? assetId : path.basename(absoluteInputPath, path.extname(absoluteInputPath));
  const nextAssetId = targetAssetId(project, requestedAssetId, shouldReplaceExisting, { explicit: hasExplicitAssetId });
  const existingAsset = shouldReplaceExisting && isRecord(project.referenceGeometry?.assets?.[nextAssetId])
    ? project.referenceGeometry.assets[nextAssetId]
    : null;
  const outputPath = existingAsset?.path
    ? path.resolve(path.dirname(absoluteProjectPath), existingAsset.path)
    : referenceOutputPath(referencesDir, nextAssetId);
  const nextAsset = {
    path: existingAsset?.path || projectRelativePath(absoluteProjectPath, outputPath),
    visible: parseBoolean(visible, "reference asset visible", existingAsset?.visible ?? true),
    snapEnabled: parseBoolean(snapEnabled, "reference asset snapEnabled", existingAsset?.snapEnabled ?? false),
    display: referenceDisplay({
      ...(isRecord(existingAsset?.display) ? existingAsset.display : {}),
      ...definedEntries(display)
    }),
    transform: referenceTransform({
      ...(isRecord(existingAsset?.transform) ? existingAsset.transform : {}),
      ...definedEntries(transform)
    })
  };
  const nextProject = cloneJson(project);
  if (!nextProject.referenceGeometry) nextProject.referenceGeometry = { assets: {} };
  if (!nextProject.referenceGeometry.assets) nextProject.referenceGeometry.assets = {};
  nextProject.referenceGeometry.assets[nextAssetId] = nextAsset;
  assertProjectSchemaValid(absoluteProjectPath, nextProject);
  return {
    projectPath: absoluteProjectPath,
    inputPath: absoluteInputPath,
    referencePath: outputPath,
    assetId: nextAssetId,
    asset: nextAsset,
    project: nextProject,
    dryRun: shouldDryRun,
    replacedExisting: Boolean(existingAsset)
  };
}

export function planReferenceGeometryImport({
  projectPath,
  inputPath,
  referencesDir = DEFAULT_REFERENCES_DIR,
  assetId = null,
  format = null,
  name = null,
  units = null,
  adapterConfigPath = null,
  adapterName = null,
  pointCloudChunkSize = undefined,
  replaceExisting = false,
  visible = undefined,
  snapEnabled = undefined,
  display = {},
  transform = {}
}) {
  normalizedExplicitReferenceName(name);
  const plan = buildReferenceGeometryImportCandidate({
    projectPath,
    inputPath,
    referencesDir,
    assetId,
    replaceExisting,
    dryRun: false,
    visible,
    snapEnabled,
    display,
    transform
  });
  const translationMode = importTranslationMode({ inputPath: plan.inputPath, format, adapterConfigPath });
  const base = {
    projectPath: plan.projectPath,
    inputPath: plan.inputPath,
    referencePath: plan.referencePath,
    assetId: plan.assetId,
    dryRun: false,
    planOnly: true,
    replacedExisting: plan.replacedExisting,
    translationMode,
    ...referenceImportExecutionMetadata({ planOnly: true, translationMode }),
    ...referenceImportOptionMetadata({ name, units, pointCloudChunkSize, assetId: plan.assetId }),
    ...projectReferenceAssetPointerMetadata(plan.asset),
    ...sourcePlanMetadata(plan.inputPath, format),
    ...nullReferenceTranslatedOutputMetadata(),
    ...referenceFileMetadata(null),
    ...nullReferenceChunkFileMetadata()
  };
  try {
    return attachReferenceImportPlanFingerprint({
      ...base,
      ...adapterPlanMetadata({ translationMode, adapterConfigPath, format, adapterName })
    });
  } catch (error) {
    throw attachReferenceImportErrorContext(error, {
      projectPath,
      inputPath,
      referencesDir,
      assetId,
      format,
      name,
      units,
      adapterConfigPath,
      adapterName,
      pointCloudChunkSize,
      replaceExisting,
      visible,
      snapEnabled,
      display,
      transform
    }, {
      planOnly: true,
      context: {
        ...base,
        ...adapterPlanErrorMetadata(error, { adapterConfigPath, adapterName })
      }
    });
  }
}

function adapterRequestMetadata(requestPath, request) {
  const preflightMetadata = adapterRequestPreflightMetadata({
    adapterConfigPath: request.adapterConfigPath || null,
    format: request.requestedFormat || request.format || null,
    adapterName: request.adapterKey || null
  });
  return {
    path: path.resolve(requestPath),
    adapterRequestPath: path.resolve(requestPath),
    adapterRequestFingerprint: request.adapterRequestFingerprint,
    adapterRequestEvidenceFingerprint: request.adapterRequestEvidenceFingerprint || null,
    adapterRunId: request.adapterRunId,
    ...preflightMetadata,
    adapterRegistryFingerprint: request.adapterRegistryFingerprint || null,
    adapterRegistryAdapterFingerprint: request.adapterRegistryAdapterFingerprint || null,
    input: request.input,
    sourceDirectory: request.sourceDirectory,
    sourceFileName: request.sourceFileName,
    sourceFileStem: request.sourceFileStem,
    sourceFileExtension: request.sourceFileExtension,
    sourceFileSizeBytes: request.sourceFileSizeBytes,
    sourceFileModifiedTime: request.sourceFileModifiedTime,
    sourceStatFingerprint: request.sourceStatFingerprint,
    adapterOutputMode: request.outputMode,
    outputMode: request.outputMode,
    format: request.format,
    requestedFormat: request.requestedFormat,
    adapterKey: request.adapterKey || null,
    output: request.output,
    outputDir: request.outputDir,
    stageDir: request.stageDir,
    request: request.request,
    scratchDir: request.scratchDir,
    outputFileName: request.outputFileName,
    outputFileStem: request.outputFileStem,
    chunkDir: request.chunkDir,
    chunkPathPrefix: request.chunkPathPrefix,
    adapterLogPath: request.adapterLogPath,
    adapterStdoutPath: request.adapterStdoutPath,
    adapterStderrPath: request.adapterStderrPath,
    units: request.units,
    pointCloudChunkSize: request.pointCloudChunkSize,
    timeoutMs: request.timeoutMs,
    schema: request.schema,
    schemaVersion: request.schemaVersion,
    adapterRequestSchema: request.schema,
    adapterRequestSchemaVersion: request.schemaVersion,
    adapterRequestSchemaPath: request.schemas?.adapterRequest || null,
    referenceGeometrySchemaPath: request.schemas?.referenceGeometry || null,
    pointCloudChunkSchemaPath: request.schemas?.pointCloudChunk || null,
    schemaVersions: request.schemaVersions,
    schemas: request.schemas,
    adapterConfigDir: request.adapterConfigDir || null
  };
}

export function writeReferenceGeometryImportAdapterRequest({
  projectPath,
  inputPath,
  requestPath,
  referencesDir = DEFAULT_REFERENCES_DIR,
  assetId = null,
  format = null,
  name = null,
  units = null,
  adapterConfigPath = null,
  adapterName = null,
  adapterTimeoutMs = null,
  pointCloudChunkSize = undefined,
  replaceExisting = false,
  visible = undefined,
  snapEnabled = undefined,
  display = {},
  transform = {}
}) {
  if (!requestPath) throw new Error("Missing requestPath");
  const effectiveName = normalizedExplicitReferenceName(name);
  const plan = buildReferenceGeometryImportCandidate({
    projectPath,
    inputPath,
    referencesDir,
    assetId,
    replaceExisting,
    dryRun: false,
    visible,
    snapEnabled,
    display,
    transform
  });
  const request = writeReferenceGeometryAdapterRequest({
    inputPath: plan.inputPath,
    outputPath: plan.referencePath,
    requestPath,
    format,
    name: effectiveName || plan.assetId,
    units,
    assetId: plan.assetId,
    pointCloudChunkSize,
    adapterTimeoutMs,
    adapterKey: adapterName || null,
    adapterConfigPath: adapterConfigPath || null
  });
  const summary = attachReferenceImportPlanFingerprint({
    projectPath: plan.projectPath,
    inputPath: plan.inputPath,
    referencePath: plan.referencePath,
    assetId: plan.assetId,
    dryRun: false,
    planOnly: false,
    adapterRequestOnly: true,
    replacedExisting: plan.replacedExisting,
    translationMode: "external-adapter",
    ...referenceImportExecutionMetadata({ adapterRequestOnly: true, translationMode: "external-adapter" }),
    ...referenceImportOptionMetadata({ name: effectiveName, units, pointCloudChunkSize, assetId: plan.assetId }),
    ...projectReferenceAssetPointerMetadata(plan.asset),
    ...adapterConfigFileMetadata(adapterConfigPath),
    ...sourcePlanMetadata(plan.inputPath, format),
    ...adapterRequestMetadata(requestPath, request),
    ...nullReferenceTranslatedOutputMetadata(),
    ...referenceFileMetadata(null),
    ...nullReferenceChunkFileMetadata()
  });
  summary.referenceImportAdapterRequestDecision = referenceImportAdapterRequestDecision(summary);
  return attachReferenceImportWorkflowStatus(summary, "adapter-request");
}

export function importReferenceGeometryAsset({
  projectPath,
  inputPath,
  referencesDir = DEFAULT_REFERENCES_DIR,
  assetId = null,
  format = null,
  name = null,
  units = null,
  adapterConfigPath = null,
  adapterName = null,
  adapterTimeoutMs = null,
  keepStage = false,
  keepStageOnError = false,
  pointCloudChunkSize = undefined,
  replaceExisting = false,
  dryRun = false,
  visible = undefined,
  snapEnabled = undefined,
  display = {},
  transform = {}
}) {
  const effectiveName = normalizedExplicitReferenceName(name);
  const plan = buildReferenceGeometryImportCandidate({
    projectPath,
    inputPath,
    referencesDir,
    assetId,
    replaceExisting,
    dryRun,
    visible,
    snapEnabled,
    display,
    transform
  });
  const absoluteProjectPath = plan.projectPath;
  const absoluteInputPath = plan.inputPath;
  const outputPath = plan.referencePath;
  const nextAssetId = plan.assetId;
  const nextAsset = plan.asset;
  const nextProject = plan.project;
  const shouldDryRun = plan.dryRun;
  const shouldKeepStage = parseBoolean(keepStage, "keepStage", false);
  const shouldKeepStageOnError = parseBoolean(keepStageOnError, "keepStageOnError", false);
  const translationMode = importTranslationMode({ inputPath: absoluteInputPath, format, adapterConfigPath });

  const dryRunTarget = shouldDryRun ? createDryRunOutputPath(outputPath) : null;
  const translationOutputPath = dryRunTarget?.outputPath || outputPath;
  let translatedOutputMetadata = nullReferenceTranslatedOutputMetadata();
  let translated;
  try {
    translated = translateReferenceGeometryFile({
      inputPath: absoluteInputPath,
      outputPath: translationOutputPath,
      format,
      name: effectiveName || nextAssetId,
      assetId: nextAssetId,
      units,
      adapterConfigPath,
      adapterName,
      adapterTimeoutMs,
      keepStage: shouldKeepStage,
      keepStageOnError: shouldKeepStageOnError,
      pointCloudChunkSize
    });
    translatedOutputMetadata = referenceTranslatedOutputMetadata(translationOutputPath, translated);
  } finally {
    if (dryRunTarget) fs.rmSync(dryRunTarget.dryRunDir, { recursive: true, force: true });
  }
  if (translated.asset?.id !== nextAssetId) {
    throw new Error(`${outputPath}: translated reference asset id ${translated.asset?.id || "<missing>"} does not match project reference asset ${nextAssetId}`);
  }

  if (!shouldDryRun) writeProjectAtomically(absoluteProjectPath, nextProject);

  const source = isRecord(translated.asset?.source) ? translated.asset.source : {};
  const summary = attachReferenceImportPlanFingerprint({
    projectPath: absoluteProjectPath,
    inputPath: absoluteInputPath,
    referencePath: outputPath,
    assetId: nextAssetId,
    dryRun: shouldDryRun,
    planOnly: false,
    ...(isRecord(translated.__adapterRunMetadata) ? translated.__adapterRunMetadata : {}),
    ...(isRecord(translated.__adapterStageMetadata) ? translated.__adapterStageMetadata : {}),
    replacedExisting: plan.replacedExisting,
    translationMode,
    ...referenceImportExecutionMetadata({ dryRun: shouldDryRun, translationMode }),
    ...referenceImportOptionMetadata({ name: effectiveName, units, pointCloudChunkSize, assetId: nextAssetId }),
    ...projectReferenceAssetPointerMetadata(nextAsset),
    ...adapterConfigFileMetadata(adapterConfigPath),
    sourceFormat: source.format || null,
    sourceFileName: source.fileName || null,
    sourceFileExtension: source.fileExtension || null,
    sourceRequestedFormat: source.requestedFormat || null,
    ...sourceRequestedFormatFamilyMetadata(source.format || null, source.requestedFormat || null),
    sourceFileSizeBytes: Number.isInteger(source.fileSizeBytes) ? source.fileSizeBytes : null,
    sourceFileModifiedTime: source.modifiedTime || null,
    sourceStatFingerprint: source.statFingerprint || null,
    sourceChecksum: source.checksum || null,
    sourceTranslator: source.translator || null,
    sourceTranslatorVersion: source.translatorVersion || null,
    sourceAdapter: source.adapterKey || null,
    ...translatedOutputMetadata,
    ...referenceFileMetadata(shouldDryRun ? null : outputPath),
    ...(shouldDryRun ? nullReferenceChunkFileMetadata() : referenceChunkFileMetadata(outputPath, translated)),
    ...referenceSchemaMetadata(translated),
    ...referenceDiagnosticSummary(translated),
    ...referenceStructureSummary(translated),
    ...referenceAssetMetadata(translated),
    ...referencePrimitiveCounts(translated),
    referencePointCloudPointCount: referencePointCloudPointCount(translated)
  });
  if (shouldDryRun) {
    summary.referenceImportDryRunDecision = referenceImportDryRunDecision(summary);
    return attachReferenceImportWorkflowStatus(summary, "dry-run");
  }
  summary.referenceImportPromotionDecision = referenceImportPromotionDecision(summary);
  return attachReferenceImportWorkflowStatus(summary, "import");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (args.listImportDiscovery) {
    console.log(JSON.stringify(referenceGeometryImportDiscoveryCatalog(), null, 2));
    return 0;
  }
  if (args.listFormats) {
    console.log(JSON.stringify(supportedReferenceGeometryImportFormats(), null, 2));
    return 0;
  }
  if (args.listFormatGroups) {
    console.log(JSON.stringify(supportedReferenceGeometryImportFormatGroups(), null, 2));
    return 0;
  }
  if (args.describeSource) {
    if (!args.input) throw new Error("--describe-source requires --input");
    console.log(JSON.stringify(describeReferenceGeometryImportSource({
      inputPath: args.input,
      format: args.format,
      adapterConfigPath: args.adapterConfig || null
    }), null, 2));
    return 0;
  }
  if (args.listAdapters) {
    if (!args.adapterConfig) throw cliOptionError("--list-adapters requires --adapter-config", "adapter-config-missing");
    const incompatibleOptions = [];
    if (args.project !== undefined) incompatibleOptions.push("--project");
    if (args.input !== undefined) incompatibleOptions.push("--input");
    if (args.referencesDir !== undefined) incompatibleOptions.push("--references-dir");
    if (args.assetId !== undefined) incompatibleOptions.push("--asset-id");
    if (args.format !== undefined) incompatibleOptions.push("--format");
    if (args.name !== undefined) incompatibleOptions.push("--name");
    if (args.units !== undefined) incompatibleOptions.push("--units");
    if (args.replaceExisting !== undefined) incompatibleOptions.push("--replace-existing");
    if (args.planOnly !== undefined) incompatibleOptions.push("--plan-only");
    if (args.writeAdapterRequest !== undefined) incompatibleOptions.push("--write-adapter-request");
    if (args.dryRun !== undefined) incompatibleOptions.push("--dry-run");
    if (args.checkReferences !== undefined) incompatibleOptions.push("--check-references");
    if (args.checkAdapters !== undefined) incompatibleOptions.push("--check-adapters");
    if (args.summaryOnly !== undefined) incompatibleOptions.push("--summary-only");
    if (args.adapter !== undefined) incompatibleOptions.push("--adapter");
    if (args.adapterTimeoutMs !== undefined) incompatibleOptions.push("--adapter-timeout-ms");
    if (args.keepStage !== undefined) incompatibleOptions.push("--keep-stage");
    if (args.keepStageOnError !== undefined) incompatibleOptions.push("--keep-stage-on-error");
    if (args.pointCloudChunkSize !== undefined) incompatibleOptions.push("--point-cloud-chunk-size");
    if (args.origin !== undefined) incompatibleOptions.push("--origin");
    if (args.axisX !== undefined) incompatibleOptions.push("--axis-x");
    if (args.axisY !== undefined) incompatibleOptions.push("--axis-y");
    if (args.axisZ !== undefined) incompatibleOptions.push("--axis-z");
    if (args.scale !== undefined) incompatibleOptions.push("--scale");
    if (args.visible !== undefined) incompatibleOptions.push("--visible");
    if (args.snapEnabled !== undefined) incompatibleOptions.push("--snap-enabled");
    if (args.opacity !== undefined) incompatibleOptions.push("--opacity");
    if (args.color !== undefined) incompatibleOptions.push("--color");
    if (args.edgeColor !== undefined) incompatibleOptions.push("--edge-color");
    if (args.pointSize !== undefined) incompatibleOptions.push("--point-size");
    if (incompatibleOptions.length) {
      throw optionCombinationError(`--list-adapters cannot be combined with project import, audit, preflight, format selection, display, transform, or adapter-run options: ${incompatibleOptions.join(", ")}`);
    }
    console.log(JSON.stringify(describeReferenceGeometryAdapters(args.adapterConfig), null, 2));
    return 0;
  }
  if (args.checkAdapters) {
    if (!args.adapterConfig) throw cliOptionError("--check-adapters requires --adapter-config", "adapter-config-missing");
    const incompatibleOptions = [];
    if (args.project !== undefined) incompatibleOptions.push("--project");
    if (args.input !== undefined) incompatibleOptions.push("--input");
    if (args.referencesDir !== undefined) incompatibleOptions.push("--references-dir");
    if (args.assetId !== undefined) incompatibleOptions.push("--asset-id");
    if (args.name !== undefined) incompatibleOptions.push("--name");
    if (args.units !== undefined) incompatibleOptions.push("--units");
    if (args.replaceExisting !== undefined) incompatibleOptions.push("--replace-existing");
    if (args.planOnly !== undefined) incompatibleOptions.push("--plan-only");
    if (args.writeAdapterRequest !== undefined) incompatibleOptions.push("--write-adapter-request");
    if (args.dryRun !== undefined) incompatibleOptions.push("--dry-run");
    if (args.checkReferences !== undefined) incompatibleOptions.push("--check-references");
    if (args.summaryOnly !== undefined) incompatibleOptions.push("--summary-only");
    if (args.adapterTimeoutMs !== undefined) incompatibleOptions.push("--adapter-timeout-ms");
    if (args.keepStage !== undefined) incompatibleOptions.push("--keep-stage");
    if (args.keepStageOnError !== undefined) incompatibleOptions.push("--keep-stage-on-error");
    if (args.pointCloudChunkSize !== undefined) incompatibleOptions.push("--point-cloud-chunk-size");
    if (args.origin !== undefined) incompatibleOptions.push("--origin");
    if (args.axisX !== undefined) incompatibleOptions.push("--axis-x");
    if (args.axisY !== undefined) incompatibleOptions.push("--axis-y");
    if (args.axisZ !== undefined) incompatibleOptions.push("--axis-z");
    if (args.scale !== undefined) incompatibleOptions.push("--scale");
    if (args.visible !== undefined) incompatibleOptions.push("--visible");
    if (args.snapEnabled !== undefined) incompatibleOptions.push("--snap-enabled");
    if (args.opacity !== undefined) incompatibleOptions.push("--opacity");
    if (args.color !== undefined) incompatibleOptions.push("--color");
    if (args.edgeColor !== undefined) incompatibleOptions.push("--edge-color");
    if (args.pointSize !== undefined) incompatibleOptions.push("--point-size");
    if (incompatibleOptions.length) {
      throw optionCombinationError(`--check-adapters cannot be combined with project import, audit, display, transform, or adapter-run options: ${incompatibleOptions.join(", ")}`);
    }
    const result = checkReferenceGeometryAdapters(args.adapterConfig, {
      format: args.format,
      adapterName: args.adapter
    });
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }
  if (args.checkReferences) {
    if (!args.project) throw new Error("--check-references requires --project");
    const shouldSummaryOnly = parseBoolean(args.summaryOnly, "summaryOnly", false);
    const incompatibleOptions = [];
    if (args.input !== undefined) incompatibleOptions.push("--input");
    if (args.format !== undefined) incompatibleOptions.push("--format");
    if (args.name !== undefined) incompatibleOptions.push("--name");
    if (args.units !== undefined) incompatibleOptions.push("--units");
    if (args.replaceExisting !== undefined) incompatibleOptions.push("--replace-existing");
    if (args.planOnly !== undefined) incompatibleOptions.push("--plan-only");
    if (args.writeAdapterRequest !== undefined) incompatibleOptions.push("--write-adapter-request");
    if (args.dryRun !== undefined) incompatibleOptions.push("--dry-run");
    if (args.adapterConfig !== undefined) incompatibleOptions.push("--adapter-config");
    if (args.adapter !== undefined) incompatibleOptions.push("--adapter");
    if (args.adapterTimeoutMs !== undefined) incompatibleOptions.push("--adapter-timeout-ms");
    if (args.keepStage !== undefined) incompatibleOptions.push("--keep-stage");
    if (args.keepStageOnError !== undefined) incompatibleOptions.push("--keep-stage-on-error");
    if (args.pointCloudChunkSize !== undefined) incompatibleOptions.push("--point-cloud-chunk-size");
    if (args.origin !== undefined) incompatibleOptions.push("--origin");
    if (args.axisX !== undefined) incompatibleOptions.push("--axis-x");
    if (args.axisY !== undefined) incompatibleOptions.push("--axis-y");
    if (args.axisZ !== undefined) incompatibleOptions.push("--axis-z");
    if (args.scale !== undefined) incompatibleOptions.push("--scale");
    if (args.visible !== undefined) incompatibleOptions.push("--visible");
    if (args.snapEnabled !== undefined) incompatibleOptions.push("--snap-enabled");
    if (args.opacity !== undefined) incompatibleOptions.push("--opacity");
    if (args.color !== undefined) incompatibleOptions.push("--color");
    if (args.edgeColor !== undefined) incompatibleOptions.push("--edge-color");
    if (args.pointSize !== undefined) incompatibleOptions.push("--point-size");
    if (incompatibleOptions.length) {
      throw optionCombinationError(`--check-references cannot be combined with import, adapter, display, or transform options: ${incompatibleOptions.join(", ")}`);
    }
    const result = checkProjectReferenceGeometry({
      projectPath: args.project,
      assetId: args.assetId || null,
      referencesDir: args.referencesDir || DEFAULT_REFERENCES_DIR
    });
    console.log(JSON.stringify(shouldSummaryOnly ? referenceAuditSummaryOnlyResult(result) : result, null, 2));
    return result.ok ? 0 : 1;
  }
  if (args.summaryOnly !== undefined) {
    throw optionCombinationError("--summary-only can only be used with --check-references.");
  }
  if (!args.project || !args.input) throw new Error("Both --project and --input are required.\n\n" + usage());
  const shouldPlanOnly = parseBoolean(args.planOnly, "planOnly", false);
  if (shouldPlanOnly && args.dryRun !== undefined) {
    throw optionCombinationError("--plan-only cannot be combined with --dry-run; plan-only does not run the translator.");
  }
  if (shouldPlanOnly) {
    const adapterRunOptions = adapterRunOptionNamesFromArgs(args);
    if (adapterRunOptions.length) throw adapterRunOptionsPlanOnlyError(adapterRunOptions);
  }
  const importOptions = {
    projectPath: args.project,
    inputPath: args.input,
    referencesDir: args.referencesDir || DEFAULT_REFERENCES_DIR,
    assetId: args.assetId,
    format: args.format,
    name: args.name,
    units: args.units,
    replaceExisting: args.replaceExisting === undefined ? false : args.replaceExisting,
    dryRun: args.dryRun === undefined ? false : args.dryRun,
    adapterConfigPath: args.adapterConfig,
    adapterName: args.adapter,
    adapterTimeoutMs: args.adapterTimeoutMs,
    keepStage: args.keepStage,
    keepStageOnError: args.keepStageOnError,
    pointCloudChunkSize: args.pointCloudChunkSize,
    visible: args.visible,
    snapEnabled: args.snapEnabled,
    display: {
      opacity: args.opacity,
      color: args.color,
      edgeColor: args.edgeColor,
      pointSize: args.pointSize
    },
    transform: {
      origin: args.origin,
      axisX: args.axisX,
      axisY: args.axisY,
      axisZ: args.axisZ,
      scale: args.scale
    }
  };
  try {
    if (args.writeAdapterRequest) {
      if (shouldPlanOnly || args.dryRun !== undefined) {
        throw optionCombinationError("--write-adapter-request cannot be combined with --plan-only or --dry-run; it writes only the adapter request.");
      }
      const stagePreservationOptions = stagePreservationOptionNamesFromArgs(args);
      if (stagePreservationOptions.length) throw adapterStagePreservationOptionsRequestOnlyError(stagePreservationOptions);
      const result = writeReferenceGeometryImportAdapterRequest({
        ...importOptions,
        requestPath: args.writeAdapterRequest
      });
      if (args.json) {
        console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      } else {
        console.log(`OK: wrote reference adapter request to ${path.resolve(args.writeAdapterRequest)}`);
        console.log(`Project: ${result.projectPath}`);
        console.log(`Reference: ${result.referencePath} (not written)`);
      }
      return 0;
    }
    const result = shouldPlanOnly
      ? planReferenceGeometryImport(importOptions)
      : importReferenceGeometryAsset(importOptions);
    if (args.json) {
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      return 0;
    }
    const status = result.planOnly ? "planned" : result.dryRun ? "dry-run validated" : "imported";
    const objectSummary = result.planOnly ? "" : ` with ${result.referenceObjectCount} reference object(s)`;
    console.log(`OK: ${status} ${result.assetId}${objectSummary}`);
    console.log(`Project: ${result.projectPath}`);
    console.log(`Reference: ${result.planOnly || result.dryRun ? `${result.referencePath} (not written)` : result.referencePath}`);
    return 0;
  } catch (error) {
    if (args.json) {
      console.log(JSON.stringify(describeCliError(attachReferenceImportErrorContext(error, importOptions, {
        planOnly: shouldPlanOnly,
        adapterRequestOnly: Boolean(args.writeAdapterRequest),
        requestPath: args.writeAdapterRequest || null
      })), null, 2));
      return 1;
    }
    throw error;
  }
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
