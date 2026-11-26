import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(
      Array.from(container.querySelectorAll("[data-landmark-name]")).map(
        (marker) => marker.getAttribute("fill"),
      ),
    ).toEqual(Array(6).fill("#ffff00"));
    expect(
      Array.from(container.querySelectorAll("[data-vertebra-outline]")).map(
        (outline) => outline.getAttribute("stroke-width"),
      ),
    ).toEqual(Array(4).fill("1.5"));

    const vertebraOverlay = container.querySelector("[data-candidate-id]");
    const curvatureOverlay = container.querySelector(
      "[data-la-curvature-measurement]",
    );
    expect(vertebraOverlay).not.toBeNull();
    expect(curvatureOverlay).not.toBeNull();
    if (!vertebraOverlay || !curvatureOverlay) {
      throw new Error("Expected landmark and curvature overlays");
    }
    expect(
      vertebraOverlay.compareDocumentPosition(curvatureOverlay) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("cycles the same landmark palette used by the frontal overlay", () => {
    const result = laPredictionFixture();
    const first = result.selected_vertebrae[0];
    const second = { ...first, candidate_id: 8, rank: 2 };
    const { container } = render(
      <MantineProvider>
        <LateralPredictionOverlay
          cobb={result.cobb}
          image={result.image}
          imageUrl="blob:lateral"
          onSelectCandidate={vi.fn()}
          selectedCandidateId={first.candidate_id}
          status="success"
          vertebrae={[first, second]}
        />
      </MantineProvider>,
    );

    const markerColors = Array.from(
      container.querySelectorAll("[data-landmark-name]"),
    ).map((marker) => marker.getAttribute("fill"));
    expect(markerColors.slice(0, 6)).toEqual(Array(6).fill("#ffff00"));
    expect(markerColors.slice(6, 12)).toEqual(Array(6).fill("#00ff00"));
  });

  it("selects a vertebra from its full body hit area like the frontal overlay", () => {
    const result = laPredictionFixture();
    const first = result.selected_vertebrae[0];
    const second = { ...first, candidate_id: 8, rank: 2 };
    const onSelectCandidate = vi.fn();
    const { container } = render(
      <MantineProvider>
        <LateralPredictionOverlay
          cobb={result.cobb}
          image={result.image}
          imageUrl="blob:lateral"
          onSelectCandidate={onSelectCandidate}
          selectedCandidateId={first.candidate_id}
          status="success"
          vertebrae={[first, second]}
        />
      </MantineProvider>,
    );

    const secondHitArea = container.querySelector(
      '[data-candidate-id="8"] [data-vertebra-hit-area]',
    );
    expect(secondHitArea).not.toBeNull();
    expect(secondHitArea?.getAttribute("points")).toBe(
      "31.25,40.5 69.625,41.25 70.75,78.875 32.875,79.5",
    );

    fireEvent.click(secondHitArea as SVGPolygonElement);
    expect(onSelectCandidate).toHaveBeenCalledOnce();
    expect(onSelectCandidate).toHaveBeenCalledWith(8);
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

    expect(screen.getByText("Four-outer-landmark curvature")).toBeTruthy();
    expect(
      screen.getByText(
        "LA geometry agreement calculated from the four outer landmarks; not a clinical AP/PA Cobb measurement.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/top left/i)).toBeNull();
    expect(screen.queryByText("31.3, 40.5")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Detected lateral vertebra 1, score 0.87",
      }),
    ).toBeTruthy();
  });

  it("renders every calculated lateral curvature with an angle label", () => {
    const result = laPredictionFixture();
    const { container } = render(
      <MantineProvider>
        <LateralPredictionOverlay
          cobb={{
            ...result.cobb,
            cobb_2_deg: 8.5,
            cobb_2_lines: result.cobb.major_lines,
            cobb_3_deg: 14.25,
            cobb_3_lines: result.cobb.major_lines,
          }}
          image={{ ...result.image, width: 1000, height: 1200 }}
          imageUrl="blob:lateral"
          onSelectCandidate={vi.fn()}
          selectedCandidateId={result.selected_vertebrae[0].candidate_id}
          status="success"
          vertebrae={result.selected_vertebrae}
        />
      </MantineProvider>,
    );

    expect(
      container.querySelectorAll("[data-la-curvature-measurement]"),
    ).toHaveLength(3);
    expect(screen.getAllByText("Curve 1: 3.3°")).toHaveLength(2);
    expect(screen.getAllByText("Curve 2: 8.5°")).toHaveLength(2);
    expect(screen.getAllByText("Curve 3: 14.3°")).toHaveLength(2);
    const curveLabel = container.querySelector(
      '[data-la-curvature-measurement="Curve 1"] text',
    );
    expect(Number(curveLabel?.getAttribute("font-size"))).toBeGreaterThanOrEqual(18);
    const curveLabelBackground = container.querySelector<SVGRectElement>(
      '[data-la-curvature-measurement="Curve 1"] rect',
    );
    expect(Number(curveLabelBackground?.getAttribute("x"))).toBeGreaterThan(69.625);
  });

  it("lets reviewers control layers and open the full-screen viewer", async () => {
    const result = laPredictionFixture();
    const user = userEvent.setup();
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

    const layerButton = screen.getByRole("button", { name: "Layers 2/2" });
    await user.click(layerButton);
    const dropdownId = layerButton.getAttribute("aria-controls");
    expect(dropdownId).not.toBeNull();
    const dropdown = await waitFor(() => {
      const element = document.getElementById(dropdownId as string);
      expect(element).not.toBeNull();
      if (!element) throw new Error("Layer controls did not open");
      return element;
    });
    await user.click(
      within(dropdown).getByRole("checkbox", {
        hidden: true,
        name: "Six-point landmarks",
      }),
    );

    expect(container.querySelectorAll("[data-landmark-name]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Layers 1/2" })).toBeTruthy();
    expect(screen.getAllByText("Selected: vertebra 1")).toHaveLength(2);
    expect(screen.getByText("Inspect")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Open prediction inspection" }),
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText("Prediction inspection")).toBeTruthy();
    expect(
      screen.getByRole("application", {
        name: "Zoomable lateral prediction viewer",
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeTruthy();
  });
});
