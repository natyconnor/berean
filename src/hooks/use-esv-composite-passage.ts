import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../../convex/_generated/api";
import {
  getCachedPassage,
  setCachedPassage,
  type EsvChapterData,
} from "../../shared/esv-api";
import { toEsvQuery } from "../../shared/esv-query";
import type { CardReference } from "@/components/study/study-card-model";

/** One hearted span of the composite passage, with the text it covers. */
export interface CompositePassageSegment {
  reference: CardReference;
  /** The span's verse texts, joined by a single space. */
  text: string;
}

export interface CompositePassageState {
  /**
   * Every covered verse in reference order: spans joined by a single space,
   * with a newline where the chapter changes. Verse numbers are omitted — a
   * composite card is one recitation, not a numbered list.
   */
  text: string;
  /** Per-span text, so a reveal panel can show where each unit starts. */
  segments: CompositePassageSegment[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

interface LoadedChapters {
  /** The chapter set these results belong to; `null` before the first load. */
  key: string | null;
  byChapter: Map<string, EsvChapterData>;
  error: string | null;
}

const EMPTY_LOAD: LoadedChapters = {
  key: null,
  byChapter: new Map(),
  error: null,
};

const REFERENCE_SEPARATOR = "\u0000";

function chapterKey(book: string, chapter: number): string {
  return `${book}|${chapter}`;
}

function referencesKey(references: readonly CardReference[]): string {
  return references
    .map((r) => `${r.book}|${r.chapter}|${r.startVerse}|${r.endVerse}`)
    .join(REFERENCE_SEPARATOR);
}

function parseReferencesKey(key: string): CardReference[] {
  if (key === "") return [];
  return key.split(REFERENCE_SEPARATOR).map((entry) => {
    const [book, chapter, startVerse, endVerse] = entry.split("|");
    return {
      book,
      chapter: Number(chapter),
      startVerse: Number(startVerse),
      endVerse: Number(endVerse),
    };
  });
}

/** Unique `book|chapter` pairs, in first-reference order. */
function uniqueChapters(
  references: readonly CardReference[],
): Array<{ book: string; chapter: number }> {
  const seen = new Set<string>();
  const chapters: Array<{ book: string; chapter: number }> = [];
  for (const { book, chapter } of references) {
    const key = chapterKey(book, chapter);
    if (seen.has(key)) continue;
    seen.add(key);
    chapters.push({ book, chapter });
  }
  return chapters;
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

function spanText(data: EsvChapterData, reference: CardReference): string {
  return data.verses
    .filter(
      (verse) =>
        verse.number >= reference.startVerse &&
        verse.number <= reference.endVerse,
    )
    .map((verse) => verse.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

/**
 * The concatenated ESV text behind a composite recitation card.
 *
 * Chapter text is fetched one `getChaptersBatch` call per book and written
 * through the shared session cache, so a pack whose chapters are already warm
 * from the reader or a per-verse card resolves without a round trip. The
 * returned text follows `references` order (pack members arrive in Bible
 * order), which is also the order the learner recites.
 */
export function useEsvCompositePassage(
  references: readonly CardReference[],
  options?: { enabled?: boolean },
): CompositePassageState {
  const fetchChaptersBatch = useAction(api.esv.getChaptersBatch);

  // Keyed by value, not identity: callers build the member list from a live
  // query (or inline), and a fresh array each render would restart the fetch
  // effect forever. Round-tripping through the key makes every derived list
  // stable as long as the references themselves are.
  const referenceKeys = useMemo(() => referencesKey(references), [references]);
  const spans = useMemo(
    () => parseReferencesKey(referenceKeys),
    [referenceKeys],
  );
  const chapters = useMemo(() => uniqueChapters(spans), [spans]);
  const chaptersKey = useMemo(
    () => chapters.map(({ book, chapter }) => chapterKey(book, chapter)).join(),
    [chapters],
  );
  const active = (options?.enabled ?? true) && chapters.length > 0;

  const [loaded, setLoaded] = useState<LoadedChapters>(EMPTY_LOAD);
  const requestRef = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    requestRef.current += 1;
    setLoaded(EMPTY_LOAD);
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  useEffect(() => {
    const requestVersion = ++requestRef.current;
    if (!active) return;

    const load = async () => {
      const byChapter = new Map<string, EsvChapterData>();
      try {
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
          if (requestVersion !== requestRef.current) return;
          for (const result of results) {
            setCachedPassage(toEsvQuery(book, result.chapter), result.data);
            byChapter.set(chapterKey(book, result.chapter), result.data);
          }
        }

        if (requestVersion !== requestRef.current) return;
        setLoaded({ key: chaptersKey, byChapter, error: null });
      } catch (error) {
        if (requestVersion !== requestRef.current) return;
        setLoaded({
          key: chaptersKey,
          byChapter: new Map(),
          error:
            error instanceof Error
              ? error.message
              : "Failed to load passage text",
        });
      }
    };

    void load();
  }, [active, chapters, chaptersKey, fetchChaptersBatch, retryNonce]);

  const settled = loaded.key === chaptersKey;
  const composed = (() => {
    if (!active || !settled || loaded.error !== null) {
      return {
        text: "",
        segments: [] as CompositePassageSegment[],
        missing: false,
      };
    }

    const segments: CompositePassageSegment[] = [];
    let text = "";
    let previousChapter: string | null = null;

    for (const reference of spans) {
      const key = chapterKey(reference.book, reference.chapter);
      const data = loaded.byChapter.get(key);
      if (!data) {
        return {
          text: "",
          segments: [] as CompositePassageSegment[],
          missing: true,
        };
      }
      const segment = spanText(data, reference);
      if (segment.length === 0) {
        return {
          text: "",
          segments: [] as CompositePassageSegment[],
          missing: true,
        };
      }

      if (text.length > 0) {
        text +=
          previousChapter !== null && previousChapter !== key ? "\n" : " ";
      }
      text += segment;
      previousChapter = key;
      segments.push({ reference, text: segment });
    }

    return { text, segments, missing: false };
  })();

  const composeError = composed.missing
    ? "Could not load the full passage"
    : null;
  const error = active && settled ? (loaded.error ?? composeError) : null;
  const loading = active && error === null && !settled;

  return {
    text: composed.text,
    segments: composed.segments,
    loading,
    error,
    retry,
  };
}
