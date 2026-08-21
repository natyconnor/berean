import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EsvChapterData } from "../../shared/esv-api";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import type { VerseScope } from "@/lib/verse-scope-match";
import { useScopeHeartPreview } from "./use-scope-heart-preview";

const { fetchChaptersBatchMock, cache } = vi.hoisted(() => ({
  fetchChaptersBatchMock: vi.fn(),
  cache: new Map<string, unknown>(),
}));

vi.mock("convex/react", () => ({
  useAction: () => fetchChaptersBatchMock,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { esv: { getChaptersBatch: "getChaptersBatch" } },
}));

vi.mock("../../shared/esv-api", () => ({
  getCachedPassage: (query: string) => cache.get(query) ?? null,
  setCachedPassage: (query: string, data: unknown) => {
    cache.set(query, data);
  },
}));

function chapter(verses: Array<[number, string]>): EsvChapterData {
  return {
    canonical: "test",
    copyright: "test",
    verses: verses.map(([number, text]) => ({ number, text })),
  };
}

const john3 = chapter([
  [1, "Now there was a man of the Pharisees named Nicodemus."],
  [2, "This man came to Jesus by night and said to him, Rabbi."],
  [3, "Jesus answered him, Truly, truly, I say to you."],
  [4, "Nicodemus said to him, How can a man be born when he is old?"],
]);
const john4 = chapter([
  [1, "Now Jesus learned that the Pharisees had heard."],
  [2, "although Jesus himself did not baptize, but only his disciples."],
]);

const johnScope: VerseScope = {
  books: ["John"],
  chapterRanges: [{ book: "John", startChapter: 3, endChapter: 4 }],
};

describe("useScopeHeartPreview", () => {
  beforeEach(() => {
    cache.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([
      { chapter: 3, data: john3 },
      { chapter: 4, data: john4 },
    ]);
  });

  it("fetches one batch per book, caches chapters, and keeps existing hearts", async () => {
    const hearts: VerseSpan[] = [
      { book: "John", chapter: 3, startVerse: 2, endVerse: 3 },
    ];

    const { result } = renderHook(() =>
      useScopeHeartPreview({ scope: johnScope, hearts, enabled: true }),
    );

    expect(result.current.allowed).toBe(true);
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchChaptersBatchMock).toHaveBeenCalledTimes(1);
    expect(fetchChaptersBatchMock).toHaveBeenCalledWith({
      book: "John",
      chapters: [3, 4],
    });
    expect(cache.get("John 3")).toEqual(john3);
    expect(cache.get("John 4")).toEqual(john4);

    expect(result.current.chapters.map((entry) => entry.label)).toEqual([
      "John 3",
      "John 4",
    ]);
    expect(result.current.verseCount).toBe(6);
    expect(result.current.keptCount).toBe(1);

    const chapterThree = result.current.chapters[0];
    expect(
      chapterThree.groups.find((group) => group.kind === "kept"),
    ).toMatchObject({ startVerse: 2, endVerse: 3 });

    // Proposed spans are the gaps only: never the kept 3:2-3.
    expect(result.current.proposedSpans).toEqual(
      expect.arrayContaining([
        { book: "John", chapter: 3, startVerse: 1, endVerse: 1 },
        { book: "John", chapter: 3, startVerse: 4, endVerse: 4 },
      ]),
    );
    expect(
      result.current.proposedSpans.some(
        (span) =>
          span.chapter === 3 && span.startVerse <= 3 && span.endVerse >= 2,
      ),
    ).toBe(false);
    expect(result.current.proposedCount).toBe(
      result.current.proposedSpans.length,
    );
  });

  it("reads the session cache instead of refetching", async () => {
    cache.set("John 3", john3);
    cache.set("John 4", john4);

    const { result } = renderHook(() =>
      useScopeHeartPreview({ scope: johnScope, hearts: [], enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchChaptersBatchMock).not.toHaveBeenCalled();
    expect(result.current.verseCount).toBe(6);
  });

  it("does not fetch while the control is off, or over the chapter cap", async () => {
    const off = renderHook(() =>
      useScopeHeartPreview({ scope: johnScope, hearts: [], enabled: false }),
    );
    expect(off.result.current.loading).toBe(false);
    expect(off.result.current.allowed).toBe(true);

    const overCap = renderHook(() =>
      useScopeHeartPreview({
        scope: { books: ["Psalms"] },
        hearts: [],
        enabled: true,
      }),
    );
    expect(overCap.result.current.allowed).toBe(false);
    expect(overCap.result.current.chapterCount).toBe(150);
    expect(overCap.result.current.loading).toBe(false);

    const empty = renderHook(() =>
      useScopeHeartPreview({ scope: { books: [] }, hearts: [], enabled: true }),
    );
    expect(empty.result.current.allowed).toBe(false);
    expect(empty.result.current.chapterCount).toBe(Infinity);

    await Promise.resolve();
    expect(fetchChaptersBatchMock).not.toHaveBeenCalled();
  });

  it("stays loading until the heart list arrives", async () => {
    const { result, rerender } = renderHook(
      ({ hearts }: { hearts: VerseSpan[] | null }) =>
        useScopeHeartPreview({ scope: johnScope, hearts, enabled: true }),
      { initialProps: { hearts: null as VerseSpan[] | null } },
    );

    await waitFor(() => {
      expect(fetchChaptersBatchMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.chapters).toHaveLength(0);

    rerender({ hearts: [] });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.chapters).toHaveLength(2);
  });

  it("surfaces a load failure and refetches on retry", async () => {
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock
      .mockRejectedValueOnce(new Error("ESV API error: 500"))
      .mockResolvedValueOnce([
        { chapter: 3, data: john3 },
        { chapter: 4, data: john4 },
      ]);

    const { result } = renderHook(() =>
      useScopeHeartPreview({ scope: johnScope, hearts: [], enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe("ESV API error: 500");
    });
    expect(result.current.proposedSpans).toHaveLength(0);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.chapters).toHaveLength(2);
    });
  });
});
