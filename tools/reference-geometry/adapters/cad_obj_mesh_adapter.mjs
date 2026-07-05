#!/usr/bin/env node
import fs from "fs";
import path from "path";
import readline from "readline";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { assertAdapterRequestContract, assertAdapterScratchPath, assertAdapterStagePath } from "./adapter_request_contract.mjs";
import { assertAdapterOutputContract } from "./adapter_output_contract.mjs";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../../..");
const REFERENCE_GEOMETRY_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");
const REFERENCE_GEOMETRY_SCHEMA_NAME = schemaNameFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const ADAPTER_TRANSLATOR = "bobercad-cad-obj-mesh-adapter";
const ADAPTER_VERSION = "0.1.0";
const LOG_STREAM_TEXT_LIMIT_BYTES = 4096;
const DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const VERTEX_COLOR_LAYOUTS = new Set(["auto", "weighted-rgb", "rgba"]);
const UNSUPPORTED_OBJ_GEOMETRY_TAGS = new Set([
  "bmat",
  "con",
  "cstype",
  "curv",
  "curv2",
  "deg",
  "end",
  "hole",
  "parm",
  "scrv",
  "sp",
  "step",
  "surf",
  "trim",
  "vp"
]);
const IGNORED_OBJ_METADATA_TAGS = new Set([
  "s"
]);
const UNSUPPORTED_MTL_TEXTURE_TAGS = new Set([
  "bump",
  "decal",
  "disp",
  "map_bump",
  "map_d",
  "map_ka",
  "map_kd",
  "map_ke",
  "map_ks",
  "map_ns",
  "norm",
  "refl"
]);
const IGNORED_MTL_METADATA_TAGS = new Set([
  "illum",
  "ka",
  "ke",
  "ks",
  "ni",
  "ns",
  "sharpness",
  "tf"
]);
const IGNORED_MTL_COLOR_METADATA_TAGS = new Set([
  "ka",
  "ke",
  "ks",
  "tf"
]);
const IGNORED_MTL_SCALAR_METADATA_TAGS = new Set([
  "ni",
  "ns",
  "sharpness"
]);
const IGNORED_MTL_SCALAR_METADATA_MAX = {
  ni: 10,
  ns: 1000,
  sharpness: 1000
};
const REQUEST_FORMAT_ALIASES = {
  step: new Set(["step", "stp", "p21", "stpnc"]),
  ifc: new Set(["ifc", "ifcxml", "ifczip"])
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--request") args.request = argv[++index];
    else if (arg.startsWith("--request=")) args.request = arg.slice("--request=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureString(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`Adapter request ${label} must be a non-empty string`);
  return value;
}

function safeToken(value, fallback = "reference") {
  const token = String(value || fallback).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[A-Za-z0-9]/.test(token) ? token : fallback;
}

function schemaRef(outputPath, schemaPath) {
  return path.relative(path.dirname(path.resolve(outputPath)), schemaPath).replaceAll(path.sep, "/");
}

function schemaNameFromSchemaFile(filePath, label) {
  const schemaName = readJson(filePath)?.properties?.schema?.const;
  if (typeof schemaName !== "string" || !schemaName) {
    throw new Error(`${label} schema is missing properties.schema.const`);
  }
  return schemaName;
}

function requestSchemaVersion(request, key, requestPath) {
  const version = request?.schemaVersions?.[key];
  if (typeof version !== "string" || !version) {
    throw new Error(`${requestPath}: adapter request schemaVersions.${key} must be a non-empty string`);
  }
  return version;
}

function boolEnv(name) {
  const rawValue = String(process.env[name] || "").trim();
  if (!rawValue) return false;
  if (/\{[A-Za-z0-9_]+\}/.test(rawValue)) throw new Error(`${name} must not contain placeholders`);
  if (/^(1|true|yes|on)$/i.test(rawValue)) return true;
  if (/^(0|false|no|off)$/i.test(rawValue)) return false;
  throw new Error(`${name} must be one of 1, 0, true, false, yes, no, on, or off`);
}

function positiveIntegerEnv(name, fallback) {
  const rawValue = String(process.env[name] || "").trim();
  if (!rawValue) return fallback;
  if (/\{[A-Za-z0-9_]+\}/.test(rawValue)) throw new Error(`${name} must not contain placeholders`);
  if (!/^[1-9]\d*$/.test(rawValue)) throw new Error(`${name} must be a positive integer byte count`);
  return Number(rawValue);
}

function vertexColorLayoutEnv() {
  const rawValue = String(process.env.BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT || "auto").trim().toLowerCase();
  if (!rawValue) return "auto";
  if (/\{[A-Za-z0-9_]+\}/.test(rawValue)) throw new Error("BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT must not contain placeholders");
  if (VERTEX_COLOR_LAYOUTS.has(rawValue)) return rawValue;
  throw new Error("BOBERCAD_CAD_OBJ_VERTEX_COLOR_LAYOUT must be one of auto, weighted-rgb, or rgba");
}

function appendLog(request, text) {
  if (!request.adapterLogPath) return;
  fs.mkdirSync(path.dirname(request.adapterLogPath), { recursive: true });
  fs.appendFileSync(request.adapterLogPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function boundedText(text, limitBytes = LOG_STREAM_TEXT_LIMIT_BYTES) {
  const value = String(text ?? "");
  const sizeBytes = Buffer.byteLength(value, "utf8");
  if (sizeBytes <= limitBytes) return { text: value, sizeBytes, omittedBytes: 0 };
  const clipped = Buffer.from(value, "utf8").subarray(0, limitBytes).toString("utf8");
  return {
    text: clipped,
    sizeBytes,
    omittedBytes: Math.max(0, sizeBytes - Buffer.byteLength(clipped, "utf8"))
  };
}

function logStreamText(label, text) {
  if (!text) return `${label}: <empty>`;
  const bounded = boundedText(text);
  if (!bounded.omittedBytes) return `${label}:\n${bounded.text}`;
  return `${label} (${bounded.sizeBytes} byte(s), clipped to ${LOG_STREAM_TEXT_LIMIT_BYTES} byte(s), ${bounded.omittedBytes} byte(s) omitted):\n${bounded.text}`;
}

function processFailureDetail(stderr, stdout) {
  const detail = [stderr, stdout].filter(Boolean).join("\n").trim();
  if (!detail) return "";
  const bounded = boundedText(detail);
  const suffix = bounded.omittedBytes
    ? `\n<${bounded.omittedBytes} byte(s) omitted from process output>`
    : "";
  return `${bounded.text}${suffix}`;
}

function scalarReplacements(request, requestPath, objPath) {
  const replacements = {
    request: requestPath,
    obj: objPath,
    mesh: objPath
  };
  for (const [key, value] of Object.entries(request || {})) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      replacements[key] = String(value);
    }
  }
  return replacements;
}

function expandTemplate(value, replacements) {
  return String(value).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    if (!Object.hasOwn(replacements, key)) throw new Error(`Unsupported CAD OBJ bridge placeholder ${match}`);
    return replacements[key];
  });
}

function resolveObjOutput(rawOutput, defaultObjPath, replacements) {
  if (/^(-|stdout)$/i.test(String(rawOutput || "").trim())) {
    return {
      objPath: defaultObjPath,
      useStdout: true
    };
  }
  return {
    objPath: path.resolve(expandTemplate(rawOutput || defaultObjPath, replacements)),
    useStdout: false
  };
}

function parseArgsString(raw, label) {
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
  if (quote) throw new Error(`${label} has an unterminated quoted argument`);
  if (current) args.push(current);
  if (!args.length) throw new Error(`${label} must contain at least one argument`);
  return args;
}

function parseArgsTemplate(rawJson, rawArgs, replacements) {
  const numberedArgs = Object.entries(process.env)
    .map(([key, value]) => {
      const match = /^BOBERCAD_CAD_TO_OBJ_ARG_(\d+)$/.exec(key);
      return match ? [Number(match[1]), value] : null;
    })
    .filter(Boolean)
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => expandTemplate(value, replacements));
  if (numberedArgs.length) return numberedArgs;
  if (rawJson) {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (error) {
      throw new Error(`BOBERCAD_CAD_TO_OBJ_ARGS_JSON must be a JSON string array: ${error.message}`);
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("BOBERCAD_CAD_TO_OBJ_ARGS_JSON must be a JSON string array");
    }
    return parsed.map((value) => expandTemplate(value, replacements));
  }
  if (rawArgs) return parseArgsString(rawArgs, "BOBERCAD_CAD_TO_OBJ_ARGS").map((value) => expandTemplate(value, replacements));
  return ["--input", "{input}", "--output", "{obj}"].map((value) => expandTemplate(value, replacements));
}

function runProcess(label, command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env || process.env,
    shell: options.shell === true,
    timeout: options.timeoutMs,
    maxBuffer: options.streamMaxBufferBytes || DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES,
    windowsHide: true
  });
  if (result.error) {
    if (result.error.code === "ENOBUFS") {
      throw new Error(`${label} exceeded the ${options.streamMaxBufferBytes || DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES} byte process stream buffer`);
    }
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = processFailureDetail(result.stderr, result.stdout);
    throw new Error(`${label} failed with exit code ${result.status}${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function objNumber(value) {
  const raw = String(value ?? "").trim();
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  const fortranExponent = Number(raw.replace(/[dD]/g, "E"));
  if (Number.isFinite(fortranExponent)) return fortranExponent;
  if (/^[-+]?(?:\d+(?:[,.]\d*)?|[,.]\d+)(?:[EeDd][-+]?\d+)?$/.test(raw)) {
    const normalized = Number(raw.replace(",", ".").replace(/[dD]/g, "E"));
    if (Number.isFinite(normalized)) return normalized;
  }
  return NaN;
}

function finiteNumber(value, label, lineNumber) {
  const number = objNumber(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid OBJ ${label} at line ${lineNumber}: ${value}`);
  return number;
}

function assertObjVertexFieldCount(parts, lineNumber, vertexColorLayout) {
  const valueCount = parts.length - 1;
  const allowedCounts = vertexColorLayout === "rgba" ? new Set([3, 6, 7]) : new Set([3, 4, 6, 7]);
  if (!allowedCounts.has(valueCount)) {
    throw new Error(`OBJ vertex at line ${lineNumber} has unsupported field count ${valueCount} for ${vertexColorLayout} vertex color layout`);
  }
}

function objHomogeneousWeight(parts, lineNumber, vertexColorLayout = "auto") {
  if (vertexColorLayout === "rgba") return null;
  if (parts.length !== 5 && parts.length < 8) return null;
  const weight = finiteNumber(parts[4], "w", lineNumber);
  if (Math.abs(weight) < 1e-12) throw new Error(`Invalid OBJ homogeneous vertex weight at line ${lineNumber}: ${parts[4]}`);
  return weight;
}

function objVertexPosition(parts, lineNumber, vertexColorLayout) {
  const point = [
    finiteNumber(parts[1], "x", lineNumber),
    finiteNumber(parts[2], "y", lineNumber),
    finiteNumber(parts[3], "z", lineNumber)
  ];
  const weight = objHomogeneousWeight(parts, lineNumber, vertexColorLayout);
  if (weight === null || Math.abs(weight - 1) < 1e-12) return point;
  return point.map((value) => value / weight);
}

function safeChildPath(parentDir, childPath) {
  const resolved = path.resolve(parentDir, childPath);
  const relative = path.relative(parentDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function byteHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function rgbHex(values) {
  return `#${values.map(byteHex).join("")}`;
}

function mtlColor(values, context) {
  const label = context ? ` at ${context}` : "";
  if (!Array.isArray(values) || values.length !== 3) {
    throw new Error(`Invalid OBJ MTL Kd${label}: expected 3 color channels`);
  }
  const rgb = values.slice(0, 3).map(objNumber);
  if (!rgb.every(Number.isFinite) || rgb.some((value) => value < 0)) {
    throw new Error(`Invalid OBJ MTL Kd${label}: ${values.slice(0, 3).join(" ")}`);
  }
  const scaled = rgb.every((value) => value >= 0 && value <= 1) ? rgb.map((value) => value * 255) : rgb;
  if (scaled.some((value) => value < 0 || value > 255)) {
    throw new Error(`Invalid OBJ MTL Kd${label}: ${values.slice(0, 3).join(" ")}`);
  }
  return rgbHex(scaled);
}

function objVertexColor(parts, lineNumber, vertexColorLayout) {
  if (parts.length < 7) return null;
  const hasHomogeneousWeight = objHomogeneousWeight(parts, lineNumber, vertexColorLayout) !== null;
  const colorTokens = hasHomogeneousWeight ? parts.slice(5, 8) : parts.slice(4, 7);
  const rgb = colorTokens.map((token, index) => finiteNumber(token, ["r", "g", "b"][index], lineNumber));
  if (rgb.some((value) => value < 0)) throw new Error(`Invalid OBJ vertex color at line ${lineNumber}: ${colorTokens.join(" ")}`);
  if (rgb.every((value) => value <= 1)) return rgb.map((value) => Math.round(value * 255));
  if (rgb.every((value) => value <= 255)) return rgb.map((value) => Math.round(value));
  if (rgb.every((value) => value <= 65535)) return rgb.map((value) => Math.round(value / 257));
  throw new Error(`Invalid OBJ vertex color at line ${lineNumber}: ${colorTokens.join(" ")}`);
}

function mtlOpacity(value, transparent = false, context = "opacity") {
  const number = objNumber(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`Invalid OBJ MTL ${context}: ${value}`);
  }
  return transparent ? 1 - number : number;
}

function assertIgnoredMtlMetadata(parts, context) {
  const tag = parts[0].toLowerCase();
  if (IGNORED_MTL_COLOR_METADATA_TAGS.has(tag)) {
    if (parts.length !== 4) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: expected ${parts[0]} r g b`);
    }
    const values = parts.slice(1).map(objNumber);
    if (!values.every(Number.isFinite) || values.some((value) => value < 0 || value > 255)) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: ${parts.slice(1).join(" ")}`);
    }
  } else if (IGNORED_MTL_SCALAR_METADATA_TAGS.has(tag)) {
    if (parts.length !== 2) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: expected ${parts[0]} value`);
    }
    const value = objNumber(parts[1]);
    if (!Number.isFinite(value) || value < 0 || value > IGNORED_MTL_SCALAR_METADATA_MAX[tag]) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: ${parts[1]}`);
    }
  } else if (tag === "illum") {
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: expected ${parts[0]} model`);
    }
    const model = Number(parts[1]);
    if (model < 0 || model > 10) {
      throw new Error(`Invalid OBJ MTL ${parts[0]} at ${context}: ${parts[1]}`);
    }
  }
}

function materialDisplay(materialInfo, fallbackColor = null) {
  const display = {};
  if (materialInfo?.color) display.color = materialInfo.color;
  else if (fallbackColor) display.color = fallbackColor;
  if (Number.isFinite(materialInfo?.opacity)) display.opacity = materialInfo.opacity;
  return Object.keys(display).length ? display : null;
}

function objReferencedIndex(raw, count, label, token, lineNumber) {
  if (!/^[-+]?\d+$/.test(raw)) throw new Error(`Invalid OBJ ${label} index at line ${lineNumber}: ${token}`);
  const index = Number(raw);
  if (!Number.isInteger(index) || index === 0) throw new Error(`Invalid OBJ ${label} index at line ${lineNumber}: ${token}`);
  const resolved = index > 0 ? index - 1 : count + index;
  if (resolved < 0 || resolved >= count) throw new Error(`OBJ ${label} index out of range at line ${lineNumber}: ${token}`);
  return resolved;
}

function objIndex(token, indexCounts, lineNumber) {
  const value = String(token);
  if (!/^[-+]?\d+(?:\/[-+]?\d+(?:\/[-+]?\d+)?|\/\/[-+]?\d+)?$/.test(value)) {
    throw new Error(`Invalid OBJ vertex reference at line ${lineNumber}: ${token}`);
  }
  const [vertexToken, textureToken, normalToken] = value.split("/");
  const resolved = objReferencedIndex(vertexToken, indexCounts.vertices, "vertex", token, lineNumber);
  if (textureToken !== undefined && textureToken !== "") {
    objReferencedIndex(textureToken, indexCounts.textureVertices, "texture vertex", token, lineNumber);
  }
  if (normalToken !== undefined && normalToken !== "") {
    objReferencedIndex(normalToken, indexCounts.normals, "normal", token, lineNumber);
  }
  return resolved;
}

function objFaceIndices(tokens, indexCounts, lineNumber) {
  const indices = tokens.map((token) => objIndex(token, indexCounts, lineNumber));
  if (indices.length > 3 && indices[0] === indices[indices.length - 1]) {
    indices.pop();
  }
  const distinctIndices = new Set(indices);
  if (distinctIndices.size < 3) {
    throw new Error(`OBJ face at line ${lineNumber} must reference at least 3 distinct vertices`);
  }
  for (let index = 0; index < indices.length - 1; index += 1) {
    if (indices[index] === indices[index + 1]) {
      throw new Error(`OBJ face at line ${lineNumber} must not contain consecutive duplicate vertex references`);
    }
  }
  if (distinctIndices.size !== indices.length) {
    throw new Error(`OBJ face at line ${lineNumber} must not contain repeated non-closing vertex references`);
  }
  return indices;
}

function objLineIndices(tokens, indexCounts, lineNumber) {
  const indices = tokens.map((token) => objIndex(token, indexCounts, lineNumber));
  for (let index = 0; index < indices.length - 1; index += 1) {
    if (indices[index] === indices[index + 1]) {
      throw new Error(`OBJ line at line ${lineNumber} must not contain consecutive duplicate vertex references`);
    }
  }
  return indices;
}

function objPointIndices(tokens, indexCounts, lineNumber) {
  const indices = tokens.map((token) => objIndex(token, indexCounts, lineNumber));
  if (new Set(indices).size !== indices.length) {
    throw new Error(`OBJ point element at line ${lineNumber} must not contain duplicate vertex references`);
  }
  return indices;
}

function boundsFor(points) {
  const min = [...points[0]];
  const max = [...points[0]];
  for (const point of points.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

function unionBounds(boundsList) {
  const bounds = boundsList.filter(Boolean);
  if (!bounds.length) return null;
  const min = [...bounds[0].min];
  const max = [...bounds[0].max];
  for (const bound of bounds.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bound.min[axis]);
      max[axis] = Math.max(max[axis], bound.max[axis]);
    }
  }
  return { min, max };
}

function stripObjComment(line) {
  const text = String(line || "");
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === "\\" && (text[index + 1] === quote || text[index + 1] === "\\")) {
        index += 1;
        continue;
      }
      if (quote === "\"" && char === "\"" && text[index + 1] === "\"") {
        index += 1;
        continue;
      }
      if (quote === "'" && char === "'" && text[index + 1] === "'") {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(text[index - 1]))) {
      return text.slice(0, index);
    }
  }
  return text;
}

function unescapeObjDoubleQuotedName(value) {
  return String(value || "").replaceAll("\"\"", "\"").replace(/\\(["\\#])/g, "$1");
}

function unescapeObjSingleQuotedName(value) {
  return String(value || "").replaceAll("''", "'").replace(/\\(['\\#])/g, "$1");
}

function unescapeObjBareName(value) {
  return String(value || "").replace(/\\([\s"'#\\])/g, "$1");
}

function unquoteObjName(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    const inner = trimmed.slice(1, -1);
    return first === "\"" ? unescapeObjDoubleQuotedName(inner) : unescapeObjSingleQuotedName(inner);
  }
  return unescapeObjBareName(trimmed);
}

function objMaterialName(value, lineNumber) {
  const name = unquoteObjName(value);
  if (!name) throw new Error(`OBJ usemtl at line ${lineNumber} must name a material or use off/none`);
  return name && !["off", "none"].includes(name.toLowerCase()) ? name : null;
}

function objRequiredName(value, label, lineNumber) {
  const name = unquoteObjName(value);
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  if (!name) throw new Error(`OBJ ${label} at line ${lineNumber} must name ${article} ${label}`);
  return name;
}

function assertObjTextureVertex(parts, lineNumber) {
  if (parts.length < 2 || parts.length > 4) {
    throw new Error(`OBJ texture vertex at line ${lineNumber} must have u [v] [w]`);
  }
  for (let index = 1; index < parts.length; index += 1) {
    finiteNumber(parts[index], "texture coordinate", lineNumber);
  }
}

function assertObjNormal(parts, lineNumber) {
  if (parts.length !== 4) throw new Error(`OBJ normal at line ${lineNumber} must have x y z`);
  const normal = ["x", "y", "z"].map((label, index) => finiteNumber(parts[index + 1], `normal ${label}`, lineNumber));
  if (normal.every((value) => Math.abs(value) < 1e-12)) {
    throw new Error(`OBJ normal at line ${lineNumber} must not be a zero vector`);
  }
}

function assertIgnoredObjMetadata(parts, lineNumber) {
  const tag = parts[0].toLowerCase();
  if (tag === "s") {
    const value = String(parts[1] || "").toLowerCase();
    if (parts.length !== 2 || (value !== "off" && !/^\d+$/.test(value))) {
      throw new Error(`OBJ smoothing group at line ${lineNumber} must be off or a non-negative integer`);
    }
  }
}

function appendObjContinuation(left, right) {
  const prefix = String(left || "").trimEnd();
  const suffix = String(right || "").trimStart();
  return prefix ? `${prefix} ${suffix}` : suffix;
}

function objMtlLibraries(text, lineNumber) {
  const libraries = [];
  let current = "";
  let quote = null;
  let tokenStarted = false;
  const pushLibrary = () => {
    if (!current) throw new Error(`OBJ mtllib at line ${lineNumber} must not include empty material library names`);
    libraries.push(current);
    current = "";
    tokenStarted = false;
  };
  const raw = String(text || "");
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote) {
      if (char === "\\" && (raw[index + 1] === quote || raw[index + 1] === "\\" || raw[index + 1] === "#")) {
        current += raw[index + 1];
        tokenStarted = true;
        index += 1;
        continue;
      }
      if (quote === "\"" && char === "\"" && raw[index + 1] === "\"") {
        current += "\"";
        tokenStarted = true;
        index += 1;
        continue;
      }
      if (quote === "'" && char === "'" && raw[index + 1] === "'") {
        current += "'";
        tokenStarted = true;
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
        tokenStarted = true;
      } else {
        current += char;
        tokenStarted = true;
      }
      continue;
    }
    if (char === "\\" && raw[index + 1] !== undefined && /[\s"'#\\]/.test(raw[index + 1])) {
      current += raw[index + 1];
      tokenStarted = true;
      index += 1;
    } else if (char === "\"" || char === "'") {
      quote = char;
      tokenStarted = true;
    } else if (/\s/.test(char)) {
      if (tokenStarted) pushLibrary();
    } else {
      current += char;
      tokenStarted = true;
    }
  }
  if (quote) throw new Error(`Unterminated quoted OBJ mtllib at line ${lineNumber}`);
  if (tokenStarted) pushLibrary();
  if (!libraries.length) throw new Error(`OBJ mtllib at line ${lineNumber} must name at least one material library`);
  return libraries;
}

async function parseObj(objPath, options = {}) {
  const vertexColorLayout = options.vertexColorLayout || "auto";
  const vertices = [];
  const vertexColors = [];
  let textureVertexCount = 0;
  let normalCount = 0;
  const faces = [];
  const lineSegments = [];
  const points = [];
  const materialLibraries = [];
  let activeMaterial = null;
  let activeObjectName = null;
  let activeGroupName = null;
  const stream = fs.createReadStream(objPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  let pendingLine = "";
  let pendingContinuation = false;
  for await (const rawLine of rl) {
    lineNumber += 1;
    const physicalLine = stripObjComment(rawLine).trimEnd();
    const continues = /\\$/.test(physicalLine);
    const linePart = continues ? physicalLine.slice(0, -1) : physicalLine;
    if (continues) {
      pendingLine = appendObjContinuation(pendingLine, linePart);
      pendingContinuation = true;
      continue;
    }
    const line = appendObjContinuation(pendingLine, linePart).trim();
    pendingLine = "";
    pendingContinuation = false;
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const tag = parts[0].toLowerCase();
    const indexCounts = { vertices: vertices.length, textureVertices: textureVertexCount, normals: normalCount };
    if (tag === "v") {
      if (parts.length < 4) throw new Error(`OBJ vertex at line ${lineNumber} must have x y z`);
      assertObjVertexFieldCount(parts, lineNumber, vertexColorLayout);
      vertices.push(objVertexPosition(parts, lineNumber, vertexColorLayout));
      vertexColors.push(objVertexColor(parts, lineNumber, vertexColorLayout));
    } else if (tag === "vt") {
      assertObjTextureVertex(parts, lineNumber);
      textureVertexCount += 1;
    } else if (tag === "vn") {
      assertObjNormal(parts, lineNumber);
      normalCount += 1;
    } else if (tag === "f") {
      if (parts.length < 4) throw new Error(`OBJ face at line ${lineNumber} must reference at least 3 vertices`);
      faces.push({
        indices: objFaceIndices(parts.slice(1), indexCounts, lineNumber),
        material: activeMaterial,
        objectName: activeObjectName,
        groupName: activeGroupName,
        lineNumber
      });
    } else if (tag === "l") {
      if (parts.length < 3) throw new Error(`OBJ line at line ${lineNumber} must reference at least 2 vertices`);
      const indices = objLineIndices(parts.slice(1), indexCounts, lineNumber);
      for (let index = 0; index < indices.length - 1; index += 1) {
        lineSegments.push({
          indices: [indices[index], indices[index + 1]],
          material: activeMaterial,
          objectName: activeObjectName,
          groupName: activeGroupName,
          lineNumber
        });
      }
    } else if (tag === "p") {
      if (parts.length < 2) throw new Error(`OBJ point element at line ${lineNumber} must reference at least 1 vertex`);
      points.push({
        indices: objPointIndices(parts.slice(1), indexCounts, lineNumber),
        lineNumber,
        material: activeMaterial,
        objectName: activeObjectName,
        groupName: activeGroupName
      });
    } else if (tag === "usemtl") {
      activeMaterial = objMaterialName(line.slice(parts[0].length), lineNumber);
    } else if (tag === "mtllib") {
      for (const library of objMtlLibraries(line.slice(parts[0].length), lineNumber)) {
        if (library) materialLibraries.push({ path: library, lineNumber });
      }
    } else if (tag === "o") {
      activeObjectName = objRequiredName(line.slice(parts[0].length), "object", lineNumber);
    } else if (tag === "g") {
      activeGroupName = objRequiredName(line.slice(parts[0].length), "group", lineNumber);
    } else if (IGNORED_OBJ_METADATA_TAGS.has(tag)) {
      assertIgnoredObjMetadata(parts, lineNumber);
      continue;
    } else if (UNSUPPORTED_OBJ_GEOMETRY_TAGS.has(tag)) {
      throw new Error(`OBJ ${tag} records are not supported at line ${lineNumber}; tessellator output must emit v/f/l/p geometry`);
    } else {
      throw new Error(`OBJ ${tag} records are not supported at line ${lineNumber}; CAD-to-OBJ converter output must use supported v/vt/vn/f/l/p/material records`);
    }
  }
  if (pendingContinuation || pendingLine.trim()) throw new Error(`${objPath}: OBJ output ended during a line continuation`);
  if (!vertices.length) throw new Error(`${objPath}: OBJ output contains no vertices`);
  if (!faces.length && !lineSegments.length && !points.length) throw new Error(`${objPath}: OBJ output contains no faces, lines, or points`);
  const materials = parseMtlLibraries(objPath, materialLibraries);
  assertReferencedObjMaterials([...faces, ...lineSegments, ...points], materials, materialLibraries);
  return { vertices, vertexColors, faces, lineSegments, points, materials };
}

function parseMtlLibraries(objPath, materialLibraries) {
  const materials = new Map();
  const objDir = path.dirname(path.resolve(objPath));
  for (const libraryRef of materialLibraries) {
    const library = typeof libraryRef === "string" ? libraryRef : libraryRef.path;
    const lineNumber = typeof libraryRef === "object" ? libraryRef.lineNumber : null;
    const libraryPath = safeChildPath(objDir, library);
    if (!libraryPath) {
      const location = Number.isInteger(lineNumber) ? ` at line ${lineNumber}` : "";
      throw new Error(`OBJ mtllib${location} must resolve inside staged OBJ directory: ${library}`);
    }
    if (!fs.existsSync(libraryPath)) {
      const location = Number.isInteger(lineNumber) ? ` at line ${lineNumber}` : "";
      throw new Error(`OBJ mtllib${location} did not resolve to an existing MTL file inside staged OBJ directory: ${library}`);
    }
    const text = fs.readFileSync(libraryPath, "utf8").replace(/^\uFEFF/, "");
    let activeMaterial = null;
    let mtlLineNumber = 0;
    for (const rawLine of text.split(/\r?\n/)) {
      mtlLineNumber += 1;
      const line = stripObjComment(rawLine).trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);
      const tag = parts[0].toLowerCase();
      if (tag === "newmtl") {
        activeMaterial = unquoteObjName(line.slice(parts[0].length)) || null;
        if (!activeMaterial) {
          throw new Error(`OBJ MTL newmtl at ${path.basename(libraryPath)}:${mtlLineNumber} must name a material`);
        }
        if (activeMaterial && materials.has(activeMaterial)) {
          throw new Error(`OBJ material ${activeMaterial} is defined more than once in MTL libraries at ${path.basename(libraryPath)}:${mtlLineNumber}`);
        }
        if (activeMaterial) {
          materials.set(activeMaterial, { library: path.basename(libraryPath) });
        }
      } else if ((tag === "kd" || tag === "d" || tag === "tr" || IGNORED_MTL_METADATA_TAGS.has(tag)) && !activeMaterial) {
        throw new Error(`OBJ MTL ${parts[0]} at ${path.basename(libraryPath)}:${mtlLineNumber} must follow a newmtl material definition`);
      } else if (tag === "kd" && activeMaterial) {
        if (Object.hasOwn(materials.get(activeMaterial) || {}, "color")) {
          throw new Error(`OBJ material ${activeMaterial} defines Kd more than once in MTL libraries at ${path.basename(libraryPath)}:${mtlLineNumber}`);
        }
        const color = mtlColor(parts.slice(1), `${path.basename(libraryPath)}:${mtlLineNumber}`);
        if (color) materials.set(activeMaterial, { ...(materials.get(activeMaterial) || {}), color, library: path.basename(libraryPath) });
      } else if ((tag === "d" || tag === "tr") && activeMaterial) {
        const material = materials.get(activeMaterial) || {};
        if (Object.hasOwn(material, "opacity")) {
          throw new Error(`OBJ material ${activeMaterial} defines opacity more than once in MTL libraries at ${path.basename(libraryPath)}:${mtlLineNumber}`);
        }
        const usesHalo = tag === "d" && String(parts[1] || "").toLowerCase() === "-halo";
        const expectedLength = usesHalo ? 3 : 2;
        if (parts.length !== expectedLength) {
          const label = tag === "tr" ? "Tr" : "d";
          throw new Error(`Invalid OBJ MTL ${label} at ${path.basename(libraryPath)}:${mtlLineNumber}: expected ${usesHalo ? "d -halo opacity" : `${label} opacity`}`);
        }
        const opacityValue = usesHalo ? parts[2] : parts[1];
        const opacityContext = `${tag === "tr" ? "Tr" : "d"} at ${path.basename(libraryPath)}:${mtlLineNumber}`;
        const opacity = mtlOpacity(opacityValue, tag === "tr", opacityContext);
        if (opacity !== null) materials.set(activeMaterial, { ...material, opacity, library: path.basename(libraryPath) });
      } else if (UNSUPPORTED_MTL_TEXTURE_TAGS.has(tag)) {
        throw new Error(`OBJ MTL ${parts[0]} at ${path.basename(libraryPath)}:${mtlLineNumber} is not supported; texture maps must be baked by the CAD-to-OBJ converter before canonical output`);
      } else if (IGNORED_MTL_METADATA_TAGS.has(tag)) {
        assertIgnoredMtlMetadata(parts, `${path.basename(libraryPath)}:${mtlLineNumber}`);
        continue;
      } else {
        throw new Error(`OBJ MTL ${parts[0]} at ${path.basename(libraryPath)}:${mtlLineNumber} is not supported; CAD-to-OBJ converter output must use supported newmtl/Kd/d/Tr material records or known ignored material metadata`);
      }
    }
  }
  return materials;
}

function assertReferencedObjMaterials(items, materials, materialLibraries) {
  if (!materialLibraries.length) {
    for (const item of items) {
      if (!item.material) continue;
      const location = Number.isInteger(item.lineNumber) ? ` at line ${item.lineNumber}` : "";
      throw new Error(`OBJ usemtl ${item.material}${location} requires a staged mtllib material library`);
    }
    return;
  }
  for (const item of items) {
    if (!item.material || materials.has(item.material)) continue;
    const location = Number.isInteger(item.lineNumber) ? ` at line ${item.lineNumber}` : "";
    throw new Error(`OBJ usemtl ${item.material}${location} does not match any material defined by staged MTL libraries`);
  }
}

function objectVertices(vertices, usedIndices) {
  const ordered = [...usedIndices].sort((left, right) => left - right);
  const remap = new Map(ordered.map((sourceIndex, nextIndex) => [sourceIndex, nextIndex]));
  return {
    vertices: ordered.map((index) => vertices[index]),
    remap
  };
}

function objectPointPayload(vertices, vertexColors, pointItems) {
  const points = [];
  const colors = [];
  let hasColors = false;
  let firstMissingColorLine = null;
  for (const item of pointItems) {
    for (const index of item.indices) {
      points.push(vertices[index]);
      const color = vertexColors[index] || null;
      colors.push(color);
      hasColors ||= Boolean(color);
      if (!color && firstMissingColorLine === null) firstMissingColorLine = item.lineNumber;
    }
  }
  if (hasColors && !colors.every(Boolean)) {
    const location = Number.isInteger(firstMissingColorLine) ? ` at line ${firstMissingColorLine}` : "";
    throw new Error(`OBJ point-cloud group${location} must not mix colored and uncolored vertex references`);
  }
  const pointAttributes = hasColors && colors.every(Boolean) ? { colors } : null;
  return { points, pointAttributes };
}

function sameRgb(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length >= 3
    && right.length >= 3
    && left[0] === right[0]
    && left[1] === right[1]
    && left[2] === right[2];
}

function uniformItemVertexColor(item, vertexColors) {
  if (!Array.isArray(vertexColors) || !Array.isArray(item?.indices) || !item.indices.length) return null;
  const colors = item.indices.map((index) => vertexColors[index] || null);
  if (!colors.every(Boolean)) return null;
  const first = colors[0];
  return colors.every((color) => sameRgb(color, first)) ? rgbHex(first) : null;
}

function groupedObjItems(items, options = {}) {
  const groups = new Map();
  for (const item of items) {
    const materialInfo = options.materials?.get(item.material);
    const vertexColor = materialInfo?.color ? null : uniformItemVertexColor(item, options.vertexColors);
    const key = JSON.stringify([
      item.objectName || "",
      item.groupName || "",
      item.material || "",
      vertexColor || ""
    ]);
    if (!groups.has(key)) {
      groups.set(key, {
        objectName: item.objectName,
        groupName: item.groupName,
        materialName: item.material,
        vertexColor,
        items: []
      });
    }
    groups.get(key).items.push(item);
  }
  return groups.values();
}

function uniqueObjectId(objects, baseId) {
  let id = baseId;
  let suffix = 2;
  while (Object.hasOwn(objects, id)) {
    id = `${baseId}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function objGroupIdSuffix(group) {
  const tokens = [
    group.objectName ? safeToken(group.objectName, "object") : "",
    group.groupName ? safeToken(group.groupName, "group") : "",
    group.materialName ? safeToken(group.materialName, "material") : "",
    group.vertexColor ? safeToken(group.vertexColor.replace(/^#/, ""), "vertex_color") : ""
  ].filter(Boolean);
  return tokens.length ? `_${tokens.join("_")}` : "";
}

function objGroupLabel(group) {
  const labels = [group.objectName, group.groupName, group.materialName].filter(Boolean);
  return labels.length ? ` (${labels.join(" / ")})` : "";
}

function objMetadata(group, materialInfo, objPath) {
  const metadata = {
    objSource: path.basename(objPath)
  };
  if (group.objectName) metadata.objObject = group.objectName;
  if (group.groupName) metadata.objGroup = group.groupName;
  if (group.materialName) metadata.objMaterial = group.materialName;
  if (materialInfo?.library) metadata.objMaterialLibrary = materialInfo.library;
  if (group.vertexColor) {
    metadata.objUniformVertexColor = group.vertexColor;
    metadata.objDisplayColorSource = "uniform-vertex-color";
  }
  return metadata;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestPath = path.resolve(ensureString(args.request, "path"));
  const request = readJson(requestPath);
  assertAdapterRequestContract(request, requestPath, {
    formatAliases: REQUEST_FORMAT_ALIASES,
    formatErrorMessage: "CAD OBJ adapter expects a STEP or IFC request"
  });
  const referenceGeometrySchemaVersion = requestSchemaVersion(request, "referenceGeometry", requestPath);

  const output = path.resolve(ensureString(request.output, "output"));
  const input = path.resolve(ensureString(request.input, "input"));
  const stageDir = path.resolve(ensureString(request.stageDir, "stageDir"));
  const scratchDir = path.resolve(ensureString(request.scratchDir || request.stageDir, "scratchDir"));
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const defaultObjPath = path.join(scratchDir, `${safeToken(request.sourceFileStem)}.mesh.obj`);
  const preReplacements = scalarReplacements(request, requestPath, defaultObjPath);
  const objOutput = resolveObjOutput(process.env.BOBERCAD_CAD_TO_OBJ_OUTPUT, defaultObjPath, preReplacements);
  const objPath = assertAdapterScratchPath(objOutput.objPath, scratchDir, "objPath", requestPath);
  const replacements = scalarReplacements(request, requestPath, objPath);
  fs.mkdirSync(path.dirname(objPath), { recursive: true });

  const converterCommand = process.env.BOBERCAD_CAD_TO_OBJ_COMMAND;
  if (!converterCommand) throw new Error("BOBERCAD_CAD_TO_OBJ_COMMAND is required for the CAD OBJ adapter");
  const converterArgs = parseArgsTemplate(process.env.BOBERCAD_CAD_TO_OBJ_ARGS_JSON, process.env.BOBERCAD_CAD_TO_OBJ_ARGS, replacements);
  const converterCwd = assertAdapterStagePath(
    path.resolve(expandTemplate(process.env.BOBERCAD_CAD_TO_OBJ_CWD || stageDir, replacements)),
    stageDir,
    "converterCwd",
    requestPath
  );
  const timeoutMs = Number.isInteger(request.timeoutMs) ? request.timeoutMs : 120000;
  const streamMaxBufferBytes = positiveIntegerEnv("BOBERCAD_CAD_TO_OBJ_STREAM_MAX_BUFFER_BYTES", DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES);
  appendLog(request, `CAD OBJ converter command: ${converterCommand}`);
  appendLog(request, `CAD OBJ converter args: ${JSON.stringify(converterArgs)}`);
  const converter = runProcess("CAD to OBJ converter", converterCommand, converterArgs, {
    cwd: converterCwd,
    shell: boolEnv("BOBERCAD_CAD_TO_OBJ_SHELL"),
    timeoutMs,
    streamMaxBufferBytes
  });
  if (objOutput.useStdout) {
    if (!converter.stdout?.trim()) throw new Error("CAD to OBJ converter stdout did not contain OBJ text");
    fs.writeFileSync(objPath, converter.stdout, "utf8");
    appendLog(request, `CAD OBJ converter stdout captured as OBJ text: ${Buffer.byteLength(converter.stdout, "utf8")} byte(s)`);
  } else {
    appendLog(request, logStreamText("CAD OBJ converter stdout", converter.stdout));
  }
  appendLog(request, logStreamText("CAD OBJ converter stderr", converter.stderr));
  if (!fs.existsSync(objPath)) throw new Error(`CAD to OBJ converter did not write expected OBJ output: ${objPath}`);

  const vertexColorLayout = vertexColorLayoutEnv();
  appendLog(request, `CAD OBJ vertex color layout: ${vertexColorLayout}`);
  const obj = await parseObj(objPath, { vertexColorLayout });
  const assetToken = safeToken(request.assetId, `${request.format}_reference`);
  const layerId = `${assetToken}_mesh_layer`;
  const objects = {};
  const objectBounds = [];
  if (obj.faces.length) {
    for (const group of groupedObjItems(obj.faces, { materials: obj.materials, vertexColors: obj.vertexColors })) {
      const materialInfo = obj.materials.get(group.materialName);
      const faces = group.items;
      const objectSuffix = objGroupIdSuffix(group);
      const used = new Set(faces.flatMap((face) => face.indices));
      const { vertices, remap } = objectVertices(obj.vertices, used);
      const objectId = uniqueObjectId(objects, `${assetToken}_mesh${objectSuffix}`);
      const bounds = boundsFor(vertices);
      objectBounds.push(bounds);
      objects[objectId] = {
        id: objectId,
        kind: "mesh",
        name: `External tessellated mesh${objGroupLabel(group)}`,
        layer: layerId,
        bounds,
        vertices,
        faces: faces.map((face) => face.indices.map((index) => remap.get(index))),
        metadata: objMetadata(group, materialInfo, objPath)
      };
      const display = materialDisplay(materialInfo, group.vertexColor);
      if (display) objects[objectId].display = display;
    }
  }
  if (obj.lineSegments.length) {
    for (const group of groupedObjItems(obj.lineSegments, { materials: obj.materials, vertexColors: obj.vertexColors })) {
      const materialInfo = obj.materials.get(group.materialName);
      const lineSegments = group.items;
      const objectSuffix = objGroupIdSuffix(group);
      const used = new Set(lineSegments.flatMap((segment) => segment.indices));
      const { vertices, remap } = objectVertices(obj.vertices, used);
      const objectId = uniqueObjectId(objects, `${assetToken}_lines${objectSuffix}`);
      const bounds = boundsFor(vertices);
      objectBounds.push(bounds);
      objects[objectId] = {
        id: objectId,
        kind: "line-set",
        name: `External tessellated edges${objGroupLabel(group)}`,
        layer: layerId,
        bounds,
        vertices,
        lineSegments: lineSegments.map((segment) => segment.indices.map((index) => remap.get(index))),
        metadata: objMetadata(group, materialInfo, objPath)
      };
      const display = materialDisplay(materialInfo, group.vertexColor);
      if (display) objects[objectId].display = display;
    }
  }
  if (obj.points.length) {
    for (const group of groupedObjItems(obj.points, { materials: obj.materials, vertexColors: obj.vertexColors })) {
      const materialInfo = obj.materials.get(group.materialName);
      const { points, pointAttributes } = objectPointPayload(obj.vertices, obj.vertexColors, group.items);
      const objectSuffix = objGroupIdSuffix(group);
      const objectId = uniqueObjectId(objects, `${assetToken}_points${objectSuffix}`);
      const bounds = boundsFor(points);
      objectBounds.push(bounds);
      objects[objectId] = {
        id: objectId,
        kind: "point-cloud",
        name: `External tessellated points${objGroupLabel(group)}`,
        layer: layerId,
        bounds,
        points,
        metadata: objMetadata(group, materialInfo, objPath)
      };
      if (pointAttributes) objects[objectId].pointAttributes = pointAttributes;
      const display = materialDisplay(materialInfo, group.vertexColor);
      if (display) objects[objectId].display = display;
    }
  }
  const bounds = unionBounds(objectBounds);
  const manifest = {
    $schema: schemaRef(output, REFERENCE_GEOMETRY_SCHEMA),
    schema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    schemaVersion: referenceGeometrySchemaVersion,
    asset: {
      id: assetToken,
      name: request.name || path.basename(input),
      source: {
        format: request.format,
        requestedFormat: request.requestedFormat,
        fileName: request.sourceFileName,
        fileExtension: request.sourceFileExtension,
        fileSizeBytes: request.sourceFileSizeBytes,
        modifiedTime: request.sourceFileModifiedTime,
        statFingerprint: request.sourceStatFingerprint,
        ...(request.adapterKey ? { adapterKey: request.adapterKey } : {}),
        translator: ADAPTER_TRANSLATOR,
        translatorVersion: ADAPTER_VERSION
      },
      units: request.units || "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds
    },
    layers: {
      [layerId]: {
        id: layerId,
        name: "External Tessellated Geometry",
        display: {
          color: request.format === "ifc" ? "#22c55e" : "#f97316",
          opacity: 0.55,
          edgeColor: "#1f2937"
        }
      }
    },
    objects,
    chunks: [],
    diagnostics: [
      {
        severity: "info",
        code: "cad-obj-bridge-converted",
        message: `Converted ${request.format.toUpperCase()} source to staged OBJ with ${obj.vertices.length} vertex record(s), ${obj.faces.length} face record(s), ${obj.lineSegments.length} line segment(s), ${obj.points.length} point element record(s), and ${obj.materials.size} material definition(s).`
      }
    ]
  };
  writeJson(output, manifest);
  assertAdapterOutputContract(output, request, requestPath);
  console.log(`CAD OBJ adapter converted ${path.basename(input)} into ${Object.keys(objects).length} canonical object(s)`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
