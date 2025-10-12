"use client";
import { Container, SimpleGrid, Stack, Title, Text, Group, Paper, Button, Loader } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { IconUpload, IconBrain, IconTemperature } from "@tabler/icons-react";
import { ResultImageCard } from "@/components/ResultImageCard";
import { useState, useEffect } from "react";
import { predictAPXray, BACKEND_URL, type ApPredictionResult } from "@/lib/api";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApPredictionResult | null>(null); 

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);

  const handleRun = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await predictAPXray(file);
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

  const heatmapImageSrc =
    result?.heatmap_image
      ? result.heatmap_image.startsWith("http")
        ? result.heatmap_image
        : `${BACKEND_URL}${result.heatmap_image}`
      : "";

  return (
    <Container size="xxl" py="xl">
      <Stack align="center" mb="xl">
        <Title order={2}>AP Detection Results</Title>
        <Text c="dimmed">Visualize AI analysis on your uploaded AP X-ray</Text>
      </Stack>

      <Paper withBorder shadow="xs" p="md" mb="xl" radius="md">
        <Dropzone
          maxSize={10 * 1024 ** 2}
          accept={IMAGE_MIME_TYPE}
          onDrop={(files) => files?.length && setFile(files[0])}
        >
          <Group justify="center" mih={120}>
            <Stack gap="xs" align="center">
              <Title order={4}>Drop your AP X-ray here</Title>
              <Text c="dimmed" size="sm">or click to browse (PNG, JPG, JPEG up to 10 MB)</Text>
            </Stack>
          </Group>
        </Dropzone>
      </Paper>

      <Group justify="center" m="md">
        <Button size="md" radius="md" onClick={handleRun} disabled={!file || loading}>
          {loading ? <Loader size="sm" color="white" /> : "Run Detection"}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
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
          caption="Detected vertebrae and confidence values"
        />
        <ResultImageCard
          icon={<IconTemperature size={20} />}
          title="3 Heatmap"
          src={heatmapImageSrc}
          caption={`Cobb angle: ${result ? result.cobb_angle : "-"}°`}
        />
      </SimpleGrid>
    </Container>
  );
}
