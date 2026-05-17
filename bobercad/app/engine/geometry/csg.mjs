import { v } from "../core/math.mjs";
import { triangulateFace } from "./polygon.mjs";

let settings = null;

export function setGeometrySettings(viewerSettings) {
  settings = viewerSettings;
}

export const CSG_EPSILON = 0.00001;

export function geometryError(message) {
  throw new Error(`Geometry evaluator: ${message}`);
}

export function requiredVector(source, key, owner = "object") {
  const value = source?.[key];
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    geometryError(`${owner} missing valid ${key}`);
  }
  return value;
}

export function requiredNumber(source, key, owner = "object") {
  const value = source?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) geometryError(`${owner} missing valid ${key}`);
  return value;
}

export function requiredArray(source, key, owner = "object") {
  const value = source?.[key];
  if (!Array.isArray(value)) geometryError(`${owner} missing valid ${key}`);
  return value;
}

export function projectCoincidentTolerance(project) {
  const tolerances = project.settings?.tolerances;
  if (!tolerances) geometryError(`${project.project?.id || "project"} missing settings.tolerances`);
  const value = requiredNumber(tolerances, "coincident", "project settings.tolerances");
  if (value <= 0) geometryError("project settings.tolerances.coincident must be positive");
  return value;
}

function requiredBasis(source, owner = "object") {
  return {
    x: requiredVector(source, "axisX", owner),
    y: requiredVector(source, "axisY", owner),
    z: requiredVector(source, "axisZ", owner)
  };
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
  const cleaned = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.some((value) => !Number.isFinite(value))) geometryError("polygon contains an invalid point");
    const previous = cleaned[cleaned.length - 1];
    if (previous && v.len(v.sub(previous, point)) <= CSG_EPSILON) continue;
    cleaned.push(point);
  }
  if (cleaned.length > 2 && v.len(v.sub(cleaned[0], cleaned[cleaned.length - 1])) <= CSG_EPSILON) cleaned.pop();
  return cleaned;
}

export function csgPolygon(points, shared = {}) {
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

export function csgSubtract(aPolygons, bPolygons) {
  if (!bPolygons.length) return aPolygons;
  const a = new CsgNode(aPolygons.map(csgClonePolygon));
  const b = new CsgNode(bPolygons.map(csgClonePolygon));
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
  if (!bPolygons.length) return aPolygons;
  const a = new CsgNode(aPolygons.map(csgClonePolygon));
  const b = new CsgNode(bPolygons.map(csgClonePolygon));
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  return a.allPolygons();
}

function polygonArea2d(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

export function ccwPoints(points) {
  const clean = csgCleanPoints(points);
  return polygonArea2d(clean) >= 0 ? clean : [...clean].reverse();
}

export function prismPolygons(center, axisX, axisY, axisZ, depth, outline, shared = {}) {
  const x = v.norm(axisX);
  const y = v.norm(axisY);
  const z = v.norm(axisZ);
  if (v.len(x) <= CSG_EPSILON || v.len(y) <= CSG_EPSILON || v.len(z) <= CSG_EPSILON) geometryError("cutter basis contains zero-length axis");
  if (typeof depth !== "number" || !Number.isFinite(depth) || depth <= 0) geometryError("prism depth must be a positive number");
  if (!Array.isArray(outline) || outline.length < 3) geometryError("prism outline must contain at least three points");
  const handedness = v.dot(v.cross(x, y), z);
  const points = handedness >= 0 ? ccwPoints(outline) : [...ccwPoints(outline)].reverse();
  const at = (xOffset, point) => v.add(center, v.add(v.mul(x, xOffset), v.add(v.mul(y, point[0]), v.mul(z, point[1]))));
  const back = points.map((point) => at(-depth / 2, point));
  const front = points.map((point) => at(depth / 2, point));
  const polygons = [];
  const add = (vertices, triangulate = false) => {
    const faces = triangulate && vertices.length > 3 ? triangulateFace(vertices) : [vertices];
    for (const face of faces) {
      const polygon = csgPolygon(face, { ...shared });
      if (polygon) polygons.push(polygon);
    }
  };
  add([...back].reverse(), true);
  add(front, true);
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    add([back[i], back[j], front[j], front[i]]);
  }
  return polygons;
}

export function cutBodyPolygons(body, shared = {}) {
  if (!body || !body.type) geometryError("boolean-part body missing type");
  const center = requiredVector(body, "center", `${body.type} body`);
  const basis = requiredBasis(body, `${body.type} body`);
  if (body.type === "box") {
    const size = requiredArray(body, "size", "box body");
    if (size.length !== 3 || size.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
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
    const radius = body.radius !== undefined ? requiredNumber(body, "radius", "cylinder body") : requiredNumber(body, "diameter", "cylinder body") / 2;
    if (radius <= 0) geometryError("cylinder radius must be positive");
    const depth = requiredNumber(body, "depth", "cylinder body");
    const segments = settings.render.curves.circleSegments;
    const outline = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = i / segments * Math.PI * 2;
      outline.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    return prismPolygons(center, basis.x, basis.y, basis.z, depth, outline, shared);
  }
  geometryError(`unsupported boolean-part body type ${body.type}`);
}

export function slotOutline2d(length, width, angle) {
  if (typeof angle !== "number" || !Number.isFinite(angle)) geometryError("slot-hole orientation must be a valid angle");
  if (length <= 0 || width <= 0) geometryError("slot-hole length and width must be positive");
  if (length < width) geometryError("slot-hole length must be greater than or equal to width");
  const radius = width / 2;
  const straight = Math.max(0, length - width) / 2;
  const segments = Math.max(8, Math.floor(settings.render.curves.circleSegments / 2));
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
