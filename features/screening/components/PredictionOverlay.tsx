"use client";

import {
  ActionIcon,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Modal,
  Popover,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconFocusCentered,
  IconMaximize,
  IconMinus,
  IconPlus,
  IconZoomReset,
} from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type {
  CobbLine,
  CobbResult,
  ImageInfo,
  MorphologyFeature,
  Point,
  VertebraPrediction,
} from "../api/generated";
import type { PredictionStatus } from "../types";
import {
  analyzeMorphology,
  type MorphologySignalStatus,
} from "../morphology/analysis";
import { MORPHOLOGY_FLAGGING_CONFIG } from "../morphology/config";

interface PredictionOverlayProps {
  imageUrl: string | null;
  image: ImageInfo | null;
  morphology: readonly MorphologyFeature[];
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
  labelTextColor: string;
  dashArray?: string;
}

interface CobbAngleBand {
  label: string;
  color: string;
  labelTextColor: string;
  maximumExclusive?: number;
}

interface OverlayVisibility {
  landmarks: boolean;
  cobbLines: boolean;
  cobbLabels: boolean;
  morphologyMarkers: boolean;
  reliabilityMarkers: boolean;
}

interface ZoomViewport {
  x: number;
  y: number;
  zoom: number;
}

interface DragState {
  clientX: number;
  clientY: number;
  pointerId: number;
  scaleX: number;
  scaleY: number;
  viewport: ZoomViewport;
}

interface PointerPosition {
  clientX: number;
  clientY: number;
  pointerType: string;
}

interface PinchState {
  anchor: Point;
  pointerIds: readonly [number, number];
  startDistance: number;
  startZoom: number;
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

const LOW_CONFIDENCE_THRESHOLD =
  MORPHOLOGY_FLAGGING_CONFIG.acceptableDetectorScore;

const DEFAULT_OVERLAY_VISIBILITY: OverlayVisibility = {
  landmarks: true,
  cobbLines: true,
  cobbLabels: true,
  morphologyMarkers: true,
  reliabilityMarkers: true,
};

const OVERLAY_LAYER_COUNT = Object.keys(DEFAULT_OVERLAY_VISIBILITY).length;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const SELECTED_VERTEBRA_ZOOM = 3;

const MARKED_MORPHOLOGY_STATUSES = new Set<MorphologySignalStatus>([
  "borderline_morphology_signal",
  "suspicious_morphology_signal",
  "high_priority_morphology_signal",
  "marked_height_change",
]);

const COBB_ANGLE_BANDS: readonly CobbAngleBand[] = [
  {
    label: "< 10°",
    color: "#00e5ff",
    labelTextColor: "#000000",
    maximumExclusive: 10,
  },
  {
    label: "10°–<20°",
    color: "#ffea00",
    labelTextColor: "#000000",
    maximumExclusive: 20,
  },
  {
    label: "20°–<40°",
    color: "#ff9800",
    labelTextColor: "#000000",
    maximumExclusive: 40,
  },
  {
    label: "≥ 40°",
    color: "#ff3b30",
    labelTextColor: "#ffffff",
  },
] as const;

function getCobbAngleBand(angle: number): CobbAngleBand {
  const absoluteAngle = Math.abs(angle);
  return (
    COBB_ANGLE_BANDS.find(
      (band) =>
        band.maximumExclusive !== undefined && absoluteAngle < band.maximumExclusive,
    ) ?? COBB_ANGLE_BANDS[COBB_ANGLE_BANDS.length - 1]
  );
}

function buildCobbMeasurements(cobb: CobbResult | null): CobbMeasurement[] {
  if (!cobb) return [];

  const sources = [
    {
      angle: cobb.cobb_1_deg,
      lines: cobb.major_lines,
      dashArray: undefined,
    },
    {
      angle: cobb.cobb_2_deg,
      lines: cobb.cobb_2_lines,
      dashArray: "9.87 4.27",
    },
    {
      angle: cobb.cobb_3_deg,
      lines: cobb.cobb_3_lines,
      dashArray: "2.67 4.4",
    },
  ];

  const measurements: CobbMeasurement[] = [];
  for (const source of sources) {
    if (source.angle === null || source.lines.length === 0) continue;
    const angleBand = getCobbAngleBand(source.angle);
    measurements.push({
      displayLabel: `Cobb ${measurements.length + 1}`,
      angle: source.angle,
      lines: source.lines,
      color: angleBand.color,
      labelTextColor: angleBand.labelTextColor,
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

function clampZoomViewport(
  viewport: ZoomViewport,
  image: ImageInfo,
  stageAspect: number,
): ZoomViewport {
  const zoom = clamp(viewport.zoom, MIN_ZOOM, MAX_ZOOM);
  const imageAspect = image.width / image.height;
  const safeStageAspect = stageAspect > 0 ? stageAspect : imageAspect;
  const fittedWidth =
    safeStageAspect >= imageAspect ? image.height * safeStageAspect : image.width;
  const fittedHeight =
    safeStageAspect >= imageAspect ? image.height : image.width / safeStageAspect;
  const visibleWidth = fittedWidth / zoom;
  const visibleHeight = fittedHeight / zoom;
  const x =
    visibleWidth >= image.width
      ? (image.width - visibleWidth) / 2
      : clamp(viewport.x, 0, image.width - visibleWidth);
  const y =
    visibleHeight >= image.height
      ? (image.height - visibleHeight) / 2
      : clamp(viewport.y, 0, image.height - visibleHeight);

  return {
    x,
    y,
    zoom,
  };
}

function zoomViewportDimensions(
  viewport: ZoomViewport,
  image: ImageInfo,
  stageAspect: number,
) {
  const normalized = clampZoomViewport(viewport, image, stageAspect);
  const imageAspect = image.width / image.height;
  const safeStageAspect = stageAspect > 0 ? stageAspect : imageAspect;
  const fittedWidth =
    safeStageAspect >= imageAspect ? image.height * safeStageAspect : image.width;
  const fittedHeight =
    safeStageAspect >= imageAspect ? image.height : image.width / safeStageAspect;

  return {
    height: fittedHeight / normalized.zoom,
    viewport: normalized,
    width: fittedWidth / normalized.zoom,
  };
}

function zoomViewportAroundPoint(
  viewport: ZoomViewport,
  targetZoom: number,
  anchor: Point,
  image: ImageInfo,
  stageAspect: number,
): ZoomViewport {
  const current = zoomViewportDimensions(viewport, image, stageAspect);
  const zoom = clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);
  const next = zoomViewportDimensions(
    { ...current.viewport, zoom },
    image,
    stageAspect,
  );
  const anchorX = clamp(
    anchor.x,
    current.viewport.x,
    current.viewport.x + current.width,
  );
  const anchorY = clamp(
    anchor.y,
    current.viewport.y,
    current.viewport.y + current.height,
  );
  const horizontalRatio = (anchorX - current.viewport.x) / current.width;
  const verticalRatio = (anchorY - current.viewport.y) / current.height;

  return clampZoomViewport(
    {
      x: anchorX - horizontalRatio * next.width,
      y: anchorY - verticalRatio * next.height,
      zoom,
    },
    image,
    stageAspect,
  );
}

function CobbAnnotation({
  measurement,
  orderedVertebrae,
  image,
  renderScale = 1,
  showLabels,
  showLines,
}: {
  measurement: CobbMeasurement;
  orderedVertebrae: readonly VertebraPrediction[];
  image: ImageInfo;
  renderScale?: number;
  showLabels: boolean;
  showLines: boolean;
}) {
  const apex = cobbApexPoint(measurement.lines, orderedVertebrae);
  const maximumDimension = Math.max(image.width, image.height);
  const fontSize = Math.max(12, maximumDimension * 0.016) / renderScale;
  const label = `${measurement.displayLabel}: ${measurement.angle.toFixed(1)}°`;
  const labelWidth = label.length * fontSize * 0.57 + fontSize;
  const labelHeight = fontSize * 1.45;
  const margin =
    Math.max(18, Math.max(image.width, image.height) * 0.012) / renderScale;
  const side = apex.x <= image.width * 0.5 ? -1 : 1;
  const labelX = clamp(
    apex.x + (side * image.width * 0.14) / renderScale,
    margin + labelWidth * 0.5,
    image.width - margin - labelWidth * 0.5,
  );
  const labelY = clamp(
    apex.y,
    margin + labelHeight * 0.5,
    image.height - margin - labelHeight * 0.5,
  );
  const endpointRadius = Math.max(3, maximumDimension * 0.004) / renderScale;

  return (
    <g aria-label={`${measurement.displayLabel}: ${measurement.angle.toFixed(1)} degrees`}>
      {showLines
        ? measurement.lines.map((line, index) => (
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
          ))
        : null}

      {showLabels ? (
        <>
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
            fill={measurement.labelTextColor}
            fontFamily="Arial, sans-serif"
            fontSize={fontSize}
            textAnchor="middle"
            x={labelX}
            y={labelY}
          >
            {label}
          </text>
        </>
      ) : null}
    </g>
  );
}

function LowConfidenceCenter({
  vertebra,
  image,
  renderScale = 1,
}: {
  vertebra: VertebraPrediction;
  image: ImageInfo;
  renderScale?: number;
}) {
  const maximumDimension = Math.max(image.width, image.height);
  const fontSize = Math.max(9, maximumDimension * 0.017) / renderScale;
  const markerRadius = Math.max(3, maximumDimension * 0.0045) / renderScale;
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

function MorphologySignalMarker({
  image,
  renderScale = 1,
  status,
  vertebra,
}: {
  image: ImageInfo;
  renderScale?: number;
  status: MorphologySignalStatus;
  vertebra: VertebraPrediction;
}) {
  const corners = Object.values(vertebra.corners);
  const minimumX = Math.min(...corners.map((corner) => corner.x));
  const maximumX = Math.max(...corners.map((corner) => corner.x));
  const minimumY = Math.min(...corners.map((corner) => corner.y));
  const maximumY = Math.max(...corners.map((corner) => corner.y));
  const centerY = (minimumY + maximumY) * 0.5;
  const maximumDimension = Math.max(image.width, image.height);
  const markerSize = Math.max(8, maximumDimension * 0.012) / renderScale;
  const markerHalfHeight = markerSize * 0.58;
  const gap = Math.max(3, maximumDimension * 0.004) / renderScale;
  const hasLeftSpace = minimumX - gap - markerSize >= 0;
  const mustUseLeft = maximumX + gap + markerSize > image.width;
  const placeOnLeft = hasLeftSpace || mustUseLeft;
  const tipX = placeOnLeft ? minimumX - gap : maximumX + gap;
  const baseX = placeOnLeft ? tipX - markerSize : tipX + markerSize;
  const points = `${tipX},${centerY} ${baseX},${
    centerY - markerHalfHeight
  } ${baseX},${centerY + markerHalfHeight}`;

  return (
    <g
      aria-label={`Detected vertebra ${vertebra.rank}, morphology screening signal`}
      data-morphology-status={status}
      pointerEvents="none"
    >
      <title>
        Detected vertebra {vertebra.rank}: morphology screening signal
      </title>
      <polygon
        fill="#ff2d2d"
        points={points}
        stroke="#ffffff"
        strokeLinejoin="round"
        strokeWidth={0.9}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function OverlayLayerControls({
  visibility,
  onChange,
  onSetAll,
}: {
  visibility: OverlayVisibility;
  onChange: (layer: keyof OverlayVisibility, visible: boolean) => void;
  onSetAll: (visible: boolean) => void;
}) {
  const visibleLayerCount = Object.values(visibility).filter(Boolean).length;

  return (
    <Popover position="bottom-end" shadow="md" width={250} withinPortal>
      <Popover.Target>
        <Button size="xs" variant="light">
          Layers {visibleLayerCount}/{OVERLAY_LAYER_COUNT}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Text fw={700} size="sm">
            Overlay layers
          </Text>
          <Checkbox
            checked={visibility.landmarks}
            label="Vertebral landmarks"
            onChange={(event) =>
              onChange("landmarks", event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={visibility.cobbLines}
            label="Cobb lines"
            onChange={(event) =>
              onChange("cobbLines", event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={visibility.cobbLabels}
            label="Cobb labels"
            onChange={(event) =>
              onChange("cobbLabels", event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={visibility.morphologyMarkers}
            label="Morphology markers"
            onChange={(event) =>
              onChange("morphologyMarkers", event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={visibility.reliabilityMarkers}
            label="Reliability markers"
            onChange={(event) =>
              onChange("reliabilityMarkers", event.currentTarget.checked)
            }
          />
          <Group grow gap="xs">
            <Button
              disabled={visibleLayerCount === OVERLAY_LAYER_COUNT}
              onClick={() => onSetAll(true)}
              size="xs"
              variant="subtle"
            >
              Show all
            </Button>
            <Button
              disabled={visibleLayerCount === 0}
              onClick={() => onSetAll(false)}
              size="xs"
              variant="subtle"
            >
              Hide all
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function CobbAngleLegend() {
  return (
    <Stack gap={4}>
      <Text c="dimmed" fw={600} size="xs">
        Cobb angle bands
      </Text>
      <Group gap="md" wrap="wrap">
        {COBB_ANGLE_BANDS.map((band) => (
          <Group gap={6} key={band.label} wrap="nowrap">
            <Box
              aria-hidden="true"
              bg={band.color}
              h={10}
              style={{ borderRadius: 2 }}
              w={18}
            />
            <Text c="dimmed" size="xs">
              {band.label}
            </Text>
          </Group>
        ))}
      </Group>
    </Stack>
  );
}

function MorphologyMarkerLegend() {
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        aria-hidden="true"
        style={{
          borderBottom: "5px solid transparent",
          borderLeft: "9px solid #ff2d2d",
          borderTop: "5px solid transparent",
          height: 0,
          width: 0,
        }}
      />
      <Text c="dimmed" size="xs">
        Morphology screening signal
      </Text>
    </Group>
  );
}

interface PredictionCanvasProps {
  focusSelected: boolean;
  image: ImageInfo;
  imageUrl: string;
  measurements: readonly CobbMeasurement[];
  morphologyMarkerStatuses: ReadonlyMap<number, MorphologySignalStatus>;
  onDoubleClick?: (event: ReactMouseEvent<SVGSVGElement>) => void;
  onKeyDown?: (event: KeyboardEvent<SVGSVGElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onSelectCandidate: (candidateId: number) => void;
  orderedVertebrae: readonly VertebraPrediction[];
  overlayVisibility: OverlayVisibility;
  renderScale?: number;
  selectedCandidateId: number | null;
  shouldIgnorePointerSelection?: () => boolean;
  style?: CSSProperties;
  svgRef?: RefObject<SVGSVGElement | null>;
  viewBox?: string;
}

function PredictionCanvas({
  focusSelected,
  image,
  imageUrl,
  measurements,
  morphologyMarkerStatuses,
  onDoubleClick,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectCandidate,
  orderedVertebrae,
  overlayVisibility,
  renderScale = 1,
  selectedCandidateId,
  shouldIgnorePointerSelection,
  style,
  svgRef,
  viewBox,
}: PredictionCanvasProps) {
  const candidateElements = useRef(new Map<number, SVGGElement>());
  const previousSelectedCandidateId = useRef<number | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const firstRender = previousSelectedCandidateId.current === undefined;
    const selectionChanged =
      previousSelectedCandidateId.current !== selectedCandidateId;
    previousSelectedCandidateId.current = selectedCandidateId;
    if (
      !focusSelected ||
      selectedCandidateId === null ||
      (!firstRender && !selectionChanged)
    ) {
      return;
    }
    const selectedElement = candidateElements.current.get(selectedCandidateId);
    if (selectedElement && document.activeElement !== selectedElement) {
      selectedElement.focus({ preventScroll: true });
    }
  }, [focusSelected, selectedCandidateId]);

  const handleCandidateKeyDown = (
    event: KeyboardEvent<SVGGElement>,
    candidateId: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onSelectCandidate(candidateId);
    }
  };

  return (
    <svg
      aria-label="Submitted radiograph with vertebral corner landmarks and Cobb reference lines"
      height={image.height}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      preserveAspectRatio="xMidYMid meet"
      ref={svgRef}
      role="group"
      style={{
        display: "block",
        height: "auto",
        maxHeight: "70vh",
        maxWidth: "100%",
        width: "auto",
        ...style,
      }}
      tabIndex={onKeyDown ? 0 : undefined}
      viewBox={viewBox ?? `0 0 ${image.width} ${image.height}`}
      width={image.width}
    >
      <title>Vertebral landmark and Cobb geometry overlay</title>
      <desc>
        Configurable vertebral corner points and computational Cobb reference lines on the original image.
      </desc>
      <image
        height={image.height}
        href={imageUrl}
        key={imageUrl}
        width={image.width}
        x={0}
        y={0}
      />

      {overlayVisibility.reliabilityMarkers ? (
        <g pointerEvents="none">
          {orderedVertebrae
            .filter(
              (vertebra) => vertebra.detector_score < LOW_CONFIDENCE_THRESHOLD,
            )
            .map((vertebra) => (
              <LowConfidenceCenter
                image={image}
                key={`low-confidence-${vertebra.candidate_id}`}
                renderScale={renderScale}
                vertebra={vertebra}
              />
            ))}
        </g>
      ) : null}

      {orderedVertebrae.map((vertebra, vertebraIndex) => {
        const { top_left, top_right, bottom_left, bottom_right } = vertebra.corners;
        const cornerPoints = [top_left, top_right, bottom_left, bottom_right];
        const polygonPoints = `${top_left.x},${top_left.y} ${top_right.x},${top_right.y} ${bottom_right.x},${bottom_right.y} ${bottom_left.x},${bottom_left.y}`;
        const selected = vertebra.candidate_id === selectedCandidateId;
        const color =
          VERTEBRA_POINT_COLORS[vertebraIndex % VERTEBRA_POINT_COLORS.length];
        const cornerRadius =
          Math.max(2.5, Math.max(image.width, image.height) * 0.003) /
          renderScale;
        const morphologyStatus = morphologyMarkerStatuses.get(
          vertebra.candidate_id,
        );

        return (
          <g
            aria-label={
              morphologyStatus
                ? `Detected vertebra ${vertebra.rank}, morphology screening signal`
                : `Detected vertebra ${vertebra.rank}`
            }
            aria-pressed={selected}
            key={vertebra.candidate_id}
            onClick={() => {
              if (!shouldIgnorePointerSelection?.()) {
                onSelectCandidate(vertebra.candidate_id);
              }
            }}
            onKeyDown={(event) =>
              handleCandidateKeyDown(event, vertebra.candidate_id)
            }
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
            {overlayVisibility.landmarks
              ? cornerPoints.map((point, index) => (
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
                ))
              : null}
          </g>
        );
      })}

      <g pointerEvents="none">
        {overlayVisibility.cobbLines || overlayVisibility.cobbLabels
          ? measurements.map((measurement) => (
              <CobbAnnotation
                image={image}
                key={`${measurement.displayLabel}-${measurement.color}`}
                measurement={measurement}
                orderedVertebrae={orderedVertebrae}
                renderScale={renderScale}
                showLabels={overlayVisibility.cobbLabels}
                showLines={overlayVisibility.cobbLines}
              />
            ))
          : null}
      </g>

      {overlayVisibility.morphologyMarkers ? (
        <g aria-label="Morphology screening markers" pointerEvents="none">
          {orderedVertebrae.map((vertebra) => {
            const morphologyStatus = morphologyMarkerStatuses.get(
              vertebra.candidate_id,
            );

            return morphologyStatus ? (
              <MorphologySignalMarker
                image={image}
                key={`morphology-marker-${vertebra.candidate_id}`}
                renderScale={renderScale}
                status={morphologyStatus}
                vertebra={vertebra}
              />
            ) : null;
          })}
        </g>
      ) : null}
    </svg>
  );
}

interface PredictionZoomModalProps {
  image: ImageInfo;
  imageUrl: string;
  measurements: readonly CobbMeasurement[];
  morphologyMarkerStatuses: ReadonlyMap<number, MorphologySignalStatus>;
  onChangeLayer: (layer: keyof OverlayVisibility, visible: boolean) => void;
  onClose: () => void;
  onSelectCandidate: (candidateId: number) => void;
  onSetAllLayers: (visible: boolean) => void;
  opened: boolean;
  orderedVertebrae: readonly VertebraPrediction[];
  overlayVisibility: OverlayVisibility;
  selectedCandidateId: number | null;
}

function PredictionZoomModal({
  image,
  imageUrl,
  measurements,
  morphologyMarkerStatuses,
  onChangeLayer,
  onClose,
  onSelectCandidate,
  onSetAllLayers,
  opened,
  orderedVertebrae,
  overlayVisibility,
  selectedCandidateId,
}: PredictionZoomModalProps) {
  const zoomSvgRef = useRef<SVGSVGElement>(null);
  const activePointersRef = useRef(new Map<number, PointerPosition>());
  const dragStateRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const pinchStateRef = useRef<PinchState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState<ZoomViewport>({
    x: 0,
    y: 0,
    zoom: MIN_ZOOM,
  });
  const { ref: stageRef, width: stageWidth, height: stageHeight } =
    useElementSize();
  const stageAspect =
    stageWidth > 0 && stageHeight > 0
      ? stageWidth / stageHeight
      : image.width / image.height;
  const previousStageAspectRef = useRef(stageAspect);
  const viewportDimensions = useMemo(
    () => zoomViewportDimensions(viewport, image, stageAspect),
    [image, stageAspect, viewport],
  );
  const normalizedViewport = viewportDimensions.viewport;
  const selectedVertebra = orderedVertebrae.find(
    (vertebra) => vertebra.candidate_id === selectedCandidateId,
  );

  useEffect(() => {
    if (!opened) return;
    setViewport(
      clampZoomViewport(
        { x: 0, y: 0, zoom: MIN_ZOOM },
        image,
        image.width / image.height,
      ),
    );
    activePointersRef.current.clear();
    dragStateRef.current = null;
    draggedRef.current = false;
    pinchStateRef.current = null;
    previousStageAspectRef.current = image.width / image.height;
    setIsPanning(false);
  }, [image, opened]);

  useEffect(() => {
    if (!opened) return;
    const previousStageAspect = previousStageAspectRef.current;
    setViewport((current) => {
      const previousDimensions = zoomViewportDimensions(
        current,
        image,
        previousStageAspect,
      );
      const center = {
        x: previousDimensions.viewport.x + previousDimensions.width / 2,
        y: previousDimensions.viewport.y + previousDimensions.height / 2,
      };
      const nextDimensions = zoomViewportDimensions(
        previousDimensions.viewport,
        image,
        stageAspect,
      );
      return clampZoomViewport(
        {
          x: center.x - nextDimensions.width / 2,
          y: center.y - nextDimensions.height / 2,
          zoom: previousDimensions.viewport.zoom,
        },
        image,
        stageAspect,
      );
    });
    previousStageAspectRef.current = stageAspect;
  }, [image, opened, stageAspect]);

  const clientToImagePoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const svg = zoomSvgRef.current;
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return null;

      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    },
    [],
  );

  const changeZoom = useCallback(
    (factor: number, anchor?: Point) => {
      setViewport((current) => {
        const dimensions = zoomViewportDimensions(current, image, stageAspect);
        const center = anchor ?? {
          x: dimensions.viewport.x + dimensions.width / 2,
          y: dimensions.viewport.y + dimensions.height / 2,
        };
        return zoomViewportAroundPoint(
          dimensions.viewport,
          dimensions.viewport.zoom * factor,
          center,
          image,
          stageAspect,
        );
      });
    },
    [image, stageAspect],
  );

  useEffect(() => {
    const svg = zoomSvgRef.current;
    if (!opened || !svg) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = clientToImagePoint(event.clientX, event.clientY);
      if (!anchor) return;
      const normalizedDelta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? Math.max(1, stageHeight)
            : 1);
      changeZoom(Math.exp(-normalizedDelta * 0.0015), anchor);
    };

    svg.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleNativeWheel);
  }, [changeZoom, clientToImagePoint, opened, stageHeight]);

  const resetZoom = () => {
    setViewport(
      clampZoomViewport(
        { x: 0, y: 0, zoom: MIN_ZOOM },
        image,
        stageAspect,
      ),
    );
  };

  const focusSelectedVertebra = () => {
    if (!selectedVertebra) return;
    setViewport((current) => {
      const targetZoom = Math.max(
        SELECTED_VERTEBRA_ZOOM,
        clamp(current.zoom, MIN_ZOOM, MAX_ZOOM),
      );
      const targetDimensions = zoomViewportDimensions(
        { ...current, zoom: targetZoom },
        image,
        stageAspect,
      );
      return clampZoomViewport(
        {
          x: selectedVertebra.center.x - targetDimensions.width / 2,
          y: selectedVertebra.center.y - targetDimensions.height / 2,
          zoom: targetZoom,
        },
        image,
        stageAspect,
      );
    });
  };

  const handleDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    const anchor = clientToImagePoint(event.clientX, event.clientY);
    if (anchor) changeZoom(ZOOM_STEP * ZOOM_STEP, anchor);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    if (activePointersRef.current.size === 0) draggedRef.current = false;
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    });

    const touchPointers = [...activePointersRef.current.entries()].filter(
      ([, pointer]) => pointer.pointerType === "touch",
    );
    if (event.pointerType === "touch" && touchPointers.length >= 2) {
      const pointers = touchPointers.slice(0, 2);
      const [firstId, first] = pointers[0];
      const [secondId, second] = pointers[1];
      const midpoint = {
        x: (first.clientX + second.clientX) / 2,
        y: (first.clientY + second.clientY) / 2,
      };
      const anchor = clientToImagePoint(midpoint.x, midpoint.y);
      const startDistance = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      );
      if (!anchor || startDistance <= 1) return;

      for (const pointerId of [firstId, secondId]) {
        if (!event.currentTarget.hasPointerCapture(pointerId)) {
          event.currentTarget.setPointerCapture(pointerId);
        }
      }
      pinchStateRef.current = {
        anchor,
        pointerIds: [firstId, secondId],
        startDistance,
        startZoom: normalizedViewport.zoom,
      };
      dragStateRef.current = null;
      draggedRef.current = true;
      setIsPanning(true);
      return;
    }

    if (normalizedViewport.zoom <= MIN_ZOOM) return;

    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    dragStateRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      scaleX: Math.max(1e-6, Math.hypot(matrix.a, matrix.b)),
      scaleY: Math.max(1e-6, Math.hypot(matrix.c, matrix.d)),
      viewport: normalizedViewport,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
    }

    const pinch = pinchStateRef.current;
    if (pinch) {
      const first = activePointersRef.current.get(pinch.pointerIds[0]);
      const second = activePointersRef.current.get(pinch.pointerIds[1]);
      if (!first || !second) return;

      const distance = Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      );
      const targetZoom = clamp(
        pinch.startZoom * (distance / pinch.startDistance),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const targetDimensions = zoomViewportDimensions(
        { ...normalizedViewport, zoom: targetZoom },
        image,
        stageAspect,
      );
      const bounds = event.currentTarget.getBoundingClientRect();
      const midpointX = (first.clientX + second.clientX) / 2;
      const midpointY = (first.clientY + second.clientY) / 2;
      const horizontalRatio = clamp(
        (midpointX - bounds.left) / Math.max(1, bounds.width),
        0,
        1,
      );
      const verticalRatio = clamp(
        (midpointY - bounds.top) / Math.max(1, bounds.height),
        0,
        1,
      );
      setViewport(
        clampZoomViewport(
          {
            x: pinch.anchor.x - horizontalRatio * targetDimensions.width,
            y: pinch.anchor.y - verticalRatio * targetDimensions.height,
            zoom: targetZoom,
          },
          image,
          stageAspect,
        ),
      );
      return;
    }

    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.clientX;
    const deltaY = event.clientY - drag.clientY;
    if (Math.hypot(deltaX, deltaY) <= 4) return;
    if (!draggedRef.current) {
      draggedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsPanning(true);
    }
    setViewport(
      clampZoomViewport(
        {
          x: drag.viewport.x - deltaX / drag.scaleX,
          y: drag.viewport.y - deltaY / drag.scaleY,
          zoom: drag.viewport.zoom,
        },
        image,
        stageAspect,
      ),
    );
  };

  const finishPointerInteraction = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    activePointersRef.current.delete(event.pointerId);
    const pinch = pinchStateRef.current;
    if (pinch && pinch.pointerIds.includes(event.pointerId)) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pinchStateRef.current = null;
      const remainingPointerId = pinch.pointerIds.find(
        (pointerId) => pointerId !== event.pointerId,
      );
      const remainingPointer =
        remainingPointerId === undefined
          ? undefined
          : activePointersRef.current.get(remainingPointerId);
      const matrix = event.currentTarget.getScreenCTM();

      if (remainingPointerId !== undefined && remainingPointer && matrix) {
        dragStateRef.current = {
          clientX: remainingPointer.clientX,
          clientY: remainingPointer.clientY,
          pointerId: remainingPointerId,
          scaleX: Math.max(1e-6, Math.hypot(matrix.a, matrix.b)),
          scaleY: Math.max(1e-6, Math.hypot(matrix.c, matrix.d)),
          viewport: normalizedViewport,
        };
        setIsPanning(true);
      } else {
        activePointersRef.current.clear();
        dragStateRef.current = null;
        setIsPanning(false);
      }
      return;
    }

    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setIsPanning(false);
  };

  const panBy = (horizontalRatio: number, verticalRatio: number) => {
    setViewport((current) => {
      const dimensions = zoomViewportDimensions(current, image, stageAspect);
      return clampZoomViewport(
        {
          x: dimensions.viewport.x + dimensions.width * horizontalRatio,
          y: dimensions.viewport.y + dimensions.height * verticalRatio,
          zoom: dimensions.viewport.zoom,
        },
        image,
        stageAspect,
      );
    });
  };

  const handleStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      changeZoom(1 / ZOOM_STEP);
    } else if (event.key === "0" || event.key.toLowerCase() === "f") {
      event.preventDefault();
      resetZoom();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      panBy(-0.1, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      panBy(0.1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      panBy(0, -0.1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      panBy(0, 0.1);
    }
  };

  const handleClose = () => {
    activePointersRef.current.clear();
    dragStateRef.current = null;
    pinchStateRef.current = null;
    setIsPanning(false);
    onClose();
  };

  const viewBox = `${normalizedViewport.x} ${normalizedViewport.y} ${viewportDimensions.width} ${viewportDimensions.height}`;
  const canZoomOut = normalizedViewport.zoom > MIN_ZOOM + 1e-3;
  const canZoomIn = normalizedViewport.zoom < MAX_ZOOM - 1e-3;

  return (
    <Modal
      fullScreen
      keepMounted
      onClose={handleClose}
      opened={opened}
      title="Prediction inspection"
      styles={{
        body: {
          display: "flex",
          flex: 1,
          minHeight: 0,
          padding: 0,
        },
        content: {
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Stack gap={0} style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <Group
          gap="sm"
          justify="space-between"
          p="sm"
          style={{ borderBottom: "1px solid var(--mantine-color-dark-4)" }}
          wrap="wrap"
        >
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Zoom out (−)">
              <ActionIcon
                aria-label="Zoom out"
                disabled={!canZoomOut}
                onClick={() => changeZoom(1 / ZOOM_STEP)}
                size="lg"
                variant="light"
              >
                <IconMinus size={18} />
              </ActionIcon>
            </Tooltip>
            <Text fw={700} miw={58} size="sm" ta="center">
              {Math.round(normalizedViewport.zoom * 100)}%
            </Text>
            <Tooltip label="Zoom in (+)">
              <ActionIcon
                aria-label="Zoom in"
                disabled={!canZoomIn}
                onClick={() => changeZoom(ZOOM_STEP)}
                size="lg"
                variant="light"
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Fit image (0 or F)">
              <ActionIcon
                aria-label="Fit image"
                disabled={!canZoomOut}
                onClick={resetZoom}
                size="lg"
                variant="light"
              >
                <IconZoomReset size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Focus selected vertebra">
              <ActionIcon
                aria-label="Focus selected vertebra"
                disabled={!selectedVertebra}
                onClick={focusSelectedVertebra}
                size="lg"
                variant="light"
              >
                <IconFocusCentered size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group gap="sm" wrap="wrap">
            {selectedVertebra ? (
              <Text c="dimmed" size="xs">
                Selected: vertebra {selectedVertebra.rank}
              </Text>
            ) : null}
            <OverlayLayerControls
              onChange={onChangeLayer}
              onSetAll={onSetAllLayers}
              visibility={overlayVisibility}
            />
          </Group>
        </Group>

        <Box
          aria-label="Zoomable prediction viewer"
          bg="black"
          data-autofocus
          onKeyDown={handleStageKeyDown}
          ref={stageRef}
          role="application"
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          tabIndex={0}
        >
          <PredictionCanvas
            focusSelected={opened}
            image={image}
            imageUrl={imageUrl}
            measurements={measurements}
            morphologyMarkerStatuses={morphologyMarkerStatuses}
            onDoubleClick={handleDoubleClick}
            onPointerCancel={finishPointerInteraction}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
            onSelectCandidate={onSelectCandidate}
            orderedVertebrae={orderedVertebrae}
            overlayVisibility={overlayVisibility}
            renderScale={normalizedViewport.zoom}
            selectedCandidateId={selectedCandidateId}
            shouldIgnorePointerSelection={() => draggedRef.current}
            style={{
              cursor:
                normalizedViewport.zoom <= MIN_ZOOM
                  ? "default"
                  : isPanning
                    ? "grabbing"
                    : "grab",
              height: "100%",
              maxHeight: "none",
              maxWidth: "none",
              touchAction: "none",
              userSelect: "none",
              width: "100%",
            }}
            svgRef={zoomSvgRef}
            viewBox={viewBox}
          />
        </Box>

        <Group
          gap="lg"
          justify="space-between"
          p="sm"
          style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}
          wrap="wrap"
        >
          <Stack gap="xs">
            {measurements.length > 0 ? <CobbAngleLegend /> : null}
            {morphologyMarkerStatuses.size > 0 ? (
              <MorphologyMarkerLegend />
            ) : null}
          </Stack>
          <Text c="dimmed" size="xs">
            Wheel, pinch, or double-click to zoom · drag to pan · arrow keys to move
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
}

export function PredictionOverlay({
  imageUrl,
  image,
  morphology,
  vertebrae,
  cobb,
  status,
  selectedCandidateId,
  onSelectCandidate,
}: PredictionOverlayProps) {
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    DEFAULT_OVERLAY_VISIBILITY,
  );
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const orderedVertebrae = useMemo(
    () => [...vertebrae].sort((first, second) => first.rank - second.rank),
    [vertebrae],
  );
  const measurements = useMemo(() => buildCobbMeasurements(cobb), [cobb]);
  const morphologyMarkerStatuses = useMemo(
    () =>
      new Map(
        analyzeMorphology(morphology, vertebrae)
          .filter((assessment) =>
            MARKED_MORPHOLOGY_STATUSES.has(assessment.status),
          )
          .map(
            (assessment) =>
              [assessment.candidateId, assessment.status] as const,
          ),
      ),
    [morphology, vertebrae],
  );
  const canOpenZoom =
    status === "success" && imageUrl !== null && image !== null && cobb !== null;
  const zoomOpened = canOpenZoom && zoomImageUrl === imageUrl;

  const setLayerVisibility = (
    layer: keyof OverlayVisibility,
    visible: boolean,
  ) => {
    setOverlayVisibility((current) => ({ ...current, [layer]: visible }));
  };

  const setAllLayersVisibility = (visible: boolean) => {
    setOverlayVisibility({
      landmarks: visible,
      cobbLines: visible,
      cobbLabels: visible,
      morphologyMarkers: visible,
      reliabilityMarkers: visible,
    });
  };

  return (
    <>
      <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={2}>
            <Title order={4}>Landmarks and Cobb geometry</Title>
            <Text c="dimmed" size="xs">
              Original-image pixel coordinates
            </Text>
          </Stack>
          <Group gap="xs" justify="flex-end">
            {status === "success" ? (
              <Text fw={600} size="sm">
                Predicted centers: {orderedVertebrae.length}
              </Text>
            ) : null}
            <OverlayLayerControls
              onChange={setLayerVisibility}
              onSetAll={setAllLayersVisibility}
              visibility={overlayVisibility}
            />
            <Tooltip label="Open zoom viewer">
              <ActionIcon
                aria-label="Open zoom viewer"
                disabled={!canOpenZoom}
                onClick={() => setZoomImageUrl(imageUrl)}
                size="lg"
                variant="light"
              >
                <IconMaximize size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
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
            <PredictionCanvas
              focusSelected={!zoomOpened}
              image={image}
              imageUrl={imageUrl}
              measurements={measurements}
              morphologyMarkerStatuses={morphologyMarkerStatuses}
              onSelectCandidate={onSelectCandidate}
              orderedVertebrae={orderedVertebrae}
              overlayVisibility={overlayVisibility}
              selectedCandidateId={selectedCandidateId}
            />
          </Box>
        ) : (
          <Stack align="center" justify="center" mih={320}>
            <Text c="dimmed" ta="center">
              Run screening to display vertebral corner points and Cobb reference lines.
            </Text>
          </Stack>
        )}

        {status === "success" && measurements.length > 0 ? (
          <CobbAngleLegend />
        ) : null}

        {status === "success" && morphologyMarkerStatuses.size > 0 ? (
          <MorphologyMarkerLegend />
        ) : null}

        {cobb && !cobb.valid ? (
          <Text c="yellow" size="sm">
            Cobb geometry is unavailable for the selected vertebral chain.
          </Text>
        ) : null}
        <Text c="dimmed" size="xs">
          Landmark colors distinguish consecutive detections. Cobb colors indicate angle bands, while line styles
          distinguish individual measurements. These are computational measurements, not diagnostic findings.
        </Text>
        </Stack>
      </Card>

      {imageUrl && image && cobb ? (
        <PredictionZoomModal
          image={image}
          imageUrl={imageUrl}
          measurements={measurements}
          morphologyMarkerStatuses={morphologyMarkerStatuses}
          onChangeLayer={setLayerVisibility}
          onClose={() => setZoomImageUrl(null)}
          onSelectCandidate={onSelectCandidate}
          onSetAllLayers={setAllLayersVisibility}
          opened={zoomOpened}
          orderedVertebrae={orderedVertebrae}
          overlayVisibility={overlayVisibility}
          selectedCandidateId={selectedCandidateId}
        />
      ) : null}
    </>
  );
}
