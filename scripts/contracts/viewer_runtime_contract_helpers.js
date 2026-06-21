const fs = require("fs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertNavCubeCameraRotations(navCubeRotationForCameraAngles) {
  const navCubeCameraRotations = {
    top: { yaw: 0, pitch: 0, rotateX: -Math.PI / 2, rotateY: 0 },
    bottom: { yaw: 0, pitch: Math.PI, rotateX: Math.PI / 2, rotateY: 0 },
    front: { yaw: -Math.PI / 2, pitch: Math.PI / 2, rotateX: 0, rotateY: 0 },
    back: { yaw: Math.PI / 2, pitch: Math.PI / 2, rotateX: 0, rotateY: Math.PI },
    right: { yaw: 0, pitch: Math.PI / 2, rotateX: 0, rotateY: Math.PI / 2 },
    left: { yaw: Math.PI, pitch: Math.PI / 2, rotateX: 0, rotateY: -Math.PI / 2 }
  };
  const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const [orientation, expected] of Object.entries(navCubeCameraRotations)) {
    const rotation = navCubeRotationForCameraAngles(expected);
    if (
      !rotation
      || angleDistance(rotation.rotateX, expected.rotateX) > 1e-9
      || angleDistance(rotation.rotateY, expected.rotateY) > 1e-9
    ) {
      return `FAILED: nav cube camera rotation for ${orientation} mapped to ${JSON.stringify(rotation)}, expected rotateX=${expected.rotateX}, rotateY=${expected.rotateY}`;
    }
  }
  return "";
}

function createDetailFreeMemberProject(sourceProject, profileId, { count, idPrefix, name, spacing, baseLength, lengthJitter = 0 }) {
  const project = JSON.parse(JSON.stringify(sourceProject));
  project.project.name = name;
  project.objectIndex = {};
  project.model.members = {};
  project.model.plates = {};
  project.model.holePatterns = {};
  project.model.objectPatterns = {};
  project.model.features = {};
  project.model.trimJoints = {};
  project.model.fastenerGroups = {};
  project.model.welds = {};
  project.model.smartComponentInstances = {};
  project.model.assemblies = {};
  for (let index = 0; index < count; index += 1) {
    const id = `${idPrefix}_${index}`;
    project.objectIndex[id] = { collection: "members", type: "boolean-demo-beam" };
    project.model.members[id] = {
      id,
      type: "boolean-demo-beam",
      profile: profileId,
      start: [index * spacing, 0, 0],
      end: [index * spacing + baseLength + index * lengthJitter, 0, 0],
      featureIds: []
    };
  }
  return project;
}

module.exports = {
  assertNavCubeCameraRotations,
  createDetailFreeMemberProject,
  readJson
};
