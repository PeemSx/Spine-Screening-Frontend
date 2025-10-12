from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.config import Settings, get_settings
from core.la_infer import load_la_model
from core.ap_infer import load_model


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Load heavyweight resources (model weights) once per process and attach them to
    the FastAPI application state. Ensures cleanup hooks remain centralized.
    """
    settings: Settings = get_settings()
    ap_model = load_model(settings.model_weights_path)
    la_model = load_la_model(settings.la_model_weights_path)

    app.state.ap_model = ap_model
    # Maintain the legacy attribute for code that still expects it.
    app.state.model = ap_model
    app.state.la_model = la_model
    yield
    # Explicit cleanup to play nicely with reloaders.
    for attr in ("la_model", "ap_model", "model"):
        if hasattr(app.state, attr):
            delattr(app.state, attr)
