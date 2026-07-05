#!/usr/bin/env node

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") args.input = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("--input is required");
  process.stdout.write([
    "x y z intensity r g b",
    "1 2 3 0.2 255 0 0",
    "4 5 6 0.8 0 64 255",
    ""
  ].join("\n"));
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
