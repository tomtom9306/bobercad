import fs from "fs";
import path from "path";
import { validateReferenceGeometryOutput } from "../translate_reference_geometry.mjs";

const RESERVED_REFERENCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const EXTERNAL_TRANSLATOR_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isInsideOrSame(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNonBlankString(value, label, requestPath) {
  if (typeof value !== "string" || !/\S/.test(value)) {
    throw new Error(`${requestPath}: adapter output contract ${label} must be a non-blank string`);
  }
}

function assertAdapterOutputPath(outputPath, request, requestPath) {
  assertNonBlankString(outputPath, "outputPath", requestPath);
  assertNonBlankString(request.output, "request.output", requestPath);
  assertNonBlankString(request.stageDir, "request.stageDir", requestPath);
  assertNonBlankString(request.outputDir, "request.outputDir", requestPath);
  const absoluteOutput = path.resolve(outputPath);
  if (absoluteOutput !== path.resolve(request.output)) {
    throw new Error(`${requestPath}: adapter output contract outputPath must match request.output`);
  }
  if (path.dirname(absoluteOutput) !== path.resolve(request.outputDir)) {
    throw new Error(`${requestPath}: adapter output contract request.outputDir must match output directory`);
  }
  if (!isInsideOrSame(path.resolve(request.stageDir), absoluteOutput)) {
    throw new Error(`${requestPath}: adapter output contract outputPath must resolve inside request.stageDir`);
  }
  if (!fs.existsSync(absoluteOutput)) {
    throw new Error(`${requestPath}: adapter output contract output file does not exist: ${absoluteOutput}`);
  }
  return absoluteOutput;
}

function assertAdapterOutputAsset(data, request, requestPath, outputPath) {
  assertNonBlankString(request.assetId, "request.assetId", requestPath);
  assertNonBlankString(request.name, "request.name", requestPath);
  assertNonBlankString(request.units, "request.units", requestPath);
  if (data.asset?.id !== request.assetId) {
    throw new Error(`${outputPath}: adapter output asset.id must match request.assetId ${request.assetId}`);
  }
  if (data.asset?.name !== request.name) {
    throw new Error(`${outputPath}: adapter output asset.name must match request.name ${request.name}`);
  }
  if (data.asset?.units !== request.units) {
    throw new Error(`${outputPath}: adapter output asset.units must match request.units ${request.units}`);
  }
  if (typeof request.format === "string" && request.format && data.asset?.source?.format !== request.format) {
    throw new Error(`${outputPath}: adapter output asset.source.format must match request.format ${request.format}`);
  }
  if (typeof request.requestedFormat === "string" && request.requestedFormat && data.asset?.source?.requestedFormat !== request.requestedFormat) {
    throw new Error(`${outputPath}: adapter output asset.source.requestedFormat must match request.requestedFormat ${request.requestedFormat}`);
  }
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "fileName", "sourceFileName");
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "fileExtension", "sourceFileExtension");
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "fileSizeBytes", "sourceFileSizeBytes");
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "modifiedTime", "sourceFileModifiedTime");
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "statFingerprint", "sourceStatFingerprint");
  assertOptionalAdapterOutputSourceField(data, request, outputPath, "adapterKey", "adapterKey");
  if (request.adapterKey !== undefined && Object.hasOwn(data.asset?.source || {}, "checksum")) {
    throw new Error(`${outputPath}: adapter output asset.source.checksum must be omitted for external adapter output; source checksums must be verified outside the adapter output boundary`);
  }
  if (request.adapterKey !== undefined) {
    assertAdapterOutputSourceProvenance(data, outputPath);
  }
}

function isReferenceId(value) {
  return typeof value === "string" && REFERENCE_ID_PATTERN.test(value) && !RESERVED_REFERENCE_IDS.has(value);
}

function safeExternalSourceTranslator(value) {
  if (typeof value !== "string") return false;
  const token = value.trim();
  if (token !== value) return false;
  if (token.startsWith("external:")) return isReferenceId(token.slice("external:".length));
  return isReferenceId(token);
}

function safeExternalSourceTranslatorVersion(value) {
  return typeof value === "string" && value.trim() === value && EXTERNAL_TRANSLATOR_VERSION_PATTERN.test(value);
}

function assertAdapterOutputSourceProvenance(data, outputPath) {
  const source = data.asset?.source || {};
  if (Object.hasOwn(source, "translator") && !safeExternalSourceTranslator(source.translator)) {
    throw new Error(`${outputPath}: adapter output asset.source.translator must be a safe external adapter provenance token`);
  }
  if (Object.hasOwn(source, "translatorVersion") && !safeExternalSourceTranslatorVersion(source.translatorVersion)) {
    throw new Error(`${outputPath}: adapter output asset.source.translatorVersion must be a short path-free external adapter version token`);
  }
}

function assertOptionalAdapterOutputSourceField(data, request, outputPath, sourceField, requestField) {
  if (request?.[requestField] === undefined) return;
  if (data.asset?.source?.[sourceField] === undefined) {
    throw new Error(`${outputPath}: adapter output asset.source.${sourceField} must match request.${requestField} ${request[requestField]}`);
  }
  if (data.asset.source[sourceField] !== request[requestField]) {
    throw new Error(`${outputPath}: adapter output asset.source.${sourceField} must match request.${requestField} ${request[requestField]}`);
  }
}

function assertAdapterOutputChunkPaths(data, request, requestPath, outputPath) {
  assertNonBlankString(request.chunkDir, "request.chunkDir", requestPath);
  assertNonBlankString(request.chunkPathPrefix, "request.chunkPathPrefix", requestPath);
  const outputDir = path.dirname(path.resolve(outputPath));
  const chunkDir = path.resolve(request.chunkDir);
  for (const chunk of data.chunks || []) {
    if (!chunk?.path) continue;
    if (!chunk.path.startsWith(request.chunkPathPrefix)) {
      throw new Error(`${outputPath}: adapter output chunk ${chunk.id || "<missing>"} path must start with request.chunkPathPrefix ${request.chunkPathPrefix}`);
    }
    const chunkPath = path.resolve(outputDir, chunk.path);
    if (!isInsideOrSame(chunkDir, chunkPath)) {
      throw new Error(`${outputPath}: adapter output chunk ${chunk.id || "<missing>"} path must resolve inside request.chunkDir`);
    }
  }
}

function assertAdapterOutputProvenanceBeforeSchema(outputPath, request) {
  if (request.adapterKey === undefined) return;
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch {
    return;
  }
  const source = data.asset?.source || {};
  if (source.adapterKey !== request.adapterKey || Object.hasOwn(source, "checksum")) return;
  assertAdapterOutputSourceProvenance(data, outputPath);
}

export function assertAdapterOutputContract(outputPath, request, requestPath = "<adapter-request>", options = {}) {
  if (!isRecord(request)) {
    throw new Error(`${requestPath}: adapter output contract request must be an object`);
  }
  const absoluteOutput = assertAdapterOutputPath(outputPath, request, requestPath);
  assertAdapterOutputProvenanceBeforeSchema(absoluteOutput, request);
  const data = validateReferenceGeometryOutput(absoluteOutput, {
    allowChunkableInlinePointCloudBounds: options.allowChunkableInlinePointCloudBounds === true,
    pointCloudChunkSize: request.pointCloudChunkSize
  });
  assertAdapterOutputAsset(data, request, requestPath, absoluteOutput);
  assertAdapterOutputChunkPaths(data, request, requestPath, absoluteOutput);
  return data;
}
