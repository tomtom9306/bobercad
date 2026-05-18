import { expandComponentConfig } from "./component-config-groups.mjs";

const components = new Map();
let loaded = false;
const registerUrl = new URL("../../../../data/libraries/connection-components/component-register.json", import.meta.url);

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

function defineConnectionComponent(definition) {
  if (!definition?.type) throw new Error("connection component: missing type");
  if (!definition.title) throw new Error(`${definition.type}: missing title`);
  if (!definition.version) throw new Error(`${definition.type}: missing version`);
  if (typeof definition.build !== "function") throw new Error(`${definition.type}: missing build(ctx, input)`);
  return Object.freeze({
    componentRefs: [],
    roles: {},
    components: [],
    parameters: {},
    dimensions: [],
    ui: { tabs: [] },
    ...definition
  });
}

export function registerConnectionComponent(definition) {
  if (components.has(definition.type)) throw new Error(`connection component registry: duplicate component ${definition.type}`);
  components.set(definition.type, definition);
}

export function connectionComponentCatalog() {
  return Object.fromEntries(components);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeRecord(scope, target = {}, source = {}) {
  const next = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (key in next && !sameJson(next[key], value)) throw new Error(`${scope}: duplicate ${key}`);
    next[key] = value;
  }
  return next;
}

function mergeUi(componentUi = { tabs: [] }, dependencyUi = { tabs: [] }) {
  const tabs = (componentUi.tabs || []).map((tab) => ({ ...tab, items: [...(tab.items || [])] }));
  for (const dependencyTab of dependencyUi.tabs || []) {
    const existing = tabs.find((tab) => tab.id === dependencyTab.id);
    if (existing) existing.items.push(...(dependencyTab.items || []));
    else tabs.push({ ...dependencyTab, items: [...(dependencyTab.items || [])] });
  }
  return { ...componentUi, tabs };
}

function componentType(ref) {
  if (typeof ref === "string") return ref;
  return ref?.component || ref?.type;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))];
}

function composeComponentDefinition(config, rawComponents, stack = []) {
  if (stack.includes(config.type)) throw new Error(`connection component registry: circular componentRefs ${[...stack, config.type].join(" -> ")}`);
  let next = { ...config };
  for (const ref of config.componentRefs || []) {
    const type = componentType(ref);
    const component = rawComponents.get(type);
    if (!component) throw new Error(`${config.type}: connection component not found: ${type}`);
    const dependency = composeComponentDefinition(component, rawComponents, [...stack, config.type]);
    next = {
      ...next,
      roles: mergeRecord(`${config.type}.${type}.roles`, next.roles, dependency.roles),
      parameters: mergeRecord(`${config.type}.${type}.parameters`, next.parameters, dependency.parameters),
      requiredPlateRoles: unique([...(next.requiredPlateRoles || []), ...(dependency.requiredPlateRoles || [])]),
      components: [...(next.components || []), ...(dependency.components || [])],
      dimensions: [...(next.dimensions || []), ...(dependency.dimensions || [])],
      ui: mergeUi(next.ui, dependency.ui)
    };
  }
  return next;
}

export async function loadConnectionComponents() {
  if (loaded) return connectionComponentCatalog();

  const register = await loadJson(registerUrl);
  const rawComponents = new Map();
  const nextComponents = await Promise.all((register.components || []).map(async (componentPath) => {
    if (typeof componentPath !== "string") throw new Error("connection component register entries must be folder paths");
    const base = new URL(componentPath.endsWith("/") ? componentPath : `${componentPath}/`, registerUrl);
    const config = await loadJson(new URL("config.json", base));
    const buildModule = await import(new URL("build.mjs", base).href);
    return { ...expandComponentConfig(config), build: buildModule.build || buildModule.default };
  }));

  for (const definition of nextComponents) {
    if (rawComponents.has(definition.type)) throw new Error(`connection component registry: duplicate component ${definition.type}`);
    rawComponents.set(definition.type, definition);
  }
  for (const definition of nextComponents) registerConnectionComponent(defineConnectionComponent(composeComponentDefinition(definition, rawComponents)));
  loaded = true;
  return connectionComponentCatalog();
}
