# Exec Plan 0003: Smart Component Generator Template And Stair System

## Goal

Build a reusable pattern for advanced Smart Component generators, then use it to implement a stair system that can cover practical steel stair variants:

- straight stairs
- stairs with landings
- multi-flight stairs
- L/U/switchback stairs
- winder stairs
- curved stairs
- spiral stairs
- helical stairs
- custom path stairs
- different tread/support/railing/connection/transport split variants
- UK Part K compliance by default, with other rule packs attachable later

This plan is written as a template for future generators such as gates, frames, platforms, ladders, conveyors, or facade systems.

## Core Principle

The app core must not contain hardcoded stair components.

The app core should provide generic Smart Component platform features:

- stable IDs
- nested Smart Components
- field overrides
- detach/reset behavior
- generic route/path helpers
- generic compliance/rule diagnostics
- generic sectioning/schedule support
- generic UI rendering for declared parameters

The stair generator must live in the Smart Component library and use only public app APIs.

## Non-Goals

- Do not add OpenCascade or a general CAD kernel.
- Do not store meshes, B-reps, triangles, or generated scene geometry in project JSON.
- Do not make exporters rebuild stairs from presets; project objects stay explicit.
- Do not hardcode stair families, stair regulations, or stair UI in app core.
- Do not make a single huge stair generator that contains every variant in one file.

## Source References

Use regulation references as rule-pack source material, not as hardcoded core behavior.

- GOV.UK Approved Documents collection: https://www.gov.uk/government/collections/approved-documents
- Approved Document K, Protection from falling, collision and impact: https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/996860/Approved_Document_K.pdf
- Approved Document M, Access to and use of buildings: https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/990362/Approved_Document_M_vol_2.pdf
- BS 5395 stair series entry point: https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+5395

## Success Criteria

The system is complete when all of these are true:

- a stair is described by route, levels, families, rule pack, and sectioning rules
- every generated member/plate/feature/fastener/weld is stored as normal project JSON
- nested Smart Components can represent flights, landings, railings, connections, and split joints
- manual edits survive regeneration through `fieldOverrides` or detach behavior
- the stair can be regenerated after unrelated project edits without losing fine tuning
- UK Part K diagnostics are reported with object/parameter references and fix hints
- other rule packs can be added without changing core code
- new tread/support/railing/connection variants can be added as library components
- straight, landing, curved, spiral, helical, and split-section samples pass checks
- the same architecture can be reused by another generator, for example a gate generator

## Generator Template For Any Future Smart Component

Use this pattern for every complex generator.

### 1. Define The Domain Object

- Name the top-level component kind, for example `stair-system`, `gate-system`, `frame-system`.
- Define what the object owns.
- Define what should be child Smart Components.
- Define what is generated geometry and what is only authoring metadata.
- Define what manual edits are allowed to override.

### 2. Define The Placement And Route Model

- Every advanced generator needs a placement model.
- Use points, axes, planes, paths, segments, and station frames.
- Do not bake placement into one-off `start/end` calculations in the build file.
- Output a solved semantic layout before generating physical objects.

Examples:

- stairs: walking line, route segments, levels, stations
- gates: opening line, hinge axis, swing arc, track path
- frames: grid line, bay spacing, roof planes

### 3. Define Families

- Split the generator into swappable families.
- Families are selected by `componentRef` or parameter values, not core code.
- Each family should be a small Smart Component or recipe module.

Examples:

- stairs: tread family, support family, railing family, connection family
- gates: leaf family, post family, hinge family, lock family, automation family

### 4. Define Rule Packs

- Compliance must be data-driven.
- Rule packs live in data/library space.
- Rule packs return diagnostics, not hidden geometry changes.
- Diagnostics must point to parameter paths, object roles, and measured values.

### 5. Define Overrides And Detach Behavior

- Generated objects start as `managed`.
- Manual field edits become `fieldOverrides`.
- Objects can be detached when they should stop regenerating.
- Reset actions must exist per object and per field.
- Regeneration must never silently delete user fine tuning.

### 6. Define Sectioning And Schedules

- Complex objects need assemblies and sections.
- A generator should be able to group output into shop/install/transport sections.
- Section rules should include max length, max width, max height, max weight, and manual split points.
- Schedules should be generated from stored objects.

### 7. Define Tests And Samples

- Each generator needs sample projects.
- Each important variant needs a regression.
- Each override behavior needs a regression.
- Each compliance rule pack needs pass and fail samples.

## Required Platform/Core Changes

These are reusable app-level changes. They must not contain stair-specific behavior.

### 1. Smart Component Instance Lifecycle

- Keep stable role IDs for every generated object.
- Support nested Smart Components consistently.
- Store `parentInstanceId` and `parentRole`.
- Store `childComponentRoles`.
- Store `ownedObjectIds`.
- Store `objectRoles`.
- Store `detachedObjectIds`.
- Store `fieldOverrides`.
- Store `managedFields`.
- Keep `objectIndex` authoritative.
- Regeneration must remove old managed objects that are no longer generated.
- Regeneration must preserve detached objects and field overrides.

### 2. Override Application

- Apply `fieldOverrides` after generator output and before diagnostics display.
- Do not allow overrides to change `id` or `type`.
- Preserve authoring metadata.
- Mark overridden generated objects as `managed-with-overrides`.
- Add UI actions:
  - reset one field override
  - reset all overrides on one object
  - detach object from component
  - reattach/reset object to generated state

### 3. Generic Path And Station API

Add generic helpers under app API/model or app API/geometry:

- line segment path
- polyline path
- arc path
- spiral path
- helix path
- spline/custom path
- station along path
- frame at station
- offset path
- tangent/normal/binormal at station
- path length
- segment transition frames

This API must be generic. Stairs can use it, but gates, railings, conveyors, and frames should also use it.

### 4. Generic Layout Solver Support

Add a small pattern for solver output:

- `inputParameters`
- `resolvedParameters`
- `computedValues`
- `diagnostics`
- `objectRoleHints`

The solver must not write objects directly. It returns a solved semantic layout. The generator then creates members, plates, fasteners, welds, and child components.

### 5. Generic Compliance Rule-Pack Framework

Add data structures for:

- rule pack id
- jurisdiction
- edition/version
- applicability filters
- rule functions or declarative checks
- clause references
- severity
- measured value
- allowed value/range
- affected parameters
- affected object roles
- fix hints

Rule packs must be loaded from libraries, not from core code.

### 6. Compliance Diagnostics UI

Add generic UI support:

- show diagnostics grouped by Smart Component
- show severity
- show rule id and clause ref
- show measured/allowed values
- click diagnostic to highlight objects
- click diagnostic to focus parameter
- apply safe fix hints
- allow accepted deviation notes

### 7. Generic Sectioning API

Add generic helper concepts:

- section definitions
- max section length/width/height/weight
- manual split points
- automatic split points
- section assemblies
- section part ids
- section weight
- section center of gravity
- install order

No stair-specific split logic belongs in core. Core should only provide shared primitives.

### 8. Generic Weight And Schedule Helpers

Add generic helpers that calculate or summarize:

- member approximate weight
- plate approximate weight
- fastener counts
- weld lengths
- assembly weights
- section weights
- material summary

This can be approximate until exporter/manufacturing detail is mature, but it must be consistent and testable.

### 9. Generic Parameter UI Improvements

The Smart Component UI must support:

- nested parameter groups
- conditional parameter visibility
- variant selectors
- arrays/lists of segments
- add/remove segment controls
- per-role object controls
- reset overrides controls
- diagnostics beside parameters
- rule-pack selector
- computed read-only values

### 10. Generic Child Component Composition

Improve child Smart Component composition so a generator can:

- create child components by `componentRef`
- pass solved inputs to children
- update child parameters on parent regeneration
- keep child overrides
- remove old children when parent route/family changes
- preserve manually detached children

### 11. Generic Object Role Metadata

Every generated object should expose enough authoring metadata:

- `componentInstanceId`
- `componentRole`
- `componentStatus`
- family id if applicable
- section id if applicable
- station/index if applicable
- pattern id/index if applicable

### 12. Generic Regression Harness

Add reusable checks:

- create component from preset
- update parameters
- assert stable role IDs
- assert old managed objects are removed
- assert overrides survive regeneration
- assert detach survives regeneration
- assert child component lifecycle works
- assert compliance diagnostics are stable

## Required Data/Library Structure Changes

These are reusable folder/data conventions.

### 1. Smart Component Folder Shape

Use this structure for complex systems:

```text
bobercad/data/libraries/smart-components/components/stairs/
|-- stair-system/
|   |-- config.json
|   |-- build.mjs
|   `-- README.md
|
|-- flights/
|   |-- straight-flight/
|   |-- curved-flight/
|   |-- spiral-flight/
|   `-- helical-flight/
|
|-- landings/
|   |-- plate-landing/
|   `-- framed-landing/
|
|-- treads/
|   |-- plate-tread/
|   |-- folded-tray-tread/
|   |-- grating-tread/
|   `-- pan-tread/
|
|-- supports/
|   |-- twin-stringer/
|   |-- mono-stringer/
|   |-- central-spine/
|   `-- spiral-column/
|
|-- railings/
|   |-- post-and-rail/
|   |-- glass-panel/
|   |-- vertical-bar/
|   `-- wall-handrail/
|
|-- connections/
|   |-- standard-hardware/
|   `-- member-splice/
|
`-- rule-packs/
    |-- uk-part-k/
    |-- uk-part-m/
    `-- bs-5395-2/
```

Future generators should follow the same idea:

```text
components/gates/
|-- gate-system/
|-- leaves/
|-- posts/
|-- hinges/
|-- tracks/
|-- locks/
|-- automation/
|-- connections/
`-- rule-packs/
```

### 2. Rule-Pack Library Shape

Rule packs should have:

```text
rule-packs/uk-part-k/
|-- config.json
|-- rules.mjs
`-- README.md
```

`config.json` should include:

- id
- title
- jurisdiction
- source references
- edition
- applicable component kinds
- parameters required by the rule pack

`rules.mjs` should return diagnostics only.

### 3. Family Config Shape

Every family should declare:

- id
- kind
- title
- parameters
- required inputs
- generated roles
- compatible parent kinds
- compatible rule packs
- limitations

## Stair Generator Scope

The stair generator is a library implementation using the platform features above.

### 1. Top-Level Component: `stair-system`

Inputs:

- floor-to-floor height
- base placement origin
- top target plane/elevation
- route type
- route segments
- width
- stair use/category
- tread family
- support family
- landing family
- railing family
- connection family
- split strategy
- compliance rule pack

Outputs:

- child flights
- child landings
- child treads or tread sets
- child support system
- child railing system
- child connection sets
- section assemblies
- diagnostics
- schedules

### 2. Route Model

The stair route must support:

- straight
- polyline
- L shape
- U shape
- switchback
- landing segment
- winder segment
- arc segment
- spiral
- helix
- custom path

Each segment must include:

- id
- type
- start station
- end station
- start elevation
- end elevation
- walking-line geometry
- width at start/end
- handedness if relevant
- landing/winder metadata if relevant

### 3. Layout Solver

The solver must calculate:

- number of risers
- number of treads
- exact rise
- exact going
- pitch
- total run
- segment runs
- landing sizes
- walking-line stations
- tread frames
- support frames
- railing post candidate stations
- compliance measurements

The solver must support:

- fixed step count
- auto step count
- fixed rise
- target rise
- fixed going
- target going
- fixed pitch
- max/min values from rule pack
- manual landing positions
- auto landing insertion
- custom overrides

### 4. Flight Types

Implement these as child components:

- straight flight
- curved flight
- spiral flight
- helical flight
- winder flight
- custom path flight

Each flight receives solved stations and frames. It should not solve the whole stair again.

### 5. Landing Types

Implement:

- plate landing
- framed landing
- grating landing
- top landing
- bottom landing
- intermediate landing
- shared landing between flights

Landing outputs:

- plates
- supporting beams
- edge trims
- connection zones
- railing edge references

### 6. Tread Families

Implement families:

- flat plate tread
- folded tray tread
- checker plate tread
- grating tread
- pan tread with infill
- timber/stone/glass supported tread
- open riser
- closed riser
- tread with nosing
- tread with anti-slip insert
- tread with side returns
- removable tread

Each tread family must support:

- thickness/depth/width
- nosing
- holes/slots
- fixing method
- material
- finish
- index/marking

### 7. Support Families

Implement families:

- twin side stringers
- plate stringers
- sawtooth stringers
- RHS/CHS stringers
- mono stringer
- central spine
- central column for spiral
- wall brackets
- hanger rods
- landing support beams
- support columns
- folded plate body

Each support family must support:

- profile/material
- offset from walking line
- side selection
- splice locations
- end connection references
- fabrication marks

### 8. Railing Families

Implement families:

- no railing
- post and handrail
- top rail plus mid rail
- vertical bar infill
- glass panel infill
- mesh infill
- cable infill
- toe board
- wall handrail
- inner/outer spiral handrail
- removable rail sections

Railing solver must support:

- post spacing
- rail height
- handrail extensions/returns
- landing rail continuity
- openings/gates
- side selection
- compliance diagnostics

### 9. Connection Families

Connections are nested Smart Components.

Implement:

- tread to stringer bolted tab
- tread to stringer welded
- tread cleat
- tread countersunk fixing
- stringer to landing
- stringer base plate
- stringer top plate
- stringer splice plate
- mono spine splice
- central column base
- rail post base
- glass clamp
- wall bracket
- lifting lug
- temporary install lug

Connection components must:

- use stored interfaces/connection zones
- not infer vague proximity
- output plates/holes/fasteners/welds explicitly
- support suppression/overrides like other Smart Components

### 10. Split And Transport Sectioning

Implement split strategies:

- no split
- split at landings
- split by max length
- split by max width
- split by max height
- split by max weight
- split by manual stations
- split by install sequence
- split by lift/carry constraint

For each section output:

- section id
- assembly id
- object ids
- estimated weight
- bounding size
- center of gravity
- splice connection ids
- install order
- notes

### 11. Weight And Fabrication Outputs

Generate schedules:

- members
- plates
- treads
- landings
- rail posts
- fasteners
- welds
- assemblies
- transport sections
- compliance report

### 12. UK Part K Default Compliance

Default stair-system rule pack:

- UK Part K for protection from falling, collision, and impact
- optional Part M accessibility checks where the stair use requires it
- BS 5395-2 style rule pack for spiral/helical/special stairs

The rule pack must report:

- rise issues
- going issues
- pitch issues
- inconsistent rise/going
- landing issues
- headroom issues
- handrail issues
- guarding issues
- opening/gap issues
- spiral walking-line issues
- railing height/post spacing issues
- warnings for special/non-standard stair types

Every diagnostic must include:

- severity
- rule id
- source reference
- measured value
- allowed value/range
- affected parameter paths
- affected object roles
- optional fix hints

### 13. Stair UI

Top-level UI sections:

- General
- Route
- Levels
- Geometry
- Flights
- Landings
- Treads
- Supports
- Railings
- Connections
- Splits/Transport
- Compliance
- Overrides
- Schedules

UI requirements:

- add/remove route segment
- reorder route segments
- choose family per subsystem
- show computed rise/going/pitch
- show compliance diagnostics inline
- focus object from diagnostic
- apply fix where safe
- reset override per field/object
- detach/reattach object
- preview section weights and split points

### 14. Samples

Create samples:

- `sample_stair_straight_basic.json`
- `sample_stair_straight_with_landing.json`
- `sample_stair_l_shape.json`
- `sample_stair_u_switchback.json`
- `sample_stair_winder.json`
- `sample_stair_curved.json`
- `sample_stair_spiral.json`
- `sample_stair_helical.json`
- `sample_stair_mono_stringer.json`
- `sample_stair_grating_treads.json`
- `sample_stair_glass_rail.json`
- `sample_stair_transport_split_weight.json`
- `sample_stair_manual_split.json`
- `sample_stair_compliance_failures.json`

### 15. Tests

Add tests for:

- stable object role ids
- step count increase/decrease
- old managed objects deleted
- overrides survive parameter regeneration
- overrides survive unrelated member creation
- detach survives regeneration
- child components created/updated/deleted correctly
- nested connections remain valid
- split by max weight
- split by manual station
- compliance pass/fail diagnostics
- UK Part K default rule pack loaded
- spiral/helical rule pack diagnostics
- schedules contain expected object ids
- project schema validation
- viewer geometry build

## Implementation Order

1. Harden generic Smart Component override/reset/detach lifecycle.
2. Add generic path/station/frame API.
3. Add generic solver output convention.
4. Add generic rule-pack loading and diagnostics model.
5. Add generic compliance diagnostics UI.
6. Add generic sectioning/weight/schedule helpers.
7. Add child component composition lifecycle improvements.
8. Create stair folder structure and top-level `stair-system`.
9. Build straight route solver using the new generic APIs.
10. Build straight flight, plate tread, twin stringer, and basic connection families.
11. Add UK Part K rule pack skeleton and first diagnostics.
12. Add landings and multi-flight route support.
13. Add railing families.
14. Add split/transport sectioning.
15. Add curved/spiral/helical route support.
16. Add full sample matrix.
17. Add regression matrix.
18. Use the same template to start a second generator, for example `gate-system`, to prove the architecture is reusable.

## Definition Of Done

This plan is done only when:

- stairs are not hardcoded in app core
- stair variants are library components
- rule packs are library data/code
- route solving is generic and reusable
- nested Smart Components are stable
- overrides and detach are safe
- compliance diagnostics are actionable
- transport split logic produces stored assemblies
- sample matrix validates
- checks pass
- another generator can reuse the same pattern without new core concepts
