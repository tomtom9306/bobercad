# Stair System Smart Component

`stair-system` is the top-level stair generator. It is a library Smart Component, not app core code.

The component follows the reusable generator pattern:

- solve route, levels, families, compliance, and sectioning into a semantic layout
- create child Smart Components for flights, treads, supports, landings, railings, connections, and sections
- generate only normal project JSON objects through the public Smart Component build API
- keep rule checks in library rule packs
- preserve child overrides through normal nested Smart Component lifecycle

Future generators should use the same shape: a top-level system component with a solver and small swappable child families.
