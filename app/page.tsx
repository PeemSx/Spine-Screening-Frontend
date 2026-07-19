'use client';

import { useEffect, useState } from 'react';
import { AboutOverview } from '@/components/about/AboutOverview';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <AboutOverview />;
}
