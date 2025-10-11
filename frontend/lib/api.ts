// frontend/lib/api.ts
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type PredictionResult = {
  decoder: "kps" | "centernet";
  cobb_angle: number;
  points: [number, number][];
  boxes: [number, number, number, number][];
  scores?: number[];
  pred_image: string;         // e.g. "/results/xxxx_ap_pred.jpg"
  heatmap_image?: string;     // optional if backend provides
  abs_path?: string;          // for debug
  error?: string;
};

/**
 * Upload an AP X-ray image and run prediction.
 * Returns a JSON with results and image URLs.
 */
export async function predictAPXray(file: File): Promise<PredictionResult> {
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

  const data = (await res.json()) as PredictionResult;

  // handle backend error field
  if (data.error) {
    throw new Error(data.error);
  }

  // normalize image paths
  if (data.pred_image && !data.pred_image.startsWith("/")) {
    data.pred_image = "/" + data.pred_image;
  }
  if (data.heatmap_image && !data.heatmap_image.startsWith("/")) {
    data.heatmap_image = "/" + data.heatmap_image;
  }

  return data;
}