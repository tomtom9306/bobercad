import { validateModelOperationInput } from "../../api/model/connection-primitive-registry.mjs";

function recipeStepOperation(ctx, step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) ctx.fail("smart component recipe step must be an object");
  if (typeof step.operation !== "string" || !step.operation.trim()) ctx.fail("smart component recipe step missing operation");
  return step.operation;
}

function recipeStepInputs(ctx, step) {
  if (!step.inputs || typeof step.inputs !== "object" || Array.isArray(step.inputs)) ctx.fail(`${step.operation}: recipe step inputs must be an object`);
  return step.inputs;
}

function recipeFailure(scope) {
  return (message) => {
    throw new Error(`${scope}: ${message}`);
  };
}

function recipeStep(step, index) {
  const scope = `smart component recipe[${index}]`;
  const ctx = { fail: recipeFailure(scope) };
  const operation = recipeStepOperation(ctx, step);
  const inputs = recipeStepInputs(ctx, step);
  validateModelOperationInput(operation, inputs, { fail: recipeFailure(scope) });
  return { operation, inputs };
}

export function buildSmartComponentRecipe(recipe) {
  if (!Array.isArray(recipe) || !recipe.length) throw new Error("smart component recipe must be a non-empty array");
  const steps = recipe.map(recipeStep);
  return (ctx) => {
    const recipeContext = {};
    for (const step of steps) {
      const result = ctx.operation(step.operation, { ...step.inputs, recipeContext });
      if (!result || typeof result !== "object" || Array.isArray(result)) ctx.fail(`${step.operation}: recipe step result must be an object`);
      for (const key of Object.keys(result)) {
        if (Object.hasOwn(recipeContext, key)) ctx.fail(`${step.operation}: recipeContext.${key} already exists`);
      }
      Object.assign(recipeContext, result);
    }
  };
}
