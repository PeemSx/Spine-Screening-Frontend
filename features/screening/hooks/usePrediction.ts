"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCREENING_REQUEST_TIMEOUT_MS } from "@/config/env";
import { createPrediction } from "../api/client";
import { normalizeScreeningError, ScreeningApiError } from "../api/errors";
import type { PredictionResponse } from "../api/generated";

export type PredictionStatus = "idle" | "submitting" | "success" | "error";

interface PredictionState {
  status: PredictionStatus;
  result: PredictionResponse | null;
  error: ScreeningApiError | null;
}

const initialState: PredictionState = {
  status: "idle",
  result: null,
  error: null,
};

export function usePrediction() {
  const [state, setState] = useState<PredictionState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  const cancel = useCallback(() => {
    sequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(initialState);
  }, []);

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  const run = useCallback(async (file: File) => {
    controllerRef.current?.abort();
    const requestSequence = sequenceRef.current + 1;
    sequenceRef.current = requestSequence;
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;

    setState({ status: "submitting", result: null, error: null });

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SCREENING_REQUEST_TIMEOUT_MS);

    try {
      const result = await createPrediction(file, { signal: controller.signal });
      if (sequenceRef.current !== requestSequence) return;
      setState({ status: "success", result, error: null });
    } catch (error) {
      if (sequenceRef.current !== requestSequence) return;
      if (controller.signal.aborted && !timedOut) return;

      const normalized = timedOut
        ? new ScreeningApiError({
            message: "The screening request timed out. Please try again.",
            code: "request_timeout",
          })
        : normalizeScreeningError(error);
      setState({ status: "error", result: null, error: normalized });
    } finally {
      window.clearTimeout(timeoutId);
      if (sequenceRef.current === requestSequence) {
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(
    () => () => {
      sequenceRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  return { ...state, run, reset, cancel };
}
