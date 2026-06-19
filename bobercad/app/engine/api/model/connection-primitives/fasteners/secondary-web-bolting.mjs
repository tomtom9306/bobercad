import { boundsYz, finiteNumber } from "../../../../core/math.mjs";
import { recipeContext, secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";
import { enumValue, optionalPositiveNumber, requiredBoolean, requiredNonNegativeNumber, requiredObject, requiredPositiveInteger, requiredPositiveNumber, requiredString } from "../shared/validation.mjs";

function fastenerDefinition(ctx, fastenerRef) {
  const catalog = requiredObject(ctx, requiredObject(ctx, ctx.fasteners, "fastener catalog").fasteners, "fastener catalog.fasteners");
  const fastener = catalog[fastenerRef];
  if (!fastener) ctx.fail(`fastener not found: ${fastenerRef}`);
  return fastener;
}

function holeDiameter(ctx, fastener, holes) {
  requiredPositiveNumber(ctx, fastener.shank?.diameter, `${fastener.id}.shank.diameter`);
  const tolerance = holes.tolerance;
  if (tolerance === "custom") {
    return requiredPositiveNumber(ctx, holes.customDiameter, "holes.customDiameter");
  }
  const tolerances = requiredObject(ctx, requiredObject(ctx, fastener.hole, `${fastener.id}.hole`).tolerances, `${fastener.id}.hole.tolerances`);
  const catalogDiameter = tolerances[tolerance];
  if (!Number.isFinite(catalogDiameter) || catalogDiameter <= 0) ctx.fail(`${fastener.id}: hole tolerance not found: ${tolerance}`);
  return catalogDiameter;
}

function holeType(ctx, fastener) {
  const hole = requiredObject(ctx, fastener.hole, `${fastener.id}.hole`);
  return requiredString(ctx, hole.shape, `${fastener.id}.hole.shape`);
}

function automaticMemberHoleDepth(webThickness, holeDiameterValue) {
  return Math.max(webThickness * 2 + 4, holeDiameterValue + 2);
}

function spacings(ctx, values, count, equalSpacing, label, custom) {
  const expected = count;
  if (!custom) return Array.from({ length: expected }, () => equalSpacing);
  if (!Array.isArray(values)) ctx.fail(`${label} must be an array`);
  if (values.length !== expected) ctx.fail(`${label} must contain ${expected} values`);
  return values.map((value, index) => {
    return requiredNonNegativeNumber(ctx, value, `${label}[${index}]`);
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
  if (Math.abs(determinant) <= 1e-9) ctx.fail("reference axes cannot be degenerate");
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
  if (axis !== "localAxisY" && axis !== "localAxisZ") ctx.fail(`unsupported reference axis ${axis}`);
  const axisVector = axis === "localAxisZ" ? reference.localAxisZ : reference.localAxisY;
  const point = ctx.geometry.linePlaneIntersection(reference.origin, axisVector, planeOrigin, planeNormal);
  return point ? pointInReference(ctx, point, reference)[axis === "localAxisZ" ? 1 : 0] : null;
}

function plateBoundsInReference(ctx, plate, reference) {
  const outline = ctx.geometry.plateOutline(plate);
  const coordinates = outline.map(([y, z]) => {
    const worldPoint = ctx.geometry.v.add(
      plate.center,
      ctx.geometry.v.add(ctx.geometry.v.mul(plate.localAxisY, y), ctx.geometry.v.mul(plate.localAxisZ, z))
    );
    return pointInReference(ctx, worldPoint, reference);
  });
  return boundsYz(coordinates);
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

export function build(ctx, input) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipe = recipeContext(ctx, input, "web-bolt-pattern");
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
  const finPlate = requiredObject(ctx, recipe.finPlate, "recipeContext.finPlate");
  const backFinPlate = requiredObject(ctx, recipe.backFinPlate, "recipeContext.backFinPlate");

  const bolts = ctx.params({
    rows: "bolts.rows",
    columns: "bolts.columns",
    pitch: "bolts.pitch",
    gauge: "bolts.gauge",
    fastenerRef: "bolts.fastenerRef"
  });
  bolts.rows = requiredPositiveInteger(ctx, bolts.rows, "bolts.rows");
  bolts.columns = requiredPositiveInteger(ctx, bolts.columns, "bolts.columns");
  bolts.pitch = requiredNonNegativeNumber(ctx, bolts.pitch, "bolts.pitch");
  bolts.gauge = requiredNonNegativeNumber(ctx, bolts.gauge, "bolts.gauge");
  bolts.fastenerRef = requiredString(ctx, bolts.fastenerRef, "bolts.fastenerRef");
  const boltLength = requiredPositiveNumber(ctx, ctx.parameterValue("bolts.length"), "bolts.length");
  const nutPositionMode = enumValue(ctx, ctx.parameterValue("bolts.nutPositionMode"), ["auto", "custom"], "bolts.nutPositionMode");
  const nutOffset = nutPositionMode === "custom" ? requiredNonNegativeNumber(ctx, ctx.parameterValue("bolts.nutOffset"), "bolts.nutOffset") : 0;
  const verticalPositionMode = enumValue(ctx, ctx.parameterValue("bolts.verticalPositionMode"), ["centered", "custom"], "bolts.verticalPositionMode");
  const horizontalPositionMode = enumValue(ctx, ctx.parameterValue("bolts.horizontalPositionMode"), ["centered", "custom"], "bolts.horizontalPositionMode");
  const rowSpacingMode = enumValue(ctx, ctx.parameterValue("bolts.rowSpacingMode"), ["equal", "custom"], "bolts.rowSpacingMode");
  const columnSpacingMode = enumValue(ctx, ctx.parameterValue("bolts.columnSpacingMode"), ["equal", "custom"], "bolts.columnSpacingMode");
  const boltsParallelToSupport = requiredBoolean(ctx, ctx.parameterValue("bolts.parallelToSupport"), "bolts.parallelToSupport");
  const holes = {
    tolerance: enumValue(ctx, ctx.parameterValue("holes.tolerance"), ["tight", "normal", "loose", "custom"], "holes.tolerance"),
    customDiameter: optionalPositiveNumber(ctx, ctx.parameterValue("holes.customDiameter", { required: false }), "holes.customDiameter")
  };
  const fastener = fastenerDefinition(ctx, bolts.fastenerRef);
  const effectiveHoleDiameter = holeDiameter(ctx, fastener, holes);
  const memberHoleDepth = automaticMemberHoleDepth(beamWebThickness, effectiveHoleDiameter);
  const backPlateActive = ctx.roleActive("backFinPlate");
  const gripLength = plate.thickness + beamWebThickness + (backPlateActive ? plate.thickness : 0);
  const holeShape = holeType(ctx, fastener);
  const washers = {
    head: requiredBoolean(ctx, ctx.parameterValue("washers.head"), "washers.head"),
    nut: requiredBoolean(ctx, ctx.parameterValue("washers.nut"), "washers.nut")
  };
  const rowSpacings = spacings(
    ctx,
    rowSpacingMode === "custom" ? ctx.parameterValue("bolts.rowSpacings") : undefined,
    bolts.rows - 1,
    bolts.pitch,
    "bolts.rowSpacings",
    rowSpacingMode === "custom"
  );
  const columnSpacings = spacings(
    ctx,
    columnSpacingMode === "custom" ? ctx.parameterValue("bolts.columnSpacings") : undefined,
    bolts.columns - 1,
    bolts.gauge,
    "bolts.columnSpacings",
    columnSpacingMode === "custom"
  );

  if (bolts.rows > 1 && Math.min(...rowSpacings) <= 0) {
    ctx.error("fin-plate-bolt-row-spacing-required", "Bolt row spacing must be greater than 0 when more than one bolt row is used.", {
      objectRoles: ["holePattern", "plateHoles", "memberHoles", "fasteners"],
      parameterPaths: rowSpacingMode === "custom" ? ["bolts.rows", "bolts.rowSpacings"] : ["bolts.rows", "bolts.pitch"],
      resolve: rowSpacingMode === "custom" ? [] : [{ path: "bolts.pitch", mode: "min", value: Math.max(1, effectiveHoleDiameter * 3) }]
    });
  }
  if (bolts.columns > 1 && Math.min(...columnSpacings) <= 0) {
    ctx.error("fin-plate-bolt-gauge-required", "Bolt column spacing must be greater than 0 when more than one bolt column is used.", {
      objectRoles: ["holePattern", "plateHoles", "memberHoles", "fasteners"],
      parameterPaths: columnSpacingMode === "custom" ? ["bolts.columns", "bolts.columnSpacings"] : ["bolts.columns", "bolts.gauge"],
      resolve: columnSpacingMode === "custom" ? [] : [{ path: "bolts.gauge", mode: "min", value: Math.max(1, effectiveHoleDiameter * 3) }]
    });
  }

  const layoutBounds = plateBoundsInReference(ctx, finPlate, layoutReference);
  const layoutCenterY = (layoutBounds.minY + layoutBounds.maxY) / 2;
  const layoutCenterZ = (layoutBounds.minZ + layoutBounds.maxZ) / 2;
  const supportCoordinate = boltsParallelToSupport
    ? planeCoordinateInReference(ctx, layoutReference, supportInterface.origin, supportNormal, "localAxisY")
    : null;
  const hasSupportCoordinate = finiteNumber(supportCoordinate);
  if (boltsParallelToSupport && !hasSupportCoordinate) ctx.fail("support plane coordinate could not be resolved in bolt layout reference");
  const supportDirection = hasSupportCoordinate && layoutCenterY < supportCoordinate ? -1 : 1;
  const topEdgeDistance = verticalPositionMode === "custom"
    ? requiredNonNegativeNumber(ctx, ctx.parameterValue("bolts.topEdgeDistance"), "bolts.topEdgeDistance")
    : undefined;
  const supportEdgeDistance = horizontalPositionMode === "custom"
    ? requiredNonNegativeNumber(ctx, ctx.parameterValue("bolts.supportEdgeDistance"), "bolts.supportEdgeDistance")
    : undefined;
  const rowCoordinates = verticalPositionMode === "custom"
    ? customCoordinatesFromEdge(layoutBounds.maxZ - topEdgeDistance, rowSpacings, -1)
    : centeredCoordinates(rowSpacings, layoutCenterZ);
  const columnCoordinates = horizontalPositionMode === "custom"
    ? customCoordinatesFromEdge(
      hasSupportCoordinate ? supportCoordinate + supportDirection * supportEdgeDistance : layoutBounds.minY + supportEdgeDistance,
      columnSpacings,
      hasSupportCoordinate ? supportDirection : 1
    )
    : centeredCoordinates(columnSpacings, (layoutBounds.minY + layoutBounds.maxY) / 2);
  const layoutPositions = rowCoordinates.flatMap((z) => columnCoordinates.map((y) => [y, z]));
  const boltPositions = layoutPositions.map((position) => pointInReference(ctx, pointFromReference(ctx, layoutReference, position), holeReference));
  const boltGrid = ctx.pattern.rectangularGrid("holePattern", {
    positions: boltPositions,
    layoutReference: boltsParallelToSupport ? {
      origin: layoutReference.origin,
      localAxisY: layoutReference.localAxisY,
      localAxisZ: layoutReference.localAxisZ
    } : null,
    holeDiameter: effectiveHoleDiameter,
    holeType: holeShape
  });

  ctx.check.gridFitsPlate(patternInReference(ctx, boltGrid, holeReference, { origin: finPlate.center, localAxisY: finPlate.localAxisY, localAxisZ: finPlate.localAxisZ }), finPlate, {
    code: "fin-plate-hole-grid-outside-plate",
    message: "Bolt holes do not fit inside the fin plate.",
    objectRoles: ["finPlate", "holePattern", "plateHoles", "fasteners"],
    parameterPaths: ["bolts.pitch", "bolts.gauge", "bolts.rowSpacings", "bolts.columnSpacings", "bolts.topEdgeDistance", "bolts.supportEdgeDistance", "bolts.verticalPositionMode", "bolts.horizontalPositionMode", "bolts.rowSpacingMode", "bolts.columnSpacingMode", "holes.diameter", "plate.length", "plate.height"],
    widthParameter: "plate.length",
    heightParameter: "plate.height"
  });
  ctx.check.gridFitsInterface(patternInReference(ctx, boltGrid, { origin: holeReference.webFaceOrigin, localAxisY: holeReference.localAxisY, localAxisZ: holeReference.localAxisZ }, { origin: beamHoleReference.webFaceOrigin, localAxisY: beamHoleReference.localAxisY, localAxisZ: beamHoleReference.localAxisZ }), beamHoleReference, {
    centerStation: plate.length / 2,
    code: "fin-plate-hole-grid-outside-secondary-interface",
    message: "Bolt holes do not fit inside the secondary member connection zone.",
    objectRoles: ["holePattern", "memberHoles", "fasteners"],
    parameterPaths: ["bolts.pitch", "bolts.gauge", "bolts.rowSpacings", "bolts.columnSpacings", "bolts.topEdgeDistance", "bolts.supportEdgeDistance", "bolts.verticalPositionMode", "bolts.horizontalPositionMode", "bolts.rowSpacingMode", "bolts.columnSpacingMode", "holes.diameter", "plate.length", "plate.edgeOffset"],
    centerParameter: "plate.length",
    pitchParameter: "bolts.pitch",
    pitchDivisions: bolts.rows - 1
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
