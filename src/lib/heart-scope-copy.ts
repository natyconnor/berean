/**
 * Shared labels for hearting a scope pack: the pack-view CTA, its tooltip,
 * and the create-time prompt. "Remaining" only makes sense when some verses
 * in the scope are already hearted.
 */

export function heartScopeHasExisting(coveredVerseCount: number): boolean {
  return coveredVerseCount > 0;
}

/** Short button / dialog title. */
export function heartScopeActionLabel(hasExistingHearts: boolean): string {
  return hasExistingHearts ? "Heart remaining" : "Heart all verses";
}

export function heartScopeDialogTitle(hasExistingHearts: boolean): string {
  return hasExistingHearts ? "Heart remaining verses" : "Heart all verses";
}

export function heartScopeTooltip(hasExistingHearts: boolean): string {
  return hasExistingHearts
    ? "Heart the rest of this scope as short memory units, skipping verses you've already hearted."
    : "Heart every verse in this scope as short memory units you can learn.";
}

/** How many verses in the scope are already hearted. */
export function heartScopeCoverageCopy(covered: number, slots: number): string {
  if (slots <= 0) {
    return "This scope has no verses to heart.";
  }
  if (covered <= 0) {
    return `None of these ${slots} verses are hearted yet. Heart them as short memory units so you can start learning.`;
  }
  if (covered >= slots) {
    return `All ${slots} verses are already hearted.`;
  }
  return `${covered} of ${slots} verses are already hearted. Heart the rest as short memory units.`;
}
