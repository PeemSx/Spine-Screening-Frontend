from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Union

import cv2
import numpy as np
import torch
from ultralytics import YOLO

logger = logging.getLogger(__name__)


def load_la_model(weights_path: Union[str, os.PathLike]) -> YOLO:
    """
    Load a YOLO model for lateral (LA) view inference.

    The model is instantiated once at startup and reused for subsequent requests.
    """
    resolved_path = Path(weights_path)
    if not resolved_path.exists():
        raise FileNotFoundError(f"LA model weights not found at {resolved_path}")
    logger.info("Loading LA YOLO weights from %s", resolved_path)
    return YOLO(str(resolved_path))


def _extract_detections(result) -> List[Dict[str, Any]]:
    detections: List[Dict[str, Any]] = []

    boxes = getattr(result, "boxes", None)
    if boxes is None or boxes.data is None:
        return detections

    confs = boxes.conf.detach().cpu().numpy()
    classes = boxes.cls.detach().cpu().numpy()
    xyxy = boxes.xyxy.detach().cpu().numpy()
    names = result.names if hasattr(result, "names") else {}

    for cls_id, conf, bbox in zip(classes, confs, xyxy):
        x1, y1, x2, y2 = bbox.tolist()
        detections.append(
            {
                "class_id": int(cls_id),
                "class_name": names.get(int(cls_id), str(int(cls_id))),
                "confidence": float(conf),
                "bbox": [float(x1), float(y1), float(x2), float(y2)],
            }
        )
    return detections


def run_la_inference(
    model: YOLO,
    rgb_image: np.ndarray,
    results_dir: Union[str, os.PathLike],
    max_saved_results: int | None = None,
) -> Dict[str, Any]:
    """
    Execute YOLO inference for a single RGB image and persist the visualised output.
    """
    if rgb_image.ndim != 3:
        raise ValueError("Expected a 3-channel RGB image for LA inference.")

    # ultralytics expects uint8 RGB arrays
    image_np = rgb_image.astype(np.uint8)
    results = model(image_np, imgsz=640)
    result = results[0]

    detections = _extract_detections(result)
    confidences = [det["confidence"] for det in detections]
    avg_confidence = float(np.mean(confidences)) if confidences else 0.0

    overlay_bgr = rgb_image[..., ::-1].copy()

    if result.masks is not None and len(result.masks.data):
        mask_data = result.masks.data
        if isinstance(mask_data, torch.Tensor):
            mask_data = mask_data.cpu().numpy()
        else:
            mask_data = np.asarray(mask_data)

        mask_color = np.array([0, 0, 255], dtype=np.uint8)
        alpha = 0.4
        height, width = overlay_bgr.shape[:2]

        for mask in mask_data:
            mask_resized = cv2.resize(mask, (width, height), interpolation=cv2.INTER_LINEAR)
            mask_bool = mask_resized > 0.5
            if not np.any(mask_bool):
                continue
            overlay_bgr[mask_bool] = (
                (1 - alpha) * overlay_bgr[mask_bool].astype(np.float32) + alpha * mask_color
            ).astype(np.uint8)

    results_dir = Path(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)
    base = os.urandom(4).hex()
    overlay_path = results_dir / f"{base}_la_pred.jpg"
    cv2.imwrite(str(overlay_path), overlay_bgr)

    _trim_la_results(results_dir, max_saved_results)

    return {
        "avg_confidence": avg_confidence,
        "detections": detections,
        "overlay_path": overlay_path,
    }


__all__ = ["load_la_model", "run_la_inference"]


def _trim_la_results(results_dir: Path, max_saved: int | None) -> None:
    if max_saved is None or max_saved <= 0:
        return

    overlays = sorted(
        results_dir.glob("*_la_pred.jpg"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    for old_overlay in overlays[max_saved:]:
        try:
            old_overlay.unlink()
        except OSError as exc:
            logger.warning("Failed to delete old LA result %s: %s", old_overlay, exc)

