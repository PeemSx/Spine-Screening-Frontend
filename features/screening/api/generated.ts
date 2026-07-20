/**
 * TypeScript representation of Spine-Screening-API `/api/v1` contracts.
 * Keep this file aligned with the backend OpenAPI document.
 */

export interface Point {
  x: number;
  y: number;
}

export interface OrderedCorners {
  top_left: Point;
  top_right: Point;
  bottom_left: Point;
  bottom_right: Point;
}

export interface VertebraPrediction {
  candidate_id: number;
  rank: number;
  detector_score: number;
  center: Point;
  corners: OrderedCorners;
}

export interface CobbLine {
  start: Point;
  end: Point;
  vertebra_candidate_id: number;
}

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

export interface MorphologyFeature {
  rank: number;
  candidate_id: number;
  detector_score: number;
  superior_width_px: number;
  inferior_width_px: number;
  left_height_px: number;
  right_height_px: number;
  mean_height_px: number;
  left_right_height_ratio: number;
  height_asymmetry_fraction: number;
  width_height_ratio: number;
  superior_endplate_angle_deg: number;
  inferior_endplate_angle_deg: number;
  endplate_nonparallel_deg: number;
  neighbor_reference_height_px: number | null;
  height_ratio_to_neighbors: number | null;
  relative_height_deviation: number | null;
  previous_center_spacing_px: number | null;
  next_center_spacing_px: number | null;
}

export interface ImageInfo {
  width: number;
  height: number;
  media_type: string;
}

export interface PredictionCounts {
  raw: number;
  deduplicated: number;
  selected: number;
}

export interface SpineChainInfo {
  duplicate_iou_threshold: number;
  duplicate_center_scale: number;
  score_threshold: number;
  score_weight: number;
  min_chain_len: number;
}

export interface ModelInfoResponse {
  model_id: string;
  artifact_type: string;
  format_version: number;
  backbone: string;
  input_size: number;
  down_ratio: number;
  peak_threshold: number;
  topk: number;
  sha256: string;
  corner_order: [string, string, string, string];
  spine_chain: SpineChainInfo;
}

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

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance: string;
  request_id?: string | null;
}

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
