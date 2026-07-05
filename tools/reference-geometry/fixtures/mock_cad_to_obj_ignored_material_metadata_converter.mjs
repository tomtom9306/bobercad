#!/usr/bin/env node
import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index];
    else if (arg === "--output") args.output = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("--input is required");
  if (!args.output) throw new Error("--output is required");
  const output = path.resolve(args.output);
  const outputDir = path.dirname(output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "ignored_material_metadata.mtl"), [
    "newmtl metadata_steel",
    "Ka 0.1 0.1 0.1",
    "Ks 0.2 0.2 0.2",
    "Ke 0 0 0",
    "Ns 16",
    "Ni 1.45",
    "Tf 1 1 1",
    "sharpness 60",
    "illum 2",
    "Kd 0.25 0.5 0.75",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock CAD OBJ material metadata output",
    "mtllib ignored_material_metadata.mtl",
    "o ignored_material_metadata_source",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "usemtl metadata_steel",
    "f 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD OBJ ignored material metadata converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
