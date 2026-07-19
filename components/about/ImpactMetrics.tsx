'use client';

import { Card, SimpleGrid, Stack, Text } from '@mantine/core';

export type ImpactMetric = {
  label: string;
  value: string;
  description?: string;
};

type ImpactMetricsProps = {
  metrics: ImpactMetric[];
};

export function ImpactMetrics({ metrics }: ImpactMetricsProps) {
  return (
    <SimpleGrid
      cols={{ base: 1, sm: Math.min(2, metrics.length), md: Math.min(3, metrics.length) }}
      spacing={{ base: 'lg', md: 'xl' }}
    >
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          radius="lg"
          p="xl"
          withBorder
          styles={{
            root: {
              borderColor: 'rgba(37, 99, 235, 0.25)',
              background:
                'linear-gradient(160deg, rgba(229, 237, 255, 0.65), rgba(255, 255, 255, 0.94))',
              boxShadow: '0 18px 34px rgba(14, 36, 74, 0.12)',
            },
          }}
        >
          <Stack gap={4}>
            <Text size="xl" fw={700} c="blue.7" lh={1}>
              {metric.value}
            </Text>
            <Text fw={600} c="blue.9">
              {metric.label}
            </Text>
            {metric.description ? (
              <Text size="sm" c="gray.7">
                {metric.description}
              </Text>
            ) : null}
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
