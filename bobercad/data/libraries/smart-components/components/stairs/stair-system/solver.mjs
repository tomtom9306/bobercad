import { frameAtStation, normalizePath, pointAtStation } from "../../../../../../app/engine/api/geometry/paths.mjs";
import { createSolverResult } from "../../../../../../app/engine/api/model/solver-result.mjs";
import { runUkPartK } from "../rule-packs/uk-part-k/rules.mjs";

const EPSILON = 1e-9;

function finite(value, fallback = 0) {
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

function deg(value) {
  return value * Math.PI / 180;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul(a, scale) {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function len(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function unit(a, fallback = [1, 0, 0]) {
  const length = len(a);
  return length > EPSILON ? mul(a, 1 / length) : [...fallback];
}

function horizontalTangent(frame) {
  return unit([frame.tangent[0], frame.tangent[1], 0]);
}

function lateralFromTangent(tangent) {
  return unit([-tangent[1], tangent[0], 0], [0, 1, 0]);
}

function pointWithElevation(planPath, station, elevation) {
  const point = pointAtStation(planPath, station);
  return [point[0], point[1], elevation];
}

function frameWithElevation(planPath, station, elevation) {
  const frame = frameAtStation(planPath, station, { up: [0, 0, 1] });
  const tangent = horizontalTangent(frame);
  return {
    station,
    origin: [frame.origin[0], frame.origin[1], elevation],
    tangent,
    lateral: lateralFromTangent(tangent),
    up: [0, 0, 1]
  };
}

function segmentForStation(planPath, station, prefer = "before") {
  const segments = planPath.segments || [];
  if (!segments.length) return null;
  if (prefer === "after") {
    return segments.find((segment) => station >= segment.stationStart - EPSILON && station < segment.stationEnd - EPSILON)
      || segments.find((segment) => Math.abs(station - segment.stationStart) <= EPSILON)
      || segments[segments.length - 1];
  }
  return [...segments].reverse().find((segment) => station > segment.stationStart + EPSILON && station <= segment.stationEnd + EPSILON)
    || segments.find((segment) => Math.abs(station - segment.stationEnd) <= EPSILON)
    || segments[0];
}

function frameOnSegment(planPath, station, elevation, prefer = "before") {
  const segment = segmentForStation(planPath, station, prefer);
  if (!segment) return frameWithElevation(planPath, station, elevation);
  const distance = Math.max(0, Math.min(segment.length, station - segment.stationStart));
  const origin = segment.pointAt(distance);
  const tangent = unit([...(segment.tangentAt(distance) || [1, 0, 0])].map((value, index) => index === 2 ? 0 : value), [1, 0, 0]);
  return {
    station,
    origin: [origin[0], origin[1], elevation],
    tangent,
    lateral: lateralFromTangent(tangent),
    up: [0, 0, 1]
  };
}

function splitStepCounts(stepCount, segments) {
  const counts = Array.from({ length: segments }, () => Math.floor(stepCount / segments));
  for (let index = 0; index < stepCount % segments; index += 1) counts[index] += 1;
  return counts;
}

function polylinePath(points) {
  return normalizePath({ type: "polyline", points });
}

function positiveInteger(value, fallback) {
  const number = Math.round(finite(value, fallback));
  return number > 0 ? number : fallback;
}

function isFlightModule(module) {
  return String(module?.type || "").startsWith("flight.");
}

function isLandingModule(module) {
  return String(module?.type || "").startsWith("landing.");
}

function normalizedRouteModules(parameters = {}) {
  const source = Array.isArray(parameters.route?.modules) ? parameters.route.modules : [];
  const modules = source
    .filter((module) => module && typeof module === "object")
    .map((module, index) => ({
      ...module,
      id: module.id || `${isLandingModule(module) ? "landing" : "flight"}_${index + 1}`,
      type: typeof module.type === "string" ? module.type : "flight.straight"
    }));
  if (!modules.some(isFlightModule)) modules.unshift({ id: "flight_1", type: "flight.straight" });
  return modules;
}

function explicitFlightStepCount(module) {
  const value = module?.stepCountOverride ?? module?.stepCount;
  return Number.isInteger(value) && value > 0 ? value : null;
}

function routeModuleStepCount(modules = [], fallbackStepCount = 0) {
  const flights = modules.filter(isFlightModule);
  if (!flights.length) return 0;
  const explicit = flights.map(explicitFlightStepCount);
  if (explicit.every((count) => count !== null)) return explicit.reduce((sum, count) => sum + count, 0);
  const explicitTotal = explicit.reduce((sum, count) => sum + (count || 0), 0);
  const missingCount = explicit.filter((count) => count === null).length;
  if (!explicitTotal) return 0;
  return explicitTotal + Math.max(missingCount, Math.round(fallbackStepCount) - explicitTotal);
}

function solveFlightStepDistribution(modules = [], targetStepCount) {
  const flights = modules.filter(isFlightModule);
  const explicit = flights.map(explicitFlightStepCount);
  const missingCount = explicit.filter((count) => count === null).length;
  const explicitTotal = explicit.reduce((sum, count) => sum + (count || 0), 0);
  const diagnostics = [];
  if (!flights.length) {
    return { counts: [], targetStepCount, solvedStepCount: targetStepCount, diagnostics };
  }
  if (!missingCount) {
    const solvedStepCount = Math.max(1, explicitTotal);
    if (solvedStepCount !== targetStepCount) {
      diagnostics.push({
        severity: solvedStepCount < targetStepCount ? "error" : "warning",
        code: "stair-flight-overrides-total-mismatch",
        message: `Flight step overrides total ${solvedStepCount}, but level/max-rise calculation targets ${targetStepCount}.`,
        parameterPaths: ["route.modules", "geometry.maxStepHeight"],
        measured: { overrideTotal: solvedStepCount, targetStepCount },
        resolve: "Remove at least one flight override or adjust max step height so free flights can rebalance the route."
      });
    }
    return { counts: explicit, targetStepCount, solvedStepCount, diagnostics };
  }

  const remaining = Math.max(0, targetStepCount - explicitTotal);
  const fallbackCounts = splitStepCounts(remaining, missingCount);
  let fallbackIndex = 0;
  const counts = explicit.map((count) => count ?? fallbackCounts[fallbackIndex++]);
  const solvedStepCount = counts.reduce((sum, count) => sum + count, 0);
  if (explicitTotal > targetStepCount) {
    diagnostics.push({
      severity: "warning",
      code: "stair-flight-overrides-exceed-target",
      message: `Flight step overrides use ${explicitTotal} steps, above the calculated ${targetStepCount}; free flights receive no remaining steps.`,
      parameterPaths: ["route.modules", "geometry.maxStepHeight"],
      measured: { overrideTotal: explicitTotal, targetStepCount },
      resolve: "Lower one of the flight overrides or increase FFL rise/max step target if this is intentional."
    });
  }
  if (counts.some((count) => count <= 0)) {
    diagnostics.push({
      severity: "error",
      code: "stair-flight-zero-step",
      message: "At least one non-overridden flight has no remaining steps after applying flight overrides.",
      parameterPaths: ["route.modules"],
      measured: { counts, targetStepCount },
      resolve: "Reduce overridden flight steps or remove the empty flight module."
    });
  }
  return { counts, targetStepCount, solvedStepCount: Math.max(1, solvedStepCount), diagnostics };
}

function routeTypeForModules(modules = []) {
  const flightTypes = modules.filter(isFlightModule).map((module) => module.type);
  if (flightTypes.includes("flight.helical")) return "helical";
  if (flightTypes.includes("flight.spiral")) return "spiral";
  if (flightTypes.includes("flight.curved")) return "curved";
  if (flightTypes.includes("flight.winder")) return "winder";
  const landingTypes = modules.filter(isLandingModule).map((module) => module.type);
  if (landingTypes.includes("landing.u")) return "u-switchback";
  if (landingTypes.includes("landing.l")) return "l-landing";
  if (landingTypes.includes("landing.straight")) return "straight-landing";
  return "straight";
}

function specialFlightModule(modules = []) {
  return modules.find((module) => ["flight.winder", "flight.curved", "flight.spiral", "flight.helical"].includes(module.type)) || null;
}

function pushPoint(points, point) {
  const last = points[points.length - 1];
  if (!last || len([last[0] - point[0], last[1] - point[1], last[2] - point[2]]) > EPSILON) points.push(point);
}

function translatePoints(points, delta) {
  for (let index = 0; index < points.length; index += 1) {
    points[index] = add(points[index], delta);
  }
}

function translateLandings(landings, delta) {
  for (const landing of landings) {
    if (Array.isArray(landing.origin)) landing.origin = add(landing.origin, delta);
  }
}

function straightRoute({ origin, stepCount, going }) {
  const run = stepCount * going;
  return {
    path: normalizePath({ type: "line", start: origin, end: add(origin, [run, 0, 0]) }),
    modules: [{ id: "flight_1", type: "flight.straight" }],
    flights: [{ id: "flight_1", startStation: 0, run, stepStart: 0, stepCount }],
    landings: []
  };
}

function landingLength(module, parameters, computed) {
  if (module?.type === "landing.l" || module?.type === "landing.u") return computed.width;
  return positive(module.length, positive(parameters.landings?.length, Math.max(computed.width, computed.going * 2)));
}

function landingEntryExtension(module, parameters) {
  if (module?.type === "landing.straight") return nonNegative(module.entryExtensionLength, 0);
  return nonNegative(module?.entryExtensionLength, nonNegative(parameters.landings?.entryExtensionLength, 0));
}

function landingExitExtension(module, parameters) {
  if (module?.type === "landing.straight") return nonNegative(module.exitExtensionLength, 0);
  return nonNegative(module?.exitExtensionLength, nonNegative(parameters.landings?.exitExtensionLength, 0));
}

function cleanFootprint(points) {
  const clean = [];
  for (const point of points) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(last[0] - point[0]) > EPSILON || Math.abs(last[1] - point[1]) > EPSILON) {
      clean.push(point);
    }
  }
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first && last && Math.abs(first[0] - last[0]) <= EPSILON && Math.abs(first[1] - last[1]) <= EPSILON) {
    clean.pop();
  }
  return clean.length >= 3 ? clean : null;
}

function rectangularLandingFootprint({ length, width }) {
  const yMin = -width / 2;
  const yMax = width / 2;
  const zMin = -length / 2;
  const zMax = length / 2;
  return cleanFootprint([
    [yMin, zMin],
    [yMax, zMin],
    [yMax, zMax],
    [yMin, zMax]
  ]);
}

function lLandingFootprint({ length, width, entryExtension, exitExtension }) {
  const yMin = -width / 2;
  const yMax = width / 2;
  const yExitMax = yMax + exitExtension;
  const zBaseMin = -length / 2;
  const zEntryMin = zBaseMin - entryExtension;
  const zMax = length / 2;
  const zExitMin = Math.max(zBaseMin, zMax - width);
  return cleanFootprint([
    [yMin, zEntryMin],
    [yMax, zEntryMin],
    [yMax, zExitMin],
    [yExitMax, zExitMin],
    [yExitMax, zMax],
    [yMin, zMax]
  ]);
}

function uLandingFootprint({ length, width, across, entryExtension, exitExtension }) {
  const yMin = -(across + width) / 2;
  const yEntryMax = yMin + width;
  const yMax = (across + width) / 2;
  const yExitMin = yMax - width;
  const zBaseMin = -length / 2;
  const zEntryMin = zBaseMin - entryExtension;
  const zExitMin = zBaseMin - exitExtension;
  const zMax = length / 2;
  return cleanFootprint([
    [yMin, zEntryMin],
    [yEntryMax, zEntryMin],
    [yEntryMax, zBaseMin],
    [yExitMin, zBaseMin],
    [yExitMin, zExitMin],
    [yMax, zExitMin],
    [yMax, zMax],
    [yMin, zMax]
  ]);
}

function straightLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed }) {
  const baseLength = landingLength(module, parameters, computed);
  const entryExtension = landingEntryExtension(module, parameters);
  const exitExtension = landingExitExtension(module, parameters);
  const length = baseLength + entryExtension + exitExtension;
  const footprint = rectangularLandingFootprint({ length, width: computed.width });
  const stationStart = Math.max(0, currentStation - replacedGoing);
  const stationEnd = stationStart + length;
  const landingStartPoint = add(currentPoint, mul(tangent, -replacedGoing));
  return {
    point: add(currentPoint, mul(tangent, Math.max(0, length - replacedGoing))),
    station: stationEnd,
    tangent,
    lateral,
    landing: {
      id: module.id || `landing_${landingIndex + 1}`,
      stationStart,
      stationEnd,
      afterStep: currentStep,
      kind: "intermediate",
      origin: add(landingStartPoint, mul(tangent, length / 2)),
      tangent,
      lateral,
      length,
      baseLength,
      entryExtensionLength: entryExtension,
      exitExtensionLength: exitExtension,
      replacedFlightEndStation: currentStation,
      replacedTreadGoing: replacedGoing,
      width: computed.width,
      footprint
    }
  };
}

function lLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed }) {
  const baseLength = landingLength(module, parameters, computed);
  const entryExtension = landingEntryExtension(module, parameters);
  const exitExtension = landingExitExtension(module, parameters);
  const sign = module.turnDirection === "right" ? -1 : 1;
  const turnVector = mul(lateral, sign);
  const stationStart = Math.max(0, currentStation - replacedGoing);
  const stationEnd = stationStart + baseLength + entryExtension + exitExtension;
  const baseCurrentPoint = add(currentPoint, mul(tangent, entryExtension));
  const landingStartPoint = add(baseCurrentPoint, mul(tangent, -replacedGoing));
  const corner = add(baseCurrentPoint, mul(tangent, Math.max(0, baseLength - replacedGoing - computed.width / 2)));
  const exitPoint = add(corner, mul(turnVector, computed.width / 2 + exitExtension));
  const footprint = lLandingFootprint({ length: baseLength, width: computed.width, entryExtension, exitExtension });
  return {
    points: [corner, exitPoint],
    point: exitPoint,
    station: stationEnd,
    tangent: turnVector,
    lateral: lateralFromTangent(turnVector),
    landing: {
      id: module.id || `landing_${landingIndex + 1}`,
      stationStart,
      stationEnd,
      afterStep: currentStep,
      kind: "intermediate",
      origin: add(landingStartPoint, mul(tangent, baseLength / 2)),
      tangent,
      lateral: turnVector,
      length: baseLength,
      baseLength,
      entryExtensionLength: entryExtension,
      exitExtensionLength: exitExtension,
      replacedFlightEndStation: currentStation,
      replacedTreadGoing: replacedGoing,
      width: computed.width,
      footprint
    }
  };
}

function uLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed }) {
  const baseLength = landingLength(module, parameters, computed);
  const entryExtension = landingEntryExtension(module, parameters);
  const exitExtension = landingExitExtension(module, parameters);
  const across = positive(module.turnAcross, Math.max(computed.width * 2, baseLength));
  const sign = module.turnDirection === "right" ? -1 : 1;
  const turnVector = mul(lateral, sign);
  const stationStart = Math.max(0, currentStation - replacedGoing);
  const stationEnd = stationStart + entryExtension + baseLength + across + baseLength + exitExtension;
  const baseCurrentPoint = add(currentPoint, mul(tangent, entryExtension));
  const landingStartPoint = add(baseCurrentPoint, mul(tangent, -replacedGoing));
  const firstCorner = add(baseCurrentPoint, mul(tangent, Math.max(0, baseLength - replacedGoing)));
  const secondCorner = add(firstCorner, mul(turnVector, across));
  const nextTangent = mul(tangent, -1);
  const exitPoint = add(secondCorner, mul(nextTangent, baseLength + exitExtension));
  const footprint = uLandingFootprint({ length: baseLength, width: computed.width, across, entryExtension, exitExtension });
  return {
    points: [firstCorner, secondCorner, exitPoint],
    point: exitPoint,
    station: stationEnd,
    tangent: nextTangent,
    lateral: lateralFromTangent(nextTangent),
    landing: {
      id: module.id || `landing_${landingIndex + 1}`,
      stationStart,
      stationEnd,
      afterStep: currentStep,
      kind: "switchback",
      origin: add(add(landingStartPoint, mul(tangent, baseLength / 2)), mul(turnVector, across / 2)),
      tangent,
      lateral: turnVector,
      length: baseLength,
      baseLength,
      entryExtensionLength: entryExtension,
      exitExtensionLength: exitExtension,
      replacedFlightEndStation: currentStation,
      replacedTreadGoing: replacedGoing,
      width: across + computed.width,
      footprint
    }
  };
}

function modularRoute({ origin, modules, parameters, computed }) {
  const flightCounts = computed.flightStepCounts || [];
  const points = [origin];
  const flights = [];
  const landings = [];
  let currentPoint = origin;
  let currentStation = 0;
  let currentStep = 0;
  let tangent = [1, 0, 0];
  let lateral = [0, 1, 0];
  let replacedGoing = computed.going;
  let flightIndex = 0;
  let landingIndex = 0;

  for (const module of modules) {
    if (isFlightModule(module)) {
      const count = Math.max(0, Math.round(finite(flightCounts[flightIndex], 0)));
      const run = count * computed.going;
      flights.push({
        id: module.id || `flight_${flightIndex + 1}`,
        startStation: currentStation,
        run,
        stepStart: currentStep,
        stepCount: count
      });
      currentPoint = add(currentPoint, mul(tangent, run));
      currentStation += run;
      currentStep += count;
      replacedGoing = computed.going;
      flightIndex += 1;
      if (run > EPSILON) pushPoint(points, currentPoint);
      continue;
    }
    if (!isLandingModule(module) || !flights.length) continue;
    const entryExtension = landingEntryExtension(module, parameters);
    if (entryExtension > EPSILON) {
      const upstreamShift = mul(tangent, -entryExtension);
      translatePoints(points, upstreamShift);
      translateLandings(landings, upstreamShift);
      currentPoint = add(currentPoint, upstreamShift);
    }
    const result = module.type === "landing.u"
      ? uLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed })
      : module.type === "landing.l"
        ? lLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed })
        : straightLanding({ module, landingIndex, currentPoint, currentStation, currentStep, tangent, lateral, replacedGoing, parameters, computed });
    for (const point of result.points || [result.point]) pushPoint(points, point);
    landings.push(result.landing);
    currentPoint = result.point;
    currentStation = result.station;
    tangent = result.tangent;
    lateral = result.lateral;
    landingIndex += 1;
  }

  if (!flights.length) return straightRoute({ origin, stepCount: computed.stepCount, going: computed.going });
  return {
    path: polylinePath(points),
    modules,
    flights,
    landings
  };
}

function arcRoute({ origin, run, radius, sweepRadians, rolledType = "arc", rolledHeight = 0, modules = [] }) {
  const sweep = Math.abs(sweepRadians) > EPSILON ? sweepRadians : run / radius;
  const center = add(origin, [0, radius, 0]);
  const arcPath = {
    type: "arc",
    center,
    radius,
    startAngle: -Math.PI / 2,
    endAngle: -Math.PI / 2 + sweep,
    axisX: [1, 0, 0],
    axisY: [0, 1, 0]
  };
  const rolledPath = rolledType === "helix"
    ? {
      ...arcPath,
      type: "helix",
      height: rolledHeight,
      axisZ: [0, 0, 1]
    }
    : arcPath;
  return {
    path: normalizePath(arcPath),
    rolledPath,
    core: {
      center,
      radius,
      axis: [0, 0, 1]
    },
    modules,
    flights: [{ id: "flight_1", startStation: 0, run: Math.abs(sweep) * radius, stepStart: 0, stepCount: null }],
    landings: []
  };
}

function solveRoute(parameters, inputs, computed) {
  const origin = inputs.placement?.origin || [0, 0, 0];
  const run = computed.going * computed.stepCount;
  const modules = computed.routeModules;
  const specialFlight = specialFlightModule(modules);
  if (specialFlight?.type === "flight.curved" || specialFlight?.type === "flight.winder") {
    const radius = positive(specialFlight.radius, Math.max(computed.width, computed.going * 2));
    return arcRoute({
      origin,
      run,
      radius,
      sweepRadians: run / radius,
      rolledType: "helix",
      rolledHeight: computed.totalRise,
      modules
    });
  }
  if (specialFlight?.type === "flight.spiral" || specialFlight?.type === "flight.helical") {
    const radius = positive(specialFlight.radius, Math.max(computed.width, computed.going * 2));
    const rotation = deg(positive(specialFlight.rotationDegrees, 360));
    return arcRoute({
      origin,
      run,
      radius,
      sweepRadians: rotation,
      rolledType: "helix",
      rolledHeight: computed.totalRise,
      modules
    });
  }
  return modularRoute({ origin, modules, parameters, computed });
}

function isTreadReplacedByLanding(flight, index, landings = []) {
  const flightEnd = flight.startStation + flight.run;
  return landings.some((landing) => (
    landing.afterStep === index + 1
    && Math.abs(flightEnd - (landing.replacedFlightEndStation ?? landing.stationStart)) <= EPSILON
  ));
}

function createTreadFrames(planPath, flights, computed, landings = []) {
  const frames = [];
  for (const flight of flights) {
    const count = flight.stepCount ?? computed.stepCount;
    const going = flight.run / count;
    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const index = flight.stepStart + localIndex;
      if (isTreadReplacedByLanding(flight, index, landings)) continue;
      const station = flight.startStation + (localIndex + 0.5) * going;
      frames.push({
        ...frameWithElevation(planPath, station, computed.baseElevation + computed.rise * (index + 1)),
        id: `tread_${index + 1}`,
        index,
        flightId: flight.id,
        going
      });
    }
  }
  return frames.sort((a, b) => a.index - b.index);
}

function landingFrames(planPath, landings, computed) {
  return landings.map((landing, index) => {
    const station = (landing.stationStart + landing.stationEnd) / 2;
    const elevation = computed.baseElevation + computed.rise * landing.afterStep;
    return {
      ...frameWithElevation(planPath, station, computed.baseElevation + computed.rise * landing.afterStep),
      origin: Array.isArray(landing.origin) ? [landing.origin[0], landing.origin[1], elevation] : frameWithElevation(planPath, station, elevation).origin,
      tangent: Array.isArray(landing.tangent) ? landing.tangent : frameWithElevation(planPath, station, elevation).tangent,
      lateral: Array.isArray(landing.lateral) ? landing.lateral : frameWithElevation(planPath, station, elevation).lateral,
      id: landing.id || `landing_${index + 1}`,
      index,
      length: positive(landing.length, Math.max(landing.stationEnd - landing.stationStart, computed.width)),
      width: positive(landing.width, computed.width),
      baseLength: positive(landing.baseLength, positive(landing.length, Math.max(landing.stationEnd - landing.stationStart, computed.width))),
      entryExtensionLength: nonNegative(landing.entryExtensionLength, 0),
      exitExtensionLength: nonNegative(landing.exitExtensionLength, 0),
      replacedFlightEndStation: finite(landing.replacedFlightEndStation, landing.stationStart),
      replacedTreadGoing: nonNegative(landing.replacedTreadGoing, 0),
      footprint: Array.isArray(landing.footprint) ? landing.footprint.map((point) => [finite(point[0]), finite(point[1])]) : null,
      kind: landing.kind || "intermediate",
      stationStart: landing.stationStart,
      stationEnd: landing.stationEnd,
      afterStep: landing.afterStep
    };
  });
}

function treadExclusionZonesForLandings(landings = []) {
  return landings
    .map((landing) => {
      const stationEnd = finite(landing.replacedFlightEndStation, NaN);
      const replacedGoing = nonNegative(landing.replacedTreadGoing, 0);
      if (!Number.isFinite(stationEnd) || replacedGoing <= EPSILON) return null;
      return {
        id: `${landing.id || "landing"}_replaced_tread_zone`,
        landingId: landing.id || null,
        afterStep: landing.afterStep,
        stationStart: Math.max(0, stationEnd - replacedGoing),
        stationEnd,
        replacedFlightEndStation: stationEnd,
        replacedTreadGoing: replacedGoing,
        role: "landing-replaced-terminal-tread"
      };
    })
    .filter(Boolean);
}

function supportSegments(planPath, flights, computed, options = {}) {
  const segments = [];
  const maxRun = positive(options.maxSegmentLength, computed.routeType === "straight" ? computed.going * computed.stepCount : 900);
  for (const flight of flights) {
    if (flight.run <= EPSILON || flight.stepCount <= 0) continue;
    const divisions = Math.max(1, Math.ceil(flight.run / maxRun));
    for (let index = 0; index < divisions; index += 1) {
      const a = index / divisions;
      const b = (index + 1) / divisions;
      const startStation = flight.startStation + flight.run * a;
      const endStation = flight.startStation + flight.run * b;
      const startElevation = computed.baseElevation + computed.rise * (flight.stepStart + flight.stepCount * a);
      const endElevation = computed.baseElevation + computed.rise * (flight.stepStart + flight.stepCount * b);
      const startFrame = frameOnSegment(planPath, startStation, startElevation, "after");
      const endFrame = frameOnSegment(planPath, endStation, endElevation, "before");
      segments.push({
        id: `${flight.id}_support_${index + 1}`,
        flightId: flight.id,
        index,
        startStation,
        endStation,
        start: startFrame.origin,
        end: endFrame.origin,
        startLateral: startFrame.lateral,
        endLateral: endFrame.lateral,
        tangent: startFrame.tangent
      });
    }
  }
  return segments;
}

function elevationAtStation(route, computed, station) {
  for (const landing of route.landings || []) {
    if (station >= landing.stationStart - EPSILON && station <= landing.stationEnd + EPSILON) {
      return computed.baseElevation + computed.rise * landing.afterStep;
    }
  }
  for (const flight of route.flights || []) {
    const count = flight.stepCount ?? computed.stepCount;
    if (station >= flight.startStation - EPSILON && station <= flight.startStation + flight.run + EPSILON) {
      const progress = Math.max(0, Math.min(1, (station - flight.startStation) / Math.max(flight.run, 1)));
      return computed.baseElevation + computed.rise * (flight.stepStart + count * progress);
    }
  }
  return computed.baseElevation + computed.totalRise * station / Math.max(route.path?.length || 1, 1);
}

function railingStationFromSegment(segment, station, elevation, id, index) {
  const distance = Math.max(0, Math.min(segment.length, station - segment.stationStart));
  const point = segment.pointAt(distance);
  const tangent = unit([...(segment.tangentAt(distance) || [1, 0, 0])].map((value, axisIndex) => axisIndex === 2 ? 0 : value), [1, 0, 0]);
  return {
    station,
    origin: [point[0], point[1], elevation],
    tangent,
    lateral: lateralFromTangent(tangent),
    up: [0, 0, 1],
    id,
    index
  };
}

function railingStations(planPath, computed, route) {
  const spacing = positive(computed.railingPostSpacing, 1200);
  const stations = [];
  for (const segment of planPath.segments || []) {
    const divisions = Math.max(1, Math.ceil(segment.length / spacing));
    for (let localIndex = 0; localIndex <= divisions; localIndex += 1) {
      const station = segment.stationStart + segment.length * localIndex / divisions;
      const elevation = elevationAtStation(route, computed, station);
      stations.push(railingStationFromSegment(segment, station, elevation, `rail_station_${stations.length + 1}`, stations.length));
    }
  }
  return stations;
}

function diagnosticsForSpecialRoutes(computed) {
  const type = computed.routeType || "straight";
  if (!["spiral", "helical", "winder"].includes(type)) return [];
  return [{
    severity: "warning",
    code: "stair-special-route-review",
    message: `${type} stairs need project-specific walking-line and guarding review.`,
    parameterPaths: ["route.modules"],
    objectRoles: ["treadPattern"]
  }];
}

function moduleRouteDiagnostics(computed) {
  const modules = computed.routeModules || [];
  const special = specialFlightModule(modules);
  if (!special) return [];
  if (modules.length === 1) return [];
  return [{
    severity: "error",
    code: "stair-special-route-modules-unsupported",
    message: `${computed.routeType} route must be a single analytic flight module; landings and extra flights require a straight/L/U modular route.`,
    parameterPaths: ["route.modules"],
    resolve: "Use one curved, winder, spiral, or helical flight module, or build the route from straight flights and landing modules."
  }];
}

function sectionSplitFrames(planPath, route, computed, parameters = {}) {
  const strategy = parameters.sections?.strategy || "none";
  const routeLength = planPath.length;
  const targetLength = positive(parameters.sections?.targetLength, routeLength);
  const maxWeightStations = strategy === "max-weight"
    ? Array.from({ length: Math.max(1, Math.ceil(routeLength / targetLength)) - 1 }, (_, index) => routeLength * (index + 1) / Math.max(1, Math.ceil(routeLength / targetLength)))
    : [];
  const rawStations = strategy === "manual-stations"
    ? parameters.sections?.manualStations || []
    : strategy === "landings"
      ? (route.landings || []).flatMap((landing) => [landing.stationStart, landing.stationEnd])
      : maxWeightStations;
  return [...new Set(rawStations
    .filter((station) => typeof station === "number" && Number.isFinite(station))
    .map((station) => Math.max(0, Math.min(routeLength, station)))
    .filter((station) => station > EPSILON && station < routeLength - EPSILON))]
    .sort((a, b) => a - b)
    .map((station, index) => ({
      ...frameOnSegment(planPath, station, elevationAtStation(route, computed, station), "before"),
      id: `section_split_${index + 1}`,
      index,
      strategy
    }));
}

function capabilityDiagnostics(parameters, computed) {
  const diagnostics = [];
  const routeType = computed.routeType;
  const supports = parameters.supports?.family;
  const treads = parameters.treads?.family;
  const railings = parameters.railings?.family;
  if (["spiral", "helical"].includes(routeType) && supports !== "none" && !["spiral-column", "mono-stringer", "twin-stringer"].includes(supports)) {
    diagnostics.push({
      severity: "error",
      code: "stair-route-support-family-unsupported",
      message: `${routeType} route requires a rolled/spiral-capable support family.`,
      parameterPaths: ["route.modules", "supports.family"],
      resolve: "Use spiral-column, mono-stringer, or twin-stringer support for spiral/helical stairs."
    });
  }
  if (["winder", "curved", "spiral", "helical"].includes(routeType) && treads === "grating-tread") {
    diagnostics.push({
      severity: "warning",
      code: "stair-curved-grating-review-required",
      message: `${routeType} route with grating treads needs explicit tread-frame and nosing review.`,
      parameterPaths: ["route.modules", "treads.family"],
      objectRoles: ["treadPattern"],
      resolve: "Confirm the grating tread family supports the solved curved/winder frame before fabrication."
    });
  }
  if (["spiral", "helical"].includes(routeType) && railings === "wall-handrail") {
    diagnostics.push({
      severity: "error",
      code: "stair-route-railing-family-unsupported",
      message: `${routeType} route cannot use wall-handrail without a wall interface path.`,
      parameterPaths: ["route.modules", "railings.family"],
      resolve: "Use post-and-rail or glass-panel railing, or provide an explicit wall handrail support path."
    });
  }
  return diagnostics;
}

function riseCalculationDiagnostics(computed) {
  const diagnostics = [];
  if (computed.rise > computed.maxStepHeight + EPSILON) {
    diagnostics.push({
      severity: "error",
      code: "stair-rise-exceeds-max-step-height",
      message: `Solved rise ${computed.rise.toFixed(2)} mm exceeds max step height ${computed.maxStepHeight.toFixed(2)} mm.`,
      parameterPaths: ["geometry.maxStepHeight", "route.modules"],
      measured: { rise: computed.rise, maxStepHeight: computed.maxStepHeight, stepCount: computed.stepCount, targetStepCount: computed.targetStepCount },
      resolve: "Increase max step height, remove low flight overrides, or add more steps to overridden flights."
    });
  }
  return diagnostics;
}

function railingPostSpacing(parameters, computed) {
  const baseSpacing = positive(parameters.railings?.postSpacing, 1200);
  if (!["spiral", "helical", "winder", "curved"].includes(computed.routeType)) return baseSpacing;
  const curvedDefault = Math.max(360, computed.width * 0.55);
  return Math.min(baseSpacing, positive(parameters.railings?.curvePostSpacing, curvedDefault));
}

function solveLevelGeometry(parameters = {}, inputs = {}) {
  const legacyRise = positive(parameters.geometry?.rise, 180);
  const legacyStepCount = Math.max(1, Math.round(positive(parameters.geometry?.stepCount, 8)));
  const legacyFloorToFloor = positive(parameters.levels?.floorToFloor, legacyRise * legacyStepCount);
  const ffl1 = finite(parameters.levels?.ffl1, 0);
  let ffl2 = finite(parameters.levels?.ffl2, ffl1 + legacyFloorToFloor);
  if (ffl2 <= ffl1 + EPSILON) ffl2 = ffl1 + legacyFloorToFloor;
  const finishedFloorRise = Math.max(EPSILON, ffl2 - ffl1);
  const maxStepHeight = positive(parameters.geometry?.maxStepHeight, legacyRise);
  const targetStepCount = Math.max(1, Math.ceil(finishedFloorRise / maxStepHeight - EPSILON));
  const placementElevation = finite(inputs.placement?.origin?.[2], 0);
  const baseElevation = placementElevation + ffl1;
  const topFinishedFloorElevation = placementElevation + ffl2;
  const slab1ToFfl1 = nonNegative(parameters.levels?.slab1ToFfl1, 0);
  const slab2ToFfl2 = nonNegative(parameters.levels?.slab2ToFfl2, 0);
  return {
    ffl1,
    ffl2,
    floorToFloor: finishedFloorRise,
    finishedFloorRise,
    maxStepHeight,
    targetStepCount,
    calculatedStepCount: targetStepCount,
    baseElevation,
    topFinishedFloorElevation,
    slab1ToFfl1,
    slab2ToFfl2,
    slab1Elevation: baseElevation - slab1ToFfl1,
    slab2Elevation: topFinishedFloorElevation - slab2ToFfl2
  };
}

export function solveStairSystem(parameters = {}, inputs = {}) {
  const routeModules = normalizedRouteModules(parameters);
  const levels = solveLevelGeometry(parameters, inputs);
  const distribution = solveFlightStepDistribution(routeModules, levels.targetStepCount);
  const stepCount = distribution.solvedStepCount;
  const width = positive(parameters.geometry?.width, 900);
  const rise = levels.finishedFloorRise / stepCount;
  const totalRise = levels.finishedFloorRise;
  const going = positive(parameters.geometry?.going, 260);
  const routeType = routeTypeForModules(routeModules);
  const computed = {
    stepCount,
    targetStepCount: levels.targetStepCount,
    calculatedStepCount: levels.calculatedStepCount,
    flightStepCounts: distribution.counts,
    flightStepDistribution: distribution.counts,
    routeModules,
    width,
    rise,
    going,
    maxStepHeight: levels.maxStepHeight,
    floorToFloor: levels.floorToFloor,
    finishedFloorRise: levels.finishedFloorRise,
    ffl1: levels.ffl1,
    ffl2: levels.ffl2,
    slab1ToFfl1: levels.slab1ToFfl1,
    slab2ToFfl2: levels.slab2ToFfl2,
    slab1Elevation: levels.slab1Elevation,
    slab2Elevation: levels.slab2Elevation,
    topFinishedFloorElevation: levels.topFinishedFloorElevation,
    totalRise,
    baseElevation: levels.baseElevation,
    pitchDeg: Math.atan2(rise, going) * 180 / Math.PI,
    twiceRisePlusGoing: 2 * rise + going,
    routeType,
    headroom: positive(parameters.compliance?.headroom, 2000),
    handrailHeight: positive(parameters.railings?.height, 1000)
  };
  computed.railingPostSpacing = railingPostSpacing(parameters, computed);
  const route = solveRoute(parameters, inputs, computed);
  const planPath = route.path;
  const flights = route.flights.map((flight) => ({
    ...flight,
    stepCount: flight.stepCount ?? stepCount,
    going: flight.run / (flight.stepCount ?? stepCount)
  }));
  const treads = createTreadFrames(planPath, flights, computed, route.landings);
  const landings = landingFrames(planPath, route.landings, computed);
  const treadExclusionZones = treadExclusionZonesForLandings(landings);
  const supports = supportSegments(planPath, flights, computed, parameters.supports || {});
  const railStations = railingStations(planPath, computed, { ...route, flights });
  const splitFrames = sectionSplitFrames(planPath, { ...route, flights }, computed, parameters);
  const measurements = {
    rise: computed.rise,
    going: routeType === "spiral" || routeType === "helical" ? planPath.length / stepCount : computed.going,
    pitchDeg: computed.pitchDeg,
    twiceRisePlusGoing: computed.twiceRisePlusGoing,
    stepCount,
    targetStepCount: computed.targetStepCount,
    calculatedStepCount: computed.calculatedStepCount,
    flightStepDistribution: computed.flightStepDistribution,
    maxStepHeight: computed.maxStepHeight,
    finishedFloorRise: computed.finishedFloorRise,
    width,
    headroom: computed.headroom,
    handrailHeight: computed.handrailHeight
  };
  const complianceDiagnostics = parameters.compliance?.rulePack === "uk-part-k"
    ? runUkPartK({ parameters, measurements }).diagnostics
    : [];

  return createSolverResult({
    inputParameters: parameters,
    resolvedParameters: parameters,
    computedValues: {
      ...computed,
      routeLength: planPath.length,
      measurements,
      core: route.core || null,
      rolledPath: route.rolledPath || null,
      route: {
        type: routeType,
        modules: route.modules || routeModules,
        path: { id: planPath.id, type: planPath.type, length: planPath.length },
        core: route.core || null,
        flights,
        landings,
        treadExclusionZones,
        splitFrames
      },
      treads,
      supports,
      railStations,
      sections: {
        strategy: parameters.sections?.strategy || "none",
        splitFrames
      }
    },
    objectRoleHints: {
      stairAssembly: "stairAssembly",
      flightPattern: "flightPattern",
      treadPattern: "treadPattern",
      support: "support",
      railing: "railing",
      sections: "sections"
    },
    diagnostics: [
      ...distribution.diagnostics,
      ...moduleRouteDiagnostics(computed),
      ...diagnosticsForSpecialRoutes(computed),
      ...riseCalculationDiagnostics(computed),
      ...capabilityDiagnostics(parameters, computed),
      ...complianceDiagnostics
    ]
  });
}
