import os
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class Settings(BaseModel):
    allow_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    model_weights_path: Path = Field(default=Path("weights/ap/hrnet_w18.pth"))
    results_dir: Path = Field(default=Path("results"))
    la_model_weights_path: Path = Field(default=Path("weights/best_100.pt"))
    la_results_dir: Path = Field(default=Path("results/la"))
    max_saved_results: int = Field(default=5, ge=0)
    log_level: str = "INFO"
    model_config = ConfigDict(protected_namespaces=())

    def ensure_directories(self) -> None:
        """Create any directories that need to exist at runtime."""
        self.results_dir.mkdir(parents=True, exist_ok=True)
        (self.results_dir / "ap").mkdir(parents=True, exist_ok=True)
        self.la_results_dir.mkdir(parents=True, exist_ok=True)


def _resolve_path(base_dir: Path, raw_path: str) -> Path:
    """Resolve a raw path to an absolute path relative to the backend root."""
    path = Path(raw_path)
    if not path.is_absolute():
        path = base_dir / path
    return path.resolve()


@lru_cache
def get_settings() -> Settings:
    """Load application settings from environment variables with sensible defaults."""
    base_dir = Path(__file__).resolve().parent.parent

    allow_origins_env = os.getenv("BACKEND_ALLOW_ORIGINS")
    if allow_origins_env:
        allow_origins = [origin.strip() for origin in allow_origins_env.split(",") if origin.strip()]
    else:
        allow_origins = ["http://localhost:3000"]

    model_weights_raw = os.getenv("BACKEND_MODEL_WEIGHTS", "weights/ap/hrnet_w18.pth")
    la_model_weights_raw = os.getenv("BACKEND_LA_MODEL_WEIGHTS", "weights/best_100.pt")
    results_dir_raw = os.getenv("BACKEND_RESULTS_DIR", "results")
    la_results_dir_raw = os.getenv("BACKEND_LA_RESULTS_DIR", "results/la")
    max_saved_results_raw = os.getenv("BACKEND_MAX_SAVED_RESULTS")
    try:
        max_saved_results = int(max_saved_results_raw) if max_saved_results_raw is not None else 5
    except ValueError:
        max_saved_results = 5
    log_level = os.getenv("BACKEND_LOG_LEVEL", "INFO").upper()

    settings = Settings(
        allow_origins=allow_origins,
        model_weights_path=_resolve_path(base_dir, model_weights_raw),
        la_model_weights_path=_resolve_path(base_dir, la_model_weights_raw),
        results_dir=_resolve_path(base_dir, results_dir_raw),
        la_results_dir=_resolve_path(base_dir, la_results_dir_raw),
        max_saved_results=max_saved_results,
        log_level=log_level,
    )
    settings.ensure_directories()
    return settings
