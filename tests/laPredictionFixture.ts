import {
  LA_COBB_SCOPE,
  LA_KEYPOINT_ORDER,
  LA_MEASUREMENT_LANDMARKS,
  type LAPredictionResponse,
  type LAVertebraPrediction,
} from "@/features/screening/api/contract";

export function laVertebra(candidateId = 7): LAVertebraPrediction {
  return {
    candidate_id: candidateId,
    rank: 1,
    detector_score: 0.87,
    center: { x: 50.5, y: 61.75 },
    keypoints: {
      top_left: { x: 31.25, y: 40.5 },
      top_middle: { x: 50.125, y: 39.75 },
      top_right: { x: 69.625, y: 41.25 },
      bottom_left: { x: 32.875, y: 79.5 },
      bottom_middle: { x: 51.375, y: 80.25 },
      bottom_right: { x: 70.75, y: 78.875 },
    },
  };
}

export function laPredictionFixture(): LAPredictionResponse {
  const selected = laVertebra();
  return {
    prediction_id: "00000000-0000-4000-8000-000000000001",
    model: {
      model_id: "la-test-model",
      artifact_type: "pytorch_state_dict",
      format_version: 1,
      backbone: "dla34",
      input_size: 512,
      down_ratio: 4,
      peak_threshold: 0.1,
      topk: 20,
      sha256: "a".repeat(64),
      checkpoint_epoch: 10,
      keypoint_order: [...LA_KEYPOINT_ORDER],
      spine_chain: {
        duplicate_iou_threshold: 0.5,
        duplicate_center_scale: 0.5,
        score_threshold: 0.1,
        score_weight: 1,
        min_chain_len: 1,
      },
    },
    image: { width: 100, height: 120, media_type: "image/png" },
    projection: "LA",
    coordinate_space: "original_image_pixels",
    coordinate_origin: "top_left",
    keypoint_order: [...LA_KEYPOINT_ORDER],
    measurement_landmarks: [...LA_MEASUREMENT_LANDMARKS],
    counts: { raw: 1, deduplicated: 1, selected: 1 },
    raw_predictions: [selected],
    selected_vertebrae: [selected],
    cobb: {
      valid: true,
      vertebra_count: 1,
      cobb_1_deg: 3.25,
      cobb_2_deg: null,
      cobb_3_deg: null,
      major_lines: [
        {
          start: selected.keypoints.top_left,
          end: selected.keypoints.top_right,
          vertebra_candidate_id: selected.candidate_id,
        },
      ],
      cobb_2_lines: [],
      cobb_3_lines: [],
      scope: LA_COBB_SCOPE,
    },
    anatomical_orientation_basis:
      "image_left_assumed_anterior; image_middle_assumed_middle; image_right_assumed_posterior",
    compression_assessment_method:
      "six-keypoint Euclidean paired-height morphometry with adjacent references",
    compression_assessment_scope:
      "Research-only morphometric screening ranges; not a diagnosis or Genant semiquantitative grade.",
    compression_assessments: [
      {
        assessment_status: "valid",
        candidate_id: selected.candidate_id,
        compression_rates: { anterior: 12.5, middle: null, posterior: -3.5 },
        heights: { anterior: 39.1, middle: 40.5, posterior: 38.9, unit: "px" },
        max_height_reduction: 12.5,
        morphology: "no_significant_deformity",
        rank: selected.rank,
        ratios: {
          anterior_posterior: 1.01,
          middle_anterior: 1.04,
          middle_posterior: 1.03,
        },
        reference_status: "bilateral",
        severity: "no_significant_loss",
        suspicious: false,
      },
    ],
    morphology: [],
    warnings: [],
    clinical_review_required: true,
    disclaimer:
      "Research screening-support measurements only. These outputs are not a diagnosis and require clinical interpretation.",
  };
}
