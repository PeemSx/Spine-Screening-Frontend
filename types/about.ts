export type HeroStat = {
  label: string;
  value: string;
  description?: string;
};

export type HeroImage = {
  src: string;
  overlaySrc?: string;
  alt: string;
  caption?: string;
};

export type AboutHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  stats?: HeroStat[];
  image?: HeroImage;
  images?: HeroImage[];
};

export type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  align?: 'left' | 'center';
  withDivider?: boolean;
  maxWidth?: number;
};

export type ApproachStep = {
  title: string;
  description: string;
  detail?: string;
};
