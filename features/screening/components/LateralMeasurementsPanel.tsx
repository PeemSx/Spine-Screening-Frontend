"use client";

import {
  ActionIcon,
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
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  type LACobbResult,
  type LACompressionAssessment,
  type LAVertebraPrediction,
} from "../api/contract";
import type { PredictionStatus } from "../types";

interface LateralMeasurementsPanelProps {
  cobb: LACobbResult | null;
  compressionAssessments?: readonly LACompressionAssessment[];
  onSelectCandidate: (candidateId: number) => void;
  selectedCandidateId: number | null;
  status: PredictionStatus;
  vertebrae: readonly LAVertebraPrediction[];
}

function angle(value: number | null) {
  return value === null ? "Not calculated" : `${value.toFixed(1)}°`;
}

function measurement(value: number | null | undefined, suffix = "") {
  return value == null ? "—" : `${value.toFixed(1)}${suffix}`;
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

const HEIGHT_METRICS = [
  {
    key: "anterior",
    label: "Anterior height",
    description:
      "Euclidean distance between the upper and lower image-left landmarks. The current orientation convention treats image-left as anterior.",
  },
  {
    key: "middle",
    label: "Middle height",
    description:
      "Euclidean distance between the upper-middle and lower-middle landmarks of the selected vertebral body.",
  },
  {
    key: "posterior",
    label: "Posterior height",
    description:
      "Euclidean distance between the upper and lower image-right landmarks. The current orientation convention treats image-right as posterior.",
  },
] as const;

const RATIO_METRICS = [
  {
    key: "anterior_posterior",
    label: "Anterior / posterior ratio",
    description:
      "Anterior height divided by posterior height (HA / HP). A value below 1 means the anterior side is shorter than the posterior side.",
  },
  {
    key: "middle_anterior",
    label: "Middle / anterior ratio",
    description:
      "Middle height divided by anterior height (HM / HA). A value below 1 means the middle is shorter than the anterior side.",
  },
  {
    key: "middle_posterior",
    label: "Middle / posterior ratio",
    description:
      "Middle height divided by posterior height (HM / HP). A value below 1 means the middle is shorter than the posterior side.",
  },
] as const;

function InfoTooltip({ name, description }: { name: string; description: string }) {
  return (
    <Tooltip label={description} multiline w={300} withArrow>
      <ActionIcon
        aria-label={`Explain ${name}`}
        color="gray"
        size="xs"
        variant="subtle"
      >
        <IconInfoCircle aria-hidden="true" size={14} stroke={1.8} />
      </ActionIcon>
    </Tooltip>
  );
}

function MetricLabel({ name, description }: { name: string; description: string }) {
  return (
    <Group gap={3} wrap="nowrap">
      <Text c="dimmed" size="xs">{name}</Text>
      <InfoTooltip description={description} name={name} />
    </Group>
  );
}

export function LateralMeasurementsPanel({
  cobb,
  compressionAssessments = [],
  onSelectCandidate,
  selectedCandidateId,
  status,
  vertebrae,
}: LateralMeasurementsPanelProps) {
  const selected =
    vertebrae.find(
      (vertebra) => vertebra.candidate_id === selectedCandidateId,
    ) ?? vertebrae[0] ?? null;
  const selectedAssessment = selected
    ? compressionAssessments.find(
        (assessment) => assessment.candidate_id === selected.candidate_id,
      ) ?? null
    : null;

  return (
    <Card withBorder radius="md" p="md" shadow="sm" h="100%">
      <Stack gap="md" h="100%">
        <Group align="flex-start" justify="space-between">
          <Stack gap={2}>
            <Title order={4}>Lateral curvature geometry</Title>
            <Text c="dimmed" size="xs">
              Six-keypoint research measurements in original-image pixels
            </Text>
          </Stack>
          {vertebrae.length > 0 ? (
            <Badge variant="light">{vertebrae.length} vertebrae</Badge>
          ) : null}
        </Group>

        {status === "submitting" ? (
          <Stack align="center" justify="center" mih={320}>
            <Loader />
            <Text c="dimmed" size="sm">Calculating LA geometry…</Text>
          </Stack>
        ) : cobb ? (
          <>
            <Paper p="sm" radius="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Four-outer-landmark curvature</Text>
                  <Badge color={cobb.valid ? "blue" : "gray"} variant="light">
                    {cobb.valid ? "Calculated" : "Not calculated"}
                  </Badge>
                </Group>
                <SimpleGrid cols={3} spacing="xs">
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Curve 1</Text>
                    <Text fw={700}>{angle(cobb.cobb_1_deg)}</Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Curve 2</Text>
                    <Text fw={700}>{angle(cobb.cobb_2_deg)}</Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text c="dimmed" size="xs">Curve 3</Text>
                    <Text fw={700}>{angle(cobb.cobb_3_deg)}</Text>
                  </Stack>
                </SimpleGrid>
                <Text c="dimmed" size="xs">
                  {cobb.scope}
                </Text>
              </Stack>
            </Paper>

            <Divider />

            <Paper p="sm" radius="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>Selected vertebra morphometry</Text>
                  {selectedAssessment ? (
                    <Badge
                      color={selectedAssessment.suspicious ? "yellow" : "blue"}
                      variant="light"
                    >
                      {selectedAssessment.suspicious ? "Review flag" : "Research measure"}
                    </Badge>
                  ) : null}
                </Group>
                {selectedAssessment ? (
                  <>
                    <Group gap={3} wrap="nowrap">
                      <Text c="dimmed" size="xs">
                        Candidate {selectedAssessment.candidate_id} · {label(selectedAssessment.assessment_status)} · {label(selectedAssessment.reference_status)} reference
                      </Text>
                      <InfoTooltip
                        description="Reference status describes the adjacent comparison: bilateral uses eligible vertebrae above and below, single uses one eligible neighbor, and unavailable means no reliable adjacent reference was found."
                        name="reference status"
                      />
                    </Group>
                    <SimpleGrid cols={3} spacing="xs">
                      {HEIGHT_METRICS.map((metric) => (
                        <Stack gap={0} key={metric.key}>
                          <MetricLabel description={metric.description} name={metric.label} />
                          <Text fw={700}>{measurement(selectedAssessment.heights[metric.key], " px")}</Text>
                        </Stack>
                      ))}
                    </SimpleGrid>
                    <SimpleGrid cols={3} spacing="xs">
                      {RATIO_METRICS.map((metric) => (
                        <Stack gap={0} key={metric.key}>
                          <MetricLabel description={metric.description} name={metric.label} />
                          <Text fw={700}>{measurement(selectedAssessment.ratios[metric.key])}</Text>
                        </Stack>
                      ))}
                    </SimpleGrid>
                    <SimpleGrid cols={2} spacing="xs">
                      <Stack gap={0}>
                        <MetricLabel
                          description="For anterior, middle, and posterior positions: (1 − current height / adjacent reference height) × 100. Positive values mean shorter than the reference; negative values mean taller."
                          name="Signed compression (A / M / P)"
                        />
                        <Text fw={700}>
                          {(["anterior", "middle", "posterior"] as const)
                            .map((part) => measurement(selectedAssessment.compression_rates[part], "%"))
                            .join(" / ")}
                        </Text>
                      </Stack>
                      <Stack gap={0}>
                        <MetricLabel
                          description="The reported percentage height reduction among the anterior, middle, and posterior measurements. It may use an intra-vertebral comparison when adjacent references are unavailable and drives the displayed severity range and review flag."
                          name="Maximum reduction"
                        />
                        <Text fw={700}>{measurement(selectedAssessment.max_height_reduction, "%")}</Text>
                      </Stack>
                    </SimpleGrid>
                    <Group gap="xs" wrap="wrap">
                      <Group gap={3} wrap="nowrap">
                        <Text size="sm">Morphology: <strong>{label(selectedAssessment.morphology)}</strong></Text>
                        <InfoTooltip
                          description="The predominant geometric pattern: wedge indicates anterior loss, biconcave indicates middle loss, crush requires loss across all three positions, and indeterminate means the pattern is unresolved."
                          name="morphology"
                        />
                      </Group>
                      <Text c="dimmed" size="sm">·</Text>
                      <Group gap={3} wrap="nowrap">
                        <Text size="sm">Severity range: <strong>{label(selectedAssessment.severity)}</strong></Text>
                        <InfoTooltip
                          description="Morphometric height-loss ranges: below 20% no significant loss, 20–25% mild, above 25–40% moderate, and above 40% severe."
                          name="severity range"
                        />
                      </Group>
                    </Group>
                  </>
                ) : (
                  <Text c="dimmed" size="sm">No assessment is available for the selected candidate.</Text>
                )}
              </Stack>
            </Paper>

            <ScrollArea.Autosize mah={520} offsetScrollbars>
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
                        p="sm"
                        radius="md"
                        withBorder
                      >
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text fw={700} size="sm">
                              Detected vertebra {vertebra.rank}
                            </Text>
                            <Text fw={700} size="sm">
                              {vertebra.detector_score.toFixed(2)}
                            </Text>
                          </Group>
                          <Text c="dimmed" size="xs">
                            Six landmarks · detector score
                          </Text>
                        </Stack>
                      </Paper>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>

            <Text c="dimmed" mt="auto" size="xs">
              Coordinates and geometry are reported in image pixels. Detector
              scores describe landmark localization confidence and are not a
              probability of a clinical finding.
            </Text>
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
