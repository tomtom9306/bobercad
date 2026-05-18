function componentType(ref) {
  if (typeof ref === "string") return ref;
  return ref?.component || ref?.type;
}

function recipeStepInput(ref) {
  if (!ref || typeof ref === "string") return {};
  return ref.input || ref.inputs || {};
}

export function buildConnectionRecipe(recipe = []) {
  return (ctx) => {
    const recipeContext = {};
    for (const step of recipe) {
      const type = componentType(step);
      if (!type) ctx.fail("connection recipe step missing component");
      const result = ctx.component(type, { ...recipeStepInput(step), recipeContext });
      if (result && typeof result === "object") Object.assign(recipeContext, result);
    }
  };
}
