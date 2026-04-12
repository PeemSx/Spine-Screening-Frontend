# OVCF Backend

The backend is a FastAPI service that exposes inference endpoints for the OVCF web application. It wraps a pretrained SpineNet model and produces overlay images plus Cobb angle measurements for AP X-ray uploads.

## Quick Start

1. **Python environment** - use Python 3.11 and create a virtual environment (recommended via `py -3.11 -m venv .venv` on Windows).
2. **Install dependencies** - `python -m pip install --upgrade pip setuptools wheel` and then `python -m pip install -r requirements.txt`.
3. **Model weights** - place the `model_50.pth` checkpoint under `weights/` or update the `BACKEND_MODEL_WEIGHTS` env var.
4. **Run the server** - `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.

The API will be available at `http://localhost:8000/` and serves static result images from `/results/<filename>`.

## Configuration

Settings are read from environment variables (optionally via `.env.local`). All paths are resolved relative to `backend/` when given as relative paths.

| Variable | Description | Default |
| --- | --- | --- |
| `BACKEND_ALLOW_ORIGINS` | Comma-separated list of allowed CORS origins. | `http://localhost:3000` |
| `BACKEND_MODEL_WEIGHTS` | Path to the SpineNet checkpoint. | `weights/model_50.pth` |
| `BACKEND_RESULTS_DIR` | Folder where inference artefacts are stored. | `results` |
| `BACKEND_LOG_LEVEL` | Python logging level. | `INFO` |

## Testing

The test suite uses `pytest` and the FastAPI TestClient. Run `pytest` from the `backend/` directory.

```bash
pip install -r requirements-dev.txt
pytest
```

The tests monkeypatch the model loader so no heavy weights are required.

## Project Structure

```text
backend/
  app/            # FastAPI application factory, routing, configuration
  core/           # Inference utilities and model glue code
  models/         # SpineNet architecture definition
  results/        # Generated overlay/heatmap images (gitignored)
  tests/          # Backend unit/integration tests
```

Refer to `CONTRIBUTING.md` for coding standards, tooling expectations, and suggested workflows.
