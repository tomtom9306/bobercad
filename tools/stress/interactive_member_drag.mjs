#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const DEFAULT_URL = "http://127.0.0.1:8000/bobercad/app/ui/viewer/index.html?demo=stress-100-warehouse-halls&verify=interactive-drag";
const DEFAULT_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PLAYWRIGHT_CORE = path.join(os.tmpdir(), "bober-playwright-core", "node_modules", "playwright-core");

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    executablePath: DEFAULT_CHROME,
    headless: false,
    dx: 90,
    dy: 28
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") args.url = argv[++index];
    else if (arg === "--chrome") args.executablePath = argv[++index];
    else if (arg === "--headless") args.headless = true;
    else if (arg === "--dx") args.dx = Number(argv[++index]) || args.dx;
    else if (arg === "--dy") args.dy = Number(argv[++index]) || args.dy;
    else if (arg === "--help") {
      console.log("Usage: node tools/stress/interactive_member_drag.mjs [--url url] [--chrome path] [--headless] [--dx px] [--dy px]");
      process.exit(0);
    }
  }
  return args;
}

function round(value) {
  return Number(value.toFixed(2));
}

function eventDelta(events, startName, endName) {
  const start = events.find((event) => event.name === startName);
  const end = events.find((event) => event.name === endName);
  return start && end ? round(end.time - start.time) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let chromium;
  try {
    ({ chromium } = require(PLAYWRIGHT_CORE));
  } catch (error) {
    throw new Error(`playwright-core not found. Install it outside the repo with: npm.cmd --prefix "${path.dirname(path.dirname(PLAYWRIGHT_CORE))}" install playwright-core --no-audit --no-fund`);
  }
  const browser = await chromium.launch({
    executablePath: args.executablePath,
    headless: args.headless,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.goto(args.url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForFunction(() => window.__boberCadQa?.ready === true, null, { timeout: 60_000 });
    await page.evaluate(() => { window.__boberCadPerf = { events: [] }; });
    await page.waitForTimeout(800);

    let target = await page.evaluate(() => window.__boberCadQa.memberInteractionTarget());
    for (let attempt = 0; attempt < 36 && (target.radiusPx < 3 || target.lengthPx < 80); attempt += 1) {
      await page.mouse.move(target.select.x, target.select.y);
      await page.mouse.wheel(0, -900);
      await page.waitForTimeout(80);
      target = await page.evaluate(() => window.__boberCadQa.memberInteractionTarget());
    }
    if (target.radiusPx < 2) throw new Error(`member target is still too small to pick reliably: ${JSON.stringify(target)}`);

    await page.mouse.click(target.select.x, target.select.y);
    await page.waitForFunction((memberId) => document.body.innerText.includes(`Selected ${memberId}.`), target.memberId, { timeout: 10_000 });

    target = await page.evaluate((memberId) => window.__boberCadQa.memberInteractionTarget({ memberId }), target.memberId);
    const before = await page.evaluate((memberId) => window.__boberCadQa.memberState(memberId), target.memberId);
    const connectionBefore = await page.evaluate((memberId) => window.__boberCadQa.memberConnectionPoints(memberId), target.memberId);
    const start = target.handles.move;
    const end = { x: start.x + args.dx, y: start.y + args.dy };

    const wallStart = performance.now();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.waitForFunction(() => window.__boberCadPerf?.events?.some((event) => event.name === "member-drag-live-preview-updated"), null, { timeout: 10_000 });
    const live = await page.evaluate((memberId) => ({
      events: window.__boberCadPerf.events,
      connection: window.__boberCadQa.memberConnectionPoints(memberId)
    }), target.memberId);
    await page.mouse.up();
    await page.waitForFunction(() => window.__boberCadPerf?.events?.some((event) => event.name === "member-drag-local-patch-finished"), null, { timeout: 10_000 });
    const wallToPatch = performance.now() - wallStart;

    const immediate = await page.evaluate((memberId) => ({
      events: window.__boberCadPerf.events,
      state: window.__boberCadQa.memberState(memberId),
      connection: window.__boberCadQa.memberConnectionPoints(memberId),
      body: document.body.innerText.slice(0, 500)
    }), target.memberId);
    const final = immediate;

    const changed = JSON.stringify(before.start) !== JSON.stringify(immediate.state.start)
      || JSON.stringify(before.end) !== JSON.stringify(immediate.state.end);
    if (!changed) throw new Error(`${target.memberId}: member state did not change after drag`);
    const vectorDelta = (left, right) => Array.isArray(left) && Array.isArray(right)
      ? left.map((value, index) => right[index] - value)
      : null;
    const memberDelta = vectorDelta(before.start, immediate.state.start);
    const liveConnectionDelta = vectorDelta(connectionBefore.center, live.connection.center);
    const connectionDelta = vectorDelta(connectionBefore.center, immediate.connection.center);
    const finalConnectionDelta = vectorDelta(connectionBefore.center, final.connection.center);
    const refreshSnap = vectorDelta(immediate.connection.center, final.connection.center);
    const liveDistance = liveConnectionDelta ? Math.hypot(...liveConnectionDelta) : 0;
    if (connectionBefore.objectIds.length && liveDistance < 1) {
      throw new Error(`${target.memberId}: connected geometry did not move in the live drag preview`);
    }

    console.log(JSON.stringify({
      ok: true,
      url: args.url,
      memberId: target.memberId,
      target: {
        radiusPx: round(target.radiusPx),
        lengthPx: round(target.lengthPx),
        dragFrom: { x: round(start.x), y: round(start.y) },
        dragTo: { x: round(end.x), y: round(end.y) }
      },
      timingsMs: {
        wallToPatch: round(wallToPatch),
        dragBeginToLivePreview: eventDelta(live.events, "member-drag-begin", "member-drag-live-preview-updated"),
        commitToStore: eventDelta(immediate.events, "member-drag-commit-start", "member-drag-store-updated"),
        commitToLocalPatch: eventDelta(immediate.events, "member-drag-commit-start", "member-drag-local-patch-finished")
      },
      connectionPreview: {
        objectCount: connectionBefore.objectIds.length,
        pointCountBefore: connectionBefore.pointCount,
        pointCountDuringDrag: live.connection.pointCount,
        pointCountAfter: immediate.connection.pointCount,
        pointCountAfterRefresh: final.connection.pointCount,
        memberDelta,
        liveConnectionDelta,
        connectionDelta,
        finalConnectionDelta,
        liveDeltaDistance: round(liveDistance),
        deltaError: memberDelta && connectionDelta ? round(Math.hypot(...memberDelta.map((value, index) => value - connectionDelta[index]))) : null,
        finalDeltaError: memberDelta && finalConnectionDelta ? round(Math.hypot(...memberDelta.map((value, index) => value - finalConnectionDelta[index]))) : null,
        refreshSnapDistance: refreshSnap ? round(Math.hypot(...refreshSnap)) : null
      },
      events: final.events.map((event) => ({
        name: event.name,
        time: round(event.time),
        memberId: event.memberId,
        livePreview: event.livePreview,
        previewObjectCount: event.previewObjectCount,
        affectedObjectCount: event.affectedObjectCount
      }))
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
