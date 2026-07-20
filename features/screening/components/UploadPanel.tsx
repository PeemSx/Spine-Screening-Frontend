"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconAlertCircle, IconPlayerPlay, IconUpload, IconX } from "@tabler/icons-react";
import {
  SCREENING_IMAGE_MIME_TYPES,
  SCREENING_MAX_UPLOAD_BYTES,
} from "@/config/env";
import { ExampleSelector } from "@/components/common/ExampleSelector";
import { AP_EXAMPLE_OPTIONS } from "@/lib/exampleData";
import type { ExampleSelection } from "@/types/examples";
import type { ScreeningApiError } from "../api/errors";
import type { PredictionStatus } from "../hooks/usePrediction";

interface UploadPanelProps {
  file: File | null;
  status: PredictionStatus;
  error: ScreeningApiError | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel({
  file,
  status,
  error,
  onSelect,
  onClear,
  onSubmit,
  onCancel,
}: UploadPanelProps) {
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const isSubmitting = status === "submitting";

  const selectFile = (selectedFile: File) => {
    setRejectionMessage(null);
    onSelect(selectedFile);
  };

  const handleExampleSelect = ({ file: selectedFile }: ExampleSelection) => {
    selectFile(selectedFile);
  };

  return (
    <Paper withBorder shadow="xs" p="lg" mb="xl" radius="md">
      <Stack gap="md">
        <Dropzone
          accept={SCREENING_IMAGE_MIME_TYPES}
          disabled={isSubmitting}
          maxSize={SCREENING_MAX_UPLOAD_BYTES}
          multiple={false}
          onDrop={(files) => {
            if (files[0]) selectFile(files[0]);
          }}
          onReject={(rejections) => {
            const message = rejections[0]?.errors[0]?.message;
            setRejectionMessage(
              message ?? "Select one JPEG or PNG radiograph no larger than 20 MB.",
            );
          }}
        >
          <Group justify="center" mih={116}>
            <Stack gap={6} align="center">
              <IconUpload size={28} stroke={1.6} />
              <Title order={4}>Drop one AP or PA radiograph here</Title>
              <Text c="dimmed" size="sm" ta="center">
                Click to browse · JPEG or PNG · up to 20 MB
              </Text>
            </Stack>
          </Group>
        </Dropzone>

        <Group justify="space-between" align="center" gap="md" style={{ flexWrap: "wrap" }}>
          <Stack gap={2}>
            {file ? (
              <>
                <Text fw={600}>{file.name}</Text>
                <Text c="dimmed" size="sm">
                  {formatFileSize(file.size)} · This exact raster will be used for the overlay.
                </Text>
              </>
            ) : (
              <Text c="dimmed" size="sm">
                No image selected
              </Text>
            )}
          </Stack>

          <Group gap="sm">
            <ExampleSelector
              examples={AP_EXAMPLE_OPTIONS}
              onSelect={handleExampleSelect}
              buttonLabel="Choose example"
              description="Loads a bundled AP or PA demo radiograph"
            />
            {file ? (
              <Button
                color="gray"
                disabled={isSubmitting}
                leftSection={<IconX size={16} />}
                onClick={onClear}
                variant="subtle"
              >
                Clear
              </Button>
            ) : null}
            {isSubmitting ? (
              <Button color="gray" onClick={onCancel} variant="default">
                Cancel
              </Button>
            ) : (
              <Button
                disabled={!file}
                leftSection={<IconPlayerPlay size={16} />}
                onClick={onSubmit}
              >
                Run screening
              </Button>
            )}
          </Group>
        </Group>

        <Text aria-live="polite" c="dimmed" size="sm">
          {status === "submitting"
            ? "Screening is running. This may take a moment."
            : status === "success"
              ? "Screening measurements are ready."
              : "Results will remain in this browser session only."}
        </Text>

        {rejectionMessage ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert" title="Unsupported image">
            {rejectionMessage}
          </Alert>
        ) : null}

        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert" title="Screening failed">
            {error.message}
            {error.requestId ? ` Request ID: ${error.requestId}.` : ""}
            {error.retryAfterSeconds !== null
              ? ` Try again in approximately ${error.retryAfterSeconds} seconds.`
              : ""}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
