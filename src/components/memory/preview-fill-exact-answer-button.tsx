import { WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isPreviewTestToolsEnabled } from "@/lib/preview-test-tools";

/**
 * Preview/dev only: paste the loaded verse text into the recall box so
 * Memory flows can be checked without typing.
 */
export function PreviewFillExactAnswerButton({
  versePlainText,
  onFill,
  disabled = false,
  enabled = isPreviewTestToolsEnabled(),
}: {
  versePlainText: string;
  onFill: (text: string) => void;
  disabled?: boolean;
  enabled?: boolean;
}) {
  if (!enabled) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-amber-500/40 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-200"
      onClick={() => onFill(versePlainText)}
      disabled={disabled || versePlainText.trim().length === 0}
    >
      <WandSparkles className="h-4 w-4" aria-hidden />
      Fill exact answer
    </Button>
  );
}
