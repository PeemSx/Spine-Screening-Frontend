/**
 * UI contract and runtime guards layered over the generated OpenAPI schema.
 * Keep response guards strict; never edit schema.generated.ts by hand.
 */

import type { components } from "./schema.generated";

type ApiSchemas = components["schemas"];

export type Point = ApiSchemas["Point"];

export type OrderedCorners = ApiSchemas["OrderedCorners"];

export type VertebraPrediction = ApiSchemas["VertebraPrediction"];

export type SixKeypoints = ApiSchemas["SixKeypoints"];

export type LAVertebraPrediction = ApiSchemas["LAVertebraPrediction"];

export type CobbLine = ApiSchemas["CobbLine"];

export interface CobbResult {
  valid: boolean;
  vertebra_count: number;
  cobb_1_deg: number | null;
  cobb_2_deg: number | null;
  cobb_3_deg: number | null;
  major_lines: CobbLine[];
  cobb_2_lines: CobbLine[];
  cobb_3_lines: CobbLine[];
}

export type MorphologyFeature = ApiSchemas["MorphologyFeature"];

export type ImageInfo = ApiSchemas["ImageInfo"];

export type PredictionCounts = ApiSchemas["PredictionCounts"];

export type SpineChainInfo = ApiSchemas["SpineChainInfo"];

export type ModelInfoResponse = ApiSchemas["ModelInfoResponse"];

export interface PredictionResponse {
  prediction_id: string;
  model: ModelInfoResponse;
  image: ImageInfo;
  coordinate_space: "original_image_pixels";
  coordinate_origin: "top_left";
  corner_order: ["TL", "TR", "BL", "BR"];
  counts: PredictionCounts;
  raw_predictions: VertebraPrediction[] | null;
  selected_vertebrae: VertebraPrediction[];
  cobb: CobbResult;
  morphology: MorphologyFeature[];
  warnings: string[];
  clinical_review_required: true;
  disclaimer: string;
}

export const LA_KEYPOINT_ORDER = [
  "top_left",
  "top_middle",
  "top_right",
  "bottom_left",
  "bottom_middle",
  "bottom_right",
] as const;

export const LA_MEASUREMENT_LANDMARKS = [
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
] as const;

export const LA_COBB_SCOPE =
  "LA geometry agreement calculated from the four outer landmarks; not a clinical AP/PA Cobb measurement." as const;

export type LAModelInfoResponse = ApiSchemas["LAModelInfoResponse"];

export interface LACobbResult extends CobbResult {
  scope: typeof LA_COBB_SCOPE;
}

export interface LAPredictionResponse {
  prediction_id: string;
  model: LAModelInfoResponse;
  image: ImageInfo;
  projection: "LA";
  coordinate_space: "original_image_pixels";
  coordinate_origin: "top_left";
  keypoint_order: typeof LA_KEYPOINT_ORDER;
  measurement_landmarks: typeof LA_MEASUREMENT_LANDMARKS;
  counts: PredictionCounts;
  raw_predictions: LAVertebraPrediction[];
  selected_vertebrae: LAVertebraPrediction[];
  cobb: LACobbResult;
  morphology: MorphologyFeature[];
  warnings: string[];
  clinical_review_required: true;
  disclaimer: string;
}

export type ProblemDetail = ApiSchemas["ProblemDetail"];

export interface ApiValidationIssue {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export interface FastApiValidationError {
  detail: ApiValidationIssue[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isCorners(value: unknown): value is OrderedCorners {
  return (
    isRecord(value) &&
    isPoint(value.top_left) &&
    isPoint(value.top_right) &&
    isPoint(value.bottom_left) &&
    isPoint(value.bottom_right)
  );
}

function isVertebraPrediction(value: unknown): value is VertebraPrediction {
  return (
    isRecord(value) &&
    isInteger(value.candidate_id) &&
    isInteger(value.rank) &&
    isFiniteNumber(value.detector_score) &&
    isPoint(value.center) &&
    isCorners(value.corners)
  );
}

function isSixKeypoints(value: unknown): value is SixKeypoints {
  return (
    isRecord(value) &&
    isPoint(value.top_left) &&
    isPoint(value.top_middle) &&
    isPoint(value.top_right) &&
    isPoint(value.bottom_left) &&
    isPoint(value.bottom_middle) &&
    isPoint(value.bottom_right)
  );
}

function isLAVertebraPrediction(
  value: unknown,
): value is LAVertebraPrediction {
  return (
    isRecord(value) &&
    isInteger(value.candidate_id) &&
    isInteger(value.rank) &&
    isFiniteNumber(value.detector_score) &&
    isPoint(value.center) &&
    isSixKeypoints(value.keypoints)
  );
}

function isCobbLine(value: unknown): value is CobbLine {
  return (
    isRecord(value) &&
    isPoint(value.start) &&
    isPoint(value.end) &&
    isInteger(value.vertebra_candidate_id)
  );
}

function isCobbResult(value: unknown): value is CobbResult {
  return (
    isRecord(value) &&
    typeof value.valid === "boolean" &&
    isInteger(value.vertebra_count) &&
    isNullableFiniteNumber(value.cobb_1_deg) &&
    isNullableFiniteNumber(value.cobb_2_deg) &&
    isNullableFiniteNumber(value.cobb_3_deg) &&
    Array.isArray(value.major_lines) &&
    value.major_lines.every(isCobbLine) &&
    Array.isArray(value.cobb_2_lines) &&
    value.cobb_2_lines.every(isCobbLine) &&
    Array.isArray(value.cobb_3_lines) &&
    value.cobb_3_lines.every(isCobbLine)
  );
}

function isLACobbResult(value: unknown): value is LACobbResult {
  return (
    isRecord(value) &&
    value.scope === LA_COBB_SCOPE &&
    isCobbResult(value)
  );
}

const requiredMorphologyNumbers = [
  "rank",
  "candidate_id",
  "detector_score",
  "superior_width_px",
  "inferior_width_px",
  "left_height_px",
  "right_height_px",
  "mean_height_px",
  "left_right_height_ratio",
  "height_asymmetry_fraction",
  "width_height_ratio",
  "superior_endplate_angle_deg",
  "inferior_endplate_angle_deg",
  "endplate_nonparallel_deg",
] as const;

const nullableMorphologyNumbers = [
  "neighbor_reference_height_px",
  "height_ratio_to_neighbors",
  "relative_height_deviation",
  "previous_center_spacing_px",
  "next_center_spacing_px",
] as const;

function isMorphologyFeature(value: unknown): value is MorphologyFeature {
  if (!isRecord(value)) return false;
  return (
    requiredMorphologyNumbers.every((key) => isFiniteNumber(value[key])) &&
    nullableMorphologyNumbers.every((key) => isNullableFiniteNumber(value[key]))
  );
}

function isModelInfo(value: unknown): value is ModelInfoResponse {
  return (
    isRecord(value) &&
    typeof value.model_id === "string" &&
    typeof value.artifact_type === "string" &&
    isInteger(value.format_version) &&
    typeof value.backbone === "string" &&
    isInteger(value.input_size) &&
    isInteger(value.down_ratio) &&
    isFiniteNumber(value.peak_threshold) &&
    isInteger(value.topk) &&
    typeof value.sha256 === "string" &&
    Array.isArray(value.corner_order) &&
    value.corner_order.length === 4 &&
    isRecord(value.spine_chain)
  );
}

function isLAModelInfo(value: unknown): value is LAModelInfoResponse {
  return (
    isRecord(value) &&
    typeof value.model_id === "string" &&
    typeof value.artifact_type === "string" &&
    isInteger(value.format_version) &&
    typeof value.backbone === "string" &&
    isInteger(value.input_size) &&
    isInteger(value.down_ratio) &&
    isFiniteNumber(value.peak_threshold) &&
    isInteger(value.topk) &&
    typeof value.sha256 === "string" &&
    isInteger(value.checkpoint_epoch) &&
    Array.isArray(value.keypoint_order) &&
    value.keypoint_order.join(",") === LA_KEYPOINT_ORDER.join(",") &&
    isRecord(value.spine_chain)
  );
}

/** Runtime guard for the fields required by the screening UI. */
export function isPredictionResponse(value: unknown): value is PredictionResponse {
  if (!isRecord(value)) return false;

  const image = value.image;
  const counts = value.counts;
  const rawPredictions = value.raw_predictions;

  return (
    typeof value.prediction_id === "string" &&
    isModelInfo(value.model) &&
    isRecord(image) &&
    isInteger(image.width) &&
    isInteger(image.height) &&
    typeof image.media_type === "string" &&
    value.coordinate_space === "original_image_pixels" &&
    value.coordinate_origin === "top_left" &&
    Array.isArray(value.corner_order) &&
    value.corner_order.join(",") === "TL,TR,BL,BR" &&
    isRecord(counts) &&
    isInteger(counts.raw) &&
    isInteger(counts.deduplicated) &&
    isInteger(counts.selected) &&
    (rawPredictions === null ||
      (Array.isArray(rawPredictions) && rawPredictions.every(isVertebraPrediction))) &&
    Array.isArray(value.selected_vertebrae) &&
    value.selected_vertebrae.every(isVertebraPrediction) &&
    isCobbResult(value.cobb) &&
    Array.isArray(value.morphology) &&
    value.morphology.every(isMorphologyFeature) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string") &&
    value.clinical_review_required === true &&
    typeof value.disclaimer === "string"
  );
}

/** Runtime guard for the projection-specific fields required by the LA UI. */
export function isLAPredictionResponse(
  value: unknown,
): value is LAPredictionResponse {
  if (!isRecord(value)) return false;

  const image = value.image;
  const counts = value.counts;

  return (
    typeof value.prediction_id === "string" &&
    isLAModelInfo(value.model) &&
    isRecord(image) &&
    isInteger(image.width) &&
    isInteger(image.height) &&
    typeof image.media_type === "string" &&
    value.projection === "LA" &&
    value.coordinate_space === "original_image_pixels" &&
    value.coordinate_origin === "top_left" &&
    Array.isArray(value.keypoint_order) &&
    value.keypoint_order.join(",") === LA_KEYPOINT_ORDER.join(",") &&
    Array.isArray(value.measurement_landmarks) &&
    value.measurement_landmarks.join(",") ===
      LA_MEASUREMENT_LANDMARKS.join(",") &&
    isRecord(counts) &&
    isInteger(counts.raw) &&
    isInteger(counts.deduplicated) &&
    isInteger(counts.selected) &&
    Array.isArray(value.raw_predictions) &&
    value.raw_predictions.every(isLAVertebraPrediction) &&
    Array.isArray(value.selected_vertebrae) &&
    value.selected_vertebrae.every(isLAVertebraPrediction) &&
    isLACobbResult(value.cobb) &&
    Array.isArray(value.morphology) &&
    value.morphology.every(isMorphologyFeature) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string") &&
    value.clinical_review_required === true &&
    typeof value.disclaimer === "string"
  );
}
