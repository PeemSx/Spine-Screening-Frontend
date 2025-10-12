#!/usr/bin/env python3
"""
Utility script to remove generated result images from the backend.

It preserves directory structure (and .gitkeep sentinels) while clearing out any
files produced by AP or LA inference runs.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend package is importable whether run from repo root or scripts dir
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings


def _clear_dir(path: Path) -> int:
    """Delete files within the given directory, preserving .gitkeep sentinels."""
    if not path.exists():
        return 0

    removed = 0
    for entry in path.iterdir():
        if entry.name == ".gitkeep":
            continue

        if entry.is_dir():
            removed += _clear_dir(entry)
            try:
                entry.rmdir()
            except OSError:
                # Directory not empty (likely nested .gitkeep); ignore.
                pass
            continue

        try:
            entry.unlink()
            removed += 1
        except OSError:
            print(f"Failed to remove {entry}", file=sys.stderr)
    return removed


def main() -> None:
    settings = get_settings()
    targets = {
        "results": settings.results_dir,
        "la_results": settings.la_results_dir,
    }

    total_removed = 0
    for name, path in targets.items():
        removed = _clear_dir(path)
        total_removed += removed
        print(f"{name}: removed {removed} file(s) from {path}")

    print(f"Done. Total files removed: {total_removed}")


if __name__ == "__main__":
    main()
