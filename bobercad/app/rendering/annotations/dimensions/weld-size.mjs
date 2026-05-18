import { EPSILON, dimensionText, finite, fmt, fullDimensionText, interfaceAxis, interfaceByRole, makeNote, paramValue, parameterLabel, plateBasis, plateSupportEdge, roleObject, v } from "../dimension-context.mjs";

export function weldSizeDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const value = paramValue(ctx.definition, ctx.connection, spec.parameter);
  if (!plate || !iface || !finite(value)) return null;
  const basis = plateBasis(plate);
  const supportEdge = plateSupportEdge(plate, iface, basis);
  if (!supportEdge) return null;
  const side = spec.reference.side === "back" ? -1 : 1;
  const faceOffset = v.mul(basis.normal, side * (plate.thickness / 2));
  const supportNormal = interfaceAxis(iface, plate);
  const plateFaceInwardRaw = v.sub(supportNormal, v.mul(basis.normal, v.dot(supportNormal, basis.normal)));
  const plateFaceInward = v.len(plateFaceInwardRaw) > EPSILON ? v.norm(plateFaceInwardRaw) : supportEdge.inward;
  const inward = v.dot(plateFaceInward, supportEdge.inward) < 0 ? v.mul(plateFaceInward, -1) : plateFaceInward;
  const zSide = spec.reference.edge === "bottom" ? -1 : 1;
  const supportEdgeEnd = v.dot(v.sub(supportEdge.a, plate.center), basis.localAxisZ) * zSide
    > v.dot(v.sub(supportEdge.b, plate.center), basis.localAxisZ) * zSide
    ? supportEdge.a
    : supportEdge.b;
  const anchor = spec.reference.edge === "top" || spec.reference.edge === "bottom"
    ? supportEdgeEnd
    : v.add(supportEdge.center, faceOffset);
  const labelPocket = v.add(v.mul(supportNormal, 34), v.mul(basis.normal, side * 34));
  const sideOffset = spec.reference.edge === "top" || spec.reference.edge === "bottom"
    ? v.add(v.mul(inward, 18), v.mul(basis.localAxisZ, zSide * 18))
    : v.add(
      labelPocket,
      v.mul(basis.localAxisZ, spec.reference.side === "back" ? -10 : 10)
    );
  const point = v.add(anchor, sideOffset);
  if (value <= EPSILON) {
    return makeNote({
      ...ctx,
      spec,
      point,
      anchor,
      textValue: `${spec.label || "weld"} ${spec.zeroLabel || "no weld"}`,
      displayTextValue: spec.zeroLabel || "no weld",
      titleValue: `${parameterLabel(ctx.definition, spec.parameter)} no weld`,
      labelAxis: [0, 0, 0]
    });
  }
  return makeNote({
    ...ctx,
    spec,
    point,
    anchor,
    textValue: dimensionText(ctx.definition, spec, value, ctx.connection),
    displayTextValue: `${spec.label || "W"} ${fmt(value)}`,
    titleValue: fullDimensionText(ctx.definition, spec, value, ctx.connection),
    dimensionValue: value,
    labelAxis: [0, 0, 0]
  });
}
