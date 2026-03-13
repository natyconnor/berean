interface UserSettingsStatusInput {
  starterTagsSetupCompletedAt?: number;
  mainOnboardingCompletedAt?: number;
  advancedSearchOnboardingCompletedAt?: number;
  starterTagCategoryColors?: Record<string, string>;
}

export interface TutorialStatus {
  needsStarterTagsSetup: boolean;
  starterTagsSetupCompletedAt?: number;
  mainTutorialCompletedAt?: number;
  advancedSearchTutorialCompletedAt?: number;
  categoryColors: Record<string, string>;
}

export function resolveTutorialStatus(
  settings: UserSettingsStatusInput | null | undefined,
): TutorialStatus {
  return {
    needsStarterTagsSetup: settings?.starterTagsSetupCompletedAt === undefined,
    starterTagsSetupCompletedAt: settings?.starterTagsSetupCompletedAt,
    mainTutorialCompletedAt: settings?.mainOnboardingCompletedAt,
    advancedSearchTutorialCompletedAt:
      settings?.advancedSearchOnboardingCompletedAt,
    categoryColors: settings?.starterTagCategoryColors ?? {},
  };
}
