'use client';

import { Divider, Stack, Text, Title } from '@mantine/core';

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  align?: 'left' | 'center';
  withDivider?: boolean;
  maxWidth?: number;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  align = 'center',
  withDivider = true,
  maxWidth = 640,
}: SectionHeaderProps) {
  const isCentered = align === 'center';
  const stackAlign = isCentered ? 'center' : 'flex-start';
  const textAlign = isCentered ? 'center' : 'left';

  return (
    <Stack gap={8} align={stackAlign}>
      {eyebrow ? (
        <Text size="sm" tt="uppercase" fw={600} c="blue.6" lh={1.2}>
          {eyebrow}
        </Text>
      ) : null}

      <Title order={2} size="h2" ta={textAlign}>
        {title}
      </Title>

      {description ? (
        <Text ta={textAlign} c="gray.6" maw={maxWidth}>
          {description}
        </Text>
      ) : null}

      {withDivider ? (
        <Divider
          size="sm"
          color="blue.5"
          w={isCentered ? 72 : 48}
          mt={isCentered ? 12 : 8}
        />
      ) : null}
    </Stack>
  );
}
