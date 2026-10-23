"use client";

import {
  Badge,
  Box,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type {
  CobbLine,
  ImageInfo,
  LACobbResult,
  LAVertebraPrediction,
} from "../api/contract";
import { LA_KEYPOINT_ORDER } from "../api/contract";
import type { PredictionStatus } from "../types";

interface LateralPredictionOverlayProps {
  cobb: LACobbResult | null;
  image: ImageInfo | null;
  imageUrl: string;
  onSelectCandidate: (candidateId: number) => void;
  selectedCandidateId: number | null;
  status: PredictionStatus;
  vertebrae: readonly LAVertebraPrediction[];
}

function pointList(vertebra: LAVertebraPrediction, edge: "top" | "bottom") {
  const keypoints = vertebra.keypoints;
  const points =
    edge === "top"
      ? [keypoints.top_left, keypoints.top_middle, keypoints.top_right]
      : [keypoints.bottom_left, keypoints.bottom_middle, keypoints.bottom_right];
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function CobbLines({ lines }: { lines: readonly CobbLine[] }) {
  return lines.map((line, index) => (
    <line
      data-cobb-line="true"
      key={`${line.vertebra_candidate_id}-${index}`}
      stroke="var(--mantine-color-cyan-4)"
      strokeDasharray="8 5"
      strokeLinecap="round"
      strokeWidth={2.5}
      vectorEffect="non-scaling-stroke"
      x1={line.start.x}
      x2={line.end.x}
      y1={line.start.y}
      y2={line.end.y}
    />
  ));
}

export function LateralPredictionOverlay({
  cobb,
  image,
  imageUrl,
  onSelectCandidate,
  selectedCandidateId,
  status,
  vertebrae,
}: LateralPredictionOverlayProps) {
  const aspectRatio = image ? `${image.width} / ${image.height}` : undefined;

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Group align="flex-start" justify="space-between">
          <Stack gap={2}>
            <Title order={4}>Lateral six-landmark overlay</Title>
            <Text c="dimmed" size="xs">
              Original-image pixel coordinates; middle landmarks are shown in yellow
            </Text>
          </Stack>
          {vertebrae.length > 0 ? (
            <Badge variant="light">{vertebrae.length} vertebrae</Badge>
          ) : null}
        </Group>

        <Box
          aria-label="Lateral radiograph with six vertebral landmarks per detection"
          bg="black"
          role="group"
          style={{
            aspectRatio,
            maxHeight: "70vh",
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs need their natural raster geometry. */}
          <img
            alt="Submitted lateral radiograph"
            src={imageUrl}
            style={{
              display: "block",
              height: "100%",
              objectFit: "contain",
              width: "100%",
            }}
          />

          {image ? (
            <svg
              aria-label="LA prediction landmark overlay"
              role="img"
              preserveAspectRatio="xMidYMid meet"
              style={{ height: "100%", inset: 0, position: "absolute", width: "100%" }}
              viewBox={`0 0 ${image.width} ${image.height}`}
            >
              <CobbLines lines={cobb?.major_lines ?? []} />

              {vertebrae.map((vertebra) => {
                const selected = vertebra.candidate_id === selectedCandidateId;
                const keypoints = vertebra.keypoints;
                return (
                  <g
                    aria-label={`Detected lateral vertebra ${vertebra.rank}, six landmarks`}
                    data-candidate-id={vertebra.candidate_id}
                    key={vertebra.candidate_id}
                    onClick={() => onSelectCandidate(vertebra.candidate_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectCandidate(vertebra.candidate_id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <polyline
                      fill="none"
                      points={pointList(vertebra, "top")}
                      stroke={selected ? "var(--mantine-color-blue-3)" : "var(--mantine-color-teal-3)"}
                      strokeWidth={selected ? 3 : 2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      fill="none"
                      points={pointList(vertebra, "bottom")}
                      stroke={selected ? "var(--mantine-color-blue-3)" : "var(--mantine-color-teal-3)"}
                      strokeWidth={selected ? 3 : 2}
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      stroke={selected ? "var(--mantine-color-blue-3)" : "var(--mantine-color-teal-3)"}
                      strokeWidth={selected ? 3 : 2}
                      vectorEffect="non-scaling-stroke"
                      x1={keypoints.top_left.x}
                      x2={keypoints.bottom_left.x}
                      y1={keypoints.top_left.y}
                      y2={keypoints.bottom_left.y}
                    />
                    <line
                      stroke={selected ? "var(--mantine-color-blue-3)" : "var(--mantine-color-teal-3)"}
                      strokeWidth={selected ? 3 : 2}
                      vectorEffect="non-scaling-stroke"
                      x1={keypoints.top_right.x}
                      x2={keypoints.bottom_right.x}
                      y1={keypoints.top_right.y}
                      y2={keypoints.bottom_right.y}
                    />

                    {LA_KEYPOINT_ORDER.map((name, index) => {
                      const point = keypoints[name];
                      const isMiddle = name.endsWith("middle");
                      return (
                        <circle
                          aria-label={`${name.replace("_", " ")} landmark`}
                          cx={point.x}
                          cy={point.y}
                          data-keypoint-index={index}
                          data-landmark-name={name}
                          fill={
                            isMiddle
                              ? "var(--mantine-color-yellow-4)"
                              : selected
                                ? "var(--mantine-color-blue-3)"
                                : "var(--mantine-color-teal-3)"
                          }
                          key={name}
                          r={selected ? 4.5 : 3.5}
                          stroke="black"
                          strokeWidth={1.25}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          ) : null}

          {status === "submitting" ? (
            <Stack
              align="center"
              bg="rgba(0, 0, 0, 0.68)"
              inset={0}
              justify="center"
              pos="absolute"
            >
              <Loader color="blue.3" />
              <Text c="white" size="sm">Running LA assessment…</Text>
            </Stack>
          ) : null}
        </Box>

        <Group gap="lg">
          <Text c="dimmed" size="xs">
            <Text c="teal" component="span" fw={700}>●</Text> outer landmark
          </Text>
          <Text c="dimmed" size="xs">
            <Text c="yellow" component="span" fw={700}>●</Text> middle landmark
          </Text>
          <Text c="dimmed" size="xs">
            <Text c="cyan" component="span" fw={700}>—</Text> LA geometry line
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
