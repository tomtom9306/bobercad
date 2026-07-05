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
    "# PointId X Y Z Intensity Red Green Blue Classification NormalX NormalY NormalZ",
    "3",
    "101 -10 -20 0 0.1 255 0 0 4 0 0 1",
    "102 0 0 5 0.2 0 255 0 5 0 1 0",
    "103 10 20 10 0.3 0 0 255 6 1 0 0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 commented index-header XYZ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
