import { afterEach, describe, expect, it, vi } from "vitest";
import { laPredictionFixture } from "@/tests/laPredictionFixture";
import { createLAPrediction } from "./client";
import { isLAPredictionResponse } from "./contract";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LA API contract", () => {
  it("accepts all six ordered keypoints without rounding coordinates", () => {
    const response = laPredictionFixture();

    expect(isLAPredictionResponse(response)).toBe(true);
    expect(response.selected_vertebrae[0].keypoints.top_middle.x).toBe(50.125);
    expect(response.selected_vertebrae[0].keypoints.bottom_middle.y).toBe(80.25);
  });

  it("rejects a changed keypoint order or a missing middle landmark", () => {
    const changedOrder = structuredClone(laPredictionFixture()) as unknown as {
      keypoint_order: string[];
    };
    [changedOrder.keypoint_order[1], changedOrder.keypoint_order[2]] = [
      changedOrder.keypoint_order[2],
      changedOrder.keypoint_order[1],
    ];
    expect(isLAPredictionResponse(changedOrder)).toBe(false);

    const missingMiddle = structuredClone(laPredictionFixture()) as unknown as {
      selected_vertebrae: Array<{ keypoints: Record<string, unknown> }>;
    };
    delete missingMiddle.selected_vertebrae[0].keypoints.bottom_middle;
    expect(isLAPredictionResponse(missingMiddle)).toBe(false);
  });

  it("posts the image field to the LA endpoint", async () => {
    const response = laPredictionFixture();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["lateral"], "lateral.png", {
      type: "image/png",
    });

    await expect(createLAPrediction(file)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/spine-api/la/predictions");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("image")).toBeInstanceOf(File);
  });
});
