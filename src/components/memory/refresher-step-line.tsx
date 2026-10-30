import type { JSX } from "react";

import { FIRST_LETTERS_HINT_LABEL, stepShortLabel } from "@/lib/memory-copy";
import { cn } from "@/lib/utils";
import type { RefreshStep } from "@/lib/memory-way-back";

export function RefresherStepLine({
  step,
}: {
  step: RefreshStep;
}): JSX.Element {
  const fromMemory = `${stepShortLabel(3)} · 2 of 2`;
  return (
    <p className="text-xs tabular-nums text-muted-foreground">
      <span className={cn(step === 2 && "text-foreground")}>
        {step === 2
          ? `✓ ${FIRST_LETTERS_HINT_LABEL}`
          : `${FIRST_LETTERS_HINT_LABEL} · 1 of 2`}
      </span>
      <span aria-hidden className="px-2">
        {" "}
      </span>
      <span className={cn(step === 1 && "text-muted-foreground")}>
        {fromMemory}
      </span>
    </p>
  );
}
