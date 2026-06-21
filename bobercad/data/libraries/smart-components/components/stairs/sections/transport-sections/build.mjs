const SECTION_STRATEGIES = new Set(["max-weight", "manual-stations", "landings"]);

function flattenIds(value) {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function sourceOwnedIds(ctx, instance, componentId) {
  if (!Array.isArray(instance.ownedObjectIds)) {
    ctx.error("transport-section-source-invalid", `${componentId}: ownedObjectIds must be an array.`, {
      parameterPaths: ["sections.sourceComponentIds"]
    });
    return null;
  }
  if (!instance.objectRoles || typeof instance.objectRoles !== "object" || Array.isArray(instance.objectRoles)) {
    ctx.error("transport-section-source-invalid", `${componentId}: objectRoles must be an object.`, {
      parameterPaths: ["sections.sourceComponentIds"]
    });
    return null;
  }
  return unique([...instance.ownedObjectIds, ...flattenIds(instance.objectRoles)]);
}

function ownedIds(ctx, componentIds) {
  let missing = false;
  const ids = unique(componentIds.flatMap((id) => {
    const instance = ctx.componentInstance(id);
    if (instance) {
      const sourceIds = sourceOwnedIds(ctx, instance, id);
      if (sourceIds) return sourceIds;
      missing = true;
      return [];
    }
    ctx.error("transport-section-source-missing", `Transport section source component not found: ${id}.`, {
      parameterPaths: ["sections.sourceComponentIds"]
    });
    missing = true;
    return [];
  })).filter((id) => {
    const collection = ctx.objectCollection(id);
    return collection === "members" || collection === "plates";
  });
  if (!missing && !ids.length) {
    ctx.error("transport-section-source-empty", "Transport section source components did not resolve to members or plates.", {
      parameterPaths: ["sections.sourceComponentIds"]
    });
    return null;
  }
  return missing ? null : ids;
}

function requiredInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "transport-section-input-missing",
    message: `${label} is required to generate transport sections.`
  });
  if (value === undefined) return undefined;
  return value;
}

function requiredArrayInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (value === undefined) return null;
  if (Array.isArray(value)) return value;
  ctx.error("transport-section-input-invalid", `${label} must be an array.`, { parameterPaths: [path] });
  return null;
}

function requiredStringInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (value === undefined) return null;
  if (typeof value === "string" && value) return value;
  ctx.error("transport-section-input-invalid", `${label} must be a non-empty string.`, { parameterPaths: [path] });
  return null;
}

function requiredNumberInput(ctx, path, label) {
  const value = requiredInput(ctx, path, label);
  if (value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  ctx.error("transport-section-input-invalid", `${label} must be a finite number.`, { parameterPaths: [path] });
  return null;
}

export function build(ctx) {
  const sourceComponentIds = requiredArrayInput(ctx, "sections.sourceComponentIds", "Source component ids");
  const strategy = requiredStringInput(ctx, "sections.strategy", "Sectioning strategy");
  const maxWeightKg = requiredNumberInput(ctx, "sections.maxWeightKg", "Maximum transport section weight");
  const manualStations = requiredArrayInput(ctx, "sections.manualStations", "Manual split stations");
  const splitFrames = requiredArrayInput(ctx, "sections.splitFrames", "Transport split frames");
  if (!sourceComponentIds || !strategy || maxWeightKg === null || !manualStations || !splitFrames) return;
  const objectIds = ownedIds(ctx, sourceComponentIds);
  if (!objectIds) return;
  if (!SECTION_STRATEGIES.has(strategy)) {
    ctx.error("transport-section-strategy-invalid", `Unsupported transport section strategy: ${strategy}.`, {
      parameterPaths: ["sections.strategy"]
    });
    return;
  }
  const idPrefix = `${ctx.instanceId}_transport_section`;
  const sections = strategy === "max-weight"
    ? ctx.transportSections(objectIds, { strategy, maxWeightKg, idPrefix })
    : strategy === "manual-stations"
      ? ctx.transportSections(objectIds, { strategy, sectionCount: manualStations.length + 1, idPrefix, metadata: { strategy, manualStations } })
      : ctx.transportSections(objectIds, { strategy, sectionCount: Math.max(2, sourceComponentIds.length - 1), idPrefix, metadata: { strategy } });
  const schedule = ctx.transportSectionSchedule(sections);
  const assemblyIds = [];

  for (const [index, section] of sections.entries()) {
    const role = `transportSection${index + 1}`;
    ctx.generatedRole(role, `_transport_section_${index + 1}`);
    const memberIds = section.objectIds.filter((id) => ctx.objectCollection(id) === "members");
    const plateIds = section.objectIds.filter((id) => ctx.objectCollection(id) === "plates");
    const assembly = ctx.assembly.create(role, {
      type: "transport-section",
      name: `Transport section ${index + 1}`,
      memberIds,
      plateIds,
      partIds: [...memberIds, ...plateIds],
      objectIds: section.objectIds,
      weightKg: section.weightKg,
      bounds: section.bounds,
      section: { ...section.metadata, splitFrames },
      bim: { name: `Transport section ${index + 1}` }
    });
    assemblyIds.push(assembly.id);
  }

  ctx.objectPattern.create("sectionPattern", {
    type: "linear-pattern",
    generatedObjectIds: assemblyIds,
    transform: {
      kind: "transport-sections",
      strategy,
      maxWeightKg,
      schedule
    },
    notes: "Generated transport section schedule."
  });
  ctx.output("transportSectionAssemblyIds", assemblyIds);
  ctx.output("sourceObjectIds", objectIds);
  ctx.output("splitFrames", splitFrames);
  ctx.output("strategy", strategy);
}
