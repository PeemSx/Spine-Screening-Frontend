# OVCF Backend

The backend is a FastAPI service that exposes inference endpoints for the OVCF web application. It loads an HRNet-based AP model plus a YOLO-based LA model and returns overlay images together with measurement metadata for uploaded spine X-rays.

## Quick Start

1. **Python environment** - use Python 3.11 and create a virtual environment (recommended via `py -3.11 -m venv .venv` on Windows).
2. **Install dependencies** - `python -m pip install --upgrade pip setuptools wheel` and then `python -m pip install -r requirements.txt`.
3. **Model weights** - place the AP checkpoint at `weights/ap/hrnet_w18.pth` and the LA checkpoint at `weights/best_100.pt`, or override the environment variables below.
4. **Run the server** - prefer `python main.py` for local development. It uses a project-scoped `watchfiles` runner instead of `uvicorn --reload`, so `.venv/` is not watched and does not cause phantom reload noise.

The API will be available at `http://localhost:8000/` and serves static result images from `/results/<filename>`.

If you want to keep using `uvicorn` directly, use explicit reload scopes instead of watching the whole backend directory. This is less robust than `python main.py` because `uvicorn`'s reloader behavior is broader than a custom `watchfiles` runner.

```bash
python -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-dir app \
  --reload-dir core \
  --reload-dir models \
  --reload-dir tests \
  --reload-exclude .venv \
  --reload-exclude results
```

## Configuration

Settings are read from environment variables (optionally via `.env.local`). All paths are resolved relative to `backend/` when given as relative paths.

| Variable | Description | Default |
| --- | --- | --- |
| `BACKEND_ALLOW_ORIGINS` | Comma-separated list of allowed CORS origins. | `http://localhost:3000` |
| `BACKEND_MODEL_WEIGHTS` | Path to the HRNet AP checkpoint. | `weights/ap/hrnet_w18.pth` |
| `BACKEND_LA_MODEL_WEIGHTS` | Path to the LA YOLO checkpoint. | `weights/best_100.pt` |
| `BACKEND_RESULTS_DIR` | Folder where inference artefacts are stored. | `results` |
| `BACKEND_LA_RESULTS_DIR` | Folder where LA inference artefacts are stored. | `results/la` |
| `BACKEND_MAX_SAVED_RESULTS` | Number of recent AP/LA outputs kept on disk. | `5` |
| `BACKEND_LOG_LEVEL` | Python logging level. | `INFO` |

## Testing

The test suite uses `pytest` and the FastAPI TestClient. Run `pytest` from the `backend/` directory after installing the runtime requirements.

```bash
pytest
```

The tests monkeypatch the model loader so no heavy weights are required.

## Project Structure

```text
backend/
  app/            # FastAPI application factory, routing, configuration
  core/           # Inference utilities and model glue code
  models/         # HRNet AP backbone/decoder definitions
  results/        # Generated overlay/heatmap images (gitignored)
  tests/          # Backend unit/integration tests
```

Refer to `CONTRIBUTING.md` for coding standards, tooling expectations, and suggested workflows.
