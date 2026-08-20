import type { Id } from "../../../../convex/_generated/dataModel";
import type { MemoryStatus } from "@/lib/memory-scheduler";
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
  memory?: {
    status: MemoryStatus;
    dueAt?: number;
    lastReviewedAt?: number;
  };
};

export function packVerseKey(verse: PackableVerse): string {
  return formatVerseRef(verse);
}
