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
    "sphericalRange sphericalAzimuth sphericalElevation intensity color.red color.green color.blue classification normal.x normal.y normal.z sphericalInvalidState sphericalValidState",
    "10 0 0 0.1 255 0 0 1 1 0 0 0 1",
    "10 180 0 0.9 255 255 255 99 0 0 1 1 1",
    "10 90 0 0.2 0 255 0 2 0 1 0 false true",
    "10 0 -30 0.8 0 0 255 98 1 0 0 false false",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 spherical invalid-state converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
