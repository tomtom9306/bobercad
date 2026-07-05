#!/usr/bin/env node
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../../..");
const REFERENCE_GEOMETRY_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");
const POINT_CLOUD_CHUNK_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-point-cloud-chunk.schema.json");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index];
    else if (arg === "--output") args.output = argv[++index];
    else if (arg === "--format") args.format = argv[++index];
    else if (arg === "--asset-id") args.assetId = argv[++index];
    else if (arg === "--name") args.name = argv[++index];
    else if (arg === "--units") args.units = argv[++index];
    else if (arg === "--request") args.request = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function schemaRef(outputPath, schemaPath) {
  return path.relative(path.dirname(path.resolve(outputPath)), schemaPath).replaceAll(path.sep, "/");
}

function checksum(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const PUBLIC_SOURCE_STAT_EXTENSIONS = new Set(["dxf", "dwg", "step", "stp", "p21", "stpnc", "ifc", "ifcxml", "ifczip", "e57", "json"]);

function publicStatFingerprint(kind, publicIdentity, fileSizeBytes, fileModifiedTime) {
  const text = [
    kind || "",
    publicIdentity || "",
    Number.isInteger(fileSizeBytes) ? String(fileSizeBytes) : "",
    fileModifiedTime || ""
  ].join("\0");
  return `stat-sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

function sourceStatFingerprint(filePath) {
  const stat = fs.statSync(filePath);
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return publicStatFingerprint(
    "source-file",
    PUBLIC_SOURCE_STAT_EXTENSIONS.has(extension) ? extension : "",
    stat.size,
    stat.mtime.toISOString()
  );
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceFormat(format) {
  const normalized = String(format || "step").toLowerCase();
  if (normalized === "stp") return "step";
  if (normalized === "e57pointcloud") return "e57";
  return normalized;
}

function assertAdapterRequest(request, args, format) {
  if (!request || typeof request !== "object") throw new Error("adapter request must be a JSON object");
  if (request.schema !== "bobercad-reference-adapter-request") throw new Error("adapter request schema mismatch");
  if (request.schemaVersion !== "0.1.0") throw new Error("adapter request schemaVersion mismatch");
  if (typeof request.adapterRunId !== "string" || request.adapterRunId.length < 8) {
    throw new Error("adapter request adapterRunId mismatch");
  }
  if (process.env.BOBERCAD_REFERENCE_ADAPTER_RUN_ID && process.env.BOBERCAD_REFERENCE_ADAPTER_RUN_ID !== request.adapterRunId) {
    throw new Error("adapter request adapterRunId env mismatch");
  }
  if (!String(request.$schema || "").includes("reference-geometry-adapter-request.schema.json")) {
    throw new Error("adapter request should reference the adapter request schema");
  }
  if (
    request.schemaVersions?.adapterRequest !== "0.1.0"
    || request.schemaVersions?.referenceGeometry !== "0.1.0"
    || request.schemaVersions?.pointCloudChunk !== "0.1.0"
  ) {
    throw new Error("adapter request schemaVersions mismatch");
  }
  if (request.input !== path.resolve(args.input)) throw new Error("adapter request input mismatch");
  const inputStat = fs.statSync(args.input);
  if (request.sourceDirectory !== path.dirname(path.resolve(args.input))) throw new Error("adapter request sourceDirectory mismatch");
  if (request.sourceFileName !== path.basename(args.input)) throw new Error("adapter request sourceFileName mismatch");
  if (request.sourceFileStem !== path.basename(args.input, path.extname(args.input))) throw new Error("adapter request sourceFileStem mismatch");
  if (request.sourceFileExtension !== path.extname(args.input).replace(/^\./, "").toLowerCase()) throw new Error("adapter request sourceFileExtension mismatch");
  if (request.sourceFileSizeBytes !== inputStat.size) throw new Error("adapter request sourceFileSizeBytes mismatch");
  if (request.sourceFileModifiedTime !== inputStat.mtime.toISOString()) throw new Error("adapter request sourceFileModifiedTime mismatch");
  if (request.sourceStatFingerprint !== sourceStatFingerprint(args.input)) throw new Error("adapter request sourceStatFingerprint mismatch");
  if (request.output !== path.resolve(args.output)) throw new Error("adapter request output mismatch");
  if (request.outputDir !== path.dirname(path.resolve(args.output))) throw new Error("adapter request outputDir mismatch");
  if (request.stageDir !== path.dirname(path.resolve(args.output))) throw new Error("adapter request stageDir mismatch");
  if (request.scratchDir !== path.join(path.dirname(path.resolve(args.output)), "scratch")) throw new Error("adapter request scratchDir mismatch");
  if (!fs.existsSync(request.scratchDir)) throw new Error("adapter request scratchDir should exist before adapter launch");
  if (request.outputFileName !== path.basename(args.output)) throw new Error("adapter request outputFileName mismatch");
  if (request.outputFileStem !== path.basename(args.output, path.extname(args.output))) throw new Error("adapter request outputFileStem mismatch");
  if (request.chunkDir !== path.join(path.dirname(path.resolve(args.output)), "chunks")) throw new Error("adapter request chunkDir mismatch");
  if (!fs.existsSync(request.chunkDir)) throw new Error("adapter request chunkDir should exist before adapter launch");
  if (request.chunkPathPrefix !== "chunks/") throw new Error("adapter request chunkPathPrefix mismatch");
  if (request.adapterLogPath !== path.join(path.dirname(path.resolve(args.output)), "reference-adapter.log")) {
    throw new Error("adapter request adapterLogPath mismatch");
  }
  if (request.adapterStdoutPath !== path.join(path.dirname(path.resolve(args.output)), "reference-adapter.stdout.log")) {
    throw new Error("adapter request adapterStdoutPath mismatch");
  }
  if (request.adapterStderrPath !== path.join(path.dirname(path.resolve(args.output)), "reference-adapter.stderr.log")) {
    throw new Error("adapter request adapterStderrPath mismatch");
  }
  const expectedOutputMode = process.env.BOBERCAD_REFERENCE_ADAPTER_OUTPUT_MODE || "file";
  if (request.outputMode !== expectedOutputMode) throw new Error("adapter request outputMode mismatch");
  if (request.format !== format) throw new Error("adapter request format mismatch");
  if (!request.requestedFormat || typeof request.requestedFormat !== "string") throw new Error("adapter request requestedFormat mismatch");
  const expectedAdapterKey = process.env.BOBERCAD_REFERENCE_ADAPTER_EXPECTED_KEY || "mock_external";
  if (request.adapterKey !== expectedAdapterKey) throw new Error("adapter request adapterKey mismatch");
  if (!request.adapterConfigPath || !fs.existsSync(request.adapterConfigPath)) throw new Error("adapter request adapterConfigPath mismatch");
  if (request.adapterConfigDir !== path.dirname(request.adapterConfigPath)) throw new Error("adapter request adapterConfigDir mismatch");
  const adapterConfigStat = fs.statSync(request.adapterConfigPath);
  if (request.adapterConfigFileSizeBytes !== adapterConfigStat.size) throw new Error("adapter request adapterConfigFileSizeBytes mismatch");
  if (request.adapterConfigFileModifiedTime !== adapterConfigStat.mtime.toISOString()) throw new Error("adapter request adapterConfigFileModifiedTime mismatch");
  if (request.assetId !== args.assetId) throw new Error("adapter request assetId mismatch");
  if (request.units !== (args.units || "mm")) throw new Error("adapter request units mismatch");
  if (!Number.isInteger(request.pointCloudChunkSize) || request.pointCloudChunkSize < 1) {
    throw new Error("adapter request pointCloudChunkSize should be a positive integer");
  }
  if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 1) {
    throw new Error("adapter request timeoutMs should be a positive integer");
  }
  if (
    !request.schemas?.adapterRequest
    || !request.schemas?.referenceGeometry
    || !request.schemas?.pointCloudChunk
  ) {
    throw new Error("adapter request should include adapter and canonical schema paths");
  }
  if (
    process.env.BOBERCAD_REFERENCE_ADAPTER_REQUEST_SCHEMA_PATH
    && path.resolve(process.env.BOBERCAD_REFERENCE_ADAPTER_REQUEST_SCHEMA_PATH) !== path.resolve(request.schemas.adapterRequest)
  ) {
    throw new Error("adapter request adapter schema env mismatch");
  }
  if (
    process.env.BOBERCAD_REFERENCE_ADAPTER_REFERENCE_SCHEMA_PATH
    && path.resolve(process.env.BOBERCAD_REFERENCE_ADAPTER_REFERENCE_SCHEMA_PATH) !== path.resolve(request.schemas.referenceGeometry)
  ) {
    throw new Error("adapter request reference schema env mismatch");
  }
  if (
    process.env.BOBERCAD_REFERENCE_ADAPTER_CHUNK_SCHEMA_PATH
    && path.resolve(process.env.BOBERCAD_REFERENCE_ADAPTER_CHUNK_SCHEMA_PATH) !== path.resolve(request.schemas.pointCloudChunk)
  ) {
    throw new Error("adapter request chunk schema env mismatch");
  }
}

function meshReference(args, format) {
  return {
    layerId: `${format}_adapter_mesh`,
    bounds: {
      min: [0, 0, 0],
      max: [250, 160, 120]
    },
    objects: {
      [`${format}_adapter_mesh`]: {
        id: `${format}_adapter_mesh`,
        kind: "mesh",
        name: `${format.toUpperCase()} adapter mesh`,
        layer: `${format}_adapter_mesh`,
        vertices: [
          [0, 0, 0],
          [250, 0, 0],
          [250, 160, 0],
          [0, 160, 0],
          [0, 0, 120],
          [250, 0, 120],
          [250, 160, 120],
          [0, 160, 120]
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 7, 6, 5],
          [0, 4, 5, 1],
          [1, 5, 6, 2],
          [2, 6, 7, 3],
          [3, 7, 4, 0]
        ],
        metadata: {
          adapterFixture: true
        }
      }
    },
    chunks: []
  };
}

function pointCloudReference(args, format) {
  const chunkId = `${format}_adapter_chunk_1`;
  const objectId = `${format}_adapter_scan`;
  const chunkPath = path.join(path.dirname(path.resolve(args.output)), "chunks", `${chunkId}.json`);
  writeJson(chunkPath, {
    $schema: schemaRef(chunkPath, POINT_CLOUD_CHUNK_SCHEMA),
    schema: "bobercad-reference-point-cloud-chunk",
    schemaVersion: "0.1.0",
    id: chunkId,
    kind: "point-cloud",
    objectId,
    pointCount: 4,
    bounds: {
      min: [-100, -100, 0],
      max: [100, 100, 75]
    },
    points: [
      [-100, -100, 0],
      [100, -100, 25],
      [100, 100, 50],
      [-100, 100, 75]
    ],
    metadata: {
      adapterFixture: true
    }
  });
  return {
    layerId: `${format}_adapter_points`,
    bounds: {
      min: [-100, -100, 0],
      max: [100, 100, 75]
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        name: `${format.toUpperCase()} adapter scan`,
        layer: `${format}_adapter_points`,
        chunkIds: [chunkId],
        metadata: {
          adapterFixture: true
        }
      }
    },
    chunks: [
      {
        id: chunkId,
        kind: "point-cloud",
        objectId,
        path: path.relative(path.dirname(path.resolve(args.output)), chunkPath).replaceAll(path.sep, "/"),
        pointCount: 4,
        bounds: {
          min: [-100, -100, 0],
          max: [100, 100, 75]
        }
      }
    ]
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const stdoutOutput = /^(1|true|yes)$/i.test(process.env.BOBERCAD_REFERENCE_ADAPTER_OUTPUT_STDOUT || "");
  const format = sourceFormat(args.format);
  const request = args.request ? JSON.parse(fs.readFileSync(args.request, "utf8")) : null;
  if (request) assertAdapterRequest(request, args, format);
  const reference = format === "e57" ? pointCloudReference(args, format) : meshReference(args, format);
  const diagnostics = [];
  if (process.env.BOBERCAD_REFERENCE_ADAPTER_ENV_SMOKE) {
    const safeEnvSmoke = request?.adapterRunId
      ? process.env.BOBERCAD_REFERENCE_ADAPTER_ENV_SMOKE.split(request.adapterRunId).join("<adapterRunId>")
      : process.env.BOBERCAD_REFERENCE_ADAPTER_ENV_SMOKE;
    diagnostics.push({
      severity: "info",
      code: "mock-adapter-env-smoke",
      message: `Received adapter env smoke value: ${safeEnvSmoke}`
    });
  }
  if (request) {
    fs.writeFileSync(request.adapterLogPath, `mock adapter log for ${request.format}:${request.assetId}:${request.adapterRunId}\n`, "utf8");
    writeJson(path.join(request.scratchDir, "mock-adapter-scratch.json"), {
      adapterRunId: request.adapterRunId,
      format: request.format,
      assetId: request.assetId
    });
    diagnostics.push({
      severity: "info",
      code: "mock-adapter-request-smoke",
      message: `Received adapter request for ${request.format}:${request.requestedFormat}:${request.outputMode}:${request.adapterKey}:${request.assetId}:${request.outputDir}:${request.stageDir}:${request.scratchDir}:${request.outputFileName}:${request.outputFileStem}:${request.chunkDir}:${request.chunkPathPrefix}:${request.adapterLogPath}:${request.adapterStdoutPath}:${request.adapterStderrPath}:${request.sourceDirectory}:${request.sourceFileName}:${request.sourceFileStem}:${request.sourceFileExtension}:${request.sourceStatFingerprint}:${request.adapterConfigPath}:${request.adapterConfigDir}:${request.adapterConfigFileSizeBytes}:${request.adapterConfigFileModifiedTime}:${request.adapterRegistryFingerprint}:${request.adapterRegistryAdapterFingerprint}:${request.units}:${request.pointCloudChunkSize}:${request.timeoutMs}`
    });
  }
  console.error(`mock external adapter stderr for ${format}:${args.assetId || ""}`);
  const output = {
    $schema: schemaRef(args.output, REFERENCE_GEOMETRY_SCHEMA),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || `${format}_adapter_reference`,
      name: args.name || `${format.toUpperCase()} Adapter Reference`,
      source: {
        format,
        fileName: path.basename(args.input),
        statFingerprint: sourceStatFingerprint(args.input),
        checksum: checksum(args.input),
        translator: "mock-external-adapter",
        translatorVersion: "0.1.0"
      },
      units: args.units || "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: reference.bounds
    },
    layers: {
      [reference.layerId]: {
        id: reference.layerId,
        name: reference.layerId,
        display: {
          color: format === "e57" ? "#0f766e" : "#64748b",
          opacity: 0.5
        }
      }
    },
    objects: reference.objects,
    chunks: reference.chunks,
    diagnostics
  };
  if (stdoutOutput) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    console.log(`mock external adapter stdout for ${format}:${args.assetId || ""}`);
    writeJson(args.output, output);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
