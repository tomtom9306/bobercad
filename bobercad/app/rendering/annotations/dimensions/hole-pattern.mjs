import { dimensionOffset, featureBasis, makeNote, paramValue, parameterLabel, positionPoint, roleObject, uniqueCount, v } from "../dimension-context.mjs";

export function holePatternDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  if (!pattern?.positions?.length || !basis) return null;
  const rowPath = spec.reference.rowsParameter || "bolts.rows";
  const columnPath = spec.reference.columnsParameter || "bolts.columns";
  const generatedRows = uniqueCount(pattern.positions.map((position) => position[1]));
  const generatedColumns = uniqueCount(pattern.positions.map((position) => position[0]));
  const rows = paramValue(ctx.definition, ctx.connection, rowPath) || generatedRows;
  const columns = paramValue(ctx.definition, ctx.connection, columnPath) || generatedColumns;
  const center = pattern.positions.reduce((sum, position) => v.add(sum, positionPoint(basis, position)), [0, 0, 0]);
  const anchor = v.mul(center, 1 / pattern.positions.length);
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
