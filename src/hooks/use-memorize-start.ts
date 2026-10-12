import { useAction, useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { startPassageForPack } from "@/hooks/use-start-passage";
import { useSingleFlight } from "@/hooks/use-submit-lock";
import { logInteraction } from "@/lib/dev-log";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import type { MemorizeMode } from "@/lib/memorize-plan";
import { passageScope, type ResolvedMemorize } from "@/lib/memorize-target";

/** Where a memorized target lives. A verse carries its span for session URLs. */
export type MemorizeDestination =
  | { kind: "verse"; verseRefId: Id<"verseRefs">; span: VerseSpan }
  | { kind: "pack"; packId: Id<"packs"> };

export type MemorizeResult = {
  mode: MemorizeMode;
  destination: MemorizeDestination;
  alreadyMemorizing: boolean;
};

/** `verseMemory.memorizeStatus` for a target's spans (see `memorizeTargetSpans`). */
export type MemorizeStatus = FunctionReturnType<
  typeof api.verseMemory.memorizeStatus
>;

export type MemorizeStartOptions = {
  /** Pack name typed by the user; defaults to the resolved title. */
  name?: string;
};

const INVALID_TARGET_MESSAGES: Record<
  Extract<ResolvedMemorize, { mode: "invalid" }>["reason"],
  string
> = {
  tooLong: "Pick up to 20 chapters to memorize as one passage.",
  empty: "There's nothing here to memorize.",
  crossBook: "A passage has to stay within one book.",
};

/**
 * The learn session that starts a destination, returning to `returnTo`
 * (an internal path with its search string) when done.
 */
export function memorizeStartHref(
  destination: MemorizeDestination,
  returnTo: string,
): string {
  const params = new URLSearchParams();
  let path: string;
  if (destination.kind === "verse") {
    const { book, chapter, startVerse, endVerse } = destination.span;
    path = "/memory/learn";
    params.set("book", book);
    params.set("chapter", String(chapter));
    params.set("startVerse", String(startVerse));
    params.set("endVerse", String(endVerse));
  } else {
    path = `/memory/${encodeURIComponent(destination.packId)}/learn`;
  }
  if (returnTo) params.set("return", returnTo);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Starts memorizing a resolved target (see `resolveMemorizeTarget`):
 * - verse → `verseMemory.memorize`
 * - passage → the preset's pack or the scope pack for its chapters, then
 *   passage mode from ESV pieces (`passageMemory.start` writes the heart)
 * - pack → `packs.createAndMemorize`
 *
 * Every path hearts the target when no heart covers it. Errors reject the
 * returned promise. A call made while one is in flight joins it.
 */
export function useMemorizeStart(): {
  start: (
    resolved: ResolvedMemorize,
    opts?: MemorizeStartOptions,
  ) => Promise<MemorizeResult>;
  pending: boolean;
} {
  const convex = useConvex();
  const memorizeVerses = useMutation(api.verseMemory.memorize);
  const createAndMemorize = useMutation(api.packs.createAndMemorize);
  const startPreset = useMutation(api.packs.startPreset);
  const createPack = useMutation(api.packs.create);
  const startPassage = useMutation(api.passageMemory.start);
  const fetchChaptersBatch = useAction(api.esv.getChaptersBatch);

  const run = useCallback(
    async (
      resolved: ResolvedMemorize,
      opts?: MemorizeStartOptions,
    ): Promise<MemorizeResult> => {
      const now = Date.now();
      try {
        let result: MemorizeResult;
        switch (resolved.mode) {
          case "verse": {
            const memorized = await memorizeVerses({
              spans: [resolved.span],
              now,
            });
            const verseRefId = memorized.verseRefIds[0];
            if (!verseRefId) throw new Error("Couldn't memorize this verse.");
            result = {
              mode: "verse",
              destination: { kind: "verse", verseRefId, span: resolved.span },
              alreadyMemorizing: memorized.alreadyMemorizing > 0,
            };
            break;
          }
          case "pack": {
            const { packId } = await createAndMemorize({
              name: opts?.name?.trim() || resolved.title,
              spans: resolved.spans,
              now,
            });
            result = {
              mode: "pack",
              destination: { kind: "pack", packId },
              alreadyMemorizing: false,
            };
            break;
          }
          case "passage": {
            const scope = passageScope(
              resolved.book,
              resolved.startChapter,
              resolved.endChapter,
            );
            const packId = resolved.presetId
              ? (await startPreset({ presetId: resolved.presetId })).packId
              : await createPack({
                  name: resolved.title,
                  kind: "scope",
                  scope,
                });
            const existing = await convex.query(api.passageMemory.getForPack, {
              packId,
              now,
              tzOffsetMinutes: new Date(now).getTimezoneOffset(),
            });
            if (!existing) {
              await startPassageForPack(
                { fetchChaptersBatch, startPassage },
                { packId, scope, now },
              );
            }
            result = {
              mode: "passage",
              destination: { kind: "pack", packId },
              alreadyMemorizing: existing !== null,
            };
            break;
          }
          case "invalid":
            throw new Error(INVALID_TARGET_MESSAGES[resolved.reason]);
        }
        logInteraction("memorize", "started", {
          mode: result.mode,
          alreadyMemorizing: result.alreadyMemorizing,
        });
        return result;
      } catch (caught) {
        logInteraction("memorize", "start-failed", {
          mode: resolved.mode,
          message: caught instanceof Error ? caught.message : String(caught),
        });
        throw caught;
      }
    },
    [
      convex,
      createAndMemorize,
      createPack,
      fetchChaptersBatch,
      memorizeVerses,
      startPassage,
      startPreset,
    ],
  );

  const { call, pending } = useSingleFlight(run);
  return { start: call, pending };
}
