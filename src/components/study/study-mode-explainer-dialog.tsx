import { FEATURE_HINTS } from "@/lib/feature-hints";
import { FeatureInfoDialog } from "@/components/tutorial/feature-info-dialog";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";

/**
 * First-open Study explainer. It intentionally bypasses the global feature
 * hint queue because the user has already chosen to enter Study, so this is
 * destination help rather than another toolbar reveal.
 */
export function StudyModeExplainerDialog() {
  const studyFirstOpenHint = useFeatureHint(
    FEATURE_HINTS.STUDY_FIRST_OPEN_EXPLAINER,
    true,
    { useDisplayQueue: false },
  );

  return (
    <FeatureInfoDialog
      state={studyFirstOpenHint}
      title="Welcome to Study"
      description="Study turns the verses you've hearted and the notes you've taken into focused review sessions."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Review the verses you've hearted with Verse Memory.</li>
          <li>Summarize the notes you've taken on a passage.</li>
          <li>Practice teaching what you've learned.</li>
        </ul>
      }
    />
  );
}
