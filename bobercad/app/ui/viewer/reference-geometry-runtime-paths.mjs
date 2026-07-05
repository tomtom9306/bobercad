const REFERENCE_GEOMETRY_SCHEMA = "bobercad-reference-geometry";
const REFERENCE_GEOMETRY_SCHEMA_VERSION = "0.1.0";
const REFERENCE_POINT_CLOUD_CHUNK_SCHEMA = "bobercad-reference-point-cloud-chunk";
const REFERENCE_POINT_CLOUD_CHUNK_SCHEMA_VERSION = "0.1.0";
const REFERENCE_GEOMETRY_BUILT_IN_TRANSLATOR_ID = "tools/reference-geometry/translate_reference_geometry.mjs";
const POINT_ATTRIBUTE_KEYS = ["colors", "intensities", "classifications", "normals"];
const PROJECT_REFERENCE_ASSET_KEYS = new Set(["path", "visible", "snapEnabled", "display", "transform"]);
const PROJECT_REFERENCE_TRANSFORM_KEYS = new Set(["origin", "axisX", "axisY", "axisZ", "scale"]);
const SUPPORTED_REFERENCE_UNITS = new Set(["mm", "m", "in", "ft"]);
const SUPPORTED_REFERENCE_SOURCE_FORMATS = new Set(["dxf", "dwg", "step", "ifc", "e57", "e57pointcloud", "json", "unknown"]);
const REFERENCE_DISPLAY_KEYS = new Set(["visible", "color", "edgeColor", "opacity", "pointSize"]);
const REFERENCE_SOURCE_KEYS = new Set(["format", "fileName", "fileExtension", "requestedFormat", "fileSizeBytes", "modifiedTime", "statFingerprint", "checksum", "translator", "translatorVersion", "adapterKey"]);
const REFERENCE_DIAGNOSTIC_KEYS = new Set(["severity", "code", "message", "objectId", "objectRefs"]);
const REFERENCE_DIAGNOSTIC_SEVERITIES = new Set(["info", "warning", "error"]);
const REFERENCE_BOUNDS_KEYS = new Set(["min", "max"]);
const REFERENCE_COORDINATE_SYSTEM_KEYS = new Set(["origin", "axisX", "axisY", "axisZ"]);
const REFERENCE_MANIFEST_KEYS = new Set(["$schema", "schema", "schemaVersion", "asset", "layers", "objects", "chunks", "diagnostics"]);
const REFERENCE_ASSET_KEYS = new Set(["id", "name", "source", "units", "coordinateSystem", "bounds"]);
const REFERENCE_LAYER_KEYS = new Set(["id", "name", "display"]);
const REFERENCE_OBJECT_KEYS = new Set(["id", "kind", "name", "layer", "display", "metadata", "bounds", "vertices", "lineSegments", "faces", "points", "pointAttributes", "chunkIds"]);
const REFERENCE_MANIFEST_CHUNK_KEYS = new Set(["id", "kind", "objectId", "path", "pointCount", "bounds"]);
const REFERENCE_POINT_CLOUD_CHUNK_KEYS = new Set(["$schema", "schema", "schemaVersion", "id", "kind", "objectId", "pointCount", "bounds", "points", "pointAttributes", "metadata"]);
const REFERENCE_OBJECT_GEOMETRY_KEYS = ["vertices", "lineSegments", "faces", "points", "pointAttributes", "chunkIds"];
const REFERENCE_OBJECT_GEOMETRY_KEYS_BY_KIND = Object.freeze({
  "line-set": new Set(["vertices", "lineSegments"]),
  mesh: new Set(["vertices", "faces"]),
  "point-cloud": new Set(["points", "pointAttributes", "chunkIds"])
});
const DEFAULT_REFERENCE_POINT_PREVIEW_LIMIT = 5000;
const DEFAULT_REFERENCE_POINT_PREVIEW_CHUNK_LIMIT = 128;
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
const DISPLAY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
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
const SOURCE_REQUESTED_FORMAT_FAMILY_BY_SOURCE_FORMAT = Object.freeze({
  dxf: "dxf",
  dwg: "dwg",
  step: "step",
  ifc: "ifc",
  e57: "e57",
  e57pointcloud: "e57",
  json: "json"
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
const RESERVED_REFERENCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_PROJECT_ASSET_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$/;

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
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

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function samePoint(left, right) {
  return finiteVec3(left) && finiteVec3(right) && left.every((value, index) => Math.abs(value - right[index]) <= 1e-9);
}

function sameBounds(left, right) {
  return samePoint(left?.min, right?.min) && samePoint(left?.max, right?.max);
}

function vecCross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function vecDot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function vecLength(value) {
  return Math.hypot(value[0], value[1], value[2]);
}

function finiteBounds(bounds) {
  return finiteVec3(bounds?.min)
    && finiteVec3(bounds?.max)
    && bounds.min.every((value, index) => value <= bounds.max[index]);
}

function pointPayloadBounds(points) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const point of points || []) {
    if (!finiteVec3(point)) return null;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
    }
  }
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite) ? bounds : null;
}

function unionBounds(boundsList) {
  const validBounds = (boundsList || []).filter(finiteBounds);
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
  if (values.some((bounds) => !finiteBounds(bounds))) return null;
  return unionBounds(values);
}

function pointAttributeLengthError(pointAttributes, pointCount) {
  if (pointAttributes === undefined) return null;
  if (!pointAttributes || typeof pointAttributes !== "object" || Array.isArray(pointAttributes)) {
    return "pointAttributes must be an object";
  }
  for (const key of Object.keys(pointAttributes)) {
    if (!POINT_ATTRIBUTE_KEYS.includes(key)) return `unsupported pointAttributes.${key}`;
  }
  for (const key of POINT_ATTRIBUTE_KEYS) {
    const values = pointAttributes[key];
    if (values === undefined) continue;
    if (!Array.isArray(values)) return `pointAttributes.${key} must be an array`;
    if (values.length !== pointCount) return `pointAttributes.${key} length ${values.length} does not match pointCount ${pointCount}`;
  }
  for (let index = 0; index < pointCount; index += 1) {
    const color = pointAttributes.colors?.[index];
    if (color !== undefined && (!Array.isArray(color) || color.length !== 3 || !color.every((value) => finiteNumber(value) && value >= 0 && value <= 255))) {
      return `pointAttributes.colors[${index}] must be an rgb triplet in range 0-255`;
    }
    const intensity = pointAttributes.intensities?.[index];
    if (intensity !== undefined && !finiteNumber(intensity)) {
      return `pointAttributes.intensities[${index}] must be a finite number`;
    }
    const classification = pointAttributes.classifications?.[index];
    if (classification !== undefined && (!Number.isInteger(classification) || classification < 0)) {
      return `pointAttributes.classifications[${index}] must be a non-negative integer`;
    }
    const normal = pointAttributes.normals?.[index];
    if (normal !== undefined && !finiteVec3(normal)) {
      return `pointAttributes.normals[${index}] must be a finite vec3`;
    }
  }
  return null;
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return depth < REFERENCE_METADATA_MAX_DEPTH
      && entries.length <= REFERENCE_METADATA_MAX_ENTRY_COUNT
      && entries.every(([key, child]) => safeReferenceMetadataKey(key) && validReferenceMetadataValue(child, depth + 1));
  }
  return false;
}

function referenceMetadataLoadError(label, metadata) {
  if (metadata === undefined) return null;
  if (!isRecord(metadata)) return `${label}.metadata must be an object`;
  const encoded = JSON.stringify(metadata);
  if (typeof encoded !== "string" || encoded.length > REFERENCE_METADATA_MAX_JSON_LENGTH) {
    return `${label}.metadata must be bounded path-free canonical metadata`;
  }
  if (!validReferenceMetadataValue(metadata)) {
    return `${label}.metadata must be bounded path-free canonical metadata`;
  }
  return null;
}

function unsupportedFieldError(label, value, allowedKeys) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) return `${label}.${key} is unsupported`;
  }
  return null;
}

function finiteBoundsError(label, bounds) {
  if (!isRecord(bounds)) return `${label} must be an object`;
  const fieldError = unsupportedFieldError(label, bounds, REFERENCE_BOUNDS_KEYS);
  if (fieldError) return fieldError;
  if (!finiteBounds(bounds)) return `${label} must be finite and non-inverted`;
  return null;
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

function sourceRequestedFormatAliases(sourceFormat) {
  return SOURCE_REQUESTED_FORMATS_BY_SOURCE_FORMAT[sourceFormat] || [];
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

function sourceRequestedFormatFamily(sourceFormat) {
  return SOURCE_REQUESTED_FORMAT_FAMILY_BY_SOURCE_FORMAT[sourceFormat] || sourceFormat;
}

export function referenceSourceRequestedFormatMetadata(source = {}) {
  const sourceFormat = referenceSourceFormatToken(source?.format);
  const requestedFormat = referenceRequestedFormatToken(source?.requestedFormat, sourceFormat);
  const aliases = sourceRequestedFormatAliases(sourceFormat);
  return Object.freeze({
    sourceFormat: sourceFormat || null,
    sourceRequestedFormat: requestedFormat || null,
    sourceRequestedFormatFamily: aliases.length ? sourceRequestedFormatFamily(sourceFormat) : (sourceFormat || null),
    sourceRequestedFormatAliases: Object.freeze([...aliases]),
    sourceRequestedFormatMatchesFamily: requestedFormat ? aliases.includes(requestedFormat) : null
  });
}

function referenceSourceFormatToken(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_REFERENCE_SOURCE_FORMATS.has(token) ? token : "";
}

function referenceRequestedFormatToken(value, sourceFormat = "") {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!SOURCE_REQUESTED_FORMAT_PATTERN.test(token)) return "";
  const aliases = sourceRequestedFormatAliases(sourceFormat);
  return aliases.includes(token) ? token : "";
}

function indexInRange(value, count) {
  return Number.isInteger(value) && value >= 0 && value < count;
}

function coordinateSystemError(coordinateSystem) {
  if (!coordinateSystem || typeof coordinateSystem !== "object" || Array.isArray(coordinateSystem)) {
    return "asset.coordinateSystem must be an object";
  }
  const fieldError = unsupportedFieldError("asset.coordinateSystem", coordinateSystem, REFERENCE_COORDINATE_SYSTEM_KEYS);
  if (fieldError) return fieldError;
  if (!finiteVec3(coordinateSystem.origin)) return "asset.coordinateSystem.origin must be a finite vec3";
  for (const key of ["axisX", "axisY", "axisZ"]) {
    const axis = coordinateSystem[key];
    if (!finiteVec3(axis)) return `asset.coordinateSystem.${key} must be a finite vec3`;
    if (vecLength(axis) <= 1e-9) return `asset.coordinateSystem.${key} must be non-zero`;
  }
  const determinant = vecDot(vecCross(coordinateSystem.axisX, coordinateSystem.axisY), coordinateSystem.axisZ);
  if (Math.abs(determinant) <= 1e-9) return "asset.coordinateSystem axes must form a non-degenerate 3D basis";
  return null;
}

function sourceMetadataError(source) {
  if (!isRecord(source)) return "asset.source must be an object";
  for (const key of Object.keys(source)) {
    if (!REFERENCE_SOURCE_KEYS.has(key)) return `asset.source.${key} is unsupported`;
  }
  if (!SUPPORTED_REFERENCE_SOURCE_FORMATS.has(source.format)) {
    return `unsupported asset.source.format ${source.format || "<missing>"}`;
  }
  if (source.fileName !== undefined && !safeSourceFileName(source.fileName)) {
    return "asset.source.fileName must be a path-free source basename";
  }
  if (source.checksum !== undefined && (typeof source.checksum !== "string" || !SOURCE_CHECKSUM_PATTERN.test(source.checksum))) {
    return "asset.source.checksum must be a 64-character lowercase SHA-256 hex string";
  }
  if (source.translator !== undefined && (typeof source.translator !== "string" || !validSourceTranslator(source.translator))) {
    return "asset.source.translator must be the built-in translator id, a safe machine token, or external:<adapter id>";
  }
  if (source.translatorVersion !== undefined && (typeof source.translatorVersion !== "string" || !SOURCE_TRANSLATOR_VERSION_PATTERN.test(source.translatorVersion))) {
    return "asset.source.translatorVersion must be a short path-free token";
  }
  if (source.fileExtension !== undefined && (typeof source.fileExtension !== "string" || !SOURCE_EXTENSION_PATTERN.test(source.fileExtension))) {
    return "asset.source.fileExtension must be empty or a lowercase extension token";
  }
  if (source.fileExtension !== undefined && !sourceFileExtensionAllowed(source.format, source.fileExtension)) {
    return `asset.source.fileExtension ${source.fileExtension} is not valid for asset.source.format ${source.format}`;
  }
  if (source.requestedFormat !== undefined && (typeof source.requestedFormat !== "string" || !SOURCE_REQUESTED_FORMAT_PATTERN.test(source.requestedFormat))) {
    return "asset.source.requestedFormat must be a lowercase source format token";
  }
  if (source.requestedFormat !== undefined && !sourceRequestedFormatAllowed(source.format, source.requestedFormat)) {
    return `asset.source.requestedFormat ${source.requestedFormat} is not valid for asset.source.format ${source.format}`;
  }
  if (source.fileSizeBytes !== undefined && (!Number.isInteger(source.fileSizeBytes) || source.fileSizeBytes < 0)) {
    return "asset.source.fileSizeBytes must be a non-negative integer";
  }
  if (source.modifiedTime !== undefined && !validDateTimeString(source.modifiedTime)) {
    return "asset.source.modifiedTime must be an RFC3339 date-time string";
  }
  if (source.statFingerprint !== undefined && (typeof source.statFingerprint !== "string" || !SOURCE_STAT_FINGERPRINT_PATTERN.test(source.statFingerprint))) {
    return "asset.source.statFingerprint must use stat-sha256:<64 lowercase hex chars>";
  }
  if (source.adapterKey !== undefined && !safeReferenceId(source.adapterKey)) {
    return "asset.source.adapterKey must use a safe canonical reference id";
  }
  return null;
}

function assetMetadataError(asset) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return "asset must be an object";
  const fieldError = unsupportedFieldError("asset", asset, REFERENCE_ASSET_KEYS);
  if (fieldError) return fieldError;
  if (!safeReferenceId(asset.id)) return "asset.id must use a safe canonical reference id";
  if (!safeDisplayName(asset.name)) return "asset.name must be a bounded path-free display name";
  const sourceError = sourceMetadataError(asset.source);
  if (sourceError) return sourceError;
  if (!SUPPORTED_REFERENCE_UNITS.has(asset.units)) return `unsupported asset.units ${asset.units || "<missing>"}`;
  const frameError = coordinateSystemError(asset.coordinateSystem);
  if (frameError) return frameError;
  if (asset.bounds) {
    const boundsError = finiteBoundsError("asset.bounds", asset.bounds);
    if (boundsError) return boundsError;
  }
  return null;
}

function manifestCollectionsError(data) {
  if (!isRecord(data.layers)) return "layers must be an object";
  if (!isRecord(data.objects)) return "objects must be an object";
  if (!Array.isArray(data.chunks)) return "chunks must be an array";
  if (!Array.isArray(data.diagnostics)) return "diagnostics must be an array";
  return null;
}

function manifestChunkIndexError(chunks) {
  const seen = new Set();
  for (const [index, chunk] of chunks.entries()) {
    if (!isRecord(chunk)) return `chunks[${index}] must be an object`;
    const fieldError = unsupportedFieldError(`chunks[${index}]`, chunk, REFERENCE_MANIFEST_CHUNK_KEYS);
    if (fieldError) return fieldError;
    if (!safeReferenceId(chunk.id)) return `chunks[${index}].id must use a safe canonical reference id`;
    if (seen.has(chunk.id)) return `duplicate chunk id ${chunk.id}`;
    seen.add(chunk.id);
  }
  return null;
}

function manifestDiagnosticsError(data) {
  const objectIds = new Set(Object.keys(recordValue(data?.objects)));
  for (const [index, diagnostic] of (data?.diagnostics || []).entries()) {
    if (!isRecord(diagnostic)) return `diagnostics[${index}] must be an object`;
    for (const key of Object.keys(diagnostic)) {
      if (!REFERENCE_DIAGNOSTIC_KEYS.has(key)) return `diagnostics[${index}].${key} is unsupported`;
    }
    if (!REFERENCE_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity)) {
      return `diagnostics[${index}].severity must be info, warning, or error`;
    }
    if (!safeDiagnosticCode(diagnostic.code)) return `diagnostics[${index}].code must be a safe diagnostic token`;
    if (!safeDiagnosticMessage(diagnostic.message)) return `diagnostics[${index}].message must be bounded path-free diagnostic text`;
    if (diagnostic.objectId !== undefined) {
      if (!safeReferenceId(diagnostic.objectId)) return `diagnostics[${index}].objectId must use a safe canonical reference id`;
      if (!objectIds.has(diagnostic.objectId)) return `diagnostics[${index}].objectId ${diagnostic.objectId} is missing`;
    }
    if (diagnostic.objectRefs !== undefined) {
      if (!Array.isArray(diagnostic.objectRefs)) return `diagnostics[${index}].objectRefs must be an array`;
      if (!diagnostic.objectRefs.length) return `diagnostics[${index}].objectRefs must not be empty`;
      const seenObjectRefs = new Set();
      for (const [objectRefIndex, objectRef] of diagnostic.objectRefs.entries()) {
        if (!safeReferenceId(objectRef)) return `diagnostics[${index}].objectRefs[${objectRefIndex}] must use a safe canonical reference id`;
        if (seenObjectRefs.has(objectRef)) return `diagnostics[${index}].objectRefs contains duplicate id ${objectRef}`;
        seenObjectRefs.add(objectRef);
        if (!objectIds.has(objectRef)) return `diagnostics[${index}].objectRefs[${objectRefIndex}] ${objectRef} is missing`;
      }
    }
  }
  return null;
}

function manifestChunkOwnershipError(data) {
  const objects = recordValue(data?.objects);
  for (const chunk of data?.chunks || []) {
    if (!safeReferenceId(chunk.objectId)) {
      return `chunks[${chunk.id}].objectId must use a safe canonical reference id`;
    }
    const object = objects[chunk.objectId];
    if (!isRecord(object)) return `chunks[${chunk.id}].objectId ${chunk.objectId} is missing`;
    if (object.id !== chunk.objectId) {
      return `chunks[${chunk.id}].objectId ${chunk.objectId} does not match owner object id ${object.id || "<missing>"}`;
    }
    if (object.kind !== "point-cloud") {
      return `chunks[${chunk.id}].objectId ${chunk.objectId} must point to a point-cloud object`;
    }
    if (!Array.isArray(object.chunkIds) || !object.chunkIds.includes(chunk.id)) {
      return `chunks[${chunk.id}] must be listed in point-cloud ${chunk.objectId}.chunkIds`;
    }
    const chunkError = referenceManifestChunkLoadError(object, chunk.id, chunk);
    if (chunkError) return `chunks[${chunk.id}] is invalid: ${chunkError}`;
  }
  return null;
}

function referenceDisplayError(label, display, strictKeys = false) {
  if (display === undefined) return null;
  if (!display || typeof display !== "object" || Array.isArray(display)) return `${label}.display must be an object`;
  if (strictKeys) {
    for (const key of Object.keys(display)) {
      if (!REFERENCE_DISPLAY_KEYS.has(key)) return `${label}.display.${key} is unsupported`;
    }
  }
  if (display.visible !== undefined && typeof display.visible !== "boolean") return `${label}.display.visible must be a boolean`;
  for (const key of ["color", "edgeColor"]) {
    if (display[key] !== undefined && (typeof display[key] !== "string" || !DISPLAY_COLOR_PATTERN.test(display[key]))) {
      return `${label}.display.${key} must be a #RRGGBB color`;
    }
  }
  if (display.opacity !== undefined && (!finiteNumber(display.opacity) || display.opacity < 0 || display.opacity > 1)) {
    return `${label}.display.opacity must be between 0 and 1`;
  }
  if (display.pointSize !== undefined && (!finiteNumber(display.pointSize) || display.pointSize <= 0)) {
    return `${label}.display.pointSize must be greater than zero`;
  }
  return null;
}

function projectTransformError(assetId, transform) {
  if (transform === undefined) return null;
  if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
    return `referenceGeometry.assets.${assetId}.transform must be an object`;
  }
  const fieldError = unsupportedFieldError(`referenceGeometry.assets.${assetId}.transform`, transform, PROJECT_REFERENCE_TRANSFORM_KEYS);
  if (fieldError) return fieldError;
  if (transform.origin !== undefined && !finiteVec3(transform.origin)) {
    return `referenceGeometry.assets.${assetId}.transform.origin must be a finite vec3`;
  }
  if (transform.scale !== undefined && (!finiteNumber(transform.scale) || transform.scale <= 0)) {
    return `referenceGeometry.assets.${assetId}.transform.scale must be greater than zero`;
  }
  const axes = {
    axisX: transform.axisX === undefined ? [1, 0, 0] : transform.axisX,
    axisY: transform.axisY === undefined ? [0, 1, 0] : transform.axisY,
    axisZ: transform.axisZ === undefined ? [0, 0, 1] : transform.axisZ
  };
  for (const [key, axis] of Object.entries(axes)) {
    if (!finiteVec3(axis)) return `referenceGeometry.assets.${assetId}.transform.${key} must be a finite vec3`;
    if (vecLength(axis) <= 1e-9) return `referenceGeometry.assets.${assetId}.transform.${key} must be non-zero`;
  }
  const determinant = vecDot(vecCross(axes.axisX, axes.axisY), axes.axisZ);
  if (Math.abs(determinant) <= 1e-9) {
    return `referenceGeometry.assets.${assetId}.transform axes must form a non-degenerate 3D basis`;
  }
  return null;
}

function referenceLayerLoadError(layerId, layer) {
  if (!safeReferenceId(layerId)) return `layer key ${layerId || "<missing>"} must use a safe canonical reference id`;
  if (!layer || typeof layer !== "object" || Array.isArray(layer)) {
    return "reference layer is not an object";
  }
  const fieldError = unsupportedFieldError(`layer ${layerId}`, layer, REFERENCE_LAYER_KEYS);
  if (fieldError) return fieldError;
  if (!safeReferenceId(layer.id)) return `layer id ${layer.id || "<missing>"} must use a safe canonical reference id`;
  if (layer.id !== layerId) return `layer id ${layer.id || "<missing>"} does not match layer key ${layerId || "<missing>"}`;
  if (!safeDisplayName(layer.name)) return `layer ${layerId}.name must be a bounded path-free display name`;
  return referenceDisplayError(`layer ${layerId}`, layer.display, true);
}

function lineSetObjectError(object) {
  if (!Array.isArray(object.vertices) || object.vertices.length < 2) {
    return "line-set vertices must contain at least two points";
  }
  const vertexBounds = pointPayloadBounds(object.vertices);
  if (!vertexBounds) return "line-set vertices must be finite vec3 points";
  if (!Array.isArray(object.lineSegments) || !object.lineSegments.length) {
    return "line-set lineSegments must contain at least one segment";
  }
  for (const [index, segment] of object.lineSegments.entries()) {
    if (!Array.isArray(segment) || segment.length !== 2) return `line-set lineSegments[${index}] must reference two vertices`;
    if (!indexInRange(segment[0], object.vertices.length) || !indexInRange(segment[1], object.vertices.length)) {
      return `line-set lineSegments[${index}] references a missing vertex`;
    }
    if (segment[0] === segment[1]) return `line-set lineSegments[${index}] must reference two distinct vertices`;
  }
  if (object.bounds && !sameBounds(object.bounds, vertexBounds)) return "line-set bounds do not match vertex payload bounds";
  return null;
}

function objectKindPayloadError(objectId, object) {
  const allowedGeometryKeys = REFERENCE_OBJECT_GEOMETRY_KEYS_BY_KIND[object.kind];
  if (!allowedGeometryKeys) return null;
  for (const key of REFERENCE_OBJECT_GEOMETRY_KEYS) {
    if (object[key] !== undefined && !allowedGeometryKeys.has(key)) {
      return `object ${objectId}.${key} is not valid for ${object.kind}`;
    }
  }
  return null;
}

function meshObjectError(object) {
  if (!Array.isArray(object.vertices) || object.vertices.length < 3) {
    return "mesh vertices must contain at least three points";
  }
  const vertexBounds = pointPayloadBounds(object.vertices);
  if (!vertexBounds) return "mesh vertices must be finite vec3 points";
  if (!Array.isArray(object.faces) || !object.faces.length) return "mesh faces must contain at least one face";
  for (const [index, face] of object.faces.entries()) {
    if (!Array.isArray(face) || face.length < 3) return `mesh faces[${index}] must reference at least three vertices`;
    if (face.some((vertexIndex) => !indexInRange(vertexIndex, object.vertices.length))) {
      return `mesh faces[${index}] references a missing vertex`;
    }
    if (new Set(face).size < 3) return `mesh faces[${index}] must reference at least three distinct vertices`;
  }
  if (object.bounds && !sameBounds(object.bounds, vertexBounds)) return "mesh bounds do not match vertex payload bounds";
  return null;
}

function inlinePointCloudObjectError(object) {
  if (!Array.isArray(object.points) || !object.points.length) return "inline point-cloud points must contain at least one point";
  const payloadBounds = pointPayloadBounds(object.points);
  if (!payloadBounds) return "inline point-cloud points must be finite vec3 points";
  const attributeError = pointAttributeLengthError(object.pointAttributes, object.points.length);
  if (attributeError) return attributeError;
  if (object.bounds && !sameBounds(object.bounds, payloadBounds)) return "inline point-cloud bounds do not match point payload bounds";
  return null;
}

function chunkedPointCloudObjectError(assetData, object) {
  if (!Array.isArray(object.chunkIds) || !object.chunkIds.length) return "chunked point-cloud chunkIds must contain at least one chunk id";
  const seen = new Set();
  const chunks = recordValue(assetData?.chunksById);
  const duplicateChunkIds = assetData?.duplicateChunkIds instanceof Set ? assetData.duplicateChunkIds : new Set();
  for (const chunkId of object.chunkIds) {
    if (!safeReferenceId(chunkId)) return `chunked point-cloud chunk id ${chunkId || "<missing>"} must use a safe canonical reference id`;
    if (seen.has(chunkId)) return `chunked point-cloud repeats chunk id ${chunkId}`;
    seen.add(chunkId);
    if (duplicateChunkIds.has(chunkId)) return `chunked point-cloud references duplicate manifest chunk ${chunkId}`;
    const chunk = chunks[chunkId];
    if (!chunk) return `chunked point-cloud references missing chunk ${chunkId}`;
    const chunkError = referenceManifestChunkLoadError(object, chunkId, chunk);
    if (chunkError) return `chunked point-cloud chunk ${chunkId} is invalid: ${chunkError}`;
  }
  if (object.pointAttributes !== undefined) return "chunked point-cloud attributes must live in sidecars";
  if (object.bounds) {
    const bounds = completeUnionBounds(object.chunkIds.map((chunkId) => chunks[chunkId]?.bounds));
    if (!bounds) return "chunked point-cloud bounds cannot be verified without complete manifest chunk bounds";
    if (!sameBounds(object.bounds, bounds)) return "chunked point-cloud bounds do not match manifest chunk bounds";
  }
  return null;
}

function referenceObjectPayloadBounds(assetData, object) {
  if (object?.kind === "line-set" || object?.kind === "mesh") {
    return Array.isArray(object.vertices) ? pointPayloadBounds(object.vertices) : null;
  }
  if (object?.kind === "point-cloud") {
    if (Array.isArray(object.points)) return pointPayloadBounds(object.points);
    if (Array.isArray(object.chunkIds)) {
      const chunks = recordValue(assetData?.chunksById);
      const duplicateChunkIds = assetData?.duplicateChunkIds instanceof Set ? assetData.duplicateChunkIds : new Set();
      if (object.chunkIds.some((chunkId) => duplicateChunkIds.has(chunkId))) return null;
      return completeUnionBounds(object.chunkIds.map((chunkId) => chunks[chunkId]?.bounds));
    }
  }
  return null;
}

function safeDecodedSegment(segment) {
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

function safeRelativePathSegments(pathValue) {
  if (typeof pathValue !== "string") return null;
  if (!pathValue || pathValue.trim() !== pathValue) return null;
  if (/[\\?#]|[\u0000-\u001f\u007f]/.test(pathValue)) return null;
  if (pathValue.startsWith("/") || pathValue.startsWith("//")) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(pathValue)) return null;
  const segments = pathValue.split("/");
  if (!segments.length || segments.some((segment) => !safeDecodedSegment(segment))) return null;
  return segments;
}

function underDirectoryUrl(url, directoryUrl) {
  if (!url || !directoryUrl) return false;
  if (url.origin !== directoryUrl.origin) return false;
  const rootPath = directoryUrl.pathname.endsWith("/")
    ? directoryUrl.pathname
    : `${directoryUrl.pathname}/`;
  return url.pathname.startsWith(rootPath);
}

export function referenceGeometryRootUrl(projectUrl) {
  return new URL("../references/", projectUrl);
}

export function isSafeReferenceAssetPath(pathValue) {
  if (typeof pathValue !== "string") return false;
  if (!pathValue || pathValue.trim() !== pathValue) return false;
  if (/[\\?#]|[\u0000-\u001f\u007f]/.test(pathValue)) return false;
  const segments = pathValue.split("/");
  if (segments.length !== 3 || segments[0] !== ".." || segments[1] !== "references") return false;
  return REFERENCE_PROJECT_ASSET_FILENAME_PATTERN.test(segments[2]);
}

export function isSafeReferenceChunkPath(pathValue) {
  return Boolean(safeRelativePathSegments(pathValue));
}

export function referenceAssetUrl(pathValue, projectUrl) {
  if (!isSafeReferenceAssetPath(pathValue)) return null;
  const url = new URL(pathValue, projectUrl);
  const rootUrl = referenceGeometryRootUrl(projectUrl);
  return underDirectoryUrl(url, rootUrl) ? url : null;
}

export function referenceChunkUrl(pathValue, assetUrl, referenceRootUrl = null) {
  if (!isSafeReferenceChunkPath(pathValue)) return null;
  const url = new URL(pathValue, assetUrl);
  const rootUrl = referenceRootUrl || new URL(".", assetUrl);
  return underDirectoryUrl(url, rootUrl) && underDirectoryUrl(url, new URL(".", assetUrl))
    ? url
    : null;
}

export function referenceProjectAssetLoadError(assetId, asset) {
  if (!safeReferenceId(assetId)) {
    return `referenceGeometry.assets.${assetId || "<missing>"} must use a safe canonical reference id`;
  }
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    return `referenceGeometry.assets.${assetId} must be an object`;
  }
  const fieldError = unsupportedFieldError(`referenceGeometry.assets.${assetId}`, asset, PROJECT_REFERENCE_ASSET_KEYS);
  if (fieldError) return fieldError;
  if (!isSafeReferenceAssetPath(asset.path)) {
    return `referenceGeometry.assets.${assetId}.path must use ../references/<manifest>.json with a safe direct JSON filename`;
  }
  if (asset.visible !== undefined && typeof asset.visible !== "boolean") {
    return `referenceGeometry.assets.${assetId}.visible must be a boolean`;
  }
  if (asset.snapEnabled !== undefined && typeof asset.snapEnabled !== "boolean") {
    return `referenceGeometry.assets.${assetId}.snapEnabled must be a boolean`;
  }
  const displayError = referenceDisplayError(`referenceGeometry.assets.${assetId}`, asset.display, true);
  if (displayError) return displayError;
  return projectTransformError(assetId, asset.transform);
}

function manifestRuntimeContentError(data) {
  const layers = {};
  for (const [layerId, layer] of Object.entries(recordValue(data?.layers))) {
    const layerError = referenceLayerLoadError(layerId, layer);
    if (layerError) return `layers.${layerId} is invalid: ${layerError}`;
    layers[layerId] = layer;
  }
  const { chunksById, duplicateChunkIds } = referenceChunkIndex(data);
  const assetData = { ...data, layers, chunksById, duplicateChunkIds };
  for (const [objectId, object] of Object.entries(recordValue(data?.objects))) {
    const objectError = referenceObjectLoadError(assetData, objectId, object);
    if (objectError) return `objects.${objectId} is invalid: ${objectError}`;
  }
  return null;
}

export function referenceManifestLoadError(assetId, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "manifest is not a JSON object";
  }
  const fieldError = unsupportedFieldError("manifest", data, REFERENCE_MANIFEST_KEYS);
  if (fieldError) return fieldError;
  if (!safeReferenceId(assetId)) {
    return `project asset ${assetId || "<missing>"} must use a safe canonical reference id`;
  }
  if (!nonEmptyString(data.$schema)) {
    return "manifest $schema must be a non-empty string";
  }
  if (data.schema !== REFERENCE_GEOMETRY_SCHEMA) {
    return `unsupported schema ${data.schema || "<missing>"}`;
  }
  if (data.schemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION) {
    return `unsupported schemaVersion ${data.schemaVersion || "<missing>"}`;
  }
  const assetError = assetMetadataError(data.asset);
  if (assetError) return assetError;
  if (data.asset?.id !== assetId) {
    return `asset.id ${data.asset?.id || "<missing>"} does not match project asset ${assetId}`;
  }
  const collectionsError = manifestCollectionsError(data);
  if (collectionsError) return collectionsError;
  const chunkIndexError = manifestChunkIndexError(data.chunks);
  if (chunkIndexError) return chunkIndexError;
  const chunkOwnershipError = manifestChunkOwnershipError(data);
  if (chunkOwnershipError) return chunkOwnershipError;
  const runtimeContentError = manifestRuntimeContentError(data);
  if (runtimeContentError) return runtimeContentError;
  const assetBoundsError = runtimeReferenceAssetBoundsError(data);
  if (assetBoundsError) return assetBoundsError;
  const diagnosticsError = manifestDiagnosticsError(data);
  if (diagnosticsError) return diagnosticsError;
  return null;
}

export function referenceObjectLoadError(assetData, objectId, object) {
  if (!safeReferenceId(objectId)) {
    return `object key ${objectId || "<missing>"} must use a safe canonical reference id`;
  }
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return "reference object is not an object";
  }
  const fieldError = unsupportedFieldError(`object ${objectId}`, object, REFERENCE_OBJECT_KEYS);
  if (fieldError) return fieldError;
  if (!safeReferenceId(object.id)) {
    return `object id ${object.id || "<missing>"} must use a safe canonical reference id`;
  }
  if (object.id !== objectId) {
    return `object id ${object.id || "<missing>"} does not match object key ${objectId || "<missing>"}`;
  }
  if (object.name !== undefined && !safeDisplayName(object.name)) {
    return `object ${objectId}.name must be a bounded path-free display name`;
  }
  const metadataError = referenceMetadataLoadError(`object ${objectId}`, object.metadata);
  if (metadataError) return metadataError;
  if (object.layer !== undefined && !safeReferenceId(object.layer)) {
    return `object layer ${object.layer || "<missing>"} must use a safe canonical reference id`;
  }
  if (object.layer && !recordValue(assetData?.layers)[object.layer]) {
    return `object layer ${object.layer} is missing`;
  }
  if (object.bounds) {
    const boundsError = finiteBoundsError("object bounds", object.bounds);
    if (boundsError) return boundsError;
  }
  const displayError = referenceDisplayError(`object ${objectId}`, object.display, true);
  if (displayError) return displayError;
  const payloadError = objectKindPayloadError(objectId, object);
  if (payloadError) return payloadError;
  if (object.kind === "line-set") return lineSetObjectError(object);
  if (object.kind === "mesh") return meshObjectError(object);
  if (object.kind === "point-cloud") {
    const hasInlinePoints = Array.isArray(object.points);
    const hasChunkIds = Array.isArray(object.chunkIds) && object.chunkIds.length > 0;
    if (hasInlinePoints && hasChunkIds) return "point-cloud must not mix inline points and chunkIds";
    if (hasInlinePoints) return inlinePointCloudObjectError(object);
    if (hasChunkIds) return chunkedPointCloudObjectError(assetData, object);
    return "point-cloud must contain inline points or chunkIds";
  }
  return `unsupported object kind ${object.kind || "<missing>"}`;
}

function runtimeReferenceDiagnostics(data, objects, onRejectedObject = null) {
  const objectIds = new Set(Object.keys(recordValue(objects)));
  const diagnostics = [];
  for (const [index, diagnostic] of (Array.isArray(data?.diagnostics) ? data.diagnostics : []).entries()) {
    let error = null;
    if (!isRecord(diagnostic)) {
      error = `diagnostics[${index}] must be an object`;
    } else {
      const fieldError = unsupportedFieldError(`diagnostics[${index}]`, diagnostic, REFERENCE_DIAGNOSTIC_KEYS);
      if (fieldError) error = fieldError;
      else if (!REFERENCE_DIAGNOSTIC_SEVERITIES.has(diagnostic.severity)) {
        error = `diagnostics[${index}].severity must be info, warning, or error`;
      } else if (!safeDiagnosticCode(diagnostic.code)) {
        error = `diagnostics[${index}].code must be a safe diagnostic token`;
      } else if (!safeDiagnosticMessage(diagnostic.message)) {
        error = `diagnostics[${index}].message must be bounded path-free diagnostic text`;
      } else if (diagnostic.objectId !== undefined && !safeReferenceId(diagnostic.objectId)) {
        error = `diagnostics[${index}].objectId must use a safe canonical reference id`;
      } else if (diagnostic.objectId !== undefined && !objectIds.has(diagnostic.objectId)) {
        error = `diagnostic objectId ${diagnostic.objectId} does not match an accepted runtime object`;
      } else if (diagnostic.objectRefs !== undefined) {
        if (!Array.isArray(diagnostic.objectRefs)) {
          error = `diagnostics[${index}].objectRefs must be an array`;
        } else if (!diagnostic.objectRefs.length) {
          error = `diagnostics[${index}].objectRefs must not be empty`;
        } else {
          const seenObjectRefs = new Set();
          for (const [objectRefIndex, objectRef] of diagnostic.objectRefs.entries()) {
            if (!safeReferenceId(objectRef)) {
              error = `diagnostics[${index}].objectRefs[${objectRefIndex}] must use a safe canonical reference id`;
              break;
            }
            if (seenObjectRefs.has(objectRef)) {
              error = `diagnostics[${index}].objectRefs contains duplicate id ${objectRef}`;
              break;
            }
            seenObjectRefs.add(objectRef);
            if (!objectIds.has(objectRef)) {
              error = `diagnostic objectRefs[${objectRefIndex}] ${objectRef} does not match an accepted runtime object`;
              break;
            }
          }
        }
      }
    }
    if (error) {
      if (typeof onRejectedObject === "function") {
        onRejectedObject(`diagnostic:${index}`, error);
      }
      continue;
    }
    diagnostics.push(diagnostic);
  }
  return diagnostics;
}

function runtimeReferenceLayers(data, onRejectedObject = null) {
  const layers = {};
  for (const [layerId, layer] of Object.entries(recordValue(data?.layers))) {
    const error = referenceLayerLoadError(layerId, layer);
    if (error) {
      if (typeof onRejectedObject === "function") onRejectedObject(`layer:${layerId}`, error);
      continue;
    }
    layers[layerId] = layer;
  }
  return layers;
}

function runtimeReferenceChunks(data, objects) {
  const acceptedChunkIds = new Set();
  for (const object of Object.values(recordValue(objects))) {
    if (object?.kind === "point-cloud" && Array.isArray(object.chunkIds)) {
      for (const chunkId of object.chunkIds) acceptedChunkIds.add(chunkId);
    }
  }
  return (Array.isArray(data?.chunks) ? data.chunks : []).filter((chunk) => acceptedChunkIds.has(chunk?.id));
}

function referenceChunkIndex(data) {
  const chunksById = Object.create(null);
  const duplicateChunkIds = new Set();
  for (const chunk of Array.isArray(data?.chunks) ? data.chunks : []) {
    if (!safeReferenceId(chunk?.id)) continue;
    if (Object.hasOwn(chunksById, chunk.id)) duplicateChunkIds.add(chunk.id);
    chunksById[chunk.id] = chunk;
  }
  return { chunksById, duplicateChunkIds };
}

export function runtimeReferenceGeometryData(data, onRejectedObject = null) {
  const { chunksById, duplicateChunkIds } = referenceChunkIndex(data);
  const layers = runtimeReferenceLayers(data, onRejectedObject);
  const objectEntries = Object.entries(recordValue(data?.objects));
  const objects = {};
  const assetData = { ...data, layers, chunksById, duplicateChunkIds };
  for (const [objectId, object] of objectEntries) {
    const error = referenceObjectLoadError(assetData, objectId, object);
    if (error) {
      if (typeof onRejectedObject === "function") onRejectedObject(objectId, error);
      continue;
    }
    objects[objectId] = object;
  }
  return {
    ...data,
    layers,
    objects,
    chunks: runtimeReferenceChunks(data, objects),
    diagnostics: runtimeReferenceDiagnostics(data, objects, onRejectedObject)
  };
}

export function runtimeReferenceAssetBoundsError(data) {
  if (!data?.asset?.bounds) return null;
  const { chunksById, duplicateChunkIds } = referenceChunkIndex(data);
  const layers = runtimeReferenceLayers(data);
  const assetData = { ...data, layers, chunksById, duplicateChunkIds };
  const objectPayloadBounds = [];
  for (const [objectId, object] of Object.entries(recordValue(data?.objects))) {
    const objectError = referenceObjectLoadError(assetData, objectId, object);
    if (objectError) {
      return "asset.bounds cannot be verified without accepted runtime reference object payload bounds";
    }
    objectPayloadBounds.push(referenceObjectPayloadBounds(assetData, object));
  }
  const payloadBounds = completeUnionBounds(objectPayloadBounds);
  if (!payloadBounds) {
    return "asset.bounds cannot be verified without accepted runtime reference object payload bounds";
  }
  if (payloadBounds && !sameBounds(data.asset.bounds, payloadBounds)) {
    return "asset.bounds do not match runtime reference object payload bounds";
  }
  return null;
}

export function referenceManifestChunkLoadError(object, chunkId, manifestChunk) {
  if (!safeReferenceId(chunkId)) {
    return `manifest chunk key ${chunkId || "<missing>"} must use a safe canonical reference id`;
  }
  if (!manifestChunk || typeof manifestChunk !== "object" || Array.isArray(manifestChunk)) {
    return "manifest chunk is not an object";
  }
  const fieldError = unsupportedFieldError(`manifest chunk ${chunkId}`, manifestChunk, REFERENCE_MANIFEST_CHUNK_KEYS);
  if (fieldError) return fieldError;
  if (!safeReferenceId(manifestChunk.id)) {
    return `manifest chunk id ${manifestChunk.id || "<missing>"} must use a safe canonical reference id`;
  }
  if (manifestChunk.id !== chunkId) {
    return `manifest chunk id ${manifestChunk.id || "<missing>"} does not match reference ${chunkId || "<missing>"}`;
  }
  if (!safeReferenceId(manifestChunk.objectId)) {
    return `manifest chunk objectId ${manifestChunk.objectId || "<missing>"} must use a safe canonical reference id`;
  }
  if (manifestChunk.kind !== "point-cloud") {
    return `unsupported manifest chunk kind ${manifestChunk.kind || "<missing>"}`;
  }
  if (manifestChunk.objectId !== object?.id) {
    return `manifest chunk objectId ${manifestChunk.objectId || "<missing>"} does not match point-cloud ${object?.id || "<missing>"}`;
  }
  if (!isSafeReferenceChunkPath(manifestChunk.path)) {
    return "manifest chunk path is unsafe";
  }
  if (!Number.isInteger(manifestChunk.pointCount) || manifestChunk.pointCount <= 0) {
    return `manifest chunk pointCount ${manifestChunk.pointCount ?? "<missing>"} must be a positive integer`;
  }
  if (manifestChunk.bounds) {
    const boundsError = finiteBoundsError("manifest chunk bounds", manifestChunk.bounds);
    if (boundsError) return boundsError;
  }
  return null;
}

export function referencePointPreviewLimit(runtimeSettings) {
  const value = runtimeSettings?.render?.referenceGeometry?.pointPreviewLimit;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_REFERENCE_POINT_PREVIEW_LIMIT;
}

export function referencePointPreviewChunkLimit(runtimeSettings) {
  const value = runtimeSettings?.render?.referenceGeometry?.pointPreviewChunkLimit;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_REFERENCE_POINT_PREVIEW_CHUNK_LIMIT;
}

export function referencePreviewChunkIds(assetData, runtimeSettings) {
  const chunks = Array.isArray(assetData?.chunks) ? assetData.chunks : [];
  const chunksById = new Map(chunks
    .filter((chunk) => safeReferenceId(chunk?.id))
    .map((chunk) => [chunk.id, chunk]));
  const selected = new Set();
  const pointLimit = referencePointPreviewLimit(runtimeSettings);
  const chunkLimit = referencePointPreviewChunkLimit(runtimeSettings);
  if (pointLimit <= 0 || chunkLimit <= 0) return selected;

  for (const [objectId, object] of Object.entries(recordValue(assetData?.objects))) {
    if (!safeReferenceId(objectId) || !isRecord(object) || object.id !== objectId) continue;
    if (object?.kind !== "point-cloud" || !Array.isArray(object.chunkIds)) continue;
    let remaining = Math.max(0, pointLimit - (Array.isArray(object.points) ? object.points.length : 0));
    for (const chunkId of object.chunkIds) {
      if (remaining <= 0 || selected.size >= chunkLimit) break;
      const chunk = chunksById.get(chunkId);
      if (!chunk || referenceManifestChunkLoadError(object, chunkId, chunk)) continue;
      selected.add(chunk.id);
      remaining -= Number.isInteger(chunk.pointCount) && chunk.pointCount > 0 ? chunk.pointCount : 0;
    }
  }
  return selected;
}

export function referenceChunkLoadError(manifestChunk, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "chunk is not a JSON object";
  }
  const fieldError = unsupportedFieldError("chunk", data, REFERENCE_POINT_CLOUD_CHUNK_KEYS);
  if (fieldError) return fieldError;
  if (!nonEmptyString(data.$schema)) {
    return "chunk $schema must be a non-empty string";
  }
  if (data.schema !== REFERENCE_POINT_CLOUD_CHUNK_SCHEMA) {
    return `unsupported schema ${data.schema || "<missing>"}`;
  }
  if (data.schemaVersion !== REFERENCE_POINT_CLOUD_CHUNK_SCHEMA_VERSION) {
    return `unsupported schemaVersion ${data.schemaVersion || "<missing>"}`;
  }
  if (data.kind !== "point-cloud") {
    return `unsupported kind ${data.kind || "<missing>"}`;
  }
  if (!safeReferenceId(data.id)) {
    return `chunk id ${data.id || "<missing>"} must use a safe canonical reference id`;
  }
  if (data.id !== manifestChunk?.id) {
    return `chunk id ${data.id || "<missing>"} does not match manifest chunk ${manifestChunk?.id || "<missing>"}`;
  }
  if (!safeReferenceId(data.objectId)) {
    return `objectId ${data.objectId || "<missing>"} must use a safe canonical reference id`;
  }
  if (data.objectId !== manifestChunk?.objectId) {
    return `objectId ${data.objectId || "<missing>"} does not match manifest objectId ${manifestChunk?.objectId || "<missing>"}`;
  }
  const boundsError = finiteBoundsError("chunk bounds", data.bounds);
  if (boundsError) {
    return boundsError;
  }
  if (data.pointCount !== manifestChunk?.pointCount) {
    return `pointCount ${data.pointCount ?? "<missing>"} does not match manifest pointCount ${manifestChunk?.pointCount ?? "<missing>"}`;
  }
  if (!Array.isArray(data.points) || data.points.length !== data.pointCount) {
    return `point payload length ${Array.isArray(data.points) ? data.points.length : "<missing>"} does not match pointCount ${data.pointCount}`;
  }
  const payloadBounds = pointPayloadBounds(data.points);
  if (!payloadBounds) {
    return "point payload must contain finite vec3 points";
  }
  if (manifestChunk?.bounds && !sameBounds(manifestChunk.bounds, data.bounds)) {
    return "chunk bounds do not match manifest chunk bounds";
  }
  if (!sameBounds(data.bounds, payloadBounds)) {
    return "chunk bounds do not match point payload bounds";
  }
  const attributeError = pointAttributeLengthError(data.pointAttributes, data.pointCount);
  if (attributeError) return attributeError;
  const metadataError = referenceMetadataLoadError("chunk", data.metadata);
  if (metadataError) return metadataError;
  return null;
}
