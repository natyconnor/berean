import { useEffect, useRef } from "react";
import { studyTeachDebugEnabled } from "@/lib/debug-study-teach";
import { devLog } from "@/lib/dev-log";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import type { StudyCard } from "./study-card-model";

interface DeckDebugInput {
  cards: StudyCard[];
  initialQueue: string[];
  queue: string[];
  position: number;
  completedIdsSize: number;
  currentCardId: string | undefined;
  cardsById: Map<string, StudyCard>;
}

/**
 * Development-only instrumentation for the study activity deck. No-ops in
 * production; when `localStorage.berean:debugStudyTeach` or `?debugStudyTeach=1`
 * is set, emits structured logs to the in-app devLog so queue/cards mismatches
 * are easy to spot.
 */
export function useStudyActivityDeckDebug({
  cards,
  initialQueue,
  queue,
  position,
  completedIdsSize,
  currentCardId,
  cardsById,
}: DeckDebugInput) {
  const prevCardsLenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!studyTeachDebugEnabled()) return;
    const ids = cards.map((c) => c.id);
    const uniqueIds = new Set(ids);
    devLog.info("studyTeach", "deck-cards-prop", {
      cardsLength: cards.length,
      uniqueCardIds: uniqueIds.size,
      duplicateCardIds: cards.length - uniqueIds.size,
      prevCardsLength: prevCardsLenRef.current,
    });
    prevCardsLenRef.current = cards.length;
  }, [cards]);

  useEffect(() => {
    if (!studyTeachDebugEnabled()) return;
    devLog.info("studyTeach", "deck-initial-queue", {
      cardsLength: cards.length,
      initialQueueLength: initialQueue.length,
      aligned: initialQueue.length === cards.length,
    });
  }, [cards, initialQueue]);

  useEffect(() => {
    if (!studyTeachDebugEnabled()) return;
    if (queue.length + completedIdsSize !== cards.length) {
      devLog.warn("studyTeach", "queue-completed-mismatch", {
        queueLength: queue.length,
        cardsLength: cards.length,
        completedSize: completedIdsSize,
        position,
        queueHead: queue.slice(0, 8),
      });
    }
    const uniqueInQueue = new Set(queue).size;
    if (uniqueInQueue !== queue.length && queue.length === cards.length) {
      devLog.warn("studyTeach", "queue-duplicate-ids-without-skips", {
        queueLength: queue.length,
        uniqueInQueue,
      });
    }
  }, [cards.length, queue, position, completedIdsSize]);

  useEffect(() => {
    if (!studyTeachDebugEnabled()) return;
    if (
      cards.length > 0 &&
      currentCardId &&
      !cards.some((c) => c.id === currentCardId)
    ) {
      devLog.warn("studyTeach", "missing-card-for-queue-id", {
        currentCardId,
        totalCards: cards.length,
      });
    }
  }, [cards, currentCardId]);

  function logAdvance(
    action: "done" | "skip",
    ctx: { position: number; queueLength: number; completedCount: number },
  ): void {
    if (!studyTeachDebugEnabled() || !currentCardId) return;
    const card = cardsById.get(currentCardId);
    const refLabel =
      card?.type === "teach" || card?.type === "verse-memory"
        ? formatVerseRef(card.reference)
        : null;
    devLog.debug("studyTeach", `advance:${action}`, {
      cardId: currentCardId,
      cardType: card?.type ?? null,
      ref: refLabel,
      positionBefore: ctx.position,
      queueLength: ctx.queueLength,
      completedCount: ctx.completedCount,
    });
  }

  function logRestart(ctx: {
    cardsLength: number;
    initialQueueLength: number;
  }): void {
    if (!studyTeachDebugEnabled()) return;
    devLog.info("studyTeach", "deck-restart", ctx);
  }

  function logShuffle(ctx: { cardsLength: number }): void {
    if (!studyTeachDebugEnabled()) return;
    devLog.info("studyTeach", "deck-shuffle", ctx);
  }

  return { logAdvance, logRestart, logShuffle };
}
