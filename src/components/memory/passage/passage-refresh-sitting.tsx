import { useMemo, useState } from "react";
import { useMutation } from "convex/react";

import {
  PassageRecallCard,
  type PassageRecallResult,
} from "@/components/memory/passage/passage-recall-card";
import { SessionBackButton } from "@/components/memory/session-back-button";
import { useEsvCompositePassage } from "@/hooks/use-esv-composite-passage";
import { REFRESH_FINISH_ERROR } from "@/lib/memory-copy";
import { LEARN_PROGRESS_ACCURACY } from "@/lib/memory-scheduler";
import { maskVerseText } from "@/lib/verse-hint";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { PassageView } from "./passage-session-types";

export function PassageRefreshSitting({
  packId,
  view,
  packName,
  onExit,
  backLabel = "Back to Memory",
  exitHref,
}: {
  packId: Id<"packs">;
  view: PassageView;
  packName: string;
  onExit: () => void;
  backLabel?: string;
  exitHref?: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lastAccuracy, setLastAccuracy] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [finishError, setFinishError] = useState<string | null>(null);
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);
  const finishRefresh = useMutation(api.passageMemory.finishRefresh);
  const members = view.pieces.map((piece) => ({
    book: piece.book,
    chapter: piece.chapter,
    startVerse: piece.startVerse,
    endVerse: piece.endVerse,
  }));
  const passage = useEsvCompositePassage(members);
  const hint = useMemo(() => {
    if (step === 1) {
      return {
        type: "tokens" as const,
        tokens: maskVerseText(passage.text, "first-letters"),
      };
    }
    if (step === 2) {
      return {
        type: "tokens" as const,
        tokens: maskVerseText(passage.text, "cloze"),
      };
    }
    return {
      type: "hidden" as const,
      message:
        "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.",
    };
  }, [passage.text, step]);

  const onSubmit = async (result: PassageRecallResult) => {
    setLastAccuracy(result.accuracy);
    const now = Date.now();
    await recordAttempt({
      packId,
      kind: "review",
      quality: result.quality,
      accuracy: result.accuracy,
      now,
      tzOffsetMinutes: new Date(now).getTimezoneOffset(),
      timeZone: getViewerTimeZone(),
      holdSchedule: true,
      hint: step === 1 ? "first-letters" : undefined,
    });
    return true;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <SessionBackButton
          onExit={onExit}
          label={backLabel}
          exitHref={exitHref}
        />
      </header>
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <PassageRecallCard
          mode="review"
          phaseLabel="Refresh"
          title={packName}
          promptLine={
            step === 1
              ? "Type it with first letters"
              : step === 2
                ? "Fill in the blanks"
                : "Recall the passage from memory"
          }
          versePlainText={passage.text}
          loading={passage.loading}
          error={passage.error}
          retry={passage.retry}
          hint={hint}
          learnStage={step}
          stageReps={0}
          status={view.status === "mastered" ? "mastered" : "reviewing"}
          onSubmit={onSubmit}
          onContinueAfterResult={() => {
            if (lastAccuracy < LEARN_PROGRESS_ACCURACY) return;
            if (step < 3) {
              setStep((current) => (current === 1 ? 2 : 3));
              return;
            }
            const now = Date.now();
            void finishRefresh({
              packId,
              now,
              sittingStartedAt: startedAt,
              tzOffsetMinutes: new Date(now).getTimezoneOffset(),
              timeZone: getViewerTimeZone(),
            })
              .then(() => {
                setFinishError(null);
                onExit();
              })
              .catch(() => {
                setFinishError(REFRESH_FINISH_ERROR);
              });
          }}
        />
        {finishError ? (
          <p className="mt-3 text-xs text-destructive">{finishError}</p>
        ) : null}
      </div>
    </div>
  );
}
