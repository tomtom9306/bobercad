#!/usr/bin/env node
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
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function schemaRef(outputPath, schemaPath) {
  return path.relative(path.dirname(path.resolve(outputPath)), schemaPath).replaceAll(path.sep, "/");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input and --output are required");

  const chunkId = "bad_manifest_chunk";
  const objectId = "bad_manifest_scan";
  const outputPath = path.resolve(args.output);
  const chunkPath = path.join(path.dirname(outputPath), "chunks", `${chunkId}.json`);
  const bounds = {
    min: [0, 0, 0],
    max: [3, 0, 0]
  };

  writeJson(chunkPath, {
    $schema: schemaRef(chunkPath, POINT_CLOUD_CHUNK_SCHEMA),
    schema: "bobercad-reference-point-cloud-chunk",
    schemaVersion: "0.1.0",
    id: chunkId,
    kind: "point-cloud",
    objectId,
    pointCount: 4,
    bounds,
    points: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]
  });

  writeJson(outputPath, {
    $schema: schemaRef(outputPath, REFERENCE_GEOMETRY_SCHEMA),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || "bad_manifest_reference",
      name: args.name || "Bad Manifest Reference",
      source: {
        format: args.format || "e57",
        fileName: path.basename(args.input),
        translator: "mock-bad-chunk-manifest-adapter",
        translatorVersion: "0.1.0"
      },
      units: args.units || "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds
    },
    layers: {
      bad_manifest_points: {
        id: "bad_manifest_points",
        name: "bad_manifest_points"
      }
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        name: "Bad manifest scan",
        layer: "bad_manifest_points",
        chunkIds: [chunkId]
      }
    },
    chunks: [
      {
        id: chunkId,
        kind: "point-cloud",
        objectId,
        path: path.relative(path.dirname(outputPath), chunkPath).replaceAll(path.sep, "/"),
        pointCount: 999,
        bounds
      }
    ],
    diagnostics: []
  });
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
