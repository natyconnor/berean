import { useEffect, useRef, useState, type JSX } from "react";
import { useMutation } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import type { CompositePassageSegment } from "@/hooks/use-esv-composite-passage";
import { devLog } from "@/lib/dev-log";
import {
  passageMomentDays,
  passageMomentHeadline,
  passageMomentStats,
} from "@/lib/memory-milestones";
import {
  READER_MEASURE_CLASS,
  READER_REFERENCE_CLASS,
  SESSION_VERSE_TEXT_CLASS,
} from "@/lib/reader-typography";
import { cn } from "@/lib/utils";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const EASE = [0.22, 1, 0.36, 1] as const;

interface PassageCompleteMomentProps {
  packId: Id<"packs">;
  /** "Psalm 23". */
  title: string;
  verseCount: number;
  /** The passage row's creation time, for "{d} days". */
  createdAt: number;
  /** The passage text, one segment per learned piece, in order. */
  segments: readonly CompositePassageSegment[];
  onDone: () => void;
}

/**
 * Full screen, once per passage, when the last verse joins: the whole
 * passage fades in, in reader type. Quiet on purpose: no confetti, and with
 * reduced motion it simply appears. Marks the passage celebrated when shown.
 */
export function PassageCompleteMoment({
  packId,
  title,
  verseCount,
  createdAt,
  segments,
  onDone,
}: PassageCompleteMomentProps): JSX.Element {
  const reduceMotion = useReducedMotion() ?? false;
  const markCelebrated = useMutation(api.passageMemory.markCelebrated);
  const [shownAt] = useState(() => Date.now());
  const contentRef = useRef<HTMLDivElement>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markCelebrated({ packId }).catch((error: unknown) => {
      devLog.warn("passageMemory", "markCelebrated failed", error);
    });
  }, [markCelebrated, packId]);

  const days = passageMomentDays(
    createdAt,
    shownAt,
    new Date(shownAt).getTimezoneOffset(),
  );
  const multiChapter =
    new Set(segments.map((segment) => segment.reference.chapter)).size > 1;

  const fade = (delay: number, duration: number) =>
    reduceMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration, ease: EASE },
        };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            // Land on the moment itself, not Done, so a lingering Enter from
            // the last Continue doesn't close it before it's read.
            event.preventDefault();
            contentRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-10 text-center sm:pt-20">
              <motion.div {...fade(0, 0.5)} className="space-y-2">
                <DialogPrimitive.Title
                  className={cn(
                    READER_REFERENCE_CLASS,
                    "text-2xl text-balance sm:text-3xl",
                  )}
                >
                  {passageMomentHeadline(title)}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm tabular-nums text-muted-foreground">
                  {passageMomentStats(verseCount, days)}
                </DialogPrimitive.Description>
              </motion.div>
              <motion.div
                {...fade(0.35, 1.1)}
                className={cn(
                  "mt-10 text-left text-foreground/90",
                  SESSION_VERSE_TEXT_CLASS,
                  READER_MEASURE_CLASS,
                )}
              >
                {segments.map((segment) => (
                  <span key={segmentKey(segment)}>
                    <sup className="mr-1 font-sans text-[0.6em] font-semibold text-muted-foreground tabular-nums">
                      {multiChapter
                        ? `${segment.reference.chapter}:${segment.reference.startVerse}`
                        : segment.reference.startVerse}
                    </sup>
                    {segment.text}{" "}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
          <div className="shrink-0 border-t bg-background/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex w-full max-w-2xl justify-center">
              <Button
                type="button"
                onClick={onDone}
                className="h-11 w-full sm:w-auto sm:min-w-32"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function segmentKey(segment: CompositePassageSegment): string {
  const { book, chapter, startVerse, endVerse } = segment.reference;
  return `${book}:${chapter}:${startVerse}-${endVerse}`;
}
