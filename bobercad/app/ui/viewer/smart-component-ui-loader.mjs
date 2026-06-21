function requiredFunction(value, label) {
  if (typeof value !== "function") throw new Error(`${label} must be a function`);
  return value;
}

export async function loadSmartComponentUi() {
  const parameterUi = await import("./smart-component-parameter-ui.mjs");
  return Object.freeze({
    mountSmartComponentUi: requiredFunction(parameterUi.mountParameterSmartComponentUi, "mountParameterSmartComponentUi")
  });
}
