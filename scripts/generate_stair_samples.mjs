import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadSmartComponentDefinitions, smartComponentDefinition } from "../bobercad/app/engine/modules/smart-components/smart-component-registry.mjs";
import { createProjectSmartComponentFromPreset, updateSmartComponent } from "../bobercad/app/engine/modules/smart-components/smart-component-generator.mjs";
import { createProjectStore } from "../bobercad/app/engine/store/project-store.mjs";

const OUT_DIR = new URL("../bobercad/data/projects/", import.meta.url);
const STAIR_PRESET_ID = "stair_system_straight_basic";
const GALLERY_FILE = "sample_stair_all_variants.json";

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

function emptyProject(base, variant) {
  const project = clone(base);
  project.project.id = variant.projectId;
  project.project.name = variant.name;
  project.project.description = variant.description;
  project.project.createdWith = "stair-system-sample-generator-0.1.0";
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
  project.model.relations ||= {};
  project.model.addonData ||= {};
  return project;
}

function variantParameters(base, variant) {
  return merge(clone(base), variant.parameters || {});
}

const variants = [
  {
    file: "sample_stair_straight_basic.json",
    projectId: "project_stair_straight_basic",
    name: "Stair Straight Basic",
    description: "Straight stair-system sample with plate treads, twin stringers, railing, and tread welds.",
    parameters: {}
  },
  {
    file: "sample_stair_straight_with_landing.json",
    projectId: "project_stair_straight_with_landing",
    name: "Stair Straight With Landing",
    description: "Straight stair-system sample with an intermediate landing.",
    parameters: {
      route: landingRouteModules("landing.straight"),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(10),
      landings: { family: "framed-landing", length: 1200 }
    }
  },
  {
    file: "sample_stair_l_shape.json",
    projectId: "project_stair_l_shape",
    name: "Stair L Shape",
    description: "L-shaped stair-system sample with landing.",
    parameters: {
      route: landingRouteModules("landing.l", { turnDirection: "left" }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(10),
      landings: { family: "framed-landing", length: 1100 }
    }
  },
  {
    file: "sample_stair_u_switchback.json",
    projectId: "project_stair_u_switchback",
    name: "Stair U Switchback",
    description: "U/switchback stair-system sample.",
    parameters: {
      route: landingRouteModules("landing.u", { turnDirection: "right", turnAcross: 1800 }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(12),
      landings: { family: "framed-landing", length: 1200 },
      railings: { sides: "right" },
      sections: { strategy: "landings" }
    }
  },
  {
    file: "sample_stair_winder.json",
    projectId: "project_stair_winder",
    name: "Stair Winder",
    description: "Winder stair-system sample using an arc walking line.",
    parameters: {
      route: analyticRouteModule("winder", { radius: 1400 }),
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(9),
      supports: { maxSegmentLength: 450 },
      compliance: { rulePack: "uk-part-k" }
    }
  },
  {
    file: "sample_stair_curved.json",
    projectId: "project_stair_curved",
    name: "Stair Curved",
    description: "Curved stair-system sample.",
    parameters: {
      route: analyticRouteModule("curved", { radius: 2600 }),
      geometry: { maxStepHeight: 180, going: 280 },
      levels: levelsForSteps(12),
      supports: { maxSegmentLength: 500 }
    }
  },
  {
    file: "sample_stair_spiral.json",
    projectId: "project_stair_spiral",
    name: "Stair Spiral",
    description: "Spiral stair-system sample with central column support.",
    parameters: {
      route: analyticRouteModule("spiral", { radius: 950, rotationDegrees: 450 }),
      geometry: { maxStepHeight: 180, width: 760, going: 260 },
      levels: levelsForSteps(14),
      supports: { family: "spiral-column", profile: "DEMO_I_200X100X8X12", columnProfile: "DEMO_CHS_114X5", maxSegmentLength: 350 },
      railings: { family: "post-and-rail", sides: "left" },
      compliance: { rulePack: "none" }
    }
  },
  {
    file: "sample_stair_helical.json",
    projectId: "project_stair_helical",
    name: "Stair Helical",
    description: "Helical stair-system sample.",
    parameters: {
      route: analyticRouteModule("helical", { radius: 1800, rotationDegrees: 540 }),
      geometry: { maxStepHeight: 180, width: 900, going: 270 },
      levels: levelsForSteps(18),
      supports: { family: "mono-stringer", maxSegmentLength: 420 },
      railings: { family: "post-and-rail", sides: "both" },
      compliance: { rulePack: "none" }
    }
  },
  {
    file: "sample_stair_mono_stringer.json",
    projectId: "project_stair_mono_stringer",
    name: "Stair Mono Stringer",
    description: "Straight stair-system sample with mono stringer.",
    parameters: {
      supports: { family: "mono-stringer" },
      railings: { family: "wall-handrail", sides: "right" }
    }
  },
  {
    file: "sample_stair_grating_treads.json",
    projectId: "project_stair_grating_treads",
    name: "Stair Grating Treads",
    description: "Straight stair-system sample with grating tread family.",
    parameters: {
      treads: { family: "grating-tread", thickness: 12, depth: 260 },
      geometry: { going: 280 }
    }
  },
  {
    file: "sample_stair_glass_rail.json",
    projectId: "project_stair_glass_rail",
    name: "Stair Glass Rail",
    description: "Straight stair-system sample with glass panel railing.",
    parameters: {
      railings: { family: "glass-panel", sides: "both", height: 1100 }
    }
  },
  {
    file: "sample_stair_transport_split_weight.json",
    projectId: "project_stair_transport_split_weight",
    name: "Stair Transport Split Weight",
    description: "Stair-system sample with max-weight transport sectioning.",
    parameters: {
      geometry: { maxStepHeight: 180 },
      levels: levelsForSteps(14),
      sections: { strategy: "max-weight", maxWeightKg: 90, targetLength: 1800 }
    }
  },
  {
    file: "sample_stair_manual_split.json",
    projectId: "project_stair_manual_split",
    name: "Stair Manual Split",
    description: "Stair-system sample with manual station split points.",
    parameters: {
      sections: { strategy: "manual-stations", manualStations: [900, 1800] }
    }
  },
  {
    file: "sample_stair_compliance_failures.json",
    projectId: "project_stair_compliance_failures",
    name: "Stair Compliance Failures",
    description: "Stair-system sample intentionally outside UK Part K rise/going guidance.",
    parameters: {
      geometry: { maxStepHeight: 230, going: 180 },
      levels: levelsForSteps(7, 230),
      compliance: { rulePack: "uk-part-k", category: "utility", headroom: 1800 },
      railings: { height: 760 }
    }
  }
];

function galleryPlacement(index) {
  const columns = 4;
  const spacingX = 7600;
  const spacingY = 7600;
  return [
    (index % columns) * spacingX,
    Math.floor(index / columns) * spacingY,
    0
  ];
}

async function writeGalleryProject({ baseProject, catalog, profiles, fasteners, baseParameters }) {
  const gallery = emptyProject(baseProject, {
    projectId: "project_stair_all_variants",
    name: "Stair System All Variants",
    description: "Single-scene gallery containing every stair-system sample variant."
  });
  gallery.project.createdWith = "stair-system-sample-gallery-generator-0.1.0";
  gallery.model.addonData.stairSystemGallery = {
    type: "stair-system-gallery",
    layout: { columns: 4, spacingX: 7600, spacingY: 7600 },
    variants: variants.map((variant, index) => ({
      name: variant.name,
      sourceFile: variant.file,
      origin: galleryPlacement(index)
    }))
  };

  const preset = catalog.smartComponents[STAIR_PRESET_ID];
  const definition = smartComponentDefinition(catalog, { type: preset.type, sourceComponent: { id: STAIR_PRESET_ID } });
  let project = gallery;

  for (const [index, variant] of variants.entries()) {
    const created = createProjectSmartComponentFromPreset(project, catalog, STAIR_PRESET_ID, [], {
      definition,
      inputs: { placement: { origin: galleryPlacement(index) } }
    });
    project = created.project;
    const instance = project.model.smartComponentInstances[created.smartComponentId];
    instance.bim = { ...(instance.bim || {}), name: variant.name };
    instance.authoring = {
      ...(instance.authoring || {}),
      notes: `${variant.name} gallery instance generated from ${variant.file}.`
    };
    project = updateSmartComponent({
      project,
      profiles,
      definition,
      catalog,
      fasteners,
      instanceId: created.smartComponentId,
      parameters: variantParameters(baseParameters, variant)
    });
    project.model.smartComponentInstances[created.smartComponentId].bim = {
      ...(project.model.smartComponentInstances[created.smartComponentId].bim || {}),
      name: variant.name
    };
  }

  const file = new URL(GALLERY_FILE, OUT_DIR);
  await fs.writeFile(file, `${JSON.stringify(project, null, 2)}\n`);
  console.log(`wrote ${GALLERY_FILE}`);
}

await withFileFetch(async () => {
  const [catalog, baseProject, profilesLibrary, fasteners] = await Promise.all([
    loadSmartComponentDefinitions(),
    fs.readFile(new URL("../bobercad/data/projects/sample_fin_plate.json", import.meta.url), "utf8").then(JSON.parse),
    fs.readFile(new URL("../bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json", import.meta.url), "utf8").then(JSON.parse),
    fs.readFile(new URL("../bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  const baseParameters = catalog.smartComponents[STAIR_PRESET_ID].parameters;

  for (const variant of variants) {
    const project = emptyProject(baseProject, variant);
    const store = createProjectStore({
      project,
      profiles: profilesLibrary.profiles,
      smartComponentCatalog: catalog,
      fasteners
    });
    const created = store.createSmartComponentFromPreset(STAIR_PRESET_ID, []);
    const parameters = variantParameters(baseParameters, variant);
    store.updateSmartComponent(created.smartComponentId, parameters);
    const output = store.project();
    const file = new URL(variant.file, OUT_DIR);
    await fs.writeFile(file, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`wrote ${variant.file}`);
  }

  await writeGalleryProject({
    baseProject,
    catalog,
    profiles: profilesLibrary.profiles,
    fasteners,
    baseParameters
  });
});
