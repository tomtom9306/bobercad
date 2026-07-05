import { cleanVec2Loop, finiteNumber, finitePositiveNumber, v } from "../core/math.mjs";
import { signedArea2d, triangulateFace } from "./polygon.mjs";

export const CSG_EPSILON = 0.00001;

export function geometryError(message) {
  throw new Error(`Geometry evaluator: ${message}`);
}

function requiredObject(value, owner = "object") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    geometryError(`${owner} must be an object`);
  }
  return value;
}

export function requiredVector(source, key, owner = "object") {
  const value = requiredObject(source, owner)[key];
  if (!v.isVec3(value)) {
    geometryError(`${owner} missing valid ${key}`);
  }
  return value;
}

export function requiredNumber(source, key, owner = "object") {
  const value = requiredObject(source, owner)[key];
  if (!finiteNumber(value)) geometryError(`${owner} missing valid ${key}`);
  return value;
}

export function requiredArray(source, key, owner = "object") {
  const value = requiredObject(source, owner)[key];
  if (!Array.isArray(value)) geometryError(`${owner} missing valid ${key}`);
  return value;
}

export function projectCoincidentTolerance(project) {
  const root = requiredObject(project, "project");
  const projectMeta = root.project === undefined ? {} : requiredObject(root.project, "project.project");
  const settingsObject = requiredObject(root.settings, `${projectMeta.id || "project"} settings`);
  const tolerances = requiredObject(settingsObject.tolerances, `${projectMeta.id || "project"} settings.tolerances`);
  const value = requiredNumber(tolerances, "coincident", "project settings.tolerances");
  if (value <= 0) geometryError("project settings.tolerances.coincident must be positive");
  return value;
}

export function csgTessellationOptions(viewerSettings) {
  const render = requiredObject(requiredObject(viewerSettings, "geometry settings").render, "geometry settings.render");
  const curves = requiredObject(render.curves, "geometry settings.render.curves");
  const circleSegments = curves.circleSegments;
  if (!Number.isInteger(circleSegments) || circleSegments < 3) geometryError("geometry settings.render.curves.circleSegments must be an integer >= 3");
  const segmentLength = curves.segmentLength;
  if (segmentLength !== undefined && !finitePositiveNumber(segmentLength)) {
    geometryError("geometry settings.render.curves.segmentLength must be a positive number");
  }
  return {
    circleSegments,
    ...(segmentLength !== undefined ? { segmentLength } : {})
  };
}

function circleSegments(options = {}) {
  const segments = options.circleSegments;
  if (!Number.isInteger(segments) || segments < 3) geometryError("geometry settings.render.curves.circleSegments must be an integer >= 3");
  return segments;
}

function curveArcSegments(radius, sweep, options = {}, minimum = 2) {
  if (finitePositiveNumber(options.segmentLength) && finitePositiveNumber(radius) && finitePositiveNumber(Math.abs(sweep))) {
    return Math.max(minimum, Math.ceil(Math.abs(radius * sweep) / options.segmentLength));
  }
  return Math.max(minimum, Math.ceil(circleSegments(options) * Math.abs(sweep) / (Math.PI * 2)));
}

function requiredBasis(source, owner = "object") {
  return {
    x: requiredVector(source, "axisX", owner),
    y: requiredVector(source, "axisY", owner),
    z: requiredVector(source, "axisZ", owner)
  };
}

function requiredUnitAxis(axis, label) {
  if (!v.isVec3(axis)) geometryError(`${label} must be a finite [x, y, z] vector`);
  const length = v.len(axis);
  if (length <= CSG_EPSILON) geometryError(`${label} cannot be zero length`);
  return v.mul(axis, 1 / length);
}

function csgPlaneFromPoints(a, b, c) {
  const normal = v.norm(v.cross(v.sub(b, a), v.sub(c, a)));
  return { normal, w: v.dot(normal, a) };
}

function csgClonePolygon(polygon) {
  return {
    vertices: polygon.vertices.map((point) => [...point]),
    shared: polygon.shared ? { ...polygon.shared } : {},
    plane: { normal: [...polygon.plane.normal], w: polygon.plane.w }
  };
}

export function csgCleanPoints(points) {
  if (!Array.isArray(points)) geometryError("polygon points must be an array");
  const cleaned = [];
  for (const point of points) {
    if (!v.isVec3(point)) geometryError("polygon point must be a finite [x, y, z] point");
    const previous = cleaned[cleaned.length - 1];
    if (previous && v.len(v.sub(previous, point)) <= CSG_EPSILON) continue;
    cleaned.push(point);
  }
  if (cleaned.length > 2 && v.len(v.sub(cleaned[0], cleaned[cleaned.length - 1])) <= CSG_EPSILON) cleaned.pop();
  return cleaned;
}

function csgPolygon(points, shared = {}) {
  const vertices = csgCleanPoints(points);
  if (vertices.length < 3) return null;
  const plane = csgPlaneFromPoints(vertices[0], vertices[1], vertices[2]);
  if (v.len(plane.normal) <= CSG_EPSILON) return null;
  return { vertices, shared, plane };
}

function csgFlipPolygon(polygon) {
  polygon.vertices.reverse();
  polygon.plane.normal = v.mul(polygon.plane.normal, -1);
  polygon.plane.w = -polygon.plane.w;
}

function csgSplitPolygon(plane, polygon, coplanarFront, coplanarBack, front, back) {
  const COPLANAR = 0;
  const FRONT = 1;
  const BACK = 2;
  const SPANNING = 3;
  let polygonType = 0;
  const types = [];
  for (const vertex of polygon.vertices) {
    const t = v.dot(plane.normal, vertex) - plane.w;
    const type = t < -CSG_EPSILON ? BACK : t > CSG_EPSILON ? FRONT : COPLANAR;
    polygonType |= type;
    types.push(type);
  }
  if (polygonType === COPLANAR) {
    (v.dot(plane.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
    return;
  }
  if (polygonType === FRONT) {
    front.push(polygon);
    return;
  }
  if (polygonType === BACK) {
    back.push(polygon);
    return;
  }
  const frontVertices = [];
  const backVertices = [];
  for (let i = 0; i < polygon.vertices.length; i += 1) {
    const j = (i + 1) % polygon.vertices.length;
    const ti = types[i];
    const tj = types[j];
    const vi = polygon.vertices[i];
    const vj = polygon.vertices[j];
    if (ti !== BACK) frontVertices.push(vi);
    if (ti !== FRONT) backVertices.push(vi);
    if ((ti | tj) === SPANNING) {
      const direction = v.sub(vj, vi);
      const denominator = v.dot(plane.normal, direction);
      if (Math.abs(denominator) <= CSG_EPSILON) continue;
      const t = (plane.w - v.dot(plane.normal, vi)) / denominator;
      const vertex = v.add(vi, v.mul(direction, t));
      frontVertices.push(vertex);
      backVertices.push(vertex);
    }
  }
  const frontPolygon = csgPolygon(frontVertices, { ...polygon.shared });
  const backPolygon = csgPolygon(backVertices, { ...polygon.shared });
  if (frontPolygon) front.push(frontPolygon);
  if (backPolygon) back.push(backPolygon);
}
class CsgNode {
  constructor(polygons = []) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polygons = [];
    if (polygons.length) this.build(polygons);
  }
  invert() {
    for (const polygon of this.polygons) csgFlipPolygon(polygon);
    if (this.plane) {
      this.plane.normal = v.mul(this.plane.normal, -1);
      this.plane.w = -this.plane.w;
    }
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    [this.front, this.back] = [this.back, this.front];
  }
  clipPolygons(polygons) {
    if (!this.plane) return polygons.slice();
    let front = [];
    let back = [];
    for (const polygon of polygons) csgSplitPolygon(this.plane, polygon, front, back, front, back);
    if (this.front) front = this.front.clipPolygons(front);
    back = this.back ? this.back.clipPolygons(back) : [];
    return front.concat(back);
  }
  clipTo(bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }
  allPolygons() {
    let polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  }
  build(polygons) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = { normal: [...polygons[0].plane.normal], w: polygons[0].plane.w };
    const front = [];
    const back = [];
    for (const polygon of polygons) csgSplitPolygon(this.plane, polygon, this.polygons, this.polygons, front, back);
    if (front.length) {
      if (!this.front) this.front = new CsgNode();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new CsgNode();
      this.back.build(back);
    }
  }
}

function csgNodeFromPolygons(polygons) {
  return new CsgNode(polygons.map(csgClonePolygon));
}

function requiredPolygonArray(polygons, label) {
  if (!Array.isArray(polygons)) geometryError(`${label} polygons must be an array`);
  return polygons;
}

export function csgSubtract(aPolygons, bPolygons) {
  aPolygons = requiredPolygonArray(aPolygons, "left CSG");
  bPolygons = requiredPolygonArray(bPolygons, "right CSG");
  if (!bPolygons.length) return aPolygons;
  const a = csgNodeFromPolygons(aPolygons);
  const b = csgNodeFromPolygons(bPolygons);
  a.invert();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  a.invert();
  return a.allPolygons();
}

export function csgUnion(aPolygons, bPolygons) {
  aPolygons = requiredPolygonArray(aPolygons, "left CSG");
  bPolygons = requiredPolygonArray(bPolygons, "right CSG");
  if (!bPolygons.length) return aPolygons;
  const a = csgNodeFromPolygons(aPolygons);
  const b = csgNodeFromPolygons(bPolygons);
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  return a.allPolygons();
}

export function csgIntersect(aPolygons, bPolygons) {
  aPolygons = requiredPolygonArray(aPolygons, "left CSG");
  bPolygons = requiredPolygonArray(bPolygons, "right CSG");
  if (!aPolygons.length || !bPolygons.length) return [];
  const a = csgNodeFromPolygons(aPolygons);
  const b = csgNodeFromPolygons(bPolygons);
  a.invert();
  b.clipTo(a);
  b.invert();
  a.clipTo(b);
  b.clipTo(a);
  a.build(b.allPolygons());
  a.invert();
  return a.allPolygons();
}

export function ccwPoints(points) {
  const clean = cleanVec2Loop(points, {
    tolerance: CSG_EPSILON,
    label: "polygon point",
    minPoints: 3,
    minMessage: "polygon requires at least three distinct points",
    fail: geometryError
  });
  return signedArea2d(clean) >= 0 ? clean : [...clean].reverse();
}

function polygonShared(shared = {}, surfaceRef = null) {
  const { surfaceRefs, ...rest } = shared || {};
  return surfaceRef ? { ...rest, surfaceRef } : rest;
}

export function csgExtrudedRingPolygons(back, front, shared = {}) {
  if (!Array.isArray(back) || !Array.isArray(front) || back.length !== front.length || back.length < 3) {
    geometryError("extruded CSG rings must contain matching point loops");
  }
  const polygons = [];
  const add = (vertices, triangulate = false, surfaceRef = null) => {
    const faces = triangulate && vertices.length > 3 ? triangulateFace(vertices) : [vertices];
    for (const face of faces) {
      const polygon = csgPolygon(face, polygonShared(shared, surfaceRef));
      if (polygon) polygons.push(polygon);
    }
  };
  add([...back].reverse(), true, shared?.surfaceRefs?.back || null);
  add(front, true, shared?.surfaceRefs?.front || null);
  for (let i = 0; i < back.length; i += 1) {
    const j = (i + 1) % back.length;
    add([back[i], back[j], front[j], front[i]], false, shared?.surfaceRefs?.sides?.[i] || null);
  }
  return polygons;
}

export function prismPolygons(center, axisX, axisY, axisZ, depth, outline, shared = {}) {
  const x = requiredUnitAxis(axisX, "prism axisX");
  const y = requiredUnitAxis(axisY, "prism axisY");
  const z = requiredUnitAxis(axisZ, "prism axisZ");
  if (!finitePositiveNumber(depth)) geometryError("prism depth must be a positive number");
  if (!Array.isArray(outline) || outline.length < 3) geometryError("prism outline must contain at least three points");
  const handedness = v.dot(v.cross(x, y), z);
  const points = handedness >= 0 ? ccwPoints(outline) : [...ccwPoints(outline)].reverse();
  const at = (xOffset, point) => v.add(center, v.add(v.mul(x, xOffset), v.add(v.mul(y, point[0]), v.mul(z, point[1]))));
  const back = points.map((point) => at(-depth / 2, point));
  const front = points.map((point) => at(depth / 2, point));
  return csgExtrudedRingPolygons(back, front, shared);
}

export function cutBodyPolygons(body, shared = {}, tessellation = {}) {
  if (!body || !body.type) geometryError("boolean-part body missing type");
  const center = requiredVector(body, "center", `${body.type} body`);
  const basis = requiredBasis(body, `${body.type} body`);
  if (body.type === "box") {
    const size = requiredArray(body, "size", "box body");
    if (size.length !== 3 || size.some((value) => !finitePositiveNumber(value))) {
      geometryError("box body size must contain three positive numbers");
    }
    return prismPolygons(center, basis.x, basis.y, basis.z, size[0], [
      [-size[1] / 2, -size[2] / 2],
      [size[1] / 2, -size[2] / 2],
      [size[1] / 2, size[2] / 2],
      [-size[1] / 2, size[2] / 2]
    ], shared);
  }
  if (body.type === "polygonal-prism") {
    return prismPolygons(center, basis.x, basis.y, basis.z, requiredNumber(body, "depth", "polygonal-prism body"), requiredArray(body, "outline", "polygonal-prism body"), shared);
  }
  if (body.type === "cylinder") {
    const radius = requiredNumber(body, "radius", "cylinder body");
    if (radius <= 0) geometryError("cylinder radius must be positive");
    const depth = requiredNumber(body, "depth", "cylinder body");
    const segments = curveArcSegments(radius, Math.PI * 2, tessellation, 3);
    const outline = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = i / segments * Math.PI * 2;
      outline.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    return prismPolygons(center, basis.x, basis.y, basis.z, depth, outline, shared);
  }
  geometryError(`unsupported boolean-part body type ${body.type}`);
}

export function slotOutline2d(length, width, angle, tessellation = {}) {
  if (!finiteNumber(angle)) geometryError("slot-hole orientation must be a valid angle");
  if (!finitePositiveNumber(length) || !finitePositiveNumber(width)) geometryError("slot-hole length and width must be positive");
  if (length < width) geometryError("slot-hole length must be greater than or equal to width");
  const radius = width / 2;
  const straight = Math.max(0, length - width) / 2;
  const segments = curveArcSegments(radius, Math.PI, tessellation, 8);
  const local = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = Math.PI / 2 + i / segments * Math.PI;
    local.push([-straight + Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  for (let i = 0; i <= segments; i += 1) {
    const a = -Math.PI / 2 + i / segments * Math.PI;
    local.push([straight + Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return local.map((point) => [
    point[0] * c - point[1] * s,
    point[0] * s + point[1] * c
  ]);
}
