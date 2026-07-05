import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../../..");
const ADAPTER_REQUEST_SCHEMA_PATH = path.join(ROOT, "bobercad/app/schemas/reference-geometry-adapter-request.schema.json");
const REFERENCE_GEOMETRY_SCHEMA_PATH = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");
const POINT_CLOUD_CHUNK_SCHEMA_PATH = path.join(ROOT, "bobercad/app/schemas/reference-point-cloud-chunk.schema.json");
const ADAPTER_REQUEST_SCHEMA_NAME = schemaNameFromSchemaFile(ADAPTER_REQUEST_SCHEMA_PATH, "adapter request");
const ADAPTER_REQUEST_SCHEMA_VERSION = schemaVersionFromSchemaFile(ADAPTER_REQUEST_SCHEMA_PATH, "adapter request");
const REFERENCE_GEOMETRY_SCHEMA_VERSION = schemaVersionFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA_PATH, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_VERSION = schemaVersionFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA_PATH, "point-cloud chunk");
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const REQUEST_RUN_ID_PATTERN = /^[A-Za-z0-9_.:-]{8,}$/;
const ADAPTER_REQUEST_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ADAPTER_REGISTRY_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SOURCE_STAT_FINGERPRINT_PATTERN = /^stat-sha256:[0-9a-f]{64}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const RESERVED_REQUEST_IDS = new Set(["__proto__", "prototype", "constructor"]);
const SUPPORTED_FORMATS = new Set(["dxf", "dwg", "step", "ifc", "e57"]);
const CANONICAL_REQUESTED_FORMAT_ALIASES = {
  dxf: new Set(["dxf"]),
  dwg: new Set(["dwg"]),
  step: new Set(["step", "stp", "p21", "stpnc"]),
  ifc: new Set(["ifc", "ifcxml", "ifczip"]),
  e57: new Set(["e57", "e57pointcloud", "e57pc"])
};
const CANONICAL_SOURCE_FILE_EXTENSIONS = {
  dxf: new Set(["", "dxf"]),
  dwg: new Set(["", "dwg"]),
  step: new Set(["", "step", "stp", "p21", "stpnc"]),
  ifc: new Set(["", "ifc", "ifcxml", "ifczip"]),
  e57: new Set(["", "e57"])
};
const REQUESTED_FORMAT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const SOURCE_FILE_EXTENSION_PATTERN = /^$|^[a-z0-9][a-z0-9_-]*$/;
const SUPPORTED_UNITS = new Set(["mm", "m", "in", "ft"]);
const SUPPORTED_OUTPUT_MODES = new Set(["file", "stdout"]);
const CHUNK_PATH_PREFIX = "chunks/";
const CANONICAL_STAGE_PATHS = [
  ["scratchDir", "scratch"],
  ["chunkDir", "chunks"],
  ["adapterLogPath", "reference-adapter.log"],
  ["adapterStdoutPath", "reference-adapter.stdout.log"],
  ["adapterStderrPath", "reference-adapter.stderr.log"]
];

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function schemaVersionFromSchemaFile(filePath, label) {
  const schemaVersion = readJsonFile(filePath)?.properties?.schemaVersion?.const;
  if (typeof schemaVersion !== "string" || !schemaVersion) {
    throw new Error(`${label} schema is missing properties.schemaVersion.const`);
  }
  return schemaVersion;
}

function schemaNameFromSchemaFile(filePath, label) {
  const schemaName = readJsonFile(filePath)?.properties?.schema?.const;
  if (typeof schemaName !== "string" || !schemaName) {
    throw new Error(`${label} schema is missing properties.schema.const`);
  }
  return schemaName;
}

function assertRequestSafeId(value, label, requestPath) {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN.test(value) || RESERVED_REQUEST_IDS.has(value)) {
    throw new Error(`${requestPath}: adapter request ${label} must be a safe id token`);
  }
}

function assertString(value, label, requestPath, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !/\S/.test(value))) {
    throw new Error(`${requestPath}: adapter request ${label} must be a ${allowEmpty ? "string" : "non-blank string"}`);
  }
}

function assertPlainObject(value, label, requestPath) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${requestPath}: adapter request ${label} must be an object`);
  }
}

function assertPositiveInteger(value, label, requestPath) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${requestPath}: adapter request ${label} must be a positive integer`);
  }
}

function isInsideOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertContainedPath(request, field, stageDir, requestPath) {
  const value = request[field];
  if (typeof value !== "string" || !/\S/.test(value)) {
    throw new Error(`${requestPath}: adapter request ${field} must be a non-blank string`);
  }
  const resolved = path.resolve(value);
  if (!isInsideOrSame(stageDir, resolved)) {
    throw new Error(`${requestPath}: adapter request ${field} must resolve inside stageDir`);
  }
}

function assertCanonicalStagePaths(request, stageDir, requestPath) {
  for (const [field, fileName] of CANONICAL_STAGE_PATHS) {
    if (path.resolve(request[field]) !== path.join(stageDir, fileName)) {
      throw new Error(`${requestPath}: adapter request ${field} must resolve to stageDir/${fileName}`);
    }
  }
}

function assertRequestPathMetadata(request, requestPath) {
  assertString(request.request, "request", requestPath);
  if (path.resolve(request.request) !== path.resolve(requestPath)) {
    throw new Error(`${requestPath}: adapter request request must match actual request path`);
  }
}

function assertFormatMetadata(request, requestPath) {
  if (!SUPPORTED_FORMATS.has(request.format)) {
    throw new Error(`${requestPath}: adapter request format must be one of dxf, dwg, step, ifc, or e57`);
  }
  if (typeof request.requestedFormat !== "string" || !REQUESTED_FORMAT_PATTERN.test(request.requestedFormat)) {
    throw new Error(`${requestPath}: adapter request requestedFormat must be a safe format token`);
  }
  const aliases = CANONICAL_REQUESTED_FORMAT_ALIASES[request.format];
  if (!(aliases instanceof Set && aliases.has(request.requestedFormat))) {
    throw new Error(`${requestPath}: adapter request requestedFormat ${request.requestedFormat} must match canonical format ${request.format}`);
  }
  if (typeof request.sourceFileExtension !== "string" || !SOURCE_FILE_EXTENSION_PATTERN.test(request.sourceFileExtension)) {
    throw new Error(`${requestPath}: adapter request sourceFileExtension must be a safe source extension token`);
  }
  const sourceFileExtensions = CANONICAL_SOURCE_FILE_EXTENSIONS[request.format];
  if (!(sourceFileExtensions instanceof Set && sourceFileExtensions.has(request.sourceFileExtension))) {
    throw new Error(`${requestPath}: adapter request sourceFileExtension ${request.sourceFileExtension} must match canonical format ${request.format}`);
  }
}

function assertSchemaReference(value, label, expectedPath, baseDir, requestPath) {
  assertString(value, label, requestPath);
  if (path.resolve(baseDir, value) !== expectedPath) {
    throw new Error(`${requestPath}: adapter request ${label} must resolve to local schema`);
  }
}

function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function fileExtensionToken(filePath) {
  return path.extname(filePath).replace(/^\./, "").toLowerCase();
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

function publicSourceStatExtension(sourceFile = {}) {
  const token = String(sourceFile.sourceFileExtension || "")
    .trim()
    .toLowerCase();
  const sourceFileExtensions = CANONICAL_SOURCE_FILE_EXTENSIONS[sourceFile.format];
  return sourceFileExtensions instanceof Set && sourceFileExtensions.has(token) ? token : "";
}

function sourceStatFingerprint(sourceFile) {
  return publicStatFingerprint(
    "source-file",
    publicSourceStatExtension(sourceFile),
    sourceFile.sourceFileSizeBytes,
    sourceFile.sourceFileModifiedTime
  );
}

function adapterRequestFingerprint(request) {
  const { adapterRequestFingerprint: _fingerprint, ...payload } = request || {};
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function adapterConfigStatFingerprint(fileSizeBytes, fileModifiedTime) {
  return publicStatFingerprint("adapter-config", "json", fileSizeBytes, fileModifiedTime);
}

function adapterRequestEvidenceFingerprint(request = {}) {
  const payload = {
    schema: request.schema || null,
    schemaVersion: request.schemaVersion || null,
    schemaVersions: request.schemaVersions && typeof request.schemaVersions === "object" && !Array.isArray(request.schemaVersions) ? {
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

function assertPathMetadata(request, requestPath) {
  assertString(request.input, "input", requestPath);
  const inputPath = path.resolve(request.input);
  assertString(request.sourceDirectory, "sourceDirectory", requestPath);
  if (path.resolve(request.sourceDirectory) !== path.dirname(inputPath)) {
    throw new Error(`${requestPath}: adapter request sourceDirectory must match input directory`);
  }
  assertString(request.sourceFileName, "sourceFileName", requestPath);
  if (request.sourceFileName !== path.basename(inputPath)) {
    throw new Error(`${requestPath}: adapter request sourceFileName must match input basename`);
  }
  assertString(request.sourceFileStem, "sourceFileStem", requestPath, { allowEmpty: true });
  if (request.sourceFileStem !== fileStem(inputPath)) {
    throw new Error(`${requestPath}: adapter request sourceFileStem must match input basename stem`);
  }
  assertString(request.sourceFileExtension, "sourceFileExtension", requestPath, { allowEmpty: true });
  if (request.sourceFileExtension !== fileExtensionToken(inputPath)) {
    throw new Error(`${requestPath}: adapter request sourceFileExtension must match input extension`);
  }
  const outputPath = path.resolve(request.output);
  if (path.resolve(request.outputDir) !== path.dirname(outputPath)) {
    throw new Error(`${requestPath}: adapter request outputDir must match output directory`);
  }
  if (path.resolve(request.stageDir) !== path.resolve(request.outputDir)) {
    throw new Error(`${requestPath}: adapter request stageDir must match outputDir`);
  }
  assertString(request.outputFileName, "outputFileName", requestPath);
  if (request.outputFileName !== path.basename(outputPath)) {
    throw new Error(`${requestPath}: adapter request outputFileName must match output basename`);
  }
  assertString(request.outputFileStem, "outputFileStem", requestPath);
  if (request.outputFileStem !== fileStem(outputPath)) {
    throw new Error(`${requestPath}: adapter request outputFileStem must match output basename stem`);
  }
  assertString(request.chunkPathPrefix, "chunkPathPrefix", requestPath);
  if (request.chunkPathPrefix !== CHUNK_PATH_PREFIX) {
    throw new Error(`${requestPath}: adapter request chunkPathPrefix must be ${CHUNK_PATH_PREFIX}`);
  }
}

function assertInputFileStatMetadata(request, requestPath) {
  let stat;
  try {
    stat = fs.statSync(path.resolve(request.input));
  } catch {
    throw new Error(`${requestPath}: adapter request input must be an existing file`);
  }
  if (!stat.isFile()) {
    throw new Error(`${requestPath}: adapter request input must be a file`);
  }
  if (request.sourceFileSizeBytes !== stat.size) {
    throw new Error(`${requestPath}: adapter request sourceFileSizeBytes must match input file size`);
  }
  const modifiedTime = stat.mtime.toISOString();
  if (request.sourceFileModifiedTime !== modifiedTime) {
    throw new Error(`${requestPath}: adapter request sourceFileModifiedTime must match input file modified time`);
  }
  const fingerprint = sourceStatFingerprint({
    format: request.format,
    sourceFileExtension: request.sourceFileExtension,
    sourceFileSizeBytes: stat.size,
    sourceFileModifiedTime: modifiedTime
  });
  if (request.sourceStatFingerprint !== fingerprint) {
    throw new Error(`${requestPath}: adapter request sourceStatFingerprint must match input file stat metadata`);
  }
}

function assertOptionalAdapterConfigMetadata(request, requestPath) {
  const hasAdapterConfigMetadata = request.adapterKey !== undefined
    || request.adapterConfigPath !== undefined
    || request.adapterConfigDir !== undefined
    || request.adapterConfigFileSizeBytes !== undefined
    || request.adapterConfigFileModifiedTime !== undefined
    || request.adapterConfigStatFingerprint !== undefined;
  const hasAdapterRegistryMetadata = request.adapterRegistryFingerprint !== undefined
    || request.adapterRegistryAdapterFingerprint !== undefined;
  if (!hasAdapterConfigMetadata && !hasAdapterRegistryMetadata) return;
  if (hasAdapterRegistryMetadata && !hasAdapterConfigMetadata) {
    throw new Error(`${requestPath}: adapter request adapterRegistryFingerprint requires adapter config metadata`);
  }
  assertRequestSafeId(request.adapterKey, "adapterKey", requestPath);
  assertString(request.adapterConfigPath, "adapterConfigPath", requestPath);
  assertString(request.adapterConfigDir, "adapterConfigDir", requestPath);
  if (path.resolve(request.adapterConfigDir) !== path.dirname(path.resolve(request.adapterConfigPath))) {
    throw new Error(`${requestPath}: adapter request adapterConfigDir must match adapterConfigPath directory`);
  }
  if (!Number.isInteger(request.adapterConfigFileSizeBytes) || request.adapterConfigFileSizeBytes < 0) {
    throw new Error(`${requestPath}: adapter request adapterConfigFileSizeBytes must be a non-negative integer`);
  }
  if (
    typeof request.adapterConfigFileModifiedTime !== "string"
    || !DATE_TIME_PATTERN.test(request.adapterConfigFileModifiedTime)
    || Number.isNaN(Date.parse(request.adapterConfigFileModifiedTime))
  ) {
    throw new Error(`${requestPath}: adapter request adapterConfigFileModifiedTime must be a date-time string`);
  }
  let stat;
  try {
    stat = fs.statSync(path.resolve(request.adapterConfigPath));
  } catch {
    throw new Error(`${requestPath}: adapter request adapterConfigPath must be an existing file`);
  }
  if (!stat.isFile()) {
    throw new Error(`${requestPath}: adapter request adapterConfigPath must be a file`);
  }
  if (request.adapterConfigFileSizeBytes !== stat.size) {
    throw new Error(`${requestPath}: adapter request adapterConfigFileSizeBytes must match adapter config file size`);
  }
  if (request.adapterConfigFileModifiedTime !== stat.mtime.toISOString()) {
    throw new Error(`${requestPath}: adapter request adapterConfigFileModifiedTime must match adapter config file modified time`);
  }
  const expectedAdapterConfigStatFingerprint = adapterConfigStatFingerprint(stat.size, stat.mtime.toISOString());
  if (request.adapterConfigStatFingerprint !== undefined) {
    if (typeof request.adapterConfigStatFingerprint !== "string" || !SOURCE_STAT_FINGERPRINT_PATTERN.test(request.adapterConfigStatFingerprint)) {
      throw new Error(`${requestPath}: adapter request adapterConfigStatFingerprint must be a stat-sha256 fingerprint`);
    }
    if (request.adapterConfigStatFingerprint !== expectedAdapterConfigStatFingerprint) {
      throw new Error(`${requestPath}: adapter request adapterConfigStatFingerprint must match adapter config file stat metadata`);
    }
  }
  if (hasAdapterRegistryMetadata) {
    if (typeof request.adapterRegistryFingerprint !== "string" || !ADAPTER_REGISTRY_FINGERPRINT_PATTERN.test(request.adapterRegistryFingerprint)) {
      throw new Error(`${requestPath}: adapter request adapterRegistryFingerprint must be a sha256 fingerprint`);
    }
    if (typeof request.adapterRegistryAdapterFingerprint !== "string" || !ADAPTER_REGISTRY_FINGERPRINT_PATTERN.test(request.adapterRegistryAdapterFingerprint)) {
      throw new Error(`${requestPath}: adapter request adapterRegistryAdapterFingerprint must be a sha256 fingerprint`);
    }
  }
}

export function assertAdapterRequestContract(request, requestPath, { formatAliases = {}, formatErrorMessage = null } = {}) {
  if (request.schema !== ADAPTER_REQUEST_SCHEMA_NAME) {
    throw new Error(`${requestPath}: expected ${ADAPTER_REQUEST_SCHEMA_NAME}`);
  }
  if (request.schemaVersion !== ADAPTER_REQUEST_SCHEMA_VERSION) {
    throw new Error(`${requestPath}: adapter request schemaVersion must be ${ADAPTER_REQUEST_SCHEMA_VERSION}`);
  }
  if (request.schemaVersions?.adapterRequest !== ADAPTER_REQUEST_SCHEMA_VERSION) {
    throw new Error(`${requestPath}: adapter request schemaVersions.adapterRequest must be ${ADAPTER_REQUEST_SCHEMA_VERSION}`);
  }
  if (request.schemaVersions?.referenceGeometry !== REFERENCE_GEOMETRY_SCHEMA_VERSION) {
    throw new Error(`${requestPath}: adapter request schemaVersions.referenceGeometry must be ${REFERENCE_GEOMETRY_SCHEMA_VERSION}`);
  }
  if (request.schemaVersions?.pointCloudChunk !== POINT_CLOUD_CHUNK_SCHEMA_VERSION) {
    throw new Error(`${requestPath}: adapter request schemaVersions.pointCloudChunk must be ${POINT_CLOUD_CHUNK_SCHEMA_VERSION}`);
  }
  if (typeof request.adapterRequestFingerprint !== "string" || !ADAPTER_REQUEST_FINGERPRINT_PATTERN.test(request.adapterRequestFingerprint)) {
    throw new Error(`${requestPath}: adapter request adapterRequestFingerprint must be a sha256 fingerprint`);
  }
  const expectedRequestFingerprint = adapterRequestFingerprint(request);
  if (request.adapterRequestFingerprint !== expectedRequestFingerprint) {
    throw new Error(`${requestPath}: adapter request adapterRequestFingerprint must match request payload`);
  }
  if (typeof request.adapterRequestEvidenceFingerprint !== "string" || !ADAPTER_REQUEST_FINGERPRINT_PATTERN.test(request.adapterRequestEvidenceFingerprint)) {
    throw new Error(`${requestPath}: adapter request adapterRequestEvidenceFingerprint must be a sha256 fingerprint`);
  }
  if (request.adapterRequestEvidenceFingerprint !== adapterRequestEvidenceFingerprint(request)) {
    throw new Error(`${requestPath}: adapter request adapterRequestEvidenceFingerprint must match path-free request evidence`);
  }
  const requestDir = path.dirname(path.resolve(requestPath));
  assertSchemaReference(request.$schema, "$schema", ADAPTER_REQUEST_SCHEMA_PATH, requestDir, requestPath);
  assertPlainObject(request.schemas, "schemas", requestPath);
  assertSchemaReference(request.schemas.adapterRequest, "schemas.adapterRequest", ADAPTER_REQUEST_SCHEMA_PATH, requestDir, requestPath);
  assertSchemaReference(request.schemas.referenceGeometry, "schemas.referenceGeometry", REFERENCE_GEOMETRY_SCHEMA_PATH, requestDir, requestPath);
  assertSchemaReference(request.schemas.pointCloudChunk, "schemas.pointCloudChunk", POINT_CLOUD_CHUNK_SCHEMA_PATH, requestDir, requestPath);
  if (typeof request.adapterRunId !== "string" || !REQUEST_RUN_ID_PATTERN.test(request.adapterRunId)) {
    throw new Error(`${requestPath}: adapter request adapterRunId must be a safe run token`);
  }
  if (typeof request.sourceStatFingerprint !== "string" || !SOURCE_STAT_FINGERPRINT_PATTERN.test(request.sourceStatFingerprint)) {
    throw new Error(`${requestPath}: adapter request sourceStatFingerprint must be a stat-sha256 fingerprint`);
  }
  if (!Number.isInteger(request.sourceFileSizeBytes) || request.sourceFileSizeBytes < 0) {
    throw new Error(`${requestPath}: adapter request sourceFileSizeBytes must be a non-negative integer`);
  }
  if (typeof request.sourceFileModifiedTime !== "string" || !DATE_TIME_PATTERN.test(request.sourceFileModifiedTime) || Number.isNaN(Date.parse(request.sourceFileModifiedTime))) {
    throw new Error(`${requestPath}: adapter request sourceFileModifiedTime must be a date-time string`);
  }
  assertFormatMetadata(request, requestPath);
  if (!SUPPORTED_OUTPUT_MODES.has(request.outputMode)) {
    throw new Error(`${requestPath}: adapter request outputMode must be file or stdout`);
  }
  if (!SUPPORTED_UNITS.has(request.units)) {
    throw new Error(`${requestPath}: adapter request units must be one of mm, m, in, or ft`);
  }
  assertPositiveInteger(request.pointCloudChunkSize, "pointCloudChunkSize", requestPath);
  assertPositiveInteger(request.timeoutMs, "timeoutMs", requestPath);
  assertRequestSafeId(request.assetId, "assetId", requestPath);
  assertString(request.name, "name", requestPath);
  assertOptionalAdapterConfigMetadata(request, requestPath);
  if (typeof request.stageDir !== "string" || !/\S/.test(request.stageDir)) {
    throw new Error(`${requestPath}: adapter request stageDir must be a non-blank string`);
  }
  const stageDir = path.resolve(request.stageDir);
  if (!isInsideOrSame(stageDir, path.resolve(requestPath))) {
    throw new Error(`${requestPath}: adapter request file must resolve inside stageDir`);
  }
  assertRequestPathMetadata(request, requestPath);
  for (const field of ["output", "outputDir", "scratchDir", "chunkDir", "adapterLogPath", "adapterStdoutPath", "adapterStderrPath"]) {
    assertContainedPath(request, field, stageDir, requestPath);
  }
  assertCanonicalStagePaths(request, stageDir, requestPath);
  assertPathMetadata(request, requestPath);
  assertInputFileStatMetadata(request, requestPath);
  const aliases = formatAliases[request.format];
  if (formatErrorMessage && !(aliases instanceof Set && aliases.has(request.requestedFormat))) {
    throw new Error(`${requestPath}: ${formatErrorMessage}`);
  }
}

export function assertAdapterScratchPath(value, scratchDir, label, requestPath) {
  assertString(value, label, requestPath);
  assertString(scratchDir, "scratchDir", requestPath);
  const resolvedScratchDir = path.resolve(scratchDir);
  const resolvedValue = path.resolve(value);
  if (!isInsideOrSame(resolvedScratchDir, resolvedValue)) {
    throw new Error(`${requestPath}: adapter ${label} must resolve inside scratchDir`);
  }
  return resolvedValue;
}

export function assertAdapterStagePath(value, stageDir, label, requestPath) {
  assertString(value, label, requestPath);
  assertString(stageDir, "stageDir", requestPath);
  const resolvedStageDir = path.resolve(stageDir);
  const resolvedValue = path.resolve(value);
  if (!isInsideOrSame(resolvedStageDir, resolvedValue)) {
    throw new Error(`${requestPath}: adapter ${label} must resolve inside stageDir`);
  }
  return resolvedValue;
}
