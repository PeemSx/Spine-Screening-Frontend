"use client";

import { Box, Card, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type {
  CobbLine,
  CobbResult,
  ImageInfo,
  Point,
  VertebraPrediction,
} from "../api/generated";
import type { PredictionStatus } from "../hooks/usePrediction";

interface PredictionOverlayProps {
  imageUrl: string | null;
  image: ImageInfo | null;
  vertebrae: readonly VertebraPrediction[];
  cobb: CobbResult | null;
  status: PredictionStatus;
  selectedCandidateId: number | null;
  onSelectCandidate: (candidateId: number) => void;
}

interface CobbMeasurement {
  displayLabel: string;
  angle: number;
  lines: readonly CobbLine[];
  color: string;
  dashArray?: string;
}

const VERTEBRA_POINT_COLORS = [
  "#ffff00",
  "#00ff00",
  "#00bfff",
  "#ff00ff",
  "#ffa500",
  "#ff0000",
  "#00ffff",
  "#ffffff",
] as const;

const LOW_CONFIDENCE_THRESHOLD = 0.3;

function buildCobbMeasurements(cobb: CobbResult | null): CobbMeasurement[] {
  if (!cobb) return [];

  const sources = [
    {
      angle: cobb.cobb_1_deg,
      lines: cobb.major_lines,
      color: "#ffff00",
      dashArray: undefined,
    },
    {
      angle: cobb.cobb_2_deg,
      lines: cobb.cobb_2_lines,
      color: "#ffa500",
      dashArray: "9.87 4.27",
    },
    {
      angle: cobb.cobb_3_deg,
      lines: cobb.cobb_3_lines,
      color: "#ff00ff",
      dashArray: "2.67 4.4",
    },
  ];

  const measurements: CobbMeasurement[] = [];
  for (const source of sources) {
    if (source.angle === null || source.lines.length === 0) continue;
    measurements.push({
      displayLabel: `Cobb ${measurements.length + 1}`,
      angle: source.angle,
      lines: source.lines,
      color: source.color,
      dashArray: source.dashArray,
    });
  }
  return measurements;
}

function midpoint(line: CobbLine): Point {
  return {
    x: (line.start.x + line.end.x) * 0.5,
    y: (line.start.y + line.end.y) * 0.5,
  };
}

function distanceToLine(point: Point, start: Point, end: Point) {
  const vectorX = end.x - start.x;
  const vectorY = end.y - start.y;
  const norm = Math.hypot(vectorX, vectorY);
  if (norm <= 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  const deltaX = point.x - start.x;
  const deltaY = point.y - start.y;
  return Math.abs(vectorX * deltaY - vectorY * deltaX) / norm;
}

function cobbApexPoint(
  lines: readonly CobbLine[],
  orderedVertebrae: readonly VertebraPrediction[],
): Point {
  const firstLine = lines[0];
  const secondLine = lines[1];
  if (!firstLine) return { x: 0, y: 0 };

  const firstMidpoint = midpoint(firstLine);
  if (!secondLine) return firstMidpoint;
  const secondMidpoint = midpoint(secondLine);

  const firstIndex = orderedVertebrae.findIndex(
    (vertebra) => vertebra.candidate_id === firstLine.vertebra_candidate_id,
  );
  const secondIndex = orderedVertebrae.findIndex(
    (vertebra) => vertebra.candidate_id === secondLine.vertebra_candidate_id,
  );
  const candidates =
    firstIndex >= 0 && secondIndex >= 0
      ? orderedVertebrae.slice(
          Math.min(firstIndex, secondIndex),
          Math.max(firstIndex, secondIndex) + 1,
        )
      : orderedVertebrae;

  if (candidates.length === 0) {
    return {
      x: (firstMidpoint.x + secondMidpoint.x) * 0.5,
      y: (firstMidpoint.y + secondMidpoint.y) * 0.5,
    };
  }

  let apex = candidates[Math.floor(candidates.length / 2)].center;
  let maximumDistance = 0;
  for (const candidate of candidates) {
    const distance = distanceToLine(candidate.center, firstMidpoint, secondMidpoint);
    if (distance > maximumDistance) {
      maximumDistance = distance;
      apex = candidate.center;
    }
  }
  return apex;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function CobbAnnotation({
  measurement,
  orderedVertebrae,
  image,
}: {
  measurement: CobbMeasurement;
  orderedVertebrae: readonly VertebraPrediction[];
  image: ImageInfo;
}) {
  const apex = cobbApexPoint(measurement.lines, orderedVertebrae);
  const maximumDimension = Math.max(image.width, image.height);
  const fontSize = Math.max(12, maximumDimension * 0.016);
  const label = `${measurement.displayLabel}: ${measurement.angle.toFixed(1)}`;
  const labelWidth = label.length * fontSize * 0.57 + fontSize;
  const labelHeight = fontSize * 1.45;
  const margin = Math.max(18, Math.max(image.width, image.height) * 0.012);
  const side = apex.x <= image.width * 0.5 ? -1 : 1;
  const labelX = clamp(
    apex.x + side * image.width * 0.14,
    margin + labelWidth * 0.5,
    image.width - margin - labelWidth * 0.5,
  );
  const labelY = clamp(
    apex.y,
    margin + labelHeight * 0.5,
    image.height - margin - labelHeight * 0.5,
  );
  const endpointRadius = Math.max(3, maximumDimension * 0.004);

  return (
    <g aria-label={`${measurement.displayLabel}: ${measurement.angle.toFixed(1)} degrees`}>
      {measurement.lines.map((line, index) => (
        <g key={`${measurement.displayLabel}-${line.vertebra_candidate_id}-${index}`}>
          <line
            opacity={0.95}
            stroke={measurement.color}
            strokeDasharray={measurement.dashArray}
            strokeLinecap="butt"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            x1={line.start.x}
            x2={line.end.x}
            y1={line.start.y}
            y2={line.end.y}
          />
          {[line.start, line.end].map((point, pointIndex) => (
            <circle
              cx={point.x}
              cy={point.y}
              fill={measurement.color}
              key={pointIndex}
              r={endpointRadius}
              stroke="#111111"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ))}

      <line
        opacity={0.8}
        stroke={measurement.color}
        strokeWidth={0.8}
        vectorEffect="non-scaling-stroke"
        x1={apex.x}
        x2={labelX}
        y1={apex.y}
        y2={labelY}
      />
      <rect
        fill={measurement.color}
        fillOpacity={0.78}
        height={labelHeight}
        width={labelWidth}
        x={labelX - labelWidth * 0.5}
        y={labelY - labelHeight * 0.5}
      />
      <text
        dominantBaseline="middle"
        fill="#000000"
        fontFamily="Arial, sans-serif"
        fontSize={fontSize}
        textAnchor="middle"
        x={labelX}
        y={labelY}
      >
        {label}
      </text>
    </g>
  );
}

function LowConfidenceCenter({
  vertebra,
  image,
}: {
  vertebra: VertebraPrediction;
  image: ImageInfo;
}) {
  const maximumDimension = Math.max(image.width, image.height);
  const fontSize = Math.max(9, maximumDimension * 0.017);
  const markerRadius = Math.max(3, maximumDimension * 0.0045);
  const label = `${vertebra.rank}:${vertebra.detector_score.toFixed(2)}`;
  const padding = fontSize * 0.16;
  const labelWidth = label.length * fontSize * 0.54 + padding * 2;
  const labelHeight = fontSize * 1.12 + padding * 2;

  return (
    <g
      aria-label={`Detected vertebra ${vertebra.rank}, detector score ${vertebra.detector_score.toFixed(2)}`}
    >
      <circle
        cx={vertebra.center.x}
        cy={vertebra.center.y}
        fill="#00ffff"
        r={markerRadius}
        stroke="#111111"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        fill="#000000"
        fillOpacity={0.45}
        height={labelHeight}
        width={labelWidth}
        x={vertebra.center.x}
        y={vertebra.center.y - labelHeight}
      />
      <text
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
        fontSize={fontSize}
        textAnchor="start"
        x={vertebra.center.x + padding}
        y={vertebra.center.y - padding}
      >
        {label}
      </text>
    </g>
  );
}

export function PredictionOverlay({
  imageUrl,
  image,
  vertebrae,
  cobb,
  status,
  selectedCandidateId,
  onSelectCandidate,
}: PredictionOverlayProps) {
  const candidateElements = useRef(new Map<number, SVGGElement>());
  const orderedVertebrae = [...vertebrae].sort(
    (first, second) => first.rank - second.rank,
  );
  const measurements = buildCobbMeasurements(cobb);

  useEffect(() => {
    if (selectedCandidateId === null) return;
    const selectedElement = candidateElements.current.get(selectedCandidateId);
    if (selectedElement && document.activeElement !== selectedElement) {
      selectedElement.focus({ preventScroll: true });
    }
  }, [selectedCandidateId]);

  const handleCandidateKeyDown = (
    event: KeyboardEvent<SVGGElement>,
    candidateId: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectCandidate(candidateId);
    }
  };

  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={2}>
            <Title order={4}>Landmarks and Cobb geometry</Title>
            <Text c="dimmed" size="xs">
              Original-image pixel coordinates
            </Text>
          </Stack>
          {status === "success" ? (
            <Text fw={600} size="sm">
              Predicted centers: {orderedVertebrae.length}
            </Text>
          ) : null}
        </Group>

        {status === "submitting" ? (
          <Stack align="center" justify="center" mih={320}>
            <Loader />
            <Text c="dimmed" size="sm">Calculating landmarks and Cobb geometry…</Text>
          </Stack>
        ) : imageUrl && image && cobb ? (
          <Box
            bg="black"
            style={{
              alignItems: "flex-start",
              borderRadius: 8,
              display: "flex",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <svg
              aria-label="Submitted radiograph with vertebral corner landmarks and Cobb reference lines"
              height={image.height}
              preserveAspectRatio="xMidYMid meet"
              role="group"
              style={{
                display: "block",
                height: "auto",
                maxHeight: "70vh",
                maxWidth: "100%",
                width: "auto",
              }}
              viewBox={`0 0 ${image.width} ${image.height}`}
              width={image.width}
            >
              <title>Vertebral landmark and Cobb geometry overlay</title>
              <desc>
                Color-coded vertebral corner points and computational Cobb reference lines on the original image.
              </desc>
              <image href={imageUrl} x={0} y={0} width={image.width} height={image.height} />

              <g pointerEvents="none">
                {orderedVertebrae
                  .filter(
                    (vertebra) => vertebra.detector_score < LOW_CONFIDENCE_THRESHOLD,
                  )
                  .map((vertebra) => (
                    <LowConfidenceCenter
                      image={image}
                      key={`low-confidence-${vertebra.candidate_id}`}
                      vertebra={vertebra}
                    />
                  ))}
              </g>

              {orderedVertebrae.map((vertebra, vertebraIndex) => {
                const { top_left, top_right, bottom_left, bottom_right } = vertebra.corners;
                const cornerPoints = [top_left, top_right, bottom_left, bottom_right];
                const polygonPoints = `${top_left.x},${top_left.y} ${top_right.x},${top_right.y} ${bottom_right.x},${bottom_right.y} ${bottom_left.x},${bottom_left.y}`;
                const selected = vertebra.candidate_id === selectedCandidateId;
                const color = VERTEBRA_POINT_COLORS[
                  vertebraIndex % VERTEBRA_POINT_COLORS.length
                ];
                const cornerRadius = Math.max(
                  2.5,
                  Math.max(image.width, image.height) * 0.003,
                );

                return (
                  <g
                    aria-label={`Detected vertebra ${vertebra.rank}`}
                    aria-pressed={selected}
                    key={vertebra.candidate_id}
                    onClick={() => onSelectCandidate(vertebra.candidate_id)}
                    onKeyDown={(event) => handleCandidateKeyDown(event, vertebra.candidate_id)}
                    ref={(element) => {
                      if (element) {
                        candidateElements.current.set(vertebra.candidate_id, element);
                      } else {
                        candidateElements.current.delete(vertebra.candidate_id);
                      }
                    }}
                    role="button"
                    style={{ cursor: "pointer" }}
                    tabIndex={0}
                  >
                    <polygon fill="transparent" points={polygonPoints} pointerEvents="all" />
                    {cornerPoints.map((point, index) => (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        fill={color}
                        fillOpacity={0.95}
                        key={index}
                        r={cornerRadius}
                        stroke="#111111"
                        strokeWidth={0.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                );
              })}

              <g pointerEvents="none">
                {measurements.map((measurement) => (
                  <CobbAnnotation
                    image={image}
                    key={`${measurement.displayLabel}-${measurement.color}`}
                    measurement={measurement}
                    orderedVertebrae={orderedVertebrae}
                  />
                ))}
              </g>
            </svg>
          </Box>
        ) : (
          <Stack align="center" justify="center" mih={320}>
            <Text c="dimmed" ta="center">
              Run screening to display vertebral corner points and Cobb reference lines.
            </Text>
          </Stack>
        )}

        {cobb && !cobb.valid ? (
          <Text c="yellow" size="sm">
            Cobb geometry is unavailable for the selected vertebral chain.
          </Text>
        ) : null}
        <Text c="dimmed" size="xs">
          Colors distinguish consecutive detected vertebrae. Cobb lines and angles are computational measurements,
          not diagnostic findings.
        </Text>
      </Stack>
    </Card>
  );
}
