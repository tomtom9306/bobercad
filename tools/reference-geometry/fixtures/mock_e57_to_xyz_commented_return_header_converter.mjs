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
    "# ReturnNumber NumberOfReturns ScanAngle GPSTime X Y Z Intensity Red Green Blue Classification",
    "2",
    "1 2 -4.5 100.00 7 8 9 0.15 10 20 30 3",
    "2 2 4.5 100.10 10 11 12 0.25 40 50 60 4",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 commented return-header XYZ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
