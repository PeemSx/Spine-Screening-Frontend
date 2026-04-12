export type ExampleOption = {
  label: string;
  src: string;
  fileName?: string;
  predictionSrc?: string;
  heatmapSrc?: string;
  cobbAngle?: number;
  avgConfidence?: number;
  numDetections?: number;
};

export type ExampleSelection = {
  example: ExampleOption;
  file: File;
};
