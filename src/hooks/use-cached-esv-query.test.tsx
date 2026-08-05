import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCachedEsvQuery } from "./use-cached-esv-query";

const { fetchPassageMock, logInteractionMock, cache, cacheReadGate } =
  vi.hoisted(() => ({
    fetchPassageMock: vi.fn(),
    logInteractionMock: vi.fn(),
    cache: new Map<string, unknown>(),
    /** Force the next N reads to miss (simulates a render-phase cache miss). */
    cacheReadGate: { missCount: 0 },
  }));

vi.mock("convex/react", () => ({
  useAction: () => fetchPassageMock,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { esv: { getPassage: "getPassage" } },
}));

vi.mock("../../shared/esv-api", () => ({
  getCachedPassage: (query: string) => {
    if (cacheReadGate.missCount > 0) {
      cacheReadGate.missCount -= 1;
      return null;
    }
    return cache.get(query) ?? null;
  },
  setCachedPassage: (query: string, data: unknown) => {
    cache.set(query, data);
  },
}));

vi.mock("@/lib/dev-log", () => ({
  logInteraction: logInteractionMock,
}));

describe("useCachedEsvQuery", () => {
  beforeEach(() => {
    cache.clear();
    cacheReadGate.missCount = 0;
    fetchPassageMock.mockReset();
    logInteractionMock.mockReset();
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
      { initialProps: { query: "John 1" } },
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

    act(() => result.current.retry());

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "ok" }],
      });
    });

    expect(fetchPassageMock).toHaveBeenCalledTimes(2);
    expect(fetchPassageMock).toHaveBeenLastCalledWith({ query: "John 1" });
  });

  it("does not fetch when disabled and fetches once enabled", async () => {
    fetchPassageMock.mockResolvedValue({
      verses: [{ number: 1, text: "ok" }],
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useCachedEsvQuery("John 1", { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(fetchPassageMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "ok" }],
      });
    });
    expect(fetchPassageMock).toHaveBeenCalledTimes(1);
  });

  it("fetches HTML data, caches it, and logs miss metrics", async () => {
    fetchPassageMock.mockResolvedValue({
      verses: [{ number: 1, text: "from html", heading: "Title" }],
    });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));
    await waitFor(() => {
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "from html", heading: "Title" }],
      });
    });

    expect(fetchPassageMock).toHaveBeenCalledWith({ query: "John 1" });
    expect(cache.get("John 1")).toEqual({
      verses: [{ number: 1, text: "from html", heading: "Title" }],
    });
    expect(logInteractionMock).toHaveBeenCalledWith(
      "reader",
      "esv-load",
      expect.objectContaining({
        query: "John 1",
        source: "html",
        cache: "miss",
        verseCount: 1,
        headingCount: 1,
        midHeadingCount: 0,
        textChars: 9,
      }),
    );
  });

  it("logs a cache hit with fetchMs 0", async () => {
    cache.set("John 1", {
      verses: [
        {
          number: 1,
          text: "cached",
          heading: "H",
          midHeadings: [{ text: "Mid", offset: 0 }],
        },
      ],
    });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));
    expect(result.current.data).not.toBeNull();
    expect(fetchPassageMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledWith("reader", "esv-load", {
        query: "John 1",
        source: "html",
        cache: "hit",
        fetchMs: 0,
        verseCount: 1,
        headingCount: 1,
        midHeadingCount: 1,
        textChars: 6,
      });
    });
  });

  it("clears loading when the effect finds a cache hit after render missed", async () => {
    const cachedData = { verses: [{ number: 1, text: "cached" }] };
    cache.set("John 1", cachedData);
    cacheReadGate.missCount = 1;

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(cachedData);
    });

    expect(fetchPassageMock).not.toHaveBeenCalled();
  });
});
