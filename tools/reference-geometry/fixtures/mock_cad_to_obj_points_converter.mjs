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
    "# mock tessellated CAD OBJ point elements",
    "o survey_control_points",
    "v 0 0 0 1 0 0",
    "v 10 0 0 0 1 0",
    "v 20 10 5 0 0 1",
    "v 20 30 40 128 64 32",
    "v 30 40 50 65535 32768 257",
    "p 1 2",
    "p -3 -2 -1",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD point OBJ converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
