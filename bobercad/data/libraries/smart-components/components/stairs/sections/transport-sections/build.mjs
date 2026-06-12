import { uniqueTruthy as unique } from "../../../../../../../app/engine/core/model.mjs?v=unique-dry-1";
import { createSection, estimateObjects, splitByMaxWeight, sectionSchedule } from "../../../../../../../app/engine/api/model/sectioning.mjs";

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function ownedIds(project, componentIds = []) {
  return unique(componentIds.flatMap((id) => {
    const instance = project.model?.smartComponentInstances?.[id];
    return instance ? unique([...(instance.ownedObjectIds || []), ...flattenIds(instance.objectRoles || {})]) : [];
  })).filter((id) => {
    const collection = project.objectIndex?.[id]?.collection;
    return ["members", "plates", "fastenerGroups", "welds", "trimJoints"].includes(collection);
  });
}

function requiredInput(ctx, path, label) {
  const value = ctx.requiredInput(path, {
    code: "transport-section-input-missing",
    message: `${label} is required to generate transport sections.`
  });
  if (value === undefined) return undefined;
  return value;
}

function splitByCount(project, libraries, objectIds, sectionCount, idPrefix, metadata = {}) {
  const estimates = estimateObjects(project, libraries, objectIds);
  const count = Math.max(1, Math.min(sectionCount, estimates.length || 1));
  const sections = [];
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(estimates.length * index / count);
    const end = Math.floor(estimates.length * (index + 1) / count);
    sections.push(createSection(`${idPrefix}_${index + 1}`, estimates.slice(start, end), metadata));
  }
  return sections.filter((section) => section.objectIds.length);
}

export function build(ctx) {
  const sourceComponentIds = requiredInput(ctx, "sections.sourceComponentIds", "Source component ids") || [];
  const objectIds = ownedIds(ctx.project, sourceComponentIds);
  const strategy = requiredInput(ctx, "sections.strategy", "Sectioning strategy");
  const maxWeightKg = requiredInput(ctx, "sections.maxWeightKg", "Maximum transport section weight");
  const manualStations = requiredInput(ctx, "sections.manualStations", "Manual split stations") || [];
  const splitFrames = ctx.input("sections.splitFrames") || [];
  const libraries = { profiles: ctx.profiles };
  const idPrefix = `${ctx.instanceId}_transport_section`;
  if (!Array.isArray(sourceComponentIds) || !strategy || typeof maxWeightKg !== "number" || !Array.isArray(manualStations)) return;
  const sections = strategy === "max-weight"
    ? splitByMaxWeight(ctx.project, libraries, objectIds, { maxWeightKg, idPrefix })
    : strategy === "manual-stations"
      ? splitByCount(ctx.project, libraries, objectIds, (manualStations || []).length + 1, idPrefix, { strategy, manualStations })
      : strategy === "landings"
        ? splitByCount(ctx.project, libraries, objectIds, Math.max(2, sourceComponentIds.length - 1), idPrefix, { strategy })
        : objectIds.length ? splitByCount(ctx.project, libraries, objectIds, 1, idPrefix, { strategy }) : [];
  const schedule = sectionSchedule(sections);
  const assemblyIds = [];

  for (const [index, section] of sections.entries()) {
    const role = `transportSection${index + 1}`;
    ctx.generatedRole(role, `_transport_section_${index + 1}`);
    const memberIds = section.objectIds.filter((id) => ctx.project.objectIndex?.[id]?.collection === "members");
    const plateIds = section.objectIds.filter((id) => ctx.project.objectIndex?.[id]?.collection === "plates");
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
