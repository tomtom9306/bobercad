#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT_DIR = path.resolve(process.argv[2] || path.join(ROOT, "stress-output"));
const MAX_DISTANCE_MM = 50_000;
const MIN_LENGTH_MM = 1_000;
const MAX_LENGTH_MM = 10_000;
const DATASETS = [
  { label: "1k", count: 1_000, seed: 0x51a1 },
  { label: "10k", count: 10_000, seed: 0x51a10 },
  { label: "100k", count: 100_000, seed: 0x51a100 }
];

function rel(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replaceAll(path.sep, "/");
}

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function write(stream, chunk) {
  if (stream.write(chunk)) return Promise.resolve();
  return new Promise((resolve) => stream.once("drain", resolve));
}

function randomUnitVector(rng) {
  const z = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(theta) * r, Math.sin(theta) * r, z];
}

function randomPointInSphere(rng, radius) {
  const direction = randomUnitVector(rng);
  const distance = radius * Math.cbrt(rng());
  return direction.map((value) => value * distance);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

function len(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function round(value) {
  return Number(value.toFixed(6));
}

function roundVec(vector) {
  return vector.map(round);
}

function memberId(index, count) {
  return `stress_beam_${String(index + 1).padStart(String(count).length, "0")}`;
}

function memberLength(index, count, rng) {
  const span = MAX_LENGTH_MM - MIN_LENGTH_MM;
  return MIN_LENGTH_MM + (index + rng() * 0.5) * (span / count);
}

function makeMember(index, count, rng) {
  const id = memberId(index, count);
  const lengthMm = memberLength(index, count, rng);
  const direction = randomUnitVector(rng);
  const centerRadius = MAX_DISTANCE_MM - lengthMm / 2 - 10;
  const center = randomPointInSphere(rng, centerRadius);
  const half = mul(direction, lengthMm / 2);
  const start = roundVec(sub(center, half));
  const end = roundVec(add(center, half));
  return {
    id,
    type: "stress-beam",
    start,
    end,
    authoring: {
      source: "tools/stress/generate_stress_projects.mjs",
      lengthMm: round(lengthMm)
    }
  };
}

function projectPrefix(outputDir, label, count) {
  const schemaPath = rel(outputDir, path.join(ROOT, "bobercad", "app", "schemas", "project.schema.json"));
  const profilesPath = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "profiles", "profile-libraries", "starter-profiles", "config.json"));
  const materialsPath = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "materials", "material-libraries", "starter-materials", "config.json"));
  const fastenersPath = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "fasteners", "fastener-libraries", "starter-fasteners", "config.json"));
  const connectionsPath = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "connections", "connection-register.json"));
  const framesPath = rel(outputDir, path.join(ROOT, "bobercad", "data", "libraries", "model-library", "model-register.json"));

  return {
    "$schema": schemaPath,
    schema: "steel-bim-project",
    schemaVersion: "0.5.0",
    project: {
      id: `project_stress_${label}_beams`,
      name: `Stress Test ${label.toUpperCase()} Beams`,
      description: `${count} random unique beams inside a 50 m radius from the origin. Each beam has a unique length.`,
      createdWith: "tools/stress/generate_stress_projects.mjs",
      bim: {
        name: `Stress Test ${label.toUpperCase()} Beams`,
        propertySets: {
          StressTest: {
            count,
            maxDistanceMm: MAX_DISTANCE_MM,
            lengthRangeMm: [MIN_LENGTH_MM, MAX_LENGTH_MM]
          }
        }
      }
    },
    settings: {
      units: { length: "mm", angle: "deg", mass: "kg" },
      coordinateSystem: {
        id: "global",
        type: "cartesian-3d",
        origin: [0, 0, 0],
        axisX: [1, 0, 0],
        axisY: [0, 1, 0],
        axisZ: [0, 0, 1]
      },
      modelingConvention: {
        memberLocalX: "start-to-end",
        memberLocalY: "profile-section-y-width-axis",
        memberLocalZ: "profile-section-z-depth-axis",
        memberRotation: "degrees-about-member-local-x",
        cardinalPoint: "profile-reference-point-name",
        objectIndex: "stored-and-authoritative"
      },
      tolerances: { coincident: 1, snap: 1, connectionGap: 2 }
    },
    libraries: {
      profiles: { libraryId: "starter-profile-library", version: "0.2.0", path: profilesPath },
      materials: { libraryId: "starter-material-library", version: "0.1.0", path: materialsPath },
      fasteners: { libraryId: "starter-fastener-library", version: "0.1.0", path: fastenersPath },
      connections: { libraryId: "starter-connection-library", version: "0.1.0", path: connectionsPath },
      frames: { libraryId: "starter-frame-library", version: "0.1.0", path: framesPath }
    },
    projectTree: {
      rootNodeId: "site_stress",
      nodes: {
        site_stress: { id: "site_stress", type: "site", name: "Stress Site", children: ["zone_stress"] },
        zone_stress: { id: "zone_stress", type: "zone", name: "Stress Zone", children: [] }
      }
    },
    gridSystems: {},
    levels: {},
    phases: { phase_stress: { id: "phase_stress", name: "Stress Test" } },
    lots: { lot_stress: { id: "lot_stress", name: "Stress Lot" } }
  };
}

function modelDefaults() {
  return {
    resolutionOrder: ["collectionDefault", "typeDefault", "object"],
    collections: {
      members: {
        "*": {
          material: "S355",
          rotation: 0,
          cardinalPoint: "middle-center",
          featureIds: [],
          display: { visible: true, color: "#5f7f92" },
          fabrication: { numberingStatus: "stress-test", nc1Ready: false },
          tracking: { projectTreeNodeId: "zone_stress", phase: "phase_stress", lot: "lot_stress", status: "generated" }
        },
        "stress-beam": {
          profile: "DEMO_I_200X100X8X12",
          bim: { ifcClass: "IfcBeam", propertySets: { Identity: { objectType: "Stress test beam" } } }
        }
      }
    }
  };
}

async function generateDataset(dataset) {
  const { label, count, seed } = dataset;
  const filePath = path.join(OUTPUT_DIR, `stress-${label}-beams.json`);
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const prefix = projectPrefix(OUTPUT_DIR, label, count);
  const rng = mulberry32(seed);
  const lengths = new Set();
  let maxEndpointDistance = 0;
  let minLength = Infinity;
  let maxLength = -Infinity;

  await write(stream, "{\n");
  const prefixEntries = Object.entries(prefix);
  for (const [index, [key, value]] of prefixEntries.entries()) {
    await write(stream, `  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")},\n`);
  }

  await write(stream, '  "objectIndex": {\n');
  for (let index = 0; index < count; index += 1) {
    const comma = index === count - 1 ? "" : ",";
    await write(stream, `    ${JSON.stringify(memberId(index, count))}: {"collection":"members","type":"stress-beam"}${comma}\n`);
  }
  await write(stream, "  },\n");
  await write(stream, `  "modelDefaults": ${JSON.stringify(modelDefaults(), null, 2).replace(/\n/g, "\n  ")},\n`);
  await write(stream, '  "model": {\n');
  await write(stream, '    "workPoints": {},\n    "referencePlanes": {},\n    "groups": {},\n    "interfaces": {},\n    "connectionZones": {},\n    "assemblies": {},\n    "members": {\n');

  for (let index = 0; index < count; index += 1) {
    const member = makeMember(index, count, rng);
    const actualLength = len(sub(member.end, member.start));
    const lengthKey = actualLength.toFixed(3);
    if (lengths.has(lengthKey)) throw new Error(`${label}: duplicate rounded length ${lengthKey}`);
    lengths.add(lengthKey);
    minLength = Math.min(minLength, actualLength);
    maxLength = Math.max(maxLength, actualLength);
    maxEndpointDistance = Math.max(maxEndpointDistance, len(member.start), len(member.end));
    if (maxEndpointDistance > MAX_DISTANCE_MM) throw new Error(`${label}: endpoint outside 50 m radius`);

    const comma = index === count - 1 ? "" : ",";
    await write(stream, `      ${JSON.stringify(member.id)}: ${JSON.stringify(member)}${comma}\n`);
  }

  await write(stream, '    },\n    "plates": {},\n    "holePatterns": {},\n    "objectPatterns": {},\n    "features": {},\n    "fastenerGroups": {},\n    "welds": {},\n    "connections": {},\n    "addonData": {\n');
  await write(stream, `      "stressTest": ${JSON.stringify({
    generatedAt: new Date().toISOString(),
    count,
    seed,
    maxDistanceMm: MAX_DISTANCE_MM,
    minLengthMm: round(minLength),
    maxLengthMm: round(maxLength),
    uniqueRoundedLengths: lengths.size,
    maxEndpointDistanceMm: round(maxEndpointDistance)
  }, null, 2).replace(/\n/g, "\n      ")}\n`);
  await write(stream, "    }\n  }\n}\n");
  await new Promise((resolve, reject) => stream.end((error) => error ? reject(error) : resolve()));
  const stat = await fs.stat(filePath);
  return { filePath, count, bytes: stat.size, minLength, maxLength, maxEndpointDistance };
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const results = [];
for (const dataset of DATASETS) results.push(await generateDataset(dataset));

for (const result of results) {
  console.log([
    path.relative(ROOT, result.filePath),
    `${result.count} beams`,
    `${(result.bytes / 1024 / 1024).toFixed(2)} MB`,
    `length ${round(result.minLength)}-${round(result.maxLength)} mm`,
    `max endpoint radius ${round(result.maxEndpointDistance)} mm`
  ].join(" | "));
}
