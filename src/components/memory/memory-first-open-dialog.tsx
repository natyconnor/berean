import { FEATURE_HINTS } from "@/lib/feature-hints";
import { FeatureInfoDialog } from "@/components/tutorial/feature-info-dialog";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";

/**
 * First-open Memory explainer. Like the Study explainer, it bypasses the global
 * feature hint queue because the user has already chosen to enter Memory, so
 * this is destination help rather than another dock reveal.
 */
export function MemoryFirstOpenDialog() {
  const memoryFirstOpenHint = useFeatureHint(
    FEATURE_HINTS.MEMORY_FIRST_OPEN_EXPLAINER,
    true,
    { useDisplayQueue: false },
  );

  return (
    <FeatureInfoDialog
      state={memoryFirstOpenHint}
      title="Welcome to Memory"
      description="Memory turns your hearted verses into a spaced-repetition practice you can grow over time."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Heart verses to add them here.</li>
          <li>Review what's due to keep them fresh.</li>
          <li>Make packs to focus on a set.</li>
        </ul>
      }
    />
  );
}
