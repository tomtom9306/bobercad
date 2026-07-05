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
  const objectId = "mismatched_attribute_scan";
  const points = [
    [0, 0, 0],
    [100, 0, 20],
    [100, 100, 40]
  ];

  writeJson(args.output, {
    $schema: schemaRef(args.output),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || "mismatched_attribute_reference",
      name: args.name || "Mismatched Attribute Reference",
      source: {
        format: args.format || "e57",
        fileName: path.basename(args.input),
        checksum: checksum(args.input),
        translator: "mock-mismatched-point-attributes-adapter",
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
        min: [0, 0, 0],
        max: [100, 100, 40]
      }
    },
    layers: {
      mismatched_attribute_points: {
        id: "mismatched_attribute_points",
        name: "mismatched_attribute_points",
        display: {
          color: "#0f766e"
        }
      }
    },
    objects: {
      [objectId]: {
        id: objectId,
        kind: "point-cloud",
        name: "Mismatched attribute scan",
        layer: "mismatched_attribute_points",
        points,
        pointAttributes: {
          intensities: [0.2, 0.4]
        }
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
