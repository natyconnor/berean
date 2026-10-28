import { useMemo, useState } from "react";
import { useMutation } from "convex/react";

import {
  PassageRecallCard,
  type PassageRecallResult,
} from "@/components/memory/passage/passage-recall-card";
import { PassageSessionShell } from "@/components/memory/passage/passage-session-shell";
import { useEsvCompositePassage } from "@/hooks/use-esv-composite-passage";
import { REFRESH_FINISH_ERROR, refresherGoalLabel } from "@/lib/memory-copy";
import { learnedPassagePieces } from "@/lib/passage-frontier";
import { maskVerseText } from "@/lib/verse-hint";
import { getViewerTimeZone } from "@/lib/viewer-timezone";
import {
  refreshLearnStageForStep,
  type RefreshStep,
} from "@/lib/memory-way-back";

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
  const [step, setStep] = useState<RefreshStep>(1);
  const [startedAt] = useState(() => Date.now());
  const [finishError, setFinishError] = useState<string | null>(null);
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);
  const finishRefresh = useMutation(api.passageMemory.finishRefresh);
  const refreshPieces = learnedPassagePieces(view.pieces);
  const members = (refreshPieces.length > 0 ? refreshPieces : view.pieces).map(
    (piece) => ({
      book: piece.book,
      chapter: piece.chapter,
      startVerse: piece.startVerse,
      endVerse: piece.endVerse,
    }),
  );
  const passage = useEsvCompositePassage(members);
  const hintSource = passage.hintText || passage.text;
  const hint = useMemo(() => {
    if (step === 1) {
      return {
        type: "tokens" as const,
        tokens: maskVerseText(hintSource, "first-letters"),
      };
    }
    return {
      type: "hidden" as const,
      message: refresherGoalLabel(2),
    };
  }, [hintSource, step]);

  const onSubmit = async (result: PassageRecallResult) => {
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
    <PassageSessionShell
      phaseLabel="Refresh"
      packName={packName}
      onExit={onExit}
      backLabel={backLabel}
      exitHref={exitHref}
      persistError={finishError}
    >
      <PassageRecallCard
        mode="review"
        phaseLabel="Refresh"
        title={packName}
        promptLine={
          step === 1
            ? "Type it with first letters"
            : "Recall the passage from memory"
        }
        versePlainText={passage.text}
        hintPlainText={hintSource}
        loading={passage.loading}
        error={passage.error}
        retry={passage.retry}
        hint={hint}
        learnStage={refreshLearnStageForStep(step)}
        stageReps={0}
        status={view.status === "mastered" ? "mastered" : "reviewing"}
        refreshSitting
        onSubmit={onSubmit}
        onContinueAfterResult={() => {
          if (step < 2) {
            setStep(2);
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
    </PassageSessionShell>
  );
}
