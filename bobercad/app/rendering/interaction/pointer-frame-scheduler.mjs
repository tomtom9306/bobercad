export function createPointerFrameScheduler({ requestFrame = null } = {}) {
  const scheduleFrame = typeof requestFrame === "function"
    ? requestFrame
    : typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
  let pendingPointer = null;
  let framePending = false;

  function clear() {
    pendingPointer = null;
    framePending = false;
  }

  function schedule(pointer, callback) {
    pendingPointer = pointer;
    if (framePending) return true;
    framePending = true;
    scheduleFrame(() => {
      framePending = false;
      const nextPointer = pendingPointer;
      pendingPointer = null;
      if (nextPointer) callback(nextPointer);
    });
    return true;
  }

  return {
    clear,
    schedule
  };
}
