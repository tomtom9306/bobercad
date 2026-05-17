import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_node_script(relative):
    return subprocess.run(
        ["node", str(ROOT / relative)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False
    )


def main():
    errors = []

    for script in ["scripts/check_repo_structure.js", "scripts/check_viewer_geometry.js"]:
        result = run_node_script(script)
        if result.returncode:
            errors.append(f"{script} failed")
            for line in (result.stdout + result.stderr).splitlines():
                errors.append(f"{script}: {line}")

    if errors:
        print("FAILED: repository checks failed")
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print("OK: repository checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
