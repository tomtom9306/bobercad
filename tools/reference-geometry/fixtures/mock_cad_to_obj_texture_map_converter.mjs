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
  fs.writeFileSync(path.join(outputDir, "texture_map_materials.mtl"), [
    "# mock material file with an unsupported texture map",
    "newmtl textured_steel",
    "Kd 0.7 0.7 0.7",
    "map_Kd texture.png",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with a texture-mapped material",
    "mtllib texture_map_materials.mtl",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "usemtl textured_steel",
    "f 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD texture-map OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
