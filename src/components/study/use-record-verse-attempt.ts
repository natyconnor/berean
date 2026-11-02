import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";

import type { DiffToken } from "@/lib/diff-words";
import { devLog } from "@/lib/dev-log";
import type { MemorySchedule } from "@/lib/memory-scheduler";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { verseRefKey } from "../../../shared/verse-ref-key";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import {
  classifyVerseAttempt,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import type { CardReference } from "./study-card-model";

/** Memory session modes; stored `"deck"` attempts are legacy Study rows. */
export type VerseAttemptMode = "learn" | "review" | "practice";

export type RecordVerseAttemptResult =
  { ok: true; schedule: MemorySchedule | null } | { ok: false };

const NOTHING_TO_GRADE: RecordVerseAttemptResult = {
  ok: true,
  schedule: null,
};

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
  /** Reuse on retry so a lost reply cannot insert a second row. */
  now?: number;
  hint?: "first-letters";
  holdSchedule?: boolean;
  refresherUsed?: boolean;
  replaceHeldId?: Id<"heldVerseAttempts">;
}

interface PendingAttempt {
  input: RecordVerseAttemptInput;
  now: number;
  resolve: (result: RecordVerseAttemptResult) => void;
}

export interface RecordVerseAttemptOptions {
  /**
   * Session cards already carry `verseRefId`. Skip the library-wide id map so
   * Learn / Practice / Review do not collect every hearted verse on open.
   */
  skipLibraryIds?: boolean;
}

interface RecordVerseAttempt {
  /** True once the user's hearted-verse list has loaded. */
  heartedVersesReady: boolean;
  /**
   * Fire-and-forget persistence of a graded verse attempt.
   *
   * `{ ok: true, schedule }` on a saved grade (`schedule` is null when there
   * is nothing to grade or the verse is not hearted). `{ ok: false }` when the
   * mutation fails. Never rejects, so it can't perturb the UI. Attempts made
   * before the hearted-verse list has loaded are deferred and flushed once it
   * resolves, so a real attempt is never dropped just because it landed in the
   * loading window.
   */
  record: (input: RecordVerseAttemptInput) => Promise<RecordVerseAttemptResult>;
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
export function useRecordVerseAttempt(
  options?: RecordVerseAttemptOptions,
): RecordVerseAttempt {
  const skipLibraryIds = options?.skipLibraryIds === true;
  const recordAttempt = useMutation(api.verseMemory.recordAttempt);
  // `undefined` while the subscription loads; an array (possibly empty) once
  // resolved. We must distinguish the two so early attempts aren't dropped.
  const recordingIds = useQuery(
    api.savedVerses.listRecordingIds,
    skipLibraryIds ? "skip" : {},
  );

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
    ): Promise<RecordVerseAttemptResult> => {
      const quality = classifyVerseAttempt(input.tokens);
      if (!quality) return Promise.resolve(NOTHING_TO_GRADE);
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
        timeZone: getViewerTimeZone(),
        ...(input.hint ? { hint: input.hint } : {}),
        ...(input.holdSchedule ? { holdSchedule: true } : {}),
        ...(input.refresherUsed ? { refresherUsed: true } : {}),
        ...(input.replaceHeldId ? { replaceHeldId: input.replaceHeldId } : {}),
      })
        .then((schedule): RecordVerseAttemptResult => ({
          ok: true,
          schedule,
        }))
        .catch((error: unknown) => {
          devLog.warn("verseMemory", "recordAttempt failed", error);
          return { ok: false as const };
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
    (input: RecordVerseAttemptInput): Promise<RecordVerseAttemptResult> => {
      // Nothing gradable yet (e.g. empty input) — no-op without a round trip.
      if (!classifyVerseAttempt(input.tokens)) {
        return Promise.resolve(NOTHING_TO_GRADE);
      }

      const now = input.now ?? Date.now();
      const verseRefId = verseRefIdFor(input);
      if (verseRefId) return performRecord(input, verseRefId, now);

      if (skipLibraryIds || recordingIds !== undefined) {
        return Promise.resolve(NOTHING_TO_GRADE);
      }

      // Hearted verses still loading: defer so a real attempt isn't lost.
      // The flush effect resolves this once resolution is possible.
      return new Promise<RecordVerseAttemptResult>((resolve) => {
        pendingRef.current.push({ input, now, resolve });
      });
    },
    [recordingIds, skipLibraryIds, verseRefIdFor, performRecord],
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
        resolve(NOTHING_TO_GRADE);
        continue;
      }
      void performRecord(input, verseRefId, now).then(resolve);
    }
  }, [recordingIds, verseRefIdFor, performRecord]);

  return {
    record,
    resolveVerseRefId,
    heartedVersesReady: skipLibraryIds || recordingIds !== undefined,
  };
}
