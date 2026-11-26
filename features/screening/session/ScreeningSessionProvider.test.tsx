import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLAPrediction,
  createPrediction,
} from "@/features/screening/api/client";
import { laPredictionFixture } from "@/tests/laPredictionFixture";
import { imageFile, predictionFixture } from "@/tests/predictionFixture";
import { useFrontalScreeningSession } from "./FrontalScreeningSession";
import { useLateralScreeningSession } from "./LateralScreeningSession";
import { ScreeningSessionProvider } from "./ScreeningSessionProvider";

vi.mock("@/features/screening/api/client", () => ({
  createLAPrediction: vi.fn(),
  createPrediction: vi.fn(),
}));

const createPredictionMock = vi.mocked(createPrediction);
const createLAPredictionMock = vi.mocked(createLAPrediction);

function FrontalProbe() {
  const session = useFrontalScreeningSession();
  return (
    <div>
      <button
        onClick={() => session.addFiles([imageFile("cached-frontal.png")])}
        type="button"
      >
        Add frontal image
      </button>
      <button onClick={() => session.runRemaining()} type="button">
        Run frontal prediction
      </button>
      <span>{session.selectedItem?.file.name}</span>
      <span>{session.selectedItem?.result?.prediction_id}</span>
    </div>
  );
}

function LateralProbe() {
  const session = useLateralScreeningSession();
  return (
    <div>
      <button
        onClick={() => session.addFiles([imageFile("cached-lateral.png")])}
        type="button"
      >
        Add lateral image
      </button>
      <button onClick={() => session.runRemaining()} type="button">
        Run lateral prediction
      </button>
      <span>{session.selectedItem?.file.name}</span>
      <span>{session.selectedItem?.result?.prediction_id}</span>
    </div>
  );
}

function RouteSwitchHarness() {
  const [projection, setProjection] = useState<"frontal" | "lateral">(
    "frontal",
  );
  return (
    <ScreeningSessionProvider>
      <button onClick={() => setProjection("frontal")} type="button">
        Show frontal
      </button>
      <button onClick={() => setProjection("lateral")} type="button">
        Show lateral
      </button>
      {projection === "frontal" ? <FrontalProbe /> : <LateralProbe />}
    </ScreeningSessionProvider>
  );
}

describe("ScreeningSessionProvider", () => {
  beforeEach(() => {
    createPredictionMock.mockReset();
    createLAPredictionMock.mockReset();
  });

  it("keeps the latest AP/PA and LA predictions while switching projections", async () => {
    createPredictionMock.mockResolvedValue(
      predictionFixture("cached-frontal-result"),
    );
    createLAPredictionMock.mockResolvedValue(laPredictionFixture());
    const user = userEvent.setup();
    render(<RouteSwitchHarness />);

    await user.click(screen.getByRole("button", { name: "Add frontal image" }));
    await user.click(
      screen.getByRole("button", { name: "Run frontal prediction" }),
    );
    expect(await screen.findByText("cached-frontal-result")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Show lateral" }));
    await user.click(screen.getByRole("button", { name: "Add lateral image" }));
    await user.click(
      screen.getByRole("button", { name: "Run lateral prediction" }),
    );
    expect(
      await screen.findByText("00000000-0000-4000-8000-000000000001"),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Show frontal" }));
    expect(screen.getByText("cached-frontal.png")).toBeTruthy();
    expect(screen.getByText("cached-frontal-result")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Show lateral" }));
    expect(screen.getByText("cached-lateral.png")).toBeTruthy();
    expect(
      screen.getByText("00000000-0000-4000-8000-000000000001"),
    ).toBeTruthy();

    await waitFor(() => {
      expect(createPredictionMock).toHaveBeenCalledOnce();
      expect(createLAPredictionMock).toHaveBeenCalledOnce();
    });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
