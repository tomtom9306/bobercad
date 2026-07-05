import { finiteNumber, finitePositiveNumber, v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { addLine, addLoopLines } from "./scene-line-face-assembly.mjs";
import { shouldRenderReferenceGeometry } from "./scene-annotation-metadata.mjs";

const DEFAULT_COLOR = "#2563eb";
const DEFAULT_EDGE_COLOR = "#1e3a8a";
const DEFAULT_OPACITY = 0.36;
const DEFAULT_POINT_SIZE = 24;
const DEFAULT_POINT_PREVIEW_LIMIT = 5000;
const DEFAULT_POINT_PREVIEW_CHUNK_LIMIT = 128;
const DEFAULT_LINE_SEGMENT_PREVIEW_LIMIT = 100000;
const DEFAULT_MESH_FACE_PREVIEW_LIMIT = 50000;
const PREVIEW_STATS_OBJECT_LIMIT = 1000;
const REFERENCE_GEOMETRY_SCHEMA = "bobercad-reference-geometry";
const REFERENCE_GEOMETRY_SCHEMA_VERSION = "0.1.0";
const REFERENCE_POINT_CLOUD_CHUNK_SCHEMA = "bobercad-reference-point-cloud-chunk";
const REFERENCE_POINT_CLOUD_CHUNK_SCHEMA_VERSION = "0.1.0";
const REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID = "tools/reference-geometry/translate_reference_geometry.mjs";
const REFERENCE_METADATA_MAX_JSON_LENGTH = 8192;
const REFERENCE_METADATA_MAX_DEPTH = 3;
const REFERENCE_METADATA_MAX_ENTRY_COUNT = 32;
const REFERENCE_METADATA_MAX_ARRAY_LENGTH = 128;
const REFERENCE_METADATA_MAX_STRING_LENGTH = 512;
const REFERENCE_METADATA_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const REFERENCE_METADATA_ALLOWED_SLASH_STRINGS = new Set([
  REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID
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
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DISPLAY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const RESERVED_REFERENCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_BOUNDS_KEYS = new Set(["min", "max"]);
const REFERENCE_MANIFEST_KEYS = new Set(["$schema", "schema", "schemaVersion", "asset", "layers", "objects", "chunks", "diagnostics"]);
const REFERENCE_ASSET_KEYS = new Set(["id", "name", "source", "units", "coordinateSystem", "bounds"]);
const REFERENCE_SOURCE_KEYS = new Set(["format", "fileName", "fileExtension", "requestedFormat", "fileSizeBytes", "modifiedTime", "statFingerprint", "checksum", "translator", "translatorVersion", "adapterKey"]);
const REFERENCE_LAYER_KEYS = new Set(["id", "name", "display"]);
const REFERENCE_OBJECT_KEYS = new Set(["id", "kind", "name", "layer", "display", "metadata", "bounds", "vertices", "lineSegments", "faces", "points", "pointAttributes", "chunkIds"]);
const REFERENCE_DISPLAY_KEYS = new Set(["visible", "color", "edgeColor", "opacity", "pointSize"]);
const REFERENCE_MANIFEST_CHUNK_KEYS = new Set(["id", "kind", "objectId", "path", "pointCount", "bounds"]);
const REFERENCE_POINT_CLOUD_CHUNK_KEYS = new Set(["$schema", "schema", "schemaVersion", "id", "kind", "objectId", "pointCount", "bounds", "points", "pointAttributes", "metadata"]);
const POINT_ATTRIBUTE_KEYS = new Set(["colors", "intensities", "classifications", "normals"]);
const REFERENCE_DIAGNOSTIC_KEYS = new Set(["severity", "code", "message", "objectId", "objectRefs"]);
const REFERENCE_DIAGNOSTIC_SEVERITIES = new Set(["info", "warning", "error"]);
const REFERENCE_OBJECT_GEOMETRY_KEYS = ["vertices", "lineSegments", "faces", "points", "pointAttributes", "chunkIds"];
const REFERENCE_OBJECT_GEOMETRY_KEYS_BY_KIND = Object.freeze({
  "line-set": new Set(["vertices", "lineSegments"]),
  mesh: new Set(["vertices", "faces"]),
  "point-cloud": new Set(["points", "pointAttributes", "chunkIds"])
});
const REFERENCE_COORDINATE_SYSTEM_KEYS = new Set(["origin", "axisX", "axisY", "axisZ"]);
const PROJECT_REFERENCE_ASSET_KEYS = new Set(["path", "visible", "snapEnabled", "display", "transform"]);
const PROJECT_REFERENCE_TRANSFORM_KEYS = new Set(["origin", "axisX", "axisY", "axisZ", "scale"]);
const SUPPORTED_REFERENCE_SOURCE_FORMATS = new Set(["dxf", "dwg", "step", "ifc", "e57", "e57pointcloud", "json", "unknown"]);
const SOURCE_EXTENSION_PATTERN = /^$|^[a-z0-9][a-z0-9_-]*$/;
const SOURCE_REQUESTED_FORMAT_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const SOURCE_REQUESTED_FORMATS_BY_SOURCE_FORMAT = Object.freeze({
  dxf: Object.freeze(["dxf"]),
  dwg: Object.freeze(["dwg"]),
  step: Object.freeze(["step", "stp", "p21", "stpnc"]),
  ifc: Object.freeze(["ifc", "ifcxml", "ifczip"]),
  e57: Object.freeze(["e57", "e57pointcloud", "e57pc"]),
  e57pointcloud: Object.freeze(["e57", "e57pointcloud", "e57pc"]),
  json: Object.freeze(["json"])
});
const SOURCE_FILE_EXTENSIONS_BY_SOURCE_FORMAT = Object.freeze({
  dxf: Object.freeze(["dxf"]),
  dwg: Object.freeze(["dwg"]),
  step: Object.freeze(["step", "stp", "p21", "stpnc"]),
  ifc: Object.freeze(["ifc", "ifcxml", "ifczip"]),
  e57: Object.freeze(["e57"]),
  e57pointcloud: Object.freeze(["e57"]),
  json: Object.freeze(["json"])
});
const SOURCE_STAT_FINGERPRINT_PATTERN = /^stat-sha256:[0-9a-f]{64}$/;
const SOURCE_CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_TRANSLATOR_MACHINE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SOURCE_TRANSLATOR_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const SOURCE_FILE_NAME_MAX_LENGTH = 255;
const SOURCE_FILE_NAME_PATTERN = /^(?!\.{1,2}$)(?!\s)(?!.*\s$)[^\\/:?#\u0000-\u001f\u007f]{1,255}$/;
const DIAGNOSTIC_CODE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
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
const RFC3339_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;
const REFERENCE_PROJECT_ASSET_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/;
const UNIT_TO_MM = {
  mm: 1,
  m: 1000,
  in: 25.4,
  ft: 304.8
};
const SUPPORTED_REFERENCE_UNITS = new Set(Object.keys(UNIT_TO_MM));

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function finiteBounds(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && finiteVec3(value.min)
    && finiteVec3(value.max)
    && value.min.every((component, index) => component <= value.max[index]);
}

function sameVec3(a, b) {
  return finiteVec3(a) && finiteVec3(b) && a.every((value, index) => Math.abs(value - b[index]) <= 1e-9);
}

function sameBounds(a, b) {
  return finiteBounds(a) && finiteBounds(b) && sameVec3(a.min, b.min) && sameVec3(a.max, b.max);
}

function objectValues(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.values(value) : [];
}

function safeReferenceId(value) {
  return typeof value === "string" && REFERENCE_ID_PATTERN.test(value) && !RESERVED_REFERENCE_IDS.has(value);
}

function validSourceTranslator(value) {
  if (value === REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID) return true;
  if (SOURCE_TRANSLATOR_MACHINE_TOKEN_PATTERN.test(value)) return true;
  if (value.startsWith("external:")) return safeReferenceId(value.slice("external:".length));
  return false;
}

function safeProjectReferenceAssetPath(pathValue) {
  if (typeof pathValue !== "string") return false;
  if (!pathValue || pathValue.trim() !== pathValue) return false;
  if (/[\\?#]|[\u0000-\u001f\u007f]/.test(pathValue)) return false;
  const segments = pathValue.split("/");
  if (segments.length !== 3 || segments[0] !== ".." || segments[1] !== "references") return false;
  return REFERENCE_PROJECT_ASSET_FILENAME_PATTERN.test(segments[2]);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeSourceFileName(value) {
  return typeof value === "string"
    && value.length <= SOURCE_FILE_NAME_MAX_LENGTH
    && SOURCE_FILE_NAME_PATTERN.test(value);
}

function safeDiagnosticCode(value) {
  return typeof value === "string" && DIAGNOSTIC_CODE_PATTERN.test(value);
}

function safeDiagnosticMessage(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= DIAGNOSTIC_MESSAGE_MAX_LENGTH
    && DIAGNOSTIC_MESSAGE_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

function safeDisplayName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= DISPLAY_NAME_MAX_LENGTH
    && value.trim() === value
    && DISPLAY_NAME_FORBIDDEN_PATTERNS.every((pattern) => !pattern.test(value));
}

function safeRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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

function validReferenceMetadataValue(value, depth = 0) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return safeReferenceMetadataString(value);
  if (Array.isArray(value)) {
    return depth < REFERENCE_METADATA_MAX_DEPTH
      && value.length <= REFERENCE_METADATA_MAX_ARRAY_LENGTH
      && value.every((item) => validReferenceMetadataValue(item, depth + 1));
  }
  if (safeRecord(value)) {
    const entries = Object.entries(value);
    return depth < REFERENCE_METADATA_MAX_DEPTH
      && entries.length <= REFERENCE_METADATA_MAX_ENTRY_COUNT
      && entries.every(([key, child]) => safeReferenceMetadataKey(key) && validReferenceMetadataValue(child, depth + 1));
  }
  return false;
}

function validReferenceMetadataRecord(metadata) {
  if (metadata === undefined) return true;
  if (!safeRecord(metadata)) return false;
  const encoded = JSON.stringify(metadata);
  return typeof encoded === "string"
    && encoded.length <= REFERENCE_METADATA_MAX_JSON_LENGTH
    && validReferenceMetadataValue(metadata);
}

function supportedKeys(value, allowedKeys) {
  return safeRecord(value) && Object.keys(value).every((key) => allowedKeys.has(key));
}

function validDateTimeString(value) {
  const match = typeof value === "string" ? RFC3339_DATE_TIME_PATTERN.exec(value) : null;
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

function validIdentityMap(collection) {
  if (!safeRecord(collection)) return false;
  return Object.entries(collection).every(([key, value]) => (
    safeReferenceId(key)
    && safeRecord(value)
    && safeReferenceId(value.id)
    && value.id === key
  ));
}

function validDisplayMetadata(display) {
  if (display === undefined) return true;
  if (!supportedKeys(display, REFERENCE_DISPLAY_KEYS)) return false;
  if (display.visible !== undefined && typeof display.visible !== "boolean") return false;
  for (const key of ["color", "edgeColor"]) {
    if (display[key] !== undefined && (typeof display[key] !== "string" || !DISPLAY_COLOR_PATTERN.test(display[key]))) return false;
  }
  if (display.opacity !== undefined && (!finiteNumber(display.opacity) || display.opacity < 0 || display.opacity > 1)) return false;
  if (display.pointSize !== undefined && !finitePositiveNumber(display.pointSize)) return false;
  return true;
}

function validProjectDisplayOverride(display) {
  if (display === undefined) return true;
  if (!supportedKeys(display, REFERENCE_DISPLAY_KEYS)) return false;
  if (display.visible !== undefined && typeof display.visible !== "boolean") return false;
  if (display.pointSize !== undefined && !finitePositiveNumber(display.pointSize)) return false;
  return true;
}

function validBoundsMetadata(bounds) {
  return bounds === undefined || (supportedKeys(bounds, REFERENCE_BOUNDS_KEYS) && finiteBounds(bounds));
}

function validReferenceLayerMap(layers) {
  if (!validIdentityMap(layers)) return false;
  return Object.values(layers).every((layer) => (
    supportedKeys(layer, REFERENCE_LAYER_KEYS)
    && safeDisplayName(layer.name)
    && validDisplayMetadata(layer.display)
  ));
}

function validObjectKindPayload(object) {
  const allowedGeometryKeys = REFERENCE_OBJECT_GEOMETRY_KEYS_BY_KIND[object.kind];
  if (!allowedGeometryKeys) return false;
  return REFERENCE_OBJECT_GEOMETRY_KEYS.every((key) => (
    object[key] === undefined || allowedGeometryKeys.has(key)
  ));
}

function validPointAttributeMetadata(pointAttributes) {
  return pointAttributes === undefined || (
    safeRecord(pointAttributes)
    && Object.keys(pointAttributes).every((key) => POINT_ATTRIBUTE_KEYS.has(key))
  );
}

function validReferenceObjectMap(objects) {
  if (!validIdentityMap(objects)) return false;
  return Object.values(objects).every((object) => (
    supportedKeys(object, REFERENCE_OBJECT_KEYS)
    && (object.name === undefined || safeDisplayName(object.name))
    && validReferenceMetadataRecord(object.metadata)
    && validPointAttributeMetadata(object.pointAttributes)
    && validBoundsMetadata(object.bounds)
    && validDisplayMetadata(object.display)
    && validObjectKindPayload(object)
  ));
}

function validReferenceDiagnostic(diagnostic, objectIds) {
  if (!supportedKeys(diagnostic, REFERENCE_DIAGNOSTIC_KEYS)) return false;
  if (!REFERENCE_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity)) return false;
  if (!safeDiagnosticCode(diagnostic.code) || !safeDiagnosticMessage(diagnostic.message)) return false;
  if (diagnostic.objectId !== undefined && (!safeReferenceId(diagnostic.objectId) || !objectIds.has(diagnostic.objectId))) return false;
  if (diagnostic.objectRefs !== undefined) {
    if (!Array.isArray(diagnostic.objectRefs) || !diagnostic.objectRefs.length) return false;
    const seen = new Set();
    for (const objectRef of diagnostic.objectRefs) {
      if (!safeReferenceId(objectRef) || seen.has(objectRef) || !objectIds.has(objectRef)) return false;
      seen.add(objectRef);
    }
  }
  return true;
}

function validReferenceDiagnostics(diagnostics, objects) {
  if (!Array.isArray(diagnostics)) return false;
  const objectIds = new Set(Object.keys(objects || {}));
  return diagnostics.every((diagnostic) => validReferenceDiagnostic(diagnostic, objectIds));
}

function validReferenceManifestChunks(chunks, objects) {
  if (!Array.isArray(chunks)) return false;
  const seen = new Set();
  for (const chunk of chunks) {
    if (!supportedKeys(chunk, REFERENCE_MANIFEST_CHUNK_KEYS)) return false;
    if (!safeReferenceId(chunk.id) || seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    const object = objects?.[chunk.objectId];
    if (!object || object.kind !== "point-cloud") return false;
    if (!validManifestChunk(chunk, chunk.id, object.id)) return false;
    if (!Array.isArray(object.chunkIds) || !object.chunkIds.includes(chunk.id)) return false;
  }
  return true;
}

function unionBounds(boundsList) {
  const validBounds = (boundsList || []).filter(finiteBounds);
  if (!validBounds.length) return null;
  const min = [...validBounds[0].min];
  const max = [...validBounds[0].max];
  for (const bounds of validBounds.slice(1)) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], bounds.min[index]);
      max[index] = Math.max(max[index], bounds.max[index]);
    }
  }
  return { min, max };
}

function completeUnionBounds(boundsList) {
  const values = boundsList || [];
  if (!values.length || values.some((bounds) => !finiteBounds(bounds))) return null;
  return unionBounds(values);
}

function referenceObjectPayloadBounds(assetData, object) {
  if (object?.kind === "line-set") {
    const points = validLineSetPoints(object);
    return points ? pointPayloadBounds(points) : null;
  }
  if (object?.kind === "mesh") {
    const points = validMeshPoints(object);
    return points ? pointPayloadBounds(points) : null;
  }
  if (object?.kind === "point-cloud") {
    const storage = pointCloudStorage(assetData, object);
    if (!storage) return null;
    if (storage.mode === "inline") return pointPayloadBounds(storage.points);
    return completeUnionBounds(storage.chunkIds.map((chunkId) => storage.chunksById.get(chunkId)?.bounds));
  }
  return null;
}

function validReferenceBounds(assetData) {
  const payloadBounds = [];
  for (const object of objectValues(assetData.objects)) {
    const objectPayloadBounds = referenceObjectPayloadBounds(assetData, object);
    if (object.bounds !== undefined && (!objectPayloadBounds || !sameBounds(object.bounds, objectPayloadBounds))) return false;
    payloadBounds.push(objectPayloadBounds);
  }
  if (assetData.asset.bounds === undefined) return true;
  const assetPayloadBounds = completeUnionBounds(payloadBounds);
  return Boolean(assetPayloadBounds && sameBounds(assetData.asset.bounds, assetPayloadBounds));
}

function sourceRequestedFormatAllowed(sourceFormat, requestedFormat) {
  const allowed = SOURCE_REQUESTED_FORMATS_BY_SOURCE_FORMAT[sourceFormat];
  return Array.isArray(allowed) && allowed.includes(requestedFormat);
}

function sourceFileExtensionAllowed(sourceFormat, fileExtension) {
  if (fileExtension === "") return true;
  const allowed = SOURCE_FILE_EXTENSIONS_BY_SOURCE_FORMAT[sourceFormat];
  return !Array.isArray(allowed) || allowed.includes(fileExtension);
}

function validReferenceSource(source) {
  if (!supportedKeys(source, REFERENCE_SOURCE_KEYS)) return false;
  if (!SUPPORTED_REFERENCE_SOURCE_FORMATS.has(source.format)) return false;
  if (source.fileName !== undefined && !safeSourceFileName(source.fileName)) return false;
  if (source.checksum !== undefined && (typeof source.checksum !== "string" || !SOURCE_CHECKSUM_PATTERN.test(source.checksum))) return false;
  if (source.translator !== undefined && (typeof source.translator !== "string" || !validSourceTranslator(source.translator))) return false;
  if (source.translatorVersion !== undefined && (typeof source.translatorVersion !== "string" || !SOURCE_TRANSLATOR_VERSION_PATTERN.test(source.translatorVersion))) return false;
  if (source.fileExtension !== undefined && (
    typeof source.fileExtension !== "string"
    || !SOURCE_EXTENSION_PATTERN.test(source.fileExtension)
    || !sourceFileExtensionAllowed(source.format, source.fileExtension)
  )) return false;
  if (source.requestedFormat !== undefined) {
    if (typeof source.requestedFormat !== "string" || !SOURCE_REQUESTED_FORMAT_PATTERN.test(source.requestedFormat)) return false;
    if (!sourceRequestedFormatAllowed(source.format, source.requestedFormat)) return false;
  }
  if (source.fileSizeBytes !== undefined && (!Number.isInteger(source.fileSizeBytes) || source.fileSizeBytes < 0)) return false;
  if (source.modifiedTime !== undefined && !validDateTimeString(source.modifiedTime)) return false;
  if (source.statFingerprint !== undefined && (typeof source.statFingerprint !== "string" || !SOURCE_STAT_FINGERPRINT_PATTERN.test(source.statFingerprint))) return false;
  if (source.adapterKey !== undefined && !safeReferenceId(source.adapterKey)) return false;
  return true;
}

function finiteUnit(value) {
  if (!finiteVec3(value)) return null;
  const unit = v.norm(value);
  return v.len(unit) > 1e-9 ? unit : null;
}

function nonDegenerateBasis(axisX, axisY, axisZ) {
  return finiteVec3(axisX)
    && finiteVec3(axisY)
    && finiteVec3(axisZ)
    && Math.abs(v.dot(v.cross(axisX, axisY), axisZ)) > 1e-9;
}

function unitScale(sourceUnits, targetUnits) {
  const source = SUPPORTED_REFERENCE_UNITS.has(sourceUnits) ? UNIT_TO_MM[sourceUnits] : null;
  const target = SUPPORTED_REFERENCE_UNITS.has(targetUnits) ? UNIT_TO_MM[targetUnits] : null;
  return source && target ? source / target : 1;
}

function frameFromTransform(transform = {}, {
  allowedKeys = PROJECT_REFERENCE_TRANSFORM_KEYS,
  requireOrigin = false,
  requireAxes = false,
  scaleMultiplier = 1,
  scaleOrigin = false
} = {}) {
  if (!supportedKeys(transform, allowedKeys)) return null;
  const transformScale = transform.scale === undefined ? 1 : transform.scale;
  if (!finitePositiveNumber(transformScale) || !finitePositiveNumber(scaleMultiplier)) return null;
  const origin = transform.origin === undefined && !requireOrigin ? [0, 0, 0] : transform.origin;
  if (!finiteVec3(origin)) return null;
  const axisX = transform.axisX === undefined && !requireAxes ? [1, 0, 0] : finiteUnit(transform.axisX);
  const axisY = transform.axisY === undefined && !requireAxes ? [0, 1, 0] : finiteUnit(transform.axisY);
  const axisZ = transform.axisZ === undefined && !requireAxes ? [0, 0, 1] : finiteUnit(transform.axisZ);
  if (!nonDegenerateBasis(axisX, axisY, axisZ)) return null;
  const scale = transformScale * scaleMultiplier;
  return {
    origin: scaleOrigin ? v.mul(origin, scale) : origin,
    axisX,
    axisY,
    axisZ,
    scale
  };
}

function transformVector(frame, vector) {
  if (!finiteVec3(vector)) return null;
  return v.add(
    v.mul(frame.axisX, vector[0] * frame.scale),
    v.add(v.mul(frame.axisY, vector[1] * frame.scale), v.mul(frame.axisZ, vector[2] * frame.scale))
  );
}

function composeFrames(outer, inner) {
  if (!outer || !inner) return null;
  const frame = {
    origin: transformPoint(outer, inner.origin) || [0, 0, 0],
    axisX: transformVector(outer, v.mul(inner.axisX, inner.scale)) || [1, 0, 0],
    axisY: transformVector(outer, v.mul(inner.axisY, inner.scale)) || [0, 1, 0],
    axisZ: transformVector(outer, v.mul(inner.axisZ, inner.scale)) || [0, 0, 1],
    scale: 1
  };
  return nonDegenerateBasis(frame.axisX, frame.axisY, frame.axisZ) ? frame : null;
}

function referenceFrame(scene, assetData = {}, assetRef = {}) {
  const assetUnits = assetData.asset?.units;
  const projectUnits = scene?.project?.settings?.units?.length || assetUnits;
  if (!SUPPORTED_REFERENCE_UNITS.has(assetUnits) || !SUPPORTED_REFERENCE_UNITS.has(projectUnits)) return null;
  const assetFrame = frameFromTransform(assetData.asset?.coordinateSystem || {}, {
    allowedKeys: REFERENCE_COORDINATE_SYSTEM_KEYS,
    requireOrigin: true,
    requireAxes: true,
    scaleMultiplier: unitScale(assetUnits, projectUnits),
    scaleOrigin: true
  });
  const projectFrame = frameFromTransform(assetRef.transform || {});
  return composeFrames(projectFrame, assetFrame);
}

function validReferenceAssetData(assetData, assetRef) {
  return safeRecord(assetData)
    && supportedKeys(assetData, REFERENCE_MANIFEST_KEYS)
    && nonEmptyString(assetData.$schema)
    && assetData.schema === REFERENCE_GEOMETRY_SCHEMA
    && assetData.schemaVersion === REFERENCE_GEOMETRY_SCHEMA_VERSION
    && safeRecord(assetData.asset)
    && supportedKeys(assetData.asset, REFERENCE_ASSET_KEYS)
    && safeReferenceId(assetData.asset.id)
    && assetData.asset.id === assetRef.id
    && safeDisplayName(assetData.asset.name)
    && validReferenceSource(assetData.asset.source)
    && SUPPORTED_REFERENCE_UNITS.has(assetData.asset.units)
    && validBoundsMetadata(assetData.asset.bounds)
    && validReferenceLayerMap(assetData.layers)
    && validReferenceObjectMap(assetData.objects)
    && validReferenceManifestChunks(assetData.chunks, assetData.objects)
    && validReferenceDiagnostics(assetData.diagnostics, assetData.objects)
    && validReferenceBounds(assetData);
}

function validReferenceProjectAssetRef(projectAsset) {
  if (projectAsset === undefined) return true;
  if (!supportedKeys(projectAsset, PROJECT_REFERENCE_ASSET_KEYS)) return false;
  if (!safeProjectReferenceAssetPath(projectAsset.path)) return false;
  if (projectAsset.visible !== undefined && typeof projectAsset.visible !== "boolean") return false;
  if (projectAsset.snapEnabled !== undefined && typeof projectAsset.snapEnabled !== "boolean") return false;
  if (!validProjectDisplayOverride(projectAsset.display)) return false;
  if (projectAsset.transform !== undefined && !frameFromTransform(projectAsset.transform)) return false;
  return true;
}

function transformPoint(frame, point) {
  if (!finiteVec3(point)) return null;
  return v.add(
    frame.origin,
    v.add(
      v.mul(frame.axisX, point[0] * frame.scale),
      v.add(v.mul(frame.axisY, point[1] * frame.scale), v.mul(frame.axisZ, point[2] * frame.scale))
    )
  );
}

function pointPayloadBounds(points) {
  const values = arrayValues(points);
  if (!values.length || !values.every(finiteVec3)) return null;
  const min = [...values[0]];
  const max = [...values[0]];
  for (const point of values.slice(1)) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }
  return { min, max };
}

function displayColorFrom(key, fallback, ...sources) {
  for (const source of sources) {
    const value = source?.[key];
    if (typeof value === "string" && DISPLAY_COLOR_PATTERN.test(value)) return value;
  }
  return fallback;
}

function colorFrom(...sources) {
  return displayColorFrom("color", DEFAULT_COLOR, ...sources);
}

function edgeColorFrom(...sources) {
  return displayColorFrom("edgeColor", DEFAULT_EDGE_COLOR, ...sources);
}

function opacityFrom(...sources) {
  for (const source of sources) {
    if (finiteNumber(source?.opacity) && source.opacity >= 0 && source.opacity <= 1) return source.opacity;
  }
  return DEFAULT_OPACITY;
}

function pointSizeFrom(...sources) {
  for (const source of sources) {
    if (finitePositiveNumber(source?.pointSize)) return source.pointSize;
  }
  return DEFAULT_POINT_SIZE;
}

function pointPreviewLimit(scene) {
  return referencePreviewLimit(scene, "pointPreviewLimit", DEFAULT_POINT_PREVIEW_LIMIT);
}

function pointPreviewChunkLimit(scene) {
  return referencePreviewLimit(scene, "pointPreviewChunkLimit", DEFAULT_POINT_PREVIEW_CHUNK_LIMIT);
}

function lineSegmentPreviewLimit(scene) {
  return referencePreviewLimit(scene, "lineSegmentPreviewLimit", DEFAULT_LINE_SEGMENT_PREVIEW_LIMIT);
}

function meshFacePreviewLimit(scene) {
  return referencePreviewLimit(scene, "meshFacePreviewLimit", DEFAULT_MESH_FACE_PREVIEW_LIMIT);
}

function referencePreviewLimit(scene, key, fallback) {
  const value = scene?.settings?.render?.referenceGeometry?.[key];
  return finiteNumber(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function referencePreviewStats(scene) {
  if (!scene.referenceGeometryPreviewStats) {
    scene.referenceGeometryPreviewStats = {
      limits: {
        pointPreviewLimit: pointPreviewLimit(scene),
        pointPreviewChunkLimit: pointPreviewChunkLimit(scene),
        lineSegmentPreviewLimit: lineSegmentPreviewLimit(scene),
        meshFacePreviewLimit: meshFacePreviewLimit(scene),
        objectEntryLimit: PREVIEW_STATS_OBJECT_LIMIT
      },
      totals: {
        assetCount: 0,
        objectCount: 0,
        clippedObjectCount: 0,
        renderedPointCount: 0,
        omittedPointCount: 0,
        renderedLineSegmentCount: 0,
        omittedLineSegmentCount: 0,
        renderedMeshFaceCount: 0,
        omittedMeshFaceCount: 0
      },
      objects: [],
      objectEntryOmittedCount: 0
    };
  }
  return scene.referenceGeometryPreviewStats;
}

function recordReferencePreviewObject(scene, entry) {
  const stats = referencePreviewStats(scene);
  const pointOmitted = Math.max(0, entry.omittedPointCount || 0);
  const lineOmitted = Math.max(0, entry.omittedLineSegmentCount || 0);
  const faceOmitted = Math.max(0, entry.omittedMeshFaceCount || 0);
  const item = {
    ...entry,
    clipped: pointOmitted > 0 || lineOmitted > 0 || faceOmitted > 0
  };
  stats.totals.objectCount += 1;
  if (item.clipped) stats.totals.clippedObjectCount += 1;
  stats.totals.renderedPointCount += Math.max(0, item.renderedPointCount || 0);
  stats.totals.omittedPointCount += pointOmitted;
  stats.totals.renderedLineSegmentCount += Math.max(0, item.renderedLineSegmentCount || 0);
  stats.totals.omittedLineSegmentCount += lineOmitted;
  stats.totals.renderedMeshFaceCount += Math.max(0, item.renderedMeshFaceCount || 0);
  stats.totals.omittedMeshFaceCount += faceOmitted;
  if (stats.objects.length < PREVIEW_STATS_OBJECT_LIMIT) stats.objects.push(item);
  else stats.objectEntryOmittedCount += 1;
}

function objectVisible(assetRef, layer, object) {
  if (assetRef.visible === false) return false;
  if (assetRef.display?.visible === false) return false;
  if (layer?.display?.visible === false) return false;
  if (object.display?.visible === false) return false;
  return true;
}

function objectLayer(assetData, object) {
  if (object?.layer === undefined) return { valid: true, layer: null };
  if (!safeReferenceId(object.layer)) return { valid: false, layer: null };
  const layers = assetData?.layers;
  if (!layers || typeof layers !== "object" || Array.isArray(layers)) return { valid: false, layer: null };
  if (!Object.prototype.hasOwnProperty.call(layers, object.layer)) return { valid: false, layer: null };
  const layer = layers[object.layer];
  if (!layer || typeof layer !== "object" || Array.isArray(layer)) return { valid: false, layer: null };
  if (!safeReferenceId(layer.id) || layer.id !== object.layer) return { valid: false, layer: null };
  return { valid: true, layer };
}

function objectStyle(assetRef, layer, object) {
  const display = object.display || {};
  const layerDisplay = layer?.display || {};
  const assetDisplay = assetRef.display || {};
  const opacity = opacityFrom(display, layerDisplay, assetDisplay);
  const referenceAssetId = assetRef.id || "reference-geometry";
  return {
    color: colorFrom(display, layerDisplay, assetDisplay),
    edgeColor: edgeColorFrom(display, layerDisplay, assetDisplay),
    pointSize: pointSizeFrom(display, layerDisplay, assetDisplay),
    meta: {
      collection: "referenceGeometry",
      objectId: `${referenceAssetId}:${object.id}`,
      referenceAssetId,
      referenceObjectId: object.id,
      referenceObjectKind: object.kind,
      referenceSnapEnabled: assetRef.snapEnabled === true,
      opacity,
      lodDetailObjectId: null
    }
  };
}

function indexedPoint(points, index) {
  return Number.isInteger(index) && index >= 0 && index < points.length ? points[index] : null;
}

function transformedIndexedPoint(points, index, frame, cache) {
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return null;
  if (cache.has(index)) return cache.get(index);
  const point = transformPoint(frame, points[index]);
  cache.set(index, point);
  return point;
}

function validIndexList(values, pointCount, minLength) {
  if (!Array.isArray(values) || values.length < minLength) return null;
  const indexes = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isInteger(value) || value < 0 || value >= pointCount) return null;
    indexes.push(value);
  }
  return indexes;
}

function validLineSegmentIndexes(segment, pointCount) {
  const indexes = validIndexList(segment, pointCount, 2);
  return indexes?.length === 2 && indexes[0] !== indexes[1] ? indexes : null;
}

function validMeshFaceIndexes(face, pointCount) {
  const indexes = validIndexList(face, pointCount, 3);
  return indexes && new Set(indexes).size >= 3 ? indexes : null;
}

function validLineSetPoints(object) {
  const points = arrayValues(object.vertices);
  const segments = arrayValues(object.lineSegments);
  if (points.length < 2 || !points.every(finiteVec3) || !segments.length) return null;
  return segments.every((segment) => validLineSegmentIndexes(segment, points.length)) ? points : null;
}

function validMeshPoints(object) {
  const points = arrayValues(object.vertices);
  const faces = arrayValues(object.faces);
  if (points.length < 3 || !points.every(finiteVec3) || !faces.length) return null;
  return faces.every((face) => validMeshFaceIndexes(face, points.length)) ? points : null;
}

function clampByte(value) {
  if (!finiteNumber(value)) return null;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function byteHex(value) {
  return value.toString(16).padStart(2, "0");
}

function rgbColor(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((channel) => finiteNumber(channel) && channel >= 0 && channel <= 255)) return null;
  const rgb = value.map((channel) => Math.round(channel));
  return `#${rgb.map(byteHex).join("")}`;
}

function safePointAttributes(pointAttributes, pointCount) {
  if (!pointAttributes || typeof pointAttributes !== "object" || Array.isArray(pointAttributes)) return null;
  const attributes = {};
  if (
    Array.isArray(pointAttributes.colors)
    && pointAttributes.colors.length === pointCount
    && pointAttributes.colors.every((color) => rgbColor(color))
  ) {
    attributes.colors = pointAttributes.colors;
  }
  if (
    Array.isArray(pointAttributes.intensities)
    && pointAttributes.intensities.length === pointCount
    && pointAttributes.intensities.every(finiteNumber)
  ) {
    attributes.intensities = pointAttributes.intensities;
  }
  if (
    Array.isArray(pointAttributes.classifications)
    && pointAttributes.classifications.length === pointCount
    && pointAttributes.classifications.every((classification) => Number.isInteger(classification) && classification >= 0)
  ) {
    attributes.classifications = pointAttributes.classifications;
  }
  if (
    Array.isArray(pointAttributes.normals)
    && pointAttributes.normals.length === pointCount
    && pointAttributes.normals.every(finiteVec3)
  ) {
    attributes.normals = pointAttributes.normals;
  }
  return Object.keys(attributes).length ? attributes : null;
}

function intensityColor(value) {
  if (!finiteNumber(value)) return null;
  const normalized = value >= 0 && value <= 1
    ? value * 255
    : value > 255
      ? value / 65535 * 255
      : value;
  const byte = clampByte(normalized);
  return byte === null ? null : `#${byteHex(byte)}${byteHex(byte)}${byteHex(byte)}`;
}

function pointColor(pointRecord, style) {
  return rgbColor(pointRecord?.attributes?.color)
    || intensityColor(pointRecord?.attributes?.intensity)
    || style.color;
}

function addReferenceLineSet(scene, object, points, frame, style, limit) {
  if (limit <= 0) return 0;
  const cache = new Map();
  let rendered = 0;
  for (const segment of arrayValues(object.lineSegments)) {
    if (rendered >= limit) break;
    const indexes = validLineSegmentIndexes(segment, points.length);
    if (!indexes) continue;
    const a = transformedIndexedPoint(points, indexes[0], frame, cache);
    const b = transformedIndexedPoint(points, indexes[1], frame, cache);
    if (!a || !b) continue;
    addLine(scene, a, b, style.color, style.meta);
    rendered += 1;
  }
  return rendered;
}

function addReferenceMesh(scene, object, points, frame, style, limit) {
  if (limit <= 0) return 0;
  const cache = new Map();
  let rendered = 0;
  for (const face of arrayValues(object.faces)) {
    if (rendered >= limit) break;
    const indexes = validMeshFaceIndexes(face, points.length);
    if (!indexes) continue;
    const facePoints = indexes
      .map((index) => transformedIndexedPoint(points, index, frame, cache))
      .filter(Boolean);
    if (facePoints.length < 3) continue;
    scene.faces.push({
      points: facePoints,
      color: style.color,
      ...style.meta
    });
    addLoopLines(scene, facePoints, style.edgeColor, style.meta);
    rendered += 1;
  }
  return rendered;
}

function pointPreviewAxes(size) {
  const half = size / 2;
  return [
    [[-half, 0, 0], [half, 0, 0]],
    [[0, -half, 0], [0, half, 0]],
    [[0, 0, -half], [0, 0, half]]
  ];
}

function addReferencePointCloud(scene, pointRecords, style) {
  const axes = pointPreviewAxes(style.pointSize);
  for (const pointRecord of pointRecords) {
    const point = pointRecord.point;
    const color = pointColor(pointRecord, style);
    for (const [a, b] of axes) {
      addLine(scene, v.add(point, a), v.add(point, b), color, style.meta);
    }
  }
}

function pointAttributesAt(pointAttributes, index) {
  if (!pointAttributes || typeof pointAttributes !== "object") return null;
  const attributes = {};
  if (Array.isArray(pointAttributes.colors) && pointAttributes.colors[index]) attributes.color = pointAttributes.colors[index];
  if (Array.isArray(pointAttributes.intensities) && finiteNumber(pointAttributes.intensities[index])) attributes.intensity = pointAttributes.intensities[index];
  if (Array.isArray(pointAttributes.classifications) && Number.isInteger(pointAttributes.classifications[index])) attributes.classification = pointAttributes.classifications[index];
  if (Array.isArray(pointAttributes.normals) && finiteVec3(pointAttributes.normals[index])) attributes.normal = pointAttributes.normals[index];
  return Object.keys(attributes).length ? attributes : null;
}

function pointRecords(points, pointAttributes, frame, limit = DEFAULT_POINT_PREVIEW_LIMIT) {
  const records = [];
  if (limit <= 0) return records;
  const values = arrayValues(points);
  const attributes = safePointAttributes(pointAttributes, values.length);
  for (let index = 0; index < values.length && records.length < limit; index += 1) {
    const point = transformPoint(frame, values[index]);
    if (!point) continue;
    records.push({
      point,
      attributes: pointAttributesAt(attributes, index)
    });
  }
  return records;
}

function validPointCloudInlinePoints(object) {
  if (!Array.isArray(object.points) || !object.points.length || !object.points.every(finiteVec3)) return null;
  return object.points;
}

function safeChunkPathSegment(segment) {
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

function safeChunkPath(pathValue) {
  if (typeof pathValue !== "string") return false;
  if (!pathValue || pathValue.trim() !== pathValue) return false;
  if (/[\\?#]|[\u0000-\u001f\u007f]/.test(pathValue)) return false;
  if (pathValue.startsWith("/") || pathValue.startsWith("//")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(pathValue)) return false;
  return pathValue.split("/").every(safeChunkPathSegment);
}

function safeUniqueChunkIds(chunkIds) {
  if (!Array.isArray(chunkIds) || !chunkIds.length) return null;
  const seen = new Set();
  const values = [];
  for (const chunkId of chunkIds) {
    if (!safeReferenceId(chunkId) || seen.has(chunkId)) return null;
    seen.add(chunkId);
    values.push(chunkId);
  }
  return values;
}

function manifestChunkIndex(assetData) {
  const chunksById = new Map();
  const duplicateChunkIds = new Set();
  for (const chunk of arrayValues(assetData?.chunks)) {
    if (!safeReferenceId(chunk?.id)) continue;
    if (chunksById.has(chunk.id)) duplicateChunkIds.add(chunk.id);
    else chunksById.set(chunk.id, chunk);
  }
  return { chunksById, duplicateChunkIds };
}

function validManifestChunk(chunk, chunkId, objectId) {
  if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) return false;
  if (!supportedKeys(chunk, REFERENCE_MANIFEST_CHUNK_KEYS)) return false;
  if (!safeReferenceId(chunk.id) || chunk.id !== chunkId) return false;
  if (chunk.kind !== "point-cloud") return false;
  if (!safeReferenceId(chunk.objectId) || chunk.objectId !== objectId) return false;
  if (!safeChunkPath(chunk.path)) return false;
  if (!Number.isInteger(chunk.pointCount) || chunk.pointCount <= 0) return false;
  if (!validBoundsMetadata(chunk.bounds)) return false;
  return true;
}

function pointCloudStorage(assetData, object) {
  const hasInlinePoints = object?.points !== undefined;
  const hasChunkIds = object?.chunkIds !== undefined;
  if (hasInlinePoints && hasChunkIds) return null;
  if (hasInlinePoints) {
    const points = validPointCloudInlinePoints(object);
    return points ? { mode: "inline", points } : null;
  }
  if (hasChunkIds) {
    if (object.pointAttributes !== undefined) return null;
    const chunkIds = safeUniqueChunkIds(object.chunkIds);
    if (!chunkIds) return null;
    const { chunksById, duplicateChunkIds } = manifestChunkIndex(assetData);
    for (const chunkId of chunkIds) {
      if (duplicateChunkIds.has(chunkId)) return null;
      if (!validManifestChunk(chunksById.get(chunkId), chunkId, object.id)) return null;
    }
    return { mode: "chunked", chunkIds, chunksById };
  }
  return null;
}

function validPointCloudChunkData(data, manifestChunk, objectId) {
  if (!manifestChunk) return false;
  if (!supportedKeys(data, REFERENCE_POINT_CLOUD_CHUNK_KEYS)) return false;
  if (!nonEmptyString(data.$schema)) return false;
  if (data?.schema !== REFERENCE_POINT_CLOUD_CHUNK_SCHEMA) return false;
  if (data.schemaVersion !== REFERENCE_POINT_CLOUD_CHUNK_SCHEMA_VERSION) return false;
  if (!safeReferenceId(data.id) || data.id !== manifestChunk.id) return false;
  if (data.kind !== "point-cloud") return false;
  if (!safeReferenceId(data.objectId) || data.objectId !== objectId) return false;
  if (!Number.isInteger(data.pointCount) || data.pointCount <= 0) return false;
  if (data.pointCount !== manifestChunk.pointCount) return false;
  if (!finiteBounds(data.bounds)) return false;
  if (manifestChunk.bounds !== undefined && !sameBounds(manifestChunk.bounds, data.bounds)) return false;
  if (!Array.isArray(data.points) || data.points.length !== data.pointCount || !data.points.every(finiteVec3)) return false;
  const payloadBounds = pointPayloadBounds(data.points);
  if (!payloadBounds || !sameBounds(data.bounds, payloadBounds)) return false;
  if (!validReferenceMetadataRecord(data.metadata)) return false;
  if (!validPointAttributeMetadata(data.pointAttributes)) return false;
  return true;
}

function chunkPointRecords(entry, object, storage, frame, limit) {
  const records = [];
  if (limit <= 0) return records;
  if (entry?.loadedChunks !== undefined && !safeRecord(entry.loadedChunks)) return null;
  const loadedChunks = entry?.loadedChunks || {};
  for (const chunkId of storage.chunkIds) {
    if (records.length >= limit) break;
    if (!Object.prototype.hasOwnProperty.call(loadedChunks, chunkId)) continue;
    const loadedChunk = loadedChunks[chunkId];
    if (!safeRecord(loadedChunk)) return null;
    if (!safeReferenceId(loadedChunk.id) || loadedChunk.id !== chunkId) return null;
    const chunkData = loadedChunk.data;
    if (!validPointCloudChunkData(chunkData, storage.chunksById.get(chunkId), object.id)) return null;
    records.push(...pointRecords(chunkData.points, chunkData.pointAttributes, frame, limit - records.length));
  }
  return records;
}

function declaredPointCloudPointCount(assetData, storage) {
  if (storage.mode === "inline") return storage.points.length;
  return storage.chunkIds.reduce((total, chunkId) => {
    const pointCount = storage.chunksById.get(chunkId)?.pointCount;
    return total + (Number.isInteger(pointCount) && pointCount > 0 ? pointCount : 0);
  }, 0);
}

function addReferenceObject(scene, entry, assetData, assetRef, object) {
  if (!safeReferenceId(assetRef.id) || !safeReferenceId(object?.id)) return;
  const layerState = objectLayer(assetData, object);
  if (!layerState.valid) return;
  const layer = layerState.layer;
  if (!objectVisible(assetRef, layer, object)) return;
  const frame = referenceFrame(scene, assetData, assetRef);
  if (!frame) return;
  const style = objectStyle(assetRef, layer, object);

  if (object.kind === "point-cloud") {
    const storage = pointCloudStorage(assetData, object);
    if (!storage) return;
    const limit = pointPreviewLimit(scene);
    const records = storage.mode === "inline"
      ? pointRecords(storage.points, object.pointAttributes, frame, limit)
      : chunkPointRecords(entry, object, storage, frame, limit);
    if (!records) return;
    addReferencePointCloud(scene, records, style);
    const candidatePointCount = declaredPointCloudPointCount(assetData, storage);
    recordReferencePreviewObject(scene, {
      assetId: assetRef.id,
      objectId: object.id,
      kind: object.kind,
      pointPreviewLimit: limit,
      candidatePointCount,
      renderedPointCount: records.length,
      omittedPointCount: Math.max(0, candidatePointCount - records.length)
    });
    return;
  }

  if (object.kind === "line-set") {
    const points = validLineSetPoints(object);
    if (!points) return;
    const limit = lineSegmentPreviewLimit(scene);
    const lineSegmentCount = arrayValues(object.lineSegments).length;
    const rendered = addReferenceLineSet(scene, object, points, frame, style, limit);
    recordReferencePreviewObject(scene, {
      assetId: assetRef.id,
      objectId: object.id,
      kind: object.kind,
      lineSegmentPreviewLimit: limit,
      lineSegmentCount,
      renderedLineSegmentCount: rendered,
      omittedLineSegmentCount: Math.max(0, lineSegmentCount - rendered)
    });
  } else if (object.kind === "mesh") {
    const points = validMeshPoints(object);
    if (!points) return;
    const limit = meshFacePreviewLimit(scene);
    const meshFaceCount = arrayValues(object.faces).length;
    const rendered = addReferenceMesh(scene, object, points, frame, style, limit);
    recordReferencePreviewObject(scene, {
      assetId: assetRef.id,
      objectId: object.id,
      kind: object.kind,
      meshFacePreviewLimit: limit,
      meshFaceCount,
      renderedMeshFaceCount: rendered,
      omittedMeshFaceCount: Math.max(0, meshFaceCount - rendered)
    });
  }
}

export function addReferenceGeometry(scene, referenceAssets = []) {
  if (!shouldRenderReferenceGeometry(scene)) return;
  for (const entry of arrayValues(referenceAssets)) {
    const assetData = entry?.data;
    const projectAsset = entry?.projectAsset;
    if (!validReferenceProjectAssetRef(projectAsset)) continue;
    const assetRef = {
      id: entry?.id || assetData?.asset?.id || "reference-geometry",
      ...(projectAsset || {})
    };
    if (!safeReferenceId(assetRef.id)) continue;
    if (!validReferenceAssetData(assetData, assetRef)) continue;
    referencePreviewStats(scene).totals.assetCount += 1;
    for (const object of objectValues(assetData.objects)) addReferenceObject(scene, entry, assetData, assetRef, object);
  }
}
