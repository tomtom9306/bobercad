const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCOPES = [
  "bobercad/app",
  "bobercad/data/libraries",
  "bobercad/data/projects",
  "scripts",
  "tools",
  "docs/architecture",
  "docs/workflows",
  "docs/quality",
  "docs/decisions",
  "docs/exec-plans/active"
];
const EXTENSIONS = new Set([".mjs", ".js", ".json", ".html", ".css", ".md", ".py"]);
const IGNORE_DIRS = new Set([".git", "node_modules", "__pycache__"]);

function repoPath(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(file, out);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) out.push(file);
  }
  return out;
}

function csv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function moduleSpecifiers(line) {
  const specs = [];
  const re = /(?:import|export)\s+(?:[^'"()]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = re.exec(line))) specs.push(match[1] || match[2]);
  return specs;
}

function resolveSpecifier(file, specifier) {
  if (!specifier.startsWith(".")) return null;
  return repoPath(path.resolve(path.dirname(file), specifier.split("?")[0]));
}

function layer(relative) {
  if (relative.startsWith("bobercad/app/engine/")) return "engine";
  if (relative.startsWith("bobercad/app/rendering/")) return "rendering";
  if (relative.startsWith("bobercad/app/ui/")) return "ui";
  if (relative.startsWith("bobercad/data/libraries/")) return "data-libraries";
  if (relative.startsWith("bobercad/data/projects/")) return "projects";
  if (relative.startsWith("scripts/")) return "scripts";
  if (relative.startsWith("tools/")) return "tools";
  if (relative.startsWith("docs/")) return "docs";
  return "other";
}

function addFinding(findings, file, line, score, category, issue, evidence, fix) {
  findings.push({ file, line, score, category, issue, evidence, fix });
}

function scanFile(file) {
  const relative = repoPath(file);
  const ext = path.extname(relative);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const currentLayer = layer(relative);
  const findings = [];
  let imports = 0;
  let exports = 0;
  let functions = 0;
  let domRefs = 0;
  let listeners = 0;
  let createElements = 0;
  let includesCalls = 0;
  let failErrors = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if ((ext === ".mjs" || ext === ".js" || ext === ".html") && /\bimport\b|\bexport\b/.test(line)) {
      exports += /\bexport\b/.test(line) ? 1 : 0;
      const specs = moduleSpecifiers(line);
      imports += specs.length;
      for (const specifier of specs) {
        const target = resolveSpecifier(file, specifier);
        const targetLayer = target ? layer(target) : "external";
        if (specifier.includes("?v=")) {
          addFinding(findings, relative, lineNumber, 4, "Import hygiene", "Source import contains cache-buster query", specifier, "Remove query string and handle cache policy outside source imports");
        }
        if (currentLayer === "data-libraries" && targetLayer === "ui") {
          addFinding(findings, relative, lineNumber, 5, "Boundary", "Data library imports app UI", specifier, "Move UI adapter into app/ui and keep data library headless");
        }
        if (currentLayer === "data-libraries" && targetLayer === "rendering") {
          addFinding(findings, relative, lineNumber, 5, "Boundary", "Data library imports rendering", specifier, "Move rendering adapter into app/runtime boundary");
        }
        if (currentLayer === "data-libraries" && target?.startsWith("bobercad/app/engine/") && !target.startsWith("bobercad/app/engine/api/")) {
          addFinding(findings, relative, lineNumber, 5, "Boundary", "Data library imports private engine", specifier, "Expose a public engine API or move helper into app-owned code");
        }
        if (currentLayer === "engine" && (targetLayer === "ui" || targetLayer === "rendering")) {
          addFinding(findings, relative, lineNumber, 5, "Boundary", "Engine imports upper layer", specifier, "Invert dependency through public engine API or app composition");
        }
        if (currentLayer === "rendering" && targetLayer === "ui") {
          addFinding(findings, relative, lineNumber, 4, "Boundary", "Rendering imports UI", specifier, "Move UI dependency behind a shell/viewer port");
        }
      }
    }

    if (/\bfunction\b|=>/.test(line)) functions += (line.match(/\bfunction\b|=>/g) || []).length;
    if ((ext === ".mjs" || ext === ".js" || ext === ".html") && /\b(document|window|globalThis|localStorage|sessionStorage|customElements)\b/.test(line)) {
      domRefs += (line.match(/\b(document|window|globalThis|localStorage|sessionStorage|customElements)\b/g) || []).length;
      if (currentLayer === "engine") {
        addFinding(findings, relative, lineNumber, 5, "Runtime boundary", "Engine source references browser global", trimmed, "Inject runtime dependency or move browser code to app/ui");
      }
      if (currentLayer === "data-libraries") {
        addFinding(findings, relative, lineNumber, 5, "Runtime boundary", "Data library source references browser global", trimmed, "Move UI/browser code out of data libraries");
      }
      if (currentLayer === "rendering" && /\b(document|window|globalThis)\b/.test(line)) {
        addFinding(findings, relative, lineNumber, 4, "Runtime boundary", "Rendering source owns browser/global hook", trimmed, "Inject DOM/event/perf ports from UI shell");
      }
    }
    if (line.includes("addEventListener")) listeners += 1;
    if (line.includes("createElement")) createElements += 1;
    if (line.includes(".includes(")) includesCalls += 1;
    if (line.includes("fail(errors")) failErrors += 1;

    if (currentLayer === "data-libraries" && relative.includes("/smart-components/") && /\bctx\.project\b|\bctx\.model\b|\bobjectIndex\b/.test(line)) {
      addFinding(findings, relative, lineNumber, 4, "Public API", "Smart Component bypasses public ctx/model API", trimmed, "Add public ctx resolver and block direct project/objectIndex reads");
    }
    if (currentLayer === "data-libraries" && relative.includes("/smart-components/") && /\.placementIntent\??\.|\.placementIntent\./.test(line)) {
      addFinding(findings, relative, lineNumber, 4, "Source of truth", "Smart Component reads placementIntent as geometry data", trimmed, "Use stored geometry, solver output, or registered primitive data");
    }
    const allowedPlacementIntentSource = relative.includes("/rendering/scene/authoring/")
      || (relative.includes("/rendering/interaction/") && relative.endsWith("-create-controller.mjs"))
      || relative.includes("/debug/")
      || relative.includes("/display/");
    if ((currentLayer === "rendering" || relative.includes("/export")) && !allowedPlacementIntentSource && line.includes("placementIntent") && !trimmed.startsWith("//")) {
      addFinding(findings, relative, lineNumber, 5, "Source of truth", "Renderer/exporter reads placementIntent", trimmed, "Use stored geometry refs; placementIntent is metadata only");
    }
    if (relative.endsWith(".json") && /"(?:(?:mesh|meshes)|triangles|brep|bRep|sceneGraph|renderCache|geometryCache|meshCache|cachedGeometry|generatedGeometry)"\s*:/.test(line)) {
      addFinding(findings, relative, lineNumber, 5, "JSON source of truth", "Project/data JSON contains generated geometry/cache key", trimmed, "Remove generated geometry/cache from JSON source of truth");
    }
  }

  if (relative === "scripts/check_repo_contracts.js" && lines.length > 3000) {
    addFinding(findings, relative, 1, 5, "Checks", "Contract checker is a monolith", `${lines.length} lines; ${includesCalls} includes probes; ${failErrors} fail checks`, "Split architecture contract suites and replace broad token probes");
  }
  if (relative.endsWith(".mjs") || relative.endsWith(".js")) {
    if (lines.length >= 3000 && (currentLayer === "ui" || currentLayer === "rendering")) {
      addFinding(findings, relative, 1, 5, "Module size", "Runtime/UI module exceeds 3000 lines", `${lines.length} lines`, "Split by lifecycle responsibility");
    } else if (lines.length >= 2200) {
      addFinding(findings, relative, 1, 4, "Module size", "Source module exceeds 2200 lines", `${lines.length} lines`, "Split by domain aggregate/responsibility");
    } else if (lines.length >= 1200 && (functions >= 90 || exports >= 30 || imports >= 12)) {
      addFinding(findings, relative, 1, 3, "Module size", "High-complexity module", `${lines.length} lines; ${functions} function sites; ${exports} exports; ${imports} imports`, "Split once touching this area for feature work");
    }
  }

  return {
    file: relative,
    ext: path.extname(relative),
    lines: lines.length,
    imports,
    exports,
    functions,
    domRefs,
    listeners,
    createElements,
    includesCalls,
    failErrors,
    findings
  };
}

const files = [...new Set(SCOPES.flatMap((scope) => walk(path.join(ROOT, scope))).map(repoPath))]
  .sort()
  .map((relative) => path.join(ROOT, relative));
const results = files.map(scanFile);
const findings = results.flatMap((result) => result.findings);

const ledgerRows = results.map((result, index) => {
  const maxScore = result.findings.reduce((score, finding) => Math.max(score, finding.score), 0);
  const top = result.findings.slice().sort((a, b) => b.score - a.score)[0];
  return [
    index + 1,
    result.file,
    result.ext,
    result.lines,
    result.imports,
    result.exports,
    result.functions,
    result.domRefs,
    result.findings.length,
    maxScore,
    top?.issue || "none",
    top?.line || "",
    top?.fix || ""
  ];
});

fs.writeFileSync(
  path.join(ROOT, "docs/architecture/app-architecture-file-audit.csv"),
  [
    ["Index", "File", "Ext", "Lines", "Imports", "Exports", "FunctionSites", "BrowserGlobalRefs", "FindingCount", "MaxScore", "TopFinding", "EvidenceLine", "RequiredHardFix"].map(csv).join(","),
    ...ledgerRows.map((row) => row.map(csv).join(","))
  ].join("\n") + "\n"
);

fs.writeFileSync(
  path.join(ROOT, "docs/architecture/app-architecture-line-findings.csv"),
  [
    ["File", "Line", "Score", "Category", "Issue", "Evidence", "RequiredHardFix"].map(csv).join(","),
    ...findings
      .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line)
      .map((finding) => [finding.file, finding.line, finding.score, finding.category, finding.issue, finding.evidence, finding.fix].map(csv).join(","))
  ].join("\n") + "\n"
);

const summary = {
  files: results.length,
  lines: results.reduce((sum, result) => sum + result.lines, 0),
  findings: findings.length,
  byScore: findings.reduce((acc, finding) => {
    acc[finding.score] = (acc[finding.score] || 0) + 1;
    return acc;
  }, {}),
  filesByMaxScore: ledgerRows.reduce((acc, row) => {
    acc[row[9]] = (acc[row[9]] || 0) + 1;
    return acc;
  }, {})
};

console.log(JSON.stringify(summary, null, 2));
