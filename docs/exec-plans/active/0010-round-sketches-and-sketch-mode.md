# Exec Plan 0010: Round Sketches And Contextual Sketch Mode

## Goal

Add first-class circular sketching to Bobercad so users can create and edit rounded plate/sketch geometry instead of only sharp polygonal outlines.

The end state is not "fake circles rendered from many stored points". Project JSON must keep semantic sketch geometry, while the viewer/editor/export paths derive sampled runtime geometry when needed.

## Current State

- Plates and sketch objects already use a semantic `plate-sketch` with stable `vertices`, `edges`, and `relations`.
- `plateSketchEdge` supports semantic straight-line and circular-arc edges; runtime geometry is sampled from stored analytic data where polygonal consumers need points.
- Rendering, picking, snapping, editor overlays, relations, and plate conversion now understand semantic circular arcs instead of treating every outline edge as a straight segment.
- Existing editing supports vertex drag, edge drag, insert vertex, delete vertex, corner notch, construction lines, fixed/parallel/perpendicular/length/angle/distance relations, and conversion from sketch to plate.
- The existing `model.sketch.create` command seeds a standalone sketch from arbitrary picked points, shows a live authoring outline while points are collected, then hands the new sketch into active Sketch mode with relations visible. It accepts more than three points and finishes with Enter or double-click.
- The toolbar switches from Model commands into a contextual Sketch command group when a sketch is active, including rounded sketch creation, arc editing, trim/extend/delete, dimensions, and relations.
- Curved members already use analytic path segments (`line`, `arc`, `helix`, `spiral`) and runtime sampling. This is the right precedent for sketch curves.

## Requirements

1. Store round sketch geometry semantically.
2. Do not store tessellated circle/arc points as source data.
3. Keep existing straight-edge project JSON valid.
4. Let the viewer render rounded outlines for plates and sketch objects.
5. Let snapping and picking work on curved sketch edges.
6. Add sketch tools users expect: line, circle, rounded rectangle, slot, arc, fillet/round corner, trim/delete, dimensions/relations.
7. When a sketch is active, the Model toolbar area must become a Sketch toolbar with sketch-specific commands, similar to SolidWorks context switching.
8. Keep NC1/export-facing geometry derivable from stored model data.
9. Update schema, docs, samples, and checks in the same workflow as model changes.

## Data Model Plan

Extend `plateSketchEdge` into a discriminated edge shape while preserving current straight-line data:

```json
{
  "id": "e1",
  "from": "v1",
  "to": "v2",
  "kind": "line"
}
```

`kind` is optional and defaults to `line` for backward compatibility.

Add a circular arc edge:

```json
{
  "id": "e2",
  "from": "v2",
  "to": "v3",
  "kind": "circular-arc",
  "center": [120, 40],
  "radius": 35,
  "direction": "ccw"
}
```

Validation rules:

- `from` and `to` remain stable topology references.
- `center` is in local sketch `[y, z]` coordinates.
- `radius` is positive.
- `direction` is `cw` or `ccw`.
- Endpoint distances from `center` must match `radius` within model tolerance.
- Arc sweep must not be zero.
- Full circles should initially be authored as four connected quarter-arc edges with four vertices. This keeps the closed-loop topology simple and avoids introducing same-start/end edges.

This shape keeps source data readable, allows exact radius editing, and avoids storing generated polyline geometry.

## Engine Plan

Create a focused sketch-curve helper layer under `bobercad/app/engine/api/project/plate-sketch/`, for example `edge-geometry.mjs`.

Core helpers:

- `sketchEdgeKind(edge)` returns `line` or `circular-arc`.
- `normalizeSketchEdge(sketch, edge)` validates line/arc data.
- `sketchEdgeRuntime(edge, vertexMap)` returns analytical runtime data: start, end, center, radius, sweep, length.
- `sampleSketchEdge(edge, vertexMap, options)` returns runtime-only points.
- `tessellatedSketchLoop(sketch, options)` returns a closed outline suitable for render/CSG/export.
- `sketchEdgePointAt(edge, t)` and `sketchEdgeTangentAt(edge, t)` support snap, fillet, trim, and dimension overlays.
- `measuredSketchEdgeLength()` must use chord length for lines and arc length for circular arcs.

Keep two different concepts explicit:

- topology loop: stable vertices and edges used for editing and relations
- render/export outline: sampled runtime points derived from line and arc edges

`plateOutline()` should either become the tessellated outline API or delegate to a clearly named tessellated helper. Any code that truly needs only vertices should call a vertex-loop helper, not `plateOutline()`.

## Schema And Sample Plan

Update:

- `bobercad/app/schemas/project.schema.json`
- `docs/architecture/data-model.md`
- at least one sample project, preferably `bobercad/data/projects/sample_authoring_nc1_test.json`

Add one small rounded sketch sample:

- rounded rectangle plate using line edges plus four `circular-arc` edges
- optional circle sketch authored as four quarter arcs

Keep `objectIndex` in sync for any new objects.

## Rendering And Geometry Plan

Update all consumers currently assuming straight sketch edges:

- `plateOutline()` and `outlineFromSketch()`
- `scene-object-geometry-adapters.mjs` for plates and sketch objects
- `plate-bend-geometry.mjs`; until curved bend support is explicitly designed, bend normalization rejects `circular-arc` sketch edges and accepts only straight sketch edges as bend targets
- weld/feature evaluators that read plate outlines
- snap candidates for plate sketch vertices, arc midpoint, arc center, quadrants, and point-on-arc
- WebGL authoring overlay line specs and handle picking

For rendering, use `viewer-settings.json` curve settings as the source of sampling quality. Start with `render.curves.circleSegments`, with arc samples proportional to sweep angle.

## Editing Plan

Build on the existing plate-sketch editor instead of adding a separate editor stack.

First edit operations:

1. Fillet selected corner by radius.
   - Input: vertex id, radius.
   - Output: trim adjacent line edges, insert two tangent vertices, insert one `circular-arc` edge.
   - Add a `radius` relation to the arc. The current implementation starts with a driven/reference dimension and can switch to a driving radius edit for circular-arc geometry.
2. Circle tool.
   - Input: center and radius, or center and perimeter point.
   - Output: four quarter-arc edges and four quadrant vertices.
3. Arc tool.
   - Start with center-start-end or three-point arc.
   - Output: one `circular-arc` edge between two vertices.
   - Initial 3 Point Arc workflow converts three consecutive selected outline vertices into one semantic arc through the middle vertex.
4. Convert selected straight edge to arc.
   - Input: existing line edge id, radius, and side.
   - Output: keep the same edge endpoints and edge id, replace the edge shape with one semantic `circular-arc`, add a driven `radius` relation, and remove stale line-only relations from that edge.
5. Flip selected arc.
   - Input: existing circular-arc edge id.
   - Output: keep the same endpoints, edge id, and radius, mirror the arc center across the chord, reverse direction, and remove stale tangent/concentric relations tied to the previous side.
6. Insert vertex on arc.
   - Split one arc into two tangent arcs preserving center, radius, and direction.
7. Delete arc or arc vertex.
   - Preserve valid closed topology and remove invalid radius/tangent relations.
   - Removing a vertex shared by two same-circle arcs should merge them into one semantic `circular-arc`.

Initial relation set:

- `radius`: driving/driven dimension for one circular arc edge.
- `tangent`: between an arc edge and a neighboring line/arc edge.
- `concentric`: between two arc edges.
- `equal-radius`: between two arc edges.
- `diameter`: display/edit variant of a circular-arc radius dimension.
- `point-on-circle`: keeps a selected sketch point on a circular-arc radius.

Line-only relations such as horizontal, vertical, perpendicular, parallel, collinear, and equal-length should reject arc edges until each has explicit semantics.

## UI Plan

Introduce contextual Sketch mode:

- Selecting a plate/sketch for edit activates a sketch context in the viewer app state.
- The top feature navbar highlights `Sketch` instead of `Model`.
- The modeling toolbar swaps command set from model commands to sketch commands.
- Exiting sketch returns the toolbar to Model.
- `model.sketch.create` supports a point-by-point polygon seed instead of forcing a three-point sketch: after the third point it keeps collecting points until Enter or double-click, shows committed points plus the closed preview outline during authoring, then clears the preview and hands the new standalone sketch into active Sketch mode.

Sketch toolbar command groups:

- Create: Line, Line Contour, Center Rectangle, Rounded Rect, Circle, Diameter Circle, 3 Point Circle, Slot, Center Slot, Center Arc, Center Arc Contour, 3 Point Arc, 3 Point Arc Contour
- Modify: Fillet, Trim, Extend, Delete, Convert To Plate
- Relations: Fix, Coincident, On Circle, Tangent, Concentric, Equal Radius
- Dimensions: Length, Angle, Radius, Diameter, Distance
- View: Show/Hide Relations, Clean View

Do not rely on visible tutorial text in the app. Use icons, tooltips, command labels, and status bar prompts.

## Recommended Implementation Slices

### Slice 1: Read, Validate, Render Curved Sketch Edges

Status: initial implementation in `codex/agent3`.

- Add schema support for `kind: "circular-arc"`.
- Add engine normalization and tessellation helpers.
- Update rendering and snap candidates enough that a hand-authored rounded sample displays correctly.
- Add a sample rounded plate/sketch.
- Run `node .\scripts\check_repo.js` and targeted schema validation.

This slice proves the model shape and display pipeline before editor complexity.

### Slice 2: Fillet Command

Status: initial implementation in `codex/agent3`.

- Add `notchPlateSketchCorner` sibling: `filletPlateSketchCorner`.
- Add store/API/register entries.
- Add inspector/action entry for selected sketch corner.
- Add radius prompt and update overlay.
- Verify a rectangle can become a rounded rectangle without storing sampled points.

This gives immediate practical value for "promienie".

### Slice 3: Circle And Arc Creation

Status: initial interactive Line tool, interactive Line Contour closed-polyline tool with Alt-click arc insertion including staged first-segment arcs, Shift+Alt arc-direction flip, and Edge Arc resume/preserve behavior, interactive Circle center-radius tool, interactive Diameter Circle two-endpoint tool, interactive 3 Point Circle perimeter tool, interactive Center Rectangle center-corner tool, interactive Rounded Rect center-corner-radius tool, interactive Slot start-end-radius tool, interactive Center Slot center-axis-radius tool, interactive Center Arc construction tool, interactive Center Arc Contour sector tool, interactive selected-edge through-point arc conversion, 3 Point Arc conversion and construction drawing, 3 Point Arc Contour sector drawing, Flip Arc correction, Split Arc midpoint insertion, split-arc vertex removal/merge, and active arc snap candidates implemented in `codex/agent3`.

- Add active sketch drawing tools for circle and arc.
- Line is presented in the Sketch toolbar as construction-line authoring. It can add a construction line from one selected sketch edge or two selected sketch points, or enter a two-click drawing tool in the active sketch. The first click sets the line start, cursor movement previews the line, the second click adds the construction line, and the tool remains active for chained line drawing. Outline authoring is handled by Line Contour, whose toolbar metadata now advertises mixed line/arc contour creation with Alt and Shift+Alt arc segments.
- Edge Arc toolbar metadata now advertises both straight-edge conversion and existing circular-arc update through a picked point, matching the controller behavior for mixed line/arc contour refinement.
- Line Contour enters a contour workflow in active Sketch mode. The first two clicks collect contour points; Alt-click at this two-point stage can stage the first segment as a semantic arc through the picked point, with Shift+Alt flipping the arc side, and the next normal point commits the closed contour with that first arc. Delete/Backspace before the first contour commit now clears a staged first arc first, then steps back uncommitted contour points so the user can replace a bad point without cancelling the tool. Without a staged first arc, the third click replaces the active plate-hosted or standalone sketch with a closed straight-edge contour, and Delete/Backspace from that initial three-point contour steps the tool back to replacement-third-point mode so the next point replaces the stored contour. When the initial contour had a first-segment arc, that arc is retained through third-point replacement. Each later click extends that stored contour from the same point chain. Delete/Backspace after the latest segment has been converted to an arc now reverts that latest segment back to a straight edge before removing any contour points. Delete/Backspace after a contour has grown beyond its initial three points rewrites the stored outline to the previous point chain, restores surviving semantic arc segments, selects the new latest segment, and keeps Line Contour active for a replacement point. If a non-latest committed contour point or contour edge is selected while Line Contour is active, Delete removes that selected point or the selected edge's forward point, rebuilds the contour from the remaining point chain, restores surviving semantic arcs, and keeps Line Contour active; this includes the closing contour edge. Clicking a new location with one committed contour point selected replaces that point in the active point chain, restores unaffected semantic arcs, and keeps Line Contour active instead of appending an unintended extra point. Clicking a new location with one non-latest straight contour edge selected projects the click onto that selected segment, inserts the projected point into the edge, and restores unaffected semantic arcs, while the automatically selected latest segment still extends the contour on normal click; this includes selected closing straight edges and later contour continuation from the inserted point. Clicking a new location with one non-latest circular arc selected projects the click to the arc radius, splits the selected arc at that point, and keeps both child arcs semantic; split validation rejects points outside the selected arc sweep, and the same path now has runtime coverage for selected closing arcs plus continued contour extension after the split. The source remains semantic vertices and edges; after each stored contour update, the newest segment is selected so `Edge Arc` can immediately turn that segment into a semantic circular arc. Alt-click while Line Contour is active converts the latest segment into a semantic arc through the picked point without switching toolbar commands, and Alt-click on an already-rounded latest segment updates that same semantic arc with a new through point. Alt pointer movement shows a sampled arc preview before committing; Shift+Alt uses the picked point to flip the arc direction and labels the sampled preview as flipped. After extending a mixed line/arc contour, the same Alt/Shift+Alt preview state remains available on the new latest segment. When `Edge Arc` is invoked from an active Line Contour, it resumes Line Contour after the through-point pick and later contour extensions preserve already-created arc segments.
- Circle supports an interactive center-radius workflow in active Sketch mode. The first click sets the center, cursor movement previews the radius line and sampled runtime-only circle, and the second click replaces the active plate-hosted or standalone sketch contour with four semantic quarter-arc edges plus a driven radius relation.
- Diameter Circle supports an interactive two-endpoint workflow in active Sketch mode. The first click sets one diameter endpoint, cursor movement previews the diameter line and sampled runtime-only circle, and the second click replaces the active plate-hosted or standalone sketch contour with the same four semantic quarter-arc circle and a driven radius relation.
- 3 Point Circle supports an interactive perimeter workflow in active Sketch mode. The first two clicks set circle points, cursor movement previews the sampled runtime-only circle through the third point, collinear triples are rejected without mutating the stored sketch, and the third valid point replaces the active plate-hosted or standalone sketch contour with the same four semantic quarter-arc circle and a driven radius relation.
- Center Rectangle supports an interactive center-corner workflow in active Sketch mode. The first click sets the center, cursor movement previews the centered rectangle, and the second click stores a centered four-line sketch with inferred horizontal, vertical, perpendicular, parallel, and equal-length relations. This gives users a direct base outline for Fillet/Rounded Rect workflows.
- Rounded Rect supports an interactive center-corner-radius workflow in active Sketch mode. The first click sets the center, the second click sets the opposite corner and dimensions, cursor movement previews the axis-aligned rounded rectangle, and the third click stores four straight edges and four semantic quarter-arc corners with radius, equal-radius, and tangent relations.
- Slot supports an interactive straight-slot workflow in active Sketch mode. The first click sets the start center, the second click sets the end center, cursor movement previews the centerline and sampled runtime-only capsule, and the third click stores a rounded capsule sketch from two straight edges and two semantic semicircular arcs, with radius, equal-radius, and tangent relations.
- Center Slot supports a SolidWorks-style centerpoint slot workflow in active Sketch mode. The first click sets the slot center, the second click sets one end-center and therefore the symmetric opposite end-center, cursor movement previews the centerline and sampled runtime-only capsule, and the third click stores the same semantic rounded slot data with two straight edges, two circular arcs, radius, equal-radius, and tangent relations.
- Point-based round sketch creation tools now handle Delete/Backspace through the active Sketch editor before generic object deletion. Circle, Diameter Circle, 3 Point Circle, Slot, Center Slot, Center Rectangle, Rounded Rect, Center Arc, Center Arc Contour, 3 Point Arc, 3 Point Arc Contour, and Line Contour can step back their last collected or committed point without leaving Sketch mode or deleting the selected sketch object. Escape cancels the active sketch tool and clears its preview before the generic viewer cancel path can run. Enter can accept the current preview point for those tools and for Line/Line Contour, while Alt+Enter and Shift+Alt+Enter accept the active Line Contour arc preview on the normal or flipped side, so the user can click an initial point, hover the next point, and confirm from the keyboard; runtime coverage exercises Diameter Circle Backspace/Delete/Escape/Enter, Center Arc Contour Backspace, 3 Point Arc Contour Backspace, Line Contour Enter/Alt+Enter/Shift+Alt+Enter/Delete latest-point backtracking, plus 3 Point Circle and Center Slot Backspace.
- Center Arc supports an interactive center-start-end construction workflow in active Sketch mode. The first click sets the center, the second sets the start/radius, cursor movement previews a sampled runtime-only arc, and the third click stores one analytic `circular-arc` construction edge.
- Center Arc Contour uses the same center-start-end picks but replaces the active plate-hosted or standalone sketch with a closed three-edge sector contour containing one semantic `circular-arc` edge and one driven radius relation.
- Fillet is available on plate-hosted and standalone sketches, so a manual standalone sketch can receive semantic radius arcs before Convert To Plate. Viewer dimension prompts now fall back to their default value when the embedded browser environment does not support `window.prompt`, so Fillet and other dimension-prompted sketch commands remain executable instead of silently aborting in local preview.
- Edge Arc starts from one selected outline edge, previews a runtime-only arc through the picked bulge point, and converts a straight edge into a semantic circular-arc edge with the same endpoints and a driven radius relation. If the selected outline edge is already a circular arc, Edge Arc updates that same semantic arc through the newly picked point and projects any `Point On Circle` vertices for that arc back onto the updated analytic radius. This combines with `Line Contour` to produce a practical mixed line/arc contour workflow without storing tessellated geometry, including continuing the contour after an arc segment. Outline arc modifiers (`Edge Arc`, `Flip Arc`, `Split Arc`) stay disabled for construction arcs and their controller paths reject construction arcs directly, so shortcut/palette invocation cannot mutate unsupported construction geometry; construction arcs remain editable through construction-arc tools plus Trim/Delete/Fix and Radius/Diameter dimensioning where supported.
- 3 Point Arc converts three consecutive outline vertices into one semantic circular-arc edge through the middle point and removes stale line-only topology/relations. Without a three-vertex selection, it enters a three-click construction workflow: start point, through point, end point; cursor movement previews the runtime-only arc and the third click stores one analytic `circular-arc` construction edge.
- 3 Point Arc Contour uses the same start-through-end picks but computes the arc center from those points and replaces the active plate-hosted or standalone sketch with a closed three-edge arc-sector contour containing one semantic `circular-arc` edge and one driven radius relation.
- Flip Arc mirrors one selected circular arc to the opposite side of its chord while keeping the same radius and endpoints. Selected circular arcs also show a visible CW/CCW direction chip in the sketch overlay; clicking it flips the selected arc through the same command path. If Flip Arc is used while Line Contour is active, the tool stays active and later contour extension preserves the flipped semantic arc. `Point On Circle` vertices on the flipped arc are projected onto the new analytic radius so the relation stays valid after the center moves.
- Split Arc inserts a vertex at the selected arc midpoint and replaces the source arc with two tangent semantic circular-arc edges. If Split Arc is used while Line Contour is active, the contour point chain is updated with the inserted split point so later contour extension preserves both semantic arcs, including when the split arc is the contour's closing edge. `Point On Circle` constraints from the source arc are carried to the child arc that contains the constrained point.
- Delete on a vertex between two same-circle arcs merges those arcs back into one semantic circular-arc edge, preserving radius, carrying `Point On Circle` constraints onto the merged arc, and dropping stale internal tangent relations.
- Sketch toolbar Delete removes the selected relation, one selected corner, one selected construction line/arc, or an endpoint of a single construction line/arc. Construction endpoint Delete removes the owning construction edge plus its orphaned construction points. The Delete key uses the same sketch-first path so a selected sketch edge cannot accidentally delete the whole sketch object.
- Active sketch snapping now exposes arc center, arc midpoint, quadrant, and sampled point-on-arc candidates for circular-arc edges; drawing tools can snap back to the current rounded sketch instead of only external model geometry.
- WebGL authoring picking now receives sampled polyline handles for circular outline and construction sketch edges, so selecting or dragging a curved edge follows the arc rather than its chord.

### Slice 4: Radius/Tangent Relations

Status: initial radius/diameter dimensions, driving radius geometry edits, first arc relation metadata, and tangent-preserving drag edits for arc endpoints plus tangent-line/tangent-arc direction and translation edits implemented in `codex/agent3`.

- Add `radius` relation metadata for circular-arc edges.
- Add health checks and relation display for radius dimensions.
- Show radius dimensions in the sketch overlay and add a Sketch toolbar command for creating a reference radius on the selected arc.
- Show diameter dimensions as diameter-symbol display/edit variants of the same analytic radius relation and add a Sketch toolbar command for creating a reference diameter on the selected arc.
- Add driving radius solve behavior for circular-arc geometry, including shared-circle arcs such as the four-quarter-arc Circle sketch.
- Add `tangent`, `concentric`, `equal-radius`, and `point-on-circle` relation metadata plus health checks and toolbar/panel/quick-action creation paths.
- Line-only relation normalization rejects circular-arc edges for horizontal, vertical, length, angle, parallel, perpendicular, collinear, equal-length, point-on-line, midpoint, and symmetric constraints. This keeps arc JSON semantic instead of silently constraining an arc chord; use radius/diameter, tangent, concentric, equal-radius, or point-on-circle for arc geometry.
- Add solver behavior for tangent preservation during corner fillets. Direct endpoint drag now preserves the touched tangent relation when the moved endpoint remains on its previous tangent line and the arc radius can update; off-tangent direct moves still relax stale tangent relations. This includes line-arc tangent endpoints, scale-aware tolerance for large rounded sketches with small pointer noise, a first arc-arc tangent case where two different circular arcs share the moved endpoint and both radii can update, fallback through later valid tangent candidates when an earlier tangent relation touching the same moved endpoint is stale, line-direction edits where dragging the far endpoint of a tangent line updates the connected circular arc's center/radius while keeping the shared tangent point fixed, parallel translation of a whole tangent line where both line endpoints move by the same delta, arc-direction edits where dragging the far endpoint of one tangent arc updates the neighboring tangent arc to keep the shared tangency, and parallel translation of a whole tangent arc where both tangent-arc endpoints move by the same delta.
- Direct arc endpoint drag now preserves `equal-radius` relations when the moved arc's radius must grow: related semantic arcs are resized through the same analytic radius propagation used by driving radius edits, and the relation is kept when the resulting radii remain equal.
- Direct arc endpoint drag now preserves `concentric` relations when the moved arc's center shifts: related semantic arcs are translated to the new analytic center while preserving their own radii, related `Point On Circle` vertices are translated with those arcs, and the relation is kept when centers remain coincident.
- Direct arc endpoint drag now also projects `Point On Circle` vertices on moved source arcs after the arc's analytic center or radius changes, for both standalone sketches and plate-hosted sketches.
- Standalone sketch vertex edits now include construction vertices, so a construction point constrained by `Point On Circle` can be dragged in sketch mode and solved back onto the analytic arc radius before Convert To Plate. Driving radius edits also move `Point On Circle` vertices on affected arcs onto the new analytic radius, keeping those circle constraints valid when the user resizes a rounded sketch.

### Slice 5: Contextual Sketch Toolbar

Status: initial feature-navbar implementation plus standalone sketch Convert To Plate, construction-edge Trim, Fix, and Coincident relation commands in `codex/agent3`.

- Add sketch command metadata and workspace toolbar group.
- Teach `mountModelingToolbar` or its owner to render command sets by active context.
- Wire sketch context from `plateSketchEdit.activeState()`.
- Acceptance: selecting/editing a sketch changes the top toolbar from Model commands to Sketch commands, and clearing/exiting sketch restores Model.

Initial scope:

- while a plate sketch is active and selected, the `Model` feature navbar group renders as `Sketch`
- the feature navbar hides general model commands and shows contextual sketch commands instead
- implemented contextual commands: Line, Line Contour, Circle, Diameter Circle, 3 Point Circle, Center Rect, Rounded Rect, Slot, Center Slot, Center Arc, Center Arc Contour, 3 Point Arc, 3 Point Arc Contour, Edge Arc, Flip Arc, Split Arc, Trim, Extend, Delete, Convert To Plate, Fillet, Radius, Diameter, Fix, Coincident, On Circle, Tangent, Concentric, Equal Radius, Show/Hide Relations, Infer Relations, Clean View, Clear
- Fix is a toolbar-level toggle for one selected sketch point or edge and reuses the existing `fixed` relation metadata. Selected construction points use the same fixed relation with construction-point-specific status text, so fixing arc helper points behaves like fixing ordinary sketch points. Fillet remains scoped to outline sketch corners, is disabled for construction points, and its direct controller path rejects construction points before topology mutation.
- Coincident is a toolbar-level relation for two selected sketch points and reuses the existing point relation solver
- Sketch relation quick actions now filter by edge kind: point-plus-arc offers Point On Circle instead of Point On Line/Midpoint, two-points-plus-arc hides Symmetric, single arcs offer Radius/Diameter/Fixed/Clear instead of horizontal/vertical line constraints, and edge pairs containing arcs offer arc-aware relations only. Automatic sketch snap relations apply the same line/arc split, so vertex and edge drag candidates no longer attach horizontal, vertical, collinear, perpendicular, angle, or equal-length relations to circular arcs.
- Trim removes selected construction lines/arcs and their orphaned construction points/relations. It also supports a first outline-edge trim path for selected contour lines/arcs by removing the selected/default endpoint and preserving the required closed loop, and the Sketch toolbar enables Trim for those outline selections rather than only construction edges. A single selected endpoint on one selected outline line or arc now has runtime coverage proving Trim removes that chosen endpoint side rather than the default side. Two selected outline edges now support initial Trim/Extend behavior: straight-straight pairs split/remove or extend to the second line, straight-arc pairs can trim or extend the first line to an analytic point on the selected arc, arc-straight pairs can split/remove the first arc at a line crossing or extend the natural first-arc endpoint to a valid crossing on the selected line, and arc-arc pairs can split the first arc at an analytic crossing or extend the natural first-arc endpoint to an analytic crossing on the second arc while the outline stays closed. Endpoint-side selection now reports a specific wrong-endpoint status for straight-to-arc extend, matching the existing straight-straight, arc-straight, and arc-arc endpoint feedback; if the selected endpoint belongs to the second selected edge, Trim/Extend treats that edge as the trim edge so endpoint choice does not depend on selection order. Selecting multiple endpoints on one selected edge or across the two selected edges is rejected with an endpoint-choice status and no geometry change; the Sketch toolbar keeps Trim enabled for those endpoint-choice selections so the user sees the specific controller feedback.
- Extend is also exposed as its own Sketch Modify command for a more CAD-like toolbar. It reuses the same analytic line/arc extension paths as two-edge Trim/Extend, but runs in extend-only mode: already-intersecting selected outline edges report that Trim should be used instead of silently removing a side. Runtime coverage now exercises the direct Extend command across straight-straight, straight-arc, arc-straight, and arc-arc outline selections while preserving semantic circular-arc data, including endpoint-choice behavior where an endpoint selected on the second selected edge becomes the active extend side. The contextual Sketch toolbar keeps Extend enabled for that one-endpoint selection so the user can pick the side explicitly before running the command, and command-state coverage now also keeps both Trim and Extend enabled for mixed line+arc outline selections.
- Convert To Plate is enabled for standalone sketch objects and creates a plate from the stored analytic sketch with a prompted thickness
- Clean View is a dedicated Sketch toolbar command that switches the active sketch to clean mode, hides relation overlays, clears sketch entity selection, and keeps the user inside Sketch mode. The contextual `Relations` command becomes `Show Relations` while clean mode is active and toggles the same sketch back to full relation-overlay mode without leaving Sketch.
- Runtime command registration coverage now asserts the active sketch context exposes Sketch feature-navbar commands such as Rounded Rect, Radius, Extend, Clean View, and Relations while hiding all `model.*` feature-navbar commands, verifies Clean View can return through `Show Relations`, then verifies leaving sketch context restores Model commands such as Beam and Sketch creation while hiding Sketch-only commands.
- Sketch command metadata and active toolbar state now describe tools as applying to the active sketch, not only an active plate sketch, so standalone sketch editing has consistent SolidWorks-style contextual wording in command specs, feature-navbar group descriptions, and relation toggle status.
- The fixed snap/relation settings toggle now uses `Show sketch relations` / `Hide sketch relations` when an active Sketch context is available, so the legacy toolbar control no longer implies relation overlays work only for plate-hosted sketches.
- Live browser verification on the agent3 preview route with `qaSelectObject=rounded_sketch_arc_demo` confirms the active sketch renders 37 visible `sketch.*` toolbar commands, including arc, radius, diameter, relation, Trim/Extend, Clean View, and Exit commands, while no visible `model.*` commands remain in the feature navbar. Clicking the visible feature-ribbon `Exit Sketch` command then restores visible `model.*` commands such as Beam, Plate, Sketch, Work Plane, Grid, and Trim, with no visible `sketch.*` commands left in the toolbar.
- QA-only browser helpers now expose `sketchClientPoint`, `sketchSummary`, `sketchSelectEntities`, `sketchActiveState`, `sketchRenderOverlay`, `authoringHandleAtClientPoint`, `runViewerCommand`, and `viewerCommands` through the DOM bridge so browser smoke tests can click canvas points in the active sketch, select specific sketch entities, inspect Sketch toolbar command enabled/active/disabled-reason state from that selection, force a deterministic authoring-overlay refresh before pointer drags, inspect the handle that application picking sees at a viewport point, run existing viewer commands, and verify semantic edge/relation output without reading generated geometry. `viewerCommands` uses the same feature-navbar command source as the app and supports `sketch.*`/feature-navbar filtering for focused browser checks. `sketchSummary` includes compact relation details such as relation type, edge id, vertex ids, mode, display, and numeric value so browser smoke tests can prove a relation landed on the intended selected arc; it also includes construction edge details and construction edge kind counts so browser smokes can prove construction arcs remain analytic. Runtime source coverage also verifies Sketch key handling runs before generic Delete/Backspace object deletion. A real browser pointer smoke clicked the visible `Rounded Rect` Sketch toolbar command and three canvas points on the agent3 preview, producing an 8-edge standalone sketch with 4 stored `circular-arc` edges, 1 driving radius relation, 3 equal-radius relations, and 8 tangent relations.
- A follow-up real browser smoke selected one straight edge from that freshly created rounded rectangle, ran the existing `sketch.edge.arc` command, clicked a through point on the canvas, and verified the sketch changed from 4 arcs/4 lines to 5 arcs/3 lines with the converted edge stored as a semantic `circular-arc`, 2 radius relations, 3 equal-radius relations, and 6 surviving tangent relations.
- Another real browser smoke selected one semantic rounded-rectangle arc, observed the visible `sketch.arc.split` Sketch toolbar command become enabled, clicked `Split Arc`, and verified the sketch changed from 4 circular arcs, 4 lines, and 8 vertices to 5 circular arcs, 4 lines, and 9 vertices with the selected source arc replaced by two semantic child arcs.
- Another real browser smoke selected a semantic rounded-rectangle arc that did not already own a direct radius relation, observed the visible `sketch.dimension.radius` Sketch toolbar command become enabled, clicked `Radius`, and verified the sketch kept 4 circular arcs and 4 lines while radius relations increased from 1 to 2 with a new driven `radius` relation attached to the selected arc.
- Another real browser smoke on the rounded-sketch sample selected an endpoint vertex belonging to a semantic arc, forced the Sketch authoring overlay to render, verified application picking saw a `plate-sketch-vertex` handle under the projected viewport point, performed a CUA drag from `[150, -55]` to `[172, -67]`, and verified the endpoint moved while the sketch stayed at 4 circular arcs, 4 lines, 8 vertices, and 8 edges with the source edge still stored as a semantic `circular-arc` with a positive radius.
- Another real browser smoke on the rounded-sketch sample selected a semantic arc edge, forced the Sketch authoring overlay to render, verified application picking saw a `plate-sketch-edge` handle under a projected point on the arc, dragged the whole arc edge by CUA, and verified the arc's two endpoints and center moved while the sketch stayed at 4 circular arcs, 4 lines, 8 vertices, and 8 edges. That smoke also caught and fixed a standalone-sketch store/API gap: whole-edge drag now calls `setSketchVertices` for `model.sketches` instead of the plate-only batch vertex update path.
- Controller runtime coverage now verifies whole-edge dragging a semantic circular arc preserves the analytic `circular-arc` data and reports a live `arc edge offset` status, so arc drags have explicit feedback instead of only a generic drag prompt.
- Another real browser smoke on the rounded-sketch sample opened the standalone sketch's `Sketch Relations` inspector, changed the `rounded_sketch_arc_demo_e2` radius relation from reference to driving, edited the numeric radius value from `35` to `42`, and verified through the QA bridge that the stored relation value and analytic circular-arc radius both became `42` while the source topology stayed at 4 circular arcs and 4 straight lines. This also tightened shared numeric controls so inspector values commit on blur and Enter instead of depending only on the native `change` event.
- Another real browser smoke selected the same standalone arc, used the inspector `Diameter` action to switch the existing radius relation to diameter display, changed it from reference to driving, edited the diameter input from `70` to `96`, and verified through the QA bridge that the relation stayed `display: "diameter"` while storing radius `48` and resizing the analytic circular arc to radius `48`. The selected-arc inspector action list now filters out line-only actions such as Horizontal, Vertical, Length, Construction line, and line-pair constraints for arc selections, so users see arc-specific actions instead of conflict-labeled line tools.
- Another real browser smoke selected two points plus `rounded_sketch_arc_demo_e2` and verified the inspector hides the line-axis-only `Symmetric` action for a circular arc while the same two-points-plus-straight-edge selection still offers `Symmetric`. The same smoke selected a line plus arc edge pair and verified the inspector offers only the arc-aware `Tangent` relation instead of line-pair constraints.
- Another real browser smoke opened the in-canvas Sketch options quick-list on a selected standalone circular arc and verified it offers `Diameter` alongside existing `Radius`; clicking `Diameter` switches the stored radius relation to `display: "diameter"` without changing the analytic radius. The same quick-list path now uses standalone sketch relation preview, so a line+arc `Tangent` action is shown as a valid primary action instead of a false conflict, and clicking it adds the stored `tangent` relation for the selected straight/circular arc pair.
- Another real browser smoke opened the same in-canvas Sketch options quick-list on `rounded_sketch_arc_demo_e2` and verified arc edit commands now appear before relation/dimension actions: `Flip Arc`, `Split Arc`, `Fixed`, `Select Radius`, `Diameter`, and `Clear selection`. Clicking `Flip Arc` changed the selected semantic arc direction from `ccw` to `cw`; reopening the list and clicking `Split Arc` produced 5 semantic circular arcs, 4 straight lines, and 9 vertices with no browser console errors.
- Another real browser smoke selected `rounded_sketch_arc_demo_v5` plus `rounded_sketch_arc_demo_e2` and verified `Point On Circle` is hidden because that point is already an endpoint of another semantic circular arc, avoiding a failed mutation that would break the neighboring arc radius. The rounded sketch sample now includes a free construction point `rounded_sketch_arc_demo_cp1`; selecting that point plus `rounded_sketch_arc_demo_e2` offers `Point on circle`, clicking it stores `rel_point-on-circle_rounded_sketch_arc_demo_cp1_rounded_sketch_arc_demo_e2`, selects the new relation, and leaves the browser console clean.
- Another real browser smoke verified the same `Point On Circle` rule across the Sketch toolbar, command palette, and inspector: `rounded_sketch_arc_demo_v5` plus `rounded_sketch_arc_demo_e2` disables `On Circle` with an endpoint-of-another-arc reason and does not show the inspector action, while `rounded_sketch_arc_demo_cp1` plus `rounded_sketch_arc_demo_e2` enables `On Circle`, shows the inspector `Point on circle` action, and the toolbar command path stores `rel_point-on-circle_rounded_sketch_arc_demo_cp1_rounded_sketch_arc_demo_e2`. `check_viewer_runtime.js` now includes this toolbar enablement contract.
- The in-canvas Sketch options quick-list now treats construction circular arcs as construction geometry first: selected construction arcs expose `Fixed`, radius, diameter, and `Clear selection`, while only outline arcs expose `Flip Arc` and `Split Arc`. `check_viewer_runtime.js` covers both the outline-arc quick-list and construction-arc filtering so unsupported outline-only arc commands do not appear for construction arcs.
- Sketch toolbar command-state coverage now asserts the same construction-arc contract: `Edge Arc`, `Flip Arc`, and `Split Arc` are disabled for a selected construction arc, while `Radius`, `Diameter`, and `Trim` stay enabled.
- Controller runtime coverage now asserts that the enabled construction-arc dimension contract is real: direct `Radius` and `Diameter` commands add or update one driven radius relation on the selected construction circular arc while preserving the semantic construction arc.
- Runtime coverage now converts the rounded standalone sample sketch into a plate with `createPlateFromSketch`, verifies the new plate keeps the same semantic 8-edge sketch with 4 stored `circular-arc` edges and `placementIntent.sourceSketchId`, and confirms the scene builder emits plate faces for the converted rounded plate.
- Controller runtime coverage now exercises the actual `Convert To Plate` sketch command path on the rounded standalone sample: the edit controller prompts for plate thickness, creates the rounded plate through the project API, switches active sketch editing to the new plate object, and reports the created plate status.
- Line Contour post-commit reshaping coverage now includes deleting a selected closing circular arc: the contour removes the closing arc's forward point, preserves unrelated surviving semantic arcs, keeps Line Contour active, and reports the arc-specific delete status.
- Line Contour post-commit reshaping now also preserves semantic same-circle arc merges when deleting a selected split point between two child arcs. The active Line Contour path uses the store-level `removeSketchVertex` merge behavior, keeps the point chain active, selects the merged arc, and verifies the source remains one analytic circular arc rather than falling back to a straight edge.
- Sketch toolbar relation feedback now distinguishes invalid edge-relation selections for `Tangent`, `Concentric`, and `Equal Radius`: extra selected points disable the edge relation as ambiguous, two straight edges explain why `Tangent` needs an arc, line+arc selections explain why `Concentric`/`Equal Radius` need two arcs, and arc+arc or line+arc valid paths remain enabled. `check_viewer_runtime.js` covers these command-state reasons.
- Sketch toolbar dimension feedback now distinguishes common invalid arc-dimension selections: `Radius` and `Diameter` explain when a circular arc is selected with extra sketch points, and when the selected edge is straight rather than circular.
- Sketch toolbar line-dimension feedback is also arc-aware: `Length` points selected circular arcs toward `Radius`/`Diameter`, asks users to clear extra sketch points before measuring an arc selection, and `Angle` explains that line+arc selections currently require straight sketch edges.
- Controller-level line dimension commands share the same ambiguous-selection guard: direct `Length` and `Angle` calls reject selected edge-plus-point combinations before adding line-only dimension relations or mutating the sketch.
- Sketch `Distance` feedback and direct command handling now reject two selected points with an extra selected edge, telling users to clear selected sketch edges before adding a point-to-point distance relation.
- Controller-level arc dimension commands share the same ambiguous-selection guard: direct `Radius` and `Diameter` calls reject arc-plus-point selections before adding relations or mutating semantic arc geometry.
- Sketch toolbar arc-modifier feedback now also rejects ambiguous arc-plus-point selections for `Edge Arc`, `Flip Arc`, and `Split Arc`, telling the user to clear selected sketch points before running the outline-edge operation.
- Controller-level arc modifier commands share the same guard: direct `Edge Arc`, `Flip Arc`, and `Split Arc` calls reject arc-plus-point selections before starting tools or mutating semantic arc geometry.
- Sketch `Fillet` now requires one unambiguous outline corner across the toolbar and direct controller path. Corner-plus-edge mixed selections are rejected with clear feedback before adding radius geometry or mutating topology.
- Sketch `Coincident` now rejects two-point-plus-edge mixed selections in both toolbar feedback and the direct controller path, keeping point relations from being added while an edge is still part of the active selection.
- Sketch `Point On Circle` now gives specific toolbar and direct-controller feedback for arc-plus-extra-point and point-plus-extra-edge mixed selections, and rejects both cases before adding circle relations or publishing project updates.
- Sketch `Infer Relations` is now available for standalone sketches as well as plate-hosted sketches. The shared inference core now also detects tangent relations at shared line/arc or arc/arc endpoints and chains equal-radius relations across same-radius circular arcs, while still preventing horizontal/vertical/perpendicular/parallel/equal-length relations from attaching to circular arcs.
- A real browser DOM-bridge smoke now verifies that same relation feedback on the agent3 preview route through the visible feature-navbar command source: line+arc enables `Tangent` while disabling `Concentric` and `Equal Radius` with two-arc reasons, line+line disables `Tangent` with the at-least-one-arc reason, line+arc+point disables edge relations with the select-only-two-edges reason, and arc+arc enables `Concentric` and `Equal Radius`.
- Controller-level edge relation commands now share the same arc-aware feedback as the Sketch toolbar: direct command invocation rejects ambiguous edge+point selections, rejects two straight edges for `Tangent`, rejects line+arc selections for `Concentric`/`Equal Radius`, rejects geometrically unsatisfied tangent, non-concentric, and unequal-radius edge pairs before the relation mutation path, avoids mutating the sketch on those invalid paths, and still stores valid line+arc `Tangent`, arc+arc `Equal Radius`, and concentric construction-arc `Concentric` relations. Runtime coverage verifies those controller paths.
- The in-canvas Sketch options quick-list now has explicit runtime coverage for arc+arc selections: it offers only arc-aware edge relations (`Tangent`, `Concentric`, `Equal Radius`) plus clearing, keeps line-only relation/dimension actions out of that selection, and surfaces concrete conflict reasons when unsatisfied arc relations such as `Tangent` or `Concentric` would fail.
- QA-only browser helpers now also expose `sketchQuickLists`, a compact quick-list diagnostic that computes the current Sketch options from the active sketch selection through the same `relationActionOverlayForSelection` path as the authoring overlay. Runtime source coverage verifies the helper is exported with `tone`, `title`, and `relationType` fields. A real browser DOM-bridge smoke on the agent3 preview selected `rounded_sketch_arc_demo_e2` plus `rounded_sketch_arc_demo_e4`, read `sketchQuickLists` through the hidden QA input bridge, and verified one quick-list with `Tangent` and `Concentric` marked `conflicted` with relation-specific "not satisfied" titles, `Equal Radius` still `primary`, and no browser console errors.
- Line Contour post-commit reshaping coverage now includes replacing the selected first/closing contour point, preserving an unrelated semantic arc, keeping Line Contour active, and continuing the contour from that replaced closed-loop state.
- Line Contour post-commit reshaping coverage now also includes replacing the selected latest contour point, preserving an existing first-segment semantic arc, and proving the next point starts from the replacement latest point instead of the stale point.
- Replacing a selected Line Contour point now moves the existing sketch vertex through the same `setSketchVertex` path used by direct endpoint drag instead of rebuilding the whole outline. This preserves adjacent semantic circular arcs when the replaced point is an arc endpoint, updates the active contour point chain from the solver-adjusted vertex positions, and lets the next contour segment start from the actual solved latest point. Runtime coverage verifies replacing the first endpoint of a first-segment arc keeps that edge as one semantic circular arc and continues from the solver-updated closing point.
- Runtime coverage now verifies the post-replacement Line Contour state can immediately create another semantic arc with Alt-click on the new latest segment, then continue the contour while preserving both the original endpoint-adjusted arc and the newly authored latest arc.
- Line Contour selected-point replacement now rejects clicks on any other existing contour point, not only adjacent points. The active tool stays in place and the sketch is not mutated, preventing duplicate-point closed-loop topology while reshaping mixed line/arc contours.
- Line Contour normal extension now also rejects clicks on any existing contour point before mutating the stored sketch. Runtime coverage verifies the project JSON stays unchanged, the active tool remains in place, and the status explains that the point must differ from existing contour points.
- Line Contour Delete/Backspace key handling now routes through active Sketch handling for the active Line Contour tool. Runtime coverage verifies deleting the latest committed straight point preserves an earlier semantic arc, keeps Line Contour active, selects the new latest segment, and allows a replacement point to continue the contour before generic object deletion can run.
- Line Contour Escape handling now has explicit runtime coverage while a first-segment arc is staged. The test verifies Escape cancels the active contour tool before generic viewer cancel handling, clears the arc preview and sketch selection, leaves project JSON unchanged, and allows Line Contour to restart cleanly.
- Center Arc Contour and 3 Point Arc Contour now have explicit Backspace and Escape runtime coverage. The checks verify Backspace retains the first picked point, clears the second picked point, keeps the contour tool active, and still creates the semantic arc-sector contour with a radius relation. They also verify Escape cancels an in-progress arc-sector preview before generic viewer cancel handling, clears the preview, leaves project JSON unchanged, and lets the contour tool restart cleanly.
- Runtime API-register coverage now asserts the public standalone sketch surface includes round-sketch authoring and editing APIs for circles, rounded rectangles, slots, center/edge/three-point arcs, arc flip/split, fillets, radius dimensions, construction arcs, relation inference, and vertex/relation mutation, and that those entries describe standalone sketch behavior instead of plate-only behavior.
- A real browser pointer smoke on the agent3 preview clicked the visible `Line Contour` Sketch toolbar command, clicked two canvas points, Alt-clicked a through point to stage the first contour segment as an arc, and clicked a third point to commit the mixed contour. The QA bridge verified the active Line Contour tool stayed active, the stored sketch became 3 edges with 1 semantic `circular-arc` and 2 lines, a driven radius relation was written for the arc, and the browser console stayed clean.
- Visible active-sketch overlay wording now uses `Sketch` as the heading instead of `Plate sketch`, matching the contextual toolbar/tab language for standalone and plate-hosted sketches. Runtime source coverage guards this alongside the existing Show/Hide sketch relations wording check.
- Runtime source-data coverage now guards `sample_rounded_sketch.json` itself: the rounded sample must keep 8 source vertices, 8 source edges, 4 semantic `circular-arc` edges with only `center`/`radius`/`direction` analytic fields, and no stored mesh, triangle, face, polyline, sampled-point, tessellated-point, scene-graph, or generated-geometry fields.
- Runtime render coverage now builds the rounded standalone sketch sample through the scene builder and verifies it emits more line segments than the 8 source edges, includes many intermediate curve points derived at runtime, does not draw any circular arc as a direct source-endpoint chord, and still emits a sketch face for the rounded outline.
- Static rounded plate coverage now adds `sample_rounded_plate.json` plus the `rounded-plate-1` viewer demo. Runtime checks load that file from disk, verify the plate keeps 8 source vertices, 8 source edges, 4 analytic `circular-arc` edges with no stored generated geometry, and confirm the scene builder emits rendered plate faces and sampled curve edges rather than direct source-endpoint chords. The same runtime guard now calls the model/export-facing `geometryApi.plateOutline()` path and verifies it derives an outline with runtime arc samples instead of direct arc chords.
- Weld evaluator coverage now creates a runtime-only plate-support-edge fillet weld against a tangent plane on the rounded plate's corner arc, runs `evaluateWeld`, and verifies the selected support edge comes from sampled rounded-plate outline points rather than only source arc endpoint chords.
- Feature layout check coverage now exercises `ctx.check.gridFitsPlate` against a hole point inside a rounded plate corner that a chord-only source-vertex outline would reject, proving the check consumes the sampled semantic-arc outline from `ctx.geometry.plateOutline()`.
- Connection primitive coverage now runs the `web-bolt-pattern` secondary-web bolting builder with a runtime rounded plate and custom single-hole layout in that same rounded corner. The guard proves the primitive's layout bounds and `gridFitsPlate` validation path can place and accept a feature/fastener pattern through sampled semantic arcs instead of chord-only source vertices.
- Boolean cutter coverage now allows a `boolean-part` `polygonal-prism` body to store a semantic `body.sketch` instead of generated `body.outline` points. Runtime checks resolve that sketch into sampled arc outline points for CSG/rendering, verify a plate-level boolean cut changes the plate geometry, and keep legacy `body.outline` cutter editing intact.
- Insert-vertex coverage now supports circular-arc outline edges for standalone and plate-hosted sketches. The shared insert path delegates arc insertion to the semantic split-arc operation, preserving arc center/radius/direction, adding the inserted vertex, and creating tangent plus radius relations for the two child arcs instead of falling back to straight edges.
- Controller runtime coverage now verifies the actual `Drag to add point` insert handle on a semantic circular arc. The authoring handler begins from the arc's insert handle, crosses the drag threshold, splits the source arc into two semantic child arcs, adds one stored vertex, and selects the inserted vertex for continued editing.
- A real browser pointer smoke now verifies `Drag to add point` on `rounded_sketch_arc_demo_e2` through the actual canvas pointer path. The browser confirms application picking sees the `plate-sketch-insert-vertex` handle, drags it past threshold, and verifies the source sketch changes from 8 edges/4 circular arcs/8 vertices to 9 edges/5 circular arcs/9 vertices, removes the source edge, selects the inserted `v18` point, reports `Plate sketch: point added`, and leaves the console clean. This fixed a browser-only stale-detail path where the inspector/toolbar could keep the removed arc selected and overwrite the status with `plate sketch edge not found`.
- Sketch Delete coverage now includes a normal selected outline circular arc outside Line Contour mode. The controller removes the selected arc from the closed sketch, clears stale relations, preserves surviving semantic arcs, clears selection, and the contextual toolbar enables `Delete` for a single selected outline arc.
- A real browser smoke on the agent3 preview route now verifies that same selected-outline-arc Delete path through the visible Sketch toolbar. The smoke selects `rounded_sketch_arc_demo_e2`, confirms the feature-navbar `Delete` button is uniquely visible and enabled, clicks that actual button, and verifies the source sketch changes from 8 edges/4 circular arcs to 7 edges/3 circular arcs with the target arc removed, selection cleared, and no browser console errors.
- Runtime workflow coverage now starts from a straight standalone center-rectangle sketch, runs the public `filletSketchCorner` store API to replace one sharp corner with a semantic radius arc and radius relation, then runs `createPlateFromSketch` and verifies the converted plate preserves that single `circular-arc` edge, stores `placementIntent.sourceSketchId`, and emits rendered plate faces.
- Runtime workflow coverage also starts from a straight plate-hosted sketch, runs the public `filletPlateSketchCorner` store API, and verifies the existing plate gains one semantic radius arc plus radius relation while remaining renderable as a plate face.
- WebGL pick/render now skips untriangulatable filled faces instead of throwing during snap visibility checks. This keeps mixed arc Line Contour authoring alive when a transient sketch face fill cannot be triangulated, while preserving outline lines and stored semantic sketch geometry.
- A real browser pointer smoke on the agent3 preview route now verifies post-commit mixed Line Contour reshaping through visible UI: click `Line Contour`, create a three-edge contour with an Alt-staged first semantic arc, select that stored arc from the visible sketch detail row, click the arc on the canvas to split it into two semantic child arcs, then click another canvas point to continue the contour. The stored sketch progresses from 3 edges/1 arc to 4 edges/2 arcs to 5 edges/2 arcs, `Line Contour` remains active, the source arc id is removed, and the browser console stays clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Rounded Rect` through the visible Sketch toolbar and actual canvas picks. Clicking center, corner, and radius points stores 8 source vertices, 8 source edges, 4 semantic `circular-arc` corners, 4 line edges, one radius relation, equal-radius/tangent relations, radius 15 mm on every corner arc, keeps `Rounded Rect` active for another rectangle, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Circle` through the visible Sketch toolbar and actual canvas picks. Clicking center and radius points stores 4 source vertices and 4 semantic quarter-circle `circular-arc` edges, one radius relation, equal radii on all four arcs, keeps `Circle` active for another circle, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Diameter Circle` through the visible Sketch toolbar and actual canvas picks. Clicking two diameter endpoints stores 4 source vertices and 4 semantic quarter-circle `circular-arc` edges, one driven radius relation, equal radius 36.05551275463987 mm on all four arcs, keeps `Diameter Circle` active for another circle, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `3 Point Circle` through the visible Sketch toolbar and actual canvas picks. Clicking three non-collinear perimeter points stores 4 source vertices and 4 semantic quarter-circle `circular-arc` edges, one driven radius relation, equal radius 47.48791468169903 mm on all four arcs, keeps `3 Point Circle` active for another circle, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Center Arc Contour` through the visible Sketch toolbar and actual canvas picks. Clicking center, start, and end points stores a closed 3-edge sector contour with 3 source vertices, 2 line radius edges, 1 semantic `circular-arc` edge, 1 driven radius relation matching the stored arc radius 64.81984599588392 mm, selects the new arc, keeps `Center Arc Contour` active for another sector, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `3 Point Arc Contour` through the visible Sketch toolbar and actual canvas picks. Clicking start, through, and end points stores a closed 3-edge sector contour with 3 source vertices, 2 line radius edges, 1 semantic `circular-arc` edge, 1 driven radius relation matching the stored arc radius 36.9254424710285 mm, selects the new arc, keeps `3 Point Arc Contour` active for another sector, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Edge Arc` through the Sketch toolbar against a freshly created `Center Rect`. The smoke clicks `Center Rect`, clicks center and corner canvas points to store a four-line rectangle, selects one straight outline edge, clicks the toolbar `Edge Arc` command, then clicks a canvas through point. The stored sketch stays at 4 source vertices and 4 source edges while changing to 3 straight lines and 1 semantic `circular-arc` edge, writes one driven radius relation matching the stored 84.07991597196491 mm arc radius, selects the converted arc, clears the active `Edge Arc` pick tool, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Center Arc` through the visible Sketch toolbar and actual canvas picks. Clicking center, start, and end points preserves the existing rounded outline at 8 source vertices and 8 source edges, increases construction vertices from 1 to 3, stores one analytic construction `circular-arc` edge with radius 40.0222075063281 mm, selects the construction arc, keeps `Center Arc` active for another construction arc, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `3 Point Arc` through the visible Sketch toolbar and actual canvas picks. Clicking start, through, and end points preserves the existing rounded outline at 8 source vertices and 8 source edges, increases construction vertices from 1 to 3, stores one analytic construction `circular-arc` edge with radius 48.9504158694399 mm, selects the construction arc, keeps `3 Point Arc` active for another construction arc, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Flip Arc` through the visible Sketch toolbar, including horizontally scrolling the Sketch ribbon to the command. Selecting `rounded_sketch_arc_demo_e2` and clicking `Flip Arc` preserves the rounded outline at 8 source vertices, 8 source edges, 4 semantic circular arcs, and 4 straight lines; the selected arc keeps the same id, endpoints, and 35 mm radius while changing direction from `ccw` to `cw` and moving its center from `[115, -55]` to `[150, -90]`; the arc remains selected and the browser console stays clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Split Arc` through the visible Sketch toolbar. Selecting `rounded_sketch_arc_demo_e2` enables the feature-navbar command, clicking the actual `Split Arc` button replaces the source arc with semantic child arcs `e18` and `e19`, adds midpoint vertex `v18`, changes the rounded outline from 8 vertices/8 edges/4 circular arcs to 9 vertices/9 edges/5 circular arcs while preserving 4 straight edges, keeps the two child arcs plus inserted point selected, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Diameter` through the visible Sketch toolbar. Selecting `rounded_sketch_arc_demo_e2` enables the feature-navbar `Diameter` command, clicking the actual toolbar button updates the existing `rel_radius_rounded_sketch_arc_demo_e2` radius relation to `display: "diameter"` while keeping value `35`, leaves the analytic arc geometry unchanged at 8 vertices/8 edges/4 circular arcs/4 straight lines with radius 35 mm, selects the updated dimension relation, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Convert To Plate` through the visible Sketch toolbar. Selecting the standalone `rounded_sketch_arc_demo` enables the feature-navbar `To Plate` command, clicking the actual toolbar button creates `rounded_sketch_arc_demo_plate`, switches active Sketch editing from `model.sketches` to the new `model.plates` object, and preserves the rounded sketch source at 8 vertices, 8 edges, 4 semantic `circular-arc` edges, 4 straight edges, and 4 radius relations with no browser console errors.
- A real browser pointer smoke on the agent3 preview route now verifies line-to-arc `Extend` through the visible Sketch toolbar. The smoke clicks the actual `Line Contour` command and four canvas points to store a four-line contour, selects the vertical edge, clicks the actual `Edge Arc` button, and clicks a through point to convert that edge into a semantic `circular-arc`; selecting the first line plus that arc enables `Extend`, and clicking the actual toolbar button moves the line endpoint from `[40, 0]` to `[50, 0]` on the analytic arc while the sketch stays at 4 vertices, 4 edges, 1 semantic circular arc, 3 lines, and 1 radius relation with no browser console errors.
- A real browser pointer smoke on the agent3 preview route now also verifies arc-to-line `Extend` through the visible Sketch toolbar. The smoke clicks the actual `Line Contour` command and four canvas points, selects the first straight edge, clicks the actual `Edge Arc` button, Alt-clicks the through point `[20, 4]` so snap does not collapse the point onto the source line, then selects the new semantic arc plus the vertical line and clicks the actual enabled `Extend` button. The arc endpoint moves to approximately `[50, -5.526483]` on the selected line while the sketch stays at 4 vertices, 4 edges, 1 semantic circular arc, 3 lines, and 1 radius relation with no browser console errors.
- A real browser pointer smoke on the agent3 preview route now verifies arc-to-line `Trim` through the visible Sketch toolbar. The smoke clicks the actual `Line Contour` command and four canvas points to build an intersecting line/arc fixture, converts the vertical edge into a semantic circular arc through `[70, 30]`, selects that arc plus the crossing horizontal line, and clicks the actual enabled `Trim` button. The stored sketch keeps 4 vertices and 4 edges, preserves 1 semantic circular arc and 3 straight lines, removes the old arc endpoint side, and stores the trim intersection at approximately `[70, 30]` with no browser console errors.
- A real browser pointer smoke on the agent3 preview route now verifies `Fillet` through the visible Sketch toolbar against a previously square `Center Rect`. The smoke clicks `Center Rect`, clicks center and corner canvas points to store a four-line rectangle, selects one outline corner, clicks the visible enabled `Fillet` command, falls back to the default 10 mm radius when `window.prompt` is unavailable in the embedded browser, and verifies the stored sketch becomes 5 vertices and 5 edges with 1 semantic `circular-arc` fillet, 4 line edges, 1 driven radius relation, 2 tangent relations, the fillet arc selected, and no browser console errors.
- A real browser pointer smoke on the agent3 preview route now verifies `Slot` through the visible Sketch toolbar and actual canvas picks. Clicking start center, end center, and radius points stores 4 source vertices, 4 source edges, 2 semantic semicircular `circular-arc` ends, 2 straight edges, one radius relation, one equal-radius relation, 4 tangent relations, equal arc radii, keeps `Slot` active for another slot, and leaves the browser console clean.
- A real browser pointer smoke on the agent3 preview route now verifies `Center Slot` through the visible Sketch toolbar and actual canvas picks. Clicking center, end-center, and radius points stores 4 source vertices, 4 source edges, 2 semantic semicircular `circular-arc` ends, 2 straight edges, one radius relation, one equal-radius relation, 4 tangent relations, equal arc radii, keeps `Center Slot` active for another centered slot, and leaves the browser console clean.
- Bent plate rendering now uses positive `fabrication.bends[].radius` values to build a visible segmented curved bend surface between the base plate and flange, instead of drawing only two flat panels meeting at a sharp line. Runtime coverage creates a rounded-plate bend on a straight sketch edge, verifies the 90 degree bend radius produces 8 curved bend surface segments at `circleSegments: 32`, confirms the flange starts at the end of the arc, and checks the scene contains the rendered bend-radius faces.
- remaining later slices should focus on post-commit contour reshaping polish and any remaining browser pointer verification for mixed sketch workflows.

## Acceptance Checks

- Existing sample projects validate unchanged.
- A rounded plate sample validates against `project.schema.json`.
- Rounded sketch geometry renders as curves, not a jagged stored polygon.
- The project JSON contains analytic arc data only, not generated tessellation.
- Snap candidates include arc endpoint, midpoint, center, and point-on-arc behavior.
- A user can add a radius/fillet to a plate-hosted or standalone sketch and then create/render the plate from the standalone sketch.
- Bent plates with positive bend radius show a visible curved bend surface between the base plate and flange.
- Active sketch editing switches the toolbar context to Sketch and back to Model.
- `node .\scripts\check_repo.js` passes.

## Risks

- Many existing helpers assume edge endpoints are enough. Renaming APIs around topology loop vs tessellated outline is safer than silently changing semantics everywhere.
- Bend normalization rejects arc-owned bend edges until curved bend support is explicitly designed.
- The relation solver is line-centric. Keep the first arc relations narrow instead of making every existing relation accept arcs.
- WebGL picking uses sampled polyline points for circular sketch edge handles; analytical picking can still be added later if needed.
