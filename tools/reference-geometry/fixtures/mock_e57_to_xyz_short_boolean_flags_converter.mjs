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
    "cartesianX cartesianY cartesianZ intensity red green blue classification cartesianInvalidState cartesianValidState",
    "0 0 0 0.10 255 0 0 1 F T",
    "nan nan nan 0.90 255 255 255 99 F F",
    "nan nan nan 0.80 255 255 0 98 T T",
    "10 20 30 0.50 0 128 255 2 f t",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 short boolean flag converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
