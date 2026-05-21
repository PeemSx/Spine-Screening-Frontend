import cv2
import torch
import numpy as np
from typing import Tuple, Optional

from core.cobb import (
    cobb_angle_from_center_points,
    cobb_result_from_corners,
    primary_cobb_angle_from_corners,
)
from core.spine_decoder import DecDecoder

# Distinct per-vertebra colors (RGB in 0-255)
COLORS = [
    (196,  6, 250),  (138, 208, 242), ( 20, 203,  39),
    (238, 229,  25), (187,  13, 251), (  4,  41, 240),
    (138, 208, 115), (213, 250,  31), (186,  59,  76),
    ( 98, 242, 253), (117,  10, 252), (254,  23, 213),
    (246,   6,  33), ( 85, 255, 153), (244, 226, 142),
    (  9,  16, 226), ( 13, 228,  23),
]


def build_resize_metadata(orig_w: int, orig_h: int, in_w: int, in_h: int) -> dict[str, float | int]:
    scale = min(float(in_w) / float(orig_w), float(in_h) / float(orig_h))
    resized_w = max(1, min(int(round(orig_w * scale)), int(in_w)))
    resized_h = max(1, min(int(round(orig_h * scale)), int(in_h)))
    pad_w = int(in_w) - resized_w
    pad_h = int(in_h) - resized_h
    pad_left = pad_w // 2
    pad_right = pad_w - pad_left
    pad_top = pad_h // 2
    pad_bottom = pad_h - pad_top
    return {
        "orig_w": int(orig_w),
        "orig_h": int(orig_h),
        "in_w": int(in_w),
        "in_h": int(in_h),
        "scale": float(scale),
        "resized_w": int(resized_w),
        "resized_h": int(resized_h),
        "pad_left": int(pad_left),
        "pad_right": int(pad_right),
        "pad_top": int(pad_top),
        "pad_bottom": int(pad_bottom),
    }


def resize_with_aspect_padding(
    image: np.ndarray,
    in_w: int,
    in_h: int,
    pad_value: int | float = 0,
) -> tuple[np.ndarray, dict[str, float | int]]:
    resize_meta = build_resize_metadata(image.shape[1], image.shape[0], in_w, in_h)
    interpolation = cv2.INTER_LINEAR if resize_meta["scale"] >= 1.0 else cv2.INTER_AREA
    resized = cv2.resize(
        image,
        (int(resize_meta["resized_w"]), int(resize_meta["resized_h"])),
        interpolation=interpolation,
    )
    canvas = np.full((in_h, in_w, image.shape[2]), pad_value, dtype=image.dtype)
    y0 = int(resize_meta["pad_top"])
    x0 = int(resize_meta["pad_left"])
    canvas[y0:y0 + resized.shape[0], x0:x0 + resized.shape[1]] = resized
    return canvas, resize_meta


def _invert_resize_for_points(
    pts_inp: np.ndarray,
    resize_meta: dict[str, float | int],
) -> np.ndarray:
    pts = pts_inp.astype(np.float32).copy()
    pts[:, 0] = (pts[:, 0] - float(resize_meta["pad_left"])) / float(resize_meta["scale"])
    pts[:, 1] = (pts[:, 1] - float(resize_meta["pad_top"])) / float(resize_meta["scale"])
    pts[:, 0] = np.clip(pts[:, 0], 0.0, max(float(int(resize_meta["orig_w"]) - 1), 0.0))
    pts[:, 1] = np.clip(pts[:, 1], 0.0, max(float(int(resize_meta["orig_h"]) - 1), 0.0))
    return pts


def scale_corners_to_original(
    corners_inp: np.ndarray,
    orig_w: int,
    orig_h: int,
    in_w: int,
    in_h: int,
    resize_meta: Optional[dict[str, float | int]] = None,
) -> np.ndarray:
    if resize_meta is None:
        resize_meta = build_resize_metadata(orig_w, orig_h, in_w, in_h)
    if corners_inp is None or corners_inp.size == 0:
        return np.zeros((0, 4, 2), dtype=np.float32)
    flat = corners_inp.reshape(-1, 2)
    return _invert_resize_for_points(flat, resize_meta).reshape(corners_inp.shape)


def decode_centernet_8corners(
    hm: torch.Tensor, 
    reg: torch.Tensor, 
    wh: torch.Tensor,
    top_k_num: int = 17,
    down_ratio: int = 4,        
    conf_thresh: float = 0.3,
    candidate_top_k: Optional[int] = None,
    duplicate_radius_px: float = 18.0,
    min_dy_px: float = 0.0,
    max_dy_px: float = 0.0,
    score_weight: float = 1.0,
    spacing_weight: float = 0.35,
    smoothness_weight: float = 0.10,
    curvature_weight: float = 0.25,
    relaxed_min_dy_scale: float = 0.60,
    relaxed_max_dy_scale: float = 1.60,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Decode CenterNet outputs and select the final vertebrae as a spine chain."""
    if torch.min(hm) < 0 or torch.max(hm) > 1:
        hm = torch.sigmoid(hm)

    num_vertebrae = max(int(top_k_num), 1)
    candidate_count = max(int(candidate_top_k) if candidate_top_k is not None else 40, num_vertebrae)
    decoder = DecDecoder(
        K=num_vertebrae,
        conf_thresh=conf_thresh,
        num_vertebrae=num_vertebrae,
        decode_mode="spine_chain",
        down_ratio=down_ratio,
        candidate_top_k=candidate_count,
        duplicate_radius_px=duplicate_radius_px,
        min_dy_px=min_dy_px,
        max_dy_px=max_dy_px,
        score_weight=score_weight,
        spacing_weight=spacing_weight,
        smoothness_weight=smoothness_weight,
        curvature_weight=curvature_weight,
        relaxed_min_dy_scale=relaxed_min_dy_scale,
        relaxed_max_dy_scale=relaxed_max_dy_scale,
    )
    pts2 = decoder.ctdet_decode(hm, wh, reg)
    if pts2.size == 0:
        return (
            np.zeros((0, 2), dtype=np.float32),
            np.zeros((0, 4), dtype=np.float32),
            np.zeros((0,), dtype=np.float32),
            np.zeros((0, 4, 2), dtype=np.float32),
        )

    pts0 = pts2.copy()
    pts0[:, :10] *= down_ratio
    corners_inp = np.stack(
        [
            pts0[:, 2:4],
            pts0[:, 4:6],
            pts0[:, 6:8],
            pts0[:, 8:10],
        ],
        axis=1,
    ).astype(np.float32)
    x1 = np.min(corners_inp[:, :, 0], axis=1)
    y1 = np.min(corners_inp[:, :, 1], axis=1)
    x2 = np.max(corners_inp[:, :, 0], axis=1)
    y2 = np.max(corners_inp[:, :, 1], axis=1)
    boxes_inp = np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)
    # The decoder already returns center/corner coordinates in heatmap space.
    # After scaling the first 10 columns once, the centers in pts0[:, :2] are
    # already back in resized-input pixels and must not be multiplied again.
    pts_inp = pts0[:, :2].astype(np.float32)
    scores_sel = pts0[:, 10].astype(np.float32)

    return pts_inp, boxes_inp, scores_sel, corners_inp


def scale_points_and_boxes_to_original(
    pts_inp: np.ndarray,
    boxes_inp: Optional[np.ndarray],
    orig_w: int,
    orig_h: int,
    in_w: int,
    in_h: int,
    resize_meta: Optional[dict[str, float | int]] = None,
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """Rescale points and boxes back to the original image size."""
    if resize_meta is None:
        resize_meta = build_resize_metadata(orig_w, orig_h, in_w, in_h)

    pts = _invert_resize_for_points(pts_inp, resize_meta)
    boxes = None
    if boxes_inp is not None:
        boxes = boxes_inp.astype(np.float32).copy()
        flat = np.stack(
            [
                boxes[:, [0, 1]],
                boxes[:, [2, 1]],
                boxes[:, [0, 3]],
                boxes[:, [2, 3]],
            ],
            axis=1,
        ).reshape(-1, 2)
        flat = _invert_resize_for_points(flat, resize_meta).reshape(-1, 4, 2)
        x1 = np.min(flat[:, :, 0], axis=1)
        y1 = np.min(flat[:, :, 1], axis=1)
        x2 = np.max(flat[:, :, 0], axis=1)
        y2 = np.max(flat[:, :, 1], axis=1)
        boxes = np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)
    return pts, boxes

def cobb_from_points(pts: np.ndarray) -> float:
    """Fallback Cobb estimate from detected vertebra center points."""
    return cobb_angle_from_center_points(pts)


def cobb_from_corners(
    corners: np.ndarray,
    image_shape: tuple[int, ...] | None = None,
) -> float:
    """Primary Cobb angle from ordered vertebra corner landmarks."""
    return primary_cobb_angle_from_corners(corners, image_shape)


def _draw_rounded_rect(
    img: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    color: tuple[int, int, int],
    radius: int,
    alpha: float = 1.0,
) -> None:
    """Draw a filled rounded rectangle with optional alpha blending."""
    h, w = img.shape[:2]
    x1 = int(np.clip(x1, 0, max(w - 1, 0)))
    x2 = int(np.clip(x2, 0, max(w - 1, 0)))
    y1 = int(np.clip(y1, 0, max(h - 1, 0)))
    y2 = int(np.clip(y2, 0, max(h - 1, 0)))
    if x2 <= x1 or y2 <= y1:
        return

    radius = int(max(0, min(radius, (x2 - x1) // 2, (y2 - y1) // 2)))
    overlay = img.copy()
    cv2.rectangle(overlay, (x1 + radius, y1), (x2 - radius, y2), color, -1, cv2.LINE_AA)
    cv2.rectangle(overlay, (x1, y1 + radius), (x2, y2 - radius), color, -1, cv2.LINE_AA)
    cv2.circle(overlay, (x1 + radius, y1 + radius), radius, color, -1, cv2.LINE_AA)
    cv2.circle(overlay, (x2 - radius, y1 + radius), radius, color, -1, cv2.LINE_AA)
    cv2.circle(overlay, (x1 + radius, y2 - radius), radius, color, -1, cv2.LINE_AA)
    cv2.circle(overlay, (x2 - radius, y2 - radius), radius, color, -1, cv2.LINE_AA)

    if alpha >= 1.0:
        img[:] = overlay
    else:
        img[:] = cv2.addWeighted(overlay, alpha, img, 1.0 - alpha, 0)


def _detection_bounds(
    pts: np.ndarray,
    boxes: Optional[np.ndarray],
    corners: Optional[np.ndarray],
    width: int,
    height: int,
) -> tuple[float, float, float, float]:
    """Return the visible bounds of all AP annotations."""
    coord_sets = [pts.reshape(-1, 2)]
    if boxes is not None and len(boxes) > 0:
        boxes_f = boxes.astype(np.float32)
        box_pts = np.stack(
            [
                boxes_f[:, [0, 1]],
                boxes_f[:, [2, 1]],
                boxes_f[:, [0, 3]],
                boxes_f[:, [2, 3]],
            ],
            axis=1,
        )
        coord_sets.append(box_pts.reshape(-1, 2))
    if corners is not None and len(corners) > 0:
        coord_sets.append(corners.reshape(-1, 2))

    all_coords = np.concatenate(coord_sets, axis=0)
    x1 = float(np.clip(np.min(all_coords[:, 0]), 0, max(width - 1, 0)))
    y1 = float(np.clip(np.min(all_coords[:, 1]), 0, max(height - 1, 0)))
    x2 = float(np.clip(np.max(all_coords[:, 0]), 0, max(width - 1, 0)))
    y2 = float(np.clip(np.max(all_coords[:, 1]), 0, max(height - 1, 0)))
    return x1, y1, x2, y2


def _chip_size(text: str, scale: float) -> tuple[int, int]:
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.42, 0.46 * scale)
    thickness = max(1, int(round(1.6 * scale)))
    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    pad_x = max(8, int(round(9 * scale)))
    pad_y = max(4, int(round(5 * scale)))
    dot = max(6, int(round(7 * scale)))
    gap = max(5, int(round(6 * scale)))
    return tw + pad_x * 2 + dot + gap, th + baseline + pad_y * 2


def _cobb_display_label(index: int, count: int) -> str:
    if count <= 1:
        return ""
    labels = ("U", "M", "L") if count >= 3 else ("U", "L")
    return labels[min(index, len(labels) - 1)]


def _metric_panel_size(cobb_angles: tuple[float, ...], scale: float) -> tuple[int, int]:
    cobb_angles = tuple(float(angle) for angle in cobb_angles) or (0.0,)
    font = cv2.FONT_HERSHEY_SIMPLEX
    title_scale = max(0.42, 0.42 * scale)
    value_scale = max(0.70, (0.78 if len(cobb_angles) > 1 else 0.86) * scale)
    title_thick = max(1, int(round(1.5 * scale)))
    value_thick = max(2, int(round(2.4 * scale)))
    title = "COBB ANGLES" if len(cobb_angles) > 1 else "COBB ANGLE"
    title_size, _ = cv2.getTextSize(title, font, title_scale, title_thick)
    row_widths = []
    row_heights = []
    for idx, angle in enumerate(cobb_angles):
        label = _cobb_display_label(idx, len(cobb_angles))
        label_size, _ = cv2.getTextSize(label, font, title_scale, title_thick)
        value_size, _ = cv2.getTextSize(f"{angle:.2f}", font, value_scale, value_thick)
        row_widths.append(label_size[0] + value_size[0] + int(round(10 * scale)))
        row_heights.append(max(label_size[1], value_size[1]))
    unit_size, _ = cv2.getTextSize("deg", font, title_scale, title_thick)
    pad_x = max(14, int(round(16 * scale)))
    pad_y = max(12, int(round(13 * scale)))
    row_gap = max(5, int(round(6 * scale)))
    row_width = max(row_widths) + unit_size[0] + int(round(8 * scale))
    width = max(title_size[0], row_width) + pad_x * 2
    height = title_size[1] + sum(row_heights) + row_gap * len(cobb_angles) + pad_y * 2
    return width, height


def _spread_label_positions(
    raw_y: list[int],
    min_gap: int,
    lower: int,
    upper: int,
) -> list[int]:
    if not raw_y:
        return []

    if upper <= lower:
        midpoint = (lower + upper) // 2
        return [midpoint for _ in raw_y]

    positions = [int(np.clip(y, lower, upper)) for y in raw_y]
    if len(positions) == 1:
        return positions

    available = max(upper - lower, 1)
    min_gap = min(min_gap, max(10, available // max(len(positions) - 1, 1)))
    for idx in range(1, len(positions)):
        positions[idx] = max(positions[idx], positions[idx - 1] + min_gap)

    overflow = positions[-1] - upper
    if overflow > 0:
        positions = [y - overflow for y in positions]

    for idx in range(len(positions) - 2, -1, -1):
        positions[idx] = min(positions[idx], positions[idx + 1] - min_gap)

    underflow = lower - positions[0]
    if underflow > 0:
        positions = [y + underflow for y in positions]
        for idx in range(1, len(positions)):
            positions[idx] = max(positions[idx], positions[idx - 1] + min_gap)

    return [int(np.clip(y, lower, upper)) for y in positions]


def _draw_label_chip(
    img: np.ndarray,
    text: str,
    edge_x: int,
    center_y: int,
    side: str,
    scale: float,
    accent: tuple[int, int, int],
) -> tuple[int, int]:
    chip_w, chip_h = _chip_size(text, scale)
    if side == "right":
        x1 = edge_x
        x2 = x1 + chip_w
    else:
        x2 = edge_x
        x1 = x2 - chip_w
    y1 = center_y - chip_h // 2
    y2 = y1 + chip_h

    h, w = img.shape[:2]
    x1 = int(np.clip(x1, 0, max(w - chip_w - 1, 0)))
    x2 = x1 + chip_w
    y1 = int(np.clip(y1, 0, max(h - chip_h - 1, 0)))
    y2 = y1 + chip_h

    radius = max(7, int(round(9 * scale)))
    _draw_rounded_rect(img, x1 + 2, y1 + 3, x2 + 2, y2 + 3, (0, 0, 0), radius, 0.28)
    _draw_rounded_rect(img, x1, y1, x2, y2, (18, 24, 30), radius, 0.88)
    cv2.rectangle(img, (x1, y1), (x2, y2), (64, 86, 102), 1, cv2.LINE_AA)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.42, 0.46 * scale)
    thickness = max(1, int(round(1.6 * scale)))
    (_, th), _ = cv2.getTextSize(text, font, font_scale, thickness)
    pad_x = max(8, int(round(9 * scale)))
    dot_radius = max(3, int(round(3.5 * scale)))
    gap = max(5, int(round(6 * scale)))
    dot_x = x1 + pad_x + dot_radius
    dot_y = y1 + chip_h // 2
    cv2.circle(img, (dot_x, dot_y), dot_radius, accent, -1, cv2.LINE_AA)
    cv2.putText(
        img,
        text,
        (dot_x + dot_radius + gap, y1 + (chip_h + th) // 2 - 1),
        font,
        font_scale,
        (242, 248, 255),
        thickness,
        cv2.LINE_AA,
    )

    return (x1 if side == "right" else x2, y1 + chip_h // 2)


def _draw_cobb_panel(
    img: np.ndarray,
    cobb_angles: tuple[float, ...],
    side: str,
    bounds: tuple[float, float, float, float],
    scale: float,
    panel_bounds: tuple[int, int, int, int] | None = None,
) -> None:
    cobb_angles = tuple(float(angle) for angle in cobb_angles) or (0.0,)
    h, w = img.shape[:2]
    if panel_bounds is None:
        panel_left, panel_top, panel_right, panel_bottom = 0, 0, w, h
    else:
        panel_left, panel_top, panel_right, panel_bottom = panel_bounds
    panel_left = int(np.clip(panel_left, 0, w))
    panel_top = int(np.clip(panel_top, 0, h))
    panel_right = int(np.clip(panel_right, panel_left, w))
    panel_bottom = int(np.clip(panel_bottom, panel_top, h))

    panel_w, panel_h = _metric_panel_size(cobb_angles, scale)
    margin = max(12, int(round(16 * scale)))
    gap = max(10, int(round(14 * scale)))
    min_x = panel_left + margin
    max_x = max(panel_right - margin - panel_w, min_x)
    min_y = panel_top + margin
    max_y = max(panel_bottom - margin - panel_h, min_y)

    if side == "right":
        x1 = min(max_x, int(bounds[2] + gap))
    else:
        x1 = max(min_x, int(bounds[0] - gap - panel_w))
    x1 = int(np.clip(x1, min_x, max_x))
    x2 = x1 + panel_w

    center_y = int((bounds[1] + bounds[3]) * 0.5)
    y1 = int(np.clip(center_y - panel_h // 2, min_y, max_y))
    y2 = y1 + panel_h

    radius = max(10, int(round(12 * scale)))
    _draw_rounded_rect(img, x1 + 3, y1 + 4, x2 + 3, y2 + 4, (0, 0, 0), radius, 0.3)
    _draw_rounded_rect(img, x1, y1, x2, y2, (13, 18, 24), radius, 0.9)
    cv2.rectangle(img, (x1, y1), (x2, y2), (72, 97, 116), 1, cv2.LINE_AA)

    font = cv2.FONT_HERSHEY_SIMPLEX
    title_scale = max(0.42, 0.42 * scale)
    value_scale = max(0.70, (0.78 if len(cobb_angles) > 1 else 0.86) * scale)
    title_thick = max(1, int(round(1.5 * scale)))
    value_thick = max(2, int(round(2.4 * scale)))
    pad_x = max(14, int(round(16 * scale)))
    pad_y = max(12, int(round(13 * scale)))
    row_gap = max(5, int(round(6 * scale)))
    title = "COBB ANGLES" if len(cobb_angles) > 1 else "COBB ANGLE"

    cv2.putText(
        img,
        title,
        (x1 + pad_x, y1 + pad_y + int(round(12 * scale))),
        font,
        title_scale,
        (166, 183, 196),
        title_thick,
        cv2.LINE_AA,
    )

    cursor_y = y1 + pad_y + int(round(12 * scale)) + row_gap + int(round(18 * scale))
    for idx, angle in enumerate(cobb_angles):
        label = _cobb_display_label(idx, len(cobb_angles))
        value = f"{angle:.2f}"
        label_w = 0
        value_x = x1 + pad_x
        if label:
            (label_w, _), _ = cv2.getTextSize(label, font, title_scale, title_thick)
            cv2.putText(
                img,
                label,
                (x1 + pad_x, cursor_y - max(1, int(round(3 * scale)))),
                font,
                title_scale,
                (166, 183, 196),
                title_thick,
                cv2.LINE_AA,
            )
            value_x += label_w + int(round(10 * scale))

        (value_w, value_h), _ = cv2.getTextSize(value, font, value_scale, value_thick)
        cv2.putText(
            img,
            value,
            (value_x, cursor_y),
            font,
            value_scale,
            (238, 244, 248),
            value_thick,
            cv2.LINE_AA,
        )
        cv2.putText(
            img,
            "deg",
            (value_x + value_w + int(round(8 * scale)), cursor_y - max(1, value_h // 5)),
            font,
            title_scale,
            (218, 228, 235),
            title_thick,
            cv2.LINE_AA,
        )
        cursor_y += value_h + row_gap + int(round(4 * scale))


def _side_midpoints(corner_set: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    left_midpoint = (corner_set[0] + corner_set[2]) / 2.0
    right_midpoint = (corner_set[1] + corner_set[3]) / 2.0
    return left_midpoint.astype(np.float32), right_midpoint.astype(np.float32)


def _draw_selected_cobb_vertebrae(
    img: np.ndarray,
    corners: np.ndarray,
    selected_pairs: tuple[tuple[int, int], ...],
    scale: float,
) -> None:
    if corners is None or len(corners) == 0 or not selected_pairs:
        return

    colors = ((0, 255, 255), (0, 165, 255), (255, 255, 0))
    thickness = max(2, int(round(2.5 * scale)))
    radius = max(4, int(round(5 * scale)))
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.38, 0.44 * scale)
    font_thick = max(1, int(round(1.5 * scale)))

    def pair_sort_key(pair: tuple[int, int]) -> float:
        valid_indices = [idx for idx in pair if 0 <= idx < len(corners)]
        if not valid_indices:
            return float("inf")
        return float(np.mean([np.mean(corners[idx, :, 1]) for idx in valid_indices]))

    ordered_pairs = tuple(sorted(selected_pairs, key=pair_sort_key))
    label_records = {}
    for pair_idx, pair in enumerate(ordered_pairs):
        label = _cobb_display_label(pair_idx, len(ordered_pairs))
        color = colors[pair_idx % len(colors)]

        for vertebra_idx in pair:
            if vertebra_idx < 0 or vertebra_idx >= len(corners):
                continue

            left_midpoint, right_midpoint = _side_midpoints(corners[vertebra_idx].astype(np.float32))
            p1 = tuple(np.round(left_midpoint).astype(int))
            p2 = tuple(np.round(right_midpoint).astype(int))
            center = ((left_midpoint + right_midpoint) / 2.0).astype(np.float32)

            cv2.line(img, p1, p2, color, thickness + 2, cv2.LINE_AA)
            cv2.line(img, p1, p2, (0, 0, 0), max(1, thickness - 1), cv2.LINE_AA)
            cv2.line(img, p1, p2, color, thickness, cv2.LINE_AA)
            cv2.circle(img, p1, radius, color, -1, cv2.LINE_AA)
            cv2.circle(img, p2, radius, color, -1, cv2.LINE_AA)

            if label:
                record = label_records.setdefault(
                    vertebra_idx,
                    {
                        "labels": [],
                        "color": color,
                        "p1": p1,
                        "p2": p2,
                        "center": center,
                    },
                )
                if label not in record["labels"]:
                    record["labels"].append(label)
                record["p1"] = p1
                record["p2"] = p2
                record["center"] = center

    for record in label_records.values():
        text = "/".join(record["labels"])
        p1 = record["p1"]
        p2 = record["p2"]
        center = record["center"]
        text_color = record["color"] if len(record["labels"]) == 1 else (235, 238, 242)

        (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, font_thick)
        label_gap = max(8, int(round(11 * scale)))
        right_x = int(round(max(p1[0], p2[0]) + label_gap))
        left_x = int(round(min(p1[0], p2[0]) - label_gap - text_w))
        if right_x + text_w + 8 <= img.shape[1]:
            x = right_x
        elif left_x >= 8:
            x = left_x
        else:
            x = int(np.clip(right_x, 4, max(img.shape[1] - text_w - 4, 4)))
        y = int(
            np.clip(
                center[1] + text_h / 2,
                text_h + 6,
                max(img.shape[0] - baseline - 4, text_h + 6),
            )
        )
        _draw_rounded_rect(
            img,
            x - 6,
            y - text_h - 5,
            x + text_w + 6,
            y + baseline + 3,
            (12, 16, 20),
            max(5, int(round(6 * scale))),
            0.88,
        )
        cv2.putText(img, text, (x, y), font, font_scale, text_color, font_thick, cv2.LINE_AA)


def draw_overlay(
    img: np.ndarray,
    pts: np.ndarray,
    boxes: Optional[np.ndarray],
    draw_global_centerline: bool = False,
    corners: Optional[np.ndarray] = None,
    scores: Optional[np.ndarray] = None,
    width_ratios: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Draw AP vertebra landmarks without guide lines.

    The prediction view intentionally keeps labels close to their vertebrae and
    avoids centerlines, crossbars, or connectors that could obscure anatomy.
    """
    out = img.copy()
    if pts is None or len(pts) == 0:
        return out

    h, w = out.shape[:2]
    image_h, image_w = h, w
    pts_f = pts.astype(np.float32)
    scale = max(0.85, min(1.8, min(h, w) / 760.0))
    bounds = _detection_bounds(pts_f, boxes, corners, w, h)

    label_texts: list[str] = []
    for i in range(len(pts_f)):
        label_text = f"{i+1}"
        if width_ratios is not None and len(width_ratios) > i:
            val = float(np.clip(width_ratios[i], 0.0, 0.99)) * 100.0
            label_text = f"{val:.0f}%"
        elif scores is not None and len(scores) > i:
            label_text = f"{int(round(float(scores[i]) * 100)):02d}%"
        label_texts.append(label_text)

    if corners is not None and len(corners) > 0:
        cobb_result = cobb_result_from_corners(corners, out.shape)
        cobb_angles = cobb_result.display_angles
    else:
        cobb = cobb_from_points(pts_f) if len(pts_f) >= 3 else 0.0
        cobb_angles = (cobb,)
    max_chip_w = max((_chip_size(text, scale)[0] for text in label_texts), default=0)
    metric_w, _ = _metric_panel_size(cobb_angles, scale)
    margin = max(12, int(round(16 * scale)))
    gap = max(10, int(round(14 * scale)))
    left_room = max(0, int(bounds[0]) - margin - gap)
    right_room = max(0, w - int(bounds[2]) - margin - gap)
    label_side = "right" if right_room >= left_room else "left"
    if label_side == "right" and right_room < max_chip_w <= left_room:
        label_side = "left"
    elif label_side == "left" and left_room < max_chip_w <= right_room:
        label_side = "right"

    panel_left_room = left_room
    panel_right_room = right_room

    if max(left_room, right_room) < max_chip_w:
        extra = max_chip_w - right_room + margin
        out = cv2.copyMakeBorder(
            out,
            0,
            0,
            0,
            max(margin, int(extra)),
            cv2.BORDER_CONSTANT,
            value=(12, 14, 17),
        )
        h, w = out.shape[:2]
        right_room = max(0, w - int(bounds[2]) - margin - gap)
        label_side = "right"

    label_records = []

    for i, center in enumerate(pts_f):
        center = center.astype(np.float32)
        color_label = COLORS[i % len(COLORS)]
        label_y = float(center[1])
        left_x = float(center[0])
        right_x = float(center[0])

        if corners is not None and len(corners) > i:
            corner_set = corners[i].astype(np.float32)
            left_x = float(np.min(corner_set[:, 0]))
            right_x = float(np.max(corner_set[:, 0]))
            label_y = float(np.mean(corner_set[:, 1]))
            for pt in corner_set:
                cv2.circle(
                    out,
                    tuple(np.round(pt).astype(int)),
                    4,
                    color_label,
                    -1,
                    lineType=cv2.LINE_AA,
                )
        else:
            if boxes is not None and len(boxes) > i:
                x1, y1, x2, y2 = boxes[i].astype(np.float32)
                left_x = float(x1)
                right_x = float(x2)
                label_y = float((y1 + y2) * 0.5)
                corners_fallback = [
                    (x1, y1), (x2, y1),
                    (x1, y2), (x2, y2),
                ]
                for pt in corners_fallback:
                    cv2.circle(
                        out,
                        tuple(np.round(pt).astype(int)),
                        4,
                        color_label,
                        -1,
                        lineType=cv2.LINE_AA,
                    )
            else:
                cv2.circle(
                    out,
                    tuple(np.round(center).astype(int)),
                    4,
                    color_label,
                    -1,
                    lineType=cv2.LINE_AA,
                )

        chip_w, chip_h = _chip_size(label_texts[i], scale)
        local_right_room = (w - margin) - (right_x + gap)
        local_left_room = (left_x - gap) - margin
        place_right = local_right_room >= local_left_room

        if place_right and local_right_room < chip_w <= local_left_room:
            place_right = False
        elif not place_right and local_left_room < chip_w <= local_right_room:
            place_right = True

        if place_right:
            edge_x = int(np.clip(right_x + gap, margin, max(w - margin - chip_w, margin)))
            side = "right"
        else:
            edge_x = int(
                np.clip(left_x - gap, min(margin + chip_w, w - margin), w - margin)
            )
            side = "left"

        label_records.append(
            {
                "text": label_texts[i],
                "edge_x": edge_x,
                "side": side,
                "y": int(np.clip(label_y, margin + chip_h // 2, h - margin - chip_h // 2)),
                "accent": color_label,
            }
        )

    label_right_count = sum(1 for record in label_records if record["side"] == "right")
    label_side = "right" if label_right_count >= len(label_records) / 2 else "left"
    opposite_side = "left" if label_side == "right" else "right"
    opposite_room = panel_left_room if opposite_side == "left" else panel_right_room
    label_room = panel_right_room if label_side == "right" else panel_left_room
    cobb_side = opposite_side if opposite_room >= metric_w else label_side
    if label_room < metric_w <= opposite_room:
        cobb_side = opposite_side

    if len(pts_f) >= 3:
        _draw_cobb_panel(
            out,
            cobb_angles,
            cobb_side,
            bounds,
            scale,
            panel_bounds=(0, 0, image_w, image_h),
        )

    for record in label_records:
        _draw_label_chip(
            out,
            str(record["text"]),
            int(record["edge_x"]),
            int(record["y"]),
            str(record["side"]),
            scale,
            record["accent"],
        )

    if corners is not None and len(corners) > 0:
        _draw_selected_cobb_vertebrae(
            out,
            corners.astype(np.float32),
            cobb_result.display_pairs,
            scale,
        )

    return out

def draw_heatmap_overlay(img: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Create a smooth Gaussian heatmap overlay (BGR-safe) and draw the spine curve."""
    h, w = img.shape[:2]
    heat = np.zeros((h, w), np.float32)

    # accumulate Gaussian bumps
    for (x, y) in pts.astype(int):
        if 0 <= x < w and 0 <= y < h:
            blob = np.zeros_like(heat)
            blob[y, x] = 1.0
            heat += cv2.GaussianBlur(blob, (0, 0), sigmaX=10, sigmaY=10)

    m = heat.max()
    if m > 0:
        heat /= m
    hm_u8 = (np.clip(heat, 0, 1) * 255).astype(np.uint8)
    hm_color = cv2.applyColorMap(hm_u8, cv2.COLORMAP_JET)

    # base in grayscale (BGR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    base = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    blended = cv2.addWeighted(base, 0.4, hm_color, 0.6, 0)

    # draw centerline and points
    for p1, p2 in zip(pts[:-1], pts[1:]):
        cv2.line(blended, tuple(p1.astype(int)), tuple(p2.astype(int)), (0, 255, 255), 2)
    for (x, y) in pts.astype(int):
        cv2.circle(blended, (x, y), 4, (0, 255, 255), -1, lineType=cv2.LINE_AA)

    return blended
