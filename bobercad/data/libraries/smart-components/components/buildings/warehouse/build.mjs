function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function build(ctx) {
  const frameCount = ctx.param("building.frameCount");
  const frameSpacing = ctx.param("building.frameSpacing");
  const span = ctx.param("building.span");
  const eavesHeight = ctx.param("building.eavesHeight");
  const frameIds = [];

  for (let index = 0; index < frameCount; index += 1) {
    const role = `frame${index + 1}`;
    ctx.generatedRole(role, `_frame_${index + 1}`);
    const frame = ctx.component.create(role, {
      componentRef: "portal-frame",
      kind: "frame",
      inputs: {
        placement: {
          origin: [0, index * frameSpacing, 0]
        }
      },
      parameters: {
        geometry: {
          span,
          eavesHeight,
          apexRise: Math.round(span * 0.08)
        },
        members: {
          columnProfile: "DEMO_I_300X150X8X12",
          rafterProfile: "DEMO_I_200X100X8X12"
        }
      }
    });
    frameIds.push(frame.id);
  }

  const stairSteps = Math.max(4, Math.round(eavesHeight / 180));
  const stairParameters = clone(ctx.catalog?.smartComponents?.stair_system_straight_basic?.parameters || {});
  ctx.component.create("accessStair", {
    componentRef: "stair_system_straight_basic",
    kind: "stair",
    inputs: {
      placement: {
        origin: [-span / 2 - 1200, 0, 0]
      }
    },
    parameters: {
      ...stairParameters,
      levels: {
        ...(stairParameters.levels || {}),
        ffl1: 0,
        ffl2: stairSteps * 180
      },
      geometry: {
        ...(stairParameters.geometry || {}),
        maxStepHeight: 180,
        going: 260,
        width: 900
      },
      route: {
        ...(stairParameters.route || {}),
        type: "straight"
      },
      supports: {
        ...(stairParameters.supports || {}),
        profile: "DEMO_I_200X100X8X12"
      },
      treads: {
        ...(stairParameters.treads || {}),
        family: "plate-tread",
        thickness: 8,
        depth: 240
      },
      railings: {
        ...(stairParameters.railings || {}),
        family: "none"
      },
      connections: {
        ...(stairParameters.connections || {}),
        family: "none"
      },
      sections: {
        ...(stairParameters.sections || {}),
        strategy: "none"
      }
    }
  });

  ctx.objectPattern.create("framePattern", {
    type: "linear-pattern",
    generatedObjectIds: frameIds,
    transform: { kind: "frame-bay", count: frameCount, vector: [0, frameSpacing, 0] },
    notes: "Nested frame smart component pattern."
  });
}
