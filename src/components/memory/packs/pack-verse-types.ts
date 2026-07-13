import type { Id } from "../../../../convex/_generated/dataModel";
import { formatVerseRef } from "@/lib/verse-ref-utils";

export interface PackableVerse {
  verseRefId?: Id<"verseRefs">;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export type HeartedVerse = PackableVerse & {
  verseRefId: Id<"verseRefs">;
};

export function packVerseKey(verse: PackableVerse): string {
  return formatVerseRef(verse);
}
