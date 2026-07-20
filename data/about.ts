import type { AboutHeroProps, ApproachStep, SectionHeaderProps } from '@/types/about';

type ApproachContent = {
  header: SectionHeaderProps;
  steps: ApproachStep[];
};

export const aboutContent: {
  hero: AboutHeroProps;
  approach: ApproachContent;
} = {
  hero: {
    eyebrow: 'About',
    title: 'Spine screening support for AP/PA radiographs',
    description:
      'Upload a frontal radiograph to review vertebral landmarks, Cobb angles, and height morphology from the screening API.',
    stats: [
      {
        value: 'AP / PA',
        label: 'Supported views',
        description:
          'JPEG and PNG frontal radiographs.',
      },
      {
        value: 'API v1',
        label: 'Current API',
        description:
          'Returns landmarks, measurements, warnings, and review status.',
      },
    ],
    images: [
      {
        src: '/images/examples/IMG_9135.JPG',
        overlaySrc: '/images/examples/IMG_9135_overlay.svg',
        alt: 'AP radiograph with vertebral landmarks and Cobb reference lines.',
        caption:
          'API output showing vertebral landmarks and Cobb measurements on the original image.',
      },
    ],
  },
  approach: {
    header: {
      eyebrow: 'How it works',
      title: 'From upload to results',
      description:
        'The site shows model measurements for research screening support. It does not provide a diagnosis.',
    },
    steps: [
      {
        title: 'Upload a radiograph',
        description:
          'Choose an AP or PA JPEG or PNG, or load an example image.',
        detail:
          'The same image is used as the background for the result overlay.',
      },
      {
        title: 'Detect vertebral landmarks',
        description:
          'The API returns a center and four corner points for each detected vertebra, ordered from top to bottom.',
        detail:
          'The detector score indicates measurement reliability, not fracture probability.',
      },
      {
        title: 'Review Cobb geometry',
        description:
          'The site draws the corner points, Cobb lines, and angles over the original image.',
        detail:
          'Cobb angles are geometric measurements, not fracture probabilities.',
      },
      {
        title: 'Review height morphology',
        description:
          'Each vertebra shows mean height, change from its neighbor reference, and left/right asymmetry.',
        detail:
          'Negative height change may be flagged. The value is not calculated when the neighbor reference is unreliable.',
      },
      {
        title: 'Check reliability',
        description:
          'Morphology signals and detector reliability are shown separately.',
        detail:
          'Low-reliability signals remain visible. AP/PA asymmetry may come from spinal curvature, rotation, or landmark error.',
      },
    ],
  },
};
