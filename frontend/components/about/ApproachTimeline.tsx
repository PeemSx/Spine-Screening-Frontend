'use client';

import { Card, Stack, Text, Timeline } from '@mantine/core';

export type ApproachStep = {
  title: string;
  description: string;
  detail?: string;
};

type ApproachTimelineProps = {
  steps: ApproachStep[];
};

export function ApproachTimeline({ steps }: ApproachTimelineProps) {
  return (
    <Timeline
      active={steps.length}
      bulletSize={24}
      color="blue.6"
      lineWidth={2}
    >
      {steps.map((step) => (
        <Timeline.Item key={step.title} title={step.title}>
          <Card
            radius="md"
            mt="sm"
            p="lg"
            withBorder
            styles={{
              root: {
                borderColor: 'rgba(59, 130, 246, 0.25)',
                background:
                  'linear-gradient(150deg, rgba(240, 247, 255, 0.75), rgba(255, 255, 255, 0.95))',
                boxShadow: '0 12px 24px rgba(11, 34, 74, 0.12)',
              },
            }}
          >
            <Stack gap={6}>
              <Text c="gray.7">{step.description}</Text>
              {step.detail ? (
                <Text size="sm" c="gray.6">
                  {step.detail}
                </Text>
              ) : null}
            </Stack>
          </Card>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
