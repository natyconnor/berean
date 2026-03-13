import { describe, expect, it } from "vitest"

import { resolveTutorialStatus } from "../../convex/lib/tutorial"

describe("resolveTutorialStatus", () => {
  it("returns default tutorial flags for a new user", () => {
    expect(resolveTutorialStatus(null)).toEqual({
      needsStarterTagsSetup: true,
      starterTagsSetupCompletedAt: undefined,
      mainTutorialCompletedAt: undefined,
      advancedSearchTutorialCompletedAt: undefined,
      categoryColors: {},
    })
  })

  it("preserves tutorial and starter tag completion state independently", () => {
    expect(
      resolveTutorialStatus({
        starterTagsSetupCompletedAt: 10,
        mainOnboardingCompletedAt: 20,
        advancedSearchOnboardingCompletedAt: 30,
        starterTagCategoryColors: { themes: "#abcdef" },
      }),
    ).toEqual({
      needsStarterTagsSetup: false,
      starterTagsSetupCompletedAt: 10,
      mainTutorialCompletedAt: 20,
      advancedSearchTutorialCompletedAt: 30,
      categoryColors: { themes: "#abcdef" },
    })
  })
})
