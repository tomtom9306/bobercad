import { finiteNumberOr, finitePositiveNumber, finitePositiveNumberOr, v } from "../../engine/core/math.mjs";
import { arrayValues, collectionObjects, objectById } from "../../engine/core/model.mjs";
import { csgSubtract, csgUnion, cutBodyPolygons, geometryError, prismPolygons, projectCoincidentTolerance, requiredArray, requiredNumber, requiredVector } from "../../engine/geometry/csg.mjs";
import { cutBodiesForFeature } from "../../engine/geometry/cut-features.mjs";
import { evaluateFastenerGroup } from "../../engine/geometry/evaluators/fastener-evaluator.mjs";
import { evaluateWeld } from "../../engine/geometry/evaluators/weld-evaluator.mjs";
import { chartReliefGeometrySupport, evaluateBentPlateChartGeometry } from "../../engine/geometry/sheet-metal/chart-scene-geometry.mjs";
import { plateBends, plateOutline } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { DEFAULT_GHOST_OPACITY, isActiveSmartComponentObject, shouldRenderObject } from "./scene-object-visibility.mjs";
import { plateBendGeometry } from "./plate-bend-geometry.mjs";
import { detailMeta, shouldBuildLodDetail, shouldRenderFasteners } from "./scene-annotation-metadata.mjs";
import { holeOrSlotCut, objectFeatures } from "./scene-feature-cutters.mjs";
import { addLine, addLoopLines, addPlateLikeCsgSolid, addPlateSolid, addPolyline, addPrism, addWasher, circleOutline, hexOutline } from "./scene-line-face-assembly.mjs";

function plateSceneStyle(scene, plate) {
  const display = plate.display || {};
  return {
    color: display.color || "#a6a6a6",
    edgeColor: display.edgeColor || scene.settings.render.edges.plateColor,
    meta: {
      collection: "plates",
      objectId: plate.id,
      ...detailMeta(plate.id),
      ...(display.transparent || display.suppressed || display.opacity !== undefined ? { opacity: display.opacity ?? DEFAULT_GHOST_OPACITY } : {}),
      ...(display.suppressed ? { suppressed: true } : {})
    }
  };
}

function plateLikePrismCsgPolygons(prism, label, color) {
  const center = requiredVector(prism, "center", label);
  const normal = requiredVector(prism, "normal", label);
  const axisY = requiredVector(prism, "localAxisY", label);
  const axisZ = requiredVector(prism, "localAxisZ", label);
  const thickness = requiredNumber(prism, "thickness", label);
  const outline = requiredArray(prism, "outline", label);
  return prismPolygons(center, normal, axisY, axisZ, thickness, outline, { color });
}

function faceHasArea(points, tolerance = 1e-9) {
  if (!Array.isArray(points) || points.length < 3 || points.some((point) => !v.isVec3(point))) return false;
  for (let index = 1; index + 1 < points.length; index += 1) {
    if (v.len(v.cross(v.sub(points[index], points[0]), v.sub(points[index + 1], points[0]))) > tolerance) return true;
  }
  return false;
}

function addFaceIfRenderable(scene, points, color, meta) {
  if (faceHasArea(points)) scene.faces.push({ points, color, ...meta });
}

function addBendSurfaceStrip(scene, strip, thickness, color, edgeColor, meta = {}) {
  const samples = Array.isArray(strip?.samples) ? strip.samples : [];
  if (samples.length < 2) return;
  const halfThickness = thickness / 2;
  const rows = samples
    .map((sample) => {
      const normal = v.norm(sample.normal);
      if (!v.isVec3(sample.start) || !v.isVec3(sample.end) || !v.isVec3(normal)) return null;
      return {
        backStart: v.add(sample.start, v.mul(normal, -halfThickness)),
        backEnd: v.add(sample.end, v.mul(normal, -halfThickness)),
        frontStart: v.add(sample.start, v.mul(normal, halfThickness)),
        frontEnd: v.add(sample.end, v.mul(normal, halfThickness))
      };
    })
    .filter(Boolean);
  if (rows.length < 2) return;

  const bendId = strip.bend?.id || "";
  const bendMeta = bendId ? { bendId } : {};
  const faceMeta = { ...meta, ...bendMeta, hideEdges: true, bendSurfaceRole: "curved-bend-strip", bendFaceRole: "radius" };
  const edgeMeta = { ...meta, ...bendMeta, bendEdgeRole: "curved-bend-boundary" };
  const addStripFace = (role, points) => {
    addFaceIfRenderable(scene, points, color, { ...faceMeta, bendSurfaceStripFaceRole: role });
  };
  const addStripLine = (role, a, b) => {
    addLine(scene, a, b, edgeColor, { ...edgeMeta, bendSurfaceStripLineRole: role });
  };
  const addStripPolyline = (role, points) => {
    addPolyline(scene, points, edgeColor, { ...edgeMeta, bendSurfaceStripLineRole: role });
  };
  for (let index = 0; index < rows.length - 1; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];
    addStripFace("back", [current.backStart, current.backEnd, next.backEnd, next.backStart]);
    addStripFace("front", [current.frontStart, next.frontStart, next.frontEnd, current.frontEnd]);
    addStripFace("start-side", [current.backStart, next.backStart, next.frontStart, current.frontStart]);
    addStripFace("end-side", [current.backEnd, current.frontEnd, next.frontEnd, next.backEnd]);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  addStripPolyline("back-start-boundary", rows.map((row) => row.backStart));
  addStripPolyline("back-end-boundary", rows.map((row) => row.backEnd));
  addStripPolyline("front-start-boundary", rows.map((row) => row.frontStart));
  addStripPolyline("front-end-boundary", rows.map((row) => row.frontEnd));
  addStripLine("bend-start-back", first.backStart, first.backEnd);
  addStripLine("bend-start-front", first.frontStart, first.frontEnd);
  addStripLine("bend-end-back", last.backStart, last.backEnd);
  addStripLine("bend-end-front", last.frontStart, last.frontEnd);
  addStripLine("start-thickness-at-bend-start", first.backStart, first.frontStart);
  addStripLine("start-thickness-at-bend-end", last.backStart, last.frontStart);
  addStripLine("end-thickness-at-bend-start", first.backEnd, first.frontEnd);
  addStripLine("end-thickness-at-bend-end", last.backEnd, last.frontEnd);
}

function sheetMetalReliefEvaluatorMode(scene) {
  const mode = scene.settings?.geometry?.sheetMetalReliefEvaluator;
  if (mode === "legacy" || mode === "charts-supported") return mode;
  return "charts-supported";
}

function chartSupportActiveReliefTypes(support) {
  return new Set(
    [...(support?.evaluation?.specs?.values?.() || [])]
      .map((spec) => spec?.type)
      .filter(Boolean)
  );
}

function chartSupportHasActiveRelief(support) {
  return chartSupportActiveReliefTypes(support).size > 0;
}

function chartReliefSupportForMode(scene, plate) {
  const mode = sheetMetalReliefEvaluatorMode(scene);
  return mode === "legacy" || mode === "charts-supported"
    ? chartReliefGeometrySupport(plate, scene.tessellation)
    : null;
}

function shouldUseChartReliefGeometry(scene, plate, support = null) {
  const mode = sheetMetalReliefEvaluatorMode(scene);
  if (mode === "charts-supported") return support?.supported;
  return false;
}

function addChartEvaluatedBentPlate(scene, plate, color, edgeColor, meta) {
  const evaluated = evaluateBentPlateChartGeometry(plate, scene.tessellation);
  const blocking = (evaluated.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
  if (blocking.length) geometryError(`${plate.id}: ${blocking.map((diagnostic) => diagnostic.message).join("; ")}`);
  for (const face of evaluated.faces || []) {
    const { points, ...faceMeta } = face;
    scene.faces.push({ points, color, ...meta, ...faceMeta });
  }
  for (const line of evaluated.lines || []) {
    const { points, ...lineMeta } = line;
    scene.lines.push({ points, color: edgeColor, ...meta, ...lineMeta });
  }
  return Boolean(evaluated.faces?.length);
}

function isAuthoringPreviewPlate(plate) {
  return plate?.display?.authoringPreview === true;
}

function cutBodyPlateLikePrism(scene, body, color) {
  if (body.type === "box") {
    const size = requiredArray(body, "size", "box body");
    if (size.length !== 3 || size.some((value) => !finitePositiveNumber(value))) {
      geometryError("box body size must contain three positive numbers");
    }
    return plateLikePrismCsgPolygons({
      center: body.center,
      normal: body.axisX,
      localAxisY: body.axisY,
      localAxisZ: body.axisZ,
      thickness: size[0],
      outline: [
        [-size[1] / 2, -size[2] / 2],
        [size[1] / 2, -size[2] / 2],
        [size[1] / 2, size[2] / 2],
        [-size[1] / 2, size[2] / 2]
      ]
    }, "box body", color);
  }
  if (body.type === "polygonal-prism") {
    return plateLikePrismCsgPolygons({
      center: body.center,
      normal: body.axisX,
      localAxisY: body.axisY,
      localAxisZ: body.axisZ,
      thickness: body.depth,
      outline: body.outline
    }, "polygonal-prism body", color);
  }
  return cutBodyPolygons(body, { color }, scene.tessellation);
}

function addBentPlate(scene, plate) {
  const bends = plateBends(plate);
  if (!bends.length) return false;
  const n = v.norm(plate.normal);
  const { color, edgeColor, meta } = plateSceneStyle(scene, plate);
  const chartSupport = chartReliefSupportForMode(scene, plate);
  if (sheetMetalReliefEvaluatorMode(scene) === "legacy" && chartSupportHasActiveRelief(chartSupport)) {
    if (isAuthoringPreviewPlate(plate)) return true;
    geometryError(`${plate.id}: legacy sheet-metal relief evaluator is disabled for active corner reliefs; use charts-supported`);
  }
  if (shouldUseChartReliefGeometry(scene, plate, chartSupport)) {
    return addChartEvaluatedBentPlate(scene, plate, color, edgeColor, meta);
  }
  if (sheetMetalReliefEvaluatorMode(scene) === "charts-supported" && chartSupport?.reason) {
    if (isAuthoringPreviewPlate(plate)) return true;
    geometryError(`${plate.id}: ${chartSupport.reason}`);
  }
  const geometry = plateBendGeometry(plate, scene.tessellation);
  if (geometry.unresolved?.length) {
    geometryError(`${plate.id}: unresolved plate bends ${geometry.unresolved.map((bend) => bend.id).join(", ")}`);
  }
  addPlateSolid(scene, geometry.basePoints, n, plate.thickness, color, edgeColor, meta, {
    skipThicknessEdgeIndices: geometry.baseSmoothVertexIndices,
    hideSideFaceEdgeIndices: geometry.baseSmoothVertexIndices
  });

  if (geometry.bendSurfaceStrips?.length) {
    for (const strip of geometry.bendSurfaceStrips) {
      addBendSurfaceStrip(scene, strip, plate.thickness, color, edgeColor, meta);
    }
  } else {
    for (const surface of geometry.bendSurfaces || []) {
      const bendId = surface.bend?.id || "";
      const surfaceMeta = bendId ? { ...meta, bendId, bendFaceRole: "radius" } : meta;
      addPlateSolid(scene, surface.points, surface.normal, plate.thickness, color, edgeColor, surfaceMeta);
    }
  }

  for (const panel of geometry.panels) {
    const bendId = panel.bend?.id || "";
    const panelMeta = bendId ? { ...meta, bendId, bendFaceRole: "flange" } : meta;
    addPlateSolid(scene, panel.points, panel.normal, plate.thickness, color, edgeColor, panelMeta, {
      skipThicknessEdgeIndices: panel.smoothVertexIndices,
      hideSideFaceEdgeIndices: panel.smoothVertexIndices
    });
    addLine(scene, panel.edgeStart, panel.edgeEnd, "#111827", panelMeta);
  }

  return true;
}

function plateCsgPolygons(scene, project, profiles, plate, color) {
  const shared = { color };
  const thickness = requiredNumber(plate, "thickness", plate.id);
  let polygons = plateLikePrismCsgPolygons({
    center: plate.center,
    normal: plate.normal,
    localAxisY: plate.localAxisY,
    localAxisZ: plate.localAxisZ,
    thickness,
    outline: plateOutline(plate, scene.tessellation)
  }, plate.id, color);
  const cutterDepth = thickness + projectCoincidentTolerance(project) * 4;

  for (const feature of objectFeatures(project, plate)) {
    const cutPolygons = holeOrSlotCut(scene, project, profiles, polygons, feature, cutterDepth, shared);
    if (cutPolygons) {
      polygons = cutPolygons;
      continue;
    }

    if (feature.type === "clearance-cut") {
      const bodies = cutBodiesForFeature(project, profiles, feature, { tessellation: scene.tessellation });
      if (bodies.length) {
        for (const body of bodies) polygons = csgSubtract(polygons, cutBodyPolygons(body, shared, scene.tessellation));
        continue;
      }
    }

    if (feature.type === "boolean-part") {
      if (!["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) geometryError(`${feature.id}: unsupported booleanType ${feature.booleanType}`);
      const bodies = cutBodiesForFeature(project, profiles, feature, { tessellation: scene.tessellation });
      if (!bodies.length) geometryError(`${feature.id}: boolean-part missing derivable body`);
      const bodyPolygons = bodies.flatMap((body) => cutBodyPolygons(body, shared, scene.tessellation));
      polygons = feature.booleanType === "BOOLEAN_ADD" ? csgUnion(polygons, bodyPolygons) : csgSubtract(polygons, bodyPolygons);
      continue;
    }

    geometryError(`${plate.id}/${feature.id}: unsupported plate feature type ${feature.type}`);
  }

  return polygons;
}

export function addPlate(scene, project, plate) {
  if (plateBends(plate).length) {
    if (arrayValues(plate.featureIds).length) geometryError(`${plate.id}: bent plate features are not implemented in strict evaluator`);
    if (addBentPlate(scene, plate)) return;
    geometryError(`${plate.id}: bent plate geometry is unsupported`);
  }

  const { color, edgeColor, meta } = plateSceneStyle(scene, plate);
  const polygons = plateCsgPolygons(scene, project, scene.profiles, plate, color);

  addPlateLikeCsgSolid(scene, polygons, color, edgeColor, meta);
}

export function addCutBody(scene, project, profiles, feature) {
  if (feature.operationEnabled === false) return;
  if (!shouldRenderObject(scene, feature)) return;
  const meta = { collection: "features", objectId: feature.id, ...detailMeta(feature.id) };
  if (feature.type !== "boolean-part" && feature.type !== "clearance-cut") return;
  if (feature.type === "boolean-part" && !["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) geometryError(`${feature.id}: unsupported booleanType ${feature.booleanType}`);
  const isCut = feature.type === "clearance-cut" || feature.booleanType === "BOOLEAN_CUT";
  const display = isCut
    ? { ...(feature.display || {}), color: feature.display?.color || "#ff3366", opacity: Math.min(feature.display?.opacity ?? 0.28, 0.06) }
    : { ...(feature.display || {}), color: feature.display?.color || "#f59e0b", opacity: feature.display?.opacity ?? 0.16 };
  const bodies = cutBodiesForFeature(project, profiles, feature, { tessellation: scene.tessellation });
  if (!bodies.length) geometryError(`${feature.id}: feature missing derivable body`);
  const polygons = bodies.flatMap((body) => cutBodyPlateLikePrism(scene, body, display.color));
  addPlateLikeCsgSolid(scene, polygons, display.color, display.edgeColor || display.color, { opacity: display.opacity, ...meta });
}

function addFastenerAssembly(scene, evaluatedGroup, evaluatedPosition, color, edgeColor, meta) {
  const { source: fastenerGroup, fastener, basis, axis, gripLength } = evaluatedGroup;
  const shankDiameter = requiredNumber(fastener.shank || {}, "diameter", fastener.id);
  const shankRadius = shankDiameter / 2;
  const center = evaluatedPosition.center;
  const headHeight = fastener.head?.height || shankDiameter * 0.6;
  const headAcrossFlats = fastener.head?.acrossFlats || shankDiameter * 1.5;
  const nutHeight = fastener.nut?.height || headHeight;
  const nutAcrossFlats = fastener.nut?.acrossFlats || headAcrossFlats;
  const washer = fastener.washer || {};
  const washerThickness = washer.thickness || 0;
  const washerOuterRadius = (washer.outerDiameter || headAcrossFlats * 1.25) / 2;
  const washerInnerRadius = (washer.innerDiameter || fastener.hole?.defaultDiameter || shankDiameter + 2) / 2;
  const washers = fastenerGroup.assembly?.washers || {};
  const useHeadWasher = washers.head ?? Boolean(fastener.washer);
  const useNutWasher = washers.nut ?? Boolean(fastener.washer && fastener.nut);
  const nutEnd = gripLength + (useNutWasher ? washerThickness : 0) + (fastener.nut ? nutHeight : 0);
  const defaultLength = Math.max(scene.settings.render.fasteners.length || 0, nutEnd + shankDiameter * 0.25);
  const requestedLength = fastenerGroup.assembly?.length;
  const boltLength = finitePositiveNumberOr(requestedLength, defaultLength);
  const shankLength = Math.max(boltLength, gripLength + 1);
  const shankCenter = v.add(center, v.mul(axis, shankLength / 2));
  const shankColor = fastenerGroup.display?.shankColor || color;
  const componentColor = fastenerGroup.display?.headColor || color;
  const washerColor = fastenerGroup.display?.washerColor || "#d6b35a";

  addPrism(scene, shankCenter, axis, basis.y, basis.z, shankLength, circleOutline(shankRadius, scene.settings.render.fasteners.sides), shankColor, edgeColor, meta);

  let headOffset = 0;
  if (useHeadWasher) {
    headOffset -= washerThickness / 2;
    addWasher(scene, v.add(center, v.mul(axis, headOffset)), axis, basis.y, basis.z, washerOuterRadius, washerInnerRadius, washerThickness, washerColor, edgeColor, meta);
    headOffset -= washerThickness / 2;
  }
  addPrism(scene, v.add(center, v.mul(axis, headOffset - headHeight / 2)), axis, basis.y, basis.z, headHeight, hexOutline(headAcrossFlats), componentColor, edgeColor, meta);

  const nutSurface = v.add(center, v.mul(axis, gripLength));
  const customNutOffset = fastenerGroup.assembly?.nutOffset;
  let nutStackOffset = finiteNumberOr(customNutOffset, 0);
  if (useNutWasher) {
    nutStackOffset += washerThickness / 2;
    addWasher(scene, v.add(nutSurface, v.mul(axis, nutStackOffset)), axis, basis.y, basis.z, washerOuterRadius, washerInnerRadius, washerThickness, washerColor, edgeColor, meta);
    nutStackOffset += washerThickness / 2;
  }
  if (fastener.nut) addPrism(scene, v.add(nutSurface, v.mul(axis, nutStackOffset + nutHeight / 2)), axis, basis.y, basis.z, nutHeight, hexOutline(nutAcrossFlats), componentColor, edgeColor, meta);

  const pickRadius = Math.max(headAcrossFlats * 0.85, washerOuterRadius * 1.25, shankDiameter * 1.8, 60);
  const pickOffset = headHeight + (useHeadWasher ? washerThickness : 0) + 1;
  const pickCenter = v.add(center, v.mul(axis, -pickOffset));
  scene.faces.push({
    points: [
      v.add(pickCenter, v.add(v.mul(basis.y, -pickRadius), v.mul(basis.z, -pickRadius))),
      v.add(pickCenter, v.add(v.mul(basis.y, pickRadius), v.mul(basis.z, -pickRadius))),
      v.add(pickCenter, v.add(v.mul(basis.y, pickRadius), v.mul(basis.z, pickRadius))),
      v.add(pickCenter, v.add(v.mul(basis.y, -pickRadius), v.mul(basis.z, pickRadius)))
    ],
    color: componentColor,
    opacity: 0,
    hideEdges: true,
    ...meta,
    lodDetailObjectId: null
  });
}

export function addFastenerGroups(scene, project, fastenerGroups = collectionObjects(project, "fastenerGroups")) {
  if (!shouldRenderFasteners(scene)) return;
  for (const fastenerGroup of fastenerGroups) {
    if (!shouldRenderObject(scene, fastenerGroup)) continue;
    if (!shouldBuildLodDetail(scene, fastenerGroup.id)) continue;
    const evaluatedGroup = evaluateFastenerGroup(project, scene.profiles, scene.fasteners, fastenerGroup, {
      minimumGripLength: scene.settings.render.fasteners.length * 0.45
    });
    const pattern = evaluatedGroup.holePattern;
    const color = fastenerGroup.display?.color || "#b7791f";
    const edgeColor = fastenerGroup.display?.edgeColor || scene.settings.render.edges.fastenerHeadColor;
    const meta = { collection: "fastenerGroups", objectId: fastenerGroup.id, ...detailMeta(fastenerGroup.id) };
    const groupSuppressed = Boolean(fastenerGroup.display?.suppressed);

    for (const position of evaluatedGroup.positions) {
      const suppressed = groupSuppressed || position.suppressed;
      if (suppressed && !isActiveSmartComponentObject(scene, fastenerGroup.id) && !isActiveSmartComponentObject(scene, pattern.id)) continue;
      addFastenerAssembly(scene, evaluatedGroup, position, color, edgeColor, {
        ...meta,
        positionIndex: position.index,
        componentKind: "fastener-position",
        ...(suppressed ? { suppressed: true, opacity: fastenerGroup.display?.opacity ?? DEFAULT_GHOST_OPACITY } : {})
      });
    }
  }
}

export function addSketchObject(scene, sketchObject) {
  const y = v.norm(requiredVector(sketchObject, "localAxisY", sketchObject.id));
  const z = v.norm(requiredVector(sketchObject, "localAxisZ", sketchObject.id));
  const center = requiredVector(sketchObject, "center", sketchObject.id);
  const outline = plateOutline(sketchObject, scene.tessellation);
  const color = sketchObject.display?.color || "#dbeafe";
  const edgeColor = sketchObject.display?.edgeColor || "#0ea5e9";
  const meta = {
    collection: "sketches",
    objectId: sketchObject.id,
    ...detailMeta(sketchObject.id)
  };
  const points = outline.map((point) => v.add(center, v.add(v.mul(y, point[0]), v.mul(z, point[1]))));
  scene.faces.push({ points, color, ...meta });
  addLoopLines(scene, points, edgeColor, meta);
  scene.vertices.push(...points);
}

export function addWelds(scene, project, welds = collectionObjects(project, "welds")) {
  for (const weld of welds) {
    if (!shouldRenderObject(scene, weld)) continue;
    if (!shouldBuildLodDetail(scene, weld.id)) continue;
    const evaluatedWeld = evaluateWeld(project, scene.profiles, weld);
    const color = weld.display?.color || "#f6e05e";

    if (evaluatedWeld.kind === "plate-support-edge") {
      const opacity = weld.display?.transparent || weld.display?.suppressed || weld.display?.opacity !== undefined ? weld.display?.opacity ?? DEFAULT_GHOST_OPACITY : 0.9;
      const meta = { collection: "welds", objectId: weld.id, ...detailMeta(weld.id), opacity, ...(weld.display?.suppressed ? { suppressed: true } : {}) };
      for (const face of evaluatedWeld.faces) {
        scene.faces.push({ points: face.points, color, opacity, ...meta });
        addLoopLines(scene, face.points, color, meta);
      }
      continue;
    }

    if (evaluatedWeld.kind === "member-profile") {
      const opacity = weld.display?.transparent || weld.display?.opacity !== undefined ? weld.display?.opacity ?? DEFAULT_GHOST_OPACITY : undefined;
      const meta = {
        collection: "welds",
        objectId: weld.id,
        ...detailMeta(weld.id),
        ...(opacity !== undefined ? { opacity } : {})
      };
      for (const loop of evaluatedWeld.loops) addLoopLines(scene, loop, color, meta);
    }
  }
}
