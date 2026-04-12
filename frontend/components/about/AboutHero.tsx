'use client';

import {
  Badge,
  Box,
  Container,
  Grid,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Image,
} from '@mantine/core';

type HeroStat = {
  label: string;
  value: string;
  description?: string;
};

type HeroImage = {
  src: string;
  alt: string;
  caption?: string;
};

type AboutHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  stats?: HeroStat[];
  image?: HeroImage;
  images?: HeroImage[];
};

export function AboutHero({
  eyebrow,
  title,
  description,
  stats = [],
  image,
  images,
}: AboutHeroProps) {
  const mediaItems =
    images && images.length > 0 ? images : image ? [image] : [];

  return (
    <Box
      py={{ base: 72, md: 96 }}
      style={{
        background:
          'linear-gradient(140deg, rgba(0, 76, 153, 0.95), rgba(8, 36, 71, 0.92))',
      }}
    >
      <Container size="lg">
        <Grid gutter={{ base: 40, md: 64 }} align="center">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              {eyebrow ? (
                <Badge
                  variant="light"
                  color="cyan.3"
                  size="md"
                  radius="sm"
                  fw={600}
                  px="sm"
                  styles={{ root: { width: 'fit-content' } }}
                >
                  {eyebrow}
                </Badge>
              ) : null}

              <Stack gap="sm">
                <Title order={1} size="h1" c="white" fw={800}>
                  {title}
                </Title>
                {description ? (
                  <Text size="lg" c="rgba(255,255,255,0.85)" maw={520}>
                    {description}
                  </Text>
                ) : null}
              </Stack>

              {stats.length > 0 ? (
                <SimpleGrid
                  cols={{ base: 1, sm: Math.min(2, stats.length) }}
                  spacing="lg"
                >
                  {stats.map((stat) => (
                    <Paper
                      key={stat.label}
                      radius="lg"
                      p="lg"
                      withBorder
                      styles={{
                        root: {
                          borderColor: 'rgba(120, 190, 255, 0.35)',
                          background:
                            'linear-gradient(150deg, rgba(255,255,255,0.08), rgba(173, 216, 255, 0.05))',
                          backdropFilter: 'blur(12px)',
                        },
                      }}
                    >
                      <Stack gap={4}>
                        <Text size="3xl" fw={700} c="white" lh={1}>
                          {stat.value}
                        </Text>
                        <Text fw={600} c="blue.1">
                          {stat.label}
                        </Text>
                        {stat.description ? (
                          <Text size="sm" c="rgba(255,255,255,0.7)">
                            {stat.description}
                          </Text>
                        ) : null}
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              ) : null}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper
              radius="xl"
              p="md"
              withBorder
              styles={{
                root: {
                  position: 'relative',
                  borderColor: 'rgba(140, 200, 255, 0.35)',
                  background:
                    'linear-gradient(160deg, rgba(6, 27, 54, 0.92), rgba(9, 44, 92, 0.78))',
                  boxShadow: '0 32px 64px rgba(5, 24, 54, 0.4)',
                  overflow: 'hidden',
                },
              }}
            >
              <Box
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(100% 100% at 20% 20%, rgba(56, 189, 248, 0.28), transparent)',
                  pointerEvents: 'none',
                }}
              />

              {mediaItems.length > 0 ? (
                <Stack gap="md" pos="relative" style={{ zIndex: 1 }}>
                  <SimpleGrid
                    cols={{ base: 1, sm: Math.min(2, mediaItems.length) }}
                    spacing="md"
                    style={{ alignItems: 'stretch' }}
                  >
                    {mediaItems.map((item) => (
                      <Stack
                        key={item.src}
                        gap="xs"
                        style={{
                          height: '100%',
                          backgroundColor: 'rgba(4, 18, 42, 0.6)',
                          borderRadius: 18,
                          overflow: 'hidden',
                          border: '1px solid rgba(140, 200, 255, 0.2)',
                          boxShadow: '0 24px 48px rgba(8, 26, 58, 0.25)',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Image
                          src={item.src}
                          alt={item.alt}
                          radius={0}
                          fit="cover"
                          h={320}
                          w="100%"
                        />
                        {item.caption ? (
                          <Text
                            size="sm"
                            c="rgba(255,255,255,0.72)"
                            px="md"
                            pb="md"
                            style={{ minHeight: 72 }}
                          >
                            {item.caption}
                          </Text>
                        ) : null}
                      </Stack>
                    ))}
                  </SimpleGrid>
                </Stack>
              ) : (
                <Stack gap="sm" pos="relative" style={{ zIndex: 1 }}>
                  <Title order={3} size="h3" c="blue.1">
                    Data-driven pipeline
                  </Title>
                  <Text c="rgba(255,255,255,0.75)">
                    Integrated annotation, model training, and evaluation
                    workflow tailored for vertebral fracture detection.
                  </Text>
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
}
