import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { laPredictionFixture } from "@/tests/laPredictionFixture";
import { LA_KEYPOINT_ORDER } from "../api/contract";
import { LateralMeasurementsPanel } from "./LateralMeasurementsPanel";
import { LateralPredictionOverlay } from "./LateralPredictionOverlay";

describe("LateralPredictionOverlay", () => {
  it("renders all six LA landmarks in canonical order at floating-point positions", () => {
    const result = laPredictionFixture();
    const { container } = render(
      <MantineProvider>
        <LateralPredictionOverlay
          cobb={result.cobb}
          image={result.image}
          imageUrl="blob:lateral"
          onSelectCandidate={vi.fn()}
          selectedCandidateId={result.selected_vertebrae[0].candidate_id}
          status="success"
          vertebrae={result.selected_vertebrae}
        />
      </MantineProvider>,
    );

    const markers = Array.from(
      container.querySelectorAll<SVGCircleElement>("[data-landmark-name]"),
    );
    expect(markers).toHaveLength(6);
    expect(markers.map((marker) => marker.dataset.landmarkName)).toEqual(
      LA_KEYPOINT_ORDER,
    );
    expect(
      container.querySelector('[data-landmark-name="top_middle"]')?.getAttribute("cx"),
    ).toBe("50.125");
    expect(
      container.querySelector('[data-landmark-name="bottom_middle"]')?.getAttribute("cy"),
    ).toBe("80.25");
    expect(container.querySelectorAll("[data-cobb-line]")).toHaveLength(1);
  });

  it("labels LA agreement as outer-landmark geometry, not clinical AP/PA Cobb", () => {
    const result = laPredictionFixture();
    render(
      <MantineProvider>
        <LateralMeasurementsPanel
          cobb={result.cobb}
          onSelectCandidate={vi.fn()}
          selectedCandidateId={result.selected_vertebrae[0].candidate_id}
          status="success"
          vertebrae={result.selected_vertebrae}
        />
      </MantineProvider>,
    );

    expect(screen.getByText("Four-outer-landmark agreement")).toBeTruthy();
    expect(
      screen.getByText(
        "LA geometry agreement calculated from the four outer landmarks; not a clinical AP/PA Cobb measurement.",
      ),
    ).toBeTruthy();
  });
});
