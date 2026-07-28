import { describe, expect, it } from "vitest";
import { ScreeningApiError } from "../api/errors";
import {
  initialPredictionQueueState,
  predictionQueueReducer,
} from "./queueReducer";
import {
  predictionFixture,
  queueItem,
} from "@/tests/predictionFixture";

describe("predictionQueueReducer", () => {
  it("selects only the first added case and never auto-switches on completion", () => {
    const first = queueItem("first");
    const second = queueItem("second");
    let state = predictionQueueReducer(initialPredictionQueueState, {
      type: "add",
      items: [first, second],
    });

    expect(state.selectedItemId).toBe(first.id);

    state = predictionQueueReducer(state, {
      type: "start_processing",
    });
    state = predictionQueueReducer(state, {
      type: "start_item",
      itemId: first.id,
    });
    state = predictionQueueReducer(state, {
      type: "complete_item",
      itemId: first.id,
      result: predictionFixture("prediction-first", 11),
    });

    expect(state.selectedItemId).toBe(first.id);
    expect(state.items[0].selectedCandidateId).toBe(11);

    state = predictionQueueReducer(state, {
      type: "start_item",
      itemId: second.id,
    });
    state = predictionQueueReducer(state, {
      type: "complete_item",
      itemId: second.id,
      result: predictionFixture("prediction-second", 22),
    });

    expect(state.selectedItemId).toBe(first.id);
  });

  it("retains a separate selected vertebra candidate for each case", () => {
    const first = queueItem("first");
    const second = queueItem("second");
    let state = predictionQueueReducer(initialPredictionQueueState, {
      type: "add",
      items: [first, second],
    });

    state = predictionQueueReducer(state, {
      type: "select_candidate",
      itemId: first.id,
      candidateId: 101,
    });
    state = predictionQueueReducer(state, {
      type: "select_candidate",
      itemId: second.id,
      candidateId: 202,
    });
    state = predictionQueueReducer(state, {
      type: "select",
      itemId: second.id,
    });
    state = predictionQueueReducer(state, {
      type: "select",
      itemId: first.id,
    });

    expect(state.items.find(({ id }) => id === first.id)?.selectedCandidateId)
      .toBe(101);
    expect(state.items.find(({ id }) => id === second.id)?.selectedCandidateId)
      .toBe(202);
  });

  it("returns an active item to queued when stopped and ignores its stale result", () => {
    const item = queueItem("active");
    let state = predictionQueueReducer(initialPredictionQueueState, {
      type: "add",
      items: [item],
    });
    state = predictionQueueReducer(state, { type: "start_processing" });
    state = predictionQueueReducer(state, {
      type: "start_item",
      itemId: item.id,
    });
    state = predictionQueueReducer(state, { type: "stop_processing" });

    expect(state.isProcessing).toBe(false);
    expect(state.activeItemId).toBeNull();
    expect(state.items[0].status).toBe("queued");

    const afterStaleCompletion = predictionQueueReducer(state, {
      type: "complete_item",
      itemId: item.id,
      result: predictionFixture("stale"),
    });
    expect(afterStaleCompletion).toBe(state);
    expect(afterStaleCompletion.items[0].result).toBeNull();
  });

  it("resets only failed cases when retrying", () => {
    const failed = queueItem("failed", {
      status: "error",
      error: new ScreeningApiError({ message: "failed" }),
    });
    const succeeded = queueItem("succeeded", {
      status: "success",
      result: predictionFixture("already-complete"),
    });
    const state = predictionQueueReducer(
      {
        ...initialPredictionQueueState,
        items: [failed, succeeded],
        selectedItemId: failed.id,
      },
      { type: "retry_failed" },
    );

    expect(state.items[0]).toMatchObject({
      status: "queued",
      result: null,
      error: null,
    });
    expect(state.items[1]).toBe(succeeded);
  });
});
