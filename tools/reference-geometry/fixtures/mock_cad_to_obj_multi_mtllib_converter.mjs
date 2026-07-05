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
  fs.writeFileSync(path.join(outputDir, "base materials.mtl"), [
    "newmtl base red",
    "Kd 1 0.1 0.1",
    "d 0.7",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(outputDir, "edge # materials.mtl"), [
    "newmtl edge \\# blue",
    "Kd 0.1 0.2 1",
    "Tr 0.2",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with multiple MTL libraries on one line",
    "mtllib \"base materials.mtl\" edge\\ \\#\\ materials.mtl",
    "o multi_mtllib_source",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "g multi_faces",
    "usemtl base red",
    "f 1 2 3",
    "g multi_edges",
    "usemtl edge\\ \\#\\ blue",
    "l 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD multi-mtllib OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
