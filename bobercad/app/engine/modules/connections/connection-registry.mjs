import { defineConnection } from "./connection-schema.mjs";

const definitions = new Map();
const presets = new Map();
let loaded = false;
let libraryUi = null;
const registerUrl = new URL("../../../../data/libraries/connections/connection-register.json", import.meta.url);

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

export function registerConnectionDefinition(definition) {
  if (definitions.has(definition.type)) throw new Error(`connection registry: duplicate definition ${definition.type}`);
  definitions.set(definition.type, definition);
  for (const preset of Object.values(definition.presets || {})) {
    if (presets.has(preset.id)) throw new Error(`connection registry: duplicate preset ${preset.id}`);
    presets.set(preset.id, { ...preset, type: definition.type });
  }
}

export function connectionCatalog() {
  return { connections: Object.fromEntries(presets), customUi: libraryUi };
}

export async function loadConnectionDefinitions() {
  if (loaded) return connectionCatalog();

  const register = await loadJson(registerUrl);
  if (typeof register.libraryUi !== "string") throw new Error("connection register missing libraryUi");
  libraryUi = await import(new URL(register.libraryUi, registerUrl).href);
  const nextDefinitions = await Promise.all((register.connections || []).map(async (connectionPath) => {
    if (typeof connectionPath !== "string") throw new Error("connection register entries must be folder paths");
    const base = new URL(connectionPath.endsWith("/") ? connectionPath : `${connectionPath}/`, registerUrl);
    const config = await loadJson(new URL("config.json", base));
    const buildModule = await import(new URL("build.mjs", base).href);
    const customUi = await import(new URL("ui.mjs", base).href);
    return defineConnection({ ...config, build: buildModule.build || buildModule.default, customUi });
  }));

  for (const definition of nextDefinitions) registerConnectionDefinition(definition);
  loaded = true;
  return connectionCatalog();
}

export function connectionDefinition(connectionCatalog, connection) {
  const preset = connectionCatalog.connections[connection.sourcePreset?.id];
  const type = preset?.type || connection.type;
  const definition = definitions.get(type);
  if (!definition) throw new Error(`connection registry: unsupported connection type ${type}`);
  return definition;
}

export function supportedConnections(project, connectionCatalog) {
  return Object.values(project.model.connections || {}).filter((connection) => {
    const preset = connectionCatalog.connections[connection.sourcePreset?.id];
    return definitions.has(preset?.type || connection.type);
  });
}

export function supportedConnectionPresets(connectionCatalog) {
  return Object.values(connectionCatalog.connections || {}).filter((preset) => definitions.has(preset.type));
}
