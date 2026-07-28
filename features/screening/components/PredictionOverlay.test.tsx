import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  MorphologyFeature,
  VertebraPrediction,
} from "../api/generated";
import { PredictionOverlay } from "./PredictionOverlay";

function vertebra(
  detectorScore: number,
  rightHeight: number,
): VertebraPrediction {
  return {
    candidate_id: 1,
    rank: 1,
    detector_score: detectorScore,
    center: { x: 50, y: 50 },
    corners: {
      top_left: { x: 40, y: 40 },
      top_right: { x: 60, y: 40 },
      bottom_left: { x: 40, y: 60 },
      bottom_right: { x: 60, y: 40 + rightHeight },
    },
  };
}

function morphology(
  detectorScore: number,
  rightHeight: number,
): MorphologyFeature {
  return {
    rank: 1,
    candidate_id: 1,
    detector_score: detectorScore,
    superior_width_px: 20,
    inferior_width_px: 20,
    left_height_px: 20,
    right_height_px: rightHeight,
    mean_height_px: (20 + rightHeight) / 2,
    left_right_height_ratio: 20 / rightHeight,
    height_asymmetry_fraction: (20 - rightHeight) / 20,
    width_height_ratio: 1,
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

function renderOverlay(detectorScore: number, rightHeight: number) {
  const prediction = vertebra(detectorScore, rightHeight);

  return render(
    <MantineProvider>
      <PredictionOverlay
        cobb={{
          valid: false,
          vertebra_count: 1,
          cobb_1_deg: null,
          cobb_2_deg: null,
          cobb_3_deg: null,
          major_lines: [],
          cobb_2_lines: [],
          cobb_3_lines: [],
        }}
        image={{ height: 100, media_type: "image/png", width: 100 }}
        imageUrl="blob:prediction"
        morphology={[morphology(detectorScore, rightHeight)]}
        onSelectCandidate={vi.fn()}
        selectedCandidateId={null}
        status="success"
        vertebrae={[prediction]}
      />
    </MantineProvider>,
  );
}

describe("PredictionOverlay morphology markers", () => {
  it("marks suspicious morphology independently from detector reliability", () => {
    const { container } = renderOverlay(0.24, 15);

    expect(
      container.querySelector(
        '[data-morphology-status="high_priority_morphology_signal"]',
      ),
    ).not.toBeNull();
    expect(
      screen.getAllByText("Morphology screening signal").length,
    ).toBeGreaterThan(0);
  });

  it("marks borderline morphology but not not-assessable morphology", () => {
    const borderline = renderOverlay(0.8, 16.5);
    expect(
      borderline.container.querySelector(
        '[data-morphology-status="borderline_morphology_signal"]',
      ),
    ).not.toBeNull();
    borderline.unmount();

    const lowReliability = renderOverlay(0.17, 14);
    expect(
      lowReliability.container.querySelector("[data-morphology-status]"),
    ).toBeNull();
  });

  it("allows morphology markers to be hidden without hiding other layers", async () => {
    const user = userEvent.setup();
    const { container } = renderOverlay(0.8, 15);

    const layerButton = screen.getByRole("button", { name: "Layers 5/5" });
    await user.click(layerButton);
    const layerDropdownId = layerButton.getAttribute("aria-controls");
    expect(layerDropdownId).not.toBeNull();
    const layerDropdown = await waitFor(() => {
      const dropdown = document.getElementById(layerDropdownId as string);
      expect(dropdown).not.toBeNull();
      if (!dropdown) {
        throw new Error("Layer controls did not open");
      }
      return dropdown;
    });
    await user.click(
      within(layerDropdown).getByRole("checkbox", {
        hidden: true,
        name: "Morphology markers",
      }),
    );

    expect(
      container.querySelector("[data-morphology-status]"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Layers 4/5" })).toBeTruthy();
  });
});
