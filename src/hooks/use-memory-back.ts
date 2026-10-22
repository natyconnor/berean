import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useCallback } from "react";

import { api } from "../../convex/_generated/api";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  MEMORY_HOME,
  memoryExitLookup,
  resolveMemoryExit,
  type MemoryExit,
} from "@/lib/memory-exit";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

export type MemoryExitAction = MemoryExit & { go: () => void };

/**
 * Leave a memory session for a named place in the app. Sessions are shared
 * routes opened from Today, drawers, pages, and the reader, so each carries
 * a `return`. The session's history entry is replaced so Back from there does
 * not reopen a finished session.
 */
export function useMemoryExit(
  returnTo?: string,
  fallbackHref: string = MEMORY_HOME,
): MemoryExitAction {
  const navigate = useNavigate();
  const now = useLiveNow();
  const lookup = memoryExitLookup(returnTo, fallbackHref);

  const pack = useQuery(
    api.packs.get,
    lookup.kind === "pack" ? { id: lookup.packId } : "skip",
  );
  const verse = useQuery(
    api.verseMemory.verseDetail,
    lookup.kind === "verse" ? { verseRefId: lookup.verseRefId, now } : "skip",
  );

  const exit = resolveMemoryExit(returnTo, fallbackHref, {
    packName:
      lookup.kind === "pack"
        ? pack === undefined
          ? undefined
          : (pack?.name ?? null)
        : undefined,
    verseLabel:
      lookup.kind === "verse"
        ? verse === undefined
          ? undefined
          : verse === null
            ? null
            : formatVerseRefTitle(verse)
        : undefined,
  });

  const go = useCallback(() => {
    void navigate({ href: exit.href, replace: true });
  }, [exit.href, navigate]);

  return { ...exit, go };
}
