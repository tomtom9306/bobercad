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
    "// exporter metadata: scan 001",
    "; coordinate system: local",
    "# headerless x y z RGB export",
    "3 // point count",
    "0 0 0 10 20 30 // origin point",
    "// midpoint comment",
    "5 10 15 40 50 60 # midpoint color",
    "; trailing comment before last point",
    "25 30 35 70 80 90 ; last point",
    ""
  ].join("\n"), "utf8");
  console.log(`mock E57 comments XYZ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
