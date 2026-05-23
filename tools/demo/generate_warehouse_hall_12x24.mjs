import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConnectionDefinitions } from "../../bobercad/app/engine/modules/connections/connection-registry.mjs";
import { createProjectStore } from "../../bobercad/app/engine/store/project-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT = path.join(ROOT, "bobercad", "data", "projects", "sample_warehouse_12x24.json");

const FRAME_Y = [0, 6000, 12000, 18000, 24000];
const SPAN = 12000;
const EAVES_Z = 5000;
const COLUMN_TOP_Z = EAVES_Z + 300;
const RIDGE_X = SPAN / 2;
const RIDGE_Z = 6500;
const FOUNDATION_DEPTH = 300;
const MEMBER_PROFILE = "DEMO_I_300X150X8X12";
const PURLIN_PROFILE = "DEMO_RHS_100X50X5";
const FOUNDATION_PROFILE = "DEMO_SHS_100X100X5";
const LIGHT_END_PLATE_PRESET = "light_end_plate_m12_1x2";

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyModel() {
  return {
    workPoints: {},
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

function index(project, collection, object) {
  project.model[collection][object.id] = object;
  project.objectIndex[object.id] = { collection, type: object.type };
  return object.id;
}

function member(project, id, type, start, end, profile, options = {}) {
  return index(project, "members", {
    id,
    type,
    start,
    end,
    layoutAxis: options.layoutAxis || { start, end },
    profile,
    material: "S355",
    rotation: options.rotation || 0,
    cardinalPoint: "middle-center",
    featureIds: [],
    assemblyId: "assembly_warehouse_12x24",
    display: {
      visible: options.visible ?? true,
      color: options.color || "#466d84"
    },
    fabrication: {
      partMark: options.partMark || id.toUpperCase(),
      numberingStatus: "not-numbered"
    },
    bim: {
      name: options.name || id,
      ifcClass: options.ifcClass || "IfcBeam"
    }
  });
}

function pointOnSlope(side, t, y) {
  if (side === "left") {
    return [RIDGE_X * t, y, EAVES_Z + (RIDGE_Z - EAVES_Z) * t];
  }
  return [RIDGE_X + RIDGE_X * t, y, RIDGE_Z + (EAVES_Z - RIDGE_Z) * t];
}

function addConnection(store, presetId, memberIds, label) {
  try {
    return store.createConnectionFromPreset(presetId, memberIds).connectionId;
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function generatedConnectionErrors(project) {
  return Object.values(project.model.connections || {}).flatMap((connection) => {
    const diagnostics = connection.generator?.diagnostics || [];
    return diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => `${connection.id}: ${diagnostic.code}`);
  });
}

async function main() {
  const template = readJson("bobercad", "data", "projects", "sample_connection_test_frame.json");
  const profiles = readJson("bobercad", "data", "libraries", "profiles", "profile-libraries", "starter-profiles", "config.json");
  const fasteners = readJson("bobercad", "data", "libraries", "fasteners", "fastener-libraries", "starter-fasteners", "config.json");
  const connectionCatalog = await loadConnectionDefinitions();
  const project = clone(template);

  project.project = {
    id: "project_warehouse_12x24",
    name: "Warehouse Hall 12x24",
    description: "Simple 12 x 24 m warehouse hall demo with portal frames, roof purlins, side rails, and generated connection library components.",
    createdWith: "tools/demo/generate_warehouse_hall_12x24.mjs",
    bim: {
      name: "Warehouse Hall 12x24",
      propertySets: {
        Identity: {
          projectNumber: "PRJ-WH-12X24",
          status: "sample"
        }
      }
    }
  };
  project.objectIndex = {};
  project.model = emptyModel();
  project.projectTree = {
    rootNodeId: "site_warehouse",
    nodes: {
      site_warehouse: { id: "site_warehouse", type: "site", name: "Warehouse Site", children: ["building_warehouse"] },
      building_warehouse: { id: "building_warehouse", type: "building", name: "Warehouse Hall 12x24", children: ["zone_steel_frame"] },
      zone_steel_frame: { id: "zone_steel_frame", type: "zone", name: "Steel Frame", children: [] }
    }
  };
  project.gridSystems = {
    warehouse_grid: {
      id: "warehouse_grid",
      name: "Warehouse Grid",
      origin: [0, 0, 0],
      rotation: 0,
      axes: {
        x: [
          { id: "grid_x_1", label: "1", position: 0 },
          { id: "grid_x_2", label: "2", position: RIDGE_X },
          { id: "grid_x_3", label: "3", position: SPAN }
        ],
        y: FRAME_Y.map((position, index) => ({
          id: `grid_y_${index + 1}`,
          label: String.fromCharCode(65 + index),
          position
        }))
      }
    }
  };
  project.levels = {
    level_base: { id: "level_base", name: "Base", elevation: 0 },
    level_eaves: { id: "level_eaves", name: "Eaves", elevation: EAVES_Z },
    level_ridge: { id: "level_ridge", name: "Ridge", elevation: RIDGE_Z }
  };
  project.phases = { phase_1: { id: "phase_1", name: "Phase 1" } };
  project.lots = { lot_1: { id: "lot_1", name: "Lot 1" } };
  project.modelDefaults = {
    resolutionOrder: ["collectionDefault", "typeDefault", "object"],
    collections: {
      members: {
        "*": {
          material: "S355",
          cardinalPoint: "middle-center",
          featureIds: [],
          assemblyId: "assembly_warehouse_12x24",
          tracking: {
            projectTreeNodeId: "zone_steel_frame",
            phase: "phase_1",
            lot: "lot_1",
            status: "modeled"
          }
        }
      },
      connections: {
        "*": {
          tracking: {
            projectTreeNodeId: "zone_steel_frame",
            phase: "phase_1",
            lot: "lot_1",
            status: "modeled"
          }
        }
      }
    }
  };

  index(project, "groups", {
    id: "group_warehouse_12x24",
    type: "member-group",
    name: "Warehouse hall 12x24",
    projectTreeNodeId: "zone_steel_frame",
    objectIds: [],
    memberIds: []
  });
  index(project, "assemblies", {
    id: "assembly_warehouse_12x24",
    type: "site-assembly",
    mark: "WH12X24",
    name: "Warehouse hall 12x24 assembly",
    parentAssemblyId: null,
    childAssemblyIds: [],
    memberIds: [],
    connectionZoneIds: [],
    connectionIds: []
  });

  const frame = [];
  for (let indexY = 0; indexY < FRAME_Y.length; indexY += 1) {
    const y = FRAME_Y[indexY];
    const frameId = `f${indexY + 1}`;
    const leftColumn = member(project, `column_${frameId}_left`, "warehouse-column", [0, y, 0], [0, y, COLUMN_TOP_Z], MEMBER_PROFILE, {
      layoutAxis: { start: [0, y, 0], end: [0, y, EAVES_Z] },
      color: "#365f78",
      partMark: `C${indexY + 1}L`,
      name: `Left column ${frameId}`,
      ifcClass: "IfcColumn"
    });
    const rightColumn = member(project, `column_${frameId}_right`, "warehouse-column", [SPAN, y, 0], [SPAN, y, COLUMN_TOP_Z], MEMBER_PROFILE, {
      layoutAxis: { start: [SPAN, y, 0], end: [SPAN, y, EAVES_Z] },
      color: "#365f78",
      partMark: `C${indexY + 1}R`,
      name: `Right column ${frameId}`,
      ifcClass: "IfcColumn"
    });
    const foundationLeft = member(project, `foundation_${frameId}_left`, "foundation-stub", [0, y, -FOUNDATION_DEPTH], [0, y, 0], FOUNDATION_PROFILE, {
      visible: false,
      color: "#9ca3af",
      partMark: `F${indexY + 1}L`,
      name: `Left base support ${frameId}`,
      ifcClass: "IfcFooting"
    });
    const foundationRight = member(project, `foundation_${frameId}_right`, "foundation-stub", [SPAN, y, -FOUNDATION_DEPTH], [SPAN, y, 0], FOUNDATION_PROFILE, {
      visible: false,
      color: "#9ca3af",
      partMark: `F${indexY + 1}R`,
      name: `Right base support ${frameId}`,
      ifcClass: "IfcFooting"
    });
    const leftRafter = member(project, `rafter_${frameId}_left`, "warehouse-rafter", [0, y, EAVES_Z], [RIDGE_X, y, RIDGE_Z], MEMBER_PROFILE, {
      color: "#3f657d",
      partMark: `R${indexY + 1}L`,
      name: `Left rafter ${frameId}`
    });
    const rightRafter = member(project, `rafter_${frameId}_right`, "warehouse-rafter", [RIDGE_X, y, RIDGE_Z], [SPAN, y, EAVES_Z], MEMBER_PROFILE, {
      color: "#3f657d",
      partMark: `R${indexY + 1}R`,
      name: `Right rafter ${frameId}`
    });
    frame.push({ leftColumn, rightColumn, foundationLeft, foundationRight, leftRafter, rightRafter });
  }

  const purlins = [];
  const purlinStations = [0.25, 0.5, 0.75];
  for (let bay = 0; bay < FRAME_Y.length - 1; bay += 1) {
    const y0 = FRAME_Y[bay];
    const y1 = FRAME_Y[bay + 1];
    for (const side of ["left", "right"]) {
      for (let stationIndex = 0; stationIndex < purlinStations.length; stationIndex += 1) {
        const t = purlinStations[stationIndex];
        const id = `purlin_b${bay + 1}_${side}_${stationIndex + 1}`;
        const start = pointOnSlope(side, t, y0);
        const end = pointOnSlope(side, t, y1);
        member(project, id, "warehouse-purlin", start, end, PURLIN_PROFILE, {
          color: "#5f879c",
          partMark: `P${bay + 1}${side[0].toUpperCase()}${stationIndex + 1}`,
          name: `Roof purlin ${bay + 1} ${side} ${stationIndex + 1}`
        });
        purlins.push({ id, bay, side });
      }
    }
  }

  const rails = [];
  for (let bay = 0; bay < FRAME_Y.length - 1; bay += 1) {
    const y0 = FRAME_Y[bay];
    const y1 = FRAME_Y[bay + 1];
    for (const side of ["left", "right"]) {
      const x = side === "left" ? 0 : SPAN;
      for (const z of [2200, 3800]) {
        const id = `side_rail_b${bay + 1}_${side}_${z}`;
        member(project, id, "warehouse-side-rail", [x, y0, z], [x, y1, z], PURLIN_PROFILE, {
          color: "#6b90a2",
          partMark: `SR${bay + 1}${side[0].toUpperCase()}${z}`,
          name: `Side rail ${bay + 1} ${side} ${z}`
        });
        rails.push({ id, bay, side });
      }
    }
  }

  project.model.groups.group_warehouse_12x24.memberIds = Object.keys(project.model.members);
  project.model.groups.group_warehouse_12x24.objectIds = Object.keys(project.model.members);
  project.model.assemblies.assembly_warehouse_12x24.memberIds = Object.keys(project.model.members);

  const store = createProjectStore({ project, profiles: profiles.profiles, connectionCatalog, fasteners });

  for (const [indexY, item] of frame.entries()) {
    addConnection(store, "column_base_plate_m16_2x2", [item.foundationLeft, item.leftColumn], `base plate left frame ${indexY + 1}`);
    addConnection(store, "column_base_plate_m16_2x2", [item.foundationRight, item.rightColumn], `base plate right frame ${indexY + 1}`);
    addConnection(store, "beam_to_column_end_plate_m16_2x4", [item.leftColumn, item.leftRafter], `left eaves frame ${indexY + 1}`);
    addConnection(store, "beam_to_column_end_plate_m16_2x4", [item.rightColumn, item.rightRafter], `right eaves frame ${indexY + 1}`);
    addConnection(store, "apex_gusset_m16_2x2", [item.leftRafter, item.rightRafter], `apex frame ${indexY + 1}`);
  }

  for (const purlin of purlins) {
    const rafterSide = purlin.side === "left" ? "leftRafter" : "rightRafter";
    addConnection(store, LIGHT_END_PLATE_PRESET, [frame[purlin.bay][rafterSide], purlin.id], `purlin ${purlin.id} start end plate`);
    addConnection(store, LIGHT_END_PLATE_PRESET, [frame[purlin.bay + 1][rafterSide], purlin.id], `purlin ${purlin.id} end end plate`);
  }

  for (const rail of rails) {
    const columnSide = rail.side === "left" ? "leftColumn" : "rightColumn";
    addConnection(store, LIGHT_END_PLATE_PRESET, [frame[rail.bay][columnSide], rail.id], `side rail ${rail.id} start end plate`);
    addConnection(store, LIGHT_END_PLATE_PRESET, [frame[rail.bay + 1][columnSide], rail.id], `side rail ${rail.id} end end plate`);
  }

  const generated = store.project();
  const errors = generatedConnectionErrors(generated);
  if (errors.length) {
    throw new Error(`Generated hall has connection errors:\n${errors.join("\n")}`);
  }

  generated.model.groups.group_warehouse_12x24.memberIds = Object.keys(generated.model.members);
  generated.model.groups.group_warehouse_12x24.objectIds = [
    ...Object.keys(generated.model.members),
    ...Object.keys(generated.model.connections)
  ];
  generated.model.assemblies.assembly_warehouse_12x24.memberIds = Object.keys(generated.model.members);
  generated.model.assemblies.assembly_warehouse_12x24.connectionIds = Object.keys(generated.model.connections);
  generated.migrationHistory = [{
    id: "mig_warehouse_12x24_1",
    description: "Generated simple 12 x 24 m warehouse hall demo with reusable connection library presets.",
    schemaVersion: generated.schemaVersion
  }];

  fs.writeFileSync(OUTPUT, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(`Members: ${Object.keys(generated.model.members).length}`);
  console.log(`Connections: ${Object.keys(generated.model.connections).length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
