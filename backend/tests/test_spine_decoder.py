import numpy as np

from core.spine_decoder import DecDecoder


def test_spine_chain_decoder_avoids_neighbor_duplicates():
    decoder = DecDecoder(
        K=18,
        conf_thresh=0.0,
        num_vertebrae=17,
        decode_mode="spine_chain",
        down_ratio=4,
        candidate_top_k=18,
        duplicate_radius_px=8.0,
    )

    raw_candidates = []
    for idx in range(17):
        raw_candidates.append(
            {
                "raw_rank": idx,
                "heat_index": idx,
                "x": 10.0,
                "y": float(idx * 4),
                "score": float(0.80 - idx * 0.01),
                "wh": np.zeros(8, dtype=np.float32),
            }
        )

    raw_candidates.insert(
        9,
        {
            "raw_rank": 99,
            "heat_index": 999,
            "x": 10.2,
            "y": 32.4,
            "score": 0.99,
            "wh": np.zeros(8, dtype=np.float32),
        },
    )

    selected_candidates, _ = decoder._select_candidates(raw_candidates)

    assert len(selected_candidates) == 17

    radius = decoder._to_heatmap_scale(decoder.duplicate_radius_px)
    radius_sq = radius * radius
    for idx, candidate in enumerate(selected_candidates):
        for other in selected_candidates[idx + 1 :]:
            dx = candidate["x"] - other["x"]
            dy = candidate["y"] - other["y"]
            assert dx * dx + dy * dy > radius_sq
