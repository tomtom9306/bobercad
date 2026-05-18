# Annotation Map

This folder turns connection `config.json` dimension definitions into 3D annotations.

## Flow

1. A connection or reusable component defines `dimensions` in `config.json`.
2. `build-dimensions.mjs` creates the shared build context.
3. `dimension-registry.mjs` routes each `reference.kind` to one handler in `dimensions/`.
4. `webgl-renderer.mjs` draws the resulting lines, labels, callouts, hover, and edit controls.

## Rules

- Keep dimension placement data-driven from `config.json`.
- Add new shared dimension behaviors as small `reference.kind` handlers in `dimensions/`.
- Put shared math and annotation builders in `dimension-context.mjs`; keep handler files focused on one dimension concept.
- Keep connection-specific math in the connection folder unless it is genuinely reusable.
- Do not store rendered dimension meshes in project JSON.
