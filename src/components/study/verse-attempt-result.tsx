import { motion } from "framer-motion";
import type { JSX, ReactNode, Ref } from "react";

import { OverflowRegion } from "@/components/study/overflow-region";
import { diffWords, type DiffToken } from "@/lib/diff-words";
import type { MemorySchedule } from "@/lib/memory-scheduler";
import { READER_VERSE_TEXT_CLASS } from "@/lib/reader-typography";
import { cn } from "@/lib/utils";

import {
  classifyVerseAttempt,
  countAttemptErrors,
  verseAttemptAccuracy,
} from "./study-attempt-quality";
import { VerseMemoryFeedback } from "./verse-memory-feedback";

interface VerseAttemptResultProps {
  typedAnswer: string;
  versePlainText: string;
  diffTokens?: ReadonlyArray<DiffToken>;
  /** Review mode: close the result banner with the schedule consequence. */
  showScheduleOutcome?: boolean;
  /**
   * The graduating From Memory recall requires a perfect grade to bank. Passed
   * through to the close-attempt banner so it can explain why Continue is
   * still "Try again".
   */
  requireExactToAdvance?: boolean;
  nextSchedule?: MemorySchedule | null;
  now?: number;
  /** Trails the banner's percentage, e.g. "Pass at 85%". */
  note?: string;
  /** Replaces the usual praise line when this result has its own next step. */
  praiseLine?: string;
  scheduleHeld?: boolean;
  refresherOffer?: ReactNode;
  bannerRef?: Ref<HTMLDivElement>;
  /** Caps "How you did" so Continue stays close when the full text is also up. */
  scrollMaxClass?: string;
}

const PLACEHOLDER = "\u00a0";

function renderDiffChip(token: DiffToken, idx: number): JSX.Element {
  if (token.status === "match") {
    return (
      <span
        key={idx}
        className="inline-flex min-h-6 items-center rounded-md bg-emerald-500/10 px-1.5 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300"
      >
        {token.text}
      </span>
    );
  }

  const typedText = token.status === "missing" ? PLACEHOLDER : token.text;
  const expectedText =
    token.status === "extra"
      ? PLACEHOLDER
      : token.status === "mismatch" || token.status === "typo"
        ? (token.expectedText ?? PLACEHOLDER)
        : token.text;

  const baseRow = "min-h-6 rounded-md px-1.5 text-center text-[15px] leading-6";

  const typedClassName = cn(
    baseRow,
    (token.status === "mismatch" ||
      token.status === "typo" ||
      token.status === "extra") &&
      "bg-rose-500/10 text-rose-600 line-through decoration-rose-500/60 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300",
    token.status === "missing" &&
      "border border-dashed border-amber-500/60 text-transparent",
  );

  const expectedClassName = cn(
    baseRow,
    (token.status === "mismatch" ||
      token.status === "typo" ||
      token.status === "missing") &&
      "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-200",
    token.status === "extra" &&
      "border border-dashed border-rose-500/40 text-transparent",
  );

  const ariaLabel =
    token.status === "missing"
      ? `Missing word: ${token.text}`
      : token.status === "extra"
        ? `Extra word: ${token.text}`
        : token.status === "typo"
          ? `Small typo: ${token.text}${
              token.expectedText ? `, expected ${token.expectedText}` : ""
            }`
          : `Different word: ${token.text}${
              token.expectedText ? `, expected ${token.expectedText}` : ""
            }`;

  return (
    <span
      key={idx}
      className="inline-flex flex-col items-stretch gap-0.5 align-top"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className={typedClassName}>{typedText}</span>
      <span className={expectedClassName}>{expectedText}</span>
    </span>
  );
}

/** The percentage lives in the result banner, so the diff shows only a key. */
function VerseAttemptDiff({
  tokens,
}: {
  tokens: ReadonlyArray<DiffToken>;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span className="flex items-center gap-2 font-medium normal-case tracking-normal">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-emerald-500/40" />
            correct
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-rose-500/40" />
            you
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-amber-500/40" />
            verse
          </span>
        </span>
      </div>
      <p
        className={cn(
          "flex flex-wrap gap-x-1.5 gap-y-2",
          READER_VERSE_TEXT_CLASS,
        )}
      >
        {tokens.map((token, idx) => renderDiffChip(token, idx))}
      </p>
    </div>
  );
}

/** "How you did": the result banner and a word-by-word diff of a typed recall. */
export function VerseAttemptResult({
  typedAnswer,
  versePlainText,
  diffTokens: providedDiffTokens,
  showScheduleOutcome = false,
  requireExactToAdvance = false,
  nextSchedule = null,
  now,
  note,
  praiseLine,
  refresherOffer,
  bannerRef,
  scheduleHeld = false,
  scrollMaxClass = "max-h-[45vh]",
}: VerseAttemptResultProps): JSX.Element | null {
  const trimmedTyped = typedAnswer.trim();
  if (trimmedTyped.length === 0 || versePlainText.length === 0) return null;

  const diffTokens =
    providedDiffTokens ?? diffWords(typedAnswer, versePlainText);
  const attemptQuality = classifyVerseAttempt(diffTokens);
  const attemptAccuracy = verseAttemptAccuracy(diffTokens);
  const attemptErrors = countAttemptErrors(diffTokens);
  // Used as a motion key so the feedback banner re-plays its entrance when
  // the user tries a different attempt, but not on every keystroke.
  const attemptKey = trimmedTyped;

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      {attemptQuality ? (
        <div ref={bannerRef} className="scroll-mt-4">
          <VerseMemoryFeedback
            quality={attemptQuality}
            attemptKey={attemptKey}
            showScheduleOutcome={showScheduleOutcome}
            requireExactToAdvance={requireExactToAdvance}
            nextSchedule={nextSchedule}
            now={now}
            accuracy={attemptAccuracy}
            errors={attemptErrors}
            note={note}
            praiseLine={praiseLine}
            refresherOffer={refresherOffer}
            scheduleHeld={scheduleHeld}
          />
        </div>
      ) : null}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <OverflowRegion
          name="how-you-did"
          className={cn(
            scrollMaxClass,
            "space-y-3 rounded-xl border bg-card/60 px-4 py-3 shadow-sm backdrop-blur-sm",
            attemptQuality === "exact"
              ? "border-emerald-500/40"
              : attemptQuality === "close"
                ? "border-amber-500/40"
                : "border-primary/25",
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            How you did
          </p>
          <VerseAttemptDiff tokens={diffTokens} />
        </OverflowRegion>
      </motion.div>
    </div>
  );
}
