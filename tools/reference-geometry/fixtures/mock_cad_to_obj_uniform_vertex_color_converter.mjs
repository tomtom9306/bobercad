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
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, [
    "# mock tessellated CAD OBJ with uniform per-face and per-line vertex RGB",
    "o coloured_tessellation",
    "g red_face",
    "v 0 0 0 255 0 0",
    "v 10 0 0 255 0 0",
    "v 0 10 0 255 0 0",
    "f 1 2 3",
    "g blue_face",
    "v 20 0 0 0 128 255",
    "v 30 0 0 0 128 255",
    "v 20 10 0 0 128 255",
    "f 4 5 6",
    "g green_edge",
    "v 0 20 0 0 255 0",
    "v 10 20 0 0 255 0",
    "l 7 8",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD uniform vertex color OBJ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
