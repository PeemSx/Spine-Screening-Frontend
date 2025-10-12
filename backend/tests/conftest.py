from typing import Iterator

import cv2
import pytest
from fastapi.testclient import TestClient

from app import create_app


@pytest.fixture(name="client")
def client_fixture(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Iterator[TestClient]:
    class DummyAPModel:
        pass

    class DummyLAModel:
        pass

    def fake_load_model(_):
        return DummyAPModel()

    def fake_load_la_model(_):
        return DummyLAModel()

    def fake_run_inference(_model, image, results_dir):
        cv2.imwrite(str(results_dir / "stub.jpg"), image)
        return {"decoder": "stub", "pred_image": "/results/stub.jpg"}

    def fake_run_la_inference(_model, image, results_dir):
        results_dir.mkdir(parents=True, exist_ok=True)
        overlay_path = results_dir / "stub_la.jpg"
        cv2.imwrite(str(overlay_path), image)
        return {
            "avg_confidence": 0.5,
            "detections": [],
            "overlay_path": overlay_path,
        }

    monkeypatch.setattr("core.model_infer.load_model", fake_load_model)
    monkeypatch.setattr("core.model_infer.run_inference", fake_run_inference)
    monkeypatch.setattr("core.la_infer.load_la_model", fake_load_la_model)
    monkeypatch.setattr("core.la_infer.run_la_inference", fake_run_la_inference)
    monkeypatch.setenv("BACKEND_RESULTS_DIR", str(tmp_path))
    monkeypatch.setenv("BACKEND_LA_RESULTS_DIR", str(tmp_path / "la"))

    app = create_app()

    with TestClient(app) as client:
        yield client
