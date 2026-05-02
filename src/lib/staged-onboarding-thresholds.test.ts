import { describe, expect, it } from "vitest";

import {
  READING_MIN_CHAPTER_NOTES,
  READING_MIN_NOTES_PER_VERSE,
  READING_MIN_TOTAL_NOTES,
  SEARCH_MIN_DISTINCT_TAGS,
  SEARCH_MIN_NOTES_TOTAL,
  SEARCH_MIN_NOTES_WITH_TAGS,
  STARTER_TAGS_MIN_TAGGED_NOTES,
  STUDY_MIN_HEARTS,
  VERSE_LINKS_MIN_NOTES,
  shouldRevealReadingMode,
  shouldRevealSearch,
  shouldRevealStarterTags,
  shouldRevealStudy,
  shouldRevealVerseLinks,
  type OnboardingMilestones,
} from "./staged-onboarding-thresholds";

function milestones(
  overrides: Partial<OnboardingMilestones> = {},
): OnboardingMilestones {
  return {
    notesCount: 0,
    taggedNotesCount: 0,
    distinctTagCount: 0,
    heartsCount: 0,
    hasInlineVerseLink: false,
    hasExplicitVerseLink: false,
    starterTagCount: 0,
    customTagCount: 0,
    ...overrides,
  };
}

describe("staged onboarding thresholds", () => {
  it("reveals verse links after enough notes unless a verse link already exists", () => {
    expect(
      shouldRevealVerseLinks(milestones({ notesCount: VERSE_LINKS_MIN_NOTES })),
    ).toBe(true);
    expect(
      shouldRevealVerseLinks(
        milestones({
          notesCount: VERSE_LINKS_MIN_NOTES,
          hasInlineVerseLink: true,
        }),
      ),
    ).toBe(false);
    expect(
      shouldRevealVerseLinks(
        milestones({
          notesCount: VERSE_LINKS_MIN_NOTES,
          hasExplicitVerseLink: true,
        }),
      ),
    ).toBe(false);
  });

  it("reveals starter tags after tag use until starter tags are installed", () => {
    expect(
      shouldRevealStarterTags(
        milestones({ taggedNotesCount: STARTER_TAGS_MIN_TAGGED_NOTES }),
      ),
    ).toBe(true);
    expect(
      shouldRevealStarterTags(
        milestones({
          taggedNotesCount: STARTER_TAGS_MIN_TAGGED_NOTES,
          starterTagCount: 1,
        }),
      ),
    ).toBe(false);
  });

  it("reveals Study after the first hearted verse", () => {
    expect(
      shouldRevealStudy(milestones({ heartsCount: STUDY_MIN_HEARTS })),
    ).toBe(true);
    expect(shouldRevealStudy(milestones({ heartsCount: 0 }))).toBe(false);
  });

  it("reveals Search by total notes or by a smaller tagged library", () => {
    expect(
      shouldRevealSearch(milestones({ notesCount: SEARCH_MIN_NOTES_TOTAL })),
    ).toBe(true);
    expect(
      shouldRevealSearch(
        milestones({
          notesCount: SEARCH_MIN_NOTES_WITH_TAGS,
          distinctTagCount: SEARCH_MIN_DISTINCT_TAGS,
        }),
      ),
    ).toBe(true);
    expect(
      shouldRevealSearch(
        milestones({
          notesCount: SEARCH_MIN_NOTES_WITH_TAGS,
          distinctTagCount: SEARCH_MIN_DISTINCT_TAGS - 1,
        }),
      ),
    ).toBe(false);
  });

  it("reveals Reading Mode by library or current chapter density", () => {
    expect(
      shouldRevealReadingMode(
        milestones({ notesCount: READING_MIN_TOTAL_NOTES }),
      ),
    ).toBe(true);
    expect(
      shouldRevealReadingMode(milestones(), {
        chapterNotesCount: READING_MIN_CHAPTER_NOTES,
        maxNotesPerVerse: 0,
      }),
    ).toBe(true);
    expect(
      shouldRevealReadingMode(milestones(), {
        chapterNotesCount: 0,
        maxNotesPerVerse: READING_MIN_NOTES_PER_VERSE,
      }),
    ).toBe(true);
    expect(
      shouldRevealReadingMode(milestones(), {
        chapterNotesCount: READING_MIN_CHAPTER_NOTES - 1,
        maxNotesPerVerse: READING_MIN_NOTES_PER_VERSE - 1,
      }),
    ).toBe(false);
  });
});
