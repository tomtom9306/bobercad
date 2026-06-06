import { centerlineEndpoints, rolledCenterline } from "../../../shared/geometry/rolled-centerline.mjs";

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

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function requiredPositiveInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "stair-railing-input-missing",
    message: `${label} is required to generate stair railings.`
  });
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    ctx.error("stair-railing-input-invalid", `${label} must be a positive number.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredNonNegativeInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "stair-railing-input-missing",
    message: `${label} is required to generate stair railings.`
  });
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    ctx.error("stair-railing-input-invalid", `${label} must be zero or positive.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "stair-railing-input-missing",
    message: `${label} is required to generate stair railings.`
  });
  if (value === undefined) return undefined;
  return value;
}

function registerRole(ctx, role, suffix) {
  return ctx.generatedRole(role, suffix);
}

function offset(frame, side, width, sideInset = 0) {
  const sign = side === "right" ? 1 : -1;
  const railOffset = Math.max(0, width / 2 - finite(sideInset, 0));
  return add(frame.origin, mul(frame.lateral || [0, 1, 0], sign * railOffset));
}

function samePlanPoint(a, b, tolerance = 1e-6) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

function samePoint(a, b, tolerance = 1e-6) {
  return samePlanPoint(a, b, tolerance) && Math.abs(a[2] - b[2]) <= tolerance;
}

function lineIntersection2(pointA, directionA, pointB, directionB) {
  const cross2 = directionA[0] * directionB[1] - directionA[1] * directionB[0];
  if (Math.abs(cross2) <= 1e-9) return null;
  const delta = [pointB[0] - pointA[0], pointB[1] - pointA[1]];
  const scale = (delta[0] * directionB[1] - delta[1] * directionB[0]) / cross2;
  return [pointA[0] + directionA[0] * scale, pointA[1] + directionA[1] * scale];
}

function sideRailingPath(stations, side, width, sideInset) {
  const path = [];
  for (const station of stations) {
    const point = offset(station, side, width, sideInset);
    const last = path[path.length - 1];
    if (!last) {
      path.push({ station, point });
      continue;
    }
    if (samePoint(last.point, point)) continue;
    if (samePlanPoint(last.station.origin, station.origin)) {
      const corner = lineIntersection2(last.point, last.station.tangent || [1, 0, 0], point, station.tangent || [1, 0, 0]);
      if (corner) {
        path[path.length - 1] = {
          station: {
            ...station,
            origin: [corner[0], corner[1], station.origin[2]],
            id: `${station.id || "rail_station"}_${side}_corner`
          },
          point: [corner[0], corner[1], point[2]]
        };
        continue;
      }
    }
    path.push({ station, point });
  }
  return path;
}

function sideNormal(station, side) {
  const sign = side === "right" ? 1 : -1;
  return norm(mul(station.lateral || [0, 1, 0], sign), side === "right" ? [0, 1, 0] : [0, -1, 0]);
}

function top(point, height) {
  return [point[0], point[1], point[2] + height];
}

function sideRailOffset(side, width, sideInset = 0) {
  const sign = side === "right" ? 1 : -1;
  return sign * Math.max(0, width / 2 - finite(sideInset, 0));
}

function rolledRailMember(ctx, role, centerline, profile, memberType, placementIntent, name) {
  const { start, end } = centerlineEndpoints(centerline);
  return ctx.member.beam(role, {
    start,
    end,
    centerline,
    profile,
    memberType,
    source: "smart-component",
    display: { color: "#334155", forceDetail: true },
    fabrication: {
      process: "rolled",
      centerlineMath: centerline.math
    },
    placementIntent: {
      ...placementIntent,
      pathType: centerline.type,
      centerlineRepresentation: centerline.representation
    },
    bim: { name }
  });
}

function sides(input) {
  if (input === "left") return ["left"];
  if (input === "right") return ["right"];
  return ["left", "right"];
}

function panelBoltPositions(span, height) {
  const x = Math.max(70, Math.min(140, span * 0.18));
  const z = Math.max(90, Math.min(160, height * 0.24));
  return [
    [-span / 2 + x, -height / 2 + z],
    [span / 2 - x, -height / 2 + z],
    [-span / 2 + x, height / 2 - z],
    [span / 2 - x, height / 2 - z]
  ];
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

function createPanelFixings(ctx, side, index, panel, postIds) {
  const patternRole = registerRole(ctx, `${side}PanelFixingPattern${index + 1}`, `_${side}_panel_fixing_pattern_${index + 1}`);
  const groupRole = registerRole(ctx, `${side}PanelFixings${index + 1}`, `_${side}_panel_fixings_${index + 1}`);
  const holeDiameter = requiredPositiveInput(ctx, "railings.panelFixingHoleDiameter", "Panel fixing hole diameter");
  const fastenerRef = requiredInput(ctx, "railings.panelFastenerRef", "Panel fastener reference");
  const length = requiredPositiveInput(ctx, "railings.panelFastenerLength", "Panel fastener length");
  if (!holeDiameter || !fastenerRef || !length) return null;
  const fasteners = ctx.fastener.patternedGroup(groupRole, {
    patternRole,
    holeDiameter,
    holeType: "round",
    positions: panelBoltPositions(panel.width, panel.height),
    fastenerRef,
    participants: [panel.id, ...postIds.filter(Boolean)],
    orientation: { axis: panel.normal, headSide: side },
    assembly: {
      length,
      gripLength: panel.thickness + 20,
      washers: { head: true, nut: true }
    },
    display: { color: "#1f2937", headColor: "#1f2937" },
    placementIntent: {
      role: "railing-panel-bolted-clamps",
      side,
      spanIndex: index,
      host: { panelId: panel.id, postIds }
    },
    parameterPaths: {
      fastenerRef: "railings.panelFastenerRef",
      holeDiameter: "railings.panelFixingHoleDiameter",
      length: "railings.panelFastenerLength"
    },
    bim: { name: `${side} railing panel ${index + 1} fixings` }
  });
  return fasteners.fastenerId;
}

function createWallBracketFixings(ctx, side, index, plate, normal) {
  const patternRole = registerRole(ctx, `${side}WallBracketFixingPattern${index + 1}`, `_${side}_wall_bracket_fixing_pattern_${index + 1}`);
  const featureRole = registerRole(ctx, `${side}WallBracketFixingHoles${index + 1}`, `_${side}_wall_bracket_fixing_holes_${index + 1}`);
  const groupRole = registerRole(ctx, `${side}WallBracketFixings${index + 1}`, `_${side}_wall_bracket_fixings_${index + 1}`);
  const holeDiameter = requiredPositiveInput(ctx, "railings.wallBracketHoleDiameter", "Wall bracket hole diameter");
  const fastenerRef = requiredInput(ctx, "railings.wallBracketFastenerRef", "Wall bracket fastener reference");
  const length = requiredPositiveInput(ctx, "railings.wallBracketFastenerLength", "Wall bracket fastener length");
  if (!holeDiameter || !fastenerRef || !length) return null;
  const fasteners = ctx.fastener.patternedGroup(groupRole, {
    patternRole,
    feature: {
      role: featureRole,
      ownerId: plate.id,
      depth: plate.thickness + 2,
      reference: plateFaceReference(plate),
      placementIntent: {
        role: "wall-handrail-bracket-holes",
        side,
        stationIndex: index
      }
    },
    holeDiameter,
    holeType: "round",
    positions: [
      [0, -42],
      [0, 42]
    ],
    fastenerRef,
    participants: [plate.id],
    orientation: { axis: normal, headSide: side },
    assembly: {
      length,
      gripLength: plate.thickness + 20,
      washers: { head: true, nut: false }
    },
    display: { color: "#facc15", headColor: "#facc15" },
    placementIntent: {
      role: "wall-handrail-bracket-anchors",
      side,
      stationIndex: index,
      host: { plateId: plate.id }
    },
    parameterPaths: {
      fastenerRef: "railings.wallBracketFastenerRef",
      holeDiameter: "railings.wallBracketHoleDiameter",
      length: "railings.wallBracketFastenerLength"
    },
    bim: { name: `${side} wall handrail bracket ${index + 1} anchors` }
  });
  return fasteners.fastenerId;
}

function createWallHandrailBracket(ctx, side, index, station, railPoint, profile) {
  const normal = sideNormal(station, side);
  const projection = requiredPositiveInput(ctx, "railings.wallBracketProjection", "Wall bracket projection");
  const drop = requiredPositiveInput(ctx, "railings.wallBracketDrop", "Wall bracket drop");
  const plateThickness = requiredPositiveInput(ctx, "railings.wallBracketPlateThickness", "Wall bracket plate thickness");
  const plateWidth = requiredPositiveInput(ctx, "railings.wallBracketPlateWidth", "Wall bracket plate width");
  const plateHeight = requiredPositiveInput(ctx, "railings.wallBracketPlateHeight", "Wall bracket plate height");
  const plateMaterial = requiredInput(ctx, "railings.wallBracketPlateMaterial", "Wall bracket plate material");
  if (!projection || !drop || !plateThickness || !plateWidth || !plateHeight || !plateMaterial) return { memberIds: [], plateId: null, fastenerId: null };
  const bracketPoint = add(railPoint, [0, 0, -drop]);
  const wallPoint = add(bracketPoint, mul(normal, projection));
  const dropRole = registerRole(ctx, `${side}WallBracketDrop${index + 1}`, `_${side}_wall_bracket_drop_${index + 1}`);
  const armRole = registerRole(ctx, `${side}WallBracketArm${index + 1}`, `_${side}_wall_bracket_arm_${index + 1}`);
  const plateRole = registerRole(ctx, `${side}WallBracketPlate${index + 1}`, `_${side}_wall_bracket_plate_${index + 1}`);
  const dropMember = ctx.member.beam(dropRole, {
    start: railPoint,
    end: bracketPoint,
    profile,
    memberType: "stair-wall-handrail-bracket",
    source: "smart-component",
    display: { color: "#334155" },
    placementIntent: { role: "wall-handrail-bracket-drop", side, station: station.station },
    bim: { name: `${side} wall handrail bracket drop ${index + 1}` }
  });
  const armMember = ctx.member.beam(armRole, {
    start: bracketPoint,
    end: wallPoint,
    profile,
    memberType: "stair-wall-handrail-bracket",
    source: "smart-component",
    display: { color: "#334155" },
    placementIntent: { role: "wall-handrail-bracket-arm", side, station: station.station },
    bim: { name: `${side} wall handrail bracket arm ${index + 1}` }
  });
  const plate = ctx.plate.create(plateRole, {
    type: "wall-handrail-bracket-plate",
    thickness: plateThickness,
    width: plateWidth,
    height: plateHeight,
    material: plateMaterial,
    center: wallPoint,
    normal,
    localAxisY: norm(station.tangent || [1, 0, 0]),
    localAxisZ: [0, 0, 1],
    display: { color: "#cbd5e1", opacity: 0.92 },
    placementIntent: { role: "wall-handrail-bracket-plate", side, station: station.station },
    bim: { name: `${side} wall handrail bracket plate ${index + 1}` }
  });
  return {
    memberIds: [dropMember.id, armMember.id],
    plateId: plate.id,
    fastenerId: createWallBracketFixings(ctx, side, index, plate, normal)
  };
}

function createWallMountingSurfaces(ctx, side, stations, basePoints, topPoints) {
  const projection = requiredPositiveInput(ctx, "railings.wallBracketProjection", "Wall bracket projection");
  const wallThickness = requiredPositiveInput(ctx, "railings.wallSurfaceThickness", "Wall surface thickness");
  const wallMaterial = requiredInput(ctx, "railings.wallSurfaceMaterial", "Wall surface material");
  if (!projection || !wallThickness || !wallMaterial) return [];
  const minZ = Math.min(...basePoints.map((point) => point[2]), 0) - 80;
  const maxZ = Math.max(...topPoints.map((point) => point[2]), 0) + 220;
  const surfaceHeight = Math.max(600, maxZ - minZ);
  const surfaceIds = [];
  for (let index = 0; index < basePoints.length - 1; index += 1) {
    const normal = sideNormal(stations[index], side);
    const start = add(basePoints[index], mul(normal, projection));
    const end = add(basePoints[index + 1], mul(sideNormal(stations[index + 1], side), projection));
    const startPlan = [start[0], start[1], 0];
    const endPlan = [end[0], end[1], 0];
    const spanVector = sub(endPlan, startPlan);
    const span = length(spanVector);
    if (span < 1) continue;
    const role = registerRole(ctx, `${side}WallMountingSurface${index + 1}`, `_${side}_wall_mounting_surface_${index + 1}`);
    const surface = ctx.plate.create(role, {
      type: "wall-handrail-mounting-surface",
      thickness: wallThickness,
      width: span,
      height: surfaceHeight,
      material: wallMaterial,
      center: [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        minZ + surfaceHeight / 2
      ],
      normal,
      localAxisY: norm(spanVector, stations[index].tangent || [1, 0, 0]),
      localAxisZ: [0, 0, 1],
      display: { color: "#cbd5e1", transparent: true, opacity: 0.24, edgeColor: "#94a3b8" },
      placementIntent: { role: "wall-handrail-mounting-surface", side, stationStart: stations[index].station, stationEnd: stations[index + 1].station },
      bim: { name: `${side} wall handrail mounting surface ${index + 1}` }
    });
    surfaceIds.push(surface.id);
  }
  return surfaceIds;
}

function midRailHeights(height) {
  return [
    Math.max(320, height * 0.42),
    Math.max(620, height * 0.68)
  ].filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 80);
}

function planDirectionChanged(a, b, tolerance = 1e-6) {
  const directionA = norm([a[0], a[1], 0]);
  const directionB = norm([b[0], b[1], 0]);
  return Math.abs(directionA[0] * directionB[0] + directionA[1] * directionB[1]) < 1 - tolerance;
}

function directionChanged(a, b, tolerance = 1e-6) {
  const directionA = norm(a);
  const directionB = norm(b);
  return Math.abs(directionA[0] * directionB[0] + directionA[1] * directionB[1] + directionA[2] * directionB[2]) < 1 - tolerance;
}

function railRunRanges(points) {
  if (points.length < 2) return [];
  const ranges = [];
  let startIndex = 0;
  let previousVector = sub(points[1], points[0]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const nextVector = sub(points[index + 1], points[index]);
    if (directionChanged(previousVector, nextVector)) {
      ranges.push({ startIndex, endIndex: index });
      startIndex = index;
    }
    previousVector = nextVector;
  }
  ranges.push({ startIndex, endIndex: points.length - 1 });
  return ranges;
}

function createCornerTrim(ctx, rolePrefix, side, index, previousMemberId, nextMemberId, previousVector, nextVector, station, trimIds) {
  if (!previousMemberId || !nextMemberId) return;
  if (!directionChanged(previousVector, nextVector)) return;
  const suffixBase = rolePrefix.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const role = registerRole(ctx, `${rolePrefix}${index + 1}`, `_${suffixBase}_${index + 1}`);
  const trim = ctx.trim.cornerTrim(role, {
    memberIds: [previousMemberId, nextMemberId],
    memberAEnd: "end",
    memberBEnd: "start",
    operationType: "end-miter",
    fabrication: { operation: "railing-corner-miter" },
    placementIntent: {
      role: "railing-corner-trim",
      side,
      station: station?.station,
      host: { previousMemberId, nextMemberId }
    },
    bim: { name: `${side} railing corner trim ${index + 1}` }
  });
  trimIds.push(trim.id);
}

function createRailPostTrim(ctx, rolePrefix, side, spanIndex, railId, postId, railEnd, station, trimIds) {
  if (!railId || !postId) return;
  const suffixBase = rolePrefix.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const role = registerRole(ctx, `${rolePrefix}${spanIndex + 1}${railEnd === "start" ? "Start" : "End"}`, `_${suffixBase}_${spanIndex + 1}_${railEnd}`);
  const trim = ctx.trim.cornerTrim(role, {
    memberIds: [railId, postId],
    memberAEnd: railEnd,
    operationType: "end-butt-1",
    fabrication: { operation: "railing-member-to-post-trim" },
    placementIntent: {
      role: "railing-post-trim",
      side,
      station: station?.station,
      host: { railId, postId, railEnd }
    },
    bim: { name: `${side} railing ${railEnd} post trim ${spanIndex + 1}` }
  });
  trimIds.push(trim.id);
}

function createHandrailPostMiter(ctx, rolePrefix, side, spanIndex, railId, postId, railEnd, trimIds) {
  if (!railId || !postId) return;
  const suffixBase = rolePrefix.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const role = registerRole(ctx, `${rolePrefix}${spanIndex + 1}${railEnd === "start" ? "Start" : "End"}`, `_${suffixBase}_${spanIndex + 1}_${railEnd}`);
  const trim = ctx.trim.cornerTrim(role, {
    memberIds: [railId, postId],
    memberAEnd: railEnd,
    memberBEnd: "end",
    operationType: "end-miter",
    miterMode: "profile-balanced",
    fabrication: { operation: "ordered-corner-trim" },
    bim: { name: `${side} handrail ${railEnd} post miter ${spanIndex + 1}` }
  });
  trimIds.push(trim.id);
}

export function buildRailingSystem(ctx, options = {}) {
  const stations = ctx.requiredInput("layout.railStations", {
    code: "stair-railing-layout-missing",
    message: "Solved railing stations are required to generate stair railings."
  }) || [];
  const width = requiredPositiveInput(ctx, "geometry.width", "Stair width");
  const height = requiredPositiveInput(ctx, "railings.height", "Railing height");
  const sideSetting = requiredInput(ctx, "railings.sides", "Railing side setting");
  const sideList = sides(sideSetting);
  const sideInset = requiredNonNegativeInput(ctx, "railings.sideInset", "Railing side inset");
  const postProfile = requiredInput(ctx, "railings.postProfile", "Post profile");
  const railProfile = requiredInput(ctx, "railings.railProfile", "Rail profile");
  const requestedInfill = requiredInput(ctx, "railings.infill", "Railing infill");
  if (!Array.isArray(stations) || !width || !height || !sideSetting || sideInset === undefined || !postProfile || !railProfile || !requestedInfill) return;
  const infill = options.family === "glass-panel" ? "glass-panel" : requestedInfill;
  const routeType = ctx.input("layout.routeType");
  const rolledPath = ctx.input("layout.rolledPath");
  const useRolledRails = options.family !== "wall-handrail"
    && rolledPath
    && ["winder", "curved", "spiral", "helical"].includes(routeType);
  const memberIds = [];
  const plateIds = [];
  const fastenerIds = [];
  const trimIds = [];
  const postMemberIds = [];
  const handrailMemberIds = [];
  const midRailMemberIds = [];

  for (const side of sideList) {
    const sidePath = sideRailingPath(stations, side, width, sideInset);
    const pathStations = sidePath.map((entry) => entry.station);
    const basePoints = sidePath.map((entry) => entry.point);
    const topPoints = basePoints.map((point) => top(point, height));
    const postIds = [];
    const handrailIds = [];
    const midRailIdsByHeight = new Map();

    if (options.family !== "wall-handrail") {
      for (const [index, point] of basePoints.entries()) {
        const role = registerRole(ctx, `${side}Post${index + 1}`, `_${side}_post_${index + 1}`);
        const post = ctx.member.column(role, {
          start: point,
          end: topPoints[index],
          profile: postProfile,
          memberType: "stair-rail-post",
          source: "smart-component",
          display: { color: "#334155" },
          placementIntent: {
            role: "railing-post",
            side,
            station: pathStations[index].station,
            topReference: "handrail-axis"
          },
          bim: { name: `${side} rail post ${index + 1}` }
        });
        memberIds.push(post.id);
        postIds.push(post.id);
        postMemberIds.push(post.id);
      }
    } else {
      plateIds.push(...createWallMountingSurfaces(ctx, side, pathStations, basePoints, topPoints));
      for (const [index, point] of topPoints.entries()) {
        const bracket = createWallHandrailBracket(ctx, side, index, pathStations[index], point, postProfile);
        memberIds.push(...bracket.memberIds);
        if (bracket.plateId) plateIds.push(bracket.plateId);
        if (bracket.fastenerId) fastenerIds.push(bracket.fastenerId);
      }
    }

    const handrailRuns = [];
    if (useRolledRails) {
      const centerline = rolledCenterline(rolledPath, sideRailOffset(side, width, sideInset), { verticalOffset: height });
      if (!centerline) {
        ctx.error("stair-railing-analytic-centerline-invalid", `${routeType} railing could not produce a valid analytic centerline.`, {
          parameterPaths: ["route.modules", "railings.sideInset"],
          resolve: "Adjust route radius, stair width, or railing side inset so the rail centerline has a positive radius."
        });
      } else {
        const role = registerRole(ctx, `${side}Handrail1`, `_${side}_handrail_1`);
        const rail = rolledRailMember(ctx, role, centerline, railProfile, "stair-handrail", {
          role: "handrail",
          side,
          spanIndex: 0,
          runIndex: 0,
          stationStart: pathStations[0]?.station,
          stationEnd: pathStations[pathStations.length - 1]?.station
        }, `${side} rolled handrail`);
        memberIds.push(rail.id);
        handrailMemberIds.push(rail.id);
        handrailRuns.push({ startIndex: 0, endIndex: topPoints.length - 1, id: rail.id });
        createHandrailPostMiter(ctx, `${side}HandrailPostMiter`, side, 0, rail.id, postIds[0], "start", trimIds);
        createHandrailPostMiter(ctx, `${side}HandrailPostMiter`, side, topPoints.length - 2, rail.id, postIds[topPoints.length - 1], "end", trimIds);
      }
    } else {
      for (const [runIndex, range] of railRunRanges(topPoints).entries()) {
        if (length(sub(topPoints[range.endIndex], topPoints[range.startIndex])) < 1) continue;
        const role = registerRole(ctx, `${side}Handrail${runIndex + 1}`, `_${side}_handrail_${runIndex + 1}`);
        const rail = ctx.member.beam(role, {
          start: topPoints[range.startIndex],
          end: topPoints[range.endIndex],
          profile: railProfile,
          memberType: options.family === "wall-handrail" ? "stair-wall-handrail" : "stair-handrail",
          source: "smart-component",
          display: { color: "#334155", forceDetail: true },
          placementIntent: {
            role: "handrail",
            side,
            spanIndex: range.startIndex,
            runIndex,
            stationStart: pathStations[range.startIndex]?.station,
            stationEnd: pathStations[range.endIndex]?.station
          },
          bim: { name: `${side} handrail ${runIndex + 1}` }
        });
      memberIds.push(rail.id);
      handrailMemberIds.push(rail.id);
      handrailRuns.push({ ...range, id: rail.id });
      if (options.family !== "wall-handrail") {
        if (range.startIndex === 0) {
          createHandrailPostMiter(ctx, `${side}HandrailPostMiter`, side, range.startIndex, rail.id, postIds[range.startIndex], "start", trimIds);
        }
        if (range.endIndex === topPoints.length - 1) {
          createHandrailPostMiter(ctx, `${side}HandrailPostMiter`, side, range.endIndex - 1, rail.id, postIds[range.endIndex], "end", trimIds);
        }
      }
    }
    }

    if (infill === "mid-rails" && options.family !== "wall-handrail") {
      for (const [railIndex, railHeight] of midRailHeights(height).entries()) {
        const railPoints = basePoints.map((point) => top(point, railHeight));
        const midRailRuns = [];
        if (useRolledRails) {
          const centerline = rolledCenterline(rolledPath, sideRailOffset(side, width, sideInset), { verticalOffset: railHeight });
          if (!centerline) continue;
          const midRole = registerRole(ctx, `${side}MidRail${railIndex + 1}_1`, `_${side}_midrail_${railIndex + 1}_1`);
          const midRail = rolledRailMember(ctx, midRole, centerline, railProfile, "stair-guardrail", {
            role: "guardrail-infill-rail",
            side,
            railIndex,
            spanIndex: 0,
            runIndex: 0,
            stationStart: pathStations[0]?.station,
            stationEnd: pathStations[pathStations.length - 1]?.station
          }, `${side} rolled guard rail ${railIndex + 1}`);
          memberIds.push(midRail.id);
          midRailMemberIds.push(midRail.id);
          midRailRuns.push({ startIndex: 0, endIndex: railPoints.length - 1, id: midRail.id, points: railPoints });
          createRailPostTrim(ctx, `${side}MidRail${railIndex + 1}PostTrim`, side, 0, midRail.id, postIds[0], "start", pathStations[0], trimIds);
          createRailPostTrim(ctx, `${side}MidRail${railIndex + 1}PostTrim`, side, railPoints.length - 2, midRail.id, postIds[railPoints.length - 1], "end", pathStations[railPoints.length - 1], trimIds);
        } else {
          for (const [runIndex, range] of railRunRanges(railPoints).entries()) {
            const midRole = registerRole(ctx, `${side}MidRail${railIndex + 1}_${runIndex + 1}`, `_${side}_midrail_${railIndex + 1}_${runIndex + 1}`);
            const midRail = ctx.member.beam(midRole, {
              start: railPoints[range.startIndex],
              end: railPoints[range.endIndex],
              profile: railProfile,
              memberType: "stair-guardrail",
              source: "smart-component",
              display: { color: "#334155", forceDetail: true },
              placementIntent: {
              role: "guardrail-infill-rail",
              side,
              railIndex,
              spanIndex: range.startIndex,
              runIndex,
              stationStart: pathStations[range.startIndex]?.station,
              stationEnd: pathStations[range.endIndex]?.station
            },
              bim: { name: `${side} guard rail ${railIndex + 1}.${runIndex + 1}` }
            });
            memberIds.push(midRail.id);
            midRailMemberIds.push(midRail.id);
            midRailRuns.push({ ...range, id: midRail.id, points: railPoints });
            if (range.startIndex === 0) {
              createRailPostTrim(ctx, `${side}MidRail${railIndex + 1}PostTrim`, side, range.startIndex, midRail.id, postIds[range.startIndex], "start", pathStations[range.startIndex], trimIds);
            }
            if (range.endIndex === railPoints.length - 1) {
              createRailPostTrim(ctx, `${side}MidRail${railIndex + 1}PostTrim`, side, range.endIndex - 1, midRail.id, postIds[range.endIndex], "end", pathStations[range.endIndex], trimIds);
            }
          }
        }
        midRailIdsByHeight.set(railIndex, midRailRuns);
      }
    } else if (infill !== "none" && options.family !== "wall-handrail") {
      const panelThickness = requiredPositiveInput(ctx, "railings.panelThickness", "Panel thickness");
      const panelMaterial = requiredInput(ctx, "railings.panelMaterial", "Panel material");
      if (!panelThickness || !panelMaterial) continue;
      for (let index = 0; index < basePoints.length - 1; index += 1) {
        const spanVector = sub(basePoints[index + 1], basePoints[index]);
        const planSpanVector = [spanVector[0], spanVector[1], 0];
        const span = Math.max(1, length(planSpanVector));
        const panelHeight = Math.max(450, height - 230);
        const normal = sideNormal(pathStations[index], side);
        const axisY = norm(planSpanVector, pathStations[index].tangent || [1, 0, 0]);
        const axisZ = [0, 0, 1];
        const mid = mul(add(basePoints[index], basePoints[index + 1]), 0.5);
        const panelRole = registerRole(ctx, `${side}InfillPanel${index + 1}`, `_${side}_infill_panel_${index + 1}`);
        const panel = ctx.plate.create(panelRole, {
          type: infill === "perforated-panel" ? "perforated-railing-panel" : "glass-panel",
          thickness: panelThickness,
          width: span,
          height: panelHeight,
          material: panelMaterial,
          center: add(mid, mul([0, 0, 1], 120 + panelHeight / 2)),
          normal,
          localAxisY: axisY,
          localAxisZ: axisZ,
          display: infill === "perforated-panel"
            ? { color: "#64748b", opacity: 0.82 }
            : { color: "#9cc7d6", transparent: true, opacity: 0.42, edgeColor: "#5b8798" },
          placementIntent: { role: "railing-infill-panel", side, spanIndex: index },
          bim: { name: `${side} railing infill panel ${index + 1}` }
        });
        plateIds.push(panel.id);
        const fixingId = createPanelFixings(ctx, side, index, panel, [postIds[index], postIds[index + 1]]);
        if (fixingId) fastenerIds.push(fixingId);
      }
    }

    for (let index = 1; index < handrailRuns.length; index += 1) {
      const previous = handrailRuns[index - 1];
      const next = handrailRuns[index];
      createCornerTrim(ctx, `${side}HandrailCornerTrim`, side, next.startIndex, previous.id, next.id, sub(topPoints[previous.endIndex], topPoints[previous.startIndex]), sub(topPoints[next.endIndex], topPoints[next.startIndex]), pathStations[next.startIndex], trimIds);
    }
    for (const [railIndex, runs] of midRailIdsByHeight.entries()) {
      for (let index = 1; index < runs.length; index += 1) {
        const previous = runs[index - 1];
        const next = runs[index];
        createCornerTrim(ctx, `${side}MidRail${railIndex + 1}CornerTrim`, side, next.startIndex, previous.id, next.id, sub(previous.points[previous.endIndex], previous.points[previous.startIndex]), sub(next.points[next.endIndex], next.points[next.startIndex]), pathStations[next.startIndex], trimIds);
      }
    }
  }

  ctx.objectPattern.create("railingPattern", {
    type: "path-pattern",
    generatedObjectIds: [...memberIds, ...plateIds, ...fastenerIds, ...trimIds],
    transform: {
      kind: "stair-railing",
      family: options.family || "post-and-rail",
      infill,
      sides: sideList
    },
    notes: "Generated bolted stair railing with filled panels."
  });

  ctx.assembly.create("railingAssembly", {
    type: "stair-railing-assembly",
    name: options.title || "Stair railing",
    memberIds,
    plateIds,
    partIds: [...memberIds, ...plateIds, ...fastenerIds],
    bim: { name: options.title || "Stair railing" }
  });
  ctx.output("memberIds", memberIds);
  ctx.output("postMemberIds", postMemberIds);
  ctx.output("handrailMemberIds", handrailMemberIds);
  ctx.output("midRailMemberIds", midRailMemberIds);
  ctx.output("plateIds", plateIds);
  ctx.output("fastenerGroupIds", fastenerIds);
  ctx.output("trimJointIds", trimIds);
  ctx.output("family", options.family || "post-and-rail");
}
