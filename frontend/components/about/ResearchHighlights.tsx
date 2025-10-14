'use client';

import { Card, List, Stack, Text, Title } from '@mantine/core';

export type ResearchHighlight = {
  title: string;
  summary: string;
  points?: string[];
};

type ResearchHighlightsProps = {
  highlights: ResearchHighlight[];
};

export function ResearchHighlights({ highlights }: ResearchHighlightsProps) {
  return (
    <Stack gap="xl">
      {highlights.map((highlight) => (
        <Card
          key={highlight.title}
          radius="lg"
          p="xl"
          withBorder
          styles={{
            root: {
              borderColor: 'rgba(30, 64, 175, 0.25)',
              background:
                'linear-gradient(160deg, rgba(229, 232, 255, 0.7), rgba(251, 253, 255, 0.96))',
              boxShadow: '0 16px 28px rgba(7, 24, 72, 0.12)',
            },
          }}
        >
          <Stack gap="md">
            <Title order={3} size="h4" c="blue.9">
              {highlight.title}
            </Title>
            <Text c="gray.7">{highlight.summary}</Text>
            {highlight.points && highlight.points.length > 0 ? (
              <List spacing={6} size="sm" c="gray.6">
                {highlight.points.map((point) => (
                  <List.Item key={point}>{point}</List.Item>
                ))}
              </List>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
