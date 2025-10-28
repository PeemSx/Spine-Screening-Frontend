import { Card, Image, Stack, Title, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";

export function ResultImageCard({
  icon,
  title,
  src,
  caption,
}: {
  icon: ReactNode;
  title: string;
  src: string;
  caption?: string;
}) {
  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack align="center" gap="xs">
        <ThemeIcon size={28} radius="xl" variant="light" color="blue">
          {icon}
        </ThemeIcon>
        <Title order={4}>{title}</Title>
        {
          !src ? (
            <Text size="sm" c="dimmed" ta="center">
              No image available
            </Text>
          ) : (
            <Image src={src} alt={title} radius="md" fit="contain" maw="100%" />
          )
        }
        {caption && (
          <Text size="sm" c="dimmed" ta="center">
            {caption}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
