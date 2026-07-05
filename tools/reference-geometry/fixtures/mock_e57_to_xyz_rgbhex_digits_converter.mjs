#!/usr/bin/env node
import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index];
    else if (arg === "--output") args.output = argv[++index];
    else if (arg === "--mode") args.mode = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("--input is required");
  if (!args.output) throw new Error("--output is required");
  const mode = args.mode || "rgbhex";
  if (!["rgbhex", "rgbahex"].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  const lines = mode === "rgbahex"
    ? [
      "x y z rgbaHex intensity classification",
      "0 0 0 11223344 0.3 3",
      "1 2 3 22334455 0.4 4",
      ""
    ]
    : [
      "x y z rgbHex intensity classification",
      "0 0 0 001122 0.1 1",
      "1 2 3 002233 0.2 2",
      ""
    ];
  fs.writeFileSync(args.output, lines.join("\n"), "utf8");
  console.log(`mock E57 rgbHex digit converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
