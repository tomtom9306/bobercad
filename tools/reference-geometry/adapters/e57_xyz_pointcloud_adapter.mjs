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
const POINT_CLOUD_CHUNK_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-point-cloud-chunk.schema.json");
const REFERENCE_GEOMETRY_SCHEMA_NAME = schemaNameFromSchemaFile(REFERENCE_GEOMETRY_SCHEMA, "reference geometry");
const POINT_CLOUD_CHUNK_SCHEMA_NAME = schemaNameFromSchemaFile(POINT_CLOUD_CHUNK_SCHEMA, "point-cloud chunk");
const ADAPTER_TRANSLATOR = "bobercad-e57-xyz-pointcloud-adapter";
const ADAPTER_VERSION = "0.1.0";
const LOG_STREAM_TEXT_LIMIT_BYTES = 4096;
const DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const E57_REQUEST_FORMAT_ALIASES = {
  e57: new Set(["e57", "e57pointcloud", "e57pc"])
};
const DEFAULT_COLUMNS = ["x", "y", "z", "intensity", "r", "g", "b", "classification", "nx", "ny", "nz"];
const PTX_SCANNER_HEADER_LINE_COUNT = 8;
const HEADERLESS_COLUMN_LAYOUTS = new Map([
  [3, ["x", "y", "z"]],
  [4, ["x", "y", "z", "intensity"]],
  [6, ["x", "y", "z", "r", "g", "b"]],
  [7, ["x", "y", "z", "intensity", "r", "g", "b"]],
  [8, ["x", "y", "z", "intensity", "r", "g", "b", "classification"]],
  [9, ["x", "y", "z", "r", "g", "b", "nx", "ny", "nz"]],
  [10, ["x", "y", "z", "intensity", "r", "g", "b", "nx", "ny", "nz"]],
  [11, DEFAULT_COLUMNS]
]);
const COLUMN_ALIASES = new Map([
  ["id", "pointindex"],
  ["index", "pointindex"],
  ["pointid", "pointindex"],
  ["pointindex", "pointindex"],
  ["pointnumber", "pointindex"],
  ["row", "rowindex"],
  ["rowid", "rowindex"],
  ["rowindex", "rowindex"],
  ["rownumber", "rowindex"],
  ["scanid", "scanindex"],
  ["scanindex", "scanindex"],
  ["scanidentifier", "scanindex"],
  ["scannumber", "scanindex"],
  ["scannerindex", "scanindex"],
  ["column", "columnindex"],
  ["columnid", "columnindex"],
  ["columnindex", "columnindex"],
  ["columnnumber", "columnindex"],
  ["col", "columnindex"],
  ["pointsourceid", "pointsourceid"],
  ["pointsource", "pointsourceid"],
  ["sourceid", "pointsourceid"],
  ["userdata", "userdata"],
  ["uservalue", "userdata"],
  ["userdatavalue", "userdata"],
  ["scandirection", "scandirectionflag"],
  ["scandirectionflag", "scandirectionflag"],
  ["edgeofflightline", "edgeofflightline"],
  ["flightlineedge", "edgeofflightline"],
  ["timestamp", "timestamp"],
  ["time", "timestamp"],
  ["gpstime", "timestamp"],
  ["gpsseconds", "timestamp"],
  ["timeoffset", "timestamp"],
  ["returnid", "returnnumber"],
  ["returnindex", "returnnumber"],
  ["returnno", "returnnumber"],
  ["returnnumber", "returnnumber"],
  ["lasreturnnumber", "returnnumber"],
  ["numberofreturns", "returncount"],
  ["returncount", "returncount"],
  ["returntotal", "returncount"],
  ["returns", "returncount"],
  ["lasnumberofreturns", "returncount"],
  ["scanangle", "scanangle"],
  ["scanangledeg", "scanangle"],
  ["scanangledegree", "scanangle"],
  ["scanangledegrees", "scanangle"],
  ["scananglerank", "scanangle"],
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
  ["cartesianxcoord", "x"],
  ["cartesianxcoordinate", "x"],
  ["cartesiancoordx", "x"],
  ["cartesiancoordinatex", "x"],
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
  ["cartesianycoord", "y"],
  ["cartesianycoordinate", "y"],
  ["cartesiancoordy", "y"],
  ["cartesiancoordinatey", "y"],
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
  ["cartesianzcoord", "z"],
  ["cartesianzcoordinate", "z"],
  ["cartesiancoordz", "z"],
  ["cartesiancoordinatez", "z"],
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
  ["scalarintensity", "intensity"],
  ["scalarintensities", "intensity"],
  ["cartesianintensity", "intensity"],
  ["i", "intensity"],
  ["intensityraw", "intensity"],
  ["intensityvalue", "intensity"],
  ["reflectance", "intensity"],
  ["reflectancevalue", "intensity"],
  ["reflectivity", "intensity"],
  ["amplitude", "intensity"],
  ["amplitudevalue", "intensity"],
  ["r", "r"],
  ["red", "r"],
  ["diffusered", "r"],
  ["colorr", "r"],
  ["colourr", "r"],
  ["colorred", "r"],
  ["colourred", "r"],
  ["cartesianred", "r"],
  ["cartesiancolorr", "r"],
  ["cartesiancolorred", "r"],
  ["g", "g"],
  ["green", "g"],
  ["diffusegreen", "g"],
  ["colorg", "g"],
  ["colourg", "g"],
  ["colorgreen", "g"],
  ["colourgreen", "g"],
  ["cartesiangreen", "g"],
  ["cartesiancolorg", "g"],
  ["cartesiancolorgreen", "g"],
  ["b", "b"],
  ["blue", "b"],
  ["diffuseblue", "b"],
  ["colorb", "b"],
  ["colourb", "b"],
  ["colorblue", "b"],
  ["colourblue", "b"],
  ["cartesianblue", "b"],
  ["cartesiancolorb", "b"],
  ["cartesiancolorblue", "b"],
  ["rgb", "packedrgb"],
  ["rgbhex", "packedrgbhex"],
  ["packedrgb", "packedrgb"],
  ["packedrgbhex", "packedrgbhex"],
  ["color", "packedrgb"],
  ["colour", "packedrgb"],
  ["colorhex", "packedrgbhex"],
  ["colourhex", "packedrgbhex"],
  ["rgba", "packedrgba"],
  ["rgbahex", "packedrgbahex"],
  ["packedrgba", "packedrgba"],
  ["packedrgbahex", "packedrgbahex"],
  ["colorrgba", "packedrgba"],
  ["colourrgba", "packedrgba"],
  ["colorrgbahex", "packedrgbahex"],
  ["colourrgbahex", "packedrgbahex"],
  ["classification", "classification"],
  ["scalarclassification", "classification"],
  ["scalarclass", "classification"],
  ["classcode", "classification"],
  ["classid", "classification"],
  ["classvalue", "classification"],
  ["classificationcode", "classification"],
  ["classificationid", "classification"],
  ["classificationvalue", "classification"],
  ["class", "classification"],
  ["cls", "classification"],
  ["cartesianinvalid", "cartesianinvalid"],
  ["cartesianinvalidstate", "cartesianinvalid"],
  ["iscartesianinvalid", "cartesianinvalid"],
  ["invalidcartesian", "cartesianinvalid"],
  ["cartesianvalid", "cartesianvalid"],
  ["cartesianvalidstate", "cartesianvalid"],
  ["iscartesianvalid", "cartesianvalid"],
  ["validcartesian", "cartesianvalid"],
  ["sphericalinvalid", "sphericalinvalid"],
  ["sphericalinvalidstate", "sphericalinvalid"],
  ["issphericalinvalid", "sphericalinvalid"],
  ["invalidspherical", "sphericalinvalid"],
  ["sphericalvalid", "sphericalvalid"],
  ["sphericalvalidstate", "sphericalvalid"],
  ["issphericalvalid", "sphericalvalid"],
  ["validspherical", "sphericalvalid"],
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
const POINT_TEXT_HEADER_PREFIX_COLUMNS = new Set([
  "pointindex",
  "scanindex",
  "rowindex",
  "columnindex",
  "pointsourceid",
  "userdata",
  "scandirectionflag",
  "edgeofflightline",
  "timestamp",
  "returnnumber",
  "returncount",
  "scanangle"
]);
const POINT_TEXT_COMMENT_HEADER_LABELS = new Set(["column", "columns", "field", "fields", "property", "properties"]);
const PCD_HEADER_KEYS = new Set(["version", "fields", "size", "type", "count", "width", "height", "viewpoint", "points", "data"]);
const PLY_SCALAR_TYPES = new Set([
  "char",
  "uchar",
  "short",
  "ushort",
  "int",
  "uint",
  "float",
  "double",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "float32",
  "float64"
]);
const PLY_INTEGER_TYPES = new Set([
  "char",
  "uchar",
  "short",
  "ushort",
  "int",
  "uint",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32"
]);

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

function safeToken(value, fallback = "scan") {
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

function scalarReplacements(request, requestPath, xyzPath) {
  const replacements = {
    request: requestPath,
    xyz: xyzPath,
    pointText: xyzPath
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
    if (!Object.hasOwn(replacements, key)) throw new Error(`Unsupported E57 XYZ bridge placeholder ${match}`);
    return replacements[key];
  });
}

function resolvePointTextOutput(rawOutput, defaultPointTextPath, replacements) {
  if (/^(-|stdout)$/i.test(String(rawOutput || "").trim())) {
    return {
      pointTextPath: defaultPointTextPath,
      useStdout: true
    };
  }
  return {
    pointTextPath: path.resolve(expandTemplate(rawOutput || defaultPointTextPath, replacements)),
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
      const match = /^BOBERCAD_E57_TO_XYZ_ARG_(\d+)$/.exec(key);
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
      throw new Error(`BOBERCAD_E57_TO_XYZ_ARGS_JSON must be a JSON string array: ${error.message}`);
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("BOBERCAD_E57_TO_XYZ_ARGS_JSON must be a JSON string array");
    }
    return parsed.map((value) => expandTemplate(value, replacements));
  }
  if (rawArgs) return parseArgsString(rawArgs, "BOBERCAD_E57_TO_XYZ_ARGS").map((value) => expandTemplate(value, replacements));
  return ["--input", "{input}", "--output", "{xyz}"].map((value) => expandTemplate(value, replacements));
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

function parseColumns(raw) {
  const columns = raw ? splitLine(String(raw).trim(), "auto", "BOBERCAD_E57_XYZ_COLUMNS") : DEFAULT_COLUMNS;
  return normalizeColumnNames(columns, { label: "BOBERCAD_E57_XYZ_COLUMNS" });
}

function configuredColumns(raw) {
  if (raw !== undefined && /\{[A-Za-z0-9_]+\}/.test(String(raw))) {
    throw new Error("BOBERCAD_E57_XYZ_COLUMNS must not contain placeholders");
  }
  const columns = parseColumns(raw);
  if (raw !== undefined && !hasCartesianColumns(columns) && !hasSphericalColumns(columns)) {
    throw new Error("BOBERCAD_E57_XYZ_COLUMNS must include x,y,z or sphericalRange,sphericalAzimuth,sphericalElevation");
  }
  const duplicateColumn = raw !== undefined ? firstDuplicateColumnName(columns) : null;
  if (duplicateColumn) {
    throw new Error(`BOBERCAD_E57_XYZ_COLUMNS maps ${duplicateColumn} more than once`);
  }
  assertPointAttributeColumnCompleteness(columns, "BOBERCAD_E57_XYZ_COLUMNS");
  return columns;
}

function pointTextDelimiter(raw) {
  const delimiter = String(raw || "auto").trim().toLowerCase();
  if (!delimiter) return "auto";
  if (/\{[A-Za-z0-9_]+\}/.test(delimiter)) {
    throw new Error("BOBERCAD_E57_XYZ_DELIMITER must not contain placeholders");
  }
  if (delimiter === ";" || delimiter === "semi") return "semicolon";
  if (delimiter === "|" || delimiter === "bar") return "pipe";
  if (delimiter === "," || delimiter === "csv") return "comma";
  if (delimiter === "\\t" || delimiter === "tsv") return "tab";
  if (delimiter === "whitespace") return "space";
  if (!["auto", "space", "tab", "comma", "semicolon", "pipe"].includes(delimiter)) {
    throw new Error("BOBERCAD_E57_XYZ_DELIMITER must be one of auto, space, whitespace, tab, tsv, '\\t', comma, csv, ',', semicolon, or pipe");
  }
  return delimiter;
}

function delimiterCountOutsideQuotes(line, delimiterChar) {
  let count = 0;
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quote) {
      if (char === quote) {
        if (quote === "\"" && next === "\"") index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === delimiterChar) count += 1;
  }
  return count;
}

function lineLooksSemicolonDelimited(line, delimiter) {
  if (delimiter === "semicolon") return true;
  return delimiter === "auto" && delimiterCountOutsideQuotes(line, ";") >= 2;
}

function lineLooksPipeDelimited(line, delimiter) {
  if (delimiter === "pipe") return true;
  return delimiter === "auto" && delimiterCountOutsideQuotes(line, "|") >= 2;
}

function unquotePointTextToken(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    const inner = trimmed.slice(1, -1);
    return first === "\"" ? inner.replaceAll("\"\"", "\"") : inner;
  }
  return trimmed;
}

function splitDelimitedLine(line, delimiterChar, lineNumber) {
  const tokens = [];
  let current = "";
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
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
    } else if ((char === "\"" || char === "'") && current.trim() === "") {
      current = "";
      quote = char;
    } else if (char === delimiterChar) {
      tokens.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (quote) throw new Error(`Unterminated quoted point text field at line ${lineNumber}`);
  tokens.push(current.trim());
  return tokens.map(unquotePointTextToken);
}

function splitWhitespaceLine(line, lineNumber) {
  const tokens = [];
  let current = "";
  let quote = null;
  let tokenStarted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
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
    } else if (/\s/.test(char)) {
      if (tokenStarted || current) {
        tokens.push(current.trim());
        current = "";
        tokenStarted = false;
      }
    } else {
      current += char;
      tokenStarted = true;
    }
  }
  if (quote) throw new Error(`Unterminated quoted point text field at line ${lineNumber}`);
  if (tokenStarted || current) tokens.push(current.trim());
  return tokens.map(unquotePointTextToken);
}

function lineLooksWhitespaceDelimitedNumberRow(line) {
  const tokens = splitWhitespaceLine(line, 0);
  return tokens.length >= 3 && tokens.every((token) => Number.isFinite(pointTextNumber(token)));
}

function splitLine(line, delimiter, lineNumber) {
  if (delimiter === "comma") return splitDelimitedLine(line, ",", lineNumber);
  if (delimiter === "tab") return splitDelimitedLine(line, "\t", lineNumber);
  if (delimiter === "semicolon") return splitDelimitedLine(line, ";", lineNumber);
  if (delimiter === "pipe") return splitDelimitedLine(line, "|", lineNumber);
  if (delimiter === "space") return splitWhitespaceLine(line, lineNumber);
  if (lineLooksSemicolonDelimited(line, delimiter)) return splitDelimitedLine(line, ";", lineNumber);
  if (lineLooksPipeDelimited(line, delimiter)) return splitDelimitedLine(line, "|", lineNumber);
  if (delimiter === "auto" && line.includes(",")) {
    return lineLooksWhitespaceDelimitedNumberRow(line) ? splitWhitespaceLine(line, lineNumber) : splitDelimitedLine(line, ",", lineNumber);
  }
  return splitWhitespaceLine(line, lineNumber);
}

function pointTextCommentMarkerAt(line, index, marker) {
  if (!line.startsWith(marker, index)) return false;
  if (index === 0) return true;
  if (line.slice(0, index).trim() === "") return true;
  const previous = line[index - 1];
  if (!/\s/.test(previous)) return false;
  if (marker !== "#") return true;
  const next = line[index + marker.length];
  return next === undefined || /\s/.test(next);
}

function stripPointTextComment(line, delimiter) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith(";")) return "";
  const markers = ["#", "//"];
  if (!lineLooksSemicolonDelimited(line, delimiter)) markers.push(";");
  let quote = null;
  let commentIndex = -1;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quote) {
      if (char === quote) {
        if (quote === "\"" && next === "\"") index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    const marker = markers.find((candidate) => pointTextCommentMarkerAt(line, index, candidate));
    if (marker) {
      commentIndex = index;
      break;
    }
  }
  return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
}

function commentedHeaderColumns(line, delimiter, lineNumber) {
  const trimmed = String(line || "").trimStart();
  let content = null;
  if (trimmed.startsWith("//")) content = trimmed.slice(2).trim();
  else if (trimmed.startsWith("#")) content = trimmed.slice(1).trim();
  else if (trimmed.startsWith(";")) content = trimmed.slice(1).trim();
  if (!content) return null;
  content = stripCommentHeaderLabel(content);
  const columns = normalizeColumnNames(splitLine(content, delimiter, lineNumber), {
    label: "Point text comment header",
    lineNumber
  });
  const firstCoordinateIndex = columns.findIndex((column) => column === "x" || column === "sphericalrange");
  const hasAllowedPrefix = firstCoordinateIndex >= 0
    && columns.slice(0, firstCoordinateIndex).every((column) => POINT_TEXT_HEADER_PREFIX_COLUMNS.has(column));
  const isAcceptedHeader = hasAllowedPrefix && (hasCartesianColumns(columns) || hasSphericalColumns(columns));
  if (!isAcceptedHeader) return null;
  const duplicateColumn = firstDuplicateColumnName(columns);
  if (duplicateColumn) {
    throw new Error(`Point text comment header maps ${duplicateColumn} more than once at point text line ${lineNumber}`);
  }
  assertPointAttributeColumnCompleteness(columns, "Point text comment header", lineNumber);
  return columns;
}

function stripCommentHeaderLabel(content) {
  let value = String(content || "").trim();
  for (let index = 0; index < 2; index += 1) {
    const colonMatch = value.match(/^((?:point\s*)?[A-Za-z]+)\s*[:=]\s*(.*)$/);
    if (colonMatch && isCommentHeaderLabel(colonMatch[1])) {
      value = colonMatch[2].trim();
      continue;
    }
    const wordMatch = value.match(/^((?:point\s*)?[A-Za-z]+)\s+(.+)$/);
    if (wordMatch && isCommentHeaderLabel(wordMatch[1])) {
      value = wordMatch[2].trim();
      continue;
    }
    break;
  }
  return value;
}

function isCommentHeaderLabel(value) {
  const compact = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compact.startsWith("point") && compact.length > "point".length) {
    return POINT_TEXT_COMMENT_HEADER_LABELS.has(compact.slice("point".length));
  }
  return POINT_TEXT_COMMENT_HEADER_LABELS.has(compact);
}

function maybeHeaderColumns(tokens, lineNumber) {
  const columns = normalizeColumnNames(tokens, { label: "Point text header", lineNumber });
  const isHeader = tokens.some((token) => Number.isNaN(Number(token))) && (hasCartesianColumns(columns) || hasSphericalColumns(columns));
  if (!isHeader) return null;
  const duplicateColumn = firstDuplicateColumnName(columns);
  if (duplicateColumn) {
    throw new Error(`Point text header maps ${duplicateColumn} more than once at point text line ${lineNumber}`);
  }
  assertPointAttributeColumnCompleteness(columns, "Point text header", lineNumber);
  return columns;
}

function pcdHeaderKey(token) {
  return String(token || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pcdFieldCompactName(value) {
  return stripColumnSuffixes(String(value || "").trim().toLowerCase()).replace(/[^a-z0-9]+/g, "");
}

function pcdIgnoredColumnName(field, index) {
  const compact = pcdFieldCompactName(field) || "field";
  return `pcdignored${compact}${index + 1}`;
}

function pcdAggregateColumns(field, count) {
  const compact = pcdFieldCompactName(field);
  if (count === 3 && (compact === "normal" || compact === "normals" || compact === "cartesiannormal" || compact === "cartesiannormals")) {
    return ["nx", "ny", "nz"];
  }
  if (count === 3 && (compact === "rgb" || compact === "color" || compact === "colour")) {
    return ["r", "g", "b"];
  }
  if (count === 4 && (compact === "rgba" || compact === "colorrgba" || compact === "colourrgba")) {
    return ["r", "g", "b", pcdIgnoredColumnName(field, 3)];
  }
  return null;
}

function pcdExpandedColumns(fields, counts = [], lineNumber = 0) {
  if (counts.length && counts.length !== fields.length) {
    throw new Error(`PCD COUNT header has ${counts.length} entrie(s), expected ${fields.length} for FIELDS header at point text line ${lineNumber}`);
  }
  const columns = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const count = counts.length ? counts[index] : 1;
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`Invalid PCD COUNT value at point text line ${lineNumber}: ${count}`);
    }
    const aggregateColumns = pcdAggregateColumns(field, count);
    if (aggregateColumns) {
      columns.push(...aggregateColumns);
      continue;
    }
    if (count === 1) {
      columns.push(normalizeColumnName(field));
      continue;
    }
    for (let offset = 0; offset < count; offset += 1) {
      columns.push(pcdIgnoredColumnName(field, offset));
    }
  }
  const normalizedColumns = normalizeColumnNames(columns, { label: "PCD FIELDS header", lineNumber });
  const duplicateColumn = firstDuplicateColumnName(normalizedColumns);
  if (duplicateColumn) {
    throw new Error(`PCD FIELDS header maps ${duplicateColumn} more than once at point text line ${lineNumber}`);
  }
  assertPointAttributeColumnCompleteness(normalizedColumns, "PCD FIELDS header", lineNumber);
  return normalizedColumns;
}

function pcdCountValues(tokens, lineNumber) {
  if (!tokens.length) throw new Error(`PCD COUNT header must include at least one count at point text line ${lineNumber}`);
  return tokens.map((token) => {
    const normalizedToken = String(token || "").trim();
    const count = Number(normalizedToken);
    if (!/^\d+$/.test(normalizedToken) || !Number.isInteger(count) || count < 1) {
      throw new Error(`Invalid PCD COUNT value at point text line ${lineNumber}: ${token || ""}`);
    }
    return count;
  });
}

function pcdHeaderValues(tokens, key, lineNumber) {
  const values = tokens.slice(1);
  if (!values.length) throw new Error(`PCD ${key.toUpperCase()} header must include at least one value at point text line ${lineNumber}`);
  return values;
}

function pcdHeaderPositiveIntegerValues(tokens, key, lineNumber) {
  return pcdHeaderValues(tokens, key, lineNumber).map((token) => pcdPositiveIntegerValue(token, key, lineNumber));
}

function pcdTypeValues(tokens, lineNumber) {
  return pcdHeaderValues(tokens, "type", lineNumber).map((token) => {
    const normalizedToken = String(token || "").trim().toUpperCase();
    if (!["F", "I", "U"].includes(normalizedToken)) {
      throw new Error(`Invalid PCD TYPE value at point text line ${lineNumber}: ${token || ""}`);
    }
    return normalizedToken;
  });
}

function pcdFiniteNumberValues(tokens, key, lineNumber) {
  return pcdHeaderValues(tokens, key, lineNumber).map((token) => {
    const value = Number(String(token || "").trim());
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid PCD ${key.toUpperCase()} value at point text line ${lineNumber}: ${token || ""}`);
    }
    return value;
  });
}

function pcdViewpointValues(tokens, lineNumber) {
  const values = pcdFiniteNumberValues(tokens, "viewpoint", lineNumber);
  const quaternion = values.slice(3, 7);
  if (quaternion.every((value) => Math.abs(value) < 1e-12)) {
    throw new Error(`Invalid PCD VIEWPOINT quaternion at point text line ${lineNumber}: zero vector`);
  }
  return values;
}

function assertPcdHeaderEntryCount(values, key, fields, lineNumber) {
  if (fields && values.length !== fields.length) {
    throw new Error(`PCD ${key.toUpperCase()} header has ${values.length} entrie(s), expected ${fields.length} for FIELDS header at point text line ${lineNumber}`);
  }
}

function assertPcdFieldsHeaderPrecedesDependentHeader(fields, key, lineNumber) {
  if (!fields) {
    throw new Error(`PCD ${key.toUpperCase()} header requires a preceding FIELDS header at point text line ${lineNumber}`);
  }
}

function pcdPositiveIntegerValue(token, key, lineNumber) {
  const normalizedToken = String(token || "").trim();
  const value = Number(normalizedToken);
  if (!/^\d+$/.test(normalizedToken) || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid PCD ${key.toUpperCase()} value at point text line ${lineNumber}: ${token || ""}`);
  }
  return value;
}

function assertPcdHeaderValueCount(tokens, key, expectedValueCount, lineNumber) {
  const actualValueCount = Math.max(0, tokens.length - 1);
  if (actualValueCount !== expectedValueCount) {
    throw new Error(`PCD ${key.toUpperCase()} header must contain exactly ${expectedValueCount} value(s) at point text line ${lineNumber}`);
  }
}

function pcdVersionValue(token, lineNumber) {
  const version = String(token || "").trim();
  if (version !== "0.7" && version !== ".7") {
    throw new Error(`Only PCD VERSION 0.7 point text is supported at point text line ${lineNumber}; got ${token || "<missing>"}`);
  }
  return "0.7";
}

function pcdHeaderLine(tokens, lineNumber) {
  if (!tokens.length) return null;
  const key = pcdHeaderKey(tokens[0]);
  if (!PCD_HEADER_KEYS.has(key)) return null;
  if (key === "version") {
    assertPcdHeaderValueCount(tokens, key, 1, lineNumber);
    return { key, version: pcdVersionValue(tokens[1], lineNumber) };
  }
  if (key === "fields") {
    const fields = tokens.slice(1);
    if (!fields.length) {
      throw new Error(`PCD FIELDS header must include at least one field at point text line ${lineNumber}`);
    }
    const columns = pcdExpandedColumns(fields, [], lineNumber);
    if (!hasCartesianColumns(columns) && !hasSphericalColumns(columns)) {
      throw new Error(`PCD FIELDS header must include x,y,z or sphericalRange,sphericalAzimuth,sphericalElevation at point text line ${lineNumber}`);
    }
    return { key, fields, columns };
  }
  if (key === "count") {
    return { key, counts: pcdCountValues(tokens.slice(1), lineNumber) };
  }
  if (key === "size") {
    return { key, sizeValues: pcdHeaderPositiveIntegerValues(tokens, key, lineNumber) };
  }
  if (key === "type") {
    return { key, typeValues: pcdTypeValues(tokens, lineNumber) };
  }
  if (key === "points") {
    assertPcdHeaderValueCount(tokens, key, 1, lineNumber);
    return { key, pointCount: pcdPositiveIntegerValue(tokens[1], key, lineNumber) };
  }
  if (key === "width") {
    assertPcdHeaderValueCount(tokens, key, 1, lineNumber);
    return { key, width: pcdPositiveIntegerValue(tokens[1], key, lineNumber) };
  }
  if (key === "height") {
    assertPcdHeaderValueCount(tokens, key, 1, lineNumber);
    return { key, height: pcdPositiveIntegerValue(tokens[1], key, lineNumber) };
  }
  if (key === "viewpoint") {
    assertPcdHeaderValueCount(tokens, key, 7, lineNumber);
    return { key, viewpointValues: pcdViewpointValues(tokens, lineNumber) };
  }
  if (key === "data") {
    assertPcdHeaderValueCount(tokens, key, 1, lineNumber);
    const mode = String(tokens[1] || "").trim().toLowerCase();
    if (mode !== "ascii") {
      throw new Error(`Only ASCII PCD point text is supported at line ${lineNumber}; got DATA ${tokens[1] || "<missing>"}`);
    }
  }
  return { key };
}

function isPlyHeaderStart(tokens) {
  return tokens.length === 1 && String(tokens[0] || "").trim().toLowerCase() === "ply";
}

function plyHeaderKey(tokens) {
  return String(tokens[0] || "").trim().toLowerCase();
}

function assertPlyScalarType(token, lineNumber, label = "property type") {
  const type = String(token || "").trim().toLowerCase();
  if (!PLY_SCALAR_TYPES.has(type)) {
    throw new Error(`Unsupported PLY ${label} at point text line ${lineNumber}: ${token || ""}`);
  }
  return type;
}

function assertPlyIntegerType(token, lineNumber, label = "property list count type") {
  const type = String(token || "").trim().toLowerCase();
  if (!PLY_INTEGER_TYPES.has(type)) {
    throw new Error(`Unsupported PLY ${label} at point text line ${lineNumber}: ${token || ""}`);
  }
  return type;
}

function isPlyIgnoredMetadataHeader(key) {
  return key === "comment" || key === "obj_info";
}

function assertPlyHeaderValueCount(tokens, key, expectedValueCount, lineNumber) {
  const actualValueCount = Math.max(0, tokens.length - 1);
  if (actualValueCount !== expectedValueCount) {
    throw new Error(`PLY ${key} header must contain exactly ${expectedValueCount} value(s) at point text line ${lineNumber}`);
  }
}

function plyPropertyName(tokens, lineNumber) {
  if (plyHeaderKey(tokens) !== "property") return null;
  if (String(tokens[1] || "").trim().toLowerCase() === "list") {
    throw new Error(`PLY vertex list properties are not supported at point text line ${lineNumber}`);
  }
  assertPlyHeaderValueCount(tokens, "property", 2, lineNumber);
  assertPlyScalarType(tokens[1], lineNumber);
  return tokens[2];
}

function validatePlyNonVertexProperty(tokens, lineNumber) {
  if (plyHeaderKey(tokens) !== "property") return;
  if (String(tokens[1] || "").trim().toLowerCase() === "list") {
    assertPlyHeaderValueCount(tokens, "property list", 4, lineNumber);
    assertPlyIntegerType(tokens[2], lineNumber);
    assertPlyScalarType(tokens[3], lineNumber, "property list item type");
    return;
  }
  assertPlyHeaderValueCount(tokens, "property", 2, lineNumber);
  assertPlyScalarType(tokens[1], lineNumber);
}

function plyElementRowCount(tokens, lineNumber) {
  if (tokens.length < 3 || plyHeaderKey(tokens) !== "element") return null;
  assertPlyHeaderValueCount(tokens, "element", 2, lineNumber);
  const token = String(tokens[2] || "").trim();
  const count = Number(token);
  if (!/^\d+$/.test(token) || !Number.isInteger(count)) {
    throw new Error(`Invalid PLY element row count at line ${lineNumber}: ${tokens[2] || ""}`);
  }
  if (String(tokens[1] || "").trim().toLowerCase() === "vertex" && count < 1) {
    throw new Error(`Invalid PLY vertex element row count at line ${lineNumber}: ${tokens[2] || ""}`);
  }
  return count;
}

function stripColumnSuffixes(value) {
  let base = String(value || "").trim();
  let previous = null;
  while (base && previous !== base) {
    previous = base;
    base = base.replace(/\s*(?:\[[^\]]*\]|\([^)]*\))\s*$/, "").trim();
  }
  return base;
}

function normalizeColumnName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const base = stripColumnSuffixes(raw);
  const compact = base.replace(/[^a-z0-9]+/g, "");
  return COLUMN_ALIASES.get(compact) || raw;
}

function normalizeColumnNames(values, options = {}) {
  const columns = values.map(normalizeColumnName);
  const emptyColumnIndex = columns.findIndex((column) => !column);
  if (emptyColumnIndex >= 0) {
    const label = options.label || "Point text columns";
    const location = options.lineNumber ? ` at point text line ${options.lineNumber}` : "";
    throw new Error(`${label} must not include empty column names${location}`);
  }
  const hasSphericalContext = columns.includes("sphericalrange") && columns.includes("sphericalazimuth");
  const hasCartesianContext = columns.includes("x") && columns.includes("y");
  return columns.map((column) => {
    if (column !== "elevation") return column;
    if (hasSphericalContext) return "sphericalelevation";
    if (hasCartesianContext) return "z";
    return column;
  });
}

function firstDuplicateColumnName(columns) {
  const seen = new Set();
  for (const column of columns) {
    if (!column) continue;
    if (seen.has(column)) return column;
    seen.add(column);
  }
  return null;
}

function pointTextNumber(value) {
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

function inferHeaderlessColumns(tokens, fallbackColumns) {
  if (!tokens.length || !tokens.every((token) => token !== "" && Number.isFinite(pointTextNumber(token)))) return fallbackColumns;
  return HEADERLESS_COLUMN_LAYOUTS.get(tokens.length) || fallbackColumns;
}

function finiteNumber(value, label, lineNumber) {
  const number = pointTextNumber(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${label} at point text line ${lineNumber}: ${value}`);
  return number;
}

function colorChannelNumber(channel, label, lineNumber, rawValue) {
  if (channel < 0) throw new Error(`Invalid ${label} at point text line ${lineNumber}: ${rawValue}`);
  if (channel <= 255) return channel;
  if (channel <= 65535) return Math.round(channel / 257);
  throw new Error(`Invalid ${label} at point text line ${lineNumber}: ${rawValue}`);
}

function colorChannel(value, label, lineNumber) {
  return colorChannelNumber(finiteNumber(value, label, lineNumber), label, lineNumber, value);
}

function colorTriplet(values, lineNumber, options = {}) {
  const numbers = values.map((value, index) => finiteNumber(value, ["r", "g", "b"][index], lineNumber));
  const canNormalize = numbers.every((channel) => channel >= 0 && channel <= 1);
  const looksNormalized = values.some((value) => /[.,eE]/.test(String(value))) && canNormalize;
  if ((options.normalized || looksNormalized) && canNormalize) {
    return numbers.map((channel) => Math.round(channel * 255));
  }
  return numbers.map((channel, index) => colorChannelNumber(channel, ["r", "g", "b"][index], lineNumber, values[index]));
}

function packedColorInteger(value, label, lineNumber) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`Missing ${label} at point text line ${lineNumber}`);
  let parsed = null;
  let hexDigitCount = 0;
  const forceHex = label === "packedrgbhex" || label === "packedrgbahex";
  const hashHex = raw.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  const prefixedHex = raw.match(/^0x([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i);
  const bareHex = raw.match(/^([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hashHex) {
    parsed = Number.parseInt(hashHex[1], 16);
    hexDigitCount = hashHex[1].length;
  } else if (prefixedHex) {
    parsed = Number.parseInt(prefixedHex[1], 16);
    hexDigitCount = prefixedHex[1].length;
  } else if (bareHex && (forceHex || /[a-fA-F]/.test(raw))) {
    parsed = Number.parseInt(bareHex[1], 16);
    hexDigitCount = bareHex[1].length;
  } else if (/^\d+$/.test(raw)) {
    parsed = Number(raw);
  } else if (!forceHex) {
    const numeric = Number(raw.replace(/[dD]/, "e"));
    if (Number.isFinite(numeric)) {
      if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 0xffffffff) {
        parsed = numeric;
      } else {
        const bytes = new ArrayBuffer(4);
        const view = new DataView(bytes);
        view.setFloat32(0, numeric, false);
        parsed = view.getUint32(0, false);
      }
    }
  }
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
    throw new Error(`Invalid ${label} at point text line ${lineNumber}: ${value}`);
  }
  return { parsed, hexDigitCount };
}

function packedColorTriplet(value, label, lineNumber) {
  const { parsed: packed, hexDigitCount } = packedColorInteger(value, label, lineNumber);
  const isPackedRgba = label === "packedrgba" || label === "packedrgbahex";
  if (packed <= 0xffffff && !(isPackedRgba && hexDigitCount === 8)) {
    return [
      (packed >> 16) & 255,
      (packed >> 8) & 255,
      packed & 255
    ];
  }
  if (!isPackedRgba) {
    throw new Error(`Invalid ${label} at point text line ${lineNumber}: ${value}`);
  }
  return [
    (packed >>> 24) & 255,
    (packed >>> 16) & 255,
    (packed >>> 8) & 255
  ];
}

function columnIndex(columns, name) {
  return columns.indexOf(name);
}

function hasColumns(columns, names) {
  return names.every((name) => columnIndex(columns, name) >= 0);
}

function assertCompleteColumnGroup(columns, group, label, lineNumber = 0) {
  const present = group.filter((name) => columns.includes(name));
  if (!present.length || present.length === group.length) return;
  const location = lineNumber ? ` at point text line ${lineNumber}` : "";
  throw new Error(`${label} must include ${group.join(",")} together${location}; got ${present.join(",")}`);
}

function assertPointAttributeColumnCompleteness(columns, label, lineNumber = 0) {
  assertCompleteColumnGroup(columns, ["r", "g", "b"], `${label} color columns`, lineNumber);
  assertCompleteColumnGroup(columns, ["nx", "ny", "nz"], `${label} normal columns`, lineNumber);
}

function hasCartesianColumns(columns) {
  return hasColumns(columns, ["x", "y", "z"]);
}

function hasSphericalColumns(columns) {
  return hasColumns(columns, ["sphericalrange", "sphericalazimuth", "sphericalelevation"]);
}

function assertPointTextRowFieldCount(tokens, columns, lineNumber) {
  if (tokens.length !== columns.length) {
    throw new Error(`Point text row at line ${lineNumber} has ${tokens.length} field(s), expected ${columns.length} for active point columns`);
  }
}

function packedColorColumn(columns) {
  if (columnIndex(columns, "packedrgb") >= 0) return "packedrgb";
  if (columnIndex(columns, "packedrgbhex") >= 0) return "packedrgbhex";
  if (columnIndex(columns, "packedrgba") >= 0) return "packedrgba";
  if (columnIndex(columns, "packedrgbahex") >= 0) return "packedrgbahex";
  return null;
}

function valueAt(tokens, columns, name, lineNumber) {
  const index = columnIndex(columns, name);
  if (index < 0) return null;
  if (index >= tokens.length || tokens[index] === "") {
    throw new Error(`Missing ${name} at point text line ${lineNumber}`);
  }
  return tokens[index];
}

function optionalValueAt(tokens, columns, name) {
  const index = columnIndex(columns, name);
  return index >= 0 && index < tokens.length ? tokens[index] : null;
}

function pointTextFlag(value, label, lineNumber) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return false;
  const number = pointTextNumber(raw);
  if (Number.isFinite(number)) return number !== 0;
  if (["true", "t", "yes", "y", "on", "invalid"].includes(raw)) return true;
  if (["false", "f", "no", "n", "off", "valid"].includes(raw)) return false;
  throw new Error(`Invalid ${label} flag at point text line ${lineNumber}: ${value}`);
}

function knownNonFinitePointTextToken(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return /^[-+]?(?:nan|inf|infinity)(?:\([^)]*\))?$/.test(raw)
    || /^[-+]?(?:1\.)?#(?:inf|ind|nan|qnan|snan)(?:0+)?$/.test(raw);
}

function hasKnownNonFinitePointTextValues(tokens, columns, names, lineNumber) {
  return names.some((name) => knownNonFinitePointTextToken(valueAt(tokens, columns, name, lineNumber)));
}

function cartesianInvalidFromTokens(tokens, columns, lineNumber) {
  if (pointTextFlag(optionalValueAt(tokens, columns, "cartesianinvalid"), "cartesianinvalid", lineNumber)) return true;
  const validValue = optionalValueAt(tokens, columns, "cartesianvalid");
  if (validValue === null || String(validValue).trim() === "") return false;
  return !pointTextFlag(validValue, "cartesianvalid", lineNumber);
}

function sphericalInvalidFromTokens(tokens, columns, lineNumber) {
  if (pointTextFlag(optionalValueAt(tokens, columns, "sphericalinvalid"), "sphericalinvalid", lineNumber)) return true;
  const validValue = optionalValueAt(tokens, columns, "sphericalvalid");
  if (validValue === null || String(validValue).trim() === "") return false;
  return !pointTextFlag(validValue, "sphericalvalid", lineNumber);
}

function cartesianNonFiniteFromTokens(tokens, columns, lineNumber) {
  return hasCartesianColumns(columns) && hasKnownNonFinitePointTextValues(tokens, columns, ["x", "y", "z"], lineNumber);
}

function sphericalNonFiniteFromTokens(tokens, columns, lineNumber) {
  return !hasCartesianColumns(columns)
    && hasSphericalColumns(columns)
    && hasKnownNonFinitePointTextValues(tokens, columns, ["sphericalrange", "sphericalazimuth", "sphericalelevation"], lineNumber);
}

function pointAttributeNonFiniteFromTokens(tokens, columns, lineNumber, attributesEnabled) {
  if (!attributesEnabled) return false;
  if (attributesEnabled.colors) {
    if (attributesEnabled.packedColorColumn) {
      if (knownNonFinitePointTextToken(valueAt(tokens, columns, attributesEnabled.packedColorColumn, lineNumber))) return true;
    } else if (hasKnownNonFinitePointTextValues(tokens, columns, ["r", "g", "b"], lineNumber)) {
      return true;
    }
  }
  if (attributesEnabled.intensities && knownNonFinitePointTextToken(valueAt(tokens, columns, "intensity", lineNumber))) return true;
  if (attributesEnabled.classifications && knownNonFinitePointTextToken(valueAt(tokens, columns, "classification", lineNumber))) return true;
  if (attributesEnabled.normals && hasKnownNonFinitePointTextValues(tokens, columns, ["nx", "ny", "nz"], lineNumber)) return true;
  return false;
}

function pcdRowLooksLikePointPayload(tokens, columns) {
  const coordinateColumns = hasCartesianColumns(columns)
    ? ["x", "y", "z"]
    : hasSphericalColumns(columns)
      ? ["sphericalrange", "sphericalazimuth", "sphericalelevation"]
      : [];
  if (!coordinateColumns.length) return false;
  return coordinateColumns.every((name) => {
    const index = columnIndex(columns, name);
    if (index < 0 || index >= tokens.length) return false;
    const token = tokens[index];
    return Number.isFinite(pointTextNumber(token)) || knownNonFinitePointTextToken(token);
  });
}

function pointTextAngleRadians(value) {
  const angle = Number(value);
  if (!Number.isFinite(angle)) return angle;
  return Math.abs(angle) > Math.PI * 2 + 1e-9 ? angle * Math.PI / 180 : angle;
}

function cartesianPointFromTokens(tokens, columns, lineNumber) {
  if (hasCartesianColumns(columns)) {
    return [
      finiteNumber(valueAt(tokens, columns, "x", lineNumber), "x", lineNumber),
      finiteNumber(valueAt(tokens, columns, "y", lineNumber), "y", lineNumber),
      finiteNumber(valueAt(tokens, columns, "z", lineNumber), "z", lineNumber)
    ];
  }
  const range = finiteNumber(valueAt(tokens, columns, "sphericalrange", lineNumber), "sphericalrange", lineNumber);
  const azimuth = pointTextAngleRadians(finiteNumber(valueAt(tokens, columns, "sphericalazimuth", lineNumber), "sphericalazimuth", lineNumber));
  const elevation = pointTextAngleRadians(finiteNumber(valueAt(tokens, columns, "sphericalelevation", lineNumber), "sphericalelevation", lineNumber));
  const horizontal = range * Math.cos(elevation);
  return [
    horizontal * Math.cos(azimuth),
    horizontal * Math.sin(azimuth),
    range * Math.sin(elevation)
  ].map((coordinate) => Math.abs(coordinate) < 1e-12 ? 0 : coordinate);
}

function pointFromTokens(tokens, columns, lineNumber, attributesEnabled) {
  const point = cartesianPointFromTokens(tokens, columns, lineNumber);
  const attributes = {};
  if (attributesEnabled.colors) {
    if (attributesEnabled.packedColorColumn) {
      attributes.color = packedColorTriplet(
        valueAt(tokens, columns, attributesEnabled.packedColorColumn, lineNumber),
        attributesEnabled.packedColorColumn,
        lineNumber
      );
    } else {
      attributes.color = colorTriplet([
        valueAt(tokens, columns, "r", lineNumber),
        valueAt(tokens, columns, "g", lineNumber),
        valueAt(tokens, columns, "b", lineNumber)
      ], lineNumber, { normalized: attributesEnabled.normalizedColors });
    }
  }
  if (attributesEnabled.intensities) {
    attributes.intensity = finiteNumber(valueAt(tokens, columns, "intensity", lineNumber), "intensity", lineNumber);
  }
  if (attributesEnabled.classifications) {
    const classification = finiteNumber(valueAt(tokens, columns, "classification", lineNumber), "classification", lineNumber);
    if (!Number.isInteger(classification) || classification < 0) {
      throw new Error(`Invalid classification at point text line ${lineNumber}: ${classification}`);
    }
    attributes.classification = classification;
  }
  if (attributesEnabled.normals) {
    const normal = [
      finiteNumber(valueAt(tokens, columns, "nx", lineNumber), "nx", lineNumber),
      finiteNumber(valueAt(tokens, columns, "ny", lineNumber), "ny", lineNumber),
      finiteNumber(valueAt(tokens, columns, "nz", lineNumber), "nz", lineNumber)
    ];
    if (normal.every((value) => Math.abs(value) < 1e-12)) {
      throw new Error(`Invalid point normal at point text line ${lineNumber}: zero vector`);
    }
    attributes.normal = normal;
  }
  return { point, attributes };
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

function chunkAttributes(buffer, attributesEnabled) {
  const pointAttributes = {};
  if (attributesEnabled.colors) pointAttributes.colors = buffer.map((item) => item.attributes.color);
  if (attributesEnabled.intensities) pointAttributes.intensities = buffer.map((item) => item.attributes.intensity);
  if (attributesEnabled.classifications) pointAttributes.classifications = buffer.map((item) => item.attributes.classification);
  if (attributesEnabled.normals) pointAttributes.normals = buffer.map((item) => item.attributes.normal);
  return Object.keys(pointAttributes).length ? pointAttributes : null;
}

function pointAttributeFields(attributesEnabled) {
  return [
    attributesEnabled.colors ? "colors" : null,
    attributesEnabled.intensities ? "intensities" : null,
    attributesEnabled.classifications ? "classifications" : null,
    attributesEnabled.normals ? "normals" : null
  ].filter(Boolean);
}

async function parsePointTextToChunks({ request, pointTextPath, objectId, chunkSize, columns, columnsConfigured = false, delimiter, normalizedColors, pointCloudChunkSchemaVersion }) {
  const stream = fs.createReadStream(pointTextPath, "utf8");
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let activeColumns = [...columns];
  let attributesEnabled = null;
  let lineNumber = 0;
  let sawHeader = false;
  let sawData = false;
  let skippedCartesianInvalidPointCount = 0;
  let skippedSphericalInvalidPointCount = 0;
  let skippedAttributeInvalidPointCount = 0;
  let consecutiveSingleIntegerHeaderRows = 0;
  let pendingPtxScannerHeaderLines = 0;
  let sawPcdHeader = false;
  let pcdFields = null;
  let pcdCounts = null;
  let pcdSizeValues = null;
  let pcdTypeValues = null;
  let pcdDeclaredPointCount = null;
  let pcdWidth = null;
  let pcdHeight = null;
  let sawPcdDataHeader = false;
  const pcdHeaderKeys = new Set();
  let pcdRemainingPointRows = null;
  let inPlyHeader = false;
  let plyVertexElementActive = false;
  let sawPlyFormatHeader = false;
  let sawPlyStructureBeforeFormat = false;
  let sawPlyElementHeader = false;
  let plyColumns = [];
  let plyVertexRowCount = null;
  let plyRemainingVertexRows = null;
  let plyTrailingElementRowCount = 0;
  let plyDeclaredNonVertexRowCount = 0;
  let plyNonVertexElementBeforeVertex = null;
  const chunks = [];
  const chunkBounds = [];
  let buffer = [];
  let chunkIndex = 0;

  const flush = () => {
    if (!buffer.length) return;
    chunkIndex += 1;
    const chunkId = `${objectId}_chunk_${String(chunkIndex).padStart(4, "0")}`;
    const chunkPath = path.join(request.chunkDir, `${chunkId}.json`);
    const points = buffer.map((item) => item.point);
    const bounds = boundsFor(points);
    const chunk = {
      $schema: schemaRef(chunkPath, POINT_CLOUD_CHUNK_SCHEMA),
      schema: POINT_CLOUD_CHUNK_SCHEMA_NAME,
      schemaVersion: pointCloudChunkSchemaVersion,
      id: chunkId,
      kind: "point-cloud",
      objectId,
      pointCount: points.length,
      bounds,
      points,
      metadata: {
        adapter: ADAPTER_TRANSLATOR
      }
    };
    const pointAttributes = chunkAttributes(buffer, attributesEnabled);
    if (pointAttributes) chunk.pointAttributes = pointAttributes;
    writeJson(chunkPath, chunk);
    chunks.push({
      id: chunkId,
      kind: "point-cloud",
      objectId,
      path: `${request.chunkPathPrefix}${path.basename(chunkPath)}`,
      pointCount: points.length,
      bounds
    });
    chunkBounds.push(bounds);
    buffer = [];
  };

  for await (const rawLine of rl) {
    lineNumber += 1;
    if (!sawData && !columnsConfigured) {
      const commentColumns = commentedHeaderColumns(rawLine, delimiter, lineNumber);
      if (commentColumns) {
        activeColumns = commentColumns;
        sawHeader = true;
        consecutiveSingleIntegerHeaderRows = 0;
        continue;
      }
    }
    const line = stripPointTextComment(rawLine, delimiter).trim();
    if (!line) continue;
    const tokens = splitLine(line, delimiter, lineNumber);
    if (pendingPtxScannerHeaderLines > 0) {
      pendingPtxScannerHeaderLines -= 1;
      continue;
    }
    if (!sawData) {
      const pcdHeader = pcdHeaderLine(tokens, lineNumber);
      if (pcdHeader) {
        if (sawPcdDataHeader) {
          throw new Error(`PCD header ${pcdHeader.key.toUpperCase()} is not allowed after DATA ascii at point text line ${lineNumber}`);
        }
        if (pcdHeaderKeys.has(pcdHeader.key)) {
          throw new Error(`PCD header ${pcdHeader.key.toUpperCase()} is declared more than once before DATA ascii at point text line ${lineNumber}`);
        }
        pcdHeaderKeys.add(pcdHeader.key);
        sawPcdHeader = true;
        consecutiveSingleIntegerHeaderRows = 0;
        if (pcdHeader.fields) {
          pcdFields = pcdHeader.fields;
          if (pcdCounts?.length) assertPcdHeaderEntryCount(pcdCounts, "count", pcdFields, lineNumber);
          if (pcdSizeValues?.length) assertPcdHeaderEntryCount(pcdSizeValues, "size", pcdFields, lineNumber);
          if (pcdTypeValues?.length) assertPcdHeaderEntryCount(pcdTypeValues, "type", pcdFields, lineNumber);
          if (!columnsConfigured) {
            activeColumns = pcdExpandedColumns(pcdFields, pcdCounts || [], lineNumber);
            sawHeader = true;
          }
        } else if (pcdHeader.counts) {
          assertPcdFieldsHeaderPrecedesDependentHeader(pcdFields, "count", lineNumber);
          pcdCounts = pcdHeader.counts;
          assertPcdHeaderEntryCount(pcdCounts, "count", pcdFields, lineNumber);
          if (!columnsConfigured) {
            activeColumns = pcdExpandedColumns(pcdFields, pcdCounts, lineNumber);
            sawHeader = true;
          }
        } else if (pcdHeader.sizeValues) {
          assertPcdFieldsHeaderPrecedesDependentHeader(pcdFields, "size", lineNumber);
          pcdSizeValues = pcdHeader.sizeValues;
          assertPcdHeaderEntryCount(pcdSizeValues, "size", pcdFields, lineNumber);
        } else if (pcdHeader.typeValues) {
          assertPcdFieldsHeaderPrecedesDependentHeader(pcdFields, "type", lineNumber);
          pcdTypeValues = pcdHeader.typeValues;
          assertPcdHeaderEntryCount(pcdTypeValues, "type", pcdFields, lineNumber);
        } else if (Number.isInteger(pcdHeader.pointCount)) {
          pcdDeclaredPointCount = pcdHeader.pointCount;
          if (Number.isInteger(pcdWidth) && Number.isInteger(pcdHeight) && pcdWidth * pcdHeight !== pcdDeclaredPointCount) {
            throw new Error(`PCD POINTS header declared ${pcdDeclaredPointCount} point row(s), but WIDTH * HEIGHT is ${pcdWidth * pcdHeight} at point text line ${lineNumber}`);
          }
        } else if (Number.isInteger(pcdHeader.width)) {
          pcdWidth = pcdHeader.width;
          if (Number.isInteger(pcdHeight) && !Number.isInteger(pcdDeclaredPointCount)) {
            pcdDeclaredPointCount = pcdWidth * pcdHeight;
          } else if (Number.isInteger(pcdHeight) && pcdWidth * pcdHeight !== pcdDeclaredPointCount) {
            throw new Error(`PCD WIDTH * HEIGHT is ${pcdWidth * pcdHeight}, but POINTS declares ${pcdDeclaredPointCount} at point text line ${lineNumber}`);
          }
        } else if (Number.isInteger(pcdHeader.height)) {
          pcdHeight = pcdHeader.height;
          if (Number.isInteger(pcdWidth) && !Number.isInteger(pcdDeclaredPointCount)) {
            pcdDeclaredPointCount = pcdWidth * pcdHeight;
          } else if (Number.isInteger(pcdWidth) && pcdWidth * pcdHeight !== pcdDeclaredPointCount) {
            throw new Error(`PCD WIDTH * HEIGHT is ${pcdWidth * pcdHeight}, but POINTS declares ${pcdDeclaredPointCount} at point text line ${lineNumber}`);
          }
        } else if (pcdHeader.columns && !columnsConfigured) {
          activeColumns = pcdHeader.columns;
          sawHeader = true;
        }
        if (pcdHeader.key === "data" && sawPcdHeader && !sawHeader && !columnsConfigured) {
          throw new Error(`PCD DATA header requires a preceding FIELDS header at point text line ${lineNumber}`);
        }
        if (pcdHeader.key === "data" && !Number.isInteger(pcdDeclaredPointCount)) {
          throw new Error(`PCD DATA ascii header requires POINTS or WIDTH and HEIGHT before point text line ${lineNumber}`);
        }
        if (pcdHeader.key === "data") {
          sawPcdDataHeader = true;
        }
        if (pcdHeader.key === "data" && Number.isInteger(pcdDeclaredPointCount)) {
          pcdRemainingPointRows = pcdDeclaredPointCount;
        }
        continue;
      }
    }
    if (!sawData && sawPcdHeader && !sawPcdDataHeader) {
      throw new Error(`PCD point payload requires a DATA ascii header before point text line ${lineNumber}`);
    }
    if (!sawData) {
      if (!inPlyHeader && isPlyHeaderStart(tokens)) {
        inPlyHeader = true;
        plyVertexElementActive = false;
        sawPlyFormatHeader = false;
        sawPlyStructureBeforeFormat = false;
        sawPlyElementHeader = false;
        plyColumns = [];
        plyVertexRowCount = null;
        plyRemainingVertexRows = null;
        plyTrailingElementRowCount = 0;
        plyDeclaredNonVertexRowCount = 0;
        plyNonVertexElementBeforeVertex = null;
        consecutiveSingleIntegerHeaderRows = 0;
        continue;
      }
      if (inPlyHeader) {
        const key = plyHeaderKey(tokens);
        if (key === "format") {
          if (sawPlyFormatHeader) {
            throw new Error(`PLY header declares multiple format rows before point text line ${lineNumber}`);
          }
          if (sawPlyStructureBeforeFormat) {
            throw new Error(`PLY format header must appear before element or property rows at point text line ${lineNumber}`);
          }
          assertPlyHeaderValueCount(tokens, key, 2, lineNumber);
          const mode = String(tokens[1] || "").trim().toLowerCase();
          if (mode !== "ascii") {
            throw new Error(`Only ASCII PLY point text is supported at line ${lineNumber}; got format ${tokens[1] || ""}`);
          }
          const version = String(tokens[2] || "").trim();
          if (version !== "1.0") {
            throw new Error(`Only PLY format ascii 1.0 point text is supported at line ${lineNumber}; got version ${version || "<missing>"}`);
          }
          sawPlyFormatHeader = true;
        } else if (key === "element") {
          if (!sawPlyFormatHeader) sawPlyStructureBeforeFormat = true;
          const elementRowCount = plyElementRowCount(tokens, lineNumber);
          sawPlyElementHeader = true;
          const elementName = String(tokens[1] || "").trim().toLowerCase();
          plyVertexElementActive = elementName === "vertex";
          if (plyVertexElementActive) {
            if (plyNonVertexElementBeforeVertex) {
              throw new Error(`PLY non-vertex element ${plyNonVertexElementBeforeVertex.name} must appear after element vertex at point text line ${plyNonVertexElementBeforeVertex.lineNumber}`);
            }
            if (Number.isInteger(plyVertexRowCount)) {
              throw new Error(`PLY header declares multiple element vertex rows before point text line ${lineNumber}`);
            }
            plyVertexRowCount = elementRowCount;
          } else {
            if (!Number.isInteger(plyVertexRowCount)) {
              plyNonVertexElementBeforeVertex ||= { name: elementName || "<empty>", lineNumber };
            }
            plyTrailingElementRowCount += elementRowCount;
            plyDeclaredNonVertexRowCount += elementRowCount;
          }
        } else if (key === "property" && plyVertexElementActive) {
          if (!sawPlyFormatHeader) sawPlyStructureBeforeFormat = true;
          if (!sawPlyElementHeader) {
            throw new Error(`PLY property header requires a preceding element row at point text line ${lineNumber}`);
          }
          const propertyName = plyPropertyName(tokens, lineNumber);
          if (propertyName) plyColumns.push(propertyName);
        } else if (key === "property") {
          if (!sawPlyFormatHeader) sawPlyStructureBeforeFormat = true;
          if (!sawPlyElementHeader) {
            throw new Error(`PLY property header requires a preceding element row at point text line ${lineNumber}`);
          }
          validatePlyNonVertexProperty(tokens, lineNumber);
        } else if (key === "end_header") {
          assertPlyHeaderValueCount(tokens, key, 0, lineNumber);
          const normalizedPlyColumns = normalizeColumnNames(plyColumns, {
            label: "PLY vertex properties",
            lineNumber
          });
          const duplicatePlyColumn = firstDuplicateColumnName(normalizedPlyColumns);
          if (duplicatePlyColumn) {
            throw new Error(`PLY vertex property ${duplicatePlyColumn} is declared more than once before point text line ${lineNumber}`);
          }
          assertPointAttributeColumnCompleteness(normalizedPlyColumns, "PLY vertex properties", lineNumber);
          if (!sawPlyFormatHeader) {
            throw new Error(`PLY header must declare format ascii before point text line ${lineNumber}`);
          }
          if (!Number.isInteger(plyVertexRowCount)) {
            throw new Error(`PLY header must declare an element vertex row count before point text line ${lineNumber}`);
          }
          if (!columnsConfigured) {
            if (!hasCartesianColumns(normalizedPlyColumns) && !hasSphericalColumns(normalizedPlyColumns)) {
              throw new Error(`PLY vertex properties must include x,y,z or sphericalRange,sphericalAzimuth,sphericalElevation before point text line ${lineNumber}`);
            }
            activeColumns = normalizedPlyColumns;
            sawHeader = true;
          }
          plyRemainingVertexRows = plyVertexRowCount;
          inPlyHeader = false;
        } else if (!isPlyIgnoredMetadataHeader(key)) {
          throw new Error(`Unsupported PLY header ${tokens[0] || ""} at point text line ${lineNumber}`);
        }
        consecutiveSingleIntegerHeaderRows = 0;
        continue;
      }
    }
    if (Number.isInteger(plyRemainingVertexRows)) {
      if (plyRemainingVertexRows <= 0) {
        if (plyTrailingElementRowCount > 0) {
          plyTrailingElementRowCount -= 1;
          continue;
        }
        if (pcdRowLooksLikePointPayload(tokens, activeColumns)) {
          throw new Error(`PLY vertex element declared ${plyVertexRowCount} row(s), but found extra vertex-like row at point text line ${lineNumber}`);
        }
        throw new Error(`PLY payload declared ${plyVertexRowCount} vertex row(s) plus ${plyDeclaredNonVertexRowCount} non-vertex row(s), but found extra row at point text line ${lineNumber}`);
      }
      plyRemainingVertexRows -= 1;
    }
    if (Number.isInteger(pcdRemainingPointRows)) {
      if (pcdRemainingPointRows <= 0) {
        if (pcdRowLooksLikePointPayload(tokens, activeColumns)) {
          throw new Error(`PCD payload declared ${pcdDeclaredPointCount} point row(s), but found extra point row at point text line ${lineNumber}`);
        }
        continue;
      }
      pcdRemainingPointRows -= 1;
    }
    const headerColumns = !sawData ? maybeHeaderColumns(tokens, lineNumber) : null;
    if (headerColumns) {
      if (!columnsConfigured) activeColumns = headerColumns;
      sawHeader = true;
      consecutiveSingleIntegerHeaderRows = 0;
      continue;
    }
    if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
      consecutiveSingleIntegerHeaderRows += 1;
      if (consecutiveSingleIntegerHeaderRows >= 2) {
        pendingPtxScannerHeaderLines = PTX_SCANNER_HEADER_LINE_COUNT;
        consecutiveSingleIntegerHeaderRows = 0;
      }
      continue;
    }
    consecutiveSingleIntegerHeaderRows = 0;
    if (!sawData && !sawHeader && !columnsConfigured) {
      activeColumns = inferHeaderlessColumns(tokens, activeColumns);
    }
    if (!hasCartesianColumns(activeColumns) && !hasSphericalColumns(activeColumns)) {
      throw new Error("Point text columns must include x,y,z or sphericalRange,sphericalAzimuth,sphericalElevation");
    }
    assertPointTextRowFieldCount(tokens, activeColumns, lineNumber);
    if (!attributesEnabled) {
      const activePackedColorColumn = packedColorColumn(activeColumns);
      attributesEnabled = {
        colors: hasColumns(activeColumns, ["r", "g", "b"]) || activePackedColorColumn !== null,
        packedColorColumn: hasColumns(activeColumns, ["r", "g", "b"]) ? null : activePackedColorColumn,
        normalizedColors,
        intensities: hasColumns(activeColumns, ["intensity"]),
        classifications: hasColumns(activeColumns, ["classification"]),
        normals: hasColumns(activeColumns, ["nx", "ny", "nz"])
      };
    }
    if (cartesianInvalidFromTokens(tokens, activeColumns, lineNumber)) {
      sawData = true;
      skippedCartesianInvalidPointCount += 1;
      continue;
    }
    if (sphericalInvalidFromTokens(tokens, activeColumns, lineNumber)) {
      sawData = true;
      skippedSphericalInvalidPointCount += 1;
      continue;
    }
    if (cartesianNonFiniteFromTokens(tokens, activeColumns, lineNumber)) {
      sawData = true;
      skippedCartesianInvalidPointCount += 1;
      continue;
    }
    if (sphericalNonFiniteFromTokens(tokens, activeColumns, lineNumber)) {
      sawData = true;
      skippedSphericalInvalidPointCount += 1;
      continue;
    }
    if (pointAttributeNonFiniteFromTokens(tokens, activeColumns, lineNumber, attributesEnabled)) {
      sawData = true;
      skippedAttributeInvalidPointCount += 1;
      continue;
    }
    sawData = true;
    buffer.push(pointFromTokens(tokens, activeColumns, lineNumber, attributesEnabled));
    if (buffer.length >= chunkSize) flush();
  }
  if (inPlyHeader) throw new Error(`PLY ASCII point text header is missing end_header: ${pointTextPath}`);
  if (Number.isInteger(plyRemainingVertexRows) && plyRemainingVertexRows > 0) {
    throw new Error(`PLY vertex element declared ${plyVertexRowCount} row(s), but ${plyRemainingVertexRows} row(s) were missing before end of point text: ${pointTextPath}`);
  }
  if (Number.isInteger(pcdRemainingPointRows) && pcdRemainingPointRows > 0) {
    throw new Error(`PCD POINTS header declared ${pcdDeclaredPointCount} point row(s), but ${pcdRemainingPointRows} row(s) were missing before end of point text: ${pointTextPath}`);
  }
  if (!attributesEnabled) {
    attributesEnabled = {
      colors: false,
      packedColorColumn: null,
      normalizedColors: false,
      intensities: false,
      classifications: false,
      normals: false
    };
  }
  flush();
  if (!chunks.length) throw new Error(`Converted point text contains no points: ${pointTextPath}`);
  return {
    chunks,
    bounds: unionBounds(chunkBounds),
    pointCount: chunks.reduce((sum, chunk) => sum + chunk.pointCount, 0),
    columns: activeColumns,
    attributesEnabled,
    skippedCartesianInvalidPointCount,
    skippedSphericalInvalidPointCount,
    skippedAttributeInvalidPointCount
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestPath = path.resolve(ensureString(args.request, "path"));
  const request = readJson(requestPath);
  assertAdapterRequestContract(request, requestPath, {
    formatAliases: E57_REQUEST_FORMAT_ALIASES,
    formatErrorMessage: "E57 XYZ adapter expects an E57 request"
  });
  const referenceGeometrySchemaVersion = requestSchemaVersion(request, "referenceGeometry", requestPath);
  const pointCloudChunkSchemaVersion = requestSchemaVersion(request, "pointCloudChunk", requestPath);

  const output = path.resolve(ensureString(request.output, "output"));
  const input = path.resolve(ensureString(request.input, "input"));
  const stageDir = path.resolve(ensureString(request.stageDir, "stageDir"));
  const scratchDir = path.resolve(ensureString(request.scratchDir || request.stageDir, "scratchDir"));
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(path.resolve(ensureString(request.chunkDir, "chunkDir")), { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const defaultPointTextPath = path.join(scratchDir, `${safeToken(request.sourceFileStem)}.points.xyz`);
  const preReplacements = scalarReplacements(request, requestPath, defaultPointTextPath);
  const pointTextOutput = resolvePointTextOutput(process.env.BOBERCAD_E57_TO_XYZ_OUTPUT, defaultPointTextPath, preReplacements);
  const pointTextPath = assertAdapterScratchPath(pointTextOutput.pointTextPath, scratchDir, "pointTextPath", requestPath);
  const replacements = scalarReplacements(request, requestPath, pointTextPath);
  fs.mkdirSync(path.dirname(pointTextPath), { recursive: true });

  const converterCommand = process.env.BOBERCAD_E57_TO_XYZ_COMMAND;
  const pointTextColumnsRaw = process.env.BOBERCAD_E57_XYZ_COLUMNS;
  const pointTextColumns = configuredColumns(pointTextColumnsRaw);
  const delimiter = pointTextDelimiter(process.env.BOBERCAD_E57_XYZ_DELIMITER);
  const normalizedColors = boolEnv("BOBERCAD_E57_XYZ_RGB_NORMALIZED");
  if (!converterCommand) throw new Error("BOBERCAD_E57_TO_XYZ_COMMAND is required for the E57 XYZ adapter");
  const converterArgs = parseArgsTemplate(process.env.BOBERCAD_E57_TO_XYZ_ARGS_JSON, process.env.BOBERCAD_E57_TO_XYZ_ARGS, replacements);
  const converterCwd = assertAdapterStagePath(
    path.resolve(expandTemplate(process.env.BOBERCAD_E57_TO_XYZ_CWD || stageDir, replacements)),
    stageDir,
    "converterCwd",
    requestPath
  );
  const timeoutMs = Number.isInteger(request.timeoutMs) ? request.timeoutMs : 120000;
  const streamMaxBufferBytes = positiveIntegerEnv("BOBERCAD_E57_TO_XYZ_STREAM_MAX_BUFFER_BYTES", DEFAULT_PROCESS_STREAM_MAX_BUFFER_BYTES);
  appendLog(request, `E57 XYZ converter command: ${converterCommand}`);
  appendLog(request, `E57 XYZ converter args: ${JSON.stringify(converterArgs)}`);
  const converter = runProcess("E57 to XYZ converter", converterCommand, converterArgs, {
    cwd: converterCwd,
    shell: boolEnv("BOBERCAD_E57_TO_XYZ_SHELL"),
    timeoutMs,
    streamMaxBufferBytes
  });
  if (pointTextOutput.useStdout) {
    if (!converter.stdout?.trim()) throw new Error("E57 to XYZ converter stdout did not contain point text");
    fs.writeFileSync(pointTextPath, converter.stdout, "utf8");
    appendLog(request, `E57 XYZ converter stdout captured as point text: ${Buffer.byteLength(converter.stdout, "utf8")} byte(s)`);
  } else {
    appendLog(request, logStreamText("E57 XYZ converter stdout", converter.stdout));
  }
  appendLog(request, logStreamText("E57 XYZ converter stderr", converter.stderr));
  if (!fs.existsSync(pointTextPath)) throw new Error(`E57 to XYZ converter did not write expected point text output: ${pointTextPath}`);

  const objectId = `${safeToken(request.assetId, "e57_reference")}_scan`;
  const layerId = `${safeToken(request.assetId, "e57_reference")}_points`;
  const pointCloud = await parsePointTextToChunks({
    request,
    pointTextPath,
    objectId,
    chunkSize: Math.max(1, Number.isInteger(request.pointCloudChunkSize) ? request.pointCloudChunkSize : 50000),
    columns: pointTextColumns,
    columnsConfigured: pointTextColumnsRaw !== undefined,
    delimiter,
    normalizedColors,
    pointCloudChunkSchemaVersion
  });

  const manifest = {
    $schema: schemaRef(output, REFERENCE_GEOMETRY_SCHEMA),
    schema: REFERENCE_GEOMETRY_SCHEMA_NAME,
    schemaVersion: referenceGeometrySchemaVersion,
    asset: {
      id: safeToken(request.assetId, "e57_reference"),
      name: request.name || path.basename(input),
      source: {
        format: "e57",
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
      bounds: pointCloud.bounds
    },
    layers: {
      [layerId]: {
        id: layerId,
        name: "E57 Point Cloud",
        display: {
          color: "#38bdf8",
          pointSize: 12
        }
      }
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        name: "E57 scan",
        layer: layerId,
        bounds: pointCloud.bounds,
        chunkIds: pointCloud.chunks.map((chunk) => chunk.id),
        metadata: {
          pointTextColumns: pointCloud.columns,
          pointAttributeFields: pointAttributeFields(pointCloud.attributesEnabled),
          ...(pointCloud.skippedCartesianInvalidPointCount ? { skippedCartesianInvalidPointCount: pointCloud.skippedCartesianInvalidPointCount } : {}),
          ...(pointCloud.skippedSphericalInvalidPointCount ? { skippedSphericalInvalidPointCount: pointCloud.skippedSphericalInvalidPointCount } : {}),
          ...(pointCloud.skippedAttributeInvalidPointCount ? { skippedAttributeInvalidPointCount: pointCloud.skippedAttributeInvalidPointCount } : {})
        }
      }
    },
    chunks: pointCloud.chunks,
    diagnostics: [
      {
        severity: "info",
        code: "e57-xyz-bridge-converted",
        message: `Converted E57 source to staged point text and emitted ${pointCloud.pointCount} point(s) in ${pointCloud.chunks.length} chunk(s).`
      },
      ...(pointCloud.skippedCartesianInvalidPointCount ? [
        {
          severity: "info",
          code: "e57-xyz-cartesian-invalid-points-skipped",
          message: `Skipped ${pointCloud.skippedCartesianInvalidPointCount} converted E57 point row(s) flagged as cartesian invalid before canonical point-cloud chunking.`
        }
      ] : []),
      ...(pointCloud.skippedSphericalInvalidPointCount ? [
        {
          severity: "info",
          code: "e57-xyz-spherical-invalid-points-skipped",
          message: `Skipped ${pointCloud.skippedSphericalInvalidPointCount} converted E57 point row(s) flagged as spherical invalid before canonical point-cloud chunking.`
        }
      ] : []),
      ...(pointCloud.skippedAttributeInvalidPointCount ? [
        {
          severity: "info",
          code: "e57-xyz-attribute-invalid-points-skipped",
          message: `Skipped ${pointCloud.skippedAttributeInvalidPointCount} converted E57 point row(s) with non-finite point attribute values before canonical point-cloud chunking.`
        }
      ] : [])
    ]
  };
  writeJson(output, manifest);
  assertAdapterOutputContract(output, request, requestPath);
  console.log(`E57 XYZ adapter converted ${path.basename(input)} into ${pointCloud.chunks.length} chunk(s)`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
