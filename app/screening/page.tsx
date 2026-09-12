"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  Container,
  Drawer,
  Grid,
  Image,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle } from "@tabler/icons-react";
import { ClinicalNotice } from "@/features/screening/components/ClinicalNotice";
import { MeasurementsPanel } from "@/features/screening/components/MeasurementsPanel";
import { PredictionOverlay } from "@/features/screening/components/PredictionOverlay";
import {
  PredictionQueue,
  queueItemHasMorphologySignal,
} from "@/features/screening/components/PredictionQueue";
import { UploadPanel } from "@/features/screening/components/UploadPanel";
import { usePredictionQueue } from "@/features/screening/hooks/usePredictionQueue";
import type { ImageInfo } from "@/features/screening/api/generated";
import type { PredictionQueueStatus } from "@/features/screening/bulk/types";
import type { PredictionStatus } from "@/features/screening/types";
import styles from "./ScreeningWorkspace.module.css";

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function predictionStatus(status: PredictionQueueStatus): PredictionStatus {
  if (status === "running") return "submitting";
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "idle";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

function hasVisibleDialog() {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(
    (dialog) => {
      if (dialog.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(dialog);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
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
            key={imageUrl}
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
          <Text fw={600} size="sm" lineClamp={1}>
            {file.name}
          </Text>
          <Text c="dimmed" size="xs">
            {formatFileSize(file.size)}
            {imageInfo
              ? ` · ${imageInfo.width} × ${imageInfo.height} px`
              : ""}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}

export default function ScreeningPage() {
  const queue = usePredictionQueue();
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const isWideQueueLayout = useMediaQuery("(min-width: 100em)", false);
  const selectedItem = queue.selectedItem;
  const hasMultipleItems = queue.items.length > 1;
  const selectedIndex = Math.max(
    0,
    queue.items.findIndex((item) => item.id === queue.selectedItemId),
  );
  const activeItem =
    queue.items.find((item) => item.id === queue.activeItemId) ?? null;
  const selectedPredictionStatus = selectedItem
    ? predictionStatus(selectedItem.status)
    : "idle";

  const signalItemIds = useMemo(
    () =>
      queue.items
        .filter(queueItemHasMorphologySignal)
        .map((item) => item.id),
    [queue.items],
  );

  const selectRelativeItem = useCallback(
    (offset: -1 | 1) => {
      if (queue.items.length < 2) return;
      const currentIndex = queue.items.findIndex(
        (item) => item.id === queue.selectedItemId,
      );
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeCurrentIndex + offset + queue.items.length) % queue.items.length;
      queue.selectItem(queue.items[nextIndex].id);
    },
    [queue],
  );

  const selectNextSignal = useCallback(() => {
    if (signalItemIds.length === 0) return;
    const currentIndex = queue.items.findIndex(
      (item) => item.id === queue.selectedItemId,
    );
    for (let offset = 1; offset <= queue.items.length; offset += 1) {
      const candidate =
        queue.items[(Math.max(0, currentIndex) + offset) % queue.items.length];
      if (signalItemIds.includes(candidate.id)) {
        queue.selectItem(candidate.id);
        return;
      }
    }
  }, [queue, signalItemIds]);

  useEffect(() => {
    if (isWideQueueLayout) setQueueDrawerOpen(false);
  }, [isWideQueueLayout]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        queue.items.length < 2 ||
        isTypingTarget(event.target) ||
        hasVisibleDialog()
      ) {
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        selectRelativeItem(-1);
      } else if (event.key === "]") {
        event.preventDefault();
        selectRelativeItem(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queue.items.length, selectRelativeItem]);

  const selectFromDrawer = (itemId: string) => {
    queue.selectItem(itemId);
    setQueueDrawerOpen(false);
  };

  const selectedError = selectedItem?.error;
  const selectedResult = selectedItem?.result;

  return (
    <Container
      fluid={hasMultipleItems}
      size="xxl"
      pt="md"
      pb="xl"
    >
      <ClinicalNotice
        clinicalReviewRequired={
          selectedResult?.clinical_review_required ?? true
        }
        disclaimer={selectedResult?.disclaimer}
        warnings={selectedResult?.warnings}
      />

      <Stack align="center" gap="xs" mb="xl">
        <Title order={1} size="h2" ta="center">
          Spine screening workspace
        </Title>
        <Text c="dimmed" maw={760} ta="center">
          Upload one or more AP or PA radiographs to review vertebral landmarks,
          Cobb geometry, and height-focused morphology measurements.
        </Text>
      </Stack>

      <UploadPanel
        activeFileName={activeItem?.file.name ?? null}
        failedCount={queue.progress.failed}
        hasCompletedResults={queue.progress.succeeded > 0}
        hasSignalItems={signalItemIds.length > 0}
        isProcessing={queue.isProcessing}
        itemCount={queue.progress.total}
        onAddFiles={queue.addFiles}
        onClear={queue.clear}
        onNext={() => selectRelativeItem(1)}
        onNextSignal={selectNextSignal}
        onOpenQueue={() => setQueueDrawerOpen(true)}
        onPrevious={() => selectRelativeItem(-1)}
        onRetryFailed={queue.retryFailed}
        onRun={queue.runRemaining}
        onStop={queue.stop}
        processedCount={queue.progress.completed}
        progressPercent={queue.progress.percent}
        queuedCount={queue.progress.queued}
        selectedIndex={selectedIndex}
        showQueueButton={hasMultipleItems && !isWideQueueLayout}
      />

      <Box
        className={`${styles.workspace} ${
          hasMultipleItems ? styles.workspaceWithQueue : ""
        }`}
      >
        {hasMultipleItems && isWideQueueLayout ? (
          <Box className={styles.queueSidebar}>
            <PredictionQueue
              items={queue.items}
              onSelectItem={queue.selectItem}
              selectedItemId={queue.selectedItemId}
            />
          </Box>
        ) : null}

        <Box style={{ minWidth: 0 }}>
          {selectedError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              mb="lg"
              role="alert"
              title={`Screening failed for ${selectedItem.file.name}. Contact "Peem" to resolve the issue.`}
            >
              {selectedError.message}
              {selectedError.requestId
                ? ` Request ID: ${selectedError.requestId}.`
                : ""}
              {selectedError.retryAfterSeconds !== null
                ? ` Try again in approximately ${selectedError.retryAfterSeconds} seconds.`
                : ""}
            </Alert>
          ) : null}

          {selectedItem ? (
            <Grid gutter="lg" align="flex-start">
              <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
                <OriginalImagePanel
                  file={selectedItem.file}
                  imageInfo={selectedResult?.image ?? null}
                  imageUrl={selectedItem.imageUrl}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
                <PredictionOverlay
                  cobb={selectedResult?.cobb ?? null}
                  image={selectedResult?.image ?? null}
                  imageUrl={selectedItem.imageUrl}
                  morphology={selectedResult?.morphology ?? []}
                  onSelectCandidate={queue.setSelectedCandidateId}
                  selectedCandidateId={selectedItem.selectedCandidateId}
                  status={selectedPredictionStatus}
                  vertebrae={selectedResult?.selected_vertebrae ?? []}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 12, xl: 4 }}>
                <MeasurementsPanel
                  key={selectedItem.id}
                  morphology={selectedResult?.morphology ?? []}
                  onSelectCandidate={queue.setSelectedCandidateId}
                  selectedCandidateId={selectedItem.selectedCandidateId}
                  status={selectedPredictionStatus}
                  vertebrae={selectedResult?.selected_vertebrae ?? []}
                />
              </Grid.Col>
            </Grid>
          ) : null}
        </Box>
      </Box>

      {hasMultipleItems && !isWideQueueLayout ? (
        <Drawer
          onClose={() => setQueueDrawerOpen(false)}
          opened={queueDrawerOpen}
          padding="sm"
          position="left"
          size={340}
          title={`Prediction queue · ${queue.items.length} images`}
        >
          {queueDrawerOpen ? (
            <PredictionQueue
              items={queue.items}
              onSelectItem={selectFromDrawer}
              selectedItemId={queue.selectedItemId}
            />
          ) : null}
        </Drawer>
      ) : null}
    </Container>
  );
}
