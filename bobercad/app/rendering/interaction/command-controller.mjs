import { createMemberCreateController } from "./member-create-controller.mjs?v=snap-settings-json-1";

function isTextInput(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

export function createCommandController({
  viewer,
  api,
  profiles,
  settings,
  onPreviewChange,
  onOverlayChange,
  onProjectChange,
  onStatusChange,
  onCommandStart,
  autoRelationsEnabled
}) {
  let activeCommand = null;
  const memberCreate = createMemberCreateController({
    viewer,
    api,
    profiles,
    settings,
    onPreviewChange,
    onOverlayChange,
    onProjectChange,
    onStatusChange,
    autoRelationsEnabled
  });

  function startMemberCommand(type) {
    onCommandStart?.(type);
    activeCommand = memberCreate;
    memberCreate.start(type);
  }

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
    const key = event.key.toLowerCase();
    if (!commandActive() && key === "b") {
      event.preventDefault();
      startMemberCommand("beam");
      return;
    }
    if (!commandActive() && key === "c") {
      event.preventDefault();
      startMemberCommand("column");
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
    startColumn: () => startMemberCommand("column")
  };
}
