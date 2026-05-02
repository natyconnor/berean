import { describe, expect, it } from "vitest";

import { resolveTutorialStatus } from "../../convex/lib/tutorial";

describe("resolveTutorialStatus", () => {
  it("returns default tutorial flags for a new user", () => {
    expect(resolveTutorialStatus(null)).toEqual({
      mainTutorialCompletedAt: undefined,
      advancedSearchTutorialCompletedAt: undefined,
      focusModeTutorialCompletedAt: undefined,
      categoryColors: {},
    });
  });

  it("preserves tutorial completion state and starter tag category colors", () => {
    expect(
      resolveTutorialStatus({
        mainOnboardingCompletedAt: 20,
        advancedSearchOnboardingCompletedAt: 30,
        focusModeOnboardingCompletedAt: 40,
        starterTagCategoryColors: { themes: "#abcdef" },
      }),
    ).toEqual({
      mainTutorialCompletedAt: 20,
      advancedSearchTutorialCompletedAt: 30,
      focusModeTutorialCompletedAt: 40,
      categoryColors: { themes: "#abcdef" },
    });
  });
});
