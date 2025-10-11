from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import cv2, numpy as np, os

from core.model_infer import load_model, run_inference

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==== Static files: /results ====
BASE_DIR = Path(__file__).resolve().parent            # .../backend
RESULTS_DIR = (BASE_DIR / "results")
RESULTS_DIR.mkdir(exist_ok=True, parents=True)
app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")
# =================================

MODEL = load_model(str(BASE_DIR / "weights_spinal" / "model_50.pth"))

@app.get("/")
async def root():
    return {"message": "OVCF AP API is running."}

@app.post("/predict/ap")
async def predict_ap(file: UploadFile = File(...)):
    buf = await file.read()
    img = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
    res = run_inference(MODEL, img, results_dir=str(RESULTS_DIR))
    return JSONResponse(res)