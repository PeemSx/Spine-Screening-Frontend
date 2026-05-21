import numpy as np
import torch

from core import utils_ap


def test_decode_centernet_8corners_scales_centers_once(monkeypatch):
    class StubDecoder:
        def __init__(self, **_kwargs):
            pass

        def ctdet_decode(self, _hm, _wh, _reg):
            # center_x, center_y, tl, tr, bl, br, score in heatmap space
            return np.array(
                [[10.0, 20.0, 9.0, 19.0, 11.0, 19.0, 9.0, 21.0, 11.0, 21.0, 0.9]],
                dtype=np.float32,
            )

    monkeypatch.setattr(utils_ap, "DecDecoder", StubDecoder)

    hm = torch.zeros((1, 1, 8, 8), dtype=torch.float32)
    reg = torch.zeros((1, 2, 8, 8), dtype=torch.float32)
    wh = torch.zeros((1, 8, 8, 8), dtype=torch.float32)

    pts_inp, boxes_inp, scores, corners_inp = utils_ap.decode_centernet_8corners(
        hm=hm,
        reg=reg,
        wh=wh,
        top_k_num=1,
        down_ratio=4,
        conf_thresh=0.0,
        candidate_top_k=1,
    )

    np.testing.assert_allclose(pts_inp, np.array([[40.0, 80.0]], dtype=np.float32))
    np.testing.assert_allclose(
        corners_inp,
        np.array([[[36.0, 76.0], [44.0, 76.0], [36.0, 84.0], [44.0, 84.0]]], dtype=np.float32),
    )
    np.testing.assert_allclose(boxes_inp, np.array([[36.0, 76.0, 44.0, 84.0]], dtype=np.float32))
    np.testing.assert_allclose(scores, np.array([0.9], dtype=np.float32))
