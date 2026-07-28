"use client";

import {
  Badge,
  Card,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useEffect, useRef } from "react";
import type { MorphologyFeature, VertebraPrediction } from "../api/generated";
import type { PredictionStatus } from "../types";
import {
  analyzeMorphology,
  type DetectorReliability,
  type MorphologyAssessment,
  type MorphologySignalStatus,
  type NeighborReferenceIssue,
} from "../morphology/analysis";

interface MeasurementsPanelProps {
  morphology: readonly MorphologyFeature[];
  vertebrae: readonly VertebraPrediction[];
  status: PredictionStatus;
  selectedCandidateId: number | null;
  onSelectCandidate: (candidateId: number) => void;
}

const STATUS_LABELS: Record<MorphologySignalStatus, string> = {
  not_assessable: "Not assessable",
  no_morphology_signal: "No morphology signal",
  borderline_morphology_signal: "Borderline morphology signal",
  suspicious_morphology_signal: "Suspicious morphology signal",
  high_priority_morphology_signal: "High-priority morphology signal",
  marked_height_change: "Marked height change",
};

const STATUS_COLORS: Record<MorphologySignalStatus, string> = {
  not_assessable: "gray",
  no_morphology_signal: "cyan",
  borderline_morphology_signal: "yellow",
  suspicious_morphology_signal: "yellow",
  high_priority_morphology_signal: "orange",
  marked_height_change: "red",
};

const RELIABILITY_LABELS: Record<DetectorReliability, string> = {
  not_assessable: "Not assessable",
  low: "Low",
  acceptable: "Acceptable",
  high: "High",
};

const RELIABILITY_COLORS: Record<DetectorReliability, string> = {
  not_assessable: "gray",
  low: "yellow",
  acceptable: "blue",
  high: "green",
};

const REFERENCE_ISSUE_LABELS: Record<NeighborReferenceIssue, string> = {
  edge_vertebra: "A vertebra above and below is required",
  missing_landmarks: "Neighbor landmarks are unavailable",
  low_confidence_neighbor: "A neighbor score is below 0.18",
  skipped_vertebra_suspected: "Spacing suggests a skipped vertebra",
  unstable_neighbor_reference: "The neighbor reference is unstable",
};

function px(value: number | null) {
  return value === null ? "Not calculated" : `${value.toFixed(1)} px`;
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function heightChangeLabel(value: number | null) {
  if (value === null) return "Not calculated";
  if (Math.abs(value) < 0.0005) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${percent(value)}`;
}

function isMorphologySignal(status: MorphologySignalStatus) {
  return status !== "no_morphology_signal" && status !== "not_assessable";
}

function SelectedAssessment({ assessment }: { assessment: MorphologyAssessment }) {
  const referenceIssue = assessment.heightChangeUnavailableReason
    ? REFERENCE_ISSUE_LABELS[assessment.heightChangeUnavailableReason]
    : null;
  const statusColor = STATUS_COLORS[assessment.status];

  return (
    <Paper
      bg="var(--mantine-color-blue-light)"
      mih={238}
      p="sm"
      radius="md"
    >
      <Stack gap="sm">
        <Text fw={700}>Detected vertebra {assessment.rank}</Text>

        <Group align="flex-start" grow>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">Mean height</Text>
            <Text fw={700} size="sm">{px(assessment.currentHeightPx)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">Neighbor reference</Text>
            <Text fw={700} size="sm">{px(assessment.referenceHeightPx)}</Text>
          </Stack>
        </Group>

        <Group align="flex-start" grow>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">Height change</Text>
            <Text fw={700} size="sm">{heightChangeLabel(assessment.heightChange)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">Left/right asymmetry</Text>
            <Text fw={700} size="sm">{percent(assessment.asymmetry)}</Text>
          </Stack>
        </Group>

        <Text c="dimmed" size="xs">
          Left {px(assessment.leftHeightPx)} · Right {px(assessment.rightHeightPx)}
        </Text>

        <Text c="dimmed" mih={34} size="xs">
          {referenceIssue
            ? `Height change not calculated: ${referenceIssue}.`
            : "\u00a0"}
        </Text>

        <Group gap="xs" wrap="wrap">
          <Badge color={statusColor} size="xs" variant="light">
            {STATUS_LABELS[assessment.status]}
          </Badge>
          <Badge
            color={RELIABILITY_COLORS[assessment.reliability]}
            size="xs"
            variant="dot"
          >
            Reliability: {RELIABILITY_LABELS[assessment.reliability]} · score {assessment.detectorScore.toFixed(2)}
          </Badge>
        </Group>
      </Stack>
    </Paper>
  );
}

export function MeasurementsPanel({
  morphology,
  vertebrae,
  status,
  selectedCandidateId,
  onSelectCandidate,
}: MeasurementsPanelProps) {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const assessmentRows = useRef(new Map<number, HTMLButtonElement>());
  const assessments = analyzeMorphology(morphology, vertebrae);
  const selected =
    assessments.find(
      (assessment) => assessment.candidateId === selectedCandidateId,
    ) ?? assessments[0] ?? null;
  const maximumHeight = Math.max(
    1,
    ...assessments.map((assessment) => assessment.currentHeightPx),
  );

  useEffect(() => {
    if (selectedCandidateId === null) return;

    const viewport = scrollViewportRef.current;
    const selectedRow = assessmentRows.current.get(selectedCandidateId);
    if (!viewport || !selectedRow) return;

    const viewportBounds = viewport.getBoundingClientRect();
    const rowBounds = selectedRow.getBoundingClientRect();
    const centeredScrollTop =
      viewport.scrollTop +
      rowBounds.top -
      viewportBounds.top -
      (viewportBounds.height - rowBounds.height) / 2;

    viewport.scrollTo({
      behavior: "smooth",
      top: Math.max(0, centeredScrollTop),
    });
  }, [selectedCandidateId, assessments.length]);

  return (
    <Card withBorder radius="md" p="md" shadow="sm" h="100%">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4}>Vertebral height morphology</Title>
            <Text c="dimmed" size="xs">
              Within-image pixel geometry, ordered from top to bottom
            </Text>
          </Stack>
          {assessments.length > 0 ? (
            <Badge variant="light">{assessments.length} vertebrae</Badge>
          ) : null}
        </Group>

        {status === "submitting" ? (
          <Stack align="center" justify="center" mih={320}>
            <Loader />
            <Text c="dimmed" size="sm">
              Calculating vertebral height measurements…
            </Text>
          </Stack>
        ) : selected ? (
          <>
            <SelectedAssessment assessment={selected} />

            <ScrollArea.Autosize
              mah={520}
              offsetScrollbars
              viewportRef={scrollViewportRef}
            >
              <Stack gap="xs" pr="xs">
                {assessments.map((assessment) => {
                  const isSelected = assessment.candidateId === selected.candidateId;
                  const hasSignal = isMorphologySignal(assessment.status);
                  const barColor =
                    hasSignal ? "yellow" : isSelected ? "blue" : "cyan";

                  return (
                    <UnstyledButton
                      aria-label={`Detected vertebra ${assessment.rank}, ${STATUS_LABELS[assessment.status]}, ${RELIABILITY_LABELS[assessment.reliability]} reliability`}
                      aria-pressed={isSelected}
                      key={assessment.candidateId}
                      onClick={() => onSelectCandidate(assessment.candidateId)}
                      ref={(element) => {
                        if (element) {
                          assessmentRows.current.set(assessment.candidateId, element);
                        } else {
                          assessmentRows.current.delete(assessment.candidateId);
                        }
                      }}
                      style={{ width: "100%" }}
                    >
                      <Paper
                        bg={
                          isSelected
                            ? hasSignal
                              ? "var(--mantine-color-yellow-light)"
                              : "var(--mantine-color-blue-light)"
                            : undefined
                        }
                        p="sm"
                        radius="md"
                        style={{
                          borderColor: isSelected && hasSignal
                            ? "var(--mantine-color-yellow-6)"
                            : undefined,
                        }}
                        withBorder
                      >
                        <Stack gap={7}>
                          <Group justify="space-between" gap="xs">
                            <Text fw={700} size="sm">
                              Detected vertebra {assessment.rank}
                            </Text>
                            <Text fw={700} size="sm">
                              {px(assessment.currentHeightPx)}
                            </Text>
                          </Group>

                          <Progress
                            color={barColor}
                            radius="xl"
                            size={8}
                            value={Math.min(
                              100,
                              (assessment.currentHeightPx / maximumHeight) * 100,
                            )}
                          />

                          <Group justify="space-between" gap="xs" wrap="wrap">
                            <Text c="dimmed" size="xs">
                              Left {assessment.leftHeightPx.toFixed(1)} px · Right {assessment.rightHeightPx.toFixed(1)} px
                            </Text>
                            <Text c="dimmed" size="xs">
                              Change {heightChangeLabel(assessment.heightChange)} · Asymmetry {percent(assessment.asymmetry)}
                            </Text>
                          </Group>
                        </Stack>
                      </Paper>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          </>
        ) : (
          <Stack align="center" justify="center" mih={320}>
            <Text c="dimmed" ta="center">
              Run screening to review vertebral height measurements.
            </Text>
          </Stack>
        )}

        <Text c="dimmed" mt="auto" size="xs">
          Heights are measured in image pixels, not millimeters. Yellow, orange,
          and red rows indicate morphology screening signals; detector reliability
          is reported separately and is not a fracture probability.
        </Text>
      </Stack>
    </Card>
  );
}
