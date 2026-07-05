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
  const output = path.resolve(args.output);
  const outputDir = path.dirname(output);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "bare space # materials.mtl"), [
    "# material file intentionally referenced by an unquoted escaped mtllib path",
    "newmtl bare space \\# steel",
    "Kd 0.4 0.6 1",
    "d 0.6",
    ""
  ].join("\n"), "utf8");
  fs.writeFileSync(output, [
    "# mock tessellated CAD mesh with bare escaped OBJ names",
    "mtllib bare\\ space\\ \\#\\ materials.mtl",
    "o bare\\ object\\ \\#1",
    "g bare\\ group\\ \\#2",
    "v 0 0 0",
    "v 100 0 0",
    "v 0 100 0",
    "usemtl bare\\ space\\ \\#\\ steel",
    "f 1 2 3",
    ""
  ].join("\n"), "utf8");
  console.log(`mock CAD bare-escaped OBJ converter wrote ${output} from ${args.input}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
