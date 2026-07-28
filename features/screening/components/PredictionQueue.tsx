"use client";

import {
  Badge,
  Box,
  Group,
  Image,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconClock,
  IconRosetteDiscountCheck,
} from "@tabler/icons-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PredictionQueueItem } from "../bulk/types";
import {
  analyzeMorphology,
  type MorphologySignalStatus,
} from "../morphology/analysis";

type QueueFilter =
  | "all"
  | "signals"
  | "low_reliability"
  | "warnings"
  | "failed";

export interface PredictionQueueItemSummary {
  vertebraCount: number;
  signalCount: number;
  lowReliabilityCount: number;
  notAssessableCount: number;
  warningCount: number;
}

interface PredictionQueueProps {
  items: readonly PredictionQueueItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}

const FILTER_OPTIONS: Array<{ label: string; value: QueueFilter }> = [
  { label: "All images", value: "all" },
  { label: "Morphology signals", value: "signals" },
  { label: "Low reliability", value: "low_reliability" },
  { label: "Warnings", value: "warnings" },
  { label: "Failed", value: "failed" },
];

const SIGNAL_STATUSES = new Set<MorphologySignalStatus>([
  "borderline_morphology_signal",
  "suspicious_morphology_signal",
  "high_priority_morphology_signal",
  "marked_height_change",
]);

export function summarizeQueueItem(
  item: PredictionQueueItem,
): PredictionQueueItemSummary {
  if (!item.result) {
    return {
      vertebraCount: 0,
      signalCount: 0,
      lowReliabilityCount: 0,
      notAssessableCount: 0,
      warningCount: 0,
    };
  }

  const assessments = analyzeMorphology(
    item.result.morphology,
    item.result.selected_vertebrae,
  );

  return {
    vertebraCount: item.result.selected_vertebrae.length,
    signalCount: assessments.filter((assessment) =>
      SIGNAL_STATUSES.has(assessment.status),
    ).length,
    lowReliabilityCount: assessments.filter(
      (assessment) => assessment.reliability === "low",
    ).length,
    notAssessableCount: assessments.filter(
      (assessment) => assessment.reliability === "not_assessable",
    ).length,
    warningCount: item.result.warnings.length,
  };
}

export function queueItemHasMorphologySignal(item: PredictionQueueItem) {
  return summarizeQueueItem(item).signalCount > 0;
}

function StatusIndicator({ item }: { item: PredictionQueueItem }) {
  const content: Record<
    PredictionQueueItem["status"],
    { color: string; icon: ReactNode; label: string }
  > = {
    queued: {
      color: "gray",
      icon: <IconClock size={13} />,
      label: "Queued",
    },
    running: {
      color: "blue",
      icon: <Loader color="blue" size={12} />,
      label: "Running",
    },
    success: {
      color: "green",
      icon: <IconRosetteDiscountCheck size={13} />,
      label: "Ready",
    },
    error: {
      color: "red",
      icon: <IconAlertCircle size={13} />,
      label: "Failed",
    },
  };
  const status = content[item.status];

  return (
    <Badge color={status.color} leftSection={status.icon} size="xs" variant="light">
      {status.label}
    </Badge>
  );
}

function QueueItemRow({
  item,
  isSelected,
  onSelect,
  rowRef,
  summary,
}: {
  item: PredictionQueueItem;
  isSelected: boolean;
  onSelect: () => void;
  rowRef: (element: HTMLButtonElement | null) => void;
  summary: PredictionQueueItemSummary;
}) {
  return (
    <UnstyledButton
      aria-pressed={isSelected}
      onClick={onSelect}
      ref={rowRef}
      style={{ display: "block", width: "100%" }}
    >
      <Paper
        bg={isSelected ? "var(--mantine-color-blue-light)" : undefined}
        p="xs"
        radius="md"
        style={{
          borderColor: isSelected ? "var(--mantine-color-blue-6)" : undefined,
        }}
        withBorder
      >
        <Group align="flex-start" gap="xs" wrap="nowrap">
          <Box
            bg="black"
            h={64}
            miw={48}
            style={{
              alignItems: "center",
              borderRadius: 5,
              display: "flex",
              justifyContent: "center",
              overflow: "hidden",
              width: 48,
            }}
          >
            <Image
              alt=""
              decoding="async"
              fit="contain"
              h="100%"
              loading="lazy"
              src={item.imageUrl}
              w="100%"
            />
          </Box>

          <Stack gap={5} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} lineClamp={1} size="sm" title={item.file.name}>
              {item.file.name}
            </Text>

            <Group gap={5} wrap="wrap">
              <StatusIndicator item={item} />
              {item.status === "success" ? (
                <Badge color="gray" size="xs" variant="outline">
                  {summary.vertebraCount} vertebrae
                </Badge>
              ) : null}
            </Group>

            {item.status === "success" ? (
              <Group gap={5} wrap="wrap">
                {summary.signalCount > 0 ? (
                  <Badge color="yellow" size="xs" variant="light">
                    {summary.signalCount} signal
                    {summary.signalCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {summary.lowReliabilityCount > 0 ? (
                  <Badge color="orange" size="xs" variant="dot">
                    {summary.lowReliabilityCount} low reliability
                  </Badge>
                ) : null}
                {summary.notAssessableCount > 0 ? (
                  <Badge color="gray" size="xs" variant="dot">
                    {summary.notAssessableCount} not assessable
                  </Badge>
                ) : null}
                {summary.warningCount > 0 ? (
                  <Badge
                    color="yellow"
                    leftSection={<IconAlertTriangle size={11} />}
                    size="xs"
                    variant="outline"
                  >
                    {summary.warningCount} warning
                    {summary.warningCount === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </Group>
            ) : null}

            {item.error ? (
              <Stack gap={1}>
                <Text c="red" lineClamp={2} size="xs">
                  {item.error.message}
                </Text>
                {item.error.requestId ? (
                  <Text c="dimmed" lineClamp={1} size="xs">
                    Request ID: {item.error.requestId}
                  </Text>
                ) : null}
                {item.error.retryAfterSeconds !== null ? (
                  <Text c="dimmed" size="xs">
                    Retry in about {item.error.retryAfterSeconds}s
                  </Text>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

export function PredictionQueue({
  items,
  selectedItemId,
  onSelectItem,
}: PredictionQueueProps) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const itemRows = useRef(new Map<string, HTMLButtonElement>());
  const summaries = useMemo(
    () =>
      new Map(
        items.map((item) => [item.id, summarizeQueueItem(item)] as const),
      ),
    [items],
  );

  const filteredItems = items.filter((item) => {
    const summary = summaries.get(item.id);
    if (!summary) return filter === "all";
    if (filter === "signals") return summary.signalCount > 0;
    if (filter === "low_reliability") {
      return summary.lowReliabilityCount > 0;
    }
    if (filter === "warnings") return summary.warningCount > 0;
    if (filter === "failed") return item.status === "error";
    return true;
  });

  useEffect(() => {
    if (!selectedItemId) return;
    const viewport = scrollViewportRef.current;
    const row = itemRows.current.get(selectedItemId);
    if (!viewport || !row) return;

    const viewportBounds = viewport.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    if (
      rowBounds.top >= viewportBounds.top &&
      rowBounds.bottom <= viewportBounds.bottom
    ) {
      return;
    }

    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [filter, filteredItems.length, selectedItemId]);

  return (
    <Paper h="100%" p="sm" radius="md" shadow="sm" withBorder>
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Title order={4}>Prediction queue</Title>
          <Badge variant="light">{items.length} images</Badge>
        </Group>

        <Select
          allowDeselect={false}
          aria-label="Filter prediction queue"
          data={FILTER_OPTIONS}
          onChange={(value) => setFilter((value as QueueFilter | null) ?? "all")}
          size="xs"
          value={filter}
        />

        <ScrollArea.Autosize
          mah="calc(100vh - 210px)"
          offsetScrollbars
          viewportRef={scrollViewportRef}
        >
          {filteredItems.length > 0 ? (
            <Stack gap="xs" pr="xs">
              {filteredItems.map((item) => (
                <QueueItemRow
                  isSelected={item.id === selectedItemId}
                  item={item}
                  key={item.id}
                  onSelect={() => onSelectItem(item.id)}
                  rowRef={(element) => {
                    if (element) {
                      itemRows.current.set(item.id, element);
                    } else {
                      itemRows.current.delete(item.id);
                    }
                  }}
                  summary={
                    summaries.get(item.id) ?? {
                      vertebraCount: 0,
                      signalCount: 0,
                      lowReliabilityCount: 0,
                      notAssessableCount: 0,
                      warningCount: 0,
                    }
                  }
                />
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" py="xl" size="sm" ta="center">
              No images match this filter.
            </Text>
          )}
        </ScrollArea.Autosize>
      </Stack>
    </Paper>
  );
}
