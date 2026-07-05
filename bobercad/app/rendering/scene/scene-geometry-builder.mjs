import { bounds3, bounds3Corners, v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { csgTessellationOptions } from "../../engine/geometry/csg.mjs";
import { projectProfileCatalog } from "../../engine/api/project/profiles.mjs";
import { activeSmartComponentObjectIds, shouldRenderObject } from "./scene-object-visibility.mjs";
import { generatedSmartComponentObjectIds, renderCollectionObjects, shouldBuildLodDetail, shouldRenderCuttingObjects, shouldRenderGrids } from "./scene-annotation-metadata.mjs";
import { addGridSystems, addTrimJoint, addViewerAxes } from "./scene-datum-reference-assembly.mjs";
import { memberFeatures } from "./scene-feature-cutters.mjs";
import { addCurvedMember, addInstancedMember, addMember, canInstanceMember, curvedMemberPath } from "./scene-member-geometry-adapters.mjs";
import { addCutBody, addFastenerGroups, addPlate, addSketchObject, addWelds } from "./scene-object-geometry-adapters.mjs";
import { addReferenceGeometry } from "./reference-geometry-scene.mjs";

function buildLodDetails(scene) {
  const pointsById = new Map();
  const addPoint = (id, point) => {
    if (!id || !v.isVec3(point)) return;
    const points = pointsById.get(id) || [];
    points.push(point);
    pointsById.set(id, points);
  };

  for (const face of scene.faces) {
    for (const point of arrayValues(face.points)) addPoint(face.lodDetailObjectId, point);
  }
  for (const line of scene.lines) {
    for (const point of arrayValues(line.points)) addPoint(line.lodDetailObjectId, point);
  }

  scene.lodDetails = {};
  for (const [id, points] of pointsById) {
    const data = bounds3(points);
    scene.lodDetails[id] = {
      center: data.center,
      radius: Math.max(v.len(data.size) / 2, 1)
    };
  }
}

function sceneBounds(scene) {
  let count = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const addPoint = (point) => {
    if (!v.isVec3(point)) return;
    count += 1;
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  };
  for (const face of scene.faces) {
    for (const point of arrayValues(face.points)) addPoint(point);
  }
  for (const line of scene.lines) {
    for (const point of arrayValues(line.points)) addPoint(point);
  }
  for (const cloud of scene.pointClouds) {
    for (const point of arrayValues(cloud.points)) addPoint(point);
  }
  for (const instance of scene.memberInstances) {
    addPoint(instance.start);
    addPoint(v.add(instance.start, v.mul(instance.axisX, instance.length)));
  }
  if (!count) return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], depthHalf: 1 };
  const center = min.map((value, index) => (value + max[index]) / 2);
  const size = min.map((value, index) => max[index] - value);
  return { min, max, center, depthHalf: Math.max(1, v.len(size) / 2) };
}

export function buildScene(project, profiles, fasteners, viewerSettings, options = {}) {
  const tessellation = csgTessellationOptions(viewerSettings);
  const renderObjectIds = options.renderObjectIds ? new Set(options.renderObjectIds) : null;
  const shouldRenderId = (objectId) => !renderObjectIds || renderObjectIds.has(objectId);
  const profileMap = projectProfileCatalog(project, profiles);
  const members = renderCollectionObjects(project, "members", renderObjectIds);
  const sceneData = {
    faces: [],
    lines: [],
    pointClouds: [],
    labels: [],
    callouts: [],
    vertices: [],
    memberInstances: [],
    memberInstanceGeometries: {},
    lodDetails: {},
    profiles: profileMap,
    settings: viewerSettings,
    tessellation,
    fasteners: fasteners.fasteners,
    project,
    activeSmartComponentId: options.activeSmartComponentId || null,
    activeTrimJointId: options.activeTrimJointId || null,
    activeTrimOperationId: options.activeTrimOperationId || null,
    activeSmartComponentObjectIds: activeSmartComponentObjectIds(project, options.activeSmartComponentId),
    generatedSmartComponentObjectIds: generatedSmartComponentObjectIds(project),
    lodDetailFilter: options.lodDetailFilter || null,
    renderObjectIds,
    planeMarkerKeys: new Set(),
    cutCalloutKeys: new Set()
  };

  for (const member of members) {
    if (member.display?.visible === false) continue;
    if (!shouldRenderId(member.id)) continue;
    const profile = profileMap[member.profile];
    if (profile && curvedMemberPath(member)) {
      addCurvedMember(sceneData, member, profile);
      continue;
    }
    const hasDetails = memberFeatures(project, member, sceneData).length > 0;
    const instanced = profile && canInstanceMember(sceneData, member, profile) && addInstancedMember(sceneData, member, profile, { lodDetail: hasDetails });
    if (!instanced || (hasDetails && shouldBuildLodDetail(sceneData, member.id))) {
      addMember(sceneData, project, member, profile, { lodDetail: instanced && hasDetails });
    }
  }
  for (const previewMember of arrayValues(options.previewMembers)) {
    const profile = profileMap[previewMember.profile];
    if (profile && curvedMemberPath(previewMember)) addCurvedMember(sceneData, previewMember, profile);
    else addMember(sceneData, project, previewMember, profile);
  }
  for (const previewPlate of arrayValues(options.previewPlates)) {
    addPlate(sceneData, project, previewPlate);
  }

  for (const plate of renderCollectionObjects(project, "plates", renderObjectIds)) {
    if (!shouldRenderId(plate.id)) continue;
    if (!shouldRenderObject(sceneData, plate)) continue;
    if (!shouldBuildLodDetail(sceneData, plate.id)) continue;
    addPlate(sceneData, project, plate);
  }

  for (const sketchObject of renderCollectionObjects(project, "sketches", renderObjectIds)) {
    if (!shouldRenderId(sketchObject.id)) continue;
    if (!shouldRenderObject(sceneData, sketchObject)) continue;
    addSketchObject(sceneData, sketchObject);
  }

  if (shouldRenderCuttingObjects(sceneData)) {
    for (const feature of renderCollectionObjects(project, "features", renderObjectIds)) {
      if (!shouldRenderId(feature.id)) continue;
      if (!shouldRenderObject(sceneData, feature)) continue;
      if (!shouldBuildLodDetail(sceneData, feature.id)) continue;
      addCutBody(sceneData, project, profileMap, feature);
    }
  }
  for (const trimJoint of renderCollectionObjects(project, "trimJoints", renderObjectIds)) {
    if (!shouldRenderId(trimJoint.id)) continue;
    if (!shouldBuildLodDetail(sceneData, trimJoint.id)) continue;
    addTrimJoint(sceneData, project, profileMap, trimJoint);
  }
  addFastenerGroups(sceneData, project, renderCollectionObjects(project, "fastenerGroups", renderObjectIds));
  addWelds(sceneData, project, renderCollectionObjects(project, "welds", renderObjectIds));
  if (shouldRenderGrids(sceneData)) addGridSystems(sceneData, project, renderObjectIds);
  if (!renderObjectIds) addReferenceGeometry(sceneData, options.referenceGeometry);

  sceneData.bounds = sceneBounds(sceneData);
  sceneData.vertices = bounds3Corners(sceneData.bounds);
  buildLodDetails(sceneData);
  addViewerAxes(sceneData);
  delete sceneData.planeMarkerKeys;
  delete sceneData.cutCalloutKeys;
  delete sceneData.settings;
  delete sceneData.tessellation;
  return sceneData;
}
