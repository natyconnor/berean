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
  /**
   * Legacy first-heart Study reveal. Study now reveals on notes
   * (`STUDY_REVEAL_AFTER_NOTES`); this id is retained so any persisted
   * dismissals stay valid, but it is no longer surfaced.
   */
  STUDY_REVEAL_AFTER_FIRST_HEART: "study-reveal-after-first-heart",
  /** Memory reveal callout pointing at the Memory segment after the first heart. */
  MEMORY_REVEAL_AFTER_FIRST_HEART: "memory-reveal-after-first-heart",
  /** Study reveal callout pointing at the Study segment once enough notes exist. */
  STUDY_REVEAL_AFTER_NOTES: "study-reveal-after-notes",
  /** Follow-up explanation shown the first time Memory is opened. */
  MEMORY_FIRST_OPEN_EXPLAINER: "memory-first-open-explainer",
  /** Wave 3 follow-up explanation shown the first time Study is opened. */
  STUDY_FIRST_OPEN_EXPLAINER: "study-first-open-explainer",
  /** Wave 4 reveal callout pointing at the now-visible Search toolbar button. */
  SEARCH_REVEAL_AFTER_LIBRARY: "search-reveal-after-library",
  /** Wave 5 callout that appears beside the newly-revealed Compose/Read toggle. */
  READING_MODE_REVEAL: "reading-mode-reveal",
  /**
   * One-time launch announcement for the Memory overhaul + Mode Dock.
   * Shown only to accounts created before `MEMORY_LAUNCH_ANNOUNCEMENT_AFTER`.
   */
  MEMORY_LAUNCH_ANNOUNCEMENT: "memory-launch-announcement",
} as const;

export type FeatureHintId = (typeof FEATURE_HINTS)[keyof typeof FEATURE_HINTS];

export const HINT_QUEUE_COOLDOWN_MS = 1 * 60 * 1000;

/**
 * Accounts created before this timestamp are eligible for the Memory launch
 * announcement. July 16, 2026 6:00 AM Eastern (EDT, UTC-4).
 */
export const MEMORY_LAUNCH_ANNOUNCEMENT_AFTER = Date.UTC(2026, 6, 16, 10, 0, 0);

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
    [FEATURE_HINTS.MEMORY_REVEAL_AFTER_FIRST_HEART]: { priority: 85 },
    [FEATURE_HINTS.STUDY_REVEAL_AFTER_NOTES]: { priority: 75 },
    [FEATURE_HINTS.MEMORY_FIRST_OPEN_EXPLAINER]: { priority: 0 },
    [FEATURE_HINTS.STUDY_FIRST_OPEN_EXPLAINER]: { priority: 0 },
    [FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY]: { priority: 70 },
    [FEATURE_HINTS.READING_MODE_REVEAL]: { priority: 60 },
    [FEATURE_HINTS.MEMORY_LAUNCH_ANNOUNCEMENT]: { priority: 0 },
  };
