"use client";
import { Container, SimpleGrid, Stack, Title, Text, Group, Paper, Button, Loader } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { IconUpload, IconBrain } from "@tabler/icons-react";
import { ResultImageCard } from "@/components/layout/ResultImageCard";
import { ExampleSelector, type ExampleSelection } from "@/components/common/ExampleSelector";
import { useState, useEffect } from "react";
import { predictLAXray, BACKEND_URL } from "@/lib/api";
import type { LaPredictionResult } from "@/schemas/prediction";
import { LA_EXAMPLE_OPTIONS } from "@/lib/exampleData";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaPredictionResult | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);

  const handleExampleSelect = ({ file: selectedFile }: ExampleSelection) => {
    setFile(selectedFile);
    setResult(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await predictLAXray(file);
      setResult(res);
    } catch (e) {
      console.error(e);
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
        <Text c="dimmed">Visualize AI analysis on your uploaded LA X-ray</Text>
      </Stack>

      <Paper withBorder shadow="xs" p="md" mb="xl" radius="md">
        <Dropzone
          maxSize={10 * 1024 ** 2}
          accept={IMAGE_MIME_TYPE}
          onDrop={(files) => {
            if (files?.length) {
              setFile(files[0]);
              setResult(null);
            }
          }}
        >
          <Group justify="center" mih={120}>
            <Stack gap="xs" align="center">
              <Title order={4}>Drop your LA X-ray here</Title>
              <Text c="dimmed" size="sm">or click to browse (PNG, JPG, JPEG up to 10 MB)</Text>
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
            <Text size="sm" c="dimmed">Need a sample LA X-ray for the demo?</Text>
            <ExampleSelector
              examples={LA_EXAMPLE_OPTIONS}
              onSelect={handleExampleSelect}
              buttonLabel="Choose example"
              description="Loads a demo image from the gallery"
            />
          </Group>
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
          title="1 Upload & Run"
          src={preview ?? ""}
          caption="Original uploaded X-ray"
        />
        <ResultImageCard
          icon={<IconBrain size={20} />}
          title="2 Predictions"
          src={predictionImageSrc}
          caption={
            avgConfidenceValue !== null && numDetectionsValue !== null
              ? `Avg confidence: ${avgConfidenceText} • Detections: ${numDetectionsValue}`
              : "Run the model to view detections"
          }
        />
      </SimpleGrid>
    </Container>
  );
}
