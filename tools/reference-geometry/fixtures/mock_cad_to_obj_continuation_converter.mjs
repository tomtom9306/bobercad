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
    "# mock tessellated CAD mesh with continued OBJ records",
    "o continued_obj",
    "v 0 0 0",
    "v 100 0 0",
    "v 100 50 0",
    "v 0 50 0",
    "vt 0 0",
    "vt 1 0",
    "vt 1 1",
    "vt 0 1",
    "vn 0 0 1",
    "s 1",
    "f 1/1/1 2/2/1 \\",
    "  3/3/1 4/4/1 # continued quad face",
    "s off",
    "l 1/1/1 2/2/1 \\",
    "  3/3/1 4/4/1 # continued edge chain",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD OBJ continuation converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
