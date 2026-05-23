import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConnectionDefinitions } from "../../bobercad/app/engine/modules/connections/connection-registry.mjs";
import { createProjectStore } from "../../bobercad/app/engine/store/project-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT = path.join(ROOT, "stress-output", "stress-eiffel-tower.json");

const MAIN_PROFILE = "DEMO_I_300X150X8X12";
const SECONDARY_PROFILE = "DEMO_I_200X100X8X12";
const LATTICE_PROFILE = "DEMO_L_75X75X8";
const PLATFORM_PROFILE = "DEMO_RHS_100X50X5";
const MAST_PROFILE = "DEMO_CHS_114X5";
const FOUNDATION_PROFILE = "DEMO_SHS_100X100X5";
const MATERIAL = "S355";
const IRON_COLOR = "#7b5a3a";
const DARK_IRON_COLOR = "#5f4630";
const LIGHT_IRON_COLOR = "#946b43";
const PLATFORM_COLOR = "#6f5237";

const CORNERS = [
  { id: "east", sx: 1, sy: 1 },
  { id: "north", sx: -1, sy: 1 },
  { id: "west", sx: -1, sy: -1 },
  { id: "south", sx: 1, sy: -1 }
];

const WIDTH_ANCHORS = [
  { z: 0, width: 125000 },
  { z: 57630, width: 70000 },
  { z: 115730, width: 31700 },
  { z: 276130, width: 10000 },
  { z: 324000, width: 3000 },
  { z: 330000, width: 850 }
];

const STATIONS = [
  0,
  12000,
  24000,
  36000,
  48000,
  57630,
  72000,
  88000,
  104000,
  115730,
  135000,
  155000,
  175000,
  195000,
  215000,
  235000,
  255000,
  276130,
  288000,
  300000,
  312000,
  324000,
  330000
];

const PLATFORM_STATIONS = new Set([57630, 115730, 276130]);
const PLATFORM_EXTENTS = new Map([
  [57630, 84000],
  [115730, 42000],
  [276130, 16000]
]);
const DENSE_VERTICAL_PANELS = 250;
const DENSE_SIDE_SEGMENTS = 22;

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), "utf8"));
}

function rel(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replaceAll(path.sep, "/");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function sub(a, b) {
  return a.map((value, index) => value - b[index]);
}

function mul(a, scalar) {
  return a.map((value) => value * scalar);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pointLerp(a, b, t) {
  return a.map((value, index) => lerp(value, b[index], t));
}

function len(vector) {
  return Math.hypot(...vector);
}

function emptyModel() {
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

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function towerWidth(z) {
  for (let index = 0; index < WIDTH_ANCHORS.length - 1; index += 1) {
    const left = WIDTH_ANCHORS[index];
    const right = WIDTH_ANCHORS[index + 1];
    if (z < left.z || z > right.z) continue;
    const raw = (z - left.z) / (right.z - left.z);
    const t = left.z === 0 ? raw : smoothstep(raw);
    return lerp(left.width, right.width, t);
  }
  return WIDTH_ANCHORS.at(-1).width;
}

function cornerPoint(cornerIndex, z) {
  const corner = CORNERS[cornerIndex];
  const half = towerWidth(z) / 2;
  return [corner.sx * half, corner.sy * half, z];
}

function sidePoint(sideIndex, z, t) {
  return pointLerp(cornerPoint(sideIndex, z), cornerPoint((sideIndex + 1) % CORNERS.length, z), t);
}

function projectBase(template) {
  const project = clone(template);
  project.project = {
    id: "project_stress_eiffel_tower",
    name: "Stress Test Eiffel Tower",
    description: "Approximate Eiffel Tower stress-test model using only starter profiles, materials, and generated connection-library presets.",
    createdWith: "tools/stress/generate_eiffel_tower_stress.mjs",
    bim: {
      name: "Stress Test Eiffel Tower",
      propertySets: {
        Identity: {
          projectNumber: "PRJ-STRESS-EIFFEL",
          status: "sample"
        }
      }
    }
  };
  project.objectIndex = {};
  project.model = emptyModel();
  project.projectTree = {
    rootNodeId: "site_eiffel_stress",
    nodes: {
      site_eiffel_stress: { id: "site_eiffel_stress", type: "site", name: "Stress Test Site", children: ["building_eiffel"] },
      building_eiffel: { id: "building_eiffel", type: "building", name: "Eiffel Tower Stress Model", children: ["zone_lattice_tower"] },
      zone_lattice_tower: { id: "zone_lattice_tower", type: "zone", name: "Lattice Tower", children: [] }
    }
  };
  project.gridSystems = {
    eiffel_grid: {
      id: "eiffel_grid",
      name: "Eiffel tower footprint",
      origin: [0, 0, 0],
      rotation: 0,
      axes: {
        x: [
          { id: "grid_x_west", label: "W", position: -62500 },
          { id: "grid_x_center", label: "C", position: 0 },
          { id: "grid_x_east", label: "E", position: 62500 }
        ],
        y: [
          { id: "grid_y_south", label: "S", position: -62500 },
          { id: "grid_y_center", label: "C", position: 0 },
          { id: "grid_y_north", label: "N", position: 62500 }
        ]
      }
    }
  };
  project.levels = {
    level_base: { id: "level_base", name: "Base", elevation: 0 },
    level_first: { id: "level_first", name: "First floor", elevation: 57630 },
    level_second: { id: "level_second", name: "Second floor", elevation: 115730 },
    level_third: { id: "level_third", name: "Third floor", elevation: 276130 },
    level_top: { id: "level_top", name: "Antenna top", elevation: 330000 }
  };
  project.phases = { phase_1: { id: "phase_1", name: "Phase 1" } };
  project.lots = { lot_1: { id: "lot_1", name: "Lot 1" } };
  project.modelDefaults = {
    resolutionOrder: ["collectionDefault", "typeDefault", "object"],
    collections: {
      members: {
        "*": {
          material: MATERIAL,
          cardinalPoint: "middle-center",
          featureIds: [],
          assemblyId: "assembly_eiffel_tower",
          tracking: {
            projectTreeNodeId: "zone_lattice_tower",
            phase: "phase_1",
            lot: "lot_1",
            status: "modeled"
          }
        }
      },
      connections: {
        "*": {
          tracking: {
            projectTreeNodeId: "zone_lattice_tower",
            phase: "phase_1",
            lot: "lot_1",
            status: "modeled"
          }
        }
      }
    }
  };
  return project;
}

function index(project, collection, object) {
  project.model[collection][object.id] = object;
  project.objectIndex[object.id] = { collection, type: object.type };
  return object.id;
}

function addWorkPoint(project, id, point, role) {
  return index(project, "workPoints", {
    id,
    type: "eiffel-reference-point",
    point,
    role,
    gridSystemId: "eiffel_grid"
  });
}

function addMember(project, id, type, start, end, profile, options = {}) {
  if (len(sub(end, start)) <= 1) return null;
  return index(project, "members", {
    id,
    type,
    start,
    end,
    layoutAxis: options.layoutAxis || { start, end },
    profile,
    material: MATERIAL,
    rotation: options.rotation || 0,
    cardinalPoint: "middle-center",
    featureIds: [],
    assemblyId: "assembly_eiffel_tower",
    display: {
      visible: options.visible ?? true,
      color: options.color || IRON_COLOR
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

function addCoreRecords(project) {
  index(project, "groups", {
    id: "group_eiffel_tower",
    type: "stress-eiffel-tower",
    projectTreeNodeId: "zone_lattice_tower",
    name: "Eiffel Tower stress model",
    objectIds: [],
    memberIds: [],
    authoring: {
      source: "procedural-generator",
      notes: "Approximate landmark geometry; connections are generated only from existing starter connection presets."
    }
  });
  index(project, "assemblies", {
    id: "assembly_eiffel_tower",
    type: "site-assembly",
    mark: "EIFFEL-STRESS",
    name: "Eiffel tower stress assembly",
    parentAssemblyId: null,
    childAssemblyIds: [],
    memberIds: [],
    connectionZoneIds: [],
    connectionIds: []
  });
}

function addReferencePoints(project) {
  for (const station of STATIONS) {
    addWorkPoint(project, `wp_eiffel_center_${Math.round(station)}`, [0, 0, station], "tower-centerline");
  }
  for (const z of [0, 57630, 115730, 276130, 330000]) {
    for (let corner = 0; corner < CORNERS.length; corner += 1) {
      addWorkPoint(project, `wp_eiffel_${CORNERS[corner].id}_${Math.round(z)}`, cornerPoint(corner, z), "tower-corner");
    }
  }
}

function addTowerMembers(project) {
  const legSegments = Array.from({ length: CORNERS.length }, () => []);
  const secondaryConnections = [];
  const nodePrimary = new Map();
  const stationIndexByZ = new Map(STATIONS.map((z, index) => [z, index]));

  const registerNodePrimary = (corner, stationIndex, memberId) => {
    const key = `${corner}:${stationIndex}`;
    if (!nodePrimary.has(key)) nodePrimary.set(key, memberId);
  };

  for (let corner = 0; corner < CORNERS.length; corner += 1) {
    for (let stationIndex = 0; stationIndex < STATIONS.length - 1; stationIndex += 1) {
      const z0 = STATIONS[stationIndex];
      const z1 = STATIONS[stationIndex + 1];
      const profile = z0 < 115730 ? MAIN_PROFILE : z0 < 276130 ? SECONDARY_PROFILE : MAST_PROFILE;
      const id = `et_leg_${CORNERS[corner].id}_${stationIndex + 1}`;
      addMember(project, id, "eiffel-main-leg", cornerPoint(corner, z0), cornerPoint(corner, z1), profile, {
        color: z0 < 115730 ? DARK_IRON_COLOR : IRON_COLOR,
        partMark: `EL${corner + 1}-${stationIndex + 1}`,
        name: `Eiffel curved leg ${CORNERS[corner].id} panel ${stationIndex + 1}`,
        ifcClass: "IfcColumn"
      });
      legSegments[corner][stationIndex] = id;
      registerNodePrimary(corner, stationIndex, id);
      registerNodePrimary(corner, stationIndex + 1, id);
    }
  }

  const connectEndpoint = (primaryKey, secondaryId) => {
    const primaryId = nodePrimary.get(primaryKey);
    if (primaryId && primaryId !== secondaryId) secondaryConnections.push({ primaryId, secondaryId });
  };

  for (let stationIndex = 0; stationIndex < STATIONS.length; stationIndex += 1) {
    const z = STATIONS[stationIndex];
    for (let side = 0; side < CORNERS.length; side += 1) {
      const next = (side + 1) % CORNERS.length;
      const id = `et_ring_${stationIndex + 1}_${CORNERS[side].id}_${CORNERS[next].id}`;
      addMember(project, id, "eiffel-ring-girder", cornerPoint(side, z), cornerPoint(next, z), z <= 115730 ? SECONDARY_PROFILE : PLATFORM_PROFILE, {
        color: PLATFORM_STATIONS.has(z) ? PLATFORM_COLOR : IRON_COLOR,
        partMark: `ER${stationIndex + 1}-${side + 1}`,
        name: `Eiffel ring girder ${stationIndex + 1} ${CORNERS[side].id}-${CORNERS[next].id}`
      });
      connectEndpoint(`${side}:${stationIndex}`, id);
      connectEndpoint(`${next}:${stationIndex}`, id);
    }
  }

  for (let stationIndex = 0; stationIndex < STATIONS.length - 1; stationIndex += 1) {
    const z0 = STATIONS[stationIndex];
    const z1 = STATIONS[stationIndex + 1];
    for (let side = 0; side < CORNERS.length; side += 1) {
      const next = (side + 1) % CORNERS.length;
      const diagonals = [
        {
          id: `et_x_${stationIndex + 1}_${side + 1}_a`,
          start: cornerPoint(side, z0),
          end: cornerPoint(next, z1),
          startKey: `${side}:${stationIndex}`,
          endKey: `${next}:${stationIndex + 1}`
        },
        {
          id: `et_x_${stationIndex + 1}_${side + 1}_b`,
          start: cornerPoint(next, z0),
          end: cornerPoint(side, z1),
          startKey: `${next}:${stationIndex}`,
          endKey: `${side}:${stationIndex + 1}`
        },
        {
          id: `et_mid_${stationIndex + 1}_${side + 1}_upr_a`,
          start: sidePoint(side, z0, 0.5),
          end: cornerPoint(side, z1),
          endKey: `${side}:${stationIndex + 1}`
        },
        {
          id: `et_mid_${stationIndex + 1}_${side + 1}_upr_b`,
          start: sidePoint(side, z0, 0.5),
          end: cornerPoint(next, z1),
          endKey: `${next}:${stationIndex + 1}`
        },
        {
          id: `et_mid_${stationIndex + 1}_${side + 1}_low_a`,
          start: cornerPoint(side, z0),
          end: sidePoint(side, z1, 0.5),
          startKey: `${side}:${stationIndex}`
        },
        {
          id: `et_mid_${stationIndex + 1}_${side + 1}_low_b`,
          start: cornerPoint(next, z0),
          end: sidePoint(side, z1, 0.5),
          startKey: `${next}:${stationIndex}`
        }
      ];

      for (const diagonal of diagonals) {
        addMember(project, diagonal.id, "eiffel-lattice-brace", diagonal.start, diagonal.end, LATTICE_PROFILE, {
          color: LIGHT_IRON_COLOR,
          partMark: diagonal.id.toUpperCase(),
          name: `Eiffel lattice ${diagonal.id}`
        });
        if (diagonal.startKey) connectEndpoint(diagonal.startKey, diagonal.id);
        if (diagonal.endKey) connectEndpoint(diagonal.endKey, diagonal.id);
      }

      const midId = `et_mid_post_${stationIndex + 1}_${side + 1}`;
      addMember(project, midId, "eiffel-lattice-post", sidePoint(side, z0, 0.5), sidePoint(side, z1, 0.5), LATTICE_PROFILE, {
        color: LIGHT_IRON_COLOR,
        partMark: midId.toUpperCase(),
        name: `Eiffel side lattice post ${stationIndex + 1} ${side + 1}`
      });
    }
  }

  return { legSegments, secondaryConnections, stationIndexByZ };
}

function denseProfileForHeight(z) {
  if (z < 115730) return LATTICE_PROFILE;
  if (z < 276130) return LATTICE_PROFILE;
  return LATTICE_PROFILE;
}

function addDenseLattice(project) {
  const zValues = Array.from(
    { length: DENSE_VERTICAL_PANELS + 1 },
    (_, index) => 330000 * index / DENSE_VERTICAL_PANELS
  );
  let added = 0;

  const addDenseMember = (id, type, start, end, z, options = {}) => {
    const memberId = addMember(project, id, type, start, end, denseProfileForHeight(z), {
      color: options.color || LIGHT_IRON_COLOR,
      partMark: id.toUpperCase(),
      name: options.name || id
    });
    if (memberId) added += 1;
    return memberId;
  };

  for (let layer = 0; layer < zValues.length; layer += 1) {
    const z = zValues[layer];
    for (let side = 0; side < CORNERS.length; side += 1) {
      for (let segment = 0; segment < DENSE_SIDE_SEGMENTS; segment += 1) {
        addDenseMember(
          `et_dense_h_${layer}_${side}_${segment}`,
          "eiffel-dense-horizontal-lattice",
          sidePoint(side, z, segment / DENSE_SIDE_SEGMENTS),
          sidePoint(side, z, (segment + 1) / DENSE_SIDE_SEGMENTS),
          z,
          { color: layer % 10 === 0 ? IRON_COLOR : LIGHT_IRON_COLOR }
        );
      }
    }
  }

  for (let panel = 0; panel < zValues.length - 1; panel += 1) {
    const z0 = zValues[panel];
    const z1 = zValues[panel + 1];
    const zMid = (z0 + z1) / 2;
    for (let side = 0; side < CORNERS.length; side += 1) {
      for (let segment = 1; segment < DENSE_SIDE_SEGMENTS; segment += 1) {
        const t = segment / DENSE_SIDE_SEGMENTS;
        addDenseMember(
          `et_dense_v_${panel}_${side}_${segment}`,
          "eiffel-dense-vertical-lattice",
          sidePoint(side, z0, t),
          sidePoint(side, z1, t),
          zMid
        );
      }
      for (let segment = 0; segment < DENSE_SIDE_SEGMENTS; segment += 1) {
        const t0 = segment / DENSE_SIDE_SEGMENTS;
        const t1 = (segment + 1) / DENSE_SIDE_SEGMENTS;
        addDenseMember(
          `et_dense_x_${panel}_${side}_${segment}_a`,
          "eiffel-dense-diagonal-lattice",
          sidePoint(side, z0, t0),
          sidePoint(side, z1, t1),
          zMid
        );
        addDenseMember(
          `et_dense_x_${panel}_${side}_${segment}_b`,
          "eiffel-dense-diagonal-lattice",
          sidePoint(side, z0, t1),
          sidePoint(side, z1, t0),
          zMid
        );
      }
    }
  }

  return added;
}

function addPlatforms(project) {
  const platformMembers = [];
  for (const [z, width] of PLATFORM_EXTENTS.entries()) {
    const half = width / 2;
    const corners = [
      [half, half, z],
      [-half, half, z],
      [-half, -half, z],
      [half, -half, z]
    ];
    for (let side = 0; side < 4; side += 1) {
      const id = `et_platform_${Math.round(z)}_${side + 1}`;
      platformMembers.push(addMember(project, id, "eiffel-observation-platform", corners[side], corners[(side + 1) % 4], PLATFORM_PROFILE, {
        color: PLATFORM_COLOR,
        partMark: `EP${Math.round(z)}-${side + 1}`,
        name: `Eiffel observation platform ${Math.round(z)} side ${side + 1}`
      }));
    }
    for (const axis of ["x", "y"]) {
      const id = `et_platform_${Math.round(z)}_cross_${axis}`;
      const start = axis === "x" ? [-half, 0, z] : [0, -half, z];
      const end = axis === "x" ? [half, 0, z] : [0, half, z];
      platformMembers.push(addMember(project, id, "eiffel-platform-crossbeam", start, end, PLATFORM_PROFILE, {
        color: PLATFORM_COLOR,
        partMark: `EPC${Math.round(z)}-${axis}`,
        name: `Eiffel platform crossbeam ${Math.round(z)} ${axis}`
      }));
    }
  }
  return platformMembers.filter(Boolean);
}

function addArches(project) {
  const archMembers = [];
  const segments = 12;
  for (let side = 0; side < CORNERS.length; side += 1) {
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const base0 = sidePoint(side, 0, t0);
      const base1 = sidePoint(side, 0, t1);
      const archPoint = (base, t) => [base[0], base[1], 4000 + 44000 * Math.sin(Math.PI * t)];
      const id = `et_arch_${side + 1}_${index + 1}`;
      archMembers.push(addMember(project, id, "eiffel-decorative-arch", archPoint(base0, t0), archPoint(base1, t1), SECONDARY_PROFILE, {
        color: DARK_IRON_COLOR,
        partMark: `EA${side + 1}-${index + 1}`,
        name: `Eiffel decorative arch ${side + 1}.${index + 1}`
      }));
    }
  }
  return archMembers.filter(Boolean);
}

function addAntenna(project) {
  const ids = [];
  const points = [
    [0, 0, 324000],
    [0, 0, 330000],
    [0, 0, 336000]
  ];
  for (let index = 0; index < points.length - 1; index += 1) {
    ids.push(addMember(project, `et_antenna_${index + 1}`, "eiffel-antenna", points[index], points[index + 1], MAST_PROFILE, {
      color: "#4b5563",
      partMark: `ANT${index + 1}`,
      name: `Eiffel antenna segment ${index + 1}`
    }));
  }
  for (const z of [324000, 330000]) {
    const half = z === 324000 ? 1800 : 600;
    ids.push(addMember(project, `et_antenna_collar_x_${Math.round(z)}`, "eiffel-antenna-collar", [-half, 0, z], [half, 0, z], LATTICE_PROFILE, {
      color: "#4b5563",
      partMark: `ANTCX${Math.round(z)}`,
      name: `Eiffel antenna collar X ${Math.round(z)}`
    }));
    ids.push(addMember(project, `et_antenna_collar_y_${Math.round(z)}`, "eiffel-antenna-collar", [0, -half, z], [0, half, z], LATTICE_PROFILE, {
      color: "#4b5563",
      partMark: `ANTCY${Math.round(z)}`,
      name: `Eiffel antenna collar Y ${Math.round(z)}`
    }));
  }
  return ids.filter(Boolean);
}

function shouldGenerateConnectionAttempt(entry) {
  const ring = /^et_ring_(\d+)_/.exec(entry.secondaryId);
  if (ring) {
    const station = Number(ring[1]);
    return new Set([1, 6, 10, 18, 22, 23]).has(station);
  }

  const xBrace = /^et_x_(\d+)_/.exec(entry.secondaryId);
  if (xBrace) {
    const panel = Number(xBrace[1]);
    return (panel - 1) % 4 === 0;
  }

  return false;
}

function addBaseSupports(project) {
  const supports = [];
  for (let corner = 0; corner < CORNERS.length; corner += 1) {
    const base = cornerPoint(corner, 0);
    const id = `et_foundation_${CORNERS[corner].id}`;
    supports.push(addMember(project, id, "eiffel-hidden-foundation-stub", add(base, [0, 0, -650]), base, FOUNDATION_PROFILE, {
      visible: false,
      color: "#9ca3af",
      partMark: `FND${corner + 1}`,
      name: `Eiffel foundation support ${CORNERS[corner].id}`,
      ifcClass: "IfcFooting"
    }));
  }
  return supports.filter(Boolean);
}

function addConnection(store, presetId, memberIds, label, failures) {
  try {
    return store.createConnectionFromPreset(presetId, memberIds).connectionId;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    return null;
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
  const project = projectBase(template);
  addCoreRecords(project);
  addReferencePoints(project);
  const supports = addBaseSupports(project);
  const { legSegments, secondaryConnections } = addTowerMembers(project);
  addPlatforms(project);
  addArches(project);
  addAntenna(project);

  project.model.groups.group_eiffel_tower.memberIds = Object.keys(project.model.members);
  project.model.groups.group_eiffel_tower.objectIds = Object.keys(project.model.members);
  project.model.assemblies.assembly_eiffel_tower.memberIds = Object.keys(project.model.members);

  const store = createProjectStore({ project, profiles: profiles.profiles, connectionCatalog, fasteners });
  const failures = [];

  for (let corner = 0; corner < CORNERS.length; corner += 1) {
    addConnection(store, "column_base_plate_m16_2x2", [supports[corner], legSegments[corner][0]], `base plate ${CORNERS[corner].id}`, failures);
  }

  const seen = new Set();
  for (const { primaryId, secondaryId } of secondaryConnections.filter(shouldGenerateConnectionAttempt)) {
    const key = `${primaryId}:${secondaryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    addConnection(store, "light_end_plate_m12_1x2", [primaryId, secondaryId], `end plate ${primaryId} to ${secondaryId}`, failures);
  }

  const generated = store.project();
  const denseMemberCount = addDenseLattice(generated);
  const errors = generatedConnectionErrors(generated);
  generated.model.addonData.stressTest = {
    generator: "tools/stress/generate_eiffel_tower_stress.mjs",
    landmarkApproximation: "Eiffel Tower",
    notes: [
      "Approximate model for viewer stress testing, not a fabrication model.",
      "Uses only starter profile, material, fastener, and connection presets.",
      "Dense side lattice is intentionally member-only so the viewer is stressed by beam count instead of connection generation cost.",
      "Tower outline follows a 125 m base, 57.63 m / 115.73 m / 276.13 m floor heights, and a 330 m current top height."
    ],
    denseMemberCount,
    denseVerticalPanels: DENSE_VERTICAL_PANELS,
    denseSideSegments: DENSE_SIDE_SEGMENTS,
    skippedConnectionAttempts: failures.slice(0, 120),
    skippedConnectionAttemptCount: failures.length,
    connectionDiagnosticErrors: errors
  };

  generated.model.groups.group_eiffel_tower.memberIds = Object.keys(generated.model.members);
  generated.model.groups.group_eiffel_tower.objectIds = [
    ...Object.keys(generated.model.members),
    ...Object.keys(generated.model.connections)
  ];
  generated.model.assemblies.assembly_eiffel_tower.memberIds = Object.keys(generated.model.members);
  generated.model.assemblies.assembly_eiffel_tower.connectionIds = Object.keys(generated.model.connections);
  generated.migrationHistory = [{
    id: "mig_stress_eiffel_tower_1",
    description: "Generated approximate Eiffel Tower stress model with existing connection-library presets.",
    schemaVersion: generated.schemaVersion
  }];
  patchLibraryPaths(generated);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(generated)}\n`);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
  console.log(`Members: ${Object.keys(generated.model.members).length}`);
  console.log(`Connections: ${Object.keys(generated.model.connections).length}`);
  console.log(`Skipped connection attempts: ${failures.length}`);
  console.log(`Connection diagnostic errors: ${errors.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
