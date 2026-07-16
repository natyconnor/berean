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
      description="Memory helps you store up your hearted verses and carry them with you."
      body={
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Heart verses to see them here.</li>
          <li>Review verses to master them over time.</li>
          <li>Build packs of verses to focus on sections or themes.</li>
        </ul>
      }
    />
  );
}
