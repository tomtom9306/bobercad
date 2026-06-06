import { secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";

function fastenerDefinition(ctx, fastenerRef) {
  const fastener = ctx.fasteners?.fasteners?.[fastenerRef];
  if (!fastener) ctx.fail(`fastener not found: ${fastenerRef}`);
  return fastener;
}

function holeDiameter(ctx, fastener, holes) {
  const shankDiameter = fastener.shank?.diameter;
  if (typeof shankDiameter !== "number" || !Number.isFinite(shankDiameter) || shankDiameter <= 0) ctx.fail(`${fastener.id}: fastener missing shank diameter`);
  const normal = fastener.hole?.defaultDiameter || shankDiameter + 2;
  const tolerance = holes.tolerance || "normal";
  if (tolerance === "custom") return holes.customDiameter || holes.diameter || normal;
  const catalogDiameter = fastener.hole?.tolerances?.[tolerance];
  if (catalogDiameter) return catalogDiameter;
  if (tolerance === "tight") return Math.max(shankDiameter, normal - 1);
  if (tolerance === "loose") return normal + Math.max(2, normal - shankDiameter);
  return normal;
}

function automaticMemberHoleDepth(webThickness, holeDiameterValue) {
  return Math.max(webThickness * 2 + 4, holeDiameterValue + 2);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSpacings(values, count, fallback) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const value = source[index];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
  });
}

function centeredCoordinates(spacings, center = 0) {
  const span = spacings.reduce((sum, value) => sum + value, 0);
  let cursor = center - span / 2;
  const coordinates = [cursor];
  for (const spacing of spacings) {
    cursor += spacing;
    coordinates.push(cursor);
  }
  return coordinates;
}

function customCoordinatesFromEdge(edgeCoordinate, spacings, direction = 1) {
  let cursor = edgeCoordinate;
  const coordinates = [cursor];
  for (const spacing of spacings) {
    cursor += spacing * direction;
    coordinates.push(cursor);
  }
  return coordinates;
}

function pointInReference(ctx, point, reference) {
  const yAxis = reference.localAxisY;
  const zAxis = reference.localAxisZ;
  const offset = ctx.geometry.v.sub(point, reference.origin);
  const yy = ctx.geometry.v.dot(yAxis, yAxis);
  const yz = ctx.geometry.v.dot(yAxis, zAxis);
  const zz = ctx.geometry.v.dot(zAxis, zAxis);
  const py = ctx.geometry.v.dot(offset, yAxis);
  const pz = ctx.geometry.v.dot(offset, zAxis);
  const determinant = yy * zz - yz * yz;
  if (Math.abs(determinant) <= 1e-9) return [py, pz];
  return [
    (py * zz - pz * yz) / determinant,
    (pz * yy - py * yz) / determinant
  ];
}

function pointFromReference(ctx, reference, position) {
  return ctx.geometry.v.add(
    reference.origin,
    ctx.geometry.v.add(
      ctx.geometry.v.mul(reference.localAxisY, position[0]),
      ctx.geometry.v.mul(reference.localAxisZ, position[1])
    )
  );
}

function planeCoordinateInReference(ctx, reference, planeOrigin, planeNormal, axis = "localAxisY") {
  const axisVector = axis === "localAxisZ" ? reference.localAxisZ : reference.localAxisY;
  const point = ctx.geometry.linePlaneIntersection(reference.origin, axisVector, planeOrigin, planeNormal);
  return point ? pointInReference(ctx, point, reference)[axis === "localAxisZ" ? 1 : 0] : null;
}

function plateBoundsInReference(ctx, plate, reference) {
  const outline = Array.isArray(plate.outline) && plate.outline.length
    ? plate.outline
    : ctx.geometry.rectangleOutline(plate.width, plate.height);
  const coordinates = outline.map(([y, z]) => {
    const worldPoint = ctx.geometry.v.add(
      plate.center,
      ctx.geometry.v.add(ctx.geometry.v.mul(plate.localAxisY, y), ctx.geometry.v.mul(plate.localAxisZ, z))
    );
    return pointInReference(ctx, worldPoint, reference);
  });
  return {
    minY: Math.min(...coordinates.map(([y]) => y)),
    maxY: Math.max(...coordinates.map(([y]) => y)),
    minZ: Math.min(...coordinates.map(([, z]) => z)),
    maxZ: Math.max(...coordinates.map(([, z]) => z))
  };
}

function patternInReference(ctx, pattern, fromReference, toReference) {
  return {
    ...pattern,
    positions: pattern.positions.map(([y, z]) => {
      const worldPoint = pointFromReference(ctx, fromReference, [y, z]);
      return pointInReference(ctx, worldPoint, toReference);
    })
  };
}

export function build(ctx, input = {}) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipeContext = input.recipeContext || {};
  const {
    plate,
    supportedBeam,
    supportInterface,
    supportNormal,
    beamHoleReference,
    layoutReference,
    holeReference,
    beamWebThickness
  } = context;
  const finPlate = input.finPlate || recipeContext.finPlate;
  const backFinPlate = input.backFinPlate || recipeContext.backFinPlate;
  if (!plate || !finPlate || !backFinPlate || !supportedBeam || !supportInterface || !supportNormal || !beamHoleReference || !layoutReference || !holeReference) {
    ctx.fail("web-bolt-pattern: secondary-web-plate must run before web-bolt-pattern");
  }

  const bolts = ctx.params({
    rows: "bolts.rows",
    columns: "bolts.columns",
    pitch: "bolts.pitch",
    gauge: "bolts.gauge",
    fastenerRef: "bolts.fastenerRef"
  });
  const boltLength = ctx.optionalParam("bolts.length", 60);
  const nutPositionMode = ctx.optionalParam("bolts.nutPositionMode", "auto");
  const nutOffset = nutPositionMode === "custom" ? ctx.optionalParam("bolts.nutOffset", 0) : 0;
  const verticalPositionMode = ctx.optionalParam("bolts.verticalPositionMode", "centered");
  const horizontalPositionMode = ctx.optionalParam("bolts.horizontalPositionMode", "centered");
  const rowSpacingMode = ctx.optionalParam("bolts.rowSpacingMode", "equal");
  const columnSpacingMode = ctx.optionalParam("bolts.columnSpacingMode", "equal");
  const boltsParallelToSupport = ctx.optionalParam("bolts.parallelToSupport", false);
  const holes = {
    tolerance: ctx.optionalParam("holes.tolerance", "normal"),
    customDiameter: ctx.optionalParam("holes.customDiameter", ctx.optionalParam("holes.diameter")),
    diameter: ctx.optionalParam("holes.diameter"),
    type: ctx.optionalParam("holes.type", "round")
  };
  const fastener = fastenerDefinition(ctx, bolts.fastenerRef);
  const effectiveHoleDiameter = holeDiameter(ctx, fastener, holes);
  const memberHoleDepth = automaticMemberHoleDepth(beamWebThickness, effectiveHoleDiameter);
  const backPlateActive = ctx.roleActive("backFinPlate");
  const gripLength = plate.thickness + beamWebThickness + (backPlateActive ? plate.thickness : 0);
  const holeType = fastener.hole?.shape || holes.type;
  const washers = {
    head: ctx.optionalParam("washers.head", Boolean(fastener.washer)),
    nut: ctx.optionalParam("washers.nut", Boolean(fastener.nut && fastener.washer))
  };
  const rowSpacings = rowSpacingMode === "custom"
    ? normalizeSpacings(ctx.optionalParam("bolts.rowSpacings", []), bolts.rows - 1, bolts.pitch)
    : normalizeSpacings([], bolts.rows - 1, bolts.pitch);
  const columnSpacings = columnSpacingMode === "custom"
    ? normalizeSpacings(ctx.optionalParam("bolts.columnSpacings", []), bolts.columns - 1, bolts.gauge)
    : normalizeSpacings([], bolts.columns - 1, bolts.gauge);

  if (bolts.rows > 1 && Math.min(...rowSpacings) <= 0) {
    ctx.error("fin-plate-bolt-row-spacing-required", "Bolt row spacing must be greater than 0 when more than one bolt row is used.", {
      objectRoles: ["holePattern", "plateHoles", "memberHoles", "fasteners"],
      parameters: rowSpacingMode === "custom" ? ["bolts.rows", "bolts.rowSpacings"] : ["bolts.rows", "bolts.pitch"],
      resolve: rowSpacingMode === "custom" ? [] : [{ path: "bolts.pitch", mode: "min", value: Math.max(1, effectiveHoleDiameter * 3) }]
    });
  }
  if (bolts.columns > 1 && Math.min(...columnSpacings) <= 0) {
    ctx.error("fin-plate-bolt-gauge-required", "Bolt column spacing must be greater than 0 when more than one bolt column is used.", {
      objectRoles: ["holePattern", "plateHoles", "memberHoles", "fasteners"],
      parameters: columnSpacingMode === "custom" ? ["bolts.columns", "bolts.columnSpacings"] : ["bolts.columns", "bolts.gauge"],
      resolve: columnSpacingMode === "custom" ? [] : [{ path: "bolts.gauge", mode: "min", value: Math.max(1, effectiveHoleDiameter * 3) }]
    });
  }

  const patternHeight = rowSpacings.reduce((sum, value) => sum + value, 0);
  const patternWidth = columnSpacings.reduce((sum, value) => sum + value, 0);
  const layoutBounds = plateBoundsInReference(ctx, finPlate, layoutReference);
  const layoutHeight = layoutBounds.maxZ - layoutBounds.minZ;
  const layoutWidth = layoutBounds.maxY - layoutBounds.minY;
  const layoutCenterY = (layoutBounds.minY + layoutBounds.maxY) / 2;
  const layoutCenterZ = (layoutBounds.minZ + layoutBounds.maxZ) / 2;
  const supportCoordinate = boltsParallelToSupport
    ? planeCoordinateInReference(ctx, layoutReference, supportInterface.origin, supportNormal, "localAxisY")
    : null;
  const supportDirection = finiteNumber(supportCoordinate) && layoutCenterY < supportCoordinate ? -1 : 1;
  const topEdgeDistance = ctx.optionalParam("bolts.topEdgeDistance", Math.max(0, (layoutHeight - patternHeight) / 2));
  const supportEdgeDistance = ctx.optionalParam("bolts.supportEdgeDistance", Math.max(0, (layoutWidth - patternWidth) / 2));
  const rowCoordinates = verticalPositionMode === "custom"
    ? customCoordinatesFromEdge(layoutBounds.maxZ - topEdgeDistance, rowSpacings, -1)
    : centeredCoordinates(rowSpacings, layoutCenterZ);
  const columnCoordinates = horizontalPositionMode === "custom"
    ? customCoordinatesFromEdge(
      finiteNumber(supportCoordinate) ? supportCoordinate + supportDirection * supportEdgeDistance : layoutBounds.minY + supportEdgeDistance,
      columnSpacings,
      finiteNumber(supportCoordinate) ? supportDirection : 1
    )
    : centeredCoordinates(columnSpacings, (layoutBounds.minY + layoutBounds.maxY) / 2);
  const layoutPositions = rowCoordinates.flatMap((z) => columnCoordinates.map((y) => [y, z]));
  const boltPositions = layoutPositions.map((position) => pointInReference(ctx, pointFromReference(ctx, layoutReference, position), holeReference));
  const boltGrid = ctx.pattern.rectangularGrid("holePattern", {
    rows: bolts.rows,
    columns: bolts.columns,
    pitch: bolts.rows === 1 ? 0 : bolts.pitch,
    gauge: bolts.columns === 1 ? 0 : bolts.gauge,
    positions: boltPositions,
    layoutReference: boltsParallelToSupport ? {
      origin: layoutReference.origin,
      localAxisY: layoutReference.localAxisY,
      localAxisZ: layoutReference.localAxisZ
    } : null,
    holeDiameter: effectiveHoleDiameter,
    holeType
  });

  ctx.check.gridFitsPlate(patternInReference(ctx, boltGrid, holeReference, { origin: finPlate.center, localAxisY: finPlate.localAxisY, localAxisZ: finPlate.localAxisZ }), finPlate, {
    code: "fin-plate-hole-grid-outside-plate",
    message: "Bolt holes do not fit inside the fin plate.",
    objectRoles: ["finPlate", "holePattern", "plateHoles", "fasteners"],
    parameters: ["bolts.pitch", "bolts.gauge", "bolts.rowSpacings", "bolts.columnSpacings", "bolts.topEdgeDistance", "bolts.supportEdgeDistance", "bolts.verticalPositionMode", "bolts.horizontalPositionMode", "bolts.rowSpacingMode", "bolts.columnSpacingMode", "holes.diameter", "plate.length", "plate.height"],
    widthParameter: "plate.length",
    heightParameter: "plate.height"
  });
  ctx.check.gridFitsInterface(patternInReference(ctx, boltGrid, { origin: holeReference.webFaceOrigin, localAxisY: holeReference.localAxisY, localAxisZ: holeReference.localAxisZ }, { origin: beamHoleReference.webFaceOrigin, localAxisY: beamHoleReference.localAxisY, localAxisZ: beamHoleReference.localAxisZ }), beamHoleReference, {
    centerStation: plate.length / 2,
    code: "fin-plate-hole-grid-outside-secondary-interface",
    message: "Bolt holes do not fit inside the secondary member connection zone.",
    objectRoles: ["holePattern", "memberHoles", "fasteners"],
    parameters: ["bolts.pitch", "bolts.gauge", "bolts.rowSpacings", "bolts.columnSpacings", "bolts.topEdgeDistance", "bolts.supportEdgeDistance", "bolts.verticalPositionMode", "bolts.horizontalPositionMode", "bolts.rowSpacingMode", "bolts.columnSpacingMode", "holes.diameter", "plate.length", "plate.edgeOffset"],
    centerParameter: "plate.length",
    pitchParameter: "bolts.pitch",
    pitchDivisions: Math.max(0, bolts.rows - 1)
  });

  const plateHoles = ctx.feature.holePattern("plateHoles", {
    ownerId: finPlate.id,
    holePatternRef: boltGrid.id,
    reference: { kind: "plate-face", face: "back", origin: holeReference.origin, localAxisY: holeReference.localAxisY, localAxisZ: holeReference.localAxisZ },
    fabrication: { operation: "drill" }
  });
  ctx.feature.holePattern("backPlateHoles", {
    ownerId: backFinPlate.id,
    holePatternRef: boltGrid.id,
    reference: { kind: "plate-face", face: "back", origin: backFinPlate.center, localAxisY: holeReference.localAxisY, localAxisZ: holeReference.localAxisZ },
    fabrication: { operation: "drill" }
  });
  const memberHoles = ctx.feature.holePattern("memberHoles", {
    ownerId: supportedBeam.id,
    holePatternRef: boltGrid.id,
    depth: memberHoleDepth,
    reference: {
      kind: "member-web",
      origin: holeReference.webFaceOrigin,
      normal: holeReference.normal,
      localAxisY: holeReference.localAxisY,
      localAxisZ: holeReference.localAxisZ
    },
    fabrication: { operation: "drill" }
  });

  const assembly = { length: boltLength, gripLength, washers };
  if (nutPositionMode === "custom") assembly.nutOffset = nutOffset;
  const fasteners = ctx.fastener.group("fasteners", {
    fastenerRef: bolts.fastenerRef,
    holePatternRef: boltGrid.id,
    participants: backPlateActive ? [finPlate.id, supportedBeam.id, backFinPlate.id] : [finPlate.id, supportedBeam.id],
    through: { fromFeatureId: plateHoles.id, toFeatureId: memberHoles.id },
    orientation: { axis: ctx.geometry.v.mul(holeReference.normal, -1), headSide: "fin-plate-side" },
    assembly
  });

  return { boltGrid, plateHoles, memberHoles, fasteners, effectiveHoleDiameter };
}
