"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createLAPrediction } from "../api/client";
import type { LAPredictionResponse } from "../api/contract";
import {
  usePredictionQueue,
  type UseTypedPredictionQueueResult,
} from "../hooks/usePredictionQueue";

type LateralScreeningSession =
  UseTypedPredictionQueueResult<LAPredictionResponse>;

const LateralScreeningSessionContext =
  createContext<LateralScreeningSession | null>(null);

export function LateralScreeningSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queue = usePredictionQueue<LAPredictionResponse>(createLAPrediction);

  return (
    <LateralScreeningSessionContext.Provider value={queue}>
      {children}
    </LateralScreeningSessionContext.Provider>
  );
}

export function useLateralScreeningSession() {
  const session = useContext(LateralScreeningSessionContext);
  if (!session) {
    throw new Error(
      "useLateralScreeningSession must be used within LateralScreeningSessionProvider",
    );
  }
  return session;
}
