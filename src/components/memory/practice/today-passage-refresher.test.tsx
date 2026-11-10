import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { formatDueDay } from "@/lib/memorize-plan";
import {
  NEED_A_REFRESHER_LABEL,
  NOW_TRY_WITHOUT_HINTS,
  PRACTICE_ONLY_CLOSING,
  REFRESH_SAVE_ERROR,
  TRY_ANOTHER_REFRESHER_LABEL,
  refresherHeader,
} from "@/lib/memory-copy";
import { DAY_MS } from "@/lib/memory-scheduler";
import { previewNextSchedule } from "@/lib/memory-schedule-preview";
import type { ReviewSessionAttempt } from "@/lib/review-session-attempts";
import {
  halfFirstLetters,
  maskVerseText,
  type HintStage,
} from "@/lib/verse-hint";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EsvChapterData } from "../../../../shared/esv-api";
import { verseRefKey } from "../../../../shared/verse-ref-key";

import {
  PracticeBoard,
  type PracticeSessionResult,
  type PracticeVerse,
} from "./practice-board";
import { TodaySessionSummary } from "./today-session-summary";

const {
  queryResults,
  queryCalls,
  mutationMocks,
  navigateMock,
  fetchChaptersBatchMock,
  getPassageMock,
} = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryCalls: [] as Array<[string, unknown]>,
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  navigateMock: vi.fn(),
  fetchChaptersBatchMock: vi.fn(),
  getPassageMock: vi.fn(),
}));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : getPassageMock,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args?: unknown) => {
    queryCalls.push([name, args]);
    if (args === "skip") return undefined;
    return queryResults.get(name);
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ href: "/memory/today", state: {} }),
}));

vi.mock("@/components/memory/packs/add-to-pack", () => ({
  AddToPack: () => null,
}));

// Refresh's first First letters step letters the first half of each hinted
// verse, so its hint is predictable here (the random pick is unit-tested).
vi.mock("@/lib/verse-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/verse-hint")>()),
  seededRandom: () => () => 0,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: { recordUnifiedReview: "packs.recordUnifiedReview" },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      recordAttempt: "passageMemory.recordAttempt",
      holdAttempt: "passageMemory.holdAttempt",
      applyHeldAttempt: "passageMemory.applyHeldAttempt",
      notePracticeRecital: "passageMemory.notePracticeRecital",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
    verseMemory: {
      recordAttempt: "verseMemory.recordAttempt",
      holdAttempt: "verseMemory.holdAttempt",
      applyHeldAttempt: "verseMemory.applyHeldAttempt",
      verseDetail: "verseMemory.verseDetail",
    },
  },
}));

// Two 100-word verses: each dropped word costs a half point overall and one
// point in its own verse, so every boundary is exact.
const WORDS_ONE = Array.from({ length: 100 }, (_, index) => `alpha${index}`);
const WORDS_TWO = Array.from({ length: 100 }, (_, index) => `beta${index}`);
const VERSE_ONE = WORDS_ONE.join(" ");
const VERSE_TWO = WORDS_TWO.join(" ");
const BEFORE_TEXT = "Grace and peace to you from God our Father.";
const AFTER_TEXT = "Rejoice in the Lord always; again I will say rejoice.";

const PACK_ID = "pack_ps23" as Id<"packs">;
const PACK_NAME = "Shepherd Psalm";
const HELD_ID = "held_passage_1" as Id<"heldPassageAttempts">;
const NOW = getSessionNow();

function span(chapter: number, verse: number) {
  return { book: "Psalms", chapter, startVerse: verse, endVerse: verse };
}

function chapter(number: number, verses: string[]): EsvChapterData {
  return {
    canonical: `Psalm ${number}`,
    copyright: "test",
    verses: verses.map((text, index) => ({ number: index + 1, text })),
  };
}

const PASSAGE_SCHEDULE = {
  learnStage: 3,
  // Fewer than a bad miss takes: the passage floors at the start of Memorized.
  stageReps: 2,
  status: "reviewing" as const,
  dueAt: NOW - 1000,
  ease: 2.3,
  intervalDays: 4,
  consecutiveCorrect: 2,
  lapses: 0,
  earlyReviewApplied: false,
};

const passageCard: PracticeVerse = {
  reference: span(23, 1),
  ...PASSAGE_SCHEDULE,
  composite: {
    packId: PACK_ID,
    packName: PACK_NAME,
    members: [span(23, 1), span(23, 2)],
    passageStatus: "reviewing",
  },
};

function verseCard(chapterNumber: number, id: string): PracticeVerse {
  return {
    verseRefId: id as Id<"verseRefs">,
    reference: span(chapterNumber, 1),
    learnStage: 3,
    stageReps: 3,
    status: "reviewing",
    dueAt: NOW - 1000,
    ease: 2.3,
    intervalDays: 5,
    consecutiveCorrect: 3,
    lapses: 0,
    earlyReviewApplied: false,
  };
}

const before = verseCard(24, "vr_before");
const after = verseCard(25, "vr_after");
const PASSAGE_ID = `unified:${PACK_ID}`;

/** A saved passage view, as the passage mutations return it. */
function savedView(dueInDays: number) {
  return {
    ...PASSAGE_SCHEDULE,
    status: "reviewing",
    dueAt: NOW + dueInDays * DAY_MS,
    intervalDays: dueInDays,
    shakyVerses: [],
  };
}

const verseSaved = {
  status: "reviewing" as const,
  learnStage: 3,
  stageReps: 4,
  ease: 2.3,
  intervalDays: 5,
  dueAt: NOW + 5 * DAY_MS,
  consecutiveCorrect: 4,
  lapses: 0,
  earlyReviewApplied: false,
};

/** The whole passage with the last words of each verse left out. */
function answer(dropOne: number, dropTwo: number): string {
  return [
    ...WORDS_ONE.slice(0, 100 - dropOne),
    ...WORDS_TWO.slice(0, 100 - dropTwo),
  ].join(" ");
}

/** `half` is step 1's hint: the first half lettered, per the mock above. */
function masked(text: string, stage: HintStage | "half"): string {
  return (
    stage === "half"
      ? halfFirstLetters(text, () => 0)
      : maskVerseText(text, stage)
  )
    .map((token) => token.text)
    .join("");
}

/** The hint panel showing exactly `text`. */
function hintShown(text: string) {
  return screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent === text,
  );
}

function findHint(text: string) {
  return waitFor(() => hintShown(text));
}

/** Step 1's First letters hint with verse one and/or two targeted. */
function hint(one: boolean, two: boolean): string {
  return `${masked(VERSE_ONE, one ? "half" : "hidden")} ${masked(
    VERSE_TWO,
    two ? "half" : "hidden",
  )}`;
}

/** The every-word First letters hint on verse one and/or two. */
function everyWordHint(one: boolean, two: boolean): string {
  return `${masked(VERSE_ONE, one ? "first-letters" : "hidden")} ${masked(
    VERSE_TWO,
    two ? "first-letters" : "hidden",
  )}`;
}

beforeEach(() => {
  queryResults.clear();
  queryCalls.length = 0;
  mutationMocks.clear();
  navigateMock.mockReset();
  sessionStorage.clear();
  queryResults.set("savedVerses.listRecordingIds", []);
  queryResults.set("passageMemory.getForPack", { shakyVerses: [] });
  fetchChaptersBatchMock.mockReset();
  fetchChaptersBatchMock.mockResolvedValue([
    { chapter: 23, data: chapter(23, [VERSE_ONE, VERSE_TWO]) },
  ]);
  getPassageMock.mockReset();
  getPassageMock.mockImplementation(({ query }: { query: string }) =>
    Promise.resolve(
      query.includes("24")
        ? chapter(24, [BEFORE_TEXT])
        : chapter(25, [AFTER_TEXT]),
    ),
  );
  mutationMock("verseMemory.recordAttempt").mockResolvedValue(verseSaved);
  mutationMock("verseMemory.holdAttempt").mockResolvedValue({
    heldId: "held_verse_1",
  });
  mutationMock("verseMemory.applyHeldAttempt").mockResolvedValue({
    applied: true,
    schedule: verseSaved,
  });
  mutationMock("passageMemory.holdAttempt").mockResolvedValue({
    heldId: HELD_ID,
  });
  mutationMock("passageMemory.applyHeldAttempt").mockResolvedValue(
    savedView(1),
  );
  mutationMock("passageMemory.recordAttempt").mockResolvedValue(savedView(4));
  mutationMock("passageMemory.notePracticeRecital").mockResolvedValue(
    savedView(4),
  );
});

const onExit = vi.fn();

/** A Today Review all run: the passage between two verses, or last. */
function renderRun(
  order: "between" | "last" | "alone",
  onComplete = vi.fn<(result: PracticeSessionResult) => void>(),
) {
  const verses =
    order === "between"
      ? [before, passageCard, after]
      : order === "last"
        ? [before, passageCard]
        : [passageCard];
  const view = render(
    <TooltipProvider delayDuration={0}>
      <PracticeBoard
        kind="review"
        verses={verses}
        scopeLabel="Today"
        onExit={onExit}
        orderedIds={verses.map((verse) =>
          verse.composite ? PASSAGE_ID : verseRefKey(verse.reference),
        )}
        onComplete={onComplete}
      />
    </TooltipProvider>,
  );
  return { ...view, onComplete };
}

function passageField() {
  return screen.findByLabelText("Your recited passage");
}

async function type(field: HTMLElement, text: string) {
  await userEvent.click(field);
  await userEvent.paste(text);
}

async function checkPassage(text: string) {
  await type(await passageField(), text);
  await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
}

async function reciteVerse(text: string) {
  await type(await screen.findByLabelText("Your recalled verse"), text);
  await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
  await userEvent.click(
    await screen.findByRole("button", { name: /Continue/ }),
  );
}

function offer() {
  return screen.findByRole("button", { name: NEED_A_REFRESHER_LABEL });
}

async function clickContinue() {
  await userEvent.click(
    await screen.findByRole("button", { name: /Continue/ }),
  );
}

/** Need a refresher? → First letters, passed → From memory. */
async function toFromMemory() {
  await userEvent.click(await offer());
  expect(await screen.findByText(refresherHeader(1))).toBeInTheDocument();
  await checkPassage(answer(0, 0));
  await clickContinue();
  expect(await screen.findByText(refresherHeader(2))).toBeInTheDocument();
  expect(screen.getByText(NOW_TRY_WITHOUT_HINTS)).toBeInTheDocument();
}

function heldArgs() {
  return mutationMock("passageMemory.holdAttempt").mock.calls.map(
    ([args]) =>
      args as { accuracy: number; quality: string; verseScores: unknown },
  );
}

function recordArgs() {
  return mutationMock("passageMemory.recordAttempt").mock.calls.map(
    ([args]) =>
      args as {
        accuracy: number;
        refresherUsed?: boolean;
        replaceHeldId?: string;
        verseScores: unknown;
        now: number;
      },
  );
}

function scores(one: number, two: number) {
  return [
    { chapter: 23, verse: 1, accuracy: one },
    { chapter: 23, verse: 2, accuracy: two },
  ];
}

/** The run's attempts, shown in Today's one end summary. */
function renderSummary(attempts: ReviewSessionAttempt[]) {
  return render(
    <TooltipProvider delayDuration={0}>
      <TodaySessionSummary
        title="Today"
        passages={[]}
        learned={[]}
        attempts={attempts}
        onDone={vi.fn()}
        returnTo="/memory"
      />
    </TooltipProvider>,
  );
}

function headline() {
  return screen.getByText("Average accuracy").previousElementSibling
    ?.textContent;
}

function passageRows() {
  return screen
    .getAllByRole("listitem")
    .filter((row) => row.textContent?.includes(PACK_NAME));
}

describe("Today passage card: held cold miss", () => {
  it.each([
    { accuracy: 59, drop: [60, 22], quality: "off" },
    { accuracy: 60, drop: [50, 30], quality: "close" },
    { accuracy: 84, drop: [16, 16], quality: "close" },
  ])(
    "holds a $accuracy% miss on the card with its projected Next review",
    async ({ accuracy, drop, quality }) => {
      renderRun("alone");
      await checkPassage(answer(drop[0], drop[1]));

      const button = await offer();
      await waitFor(() => expect(button).toHaveFocus());
      expect(screen.getByText(`${accuracy}% recalled`)).toBeInTheDocument();
      // Never to Learning: a bad miss with too few banked reviews floors at
      // the start of Memorized, due tomorrow; a close miss stays Memorized.
      const preview = previewNextSchedule(PASSAGE_SCHEDULE, {
        quality: quality as "off" | "close",
        accuracy,
        mode: "review",
        now: Date.now(),
        item: "passage",
      });
      expect(preview?.status).toBe("reviewing");
      expect(
        screen.getByText(
          `Next review ${formatDueDay(preview!.dueAt, Date.now())}`,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue/ })).toBeEnabled();

      expect(heldArgs()).toEqual([
        expect.objectContaining({
          accuracy,
          quality,
          verseScores: scores(100 - drop[0], 100 - drop[1]),
        }),
      ]);
      expect(
        mutationMock("passageMemory.recordAttempt"),
      ).not.toHaveBeenCalled();
      expect(
        mutationMock("passageMemory.applyHeldAttempt"),
      ).not.toHaveBeenCalled();
    },
  );

  it("floors a bad miss at the start of Memorized, never Learning", async () => {
    const daily = { ...PASSAGE_SCHEDULE, stageReps: 1, intervalDays: 1 };
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[{ ...passageCard, ...daily }]}
          scopeLabel="Today"
          onExit={onExit}
          onComplete={vi.fn()}
        />
      </TooltipProvider>,
    );
    await checkPassage(answer(100, 0));
    await offer();
    const input = {
      quality: "off" as const,
      accuracy: 50,
      mode: "review" as const,
      now: Date.now(),
    };
    // A verse with as few good reviews would drop to Learning.
    expect(
      previewNextSchedule(daily, { ...input, item: "verse" })?.status,
    ).toBe("learning");
    expect(
      previewNextSchedule(daily, { ...input, item: "passage" }),
    ).toMatchObject({ status: "reviewing", intervalDays: 1, stageReps: 0 });
    expect(screen.getByText("Next review tomorrow")).toBeInTheDocument();
  });

  it.each([
    { accuracy: 85, drop: [15, 15] },
    { accuracy: 100, drop: [0, 0] },
  ])("counts a $accuracy% try straight away", async ({ accuracy, drop }) => {
    const { onComplete } = renderRun("alone");
    await checkPassage(answer(drop[0], drop[1]));
    await clickContinue();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(recordArgs()).toEqual([
      expect.objectContaining({
        accuracy,
        verseScores: scores(100 - drop[0], 100 - drop[1]),
      }),
    ]);
    expect(recordArgs()[0]?.replaceHeldId).toBeUndefined();
    expect(recordArgs()[0]?.refresherUsed).toBeUndefined();
    expect(mutationMock("passageMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeNull();
  });

  it.each(["between", "last"] as const)(
    "Continue counts the held miss once and moves on (passage %s)",
    async (order) => {
      const { onComplete } = renderRun(order);
      await reciteVerse(BEFORE_TEXT);
      await checkPassage(answer(60, 22));
      await offer();
      await userEvent.dblClick(
        screen.getByRole("button", { name: /Continue/ }),
      );

      if (order === "between") {
        expect(
          await screen.findByLabelText("Your recalled verse"),
        ).toBeInTheDocument();
        expect(screen.getByText("Verse 3 of 3")).toBeInTheDocument();
        await reciteVerse(AFTER_TEXT);
      }
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
      const apply = mutationMock("passageMemory.applyHeldAttempt");
      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith(
        expect.objectContaining({ heldId: HELD_ID, packId: PACK_ID }),
      );
      expect(
        mutationMock("passageMemory.recordAttempt"),
      ).not.toHaveBeenCalled();
      const rows = onComplete.mock.calls[0][0].attempts.filter(
        (row) => row.label === PACK_NAME,
      );
      expect(rows.map((row) => row.accuracy)).toEqual([59]);
      expect(rows[0]?.schedule).toMatchObject({
        status: "reviewing",
        dueAt: NOW + DAY_MS,
      });
    },
  );

  it("checks a double-activated cold try once", async () => {
    renderRun("alone");
    await type(await passageField(), answer(50, 30));
    await userEvent.dblClick(
      screen.getByRole("button", { name: /Check answer/ }),
    );
    await offer();
    expect(mutationMock("passageMemory.holdAttempt")).toHaveBeenCalledTimes(1);
  });

  it("keeps the miss when it can't be held, and Try again resends it", async () => {
    mutationMock("passageMemory.holdAttempt").mockRejectedValueOnce(
      new Error("offline"),
    );
    renderRun("alone");
    await checkPassage(answer(50, 30));

    expect(await screen.findByText(REFRESH_SAVE_ERROR)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await offer();
    const [first, second] = heldArgs();
    expect(second).toEqual(first);
    expect(screen.queryByText(REFRESH_SAVE_ERROR)).toBeNull();
  });
});

describe("Today passage card: leaving", () => {
  async function back() {
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
  }

  it("counts nothing when left before any checked try", async () => {
    const { unmount } = renderRun("alone");
    await type(await passageField(), answer(50, 30));
    await back();
    unmount();
    expect(mutationMock("passageMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(
      mutationMock("passageMemory.applyHeldAttempt"),
    ).not.toHaveBeenCalled();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("counts the held miss once when left after seeing it", async () => {
    const { unmount } = renderRun("alone");
    await checkPassage(answer(50, 30));
    await offer();
    await back();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    // A reload unmounts the run; the miss must not count twice.
    unmount();
    await waitFor(() =>
      expect(
        mutationMock("passageMemory.applyHeldAttempt"),
      ).toHaveBeenCalledTimes(1),
    );
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it.each([1, 2] as const)(
    "counts the held miss once when left on refresher step %i",
    async (step) => {
      const { unmount } = renderRun("alone");
      await checkPassage(answer(50, 30));
      await userEvent.click(await offer());
      await screen.findByText(refresherHeader(1));
      if (step === 2) {
        await checkPassage(answer(0, 0));
        await clickContinue();
        await screen.findByText(refresherHeader(2));
      }
      await back();
      unmount();
      await waitFor(() =>
        expect(
          mutationMock("passageMemory.applyHeldAttempt"),
        ).toHaveBeenCalledTimes(1),
      );
      expect(
        mutationMock("passageMemory.applyHeldAttempt"),
      ).toHaveBeenCalledWith(expect.objectContaining({ heldId: HELD_ID }));
      expect(
        mutationMock("passageMemory.recordAttempt"),
      ).not.toHaveBeenCalled();
    },
  );
});

describe("Today passage card: refresher", () => {
  it("hints only the held miss's weak verse when there is one", async () => {
    renderRun("alone");
    // 70% overall: verse one 40%, verse two clean.
    await checkPassage(answer(60, 0));
    await userEvent.click(await offer());
    expect(await findHint(hint(true, false))).toBeInTheDocument();
  });

  it("goes by each verse's own score at 84/85", async () => {
    renderRun("alone");
    // 84% overall: verse one 85% (steady), verse two 83% (shaky).
    await checkPassage(answer(15, 17));
    expect(heldArgs()[0]).toMatchObject({
      accuracy: 84,
      verseScores: scores(85, 83),
    });
    await userEvent.click(await offer());
    expect(await findHint(hint(false, true))).toBeInTheDocument();
  });

  it("adds remembered shaky verses to the held miss's", async () => {
    queryResults.set("passageMemory.getForPack", {
      shakyVerses: [{ chapter: 23, verse: 2 }],
    });
    renderRun("alone");
    await checkPassage(answer(60, 0));
    await userEvent.click(await offer());
    expect(await findHint(hint(true, true))).toBeInTheDocument();
  });

  it("hints every verse before a try when no verse is shaky (AC9)", async () => {
    renderRun("alone");
    await userEvent.click(
      await screen.findByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    expect(await screen.findByText(refresherHeader(1))).toBeInTheDocument();
    expect(hintShown(hint(true, true))).toBeInTheDocument();
  });

  it("gives every word only to the verses step 1 missed, in place (F4)", async () => {
    renderRun("alone");
    await userEvent.click(
      await screen.findByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    await screen.findByText(refresherHeader(1));
    // Verse one 100%, verse two 83%: Continue only, and the count grows.
    await checkPassage(answer(0, 17));
    expect(await screen.findByText(refresherHeader(1, 3))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    await clickContinue();
    expect(await screen.findByText(refresherHeader(2, 3))).toBeInTheDocument();
    expect(hintShown(everyWordHint(false, true))).toBeInTheDocument();
    await checkPassage(answer(0, 0));
    await clickContinue();
    expect(await screen.findByText(refresherHeader(3, 3))).toBeInTheDocument();
  });

  it("skips the every-word step when each verse reaches 85% (F3)", async () => {
    renderRun("alone");
    await checkPassage(answer(50, 30));
    await userEvent.click(await offer());
    await screen.findByText(refresherHeader(1));
    await checkPassage(answer(15, 15));
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
    await clickContinue();
    expect(await screen.findByText(refresherHeader(2))).toBeInTheDocument();
  });

  it("retries the every-word step without limit and saves nothing for it", async () => {
    renderRun("alone");
    await checkPassage(answer(50, 30));
    await userEvent.click(await offer());
    await screen.findByText(refresherHeader(1));
    await checkPassage(answer(40, 40));
    await clickContinue();
    for (let round = 0; round < 3; round += 1) {
      expect(
        await screen.findByText(refresherHeader(2, 3)),
      ).toBeInTheDocument();
      expect(hintShown(everyWordHint(true, true))).toBeInTheDocument();
      await checkPassage(answer(40, 40));
      await userEvent.click(
        await screen.findByRole("button", { name: /Try again/ }),
      );
    }
    await checkPassage(answer(15, 15));
    await clickContinue();
    expect(await screen.findByText(refresherHeader(3, 3))).toBeInTheDocument();
    expect(mutationMock("passageMemory.holdAttempt")).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(
      mutationMock("passageMemory.notePracticeRecital"),
    ).not.toHaveBeenCalled();
    expect(
      mutationMock("passageMemory.applyHeldAttempt"),
    ).not.toHaveBeenCalled();
  });

  it.each([
    { miss: "close", drop: [32, 32], first: 68 },
    { miss: "bad", drop: [60, 30], first: 55 },
  ])(
    "replaces a $miss miss with the From memory pass, then moves on",
    async ({ drop, first }) => {
      const { onComplete } = renderRun("between");
      await reciteVerse(BEFORE_TEXT);
      await checkPassage(answer(drop[0], drop[1]));
      await toFromMemory();
      await type(await passageField(), answer(0, 0));
      await userEvent.dblClick(
        screen.getByRole("button", { name: /Check answer/ }),
      );
      await clickContinue();

      expect(await screen.findByText("Verse 3 of 3")).toBeInTheDocument();
      expect(recordArgs()).toEqual([
        expect.objectContaining({
          accuracy: 100,
          refresherUsed: true,
          replaceHeldId: HELD_ID,
          verseScores: scores(100, 100),
        }),
      ]);
      expect(
        mutationMock("passageMemory.applyHeldAttempt"),
      ).not.toHaveBeenCalled();
      await reciteVerse(AFTER_TEXT);
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
      const rows = onComplete.mock.calls[0][0].attempts.filter(
        (row) => row.label === PACK_NAME,
      );
      expect(rows.map((row) => row.accuracy)).toEqual([first, 100]);
    },
  );

  it("saves the same From memory try again after a failed save", async () => {
    mutationMock("passageMemory.recordAttempt").mockRejectedValueOnce(
      new Error("offline"),
    );
    const { onComplete } = renderRun("alone");
    await checkPassage(answer(32, 32));
    await toFromMemory();
    await checkPassage(answer(0, 0));

    expect(await screen.findByText(REFRESH_SAVE_ERROR)).toBeInTheDocument();
    // Nothing moves on or counts until the save lands.
    expect(screen.queryByRole("button", { name: /Continue/ })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await clickContinue();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(
      onComplete.mock.calls[0][0].attempts.map((row) => row.accuracy),
    ).toEqual([68, 100]);
    const [first, second] = recordArgs();
    expect(second).toEqual(first);
    expect(second?.replaceHeldId).toBe(HELD_ID);
  });

  it("keeps Try another refresher practice only after a counted miss", async () => {
    const { onComplete } = renderRun("alone");
    await checkPassage(answer(32, 32));
    await toFromMemory();
    await checkPassage(answer(30, 30));
    await userEvent.click(
      await screen.findByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    await screen.findByText(refresherHeader(1));
    await checkPassage(answer(0, 0));
    await clickContinue();
    await screen.findByText(refresherHeader(2));
    await checkPassage(answer(0, 15));

    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeInTheDocument();
    expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalledTimes(
      1,
    );
    expect(
      mutationMock("passageMemory.notePracticeRecital"),
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        packId: PACK_ID,
        verseScores: scores(100, 85),
      }),
    );
    await clickContinue();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const rows = onComplete.mock.calls[0][0].attempts;
    expect(rows.map((row) => row.accuracy)).toEqual([68, 70]);
  });

  it("counts a pre-try refresher's From memory try with the gap kept", async () => {
    const { onComplete } = renderRun("alone");
    await userEvent.click(
      await screen.findByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    await screen.findByText(refresherHeader(1));
    await checkPassage(answer(0, 0));
    await clickContinue();
    await screen.findByText(refresherHeader(2));
    await checkPassage(answer(4, 0));
    await clickContinue();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(recordArgs()).toEqual([
      expect.objectContaining({ accuracy: 98, refresherUsed: true }),
    ]);
    expect(recordArgs()[0]?.replaceHeldId).toBeUndefined();
    renderSummary(onComplete.mock.calls[0][0].attempts);
    expect(passageRows()).toHaveLength(1);
    expect(passageRows()[0]).toHaveTextContent("98% · Refresher used");
  });
});

describe("Today end summary", () => {
  it("shows a 68% → 100% passage once, averaging both tries to 84%", async () => {
    const { onComplete, unmount } = renderRun("alone");
    await checkPassage(answer(32, 32));
    await toFromMemory();
    await checkPassage(answer(0, 0));
    await clickContinue();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    unmount();

    renderSummary(onComplete.mock.calls[0][0].attempts);
    expect(headline()).toBe("84%");
    expect(passageRows()).toHaveLength(1);
    const row = passageRows()[0];
    expect(row).toHaveTextContent("68% → 100% · Refresher used");
    expect(row).toHaveTextContent(
      `Next review ${formatDueDay(NOW + 4 * DAY_MS, Date.now())}`,
    );
    // Passed after the refresher: no summary Refresh.
    expect(within(row).queryByRole("button", { name: /^Refresh / })).toBeNull();
  });

  it("shows a held miss counted on Continue with its score, bar and next review", async () => {
    const { onComplete, unmount } = renderRun("alone");
    await checkPassage(answer(50, 30));
    await offer();
    await clickContinue();
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const { attempts } = onComplete.mock.calls[0][0];
    unmount();

    renderSummary(attempts);
    // The held try is the run's only counted try.
    expect(headline()).toBe("60%");
    expect(passageRows()).toHaveLength(1);
    const row = passageRows()[0];
    expect(row).toHaveTextContent("60% recalled");
    expect(
      within(row).getByLabelText(/^Progress to mastered: /),
    ).toBeInTheDocument();
    // The date the apply saved, not a projection.
    expect(row).toHaveTextContent(
      `Next review ${formatDueDay(NOW + DAY_MS, Date.now())}`,
    );
    expect(
      within(row).getByRole("button", { name: `Refresh ${PACK_NAME}` }),
    ).toBeInTheDocument();
  });

  it("averages only unhinted counted tries in a mixed run", async () => {
    const { onComplete, unmount } = renderRun("between");
    await reciteVerse(BEFORE_TEXT);

    // Passage: 68% held, First letters (hinted), From memory 70% counted,
    // then a practice round.
    await checkPassage(answer(32, 32));
    await toFromMemory();
    await checkPassage(answer(30, 30));
    await userEvent.click(
      await screen.findByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    await screen.findByText(refresherHeader(1));
    await checkPassage(answer(0, 0));
    await clickContinue();
    await screen.findByText(refresherHeader(2));
    await checkPassage(answer(0, 0));
    await clickContinue();

    // Verse: a held 50% miss, First letters, From memory 100%.
    await type(
      await screen.findByLabelText("Your recalled verse"),
      "Rejoice in the Lord always",
    );
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(await offer());
    await screen.findByText(refresherHeader(1));
    await type(await screen.findByLabelText("Your recalled verse"), AFTER_TEXT);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await clickContinue();
    await screen.findByText(refresherHeader(2));
    await type(await screen.findByLabelText("Your recalled verse"), AFTER_TEXT);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await clickContinue();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const { attempts } = onComplete.mock.calls[0][0];
    expect(attempts.map((row) => row.accuracy)).toEqual([100, 68, 70, 50, 100]);
    unmount();

    renderSummary(attempts);
    // (100 + 68 + 70 + 50 + 100) / 5; no First letters or practice try.
    expect(headline()).toBe("78%");
    expect(passageRows()).toHaveLength(1);
    expect(passageRows()[0]).toHaveTextContent("68% → 70% · Refresher used");
    // Still Memorized after a counted miss: its summary Refresh (R51).
    expect(
      within(passageRows()[0]).getByRole("button", {
        name: `Refresh ${PACK_NAME}`,
      }),
    ).toBeInTheDocument();
  });

  it("opens the passage's summary Refresh as practice and keeps the summary", async () => {
    const attempts: ReviewSessionAttempt[] = [
      {
        reference: span(23, 1),
        label: PACK_NAME,
        accuracy: 65,
        offerPractice: false,
        savedStatus: "reviewing",
        passage: {
          packId: PACK_ID,
          references: passageCard.composite!.members,
        },
      },
    ];
    renderSummary(attempts);
    expect(headline()).toBe("65%");
    await userEvent.click(
      screen.getByRole("button", { name: `Refresh ${PACK_NAME}` }),
    );

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(2));
    expect(navigateMock).toHaveBeenNthCalledWith(1, {
      href: "/memory/today",
      replace: true,
      state: {
        sessionSummary: {
          kind: "today",
          title: "Today",
          passages: [],
          learned: [],
          attempts,
          extraPracticeHref: undefined,
        },
        refreshedPassage: PACK_ID,
      },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, {
      href: `/memory/${PACK_ID}/practice?refresh=1&return=%2Fmemory`,
      state: { summaryRefresh: true },
    });
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();
  });
});

describe("Regressions", () => {
  it("keeps a not-due Memorized passage in Practice as one plain recital", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="practice"
          verses={[{ ...passageCard, dueAt: NOW + 3 * DAY_MS }]}
          scopeLabel={PACK_NAME}
          onExit={onExit}
        />
      </TooltipProvider>,
    );
    await passageField();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeNull();
    await checkPassage(answer(50, 30));
    await screen.findByText("60% recalled");
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeNull();
    expect(mutationMock("passageMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(
      queryCalls.filter(([name, args]) =>
        name === "passageMemory.getForPack" ? args !== "skip" : false,
      ),
    ).toEqual([]);
  });

  it("keeps a whole pack recited together on unified review", async () => {
    mutationMock("packs.recordUnifiedReview").mockResolvedValue(verseSaved);
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[
            {
              ...passageCard,
              composite: {
                ...passageCard.composite!,
                passageStatus: undefined,
              },
            },
          ]}
          scopeLabel={PACK_NAME}
          onExit={onExit}
        />
      </TooltipProvider>,
    );
    await checkPassage(answer(50, 30));
    await screen.findByText("60% recalled");
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeNull();
    expect(mutationMock("packs.recordUnifiedReview")).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.holdAttempt")).not.toHaveBeenCalled();
  });

  it("keeps a verse card's own First letters hint and held miss", async () => {
    renderRun("between");
    await type(
      await screen.findByLabelText("Your recalled verse"),
      "Grace and peace",
    );
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(await offer());
    await screen.findByText(refresherHeader(1));
    expect(hintShown(masked(BEFORE_TEXT, "half"))).toBeInTheDocument();
    expect(mutationMock("verseMemory.holdAttempt")).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.holdAttempt")).not.toHaveBeenCalled();
  });
});
