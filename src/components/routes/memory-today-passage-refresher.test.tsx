import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PassageView } from "@/components/memory/passage/passage-session-types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { SESSION_COMPLETE_TITLE } from "@/lib/memory-copy";
import { requiredRepsFor } from "@/lib/memory-scheduler";
import {
  localDayIndex,
  PASSAGE_MAX_ADDS_PER_DAY,
} from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";
import { PASSAGE_STEP_IN_PROGRESS_KEY } from "@/lib/passage-step-resume";
import type { Id } from "../../../convex/_generated/dataModel";

import { MemoryTodayPage } from "./memory-today-page";

/**
 * Designer check 7 (S15): a Learning passage run to today's summary, with and
 * without a refresher, through the real PassageSession.
 */

const { frozenResults, liveResults, mutations, fetchChapters } = vi.hoisted(
  () => ({
    frozenResults: new Map<string, unknown>(),
    liveResults: new Map<string, unknown>(),
    mutations: new Map<string, ReturnType<typeof vi.fn>>(),
    fetchChapters: vi.fn(),
  }),
);

function mutation(name: string) {
  const existing = mutations.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutations.set(name, created);
  return created;
}

vi.mock("@/routes/memory/today", () => ({
  Route: { useSearch: () => ({ return: "/memory" }) },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryExit: () => ({
    go: vi.fn(),
    href: "/memory",
    label: "Back to Memory",
    name: "Memory",
  }),
}));

vi.mock("@/hooks/use-apply-leftover-held-attempts", () => ({
  useLeftoverHeldAttemptsReady: () => true,
  useApplyLeftoverHeldAttempts: () => {},
  resetApplyLeftoverHeldAttemptsForTests: () => {},
}));

vi.mock("@/hooks/use-frozen-query", () => ({
  useFrozenQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : frozenResults.get(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => liveResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ href: "/memory/today", state: {} }),
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChapters : vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: { get: "packs.get", resolveMembers: "packs.resolveMembers" },
    verseMemory: {
      learnQueue: "verseMemory.learnQueue",
      dueQueue: "verseMemory.dueQueue",
      memoryStats: "verseMemory.memoryStats",
    },
    passageMemory: {
      dueForLearning: "passageMemory.dueForLearning",
      getForPack: "passageMemory.getForPack",
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
      notePracticeRecital: "passageMemory.notePracticeRecital",
      holdAttempt: "passageMemory.holdAttempt",
      applyHeldAttempt: "passageMemory.applyHeldAttempt",
      markCelebrated: "passageMemory.markCelebrated",
    },
  },
}));

const PACK_ID = "psalm23" as Id<"packs">;
const ONE = "The Lord is my shepherd; I shall not want.";
const TWO = "He makes me lie down in green pastures.";
const THREE = "He leads me beside still waters.";
const FOUR = "He restores my soul.";
const LINK = "Need a refresher?";
const record = () => mutation("passageMemory.recordAttempt");

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 23,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment,
    learnStage: attachment === "solid" ? 3 : 0,
    stageReps: 0,
    ...extra,
  };
}

/** A building passage that has used today's new verses. */
function building(pieces: PassagePiece[]): PassageView {
  const now = getSessionNow();
  return {
    _id: "passage_1" as Id<"passageMemory">,
    packId: PACK_ID,
    status: "building",
    pieces,
    addsOnDay: PASSAGE_MAX_ADDS_PER_DAY,
    addDayKey: localDayIndex(now, new Date(now).getTimezoneOffset()),
    ease: 2.3,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    stageReps: 0,
    needsCelebration: false,
    createdAt: now,
    updatedAt: now,
    lastSessionAt: now - 60_000,
    remainingIntroduces: 0,
    frontierIndex: pieces.findIndex((item) => item.attachment !== "solid"),
    rehearsalStartIndex: 0,
    ropePieceIndexes: [],
  };
}

/** Verses 1–3 learned, verse 4 waits for tomorrow: warm-up, then done. */
function warmupDay() {
  const view = building([
    piece(0, "solid"),
    piece(1, "solid"),
    piece(2, "solid"),
    piece(3, "unreached"),
  ]);
  liveResults.set("passageMemory.getForPack", view);
  record().mockResolvedValue(view);
}

/** Verse 2 closes section 1 on this From memory try: section recital next. */
function sectionDay() {
  const now = getSessionNow();
  sessionStorage.setItem(
    PASSAGE_STEP_IN_PROGRESS_KEY,
    JSON.stringify({ packId: PACK_ID, origin: performance.timeOrigin - 1 }),
  );
  const second = (attachment: "attached" | "solid") =>
    piece(1, attachment, {
      learnStage: 3,
      stageReps: requiredRepsFor(3, 8) - 1,
      dueAt: now,
    });
  const rest = [piece(2, "unreached", { sectionIndex: 1 })];
  liveResults.set(
    "passageMemory.getForPack",
    building([piece(0, "solid"), second("attached"), ...rest]),
  );
  record().mockResolvedValue(
    building([piece(0, "solid"), second("solid"), ...rest]),
  );
}

async function check(answer: string, label = "Your recited passage") {
  const box = await screen.findByLabelText(label);
  await userEvent.click(box);
  await userEvent.paste(answer);
  const button = screen.getByRole("button", { name: /Check answer/ });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await screen.findByText(/% correct/);
}

async function click(name: RegExp | string) {
  await userEvent.click(await screen.findByRole("button", { name }));
}

/** First letters then From memory (clean by default), then Continue. */
async function refresh(full: string, fromMemory = full) {
  await screen.findByText("Refresh · First letters · 1 of 2");
  await check(full);
  await click(/Continue/);
  await screen.findByText("Refresh · From memory · 2 of 2");
  await check(fromMemory);
  await screen.findByText(
    "This was just practice, so your progress didn't change.",
  );
  await click(/Continue/);
}

/** "That's enough for today", then today's summary. */
async function finishDay(): Promise<Summary> {
  await click("That's enough for today");
  const heading = await screen.findByRole("heading", {
    name: SESSION_COMPLETE_TITLE,
  });
  const card = heading.closest("[data-slot], div.p-6") ?? document.body;
  return {
    rows: Array.from(card.querySelectorAll("li")).map((row) => row.textContent),
    // Any Accuracy score on the card, read from the value above its label.
    accuracy: Array.from(card.querySelectorAll("p"))
      .filter((line) => /accuracy/i.test(line.textContent ?? ""))
      .map((line) => line.previousElementSibling?.textContent ?? null),
    text: card.textContent,
    logged: record().mock.calls.map((call) => {
      const { kind, quality, accuracy, pieceIndex } = call[0] as Record<
        string,
        unknown
      >;
      return { kind, quality, accuracy, pieceIndex };
    }),
  };
}

type Summary = {
  rows: (string | null)[];
  accuracy: (string | null)[];
  text: string | null;
  logged: Record<string, unknown>[];
};

async function runDay(setup: () => void, journey: () => Promise<void>) {
  setup();
  const view = render(
    <TooltipProvider delayDuration={0}>
      <MemoryTodayPage />
    </TooltipProvider>,
  );
  await journey();
  const summary = await finishDay();
  view.unmount();
  // Forget today's progress, so the next run opens the same day afresh.
  for (const fn of mutations.values()) fn.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  return summary;
}

function expectOnlyRecordAttempt() {
  for (const name of [
    "passageMemory.holdAttempt",
    "passageMemory.applyHeldAttempt",
    "passageMemory.notePracticeRecital",
    "passageMemory.introduceNext",
  ]) {
    expect(mutation(name)).not.toHaveBeenCalled();
  }
}

describe("Today summary after a Learning passage refresher (S15, Designer check 7)", () => {
  const WARMUP = `${ONE} ${TWO} ${THREE}`;

  beforeEach(() => {
    frozenResults.clear();
    liveResults.clear();
    mutations.clear();
    localStorage.clear();
    sessionStorage.clear();
    fetchChapters.mockReset();
    fetchChapters.mockResolvedValue([
      {
        chapter: 23,
        data: {
          canonical: "Psalm 23",
          copyright: "test",
          verses: [ONE, TWO, THREE, FOUR].map((text, index) => ({
            number: index + 1,
            text,
          })),
        },
      },
    ]);
    frozenResults.set("passageMemory.dueForLearning", [
      { packId: PACK_ID, packName: "Psalm 23", dueAt: getSessionNow() - 10 },
    ]);
    frozenResults.set("verseMemory.learnQueue", []);
    frozenResults.set("verseMemory.dueQueue", []);
    frozenResults.set("verseMemory.memoryStats", {
      new: 0,
      learning: 0,
      reviewing: 0,
      mastered: 0,
      total: 0,
      due: 0,
      learningDue: 0,
    });
  });

  it("a warm-up miss gives the same summary rows and accuracy with or without the refresher", async () => {
    // A miss stalling on verse 2, then its tricky spot (verses 1–3).
    const miss = async () => {
      await check(ONE);
      expect(screen.getByText(/^39% correct/)).toBeInTheDocument();
    };
    const fixTrickySpot = async () => {
      await screen.findByText("Try this part again");
      await check(WARMUP);
      await click(/Continue/);
    };

    const plain = await runDay(warmupDay, async () => {
      await miss();
      await click(/Continue/);
      await fixTrickySpot();
    });
    const refreshed = await runDay(warmupDay, async () => {
      await miss();
      await click(LINK);
      // Under 100%, so the tricky spot still follows (a 100% counts, #403).
      await refresh(WARMUP, WARMUP.split(" ").slice(0, -1).join(" "));
      await fixTrickySpot();
    });

    expect(plain.rows).toEqual(["Psalm 23Today's verses done"]);
    expect(refreshed.rows).toEqual(plain.rows);
    // Today's summary gives a Learning passage no Accuracy figure; it must
    // stay that way after a refresher rather than gain the practice score.
    expect(plain.accuracy).toEqual([]);
    expect(refreshed.accuracy).toEqual(plain.accuracy);
    expect(refreshed.text).toBe(plain.text);
    expect(plain.logged).toHaveLength(2);
    expect(refreshed.logged).toEqual(plain.logged);
    expectOnlyRecordAttempt();
  });

  it("a section-recital miss gives the same summary rows and accuracy with or without the refresher", async () => {
    const SECTION = `${ONE} ${TWO}`;
    const reachRecital = async () => {
      await check(TWO, "Your verse");
      await click(/Continue/);
      await click("Recite this section");
      await screen.findByText("This section");
      await check(ONE);
    };
    const fixTrickySpot = async () => {
      await screen.findByText("Try this part again");
      await check(SECTION);
      await click(/Continue/);
    };

    const plain = await runDay(sectionDay, async () => {
      await reachRecital();
      await click(/Continue/);
      await fixTrickySpot();
    });
    const refreshed = await runDay(sectionDay, async () => {
      await reachRecital();
      await click(LINK);
      await refresh(SECTION);
      await fixTrickySpot();
    });

    expect(plain.rows).toEqual(["Psalm 23Today's verses done"]);
    expect(refreshed.rows).toEqual(plain.rows);
    // Today's summary gives a Learning passage no Accuracy figure; it must
    // stay that way after a refresher rather than gain the practice score.
    expect(plain.accuracy).toEqual([]);
    expect(refreshed.accuracy).toEqual(plain.accuracy);
    expect(refreshed.text).toBe(plain.text);
    expect(plain.logged).toHaveLength(3);
    expect(refreshed.logged).toEqual(plain.logged);
    expectOnlyRecordAttempt();
  });

  it("a pre-try refresher counts nothing: the same summary as the warm-up alone", async () => {
    const plain = await runDay(warmupDay, async () => {
      await check(WARMUP);
      await click(/Continue/);
    });
    const refreshed = await runDay(warmupDay, async () => {
      await click(LINK);
      // Under 100%, so the warm-up is still asked for (a 100% counts, #403).
      await refresh(WARMUP, WARMUP.split(" ").slice(0, -1).join(" "));
      // Back on the untried warm-up: nothing was logged by the refresher.
      expect(record()).not.toHaveBeenCalled();
      await check(WARMUP);
      await click(/Continue/);
    });

    expect(plain.rows).toEqual(["Psalm 23Today's verses done"]);
    expect(refreshed.rows).toEqual(plain.rows);
    // Today's summary gives a Learning passage no Accuracy figure; it must
    // stay that way after a refresher rather than gain the practice score.
    expect(plain.accuracy).toEqual([]);
    expect(refreshed.accuracy).toEqual(plain.accuracy);
    expect(refreshed.text).toBe(plain.text);
    expect(plain.logged).toEqual([
      { kind: "rope", quality: "exact", accuracy: 100, pieceIndex: undefined },
    ]);
    expect(refreshed.logged).toEqual(plain.logged);
    expectOnlyRecordAttempt();
  });
});
