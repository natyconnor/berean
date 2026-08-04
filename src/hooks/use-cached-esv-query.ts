import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  type EsvChapterData,
  getCachedPassage,
  setCachedPassage,
} from "../../shared/esv-api";
import { logInteraction } from "@/lib/dev-log";

interface AsyncQueryState {
  query: string | null;
  data: EsvChapterData | null;
  error: string | null;
}

export interface UseCachedEsvQueryOptions {
  /** When false, do not call the ESV action (unless value is already in session cache). */
  enabled?: boolean;
}

function chapterLoadMetrics(data: EsvChapterData): {
  verseCount: number;
  headingCount: number;
  midHeadingCount: number;
  textChars: number;
} {
  let headingCount = 0;
  let midHeadingCount = 0;
  let textChars = 0;
  for (const verse of data.verses) {
    if (verse.heading) headingCount += 1;
    midHeadingCount += verse.midHeadings?.length ?? 0;
    textChars += verse.text.length;
  }
  return {
    verseCount: data.verses.length,
    headingCount,
    midHeadingCount,
    textChars,
  };
}

export function useCachedEsvQuery(
  query: string | null,
  options?: UseCachedEsvQueryOptions,
) {
  const enabled = options?.enabled ?? true;
  const fetchPassage = useAction(api.esv.getPassage);
  const requestVersionRef = useRef(0);
  const lastLoadLogRef = useRef<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [asyncState, setAsyncState] = useState<AsyncQueryState>({
    query: null,
    data: null,
    error: null,
  });

  const cached = query ? getCachedPassage(query) : null;

  const retry = useCallback(() => {
    requestVersionRef.current += 1;
    lastLoadLogRef.current = null;
    setAsyncState({ query: null, data: null, error: null });
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;

    if (!query || !enabled) {
      return;
    }

    const cachedData = getCachedPassage(query);
    if (cachedData) {
      const logKey = query;
      if (lastLoadLogRef.current !== logKey) {
        lastLoadLogRef.current = logKey;
        logInteraction("reader", "esv-load", {
          query,
          source: "html",
          cache: "hit",
          fetchMs: 0,
          ...chapterLoadMetrics(cachedData),
        });
      }
      // Sync React state even when the render-phase cache read missed, so
      // `loading` clears and `data` is available without waiting for a refetch.
      // sessionStorage is an external store; a hit here may not have been visible
      // during render, so we must setState to schedule an update.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage cache sync
      setAsyncState({ query, data: cachedData, error: null });
      return;
    }

    const startedAt = performance.now();

    void fetchPassage({ query })
      .then((data) => {
        if (requestVersion !== requestVersionRef.current) return;
        setCachedPassage(query, data);
        lastLoadLogRef.current = query;
        logInteraction("reader", "esv-load", {
          query,
          source: "html",
          cache: "miss",
          fetchMs: Math.round(performance.now() - startedAt),
          ...chapterLoadMetrics(data),
        });
        setAsyncState({
          query,
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (requestVersion !== requestVersionRef.current) return;
        setAsyncState({
          query,
          data: null,
          error:
            error instanceof Error ? error.message : "Failed to load passage",
        });
      });
  }, [enabled, fetchPassage, query, retryNonce]);

  const hasFreshAsyncState = asyncState.query === query;

  return {
    data: cached ?? (hasFreshAsyncState ? asyncState.data : null),
    loading: !!query && enabled && !cached && !hasFreshAsyncState,
    error: !query || cached || !hasFreshAsyncState ? null : asyncState.error,
    retry,
  };
}
