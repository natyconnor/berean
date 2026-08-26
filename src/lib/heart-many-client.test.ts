import { describe, expect, it, vi } from "vitest";

import {
  chunkHeartSpans,
  heartSpansInChunks,
  type HeartManyCall,
} from "./heart-many-client";
import { HEART_MANY_CHUNK, type VerseSpan } from "./hearted-verse-coverage";

function spans(count: number): VerseSpan[] {
  return Array.from({ length: count }, (_, index) => ({
    book: "Psalms",
    chapter: 119,
    startVerse: index + 1,
    endVerse: index + 1,
  }));
}

describe("chunkHeartSpans", () => {
  it("splits at HEART_MANY_CHUNK", () => {
    const chunks = chunkHeartSpans(spans(HEART_MANY_CHUNK + 3));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(HEART_MANY_CHUNK);
    expect(chunks[1]).toHaveLength(3);
  });

  it("narrows spans to the four fields the mutation validator accepts", () => {
    const chunks = chunkHeartSpans([
      {
        book: "Jude",
        chapter: 1,
        startVerse: 1,
        endVerse: 2,
        wordCount: 31,
        kind: "proposed",
      } as VerseSpan,
    ]);
    expect(chunks[0][0]).toEqual({
      book: "Jude",
      chapter: 1,
      startVerse: 1,
      endVerse: 2,
    });
  });
});

describe("heartSpansInChunks", () => {
  it("sums results across chunks", async () => {
    const heartMany = vi.fn<HeartManyCall>().mockResolvedValue({
      added: 2,
      skippedExact: 1,
      skippedOverlap: 0,
      skippedInvalid: 0,
    });

    const result = await heartSpansInChunks(heartMany, spans(45), 1000);

    expect(heartMany).toHaveBeenCalledTimes(2);
    const [first, second] = heartMany.mock.calls;
    expect(first[0].spans).toHaveLength(HEART_MANY_CHUNK);
    expect(second[0].spans).toHaveLength(5);
    expect(second[0].now).toBe(1000);
    expect(result).toEqual({
      added: 4,
      skippedExact: 2,
      skippedOverlap: 0,
      skippedInvalid: 0,
      failedChunks: 0,
    });
  });

  it("sums skippedInvalid apart from overlap", async () => {
    const heartMany = vi
      .fn<HeartManyCall>()
      .mockResolvedValueOnce({
        added: 1,
        skippedExact: 0,
        skippedOverlap: 0,
        skippedInvalid: 2,
      })
      .mockResolvedValueOnce({
        added: 0,
        skippedExact: 0,
        skippedOverlap: 1,
        skippedInvalid: 1,
      });

    const result = await heartSpansInChunks(heartMany, spans(45), 1000);

    expect(result).toEqual({
      added: 1,
      skippedExact: 0,
      skippedOverlap: 1,
      skippedInvalid: 3,
      failedChunks: 0,
    });
  });

  it("keeps going after a failed chunk and reports it", async () => {
    const heartMany = vi
      .fn<HeartManyCall>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        added: 3,
        skippedExact: 0,
        skippedOverlap: 1,
        skippedInvalid: 0,
      });

    const result = await heartSpansInChunks(heartMany, spans(45), 1000);

    expect(heartMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      added: 3,
      skippedExact: 0,
      skippedOverlap: 1,
      skippedInvalid: 0,
      failedChunks: 1,
    });
  });

  it("makes no call for an empty span list", async () => {
    const heartMany = vi.fn<HeartManyCall>();
    const result = await heartSpansInChunks(heartMany, [], 1000);
    expect(heartMany).not.toHaveBeenCalled();
    expect(result.added).toBe(0);
  });
});
