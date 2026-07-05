const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function checkDevServerContracts(errors) {
  const serverText = read("scripts/serve_viewer.js");
  const workflowText = [
    read("docs/workflows/codex-workflow.md"),
    read("docs/workflows/multi-agent-codex.md")
  ].join("\n");

  if (!serverText.includes("function branchPathPrefix") || !serverText.includes("`/${branchPath}`")) {
    fail(errors, "Dev server must build branch-scoped preview URLs with a /<branch>/ path prefix after the host");
  }
  if (!serverText.includes("function addBranchPathPrefix") || !serverText.includes("stripBranchPathPrefix")) {
    fail(errors, "Dev server must add and serve a branch path prefix instead of relying on a branch query parameter");
  }
  if (serverText.includes("function addBranchQuery") || serverText.includes('searchParams.set("branch"')) {
    fail(errors, "Dev server must not use branch= query parameters for agent preview URLs");
  }
  if (!workflowText.includes("/codex/agent2/") || !workflowText.includes("/codex/agentN/")) {
    fail(errors, "Workflow docs must show the branch immediately after the host in the preview URL path");
  }
  if (workflowText.includes("branch query parameter") || workflowText.includes("branch=codex%2Fagent")) {
    fail(errors, "Workflow docs must not require branch= query preview URLs");
  }
}

module.exports = { checkDevServerContracts };
