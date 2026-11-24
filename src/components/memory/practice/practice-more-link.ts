import type { CardReference } from "@/components/study/study-card-model";
import { PRACTICE_MORE_LABEL } from "@/lib/memory-copy";
import { withReturn } from "@/lib/memory-return";
import {
  offersPracticeMore,
  type MemorySessionCandidate,
} from "@/lib/memory-session";
import { memoryVerseSessionHref } from "@/lib/memory-session-path";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

/** A Practice more link for an end card's locked Learning verse. */
export interface PracticeMoreLink {
  href: string;
  /** "Practice more John 3:16". */
  label: string;
}

/**
 * Practice more on a verse an end card lists, or `null` unless it is a
 * locked Learning verse. Leaving the practice returns to `returnTo`, not to
 * the card.
 */
export function practiceMoreLink(
  verse: MemorySessionCandidate & { reference: CardReference },
  now: number,
  returnTo: string,
): PracticeMoreLink | null {
  if (!offersPracticeMore(verse, now)) return null;
  return {
    href: withReturn(
      memoryVerseSessionHref("practice", verse.reference),
      returnTo,
    ),
    label: `${PRACTICE_MORE_LABEL} ${formatVerseRefTitle(verse.reference)}`,
  };
}
