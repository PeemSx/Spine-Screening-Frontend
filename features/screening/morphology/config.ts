export const MORPHOLOGY_FLAGGING_CONFIG = {
  minimumDetectorScore: 0.18,
  acceptableDetectorScore: 0.35,
  highDetectorScore: 0.6,
  minimumNeighborScore: 0.18,

  // Height-change thresholds apply only when the signed change is negative.
  // Positive changes remain visible but do not create a morphology signal.
  borderlineHeightChange: 0.15,
  suspiciousHeightChange: 0.2,
  highHeightChange: 0.25,
  markedHeightChange: 0.4,

  borderlineAsymmetry: 0.15,
  suspiciousAsymmetry: 0.2,
  highAsymmetry: 0.25,

  combinedHeightChange: 0.15,
  combinedAsymmetry: 0.15,

  // A large gap relative to the chain's median adjacent-center spacing can
  // indicate that an intermediate vertebra was not selected.
  maximumSpacingToMedianRatio: 1.75,
} as const;
