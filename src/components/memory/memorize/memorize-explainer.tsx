import { Fragment, useId, type ReactNode } from "react";

import {
  useEsvReference,
  type ReferenceQuery,
} from "@/hooks/use-esv-reference";
import type { MemorizeMode } from "@/lib/memorize-plan";
import { PASSAGE_MAX_ADDS_PER_DAY } from "@/lib/passage-frontier";
import { maskVerseText } from "@/lib/verse-hint";

/** Words of the verse each sample shows before trailing off. */
const SAMPLE_WORDS = 9;

const PSALM_1_SAMPLES = {
  firstLetters: "B____ i_ t__ m__ w__ w____ n__ i_ t__ c______…",
  blanks: (
    <>
      Blessed is the <Blank /> who walks not in the <Blank /> of the wicked…
    </>
  ),
};

/** Step 1 and Step 2 samples from the start of the verse being memorized. */
function verseSamples(text: string): typeof PSALM_1_SAMPLES | null {
  const words = text.replace(/[“”"]/g, "").split(/\s+/).filter(Boolean);
  if (words.length < 4) return null;
  const shown = words.slice(0, SAMPLE_WORDS);
  const more = words.length > shown.length ? "…" : "";
  return {
    firstLetters:
      maskVerseText(shown.join(" "), "first-letters")
        .map((token) => token.text)
        .join("") + more,
    blanks: (
      <>
        {shown.map((word, index) => (
          <Fragment key={index}>
            {index > 0 ? " " : null}
            {index % 3 === 2 ? <Blank /> : word}
          </Fragment>
        ))}
        {more}
      </>
    ),
  };
}

function Blank() {
  return (
    <span className="inline-block w-8 border-b border-current align-baseline" />
  );
}

/**
 * "How memorizing works": the three daily steps with tiny samples, shown in the
 * Memorize sheet until the first successful start.
 */
export function MemorizeExplainer({
  mode,
  sample,
}: {
  mode: MemorizeMode;
  /** The verse the samples are drawn from; Psalm 1 until its text loads. */
  sample?: ReferenceQuery;
}) {
  const headingId = useId();
  const { data } = useEsvReference(sample ?? null);
  const text = data?.verses.map((verse) => verse.text.trim()).join(" ") ?? "";
  const samples = verseSamples(text) ?? PSALM_1_SAMPLES;
  const steps: readonly { step: number; name: string; sample: ReactNode }[] = [
    {
      step: 1,
      name: "Read it, then first letters",
      sample: <span aria-hidden>{samples.firstLetters}</span>,
    },
    {
      step: 2,
      name: "Fill in the blanks",
      sample: <span aria-hidden>{samples.blanks}</span>,
    },
    {
      step: 3,
      name: "Say it from memory",
      sample: (
        <span className="text-muted-foreground italic">
          No hints. Type what you remember.
        </span>
      ),
    },
  ];
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
        {steps.map((step) => (
          <li
            key={step.step}
            className="rounded-md border border-primary/20 bg-background px-2.5 py-2"
          >
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
              Step {step.step}
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
        One short step a day.{" "}
        {mode === "passage"
          ? `Longer passages add up to ${PASSAGE_MAX_ADDS_PER_DAY} new verses a day. `
          : null}
        {gaps}
      </p>
    </section>
  );
}
