# OVCF Web Application

Clinical demo platform for Osteoporotic Vertebral Compression Fracture (OVCF) analysis.
The repository hosts a FastAPI inference backend and a Next.js frontend that visualises
model predictions for AP and LA spine X‑rays.

## Project Layout

```
OVCF Web-App/
├── backend/   # FastAPI service, inference pipelines, tests, scripts
├── frontend/  # Next.js UI and client utilities
└── README.md
```

### Backend Highlights

- `app/` – FastAPI application factory, configuration, routes, dependencies, lifespan hooks.
- `core/` – Model loaders and inference helpers (`ap_infer.py`, `la_infer.py`, etc.).
- `models/` – Torch architectures required by the AP model.
- `weights/` – Expected location for `ap/hrnet_w18.pth` (AP) and `best_100.pt` (LA).
- `results/` – Generated imagery (`/results/ap` for AP overlays, `/results/la` for LA outputs).
- `scripts/clear_results.py` – Utility to purge generated results while keeping folder structure.
- `tests/` – Pytest API contracts with fixtures that stub Heavyweight models.

### Frontend Highlights

- `app/` – Next.js App Router pages (`/ap`, `/la`) for running each inference workflow.
- `lib/` – API helpers (`lib/api.ts`) and re‑usable client utilities.
- `schemas/` – Shared TypeScript types for backend responses.
- `components/` – UI building blocks such as `ResultImageCard`.

## Prerequisites

- Python 3.12 (recommended) with `virtualenv` or similar.
- Node.js 18+ (for Next.js) and npm or yarn/pnpm.
- Model weight files placed under `backend/weights/` (or override via env vars).

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` (or export variables) if you need to override defaults in `app/config.py`:

```
BACKEND_MODEL_WEIGHTS=weights/ap/hrnet_w18.pth
BACKEND_LA_MODEL_WEIGHTS=weights/best_100.pt
BACKEND_RESULTS_DIR=results
BACKEND_LA_RESULTS_DIR=results/la
BACKEND_LOG_LEVEL=INFO
```

Run the API locally:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Tests (stubs prevent heavyweight loads):

```bash
pytest
```

Clear generated overlays when needed:

```bash
python scripts/clear_results.py
```

## Frontend Setup

```bash
cd frontend
npm install
```

Expose the backend URL for client calls by creating `.env.local`:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Run the development server:

```bash
npm run dev
```

The AP page expects `/predict/ap`, while the LA page targets `/predict/la`. Uploaded images,
averaged confidences, and generated overlays are rendered directly from the backend.

## Deployment Notes

- Serve the backend with a process manager (e.g., `gunicorn -k uvicorn.workers.UvicornWorker`) behind an HTTPS reverse proxy.
- Ensure `results/` and `results/la/` are writable by the API process and mounted for the frontend to access (`/results` static mount).
- Install system dependencies for OpenCV/Torch if deploying on minimal OS images.
- Harden CORS (`BACKEND_ALLOW_ORIGINS`) when exposing the service publicly.

## Maintenance

- Periodically prune `results/` directories using the cleanup script or scheduled jobs.
- Monitor model loading logs to confirm weight paths are correct at startup.
- Keep `requirements.txt` aligned with the frontend `package.json` to avoid mismatched API contracts.

For further details, inspect the module-level docstrings in `app/` and `core/`, or browse the
frontend page components for UI wiring examples.
