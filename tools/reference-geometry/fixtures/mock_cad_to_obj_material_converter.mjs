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
  fs.writeFileSync(path.join(outputDir, "mock_cad_materials.mtl"), [
    "newmtl red_steel",
    "Kd 1 0 0 # red diffuse",
    "d -halo 0.75 # red opacity",
    "newmtl blue_glass",
    "Kd 0 0.5 1 # blue diffuse",
    "Tr 0.25 # blue transparency",
    "newmtl edge_black",
    "Kd 0.2 0.2 0.2 # edge diffuse",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with materials",
    "mtllib mock_cad_materials.mtl",
    "o frame_piece",
    "v 0 0 0",
    "v 100 0 0",
    "v 100 100 0",
    "v 0 100 0",
    "g outer_faces",
    "usemtl red_steel",
    "f 1 2 3",
    "usemtl blue_glass",
    "f 1 3 4",
    "g edge_paths",
    "usemtl edge_black",
    "l 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD material OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
