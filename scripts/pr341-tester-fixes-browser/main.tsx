import { createRoot } from "react-dom/client";

import { GoalCard } from "@/components/memory/today/goal-card";
import { PassageRefreshSitting } from "@/components/memory/passage/passage-refresh-sitting";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PassageGoalCard } from "@/lib/memory-goals";
import { DAY_MS } from "@/lib/memory-scheduler";
import {
  passageDetailActions,
  passageVerseRows,
} from "@/lib/pack-detail-model";
import type { PassagePiece } from "@/lib/passage-pieces";
import type { Id } from "../../../convex/_generated/dataModel";
import type { PassageView } from "@/components/memory/passage/passage-session-types";
import "./harness.css";

const NOW = Date.UTC(2026, 9, 12, 18);
const PACK_ID = "pack_psalm23" as Id<"packs">;

function piece(
  index: number,
  startVerse: number,
  endVerse: number,
  attachment: PassagePiece["attachment"],
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 23,
    startVerse,
    endVerse,
    sectionIndex: 0,
    attachment,
    learnStage: 0,
    stageReps: 0,
  };
}

const unstartedPieces = [
  piece(0, 1, 2, "unreached"),
  piece(1, 3, 4, "unreached"),
  piece(2, 5, 6, "unreached"),
];

const reviewingView: PassageView = {
  _id: "pm_23" as Id<"passageMemory">,
  packId: PACK_ID,
  status: "reviewing",
  pieces: [
    piece(0, 1, 2, "solid"),
    piece(1, 3, 4, "solid"),
    piece(2, 5, 6, "solid"),
  ],
  addsOnDay: 0,
  ease: 2.3,
  intervalDays: 7,
  dueAt: NOW,
  consecutiveCorrect: 1,
  lapses: 0,
  stageReps: 0,
  needsCelebration: false,
  createdAt: NOW - 40 * DAY_MS,
  updatedAt: NOW,
  remainingIntroduces: 0,
  frontierIndex: 3,
  rehearsalStartIndex: 0,
  ropePieceIndexes: [0, 1, 2],
};

const unstartedGoal: PassageGoalCard = {
  kind: "passage",
  packId: "psalm1",
  title: "Psalm 1",
  verseCount: 6,
  learnedVerses: 0,
  pieceStates: [
    { verses: 2, state: "upNext", today: false },
    { verses: 2, state: "upNext", today: false },
    { verses: 2, state: "upNext", today: false },
  ],
  status: "building",
  hasWorkToday: true,
  todayStep: {
    label: "Read verses 1–2, then type them with first letters",
    ladderDay: 1,
  },
  masteryFraction: 0,
  nextDueAt: NOW,
  createdAt: NOW - 5 * DAY_MS,
  lastActivityAt: NOW - 5 * DAY_MS,
  lastPracticedAt: null,
};

function RefreshCase() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-5 py-3 text-sm">Memory</div>
      <div className="min-h-0 flex-1">
        <PassageRefreshSitting
          packId={PACK_ID}
          view={reviewingView}
          packName="Psalm 23"
          onExit={() => {}}
        />
      </div>
      <div
        data-testid="notes-dock"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 border-t bg-background/95"
      >
        Notes / Memory
      </div>
    </div>
  );
}

function PackCase() {
  const actions = passageDetailActions(unstartedGoal, NOW, "UTC");
  const rows = passageVerseRows(
    {
      pieces: unstartedPieces,
      addsOnDay: 0,
      lastSessionAt: undefined,
    },
    NOW,
    0,
  );
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Psalm 1</h1>
      <a data-testid="main-action" href="/memory/psalm1/learn">
        {actions.main && "label" in actions.main ? actions.main.label : ""}
      </a>
      <p data-testid="today-line">
        {unstartedGoal.lastPracticedAt === null
          ? ""
          : unstartedGoal.todayStep?.label}
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.verse}>
            verse {row.verse}: {row.chip.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayCase() {
  return (
    <div className="p-6">
      <GoalCard goal={unstartedGoal} now={NOW} timeZone="UTC" />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const page =
  new URLSearchParams(window.location.search).get("case") ?? "refresh";

createRoot(root).render(
  <TooltipProvider delayDuration={0}>
    {page === "pack" ? (
      <PackCase />
    ) : page === "today" ? (
      <TodayCase />
    ) : (
      <RefreshCase />
    )}
  </TooltipProvider>,
);
