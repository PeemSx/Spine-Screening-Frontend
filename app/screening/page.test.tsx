import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrediction } from "@/features/screening/api/client";
import type { PredictionResponse } from "@/features/screening/api/generated";
import {
  imageFile,
  predictionFixture,
} from "@/tests/predictionFixture";
import ScreeningPage from "./page";

vi.mock("@/features/screening/api/client", () => ({
  createPrediction: vi.fn(),
}));

const createPredictionMock = vi.mocked(createPrediction);

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

function configureViewport(wide: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: wide && query === "(min-width: 100em)",
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function renderScreeningPage() {
  return render(
    <MantineProvider>
      <ScreeningPage />
    </MantineProvider>,
  );
}

async function uploadFiles(
  container: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
  files: File[],
) {
  const fileInput = container.querySelector('input[type="file"]');
  expect(fileInput).not.toBeNull();
  await user.upload(fileInput as HTMLInputElement, files);
}

describe("ScreeningPage bulk workflow", () => {
  beforeEach(() => {
    createPredictionMock.mockReset();
    configureViewport(false);
  });

  it("reviews two sequential results through the narrow queue drawer and keeps zoom layers usable", async () => {
    const firstRequest = deferred<PredictionResponse>();
    const secondRequest = deferred<PredictionResponse>();
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    createPredictionMock
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
    const firstFile = imageFile("first-case.png", 1);
    const secondFile = imageFile("second-case.png", 2);
    const user = userEvent.setup();
    const { container } = renderScreeningPage();

    await uploadFiles(container, user, [firstFile, secondFile]);
    expect(
      await screen.findByRole("button", { name: "Queue (2)" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Prediction queue" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Run all" }));
    await waitFor(() => expect(createPredictionMock).toHaveBeenCalledTimes(1));
    expect(maximumActiveRequests).toBe(1);

    await act(async () => {
      firstRequest.resolve(predictionFixture("first-result", 11));
      await firstRequest.promise;
    });
    await waitFor(() => expect(createPredictionMock).toHaveBeenCalledTimes(2));
    expect(maximumActiveRequests).toBe(1);

    await act(async () => {
      secondRequest.resolve(predictionFixture("second-result", 22));
      await secondRequest.promise;
    });
    await waitFor(() =>
      expect(screen.getByText("2 of 2 processed")).toBeTruthy(),
    );
    expect(maximumActiveRequests).toBe(1);

    await user.click(screen.getByRole("button", { name: "Queue (2)" }));
    const drawer = await screen.findByRole("dialog", {
      name: /Prediction queue.*2 images/i,
    });
    await user.click(
      within(drawer).getByRole("button", { name: /second-case\.png/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", {
        name: /Prediction queue.*2 images/i,
      })).toBeNull(),
    );
    expect(screen.getByText("second-case.png")).toBeTruthy();
    expect(screen.queryByText("first-case.png")).toBeNull();
    expect(screen.getByText("Predicted centers: 1")).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: /Submitted radiograph with vertebral corner landmarks/i,
      }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Open zoom viewer" }),
    );
    const zoomDialog = await screen.findByRole("dialog", {
      name: "Prediction inspection",
    });
    expect(
      within(zoomDialog).getByRole("application", {
        name: "Zoomable prediction viewer",
      }),
    ).toBeTruthy();

    const layerButton = within(zoomDialog).getByRole("button", {
      name: "Layers 5/5",
    });
    await user.click(layerButton);
    expect(layerButton.getAttribute("aria-expanded")).toBe("true");
    const layerDropdownId = layerButton.getAttribute("aria-controls");
    expect(layerDropdownId).not.toBeNull();
    const layerDropdown = document.getElementById(layerDropdownId as string);
    expect(layerDropdown).not.toBeNull();
    const reliabilityToggle = within(layerDropdown as HTMLElement).getByRole(
      "checkbox",
      {
        hidden: true,
        name: "Reliability markers",
      },
    );
    expect((reliabilityToggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(reliabilityToggle);
    expect((reliabilityToggle as HTMLInputElement).checked).toBe(false);
    expect(
      within(zoomDialog).getByRole("button", { name: "Layers 4/5" }),
    ).toBeTruthy();
    expect(
      within(zoomDialog).getByRole("button", { name: "Zoom in" }),
    ).toBeTruthy();
  });

  it("uses the persistent queue at 1600px and does not render the drawer trigger", async () => {
    configureViewport(true);
    const user = userEvent.setup();
    const { container } = renderScreeningPage();

    await uploadFiles(container, user, [
      imageFile("wide-first.png", 1),
      imageFile("wide-second.png", 2),
    ]);

    const queueHeading = await screen.findByRole("heading", {
      name: "Prediction queue",
    });
    expect(queueHeading).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /wide-first\.png/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /wide-second\.png/i }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Queue (2)" }),
    ).toBeNull();
    expect(
      screen.queryByRole("dialog", {
        name: /Prediction queue.*2 images/i,
      }),
    ).toBeNull();
  });
});
