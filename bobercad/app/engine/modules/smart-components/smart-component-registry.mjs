import { defineSmartComponent } from "./smart-component-parameters-and-definition.mjs";
import { buildSmartComponentRecipe } from "./smart-component-recipe.mjs";
import { registerConnectionPrimitiveOperations } from "../../api/model/connection-primitive-manifest.mjs";

const definitions = new Map();
const presets = new Map();
let loaded = false;
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

function registryObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`smart component registry: ${label} must be an object`);
  return value;
}

function registryString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`smart component registry: ${label} must be a non-empty string`);
  return value;
}

function registryArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`smart component registry: ${label} must be an array`);
  return value;
}

function catalogPresets(catalog) {
  return registryObject(registryObject(catalog, "catalog").smartComponents, "catalog.smartComponents");
}

function catalogDefinitions(catalog) {
  return registryObject(registryObject(catalog, "catalog").definitions, "catalog.definitions");
}

function filterKind(options = {}) {
  registryObject(options, "options");
  if (options.kind === undefined) return null;
  return registryString(options.kind, "options.kind");
}

function registerSmartComponentDefinition(definition) {
  if (definitions.has(definition.type)) throw new Error(`smart component registry: duplicate definition ${definition.type}`);
  definitions.set(definition.type, definition);
  const definitionPresets = Object.values(registryObject(definition.presets, `${definition.type}.presets`));
  if (!definitionPresets.length) throw new Error(`smart component registry: ${definition.type}.presets must not be empty`);
  for (const preset of definitionPresets) {
    registryObject(preset, `${definition.type}.preset`);
    const presetId = registryString(preset.id, `${definition.type}.preset.id`);
    if (presets.has(presetId)) throw new Error(`smart component registry: duplicate preset ${presetId}`);
    presets.set(presetId, { ...preset, type: definition.type, kind: definition.kind });
  }
}

export function smartComponentCatalog() {
  return { smartComponents: Object.fromEntries(presets), definitions: Object.fromEntries(definitions) };
}

export async function loadSmartComponentDefinitions() {
  if (loaded) return smartComponentCatalog();

  registerConnectionPrimitiveOperations();
  const register = registryObject(await loadJson(registerUrl), "register");
  const nextDefinitions = await Promise.all(registryArray(register.components, "register.components").map(async (componentPath) => {
    registryString(componentPath, "register.components entry");
    const base = new URL(componentPath.endsWith("/") ? componentPath : `${componentPath}/`, registerUrl);
    const config = await loadJson(new URL("config.json", base));
    if (!config.kind) throw new Error(`${config.type}: missing kind`);
    const build = Array.isArray(config.recipe) && config.recipe.length
      ? buildSmartComponentRecipe(config.recipe)
      : (await import(new URL("build.mjs", base).href)).build;
    if (typeof build !== "function") throw new Error(`${config.type}: missing recipe or build.mjs`);
    return defineSmartComponent({
      ...config,
      build
    });
  }));

  for (const definition of nextDefinitions) registerSmartComponentDefinition(definition);
  loaded = true;
  return smartComponentCatalog();
}

function sourceComponentId(instance) {
  instance = registryObject(instance, "smart component instance");
  const sourceComponent = registryObject(instance.sourceComponent, `${instance.id || "smart component"}.sourceComponent`);
  return registryString(sourceComponent.id, `${instance.id || "smart component"}.sourceComponent.id`);
}

function definitionForPreset(catalogDefinitionMap, preset) {
  const definition = catalogDefinitionMap[preset.type];
  if (!definition) throw new Error(`smart component registry: unsupported component type ${preset.type}`);
  return definition;
}

export function smartComponentDefinition(catalog, instance) {
  const presetId = sourceComponentId(instance);
  const preset = catalogPresets(catalog)[presetId];
  if (!preset) throw new Error(`smart component registry: preset not found: ${presetId}`);
  return definitionForPreset(catalogDefinitions(catalog), preset);
}

export function supportedSmartComponents(project, catalog, options = {}) {
  const kind = filterKind(options);
  const instances = registryObject(registryObject(project, "project").model, "project.model").smartComponentInstances;
  const presetsById = catalogPresets(catalog);
  const definitionMap = catalogDefinitions(catalog);
  return Object.values(registryObject(instances, "project.model.smartComponentInstances")).filter((instance) => {
    const presetId = sourceComponentId(instance);
    const preset = presetsById[presetId];
    if (!preset) throw new Error(`smart component registry: preset not found: ${presetId}`);
    const definition = definitionForPreset(definitionMap, preset);
    return !kind || definition.kind === kind;
  });
}

export function supportedSmartComponentPresets(catalog, options = {}) {
  const kind = filterKind(options);
  const definitionMap = catalogDefinitions(catalog);
  return Object.values(catalogPresets(catalog)).filter((preset) => {
    definitionForPreset(definitionMap, preset);
    return !kind || preset.kind === kind;
  });
}
