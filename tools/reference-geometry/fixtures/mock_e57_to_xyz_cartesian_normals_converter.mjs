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
    "cartesianX cartesianY cartesianZ intensity colorRed colorGreen colorBlue classification cartesianNormalX cartesianNormalY cartesianNormalZ",
    "0 0 0 0.20 255 0 0 1 0 0 1",
    "10 20 30 0.40 0 255 0 2 0 1 0",
    "40 50 60 0.80 0 0 255 3 1 0 0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 cartesian-normal converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
