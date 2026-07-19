"use client";

import { useEffect, useState } from "react";
import { Button, Container, Group, Loader, Paper, SimpleGrid, Stack, Text, Title, useComputedColorScheme } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { IconBrain, IconCrop, IconUpload } from "@tabler/icons-react";
import { ImageCropModal } from "@/components/common/ImageCropModal";
import { ExampleSelector } from "@/components/common/ExampleSelector";
import { ResultImageCard } from "@/components/layout/ResultImageCard";
import { LA_EXAMPLE_OPTIONS } from "@/lib/exampleData";
import { BACKEND_URL, predictLAXray } from "@/lib/api";
import type { LaPredictionResult } from "@/schemas/prediction";
import type { ExampleSelection } from "@/types/examples";

export default function Page() {
  const colorScheme = useComputedColorScheme("light");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cropOpened, setCropOpened] = useState(false);
  const [isCropped, setIsCropped] = useState(false);
  const [result, setResult] = useState<LaPredictionResult | null>(null);
  const [mounted, setMounted] = useState(false);

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
      const res = await predictLAXray(file);
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

  const avgConfidenceValue = result?.avg_confidence ?? null;
  const numDetectionsValue = result?.num_detections ?? null;
  const avgConfidenceText =
    avgConfidenceValue !== null ? `${(avgConfidenceValue * 100).toFixed(1)}%` : "-";

  return (
    <Container size="xxl" py="xl">
      <Stack align="center" mb="xl">
        <Title order={2}>LA Detection Results</Title>
        <Text c={isDark ? "gray.4" : "dimmed"}>Visualize AI analysis on your uploaded LA X-ray</Text>
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
              <Title order={4}>Drop your LA X-ray here</Title>
              <Text c="dimmed" size="sm">
                or click to browse (PNG, JPG, JPEG up to 10 MB)
              </Text>
            </Stack>
          </Group>
        </Dropzone>

        {LA_EXAMPLE_OPTIONS.length > 0 && (
          <Group
            justify="space-between"
            align="center"
            mt="md"
            gap="sm"
            style={{ flexWrap: "wrap" }}
          >
            <Text size="sm" c={isDark ? "gray.4" : "dimmed"}>
              Need a sample LA X-ray for the demo?
            </Text>
            <ExampleSelector
              examples={LA_EXAMPLE_OPTIONS}
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
                  Crop is optional. Keep the vertebral column centered and trim away empty margins
                  before running LA detection.
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

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <ResultImageCard
          icon={<IconUpload size={20} />}
          title="1 Selected Image"
          src={preview ?? ""}
          caption={isCropped ? "Cropped image used for detection" : "Original uploaded X-ray"}
        />
        <ResultImageCard
          icon={<IconBrain size={20} />}
          title="2 Predictions"
          src={predictionImageSrc}
          caption={
            avgConfidenceValue !== null && numDetectionsValue !== null
              ? `Avg confidence: ${avgConfidenceText} | Detections: ${numDetectionsValue}`
              : "Run the model to view detections"
          }
        />
      </SimpleGrid>

      <ImageCropModal
        opened={cropOpened}
        file={sourceFile ?? file}
        title="Crop LA X-ray"
        onClose={() => setCropOpened(false)}
        onApply={handleCropApply}
      />
    </Container>
  );
}
