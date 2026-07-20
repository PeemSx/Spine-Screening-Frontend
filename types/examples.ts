export type ExampleOption = {
  label: string;
  src: string;
  fileName?: string;
};

export type ExampleSelection = {
  example: ExampleOption;
  file: File;
};
