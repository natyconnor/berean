import { useAction, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useCallback, useRef, useState } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  getCachedPassage,
  setCachedPassage,
  type EsvChapterData,
} from "../../shared/esv-api";
import { toEsvQuery } from "../../shared/esv-query";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import {
  piecesAllowPassageMode,
  rangeAllowsPassageMode,
} from "@/lib/passage-eligibility";
import {
  buildPassagePieces,
  type PassageChapterInput,
  type PassagePieceBase,
} from "@/lib/passage-pieces";
import type { PassageRange } from "@/lib/passage-range";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import { enumerateScopeChapters } from "@/lib/scope-chapter-count";
import type { VerseScope } from "@/lib/verse-scope-match";

function chapterKey(book: string, chapter: number): string {
  return `${book}|${chapter}`;
}

function chaptersByBook(
  chapters: readonly { book: string; chapter: number }[],
): Map<string, number[]> {
  const byBook = new Map<string, number[]>();
  for (const { book, chapter } of chapters) {
    const existing = byBook.get(book);
    if (existing) {
      existing.push(chapter);
    } else {
      byBook.set(book, [chapter]);
    }
  }
  return byBook;
}

type ScopeChapterText = {
  book: string;
  chapter: number;
  verses: EsvChapterData["verses"];
};

type FetchChaptersBatch = (args: {
  book: string;
  chapters: number[];
}) => Promise<Array<{ chapter: number; data: EsvChapterData }>>;

/** ESV text for every chapter of the scope, from the passage cache when warm. */
export async function loadChaptersForScope(
  fetchChaptersBatch: FetchChaptersBatch,
  scope: VerseScope,
): Promise<ScopeChapterText[]> {
  const chapters = enumerateScopeChapters(scope);
  const byChapter = new Map<string, EsvChapterData>();

  for (const [book, bookChapters] of chaptersByBook(chapters)) {
    const missing: number[] = [];
    for (const chapter of bookChapters) {
      const cached = getCachedPassage(toEsvQuery(book, chapter));
      if (cached) {
        byChapter.set(chapterKey(book, chapter), cached);
      } else {
        missing.push(chapter);
      }
    }
    if (missing.length === 0) continue;

    const results = await fetchChaptersBatch({ book, chapters: missing });
    for (const result of results) {
      setCachedPassage(toEsvQuery(book, result.chapter), result.data);
      byChapter.set(chapterKey(book, result.chapter), result.data);
    }
  }

  return chapters.map(({ book, chapter }) => {
    const data = byChapter.get(chapterKey(book, chapter));
    if (!data) {
      throw new Error("Could not load every chapter for this passage");
    }
    return { book, chapter, verses: data.verses };
  });
}

export type PassagePiecesPlan =
  | {
      kind: "passage";
      pieces: PassagePieceBase[];
      /** The range narrowed to the first and last verse the text has. */
      range: PassageRange | null;
    }
  | { kind: "oneCard"; span: VerseSpan };

/**
 * Freeze a passage's pieces from its chapter text, trimmed to `range` when
 * set. Text that groups into a single learning piece is memorized as one
 * verse card instead (`piecesAllowPassageMode`). The ESV omits a few verses
 * (Matthew 17:21), so a range is narrowed to the verses the text has, and a
 * range that narrows below a passage is one card too.
 */
export function planPassagePieces(
  chapters: readonly PassageChapterInput[],
  range: PassageRange | null,
): PassagePiecesPlan {
  const pieces = buildPassagePieces(chapters, range);
  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  if (!first || !last) {
    throw new Error("Could not load the verses for this passage");
  }
  const narrowed = range && {
    book: range.book,
    startChapter: first.chapter,
    startVerse: first.startVerse,
    endChapter: last.chapter,
    endVerse: last.endVerse,
  };
  if (
    first.chapter === last.chapter &&
    (!piecesAllowPassageMode(pieces.length) ||
      (narrowed !== null && !rangeAllowsPassageMode(narrowed)))
  ) {
    return {
      kind: "oneCard",
      span: {
        book: first.book,
        chapter: first.chapter,
        startVerse: first.startVerse,
        endVerse: last.endVerse,
      },
    };
  }
  return { kind: "passage", pieces, range: narrowed };
}

export type StartPassageDeps = {
  fetchChaptersBatch: FetchChaptersBatch;
  startPassage: (
    args: FunctionArgs<typeof api.passageMemory.start>,
  ) => Promise<FunctionReturnType<typeof api.passageMemory.start>>;
};

/**
 * Start passage mode for a scope pack: load its chapter text, freeze the
 * pieces (trimmed to the pack's `range`), and call `passageMemory.start`,
 * which writes the passage heart. Returns the passage (the existing one when
 * it had already started).
 */
export async function startPassageForPack(
  deps: StartPassageDeps,
  {
    packId,
    scope,
    range,
    now,
  }: {
    packId: Id<"packs">;
    scope: VerseScope;
    range: PassageRange | null;
    now: number;
  },
): Promise<FunctionReturnType<typeof api.passageMemory.start>> {
  const chapters = await loadChaptersForScope(deps.fetchChaptersBatch, scope);
  return await deps.startPassage({
    packId,
    pieces: buildPassagePieces(chapters, range),
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
    timeZone: getViewerTimeZone(),
  });
}

/**
 * Opt-in start for passage mode (see {@link startPassageForPack}).
 *
 * Call `start` only from an explicit click, not merely because the pack
 * opened.
 */
export function useStartPassage({
  packId,
  scope,
  range,
  now,
}: {
  packId: Id<"packs">;
  scope: VerseScope | undefined;
  range: PassageRange | null;
  now: number;
}): {
  start: () => Promise<void>;
  pending: boolean;
  error: string | null;
} {
  const fetchChaptersBatch = useAction(api.esv.getChaptersBatch);
  const startPassage = useMutation(api.passageMemory.start);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const start = useCallback(async () => {
    if (inFlight.current || scope === undefined) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await startPassageForPack(
        { fetchChaptersBatch, startPassage },
        { packId, scope, range, now },
      );
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.length > 0
          ? caught.message
          : "Couldn't start passage learning. Please try again.",
      );
      throw caught;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [fetchChaptersBatch, now, packId, range, scope, startPassage]);

  return { start, pending, error };
}
