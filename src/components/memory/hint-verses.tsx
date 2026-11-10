import type { JSX } from "react";

import { cn } from "@/lib/utils";
import type { VerseHint } from "@/lib/verse-hint";

/** Space above a verse: a small gap after a verse, a larger one at a chapter. */
export const VERSE_GAP_CLASS = "mt-[0.5em]";
export const CHAPTER_GAP_CLASS = "mt-[1.5em]";

/** A paragraph break inside a verse reads as one line break, never a blank line. */
function inVerseBreaks(text: string): string {
  return text.replace(/\n(?:[ \t]*\n)+/g, "\n");
}

/**
 * A hint, one paragraph per verse: a small gap between verses, a larger gap
 * where the chapter changes, and no gap around a single verse. The gaps are
 * block spacing, so wrapped lines keep normal line spacing at the left edge.
 */
export function HintVerses({
  verses,
  label,
}: {
  verses: readonly VerseHint[];
  label?: string;
}): JSX.Element {
  return (
    <div className="whitespace-pre-wrap" aria-label={label}>
      {verses.map((verse, verseIndex) => {
        const previous = verses[verseIndex - 1];
        return (
          <p
            key={verseIndex}
            className={cn(
              previous &&
                (previous.chapter === verse.chapter
                  ? VERSE_GAP_CLASS
                  : CHAPTER_GAP_CLASS),
            )}
          >
            {verse.tokens.map((token, index) => (
              <span
                key={index}
                className={cn(
                  token.masked &&
                    "font-mono tracking-wide text-muted-foreground",
                )}
              >
                {inVerseBreaks(token.text)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
