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
import { prefetchCompositePassage } from "@/hooks/use-esv-composite-passage";
import type { MemoryExitAction } from "@/hooks/use-memory-back";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import {
  REFRESH_START_ERROR,
  SUMMARY_REFRESH_BACK_LABEL,
} from "@/lib/memory-copy";
import type { PassageStatus } from "@/lib/passage-heart-info";
import type { ReviewSessionAttempt } from "@/lib/review-session-attempts";
import { withReturn } from "@/lib/memory-return";
import {
  memoryPassageRefreshHref,
  memoryVerseRefreshHref,
} from "@/lib/memory-session-path";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** `verseRefKey` of the verse a ••• Refresh just left, to focus its ••• again. */
    refreshedVerse?: string;
    /** Pack id of the passage a Refresh just left, to focus its control again. */
    refreshedPassage?: string;
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
    }
  | {
      kind: "passage";
      packId: string;
      title: string;
      attempts: ReviewSessionAttempt[];
      dueAt: number;
      status?: PassageStatus;
    };

type VerseReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

/** What a Refresh runs on: one verse, or a whole Memorized passage. */
type RefreshTarget = VerseReference | { packId: string };

type SummaryOrigin = { href: string; snapshot: SessionSummarySnapshot };

/**
 * Open a Refresh once `loadText` has its text, while the page that started it
 * stays put. When the text can't load, `error` is shown in place (R34) and
 * nothing counts. From a session summary, `summary` is saved on the summary's
 * own history entry first, so leaving the refresher goes back to it.
 */
function useStartRefresh(
  target: RefreshTarget,
  returnTo: string,
  loadText: () => Promise<void>,
) {
  const navigate = useNavigate();
  const lock = useSubmitLock();
  const [error, setError] = useState<string | null>(null);

  const start = (due: boolean, summary?: SummaryOrigin) =>
    lock.submit(async () => {
      setError(null);
      try {
        await loadText();
        if (summary) {
          await navigate({
            href: summary.href,
            replace: true,
            state: {
              sessionSummary: summary.snapshot,
              ...refreshReturnState(target),
            },
          });
        }
        const href =
          "packId" in target
            ? memoryPassageRefreshHref(due, target.packId)
            : memoryVerseRefreshHref(due, target);
        await navigate({
          href: withReturn(href, returnTo),
          ...(summary ? { state: { summaryRefresh: true } } : {}),
        });
      } catch {
        setError(REFRESH_START_ERROR);
      }
    });

  return { start, pending: lock.pending, error };
}

/** ••• or summary Refresh on one verse. */
export function useStartVerseRefresh(
  reference: VerseReference,
  returnTo: string,
) {
  const fetchPassage = useAction(api.esv.getPassage);
  return useStartRefresh(reference, returnTo, async () => {
    const query = toEsvQuery(reference.book, reference.chapter);
    const chapter = getCachedPassage(query) ?? (await fetchPassage({ query }));
    setCachedPassage(query, chapter);
    const verses = sliceEsvChapterToVerseRange(
      chapter,
      reference.startVerse,
      reference.endVerse,
    ).verses;
    if (!verses.some((verse) => verse.text.trim() !== "")) {
      throw new Error("No verse text");
    }
  });
}

/**
 * ••• or summary Refresh on a passage: `references` are what it covers, the
 * whole of a Memorized one (R30, R50, R51) or a Learning one's learned verses
 * (R39). When it can't start (R34), focus goes back to `controlRef`, which
 * the launch disabled while the text loaded.
 */
export function useStartPassageRefresh(
  packId: string,
  references: readonly VerseReference[],
  returnTo: string,
  controlRef: RefObject<HTMLElement | null>,
) {
  const fetchChaptersBatch = useAction(api.esv.getChaptersBatch);
  const refresh = useStartRefresh({ packId }, returnTo, () =>
    prefetchCompositePassage(references, fetchChaptersBatch),
  );
  const failed = refresh.error !== null && !refresh.pending;
  useEffect(() => {
    if (failed) controlRef.current?.focus();
  }, [failed, controlRef]);
  return refresh;
}

/** History state for leaving a Refresh of `target`. */
export function refreshReturnState(target: RefreshTarget) {
  return "packId" in target
    ? { refreshedPassage: target.packId }
    : { refreshedVerse: verseRefKey(target) };
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
 * Leaving a passage Refresh (Continue or Back): back to the summary it started
 * from, else to the page it started from with focus on its •••.
 */
export function usePassageRefreshExit(
  exit: Pick<MemoryExitAction, "label" | "goWith">,
  packId: string,
): { label: string; go: () => void } {
  const toSummary = useSummaryRefreshExit();
  return (
    toSummary ?? {
      label: exit.label,
      go: () => exit.goWith(refreshReturnState({ packId })),
    }
  );
}

/**
 * Back from a Refresh of `target`: focus the control it started from, once it
 * has mounted. Nothing happens when that control is gone.
 */
export function useRefreshReturnFocus(
  target: RefreshTarget,
  triggerRef: RefObject<HTMLElement | null>,
) {
  const refreshed = useLocation({
    select: (location) =>
      "packId" in target
        ? location.state.refreshedPassage
        : location.state.refreshedVerse,
  });
  const key = "packId" in target ? target.packId : verseRefKey(target);
  useEffect(() => {
    if (refreshed === key) triggerRef.current?.focus();
  }, [refreshed, key, triggerRef]);
}
