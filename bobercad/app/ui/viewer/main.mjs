import { createProjectStore } from "../../engine/store/project-store.mjs";
import { loadConnectionDefinitions } from "../../engine/modules/connections/connection-registry.mjs";
import { buildScene } from "../../rendering/scene/build-scene.mjs";
import { createCommandController } from "../../rendering/interaction/command-controller.mjs";
import { createMemberEditController } from "../../rendering/interaction/member-edit-controller.mjs";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs";
import { createWebglViewer } from "../../rendering/webgl/webgl-renderer.mjs";
import { createDimensionEditController } from "./dimensions/dimension-edit-controller.mjs";
import { mountEditorUi } from "./panels/property-panel.mjs";
import { mountModelingToolbar } from "./toolbar/modeling-toolbar.mjs";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const modelingToolbar = document.getElementById("modeling-toolbar");
const modelingStatus = document.getElementById("modeling-status");
const objectEditor = document.getElementById("object-editor");
const libraryPanel = document.getElementById("library-panel");
const customPanel = document.getElementById("custom-panel");
const settingsUrl = new URL("./viewer-settings.json", import.meta.url);
let settings = null;
let viewer = null;
let authoringPreview = [];

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
  const { activeConnectionId = null, previewMembers = authoringPreview, ...viewerOptions } = options;
  viewer.setScene(buildScene(project, profiles, fasteners, settings, { activeConnectionId, previewMembers }), viewerOptions);
  updateMeta(project);
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const [profiles, fasteners, connectionCatalog] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadConnectionDefinitions()]);

    viewer = createWebglViewer(canvas, reset, settings);
    applyUiSettings(project);

    const api = createProjectStore({ project, profiles: profiles.profiles, connectionCatalog, fasteners });
    const selection = createSelectionController({ viewer });
    let commandController = null;
    const modelingUi = mountModelingToolbar({
      toolbar: modelingToolbar,
      status: modelingStatus,
      onBeam: () => commandController?.startBeam(),
      onColumn: () => commandController?.startColumn(),
      onCancel: () => commandController?.cancel()
    });
    let dimensionEdit = null;
    const rerender = (nextProject) => {
      renderProject(nextProject, profiles, fasteners, { preserveCamera: true, activeConnectionId: dimensionEdit?.connectionId() || null });
      dimensionEdit?.render();
    };
    let editorApi = null;
    const memberEdit = createMemberEditController({
      viewer,
      api,
      selection,
      onProjectChange: rerender,
      onMemberSelected: (memberId) => editorApi?.selectMember(memberId, { fromMemberEdit: true }),
      onCleared: () => editorApi?.clearSelection({ fromMemberEdit: true })
    });
    viewer.setClickHandler((face) => {
      if (!face) dimensionEdit?.clearDimension();
      memberEdit.handleSceneClick(face);
    });
    const showConnectionEditor = (connectionId, options = {}) => {
      const focus = dimensionEdit.selectConnection(connectionId, options);
      const definition = api.definition(connectionId);
      definition.customUi.mountConnectionUi({
        panel: customPanel,
        definition,
        connectionId,
        api,
        focusPath: focus.path,
        focusMode: focus.mode,
        focusInput: !options.focusLabel,
        onPanelFocus: () => {
          dimensionEdit.stopLabelEdit();
        },
        onProjectChange: rerender,
        onConnectionDeleted: () => {
          dimensionEdit.clearAll();
          customPanel.hidden = true;
          renderProject(api.project(), profiles, fasteners, { preserveCamera: true });
          memberEdit.clear({ notify: false });
          selection.clear();
        }
      });
      renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeConnectionId: dimensionEdit.connectionId() });
      dimensionEdit.render();
    };
    dimensionEdit = createDimensionEditController({
      viewer,
      api,
      profiles: profiles.profiles,
      settings,
      getEditorApi: () => editorApi,
      onProjectChange: rerender,
      openConnectionEditor: showConnectionEditor
    });
    viewer.setDoubleClickHandler((face) => {
      try {
        const result = api.toggleConnectionComponentFromFace(face);
        if (!result) return;
        dimensionEdit.clearDimension({ render: false });
        editorApi?.selectConnection(result.component.connectionId);
        rerender(result.project);
      } catch (error) {
        console.error(error);
      }
    });
    commandController = createCommandController({
      viewer,
      api,
      profiles: profiles.profiles,
      settings,
      onPreviewChange: (previewMembers) => {
        authoringPreview = previewMembers || [];
        renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeConnectionId: dimensionEdit?.connectionId() || null });
      },
      onOverlayChange: (overlay) => viewer.setAuthoringOverlay(overlay),
      onProjectChange: rerender,
      onStatusChange: (message) => {
        modelingUi.setStatus(message);
        if (message === "No modeling command") modelingUi.setActive(null);
      },
      onCommandStart: (type) => {
        modelingUi.setActive(type);
        dimensionEdit?.clearDimension({ render: false });
        memberEdit.clear({ notify: false });
        selection.clear();
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (dimensionEdit.clearDimension()) event.preventDefault();
    }, { capture: true });

    renderProject(api.project(), profiles, fasteners);
    connectionCatalog.customUi.mountConnectionLibraryUi({
      panel: libraryPanel,
      api,
      selection,
      onProjectChange: rerender,
      onConnectionCreated: showConnectionEditor
    });
    editorApi = mountEditorUi({
      panel: objectEditor,
      api,
      profiles: profiles.profiles,
      selection,
      memberEdit,
      onProjectChange: rerender,
      onConnectionSelected: showConnectionEditor,
      onConnectionDeleted: () => {
        dimensionEdit.clearAll();
        customPanel.hidden = true;
      }
    });

    const connection = api.supportedConnections()[0];
    if (connection) {
      showConnectionEditor(connection.id);
    } else {
      customPanel.hidden = true;
    }

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", () => viewer?.resize());
main();
