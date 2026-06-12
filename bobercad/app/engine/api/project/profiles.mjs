export function libraryProfileById(profiles, profileId) {
  return (profiles?.profiles || profiles || {})[profileId] || null;
}

export function projectProfileCatalog(project, profiles) {
  return { ...(profiles?.profiles || profiles || {}), ...(project?.model?.profiles || {}) };
}

export function requiredProfileById(profiles, profileId, fail) {
  const profile = libraryProfileById(profiles, profileId);
  if (!profile) fail(`profile not found: ${profileId}`);
  return profile;
}
