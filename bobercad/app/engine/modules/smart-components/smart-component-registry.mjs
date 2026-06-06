import { defineSmartComponent } from "./parameters.mjs?v=stair-route-ui-fit-2";
import { buildSmartComponentRecipe } from "./smart-component-recipe.mjs";
import { mountParameterSmartComponentUi } from "../../../../data/libraries/smart-components/smart-component-ui.mjs?v=stair-geometry-readouts-1";

const definitions = new Map();
const presets = new Map();
let loaded = false;
let libraryUi = null;
const registerUrl = new URL("../../../../data/libraries/smart-components/smart-component-register.json", import.meta.url);

async function loadJson(url) {
  if (url.protocol === "file:") {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url")
    ]);
    return JSON.parse(await readFile(fileURLToPath(url), "utf8"));
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function moduleImportUrl(url) {
  const next = new URL(url.href);
  if (typeof globalThis.location !== "undefined") {
    next.searchParams.set("v", Date.now().toString(36));
  }
  return next.href;
}

export function registerSmartComponentDefinition(definition) {
  if (definitions.has(definition.type)) throw new Error(`smart component registry: duplicate definition ${definition.type}`);
  definitions.set(definition.type, definition);
  for (const preset of Object.values(definition.presets || {})) {
    if (presets.has(preset.id)) throw new Error(`smart component registry: duplicate preset ${preset.id}`);
    presets.set(preset.id, { ...preset, type: definition.type, kind: definition.kind });
  }
}

export function smartComponentCatalog() {
  return { smartComponents: Object.fromEntries(presets), definitions: Object.fromEntries(definitions), customUi: libraryUi };
}

export async function loadSmartComponentDefinitions() {
  if (loaded) return smartComponentCatalog();

  const register = await loadJson(registerUrl);
  if (typeof register.libraryUi !== "string") throw new Error("smart component register missing libraryUi");
  libraryUi = await import(new URL(register.libraryUi, registerUrl).href);
  const nextDefinitions = await Promise.all((register.components || []).map(async (componentPath) => {
    if (typeof componentPath !== "string") throw new Error("smart component register entries must be folder paths");
    const base = new URL(componentPath.endsWith("/") ? componentPath : `${componentPath}/`, registerUrl);
    const config = await loadJson(new URL("config.json", base));
    if (!config.kind) throw new Error(`${config.type}: missing kind`);
    let build = Array.isArray(config.recipe) && config.recipe.length ? buildSmartComponentRecipe(config.recipe) : null;
    if (!build) {
      try {
        const buildModule = await import(moduleImportUrl(new URL("build.mjs", base)));
        build = buildModule.build || buildModule.default || build;
      } catch (error) {
        const message = String(error.message || "");
        if (!message.includes("Cannot find module") && !message.includes("404") && !message.includes("Failed to fetch dynamically imported module")) throw error;
      }
    }
    if (typeof build !== "function") throw new Error(`${config.type}: missing recipe or build.mjs`);
    return defineSmartComponent({
      ...config,
      build,
      customUi: { mountSmartComponentUi: mountParameterSmartComponentUi }
    });
  }));

  for (const definition of nextDefinitions) registerSmartComponentDefinition(definition);
  loaded = true;
  return smartComponentCatalog();
}

export function smartComponentDefinition(catalog, instance) {
  const preset = catalog.smartComponents?.[instance.sourceComponent?.id];
  const type = preset?.type || instance.type;
  const definition = definitions.get(type) || catalog.definitions?.[type];
  if (!definition) throw new Error(`smart component registry: unsupported component type ${type}`);
  return definition;
}

export function supportedSmartComponents(project, catalog, options = {}) {
  return Object.values(project.model.smartComponentInstances || {}).filter((instance) => {
    const preset = catalog.smartComponents?.[instance.sourceComponent?.id];
    const definition = definitions.get(preset?.type || instance.type) || catalog.definitions?.[preset?.type || instance.type];
    if (!definition) return false;
    return !options.kind || definition.kind === options.kind || instance.kind === options.kind;
  });
}

export function supportedSmartComponentPresets(catalog, options = {}) {
  return Object.values(catalog.smartComponents || {}).filter((preset) => (
    (definitions.has(preset.type) || catalog.definitions?.[preset.type]) && (!options.kind || preset.kind === options.kind)
  ));
}
