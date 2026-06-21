export const WORKSPACE_STORAGE_KEY = "bobercad.ui.workspace.v1";
export const WORKSPACE_SCHEMA = "bobercad-ui-workspace";
export const CURRENT_WORKSPACE_SCHEMA_VERSION = "0.2.0";
export const WORKSPACE_SCHEMA_REF = "../../schemas/ui-workspace.schema.json";
export const WORKSPACE_SECTIONS_RESET_EVENT = "bobercad:workspace-sections-reset";

export function readWorkspacePreferences() {
  try {
    const raw = window.localStorage?.getItem?.(WORKSPACE_STORAGE_KEY);
    return raw ? migrateWorkspacePreferences(JSON.parse(raw)) : {};
  } catch (error) {
    console.warn(`Workspace preferences could not be read: ${error?.message || String(error)}`);
    return {};
  }
}

export function writeWorkspacePreferences(preferences = {}) {
  try {
    window.localStorage?.setItem?.(WORKSPACE_STORAGE_KEY, JSON.stringify(migrateWorkspacePreferences(preferences)));
  } catch (error) {
    console.warn(`Workspace preferences could not be saved: ${error?.message || String(error)}`);
  }
}

export function migrateWorkspacePreferences(preferences = {}) {
  const source = objectMap(preferences);
  if (!Object.keys(source).length) return {};
  assertWorkspaceSchemaCompatible(source);
  const migrated = {
    ...source,
    $schema: WORKSPACE_SCHEMA_REF,
    schema: WORKSPACE_SCHEMA,
    schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION
  };
  if (!objectMap(source.toolbars).modeling && hasLegacyModelingToolbar(source)) {
    const legacyToolbar = legacyModelingToolbar(source);
    migrated.toolbars = {
      ...objectMap(source.toolbars),
      modeling: toolbarPreferenceFields(legacyToolbar)
    };
    for (const key of ["theme", "density", "navigation", "bottomStrip", "viewerSettingsStrip", "viewerOverlays", "panels", "sections"]) {
      if (!(key in migrated) && key in legacyToolbar) migrated[key] = legacyToolbar[key];
    }
  }
  if (hasLegacyModelingToolbar(source)) {
    delete migrated.commandIds;
    delete migrated.hiddenCommandIds;
    delete migrated.groupIds;
    delete migrated.collapsedGroups;
    delete migrated.dock;
    delete migrated.modeling;
  }
  return migrated;
}

export function importWorkspacePreferences(preferences = {}) {
  const source = objectMap(preferences);
  if (!Object.keys(source).length) throw new Error("Workspace import must be a workspace JSON object.");
  if (!isCurrentWorkspacePayload(source) && !hasLegacyModelingToolbar(source)) {
    throw new Error("Workspace import must use the Bobercad workspace schema or a legacy toolbar workspace shape.");
  }
  return migrateWorkspacePreferences(source);
}

export function workspacePreferencesEnvelope({
  theme,
  density,
  toolbars,
  navigation,
  bottomStrip,
  viewerSettingsStrip,
  viewerOverlays,
  panels,
  sections
} = {}) {
  return migrateWorkspacePreferences({
    $schema: WORKSPACE_SCHEMA_REF,
    schema: WORKSPACE_SCHEMA,
    schemaVersion: CURRENT_WORKSPACE_SCHEMA_VERSION,
    theme,
    density,
    toolbars: objectMap(toolbars),
    navigation: objectMap(navigation),
    bottomStrip: objectMap(bottomStrip),
    viewerSettingsStrip: objectMap(viewerSettingsStrip),
    viewerOverlays: objectMap(viewerOverlays),
    panels: objectMap(panels),
    sections: objectMap(sections)
  });
}

export function exportWorkspacePreferences(preferences = readWorkspacePreferences()) {
  return JSON.stringify(migrateWorkspacePreferences(preferences), null, 2);
}

export function workspaceSectionStates() {
  const sections = readWorkspacePreferences()?.sections;
  return sections && typeof sections === "object" && !Array.isArray(sections) ? sections : {};
}

export function workspaceSectionOpen(sectionId) {
  if (!validSectionId(sectionId)) return null;
  const state = workspaceSectionStates()[sectionId];
  return typeof state?.open === "boolean" ? state.open : null;
}

export function setWorkspaceSectionOpen(sectionId, open) {
  if (!validSectionId(sectionId)) return;
  const preferences = readWorkspacePreferences();
  const sections = preferences.sections && typeof preferences.sections === "object" && !Array.isArray(preferences.sections)
    ? preferences.sections
    : {};
  writeWorkspacePreferences({
    ...preferences,
    sections: {
      ...sections,
      [sectionId]: { open: Boolean(open) }
    }
  });
}

export function resetWorkspaceSectionStates() {
  const preferences = readWorkspacePreferences();
  writeWorkspacePreferences({
    ...preferences,
    sections: {}
  });
  window.dispatchEvent?.(new CustomEvent(WORKSPACE_SECTIONS_RESET_EVENT));
}

function validSectionId(sectionId) {
  return typeof sectionId === "string" && /^[a-z][A-Za-z0-9.-]*$/.test(sectionId);
}

function hasLegacyModelingToolbar(value = {}) {
  return Array.isArray(value.commandIds)
    || Array.isArray(value.hiddenCommandIds)
    || Array.isArray(value.groupIds)
    || Array.isArray(value.collapsedGroups)
    || typeof value.dock === "string"
    || (value.modeling && objectMap(value.modeling) === value.modeling);
}

function legacyModelingToolbar(value = {}) {
  return objectMap(value.modeling) === value.modeling ? value.modeling : value;
}

function toolbarPreferenceFields(value = {}) {
  return {
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.dock === "string" ? { dock: value.dock } : {}),
    ...(Array.isArray(value.commandIds) ? { commandIds: value.commandIds } : {}),
    ...(Array.isArray(value.hiddenCommandIds) ? { hiddenCommandIds: value.hiddenCommandIds } : {}),
    ...(Array.isArray(value.groupIds) ? { groupIds: value.groupIds } : {}),
    ...(Array.isArray(value.collapsedGroups) ? { collapsedGroups: value.collapsedGroups } : {})
  };
}

function assertWorkspaceSchemaCompatible(value = {}) {
  if (value.schema && value.schema !== WORKSPACE_SCHEMA) {
    throw new Error(`Unsupported workspace schema: ${value.schema}`);
  }
  if (value.schemaVersion && value.schemaVersion !== CURRENT_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Unsupported workspace schemaVersion: ${value.schemaVersion}`);
  }
}

function isCurrentWorkspacePayload(value = {}) {
  assertWorkspaceSchemaCompatible(value);
  return value.schema === WORKSPACE_SCHEMA
    && value.schemaVersion === CURRENT_WORKSPACE_SCHEMA_VERSION
    && typeof value.theme === "string"
    && typeof value.density === "string"
    && objectMap(value.navigation) === value.navigation
    && objectMap(value.toolbars).modeling
    && objectMap(value.bottomStrip) === value.bottomStrip
    && objectMap(value.viewerSettingsStrip) === value.viewerSettingsStrip
    && objectMap(value.viewerOverlays) === value.viewerOverlays
    && objectMap(value.panels) === value.panels;
}

function objectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
