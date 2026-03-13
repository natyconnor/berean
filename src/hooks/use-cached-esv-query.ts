import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  type EsvChapterData,
  getCachedPassage,
  parseEsvResponse,
  setCachedPassage,
} from "@/lib/esv-api";

interface AsyncQueryState {
  query: string | null;
  data: EsvChapterData | null;
  error: string | null;
}

export function useCachedEsvQuery(query: string | null) {
  const fetchPassage = useAction(api.esv.getPassageText);
  const requestVersionRef = useRef(0);
  const [asyncState, setAsyncState] = useState<AsyncQueryState>({
    query: null,
    data: null,
    error: null,
  });

  const cached = query ? getCachedPassage(query) : null;

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;

    if (!query || cached) {
      return;
    }

    void fetchPassage({ query })
      .then((raw) => {
        if (requestVersion !== requestVersionRef.current) return;
        const parsed = parseEsvResponse(raw);
        setCachedPassage(query, parsed);
        setAsyncState({
          query,
          data: parsed,
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
  }, [cached, fetchPassage, query]);

  const hasFreshAsyncState = asyncState.query === query;

  return {
    data: cached ?? (hasFreshAsyncState ? asyncState.data : null),
    loading: !!query && !cached && !hasFreshAsyncState,
    error: !query || cached || !hasFreshAsyncState ? null : asyncState.error,
  };
}
