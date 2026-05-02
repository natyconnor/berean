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

export const HINT_QUEUE_COOLDOWN_MS = 1 * 60 * 1000;

export interface FeatureHintMetadata {
  /**
   * Higher-priority hints win when multiple eligible surfaces are mounted at
   * the same time. Request order is used only as a tie-breaker.
   */
  priority: number;
}

export const FEATURE_HINT_METADATA: Record<FeatureHintId, FeatureHintMetadata> =
  {
    [FEATURE_HINTS.VERSE_LINKS_AFTER_NOTES]: { priority: 50 },
    [FEATURE_HINTS.STARTER_TAGS_AFTER_FIRST_TAG]: { priority: 40 },
    [FEATURE_HINTS.STUDY_REVEAL_AFTER_FIRST_HEART]: { priority: 80 },
    [FEATURE_HINTS.STUDY_FIRST_OPEN_EXPLAINER]: { priority: 0 },
    [FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY]: { priority: 70 },
    [FEATURE_HINTS.READING_MODE_REVEAL]: { priority: 60 },
  };
