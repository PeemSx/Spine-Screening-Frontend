import cv2
import torch
import numpy as np
from typing import Tuple, Optional

# Distinct per-vertebra colors (RGB in 0-255)
COLORS = [
    (196,  6, 250),  (138, 208, 242), ( 20, 203,  39),
    (238, 229,  25), (187,  13, 251), (  4,  41, 240),
    (138, 208, 115), (213, 250,  31), (186,  59,  76),
    ( 98, 242, 253), (117,  10, 252), (254,  23, 213),
    (246,   6,  33), ( 85, 255, 153), (244, 226, 142),
    (  9,  16, 226), ( 13, 228,  23),
]

def decode_centernet_8corners(
    hm: torch.Tensor, 
    reg: torch.Tensor, 
    wh: torch.Tensor,
    top_k_num: int = 40,          
    down_ratio: int = 4,        
    conf_thresh: float = 0.3      
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Decode CenterNet outputs for 8-corner vertebra detections."""
    def nms(hm: torch.Tensor, kernel: int = 3) -> torch.Tensor:
        pad = (kernel - 1) // 2
        hmax = torch.nn.functional.max_pool2d(hm, (kernel, kernel), stride=1, padding=pad)
        keep = (hmax == hm).float()
        return hm * keep

    def topk(scores: torch.Tensor, topk: int = 40):
        b, c, h, w = scores.size()
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

    hm = torch.sigmoid(hm)
    scores, inds, clses, ys, xs = topk(hm, topk=top_k_num)

    reg = gather_feat(reg, inds)
    wh = gather_feat(wh, inds)

    xs = xs + reg[:, 0]
    ys = ys + reg[:, 1]

    tl_x = xs - wh[:, 0]; tl_y = ys - wh[:, 1]
    tr_x = xs - wh[:, 2]; tr_y = ys - wh[:, 3]
    bl_x = xs - wh[:, 4]; bl_y = ys - wh[:, 5]
    br_x = xs - wh[:, 6]; br_y = ys - wh[:, 7]

    tl = torch.stack([tl_x, tl_y], dim=1) * down_ratio
    tr = torch.stack([tr_x, tr_y], dim=1) * down_ratio
    bl = torch.stack([bl_x, bl_y], dim=1) * down_ratio
    br = torch.stack([br_x, br_y], dim=1) * down_ratio

    x1 = torch.min(torch.min(tl[:, 0], tr[:, 0]), torch.min(bl[:, 0], br[:, 0]))
    y1 = torch.min(torch.min(tl[:, 1], tr[:, 1]), torch.min(bl[:, 1], br[:, 1]))
    x2 = torch.max(torch.max(tl[:, 0], tr[:, 0]), torch.max(bl[:, 0], br[:, 0]))
    y2 = torch.max(torch.max(tl[:, 1], tr[:, 1]), torch.max(bl[:, 1], br[:, 1]))
    boxes_inp = torch.stack([x1, y1, x2, y2], dim=1).cpu().numpy()
    corners_inp = torch.stack([tl, tr, bl, br], dim=1).cpu().numpy()

    cx = (tl[:, 0] + tr[:, 0] + bl[:, 0] + br[:, 0]) / 4.0
    cy = (tl[:, 1] + tr[:, 1] + bl[:, 1] + br[:, 1]) / 4.0
    pts_inp = torch.stack([cx, cy], dim=1).cpu().numpy()

    sc = scores.cpu().numpy()
    keep = sc >= conf_thresh
    return pts_inp[keep], boxes_inp[keep], sc[keep], corners_inp[keep]

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
    """Estimate Cobb angle from detected vertebra center points."""
    if len(pts) < 3:
        return 0.0
    vecs = np.diff(pts, axis=0)
    ang = np.degrees(np.arctan2(vecs[:, 1], vecs[:, 0]))
    cobb = float(abs(np.max(ang) - np.min(ang)))
    return cobb

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
    Draw vertebra landmarks with per-vertebra orientation cues.
      - Cyan segment spans the top edge of the vertebra.
      - Yellow segment follows the local centerline tangent through the vertebra.
      - All four corners (when available) are highlighted.
      - Optional percentage labels use either width ratios (preferred) or raw scores.
    If draw_global_centerline=True, also draw a polyline through all vertebra centers.
    """
    out = img.copy()
    if pts is None or len(pts) == 0:
        return out

    h, w = out.shape[:2]
    pts_f = pts.astype(np.float32)

    if draw_global_centerline and len(pts_f) > 1:
        poly = pts_f.reshape(-1, 1, 2).astype(np.int32)
        cv2.polylines(out, [poly], isClosed=False, color=(0, 255, 255), thickness=2, lineType=cv2.LINE_AA)

    num_pts = len(pts_f)
    cyan = (255, 255, 0)
    yellow = (0, 255, 255)

    for i, center in enumerate(pts_f):
        center = center.astype(np.float32)
        center_xy = tuple(np.round(center).astype(int))

        # Local tangent (direction along the spine curve)
        tangent = np.array([0.0, 1.0], dtype=np.float32)
        if num_pts > 1:
            if i == 0:
                tangent = pts_f[1] - center
            elif i == num_pts - 1:
                tangent = center - pts_f[i - 1]
            else:
                tangent = pts_f[i + 1] - pts_f[i - 1]
        if np.linalg.norm(tangent) < 1e-3:
            tangent = np.array([0.0, 1.0], dtype=np.float32)
        else:
            tangent = tangent / np.linalg.norm(tangent)

        neighbor_span = 0.0
        if i < num_pts - 1:
            neighbor_span = max(neighbor_span, np.linalg.norm(pts_f[i + 1] - center))
        if i > 0:
            neighbor_span = max(neighbor_span, np.linalg.norm(center - pts_f[i - 1]))
        mid_len = float(max(5.0, neighbor_span * 0.14))

        # Endpoints
        mid_start = center - tangent * mid_len
        mid_end = center + tangent * mid_len

        mid_start_xy = tuple(np.round(mid_start).astype(int))
        mid_end_xy = tuple(np.round(mid_end).astype(int))
        cv2.line(out, mid_start_xy, mid_end_xy, yellow, 2, lineType=cv2.LINE_AA)

        color_label = COLORS[i % len(COLORS)]

        # Cyan crossbar along the vertebral top edge + corner markers
        top_mid = None
        if corners is not None and len(corners) > i:
            corner_set = corners[i].astype(np.float32)
            tl, tr, bl, br = corner_set
            top_mid = (tl + tr) * 0.5
            top_mid_xy = tuple(np.round(top_mid).astype(int))
            cv2.line(out, tuple(np.round(tl).astype(int)), tuple(np.round(tr).astype(int)), cyan, 2, lineType=cv2.LINE_AA)
            for pt in (tl, tr, bl, br):
                cv2.circle(out, tuple(np.round(pt).astype(int)), 4, color_label, -1, lineType=cv2.LINE_AA)
        else:
            approx_top = None
            if boxes is not None and len(boxes) > i:
                x1, y1, x2, y2 = boxes[i].astype(np.float32)
                approx_top = np.array([(x1 + x2) * 0.5, y1], dtype=np.float32)
                corners_fallback = [
                    (x1, y1), (x2, y1),
                    (x1, y2), (x2, y2),
                ]
                pt_lt = tuple(np.round([x1, y1]).astype(int))
                pt_rt = tuple(np.round([x2, y1]).astype(int))
                cv2.line(out, pt_lt, pt_rt, cyan, 2, lineType=cv2.LINE_AA)
                for pt in corners_fallback:
                    cv2.circle(out, tuple(np.round(pt).astype(int)), 4, color_label, -1, lineType=cv2.LINE_AA)
            if approx_top is None:
                approx_top = center - tangent * 20.0
            top_mid = approx_top
            top_mid_xy = tuple(np.round(top_mid).astype(int))

        label_text = f"{i+1}"
        if width_ratios is not None and len(width_ratios) > i:
            val = float(np.clip(width_ratios[i], 0.0, 0.99)) * 100.0
            label_text = f"{val:.0f}%"
        elif scores is not None and len(scores) > i:
            label_text = f"{int(round(float(scores[i]) * 100)):02d}%"

        if top_mid is not None:
            vec = top_mid - center
            if np.linalg.norm(vec) < 1e-3:
                vec = tangent
            vec = vec / np.linalg.norm(vec)
            perp = np.array([-vec[1], vec[0]], dtype=np.float32)
            label_anchor = top_mid + vec * 8.0 + perp * 34.0
        else:
            perp = np.array([-tangent[1], tangent[0]], dtype=np.float32)
            if np.linalg.norm(perp) < 1e-3:
                perp = np.array([1.0, 0.0], dtype=np.float32)
            perp = perp / np.linalg.norm(perp)
            label_anchor = center + perp * 34.0

        anchor_x = int(np.clip(label_anchor[0], 0, w - 1))
        anchor_y = int(np.clip(label_anchor[1], 12, h - 1))
        cv2.putText(out, label_text, (anchor_x, anchor_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, yellow, 2, cv2.LINE_AA)

    # 4) Cobb text centered
    if len(pts_f) >= 3:
        cobb = cobb_from_points(pts_f)
        txt = f"Cobb: {cobb:.2f}"
        (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)
        cv2.putText(out, txt, ((w - tw)//2, h//2), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3, cv2.LINE_AA)

    return out

def draw_heatmap_overlay(img: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Create a smooth Gaussian heatmap overlay (BGR-safe) and draw spine curve + Cobb."""
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

    cobb = cobb_from_points(pts)
    txt = f"Cobb Angle: {cobb:.2f}"
    (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)
    cv2.putText(blended, txt, ((w - tw)//2, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3, cv2.LINE_AA)

    return blended
