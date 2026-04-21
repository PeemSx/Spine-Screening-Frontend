import cv2
import torch
import numpy as np
from typing import Tuple, Optional

from core.cobb import (
    cobb_angle_from_center_points,
    cobb_result_from_corners,
    primary_cobb_angle_from_corners,
)

# Distinct per-vertebra colors (RGB in 0-255)
COLORS = [
    (196,  6, 250),  (138, 208, 242), ( 20, 203,  39),
    (238, 229,  25), (187,  13, 251), (  4,  41, 240),
    (138, 208, 115), (213, 250,  31), (186,  59,  76),
    ( 98, 242, 253), (117,  10, 252), (254,  23, 213),
    (246,   6,  33), ( 85, 255, 153), (244, 226, 142),
    (  9,  16, 226), ( 13, 228,  23),
]

def _to_heatmap_scale(value_px: float, down_ratio: int) -> float:
    if value_px <= 0:
        return 0.0
    return float(value_px) / float(max(int(down_ratio), 1))


def _squared_candidate_distance(candidate_a: dict, candidate_b: dict) -> float:
    dx = float(candidate_a["x"]) - float(candidate_b["x"])
    dy = float(candidate_a["y"]) - float(candidate_b["y"])
    return dx * dx + dy * dy


def _filter_candidates_by_confidence(
    candidates: list[dict],
    conf_thresh: float,
    num_vertebrae: int,
) -> tuple[list[dict], bool]:
    if conf_thresh <= 0:
        return list(candidates), False

    confident = [cand for cand in candidates if float(cand["score"]) >= conf_thresh]
    if len(confident) >= num_vertebrae:
        return confident, True
    return list(candidates), False


def _suppress_duplicate_candidates(
    candidates: list[dict],
    duplicate_radius_px: float,
    down_ratio: int,
) -> list[dict]:
    radius = _to_heatmap_scale(duplicate_radius_px, down_ratio)
    if radius <= 0 or len(candidates) <= 1:
        return list(candidates)

    radius_sq = radius * radius
    selected = []
    for cand in sorted(candidates, key=lambda item: (-item["score"], item["y"], item["x"])):
        keep = True
        for prev in selected:
            if _squared_candidate_distance(cand, prev) <= radius_sq:
                keep = False
                break
        if keep:
            selected.append(cand)
    return selected


def _estimate_spacing_prior(
    candidates: list[dict],
    num_vertebrae: int,
    down_ratio: int,
    min_dy_px: float,
    max_dy_px: float,
) -> tuple[float, float, float]:
    if len(candidates) < 2:
        return 1.0, 0.0, float("inf")

    ys = np.asarray([cand["y"] for cand in candidates], dtype=np.float32)
    full_span = float(max(ys[-1] - ys[0], 1.0))
    lower = float(np.percentile(ys, 5.0))
    upper = float(np.percentile(ys, 95.0))
    trimmed_span = max(upper - lower, 1.0)
    target_dy = max(0.5 * (full_span + trimmed_span) / max(num_vertebrae - 1, 1), 1.0)

    min_dy = _to_heatmap_scale(min_dy_px, down_ratio)
    max_dy = _to_heatmap_scale(max_dy_px, down_ratio)
    if min_dy <= 0:
        min_dy = 0.45 * target_dy
    if max_dy <= 0:
        max_dy = 1.90 * target_dy
    if max_dy <= min_dy:
        max_dy = min_dy + max(0.5 * target_dy, 1.0)

    return float(target_dy), float(min_dy), float(max_dy)


def _pair_penalty(
    prev_cand: dict,
    curr_cand: dict,
    target_dy: float,
    min_dy: float,
    max_dy: float,
    spacing_weight: float,
    smoothness_weight: float,
) -> float | None:
    dy = float(curr_cand["y"]) - float(prev_cand["y"])
    if dy <= 0 or dy < min_dy or dy > max_dy:
        return None

    dx = float(curr_cand["x"]) - float(prev_cand["x"])
    dy_norm = dy / max(target_dy, 1e-6)
    dx_norm = dx / max(target_dy, 1e-6)
    spacing_penalty = (dy_norm - 1.0) ** 2
    smoothness_penalty = dx_norm**2
    return spacing_weight * spacing_penalty + smoothness_weight * smoothness_penalty


def _triple_penalty(
    prev_prev_cand: dict,
    prev_cand: dict,
    curr_cand: dict,
    target_dy: float,
    spacing_weight: float,
    curvature_weight: float,
) -> float:
    prev_dy = float(prev_cand["y"]) - float(prev_prev_cand["y"])
    curr_dy = float(curr_cand["y"]) - float(prev_cand["y"])
    spacing_change = (curr_dy - prev_dy) / max(target_dy, 1e-6)
    curvature = (
        float(curr_cand["x"]) - 2.0 * float(prev_cand["x"]) + float(prev_prev_cand["x"])
    ) / max(target_dy, 1e-6)
    return 0.5 * spacing_weight * (spacing_change**2) + curvature_weight * abs(curvature)


def _select_topk_candidates(
    candidates: list[dict],
    num_vertebrae: int,
) -> list[dict] | None:
    if len(candidates) < num_vertebrae:
        return None

    selected = sorted(candidates, key=lambda item: (-item["score"], item["y"], item["x"]))
    selected = selected[:num_vertebrae]
    return sorted(selected, key=lambda item: (item["y"], item["x"]))


def _select_best_chain(
    candidates: list[dict],
    num_vertebrae: int,
    down_ratio: int,
    min_dy_px: float,
    max_dy_px: float,
    score_weight: float,
    spacing_weight: float,
    smoothness_weight: float,
    curvature_weight: float,
    relaxed_min_dy_scale: float,
    relaxed_max_dy_scale: float,
    relax_constraints: bool = False,
) -> list[dict] | None:
    if len(candidates) < num_vertebrae:
        return None

    ordered = sorted(candidates, key=lambda item: (item["y"], item["x"]))
    target_dy, min_dy, max_dy = _estimate_spacing_prior(
        ordered,
        num_vertebrae,
        down_ratio,
        min_dy_px,
        max_dy_px,
    )
    if relax_constraints:
        min_dy *= relaxed_min_dy_scale
        max_dy *= relaxed_max_dy_scale

    target_len = num_vertebrae
    num_candidates = len(ordered)
    inf = np.inf
    point_cost = np.asarray(
        [-score_weight * float(cand["score"]) for cand in ordered],
        dtype=np.float64,
    )
    dp = np.full((target_len + 1, num_candidates, num_candidates), inf, dtype=np.float64)
    parent = np.full((target_len + 1, num_candidates, num_candidates), -1, dtype=np.int32)

    for prev_idx in range(num_candidates - 1):
        for curr_idx in range(prev_idx + 1, num_candidates):
            pair_cost = _pair_penalty(
                ordered[prev_idx],
                ordered[curr_idx],
                target_dy,
                min_dy,
                max_dy,
                spacing_weight,
                smoothness_weight,
            )
            if pair_cost is None:
                continue
            dp[2, prev_idx, curr_idx] = point_cost[prev_idx] + point_cost[curr_idx] + pair_cost

    for length in range(3, target_len + 1):
        min_prev_idx = length - 2
        for prev_idx in range(min_prev_idx, num_candidates - 1):
            for curr_idx in range(prev_idx + 1, num_candidates):
                pair_cost = _pair_penalty(
                    ordered[prev_idx],
                    ordered[curr_idx],
                    target_dy,
                    min_dy,
                    max_dy,
                    spacing_weight,
                    smoothness_weight,
                )
                if pair_cost is None:
                    continue

                best_cost = inf
                best_prev_prev_idx = -1
                for prev_prev_idx in range(prev_idx):
                    previous_cost = dp[length - 1, prev_prev_idx, prev_idx]
                    if not np.isfinite(previous_cost):
                        continue
                    triple_cost = _triple_penalty(
                        ordered[prev_prev_idx],
                        ordered[prev_idx],
                        ordered[curr_idx],
                        target_dy,
                        spacing_weight,
                        curvature_weight,
                    )
                    current_cost = previous_cost + point_cost[curr_idx] + pair_cost + triple_cost
                    if current_cost < best_cost:
                        best_cost = current_cost
                        best_prev_prev_idx = prev_prev_idx

                if best_prev_prev_idx != -1:
                    dp[length, prev_idx, curr_idx] = best_cost
                    parent[length, prev_idx, curr_idx] = best_prev_prev_idx

    best_cost = inf
    best_prev_idx = -1
    best_curr_idx = -1
    for prev_idx in range(num_candidates - 1):
        for curr_idx in range(prev_idx + 1, num_candidates):
            current_cost = dp[target_len, prev_idx, curr_idx]
            if current_cost < best_cost:
                best_cost = current_cost
                best_prev_idx = prev_idx
                best_curr_idx = curr_idx

    if best_prev_idx == -1:
        return None

    chain_indices = [best_curr_idx, best_prev_idx]
    curr_length = target_len
    curr_prev_idx = best_prev_idx
    curr_curr_idx = best_curr_idx
    while curr_length > 2:
        prev_prev_idx = parent[curr_length, curr_prev_idx, curr_curr_idx]
        if prev_prev_idx < 0:
            return None
        chain_indices.append(int(prev_prev_idx))
        curr_curr_idx = curr_prev_idx
        curr_prev_idx = int(prev_prev_idx)
        curr_length -= 1

    chain_indices.reverse()
    return [ordered[idx] for idx in chain_indices]


def _merge_candidate_sources(*candidate_groups: list[dict]) -> list[dict]:
    merged = []
    seen_heat_indices = set()
    for candidates in candidate_groups:
        for cand in candidates:
            heat_index = int(cand["heat_index"])
            if heat_index in seen_heat_indices:
                continue
            merged.append(cand)
            seen_heat_indices.add(heat_index)
    return merged


def _enforce_non_overlapping_selection(
    seed_candidates: list[dict],
    supplemental_candidates: list[dict],
    num_vertebrae: int,
    duplicate_radius_px: float,
    down_ratio: int,
) -> list[dict] | None:
    radius = _to_heatmap_scale(duplicate_radius_px, down_ratio)
    radius_sq = radius * radius
    selected = []
    seen_heat_indices = set()

    def try_add(candidate: dict) -> bool:
        heat_index = int(candidate["heat_index"])
        if heat_index in seen_heat_indices:
            return False
        if radius > 0:
            for prev in selected:
                if _squared_candidate_distance(candidate, prev) <= radius_sq:
                    return False
        selected.append(candidate)
        seen_heat_indices.add(heat_index)
        return True

    for cand in sorted(seed_candidates, key=lambda item: (-item["score"], item["y"], item["x"])):
        try_add(cand)
        if len(selected) == num_vertebrae:
            break

    for cand in supplemental_candidates:
        if len(selected) == num_vertebrae:
            break
        try_add(cand)

    if len(selected) < num_vertebrae:
        return None
    return sorted(selected, key=lambda item: (item["y"], item["x"]))


def _select_spine_chain_candidates(
    raw_candidates: list[dict],
    num_vertebrae: int,
    conf_thresh: float,
    down_ratio: int,
    duplicate_radius_px: float,
    min_dy_px: float,
    max_dy_px: float,
    score_weight: float,
    spacing_weight: float,
    smoothness_weight: float,
    curvature_weight: float,
    relaxed_min_dy_scale: float,
    relaxed_max_dy_scale: float,
) -> list[dict]:
    filtered_candidates, _ = _filter_candidates_by_confidence(
        raw_candidates,
        conf_thresh,
        num_vertebrae,
    )
    suppressed_candidates = _suppress_duplicate_candidates(
        filtered_candidates,
        duplicate_radius_px,
        down_ratio,
    )

    selected_candidates = _select_best_chain(
        suppressed_candidates,
        num_vertebrae,
        down_ratio,
        min_dy_px,
        max_dy_px,
        score_weight,
        spacing_weight,
        smoothness_weight,
        curvature_weight,
        relaxed_min_dy_scale,
        relaxed_max_dy_scale,
        relax_constraints=False,
    )
    if selected_candidates is None:
        selected_candidates = _select_best_chain(
            suppressed_candidates,
            num_vertebrae,
            down_ratio,
            min_dy_px,
            max_dy_px,
            score_weight,
            spacing_weight,
            smoothness_weight,
            curvature_weight,
            relaxed_min_dy_scale,
            relaxed_max_dy_scale,
            relax_constraints=True,
        )
    if selected_candidates is None and len(filtered_candidates) >= num_vertebrae:
        selected_candidates = _select_best_chain(
            filtered_candidates,
            num_vertebrae,
            down_ratio,
            min_dy_px,
            max_dy_px,
            score_weight,
            spacing_weight,
            smoothness_weight,
            curvature_weight,
            relaxed_min_dy_scale,
            relaxed_max_dy_scale,
            relax_constraints=True,
        )
    if selected_candidates is None:
        selected_candidates = _select_topk_candidates(suppressed_candidates, num_vertebrae)
    if selected_candidates is None:
        selected_candidates = _select_topk_candidates(filtered_candidates, num_vertebrae)
    if selected_candidates is None:
        selected_candidates = _select_topk_candidates(raw_candidates, num_vertebrae)
    if selected_candidates is None:
        return []

    supplemental_candidates = _merge_candidate_sources(
        suppressed_candidates,
        filtered_candidates,
        raw_candidates,
    )
    enforced_selection = _enforce_non_overlapping_selection(
        selected_candidates,
        supplemental_candidates,
        num_vertebrae,
        duplicate_radius_px,
        down_ratio,
    )
    if enforced_selection is not None:
        return enforced_selection
    return sorted(selected_candidates, key=lambda item: (item["y"], item["x"]))


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
    def nms(hm: torch.Tensor, kernel: int = 3) -> torch.Tensor:
        pad = (kernel - 1) // 2
        hmax = torch.nn.functional.max_pool2d(hm, (kernel, kernel), stride=1, padding=pad)
        keep = (hmax == hm).float()
        return hm * keep

    def topk(scores: torch.Tensor, topk: int = 40):
        b, c, h, w = scores.size()
        topk = min(int(topk), h * w)
        scores = nms(scores).view(b, c, -1)
        tk_scores, tk_inds = torch.topk(scores, topk)
        tk_inds = tk_inds % (h * w)
        tk_ys = (tk_inds // w).float()
        tk_xs = (tk_inds % w).float()
        tk_scores = tk_scores.view(b, -1)
        tk_inds = tk_inds.view(b, -1)
        tk_classes = (torch.arange(c).view(1, c, 1).expand(b, c, topk).contiguous().view(b, -1))
        tk_scores, tk_idx = torch.topk(tk_scores, topk)
        def gather(x): return torch.gather(x, 1, tk_idx)
        return (
            tk_scores.squeeze(0),
            torch.gather(tk_inds, 1, tk_idx).squeeze(0),
            gather(tk_classes).squeeze(0),
            gather(tk_ys.view(b, -1)).squeeze(0),
            gather(tk_xs.view(b, -1)).squeeze(0),
        )

    def gather_feat(feat: torch.Tensor, ind: torch.Tensor) -> torch.Tensor:
        if feat.dim() == 4:
            b, c, h, w = feat.size()
            feat = feat.view(b, c, -1)  # flatten to (B, C, H*W)
        else:
            b, c, _ = feat.size()

        if ind.dim() == 1:
            ind = ind.unsqueeze(0)  # → (1, N)
        if ind.dim() == 2 and b == 1:
            ind = ind.expand(b, ind.size(1))  # broadcast batch

        ind = ind.long().unsqueeze(1).expand(b, c, ind.size(-1))
        out = torch.gather(feat, 2, ind)
        out = out.squeeze(0).transpose(0, 1)  # (N, C)
        return out

    if torch.min(hm) < 0 or torch.max(hm) > 1:
        hm = torch.sigmoid(hm)
    num_vertebrae = max(int(top_k_num), 1)
    candidate_count = max(
        int(candidate_top_k) if candidate_top_k is not None else 40,
        num_vertebrae,
    )
    scores, inds, clses, ys, xs = topk(hm, topk=candidate_count)

    reg = gather_feat(reg, inds)
    wh = gather_feat(wh, inds)

    xs = xs + reg[:, 0]
    ys = ys + reg[:, 1]

    tl_x = xs - wh[:, 0]; tl_y = ys - wh[:, 1]
    tr_x = xs - wh[:, 2]; tr_y = ys - wh[:, 3]
    bl_x = xs - wh[:, 4]; bl_y = ys - wh[:, 5]
    br_x = xs - wh[:, 6]; br_y = ys - wh[:, 7]

    wh_np = wh.detach().cpu().numpy().astype(np.float32)
    xs_np = xs.detach().cpu().numpy().astype(np.float32)
    ys_np = ys.detach().cpu().numpy().astype(np.float32)
    scores_np = scores.detach().cpu().numpy().astype(np.float32)
    inds_np = inds.detach().cpu().numpy().astype(np.int64)

    raw_candidates = []
    for idx in range(len(scores_np)):
        raw_candidates.append(
            {
                "raw_rank": int(idx),
                "heat_index": int(inds_np[idx]),
                "x": float(xs_np[idx]),
                "y": float(ys_np[idx]),
                "score": float(scores_np[idx]),
                "wh": wh_np[idx].copy(),
            }
        )

    selected_candidates = _select_spine_chain_candidates(
        raw_candidates,
        num_vertebrae=num_vertebrae,
        conf_thresh=conf_thresh,
        down_ratio=down_ratio,
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
    if not selected_candidates:
        return (
            np.zeros((0, 2), dtype=np.float32),
            np.zeros((0, 4), dtype=np.float32),
            np.zeros((0,), dtype=np.float32),
            np.zeros((0, 4, 2), dtype=np.float32),
        )

    xs_sel = np.asarray([cand["x"] for cand in selected_candidates], dtype=np.float32)
    ys_sel = np.asarray([cand["y"] for cand in selected_candidates], dtype=np.float32)
    scores_sel = np.asarray([cand["score"] for cand in selected_candidates], dtype=np.float32)
    wh_sel = np.asarray([cand["wh"] for cand in selected_candidates], dtype=np.float32)

    tl = np.stack([xs_sel - wh_sel[:, 0], ys_sel - wh_sel[:, 1]], axis=1) * down_ratio
    tr = np.stack([xs_sel - wh_sel[:, 2], ys_sel - wh_sel[:, 3]], axis=1) * down_ratio
    bl = np.stack([xs_sel - wh_sel[:, 4], ys_sel - wh_sel[:, 5]], axis=1) * down_ratio
    br = np.stack([xs_sel - wh_sel[:, 6], ys_sel - wh_sel[:, 7]], axis=1) * down_ratio

    corners_inp = np.stack([tl, tr, bl, br], axis=1).astype(np.float32)
    x1 = np.min(corners_inp[:, :, 0], axis=1)
    y1 = np.min(corners_inp[:, :, 1], axis=1)
    x2 = np.max(corners_inp[:, :, 0], axis=1)
    y2 = np.max(corners_inp[:, :, 1], axis=1)
    boxes_inp = np.stack([x1, y1, x2, y2], axis=1).astype(np.float32)
    pts_inp = np.stack([xs_sel, ys_sel], axis=1).astype(np.float32) * down_ratio

    return pts_inp, boxes_inp, scores_sel, corners_inp


def scale_points_and_boxes_to_original(
    pts_inp: np.ndarray,
    boxes_inp: Optional[np.ndarray],
    orig_w: int, orig_h: int, in_w: int, in_h: int
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """Rescale points and boxes back to the original image size."""
    sx, sy = orig_w / in_w, orig_h / in_h
    pts = pts_inp.copy()
    pts[:, 0] *= sx
    pts[:, 1] *= sy
    boxes = None
    if boxes_inp is not None:
        boxes = boxes_inp.copy()
        boxes[:, [0, 2]] *= sx
        boxes[:, [1, 3]] *= sy
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
        label = ""
        if len(cobb_angles) > 1:
            label = "U" if idx == 0 else "L"
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
) -> None:
    cobb_angles = tuple(float(angle) for angle in cobb_angles) or (0.0,)
    h, w = img.shape[:2]
    panel_w, panel_h = _metric_panel_size(cobb_angles, scale)
    margin = max(12, int(round(16 * scale)))
    gap = max(10, int(round(14 * scale)))

    if side == "right":
        x1 = min(w - margin - panel_w, int(bounds[2] + gap))
    else:
        x1 = max(margin, int(bounds[0] - gap - panel_w))
    x1 = int(np.clip(x1, margin, max(w - margin - panel_w, margin)))
    x2 = x1 + panel_w

    center_y = int((bounds[1] + bounds[3]) * 0.5)
    y1 = int(np.clip(center_y - panel_h // 2, margin, max(h - margin - panel_h, margin)))
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
        label = ""
        if len(cobb_angles) > 1:
            label = "U" if idx == 0 else "L"
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

    if max(left_room, right_room) < max(max_chip_w, metric_w):
        extra = max(max_chip_w, metric_w) - right_room + margin
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
    opposite_room = left_room if opposite_side == "left" else right_room
    label_room = right_room if label_side == "right" else left_room
    cobb_side = opposite_side if opposite_room >= metric_w else label_side
    if label_room < metric_w <= opposite_room:
        cobb_side = opposite_side

    if len(pts_f) >= 3:
        _draw_cobb_panel(out, cobb_angles, cobb_side, bounds, scale)

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
