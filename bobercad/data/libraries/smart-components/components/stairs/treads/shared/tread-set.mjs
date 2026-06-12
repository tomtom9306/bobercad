function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function nonNegative(value, fallback = 0) {
  const number = finite(value, fallback);
  return number >= 0 ? number : fallback;
}

function treadValue(ctx, path) {
  const inputValue = ctx.input(path);
  if (inputValue !== undefined) return inputValue;
  return ctx.parameterValue(path, { required: false });
}

function requiredPositiveInput(ctx, path, label) {
  const value = treadValue(ctx, path);
  if (value === undefined) {
    ctx.error("stair-tread-input-missing", `${label} is required to generate stair treads.`, { parameterPaths: [path] });
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    ctx.error("stair-tread-input-invalid", `${label} must be a positive number.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredNonNegativeInput(ctx, path, label) {
  const value = treadValue(ctx, path);
  if (value === undefined) {
    ctx.error("stair-tread-input-missing", `${label} is required to generate stair treads.`, { parameterPaths: [path] });
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    ctx.error("stair-tread-input-invalid", `${label} must be zero or positive.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function optionalNonNegativeInput(ctx, path) {
  const value = treadValue(ctx, path);
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    ctx.error("stair-tread-input-invalid", `${path} must be zero or positive.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredInput(ctx, path, label) {
  const value = treadValue(ctx, path);
  if (value === undefined) {
    ctx.error("stair-tread-input-missing", `${label} is required to generate stair treads.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function treadRole(index) {
  return `tread${index + 1}`;
}

function woodRole(index) {
  return `woodTread${index + 1}`;
}

function riserRole(index) {
  return `riser${index + 1}`;
}

function frontPlateRole(index) {
  return `frontPlate${index + 1}`;
}

function registerRole(ctx, role, suffix) {
  return ctx.generatedRole(role, suffix);
}

function treadCapabilities(family) {
  return {
    trayLips: family === "pan-tread",
    timberBoard: family === "folded-tray-tread",
    risers: family !== "grating-tread"
  };
}

function clippedDepthForNoTreadZones(frame, depth, zones = [], allowances = {}) {
  const station = finite(frame.station, NaN);
  if (!Number.isFinite(station)) return depth;
  let clipped = depth;
  for (const zone of zones) {
    const start = finite(zone?.stationStart, NaN);
    const end = finite(zone?.stationEnd, NaN);
    const replacedGoing = finite(zone?.replacedTreadGoing, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (station >= start && station <= end) return 0;
    if (Number.isFinite(replacedGoing)) continue;
    if (station < start && station + clipped / 2 > start) {
      clipped = Math.min(clipped, Math.max(0, 2 * (start - station - (allowances.forward || 0))));
    }
    if (station > end && station - clipped / 2 < end) {
      clipped = Math.min(clipped, Math.max(0, 2 * (station - end - (allowances.backward || 0))));
    }
  }
  return clipped;
}

function cleanFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length < 3) return null;
  const points = footprint
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [finite(point[0], NaN), finite(point[1], NaN)])
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  return points.length >= 3 ? points : null;
}

function outlineBounds(outline) {
  const ys = outline.map((point) => point[0]);
  const zs = outline.map((point) => point[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minY,
    maxY,
    minZ,
    maxZ,
    width: maxY - minY,
    depth: maxZ - minZ
  };
}

export function buildTreadSet(ctx, options = {}) {
  const family = options.family || "plate-tread";
  const capabilities = treadCapabilities(family);
  const frames = ctx.requiredInput("layout.treads", {
    code: "stair-tread-layout-missing",
    message: "Solved tread layout is required to generate stair treads."
  }) || [];
  const defaultWidth = requiredPositiveInput(ctx, "geometry.width", "Stair width");
  const thickness = requiredPositiveInput(ctx, "treads.thickness", "Tread thickness");
  const defaultDepth = requiredPositiveInput(ctx, "treads.depth", "Tread depth");
  const defaultOverlap = optionalNonNegativeInput(ctx, "treads.overlap");
  const closedRisers = requiredInput(ctx, "treads.closedRisers", "Closed riser setting");
  const material = requiredInput(ctx, "treads.material", "Tread material");
  const color = options.color || "#6b7280";
  const woodThickness = capabilities.timberBoard ? requiredPositiveInput(ctx, "treads.woodThickness", "Timber thickness") : undefined;
  const woodOverhang = capabilities.timberBoard ? requiredNonNegativeInput(ctx, "treads.woodNosing", "Timber nosing") : undefined;
  const frontLip = capabilities.trayLips ? requiredPositiveInput(ctx, "treads.frontLip", "Front lip") : 0;
  const finish = requiredInput(ctx, "treads.finish", "Tread finish");
  const woodMaterial = capabilities.timberBoard ? requiredInput(ctx, "treads.woodMaterial", "Timber material") : undefined;
  const woodFinish = capabilities.timberBoard ? requiredInput(ctx, "treads.woodFinish", "Timber finish") : undefined;
  const rise = requiredPositiveInput(ctx, "geometry.rise", "Stair rise");
  if (!Array.isArray(frames) || !defaultWidth || !thickness || !defaultDepth || closedRisers === undefined || !material || !finish || !rise) return;
  if (capabilities.timberBoard && (!woodThickness || woodOverhang === undefined || !woodMaterial || !woodFinish)) return;
  if (capabilities.trayLips && !frontLip) return;
  const noTreadZones = Array.isArray(ctx.input("layout.noTreadZones")) ? ctx.input("layout.noTreadZones") : [];
  const noTreadZoneAllowance = {
    forward: capabilities.timberBoard ? woodOverhang : 0,
    backward: 0
  };
  const treadIds = [];
  const frontPlateIds = [];
  const woodIds = [];
  const riserIds = [];

  for (const frame of frames) {
    const index = frame.index ?? treadIds.length;
    const width = positive(frame.width, defaultWidth);
    const requestedDepth = positive(frame.depth ?? frame.length, defaultDepth);
    const overlap = nonNegative(frame.overlap, defaultOverlap ?? Math.max(0, requestedDepth - positive(frame.going, requestedDepth)));
    const surfaceKind = frame.surfaceKind || "tread";
    const footprint = cleanFootprint(frame.footprint);
    const footprintBounds = footprint ? outlineBounds(footprint) : null;
    const centerMeasuredFootprint = footprint && frame.footprintKind === "curved-strip";
    const depth = footprint
      ? centerMeasuredFootprint
        ? positive(frame.centerDepth ?? frame.going, requestedDepth)
        : Math.max(1, footprintBounds.depth)
      : clippedDepthForNoTreadZones(frame, requestedDepth, noTreadZones, noTreadZoneAllowance);
    if (depth <= 1) continue;
    const frameClosedRisers = frame.closedRisers ?? closedRisers;
    const surfaceRole = frame.surfaceRole || (capabilities.timberBoard ? "stair-timber-backing-plate" : "stair-steel-tray-tread");
    const namePrefix = frame.namePrefix || family;
    const role = registerRole(ctx, treadRole(index), `_tread_${index + 1}`);
    const normal = [0, 0, 1];
    const tangent = frame.tangent || [1, 0, 0];
    const lateral = frame.lateral || [0, 1, 0];
    const footprintWidth = footprint
      ? centerMeasuredFootprint
        ? positive(frame.centerWidth, width)
        : Math.max(1, footprintBounds.width)
      : width;
    const woodWidth = footprint ? footprintWidth : width;
    const woodDepth = footprint ? depth : Math.max(1, depth + (capabilities.timberBoard ? woodOverhang : 0));
    const woodPlanOffset = capabilities.timberBoard && !footprint ? woodOverhang / 2 : 0;
    const steelWidth = capabilities.timberBoard ? woodWidth : footprintWidth;
    const steelDepth = capabilities.timberBoard ? woodDepth : depth;
    const steelCenter = add(frame.origin, mul(tangent, woodPlanOffset));
    const tread = ctx.plate.create(role, {
      type: capabilities.timberBoard ? "timber-backing-plate" : options.plateType || family,
      thickness,
      width: steelWidth,
      height: steelDepth,
      outline: footprint || undefined,
      material,
      center: add(steelCenter, mul(normal, -thickness / 2)),
      normal,
      localAxisY: lateral,
      localAxisZ: tangent,
      display: { color, edgeColor: "#475569" },
      placementIntent: {
        role: surfaceRole,
        surfaceKind,
        family,
        index,
        station: frame.station,
        stationStart: frame.stationStart,
        stationEnd: frame.stationEnd,
        afterStep: frame.afterStep,
        landingId: frame.landingId,
        flightId: frame.flightId,
        footprintKind: frame.footprintKind,
        centerWidth: centerMeasuredFootprint ? footprintWidth : undefined,
        centerDepth: centerMeasuredFootprint ? depth : undefined,
        overlap,
        walkingSurface: frame.origin
      },
      fabrication: {
        family: capabilities.timberBoard ? "timber-backing-plate" : family,
        hostFamily: capabilities.timberBoard ? family : undefined,
        overlap,
        ...(centerMeasuredFootprint ? { centerMeasuredWidth: footprintWidth, centerMeasuredDepth: depth } : {}),
        ...(capabilities.trayLips && !footprint ? { frontLip } : {}),
        finish
      },
      bim: { name: `${namePrefix} ${index + 1}` }
    });
    treadIds.push(tread.id);

    if (capabilities.trayLips && !footprint) {
      const frontPlate = ctx.plate.create(registerRole(ctx, frontPlateRole(index), `_front_plate_${index + 1}`), {
        type: `${family}-front-plate`,
        thickness,
        width: steelWidth,
        height: frontLip,
        material,
        center: add(add(frame.origin, mul(tangent, depth / 2 - thickness / 2)), mul(normal, -frontLip / 2)),
        normal: tangent,
        localAxisY: lateral,
        localAxisZ: normal,
        display: { color, edgeColor: "#475569" },
        placementIntent: {
          role: "stair-tread-front-plate",
          family,
          surfaceKind,
          index,
          station: frame.station,
          stationStart: frame.stationStart,
          stationEnd: frame.stationEnd,
          afterStep: frame.afterStep,
          landingId: frame.landingId,
          flightId: frame.flightId,
          footprintKind: frame.footprintKind,
          centerWidth: centerMeasuredFootprint ? footprintWidth : undefined,
          centerDepth: centerMeasuredFootprint ? depth : undefined,
          overlap,
          host: { treadId: tread.id }
        },
        fabrication: {
          family: "tread-front-plate",
          hostFamily: family,
          frontLip,
          overlap,
          finish
        },
        bim: { name: `${namePrefix} front plate ${index + 1}` }
      });
      frontPlateIds.push(frontPlate.id);
    }

    if (capabilities.timberBoard) {
      const woodCenter = footprint
        ? add(frame.origin, mul(normal, woodThickness / 2 + 2))
        : add(add(frame.origin, mul(normal, woodThickness / 2 + 2)), mul(tangent, woodPlanOffset));
      const wood = ctx.plate.create(registerRole(ctx, woodRole(index), `_wood_tread_${index + 1}`), {
        type: "timber-tread-board",
        thickness: woodThickness,
        width: woodWidth,
        height: woodDepth,
        outline: footprint || undefined,
        material: woodMaterial,
        center: woodCenter,
        normal,
        localAxisY: lateral,
        localAxisZ: tangent,
        display: { color: "#b8864f", edgeColor: "#6b4423" },
        placementIntent: {
          role: "stair-wood-tread-board",
          family: "wood-on-folded-tray",
          surfaceKind,
          index,
          station: frame.station,
          stationStart: frame.stationStart,
          stationEnd: frame.stationEnd,
          afterStep: frame.afterStep,
          landingId: frame.landingId,
          flightId: frame.flightId,
          footprintKind: frame.footprintKind,
          centerWidth: centerMeasuredFootprint ? footprintWidth : undefined,
          centerDepth: centerMeasuredFootprint ? depth : undefined,
          overlap,
          host: { backingPlateId: tread.id }
        },
        fabrication: {
          family: "timber-cover-board",
          overlap,
          ...(centerMeasuredFootprint ? { centerMeasuredWidth: footprintWidth, centerMeasuredDepth: depth } : {}),
          finish: woodFinish
        },
        bim: { name: `Timber ${surfaceKind} board ${index + 1}` }
      });
      woodIds.push(wood.id);
    }

    if (capabilities.risers && frameClosedRisers && index > 0) {
      const riser = registerRole(ctx, riserRole(index), `_riser_${index + 1}`);
      const center = add(frame.origin, mul(tangent, -depth / 2));
      const plate = ctx.plate.create(riser, {
        type: "rectangular-plate",
        thickness,
        width,
        height: Math.max(1, rise),
        material,
        center,
        normal: tangent,
        localAxisY: lateral,
        localAxisZ: [0, 0, 1],
        display: { color },
        placementIntent: {
          role: "stair-riser",
          family: options.family || "plate-tread",
          surfaceKind,
          index,
          station: frame.station
        },
        bim: { name: `Riser ${index + 1}` }
      });
      riserIds.push(plate.id);
    }
  }

  ctx.objectPattern.create("treadPattern", {
    type: "linear-pattern",
    generatedObjectIds: [...treadIds, ...frontPlateIds, ...woodIds],
    transform: {
      kind: frames.some((frame) => frame.surfaceKind === "landing") ? "stair-tread-buildup-landings" : "stair-treads",
      family,
      capabilities,
      count: treadIds.length
    },
    notes: "Generated stair tread set from family-specific capabilities."
  });

  ctx.assembly.create("treadAssembly", {
    type: "stair-tread-assembly",
    name: `${options.title || "Tread"} set`,
    plateIds: [...treadIds, ...frontPlateIds, ...woodIds, ...riserIds],
    partIds: [...treadIds, ...frontPlateIds, ...woodIds, ...riserIds],
    bim: { name: `${options.title || "Tread"} set` }
  });
  ctx.output("treadPlateIds", treadIds);
  ctx.output("steelTreadPlateIds", treadIds);
  ctx.output("treadFrontPlateIds", frontPlateIds);
  ctx.output("woodTreadPlateIds", woodIds);
  ctx.output("riserPlateIds", riserIds);
  ctx.output("family", family);
}
