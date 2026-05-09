const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function stubGl() {
  return {
    createShader() { return {}; },
    shaderSource() {},
    compileShader() {},
    getShaderParameter() { return true; },
    getShaderInfoLog() { return ""; },
    createProgram() { return {}; },
    attachShader() {},
    linkProgram() {},
    getProgramParameter() { return true; },
    getProgramInfoLog() { return ""; },
    getAttribLocation() { return 0; },
    createBuffer() { return {}; },
    viewport() {},
    clearColor() {},
    clearDepth() {},
    enable() {},
    depthFunc() {},
    clear() {},
    useProgram() {},
    bindBuffer() {},
    bufferData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    drawArrays() {},
    disable() {},
    polygonOffset() {},
    blendFunc() {},
    depthMask() {},
    lineWidth() {},
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    DYNAMIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    LINES: 9,
    DEPTH_TEST: 10,
    LEQUAL: 11,
    COLOR_BUFFER_BIT: 12,
    DEPTH_BUFFER_BIT: 13,
    POLYGON_OFFSET_FILL: 14,
    BLEND: 15,
    SRC_ALPHA: 16,
    ONE_MINUS_SRC_ALPHA: 17
  };
}

function loadViewer() {
  const gl = stubGl();
  const canvas = { width: 900, height: 900, getContext() { return gl; }, addEventListener() {} };
  const element = { hidden: false, textContent: "", addEventListener() {} };
  const context = {
    console,
    URL,
    fetch,
    window: { location: { href: "http://127.0.0.1:8000/viewer/" }, addEventListener() {} },
    document: { getElementById(id) { return id === "view" ? canvas : element; } }
  };
  const source = fs.readFileSync(path.join(ROOT, "viewer", "viewer.js"), "utf8")
    .replace('window.addEventListener("resize", resize);\nattachControls();\nmain();', "");

  vm.createContext(context);
  vm.runInContext(source, context);
  context.__settings = readJson("viewer/viewer_settings.json");
  vm.runInContext("settings = __settings", context);
  return context;
}

function localFace(viewer, member, frame, face) {
  return face.points.map((point) => viewer.localMemberPoint(member, frame, point));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a[1] > point[1]) !== (b[1] > point[1]);
    if (!crosses) continue;
    const x = (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
    if (point[0] < x) inside = !inside;
  }
  return inside;
}

function openingCenter(outline) {
  return [
    outline.reduce((sum, point) => sum + point[0], 0) / outline.length,
    outline.reduce((sum, point) => sum + point[1], 0) / outline.length
  ];
}

function memberColor(member) {
  return member.display?.color || "#78909c";
}

function faceCoversLocalPoint(viewer, member, frame, face, webY, point) {
  if (face.color !== memberColor(member)) return false;
  const local = localFace(viewer, member, frame, face);
  if (!local.every((vertex) => Math.abs(vertex[1] - webY) < 0.01)) return false;
  return pointInPolygon(point, local.map((vertex) => [vertex[0], vertex[2]]));
}

function main() {
  const viewer = loadViewer();
  const project = readJson("projects/sample_beam_to_beam_end_plate.json");
  const profiles = readJson("libraries/profiles.json");
  const fasteners = readJson("libraries/fasteners.json");
  const scene = viewer.buildScene(project, profiles, fasteners);
  const errors = [];

  for (const member of viewer.collectionObjects(project, "members")) {
    const profile = profiles.profiles[member.profile];
    const frame = viewer.memberFrame(member);
    const webYs = viewer.webSideYs(profile);
    const openings = viewer.memberInternalCutOpenings(project, member, frame);

    for (const opening of openings) {
      const center = openingCenter(opening.outline);
      for (const webY of webYs) {
        const covers = scene.faces.some((face) => faceCoversLocalPoint(viewer, member, frame, face, webY, center));
        if (covers) {
          errors.push(`${member.id}: web face still covers cutter center at x=${center[0].toFixed(3)}, y=${webY}, z=${center[1].toFixed(3)}`);
        }
      }
    }
  }

  if (errors.length) {
    console.error("FAILED: viewer geometry checks failed");
    for (const error of errors) console.error(`ERROR: ${error}`);
    return 1;
  }

  console.log("OK: viewer geometry checks passed");
  return 0;
}

process.exit(main());
