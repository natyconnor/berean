import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveMemorizeTarget } from "@/lib/memorize-target";
import type { EsvChapterData } from "../../shared/esv-api";

import { memorizeStartHref, useMemorizeStart } from "./use-memorize-start";

const { mutationMocks, fetchChaptersBatchMock, convexQueryMock } = vi.hoisted(
  () => ({
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    fetchChaptersBatchMock: vi.fn(),
    convexQueryMock: vi.fn(),
  }),
);

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: () => fetchChaptersBatchMock,
  useConvex: () => ({ query: convexQueryMock }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch" },
    packs: {
      create: "packs.create",
      createAndMemorize: "packs.createAndMemorize",
      startPreset: "packs.startPreset",
    },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      start: "passageMemory.start",
    },
    verseMemory: {
      memorize: "verseMemory.memorize",
      memorizeStatus: "verseMemory.memorizeStatus",
    },
  },
}));

function psalmChapter(verseCount: number): EsvChapterData {
  return {
    canonical: "Psalm 1",
    copyright: "ESV",
    verses: Array.from({ length: verseCount }, (_, index) => ({
      number: index + 1,
      text: `Verse ${index + 1} of the psalm.`,
    })),
  };
}

beforeEach(() => {
  mutationMocks.clear();
  fetchChaptersBatchMock.mockReset();
  convexQueryMock.mockReset();
  sessionStorage.clear();
});

describe("useMemorizeStart", () => {
  it("memorizes a verse on its own", async () => {
    mutationMock("verseMemory.memorize").mockResolvedValue({
      added: 1,
      alreadyMemorizing: 0,
      verseRefIds: ["ref1"],
    });
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
    });

    let outcome: Awaited<ReturnType<typeof result.current.start>> | undefined;
    await act(async () => {
      outcome = await result.current.start(resolved);
    });

    expect(mutationMock("verseMemory.memorize")).toHaveBeenCalledWith({
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
      now: expect.any(Number) as number,
    });
    expect(outcome).toEqual({
      mode: "verse",
      destination: {
        kind: "verse",
        verseRefId: "ref1",
        span: { book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 },
      },
      alreadyMemorizing: false,
    });
  });

  it("reports a verse that was already being memorized", async () => {
    mutationMock("verseMemory.memorize").mockResolvedValue({
      added: 0,
      alreadyMemorizing: 1,
      verseRefIds: ["ref1"],
    });
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }],
    });

    await act(async () => {
      await expect(result.current.start(resolved)).resolves.toMatchObject({
        alreadyMemorizing: true,
      });
    });
  });

  it("creates a pack named by the user, or by its title", async () => {
    mutationMock("packs.createAndMemorize").mockResolvedValue({
      packId: "pack1",
    });
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [{ book: "Philippians", chapter: 2, startVerse: 1, endVerse: 4 }],
    });

    await act(async () => {
      await expect(
        result.current.start(resolved, { name: "  Team verses  " }),
      ).resolves.toEqual({
        mode: "pack",
        destination: { kind: "pack", packId: "pack1" },
        alreadyMemorizing: false,
      });
    });
    expect(mutationMock("packs.createAndMemorize")).toHaveBeenLastCalledWith({
      name: "Team verses",
      spans: [1, 2, 3, 4].map((verse) => ({
        book: "Philippians",
        chapter: 2,
        startVerse: verse,
        endVerse: verse,
      })),
      now: expect.any(Number) as number,
    });

    await act(async () => {
      await result.current.start(resolved, { name: "   " });
    });
    expect(mutationMock("packs.createAndMemorize")).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Philippians 2:1\u20134" }),
    );
  });

  it("starts a preset passage from ESV pieces", async () => {
    mutationMock("packs.startPreset").mockResolvedValue({
      packId: "pack23",
      created: true,
    });
    convexQueryMock.mockResolvedValue(null);
    fetchChaptersBatchMock.mockResolvedValue([
      { chapter: 23, data: psalmChapter(6) },
    ]);
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "chapters",
      book: "Psalms",
      startChapter: 23,
      endChapter: 23,
      presetId: "psalm-23",
    });

    await act(async () => {
      await expect(result.current.start(resolved)).resolves.toEqual({
        mode: "passage",
        destination: { kind: "pack", packId: "pack23" },
        alreadyMemorizing: false,
      });
    });

    expect(mutationMock("packs.startPreset")).toHaveBeenCalledWith({
      presetId: "psalm-23",
    });
    expect(mutationMock("packs.create")).not.toHaveBeenCalled();
    expect(convexQueryMock).toHaveBeenCalledWith(
      "passageMemory.getForPack",
      expect.objectContaining({ packId: "pack23" }),
    );
    expect(fetchChaptersBatchMock).toHaveBeenCalledWith({
      book: "Psalms",
      chapters: [23],
    });
    const [startArgs] = mutationMock("passageMemory.start").mock.calls[0] as [
      { packId: string; pieces: unknown[] },
    ];
    expect(startArgs.packId).toBe("pack23");
    expect(startArgs.pieces.length).toBeGreaterThan(0);
  });

  it("reuses a scope pack whose passage already started", async () => {
    mutationMock("packs.create").mockResolvedValue("pack5");
    convexQueryMock.mockResolvedValue({ _id: "passage5" });
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "chapters",
      book: "Matthew",
      startChapter: 5,
      endChapter: 7,
    });

    await act(async () => {
      await expect(result.current.start(resolved)).resolves.toEqual({
        mode: "passage",
        destination: { kind: "pack", packId: "pack5" },
        alreadyMemorizing: true,
      });
    });

    expect(mutationMock("packs.create")).toHaveBeenCalledWith({
      name: "Matthew 5\u20137",
      kind: "scope",
      scope: {
        books: ["Matthew"],
        chapterRanges: [{ book: "Matthew", startChapter: 5, endChapter: 7 }],
        tags: [],
        tagMatchMode: "any",
      },
    });
    expect(fetchChaptersBatchMock).not.toHaveBeenCalled();
    expect(mutationMock("passageMemory.start")).not.toHaveBeenCalled();
  });

  it("rejects invalid targets and server errors", async () => {
    mutationMock("verseMemory.memorize").mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useMemorizeStart());

    await act(async () => {
      await expect(
        result.current.start(
          resolveMemorizeTarget({
            kind: "chapters",
            book: "Romans",
            startChapter: 1,
            endChapter: 21,
          }),
        ),
      ).rejects.toThrow("Pick up to 20 chapters");
    });

    await act(async () => {
      await expect(
        result.current.start(
          resolveMemorizeTarget({
            kind: "spans",
            spans: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16 }],
          }),
        ),
      ).rejects.toThrow("down");
    });
    expect(result.current.pending).toBe(false);
  });

  it("starts once when called twice in a row", async () => {
    mutationMock("verseMemory.memorize").mockResolvedValue({
      added: 1,
      alreadyMemorizing: 0,
      verseRefIds: ["ref1"],
    });
    const { result } = renderHook(() => useMemorizeStart());
    const resolved = resolveMemorizeTarget({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
    });

    await act(async () => {
      await Promise.all([
        result.current.start(resolved),
        result.current.start(resolved),
      ]);
    });

    expect(mutationMock("verseMemory.memorize")).toHaveBeenCalledTimes(1);
  });
});

describe("memorizeStartHref", () => {
  it("links a verse to its learn session", () => {
    expect(
      memorizeStartHref(
        {
          kind: "verse",
          verseRefId: "ref1" as never,
          span: { book: "1 Samuel", chapter: 12, startVerse: 23, endVerse: 24 },
        },
        "/passage/1-samuel/12?x=1",
      ),
    ).toBe(
      "/memory/learn?book=1+Samuel&chapter=12&startVerse=23&endVerse=24&return=%2Fpassage%2F1-samuel%2F12%3Fx%3D1",
    );
  });

  it("links a pack or passage to its learn session", () => {
    expect(
      memorizeStartHref({ kind: "pack", packId: "pack1" as never }, "/memory"),
    ).toBe("/memory/pack1/learn?return=%2Fmemory");
    expect(
      memorizeStartHref({ kind: "pack", packId: "pack1" as never }, ""),
    ).toBe("/memory/pack1/learn");
  });
});
