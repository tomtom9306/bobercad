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
  fs.writeFileSync(path.join(outputDir, "usemtl_off_materials.mtl"), [
    "newmtl red_steel",
    "Kd 1 0 0",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD OBJ where usemtl off clears material state",
    "mtllib usemtl_off_materials.mtl",
    "o usemtl_off_piece",
    "v 0 0 0",
    "v 1 0 0",
    "v 0 1 0",
    "v 2 0 0",
    "v 3 0 0",
    "v 2 1 0",
    "v 4 0 0",
    "v 5 0 0",
    "v 4 1 0",
    "g colored_face",
    "usemtl red_steel",
    "f 1 2 3",
    "g unmaterialized_face",
    "usemtl off",
    "f 4 5 6",
    "g none_material_face",
    "usemtl none",
    "f 7 8 9",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD usemtl off OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
