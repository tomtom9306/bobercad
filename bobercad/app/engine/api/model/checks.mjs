import { finiteNumber, finitePositiveNumber } from "../../core/math.mjs";
import { uniqueTruthy } from "../../core/model.mjs";

function gridEnvelope(ctx, pattern) {
  requiredOptions(ctx, pattern, "hole pattern");
  if (!finitePositiveNumber(pattern.holeDiameter)) ctx.fail(`${pattern.id || "hole pattern"}.holeDiameter must be a positive number`);
  if (!Array.isArray(pattern.positions) || !pattern.positions.length) ctx.fail(`${pattern.id || "hole pattern"}.positions must be a non-empty array`);
  for (const [index, point] of pattern.positions.entries()) {
    if (!Array.isArray(point) || point.length !== 2 || point.some((value) => !finiteNumber(value))) {
      ctx.fail(`${pattern.id || "hole pattern"}.positions[${index}] must be a finite [y, z] point`);
    }
  }
  return {
    radius: pattern.holeDiameter / 2,
    maxY: Math.max(...pattern.positions.map((point) => Math.abs(point[0]))),
    maxZ: Math.max(...pattern.positions.map((point) => Math.abs(point[1])))
  };
}

function positiveHint(hint) {
  return hint?.path && finitePositiveNumber(hint.value) ? hint : null;
}

function gridPlateResolve(diagnostic, envelope) {
  return uniqueTruthy([
    positiveHint({ path: diagnostic.widthParameter, mode: "min", value: 2 * (envelope.maxY + envelope.radius) + 1 }),
    positiveHint({ path: diagnostic.heightParameter, mode: "min", value: 2 * (envelope.maxZ + envelope.radius) + 1 })
  ]);
}

function requiredOptions(ctx, value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) ctx.fail(`${label} must be an object`);
  return value;
}

function optionalStringArray(ctx, value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) ctx.fail(`${label} must be an array of non-empty strings`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) ctx.fail(`${label} must be an array of non-empty strings`);
    if (seen.has(item)) ctx.fail(`${label} contains duplicate value: ${item}`);
    seen.add(item);
  }
  return value;
}

function optionalResolve(ctx, value, label) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) ctx.fail(`${label} must be an array`);
  return value;
}

function report(ctx, diagnostic) {
  const next = requiredOptions(ctx, diagnostic, "check diagnostic");
  if (typeof next.code !== "string" || !next.code.trim()) ctx.fail("check diagnostic code must be a non-empty string");
  if (typeof next.message !== "string" || !next.message.trim()) ctx.fail(`${next.code}: check diagnostic message must be a non-empty string`);
  if (next.parameters !== undefined) ctx.fail(`${next.code}.parameters is not supported; use parameterPaths`);
  ctx.error(next.code, next.message, {
    objectRoles: optionalStringArray(ctx, next.objectRoles, `${next.code}.objectRoles`),
    parameterPaths: optionalStringArray(ctx, next.parameterPaths, `${next.code}.parameterPaths`),
    resolve: optionalResolve(ctx, next.resolve, `${next.code}.resolve`)
  });
}

function requiredOptionNumber(ctx, options, key) {
  const value = requiredOptions(ctx, options, "check options")[key];
  if (value === undefined) ctx.fail(`check options.${key} is required`);
  if (!finiteNumber(value)) ctx.fail(`${key} must be a finite number`);
  return value;
}

function requiredPositive(ctx, value, label) {
  if (!finitePositiveNumber(value)) ctx.fail(`${label} must be a positive number`);
  return value;
}

function requiredDirection(ctx, value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !finiteNumber(item))) {
    ctx.fail(`${label} must be a finite [x, y, z] vector`);
  }
  const length = ctx.geometry.v.len(value);
  if (length <= 1e-9) ctx.fail(`${label} cannot be zero length`);
  return ctx.geometry.v.mul(value, 1 / length);
}

function gridPlateReport(ctx, diagnostic, envelope) {
  report(ctx, { ...diagnostic, resolve: diagnostic.resolve === undefined ? gridPlateResolve(diagnostic, envelope) : diagnostic.resolve });
}

export function createCheckApi(ctx) {
  return {
    requireMemberEnd(iface, message = "interface missing memberEnd") {
      if (iface.memberEnd !== "start" && iface.memberEnd !== "end") ctx.fail(message);
    },

    gridFitsPlate(pattern, plate, diagnostic) {
      requiredOptions(ctx, diagnostic, "gridFitsPlate diagnostic");
      const envelope = gridEnvelope(ctx, pattern);
      const { radius } = envelope;
      const outline = ctx.geometry.plateOutline(requiredOptions(ctx, plate, "gridFitsPlate plate"));
      const outsideOutline = pattern.positions.some((point) => !ctx.geometry.circleFitsPolygon(point, radius, outline));
      if (outsideOutline) gridPlateReport(ctx, diagnostic, envelope);
    },

    gridFitsRectangularPlate(pattern, width, height, diagnostic) {
      requiredOptions(ctx, diagnostic, "gridFitsRectangularPlate diagnostic");
      const envelope = gridEnvelope(ctx, pattern);
      const { radius, maxY, maxZ } = envelope;
      requiredPositive(ctx, width, "gridFitsRectangularPlate width");
      requiredPositive(ctx, height, "gridFitsRectangularPlate height");
      if (maxY + radius >= width / 2 || maxZ + radius >= height / 2) {
        gridPlateReport(ctx, diagnostic, envelope);
      }
    },

    plateOutlineValid(outline, options) {
      const clean = ctx.geometry.cleanOutline(outline);
      if (clean.length < 3 || ctx.geometry.outlineArea(clean) <= 1e-6) report(ctx, options);
    },

    plateFitsInterface(iface, width, height, options) {
      const extents = requiredOptions(ctx, requiredOptions(ctx, iface, "interface").extents, "interface.extents");
      const allowedLength = requiredPositive(ctx, extents.length, "interface.extents.length");
      const allowedHeight = requiredPositive(ctx, extents.height, "interface.extents.height");
      requiredPositive(ctx, width, "plateFitsInterface width");
      requiredPositive(ctx, height, "plateFitsInterface height");
      const offset = requiredOptionNumber(ctx, options, "offset");
      if (offset + width > allowedLength) {
        report(ctx, {
          code: options.lengthCode,
          message: options.lengthMessage(offset + width - allowedLength),
          objectRoles: options.objectRoles,
          parameterPaths: options.lengthParameters,
          resolve: [{
            path: options.lengthParameters?.[0],
            mode: "max",
            value: allowedLength - offset
          }]
        });
      }
      if (height > allowedHeight) {
        report(ctx, {
          code: options.heightCode,
          message: options.heightMessage(allowedHeight),
          objectRoles: options.objectRoles,
          parameterPaths: options.heightParameters,
          resolve: [{
            path: options.heightParameters?.[0],
            mode: "max",
            value: allowedHeight
          }]
        });
      }
    },

    gridFitsInterface(pattern, iface, options) {
      const extents = requiredOptions(ctx, requiredOptions(ctx, iface, "interface").extents, "interface.extents");
      const allowedLength = requiredPositive(ctx, extents.length, "interface.extents.length");
      const allowedHeight = requiredPositive(ctx, extents.height, "interface.extents.height");
      const { radius, maxY } = gridEnvelope(ctx, pattern);
      const centerStation = requiredOptionNumber(ctx, options, "centerStation");
      const outsideLength = pattern.positions.some((point) => {
        const station = centerStation + point[0];
        return station - radius < 0 || station + radius > allowedLength;
      });
      const outsideHeight = pattern.positions.some((point) => Math.abs(point[1]) + radius >= allowedHeight / 2);
      if (outsideLength || outsideHeight) {
        const resolve = uniqueTruthy([
          outsideLength && positiveHint({
            path: options.centerParameter,
            mode: "max",
            value: 2 * (allowedLength - maxY - radius) - 1
          }),
          outsideHeight && positiveHint({
            path: options.pitchParameter,
            mode: "max",
            value: options.pitchDivisions > 0 ? (allowedHeight - 2 * radius - 1) / options.pitchDivisions : null
          })
        ]);
        report(ctx, { ...options, resolve: options.resolve === undefined ? resolve : options.resolve });
      }
    },

    gridFitsCenteredInterface(pattern, iface, options) {
      const extents = requiredOptions(ctx, requiredOptions(ctx, iface, "interface").extents, "interface.extents");
      const width = requiredPositive(ctx, extents.width, "interface.extents.width");
      const height = requiredPositive(ctx, extents.height, "interface.extents.height");
      const { radius, maxY, maxZ } = gridEnvelope(ctx, pattern);
      const outsideWidth = maxY + radius >= width / 2;
      const outsideHeight = maxZ + radius >= height / 2;
      if (outsideWidth || outsideHeight) report(ctx, options);
    },

    vectorsAligned(a, b, options) {
      const dot = ctx.geometry.v.dot(requiredDirection(ctx, a, "alignment vector a"), requiredDirection(ctx, b, "alignment vector b"));
      if (dot < requiredOptionNumber(ctx, options, "minDot")) report(ctx, options);
    }
  };
}
