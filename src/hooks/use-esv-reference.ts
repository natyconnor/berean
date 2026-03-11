import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import { useState, useEffect, useMemo, useRef } from "react"
import {
  type EsvChapterData,
  getCachedPassage,
  setCachedPassage,
  parseEsvResponse,
} from "@/lib/esv-api"

export interface ReferenceQuery {
  book: string
  chapter: number
  startVerse: number
  endVerse: number
}

function toReferenceQuery(ref: ReferenceQuery): string {
  if (ref.startVerse === ref.endVerse) {
    return `${ref.book} ${ref.chapter}:${ref.startVerse}`
  }
  return `${ref.book} ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
}

export function useEsvReference(ref: ReferenceQuery | null) {
  const fetchPassage = useAction(api.esv.getPassageText)
  const query = ref ? toReferenceQuery(ref) : null
  const cached = query ? getCachedPassage(query) : null

  const [asyncData, setAsyncData] = useState<EsvChapterData | null>(null)
  const [asyncLoading, setAsyncLoading] = useState(false)
  const [asyncError, setAsyncError] = useState<string | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!query) {
      requestRef.current += 1
      return
    }
    if (cached) return

    const requestId = ++requestRef.current
    queueMicrotask(() => {
      setAsyncLoading(true)
      setAsyncError(null)
      setAsyncData(null)
    })

    fetchPassage({ query })
      .then((raw) => {
        if (requestId !== requestRef.current) return
        const parsed = parseEsvResponse(raw as Record<string, unknown>)
        setCachedPassage(query, parsed)
        setAsyncData(parsed)
      })
      .catch((error) => {
        if (requestId !== requestRef.current) return
        setAsyncError(error instanceof Error ? error.message : "Failed to load verse reference")
      })
      .finally(() => {
        if (requestId !== requestRef.current) return
        setAsyncLoading(false)
      })
  }, [cached, fetchPassage, query])

  return {
    data: cached ?? asyncData,
    loading: query ? (cached ? false : asyncLoading) : false,
    error: query ? (cached ? null : asyncError) : null,
    query,
  }
}

export interface VerseRefValidationState {
  status: "idle" | "debouncing" | "checking" | "valid" | "invalid" | "unavailable"
  data: EsvChapterData | null
  error: string | null
}

export function useDebouncedEsvReferenceValidation(
  ref: ReferenceQuery | null,
  delayMs = 400
): VerseRefValidationState {
  const [debouncedRef, setDebouncedRef] = useState<ReferenceQuery | null>(null)

  useEffect(() => {
    if (!ref) {
      setDebouncedRef(null)
      return
    }

    const timeout = window.setTimeout(() => {
      setDebouncedRef(ref)
    }, delayMs)

    return () => window.clearTimeout(timeout)
  }, [delayMs, ref])

  const { data, loading, error } = useEsvReference(debouncedRef)

  return useMemo(() => {
    if (!ref) {
      return {
        status: "idle",
        data: null,
        error: null,
      } satisfies VerseRefValidationState
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
      } satisfies VerseRefValidationState
    }

    if (loading) {
      return {
        status: "checking",
        data: null,
        error: null,
      } satisfies VerseRefValidationState
    }

    if (error) {
      return {
        status: "unavailable",
        data: null,
        error,
      } satisfies VerseRefValidationState
    }

    if (!data || data.verses.length === 0) {
      return {
        status: "invalid",
        data,
        error: null,
      } satisfies VerseRefValidationState
    }

    return {
      status: "valid",
      data,
      error: null,
    } satisfies VerseRefValidationState
  }, [data, debouncedRef, error, loading, ref])
}
