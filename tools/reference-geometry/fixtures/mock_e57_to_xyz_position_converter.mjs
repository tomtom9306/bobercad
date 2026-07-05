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
    "\"Position X\",\"Position Y\",\"Position Z\",Intensity,Red,Green,Blue,Class,\"Normal X\",\"Normal Y\",\"Normal Z\"",
    "11,21,31,0.15,11,22,33,2,0,0,1",
    "12,22,32,0.45,44,55,66,3,0,1,0",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 position-column converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
