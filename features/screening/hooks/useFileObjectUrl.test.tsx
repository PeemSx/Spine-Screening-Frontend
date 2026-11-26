import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { imageFile } from "@/tests/predictionFixture";
import { useFileObjectUrl } from "./useFileObjectUrl";

describe("useFileObjectUrl", () => {
  it("recreates a valid URL after a React remount cycle", async () => {
    const file = imageFile("lateral.png");
    const { result } = renderHook(() => useFileObjectUrl(file), {
      reactStrictMode: true,
    });

    await waitFor(() => expect(result.current).not.toBeNull());

    const currentUrl = result.current;
    const revokedUrls = vi.mocked(URL.revokeObjectURL).mock.calls.flat();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokedUrls).not.toContain(currentUrl);
  });

  it("releases the old URL when the displayed file changes or unmounts", async () => {
    const first = imageFile("first.png", 1);
    const second = imageFile("second.png", 2);
    const { result, rerender, unmount } = renderHook(
      ({ file }: { file: File | null }) => useFileObjectUrl(file),
      { initialProps: { file: first } },
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    const firstUrl = result.current;

    rerender({ file: second });
    await waitFor(() => expect(result.current).not.toBe(firstUrl));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    const secondUrl = result.current;

    act(() => unmount());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(secondUrl);
  });
});
