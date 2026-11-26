"use client";

import {
  ActionIcon,
  Badge,
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
  ImageInfo,
  LACobbResult,
  LAVertebraPrediction,
  Point,
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

interface LateralOverlayVisibility {
  geometryLine: boolean;
  landmarks: boolean;
}

interface LateralCurvatureMeasurement {
  angle: number;
  color: string;
  dashArray?: string;
  label: string;
  lines: readonly CobbLine[];
}

const DEFAULT_VISIBILITY: LateralOverlayVisibility = {
  geometryLine: true,
  landmarks: true,
};

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

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const SELECTED_VERTEBRA_ZOOM = 3;

const LATERAL_CURVE_STYLES = [
  { color: "#22d3ee", dashArray: undefined },
  { color: "#ffea00", dashArray: "9 5" },
  { color: "#ff9800", dashArray: "3 5" },
] as const;

const LATERAL_VERTEBRA_COLORS = [
  "#ffff00",
  "#00ff00",
  "#00bfff",
  "#ff00ff",
  "#ffa500",
  "#ff0000",
  "#00ffff",
  "#ffffff",
] as const;

function buildLateralCurvatureMeasurements(
  cobb: LACobbResult | null,
): LateralCurvatureMeasurement[] {
  if (!cobb) return [];
  const sources = [
    { angle: cobb.cobb_1_deg, lines: cobb.major_lines },
    { angle: cobb.cobb_2_deg, lines: cobb.cobb_2_lines },
    { angle: cobb.cobb_3_deg, lines: cobb.cobb_3_lines },
  ];

  return sources.flatMap((source, index) => {
    if (source.angle === null || source.lines.length === 0) return [];
    return [
      {
        angle: source.angle,
        color: LATERAL_CURVE_STYLES[index].color,
        dashArray: LATERAL_CURVE_STYLES[index].dashArray,
        label: `Curve ${index + 1}`,
        lines: source.lines,
      },
    ];
  });
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

  return {
    x:
      visibleWidth >= image.width
        ? (image.width - visibleWidth) / 2
        : clamp(viewport.x, 0, image.width - visibleWidth),
    y:
      visibleHeight >= image.height
        ? (image.height - visibleHeight) / 2
        : clamp(viewport.y, 0, image.height - visibleHeight),
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
) {
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

function vertebraCenter(vertebra: LAVertebraPrediction): Point {
  const points = LA_KEYPOINT_ORDER.map((name) => vertebra.keypoints[name]);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function pointList(vertebra: LAVertebraPrediction, edge: "top" | "bottom") {
  const keypoints = vertebra.keypoints;
  const points =
    edge === "top"
      ? [keypoints.top_left, keypoints.top_middle, keypoints.top_right]
      : [keypoints.bottom_left, keypoints.bottom_middle, keypoints.bottom_right];
  return points.map(({ x, y }) => `${x},${y}`).join(" ");
}

function vertebraPolygonPoints(vertebra: LAVertebraPrediction) {
  const { top_left, top_right, bottom_left, bottom_right } = vertebra.keypoints;
  return [top_left, top_right, bottom_right, bottom_left]
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

function CurvatureAnnotation({
  image,
  measurement,
  renderScale,
}: {
  image: ImageInfo;
  measurement: LateralCurvatureMeasurement;
  renderScale: number;
}) {
  const lineMidpoints = measurement.lines.map((line) => ({
    x: (line.start.x + line.end.x) * 0.5,
    y: (line.start.y + line.end.y) * 0.5,
  }));
  const anchorX =
    lineMidpoints.reduce((sum, point) => sum + point.x, 0) /
    lineMidpoints.length;
  const anchorY =
    lineMidpoints.reduce((sum, point) => sum + point.y, 0) /
    lineMidpoints.length;
  const label = `${measurement.label}: ${measurement.angle.toFixed(1)}°`;
  const maximumDimension = Math.max(image.width, image.height);
  const fontSize = Math.max(12, maximumDimension * 0.016) / renderScale;
  const labelWidth = label.length * fontSize * 0.57 + fontSize;
  const labelHeight = fontSize * 1.45;
  const margin = Math.max(18, maximumDimension * 0.012) / renderScale;
  const linePoints = measurement.lines.flatMap((line) => [
    line.start,
    line.end,
  ]);
  const minimumLineX = Math.min(...linePoints.map((point) => point.x));
  const maximumLineX = Math.max(...linePoints.map((point) => point.x));
  const connectorGap = Math.max(12, maximumDimension * 0.01) / renderScale;
  const leftSpace = minimumLineX - margin;
  const rightSpace = image.width - maximumLineX - margin;
  const side = rightSpace >= leftSpace ? 1 : -1;
  const preferredLabelX =
    side === 1
      ? maximumLineX + connectorGap + labelWidth * 0.5
      : minimumLineX - connectorGap - labelWidth * 0.5;
  const minimumLabelX = margin + labelWidth * 0.5;
  const maximumLabelX = image.width - margin - labelWidth * 0.5;
  const labelX =
    minimumLabelX <= maximumLabelX
      ? clamp(preferredLabelX, minimumLabelX, maximumLabelX)
      : image.width * 0.5;
  const labelY = clamp(
    anchorY,
    margin + labelHeight * 0.5,
    image.height - margin - labelHeight * 0.5,
  );
  const endpointRadius = Math.max(3, maximumDimension * 0.004) / renderScale;

  return (
    <g
      aria-label={`${measurement.label}, ${measurement.angle.toFixed(1)} degrees`}
      data-la-curvature-measurement={measurement.label}
      pointerEvents="none"
      role="img"
    >
      {measurement.lines.map((line, index) => (
        <g key={`${line.vertebra_candidate_id}-${index}`}>
          <line
            data-cobb-line="true"
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
        x1={anchorX}
        x2={labelX}
        y1={anchorY}
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

function LateralCanvas({
  cobb,
  expanded = false,
  focusSelected,
  image,
  imageUrl,
  onDoubleClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSelectCandidate,
  renderScale = 1,
  selectedCandidateId,
  shouldIgnorePointerSelection,
  style,
  svgRef,
  vertebrae,
  viewBox,
  visibility,
}: Omit<LateralPredictionOverlayProps, "image" | "status"> & {
  expanded?: boolean;
  focusSelected: boolean;
  image: ImageInfo;
  onDoubleClick?: (event: ReactMouseEvent<SVGSVGElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGSVGElement>) => void;
  renderScale?: number;
  shouldIgnorePointerSelection?: () => boolean;
  style?: CSSProperties;
  svgRef?: RefObject<SVGSVGElement | null>;
  viewBox?: string;
  visibility: LateralOverlayVisibility;
}) {
  const curvatureMeasurements = buildLateralCurvatureMeasurements(cobb);
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

  return (
    <Box
      aria-label="Lateral radiograph with six vertebral landmarks per detection"
      bg="black"
      role="group"
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
        maxHeight: expanded ? "calc(100vh - 8rem)" : "70vh",
        overflow: "hidden",
        position: "relative",
        width: "100%",
        ...style,
      }}
    >
      <svg
        aria-label="LA prediction landmark overlay"
        onDoubleClick={onDoubleClick}
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="img"
        style={{ height: "100%", width: "100%" }}
        viewBox={viewBox ?? `0 0 ${image.width} ${image.height}`}
      >
        <image
          aria-label="Submitted lateral radiograph"
          height={image.height}
          href={imageUrl}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          width={image.width}
          x={0}
          y={0}
        />

        {vertebrae.map((vertebra, vertebraIndex) => {
              const selected = vertebra.candidate_id === selectedCandidateId;
              const keypoints = vertebra.keypoints;
              const color =
                LATERAL_VERTEBRA_COLORS[
                  vertebraIndex % LATERAL_VERTEBRA_COLORS.length
                ];
              const outlineWidth = selected ? 1.5 : 1;
              const pointRadius =
                Math.max(2.5, Math.max(image.width, image.height) * 0.003) /
                renderScale;

              return (
                <g
                  aria-label={`Detected lateral vertebra ${vertebra.rank}, six landmarks`}
                  aria-pressed={selected}
                  data-candidate-id={vertebra.candidate_id}
                  key={vertebra.candidate_id}
                  onClick={() => {
                    if (!shouldIgnorePointerSelection?.()) {
                      onSelectCandidate(vertebra.candidate_id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectCandidate(vertebra.candidate_id);
                    }
                  }}
                  ref={(element) => {
                    if (element) {
                      candidateElements.current.set(
                        vertebra.candidate_id,
                        element,
                      );
                    } else {
                      candidateElements.current.delete(vertebra.candidate_id);
                    }
                  }}
                  role="button"
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                >
                  <polygon
                    data-vertebra-hit-area="true"
                    fill="transparent"
                    points={vertebraPolygonPoints(vertebra)}
                    pointerEvents="all"
                  />

                  {visibility.landmarks ? (
                    <>
                      <polyline
                        data-vertebra-outline="true"
                        fill="none"
                        points={pointList(vertebra, "top")}
                        stroke={color}
                        strokeOpacity={selected ? 0.9 : 0.55}
                        strokeWidth={outlineWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                      <polyline
                        data-vertebra-outline="true"
                        fill="none"
                        points={pointList(vertebra, "bottom")}
                        stroke={color}
                        strokeOpacity={selected ? 0.9 : 0.55}
                        strokeWidth={outlineWidth}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        data-vertebra-outline="true"
                        stroke={color}
                        strokeOpacity={selected ? 0.9 : 0.55}
                        strokeWidth={outlineWidth}
                        vectorEffect="non-scaling-stroke"
                        x1={keypoints.top_left.x}
                        x2={keypoints.bottom_left.x}
                        y1={keypoints.top_left.y}
                        y2={keypoints.bottom_left.y}
                      />
                      <line
                        data-vertebra-outline="true"
                        stroke={color}
                        strokeOpacity={selected ? 0.9 : 0.55}
                        strokeWidth={outlineWidth}
                        vectorEffect="non-scaling-stroke"
                        x1={keypoints.top_right.x}
                        x2={keypoints.bottom_right.x}
                        y1={keypoints.top_right.y}
                        y2={keypoints.bottom_right.y}
                      />

                      {LA_KEYPOINT_ORDER.map((name, index) => {
                        const point = keypoints[name];
                        return (
                          <circle
                            aria-label={`${name.replace("_", " ")} landmark`}
                            cx={point.x}
                            cy={point.y}
                            data-keypoint-index={index}
                            data-landmark-name={name}
                            fill={color}
                            fillOpacity={0.95}
                            key={name}
                            r={pointRadius}
                            stroke="#111111"
                            strokeWidth={0.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                    </>
                  ) : null}
                </g>
              );
            })}

        {visibility.geometryLine
          ? curvatureMeasurements.map((measurement) => (
              <CurvatureAnnotation
                image={image}
                key={measurement.label}
                measurement={measurement}
                renderScale={renderScale}
              />
            ))
          : null}
      </svg>
    </Box>
  );
}

function LateralOverlayLegend() {
  return (
    <Group gap="lg" wrap="wrap">
      <Group gap={4} wrap="nowrap">
        {LATERAL_VERTEBRA_COLORS.slice(0, 6).map((color) => (
          <Box
            aria-hidden="true"
            bg={color}
            h={8}
            key={color}
            style={{ borderRadius: "50%" }}
            w={8}
          />
        ))}
        <Text c="dimmed" ml={3} size="xs">
          consecutive vertebrae
        </Text>
      </Group>
      <Text c="dimmed" size="xs">
        <Text c="cyan" component="span" fw={700}>—</Text> lateral curvature geometry
      </Text>
    </Group>
  );
}

function LateralLayerControls({
  onChange,
  visibility,
}: {
  onChange: (layer: keyof LateralOverlayVisibility, visible: boolean) => void;
  visibility: LateralOverlayVisibility;
}) {
  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <Popover position="bottom-end" shadow="md" width={230} withinPortal>
      <Popover.Target>
        <Button size="xs" variant="light">
          Layers {visibleCount}/2
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Text fw={700} size="sm">Overlay layers</Text>
          <Checkbox
            checked={visibility.landmarks}
            label="Six-point landmarks"
            onChange={(event) =>
              onChange("landmarks", event.currentTarget.checked)
            }
          />
          <Checkbox
            checked={visibility.geometryLine}
            label="Curvature lines and labels"
            onChange={(event) =>
              onChange("geometryLine", event.currentTarget.checked)
            }
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function LateralZoomModal({
  cobb,
  image,
  imageUrl,
  onChangeLayer,
  onClose,
  onSelectCandidate,
  opened,
  selectedCandidateId,
  vertebrae,
  visibility,
}: {
  cobb: LACobbResult;
  image: ImageInfo;
  imageUrl: string;
  onChangeLayer: (
    layer: keyof LateralOverlayVisibility,
    visible: boolean,
  ) => void;
  onClose: () => void;
  onSelectCandidate: (candidateId: number) => void;
  opened: boolean;
  selectedCandidateId: number | null;
  vertebrae: readonly LAVertebraPrediction[];
  visibility: LateralOverlayVisibility;
}) {
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
  const selectedVertebra = vertebrae.find(
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

    const handleWheel = (event: WheelEvent) => {
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

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
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
    const center = vertebraCenter(selectedVertebra);
    setViewport((current) => {
      const targetZoom = Math.max(
        SELECTED_VERTEBRA_ZOOM,
        clamp(current.zoom, MIN_ZOOM, MAX_ZOOM),
      );
      const dimensions = zoomViewportDimensions(
        { ...current, zoom: targetZoom },
        image,
        stageAspect,
      );
      return clampZoomViewport(
        {
          x: center.x - dimensions.width / 2,
          y: center.y - dimensions.height / 2,
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
      const [[firstId, first], [secondId, second]] = touchPointers.slice(0, 2);
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
      const dimensions = zoomViewportDimensions(
        { ...normalizedViewport, zoom: targetZoom },
        image,
        stageAspect,
      );
      const bounds = event.currentTarget.getBoundingClientRect();
      const horizontalRatio = clamp(
        ((first.clientX + second.clientX) / 2 - bounds.left) /
          Math.max(1, bounds.width),
        0,
        1,
      );
      const verticalRatio = clamp(
        ((first.clientY + second.clientY) / 2 - bounds.top) /
          Math.max(1, bounds.height),
        0,
        1,
      );
      setViewport(
        clampZoomViewport(
          {
            x: pinch.anchor.x - horizontalRatio * dimensions.width,
            y: pinch.anchor.y - verticalRatio * dimensions.height,
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pinchStateRef.current?.pointerIds.includes(event.pointerId)) {
      pinchStateRef.current = null;
      activePointersRef.current.clear();
    }
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
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
        body: { display: "flex", flex: 1, minHeight: 0, padding: 0 },
        content: { display: "flex", flexDirection: "column" },
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
            <LateralLayerControls
              onChange={onChangeLayer}
              visibility={visibility}
            />
          </Group>
        </Group>

        <Box
          aria-label="Zoomable lateral prediction viewer"
          bg="black"
          data-autofocus
          onKeyDown={handleStageKeyDown}
          ref={stageRef}
          role="application"
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          tabIndex={0}
        >
          <LateralCanvas
            cobb={cobb}
            focusSelected={opened}
            image={image}
            imageUrl={imageUrl}
            onDoubleClick={handleDoubleClick}
            onPointerCancel={finishPointerInteraction}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
            onSelectCandidate={onSelectCandidate}
            renderScale={normalizedViewport.zoom}
            selectedCandidateId={selectedCandidateId}
            shouldIgnorePointerSelection={() => draggedRef.current}
            style={{
              aspectRatio: "auto",
              cursor:
                normalizedViewport.zoom <= MIN_ZOOM
                  ? "default"
                  : isPanning
                    ? "grabbing"
                    : "grab",
              height: "100%",
              maxHeight: "none",
              touchAction: "none",
              userSelect: "none",
            }}
            svgRef={zoomSvgRef}
            vertebrae={vertebrae}
            viewBox={viewBox}
            visibility={visibility}
          />
        </Box>

        <Group
          gap="lg"
          justify="space-between"
          p="sm"
          style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}
          wrap="wrap"
        >
          <LateralOverlayLegend />
          <Text c="dimmed" size="xs">
            Wheel, pinch, or double-click to zoom · drag to pan · arrow keys to move
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
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
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [zoomOpened, setZoomOpened] = useState(false);
  const canOpenZoom = status === "success" && image !== null && cobb !== null;

  const setLayerVisibility = (
    layer: keyof LateralOverlayVisibility,
    visible: boolean,
  ) => {
    setVisibility((current) => ({ ...current, [layer]: visible }));
  };

  return (
    <>
      <Card
        withBorder
        radius="md"
        p={0}
        shadow="sm"
        style={{ overflow: "hidden" }}
      >
        <Stack gap={0}>
          <Group align="flex-start" gap="sm" justify="space-between" p="md">
            <Stack gap={2}>
              <Title order={4}>Landmarks and lateral curvature</Title>
              <Text c="dimmed" size="xs">Original-image pixel coordinates</Text>
            </Stack>
            {status === "success" ? (
              <Badge variant="light">{vertebrae.length} vertebrae</Badge>
            ) : null}
          </Group>

          <Group
            bg="var(--mantine-color-dark-7)"
            gap="sm"
            justify="space-between"
            px="md"
            py="sm"
            style={{
              borderBottom: "1px solid var(--mantine-color-dark-4)",
              borderTop: "1px solid var(--mantine-color-dark-4)",
            }}
            wrap="wrap"
          >
            <Group gap="sm">
              {status === "success" ? (
                <Text c="dimmed" size="xs">
                  Selected: vertebra {vertebrae.find(
                    (vertebra) =>
                      vertebra.candidate_id === selectedCandidateId,
                  )?.rank ?? 1}
                </Text>
              ) : (
                <Text c="dimmed" size="xs">Prediction preview</Text>
              )}
            </Group>

            <Group gap="xs" justify="flex-end">
              <LateralLayerControls
                onChange={setLayerVisibility}
                visibility={visibility}
              />
              <Button
                aria-label="Open prediction inspection"
                disabled={!canOpenZoom}
                leftSection={<IconMaximize size={16} />}
                onClick={() => setZoomOpened(true)}
                size="xs"
                variant="light"
              >
                Inspect
              </Button>
            </Group>
          </Group>

          {status === "submitting" ? (
            <Stack align="center" justify="center" mih={420}>
              <Loader />
              <Text c="dimmed" size="sm">
                Calculating landmarks and LA geometry…
              </Text>
            </Stack>
          ) : status === "success" && image && cobb ? (
            <LateralCanvas
              cobb={cobb}
              focusSelected={!zoomOpened}
              image={image}
              imageUrl={imageUrl}
              onSelectCandidate={onSelectCandidate}
              selectedCandidateId={selectedCandidateId}
              vertebrae={vertebrae}
              visibility={visibility}
            />
          ) : (
            <Stack align="center" justify="center" mih={420}>
              <Text c="dimmed" ta="center">
                Run screening to display six-point landmarks and LA geometry.
              </Text>
            </Stack>
          )}

          <Stack
            gap="xs"
            p="md"
            style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}
          >
            {status === "success" ? (
              <LateralOverlayLegend />
            ) : null}

            <Text c="dimmed" size="xs">
              Curve labels show four-outer-landmark lateral geometry. These are
              not clinical AP/PA Cobb measurements.
            </Text>
          </Stack>
        </Stack>
      </Card>

      {image && cobb ? (
        <LateralZoomModal
          cobb={cobb}
          image={image}
          imageUrl={imageUrl}
          onChangeLayer={setLayerVisibility}
          onClose={() => setZoomOpened(false)}
          onSelectCandidate={onSelectCandidate}
          opened={zoomOpened && canOpenZoom}
          selectedCandidateId={selectedCandidateId}
          vertebrae={vertebrae}
          visibility={visibility}
        />
      ) : null}
    </>
  );
}
