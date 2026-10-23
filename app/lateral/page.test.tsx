import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLAPrediction } from "@/features/screening/api/client";
import { imageFile } from "@/tests/predictionFixture";
import { laPredictionFixture } from "@/tests/laPredictionFixture";
import LateralPage from "./page";

vi.mock("@/features/screening/api/client", () => ({
  createLAPrediction: vi.fn(),
}));

const createLAPredictionMock = vi.mocked(createLAPrediction);

describe("LateralPage", () => {
  beforeEach(() => {
    createLAPredictionMock.mockReset();
  });

  it("submits a lateral image and renders the six-keypoint result", async () => {
    createLAPredictionMock.mockResolvedValue(laPredictionFixture());
    const user = userEvent.setup();
    const { container } = render(
      <MantineProvider>
        <LateralPage />
      </MantineProvider>,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = imageFile("lateral-case.png", 1);
    await user.upload(input as HTMLInputElement, file);
    expect(screen.getByText("lateral-case.png")).toBeTruthy();
    expect(
      screen.getByAltText("Original submitted lateral radiograph"),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Run lateral assessment" }),
    );

    await waitFor(() =>
      expect(createLAPredictionMock).toHaveBeenCalledWith(
        file,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await waitFor(() =>
      expect(
        container.querySelectorAll("[data-landmark-name]"),
      ).toHaveLength(6),
    );
    expect(
      screen.getByRole("group", {
        name: "Lateral radiograph with six vertebral landmarks per detection",
      }),
    ).toBeTruthy();
  });
});
