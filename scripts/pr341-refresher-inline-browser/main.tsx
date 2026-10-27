import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { NeedARefresherInlineOffer } from "@/components/memory/memory-refresher-controls";
import { PassageRecallCard } from "@/components/memory/passage/passage-recall-card";
import { VerseMemoryFeedback } from "@/components/study/verse-memory-feedback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PSALM_23, PSALM_119 } from "./stubs";
import "./harness.css";

const NOW = Date.UTC(2026, 9, 12, 18);

function SessionFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-6 pb-24">
        {children}
      </div>
    </div>
  );
}

function delayedSubmit() {
  const delayMs = Number(
    new URLSearchParams(window.location.search).get("delay") ?? "0",
  );
  return new Promise<true>((resolve) => {
    setTimeout(() => resolve(true), delayMs);
  });
}

function VerseCase() {
  return (
    <SessionFrame title="Review · Today">
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 119:105"
        promptLine="Type what you remember"
        versePlainText={PSALM_119}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={delayedSubmit}
      />
    </SessionFrame>
  );
}

function PassageCase() {
  return (
    <SessionFrame title="Review · Today">
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
        onSubmit={delayedSubmit}
      />
    </SessionFrame>
  );
}

function ReserveCase() {
  const delayMs = Number(
    new URLSearchParams(window.location.search).get("delay") ?? "700",
  );
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <SessionFrame title="Review · Today">
      <VerseMemoryFeedback
        quality="off"
        accuracy={0}
        attemptKey="reserve"
        showScheduleOutcome
        nextSchedule={{
          status: "learning",
          learnStage: 2,
          stageReps: 0,
          ease: 2.1,
          intervalDays: 0,
          dueAt: NOW,
          consecutiveCorrect: 0,
          lapses: 1,
          earlyReviewApplied: false,
        }}
        now={NOW}
        refresherOffer={
          <NeedARefresherInlineOffer onClick={() => {}} visible={visible} />
        }
      />
    </SessionFrame>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const page = new URLSearchParams(window.location.search).get("case") ?? "verse";

createRoot(root).render(
  <TooltipProvider delayDuration={0}>
    {page === "passage" ? (
      <PassageCase />
    ) : page === "reserve" ? (
      <ReserveCase />
    ) : (
      <VerseCase />
    )}
  </TooltipProvider>,
);
