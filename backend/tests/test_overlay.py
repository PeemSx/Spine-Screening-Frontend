import numpy as np

from core.utils_ap import draw_overlay


def test_cobb_panel_stays_inside_original_image_width():
    image = np.zeros((320, 220, 3), dtype=np.uint8)
    points = np.asarray(
        [
            [108.0, 48.0],
            [112.0, 104.0],
            [110.0, 160.0],
            [106.0, 216.0],
        ],
        dtype=np.float32,
    )
    boxes = np.asarray(
        [
            [96.0, 36.0, 120.0, 60.0],
            [100.0, 92.0, 124.0, 116.0],
            [98.0, 148.0, 122.0, 172.0],
            [94.0, 204.0, 118.0, 228.0],
        ],
        dtype=np.float32,
    )

    overlay = draw_overlay(image, points, boxes)

    assert overlay.shape == image.shape
