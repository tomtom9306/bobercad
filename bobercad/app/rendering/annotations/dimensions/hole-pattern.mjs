import { uniqueValues } from "../../../engine/core/model.mjs?v=array-values-dry-1";
import { averageVec3, dimensionOffset, featureBasis, makeNote, paramValue, parameterLabel, positionPoint, roleObject, v } from "../dimension-context.mjs?v=unified-dimension-overlay-1";

const roundedUniqueCount = (values) => uniqueValues(values.map((value) => Math.round(value / 0.001))).length;

export function holePatternDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.smartComponent, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  if (!pattern?.positions?.length || !basis) return null;
  const rowPath = spec.reference.rowsParameter || "bolts.rows";
  const columnPath = spec.reference.columnsParameter || "bolts.columns";
  const generatedRows = roundedUniqueCount(pattern.positions.map((position) => position[1]));
  const generatedColumns = roundedUniqueCount(pattern.positions.map((position) => position[0]));
  const rows = paramValue(ctx.definition, ctx.smartComponent, rowPath) || generatedRows;
  const columns = paramValue(ctx.definition, ctx.smartComponent, columnPath) || generatedColumns;
  const anchor = averageVec3(pattern.positions.map((position) => positionPoint(basis, position)));
  const point = v.add(anchor, dimensionOffset(ctx, basis, spec.reference.offset, { clampNormal: false }));
  return makeNote({
    ...ctx,
    spec,
    point,
    anchor,
    textValue: `${spec.label || "bolts"} ${rows}x${columns}`,
    displayTextValue: `${rows}x${columns}`,
    titleValue: `${parameterLabel(ctx.definition, spec.parameter)} pattern ${rows} rows x ${columns} columns`,
    editKind: "positiveIntegerPair",
    editValue: `${rows}x${columns}`,
    editTitle: "Bolt pattern",
    editPaths: {
      first: rowPath,
      second: columnPath
    },
    editLabels: {
      first: parameterLabel(ctx.definition, rowPath),
      second: parameterLabel(ctx.definition, columnPath)
    }
  });
}
