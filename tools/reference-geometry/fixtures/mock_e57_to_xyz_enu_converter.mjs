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
    "Easting,Northing,Elevation,Intensity,Red,Green,Blue,Classification,Normal X,Normal Y,Normal Z",
    "1000.25,2000.5,30.75,0.4,255,128,0,6,0,0,1",
    "1001.25,2001.5,31.75,0.8,0,64,255,7,1,0,0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 ENU converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
