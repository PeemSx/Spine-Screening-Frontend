// frontend/lib/api.ts
import type { ApPredictionResult, LaPredictionResult, LaDetection } from "../schemas/prediction";

export type { ApPredictionResult, LaPredictionResult, LaDetection };

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const ensureLeadingSlash = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
};

/**
 * Upload an AP X-ray image and run prediction.
 * Returns a JSON with results and image URLs.
 */
export async function predictAPXray(file: File): Promise<ApPredictionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/predict/ap`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API request failed: ${msg}`);
  }

  const data = (await res.json()) as ApPredictionResult;

  // handle backend error field
  if (data.error) {
    throw new Error(data.error);
  }

  // normalize image paths
  data.pred_image = ensureLeadingSlash(data.pred_image) ?? "";
  if (data.heatmap_image) {
    data.heatmap_image = ensureLeadingSlash(data.heatmap_image);
  }

  return data;
}

/**
 * Upload a lateral (LA) X-ray image and run prediction.
 * Returns a JSON with detection overlay and summary statistics.
 */
export async function predictLAXray(file: File): Promise<LaPredictionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/predict/la`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API request failed: ${msg}`);
  }

  const data = (await res.json()) as LaPredictionResult;

  if (data.error) {
    throw new Error(data.error);
  }

  data.pred_image = ensureLeadingSlash(data.pred_image) ?? "";
  return data;
}
