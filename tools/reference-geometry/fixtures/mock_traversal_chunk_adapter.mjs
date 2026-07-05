#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../../..");
const REFERENCE_GEOMETRY_SCHEMA = path.join(ROOT, "bobercad/app/schemas/reference-geometry.schema.json");

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
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input and --output are required");

  const objectId = "traversal_adapter_scan";
  const chunkId = "traversal_adapter_chunk";
  const chunkPath = process.env.BOBERCAD_TRAVERSAL_CHUNK_PATH || "../traversal-adapter-leak.chunk.json";
  const bounds = {
    min: [0, 0, 0],
    max: [0, 0, 0]
  };

  writeJson(args.output, {
    $schema: schemaRef(args.output, REFERENCE_GEOMETRY_SCHEMA),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || "traversal_chunk_reference",
      name: args.name || "Traversal Chunk Reference",
      source: {
        format: args.format || "e57",
        fileName: path.basename(args.input),
        translator: "mock-traversal-chunk-adapter",
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
      traversal_adapter_points: {
        id: "traversal_adapter_points",
        name: "traversal_adapter_points"
      }
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        layer: "traversal_adapter_points",
        chunkIds: [chunkId],
        bounds
      }
    },
    chunks: [
      {
        id: chunkId,
        kind: "point-cloud",
        objectId,
        path: chunkPath,
        pointCount: 1,
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
