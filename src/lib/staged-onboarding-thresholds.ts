/**
 * Centralized thresholds for the staged onboarding system.
 *
 * Tune these constants to adjust when feature reveals fire. Keep them as named
 * exports so they can be referenced from tests, copy, and analytics.
 */

/**
 * Minimum total notes before introducing inline `@` verse links. The non-obvious
 * `@` interaction is unlikely to be discovered, so it's surfaced after the user
 * is comfortable enough to have written a couple of notes.
 */
export const VERSE_LINKS_MIN_NOTES = 2;

/**
 * Minimum tagged notes before suggesting the starter tag library. We trigger
 * after the user has used tags themselves, so they understand what tags are for
 * before being offered a curated set.
 */
export const STARTER_TAGS_MIN_TAGGED_NOTES = 1;

/**
 * Minimum hearted verses before revealing Study in the toolbar. Verse Memory is
 * powered by hearts, so the first heart unlocks the entire Study workspace.
 */
export const STUDY_MIN_HEARTS = 1;

/**
 * Note library thresholds for revealing Search in the toolbar. Search becomes
 * meaningful once there are enough notes (or enough tagged notes) to query.
 */
export const SEARCH_MIN_NOTES_TOTAL = 8;
export const SEARCH_MIN_NOTES_WITH_TAGS = 5;
export const SEARCH_MIN_DISTINCT_TAGS = 2;

/**
 * Library thresholds for revealing Reading Mode. Reading Mode is most useful
 * when there are several notes to review beside the passage text.
 */
export const READING_MIN_TOTAL_NOTES = 12;
export const READING_MIN_CHAPTER_NOTES = 5;
export const READING_MIN_NOTES_PER_VERSE = 2;

/**
 * Library snapshot returned by the onboarding status query. Counts are bounded
 * (e.g. via `.take(N + 1)`) so consumers can safely treat them as comparators
 * against thresholds without paying for full library scans.
 */
export interface OnboardingMilestones {
  notesCount: number;
  taggedNotesCount: number;
  distinctTagCount: number;
  heartsCount: number;
  hasInlineVerseLink: boolean;
  hasExplicitVerseLink: boolean;
  starterTagCount: number;
  customTagCount: number;
}

/** Was Wave 1 (verse-link education) reached based on library state? */
export function shouldRevealVerseLinks(
  milestones: OnboardingMilestones,
): boolean {
  return (
    milestones.notesCount >= VERSE_LINKS_MIN_NOTES &&
    !milestones.hasInlineVerseLink &&
    !milestones.hasExplicitVerseLink
  );
}

/** Was Wave 2 (starter tags) reached based on library state? */
export function shouldRevealStarterTags(
  milestones: OnboardingMilestones,
): boolean {
  return (
    milestones.taggedNotesCount >= STARTER_TAGS_MIN_TAGGED_NOTES &&
    milestones.starterTagCount === 0
  );
}

/** Was Wave 3 (Study reveal) reached based on library state? */
export function shouldRevealStudy(milestones: OnboardingMilestones): boolean {
  return milestones.heartsCount >= STUDY_MIN_HEARTS;
}

/** Was Wave 4 (Search reveal) reached based on library state? */
export function shouldRevealSearch(milestones: OnboardingMilestones): boolean {
  if (milestones.notesCount >= SEARCH_MIN_NOTES_TOTAL) return true;
  if (
    milestones.notesCount >= SEARCH_MIN_NOTES_WITH_TAGS &&
    milestones.distinctTagCount >= SEARCH_MIN_DISTINCT_TAGS
  ) {
    return true;
  }
  return false;
}

/**
 * Was Wave 5 (Reading Mode) reached based on library state? Chapter-specific
 * checks live with the passage view because they depend on the current chapter.
 */
export function shouldRevealReadingMode(
  milestones: OnboardingMilestones,
  chapterContext?: { chapterNotesCount: number; maxNotesPerVerse: number },
): boolean {
  if (milestones.notesCount >= READING_MIN_TOTAL_NOTES) return true;
  if (!chapterContext) return false;
  if (chapterContext.chapterNotesCount >= READING_MIN_CHAPTER_NOTES)
    return true;
  if (chapterContext.maxNotesPerVerse >= READING_MIN_NOTES_PER_VERSE) {
    return true;
  }
  return false;
}
