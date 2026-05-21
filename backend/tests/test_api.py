import cv2
import numpy as np


def test_health_endpoint(client):
    response = client.get("/ap")
    assert response.status_code == 200
    assert response.json()["message"] == "OVCF AP API is running."


def test_predict_ap_rejects_invalid_image(client):
    response = client.post(
        "/predict/ap",
        files={"file": ("bad.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is not a valid image."


def test_predict_ap_returns_stubbed_prediction(client):
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok

    response = client.post(
        "/predict/ap",
        files={"file": ("sample.jpg", encoded.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["decoder"] == "stub"
    assert payload["pred_image"] == "/results/ap/stub.jpg"


def test_predict_la_rejects_invalid_image(client):
    response = client.post(
        "/predict/la",
        files={"file": ("bad.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is not a valid image."


def test_predict_la_returns_stubbed_prediction(client):
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok

    response = client.post(
        "/predict/la",
        files={"file": ("sample.jpg", encoded.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["avg_confidence"] == 0.5
    assert payload["pred_image"].endswith("la/stub_la.jpg")
    assert payload["num_detections"] == 0
