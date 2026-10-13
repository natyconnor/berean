import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import {
  estimateMasteryDays,
  estimateMemorizeDays,
  estimateSessionMinutes,
  formatLearnDuration,
  formatMasteryDuration,
} from "@/lib/memorize-plan";
import {
  MAX_PACK_NAME_LENGTH,
  MEMORIZE_MAX_PACK_SPANS,
} from "@/lib/memorize-status";
import {
  hasMemoryVerseScope,
  validateMemoryVerseSearch,
  type MemoryVerseSearch,
} from "@/lib/memory-verse-search";
import { PACK_ACTIVE_LEARNING_CAP } from "@/lib/pack-pacing";
import { validateVerseRefBounds } from "../../shared/verse-ref-validation";

/**
 * New pack (`/memory/new`): the plan box, when Create is allowed, and the
 * optional verse it starts with (from Add to pack → New pack…).
 */

export interface NewPackPlan {
  /** "3 verses · learn them in about 3 days" */
  headline: string;
  /** "About 6 min a day, then short reviews. Mastered in about 2 months." */
  detail: string;
}

/** Learning and mastery stay separate facts. `null` with nothing picked. */
export function newPackPlan(verseCount: number): NewPackPlan | null {
  if (verseCount <= 0) return null;
  const size = { mode: "pack" as const, verseCount };
  const learn = formatLearnDuration(estimateMemorizeDays(size), {
    short: true,
  });
  const minutes = estimateSessionMinutes({
    learningVerses: Math.min(verseCount, PACK_ACTIVE_LEARNING_CAP),
    reviewVerses: 0,
    passageSessions: 0,
  });
  const one = verseCount === 1;
  return {
    headline: `${verseCount} ${one ? "verse" : "verses"} · learn ${one ? "it" : "them"} in ${learn}`,
    detail: `About ${minutes} min a day, then short reviews. ${formatMasteryDuration(
      estimateMasteryDays(size),
    )}.`,
  };
}

export const NEW_PACK_CREATE_HINT = "Add a name and at least one verse";

/** Create needs a name and at least one verse (within the server's limits). */
export function canCreateNewPack(name: string, verseCount: number): boolean {
  const length = name.trim().length;
  return (
    length > 0 &&
    length <= MAX_PACK_NAME_LENGTH &&
    verseCount > 0 &&
    verseCount <= MEMORIZE_MAX_PACK_SPANS
  );
}

export type MemoryNewPackSearch = MemoryVerseSearch;

/** `/memory/new` search: an optional starting verse and `return`. */
export function validateMemoryNewPackSearch(
  search: Record<string, unknown>,
): MemoryNewPackSearch {
  return validateMemoryVerseSearch(search);
}

/** The starting verse in a `/memory/new` search, if it names a real one. */
export function newPackStartSpan(
  search: MemoryNewPackSearch,
): VerseSpan | null {
  if (!hasMemoryVerseScope(search)) return null;
  const span = {
    book: search.book,
    chapter: search.chapter,
    startVerse: search.startVerse,
    endVerse: search.endVerse,
  };
  return validateVerseRefBounds(span).valid ? span : null;
}

/** `/memory/new`, starting with `span` when given. */
export function newPackHref(span?: VerseSpan): string {
  if (!span) return "/memory/new";
  const params = new URLSearchParams({
    book: span.book,
    chapter: String(span.chapter),
    startVerse: String(span.startVerse),
    endVerse: String(span.endVerse),
  });
  return `/memory/new?${params.toString()}`;
}
