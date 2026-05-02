interface UserSettingsStatusInput {
  mainOnboardingCompletedAt?: number;
  advancedSearchOnboardingCompletedAt?: number;
  focusModeOnboardingCompletedAt?: number;
  starterTagCategoryColors?: Record<string, string>;
}

export interface TutorialStatus {
  mainTutorialCompletedAt?: number;
  advancedSearchTutorialCompletedAt?: number;
  focusModeTutorialCompletedAt?: number;
  categoryColors: Record<string, string>;
}

export function resolveTutorialStatus(
  settings: UserSettingsStatusInput | null | undefined,
): TutorialStatus {
  return {
    mainTutorialCompletedAt: settings?.mainOnboardingCompletedAt,
    advancedSearchTutorialCompletedAt:
      settings?.advancedSearchOnboardingCompletedAt,
    focusModeTutorialCompletedAt: settings?.focusModeOnboardingCompletedAt,
    categoryColors: settings?.starterTagCategoryColors ?? {},
  };
}
