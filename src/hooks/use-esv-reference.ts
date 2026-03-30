import { useMemo } from "react";
import {
  type EsvChapterData,
  sliceEsvChapterToVerseRange,
} from "../../shared/esv-api";
import { useCachedEsvQuery } from "@/hooks/use-cached-esv-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatVerseRef, toEsvQuery } from "@/lib/verse-ref-utils";

export interface ReferenceQuery {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface UseEsvReferenceOptions {
  enabled?: boolean;
}

export function useEsvReference(
  ref: ReferenceQuery | null,
  options?: UseEsvReferenceOptions,
) {
  const enabled = options?.enabled ?? true;
  const chapterQuery = ref ? toEsvQuery(ref.book, ref.chapter) : null;
  const {
    data: chapterData,
    loading,
    error,
  } = useCachedEsvQuery(chapterQuery, { enabled });

  const data = useMemo((): EsvChapterData | null => {
    if (!chapterData || !ref) return null;
    return sliceEsvChapterToVerseRange(
      chapterData,
      ref.startVerse,
      ref.endVerse,
    );
  }, [chapterData, ref]);

  const rangeLabel = ref ? formatVerseRef(ref) : null;

  return {
    data,
    loading,
    error,
    /** Human-readable verse range (e.g. `John 3:16-18`). Passage fetch uses chapter key. */
    query: rangeLabel,
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
