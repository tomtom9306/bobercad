import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadSmartComponentDefinitions, smartComponentDefinition } from "../bobercad/app/engine/modules/smart-components/smart-component-registry.mjs";
import { createProjectSmartComponentFromPreset, updateSmartComponent } from "../bobercad/app/engine/modules/smart-components/smart-component-generator.mjs";

const OUT_FILE = new URL("../bobercad/data/projects/sample_stair_treads_only_all_variants.json", import.meta.url);
const STAIR_PRESET_ID = "stair_system_straight_basic";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function straightFlight(id = "flight_1", fields = {}) {
  return { id, type: "flight.straight", ...fields };
}

function landingModule(type, fields = {}) {
  return { id: "landing_1", type, ...fields };
}

function landingRouteModules(type, landing = {}) {
  return {
    modules: [
      straightFlight("flight_1"),
      landingModule(type, landing),
      straightFlight("flight_2")
    ]
  };
}

function analyticRouteModule(type, fields = {}) {
  return {
    modules: [
      { id: "flight_1", type: `flight.${type}`, ...fields }
    ]
  };
}

function levelsForSteps(stepCount, maxStepHeight = 180) {
  return { ffl1: 0, ffl2: stepCount * maxStepHeight };
}

function emptyProject(base) {
  const project = clone(base);
  project.project.id = "project_stair_treads_only_all_variants";
  project.project.name = "Stair Treads And Landings Only All Variants";
  project.project.description = "All stair-system route and tread variants with only tread-family buildup surfaces generated for detailed tread and landing development.";
  project.project.createdWith = "stair-treads-landings-only-gallery-generator-0.1.0";
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
  return project;
}

function galleryPlacement(index) {
  const columns = 4;
  const spacingX = 7200;
  const spacingY = 5600;
  return [
    (index % columns) * spacingX,
    Math.floor(index / columns) * spacingY,
    0
  ];
}

function treadsOnlyParameters(base, variant) {
  return merge(merge(clone(base), variant.parameters || {}), {
    landings: { family: "same-as-treads" },
    supports: { family: "none" },
    railings: { family: "none" },
    connections: { family: "none", showMountingSurfaces: false },
    sections: { strategy: "none", manualStations: [] },
    compliance: { rulePack: "none" }
  });
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
    id: "straight-basic",
    name: "Straight basic",
    parameters: {}
  },
  {
    id: "straight-landing",
    name: "Straight landing route",
    parameters: {
      route: landingRouteModules("landing.straight"),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(10)
    }
  },
  {
    id: "l-shape",
    name: "L shape route",
    parameters: {
      route: landingRouteModules("landing.l", { turnDirection: "left" }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(10)
    }
  },
  {
    id: "multi-l-landings",
    name: "Multi L landings",
    parameters: {
      route: {
        modules: [
          straightFlight("flight_1", { stepCountOverride: 4 }),
          landingModule("landing.l", {
            id: "landing_1",
            turnDirection: "left",
            entryExtensionLength: 500,
            exitExtensionLength: 300
          }),
          straightFlight("flight_2", { stepCountOverride: 4 }),
          landingModule("landing.l", {
            id: "landing_2",
            turnDirection: "right",
            entryExtensionLength: 700,
            exitExtensionLength: 400
          }),
          straightFlight("flight_3", { stepCountOverride: 4 })
        ]
      },
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(12)
    }
  },
  {
    id: "u-switchback",
    name: "U switchback route",
    parameters: {
      route: landingRouteModules("landing.u", { turnDirection: "right", turnAcross: 1800 }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(12)
    }
  },
  {
    id: "winder",
    name: "Winder route",
    parameters: {
      route: analyticRouteModule("winder", { radius: 1400 }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(9)
    }
  },
  {
    id: "curved",
    name: "Curved route",
    parameters: {
      route: analyticRouteModule("curved", { radius: 2600 }),
      geometry: { maxStepHeight: 180, going: 280 },
      levels: levelsForSteps(12)
    }
  },
  {
    id: "spiral",
    name: "Spiral route",
    parameters: {
      route: analyticRouteModule("spiral", { radius: 950, rotationDegrees: 450 }),
      geometry: { maxStepHeight: 180, width: 760, going: 260 },
      levels: levelsForSteps(14),
      treads: { family: "pan-tread", depth: 260 }
    }
  },
  {
    id: "helical",
    name: "Helical route",
    parameters: {
      route: analyticRouteModule("helical", { radius: 1300, rotationDegrees: 540 }),
      geometry: { maxStepHeight: 180, width: 820, going: 260 },
      levels: levelsForSteps(16),
      treads: { family: "pan-tread", depth: 260 }
    }
  },
  {
    id: "plate-treads",
    name: "Plate treads",
    parameters: {
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(7),
      treads: { family: "plate-tread", thickness: 12, depth: 300, closedRisers: false }
    }
  },
  {
    id: "grating-treads",
    name: "Grating treads",
    parameters: {
      geometry: { maxStepHeight: 180, width: 980 },
      levels: levelsForSteps(7),
      treads: { family: "grating-tread", thickness: 35, depth: 300, closedRisers: false }
    }
  },
  {
    id: "pan-treads",
    name: "Pan treads",
    parameters: {
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(7),
      treads: { family: "pan-tread", thickness: 8, depth: 300 }
    }
  },
  {
    id: "folded-tray-timber",
    name: "Folded tray with timber",
    parameters: {
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(7),
      treads: {
        family: "folded-tray-tread",
        thickness: 8,
        depth: 300,
        woodThickness: 32,
        woodInset: 35,
        woodNosing: 25
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
  const preset = catalog.smartComponents[STAIR_PRESET_ID];
  const definition = smartComponentDefinition(catalog, { type: preset.type, sourceComponent: { id: STAIR_PRESET_ID } });
  const baseParameters = preset.parameters;
  let project = emptyProject(baseProject);

  project.model.addonData.stairTreadsOnlyGallery = {
    type: "stair-system-treads-landings-only-gallery",
    layout: { columns: 4, spacingX: 7200, spacingY: 5600 },
    variants: variants.map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      origin: galleryPlacement(index)
    }))
  };

  for (const [index, variant] of variants.entries()) {
    const created = createProjectSmartComponentFromPreset(project, catalog, STAIR_PRESET_ID, [], {
      definition,
      inputs: { placement: { origin: galleryPlacement(index) } }
    });
    project = updateSmartComponent({
      project: created.project,
      profiles: profilesLibrary.profiles,
      definition,
      catalog,
      fasteners,
      instanceId: created.smartComponentId,
      parameters: treadsOnlyParameters(baseParameters, variant)
    });
    const instance = project.model.smartComponentInstances[created.smartComponentId];
    instance.bim = { ...(instance.bim || {}), name: variant.name };
    instance.authoring = {
      ...(instance.authoring || {}),
      notes: `${variant.name}: full stair route solved with only tread child components generated.`
    };
  }

  await fs.writeFile(OUT_FILE, `${JSON.stringify(project, null, 2)}\n`);
  console.log(`wrote ${fileURLToPath(OUT_FILE)}`);
});
