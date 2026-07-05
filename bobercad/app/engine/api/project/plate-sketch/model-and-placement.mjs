import { finitePositiveNumber } from "../../../core/math.mjs";
import { addIndexedObject, nextObjectId } from "../objects.mjs";
import { plateBends } from "./model-accessors.mjs";
import { normalizeBend } from "./bend-normalization.mjs";
import { normalizePlateCornerReliefs, normalizePlateReliefDefaults, plateBendCorners } from "./corner-reliefs.mjs";
import {
  cleanOutline,
  fail,
  normalizeSketch,
  normalized,
  optionalObject,
  optionalString,
  outlineFromSketch,
  sketchSource,
  vec3
} from "./sketch-geometry-and-relations.mjs";

export function normalizeSketchPlacement(object, fallbackId) {
  const label = object.id || fallbackId;
  return {
    ...object,
    center: vec3(object.center, `${label}.center`),
    normal: normalized(vec3(object.normal, `${label}.normal`), `${label}.normal`),
    localAxisY: normalized(vec3(object.localAxisY, `${label}.localAxisY`), `${label}.localAxisY`),
    localAxisZ: normalized(vec3(object.localAxisZ, `${label}.localAxisZ`), `${label}.localAxisZ`)
  };
}

export function normalizeSketchObject(sketchObject) {
  if (!sketchObject || typeof sketchObject !== "object") fail("sketch object must be an object");
  if (sketchObject.type !== "plate-sketch") fail(`${sketchObject.id || "sketch"} type must be plate-sketch`);
  const sketch = normalizeSketch(sketchObject.sketch);
  outlineFromSketch(sketch);
  return normalizeSketchPlacement({
    ...sketchObject,
    sketch
  }, "sketch");
}


export function normalizePlate(plate) {
  if (!plate || typeof plate !== "object") fail("plate must be an object");
  const sketch = normalizeSketch(plate.sketch);
  outlineFromSketch(sketch);
  const next = normalizeSketchPlacement({
    ...plate,
    sketch
  }, "plate");
  if (!finitePositiveNumber(next.thickness)) fail(`${next.id || "plate"} thickness must be positive`);
  if (next.fabrication !== undefined) {
    const fabrication = optionalObject(next.fabrication, {}, `${next.id || "plate"}.fabrication`);
    next.fabrication = {
      ...fabrication,
      ...(fabrication.reliefDefaults !== undefined ? { reliefDefaults: normalizePlateReliefDefaults(fabrication.reliefDefaults) } : {}),
      ...(fabrication.cornerReliefs !== undefined ? { cornerReliefs: normalizePlateCornerReliefs(fabrication.cornerReliefs, sketch, fabrication) } : {})
    };
  }
  const bends = plateBends(next);
  if (Array.isArray(next.fabrication?.bends)) {
    const bendIds = new Set();
    for (const bend of bends) {
      if (typeof bend?.id !== "string" || !bend.id.trim()) fail("bend id must be a non-empty string");
      if (bendIds.has(bend.id)) fail(`duplicate bend id ${bend.id}`);
      bendIds.add(bend.id);
    }
    next.fabrication = {
      ...next.fabrication,
      bends: bends.map((bend) => normalizeBend(bend, sketch, bendIds))
    };
  }
  if (Array.isArray(next.fabrication?.cornerReliefs)) {
    const cornerVertexIds = new Set(plateBendCorners(next).map((corner) => corner.vertexId));
    for (const relief of next.fabrication.cornerReliefs) {
      if (!cornerVertexIds.has(relief.vertexId)) fail(`${relief.id}: corner relief vertex ${relief.vertexId} is not shared by adjacent bends`);
    }
  }
  return next;
}

function createPlateObject(project, options = {}) {
  const id = nextObjectId(project, options.id === undefined ? "plate" : options.id);
  return normalizePlate({
    ...options,
    id,
    type: optionalString(options.type, "plate", "plate type"),
    sketch: options.sketch
  });
}

export function addPlate(project, options = {}) {
  const plate = createPlateObject(project, options);
  addIndexedObject(project, "plates", plate);
  return plate;
}

export function addSketch(project, options = {}) {
  const id = nextObjectId(project, options.id === undefined ? "sketch" : options.id);
  const sketch = sketchSource(options, id, "addSketch");
  const sketchObject = normalizeSketchObject({
    ...options,
    id,
    type: optionalString(options.type, "plate-sketch", "sketch type"),
    sketch
  });
  addIndexedObject(project, "sketches", sketchObject);
  return sketchObject;
}

export function plateFromSketchObject(project, sketchObject, options = {}) {
  const source = normalizeSketchObject(sketchObject);
  const placementIntent = optionalObject(options.placementIntent, {}, "plate placementIntent");
  return createPlateObject(project, {
    ...options,
    id: options.id === undefined ? `${source.id}_plate` : options.id,
    type: optionalString(options.type, "plate", "plate type"),
    sketch: source.sketch,
    center: source.center,
    normal: source.normal,
    localAxisY: source.localAxisY,
    localAxisZ: source.localAxisZ,
    thickness: options.thickness,
    material: options.material || "S355",
    placementIntent: {
      ...placementIntent,
      role: optionalString(placementIntent.role, "plate-from-sketch", "plate placementIntent.role"),
      sourceSketchId: source.id
    }
  });
}

export function profileFromSectionSketch({ id, designation, outline, material = "S355" }) {
  const points = cleanOutline(outline);
  return {
    id,
    designation: designation || id,
    profileType: "custom-section",
    section: {
      type: "polygonal-section",
      origin: "center",
      contours: [{ id: "outer", role: "solid", points }]
    },
    properties: { material }
  };
}
