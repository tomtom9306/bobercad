#!/usr/bin/env node
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_VIEWER_URL = "http://127.0.0.1:8000/bobercad/app/ui/viewer/index.html";
const DEFAULT_VIEWS = ["front", "back", "left", "right", "top", "bottom", "front-iso", "back-iso", "iso"];

function usage() {
  return `Usage:
  node tools/qa/capture_connection_views.mjs [options]

Options:
  --demo <id>              Viewer demo id. Default: warehouse-12x24
  --viewer-url <url>       Viewer index URL. Default: ${DEFAULT_VIEWER_URL}
  --out <dir>              Output directory. Default: qa-output/connection-views/<demo>-<timestamp>
  --connection <id>        Capture one connection id. Can be repeated.
  --type <type>            Capture connections of one type.
  --all                    Capture every connection in the project.
  --limit <n>              Limit selected connections.
  --views <csv>            Views to capture. Default: ${DEFAULT_VIEWS.join(",")}
  --width <px>             Browser viewport width. Default: 1200
  --height <px>            Browser viewport height. Default: 900
  --member-context <mm>    Member length kept around the connection. Default: viewer QA default
  --no-highlight           Do not highlight generated objects for the active connection.
`;
}

function parseArgs(argv) {
  const args = {
    demo: "warehouse-12x24",
    viewerUrl: DEFAULT_VIEWER_URL,
    out: null,
    connections: [],
    type: null,
    all: false,
    limit: null,
    views: DEFAULT_VIEWS,
    width: 1200,
    height: 900,
    memberContext: null,
    highlight: true
  };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${item} requires a value`);
      return argv[i];
    };
    if (item === "--help" || item === "-h") {
      console.log(usage());
      process.exit(0);
    } else if (item === "--demo") args.demo = next();
    else if (item === "--viewer-url") args.viewerUrl = next();
    else if (item === "--out") args.out = next();
    else if (item === "--connection") args.connections.push(next());
    else if (item === "--type") args.type = next();
    else if (item === "--all") args.all = true;
    else if (item === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (item === "--views") args.views = next().split(",").map((value) => value.trim()).filter(Boolean);
    else if (item === "--width") args.width = Number.parseInt(next(), 10);
    else if (item === "--height") args.height = Number.parseInt(next(), 10);
    else if (item === "--member-context") args.memberContext = Number.parseFloat(next());
    else if (item === "--highlight") args.highlight = true;
    else if (item === "--no-highlight") args.highlight = false;
    else throw new Error(`unknown option: ${item}`);
  }
  if (!args.views.length) throw new Error("--views cannot be empty");
  if (!Number.isFinite(args.width) || args.width <= 0) throw new Error("--width must be a positive number");
  if (!Number.isFinite(args.height) || args.height <= 0) throw new Error("--height must be a positive number");
  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) throw new Error("--limit must be a positive number");
  if (args.memberContext !== null && (!Number.isFinite(args.memberContext) || args.memberContext <= 0)) throw new Error("--member-context must be a positive number");
  return args;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

function withViewerParams(viewerUrl, demo) {
  const url = new URL(viewerUrl);
  url.searchParams.set("demo", demo);
  url.searchParams.set("qaCapture", "1");
  url.searchParams.set("verify", Date.now().toString());
  return url.href;
}

function defaultOutDir(demo) {
  return path.join(ROOT, "qa-output", "connection-views", `${safeName(demo)}-${timestamp()}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFetch(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return response;
      lastError = new Error(`${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error(`timed out waiting for ${url}`);
}

async function commandExists(command, args = ["--version"]) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function ensureViewerServer(viewerUrl) {
  try {
    await waitForFetch(viewerUrl, 1500);
    return null;
  } catch {
    // Fall through and start a local static server for the default localhost workflow.
  }

  const url = new URL(viewerUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`viewer is not reachable and cannot be auto-started: ${viewerUrl}`);
  }
  const port = Number.parseInt(url.port || "80", 10);
  const candidates = [
    { command: "python", args: ["-m", "http.server", String(port), "--bind", "127.0.0.1"] },
    { command: "py", args: ["-3", "-m", "http.server", String(port), "--bind", "127.0.0.1"] }
  ];
  for (const candidate of candidates) {
    if (!(await commandExists(candidate.command, candidate.command === "py" ? ["-3", "--version"] : ["--version"]))) continue;
    const child = spawn(candidate.command, candidate.args, {
      cwd: ROOT,
      stdio: "ignore",
      windowsHide: true
    });
    await waitForFetch(viewerUrl, 10000);
    return child;
  }
  throw new Error("viewer is not reachable and Python was not found to start a local static server");
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function browserCandidates() {
  const env = [process.env.BOBERCAD_BROWSER, process.env.CHROME_PATH, process.env.EDGE_PATH].filter(Boolean);
  if (process.platform !== "win32") return [...env, "google-chrome", "chromium", "chromium-browser", "microsoft-edge"];
  return [
    ...env,
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe")
  ];
}

async function findBrowser() {
  for (const candidate of browserCandidates()) {
    if (candidate.includes(path.sep)) {
      if (existsSync(candidate)) return candidate;
    } else if (await commandExists(candidate, ["--version"])) {
      return candidate;
    }
  }
  throw new Error("Chrome/Edge executable not found. Set BOBERCAD_BROWSER to the browser path.");
}

async function launchBrowser({ width, height, outDir }) {
  const browserPath = await findBrowser();
  const port = await freePort();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "bobercad-qa-browser-"));
  await fs.mkdir(userDataDir, { recursive: true });
  const child = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--window-size=${width},${height}`,
    "about:blank"
  ], {
    cwd: ROOT,
    stdio: "ignore",
    windowsHide: true
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`browser exited with code ${code}`);
  });
  await waitForFetch(`http://127.0.0.1:${port}/json/version`, 10000);
  return { child, port, userDataDir };
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
  }

  async open() {
    this.ws = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.handleMessage(event.data));
  }

  handleMessage(data) {
    const message = JSON.parse(data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
      else resolve(message.result || {});
      return;
    }
    if (message.method) {
      for (const waiter of [...this.eventWaiters]) {
        if (waiter.method !== message.method) continue;
        clearTimeout(waiter.timer);
        this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
        waiter.resolve(message.params || {});
      }
    }
  }

  command(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        method,
        resolve,
        timer: setTimeout(() => {
          this.eventWaiters = this.eventWaiters.filter((item) => item !== waiter);
          reject(new Error(`timed out waiting for ${method}`));
        }, timeoutMs)
      };
      this.eventWaiters.push(waiter);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function createPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`failed to create browser target: ${response.status}`);
  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.command("Page.enable");
  await client.command("Runtime.enable");
  return client;
}

async function evaluate(client, expression, timeoutMs = 30000) {
  const result = await client.command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: timeoutMs
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluation failed";
    throw new Error(text);
  }
  return result.result?.value;
}

async function waitForQa(client) {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const ready = await evaluate(client, "Boolean(window.__boberCadQa?.ready)", 2000);
    if (ready) return;
    await sleep(250);
  }
  throw new Error("viewer QA API did not become ready");
}

function onePerType(connections) {
  const seen = new Set();
  const selected = [];
  for (const connection of connections) {
    if (seen.has(connection.type)) continue;
    seen.add(connection.type);
    selected.push(connection);
  }
  return selected;
}

function selectConnections(connections, args) {
  let selected;
  if (args.connections.length) {
    const byId = new Map(connections.map((connection) => [connection.id, connection]));
    selected = args.connections.map((id) => {
      const connection = byId.get(id);
      if (!connection) throw new Error(`connection not found in viewer: ${id}`);
      return connection;
    });
  } else if (args.all) {
    selected = connections;
  } else if (args.type) {
    selected = connections.filter((connection) => connection.type === args.type);
  } else {
    selected = onePerType(connections);
  }
  if (args.limit) selected = selected.slice(0, args.limit);
  if (!selected.length) throw new Error("no connections selected for capture");
  return selected;
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("viewer returned an invalid PNG data URL");
  return Buffer.from(match[1], "base64");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const viewerUrl = withViewerParams(args.viewerUrl, args.demo);
  const outDir = path.resolve(ROOT, args.out || defaultOutDir(args.demo));
  await fs.mkdir(outDir, { recursive: true });

  const server = await ensureViewerServer(viewerUrl);
  const browser = await launchBrowser({ width: args.width, height: args.height, outDir });
  const client = await createPage(browser.port);
  const manifest = {
    createdAt: new Date().toISOString(),
    demo: args.demo,
    viewerUrl,
    views: args.views,
    viewport: { width: args.width, height: args.height },
    captures: []
  };

  try {
    await client.command("Emulation.setDeviceMetricsOverride", {
      width: args.width,
      height: args.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    const load = client.waitEvent("Page.loadEventFired", 30000).catch(() => null);
    await client.command("Page.navigate", { url: viewerUrl });
    await load;
    await waitForQa(client);

    const summaries = await evaluate(client, "window.__boberCadQa.connectionSummaries()", 10000);
    const targets = selectConnections(summaries, args);
    console.log(`Capturing ${targets.length} connection(s), ${args.views.length} view(s) each.`);

    for (let index = 0; index < targets.length; index += 1) {
      const connection = targets[index];
      const connectionDir = path.join(outDir, `${String(index + 1).padStart(3, "0")}_${safeName(connection.type)}_${safeName(connection.id).slice(0, 80)}`);
      await fs.mkdir(connectionDir, { recursive: true });
      for (const view of args.views) {
        const capture = await evaluate(
          client,
          `window.__boberCadQa.captureConnectionView(${JSON.stringify({
            connectionId: connection.id,
            view,
            highlight: args.highlight,
            memberContext: args.memberContext ?? undefined
          })})`,
          60000
        );
        const fileName = `${safeName(view)}.png`;
        const filePath = path.join(connectionDir, fileName);
        await fs.writeFile(filePath, dataUrlToBuffer(capture.dataUrl));
        const relativePath = path.relative(outDir, filePath).replaceAll(path.sep, "/");
        manifest.captures.push({
          connectionId: connection.id,
          connectionType: connection.type,
          view,
          file: relativePath,
          focus: capture.focus,
          camera: capture.camera
        });
        console.log(`${relativePath}`);
      }
    }
    await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${manifest.captures.length} screenshots to ${outDir}`);
  } finally {
    client.close();
    browser.child.kill();
    await fs.rm(browser.userDataDir, { recursive: true, force: true }).catch(() => {});
    server?.kill();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
