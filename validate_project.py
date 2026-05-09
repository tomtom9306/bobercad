import argparse
import json
import re
import sys
from pathlib import Path


class ValidationError:
    def __init__(self, path, schema_path, message):
        self.path = tuple(path)
        self.schema_path = tuple(schema_path)
        self.message = message


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_schema_path(project_path, project):
    schema_ref = project.get("$schema")
    if not schema_ref:
        raise ValueError("project file is missing '$schema'")

    if "://" in schema_ref:
        raise ValueError("remote schemas are not supported by this local validator")

    return (project_path.parent / schema_ref).resolve()


def pointer_parts(ref):
    if not ref.startswith("#/"):
        raise ValueError(f"only local JSON pointer refs are supported: {ref}")
    return [part.replace("~1", "/").replace("~0", "~") for part in ref[2:].split("/")]


def resolve_ref(root_schema, ref):
    target = root_schema
    parts = pointer_parts(ref)
    for part in parts:
        target = target[part]
    return target, tuple(parts)


def is_type(value, expected):
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    return False


def validate_type(value, expected):
    if isinstance(expected, list):
        return any(is_type(value, item) for item in expected)
    return is_type(value, expected)


def path_text(path):
    if not path:
        return "<root>"
    text = ""
    for part in path:
        if isinstance(part, int):
            text += f"[{part}]"
        elif text:
            text += f".{part}"
        else:
            text = str(part)
    return text


def format_error(error):
    schema_path = "/".join(str(part) for part in error.schema_path) or "<schema-root>"
    return f"{path_text(error.path)}: {error.message} [{schema_path}]"


def add_error(errors, path, schema_path, message):
    errors.append(ValidationError(path, schema_path, message))


def validate(value, schema, root_schema, path=(), schema_path=()):
    errors = []

    if schema is True:
        return errors
    if schema is False:
        add_error(errors, path, schema_path, "value is not allowed")
        return errors
    if not isinstance(schema, dict):
        add_error(errors, path, schema_path, "schema node must be an object or boolean")
        return errors

    if "$ref" in schema:
        ref_schema, ref_schema_path = resolve_ref(root_schema, schema["$ref"])
        return validate(value, ref_schema, root_schema, path, ref_schema_path)

    if "anyOf" in schema:
        branch_errors = [
            validate(value, branch, root_schema, path, schema_path + ("anyOf", index))
            for index, branch in enumerate(schema["anyOf"])
        ]
        if all(branch for branch in branch_errors):
            add_error(errors, path, schema_path + ("anyOf",), "does not match any allowed schema")
            return errors

    if "const" in schema and value != schema["const"]:
        add_error(errors, path, schema_path + ("const",), f"expected {schema['const']!r}")

    if "enum" in schema and value not in schema["enum"]:
        allowed = ", ".join(repr(item) for item in schema["enum"])
        add_error(errors, path, schema_path + ("enum",), f"expected one of: {allowed}")

    if "type" in schema and not validate_type(value, schema["type"]):
        add_error(errors, path, schema_path + ("type",), f"expected type {schema['type']!r}")
        return errors

    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                add_error(errors, path + (key,), schema_path + ("required",), "required property is missing")

        properties = schema.get("properties", {})
        for key, child_schema in properties.items():
            if key in value:
                errors.extend(validate(value[key], child_schema, root_schema, path + (key,), schema_path + ("properties", key)))

        additional = schema.get("additionalProperties", True)
        for key, child_value in value.items():
            if key in properties:
                continue
            if additional is False:
                add_error(errors, path + (key,), schema_path + ("additionalProperties",), "unexpected property")
            elif additional is not True:
                errors.extend(validate(child_value, additional, root_schema, path + (key,), schema_path + ("additionalProperties",)))

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            add_error(errors, path, schema_path + ("minItems",), f"expected at least {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            add_error(errors, path, schema_path + ("maxItems",), f"expected at most {schema['maxItems']} items")

        prefix_items = schema.get("prefixItems", [])
        for index, child_schema in enumerate(prefix_items):
            if index < len(value):
                errors.extend(validate(value[index], child_schema, root_schema, path + (index,), schema_path + ("prefixItems", index)))

        if "items" in schema:
            start = len(prefix_items)
            for index in range(start, len(value)):
                errors.extend(validate(value[index], schema["items"], root_schema, path + (index,), schema_path + ("items",)))

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            add_error(errors, path, schema_path + ("minLength",), f"expected at least {schema['minLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            add_error(errors, path, schema_path + ("pattern",), f"does not match pattern {schema['pattern']!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            add_error(errors, path, schema_path + ("minimum",), f"expected >= {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            add_error(errors, path, schema_path + ("maximum",), f"expected <= {schema['maximum']}")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate a project JSON file against its $schema.")
    parser.add_argument("project", nargs="?", default="projects/sample_structure.json", help="Project JSON file to validate.")
    args = parser.parse_args()

    project_path = Path(args.project).resolve()

    try:
        project = load_json(project_path)
        schema_path = resolve_schema_path(project_path, project)
        schema = load_json(schema_path)
    except FileNotFoundError as exc:
        print(f"ERROR: file not found: {exc.filename}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON: line {exc.lineno}, column {exc.colno}: {exc.msg}", file=sys.stderr)
        return 1
    except (KeyError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    errors = sorted(validate(project, schema, schema), key=lambda item: item.path)
    if errors:
        print(f"FAILED: {project_path.name} does not match {schema_path.name}")
        for error in errors:
            print(f"ERROR: {format_error(error)}")
        return 1

    print(f"OK: {project_path.name} matches {schema_path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
