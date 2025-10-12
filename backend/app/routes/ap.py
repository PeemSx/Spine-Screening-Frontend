from __future__ import annotations

import logging

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.dependencies import get_inference_model
from core.ap_infer import run_inference

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ap", tags=["health"])
async def root() -> dict[str, str]:
    return {"message": "OVCF AP API is running."}


@router.post("/predict/ap", tags=["inference"])
async def predict_ap(
    file: UploadFile = File(...),
    model=Depends(get_inference_model),
    settings: Settings = Depends(get_settings),
):
    buf = await file.read()
    if not buf:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    img_array = np.frombuffer(buf, np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    try:
        result = run_inference(model, image, results_dir=settings.results_dir)
    except ValueError as exc:
        logger.exception("Inference failed due to invalid model output.")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error during inference.")
        raise HTTPException(status_code=500, detail="Inference failed.") from exc

    return JSONResponse(result)
