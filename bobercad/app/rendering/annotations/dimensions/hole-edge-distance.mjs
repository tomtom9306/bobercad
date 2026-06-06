import { EPSILON, basisAxis, basisBoundsCoordinate, dimensionOffset, distance, edgeDistanceEditTransform, featureBasis, finite, interfaceAxis, interfaceByRole, interfaceEdgeOnBasis, linePlane, makeDimension, patternLayoutBasis, patternPositionsInBasis, plateBasis, plateBoundsInBasis, plateSupportEdge, positionInBasis, positionPoint, rawInterfaceByRole, roleObject, signedEdgeDistance, sortedCoordinateValues, v } from "../dimension-context.mjs";

export function holeEdgeDistanceDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.smartComponent, spec.reference.objectRole);
  const pattern = roleObject(ctx.project, ctx.smartComponent, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const measureBasis = spec.reference.measureBasis === "feature" ? sourceBasis : basis;
  if (!plate || !pattern?.positions?.length || !sourceBasis || !basis || !measureBasis) return null;
  const positions = patternPositionsInBasis(pattern, sourceBasis, basis);
  const bounds = plateBoundsInBasis(plate, basis);
  const axis = spec.reference.axis;
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const values = sortedCoordinateValues(positions, axis);
  if (!values.length) return null;
  const iface = spec.reference.interfaceRole
    ? interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.smartComponent, spec.reference.interfaceRole)
    : null;
  if (iface && axis === "localAxisY") {
    const planeNormal = interfaceAxis(iface, plate);
    const axisVector = basisAxis(basis, axis);
    const supportEdge = spec.reference.edgePick === "far" ? plateSupportEdge(plate, iface, plateBasis(plate)) : null;
    const planePoint = linePlane(basis.origin, axisVector, iface.origin, planeNormal);
    if (supportEdge && planePoint) {
      const planePosition = positionInBasis(planePoint, basis.origin, basis);
      const planeCoord = planePosition[axisIndex];
      const holeValue = values.reduce((best, value) => (
        Math.abs(value - planeCoord) < Math.abs(best - planeCoord) ? value : best
      ), values[0]);
      const edgeEnds = [supportEdge.a, supportEdge.b].map((point) => ({
        point,
        position: positionInBasis(point, basis.origin, basis)
      }));
      const farEnd = edgeEnds.reduce((best, item) => (
        Math.abs(item.position[axisIndex] - holeValue) > Math.abs(best.position[axisIndex] - holeValue) ? item : best
      ), edgeEnds[0]);
      const supportCandidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
      const hole = supportCandidates.length
        ? supportCandidates.reduce((best, item) => Math.abs(item[otherIndex] - farEnd.position[otherIndex]) < Math.abs(best[otherIndex] - farEnd.position[otherIndex]) ? item : best, supportCandidates[0])
        : null;
      if (hole) {
        const farCoord = farEnd.position[axisIndex];
        const holeCoord = hole[axisIndex];
        const supportDirection = Math.sign(holeCoord - planeCoord) || Math.sign(farCoord - planeCoord) || 1;
        const dimensionDirection = Math.sign(holeCoord - farCoord) || supportDirection;
        const a = positionPoint(basis, axis === "localAxisY" ? [farCoord, hole[otherIndex]] : [hole[otherIndex], farCoord]);
        const b = positionPoint(basis, hole);
        return makeDimension({
          ...ctx,
          spec,
          a,
          b,
          extensionA: farEnd.point,
          offset: dimensionOffset(ctx, basis, spec.reference.offset),
          measured: Math.abs(holeCoord - farCoord),
          editKind: "offsetNumber",
          editValueScale: dimensionDirection / supportDirection,
          editValueOffset: (farCoord - planeCoord) / supportDirection
        });
      }
    }
    const candidates = positions
      .map((position) => {
        const holePoint = positionPoint(basis, position);
        const edgePoint = linePlane(holePoint, axisVector, iface.origin, planeNormal);
        return edgePoint ? {
          position,
          holePoint,
          edgePoint,
          measured: distance(holePoint, edgePoint)
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.measured - b.measured || Math.abs(a.position[otherIndex]) - Math.abs(b.position[otherIndex]));
    const best = candidates[0];
    if (best) {
      return makeDimension({
        ...ctx,
        spec,
        a: best.edgePoint,
        b: best.holePoint,
        offset: dimensionOffset(ctx, basis, spec.reference.offset),
        measured: best.measured
      });
    }
  }
  const measureBounds = measureBasis === basis ? bounds : plateBoundsInBasis(plate, measureBasis);
  const edgeValue = basisBoundsCoordinate(measureBounds, axis, spec.reference.edge);
  const holeValue = spec.reference.edge === "max" ? values[values.length - 1] : values[0];
  const candidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
  const hole = candidates.length
    ? candidates.reduce((best, item) => Math.abs(item[otherIndex]) < Math.abs(best[otherIndex]) ? item : best, candidates[0])
    : null;
  if (!hole) return null;
  const holePoint = positionPoint(basis, hole);
  const holeInMeasureBasis = positionInBasis(holePoint, measureBasis.origin, measureBasis);
  const other = holeInMeasureBasis[otherIndex];
  const a = axis === "localAxisY"
    ? positionPoint(measureBasis, [edgeValue, other])
    : positionPoint(measureBasis, [other, edgeValue]);
  const signedMeasured = signedEdgeDistance(edgeValue, holeInMeasureBasis[axisIndex], spec.reference.edge);
  let editKind = null;
  let editValueOffset = null;
  let editValueScale = null;
  const parameterEdge = spec.reference.parameterEdge || spec.reference.edge;
  const parameterCoordinate = basisBoundsCoordinate(bounds, axis, parameterEdge);
  if (finite(parameterCoordinate)) {
    const edit = edgeDistanceEditTransform({
      basis,
      measureBasis,
      axis,
      edge: spec.reference.edge,
      edgeCoordinate: edgeValue,
      parameterEdge,
      parameterCoordinate,
      values,
      holePoint,
      signedMeasured
    });
    if (edit) ({ editKind, editValueOffset, editValueScale } = edit);
  }
  return makeDimension({
    ...ctx,
    spec,
    a,
    b: holePoint,
    offset: dimensionOffset(ctx, measureBasis, spec.reference.offset),
    measured: Math.abs(signedMeasured),
    editKind,
    editValueOffset,
    editValueScale
  });
}



export function holeInterfaceEdgeDistanceDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.smartComponent, spec.reference.objectRole);
  const pattern = roleObject(ctx.project, ctx.smartComponent, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  const sourceBasis = featureBasis(ctx.project, feature);
  const basis = patternLayoutBasis(pattern, sourceBasis);
  const measureBasis = spec.reference.measureBasis === "feature" ? sourceBasis : basis;
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.smartComponent, spec.reference.interfaceRole);
  const rawInterface = rawInterfaceByRole(ctx.project, ctx.definition, ctx.smartComponent, spec.reference.interfaceRole);
  if (!pattern?.positions?.length || !sourceBasis || !basis || !measureBasis || !iface) return null;

  const axis = spec.reference.axis;
  const axisIndex = axis === "localAxisY" ? 0 : 1;
  const otherIndex = axisIndex === 0 ? 1 : 0;
  const positions = patternPositionsInBasis(pattern, sourceBasis, basis);
  const values = sortedCoordinateValues(positions, axis);
  if (!values.length) return null;
  const holeValue = spec.reference.edge === "max" ? values[values.length - 1] : values[0];
  const candidates = positions.filter((position) => Math.abs(position[axisIndex] - holeValue) <= 0.001);
  const hole = candidates.length
    ? candidates.reduce((best, item) => Math.abs(item[otherIndex]) < Math.abs(best[otherIndex]) ? item : best, candidates[0])
    : null;
  if (!hole) return null;

  const edge = interfaceEdgeOnBasis(ctx.project, ctx.profiles, rawInterface, iface, measureBasis, axis, spec.reference.edge);
  if (!edge) return null;
  const axisVector = basisAxis(measureBasis, axis);
  const holePoint = positionPoint(basis, hole);
  const edgePoint = linePlane(holePoint, axisVector, edge.planePoint, edge.normal);
  if (!edgePoint) return null;
  const holeInMeasureBasis = positionInBasis(holePoint, measureBasis.origin, measureBasis);
  const signedMeasured = spec.reference.edge === "max"
    ? edge.coordinate - holeInMeasureBasis[axisIndex]
    : holeInMeasureBasis[axisIndex] - edge.coordinate;

  let editKind = null;
  let editValueOffset = null;
  let editValueScale = null;
  const parameterEdge = spec.reference.parameterEdge || spec.reference.edge;
  const parameterCoordinate = (() => {
    if (plate) {
      const bounds = plateBoundsInBasis(plate, basis);
      if (axis === "localAxisY") return parameterEdge === "max" ? bounds.maxY : bounds.minY;
      return parameterEdge === "max" ? bounds.maxZ : bounds.minZ;
    }
    const parameter = interfaceEdgeOnBasis(ctx.project, ctx.profiles, rawInterface, iface, basis, axis, parameterEdge);
    return parameter?.coordinate;
  })();
  if (finite(parameterCoordinate)) {
    const edit = edgeDistanceEditTransform({
      basis,
      measureBasis,
      axis,
      edge: spec.reference.edge,
      edgeCoordinate: edge.coordinate,
      parameterEdge,
      parameterCoordinate,
      values,
      holePoint,
      signedMeasured
    });
    if (edit) ({ editKind, editValueOffset, editValueScale } = edit);
  }

  return makeDimension({
    ...ctx,
    spec,
    a: edgePoint,
    b: holePoint,
    offset: dimensionOffset(ctx, measureBasis, spec.reference.offset),
    measured: Math.abs(signedMeasured),
    editKind,
    editValueOffset,
    editValueScale
  });
}
