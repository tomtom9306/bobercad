import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { normalizePath } from "../bobercad/app/engine/api/geometry/paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIEWER_DIR = path.join(ROOT, "bobercad", "app", "ui", "viewer");
const SETTINGS_PATH = path.join(VIEWER_DIR, "viewer-settings.json");
const DEFAULT_ARTIFACT_ROOT = path.join(ROOT, "artifacts", "stair-qa");

const STAIR_DEMOS = [
  "stair-system-straight-basic",
  "stair-system-straight-landing",
  "stair-system-l-shape",
  "stair-system-u-switchback",
  "stair-system-winder",
  "stair-system-curved",
  "stair-system-spiral",
  "stair-system-helical",
  "stair-system-mono-stringer",
  "stair-system-grating-treads",
  "stair-system-glass-rail",
  "stair-system-split-weight",
  "stair-system-manual-split",
  "stair-system-compliance-failures"
];

const REQUIRED_SCREENSHOTS = [
  "top.png",
  "axonometric.png",
  "elevation-left.png",
  "elevation-right.png"
];

const DETAIL_SCREENSHOTS = [
  "detail-base.png",
  "detail-top-slab.png",
  "detail-tread-fixing.png",
  "detail-railing.png",
  "detail-split.png"
];

function runId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const args = { runId: runId(), demos: STAIR_DEMOS, outDir: null, skipSchema: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--run-id") args.runId = argv[++index];
    else if (value === "--out-dir") args.outDir = path.resolve(argv[++index]);
    else if (value === "--demo") args.demos = [argv[++index]];
    else if (value === "--demos") args.demos = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
    else if (value === "--skip-schema") args.skipSchema = true;
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value);
}

function resolveFrom(baseFile, relativePath) {
  return path.resolve(path.dirname(baseFile), relativePath);
}

function countMap(object = {}) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, value && typeof value === "object" ? Object.keys(value).length : 0]));
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every(finiteNumber);
}

function vectorLength(a, b) {
  if (!finitePoint(a) || !finitePoint(b)) return NaN;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function addIssue(issues, severity, code, message, extra = {}) {
  issues.push({ severity, code, message, ...extra });
}

function collectionObjects(project, collection) {
  return Object.values(project.model?.[collection] || {});
}

function objectExists(project, id) {
  const entry = project.objectIndex?.[id];
  return Boolean(entry?.collection && project.model?.[entry.collection]?.[id]);
}

function findTopStair(project) {
  return Object.values(project.model?.smartComponentInstances || {}).find((instance) => (
    instance.type === "stair-system" && !instance.parentInstanceId
  )) || null;
}

function smartComponentDiagnostics(project) {
  return Object.values(project.model?.smartComponentInstances || {}).flatMap((instance) => (
    (instance.diagnostics || []).map((diagnostic) => ({
      smartComponentId: instance.id,
      type: instance.type,
      kind: instance.kind,
      health: instance.health || "ok",
      ...diagnostic
    }))
  ));
}

function stairIntent(project) {
  const top = findTopStair(project);
  const params = top?.referenceParameters || {};
  return {
    smartComponentId: top?.id || null,
    route: params.route?.type || "unknown",
    treads: params.treads?.family || "unknown",
    supports: params.supports?.family || "unknown",
    railings: params.railings?.family || "unknown",
    railingSides: params.railings?.sides || "unknown",
    connections: params.connections?.family || "unknown",
    sections: params.sections?.strategy || "none",
    compliance: params.compliance?.rulePack || "none"
  };
}

function validateObjectIndex(project, issues) {
  for (const [id, entry] of Object.entries(project.objectIndex || {})) {
    if (!entry?.collection) addIssue(issues, "error", "object-index-missing-collection", `${id}: objectIndex entry has no collection`);
    else if (!project.model?.[entry.collection]?.[id]) addIssue(issues, "error", "object-index-target-missing", `${id}: objectIndex points to missing ${entry.collection}`);
  }
  for (const [collection, objects] of Object.entries(project.model || {})) {
    if (!objects || typeof objects !== "object" || Array.isArray(objects)) continue;
    for (const id of Object.keys(objects)) {
      if (!project.objectIndex?.[id] && collection !== "addonData") addIssue(issues, "warning", "object-not-indexed", `${id}: ${collection} object is not in objectIndex`);
    }
  }
}

function validateMembers(project, issues) {
  for (const member of collectionObjects(project, "members")) {
    if (!finitePoint(member.start) || !finitePoint(member.end)) {
      addIssue(issues, "error", "member-invalid-axis", `${member.id}: member start/end is not finite`);
      continue;
    }
    if (vectorLength(member.start, member.end) < 1) addIssue(issues, "error", "member-zero-length", `${member.id}: member length is below 1mm`);
    if (member.centerline) {
      try {
        normalizePath(member.centerline);
      } catch (error) {
        addIssue(issues, "error", "member-invalid-centerline", `${member.id}: invalid centerline (${error.message})`);
      }
    }
  }
}

function validatePlates(project, issues) {
  for (const plate of collectionObjects(project, "plates")) {
    for (const field of ["center", "normal", "localAxisY", "localAxisZ"]) {
      if (!finitePoint(plate[field])) addIssue(issues, "error", "plate-invalid-frame", `${plate.id}: plate ${field} is not finite`);
    }
    if (!finiteNumber(plate.thickness) || plate.thickness <= 0) addIssue(issues, "error", "plate-invalid-thickness", `${plate.id}: plate thickness must be positive`);
    if (!plate.outline && (!finiteNumber(plate.width) || !finiteNumber(plate.height) || plate.width <= 0 || plate.height <= 0)) {
      addIssue(issues, "error", "plate-invalid-shape", `${plate.id}: plate needs positive width/height or outline`);
    }
    if (plate.outline && (!Array.isArray(plate.outline) || plate.outline.length < 3)) addIssue(issues, "error", "plate-invalid-outline", `${plate.id}: outline has fewer than 3 points`);
  }
}

function validateHolePatterns(project, issues) {
  for (const pattern of collectionObjects(project, "holePatterns")) {
    if (!Array.isArray(pattern.positions) || !pattern.positions.length) addIssue(issues, "error", "hole-pattern-empty", `${pattern.id}: no positions`);
    for (const position of pattern.positions || []) {
      if (!Array.isArray(position) || position.length < 2 || !position.every(finiteNumber)) {
        addIssue(issues, "error", "hole-pattern-invalid-position", `${pattern.id}: invalid hole position`);
        break;
      }
    }
  }
}

function validateFasteners(project, issues) {
  for (const group of collectionObjects(project, "fastenerGroups")) {
    if (!group.fastenerRef) addIssue(issues, "error", "fastener-missing-ref", `${group.id}: fastener group has no fastenerRef`);
    if (group.holePatternRef && !project.model?.holePatterns?.[group.holePatternRef]) addIssue(issues, "error", "fastener-missing-hole-pattern", `${group.id}: missing holePatternRef ${group.holePatternRef}`);
    for (const participant of group.participants || []) {
      if (!objectExists(project, participant)) addIssue(issues, "error", "fastener-missing-participant", `${group.id}: missing participant ${participant}`);
    }
    const axis = group.orientation?.axis;
    if (axis && !finitePoint(axis)) addIssue(issues, "error", "fastener-invalid-axis", `${group.id}: invalid orientation axis`);
  }
}

function validateNestedSmartComponents(project, issues) {
  const top = findTopStair(project);
  if (!top) {
    addIssue(issues, "error", "stair-top-missing", "top-level stair-system Smart Component is missing");
    return;
  }
  for (const role of ["support", "treads", "connections"]) {
    if (!top.childComponentRoles?.[role] && !top.objectRoles?.[role]) addIssue(issues, "error", "stair-child-missing", `${top.id}: missing child role ${role}`);
  }
  for (const id of flattenIds(top.objectRoles)) {
    const child = project.model?.smartComponentInstances?.[id];
    if (child && child.parentInstanceId !== top.id) addIssue(issues, "error", "stair-child-parent-mismatch", `${child.id}: parentInstanceId should be ${top.id}`);
  }
}

function dot2(point, axis) {
  return point[0] * axis[0] + point[1] * axis[1];
}

function unit2(axis) {
  if (!Array.isArray(axis) || axis.length < 2 || !finiteNumber(axis[0]) || !finiteNumber(axis[1])) return null;
  const length = Math.hypot(axis[0], axis[1]);
  if (length <= 1e-6) return null;
  return [axis[0] / length, axis[1] / length];
}

function platePlanRect(plate) {
  if (!finitePoint(plate.center) || !finitePoint(plate.localAxisY) || !finitePoint(plate.localAxisZ)) return null;
  if (!finiteNumber(plate.width) || !finiteNumber(plate.height)) return null;
  const yAxis = unit2(plate.localAxisY);
  const zAxis = unit2(plate.localAxisZ);
  if (!yAxis || !zAxis) return null;
  return {
    center: [plate.center[0], plate.center[1]],
    axes: [yAxis, zAxis],
    half: [plate.width / 2, plate.height / 2]
  };
}

function projectRect(rect, axis) {
  const center = dot2(rect.center, axis);
  const radius = rect.half[0] * Math.abs(dot2(rect.axes[0], axis)) + rect.half[1] * Math.abs(dot2(rect.axes[1], axis));
  return [center - radius, center + radius];
}

function rectPlanOverlap(a, b, tolerance = 80) {
  for (const axis of [...a.axes, ...b.axes]) {
    const [aMin, aMax] = projectRect(a, axis);
    const [bMin, bMax] = projectRect(b, axis);
    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
    if (overlap <= tolerance) return false;
  }
  return true;
}

function validateLandingFootprints(project, issues, demoId) {
  const landings = collectionObjects(project, "plates").filter((plate) => plate.placementIntent?.role === "stair-landing");
  if (!landings.length) return;
  const treadPlates = collectionObjects(project, "plates").filter((plate) => {
    const type = String(plate.type || "").toLowerCase();
    const role = String(plate.placementIntent?.role || "").toLowerCase();
    return type.includes("tread")
      && !type.includes("cleat")
      && !type.includes("wood")
      && !type.includes("timber")
      && !role.includes("wood")
      && !role.includes("timber");
  });
  for (const landing of landings) {
    const landingRect = platePlanRect(landing);
    if (!landingRect) continue;
    for (const tread of treadPlates) {
      const treadRect = platePlanRect(tread);
      if (treadRect && rectPlanOverlap(landingRect, treadRect)) {
        addIssue(issues, "error", "tread-overlaps-landing-footprint", `${demoId}: ${tread.id} footprint overlaps landing footprint ${landing.id}`);
      }
    }
  }
}

function validateReusableConnectionKinds(project, issues, demoId) {
  const legacyConnectionTypes = new Set(["stair-hardware", "tread-to-stringer", "stringer-splice", "stringer-base", "rail-post-base"]);
  const instances = collectionObjects(project, "smartComponentInstances");
  for (const instance of instances) {
    const sourceId = instance.sourceComponent?.id;
    if (instance.kind === "component-connection" || instance.kind === "stair-connection" || legacyConnectionTypes.has(instance.type) || legacyConnectionTypes.has(sourceId)) {
      addIssue(issues, "error", "stair-only-connection-component", `${demoId}: ${instance.id} still uses legacy stair-only connection component/type/kind`);
    }
  }

  const top = findTopStair(project);
  const connectionChildren = instances.filter((instance) => (
    instance.parentInstanceId === top?.id && ["connections", "sectionSplices"].includes(instance.parentRole)
  ));
  for (const instance of connectionChildren) {
    if (instance.kind !== "connection") {
      addIssue(issues, "error", "nested-connection-kind-invalid", `${demoId}: ${instance.id} must use kind=connection`);
    }
    const zoneId = instance.inputs?.connectionZoneId;
    const zone = zoneId ? project.model?.connectionZones?.[zoneId] : null;
    if (!zone) {
      addIssue(issues, "error", "nested-connection-zone-missing", `${demoId}: ${instance.id} has no stored connectionZone`);
      continue;
    }
    if (!Array.isArray(zone.interfaceIds) || !zone.interfaceIds.length) {
      addIssue(issues, "error", "nested-connection-interfaces-missing", `${demoId}: ${zone.id} has no interfaces`);
    }
    if (!(zone.smartComponentInstanceIds || []).includes(instance.id)) {
      addIssue(issues, "error", "nested-connection-zone-backref-missing", `${demoId}: ${zone.id} does not reference ${instance.id}`);
    }
    if (!Array.isArray(zone.objectIds) || !zone.objectIds.length) {
      addIssue(issues, "error", "nested-connection-zone-empty", `${demoId}: ${zone.id} has no generated connection objectIds`);
    }
  }

  if (top && stairIntent(project).connections !== "none" && !connectionChildren.some((instance) => instance.type === "standard-hardware")) {
    addIssue(issues, "error", "standard-hardware-connection-missing", `${demoId}: stair system must select standard-hardware instead of stair-only connection families`);
  }
}

function validateRolledCurvedSupports(project, issues, demoId, intent) {
  const expectedType = {
    winder: "helix",
    curved: "helix",
    spiral: "helix",
    helical: "helix"
  }[intent.route];
  if (!expectedType) return;

  const supportMembers = collectionObjects(project, "members").filter((member) => (
    member.type === "stair-stringer" || member.type === "stair-mono-stringer"
  ));
  if (!supportMembers.length) {
    addIssue(issues, "error", "curved-supports-missing", `${demoId}: no rolled support stringers found for ${intent.route}`);
    return;
  }

  const expectedMax = intent.supports === "twin-stringer" ? 2 : 1;
  if (supportMembers.length > expectedMax) {
    addIssue(issues, "error", "curved-supports-segmented", `${demoId}: ${intent.route} has ${supportMembers.length} support stringers; expected at most ${expectedMax} semantic rolled member(s)`);
  }

  for (const member of supportMembers) {
    if (member.centerline?.type !== expectedType) {
      addIssue(issues, "error", "curved-support-centerline-missing", `${member.id}: ${intent.route} support must use centerline.type=${expectedType}`);
    }
    if (member.centerline?.representation !== "analytic-centerline") {
      addIssue(issues, "error", "curved-support-centerline-not-analytic", `${member.id}: ${intent.route} support must store an analytic centerline representation`);
    }
    const expectedFamily = expectedType === "helix" ? "circular-helix" : "circular-arc";
    if (member.centerline?.math?.family !== expectedFamily) {
      addIssue(issues, "error", "curved-support-centerline-math-missing", `${member.id}: ${intent.route} support must store centerline.math.family=${expectedFamily}`);
    }
    if (member.fabrication?.process !== "rolled") {
      addIssue(issues, "warning", "curved-support-not-marked-rolled", `${member.id}: curved support should be marked fabrication.process=rolled`);
    }
    if (member.fabrication?.centerlineMath?.family !== expectedFamily) {
      addIssue(issues, "warning", "curved-support-fabrication-math-missing", `${member.id}: rolled fabrication metadata should reference ${expectedFamily}`);
    }
  }
}

function validateRolledCurvedRailings(project, issues, demoId, intent) {
  const expectedType = {
    winder: "helix",
    curved: "helix",
    spiral: "helix",
    helical: "helix"
  }[intent.route];
  if (!expectedType || intent.railings === "none" || intent.railings === "wall-handrail") return;
  const railMembers = collectionObjects(project, "members").filter((member) => (
    member.placementIntent?.role === "handrail" || member.placementIntent?.role === "guardrail-infill-rail"
  ));
  if (!railMembers.length) {
    addIssue(issues, "error", "curved-railing-members-missing", `${demoId}: no railing rail members found for ${intent.route}`);
    return;
  }
  for (const member of railMembers) {
    if (member.centerline?.type !== expectedType) {
      addIssue(issues, "error", "curved-railing-centerline-missing", `${member.id}: ${intent.route} railing rail must use centerline.type=${expectedType}, not short straight segments`);
    }
    if (member.centerline?.representation !== "analytic-centerline") {
      addIssue(issues, "error", "curved-railing-centerline-not-analytic", `${member.id}: ${intent.route} railing rail must store an analytic centerline representation`);
    }
    if (member.centerline?.math?.family !== "circular-helix") {
      addIssue(issues, "error", "curved-railing-centerline-math-missing", `${member.id}: ${intent.route} railing rail must store circular-helix math metadata`);
    }
  }
}

function validateRailingPlan(project, issues, demoId, intent) {
  if (!["l-landing", "u-switchback"].includes(intent.route)) return;

  const cornerRails = collectionObjects(project, "members").filter((member) => (
    member.type === "stair-handrail" || member.type === "stair-guardrail"
  ));
  for (const rail of cornerRails) {
    const dx = Math.abs(rail.end[0] - rail.start[0]);
    const dy = Math.abs(rail.end[1] - rail.start[1]);
    const dz = Math.abs(rail.end[2] - rail.start[2]);
    if (dx > 180 && dy > 180 && dz < 30) {
      addIssue(issues, "error", "railing-diagonal-landing-corner", `${demoId}: ${rail.id} cuts diagonally across a landing corner`);
    }
  }

  const railsByRun = new Map();
  for (const rail of cornerRails) {
    const side = rail.placementIntent?.side || "unknown";
    const role = rail.placementIntent?.role || rail.type;
    const railIndex = Number.isFinite(rail.placementIntent?.railIndex) ? rail.placementIntent.railIndex : "top";
    const key = `${side}:${role}:${railIndex}`;
    const run = railsByRun.get(key) || [];
    run.push(rail);
    railsByRun.set(key, run);
  }
  for (const rails of railsByRun.values()) {
    rails.sort((a, b) => (a.placementIntent?.spanIndex ?? 0) - (b.placementIntent?.spanIndex ?? 0));
    for (let index = 1; index < rails.length; index += 1) {
      const previous = rails[index - 1];
      const next = rails[index];
      const gap = Math.hypot(
        next.start[0] - previous.end[0],
        next.start[1] - previous.end[1],
        next.start[2] - previous.end[2]
      );
      if (gap > 8) {
        addIssue(issues, "error", "railing-visible-gap", `${demoId}: ${previous.id} to ${next.id} leaves a ${gap.toFixed(1)}mm visible gap in the railing run`);
      }
    }
  }

  const postsByLocation = new Map();
  const posts = collectionObjects(project, "members").filter((member) => member.type === "stair-rail-post");
  for (const post of posts) {
    const side = post.placementIntent?.side || "unknown";
    const key = `${side}:${post.start.map((value) => Math.round(value / 5) * 5).join(",")}`;
    if (postsByLocation.has(key)) {
      addIssue(issues, "error", "duplicate-railing-post-location", `${demoId}: ${post.id} duplicates railing post ${postsByLocation.get(key)} at the same plan/elevation location`);
    } else {
      postsByLocation.set(key, post.id);
    }
  }

  if (intent.railings !== "none") {
    const handrails = collectionObjects(project, "members").filter((member) => member.placementIntent?.role === "handrail");
    const handrailEndMiters = new Set(collectionObjects(project, "trimJoints")
      .flatMap((trimJoint) => trimJoint.operations || [])
      .filter((operation) => operation.type === "end-miter")
      .flatMap((operation) => [
        `${operation.memberAId}:${operation.memberAEnd}`,
        `${operation.memberBId}:${operation.memberBEnd}`
      ]));
    const cornerTrims = collectionObjects(project, "trimJoints").filter((trimJoint) => (
      trimJoint.type === "corner-trim" && trimJoint.placementIntent?.role === "railing-corner-trim"
    ));
    const postTrims = collectionObjects(project, "trimJoints").filter((trimJoint) => (
      trimJoint.type === "corner-trim" && trimJoint.placementIntent?.role === "railing-post-trim"
    ));
    if (!cornerTrims.length) {
      addIssue(issues, "error", "railing-corner-trims-missing", `${demoId}: landing railing corners should be represented by trimJoints`);
    }
    if (!postTrims.length) {
      addIssue(issues, "error", "railing-post-trims-missing", `${demoId}: railing members should be trimmed to rail posts with trimJoints`);
    }
    for (const trimJoint of cornerTrims) {
      const operation = trimJoint.operations?.[0];
      if (operation?.type !== "end-miter") {
        addIssue(issues, "error", "railing-corner-trim-operation", `${trimJoint.id}: railing corner trim should use end-miter`);
      }
    }
    for (const trimJoint of postTrims) {
      const operation = trimJoint.operations?.[0];
      if (operation?.type !== "end-butt-1") {
        addIssue(issues, "error", "railing-post-trim-operation", `${trimJoint.id}: railing post trim should use end-butt-1`);
      }
    }
    for (const handrail of handrails) {
      const dz = handrail.end[2] - handrail.start[2];
      const plan = Math.hypot(handrail.end[0] - handrail.start[0], handrail.end[1] - handrail.start[1]);
      if (Math.abs(dz) <= 1 || plan <= 1) continue;
      for (const memberEnd of ["start", "end"]) {
        const point = handrail[memberEnd];
        const connectsToAnotherHandrail = handrails.some((other) => (
          other.id !== handrail.id && (vectorLength(other.start, point) <= 8 || vectorLength(other.end, point) <= 8)
        ));
        if (!connectsToAnotherHandrail && !handrailEndMiters.has(`${handrail.id}:${memberEnd}`)) {
          addIssue(issues, "error", "member-end-miter-trim-missing", `${handrail.id}: open sloped ${memberEnd} end should use a standard end-miter trim joint`);
        }
      }
    }
  }
}

function validateStairTrimCallouts(project, scene, issues, demoId) {
  const trimJoints = collectionObjects(project, "trimJoints");
  const stairTrimJoints = trimJoints.filter((trimJoint) => {
    const role = String(trimJoint.placementIntent?.role || "").toLowerCase();
    const fabrication = String(trimJoint.fabrication?.operation || "").toLowerCase();
    return role.includes("railing") || role.includes("stair") || fabrication.includes("railing") || fabrication.includes("stair");
  });
  if (!stairTrimJoints.length) return;

  for (const trimJoint of stairTrimJoints) {
    if (trimJoint.display?.visible === false) {
      addIssue(issues, "error", "stair-trim-callout-hidden", `${trimJoint.id}: stair trimJoint is display.visible=false, which suppresses its trim callout`);
    }
  }

  const enabledOperationCount = stairTrimJoints
    .flatMap((trimJoint) => trimJoint.operations || [])
    .filter((operation) => operation.enabled !== false)
    .length;
  if (!enabledOperationCount) return;
  const trimCalloutCount = (scene.callouts || []).filter((callout) => callout.collection === "trimJoints").length;
  if (!trimCalloutCount) {
    addIssue(issues, "error", "stair-trim-callouts-missing", `${demoId}: stair trimJoints exist but buildScene produced no trim callouts`);
  }
}

function validateStairSpecific(project, issues, demoId) {
  const top = findTopStair(project);
  const intent = stairIntent(project);
  const expectedFailure = demoId === "stair-system-compliance-failures";
  if (top) {
    const health = top.health || "ok";
    if (expectedFailure && health !== "error") addIssue(issues, "error", "expected-compliance-error-missing", `${demoId}: expected top-level health=error`);
    if (!expectedFailure && health !== "ok") addIssue(issues, "error", "unexpected-stair-health", `${demoId}: expected health=ok, got ${health}`);
  }

  const treadPlates = collectionObjects(project, "plates").filter((plate) => {
    const role = String(plate.placementIntent?.role || "");
    return ["stair-steel-tray-tread", "stair-wood-tread-board"].includes(role);
  });
  if (!treadPlates.length) addIssue(issues, "error", "stair-treads-missing", `${demoId}: no tread plates found`);
  for (const plate of treadPlates) {
    if (finitePoint(plate.normal) && Math.abs(plate.normal[2]) < 0.8) addIssue(issues, "warning", "stair-tread-not-horizontal", `${plate.id}: tread normal is not close to vertical`);
  }

  const railPosts = collectionObjects(project, "members").filter((member) => member.type === "stair-rail-post");
  for (const post of railPosts) {
    const dx = Math.abs(post.end[0] - post.start[0]);
    const dy = Math.abs(post.end[1] - post.start[1]);
    const dz = Math.abs(post.end[2] - post.start[2]);
    if (dx > 1 || dy > 1 || dz < 100) addIssue(issues, "warning", "railing-post-not-vertical", `${post.id}: rail post is not vertical`);
  }

  const splitDemo = demoId.includes("split");
  if (splitDemo) {
    const splicePlates = collectionObjects(project, "plates").filter((plate) => String(plate.type || "").includes("splice"));
    if (!splicePlates.length) addIssue(issues, "error", "split-splice-missing", `${demoId}: split variant has no splice plates`);
    const splitTrims = collectionObjects(project, "trimJoints").filter((trimJoint) => (
      trimJoint.placementIntent?.role === "member-splice-section-break"
      || trimJoint.fabrication?.operation === "member-splice-section-break"
    ));
    if (!splitTrims.length) {
      addIssue(issues, "error", "split-member-trim-missing", `${demoId}: split variant has splice plates but no standard trimJoint section break`);
    }
    for (const trimJoint of splitTrims) {
      const operation = trimJoint.operations?.[0];
      if (operation?.type !== "plane-trim" || operation.referencePlaneIds?.length !== 2 || !operation.removedRegionKeys?.length) {
        addIssue(issues, "error", "split-member-trim-invalid", `${trimJoint.id}: member splice section break must use plane-trim with two reference planes and an explicit removed region`);
      }
    }
  }

  validateRolledCurvedSupports(project, issues, demoId, intent);
  validateRolledCurvedRailings(project, issues, demoId, intent);
  validateRailingPlan(project, issues, demoId, intent);
  validateReusableConnectionKinds(project, issues, demoId);
  validateLandingFootprints(project, issues, demoId);
}

function validateScene(scene, issues) {
  const renderableCount = scene.faces.length + scene.lines.length + (scene.memberInstances?.length || 0);
  if (renderableCount <= 0) addIssue(issues, "error", "scene-empty", "buildScene produced no renderable geometry");
  const points = [
    ...scene.faces.flatMap((face) => face.points || []),
    ...scene.lines.flatMap((line) => line.points || []),
    ...(scene.memberInstances || []).flatMap((instance) => [instance.start, instance.axisX, instance.axisY, instance.axisZ])
  ];
  const invalid = points.filter((point) => !finitePoint(point));
  if (invalid.length) addIssue(issues, "error", "scene-invalid-points", `scene contains ${invalid.length} invalid points`);
}

function schemaValidation(projectFile, skipSchema) {
  if (skipSchema) return { skipped: true, ok: true };
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate_json_schema.js"), projectFile], {
    cwd: ROOT,
    encoding: "utf8"
  });
  return {
    skipped: false,
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

async function loadVariant(settings, demoId) {
  const demo = settings.project?.demos?.[demoId];
  if (!demo?.path) throw new Error(`${demoId}: missing viewer-settings demo path`);
  const projectFile = resolveFrom(SETTINGS_PATH, demo.path);
  const project = await readJson(projectFile);
  const profilesFile = resolveFrom(projectFile, project.libraries.profiles.path);
  const fastenersFile = resolveFrom(projectFile, project.libraries.fasteners.path);
  const [profiles, fasteners] = await Promise.all([readJson(profilesFile), readJson(fastenersFile)]);
  return { demoId, demo, projectFile, profilesFile, fastenersFile, project, profiles, fasteners };
}

function viewUrl(demoId, runId) {
  return `http://127.0.0.1:8765/bobercad/app/ui/viewer/index.html?demo=${encodeURIComponent(demoId)}&run=${encodeURIComponent(runId)}`;
}

function reviewRequest({ demoId, intent, status, runId }) {
  const screenshots = [...REQUIRED_SCREENSHOTS, ...DETAIL_SCREENSHOTS].map((name) => `- screenshots/${name}`).join("\n");
  return `# Stair QA Review Request: ${demoId}

Run: ${runId}
Viewer URL: ${viewUrl(demoId, runId)}

## Intencja

- route: ${intent.route}
- treads: ${intent.treads}
- supports: ${intent.supports}
- railings: ${intent.railings}
- railing sides: ${intent.railingSides}
- connections: ${intent.connections}
- sections: ${intent.sections}
- compliance: ${intent.compliance}

## Screenshoty do oceny

${screenshots}

## Automatyczne statusy

- schema: ${status.schema.ok ? "PASS" : "FAIL"}
- model: ${status.model.ok ? "PASS" : "FAIL"}
- scene: ${status.scene.ok ? "PASS" : "FAIL"}
- diagnostics: ${status.diagnostics.ok ? "PASS" : "FAIL"}
- screenshots: ${status.screenshots.status}
- subagent review: ${status.subagent.status}
- uncertainty: ${status.uncertainty?.status || "UNKNOWN"}

## Pytania / niepewnosci do rozstrzygniecia

${(status.uncertainty?.questions || []).length ? status.uncertainty.questions.map((question) => `- ${question}`).join("\n") : "- Brak automatycznie wykrytych pytan."}

## Rubryka subagenta

1. Geometria: PASS/FAIL + uwagi. FAIL jezeli elementy sie przecinaja, wisza bez podparcia, sa zdublowane, znikaja albo skala jest nielogiczna.
2. Stopnie/supporty/landingi: PASS/FAIL + uwagi. FAIL jezeli zaokraglone/spiralne supporty lub porecze wygladaja jak poskladane z prostych segmentow zamiast analitycznej helisy.
3. Polaczenia/mocowania: PASS/FAIL + uwagi. FAIL jezeli mocowania sa stair-only semantycznie, nie maja connection zone/interface, unosza sie poza hostem albo nie trafiaja w support/tread/rail.
4. Balustrada: PASS/FAIL + uwagi. FAIL jezeli slupki, porecze lub panele nachodza na bieg, przecinaja stopnie albo koncza sie poza logicznym zakresem.
5. Sekcje/splity, jesli dotyczy: PASS/FAIL/NA + uwagi. FAIL jezeli splice plates nie sa przy realnym podziale albo sa losowo rozmieszczone.
6. Ogolny realizm wykonawczy: PASS/FAIL + uwagi. FAIL jezeli komponent nie wyglada jak wykonalna konstrukcja warsztatowa.

Final: PASS tylko gdy wszystkie wymagane rubryki sa PASS albo NA z uzasadnieniem.
`;
}

function modelSummary(project, scene, variant, schema) {
  const top = findTopStair(project);
  return {
    demoId: variant.demoId,
    projectFile: path.relative(ROOT, variant.projectFile).replace(/\\/g, "/"),
    projectName: project.project?.name,
    intent: stairIntent(project),
    counts: countMap(project.model),
    objectIndexCount: Object.keys(project.objectIndex || {}).length,
    topSmartComponent: top ? {
      id: top.id,
      type: top.type,
      kind: top.kind,
      health: top.health || "ok",
      childComponentRoles: top.childComponentRoles || {},
      objectRoleCount: Object.keys(top.objectRoles || {}).length,
      ownedObjectCount: (top.ownedObjectIds || []).length
    } : null,
    scene: {
      faces: scene.faces.length,
      lines: scene.lines.length,
      memberInstances: scene.memberInstances?.length || 0,
      bounds: scene.bounds
    },
    schema
  };
}

async function screenshotStatus(screenshotDir) {
  const existing = [];
  const missing = [];
  for (const name of REQUIRED_SCREENSHOTS) {
    try {
      const stat = await fs.stat(path.join(screenshotDir, name));
      if (stat.size > 0) existing.push(name);
      else missing.push(name);
    } catch {
      missing.push(name);
    }
  }
  return {
    status: missing.length ? "NEEDS_CAPTURE" : "CAPTURED",
    required: REQUIRED_SCREENSHOTS,
    details: DETAIL_SCREENSHOTS,
    existing,
    missing
  };
}

async function subagentStatus(variantDir) {
  try {
    const content = await fs.readFile(path.join(variantDir, "subagent-review.md"), "utf8");
    if (/FINAL:\s*PASS/i.test(content)) return { status: "PASS" };
    if (/FINAL:\s*FAIL/i.test(content)) return { status: "FAIL" };
    return { status: "REVIEW_FILE_UNDECIDED" };
  } catch {
    return { status: "NEEDS_REVIEW" };
  }
}

function uncertaintyQuestions({ demoId, screenshots, subagent, issues, diagnostics }) {
  const questions = [];
  if (screenshots.status !== "CAPTURED") {
    questions.push(`${demoId}: capture missing required screenshots (${screenshots.missing.join(", ")}) before approving visual geometry.`);
  }
  if (subagent.status === "NEEDS_REVIEW") {
    questions.push(`${demoId}: visual review is missing; ask reviewer to inspect geometry, rail continuity, trims, fastener alignment and fabrication realism.`);
  } else if (subagent.status === "REVIEW_FILE_UNDECIDED") {
    questions.push(`${demoId}: visual review exists but has no FINAL PASS/FAIL; ask reviewer to make an explicit decision.`);
  }
  const warnings = issues.filter((issue) => issue.severity === "warning");
  if (warnings.length && subagent.status !== "PASS") {
    const codes = [...new Set(warnings.map((issue) => issue.code))].slice(0, 6).join(", ");
    questions.push(`${demoId}: model warnings need an explicit accept/fix decision (${codes}).`);
  }
  const diagnosticWarnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  if (diagnosticWarnings.length && subagent.status !== "PASS") {
    const codes = [...new Set(diagnosticWarnings.map((diagnostic) => diagnostic.code))].slice(0, 6).join(", ");
    questions.push(`${demoId}: component diagnostics include warnings that need review (${codes}).`);
  }
  return questions;
}

async function statusFromIssues(schema, issues, diagnostics, screenshotDir, variantDir, demoId) {
  const modelErrors = issues.filter((issue) => issue.severity === "error");
  const diagnosticErrors = diagnostics.filter((item) => item.severity === "error");
  const screenshots = await screenshotStatus(screenshotDir);
  const subagent = await subagentStatus(variantDir);
  const expectedDiagnosticErrors = demoId === "stair-system-compliance-failures";
  const diagnosticsOk = expectedDiagnosticErrors ? diagnosticErrors.length > 0 : diagnosticErrors.length === 0;
  const baseOk = modelErrors.length === 0 && schema.ok && diagnosticsOk;
  const questions = uncertaintyQuestions({ demoId, screenshots, subagent, issues, diagnostics });
  const final = baseOk && screenshots.status === "CAPTURED" && subagent.status === "PASS" && questions.length === 0 ? "PASS" : "FAIL";
  return {
    schema: { ok: schema.ok, skipped: schema.skipped || false },
    model: { ok: modelErrors.length === 0, errors: modelErrors.length, warnings: issues.length - modelErrors.length },
    scene: { ok: !modelErrors.some((issue) => issue.code.startsWith("scene-")) },
    diagnostics: { ok: diagnosticsOk, errors: diagnosticErrors.length, warnings: diagnostics.length - diagnosticErrors.length, expectedErrors: expectedDiagnosticErrors },
    screenshots,
    subagent,
    uncertainty: {
      status: questions.length ? "QUESTIONS_REQUIRED" : "CLEAR",
      questions
    },
    final
  };
}

async function processVariant(args, settings, buildScene, demoId, runDir) {
  const variant = await loadVariant(settings, demoId);
  const schema = schemaValidation(variant.projectFile, args.skipSchema);
  const scene = buildScene(variant.project, variant.profiles, variant.fasteners, settings);
  const variantDir = path.join(runDir, "variants", demoId);
  const screenshotDir = path.join(variantDir, "screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });
  const issues = [];
  validateObjectIndex(variant.project, issues);
  validateMembers(variant.project, issues);
  validatePlates(variant.project, issues);
  validateHolePatterns(variant.project, issues);
  validateFasteners(variant.project, issues);
  validateNestedSmartComponents(variant.project, issues);
  validateStairSpecific(variant.project, issues, demoId);
  validateScene(scene, issues);
  validateStairTrimCallouts(variant.project, scene, issues, demoId);
  if (!schema.ok) addIssue(issues, "error", "schema-validation-failed", `${demoId}: schema validation failed`);
  const diagnostics = smartComponentDiagnostics(variant.project);
  const status = await statusFromIssues(schema, issues, diagnostics, screenshotDir, variantDir, demoId);
  await writeJson(path.join(variantDir, "project.json"), variant.project);
  await writeJson(path.join(variantDir, "model-summary.json"), modelSummary(variant.project, scene, variant, schema));
  await writeJson(path.join(variantDir, "diagnostics.json"), { diagnostics, issues });
  await writeJson(path.join(variantDir, "status.json"), status);
  await writeText(path.join(variantDir, "review-request.md"), reviewRequest({ demoId, intent: stairIntent(variant.project), status, runId: args.runId }));
  return {
    demoId,
    projectFile: path.relative(ROOT, variant.projectFile).replace(/\\/g, "/"),
    viewerUrl: viewUrl(demoId, args.runId),
    status,
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    diagnosticCount: diagnostics.length
  };
}

function summaryMarkdown(args, results) {
  const rows = results.map((result) => (
    `| ${result.demoId} | ${result.status.schema.ok ? "PASS" : "FAIL"} | ${result.status.model.ok ? "PASS" : "FAIL"} | ${result.status.scene.ok ? "PASS" : "FAIL"} | ${result.status.diagnostics.ok ? "PASS" : "FAIL"} | ${result.status.screenshots.status} | ${result.status.subagent.status} | ${result.status.final} |`
  )).join("\n");
  const allPass = results.every((result) => result.status.final === "PASS");
  const followUp = allPass
    ? `## Completed

- All required screenshots are captured.
- All saved visual reviews are PASS.
- Schema, model, scene, diagnostics, screenshot, and review gates are PASS.
`
    : `## Next Required Work

- Capture all required screenshots into each variant screenshots folder.
- Send each review-request.md with screenshots to a subagent.
- Save each response as subagent-review.md.
- Update status.json final to PASS only after subagent PASS and screenshots exist.
`;
  return `# Stair QA Summary

Run: ${args.runId}

Final status: ${allPass ? "ALL STAIR VARIANTS PASS" : "NOT COMPLETE"}

| Variant | Schema | Model | Scene | Diagnostics | Screenshots | Subagent | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

${followUp}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const settings = await readJson(SETTINGS_PATH);
  const unknownDemos = args.demos.filter((demoId) => !settings.project?.demos?.[demoId]);
  if (unknownDemos.length) throw new Error(`unknown demo ids: ${unknownDemos.join(", ")}`);
  const runDir = args.outDir || path.join(DEFAULT_ARTIFACT_ROOT, args.runId);
  await fs.mkdir(runDir, { recursive: true });
  const { buildScene } = await import(pathToFileURL(path.join(ROOT, "bobercad", "app", "rendering", "scene", "build-scene.mjs")).href);
  const results = [];
  for (const demoId of args.demos) {
    const result = await processVariant(args, settings, buildScene, demoId, runDir);
    results.push(result);
    console.log(`${demoId}: ${result.status.final}`);
  }
  await writeJson(path.join(runDir, "manifest.json"), {
    runId: args.runId,
    createdAt: new Date().toISOString(),
    viewerBaseUrl: "http://127.0.0.1:8765/bobercad/app/ui/viewer/index.html",
    demos: results
  });
  await writeText(path.join(runDir, "summary.md"), summaryMarkdown(args, results));
  const failed = results.filter((result) => result.status.schema.ok === false || result.status.model.ok === false || result.status.scene.ok === false || result.status.final !== "PASS");
  console.log(`wrote ${path.relative(ROOT, runDir).replace(/\\/g, "/")}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
