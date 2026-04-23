"use client";

import { useEffect, useState } from "react";
import { ActionIcon, Box, Button, Container, Group, Loader, Paper, SimpleGrid, Stack, Switch, Text, Title, Tooltip, useComputedColorScheme } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { IconBrain, IconChevronLeft, IconChevronRight, IconCrop, IconTemperature, IconUpload } from "@tabler/icons-react";
import { ImageCropModal } from "@/components/common/ImageCropModal";
import { ExampleSelector } from "@/components/common/ExampleSelector";
import { ResultImageCard } from "@/components/layout/ResultImageCard";
import { AP_EXAMPLE_OPTIONS } from "@/lib/exampleData";
import { BACKEND_URL, predictAPXray, type ApPredictionResult } from "@/lib/api";
import type { ExampleSelection } from "@/types/examples";

const formatCobbDisplayAngles = (angles?: number[]) => {
  if (!angles || angles.length <= 1) return "";
  const labels = angles.length >= 3 ? ["U", "M", "L"] : ["U", "L"];
  return angles.map((angle, index) => `${labels[index] ?? index + 1} ${angle} deg`).join(", ");
};

type ApViewOption = "selected" | "prediction" | "heatmap" | "captions";

export default function Page() {
  const colorScheme = useComputedColorScheme("light");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cropOpened, setCropOpened] = useState(false);
  const [isCropped, setIsCropped] = useState(false);
  const [result, setResult] = useState<ApPredictionResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [viewPanelOpened, setViewPanelOpened] = useState(true);
  const [viewOptions, setViewOptions] = useState<Record<ApViewOption, boolean>>({
    selected: true,
    prediction: true,
    heatmap: true,
    captions: true,
  });

  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleNewFile = (selectedFile: File) => {
    setSourceFile(selectedFile);
    setFile(selectedFile);
    setIsCropped(false);
    setResult(null);
  };

  const handleExampleSelect = ({ file: selectedFile }: ExampleSelection) => {
    handleNewFile(selectedFile);
  };

  const handleClearSelection = () => {
    setSourceFile(null);
    setFile(null);
    setCropOpened(false);
    setIsCropped(false);
    setResult(null);
  };

  const handleRestoreOriginal = () => {
    if (!sourceFile) return;
    setFile(sourceFile);
    setIsCropped(false);
    setResult(null);
  };

  const handleCropApply = (croppedFile: File) => {
    setFile(croppedFile);
    setIsCropped(true);
    setCropOpened(false);
    setResult(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const res = await predictAPXray(file);
      setResult(res);
    } catch (error) {
      console.error(error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const predictionImageSrc =
    result?.pred_image
      ? result.pred_image.startsWith("http")
        ? result.pred_image
        : `${BACKEND_URL}${result.pred_image}`
      : "";

  const heatmapImageSrc =
    result?.heatmap_image
      ? result.heatmap_image.startsWith("http")
        ? result.heatmap_image
        : `${BACKEND_URL}${result.heatmap_image}`
      : "";

  const cobbDisplayAngleText = formatCobbDisplayAngles(result?.cobb_display_angles);
  const cobbAngleCaption = cobbDisplayAngleText
    ? `Cobb angles: ${cobbDisplayAngleText}`
    : `Cobb angle: ${result?.cobb_angle ?? "-"} deg`;
  const cobbPairCaption =
    result?.cobb_vertebra_pairs && result.cobb_vertebra_pairs.length > 0
      ? result.cobb_vertebra_pairs
          .map((pair) => `${pair.label}: V${pair.vertebrae[0]}-V${pair.vertebrae[1]}`)
          .join(", ")
      : "";
  const predictionCaption = cobbPairCaption
    ? `Detected vertebrae and Cobb reference lines (${cobbPairCaption})`
    : "Detected vertebrae and confidence values";

  const resultCards = [
    viewOptions.selected
      ? (
        <ResultImageCard
          key="selected"
          icon={<IconUpload size={20} />}
          title="1 Selected Image"
          src={preview ?? ""}
          caption={viewOptions.captions ? (isCropped ? "Cropped image used for detection" : "Original uploaded X-ray") : undefined}
        />
      )
      : null,
    viewOptions.prediction
      ? (
        <ResultImageCard
          key="prediction"
          icon={<IconBrain size={20} />}
          title="2 Predictions"
          src={predictionImageSrc}
          caption={viewOptions.captions ? predictionCaption : undefined}
        />
      )
      : null,
    viewOptions.heatmap
      ? (
        <ResultImageCard
          key="heatmap"
          icon={<IconTemperature size={20} />}
          title="3 Heatmap"
          src={heatmapImageSrc}
          caption={viewOptions.captions ? cobbAngleCaption : undefined}
        />
      )
      : null,
  ].filter(Boolean);

  const updateViewOption = (key: ApViewOption, checked: boolean) => {
    setViewOptions((current) => ({ ...current, [key]: checked }));
  };

  return (
    <Container size="xxl" py="xl">
      <Box
        style={{
          position: "fixed",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 300,
        }}
      >
        {viewPanelOpened ? (
          <Paper
            withBorder
            shadow="md"
            radius="md"
            p="sm"
            style={{
              width: 230,
              background: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Group justify="space-between" align="center" mb="xs">
              <Text fw={700} size="sm">
                View
              </Text>
              <Tooltip label="Hide panel" position="right">
                <ActionIcon
                  aria-label="Hide view panel"
                  variant="subtle"
                  color="gray"
                  onClick={() => setViewPanelOpened(false)}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Stack gap="xs">
              <Switch
                size="sm"
                label="Selected image"
                checked={viewOptions.selected}
                onChange={(event) => updateViewOption("selected", event.currentTarget.checked)}
              />
              <Switch
                size="sm"
                label="Predictions"
                checked={viewOptions.prediction}
                onChange={(event) => updateViewOption("prediction", event.currentTarget.checked)}
              />
              <Switch
                size="sm"
                label="Heatmap"
                checked={viewOptions.heatmap}
                onChange={(event) => updateViewOption("heatmap", event.currentTarget.checked)}
              />
              <Switch
                size="sm"
                label="Captions"
                checked={viewOptions.captions}
                onChange={(event) => updateViewOption("captions", event.currentTarget.checked)}
              />
            </Stack>
          </Paper>
        ) : (
          <Tooltip label="Show view panel" position="right">
            <ActionIcon
              aria-label="Show view panel"
              size="xl"
              radius="md"
              variant="filled"
              color="blue"
              onClick={() => setViewPanelOpened(true)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Box>

      <Stack align="center" mb="xl">
        <Title order={2}>AP Detection Results</Title>
        <Text c={isDark ? "gray.4" : "dimmed"}>Visualize AI analysis on your uploaded AP X-ray</Text>
      </Stack>

      <Paper withBorder shadow="xs" p="md" mb="xl" radius="md">
        <Dropzone
          maxSize={10 * 1024 ** 2}
          accept={IMAGE_MIME_TYPE}
          onDrop={(files) => {
            if (files?.length) {
              handleNewFile(files[0]);
            }
          }}
        >
          <Group justify="center" mih={120}>
            <Stack gap="xs" align="center">
              <Title order={4}>Drop your AP X-ray here</Title>
              <Text c="dimmed" size="sm">
                or click to browse (PNG, JPG, JPEG up to 10 MB)
              </Text>
            </Stack>
          </Group>
        </Dropzone>

        {AP_EXAMPLE_OPTIONS.length > 0 && (
          <Group
            justify="space-between"
            align="center"
            mt="md"
            gap="sm"
            style={{ flexWrap: "wrap" }}
          >
            <Text size="sm" c={isDark ? "gray.4" : "dimmed"}>
              Need a sample AP X-ray for the demo?
            </Text>
            <ExampleSelector
              examples={AP_EXAMPLE_OPTIONS}
              onSelect={handleExampleSelect}
              buttonLabel="Choose example"
              description="Loads a demo image from the gallery"
            />
          </Group>
        )}

        {file && (
          <Paper
            mt="md"
            p="md"
            radius="md"
            withBorder
            styles={{
              root: {
                background: isDark
                  ? "linear-gradient(160deg, rgba(17, 24, 39, 0.96), rgba(30, 41, 59, 0.9))"
                  : "linear-gradient(160deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.94))",
                borderColor: isDark ? "rgba(96, 165, 250, 0.18)" : "rgba(148, 163, 184, 0.16)",
                boxShadow: isDark
                  ? "0 18px 36px rgba(0, 0, 0, 0.22)"
                  : "0 14px 28px rgba(15, 23, 42, 0.06)",
              },
            }}
          >
            <Group justify="space-between" align="center" gap="md" style={{ flexWrap: "wrap" }}>
              <Stack gap={4}>
                <Text fw={600} c={isDark ? "gray.1" : "dark.8"}>
                  {isCropped ? "Cropped image ready" : "Image ready"}
                </Text>
                <Text size="sm" c={isDark ? "gray.4" : "dimmed"}>
                  {file.name}
                </Text>
                <Text size="sm" c={isDark ? "gray.4" : "dimmed"}>
                  Crop is optional. Keep the spine centered and trim excess blank margins before
                  running AP detection.
                </Text>
              </Stack>

              <Group gap="sm">
                <Button
                  variant={isDark ? "filled" : "light"}
                  color="blue"
                  leftSection={<IconCrop size={16} />}
                  onClick={() => setCropOpened(true)}
                >
                  {isCropped ? "Adjust crop" : "Crop image"}
                </Button>
                {isCropped && sourceFile ? (
                  <Button variant="default" onClick={handleRestoreOriginal}>
                    Use original
                  </Button>
                ) : null}
                <Button variant={isDark ? "default" : "subtle"} color="gray" onClick={handleClearSelection}>
                  Clear
                </Button>
              </Group>
            </Group>
          </Paper>
        )}
      </Paper>

      <Group justify="center" m="md">
        <Button size="md" radius="md" onClick={handleRun} disabled={!file || loading}>
          {loading ? <Loader size="sm" color="white" /> : "Run Detection"}
        </Button>
      </Group>

      {resultCards.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: Math.min(resultCards.length, 3) }} spacing="lg">
          {resultCards}
        </SimpleGrid>
      ) : (
        <Paper withBorder p="md" radius="md">
          <Text ta="center" c={isDark ? "gray.4" : "dimmed"}>
            No result views selected.
          </Text>
        </Paper>
      )}

      <ImageCropModal
        opened={cropOpened}
        file={sourceFile ?? file}
        title="Crop AP X-ray"
        onClose={() => setCropOpened(false)}
        onApply={handleCropApply}
      />
    </Container>
  );
}
