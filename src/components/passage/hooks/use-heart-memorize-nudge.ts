import { useCallback, useRef, useState } from "react";

import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { logInteraction } from "@/lib/dev-log";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { formatSpanTitle } from "@/lib/memorize-target";

/** A chapter heart as the nudge needs it (from `savedVerses.listForChapter`). */
export type NudgeHeart = {
  startVerse: number;
  endVerse: number;
  memory?: { inMemory: boolean };
  passageMemoryId?: string;
};

type OfferBase = {
  /** Tells offers apart, so a new one remounts the popover and its focus. */
  id: number;
  span: VerseSpan;
  /** "Psalm 1:5". */
  title: string;
  anchor: HTMLElement;
};

/**
 * `saved`: the heart was just clicked on. `hearted`: a heart already on was
 * clicked, so the popover offers Unheart in place of Not now.
 */
export type HeartNudgeOffer =
  | (OfferBase & { kind: "saved" })
  | (OfferBase & { kind: "hearted"; unheart: () => void });

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
 * The "Memorize it?" popover beside a heart: after hearting something not
 * being memorized, and when a heart already on is clicked (Memorize or
 * Unheart).
 */
export function useHeartMemorizeNudge({
  suppressed,
}: {
  /** Focus mode or a tour: no popover after hearting. */
  suppressed: boolean;
}) {
  const memorizeSheet = useMemorizeSheet();
  const [offer, setOffer] = useState<HeartNudgeOffer | null>(null);
  const nextOfferId = useRef(0);

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
      if (wasHearted || suppressed) return;
      if (isSpanMemorizing(span.startVerse, span.endVerse, hearts)) return;
      if (anotherOverlayOpen()) return;
      setOffer({
        kind: "saved",
        id: nextOfferId.current++,
        span,
        title: formatSpanTitle(span),
        anchor,
      });
    },
    [suppressed],
  );

  /**
   * A heart already on was clicked: offer Memorize or Unheart, or close
   * that offer when its heart is clicked again.
   */
  const heartedClicked = useCallback(
    (span: VerseSpan, anchor: HTMLElement, unheart: () => void) => {
      const id = nextOfferId.current++;
      setOffer((current) =>
        current?.kind === "hearted" && current.anchor === anchor
          ? null
          : {
              kind: "hearted",
              id,
              span,
              title: formatSpanTitle(span),
              anchor,
              unheart,
            },
      );
    },
    [],
  );

  const close = useCallback(() => setOffer(null), []);

  const memorize = useCallback(() => {
    if (!offer) return;
    logInteraction("reader", "heart-nudge-memorize", {
      ...offer.span,
      kind: offer.kind,
    });
    setOffer(null);
    memorizeSheet.open(
      { kind: "spans", spans: [offer.span] },
      { returnFocusTo: offer.anchor },
    );
  }, [memorizeSheet, offer]);

  const unheart = useCallback(() => {
    if (offer?.kind !== "hearted") return;
    logInteraction("reader", "heart-nudge-unheart", { ...offer.span });
    setOffer(null);
    offer.unheart();
  }, [offer]);

  return {
    heartClicked,
    heartedClicked,
    nudge: {
      offer: suppressed && offer?.kind === "saved" ? null : offer,
      onClose: close,
      onMemorize: memorize,
      onUnheart: unheart,
    },
  };
}
