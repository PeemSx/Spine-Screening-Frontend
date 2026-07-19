export type PredictionDecoder = "kps" | "centernet" | "centernet_spine_chain";

export type VertebraPoint = [number, number];
export type VertebraBox = [number, number, number, number];

export interface LaDetection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: VertebraBox;
}

export interface ApPredictionResult {
  decoder: PredictionDecoder;
  cobb_angle: number;
  cobb_angles?: [number, number, number];
  cobb_display_angles?: number[];
  cobb_vertebra_pairs?: {
    label: string;
    vertebrae: [number, number];
    angle: number;
  }[];
  cobb_is_s_shape?: boolean;
  points: VertebraPoint[];
  boxes: VertebraBox[];
  scores?: number[];
  pred_image: string;
  heatmap_image?: string;
  abs_path?: string;
  error?: string;
}

export interface LaPredictionResult {
  avg_confidence: number;
  detections: LaDetection[];
  num_detections: number;
  pred_image: string;
  abs_path?: string;
  error?: string;
}

export type PredictionResult = ApPredictionResult | LaPredictionResult;
