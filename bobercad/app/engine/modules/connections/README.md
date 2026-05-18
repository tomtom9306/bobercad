# Connection Module Map

This folder is the app-side connection runtime. It loads connection recipes from `bobercad/data/libraries/connections`, loads reusable components from `bobercad/data/libraries/connection-components`, validates the composed definition, and gives components a small build API.

## Files

- `connection-registry.mjs` loads connection configs and composes their `componentRefs`.
- `connection-recipe.mjs` turns a declarative `recipe` array into build steps.
- `component-registry.mjs` loads reusable connection components from `bobercad/data/libraries/connection-components`.
- `component-config-groups.mjs` expands compact JSON groups into parameters, dimensions, and UI fragments.
- `connection-schema.mjs` validates config links, UI parameter paths, dimension specs, and parameter values.
- `connection-generator.mjs` runs the selected recipe/components and writes explicit project objects.

## Contract

Connection folders are recipe/config only:

- `config.json` describes the connection type, interfaces, presets, `componentRefs`, and `recipe`.
- `componentRefs` composes reusable component roles, parameters, dimensions, and UI into the connection definition.
- `recipe` places reusable components with optional input objects.
- Connection folders must not contain `build.mjs` or `ui.mjs`; shared UI is generated from component/connection config.
- Reusable behavior belongs in `bobercad/data/libraries/connection-components`.

The app must not hardcode a specific connection type here. If a new connection needs another reusable primitive, add it to `bobercad/app/engine/api/connections` and expose it through `api-register.json`.
