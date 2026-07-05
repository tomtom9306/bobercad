const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(__dirname, "dev_server.config.json");
const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 5173,
  replaceExisting: true,
  defaultPath: "/bobercad/app/ui/viewer/index.html?demo=portal-frame-1&qaView=axonometric"
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webp": "image/webp"
};

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  };
}

function applyArgs(config) {
  const next = { ...config };
  const explicit = {
    port: false,
    path: false
  };
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === "--no-replace") {
      next.replaceExisting = false;
    } else if (arg === "--replace") {
      next.replaceExisting = true;
    } else if (arg === "--port") {
      next.port = Number(process.argv[index + 1]);
      explicit.port = true;
      index += 1;
    } else if (arg.startsWith("--port=")) {
      next.port = Number(arg.slice("--port=".length));
      explicit.port = true;
    } else if (arg === "--host") {
      next.host = process.argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--host=")) {
      next.host = arg.slice("--host=".length);
    } else if (arg === "--path") {
      next.defaultPath = process.argv[index + 1];
      explicit.path = true;
      index += 1;
    } else if (arg.startsWith("--path=")) {
      next.defaultPath = arg.slice("--path=".length);
      explicit.path = true;
    }
  }
  next.explicitArgs = explicit;
  return next;
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function currentBranch() {
  return gitOutput(["branch", "--show-current"]);
}

function agentNumberFor(rootName, branch) {
  const rootMatch = /^agent(\d+)$/i.exec(rootName);
  if (rootMatch) return Number(rootMatch[1]);
  const branchMatch = /^codex\/agent(\d+)$/i.exec(branch || "");
  if (branchMatch) return Number(branchMatch[1]);
  return null;
}

function branchPathPrefix(branch) {
  if (!branch) return "";
  const branchPath = branch.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return branchPath ? `/${branchPath}` : "";
}

function addBranchPathPrefix(defaultPath, branch) {
  const prefix = branchPathPrefix(branch);
  if (!prefix) return defaultPath;
  const url = new URL(defaultPath.startsWith("/") ? `http://local${defaultPath}` : `http://local/${defaultPath}`);
  if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) return `${url.pathname}${url.search}`;
  url.pathname = `${prefix}${url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`}`;
  return `${url.pathname}${url.search}`;
}

function normalizeConfig(config) {
  const branch = currentBranch();
  const rootName = path.basename(ROOT);
  const agentNumber = agentNumberFor(rootName, branch);
  const port = Number(agentNumber && !config.explicitArgs?.port ? 5180 + agentNumber : config.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid dev server port: ${config.port}`);
  }
  const host = String(config.host || DEFAULT_CONFIG.host);
  const defaultPath = addBranchPathPrefix(String(config.defaultPath || DEFAULT_CONFIG.defaultPath), branch);
  return {
    branch,
    branchPathPrefix: branchPathPrefix(branch),
    host,
    port,
    replaceExisting: config.replaceExisting !== false,
    defaultPath: defaultPath.startsWith("/") ? defaultPath : `/${defaultPath}`
  };
}

function stopExistingWindowsListeners(port) {
  const command = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$currentProcessId = ${process.pid}`,
    `$port = ${port}`,
    "$owners = Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique",
    "foreach ($owner in $owners) {",
    "  if ($owner -and $owner -ne $currentProcessId) {",
    "    Stop-Process -Id $owner -Force",
    "  }",
    "}"
  ].join("; ");
  spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    stdio: "inherit"
  });
}

function stopExistingUnixListeners(port) {
  const command = `command -v lsof >/dev/null 2>&1 && lsof -ti tcp:${port} -sTCP:LISTEN | xargs -r kill -9 || true`;
  spawnSync("sh", ["-lc", command], {
    stdio: "inherit"
  });
}

function stopExistingListeners(port) {
  if (process.platform === "win32") {
    stopExistingWindowsListeners(port);
  } else {
    stopExistingUnixListeners(port);
  }
}

function stripBranchPathPrefix(urlPath, config) {
  const prefix = config.branchPathPrefix;
  if (!prefix) return urlPath;
  if (urlPath === prefix) return "/";
  if (urlPath.startsWith(`${prefix}/`)) return urlPath.slice(prefix.length) || "/";
  return urlPath;
}

function filePathForRequest(urlPath, config) {
  const effectivePath = stripBranchPathPrefix(urlPath, config);
  const relativePath = decodeURIComponent(effectivePath).replace(/^\/+/, "");
  const targetPath = path.resolve(ROOT, relativePath);
  const relativeToRoot = path.relative(ROOT, targetPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return null;
  return targetPath;
}

function sendResponse(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(body);
}

function sendFile(request, response, filePath) {
  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      sendResponse(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const resolvedPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.stat(resolvedPath, (fileError, fileStats) => {
      if (fileError || !fileStats.isFile()) {
        sendResponse(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": fileStats.size,
        "Content-Type": MIME_TYPES[path.extname(resolvedPath).toLowerCase()] || "application/octet-stream"
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      fs.createReadStream(resolvedPath).pipe(response);
    });
  });
}

function createServer(config) {
  return http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendResponse(response, 405, "Method not allowed", {
        "Allow": "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8"
      });
      return;
    }

    const parsedUrl = new URL(request.url, "http://localhost");
    if (parsedUrl.pathname === "/" || parsedUrl.pathname === config.branchPathPrefix) {
      response.writeHead(302, {
        "Cache-Control": "no-store",
        "Location": config.defaultPath
      });
      response.end();
      return;
    }

    const filePath = filePathForRequest(parsedUrl.pathname, config);
    if (!filePath) {
      sendResponse(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    sendFile(request, response, filePath);
  });
}

const config = normalizeConfig(applyArgs(readConfig()));
if (config.replaceExisting) stopExistingListeners(config.port);

const server = createServer(config);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use and could not be replaced.`);
    process.exit(1);
  }
  throw error;
});

server.listen(config.port, config.host, () => {
  const baseUrl = `http://${config.host}:${config.port}`;
  console.log("Bobercad viewer dev server");
  console.log(`Serving: ${ROOT}`);
  console.log(`Branch: ${config.branch || "unknown"}`);
  console.log(`URL: ${baseUrl}${config.defaultPath}`);
  console.log(`Port policy: ${config.replaceExisting ? "replace existing listener" : "do not replace existing listener"}`);
});
