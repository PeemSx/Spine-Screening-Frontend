import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScreeningApiError } from "../api/errors";
import type {
  MorphologyFeature,
  PredictionResponse,
} from "../api/generated";
import { queueItem } from "@/tests/predictionFixture";
import { predictionFixture } from "@/tests/predictionFixture";
import { PredictionQueue } from "./PredictionQueue";

function morphologyFeature({
  candidateId,
  detectorScore,
  leftHeight,
  rightHeight,
}: {
  candidateId: number;
  detectorScore: number;
  leftHeight: number;
  rightHeight: number;
}): MorphologyFeature {
  const meanHeight = (leftHeight + rightHeight) * 0.5;
  return {
    rank: 1,
    candidate_id: candidateId,
    detector_score: detectorScore,
    superior_width_px: 20,
    inferior_width_px: 20,
    left_height_px: leftHeight,
    right_height_px: rightHeight,
    mean_height_px: meanHeight,
    left_right_height_ratio: leftHeight / rightHeight,
    height_asymmetry_fraction:
      Math.abs(leftHeight - rightHeight) / Math.max(leftHeight, rightHeight),
    width_height_ratio: 20 / meanHeight,
    superior_endplate_angle_deg: 0,
    inferior_endplate_angle_deg: 0,
    endplate_nonparallel_deg: 0,
    neighbor_reference_height_px: null,
    height_ratio_to_neighbors: null,
    relative_height_deviation: null,
    previous_center_spacing_px: null,
    next_center_spacing_px: null,
  };
}

function resultWithMorphology(
  id: string,
  feature: MorphologyFeature,
): PredictionResponse {
  return {
    ...predictionFixture(id),
    // An empty landmark array makes the assessment use the API-provided
    // morphology heights directly, keeping this filtering test focused.
    selected_vertebrae: [],
    morphology: [feature],
  };
}

describe("PredictionQueue", () => {
  it("shows the selected case and lets the reviewer choose another case", async () => {
    const first = queueItem("first");
    const second = queueItem("second");
    const onSelectItem = vi.fn();
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <PredictionQueue
          items={[first, second]}
          onSelectItem={onSelectItem}
          selectedItemId={first.id}
        />
      </MantineProvider>,
    );

    expect(
      screen.getByRole("button", { name: /first\.png/i })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /second\.png/i })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    await user.click(
      screen.getByRole("button", { name: /second\.png/i }),
    );
    expect(onSelectItem).toHaveBeenCalledWith(second.id);
  });

  it("filters cases by morphology signals, low reliability, warnings, and failures", async () => {
    const signal = queueItem("signal", {
      status: "success",
      result: resultWithMorphology(
        "signal-result",
        morphologyFeature({
          candidateId: 1,
          detectorScore: 0.8,
          leftHeight: 10,
          rightHeight: 20,
        }),
      ),
    });
    const lowReliability = queueItem("low-reliability", {
      status: "success",
      result: resultWithMorphology(
        "low-reliability-result",
        morphologyFeature({
          candidateId: 2,
          detectorScore: 0.25,
          leftHeight: 20,
          rightHeight: 20,
        }),
      ),
    });
    const warning = queueItem("warning", {
      status: "success",
      result: {
        ...predictionFixture("warning-result"),
        warnings: ["Review image orientation."],
      },
    });
    const failed = queueItem("failed", {
      status: "error",
      error: new ScreeningApiError({ message: "Request failed." }),
    });
    render(
      <MantineProvider>
        <PredictionQueue
          items={[signal, lowReliability, warning, failed]}
          onSelectItem={vi.fn()}
          selectedItemId={signal.id}
        />
      </MantineProvider>,
    );

    const filter = screen.getByRole("textbox", {
      name: "Filter prediction queue",
    });
    const chooseFilter = async (name: string) => {
      fireEvent.mouseDown(filter);
      fireEvent.click(screen.getByRole("option", { hidden: true, name }));
    };
    const expectOnlyVisibleCase = (fileName: string) => {
      const accessibleName = new RegExp(
        fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      expect(
        screen.getByRole("button", {
          name: accessibleName,
        }),
      ).toBeTruthy();
      for (const otherName of [
        "signal.png",
        "low-reliability.png",
        "warning.png",
        "failed.png",
      ]) {
        if (otherName === fileName) continue;
        const otherAccessibleName = new RegExp(
          otherName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        );
        expect(
          screen.queryByRole("button", {
            name: otherAccessibleName,
          }),
        ).toBeNull();
      }
    };

    await chooseFilter("Morphology signals");
    expectOnlyVisibleCase("signal.png");

    await chooseFilter("Low reliability");
    expectOnlyVisibleCase("low-reliability.png");

    await chooseFilter("Warnings");
    expectOnlyVisibleCase("warning.png");

    await chooseFilter("Failed");
    expectOnlyVisibleCase("failed.png");
  });
});
