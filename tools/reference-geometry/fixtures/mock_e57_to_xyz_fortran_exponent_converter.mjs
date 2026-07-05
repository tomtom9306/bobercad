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
    "x y z intensity red green blue classification normal.x normal.y normal.z",
    "1.0D+1 2.5D+1 -3.0D+0 1.0D-1 2.55D+2 0D+0 1.28D+2 2D+0 0D+0 0D+0 1D+0",
    "-1,25D+1 0D+0 5,0D+0 2,0d-1 0D+0 2.55D+2 0D+0 3d+0 0D+0 1D+0 0D+0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 Fortran-exponent converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
