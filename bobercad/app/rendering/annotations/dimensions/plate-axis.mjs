import { atValue, dimensionOffset, longestPlateEdge, makeDimension, pickedEdgeOffset, plateBasis, plateBounds, platePoint, roleObject } from "../dimension-context.mjs";

export function plateAxisDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  if (!plate) return null;
  const basis = plateBasis(plate);
  const bounds = plateBounds(plate);
  const at = spec.reference.at || {};
  const axis = spec.reference.axis;
  const y = atValue(at.localAxisY, bounds.minY, bounds.maxY);
  const z = atValue(at.localAxisZ, bounds.minZ, bounds.maxZ);
  const n = atValue(at.normal, bounds.minN, bounds.maxN);

  if (axis === "normal") {
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, y, z, bounds.minN),
      b: platePoint(plate, basis, y, z, bounds.maxN),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: plate.thickness
    });
  }
  if (axis === "localAxisY") {
    const edge = spec.reference.edgePick === "longest" ? longestPlateEdge(plate, axis) : null;
    if (edge) {
      return makeDimension({
        ...ctx,
        spec,
        a: platePoint(plate, basis, edge.a[0], edge.a[1], n),
        b: platePoint(plate, basis, edge.b[0], edge.b[1], n),
        offset: pickedEdgeOffset(axis, edge, basis, spec.reference.offset, ctx.dimensionSettings || {}),
        measured: edge.length
      });
    }
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, bounds.minY, z, n),
      b: platePoint(plate, basis, bounds.maxY, z, n),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: bounds.maxY - bounds.minY
    });
  }
  if (axis === "localAxisZ") {
    const edge = spec.reference.edgePick === "longest" ? longestPlateEdge(plate, axis) : null;
    if (edge) {
      return makeDimension({
        ...ctx,
        spec,
        a: platePoint(plate, basis, edge.a[0], edge.a[1], n),
        b: platePoint(plate, basis, edge.b[0], edge.b[1], n),
        offset: pickedEdgeOffset(axis, edge, basis, spec.reference.offset, ctx.dimensionSettings || {}),
        measured: edge.length
      });
    }
    return makeDimension({
      ...ctx,
      spec,
      a: platePoint(plate, basis, y, bounds.minZ, n),
      b: platePoint(plate, basis, y, bounds.maxZ, n),
      offset: dimensionOffset(ctx, basis, spec.reference.offset),
      measured: bounds.maxZ - bounds.minZ
    });
  }
  return null;
}
