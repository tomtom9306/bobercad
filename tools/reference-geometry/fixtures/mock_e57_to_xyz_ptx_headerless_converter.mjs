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
    "2",
    "1",
    "100 200 300",
    "1 0 0",
    "0 1 0",
    "0 0 1",
    "1 0 0 0",
    "0 1 0 0",
    "0 0 1 0",
    "0 0 0 1",
    "10 20 30 0.50 255 10 20",
    "40 50 60 0.75 30 40 50",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 headerless PTX XYZ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
