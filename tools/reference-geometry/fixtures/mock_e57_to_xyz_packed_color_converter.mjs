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
  const mode = args.mode || "rgb";
  if (!["rgb", "rgba"].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  const lines = mode === "rgba"
    ? [
      "x y z rgba intensity classification",
      "0 0 0 0xff0000ff 0.1 1",
      "1 2 3 0x00ff00ff 0.2 2",
      ""
    ]
    : [
      "x y z rgb intensity classification",
      "0 0 0 16711680 0.1 1",
      "1 2 3 65280 0.2 2",
      ""
    ];
  fs.writeFileSync(args.output, lines.join("\n"), "utf8");
  console.log(`mock E57 packed color converter wrote ${args.output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
