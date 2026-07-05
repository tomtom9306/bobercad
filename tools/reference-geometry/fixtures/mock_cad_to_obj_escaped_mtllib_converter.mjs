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
  fs.writeFileSync(path.join(outputDir, "escaped # materials.mtl"), [
    "# material file name intentionally contains a hash escaped by mtllib",
    "newmtl escaped-hash-steel # inline material comment",
    "Kd 0.1 0.8 0.4 # inline color comment",
    "d -halo 0.55",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with an escaped hash in a quoted MTL filename",
    "mtllib \"escaped \\# materials.mtl\" # inline mtllib comment",
    "o escaped_hash_material_source",
    "g escaped_hash_faces",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "usemtl escaped-hash-steel # inline usemtl comment",
    "f 1 2 3 # inline face comment",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD escaped-hash mtllib OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
