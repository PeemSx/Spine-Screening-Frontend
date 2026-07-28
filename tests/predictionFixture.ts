import type {
  PredictionResponse,
  VertebraPrediction,
} from "@/features/screening/api/generated";
import type { PredictionQueueItem } from "@/features/screening/bulk/types";

function vertebra(candidateId: number): VertebraPrediction {
  return {
    candidate_id: candidateId,
    rank: 1,
    detector_score: 0.8,
    center: { x: 50, y: 50 },
    corners: {
      top_left: { x: 40, y: 40 },
      top_right: { x: 60, y: 40 },
      bottom_left: { x: 40, y: 60 },
      bottom_right: { x: 60, y: 60 },
    },
  };
}

export function predictionFixture(
  predictionId: string,
  candidateId = 1,
): PredictionResponse {
  const selectedVertebra = vertebra(candidateId);
  return {
    prediction_id: predictionId,
    model: {
      model_id: "test-model",
      artifact_type: "torchscript",
      format_version: 1,
      backbone: "test",
      input_size: 512,
      down_ratio: 4,
      peak_threshold: 0.1,
      topk: 20,
      sha256: "test",
      corner_order: ["TL", "TR", "BL", "BR"],
      spine_chain: {
        duplicate_iou_threshold: 0.5,
        duplicate_center_scale: 0.5,
        score_threshold: 0.1,
        score_weight: 1,
        min_chain_len: 1,
      },
    },
    image: {
      width: 100,
      height: 100,
      media_type: "image/png",
    },
    coordinate_space: "original_image_pixels",
    coordinate_origin: "top_left",
    corner_order: ["TL", "TR", "BL", "BR"],
    counts: {
      raw: 1,
      deduplicated: 1,
      selected: 1,
    },
    raw_predictions: [selectedVertebra],
    selected_vertebrae: [selectedVertebra],
    cobb: {
      valid: false,
      vertebra_count: 1,
      cobb_1_deg: null,
      cobb_2_deg: null,
      cobb_3_deg: null,
      major_lines: [],
      cobb_2_lines: [],
      cobb_3_lines: [],
    },
    morphology: [],
    warnings: [],
    clinical_review_required: true,
    disclaimer: "Research screening support only.",
  };
}

export function imageFile(
  name: string,
  lastModified = 1,
  type = "image/png",
) {
  return new File(["image"], name, { lastModified, type });
}

export function queueItem(
  id: string,
  overrides: Partial<PredictionQueueItem> = {},
): PredictionQueueItem {
  const file = imageFile(`${id}.png`);
  return {
    id,
    fingerprint: `${id}-fingerprint`,
    file,
    imageUrl: `blob:${id}`,
    status: "queued",
    result: null,
    error: null,
    selectedCandidateId: null,
    ...overrides,
  };
}
