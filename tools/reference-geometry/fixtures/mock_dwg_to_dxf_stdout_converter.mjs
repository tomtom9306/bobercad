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
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    "0",
    "LINE",
    "8",
    "DWG_STDOUT_BRIDGE",
    "10",
    "0",
    "20",
    "0",
    "30",
    "0",
    "11",
    "125",
    "21",
    "0",
    "31",
    "0",
    "0",
    "POINT",
    "8",
    "DWG_STDOUT_BRIDGE_POINTS",
    "10",
    "25",
    "20",
    "30",
    "30",
    "0",
    "0",
    "ENDSEC",
    "0",
    "EOF",
    ""
  ].join("\n"));
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
