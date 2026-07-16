import { describe, expect, it, vi } from "vitest";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { STUDY_MIN_NOTES } from "@/lib/staged-onboarding-thresholds";
import { isStudyFeatureAccessible } from "@/lib/study-feature-access";

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn(),
  FEATURE_FLAGS: { study: false },
}));

const milestones = {
  notesCount: STUDY_MIN_NOTES,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

describe("isStudyFeatureAccessible", () => {
  it("returns false when the study feature flag is disabled", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);

    expect(isStudyFeatureAccessible(milestones)).toBe(false);
    expect(isFeatureEnabled).toHaveBeenCalledWith("study");
  });

  it("returns false when the flag is enabled but milestones are not met", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);

    expect(
      isStudyFeatureAccessible({
        ...milestones,
        notesCount: STUDY_MIN_NOTES - 1,
      }),
    ).toBe(false);
  });

  it("returns true when the flag is enabled and milestones are met", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);

    expect(isStudyFeatureAccessible(milestones)).toBe(true);
  });
});
