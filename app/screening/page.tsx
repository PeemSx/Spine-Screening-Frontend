"use client";

import { useEffect, useState } from "react";
import { Box, Card, Container, Grid, Image, Stack, Text, Title } from "@mantine/core";
import { ClinicalNotice } from "@/features/screening/components/ClinicalNotice";
import { MeasurementsPanel } from "@/features/screening/components/MeasurementsPanel";
import { PredictionOverlay } from "@/features/screening/components/PredictionOverlay";
import { UploadPanel } from "@/features/screening/components/UploadPanel";
import { usePrediction } from "@/features/screening/hooks/usePrediction";
import type { ImageInfo } from "@/features/screening/api/generated";

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OriginalImagePanel({
  file,
  imageUrl,
  imageInfo,
}: {
  file: File;
  imageUrl: string;
  imageInfo: ImageInfo | null;
}) {
  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={4}>Original image</Title>
          <Text c="dimmed" size="xs">
            Exact raster submitted to the screening API
          </Text>
        </Stack>

        <Box
          bg="black"
          style={{
            alignItems: "center",
            borderRadius: 8,
            display: "flex",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image
            alt="Original submitted AP or PA radiograph"
            src={imageUrl}
            style={{
              display: "block",
              height: "auto",
              maxHeight: "70vh",
              maxWidth: "100%",
              width: "auto",
            }}
          />
        </Box>

        <Stack gap={2}>
          <Text fw={600} size="sm" lineClamp={1}>{file.name}</Text>
          <Text c="dimmed" size="xs">
            {formatFileSize(file.size)}
            {imageInfo ? ` · ${imageInfo.width} × ${imageInfo.height} px` : ""}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}

export default function ScreeningPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const prediction = usePrediction();

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    const result = prediction.result;
    if (!result) {
      setSelectedCandidateId(null);
      return;
    }

    setSelectedCandidateId(
      result.morphology[0]?.candidate_id ??
        result.selected_vertebrae[0]?.candidate_id ??
        null,
    );
  }, [prediction.result]);

  const handleSelect = (nextFile: File) => {
    prediction.reset();
    setSelectedCandidateId(null);
    setFile(nextFile);
  };

  const handleClear = () => {
    prediction.reset();
    setSelectedCandidateId(null);
    setFile(null);
  };

  const handleSubmit = () => {
    if (file) void prediction.run(file);
  };

  const result = prediction.result;

  return (
    <Container size="xxl" pt="md" pb="xl">
      <ClinicalNotice
        clinicalReviewRequired={result?.clinical_review_required ?? true}
        disclaimer={result?.disclaimer}
        warnings={result?.warnings}
      />

      <Stack align="center" gap="xs" mb="xl">
        <Title order={1} size="h2" ta="center">Spine screening workspace</Title>
        <Text c="dimmed" maw={760} ta="center">
          Upload one AP or PA radiograph to review vertebral landmarks, Cobb geometry, and
          height-focused morphology measurements.
        </Text>
      </Stack>

      <UploadPanel
        error={prediction.error}
        file={file}
        onCancel={prediction.cancel}
        onClear={handleClear}
        onSelect={handleSelect}
        onSubmit={handleSubmit}
        status={prediction.status}
      />

      {file && imageUrl ? (
        <Grid gutter="lg" align="flex-start">
          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <OriginalImagePanel file={file} imageInfo={result?.image ?? null} imageUrl={imageUrl} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <PredictionOverlay
              cobb={result?.cobb ?? null}
              image={result?.image ?? null}
              imageUrl={imageUrl}
              onSelectCandidate={setSelectedCandidateId}
              selectedCandidateId={selectedCandidateId}
              status={prediction.status}
              vertebrae={result?.selected_vertebrae ?? []}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 12, xl: 4 }}>
            <MeasurementsPanel
              morphology={result?.morphology ?? []}
              onSelectCandidate={setSelectedCandidateId}
              selectedCandidateId={selectedCandidateId}
              status={prediction.status}
              vertebrae={result?.selected_vertebrae ?? []}
            />
          </Grid.Col>
        </Grid>
      ) : null}
    </Container>
  );
}
