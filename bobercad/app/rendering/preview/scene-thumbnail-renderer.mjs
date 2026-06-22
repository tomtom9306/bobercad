const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 112;
const FACE_LIMIT = 220;
const LINE_LIMIT = 260;

export function sceneRenderableCounts(scene = {}, objectIds = null) {
  const allowed = objectIds ? new Set(objectIds) : null;
  const faces = arrayValues(scene.faces).filter((face) => acceptsObject(face, allowed)).length;
  const lines = arrayValues(scene.lines).filter((line) => acceptsObject(line, allowed)).length;
  return { faces, lines };
}

export function renderSceneThumbnailDataUrl(scene = {}, options = {}) {
  const width = positiveNumber(options.width, DEFAULT_WIDTH);
  const height = positiveNumber(options.height, DEFAULT_HEIGHT);
  const allowed = options.objectIds ? new Set(options.objectIds) : null;
  const frameAllowed = options.frameObjectIds ? new Set(options.frameObjectIds) : allowed;
  const faces = arrayValues(scene.faces).filter((face) => acceptsObject(face, allowed) && validPointList(face.points));
  const lines = arrayValues(scene.lines).filter((line) => acceptsObject(line, allowed) && validPointList(line.points));
  const frameFaces = faces.filter((face) => acceptsObject(face, frameAllowed));
  const frameLines = lines.filter((line) => acceptsObject(line, frameAllowed));
  const projectedPoints = [
    ...frameFaces.flatMap((face) => face.points.map(projectPoint)),
    ...frameLines.flatMap((line) => line.points.map(projectPoint))
  ];
  const fallbackProjectedPoints = [
    ...faces.flatMap((face) => face.points.map(projectPoint)),
    ...lines.flatMap((line) => line.points.map(projectPoint))
  ];
  const framingPoints = projectedPoints.length ? projectedPoints : fallbackProjectedPoints;
  if (!framingPoints.length) return null;

  const bounds = expandedBounds(projectedBounds(framingPoints), positiveNumber(options.framePadding, 0.18));
  const margin = 8;
  const sx = (width - margin * 2) / Math.max(bounds.maxX - bounds.minX, 1);
  const sy = (height - margin * 2) / Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(sx, sy);
  const offsetX = margin + (width - margin * 2 - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = margin + (height - margin * 2 - (bounds.maxY - bounds.minY) * scale) / 2;
  const mapPoint = (point) => {
    const projected = projectPoint(point);
    return [
      round(offsetX + (projected[0] - bounds.minX) * scale),
      round(offsetY + (projected[1] - bounds.minY) * scale)
    ];
  };

  const faceNodes = faces
    .sort((a, b) => faceDepth(a) - faceDepth(b))
    .slice(0, FACE_LIMIT)
    .map((face) => {
      const points = face.points.map(mapPoint).map((point) => point.join(",")).join(" ");
      const color = svgColor(face.color || "#8aa0b4");
      return `<polygon points="${points}" fill="${color}" fill-opacity="0.92" stroke="${darken(color)}" stroke-opacity="0.28" stroke-width="0.7"/>`;
    });
  const lineNodes = lines.slice(0, LINE_LIMIT).map((line) => {
    const points = line.points.map(mapPoint).map((point) => point.join(",")).join(" ");
    const color = svgColor(line.color || "#41546a");
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-opacity="0.72" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" rx="6" fill="#f8fafc"/>`,
    `<g>${faceNodes.join("")}${lineNodes.join("")}</g>`,
    `</svg>`
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function acceptsObject(item, allowed) {
  if (!allowed) return true;
  return allowed.has(item?.objectId) || allowed.has(item?.lodDetailObjectId);
}

function arrayValues(value) {
  return Array.isArray(value) ? value : [];
}

function validPointList(points) {
  return Array.isArray(points) && points.length >= 2 && points.every((point) => (
    Array.isArray(point) && point.length >= 3 && point.every((value) => Number.isFinite(Number(value)))
  ));
}

function projectPoint(point) {
  const x = Number(point[0]);
  const y = Number(point[1]);
  const z = Number(point[2]);
  return [
    (x - y) * 0.866,
    (x + y) * 0.33 - z * 0.82
  ];
}

function projectedBounds(points) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point[0]),
    minY: Math.min(bounds.minY, point[1]),
    maxX: Math.max(bounds.maxX, point[0]),
    maxY: Math.max(bounds.maxY, point[1])
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  });
}

function expandedBounds(bounds, ratio) {
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) return bounds;
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const padX = width * ratio;
  const padY = height * ratio;
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY
  };
}

function faceDepth(face) {
  const points = arrayValues(face.points);
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + Number(point[0]) + Number(point[1]) + Number(point[2]) * 0.4, 0) / points.length;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function svgColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : "#8aa0b4";
}

function darken(color) {
  const hex = color.length === 4
    ? color.slice(1).split("").map((part) => `${part}${part}`).join("")
    : color.slice(1);
  const values = [0, 2, 4].map((index) => Math.max(0, Math.round(parseInt(hex.slice(index, index + 2), 16) * 0.72)));
  return `#${values.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
