import type { Metadata } from 'next';
import { AboutOverview } from '@/components/about/AboutOverview';

export const metadata: Metadata = {
  title: 'About | Spine Opportunistic Screening',
  description:
    'Learn about the AP/PA radiograph workflow, measurement outputs, and current limitations of Spine Opportunistic Screening.',
};

export default function AboutPage() {
  return <AboutOverview />;
}
