# backend/core/model_infer.py
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Dict, Union
import cv2
import numpy as np
import torch
from models.spinal_net import SpineNet
from core.utils_ap import (
    decode_centernet_8corners,
    scale_points_and_boxes_to_original,
    draw_overlay,
    draw_heatmap_overlay,
    cobb_from_points,
)

# ====== MUST MATCH TRAINING ======
DOWN_RATIO   = 4
NUM_CLASSES  = 1
K_VERTEBRAE  = 17
CONF_THRESH  = 0.20
HEADS        = {"hm": NUM_CLASSES, "reg": 2, "wh": 8}
FINAL_KERNEL = 1
HEAD_CONV    = 256
IN_H, IN_W   = 1024, 512
# =================================

def load_model(weight_path: Union[str, os.PathLike]) -> torch.nn.Module:
    """
    Load SpineNet weights for inference on CPU.

    Args:
        weight_path (str | os.PathLike): Path to the model weights file.

    Returns:
        torch.nn.Module: Loaded SpineNet model in evaluation mode.
    """
    model = SpineNet(
        heads=HEADS,
        pretrained=False,  # Disable loading pretrained weights from internet
        down_ratio=DOWN_RATIO,
        final_kernel=FINAL_KERNEL,
        head_conv=HEAD_CONV,
    )
    ckpt = torch.load(str(weight_path), map_location="cpu")
    state = ckpt.get("state_dict", ckpt)
    state = {k.replace("module.", ""): v for k, v in state.items()}
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing:
        print("[load_model] missing keys:", missing)
    if unexpected:
        print("[load_model] unexpected keys:", unexpected)
    model.eval()
    return model


@torch.no_grad()
def run_inference(
    model: torch.nn.Module,
    bgr_img: np.ndarray,
    results_dir: Union[str, os.PathLike],
) -> Dict[str, Any]:
    """
    Perform single-image inference for AP X-ray using the SpineNet model.

    Args:
        model (torch.nn.Module): Loaded SpineNet model.
        bgr_img (np.ndarray): Input image in BGR format.
        results_dir (str | os.PathLike): Directory path to save inference results.

    Returns:
        Dict[str, Any]: Dictionary containing inference results, including
                        decoded points, boxes, scores, Cobb angle, and image paths.
    """
    orig_h, orig_w = bgr_img.shape[:2]

    # ---------- preprocess ----------
    rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IN_W, IN_H))
    inp = resized.astype(np.float32) / 255.0
    tensor = torch.from_numpy(inp.transpose(2, 0, 1)).unsqueeze(0)

    # ---------- forward ----------
    dec = model(tensor)
    if not all(k in dec for k in ("hm", "reg", "wh")):
        return {"error": "Model outputs must contain 'hm','reg','wh'."}

    # ---------- decode ----------
    pts_inp, boxes_inp, scores, corners_inp = decode_centernet_8corners(
        hm=dec["hm"], reg=dec["reg"], wh=dec["wh"],
        top_k_num=K_VERTEBRAE, down_ratio=DOWN_RATIO, conf_thresh=CONF_THRESH
    )
    if pts_inp.size == 0:
        return {
            "decoder": "centernet",
            "cobb_angle": 0.0,
            "points": [],
            "boxes": [],
            "scores": [],
            "pred_image": "",
            "heatmap_image": "",
            "abs_path": "",
        }

    # scale back to original image size
    pts, boxes = scale_points_and_boxes_to_original(pts_inp, boxes_inp, orig_w, orig_h, IN_W, IN_H)
    corners = None
    width_ratios = None
    if corners_inp is not None and corners_inp.size > 0:
        top_len = np.linalg.norm(corners_inp[:, 1] - corners_inp[:, 0], axis=1)
        bot_len = np.linalg.norm(corners_inp[:, 3] - corners_inp[:, 2], axis=1)
        width_ratios = np.maximum(top_len, bot_len) / float(IN_W)
    if corners_inp is not None and corners_inp.size > 0:
        corners = corners_inp.copy()
        corners[..., 0] *= orig_w / IN_W
        corners[..., 1] *= orig_h / IN_H
    order = np.argsort(pts[:, 1])
    pts, boxes, scores = pts[order], boxes[order], scores[order]
    if corners is not None:
        corners = corners[order]
    if width_ratios is not None:
        width_ratios = width_ratios[order]

    # ---------- visualize ----------
    overlay = draw_overlay(
        bgr_img.copy(),
        pts,
        boxes,
        draw_global_centerline=True,
        corners=corners,
        scores=scores,
        width_ratios=width_ratios,
    )
    heatmap_img = draw_heatmap_overlay(bgr_img.copy(), pts)
    cobb = cobb_from_points(pts)

    # ---------- save ----------
    results_dir = Path(results_dir)
    results_dir.mkdir(parents=True, exist_ok=True)
    base = os.urandom(4).hex()
    overlay_path = results_dir / f"{base}_ap_pred.jpg"
    heatmap_path = results_dir / f"{base}_ap_heatmap.jpg"
    cv2.imwrite(str(overlay_path), overlay)
    cv2.imwrite(str(heatmap_path), heatmap_img)

    return {
        "decoder": "centernet",
        "cobb_angle": round(float(cobb), 2),
        "points": pts.tolist(),
        "boxes": boxes.tolist(),
        "scores": scores.tolist(),
        "pred_image": f"/results/{overlay_path.name}",
        "heatmap_image": f"/results/{heatmap_path.name}",
        "abs_path": str(overlay_path),
    }
