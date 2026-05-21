import copy

import numpy as np
import torch
import torch.nn.functional as F


class DecDecoder(object):
    @classmethod
    def from_args(cls, args):
        candidate_top_k = getattr(args, "decode_candidate_top_k", 0)
        if candidate_top_k is None or candidate_top_k <= 0:
            candidate_top_k = getattr(args, "K", 17)

        return cls(
            K=getattr(args, "K", candidate_top_k),
            conf_thresh=getattr(args, "conf_thresh", 0.0),
            num_vertebrae=getattr(args, "num_vertebrae", 17),
            decode_mode=getattr(args, "decode_mode", "spine_chain"),
            down_ratio=getattr(args, "down_ratio", 4),
            candidate_top_k=candidate_top_k,
            duplicate_radius_px=getattr(args, "duplicate_radius_px", 18.0),
            min_dy_px=getattr(args, "min_dy_px", 0.0),
            max_dy_px=getattr(args, "max_dy_px", 0.0),
            score_weight=getattr(args, "decode_score_weight", 1.0),
            spacing_weight=getattr(args, "decode_spacing_weight", 0.35),
            smoothness_weight=getattr(args, "decode_smoothness_weight", 0.10),
            curvature_weight=getattr(args, "decode_curvature_weight", 0.25),
            relaxed_min_dy_scale=getattr(args, "relaxed_min_dy_scale", 0.60),
            relaxed_max_dy_scale=getattr(args, "relaxed_max_dy_scale", 1.60),
        )

    def __init__(
        self,
        K,
        conf_thresh,
        num_vertebrae=17,
        decode_mode="spine_chain",
        down_ratio=4,
        candidate_top_k=None,
        duplicate_radius_px=18.0,
        min_dy_px=0.0,
        max_dy_px=0.0,
        score_weight=1.0,
        spacing_weight=0.35,
        smoothness_weight=0.10,
        curvature_weight=0.25,
        relaxed_min_dy_scale=0.60,
        relaxed_max_dy_scale=1.60,
    ):
        self.num_vertebrae = int(num_vertebrae)
        self.candidate_top_k = max(int(K if candidate_top_k is None else candidate_top_k), self.num_vertebrae)
        self.conf_thresh = float(conf_thresh)
        self.decode_mode = decode_mode
        self.down_ratio = max(int(down_ratio), 1)
        self.duplicate_radius_px = float(duplicate_radius_px)
        self.min_dy_px = float(min_dy_px)
        self.max_dy_px = float(max_dy_px)
        self.score_weight = float(score_weight)
        self.spacing_weight = float(spacing_weight)
        self.smoothness_weight = float(smoothness_weight)
        self.curvature_weight = float(curvature_weight)
        self.relaxed_min_dy_scale = float(relaxed_min_dy_scale)
        self.relaxed_max_dy_scale = float(relaxed_max_dy_scale)
        self.last_debug_info = {}

        valid_modes = {"score_topk", "legacy_topk", "spine_chain"}
        if self.decode_mode not in valid_modes:
            raise ValueError("Unsupported decode_mode: {}".format(self.decode_mode))

    def _topk(self, scores, K=None):
        K = self.candidate_top_k if K is None else K
        batch, cat, height, width = scores.size()
        K = min(K, height * width)

        topk_scores, topk_inds = torch.topk(scores.view(batch, cat, -1), K)
        topk_inds = topk_inds % (height * width)
        topk_ys = (topk_inds / width).int().float()
        topk_xs = (topk_inds % width).int().float()

        topk_score, topk_ind = torch.topk(topk_scores.view(batch, -1), K)
        topk_inds = self._gather_feat(topk_inds.view(batch, -1, 1), topk_ind).view(batch, K)
        topk_ys = self._gather_feat(topk_ys.view(batch, -1, 1), topk_ind).view(batch, K)
        topk_xs = self._gather_feat(topk_xs.view(batch, -1, 1), topk_ind).view(batch, K)

        return topk_score, topk_inds, topk_ys, topk_xs

    def _nms(self, heat, kernel=3):
        hmax = F.max_pool2d(heat, (kernel, kernel), stride=1, padding=(kernel - 1) // 2)
        keep = (hmax == heat).float()
        return heat * keep

    def _gather_feat(self, feat, ind, mask=None):
        dim = feat.size(2)
        ind = ind.unsqueeze(2).expand(ind.size(0), ind.size(1), dim)
        feat = feat.gather(1, ind)
        if mask is not None:
            mask = mask.unsqueeze(2).expand_as(feat)
            feat = feat[mask]
            feat = feat.view(-1, dim)
        return feat

    def _tranpose_and_gather_feat(self, feat, ind):
        feat = feat.permute(0, 2, 3, 1).contiguous()
        feat = feat.view(feat.size(0), -1, feat.size(3))
        feat = self._gather_feat(feat, ind)
        return feat

    def _to_heatmap_scale(self, value_px):
        if value_px <= 0:
            return 0.0
        return float(value_px) / float(self.down_ratio)

    def _extract_candidates_single(self, heat, wh, reg, K=None):
        if heat.size(0) != 1:
            raise ValueError("DecDecoder expects batch size 1 during decoding, got {}".format(heat.size(0)))

        K = self.candidate_top_k if K is None else K
        heat = self._nms(heat)
        scores, inds, ys, xs = self._topk(heat, K=K)
        scores = scores.view(heat.size(0), K, 1)
        xs = xs.view(heat.size(0), K, 1)
        ys = ys.view(heat.size(0), K, 1)

        if reg is not None:
            reg = self._tranpose_and_gather_feat(reg, inds)
            reg = reg.view(heat.size(0), K, 2)
            xs = xs + reg[:, :, 0:1]
            ys = ys + reg[:, :, 1:2]

        if wh is not None:
            wh = self._tranpose_and_gather_feat(wh, inds)
            wh = wh.view(heat.size(0), K, 8)

        xs_np = xs[0, :, 0].detach().cpu().numpy().astype(np.float32)
        ys_np = ys[0, :, 0].detach().cpu().numpy().astype(np.float32)
        scores_np = scores[0, :, 0].detach().cpu().numpy().astype(np.float32)
        inds_np = inds[0].detach().cpu().numpy().astype(np.int64)
        wh_np = None
        if wh is not None:
            wh_np = wh[0].detach().cpu().numpy().astype(np.float32)

        candidates = []
        for idx in range(K):
            candidates.append(
                {
                    "raw_rank": idx,
                    "heat_index": int(inds_np[idx]),
                    "x": float(xs_np[idx]),
                    "y": float(ys_np[idx]),
                    "score": float(scores_np[idx]),
                    "wh": np.zeros(8, dtype=np.float32) if wh_np is None else wh_np[idx].copy(),
                }
            )
        return candidates

    def _candidate_array(self, candidates):
        if not candidates:
            return np.zeros((0, 3), dtype=np.float32)
        return np.asarray([[cand["x"], cand["y"], cand["score"]] for cand in candidates], dtype=np.float32)

    def _candidate_indices(self, candidates):
        if not candidates:
            return np.zeros((0,), dtype=np.int32)
        return np.asarray([cand["heat_index"] for cand in candidates], dtype=np.int32)

    def _decode_candidates(self, candidates):
        if not candidates:
            return np.zeros((0, 11), dtype=np.float32)

        xs = np.asarray([cand["x"] for cand in candidates], dtype=np.float32).reshape(-1, 1)
        ys = np.asarray([cand["y"] for cand in candidates], dtype=np.float32).reshape(-1, 1)
        scores = np.asarray([cand["score"] for cand in candidates], dtype=np.float32).reshape(-1, 1)
        wh = np.asarray([cand["wh"] for cand in candidates], dtype=np.float32)

        tl_x = xs - wh[:, 0:1]
        tl_y = ys - wh[:, 1:2]
        tr_x = xs - wh[:, 2:3]
        tr_y = ys - wh[:, 3:4]
        bl_x = xs - wh[:, 4:5]
        bl_y = ys - wh[:, 5:6]
        br_x = xs - wh[:, 6:7]
        br_y = ys - wh[:, 7:8]

        return np.concatenate(
            [xs, ys, tl_x, tl_y, tr_x, tr_y, bl_x, bl_y, br_x, br_y, scores],
            axis=1,
        ).astype(np.float32)

    def _filter_candidates_by_confidence(self, candidates):
        if self.conf_thresh <= 0:
            return list(candidates), False

        confident = [cand for cand in candidates if cand["score"] >= self.conf_thresh]
        if len(confident) >= self.num_vertebrae:
            return confident, True
        return list(candidates), False

    def _suppress_duplicates(self, candidates):
        radius = self._to_heatmap_scale(self.duplicate_radius_px)
        if radius <= 0 or len(candidates) <= 1:
            return list(candidates)

        radius_sq = radius * radius
        selected = []
        for cand in sorted(candidates, key=lambda item: (-item["score"], item["y"], item["x"])):
            keep = True
            for prev in selected:
                dx = cand["x"] - prev["x"]
                dy = cand["y"] - prev["y"]
                if dx * dx + dy * dy <= radius_sq:
                    keep = False
                    break
            if keep:
                selected.append(cand)
        return selected

    def _squared_distance(self, cand_a, cand_b):
        dx = cand_a["x"] - cand_b["x"]
        dy = cand_a["y"] - cand_b["y"]
        return dx * dx + dy * dy

    def _merge_candidate_sources(self, *candidate_groups):
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

    def _enforce_non_overlapping_selection(self, seed_candidates, supplemental_candidates):
        radius = self._to_heatmap_scale(self.duplicate_radius_px)
        radius_sq = radius * radius
        selected = []
        seen_heat_indices = set()
        selection_modified = False

        def try_add(candidate):
            heat_index = int(candidate["heat_index"])
            if heat_index in seen_heat_indices:
                return False
            if radius > 0:
                for prev in selected:
                    if self._squared_distance(candidate, prev) <= radius_sq:
                        return False
            selected.append(candidate)
            seen_heat_indices.add(heat_index)
            return True

        ordered_seed = sorted(seed_candidates, key=lambda item: (-item["score"], item["y"], item["x"]))
        for cand in ordered_seed:
            if not try_add(cand):
                selection_modified = True
            if len(selected) == self.num_vertebrae:
                break

        for cand in supplemental_candidates:
            if len(selected) == self.num_vertebrae:
                break
            if try_add(cand):
                selection_modified = True

        if len(selected) < self.num_vertebrae:
            return None, selection_modified
        return sorted(selected, key=lambda item: (item["y"], item["x"])), selection_modified

    def _estimate_spacing_prior(self, candidates):
        if len(candidates) < 2:
            return 1.0, 0.0, float("inf")

        ys = np.asarray([cand["y"] for cand in candidates], dtype=np.float32)
        full_span = float(max(ys[-1] - ys[0], 1.0))
        lower = float(np.percentile(ys, 5.0))
        upper = float(np.percentile(ys, 95.0))
        trimmed_span = max(upper - lower, 1.0)
        target_dy = max(0.5 * (full_span + trimmed_span) / max(self.num_vertebrae - 1, 1), 1.0)

        min_dy = self._to_heatmap_scale(self.min_dy_px)
        max_dy = self._to_heatmap_scale(self.max_dy_px)
        if min_dy <= 0:
            min_dy = 0.45 * target_dy
        if max_dy <= 0:
            max_dy = 1.90 * target_dy
        if max_dy <= min_dy:
            max_dy = min_dy + max(0.5 * target_dy, 1.0)

        return float(target_dy), float(min_dy), float(max_dy)

    def _pair_penalty(self, prev_cand, curr_cand, target_dy, min_dy, max_dy):
        dy = curr_cand["y"] - prev_cand["y"]
        if dy <= 0 or dy < min_dy or dy > max_dy:
            return None

        dx = curr_cand["x"] - prev_cand["x"]
        dy_norm = dy / max(target_dy, 1e-6)
        dx_norm = dx / max(target_dy, 1e-6)
        spacing_penalty = (dy_norm - 1.0) ** 2
        smoothness_penalty = dx_norm**2
        return self.spacing_weight * spacing_penalty + self.smoothness_weight * smoothness_penalty

    def _triple_penalty(self, prev_prev_cand, prev_cand, curr_cand, target_dy):
        prev_dy = prev_cand["y"] - prev_prev_cand["y"]
        curr_dy = curr_cand["y"] - prev_cand["y"]
        spacing_change = (curr_dy - prev_dy) / max(target_dy, 1e-6)
        curvature = (
            curr_cand["x"] - 2.0 * prev_cand["x"] + prev_prev_cand["x"]
        ) / max(target_dy, 1e-6)
        return 0.5 * self.spacing_weight * (spacing_change**2) + self.curvature_weight * abs(curvature)

    def _select_topk_fallback(self, candidates, method_name):
        if len(candidates) < self.num_vertebrae:
            return None, method_name

        selected = sorted(candidates, key=lambda item: (-item["score"], item["y"], item["x"]))[: self.num_vertebrae]
        selected = sorted(selected, key=lambda item: (item["y"], item["x"]))
        return selected, method_name

    def _select_legacy_topk(self, raw_candidates):
        selected_candidates, selection_method = self._select_topk_fallback(raw_candidates, "legacy_topk")
        if selected_candidates is None:
            raise RuntimeError(
                "Legacy decoder could not produce {} candidates from a raw pool of {}".format(
                    self.num_vertebrae, len(raw_candidates)
                )
            )

        debug = {
            "decode_mode": self.decode_mode,
            "candidate_top_k": int(self.candidate_top_k),
            "num_vertebrae": int(self.num_vertebrae),
            "confidence_threshold": float(self.conf_thresh),
            "confidence_filter_used": False,
            "duplicate_radius": 0.0,
            "raw_candidates": self._candidate_array(raw_candidates),
            "raw_candidate_indices": self._candidate_indices(raw_candidates),
            "filtered_candidates": self._candidate_array(raw_candidates),
            "filtered_candidate_indices": self._candidate_indices(raw_candidates),
            "suppressed_candidates": self._candidate_array(raw_candidates),
            "suppressed_candidate_indices": self._candidate_indices(raw_candidates),
            "selected_candidates": self._candidate_array(selected_candidates),
            "selected_candidate_indices": self._candidate_indices(selected_candidates),
            "selection_method": selection_method,
            "target_dy": None,
            "min_dy": None,
            "max_dy": None,
            "constraints_relaxed": False,
        }
        return selected_candidates, debug

    def _select_best_chain(self, candidates, relax_constraints=False):
        if len(candidates) < self.num_vertebrae:
            return None, {
                "target_dy": None,
                "min_dy": None,
                "max_dy": None,
                "constraints_relaxed": relax_constraints,
            }

        ordered = sorted(candidates, key=lambda item: (item["y"], item["x"]))
        target_dy, min_dy, max_dy = self._estimate_spacing_prior(ordered)
        if relax_constraints:
            min_dy *= self.relaxed_min_dy_scale
            max_dy *= self.relaxed_max_dy_scale

        target_len = self.num_vertebrae
        num_candidates = len(ordered)
        inf = np.inf
        point_cost = np.asarray([-self.score_weight * cand["score"] for cand in ordered], dtype=np.float64)
        dp = np.full((target_len + 1, num_candidates, num_candidates), inf, dtype=np.float64)
        parent = np.full((target_len + 1, num_candidates, num_candidates), -1, dtype=np.int32)

        for prev_idx in range(num_candidates - 1):
            for curr_idx in range(prev_idx + 1, num_candidates):
                pair_penalty = self._pair_penalty(ordered[prev_idx], ordered[curr_idx], target_dy, min_dy, max_dy)
                if pair_penalty is None:
                    continue
                dp[2, prev_idx, curr_idx] = point_cost[prev_idx] + point_cost[curr_idx] + pair_penalty

        for length in range(3, target_len + 1):
            min_prev_idx = length - 2
            for prev_idx in range(min_prev_idx, num_candidates - 1):
                for curr_idx in range(prev_idx + 1, num_candidates):
                    pair_penalty = self._pair_penalty(
                        ordered[prev_idx], ordered[curr_idx], target_dy, min_dy, max_dy
                    )
                    if pair_penalty is None:
                        continue

                    best_cost = inf
                    best_prev_prev_idx = -1
                    for prev_prev_idx in range(prev_idx):
                        previous_cost = dp[length - 1, prev_prev_idx, prev_idx]
                        if not np.isfinite(previous_cost):
                            continue
                        triple_penalty = self._triple_penalty(
                            ordered[prev_prev_idx], ordered[prev_idx], ordered[curr_idx], target_dy
                        )
                        current_cost = previous_cost + point_cost[curr_idx] + pair_penalty + triple_penalty
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

        debug = {
            "target_dy": float(target_dy),
            "min_dy": float(min_dy),
            "max_dy": float(max_dy),
            "constraints_relaxed": relax_constraints,
        }
        if best_prev_idx == -1:
            return None, debug

        chain_indices = [best_curr_idx, best_prev_idx]
        curr_length = target_len
        curr_prev_idx = best_prev_idx
        curr_curr_idx = best_curr_idx
        while curr_length > 2:
            prev_prev_idx = parent[curr_length, curr_prev_idx, curr_curr_idx]
            if prev_prev_idx < 0:
                return None, debug
            chain_indices.append(int(prev_prev_idx))
            curr_curr_idx = curr_prev_idx
            curr_prev_idx = int(prev_prev_idx)
            curr_length -= 1

        chain_indices.reverse()
        return [ordered[idx] for idx in chain_indices], debug

    def _select_candidates(self, raw_candidates):
        if self.decode_mode in {"score_topk", "legacy_topk"}:
            return self._select_legacy_topk(raw_candidates)

        filtered_candidates, confidence_filter_used = self._filter_candidates_by_confidence(raw_candidates)
        suppressed_candidates = self._suppress_duplicates(filtered_candidates)

        selected_candidates = None
        selection_method = "raw_topk"
        chain_debug = {
            "target_dy": None,
            "min_dy": None,
            "max_dy": None,
            "constraints_relaxed": False,
        }

        if self.decode_mode == "spine_chain":
            selected_candidates, chain_debug = self._select_best_chain(suppressed_candidates, relax_constraints=False)
            selection_method = "spine_chain"

            if selected_candidates is None:
                selected_candidates, chain_debug = self._select_best_chain(suppressed_candidates, relax_constraints=True)
                selection_method = "spine_chain_relaxed"

            if selected_candidates is None and len(filtered_candidates) >= self.num_vertebrae:
                selected_candidates, chain_debug = self._select_best_chain(filtered_candidates, relax_constraints=True)
                selection_method = "spine_chain_relaxed_unsuppressed"

            if selected_candidates is None:
                selected_candidates, selection_method = self._select_topk_fallback(
                    suppressed_candidates, "suppressed_score_topk"
                )

            if selected_candidates is None:
                selected_candidates, selection_method = self._select_topk_fallback(
                    filtered_candidates, "filtered_score_topk"
                )
        else:
            selected_candidates, selection_method = self._select_topk_fallback(
                suppressed_candidates, "suppressed_score_topk"
            )
            if selected_candidates is None:
                selected_candidates, selection_method = self._select_topk_fallback(
                    filtered_candidates, "filtered_score_topk"
                )

        if selected_candidates is None:
            selected_candidates, selection_method = self._select_topk_fallback(raw_candidates, "raw_score_topk")

        if selected_candidates is None:
            raise RuntimeError(
                "Decoder could not produce {} candidates from a raw pool of {}".format(
                    self.num_vertebrae, len(raw_candidates)
                )
            )

        supplemental_candidates = self._merge_candidate_sources(
            suppressed_candidates,
            filtered_candidates,
            raw_candidates,
        )
        enforced_selection, selection_modified = self._enforce_non_overlapping_selection(
            selected_candidates, supplemental_candidates
        )
        if enforced_selection is not None:
            selected_candidates = enforced_selection
            if selection_modified:
                selection_method = "{}_nonoverlap".format(selection_method)
        else:
            selected_candidates = sorted(selected_candidates, key=lambda item: (item["y"], item["x"]))

        debug = {
            "decode_mode": self.decode_mode,
            "candidate_top_k": int(self.candidate_top_k),
            "num_vertebrae": int(self.num_vertebrae),
            "confidence_threshold": float(self.conf_thresh),
            "confidence_filter_used": bool(confidence_filter_used),
            "duplicate_radius": float(self._to_heatmap_scale(self.duplicate_radius_px)),
            "raw_candidates": self._candidate_array(raw_candidates),
            "raw_candidate_indices": self._candidate_indices(raw_candidates),
            "filtered_candidates": self._candidate_array(filtered_candidates),
            "filtered_candidate_indices": self._candidate_indices(filtered_candidates),
            "suppressed_candidates": self._candidate_array(suppressed_candidates),
            "suppressed_candidate_indices": self._candidate_indices(suppressed_candidates),
            "selected_candidates": self._candidate_array(selected_candidates),
            "selected_candidate_indices": self._candidate_indices(selected_candidates),
            "selection_method": selection_method,
            "target_dy": chain_debug["target_dy"],
            "min_dy": chain_debug["min_dy"],
            "max_dy": chain_debug["max_dy"],
            "constraints_relaxed": bool(chain_debug["constraints_relaxed"]),
        }
        return selected_candidates, debug

    def extract_peaks(self, heat, reg=None, K=None):
        K = self.candidate_top_k if K is None else K
        heat = self._nms(heat)
        scores, inds, ys, xs = self._topk(heat, K=K)

        xs = xs.view(heat.size(0), K, 1)
        ys = ys.view(heat.size(0), K, 1)
        scores = scores.view(heat.size(0), K, 1)

        if reg is not None:
            reg = self._tranpose_and_gather_feat(reg, inds)
            reg = reg.view(heat.size(0), K, 2)
            xs = xs + reg[:, :, 0:1]
            ys = ys + reg[:, :, 1:2]

        peaks = torch.cat([xs, ys, scores], dim=2)
        return peaks.detach().cpu().numpy()

    def ctdet_decode(self, heat, wh, reg):
        raw_candidates = self._extract_candidates_single(heat, wh, reg, K=self.candidate_top_k)
        selected_candidates, debug = self._select_candidates(raw_candidates)
        self.last_debug_info = debug
        return self._decode_candidates(selected_candidates)

    def get_last_debug_info(self):
        return copy.deepcopy(self.last_debug_info)
