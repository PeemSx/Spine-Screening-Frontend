import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrediction } from "../api/client";
import { ScreeningApiError } from "../api/errors";
import { usePredictionQueue } from "./usePredictionQueue";
import {
  imageFile,
  predictionFixture,
} from "@/tests/predictionFixture";

vi.mock("../api/client", () => ({
  createPrediction: vi.fn(),
}));

const createPredictionMock = vi.mocked(createPrediction);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("usePredictionQueue", () => {
  beforeEach(() => {
    createPredictionMock.mockReset();
  });

  afterEach(() => {
    vi.mocked(URL.createObjectURL).mockClear();
    vi.mocked(URL.revokeObjectURL).mockClear();
  });

  it("adds valid files, rejects duplicates, and enforces the 20-image cap", () => {
    const { result } = renderHook(() => usePredictionQueue());
    const files = Array.from({ length: 21 }, (_, index) =>
      imageFile(`image-${index + 1}.png`, index + 1),
    );
    let addition: ReturnType<typeof result.current.addFiles> | undefined;

    act(() => {
      addition = result.current.addFiles([
        files[0],
        files[0],
        ...files.slice(1),
      ]);
    });

    expect(addition?.added).toHaveLength(20);
    expect(addition?.rejected.map(({ code }) => code)).toEqual([
      "duplicate",
      "batch_limit",
    ]);
    expect(result.current.items).toHaveLength(20);
    expect(result.current.selectedItemId).toBe(result.current.items[19].id);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(20);
  });

  it("runs predictions strictly one at a time", async () => {
    const firstRequest = deferred<ReturnType<typeof predictionFixture>>();
    const secondRequest = deferred<ReturnType<typeof predictionFixture>>();
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

    const { result } = renderHook(() => usePredictionQueue());
    act(() => {
      result.current.addFiles([
        imageFile("first.png"),
        imageFile("second.png"),
      ]);
      result.current.runAll();
    });

    await waitFor(() => expect(createPredictionMock).toHaveBeenCalledTimes(1));
    expect(result.current.items.map(({ status }) => status)).toEqual([
      "running",
      "queued",
    ]);

    await act(async () => {
      firstRequest.resolve(predictionFixture("first"));
      await firstRequest.promise;
    });
    await waitFor(() => expect(createPredictionMock).toHaveBeenCalledTimes(2));
    expect(maximumActiveRequests).toBe(1);

    await act(async () => {
      secondRequest.resolve(predictionFixture("second"));
      await secondRequest.promise;
    });
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(result.current.items.map(({ status }) => status)).toEqual([
      "success",
      "success",
    ]);
    expect(maximumActiveRequests).toBe(1);
  });

  it("continues to the next queued image after a failure without switching selection", async () => {
    createPredictionMock
      .mockRejectedValueOnce(
        new ScreeningApiError({
          message: "First request failed",
          requestId: "request-1",
        }),
      )
      .mockResolvedValueOnce(predictionFixture("second"));

    const { result } = renderHook(() => usePredictionQueue());
    act(() => {
      result.current.addFiles([
        imageFile("first.png"),
        imageFile("second.png"),
      ]);
    });
    const initiallySelectedId = result.current.selectedItemId;
    act(() => {
      result.current.runAll();
    });

    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(createPredictionMock).toHaveBeenCalledTimes(2);
    expect(result.current.items.map(({ status }) => status)).toEqual([
      "error",
      "success",
    ]);
    expect(result.current.items[0].error?.requestId).toBe("request-1");
    expect(result.current.selectedItemId).toBe(initiallySelectedId);
  });

  it("stops the worker, re-queues the active case, and ignores a stale response", async () => {
    const request = deferred<ReturnType<typeof predictionFixture>>();
    createPredictionMock.mockReturnValueOnce(request.promise);
    const { result } = renderHook(() => usePredictionQueue());

    act(() => {
      result.current.addFiles([imageFile("active.png")]);
    });
    act(() => {
      result.current.runAll();
    });
    await waitFor(() => expect(result.current.items[0].status).toBe("running"));

    const signal = createPredictionMock.mock.calls[0][1]?.signal;
    act(() => {
      result.current.stop();
    });
    expect(signal?.aborted).toBe(true);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.items[0]).toMatchObject({
      status: "queued",
      result: null,
    });

    await act(async () => {
      request.resolve(predictionFixture("stale"));
      await request.promise;
      await Promise.resolve();
    });
    expect(result.current.items[0]).toMatchObject({
      status: "queued",
      result: null,
    });
  });

  it("retries only failed cases and leaves other queued work untouched", async () => {
    createPredictionMock
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(predictionFixture("retried"));
    const { result } = renderHook(() => usePredictionQueue());

    act(() => {
      result.current.addFiles([imageFile("retry.png")]);
      result.current.runAll();
    });
    await waitFor(() => expect(result.current.items[0].status).toBe("error"));

    act(() => {
      result.current.addFiles([imageFile("not-started.png")]);
    });
    expect(result.current.items[1].status).toBe("queued");

    act(() => {
      result.current.retryFailed();
    });
    await waitFor(() => expect(result.current.items[0].status).toBe("success"));
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(createPredictionMock).toHaveBeenCalledTimes(2);
    expect(result.current.items[0].result?.prediction_id).toBe("retried");
    expect(result.current.items[1].status).toBe("queued");
  });

  it("retains selected candidates by case and cleans up object URLs", () => {
    const { result, unmount } = renderHook(() => usePredictionQueue());
    act(() => {
      result.current.addFiles([
        imageFile("first.png"),
        imageFile("second.png"),
      ]);
    });
    const [first, second] = result.current.items;

    act(() => {
      result.current.setItemSelectedCandidateId(first.id, 101);
      result.current.setItemSelectedCandidateId(second.id, 202);
      result.current.selectItem(second.id);
    });
    expect(result.current.selectedItem?.selectedCandidateId).toBe(202);
    act(() => {
      result.current.selectItem(first.id);
    });
    expect(result.current.selectedItem?.selectedCandidateId).toBe(101);

    act(() => {
      result.current.removeItem(first.id);
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.imageUrl);

    const secondUrl = second.imageUrl;
    act(() => {
      result.current.clear();
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(secondUrl);

    act(() => {
      result.current.addFiles([imageFile("unmount.png")]);
    });
    const unmountUrl = result.current.items[0].imageUrl;
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(unmountUrl);
  });
});
