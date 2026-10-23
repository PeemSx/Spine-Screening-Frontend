"use client";

import {
  Badge,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  LA_KEYPOINT_ORDER,
  type LACobbResult,
  type LAVertebraPrediction,
} from "../api/contract";
import type { PredictionStatus } from "../types";

interface LateralMeasurementsPanelProps {
  cobb: LACobbResult | null;
  onSelectCandidate: (candidateId: number) => void;
  selectedCandidateId: number | null;
  status: PredictionStatus;
  vertebrae: readonly LAVertebraPrediction[];
}

function angle(value: number | null) {
  return value === null ? "Not calculated" : `${value.toFixed(1)}°`;
}

function landmarkLabel(value: (typeof LA_KEYPOINT_ORDER)[number]) {
  return value.replace("_", " ");
}

export function LateralMeasurementsPanel({
  cobb,
  onSelectCandidate,
  selectedCandidateId,
  status,
  vertebrae,
}: LateralMeasurementsPanelProps) {
  const selected =
    vertebrae.find(
      (vertebra) => vertebra.candidate_id === selectedCandidateId,
    ) ?? vertebrae[0] ?? null;

  return (
    <Card withBorder radius="md" p="md" shadow="sm" h="100%">
      <Stack gap="md" h="100%">
        <Stack gap={2}>
          <Title order={4}>Lateral geometry assessment</Title>
          <Text c="dimmed" size="xs">
            Six-keypoint research measurements in original-image pixels
          </Text>
        </Stack>

        {status === "submitting" ? (
          <Stack align="center" justify="center" mih={320}>
            <Loader />
            <Text c="dimmed" size="sm">Calculating LA geometry…</Text>
          </Stack>
        ) : cobb ? (
          <>
            <Paper bg="var(--mantine-color-blue-light)" p="sm" radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Four-outer-landmark agreement</Text>
                  <Badge color={cobb.valid ? "blue" : "gray"} variant="light">
                    {cobb.valid ? "Calculated" : "Not calculated"}
                  </Badge>
                </Group>
                <SimpleGrid cols={3} spacing="xs">
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Primary</Text>
                    <Text fw={700}>{angle(cobb.cobb_1_deg)}</Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Secondary</Text>
                    <Text fw={700}>{angle(cobb.cobb_2_deg)}</Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Tertiary</Text>
                    <Text fw={700}>{angle(cobb.cobb_3_deg)}</Text>
                  </Stack>
                </SimpleGrid>
                <Text c="dimmed" size="xs">
                  {cobb.scope}
                </Text>
              </Stack>
            </Paper>

            {selected ? (
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={700}>Detected vertebra {selected.rank}</Text>
                    <Badge variant="outline">
                      score {selected.detector_score.toFixed(2)}
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                    {LA_KEYPOINT_ORDER.map((name) => {
                      const point = selected.keypoints[name];
                      return (
                        <Stack gap={0} key={name}>
                          <Text c="dimmed" size="xs" tt="capitalize">
                            {landmarkLabel(name)}
                          </Text>
                          <Text ff="monospace" size="xs">
                            {point.x.toFixed(1)}, {point.y.toFixed(1)}
                          </Text>
                        </Stack>
                      );
                    })}
                  </SimpleGrid>
                </Stack>
              </Paper>
            ) : null}

            <Divider />

            <ScrollArea.Autosize mah={300} offsetScrollbars>
              <Stack gap="xs" pr="xs">
                {vertebrae.map((vertebra) => {
                  const isSelected =
                    vertebra.candidate_id === selected?.candidate_id;
                  return (
                    <UnstyledButton
                      aria-label={`Detected lateral vertebra ${vertebra.rank}, score ${vertebra.detector_score.toFixed(2)}`}
                      aria-pressed={isSelected}
                      key={vertebra.candidate_id}
                      onClick={() => onSelectCandidate(vertebra.candidate_id)}
                    >
                      <Paper
                        bg={isSelected ? "var(--mantine-color-blue-light)" : undefined}
                        p="xs"
                        radius="md"
                        withBorder
                      >
                        <Group justify="space-between">
                          <Text fw={600} size="sm">Vertebra {vertebra.rank}</Text>
                          <Text c="dimmed" size="xs">
                            detector score {vertebra.detector_score.toFixed(2)}
                          </Text>
                        </Group>
                      </Paper>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          </>
        ) : (
          <Stack align="center" justify="center" mih={320}>
            <Text c="dimmed" size="sm" ta="center">
              Run the lateral assessment to review six-keypoint geometry.
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
