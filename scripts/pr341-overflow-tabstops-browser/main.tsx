import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";

import { PassageRecallCard } from "@/components/memory/passage/passage-recall-card";
import {
  PracticeBoard,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import { NeedARefresherInlineOffer } from "@/components/memory/memory-refresher-controls";
import { useOverflowTabIndex } from "@/hooks/use-overflow-tab-index";
import { VerseAttemptResult } from "@/components/study/verse-attempt-result";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  READER_MEASURE_CLASS,
  READER_VERSE_SIZE_CLASS,
} from "@/lib/reader-typography";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import { PSALM_119, PSALM_23 } from "./stubs";
import "./harness.css";

const NOW = Date.UTC(2026, 9, 12, 18);
const PACK_ID = "pack_psalm23" as Id<"packs">;

function reviewingVerse(chapter: number, startVerse: number): PracticeVerse {
  return {
    verseRefId: `vr_${chapter}_${startVerse}` as Id<"verseRefs">,
    reference: {
      book: "Psalms",
      chapter,
      startVerse,
      endVerse: startVerse,
    },
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
}

const shortVerse = reviewingVerse(119, 105);

const passageVerse: PracticeVerse = {
  ...reviewingVerse(23, 1),
  composite: {
    packId: PACK_ID,
    members: [1, 2, 3, 4, 5, 6].map((verse) => ({
      book: "Psalms",
      chapter: 23,
      startVerse: verse,
      endVerse: verse,
    })),
  },
};

function FullTextPreview({ text }: { text: string }) {
  const region = useOverflowTabIndex();
  return (
    <div
      ref={region.ref}
      tabIndex={region.tabIndex}
      data-result-scroll="full-text"
      className={cn(
        "mx-auto max-h-[45vh] overflow-y-auto rounded-xl border bg-card/60 px-4 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        READER_VERSE_SIZE_CLASS,
        READER_MEASURE_CLASS,
      )}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Full text
      </p>
      <p>{text}</p>
    </div>
  );
}

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

function ShortBoard() {
  return (
    <PracticeBoard
      kind="review"
      verses={[shortVerse]}
      scopeLabel="Psalm 119:105"
      onExit={() => {}}
      remainingDue={0}
    />
  );
}

function PassageBoard() {
  return (
    <PracticeBoard
      kind="review"
      verses={[passageVerse]}
      scopeLabel="Psalm 23"
      onExit={() => {}}
      remainingDue={0}
    />
  );
}

function RecallCard() {
  return (
    <SessionFrame title="Review · Passage">
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
        onSubmit={() => Promise.resolve(true)}
      />
    </SessionFrame>
  );
}

function ResizeCase() {
  return (
    <SessionFrame title="Review · Resize">
      <div className="space-y-4">
        <VerseAttemptResult
          typedAnswer="nope"
          versePlainText={PSALM_119}
          refresherOffer={
            <NeedARefresherInlineOffer onClick={() => {}} visible />
          }
        />
        <FullTextPreview text={`${PSALM_23}\n\n${PSALM_23}\n\n${PSALM_23}`} />
        <button type="button">Continue</button>
      </div>
    </SessionFrame>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const page = new URLSearchParams(window.location.search).get("case") ?? "short";

createRoot(root).render(
  <TooltipProvider delayDuration={0}>
    {page === "passage" ? (
      <PassageBoard />
    ) : page === "recall" ? (
      <RecallCard />
    ) : page === "resize" ? (
      <ResizeCase />
    ) : (
      <ShortBoard />
    )}
  </TooltipProvider>,
);
