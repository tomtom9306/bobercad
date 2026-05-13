import finPlate from "./definitions/fin-plate.mjs";
import momentEndPlate from "./definitions/moment-end-plate.mjs";

const definitions = new Map();

export function registerConnectionDefinition(definition) {
  if (definitions.has(definition.type)) throw new Error(`connection registry: duplicate definition ${definition.type}`);
  definitions.set(definition.type, definition);
}

export function connectionDefinition(connectionLibrary, connection) {
  const preset = connectionLibrary.connections[connection.sourcePreset?.id];
  const type = preset?.type || connection.type;
  const definition = definitions.get(type);
  if (!definition) throw new Error(`connection registry: unsupported connection type ${type}`);
  return definition;
}

export function supportedConnections(project, connectionLibrary) {
  return Object.values(project.model.connections || {}).filter((connection) => {
    const preset = connectionLibrary.connections[connection.sourcePreset?.id];
    return definitions.has(preset?.type || connection.type);
  });
}

export function supportedConnectionPresets(connectionLibrary) {
  return Object.values(connectionLibrary.connections || {}).filter((preset) => definitions.has(preset.type));
}

registerConnectionDefinition(finPlate);
registerConnectionDefinition(momentEndPlate);
