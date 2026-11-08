import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
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
import type { SessionCompleteVerse } from "@/components/memory/practice/session-complete";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import {
  REFRESH_START_ERROR,
  SUMMARY_REFRESH_BACK_LABEL,
} from "@/lib/memory-copy";
import type { ReviewSessionAttempt } from "@/lib/review-session-attempts";
import { withReturn } from "@/lib/memory-return";
import { memoryVerseRefreshHref } from "@/lib/memory-session-path";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** `verseRefKey` of the verse a ••• Refresh just left, to focus its ••• again. */
    refreshedVerse?: string;
    /** The session summary on this entry, shown again on coming back to it. */
    sessionSummary?: SessionSummarySnapshot;
    /** This Refresh started from a session summary; leaving goes back to it. */
    summaryRefresh?: boolean;
  }
}

/** What a session summary showed, so a summary Refresh can return to it as it was. */
export type SessionSummarySnapshot =
  | {
      kind: "review";
      attempts: ReviewSessionAttempt[];
      averageAccuracy: number | null;
      remaining: number;
      doneLabel: string;
      extraPracticeHref?: string;
      /** The summary offered Keep reviewing. */
      canContinue: boolean;
    }
  | {
      kind: "today";
      title: string;
      passages: readonly string[];
      learned: ReadonlyArray<SessionCompleteVerse>;
      attempts: ReviewSessionAttempt[];
      extraPracticeHref?: string;
    };

type VerseReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

/**
 * ••• Refresh: load the verse text while the menu's page stays put, then open
 * the refresher. When the text can't load, `error` is shown in place (R34) and
 * nothing counts. From a session summary, `summary` is saved on the summary's
 * own history entry first, so leaving the refresher goes back to it.
 */
export function useStartVerseRefresh(
  reference: VerseReference,
  returnTo: string,
) {
  const fetchPassage = useAction(api.esv.getPassage);
  const navigate = useNavigate();
  const lock = useSubmitLock();
  const [error, setError] = useState<string | null>(null);

  const start = (
    due: boolean,
    summary?: { href: string; snapshot: SessionSummarySnapshot },
  ) =>
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
        if (summary) {
          await navigate({
            href: summary.href,
            replace: true,
            state: {
              sessionSummary: summary.snapshot,
              ...refreshReturnState(reference),
            },
          });
        }
        await navigate({
          href: withReturn(memoryVerseRefreshHref(due, reference), returnTo),
          ...(summary ? { state: { summaryRefresh: true } } : {}),
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
 * Leaving a Refresh started from a session summary (Continue or Back): back to
 * that summary's history entry. `null` for any other Refresh.
 */
export function useSummaryRefreshExit(): {
  label: string;
  go: () => void;
} | null {
  const router = useRouter();
  const fromSummary = useLocation({
    select: (location) => location.state.summaryRefresh === true,
  });
  if (!fromSummary) return null;
  return {
    label: SUMMARY_REFRESH_BACK_LABEL,
    go: () => router.history.back(),
  };
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
