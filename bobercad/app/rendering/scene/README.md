# Scene Rendering

This folder converts semantic project objects into renderable faces, edges, and overlays.

- `build-scene.mjs` builds the viewer scene from members, plates, features, fasteners, and welds.
- `scene-object-visibility.mjs` owns active-connection visibility, suppressed ghost objects, and ghost opacity policy.
- `authoring/member-overlays.mjs` builds member and plate authoring guides.

Keep connection-specific generated geometry in connection/component builders. Add generic viewer scene policy here only when it applies to all connections.
