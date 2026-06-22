import { parameterFieldDescriptor, uiQuickParameterEntries } from "../../../../engine/api/model/smart-component-parameter-values.mjs";
import { smartComponentParameterTabs } from "../../smart-component-parameter-tabs.mjs";

const DEFAULT_QUICK_PARAMETER_LIMIT = 6;

export function smartComponentQuickParameterFields({
  api,
  smartComponent,
  definition,
  labelFor,
  catalogOptions,
  limit = DEFAULT_QUICK_PARAMETER_LIMIT
} = {}) {
  if (!smartComponent || !definition) return [];
  const parameters = smartComponent.referenceParameters || {};
  const uiDefinition = {
    ...definition,
    ui: {
      ...(definition.ui || {}),
      tabs: smartComponentParameterTabs(definition)
    }
  };
  return uiQuickParameterEntries(uiDefinition, parameters, { limit })
    .map(({ path }) => parameterFieldDescriptor(definition, parameters, path, {
      api,
      labelFor,
      catalogOptions: (spec, value) => spec.kind === "catalogRef" && typeof catalogOptions === "function"
        ? catalogOptions(spec.catalog, String(value || ""))
        : null,
      commit: { action: "smartComponent.parameter.set", smartComponentId: smartComponent.id }
    }))
    .filter(Boolean);
}
