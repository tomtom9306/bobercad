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
    "# .PCD v0.7 - Point Cloud Data file format",
    "VERSION 0.7",
    "FIELDS x y z intensity classification normal_x normal_y normal_z",
    "SIZE 4 4 4 4 4 4 4 4",
    "TYPE F F F F U F F F",
    "COUNT 1 1 1 1 1 1 1 1",
    "WIDTH 2",
    "HEIGHT 1",
    "POINTS 2",
    "DATA ascii",
    "0 0 0 0.5 1 0 0 1",
    "1 1 1 0.75 2 0 1 0",
    "2 2 2 0.9 3 1 0 0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 PCD extra-point-row converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
