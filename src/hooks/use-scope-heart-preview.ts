import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../../convex/_generated/api";
import {
  getCachedPassage,
  setCachedPassage,
  type EsvChapterData,
} from "../../shared/esv-api";
import { isSingleChapterBook, toEsvQuery } from "../../shared/esv-query";
import { displayBookName } from "@/lib/bible-books";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import {
  groupChapterForHearting,
  type ProposedHeartGroup,
} from "@/lib/memory-span-group";
import {
  autoHeartAllowed,
  countScopeChapters,
  enumerateScopeChapters,
  type ScopeChapter,
} from "@/lib/scope-chapter-count";
import { formatBookChapter } from "@/lib/verse-ref-utils";
import type { VerseScope } from "@/lib/verse-scope-match";

export interface ScopeHeartChapterPreview {
  book: string;
  chapter: number;
  /** "Psalm 23", or just "Jude" for a single-chapter book. */
  label: string;
  verseCount: number;
  /** Kept hearts and proposed gaps, in verse order. */
  groups: ProposedHeartGroup[];
}

export interface ScopeHeartPreviewState {
  /** The scope is non-empty and within the auto-heart chapter cap. */
  allowed: boolean;
  /** `Infinity` for the whole-corpus scope; drives the disabled explanation. */
  chapterCount: number;
  loading: boolean;
  error: string | null;
  chapters: ScopeHeartChapterPreview[];
  verseCount: number;
  proposedCount: number;
  keptCount: number;
  /** Exactly the spans to send to `heartMany`; kept hearts are excluded. */
  proposedSpans: VerseSpan[];
  retry: () => void;
}

export interface UseScopeHeartPreviewOptions {
  scope: VerseScope;
  /** The user's current hearts, or `null` while they are still loading. */
  hearts: readonly VerseSpan[] | null;
  /** Fetch only while the user has the auto-heart control switched on. */
  enabled: boolean;
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

function chapterKey(book: string, chapter: number): string {
  return `${book}|${chapter}`;
}

function chapterLabel(book: string, chapter: number): string {
  return isSingleChapterBook(book)
    ? displayBookName(book)
    : formatBookChapter(book, chapter);
}

function chaptersByBook(
  chapters: readonly ScopeChapter[],
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

/**
 * The auto-heart proposal for a scope pack: which verses would become memory
 * units, and which existing hearts are kept as-is.
 *
 * Chapter text is fetched one `getChaptersBatch` call per book (the cap keeps
 * the total at 20 chapters) and written through the shared session cache, so
 * opening the same chapter in the reader or practice is already warm. Grouping
 * is derived from the fetched text and the live heart list, so re-hearting
 * elsewhere updates the preview without refetching.
 */
export function useScopeHeartPreview({
  scope,
  hearts,
  enabled,
}: UseScopeHeartPreviewOptions): ScopeHeartPreviewState {
  const fetchChaptersBatch = useAction(api.esv.getChaptersBatch);

  const chapters = useMemo(() => enumerateScopeChapters(scope), [scope]);
  const chapterCount = countScopeChapters(scope);
  const allowed = autoHeartAllowed(scope);
  const active = enabled && allowed;
  const chaptersKey = useMemo(
    () => chapters.map(({ book, chapter }) => chapterKey(book, chapter)).join(),
    [chapters],
  );

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
  const error = active && settled ? loaded.error : null;
  const loading = active && error === null && (!settled || hearts === null);

  const chapterPreviews = useMemo<ScopeHeartChapterPreview[]>(() => {
    if (!active || !settled || loaded.error !== null || hearts === null) {
      return [];
    }
    const previews: ScopeHeartChapterPreview[] = [];
    for (const { book, chapter } of chapters) {
      const data = loaded.byChapter.get(chapterKey(book, chapter));
      if (!data) continue;
      previews.push({
        book,
        chapter,
        label: chapterLabel(book, chapter),
        verseCount: data.verses.length,
        groups: groupChapterForHearting(book, chapter, data.verses, hearts),
      });
    }
    return previews;
  }, [active, settled, loaded, hearts, chapters]);

  const summary = useMemo(() => {
    let verseCount = 0;
    let proposedCount = 0;
    let keptCount = 0;
    const proposedSpans: VerseSpan[] = [];

    for (const preview of chapterPreviews) {
      verseCount += preview.verseCount;
      for (const group of preview.groups) {
        if (group.kind === "kept") {
          keptCount += 1;
          continue;
        }
        proposedCount += 1;
        proposedSpans.push({
          book: group.book,
          chapter: group.chapter,
          startVerse: group.startVerse,
          endVerse: group.endVerse,
        });
      }
    }

    return { verseCount, proposedCount, keptCount, proposedSpans };
  }, [chapterPreviews]);

  return {
    allowed,
    chapterCount,
    loading,
    error,
    chapters: chapterPreviews,
    verseCount: summary.verseCount,
    proposedCount: summary.proposedCount,
    keptCount: summary.keptCount,
    proposedSpans: summary.proposedSpans,
    retry,
  };
}
