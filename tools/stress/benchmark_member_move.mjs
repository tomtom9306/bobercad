#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { buildScene } from "../../bobercad/app/rendering/scene/build-scene.mjs";
import { loadConnectionDefinitions } from "../../bobercad/app/engine/modules/connections/connection-registry.mjs";
import { createProjectStore } from "../../bobercad/app/engine/store/project-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_PROJECT = path.join(ROOT, "stress-output", "stress-100-warehouse-halls.json");
const SETTINGS_PATH = path.join(ROOT, "bobercad", "app", "ui", "viewer", "viewer-settings.json");

function parseArgs(argv) {
  const args = {
    project: DEFAULT_PROJECT,
    moves: 8,
    regenerate: true,
    scene: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") args.project = path.resolve(argv[++index]);
    else if (arg === "--moves") args.moves = Math.max(1, Number.parseInt(argv[++index], 10) || args.moves);
    else if (arg === "--no-regenerate") args.regenerate = false;
    else if (arg === "--no-scene") args.scene = false;
    else if (arg === "--help") {
      console.log("Usage: node tools/stress/benchmark_member_move.mjs [--project file] [--moves n] [--no-regenerate] [--no-scene]");
      process.exit(0);
    }
  }
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function time(label, fn) {
  const start = performance.now();
  const result = fn();
  return { label, ms: performance.now() - start, result };
}

async function timeAsync(label, fn) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: performance.now() - start, result };
}

function roundMs(value) {
  return Number(value.toFixed(2));
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function samePoint(a, b, tolerance = 1e-6) {
  return Array.isArray(a)
    && Array.isArray(b)
    && a.length === 3
    && b.length === 3
    && a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countProject(project) {
  const model = project.model || {};
  return {
    members: Object.keys(model.members || {}).length,
    plates: Object.keys(model.plates || {}).length,
    fastenerGroups: Object.keys(model.fastenerGroups || {}).length,
    features: Object.keys(model.features || {}).length,
    connections: Object.keys(model.connections || {}).length
  };
}

function affectedConnectionCounts(project) {
  const counts = new Map();
  for (const connection of Object.values(project.model.connections || {})) {
    for (const memberId of [connection.mainMemberId, connection.secondaryMemberId]) {
      if (!memberId) continue;
      counts.set(memberId, (counts.get(memberId) || 0) + 1);
    }
  }
  return counts;
}

function memberLength(member) {
  const dx = member.end[0] - member.start[0];
  const dy = member.end[1] - member.start[1];
  const dz = member.end[2] - member.start[2];
  return Math.hypot(dx, dy, dz);
}

function pickMembers(project, count) {
  const affected = affectedConnectionCounts(project);
  return Object.values(project.model.members || {})
    .map((member) => ({
      id: member.id,
      length: memberLength(member),
      affectedConnections: affected.get(member.id) || 0
    }))
    .filter((entry) => entry.length > 1)
    .sort((left, right) => {
      if (right.affectedConnections !== left.affectedConnections) return right.affectedConnections - left.affectedConnections;
      return right.length - left.length;
    })
    .slice(0, count);
}

function deltaForMove(index) {
  return [
    125 + index * 7,
    index % 2 === 0 ? 35 : -45,
    index % 3 === 0 ? 20 : -15
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loadProject = await timeAsync("load project json", () => readJson(args.project));
  const project = loadProject.result;
  const projectDir = path.dirname(args.project);
  const [settings, profiles, fasteners, connectionCatalog] = await Promise.all([
    readJson(SETTINGS_PATH),
    readJson(path.resolve(projectDir, project.libraries.profiles.path)),
    readJson(path.resolve(projectDir, project.libraries.fasteners.path)),
    loadConnectionDefinitions()
  ]);

  const storeTime = time("create project store", () => createProjectStore({
    project,
    profiles: profiles.profiles,
    fasteners,
    connectionCatalog,
    cloneOnLoad: false,
    reconcileOnLoad: false
  }));
  const store = storeTime.result;
  const selected = pickMembers(store.project(), args.moves);
  assert(selected.length > 0, "no movable members found");

  const moveTimes = [];
  const regenTimes = [];
  for (const [index, entry] of selected.entries()) {
    const before = store.project().model.members[entry.id];
    const delta = deltaForMove(index);
    const expectedStart = add(before.start, delta);
    const expectedEnd = add(before.end, delta);
    const move = time(`move ${entry.id}`, () => store.moveMemberWithLayout(entry.id, delta, { regenerateConnections: false }));
    const afterMove = move.result.model.members[entry.id];
    assert(samePoint(afterMove.start, expectedStart), `${entry.id}: start did not move to expected point`);
    assert(samePoint(afterMove.end, expectedEnd), `${entry.id}: end did not move to expected point`);
    moveTimes.push({ id: entry.id, affectedConnections: entry.affectedConnections, ms: move.ms });

    if (args.regenerate && entry.affectedConnections > 0) {
      const regen = time(`regenerate ${entry.id}`, () => store.regenerateMemberConnections(entry.id));
      const afterRegen = regen.result.model.members[entry.id];
      assert(samePoint(afterRegen.start, expectedStart), `${entry.id}: start changed during connection regeneration`);
      assert(samePoint(afterRegen.end, expectedEnd), `${entry.id}: end changed during connection regeneration`);
      regenTimes.push({ id: entry.id, affectedConnections: entry.affectedConnections, ms: regen.ms });
    }
  }

  let sceneResult = null;
  if (args.scene) {
    const sceneBuild = time("build coarse scene", () => buildScene(store.project(), profiles, fasteners, settings, {
      lodDetailFilter: () => false
    }));
    const scene = sceneBuild.result;
    const moved = selected[0];
    const member = store.project().model.members[moved.id];
    const instance = scene.memberInstances.find((item) => item.objectId === moved.id);
    assert(instance, `${moved.id}: moved member is missing from memberInstances`);
    assert(samePoint(instance.start, member.start), `${moved.id}: render instance did not get moved start point`);
    sceneResult = {
      ms: sceneBuild.ms,
      faces: scene.faces.length,
      lines: scene.lines.length,
      memberInstances: scene.memberInstances.length,
      checkedMember: moved.id
    };
  }

  const counts = countProject(store.project());
  const maxMove = Math.max(...moveTimes.map((entry) => entry.ms));
  const maxRegen = regenTimes.length ? Math.max(...regenTimes.map((entry) => entry.ms)) : 0;
  console.log(JSON.stringify({
    ok: true,
    project: path.relative(ROOT, args.project).replaceAll(path.sep, "/"),
    counts,
    timingsMs: {
      loadProject: roundMs(loadProject.ms),
      createStore: roundMs(storeTime.ms),
      moveMax: roundMs(maxMove),
      moveAvg: roundMs(moveTimes.reduce((sum, entry) => sum + entry.ms, 0) / moveTimes.length),
      regenerateMax: roundMs(maxRegen),
      regenerateAvg: regenTimes.length ? roundMs(regenTimes.reduce((sum, entry) => sum + entry.ms, 0) / regenTimes.length) : 0,
      coarseScene: sceneResult ? roundMs(sceneResult.ms) : null
    },
    movedMembers: moveTimes.map((entry) => ({
      id: entry.id,
      affectedConnections: entry.affectedConnections,
      moveMs: roundMs(entry.ms),
      regenerateMs: roundMs(regenTimes.find((item) => item.id === entry.id)?.ms || 0)
    })),
    scene: sceneResult
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
