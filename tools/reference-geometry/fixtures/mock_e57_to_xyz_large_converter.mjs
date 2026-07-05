#!/usr/bin/env node
import fs from "fs";
import path from "path";

const POINT_COUNT = 1026;

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
  const rows = ["x y z intensity r g b classification"];
  for (let index = 0; index < POINT_COUNT; index += 1) {
    rows.push([
      index,
      index % 17,
      Math.floor(index / 17),
      (index % 100 / 100).toFixed(2),
      index % 256,
      (index * 3) % 256,
      (index * 7) % 256,
      index % 10
    ].join(" "));
  }
  rows.push("");
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, rows.join("\n"), "utf8");
  console.log(`mock large E57 to XYZ converter wrote ${POINT_COUNT} point(s) to ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
