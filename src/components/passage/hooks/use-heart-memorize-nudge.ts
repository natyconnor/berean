import { useCallback, useState } from "react";

import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { logInteraction } from "@/lib/dev-log";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { formatSpanTitle } from "@/lib/memorize-target";

/** A chapter heart as the nudge needs it (from `savedVerses.listForChapter`). */
export type NudgeHeart = {
  startVerse: number;
  endVerse: number;
  memory?: { inMemory: boolean };
  passageMemoryId?: string;
};

export type HeartNudgeOffer = {
  span: VerseSpan;
  /** "Psalm 1:5". */
  title: string;
  anchor: HTMLElement;
};

/** Marks the nudge's own content, which may still be animating closed. */
export const HEART_NUDGE_ATTRIBUTE = "data-heart-nudge";

/**
 * Overlays the nudge must not stack on: popovers (except tooltips and the
 * nudge itself), dialogs, and the highlight toolbar and mark popover.
 */
const OTHER_OVERLAY_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  "[role='dialog']",
  "[role='alertdialog']",
  "[data-highlight-toolbar]",
  "[data-highlight-popover]",
].join(", ");

function anotherOverlayOpen(): boolean {
  return Array.from(document.querySelectorAll(OTHER_OVERLAY_SELECTOR)).some(
    (element) =>
      !element.matches(`[${HEART_NUDGE_ATTRIBUTE}]`) &&
      !element.querySelector(`[role='tooltip'], [${HEART_NUDGE_ATTRIBUTE}]`),
  );
}

/**
 * True when one heart that is being memorized contains the whole span: an
 * in-Memory heart, or a passage heart.
 */
export function isSpanMemorizing(
  startVerse: number,
  endVerse: number,
  hearts: readonly NudgeHeart[],
): boolean {
  return hearts.some(
    (heart) =>
      (heart.passageMemoryId !== undefined ||
        heart.memory?.inMemory === true) &&
      heart.startVerse <= startVerse &&
      endVerse <= heart.endVerse,
  );
}

/**
 * The "Memorize it?" popover after a heart. It is offered after every heart
 * of something not being memorized until the user picks Don't ask again.
 */
export function useHeartMemorizeNudge({
  suppressed,
}: {
  /** Focus mode or a tour: never offer. */
  suppressed: boolean;
}) {
  const hint = useFeatureHint(FEATURE_HINTS.HEART_MEMORIZE_NUDGE, true, {
    useDisplayQueue: false,
  });
  const { pending, markShown, dismiss } = hint;
  const memorizeSheet = useMemorizeSheet();
  const [offer, setOffer] = useState<HeartNudgeOffer | null>(null);

  /**
   * Call before toggling the heart on `span` (with the hearts as they are
   * now). Offers the nudge when this click hearts something not being
   * memorized.
   */
  const heartClicked = useCallback(
    (span: VerseSpan, anchor: HTMLElement, hearts: readonly NudgeHeart[]) => {
      const wasHearted = hearts.some(
        (heart) =>
          heart.startVerse === span.startVerse &&
          heart.endVerse === span.endVerse,
      );
      if (wasHearted || suppressed || !pending) return;
      if (isSpanMemorizing(span.startVerse, span.endVerse, hearts)) return;
      if (anotherOverlayOpen()) return;
      markShown();
      setOffer({ span, title: formatSpanTitle(span), anchor });
    },
    [markShown, pending, suppressed],
  );

  const close = useCallback(() => setOffer(null), []);

  const memorize = useCallback(() => {
    if (!offer) return;
    logInteraction("reader", "heart-nudge-memorize", { ...offer.span });
    setOffer(null);
    memorizeSheet.open(
      { kind: "spans", spans: [offer.span] },
      { returnFocusTo: offer.anchor },
    );
  }, [memorizeSheet, offer]);

  const dontAskAgain = useCallback(() => {
    logInteraction("reader", "heart-nudge-dismissed", {});
    dismiss();
    setOffer(null);
  }, [dismiss]);

  return {
    heartClicked,
    nudge: {
      offer: suppressed ? null : offer,
      onClose: close,
      onMemorize: memorize,
      onDontAskAgain: dontAskAgain,
    },
  };
}
