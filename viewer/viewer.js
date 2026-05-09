const canvas = document.getElementById("view");
const gl = canvas.getContext("webgl", { antialias: true });
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");

const settingsUrl = new URL("./viewer_settings.json", window.location.href);
let scene = null;
let settings = null;
let camera = null;
let drag = null;
let renderer = null;

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) {
    const length = v.len(a);
    return length ? v.mul(a, 1 / length) : [0, 0, 0];
  }
};

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
}

function deepMerge(base, override) {
  const result = cloneValue(base || {});
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = isPlainObject(result[key]) && isPlainObject(value) ? deepMerge(result[key], value) : cloneValue(value);
  }
  return result;
}

function effectiveObject(project, collection, object) {
  const defaults = project.modelDefaults?.collections?.[collection] || {};
  return deepMerge(deepMerge(defaults["*"], defaults[object.type]), object);
}

function objectById(project, id) {
  const entry = project.objectIndex[id];
  return effectiveObject(project, entry.collection, project.model[entry.collection][id]);
}

function collectionObjects(project, collection) {
  return Object.values(project.model[collection] || {}).map((object) => effectiveObject(project, collection, object));
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function homeCamera() {
  const home = settings.camera.home;
  return { yaw: home.yaw, pitch: home.pitch, scale: home.scale, panX: home.pan[0], panY: home.pan[1] };
}

function applyUiSettings(project) {
  hud.hidden = !settings.ui.showHud;
  meta.hidden = !settings.ui.showMeta;
  reset.hidden = !settings.ui.showResetButton;
  title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function memberFrame(member) {
  const x = v.norm(v.sub(member.end, member.start));
  const up = [0, 0, 1];
  let y;
  let z;

  if (Math.abs(v.dot(x, up)) > 0.95) {
    y = [0, 1, 0];
    z = v.norm(v.cross(x, y));
  } else {
    z = v.norm(v.sub(up, v.mul(x, v.dot(up, x))));
    y = v.norm(v.cross(z, x));
  }

  const angle = (member.rotation || 0) * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x,
    y: v.add(v.mul(y, c), v.mul(z, s)),
    z: v.add(v.mul(z, c), v.mul(y, -s))
  };
}

function sectionPoint(origin, frame, point, xOffset = 0) {
  return v.add(origin, v.add(v.mul(frame.x, xOffset), v.add(v.mul(frame.y, point[0]), v.mul(frame.z, point[1]))));
}

function addLine(scene, a, b, color, width) {
  scene.lines.push({ points: [a, b], color, ...(width ? { width } : {}) });
}

function addLoopLines(scene, points, color, width) {
  for (let i = 0; i < points.length; i += 1) addLine(scene, points[i], points[(i + 1) % points.length], color, width);
}

function addBox(scene, body, display = {}) {
  const x = v.norm(body.axisX || [1, 0, 0]);
  const y = v.norm(body.axisY || [0, 1, 0]);
  const z = v.norm(body.axisZ || [0, 0, 1]);
  const size = body.size || [100, 100, 100];
  const color = display.color || "#ff3366";
  const opacity = display.transparent ? display.opacity ?? 0.28 : 1;
  const edgeColor = display.edgeColor || color;
  const c = body.center;
  const corner = (sx, sy, sz) => v.add(c, v.add(v.mul(x, sx * size[0] / 2), v.add(v.mul(y, sy * size[1] / 2), v.mul(z, sz * size[2] / 2))));
  const points = [
    corner(-1, -1, -1),
    corner(1, -1, -1),
    corner(1, 1, -1),
    corner(-1, 1, -1),
    corner(-1, -1, 1),
    corner(1, -1, 1),
    corner(1, 1, 1),
    corner(-1, 1, 1)
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0]
  ];

  for (const face of faces) {
    const facePoints = face.map((index) => points[index]);
    scene.faces.push({ points: facePoints, color, opacity });
    addLoopLines(scene, facePoints, edgeColor, settings.render.edges.weldLineWidth);
  }
}

function addPrism(scene, body, display = {}) {
  const x = v.norm(body.axisX || [1, 0, 0]);
  const y = v.norm(body.axisY || [0, 1, 0]);
  const z = v.norm(body.axisZ || [0, 0, 1]);
  const depth = body.depth || body.size?.[0] || 100;
  const color = display.color || "#ff3366";
  const opacity = display.transparent ? display.opacity ?? 0.28 : 1;
  const edgeColor = display.edgeColor || color;
  const mid = (point) => v.add(body.center, v.add(v.mul(y, point[0]), v.mul(z, point[1])));
  const back = body.outline.map((point) => v.add(mid(point), v.mul(x, -depth / 2)));
  const front = body.outline.map((point) => v.add(mid(point), v.mul(x, depth / 2)));

  if (display.fill !== false) {
    scene.faces.push({ points: back, color, opacity });
    scene.faces.push({ points: [...front].reverse(), color, opacity });
  }
  addLoopLines(scene, back, edgeColor, settings.render.edges.weldLineWidth);
  addLoopLines(scene, front, edgeColor, settings.render.edges.weldLineWidth);
  for (let i = 0; i < back.length; i += 1) {
    const j = (i + 1) % back.length;
    if (display.fill !== false) scene.faces.push({ points: [back[i], back[j], front[j], front[i]], color, opacity });
    addLine(scene, back[i], front[i], edgeColor, settings.render.edges.weldLineWidth);
  }
}

function addCylinder(scene, body, display = {}) {
  const x = v.norm(body.axisX || body.axis || [1, 0, 0]);
  const y = v.norm(body.axisY || [0, 1, 0]);
  const z = v.norm(body.axisZ || [0, 0, 1]);
  const depth = body.depth || body.size?.[0] || 100;
  const radius = body.radius || body.diameter / 2 || 30;
  const color = display.color || "#ff3366";
  const opacity = display.transparent ? display.opacity ?? 0.28 : 1;
  const edgeColor = display.edgeColor || color;
  const segments = settings.render.curves.circleSegments;
  const ring = (offset) => {
    const center = v.add(body.center, v.mul(x, offset));
    const points = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i / segments * Math.PI * 2;
      points.push(v.add(center, v.add(v.mul(y, Math.cos(a) * radius), v.mul(z, Math.sin(a) * radius))));
    }
    return points;
  };
  const back = ring(-depth / 2);
  const front = ring(depth / 2);

  if (display.fill !== false) {
    scene.faces.push({ points: back, color, opacity });
    scene.faces.push({ points: [...front].reverse(), color, opacity });
  }
  addLoopLines(scene, back, edgeColor, settings.render.edges.weldLineWidth);
  addLoopLines(scene, front, edgeColor, settings.render.edges.weldLineWidth);
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    if (display.fill !== false) scene.faces.push({ points: [back[i], back[j], front[j], front[i]], color, opacity });
    if (display.fill === false && i % Math.max(1, Math.floor(segments / 8)) === 0) addLine(scene, back[i], front[i], edgeColor, settings.render.edges.weldLineWidth);
  }
}

function addPlaneMarker(scene, plane, display = {}) {
  const x = v.norm(plane.axisX || [1, 0, 0]);
  const y = v.norm(plane.axisY || [0, 1, 0]);
  const size = plane.size || [220, 220];
  const color = display.color || "#ef4444";
  const opacity = display.transparent ? display.opacity ?? 0.18 : 0.18;
  const points = [
    v.add(plane.origin, v.add(v.mul(x, -size[0] / 2), v.mul(y, -size[1] / 2))),
    v.add(plane.origin, v.add(v.mul(x, size[0] / 2), v.mul(y, -size[1] / 2))),
    v.add(plane.origin, v.add(v.mul(x, size[0] / 2), v.mul(y, size[1] / 2))),
    v.add(plane.origin, v.add(v.mul(x, -size[0] / 2), v.mul(y, size[1] / 2)))
  ];

  scene.faces.push({ points, color, opacity });
  addLoopLines(scene, points, color, settings.render.edges.weldLineWidth);
}

function boxCorners(body) {
  const x = v.norm(body.axisX || [1, 0, 0]);
  const y = v.norm(body.axisY || [0, 1, 0]);
  const z = v.norm(body.axisZ || [0, 0, 1]);
  const size = body.size || [100, 100, 100];
  const c = body.center;
  const corner = (sx, sy, sz) => v.add(c, v.add(v.mul(x, sx * size[0] / 2), v.add(v.mul(y, sy * size[1] / 2), v.mul(z, sz * size[2] / 2))));
  return [
    corner(-1, -1, -1),
    corner(1, -1, -1),
    corner(1, 1, -1),
    corner(-1, 1, -1),
    corner(-1, -1, 1),
    corner(1, -1, 1),
    corner(1, 1, 1),
    corner(-1, 1, 1)
  ];
}

function memberFeatures(project, member) {
  return (member.featureIds || []).map((id) => objectById(project, id)).filter((feature) => feature.ownerId === member.id);
}

function endCutFeatures(project, member) {
  const cuts = { start: null, end: null };
  for (const feature of memberFeatures(project, member)) {
    if (!["saw-cut", "miter-cut", "end-cut"].includes(feature.type)) continue;
    const memberEnd = feature.reference?.memberEnd;
    if (memberEnd === "start" || memberEnd === "end") cuts[memberEnd] = feature;
  }
  return cuts;
}

function endCutOffset(cut, point, side) {
  if (!cut) return 0;
  const angleY = (cut.cut?.angleY || 0) * Math.PI / 180;
  const angleZ = (cut.cut?.angleZ || 0) * Math.PI / 180;
  const offset = point[0] * Math.tan(angleY) + point[1] * Math.tan(angleZ);
  return side === "start" ? offset : -offset;
}

function sectionBounds(profile) {
  const points = profile.section.contours.flatMap((contour) => contour.role === "solid" ? contour.points : []);
  return {
    minY: Math.min(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[0])),
    minZ: Math.min(...points.map((point) => point[1])),
    maxZ: Math.max(...points.map((point) => point[1]))
  };
}

function localMemberPoint(member, frame, point) {
  const d = v.sub(point, member.start);
  return [v.dot(d, frame.x), v.dot(d, frame.y), v.dot(d, frame.z)];
}

function memberBoxCuts(project, member, frame, profile) {
  const length = v.len(v.sub(member.end, member.start));
  const bounds = sectionBounds(profile);
  const tolerance = settings.tolerances?.coincident || 1;
  const cuts = [];

  for (const feature of memberFeatures(project, member)) {
    if (feature.type !== "boolean-part" || feature.booleanType !== "BOOLEAN_CUT" || feature.body?.type !== "box") continue;
    const localCorners = boxCorners(feature.body).map((point) => localMemberPoint(member, frame, point));
    const cut = {
      xMin: Math.max(0, Math.min(...localCorners.map((point) => point[0]))),
      xMax: Math.min(length, Math.max(...localCorners.map((point) => point[0]))),
      yMin: Math.min(...localCorners.map((point) => point[1])),
      yMax: Math.max(...localCorners.map((point) => point[1])),
      zMin: Math.min(...localCorners.map((point) => point[2])),
      zMax: Math.max(...localCorners.map((point) => point[2]))
    };

    const spansWidth = cut.yMin <= bounds.minY + tolerance && cut.yMax >= bounds.maxY - tolerance;
    const reachesTop = cut.zMax >= bounds.maxZ - tolerance && cut.zMin < bounds.maxZ - tolerance;
    if (cut.xMax > cut.xMin + tolerance && spansWidth && reachesTop) cuts.push(cut);
  }

  return cuts;
}

function clipSectionMaxZ(points, maxZ) {
  const clipped = [];

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[(i - 1 + points.length) % points.length];
    const currentInside = current[1] <= maxZ;
    const previousInside = previous[1] <= maxZ;

    if (currentInside !== previousInside) {
      const t = (maxZ - previous[1]) / (current[1] - previous[1]);
      clipped.push([previous[0] + (current[0] - previous[0]) * t, maxZ]);
    }
    if (currentInside) clipped.push(current);
  }

  return clipped.filter((point, index) => {
    const previous = clipped[(index - 1 + clipped.length) % clipped.length];
    return !previous || Math.abs(point[0] - previous[0]) > 0.001 || Math.abs(point[1] - previous[1]) > 0.001;
  });
}

function activeSectionCut(cuts, x0, x1) {
  const mid = (x0 + x1) / 2;
  const active = cuts.filter((cut) => mid >= cut.xMin && mid <= cut.xMax);
  if (!active.length) return null;
  return { maxZ: Math.min(...active.map((cut) => cut.zMin)) - 0.001 };
}

function addTopCutFace(scene, member, frame, profile, cut, xStation, color, edgeColor) {
  const bounds = sectionBounds(profile);
  const zMin = Math.max(bounds.minZ, cut.zMin);
  if (zMin >= bounds.maxZ) return;

  const points = [
    sectionPoint(member.start, frame, [bounds.minY, bounds.maxZ], xStation),
    sectionPoint(member.start, frame, [bounds.maxY, bounds.maxZ], xStation),
    sectionPoint(member.start, frame, [bounds.maxY, zMin], xStation),
    sectionPoint(member.start, frame, [bounds.minY, zMin], xStation)
  ];

  scene.faces.push({ points, color });
  addLoopLines(scene, points, edgeColor);
}

function webSideYs(profile) {
  const ys = profile.section.contours.flatMap((contour) => contour.role === "solid" ? contour.points.map((point) => point[0]) : []);
  const minAbs = Math.min(...ys.map(Math.abs).filter((value) => value > 0.001));
  return [...new Set(ys.filter((value) => Math.abs(Math.abs(value) - minAbs) < 0.001))].sort((a, b) => a - b);
}

function circleOutline(centerX, centerZ, radius) {
  const points = [];
  for (let i = 0; i < settings.render.curves.circleSegments; i += 1) {
    const a = i / settings.render.curves.circleSegments * Math.PI * 2;
    points.push([centerX + Math.cos(a) * radius, centerZ + Math.sin(a) * radius]);
  }
  return points;
}

function memberInternalCutOpenings(project, member, frame) {
  const openings = [];

  for (const feature of memberFeatures(project, member)) {
    if (feature.type !== "boolean-part" || feature.booleanType !== "BOOLEAN_CUT" || !feature.body) continue;
    const body = feature.body;
    const cutAxis = v.norm(body.axisX || body.axis || [0, 1, 0]);
    if (Math.abs(v.dot(cutAxis, frame.y)) < 0.8) continue;

    let outline = null;
    if (body.type === "cylinder") {
      const center = localMemberPoint(member, frame, body.center);
      outline = circleOutline(center[0], center[2], body.radius || body.diameter / 2 || 30);
    }

    if (body.type === "polygonal-prism") {
      const axisY = v.norm(body.axisY || [1, 0, 0]);
      const axisZ = v.norm(body.axisZ || [0, 0, 1]);
      outline = body.outline.map((point) => {
        const world = v.add(body.center, v.add(v.mul(axisY, point[0]), v.mul(axisZ, point[1])));
        const local = localMemberPoint(member, frame, world);
        return [local[0], local[2]];
      });
    }

    if (!outline) continue;
    openings.push({
      outline,
      edgeColor: feature.display?.color || "#ef4444",
      xMin: Math.min(...outline.map((point) => point[0])),
      xMax: Math.max(...outline.map((point) => point[0])),
      zMin: Math.min(...outline.map((point) => point[1])),
      zMax: Math.max(...outline.map((point) => point[1]))
    });
  }

  return openings;
}

function webFacePoint(member, frame, webY, x, z) {
  return sectionPoint(member.start, frame, [webY, z], x);
}

function addWebFaceRect(scene, member, frame, webY, rect, color, edgeColor) {
  if (rect.xMax - rect.xMin < 0.001 || rect.zMax - rect.zMin < 0.001) return;
  const world = (x, z) => webFacePoint(member, frame, webY, x, z);
  const points = [
    world(rect.xMin, rect.zMin),
    world(rect.xMax, rect.zMin),
    world(rect.xMax, rect.zMax),
    world(rect.xMin, rect.zMax)
  ];

  scene.faces.push({ points, color });
  addLoopLines(scene, points, edgeColor);
}

function addWebFaceQuad(scene, member, frame, webY, points2d, color) {
  const points = points2d.map((point) => webFacePoint(member, frame, webY, point[0], point[1]));
  if (points2d.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return;
  scene.faces.push({ points, color, hideEdges: true });
}

function polygonVerticalIntersections(points, x) {
  const zs = [];
  const eps = 0.000001;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    if (Math.abs(a[0] - b[0]) < eps || x < minX - eps || x >= maxX - eps) continue;

    const t = (x - a[0]) / (b[0] - a[0]);
    if (t >= -eps && t <= 1 + eps) zs.push(a[1] + (b[1] - a[1]) * t);
  }

  return zs
    .sort((a, b) => a - b)
    .filter((z, index, values) => index === 0 || Math.abs(z - values[index - 1]) > 0.0001);
}

function openingSpanAtX(opening, x, rect) {
  const eps = 0.001;
  const safeX = Math.max(opening.xMin + eps, Math.min(opening.xMax - eps, x));
  const zs = polygonVerticalIntersections(opening.outline, safeX)
    .map((z) => Math.max(rect.zMin, Math.min(rect.zMax, z)));

  return zs.length >= 2 ? [zs[0], zs[zs.length - 1]] : null;
}

function addWebFaceWithOpening(scene, member, frame, webY, rect, opening, color, edgeColor) {
  const stations = [rect.xMin, rect.xMax, ...opening.outline.map((point) => point[0])]
    .filter((x) => x >= rect.xMin - 0.001 && x <= rect.xMax + 0.001)
    .map((x) => Math.max(rect.xMin, Math.min(rect.xMax, x)))
    .sort((a, b) => a - b)
    .filter((x, index, values) => index === 0 || Math.abs(x - values[index - 1]) > 0.001);

  for (let i = 0; i < stations.length - 1; i += 1) {
    const left = stations[i];
    const right = stations[i + 1];
    if (right - left < 0.001) continue;

    const midSpan = openingSpanAtX(opening, (left + right) / 2, rect);
    if (!midSpan) {
      addWebFaceRect(scene, member, frame, webY, { ...rect, xMin: left, xMax: right }, color, edgeColor);
      continue;
    }

    const leftSpan = openingSpanAtX(opening, left, rect) || midSpan;
    const rightSpan = openingSpanAtX(opening, right, rect) || midSpan;
    const bottomLeft = leftSpan[0];
    const bottomRight = rightSpan[0];
    const topLeft = leftSpan[1];
    const topRight = rightSpan[1];

    if (Math.max(bottomLeft, bottomRight) > rect.zMin + 0.001) {
      addWebFaceQuad(scene, member, frame, webY, [
        [left, rect.zMin],
        [right, rect.zMin],
        [right, bottomRight],
        [left, bottomLeft]
      ], color);
    }

    if (Math.min(topLeft, topRight) < rect.zMax - 0.001) {
      addWebFaceQuad(scene, member, frame, webY, [
        [left, topLeft],
        [right, topRight],
        [right, rect.zMax],
        [left, rect.zMax]
      ], color);
    }
  }

  const world = (x, z) => webFacePoint(member, frame, webY, x, z);
  addLine(scene, world(rect.xMin, rect.zMin), world(rect.xMax, rect.zMin), edgeColor);
  addLine(scene, world(rect.xMin, rect.zMax), world(rect.xMax, rect.zMax), edgeColor);

  for (const x of [rect.xMin, rect.xMax]) {
    if (opening.zMin > rect.zMin + 0.001) addLine(scene, world(x, rect.zMin), world(x, opening.zMin), edgeColor);
    if (opening.zMax < rect.zMax - 0.001) addLine(scene, world(x, opening.zMax), world(x, rect.zMax), edgeColor);
  }

  addLoopLines(scene, opening.outline.map((point) => world(point[0], point[1])), opening.edgeColor, settings.render.edges.weldLineWidth);
}

function addWebFace(scene, member, frame, webY, rect, openings, color, edgeColor) {
  const margin = settings.tolerances?.coincident || 1;
  let cursor = rect.xMin;
  const active = openings
    .filter((opening) => opening.xMax > rect.xMin && opening.xMin < rect.xMax && opening.zMax > rect.zMin && opening.zMin < rect.zMax)
    .sort((a, b) => a.xMin - b.xMin);

  if (!active.length) {
    addWebFaceRect(scene, member, frame, webY, rect, color, edgeColor);
    return;
  }

  for (const opening of active) {
    const xMin = Math.max(rect.xMin, opening.xMin - margin);
    const xMax = Math.min(rect.xMax, opening.xMax + margin);
    if (xMin > cursor) addWebFaceRect(scene, member, frame, webY, { ...rect, xMin: cursor, xMax: xMin }, color, edgeColor);
    addWebFaceWithOpening(scene, member, frame, webY, { ...rect, xMin, xMax }, opening, color, edgeColor);
    cursor = Math.max(cursor, xMax);
  }

  if (cursor < rect.xMax) addWebFaceRect(scene, member, frame, webY, { ...rect, xMin: cursor }, color, edgeColor);
}

function addMember(scene, project, member, profile) {
  const frame = memberFrame(member);
  const color = member.display?.color || "#78909c";
  const edgeColor = member.display?.edgeColor || color || settings.render.edges.defaultColor;
  const cuts = endCutFeatures(project, member);
  const boxCuts = memberBoxCuts(project, member, frame, profile);
  const webYs = webSideYs(profile);
  const internalOpenings = memberInternalCutOpenings(project, member, frame);
  const length = v.len(v.sub(member.end, member.start));
  const stations = [0, length, ...boxCuts.flatMap((cut) => [cut.xMin, cut.xMax])]
    .filter((station) => station >= 0 && station <= length)
    .sort((a, b) => a - b)
    .filter((station, index, values) => index === 0 || Math.abs(station - values[index - 1]) > 0.001);

  const addSegment = (x0, x1) => {
    const activeCut = activeSectionCut(boxCuts, x0, x1);

    for (const contour of profile.section.contours) {
      const section = activeCut && contour.role === "solid" ? clipSectionMaxZ(contour.points, activeCut.maxZ) : contour.points;
      if (section.length < 3) continue;
      const a = section.map((point) => sectionPoint(member.start, frame, point, x0 + (x0 === 0 ? endCutOffset(cuts.start, point, "start") : 0)));
      const b = section.map((point) => sectionPoint(member.start, frame, point, x1 + (Math.abs(x1 - length) < 0.001 ? endCutOffset(cuts.end, point, "end") : 0)));
      const isSolid = contour.role === "solid";

      if (isSolid) {
        if (x0 < 0.001) scene.faces.push({ points: a, color });
        if (Math.abs(x1 - length) < 0.001) scene.faces.push({ points: [...b].reverse(), color });
      }

      for (let i = 0; i < section.length; i += 1) {
        const j = (i + 1) % section.length;
        const webY = webYs.find((value) => Math.abs(section[i][0] - section[j][0]) < 0.001 && Math.abs(section[i][0] - value) < 0.001);
        if (isSolid) {
          if (webY !== undefined && internalOpenings.length) {
            addWebFace(scene, member, frame, webY, {
              xMin: x0,
              xMax: x1,
              zMin: Math.min(section[i][1], section[j][1]),
              zMax: Math.max(section[i][1], section[j][1])
            }, internalOpenings, color, edgeColor);
          } else {
            scene.faces.push({ points: [a[i], a[j], b[j], b[i]], color });
          }
        }
        if (webY === undefined || !internalOpenings.length) {
          addLine(scene, a[i], a[j], edgeColor);
          addLine(scene, b[i], b[j], edgeColor);
          addLine(scene, a[i], b[i], edgeColor);
        }
      }
    }
  };

  for (let i = 0; i < stations.length - 1; i += 1) {
    if (stations[i + 1] - stations[i] > 0.001) addSegment(stations[i], stations[i + 1]);
  }

  for (const cut of boxCuts) {
    if (cut.xMin > 0.001) addTopCutFace(scene, member, frame, profile, cut, cut.xMin, color, edgeColor);
    if (cut.xMax < length - 0.001) addTopCutFace(scene, member, frame, profile, cut, cut.xMax, color, edgeColor);
  }
}

function addPlateSolid(scene, midPoints, normal, thickness, color, edgeColor) {
  const n = v.norm(normal);
  const hx = thickness / 2;
  const back = midPoints.map((point) => v.add(point, v.mul(n, -hx)));
  const front = midPoints.map((point) => v.add(point, v.mul(n, hx)));

  scene.faces.push({ points: back, color });
  scene.faces.push({ points: [...front].reverse(), color });
  addLoopLines(scene, back, edgeColor);
  addLoopLines(scene, front, edgeColor);
  for (let i = 0; i < midPoints.length; i += 1) {
    const j = (i + 1) % midPoints.length;
    scene.faces.push({ points: [back[i], back[j], front[j], front[i]], color });
    addLine(scene, back[i], front[i], edgeColor);
  }
}

function addBentPlate(scene, plate) {
  const bend = plate.flatPattern?.bendLines?.[0];
  if (!bend) return false;

  const y = v.norm(plate.localAxisY);
  const z = v.norm(plate.localAxisZ);
  const n = v.norm(plate.normal);
  const color = plate.display?.color || "#a6a6a6";
  const edgeColor = settings.render.edges.plateColor;
  const outline = plate.flatPattern.outline;
  const minY = Math.min(...outline.map((point) => point[0]));
  const maxY = Math.max(...outline.map((point) => point[0]));
  const minZ = Math.min(...outline.map((point) => point[1]));
  const maxZ = Math.max(...outline.map((point) => point[1]));
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const direction = bend.direction === "down" ? -1 : 1;
  const angle = direction * (bend.angle || 0) * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const flatPoint = (py, pz) => v.add(plate.center, v.add(v.mul(y, py - centerY), v.mul(z, pz - centerZ)));

  if (bend.start[0] === bend.end[0]) {
    const bendY = bend.start[0];
    const bentY = v.norm(v.add(v.mul(y, c), v.mul(n, s)));
    const bentNormal = v.norm(v.cross(bentY, z));
    const bentPoint = (py, pz) => py <= bendY ? flatPoint(py, pz) : v.add(flatPoint(bendY, pz), v.mul(bentY, py - bendY));
    const flatPanel = [
      flatPoint(minY, minZ),
      flatPoint(bendY, minZ),
      flatPoint(bendY, maxZ),
      flatPoint(minY, maxZ)
    ];
    const bentPanel = [
      bentPoint(bendY, minZ),
      bentPoint(maxY, minZ),
      bentPoint(maxY, maxZ),
      bentPoint(bendY, maxZ)
    ];

    addPlateSolid(scene, flatPanel, n, plate.thickness, color, edgeColor);
    addPlateSolid(scene, bentPanel, bentNormal, plate.thickness, color, edgeColor);
    addLine(scene, flatPoint(bendY, minZ), flatPoint(bendY, maxZ), "#111827", settings.render.edges.weldLineWidth);
    return true;
  }

  if (bend.start[1] === bend.end[1]) {
    const bendZ = bend.start[1];
    const bentZ = v.norm(v.add(v.mul(z, c), v.mul(n, s)));
    const bentNormal = v.norm(v.cross(y, bentZ));
    const bentPoint = (py, pz) => pz <= bendZ ? flatPoint(py, pz) : v.add(flatPoint(py, bendZ), v.mul(bentZ, pz - bendZ));
    const flatPanel = [
      flatPoint(minY, minZ),
      flatPoint(maxY, minZ),
      flatPoint(maxY, bendZ),
      flatPoint(minY, bendZ)
    ];
    const bentPanel = [
      bentPoint(minY, bendZ),
      bentPoint(maxY, bendZ),
      bentPoint(maxY, maxZ),
      bentPoint(minY, maxZ)
    ];

    addPlateSolid(scene, flatPanel, n, plate.thickness, color, edgeColor);
    addPlateSolid(scene, bentPanel, bentNormal, plate.thickness, color, edgeColor);
    addLine(scene, flatPoint(minY, bendZ), flatPoint(maxY, bendZ), "#111827", settings.render.edges.weldLineWidth);
    return true;
  }

  return false;
}

function addPlate(scene, plate) {
  if (plate.flatPattern?.bendLines?.length && addBentPlate(scene, plate)) return;

  const n = v.norm(plate.normal);
  const y = v.norm(plate.localAxisY);
  const z = v.norm(plate.localAxisZ);
  const color = plate.display?.color || "#a6a6a6";
  const edgeColor = settings.render.edges.plateColor;
  const outline = plate.outline || [
    [-plate.width / 2, -plate.height / 2],
    [plate.width / 2, -plate.height / 2],
    [plate.width / 2, plate.height / 2],
    [-plate.width / 2, plate.height / 2]
  ];
  const midPoints = outline.map((point) => v.add(plate.center, v.add(v.mul(y, point[0]), v.mul(z, point[1]))));

  addPlateSolid(scene, midPoints, n, plate.thickness, color, edgeColor);
}

function addCircleLine(scene, center, axisY, axisZ, radius, color) {
  const points = [];
  const segments = settings.render.curves.circleSegments;
  for (let i = 0; i < segments; i += 1) {
    const a = i / segments * Math.PI * 2;
    points.push(v.add(center, v.add(v.mul(axisY, Math.cos(a) * radius), v.mul(axisZ, Math.sin(a) * radius))));
  }
  addLoopLines(scene, points, color);
}

function addSlotLine(scene, center, axisY, axisZ, length, width, angle, color) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const major = v.norm(v.add(v.mul(axisY, c), v.mul(axisZ, s)));
  const minor = v.norm(v.add(v.mul(axisZ, c), v.mul(axisY, -s)));
  const radius = width / 2;
  const straight = Math.max(0, length - width) / 2;
  const left = v.add(center, v.mul(major, -straight));
  const right = v.add(center, v.mul(major, straight));
  const points = [];
  const segments = Math.max(8, Math.floor(settings.render.curves.circleSegments / 2));

  for (let i = 0; i <= segments; i += 1) {
    const a = Math.PI / 2 + i / segments * Math.PI;
    points.push(v.add(left, v.add(v.mul(major, Math.cos(a) * radius), v.mul(minor, Math.sin(a) * radius))));
  }
  for (let i = 0; i <= segments; i += 1) {
    const a = -Math.PI / 2 + i / segments * Math.PI;
    points.push(v.add(right, v.add(v.mul(major, Math.cos(a) * radius), v.mul(minor, Math.sin(a) * radius))));
  }

  addLoopLines(scene, points, color, settings.render.edges.weldLineWidth);
}

function addDisc(scene, center, axisY, axisZ, radius, color) {
  const points = [];
  const segments = settings.render.curves.discSegments;
  for (let i = 0; i < segments; i += 1) {
    const a = i / segments * Math.PI * 2;
    points.push(v.add(center, v.add(v.mul(axisY, Math.cos(a) * radius), v.mul(axisZ, Math.sin(a) * radius))));
  }
  scene.faces.push({ points, color });
  addLoopLines(scene, points, settings.render.edges.fastenerHeadColor, settings.render.edges.fastenerHeadLineWidth);
}

function featureOrigin(project, feature) {
  const ref = feature.reference;
  if (ref.kind === "plate-face") {
    const plate = objectById(project, feature.ownerId);
    const normal = v.norm(plate.normal);
    const faceOffset = ref.face === "front" ? -plate.thickness / 2 : ref.face === "back" ? plate.thickness / 2 : 0;
    return {
      origin: v.add(plate.center, v.mul(normal, faceOffset)),
      normal,
      y: v.norm(ref.localAxisY || plate.localAxisY),
      z: v.norm(ref.localAxisZ || plate.localAxisZ)
    };
  }
  return {
    origin: ref.origin,
    normal: v.norm(ref.normal || [1, 0, 0]),
    y: v.norm(ref.localAxisY || [0, 1, 0]),
    z: v.norm(ref.localAxisZ || [0, 0, 1])
  };
}

function addCutBody(scene, feature) {
  if (feature.display?.visible === false) return;
  if (feature.type === "cut-plane" || feature.type === "fitting") {
    if (feature.plane) addPlaneMarker(scene, feature.plane, feature.display || {});
    return;
  }
  if (feature.type !== "boolean-part" || !["BOOLEAN_CUT", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) return;
  const display = feature.booleanType === "BOOLEAN_CUT"
    ? { ...(feature.display || {}), transparent: true, opacity: Math.min(feature.display?.opacity ?? 0.28, 0.06), fill: feature.body?.type === "box" }
    : feature.display || {};
  if (feature.body?.type === "box") addBox(scene, feature.body, display);
  if (feature.body?.type === "polygonal-prism") addPrism(scene, feature.body, display);
  if (feature.body?.type === "cylinder") addCylinder(scene, feature.body, display);
}

function addHoleOutlines(scene, project, feature) {
  if (!feature.holePatternRef) return;
  const pattern = objectById(project, feature.holePatternRef);
  const basis = featureOrigin(project, feature);
  const radius = pattern.holeDiameter / 2;
  const color = settings.render.edges.holeColor;

  for (const position of pattern.positions) {
    const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
    addCircleLine(scene, center, basis.y, basis.z, radius, color);
  }
}

function addCutOutline(scene, feature) {
  if (!feature.reference) return;
  const basis = featureOrigin(scene.project, feature);
  const color = "#ef4444";

  if (feature.type === "slot-hole") {
    const position = feature.position || [0, 0];
    const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
    addSlotLine(scene, center, basis.y, basis.z, feature.slot?.length || 40, feature.slot?.width || 18, (feature.slot?.orientation || 0) * Math.PI / 180, color);
    return;
  }

  if (["saw-cut", "miter-cut", "end-cut"].includes(feature.type)) {
    const width = feature.dimensions?.width || 180;
    const height = feature.dimensions?.height || 240;
    const angle = ((feature.cut?.angleY || 0) + (feature.cut?.angleZ || 0)) * Math.PI / 180;
    const dy = Math.cos(angle) * width / 2;
    const dz = Math.sin(angle) * height / 2;
    addLine(
      scene,
      v.add(basis.origin, v.add(v.mul(basis.y, -dy), v.mul(basis.z, -height / 2 - dz))),
      v.add(basis.origin, v.add(v.mul(basis.y, dy), v.mul(basis.z, height / 2 + dz))),
      color,
      settings.render.edges.weldLineWidth
    );
    return;
  }

  if (["cope", "notch", "top-flange-notch"].includes(feature.type)) {
    const length = feature.dimensions?.length || 80;
    const depth = feature.dimensions?.depth || 45;
    const points = [
      v.add(basis.origin, v.add(v.mul(basis.y, -length / 2), v.mul(basis.z, -depth / 2))),
      v.add(basis.origin, v.add(v.mul(basis.y, length / 2), v.mul(basis.z, -depth / 2))),
      v.add(basis.origin, v.add(v.mul(basis.y, length / 2), v.mul(basis.z, depth / 2))),
      v.add(basis.origin, v.add(v.mul(basis.y, -length / 2), v.mul(basis.z, depth / 2)))
    ];
    addLoopLines(scene, points, color, settings.render.edges.weldLineWidth);
  }
}

function addFeatureOutlines(scene, project, feature) {
  addCutBody(scene, feature);
  addHoleOutlines(scene, project, feature);
  addCutOutline(scene, feature);
}

function fastenerDefinition(scene, fastenerGroup) {
  if (!fastenerGroup.fastenerRef) throw new Error(`${fastenerGroup.id}: missing fastenerRef`);
  const fastener = scene.fasteners[fastenerGroup.fastenerRef];
  if (!fastener) throw new Error(`${fastenerGroup.id}: fastenerRef not found in fastener library: ${fastenerGroup.fastenerRef}`);
  return fastener;
}

function addFastenerGroups(scene, project) {
  for (const fastenerGroup of collectionObjects(project, "fastenerGroups")) {
    if (fastenerGroup.display?.visible === false) continue;
    const pattern = objectById(project, fastenerGroup.holePatternRef);
    const feature = objectById(project, fastenerGroup.through.fromFeatureId);
    const basis = featureOrigin(project, feature);
    const radius = fastenerDefinition(scene, fastenerGroup).shank.diameter / 2;
    const length = settings.render.fasteners.length;
    const sides = settings.render.fasteners.sides;
    const color = fastenerGroup.display?.color || "#b7791f";

    for (const position of pattern.positions) {
      const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
      const a = v.add(center, v.mul(basis.normal, -length / 2));
      const b = v.add(center, v.mul(basis.normal, length / 2));
      const ringA = [];
      const ringB = [];

      for (let i = 0; i < sides; i += 1) {
        const t = i / sides * Math.PI * 2;
        const offset = v.add(v.mul(basis.y, Math.cos(t) * radius), v.mul(basis.z, Math.sin(t) * radius));
        ringA.push(v.add(a, offset));
        ringB.push(v.add(b, offset));
      }

      scene.faces.push({ points: ringA, color });
      scene.faces.push({ points: [...ringB].reverse(), color });
      addDisc(scene, v.add(center, v.mul(basis.normal, -2)), basis.y, basis.z, radius * settings.render.fasteners.headRadiusFactor, color);
      for (let i = 0; i < sides; i += 1) {
        const j = (i + 1) % sides;
        scene.faces.push({ points: [ringA[i], ringA[j], ringB[j], ringB[i]], color });
      }
    }
  }
}

function addWelds(scene, project) {
  for (const weld of collectionObjects(project, "welds")) {
    if (weld.display?.visible === false) continue;
    const member = objectById(project, weld.reference.memberId);
    const profile = scene.profiles[member.profile];
    const frame = memberFrame(member);
    const origin = weld.reference.end === "start" ? member.start : member.end;
    const color = weld.display?.color || "#f6e05e";

    for (const contour of profile.section.contours) {
      if (contour.role !== "solid") continue;
      const points = contour.points.map((point) => sectionPoint(origin, frame, point));
      addLoopLines(scene, points, color, settings.render.edges.weldLineWidth);
    }
  }
}

function buildScene(project, profiles, fasteners) {
  const sceneData = { faces: [], lines: [], vertices: [], profiles: profiles.profiles, fasteners: fasteners.fasteners, project };

  for (const member of collectionObjects(project, "members")) {
    if (member.display?.visible === false) continue;
    addMember(sceneData, project, member, profiles.profiles[member.profile]);
  }

  for (const plate of collectionObjects(project, "plates")) {
    if (plate.display?.visible === false) continue;
    addPlate(sceneData, plate);
  }

  for (const feature of collectionObjects(project, "features")) addFeatureOutlines(sceneData, project, feature);
  addFastenerGroups(sceneData, project);
  addWelds(sceneData, project);

  for (const face of sceneData.faces) sceneData.vertices.push(...face.points);
  for (const line of sceneData.lines) sceneData.vertices.push(...line.points);
  sceneData.bounds = bounds(sceneData.vertices);
  return sceneData;
}

function bounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], point[i]);
      max[i] = Math.max(max[i], point[i]);
    }
  }
  const size = v.sub(max, min);
  return { min, max, center: v.mul(v.add(min, max), 0.5), depthHalf: Math.max(1, v.len(size) / 2) };
}

function rotate(point) {
  const p = v.sub(point, scene.bounds.center);
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const x = cy * p[0] - sy * p[1];
  const y = sy * p[0] + cy * p[1];
  const z = p[2];
  return [x, cp * y - sp * z, sp * y + cp * z];
}

function fitCamera() {
  const projected = scene.vertices.map((point) => {
    const r = rotate(point);
    return [r[0], r[1]];
  });
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const point of projected) {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
  }
  const width = Math.max(1, max[0] - min[0]);
  const height = Math.max(1, max[1] - min[1]);
  camera.scale = Math.min(canvas.width * settings.camera.fit.padding / width, canvas.height * settings.camera.fit.padding / height);
  camera.panX = 0;
  camera.panY = 0;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

function faceNormal(points) {
  if (points.length < 3) return [0, 0, 1];
  return v.norm(v.cross(v.sub(points[1], points[0]), v.sub(points[2], points[0])));
}

function shadedRgba(color, points, opacity = 1) {
  const rgb = hexToRgb(color);
  const n = faceNormal(points);
  const light = v.norm(settings.render.lighting.direction);
  const shade = settings.render.lighting.ambient + Math.max(0, v.dot(n, light)) * settings.render.lighting.diffuse;
  return [
    Math.round(rgb[0] * shade),
    Math.round(rgb[1] * shade),
    Math.round(rgb[2] * shade),
    Math.round(255 * opacity)
  ];
}

function hexToRgba(color) {
  const rgb = hexToRgb(color);
  return [rgb[0], rgb[1], rgb[2], 255];
}

function edge(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function screenArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInTriangle(p, a, b, c) {
  const d1 = edge(a, b, p);
  const d2 = edge(b, c, p);
  const d3 = edge(c, a, p);
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
}

function projectFacePoint(point, dropAxis) {
  if (dropAxis === 0) return { x: point[1], y: point[2] };
  if (dropAxis === 1) return { x: point[0], y: point[2] };
  return { x: point[0], y: point[1] };
}

function triangulateFace(points) {
  if (points.length < 3) return [];
  if (points.length === 3) return [[points[0], points[1], points[2]]];

  const normal = faceNormal(points);
  const absNormal = normal.map(Math.abs);
  const dropAxis = absNormal[0] > absNormal[1] && absNormal[0] > absNormal[2] ? 0 : absNormal[1] > absNormal[2] ? 1 : 2;
  const flatPoints = points.map((point) => projectFacePoint(point, dropAxis));
  const triangles = [];
  const indexes = flatPoints.map((_, index) => index);
  const orientation = screenArea(flatPoints) >= 0 ? 1 : -1;

  while (indexes.length > 3) {
    let earFound = false;
    for (let i = 0; i < indexes.length; i += 1) {
      const ia = indexes[(i - 1 + indexes.length) % indexes.length];
      const ib = indexes[i];
      const ic = indexes[(i + 1) % indexes.length];
      const a = flatPoints[ia];
      const b = flatPoints[ib];
      const c = flatPoints[ic];

      if (edge(a, b, c) * orientation <= 0) continue;

      let containsPoint = false;
      for (const index of indexes) {
        if (index === ia || index === ib || index === ic) continue;
        if (pointInTriangle(flatPoints[index], a, b, c)) {
          containsPoint = true;
          break;
        }
      }

      if (containsPoint) continue;

      triangles.push([points[ia], points[ib], points[ic]]);
      indexes.splice(i, 1);
      earFound = true;
      break;
    }

    if (!earFound) {
      for (let i = 1; i < points.length - 1; i += 1) triangles.push([points[0], points[i], points[i + 1]]);
      return triangles;
    }
  }

  triangles.push(indexes.map((index) => points[index]));
  return triangles;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function initRenderer() {
  if (renderer) return renderer;
  if (!gl) throw new Error("WebGL is required for depth-correct viewing");

  const program = createProgram(`
    attribute vec3 aPosition;
    attribute vec4 aColor;
    varying vec4 vColor;
    void main() {
      gl_Position = vec4(aPosition, 1.0);
      vColor = aColor;
    }
  `, `
    precision mediump float;
    varying vec4 vColor;
    void main() {
      gl_FragColor = vColor;
    }
  `);

  renderer = {
    program,
    position: gl.getAttribLocation(program, "aPosition"),
    color: gl.getAttribLocation(program, "aColor"),
    positionBuffer: gl.createBuffer(),
    colorBuffer: gl.createBuffer()
  };
  return renderer;
}

function clipPoint(point) {
  const r = rotate(point);
  const x = canvas.width / 2 + camera.panX + r[0] * camera.scale;
  const y = canvas.height / 2 + camera.panY - r[1] * camera.scale;
  const depthHalf = Math.max(settings.camera.fit.minDepthHalf, scene.bounds.depthHalf || 1);
  return [
    x / canvas.width * 2 - 1,
    1 - y / canvas.height * 2,
    Math.max(-1, Math.min(1, -r[2] / depthHalf))
  ];
}

function pushVertex(positionData, colorData, point, rgba) {
  positionData.push(point[0], point[1], point[2]);
  colorData.push(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255);
}

function drawArrays(mode, positionData, colorData) {
  if (!positionData.length) return;
  const state = initRenderer();

  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionData), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(state.position);
  gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(state.color);
  gl.vertexAttribPointer(state.color, 4, gl.FLOAT, false, 0, 0);

  gl.drawArrays(mode, 0, positionData.length / 3);
}

function draw() {
  if (!scene || !gl) return;
  const background = hexToRgb(settings.render.background).map((value) => value / 255);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(background[0], background[1], background[2], 1);
  gl.clearDepth(1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const drawFaces = (faces) => {
    const trianglePositions = [];
    const triangleColors = [];
    for (const face of faces) {
      const rgba = shadedRgba(face.color, face.points, face.opacity ?? 1);
      for (const triangle of triangulateFace(face.points)) {
        for (const point of triangle) pushVertex(trianglePositions, triangleColors, clipPoint(point), rgba);
      }
    }
    drawArrays(gl.TRIANGLES, trianglePositions, triangleColors);
  };
  const opaqueFaces = scene.faces.filter((face) => (face.opacity ?? 1) >= 1);
  const transparentFaces = scene.faces.filter((face) => (face.opacity ?? 1) < 1);

  const trianglePositions = [];
  const triangleColors = [];
  for (const face of opaqueFaces) {
    const rgba = shadedRgba(face.color, face.points, face.opacity ?? 1);
    for (const triangle of triangulateFace(face.points)) {
      for (const point of triangle) pushVertex(trianglePositions, triangleColors, clipPoint(point), rgba);
    }
  }

  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  drawArrays(gl.TRIANGLES, trianglePositions, triangleColors);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if (transparentFaces.length) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawFaces(transparentFaces);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  const linePositions = [];
  const lineColors = [];
  const edgeColor = hexToRgba(settings.render.edges.defaultColor);

  for (const face of scene.faces) {
    if (face.hideEdges) continue;
    for (let i = 0; i < face.points.length; i += 1) {
      pushVertex(linePositions, lineColors, clipPoint(face.points[i]), edgeColor);
      pushVertex(linePositions, lineColors, clipPoint(face.points[(i + 1) % face.points.length]), edgeColor);
    }
  }

  for (const line of scene.lines) {
    const rgba = hexToRgba(line.color);
    pushVertex(linePositions, lineColors, clipPoint(line.points[0]), rgba);
    pushVertex(linePositions, lineColors, clipPoint(line.points[1]), rgba);
  }

  gl.lineWidth(settings.render.edges.lineWidth);
  drawArrays(gl.LINES, linePositions, lineColors);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (scene) {
    fitCamera();
    draw();
  }
}

function attachControls() {
  canvas.addEventListener("pointerdown", (event) => {
    if (!camera) return;
    drag = { x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const controls = settings.controls;
    camera.yaw = drag.yaw + (event.clientX - drag.x) * controls.orbitSpeed;
    camera.pitch = Math.max(controls.minPitch, Math.min(controls.maxPitch, drag.pitch + (event.clientY - drag.y) * controls.orbitSpeed));
    draw();
  });

  canvas.addEventListener("pointerup", () => {
    drag = null;
  });

  canvas.addEventListener("wheel", (event) => {
    if (!camera) return;
    event.preventDefault();
    camera.scale *= event.deltaY > 0 ? settings.controls.zoomOutFactor : settings.controls.zoomInFactor;
    draw();
  }, { passive: false });

  reset.addEventListener("click", () => {
    if (!scene) return;
    camera = homeCamera();
    fitCamera();
    draw();
  });
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    camera = homeCamera();

    const projectUrl = new URL(settings.project.path, settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const materialsUrl = new URL(project.libraries.materials.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const [profiles, , fasteners] = await Promise.all([loadJson(profilesUrl), loadJson(materialsUrl), loadJson(fastenersUrl)]);

    scene = buildScene(project, profiles, fasteners);
    applyUiSettings(project);
    meta.textContent = `${Object.keys(project.model.members).length} members\n${Object.keys(project.model.plates).length} plates\n${Object.keys(project.model.fastenerGroups).length} fastener groups`;
    resize();
  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", resize);
attachControls();
main();
