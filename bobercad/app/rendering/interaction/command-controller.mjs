import { isTextInput, matchesShortcut, shortcutSetting } from "./keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { createMemberCreateController } from "./member-create-controller.mjs?v=unified-snap-manager-8";
import { createPlateCreateController } from "./plate-create-controller.mjs?v=unified-snap-manager-8";
import { createSketchCreateController } from "./sketch-create-controller.mjs?v=backspace-escape-dry-1";
import { createWorkPlaneController } from "./work-plane-controller.mjs?v=backspace-escape-dry-1";
import { createPlateBendController } from "./plate-bend-controller.mjs?v=plate-placement-vertex-dry-1";
import { activeWorkPlane } from "../../engine/api/project/work-plane.mjs?v=finite-point-api-dry-1";

export function createCommandController({
  viewer,
  api,
  profiles,
  snapManager,
  settings,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange,
  onCommandStart
}) {
  let activeCommand = null;
  let customWorkPlane = null;
  const shortcuts = settings.shortcuts?.commands || {};
  const getWorkPlane = () => customWorkPlane || activeWorkPlane(api.project(), {});
  const memberCreate = createMemberCreateController({
    viewer,
    api,
    profiles,
    snapManager,
    settings,
    onPreviewChange,
    onOverlayChange,
    onProjectChange,
    onStatusChange
  });
  const plateCreate = createPlateCreateController({
    viewer,
    api,
    snapManager,
    getWorkPlane,
    settings,
    onPreviewChange,
    onOverlayChange,
    onProjectChange,
    onStatusChange
  });
  const sketchCreate = createSketchCreateController({
    viewer,
    api,
    snapManager,
    getWorkPlane,
    onProjectChange,
    onStatusChange
  });
  const workPlaneCreate = createWorkPlaneController({
    viewer,
    api,
    snapManager,
    onWorkPlaneChange: (plane) => { customWorkPlane = plane; },
    onStatusChange
  });
  const plateBend = createPlateBendController({
    api,
    onProjectChange,
    onStatusChange
  });

  function switchCommand(type, command, start) {
    if (activeCommand && activeCommand !== command) activeCommand.cancel?.();
    onCommandStart?.(type);
    activeCommand = command;
    try {
      start();
    } catch (error) {
      activeCommand = null;
      onStatusChange?.(error?.message || "Command start failed");
      throw error;
    }
  }

  function startMemberCommand(type) {
    switchCommand(type, memberCreate, () => memberCreate.start(type));
  }

  function startPlateCommand() {
    switchCommand("plate", plateCreate, () => {
      plateCreate.start(viewer.currentPointer?.());
    });
  }

  function startSketchCommand() {
    if (activeCommand === sketchCreate && sketchCreate.active()) {
      if (sketchCreate.finish?.()) activeCommand = null;
      return;
    }
    switchCommand("sketch", sketchCreate, () => sketchCreate.start());
  }

  function startWorkPlaneCommand() {
    switchCommand("workPlane", workPlaneCreate, () => workPlaneCreate.start());
  }

  function startPlateBendCommand() {
    switchCommand("plateBend", plateBend, () => plateBend.start());
  }

  const commandShortcuts = [
    ["createBeam", "B", () => startMemberCommand("beam")],
    ["createColumn", "C", () => startMemberCommand("column")],
    ["createPlate", "P", startPlateCommand],
    ["createSketch", "S", startSketchCommand],
    ["setWorkPlane", "W", startWorkPlaneCommand],
    ["addPlateBend", "F", startPlateBendCommand]
  ];

  function cancel() {
    activeCommand?.cancel?.();
    activeCommand = null;
  }

  function commandActive() {
    return Boolean(activeCommand?.active?.());
  }

  viewer.setCommandHandler({
    active: commandActive,
    pointerMove(pointer) {
      return activeCommand?.pointerMove?.(pointer) || false;
    },
    pointerDown(pointer) {
      return activeCommand?.pointerDown?.(pointer) || false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (isTextInput(event.target)) return;
    if (!commandActive()) {
      const commandShortcut = commandShortcuts.find(([key, fallback]) => matchesShortcut(event, shortcutSetting(shortcuts, key, fallback)));
      if (commandShortcut) {
        event.preventDefault();
        commandShortcut[2]();
        return;
      }
    }
    if (matchesShortcut(event, settings.authoring?.snap?.cycleKey || "Tab") && activeCommand?.cycleSnap?.()) {
      event.preventDefault();
      return;
    }
    if (activeCommand?.handleKey?.(event)) {
      event.preventDefault();
      if (!activeCommand.active()) activeCommand = null;
    }
  }, { capture: true });

  return {
    activeCommand: () => activeCommand,
    cancel,
    startBeam: () => startMemberCommand("beam"),
    startColumn: () => startMemberCommand("column"),
    startPlate: startPlateCommand,
    startSketch: startSketchCommand,
    startWorkPlane: startWorkPlaneCommand,
    startPlateBend: startPlateBendCommand
  };
}
