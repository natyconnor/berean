import { useCallback, useRef, useState } from "react";

import { useMemorizeSheet } from "@/components/memory/memorize/memorize-context";
import { logInteraction } from "@/lib/dev-log";
import { exactSpanMatch, type VerseSpan } from "@/lib/hearted-verse-coverage";
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
 * `saved`: the heart was just clicked on, and clicking any of its span's
 * hearts again while it shows unhearts it. `hearted`: a heart already on was
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
  const [offer, setOfferState] = useState<HeartNudgeOffer | null>(null);
  // For click handlers, which can change the offer twice before a render.
  const offerRef = useRef<HeartNudgeOffer | null>(null);
  const nextOfferId = useRef(0);

  const setOffer = useCallback((next: HeartNudgeOffer | null) => {
    offerRef.current = next;
    setOfferState(next);
  }, []);

  const showsSavedOffer = useCallback(
    (span: VerseSpan) => {
      const current = offerRef.current;
      return (
        !suppressed &&
        current?.kind === "saved" &&
        exactSpanMatch(span, [current.span]) !== null
      );
    },
    [suppressed],
  );

  /** Closes the offer for a heart just made, if `span` is its heart. */
  const closeSavedOffer = useCallback(
    (span: VerseSpan) => {
      if (!showsSavedOffer(span)) return false;
      logInteraction("reader", "heart-nudge-unheart-again", { ...span });
      setOffer(null);
      return true;
    },
    [setOffer, showsSavedOffer],
  );

  /**
   * Call before toggling the heart on `span` (with the hearts as they are
   * now). Offers the nudge when this click hearts something not being
   * memorized.
   */
  const heartClicked = useCallback(
    (span: VerseSpan, anchor: HTMLElement, hearts: readonly NudgeHeart[]) => {
      // Its offer still shows, so this toggle unhearts it, even when `hearts`
      // doesn't have it yet.
      if (closeSavedOffer(span)) return;
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
    [closeSavedOffer, setOffer, suppressed],
  );

  /**
   * A heart already on was clicked: offer Memorize or Unheart, or close
   * that offer when its heart is clicked again. While the offer for a heart
   * just made shows, clicking it again just unhearts it.
   */
  const heartedClicked = useCallback(
    (span: VerseSpan, anchor: HTMLElement, unheart: () => void) => {
      if (showsSavedOffer(span)) {
        // Before closing: a verse heart's unheart toggles through
        // `heartClicked`, which must not take it for a new heart.
        unheart();
        closeSavedOffer(span);
        return;
      }
      const current = offerRef.current;
      setOffer(
        current?.kind === "hearted" && current.anchor === anchor
          ? null
          : {
              kind: "hearted",
              id: nextOfferId.current++,
              span,
              title: formatSpanTitle(span),
              anchor,
              unheart,
            },
      );
    },
    [closeSavedOffer, setOffer, showsSavedOffer],
  );

  const close = useCallback(() => setOffer(null), [setOffer]);

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
  }, [memorizeSheet, offer, setOffer]);

  const unheart = useCallback(() => {
    if (offer?.kind !== "hearted") return;
    logInteraction("reader", "heart-nudge-unheart", { ...offer.span });
    setOffer(null);
    offer.unheart();
  }, [offer, setOffer]);

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
