from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.logging_config import configure_logging
from app.lifespan import lifespan
from app.routes import router as api_router


def create_app() -> FastAPI:
    settings = get_settings()

    configure_logging(settings.log_level)

    application = FastAPI(lifespan=lifespan)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.mount("/results", StaticFiles(directory=settings.results_dir, check_dir=False), name="results")

    application.include_router(api_router)

    return application


__all__ = ["create_app"]
