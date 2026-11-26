import { MantineProvider } from "@mantine/core";
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLAPrediction,
  createPrediction,
} from "@/features/screening/api/client";
import type { LAPredictionResponse } from "@/features/screening/api/contract";
import { LateralScreeningSessionProvider } from "@/features/screening/session/LateralScreeningSession";
import { imageFile } from "@/tests/predictionFixture";
import { laPredictionFixture } from "@/tests/laPredictionFixture";
import LateralPage from "./page";

vi.mock("@/features/screening/api/client", () => ({
  createLAPrediction: vi.fn(),
  createPrediction: vi.fn(),
}));

const createLAPredictionMock = vi.mocked(createLAPrediction);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderLateralPage() {
  return render(
    <MantineProvider>
      <LateralScreeningSessionProvider>
        <LateralPage />
      </LateralScreeningSessionProvider>
    </MantineProvider>,
  );
}

describe("LateralPage", () => {
  beforeEach(() => {
    createLAPredictionMock.mockReset();
  });

  it("submits a lateral image and renders the six-keypoint result", async () => {
    const response = laPredictionFixture();
    response.compression_assessments![0] = {
      ...response.compression_assessments![0],
      max_height_reduction: 22,
      morphology: "wedge",
      severity: "mild_range",
      suspicious: true,
    };
    createLAPredictionMock.mockResolvedValue(response);
    const user = userEvent.setup();
    const { container } = renderLateralPage();
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const file = imageFile("lateral-case.png", 1);
    await user.upload(input as HTMLInputElement, file);
    expect(screen.getByText("lateral-case.png")).toBeTruthy();
    expect(
      screen.getByAltText("Original submitted lateral radiograph"),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Run all" }),
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
    expect(screen.getByText("Selected vertebra morphometry")).toBeTruthy();
    expect(screen.queryByText(/Research morphometry only/)).toBeNull();
    expect(screen.queryByText(/Orientation basis:/)).toBeNull();
    expect(screen.getByText("39.1 px")).toBeTruthy();
    expect(screen.getByText("Review flag")).toBeTruthy();
    expect(screen.getByText("wedge", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("mild range", { selector: "strong" })).toBeTruthy();

    await user.hover(screen.getByRole("button", { name: "Explain Anterior height" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "upper and lower image-left landmarks",
    );
  });

  it("renders an indeterminate assessment without inventing measurements", async () => {
    const response = laPredictionFixture();
    response.compression_assessments![0] = {
      ...response.compression_assessments![0],
      assessment_status: "indeterminate",
      compression_rates: { anterior: null, middle: null, posterior: null },
      heights: { anterior: null, middle: null, posterior: null, unit: "px" },
      max_height_reduction: null,
      morphology: "indeterminate",
      ratios: {
        anterior_posterior: null,
        middle_anterior: null,
        middle_posterior: null,
      },
      reference_status: "unavailable",
      severity: "indeterminate",
      suspicious: false,
    };
    createLAPredictionMock.mockResolvedValue(response);
    const user = userEvent.setup();
    const { container } = renderLateralPage();
    const input = container.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, imageFile("indeterminate.png", 1));
    await user.click(screen.getByRole("button", { name: "Run all" }));

    await screen.findByText("Selected vertebra morphometry");
    expect(screen.getAllByText("indeterminate")).toHaveLength(2);
    expect(screen.getByText("— / — / —")).toBeTruthy();
  });

  it("processes an LA batch sequentially and reviews results from the queue", async () => {
    const firstRequest = deferred<LAPredictionResponse>();
    const secondRequest = deferred<LAPredictionResponse>();
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    createLAPredictionMock
      .mockImplementationOnce(async () => {
        activeRequests += 1;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        const response = await firstRequest.promise;
        activeRequests -= 1;
        return response;
      })
      .mockImplementationOnce(async () => {
        activeRequests += 1;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        const response = await secondRequest.promise;
        activeRequests -= 1;
        return response;
      });
    const firstFile = imageFile("first-lateral.png", 1);
    const secondFile = imageFile("second-lateral.png", 2);
    const user = userEvent.setup();
    const { container } = renderLateralPage();
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    await user.upload(input as HTMLInputElement, [firstFile, secondFile]);
    expect(screen.getByText("second-lateral.png")).toBeTruthy();
    expect(screen.getByText("Image 2 of 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Queue (2)" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Run all" }));
    await waitFor(() => expect(createLAPredictionMock).toHaveBeenCalledOnce());
    expect(maximumActiveRequests).toBe(1);

    await act(async () => {
      firstRequest.resolve({
        ...laPredictionFixture(),
        prediction_id: "first-la-result",
      });
      await firstRequest.promise;
    });
    await waitFor(() =>
      expect(createLAPredictionMock).toHaveBeenCalledTimes(2),
    );
    expect(maximumActiveRequests).toBe(1);

    await act(async () => {
      secondRequest.resolve({
        ...laPredictionFixture(),
        prediction_id: "second-la-result",
      });
      await secondRequest.promise;
    });
    await waitFor(() =>
      expect(screen.getByText("2 of 2 processed")).toBeTruthy(),
    );
    expect(maximumActiveRequests).toBe(1);

    await user.click(screen.getByRole("button", { name: "Queue (2)" }));
    const drawer = await screen.findByRole("dialog", {
      name: /Lateral prediction queue.*2 images/i,
    });
    expect(
      within(drawer).getByRole("heading", {
        name: "Lateral prediction queue",
      }),
    ).toBeTruthy();
    await user.click(
      within(drawer).getByRole("button", { name: /first-lateral\.png/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: /Lateral prediction queue.*2 images/i,
        }),
      ).toBeNull(),
    );
    expect(screen.getByText("first-lateral.png")).toBeTruthy();
    expect(screen.queryByText("second-lateral.png")).toBeNull();
    expect(createPrediction).not.toHaveBeenCalled();
  });
});
