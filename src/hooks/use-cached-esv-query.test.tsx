import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCachedEsvQuery } from "./use-cached-esv-query";

const fetchPassageMock = vi.fn();
const cache = new Map<string, unknown>();

vi.mock("convex/react", () => ({
  useAction: () => fetchPassageMock,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    esv: {
      getPassageText: "getPassageText",
    },
  },
}));

vi.mock("../../shared/esv-api", () => ({
  getCachedPassage: (query: string) => cache.get(query) ?? null,
  setCachedPassage: (query: string, data: unknown) => {
    cache.set(query, data);
  },
  parseEsvResponse: (raw: unknown) => raw,
}));

describe("useCachedEsvQuery", () => {
  beforeEach(() => {
    cache.clear();
    fetchPassageMock.mockReset();
  });

  it("keeps cached data visible when a stale request resolves later", async () => {
    cache.set("John 2", { verses: [{ number: 2, text: "Cached verse" }] });

    let resolveFirstRequest: ((value: unknown) => void) | null = null;
    fetchPassageMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirstRequest = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useCachedEsvQuery(query),
      {
        initialProps: { query: "John 1" as string | null },
      },
    );

    expect(result.current.loading).toBe(true);
    expect(fetchPassageMock).toHaveBeenCalledWith({ query: "John 1" });

    rerender({ query: "John 2" });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({
      verses: [{ number: 2, text: "Cached verse" }],
    });

    await act(async () => {
      resolveFirstRequest?.({ verses: [{ number: 1, text: "Stale verse" }] });
      await Promise.resolve();
    });

    expect(result.current.data).toEqual({
      verses: [{ number: 2, text: "Cached verse" }],
    });
    expect(cache.get("John 1")).toBeUndefined();
  });

  it("retry refetches after a failed passage load", async () => {
    fetchPassageMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ verses: [{ number: 1, text: "ok" }] });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));

    await waitFor(() => {
      expect(result.current.error).toBe("network");
    });

    expect(fetchPassageMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "ok" }],
      });
    });

    expect(fetchPassageMock).toHaveBeenCalledTimes(2);
    expect(fetchPassageMock).toHaveBeenLastCalledWith({ query: "John 1" });
  });
});
