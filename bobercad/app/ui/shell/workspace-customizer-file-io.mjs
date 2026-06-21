import { exportWorkspacePreferences, writeWorkspacePreferences } from "./workspace-storage.mjs";
import { workspaceDateStamp, workspacePreferencePayload } from "./workspace-customizer-state.mjs";

export function saveToolbarWorkspace(workspace, options = {}) {
  writeWorkspacePreferences(workspacePreferencePayload(workspace, options));
}

export function downloadWorkspaceFile(payload = {}) {
  const blob = new Blob([exportWorkspacePreferences(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bobercad-workspace-${workspaceDateStamp()}.json`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function chooseWorkspaceFile(onImport, onError) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      input.remove();
      return;
    }
    try {
      onImport?.(JSON.parse(await file.text()));
    } catch (error) {
      onError?.(error);
    } finally {
      input.remove();
    }
  });
  document.body.append(input);
  input.click();
}
