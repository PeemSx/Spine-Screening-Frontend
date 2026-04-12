'use client';

import { Box, Container, Stack } from '@mantine/core';
import { AboutHero } from '@/components/about/AboutHero';
import { SectionHeader } from '@/components/about/SectionHeader';
import { ApproachTimeline } from '@/components/about/ApproachTimeline';
import { aboutContent } from '@/data/about';

export default function Page() {
  const { hero, approach } = aboutContent;

  return (
    <Box>
      <AboutHero {...hero} />

      <Container size="lg" py={{ base: 60, md: 100 }}>
        <Stack
          gap="xl"
          style={{
            gap: 'clamp(3.5rem, 6vw, 6rem)',
          }}
        >
          <Stack gap="xl">
            <SectionHeader {...approach.header} />
            <ApproachTimeline steps={approach.steps} />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
