"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  FileButton,
  Grid,
  Group,
  Image,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconAlertCircle,
  IconPlayerPlay,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SCREENING_IMAGE_MIME_TYPES,
  SCREENING_MAX_UPLOAD_BYTES,
  SCREENING_REQUEST_TIMEOUT_MS,
} from "@/config/env";
import { createLAPrediction } from "@/features/screening/api/client";
import type { LAPredictionResponse } from "@/features/screening/api/contract";
import {
  normalizeScreeningError,
  ScreeningApiError,
} from "@/features/screening/api/errors";
import { ClinicalNotice } from "@/features/screening/components/ClinicalNotice";
import { LateralMeasurementsPanel } from "@/features/screening/components/LateralMeasurementsPanel";
import { LateralPredictionOverlay } from "@/features/screening/components/LateralPredictionOverlay";
import type { PredictionStatus } from "@/features/screening/types";

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File) {
  if (!SCREENING_IMAGE_MIME_TYPES.includes(file.type)) {
    return "Use a JPEG or PNG image.";
  }
  if (file.size > SCREENING_MAX_UPLOAD_BYTES) {
    return "The image exceeds the 20 MB upload limit.";
  }
  return null;
}

export default function LateralPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LAPredictionResponse | null>(null);
  const [status, setStatus] = useState<PredictionStatus>("idle");
  const [error, setError] = useState<ScreeningApiError | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null,
  );
  const controllerRef = useRef<AbortController | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);

  const selectFile = useCallback((nextFile: File | null) => {
    if (!nextFile) return;
    const validationError = validateFile(nextFile);
    if (validationError) {
      setFileError(validationError);
      return;
    }

    requestSequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setFile(nextFile);
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = URL.createObjectURL(nextFile);
    setImageUrl(imageUrlRef.current);
    setResult(null);
    setStatus("idle");
    setError(null);
    setFileError(null);
    setSelectedCandidateId(null);
  }, []);

  const clear = useCallback(() => {
    requestSequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = null;
    setImageUrl(null);
    setFile(null);
    setResult(null);
    setStatus("idle");
    setError(null);
    setFileError(null);
    setSelectedCandidateId(null);
  }, []);

  useEffect(() => {
    return () => {
      requestSequenceRef.current += 1;
      controllerRef.current?.abort();
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const runAssessment = async () => {
    if (!file || status === "submitting") return;

    const controller = new AbortController();
    controllerRef.current = controller;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SCREENING_REQUEST_TIMEOUT_MS);

    setStatus("submitting");
    setError(null);
    setResult(null);
    setSelectedCandidateId(null);

    try {
      const response = await createLAPrediction(file, {
        signal: controller.signal,
      });
      if (requestSequenceRef.current !== requestSequence) return;
      setResult(response);
      setSelectedCandidateId(
        response.selected_vertebrae[0]?.candidate_id ?? null,
      );
      setStatus("success");
    } catch (requestError) {
      if (requestSequenceRef.current !== requestSequence) return;
      const normalized = timedOut
        ? new ScreeningApiError({
            message: "The lateral assessment timed out. Please try again.",
            code: "request_timeout",
          })
        : normalizeScreeningError(requestError);
      setError(normalized);
      setStatus("error");
    } finally {
      window.clearTimeout(timeoutId);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  return (
    <Container size="xxl" py="md">
      <ClinicalNotice
        clinicalReviewRequired={result?.clinical_review_required ?? true}
        disclaimer={result?.disclaimer}
        warnings={result?.warnings}
      />

      <Stack align="center" gap="xs" mb="xl">
        <Title order={1} size="h2" ta="center">
          Lateral spine assessment
        </Title>
        <Text c="dimmed" maw={760} ta="center">
          Upload one anonymized lateral radiograph to review six vertebral
          keypoints and four-outer-landmark geometry agreement.
        </Text>
        <Text c="dimmed" maw={760} size="sm" ta="center">
          LA geometry is not a clinical AP/PA Cobb measurement.
        </Text>
      </Stack>

      <Paper withBorder shadow="xs" p="lg" mb="xl" radius="md">
        <Stack gap="md">
          <Dropzone
            accept={SCREENING_IMAGE_MIME_TYPES}
            disabled={status === "submitting"}
            maxFiles={1}
            maxSize={SCREENING_MAX_UPLOAD_BYTES}
            multiple={false}
            onDrop={(files) => selectFile(files[0] ?? null)}
            onReject={() => setFileError("Use one JPEG or PNG image no larger than 20 MB.")}
          >
            <Group justify="center" mih={116}>
              <Stack align="center" gap={6}>
                <IconUpload size={28} stroke={1.6} />
                <Title order={4}>
                  {file ? "Drop a different lateral radiograph here" : "Drop a lateral radiograph here"}
                </Title>
                <Text c="dimmed" size="sm" ta="center">
                  One anonymized JPEG or PNG image · 20 MB maximum
                </Text>
              </Stack>
            </Group>
          </Dropzone>

          <Group justify="space-between">
            <Stack gap={1} style={{ minWidth: 0 }}>
              <Text fw={600} lineClamp={1} size="sm">
                {file?.name ?? "No image selected"}
              </Text>
              <Text c="dimmed" size="xs">
                {file ? `${formatFileSize(file.size)} · browser session only` : "The service does not retain uploads or results."}
              </Text>
            </Stack>

            <Group gap="xs">
              <FileButton
                accept={SCREENING_IMAGE_MIME_TYPES.join(",")}
                onChange={selectFile}
              >
                {(props) => (
                  <Button
                    {...props}
                    disabled={status === "submitting"}
                    leftSection={<IconUpload size={16} />}
                    variant="default"
                  >
                    {file ? "Replace image" : "Choose image"}
                  </Button>
                )}
              </FileButton>
              {file ? (
                <Button
                  disabled={status === "submitting"}
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={status === "submitting"}
                  onClick={runAssessment}
                >
                  Run lateral assessment
                </Button>
              ) : null}
              {file ? (
                <Button
                  color="red"
                  disabled={status === "submitting"}
                  leftSection={<IconTrash size={16} />}
                  onClick={clear}
                  variant="subtle"
                >
                  Clear
                </Button>
              ) : null}
            </Group>
          </Group>
        </Stack>

        {fileError ? (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={18} />}
            mt="md"
            onClose={() => setFileError(null)}
            role="alert"
            title="Image not added"
            withCloseButton
          >
            {fileError}
          </Alert>
        ) : null}
      </Paper>

      {error ? (
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          mb="lg"
          role="alert"
          title="Lateral assessment failed"
        >
          {error.message}
          {error.requestId ? ` Request ID: ${error.requestId}.` : ""}
        </Alert>
      ) : null}

      {file && imageUrl ? (
        <Grid gutter="lg" align="flex-start">
          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <Card withBorder radius="md" p="md" shadow="sm">
              <Stack gap="md">
                <Stack gap={2}>
                  <Title order={4}>Original lateral image</Title>
                  <Text c="dimmed" size="xs">Exact raster submitted to the LA API</Text>
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
                    alt="Original submitted lateral radiograph"
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
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
            <LateralPredictionOverlay
              cobb={result?.cobb ?? null}
              image={result?.image ?? null}
              imageUrl={imageUrl}
              onSelectCandidate={setSelectedCandidateId}
              selectedCandidateId={selectedCandidateId}
              status={status}
              vertebrae={result?.selected_vertebrae ?? []}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, xl: 4 }}>
            <LateralMeasurementsPanel
              cobb={result?.cobb ?? null}
              onSelectCandidate={setSelectedCandidateId}
              selectedCandidateId={selectedCandidateId}
              status={status}
              vertebrae={result?.selected_vertebrae ?? []}
            />
          </Grid.Col>
        </Grid>
      ) : null}
    </Container>
  );
}
