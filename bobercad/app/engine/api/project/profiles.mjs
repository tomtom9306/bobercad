function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`profiles api: ${label} must be an object`);
  }
  return value;
}

function requiredProfileMap(value, label) {
  return requiredObject(value, label);
}

function requiredProfileCatalog(profiles, label) {
  const source = requiredObject(profiles, label);
  return source.profiles === undefined ? requiredProfileMap(source, label) : requiredProfileMap(source.profiles, `${label}.profiles`);
}

function projectProfiles(project) {
  const model = requiredObject(requiredObject(project, "project").model, "project.model");
  if (model.profiles === undefined) return {};
  return requiredProfileMap(model.profiles, "project.model.profiles");
}

export function libraryProfileById(profiles, profileId) {
  if (typeof profileId !== "string" || !profileId.trim()) throw new Error("profiles api: profileId must be a non-empty string");
  return requiredProfileCatalog(profiles, "profiles")[profileId] || null;
}

export function projectProfileCatalog(project, profiles) {
  return { ...requiredProfileCatalog(profiles, "profiles"), ...projectProfiles(project) };
}

export function requiredProfileById(profiles, profileId, fail) {
  const profile = libraryProfileById(profiles, profileId);
  if (!profile) fail(`profile not found: ${profileId}`);
  return profile;
}
