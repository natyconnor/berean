/**
 * Shared labels for hearting a scope pack: the pack-view CTA, its tooltip,
 * the pointer shown after create, and the heart dialog.
 */

export const HEART_SCOPE_ACTION_LABEL = "Memorize whole passage";

export const HEART_SCOPE_TOOLTIP =
  "Want to memorize this whole passage? Click here to automatically heart all the verses";

export function heartScopeHasExisting(coveredVerseCount: number): boolean {
  return coveredVerseCount > 0;
}

export function heartScopeActionLabel(): string {
  return HEART_SCOPE_ACTION_LABEL;
}

export function heartScopeDialogTitle(): string {
  return HEART_SCOPE_ACTION_LABEL;
}

export function heartScopeTooltip(): string {
  return HEART_SCOPE_TOOLTIP;
}

/** Shown once after creating a pack, pointing at the Heart CTA. */
export function heartScopeHintCopy(): string {
  return HEART_SCOPE_TOOLTIP;
}

export function heartScopeProposedLabel(count: number): string {
  return `${count} new passage${count === 1 ? "" : "s"}`;
}

export function heartScopeConfirmLabel(count: number): string {
  return `Heart ${heartScopeProposedLabel(count)}`;
}

function togetherPhrase(chapterCount: number, remaining: boolean): string {
  const finite = Number.isFinite(chapterCount) && chapterCount > 0;
  const multi = finite && chapterCount > 1;
  const single = finite && chapterCount === 1;
  if (remaining) {
    if (single) return "the rest of this chapter";
    if (multi) return "the rest of these chapters";
    return "the rest of this scope";
  }
  if (single) return "the whole chapter";
  if (multi) return "these chapters";
  return "this scope";
}

function alreadyHeartedLead(covered: number, slots: number): string {
  if (covered === 1) {
    return `1 of ${slots} verses is already hearted.`;
  }
  return `${covered} of ${slots} verses are already hearted.`;
}

/** How many verses in the scope are already hearted. */
export function heartScopeCoverageCopy(
  covered: number,
  slots: number,
  chapterCount: number,
): string {
  if (slots <= 0) {
    return "This scope has no verses to heart.";
  }
  if (covered <= 0) {
    return `None of these ${slots} verses are hearted yet. If you want to memorize ${togetherPhrase(chapterCount, false)} together, we can auto-heart them as short memory passages so you can start learning.`;
  }
  if (covered >= slots) {
    return `All ${slots} verses are already hearted.`;
  }
  return `${alreadyHeartedLead(covered, slots)} If you want to memorize ${togetherPhrase(chapterCount, true)} together, we can auto-heart the remaining verses as short memory passages so you can start learning.`;
}
