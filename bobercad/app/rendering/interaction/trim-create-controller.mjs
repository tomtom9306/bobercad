export function createTrimCreateController({
  selection,
  onCommandEnd,
  onPickProgress,
  onStatusChange
}) {
  let active = false;

  function start(options = {}) {
    active = true;
    const pickedMemberIds = Array.isArray(options.pickedMemberIds) ? options.pickedMemberIds : [];
    onPickProgress?.(pickedMemberIds);
    onStatusChange?.("Trim: choose type and pick objects");
    return true;
  }

  function finish(message = "No modeling command") {
    if (!active) return false;
    selection.cancelPick({ clear: false });
    active = false;
    onCommandEnd?.();
    onStatusChange?.(message);
    return true;
  }

  function cancel() {
    if (!active) return false;
    selection.cancelPick();
    active = false;
    onCommandEnd?.();
    onStatusChange?.("No modeling command");
    return true;
  }

  return {
    active: () => active,
    cancel,
    finish,
    start
  };
}
