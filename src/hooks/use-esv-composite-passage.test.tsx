import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CardReference } from "@/components/study/study-card-model";
import type { EsvChapterData } from "../../shared/esv-api";
import { useEsvCompositePassage } from "./use-esv-composite-passage";

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

const psalm23 = chapter([
  [1, "The Lord is my shepherd; I shall not want."],
  [2, "He makes me lie down in green pastures."],
  [3, "He restores my soul."],
]);
const psalm24 = chapter([[1, "The earth is the Lord's."]]);

function span(
  chapterNumber: number,
  startVerse: number,
  endVerse: number,
): CardReference {
  return {
    book: "Psalms",
    chapter: chapterNumber,
    startVerse,
    endVerse,
  };
}

describe("useEsvCompositePassage", () => {
  beforeEach(() => {
    cache.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([
      { chapter: 23, data: psalm23 },
      { chapter: 24, data: psalm24 },
    ]);
  });

  it("concatenates covered verses in order: spaces within a chapter, a newline between chapters", async () => {
    const references = [span(23, 1, 2), span(23, 3, 3), span(24, 1, 1)];

    const { result } = renderHook(() => useEsvCompositePassage(references));

    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // One batch for the book, and only the chapters the spans cover.
    expect(fetchChaptersBatchMock).toHaveBeenCalledTimes(1);
    expect(fetchChaptersBatchMock).toHaveBeenCalledWith({
      book: "Psalms",
      chapters: [23, 24],
    });

    expect(result.current.error).toBeNull();
    expect(result.current.text).toBe(
      "The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He restores my soul.\nThe earth is the Lord's.",
    );
    expect(result.current.segments.map((segment) => segment.text)).toEqual([
      "The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.",
      "He restores my soul.",
      "The earth is the Lord's.",
    ]);
  });

  it("reuses session-cached chapters instead of fetching them", async () => {
    cache.set("Psalms 23", psalm23);

    const { result } = renderHook(() =>
      useEsvCompositePassage([span(23, 3, 3)]),
    );

    await waitFor(() => {
      expect(result.current.text).toBe("He restores my soul.");
    });
    expect(fetchChaptersBatchMock).not.toHaveBeenCalled();
  });

  it("stays idle for an empty member list", () => {
    const { result } = renderHook(() => useEsvCompositePassage([]));

    expect(result.current.loading).toBe(false);
    expect(result.current.text).toBe("");
    expect(fetchChaptersBatchMock).not.toHaveBeenCalled();
  });

  it("surfaces a fetch failure", async () => {
    fetchChaptersBatchMock.mockRejectedValue(new Error("ESV is down"));

    const { result } = renderHook(() =>
      useEsvCompositePassage([span(23, 1, 1)]),
    );

    await waitFor(() => {
      expect(result.current.error).toBe("ESV is down");
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.text).toBe("");
  });
});
