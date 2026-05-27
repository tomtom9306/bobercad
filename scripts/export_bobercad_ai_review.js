const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE_ROOT = path.join(ROOT, "bobercad");
const DEFAULT_OUTPUT = path.join(ROOT, "bobercad-ai-review.txt");
const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

const INCLUDED_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs"]);
const SKIPPED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".parcel-cache",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "qa-output",
  "stress-output"
]);
const SKIPPED_REPO_DIRS = new Set(["docs", "scripts", "tools"]);
const LARGE_GENERATED_FILES = new Set(["bobercad/data/projects/sample_warehouse_12x24.json"]);

function usage() {
  return [
    "Usage: node scripts/export_bobercad_ai_review.js [output-file] [options]",
    "",
    "Creates one AI-review text bundle from BoberCAD product files.",
    "",
    "Options:",
    "  -o, --output <file>       Output path. Defaults to bobercad-ai-review.txt",
    "      --root <dir>          Source root. Defaults to bobercad",
    "      --include-large       Include large/generated files skipped by default",
    "      --max-file-bytes <n>  Skip files larger than n bytes unless --include-large is set",
    "  -h, --help                Show this help"
  ].join("\n");
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function relativeToRoot(filePath) {
  return normalize(path.relative(ROOT, filePath));
}

function resolveFromRoot(value) {
  return path.resolve(ROOT, value);
}

function parseArgs(argv) {
  const options = {
    sourceRoot: DEFAULT_SOURCE_ROOT,
    output: DEFAULT_OUTPUT,
    includeLarge: false,
    maxFileBytes: DEFAULT_MAX_FILE_BYTES
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-o" || arg === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a file path`);
      options.output = resolveFromRoot(value);
      index += 1;
    } else if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--root requires a directory path");
      options.sourceRoot = resolveFromRoot(value);
      index += 1;
    } else if (arg === "--include-large") {
      options.includeLarge = true;
    } else if (arg === "--max-file-bytes") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error("--max-file-bytes requires a positive integer");
      options.maxFileBytes = value;
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 1) throw new Error(`expected at most one output file, got ${positional.length}`);
  if (positional.length === 1) options.output = resolveFromRoot(positional[0]);

  return options;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function shouldSkipDirectory(dirPath, sourceRoot) {
  const name = path.basename(dirPath);
  if (SKIPPED_DIRECTORY_NAMES.has(name)) return "common generated/dependency directory";

  const repoRelative = relativeToRoot(dirPath);
  if (SKIPPED_REPO_DIRS.has(repoRelative)) return "repo support directory";

  const sourceRelative = normalize(path.relative(sourceRoot, dirPath));
  if (sourceRelative.startsWith("..")) return null;
  if (SKIPPED_REPO_DIRS.has(sourceRelative)) return "source support directory";

  return null;
}

function collectFiles(options) {
  const files = [];
  const skipped = [];
  const outputPath = path.resolve(options.output);

  function skip(filePath, reason) {
    skipped.push({ path: relativeToRoot(filePath), reason });
  }

  function walk(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const reason = shouldSkipDirectory(fullPath, options.sourceRoot);
        if (reason) {
          skip(fullPath, reason);
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        skip(fullPath, "not a regular file");
        continue;
      }

      const relative = relativeToRoot(fullPath);
      const extension = path.extname(entry.name).toLowerCase();
      const stats = fs.statSync(fullPath);

      if (path.resolve(fullPath) === outputPath) {
        skip(fullPath, "current output file");
      } else if (!INCLUDED_EXTENSIONS.has(extension)) {
        skip(fullPath, `unsupported extension ${extension || "(none)"}`);
      } else if (!options.includeLarge && LARGE_GENERATED_FILES.has(relative)) {
        skip(fullPath, "large generated sample project");
      } else if (!options.includeLarge && stats.size > options.maxFileBytes) {
        skip(fullPath, `larger than ${formatBytes(options.maxFileBytes)}`);
      } else {
        files.push({ path: relative, fullPath, size: stats.size });
      }
    }
  }

  walk(options.sourceRoot);
  return { files, skipped };
}

function buildBundle(options, files, skipped) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const lines = [
    "# BoberCAD AI Review Bundle",
    "",
    `Generated by: scripts/export_bobercad_ai_review.js`,
    `Source root: ${relativeToRoot(options.sourceRoot)}`,
    `Included files: ${files.length}`,
    `Included bytes: ${formatBytes(totalBytes)}`,
    `Skipped entries: ${skipped.length}`,
    "",
    "## File Index",
    "",
    ...files.map((file) => `- ${file.path} (${formatBytes(file.size)})`),
    "",
    "## Skipped Entries",
    "",
    ...(skipped.length ? skipped.map((entry) => `- ${entry.path}: ${entry.reason}`) : ["- None"]),
    "",
    "## File Contents"
  ];

  for (const file of files) {
    const content = fs.readFileSync(file.fullPath, "utf8").replace(/\s*$/u, "\n");
    lines.push("", `===== BEGIN FILE: ${file.path} =====`, content, `===== END FILE: ${file.path} =====`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return 0;
  }

  if (!fs.existsSync(options.sourceRoot) || !fs.statSync(options.sourceRoot).isDirectory()) {
    throw new Error(`source root does not exist or is not a directory: ${relativeToRoot(options.sourceRoot)}`);
  }

  const { files, skipped } = collectFiles(options);
  const bundle = buildBundle(options, files, skipped);

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, bundle, "utf8");

  console.log(`Wrote ${relativeToRoot(options.output)}`);
  console.log(`Included ${files.length} files (${formatBytes(files.reduce((sum, file) => sum + file.size, 0))})`);
  console.log(`Skipped ${skipped.length} entries`);
  if (skipped.some((entry) => entry.reason.includes("large"))) {
    console.log("Use --include-large to include large/generated files.");
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.error("");
    console.error(usage());
    process.exit(1);
  }
}
