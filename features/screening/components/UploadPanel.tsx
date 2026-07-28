"use client";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  FileButton,
  Group,
  List,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconFlag,
  IconListDetails,
  IconPlayerPlay,
  IconRefresh,
  IconSquare,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import {
  SCREENING_IMAGE_MIME_TYPES,
  SCREENING_MAX_UPLOAD_BYTES,
} from "@/config/env";
import { ExampleSelector } from "@/components/common/ExampleSelector";
import { SCREENING_EXAMPLE_OPTIONS } from "@/lib/exampleData";
import type { ExampleSelection } from "@/types/examples";
import type {
  AddFilesResult,
  PredictionFileRejection,
} from "../bulk/types";

interface UploadPanelProps {
  activeFileName: string | null;
  failedCount: number;
  hasCompletedResults: boolean;
  hasSignalItems: boolean;
  isProcessing: boolean;
  itemCount: number;
  processedCount: number;
  progressPercent: number;
  queuedCount: number;
  selectedIndex: number;
  showQueueButton: boolean;
  onAddFiles: (files: readonly File[]) => AddFilesResult;
  onClear: () => void;
  onNext: () => void;
  onNextSignal: () => void;
  onOpenQueue: () => void;
  onPrevious: () => void;
  onRetryFailed: () => void;
  onRun: () => void;
  onStop: () => void;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

interface RejectionNotice {
  fileName: string;
  reason: string;
}

function rejectionNotice(
  rejection: PredictionFileRejection,
): RejectionNotice {
  const reasons: Record<PredictionFileRejection["code"], string> = {
    unsupported_type: "Use a JPEG or PNG image.",
    file_too_large: "The image exceeds the 20 MB limit.",
    duplicate: "This image is already in the batch.",
    batch_limit: "The batch already contains 20 images.",
  };
  return {
    fileName: rejection.file.name,
    reason: reasons[rejection.code],
  };
}

export function UploadPanel({
  activeFileName,
  failedCount,
  hasCompletedResults,
  hasSignalItems,
  isProcessing,
  itemCount,
  processedCount,
  progressPercent,
  queuedCount,
  selectedIndex,
  showQueueButton,
  onAddFiles,
  onClear,
  onNext,
  onNextSignal,
  onOpenQueue,
  onPrevious,
  onRetryFailed,
  onRun,
  onStop,
}: UploadPanelProps) {
  const [rejectionNotices, setRejectionNotices] = useState<RejectionNotice[]>(
    [],
  );
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);

  const addFiles = (files: readonly File[]) => {
    const result = onAddFiles(files);
    setRejectionNotices(result.rejected.map(rejectionNotice));
  };

  const handleExampleSelect = ({ file }: ExampleSelection) => {
    addFiles([file]);
  };

  const requestClear = () => {
    if (hasCompletedResults || isProcessing) {
      setClearConfirmationOpen(true);
      return;
    }
    onClear();
  };

  const confirmClear = () => {
    setClearConfirmationOpen(false);
    setRejectionNotices([]);
    onClear();
  };

  return (
    <>
      <Paper withBorder shadow="xs" p="lg" mb="xl" radius="md">
        {itemCount === 0 ? (
          <Stack gap="md">
            <Dropzone
              accept={SCREENING_IMAGE_MIME_TYPES}
              maxSize={SCREENING_MAX_UPLOAD_BYTES}
              multiple
              onDrop={() => undefined}
              onDropAny={(files, rejections) => {
                const result = onAddFiles(files);
                setRejectionNotices(
                  [
                    ...result.rejected.map(rejectionNotice),
                    ...rejections.map((rejection) => ({
                      fileName: rejection.file.name,
                      reason:
                        rejection.errors
                          .map((error) => error.message)
                          .filter(Boolean)
                          .join(" ") ||
                        "Use a JPEG or PNG image no larger than 20 MB.",
                    })),
                  ],
                );
              }}
            >
              <Group justify="center" mih={116}>
                <Stack gap={6} align="center">
                  <IconUpload size={28} stroke={1.6} />
                  <Title order={4}>Drop AP or PA radiographs here</Title>
                  <Text c="dimmed" size="sm" ta="center">
                    Select up to 20 JPEG or PNG images · 20 MB per image
                  </Text>
                </Stack>
              </Group>
            </Dropzone>

            <Group justify="space-between" gap="md">
              <Text c="dimmed" size="sm">
                Results remain in this browser session only.
              </Text>
              <ExampleSelector
                examples={SCREENING_EXAMPLE_OPTIONS}
                onSelect={handleExampleSelect}
                buttonLabel="Choose example"
                description="Adds a bundled AP or PA demo radiograph"
              />
            </Group>
          </Stack>
        ) : (
          <Stack gap="md">
            <Group align="center" justify="space-between" gap="md">
              <Stack aria-live="polite" gap={2}>
                <Text fw={700}>
                  {processedCount} of {itemCount} processed
                </Text>
                <Text c="dimmed" lineClamp={1} size="sm">
                  {isProcessing
                    ? `Running ${activeFileName ?? "the next image"}`
                    : queuedCount > 0
                      ? `${plural(queuedCount, "image")} ready to run`
                      : failedCount > 0
                        ? `${plural(failedCount, "image")} failed`
                        : "All queued images have been processed"}
                </Text>
              </Stack>

              <Group gap="xs" wrap="wrap">
                <FileButton
                  accept={SCREENING_IMAGE_MIME_TYPES.join(",")}
                  multiple
                  onChange={addFiles}
                >
                  {(props) => (
                    <Button
                      {...props}
                      leftSection={<IconUpload size={16} />}
                      size="xs"
                      variant="default"
                    >
                      Add images
                    </Button>
                  )}
                </FileButton>

                <ExampleSelector
                  examples={SCREENING_EXAMPLE_OPTIONS}
                  onSelect={handleExampleSelect}
                  buttonLabel="Add example"
                  description="Adds a bundled AP or PA demo radiograph"
                />

                {showQueueButton ? (
                  <Button
                    leftSection={<IconListDetails size={16} />}
                    onClick={onOpenQueue}
                    size="xs"
                    variant="light"
                  >
                    Queue ({itemCount})
                  </Button>
                ) : null}

                {isProcessing ? (
                  <Button
                    color="gray"
                    leftSection={<IconSquare size={14} />}
                    onClick={onStop}
                    size="xs"
                    variant="default"
                  >
                    Stop queue
                  </Button>
                ) : (
                  <Button
                    disabled={queuedCount === 0}
                    leftSection={<IconPlayerPlay size={15} />}
                    onClick={onRun}
                    size="xs"
                  >
                    {processedCount > 0 ? "Run remaining" : "Run all"}
                  </Button>
                )}

                {failedCount > 0 && !isProcessing ? (
                  <Button
                    color="orange"
                    leftSection={<IconRefresh size={15} />}
                    onClick={onRetryFailed}
                    size="xs"
                    variant="light"
                  >
                    Retry failed
                  </Button>
                ) : null}

                <Button
                  color="red"
                  leftSection={<IconTrash size={15} />}
                  onClick={requestClear}
                  size="xs"
                  variant="subtle"
                >
                  Clear batch
                </Button>
              </Group>
            </Group>

            <Progress
              aria-label={`${processedCount} of ${itemCount} images processed`}
              radius="xl"
              size="sm"
              value={progressPercent}
            />

            <Group justify="space-between" gap="md">
              <Text c="dimmed" size="xs">
                {plural(itemCount, "image")} · {plural(failedCount, "failure")} ·
                sequential processing
              </Text>

              <Group gap={4}>
                <Text c="dimmed" mr={4} size="xs">
                  Image {selectedIndex + 1} of {itemCount}
                </Text>
                <Tooltip label="Previous image ([)">
                  <ActionIcon
                    aria-label="Previous image"
                    disabled={itemCount < 2}
                    onClick={onPrevious}
                    size="sm"
                    variant="subtle"
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Next image (])">
                  <ActionIcon
                    aria-label="Next image"
                    disabled={itemCount < 2}
                    onClick={onNext}
                    size="sm"
                    variant="subtle"
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Next image with a morphology signal">
                  <ActionIcon
                    aria-label="Next image with a morphology signal"
                    color="yellow"
                    disabled={!hasSignalItems}
                    onClick={onNextSignal}
                    size="sm"
                    variant="light"
                  >
                    <IconFlag size={15} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Stack>
        )}

        {rejectionNotices.length > 0 ? (
          <Alert
            color="yellow"
            icon={<IconAlertCircle size={18} />}
            mt="md"
            onClose={() => setRejectionNotices([])}
            role="alert"
            title={`${plural(rejectionNotices.length, "image")} not added`}
            withCloseButton
          >
            <ScrollArea.Autosize mah={150} offsetScrollbars>
              <List size="sm" spacing={4}>
                {rejectionNotices.map((notice, index) => (
                  <List.Item key={`${notice.fileName}-${index}`}>
                    <Text component="span" fw={600} size="sm">
                      {notice.fileName}
                    </Text>
                    {`: ${notice.reason}`}
                  </List.Item>
                ))}
              </List>
            </ScrollArea.Autosize>
          </Alert>
        ) : null}
      </Paper>

      <Modal
        centered
        closeOnClickOutside={!isProcessing}
        onClose={() => setClearConfirmationOpen(false)}
        opened={clearConfirmationOpen}
        title="Clear this batch?"
      >
        <Stack>
          <Text size="sm">
            This removes all selected images and prediction results from the
            current browser session.
          </Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              onClick={() => setClearConfirmationOpen(false)}
              variant="default"
            >
              Keep batch
            </Button>
            <Button color="red" onClick={confirmClear}>
              Clear batch
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
