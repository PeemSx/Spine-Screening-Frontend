from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np


@dataclass(frozen=True)
class CobbResult:
    primary: float
    upper: float
    lower: float
    is_s_shape: bool

    @property
    def angles(self) -> tuple[float, float, float]:
        return self.primary, self.upper, self.lower

    @property
    def display_angles(self) -> tuple[float, ...]:
        if self.is_s_shape:
            return self.upper, self.lower
        return (self.primary,)


def _image_height(image_shape: Sequence[int] | None, landmarks: np.ndarray) -> float:
    if image_shape:
        return float(image_shape[0])
    if landmarks.size == 0:
        return 0.0
    return float(np.max(landmarks[:, 1]) + 1.0)


def _is_s_curve(vertical_midpoints: np.ndarray) -> bool:
    """Classify whether the landmark chain crosses both sides of its baseline."""
    if len(vertical_midpoints) < 3:
        return False

    first = vertical_midpoints[0]
    last = vertical_midpoints[-1]
    baseline = last - first
    baseline_norm = float(np.linalg.norm(baseline))
    if baseline_norm < 1e-6:
        return False

    offsets = []
    for point in vertical_midpoints[1:-1]:
        relative = point - first
        signed_offset = baseline[0] * relative[1] - baseline[1] * relative[0]
        offsets.append(float(signed_offset / baseline_norm))

    offsets = np.asarray(offsets, dtype=np.float32)
    meaningful_offsets = offsets[np.abs(offsets) > 1e-3]
    if meaningful_offsets.size == 0:
        return False
    return bool(np.any(meaningful_offsets > 0) and np.any(meaningful_offsets < 0))


def _safe_angle_matrix(vectors: np.ndarray) -> np.ndarray:
    dot_products = vectors @ vectors.T
    magnitudes = np.sqrt(np.sum(vectors**2, axis=1))[:, np.newaxis]
    magnitude_products = magnitudes @ magnitudes.T
    magnitude_products = np.maximum(magnitude_products, 1e-6)
    cosine_angles = np.clip(dot_products / magnitude_products, a_min=0.0, a_max=1.0)
    return np.arccos(cosine_angles)


def cobb_result_from_landmarks(
    landmarks: np.ndarray,
    image_shape: Sequence[int] | None = None,
) -> CobbResult:
    """
    Calculate the three Cobb angles from 4 landmark points per vertebra.

    Landmarks must be ordered per vertebra as top-left, top-right, bottom-left,
    bottom-right. This is a pure version of the MICCAI challenge calculation in
    best-ai-award-2025/cobb_evaluate.py without drawing on the image.
    """
    pts = np.asarray(landmarks, dtype=np.float32)
    if pts.ndim != 2 or pts.shape[1] != 2 or len(pts) < 8 or len(pts) % 4 != 0:
        return CobbResult(0.0, 0.0, 0.0, False)

    num_points = pts.shape[0]
    vertebra_count = num_points // 4
    last_vertebra_idx = vertebra_count - 1
    height = _image_height(image_shape, pts)

    vertical_midpoints = (pts[0::2, :] + pts[1::2, :]) / 2.0

    side_midpoints = []
    for idx in range(0, num_points, 4):
        left_midpoint = (pts[idx, :] + pts[idx + 2, :]) / 2.0
        right_midpoint = (pts[idx + 1, :] + pts[idx + 3, :]) / 2.0
        side_midpoints.append(left_midpoint)
        side_midpoints.append(right_midpoint)
    side_midpoints = np.asarray(side_midpoints, dtype=np.float32)

    vertebra_vectors = side_midpoints[1::2, :] - side_midpoints[0::2, :]
    angles = _safe_angle_matrix(vertebra_vectors)
    paired_indices = np.argmax(angles, axis=1)
    max_per_row = np.amax(angles, axis=1)
    primary_idx = int(np.argmax(max_per_row))
    primary_angle = float(np.amax(max_per_row) / np.pi * 180.0)

    is_s_shape = _is_s_curve(vertical_midpoints)
    if not is_s_shape:
        upper_angle = float(angles[0, primary_idx] / np.pi * 180.0)
        lower_angle = float(angles[last_vertebra_idx, paired_indices[primary_idx]] / np.pi * 180.0)
        return CobbResult(primary_angle, upper_angle, lower_angle, False)

    paired_idx = int(paired_indices[primary_idx])
    if (vertical_midpoints[primary_idx * 2, 1] + vertical_midpoints[paired_idx * 2, 1]) < height:
        upper_slice = angles[primary_idx, : primary_idx + 1]
        lower_slice = angles[paired_idx, paired_idx : last_vertebra_idx + 1]
        upper_angle = float(np.max(upper_slice) / np.pi * 180.0) if upper_slice.size else 0.0
        lower_angle = float(np.max(lower_slice) / np.pi * 180.0) if lower_slice.size else 0.0
        return CobbResult(primary_angle, upper_angle, lower_angle, True)

    upper_slice = angles[primary_idx, : primary_idx + 1]
    upper_angle = float(np.max(upper_slice) / np.pi * 180.0) if upper_slice.size else 0.0
    upper_idx = int(np.argmax(upper_slice)) if upper_slice.size else 0
    lower_slice = angles[upper_idx, : upper_idx + 1]
    lower_angle = float(np.max(lower_slice) / np.pi * 180.0) if lower_slice.size else 0.0
    return CobbResult(primary_angle, upper_angle, lower_angle, True)


def cobb_angles_from_landmarks(
    landmarks: np.ndarray,
    image_shape: Sequence[int] | None = None,
) -> tuple[float, float, float]:
    return cobb_result_from_landmarks(landmarks, image_shape).angles


def landmarks_from_corners(corners: np.ndarray) -> np.ndarray:
    corner_array = np.asarray(corners, dtype=np.float32)
    if corner_array.ndim != 3 or corner_array.shape[1:] != (4, 2):
        return np.zeros((0, 2), dtype=np.float32)
    return corner_array.reshape(-1, 2)


def cobb_angles_from_corners(
    corners: np.ndarray,
    image_shape: Sequence[int] | None = None,
) -> tuple[float, float, float]:
    return cobb_angles_from_landmarks(landmarks_from_corners(corners), image_shape)


def cobb_result_from_corners(
    corners: np.ndarray,
    image_shape: Sequence[int] | None = None,
) -> CobbResult:
    return cobb_result_from_landmarks(landmarks_from_corners(corners), image_shape)


def is_s_shape_from_corners(corners: np.ndarray) -> bool:
    return cobb_result_from_corners(corners).is_s_shape


def primary_cobb_angle_from_corners(
    corners: np.ndarray,
    image_shape: Sequence[int] | None = None,
) -> float:
    return cobb_angles_from_corners(corners, image_shape)[0]


def cobb_angle_from_center_points(points: np.ndarray) -> float:
    pts = np.asarray(points, dtype=np.float32)
    if len(pts) < 3:
        return 0.0
    vectors = np.diff(pts, axis=0)
    angles = np.degrees(np.arctan2(vectors[:, 1], vectors[:, 0]))
    return float(abs(np.max(angles) - np.min(angles)))
