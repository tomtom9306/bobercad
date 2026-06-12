import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadSmartComponentDefinitions, smartComponentDefinition } from "../bobercad/app/engine/modules/smart-components/smart-component-registry.mjs";
import { createProjectSmartComponentFromPreset, updateSmartComponent } from "../bobercad/app/engine/modules/smart-components/smart-component-generator.mjs";

const OUT_FILE = new URL("../bobercad/data/projects/sample_stair_tread_variants.json", import.meta.url);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor[key] ||= {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = clone(value);
}

function optionalPath(target, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], target);
}

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = merge(target[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? target[key] : {}, value);
    } else {
      target[key] = clone(value);
    }
  }
  return target;
}

function emptyProject(base) {
  const project = clone(base);
  project.project.id = "project_stair_tread_variants";
  project.project.name = "Stair Tread Variants";
  project.project.description = "Isolated tread-only sample for detailed tread component development.";
  project.project.createdWith = "tread-detail-sample-generator-0.1.0";
  project.objectIndex = {};
  for (const collection of [
    "groups",
    "interfaces",
    "connectionZones",
    "assemblies",
    "workPoints",
    "referencePlanes",
    "relations",
    "members",
    "plates",
    "holePatterns",
    "objectPatterns",
    "features",
    "trimJoints",
    "fastenerGroups",
    "welds",
    "smartComponentInstances"
  ]) {
    project.model[collection] = {};
  }
  project.model.addonData ||= {};
  project.model.addonData.stairTreadVariantGallery = {
    type: "stair-tread-variant-gallery",
    purpose: "isolated tread family detail review"
  };
  return project;
}

function defaultParameters(definition, preset) {
  const parameters = clone(preset.parameters || {});
  for (const [path, spec] of Object.entries(definition.parameters || {})) {
    if (spec.default !== undefined && optionalPath(parameters, path) === undefined) setPath(parameters, path, spec.default);
  }
  return parameters;
}

function treadFrames(origin, id, count = 3) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${id}_tread_${index + 1}`,
    index,
    station: index * 430,
    flightId: `${id}_detail_row`,
    origin: [origin[0] + index * 430, origin[1], origin[2]],
    tangent: [1, 0, 0],
    lateral: [0, 1, 0],
    up: [0, 0, 1]
  }));
}

async function withFileFetch(callback) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = typeof url === "string" ? url : url?.href;
    if (target?.startsWith("file:")) {
      return {
        ok: true,
        json: async () => JSON.parse(await fs.readFile(fileURLToPath(target), "utf8"))
      };
    }
    if (previousFetch) return previousFetch(url);
    throw new Error(`unsupported fetch URL ${target}`);
  };
  try {
    return await callback();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

const variants = [
  {
    presetId: "plate-tread",
    role: "plate",
    name: "Plate tread",
    origin: [0, 0, 0],
    parameters: {
      geometry: { width: 900, rise: 180 },
      treads: { thickness: 12, depth: 300, material: "S355", closedRisers: false, finish: "galvanized" }
    }
  },
  {
    presetId: "grating-tread",
    role: "grating",
    name: "Grating tread",
    origin: [0, 1450, 0],
    parameters: {
      geometry: { width: 900, rise: 180 },
      treads: { thickness: 35, depth: 300, material: "S355", closedRisers: false, finish: "galvanized" }
    }
  },
  {
    presetId: "pan-tread",
    role: "pan",
    name: "Pan tread",
    origin: [2100, 0, 0],
    parameters: {
      geometry: { width: 900, rise: 180 },
      treads: { thickness: 8, depth: 300, material: "S355", closedRisers: false, finish: "powder-coated" }
    }
  },
  {
    presetId: "folded-tray-tread",
    role: "foldedTray",
    name: "Folded tray tread with timber",
    origin: [2100, 1450, 0],
    parameters: {
      geometry: { width: 900, rise: 180 },
      treads: {
        thickness: 8,
        depth: 300,
        material: "S355",
        closedRisers: false,
        finish: "powder-coated",
        woodThickness: 32,
        woodNosing: 25,
        woodMaterial: "OAK_TIMBER",
        woodFinish: "clear-sealed-oak"
      }
    }
  }
];

await withFileFetch(async () => {
  const [catalog, baseProject, profilesLibrary, fasteners] = await Promise.all([
    loadSmartComponentDefinitions(),
    fs.readFile(new URL("../bobercad/data/projects/sample_fin_plate.json", import.meta.url), "utf8").then(JSON.parse),
    fs.readFile(new URL("../bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json", import.meta.url), "utf8").then(JSON.parse),
    fs.readFile(new URL("../bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json", import.meta.url), "utf8").then(JSON.parse)
  ]);

  let project = emptyProject(baseProject);
  for (const variant of variants) {
    const preset = catalog.smartComponents[variant.presetId];
    const definition = smartComponentDefinition(catalog, { type: preset.type, sourceComponent: { id: variant.presetId } });
    const created = createProjectSmartComponentFromPreset(project, catalog, variant.presetId, [], {
      definition,
      inputs: { layout: { treads: treadFrames(variant.origin, variant.role) } }
    });
    project = updateSmartComponent({
      project: created.project,
      profiles: profilesLibrary.profiles,
      definition,
      catalog,
      fasteners,
      instanceId: created.smartComponentId,
      parameters: merge(defaultParameters(definition, preset), variant.parameters)
    });
    const instance = project.model.smartComponentInstances[created.smartComponentId];
    instance.bim = { ...(instance.bim || {}), name: variant.name };
    instance.authoring = {
      ...(instance.authoring || {}),
      notes: `${variant.name} isolated tread detail component.`
    };
  }

  await fs.writeFile(OUT_FILE, `${JSON.stringify(project, null, 2)}\n`);
  console.log(`wrote ${fileURLToPath(OUT_FILE)}`);
});
