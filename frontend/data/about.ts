import {
  IconDeviceAnalytics,
  IconMicroscope,
  IconShieldLock,
  IconTargetArrow,
  IconUsersGroup,
  IconHeartbeat,
} from '@tabler/icons-react';
import type { ValueItem } from '@/components/about/ValueGrid';
import type { ApproachStep } from '@/components/about/ApproachTimeline';
import type { ImpactMetric } from '@/components/about/ImpactMetrics';
import type { ResearchHighlight } from '@/components/about/ResearchHighlights';
import type { ComponentProps } from 'react';
import type { AboutHero } from '@/components/about/AboutHero';
import type { SectionHeader } from '@/components/about/SectionHeader';

type HeroContent = ComponentProps<typeof AboutHero>;
type SectionHeaderContent = ComponentProps<typeof SectionHeader>;

type MissionContent = {
  header: SectionHeaderContent;
  narrative: string;
  pillars: ValueItem[];
};

type ApproachContent = {
  header: SectionHeaderContent;
  steps: ApproachStep[];
};

type ResearchContent = {
  header: SectionHeaderContent;
  highlights: ResearchHighlight[];
};

type ImpactContent = {
  header: SectionHeaderContent;
  metrics: ImpactMetric[];
};

type ConclusionContent = {
  title: string;
  description: string;
};

export const aboutContent: {
  hero: HeroContent;
  mission: MissionContent;
  approach: ApproachContent;
  research: ResearchContent;
  impact: ImpactContent;
  conclusion: ConclusionContent;
} = {
  hero: {
    eyebrow: 'About OVCF Detector',
    title: 'Advancing Vertebral Fracture Care with Explainable AI',
    description:
      'OVCF (Osteoporotic Vertebral Compression Fracture) Detector bridges radiological expertise and modern AI to make fracture screening faster, more accessible, and clinically reliable.',
    stats: [
      {
        label: 'Curated X-ray studies',
        value: '1.2k+',
        description: 'Annotated AP and LA spine radiographs from partner hospitals.',
      },
      {
        label: 'Detection pipeline',
        value: 'Dual-view',
        description: 'Ensembles AP & lateral models with explainable overlays.',
      },
      {
        label: 'Clinical collaborators',
        value: '6',
        description: 'Orthopedic and radiology experts guiding model validation.',
      },
      {
        label: 'Time-to-insight',
        value: '< 20s',
        description: 'Average processing time per study on commodity GPUs.',
      },
    ],
    images: [
      {
        src: '/images/examples/la/la_pred.jpg',
        alt: 'Fracture probability visualization on LA spine X-ray.',
        caption:
          'Explainable overlays on lateral views surface vertebral fracture candidates clearly.',
      },
      {
        src: '/images/examples/ap/ap_pred.jpg',
        alt: 'AP spine prediction highlighting vertebral fracture region.',
        caption:
          'AP view segmentation pinpoints deformity regions that warrant closer review.',
      },
    ],
  },
  mission: {
    header: {
      eyebrow: 'Our Mission',
      title: 'Clinical-intent AI for proactive osteoporosis care',
      description:
        'We design tooling that supports orthopedic specialists in making confident decisions, especially in resource-limited environments where radiology backlogs delay treatment.',
    },
    narrative:
      'By pairing domain-informed labeling with explainable computer vision, OVCF Detector shortens the gap between acquiring spinal X-rays and identifying fractures that require urgent intervention.',
    pillars: [
      {
        title: 'Evidence-led Design',
        description:
          'Every feature is validated alongside orthopedic specialists to align with real hospital workflows.',
        icon: IconTargetArrow,
      },
      {
        title: 'Reliable Model Ops',
        description:
          'Automated evaluation, bias checks, and monitoring keep performance consistent across demographics.',
        icon: IconDeviceAnalytics,
      },
      {
        title: 'Privacy First',
        description:
          'De-identification pipelines and audited storage ensure patient data stays secure end-to-end.',
        icon: IconShieldLock,
      },
      {
        title: 'Collaborative Community',
        description:
          'Cross-disciplinary team spanning medical faculty, AI researchers, and engineering students.',
        icon: IconUsersGroup,
      },
      {
        title: 'Explainable Insights',
        description:
          'Heatmap overlays and vertebral landmarks provide clinicians with tangible cues, not just scores.',
        icon: IconMicroscope,
      },
      {
        title: 'Patient Impact',
        description:
          'Early detection enables timely therapy, reducing chronic pain and progressive spinal deformities.',
        icon: IconHeartbeat,
      },
    ],
  },
  approach: {
    header: {
      eyebrow: 'Product Approach',
      title: 'From imaging to actionable triage in four steps',
      description:
        'Each release cycle focuses on a measurable improvement—be it model accuracy, interpretability, or workflow integration.',
    },
    steps: [
      {
        title: 'Expert Dataset Curation',
        description:
          'Radiologists label vertebral bodies, fracture severity, and anatomical landmarks on AP and LA views.',
        detail:
          'Annotation consensus is tracked to quantify inter-rater reliability before training.',
      },
      {
        title: 'Dual-View Model Training',
        description:
          'Separate convolutional pipelines learn AP and lateral features with augmentations tuned for radiographic artifacts.',
        detail:
          'Backbones are optimized using transfer learning and hard example mining strategies.',
      },
      {
        title: 'Explainable Prediction Layer',
        description:
          'Grad-CAM heatmaps and fracture probability scores are fused to surface interpretable insights.',
        detail:
          'Outputs include vertebral index references so clinicians can verify against the original film quickly.',
      },
      {
        title: 'Clinical Feedback Loop',
        description:
          'Deployment feedback is collected from orthopedic clinics to refine thresholds and UX heuristics.',
        detail:
          'Usage metrics feed dashboards that highlight edge cases and guide the next iteration backlog.',
      },
    ],
  },
  research: {
    header: {
      eyebrow: 'Research Backing',
      title: 'Grounded in rigorous experimentation and peer guidance',
      description:
        'Our research stack balances classical image processing, modern neural networks, and clinician interpretation.',
    },
    highlights: [
      {
        title: 'Vertebral Landmark Detection',
        summary:
          'Combines detection heads with anatomical constraints to pinpoint vertebral centroids for fracture localization.',
        points: [
          'Landmark predictions are cross-validated with inter-observer agreement scores.',
          'Supports automatic alignment and region-of-interest cropping per vertebra.',
        ],
      },
      {
        title: 'Severity Scoring Framework',
        summary:
          'Implements deformity indices to translate pixel-level predictions into Genant-like severity grades.',
        points: [
          'Automated scoring mirrors manual Genant grading for wedge, biconcave, and crush fractures.',
          'Confidence intervals empower clinicians to weigh automated findings against manual readings.',
        ],
      },
      {
        title: 'Deployment-readiness Protocol',
        summary:
          'Pipeline includes reproducible experiments, calibration monitoring, and MLOps-ready logging.',
        points: [
          'Model registries document hyperparameters, dataset versions, and evaluation splits.',
          'Alerts trigger when live data drift deviates from validated training distributions.',
        ],
      },
    ],
  },
  impact: {
    header: {
      eyebrow: 'Impact Metrics',
      title: 'Measuring success in patient and clinician outcomes',
      description:
        'We evaluate meaningful indicators rather than vanity metrics to ensure the detector stays useful in practice.',
    },
    metrics: [
      {
        label: 'Fractures flagged per week',
        value: '48',
        description: 'Average cases prioritized for follow-up across pilot sites.',
      },
      {
        label: 'Reduction in reporting delay',
        value: '37%',
        description: 'Time saved from radiograph acquisition to orthopedic review.',
      },
      {
        label: 'Clinician confidence uplift',
        value: '+22 pts',
        description: 'Self-reported increase in diagnostic confidence post-deployment.',
      },
    ],
  },
  conclusion: {
    title: 'Looking ahead to multi-center validation',
    description:
      'We are expanding the dataset with partner hospitals and preparing regulatory documentation to transition from research prototype toward a clinically certified decision-support system.',
  },
};
