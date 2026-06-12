export function createTrimCreateController({
  api,
  selection,
  onProjectChange,
  onTrimCreated,
  onCommandEnd,
  onStatusChange
}) {
  let active = false;

  function start() {
    active = true;
    selection.beginMemberPick({
      count: 2,
      onPick: (memberIds) => {
        onStatusChange?.(memberIds.length === 1 ? "Trim: pick second member" : "Trim: creating");
      },
      onComplete: (memberIds) => {
        try {
          active = false;
          const result = api.createTrimJoint({
            memberIds,
            operationType: "end-butt-both"
          });
          onProjectChange?.(result.project);
          onTrimCreated?.(result.trimJointId);
          onStatusChange?.(`Trim created: ${result.trimJointId}`);
        } catch (error) {
          onCommandEnd?.();
          onStatusChange?.(error.message);
        }
      },
      onError: (message) => onStatusChange?.(message || "Pick a member.")
    });
    onStatusChange?.("Trim: pick first member");
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
    start
  };
}
