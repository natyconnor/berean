/**
 * Shared labels for hearting an *ineligible* incomplete scope pack: the
 * pack-view CTA, its tooltip, the pointer shown after create, and the heart
 * dialog. Eligible packs must not use {@link HEART_SCOPE_ACTION_LABEL} — they
 * stay collections until the user starts passage mode.
 */

export const HEART_SCOPE_ACTION_LABEL = "Memorize whole passage";

/** Eligible pack-view CTA. Never reuse {@link HEART_SCOPE_ACTION_LABEL} here. */
export const LEARN_AS_PASSAGE_LABEL = "Learn as a passage";

/** Removes the passage row; pack returns to a heart collection. */
export const STOP_PASSAGE_LEARNING_LABEL = "Stop passage learning";

/** Builder shortcut for eligible scopes. Still creates a normal collection. */
export const CREATE_AND_START_PASSAGE_LABEL = "Create and memorize as a whole";

/** Explains the normal Create pack action on the builder name step. */
export const CREATE_PACK_TOOLTIP =
  "Creates a normal scoped pack that auto-adds hearted verses within the scope.";

/** Explains the eligible-scope passage shortcut on the builder name step. */
export const CREATE_AND_MEMORIZE_WHOLE_TOOLTIP =
  "Memorizes this pack as one singular passage.";

/** Pack-view CTA once a passage row exists but no verse has been started. */
export const START_LEARNING_LABEL = "Start Learning";

/** Pack-view CTA once at least one verse is in progress. */
export const CONTINUE_PASSAGE_LABEL = "Continue";

export function passageLearnButtonLabel(
  pieces: readonly { attachment: string }[],
): string {
  return pieces.some((piece) => piece.attachment !== "unreached")
    ? CONTINUE_PASSAGE_LABEL
    : START_LEARNING_LABEL;
}

/** Invitation copy; no trailing period so tooltip and create-pointer stay identical. */
export const HEART_SCOPE_TOOLTIP =
  "Want to memorize this whole passage? Click here to automatically heart all the verses";

export function heartScopeHasExisting(coveredVerseCount: number): boolean {
  return coveredVerseCount > 0;
}

/** Auto-heart CTA. Callers must not use this for passage-eligible packs. */
export function heartScopeActionLabel(): string {
  return HEART_SCOPE_ACTION_LABEL;
}

/**
 * Optional builder control. Eligible packs get the start-passage shortcut;
 * ineligible incomplete packs keep today's Create-only + auto-heart path.
 */
export function packBuilderStartPassageLabel(
  passageEligible: boolean,
): string | null {
  return passageEligible ? CREATE_AND_START_PASSAGE_LABEL : null;
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
