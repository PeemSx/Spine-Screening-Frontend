"use client";

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
import { useCallback, useEffect, useState } from "react";
import type { PredictionQueueStatus } from "@/features/screening/bulk/types";
import { ClinicalNotice } from "@/features/screening/components/ClinicalNotice";
import { LateralMeasurementsPanel } from "@/features/screening/components/LateralMeasurementsPanel";
import { LateralPredictionOverlay } from "@/features/screening/components/LateralPredictionOverlay";
import { PredictionQueue } from "@/features/screening/components/PredictionQueue";
import styles from "../frontal/ScreeningWorkspace.module.css";
import { UploadPanel } from "@/features/screening/components/UploadPanel";
import { useFileObjectUrl } from "@/features/screening/hooks/useFileObjectUrl";
import { useLateralScreeningSession } from "@/features/screening/session/LateralScreeningSession";
import type { PredictionStatus } from "@/features/screening/types";

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

function OriginalLateralImagePanel({
  file,
  imageUrl,
  imageWidth,
  imageHeight,
}: {
  file: File;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
}) {
  return (
    <Card withBorder radius="md" p="md" shadow="sm">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={4}>Original image</Title>
          <Text c="dimmed" size="xs">
            Exact raster submitted to the lateral screening API
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
            alt="Original submitted lateral radiograph"
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
          <Text fw={600} lineClamp={1} size="sm">
            {file.name}
          </Text>
          <Text c="dimmed" size="xs">
            {formatFileSize(file.size)}
            {imageWidth && imageHeight
              ? ` · ${imageWidth} × ${imageHeight} px`
              : ""}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
}

export default function LateralPage() {
  const queue = useLateralScreeningSession();
  const { items, selectItem, selectedItemId } = queue;
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const isWideQueueLayout = useMediaQuery("(min-width: 100em)", false);
  const selectedItem = queue.selectedItem;
  const selectedImageUrl = useFileObjectUrl(selectedItem?.file ?? null);
  const selectedResult = selectedItem?.result;
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

  const selectRelativeItem = useCallback(
    (offset: -1 | 1) => {
      if (items.length < 2) return;
      const currentIndex = items.findIndex(
        (item) => item.id === selectedItemId,
      );
      const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeCurrentIndex + offset + items.length) % items.length;
      selectItem(items[nextIndex].id);
    },
    [items, selectItem, selectedItemId],
  );

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

  return (
    <Container fluid={hasMultipleItems} pb="xl" pt="md" size="xxl">
      <ClinicalNotice
        clinicalReviewRequired={
          selectedResult?.clinical_review_required ?? true
        }
        disclaimer={selectedResult?.disclaimer}
        warnings={selectedResult?.warnings}
      />

      <Stack align="center" gap="xs" mb="xl">
        <Title order={1} size="h2" ta="center">
          Lateral spine assessment
        </Title>
        <Text c="dimmed" maw={760} ta="center">
          Upload one or more anonymized lateral radiographs to review six
          vertebral keypoints and four-outer-landmark geometry agreement.
        </Text>
        <Text c="dimmed" maw={760} size="sm" ta="center">
          LA geometry is not a clinical AP/PA Cobb measurement.
        </Text>
      </Stack>

      <UploadPanel
        activeFileName={activeItem?.file.name ?? null}
        failedCount={queue.progress.failed}
        hasCompletedResults={queue.progress.succeeded > 0}
        isProcessing={queue.isProcessing}
        itemCount={queue.progress.total}
        onAddFiles={queue.addFiles}
        onClear={queue.clear}
        onNext={() => selectRelativeItem(1)}
        onOpenQueue={() => setQueueDrawerOpen(true)}
        onPrevious={() => selectRelativeItem(-1)}
        onRetryFailed={queue.retryFailed}
        onRun={queue.runRemaining}
        onStop={queue.stop}
        processedCount={queue.progress.completed}
        progressPercent={queue.progress.percent}
        projection="lateral"
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
              projection="lateral"
              selectedItemId={queue.selectedItemId}
            />
          </Box>
        ) : null}

        <Box style={{ minWidth: 0 }}>
          {selectedItem?.error ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              mb="lg"
              role="alert"
              title={`Lateral assessment failed for ${selectedItem.file.name}`}
            >
              {selectedItem.error.message}
              {selectedItem.error.requestId
                ? ` Request ID: ${selectedItem.error.requestId}.`
                : ""}
              {selectedItem.error.retryAfterSeconds !== null
                ? ` Try again in approximately ${selectedItem.error.retryAfterSeconds} seconds.`
                : ""}
            </Alert>
          ) : null}

          {selectedItem && selectedImageUrl ? (
            <Grid gutter="lg" align="flex-start">
              <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
                <OriginalLateralImagePanel
                  file={selectedItem.file}
                  imageHeight={selectedResult?.image.height}
                  imageUrl={selectedImageUrl}
                  imageWidth={selectedResult?.image.width}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6, xl: 4 }}>
                <LateralPredictionOverlay
                  cobb={selectedResult?.cobb ?? null}
                  image={selectedResult?.image ?? null}
                  imageUrl={selectedImageUrl}
                  onSelectCandidate={queue.setSelectedCandidateId}
                  selectedCandidateId={selectedItem.selectedCandidateId}
                  status={selectedPredictionStatus}
                  vertebrae={selectedResult?.selected_vertebrae ?? []}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, xl: 4 }}>
                <LateralMeasurementsPanel
                  key={selectedItem.id}
                  cobb={selectedResult?.cobb ?? null}
                  compressionAssessments={selectedResult?.compression_assessments ?? []}
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
          title={`Lateral prediction queue · ${queue.items.length} images`}
        >
          {queueDrawerOpen ? (
            <PredictionQueue
              items={queue.items}
              onSelectItem={selectFromDrawer}
              projection="lateral"
              selectedItemId={queue.selectedItemId}
            />
          ) : null}
        </Drawer>
      ) : null}
    </Container>
  );
}
