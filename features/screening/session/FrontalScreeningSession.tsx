"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  usePredictionQueue,
  type UsePredictionQueueResult,
} from "../hooks/usePredictionQueue";

const FrontalScreeningSessionContext =
  createContext<UsePredictionQueueResult | null>(null);

export function FrontalScreeningSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const queue = usePredictionQueue();

  return (
    <FrontalScreeningSessionContext.Provider value={queue}>
      {children}
    </FrontalScreeningSessionContext.Provider>
  );
}

export function useFrontalScreeningSession() {
  const session = useContext(FrontalScreeningSessionContext);
  if (!session) {
    throw new Error(
      "useFrontalScreeningSession must be used within FrontalScreeningSessionProvider",
    );
  }
  return session;
}
