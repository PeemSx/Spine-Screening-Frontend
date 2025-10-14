'use client';

import { Card, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ElementType } from 'react';

type IconComponent = ElementType<{ size?: number; stroke?: number }>;

export type ValueItem = {
  title: string;
  description: string;
  icon?: IconComponent;
};

type ValueGridProps = {
  items: ValueItem[];
  columns?: number;
};

export function ValueGrid({ items, columns = 3 }: ValueGridProps) {
  return (
    <SimpleGrid
      cols={{ base: 1, sm: Math.min(2, columns), md: Math.min(columns, items.length) }}
      spacing={{ base: 'lg', md: 'xl' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.title}
            radius="lg"
            p="xl"
            withBorder
            styles={{
              root: {
                height: '100%',
                borderColor: 'rgba(59, 130, 246, 0.25)',
                background:
                  'linear-gradient(160deg, rgba(229, 242, 255, 0.55), rgba(244, 248, 255, 0.9))',
                boxShadow: '0 18px 32px rgba(15, 40, 80, 0.16)',
              },
            }}
          >
            <Stack gap="md">
              {Icon ? (
                <ThemeIcon
                  radius="md"
                  size="lg"
                  variant="light"
                  color="blue"
                >
                  <Icon size={20} stroke={1.8} />
                </ThemeIcon>
              ) : null}
              <Stack gap={6}>
                <Title order={3} size="h4">
                  {item.title}
                </Title>
                <Text c="gray.7">{item.description}</Text>
              </Stack>
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
