from __future__ import annotations

import logging
from io import BytesIO
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from app.config import Settings, get_settings
from app.dependencies import get_la_model
from core.la_infer import run_la_inference

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/la", tags=["health"])
async def la_healthcheck() -> dict[str, str]:
    return {"message": "OVCF LA API is running."}


@router.post("/predict/la", tags=["inference"])
async def predict_la(
    file: UploadFile = File(...),
    model=Depends(get_la_model),
    settings: Settings = Depends(get_settings),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        image = Image.open(BytesIO(payload)).convert("RGB")
    except (UnidentifiedImageError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc

    image_np = np.array(image, dtype=np.uint8)

    try:
        inference = run_la_inference(
            model,
            image_np,
            settings.la_results_dir,
            max_saved_results=settings.max_saved_results,
        )
    except ValueError as exc:
        logger.exception("LA inference failed due to invalid input.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - unexpected failure path
        logger.exception("Unexpected error during LA inference.")
        raise HTTPException(status_code=500, detail="Inference failed.") from exc

    overlay_path: Path = inference["overlay_path"]
    try:
        relative_overlay = overlay_path.relative_to(settings.results_dir)
        overlay_url = f"/results/{relative_overlay.as_posix()}"
    except ValueError:
        logger.warning("LA overlay path %s is outside configured results dir %s", overlay_path, settings.results_dir)
        overlay_url = f"/results/{overlay_path.name}"

    response_payload = {
        "avg_confidence": round(float(inference["avg_confidence"]), 4),
        "detections": inference["detections"],
        "num_detections": len(inference["detections"]),
        "pred_image": overlay_url,
        "abs_path": str(overlay_path),
    }
    return JSONResponse(response_payload)


__all__ = ["router"]
