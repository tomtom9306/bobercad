# Connection Component Library Map

This folder contains reusable pieces that connection types can compose.

## Add A Component

1. Create `components/<category>/<component-id>/`.
2. Add `config.json` and `build.mjs`.
3. Point `config.json` at `../../../../../../app/schemas/connection-component.schema.json`.
4. Add the folder path to `component-register.json`.
5. Reference the component from a connection config with `componentRefs`.

## Folder Contract

- `config.json` declares reusable roles, optional parameters, optional dimensions, component toggles, and UI fragments.
- `build.mjs` receives the normal connection API context plus recipe input from the host connection.
- `componentRefs` can reuse smaller support components, but do not create connection-specific assembly wrappers.
- `parameterGroups`, `dimensionGroups`, and `uiGroups` can generate repeated config blocks when that keeps library JSON shorter.
- Components must create explicit project objects through the same semantic builders as connections.
- If a parameter is edited in 3D or shown in the connection panel, keep that dimension/UI metadata with the component that owns the parameter.
- Keep component code generic. Connection-specific choices should be inputs or JSON config, not copied logic.
- Do not name reusable component folders after a connection type. A connection should read as a short recipe of generic parts.

The app discovers components only through `component-register.json`.
