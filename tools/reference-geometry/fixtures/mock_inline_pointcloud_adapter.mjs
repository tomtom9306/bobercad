#!/usr/bin/env node
import crypto from "crypto";
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

function schemaRef(outputPath) {
  return path.relative(path.dirname(path.resolve(outputPath)), REFERENCE_GEOMETRY_SCHEMA).replaceAll(path.sep, "/");
}

function checksum(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input and --output are required");
  const objectId = "inline_adapter_scan";
  const points = [
    [-120, -80, 0],
    [-40, -40, 15],
    [20, 10, 30],
    [80, 40, 45],
    [140, 70, 60]
  ];
  const pointAttributes = {
    colors: [
      [38, 99, 235],
      [14, 165, 233],
      [20, 184, 166],
      [34, 197, 94],
      [234, 179, 8]
    ],
    intensities: [0.12, 0.28, 0.45, 0.62, 0.88],
    classifications: [1, 1, 2, 2, 2],
    normals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1]
    ]
  };
  writeJson(args.output, {
    $schema: schemaRef(args.output),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || "inline_adapter_reference",
      name: args.name || "Inline Adapter Reference",
      source: {
        format: args.format || "e57",
        fileName: path.basename(args.input),
        checksum: checksum(args.input),
        translator: "mock-inline-pointcloud-adapter",
        translatorVersion: "0.1.0"
      },
      units: args.units || "mm",
      coordinateSystem: {
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      bounds: {
        min: [-120, -80, 0],
        max: [140, 70, 60]
      }
    },
    layers: {
      inline_adapter_points: {
        id: "inline_adapter_points",
        name: "inline_adapter_points",
        display: {
          color: "#0f766e",
          pointSize: 18
        }
      }
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        name: "Inline adapter scan",
        layer: "inline_adapter_points",
        bounds: {
          min: [999, 999, 999],
          max: [1000, 1000, 1000]
        },
        points,
        pointAttributes
      }
    },
    chunks: [],
    diagnostics: []
  });
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
