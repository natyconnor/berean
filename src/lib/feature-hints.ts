/**
 * Stable IDs for staged-onboarding hints. Keep IDs stable across releases so
 * persisted dismissals/completions in `userFeatureHints` continue to apply.
 *
 * Naming convention: `<feature>-<stage>` describes both what is being taught
 * and at which point in the journey it appears.
 */
export const FEATURE_HINTS = {
  /** Wave 1 inline-card teaching the `@` verse-link interaction. */
  VERSE_LINKS_AFTER_NOTES: "verse-links-after-notes",
  /** Wave 2 starter tag library suggestion after first tag use. */
  STARTER_TAGS_AFTER_FIRST_TAG: "starter-tags-after-first-tag",
  /** Wave 3 reveal callout pointing at the now-visible Study toolbar button. */
  STUDY_REVEAL_AFTER_FIRST_HEART: "study-reveal-after-first-heart",
  /** Wave 3 follow-up explanation shown the first time Study is opened. */
  STUDY_FIRST_OPEN_EXPLAINER: "study-first-open-explainer",
  /** Wave 4 reveal callout pointing at the now-visible Search toolbar button. */
  SEARCH_REVEAL_AFTER_LIBRARY: "search-reveal-after-library",
  /** Wave 5 callout that appears beside the newly-revealed Compose/Read toggle. */
  READING_MODE_REVEAL: "reading-mode-reveal",
} as const;

export type FeatureHintId = (typeof FEATURE_HINTS)[keyof typeof FEATURE_HINTS];
