import { scopeChaptersAreContiguous } from "./contiguous-spans";
import {
  AUTO_HEART_MAX_CHAPTERS,
  countScopeChapters,
} from "./scope-chapter-count";
import type { VerseScope } from "./verse-scope-match";

/**
 * Whether a scope pack may opt into passage mode: one contiguous book range
 * of 1..{@link AUTO_HEART_MAX_CHAPTERS} chapters. Pack `kind` is checked by
 * callers; this helper only sees {@link VerseScope}.
 */
export function packAllowsPassageMode(scope: VerseScope): boolean {
  if (!scopeChaptersAreContiguous(scope)) return false;
  const chapterCount = countScopeChapters(scope);
  return chapterCount >= 1 && chapterCount <= AUTO_HEART_MAX_CHAPTERS;
}
