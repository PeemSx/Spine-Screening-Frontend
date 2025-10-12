from typing import Any

from fastapi import Depends, Request

from app.config import Settings, get_settings


def get_settings_dependency() -> Settings:
    return get_settings()


def _get_state_attr(request: Request, attr: str) -> Any:
    model = getattr(request.app.state, attr, None)
    if model is None:
        raise RuntimeError(f"{attr.replace('_', ' ').title()} has not been initialised on application startup.")
    return model


def get_ap_model(request: Request, _: Settings = Depends(get_settings_dependency)) -> Any:
    """
    Retrieve the AP inference model (SpineNet) from application state.
    """
    return _get_state_attr(request, "ap_model")


def get_la_model(request: Request, _: Settings = Depends(get_settings_dependency)) -> Any:
    """
    Retrieve the LA inference model (YOLO) from application state.
    """
    return _get_state_attr(request, "la_model")


def get_inference_model(request: Request, _: Settings = Depends(get_settings_dependency)) -> Any:
    """
    Backwards-compatible alias for AP model access used by legacy routes.
    """
    return _get_state_attr(request, "ap_model")
