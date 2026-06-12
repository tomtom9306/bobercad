import { finiteNumber, finitePositiveNumber, v } from "../../engine/core/math.mjs?v=render-number-dry-1";
import { pointFromPlaneCoordinates } from "../../engine/api/project/work-plane.mjs?v=plane-coordinates-dry-1";

const DEFAULT_EXTENTS = { xMin: -120, xMax: 120, yMin: -90, yMax: 90 };
const MIN_PLANE_DISPLAY_SIZE = 20;

function featureReferencePlaneId(project, objectId) {
  const entry = project.objectIndex?.[objectId];
  if (entry?.collection === "referencePlanes") return objectId;
  return null;
}

function finiteExtents(extents) {
  return extents && finiteNumber(extents.xMin) && finiteNumber(extents.xMax)
    && finiteNumber(extents.yMin) && finiteNumber(extents.yMax)
    && extents.xMax > extents.xMin && extents.yMax > extents.yMin;
}

function planeExtents(plane) {
  if (finiteExtents(plane?.extents)) return { ...plane.extents };
  if (Array.isArray(plane?.size) && plane.size.length === 2 && plane.size.every(finitePositiveNumber)) {
    return {
      xMin: -plane.size[0] / 2,
      xMax: plane.size[0] / 2,
      yMin: -plane.size[1] / 2,
      yMax: plane.size[1] / 2
    };
  }
  return { ...DEFAULT_EXTENTS };
}

function planePoint(plane, extents, xKey, yKey) {
  return pointFromPlaneCoordinates([extents[xKey], extents[yKey]], plane);
}

function dashedLine(a, b, color, meta = {}) {
  const segments = 10;
  const lines = [];
  for (let index = 0; index < segments; index += 2) {
    lines.push({
      points: [
        v.add(a, v.mul(v.sub(b, a), index / segments)),
        v.add(a, v.mul(v.sub(b, a), (index + 1) / segments))
      ],
      color,
      collection: "authoring",
      ...meta
    });
  }
  return lines;
}

function overlayForPlane(plane) {
  const extents = planeExtents(plane);
  const corners = [
    ["xMin", "yMin"],
    ["xMax", "yMin"],
    ["xMax", "yMax"],
    ["xMin", "yMax"]
  ];
  const edgePoints = [
    ["xMin", null, (extents.yMin + extents.yMax) / 2],
    ["xMax", null, (extents.yMin + extents.yMax) / 2],
    [null, (extents.xMin + extents.xMax) / 2, "yMin"],
    [null, (extents.xMin + extents.xMax) / 2, "yMax"]
  ];
  const points = corners.map(([xKey, yKey]) => planePoint(plane, extents, xKey, yKey));
  const outline = corners.map((_, index) => ({
    points: [points[index], points[(index + 1) % points.length]],
    color: "#00c853",
    collection: "authoring",
    objectId: plane.id,
    kind: "reference-plane-edge"
  }));
  const centerX = extents.xMin <= 0 && extents.xMax >= 0 ? 0 : (extents.xMin + extents.xMax) / 2;
  const centerY = extents.yMin <= 0 && extents.yMax >= 0 ? 0 : (extents.yMin + extents.yMax) / 2;
  return {
    faces: [{
      points,
      color: "#fff7ed",
      opacity: 0.3
    }],
    lines: [
      ...outline,
      ...dashedLine(pointFromPlaneCoordinates([extents.xMin, centerY], plane), pointFromPlaneCoordinates([extents.xMax, centerY], plane), "#64748b", { objectId: plane.id, kind: "reference-plane-center-x" }),
      ...dashedLine(pointFromPlaneCoordinates([centerX, extents.yMin], plane), pointFromPlaneCoordinates([centerX, extents.yMax], plane), "#64748b", { objectId: plane.id, kind: "reference-plane-center-y" })
    ],
    handles: [
      ...corners.map(([xKey, yKey], index) => ({
        type: "circle",
        kind: "reference-plane-corner",
        referencePlaneId: plane.id,
        corner: `${xKey}:${yKey}`,
        xKey,
        yKey,
        point: points[index],
        dragAxes: { x: v.norm(plane.axisX), y: v.norm(plane.axisY) },
        color: "#00c853",
        radius: 5
      })),
      ...edgePoints.map(([xKey, xValue, yKey]) => ({
        type: "circle",
        kind: "reference-plane-corner",
        referencePlaneId: plane.id,
        corner: xKey ? `${xKey}:mid` : `mid:${yKey}`,
        xKey,
        yKey,
        point: pointFromPlaneCoordinates(xKey ? [extents[xKey], yKey] : [xValue, extents[yKey]], plane),
        dragAxes: { x: v.norm(plane.axisX), y: v.norm(plane.axisY) },
        color: "#00c853",
        radius: 5
      }))
    ],
    labels: [{
      point: points[0],
      screenOffsetPx: { x: 4, y: -22 },
      text: plane.name || plane.id,
      color: "#00c853",
      className: "reference-plane-label"
    }]
  };
}

function resizedExtents(base, xKey, yKey, dx, dy) {
  const next = { ...base };
  if (xKey === "xMin") next.xMin = Math.min(base.xMin + dx, base.xMax - MIN_PLANE_DISPLAY_SIZE);
  if (xKey === "xMax") next.xMax = Math.max(base.xMax + dx, base.xMin + MIN_PLANE_DISPLAY_SIZE);
  if (yKey === "yMin") next.yMin = Math.min(base.yMin + dy, base.yMax - MIN_PLANE_DISPLAY_SIZE);
  if (yKey === "yMax") next.yMax = Math.max(base.yMax + dy, base.yMin + MIN_PLANE_DISPLAY_SIZE);
  return next;
}

function screenDeltaToPlane(handle, totalDx, totalDy) {
  const sx = handle.dragAxesScreen?.x;
  const sy = handle.dragAxesScreen?.y;
  if (!sx || !sy) return [0, 0];
  const ax = { x: sx.unit.x * sx.scalePxPerWorld, y: sx.unit.y * sx.scalePxPerWorld };
  const ay = { x: sy.unit.x * sy.scalePxPerWorld, y: sy.unit.y * sy.scalePxPerWorld };
  const det = ax.x * ay.y - ay.x * ax.y;
  if (Math.abs(det) > 1e-6) {
    return [
      (totalDx * ay.y - ay.x * totalDy) / det,
      (ax.x * totalDy - totalDx * ax.y) / det
    ];
  }
  const dx = (totalDx * sx.unit.x + totalDy * sx.unit.y) / Math.max(sx.scalePxPerWorld, 1e-9);
  const dy = (totalDx * sy.unit.x + totalDy * sy.unit.y) / Math.max(sy.scalePxPerWorld, 1e-9);
  return [dx, dy];
}

export function createReferencePlaneEditController({ viewer, api, onLocalObjectProjectChange }) {
  let activeReferencePlaneId = null;
  let drag = null;

  function activePlane() {
    return api.project().model?.referencePlanes?.[activeReferencePlaneId] || null;
  }

  function renderOverlay() {
    const plane = activePlane();
    if (!plane) {
      viewer.setAuthoringOverlay(null);
      return;
    }
    viewer.setAuthoringOverlay(overlayForPlane(plane));
  }

  function clear(options = {}) {
    const hadActivePlane = Boolean(activeReferencePlaneId);
    activeReferencePlaneId = null;
    drag = null;
    if (options.overlay && hadActivePlane) viewer.setAuthoringOverlay(null);
  }

  function selectObject(objectId) {
    const referencePlaneId = featureReferencePlaneId(api.project(), objectId);
    if (!referencePlaneId) {
      clear();
      return false;
    }
    activeReferencePlaneId = referencePlaneId;
    renderOverlay();
    return true;
  }

  function beginDrag({ handle }) {
    if (handle?.kind !== "reference-plane-corner" || !handle.referencePlaneId) return false;
    const plane = api.project().model?.referencePlanes?.[handle.referencePlaneId];
    if (!plane) return false;
    activeReferencePlaneId = handle.referencePlaneId;
    drag = {
      handle,
      baseExtents: planeExtents(plane)
    };
    return true;
  }

  function applyDrag(input) {
    if (!drag) return;
    const [dx, dy] = screenDeltaToPlane(drag.handle, input.totalDx || 0, input.totalDy || 0);
    const extents = resizedExtents(drag.baseExtents, drag.handle.xKey, drag.handle.yKey, dx, dy);
    const nextProject = api.setReferencePlane(drag.handle.referencePlaneId, { extents });
    const objectIds = api.referencePlaneDependencyObjectIds(drag.handle.referencePlaneId, { renderableOnly: true });
    onLocalObjectProjectChange?.(nextProject, drag.handle.referencePlaneId, objectIds);
    renderOverlay();
  }

  function endDrag() {
    drag = null;
    renderOverlay();
  }

  api.subscribe(() => {
    if (!activeReferencePlaneId) return;
    if (!activePlane()) {
      clear();
      return;
    }
    renderOverlay();
  });

  return {
    clear,
    selectObject,
    authoringHandler: {
      beginDrag,
      drag: applyDrag,
      end: endDrag,
      cancel: endDrag
    }
  };
}
