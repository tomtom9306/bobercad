#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConnectionDefinitions } from "../../bobercad/app/engine/modules/connections/connection-registry.mjs";
import { createProjectStore } from "../../bobercad/app/engine/store/project-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_PROJECT = path.join(ROOT, "bobercad", "data", "projects", "sample_warehouse_12x24.json");
const OUTPUT_DIR = path.join(ROOT, "stress-output");
const OUTPUT = path.join(OUTPUT_DIR, "stress-100-warehouse-halls.json");
const PROFILES_PATH = path.join(ROOT, "bobercad", "data", "libraries", "profiles", "profile-libraries", "starter-profiles", "config.json");
const FASTENERS_PATH = path.join(ROOT, "bobercad", "data", "libraries", "fasteners", "fastener-libraries", "starter-fasteners", "config.json");

const HALL_COUNT = 100;
const GRID_COLUMNS = 10;
const CELL_X = 22_000;
const CELL_Y = 34_000;
const POINT_KEYS = new Set(["start", "end", "center", "origin"]);
const DIRECTION_KEYS = new Set(["localAxisY", "localAxisZ", "axisX", "axisY"]);
const NORMAL_KEYS = new Set(["normal", "axis"]);
const COLLECTION_ID_PREFIX = {
  workPoints: "wp",
  referencePlanes: "rp",
  groups: "gr",
  interfaces: "if",
  connectionZones: "cz",
  assemblies: "as",
  members: "m",
  plates: "pl",
  holePatterns: "hp",
  objectPatterns: "op",
  features: "ft",
  fastenerGroups: "fg",
  welds: "w",
  connections: "co"
};

function rel(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replaceAll(path.sep, "/");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function round(value) {
  return Number(value.toFixed(6));
}

function roundVec(vector) {
  return vector.map(round);
}

function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector, fallback = [1, 0, 0]) {
  const vectorLength = length(vector);
  if (vectorLength <= 1e-9) return [...fallback];
  return vector.map((value) => value / vectorLength);
}

function modelCollections() {
  return {
    workPoints: {},
    referencePlanes: {},
    groups: {},
    interfaces: {},
    connectionZones: {},
    assemblies: {},
    members: {},
    plates: {},
    holePatterns: {},
    objectPatterns: {},
    features: {},
    fastenerGroups: {},
    welds: {},
    connections: {},
    addonData: {}
  };
}

function patchLibraryPaths(project) {
  const outputDir = path.dirname(OUTPUT);
  project.$schema = rel(outputDir, path.join(ROOT, "bobercad", "app", "schemas", "project.schema.json"));
  project.libraries = clone(project.libraries || {});
  project.libraries.profiles.path = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "profiles", "profile-libraries", "starter-profiles", "config.json"));
  project.libraries.materials.path = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "materials", "material-libraries", "starter-materials", "config.json"));
  project.libraries.fasteners.path = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "fasteners", "fastener-libraries", "starter-fasteners", "config.json"));
  project.libraries.connections.path = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "connections", "connection-register.json"));
  project.libraries.frames.path = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "model-library", "model-register.json"));
}

function hallPrefix(index) {
  return `h${String(index + 1).padStart(3, "0")}_`;
}

function hallSpec(index) {
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  return {
    index,
    prefix: hallPrefix(index),
    offset: [column * CELL_X, row * CELL_Y, 0],
    scale: [
      0.9 + ((index * 17) % 23) * 0.011,
      0.92 + ((index * 19) % 21) * 0.01,
      0.9 + ((index * 13) % 19) * 0.012
    ]
  };
}

function transformPoint(point, spec) {
  return roundVec([
    point[0] * spec.scale[0] + spec.offset[0],
    point[1] * spec.scale[1] + spec.offset[1],
    point[2] * spec.scale[2] + spec.offset[2]
  ]);
}

function transformDirection(vector, spec) {
  return roundVec(normalize([
    vector[0] * spec.scale[0],
    vector[1] * spec.scale[1],
    vector[2] * spec.scale[2]
  ]));
}

function transformNormal(vector, spec) {
  return roundVec(normalize([
    vector[0] / spec.scale[0],
    vector[1] / spec.scale[1],
    vector[2] / spec.scale[2]
  ]));
}

function collectObjectIds(project) {
  return new Set([
    ...Object.keys(project.objectIndex || {}),
    ...Object.values(project.model || {})
      .filter((collection) => collection && typeof collection === "object" && !Array.isArray(collection))
      .flatMap((collection) => Object.keys(collection))
  ]);
}

function createIdMap(project, ids, prefix) {
  const map = new Map();
  const idsByCollection = new Map();
  for (const id of ids) {
    const collection = project.objectIndex?.[id]?.collection || Object.entries(project.model || {})
      .find(([, objects]) => objects && typeof objects === "object" && !Array.isArray(objects) && objects[id])?.[0] || "object";
    const list = idsByCollection.get(collection) || [];
    list.push(id);
    idsByCollection.set(collection, list);
  }

  for (const [collection, collectionIds] of idsByCollection) {
    const shortPrefix = COLLECTION_ID_PREFIX[collection] || "o";
    const width = Math.max(3, String(collectionIds.length).length);
    for (const [index, id] of collectionIds.sort().entries()) {
      map.set(id, `${prefix}${shortPrefix}${String(index + 1).padStart(width, "0")}`);
    }
  }
  return map;
}

function rewriteIds(value, idMap) {
  if (typeof value === "string") return idMap.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => rewriteIds(item, idMap));
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) next[key] = rewriteIds(child, idMap);
  return next;
}

function transformGeometry(value, key, spec) {
  if (Array.isArray(value)) {
    if (value.length === 3 && value.every((item) => typeof item === "number" && Number.isFinite(item))) {
      if (POINT_KEYS.has(key)) return transformPoint(value, spec);
      if (DIRECTION_KEYS.has(key)) return transformDirection(value, spec);
      if (NORMAL_KEYS.has(key)) return transformNormal(value, spec);
    }
    return value.map((item) => transformGeometry(item, "", spec));
  }
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [childKey, child] of Object.entries(value)) {
    next[childKey] = transformGeometry(child, childKey, spec);
  }
  return next;
}

function updateTracking(value) {
  if (Array.isArray(value)) return value.map(updateTracking);
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "projectTreeNodeId") next[key] = "zone_stress_warehouse_halls";
    else if (key === "phase") next[key] = "phase_stress";
    else if (key === "lot") next[key] = "lot_stress";
    else next[key] = updateTracking(child);
  }
  return next;
}

function duplicateCollection(baseCollection, targetCollection, idMap, spec) {
  for (const [id, object] of Object.entries(baseCollection || {})) {
    const rewritten = rewriteIds(object, idMap);
    const transformed = transformGeometry(rewritten, "", spec);
    const tracked = updateTracking(transformed);
    if (tracked.bim?.name) tracked.bim.name = `Hall ${spec.index + 1} ${tracked.bim.name}`;
    targetCollection[idMap.get(id)] = tracked;
  }
}

function addHall(project, baseProject, baseIds, spec) {
  const idMap = createIdMap(baseProject, baseIds, spec.prefix);
  for (const [id, entry] of Object.entries(baseProject.objectIndex || {})) {
    project.objectIndex[idMap.get(id)] = { ...entry };
  }
  for (const collectionName of Object.keys(project.model)) {
    if (collectionName === "addonData") continue;
    duplicateCollection(baseProject.model?.[collectionName], project.model[collectionName], idMap, spec);
  }
  return {
    id: `stress_hall_${String(spec.index + 1).padStart(3, "0")}`,
    prefix: spec.prefix,
    offset: spec.offset,
    scale: spec.scale,
    memberCount: Object.keys(baseProject.model.members || {}).length,
    connectionCount: Object.keys(baseProject.model.connections || {}).length
  };
}

function stressModelDefaults(baseProject) {
  const defaults = clone(baseProject.modelDefaults || {});
  const memberDefaults = defaults.collections?.members?.["*"];
  if (memberDefaults) {
    delete memberDefaults.assemblyId;
    memberDefaults.tracking = {
      projectTreeNodeId: "zone_stress_warehouse_halls",
      phase: "phase_stress",
      lot: "lot_stress",
      status: "generated"
    };
  }
  const connectionDefaults = defaults.collections?.connections?.["*"];
  if (connectionDefaults) {
    connectionDefaults.tracking = {
      projectTreeNodeId: "zone_stress_warehouse_halls",
      phase: "phase_stress",
      lot: "lot_stress",
      status: "generated"
    };
  }
  return defaults;
}

async function main() {
  const [baseProject, profiles, fasteners, connectionCatalog] = await Promise.all([
    readJson(SOURCE_PROJECT),
    readJson(PROFILES_PATH),
    readJson(FASTENERS_PATH),
    loadConnectionDefinitions()
  ]);
  const project = {
    ...clone(baseProject),
    project: {
      id: "project_stress_100_warehouse_halls",
      name: "Stress Test 100 Warehouse Halls",
      description: "100 duplicated 12 x 24 m warehouse halls with deterministic width, length, and height variations for renderer stress testing.",
      createdWith: "tools/stress/generate_warehouse_hall_stress.mjs",
      bim: {
        name: "Stress Test 100 Warehouse Halls",
        propertySets: {
          StressTest: {
            source: "sample_warehouse_12x24",
            hallCount: HALL_COUNT,
            gridColumns: GRID_COLUMNS,
            cellSizeMm: [CELL_X, CELL_Y]
          }
        }
      }
    },
    projectTree: {
      rootNodeId: "site_stress_warehouse_halls",
      nodes: {
        site_stress_warehouse_halls: {
          id: "site_stress_warehouse_halls",
          type: "site",
          name: "Stress Warehouse Site",
          children: ["zone_stress_warehouse_halls"]
        },
        zone_stress_warehouse_halls: {
          id: "zone_stress_warehouse_halls",
          type: "zone",
          name: "100 Warehouse Halls",
          children: []
        }
      }
    },
    gridSystems: {},
    levels: {},
    phases: { phase_stress: { id: "phase_stress", name: "Stress Test" } },
    lots: { lot_stress: { id: "lot_stress", name: "Stress Lot" } },
    objectIndex: {},
    modelDefaults: stressModelDefaults(baseProject),
    model: modelCollections(),
    migrationHistory: [{
      id: "mig_stress_100_warehouse_halls_1",
      description: "Generated 100 deterministic transformed copies of the warehouse hall for renderer stress testing.",
      schemaVersion: baseProject.schemaVersion
    }]
  };
  patchLibraryPaths(project);

  const baseIds = collectObjectIds(baseProject);
  const halls = [];
  for (let index = 0; index < HALL_COUNT; index += 1) {
    halls.push(addHall(project, baseProject, baseIds, hallSpec(index)));
  }
  project.model.addonData.stressTest = {
    generatedAt: new Date().toISOString(),
    sourceProject: rel(path.dirname(OUTPUT), SOURCE_PROJECT),
    hallCount: HALL_COUNT,
    halls
  };
  const store = createProjectStore({
    project,
    profiles: profiles.profiles,
    connectionCatalog,
    fasteners,
    cloneOnLoad: false,
    reconcileOnLoad: true
  });
  const reconciled = store.project();
  reconciled.model.addonData.stressTest = project.model.addonData.stressTest;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT, `${JSON.stringify(reconciled)}\n`);

  const counts = {};
  for (const [collection, objects] of Object.entries(reconciled.model)) {
    if (objects && typeof objects === "object" && !Array.isArray(objects)) counts[collection] = Object.keys(objects).length;
  }
  const stat = await fs.stat(OUTPUT);
  console.log(`Wrote ${rel(ROOT, OUTPUT)}`);
  console.log(`Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Members: ${counts.members}`);
  console.log(`Connections: ${counts.connections}`);
  console.log(`Plates: ${counts.plates}`);
  console.log(`Fastener groups: ${counts.fastenerGroups}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
