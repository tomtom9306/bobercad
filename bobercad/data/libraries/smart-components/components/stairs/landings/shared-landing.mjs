function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function corner(frame, along, across) {
  return add(frame.origin, add(mul(frame.tangent || [1, 0, 0], along), mul(frame.lateral || [0, 1, 0], across)));
}

function cleanFootprint(footprint) {
  if (!Array.isArray(footprint) || footprint.length < 3) return null;
  const points = footprint
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [point[0], point[1]])
    .filter((point) => point.every((value) => typeof value === "number" && Number.isFinite(value)));
  return points.length >= 3 ? points : null;
}

function footprintBounds(footprint) {
  const ys = footprint.map((point) => point[0]);
  const zs = footprint.map((point) => point[1]);
  return {
    width: Math.max(...ys) - Math.min(...ys),
    length: Math.max(...zs) - Math.min(...zs)
  };
}

function footprintPoint(frame, point) {
  return corner(frame, point[1], point[0]);
}

function requiredInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "stair-landing-input-missing",
    message: `${label} is required to generate stair landings.`
  });
  if (value === undefined) return undefined;
  return value;
}

function requiredPositiveInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    ctx.error("stair-landing-input-invalid", `${label} must be a positive number.`, { parameterPaths: [path] });
    return undefined;
  }
  return value;
}

export function buildLandingSet(ctx, options = {}) {
  const landings = requiredInput(ctx, "layout.landings", "Solved landing frames") || [];
  const thickness = requiredPositiveInput(ctx, "landings.thickness", "Landing thickness");
  const material = requiredInput(ctx, "landings.material", "Landing material");
  const profile = requiredInput(ctx, "landings.frameProfile", "Landing frame profile");
  const plateIds = [];
  const memberIds = [];
  if (!Array.isArray(landings) || !thickness || !material || !profile) return;

  for (const [index, landing] of landings.entries()) {
    const role = `landing${index + 1}`;
    ctx.generatedRole(role, `_landing_${index + 1}`);
    const footprint = cleanFootprint(landing.footprint);
    const bounds = footprint ? footprintBounds(footprint) : null;
    const plate = ctx.plate.create(role, {
      type: "rectangular-plate",
      thickness,
      width: footprint ? bounds.width : landing.width,
      height: footprint ? bounds.length : landing.length,
      outline: footprint || undefined,
      material,
      center: landing.origin,
      normal: [0, 0, 1],
      localAxisY: landing.lateral || [0, 1, 0],
      localAxisZ: landing.tangent || [1, 0, 0],
      display: { color: options.color || "#7f8795" },
      placementIntent: {
        role: "stair-landing",
        family: options.family || "plate-landing",
        stationStart: landing.stationStart,
        stationEnd: landing.stationEnd,
        afterStep: landing.afterStep
      },
      bim: { name: `Landing ${index + 1}` }
    });
    plateIds.push(plate.id);

    if (options.framed) {
      const points = footprint
        ? footprint.map((point) => footprintPoint(landing, point))
        : [
            corner(landing, -landing.length / 2, -landing.width / 2),
            corner(landing, landing.length / 2, -landing.width / 2),
            corner(landing, landing.length / 2, landing.width / 2),
            corner(landing, -landing.length / 2, landing.width / 2)
          ];
      for (let edge = 0; edge < points.length; edge += 1) {
        const beamRole = `landingFrame${index + 1}_${edge + 1}`;
        ctx.generatedRole(beamRole, `_landing_frame_${index + 1}_${edge + 1}`);
        const beam = ctx.member.beam(beamRole, {
          start: points[edge],
          end: points[(edge + 1) % points.length],
          profile,
          memberType: "stair-landing-frame",
          source: "smart-component",
          display: { color: "#52677a" },
          bim: { name: `Landing ${index + 1} frame ${edge + 1}` }
        });
        memberIds.push(beam.id);
      }
    }
  }

  ctx.objectPattern.create("landingPattern", {
    type: "linear-pattern",
    generatedObjectIds: [...plateIds, ...memberIds],
    transform: { kind: "stair-landings", count: landings.length, family: options.family || "plate-landing" },
    notes: "Generated stair landing set."
  });

  ctx.assembly.create("landingAssembly", {
    type: "stair-landing-assembly",
    name: options.title || "Stair landings",
    memberIds,
    plateIds,
    partIds: [...memberIds, ...plateIds],
    bim: { name: options.title || "Stair landings" }
  });
  ctx.output("landingPlateIds", plateIds);
  ctx.output("landingFrameMemberIds", memberIds);
  ctx.output("landingIds", plateIds);
}
