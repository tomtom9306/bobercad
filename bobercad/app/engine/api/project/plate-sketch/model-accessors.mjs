import { arrayValues } from "../../../core/model.mjs";

export const sketchVertices = (sketch) => arrayValues(sketch?.vertices);
export const sketchEdges = (sketch) => arrayValues(sketch?.edges);
export const sketchConstructionVertices = (sketch) => arrayValues(sketch?.constructionVertices);
export const sketchConstructionEdges = (sketch) => arrayValues(sketch?.constructionEdges);
export const sketchRelationVertices = (sketch) => [...sketchVertices(sketch), ...sketchConstructionVertices(sketch)];
export const sketchRelationEdges = (sketch) => [...sketchEdges(sketch), ...sketchConstructionEdges(sketch)];
export const sketchRelations = (sketch) => arrayValues(sketch?.relations);
export const plateBends = (plate) => arrayValues(plate?.fabrication?.bends);
