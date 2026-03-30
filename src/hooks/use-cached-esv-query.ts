import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  type EsvChapterData,
  getCachedPassage,
  setCachedPassage,
} from "../../shared/esv-api";

interface AsyncQueryState {
  query: string | null;
  data: EsvChapterData | null;
  error: string | null;
}

export interface UseCachedEsvQueryOptions {
  /** When false, do not call the ESV action (unless value is already in session cache). */
  enabled?: boolean;
}

export function useCachedEsvQuery(
  query: string | null,
  options?: UseCachedEsvQueryOptions,
) {
  const enabled = options?.enabled ?? true;
  const fetchPassage = useAction(api.esv.getPassageText);
  const requestVersionRef = useRef(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [asyncState, setAsyncState] = useState<AsyncQueryState>({
    query: null,
    data: null,
    error: null,
  });

  const cached = query ? getCachedPassage(query) : null;

  const retry = useCallback(() => {
    requestVersionRef.current += 1;
    setAsyncState({ query: null, data: null, error: null });
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;

    if (!query || cached || !enabled) {
      return;
    }

    void fetchPassage({ query })
      .then((data) => {
        if (requestVersion !== requestVersionRef.current) return;
        setCachedPassage(query, data);
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
  }, [cached, enabled, fetchPassage, query, retryNonce]);

  const hasFreshAsyncState = asyncState.query === query;

  return {
    data: cached ?? (hasFreshAsyncState ? asyncState.data : null),
    loading: !!query && enabled && !cached && !hasFreshAsyncState,
    error: !query || cached || !hasFreshAsyncState ? null : asyncState.error,
    retry,
  };
}
