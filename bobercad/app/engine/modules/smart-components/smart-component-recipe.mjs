function componentType(ref) {
  if (typeof ref === "string") return ref;
  return ref?.operation || ref?.component || ref?.type;
}

function recipeStepInput(ref) {
  if (!ref || typeof ref === "string") return {};
  return ref.input || ref.inputs || {};
}

export function buildSmartComponentRecipe(recipe = []) {
  return (ctx) => {
    const recipeContext = {};
    for (const step of recipe) {
      const type = componentType(step);
      if (!type) ctx.fail("smart component recipe step missing operation");
      const result = step?.kind === "child" || step?.child
        ? ctx.component.create(step.role || type, { componentRef: type, ...recipeStepInput(step), recipeContext })
        : ctx.operation(type, { ...recipeStepInput(step), recipeContext });
      if (result && typeof result === "object") Object.assign(recipeContext, result);
    }
  };
}
