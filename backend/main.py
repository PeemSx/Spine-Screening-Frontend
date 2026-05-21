from __future__ import annotations

from pathlib import Path

from app import create_app

app = create_app()


def _dev_watch_paths(backend_dir: Path) -> list[str]:
    # Use an explicit project-scoped watch list. Uvicorn's built-in
    # WatchFilesReload appends Path.cwd() to the watch set, which causes this
    # repo's in-project `.venv/` to leak into reload monitoring.
    return [
        str(backend_dir / "main.py"),
        str(backend_dir / "app"),
        str(backend_dir / "core"),
        str(backend_dir / "models"),
        str(backend_dir / "tests"),
    ]


def _run_server() -> None:
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )


def _run_dev_reloader(backend_dir: Path) -> None:
    from watchfiles import DefaultFilter, run_process

    watch_filter = DefaultFilter(
        ignore_dirs=(
            "__pycache__",
            ".git",
            ".hg",
            ".svn",
            ".tox",
            ".venv",
            ".idea",
            "node_modules",
            ".mypy_cache",
            ".pytest_cache",
            ".hypothesis",
            "results",
            "temp",
        ),
        ignore_paths=(
            backend_dir / ".venv",
            backend_dir / "results",
            backend_dir / "temp",
        ),
    )

    run_process(
        *_dev_watch_paths(backend_dir),
        target=_run_server,
        target_type="function",
        watch_filter=watch_filter,
        debounce=300,
        step=100,
    )

if __name__ == "__main__":
    backend_dir = Path(__file__).resolve().parent
    _run_dev_reloader(backend_dir)
