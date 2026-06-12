# Data Model

The product is a JSON-first steel BIM system. The JSON model is a database-like source of truth.

## Files

- `bobercad/data/projects/sample_structure.json` - sample beam-column connection project and model database.
- `bobercad/data/projects/sample_portal_frame.json` - sample grid-based portal frame project and model database.
- `bobercad/data/projects/sample_connection_test_frame.json` - clean four-column top-frame project for connection add/remove/change workflows.
- `bobercad/data/projects/sample_beam_to_beam_fin_plate.json` - horizontal beam-to-beam fin plate connection sample with generated flange notches.
- `bobercad/data/projects/sample_beam_to_beam_end_plate.json` - beam-to-beam end plate connection sample with a stored top flange notch and web bolt pattern.
- `bobercad/data/projects/sample_trimming_lab.json` - trimming development sample with several intersecting members, trim joints, reference planes, and boolean-part features.
- `bobercad/data/projects/sample_authoring_nc1_test.json` - compact regression sample for authoring patterns and NC1-ready data.
- `bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json` - point-based profile library.
- `bobercad/data/libraries/materials/material-libraries/starter-materials/config.json` - material library.
- `bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json` - bolt, blind bolt, hook bolt, anchor, stud, nut, and washer catalog library.
- `bobercad/data/libraries/smart-components/smart-component-register.json` - Smart Component authoring library for connections, stairs, frames, warehouses, and nested components.
- `bobercad/data/libraries/model-library/model-register.json` - frame template authoring library.
- `bobercad/app/ui/viewer/viewer-settings.json` - viewer-only camera, UI, control, and render settings.
- `bobercad/app/schemas/project.schema.json` - schema for project files.
- `bobercad/app/schemas/profile-library.schema.json` - schema for profile libraries.
- `bobercad/app/schemas/material-library.schema.json` - schema for material libraries.
- `bobercad/app/schemas/fastener-library.schema.json` - schema for fastener libraries.
- `bobercad/app/schemas/smart-component.schema.json` - schema for reusable Smart Component definitions.
- `bobercad/app/schemas/smart-component-register.schema.json` - schema for the Smart Component register.
- `bobercad/app/schemas/model-library.schema.json` - schema for frame template libraries.
- `bobercad/app/schemas/viewer-settings.schema.json` - schema for viewer settings.

## Non-Negotiable Model Rules

- Project JSON stores semantic model data only.
- Do not store meshes, vertices, triangle indexes, B-reps, display geometry, generated solids, NC1 output, IFC output, STEP output, or drawing linework.
- Viewer/editor/exporter geometry is always derived.
- `objectIndex` is stored and authoritative for now. Keep it in sync manually until app commands can maintain it.
- Materials live in `bobercad/data/libraries/materials/material-libraries/starter-materials/config.json`; project objects reference them with `"material": "S355"`.
- Profiles live in `bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json`; members reference them with `"profile": "PROFILE_ID"`.
- Fasteners live in `bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json`; fastener groups reference catalog entries with `"fastenerRef": "M16_8_8"` directly or through `modelDefaults`.
- Smart Component presets live in `bobercad/data/libraries/smart-components/smart-component-register.json`; project instances store `sourceComponent`, `referenceParameters`, `objectRoles`, and owned object ids.
- Connections are Smart Components with `kind: "connection"`. They use the same instance model and API as stairs, frames, warehouses, and nested components.
- Frame templates live in `bobercad/data/libraries/model-library/model-register.json`; project groups/assemblies may keep `sourceTemplate` provenance, but stored project objects remain the source of truth.
- Hole and slot positions live in `model.holePatterns`; repeated object authoring lives in `model.objectPatterns`.
- Notches and other generated trims should be stored as semantic `clearance-cut` / cut-feature intent. The viewer/exporter derives temporary cutter geometry from the referenced member region and per-surface offsets.
- Repeated object values live in `modelDefaults`; objects only store fields that differ from those defaults.
- BIM metadata lives on the object in a `bim` block.
- Viewer camera, UI, and render preferences do not belong in project JSON; keep them in `bobercad/app/ui/viewer/viewer-settings.json`.

## Default Resolution

The app resolves every model object before use:

1. Collection default: `modelDefaults.collections.<collection>.*`
2. Type default: `modelDefaults.collections.<collection>.<type>`
3. Object data: `model.<collection>.<id>`

Later levels override earlier levels. Nested objects are merged, so an object can set only `bim.propertySets.Identity.mark` and still inherit default BIM category/type values.

Keep defaults semantic. They can store repeated project data such as material, profile, cardinal point, visibility, tracking, fabrication status, and default BIM property values. They must not store meshes, generated solids, drawing output, scene data, or exporter output.

## Member Geometry Convention

Defined in `bobercad/data/projects/sample_structure.json/settings/modelingConvention`:

- `memberLocalX`: start-to-end
- `memberLocalY`: profile-section-y-width-axis
- `memberLocalZ`: profile-section-z-depth-axis
- `memberRotation`: degrees-about-member-local-x
- `cardinalPoint`: profile-reference-point-name
- `objectIndex`: stored-and-authoritative

Viewer and editor work must follow these conventions.

`member.start` and `member.end` are the physical member axis used for geometry. A member may also store `layoutAxis.start` and `layoutAxis.end` as its virtual/layout axis for authoring; when omitted, the physical axis is also the layout axis. Automatic connection Smart Component creation uses layout axes to find the intended joint, then creates stored interfaces, a connection zone, and an assembly against the physical member geometry.

Edit constraints are stored as first-class objects in `model.relations`, indexed through `objectIndex`. Members do not store relation arrays. Current relation types include `point-on-axis` and `member-align-axis`: `member.start` and `member.end` remain the authoritative geometry, and deleting a relation must leave the current member coordinates unchanged. When automatic relations are enabled in the viewer, snapping a member endpoint to another member axis, layout axis, fixed grid axis, or contextual global X/Y/Z creates a `point-on-axis` relation for that endpoint only. Whole-member axis alignment is a separate explicit `member-align-axis` relation created by member UI commands such as Align X/Y/Z or Pick Custom Axis.

## Work Points And Reference Planes

Use `model.workPoints` for named, stored construction points that AI agents and editors can reference without guessing coordinates.

A member can include `startPointRef` and `endPointRef`, but `start` and `end` remain the authoritative geometry. The refs are for authoring clarity, review, and future QA checks. They must not be used as hidden fallbacks to fill missing member coordinates.

Use `model.referencePlanes` for stored semantic planes such as roof slopes, facade planes, floor planes, truss center planes, and connection working planes. A reference plane is not a mesh, a surface body, or generated geometry. It is a named plane with origin, normal, local axes, and optional extents.

For roof and truss work, prefer this pattern:

- store the roof slope planes once in `referencePlanes`
- store grid/node points in `workPoints`
- store each member with explicit `start`, `end`, and optional point refs
- keep `placementIntent` as descriptive metadata only

## Object Patterns

Use `model.objectPatterns` for authoring repetition such as linear column lines, purlin rows, circular stairs, mirrored plates, or repeated bracing bays.

Object patterns do not replace stored objects. Every generated object must still exist in its normal model collection. A pattern records authoring history and edit intent:

- `sourceObjectIds`: objects used as the pattern seed
- `generatedObjectIds`: all stored objects that belong to the pattern
- `detachedObjectIds`: objects that were manually changed and must not be moved by future pattern edits
- `transform`: spacing, direction, count, axis, or other repeat data

Individual objects can also carry an `authoring` block with `patternId`, `patternIndex`, and `patternStatus`. Allowed statuses are `source`, `linked`, `detached`, and `deleted-from-pattern`.

If a user breaks a pattern, do not delete the stored object. Change its `authoring.patternStatus` to `detached` and keep its explicit geometry.

## Hole Patterns And Features

Use `model.holePatterns` only for hole, slot, and fastener positions on a stored feature reference plane.

Features reference hole patterns with `holePatternRef`. Do not use generic `patternRef`.

For notches and other body cuts, use explicit semantic feature types:

- `boolean-part` with `teklaClass: "BooleanPart"` for part cuts, polygon cuts, boolean adds, and weld prep objects.
- `edge-chamfer` with `teklaClass: "EdgeChamfer"` for chamfers.

Do not store member end trimming as standalone features. Plane and member-to-member trims belong in `model.trimJoints`.

Use `model.trimJoints` for trim management where profiles or reference planes participate in one trim decision. A trim stores `gap`, a `participants` table, and required semantic `operations`; the joint point for multi-member operations is derived from the participant member axes at evaluation time, not stored or edited. Use `corner-trim` for multi-member corner trims and `member-trim` for one member trimmed to reference planes. Participants describe membership only. Member-to-member operations use `memberAId`/`memberBId`; `memberAEnd` and `memberBEnd` are optional explicit overrides and should be stored only for roles where the operation uses that end. `end-butt-1` trims member A to member B, `end-butt-2` trims member B to member A, `end-butt-both` trims both members to opposite contact faces so the profiles overlap by one profile thickness, `end-miter` trims both members to a shared miter plane, and `profile-cope` cuts member A with the profile of member B. `plane-trim` uses `memberAId`, `referencePlaneIds`, and `removedRegionKeys`; it does not require `memberBId`. Multiple planes in one trim operation split the member into selectable regions, and `removedRegionKeys` stores which semantic regions are removed. The viewer/exporter derives planes and temporary cutters from the operation table; do not store generated trim bodies in the project.

For `boolean-part`, store `booleanType` with Tekla-style enum names:

- `BOOLEAN_CUT`
- `BOOLEAN_ADD`
- `BOOLEAN_WELDPREP`

The feature is the selectable transparent cut object. Deleting that feature deletes the cut.

Example:

```json
{
  "id": "cut_beam_notch_1",
  "type": "boolean-part",
  "teklaClass": "BooleanPart",
  "booleanType": "BOOLEAN_CUT",
  "cutKind": "part-cut",
  "ownerId": "beam_1",
  "body": {
    "type": "box",
    "center": [0, -100, 165],
    "axisX": [1, 0, 0],
    "axisY": [0, 1, 0],
    "axisZ": [0, 0, 1],
    "size": [160, 170, 70]
  }
}
```

Do not duplicate the cut geometry in `dimensions` or `placementIntent`. For explicit cut objects, `body` is the source of truth. For semantic cuts, store the referenced source instead, for example `source.kind: "member-profile"` with `source.memberId`; the viewer/exporter derives the temporary cutter from the referenced member profile and current member placement.

Supported `boolean-part.body` primitives at this stage:

- `box` for rectangular part cuts and simple weld prep cutters.
- `polygonal-prism` for polygon cuts and square/rectangular openings.
- `cylinder` for round part cuts and round openings.

For NC1-ready member data, each feature should store enough information to locate the operation without guessing:

- `ownerId`
- `type`
- `reference.kind`
- `reference.origin`
- `reference.normal`
- `reference.localAxisY`
- `reference.localAxisZ`
- dimensions such as `diameter`, `slot`, `cut`, `outline`, or linked `holePatternRef`

Keep feature geometry semantic. Do not store NC1 output records or generated solids.

## Profile Geometry Convention

Profiles are point-based polygonal sections.

- Points are `[y, z]`.
- Contours are closed by connecting last point to first point.
- Solid contours are counter-clockwise.
- Void contours are clockwise.
- Hollow profiles use at least one solid contour and one void contour.

Do not make profile geometry depend on web/flange thickness fields as the source representation.

## Plate Geometry Convention

Plates use a stored semantic `sketch`, not `width`/`height`, `outline`, meshes, or B-reps as the source geometry.

A plate sketch is a 2D loop in local `[y, z]` plate coordinates:

- `sketch.vertices`: stable vertex ids with `[y, z]` points
- `sketch.edges`: stable edge ids connecting vertices
- `center`, `normal`, `localAxisY`, `localAxisZ`, and `thickness` define placement and extrusion

Connection generators should trim flat plates by producing a semantic `sketch`, not by storing generated mesh data. For example, a sloped fin plate may clip its local sketch against the support face and secondary-member trim plane while keeping the same plate placement axes.

Fin plate generators should start from an oversized semantic outline when slope trimming would otherwise shorten the support edge. `fit.beamGap` is the support-face-to-beam-end clearance; generated fin plate geometry should span that gap plus the configured plate length into the beam. `fit.clipBeam` controls whether the generated member trim actively trims the secondary member to the support face plane; when disabled, the trim operation stays stored with `enabled: false` for traceability. `bolts.parallelToSupport` may align the hole pattern axis to the support/column axis without rotating the plate. When `bolts.columns` is greater than one and `bolts.gauge` is zero, generators should report a diagnostic instead of inventing a gauge value.

Hole diameter should be derived from the selected fastener catalog entry and `holes.tolerance` (`tight`, `normal`, `loose`, or `custom`). `normal` uses `fastener.hole.defaultDiameter`; catalog entries may provide explicit `fastener.hole.tolerances`. `custom` uses `holes.customDiameter`. Generators should not overwrite user parameters with derived hole sizes.

Fastener groups may store semantic assembly options such as `assembly.length`, `assembly.washers.head`, and `assembly.washers.nut`. Bolt length should normally be chosen from the selected fastener catalog `lengths` list, with custom values stored as the same numeric `assembly.length`. The viewer should combine those options with fastener catalog dimensions for heads, nuts, shanks, and washers; projects should not store generated bolt meshes.

Bent plates use the same plate `sketch` plus `fabrication.bends`. This is fabrication geometry, not a mesh.

Each bend stores:

- `edgeId`: the sketch edge that acts as the bend line
- `angle` in degrees
- `radius`
- `direction`: `up` or `down`
- `flangeLength`
- optional `relief`: `none`, `round`, `rect`, `obround`, or `v-notch`

## Placement Intent

Manual objects can include `placementIntent`. This replaces older attachment metadata such as ad hoc `attachedTo` blocks for manually placed connection parts.

It must not drive rendering, silently fill missing geometry, or auto-correct object placement. Stored geometry remains authoritative:

- plates still need stored `center`, `normal`, `localAxisY`, `localAxisZ`, `thickness`, and `sketch`
- features still need stored references and `holePatternRef` where a repeated hole/slot pattern is used
- fasteners and welds still follow stored references
- missing geometry should fail validation/rendering instead of falling back to `placementIntent`

Keep `placementIntent` compact: role, host object, intended fit, flush faces, avoided zones, and split side. Do not duplicate stored geometry in `placementIntent`.

## Interfaces And Connection Zones

Use `interfaces` for named stored planes/faces that AI agents, editors, and future QA scripts can reference without guessing.

An interface is not a mesh or generated solid. Member-owned interfaces are semantic references to a member face or end, and their runtime plane is derived by the member evaluator from the member axis/path, section placement, profile geometry, and shape modifiers. Do not treat old stored `normal`, local axes, or hand-entered member face extents as authoritative.

A member-owned interface should store:

- `ownerId`
- `faceRef` such as `section.y-plus`, `section.y-minus`, `section.z-plus`, `section.z-minus`, `web-center-plane`, or `connection-secondary-facing-section-face` for connection-zone support faces
- `memberEnd` for end faces, `station` for a fixed side-face station, or `stationReference: "connection-secondary-interface-origin"` when a connection-zone side face should be resolved at the selected secondary member interface
- optional `extents` only for deliberate authoring limits; viewer/export runtime must derive the physical member face extents from the current member evaluator, profile, station, roll/twist intent, and shape modifiers

Non-member interfaces, such as reference-plane interfaces, can still store explicit `origin`, `normal`, `localAxisY`, and `localAxisZ`.

Features that reference a member-owned interface with `stationReference: "connection-secondary-interface-origin"` must also store `reference.stationReferenceInterfaceRef`, so renderers and exporters can resolve the same semantic station without connection-generator context.

Use `connectionZones` to group the logical place where objects connect. A zone names the main object, secondary objects, the relevant interface ids, and the manually stored objects that belong to that connection area. It does not generate plates, holes, fasteners, or welds.

Smart Component commands may create helper interfaces, a helper connection zone, and a helper assembly when selected member layout axes intersect and no stored zone already exists. Those helper objects must carry `authoring.lifecycle: "delete-with-smart-component"` and `authoring.componentInstanceId`, so deleting the Smart Component removes only those generated helpers and leaves manually authored zones alone.

## Generated Smart Components

Smart Component generators are authoring commands. They may create members, plates, holes, fasteners, welds, cuts, work points, interfaces, connection zones, assemblies, object patterns, and nested Smart Component instances, but once generated those objects must be stored explicitly in the project.

Smart Component definitions are library entries under `bobercad/data/libraries/smart-components/components`. A definition may use a declarative `recipe` of public operations or a `build.mjs` that calls the same public model API available to UI authoring. App core must not hardcode stairs, warehouses, frames, or specific connection types. If shared behavior is needed, expose it as a generic model API or registered primitive, then let library components call that API.

`model.smartComponentInstances` groups generated parts through `objectRoles`, `ownedObjectIds`, and `detachedObjectIds`. The generated or manually fine-tuned members, plates, holes, fasteners, welds, cuts, and patterns are normal model objects and remain the source of truth.

Smart Component suppression decisions are stored against stable roles, not transient mesh ids. For example, skipped bolts are stored as hole-pattern position indexes under `suppressedPatternPositions`; generators copy those indexes to the generated `holePattern.suppressedPositionIndices`, so renderers and exporters can skip the real holes/fasteners while the viewer may still show transparent ghost components for easy restore. Suppression also follows direct generated dependencies: suppressing a plate suppresses welds that list that plate as a participant, and suppressing a fastener group suppresses the hole positions in its referenced hole pattern.

Weld objects may split a physical weld into explicit `reference.runs`. For a fin plate `plate-support-edge` weld, each run stores an `edge` (`support`, `top`, or `bottom`), optional `side` (`front` or `back`), and `size`. A zero-size parameter means the Smart Component should omit that run, so component UIs can support one-sided welds and top/bottom return welds without adding special viewer code.

Fin plate connection Smart Components should store the secondary member assembly clearance as `fit.beamGap`. The generator enforces it with a stored `member-trim` joint containing a `plane-trim` operation, so the gap is explicit model data and the physical member end remains correct for rendering/export.

`status: "generated"` means the Smart Component can be regenerated from `sourceComponent` and `referenceParameters`. `status: "not-parametric-yet"` means the instance is manual/provenance-only.

Smart Component `sourceComponent` is provenance only. Viewers and NC1 exporters must not load `bobercad/data/libraries/smart-components/smart-component-register.json` to fill missing plates, holes, fasteners, welds, cuts, members, or dimensions.

## NC1-Ready Data

The first fabrication target is NC1. IFC and STEP are intentionally out of scope for the current data-model step.

An NC1-exportable member must be readable after default resolution and should have:

- `profile`
- `material`
- `start`
- `end`
- `rotation`
- `cardinalPoint`
- `fabrication.partMark`
- explicit `featureIds` for holes, slots, cuts, copes, notches, and mitres

NC1 exporters should read stored project objects and resolved defaults. They must not rebuild missing fabrication data from object patterns, frame templates, Smart Component presets, placement intent, or viewer geometry.

## Object Shape

Physical objects should keep related data together:

```json
{
  "id": "beam_1",
  "type": "beam",
  "start": [-2200, 0, 1500],
  "end": [-162, 0, 1500],
  "fabrication": { "partMark": "B1" },
  "display": { "color": "#9fb3c8" },
  "bim": {
    "name": "Beam B1",
    "propertySets": {
      "Identity": { "mark": "B1" }
    }
  }
}
```
