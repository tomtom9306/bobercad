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
    "# mock stdout tessellated CAD mesh",
    "o stdout_reference_box",
    "v 0 0 0",
    "v 120 0 0",
    "v 120 80 0",
    "v 0 80 0",
    "v 0 0 60",
    "v 120 0 60",
    "v 120 80 60",
    "v 0 80 60",
    "f 1 2 3 4",
    "f 5 8 7 6",
    "f 1 5 6 2",
    "f 2 6 7 3",
    "f 3 7 8 4",
    "f 4 8 5 1",
    "l 1 2 3",
    ""
  ].join("\n"));
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
