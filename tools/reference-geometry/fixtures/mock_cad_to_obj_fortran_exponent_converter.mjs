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
  fs.writeFileSync(path.join(outputDir, "fortran_exponent_materials.mtl"), [
    "newmtl fortran_steel",
    "Kd 5.0D-1 2.5D-1 1.0D+0",
    "Tr 2.5D-1",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "mtllib fortran_exponent_materials.mtl",
    "o fortran_exponent_source",
    "g fortran_exponent_faces",
    "v 5.0D-1 0D+0 0D+0",
    "v 1.5D+0 0D+0 0D+0",
    "v 5,0D-1 1.25D+0 0D+0",
    "usemtl fortran_steel",
    "f 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD Fortran-exponent OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
