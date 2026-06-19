function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`warehouse: ${label} must be an object`);
  return value;
}

function parameterGroup(parameters, key) {
  return clone(requiredObject(parameters[key], `stair preset parameters.${key}`));
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
      componentRef: "portal_frame_demo",
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
  const stairPreset = requiredObject(ctx.catalog?.smartComponents?.stair_system_straight_basic, "stair_system_straight_basic preset");
  const stairParameters = requiredObject(stairPreset.parameters, "stair_system_straight_basic parameters");
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
        ...parameterGroup(stairParameters, "levels"),
        ffl1: 0,
        ffl2: stairSteps * 180
      },
      geometry: {
        ...parameterGroup(stairParameters, "geometry"),
        maxStepHeight: 180,
        going: 260,
        width: 900
      },
      route: {
        ...parameterGroup(stairParameters, "route"),
        type: "straight"
      },
      supports: {
        ...parameterGroup(stairParameters, "supports"),
        profile: "DEMO_I_200X100X8X12"
      },
      treads: {
        ...parameterGroup(stairParameters, "treads"),
        family: "plate-tread",
        thickness: 8,
        depth: 240
      },
      railings: {
        ...parameterGroup(stairParameters, "railings"),
        family: "none"
      },
      connections: {
        ...parameterGroup(stairParameters, "connections"),
        family: "none"
      },
      sections: {
        ...parameterGroup(stairParameters, "sections"),
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
