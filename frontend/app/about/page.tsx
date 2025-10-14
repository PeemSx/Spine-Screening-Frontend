'use client';

import { Box, Container, Paper, Stack, Text } from '@mantine/core';
import { AboutHero } from '@/components/about/AboutHero';
import { SectionHeader } from '@/components/about/SectionHeader';
import { ValueGrid } from '@/components/about/ValueGrid';
import { ApproachTimeline } from '@/components/about/ApproachTimeline';
import { ResearchHighlights } from '@/components/about/ResearchHighlights';
import { ImpactMetrics } from '@/components/about/ImpactMetrics';
import { aboutContent } from '@/data/about';

export default function Page() {
  const { hero, mission, approach, research, impact, conclusion } = aboutContent;
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
            <SectionHeader {...mission.header} align="left" />
            <Text size="lg" c="gray.7">
              {mission.narrative}
            </Text>
            <ValueGrid items={mission.pillars} columns={3} />
          </Stack>

          <Stack gap="xl">
            <SectionHeader {...approach.header} />
            <ApproachTimeline steps={approach.steps} />
          </Stack>

          <Stack gap="xl">
            <SectionHeader {...research.header} align="left" />
            <ResearchHighlights highlights={research.highlights} />
          </Stack>

          <Stack gap="xl">
            <SectionHeader {...impact.header} />
            <ImpactMetrics metrics={impact.metrics} />
          </Stack>

          <Paper
            radius="xl"
            p="xl"
            withBorder
            styles={{
              root: {
                borderColor: 'rgba(59, 130, 246, 0.25)',
                background:
                  'linear-gradient(160deg, rgba(229, 242, 255, 0.8), rgba(244, 250, 255, 0.95))',
                boxShadow: '0 18px 32px rgba(9, 30, 68, 0.12)',
              },
            }}
          >
            <Stack gap="sm">
              <Text size="xl" fw={700} c="blue.9">
                {conclusion.title}
              </Text>
              <Text size="md" c="gray.7">
                {conclusion.description}
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
