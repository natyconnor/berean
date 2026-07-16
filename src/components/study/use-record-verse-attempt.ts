import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";

import type { DiffToken } from "@/lib/diff-words";
import { devLog } from "@/lib/dev-log";
import type { MemorySchedule } from "@/lib/memory-scheduler";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { verseRefKey } from "../../../shared/verse-ref-key";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import type { CardReference } from "./study-card-model";

export type VerseAttemptMode = "learn" | "review" | "deck" | "practice";

interface RecordVerseAttemptInput {
  reference: CardReference;
  tokens: ReadonlyArray<DiffToken>;
  stage: number;
  mode: VerseAttemptMode;
  durationMs?: number;
  /** Word count of the verse text; forwarded to the scheduler's length curve. */
  wordCount?: number;
}

interface PendingAttempt {
  input: RecordVerseAttemptInput;
  now: number;
  resolve: (schedule: MemorySchedule | null) => void;
}

interface RecordVerseAttempt {
  /** True once the user's hearted-verse list has loaded. */
  heartedVersesReady: boolean;
  /**
   * Fire-and-forget persistence of a graded verse attempt.
   *
   * Resolves to the verse's new schedule on success (so callers can adopt the
   * server-authoritative `learnStage`), or `null` when there is nothing to
   * grade / the verse isn't hearted / the mutation fails. Never rejects, so it
   * can't perturb the UI. Attempts made before the hearted-verse list has
   * loaded are deferred and flushed once it resolves, so a real attempt is
   * never dropped just because it landed in the loading window.
   */
  record: (input: RecordVerseAttemptInput) => Promise<MemorySchedule | null>;
  /** Map a verse reference to the current user's owned `verseRefs` id, if any. */
  resolveVerseRefId: (reference: CardReference) => Id<"verseRefs"> | null;
}

/**
 * Bridges the study UI to `verseMemory.recordAttempt`.
 *
 * The verse's `verseRefs` id is resolved from the user's hearted verses
 * (the same `savedVerses` list the deck is built from), so cards only need to
 * carry a plain reference.
 */
export function useRecordVerseAttempt(): RecordVerseAttempt {
  const recordAttempt = useMutation(api.verseMemory.recordAttempt);
  // `undefined` while the subscription loads; an array (possibly empty) once
  // resolved. We must distinguish the two so early attempts aren't dropped.
  const savedVerses = useQuery(api.savedVerses.listAll, {});

  const verseRefIdByRefKey = useMemo(() => {
    const map = new Map<string, Id<"verseRefs">>();
    for (const saved of savedVerses ?? []) {
      map.set(verseRefKey(saved), saved.verseRefId);
    }
    return map;
  }, [savedVerses]);

  const resolveVerseRefId = useCallback(
    (reference: CardReference): Id<"verseRefs"> | null =>
      verseRefIdByRefKey.get(verseRefKey(reference)) ?? null,
    [verseRefIdByRefKey],
  );

  const performRecord = useCallback(
    (
      input: RecordVerseAttemptInput,
      verseRefId: Id<"verseRefs">,
      now: number,
    ): Promise<MemorySchedule | null> => {
      const quality = classifyVerseAttempt(input.tokens);
      if (!quality) return Promise.resolve(null);
      return recordAttempt({
        verseRefId,
        quality,
        accuracy: verseAttemptAccuracy(input.tokens),
        stage: input.stage,
        mode: input.mode,
        durationMs: input.durationMs,
        now,
        wordCount: input.wordCount,
      })
        .then((schedule): MemorySchedule | null => schedule)
        .catch((error: unknown) => {
          devLog.warn("verseMemory", "recordAttempt failed", error);
          return null;
        });
    },
    [recordAttempt],
  );

  // Attempts recorded before `savedVerses` resolved, awaiting a flush.
  const pendingRef = useRef<PendingAttempt[]>([]);

  const record = useCallback(
    (input: RecordVerseAttemptInput): Promise<MemorySchedule | null> => {
      // Nothing gradable yet (e.g. empty input) — no-op without a round trip.
      if (!classifyVerseAttempt(input.tokens)) return Promise.resolve(null);

      const now = Date.now();

      if (savedVerses === undefined) {
        // Hearted verses still loading: defer so a real attempt isn't lost.
        // The flush effect resolves this once resolution is possible.
        return new Promise<MemorySchedule | null>((resolve) => {
          pendingRef.current.push({ input, now, resolve });
        });
      }

      const verseRefId = resolveVerseRefId(input.reference);
      if (!verseRefId) return Promise.resolve(null);
      return performRecord(input, verseRefId, now);
    },
    [savedVerses, resolveVerseRefId, performRecord],
  );

  // Flush deferred attempts once the hearted-verse list is available.
  useEffect(() => {
    if (savedVerses === undefined || pendingRef.current.length === 0) return;
    const queued = pendingRef.current;
    pendingRef.current = [];
    for (const { input, now, resolve } of queued) {
      const verseRefId = resolveVerseRefId(input.reference);
      if (!verseRefId) {
        // Resolved list, still not a hearted verse: a no-op is correct.
        resolve(null);
        continue;
      }
      void performRecord(input, verseRefId, now).then(resolve);
    }
  }, [savedVerses, resolveVerseRefId, performRecord]);

  return {
    record,
    resolveVerseRefId,
    heartedVersesReady: savedVerses !== undefined,
  };
}
