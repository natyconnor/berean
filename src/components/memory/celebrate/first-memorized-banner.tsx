import { useEffect, useState, type JSX } from "react";
import { Check } from "lucide-react";

import type { SessionCompleteVerse } from "@/components/memory/practice/session-complete";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { firstMemorizedCopy } from "@/lib/memory-milestones";
import { cn } from "@/lib/utils";
import { formatVerseRefTitle } from "@/lib/verse-ref-utils";

import { useMilestoneHint } from "./use-milestone-hint";

/**
 * "{ref} is memorized." on the session summary, the first time any verse
 * moves into review. Shown once ever: it completes its hint when it appears.
 */
export function FirstMemorizedBanner({
  verses,
  className,
}: {
  verses: ReadonlyArray<SessionCompleteVerse>;
  className?: string;
}): JSX.Element | null {
  const { pending, complete } = useMilestoneHint(
    FEATURE_HINTS.CELEBRATE_FIRST_VERSE,
  );
  const memorized = verses.find((verse) => verse.justMemorized);
  // Latched so the banner stays up after `complete` clears `pending`.
  const [reference, setReference] = useState<string | null>(null);
  if (reference === null && memorized && pending) {
    setReference(formatVerseRefTitle(memorized.reference));
  }

  useEffect(() => {
    if (reference !== null) complete();
  }, [complete, reference]);

  if (reference === null) return null;
  const { lead, rest } = firstMemorizedCopy(reference);
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-left",
        className,
      )}
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
        <Check className="size-3.5" aria-hidden />
      </span>
      <p className="text-sm leading-snug">
        <b className="font-semibold">{lead}</b> {rest}
      </p>
    </div>
  );
}
