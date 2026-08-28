import { HEART_MANY_CHUNK, type VerseSpan } from "@/lib/hearted-verse-coverage";

export interface HeartManyResult {
  added: number;
  skippedExact: number;
  skippedOverlap: number;
  skippedInvalid: number;
}

/** The `api.savedVerses.heartMany` mutation, as `useMutation` returns it. */
export type HeartManyCall = (args: {
  spans: VerseSpan[];
  now: number;
}) => Promise<HeartManyResult>;

export interface HeartSpansResult extends HeartManyResult {
  /** Chunks whose mutation threw. Callers surface these without blocking. */
  failedChunks: number;
}

/**
 * Split spans into `heartMany`-sized batches, narrowed to exactly the four
 * span fields: callers pass richer objects (grouping metadata), and Convex
 * object validators reject extra fields.
 */
export function chunkHeartSpans(
  spans: readonly VerseSpan[],
  size: number = HEART_MANY_CHUNK,
): VerseSpan[][] {
  const chunks: VerseSpan[][] = [];
  for (let index = 0; index < spans.length; index += size) {
    chunks.push(
      spans.slice(index, index + size).map((span) => ({
        book: span.book,
        chapter: span.chapter,
        startVerse: span.startVerse,
        endVerse: span.endVerse,
      })),
    );
  }
  return chunks;
}

/**
 * Heart every span, one `heartMany` call per chunk. A failing chunk never
 * stops the rest: the caller has already created the pack and should still
 * land the user on it, with a non-blocking notice when `failedChunks > 0`.
 */
export async function heartSpansInChunks(
  heartMany: HeartManyCall,
  spans: readonly VerseSpan[],
  now: number,
): Promise<HeartSpansResult> {
  const totals: HeartSpansResult = {
    added: 0,
    skippedExact: 0,
    skippedOverlap: 0,
    skippedInvalid: 0,
    failedChunks: 0,
  };

  for (const chunk of chunkHeartSpans(spans)) {
    try {
      const result = await heartMany({ spans: chunk, now });
      totals.added += result.added;
      totals.skippedExact += result.skippedExact;
      totals.skippedOverlap += result.skippedOverlap;
      totals.skippedInvalid += result.skippedInvalid;
    } catch {
      totals.failedChunks += 1;
    }
  }

  return totals;
}
