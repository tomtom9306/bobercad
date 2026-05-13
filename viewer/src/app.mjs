import { buildScene } from "./scene/build-scene.mjs?v=weld-fitting-1";
import { createWebglViewer } from "./render/webgl-renderer.mjs?v=weld-fitting-1";
import { createProjectStore } from "./project/project-store.mjs?v=weld-fitting-1";
import { createSelectionController } from "./selection/selection-controller.mjs?v=weld-fitting-1";
import { mountEditorUi } from "./editor/editor-ui.mjs?v=weld-fitting-1";
import { mountConnectionCreator } from "./connections/creator-ui.mjs?v=weld-fitting-1";
import { mountConnectionUi } from "./connections/ui-renderer.mjs?v=weld-fitting-1";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const objectEditor = document.getElementById("object-editor");
const connectionCommand = document.getElementById("connection-command");
const connectionPanel = document.getElementById("connection-panel");
const settingsUrl = new URL("../viewer_settings.json", import.meta.url);
let settings = null;
let viewer = null;

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function applyUiSettings(project) {
  hud.hidden = !settings.ui.showHud;
  meta.hidden = !settings.ui.showMeta;
  reset.hidden = !settings.ui.showResetButton;
  title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function projectPath() {
  const demo = new URLSearchParams(window.location.search).get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  meta.textContent = `${Object.keys(project.model.members).length} members\n${Object.keys(project.model.plates).length} plates\n${Object.keys(project.model.fastenerGroups).length} fastener groups`;
}

function renderProject(project, profiles, fasteners, options = {}) {
  viewer.setScene(buildScene(project, profiles, fasteners, settings), options);
  updateMeta(project);
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const connectionsUrl = new URL(project.libraries.connections.path, projectUrl);
    const [profiles, fasteners, connectionLibrary] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadJson(connectionsUrl)]);

    viewer = createWebglViewer(canvas, reset, settings);
    applyUiSettings(project);

    const api = createProjectStore({ project, profiles: profiles.profiles, connectionLibrary, fasteners });
    const selection = createSelectionController({ viewer });
    const rerender = (nextProject) => renderProject(nextProject, profiles, fasteners, { preserveCamera: true });
    const showConnectionEditor = (connectionId) => {
      mountConnectionUi({
        panel: connectionPanel,
        connectionId,
        api,
        onProjectChange: rerender,
        onConnectionDeleted: () => {
          connectionPanel.hidden = true;
          selection.clear();
        }
      });
    };

    renderProject(api.project(), profiles, fasteners);
    mountConnectionCreator({
      panel: connectionCommand,
      api,
      selection,
      onProjectChange: rerender,
      onConnectionCreated: showConnectionEditor
    });
    mountEditorUi({
      panel: objectEditor,
      api,
      profiles: profiles.profiles,
      selection,
      onProjectChange: rerender,
      onConnectionSelected: showConnectionEditor,
      onConnectionDeleted: () => {
        connectionPanel.hidden = true;
      }
    });

    const connection = api.supportedConnections()[0];
    if (connection) {
      showConnectionEditor(connection.id);
    } else {
      connectionPanel.hidden = true;
    }

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", () => viewer?.resize());
main();
