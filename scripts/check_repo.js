const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CHECKS = [
  "scripts/check_repo_structure.js",
  "scripts/check_viewer_geometry.js"
];

for (const script of CHECKS) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
