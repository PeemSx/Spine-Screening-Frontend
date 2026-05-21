import numpy as np

from core.ap_infer import prepare_ap_input_tensor


def test_prepare_ap_input_tensor_matches_training_preprocessing():
    bgr_img = np.array([[[0, 128, 255]]], dtype=np.uint8)

    tensor = prepare_ap_input_tensor(bgr_img).numpy()

    assert tensor.shape == (1, 3, 1024, 512)
    np.testing.assert_allclose(
        tensor[0, :, 0, 0],
        np.array([0.0, 128.0, 255.0], dtype=np.float32) / 255.0 - 0.5,
        rtol=1e-6,
        atol=1e-6,
    )
