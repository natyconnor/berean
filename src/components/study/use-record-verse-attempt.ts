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
  /**
   * When the session card already carries this id, record without resolving
   * through the hearted-verse list (which must not join `verseMemory`).
   */
  verseRefId?: Id<"verseRefs">;
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
 * Prefer `verseRefId` on the card (due-queue / library / pack member). The
 * fallback id map is `savedVerses.listRecordingIds` — saved verses + refs
 * only — so a `verseMemory` patch does not re-run it during Saving...
 */
export function useRecordVerseAttempt(): RecordVerseAttempt {
  const recordAttempt = useMutation(api.verseMemory.recordAttempt);
  // `undefined` while the subscription loads; an array (possibly empty) once
  // resolved. We must distinguish the two so early attempts aren't dropped.
  const recordingIds = useQuery(api.savedVerses.listRecordingIds, {});

  const verseRefIdByRefKey = useMemo(() => {
    const map = new Map<string, Id<"verseRefs">>();
    for (const saved of recordingIds ?? []) {
      map.set(verseRefKey(saved), saved.verseRefId);
    }
    return map;
  }, [recordingIds]);

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
        // Lets the scheduler land a learning soft lock on the start of the
        // learner's next local day instead of a rolling 24 hours.
        tzOffsetMinutes: new Date(now).getTimezoneOffset(),
      })
        .then((schedule): MemorySchedule | null => schedule)
        .catch((error: unknown) => {
          devLog.warn("verseMemory", "recordAttempt failed", error);
          return null;
        });
    },
    [recordAttempt],
  );

  const verseRefIdFor = useCallback(
    (input: RecordVerseAttemptInput): Id<"verseRefs"> | null =>
      input.verseRefId ?? resolveVerseRefId(input.reference),
    [resolveVerseRefId],
  );

  // Attempts recorded before `recordingIds` resolved, awaiting a flush.
  const pendingRef = useRef<PendingAttempt[]>([]);

  const record = useCallback(
    (input: RecordVerseAttemptInput): Promise<MemorySchedule | null> => {
      // Nothing gradable yet (e.g. empty input) — no-op without a round trip.
      if (!classifyVerseAttempt(input.tokens)) return Promise.resolve(null);

      const now = Date.now();
      const verseRefId = verseRefIdFor(input);
      if (verseRefId) return performRecord(input, verseRefId, now);

      if (recordingIds === undefined) {
        // Hearted verses still loading: defer so a real attempt isn't lost.
        // The flush effect resolves this once resolution is possible.
        return new Promise<MemorySchedule | null>((resolve) => {
          pendingRef.current.push({ input, now, resolve });
        });
      }

      return Promise.resolve(null);
    },
    [recordingIds, verseRefIdFor, performRecord],
  );

  // Flush deferred attempts once the hearted-verse id list is available.
  useEffect(() => {
    if (recordingIds === undefined || pendingRef.current.length === 0) return;
    const queued = pendingRef.current;
    pendingRef.current = [];
    for (const { input, now, resolve } of queued) {
      const verseRefId = verseRefIdFor(input);
      if (!verseRefId) {
        // Resolved list, still not a hearted verse: a no-op is correct.
        resolve(null);
        continue;
      }
      void performRecord(input, verseRefId, now).then(resolve);
    }
  }, [recordingIds, verseRefIdFor, performRecord]);

  return {
    record,
    resolveVerseRefId,
    heartedVersesReady: recordingIds !== undefined,
  };
}
