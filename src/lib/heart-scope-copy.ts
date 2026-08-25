/**
 * Shared labels for hearting a scope pack: the pack-view CTA, its tooltip,
 * the pointer shown after create, and the heart dialog. "Remaining" only
 * makes sense when some verses in the scope are already hearted.
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
    ? "Heart the rest of this scope as short memory passages, skipping verses you've already hearted."
    : "Heart every verse in this scope as short memory passages you can learn.";
}

/** Shown once after creating a pack, pointing at the Heart CTA. */
export function heartScopeHintCopy(hasExistingHearts: boolean): string {
  return hasExistingHearts
    ? "Heart remaining fills in the rest of this scope as short memory passages."
    : "Heart all verses fills this pack with short memory passages you can learn.";
}

export function heartScopeProposedLabel(count: number): string {
  return `${count} new passage${count === 1 ? "" : "s"}`;
}

export function heartScopeConfirmLabel(count: number): string {
  return `Heart ${heartScopeProposedLabel(count)}`;
}

/** How many verses in the scope are already hearted. */
export function heartScopeCoverageCopy(covered: number, slots: number): string {
  if (slots <= 0) {
    return "This scope has no verses to heart.";
  }
  if (covered <= 0) {
    return `None of these ${slots} verses are hearted yet. If you want to memorize the whole chapter (or all the chapters) together, we can auto-heart them as short memory units so you can start learning.`;
  }
  if (covered >= slots) {
    return `All ${slots} verses are already hearted.`;
  }
  return `${covered} of ${slots} verses are already hearted. If you want to memorize the rest of this chapter (or these chapters) together, we can auto-heart the remaining verses as short memory units so you can start learning.`;
}
