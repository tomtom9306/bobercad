const { spawnSync } = require("child_process");

const MAIN_BRANCH = "main";
const ALLOW_MAIN_EDITS_ENV = "BOBERCAD_ALLOW_MAIN_EDITS";

function git(args) {
  return spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function currentBranch() {
  const result = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function workingTreeStatus() {
  const result = git(["status", "--porcelain"]);
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function main() {
  if (process.env[ALLOW_MAIN_EDITS_ENV] === "1") {
    console.log(`OK: branch guard bypassed by ${ALLOW_MAIN_EDITS_ENV}=1`);
    return 0;
  }

  const branch = currentBranch();
  if (!branch || branch === "HEAD" || branch !== MAIN_BRANCH) {
    console.log("OK: branch guard passed");
    return 0;
  }

  const status = workingTreeStatus();
  if (!status) {
    console.log("OK: branch guard passed");
    return 0;
  }

  console.error("Branch guard failed: working tree has edits on `main`.");
  console.error("Create or switch to a task branch before editing, normally `codex/<short-task-name>`.");
  console.error(`Use ${ALLOW_MAIN_EDITS_ENV}=1 only when the user explicitly requested direct edits on main.`);
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
