function recipeStepOperation(ctx, step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) ctx.fail("smart component recipe step must be an object");
  if (typeof step.operation !== "string" || !step.operation.trim()) ctx.fail("smart component recipe step missing operation");
  return step.operation;
}

function recipeStepInputs(ctx, step) {
  if (!step.inputs || typeof step.inputs !== "object" || Array.isArray(step.inputs)) ctx.fail(`${step.operation}: recipe step inputs must be an object`);
  return step.inputs;
}

export function buildSmartComponentRecipe(recipe) {
  if (!Array.isArray(recipe) || !recipe.length) throw new Error("smart component recipe must be a non-empty array");
  return (ctx) => {
    const recipeContext = {};
    for (const step of recipe) {
      const operation = recipeStepOperation(ctx, step);
      const result = ctx.operation(operation, { ...recipeStepInputs(ctx, step), recipeContext });
      if (!result || typeof result !== "object" || Array.isArray(result)) ctx.fail(`${operation}: recipe step result must be an object`);
      for (const key of Object.keys(result)) {
        if (Object.hasOwn(recipeContext, key)) ctx.fail(`${operation}: recipeContext.${key} already exists`);
      }
      Object.assign(recipeContext, result);
    }
  };
}
