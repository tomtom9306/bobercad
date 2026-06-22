const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function lineNumberAt(text, index) {
  return String(text || "").slice(0, index).split(/\r?\n/).length;
}

function moduleSpecifiers(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s*)?["']([^"']+)["']/g,
    /\bexport\s+(?:[\s\S]*?\s+from\s*)["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) specs.push(match[1]);
  }
  return specs.map((specifier) => String(specifier || "").split(/[?#]/)[0]);
}

const TRIM_STORE_METHODS = [
  "createTrimJoint",
  "updateTrimJoint",
  "updateTrimJointParticipant",
  "addTrimJointParticipant",
  "removeTrimJointParticipant",
  "addTrimJointOperation",
  "updateTrimJointOperation",
  "setTrimJointOperationMember",
  "removeTrimJointOperation"
];

function runProjectStoreRuntimeProbe(errors) {
  const script = String.raw`
import fs from "node:fs";
import { createProjectStore } from "./bobercad/app/engine/store/project-command-store.mjs";
import { deriveProjectCommandObjectIds } from "./bobercad/app/engine/store/project-command-registry.mjs";
import { addMemberSnapRelations } from "./bobercad/app/engine/store/project-store-smart-component-helpers.mjs";
import { loadSmartComponentDefinitions } from "./bobercad/app/engine/modules/smart-components/smart-component-registry.mjs";

const errors = [];
const readJson = (relative) => JSON.parse(fs.readFileSync(relative, "utf8"));
const project = readJson("./bobercad/data/projects/sample_seed_connection_structure.json");
const portalProject = readJson("./bobercad/data/projects/sample_portal_frame.json");
const profiles = readJson("./bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json").profiles;
const fasteners = readJson("./bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json").fasteners;
const materials = readJson("./bobercad/data/libraries/materials/material-libraries/starter-materials/config.json").materials;
const smartComponentCatalog = await loadSmartComponentDefinitions();
const store = createProjectStore({ project, profiles, fasteners, materials, smartComponentCatalog });
const register = readJson("./bobercad/app/engine/api/api-register.json");

const storeMethods = Object.keys(store).filter((key) => typeof store[key] === "function").sort();
const registerStoreMethods = register.apis
  .filter((entry) => String(entry.id || "").startsWith("store."))
  .map((entry) => entry.id.slice("store.".length))
  .sort();
const missingFromRegister = storeMethods.filter((name) => !registerStoreMethods.includes(name));
const missingFromStore = registerStoreMethods.filter((name) => !storeMethods.includes(name));
if (missingFromRegister.length) errors.push("store methods missing from api-register.json: " + missingFromRegister.join(", "));
if (missingFromStore.length) errors.push("api-register.json store methods missing from createProjectStore(): " + missingFromStore.join(", "));

function run(label, callback) {
  try {
    callback();
  } catch (error) {
    errors.push(label + ": " + (error.stack || error.message));
  }
}

run("store.createLevel", () => store.createLevel({ id: "contract_level", name: "Contract Level", elevation: 1234 }));
run("store.createGridSystem", () => store.createGridSystem({ id: "contract_grid" }));
run("store.deleteMember", () => store.deleteMember("beam_1"));
run("store.deleteObjects", () => {
  const deleteStore = createProjectStore({ project, profiles, fasteners, materials, smartComponentCatalog });
  const nextProject = deleteStore.deleteObjects(["end_plate_1"]);
  if (nextProject.objectIndex.end_plate_1 || nextProject.model.plates.end_plate_1) {
    throw new Error("deleted plate is still indexed");
  }
  const result = deleteStore.lastCommandResult();
  if (!result.removedObjectIds.includes("end_plate_1")) {
    throw new Error("deleteObjects did not report removed plate id");
  }
});
run("store.deleteObjects connected member cleanup", () => {
  const deleteStore = createProjectStore({ project: portalProject, profiles, fasteners, materials, smartComponentCatalog });
  const nextProject = deleteStore.deleteObjects(["side_beam_a"]);
  const result = deleteStore.lastCommandResult();
  const expectedRemoved = [
    "side_beam_a",
    "conn_side_a_start",
    "conn_side_a_end",
    "conn_cross_a",
    "end_plate_side_a_start",
    "end_plate_side_a_end",
    "end_plate_cross_a",
    "holes_side_a_start",
    "holes_side_a_end",
    "holes_cross_a",
    "fasteners_side_a_start",
    "fasteners_side_a_end",
    "fasteners_cross_a",
    "cz_side_a_start",
    "cz_side_a_end",
    "cz_cross_a"
  ];
  for (const objectId of expectedRemoved) {
    if (nextProject.objectIndex[objectId]) throw new Error(objectId + " is still indexed after deleting side_beam_a");
    if (!result.removedObjectIds.includes(objectId)) throw new Error(objectId + " was not reported as removed");
  }
  const staleConnectionParts = Object.keys(nextProject.objectIndex).filter((objectId) => (
    /^(end_plate|holes|fasteners|conn|cz)_side_a/.test(objectId)
    || objectId === "end_plate_cross_a"
    || objectId === "holes_cross_a"
    || objectId === "fasteners_cross_a"
    || objectId === "conn_cross_a"
    || objectId === "cz_cross_a"
  ));
  if (staleConnectionParts.length) throw new Error("stale side_beam_a connection objects remain: " + staleConnectionParts.join(", "));
});
run("store.deleteSmartComponent manual connection cleanup", () => {
  const deleteStore = createProjectStore({ project: portalProject, profiles, fasteners, materials, smartComponentCatalog });
  const nextProject = deleteStore.deleteSmartComponent("conn_side_a_start");
  const result = deleteStore.lastCommandResult();
  const expectedRemoved = [
    "conn_side_a_start",
    "end_plate_side_a_start",
    "holes_side_a_start",
    "fasteners_side_a_start",
    "cz_side_a_start"
  ];
  for (const objectId of expectedRemoved) {
    if (nextProject.objectIndex[objectId]) throw new Error(objectId + " is still indexed after deleting conn_side_a_start");
    if (!result.removedObjectIds.includes(objectId)) throw new Error(objectId + " was not reported as removed");
  }
});
run("addMemberSnapRelations", () => {
  const next = structuredClone(project);
  addMemberSnapRelations(next, "beam_1", {
    startSnap: {
      kind: "line",
      type: "global-axis",
      axis: "x",
      point: [0, 0, 0],
      label: "Contract X"
    }
  });
  if (!Object.values(next.model.relations || {}).some((relation) => relation.memberId === "beam_1" && relation.createdBy === "auto-snap")) {
    throw new Error("auto snap relation was not created");
  }
});
run("deriveProjectCommandObjectIds explicit metadata", () => {
  const previousProject = {
    objectIndex: { a: { collection: "members" }, b: { collection: "members" } },
    model: { members: { a: { id: "a", marker: 1 }, b: { id: "b" } } }
  };
  const nextProject = {
    objectIndex: { a: { collection: "members" }, c: { collection: "members" } },
    model: { members: { a: { id: "a", marker: 2 }, c: { id: "c" } } }
  };
  const explicit = deriveProjectCommandObjectIds(previousProject, nextProject, {
    changedObjectIds: ["a"],
    removedObjectIds: ["b"],
    regeneratedObjectIds: ["r"]
  });
  if (explicit.changedObjectIds.join(",") !== "a") throw new Error("explicit changed ids were not authoritative: " + explicit.changedObjectIds.join(","));
  if (explicit.removedObjectIds.join(",") !== "b") throw new Error("explicit removed ids were not authoritative: " + explicit.removedObjectIds.join(","));
  if (explicit.regeneratedObjectIds.join(",") !== "r") throw new Error("explicit regenerated ids were not authoritative: " + explicit.regeneratedObjectIds.join(","));
});

process.stdout.write(JSON.stringify({ errors }));
`;
  let output = "";
  try {
    output = execFileSync(process.execPath, ["--input-type=module", "-"], {
      cwd: ROOT,
      input: script,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8
    });
  } catch (error) {
    fail(errors, `project store runtime contract failed to execute: ${error.stderr || error.message}`);
    return;
  }
  let result;
  try {
    result = JSON.parse(output);
  } catch (error) {
    fail(errors, `project store runtime contract returned invalid JSON: ${error.message}: ${output}`);
    return;
  }
  for (const error of result.errors || []) fail(errors, `project store runtime contract: ${error}`);
}

function checkProjectStoreContracts(errors) {
  const commandStoreRelative = "bobercad/app/engine/store/project-command-store.mjs";
  const commandRegistryRelative = "bobercad/app/engine/store/project-command-registry.mjs";
  const trimStoreMethodsRelative = "bobercad/app/engine/store/project-store-trim-methods.mjs";
  if (!exists(commandRegistryRelative)) fail(errors, `missing required command-object registry: ${commandRegistryRelative}`);
  if (!exists(trimStoreMethodsRelative)) fail(errors, `missing required trim store methods module: ${trimStoreMethodsRelative}`);
  if (!exists(commandStoreRelative)) return;

  const storeText = fs.readFileSync(path.join(ROOT, commandStoreRelative), "utf8");
  const storeSpecifiers = moduleSpecifiers(storeText);
  if (!storeSpecifiers.includes("./project-command-registry.mjs")) {
    fail(errors, `${commandStoreRelative}: project store mutations must be executed through project-command-registry.mjs`);
  }
  if (!storeSpecifiers.includes("./project-store-trim-methods.mjs") || !storeText.includes("createTrimStoreMethods")) {
    fail(errors, `${commandStoreRelative}: trim authoring methods must be composed from project-store-trim-methods.mjs`);
  }
  for (const requiredToken of ["createProjectCommand", "executeProjectCommand", "historyState()", "undo()", "redo()"]) {
    if (!storeText.includes(requiredToken)) fail(errors, `${commandStoreRelative}: missing command-store contract token ${requiredToken}`);
  }
  for (const trimMethod of TRIM_STORE_METHODS) {
    const inlineMethod = storeText.match(new RegExp(`\\n\\s{4}${trimMethod}\\s*\\(`));
    if (inlineMethod) {
      fail(errors, `${commandStoreRelative}:${lineNumberAt(storeText, inlineMethod.index)}: ${trimMethod} belongs in ${trimStoreMethodsRelative}, not the store facade`);
    }
  }
  const forbiddenLocalSetters = storeText.match(/\b(?:setProject|setRegeneratedSmartComponent)\s*\(/);
  if (forbiddenLocalSetters) {
    fail(errors, `${commandStoreRelative}:${lineNumberAt(storeText, forbiddenLocalSetters.index)}: direct project setters are obsolete; route mutations through command objects`);
  }
  const commitTransactionMatch = storeText.match(/const\s+commitTransaction\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?createProjectCommand/);
  if (!commitTransactionMatch) fail(errors, `${commandStoreRelative}: commitTransaction must wrap transaction results in command objects`);

  const trimStoreMethodsText = exists(trimStoreMethodsRelative) ? fs.readFileSync(path.join(ROOT, trimStoreMethodsRelative), "utf8") : "";
  for (const trimMethod of TRIM_STORE_METHODS) {
    if (!trimStoreMethodsText.includes(`${trimMethod}(`)) fail(errors, `${trimStoreMethodsRelative}: missing trim authoring method ${trimMethod}`);
  }
  runProjectStoreRuntimeProbe(errors);
}

module.exports = {
  checkProjectStoreContracts
};
