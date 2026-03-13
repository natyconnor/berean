import { useMemo } from "react";
import type { EsvChapterData } from "@/lib/esv-api";
import { useCachedEsvQuery } from "@/hooks/use-cached-esv-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ReferenceQuery {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

function toReferenceQuery(ref: ReferenceQuery): string {
  if (ref.startVerse === ref.endVerse) {
    return `${ref.book} ${ref.chapter}:${ref.startVerse}`;
  }
  return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`;
}

export function useEsvReference(ref: ReferenceQuery | null) {
  const query = ref ? toReferenceQuery(ref) : null;
  const { data, loading, error } = useCachedEsvQuery(query);

  return {
    data,
    loading,
    error,
    query,
  };
}

export interface VerseRefValidationState {
  status:
    | "idle"
    | "debouncing"
    | "checking"
    | "valid"
    | "invalid"
    | "unavailable";
  data: EsvChapterData | null;
  error: string | null;
}

export function useDebouncedEsvReferenceValidation(
  ref: ReferenceQuery | null,
  delayMs = 400,
): VerseRefValidationState {
  const debouncedRef = useDebouncedValue(ref, delayMs);

  const { data, loading, error } = useEsvReference(debouncedRef);

  return useMemo(() => {
    if (!ref) {
      return {
        status: "idle",
        data: null,
        error: null,
      } satisfies VerseRefValidationState;
    }

    if (
      !debouncedRef ||
      debouncedRef.book !== ref.book ||
      debouncedRef.chapter !== ref.chapter ||
      debouncedRef.startVerse !== ref.startVerse ||
      debouncedRef.endVerse !== ref.endVerse
    ) {
      return {
        status: "debouncing",
        data: null,
        error: null,
      } satisfies VerseRefValidationState;
    }

    if (loading) {
      return {
        status: "checking",
        data: null,
        error: null,
      } satisfies VerseRefValidationState;
    }

    if (error) {
      return {
        status: "unavailable",
        data: null,
        error,
      } satisfies VerseRefValidationState;
    }

    if (!data || data.verses.length === 0) {
      return {
        status: "invalid",
        data,
        error: null,
      } satisfies VerseRefValidationState;
    }

    return {
      status: "valid",
      data,
      error: null,
    } satisfies VerseRefValidationState;
  }, [data, debouncedRef, error, loading, ref]);
}
