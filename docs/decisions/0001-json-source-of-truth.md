# ADR 0001: JSON Project File Is The Source Of Truth

## Status

Accepted.

## Context

The project is a web-based steel BIM application inspired by Tekla-style workflows. The initial requirement is a simple, readable data model that can later support a viewer, editor, NC1, IFC, STEP, and fabrication drawings.

## Decision

The project file is a database-like JSON file. It stores semantic model data, relationships, BIM metadata, fabrication data, tracking data, and display metadata.

It does not store generated geometry.

`objectIndex` is stored and authoritative for the early version because simplicity is more important than robustness at this stage.

Profiles and materials live in separate libraries.

Profiles are defined by point-based section contours, not by web/flange parameter fields.

## Consequences

- The viewer must derive geometry from project, profile, and material JSON.
- Future editor commands must update both object collections and `objectIndex`.
- Schema changes must happen with model changes.
- Exporters must consume model data, not viewer geometry.

