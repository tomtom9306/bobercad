function component(project, id) {
  return id ? project.model?.smartComponentInstances?.[id] : null;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function norm(a, fallback = [1, 0, 0]) {
  const value = length(a);
  return value > 1e-9 ? mul(a, 1 / value) : [...fallback];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function plateSketchBounds(plate) {
  const points = (plate.sketch?.vertices || [])
    .map((vertex) => vertex.point)
    .filter((point) => Array.isArray(point) && point.length >= 2);
  if (!points.length) return { width: 0, height: 0 };
  return {
    width: Math.max(...points.map((point) => point[0])) - Math.min(...points.map((point) => point[0])),
    height: Math.max(...points.map((point) => point[1])) - Math.min(...points.map((point) => point[1]))
  };
}

function connectionValue(ctx, path) {
  const inputValue = ctx.input(path);
  if (inputValue !== undefined) return inputValue;
  return ctx.parameterValue(path, { required: false });
}

function requiredPositiveInput(ctx, path, label) {
  const value = connectionValue(ctx, path);
  if (value === undefined) {
    ctx.error("standard-connection-input-missing", `${label} is required to generate standard connection hardware.`, { parameterPaths: [path] });
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    ctx.error("standard-connection-input-invalid", `${label} must be a positive number.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredInput(ctx, path, label) {
  const value = connectionValue(ctx, path);
  if (value === undefined) {
    ctx.error("standard-connection-input-missing", `${label} is required to generate standard connection hardware.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function averagePoint(points) {
  const valid = points.filter((point) => Array.isArray(point) && point.length === 3);
  if (!valid.length) return [0, 0, 0];
  return valid.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / valid.length);
}

function axisSpan(points, axis) {
  if (!points.length) return 0;
  const values = points.map((point) => point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2]);
  return Math.max(...values) - Math.min(...values);
}

function registerRole(ctx, role, suffix) {
  return ctx.generatedRole(role, suffix);
}

function outputIds(ctx, componentId, path, label) {
  const instance = component(ctx.project, componentId);
  const value = String(path).split(".").reduce((cursor, key) => cursor?.[key], instance?.outputs);
  if (!Array.isArray(value)) {
    ctx.error("component-output-missing", `${label} output ${path} is required for standard connection generation.`, {
      resolve: "Generate the source child component through the shared output API before building standard connections."
    });
    return [];
  }
  return value.filter((id) => typeof id === "string");
}

function outputMembers(ctx, componentId, path, label) {
  return outputIds(ctx, componentId, path, label)
    .map((id) => ctx.project.model?.members?.[id])
    .filter(Boolean);
}

function outputPlates(ctx, componentId, path, label) {
  return outputIds(ctx, componentId, path, label)
    .map((id) => ctx.project.model?.plates?.[id])
    .filter(Boolean);
}

function supportMembers(ctx, supportComponentId) {
  return outputMembers(ctx, supportComponentId, "supportMemberIds", "Support component");
}

function spiralColumnMember(supports) {
  return supports.find((member) => member.type === "stair-spiral-column") || null;
}

function railingPosts(ctx, railingComponentId) {
  return outputMembers(ctx, railingComponentId, "postMemberIds", "Railing component");
}

function treadPlates(ctx, treadComponentId) {
  return outputPlates(ctx, treadComponentId, "treadPlateIds", "Tread component");
}

function plateFaceReference(plate, face = "back") {
  return {
    kind: "plate-face",
    face,
    origin: plate.center,
    localAxisY: plate.localAxisY,
    localAxisZ: plate.localAxisZ
  };
}

function horizontalFrame(member) {
  const axis = norm(sub(member.end, member.start), [1, 0, 0]);
  const horizontal = norm([axis[0], axis[1], 0], [1, 0, 0]);
  const lateral = norm(cross([0, 0, 1], horizontal), [0, 1, 0]);
  return { axis, horizontal, lateral };
}

function memberPointAtRouteStation(member, splitFrame) {
  const startStation = member.placementIntent?.stationStart;
  const endStation = member.placementIntent?.stationEnd;
  if (![startStation, endStation, splitFrame?.station].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  const span = endStation - startStation;
  if (Math.abs(span) <= 1e-9) return null;
  const t = Math.max(0, Math.min(1, (splitFrame.station - startStation) / span));
  return add(member.start, mul(sub(member.end, member.start), t));
}

function createMemberSplitTrim(ctx, baseRole, member, center, frame, splitFrame, cutGap, size) {
  const halfGap = cutGap / 2;
  const axisY = norm(cross(frame.axis, frame.lateral), [0, 0, 1]);
  const extents = Math.max(size.width, size.height, cutGap) * 2;
  const before = ctx.reference.plane(registerRole(ctx, `${baseRole}TrimPlaneBefore`, `_${baseRole}_trim_plane_before`), {
    origin: add(center, mul(frame.axis, -halfGap)),
    normal: frame.axis,
    axisX: frame.lateral,
    axisY,
    size: [extents, extents],
    display: { visible: false },
    fabrication: { operation: "member-splice-section-break-plane" },
    notes: `Member splice split plane before ${splitFrame.id}`
  });
  const after = ctx.reference.plane(registerRole(ctx, `${baseRole}TrimPlaneAfter`, `_${baseRole}_trim_plane_after`), {
    origin: add(center, mul(frame.axis, halfGap)),
    normal: frame.axis,
    axisX: frame.lateral,
    axisY,
    size: [extents, extents],
    display: { visible: false },
    fabrication: { operation: "member-splice-section-break-plane" },
    notes: `Member splice split plane after ${splitFrame.id}`
  });
  const trim = ctx.trim.planeTrim(registerRole(ctx, `${baseRole}SplitTrim`, `_${baseRole}_split_trim`), {
    memberId: member.id,
    referencePlaneIds: [before.id, after.id],
    removedRegionKeys: [`${before.id}:+|${after.id}:-`],
    gap: 0,
    display: { color: "#38bdf8", edgeColor: "#0284c7", transparent: true, opacity: 0.16 },
    fabrication: { operation: "member-splice-section-break" },
    placementIntent: {
      role: "member-splice-section-break",
      host: { memberId: member.id, splitFrameId: splitFrame.id },
      fit: "remove-member-region-between-splice-planes",
      gap: cutGap
    }
  });
  return { referencePlaneIds: [before.id, after.id], trimJointId: trim.id };
}

function createHoleFeatureAndFasteners(ctx, baseRole, plate, positions, options = {}) {
  if (!options.fastenerRef || !Number.isFinite(options.holeDiameter) || options.holeDiameter <= 0 || !Number.isFinite(options.length) || options.length <= 0) {
    ctx.error("standard-connection-fastener-values-missing", `${baseRole}: fastener reference, hole diameter and length are required.`, {
      parameterPaths: Object.values(options.parameterPaths || {}).filter(Boolean)
    });
    return null;
  }
  return ctx.fastener.patternedGroup(registerRole(ctx, `${baseRole}Fasteners`, `_${baseRole}_fasteners`), {
    patternRole: registerRole(ctx, `${baseRole}Pattern`, `_${baseRole}_pattern`),
    feature: {
      role: registerRole(ctx, `${baseRole}Holes`, `_${baseRole}_holes`),
      ownerId: plate.id,
      depth: positive(options.depth, plate.thickness + 2),
      reference: options.reference || plateFaceReference(plate),
      placementIntent: {
        role: options.holeRole || "component-hardware-hole-pattern",
        host: options.host || {}
      }
    },
    holeDiameter: options.holeDiameter,
    holeType: "round",
    positions,
    fastenerRef: options.fastenerRef,
    participants: options.participants || [plate.id],
    orientation: { axis: options.axis || plate.normal, headSide: options.headSide || "outside" },
    assembly: {
      length: options.length,
      gripLength: positive(options.gripLength, plate.thickness + 20),
      washers: options.washers || { head: true, nut: true },
      nutOffset: options.nutOffset
    },
    display: options.display || { color: "#1f2937", headColor: "#1f2937" },
    placementIntent: {
      role: options.fastenerRole || "component-hardware-fasteners",
      host: options.host || {}
    },
    parameterPaths: options.parameterPaths,
    bim: { name: options.name || `${baseRole} fasteners` }
  });
}

function addGeneratedFastenerIds(generatedIds, result) {
  if (!result) return;
  generatedIds.fasteners.push(result.fastenerId);
  generatedIds.patterns.push(result.patternId);
  if (result.featureId) generatedIds.features.push(result.featureId);
}

function createTreadCleats(ctx, treads, supports, generatedIds) {
  const fastenerRef = requiredInput(ctx, "connections.treadFastenerRef", "Tread fastener reference");
  const cleatThickness = requiredPositiveInput(ctx, "connections.treadCleatThickness", "Tread cleat thickness");
  const cleatLength = requiredPositiveInput(ctx, "connections.treadCleatLength", "Tread cleat length");
  const cleatHeight = requiredPositiveInput(ctx, "connections.treadCleatHeight", "Tread cleat height");
  const holeDiameter = requiredPositiveInput(ctx, "connections.treadBoltHoleDiameter", "Tread bolt hole diameter");
  const boltLength = requiredPositiveInput(ctx, "connections.treadBoltLength", "Tread bolt length");
  if (!fastenerRef || !cleatThickness || !cleatLength || !cleatHeight || !holeDiameter || !boltLength) return;
  for (const [index, tread] of treads.entries()) {
    const tangent = norm(tread.localAxisZ || [1, 0, 0]);
    const lateral = norm(tread.localAxisY || [0, 1, 0]);
    const up = norm(tread.normal || [0, 0, 1]);
    const sideSupports = supports.length > 1 ? supports.slice(0, 2) : supports;
    for (const [sideIndex, support] of sideSupports.entries()) {
      const sideSign = sideIndex === 0 ? -1 : 1;
      const roleBase = `treadCleat${index + 1}_${sideIndex + 1}`;
      const plate = ctx.plate.create(registerRole(ctx, roleBase, `_${roleBase}`), {
        type: "bolted-tread-cleat",
        thickness: cleatThickness,
        width: cleatLength,
        height: cleatHeight,
        material: "S355",
        center: add(add(tread.center, mul(lateral, sideSign * (plateSketchBounds(tread).width / 2 - 35))), mul(up, -70)),
        normal: mul(lateral, sideSign),
        localAxisY: tangent,
        localAxisZ: up,
        display: { color: "#475569", edgeColor: "#334155" },
        placementIntent: {
          role: "tread-cleat",
          treadIndex: index,
          sideIndex,
          host: { treadId: tread.id, supportId: support?.id }
        },
        bim: { name: `Tread ${index + 1} bolted cleat ${sideIndex + 1}` }
      });
      generatedIds.plates.push(plate.id);
      const fasteners = createHoleFeatureAndFasteners(ctx, roleBase, plate, [[-45, -18], [45, -18]], {
        holeDiameter,
        fastenerRef,
        axis: plate.normal,
        length: boltLength,
        gripLength: plate.thickness + 35,
        participants: [plate.id, tread.id, support?.id].filter(Boolean),
        host: { treadId: tread.id, supportId: support?.id },
        holeRole: "tread-cleat-bolt-holes",
        fastenerRole: "bearing-plate-to-support-bolts",
        parameterPaths: {
          fastenerRef: "connections.treadFastenerRef",
          holeDiameter: "connections.treadBoltHoleDiameter",
          length: "connections.treadBoltLength"
        },
        name: `Tread ${index + 1} cleat ${sideIndex + 1} bolts`
      });
      addGeneratedFastenerIds(generatedIds, fasteners);
    }
  }
}

function createMountingSurfaces(ctx, floorMembers, topMembers, frame, generatedIds) {
  if (ctx.input("connections.showMountingSurfaces") === false || (!floorMembers.length && !topMembers.length)) {
    return {};
  }
  const result = {};
  const levels = {
    slab1Elevation: ctx.input("levels.slab1Elevation"),
    slab2Elevation: ctx.input("levels.slab2Elevation")
  };
  const material = requiredInput(ctx, "connections.mountingSurfaceMaterial", "Mounting surface material");
  if (!material) return result;
  const floorPoints = floorMembers.map((member) => member.start).filter(Boolean);
  if (floorPoints.length) {
    const floorThickness = requiredPositiveInput(ctx, "connections.floorSurfaceThickness", "Floor surface thickness");
    const floorLength = requiredPositiveInput(ctx, "connections.floorSurfaceLength", "Floor surface length");
    const floorWidth = requiredPositiveInput(ctx, "connections.floorSurfaceWidth", "Floor surface width");
    if (!floorThickness || !floorLength || !floorWidth) return result;
    const floorAnchor = add(averagePoint(floorPoints), mul(frame.horizontal, -80));
    const floorTopElevation = finite(levels.slab1Elevation, floorAnchor[2] - 18);
    const floorCenter = [floorAnchor[0], floorAnchor[1], floorTopElevation - floorThickness / 2];
    const floor = ctx.plate.create(registerRole(ctx, "floorMountingSurface", "_floor_mounting_surface"), {
      type: "concrete-floor-mounting-surface",
      thickness: floorThickness,
      width: floorLength,
      height: floorWidth,
      material,
      center: floorCenter,
      normal: [0, 0, 1],
      localAxisY: frame.horizontal,
      localAxisZ: frame.lateral,
      display: { color: "#9aa3ad", edgeColor: "#717b86", opacity: 0.78 },
      placementIntent: {
        role: "floor-mounting-surface",
        host: { supportMemberIds: floorMembers.map((member) => member.id) }
      },
      bim: { name: "Concrete floor mounting surface" }
    });
    generatedIds.plates.push(floor.id);
    result.floorId = floor.id;
  }

  const topPoints = topMembers.map((member) => member.end).filter(Boolean);
  if (topPoints.length) {
    const topThickness = requiredPositiveInput(ctx, "connections.topSlabSurfaceThickness", "Top slab surface thickness");
    const topWidth = requiredPositiveInput(ctx, "connections.topSlabSurfaceWidth", "Top slab surface width");
    const topHeight = requiredPositiveInput(ctx, "connections.topSlabSurfaceHeight", "Top slab surface height");
    if (!topThickness || !topWidth || !topHeight) return result;
    const topAnchor = add(averagePoint(topPoints), mul(frame.horizontal, 80 + topThickness / 2));
    const topBottomElevation = finite(levels.slab2Elevation, topAnchor[2] + 90 - topHeight / 2);
    const topCenter = [topAnchor[0], topAnchor[1], topBottomElevation + topHeight / 2];
    const topSlab = ctx.plate.create(registerRole(ctx, "topSlabMountingSurface", "_top_slab_mounting_surface"), {
      type: "concrete-top-slab-mounting-surface",
      thickness: topThickness,
      width: topWidth,
      height: topHeight,
      material,
      center: topCenter,
      normal: frame.horizontal,
      localAxisY: frame.lateral,
      localAxisZ: [0, 0, 1],
      display: { color: "#9aa3ad", edgeColor: "#717b86", opacity: 0.72 },
      placementIntent: {
        role: "top-slab-mounting-surface",
        host: { supportMemberIds: topMembers.map((member) => member.id) }
      },
      bim: { name: "Concrete top slab mounting surface" }
    });
    generatedIds.plates.push(topSlab.id);
    result.topSlabId = topSlab.id;
  }
  return result;
}

function createFloorAndSlabFixings(ctx, supports, generatedIds) {
  if (!supports.length) return;
  const allElevations = supports.flatMap((member) => [member.start?.[2], member.end?.[2]]).filter((value) => Number.isFinite(value));
  const minElevation = Math.min(...allElevations);
  const maxElevation = Math.max(...allElevations);
  const tolerance = requiredPositiveInput(ctx, "connections.levelTolerance", "Level detection tolerance");
  const anchorRef = requiredInput(ctx, "connections.anchorFastenerRef", "Anchor fastener reference");
  const anchorHoleDiameter = requiredPositiveInput(ctx, "connections.anchorHoleDiameter", "Anchor hole diameter");
  const anchorLength = requiredPositiveInput(ctx, "connections.anchorLength", "Anchor length");
  const floorAnchorGripLength = requiredPositiveInput(ctx, "connections.floorAnchorGripLength", "Floor anchor grip length");
  const slabAnchorGripLength = requiredPositiveInput(ctx, "connections.slabAnchorGripLength", "Slab anchor grip length");
  const floorBasePlateThickness = requiredPositiveInput(ctx, "connections.floorBasePlateThickness", "Floor base plate thickness");
  const floorBasePlateLength = requiredPositiveInput(ctx, "connections.floorBasePlateLength", "Floor base plate length");
  const floorBasePlateWidth = requiredPositiveInput(ctx, "connections.floorBasePlateWidth", "Floor base plate width");
  const slabBracketThickness = requiredPositiveInput(ctx, "connections.slabBracketThickness", "Slab bracket thickness");
  const slabBracketWidth = requiredPositiveInput(ctx, "connections.slabBracketWidth", "Slab bracket width");
  const slabBracketHeight = requiredPositiveInput(ctx, "connections.slabBracketHeight", "Slab bracket height");
  if (!tolerance || !anchorRef || !anchorHoleDiameter || !anchorLength || !floorAnchorGripLength || !slabAnchorGripLength || !floorBasePlateThickness || !floorBasePlateLength || !floorBasePlateWidth || !slabBracketThickness || !slabBracketWidth || !slabBracketHeight) return;
  const floorMembers = supports.filter((member) => Number.isFinite(member.start?.[2]) && member.start[2] <= minElevation + tolerance);
  const topMembers = supports.filter((member) => Number.isFinite(member.end?.[2]) && member.end[2] >= maxElevation - tolerance);
  const baseFrame = (floorMembers[0] || topMembers[0] || supports[0]) ? horizontalFrame(floorMembers[0] || topMembers[0] || supports[0]) : { horizontal: [1, 0, 0], lateral: [0, 1, 0] };
  const mountingSurfaces = createMountingSurfaces(ctx, floorMembers, topMembers, baseFrame, generatedIds);
  for (const [index, member] of supports.entries()) {
    const frame = horizontalFrame(member);
    const isFloorStart = Number.isFinite(member.start?.[2]) && member.start[2] <= minElevation + tolerance;
    if (isFloorStart) {
      const startRole = `floorBasePlate${index + 1}`;
      const startPlate = ctx.plate.create(registerRole(ctx, startRole, `_${startRole}`), {
        type: "floor-base-plate",
        thickness: floorBasePlateThickness,
        width: floorBasePlateLength,
        height: floorBasePlateWidth,
        material: "S355",
        center: add(member.start, [0, 0, -10]),
        normal: [0, 0, 1],
        localAxisY: frame.horizontal,
        localAxisZ: frame.lateral,
        display: { color: "#53616f", edgeColor: "#334155" },
        placementIntent: { role: "floor-base-plate", host: { memberId: member.id, end: "start" } },
        bim: { name: `Stringer ${index + 1} floor base plate` }
      });
      generatedIds.plates.push(startPlate.id);
      const floorAnchors = createHoleFeatureAndFasteners(ctx, startRole, startPlate, [[-80, -65], [80, -65], [-80, 65], [80, 65]], {
        holeDiameter: anchorHoleDiameter,
        fastenerRef: anchorRef,
        axis: [0, 0, -1],
        length: anchorLength,
        gripLength: floorAnchorGripLength,
        participants: [startPlate.id, member.id, mountingSurfaces.floorId].filter(Boolean),
        host: { memberId: member.id, mountingSurfaceId: mountingSurfaces.floorId, end: "start" },
        holeRole: "floor-anchor-holes",
        fastenerRole: "floor-anchor-bolts",
        parameterPaths: {
          fastenerRef: "connections.anchorFastenerRef",
          holeDiameter: "connections.anchorHoleDiameter",
          length: "connections.anchorLength",
          gripLength: "connections.floorAnchorGripLength"
        },
        name: `Stringer ${index + 1} floor anchors`
      });
      addGeneratedFastenerIds(generatedIds, floorAnchors);
    }

    const isTopEnd = Number.isFinite(member.end?.[2]) && member.end[2] >= maxElevation - tolerance;
    if (isTopEnd) {
      const endRole = `topSlabBracket${index + 1}`;
      const topPlate = ctx.plate.create(registerRole(ctx, endRole, `_${endRole}`), {
        type: "top-slab-fixing-plate",
        thickness: slabBracketThickness,
        width: slabBracketWidth,
        height: slabBracketHeight,
        material: "S355",
        center: add(add(member.end, mul(frame.horizontal, 80)), [0, 0, 90]),
        normal: frame.horizontal,
        localAxisY: frame.lateral,
        localAxisZ: [0, 0, 1],
        display: { color: "#53616f", edgeColor: "#334155" },
        placementIntent: { role: "top-slab-fixing-plate", host: { memberId: member.id, end: "end" } },
        bim: { name: `Stringer ${index + 1} top slab bracket` }
      });
      generatedIds.plates.push(topPlate.id);
      const slabAnchors = createHoleFeatureAndFasteners(ctx, endRole, topPlate, [[-70, -70], [70, -70], [-70, 70], [70, 70]], {
        holeDiameter: anchorHoleDiameter,
        fastenerRef: anchorRef,
        axis: topPlate.normal,
        length: anchorLength,
        gripLength: slabAnchorGripLength,
        participants: [topPlate.id, member.id, mountingSurfaces.topSlabId].filter(Boolean),
        host: { memberId: member.id, mountingSurfaceId: mountingSurfaces.topSlabId, end: "end" },
        holeRole: "slab-anchor-holes",
        fastenerRole: "top-slab-anchor-bolts",
        parameterPaths: {
          fastenerRef: "connections.anchorFastenerRef",
          holeDiameter: "connections.anchorHoleDiameter",
          length: "connections.anchorLength",
          gripLength: "connections.slabAnchorGripLength"
        },
        name: `Stringer ${index + 1} top slab anchors`
      });
      addGeneratedFastenerIds(generatedIds, slabAnchors);
    }
  }
}

function createSpiralColumnFixings(ctx, column, generatedIds) {
  if (!column) return;
  const frame = {
    horizontal: [1, 0, 0],
    lateral: [0, 1, 0]
  };
  const mountingSurfaces = {};

  if (ctx.input("connections.showMountingSurfaces") !== false) {
    const material = requiredInput(ctx, "connections.mountingSurfaceMaterial", "Mounting surface material");
    const surfaceSize = requiredPositiveInput(ctx, "connections.spiralMountingSurfaceSize", "Spiral mounting surface size");
    const floorThickness = requiredPositiveInput(ctx, "connections.floorSurfaceThickness", "Floor surface thickness");
    if (!material || !surfaceSize || !floorThickness) return;
    const floorSurface = ctx.plate.create(registerRole(ctx, "spiralFloorMountingSurface", "_spiral_floor_mounting_surface"), {
      type: "concrete-spiral-floor-mounting-surface",
      thickness: floorThickness,
      width: surfaceSize,
      height: surfaceSize,
      material,
      center: add(column.start, [0, 0, -floorThickness / 2 - 18]),
      normal: [0, 0, 1],
      localAxisY: frame.horizontal,
      localAxisZ: frame.lateral,
      display: { color: "#9aa3ad", edgeColor: "#717b86", opacity: 0.78 },
      placementIntent: {
        role: "spiral-column-floor-mounting-surface",
        host: { memberId: column.id }
      },
      bim: { name: "Spiral column floor mounting surface" }
    });
    generatedIds.plates.push(floorSurface.id);
    mountingSurfaces.floorId = floorSurface.id;

    const topThickness = requiredPositiveInput(ctx, "connections.topSlabSurfaceThickness", "Top slab surface thickness");
    if (!topThickness) return;
    const topSurface = ctx.plate.create(registerRole(ctx, "spiralTopMountingSurface", "_spiral_top_mounting_surface"), {
      type: "concrete-spiral-top-mounting-surface",
      thickness: topThickness,
      width: surfaceSize,
      height: surfaceSize,
      material,
      center: add(column.end, [0, 0, topThickness / 2 + 18]),
      normal: [0, 0, 1],
      localAxisY: frame.horizontal,
      localAxisZ: frame.lateral,
      display: { color: "#9aa3ad", edgeColor: "#717b86", opacity: 0.62 },
      placementIntent: {
        role: "spiral-column-top-mounting-surface",
        host: { memberId: column.id }
      },
      bim: { name: "Spiral column top mounting surface" }
    });
    generatedIds.plates.push(topSurface.id);
    mountingSurfaces.topId = topSurface.id;
  }

  const plateSize = requiredPositiveInput(ctx, "connections.spiralBasePlateSize", "Spiral base plate size");
  const basePlateThickness = requiredPositiveInput(ctx, "connections.spiralBasePlateThickness", "Spiral base plate thickness");
  const topPlateThickness = requiredPositiveInput(ctx, "connections.spiralTopPlateThickness", "Spiral top plate thickness");
  const anchorRef = requiredInput(ctx, "connections.anchorFastenerRef", "Anchor fastener reference");
  const anchorHoleDiameter = requiredPositiveInput(ctx, "connections.anchorHoleDiameter", "Anchor hole diameter");
  const anchorLength = requiredPositiveInput(ctx, "connections.anchorLength", "Anchor length");
  const floorAnchorGripLength = requiredPositiveInput(ctx, "connections.floorAnchorGripLength", "Floor anchor grip length");
  const slabAnchorGripLength = requiredPositiveInput(ctx, "connections.slabAnchorGripLength", "Slab anchor grip length");
  if (!plateSize || !basePlateThickness || !topPlateThickness || !anchorRef || !anchorHoleDiameter || !anchorLength || !floorAnchorGripLength || !slabAnchorGripLength) return;
  const baseRole = "spiralColumnBasePlate";
  const basePlate = ctx.plate.create(registerRole(ctx, baseRole, "_spiral_column_base_plate"), {
    type: "spiral-column-base-plate",
    thickness: basePlateThickness,
    width: plateSize,
    height: plateSize,
    material: "S355",
    center: add(column.start, [0, 0, -10]),
    normal: [0, 0, 1],
    localAxisY: frame.horizontal,
    localAxisZ: frame.lateral,
    display: { color: "#53616f", edgeColor: "#334155" },
    placementIntent: {
      role: "spiral-column-base-plate",
      host: { memberId: column.id, end: "start" }
    },
    bim: { name: "Spiral column base plate" }
  });
  generatedIds.plates.push(basePlate.id);
  const baseAnchors = createHoleFeatureAndFasteners(ctx, baseRole, basePlate, [[-105, -105], [105, -105], [-105, 105], [105, 105]], {
    holeDiameter: anchorHoleDiameter,
    fastenerRef: anchorRef,
    axis: [0, 0, -1],
    length: anchorLength,
    gripLength: floorAnchorGripLength,
    participants: [basePlate.id, column.id, mountingSurfaces.floorId].filter(Boolean),
    host: { memberId: column.id, mountingSurfaceId: mountingSurfaces.floorId, end: "start" },
    holeRole: "spiral-column-base-anchor-holes",
    fastenerRole: "spiral-column-base-anchors",
    parameterPaths: {
      fastenerRef: "connections.anchorFastenerRef",
      holeDiameter: "connections.anchorHoleDiameter",
      length: "connections.anchorLength",
      gripLength: "connections.floorAnchorGripLength"
    },
    name: "Spiral column base anchors"
  });
  addGeneratedFastenerIds(generatedIds, baseAnchors);

  const topRole = "spiralColumnTopPlate";
  const topPlate = ctx.plate.create(registerRole(ctx, topRole, "_spiral_column_top_plate"), {
    type: "spiral-column-top-plate",
    thickness: topPlateThickness,
    width: plateSize,
    height: plateSize,
    material: "S355",
    center: add(column.end, [0, 0, 10]),
    normal: [0, 0, 1],
    localAxisY: frame.horizontal,
    localAxisZ: frame.lateral,
    display: { color: "#53616f", edgeColor: "#334155" },
    placementIntent: {
      role: "spiral-column-top-plate",
      host: { memberId: column.id, end: "end" }
    },
    bim: { name: "Spiral column top plate" }
  });
  generatedIds.plates.push(topPlate.id);
  const topAnchors = createHoleFeatureAndFasteners(ctx, topRole, topPlate, [[-95, -95], [95, -95], [-95, 95], [95, 95]], {
    holeDiameter: anchorHoleDiameter,
    fastenerRef: anchorRef,
    axis: [0, 0, 1],
    length: anchorLength,
    gripLength: slabAnchorGripLength,
    participants: [topPlate.id, column.id, mountingSurfaces.topId].filter(Boolean),
    host: { memberId: column.id, mountingSurfaceId: mountingSurfaces.topId, end: "end" },
    holeRole: "spiral-column-top-anchor-holes",
    fastenerRole: "spiral-column-top-anchors",
    parameterPaths: {
      fastenerRef: "connections.anchorFastenerRef",
      holeDiameter: "connections.anchorHoleDiameter",
      length: "connections.anchorLength",
      gripLength: "connections.slabAnchorGripLength"
    },
    name: "Spiral column top anchors"
  });
  addGeneratedFastenerIds(generatedIds, topAnchors);
}

function createSpiralTreadColumnBrackets(ctx, treads, column, generatedIds) {
  if (!column || !treads.length) return;
  const fastenerRef = requiredInput(ctx, "connections.treadFastenerRef", "Tread fastener reference");
  const bracketThickness = requiredPositiveInput(ctx, "connections.treadCleatThickness", "Tread bracket thickness");
  const bracketLength = requiredPositiveInput(ctx, "connections.spiralTreadBracketLength", "Spiral tread bracket length");
  const bracketHeight = requiredPositiveInput(ctx, "connections.spiralTreadBracketHeight", "Spiral tread bracket height");
  const holeDiameter = requiredPositiveInput(ctx, "connections.treadBoltHoleDiameter", "Tread bolt hole diameter");
  const boltLength = requiredPositiveInput(ctx, "connections.treadBoltLength", "Tread bolt length");
  if (!fastenerRef || !bracketThickness || !bracketLength || !bracketHeight || !holeDiameter || !boltLength) return;
  for (const [index, tread] of treads.entries()) {
    const tangent = norm(tread.localAxisZ || [1, 0, 0]);
    const inward = norm(tread.localAxisY || [0, 1, 0]);
    const up = norm(tread.normal || [0, 0, 1]);
    const roleBase = `spiralTreadColumnBracket${index + 1}`;
    const bracket = ctx.plate.create(registerRole(ctx, roleBase, `_spiral_tread_column_bracket_${index + 1}`), {
      type: "spiral-tread-column-bracket",
      thickness: bracketThickness,
      width: bracketLength,
      height: bracketHeight,
      material: "S355",
      center: add(add(tread.center, mul(inward, plateSketchBounds(tread).width / 2 - 45)), mul(up, -62)),
      normal: inward,
      localAxisY: tangent,
      localAxisZ: up,
      display: { color: "#475569", edgeColor: "#334155" },
      placementIntent: {
        role: "spiral-tread-column-bracket",
        treadIndex: index,
        host: { treadId: tread.id, columnId: column.id }
      },
      bim: { name: `Spiral tread ${index + 1} column bracket` }
    });
    generatedIds.plates.push(bracket.id);
    const fasteners = createHoleFeatureAndFasteners(ctx, roleBase, bracket, [[-38, -18], [38, -18]], {
      holeDiameter,
      fastenerRef,
      axis: bracket.normal,
      length: boltLength,
      gripLength: bracket.thickness + 35,
      participants: [bracket.id, tread.id, column.id],
      host: { treadId: tread.id, columnId: column.id },
      holeRole: "spiral-tread-column-bracket-holes",
      fastenerRole: "spiral-tread-column-bolts",
      parameterPaths: {
        fastenerRef: "connections.treadFastenerRef",
        holeDiameter: "connections.treadBoltHoleDiameter",
        length: "connections.treadBoltLength"
      },
      name: `Spiral tread ${index + 1} column bracket bolts`
    });
    addGeneratedFastenerIds(generatedIds, fasteners);
  }
}

function createPostBaseFixings(ctx, posts, generatedIds) {
  const plateThickness = requiredPositiveInput(ctx, "connections.postBasePlateThickness", "Post base plate thickness");
  const plateWidth = requiredPositiveInput(ctx, "connections.postBasePlateWidth", "Post base plate width");
  const plateDepth = requiredPositiveInput(ctx, "connections.postBasePlateDepth", "Post base plate depth");
  const anchorHoleDiameter = requiredPositiveInput(ctx, "connections.postAnchorHoleDiameter", "Post anchor hole diameter");
  const anchorRef = requiredInput(ctx, "connections.postAnchorFastenerRef", "Post anchor fastener reference");
  const anchorLength = requiredPositiveInput(ctx, "connections.postAnchorLength", "Post anchor length");
  const anchorGripLength = requiredPositiveInput(ctx, "connections.postAnchorGripLength", "Post anchor grip length");
  if (!plateThickness || !plateWidth || !plateDepth || !anchorHoleDiameter || !anchorRef || !anchorLength || !anchorGripLength) return;
  for (const [index, post] of posts.entries()) {
    const frame = horizontalFrame(post);
    const role = `postBase${index + 1}`;
    const plate = ctx.plate.create(registerRole(ctx, role, `_${role}`), {
      type: "post-base-plate",
      thickness: plateThickness,
      width: plateWidth,
      height: plateDepth,
      material: "S355",
      center: [post.start[0], post.start[1], post.start[2] - 6],
      normal: [0, 0, 1],
      localAxisY: frame.lateral,
      localAxisZ: frame.horizontal,
      display: { color: "#53616f", edgeColor: "#334155" },
      placementIntent: { role: "post-base-plate", host: { memberId: post.id } },
      bim: { name: `Post ${index + 1} base plate` }
    });
    generatedIds.plates.push(plate.id);
    const anchors = createHoleFeatureAndFasteners(ctx, role, plate, [[-50, -40], [50, -40], [-50, 40], [50, 40]], {
      holeDiameter: anchorHoleDiameter,
      fastenerRef: anchorRef,
      axis: [0, 0, -1],
      length: anchorLength,
      gripLength: anchorGripLength,
      participants: [plate.id, post.id],
      host: { memberId: post.id },
      holeRole: "post-base-anchor-holes",
      fastenerRole: "post-base-anchor-bolts",
      parameterPaths: {
        fastenerRef: "connections.postAnchorFastenerRef",
        holeDiameter: "connections.postAnchorHoleDiameter",
        length: "connections.postAnchorLength",
        gripLength: "connections.postAnchorGripLength"
      },
      name: `Post ${index + 1} base anchors`
    });
    addGeneratedFastenerIds(generatedIds, anchors);
  }
}

export function buildStandardHardwareConnections(ctx, options = {}) {
  const treads = treadPlates(ctx, ctx.input("components.treadComponentId"));
  const supports = supportMembers(ctx, ctx.input("components.supportComponentId"));
  const posts = railingPosts(ctx, ctx.input("components.railingComponentId"));
  const generatedIds = { plates: [], patterns: [], features: [], fasteners: [], welds: [] };
  const spiralColumn = spiralColumnMember(supports);

  if (!treads.length || !supports.length) {
    ctx.diagnostic("warning", "hardware-missing-source", "Hardware connection source objects are missing.", {
      objectRoles: ["connectionPattern"]
    });
  } else if (spiralColumn) {
    createSpiralTreadColumnBrackets(ctx, treads, spiralColumn, generatedIds);
    createSpiralColumnFixings(ctx, spiralColumn, generatedIds);
  } else {
    createTreadCleats(ctx, treads, supports, generatedIds);
    createFloorAndSlabFixings(ctx, supports, generatedIds);
  }
  if (posts.length) createPostBaseFixings(ctx, posts, generatedIds);

  ctx.objectPattern.create("connectionPattern", {
    type: "path-pattern",
    generatedObjectIds: [...generatedIds.plates, ...generatedIds.fasteners],
    transform: {
      kind: "standard-hardware",
      family: options.family || "standard-hardware",
      plateCount: generatedIds.plates.length,
      fastenerCount: generatedIds.fasteners.length
    },
    notes: "Generated hardware: bearing cleats, floor fixings, slab fixings, and post bases."
  });

  ctx.assembly.create("connectionAssembly", {
    type: "hardware-assembly",
    name: options.title || "Hardware connections",
    plateIds: generatedIds.plates,
    partIds: [...generatedIds.plates, ...generatedIds.fasteners],
    bim: { name: options.title || "Hardware connections" }
  });
  ctx.output("plateIds", generatedIds.plates);
  ctx.output("fastenerGroupIds", generatedIds.fasteners);
  ctx.output("featureIds", generatedIds.features);
  ctx.output("weldIds", generatedIds.welds);
}

export function buildMemberSpliceConnections(ctx, options = {}) {
  const members = supportMembers(ctx, ctx.input("components.supportComponentId"));
  const generatedIds = { plates: [], patterns: [], features: [], fasteners: [], welds: [], referencePlanes: [], trimJoints: [] };
  const thickness = requiredPositiveInput(ctx, "connections.splicePlateThickness", "Splice plate thickness");
  const width = requiredPositiveInput(ctx, "connections.splicePlateWidth", "Splice plate width");
  const height = requiredPositiveInput(ctx, "connections.splicePlateHeight", "Splice plate height");
  const cutGap = requiredPositiveInput(ctx, "connections.spliceCutGap", "Splice cut gap");
  const fastenerRef = requiredInput(ctx, "connections.spliceFastenerRef", "Splice fastener reference");
  const holeDiameter = requiredPositiveInput(ctx, "connections.spliceHoleDiameter", "Splice hole diameter");
  const boltLength = requiredPositiveInput(ctx, "connections.spliceBoltLength", "Splice bolt length");
  const gripLength = requiredPositiveInput(ctx, "connections.spliceGripLength", "Splice grip length");
  const splitFrames = requiredInput(ctx, "sections.splitFrames", "Transport split frames");
  if (!thickness || !width || !height || !cutGap || !fastenerRef || !holeDiameter || !boltLength || !gripLength || !Array.isArray(splitFrames)) return;
  if (!splitFrames.length) {
    ctx.error("member-splice-split-frame-missing", "Member splice generation requires at least one solved split frame.", {
      parameterPaths: ["sections.strategy", "sections.manualStations"],
      resolve: "Use manual-stations or a sectioning strategy that emits explicit split frames."
    });
    return;
  }
  let index = 0;
  for (const splitFrame of splitFrames) {
    for (const member of members) {
      const center = memberPointAtRouteStation(member, splitFrame);
      if (!center) continue;
      const role = registerRole(ctx, `memberSplice${index + 1}`, `_member_splice_${index + 1}`);
      index += 1;
      const frame = horizontalFrame(member);
      const plate = ctx.plate.create(role, {
        type: "splice-plate",
        thickness,
        width,
        height,
        material: "S355",
        center,
        normal: frame.lateral,
        localAxisY: frame.horizontal,
        localAxisZ: [0, 0, 1],
        display: { color: "#64748b" },
        placementIntent: {
          role: "member-splice-plate",
          family: options.family || "member-splice",
          station: splitFrame.station,
          splitFrameId: splitFrame.id,
          host: { memberId: member.id }
        },
        bim: { name: `Member splice ${index}` }
      });
      generatedIds.plates.push(plate.id);
      const splitTrim = createMemberSplitTrim(ctx, `memberSplice${index}`, member, center, frame, splitFrame, cutGap, { width, height });
      generatedIds.referencePlanes.push(...splitTrim.referencePlaneIds);
      generatedIds.trimJoints.push(splitTrim.trimJointId);
      const fasteners = createHoleFeatureAndFasteners(ctx, `memberSplice${index}`, plate, [
        [-width * 0.28, -height * 0.28],
        [width * 0.28, -height * 0.28],
        [-width * 0.28, height * 0.28],
        [width * 0.28, height * 0.28]
      ], {
        holeDiameter,
        fastenerRef,
        axis: plate.normal,
        length: boltLength,
        gripLength,
        participants: [plate.id, member.id],
        host: { memberId: member.id, splitFrameId: splitFrame.id },
        holeRole: "member-splice-bolt-holes",
        fastenerRole: "member-splice-bolts",
        parameterPaths: {
          fastenerRef: "connections.spliceFastenerRef",
          holeDiameter: "connections.spliceHoleDiameter",
          length: "connections.spliceBoltLength",
          gripLength: "connections.spliceGripLength"
        },
        name: `Member splice ${index} bolts`
      });
      addGeneratedFastenerIds(generatedIds, fasteners);
    }
  }
  if (!generatedIds.plates.length) {
    ctx.error("member-splice-no-member-at-split", "Solved split frames did not intersect any support member station range.", {
      parameterPaths: ["sections.manualStations"],
      resolve: "Move split stations inside support member station ranges or regenerate support outputs."
    });
    return;
  }

  ctx.objectPattern.create("connectionPattern", {
    type: "linear-pattern",
    generatedObjectIds: [...generatedIds.plates, ...generatedIds.fasteners, ...generatedIds.trimJoints],
    transform: { kind: "standard-connections", family: options.family || "member-splice", count: generatedIds.plates.length },
    notes: "Generated member splice plate, bolt set, and trim-based section break."
  });
  ctx.assembly.create("connectionAssembly", {
    type: "member-splice-assembly",
    name: options.title || "Member splice",
    plateIds: generatedIds.plates,
    partIds: [...generatedIds.plates, ...generatedIds.fasteners, ...generatedIds.trimJoints],
    bim: { name: options.title || "Member splice" }
  });
  ctx.output("splicePlateIds", generatedIds.plates);
  ctx.output("plateIds", generatedIds.plates);
  ctx.output("fastenerGroupIds", generatedIds.fasteners);
  ctx.output("featureIds", generatedIds.features);
  ctx.output("referencePlaneIds", generatedIds.referencePlanes);
  ctx.output("trimJointIds", generatedIds.trimJoints);
  ctx.output("splitFrames", splitFrames);
}
