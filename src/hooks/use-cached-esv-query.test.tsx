import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCachedEsvQuery } from "./use-cached-esv-query";

const {
  fetchPassageTextMock,
  fetchPassageHtmlMock,
  logInteractionMock,
  resolveEsvSourceMock,
  cache,
  cacheReadGate,
} = vi.hoisted(() => ({
  fetchPassageTextMock: vi.fn(),
  fetchPassageHtmlMock: vi.fn(),
  logInteractionMock: vi.fn(),
  resolveEsvSourceMock: vi.fn((): "text" | "html" => "text"),
  cache: new Map<string, unknown>(),
  /** Force the next N getCachedPassage reads to miss (simulates render-phase miss). */
  cacheReadGate: { missCount: 0 },
}));

vi.mock("convex/react", () => ({
  useAction: (action: unknown) => {
    if (action === "getPassageHtml") return fetchPassageHtmlMock;
    return fetchPassageTextMock;
  },
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    esv: {
      getPassageText: "getPassageText",
      getPassageHtml: "getPassageHtml",
    },
  },
}));

vi.mock("../../shared/esv-api", () => ({
  getCachedPassage: (query: string, source?: string) => {
    if (cacheReadGate.missCount > 0) {
      cacheReadGate.missCount -= 1;
      return null;
    }
    return cache.get(`${source ?? "text"}:${query}`) ?? null;
  },
  setCachedPassage: (query: string, data: unknown, source?: string) => {
    cache.set(`${source ?? "text"}:${query}`, data);
  },
  parseEsvResponse: (raw: unknown) => raw,
}));

vi.mock("@/lib/dev-log", () => ({
  logInteraction: logInteractionMock,
}));

vi.mock("@/lib/esv-source", () => ({
  resolveEsvSource: resolveEsvSourceMock,
}));

describe("useCachedEsvQuery", () => {
  beforeEach(() => {
    cache.clear();
    cacheReadGate.missCount = 0;
    fetchPassageTextMock.mockReset();
    fetchPassageHtmlMock.mockReset();
    logInteractionMock.mockReset();
    resolveEsvSourceMock.mockReset();
    resolveEsvSourceMock.mockReturnValue("text");
  });

  it("keeps cached data visible when a stale request resolves later", async () => {
    cache.set("text:John 2", { verses: [{ number: 2, text: "Cached verse" }] });

    let resolveFirstRequest: ((value: unknown) => void) | null = null;
    fetchPassageTextMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirstRequest = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ query }) => useCachedEsvQuery(query),
      {
        initialProps: { query: "John 1" },
      },
    );

    expect(result.current.loading).toBe(true);
    expect(fetchPassageTextMock).toHaveBeenCalledWith({ query: "John 1" });

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
    expect(cache.get("text:John 1")).toBeUndefined();
  });

  it("retry refetches after a failed passage load", async () => {
    fetchPassageTextMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ verses: [{ number: 1, text: "ok" }] });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));

    await waitFor(() => {
      expect(result.current.error).toBe("network");
    });

    expect(fetchPassageTextMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "ok" }],
      });
    });

    expect(fetchPassageTextMock).toHaveBeenCalledTimes(2);
    expect(fetchPassageTextMock).toHaveBeenLastCalledWith({ query: "John 1" });
  });

  it("does not fetch when enabled is false", () => {
    const { result } = renderHook(() =>
      useCachedEsvQuery("John 1", { enabled: false }),
    );

    expect(fetchPassageTextMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("fetches once enabled becomes true", async () => {
    fetchPassageTextMock.mockResolvedValue({
      verses: [{ number: 1, text: "ok" }],
    });

    const { result, rerender } = renderHook(
      ({ enabled }) => useCachedEsvQuery("John 1", { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(fetchPassageTextMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "ok" }],
      });
    });

    expect(fetchPassageTextMock).toHaveBeenCalledTimes(1);
  });

  it("calls getPassageHtml when source is html", async () => {
    resolveEsvSourceMock.mockReturnValue("html");
    fetchPassageHtmlMock.mockResolvedValue({
      verses: [{ number: 1, text: "from html", heading: "Title" }],
    });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));

    await waitFor(() => {
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "from html", heading: "Title" }],
      });
    });

    expect(fetchPassageHtmlMock).toHaveBeenCalledWith({ query: "John 1" });
    expect(fetchPassageTextMock).not.toHaveBeenCalled();
    expect(cache.get("html:John 1")).toEqual({
      verses: [{ number: 1, text: "from html", heading: "Title" }],
    });
    expect(cache.get("text:John 1")).toBeUndefined();
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
    const missDetails = logInteractionMock.mock.calls.find(
      (call) => call[1] === "esv-load",
    )?.[2] as { fetchMs: unknown } | undefined;
    expect(typeof missDetails?.fetchMs).toBe("number");
  });

  it("keeps text and html caches separate for the same query", async () => {
    cache.set("text:John 1", {
      verses: [{ number: 1, text: "from text" }],
    });
    resolveEsvSourceMock.mockReturnValue("html");
    fetchPassageHtmlMock.mockResolvedValue({
      verses: [{ number: 1, text: "from html" }],
    });

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));

    await waitFor(() => {
      expect(result.current.data).toEqual({
        verses: [{ number: 1, text: "from html" }],
      });
    });

    expect(fetchPassageHtmlMock).toHaveBeenCalledTimes(1);
    expect(cache.get("text:John 1")).toEqual({
      verses: [{ number: 1, text: "from text" }],
    });
    expect(cache.get("html:John 1")).toEqual({
      verses: [{ number: 1, text: "from html" }],
    });
  });

  it("logs a cache hit with fetchMs 0", async () => {
    cache.set("text:John 1", {
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

    expect(result.current.data).toEqual({
      verses: [
        {
          number: 1,
          text: "cached",
          heading: "H",
          midHeadings: [{ text: "Mid", offset: 0 }],
        },
      ],
    });
    expect(fetchPassageTextMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(logInteractionMock).toHaveBeenCalledWith("reader", "esv-load", {
        query: "John 1",
        source: "text",
        cache: "hit",
        fetchMs: 0,
        verseCount: 1,
        headingCount: 1,
        midHeadingCount: 1,
        textChars: 6,
      });
    });
  });

  it("clears loading when effect finds a cache hit after a render-phase miss", async () => {
    const cachedData = { verses: [{ number: 1, text: "cached" }] };
    cache.set("text:John 1", cachedData);
    // First getCachedPassage is the render-phase read; effect should still hit
    // and sync async state so loading clears without a network fetch.
    cacheReadGate.missCount = 1;

    const { result } = renderHook(() => useCachedEsvQuery("John 1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(cachedData);
    });

    expect(fetchPassageTextMock).not.toHaveBeenCalled();
    expect(logInteractionMock).toHaveBeenCalledWith("reader", "esv-load", {
      query: "John 1",
      source: "text",
      cache: "hit",
      fetchMs: 0,
      verseCount: 1,
      headingCount: 0,
      midHeadingCount: 0,
      textChars: 6,
    });
  });
});
