import { averageVec3, clamp, finiteNumber, finitePositiveNumber, v } from "../../engine/core/math.mjs";
import { uniqueTruthy } from "../../engine/core/model.mjs";
import { CSG_EPSILON, geometryError, projectCoincidentTolerance, requiredArray, requiredVector } from "../../engine/geometry/csg.mjs";
import { evaluateTrimJointOperationMarkerPlanes } from "../../engine/geometry/evaluators/trim-evaluator.mjs";
import { allGridLineSegments } from "../../engine/api/project/datums.mjs";
import { activeTrimJointOperations } from "../../engine/api/project/trim-operations.mjs";
import { shouldRenderObject } from "./scene-object-visibility.mjs";
import { detailMeta, objectDisplayColor, shouldRenderCuttingObjects, shouldRenderReferencePlanes } from "./scene-annotation-metadata.mjs";
import { addPlaneTrimRegionHandles } from "./scene-member-geometry-adapters.mjs";
import { addLine, addLoopLines, addTextLabel } from "./scene-line-face-assembly.mjs";

function addAxisHead(scene, axis, sideA, sideB, length, headSize, color) {
  const end = v.mul(axis, length);
  const base = v.mul(axis, length - headSize);
  const wing = headSize * 0.42;
  addLine(scene, end, v.add(base, v.mul(sideA, wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideA, -wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideB, wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideB, -wing)), color);
}

function addViewerAxis(scene, axis, sideA, sideB, color, length, headSize) {
  const origin = [0, 0, 0];
  addLine(scene, v.mul(axis, -length), origin, scene.settings.render.axes.negativeColor);
  addLine(scene, origin, v.mul(axis, length), color);
  addAxisHead(scene, axis, sideA, sideB, length, headSize, color);
}

export function addViewerAxes(scene) {
  const axes = scene.settings.render.axes;
  if (!axes?.visible) return;
  const maxCoordinate = Math.max(...scene.bounds.min.map(Math.abs), ...scene.bounds.max.map(Math.abs), 1);
  const length = Math.max(axes.minLength, maxCoordinate * axes.padding);
  const headSize = axes.headSize || length * 0.035;
  addViewerAxis(scene, [1, 0, 0], [0, 1, 0], [0, 0, 1], axes.xColor, length, headSize);
  addViewerAxis(scene, [0, 1, 0], [1, 0, 0], [0, 0, 1], axes.yColor, length, headSize);
  addViewerAxis(scene, [0, 0, 1], [1, 0, 0], [0, 1, 0], axes.zColor, length, headSize);
}

export function addGridSystems(scene, project, renderObjectIds = null) {
  const color = scene.settings.render?.datum?.gridColor || "#0ea5e9";
  const opacity = finiteNumber(scene.settings.render?.datum?.gridOpacity)
    ? clamp(Number(scene.settings.render.datum.gridOpacity), 0, 1)
    : 0.82;
  const labelColor = scene.settings.render?.datum?.gridLabelColor || color;
  const labelTextHeight = finiteNumber(scene.settings.render?.datum?.gridLabelTextHeight)
    ? Math.max(1, Number(scene.settings.render.datum.gridLabelTextHeight))
    : 260;
  const labelOffset = finiteNumber(scene.settings.render?.datum?.gridLabelOffset)
    ? Math.max(0, Number(scene.settings.render.datum.gridLabelOffset))
    : 180;
  for (const segment of allGridLineSegments(project)) {
    if (renderObjectIds && !renderObjectIds.has(segment.grid.id)) continue;
    if (segment.grid.display?.visible === false) continue;
    const axisLabel = gridAxisDisplayLabel(segment.axis);
    addLine(scene, segment.a, segment.b, segment.grid.display?.color || color, {
      collection: "gridSystems",
      objectId: segment.grid.id,
      subId: `${segment.axisGroup}:${segment.axis.id || segment.axis.label || ""}:${segment.level.id || ""}`,
      depthTest: false,
      opacity: segment.grid.display?.opacity ?? opacity
    });
    if (axisLabel) {
      const axis = v.safeNorm(v.sub(segment.b, segment.a), [1, 0, 0]);
      const common = {
        collection: "gridSystems",
        objectId: segment.grid.id,
        color: segment.grid.display?.labelColor || labelColor,
        textHeight: segment.grid.display?.labelTextHeight || labelTextHeight,
        title: gridAxisLabelTitle(segment, axisLabel)
      };
      addTextLabel(scene, v.add(segment.a, v.mul(axis, -labelOffset)), axisLabel, {
        ...common,
        labelId: `${segment.grid.id}:${segment.axisGroup}:${segment.axis.id || segment.axis.label || ""}:${segment.level.id || ""}:start`
      });
      addTextLabel(scene, v.add(segment.b, v.mul(axis, labelOffset)), axisLabel, {
        ...common,
        labelId: `${segment.grid.id}:${segment.axisGroup}:${segment.axis.id || segment.axis.label || ""}:${segment.level.id || ""}:end`
      });
    }
  }
}

function gridAxisDisplayLabel(axis = {}) {
  return String(axis.label || axis.name || axis.id || "").trim();
}

function gridAxisLabelTitle(segment, axisLabel) {
  const gridName = segment.grid?.name || segment.grid?.id || "Grid";
  const levelName = segment.level?.name || segment.level?.id || "";
  return levelName ? `${gridName} ${axisLabel} @ ${levelName}` : `${gridName} ${axisLabel}`;
}

function planeMarkerGeometry(plane, label = "plane marker") {
  const x = v.norm(requiredVector(plane, "axisX", label));
  const y = v.norm(requiredVector(plane, "axisY", label));
  const origin = requiredVector(plane, "origin", label);
  const size = requiredArray(plane, "size", label);
  if (size.length !== 2 || size.some((value) => !finitePositiveNumber(value))) {
    geometryError(`${label} size must contain two positive numbers`);
  }
  const extents = plane.extents && finiteNumber(plane.extents.xMin) && finiteNumber(plane.extents.xMax)
    && finiteNumber(plane.extents.yMin) && finiteNumber(plane.extents.yMax)
    && plane.extents.xMax > plane.extents.xMin && plane.extents.yMax > plane.extents.yMin
    ? plane.extents
    : { xMin: -size[0] / 2, xMax: size[0] / 2, yMin: -size[1] / 2, yMax: size[1] / 2 };
  const points = [
    v.add(origin, v.add(v.mul(x, extents.xMin), v.mul(y, extents.yMin))),
    v.add(origin, v.add(v.mul(x, extents.xMax), v.mul(y, extents.yMin))),
    v.add(origin, v.add(v.mul(x, extents.xMax), v.mul(y, extents.yMax))),
    v.add(origin, v.add(v.mul(x, extents.xMin), v.mul(y, extents.yMax)))
  ];
  return { x, y, origin, size: [extents.xMax - extents.xMin, extents.yMax - extents.yMin], points };
}

function addPlaneMarker(scene, plane, display = {}, meta = {}) {
  const { points } = planeMarkerGeometry(plane);
  const color = display.color || "#ef4444";
  const opacity = display.transparent ? display.opacity ?? 0.18 : 0.18;

  scene.faces.push({ points, color, opacity, ...meta });
  addLoopLines(scene, points, color, meta);
}

function planeDisplay(display = {}, fallbackColor = "#d97706") {
  return {
    color: display.planeColor || display.edgeColor || display.color || fallbackColor,
    transparent: true,
    opacity: display.planeOpacity ?? 0.1
  };
}

function addCutCallout(scene, plane, display = {}, meta = {}, callout = {}) {
  const { y, origin, size } = planeMarkerGeometry(plane, "cut marker");
  const normal = v.norm(requiredVector(plane, "normal", "cut marker"));
  const edgeColor = display.edgeColor || display.color || "#be123c";
  const arrow = Math.max(8, Math.min(size[0], size[1]) * 0.06);
  const normalLength = Math.max(28, Math.min(size[0], size[1]) * 0.24);
  const lateral = Math.max(18, Math.min(size[0], size[1]) * 0.14);
  const labelPoint = v.add(v.add(origin, v.mul(normal, normalLength)), v.mul(y, lateral));

  addLine(scene, origin, labelPoint, edgeColor, { ...meta, opacity: 0.82 });
  const normalEnd = v.add(origin, v.mul(normal, arrow));
  addLine(scene, origin, normalEnd, edgeColor, { ...meta, opacity: 0.82 });
  scene.callouts.push({
    point: labelPoint,
    anchor: origin,
    color: edgeColor,
    collection: meta.collection,
    objectId: meta.objectId,
    operationId: callout.operationId || meta.operationId || null,
    iconType: callout.iconType || "plane-trim",
    label: callout.label || "",
    colors: callout.colors || {}
  });
}

function canonicalPlaneNormal(normal) {
  let n = v.norm(normal);
  const abs = n.map(Math.abs);
  const dominantAxis = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2;
  if (n[dominantAxis] < 0) n = v.mul(n, -1);
  return n;
}

function planeMarkerKey(project, plane) {
  const tolerance = Math.max(projectCoincidentTolerance(project), CSG_EPSILON, 0.001);
  const normal = canonicalPlaneNormal(requiredVector(plane, "normal", "plane marker key"));
  const origin = requiredVector(plane, "origin", "plane marker key");
  const quantize = (value) => Math.round(value / tolerance);
  return [
    quantize(normal[0]),
    quantize(normal[1]),
    quantize(normal[2]),
    quantize(v.dot(origin, normal))
  ].join(":");
}

function addPlaneMarkerOnce(scene, project, plane, display = {}, meta = {}) {
  const key = planeMarkerKey(project, plane);
  if (scene.planeMarkerKeys.has(key)) return false;
  scene.planeMarkerKeys.add(key);
  addPlaneMarker(scene, plane, display, meta);
  return true;
}

function cutCalloutKeys(project, plane, callout = {}) {
  const keys = [];
  if (callout.key) keys.push(callout.key);
  if (Array.isArray(callout.dedupeKeys)) keys.push(...callout.dedupeKeys);
  keys.push(planeMarkerKey(project, plane));
  return uniqueTruthy(keys);
}

function addCutCalloutOnce(scene, project, plane, display = {}, meta = {}, callout = {}) {
  const keys = cutCalloutKeys(project, plane, callout);
  if (keys.some((key) => scene.cutCalloutKeys.has(key))) return false;
  for (const key of keys) scene.cutCalloutKeys.add(key);
  addCutCallout(scene, plane, display, meta, callout);
  return true;
}

function operationCalloutPlane(planes) {
  if (!planes.length) return null;
  if (planes.length === 1) return planes[0];
  const origin = averageVec3(planes.map((plane) => requiredVector(plane, "origin", "trim operation marker")), planes[0].origin);
  return { ...planes[0], origin };
}

export function addTrimJoint(scene, project, profiles, trimJoint) {
  if (!shouldRenderObject(scene, trimJoint)) return;
  const renderCuttingObjects = shouldRenderCuttingObjects(scene);
  const renderReferencePlanes = shouldRenderReferencePlanes(scene);
  const display = {
    color: "#ff3366",
    edgeColor: "#be123c",
    transparent: true,
    opacity: 0.18,
    ...(trimJoint.display || {})
  };
  const meta = { collection: "trimJoints", objectId: trimJoint.id, ...detailMeta(trimJoint.id) };
  const operations = activeTrimJointOperations(trimJoint);
  if (operations.length) {
    for (const operation of operations) {
      const operationMeta = { ...meta, operationId: operation.id || null, componentKind: "trim-operation" };
      const planes = evaluateTrimJointOperationMarkerPlanes(project, profiles, trimJoint, operation);
      const dedupeKeys = [];
      for (const plane of planes) {
        const planeMeta = { ...operationMeta, referencePlaneId: plane.id || null, ...(plane.memberId ? { memberId: plane.memberId } : {}) };
        dedupeKeys.push(planeMarkerKey(project, plane));
        if (operation.type === "plane-trim" && renderReferencePlanes) {
          addPlaneMarkerOnce(scene, project, plane, planeDisplay(display, display.edgeColor || "#be123c"), planeMeta);
        }
      }
      const calloutPlane = operationCalloutPlane(planes);
      if (!calloutPlane) continue;
      if (renderCuttingObjects) {
        addCutCalloutOnce(scene, project, calloutPlane, display, operationMeta, {
          key: `trim-operation:${trimJoint.id}:${operation.id || operation.type || "operation"}`,
          dedupeKeys,
          operationId: operation.id || null,
          iconType: operation.type || "end-butt-1",
          colors: {
            memberA: objectDisplayColor(project, operation.memberAId, "#365f74"),
            memberB: objectDisplayColor(project, operation.memberBId, "#d99200")
          }
        });
        addPlaneTrimRegionHandles(scene, project, profiles, trimJoint, operation, operationMeta);
      }
    }
    return;
  }
  geometryError(`${trimJoint.id}: trim joint requires operations`);
}
