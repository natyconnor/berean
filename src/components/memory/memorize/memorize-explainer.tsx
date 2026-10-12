import { useId, type ReactNode } from "react";

import type { MemorizeMode } from "@/lib/memorize-plan";
import { PASSAGE_MAX_ADDS_PER_DAY } from "@/lib/passage-frontier";

const STEPS: readonly { day: number; name: string; sample: ReactNode }[] = [
  {
    day: 1,
    name: "Read it, then first letters",
    sample: (
      <span aria-hidden>B____ i_ t__ m__ w__ w____ n__ i_ t__ c______…</span>
    ),
  },
  {
    day: 2,
    name: "Fill in the blanks",
    sample: (
      <span aria-hidden>
        Blessed is the <Blank /> who walks not in the <Blank /> of the wicked…
      </span>
    ),
  },
  {
    day: 3,
    name: "Say it from memory",
    sample: (
      <span className="text-muted-foreground italic">
        No hints. Type what you remember.
      </span>
    ),
  },
];

function Blank() {
  return (
    <span className="inline-block w-8 border-b border-current align-baseline" />
  );
}

/**
 * "How memorizing works": the three daily steps with tiny samples, shown in the
 * Memorize sheet until the first successful start.
 */
export function MemorizeExplainer({ mode }: { mode: MemorizeMode }) {
  const headingId = useId();
  const gaps =
    mode === "verse"
      ? "Then it comes back at growing gaps so it sticks."
      : "Each verse then comes back at growing gaps so it sticks.";

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border bg-muted/40 p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-[13px] font-semibold">
          How memorizing works
        </h3>
        <span className="text-xs text-muted-foreground">
          Shown the first time
        </span>
      </div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.day}
            className="rounded-md border border-primary/20 bg-background px-2.5 py-2"
          >
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
              Day {step.day}
            </span>
            <span className="mt-0.5 block text-[13px] font-medium">
              {step.name}
            </span>
            <span className="mt-1 block font-serif text-xs leading-relaxed">
              {step.sample}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {mode === "passage"
          ? `Longer passages add up to ${PASSAGE_MAX_ADDS_PER_DAY} new verses a day. `
          : null}
        {gaps}
      </p>
    </section>
  );
}
