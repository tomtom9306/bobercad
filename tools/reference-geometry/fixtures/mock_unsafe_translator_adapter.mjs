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

function schemaRef(outputPath) {
  return path.relative(path.dirname(path.resolve(outputPath)), REFERENCE_GEOMETRY_SCHEMA).replaceAll(path.sep, "/");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input and --output are required");

  writeJson(args.output, {
    $schema: schemaRef(args.output),
    schema: "bobercad-reference-geometry",
    schemaVersion: "0.1.0",
    asset: {
      id: args.assetId || "unsafe_translator_adapter_reference",
      name: args.name || "Unsafe Translator Adapter Reference",
      source: {
        format: args.format || "dwg",
        fileName: path.basename(args.input),
        translator: "C:/private/tools/reference-geometry/translate_reference_geometry.mjs",
        translatorVersion: "C:/private/adapter-version.txt"
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
        max: [100, 25, 0]
      }
    },
    layers: {
      unsafe_translator_lines: {
        id: "unsafe_translator_lines",
        name: "unsafe_translator_lines"
      }
    },
    objects: {
      unsafe_translator_line: {
        id: "unsafe_translator_line",
        kind: "line-set",
        layer: "unsafe_translator_lines",
        vertices: [[0, 0, 0], [100, 25, 0]],
        lineSegments: [[0, 1]]
      }
    },
    chunks: []
  });
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
