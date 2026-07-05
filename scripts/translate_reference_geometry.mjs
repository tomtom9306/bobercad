#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_ABS = path.join(ROOT, "bobercad", "app", "schemas", "reference-geometry.schema.json");
const TRANSLATOR = "bobercad-reference-geometry-translator";
const FORMAT_EXTENSIONS = new Map([
  [".dxf", "dxf"],
  [".dxfgz", "dxf"],
  [".dxfzip", "dxf"],
  [".dxf-zip", "dxf"],
  [".dxf_zip", "dxf"],
  [".dwg", "dwg"],
  [".dwggz", "dwg"],
  [".dwgzip", "dwg"],
  [".dwg-zip", "dwg"],
  [".dwg_zip", "dwg"],
  [".step", "step"],
  [".stp", "step"],
  [".ste", "step"],
  [".p21", "step"],
  [".stpx", "step"],
  [".stpnc", "step"],
  [".stepnc", "step"],
  [".stepz", "step"],
  [".stepzip", "step"],
  [".step-zip", "step"],
  [".step_zip", "step"],
  [".stpz", "step"],
  [".stpzip", "step"],
  [".stp-zip", "step"],
  [".stp_zip", "step"],
  [".stez", "step"],
  [".stezip", "step"],
  [".ste-zip", "step"],
  [".ste_zip", "step"],
  [".p21z", "step"],
  [".p21zip", "step"],
  [".p21-zip", "step"],
  [".p21_zip", "step"],
  [".ifc", "ifc"],
  [".ifcxml", "ifc"],
  [".ifcgz", "ifc"],
  [".ifcxmlgz", "ifc"],
  [".ifczip", "ifc"],
  [".ifc-zip", "ifc"],
  [".ifc_zip", "ifc"],
  [".ifcxmlzip", "ifc"],
  [".ifcxml-zip", "ifc"],
  [".ifcxml_zip", "ifc"],
  [".e57", "e57"],
  [".e57gz", "e57"],
  [".e57zip", "e57"],
  [".e57-zip", "e57"],
  [".e57_zip", "e57"],
  [".e57pointcloud", "e57pointcloud"],
  [".e57pointcloudgz", "e57pointcloud"],
  [".e57-pointcloud", "e57pointcloud"],
  [".e57-pointcloudgz", "e57pointcloud"],
  [".e57_pointcloud", "e57pointcloud"],
  [".e57_pointcloudgz", "e57pointcloud"],
  [".obj", "obj"],
  [".xyz", "xyz"],
  [".pts", "xyz"],
  [".asc", "xyz"],
  [".txt", "xyz"],
  [".csv", "xyz"],
  [".pcd", "xyz"]
]);
const FORMAT_ALIASES = {
  dxf: "dxf",
  dxfgz: "dxf",
  dxfzip: "dxf",
  "dxf.gz": "dxf",
  "dxf.zip": "dxf",
  "dxf-zip": "dxf",
  "dxf_zip": "dxf",
  dwg: "dwg",
  dwggz: "dwg",
  dwgzip: "dwg",
  "dwg.gz": "dwg",
  "dwg.zip": "dwg",
  "dwg-zip": "dwg",
  "dwg_zip": "dwg",
  step: "step",
  stp: "step",
  ste: "step",
  p21: "step",
  stpx: "step",
  stpnc: "step",
  stepnc: "step",
  stepz: "step",
  stpz: "step",
  stez: "step",
  p21z: "step",
  stepzip: "step",
  stpzip: "step",
  stezip: "step",
  p21zip: "step",
  "step.gz": "step",
  "stp.gz": "step",
  "ste.gz": "step",
  "p21.gz": "step",
  "stpx.gz": "step",
  "stpnc.gz": "step",
  "stepnc.gz": "step",
  "step.zip": "step",
  "stp.zip": "step",
  "ste.zip": "step",
  "p21.zip": "step",
  "stpx.zip": "step",
  "stpnc.zip": "step",
  "stepnc.zip": "step",
  "step-zip": "step",
  "step_zip": "step",
  "stp-zip": "step",
  "stp_zip": "step",
  "ste-zip": "step",
  "ste_zip": "step",
  "p21-zip": "step",
  "p21_zip": "step",
  "step.z": "step",
  "stp.z": "step",
  "ste.z": "step",
  "p21.z": "step",
  ifc: "ifc",
  ifcxml: "ifc",
  ifcgz: "ifc",
  ifcxmlgz: "ifc",
  ifczip: "ifc",
  ifcxmlzip: "ifc",
  "ifcxml-zip": "ifc",
  "ifcxml_zip": "ifc",
  "ifc-zip": "ifc",
  "ifc_zip": "ifc",
  "ifc.zip": "ifc",
  "ifcxml.zip": "ifc",
  "ifc.gz": "ifc",
  "ifcxml.gz": "ifc",
  e57: "e57",
  e57gz: "e57",
  e57zip: "e57",
  "e57-zip": "e57",
  "e57_zip": "e57",
  "e57.zip": "e57",
  "e57.gz": "e57",
  e57pointcloud: "e57pointcloud",
  "e57-pointcloud": "e57pointcloud",
  "e57-point-cloud": "e57pointcloud",
  "e57_pointcloud": "e57pointcloud",
  "e57_point_cloud": "e57pointcloud",
  "e57.pointcloud": "e57pointcloud",
  "e57.point.cloud": "e57pointcloud",
  "e57pointcloud.zip": "e57pointcloud",
  "e57.pointcloud.zip": "e57pointcloud",
  "e57.point.cloud.zip": "e57pointcloud",
  "e57pointcloud.gz": "e57pointcloud",
  "e57.pointcloud.gz": "e57pointcloud",
  "e57.point.cloud.gz": "e57pointcloud",
  e57pointcloudgz: "e57pointcloud",
  "e57-pointcloudgz": "e57pointcloud",
  "e57_pointcloudgz": "e57pointcloud",
  obj: "obj",
  xyz: "xyz",
  pts: "xyz",
  asc: "xyz",
  txt: "xyz",
  csv: "xyz",
  pcd: "xyz"
};
const UNIT_TO_MM = {
  mm: 1, millimeter: 1, millimeters: 1, millimetre: 1, millimetres: 1, um: 0.001, micron: 0.001, microns: 0.001, nm: 0.000001, angstrom: 0.0000001,
  m: 1000, meter: 1000, meters: 1000, metre: 1000, metres: 1000, cm: 10, centimeter: 10, centimeters: 10, centimetre: 10, centimetres: 10, dm: 100, dam: 10000, hm: 100000, km: 1000000, kilometer: 1000000, kilometers: 1000000, kilometre: 1000000, kilometres: 1000000, gm: 1000000000000,
  in: 25.4, inch: 25.4, inches: 25.4, microinch: 0.0000254, mil: 0.0254,
  ft: 304.8, foot: 304.8, feet: 304.8, yd: 914.4, yard: 914.4, yards: 914.4, mi: 1609344, mile: 1609344, miles: 1609344,
  usin: 25.4000508001016, usft: 304.8006096012192, usyd: 914.4018288036576, usmi: 1609347.2186944373,
  au: 149597870700000, ly: 9460730472580800000, pc: 30856775814913673000
};
const DXF_INSUNITS = {
  1: "in", 2: "ft", 3: "mi", 4: "mm", 5: "cm", 6: "m", 7: "km", 8: "microinch", 9: "mil", 10: "yd",
  11: "angstrom", 12: "nm", 13: "um", 14: "dm", 15: "dam", 16: "hm", 17: "gm", 18: "au", 19: "ly", 20: "pc",
  21: "usft", 22: "usin", 23: "usyd", 24: "usmi"
};
const DXF_ACI = {
  1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff", 5: "#0000ff", 6: "#ff00ff", 7: "#e5e7eb", 8: "#6b7280", 9: "#9ca3af"
};
const DXF_UNSUPPORTED_DIAGNOSTIC_ENTITIES = new Set(["3DSOLID", "BODY", "REGION", "SURFACE", "PLANESURFACE", "EXTRUDEDSURFACE", "LOFTEDSURFACE", "REVOLVEDSURFACE", "SWEPTSURFACE", "HELIX", "XLINE", "RAY", "TEXT", "MTEXT", "ATTDEF", "ATTRIB", "MLEADER", "MULTILEADER", "TABLE", "ACAD_TABLE", "TOLERANCE", "SHAPE", "VIEWPORT", "IMAGE", "WIPEOUT", "OLEFRAME", "OLE2FRAME", "PDFUNDERLAY", "DGNUNDERLAY", "DWFUNDERLAY", "PDFDEFINITION", "DGNDEFINITION", "DWFDEFINITION", "POINTCLOUD", "POINTCLOUD2", "POINTCLOUDEX", "ACAD_PROXY_ENTITY"]);
const POINT_TEXT_ROW_PREFIXES = new Set(["p", "pt", "pnt", "point", "station", "sta", "stn", "cp", "control", "controlpoint", "bm", "benchmark", "tbm", "target", "tgt", "node", "vertex", "v", "xyz"]);

function usage() {
  return [
    "Usage:",
    "  node ./scripts/translate_reference_geometry.mjs <input> [output.reference.json]",
    "  node ./scripts/translate_reference_geometry.mjs <input> [input ...] --output-dir dir",
    "",
    "Supported source formats: DXF, DWG, STEP/STP/P21/STPZ, IFC/IFCZIP, E57/E57POINTCLOUD, OBJ, XYZ/PTS/ASC/TXT/CSV/PCD.",
    "Runtime contract: the app loads only bobercad-reference-geometry JSON sidecars.",
    "",
    "Options:",
    "  --format fmt              Override source format",
    "  --output file             Single output file",
    "  --output-dir dir          Batch output directory",
    "  --units unit              Source units (default: DXF/DWG/STEP mm, IFC/E57 m)",
    "  --to-units unit           Sidecar units (default: mm)",
    "  --scale n                 Extra coordinate scale after unit conversion",
    "  --max-points n            Point-cloud point budget",
    "  --point-stride n          Keep every nth point",
    "  --point-size n            Viewer point size",
    "  --mesh-deflection n       STEP FreeCAD mesh linear deflection (default: 1)",
    "  --mesh-angle n            STEP FreeCAD mesh angular deflection (default: 0.5)",
    "  --layer name              Default layer id",
    "  --color #rrggbb           Default overlay color",
    "  --opacity n               Default opacity for generated items",
    "  --hash-source             Include source SHA-256",
    "  --compact                 Write compact JSON",
    "  --converter-timeout-ms n  External converter timeout",
    "  --check-converters        Report local converter availability"
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    inputs: [],
    output: "",
    outputDir: "",
    format: "",
    units: "",
    toUnits: "mm",
    scale: 1,
    maxPoints: 200000,
    pointStride: 1,
    pointSize: 2,
    meshDeflection: 1,
    meshAngle: 0.5,
    layer: "reference",
    color: "#94a3b8",
    colorExplicit: false,
    opacity: undefined,
    hashSource: false,
    compact: false,
    converterTimeoutMs: 120000,
    checkConverters: false,
    help: false
  };
  const positional = [];
  const readValue = (index, name) => {
    if (index + 1 >= argv.length) throw new Error(`${name} needs a value`);
    return argv[index + 1];
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check-converters") args.checkConverters = true;
    else if (arg === "--hash-source") args.hashSource = true;
    else if (arg === "--compact") args.compact = true;
    else if (arg === "--format") args.format = readValue(index++, arg);
    else if (arg.startsWith("--format=")) args.format = arg.slice(9);
    else if (arg === "--output" || arg === "--out") args.output = readValue(index++, arg);
    else if (arg.startsWith("--output=")) args.output = arg.slice(9);
    else if (arg === "--output-dir" || arg === "--out-dir") args.outputDir = readValue(index++, arg);
    else if (arg.startsWith("--output-dir=")) args.outputDir = arg.slice(13);
    else if (arg === "--units") args.units = readValue(index++, arg);
    else if (arg.startsWith("--units=")) args.units = arg.slice(8);
    else if (arg === "--to-units") args.toUnits = readValue(index++, arg);
    else if (arg.startsWith("--to-units=")) args.toUnits = arg.slice(11);
    else if (arg === "--scale") args.scale = Number(readValue(index++, arg));
    else if (arg.startsWith("--scale=")) args.scale = Number(arg.slice(8));
    else if (arg === "--max-points") args.maxPoints = Number(readValue(index++, arg));
    else if (arg.startsWith("--max-points=")) args.maxPoints = Number(arg.slice(13));
    else if (arg === "--point-stride") args.pointStride = Number(readValue(index++, arg));
    else if (arg.startsWith("--point-stride=")) args.pointStride = Number(arg.slice(15));
    else if (arg === "--point-size") args.pointSize = Number(readValue(index++, arg));
    else if (arg.startsWith("--point-size=")) args.pointSize = Number(arg.slice(13));
    else if (arg === "--mesh-deflection") args.meshDeflection = Number(readValue(index++, arg));
    else if (arg.startsWith("--mesh-deflection=")) args.meshDeflection = Number(arg.slice(18));
    else if (arg === "--mesh-angle") args.meshAngle = Number(readValue(index++, arg));
    else if (arg.startsWith("--mesh-angle=")) args.meshAngle = Number(arg.slice(13));
    else if (arg === "--layer") args.layer = readValue(index++, arg);
    else if (arg.startsWith("--layer=")) args.layer = arg.slice(8);
    else if (arg === "--color") {
      args.color = readValue(index++, arg);
      args.colorExplicit = true;
    } else if (arg.startsWith("--color=")) {
      args.color = arg.slice(8);
      args.colorExplicit = true;
    }
    else if (arg === "--opacity") args.opacity = Number(readValue(index++, arg));
    else if (arg.startsWith("--opacity=")) args.opacity = Number(arg.slice(10));
    else if (arg === "--converter-timeout-ms") args.converterTimeoutMs = Number(readValue(index++, arg));
    else if (arg.startsWith("--converter-timeout-ms=")) args.converterTimeoutMs = Number(arg.slice(23));
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  if (args.output && args.outputDir) throw new Error("Use either --output or --output-dir, not both");
  if (!args.output && !args.outputDir && positional.length === 2 && /\.json$/i.test(positional[1])) {
    args.inputs = [positional[0]];
    args.output = positional[1];
  } else {
    args.inputs = positional;
  }
  if (!Number.isFinite(args.scale) || args.scale <= 0) throw new Error("--scale must be a positive number");
  if (!Number.isFinite(args.maxPoints) || args.maxPoints < 1) throw new Error("--max-points must be a positive number");
  if (!Number.isFinite(args.pointStride) || args.pointStride < 1) throw new Error("--point-stride must be a positive number");
  if (!Number.isFinite(args.pointSize) || args.pointSize < 1) throw new Error("--point-size must be a positive number");
  if (!Number.isFinite(args.meshDeflection) || args.meshDeflection <= 0) throw new Error("--mesh-deflection must be a positive number");
  if (!Number.isFinite(args.meshAngle) || args.meshAngle <= 0) throw new Error("--mesh-angle must be a positive number");
  if (args.opacity !== undefined && (!Number.isFinite(args.opacity) || args.opacity < 0 || args.opacity > 1)) throw new Error("--opacity must be between 0 and 1");
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(args.color)) throw new Error("--color must be #rgb or #rrggbb");
  if (!String(args.layer || "").trim()) throw new Error("--layer must be a non-empty name");
  if (args.units && !unitFactor(args.units)) throw new Error("--units must be a supported length unit, for example mm, cm, m, km, in, ft, yd, mi, usft");
  if (!unitFactor(args.toUnits)) throw new Error("--to-units must be a supported length unit, for example mm, cm, m, km, in, ft, yd, mi, usft");
  if (!Number.isFinite(args.converterTimeoutMs) || args.converterTimeoutMs < 1) throw new Error("--converter-timeout-ms must be a positive number");
  return args;
}

function slashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function schemaRefFor(outputPath) {
  if (!outputPath) return "bobercad/app/schemas/reference-geometry.schema.json";
  return slashes(path.relative(path.dirname(path.resolve(outputPath)), SCHEMA_ABS));
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function colorHex(value) {
  const text = String(value || "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text.toLowerCase() : "";
}

function averageRgbColor(colorSum, colorCount, colorMax) {
  if (!colorCount) return "";
  const channel = (total) => {
    let value = total / colorCount;
    if (colorMax <= 1) value *= 255;
    else if (colorMax > 255) value /= 257;
    return Math.max(0, Math.min(255, Math.round(value)));
  };
  return `#${colorSum.map(channel).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function averageScalarColor(sum, count, max) {
  if (!count) return "";
  const value = max > 0 ? sum / count / max * 255 : 0;
  const channel = Math.max(0, Math.min(255, Math.round(value)));
  return `#${[channel, channel, channel].map((item) => item.toString(16).padStart(2, "0")).join("")}`;
}

function number(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(text)) return Number.parseInt(text.slice(1), 16);
  let decimal = text;
  if (/^[+-]?(?:\d{1,3}(?:[. ]\d{3})+|\d+),\d+(?:[ed][+-]?\d+)?$/i.test(text)) decimal = text.replace(/[. ](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  else if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:[ed][+-]?\d+)?$/i.test(text)) decimal = text.replace(/,(?=\d{3}(?:\D|$))/g, "");
  const parsed = Number(decimal.replace(/([0-9.])d([+-]?\d+)$/i, "$1e$2"));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value) {
  return Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6));
}

function textFromBuffer(data) {
  if (data[0] === 0xff && data[1] === 0xfe) return data.subarray(2).toString("utf16le");
  if (data[0] === 0xfe && data[1] === 0xff) {
    const swapped = Buffer.from(data.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const next = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = next;
    }
    return swapped.toString("utf16le");
  }
  const sample = data.subarray(0, Math.min(data.length, 512));
  let evenNulls = 0;
  let oddNulls = 0;
  let pairs = 0;
  for (let index = 0; index + 1 < sample.length; index += 2) {
    pairs += 1;
    if (sample[index] === 0) evenNulls += 1;
    if (sample[index + 1] === 0) oddNulls += 1;
  }
  if (pairs && oddNulls / pairs > 0.35 && evenNulls / pairs < 0.05) return data.toString("utf16le").replace(/^\uFEFF/, "");
  if (pairs && evenNulls / pairs > 0.35 && oddNulls / pairs < 0.05) {
    const swapped = Buffer.from(data);
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const next = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = next;
    }
    return swapped.toString("utf16le").replace(/^\uFEFF/, "");
  }
  return data.toString("utf8").replace(/^\uFEFF/, "");
}

function readTextFile(filePath) {
  return textFromBuffer(fs.readFileSync(filePath));
}

function fileHead(filePath, maxBytes = 65536) {
  const handle = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(maxBytes);
    const read = fs.readSync(handle, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, read);
  } finally {
    fs.closeSync(handle);
  }
}

function textLines(text) {
  return String(text || "").replace(/^\uFEFF/, "").replace(/\u001a+\s*$/, "").split(/\r\n|\n|\r/);
}

function continuedLines(text) {
  const out = [];
  let current = "";
  for (const raw of textLines(text)) {
    const line = raw.replace(/\s+$/, "");
    if (line.endsWith("\\")) {
      current += `${line.slice(0, -1)} `;
    } else {
      out.push(current + raw);
      current = "";
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function findNumericMeta(value, names) {
  if (!value || typeof value !== "object") return null;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (names.has(normalized)) {
      const parsed = typeof item === "string" && /^\s*#/.test(item) ? null : number(item);
      if (parsed !== null) return parsed;
      const compact = String(item).trim().replace(/[ \u00a0](?=\d{3}(?:\D|$))/g, "");
      if (/^[+-]?\d+$/.test(compact)) return Number(compact);
    }
  }
  for (const item of Object.values(value)) {
    const found = findNumericMeta(item, names);
    if (found !== null) return found;
  }
  return null;
}

function pdalSummaryStats(stdout) {
  try {
    const info = JSON.parse(stdout || "{}");
    const sourcePointCount = findNumericMeta(info, new Set(["numpoints", "numpts", "pointcount", "points"]))
      ?? findNumericMeta(info, new Set(["count"]));
    return Number.isFinite(sourcePointCount) ? { e57SourcePointCount: Math.trunc(sourcePointCount) } : {};
  } catch {
    return {};
  }
}

function cleanId(value, fallback = "reference") {
  const id = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "");
  return id || fallback;
}

function unitFactor(unit) {
  const key = String(unit || "").trim().toLowerCase();
  return UNIT_TO_MM[key] || null;
}

function defaultSourceUnit(format) {
  return format === "ifc" || format === "e57" || format === "e57pointcloud" ? "m" : "mm";
}

function transformPoint(point, options, format) {
  const sourceUnit = options.units || defaultSourceUnit(format);
  const sourceFactor = unitFactor(sourceUnit);
  const targetFactor = unitFactor(options.toUnits || "mm");
  const unitScale = sourceFactor && targetFactor ? sourceFactor / targetFactor : 1;
  const scale = unitScale * options.scale;
  return point.map((value) => round(value * scale));
}

function diagnostic(severity, code, message) {
  return { severity, code, message };
}

function stats(filePath, options) {
  const out = {};
  try {
    const item = fs.statSync(filePath);
    const absolute = path.resolve(filePath);
    const relative = path.relative(ROOT, absolute);
    out.path = slashes(!relative || relative.startsWith("..") || path.isAbsolute(relative) ? absolute : relative);
    out.fileSize = item.size;
    out.modifiedAt = item.mtime.toISOString();
    if (options.hashSource) out.sha256 = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  } catch {
    out.path = filePath;
  }
  return out;
}

function allPoints(doc) {
  const points = [];
  for (const line of doc.lines) points.push(...line.points);
  for (const polyline of doc.polylines) points.push(...polyline.points);
  for (const mesh of doc.meshes) points.push(...mesh.vertices);
  for (const cloud of doc.pointClouds) points.push(...cloud.points);
  return points;
}

function counts(doc) {
  const storedPoints = doc.pointClouds.reduce((sum, cloud) => sum + cloud.points.length, 0);
  const sourcePoints = doc.pointClouds.reduce((sum, cloud) => sum + (Number.isInteger(cloud.sourcePointCount) ? cloud.sourcePointCount : cloud.points.length), 0);
  const sampledPoints = doc.pointClouds.reduce((sum, cloud) => sum + (Number.isInteger(cloud.storedPointCount) ? cloud.storedPointCount : cloud.points.length), 0);
  return {
    lines: doc.lines.length,
    polylines: doc.polylines.length,
    meshes: doc.meshes.length,
    pointClouds: doc.pointClouds.length,
    points: storedPoints,
    ...(sourcePoints !== storedPoints || sampledPoints !== storedPoints ? { sourcePoints, storedPoints: sampledPoints } : {})
  };
}

function bounds(doc) {
  const points = allPoints(doc).filter((point) => point.length === 3 && point.every(finite));
  if (!points.length) return undefined;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min: min.map(round), max: max.map(round) };
}

function layers(doc, options) {
  const ids = new Set([options.layer]);
  const itemStyles = {};
  for (const collection of [doc.lines, doc.polylines, doc.meshes, doc.pointClouds]) {
    for (const item of collection) {
      const id = item.layer || options.layer;
      ids.add(id);
      if (!itemStyles[id]?.color && item.color) itemStyles[id] = { ...(itemStyles[id] || {}), color: item.color };
      if (!finite(itemStyles[id]?.opacity) && finite(item.opacity)) itemStyles[id] = { ...(itemStyles[id] || {}), opacity: item.opacity };
    }
  }
  const layerStyles = doc.layerStyles || {};
  return Object.fromEntries([...ids].filter(Boolean).map((id) => [id, {
    name: id,
    color: layerStyles[id]?.color || itemStyles[id]?.color || options.color,
    ...(finite(options.opacity) ? { opacity: options.opacity } : finite(layerStyles[id]?.opacity) ? { opacity: layerStyles[id].opacity } : finite(itemStyles[id]?.opacity) ? { opacity: itemStyles[id].opacity } : {})
  }]));
}

function sourceOptions(options, doc, source = {}) {
  const out = {};
  if (options.units) out.units = options.units;
  if ((options.toUnits || "mm") !== "mm") out.toUnits = options.toUnits;
  if (options.scale !== 1) out.scale = options.scale;
  if (doc.pointClouds.length) {
    if (options.maxPoints !== 200000) out.maxPoints = options.maxPoints;
    if (options.pointStride !== 1) out.pointStride = options.pointStride;
  }
  if (source.converter === "FreeCADCmd" && doc.meshes.length) {
    if (options.meshDeflection !== 1) out.meshDeflection = options.meshDeflection;
    if (options.meshAngle !== 0.5) out.meshAngle = options.meshAngle;
  }
  return Object.keys(out).length ? out : null;
}

function finalize(doc, sourcePath, format, options, outputPath, extraSource = {}) {
  const optionMetadata = sourceOptions(options, doc, extraSource);
  const source = {
    ...stats(sourcePath, options),
    format,
    translatedAt: new Date().toISOString(),
    translator: TRANSLATOR,
    ...(optionMetadata ? { options: optionMetadata } : {}),
    ...extraSource
  };
  const sourceCounts = counts(doc);
  const sourceBounds = bounds(doc);
  source.counts = sourceCounts;
  if (sourceBounds) source.bounds = sourceBounds;
  return {
    $schema: schemaRefFor(outputPath),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1",
    units: { length: options.toUnits || "mm" },
    source,
    layers: layers(doc, options),
    lines: doc.lines,
    polylines: doc.polylines,
    meshes: doc.meshes,
    pointClouds: doc.pointClouds,
    diagnostics: doc.diagnostics
  };
}

function emptyDoc(message, code = "no-geometry") {
  return {
    lines: [],
    polylines: [],
    meshes: [],
    pointClouds: [],
    diagnostics: [diagnostic("warning", code, message)]
  };
}

function zipPayloadFormat(inputPath) {
  let entries = [];
  let data = null;
  try {
    const head = fileHead(inputPath, 2);
    if (head[0] !== 0x50 || head[1] !== 0x4b) return "";
    data = fs.readFileSync(inputPath);
    entries = zipEntries(data).entries || [];
  } catch {
    return "";
  }
  const formatForName = (name) => /\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)$/i.test(name) ? "step"
    : /\.(?:ifc|ifcxml)$/i.test(name) ? "ifc"
      : /\.e57[._-]?point[._-]?cloud$/i.test(name) ? "e57pointcloud"
        : /\.e57$/i.test(name) ? "e57"
          : /\.(?:xyz|pts|asc|csv|pcd)$/i.test(name) ? "xyz"
            : /\.dwg$/i.test(name) ? "dwg"
              : /\.dxf$/i.test(name) ? "dxf"
                : "";
  const namedFormat = entries
    .map((entry) => ({ format: formatForName(entry.name), size: entry.uncompressedSize || entry.compressedSize }))
    .filter((entry) => entry.format)
    .sort((a, b) => b.size - a.size)[0]?.format || "";
  if (namedFormat) return namedFormat;
  for (const entry of entries.slice().sort((a, b) => (b.uncompressedSize || b.compressedSize) - (a.uncompressedSize || a.compressedSize))) {
    const payload = zipEntryPayload(data, entry, "source").buffer;
    const format = payload ? payloadFormatFromBuffer(payload) : "";
    if (format) return format;
  }
  return "";
}

function payloadFormatFromBuffer(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 65536));
  if (head.length >= 6 && head.subarray(0, 4).toString("ascii") === "AC10" && head.includes(0)) return "dwg";
  if (head.subarray(0, 8).toString("ascii") === "ASTM-E57") return "e57";
  const text = textFromBuffer(head);
  if (/<(?:[a-z_][\w.-]*:)?ifcxml\b/i.test(text)) return "ifc";
  if (/<(?:[a-z_][\w.-]*:)?iso_10303_28\b/i.test(text)) return "step";
  if (/ISO-10303-21/i.test(text)) return /FILE_SCHEMA\s*\(\s*\(\s*['"]IFC/i.test(text) ? "ifc" : "step";
  try {
    if (dxfPairScore(dxfPairs(text)) >= 3) return "dxf";
  } catch {
    return "";
  }
  if (pointTextPayloadLooksLike(text)) return "xyz";
  return "";
}

function pcdPayloadLooksLike(text) {
  if (/^\s*#?\s*\.?PCD\b/im.test(text)) return true;
  let fields = false;
  let data = false;
  for (const raw of textLines(text)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const tokens = pointTextTokens(trimmed);
    const keyword = String(tokens[0] || "").toLowerCase();
    if (keyword === "fields" && pointTextHeaderIndexes(tokens)) fields = true;
    if (keyword === "data" && tokens[1]) data = true;
    if (fields && data) return true;
  }
  return false;
}

function pointTextPayloadLooksLike(text) {
  if (pcdPayloadLooksLike(text)) return true;
  let headerIndexes = null;
  let declaredPointCount = null;
  let sawHeader = false;
  let valid = 0;
  let seen = 0;
  for (const raw of textLines(text)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const commentHeader = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed.startsWith("//") ? trimmed.slice(2).trim() : "";
    if (commentHeader && !headerIndexes && valid === 0) {
      headerIndexes = pointTextHeaderIndexes(pointTextTokens(commentHeader));
      sawHeader = Boolean(headerIndexes);
    }
    if (commentHeader) continue;
    const tokens = pointTextTokens(trimmed);
    if (!tokens.length) continue;
    if (!headerIndexes && valid === 0 && tokens.length === 1) {
      const value = Math.trunc(number(tokens[0]));
      if (value > 0) {
        declaredPointCount = value;
        continue;
      }
    }
    if (!headerIndexes && valid === 0) {
      headerIndexes = pointTextHeaderIndexes(tokens);
      sawHeader = Boolean(headerIndexes);
      if (headerIndexes) continue;
    }
    const data = pointTextData(tokens, headerIndexes, valid, declaredPointCount);
    const xyz = headerIndexes ? headerIndexes.xyz.map((index) => data.values[index]) : data.values.slice(0, 3);
    if (xyz.length >= 3 && xyz.every(finite)) valid += 1;
    seen += 1;
    if (valid >= (sawHeader || declaredPointCount === 1 ? 1 : 2)) return true;
    if (seen >= 64) break;
  }
  return false;
}

function gzipPayloadFormat(inputPath) {
  try {
    const head = fileHead(inputPath, 2);
    if (head[0] !== 0x1f || head[1] !== 0x8b) return "";
    const data = fs.readFileSync(inputPath);
    return payloadFormatFromBuffer(zlib.gunzipSync(data));
  } catch {
    return "";
  }
}

function filePayloadFormat(inputPath) {
  try {
    const head = fileHead(inputPath);
    if ((head[0] === 0x50 && head[1] === 0x4b) || (head[0] === 0x1f && head[1] === 0x8b)) return "";
    return payloadFormatFromBuffer(head);
  } catch {
    return "";
  }
}

function normalizeFormat(inputPath, override = "") {
  if (override) {
    const key = override.trim().toLowerCase().replace(/^\./, "");
    if (FORMAT_ALIASES[key]) return FORMAT_ALIASES[key];
    if (/^(?:step|stp|ste|p21|stpx|stpnc|stepnc)(?:z|zip|[-_]zip|\.z|\.gz|\.zip)?$/.test(key)) return "step";
    if (/^dxf(?:gz|zip|[-_]zip|\.gz|\.zip)?$/.test(key)) return "dxf";
    if (/^dwg(?:gz|zip|[-_]zip|\.gz|\.zip)?$/.test(key)) return "dwg";
    if (/^(?:xyz|pts|asc|txt|csv|pcd)(?:gz|zip|[-_]zip|\.gz|\.zip)?$/.test(key)) return "xyz";
    if (/^e57[._-]?point[._-]?cloud(?:zip|[-_]zip|\.zip)?$/.test(key)) return "e57pointcloud";
    if (/^e57[._-]?point[._-]?cloud(?:\.gz|gz)$/.test(key)) return "e57pointcloud";
    if (/^e57(?:zip|[-_]zip|\.zip|\.gz|gz)$/.test(key)) return "e57";
    if (/^(?:ifc|ifcxml)(?:\.gz|gz)$/.test(key)) return "ifc";
    return key;
  }
  const lower = inputPath.toLowerCase();
  if (/\.dxf(?:gz|zip|[-_]zip|\.gz|\.zip)$/.test(lower)) return "dxf";
  if (/\.dwg(?:gz|zip|[-_]zip|\.gz|\.zip)$/.test(lower)) return "dwg";
  if (/\.(?:xyz|pts|asc|txt|csv|pcd)(?:gz|zip|[-_]zip|\.gz|\.zip)$/.test(lower)) return "xyz";
  if (/\.(step|stp|ste|p21|stpx|stpnc|stepnc)\.(z|gz|zip)$/.test(lower)) return "step";
  if (/\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)(?:z|zip|[-_]zip)$/.test(lower)) return "step";
  if (/\.(?:ifc|ifcxml)\.(?:gz|zip)$/.test(lower)) return "ifc";
  if (/\.(?:ifc|ifcxml)gz$/.test(lower)) return "ifc";
  if (/\.(?:ifc|ifcxml)\.zip$/.test(lower)) return "ifc";
  if (/\.e57[._-]?point[._-]?cloud(?:gz|\.gz)$/.test(lower)) return "e57pointcloud";
  if (/\.e57[._-]?point[._-]?cloud(?:zip|[-_]zip|\.zip)$/.test(lower)) return "e57pointcloud";
  if (/\.e57(?:zip|[-_]zip|\.zip|gz|\.gz)$/.test(lower)) return "e57";
  if (/\.e57[._-]?point[._-]?cloud$/.test(lower)) return "e57pointcloud";
  return FORMAT_EXTENSIONS.get(path.extname(lower)) || zipPayloadFormat(inputPath) || gzipPayloadFormat(inputPath) || filePayloadFormat(inputPath);
}

function hasDwgSignature(filePath) {
  const handle = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(32);
    const read = fs.readSync(handle, buffer, 0, buffer.length, 0);
    return read >= 6 && buffer.subarray(0, 4).toString("ascii") === "AC10" && buffer.subarray(0, read).includes(0);
  } finally {
    fs.closeSync(handle);
  }
}

function pairColor(groups) {
  const trueColor = number(groups.find(([code]) => code === "420")?.[1]);
  if (Number.isInteger(trueColor) && trueColor >= 0) return `#${(trueColor & 0xffffff).toString(16).padStart(6, "0")}`;
  const aci = groups.find(([code]) => code === "62")?.[1];
  return DXF_ACI[Math.abs(Number(aci))] || undefined;
}

function dxfEntityColor(groups, byBlockColor) {
  const trueColor = number(groups.find(([code]) => code === "420")?.[1]);
  if (Number.isInteger(trueColor) && trueColor >= 0) return `#${(trueColor & 0xffffff).toString(16).padStart(6, "0")}`;
  const aci = number(groups.find(([code]) => code === "62")?.[1]);
  if (Number.isInteger(aci) && aci === 0) return byBlockColor;
  return DXF_ACI[Math.abs(aci)] || undefined;
}

function dxfOpacity(groups, byBlockOpacity = null) {
  const raw = Math.trunc(number(groups.find(([code]) => code === "440")?.[1]) ?? NaN);
  if (!Number.isInteger(raw)) return null;
  const value = raw >>> 0;
  if (value === 0x01000000) return byBlockOpacity;
  if ((value & 0x02000000) !== 0x02000000) return null;
  return (value & 0xff) / 255;
}

function dxfPoint(groups, xCode, yCode, zCode = String(Number(xCode) + 20)) {
  const x = number(groups.find(([code]) => code === xCode)?.[1]);
  const y = number(groups.find(([code]) => code === yCode)?.[1]);
  const z = number(groups.find(([code]) => code === zCode)?.[1]) ?? number(groups.find(([code]) => code === "38")?.[1]) ?? 0;
  return finite(x) && finite(y) ? [x, y, z] : null;
}

function dxfPointWithElevation(groups, xCode, yCode, zCode, elevation = 0, usePointZ = true) {
  const x = number(groups.find(([code]) => code === xCode)?.[1]);
  const y = number(groups.find(([code]) => code === yCode)?.[1]);
  const z = usePointZ ? number(groups.find(([code]) => code === zCode)?.[1]) ?? elevation : elevation;
  return finite(x) && finite(y) ? [x, y, z] : null;
}

function dxfVector(groups, xCode, yCode, zCode = String(Number(xCode) + 20)) {
  const x = number(groups.find(([code]) => code === xCode)?.[1]);
  const y = number(groups.find(([code]) => code === yCode)?.[1]);
  const z = number(groups.find(([code]) => code === zCode)?.[1]) ?? 0;
  return finite(x) && finite(y) ? [x, y, z] : null;
}

function dxfPointList(groups, xCode, yCode, zCode) {
  const points = [];
  const elevation = number(groups.find(([code]) => code === "38")?.[1]) ?? 0;
  let current = null;
  for (const [code, value] of groups) {
    if (code === xCode) {
      if (current && finite(current[0]) && finite(current[1])) points.push([current[0], current[1], current[2] ?? elevation]);
      current = [number(value), null, elevation];
    } else if (code === yCode && current) current[1] = number(value);
    else if (code === zCode && current) current[2] = number(value) ?? elevation;
  }
  if (current && finite(current[0]) && finite(current[1])) points.push([current[0], current[1], current[2] ?? elevation]);
  return points;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalized(vector) {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map((value) => value / length) : null;
}

function dxfOcsMapper(groups) {
  const normal = normalized([
    number(groups.find(([code]) => code === "210")?.[1]) ?? 0,
    number(groups.find(([code]) => code === "220")?.[1]) ?? 0,
    number(groups.find(([code]) => code === "230")?.[1]) ?? 1
  ]);
  if (!normal || (Math.abs(normal[0]) < 1e-12 && Math.abs(normal[1]) < 1e-12 && Math.abs(normal[2] - 1) < 1e-12)) return (point) => point;
  const seed = Math.abs(normal[0]) < 1 / 64 && Math.abs(normal[1]) < 1 / 64 ? [0, 1, 0] : [0, 0, 1];
  const axisX = normalized(cross(seed, normal)) || [1, 0, 0];
  const axisY = cross(normal, axisX);
  return (point) => [
    point[0] * axisX[0] + point[1] * axisY[0] + point[2] * normal[0],
    point[0] * axisX[1] + point[1] * axisY[1] + point[2] * normal[1],
    point[0] * axisX[2] + point[1] * axisY[2] + point[2] * normal[2]
  ];
}

function dxfFacePoints(groups, solidOrder = false) {
  const order = solidOrder ? ["10", "11", "13", "12"] : ["10", "11", "12", "13"];
  const points = order.map((code) => dxfPoint(groups, code, String(Number(code) + 10), String(Number(code) + 20))).filter(Boolean);
  return points.filter((point, index) => points.findIndex((item) => item.every((value, axis) => Math.abs(value - point[axis]) < 1e-9)) === index);
}

function dxfLayer(groups, fallback) {
  return cleanId(groups.find(([code]) => code === "8")?.[1], fallback);
}

function dxfName(groups, code) {
  return String(groups.find(([itemCode]) => itemCode === code)?.[1] || "").trim().toUpperCase();
}

function dxfLayerStyles(text) {
  return Object.fromEntries(dxfEntities(text)
    .filter((entity) => entity.type === "LAYER")
    .map((entity) => {
      const id = cleanId(entity.groups.find(([code]) => code === "2")?.[1]);
      const color = pairColor(entity.groups);
      const opacity = dxfOpacity(entity.groups);
      return id && (color || finite(opacity)) ? [id, { ...(color ? { color } : {}), ...(finite(opacity) ? { opacity } : {}) }] : null;
    })
    .filter(Boolean));
}

function dxfHiddenLayers(text) {
  return new Set(dxfEntities(text)
    .filter((entity) => entity.type === "LAYER")
    .map((entity) => {
      const id = cleanId(entity.groups.find(([code]) => code === "2")?.[1]);
      const aci = number(entity.groups.find(([code]) => code === "62")?.[1]);
      return id && (aci < 0 || (dxfFlags(entity.groups) & 1) === 1) ? id : "";
    })
    .filter(Boolean));
}

function dxfFlags(groups) {
  return Number(groups.find(([code]) => code === "70")?.[1]) || 0;
}

function packedRgbToken(value) {
  const text = String(value || "").trim();
  const packedText = text.replace(/^[a-z][a-z0-9_-]*\s*[:=]\s*/i, "");
  if (/^rgba?\(.*\)$/i.test(packedText)) return true;
  return /^(?:[a-z][a-z0-9_-]*\s*[:=]\s*)?(?:#|0x)?(?:[0-9a-f]{3,4}|[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i.test(text)
    && (/^(?:#|0x)/i.test(packedText) || /[a-f]/i.test(packedText) || packedText !== text);
}

function dxfInvisible(groups) {
  return Number(groups.find(([code]) => code === "60")?.[1]) === 1;
}

function dxfPaperSpace(groups) {
  const layout = String(groups.find(([code]) => code === "410")?.[1] || "").trim();
  return Number(groups.find(([code]) => code === "67")?.[1]) === 1 || (layout && layout.toUpperCase() !== "MODEL");
}

function dxfPairScore(pairs) {
  const known0 = new Set(["SECTION", "ENDSEC", "EOF", "LINE", "LWPOLYLINE", "POLYLINE", "VERTEX", "SEQEND", "POINT", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "MESH", "3DFACE", "SOLID", "TRACE", "HATCH", "LEADER", "MLINE", "INSERT", "MINSERT", "DIMENSION", "BLOCK", "ENDBLK", "TEXT", "MTEXT", ...DXF_UNSUPPORTED_DIAGNOSTIC_ENTITIES]);
  const sections = new Set(["HEADER", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS", "CLASSES"]);
  return pairs.reduce((score, [code, value]) => score + (code === "0" && known0.has(String(value).toUpperCase()) ? 2 : 0) + (code === "2" && sections.has(String(value).toUpperCase()) ? 1 : 0), 0);
}

function dxfPairsLoose(text) {
  const lines = [];
  const rawLines = textLines(text);
  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index].trim();
    if (!line) continue;
    if (line === "999") { index += 1; continue; }
    lines.push(line);
  }
  const pairs = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    pairs.push([lines[index], lines[index + 1]]);
  }
  return pairs;
}

function dxfPairsPreservingEmptyValues(text) {
  const pairs = [];
  const rawLines = textLines(text);
  for (let index = 0; index < rawLines.length;) {
    const code = rawLines[index++].trim();
    if (!code) continue;
    if (code === "999") { index += 1; continue; }
    if (index >= rawLines.length) break;
    pairs.push([code, rawLines[index++].trim()]);
  }
  return pairs;
}

function dxfPairs(text) {
  const strict = dxfPairsPreservingEmptyValues(text);
  const loose = dxfPairsLoose(text);
  return dxfPairScore(loose) > dxfPairScore(strict) ? loose : strict;
}

function dxfHeaderCode(text, name, code) {
  const pairs = dxfPairs(text);
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index][0] !== "9" || pairs[index][1] !== name) continue;
    for (let scan = index + 1; scan < pairs.length && pairs[scan][0] !== "9" && pairs[scan][0] !== "0"; scan += 1) {
      if (pairs[scan][0] === code) return pairs[scan][1];
    }
  }
  return "";
}

function dxfDetectedUnits(text) {
  return DXF_INSUNITS[Number(dxfHeaderCode(text, "$INSUNITS", "70"))] || "";
}

function dxfEntities(text) {
  const pairs = dxfPairs(text);
  const entities = [];
  let type = "";
  let groups = [];
  const flush = () => {
    if (type) entities.push({ type, groups });
    groups = [];
  };
  for (const [code, value] of pairs) {
    if (code === "0") {
      flush();
      type = value.toUpperCase();
    } else if (type) {
      groups.push([code, value]);
    }
  }
  flush();
  return entities;
}

function dxfHasAnySection(text) {
  return dxfPairs(text).some(([code, value]) => code === "0" && String(value).toUpperCase() === "SECTION");
}

function dxfSectionEntities(text, name) {
  const pairs = dxfPairs(text);
  const target = name.toUpperCase();
  const entities = [];
  let section = "";
  let wantSectionName = false;
  let type = "";
  let groups = [];
  const flush = () => {
    if (section === target && type) entities.push({ type, groups });
    type = "";
    groups = [];
  };
  for (const [code, value] of pairs) {
    const upper = value.toUpperCase();
    if (code === "0" && upper === "SECTION") {
      flush();
      section = "";
      wantSectionName = true;
    } else if (wantSectionName && code === "2") {
      section = upper;
      wantSectionName = false;
    } else if (code === "0" && upper === "ENDSEC") {
      flush();
      section = "";
    } else if (section === target && code === "0") {
      flush();
      type = upper;
    } else if (section === target && type) {
      groups.push([code, value]);
    }
  }
  flush();
  return entities;
}

function dxfBlocks(text) {
  const blocks = new Map();
  let name = "";
  let base = [0, 0, 0];
  let entities = [];
  for (const entity of dxfSectionEntities(text, "BLOCKS")) {
    if (entity.type === "BLOCK") {
      name = dxfName(entity.groups, "2");
      base = dxfPoint(entity.groups, "10", "20", "30") || [0, 0, 0];
      entities = [];
    } else if (entity.type === "ENDBLK") {
      if (name) blocks.set(name, { base, entities });
      name = "";
      base = [0, 0, 0];
      entities = [];
    } else if (name) {
      entities.push(entity);
    }
  }
  return blocks;
}

function dxfInsertTransforms(groups, blockBase = [0, 0, 0]) {
  const base = dxfPoint(groups, "10", "20", "30") || [0, 0, 0];
  const ocs = dxfOcsMapper(groups);
  const sx = number(groups.find(([code]) => code === "41")?.[1]) ?? 1;
  const sy = number(groups.find(([code]) => code === "42")?.[1]) ?? sx;
  const sz = number(groups.find(([code]) => code === "43")?.[1]) ?? 1;
  const angle = (number(groups.find(([code]) => code === "50")?.[1]) || 0) * Math.PI / 180;
  const columns = Math.max(1, Math.floor(number(groups.find(([code]) => code === "70")?.[1]) || 1));
  const rows = Math.max(1, Math.floor(number(groups.find(([code]) => code === "71")?.[1]) || 1));
  const columnSpacing = number(groups.find(([code]) => code === "44")?.[1]) || 0;
  const rowSpacing = number(groups.find(([code]) => code === "45")?.[1]) || 0;
  const out = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const dx = column * columnSpacing;
      const dy = row * rowSpacing;
      out.push({ base: blockBase, offset: ocs([base[0] + dx * Math.cos(angle) - dy * Math.sin(angle), base[1] + dx * Math.sin(angle) + dy * Math.cos(angle), base[2]]), sx, sy, sz, cos: Math.cos(angle), sin: Math.sin(angle), ocs });
    }
  }
  return out;
}

function dxfApplyTransforms(point, transforms) {
  if (!point) return point;
  if (!transforms?.length) return point;
  let out = point;
  for (let index = transforms.length - 1; index >= 0; index -= 1) {
    const transform = transforms[index];
    const base = transform.base || [0, 0, 0];
    const x = (out[0] - base[0]) * transform.sx;
    const y = (out[1] - base[1]) * transform.sy;
    const local = transform.ocs([
      x * transform.cos - y * transform.sin,
      x * transform.sin + y * transform.cos,
      (out[2] - base[2]) * transform.sz
    ]);
    out = [transform.offset[0] + local[0], transform.offset[1] + local[1], transform.offset[2] + local[2]];
  }
  return out;
}

function itemOpacityFields(item, options) {
  const value = finite(options.opacity) ? options.opacity : finite(item?.opacity) ? item.opacity : null;
  return finite(value) ? { opacity: value } : {};
}

function addPolyline(doc, item, options, format) {
  const rawPoints = item.points.map((point) => transformPoint(point, options, format)).filter((point) => point.every(finite));
  const points = rawPoints.filter((point, index) => index === 0 || !point.every((value, axis) => Math.abs(value - rawPoints[index - 1][axis]) < 1e-9));
  if (item.closed && points.length > 2 && points[0].every((value, axis) => Math.abs(value - points.at(-1)[axis]) < 1e-9)) points.pop();
  if (points.length < 2) return;
  doc.polylines.push({
    id: `${item.id}_${doc.polylines.length + 1}`,
    layer: item.layer,
    ...(item.color ? { color: item.color } : {}),
    ...itemOpacityFields(item, options),
    ...(item.closed ? { closed: true } : {}),
    points
  });
}

function addLine(doc, a, b, item, options, format) {
  if (!a || !b) return;
  const points = [a, b].map((point) => transformPoint(point, options, format));
  if (!points.every((point) => point.every(finite))) return;
  if (points[0].every((value, axis) => Math.abs(value - points[1][axis]) < 1e-9)) return;
  doc.lines.push({
    id: `${item.id}_${doc.lines.length + 1}`,
    layer: item.layer,
    ...(item.color ? { color: item.color } : {}),
    ...itemOpacityFields(item, options),
    points
  });
}

function circlePolyline(center, radius, startDeg = 0, endDeg = 360) {
  let span = endDeg - startDeg;
  const full = Math.abs(span) >= 359.999;
  if (full) span = span < 0 ? -360 : 360;
  else if (span < 0) span += 360;
  if (Math.abs(span) < 1e-9) return { points: [], closed: false };
  const steps = Math.max(16, Math.ceil(Math.abs(span) / 10));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (startDeg + span * index / steps) * Math.PI / 180;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius, center[2]]);
  }
  return { points, closed: full };
}

function ellipsePolyline(center, major, ratio, start = 0, end = Math.PI * 2) {
  let span = end - start;
  const full = Math.abs(span) >= Math.PI * 2 - 1e-6;
  if (full) span = span < 0 ? -Math.PI * 2 : Math.PI * 2;
  else if (span < 0) span += Math.PI * 2;
  if (Math.abs(span) < 1e-9) return { points: [], closed: false };
  const steps = Math.max(16, Math.ceil(Math.abs(span) / (Math.PI / 18)));
  const minor = [-major[1] * ratio, major[0] * ratio, 0];
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = start + span * index / steps;
    points.push([
      center[0] + major[0] * Math.cos(t) + minor[0] * Math.sin(t),
      center[1] + major[1] * Math.cos(t) + minor[1] * Math.sin(t),
      center[2] + major[2] * Math.cos(t) + minor[2] * Math.sin(t)
    ]);
  }
  return { points, closed: full };
}

function bulgePoints(a, b, bulge) {
  if (!finite(bulge) || Math.abs(bulge) < 1e-9) return [a, b];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return [a, b];
  const theta = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const offset = radius * Math.cos(Math.abs(theta) / 2) * Math.sign(bulge);
  const center = [(a[0] + b[0]) / 2 - dy / chord * offset, (a[1] + b[1]) / 2 + dx / chord * offset, a[2]];
  const start = Math.atan2(a[1] - center[1], a[0] - center[0]);
  const steps = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 18)));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = start + theta * index / steps;
    points.push([center[0] + Math.cos(t) * Math.abs(radius), center[1] + Math.sin(t) * Math.abs(radius), a[2] + (b[2] - a[2]) * index / steps]);
  }
  return points;
}

function lwPolylineVertices(groups) {
  const vertices = [];
  const elevation = number(groups.find(([code]) => code === "38")?.[1]) ?? 0;
  let current = null;
  for (const [code, value] of groups) {
    if (code === "10") {
      if (current?.point && finite(current.point[0]) && finite(current.point[1])) vertices.push(current);
      current = { point: [number(value), null, elevation], bulge: 0 };
    } else if (code === "20" && current) current.point[1] = number(value);
    else if (code === "30" && current) current.point[2] = number(value) ?? elevation;
    else if (code === "42" && current) current.bulge = number(value) ?? 0;
  }
  if (current?.point && finite(current.point[0]) && finite(current.point[1])) vertices.push(current);
  return vertices;
}

function vertexPolylinePoints(vertices, closed) {
  if (vertices.length < 2) return [];
  const points = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < count; index += 1) {
    const segment = bulgePoints(vertices[index].point, vertices[(index + 1) % vertices.length].point, vertices[index].bulge);
    points.push(...(points.length ? segment.slice(1) : segment));
  }
  if (closed && points.length > 2 && points[0].every((value, axis) => Math.abs(value - points[points.length - 1][axis]) < 1e-9)) points.pop();
  return points;
}

function lwPolylinePoints(groups, closed) {
  return vertexPolylinePoints(lwPolylineVertices(groups), closed);
}

function sameDxfPoint(a, b) {
  return a?.length === 3 && b?.length === 3 && a.every((value, index) => Math.abs(value - b[index]) < 1e-9);
}

function dxfValues(groups, code) {
  return groups.filter(([itemCode]) => itemCode === code).map(([, value]) => number(value)).filter(finite);
}

function dxfMeshFaces(groups, vertexCount) {
  const start = groups.findIndex(([code]) => code === "93");
  if (start < 0) return [];
  const expected = Math.max(0, Math.trunc(number(groups[start][1]) || 0));
  const values = [];
  for (const [code, value] of groups.slice(start + 1)) {
    if ((code === "94" || code === "95") && (!expected || values.length >= expected)) break;
    if (code === "90") values.push(Math.trunc(number(value) ?? -1));
    if (expected && values.length >= expected) break;
  }
  const faces = [];
  for (let index = 0; index < values.length;) {
    const count = values[index++];
    if (!Number.isInteger(count) || count < 3 || index + count > values.length) break;
    const face = values.slice(index, index + count).filter((value, itemIndex, items) => Number.isInteger(value) && value >= 0 && value < vertexCount && items.indexOf(value) === itemIndex);
    if (face.length >= 3) faces.push(face);
    index += count;
  }
  return faces;
}

function bsplinePoint(controls, knots, weights, degree, t) {
  const n = controls.length - 1;
  let span = n;
  if (t < knots[n + 1]) {
    span = degree;
    while (span < n && t >= knots[span + 1]) span += 1;
  }
  const points = [];
  for (let index = 0; index <= degree; index += 1) {
    const controlIndex = span - degree + index;
    const weight = weights[controlIndex] ?? 1;
    const point = controls[controlIndex];
    points.push([point[0] * weight, point[1] * weight, point[2] * weight, weight]);
  }
  for (let r = 1; r <= degree; r += 1) {
    for (let index = degree; index >= r; index -= 1) {
      const knotIndex = span - degree + index;
      const denom = knots[knotIndex + degree - r + 1] - knots[knotIndex];
      const alpha = Math.abs(denom) > 1e-12 ? (t - knots[knotIndex]) / denom : 0;
      points[index] = points[index].map((value, axis) => (1 - alpha) * points[index - 1][axis] + alpha * value);
    }
  }
  const weight = points[degree][3] || 1;
  return points[degree].slice(0, 3).map((value) => value / weight);
}

function splinePoints(groups, degreeCode = "94", weightCode = "42") {
  const fitPoints = dxfPointList(groups, "11", "21", "31");
  if (fitPoints.length >= 2) return fitPoints;
  const controls = dxfPointList(groups, "10", "20", "30");
  if (controls.length < 2) return [];
  const degree = Math.max(1, Math.min(8, Math.floor(number(groups.find(([code]) => code === degreeCode)?.[1]) || 3)));
  const knots = dxfValues(groups, "40");
  const weights = dxfValues(groups, weightCode);
  if (degree >= controls.length || knots.length < controls.length + degree + 1) return controls;
  const start = knots[degree];
  const end = knots[controls.length];
  if (!finite(start) || !finite(end) || end <= start) return controls;
  const steps = Math.max(12, controls.length * 8);
  const out = [];
  for (let index = 0; index <= steps; index += 1) {
    out.push(bsplinePoint(controls, knots, weights, degree, start + (end - start) * index / steps));
  }
  return out.filter((point) => point.every(finite));
}

function hatchSplineEdgePoints(edge) {
  return splinePoints(edge);
}

function hatchEdgePolyline(groups, countIndex, count) {
  const edges = [];
  const context = groups.filter(([code]) => code === "38");
  let current = [];
  for (const pair of groups.slice(countIndex + 1)) {
    if (pair[0] === "72" && current.length) {
      edges.push(current);
      current = [];
      if (edges.length >= count) break;
    }
    current.push(pair);
  }
  if (current.length && edges.length < count) edges.push(current);
  const points = [];
  for (const rawEdge of edges) {
    const edge = context.length ? [...context, ...rawEdge] : rawEdge;
    const type = Number(edge.find(([code]) => code === "72")?.[1]);
    let segment = [];
    if (type === 1) {
      const a = dxfPoint(edge, "10", "20", "30");
      const b = dxfPoint(edge, "11", "21", "31");
      if (!a || !b) return { points: [], closed: false };
      segment = [a, b];
    } else if (type === 2) {
      const center = dxfPoint(edge, "10", "20", "30");
      const radius = number(edge.find(([code]) => code === "40")?.[1]);
      if (!center || !finite(radius) || radius <= 0) return { points: [], closed: false };
      const start = number(edge.find(([code]) => code === "50")?.[1]) ?? 0;
      const end = number(edge.find(([code]) => code === "51")?.[1]) ?? 360;
      const ccw = Number(edge.find(([code]) => code === "73")?.[1]) !== 0;
      segment = (ccw ? circlePolyline(center, radius, start, end) : circlePolyline(center, radius, end, start)).points;
      if (!ccw) segment.reverse();
    } else if (type === 3) {
      const center = dxfPoint(edge, "10", "20", "30");
      const major = dxfVector(edge, "11", "21", "31");
      const ratio = number(edge.find(([code]) => code === "40")?.[1]);
      if (!center || !major || !finite(ratio) || ratio <= 0) return { points: [], closed: false };
      const start = (number(edge.find(([code]) => code === "50")?.[1]) ?? 0) * Math.PI / 180;
      const end = (number(edge.find(([code]) => code === "51")?.[1]) ?? 360) * Math.PI / 180;
      const ccw = Number(edge.find(([code]) => code === "73")?.[1]) !== 0;
      segment = (ccw ? ellipsePolyline(center, major, ratio, start, end) : ellipsePolyline(center, major, ratio, end, start)).points;
      if (!ccw) segment.reverse();
    } else if (type === 4) {
      segment = hatchSplineEdgePoints(edge);
      if (segment.length < 2) return { points: [], closed: false };
    } else {
      return { points: [], closed: false };
    }
    if (!points.length || !sameDxfPoint(points.at(-1), segment[0])) points.push(segment[0]);
    points.push(...segment.slice(1));
  }
  const closed = points.length > 2 && sameDxfPoint(points[0], points.at(-1));
  if (closed) points.pop();
  return { points, closed };
}

function hatchPolyline(groups) {
  const countIndex = groups.findIndex(([code]) => code === "93");
  const context = groups.filter(([code]) => code === "38");
  const count = Math.floor(number(groups[countIndex]?.[1]) || 0);
  const pathFlags = Number(groups.find(([code]) => code === "92")?.[1]) || 0;
  if (countIndex >= 0 && count > 0 && (pathFlags & 2) !== 2) {
    const edgePolyline = hatchEdgePolyline(groups, countIndex, count);
    if (edgePolyline.points.length >= 2) return edgePolyline;
  }
  const closed = Number(groups.find(([code]) => code === "73")?.[1]) === 1;
  const vertices = countIndex >= 0 && count > 1 ? lwPolylineVertices([...context, ...groups.slice(countIndex + 1)]).slice(0, count) : [];
  return { points: vertexPolylinePoints(vertices, closed), closed };
}

function hatchPolylines(groups) {
  const starts = groups.map(([code], index) => code === "92" ? index : -1).filter((index) => index >= 0);
  if (!starts.length) return [hatchPolyline(groups)];
  const context = groups.filter(([code]) => code === "38");
  return starts.map((start, index) => hatchPolyline([...context, ...groups.slice(start, starts[index + 1] ?? groups.length)])).filter((item) => item.points.length >= 2);
}

function translateDxf(sourcePath, options, format = "dxf", extra = {}) {
  const text = readTextFile(sourcePath);
  const detectedUnits = dxfDetectedUnits(text);
  const transformOptions = !options.units && detectedUnits ? { ...options, units: detectedUnits } : options;
  const doc = { lines: [], polylines: [], meshes: [], pointClouds: [], diagnostics: [], layerStyles: dxfLayerStyles(text) };
  const hiddenLayers = dxfHiddenLayers(text);
  const blocks = dxfBlocks(text);
  const pointCloudIndexes = new Map();
  const pointCloudStats = new Map();
  const unsupportedEntities = new Map();
  const pointStride = Math.max(1, Math.floor(transformOptions.pointStride));
  const pointMax = Math.floor(transformOptions.maxPoints);
  let pointSeen = 0;
  let pointStored = 0;
  let activePolyline = null;
  const countUnsupported = (type) => unsupportedEntities.set(type, (unsupportedEntities.get(type) || 0) + 1);
  const finishPolyline = () => {
    if (activePolyline) {
      if (activePolyline.kind === "polyface") {
        const vertices = activePolyline.vertices.map((point) => transformPoint(dxfApplyTransforms(point, activePolyline.transforms), transformOptions, format));
        const faces = activePolyline.faces.map((face) => face.filter((index, itemIndex) => Number.isInteger(index) && index >= 0 && index < vertices.length && face.indexOf(index) === itemIndex)).filter((face) => face.length >= 3);
        if (vertices.length >= 3 && faces.length) {
          doc.meshes.push({
            id: `${activePolyline.id}_polyface_${doc.meshes.length + 1}`,
            layer: activePolyline.layer,
            ...(activePolyline.color ? { color: activePolyline.color } : {}),
            ...itemOpacityFields(activePolyline, transformOptions),
            vertices,
            faces
          });
        }
      } else if (activePolyline.kind === "polymesh") {
        const vertices = activePolyline.vertices.map((point) => transformPoint(dxfApplyTransforms(point, activePolyline.transforms), transformOptions, format));
        const { m, n, closedM, closedN } = activePolyline;
        const faces = [];
        if (m > 1 && n > 1 && vertices.length >= m * n) {
          for (let i = 0; i < (closedM ? m : m - 1); i += 1) {
            for (let j = 0; j < (closedN ? n : n - 1); j += 1) {
              const nextI = (i + 1) % m;
              const nextJ = (j + 1) % n;
              faces.push([i * n + j, nextI * n + j, nextI * n + nextJ, i * n + nextJ]);
            }
          }
        }
        if (vertices.length >= 3 && faces.length) {
          doc.meshes.push({
            id: `${activePolyline.id}_polymesh_${doc.meshes.length + 1}`,
            layer: activePolyline.layer,
            ...(activePolyline.color ? { color: activePolyline.color } : {}),
            ...itemOpacityFields(activePolyline, transformOptions),
            vertices,
            faces
          });
        }
      } else {
        const points = vertexPolylinePoints(activePolyline.vertices, activePolyline.closed)
          .map(activePolyline.ocs || ((point) => point))
          .map((point) => dxfApplyTransforms(point, activePolyline.transforms));
        addPolyline(doc, { ...activePolyline, points }, transformOptions, format);
      }
    }
    activePolyline = null;
  };
  const emit = (entity, transforms = [], insertStyle = null, depth = 0) => {
    if ((dxfInvisible(entity.groups) || dxfPaperSpace(entity.groups)) && entity.type !== "SEQEND") {
      if (entity.type !== "VERTEX") finishPolyline();
      return;
    }
    const ownLayer = dxfLayer(entity.groups, options.layer);
    const layer = insertStyle && ownLayer === "0" ? insertStyle.layer : ownLayer;
    if (hiddenLayers.has(layer) && entity.type !== "SEQEND") {
      if (entity.type !== "VERTEX") finishPolyline();
      return;
    }
    const color = dxfEntityColor(entity.groups, insertStyle?.color);
    const opacity = dxfOpacity(entity.groups, insertStyle?.opacity);
    const base = { layer, color, id: layer, ...(finite(opacity) ? { opacity } : {}) };
    const ocs = dxfOcsMapper(entity.groups);
    const raw = (point) => dxfApplyTransforms(point, transforms);
    const rawMany = (points) => points.map(raw);
    const rawOcs = (point) => raw(ocs(point));
    const rawOcsMany = (points) => points.map(rawOcs);
    if (entity.type === "LINE") {
      finishPolyline();
      addLine(doc, raw(dxfPoint(entity.groups, "10", "20", "30")), raw(dxfPoint(entity.groups, "11", "21", "31")), base, transformOptions, format);
    } else if (entity.type === "LWPOLYLINE") {
      finishPolyline();
      const closed = (dxfFlags(entity.groups) & 1) === 1;
      addPolyline(doc, { ...base, points: rawOcsMany(lwPolylinePoints(entity.groups, closed)), closed }, transformOptions, format);
    } else if (entity.type === "HATCH") {
      finishPolyline();
      for (const hatch of hatchPolylines(entity.groups)) {
        addPolyline(doc, { ...base, points: rawOcsMany(hatch.points), closed: hatch.closed }, transformOptions, format);
      }
    } else if (entity.type === "LEADER") {
      finishPolyline();
      addPolyline(doc, { ...base, points: rawMany(dxfPointList(entity.groups, "10", "20", "30")) }, transformOptions, format);
    } else if (entity.type === "MLINE") {
      finishPolyline();
      addPolyline(doc, { ...base, points: rawMany(dxfPointList(entity.groups, "11", "21", "31")) }, transformOptions, format);
    } else if (entity.type === "POLYLINE") {
      finishPolyline();
      const flags = dxfFlags(entity.groups);
      const kind = (flags & 64) === 64 ? "polyface" : (flags & 16) === 16 ? "polymesh" : "polyline";
      activePolyline = {
        ...base,
        transforms,
        kind,
        ocs: kind === "polyline" && (flags & 8) !== 8 ? dxfOcsMapper(entity.groups) : null,
        is3d: (flags & 8) === 8,
        vertices: [],
        faces: [],
        elevation: number(entity.groups.find(([code]) => code === "30")?.[1]) ?? number(entity.groups.find(([code]) => code === "38")?.[1]) ?? 0,
        closed: (flags & 1) === 1,
        closedM: (flags & 1) === 1,
        closedN: (flags & 32) === 32,
        m: Math.max(0, Math.trunc(number(entity.groups.find(([code]) => code === "71")?.[1]) ?? 0)),
        n: Math.max(0, Math.trunc(number(entity.groups.find(([code]) => code === "72")?.[1]) ?? 0))
      };
    } else if (entity.type === "VERTEX" && activePolyline) {
      const face = ["71", "72", "73", "74"].map((code) => Math.abs(Math.trunc(number(entity.groups.find(([itemCode]) => itemCode === code)?.[1]) ?? 0)) - 1).filter((index) => index >= 0);
      if (activePolyline.kind === "polyface" && face.length >= 3) {
        activePolyline.faces.push(face);
      } else {
        const point = activePolyline.kind === "polyline" ? dxfPointWithElevation(entity.groups, "10", "20", "30", activePolyline.elevation, activePolyline.is3d) : dxfPoint(entity.groups, "10", "20", "30");
        if (point) activePolyline.vertices.push(activePolyline.kind === "polyline" ? { point, bulge: number(entity.groups.find(([code]) => code === "42")?.[1]) ?? 0 } : point);
      }
    } else if (entity.type === "SEQEND") {
      finishPolyline();
    } else if (entity.type === "CIRCLE" || entity.type === "ARC") {
      finishPolyline();
      const center = dxfPoint(entity.groups, "10", "20", "30");
      const radius = number(entity.groups.find(([code]) => code === "40")?.[1]);
      if (center && finite(radius) && radius > 0) {
        const start = entity.type === "ARC" ? number(entity.groups.find(([code]) => code === "50")?.[1]) ?? 0 : 0;
        const end = entity.type === "ARC" ? number(entity.groups.find(([code]) => code === "51")?.[1]) ?? 360 : 360;
        const item = circlePolyline(center, radius, start, end);
        addPolyline(doc, { ...base, ...item, points: rawOcsMany(item.points) }, transformOptions, format);
      }
    } else if (entity.type === "ELLIPSE") {
      finishPolyline();
      const center = dxfPoint(entity.groups, "10", "20", "30");
      const major = dxfVector(entity.groups, "11", "21", "31");
      const ratio = number(entity.groups.find(([code]) => code === "40")?.[1]);
      if (center && major && finite(ratio) && ratio > 0) {
        const start = number(entity.groups.find(([code]) => code === "41")?.[1]) ?? 0;
        const end = number(entity.groups.find(([code]) => code === "42")?.[1]) ?? Math.PI * 2;
        const item = ellipsePolyline(center, major, ratio, start, end);
        addPolyline(doc, { ...base, ...item, points: rawOcsMany(item.points) }, transformOptions, format);
      }
    } else if (entity.type === "SPLINE") {
      finishPolyline();
      addPolyline(doc, { ...base, points: rawMany(splinePoints(entity.groups, "71", "41")), closed: (dxfFlags(entity.groups) & 1) === 1 }, transformOptions, format);
    } else if (entity.type === "MESH") {
      finishPolyline();
      const rawVertices = dxfPointList(entity.groups, "10", "20", "30");
      const faces = dxfMeshFaces(entity.groups, rawVertices.length);
      if (rawVertices.length >= 3 && faces.length) {
        doc.meshes.push({
          id: `${layer}_mesh_${doc.meshes.length + 1}`,
          layer,
          ...(color ? { color } : {}),
          ...itemOpacityFields(base, transformOptions),
          vertices: rawVertices.map(raw).map((point) => transformPoint(point, transformOptions, format)),
          faces
        });
      }
    } else if (entity.type === "3DFACE" || entity.type === "SOLID" || entity.type === "TRACE") {
      finishPolyline();
      const unique = dxfFacePoints(entity.groups, entity.type !== "3DFACE");
      if (unique.length >= 3) {
        const faceRaw = entity.type === "3DFACE" ? raw : rawOcs;
        doc.meshes.push({
          id: `${layer}_face_${doc.meshes.length + 1}`,
          layer,
          ...(color ? { color } : {}),
          ...itemOpacityFields(base, transformOptions),
          vertices: unique.map(faceRaw).map((point) => transformPoint(point, transformOptions, format)),
          faces: [unique.map((_, index) => index)]
        });
      }
    } else if (entity.type === "POINT") {
      finishPolyline();
      const point = dxfPoint(entity.groups, "10", "20", "30");
      if (point) {
        const key = `${layer}|${color || ""}|${finite(opacity) ? opacity : ""}`;
        const pointStats = pointCloudStats.get(key) || { sourcePointCount: 0, storedPointCount: 0 };
        pointStats.sourcePointCount += 1;
        pointSeen += 1;
        if ((pointSeen - 1) % pointStride === 0 && pointStored < pointMax) {
          if (!pointCloudIndexes.has(key)) {
            pointCloudIndexes.set(key, doc.pointClouds.length);
            doc.pointClouds.push({
              id: `${layer}_points_${doc.pointClouds.length + 1}`,
              layer,
              ...(color ? { color } : {}),
              ...itemOpacityFields(base, transformOptions),
              pointSize: transformOptions.pointSize,
              points: []
            });
          }
          doc.pointClouds[pointCloudIndexes.get(key)].points.push(transformPoint(rawOcs(point), transformOptions, format));
          pointStats.storedPointCount += 1;
          pointStored += 1;
        }
        pointCloudStats.set(key, pointStats);
      }
    } else if (entity.type === "INSERT" || entity.type === "MINSERT") {
      finishPolyline();
      if (depth >= 8) {
        countUnsupported(`${entity.type}_MAX_DEPTH`);
        return;
      }
      const block = blocks.get(dxfName(entity.groups, "2"));
      if (block) {
        for (const insertTransform of dxfInsertTransforms(entity.groups, block.base)) {
          for (const blockEntity of block.entities) emit(blockEntity, [...transforms, insertTransform], base, depth + 1);
          finishPolyline();
        }
      } else countUnsupported(`${entity.type}_MISSING_BLOCK`);
    } else if (entity.type === "DIMENSION") {
      finishPolyline();
      if (depth >= 8) {
        countUnsupported("DIMENSION_MAX_DEPTH");
        return;
      }
      const block = blocks.get(dxfName(entity.groups, "2"));
      if (block) {
        for (const blockEntity of block.entities) emit(blockEntity, transforms, base, depth + 1);
        finishPolyline();
      } else countUnsupported("DIMENSION_MISSING_BLOCK");
    } else if (DXF_UNSUPPORTED_DIAGNOSTIC_ENTITIES.has(entity.type)) {
      finishPolyline();
      countUnsupported(entity.type);
    }
  };
  const sectionEntities = dxfSectionEntities(text, "ENTITIES");
  const entities = sectionEntities.length || dxfHasAnySection(text)
    ? sectionEntities
    : dxfEntities(text).filter((entity) => !new Set(["EOF", "SECTION", "ENDSEC", "HEADER", "TABLES", "BLOCKS", "OBJECTS", "CLASSES"]).has(entity.type));
  for (const entity of entities) {
    emit(entity);
  }
  finishPolyline();
  for (const [key, stats] of pointCloudStats) {
    const index = pointCloudIndexes.get(key);
    if (Number.isInteger(index) && doc.pointClouds[index]) Object.assign(doc.pointClouds[index], stats);
  }
  if (unsupportedEntities.size) {
    const summary = [...unsupportedEntities.entries()].map(([type, count]) => `${type}:${count}`).join(", ");
    doc.diagnostics.push(diagnostic("warning", "dxf-unsupported-entities", `DXF contains unsupported entities that were not translated: ${summary}. ACIS solids/surfaces should be exported as STEP/IFC or mesh/exploded DXF geometry; point-cloud references should be translated from E57/XYZ/PTS/CSV sidecars; text, tables, leaders, viewports, OLE/raster/underlay references, infinite construction geometry, and proxy entities are reported only as diagnostics.`));
  }
  if (!allPoints(doc).length) doc.diagnostics.push(diagnostic("warning", "dxf-no-supported-entities", "DXF parsed, but no supported LINE/LWPOLYLINE/POLYLINE/HATCH/LEADER/MLINE/CIRCLE/ARC/ELLIPSE/SPLINE/MESH/3DFACE/SOLID/TRACE/POINT/DIMENSION geometry was found"));
  const source = {
    ...(extra.source || {}),
    ...(detectedUnits ? { detectedUnits, ...(options.units ? {} : { unitsFrom: "$INSUNITS" }) } : {})
  };
  const sidecar = finalize(doc, extra.originalPath || sourcePath, format, transformOptions, extra.outputPath, source);
  if (pointSeen !== pointStored && doc.pointClouds.length) sidecar.source.counts = { ...sidecar.source.counts, sourcePoints: pointSeen, storedPoints: pointStored };
  return sidecar;
}

function objMaterialColor(values) {
  const single = String(values[0] || "").trim();
  if (packedRgbToken(single)) values = pointTextPackedRgb(single) || [];
  else if (packedRgbToken(objInlineCommentValue(values.join(" ")))) values = pointTextPackedRgb(objInlineCommentValue(values.join(" "))) || [];
  else values = objMaterialValues(values);
  const mode = single.toLowerCase();
  const rgb = mode === "xyz" ? values.slice(1, 4).map(number)
    : mode === "spectral" ? Array(3).fill(number(values.at(-1)))
      : values.slice(0, 3).map(number);
  if (rgb.length < 3 || !rgb.every(finite)) return "";
  const scaled = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value <= 1 ? value * 255 : value))));
  return `#${scaled.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function objMaterialValues(values) {
  const raw = values.map((value) => String(value || "").trim()).filter(Boolean);
  const numericToken = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[ed][+-]?\d+)?$/i;
  const prefix = raw[0]?.toLowerCase();
  if (prefix === "rgb" || prefix === "rgba") {
    const rest = raw.slice(1);
    if (rest.length === 1 && (rest[0].match(/,/g) || []).length >= 2) return rest[0].split(",").map((value) => value.trim()).filter(Boolean);
    return rest.map((value) => value.replace(/,$/, ""));
  }
  if (raw.length === 1 && !/[()#]/.test(raw[0]) && (raw[0].match(/,/g) || []).length >= 2) {
    const parts = raw[0].split(",").map((value) => value.trim()).filter(Boolean);
    if (parts.length >= 3 && parts.every((part) => numericToken.test(part))) return parts;
  }
  return raw.length >= 3 && raw.some((value) => /,$/.test(value))
    ? raw.map((value) => value.replace(/,$/, ""))
    : values;
}

function objMaterialAlpha(values) {
  const mode = String(values[0] || "").trim().toLowerCase();
  if (mode === "xyz" || mode === "spectral") return null;
  const packedAlpha = (value) => {
    const text = String(value || "").trim().replace(/^[a-z][a-z0-9_-]*\s*[:=]\s*/i, "");
    const css = /^rgba?\((.*)\)$/i.exec(text);
    if (css) {
      const channels = css[1].replace("/", " ").split(/[,\s]+/).filter(Boolean);
      if (channels.length < 4) return null;
      const token = channels[3];
      const percent = token.endsWith("%");
      const value = number(percent ? token.slice(0, -1) : token);
      return finite(value) ? Math.max(0, Math.min(1, percent ? value / 100 : value <= 1 ? value : value / 255)) : null;
    }
    let hash = /^(?:#|0x)?([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(text);
    if (hash && !/^(?:#|0x)/i.test(text) && !/[a-f]/i.test(text)) hash = null;
    if (!hash) return null;
    let full = hash[1].toLowerCase();
    if (full.length === 4) full = full.split("").map((char) => char + char).join("");
    const argb = (full.startsWith("ff") || full.startsWith("00")) && full.endsWith("00") && full.slice(2, 8) !== "000000";
    const alpha = Number.parseInt(argb ? full.slice(0, 2) : full.slice(6, 8), 16);
    return Number.isInteger(alpha) ? alpha / 255 : null;
  };
  for (const candidate of [String(values[0] || "").trim(), objInlineCommentValue(values.join(" "))]) {
    const alpha = packedRgbToken(candidate) ? packedAlpha(candidate) : null;
    if (alpha !== null) return alpha;
  }
  values = objMaterialValues(values);
  if (values.length < 4) return null;
  const alpha = number(values[3]);
  return finite(alpha) ? Math.max(0, Math.min(1, alpha <= 1 ? alpha : alpha / 255)) : null;
}

function objMaterialOpacity(parts) {
  const value = parts.slice(1).map(number).find(finite);
  if (!finite(value)) return null;
  const opacityValue = String(parts[0]).toLowerCase() === "tr" ? 1 - value : value;
  return Math.max(0, Math.min(1, opacityValue));
}

function objInlineCommentValue(value) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === "\"" || char === "'") quote = char;
    else if (char === "#" && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trim();
  }
  return String(value || "").trim();
}

function parseObjMtlColors(filePath) {
  const materials = new Map();
  let material = "";
  for (const raw of continuedLines(readTextFile(filePath))) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0].toLowerCase();
    if (keyword === "newmtl" && parts.length >= 2) {
      material = cleanId(objInlineCommentValue(line.slice(parts[0].length)));
      if (!materials.has(material)) materials.set(material, {});
    }
    else if ((keyword === "kd" || keyword === "ka" || keyword === "ke") && material) {
      const values = parts.slice(1);
      const color = objMaterialColor(values);
      const alpha = keyword === "kd" ? objMaterialAlpha(values) : null;
      const style = materials.get(material) || {};
      const next = { ...style };
      if (color && (keyword === "kd" || !next.color)) next.color = color;
      if (alpha !== null && !finite(next.opacity)) next.opacity = alpha;
      materials.set(material, next);
    } else if ((keyword === "d" || keyword === "tr") && material) {
      const opacityValue = objMaterialOpacity(parts);
      if (opacityValue !== null) materials.set(material, { ...(materials.get(material) || {}), opacity: opacityValue });
    }
  }
  return materials;
}

function objMaterialColors(sourcePath, objText) {
  const materials = new Map();
  const dir = path.dirname(sourcePath);
  const mtlPathValue = (value) => quotedPathValue(value).replace(/\\([ \t])/g, "$1");
  const mtlPathValues = (value) => {
    const item = mtlPathValue(value);
    try {
      const decoded = decodeURIComponent(item);
      return decoded === item ? [item] : [item, decoded];
    } catch {
      return [item];
    }
  };
  const mtlNames = (value) => {
    const out = [];
    let token = "";
    let quote = "";
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (quote) {
        if (char === quote) quote = "";
        else token += char;
      } else if (char === "\"" || char === "'") quote = char;
      else if (char === "\\" && /[ \t]/.test(value[index + 1] || "")) token += value[++index];
      else if (/\s/.test(char)) {
        if (token) out.push(token);
        token = "";
      } else token += char;
    }
    if (token) out.push(token);
    return out;
  };
  for (const raw of continuedLines(objText)) {
    const line = raw.trim();
    const parts = line.split(/\s+/);
    if (parts[0]?.toLowerCase() !== "mtllib") continue;
    const rest = objInlineCommentValue(line.slice(parts[0].length));
    const candidateNames = mtlNames(rest);
    const candidates = [...new Set([rest, ...candidateNames].flatMap(mtlPathValues).filter(Boolean))];
    for (const candidate of candidates) {
      const filePath = path.resolve(dir, candidate);
      if (!fs.existsSync(filePath)) continue;
      for (const [material, style] of parseObjMtlColors(filePath)) materials.set(material, { ...(materials.get(material) || {}), ...style });
    }
  }
  return materials;
}

function objStyleKey(style = {}) {
  return `${style.color || ""}|${finite(style.opacity) ? style.opacity : ""}`;
}

function objVertexRgb(parts) {
  const single = String(parts[0] || "").trim();
  if (packedRgbToken(single)) return pointTextPackedRgb(single) || [];
  const packed = objInlineCommentValue(parts.join(" "));
  if (packedRgbToken(packed)) return pointTextPackedRgb(packed) || [];
  const values = parts.map(number);
  const rgba = values.slice(0, 4);
  const rgbAfterWeight = values.slice(1, 4);
  const normalizedRgbAfterWeight = rgbAfterWeight.every((value) => finite(value) && value >= 0 && value <= 1);
  if (rgba.length === 4 && values[0] > 0 && values[0] < 1 && (values[3] === 0 || values[3] === 1) && rgbAfterWeight.every((value) => finite(value) && value >= 0 && value <= 1)) return rgbAfterWeight;
  if (rgba.length === 4 && values[0] === 1 && values[3] > 0 && values[3] < 1 && normalizedRgbAfterWeight) return rgbAfterWeight;
  if (rgba.length === 4 && rgba.every((value) => finite(value) && value >= 0 && value <= 1)) return rgba.slice(0, 3);
  if (values.length >= 4 && finite(values[0]) && values[0] >= 0 && values[0] <= 1 && rgbAfterWeight.every((value) => finite(value) && value >= 0)) return rgbAfterWeight;
  return values.slice(0, 3);
}

function parseObj(sourcePath, originalPath, format, options, outputPath, source = {}) {
  const vertices = [];
  const vertexColors = [];
  const vertexItems = [];
  const faces = [];
  const polylines = [];
  const pointIndexes = [];
  const referencedVertexIndexes = new Set();
  const text = readTextFile(sourcePath);
  const materialColors = objMaterialColors(sourcePath, text);
  let activeGroup = options.layer;
  let activeMaterial = "";
  let activeStyle = {};
  const objIndex = (token) => {
    const rawIndex = Number(String(token).split("/")[0]);
    return rawIndex < 0 ? vertices.length + rawIndex : rawIndex - 1;
  };
  const objFaceIndexes = (tokens) => {
    const out = [];
    for (const index of tokens.map(objIndex).filter((item) => Number.isInteger(item) && item >= 0 && item < vertices.length)) {
      if (!out.includes(index)) out.push(index);
    }
    return out;
  };
  const objLayer = (value) => cleanId(value, options.layer);
  const currentLayer = () => activeMaterial
    ? objLayer(activeGroup === options.layer ? activeMaterial : `${activeGroup}_${activeMaterial}`)
    : objLayer(activeGroup);
  const addObjPolyline = (tokens) => {
    const indexes = tokens.map(objIndex).filter((index) => Number.isInteger(index) && index >= 0 && index < vertices.length);
    if (indexes.length < 2) return;
    for (const index of indexes) referencedVertexIndexes.add(index);
    const closed = indexes.length > 3 && indexes[0] === indexes.at(-1);
    const polylineIndexes = closed ? indexes.slice(0, -1) : indexes;
    polylines.push({ layer: currentLayer(), style: activeStyle, points: polylineIndexes.map((index) => vertices[index]), indexes: polylineIndexes, closed });
  };
  const objVertexColor = (indexes = []) => {
    if (options.colorExplicit) return "";
    const colorSum = [0, 0, 0];
    let colorCount = 0;
    let colorMax = 0;
    for (const index of indexes) {
      const rgb = vertexColors[index];
      if (!rgb) continue;
      colorSum[0] += rgb[0];
      colorSum[1] += rgb[1];
      colorSum[2] += rgb[2];
      colorMax = Math.max(colorMax, ...rgb);
      colorCount += 1;
    }
    return averageRgbColor(colorSum, colorCount, colorMax);
  };
  for (const raw of continuedLines(text)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0].toLowerCase();
    if (keyword === "o" || keyword === "g") {
      activeGroup = parts.length >= 2 ? objLayer(objInlineCommentValue(line.slice(parts[0].length))) : options.layer;
    } else if (keyword === "usemtl") {
      activeMaterial = parts.length >= 2 ? objLayer(objInlineCommentValue(line.slice(parts[0].length))) : "";
      activeStyle = materialColors.get(activeMaterial) || {};
    } else if (keyword === "v" && parts.length >= 4) {
      const point = parts.slice(1, 4).map(number);
      if (point.every(finite)) {
        const rgb = parts.length >= 5 ? objVertexRgb(parts.slice(4)) : [];
        const transformed = transformPoint(point, options, format);
        vertices.push(transformed);
        vertexColors.push(rgb.length === 3 && rgb.every(finite) ? rgb : null);
        vertexItems.push({ layer: currentLayer(), style: activeStyle, point: transformed, index: vertices.length - 1 });
      }
    } else if ((keyword === "f" || keyword === "fo") && parts.length >= 4) {
      const face = objFaceIndexes(parts.slice(1));
      if (face.length >= 3) {
        for (const index of face) referencedVertexIndexes.add(index);
        faces.push({ layer: currentLayer(), style: activeStyle, face });
      }
    } else if (keyword === "l" && parts.length >= 3) {
      addObjPolyline(parts.slice(1));
    } else if (keyword === "curv" && parts.length >= 4) {
      addObjPolyline(parts.length >= 5 ? parts.slice(3) : parts.slice(1));
    } else if (keyword === "p" && parts.length >= 2) {
      const layer = currentLayer();
      const style = activeStyle;
      const indexes = parts.slice(1).map(objIndex).filter((index) => Number.isInteger(index) && index >= 0 && index < vertices.length);
      for (const index of indexes) referencedVertexIndexes.add(index);
      pointIndexes.push(...indexes.map((index) => ({ layer, style, index })));
    }
  }
  const doc = { lines: [], polylines: [], meshes: [], pointClouds: [], diagnostics: [] };
  let objPointBudget = Math.floor(options.maxPoints);
  let objSourcePoints = 0;
  let objStoredPoints = 0;
  const addObjPointCloud = (points, layer = options.layer, style = {}, indexes = []) => {
    if (!points.length) return;
    objSourcePoints += points.length;
    if (objPointBudget <= 0) return;
    const stride = Math.max(1, Math.floor(options.pointStride));
    const storedItems = [];
    for (let index = 0; index < points.length && storedItems.length < objPointBudget; index += 1) {
      if (index % stride === 0) storedItems.push({ point: points[index], sourceIndex: indexes[index] });
    }
    const stored = storedItems.map((item) => item.point);
    const storedIndexes = storedItems.map((item) => item.sourceIndex);
    if (!stored.length) return;
    objPointBudget -= stored.length;
    objStoredPoints += stored.length;
    doc.pointClouds.push({
      id: `${cleanId(path.basename(originalPath, path.extname(originalPath)))}_${cleanId(layer)}_points_${doc.pointClouds.length + 1}`,
      layer,
      color: style.color || objVertexColor(storedIndexes) || options.color,
      ...(finite(options.opacity) ? { opacity: options.opacity } : finite(style.opacity) ? { opacity: style.opacity } : {}),
      pointSize: options.pointSize,
      sourcePointCount: points.length,
      storedPointCount: stored.length,
      points: stored
    });
  };
  const addObjMesh = (layer, groupFaces, style = {}) => {
    const used = new Map();
    const meshVertices = [];
    const meshFaces = groupFaces.map((face) => face.map((index) => {
      if (!used.has(index)) {
        used.set(index, meshVertices.length);
        meshVertices.push(vertices[index]);
      }
      return used.get(index);
    })).filter((face) => face.length >= 3);
    if (meshVertices.length < 3 || !meshFaces.length) return;
    doc.meshes.push({
      id: `${cleanId(path.basename(originalPath, path.extname(originalPath)))}_${cleanId(layer)}_mesh_${doc.meshes.length + 1}`,
      layer,
      color: style.color || objVertexColor([...used.keys()]) || options.color,
      ...(finite(options.opacity) ? { opacity: options.opacity } : { opacity: finite(style.opacity) ? style.opacity : 0.22 }),
      vertices: meshVertices,
      faces: meshFaces
    });
  };
  for (const item of polylines) {
    const points = item.points.filter((point, index) => index === 0 || !point.every((value, axis) => Math.abs(value - item.points[index - 1][axis]) < 1e-9));
    if (points.length < 2 || (item.closed && points.length < 3)) continue;
    doc.polylines.push({
      id: `${cleanId(path.basename(originalPath, path.extname(originalPath)))}_line_${doc.polylines.length + 1}`,
      layer: item.layer,
      color: item.style?.color || objVertexColor(item.indexes) || options.color,
      ...(finite(options.opacity) ? { opacity: options.opacity } : finite(item.style?.opacity) ? { opacity: item.style.opacity } : {}),
      ...(item.closed ? { closed: true } : {}),
      points
    });
  }
  const pointGroups = new Map();
  for (const item of pointIndexes) {
    const point = vertices[item.index];
    if (!point) continue;
    const key = `${item.layer}|${objStyleKey(item.style)}`;
    if (!pointGroups.has(key)) pointGroups.set(key, { layer: item.layer, style: item.style, points: [], indexes: [] });
    pointGroups.get(key).points.push(point);
    pointGroups.get(key).indexes.push(item.index);
  }
  for (const group of pointGroups.values()) addObjPointCloud(group.points, group.layer, group.style, group.indexes);
  const looseVertexGroups = new Map();
  for (const item of vertexItems) {
    if (referencedVertexIndexes.has(item.index)) continue;
    const key = `${item.layer}|${objStyleKey(item.style)}`;
    if (!looseVertexGroups.has(key)) looseVertexGroups.set(key, { layer: item.layer, style: item.style, points: [], indexes: [] });
    looseVertexGroups.get(key).points.push(item.point);
    looseVertexGroups.get(key).indexes.push(item.index);
  }
  for (const group of looseVertexGroups.values()) addObjPointCloud(group.points, group.layer, group.style, group.indexes);
  if (vertices.length >= 3 && faces.length) {
    const byLayer = new Map();
    for (const item of faces) {
      const key = `${item.layer}|${objStyleKey(item.style)}`;
      if (!byLayer.has(key)) byLayer.set(key, { layer: item.layer, style: item.style, faces: [] });
      byLayer.get(key).faces.push(item.face);
    }
    for (const group of byLayer.values()) addObjMesh(group.layer, group.faces, group.style);
  } else if (!doc.polylines.length && !doc.pointClouds.length) doc.diagnostics.push(diagnostic("warning", "obj-no-mesh", "OBJ parsed, but no mesh faces were found"));
  const sidecar = finalize(doc, originalPath, format, options, outputPath, source);
  if (objSourcePoints !== objStoredPoints && doc.pointClouds.length) sidecar.source.counts = { ...sidecar.source.counts, sourcePoints: objSourcePoints, storedPoints: objStoredPoints };
  return sidecar;
}

function pointTextToken(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function pointTextDelimiterIndex(text, delimiter) {
  let quote = "";
  let parens = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === "\"" || char === "'") quote = char;
    else if (char === "(") parens += 1;
    else if (char === ")" && parens) parens -= 1;
    else if (!parens && text.startsWith(delimiter, index)) return index;
  }
  return -1;
}

function pointTextDelimitedFields(text, delimiter) {
  const fields = [];
  let token = "";
  let quote = "";
  let parens = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
      else token += char;
    } else if (char === "\"" || char === "'") quote = char;
    else if (char === "(") {
      parens += 1;
      token += char;
    } else if (char === ")" && parens) {
      parens -= 1;
      token += char;
    } else if (!parens && text.startsWith(delimiter, index)) {
      fields.push(token);
      token = "";
      index += delimiter.length - 1;
    } else token += char;
  }
  fields.push(token);
  return fields;
}

function pointTextFieldCount(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return 0;
  if (pointTextDelimiterIndex(trimmed, ";") >= 0) return pointTextDelimitedFields(trimmed, ";").filter((token) => pointTextToken(token)).length;
  const whitespaceDecimalComma = /[+-]?\d+,\d+(?:[ed][+-]?\d+)?\s+[+-]?\d+,\d+/i.test(trimmed);
  if (!whitespaceDecimalComma && pointTextDelimiterIndex(trimmed, ",") >= 0) return pointTextDelimitedFields(trimmed, ",").filter((token) => pointTextToken(token)).length;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function pointTextInlineCommentIndex(line) {
  const candidates = [];
  const semicolon = pointTextDelimiterIndex(line, ";");
  if (semicolon >= 0) candidates.push(semicolon);
  const slash = pointTextDelimiterIndex(line, "//");
  if (slash >= 0) candidates.push(slash);
  let hash = pointTextDelimiterIndex(line, "#");
  while (hash >= 0) {
    if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}(?:[0-9a-f]{2})?)(?:[\s,;]|$)/i.test(line.slice(hash))) candidates.push(hash);
    const next = pointTextDelimiterIndex(line.slice(hash + 1), "#");
    hash = next >= 0 ? hash + 1 + next : -1;
  }
  return candidates.filter((index) => pointTextFieldCount(line.slice(0, index)) >= 3).sort((a, b) => a - b)[0] ?? -1;
}

function pointTextTokens(line) {
  const commentIndex = pointTextInlineCommentIndex(line);
  const text = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const tokens = [];
  let token = "";
  let quote = "";
  let parens = 0;
  const semicolonDelimited = pointTextDelimiterIndex(text, ";") >= 0;
  const whitespaceDecimalComma = !semicolonDelimited && /[+-]?\d+,\d+(?:[ed][+-]?\d+)?\s+[+-]?\d+,\d+/i.test(text);
  const commaDelimited = !semicolonDelimited && !whitespaceDecimalComma && pointTextDelimiterIndex(text, ",") >= 0;
  const push = () => {
    const cleaned = pointTextToken(token);
    if (cleaned) tokens.push(cleaned);
    token = "";
  };
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = "";
      else token += char;
    } else if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === "(") {
      parens += 1;
      token += char;
    } else if (char === ")" && parens) {
      parens -= 1;
      token += char;
    } else if (!parens && (char === ";" || (commaDelimited && char === ",") || (!semicolonDelimited && !commaDelimited && /\s/.test(char)))) {
      push();
    } else {
      token += char;
    }
  }
  push();
  return tokens;
}

function pointTextHeaderIndexes(tokens, counts = null) {
  const rawKeys = tokens.map((token) => String(token || "").toLowerCase().replace(/^[^a-z]+|[^a-z0-9]+$/g, "").replace(/[^a-z0-9]+/g, ""));
  const marker = new Set(["fields", "columns", "cols"]).has(rawKeys[0]);
  const baseKeys = marker ? rawKeys.slice(1) : rawKeys;
  const keys = counts?.length === baseKeys.length
    ? baseKeys.flatMap((key, index) => Array(Math.max(1, Math.trunc(counts[index]) || 1)).fill(key))
    : baseKeys;
  const columnIndex = (aliases) => keys.findIndex((key) => aliases.has(key));
  const countedColor = (aliases) => {
    if (counts?.length !== baseKeys.length) return null;
    let cursor = 0;
    for (let index = 0; index < baseKeys.length; index += 1) {
      const count = Math.max(1, Math.trunc(counts[index]) || 1);
      if (aliases.has(baseKeys[index]) && count >= 3) return [cursor, cursor + 1, cursor + 2];
      cursor += count;
    }
    return null;
  };
  const colorIndex = (aliases) => keys.findIndex((key) => {
    if (aliases.has(key)) return true;
    for (const alias of aliases) {
      const suffix = key.startsWith(alias) ? key.slice(alias.length) : "";
      if (suffix && /^(?:\d+|bit|8bit|16bit|byte|u8|u16|uint8|uint16)$/.test(suffix)) return true;
    }
    return false;
  });
  const axisIndex = (axis, aliases) => {
    const unitSuffixes = new Set(["mm", "millimeter", "millimeters", "millimetre", "millimetres", "cm", "centimeter", "centimeters", "centimetre", "centimetres", "m", "meter", "meters", "metre", "metres", "km", "kilometer", "kilometers", "kilometre", "kilometres", "in", "inch", "inches", "ft", "foot", "feet", "yd", "yard", "yards", "od", "mod", "aod", "maod", "msl", "amsl"]);
    return keys.findIndex((key) => {
      if (!key) return false;
      if (aliases.has(key)) return true;
      for (const alias of aliases) {
        if (key.startsWith(alias) && unitSuffixes.has(key.slice(alias.length))) return true;
      }
      if (key.startsWith(axis) && unitSuffixes.has(key.slice(axis.length))) return true;
      return false;
    });
  };
  const x = axisIndex("x", new Set(["x", "xcoord", "xcoordinate", "xvalue", "xposition", "coordx", "coordinatex", "cartesianx", "posx", "positionx", "easting", "eastings", "grideasting", "grideastings", "gride", "localeasting", "localeastings", "locale", "siteeasting", "siteeastings", "siteeast", "sitee", "projecteasting", "projecteastings", "projecteast", "projecte", "planeasting", "planeastings", "planeast", "plane", "coordeast", "coordinateeast", "coorde", "coordinatee", "east", "e"]));
  const y = axisIndex("y", new Set(["y", "ycoord", "ycoordinate", "yvalue", "yposition", "coordy", "coordinatey", "cartesiany", "posy", "positiony", "northing", "northings", "gridnorthing", "gridnorthings", "gridn", "localnorthing", "localnorthings", "localn", "sitenorthing", "sitenorthings", "sitenorth", "siten", "projectnorthing", "projectnorthings", "projectnorth", "projectn", "plannorthing", "plannorthings", "plannorth", "plann", "coordnorth", "coordinatenorth", "coordn", "coordinaten", "north", "n"]));
  const z = axisIndex("z", new Set(["z", "zcoord", "zcoordinate", "zvalue", "zposition", "coordz", "coordinatez", "cartesianz", "posz", "positionz", "coordup", "coordinateup", "coordelevation", "coordinateelevation", "coordheight", "coordinateheight", "coordlevel", "coordinatelevel", "coordrl", "coordinaterl", "coordreducedlevel", "coordinatereducedlevel", "coordh", "coordinateh", "gridh", "localh", "siteh", "projecth", "planh", "gridrl", "localrl", "siterl", "projectrl", "planrl", "sitelevel", "sitelevels", "projectlevel", "projectlevels", "planlevel", "planlevels", "siteheight", "siteheights", "projectheight", "projectheights", "planheight", "planheights", "siteelevation", "siteelevations", "siteelev", "projectelevation", "projectelevations", "projectelev", "planelevation", "planelevations", "planelev", "up", "elevation", "elevations", "elev", "height", "heights", "heightaod", "heightsaod", "heightod", "heightsod", "heightmod", "heightsmod", "orthometricheight", "orthometricheights", "ellipsoidheight", "ellipsoidheights", "ellipsoidalheight", "ellipsoidalheights", "altitude", "altitudes", "alt", "h", "rl", "reducedlevel", "reducedlevels", "level", "levels", "levelaod", "levelsaod", "levelod", "levelsod", "levelmod", "levelsmod", "gridlevel", "gridlevels", "locallevel", "locallevels", "od", "mod", "aod", "maod", "ordnancedatum", "ordnancedatums", "msl", "amsl"]));
  const r = colorIndex(new Set(["r", "red", "colorr", "colorred", "colourr", "colourred", "rgbred"]));
  const g = colorIndex(new Set(["g", "green", "colorg", "colorgreen", "colourg", "colourgreen", "rgbgreen"]));
  const b = colorIndex(new Set(["b", "blue", "colorb", "colorblue", "colourb", "colourblue", "rgbblue"]));
  const intensity = colorIndex(new Set(["i", "int", "intensity", "intensityvalue", "reflectance", "reflectivity", "amplitude", "signal", "gray", "grey", "grayscale", "greyscale"]));
  const packedAliases = new Set(["rgb", "rgba", "packedrgb", "packedrgba", "color", "colour", "hex", "hexcolor", "colorhex", "colourhex"]);
  const countedRgb = countedColor(packedAliases);
  const packedRgb = countedRgb ? -1 : columnIndex(packedAliases);
  return x >= 0 && y >= 0 && z >= 0 ? { xyz: [x, y, z], rgb: r >= 0 && g >= 0 && b >= 0 ? [r, g, b] : countedRgb, packedRgb: packedRgb >= 0 ? packedRgb : null, ...(intensity >= 0 ? { intensity } : {}) } : null;
}

function pointTextNoHeaderRgbIndexes(rows, rgbMax = 255) {
  const colorRows = rows.filter((values) => values.length >= 6);
  if (!colorRows.length) return null;
  const looksLikeRgb = (values, indexes, max = 255) => indexes.every((index) => finite(values[index]) && values[index] >= 0 && values[index] <= max);
  const sevenColumnRows = colorRows.filter((values) => values.length >= 7 && values.slice(3, 7).every(finite));
  if (sevenColumnRows.length) {
    const rgbaBinary = sevenColumnRows.every((values) => values[6] === 1 && values.slice(3, 6).every((value) => value === 0 || value === 1));
    if (rgbaBinary) return { indexes: [3, 4, 5], layout: "xyz-rgb" };
    const rgbaOpaque = sevenColumnRows.every((values) => (values[6] === 255 || values[6] === 65535) && values.slice(3, 6).every((value) => value >= 0 && value <= values[6]));
    if (rgbaOpaque && sevenColumnRows.some((values) => values.slice(3, 6).some((value) => value > 1))) return { indexes: [3, 4, 5], layout: "xyz-rgba" };
    const rgbNormalized = sevenColumnRows.every((values) => values.slice(4, 7).every((value) => value >= 0 && value <= 1));
    const lastLooksLikeAlpha = sevenColumnRows.every((values) => values[6] >= 0 && values[6] <= 1);
    const rgbAfterIntensityHasSignal = sevenColumnRows.some((values) => values.slice(4, 7).some((value) => value > 1));
    const intensityLooksSeparate = rgbNormalized || !lastLooksLikeAlpha || (lastLooksLikeAlpha && rgbAfterIntensityHasSignal) || sevenColumnRows.every((values) => values[3] < 0 || values[3] > 255 || (values[3] >= 0 && values[3] <= 1));
    if (intensityLooksSeparate && sevenColumnRows.every((values) => looksLikeRgb(values, [4, 5, 6], 65535)) && (rgbNormalized || sevenColumnRows.some((values) => values.slice(4, 7).some((value) => value > 15)))) return { indexes: [4, 5, 6], layout: "xyz-intensity-rgb" };
  }
  return colorRows.every((values) => looksLikeRgb(values, [3, 4, 5], rgbMax)) ? { indexes: [3, 4, 5], layout: "xyz-rgb" } : null;
}

function pointTextNoHeaderPackedRgbIndex(rows) {
  if (rows.length < 2) return -1;
  for (const index of [3, 4]) {
    const values = rows.map((row) => row.values[index]);
    const tokens = rows.map((row) => String(row.tokens[index] || "").trim());
    if (values.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffff)
      && values.some((value) => value > 0xffff)
      && tokens.every((token) => /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token))) return index;
  }
  return -1;
}

function pointTextRgbLayout(headerIndexes, noHeaderLayout) {
  if (headerIndexes?.rgb) return { indexes: headerIndexes.rgb, layout: "header-rgb" };
  if (Number.isInteger(headerIndexes?.packedRgb)) return { packedIndex: headerIndexes.packedRgb, layout: "header-rgb-packed" };
  return headerIndexes ? null : noHeaderLayout;
}

function pointTextRowPrefix(value) {
  const prefix = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return POINT_TEXT_ROW_PREFIXES.has(prefix)
    || /^(?:p|pt|pnt|point|station|sta|stn|cp|control|controlpoint|bm|benchmark|tbm|target|tgt|node|vertex|v|xyz)\d+$/.test(prefix)
    || (/[a-z]/.test(prefix) && /\d/.test(prefix));
}

function pointTextData(tokens, headerIndexes, rowIndex = null, declaredPointCount = null) {
  const values = tokens.map(number);
  if (headerIndexes) return { tokens, values };
  const shifted = () => ({ tokens: tokens.slice(1), values: values.slice(1) });
  const numericId = Number.isInteger(values[0]) && (values[0] === rowIndex || values[0] === rowIndex + 1);
  if (Number.isInteger(declaredPointCount) && declaredPointCount > 1 && values.length >= 4 && numericId && values.slice(1, 4).every(finite)) {
    const shiftedValues = values.slice(1, 4);
    const tinySequence = shiftedValues.every((value, index) => value === values[0] + index + 1);
    if (!tinySequence || Math.max(...shiftedValues.map(Math.abs)) > declaredPointCount * 10) return shifted();
  }
  if (values.slice(0, 3).every(finite)) return { tokens, values };
  return pointTextRowPrefix(tokens[0]) && values.slice(1, 4).every(finite) ? shifted() : { tokens, values };
}

function pointTextPackedRgb(value, floatPacked = false) {
  const text = String(value || "").trim().replace(/^[a-z][a-z0-9_-]*\s*[:=]\s*/i, "");
  const css = /^rgba?\((.*)\)$/i.exec(text);
  if (css) {
    const channels = css[1].replace("/", " ").split(/[,\s]+/).filter(Boolean).slice(0, 3).map((token) => {
      const percent = token.endsWith("%");
      const value = number(percent ? token.slice(0, -1) : token);
      return finite(value) ? (percent ? value * 255 / 100 : value) : null;
    });
    if (channels.length === 3 && channels.every(finite)) return channels;
  }
  let hash = /^(?:#|0x)?([0-9a-f]{3,4}|[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i.exec(text);
  if (hash && !/^(?:#|0x)/i.test(text) && !/[a-f]/i.test(text)) hash = null;
  if (hash) {
    let full = hash[1].toLowerCase();
    if (full.length === 3 || full.length === 4) full = full.slice(0, 3).split("").map((char) => char + char).join("");
    const argb = full.length === 8 && (full.startsWith("ff") || full.startsWith("00")) && full.endsWith("00") && full.slice(2, 8) !== "000000";
    const hex = argb ? full.slice(2, 8) : full.slice(0, 6);
    return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  }
  const numeric = typeof value === "number" ? value : number(text);
  if (!finite(numeric)) return null;
  let packed = Math.trunc(numeric);
  if (!floatPacked && Number.isInteger(numeric) && numeric >= -0x80000000 && numeric <= 0xffffffff) {
    packed = (numeric >>> 0) & 0xffffff;
  } else {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeFloatLE(numeric, 0);
    packed = buffer.readUInt32LE(0) & 0xffffff;
  }
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

function parseXyz(sourcePath, originalPath, format, options, outputPath, source = {}) {
  const { pointTextRgbMax, ...sourceMetadata } = source;
  const points = [];
  let valid = 0;
  let headerIndexes = null;
  let pcdHeaderTokens = null;
  let pcdCounts = null;
  let pcdTypes = null;
  let pcdWidth = null;
  let pcdHeight = null;
  let pcdDeclaredPoints = null;
  let pointTextDeclaredPoints = null;
  let colorCount = 0;
  let colorMax = 0;
  const colorSum = [0, 0, 0];
  let intensityCount = 0;
  let intensityMax = 0;
  let intensitySum = 0;
  const colorRows = [];
  const max = Math.floor(options.maxPoints);
  const stride = Math.max(1, Math.floor(options.pointStride));
  const text = readTextFile(sourcePath);
  const pcdSource = /\.pcd$/i.test(originalPath) || sourceMetadata.intermediateFormat === "pcd";
  const pcdTypeAt = (index) => {
    if (!pcdTypes) return "";
    if (!pcdCounts || pcdCounts.length !== pcdTypes.length) return pcdTypes[index] || "";
    let cursor = 0;
    for (let typeIndex = 0; typeIndex < pcdTypes.length; typeIndex += 1) {
      cursor += pcdCounts[typeIndex] || 1;
      if (index < cursor) return pcdTypes[typeIndex] || "";
    }
    return "";
  };
  let pcdUnsupportedData = "";
  for (const raw of textLines(text)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const commentHeader = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed.startsWith("//") ? trimmed.slice(2).trim() : "";
    if (commentHeader && !headerIndexes && valid === 0) {
      const tokens = pointTextTokens(commentHeader);
      const candidateHeaderIndexes = pointTextHeaderIndexes(tokens, pcdCounts);
      if (candidateHeaderIndexes) headerIndexes = candidateHeaderIndexes;
    }
    if (commentHeader) continue;
    const pcdData = pcdSource ? /^data\s+(\S+)/i.exec(trimmed) : null;
    if (pcdData && pcdData[1].toLowerCase() !== "ascii") {
      pcdUnsupportedData = pcdData[1];
      break;
    }
    if (pcdData) continue;
    const tokens = pointTextTokens(trimmed);
    const pcdKeyword = pcdSource ? String(tokens[0] || "").toLowerCase() : "";
    if (!pcdSource && !headerIndexes && valid === 0 && tokens.length === 1) {
      const value = Math.trunc(number(tokens[0]));
      if (value > 0) {
        pointTextDeclaredPoints = value;
        continue;
      }
    }
    if (pcdKeyword === "type") {
      pcdTypes = tokens.slice(1).map((token) => String(token || "").toLowerCase());
      continue;
    }
    if (pcdSource && new Set(["version", "size", "viewpoint"]).has(pcdKeyword)) continue;
    if (pcdKeyword === "width" || pcdKeyword === "height" || pcdKeyword === "points") {
      const value = Math.trunc(number(tokens[1]));
      if (value > 0 && pcdKeyword === "width") pcdWidth = value;
      else if (value > 0 && pcdKeyword === "height") pcdHeight = value;
      else if (value > 0) pcdDeclaredPoints = value;
      if (!pcdDeclaredPoints && pcdWidth && pcdHeight) pcdDeclaredPoints = pcdWidth * pcdHeight;
      continue;
    }
    if (pcdKeyword === "count") {
      pcdCounts = tokens.slice(1).map((token) => Math.max(1, Math.trunc(number(token)) || 1));
      if (pcdHeaderTokens) headerIndexes = pointTextHeaderIndexes(pcdHeaderTokens, pcdCounts);
      continue;
    }
    if (!headerIndexes && valid === 0) {
      const candidateHeaderIndexes = pointTextHeaderIndexes(tokens, pcdCounts);
      if (candidateHeaderIndexes) {
        headerIndexes = candidateHeaderIndexes;
        if (pcdSource && new Set(["fields", "columns", "cols"]).has(pcdKeyword)) pcdHeaderTokens = tokens;
        continue;
      }
    }
    const data = pointTextData(tokens, headerIndexes, valid, pointTextDeclaredPoints);
    const { values } = data;
    const xyz = headerIndexes ? headerIndexes.xyz.map((index) => values[index]) : values.slice(0, 3);
    if (xyz.length < 3 || !xyz.every(finite)) continue;
    valid += 1;
    if ((valid - 1) % stride !== 0) continue;
    if (points.length >= max) continue;
    points.push(transformPoint(xyz, options, format));
    colorRows.push(data);
  }
  const noHeaderRgbLayout = pointTextNoHeaderRgbIndexes(colorRows.map((row) => row.values), pointTextRgbMax);
  const noHeaderPackedRgbIndex = !headerIndexes && !noHeaderRgbLayout && colorRows.length
    ? [3, 4].find((index) => colorRows.every((row) => row.tokens.length > index && packedRgbToken(row.tokens[index]))) ?? pointTextNoHeaderPackedRgbIndex(colorRows)
    : -1;
  const noHeaderPackedRgbLayout = noHeaderPackedRgbIndex === 4 ? "xyz-intensity-rgb-packed" : "xyz-rgb-packed";
  const intensityLayout = Number.isInteger(headerIndexes?.intensity)
    ? { index: headerIndexes.intensity, layout: "header-intensity" }
    : !headerIndexes && !noHeaderRgbLayout && noHeaderPackedRgbIndex < 0 && colorRows.length && colorRows.every((row) => finite(row.values[3]) && row.values[3] >= 0 && row.values[3] <= 65535)
      ? { index: 3, layout: "xyz-intensity" }
      : null;
  let colorLayout = "";
  for (const row of colorRows) {
    const { tokens, values } = row;
    const rgbLayout = pointTextRgbLayout(headerIndexes, noHeaderRgbLayout);
    const packedFloat = pcdSource && rgbLayout?.packedIndex !== undefined && pcdTypeAt(rgbLayout.packedIndex) === "f";
    const rgb = rgbLayout?.packedIndex !== undefined ? pointTextPackedRgb(tokens[rgbLayout.packedIndex] || values[rgbLayout.packedIndex], packedFloat)
      : noHeaderPackedRgbIndex >= 0 ? pointTextPackedRgb(tokens[noHeaderPackedRgbIndex])
        : rgbLayout ? rgbLayout.indexes.map((index) => values[index]) : null;
    if (!options.colorExplicit && rgb?.length === 3 && rgb.every(finite)) {
      colorLayout = rgbLayout?.layout || noHeaderPackedRgbLayout;
      colorSum[0] += rgb[0];
      colorSum[1] += rgb[1];
      colorSum[2] += rgb[2];
      colorMax = Math.max(colorMax, ...rgb);
      colorCount += 1;
    }
    const intensity = intensityLayout ? values[intensityLayout.index] : null;
    if (!options.colorExplicit && finite(intensity) && intensity >= 0) {
      intensitySum += intensity;
      intensityMax = Math.max(intensityMax, intensity);
      intensityCount += 1;
    }
  }
  const doc = { lines: [], polylines: [], meshes: [], pointClouds: [], diagnostics: [] };
  const averageColor = averageRgbColor(colorSum, colorCount, colorMax) || averageScalarColor(intensitySum, intensityCount, intensityMax);
  const declaredPointCount = pcdSource && Number.isInteger(pcdDeclaredPoints) ? pcdDeclaredPoints : pointTextDeclaredPoints;
  const sourcePointCount = Number.isInteger(declaredPointCount) ? Math.max(valid, declaredPointCount) : valid;
  if (points.length) {
    doc.pointClouds.push({
      id: `${cleanId(path.basename(originalPath, path.extname(originalPath)))}_points`,
      layer: options.layer,
      color: averageColor || options.color,
      ...(finite(options.opacity) ? { opacity: options.opacity } : {}),
      pointSize: options.pointSize,
      sourcePointCount,
      storedPointCount: points.length,
      points
    });
  } else if (pcdUnsupportedData) {
    doc.diagnostics.push(diagnostic("warning", "pcd-data-unsupported", `PCD DATA ${pcdUnsupportedData} is not supported by this lightweight text translator; export DATA ascii, XYZ/PTS/CSV, or E57.`));
  } else {
    doc.diagnostics.push(diagnostic("warning", "point-text-no-points", "Point text parsed, but no XYZ rows were found"));
  }
  return finalize(doc, originalPath, format, options, outputPath, {
    ...sourceMetadata,
    ...(pcdSource && Number.isInteger(pcdDeclaredPoints) ? { pcdDeclaredPoints } : {}),
    ...(!pcdSource && Number.isInteger(pointTextDeclaredPoints) ? { pointTextDeclaredPoints } : {}),
    ...(averageColor ? {
      pointTextAverageColor: averageColor,
      ...(colorCount ? { pointTextColorPointCount: colorCount, pointTextColorLayout: colorLayout } : { pointTextIntensityPointCount: intensityCount, pointTextColorLayout: intensityLayout?.layout })
    } : {})
  });
}

function quotedPathValue(value) {
  return String(value || "").replace(/^(["'])|(["'])$/g, "");
}

function candidateFilesFromEnv(names) {
  return names.flatMap((name) => {
    const raw = process.env[name];
    if (!raw) return [];
    return raw.split(path.delimiter).map(quotedPathValue);
  });
}

function pathExecutables(commandNames) {
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  const dirs = String(process.env.PATH || "").split(path.delimiter);
  const out = [];
  for (const dir of dirs) {
    for (const command of commandNames) {
      for (const ext of exts) out.push(path.join(dir, command.endsWith(ext) ? command : `${command}${ext}`));
    }
  }
  return out;
}

function childrenMatching(parent, pattern, childPath = "") {
  try {
    return fs.readdirSync(parent, { withFileTypes: true })
      .filter((item) => item.isDirectory() && pattern.test(item.name))
      .map((item) => path.join(parent, item.name, childPath));
  } catch {
    return [];
  }
}

function resolveExecutable({ env = [], names = [], common = [] }) {
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  const candidates = [...candidateFilesFromEnv(env), ...common, ...pathExecutables(names)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const expanded = candidate.replace(/^~(?=$|[\\/])/, os.homedir());
    const checks = [];
    try {
      const stat = fs.existsSync(expanded) ? fs.statSync(expanded) : null;
      if (stat?.isDirectory()) {
        for (const name of names) for (const ext of exts) checks.push(path.join(expanded, name.endsWith(ext) ? name : `${name}${ext}`));
        for (const name of names) for (const ext of exts) checks.push(path.join(expanded, "bin", name.endsWith(ext) ? name : `${name}${ext}`));
      } else {
        checks.push(expanded);
        for (const ext of exts) checks.push(expanded.endsWith(ext) ? expanded : `${expanded}${ext}`);
      }
    } catch {
      checks.push(expanded);
    }
    const found = checks.find((item) => fs.existsSync(item));
    if (found) return found;
  }
  return "";
}

function converterSpecs() {
  const programFiles = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)"
  ].filter(Boolean);
  const oda = programFiles.flatMap((base) => [
    ...childrenMatching(path.join(base, "ODA"), /ODAFileConverter/i, "ODAFileConverter.exe"),
    path.join(base, "ODA", "ODAFileConverter", "ODAFileConverter.exe")
  ]);
  const freecad = programFiles.flatMap((base) => [
    ...childrenMatching(base, /^FreeCAD/i, path.join("bin", "FreeCADCmd.exe")),
    path.join(base, "FreeCAD 1.1", "bin", "FreeCADCmd.exe")
  ]);
  return {
    ODAFileConverter: { env: ["BOBERCAD_ODA_FILE_CONVERTER", "BOBERCAD_ODAFILECONVERTER", "BOBERCAD_ODA_CONVERTER"], names: ["ODAFileConverter", "ODAFileConverter_QT5", "TeighaFileConverter"], common: oda, formats: "DWG" },
    FreeCADCmd: { env: ["BOBERCAD_FREECADCMD", "BOBERCAD_FREECAD_CMD", "BOBERCAD_FREECAD"], names: ["FreeCADCmd"], common: freecad, formats: "STEP" },
    IfcConvert: { env: ["BOBERCAD_IFCCONVERT", "BOBERCAD_IFC_CONVERT"], names: ["IfcConvert"], common: [], formats: "IFC" },
    assimp: { env: ["BOBERCAD_ASSIMP", "BOBERCAD_ASSIMP_PATH"], names: ["assimp"], common: [], formats: "STEP/IFC" },
    pdal: { env: ["BOBERCAD_PDAL", "BOBERCAD_PDAL_PATH"], names: ["pdal"], common: [], formats: "E57" }
  };
}

function pythonCommand() {
  return quotedPathValue(process.env.BOBERCAD_PYTHON || process.env.PYTHON || "python");
}

function pythonModuleAvailable(moduleName) {
  const python = pythonCommand();
  const result = spawnSync(python, ["-c", `import ${moduleName}`], { encoding: "utf8", timeout: 10000 });
  return result.status === 0;
}

function checkConverters() {
  const specs = converterSpecs();
  for (const [name, spec] of Object.entries(specs)) {
    const resolved = resolveExecutable(spec);
    console.log(`${resolved ? "OK" : "MISSING"} ${name} [${spec.formats}]: ${resolved || spec.names[0]}${spec.env?.length ? ` (env: ${spec.env.join("|")})` : ""}`);
  }
  const python = pythonCommand();
  console.log(`${pythonModuleAvailable("ifcopenshell") ? "OK" : "MISSING"} IfcOpenShell [IFC]: ${python} -c "import ifcopenshell" (env: BOBERCAD_PYTHON|PYTHON)`);
  console.log(`${pythonModuleAvailable("pye57") ? "OK" : "MISSING"} Pye57 [E57/E57POINTCLOUD]: ${python} -c "import pye57" (env: BOBERCAD_PYTHON|PYTHON)`);
}

function run(command, args, options) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.converterTimeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 32
  });
}

function runFailed(name, result, missingOutput = false) {
  const error = String(result.error?.message || "").trim();
  const signal = String(result.signal || "").trim();
  const stderr = String(result.stderr || "").trim();
  const stdout = String(result.stdout || "").trim();
  const missing = missingOutput && result.status === 0 ? "converter exited successfully but did not produce a usable output file" : "";
  const detail = error || missing || stderr || stdout || (result.status === 0 ? "converter exited successfully but did not produce a usable output file" : "");
  const status = `exit ${result.status ?? "unknown"}${signal ? ` signal ${signal}` : ""}`;
  return diagnostic("warning", "converter-failed", `${name} failed with ${status}${detail ? `: ${detail.slice(0, 700)}` : ""}`);
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function firstFileWithExtension(root, extension) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const itemPath = path.join(current, item.name);
      if (item.isDirectory()) stack.push(itemPath);
      else if (item.name.toLowerCase().endsWith(extension) && fs.statSync(itemPath).size > 0) return itemPath;
    }
  }
  return "";
}

function zipEntries(data) {
  let eocd = -1;
  for (let index = Math.max(0, data.length - 0xffff - 22); index <= data.length - 22; index += 1) {
    if (data.readUInt32LE(index) === 0x06054b50) eocd = index;
  }
  if (eocd < 0) return { error: "ZIP end-of-central-directory record was not found", entries: [] };
  const entries = data.readUInt16LE(eocd + 10);
  const centralSize = data.readUInt32LE(eocd + 12);
  let offset = data.readUInt32LE(eocd + 16);
  const centralEnd = offset + centralSize;
  if (entries === 0xffff || centralSize === 0xffffffff || offset === 0xffffffff) return { error: "ZIP64 archives are not supported by this lightweight translator; extract the source payload first", entries: [] };
  if (entries > 0 && (offset + 46 > data.length || centralEnd > eocd)) return { error: "ZIP central directory is truncated", entries: [] };
  const candidates = [];
  let parsedEntries = 0;
  for (let entryIndex = 0; entryIndex < entries && offset + 46 <= centralEnd; entryIndex += 1) {
    parsedEntries += 1;
    const directoryOffset = offset;
    if (data.readUInt32LE(offset) !== 0x02014b50) return { error: "ZIP central directory is malformed" };
    const flags = data.readUInt16LE(offset + 8);
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const uncompressedSize = data.readUInt32LE(offset + 24);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > centralEnd) return { error: "ZIP central directory is truncated", entries: [] };
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString(flags & 0x800 ? "utf8" : "latin1");
    offset += 46 + nameLength + extraLength + commentLength;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) return { error: "ZIP64 archives are not supported by this lightweight translator; extract the source payload first", entries: [] };
    if (name && !name.endsWith("/") && !/(^|\/)__MACOSX\//.test(name)) candidates.push({ name, flags, method, compressedSize, uncompressedSize, localOffset, directoryOffset });
  }
  if (parsedEntries < entries) return { error: "ZIP central directory is truncated", entries: [] };
  return { entries: candidates };
}

function zipEntryPayload(data, entry, label) {
  if (entry.flags & 1) return { error: `Encrypted ZIP ${label} archives are not supported` };
  if (entry.method !== 0 && entry.method !== 8) return { error: `ZIP compression method ${entry.method} is not supported` };
  if (entry.localOffset + 30 > data.length || data.readUInt32LE(entry.localOffset) !== 0x04034b50) return { error: "ZIP local file header is malformed" };
  const nameLength = data.readUInt16LE(entry.localOffset + 26);
  const extraLength = data.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (Number.isFinite(entry.directoryOffset) && start > entry.directoryOffset) return { error: "ZIP local file header is truncated" };
  if (Number.isFinite(entry.directoryOffset) && end > entry.directoryOffset) return { error: `ZIP ${label} payload is truncated` };
  if (end > data.length) return { error: `ZIP ${label} payload is truncated` };
  try {
    const payload = entry.method === 8 ? zlib.inflateRawSync(data.subarray(start, end)) : Buffer.from(data.subarray(start, end));
    return { buffer: payload, name: entry.name };
  } catch (error) {
    return { error: `ZIP ${label} payload could not be inflated: ${error?.message || String(error)}` };
  }
}

function zipEntryBuffer(data, namePattern, label, fallbackFormat = "") {
  const parsed = zipEntries(data);
  if (parsed.error) return { error: parsed.error };
  const entries = parsed.entries.slice().sort((a, b) => (b.uncompressedSize || b.compressedSize) - (a.uncompressedSize || a.compressedSize));
  let entry = entries.find((item) => namePattern.test(item.name));
  if (!entry && fallbackFormat) {
    for (const candidate of entries) {
      const payload = zipEntryPayload(data, candidate, label);
      if (payload.buffer && payloadFormatFromBuffer(payload.buffer) === fallbackFormat) return payload;
    }
  }
  if (!entry) return { error: `ZIP archive did not contain a ${label} file` };
  return zipEntryPayload(data, entry, label);
}

function cadInput(input, dir, extension, label) {
  const head = fileHead(input);
  const gzipLike = new RegExp(`\\.${extension}(?:\\.gz|gz)$`, "i").test(input) || (head[0] === 0x1f && head[1] === 0x8b);
  const zipLike = new RegExp(`\\.${extension}(?:zip|[-_]zip|\\.zip)$`, "i").test(input) || (head[0] === 0x50 && head[1] === 0x4b);
  if (!gzipLike && !zipLike) {
    if (!new RegExp(`\\.${extension}$`, "i").test(input) && payloadFormatFromBuffer(head) === extension) {
      const target = path.join(dir, `source.${extension}`);
      fs.copyFileSync(input, target);
      return { path: target };
    }
    return { path: input };
  }
  const data = fs.readFileSync(input);
  const errors = [];
  for (const kind of zipLike ? ["zip", "gzip"] : ["gzip", "zip"]) {
    if (kind === "gzip" && !gzipLike && !zipLike) continue;
    if (kind === "zip" && !zipLike) continue;
    try {
      const result = kind === "gzip" ? { buffer: zlib.gunzipSync(data) } : zipEntryBuffer(data, new RegExp(`\\.${extension}$`, "i"), label, extension);
      if (result.error) {
        errors.push(`${kind}: ${result.error}`);
        continue;
      }
      const target = path.join(dir, `source.${extension}`);
      fs.writeFileSync(target, result.buffer);
      return { path: target, compression: kind, ...(result.name ? { archiveEntry: result.name } : {}) };
    } catch (error) {
      errors.push(`${kind}: ${error?.message || String(error)}`);
    }
  }
  return { error: `Compressed ${label} could not be decompressed as gzip or zip: ${errors.join("; ")}`, compression: zipLike ? "zip" : "gzip" };
}

function stepPayloadExtension(value = "", buffer = null) {
  const lower = String(value || "").toLowerCase();
  for (const ext of ["stepnc", "stpnc", "stpx", "step", "stp", "ste", "p21"]) {
    if (new RegExp(`\\.${ext}(?:z|zip|[-_]zip|\\.z|\\.gz|\\.zip)?$`, "i").test(lower)) return `.${ext}`;
  }
  if (buffer && /<(?:[a-z_][\w.-]*:)?iso_10303_28\b/i.test(textFromBuffer(buffer.subarray(0, Math.min(buffer.length, 65536))))) return ".stpx";
  return ".step";
}

function ifcPayloadExtension(value = "", buffer = null) {
  const lower = String(value || "").toLowerCase();
  if (/\.ifcxml(?:zip|[-_]zip|\.zip|gz|\.gz)?$/i.test(lower)) return ".ifcxml";
  if (buffer && /<(?:[a-z_][\w.-]*:)?ifcxml\b/i.test(textFromBuffer(buffer.subarray(0, Math.min(buffer.length, 65536))))) return ".ifcxml";
  return ".ifc";
}

function stepInput(input, dir) {
  const head = fileHead(input);
  const gzipLike = /\.(step|stp|ste|p21|stpx|stpnc|stepnc)(?:\.z|\.gz)$/i.test(input) || (head[0] === 0x1f && head[1] === 0x8b);
  const zipLike = /\.(step|stp|ste|p21|stpx|stpnc|stepnc)(?:z|zip|[-_]zip|\.zip)$/i.test(input) || (head[0] === 0x50 && head[1] === 0x4b);
  const compressed = gzipLike || zipLike;
  if (!compressed) {
    if (!/\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)$/i.test(input) && payloadFormatFromBuffer(head) === "step") {
      const target = path.join(dir, `source${stepPayloadExtension(input, head)}`);
      fs.copyFileSync(input, target);
      return { path: target };
    }
    return { path: input };
  }
  const data = fs.readFileSync(input);
  const errors = [];
  for (const kind of zipLike ? ["zip", "gzip"] : ["gzip", "zip"]) {
    if (kind === "gzip" && !gzipLike && !zipLike) continue;
    if (kind === "zip" && !zipLike) continue;
    try {
      const result = kind === "gzip" ? { buffer: zlib.gunzipSync(data) } : zipEntryBuffer(data, /\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)$/i, "STEP", "step");
      if (result.error) {
        errors.push(`${kind}: ${result.error}`);
        continue;
      }
      const target = path.join(dir, `source${stepPayloadExtension(result.name || input, result.buffer)}`);
      fs.writeFileSync(target, result.buffer);
      return { path: target, compression: kind, ...(result.name ? { archiveEntry: result.name } : {}) };
    } catch (error) {
      errors.push(`${kind}: ${error?.message || String(error)}`);
    }
  }
  return { error: `Compressed STEP could not be decompressed as gzip or zip: ${errors.join("; ")}`, compression: zipLike ? "zip" : "gzip" };
}

function ifcInput(input, dir) {
  const head = fileHead(input);
  const gzipLike = /\.(?:ifc|ifcxml)(?:\.gz|gz)$/i.test(input) || (head[0] === 0x1f && head[1] === 0x8b);
  const zipLike = /\.(?:ifc|ifcxml)(?:zip|[-_]zip|\.zip)$/i.test(input) || (head[0] === 0x50 && head[1] === 0x4b);
  if (!gzipLike && !zipLike) {
    if (!/\.(?:ifc|ifcxml)$/i.test(input) && payloadFormatFromBuffer(head) === "ifc") {
      const target = path.join(dir, `source${ifcPayloadExtension(input, head)}`);
      fs.copyFileSync(input, target);
      return { path: target };
    }
    return { path: input };
  }
  const data = fs.readFileSync(input);
  const errors = [];
  for (const kind of zipLike ? ["zip", "gzip"] : ["gzip", "zip"]) {
    if (kind === "gzip" && !gzipLike && !zipLike) continue;
    if (kind === "zip" && !zipLike) continue;
    try {
      const result = kind === "gzip" ? { buffer: zlib.gunzipSync(data) } : zipEntryBuffer(data, /\.(?:ifc|ifcxml)$/i, "IFC", "ifc");
      if (result.error) {
        errors.push(`${kind}: ${result.error}`);
        continue;
      }
      const target = path.join(dir, `source${ifcPayloadExtension(result.name || input, result.buffer)}`);
      fs.writeFileSync(target, result.buffer);
      return { path: target, compression: kind, ...(result.name ? { archiveEntry: result.name } : {}) };
    } catch (error) {
      errors.push(`${kind}: ${error?.message || String(error)}`);
    }
  }
  return { error: `Compressed IFC could not be decompressed as gzip or zip: ${errors.join("; ")}`, compression: zipLike ? "zip" : "gzip" };
}

function e57Input(input, dir) {
  const head = fileHead(input);
  const gzipLike = /\.e57(?:\.gz|gz|[._-]?point[._-]?cloud(?:gz|\.gz))$/i.test(input) || (head[0] === 0x1f && head[1] === 0x8b);
  const zipLike = /\.e57(?:zip|[-_]zip|\.zip|[._-]?point[._-]?cloud(?:zip|[-_]zip|\.zip))$/i.test(input) || (head[0] === 0x50 && head[1] === 0x4b);
  if (!gzipLike && !zipLike) {
    if (!/\.e57$/i.test(input) && (/\.e57[._-]?point[._-]?cloud$/i.test(input) || payloadFormatFromBuffer(head) === "e57")) {
      const target = path.join(dir, "source.e57");
      fs.copyFileSync(input, target);
      return { path: target };
    }
    return { path: input };
  }
  const data = fs.readFileSync(input);
  const errors = [];
  for (const kind of zipLike ? ["zip", "gzip"] : ["gzip", "zip"]) {
    if (kind === "gzip" && !gzipLike && !zipLike) continue;
    if (kind === "zip" && !zipLike) continue;
    try {
      const result = kind === "gzip" ? { buffer: zlib.gunzipSync(data) } : zipEntryBuffer(data, /\.e57(?:[._-]?point[._-]?cloud)?$/i, "E57", "e57");
      if (result.error) {
        errors.push(`${kind}: ${result.error}`);
        continue;
      }
      const target = path.join(dir, "source.e57");
      fs.writeFileSync(target, result.buffer);
      return { path: target, compression: kind, ...(result.name ? { archiveEntry: result.name } : {}) };
    } catch (error) {
      errors.push(`${kind}: ${error?.message || String(error)}`);
    }
  }
  return { error: `Compressed E57 could not be decompressed as gzip or zip: ${errors.join("; ")}`, compression: zipLike ? "zip" : "gzip" };
}

function pointTextExtension(value = "", buffer = null) {
  if (/\.pcd(?:gz|zip|[-_]zip|\.gz|\.zip)?$/i.test(String(value || ""))) return ".pcd";
  if (buffer && pcdPayloadLooksLike(textFromBuffer(buffer.subarray(0, Math.min(buffer.length, 65536))))) return ".pcd";
  return ".xyz";
}

function pointTextInput(input, dir) {
  const head = fileHead(input);
  const gzipLike = /\.(?:xyz|pts|asc|txt|csv|pcd)(?:\.gz|gz)$/i.test(input) || (head[0] === 0x1f && head[1] === 0x8b);
  const zipLike = /\.(?:xyz|pts|asc|txt|csv|pcd)(?:zip|[-_]zip|\.zip)$/i.test(input) || (head[0] === 0x50 && head[1] === 0x4b);
  if (!gzipLike && !zipLike) return { path: input, intermediateFormat: pointTextExtension(input, head) === ".pcd" ? "pcd" : "xyz" };
  const data = fs.readFileSync(input);
  const errors = [];
  for (const kind of zipLike ? ["zip", "gzip"] : ["gzip", "zip"]) {
    if (kind === "gzip" && !gzipLike && !zipLike) continue;
    if (kind === "zip" && !zipLike) continue;
    try {
      const pattern = /\.txt(?:zip|[-_]zip|\.zip)$/i.test(input) ? /\.(?:xyz|pts|asc|txt|csv|pcd)$/i : /\.(?:xyz|pts|asc|csv|pcd)$/i;
      const result = kind === "gzip" ? { buffer: zlib.gunzipSync(data) } : zipEntryBuffer(data, pattern, "point text", "xyz");
      if (result.error) {
        errors.push(`${kind}: ${result.error}`);
        continue;
      }
      const extension = pointTextExtension(result.name || input, result.buffer);
      const target = path.join(dir, `source${extension}`);
      fs.writeFileSync(target, result.buffer);
      return { path: target, intermediateFormat: extension === ".pcd" ? "pcd" : "xyz", compression: kind, ...(result.name ? { archiveEntry: result.name } : {}) };
    } catch (error) {
      errors.push(`${kind}: ${error?.message || String(error)}`);
    }
  }
  return { error: `Compressed point text could not be decompressed as gzip or zip: ${errors.join("; ")}`, compression: zipLike ? "zip" : "gzip" };
}

function translateDwg(input, options, outputPath, source = {}) {
  const dir = tempDir("bobercad-dwg-");
  try {
    const sourceInput = cadInput(input, dir, "dwg", "DWG");
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "dwg-decompress-failed"), input, "dwg", options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const originalPath = source.originalPath || input;
    const inheritedSource = { ...source };
    delete inheritedSource.originalPath;
    const sourceMeta = sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {};
    if (!hasDwgSignature(sourceInput.path) && payloadFormatFromBuffer(fileHead(sourceInput.path)) === "dxf") {
      return translateDxf(sourceInput.path, options, "dxf", { originalPath, outputPath, source: { detectedFormat: "dxf", extensionFormat: "dwg", ...inheritedSource, ...sourceMeta } });
    }
    const oda = resolveExecutable(converterSpecs().ODAFileConverter);
    if (!oda) return finalize(emptyDoc("DWG needs ODA File Converter. Export to DXF or set BOBERCAD_ODA_FILE_CONVERTER.", "converter-missing"), originalPath, "dwg", options, outputPath, { ...inheritedSource, ...sourceMeta });
    const inputDir = path.join(dir, "in");
    const outputDir = path.join(dir, "out");
    fs.mkdirSync(inputDir);
    fs.mkdirSync(outputDir);
    const dwgPath = path.join(inputDir, "source.dwg");
    fs.copyFileSync(sourceInput.path, dwgPath);
    const result = run(oda, [inputDir, outputDir, "ACAD2018", "DXF", "0", "1", "*.dwg"], options);
    const dxfPath = firstFileWithExtension(outputDir, ".dxf");
    if (result.status !== 0 || !dxfPath) {
      const doc = emptyDoc("ODA File Converter did not produce DXF.", "converter-empty");
      doc.diagnostics.push(runFailed("ODAFileConverter", result, !dxfPath));
      return finalize(doc, originalPath, "dwg", options, outputPath, { converter: "ODAFileConverter", ...inheritedSource, ...sourceMeta });
    }
    return translateDxf(dxfPath, options, "dwg", { originalPath, outputPath, source: { converter: "ODAFileConverter", intermediateFormat: "dxf", ...inheritedSource, ...sourceMeta } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translateDxfSource(input, options, outputPath) {
  const dir = tempDir("bobercad-dxf-");
  try {
    const sourceInput = cadInput(input, dir, "dxf", "DXF");
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "dxf-decompress-failed"), input, "dxf", options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const sourceMeta = sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {};
    if (hasDwgSignature(sourceInput.path)) return translateDwg(sourceInput.path, options, outputPath, { originalPath: input, detectedFormat: "dwg", extensionFormat: "dxf", ...sourceMeta });
    return translateDxf(sourceInput.path, options, "dxf", { outputPath, originalPath: input, source: sourceMeta });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translateStep(input, options, outputPath, source = {}) {
  const dir = tempDir("bobercad-step-");
  try {
    const sourceInput = stepInput(input, dir);
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "step-decompress-failed"), input, "step", options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const originalPath = source.originalPath || input;
    const inheritedSource = { ...source };
    delete inheritedSource.originalPath;
    const sourceMeta = sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {};
    if (payloadFormatFromBuffer(fileHead(sourceInput.path)) === "ifc") {
      return translateIfc(sourceInput.path, options, outputPath, { originalPath, detectedFormat: "ifc", extensionFormat: "step", ...inheritedSource, ...sourceMeta });
    }
    const freecad = resolveExecutable(converterSpecs().FreeCADCmd);
    const assimp = resolveExecutable(converterSpecs().assimp);
    const objPath = path.join(dir, "step.obj");
    let freecadFailure = null;
    if (freecad) {
      const scriptPath = path.join(dir, "step_to_obj.py");
      fs.writeFileSync(scriptPath, `
import re
import sys
import FreeCAD as App
import Import
import MeshPart
source_path = sys.argv[-2]
target_path = sys.argv[-1]
doc = App.newDocument("bobercad_step")
Import.insert(source_path, doc.Name)
vertices = []
vertex_ids = {}
mesh_groups = []
def group_name(index, obj):
    label = getattr(obj, "Label", "") or getattr(obj, "Name", "") or getattr(obj, "TypeId", "") or "shape"
    name = getattr(obj, "Name", "") or ""
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{index + 1}_{label}_{name}").strip("_") or f"shape_{index + 1}"
def vertex_id(point):
    x, y, z = (point.x, point.y, point.z) if hasattr(point, "x") else point[:3]
    key = (round(x, 9), round(y, 9), round(z, 9))
    if key not in vertex_ids:
        vertex_ids[key] = len(vertices) + 1
        vertices.append(key)
    return vertex_ids[key]
for obj_index, obj in enumerate(doc.Objects):
    shape = getattr(obj, "Shape", None)
    if shape and not shape.isNull():
        mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=${options.meshDeflection}, AngularDeflection=${options.meshAngle}, Relative=False)
        if mesh and mesh.CountFacets:
            object_faces = []
            for facet in mesh.Facets:
                face = [vertex_id(point) for point in facet.Points]
                if len(set(face)) >= 3:
                    object_faces.append(face)
            if object_faces:
                mesh_groups.append((group_name(obj_index, obj), object_faces))
with open(target_path, "w", encoding="utf8") as out:
    for x, y, z in vertices:
        out.write(f"v {x} {y} {z}\\n")
    for name, faces in mesh_groups:
        out.write(f"g {name}\\n")
        for face in faces:
            out.write("f " + " ".join(str(item) for item in face) + "\\n")
`);
      const result = run(freecad, ["-c", scriptPath, "--pass", sourceInput.path, objPath], options);
      if (result.status === 0 && fs.existsSync(objPath) && fs.statSync(objPath).size > 0) return parseObj(objPath, originalPath, "step", options, outputPath, { converter: "FreeCADCmd", intermediateFormat: "obj", ...inheritedSource, ...sourceMeta });
      freecadFailure = runFailed("FreeCADCmd", result, true);
      if (!assimp) return finalize({ ...emptyDoc("FreeCADCmd failed to convert STEP to OBJ.", "converter-failed"), diagnostics: [freecadFailure] }, originalPath, "step", options, outputPath, { converter: "FreeCADCmd", ...inheritedSource, ...sourceMeta });
    }
    if (assimp) {
      const result = run(assimp, ["export", sourceInput.path, objPath], options);
      if (result.status === 0 && fs.existsSync(objPath) && fs.statSync(objPath).size > 0) return parseObj(objPath, originalPath, "step", options, outputPath, { converter: "assimp", intermediateFormat: "obj", ...inheritedSource, ...sourceMeta });
      return finalize({ ...emptyDoc("assimp failed to convert STEP to OBJ.", "converter-failed"), diagnostics: [freecadFailure, runFailed("assimp", result, true)].filter(Boolean) }, originalPath, "step", options, outputPath, { converter: "assimp", ...inheritedSource, ...sourceMeta });
    }
    return finalize(emptyDoc("STEP needs FreeCADCmd or assimp; set BOBERCAD_FREECADCMD or install FreeCAD.", "converter-missing"), originalPath, "step", options, outputPath, { ...inheritedSource, ...sourceMeta });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translateIfc(input, options, outputPath, source = {}) {
  const dir = tempDir("bobercad-ifc-");
  try {
    const sourceInput = ifcInput(input, dir);
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "ifc-decompress-failed"), input, "ifc", options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const originalPath = source.originalPath || input;
    const inheritedSource = { ...source };
    delete inheritedSource.originalPath;
    const sourceMeta = sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {};
    if (payloadFormatFromBuffer(fileHead(sourceInput.path)) === "step") {
      return translateStep(sourceInput.path, options, outputPath, { originalPath, detectedFormat: "step", extensionFormat: "ifc", ...inheritedSource, ...sourceMeta });
    }
    const objPath = path.join(dir, "ifc.obj");
    let ifcOpenShellFailure = null;
    if (pythonModuleAvailable("ifcopenshell")) {
      const scriptPath = path.join(dir, "ifc_to_obj.py");
      fs.writeFileSync(scriptPath, `
import sys
import re
import ifcopenshell
import ifcopenshell.geom
model = ifcopenshell.open(sys.argv[1])
settings = ifcopenshell.geom.settings()
settings.set(settings.USE_WORLD_COORDS, True)
def group_name(product):
    parts = [product.is_a(), getattr(product, "Name", "") or "", getattr(product, "GlobalId", "") or ""]
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", "_".join(str(part) for part in parts if part)).strip("_") or "ifc_product"
with open(sys.argv[2], "w", encoding="utf8") as out:
    offset = 1
    for product in model.by_type("IfcProduct"):
        if not getattr(product, "Representation", None):
            continue
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
            geom = shape.geometry
            verts = list(geom.verts)
            faces = list(geom.faces)
        except Exception:
            continue
        out.write(f"g {group_name(product)}\\n")
        for i in range(0, len(verts), 3):
            out.write(f"v {verts[i]} {verts[i+1]} {verts[i+2]}\\n")
        for i in range(0, len(faces), 3):
            out.write(f"f {faces[i]+offset} {faces[i+1]+offset} {faces[i+2]+offset}\\n")
        offset += len(verts) // 3
`);
      const result = run(pythonCommand(), [scriptPath, sourceInput.path, objPath], options);
      if (result.status === 0 && fs.existsSync(objPath) && fs.statSync(objPath).size > 0) return parseObj(objPath, originalPath, "ifc", options, outputPath, { converter: "IfcOpenShell", intermediateFormat: "obj", ...inheritedSource, ...sourceMeta });
      ifcOpenShellFailure = runFailed("IfcOpenShell", result, true);
    }
    const ifcConvert = resolveExecutable(converterSpecs().IfcConvert);
    if (ifcConvert) {
      const result = run(ifcConvert, [sourceInput.path, objPath], options);
      if (result.status === 0 && fs.existsSync(objPath) && fs.statSync(objPath).size > 0) return parseObj(objPath, originalPath, "ifc", options, outputPath, { converter: "IfcConvert", intermediateFormat: "obj", ...inheritedSource, ...sourceMeta });
      ifcOpenShellFailure = [ifcOpenShellFailure, runFailed("IfcConvert", result, true)].filter(Boolean);
    }
    const assimp = resolveExecutable(converterSpecs().assimp);
    if (assimp) {
      const result = run(assimp, ["export", sourceInput.path, objPath], options);
      if (result.status === 0 && fs.existsSync(objPath) && fs.statSync(objPath).size > 0) return parseObj(objPath, originalPath, "ifc", options, outputPath, { converter: "assimp", intermediateFormat: "obj", ...inheritedSource, ...sourceMeta });
      return finalize({ ...emptyDoc("assimp failed to convert IFC to OBJ.", "converter-failed"), diagnostics: [ifcOpenShellFailure, runFailed("assimp", result, true)].flat().filter(Boolean) }, originalPath, "ifc", options, outputPath, { converter: "assimp", ...inheritedSource, ...sourceMeta });
    }
    if (ifcOpenShellFailure) return finalize({ ...emptyDoc("IFC converters failed to convert IFC to OBJ.", "converter-failed"), diagnostics: [ifcOpenShellFailure].flat().filter(Boolean) }, originalPath, "ifc", options, outputPath, { converter: "ifc-converters", ...inheritedSource, ...sourceMeta });
    return finalize(emptyDoc("IFC needs Python IfcOpenShell or IfcConvert.", "converter-missing"), originalPath, "ifc", options, outputPath, { ...inheritedSource, ...sourceMeta });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translateE57(input, format, options, outputPath) {
  const dir = tempDir("bobercad-e57-");
  try {
    const sourceInput = e57Input(input, dir);
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "e57-decompress-failed"), input, format, options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const sourceMeta = sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {};
    const xyzPath = path.join(dir, "points.xyz");
    const statsPath = path.join(dir, "points.stats.json");
    let pye57Failure = null;
    let pye57EmptySidecar = null;
    if (pythonModuleAvailable("pye57")) {
      const scriptPath = path.join(dir, "e57_to_xyz.py");
      fs.writeFileSync(scriptPath, `
import json
import math
import sys
import pye57
source, target, stats_path, stride, max_points = sys.argv[1], sys.argv[2], sys.argv[3], max(1, int(float(sys.argv[4]))), max(1, int(float(sys.argv[5])))
e57 = pye57.E57(source)
scan_count = int(e57.scan_count)
source_point_count = 0
for scan_index in range(scan_count):
    try:
        header = e57.get_header(scan_index)
        fields = set(getattr(header, "point_fields", []) or [])
        if {"cartesianX", "cartesianY", "cartesianZ"}.issubset(fields) or {"sphericalRange", "sphericalAzimuth", "sphericalElevation"}.issubset(fields):
            source_point_count += int(getattr(header, "point_count", 0) or 0)
    except Exception:
        pass
written = 0
seen = 0
valid_seen = 0
valid_count_complete = True
transform_applied = True
color_count = 0
color_sum = [0.0, 0.0, 0.0]
color_max = 0.0
intensity_count = 0
intensity_sum = 0.0
intensity_max = 0.0
spherical_fallback_count = 0
def read_scan_global(scan_index):
    global transform_applied
    try:
        return e57.read_scan(scan_index, intensity=True, colors=True, ignore_missing_fields=True, transform=True)
    except TypeError as error:
        if "transform" not in str(error):
            raise
        transform_applied = False
        return e57.read_scan(scan_index, intensity=True, colors=True, ignore_missing_fields=True)
with open(target, "w", encoding="utf8") as out:
    for scan_index in range(e57.scan_count):
        if written >= max_points:
            valid_count_complete = False
            break
        data = read_scan_global(scan_index)
        xs, ys, zs = data.get("cartesianX"), data.get("cartesianY"), data.get("cartesianZ")
        invalid = data.get("cartesianInvalidState")
        if xs is None or ys is None or zs is None:
            ranges, azimuths, elevations = data.get("sphericalRange"), data.get("sphericalAzimuth"), data.get("sphericalElevation")
            if ranges is None or azimuths is None or elevations is None:
                continue
            xs, ys, zs = [], [], []
            for radius, azimuth, elevation in zip(ranges, azimuths, elevations):
                radius, azimuth, elevation = float(radius), float(azimuth), float(elevation)
                horizontal = radius * math.cos(elevation)
                xs.append(horizontal * math.cos(azimuth))
                ys.append(horizontal * math.sin(azimuth))
                zs.append(radius * math.sin(elevation))
            invalid = data.get("sphericalInvalidState")
            spherical_fallback_count += len(xs)
        color_invalid = data.get("colorInvalidState")
        rs, gs, bs = data.get("colorRed"), data.get("colorGreen"), data.get("colorBlue")
        has_color = rs is not None and gs is not None and bs is not None
        intensities = data.get("intensity")
        has_intensity = intensities is not None
        for index, (x, y, z) in enumerate(zip(xs, ys, zs)):
            seen += 1
            try:
                invalid_point = invalid is not None and int(invalid[index]) != 0
            except Exception:
                invalid_point = False
            if invalid_point:
                continue
            try:
                x, y, z = float(x), float(y), float(z)
            except Exception:
                continue
            if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
                continue
            valid_seen += 1
            if (valid_seen - 1) % stride:
                continue
            out.write(f"{x} {y} {z}\\n")
            if has_intensity:
                try:
                    intensity = float(intensities[index])
                    if math.isfinite(intensity):
                        intensity_sum += intensity
                        intensity_max = max(intensity_max, intensity)
                        intensity_count += 1
                except Exception:
                    pass
            if has_color:
                try:
                    invalid_color = color_invalid is not None and int(color_invalid[index]) != 0
                except Exception:
                    invalid_color = False
                if invalid_color:
                    written += 1
                    if written >= max_points:
                        valid_count_complete = scan_index == e57.scan_count - 1 and index == len(xs) - 1
                        break
                    continue
                r, g, b = float(rs[index]), float(gs[index]), float(bs[index])
                color_sum[0] += r
                color_sum[1] += g
                color_sum[2] += b
                color_max = max(color_max, r, g, b)
                color_count += 1
            written += 1
            if written >= max_points:
                valid_count_complete = scan_index == e57.scan_count - 1 and index == len(xs) - 1
                break
with open(stats_path, "w", encoding="utf8") as stats:
    data = {"scanCount": scan_count, "sourcePointCount": source_point_count or seen, "storedPointCount": written, "transformApplied": transform_applied}
    if spherical_fallback_count:
        data["sphericalFallbackPointCount"] = spherical_fallback_count
    if valid_count_complete:
        data["validPointCount"] = valid_seen
    if color_count:
        def color_channel(total):
            value = total / color_count
            if color_max <= 1:
                value *= 255
            elif color_max > 255:
                value /= 257
            return max(0, min(255, int(round(value))))
        data["averageColor"] = "#{:02x}{:02x}{:02x}".format(color_channel(color_sum[0]), color_channel(color_sum[1]), color_channel(color_sum[2]))
        data["colorPointCount"] = color_count
    elif intensity_count:
        value = intensity_sum / intensity_count
        value = value / intensity_max * 255 if intensity_max > 0 else 0
        gray = max(0, min(255, int(round(value))))
        data["averageColor"] = "#{:02x}{:02x}{:02x}".format(gray, gray, gray)
        data["intensityPointCount"] = intensity_count
    json.dump(data, stats)
`);
      const result = run(pythonCommand(), [scriptPath, sourceInput.path, xyzPath, statsPath, String(options.pointStride), String(options.maxPoints)], options);
      if (result.status === 0 && fs.existsSync(statsPath)) {
        const pointStats = readJsonFile(statsPath);
        const averageColor = !options.colorExplicit ? colorHex(pointStats.averageColor) : "";
        const sourceStats = Number.isFinite(pointStats.scanCount) ? {
          e57ScanCount: pointStats.scanCount,
          e57SourcePointCount: pointStats.sourcePointCount,
          ...(pointStats.transformApplied === false ? { e57TransformApplied: false } : {}),
          ...(Number.isFinite(pointStats.sphericalFallbackPointCount) ? { e57SphericalPointCount: pointStats.sphericalFallbackPointCount } : {}),
          ...(Number.isFinite(pointStats.validPointCount) ? { e57ValidPointCount: pointStats.validPointCount } : {}),
          ...(averageColor ? {
            e57AverageColor: averageColor,
            ...(Number.isFinite(pointStats.colorPointCount) ? { e57ColorPointCount: pointStats.colorPointCount } : {}),
            ...(Number.isFinite(pointStats.intensityPointCount) ? { e57IntensityPointCount: pointStats.intensityPointCount } : {})
          } : {})
        } : {};
        const annotate = (sidecar) => {
          if (pointStats.transformApplied === false) sidecar.diagnostics.push(diagnostic("warning", "e57-transform-unavailable", "pye57 did not accept transform=True; points were read without scan transform and may be in local scanner coordinates."));
          return sidecar;
        };
        if (fs.existsSync(xyzPath) && fs.statSync(xyzPath).size > 0) {
          const sidecar = annotate(parseXyz(xyzPath, input, format, { ...options, ...(averageColor ? { color: averageColor } : {}), pointStride: 1 }, outputPath, { converter: "pye57", intermediateFormat: "xyz", ...sourceMeta, ...sourceStats }));
          const sourcePointCount = Number.isFinite(pointStats.validPointCount) ? pointStats.validPointCount : pointStats.sourcePointCount;
          if (Number.isFinite(sourcePointCount)) {
            for (const cloud of sidecar.pointClouds) cloud.sourcePointCount = sourcePointCount;
          }
          if (Number.isFinite(pointStats.storedPointCount)) {
            for (const cloud of sidecar.pointClouds) cloud.storedPointCount = pointStats.storedPointCount;
          }
          if (options.pointStride !== 1) sidecar.source.options = { ...(sidecar.source.options || {}), pointStride: options.pointStride };
          sidecar.source.counts = counts(sidecar);
          return sidecar;
        }
        pye57EmptySidecar = annotate(finalize(emptyDoc("pye57 parsed E57, but no valid XYZ points were extracted.", "e57-no-valid-points"), input, format, options, outputPath, { converter: "pye57", intermediateFormat: "xyz", ...sourceMeta, ...sourceStats }));
        pye57Failure = diagnostic("warning", "e57-no-valid-points", "pye57 parsed E57, but no valid XYZ points were extracted.");
      } else {
        pye57Failure = runFailed("pye57", result, true);
      }
    }
    const pdal = resolveExecutable(converterSpecs().pdal);
    if (pdal) {
      const infoResult = run(pdal, ["info", "--summary", sourceInput.path], options);
      const sourceStats = infoResult.status === 0 ? pdalSummaryStats(infoResult.stdout) : {};
      let result = run(pdal, ["translate", sourceInput.path, xyzPath, "--writers.text.order=X,Y,Z,Red,Green,Blue"], options);
      if (result.status !== 0 || !fs.existsSync(xyzPath) || fs.statSync(xyzPath).size <= 0) {
        fs.rmSync(xyzPath, { force: true });
        result = run(pdal, ["translate", sourceInput.path, xyzPath, "--writers.text.order=X,Y,Z"], options);
      }
      if (result.status === 0 && fs.existsSync(xyzPath) && fs.statSync(xyzPath).size > 0) {
        const sidecar = parseXyz(xyzPath, input, format, options, outputPath, { converter: "pdal", intermediateFormat: "xyz", pointTextRgbMax: 65535, ...sourceMeta, ...sourceStats });
        const pdalAverageColor = colorHex(sidecar.source.pointTextAverageColor);
        if (pdalAverageColor) {
          sidecar.source.e57AverageColor = pdalAverageColor;
          if (Number.isFinite(sidecar.source.pointTextColorPointCount)) sidecar.source.e57ColorPointCount = sidecar.source.pointTextColorPointCount;
          if (Number.isFinite(sidecar.source.pointTextIntensityPointCount)) sidecar.source.e57IntensityPointCount = sidecar.source.pointTextIntensityPointCount;
          if (sidecar.source.pointTextColorLayout) sidecar.source.e57PdalColorLayout = sidecar.source.pointTextColorLayout;
          delete sidecar.source.pointTextAverageColor;
          delete sidecar.source.pointTextColorPointCount;
          delete sidecar.source.pointTextIntensityPointCount;
          delete sidecar.source.pointTextColorLayout;
        }
        if (Number.isFinite(sourceStats.e57SourcePointCount)) {
          for (const cloud of sidecar.pointClouds) cloud.sourcePointCount = sourceStats.e57SourcePointCount;
        }
        sidecar.source.counts = counts(sidecar);
        return sidecar;
      }
      return finalize({ ...emptyDoc("PDAL failed to extract E57 points.", "converter-failed"), diagnostics: [pye57Failure, runFailed("pdal", result, true)].filter(Boolean) }, input, format, options, outputPath, { converter: "pdal", ...sourceMeta });
    }
    if (pye57EmptySidecar) return pye57EmptySidecar;
    if (pye57Failure) return finalize({ ...emptyDoc("pye57 failed to extract E57 points.", "converter-failed"), diagnostics: [pye57Failure] }, input, format, options, outputPath, { converter: "pye57", ...sourceMeta });
    return finalize(emptyDoc("E57 needs Python pye57 or PDAL.", "converter-missing"), input, format, options, outputPath, sourceMeta);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translatePointText(input, options, outputPath, forcedIntermediateFormat = "") {
  const dir = tempDir("bobercad-pointtext-");
  try {
    const sourceInput = pointTextInput(input, dir);
    if (sourceInput.error) return finalize(emptyDoc(sourceInput.error, "point-text-decompress-failed"), input, "xyz", options, outputPath, { sourceCompression: sourceInput.compression || "compressed" });
    const sourceMeta = {
      intermediateFormat: forcedIntermediateFormat || sourceInput.intermediateFormat || "xyz",
      ...(sourceInput.compression ? { sourceCompression: sourceInput.compression, ...(sourceInput.archiveEntry ? { sourceArchiveEntry: sourceInput.archiveEntry } : {}) } : {})
    };
    return parseXyz(sourceInput.path, input, "xyz", options, outputPath, sourceMeta);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function translate(input, options, outputPath = "") {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) throw new Error(`Input not found: ${input}`);
  const format = normalizeFormat(resolved, options.format);
  const formatKey = String(options.format || "").trim().toLowerCase().replace(/^\./, "");
  const forcedPcd = /^pcd(?:gz|zip|[-_]zip|\.gz|\.zip)?$/.test(formatKey);
  if (!format) throw new Error(`Cannot detect source format for ${input}; use --format`);
  if (format === "dxf") return translateDxfSource(resolved, options, outputPath);
  if (format === "dwg") return translateDwg(resolved, options, outputPath);
  if (format === "step") return translateStep(resolved, options, outputPath);
  if (format === "ifc") return translateIfc(resolved, options, outputPath);
  if (format === "e57" || format === "e57pointcloud") return translateE57(resolved, format, options, outputPath);
  if (format === "obj") return parseObj(resolved, resolved, "obj", options, outputPath, { intermediateFormat: "obj" });
  if (format === "xyz") return translatePointText(resolved, options, outputPath, forcedPcd ? "pcd" : "");
  throw new Error(`Unsupported source format: ${format}`);
}

function outputStem(input) {
  const name = path.basename(input);
  return name.replace(/\.(?:dxf|dwg)(?:gz|zip|[-_]zip|\.gz|\.zip)$/i, "")
    .replace(/\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)(?:z|zip|[-_]zip|\.z|\.gz|\.zip)$/i, "")
    .replace(/\.(?:ifc|ifcxml)(?:gz|zip|[-_]zip|\.gz|\.zip)$/i, "")
    .replace(/\.e57(?:gz|zip|[-_]zip|\.gz|\.zip|[._-]?point[._-]?cloud(?:gz|zip|[-_]zip|\.gz|\.zip)?)$/i, "")
    .replace(/\.(?:xyz|pts|asc|txt|csv|pcd)(?:gz|zip|[-_]zip|\.gz|\.zip)$/i, "")
    .replace(/\.[^.]+$/i, "");
}

function outputPathFor(input, args, usedNames) {
  if (args.output) return path.resolve(args.output);
  const stem = cleanId(outputStem(input), "reference");
  const dir = args.outputDir ? path.resolve(args.outputDir) : path.dirname(path.resolve(input));
  fs.mkdirSync(dir, { recursive: true });
  let name = `${stem}.reference.json`;
  for (let index = 2; usedNames.has(name.toLowerCase()); index += 1) name = `${stem}-${index}.reference.json`;
  usedNames.add(name.toLowerCase());
  return path.join(dir, name);
}

function writeSidecar(sidecar, outputPath, compact) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sidecar, null, compact ? 0 : 2)}\n`);
}

function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.help) {
      console.log(usage());
      return;
    }
    if (args.checkConverters) {
      checkConverters();
      return;
    }
    if (!args.inputs.length) throw new Error("No input file was provided");
    if (args.inputs.length > 1 && !args.outputDir) throw new Error("Multiple inputs require --output-dir");
    if (args.inputs.length > 1 && args.format) throw new Error("--format is only valid with a single input");
    const usedNames = new Set();
    for (const input of args.inputs) {
      const outputPath = outputPathFor(input, args, usedNames);
      if (path.resolve(outputPath) === path.resolve(input)) throw new Error("Refusing to overwrite source file");
      const sidecar = translate(input, args, outputPath);
      writeSidecar(sidecar, outputPath, args.compact);
      const c = counts(sidecar);
      console.log(`${outputPath}: ${c.lines} lines, ${c.polylines} polylines, ${c.meshes} meshes, ${c.points} points`);
    }
  } catch (error) {
    console.error(error?.message || String(error));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
