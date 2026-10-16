import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

/** A pack a verse joins once it starts: one of yours, or a new one by name. */
export type MemorizePackChoice =
  | { kind: "pack"; packId: Id<"packs">; name: string }
  | { kind: "new"; name: string };

/**
 * Put a just-started verse in the chosen pack: `packs.addVerse` for one of
 * yours, `packs.createAndMemorize` for a new one (both keep a learning verse
 * learning). Toasts either way, so the pack is seen to stick; a new pack with
 * no name is skipped (the sheet asks for one first).
 */
export function useJoinMemorizePack(): (
  span: VerseSpan,
  choice: MemorizePackChoice,
) => Promise<void> {
  const addVerse = useMutation(api.packs.addVerse);
  const createAndMemorize = useMutation(api.packs.createAndMemorize);

  return useCallback(
    async (span, choice) => {
      const name = choice.name.trim();
      if (!name) return;
      const verse = {
        book: span.book,
        chapter: span.chapter,
        startVerse: span.startVerse,
        endVerse: span.endVerse,
      };
      const title = formatVerseRefTitle(verse);
      try {
        if (choice.kind === "pack") {
          await addVerse({ id: choice.packId, ...verse });
          toast.success(`Added ${title} to ${name}.`);
        } else {
          await createAndMemorize({ name, spans: [verse], now: Date.now() });
          toast.success(`Created the pack ${name} with ${title}.`);
        }
      } catch {
        toast.error(`Couldn't add to ${name}.`);
      }
    },
    [addVerse, createAndMemorize],
  );
}
