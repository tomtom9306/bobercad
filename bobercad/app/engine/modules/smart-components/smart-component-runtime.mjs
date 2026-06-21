import { registerConnectionPrimitiveOperations } from "../../api/model/connection-primitive-manifest.mjs";

registerConnectionPrimitiveOperations();

export { smartComponentById } from "./smart-component-model-helpers.mjs";
export { createProjectSmartComponentFromPreset } from "./smart-component-creation.mjs";
export { updateSmartComponent, updateSmartComponents } from "./smart-component-build.mjs";
export {
  setSmartComponentPlateIncluded,
  setSmartComponentRoleActive,
  smartComponentPlateOptions,
  smartComponentRoleOptions
} from "./smart-component-options.mjs";
