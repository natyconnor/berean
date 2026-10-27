import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { PassageRecallCard } from "@/components/memory/passage/passage-recall-card";
import {
  PracticeBoard,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Id } from "../../../convex/_generated/dataModel";
import { PSALM_23 } from "./stubs";
import "./harness.css";

const NOW = Date.UTC(2026, 9, 12, 18);
const VERSE_REF_ID = "vr_119_105" as Id<"verseRefs">;

const reviewing119: PracticeVerse = {
  verseRefId: VERSE_REF_ID,
  reference: { book: "Psalms", chapter: 119, startVerse: 105, endVerse: 105 },
  learnStage: 3,
  stageReps: 0,
  status: "reviewing",
  dueAt: NOW - 1000,
  ease: 2.3,
  intervalDays: 5,
  consecutiveCorrect: 3,
  lapses: 0,
  earlyReviewApplied: false,
};

function SessionFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">{children}</div>
  );
}

function VerseCase() {
  return (
    <SessionFrame>
      <PracticeBoard
        kind="review"
        verses={[reviewing119]}
        scopeLabel="Today"
        onExit={() => {}}
        remainingDue={0}
      />
    </SessionFrame>
  );
}

function PassageCase() {
  return (
    <SessionFrame>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <header className="shrink-0 border-b px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Review · Today
          </h1>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 pt-6 pb-24">
          <PassageRecallCard
            mode="review"
            phaseLabel="From memory"
            title="Psalm 23"
            promptLine="Type the passage from memory"
            versePlainText={PSALM_23}
            loading={false}
            error={null}
            retry={() => undefined}
            hint={{ type: "hidden", message: "No hint text." }}
            learnStage={3}
            stageReps={0}
            status="reviewing"
            onSubmit={() => {
              const delayMs = Number(
                new URLSearchParams(window.location.search).get("delay") ?? "0",
              );
              return new Promise((resolve) => {
                setTimeout(() => resolve(true), delayMs);
              });
            }}
          />
        </div>
      </div>
    </SessionFrame>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const page = new URLSearchParams(window.location.search).get("case") ?? "verse";

createRoot(root).render(
  <TooltipProvider delayDuration={0}>
    {page === "passage" ? <PassageCase /> : <VerseCase />}
  </TooltipProvider>,
);

export { PSALM_119 };
