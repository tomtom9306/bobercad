import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "AGENTS.md",
    "docs/README.md",
    "docs/architecture/data-model.md",
    "docs/workflows/codex-workflow.md",
    "docs/quality/validation.md",
    "docs/decisions/0001-json-source-of-truth.md",
    "docs/exec-plans/active/0001-viewer-mvp.md",
    "projects/sample_structure.json",
    "projects/sample_portal_frame.json",
    "projects/sample_beam_to_beam_end_plate.json",
    "projects/sample_authoring_nc1_test.json",
    "libraries/profiles.json",
    "libraries/materials.json",
    "libraries/fasteners.json",
    "libraries/connections.json",
    "libraries/frames.json",
    "schemas/project_schema.json",
    "schemas/profile_schema.json",
    "schemas/material_schema.json",
    "schemas/fastener_schema.json",
    "schemas/connection_library_schema.json",
    "schemas/frame_library_schema.json",
    "schemas/viewer_settings_schema.json",
    "scripts/check_viewer_geometry.js",
    "validate_project.py",
    "requirements.txt",
    "viewer/index.html",
    "viewer/style.css",
    "viewer/viewer.js",
    "viewer/viewer_settings.json"
]

JSON_FILES = [
    "projects/sample_structure.json",
    "projects/sample_portal_frame.json",
    "projects/sample_beam_to_beam_end_plate.json",
    "projects/sample_authoring_nc1_test.json",
    "libraries/profiles.json",
    "libraries/materials.json",
    "libraries/fasteners.json",
    "libraries/connections.json",
    "libraries/frames.json",
    "schemas/project_schema.json",
    "schemas/profile_schema.json",
    "schemas/material_schema.json",
    "schemas/fastener_schema.json",
    "schemas/connection_library_schema.json",
    "schemas/frame_library_schema.json",
    "schemas/viewer_settings_schema.json",
    "viewer/viewer_settings.json"
]

PROJECT_FILES = [
    "projects/sample_structure.json",
    "projects/sample_portal_frame.json",
    "projects/sample_beam_to_beam_end_plate.json",
    "projects/sample_authoring_nc1_test.json"
]


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main():
    errors = []

    for relative in REQUIRED_FILES:
        if not (ROOT / relative).is_file():
            errors.append(f"missing required file: {relative}")

    for relative in JSON_FILES:
        path = ROOT / relative
        if not path.is_file():
            continue
        try:
            data = load_json(path)
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON: {relative}:{exc.lineno}:{exc.colno}: {exc.msg}")
            continue

        schema_ref = data.get("$schema")
        if schema_ref and "://" not in schema_ref:
            schema_path = (path.parent / schema_ref).resolve()
            if not schema_path.is_file():
                errors.append(f"{relative}: $schema target does not exist: {schema_ref}")

    agents = ROOT / "AGENTS.md"
    if agents.is_file():
        text = agents.read_text(encoding="utf-8")
        required_mentions = [
            "projects/sample_structure.json",
            "projects/sample_portal_frame.json",
            "projects/sample_beam_to_beam_end_plate.json",
            "projects/sample_authoring_nc1_test.json",
            "libraries/profiles.json",
            "libraries/materials.json",
            "libraries/fasteners.json",
            "libraries/connections.json",
            "libraries/frames.json",
            "schemas/project_schema.json",
            "schemas/fastener_schema.json",
            "schemas/connection_library_schema.json",
            "schemas/frame_library_schema.json",
            "viewer/viewer_settings.json",
            "docs/architecture/data-model.md",
            "docs/exec-plans/active/0001-viewer-mvp.md"
        ]
        for mention in required_mentions:
            if mention not in text:
                errors.append(f"AGENTS.md missing reference: {mention}")

    for relative in PROJECT_FILES:
        path = ROOT / relative
        if not path.is_file():
            continue
        try:
            project = load_json(path)
        except json.JSONDecodeError:
            continue

        model = project.get("model", {})
        if "patterns" in model:
            errors.append(f"{relative}: use model.holePatterns, not model.patterns")

        for object_id, entry in project.get("objectIndex", {}).items():
            collection = entry.get("collection")
            if collection == "patterns":
                errors.append(f"{relative}: objectIndex.{object_id} still points to old patterns collection")
                continue
            if collection not in model:
                errors.append(f"{relative}: objectIndex.{object_id} points to missing collection {collection!r}")
                continue
            if object_id not in model.get(collection, {}):
                errors.append(f"{relative}: objectIndex.{object_id} does not match model.{collection}")

        for feature_id, feature in model.get("features", {}).items():
            if "patternRef" in feature:
                errors.append(f"{relative}: feature {feature_id} uses old patternRef; use holePatternRef")

        for fastener_group_id, fastener_group in model.get("fastenerGroups", {}).items():
            if "patternRef" in fastener_group:
                errors.append(f"{relative}: fastener group {fastener_group_id} uses old patternRef; use holePatternRef")

    geometry_check = ROOT / "scripts" / "check_viewer_geometry.js"
    if geometry_check.is_file():
        result = subprocess.run(
            ["node", str(geometry_check)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False
        )
        if result.returncode:
            errors.append("scripts/check_viewer_geometry.js failed")
            for line in (result.stdout + result.stderr).splitlines():
                errors.append(f"viewer geometry: {line}")

    if errors:
        print("FAILED: repository checks failed")
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("OK: repository checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
