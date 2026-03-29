import { describe, expect, it } from "vitest";

import { shouldRedirectToSettings } from "./tutorial-settings-redirect";

describe("shouldRedirectToSettings", () => {
  it("suppresses the redirect after the main tutorial is skipped", () => {
    expect(
      shouldRedirectToSettings({
        isSettingsRoute: false,
        needsStarterTagsSetup: true,
        mainTutorialCompletedAt: 1,
        activeTutorialTour: null,
        suppressRedirectAfterSkip: true,
      }),
    ).toBe(false);
  });

  it("redirects when setup is incomplete after the main tutorial finishes", () => {
    expect(
      shouldRedirectToSettings({
        isSettingsRoute: false,
        needsStarterTagsSetup: true,
        mainTutorialCompletedAt: 1,
        activeTutorialTour: null,
        suppressRedirectAfterSkip: false,
      }),
    ).toBe(true);
  });
});
