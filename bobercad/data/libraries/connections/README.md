# Connection Library Map

This folder is the user-editable connection library.

## Add A Connection

1. Create `connections/<connection-id>/`.
2. Add `config.json`.
3. Point `config.json` at `../../../../../app/schemas/connection.schema.json`.
4. Add the folder path to `connection-register.json`.
5. Run `node .\scripts\check_repo.js` from the repo root.

## Folder Contract

- `config.json` is the only link between the app and a connection: type, interfaces, presets, `componentRefs`, and `recipe`.
- Connection folders must not contain `build.mjs` or `ui.mjs`.
- `componentRefs` imports reusable roles, parameters, dimensions, and UI fragments.
- `recipe` is the ordered list of reusable components to generate.
- Roles, component toggles, parameters, dimensions, and UI fragments belong in reusable components, not in connection configs.
- Shared parts such as plates, bolts, notches, welds, stiffeners, and sandwich plates live in `../connection-components`; their configs own reusable roles, parameters, dimensions, and UI fragments.
- If a connection would need one-off custom code, model it manually plate-by-plate instead of adding a connection type.

The app should discover connections through `connection-register.json`; avoid hardcoded connection-specific branches in `bobercad/app`.
