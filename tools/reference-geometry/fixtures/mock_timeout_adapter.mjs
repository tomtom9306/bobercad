#!/usr/bin/env node
import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") args.output = argv[++index];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.output) {
  fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
  fs.writeFileSync(args.output, "{\n  \"partial\": true\n}\n", "utf8");
}

setInterval(() => {}, 1000);
