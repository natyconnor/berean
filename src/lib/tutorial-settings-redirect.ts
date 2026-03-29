interface ShouldRedirectToSettingsArgs {
  isSettingsRoute: boolean;
  needsStarterTagsSetup: boolean | null | undefined;
  mainTutorialCompletedAt: number | undefined;
  activeTutorialTour: "main" | "search" | "focusMode" | null;
  suppressRedirectAfterSkip: boolean;
}

export function shouldRedirectToSettings({
  isSettingsRoute,
  needsStarterTagsSetup,
  mainTutorialCompletedAt,
  activeTutorialTour,
  suppressRedirectAfterSkip,
}: ShouldRedirectToSettingsArgs): boolean {
  return (
    !isSettingsRoute &&
    needsStarterTagsSetup === true &&
    mainTutorialCompletedAt !== undefined &&
    activeTutorialTour !== "main" &&
    !suppressRedirectAfterSkip
  );
}
