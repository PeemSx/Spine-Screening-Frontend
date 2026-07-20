import type {
  MorphologyFeature,
  Point,
  VertebraPrediction,
} from "../api/generated";
import { MORPHOLOGY_FLAGGING_CONFIG as config } from "./config";

export type DetectorReliability =
  | "not_assessable"
  | "low"
  | "acceptable"
  | "high";

export type HeightChangeTier =
  | "unavailable"
  | "none"
  | "borderline"
  | "suspicious"
  | "high_priority"
  | "marked";

export type AsymmetryTier = "none" | "borderline" | "suspicious" | "strong";

export type MorphologySignalStatus =
  | "not_assessable"
  | "no_morphology_signal"
  | "borderline_morphology_signal"
  | "suspicious_morphology_signal"
  | "high_priority_morphology_signal"
  | "marked_height_change";

export type NeighborReferenceIssue =
  | "edge_vertebra"
  | "missing_landmarks"
  | "low_confidence_neighbor"
  | "skipped_vertebra_suspected"
  | "unstable_neighbor_reference";

export interface MorphologyAssessment {
  candidateId: number;
  rank: number;
  detectorScore: number;
  reliability: DetectorReliability;
  leftHeightPx: number;
  rightHeightPx: number;
  currentHeightPx: number;
  referenceHeightPx: number | null;
  /** Signed change from the interpolated neighbor reference. */
  heightChange: number | null;
  heightChangeTier: HeightChangeTier;
  heightChangeUnavailableReason: NeighborReferenceIssue | null;
  asymmetry: number;
  asymmetryTier: AsymmetryTier;
  status: MorphologySignalStatus;
  reasons: string[];
}

interface ProjectedGeometry {
  candidateId: number;
  rank: number;
  detectorScore: number;
  center: Point | null;
  leftHeightPx: number;
  rightHeightPx: number;
  currentHeightPx: number;
  asymmetry: number;
}

interface PreliminaryReference {
  referenceHeightPx: number | null;
  heightChange: number | null;
  unavailableReason: NeighborReferenceIssue | null;
}

const EPSILON = 1e-6;

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function normalize(vector: Point): Point | null {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude <= EPSILON) return null;
  return { x: vector.x / magnitude, y: vector.y / magnitude };
}

function vector(first: Point, second: Point): Point {
  return { x: second.x - first.x, y: second.y - first.y };
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) * 0.5, y: (first.y + second.y) * 0.5 };
}

function localSpineAxis(
  current: VertebraPrediction,
  previous: VertebraPrediction | undefined,
  next: VertebraPrediction | undefined,
) {
  const neighborAxis =
    previous && next
      ? normalize(vector(previous.center, next.center))
      : next
        ? normalize(vector(current.center, next.center))
        : previous
          ? normalize(vector(previous.center, current.center))
          : null;
  if (neighborAxis) return neighborAxis;

  const top = midpoint(current.corners.top_left, current.corners.top_right);
  const bottom = midpoint(current.corners.bottom_left, current.corners.bottom_right);
  return normalize(vector(top, bottom)) ?? { x: 0, y: 1 };
}

function projectedLength(start: Point, end: Point, axis: Point) {
  const side = vector(start, end);
  return Math.abs(side.x * axis.x + side.y * axis.y);
}

function detectorReliability(score: number): DetectorReliability {
  if (score < config.minimumDetectorScore) return "not_assessable";
  if (score < config.acceptableDetectorScore) return "low";
  if (score < config.highDetectorScore) return "acceptable";
  return "high";
}

function heightChangeTier(value: number | null): HeightChangeTier {
  if (value === null) return "unavailable";
  const reduction = Math.max(0, -value);
  if (reduction >= config.markedHeightChange) return "marked";
  if (reduction >= config.highHeightChange) return "high_priority";
  if (reduction >= config.suspiciousHeightChange) return "suspicious";
  if (reduction >= config.borderlineHeightChange) return "borderline";
  return "none";
}

function asymmetryTier(value: number): AsymmetryTier {
  if (value >= config.highAsymmetry) return "strong";
  if (value >= config.suspiciousAsymmetry) return "suspicious";
  if (value >= config.borderlineAsymmetry) return "borderline";
  return "none";
}

function combinedStatus(
  detectorScore: number,
  heightChange: number | null,
  asymmetry: number,
): MorphologySignalStatus {
  if (detectorScore < config.minimumDetectorScore) return "not_assessable";

  const reduction = Math.max(0, -(heightChange ?? 0));
  if (reduction >= config.markedHeightChange) return "marked_height_change";
  if (
    reduction >= config.highHeightChange ||
    asymmetry >= config.highAsymmetry ||
    (reduction >= config.suspiciousHeightChange &&
      asymmetry >= config.suspiciousAsymmetry)
  ) {
    return "high_priority_morphology_signal";
  }
  if (
    reduction >= config.suspiciousHeightChange ||
    asymmetry >= config.suspiciousAsymmetry ||
    (reduction >= config.combinedHeightChange &&
      asymmetry >= config.combinedAsymmetry)
  ) {
    return "suspicious_morphology_signal";
  }
  if (
    reduction >= config.borderlineHeightChange ||
    asymmetry >= config.borderlineAsymmetry
  ) {
    return "borderline_morphology_signal";
  }
  return "no_morphology_signal";
}

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((first, second) => first - second);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) * 0.5
    : ordered[middle];
}

function buildGeometry(
  morphology: readonly MorphologyFeature[],
  vertebrae: readonly VertebraPrediction[],
) {
  const vertebraByCandidateId = new Map(
    vertebrae.map((vertebra) => [vertebra.candidate_id, vertebra]),
  );

  return morphology.map<ProjectedGeometry>((feature, index) => {
    const current = vertebraByCandidateId.get(feature.candidate_id);
    const previousFeature = morphology[index - 1];
    const nextFeature = morphology[index + 1];
    const previous = previousFeature
      ? vertebraByCandidateId.get(previousFeature.candidate_id)
      : undefined;
    const next = nextFeature
      ? vertebraByCandidateId.get(nextFeature.candidate_id)
      : undefined;

    let leftHeightPx = feature.left_height_px;
    let rightHeightPx = feature.right_height_px;
    if (current) {
      const axis = localSpineAxis(current, previous, next);
      const projectedLeft = projectedLength(
        current.corners.top_left,
        current.corners.bottom_left,
        axis,
      );
      const projectedRight = projectedLength(
        current.corners.top_right,
        current.corners.bottom_right,
        axis,
      );
      if (projectedLeft > EPSILON && projectedRight > EPSILON) {
        leftHeightPx = projectedLeft;
        rightHeightPx = projectedRight;
      }
    }

    const currentHeightPx = (leftHeightPx + rightHeightPx) * 0.5;
    const maximumSideHeight = Math.max(leftHeightPx, rightHeightPx);
    const asymmetry =
      maximumSideHeight <= EPSILON
        ? 0
        : Math.abs(leftHeightPx - rightHeightPx) / maximumSideHeight;

    return {
      candidateId: feature.candidate_id,
      rank: feature.rank,
      detectorScore: feature.detector_score,
      center: current?.center ?? null,
      leftHeightPx,
      rightHeightPx,
      currentHeightPx,
      asymmetry,
    };
  });
}

function preliminaryReferences(geometry: readonly ProjectedGeometry[]) {
  const adjacentSpacings = geometry
    .slice(1)
    .map((current, index) => {
      const previous = geometry[index];
      return previous.center && current.center
        ? distance(previous.center, current.center)
        : null;
    })
    .filter((value): value is number => value !== null && value > EPSILON);
  const medianSpacing = median(adjacentSpacings);

  return geometry.map<PreliminaryReference>((current, index) => {
    if (index === 0 || index === geometry.length - 1) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "edge_vertebra",
      };
    }

    const previous = geometry[index - 1];
    const next = geometry[index + 1];
    if (!current.center || !previous.center || !next.center) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "missing_landmarks",
      };
    }
    if (
      previous.detectorScore < config.minimumNeighborScore ||
      next.detectorScore < config.minimumNeighborScore
    ) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "low_confidence_neighbor",
      };
    }

    const previousSpacing = distance(previous.center, current.center);
    const nextSpacing = distance(current.center, next.center);
    if (
      medianSpacing !== null &&
      (previousSpacing > medianSpacing * config.maximumSpacingToMedianRatio ||
        nextSpacing > medianSpacing * config.maximumSpacingToMedianRatio)
    ) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "skipped_vertebra_suspected",
      };
    }

    const denominator = next.center.y - previous.center.y;
    if (Math.abs(denominator) <= EPSILON) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "unstable_neighbor_reference",
      };
    }
    const t = (current.center.y - previous.center.y) / denominator;
    if (t < 0 || t > 1) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "unstable_neighbor_reference",
      };
    }

    const referenceHeightPx =
      (1 - t) * previous.currentHeightPx + t * next.currentHeightPx;
    if (referenceHeightPx <= EPSILON) {
      return {
        referenceHeightPx: null,
        heightChange: null,
        unavailableReason: "unstable_neighbor_reference",
      };
    }

    return {
      referenceHeightPx,
      heightChange: current.currentHeightPx / referenceHeightPx - 1,
      unavailableReason: null,
    };
  });
}

function reasonsFor(
  status: MorphologySignalStatus,
  heightChange: number | null,
  asymmetry: number,
) {
  if (status === "not_assessable") {
    return ["Detector score is below the assessable threshold"];
  }

  const reasons: string[] = [];
  if (
    heightChange !== null &&
    heightChange <= -config.borderlineHeightChange
  ) {
    const sign = heightChange > 0 ? "+" : "";
    reasons.push(`height change ${sign}${(heightChange * 100).toFixed(1)}%`);
  }
  if (asymmetry >= config.borderlineAsymmetry) {
    reasons.push(`left/right asymmetry ${(asymmetry * 100).toFixed(1)}%`);
  }
  return reasons;
}

export function analyzeMorphology(
  morphology: readonly MorphologyFeature[],
  vertebrae: readonly VertebraPrediction[],
): MorphologyAssessment[] {
  const orderedMorphology = [...morphology].sort(
    (first, second) => first.rank - second.rank,
  );
  const geometry = buildGeometry(orderedMorphology, vertebrae);
  const preliminary = preliminaryReferences(geometry);

  return geometry.map((current, index) => {
    const reference = preliminary[index];
    const previous = index > 0 ? geometry[index - 1] : null;
    const next = index + 1 < geometry.length ? geometry[index + 1] : null;
    const previousReference = index > 0 ? preliminary[index - 1] : null;
    const nextReference = index + 1 < preliminary.length ? preliminary[index + 1] : null;
    const previousStrong =
      previous !== null &&
      (previous.asymmetry >= config.highAsymmetry ||
        Math.max(0, -(previousReference?.heightChange ?? 0)) >=
          config.highHeightChange);
    const nextStrong =
      next !== null &&
      (next.asymmetry >= config.highAsymmetry ||
        Math.max(0, -(nextReference?.heightChange ?? 0)) >=
          config.highHeightChange);

    const unstableNeighbor =
      reference.heightChange !== null && (previousStrong || nextStrong);
    const referenceHeightPx = unstableNeighbor ? null : reference.referenceHeightPx;
    const heightChange = unstableNeighbor ? null : reference.heightChange;
    const heightChangeUnavailableReason = unstableNeighbor
      ? "unstable_neighbor_reference"
      : reference.unavailableReason;
    const status = combinedStatus(
      current.detectorScore,
      heightChange,
      current.asymmetry,
    );

    return {
      candidateId: current.candidateId,
      rank: current.rank,
      detectorScore: current.detectorScore,
      reliability: detectorReliability(current.detectorScore),
      leftHeightPx: current.leftHeightPx,
      rightHeightPx: current.rightHeightPx,
      currentHeightPx: current.currentHeightPx,
      referenceHeightPx,
      heightChange,
      heightChangeTier: heightChangeTier(heightChange),
      heightChangeUnavailableReason,
      asymmetry: current.asymmetry,
      asymmetryTier: asymmetryTier(current.asymmetry),
      status,
      reasons: reasonsFor(status, heightChange, current.asymmetry),
    };
  });
}
