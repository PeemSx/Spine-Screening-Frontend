import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { imageFile } from "@/tests/predictionFixture";
import { UploadPanel } from "./UploadPanel";

function uploadPanelProps(
  overrides: Partial<ComponentProps<typeof UploadPanel>> = {},
): ComponentProps<typeof UploadPanel> {
  return {
    activeFileName: null,
    failedCount: 0,
    hasCompletedResults: false,
    hasSignalItems: false,
    isProcessing: false,
    itemCount: 0,
    processedCount: 0,
    progressPercent: 0,
    queuedCount: 0,
    selectedIndex: 0,
    showQueueButton: false,
    onAddFiles: vi.fn(() => ({ added: [], rejected: [] })),
    onClear: vi.fn(),
    onNext: vi.fn(),
    onNextSignal: vi.fn(),
    onOpenQueue: vi.fn(),
    onPrevious: vi.fn(),
    onRetryFailed: vi.fn(),
    onRun: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
}

function renderUploadPanel(props: ComponentProps<typeof UploadPanel>) {
  return render(
    <MantineProvider>
      <UploadPanel {...props} />
    </MantineProvider>,
  );
}

describe("UploadPanel", () => {
  it("passes all files from the initial multi-file picker and lists each rejection", async () => {
    const first = imageFile("duplicate.png", 1);
    const second = imageFile("over-limit.png", 2);
    const onAddFiles = vi.fn<
      ComponentProps<typeof UploadPanel>["onAddFiles"]
    >(() => ({
      added: [],
      rejected: [
        {
          file: first,
          code: "duplicate" as const,
          message: "duplicate",
        },
        {
          file: second,
          code: "batch_limit" as const,
          message: "batch limit",
        },
      ],
    }));
    const props = uploadPanelProps({ onAddFiles });
    const user = userEvent.setup();
    const { container } = renderUploadPanel(props);
    const input = container.querySelector('input[type="file"]');

    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, [first, second]);

    await waitFor(() => expect(onAddFiles).toHaveBeenCalledTimes(1));
    expect(onAddFiles.mock.calls[0][0]).toEqual([first, second]);
    expect(screen.getByRole("alert").textContent).toContain("duplicate.png");
    expect(screen.getByRole("alert").textContent).toContain("over-limit.png");
    expect(screen.getByRole("alert").textContent).toContain(
      "This image is already in the batch.",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "The batch already contains 20 images.",
    );
  });

  it("keeps the compact single-image controls usable without exposing a queue button", async () => {
    const onRun = vi.fn();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const props = uploadPanelProps({
      itemCount: 1,
      queuedCount: 1,
      onRun,
      onPrevious,
      onNext,
    });
    const user = userEvent.setup();
    renderUploadPanel(props);

    expect(
      screen.queryByText("Drop AP or PA radiographs here"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Add images" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run all" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear batch" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Queue/ })).toBeNull();
    const appendDropzone = screen.getByLabelText(
      "Drop images to add them to the prediction queue",
    );
    expect(appendDropzone).toBeTruthy();
    expect(screen.getByText(/drop more AP or PA radiographs here/i)).toBeTruthy();
    expect(
      appendDropzone.contains(screen.getByRole("button", { name: "Run all" })),
    ).toBe(false);
    expect(
      (screen.getByRole("button", {
        name: "Previous image",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", {
        name: "Next image",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "Run all" }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("adds dropped files from the compact queue toolbar", async () => {
    const droppedFile = imageFile("dropped-after-first.png", 2);
    const onAddFiles = vi.fn<
      ComponentProps<typeof UploadPanel>["onAddFiles"]
    >(() => ({ added: [], rejected: [] }));
    const props = uploadPanelProps({
      itemCount: 1,
      queuedCount: 1,
      onAddFiles,
    });
    renderUploadPanel(props);

    fireEvent.drop(
      screen.getByLabelText("Drop images to add them to the prediction queue"),
      {
        dataTransfer: {
          files: [droppedFile],
          items: [
            {
              getAsFile: () => droppedFile,
              kind: "file",
              type: droppedFile.type,
            },
          ],
          types: ["Files"],
        },
      },
    );

    await waitFor(() => expect(onAddFiles).toHaveBeenCalledTimes(1));
    expect(onAddFiles).toHaveBeenCalledWith([droppedFile]);
  });
});
