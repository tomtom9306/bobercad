import { solveStairSystem } from "./solver.mjs?v=landing-platform-footprints-1";

function stairParameters(ctx) {
  const p = (path) => ctx.parameterValue(path);
  return {
    route: {
      modules: p("route.modules")
    },
    levels: {
      ffl1: p("levels.ffl1"),
      ffl2: p("levels.ffl2"),
      slab1ToFfl1: p("levels.slab1ToFfl1"),
      slab2ToFfl2: p("levels.slab2ToFfl2")
    },
    geometry: {
      maxStepHeight: p("geometry.maxStepHeight"),
      going: p("geometry.going"),
      width: p("geometry.width")
    },
    landings: {
      family: p("landings.family"),
      length: p("landings.length"),
      entryExtensionLength: p("landings.entryExtensionLength"),
      exitExtensionLength: p("landings.exitExtensionLength"),
      thickness: p("landings.thickness"),
      material: p("landings.material"),
      frameProfile: p("landings.frameProfile")
    },
    treads: {
      family: p("treads.family"),
      thickness: p("treads.thickness"),
      depth: p("treads.depth"),
      material: p("treads.material"),
      frontLip: p("treads.frontLip"),
      woodThickness: p("treads.woodThickness"),
      woodInset: p("treads.woodInset"),
      woodNosing: p("treads.woodNosing"),
      woodMaterial: p("treads.woodMaterial"),
      woodFinish: p("treads.woodFinish"),
      closedRisers: p("treads.closedRisers"),
      finish: p("treads.finish")
    },
    supports: {
      family: p("supports.family"),
      profile: p("supports.profile"),
      columnProfile: p("supports.columnProfile"),
      sideOffset: p("supports.sideOffset"),
      maxSegmentLength: p("supports.maxSegmentLength")
    },
    railings: {
      family: p("railings.family"),
      sides: p("railings.sides"),
      height: p("railings.height"),
      postSpacing: p("railings.postSpacing"),
      curvePostSpacing: p("railings.curvePostSpacing"),
      sideInset: p("railings.sideInset"),
      infill: p("railings.infill"),
      panelThickness: p("railings.panelThickness"),
      panelMaterial: p("railings.panelMaterial"),
      panelFastenerRef: p("railings.panelFastenerRef"),
      panelFixingHoleDiameter: p("railings.panelFixingHoleDiameter"),
      panelFastenerLength: p("railings.panelFastenerLength"),
      wallBracketHoleDiameter: p("railings.wallBracketHoleDiameter"),
      wallBracketFastenerRef: p("railings.wallBracketFastenerRef"),
      wallBracketFastenerLength: p("railings.wallBracketFastenerLength"),
      wallBracketProjection: p("railings.wallBracketProjection"),
      wallBracketDrop: p("railings.wallBracketDrop"),
      wallBracketPlateThickness: p("railings.wallBracketPlateThickness"),
      wallBracketPlateWidth: p("railings.wallBracketPlateWidth"),
      wallBracketPlateHeight: p("railings.wallBracketPlateHeight"),
      wallBracketPlateMaterial: p("railings.wallBracketPlateMaterial"),
      wallSurfaceThickness: p("railings.wallSurfaceThickness"),
      wallSurfaceMaterial: p("railings.wallSurfaceMaterial"),
      postProfile: p("railings.postProfile"),
      railProfile: p("railings.railProfile")
    },
    connections: {
      family: p("connections.family"),
      weldSize: p("connections.weldSize"),
      treadFastenerRef: p("connections.treadFastenerRef"),
      anchorFastenerRef: p("connections.anchorFastenerRef"),
      postAnchorFastenerRef: p("connections.postAnchorFastenerRef"),
      treadCleatThickness: p("connections.treadCleatThickness"),
      treadCleatLength: p("connections.treadCleatLength"),
      treadCleatHeight: p("connections.treadCleatHeight"),
      treadBoltHoleDiameter: p("connections.treadBoltHoleDiameter"),
      treadBoltLength: p("connections.treadBoltLength"),
      floorBasePlateThickness: p("connections.floorBasePlateThickness"),
      floorBasePlateLength: p("connections.floorBasePlateLength"),
      floorBasePlateWidth: p("connections.floorBasePlateWidth"),
      slabBracketThickness: p("connections.slabBracketThickness"),
      slabBracketWidth: p("connections.slabBracketWidth"),
      slabBracketHeight: p("connections.slabBracketHeight"),
      anchorHoleDiameter: p("connections.anchorHoleDiameter"),
      anchorLength: p("connections.anchorLength"),
      floorAnchorGripLength: p("connections.floorAnchorGripLength"),
      slabAnchorGripLength: p("connections.slabAnchorGripLength"),
      levelTolerance: p("connections.levelTolerance"),
      spiralMountingSurfaceSize: p("connections.spiralMountingSurfaceSize"),
      spiralBasePlateSize: p("connections.spiralBasePlateSize"),
      spiralBasePlateThickness: p("connections.spiralBasePlateThickness"),
      spiralTopPlateThickness: p("connections.spiralTopPlateThickness"),
      spiralTreadBracketLength: p("connections.spiralTreadBracketLength"),
      spiralTreadBracketHeight: p("connections.spiralTreadBracketHeight"),
      postBasePlateThickness: p("connections.postBasePlateThickness"),
      postBasePlateWidth: p("connections.postBasePlateWidth"),
      postBasePlateDepth: p("connections.postBasePlateDepth"),
      postAnchorHoleDiameter: p("connections.postAnchorHoleDiameter"),
      postAnchorLength: p("connections.postAnchorLength"),
      postAnchorGripLength: p("connections.postAnchorGripLength"),
      splicePlateThickness: p("connections.splicePlateThickness"),
      splicePlateWidth: p("connections.splicePlateWidth"),
      splicePlateHeight: p("connections.splicePlateHeight"),
      spliceCutGap: p("connections.spliceCutGap"),
      spliceFastenerRef: p("connections.spliceFastenerRef"),
      spliceHoleDiameter: p("connections.spliceHoleDiameter"),
      spliceBoltLength: p("connections.spliceBoltLength"),
      spliceGripLength: p("connections.spliceGripLength"),
      showMountingSurfaces: p("connections.showMountingSurfaces"),
      mountingSurfaceMaterial: p("connections.mountingSurfaceMaterial"),
      floorSurfaceLength: p("connections.floorSurfaceLength"),
      floorSurfaceWidth: p("connections.floorSurfaceWidth"),
      floorSurfaceThickness: p("connections.floorSurfaceThickness"),
      topSlabSurfaceWidth: p("connections.topSlabSurfaceWidth"),
      topSlabSurfaceHeight: p("connections.topSlabSurfaceHeight"),
      topSlabSurfaceThickness: p("connections.topSlabSurfaceThickness")
    },
    sections: {
      strategy: p("sections.strategy"),
      maxWeightKg: p("sections.maxWeightKg"),
      targetLength: p("sections.targetLength"),
      manualStations: p("sections.manualStations")
    },
    compliance: {
      rulePack: p("compliance.rulePack"),
      category: p("compliance.category"),
      headroom: p("compliance.headroom")
    }
  };
}

function childRole(ctx, role, suffix = role) {
  return ctx.generatedRole(role, `_${suffix}`);
}

function emitDiagnostics(ctx, diagnostics = []) {
  for (const diagnostic of diagnostics) {
    if (!["error", "warning"].includes(diagnostic.severity)) continue;
    ctx.diagnostic(diagnostic.severity, diagnostic.code, diagnostic.message, {
      source: diagnostic.source,
      ruleId: diagnostic.ruleId,
      clause: diagnostic.clause,
      objectRoles: diagnostic.objectRoles,
      parameterPaths: diagnostic.parameterPaths || diagnostic.parameters,
      measured: diagnostic.measured,
      allowed: diagnostic.allowed,
      resolve: diagnostic.resolve
    });
  }
}

function flightChildren(ctx, solution) {
  const childIds = [];
  const flights = solution.computedValues.route.flights || [];
  for (const [index, flight] of flights.entries()) {
    const role = childRole(ctx, `flight${index + 1}`, `flight_${index + 1}`);
    const child = ctx.component.create(role, {
      componentRef: "path-flight",
      kind: "stair-flight",
      inputs: { layout: { flights: [flight] } },
      parameters: { meta: { parent: ctx.instanceId, family: "path-flight" } }
    });
    childIds.push(child.id);
  }
  return childIds;
}

function componentRefForRailing(family) {
  if (family === "glass-panel") return "glass-panel-railing";
  return family;
}

function landingTreadFrames(landings = []) {
  return landings.map((landing, index) => ({
    ...landing,
    depth: landing.length,
    index,
    width: landing.width,
    landingId: landing.id,
    surfaceKind: "landing",
    surfaceRole: "stair-steel-tray-landing",
    namePrefix: "Landing tread buildup",
    closedRisers: false,
    flightId: landing.id,
    station: (landing.stationStart + landing.stationEnd) / 2
  }));
}

export function build(ctx) {
  const parameters = stairParameters(ctx);
  const origin = ctx.requiredInput("placement.origin", {
    code: "stair-system-placement-missing",
    message: "Placement origin is required to solve the stair system."
  });
  if (!origin) return;
  const placement = { origin };
  const solution = solveStairSystem(parameters, { placement });
  const computed = solution.computedValues;
  emitDiagnostics(ctx, solution.diagnostics);

  const childIds = [];
  childIds.push(...flightChildren(ctx, solution));

  let support = null;
  if (parameters.supports.family !== "none") {
    support = ctx.component.create(childRole(ctx, "support"), {
      componentRef: parameters.supports.family,
      kind: "stair-support",
      inputs: {
        placement,
        geometry: { width: computed.width, totalRise: computed.totalRise },
        supports: parameters.supports,
        layout: {
          supports: computed.supports,
          core: computed.core,
          rolledPath: computed.rolledPath,
          routeType: computed.routeType
        }
      },
      parameters: { meta: { parent: ctx.instanceId, family: parameters.supports.family } }
    });
    childIds.push(support.id);
  }

  const treads = ctx.component.create(childRole(ctx, "treads"), {
    componentRef: parameters.treads.family,
    kind: "stair-tread",
    inputs: {
      geometry: { width: computed.width, rise: computed.rise },
      treads: parameters.treads,
      layout: {
        treads: computed.treads,
        noTreadZones: computed.route.treadExclusionZones || []
      }
    },
    parameters: { meta: { parent: ctx.instanceId, family: parameters.treads.family } }
  });
  childIds.push(treads.id);

  if (parameters.landings.family === "same-as-treads" && (computed.route.landings || []).length) {
    const landings = ctx.component.create(childRole(ctx, "landings"), {
      componentRef: parameters.treads.family,
      kind: "stair-landing",
      inputs: {
        geometry: { width: computed.width, rise: computed.rise },
        treads: parameters.treads,
        layout: { treads: landingTreadFrames(computed.route.landings) }
      },
      parameters: {
        meta: {
          parent: ctx.instanceId,
          family: "same-as-treads",
          treadFamily: parameters.treads.family
        }
      }
    });
    childIds.push(landings.id);
  } else if (parameters.landings.family !== "none" && (computed.route.landings || []).length) {
    const landings = ctx.component.create(childRole(ctx, "landings"), {
      componentRef: parameters.landings.family,
      kind: "stair-landing",
      inputs: {
        landings: parameters.landings,
        layout: { landings: computed.route.landings }
      },
      parameters: { meta: { parent: ctx.instanceId, family: parameters.landings.family } }
    });
    childIds.push(landings.id);
  }

  let railing = null;
  if (parameters.railings.family !== "none") {
    railing = ctx.component.create(childRole(ctx, "railing"), {
      componentRef: componentRefForRailing(parameters.railings.family),
      kind: "stair-railing",
      inputs: {
        geometry: { width: computed.width },
        railings: parameters.railings,
        connections: parameters.connections,
        layout: {
          railStations: computed.railStations,
          rolledPath: computed.rolledPath,
          routeType: computed.routeType
        }
      },
      parameters: { meta: { parent: ctx.instanceId, family: parameters.railings.family } }
    });
    childIds.push(railing.id);
  }

  let connections = null;
  if (support && parameters.connections.family !== "none") {
    connections = ctx.component.create(childRole(ctx, "connections"), {
      componentRef: parameters.connections.family,
      kind: "connection",
      inputs: {
        connections: parameters.connections,
        levels: {
          ffl1: computed.ffl1,
          ffl2: computed.ffl2,
          baseElevation: computed.baseElevation,
          topFinishedFloorElevation: computed.topFinishedFloorElevation,
          slab1ToFfl1: computed.slab1ToFfl1,
          slab2ToFfl2: computed.slab2ToFfl2,
          slab1Elevation: computed.slab1Elevation,
          slab2Elevation: computed.slab2Elevation
        },
        geometry: {
          width: computed.width,
          rise: computed.rise,
          stepCount: computed.stepCount,
          totalRise: computed.totalRise
        },
        components: {
          supportComponentId: support.id,
          treadComponentId: treads.id,
          railingComponentId: railing?.id || null
        }
      },
      connection: {
        role: "standardHardware",
        type: "standard-hardware-zone",
        name: "Standard hardware connection zone",
        mainObjectId: support.id,
        secondaryObjectIds: [treads.id, railing?.id].filter(Boolean),
        origin: placement.origin
      },
      parameters: { meta: { parent: ctx.instanceId, family: parameters.connections.family } }
    });
    childIds.push(connections.id);
  }

  if (support && parameters.sections.strategy !== "none") {
    const splitFrames = computed.sections?.splitFrames || [];
    if (splitFrames.length) {
      const sectionSplices = ctx.component.create(childRole(ctx, "sectionSplices", "section_splices"), {
        componentRef: "member-splice",
        kind: "connection",
        inputs: {
          connections: parameters.connections,
          components: {
            supportComponentId: support.id
          },
          sections: {
            ...parameters.sections,
            splitFrames
          }
        },
        connection: {
          role: "memberSplice",
          type: "member-splice-zone",
          name: "Member splice connection zone",
          mainObjectId: support.id,
          secondaryObjectIds: [ctx.instanceId],
          origin: splitFrames[0]?.origin || placement.origin
        },
        parameters: { meta: { parent: ctx.instanceId, family: "member-splice", reason: "transport-section-breaks" } }
      });
      childIds.push(sectionSplices.id);
    }

    const sections = ctx.component.create(childRole(ctx, "sections"), {
      componentRef: "transport-sections",
      kind: "sectioning",
      inputs: {
        sections: {
          ...parameters.sections,
          sourceComponentIds: childIds,
          splitFrames
        }
      },
      parameters: { meta: { parent: ctx.instanceId, family: "transport-sections" } }
    });
    childIds.push(sections.id);
  }

  ctx.objectPattern.create("systemPattern", {
    type: "path-pattern",
    generatedObjectIds: childIds,
    transform: {
      kind: "stair-system",
      route: computed.route,
      measurements: computed.measurements,
      childComponentIds: childIds
    },
    notes: "Top-level stair system solved layout and child component composition."
  });

  ctx.assembly.create("stairAssembly", {
    type: "stair-system-assembly",
    name: "Stair system",
    smartComponentInstanceIds: childIds,
    bim: { name: "Stair system" }
  });
  ctx.output("childComponentIds", childIds);
  ctx.output("supportComponentId", support?.id || null);
  ctx.output("treadComponentId", treads.id);
  ctx.output("railingComponentId", railing?.id || null);
  ctx.output("connectionComponentId", connections?.id || null);
  ctx.output("route", computed.route);
  ctx.output("measurements", computed.measurements);
  ctx.output("computedGeometry", {
    stepHeight: computed.rise,
    stepCount: computed.stepCount,
    calculatedStepCount: computed.calculatedStepCount,
    targetStepCount: computed.targetStepCount,
    maxStepHeight: computed.maxStepHeight,
    finishedFloorRise: computed.finishedFloorRise,
    flightStepDistribution: computed.flightStepDistribution
  });
  ctx.output("splitFrames", computed.sections?.splitFrames || []);
}
