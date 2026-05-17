function gridEnvelope(pattern) {
  return {
    radius: pattern.holeDiameter / 2,
    maxY: Math.max(...pattern.positions.map((point) => Math.abs(point[0]))),
    maxZ: Math.max(...pattern.positions.map((point) => Math.abs(point[1])))
  };
}

function positiveHint(hint) {
  return hint?.path && typeof hint.value === "number" && Number.isFinite(hint.value) && hint.value > 0 ? hint : null;
}

function gridPlateResolve(diagnostic, envelope) {
  return [
    positiveHint({ path: diagnostic.widthParameter, mode: "min", value: 2 * (envelope.maxY + envelope.radius) + 1 }),
    positiveHint({ path: diagnostic.heightParameter, mode: "min", value: 2 * (envelope.maxZ + envelope.radius) + 1 })
  ].filter(Boolean);
}

function report(ctx, diagnostic) {
  ctx.error(diagnostic.code, diagnostic.message, {
    objectRoles: diagnostic.objectRoles,
    parameters: diagnostic.parameters,
    resolve: diagnostic.resolve
  });
}

export function createCheckApi(ctx) {
  return {
    requireMemberEnd(iface, message = "interface missing memberEnd") {
      if (!iface.memberEnd) ctx.fail(message);
    },

    gridFitsPlate(pattern, plateOrWidth, heightOrDiagnostic, maybeDiagnostic) {
      const diagnostic = maybeDiagnostic || heightOrDiagnostic;
      const envelope = gridEnvelope(pattern);
      const { radius, maxY, maxZ } = envelope;
      if (typeof plateOrWidth === "object" && Array.isArray(plateOrWidth.outline)) {
        const outsideOutline = pattern.positions.some((point) => !ctx.geometry.circleFitsPolygon(point, radius, plateOrWidth.outline));
        if (outsideOutline) report(ctx, { ...diagnostic, resolve: diagnostic.resolve || gridPlateResolve(diagnostic, envelope) });
        return;
      }
      const width = plateOrWidth;
      const height = heightOrDiagnostic;
      if (maxY + radius >= width / 2 || maxZ + radius >= height / 2) {
        report(ctx, { ...diagnostic, resolve: diagnostic.resolve || gridPlateResolve(diagnostic, envelope) });
      }
    },

    plateOutlineValid(outline, options) {
      const clean = ctx.geometry.cleanOutline(outline);
      if (clean.length < 3 || ctx.geometry.outlineArea(clean) <= 1e-6) report(ctx, options);
    },

    plateFitsInterface(iface, width, height, options) {
      const allowedLength = iface.extents?.length;
      const allowedHeight = iface.extents?.height;
      const offset = options.offset || 0;
      if (ctx.geometry.finitePositive(allowedLength) && offset + width > allowedLength) {
        report(ctx, {
          code: options.lengthCode,
          message: options.lengthMessage(offset + width - allowedLength),
          objectRoles: options.objectRoles,
          parameters: options.lengthParameters,
          resolve: [{
            path: options.lengthParameters?.[0],
            mode: "max",
            value: allowedLength - offset
          }]
        });
      }
      if (ctx.geometry.finitePositive(allowedHeight) && height > allowedHeight) {
        report(ctx, {
          code: options.heightCode,
          message: options.heightMessage(allowedHeight),
          objectRoles: options.objectRoles,
          parameters: options.heightParameters,
          resolve: [{
            path: options.heightParameters?.[0],
            mode: "max",
            value: allowedHeight
          }]
        });
      }
    },

    gridFitsInterface(pattern, iface, options) {
      const allowedLength = iface.extents?.length;
      const allowedHeight = iface.extents?.height;
      const { radius, maxY } = gridEnvelope(pattern);
      const centerStation = options.centerStation || 0;
      const outsideLength = ctx.geometry.finitePositive(allowedLength) && pattern.positions.some((point) => {
        const station = centerStation + point[0];
        return station - radius < 0 || station + radius > allowedLength;
      });
      const outsideHeight = ctx.geometry.finitePositive(allowedHeight) && pattern.positions.some((point) => Math.abs(point[1]) + radius >= allowedHeight / 2);
      if (outsideLength || outsideHeight) {
        const resolve = [
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
        ].filter(Boolean);
        report(ctx, { ...options, resolve: options.resolve || resolve });
      }
    },

    gridFitsCenteredInterface(pattern, iface, options) {
      const { radius, maxY, maxZ } = gridEnvelope(pattern);
      const outsideWidth = ctx.geometry.finitePositive(iface.extents?.width) && maxY + radius >= iface.extents.width / 2;
      const outsideHeight = ctx.geometry.finitePositive(iface.extents?.height) && maxZ + radius >= iface.extents.height / 2;
      if (outsideWidth || outsideHeight) report(ctx, options);
    },

    vectorsAligned(a, b, options) {
      const dot = ctx.geometry.v.dot(ctx.geometry.v.norm(a), ctx.geometry.v.norm(b));
      if (dot < (options.minDot ?? 0.5)) report(ctx, options);
    }
  };
}
