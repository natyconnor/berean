import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState, type RefObject } from "react";

import { api } from "../../convex/_generated/api";
import {
  getCachedPassage,
  setCachedPassage,
  sliceEsvChapterToVerseRange,
} from "../../shared/esv-api";
import { toEsvQuery } from "../../shared/esv-query";
import { verseRefKey } from "../../shared/verse-ref-key";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { REFRESH_START_ERROR } from "@/lib/memory-copy";
import { withReturn } from "@/lib/memory-return";
import { memoryVerseRefreshHref } from "@/lib/memory-session-path";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** `verseRefKey` of the verse a ••• Refresh just left, to focus its ••• again. */
    refreshedVerse?: string;
  }
}

type VerseReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

/**
 * ••• Refresh: load the verse text while the menu's page stays put, then open
 * the refresher. When the text can't load, `error` is shown in place (R34) and
 * nothing counts.
 */
export function useStartVerseRefresh(
  reference: VerseReference,
  returnTo: string,
) {
  const fetchPassage = useAction(api.esv.getPassage);
  const navigate = useNavigate();
  const lock = useSubmitLock();
  const [error, setError] = useState<string | null>(null);

  const start = (due: boolean) =>
    lock.submit(async () => {
      setError(null);
      try {
        const query = toEsvQuery(reference.book, reference.chapter);
        const chapter =
          getCachedPassage(query) ?? (await fetchPassage({ query }));
        setCachedPassage(query, chapter);
        const verses = sliceEsvChapterToVerseRange(
          chapter,
          reference.startVerse,
          reference.endVerse,
        ).verses;
        if (!verses.some((verse) => verse.text.trim() !== "")) {
          throw new Error("No verse text");
        }
        await navigate({
          href: withReturn(memoryVerseRefreshHref(due, reference), returnTo),
        });
      } catch {
        setError(REFRESH_START_ERROR);
      }
    });

  return { start, pending: lock.pending, error };
}

/** History state for leaving a ••• Refresh of `reference`. */
export function refreshReturnState(reference: VerseReference) {
  return { refreshedVerse: verseRefKey(reference) };
}

/**
 * Back from a ••• Refresh of `reference`: focus the ••• it started from, once
 * it has mounted. Nothing happens when that control is gone.
 */
export function useRefreshReturnFocus(
  reference: VerseReference,
  triggerRef: RefObject<HTMLElement | null>,
) {
  const refreshed = useLocation({
    select: (location) => location.state.refreshedVerse,
  });
  const key = verseRefKey(reference);
  useEffect(() => {
    if (refreshed === key) triggerRef.current?.focus();
  }, [refreshed, key, triggerRef]);
}
