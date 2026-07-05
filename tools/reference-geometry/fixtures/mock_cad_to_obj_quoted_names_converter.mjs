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
  fs.writeFileSync(path.join(outputDir, "quoted names.mtl"), [
    "newmtl \"quoted # steel\" # inline material-name comment",
    "Kd 0.25 0.5 1.0 # inline color comment",
    "Tr 0.2",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with quoted OBJ names",
    "mtllib \"quoted names.mtl\"",
    "o \"quoted object #1\"",
    "g \"finish group #2\"",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "usemtl \"quoted # steel\" # inline material reference comment",
    "f 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD quoted-name OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
