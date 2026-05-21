"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  useComputedColorScheme,
} from "@mantine/core";

type CropAspectPreset = "free" | "original" | "portrait" | "square" | "tall";

type Point = {
  x: number;
  y: number;
};

type Size = {
  width: number;
  height: number;
};

type CropFrame = Size & {
  x: number;
  y: number;
};

type ImageCropModalProps = {
  opened: boolean;
  file: File | null;
  title: string;
  defaultAspect?: CropAspectPreset;
  onClose: () => void;
  onApply: (croppedFile: File) => void;
};

const ASPECT_OPTIONS: { label: string; value: CropAspectPreset }[] = [
  { label: "Free", value: "free" },
  { label: "Original", value: "original" },
  { label: "3:4", value: "portrait" },
  { label: "1:1", value: "square" },
  { label: "9:16", value: "tall" },
];

const MIN_CROP_WIDTH = 140;
const MIN_CROP_HEIGHT = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCropBounds(stage: Size) {
  const horizontalPadding = stage.width < 520 ? 24 : 40;
  const verticalPadding = stage.height < 420 ? 24 : 40;
  const maxWidth = Math.max(MIN_CROP_WIDTH, stage.width - horizontalPadding * 2);
  const maxHeight = Math.max(MIN_CROP_HEIGHT, stage.height - verticalPadding * 2);

  return {
    horizontalPadding,
    verticalPadding,
    maxWidth,
    maxHeight,
  };
}

function getAspectRatio(preset: CropAspectPreset, imageSize: Size | null) {
  if (preset === "free") {
    return null;
  }

  if (preset === "original") {
    if (!imageSize || imageSize.height === 0) {
      return 3 / 4;
    }

    return imageSize.width / imageSize.height;
  }

  if (preset === "square") {
    return 1;
  }

  if (preset === "tall") {
    return 9 / 16;
  }

  return 3 / 4;
}

function clampFreeCropSize(size: Size, stage: Size): Size {
  const bounds = getCropBounds(stage);

  return {
    width: clamp(size.width, MIN_CROP_WIDTH, bounds.maxWidth),
    height: clamp(size.height, MIN_CROP_HEIGHT, bounds.maxHeight),
  };
}

function getDefaultFreeCropSize(stage: Size): Size {
  const bounds = getCropBounds(stage);

  return {
    width: Math.max(MIN_CROP_WIDTH, bounds.maxWidth * 0.82),
    height: Math.max(MIN_CROP_HEIGHT, bounds.maxHeight * 0.82),
  };
}

function getCropFrame(stage: Size, aspectRatio: number | null, freeCropSize?: Size | null): CropFrame {
  const bounds = getCropBounds(stage);

  if (aspectRatio === null) {
    const size = clampFreeCropSize(freeCropSize ?? getDefaultFreeCropSize(stage), stage);

    return {
      width: size.width,
      height: size.height,
      x: bounds.horizontalPadding + (bounds.maxWidth - size.width) / 2,
      y: bounds.verticalPadding + (bounds.maxHeight - size.height) / 2,
    };
  }

  const { maxWidth, maxHeight } = bounds;

  let width = Math.min(maxWidth, maxHeight * aspectRatio);
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width,
    height,
    x: bounds.horizontalPadding + (maxWidth - width) / 2,
    y: bounds.verticalPadding + (maxHeight - height) / 2,
  };
}

function clampOffset(offset: Point, imageSize: Size, frame: CropFrame, scale: number): Point {
  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;
  const maxX = Math.max(0, (scaledWidth - frame.width) / 2);
  const maxY = Math.max(0, (scaledHeight - frame.height) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function getOutputType(file: File) {
  return file.type.toLowerCase() === "image/png" ? "image/png" : "image/jpeg";
}

function buildCroppedFileName(file: File, outputType: string) {
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const extension = outputType === "image/png" ? ".png" : ".jpg";
  return `${baseName}-cropped${extension}`;
}

export function ImageCropModal({
  opened,
  file,
  title,
  defaultAspect = "original",
  onClose,
  onApply,
}: ImageCropModalProps) {
  const colorScheme = useComputedColorScheme("light");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    startPointer: Point;
    startOffset: Point;
  } | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>(defaultAspect);
  const [freeCropSize, setFreeCropSize] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isDark = mounted && colorScheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      setImageSize(null);
      imageRef.current = null;
      return;
    }

    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      if (cancelled) {
        return;
      }

      imageRef.current = img;
      setImageUrl(url);
      setImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!opened) {
      setStageSize({ width: 0, height: 0 });
      return;
    }

    let observer: ResizeObserver | null = null;
    let animationFrame = 0;

    const connectObserver = () => {
      const element = stageRef.current;
      if (!element) {
        return;
      }

      const updateSize = () => {
        const rect = element.getBoundingClientRect();
        setStageSize({
          width: rect.width,
          height: rect.height,
        });
      };

      updateSize();
      observer = new ResizeObserver(updateSize);
      observer.observe(element);
    };

    animationFrame = window.requestAnimationFrame(connectObserver);

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }

      observer?.disconnect();
    };
  }, [opened]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setAspectPreset(defaultAspect);
    setFreeCropSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setApplying(false);
  }, [opened, file, defaultAspect]);

  useEffect(() => {
    if (aspectPreset !== "free" || !stageSize.width || !stageSize.height) {
      return;
    }

    setFreeCropSize((currentSize) =>
      currentSize ? clampFreeCropSize(currentSize, stageSize) : getDefaultFreeCropSize(stageSize),
    );
  }, [aspectPreset, stageSize]);

  const aspectRatio = useMemo(
    () => getAspectRatio(aspectPreset, imageSize),
    [aspectPreset, imageSize],
  );

  const cropBounds = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return null;
    }

    return getCropBounds(stageSize);
  }, [stageSize]);

  const cropFrame = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return null;
    }

    return getCropFrame(stageSize, aspectRatio, freeCropSize);
  }, [aspectRatio, freeCropSize, stageSize]);

  const baseScale = useMemo(() => {
    if (!imageSize || !cropFrame) {
      return 1;
    }

    return Math.max(cropFrame.width / imageSize.width, cropFrame.height / imageSize.height);
  }, [cropFrame, imageSize]);

  const imageScale = baseScale * zoom;

  useEffect(() => {
    if (!imageSize || !cropFrame) {
      return;
    }

    setOffset((currentOffset) => clampOffset(currentOffset, imageSize, cropFrame, imageScale));
  }, [cropFrame, imageScale, imageSize]);

  const renderedImage = useMemo(() => {
    if (!imageSize || !cropFrame) {
      return null;
    }

    const width = imageSize.width * imageScale;
    const height = imageSize.height * imageScale;
    const left = cropFrame.x + cropFrame.width / 2 - width / 2 + offset.x;
    const top = cropFrame.y + cropFrame.height / 2 - height / 2 + offset.y;

    return { width, height, left, top };
  }, [cropFrame, imageScale, imageSize, offset.x, offset.y]);

  const cropRenderState =
    imageUrl && imageSize && cropFrame && renderedImage
      ? {
          imageUrl,
          cropFrame,
          renderedImage,
        }
      : null;

  const canRenderCropper = Boolean(cropRenderState);

  const resetView = (preset: CropAspectPreset = aspectPreset) => {
    if (preset === "free" && stageSize.width && stageSize.height) {
      setFreeCropSize(getDefaultFreeCropSize(stageSize));
    }

    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canRenderCropper) {
      return;
    }

    dragRef.current = {
      startPointer: { x: event.clientX, y: event.clientY },
      startOffset: offset,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !imageSize || !cropFrame) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startPointer.x;
    const deltaY = event.clientY - dragRef.current.startPointer.y;
    const nextOffset = {
      x: dragRef.current.startOffset.x + deltaX,
      y: dragRef.current.startOffset.y + deltaY,
    };

    setOffset(clampOffset(nextOffset, imageSize, cropFrame, imageScale));
  };

  const handlePointerEnd = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleApply = async () => {
    if (!file || !imageRef.current || !imageSize || !cropFrame || !renderedImage) {
      return;
    }

    setApplying(true);

    try {
      const rawX = (cropFrame.x - renderedImage.left) / imageScale;
      const rawY = (cropFrame.y - renderedImage.top) / imageScale;
      const rawWidth = cropFrame.width / imageScale;
      const rawHeight = cropFrame.height / imageScale;

      const cropX = clamp(rawX, 0, imageSize.width - 1);
      const cropY = clamp(rawY, 0, imageSize.height - 1);
      const cropWidth = clamp(rawWidth, 1, imageSize.width - cropX);
      const cropHeight = clamp(rawHeight, 1, imageSize.height - cropY);

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth));
      canvas.height = Math.max(1, Math.round(cropHeight));
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.drawImage(
        imageRef.current,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const outputType = getOutputType(file);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, 0.92);
      });

      if (!blob) {
        return;
      }

      const croppedFile = new File([blob], buildCroppedFileName(file, outputType), {
        type: outputType,
      });

      onApply(croppedFile);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="80rem"
      overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
      styles={{
        content: {
          background: isDark
            ? "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.98))"
            : "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98))",
          border: isDark
            ? "1px solid rgba(96, 165, 250, 0.14)"
            : "1px solid rgba(148, 163, 184, 0.16)",
          boxShadow: isDark
            ? "0 28px 72px rgba(0, 0, 0, 0.42)"
            : "0 28px 72px rgba(15, 23, 42, 0.14)",
        },
        header: {
          background: "transparent",
        },
        title: {
          color: isDark ? "var(--mantine-color-gray-0)" : "var(--mantine-color-dark-8)",
          fontWeight: 700,
        },
        close: {
          color: isDark ? "var(--mantine-color-gray-3)" : "var(--mantine-color-gray-6)",
        },
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="center" gap="sm" style={{ flexWrap: "wrap" }}>
          <Stack gap={4}>
            <Text size="xs" fw={700} c={isDark ? "gray.5" : "dimmed"} tt="uppercase">
              Crop Mode
            </Text>
            <SegmentedControl
              value={aspectPreset}
              onChange={(value) => {
                const nextPreset = value as CropAspectPreset;
                setAspectPreset(nextPreset);
                if (nextPreset !== "free") {
                  setFreeCropSize(null);
                }
                resetView(nextPreset);
              }}
              data={ASPECT_OPTIONS}
              fullWidth
              styles={{
                root: {
                  background: isDark ? "rgba(30, 41, 59, 0.9)" : undefined,
                  border: isDark ? "1px solid rgba(96, 165, 250, 0.14)" : undefined,
                },
                indicator: {
                  background: isDark
                    ? "linear-gradient(135deg, rgba(30, 64, 175, 0.96), rgba(37, 99, 235, 0.88))"
                    : undefined,
                },
                label: {
                  color: isDark ? "var(--mantine-color-gray-3)" : undefined,
                },
              }}
            />
          </Stack>

          <Text size="sm" c={isDark ? "gray.4" : "dimmed"}>
            Drag to position. Use Free mode to adjust width and height independently.
          </Text>
        </Group>

        <Paper
          withBorder
          radius="xl"
          p="xs"
          styles={{
            root: {
              background: isDark
                ? "linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.96))"
                : "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96))",
              borderColor: isDark ? "rgba(96, 165, 250, 0.16)" : "rgba(148, 163, 184, 0.16)",
            },
          }}
        >
          <Box
            ref={stageRef}
            pos="relative"
            style={{
              height: "clamp(280px, 52dvh, 520px)",
              overflow: "hidden",
              borderRadius: 20,
              background:
                isDark
                  ? "linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(30, 41, 59, 0.98))"
                  : "linear-gradient(180deg, rgba(226, 232, 240, 0.72), rgba(241, 245, 249, 0.96))",
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
              userSelect: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          >
            {!cropRenderState ? (
              <Group justify="center" align="center" h="100%">
                <Loader size="sm" />
              </Group>
            ) : (
              <>
                <Box
                  component="img"
                  src={cropRenderState.imageUrl}
                  alt={title}
                  style={{
                    position: "absolute",
                    left: cropRenderState.renderedImage.left,
                    top: cropRenderState.renderedImage.top,
                    width: cropRenderState.renderedImage.width,
                    height: cropRenderState.renderedImage.height,
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />

                <Box
                  style={{
                    position: "absolute",
                    left: cropRenderState.cropFrame.x,
                    top: cropRenderState.cropFrame.y,
                    width: cropRenderState.cropFrame.width,
                    height: cropRenderState.cropFrame.height,
                    borderRadius: 20,
                    boxShadow: isDark
                      ? "0 0 0 9999px rgba(2, 6, 23, 0.72)"
                      : "0 0 0 9999px rgba(15, 23, 42, 0.58)",
                    border: isDark
                      ? "2px solid rgba(147, 197, 253, 0.92)"
                      : "2px solid rgba(255, 255, 255, 0.92)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                  }}
                >
                  <Badge
                    color="blue"
                    variant="filled"
                    radius="sm"
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                    }}
                  >
                    Crop area
                  </Badge>
                </Box>
              </>
            )}
          </Box>
        </Paper>

        {aspectPreset === "free" && cropFrame && cropBounds ? (
          <Group grow align="flex-start">
            <Stack gap={8}>
              <Text size="sm" fw={600} c={isDark ? "gray.2" : "dark.7"}>
                Crop width
              </Text>
              <Slider
                min={MIN_CROP_WIDTH}
                max={cropBounds.maxWidth}
                step={1}
                value={cropFrame.width}
                onChange={(value) =>
                  setFreeCropSize((currentSize) => ({
                    width: value,
                    height: currentSize?.height ?? cropFrame.height,
                  }))
                }
                label={(value) => `${Math.round(value)} px`}
              />
            </Stack>

            <Stack gap={8}>
              <Text size="sm" fw={600} c={isDark ? "gray.2" : "dark.7"}>
                Crop height
              </Text>
              <Slider
                min={MIN_CROP_HEIGHT}
                max={cropBounds.maxHeight}
                step={1}
                value={cropFrame.height}
                onChange={(value) =>
                  setFreeCropSize((currentSize) => ({
                    width: currentSize?.width ?? cropFrame.width,
                    height: value,
                  }))
                }
                label={(value) => `${Math.round(value)} px`}
              />
            </Stack>
          </Group>
        ) : null}

        <Group justify="space-between" align="center" gap="sm" style={{ flexWrap: "wrap" }}>
          <Stack gap={8} miw={240} style={{ flex: 1 }}>
            <Text size="sm" fw={600} c={isDark ? "gray.2" : "dark.7"}>
              Zoom
            </Text>
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={setZoom}
              label={(value) => `${value.toFixed(2)}x`}
            />
          </Stack>

          <Group gap="sm">
            <Button
              variant="default"
              onClick={() => resetView()}
              disabled={!canRenderCropper || applying}
            >
              Reset
            </Button>
            <Button variant={isDark ? "default" : "subtle"} onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button color="blue" onClick={handleApply} loading={applying} disabled={!canRenderCropper}>
              Apply crop
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
