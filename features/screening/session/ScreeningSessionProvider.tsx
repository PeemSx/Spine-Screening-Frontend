"use client";

import type { ReactNode } from "react";
import { FrontalScreeningSessionProvider } from "./FrontalScreeningSession";
import { LateralScreeningSessionProvider } from "./LateralScreeningSession";

export function ScreeningSessionProvider({ children }: { children: ReactNode }) {
  return (
    <FrontalScreeningSessionProvider>
      <LateralScreeningSessionProvider>
        {children}
      </LateralScreeningSessionProvider>
    </FrontalScreeningSessionProvider>
  );
}
