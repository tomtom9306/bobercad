const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CHECKS = [
  "scripts/check_branch_guard.js",
  "scripts/check_repo_structure.js",
  "scripts/check_reference_geometry_translator.js",
  "scripts/validate_domain_model.js",
  "scripts/check_viewer_runtime.js"
];

for (const script of CHECKS) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
