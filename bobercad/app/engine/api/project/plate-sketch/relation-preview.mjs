import { sketchRelations } from './model-accessors.mjs';
import { sketchRelationKey } from './relation-metadata.mjs';
import { fail } from './sketch-geometry-and-relations.mjs';
import {
  setPlateSketchEdgeAngleMode,
  setPlateSketchEdgeLengthMode,
  setPlateSketchPointDistanceMode,
  upsertPlateSketchRelation
} from './relation-mutations.mjs';
import {
  plateSketchDefinitionStatus,
  plateSketchRelationHealth
} from './relation-analysis.mjs';

function relationHealthRecord(status, message = '') {
  const severity = status === 'ok'
    ? 'ok'
    : status === 'driven'
      ? 'info'
      : status === 'redundant'
        ? 'warning'
        : 'error';
  return {
    status,
    severity,
    ...(message ? { message } : {})
  };
}

export function plateSketchRelationActionPreview(plate, relationPatch) {
  if (!relationPatch || typeof relationPatch !== 'object') fail('plate sketch relation preview requires a relation');
  let nextPlate = null;
  if (relationPatch.type === 'length') {
    nextPlate = setPlateSketchEdgeLengthMode(plate, relationPatch.edgeId, 'driving');
  } else if (relationPatch.type === 'angle') {
    nextPlate = setPlateSketchEdgeAngleMode(plate, relationPatch.edgeIds, 'driving');
  } else if (relationPatch.type === 'distance') {
    nextPlate = setPlateSketchPointDistanceMode(plate, relationPatch.vertexIds, 'driving');
  } else {
    nextPlate = upsertPlateSketchRelation(plate, relationPatch);
  }
  const relationKey = sketchRelationKey(relationPatch);
  const relation = sketchRelations(nextPlate?.sketch).find((item) => sketchRelationKey(item) === relationKey) || null;
  const health = relation
    ? plateSketchRelationHealth(nextPlate)[relation.id] || relationHealthRecord('ok')
    : relationHealthRecord('conflicted', 'Relation could not be evaluated.');
  return {
    plate: nextPlate,
    relation,
    health,
    definition: plateSketchDefinitionStatus(nextPlate)
  };
}
