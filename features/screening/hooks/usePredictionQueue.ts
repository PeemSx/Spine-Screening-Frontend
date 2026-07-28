"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  SCREENING_IMAGE_MIME_TYPES,
  SCREENING_MAX_UPLOAD_BYTES,
  SCREENING_REQUEST_TIMEOUT_MS,
} from "@/config/env";
import { createPrediction } from "../api/client";
import {
  normalizeScreeningError,
  ScreeningApiError,
} from "../api/errors";
import {
  initialPredictionQueueState,
  predictionQueueReducer,
  type PredictionQueueAction,
} from "../bulk/queueReducer";
import {
  fingerprintPredictionFile,
  MAX_PREDICTION_QUEUE_ITEMS,
  type AddFilesResult,
  type PredictionFileRejection,
  type PredictionQueueItem,
  type PredictionQueueProgress,
  type PredictionQueueState,
} from "../bulk/types";

let fallbackId = 0;

function createQueueItemId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  fallbackId += 1;
  return `screening-${Date.now()}-${fallbackId}`;
}

function rejectionForFile(file: File): PredictionFileRejection | null {
  if (!SCREENING_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      file,
      code: "unsupported_type",
      message: `${file.name} is not a supported JPEG or PNG image.`,
    };
  }
  if (file.size > SCREENING_MAX_UPLOAD_BYTES) {
    return {
      file,
      code: "file_too_large",
      message: `${file.name} is larger than the 20 MB upload limit.`,
    };
  }
  return null;
}

function progressFromItems(
  items: readonly PredictionQueueItem[],
): PredictionQueueProgress {
  const progress = items.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { queued: 0, running: 0, success: 0, error: 0 },
  );
  const completed = progress.success + progress.error;
  return {
    total: items.length,
    queued: progress.queued,
    running: progress.running,
    succeeded: progress.success,
    failed: progress.error,
    completed,
    percent:
      items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
  };
}

/**
 * Owns an in-memory prediction queue around the existing single-image API.
 * Calling `runAll` is required to start new queued work.
 */
export function usePredictionQueue() {
  const [state, reactDispatch] = useReducer(
    predictionQueueReducer,
    initialPredictionQueueState,
  );
  const stateRef = useRef<PredictionQueueState>(initialPredictionQueueState);
  const controllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);

  /**
   * Keep the imperative worker and React render state on the same action
   * stream. This lets a file added while a request is pending be observed by
   * the next worker iteration without waiting for another render.
   */
  const commit = useCallback((action: PredictionQueueAction) => {
    stateRef.current = predictionQueueReducer(stateRef.current, action);
    reactDispatch(action);
  }, []);

  const processQueuedItems = useCallback(
    async (
      workerSequence: number,
      excludedItemIds: ReadonlySet<string> | null,
    ) => {
      while (
        mountedRef.current &&
        sequenceRef.current === workerSequence &&
        stateRef.current.isProcessing
      ) {
        const item = stateRef.current.items.find(
          ({ id, status }) =>
            status === "queued" && !excludedItemIds?.has(id),
        );
        if (!item) break;

        commit({ type: "start_item", itemId: item.id });
        const controller = new AbortController();
        controllerRef.current = controller;
        let timedOut = false;
        const timeoutId = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, SCREENING_REQUEST_TIMEOUT_MS);

        try {
          const result = await createPrediction(item.file, {
            signal: controller.signal,
          });
          if (
            !mountedRef.current ||
            sequenceRef.current !== workerSequence
          ) {
            return;
          }
          commit({ type: "complete_item", itemId: item.id, result });
        } catch (error) {
          if (
            !mountedRef.current ||
            sequenceRef.current !== workerSequence
          ) {
            return;
          }

          const normalized = timedOut
            ? new ScreeningApiError({
                message: "The screening request timed out. Please try again.",
                code: "request_timeout",
              })
            : normalizeScreeningError(error);
          commit({ type: "fail_item", itemId: item.id, error: normalized });
        } finally {
          window.clearTimeout(timeoutId);
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }
        }
      }

      if (
        mountedRef.current &&
        sequenceRef.current === workerSequence
      ) {
        commit({ type: "finish_processing" });
      }
    },
    [commit],
  );

  const startWorker = useCallback(
    (excludedItemIds: ReadonlySet<string> | null = null) => {
      if (
        stateRef.current.isProcessing ||
        !stateRef.current.items.some(
          ({ id, status }) =>
            status === "queued" && !excludedItemIds?.has(id),
        )
      ) {
        return false;
      }

      const workerSequence = sequenceRef.current + 1;
      sequenceRef.current = workerSequence;
      commit({ type: "start_processing" });
      void processQueuedItems(workerSequence, excludedItemIds);
      return true;
    },
    [commit, processQueuedItems],
  );

  const addFiles = useCallback(
    (files: readonly File[]): AddFilesResult => {
      const added: PredictionQueueItem[] = [];
      const rejected: PredictionFileRejection[] = [];
      const fingerprints = new Set(
        stateRef.current.items.map(({ fingerprint }) => fingerprint),
      );
      let remainingSlots =
        MAX_PREDICTION_QUEUE_ITEMS - stateRef.current.items.length;

      for (const file of files) {
        const validationRejection = rejectionForFile(file);
        if (validationRejection) {
          rejected.push(validationRejection);
          continue;
        }

        const fingerprint = fingerprintPredictionFile(file);
        if (fingerprints.has(fingerprint)) {
          rejected.push({
            file,
            code: "duplicate",
            message: `${file.name} is already in this screening batch.`,
          });
          continue;
        }
        if (remainingSlots <= 0) {
          rejected.push({
            file,
            code: "batch_limit",
            message: `${file.name} was not added because a batch can contain at most ${MAX_PREDICTION_QUEUE_ITEMS} images.`,
          });
          continue;
        }

        const item: PredictionQueueItem = {
          id: createQueueItemId(),
          fingerprint,
          file,
          imageUrl: URL.createObjectURL(file),
          status: "queued",
          result: null,
          error: null,
          selectedCandidateId: null,
        };
        added.push(item);
        fingerprints.add(fingerprint);
        remainingSlots -= 1;
      }

      if (added.length > 0) {
        commit({ type: "add", items: added });
      }
      return { added, rejected };
    },
    [commit],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const item = stateRef.current.items.find(({ id }) => id === itemId);
      if (!item || item.status === "running") return false;
      URL.revokeObjectURL(item.imageUrl);
      commit({ type: "remove", itemId });
      return true;
    },
    [commit],
  );

  const selectItem = useCallback(
    (itemId: string) => {
      commit({ type: "select", itemId });
    },
    [commit],
  );

  const setItemSelectedCandidateId = useCallback(
    (itemId: string, candidateId: number | null) => {
      commit({ type: "select_candidate", itemId, candidateId });
    },
    [commit],
  );

  const setSelectedCandidateId = useCallback(
    (candidateId: number | null) => {
      const itemId = stateRef.current.selectedItemId;
      if (itemId) {
        commit({ type: "select_candidate", itemId, candidateId });
      }
    },
    [commit],
  );

  const runAll = useCallback(() => startWorker(), [startWorker]);

  const stop = useCallback(() => {
    if (!stateRef.current.isProcessing) return false;
    sequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    commit({ type: "stop_processing" });
    return true;
  }, [commit]);

  const retryFailed = useCallback(() => {
    if (
      stateRef.current.isProcessing ||
      !stateRef.current.items.some(({ status }) => status === "error")
    ) {
      return false;
    }
    const queuedItemIds = new Set(
      stateRef.current.items
        .filter(({ status }) => status === "queued")
        .map(({ id }) => id),
    );
    commit({ type: "retry_failed" });
    startWorker(queuedItemIds);
    return true;
  }, [commit, startWorker]);

  const clear = useCallback(() => {
    sequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    for (const item of stateRef.current.items) {
      URL.revokeObjectURL(item.imageUrl);
    }
    commit({ type: "clear" });
  }, [commit]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      controllerRef.current?.abort();
      for (const item of stateRef.current.items) {
        URL.revokeObjectURL(item.imageUrl);
      }
    };
  }, []);

  const selectedItem = useMemo(
    () =>
      state.items.find(({ id }) => id === state.selectedItemId) ?? null,
    [state.items, state.selectedItemId],
  );
  const progress = useMemo(
    () => progressFromItems(state.items),
    [state.items],
  );

  return {
    ...state,
    selectedItem,
    progress,
    addFiles,
    removeItem,
    selectItem,
    setSelectedCandidateId,
    setItemSelectedCandidateId,
    runAll,
    runRemaining: runAll,
    stop,
    retryFailed,
    clear,
  };
}

export type UsePredictionQueueResult = ReturnType<
  typeof usePredictionQueue
>;
