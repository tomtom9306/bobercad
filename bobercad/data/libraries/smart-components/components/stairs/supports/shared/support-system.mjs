import { centerlineEndpoints, rolledCenterline } from "../../../shared/geometry/rolled-centerline.mjs";

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function offsetPoint(point, lateral, offset) {
  return add(point, mul(lateral || [0, 1, 0], offset));
}

function requiredInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "stair-support-input-missing",
    message: `${label} is required to generate stair supports.`
  });
  if (value === undefined) return undefined;
  return value;
}

function requiredPositiveInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    ctx.error("stair-support-input-invalid", `${label} must be a positive number.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function requiredNonNegativeInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    ctx.error("stair-support-input-invalid", `${label} must be zero or positive.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

function segmentBeam(ctx, role, segment, offset, profile, memberType, name, color) {
  ctx.generatedRole(role, `_${role}`);
  return ctx.member.beam(role, {
    start: offsetPoint(segment.start, segment.startLateral, offset),
    end: offsetPoint(segment.end, segment.endLateral, offset),
    profile,
    memberType,
    source: "smart-component",
    display: { color },
    placementIntent: {
      role: memberType,
      stationStart: segment.startStation,
      stationEnd: segment.endStation,
      flightId: segment.flightId
    },
    fabrication: { family: memberType },
    bim: { name }
  });
}

function rolledBeam(ctx, role, centerline, profile, memberType, name, color, placement = {}) {
  ctx.generatedRole(role, `_${role}`);
  const { path, start, end } = centerlineEndpoints(centerline);
  return ctx.member.beam(role, {
    start,
    end,
    profile,
    memberType,
    centerline,
    source: "smart-component",
    display: { color },
    placementIntent: {
      role: memberType,
      stationStart: 0,
      stationEnd: path.length,
      pathType: centerline.type,
      rolled: true,
      ...placement
    },
      fabrication: {
        family: memberType,
        process: "rolled",
        centerlineType: centerline.type,
        centerlineRepresentation: centerline.representation,
        centerlineMath: centerline.math
      },
    bim: { name }
  });
}

export function buildSupportSystem(ctx, options = {}) {
  const segments = requiredInput(ctx, "layout.supports", "Solved support segments") || [];
  const width = requiredPositiveInput(ctx, "geometry.width", "Stair width");
  const profile = requiredInput(ctx, "supports.profile", "Support profile");
  const offset = requiredNonNegativeInput(ctx, "supports.sideOffset", "Support side offset");
  const routeType = requiredInput(ctx, "layout.routeType", "Route type");
  const rolledPath = ctx.input("layout.rolledPath");
  const color = options.color || "#3f657d";
  const memberIds = [];
  let centerColumnId = null;
  let rolledMemberCount = 0;
  if (!Array.isArray(segments) || !width || !profile || offset === undefined || !routeType) return;
  const requiresAnalyticRolledPath = ["winder", "curved", "spiral", "helical"].includes(routeType)
    && ["mono-stringer", "spiral-column", "twin-stringer"].includes(options.family);
  if (requiresAnalyticRolledPath && !rolledPath) {
    ctx.error("stair-support-analytic-centerline-missing", `${routeType} support requires an analytic rolled centerline.`, {
      parameterPaths: ["route.modules", "supports.family"],
      resolve: "Pass layout.rolledPath from the stair solver; do not generate segmented fallback members for curved stairs."
    });
    return;
  }

  if (options.family === "spiral-column") {
    ctx.generatedRole("centerColumn", "_center_column");
    const placementOrigin = requiredInput(ctx, "placement.origin", "Placement origin");
    const core = requiredInput(ctx, "layout.core", "Spiral core");
    const coreCenter = Array.isArray(core?.center) ? core.center : null;
    const height = requiredPositiveInput(ctx, "geometry.totalRise", "Total rise");
    const columnProfile = requiredInput(ctx, "supports.columnProfile", "Spiral column profile");
    if (!placementOrigin || !coreCenter || !height || !columnProfile) return;
    const origin = [coreCenter[0], coreCenter[1], placementOrigin[2] || coreCenter[2] || 0];
    const column = ctx.member.column("centerColumn", {
      start: origin,
      end: [origin[0], origin[1], origin[2] + height],
      profile: columnProfile,
      memberType: "stair-spiral-column",
      source: "smart-component",
      display: { color },
      bim: { name: "Spiral center column" }
    });
    memberIds.push(column.id);
    centerColumnId = column.id;
  }

  if (rolledPath && ["mono-stringer", "spiral-column", "twin-stringer"].includes(options.family)) {
    if (options.family === "mono-stringer" || options.family === "spiral-column") {
      const centerline = rolledCenterline(rolledPath, 0);
      if (centerline) {
        const member = rolledBeam(ctx, "monoStringer1", centerline, profile, "stair-mono-stringer", "Rolled mono stringer", color, {
          family: options.family
        });
        memberIds.push(member.id);
        rolledMemberCount += 1;
      }
    } else {
      const leftCenterline = rolledCenterline(rolledPath, -width / 2 - offset);
      const rightCenterline = rolledCenterline(rolledPath, width / 2 + offset);
      if (leftCenterline && rightCenterline) {
        const left = rolledBeam(ctx, "leftStringer1", leftCenterline, profile, "stair-stringer", "Left rolled stringer", color, {
          side: "left"
        });
        const right = rolledBeam(ctx, "rightStringer1", rightCenterline, profile, "stair-stringer", "Right rolled stringer", color, {
          side: "right"
        });
        memberIds.push(left.id, right.id);
        rolledMemberCount += 2;
      }
    }
  }

  if (rolledPath && rolledMemberCount > 0) {
    ctx.objectPattern.create("supportPattern", {
      type: "path-pattern",
      generatedObjectIds: memberIds,
      transform: {
        kind: "stair-support",
        family: options.family || "twin-stringer",
        pathType: rolledPath.type,
        rolled: true,
        count: memberIds.length
      },
      notes: "Generated support system with semantic rolled centerlines."
    });

    ctx.assembly.create("supportAssembly", {
      type: "stair-support-assembly",
      name: options.title || "Stair support",
      memberIds,
      partIds: memberIds,
      bim: { name: options.title || "Stair support" }
    });
    ctx.output("supportMemberIds", memberIds);
    ctx.output("stringerMemberIds", memberIds.filter((id) => id !== centerColumnId));
    ctx.output("rolledMemberIds", memberIds.filter((id) => id !== centerColumnId));
    ctx.output("centerColumnMemberId", centerColumnId);
    ctx.output("routeType", routeType);
    return;
  }

  if (requiresAnalyticRolledPath) {
    ctx.error("stair-support-analytic-centerline-invalid", `${routeType} support could not produce a valid analytic rolled centerline.`, {
      parameterPaths: ["route.modules", "supports.profile", "supports.sideOffset"],
      resolve: "Adjust radius/side offset/profile so the rolled centerline has a positive radius."
    });
    return;
  }

  for (const [index, segment] of segments.entries()) {
    if (options.family === "mono-stringer" || options.family === "spiral-column") {
      const role = `monoStringer${index + 1}`;
      const member = segmentBeam(ctx, role, segment, 0, profile, "stair-mono-stringer", `Mono stringer ${index + 1}`, color);
      memberIds.push(member.id);
      continue;
    }

    const leftRole = `leftStringer${index + 1}`;
    const rightRole = `rightStringer${index + 1}`;
    const left = segmentBeam(ctx, leftRole, segment, -width / 2 - offset, profile, "stair-stringer", `Left stringer ${index + 1}`, color);
    const right = segmentBeam(ctx, rightRole, segment, width / 2 + offset, profile, "stair-stringer", `Right stringer ${index + 1}`, color);
    memberIds.push(left.id, right.id);
  }

  ctx.objectPattern.create("supportPattern", {
    type: "path-pattern",
    generatedObjectIds: memberIds,
    transform: {
      kind: "stair-support",
      family: options.family || "twin-stringer",
      count: memberIds.length
    },
    notes: "Generated stair support system."
  });

  ctx.assembly.create("supportAssembly", {
    type: "stair-support-assembly",
    name: options.title || "Stair support",
    memberIds,
    partIds: memberIds,
    bim: { name: options.title || "Stair support" }
  });
  ctx.output("supportMemberIds", memberIds);
  ctx.output("stringerMemberIds", memberIds.filter((id) => id !== centerColumnId));
  ctx.output("rolledMemberIds", []);
  ctx.output("centerColumnMemberId", centerColumnId);
  ctx.output("routeType", routeType);
}
