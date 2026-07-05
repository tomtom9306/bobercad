import { REFERENCE_GEOMETRY_SCHEMA, REFERENCE_GEOMETRY_VERSION } from "./reference-geometry.mjs";

const DEFAULT_COLOR = "#94a3b8";
const DEFAULT_MESH_COLOR = "#60a5fa";
const DEFAULT_POINT_COLOR = "#f59e0b";
const MAX_POINTS = 200000;
const TEXT_SAMPLE_BYTES = 65536;
const ZIP_SOURCE_PATTERN = /\.(?:dxf|dwg|step|stp|ste|p21|stpx|stpnc|stepnc|ifc|ifcxml|ifczip|e57|e57pointcloud|e57-point-cloud|e57_point_cloud|xyz|pts|ptx|asc|txt|csv|pcd|ply|las|laz|obj)$/i;

function number(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(String(value).trim().replace(/,/g, ".").replace(/[dD]([+-]?\d+)/, "e$1"));
  return Number.isFinite(parsed) ? parsed : null;
}

function numbersFromText(value) {
  return [...String(value || "").matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eEdD][-+]?\d+)?/g)]
    .map((match) => number(match[0]))
    .filter(Number.isFinite);
}

function cleanId(value, fallback = "reference") {
  return String(value || fallback).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function diag(severity, code, message) {
  return { severity, code, message };
}

function errorMessage(error) {
  return error?.message || String(error);
}

function textLines(text) {
  return String(text || "").replace(/\u001a\s*$/, "").split(/\r\n|\n|\r/);
}

function bytesStart(bytes, values) {
  return values.every((value, index) => bytes[index] === value);
}

function textFromBytes(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  let zerosEven = 0;
  let zerosOdd = 0;
  const limit = Math.min(bytes.length, 4096);
  for (let index = 0; index < limit; index += 2) {
    if (bytes[index] === 0) zerosEven += 1;
    if (bytes[index + 1] === 0) zerosOdd += 1;
  }
  if (zerosOdd > 16 && zerosOdd > zerosEven * 2) return new TextDecoder("utf-16le").decode(bytes);
  if (zerosEven > 16 && zerosEven > zerosOdd * 2) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes).replace(/^\ufeff/, "");
}

function formatForFile(name, bytes, text) {
  const lower = String(name || "").toLowerCase();
  if (/\.(?:dxf)$/i.test(lower)) return "dxf";
  if (/\.(?:dwg)$/i.test(lower)) return "dwg";
  if (/\.(?:step|stp|ste|p21|stpx|stpnc|stepnc)$/i.test(lower)) return "step";
  if (/\.(?:ifc|ifcxml|ifczip)$/i.test(lower)) return "ifc";
  if (/\.e57(?:[._-]?point[._-]?cloud)?$/i.test(lower)) return lower.includes("point") ? "e57pointcloud" : "e57";
  if (/\.pcd$/i.test(lower) || /^\s*(?:#\s*)?\.?PCD\b/im.test(text) || /^\s*FIELDS\s+/im.test(text)) return "pcd";
  if (/\.ply$/i.test(lower) || /^\s*ply\s*\r?\n/i.test(text)) return "ply";
  if (/\.laz$/i.test(lower)) return "laz";
  if (/\.las$/i.test(lower) || bytesStart(bytes, [0x4c, 0x41, 0x53, 0x46])) return "las";
  if (/\.ptx$/i.test(lower)) return "ptx";
  if (/\.(?:xyz|pts|asc|txt|csv)$/i.test(lower)) return "xyz";
  if (/\.obj$/i.test(lower)) return "obj";
  if (/\.json$/i.test(lower)) return "json";
  if (bytes.subarray(0, 4).every((value, index) => value === [0x41, 0x43, 0x31, 0x30][index])) return "dwg";
  if (bytes.subarray(0, 8).every((value, index) => value === "ASTM-E57".charCodeAt(index))) return "e57";
  if (/ISO-10303-21/i.test(text)) return /FILE_SCHEMA\s*\(\s*\(\s*['"]IFC/i.test(text) ? "ifc" : "step";
  if (/<(?:[a-z_][\w.-]*:)?ifcxml\b/i.test(text)) return "ifc";
  if (/<(?:[a-z_][\w.-]*:)?iso_10303_28\b/i.test(text)) return "step";
  if (dxfPairScore(dxfPairs(text)) >= 3) return "dxf";
  if (pointTextLooksLike(text)) return "xyz";
  return "";
}

async function decompressBytes(bytes, format) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser does not expose DecompressionStream.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u16(data, offset) {
  return view(data).getUint16(offset, true);
}

function u32(data, offset) {
  return view(data).getUint32(offset, true);
}

function u64(data, offset) {
  const value = view(data).getBigUint64(offset, true);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : Number.MAX_SAFE_INTEGER;
}

function zipEntries(bytes) {
  let eocd = -1;
  for (let index = Math.max(0, bytes.length - 0xffff - 22); index <= bytes.length - 22; index += 1) {
    if (u32(bytes, index) === 0x06054b50) eocd = index;
  }
  if (eocd < 0) return { error: "ZIP end-of-central-directory record was not found.", entries: [] };
  const entries = u16(bytes, eocd + 10);
  const centralSize = u32(bytes, eocd + 12);
  let offset = u32(bytes, eocd + 16);
  const centralEnd = offset + centralSize;
  if (entries === 0xffff || centralSize === 0xffffffff || offset === 0xffffffff) return { error: "ZIP64 archives are not supported by the built-in browser importer.", entries: [] };
  if (entries > 0 && (offset + 46 > bytes.length || centralEnd > eocd)) return { error: "ZIP central directory is truncated.", entries: [] };
  const out = [];
  for (let entryIndex = 0; entryIndex < entries && offset + 46 <= centralEnd; entryIndex += 1) {
    const directoryOffset = offset;
    if (u32(bytes, offset) !== 0x02014b50) return { error: "ZIP central directory is malformed.", entries: [] };
    const flags = u16(bytes, offset + 8);
    const method = u16(bytes, offset + 10);
    const compressedSize = u32(bytes, offset + 20);
    const uncompressedSize = u32(bytes, offset + 24);
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const localOffset = u32(bytes, offset + 42);
    if (offset + 46 + nameLength + extraLength + commentLength > centralEnd) return { error: "ZIP central directory is truncated.", entries: [] };
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder(flags & 0x800 ? "utf-8" : "iso-8859-1").decode(nameBytes);
    offset += 46 + nameLength + extraLength + commentLength;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) return { error: "ZIP64 archives are not supported by the built-in browser importer.", entries: [] };
    if (name && !name.endsWith("/") && !/(^|\/)__MACOSX\//.test(name)) out.push({ name, flags, method, compressedSize, uncompressedSize, localOffset, directoryOffset });
  }
  return { entries: out };
}

async function zipEntryPayload(bytes, entry) {
  if (entry.flags & 1) return { error: "Encrypted ZIP entries are not supported." };
  if (entry.localOffset + 30 > bytes.length || u32(bytes, entry.localOffset) !== 0x04034b50) return { error: "ZIP local file header is malformed." };
  const nameLength = u16(bytes, entry.localOffset + 26);
  const extraLength = u16(bytes, entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (Number.isFinite(entry.directoryOffset) && (start > entry.directoryOffset || end > entry.directoryOffset)) return { error: "ZIP local entry payload is truncated." };
  if (end > bytes.length) return { error: "ZIP local entry payload is truncated." };
  const payload = bytes.subarray(start, end);
  if (entry.method === 0) return { bytes: payload.slice(), name: entry.name };
  if (entry.method !== 8) return { error: `ZIP compression method ${entry.method} is not supported.` };
  try {
    return { bytes: await decompressBytes(payload, "deflate-raw"), name: entry.name };
  } catch (rawError) {
    try {
      return { bytes: await decompressBytes(payload, "deflate"), name: entry.name };
    } catch {
      return { error: `ZIP deflate payload could not be decompressed: ${errorMessage(rawError)}` };
    }
  }
}

async function zipPayload(bytes) {
  const parsed = zipEntries(bytes);
  if (parsed.error) return { error: parsed.error };
  const entries = parsed.entries.slice().sort((a, b) => (b.uncompressedSize || b.compressedSize) - (a.uncompressedSize || a.compressedSize));
  let entry = entries.find((item) => ZIP_SOURCE_PATTERN.test(item.name));
  if (!entry) {
    for (const candidate of entries) {
      const payload = await zipEntryPayload(bytes, candidate);
      if (payload.bytes) {
        const sample = textFromBytes(payload.bytes.subarray(0, Math.min(payload.bytes.length, TEXT_SAMPLE_BYTES)));
        if (formatForFile(candidate.name, payload.bytes, sample)) return payload;
      }
    }
  }
  return entry ? zipEntryPayload(bytes, entry) : { error: "ZIP archive did not contain a supported reference geometry payload." };
}

async function sourcePayload(file, bytes) {
  const lower = String(file.name || "").toLowerCase();
  if (bytesStart(bytes, [0x1f, 0x8b]) || /\.(?:gz|z)$/i.test(lower)) {
    try {
      const inflated = await decompressBytes(bytes, "gzip");
      const name = file.name.replace(/\.(?:gz|z)$/i, "") || "source";
      return { bytes: inflated, name, source: { sourceCompression: "gzip" } };
    } catch (error) {
      return { bytes, name: file.name, diagnostics: [diag("warning", "gzip-decompress-failed", `Gzip payload could not be decompressed in the browser: ${errorMessage(error)}`)] };
    }
  }
  if (bytesStart(bytes, [0x50, 0x4b]) || /\.zip$/i.test(lower) || /(?:zip|[-_]zip)$/i.test(lower)) {
    const payload = await zipPayload(bytes);
    if (payload.bytes) return { bytes: payload.bytes, name: payload.name || file.name, source: { sourceCompression: "zip", sourceArchiveEntry: payload.name } };
    return { bytes, name: file.name, diagnostics: [diag("warning", "zip-decompress-failed", payload.error || "ZIP payload could not be decompressed in the browser.")] };
  }
  return { bytes, name: file.name, source: {} };
}

function scalePoint(point, format) {
  const scale = Number.isFinite(format) ? format : format === "ifc" || format === "e57" || format === "e57pointcloud" ? 1000 : 1;
  return point.map((value) => Math.round(value * scale * 1e6) / 1e6);
}

function emptyDoc() {
  return { lines: [], polylines: [], meshes: [], pointClouds: [], diagnostics: [], layers: {} };
}

function counts(doc) {
  const points = doc.pointClouds.reduce((sum, cloud) => sum + cloud.points.length, 0);
  return { lines: doc.lines.length, polylines: doc.polylines.length, meshes: doc.meshes.length, pointClouds: doc.pointClouds.length, points };
}

function bounds(doc) {
  let min = null;
  let max = null;
  const include = (point) => {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return;
    if (!min) {
      min = [...point];
      max = [...point];
      return;
    }
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  };
  for (const line of doc.lines) for (const point of line.points) include(point);
  for (const polyline of doc.polylines) for (const point of polyline.points) include(point);
  for (const mesh of doc.meshes) for (const point of mesh.vertices) include(point);
  for (const cloud of doc.pointClouds) for (const point of cloud.points) include(point);
  return min ? { min, max } : undefined;
}

function addBoundsBoxLines(doc, file, itemBounds, idPrefix = "bounds") {
  const min = itemBounds?.min;
  const max = itemBounds?.max;
  if (!finitePoint(min) || !finitePoint(max)) return false;
  if (min.every((value, axis) => value === max[axis])) return false;
  doc.layers.reference = { name: "reference", color: DEFAULT_COLOR };
  const vertices = [
    [min[0], min[1], min[2]],
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], max[2]],
    [min[0], max[1], max[2]]
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const base = cleanId(file.name);
  for (const [a, b] of edges) {
    doc.lines.push({ id: `${base}_${idPrefix}_${doc.lines.length + 1}`, layer: "reference", points: [vertices[a], vertices[b]] });
  }
  return true;
}

function finalize(doc, file, format, extraSource = {}) {
  const docCounts = counts(doc);
  const docBounds = bounds(doc);
  return {
    schema: REFERENCE_GEOMETRY_SCHEMA,
    schemaVersion: REFERENCE_GEOMETRY_VERSION,
    units: { length: "mm" },
    source: {
      format,
      path: file.name,
      loadedFrom: `local-file:${file.name}`,
      translator: "browser-reference-geometry-translator",
      size: file.size,
      ...(file.lastModified ? { lastModified: new Date(file.lastModified).toISOString() } : {}),
      ...extraSource,
      ...(doc.sourcePatch || {}),
      counts: docCounts,
      ...(docBounds ? { bounds: docBounds } : {})
    },
    layers: doc.layers,
    lines: doc.lines,
    polylines: doc.polylines,
    meshes: doc.meshes,
    pointClouds: doc.pointClouds,
    diagnostics: doc.diagnostics
  };
}

export async function translateReferenceGeometryFile(file) {
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const payload = await sourcePayload(file, originalBytes);
  const bytes = payload.bytes;
  const workingFile = { ...file, name: payload.name || file.name, size: bytes.length };
  const sample = textFromBytes(bytes.subarray(0, Math.min(bytes.length, TEXT_SAMPLE_BYTES)));
  const format = formatForFile(workingFile.name, bytes, sample);
  const text = ["json", "dxf", "step", "ifc", "xyz", "ptx", "obj"].includes(format) ? textFromBytes(bytes) : sample;
  let doc = emptyDoc();
  if (format === "json") return JSON.parse(text);
  if (payload.diagnostics?.length) doc.diagnostics.push(...payload.diagnostics);
  if (!format) {
    doc.diagnostics.push(diag("warning", "format-unknown", "Browser importer could not detect the source format."));
    return finalize(doc, file, "unknown", payload.source || {});
  }
  try {
    if (format === "dxf") doc = parseDxf(text, workingFile, format);
    else if (format === "dwg") doc = parseDwg(bytes, text, workingFile);
    else if (format === "step") doc = parseStep(text, workingFile);
    else if (format === "ifc") doc = parseIfc(text, workingFile);
    else if (format === "e57" || format === "e57pointcloud") doc = parseE57(bytes, workingFile, format);
    else if (format === "xyz") doc = parsePointText(text, workingFile, format);
    else if (format === "ptx") doc = parsePtx(text, workingFile, format);
    else if (format === "pcd") doc = parsePcd(bytes, workingFile, format);
    else if (format === "ply") doc = parsePly(bytes, workingFile, format);
    else if (format === "las") doc = parseLas(bytes, workingFile, format);
    else if (format === "laz") doc = parseLaz(bytes, workingFile, format);
    else if (format === "obj") doc = parseObj(text, workingFile, format);
    else doc.diagnostics.push(diag("warning", `${format}-browser-unsupported`, `${format.toUpperCase()} is not supported by the built-in browser importer yet.`));
  } catch (error) {
    doc = emptyDoc();
    doc.diagnostics.push(diag("error", "browser-translation-failed", errorMessage(error)));
  }
  if (payload.diagnostics?.length && doc.diagnostics !== payload.diagnostics) doc.diagnostics.unshift(...payload.diagnostics);
  return finalize(doc, file, format, {
    ...(payload.name && payload.name !== file.name ? { extractedName: payload.name } : {}),
    ...(payload.source || {})
  });
}

function parseDwg(bytes, sampleText, file) {
  const doc = emptyDoc();
  const embeddedDxf = embeddedDxfText(bytes);
  if (embeddedDxf) {
    const dxfDoc = parseDxf(embeddedDxf.text, file, "dxf");
    const embedded = embeddedDxf.offset > 0;
    dxfDoc.sourcePatch = {
      ...(dxfDoc.sourcePatch || {}),
      dwgDetectedPayloadFormat: embedded ? "embedded-dxf" : "dxf",
      ...(embedded ? { dwgEmbeddedDxfOffset: embeddedDxf.offset } : {})
    };
    dxfDoc.diagnostics.unshift(embedded
      ? diag("info", "dwg-embedded-dxf", `This DWG-named binary payload contains embedded DXF text at byte offset ${embeddedDxf.offset}, so the built-in DXF importer handled that section.`)
      : diag("info", "dwg-payload-is-dxf", "This DWG-named file contains DXF text, so the built-in DXF importer handled it."));
    return dxfDoc;
  }
  if (dxfPairScore(dxfPairs(sampleText)) >= 3) {
    const dxfDoc = parseDxf(textFromBytes(bytes), file, "dxf");
    dxfDoc.sourcePatch = { ...(dxfDoc.sourcePatch || {}), dwgDetectedPayloadFormat: "dxf" };
    dxfDoc.diagnostics.unshift(diag("info", "dwg-payload-is-dxf", "This DWG-named file contains DXF text, so the built-in DXF importer handled it."));
    return dxfDoc;
  }
  const versionCode = /^[A-Z]{2}\d{4}$/.test(textFromBytes(bytes.subarray(0, 6))) ? textFromBytes(bytes.subarray(0, 6)) : "";
  const versionNames = {
    AC1009: "AutoCAD R11/R12",
    AC1012: "AutoCAD R13",
    AC1014: "AutoCAD R14",
    AC1015: "AutoCAD 2000/2000i/2002",
    AC1018: "AutoCAD 2004/2005/2006",
    AC1021: "AutoCAD 2007/2008/2009",
    AC1024: "AutoCAD 2010/2011/2012",
    AC1027: "AutoCAD 2013/2014/2015/2016/2017",
    AC1032: "AutoCAD 2018/2019/2020/2021/2022/2023"
  };
  doc.sourcePatch = {
    ...(versionCode ? { dwgVersionCode: versionCode, dwgVersionName: versionNames[versionCode] || "Unknown DWG version" } : {})
  };
  doc.diagnostics.push(diag("warning", "dwg-built-in-decoder-missing", `Binary DWG${versionCode ? ` ${versionCode}` : ""} needs a real DWG object decoder. No external decoder is loaded; the browser importer can read DXF text payloads but not proprietary DWG object streams yet.`));
  return doc;
}

function parseStep(text, file) {
  if (/<(?:[a-z_][\w.-]*:)?iso_10303_28\b/i.test(text) || /<[^>]*\b(?:cartesian_point|polyline|poly_loop|triangulated_face_set|polygonal_face_set)\b/i.test(text)) {
    const doc = parseStepXml(text, file);
    doc.diagnostics.unshift(diag("warning", "stepxml-built-in-decoder-limited", "Built-in STEP XML support reads cartesian_point, polyline, poly_loop, cartesian_point_list_2d/3d, triangulated_face_set, and polygonal_face_set reference geometry. Advanced STEP XML solids still need more browser translator coverage."));
    return doc;
  }
  const doc = parseSpf(text, file, "step");
  doc.diagnostics.unshift(diag("warning", "step-built-in-decoder-limited", "Built-in STEP support reads SPF points, polylines, sampled circle/ellipse/B-spline curves, poly/edge loops, simple box/extruded/tapered-extruded/revolved area solids, simple hollow/void extruded profiles, swept disk solids over polylines, and already-tessellated faces. Curved B-rep surfaces still need a dedicated in-app STEP tessellator."));
  return doc;
}

function parseIfc(text, file) {
  if (/<(?:[a-z_][\w.-]*:)?ifcxml\b/i.test(text) || /<[^>]*\bIfc(?:TriangulatedFaceSet|PolygonalFaceSet|Polyline|CartesianPointList[23]D)\b/i.test(text)) {
    const doc = parseIfcXml(text, file);
    doc.diagnostics.unshift(diag("warning", "ifcxml-built-in-decoder-limited", "Built-in IFCXML support reads IfcCartesianPointList2D/3D, IfcTriangulatedFaceSet, IfcPolygonalFaceSet, IfcPolyline, simple IfcExtrudedAreaSolid / IfcExtrudedAreaSolidTapered profiles, and product placement for referenced geometry. Curved B-reps and complex XML solids still need more browser translator coverage."));
    return doc;
  }
  const doc = parseSpf(text, file, "ifc");
  doc.diagnostics.unshift(diag("warning", "ifc-built-in-decoder-limited", "Built-in IFC support reads SPF points, polylines, sampled circle/ellipse/B-spline curves, poly/edge loops, simple box/extruded/tapered-extruded/revolved area solids, simple hollow/void extruded profiles, swept disk solids over polylines, polygonal face sets, and triangulated face sets. Mapped curved geometry and complex swept/boolean solids still need a dedicated in-app IFC geometry reader."));
  return doc;
}

function xmlElementBlocks(xml, localName) {
  const pattern = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${localName}>`, "gi");
  return [...String(xml || "").matchAll(pattern)].map((match) => ({ attrs: match[1] || "", body: match[2] || "", full: match[0] || "", index: match.index ?? -1 }));
}

function xmlFirstElementBlock(xml, localName) {
  const block = xmlElementBlocks(xml, localName)[0];
  if (block) return block;
  const pattern = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${localName}\\b([^>]*)\\/>`, "i");
  const match = pattern.exec(String(xml || ""));
  return match ? { attrs: match[1] || "", body: "", full: match[0] || "", index: match.index ?? -1 } : null;
}

function xmlElementBlocksAny(xml, localNames) {
  const seen = new Set();
  const blocks = [];
  for (const localName of localNames) {
    for (const block of xmlElementBlocks(xml, localName)) {
      const key = `${block.index}:${block.full.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(block);
    }
  }
  return blocks.sort((a, b) => a.index - b.index);
}

function xmlFirstElementBlockAny(xml, localNames) {
  for (const localName of localNames) {
    const block = xmlFirstElementBlock(xml, localName);
    if (block) return block;
  }
  return null;
}

function xmlAttr(attrs, name) {
  const pattern = new RegExp(`(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = pattern.exec(String(attrs || ""));
  return match ? xmlDecode(match[1]) : "";
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCharCode(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function xmlText(xml) {
  return xmlDecode(String(xml || "").replace(/<[^>]+>/g, " "));
}

function xmlNumbers(xml) {
  return numbersFromText(xmlText(xml));
}

function xmlIntegers(xml) {
  return xmlNumbers(xml).map((value) => Math.trunc(value)).filter(Number.isInteger);
}

function xmlRefs(xml) {
  return [...String(xml || "").matchAll(/\b(?:href|ref|xlink:href)\s*=\s*["']#?([^"']+)["']/gi)]
    .map((match) => xmlDecode(match[1]).replace(/^#/, "").trim())
    .filter(Boolean);
}

function xmlElementId(block) {
  return xmlAttr(block?.attrs, "id") || "";
}

function xmlUnitToken(block, names) {
  for (const name of names) {
    const attr = xmlAttr(block?.attrs, name);
    if (attr) return attr;
    const child = xmlFirstElementBlock(block?.body || "", name);
    if (child) return xmlText(child.body);
  }
  return "";
}

function xmlLengthScale(text, fallbackScale, format) {
  const prefixes = new Map([
    ["EXA", 1e18], ["PETA", 1e15], ["TERA", 1e12], ["GIGA", 1e9], ["MEGA", 1e6], ["KILO", 1e3], ["HECTO", 1e2], ["DECA", 1e1],
    ["DECI", 1e-1], ["CENTI", 1e-2], ["MILLI", 1e-3], ["MICRO", 1e-6], ["NANO", 1e-9], ["PICO", 1e-12], ["FEMTO", 1e-15], ["ATTO", 1e-18]
  ]);
  const namedUnits = new Map([["FOOT", 304.8], ["FEET", 304.8], ["FT", 304.8], ["INCH", 25.4], ["IN", 25.4], ["YARD", 914.4], ["YD", 914.4], ["MILE", 1609344]]);
  const clean = (value) => String(value || "").replace(/[.\s_-]+/g, "").toUpperCase();
  const scaleFromPrefix = (prefix) => 1000 * (prefixes.get(clean(prefix)) || 1);
  const source = String(text || "");
  const unitContext = (block) => `${source.slice(Math.max(0, (block.index || 0) - 220), (block.index || 0) + block.full.length + 220)} ${block.full}`;
  for (const block of xmlElementBlocksAny(source, ["IfcSIUnit", "si_unit", "SiUnit", "SIUnit"])) {
    const body = block.full;
    const context = unitContext(block);
    const name = xmlUnitToken(block, ["Name", "name"]) || body;
    const unitType = xmlUnitToken(block, ["UnitType", "unit_type", "unitType"]) || context;
    if (!/metre/i.test(name) || !/length/i.test(unitType)) continue;
    return scaleFromPrefix(xmlUnitToken(block, ["Prefix", "prefix"]));
  }
  for (const block of xmlElementBlocksAny(source, ["IfcConversionBasedUnit", "conversion_based_unit", "ConversionBasedUnit"])) {
    const context = unitContext(block);
    if (!/length/i.test(context)) continue;
    const name = clean(xmlUnitToken(block, ["Name", "name"]) || xmlText(block.body));
    const scale = [...namedUnits].find(([key]) => name.includes(key))?.[1];
    if (Number.isFinite(scale)) return scale;
  }
  return fallbackScale;
}

function xmlPointRows(xml, dimensions = 3, format = "ifc") {
  const values = xmlNumbers(xml);
  const points = [];
  for (let index = 0; index + dimensions - 1 < values.length; index += dimensions) {
    const point = values.slice(index, index + dimensions);
    if (dimensions === 2) point.push(0);
    if (point.length === 3 && point.every(Number.isFinite)) points.push(scalePoint(point, format));
  }
  return points;
}

function parseIfcXmlPointList(block, format = "ifc") {
  const coords = xmlFirstElementBlock(block.body, "CoordList")?.body || block.body;
  const prefer2d = /PointList2D/i.test(block.full || "");
  let points = xmlPointRows(coords, prefer2d ? 2 : 3, format);
  if (!points.length) points = xmlPointRows(coords, prefer2d ? 3 : 2, format);
  return points;
}

function parseIfcXmlCartesianPoint(block, format = "ifc") {
  const coords = xmlFirstElementBlock(block.body, "Coordinates")?.body || block.body;
  const values = xmlNumbers(coords);
  if (values.length < 2) return null;
  const point = [values[0], values[1], values[2] || 0];
  return point.every(Number.isFinite) ? scalePoint(point, format) : null;
}

function ifcXmlReferencedPointList(block, pointLists, format = "ifc") {
  const coordinates = xmlFirstElementBlock(block.body, "Coordinates");
  for (const ref of xmlRefs(coordinates?.full || block.body)) {
    const points = pointLists.get(ref);
    if (points?.length) return points;
  }
  const nested = xmlFirstElementBlockAny(coordinates?.body || block.body, ["IfcCartesianPointList3D", "IfcCartesianPointList2D"]);
  return nested ? parseIfcXmlPointList(nested, format) : [];
}

function ifcXmlPolylinePoints(block, cartesianPoints, format = "ifc") {
  const pointsBlock = xmlFirstElementBlock(block.body, "Points") || block;
  const points = [];
  for (const ref of xmlRefs(pointsBlock.full || pointsBlock.body)) {
    const point = cartesianPoints.get(ref);
    if (point) points.push(point);
  }
  if (points.length >= 2) return points;
  for (const pointBlock of xmlElementBlocks(pointsBlock.body, "IfcCartesianPoint")) {
    const point = parseIfcXmlCartesianPoint(pointBlock, format);
    if (point) points.push(point);
  }
  if (points.length >= 2) return points;
  const values = xmlNumbers(pointsBlock.body);
  const dimensions = values.length % 3 === 0 ? 3 : 2;
  return xmlPointRows(pointsBlock.body, dimensions, format);
}

function xmlIndexedCurvePoints(block, pointLists, indexNames, pointListResolver) {
  const pointList = pointListResolver(block, pointLists);
  if (!pointList.length) return [];
  const segments = [];
  for (const segmentBlock of xmlElementBlocksAny(block.body, indexNames)) {
    const name = /Arc/i.test(segmentBlock.full.slice(0, 80)) ? "ARCINDEX" : "LINEINDEX";
    const indices = xmlIntegers(segmentBlock.body || segmentBlock.attrs);
    if (indices.length >= 2) segments.push({ type: name, indices });
  }
  if (!segments.length) segments.push({ type: "LINEINDEX", indices: pointList.map((_, index) => index + 1) });
  const line = [];
  for (const segment of segments) {
    const sequence = segment.type === "ARCINDEX" && segment.indices.length >= 3
      ? spfArcIndexPoints(pointList[segment.indices[0] - 1], pointList[segment.indices[1] - 1], pointList[segment.indices[2] - 1])
      : segment.indices.map((pointIndex) => pointList[pointIndex - 1]).filter(Boolean);
    for (const point of sequence) {
      if (point && !sameSpfPoint(line.at(-1), point)) line.push(point);
    }
  }
  return line;
}

function ifcXmlFaceIndexes(xml, triangulated = false) {
  const values = xmlIntegers(xml);
  if (triangulated) {
    const faces = [];
    for (let index = 0; index + 2 < values.length; index += 3) faces.push(values.slice(index, index + 3));
    return faces;
  }
  return values.length >= 3 ? [values] : [];
}

function ifcXmlMeshFace(face, points) {
  const indexes = [];
  const zeroBased = face.some((value) => value === 0);
  for (const value of face) {
    const index = zeroBased ? value : value - 1;
    if (Number.isInteger(index) && index >= 0 && index < points.length && !indexes.includes(index)) indexes.push(index);
  }
  return indexes.length >= 3 ? indexes : null;
}

function parseIfcXmlDirection(block) {
  const values = xmlNumbers(xmlFirstElementBlock(block?.body || "", "DirectionRatios")?.body || block?.body || "");
  const vector = [values[0], values[1], values[2] ?? 0];
  return vector.slice(0, 2).every(Number.isFinite) ? normalizeVector(vector, [0, 0, 1]) : null;
}

function ifcXmlPointFromBlock(block, cartesianPoints, format) {
  for (const ref of xmlRefs(block?.full || block?.body || "")) {
    const point = cartesianPoints.get(ref);
    if (point) return point;
  }
  const nested = xmlFirstElementBlock(block?.body || "", "IfcCartesianPoint");
  return nested ? parseIfcXmlCartesianPoint(nested, format) : null;
}

function ifcXmlAxisPlacement(block, cartesianPoints, directions, format) {
  const locationBlock = xmlFirstElementBlock(block?.body || "", "Location");
  const axisBlock = xmlFirstElementBlock(block?.body || "", "Axis");
  const refDirectionBlock = xmlFirstElementBlock(block?.body || "", "RefDirection");
  const directionFrom = (item, fallback) => {
    for (const ref of xmlRefs(item?.full || item?.body || "")) {
      const direction = directions.get(ref);
      if (direction) return direction;
    }
    return parseIfcXmlDirection(xmlFirstElementBlock(item?.body || "", "IfcDirection")) || fallback;
  };
  const origin = ifcXmlPointFromBlock(locationBlock, cartesianPoints, format) || [0, 0, 0];
  const refDirection = directionFrom(refDirectionBlock, [1, 0, 0]);
  if (/IfcAxis2Placement2D/i.test(block?.full || "")) return placement2d(origin, refDirection);
  return placement3d(origin, directionFrom(axisBlock, [0, 0, 1]), refDirection);
}

function ifcXmlAxisPlacements(text, cartesianPoints, directions, format) {
  const axisPlacements = new Map();
  for (const block of xmlElementBlocksAny(text, ["IfcAxis2Placement3D", "IfcAxis2Placement2D"])) {
    const id = xmlElementId(block);
    if (id) axisPlacements.set(id, ifcXmlAxisPlacement(block, cartesianPoints, directions, format));
  }
  return axisPlacements;
}

function ifcXmlReferencedPlacement(block, childName, axisPlacements, cartesianPoints, directions, format) {
  const source = childName ? xmlFirstElementBlock(block?.body || "", childName) : block;
  for (const ref of xmlRefs(source?.full || source?.body || "")) {
    const placement = axisPlacements.get(ref);
    if (placement) return placement;
  }
  const inlineAxis = xmlFirstElementBlockAny(source?.body || "", ["IfcAxis2Placement3D", "IfcAxis2Placement2D"]);
  return inlineAxis ? ifcXmlAxisPlacement(inlineAxis, cartesianPoints, directions, format) : identityPlacement();
}

function xmlChildNumber(block, names) {
  for (const name of names) {
    const child = xmlFirstElementBlock(block?.body || "", name);
    const value = child ? xmlNumbers(child.body).find(Number.isFinite) : null;
    if (Number.isFinite(value)) return value;
    const attr = number(xmlAttr(block?.attrs, name));
    if (Number.isFinite(attr)) return attr;
  }
  return null;
}

function ifcXmlReferencedDirection(block, childName, directions, fallback = [0, 0, 1]) {
  const source = childName ? xmlFirstElementBlock(block?.body || "", childName) : block;
  for (const ref of xmlRefs(source?.full || source?.body || "")) {
    const direction = directions.get(ref);
    if (direction) return direction;
  }
  return parseIfcXmlDirection(xmlFirstElementBlock(source?.body || "", "IfcDirection")) || fallback;
}

function placedMesh(mesh, placement, suffix) {
  return { ...mesh, id: `${mesh.id}_${suffix}`, vertices: mesh.vertices.map((point) => applyPlacement(placement, point)) };
}

function placedPolyline(polyline, placement, suffix) {
  return { ...polyline, id: `${polyline.id}_${suffix}`, points: polyline.points.map((point) => applyPlacement(placement, point)) };
}

function applyIfcXmlProductPlacements(doc, text, itemGeometries, cartesianPoints, directions, format) {
  const axisPlacements = ifcXmlAxisPlacements(text, cartesianPoints, directions, format);
  const localPlacementRefs = new Map();
  for (const block of xmlElementBlocks(text, "IfcLocalPlacement")) {
    const id = xmlElementId(block);
    const parent = xmlRefs(xmlFirstElementBlock(block.body, "PlacementRelTo")?.full || "").at(0) || null;
    const relativeBlock = xmlFirstElementBlock(block.body, "RelativePlacement") || block;
    const relativeRef = xmlRefs(relativeBlock.full || relativeBlock.body).find((ref) => axisPlacements.has(ref));
    const inlineAxis = xmlFirstElementBlockAny(relativeBlock.body || "", ["IfcAxis2Placement3D", "IfcAxis2Placement2D"]);
    const relative = axisPlacements.get(relativeRef) || (inlineAxis ? ifcXmlAxisPlacement(inlineAxis, cartesianPoints, directions, format) : identityPlacement());
    if (id) localPlacementRefs.set(id, { parent, relative });
  }
  const localPlacements = new Map();
  const resolvePlacement = (id, stack = new Set()) => {
    if (localPlacements.has(id)) return localPlacements.get(id);
    const ref = localPlacementRefs.get(id);
    if (!ref || stack.has(id)) return identityPlacement();
    stack.add(id);
    const parent = ref.parent ? resolvePlacement(ref.parent, stack) : identityPlacement();
    const placement = composePlacement(parent, ref.relative);
    localPlacements.set(id, placement);
    stack.delete(id);
    return placement;
  };
  for (const id of localPlacementRefs.keys()) resolvePlacement(id);

  const shapeRepresentations = new Map();
  for (const block of xmlElementBlocks(text, "IfcShapeRepresentation")) {
    const id = xmlElementId(block);
    const itemIds = xmlRefs(xmlFirstElementBlock(block.body, "Items")?.full || block.body).filter((ref) => itemGeometries.has(ref));
    if (id && itemIds.length) shapeRepresentations.set(id, itemIds);
  }
  const productDefinitionShapes = new Map();
  for (const block of xmlElementBlocks(text, "IfcProductDefinitionShape")) {
    const id = xmlElementId(block);
    const itemIds = [];
    for (const ref of xmlRefs(xmlFirstElementBlock(block.body, "Representations")?.full || block.body)) {
      for (const itemId of shapeRepresentations.get(ref) || []) itemIds.push(itemId);
      if (itemGeometries.has(ref)) itemIds.push(ref);
    }
    if (id && itemIds.length) productDefinitionShapes.set(id, [...new Set(itemIds)]);
  }

  const productBlocks = xmlElementBlocksAny(text, ["IfcBeam", "IfcColumn", "IfcMember", "IfcPlate", "IfcWall", "IfcSlab", "IfcBuildingElementProxy", "IfcElementAssembly", "IfcProduct"]);
  const placedMeshes = [];
  const placedPolylines = [];
  const removeMeshes = new Set();
  const removePolylines = new Set();
  for (const block of productBlocks) {
    const placementId = xmlRefs(xmlFirstElementBlock(block.body, "ObjectPlacement")?.full || "").find((ref) => localPlacements.has(ref));
    if (!placementId) continue;
    const itemIds = [];
    for (const ref of xmlRefs(xmlFirstElementBlock(block.body, "Representation")?.full || block.body)) {
      for (const itemId of productDefinitionShapes.get(ref) || shapeRepresentations.get(ref) || []) itemIds.push(itemId);
      if (itemGeometries.has(ref)) itemIds.push(ref);
    }
    const placement = localPlacements.get(placementId);
    for (const itemId of [...new Set(itemIds)]) {
      const item = itemGeometries.get(itemId);
      if (item?.type === "mesh") {
        placedMeshes.push(placedMesh(item.item, placement, `placed_${placedMeshes.length + 1}`));
        removeMeshes.add(item.item);
      } else if (item?.type === "polyline") {
        placedPolylines.push(placedPolyline(item.item, placement, `placed_${placedPolylines.length + 1}`));
        removePolylines.add(item.item);
      }
    }
  }
  if (!placedMeshes.length && !placedPolylines.length) return 0;
  doc.meshes = doc.meshes.filter((mesh) => !removeMeshes.has(mesh));
  doc.polylines = doc.polylines.filter((polyline) => !removePolylines.has(polyline));
  doc.meshes.push(...placedMeshes);
  doc.polylines.push(...placedPolylines);
  return placedMeshes.length + placedPolylines.length;
}

function parseIfcXml(text, file) {
  const doc = emptyDoc();
  doc.layers.ifcxml = { name: "ifcXML", color: DEFAULT_MESH_COLOR };
  const base = cleanId(file.name);
  const lengthFormat = xmlLengthScale(text, 1000, "ifc");
  if (lengthFormat !== 1000) {
    doc.sourcePatch = { ...(doc.sourcePatch || {}), ifcXmlLengthUnitScaleToMm: lengthFormat };
    doc.diagnostics.push(diag("info", "ifcxml-length-unit-scale", `Browser IFCXML importer detected length unit scale ${lengthFormat} mm per model unit.`));
  }
  const pointLists = new Map();
  const cartesianPoints = new Map();
  const directions = new Map();
  const itemGeometries = new Map();
  for (const block of xmlElementBlocksAny(text, ["IfcCartesianPointList3D", "IfcCartesianPointList2D"])) {
    const id = xmlElementId(block);
    const points = parseIfcXmlPointList(block, lengthFormat);
    if (id && points.length) pointLists.set(id, points);
  }
  for (const block of xmlElementBlocks(text, "IfcCartesianPoint")) {
    const id = xmlElementId(block);
    const point = parseIfcXmlCartesianPoint(block, lengthFormat);
    if (id && point) cartesianPoints.set(id, point);
  }
  for (const block of xmlElementBlocks(text, "IfcDirection")) {
    const id = xmlElementId(block);
    const direction = parseIfcXmlDirection(block);
    if (id && direction) directions.set(id, direction);
  }
  const axisPlacements = ifcXmlAxisPlacements(text, cartesianPoints, directions, lengthFormat);
  for (const block of xmlElementBlocks(text, "IfcTriangulatedFaceSet")) {
    const itemId = xmlElementId(block);
    const points = ifcXmlReferencedPointList(block, pointLists, lengthFormat);
    const coordIndex = xmlFirstElementBlock(block.body, "CoordIndex");
    const faces = ifcXmlFaceIndexes(coordIndex?.body || "", true).map((face) => ifcXmlMeshFace(face, points)).filter(Boolean);
    if (points.length >= 3 && faces.length) {
      const mesh = { id: `${base}_ifcxml_tri_${doc.meshes.length + 1}`, layer: "ifcxml", color: DEFAULT_MESH_COLOR, opacity: 0.24, vertices: points, faces };
      doc.meshes.push(mesh);
      if (itemId) itemGeometries.set(itemId, { type: "mesh", item: mesh });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcPolygonalFaceSet")) {
    const itemId = xmlElementId(block);
    const points = ifcXmlReferencedPointList(block, pointLists, lengthFormat);
    const faceBlocks = [
      ...xmlElementBlocks(block.body, "IfcIndexedPolygonalFace"),
      ...xmlElementBlocks(block.body, "IfcIndexedPolygonalFaceWithVoids")
    ];
    const faces = [];
    for (const faceBlock of faceBlocks) {
      const coordIndex = xmlFirstElementBlock(faceBlock.body, "CoordIndex") || xmlFirstElementBlock(faceBlock.body, "OuterCoordIndex");
      for (const face of ifcXmlFaceIndexes(coordIndex?.body || faceBlock.body)) {
        const meshFace = ifcXmlMeshFace(face, points);
        if (meshFace) faces.push(meshFace);
      }
    }
    if (points.length >= 3 && faces.length) {
      const mesh = { id: `${base}_ifcxml_poly_${doc.meshes.length + 1}`, layer: "ifcxml", color: DEFAULT_MESH_COLOR, opacity: 0.24, vertices: points, faces };
      doc.meshes.push(mesh);
      if (itemId) itemGeometries.set(itemId, { type: "mesh", item: mesh });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcPolyline")) {
    const itemId = xmlElementId(block);
    const points = ifcXmlPolylinePoints(block, cartesianPoints, lengthFormat);
    if (points.length >= 2) {
      const polyline = { id: `${base}_ifcxml_line_${doc.polylines.length + 1}`, layer: "ifcxml", color: DEFAULT_COLOR, points };
      doc.polylines.push(polyline);
      if (itemId) itemGeometries.set(itemId, { type: "polyline", item: polyline });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcPolyLoop")) {
    const itemId = xmlElementId(block);
    const points = ifcXmlPolylinePoints(block, cartesianPoints, lengthFormat);
    if (points.length >= 3) {
      const polyline = { id: `${base}_ifcxml_loop_${doc.polylines.length + 1}`, layer: "ifcxml", color: DEFAULT_COLOR, closed: true, points };
      doc.polylines.push(polyline);
      if (itemId) itemGeometries.set(itemId, { type: "polyline", item: polyline });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcIndexedPolyCurve")) {
    const itemId = xmlElementId(block);
    const points = xmlIndexedCurvePoints(block, pointLists, ["IfcLineIndex", "IfcArcIndex"], (item, lists) => ifcXmlReferencedPointList(item, lists, lengthFormat));
    if (points.length >= 2) {
      const polyline = { id: `${base}_ifcxml_indexed_curve_${doc.polylines.length + 1}`, layer: "ifcxml", color: DEFAULT_COLOR, points };
      doc.polylines.push(polyline);
      if (itemId) itemGeometries.set(itemId, { type: "polyline", item: polyline });
    }
  }
  const profiles = new Map();
  const profilePlacement = (block) => ifcXmlReferencedPlacement(block, "Position", axisPlacements, cartesianPoints, directions, lengthFormat);
  const dim = (block, names) => scaledLength(xmlChildNumber(block, names), lengthFormat);
  const rememberProfile = (block, profile) => {
    const id = xmlElementId(block);
    if (id && profile?.loop) profiles.set(id, profile);
  };
  for (const block of xmlElementBlocks(text, "IfcRectangleProfileDef")) {
    const width = dim(block, ["XDim"]);
    const height = dim(block, ["YDim"]);
    if (width > 0 && height > 0) {
      const placement = profilePlacement(block);
      rememberProfile(block, {
        loop: [
          [-width / 2, -height / 2, 0],
          [width / 2, -height / 2, 0],
          [width / 2, height / 2, 0],
          [-width / 2, height / 2, 0]
        ].map((point) => applyPlacement(placement, point))
      });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcRectangleHollowProfileDef")) {
    const width = dim(block, ["XDim"]);
    const height = dim(block, ["YDim"]);
    const wall = dim(block, ["WallThickness"]);
    if (width > 0 && height > 0) {
      const placement = profilePlacement(block);
      const innerWidth = width - 2 * (wall || 0);
      const innerHeight = height - 2 * (wall || 0);
      rememberProfile(block, {
        loop: [
          [-width / 2, -height / 2, 0],
          [width / 2, -height / 2, 0],
          [width / 2, height / 2, 0],
          [-width / 2, height / 2, 0]
        ].map((point) => applyPlacement(placement, point)),
        ...(wall > 0 && innerWidth > 0 && innerHeight > 0 ? { voids: [[
          [-innerWidth / 2, -innerHeight / 2, 0],
          [-innerWidth / 2, innerHeight / 2, 0],
          [innerWidth / 2, innerHeight / 2, 0],
          [innerWidth / 2, -innerHeight / 2, 0]
        ].map((point) => applyPlacement(placement, point))] } : {})
      });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcCircleProfileDef")) {
    const radius = dim(block, ["Radius"]);
    if (radius > 0) rememberProfile(block, { loop: ovalLoop(radius, radius, profilePlacement(block)) });
  }
  for (const block of xmlElementBlocks(text, "IfcCircleHollowProfileDef")) {
    const radius = dim(block, ["Radius"]);
    const wall = dim(block, ["WallThickness"]);
    const innerRadius = radius - (wall || 0);
    if (radius > 0) {
      rememberProfile(block, {
        loop: ovalLoop(radius, radius, profilePlacement(block)),
        ...(wall > 0 && innerRadius > 0 ? { voids: [[...ovalLoop(innerRadius, innerRadius, profilePlacement(block))].reverse()] } : {})
      });
    }
  }
  for (const block of xmlElementBlocks(text, "IfcIShapeProfileDef")) rememberProfile(block, { loop: iShapeLoop(dim(block, ["OverallWidth"]), dim(block, ["OverallDepth"]), dim(block, ["WebThickness"]), dim(block, ["FlangeThickness"]), profilePlacement(block)) });
  for (const block of xmlElementBlocks(text, "IfcLShapeProfileDef")) rememberProfile(block, { loop: lShapeLoop(dim(block, ["Width"]) ?? dim(block, ["Depth"]), dim(block, ["Depth"]), dim(block, ["Thickness"]), profilePlacement(block)) });
  for (const block of xmlElementBlocks(text, "IfcTShapeProfileDef")) rememberProfile(block, { loop: tShapeLoop(dim(block, ["FlangeWidth"]), dim(block, ["Depth"]), dim(block, ["WebThickness"]), dim(block, ["FlangeThickness"]), profilePlacement(block)) });
  for (const block of xmlElementBlocks(text, "IfcUShapeProfileDef")) rememberProfile(block, { loop: uShapeLoop(dim(block, ["FlangeWidth"]), dim(block, ["Depth"]), dim(block, ["WebThickness"]), dim(block, ["FlangeThickness"]), profilePlacement(block)) });
  for (const block of xmlElementBlocks(text, "IfcZShapeProfileDef")) rememberProfile(block, { loop: zShapeLoop(dim(block, ["FlangeWidth"]), dim(block, ["Depth"]), dim(block, ["WebThickness"]), dim(block, ["FlangeThickness"]), profilePlacement(block)) });
  for (const block of xmlElementBlocks(text, "IfcCShapeProfileDef")) rememberProfile(block, { loop: cShapeLoop(dim(block, ["Width"]), dim(block, ["Depth"]), dim(block, ["WallThickness"]), dim(block, ["Girth"]), profilePlacement(block)) });
  for (const block of xmlElementBlocksAny(text, ["IfcArbitraryClosedProfileDef", "IfcArbitraryProfileDefWithVoids"])) {
    const outerRef = xmlRefs(xmlFirstElementBlock(block.body, "OuterCurve")?.full || "").find((ref) => itemGeometries.get(ref)?.type === "polyline");
    const outer = outerRef ? itemGeometries.get(outerRef).item : null;
    if (!outer?.points?.length) continue;
    const voidItems = xmlRefs(xmlFirstElementBlock(block.body, "InnerCurves")?.full || "")
      .map((ref) => itemGeometries.get(ref)?.item)
      .filter((item) => item?.points?.length);
    const voids = voidItems.map((item) => item.points);
    rememberProfile(block, { loop: outer.points, ...(voids.length ? { voids } : {}), sourcePolylines: [outer, ...voidItems] });
  }
  const extrudedProfilePolylines = new Set();
  let extrudedXmlCount = 0;
  for (const block of xmlElementBlocks(text, "IfcExtrudedAreaSolid")) {
    const itemId = xmlElementId(block);
    const profileId = xmlRefs(xmlFirstElementBlock(block.body, "SweptArea")?.full || "").find((ref) => profiles.has(ref));
    const profile = profiles.get(profileId);
    const direction = ifcXmlReferencedDirection(block, "ExtrudedDirection", directions, [0, 0, 1]);
    const distance = dim(block, ["Depth"]);
    if (!profile?.loop || !(distance > 0)) continue;
    const placement = ifcXmlReferencedPlacement(block, "Position", axisPlacements, cartesianPoints, directions, lengthFormat);
    const loops = extrudeProfile(profile, direction, distance).map((face) => face.map((point) => applyPlacement(placement, point)));
    const mesh = meshItemFromLoops(`${base}_ifcxml_extruded_${doc.meshes.length + 1}`, "ifcxml", DEFAULT_MESH_COLOR, 0.24, loops);
    if (!mesh) continue;
    doc.meshes.push(mesh);
    if (itemId) itemGeometries.set(itemId, { type: "mesh", item: mesh });
    for (const polyline of profile.sourcePolylines || []) extrudedProfilePolylines.add(polyline);
    extrudedXmlCount += 1;
  }
  for (const block of xmlElementBlocks(text, "IfcExtrudedAreaSolidTapered")) {
    const itemId = xmlElementId(block);
    const profileId = xmlRefs(xmlFirstElementBlock(block.body, "SweptArea")?.full || "").find((ref) => profiles.has(ref));
    const endProfileId = xmlRefs(xmlFirstElementBlock(block.body, "EndSweptArea")?.full || "").find((ref) => profiles.has(ref));
    const profile = profiles.get(profileId);
    const endProfile = profiles.get(endProfileId);
    const direction = ifcXmlReferencedDirection(block, "ExtrudedDirection", directions, [0, 0, 1]);
    const distance = dim(block, ["Depth"]);
    if (!profile?.loop || !endProfile?.loop || !(distance > 0)) continue;
    const placement = ifcXmlReferencedPlacement(block, "Position", axisPlacements, cartesianPoints, directions, lengthFormat);
    const loops = extrudeTaperedLoop(profile.loop, endProfile.loop, direction, distance).map((face) => face.map((point) => applyPlacement(placement, point)));
    const mesh = meshItemFromLoops(`${base}_ifcxml_extruded_${doc.meshes.length + 1}`, "ifcxml", DEFAULT_MESH_COLOR, 0.24, loops);
    if (!mesh) continue;
    doc.meshes.push(mesh);
    if (itemId) itemGeometries.set(itemId, { type: "mesh", item: mesh });
    for (const polyline of profile.sourcePolylines || []) extrudedProfilePolylines.add(polyline);
    for (const polyline of endProfile.sourcePolylines || []) extrudedProfilePolylines.add(polyline);
    extrudedXmlCount += 1;
  }
  if (extrudedProfilePolylines.size) doc.polylines = doc.polylines.filter((polyline) => !extrudedProfilePolylines.has(polyline));
  if (extrudedXmlCount) doc.diagnostics.push(diag("info", "ifcxml-extruded-area-solid", `Browser IFCXML importer generated ${extrudedXmlCount} simple extruded/tapered area solid mesh(es).`));
  const placedCount = applyIfcXmlProductPlacements(doc, text, itemGeometries, cartesianPoints, directions, lengthFormat);
  if (placedCount) doc.diagnostics.push(diag("info", "ifcxml-product-placement", `Browser IFCXML importer applied product local placement to ${placedCount} referenced geometry item(s).`));
  if (!doc.meshes.length && !doc.polylines.length && cartesianPoints.size) {
    doc.pointClouds.push({ id: `${base}_ifcxml_points`, layer: "ifcxml", color: DEFAULT_POINT_COLOR, pointSize: 3, points: [...cartesianPoints.values()] });
  }
  if (doc.meshes.length || doc.polylines.length || doc.pointClouds.length) {
    doc.diagnostics.push(diag("info", "ifcxml-browser-geometry", `Browser IFCXML importer extracted ${doc.meshes.length} mesh(es), ${doc.polylines.length} polyline(s), and ${doc.pointClouds.length} point cloud(s).`));
  } else {
    doc.diagnostics.push(diag("warning", "ifcxml-no-supported-geometry", "Browser IFCXML importer found no supported IfcTriangulatedFaceSet, IfcPolygonalFaceSet, IfcPolyline, or CartesianPoint geometry."));
  }
  return doc;
}

function parseStepXmlPointList(block, format = "step") {
  const coords = xmlFirstElementBlockAny(block.body, ["coord_list", "CoordList", "coordinates"])?.body || block.body;
  const prefer2d = /point_list_2d|PointList2D/i.test(block.full || "");
  let points = xmlPointRows(coords, prefer2d ? 2 : 3, format);
  if (!points.length) points = xmlPointRows(coords, prefer2d ? 3 : 2, format);
  return points;
}

function parseStepXmlCartesianPoint(block, format = "step") {
  const coords = xmlFirstElementBlockAny(block.body, ["coordinates"])?.body || block.body;
  const values = xmlNumbers(coords);
  if (values.length < 2) return null;
  const point = [values[0], values[1], values[2] || 0];
  return point.every(Number.isFinite) ? scalePoint(point, format) : null;
}

function stepXmlReferencedPointList(block, pointLists, format = "step") {
  const coordinates = xmlFirstElementBlockAny(block.body, ["coordinates"]);
  for (const ref of xmlRefs(coordinates?.full || block.body)) {
    const points = pointLists.get(ref);
    if (points?.length) return points;
  }
  const nested = xmlFirstElementBlockAny(coordinates?.body || block.body, ["cartesian_point_list_3d", "CartesianPointList3D", "cartesian_point_list_2d", "CartesianPointList2D"]);
  return nested ? parseStepXmlPointList(nested, format) : [];
}

function stepXmlPolylinePoints(block, cartesianPoints, format = "step") {
  const pointsBlock = xmlFirstElementBlockAny(block.body, ["points", "polygon"]) || block;
  const points = [];
  for (const ref of xmlRefs(pointsBlock.full || pointsBlock.body)) {
    const point = cartesianPoints.get(ref);
    if (point) points.push(point);
  }
  if (points.length >= 2) return points;
  for (const pointBlock of xmlElementBlocksAny(pointsBlock.body, ["cartesian_point", "CartesianPoint"])) {
    const point = parseStepXmlCartesianPoint(pointBlock, format);
    if (point) points.push(point);
  }
  if (points.length >= 2) return points;
  const values = xmlNumbers(pointsBlock.body);
  const dimensions = values.length % 3 === 0 ? 3 : 2;
  return xmlPointRows(pointsBlock.body, dimensions, format);
}

function parseStepXml(text, file) {
  const doc = emptyDoc();
  doc.layers.stepxml = { name: "STEP XML", color: DEFAULT_MESH_COLOR };
  const base = cleanId(file.name);
  const lengthFormat = xmlLengthScale(text, 1, "step");
  if (lengthFormat !== 1) {
    doc.sourcePatch = { ...(doc.sourcePatch || {}), stepXmlLengthUnitScaleToMm: lengthFormat };
    doc.diagnostics.push(diag("info", "stepxml-length-unit-scale", `Browser STEP XML importer detected length unit scale ${lengthFormat} mm per model unit.`));
  }
  const pointLists = new Map();
  const cartesianPoints = new Map();
  for (const block of xmlElementBlocksAny(text, ["cartesian_point_list_3d", "CartesianPointList3D", "cartesian_point_list_2d", "CartesianPointList2D"])) {
    const id = xmlElementId(block);
    const points = parseStepXmlPointList(block, lengthFormat);
    if (id && points.length) pointLists.set(id, points);
  }
  for (const block of xmlElementBlocksAny(text, ["cartesian_point", "CartesianPoint"])) {
    const id = xmlElementId(block);
    const point = parseStepXmlCartesianPoint(block, lengthFormat);
    if (id && point) cartesianPoints.set(id, point);
  }
  for (const block of xmlElementBlocksAny(text, ["triangulated_face_set", "TriangulatedFaceSet"])) {
    const points = stepXmlReferencedPointList(block, pointLists, lengthFormat);
    const coordIndex = xmlFirstElementBlockAny(block.body, ["coord_index", "CoordIndex"]);
    const faces = ifcXmlFaceIndexes(coordIndex?.body || "", true).map((face) => ifcXmlMeshFace(face, points)).filter(Boolean);
    if (points.length >= 3 && faces.length) {
      doc.meshes.push({ id: `${base}_stepxml_tri_${doc.meshes.length + 1}`, layer: "stepxml", color: DEFAULT_MESH_COLOR, opacity: 0.24, vertices: points, faces });
    }
  }
  for (const block of xmlElementBlocksAny(text, ["polygonal_face_set", "PolygonalFaceSet"])) {
    const points = stepXmlReferencedPointList(block, pointLists, lengthFormat);
    const faceBlocks = xmlElementBlocksAny(block.body, ["indexed_polygonal_face", "IndexedPolygonalFace"]);
    const faces = [];
    for (const faceBlock of faceBlocks) {
      const coordIndex = xmlFirstElementBlockAny(faceBlock.body, ["coord_index", "CoordIndex"]);
      for (const face of ifcXmlFaceIndexes(coordIndex?.body || faceBlock.body)) {
        const meshFace = ifcXmlMeshFace(face, points);
        if (meshFace) faces.push(meshFace);
      }
    }
    if (points.length >= 3 && faces.length) {
      doc.meshes.push({ id: `${base}_stepxml_poly_${doc.meshes.length + 1}`, layer: "stepxml", color: DEFAULT_MESH_COLOR, opacity: 0.24, vertices: points, faces });
    }
  }
  for (const block of xmlElementBlocksAny(text, ["polyline", "Polyline"])) {
    const points = stepXmlPolylinePoints(block, cartesianPoints, lengthFormat);
    if (points.length >= 2) doc.polylines.push({ id: `${base}_stepxml_line_${doc.polylines.length + 1}`, layer: "stepxml", color: DEFAULT_COLOR, points });
  }
  for (const block of xmlElementBlocksAny(text, ["poly_loop", "PolyLoop"])) {
    const points = stepXmlPolylinePoints(block, cartesianPoints, lengthFormat);
    if (points.length >= 3) doc.polylines.push({ id: `${base}_stepxml_loop_${doc.polylines.length + 1}`, layer: "stepxml", color: DEFAULT_COLOR, closed: true, points });
  }
  for (const block of xmlElementBlocksAny(text, ["indexed_poly_curve", "IndexedPolyCurve"])) {
    const points = xmlIndexedCurvePoints(block, pointLists, ["line_index", "LineIndex", "arc_index", "ArcIndex"], (item, lists) => stepXmlReferencedPointList(item, lists, lengthFormat));
    if (points.length >= 2) doc.polylines.push({ id: `${base}_stepxml_indexed_curve_${doc.polylines.length + 1}`, layer: "stepxml", color: DEFAULT_COLOR, points });
  }
  if (!doc.meshes.length && !doc.polylines.length && cartesianPoints.size) {
    doc.pointClouds.push({ id: `${base}_stepxml_points`, layer: "stepxml", color: DEFAULT_POINT_COLOR, pointSize: 3, points: [...cartesianPoints.values()] });
  }
  if (doc.meshes.length || doc.polylines.length || doc.pointClouds.length) {
    doc.diagnostics.push(diag("info", "stepxml-browser-geometry", `Browser STEP XML importer extracted ${doc.meshes.length} mesh(es), ${doc.polylines.length} polyline(s), and ${doc.pointClouds.length} point cloud(s).`));
  } else {
    doc.diagnostics.push(diag("warning", "stepxml-no-supported-geometry", "Browser STEP XML importer found no supported triangulated_face_set, polygonal_face_set, polyline, poly_loop, or cartesian_point geometry."));
  }
  return doc;
}

function embeddedDxfText(bytes) {
  const text = textFromBytes(bytes);
  const section = /0\s*(?:\r\n|\n|\r)\s*SECTION\s*(?:\r\n|\n|\r)/i.exec(text);
  if (!section) return null;
  const eofMatch = /\s*0\s*(?:\r\n|\n|\r)\s*EOF\b/i.exec(text.slice(section.index));
  if (!eofMatch) return null;
  const start = section.index;
  const end = section.index + eofMatch.index + eofMatch[0].length;
  const candidate = text.slice(start, end);
  if (dxfPairScore(dxfPairs(candidate)) < 3) return null;
  return { text: candidate, offset: new TextEncoder().encode(text.slice(0, start)).length };
}

function e57LogicalSection(bytes, physicalOffset, logicalLength, pageSize) {
  if (!Number.isFinite(physicalOffset) || !Number.isFinite(logicalLength) || physicalOffset < 0 || logicalLength <= 0 || physicalOffset >= bytes.length) return null;
  if (!Number.isFinite(pageSize) || pageSize <= 4) return bytes.subarray(physicalOffset, Math.min(bytes.length, physicalOffset + logicalLength));
  const pagePayload = pageSize - 4;
  const out = new Uint8Array(Math.min(logicalLength, Math.max(0, bytes.length - physicalOffset)));
  let written = 0;
  let physical = physicalOffset;
  while (written < logicalLength && physical < bytes.length) {
    const take = Math.min(pagePayload, logicalLength - written, Math.max(0, bytes.length - physical));
    out.set(bytes.subarray(physical, physical + take), written);
    written += take;
    physical += pageSize;
  }
  return out.subarray(0, written);
}

function xmlNumber(xml, tag) {
  const qtag = `(?:[A-Za-z_][\\w.-]*:)?${tag}`;
  const match = new RegExp(`<${qtag}\\b[^>]*>\\s*([-+0-9.EeDd]+)\\s*</${qtag}>`, "i").exec(xml);
  return match ? number(match[1]) : null;
}

function e57XmlMetadata(xml, format) {
  const source = String(xml || "");
  const recordCounts = [
    ...[...source.matchAll(/\brecordCount\s*=\s*["'](\d+)["']/gi)].map((match) => Number.parseInt(match[1], 10)),
    ...[...source.matchAll(/<(?:[A-Za-z_][\w.-]*:)?recordCount\b[^>]*>\s*(\d+)\s*<\/(?:[A-Za-z_][\w.-]*:)?recordCount>/gi)].map((match) => Number.parseInt(match[1], 10))
  ].filter(Number.isFinite);
  const count = recordCounts.length ? recordCounts.reduce((sum, value) => sum + value, 0) : null;
  const boundsBlocks = [...source.matchAll(/<(?:[A-Za-z_][\w.-]*:)?cartesianBounds\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?cartesianBounds>/gi)].map((match) => match[1]);
  if (!boundsBlocks.length) boundsBlocks.push(source);
  let bounds = null;
  for (const block of boundsBlocks) {
    const xMin = xmlNumber(block, "xMinimum");
    const xMax = xmlNumber(block, "xMaximum");
    const yMin = xmlNumber(block, "yMinimum");
    const yMax = xmlNumber(block, "yMaximum");
    const zMin = xmlNumber(block, "zMinimum");
    const zMax = xmlNumber(block, "zMaximum");
    if (![xMin, xMax, yMin, yMax, zMin, zMax].every(Number.isFinite)) continue;
    const item = { min: scalePoint([xMin, yMin, zMin], format), max: scalePoint([xMax, yMax, zMax], format) };
    if (!bounds) bounds = item;
    else {
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], item.min[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], item.max[axis]);
      }
    }
  }
  return { count, bounds };
}

function parseE57(bytes, file, format) {
  const doc = emptyDoc();
  doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
  if (!bytesStart(bytes, [0x41, 0x53, 0x54, 0x4d, 0x2d, 0x45, 0x35, 0x37]) || bytes.length < 48) {
    const text = textFromBytes(bytes);
    if (pointTextLooksLike(text)) {
      const pointDoc = parsePointText(text, file, "xyz");
      pointDoc.sourcePatch = { ...(pointDoc.sourcePatch || {}), e57DetectedPayloadFormat: "point-text" };
      pointDoc.diagnostics.unshift(diag("info", "e57-payload-is-point-text", `${format.toUpperCase()}-named file contains text point rows, so the built-in point text importer handled it.`));
      return pointDoc;
    }
    doc.diagnostics.push(diag("warning", "e57-built-in-decoder-missing", `${format.toUpperCase()} needs a binary E57 point-cloud decoder. No external decoder is loaded; implement a built-in E57 reader here or import XYZ/PTS/ASC/CSV/PCD/PLY/LAS point data.`));
    return doc;
  }
  const major = u32(bytes, 8);
  const minor = u32(bytes, 12);
  const filePhysicalLength = u64(bytes, 16);
  const xmlPhysicalOffset = u64(bytes, 24);
  const xmlLogicalLength = u64(bytes, 32);
  const pageSize = u64(bytes, 40);
  doc.sourcePatch = {
    e57Version: `${major}.${minor}`,
    e57FilePhysicalLength: filePhysicalLength,
    e57XmlPhysicalOffset: xmlPhysicalOffset,
    e57XmlLogicalLength: xmlLogicalLength,
    e57PageSize: pageSize
  };
  const xmlBytes = e57LogicalSection(bytes, xmlPhysicalOffset, xmlLogicalLength, pageSize);
  if (xmlBytes?.length) {
    const xml = textFromBytes(xmlBytes);
    const metadata = e57XmlMetadata(xml, format);
    if (metadata.count !== null) doc.sourcePatch.e57SourcePointCount = metadata.count;
    if (metadata.bounds) {
      doc.sourcePatch.e57XmlBounds = metadata.bounds;
      if (addBoundsBoxLines(doc, file, metadata.bounds, "e57_bounds")) {
        doc.diagnostics.push(diag("info", "e57-bounds-preview", `${format.toUpperCase()} XML cartesian bounds were rendered as a reference bounding box because compressed point records are not decoded yet.`));
      }
    }
    doc.diagnostics.push(diag("warning", "e57-metadata-only", `${format.toUpperCase()} header/XML metadata was read in the browser, but compressed point records are not decoded yet. Import XYZ/PTS/ASC/CSV/PCD/PLY/LAS for visible points until the built-in E57 packet decoder is implemented.`));
  } else {
    doc.diagnostics.push(diag("warning", "e57-xml-unreadable", `${format.toUpperCase()} header was read, but the XML section could not be reconstructed in the browser.`));
  }
  return doc;
}

function dxfPairs(text) {
  const raw = textLines(text);
  const pairs = [];
  for (let index = 0; index < raw.length - 1;) {
    const code = raw[index].trim();
    const value = raw[index + 1]?.trimEnd() ?? "";
    index += 2;
    if (!code) continue;
    if (code === "999") continue;
    pairs.push([code, value]);
  }
  return pairs;
}

function dxfPairScore(pairs) {
  const known = new Set(["SECTION", "ENDSEC", "EOF", "LINE", "LWPOLYLINE", "POLYLINE", "VERTEX", "SEQEND", "POINT", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "MESH", "LEADER", "MLINE", "3DFACE", "SOLID", "TRACE", "HATCH", "DIMENSION"]);
  return pairs.reduce((sum, [code, value]) => sum + (code === "0" && known.has(String(value).toUpperCase()) ? 2 : 0), 0);
}

function dxfInsunitsScale(pairs) {
  const units = new Map([
    [1, 25.4], [2, 304.8], [3, 1609344], [4, 1], [5, 10], [6, 1000], [7, 1000000],
    [8, 0.0000254], [9, 0.0254], [10, 914.4], [11, 0.0000001], [12, 0.000001],
    [13, 0.001], [14, 100], [15, 10000], [16, 100000], [17, 1000000000000],
    [18, 149597870700000], [19, 9460730472580800000], [20, 30856775814913673000]
  ]);
  const names = new Map([
    [1, "inches"], [2, "feet"], [3, "miles"], [4, "millimeters"], [5, "centimeters"], [6, "meters"], [7, "kilometers"],
    [8, "microinches"], [9, "mils"], [10, "yards"], [11, "angstroms"], [12, "nanometers"], [13, "microns"],
    [14, "decimeters"], [15, "decameters"], [16, "hectometers"], [17, "gigameters"], [18, "astronomical units"],
    [19, "light years"], [20, "parsecs"]
  ]);
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index][0] !== "9" || String(pairs[index][1]).toUpperCase() !== "$INSUNITS") continue;
    for (let next = index + 1; next < pairs.length; next += 1) {
      if (next > index + 1 && pairs[next][0] === "9") break;
      if (pairs[next][0] !== "70" && pairs[next][0] !== "280") continue;
      const code = Math.trunc(number(pairs[next][1]) || 0);
      return { code, name: names.get(code) || "unitless", scale: units.get(code) || 1 };
    }
  }
  return null;
}

function dxfPoint(groups, xCode, yCode, zCode = "") {
  const x = number(groups.get(String(xCode)));
  const y = number(groups.get(String(yCode)));
  const z = zCode ? number(groups.get(String(zCode))) : 0;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y, Number.isFinite(z) ? z : 0] : null;
}

function dxfValues(pairs, code) {
  return pairs.filter(([itemCode]) => itemCode === String(code)).map(([, value]) => number(value)).filter(Number.isFinite);
}

function dxfPointList(pairs, xCode, yCode, zCode = String(Number(xCode) + 20)) {
  const points = [];
  let current = null;
  for (const [code, value] of pairs) {
    if (code === String(xCode)) {
      if (current?.length === 3 && current.slice(0, 2).every(Number.isFinite)) points.push([current[0], current[1], Number.isFinite(current[2]) ? current[2] : 0]);
      current = [number(value), null, 0];
    } else if (current && code === String(yCode)) current[1] = number(value);
    else if (current && code === String(zCode)) current[2] = number(value) || 0;
  }
  if (current?.length === 3 && current.slice(0, 2).every(Number.isFinite)) points.push([current[0], current[1], Number.isFinite(current[2]) ? current[2] : 0]);
  return points;
}

function dxfVector(pairs, xCode, yCode, zCode = String(Number(xCode) + 20)) {
  return dxfPointList(pairs, xCode, yCode, zCode)[0] || null;
}

function circlePolyline(center, radius, startDeg = 0, endDeg = 360) {
  let span = endDeg - startDeg;
  const full = Math.abs(span) >= 359.999;
  if (full) span = span < 0 ? -360 : 360;
  else if (span < 0) span += 360;
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
  const steps = Math.max(16, Math.ceil(Math.abs(span) / (Math.PI / 18)));
  const minor = [-major[1] * ratio, major[0] * ratio, 0];
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = start + span * index / steps;
    points.push([
      center[0] + major[0] * Math.cos(t) + minor[0] * Math.sin(t),
      center[1] + major[1] * Math.cos(t) + minor[1] * Math.sin(t),
      center[2] + major[2] * Math.cos(t)
    ]);
  }
  return { points, closed: full };
}

function bulgePoints(a, b, bulge) {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-9) return [a, b];
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
    const angle = start + theta * index / steps;
    points.push([center[0] + Math.cos(angle) * Math.abs(radius), center[1] + Math.sin(angle) * Math.abs(radius), a[2] + (b[2] - a[2]) * index / steps]);
  }
  return points;
}

function lwPolylinePoints(pairs, closed) {
  const elevation = number(pairs.find(([code]) => code === "38")?.[1]) || 0;
  const vertices = [];
  let current = null;
  for (const [code, value] of pairs) {
    if (code === "10") {
      if (current?.point?.slice(0, 2).every(Number.isFinite)) vertices.push(current);
      current = { point: [number(value), null, elevation], bulge: 0 };
    } else if (current && code === "20") current.point[1] = number(value);
    else if (current && code === "30") current.point[2] = number(value) || elevation;
    else if (current && code === "42") current.bulge = number(value) || 0;
  }
  if (current?.point?.slice(0, 2).every(Number.isFinite)) vertices.push(current);
  if (vertices.length < 2) return [];
  const points = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < count; index += 1) {
    const segment = bulgePoints(vertices[index].point, vertices[(index + 1) % vertices.length].point, vertices[index].bulge);
    points.push(...(points.length ? segment.slice(1) : segment));
  }
  return points;
}

function dxfHatchLoops(pairs) {
  const samePoint = (a, b) => a?.length === 3 && b?.length === 3 && a.every((value, axis) => Math.abs(value - b[axis]) < 1e-8);
  const splineEdgePoints = (edgePairs) => {
    const controls = dxfPointList(edgePairs, "10", "20", "30");
    if (controls.length < 2) return [];
    const degree = Math.max(1, Math.min(8, Math.trunc(number(edgePairs.find(([code]) => code === "94" || code === "71")?.[1]) || 3)));
    const knots = dxfValues(edgePairs, "40");
    const weights = dxfValues(edgePairs, "42").length ? dxfValues(edgePairs, "42") : dxfValues(edgePairs, "41");
    if (degree >= controls.length || knots.length < controls.length + degree + 1) return controls;
    const start = knots[degree];
    const end = knots[controls.length];
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return controls;
    const steps = Math.max(12, controls.length * 10);
    const out = [];
    for (let item = 0; item <= steps; item += 1) out.push(bsplinePoint(controls, knots, weights, degree, start + (end - start) * item / steps));
    return out.filter((point) => point.every(Number.isFinite));
  };
  const arcEdgePoints = (center, radius, startDeg, endDeg, ccw) => {
    let span = endDeg - startDeg;
    if (ccw) {
      if (span < 0) span += 360;
    } else if (span > 0) span -= 360;
    const steps = Math.max(4, Math.ceil(Math.abs(span) / 10));
    const points = [];
    for (let item = 0; item <= steps; item += 1) {
      const angle = (startDeg + span * item / steps) * Math.PI / 180;
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius, center[2]]);
    }
    return points;
  };
  const loops = [];
  for (let index = 0; index < pairs.length; index += 1) {
    if (pairs[index][0] !== "92") continue;
    const pathType = Math.trunc(number(pairs[index][1]) || 0);
    const polylinePath = (pathType & 2) === 2;
    let cursor = index + 1;
    let closed = false;
    let count = 0;
    for (; cursor < pairs.length; cursor += 1) {
      const [code, value] = pairs[cursor];
      if (code === "92") break;
      if (code === "73") closed = Math.trunc(number(value) || 0) === 1;
      if (code === "93") {
        count = Math.max(0, Math.trunc(number(value) || 0));
        cursor += 1;
        break;
      }
    }
    if (count < (polylinePath ? 2 : 1)) continue;
    if (!polylinePath) {
      const points = [];
      for (let edge = 0; edge < count && cursor < pairs.length; edge += 1) {
        while (cursor < pairs.length && pairs[cursor][0] !== "72" && pairs[cursor][0] !== "92") cursor += 1;
        if (pairs[cursor]?.[0] !== "72") break;
        const edgeType = Math.trunc(number(pairs[cursor][1]) || 0);
        const edgePairs = [];
        cursor += 1;
        while (cursor < pairs.length && pairs[cursor][0] !== "72" && pairs[cursor][0] !== "92") edgePairs.push(pairs[cursor++]);
        const groups = new Map(edgePairs);
        let segment = [];
        if (edgeType === 1) {
          const start = dxfPoint(groups, 10, 20, 30);
          const end = dxfPoint(groups, 11, 21, 31);
          if (start && end) segment = [start, end];
        } else if (edgeType === 2) {
          const center = dxfPoint(groups, 10, 20, 30);
          const radius = number(groups.get("40"));
          const start = number(groups.get("50"));
          const end = number(groups.get("51"));
          const ccw = Math.trunc(number(groups.get("73")) || 0) === 1;
          if (center && radius > 0 && Number.isFinite(start) && Number.isFinite(end)) segment = arcEdgePoints(center, radius, start, end, ccw);
        } else if (edgeType === 3) {
          const center = dxfPoint(groups, 10, 20, 30);
          const major = dxfVector(edgePairs, "11", "21", "31");
          const ratio = number(groups.get("40"));
          const start = number(groups.get("50"));
          const end = number(groups.get("51"));
          const ccw = Math.trunc(number(groups.get("73")) || 0) === 1;
          if (center && major && ratio > 0 && Number.isFinite(start) && Number.isFinite(end)) {
            const item = ellipsePolyline(center, major, ratio, start * Math.PI / 180, end * Math.PI / 180);
            segment = ccw ? item.points : [...item.points].reverse();
          }
        } else if (edgeType === 4) {
          segment = splineEdgePoints(edgePairs);
        }
        if (segment.length >= 2) points.push(...(points.length ? segment.slice(1) : segment));
      }
      if (points.length > 2 && samePoint(points.at(-1), points[0])) {
        points.pop();
        closed = true;
      }
      if (points.length >= 2) loops.push({ points, closed });
      index = cursor - 1;
      continue;
    }
    const vertices = [];
    let current = null;
    const pushCurrent = () => {
      if (current?.point?.slice(0, 2).every(Number.isFinite)) vertices.push(current);
      current = null;
    };
    for (; cursor < pairs.length && vertices.length < count; cursor += 1) {
      const [code, value] = pairs[cursor];
      if (code === "10") {
        pushCurrent();
        current = { point: [number(value), null, 0], bulge: 0 };
      } else if (current && code === "20") current.point[1] = number(value);
      else if (current && code === "30") current.point[2] = number(value) || 0;
      else if (current && code === "42") current.bulge = number(value) || 0;
    }
    pushCurrent();
    if (vertices.length < 2) continue;
    const points = [];
    const segmentCount = closed ? vertices.length : vertices.length - 1;
    for (let item = 0; item < segmentCount; item += 1) {
      const segment = bulgePoints(vertices[item].point, vertices[(item + 1) % vertices.length].point, vertices[item].bulge);
      points.push(...(points.length ? segment.slice(1) : segment));
    }
    if (closed && points.length > 2 && samePoint(points.at(-1), points[0])) points.pop();
    if (points.length >= 2) loops.push({ points, closed });
    index = cursor - 1;
  }
  return loops;
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

function splinePoints(pairs) {
  const fitPoints = dxfPointList(pairs, "11", "21", "31");
  if (fitPoints.length >= 2) return fitPoints;
  const controls = dxfPointList(pairs, "10", "20", "30");
  if (controls.length < 2) return [];
  const degree = Math.max(1, Math.min(8, Math.floor(number(pairs.find(([code]) => code === "71")?.[1]) || 3)));
  const knots = dxfValues(pairs, "40");
  const weights = dxfValues(pairs, "41");
  if (degree >= controls.length || knots.length < controls.length + degree + 1) return controls;
  const start = knots[degree];
  const end = knots[controls.length];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return controls;
  const steps = Math.max(12, controls.length * 8);
  const out = [];
  for (let index = 0; index <= steps; index += 1) out.push(bsplinePoint(controls, knots, weights, degree, start + (end - start) * index / steps));
  return out.filter((point) => point.every(Number.isFinite));
}

function dxfMeshFaces(pairs, vertexCount) {
  const start = pairs.findIndex(([code]) => code === "93");
  if (start < 0) return [];
  const expected = Math.max(0, Math.trunc(number(pairs[start][1]) || 0));
  const values = [];
  for (const [code, value] of pairs.slice(start + 1)) {
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

function entityLayer(groups) {
  return cleanId(groups.get("8") || "reference", "reference");
}

function layer(doc, id, color = DEFAULT_COLOR) {
  if (!doc.layers[id]) doc.layers[id] = { name: id, color };
  return id;
}

const DXF_ENTITY_TYPES = new Set(["LINE", "POINT", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE", "MESH", "LEADER", "MLINE", "3DFACE", "SOLID", "TRACE", "INSERT", "HATCH", "DIMENSION"]);

function dxfEntityRecords(pairs) {
  const entities = [];
  const blocks = new Map();
  let section = "";
  let wantSectionName = false;
  let current = null;
  let currentBlock = null;
  const addGroup = (target, code, value) => {
    target.pairs.push([code, value]);
    target.groups.set(code, value);
  };
  const finishVertex = () => {
    if (!current?.vertex) return;
    const vertex = current.vertex;
    current.vertexRecords.push(vertex);
    const point = dxfPoint(vertex, 10, 20, 30);
    if (point) current.vertices.push(point);
    current.vertex = null;
  };
  const finishEntity = () => {
    finishVertex();
    if (!current) return;
    if (current.type === "BLOCK") {
      currentBlock.name = current.groups.get("2") || currentBlock.name;
      currentBlock.base = dxfPoint(current.groups, 10, 20, 30) || [0, 0, 0];
    } else if (section === "ENTITIES") {
      entities.push(current);
    } else if (section === "BLOCKS" && currentBlock) {
      currentBlock.entities.push(current);
    }
    current = null;
  };
  const finishBlock = () => {
    finishEntity();
    if (!currentBlock?.name) {
      currentBlock = null;
      return;
    }
    blocks.set(currentBlock.name, currentBlock);
    blocks.set(String(currentBlock.name).toUpperCase(), currentBlock);
    currentBlock = null;
  };
  for (const [code, value] of pairs) {
    const upper = String(value).toUpperCase();
    if (code === "0") {
      if (upper === "SECTION") {
        finishBlock();
        finishEntity();
        section = "";
        wantSectionName = true;
        continue;
      }
      if (upper === "ENDSEC" || upper === "EOF") {
        finishBlock();
        finishEntity();
        section = "";
        wantSectionName = false;
        if (upper === "EOF") break;
        continue;
      }
      if (section === "BLOCKS" && upper === "ENDBLK") {
        finishBlock();
        continue;
      }
      if (upper === "VERTEX" && current?.type === "POLYLINE") {
        finishVertex();
        current.vertex = new Map();
        continue;
      }
      if (upper === "SEQEND") {
        finishEntity();
        continue;
      }
      finishEntity();
      if (section === "BLOCKS" && upper === "BLOCK") {
        currentBlock = { name: "", base: [0, 0, 0], entities: [] };
        current = { type: "BLOCK", groups: new Map(), pairs: [], vertices: [], vertexRecords: [] };
      } else if ((section === "ENTITIES" || section === "BLOCKS") && DXF_ENTITY_TYPES.has(upper)) {
        current = { type: upper, groups: new Map(), pairs: [], vertices: [], vertexRecords: [] };
      }
      continue;
    }
    if (wantSectionName && code === "2") {
      section = upper;
      wantSectionName = false;
      continue;
    }
    if (!current) continue;
    if (current.type === "POLYLINE" && current.vertex) {
      current.vertex.set(code, value);
      continue;
    }
    if (current.type === "LWPOLYLINE" && code === "10") current.pendingX = number(value);
    else if (current.type === "LWPOLYLINE" && code === "20" && Number.isFinite(current.pendingX)) {
      current.vertices.push([current.pendingX, number(value) || 0, number(current.groups.get("38")) || 0]);
      current.pendingX = null;
    }
    addGroup(current, code, value);
  }
  finishBlock();
  finishEntity();
  return { entities, blocks };
}

function dxfPolyface(entity) {
  const vertices = [];
  const faces = [];
  const vertexRecords = entity.vertexRecords || [];
  for (const vertex of vertexRecords) {
    const indices = [71, 72, 73, 74].map((code) => Math.abs(Math.trunc(number(vertex.get(String(code))) || 0))).filter(Boolean);
    const point = dxfPoint(vertex, 10, 20, 30);
    if (indices.length >= 3) {
      const face = indices.map((index) => index - 1).filter((index, itemIndex, items) => index >= 0 && index < vertices.length && items.indexOf(index) === itemIndex);
      if (face.length >= 3) faces.push(face);
    } else if (point) vertices.push(point);
  }
  return vertices.length >= 3 && faces.length ? { vertices, faces } : null;
}

function dxfPolygonMesh(entity) {
  const m = Math.trunc(number(entity.groups.get("71")) || 0);
  const n = Math.trunc(number(entity.groups.get("72")) || 0);
  if (m < 2 || n < 2 || entity.vertices.length < m * n) return null;
  const faces = [];
  for (let row = 0; row < m - 1; row += 1) {
    for (let column = 0; column < n - 1; column += 1) {
      const a = row * n + column;
      faces.push([a, a + n, a + n + 1, a + 1]);
    }
  }
  return { vertices: entity.vertices.slice(0, m * n), faces };
}

function dxfPolylinePoints(entity, closed) {
  const vertices = (entity.vertexRecords || [])
    .map((record) => ({ point: dxfPoint(record, 10, 20, 30), bulge: number(record.get("42")) || 0 }))
    .filter((vertex) => vertex.point);
  if (!vertices.length) vertices.push(...entity.vertices.map((point) => ({ point, bulge: 0 })));
  if (vertices.length < 2) return [];
  const points = [];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < count; index += 1) {
    const segment = bulgePoints(vertices[index].point, vertices[(index + 1) % vertices.length].point, vertices[index].bulge);
    points.push(...(points.length ? segment.slice(1) : segment));
  }
  return points;
}

function dxfInsertTransform(groups, block) {
  const insertion = dxfPoint(groups, 10, 20, 30) || [0, 0, 0];
  const base = block?.base || [0, 0, 0];
  const sx = number(groups.get("41")) ?? 1;
  const sy = number(groups.get("42")) ?? sx;
  const sz = number(groups.get("43")) ?? sx;
  const angle = (number(groups.get("50")) || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (point) => {
    const x = (point[0] - base[0]) * sx;
    const y = (point[1] - base[1]) * sy;
    const z = (point[2] - base[2]) * sz;
    return [insertion[0] + x * cos - y * sin, insertion[1] + x * sin + y * cos, insertion[2] + z];
  };
}

function dxfOcsMapper(groups) {
  const normal = normalizeVector(dxfPoint(groups, 210, 220, 230) || [0, 0, 1], [0, 0, 1]);
  if (Math.abs(normal[0]) < 1e-12 && Math.abs(normal[1]) < 1e-12 && Math.abs(normal[2] - 1) < 1e-12) return (point) => point;
  const reference = Math.abs(normal[0]) < 1 / 64 && Math.abs(normal[1]) < 1 / 64 ? [0, 1, 0] : [0, 0, 1];
  const xAxis = normalizeVector(cross(reference, normal), [1, 0, 0]);
  const yAxis = normalizeVector(cross(normal, xAxis), [0, 1, 0]);
  return (point) => [
    xAxis[0] * point[0] + yAxis[0] * point[1] + normal[0] * point[2],
    xAxis[1] * point[0] + yAxis[1] * point[1] + normal[1] * point[2],
    xAxis[2] * point[0] + yAxis[2] * point[1] + normal[2] * point[2]
  ];
}

function parseDxf(text, file, format) {
  const doc = emptyDoc();
  const pairs = dxfPairs(text);
  const insunits = dxfInsunitsScale(pairs);
  const unitFormat = insunits ? insunits.scale : format;
  if (insunits) {
    doc.sourcePatch = { ...(doc.sourcePatch || {}), dxfInsunits: insunits.code, dxfInsunitsName: insunits.name, dxfUnitScaleToMm: insunits.scale };
    if (insunits.code !== 0 && insunits.scale !== 1) doc.diagnostics.push(diag("info", "dxf-insunits-scale", `Browser DXF importer applied $INSUNITS ${insunits.code} (${insunits.name}) scale ${insunits.scale} mm per drawing unit.`));
  }
  const { entities, blocks } = dxfEntityRecords(pairs);
  const pointItems = [];
  const emit = (entity, transform = (point) => point, depth = 0) => {
    if (!entity) return;
    const type = entity.type;
    const groups = entity.groups;
    const itemLayer = layer(doc, entityLayer(groups));
    const ocs = ["LWPOLYLINE", "CIRCLE", "ARC", "ELLIPSE", "HATCH"].includes(type) ? dxfOcsMapper(groups) : (point) => point;
    const outPoint = (point) => scalePoint(transform(ocs(point)), unitFormat);
    if (type === "LINE") {
      const a = dxfPoint(groups, 10, 20, 30);
      const b = dxfPoint(groups, 11, 21, 31);
      if (a && b) doc.lines.push({ id: `${cleanId(file.name)}_line_${doc.lines.length + 1}`, layer: itemLayer, points: [outPoint(a), outPoint(b)] });
    } else if (type === "POINT") {
      const point = dxfPoint(groups, 10, 20, 30);
      if (point) pointItems.push(outPoint(point));
    } else if (type === "LWPOLYLINE") {
      const points = lwPolylinePoints(entity.pairs, (Number(groups.get("70")) & 1) === 1).map(outPoint);
      if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_polyline_${doc.polylines.length + 1}`, layer: itemLayer, closed: (Number(groups.get("70")) & 1) === 1, points });
    } else if (type === "POLYLINE") {
      const flags = Number(groups.get("70")) || 0;
      const mesh = (flags & 64) ? dxfPolyface(entity) : ((flags & 16) ? dxfPolygonMesh(entity) : null);
      if (mesh) doc.meshes.push({ id: `${cleanId(file.name)}_mesh_${doc.meshes.length + 1}`, layer: itemLayer, color: DEFAULT_MESH_COLOR, opacity: 0.18, vertices: mesh.vertices.map(outPoint), faces: mesh.faces });
      else {
        const ocsPolyline = dxfOcsMapper(groups);
        const points = dxfPolylinePoints(entity, (flags & 1) === 1).map((point) => scalePoint(transform(ocsPolyline(point)), unitFormat));
        if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_polyline_${doc.polylines.length + 1}`, layer: itemLayer, closed: (flags & 1) === 1, points });
      }
    } else if (type === "HATCH") {
      for (const loop of dxfHatchLoops(entity.pairs)) {
        const points = loop.points.map(outPoint);
        if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_hatch_${doc.polylines.length + 1}`, layer: itemLayer, closed: loop.closed, points });
      }
    } else if (type === "LEADER" || type === "MLINE") {
      const points = dxfPointList(entity.pairs, type === "LEADER" ? "10" : "11", type === "LEADER" ? "20" : "21", type === "LEADER" ? "30" : "31").map(outPoint);
      if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_${type.toLowerCase()}_${doc.polylines.length + 1}`, layer: itemLayer, points });
    } else if (type === "CIRCLE" || type === "ARC") {
      const center = dxfPoint(groups, 10, 20, 30);
      const radius = number(groups.get("40"));
      const start = type === "ARC" ? (number(groups.get("50")) || 0) * Math.PI / 180 : 0;
      const end = type === "ARC" ? (number(groups.get("51")) || 0) * Math.PI / 180 : Math.PI * 2;
      if (center && radius > 0) {
        const span = type === "ARC" && end < start ? end + Math.PI * 2 - start : end - start;
        const steps = Math.max(8, Math.ceil(Math.abs(span) / (Math.PI / 16)));
        const points = [];
        for (let index = 0; index <= steps; index += 1) {
          const angle = start + span * index / steps;
          points.push(outPoint([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius, center[2]]));
        }
        doc.polylines.push({ id: `${cleanId(file.name)}_${type.toLowerCase()}_${doc.polylines.length + 1}`, layer: itemLayer, closed: type === "CIRCLE", points: type === "CIRCLE" ? points.slice(0, -1) : points });
      }
    } else if (type === "ELLIPSE") {
      const center = dxfPoint(groups, 10, 20, 30);
      const major = dxfVector(entity.pairs, "11", "21", "31");
      const ratio = number(groups.get("40"));
      if (center && major && ratio > 0) {
        const item = ellipsePolyline(center, major, ratio, number(groups.get("41")) ?? 0, number(groups.get("42")) ?? Math.PI * 2);
        const points = item.points.map(outPoint);
        if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_ellipse_${doc.polylines.length + 1}`, layer: itemLayer, closed: item.closed, points });
      }
    } else if (type === "SPLINE") {
      const points = splinePoints(entity.pairs).map(outPoint);
      if (points.length >= 2) doc.polylines.push({ id: `${cleanId(file.name)}_spline_${doc.polylines.length + 1}`, layer: itemLayer, closed: (Number(groups.get("70")) & 1) === 1, points });
    } else if (type === "MESH") {
      const vertices = dxfPointList(entity.pairs, "10", "20", "30").map(outPoint);
      const faces = dxfMeshFaces(entity.pairs, vertices.length);
      if (vertices.length >= 3 && faces.length) doc.meshes.push({ id: `${cleanId(file.name)}_mesh_${doc.meshes.length + 1}`, layer: itemLayer, color: DEFAULT_MESH_COLOR, opacity: 0.18, vertices, faces });
    } else if (type === "3DFACE" || type === "SOLID" || type === "TRACE") {
      const order = type === "3DFACE" ? [10, 11, 12, 13] : [10, 11, 13, 12];
      const vertices = order.map((code) => dxfPoint(groups, code, code + 10, code + 20)).filter(Boolean);
      const unique = vertices.filter((point, index) => vertices.findIndex((item) => item.every((value, axis) => value === point[axis])) === index);
      if (unique.length >= 3) doc.meshes.push({ id: `${cleanId(file.name)}_face_${doc.meshes.length + 1}`, layer: itemLayer, color: DEFAULT_MESH_COLOR, opacity: 0.18, vertices: unique.map(outPoint), faces: [unique.map((_, index) => index)] });
    } else if (type === "INSERT") {
      if (depth > 8) {
        doc.diagnostics.push(diag("warning", "dxf-insert-depth-limit", `DXF INSERT nesting depth exceeded near block ${groups.get("2") || ""}.`));
        return;
      }
      const blockName = groups.get("2");
      const block = blocks.get(blockName) || blocks.get(String(blockName || "").toUpperCase());
      if (!block) {
        doc.diagnostics.push(diag("warning", "dxf-insert-block-missing", `DXF INSERT references missing block ${blockName || ""}.`));
        return;
      }
      const insertTransform = dxfInsertTransform(groups, block);
      for (const child of block.entities) {
        emit(child, (point) => transform(insertTransform(point)), depth + 1);
      }
    } else if (type === "DIMENSION") {
      if (depth > 8) {
        doc.diagnostics.push(diag("warning", "dxf-dimension-depth-limit", `DXF DIMENSION nesting depth exceeded near block ${groups.get("2") || ""}.`));
        return;
      }
      const blockName = groups.get("2");
      const block = blocks.get(blockName) || blocks.get(String(blockName || "").toUpperCase());
      if (!block) {
        doc.diagnostics.push(diag("warning", "dxf-dimension-block-missing", `DXF DIMENSION references missing anonymous block ${blockName || ""}.`));
        return;
      }
      for (const child of block.entities) emit(child, transform, depth + 1);
    }
  };
  for (const entity of entities) emit(entity);
  if (!entities.length && !pairs.some(([code, value]) => code === "2" && String(value).toUpperCase() === "ENTITIES")) {
    let current = null;
    for (const [code, value] of pairs) {
      const upper = String(value).toUpperCase();
      if (code === "0") {
        emit(current);
        current = DXF_ENTITY_TYPES.has(upper) ? { type: upper, groups: new Map(), pairs: [], vertices: [], vertexRecords: [] } : null;
        continue;
      }
      if (!current) continue;
      current.pairs.push([code, value]);
      if (current.type === "LWPOLYLINE" && code === "10") current.pendingX = number(value);
      else if (current.type === "LWPOLYLINE" && code === "20" && Number.isFinite(current.pendingX)) {
        current.vertices.push([current.pendingX, number(value) || 0, number(current.groups.get("38")) || 0]);
        current.pendingX = null;
      } else current.groups.set(code, value);
    }
    emit(current);
  }
  if (pointItems.length) doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: layer(doc, "points", DEFAULT_POINT_COLOR), color: DEFAULT_POINT_COLOR, pointSize: 3, points: pointItems });
  if (!doc.lines.length && !doc.polylines.length && !doc.meshes.length && !doc.pointClouds.length) doc.diagnostics.push(diag("warning", "dxf-no-supported-entities", "Browser DXF importer found no supported reference geometry."));
  return doc;
}

function parseComplexSpfParts(body) {
  const parts = [];
  const source = String(body || "");
  let cursor = 0;
  while (cursor < source.length) {
    while (/[\s,]/.test(source[cursor] || "")) cursor += 1;
    let type = "";
    while (/[A-Za-z0-9_]/.test(source[cursor] || "")) type += source[cursor++].toUpperCase();
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (!type || source[cursor] !== "(") {
      cursor += 1;
      continue;
    }
    const argsStart = cursor + 1;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "'") {
        if (inString && source[cursor + 1] === "'") {
          cursor += 1;
          continue;
        }
        inString = !inString;
      }
      if (inString) continue;
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = cursor;
          break;
        }
      }
    }
    if (end < 0) break;
    parts.push({ type, args: source.slice(argsStart, end) });
    cursor = end + 1;
  }
  return parts;
}

function parseComplexSpfEntity(body) {
  const parts = parseComplexSpfParts(body);
  const base = parts.find((part) => (part.type.endsWith("B_SPLINE_CURVE") || part.type.endsWith("BSPLINECURVE")) && !/WITH_?KNOTS/.test(part.type));
  const knots = parts.find((part) => part.type.endsWith("B_SPLINE_CURVE_WITH_KNOTS") || part.type.endsWith("BSPLINECURVEWITHKNOTS"));
  const rational = parts.find((part) => part.type.endsWith("RATIONAL_B_SPLINE_CURVE") || part.type.endsWith("RATIONALBSPLINECURVE"));
  if (base && knots) {
    return {
      type: rational ? "RATIONAL_B_SPLINE_CURVE_WITH_KNOTS" : "B_SPLINE_CURVE_WITH_KNOTS",
      args: `${base.args},${knots.args}${rational ? `,${rational.args}` : ""}`
    };
  }
  return { type: "COMPLEX_ENTITY", args: body };
}

function parseSpfEntities(text) {
  const entities = new Map();
  const source = String(text || "");
  let index = 0;
  while (index < source.length) {
    const hash = source.indexOf("#", index);
    if (hash < 0) break;
    let cursor = hash + 1;
    let id = "";
    while (/\d/.test(source[cursor] || "")) id += source[cursor++];
    if (!id) {
      index = hash + 1;
      continue;
    }
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (source[cursor] !== "=") {
      index = cursor;
      continue;
    }
    cursor += 1;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (source[cursor] === "(") {
      const argsStart = cursor + 1;
      let depth = 0;
      let inString = false;
      let end = -1;
      for (; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        if (char === "'") {
          if (inString && source[cursor + 1] === "'") {
            cursor += 1;
            continue;
          }
          inString = !inString;
        }
        if (inString) continue;
        if (char === "(") depth += 1;
        else if (char === ")") {
          depth -= 1;
          if (depth === 0) {
            end = cursor;
            break;
          }
        }
      }
      if (end < 0) break;
      entities.set(id, parseComplexSpfEntity(source.slice(argsStart, end)));
      index = end + 1;
      continue;
    }
    let type = "";
    while (/[A-Za-z0-9_]/.test(source[cursor] || "")) type += source[cursor++].toUpperCase();
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (!type || source[cursor] !== "(") {
      index = cursor + 1;
      continue;
    }
    const argsStart = cursor + 1;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "'") {
        if (inString && source[cursor + 1] === "'") {
          cursor += 1;
          continue;
        }
        inString = !inString;
      }
      if (inString) continue;
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = cursor;
          break;
        }
      }
    }
    if (end < 0) break;
    entities.set(id, { type, args: source.slice(argsStart, end) });
    index = end + 1;
  }
  return entities;
}

function splitTopLevelArgs(args) {
  const parts = [];
  const source = String(args || "");
  let depth = 0;
  let inString = false;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'") {
      if (inString && source[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
    }
    if (inString) continue;
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts;
}

function coordinateTuples(text) {
  const tuples = [];
  const pattern = /\(\s*([-+0-9.EeDd,\s]+)\s*\)/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const values = match[1].split(",").map(number);
    if (values.length >= 2 && values[0] !== null && values[1] !== null) tuples.push([values[0], values[1], values[2] ?? 0]);
  }
  return tuples;
}

function pointFromArgs(args) {
  return coordinateTuples(args).at(-1) || null;
}

function idsFromArgs(args) {
  return [...args.matchAll(/#(\d+)/g)].map((match) => match[1]);
}

function firstId(arg) {
  return /#(\d+)/.exec(String(arg || ""))?.[1] || null;
}

function integerLists(text) {
  const lists = [];
  const pattern = /\(\s*([-+0-9,\s]+)\s*\)/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const values = match[1].split(",").map((item) => Math.trunc(number(item))).filter(Number.isInteger);
    if (values.length >= 3) lists.push(values);
  }
  return lists;
}

function integerTuples(text, minLength = 2) {
  const lists = [];
  const pattern = /\(\s*([-+0-9,\s]+)\s*\)/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const values = match[1].split(",").map((item) => Math.trunc(number(item))).filter(Number.isInteger);
    if (values.length >= minLength) lists.push(values);
  }
  return lists;
}

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
}

function addPoint(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVector(vector, scale) {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeVector(vector, fallback) {
  if (!finitePoint(vector)) return fallback;
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return length > 1e-9 ? vector.map((value) => value / length) : fallback;
}

function scaledLength(value, format) {
  const numeric = number(value);
  if (!Number.isFinite(numeric)) return null;
  return scalePoint([numeric, 0, 0], format)[0];
}

function spfLengthScale(entities, fallbackScale = 1000) {
  const prefixes = new Map([
    ["EXA", 1e18], ["PETA", 1e15], ["TERA", 1e12], ["GIGA", 1e9], ["MEGA", 1e6], ["KILO", 1e3], ["HECTO", 1e2], ["DECA", 1e1],
    ["DECI", 1e-1], ["CENTI", 1e-2], ["MILLI", 1e-3], ["MICRO", 1e-6], ["NANO", 1e-9], ["PICO", 1e-12], ["FEMTO", 1e-15], ["ATTO", 1e-18]
  ]);
  const namedUnits = new Map([
    ["FOOT", 304.8], ["FEET", 304.8], ["FT", 304.8], ["INCH", 25.4], ["IN", 25.4],
    ["YARD", 914.4], ["YD", 914.4], ["MILE", 1609344]
  ]);
  const resolve = (unitId, seen = new Set()) => {
    if (!unitId || seen.has(unitId)) return null;
    seen.add(unitId);
    const entity = entities.get(unitId);
    if (!entity) return null;
    const type = entity.type.replace(/_/g, "");
    if (type === "COMPLEXENTITY" && /LENGTH_UNIT\s*\(/i.test(entity.args) && /SI_UNIT\s*\(/i.test(entity.args) && /\.METRE\./i.test(entity.args)) {
      const prefix = /SI_UNIT\s*\(\s*(?:\.([A-Z]+)\.|\$|\*)\s*,\s*\.METRE\./i.exec(entity.args)?.[1]?.toUpperCase();
      return 1000 * (prefixes.get(prefix) || 1);
    }
    if (type.endsWith("SIUNIT")) {
      if (!/\.LENGTHUNIT\./i.test(entity.args) || !/\.METRE\./i.test(entity.args)) return null;
      const prefix = /\.([A-Z]+)\.\s*,\s*\.METRE\./i.exec(entity.args)?.[1]?.toUpperCase();
      return 1000 * (prefixes.get(prefix) || 1);
    }
    if (type.endsWith("MEASUREWITHUNIT")) {
      const factor = numbersFromText(splitTopLevelArgs(entity.args)[0]).at(0);
      const baseScale = resolve(idsFromArgs(entity.args).at(-1), seen);
      return Number.isFinite(factor) && Number.isFinite(baseScale) ? factor * baseScale : null;
    }
    if (type.endsWith("CONVERSIONBASEDUNIT") || type.endsWith("CONVERSIONBASEDUNITWITHOFFSET")) {
      if (!/\.LENGTHUNIT\./i.test(entity.args)) return null;
      const measureScale = idsFromArgs(entity.args).map((id) => resolve(id, new Set(seen))).find(Number.isFinite);
      if (Number.isFinite(measureScale)) return measureScale;
      const name = /'([^']+)'/.exec(entity.args)?.[1]?.trim().toUpperCase();
      return namedUnits.get(name) || null;
    }
    if (type === "COMPLEXENTITY" && /LENGTH_UNIT\s*\(/i.test(entity.args) && /CONVERSION_BASED_UNIT\s*\(/i.test(entity.args)) {
      const measureScale = idsFromArgs(entity.args).map((id) => resolve(id, new Set(seen))).find(Number.isFinite);
      if (Number.isFinite(measureScale)) return measureScale;
      const name = /CONVERSION_BASED_UNIT\s*\(\s*'([^']+)'/i.exec(entity.args)?.[1]?.trim().toUpperCase();
      return namedUnits.get(name) || null;
    }
    return null;
  };
  for (const entity of entities.values()) {
    if (!entity.type.replace(/_/g, "").endsWith("UNITASSIGNMENT")) continue;
    const assignedScale = idsFromArgs(entity.args).map((id) => resolve(id)).find(Number.isFinite);
    if (Number.isFinite(assignedScale)) return assignedScale;
  }
  for (const [id, entity] of entities) {
    const type = entity.type.replace(/_/g, "");
    if (!type.endsWith("CONVERSIONBASEDUNIT") && !type.endsWith("CONVERSIONBASEDUNITWITHOFFSET")) continue;
    const scale = resolve(id);
    if (Number.isFinite(scale)) return scale;
  }
  for (const [id] of entities) {
    const scale = resolve(id);
    if (Number.isFinite(scale)) return scale;
  }
  return fallbackScale;
}

function identityPlacement(origin = [0, 0, 0]) {
  return { origin, x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
}

function applyPlacement(placement, point) {
  return addPoint(
    placement.origin,
    addPoint(
      addPoint(scaleVector(placement.x, point[0]), scaleVector(placement.y, point[1])),
      scaleVector(placement.z, point[2])
    )
  );
}

function rotateAroundAxis(point, origin, direction, angle) {
  const axis = normalizeVector(direction, [0, 0, 1]);
  const vector = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const crossed = cross(axis, vector);
  const projected = dot(axis, vector);
  return addPoint(origin, [
    vector[0] * cos + crossed[0] * sin + axis[0] * projected * (1 - cos),
    vector[1] * cos + crossed[1] * sin + axis[1] * projected * (1 - cos),
    vector[2] * cos + crossed[2] * sin + axis[2] * projected * (1 - cos)
  ]);
}

function transformVector(placement, vector) {
  return addPoint(
    addPoint(scaleVector(placement.x, vector[0]), scaleVector(placement.y, vector[1])),
    scaleVector(placement.z, vector[2])
  );
}

function composePlacement(parent, child) {
  return {
    origin: applyPlacement(parent, child.origin),
    x: normalizeVector(transformVector(parent, child.x), [1, 0, 0]),
    y: normalizeVector(transformVector(parent, child.y), [0, 1, 0]),
    z: normalizeVector(transformVector(parent, child.z), [0, 0, 1])
  };
}

function placement3d(origin = [0, 0, 0], axis = [0, 0, 1], refDirection = [1, 0, 0]) {
  const z = normalizeVector(axis, [0, 0, 1]);
  let x = normalizeVector(refDirection, Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  x = normalizeVector([x[0] - z[0] * dot(x, z), x[1] - z[1] * dot(x, z), x[2] - z[2] * dot(x, z)], Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  const y = normalizeVector(cross(z, x), [0, 1, 0]);
  return { origin: finitePoint(origin) ? origin : [0, 0, 0], x, y, z };
}

function placement2d(origin = [0, 0, 0], refDirection = [1, 0, 0]) {
  const x = normalizeVector([refDirection[0], refDirection[1], 0], [1, 0, 0]);
  const y = [-x[1], x[0], 0];
  return { origin: finitePoint(origin) ? origin : [0, 0, 0], x, y, z: [0, 0, 1] };
}

function extrudeLoop(loop, direction, distance) {
  const vector = scaleVector(normalizeVector(direction, [0, 0, 1]), distance);
  const bottom = cleanLoop(loop);
  if (!bottom) return [];
  const top = bottom.map((point) => addPoint(point, vector));
  const faces = [[...bottom].reverse(), top];
  for (let index = 0; index < bottom.length; index += 1) {
    const next = (index + 1) % bottom.length;
    faces.push([bottom[index], bottom[next], top[next], top[index]]);
  }
  return faces;
}

function extrudeTaperedLoop(startLoop, endLoop, direction, distance) {
  const vector = scaleVector(normalizeVector(direction, [0, 0, 1]), distance);
  const bottom = cleanLoop(startLoop);
  const endProfile = cleanLoop(endLoop);
  if (!bottom || !endProfile || bottom.length !== endProfile.length) return [];
  const top = endProfile.map((point) => addPoint(point, vector));
  const faces = [[...bottom].reverse(), top];
  for (let index = 0; index < bottom.length; index += 1) {
    const next = (index + 1) % bottom.length;
    faces.push([bottom[index], bottom[next], top[next], top[index]]);
  }
  return faces;
}

function extrudeProfile(profile, direction, distance) {
  if (!profile?.loop) return [];
  const vector = scaleVector(normalizeVector(direction, [0, 0, 1]), distance);
  const outer = cleanLoop(profile.loop);
  if (!outer) return [];
  const topOuter = outer.map((point) => addPoint(point, vector));
  const faces = [];
  const voids = (profile.voids || []).map(cleanLoop).filter(Boolean);
  if (!voids.length) return extrudeLoop(outer, direction, distance);
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    faces.push([outer[index], outer[next], topOuter[next], topOuter[index]]);
  }
  for (const inner of voids) {
    const topInner = inner.map((point) => addPoint(point, vector));
    for (let index = 0; index < inner.length; index += 1) {
      const next = (index + 1) % inner.length;
      faces.push([inner[next], inner[index], topInner[index], topInner[next]]);
    }
    if (inner.length === outer.length) {
      for (let index = 0; index < outer.length; index += 1) {
        const next = (index + 1) % outer.length;
        faces.push([outer[next], outer[index], inner[index], inner[next]]);
        faces.push([topOuter[index], topOuter[next], topInner[next], topInner[index]]);
      }
    }
  }
  return faces;
}

function boxLoops(corner, xLength, yLength, zLength, placement = null) {
  if (!(xLength > 0 && yLength > 0 && zLength > 0)) return [];
  const local = [
    [0, 0, 0],
    [xLength, 0, 0],
    [xLength, yLength, 0],
    [0, yLength, 0],
    [0, 0, zLength],
    [xLength, 0, zLength],
    [xLength, yLength, zLength],
    [0, yLength, zLength]
  ];
  const vertices = local.map((point) => placement ? applyPlacement(placement, point) : addPoint(corner, point));
  return [
    [vertices[0], vertices[3], vertices[2], vertices[1]],
    [vertices[4], vertices[5], vertices[6], vertices[7]],
    [vertices[0], vertices[1], vertices[5], vertices[4]],
    [vertices[1], vertices[2], vertices[6], vertices[5]],
    [vertices[2], vertices[3], vertices[7], vertices[6]],
    [vertices[3], vertices[0], vertices[4], vertices[7]]
  ];
}

function circularPrimitiveLoops(radius, height, placement = identityPlacement(), topRadius = radius, segments = 32) {
  if (!(radius > 0 && height > 0 && topRadius >= 0)) return [];
  const bottom = [];
  const top = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = Math.PI * 2 * index / segments;
    bottom.push(applyPlacement(placement, [Math.cos(angle) * radius, Math.sin(angle) * radius, 0]));
    top.push(applyPlacement(placement, [Math.cos(angle) * topRadius, Math.sin(angle) * topRadius, height]));
  }
  const faces = [[...bottom].reverse()];
  const apex = applyPlacement(placement, [0, 0, height]);
  if (topRadius > 1e-9) faces.push(top);
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    faces.push(topRadius > 1e-9
      ? [bottom[index], bottom[next], top[next], top[index]]
      : [bottom[index], bottom[next], apex]);
  }
  return faces;
}

function rectangularPyramidLoops(xLength, yLength, height, placement = identityPlacement()) {
  if (!(xLength > 0 && yLength > 0 && height > 0)) return [];
  const vertices = [
    [0, 0, 0],
    [xLength, 0, 0],
    [xLength, yLength, 0],
    [0, yLength, 0],
    [xLength / 2, yLength / 2, height]
  ].map((point) => applyPlacement(placement, point));
  return [
    [vertices[0], vertices[3], vertices[2], vertices[1]],
    [vertices[0], vertices[1], vertices[4]],
    [vertices[1], vertices[2], vertices[4]],
    [vertices[2], vertices[3], vertices[4]],
    [vertices[3], vertices[0], vertices[4]]
  ];
}

function sphereLoops(radius, placement = identityPlacement(), segments = 32, rings = 16) {
  if (!(radius > 0)) return [];
  const rows = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = -Math.PI / 2 + Math.PI * ring / rings;
    const z = Math.sin(phi) * radius;
    const r = Math.cos(phi) * radius;
    const row = [];
    for (let index = 0; index < segments; index += 1) {
      const angle = Math.PI * 2 * index / segments;
      row.push(applyPlacement(placement, [Math.cos(angle) * r, Math.sin(angle) * r, z]));
    }
    rows.push(row);
  }
  const faces = [];
  for (let ring = 0; ring < rings; ring += 1) {
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      faces.push(ring === 0
        ? [rows[ring][index], rows[ring + 1][next], rows[ring + 1][index]]
        : ring === rings - 1
          ? [rows[ring][index], rows[ring][next], rows[ring + 1][index]]
          : [rows[ring][index], rows[ring][next], rows[ring + 1][next], rows[ring + 1][index]]);
    }
  }
  return faces;
}

function revolveLoop(loop, axisOrigin, axisDirection, angle) {
  const profile = cleanLoop(loop);
  if (!profile || !(Math.abs(angle) > 1e-9)) return [];
  const full = Math.abs(Math.abs(angle) - Math.PI * 2) < 1e-6 || Math.abs(angle) > Math.PI * 2;
  const span = full ? Math.sign(angle || 1) * Math.PI * 2 : angle;
  const segments = Math.max(12, Math.min(96, Math.ceil(Math.abs(span) / (Math.PI / 16))));
  const ringCount = full ? segments : segments + 1;
  const rings = [];
  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const t = ringIndex / segments;
    rings.push(profile.map((point) => rotateAroundAxis(point, axisOrigin, axisDirection, span * t)));
  }
  const faces = [];
  for (let ringIndex = 0; ringIndex < segments; ringIndex += 1) {
    const nextRing = full ? (ringIndex + 1) % segments : ringIndex + 1;
    for (let pointIndex = 0; pointIndex < profile.length; pointIndex += 1) {
      const nextPoint = (pointIndex + 1) % profile.length;
      faces.push([rings[ringIndex][pointIndex], rings[ringIndex][nextPoint], rings[nextRing][nextPoint], rings[nextRing][pointIndex]]);
    }
  }
  if (!full) {
    faces.push([...rings[0]].reverse());
    faces.push(rings.at(-1));
  }
  return faces;
}

function pipeRing(center, tangent, radius, segments) {
  const axis = normalizeVector(tangent, [0, 0, 1]);
  const seed = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const x = normalizeVector(cross(seed, axis), [1, 0, 0]);
  const y = normalizeVector(cross(axis, x), [0, 1, 0]);
  const ring = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = Math.PI * 2 * index / segments;
    ring.push(addPoint(center, addPoint(scaleVector(x, Math.cos(angle) * radius), scaleVector(y, Math.sin(angle) * radius))));
  }
  return ring;
}

function sweptDiskLoops(line, radius) {
  const points = [];
  for (const point of line || []) {
    if (finitePoint(point) && !sameSpfPoint(points.at(-1), point)) points.push(point);
  }
  if (points.length < 2 || !(radius > 0)) return [];
  const segments = 12;
  const rings = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    return pipeRing(point, [next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]], radius, segments);
  });
  const faces = [];
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let pointIndex = 0; pointIndex < segments; pointIndex += 1) {
      const nextPoint = (pointIndex + 1) % segments;
      faces.push([rings[ringIndex][pointIndex], rings[ringIndex][nextPoint], rings[ringIndex + 1][nextPoint], rings[ringIndex + 1][pointIndex]]);
    }
  }
  faces.push([...rings[0]].reverse());
  faces.push(rings.at(-1));
  return faces;
}

function transformLoop(placement, loop) {
  return loop.map((point) => applyPlacement(placement, point));
}

function unapplyPlacement(placement, point) {
  const vector = [point[0] - placement.origin[0], point[1] - placement.origin[1], point[2] - placement.origin[2]];
  return [dot(vector, placement.x), dot(vector, placement.y), dot(vector, placement.z)];
}

function untransformLoop(placement, loop) {
  return loop.map((point) => unapplyPlacement(placement, point));
}

function transformPoint(transform, point) {
  return addPoint(
    transform.origin,
    addPoint(
      addPoint(scaleVector(transform.x, point[0]), scaleVector(transform.y, point[1])),
      scaleVector(transform.z, point[2])
    )
  );
}

function transformLoopBy(transform, loop) {
  return loop.map((point) => transformPoint(transform, point));
}

function cartesianTransform(origin = [0, 0, 0], axis1 = [1, 0, 0], axis2 = [0, 1, 0], axis3 = [0, 0, 1], scale1 = 1, scale2 = scale1, scale3 = scale1) {
  const placement = placement3d(origin, axis3, axis1);
  let y = normalizeVector(axis2, placement.y);
  y = normalizeVector([y[0] - placement.x[0] * dot(y, placement.x), y[1] - placement.x[1] * dot(y, placement.x), y[2] - placement.x[2] * dot(y, placement.x)], placement.y);
  const z = normalizeVector(axis3, cross(placement.x, y));
  return {
    origin: finitePoint(origin) ? origin : [0, 0, 0],
    x: scaleVector(placement.x, Number.isFinite(scale1) ? scale1 : 1),
    y: scaleVector(y, Number.isFinite(scale2) ? scale2 : Number.isFinite(scale1) ? scale1 : 1),
    z: scaleVector(z, Number.isFinite(scale3) ? scale3 : Number.isFinite(scale1) ? scale1 : 1)
  };
}

function ovalLoop(rx, ry, placement, segments = 32) {
  const loop = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = Math.PI * 2 * index / segments;
    loop.push(applyPlacement(placement, [Math.cos(angle) * rx, Math.sin(angle) * ry, 0]));
  }
  return loop;
}

function spfEllipsePolyline(rx, ry, placement, start = 0, span = Math.PI * 2) {
  const segments = Math.max(4, Math.min(96, Math.ceil(Math.abs(span) / (Math.PI / 32))));
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = start + span * index / segments;
    points.push(applyPlacement(placement, [Math.cos(angle) * rx, Math.sin(angle) * ry, 0]));
  }
  if (Math.abs(Math.abs(span) - Math.PI * 2) < 1e-9 && points.length > 1) points[points.length - 1] = points[0];
  return points;
}

function positiveAngle(angle) {
  let out = angle % (Math.PI * 2);
  if (out < 0) out += Math.PI * 2;
  return out;
}

function spfArcSegment(center, radius, start, span, zStart, zEnd) {
  const steps = Math.max(4, Math.min(48, Math.ceil(Math.abs(span) / (Math.PI / 24))));
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = start + span * t;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius, zStart + (zEnd - zStart) * t].map((value) => Math.round(value * 1e6) / 1e6));
  }
  return points;
}

function spfArcIndexPoints(a, b, c) {
  if (!finitePoint(a) || !finitePoint(b) || !finitePoint(c)) return [];
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return [a, b, c];
  const aa = a[0] * a[0] + a[1] * a[1];
  const bb = b[0] * b[0] + b[1] * b[1];
  const cc = c[0] * c[0] + c[1] * c[1];
  const center = [
    (aa * (b[1] - c[1]) + bb * (c[1] - a[1]) + cc * (a[1] - b[1])) / d,
    (aa * (c[0] - b[0]) + bb * (a[0] - c[0]) + cc * (b[0] - a[0])) / d
  ];
  const radius = Math.hypot(a[0] - center[0], a[1] - center[1]);
  if (!(radius > 0)) return [a, b, c];
  const start = Math.atan2(a[1] - center[1], a[0] - center[0]);
  const mid = Math.atan2(b[1] - center[1], b[0] - center[0]);
  const end = Math.atan2(c[1] - center[1], c[0] - center[0]);
  const ccwStartToMid = positiveAngle(mid - start);
  const ccwStartToEnd = positiveAngle(end - start);
  const ccw = ccwStartToMid <= ccwStartToEnd;
  const firstSpan = ccw ? ccwStartToMid : -positiveAngle(start - mid);
  const secondSpan = ccw ? positiveAngle(end - mid) : -positiveAngle(mid - end);
  const first = spfArcSegment(center, radius, start, firstSpan, a[2], b[2]);
  const second = spfArcSegment(center, radius, mid, secondSpan, b[2], c[2]);
  return [...first, ...second.slice(1)];
}

function expandedKnots(knots, multiplicities) {
  if (!multiplicities?.length) return knots;
  const out = [];
  for (let index = 0; index < knots.length; index += 1) {
    const count = Math.max(1, Math.trunc(multiplicities[index] || 1));
    for (let repeat = 0; repeat < count; repeat += 1) out.push(knots[index]);
  }
  return out;
}

function spfBsplinePolyline(degree, controls, knotMultiplicities = [], knots = [], weights = [], closed = false) {
  const clean = (controls || []).filter(finitePoint);
  if (clean.length < 2) return null;
  if (!(degree > 0) || degree >= clean.length) return closed ? [...clean, clean[0]] : clean;
  const knotVector = expandedKnots(knots, knotMultiplicities);
  if (knotVector.length < clean.length + degree + 1) return closed ? [...clean, clean[0]] : clean;
  const start = knotVector[degree];
  const end = knotVector[clean.length];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return closed ? [...clean, clean[0]] : clean;
  const steps = Math.max(16, Math.min(128, clean.length * 12));
  const line = [];
  for (let index = 0; index <= steps; index += 1) line.push(bsplinePoint(clean, knotVector, weights, degree, start + (end - start) * index / steps));
  if (closed && !sameSpfPoint(line[0], line.at(-1))) line.push(line[0]);
  return line.filter(finitePoint);
}

function iShapeLoop(width, depth, webThickness, flangeThickness, placement) {
  if (!(width > 0 && depth > 0 && webThickness > 0 && flangeThickness > 0)) return null;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const halfWeb = Math.min(webThickness / 2, halfWidth);
  const flange = Math.min(flangeThickness, halfDepth);
  if (halfWeb >= halfWidth || flange * 2 >= depth) {
    return [
      [-halfWidth, -halfDepth, 0],
      [halfWidth, -halfDepth, 0],
      [halfWidth, halfDepth, 0],
      [-halfWidth, halfDepth, 0]
    ].map((point) => applyPlacement(placement, point));
  }
  return [
    [-halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth, 0],
    [halfWidth, -halfDepth + flange, 0],
    [halfWeb, -halfDepth + flange, 0],
    [halfWeb, halfDepth - flange, 0],
    [halfWidth, halfDepth - flange, 0],
    [halfWidth, halfDepth, 0],
    [-halfWidth, halfDepth, 0],
    [-halfWidth, halfDepth - flange, 0],
    [-halfWeb, halfDepth - flange, 0],
    [-halfWeb, -halfDepth + flange, 0],
    [-halfWidth, -halfDepth + flange, 0]
  ].map((point) => applyPlacement(placement, point));
}

function lShapeLoop(width, depth, thickness, placement) {
  if (!(width > 0 && depth > 0 && thickness > 0)) return null;
  const t = Math.min(thickness, width, depth);
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -depth / 2;
  const y1 = depth / 2;
  return [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y0 + t, 0],
    [x0 + t, y0 + t, 0],
    [x0 + t, y1, 0],
    [x0, y1, 0]
  ].map((point) => applyPlacement(placement, point));
}

function tShapeLoop(width, depth, webThickness, flangeThickness, placement) {
  if (!(width > 0 && depth > 0 && webThickness > 0 && flangeThickness > 0)) return null;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const halfWeb = Math.min(webThickness / 2, halfWidth);
  const flange = Math.min(flangeThickness, depth);
  return [
    [-halfWidth, halfDepth, 0],
    [halfWidth, halfDepth, 0],
    [halfWidth, halfDepth - flange, 0],
    [halfWeb, halfDepth - flange, 0],
    [halfWeb, -halfDepth, 0],
    [-halfWeb, -halfDepth, 0],
    [-halfWeb, halfDepth - flange, 0],
    [-halfWidth, halfDepth - flange, 0]
  ].map((point) => applyPlacement(placement, point));
}

function uShapeLoop(flangeWidth, depth, webThickness, flangeThickness, placement) {
  if (!(flangeWidth > 0 && depth > 0 && webThickness > 0 && flangeThickness > 0)) return null;
  const halfWidth = flangeWidth / 2;
  const halfDepth = depth / 2;
  const web = Math.min(webThickness, flangeWidth);
  const flange = Math.min(flangeThickness, depth / 2);
  const x0 = -halfWidth;
  const x1 = halfWidth;
  const y0 = -halfDepth;
  const y1 = halfDepth;
  return [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y1, 0],
    [x0, y1, 0],
    [x0, y1 - flange, 0],
    [x1 - web, y1 - flange, 0],
    [x1 - web, y0 + flange, 0],
    [x0, y0 + flange, 0]
  ].map((point) => applyPlacement(placement, point));
}

function zShapeLoop(flangeWidth, depth, webThickness, flangeThickness, placement) {
  if (!(flangeWidth > 0 && depth > 0 && webThickness > 0 && flangeThickness > 0)) return null;
  const halfWidth = flangeWidth / 2;
  const halfDepth = depth / 2;
  const halfWeb = Math.min(webThickness / 2, halfWidth);
  const flange = Math.min(flangeThickness, depth / 2);
  return [
    [-halfWidth, -halfDepth, 0],
    [halfWeb, -halfDepth, 0],
    [halfWeb, halfDepth - flange, 0],
    [halfWidth, halfDepth - flange, 0],
    [halfWidth, halfDepth, 0],
    [-halfWeb, halfDepth, 0],
    [-halfWeb, -halfDepth + flange, 0],
    [-halfWidth, -halfDepth + flange, 0]
  ].map((point) => applyPlacement(placement, point));
}

function cShapeLoop(width, depth, wallThickness, girth, placement) {
  if (!(width > 0 && depth > 0 && wallThickness > 0 && girth > 0)) return null;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const t = Math.min(wallThickness, width / 2, depth / 2);
  const lip = Math.min(girth, depth / 2 - t);
  const x0 = -halfWidth;
  const x1 = halfWidth;
  const y0 = -halfDepth;
  const y1 = halfDepth;
  return [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y0 + lip, 0],
    [x1 - t, y0 + lip, 0],
    [x1 - t, y0 + t, 0],
    [x0 + t, y0 + t, 0],
    [x0 + t, y1 - t, 0],
    [x1 - t, y1 - t, 0],
    [x1 - t, y1 - lip, 0],
    [x1, y1 - lip, 0],
    [x1, y1, 0],
    [x0, y1, 0]
  ].map((point) => applyPlacement(placement, point));
}

function sameSpfPoint(a, b) {
  return a?.length === 3 && b?.length === 3 && a.every((value, axis) => value === b[axis]);
}

function cleanLoop(loop) {
  const out = [];
  for (const point of loop || []) {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) continue;
    if (!sameSpfPoint(out.at(-1), point)) out.push(point);
  }
  if (out.length > 2 && sameSpfPoint(out[0], out.at(-1))) out.pop();
  return out.length >= 3 ? out : null;
}

function loopKey(loop) {
  return loop.map((point) => point.join(",")).join("|");
}

function pushLoop(loops, seen, loop) {
  const clean = cleanLoop(loop);
  if (!clean) return false;
  const key = loopKey(clean);
  if (seen.has(key)) return false;
  seen.add(key);
  loops.push(clean);
  return true;
}

function meshItemFromLoops(id, layer, color, opacity, loops) {
  const vertices = [];
  const vertexIds = new Map();
  const vertexIndex = (point) => {
    const key = point.join(",");
    if (!vertexIds.has(key)) {
      vertexIds.set(key, vertices.length);
      vertices.push(point);
    }
    return vertexIds.get(key);
  };
  const faces = loops.map((loop) => loop.map(vertexIndex)).filter((face) => face.length >= 3);
  return faces.length ? { id, layer, color, opacity, vertices, faces } : null;
}

function meshFromLoops(doc, file, loops) {
  doc.layers.reference = { name: "reference", color: DEFAULT_MESH_COLOR, opacity: 0.18 };
  const mesh = meshItemFromLoops(`${cleanId(file.name)}_mesh`, "reference", DEFAULT_MESH_COLOR, 0.18, loops);
  if (!mesh) return false;
  doc.meshes.push(mesh);
  return true;
}

function parseSpf(text, file, format) {
  const doc = emptyDoc();
  const entities = parseSpfEntities(text);
  const defaultLengthFormat = format === "ifc" ? 1000 : format === "step" ? 1 : format;
  const lengthFormat = format === "ifc" || format === "step" ? spfLengthScale(entities, defaultLengthFormat) : format;
  if ((format === "ifc" || format === "step") && lengthFormat !== defaultLengthFormat) {
    doc.sourcePatch = { ...(doc.sourcePatch || {}), [`${format}LengthUnitScaleToMm`]: lengthFormat };
    doc.diagnostics.push(diag("info", `${format}-length-unit-scale`, `Browser ${format.toUpperCase()} importer detected length unit scale ${lengthFormat} mm per model unit.`));
  }
  const points = new Map();
  const directions = new Map();
  const placements = new Map();
  const axis1Placements = new Map();
  const transforms = new Map();
  const pointLists = new Map();
  const polylines = new Map();
  const curveSets = new Map();
  const conicCurves = new Map();
  const profiles = new Map();
  const vertexPoints = new Map();
  const edgeCurves = new Map();
  const orientedEdges = new Map();
  const loopByEntity = new Map();
  const boundLoops = new Map();
  const indexedFaces = new Map();
  const entityLoops = new Map();
  const consumedEntityLoopIds = new Set();
  const loops = [];
  const seenLoops = new Set();
  const addEntityLoop = (entityId, loop) => {
    const clean = cleanLoop(loop);
    if (!clean) return null;
    if (!entityLoops.has(entityId)) entityLoops.set(entityId, []);
    entityLoops.get(entityId).push(clean);
    return clean;
  };
  const addEntityLoops = (entityId, itemLoops) => {
    let added = 0;
    for (const loop of itemLoops || []) {
      if (addEntityLoop(entityId, loop)) added += 1;
    }
    return added;
  };
  const profileDiagnosticCodes = new Set();
  const profileDiagnostic = (code, message) => {
    if (profileDiagnosticCodes.has(code)) return;
    profileDiagnosticCodes.add(code);
    doc.diagnostics.push(diag("warning", code, message));
  };
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("CARTESIANPOINT") || entity.type === "CARTESIAN_POINT") {
      const point = pointFromArgs(entity.args);
      if (point) points.set(id, scalePoint(point, lengthFormat));
    } else if (entity.type.endsWith("DIRECTION") || entity.type === "DIRECTION") {
      const direction = pointFromArgs(entity.args);
      if (direction) directions.set(id, normalizeVector(direction, [0, 0, 1]));
    } else if (entity.type.endsWith("CARTESIANPOINTLIST3D") || entity.type.endsWith("CARTESIAN_POINT_LIST_3D") || entity.type.endsWith("CARTESIANPOINTLIST2D") || entity.type.endsWith("CARTESIAN_POINT_LIST_2D")) {
      const list = coordinateTuples(entity.args).map((point) => scalePoint(point, lengthFormat));
      if (list.length) pointLists.set(id, list);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("AXIS2PLACEMENT3D") || entity.type.endsWith("AXIS2_PLACEMENT_3D")) {
      const ids = idsFromArgs(entity.args);
      placements.set(id, placement3d(points.get(ids[0]), directions.get(ids[1]), directions.get(ids[2])));
    } else if (entity.type.endsWith("AXIS2PLACEMENT2D") || entity.type.endsWith("AXIS2_PLACEMENT_2D")) {
      const ids = idsFromArgs(entity.args);
      placements.set(id, placement2d(points.get(ids[0]), directions.get(ids[1])));
    } else if (entity.type.endsWith("AXIS1PLACEMENT") || entity.type.endsWith("AXIS1_PLACEMENT")) {
      const ids = idsFromArgs(entity.args);
      axis1Placements.set(id, { origin: points.get(ids[0]) || [0, 0, 0], direction: directions.get(ids[1]) || [0, 0, 1] });
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("POLYLINE") && !entity.type.endsWith("POLYLOOP") && entity.type !== "LWPOLYLINE") {
      const line = idsFromArgs(entity.args).map((pointId) => points.get(pointId)).filter(Boolean);
      if (line.length >= 2) polylines.set(id, line);
    } else if (entity.type.endsWith("INDEXEDPOLYCURVE") || entity.type.endsWith("INDEXED_POLY_CURVE")) {
      const args = splitTopLevelArgs(entity.args);
      const pointList = pointLists.get(firstId(args[0]));
      if (!pointList) continue;
      const segmentArg = args[1] || "";
      const segmentSource = [
        segmentArg,
        ...idsFromArgs(segmentArg)
          .map((segmentId) => entities.get(segmentId))
          .filter((segment) => segment && /(?:LINE|ARC)_?INDEX$/i.test(segment.type.replace(/^IFC/i, "")))
          .map((segment) => `${segment.type}(${segment.args})`)
      ].join(",");
      let segments = [...segmentSource.matchAll(/(?:IFC)?(LINE_?INDEX|ARC_?INDEX)\s*\(\s*\(([-+0-9,\s]+)\)\s*\)/gi)]
        .map((match) => ({
          type: match[1].replace(/_/g, "").toUpperCase(),
          indices: match[2].split(",").map((item) => Math.trunc(number(item))).filter(Number.isInteger)
        }));
      if (!segments.length) segments = integerTuples(segmentArg, 2).map((indices) => ({ type: "LINEINDEX", indices }));
      if (!segments.length) segments = [{ type: "LINEINDEX", indices: pointList.map((_, index) => index + 1) }];
      const line = [];
      for (const segment of segments) {
        const sequence = segment.type === "ARCINDEX" && segment.indices.length >= 3
          ? spfArcIndexPoints(pointList[segment.indices[0] - 1], pointList[segment.indices[1] - 1], pointList[segment.indices[2] - 1])
          : segment.indices.map((pointIndex) => pointList[pointIndex - 1]).filter(Boolean);
        for (const point of sequence) {
          if (point && !sameSpfPoint(line.at(-1), point)) line.push(point);
        }
      }
      if (line.length >= 2) polylines.set(id, line);
    } else if (entity.type.endsWith("CIRCLE")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const radius = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0).at(-1);
      if (radius > 0) {
        conicCurves.set(id, { placement, rx: radius, ry: radius });
        polylines.set(id, spfEllipsePolyline(radius, radius, placement));
      }
    } else if (entity.type.endsWith("ELLIPSE")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const lengths = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0).slice(-2);
      if (lengths.length === 2) {
        conicCurves.set(id, { placement, rx: lengths[0], ry: lengths[1] });
        polylines.set(id, spfEllipsePolyline(lengths[0], lengths[1], placement));
      }
    } else if (entity.type.endsWith("BSPLINECURVE") || entity.type.endsWith("B_SPLINE_CURVE") || entity.type.endsWith("BSPLINECURVEWITHKNOTS") || entity.type.endsWith("B_SPLINE_CURVE_WITH_KNOTS") || entity.type.endsWith("RATIONALBSPLINECURVEWITHKNOTS") || entity.type.endsWith("RATIONAL_B_SPLINE_CURVE_WITH_KNOTS")) {
      const args = splitTopLevelArgs(entity.args);
      const controlIndex = args.findIndex((arg) => idsFromArgs(arg).filter((itemId) => points.has(itemId)).length >= 2);
      if (controlIndex >= 0) {
        const degree = Math.trunc(numbersFromText(args.slice(0, controlIndex).join(",")).at(-1) ?? 0);
        const controls = idsFromArgs(args[controlIndex]).map((pointId) => points.get(pointId)).filter(Boolean);
        const numericLists = args.slice(controlIndex + 1).filter((arg) => !/#/.test(arg) && numbersFromText(arg).length >= 2).map(numbersFromText);
        const multiplicities = numericLists[0]?.map((value) => Math.trunc(value)) || [];
        const knots = numericLists[1] || [];
        const weights = /RATIONAL/.test(entity.type) && numericLists.length >= 3 ? numericLists.at(-1) : [];
        const closed = /\.T\./i.test(args.slice(controlIndex + 1).join(","));
        const line = spfBsplinePolyline(degree, controls, multiplicities, knots, weights, closed);
        if (line?.length >= 2) polylines.set(id, line);
      }
    } else if (entity.type.endsWith("TRIMMEDCURVE") || entity.type.endsWith("TRIMMED_CURVE")) {
      const args = splitTopLevelArgs(entity.args);
      const basisIndex = args.findIndex((arg) => conicCurves.has(firstId(arg)));
      const basisId = basisIndex >= 0 ? firstId(args[basisIndex]) : null;
      const conic = conicCurves.get(basisId);
      const startArg = args[basisIndex + 1];
      const endArg = args[basisIndex + 2];
      const parameterTrim = /PARAMETER/i.test(args[basisIndex + 4] || entity.args) && !/#/.test(`${startArg || ""}${endArg || ""}`);
      const start = numbersFromText(startArg).at(0);
      const end = numbersFromText(endArg).at(0);
      if (conic && parameterTrim && Number.isFinite(start) && Number.isFinite(end)) {
        const sense = !/\.F\./i.test(args[basisIndex + 3] || "");
        let span = end - start;
        if (sense) {
          while (span < 0) span += Math.PI * 2;
        } else {
          while (span > 0) span -= Math.PI * 2;
        }
        if (Math.abs(span) > 1e-9) {
          polylines.delete(basisId);
          polylines.set(id, spfEllipsePolyline(conic.rx, conic.ry, conic.placement, start, span));
        }
      }
    }
  }
  const compositeCurveSegments = new Map();
  for (const [id, entity] of entities) {
    if (!entity.type.endsWith("COMPOSITECURVESEGMENT") && !entity.type.endsWith("COMPOSITE_CURVE_SEGMENT")) continue;
    const args = splitTopLevelArgs(entity.args);
    const parentId = idsFromArgs(entity.args).find((itemId) => polylines.has(itemId));
    const parentLine = parentId ? polylines.get(parentId) : null;
    if (parentLine?.length >= 2) {
      compositeCurveSegments.set(id, {
        parentId,
        line: /\.F\./i.test(args[1] || "") ? [...parentLine].reverse() : parentLine
      });
    }
  }
  for (const [id, entity] of entities) {
    if ((!entity.type.endsWith("COMPOSITECURVE") && !entity.type.endsWith("COMPOSITE_CURVE")) || entity.type.endsWith("SEGMENT")) continue;
    const segmentIds = idsFromArgs(entity.args).filter((itemId) => compositeCurveSegments.has(itemId));
    const line = [];
    for (const segmentId of segmentIds) {
      for (const point of compositeCurveSegments.get(segmentId).line) {
        if (!sameSpfPoint(line.at(-1), point)) line.push(point);
      }
    }
    if (line.length >= 2) {
      for (const segmentId of segmentIds) {
        const segment = compositeCurveSegments.get(segmentId);
        polylines.delete(segmentId);
        polylines.delete(segment.parentId);
      }
      polylines.set(id, line);
    }
  }
  for (const [id, entity] of entities) {
    if (!entity.type.endsWith("GEOMETRICCURVESET") && !entity.type.endsWith("GEOMETRIC_CURVE_SET")) continue;
    const curveIds = idsFromArgs(entity.args).filter((itemId) => polylines.has(itemId));
    if (curveIds.length) curveSets.set(id, curveIds);
  }
  for (const [id, entity] of entities) {
    const args = splitTopLevelArgs(entity.args);
    const type = entity.type.replace(/_/g, "");
    if (type.endsWith("RECTANGLEPROFILEDEF") || type.endsWith("RECTANGLEHOLLOWPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const width = scaledLength(args[3], lengthFormat);
      const height = scaledLength(args[4], lengthFormat);
      if (width > 0 && height > 0) {
        const loop = [
          [-width / 2, -height / 2, 0],
          [width / 2, -height / 2, 0],
          [width / 2, height / 2, 0],
          [-width / 2, height / 2, 0]
        ].map((point) => applyPlacement(placement, point));
        const wall = type.endsWith("RECTANGLEHOLLOWPROFILEDEF") ? scaledLength(args[5], lengthFormat) : null;
        const innerWidth = width - 2 * (wall || 0);
        const innerHeight = height - 2 * (wall || 0);
        const voids = wall > 0 && innerWidth > 0 && innerHeight > 0
          ? [[
            [-innerWidth / 2, -innerHeight / 2, 0],
            [-innerWidth / 2, innerHeight / 2, 0],
            [innerWidth / 2, innerHeight / 2, 0],
            [innerWidth / 2, -innerHeight / 2, 0]
          ].map((point) => applyPlacement(placement, point))]
          : [];
        profiles.set(id, { loop, ...(voids.length ? { voids } : {}) });
      }
      if (type.endsWith("RECTANGLEHOLLOWPROFILEDEF") && !profiles.get(id)?.voids?.length) profileDiagnostic(`${format}-profile-voids-ignored`, `Browser ${format.toUpperCase()} importer could not generate inner void geometry for this hollow profile.`);
    } else if (type.endsWith("ISHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const width = scaledLength(args[3], lengthFormat);
      const depth = scaledLength(args[4], lengthFormat);
      const webThickness = scaledLength(args[5], lengthFormat);
      const flangeThickness = scaledLength(args[6], lengthFormat);
      const loop = iShapeLoop(width, depth, webThickness, flangeThickness, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("LSHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const depth = scaledLength(args[3], lengthFormat);
      const width = scaledLength(args[4], lengthFormat) ?? depth;
      const thickness = scaledLength(args[5], lengthFormat);
      const loop = lShapeLoop(width, depth, thickness, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("TSHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const depth = scaledLength(args[3], lengthFormat);
      const flangeWidth = scaledLength(args[4], lengthFormat);
      const webThickness = scaledLength(args[5], lengthFormat);
      const flangeThickness = scaledLength(args[6], lengthFormat);
      const loop = tShapeLoop(flangeWidth, depth, webThickness, flangeThickness, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("USHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const depth = scaledLength(args[3], lengthFormat);
      const flangeWidth = scaledLength(args[4], lengthFormat);
      const webThickness = scaledLength(args[5], lengthFormat);
      const flangeThickness = scaledLength(args[6], lengthFormat);
      const loop = uShapeLoop(flangeWidth, depth, webThickness, flangeThickness, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("ZSHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const depth = scaledLength(args[3], lengthFormat);
      const flangeWidth = scaledLength(args[4], lengthFormat);
      const webThickness = scaledLength(args[5], lengthFormat);
      const flangeThickness = scaledLength(args[6], lengthFormat);
      const loop = zShapeLoop(flangeWidth, depth, webThickness, flangeThickness, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("CSHAPEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const depth = scaledLength(args[3], lengthFormat);
      const width = scaledLength(args[4], lengthFormat);
      const wallThickness = scaledLength(args[5], lengthFormat);
      const girth = scaledLength(args[6], lengthFormat);
      const loop = cShapeLoop(width, depth, wallThickness, girth, placement);
      if (loop) profiles.set(id, { loop });
    } else if (type.endsWith("CIRCLEPROFILEDEF") || type.endsWith("CIRCLEHOLLOWPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const radius = scaledLength(args[3], lengthFormat);
      if (radius > 0) {
        const thickness = type.endsWith("CIRCLEHOLLOWPROFILEDEF") ? scaledLength(args[4], lengthFormat) : null;
        const innerRadius = radius - (thickness || 0);
        profiles.set(id, {
          loop: ovalLoop(radius, radius, placement),
          ...(thickness > 0 && innerRadius > 0 ? { voids: [[...ovalLoop(innerRadius, innerRadius, placement)].reverse()] } : {})
        });
      }
      if (type.endsWith("CIRCLEHOLLOWPROFILEDEF") && !profiles.get(id)?.voids?.length) profileDiagnostic(`${format}-profile-voids-ignored`, `Browser ${format.toUpperCase()} importer could not generate inner void geometry for this hollow profile.`);
    } else if (type.endsWith("ELLIPSEPROFILEDEF")) {
      const placement = placements.get(firstId(args[2])) || identityPlacement();
      const rx = scaledLength(args[3], lengthFormat);
      const ry = scaledLength(args[4], lengthFormat);
      if (rx > 0 && ry > 0) profiles.set(id, { loop: ovalLoop(rx, ry, placement) });
    } else if (type.endsWith("ARBITRARYCLOSEDPROFILEDEF") || type.endsWith("ARBITRARYPROFILEDEFWITHVOIDS")) {
      const curveIds = idsFromArgs(entity.args).filter((item) => polylines.has(item));
      const loop = curveIds[0] ? cleanLoop(polylines.get(curveIds[0])) : null;
      const voids = type.endsWith("ARBITRARYPROFILEDEFWITHVOIDS")
        ? curveIds.slice(1).map((curveId) => cleanLoop(polylines.get(curveId))).filter(Boolean).map((loop) => [...loop].reverse())
        : [];
      if (loop) profiles.set(id, { loop, ...(voids.length ? { voids } : {}) });
      if (type.endsWith("ARBITRARYPROFILEDEFWITHVOIDS") && !voids.length) profileDiagnostic(`${format}-profile-voids-ignored`, `Browser ${format.toUpperCase()} importer could not find inner void curves for this arbitrary profile.`);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("VERTEXPOINT") || entity.type === "VERTEX_POINT") {
      const pointId = idsFromArgs(entity.args).find((item) => points.has(item));
      if (pointId) vertexPoints.set(id, points.get(pointId));
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("EDGE_CURVE") || entity.type.endsWith("EDGECURVE")) {
      const vertices = idsFromArgs(entity.args).map((item) => vertexPoints.get(item)).filter(Boolean);
      if (vertices.length >= 2) edgeCurves.set(id, [vertices[0], vertices[1]]);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("ORIENTED_EDGE") || entity.type.endsWith("ORIENTEDEDGE")) {
      const edgeId = idsFromArgs(entity.args).reverse().find((item) => edgeCurves.has(item));
      const edge = edgeId ? edgeCurves.get(edgeId) : null;
      if (edge) orientedEdges.set(id, /\.F\./i.test(entity.args) ? [edge[1], edge[0]] : edge);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("POLYLOOP") || entity.type === "POLY_LOOP") {
      const loop = idsFromArgs(entity.args).map((id) => points.get(id)).filter(Boolean);
      const clean = addEntityLoop(id, loop);
      if (clean) loopByEntity.set(id, clean);
    } else if (entity.type.endsWith("EDGE_LOOP") || entity.type.endsWith("EDGELOOP")) {
      const loop = [];
      for (const edgeId of idsFromArgs(entity.args)) {
        const edge = orientedEdges.get(edgeId) || edgeCurves.get(edgeId);
        if (!edge) continue;
        if (!loop.length) loop.push(edge[0]);
        if (!sameSpfPoint(loop.at(-1), edge[0]) && sameSpfPoint(loop.at(-1), edge[1])) loop.push(edge[0]);
        else if (!sameSpfPoint(loop.at(-1), edge[0])) loop.push(edge[0]);
        loop.push(edge[1]);
      }
      const clean = cleanLoop(loop);
      if (addEntityLoop(id, clean)) loopByEntity.set(id, clean);
    } else if (entity.type.replace(/_/g, "").endsWith("INDEXEDPOLYGONALFACE") || entity.type.replace(/_/g, "").endsWith("INDEXEDPOLYGONALFACEWITHVOIDS")) {
      const firstArg = splitTopLevelArgs(entity.args)[0] || entity.args;
      const face = integerLists(firstArg)[0]?.map((index) => index - 1).filter((index, itemIndex, items) => index >= 0 && items.indexOf(index) === itemIndex);
      if (face?.length >= 3) indexedFaces.set(id, face);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("FACE_OUTER_BOUND") || entity.type.endsWith("FACE_BOUND") || entity.type.endsWith("FACEOUTERBOUND") || entity.type.endsWith("FACEBOUND")) {
      const loopId = idsFromArgs(entity.args).find((item) => loopByEntity.has(item));
      const loop = loopId ? loopByEntity.get(loopId) : null;
      if (loop) {
        consumedEntityLoopIds.add(loopId);
        boundLoops.set(id, /\.F\./i.test(entity.args) ? [...loop].reverse() : loop);
      }
    }
  }
  for (const [id, entity] of entities) {
    const type = entity.type.replace(/_/g, "");
    if (type.endsWith("POLYGONALFACESET")) {
      const ids = idsFromArgs(entity.args);
      const pointList = pointLists.get(ids[0]);
      if (!pointList) continue;
      for (const faceId of ids.slice(1)) {
        const face = indexedFaces.get(faceId);
        if (face) addEntityLoop(id, face.map((index) => pointList[index]).filter(Boolean));
      }
    } else if (type.endsWith("TRIANGULATEDFACESET")) {
      const args = splitTopLevelArgs(entity.args);
      const pointList = pointLists.get(idsFromArgs(args[0] || "")[0]);
      if (!pointList) continue;
      const coordIndexArg = args.find((item, itemIndex) => itemIndex > 0 && integerLists(item).length);
      for (const face of integerLists(coordIndexArg || "")) addEntityLoop(id, face.map((index) => pointList[index - 1]).filter(Boolean));
    } else if (entity.type.endsWith("BOUNDINGBOX") || entity.type.endsWith("BOUNDING_BOX")) {
      const args = splitTopLevelArgs(entity.args);
      const corner = points.get(firstId(args[0]));
      const xLength = scaledLength(args[1], lengthFormat);
      const yLength = scaledLength(args[2], lengthFormat);
      const zLength = scaledLength(args[3], lengthFormat);
      if (corner) addEntityLoops(id, boxLoops(corner, xLength, yLength, zLength));
    } else if (entity.type === "BLOCK" || entity.type.endsWith("IFCBLOCK")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const lengths = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0).slice(-3);
      if (lengths.length === 3) addEntityLoops(id, boxLoops([0, 0, 0], lengths[0], lengths[1], lengths[2], placement));
    } else if (type.endsWith("RIGHTCIRCULARCYLINDER")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const lengths = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0);
      if (lengths.length >= 2) addEntityLoops(id, circularPrimitiveLoops(lengths[1], lengths[0], placement));
    } else if (type.endsWith("RIGHTCIRCULARCONE")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const lengths = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0);
      if (lengths.length >= 2) addEntityLoops(id, circularPrimitiveLoops(lengths[1], lengths[0], placement, 0));
    } else if (type.endsWith("RECTANGULARPYRAMID")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const lengths = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0).slice(-3);
      if (lengths.length === 3) addEntityLoops(id, rectangularPyramidLoops(lengths[0], lengths[1], lengths[2], placement));
    } else if (type.endsWith("SPHERE")) {
      const args = splitTopLevelArgs(entity.args);
      const placementId = idsFromArgs(entity.args).find((itemId) => placements.has(itemId));
      const placement = placements.get(placementId) || identityPlacement();
      const radius = args.map((arg) => scaledLength(arg, lengthFormat)).filter((value) => value > 0).at(-1);
      if (radius > 0) addEntityLoops(id, sphereLoops(radius, placement));
    } else if (entity.type.endsWith("EXTRUDEDAREASOLIDTAPERED") || entity.type.endsWith("EXTRUDED_AREA_SOLID_TAPERED")) {
      const args = splitTopLevelArgs(entity.args);
      const profile = profiles.get(firstId(args[0]));
      const placement = placements.get(firstId(args[1])) || identityPlacement();
      const direction = directions.get(firstId(args[2])) || [0, 0, 1];
      const distance = scaledLength(args[3], lengthFormat);
      const endProfile = profiles.get(firstId(args[4]));
      if (profile?.loop && endProfile?.loop && distance > 0) {
        for (const face of extrudeTaperedLoop(profile.loop, endProfile.loop, direction, distance)) {
          addEntityLoop(id, face.map((point) => applyPlacement(placement, point)));
        }
      }
    } else if (entity.type.endsWith("EXTRUDEDAREASOLID") || entity.type.endsWith("EXTRUDED_AREA_SOLID")) {
      const args = splitTopLevelArgs(entity.args);
      const profile = profiles.get(firstId(args[0]));
      const placement = placements.get(firstId(args[1])) || identityPlacement();
      const direction = directions.get(firstId(args[2])) || [0, 0, 1];
      const distance = scaledLength(args[3], lengthFormat);
      if (profile?.loop && distance > 0) {
        for (const face of extrudeProfile(profile, direction, distance)) {
          addEntityLoop(id, face.map((point) => applyPlacement(placement, point)));
        }
      }
    } else if (entity.type.endsWith("REVOLVEDAREASOLID") || entity.type.endsWith("REVOLVED_AREA_SOLID")) {
      const args = splitTopLevelArgs(entity.args);
      const profile = profiles.get(firstId(args[0]));
      const placement = placements.get(firstId(args[1])) || identityPlacement();
      const axis = axis1Placements.get(firstId(args[2]));
      const angle = number(args[3]);
      if (profile?.loop && axis && Math.abs(angle) > 1e-9) {
        const axisOrigin = applyPlacement(placement, axis.origin);
        const axisDirection = transformVector(placement, axis.direction);
        const loop = profile.loop.map((point) => applyPlacement(placement, point));
        for (const face of revolveLoop(loop, axisOrigin, axisDirection, angle)) addEntityLoop(id, face);
      }
    } else if (entity.type.endsWith("SWEPTDISKSOLID") || entity.type.endsWith("SWEPT_DISK_SOLID") || entity.type.endsWith("SWEPTDISKSOLIDPOLYGONAL") || entity.type.endsWith("SWEPT_DISK_SOLID_POLYGONAL")) {
      const args = splitTopLevelArgs(entity.args);
      const directrix = polylines.get(firstId(args[0]));
      const radius = scaledLength(args[1], lengthFormat);
      if (directrix?.length >= 2 && radius > 0) {
        for (const face of sweptDiskLoops(directrix, radius)) addEntityLoop(id, face);
      }
    } else if (entity.type.endsWith("ADVANCED_FACE") || entity.type.endsWith("FACE_SURFACE") || entity.type.endsWith("ADVANCEDFACE") || entity.type.endsWith("IFCFACE") || entity.type === "FACE") {
      for (const loopId of idsFromArgs(entity.args)) {
        const loop = boundLoops.get(loopId);
        if (loop) {
          consumedEntityLoopIds.add(loopId);
          addEntityLoop(id, loop);
        }
      }
    }
  }
  const isBooleanEntity = (entity) => (
    entity.type.endsWith("BOOLEANRESULT") ||
    entity.type.endsWith("BOOLEAN_RESULT") ||
    entity.type.endsWith("BOOLEANCLIPPINGRESULT") ||
    entity.type.endsWith("BOOLEAN_CLIPPING_RESULT")
  );
  let booleanFallbackLoopCount = 0;
  const booleanSourceItemIds = new Set();
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const [id, entity] of entities) {
      if (!isBooleanEntity(entity) || entityLoops.has(id)) continue;
      const operandId = idsFromArgs(entity.args).find((itemId) => entityLoops.has(itemId));
      if (!operandId) continue;
      const added = addEntityLoops(id, entityLoops.get(operandId));
      if (added) {
        booleanSourceItemIds.add(operandId);
        booleanFallbackLoopCount += added;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const aggregatesEntityLoops = (entity) => (
    entity.type.endsWith("CLOSEDSHELL") ||
    entity.type.endsWith("CLOSED_SHELL") ||
    entity.type.endsWith("OPENSHELL") ||
    entity.type.endsWith("OPEN_SHELL") ||
    entity.type.endsWith("FACETEDBREP") ||
    entity.type.endsWith("FACETED_BREP") ||
    entity.type.endsWith("FACETEDBREPWITHVOIDS") ||
    entity.type.endsWith("FACETED_BREP_WITH_VOIDS") ||
    entity.type.endsWith("MANIFOLDSOLIDBREP") ||
    entity.type.endsWith("MANIFOLD_SOLID_BREP") ||
    entity.type.endsWith("ADVANCEDBREP") ||
    entity.type.endsWith("ADVANCED_BREP") ||
    entity.type.endsWith("FACEBASEDSURFACEMODEL") ||
    entity.type.endsWith("FACE_BASED_SURFACE_MODEL") ||
    entity.type.endsWith("SHELLBASEDSURFACEMODEL") ||
    entity.type.endsWith("SHELL_BASED_SURFACE_MODEL") ||
    entity.type.endsWith("CSGSOLID") ||
    entity.type.endsWith("CSG_SOLID")
  );
  let aggregatedLoopCount = 0;
  const aggregatedChildItemIds = new Set();
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const [id, entity] of entities) {
      if (!aggregatesEntityLoops(entity) || entityLoops.has(id)) continue;
      const childIds = idsFromArgs(entity.args).filter((itemId) => entityLoops.has(itemId));
      const childLoops = childIds.flatMap((itemId) => entityLoops.get(itemId) || []);
      if (!childLoops.length) continue;
      const added = addEntityLoops(id, childLoops);
      if (added) {
        for (const itemId of childIds) aggregatedChildItemIds.add(itemId);
        aggregatedLoopCount += added;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const localPlacementRefs = new Map();
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("LOCALPLACEMENT")) {
      const args = splitTopLevelArgs(entity.args);
      localPlacementRefs.set(id, { parent: firstId(args[0]), relative: firstId(args[1]) });
    }
  }
  const localPlacements = new Map();
  const resolveLocalPlacement = (id, stack = new Set()) => {
    if (!id) return identityPlacement();
    if (localPlacements.has(id)) return localPlacements.get(id);
    if (stack.has(id)) return identityPlacement();
    const ref = localPlacementRefs.get(id);
    if (!ref) return placements.get(id) || identityPlacement();
    stack.add(id);
    const parent = resolveLocalPlacement(ref.parent, stack);
    const relative = placements.get(ref.relative) || identityPlacement();
    const placement = composePlacement(parent, relative);
    localPlacements.set(id, placement);
    stack.delete(id);
    return placement;
  };
  for (const id of localPlacementRefs.keys()) resolveLocalPlacement(id);

  for (const [id, entity] of entities) {
    if (entity.type.endsWith("CARTESIANTRANSFORMATIONOPERATOR3D") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_3D") || entity.type.endsWith("CARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_3DNONUNIFORM") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_3D_NON_UNIFORM")) {
      const args = splitTopLevelArgs(entity.args);
      const axis1 = directions.get(firstId(args[0])) || [1, 0, 0];
      const axis2 = directions.get(firstId(args[1])) || [0, 1, 0];
      const origin = points.get(firstId(args[2])) || [0, 0, 0];
      const scale1 = number(args[3]) ?? 1;
      const axis3 = directions.get(firstId(args[4])) || [0, 0, 1];
      const nonUniform = /NON_?UNIFORM$/.test(entity.type);
      const scale2 = nonUniform ? (number(args[5]) ?? scale1) : scale1;
      const scale3 = nonUniform ? (number(args[6]) ?? scale1) : scale1;
      transforms.set(id, cartesianTransform(origin, axis1, axis2, axis3, scale1, scale2, scale3));
    } else if (entity.type.endsWith("CARTESIANTRANSFORMATIONOPERATOR2D") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_2D") || entity.type.endsWith("CARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_2DNONUNIFORM") || entity.type.endsWith("CARTESIAN_TRANSFORMATION_OPERATOR_2D_NON_UNIFORM")) {
      const args = splitTopLevelArgs(entity.args);
      const axis1 = directions.get(firstId(args[0])) || [1, 0, 0];
      const axis2 = directions.get(firstId(args[1])) || [0, 1, 0];
      const origin = points.get(firstId(args[2])) || [0, 0, 0];
      const scale1 = number(args[3]) ?? 1;
      const scale2 = /NON_?UNIFORM$/.test(entity.type) ? (number(args[4]) ?? scale1) : scale1;
      transforms.set(id, cartesianTransform(origin, axis1, axis2, [0, 0, 1], scale1, scale2, scale1));
    }
  }

  const representationItems = new Map();
  const representationCurveItems = new Map();
  const representationMaps = new Map();
  const productDefinitionShapes = new Map();
  const isShapeRepresentation = (entity) => entity.type.endsWith("SHAPEREPRESENTATION") || entity.type.endsWith("SHAPE_REPRESENTATION");
  const representationCurveIds = (ids) => {
    const out = [];
    for (const itemId of ids) {
      if (polylines.has(itemId)) out.push(itemId);
      for (const curveId of curveSets.get(itemId) || []) out.push(curveId);
    }
    return [...new Set(out)];
  };
  const representationGeometryIds = (args) => {
    let best = [];
    let bestScore = -1;
    for (const arg of args) {
      const ids = idsFromArgs(arg);
      const score = ids.filter((itemId) => entityLoops.has(itemId) || polylines.has(itemId) || curveSets.has(itemId)).length;
      if (score > bestScore) {
        bestScore = score;
        best = ids;
      }
    }
    return bestScore > 0 ? best : [];
  };
  for (const [id, entity] of entities) {
    const args = splitTopLevelArgs(entity.args);
    if (isShapeRepresentation(entity)) {
      const ids = representationGeometryIds(args);
      const itemIds = ids.filter((itemId) => entityLoops.has(itemId));
      const curveIds = representationCurveIds(ids);
      if (itemIds.length) representationItems.set(id, itemIds);
      if (curveIds.length) representationCurveItems.set(id, curveIds);
    }
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("REPRESENTATIONMAP") || entity.type.endsWith("REPRESENTATION_MAP")) {
      const args = splitTopLevelArgs(entity.args);
      const origin = placements.get(firstId(args[0])) || identityPlacement();
      const representationId = firstId(args[1]);
      if (representationId) representationMaps.set(id, { origin, representationId });
    }
  }
  let mappedLoopCount = 0;
  let mappedCurveCount = 0;
  const mappedSourceItemIds = new Set();
  const mappedSourceCurveIds = new Set();
  const mappedPolylines = [];
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("MAPPEDITEM") || entity.type.endsWith("MAPPED_ITEM")) {
      const args = splitTopLevelArgs(entity.args);
      const source = representationMaps.get(firstId(args[0]));
      const target = transforms.get(firstId(args[1])) || cartesianTransform();
      const itemIds = source ? representationItems.get(source.representationId) || [] : [];
      const itemLoops = itemIds.flatMap((itemId) => entityLoops.get(itemId) || []);
      if (itemLoops.length) {
        for (const itemId of itemIds) mappedSourceItemIds.add(itemId);
        for (const loop of itemLoops) {
          if (addEntityLoop(id, transformLoopBy(target, untransformLoop(source.origin, loop)))) mappedLoopCount += 1;
        }
      }
      const curveIds = source ? representationCurveItems.get(source.representationId) || [] : [];
      for (const curveId of curveIds) {
        const line = polylines.get(curveId);
        if (!line?.length) continue;
        mappedSourceCurveIds.add(curveId);
        mappedPolylines.push(transformLoopBy(target, untransformLoop(source.origin, line)));
        mappedCurveCount += 1;
      }
    }
  }
  for (const [id, entity] of entities) {
    if (!isShapeRepresentation(entity)) continue;
    const args = splitTopLevelArgs(entity.args);
    const ids = representationGeometryIds(args);
    const itemIds = ids.filter((itemId) => entityLoops.has(itemId));
    const curveIds = representationCurveIds(ids);
    if (itemIds.length) representationItems.set(id, itemIds);
    if (curveIds.length) representationCurveItems.set(id, curveIds);
  }
  for (const [id, entity] of entities) {
    if (entity.type.endsWith("PRODUCTDEFINITIONSHAPE")) {
      const args = splitTopLevelArgs(entity.args);
      const repIds = idsFromArgs(args[2] || entity.args).filter((repId) => representationItems.has(repId) || representationCurveItems.has(repId));
      if (repIds.length) productDefinitionShapes.set(id, repIds);
    }
  }
  const representedItemIds = new Set([...representationItems.values()].flat());
  const representedCurveItemIds = new Set([...representationCurveItems.values()].flat());
  const placedItemIds = new Set();
  const placedCurveIds = new Set();
  const placedPolylines = [];
  let placedLoopCount = 0;
  let placedCurveCount = 0;
  for (const entity of entities.values()) {
    const ids = idsFromArgs(entity.args);
    const placementId = ids.find((itemId) => localPlacements.has(itemId));
    const shapeId = ids.find((itemId) => productDefinitionShapes.has(itemId));
    if (!placementId || !shapeId) continue;
    const placement = localPlacements.get(placementId);
    for (const repId of productDefinitionShapes.get(shapeId) || []) {
      for (const itemId of representationItems.get(repId) || []) {
        const itemLoops = entityLoops.get(itemId) || [];
        if (!itemLoops.length) continue;
        placedItemIds.add(itemId);
        for (const loop of itemLoops) {
          if (pushLoop(loops, seenLoops, transformLoop(placement, loop))) placedLoopCount += 1;
        }
      }
      for (const curveId of representationCurveItems.get(repId) || []) {
        const line = polylines.get(curveId);
        if (!line?.length) continue;
        placedCurveIds.add(curveId);
        placedPolylines.push(transformLoop(placement, line));
        placedCurveCount += 1;
      }
    }
  }
  for (const [entityId, itemLoops] of entityLoops) {
    if (placedItemIds.has(entityId)) continue;
    if (mappedSourceItemIds.has(entityId)) continue;
    if (aggregatedChildItemIds.has(entityId)) continue;
    if (booleanSourceItemIds.has(entityId)) continue;
    if (consumedEntityLoopIds.has(entityId)) continue;
    if (representedItemIds.size && aggregatesEntityLoops(entities.get(entityId)) && !representedItemIds.has(entityId)) continue;
    for (const loop of itemLoops) pushLoop(loops, seenLoops, loop);
  }
  if (placedLoopCount) {
    doc.diagnostics.push(diag("info", `${format}-browser-product-placement`, `Browser ${format.toUpperCase()} importer applied product local placement to ${placedLoopCount} mesh face loop(s).`));
  }
  if (placedCurveCount) {
    doc.diagnostics.push(diag("info", `${format}-browser-curve-placement`, `Browser ${format.toUpperCase()} importer applied product local placement to ${placedCurveCount} curve/polyline item(s).`));
  }
  if (mappedLoopCount) {
    doc.diagnostics.push(diag("info", `${format}-browser-mapped-items`, `Browser ${format.toUpperCase()} importer expanded ${mappedLoopCount} mapped item face loop(s).`));
  }
  if (mappedCurveCount) {
    doc.diagnostics.push(diag("info", `${format}-browser-mapped-curves`, `Browser ${format.toUpperCase()} importer expanded ${mappedCurveCount} mapped curve/polyline item(s).`));
  }
  if (aggregatedLoopCount) {
    doc.diagnostics.push(diag("info", `${format}-browser-shell-brep`, `Browser ${format.toUpperCase()} importer aggregated ${aggregatedLoopCount} shell/B-rep face loop(s).`));
  }
  if (booleanFallbackLoopCount) {
    doc.diagnostics.push(diag("warning", `${format}-browser-boolean-fallback`, `Browser ${format.toUpperCase()} importer approximated boolean/clipping results by displaying the first operand for ${booleanFallbackLoopCount} face loop(s); cutting geometry is not applied yet.`));
  }
  const emitPolylines = (items) => {
    if (!items.length) return 0;
    doc.layers.reference = { name: "reference", color: DEFAULT_COLOR };
    let added = 0;
    for (const line of items) {
      let points = line.filter(finitePoint);
      const closed = points.length > 2 && sameSpfPoint(points[0], points.at(-1));
      if (closed) points = points.slice(0, -1);
      if (points.length >= 2) {
        doc.polylines.push({ id: `${cleanId(file.name)}_polyline_${doc.polylines.length + 1}`, layer: "reference", closed, points });
        added += 1;
      }
    }
    return added;
  };
  const placedPolylineCount = emitPolylines(placedPolylines);
  const mappedPolylineCount = emitPolylines(mappedPolylines);
  if (loops.length && meshFromLoops(doc, file, loops)) {
    doc.diagnostics.push(diag("info", `${format}-browser-spf-mesh`, `Browser ${format.toUpperCase()} importer extracted ${loops.length} mesh face loop(s) from SPF topology/tessellation.`));
  } else if (polylines.size) {
    const standalone = [...polylines.entries()]
      .filter(([itemId]) => !placedCurveIds.has(itemId) && !mappedSourceCurveIds.has(itemId) && !representedCurveItemIds.has(itemId))
      .map(([, line]) => line);
    emitPolylines(standalone.length ? standalone : (placedPolylineCount || mappedPolylineCount) ? [] : [...polylines.values()]);
    doc.diagnostics.push(diag("info", `${format}-browser-spf-polylines`, `Browser ${format.toUpperCase()} importer extracted ${doc.polylines.length} SPF polyline(s).`));
  } else if (points.size) {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color: DEFAULT_POINT_COLOR, pointSize: 3, sourcePointCount: points.size, storedPointCount: Math.min(points.size, MAX_POINTS), points: [...points.values()].slice(0, MAX_POINTS) });
    doc.diagnostics.push(diag("warning", `${format}-points-only`, `Browser ${format.toUpperCase()} importer extracted CARTESIAN_POINT coordinates only; full solids need a built-in geometry decoder/tessellator.`));
  } else {
    doc.diagnostics.push(diag("warning", `${format}-browser-limited`, `Browser ${format.toUpperCase()} importer could not extract mesh loops from this file; full ${format.toUpperCase()} support needs a built-in geometry decoder/tessellator.`));
  }
  return doc;
}

function pointTextTokens(line) {
  const text = String(line || "").trim();
  return text.includes(";") ? text.split(/[;\s]+/).filter(Boolean) : text.split(/[,\s]+/).filter(Boolean);
}

function packedRgb(value, floatPacked = false) {
  if (typeof value === "string") {
    const hash = /^(?:#|0x)?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value.trim());
    if (hash) return [0, 2, 4].map((index) => Number.parseInt(hash[1].slice(index, index + 2), 16));
  }
  const numeric = number(value);
  if (!Number.isFinite(numeric)) return null;
  let packed = Math.trunc(numeric);
  if (floatPacked) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, numeric, true);
    packed = new DataView(buffer).getUint32(0, true);
  }
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

function pointTextLooksLike(text) {
  let valid = 0;
  for (const raw of textLines(text).slice(0, 80)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const values = pointTextTokens(trimmed).map(number);
    if (values.slice(0, 3).every(Number.isFinite)) valid += 1;
    if (valid >= 2) return true;
  }
  return false;
}

function pointTextHeader(tokens) {
  const keys = tokens.map((token) => String(token || "").toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const find = (aliases) => keys.findIndex((key) => aliases.includes(key));
  const x = find(["x", "xcoord", "xcoordinate", "e", "east", "easting", "eastings"]);
  const y = find(["y", "ycoord", "ycoordinate", "n", "north", "northing", "northings"]);
  const z = find(["z", "zcoord", "zcoordinate", "h", "height", "elev", "elevation", "level", "rl", "reducedlevel"]);
  return x >= 0 && y >= 0 && z >= 0 ? { x, y, z } : null;
}

function pointTextRgb(values) {
  if (values.length >= 7 && values.slice(4, 7).every(Number.isFinite)) return values.slice(4, 7);
  return values.length >= 6 && values.slice(3, 6).every(Number.isFinite) ? values.slice(3, 6) : null;
}

function pcdHeader(bytes) {
  const sample = textFromBytes(bytes.subarray(0, Math.min(bytes.length, TEXT_SAMPLE_BYTES)));
  const dataMatch = /\bDATA\s+(\S+)\s*(?:\r\n|\n|\r)/i.exec(sample);
  if (!dataMatch) return null;
  const header = { data: dataMatch[1].toLowerCase(), dataOffset: dataMatch.index + dataMatch[0].length };
  for (const raw of textLines(sample.slice(0, dataMatch.index))) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const tokens = pointTextTokens(line);
    const key = tokens[0]?.toLowerCase();
    if (key === "fields") header.fields = tokens.slice(1).map((token) => token.toLowerCase());
    else if (key === "size") header.sizes = tokens.slice(1).map((token) => Math.trunc(number(token)) || 4);
    else if (key === "type") header.types = tokens.slice(1).map((token) => token.toUpperCase());
    else if (key === "count") header.counts = tokens.slice(1).map((token) => Math.max(1, Math.trunc(number(token)) || 1));
    else if (key === "width" || key === "height" || key === "points") header[key] = Math.max(0, Math.trunc(number(tokens[1])) || 0);
  }
  return header;
}

function pcdFieldValue(data, offset, field) {
  if (offset + field.size > data.byteLength) return null;
  if (field.type === "F") return field.size === 8 ? data.getFloat64(offset, true) : data.getFloat32(offset, true);
  if (field.type === "U") {
    if (field.size === 1) return data.getUint8(offset);
    if (field.size === 2) return data.getUint16(offset, true);
    if (field.size === 4) return data.getUint32(offset, true);
  }
  if (field.size === 1) return data.getInt8(offset);
  if (field.size === 2) return data.getInt16(offset, true);
  if (field.size === 4) return data.getInt32(offset, true);
  return null;
}

function parsePcd(bytes, file, format) {
  const doc = emptyDoc();
  const header = pcdHeader(bytes);
  if (!header?.fields?.length) {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "pcd-header-missing", "Browser PCD importer could not read the PCD header."));
    return doc;
  }
  if (header.data === "ascii") return parsePointText(textFromBytes(bytes), file, format);
  if (header.data !== "binary") {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "pcd-data-unsupported", `PCD DATA ${header.data || ""} is not supported by the built-in browser importer; use DATA ascii or DATA binary.`));
    return doc;
  }
  const fields = [];
  let offset = 0;
  for (let index = 0; index < header.fields.length; index += 1) {
    const name = header.fields[index];
    const size = header.sizes?.[index] || 4;
    const type = header.types?.[index] || "F";
    const count = header.counts?.[index] || 1;
    for (let item = 0; item < count; item += 1) {
      fields.push({ name: count > 1 ? `${name}_${item}` : name, baseName: name, size, type, offset });
      offset += size;
    }
  }
  const recordSize = offset;
  const xField = fields.find((field) => field.name === "x" || field.baseName === "x");
  const yField = fields.find((field) => field.name === "y" || field.baseName === "y");
  const zField = fields.find((field) => field.name === "z" || field.baseName === "z");
  if (!recordSize || !xField || !yField || !zField) {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "pcd-fields-missing", "Browser PCD importer needs x/y/z fields in DATA binary payloads."));
    return doc;
  }
  const declared = header.points || (header.width && header.height ? header.width * header.height : 0);
  const available = Math.max(0, Math.floor((bytes.length - header.dataOffset) / recordSize));
  const sourcePointCount = declared || available;
  const storedPointCount = Math.min(sourcePointCount, available, MAX_POINTS);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rgbField = fields.find((field) => field.name === "rgb" || field.name === "rgba");
  const rField = fields.find((field) => field.name === "r");
  const gField = fields.find((field) => field.name === "g");
  const bField = fields.find((field) => field.name === "b");
  const points = [];
  const colorSum = [0, 0, 0];
  let colorCount = 0;
  for (let pointIndex = 0; pointIndex < storedPointCount; pointIndex += 1) {
    const base = header.dataOffset + pointIndex * recordSize;
    const point = [xField, yField, zField].map((field) => pcdFieldValue(data, base + field.offset, field));
    if (!point.every(Number.isFinite)) continue;
    points.push(point);
    let rgb = null;
    if (rgbField) {
      const value = pcdFieldValue(data, base + rgbField.offset, rgbField);
      rgb = packedRgb(value, rgbField.type === "F" && rgbField.size === 4);
    } else if (rField && gField && bField) {
      rgb = [rField, gField, bField].map((field) => pcdFieldValue(data, base + field.offset, field));
    }
    if (rgb?.every(Number.isFinite)) {
      colorSum[0] += rgb[0];
      colorSum[1] += rgb[1];
      colorSum[2] += rgb[2];
      colorCount += 1;
    }
  }
  const color = colorCount ? `#${colorSum.map((sum) => Math.max(0, Math.min(255, Math.round(sum / colorCount))).toString(16).padStart(2, "0")).join("")}` : DEFAULT_POINT_COLOR;
  doc.layers.points = { name: "points", color };
  if (points.length) {
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color, pointSize: 3, sourcePointCount, storedPointCount: points.length, points });
    doc.diagnostics.push(diag("info", "pcd-binary-points", `Browser PCD importer read ${points.length} DATA binary point row(s).`));
  } else {
    doc.diagnostics.push(diag("warning", "pcd-no-points", "Browser PCD importer found no finite x/y/z point rows."));
  }
  return doc;
}

const PLY_TYPES = {
  char: { size: 1, read: (data, offset) => data.getInt8(offset) },
  int8: { size: 1, read: (data, offset) => data.getInt8(offset) },
  uchar: { size: 1, read: (data, offset) => data.getUint8(offset) },
  uint8: { size: 1, read: (data, offset) => data.getUint8(offset) },
  short: { size: 2, read: (data, offset, little) => data.getInt16(offset, little) },
  int16: { size: 2, read: (data, offset, little) => data.getInt16(offset, little) },
  ushort: { size: 2, read: (data, offset, little) => data.getUint16(offset, little) },
  uint16: { size: 2, read: (data, offset, little) => data.getUint16(offset, little) },
  int: { size: 4, read: (data, offset, little) => data.getInt32(offset, little) },
  int32: { size: 4, read: (data, offset, little) => data.getInt32(offset, little) },
  uint: { size: 4, read: (data, offset, little) => data.getUint32(offset, little) },
  uint32: { size: 4, read: (data, offset, little) => data.getUint32(offset, little) },
  float: { size: 4, read: (data, offset, little) => data.getFloat32(offset, little) },
  float32: { size: 4, read: (data, offset, little) => data.getFloat32(offset, little) },
  double: { size: 8, read: (data, offset, little) => data.getFloat64(offset, little) },
  float64: { size: 8, read: (data, offset, little) => data.getFloat64(offset, little) }
};

function plyHeader(bytes) {
  const sample = textFromBytes(bytes.subarray(0, Math.min(bytes.length, TEXT_SAMPLE_BYTES)));
  const match = /(?:^|\r\n|\n|\r)end_header\s*(?:\r\n|\n|\r)/i.exec(sample);
  if (!match) return null;
  const headerText = sample.slice(0, match.index + match[0].length);
  const lines = textLines(headerText).map((line) => line.trim()).filter(Boolean);
  if (lines[0]?.toLowerCase() !== "ply") return null;
  const header = { dataOffset: new TextEncoder().encode(headerText).length, format: "", elements: [] };
  let element = null;
  for (const line of lines.slice(1)) {
    if (!line || line.startsWith("comment") || line.startsWith("obj_info")) continue;
    const tokens = pointTextTokens(line);
    const key = tokens[0]?.toLowerCase();
    if (key === "format") header.format = tokens[1]?.toLowerCase() || "";
    else if (key === "element") {
      element = { name: tokens[1]?.toLowerCase() || "", count: Math.max(0, Math.trunc(number(tokens[2])) || 0), properties: [] };
      header.elements.push(element);
    } else if (key === "property" && element) {
      if (tokens[1]?.toLowerCase() === "list") element.properties.push({ list: true, countType: tokens[2]?.toLowerCase(), itemType: tokens[3]?.toLowerCase(), name: tokens[4]?.toLowerCase() });
      else element.properties.push({ type: tokens[1]?.toLowerCase(), name: tokens[2]?.toLowerCase() });
    }
  }
  return header;
}

function plyColor(vertex) {
  const r = vertex.red ?? vertex.r;
  const g = vertex.green ?? vertex.g;
  const b = vertex.blue ?? vertex.b;
  return [r, g, b].every(Number.isFinite) ? [r, g, b] : null;
}

function plyDocFromGeometry(file, vertices, faces, colorSum, colorCount, sourceVertexCount = vertices.length) {
  const doc = emptyDoc();
  const color = colorCount ? `#${colorSum.map((sum) => Math.max(0, Math.min(255, Math.round(sum / colorCount))).toString(16).padStart(2, "0")).join("")}` : DEFAULT_POINT_COLOR;
  if (faces.length) {
    doc.layers.reference = { name: "reference", color: DEFAULT_MESH_COLOR, opacity: 0.18 };
    doc.meshes.push({ id: `${cleanId(file.name)}_mesh`, layer: "reference", color: DEFAULT_MESH_COLOR, opacity: 0.18, vertices, faces });
  } else if (vertices.length) {
    doc.layers.points = { name: "points", color };
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color, pointSize: 3, sourcePointCount: Math.max(sourceVertexCount, vertices.length), storedPointCount: vertices.length, points: vertices });
  } else {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "ply-no-geometry", "Browser PLY importer found no vertex point or face geometry."));
  }
  return doc;
}

function parsePly(bytes, file, format) {
  const header = plyHeader(bytes);
  const doc = emptyDoc();
  if (!header?.format) {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "ply-header-missing", "Browser PLY importer could not read the PLY header."));
    return doc;
  }
  const vertexElement = header.elements.find((element) => element.name === "vertex");
  const faceElement = header.elements.find((element) => element.name === "face");
  const vertices = [];
  const faces = [];
  const colorSum = [0, 0, 0];
  let colorCount = 0;
  const vertexCount = vertexElement?.count || 0;
  const faceCount = faceElement?.count || 0;
  const vertexReadCount = faceCount ? vertexCount : Math.min(vertexCount, MAX_POINTS);
  if (header.format === "ascii") {
    const lines = textLines(textFromBytes(bytes.subarray(header.dataOffset))).filter((line) => line.trim());
    let lineIndex = 0;
    for (let index = 0; index < vertexReadCount && lineIndex < lines.length; index += 1, lineIndex += 1) {
      const values = pointTextTokens(lines[lineIndex]).map(number);
      const vertex = {};
      for (let propIndex = 0; propIndex < vertexElement.properties.length; propIndex += 1) vertex[vertexElement.properties[propIndex].name] = values[propIndex];
      const point = [vertex.x, vertex.y, vertex.z];
      if (point.every(Number.isFinite)) vertices.push(point);
      const rgb = plyColor(vertex);
      if (rgb) {
        colorSum[0] += rgb[0];
        colorSum[1] += rgb[1];
        colorSum[2] += rgb[2];
        colorCount += 1;
      }
    }
    for (let index = 0; index < faceCount && lineIndex < lines.length; index += 1, lineIndex += 1) {
      const values = pointTextTokens(lines[lineIndex]).map((value) => Math.trunc(number(value))).filter(Number.isInteger);
      const count = values[0] || 0;
      const face = values.slice(1, count + 1).filter((item, itemIndex, items) => item >= 0 && item < vertices.length && items.indexOf(item) === itemIndex);
      if (face.length >= 3) faces.push(face);
    }
  } else if (header.format === "binary_little_endian" || header.format === "binary_big_endian") {
    const little = header.format === "binary_little_endian";
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = header.dataOffset;
    for (let index = 0; index < vertexReadCount && offset < bytes.length; index += 1) {
      const vertex = {};
      for (const property of vertexElement.properties) {
        const type = PLY_TYPES[property.type];
        if (!type || property.list) return doc;
        vertex[property.name] = type.read(data, offset, little);
        offset += type.size;
      }
      const point = [vertex.x, vertex.y, vertex.z];
      if (point.every(Number.isFinite)) vertices.push(point);
      const rgb = plyColor(vertex);
      if (rgb) {
        colorSum[0] += rgb[0];
        colorSum[1] += rgb[1];
        colorSum[2] += rgb[2];
        colorCount += 1;
      }
    }
    for (let index = 0; index < faceCount && offset < bytes.length; index += 1) {
      const list = faceElement.properties.find((property) => property.list);
      if (!list) break;
      const countType = PLY_TYPES[list.countType];
      const itemType = PLY_TYPES[list.itemType];
      if (!countType || !itemType) break;
      const count = Math.max(0, Math.trunc(countType.read(data, offset, little) || 0));
      offset += countType.size;
      const face = [];
      for (let item = 0; item < count && offset < bytes.length; item += 1) {
        const vertexIndex = Math.trunc(itemType.read(data, offset, little));
        if (vertexIndex >= 0 && vertexIndex < vertices.length && !face.includes(vertexIndex)) face.push(vertexIndex);
        offset += itemType.size;
      }
      for (const property of faceElement.properties.filter((property) => !property.list)) {
        const type = PLY_TYPES[property.type];
        if (type) offset += type.size;
      }
      if (face.length >= 3) faces.push(face);
    }
  } else {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.diagnostics.push(diag("warning", "ply-format-unsupported", `PLY format ${header.format || ""} is not supported by the built-in browser importer.`));
    return doc;
  }
  const out = plyDocFromGeometry(file, vertices, faces, colorSum, colorCount, vertexCount);
  out.diagnostics.push(diag("info", faces.length ? "ply-mesh" : "ply-point-cloud", `Browser PLY importer read ${vertices.length}${!faces.length && vertexCount > vertices.length ? ` of ${vertexCount}` : ""} vertex row(s)${faces.length ? ` and ${faces.length} face(s)` : ""}.`));
  return out;
}

function lasColorOffset(pointFormat) {
  if (pointFormat === 2) return 20;
  if (pointFormat === 3 || pointFormat === 5) return 28;
  if (pointFormat === 7 || pointFormat === 8 || pointFormat === 10) return 30;
  return null;
}

function lasColor(data, offset) {
  if (offset + 6 > data.byteLength) return null;
  const values = [
    data.getUint16(offset, true),
    data.getUint16(offset + 2, true),
    data.getUint16(offset + 4, true)
  ];
  return values.map((value) => value > 255 ? Math.round(value / 256) : value);
}

function parseLas(bytes, file, format) {
  const doc = emptyDoc();
  doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
  if (!bytesStart(bytes, [0x4c, 0x41, 0x53, 0x46]) || bytes.length < 227) {
    doc.diagnostics.push(diag("warning", "las-header-missing", "Browser LAS importer could not read a valid LASF header."));
    return doc;
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const versionMajor = data.getUint8(24);
  const versionMinor = data.getUint8(25);
  const headerSize = data.getUint16(94, true);
  const pointDataOffset = data.getUint32(96, true);
  const rawPointFormat = data.getUint8(104);
  const pointFormat = rawPointFormat & 0x3f;
  const compressedFlag = (rawPointFormat & 0x80) !== 0;
  const recordLength = data.getUint16(105, true);
  const legacyCount = data.getUint32(107, true);
  const extendedCount = headerSize >= 255 && bytes.length >= 255 ? u64(bytes, 247) : 0;
  const sourcePointCount = legacyCount || extendedCount || 0;
  const xScale = data.getFloat64(131, true);
  const yScale = data.getFloat64(139, true);
  const zScale = data.getFloat64(147, true);
  const xOffset = data.getFloat64(155, true);
  const yOffset = data.getFloat64(163, true);
  const zOffset = data.getFloat64(171, true);
  const headerBounds = bytes.length >= 227 ? {
    min: [data.getFloat64(187, true), data.getFloat64(203, true), data.getFloat64(219, true)],
    max: [data.getFloat64(179, true), data.getFloat64(195, true), data.getFloat64(211, true)]
  } : null;
  doc.sourcePatch = {
    lasVersion: `${versionMajor}.${versionMinor}`,
    lasHeaderSize: headerSize,
    lasPointDataOffset: pointDataOffset,
    lasPointFormat: pointFormat,
    lasPointRecordLength: recordLength,
    lasSourcePointCount: sourcePointCount,
    ...(headerBounds?.min.every(Number.isFinite) && headerBounds.max.every(Number.isFinite) ? { lasHeaderBounds: headerBounds } : {})
  };
  if (compressedFlag) {
    doc.diagnostics.push(diag("warning", "las-compressed-unsupported", "This LAS payload marks compressed point records; import LAZ/LAS through an uncompressed LAS export or another visible point format."));
    return doc;
  }
  if (!recordLength || pointDataOffset >= bytes.length || ![xScale, yScale, zScale, xOffset, yOffset, zOffset].every(Number.isFinite)) {
    doc.diagnostics.push(diag("warning", "las-header-invalid", "Browser LAS importer found an invalid point data offset, record length, scale, or offset."));
    return doc;
  }
  const available = Math.floor((bytes.length - pointDataOffset) / recordLength);
  const storedPointCount = Math.min(sourcePointCount || available, available, MAX_POINTS);
  const points = [];
  const colorOffset = lasColorOffset(pointFormat);
  const colorSum = [0, 0, 0];
  let colorCount = 0;
  for (let index = 0; index < storedPointCount; index += 1) {
    const offset = pointDataOffset + index * recordLength;
    const point = [
      data.getInt32(offset, true) * xScale + xOffset,
      data.getInt32(offset + 4, true) * yScale + yOffset,
      data.getInt32(offset + 8, true) * zScale + zOffset
    ];
    if (!point.every(Number.isFinite)) continue;
    points.push(point);
    if (colorOffset !== null && colorOffset + 6 <= recordLength) {
      const rgb = lasColor(data, offset + colorOffset);
      if (rgb?.every(Number.isFinite)) {
        colorSum[0] += rgb[0];
        colorSum[1] += rgb[1];
        colorSum[2] += rgb[2];
        colorCount += 1;
      }
    }
  }
  const color = colorCount ? `#${colorSum.map((sum) => Math.max(0, Math.min(255, Math.round(sum / colorCount))).toString(16).padStart(2, "0")).join("")}` : DEFAULT_POINT_COLOR;
  doc.layers.points = { name: "points", color };
  if (points.length) {
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color, pointSize: 3, sourcePointCount: sourcePointCount || available, storedPointCount: points.length, points });
    doc.diagnostics.push(diag("info", "las-points", `Browser LAS importer read ${points.length} uncompressed point record(s).`));
  } else {
    doc.diagnostics.push(diag("warning", "las-no-points", "Browser LAS importer found no finite x/y/z point records."));
  }
  return doc;
}

function parseLaz(bytes, file, format) {
  const doc = emptyDoc();
  doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
  doc.sourcePatch = { lazSize: bytes.length };
  doc.diagnostics.push(diag("warning", "laz-compressed-unsupported", "LAZ compressed point records are not decoded by the built-in browser importer yet. Export uncompressed LAS, ASCII/PCD/PLY point cloud, or E57 metadata for a visible fallback."));
  return doc;
}

function ptxMatrix(headerLines) {
  const rows = headerLines.slice(4, 8).map((line) => pointTextTokens(line).map(number).slice(0, 4));
  return rows.length === 4 && rows.every((row) => row.length === 4 && row.every(Number.isFinite)) ? rows : null;
}

function transformPtxPoint(point, matrix) {
  if (!matrix) return point;
  const [x, y, z] = point;
  const w = matrix[3][0] * x + matrix[3][1] * y + matrix[3][2] * z + matrix[3][3];
  const next = [
    matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z + matrix[0][3],
    matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z + matrix[1][3],
    matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z + matrix[2][3]
  ];
  return Number.isFinite(w) && Math.abs(w) > 1e-12 && Math.abs(w - 1) > 1e-12 ? next.map((value) => value / w) : next;
}

function parsePtx(text, file, format) {
  const doc = emptyDoc();
  const lines = textLines(text).map((line) => line.trim()).filter(Boolean);
  const points = [];
  const colorSum = [0, 0, 0];
  let colorCount = 0;
  let sourcePointCount = 0;
  let scanCount = 0;
  let skippedInvalid = 0;
  let index = 0;
  const singleInteger = (line) => {
    const values = pointTextTokens(line).map(number);
    return values.length === 1 && Number.isInteger(values[0]) && values[0] > 0 ? values[0] : 0;
  };
  while (index < lines.length && points.length < MAX_POINTS) {
    const columns = singleInteger(lines[index]);
    const rows = singleInteger(lines[index + 1]);
    if (!columns || !rows) {
      index += 1;
      continue;
    }
    scanCount += 1;
    const expected = columns * rows;
    sourcePointCount += expected;
    const headerStart = index + 2;
    const headerLines = lines.slice(headerStart, headerStart + 8);
    const matrix = headerLines.length === 8 ? ptxMatrix(headerLines) : null;
    index = headerStart + (headerLines.length >= 8 ? 8 : 0);
    let read = 0;
    while (index < lines.length && read < expected && points.length < MAX_POINTS) {
      const values = pointTextTokens(lines[index]).map(number);
      index += 1;
      if (values.length < 3) continue;
      read += 1;
      const rawPoint = values.slice(0, 3);
      if (!rawPoint.every(Number.isFinite)) continue;
      const intensity = values[3];
      if (rawPoint.every((value) => Math.abs(value) < 1e-12) && (!Number.isFinite(intensity) || Math.abs(intensity) < 1e-12)) {
        skippedInvalid += 1;
        continue;
      }
      points.push(scalePoint(transformPtxPoint(rawPoint, matrix), format));
      const rgb = values.length >= 7
        ? values.slice(4, 7)
        : values.length >= 6 ? values.slice(3, 6) : null;
      if (rgb?.every(Number.isFinite)) {
        const factor = rgb.every((value) => value <= 1) ? 255 : 1;
        colorSum[0] += rgb[0] * factor;
        colorSum[1] += rgb[1] * factor;
        colorSum[2] += rgb[2] * factor;
        colorCount += 1;
      }
    }
  }
  const color = colorCount
    ? `#${colorSum.map((sum) => Math.max(0, Math.min(255, Math.round(sum / colorCount))).toString(16).padStart(2, "0")).join("")}`
    : DEFAULT_POINT_COLOR;
  doc.layers.points = { name: "points", color };
  doc.sourcePatch = { ptxScanCount: scanCount, ...(skippedInvalid ? { ptxSkippedInvalidRows: skippedInvalid } : {}) };
  if (points.length) {
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color, pointSize: 3, sourcePointCount: Math.max(sourcePointCount, points.length), storedPointCount: points.length, points });
    doc.diagnostics.push(diag("info", "ptx-points", `Browser PTX importer read ${points.length} point row(s) from ${scanCount} scan block(s).`));
  } else {
    doc.diagnostics.push(diag("warning", "ptx-no-points", "Browser PTX importer found no finite point rows."));
  }
  return doc;
}

function parsePointText(text, file, format) {
  const doc = emptyDoc();
  const points = [];
  const colorSum = [0, 0, 0];
  let colorCount = 0;
  let header = null;
  let declared = null;
  let pcd = null;
  let dataStarted = false;
  const pcdSource = /\.pcd$/i.test(file.name) || /^\s*(?:#\s*)?\.?PCD\b/im.test(text) || /^\s*FIELDS\s+/im.test(text);
  for (const raw of textLines(text)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const tokens = pointTextTokens(trimmed);
    const lower = tokens.map((token) => token.toLowerCase());
    if (pcdSource && !dataStarted) {
      if (lower[0] === "fields") pcd = { ...(pcd || {}), fields: lower.slice(1) };
      else if (lower[0] === "count") pcd = { ...(pcd || {}), counts: lower.slice(1).map((token) => Math.max(1, Math.trunc(number(token)) || 1)) };
      else if (lower[0] === "points") declared = Math.max(declared || 0, Math.trunc(number(tokens[1])) || 0);
      else if (lower[0] === "width" || lower[0] === "height") pcd = { ...(pcd || {}), [lower[0]]: Math.trunc(number(tokens[1])) || 0 };
      else if (lower[0] === "data") {
        if (lower[1] !== "ascii") {
          doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
          doc.diagnostics.push(diag("warning", "pcd-data-unsupported", `PCD DATA ${tokens[1] || ""} is not supported by the built-in browser importer; export DATA ascii.`));
          return doc;
        }
        dataStarted = true;
        if (!declared && pcd?.width && pcd?.height) declared = pcd.width * pcd.height;
      }
      continue;
    }
    if (!header) {
      header = pointTextHeader(tokens);
      if (header) continue;
    }
    if (!header && lower.includes("x") && lower.includes("y") && lower.includes("z")) {
      header = { x: lower.indexOf("x"), y: lower.indexOf("y"), z: lower.indexOf("z") };
      continue;
    }
    if (!header && tokens.length === 1 && Number.isInteger(number(tokens[0])) && points.length === 0) {
      declared = number(tokens[0]);
      continue;
    }
    const values = tokens.map(number);
    let point = header ? [values[header.x], values[header.y], values[header.z]] : values.slice(0, 3);
    let rgb = null;
    if (pcd?.fields?.length) {
      const expandedFields = [];
      for (let index = 0; index < pcd.fields.length; index += 1) {
        const count = pcd.counts?.[index] || 1;
        for (let item = 0; item < count; item += 1) expandedFields.push(pcd.fields[index]);
      }
      const indexOf = (names) => expandedFields.findIndex((field) => names.includes(field));
      const ix = indexOf(["x"]);
      const iy = indexOf(["y"]);
      const iz = indexOf(["z"]);
      point = [values[ix], values[iy], values[iz]];
      const ir = indexOf(["r", "red"]);
      const ig = indexOf(["g", "green"]);
      const ib = indexOf(["b", "blue"]);
      const packed = indexOf(["rgb", "rgba"]);
      if (ir >= 0 && ig >= 0 && ib >= 0) rgb = [values[ir], values[ig], values[ib]];
      else if (packed >= 0) rgb = packedRgb(tokens[packed] || values[packed], false);
    } else {
      rgb = pointTextRgb(values);
    }
    if (point.length === 3 && point.every(Number.isFinite)) points.push(scalePoint(point, format));
    if (rgb?.length === 3 && rgb.every(Number.isFinite)) {
      const factor = rgb.every((value) => value <= 1) ? 255 : 1;
      colorSum[0] += rgb[0] * factor;
      colorSum[1] += rgb[1] * factor;
      colorSum[2] += rgb[2] * factor;
      colorCount += 1;
    }
    if (points.length >= MAX_POINTS) break;
  }
  if (points.length) {
    const color = colorCount
      ? `#${colorSum.map((sum) => Math.max(0, Math.min(255, Math.round(sum / colorCount))).toString(16).padStart(2, "0")).join("")}`
      : DEFAULT_POINT_COLOR;
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color, pointSize: 3, sourcePointCount: Math.max(points.length, declared || 0), storedPointCount: points.length, points });
  } else doc.diagnostics.push(diag("warning", "point-text-no-points", "Browser point-text importer found no XYZ rows."));
  return doc;
}

function parseObj(text, file, format) {
  const doc = emptyDoc();
  const vertices = [];
  const faces = [];
  const polylines = [];
  const objIndex = (token) => {
    const value = Number.parseInt(String(token || "").split("/")[0], 10);
    if (!Number.isInteger(value) || value === 0) return -1;
    return value < 0 ? vertices.length + value : value - 1;
  };
  for (const raw of textLines(text)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const tokens = line.split(/\s+/);
    if (tokens[0] === "v") {
      const point = tokens.slice(1, 4).map(number);
      if (point.length === 3 && point.every(Number.isFinite)) vertices.push(scalePoint(point, format));
    } else if (tokens[0] === "f") {
      const face = tokens.slice(1).map(objIndex).filter((index) => index >= 0 && index < vertices.length);
      if (face.length >= 3) faces.push(face);
    } else if (tokens[0] === "l") {
      const points = tokens.slice(1).map((token) => vertices[objIndex(token)]).filter(Boolean);
      if (points.length >= 2) polylines.push(points);
    }
  }
  if (faces.length) {
    doc.layers.reference = { name: "reference", color: DEFAULT_MESH_COLOR, opacity: 0.18 };
    doc.meshes.push({ id: `${cleanId(file.name)}_mesh`, layer: "reference", color: DEFAULT_MESH_COLOR, opacity: 0.18, vertices, faces });
  }
  for (const points of polylines) {
    doc.layers.reference = doc.layers.reference || { name: "reference", color: DEFAULT_COLOR };
    doc.polylines.push({ id: `${cleanId(file.name)}_polyline_${doc.polylines.length + 1}`, layer: "reference", points });
  }
  if (!faces.length && !polylines.length && vertices.length) {
    doc.layers.points = { name: "points", color: DEFAULT_POINT_COLOR };
    doc.pointClouds.push({ id: `${cleanId(file.name)}_points`, layer: "points", color: DEFAULT_POINT_COLOR, pointSize: 3, points: vertices.slice(0, MAX_POINTS), sourcePointCount: vertices.length, storedPointCount: Math.min(vertices.length, MAX_POINTS) });
  }
  if (!doc.meshes.length && !doc.polylines.length && !doc.pointClouds.length) doc.diagnostics.push(diag("warning", "obj-no-geometry", "Browser OBJ importer found no faces, lines, or vertices."));
  return doc;
}
