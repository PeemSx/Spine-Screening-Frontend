'use client';
import Link from 'next/link';
import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Image
} from '@mantine/core';
import {
  IconBrain,
  IconShieldCheck,
  IconZoomIn,
} from '@tabler/icons-react';

export default function Home() {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        style={{
          background:
            'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)',
        }}
        py={{ base: 80, md: 120 }}
      >
        <Container size="lg">
          <Stack gap="xl" align="flex-start">
            <div>
              <Title
                order={1}
                size='h2'
                c="white"
                fw={800}
                mb="md"
              >
                Detect Vertebral Fractures with AI
              </Title>
              <Text
                size='lg'
                c="rgba(255, 255, 255, 0.9)"
                maw={600}
              >
                Advanced AI-powered detection system for osteoporotic vertebral
                compression fractures (OVCF) using AP and LA X-ray imaging.
                Quick, accurate, and designed for medical professionals.
              </Text>
            </div>

            <Group gap="md">
              <Button
                component={Link}
                href="/ap"
                size="lg"
                bg="white"
                c="blue.7"
                fw={600}
              >
                Try AP Detection
              </Button>
              <Button
                component={Link}
                href="/la"
                size="lg"
                variant="outline"
                c="white"
                fw={600}
                style={{ borderColor: 'white' }}
              >
                Try LA Detection
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Features Section */}
      <Box py={{ base: 60, md: 100 }} >
        <Container size="lg">
          <Stack gap="xl" align="center" mb={60}>
            <Title order={2} ta="center" size="h2">
              Why Choose OVCF Detector?
            </Title>
            <Divider w={80} size="md" color="blue.6" />
          </Stack>

          <Grid gutter={{ base: 30, md: 50 }}>
            {/* Feature 1 */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Stack gap="md" align="center" ta="center">
                <ThemeIcon
                  size={60}
                  radius="md"
                  variant="light"
                  color="blue"
                >
                  <IconBrain size={32} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg" mb="xs">
                    AI-Powered
                  </Text>
                  <Text c="gray.6" size="sm">
                    State-of-the-art deep learning model trained on extensive
                    medical imaging data for reliable detection.
                  </Text>
                </div>
              </Stack>
            </Grid.Col>

            {/* Feature 2 */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Stack gap="md" align="center" ta="center">
                <ThemeIcon
                  size={60}
                  radius="md"
                  variant="light"
                  color="blue"
                >
                  <IconZoomIn size={32} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg" mb="xs">
                    High Accuracy
                  </Text>
                  <Text c="gray.6" size="sm">
                    Detects subtle fractures with precision using both AP and
                    lateral X-ray views for comprehensive analysis.
                  </Text>
                </div>
              </Stack>
            </Grid.Col>

            {/* Feature 3 */}
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Stack gap="md" align="center" ta="center">
                <ThemeIcon
                  size={60}
                  radius="md"
                  variant="light"
                  color="blue"
                >
                  <IconShieldCheck size={32} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg" mb="xs">
                    Clinical Grade
                  </Text>
                  <Text c="gray.6" size="sm">
                    Developed and validated by medical research professionals
                    for clinical and research applications.
                  </Text>
                </div>
              </Stack>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Box py={{ base: 60, md: 100 }}>
        <Container size="lg">
          <Stack gap="xl" align="center" mb={60}>
            <Title order={2} ta="center" size="h2">
              How It Works
            </Title>
            <Divider w={80} size="md" color="blue.6" />
          </Stack>

          <Grid gutter={{ base: 30, md: 50 }}>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="lg">
                {[
                  {
                    num: '1',
                    title: 'Upload X-ray Image',
                    desc: 'Select your AP or LA X-ray image in supported formats.',
                  },
                  {
                    num: '2',
                    title: 'AI Analysis',
                    desc: 'Our model processes the image and identifies potential fractures.',
                  },
                  {
                    num: '3',
                    title: 'View Results',
                    desc: 'Get instant detection results with confidence scores and visualizations.',
                  },
                ].map((step) => (
                  <Group key={step.num} gap="md" align="flex-start">
                    <ThemeIcon
                      size={40}
                      radius="md"
                      color="blue.6"
                      fw={700}
                    >
                      {step.num}
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={600}>{step.title}</Text>
                      <Text c="gray.6" size="sm">
                        {step.desc}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Box
                bg="blue.0"
                p="xl"
                style={{
                  minHeight: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Stack gap="md" align="center" ta="center">
                      <Image
                        radius="md"
                        src="images/examples/ap/heatmap_sample.jpg"
                        alt="Sample AP X-ray heatmap"
                        fit="contain"
                        h={220}
                        w={200}
                      />
                </Stack>
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        style={{
          background:
            'linear-gradient(135deg, #0052a3 0%, #003d7a 100%)',
        }}
        py={{ base: 60, md: 80 }}
      >
        <Container size="lg">
          <Stack gap="lg" align="center" ta="center">
            <div>
              <Title order={2} c="white" mb="md" size="h2">
                Ready to Get Started?
              </Title>
              <Text c="rgba(255, 255, 255, 0.9)" size="lg" maw={500}>
                Try our OVCF detection system with your own X-ray images.
              </Text>
            </div>

            <Group gap="md">
              <Button
                component={Link}
                href="/ap"
                size="lg"
                bg="white"
                c="blue.7"
                fw={600}
              >
                AP Detection
              </Button>
              <Button
                component={Link}
                href="/la"
                size="lg"
                bg="white"
                c="blue.7"
                fw={600}
              >
                LA Detection
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box bg="gray.8" py="lg">
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Text c="gray.4" size="sm">
              © 2025 OVCF Detector. Research project.
            </Text>
            <Group gap="md">
              <Button
                component={Link}
                href="/about"
                variant="subtle"
                c="gray.4"
                size="xs"
              >
                About
              </Button>
              <Button
                component={Link}
                href="/contact"
                variant="subtle"
                c="gray.4"
                size="xs"
              >
                Contact
              </Button>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
