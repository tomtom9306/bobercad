import { solveSketchRelationsAfterVertexChange as solveSketchRelationsAfterVertexChangeImpl } from './solver-core.mjs';

export function solveSketchRelationsAfterVertexChange(sketch, changedVertexIds = []) {
  return solveSketchRelationsAfterVertexChangeImpl(sketch, changedVertexIds);
}

export {
  relaxRelationsForDirectVertexMove
} from './solver-core.mjs';

export {
  assertSketchRelationsSatisfied,
  constraintRows,
  matrixRank,
  plateSketchDefinitionStatus,
  plateSketchEntityDefinitionStatus,
  plateSketchRelationHealth,
  sketchConstraintSystem,
  sketchDefinitionStatus,
  sketchEntityDefinitionStatus,
  sketchRelationHealth,
  sketchRelationSatisfactionIssues
} from './relation-analysis.mjs';

export {
  plateSketchRelationActionPreview
} from './relation-preview.mjs';

export {
  edgeLengthDimensionInheritance,
  edgeRelationInheritance,
  fixPlateSketchUnderDefinedEntities,
  inferPlateSketchRelations,
  inferSketchRelationsForHost,
  relationsForTopologyChange,
  removePlateSketchFixedRelations,
  removePlateSketchRelation,
  removeSketchRelation,
  removeSketchRelationFromHost,
  setPlateSketchEdgeAngle,
  setPlateSketchEdgeAngleMode,
  setPlateSketchEdgeLength,
  setPlateSketchEdgeLengthMode,
  setPlateSketchEdgeRadius,
  setPlateSketchEdgeRadiusMode,
  setPlateSketchPointDistance,
  setPlateSketchPointDistanceMode,
  setSketchEdgeAngle,
  setSketchEdgeAngleMode,
  setSketchEdgeLength,
  setSketchEdgeLengthMode,
  setSketchEdgeRadius,
  setSketchEdgeRadiusMode,
  setSketchPointDistance,
  setSketchPointDistanceMode,
  setPlateSketchVertex,
  setPlateSketchVertices,
  setSketchVertex,
  setSketchVertices,
  sketchEdgeAxisRelation,
  sketchRelationsForEdge,
  sketchRelationsForVertex,
  solvePlateSketchRelation,
  solveSketchAfterRelationUpsert,
  upsertPlateSketchRelation,
  upsertSketchRelation,
  upsertSketchRelationFromHost
} from './relation-mutations.mjs';
