import { StrictMode } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { mockStepLabelLayout } from "@/test/step-label-layout";
import { getSessionNow } from "@/hooks/use-live-now";
import { formatDueDay } from "@/lib/memorize-plan";
import { verseAttemptAccuracy } from "@/components/study/study-attempt-quality";
import { diffWords } from "@/lib/diff-words";
import { DAY_MS, requiredRepsFor } from "@/lib/memory-scheduler";
import { compositeHintForWindow } from "@/lib/passage-frontier";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  clearPassageStepInProgress,
  PASSAGE_STEP_IN_PROGRESS_KEY,
} from "@/lib/passage-step-resume";
import { testerSectionRecitalPacks } from "@/lib/preview-passage-seed";
import { maskVerseText } from "@/lib/verse-hint";
import type { EsvChapterData } from "../../../../shared/esv-api";
import type { Id } from "../../../../convex/_generated/dataModel";

import {
  BUDGET_EXHAUSTED_COPY,
  CONNECT_COPY,
  CONNECT_RECITE_LABEL,
  CONNECT_TITLE,
  DONE_FOR_NOW_LABEL,
  FRONTIER_LOCKED_COPY,
  NEXT_VERSE_PROMPT_COPY,
  PRACTICE_WHAT_YOU_KNOW_LABEL,
  SECTION_COMPLETE_COPY,
  SECTION_RECITE_LABEL,
  STOP_BEFORE_LABEL,
  WARMUP_PROMPT_COPY,
  WARMUP_SKIP_LABEL,
} from "./passage-session-model";
import { PassageSession, type PassageSummarySnapshot } from "./passage-session";
import type { PassageView } from "./passage-session-types";
import { CARRIED_OVER_SEEN_KEY_PREFIX } from "./use-carried-over-notice";

const { mutationMocks, fetchChaptersBatchMock, queryMock, router } = vi.hoisted(
  () => ({
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    fetchChaptersBatchMock: vi.fn(),
    queryMock: vi.fn<(name: string, args: unknown) => unknown>(),
    router: {
      location: { href: "/memory/pack_1/review", state: {} },
      navigate: vi.fn(),
    },
  }),
);

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select(router.location),
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => queryMock(name, args),
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
    passageMemory: {
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
      notePracticeRecital: "passageMemory.notePracticeRecital",
      holdAttempt: "passageMemory.holdAttempt",
      applyHeldAttempt: "passageMemory.applyHeldAttempt",
      markCelebrated: "passageMemory.markCelebrated",
      recentReviews: "passageMemory.recentReviews",
    },
  },
}));

const PACK_ID = "pack_1" as Id<"packs">;
const PASSAGE_ONE = "The Lord is my shepherd; I shall not want.";
const PASSAGE_TWO = "He makes me lie down in green pastures.";
// Step 1 (first half lettered, see the verse-hint mock) and the every-word
// First letters hints of each verse.
const ONE_HALF = "T__ L___ i_ m_ s_______; _ _____ ___ ____.";
const ONE_EVERY = "T__ L___ i_ m_ s_______; I s____ n__ w___.";
const ONE_BLANK = "___ ____ __ __ ________; _ _____ ___ ____.";
const TWO_HALF = "H_ m____ m_ l__ ____ __ _____ ________.";
const TWO_EVERY = "H_ m____ m_ l__ d___ i_ g____ p_______.";
const TWO_BLANK = "__ _____ __ ___ ____ __ _____ ________.";

const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [
    { number: 1, text: PASSAGE_ONE },
    { number: 2, text: PASSAGE_TWO },
  ],
};

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
    sectionIndex: extra?.sectionIndex ?? 0,
    attachment,
    learnStage: extra?.learnStage ?? 0,
    stageReps: extra?.stageReps ?? 0,
    ...extra,
  };
}

function passageView(
  pieces: PassagePiece[],
  extra?: Partial<PassageView>,
): PassageView {
  const now = getSessionNow();
  const ropePieceIndexes = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const item = pieces[index];
    if (
      !item ||
      (item.attachment !== "attached" && item.attachment !== "solid")
    ) {
      break;
    }
    ropePieceIndexes.push(index);
  }
  const frontierIndex = pieces.findIndex((item) => item.attachment !== "solid");
  return {
    _id: "passage_1" as Id<"passageMemory">,
    packId: PACK_ID,
    status: "building",
    pieces,
    addsOnDay: 0,
    ease: 2.3,
    intervalDays: 0,
    dueAt: now,
    consecutiveCorrect: 0,
    lapses: 0,
    stageReps: 0,
    needsCelebration: false,
    createdAt: now,
    updatedAt: now,
    remainingIntroduces: 5,
    frontierIndex: frontierIndex === -1 ? pieces.length : frontierIndex,
    rehearsalStartIndex: ropePieceIndexes[0] ?? 0,
    ropePieceIndexes,
    ...extra,
  };
}

function renderSession(view: PassageView, onExit: () => void = () => {}) {
  return render(
    <TooltipProvider delayDuration={0}>
      <PassageSession
        packId={PACK_ID}
        view={view}
        packName="Psalm 23"
        onExit={onExit}
      />
    </TooltipProvider>,
  );
}

describe("PassageSession", () => {
  beforeEach(() => {
    mutationMocks.clear();
    // The passage's own review history: none, so never stale by misses.
    queryMock.mockReset();
    queryMock.mockImplementation((_name: string, args: unknown) =>
      args === "skip" ? undefined : [],
    );
    clearPassageStepInProgress(PACK_ID);
    sessionStorage.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    mutationMock("passageMemory.introduceNext").mockResolvedValue(
      passageView([piece(0, "learning"), piece(1, "unreached")], {
        addsOnDay: 1,
        remainingIntroduces: 4,
        frontierIndex: 0,
      }),
    );
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([piece(0, "attached", { learnStage: 2 })], {
        updatedAt: getSessionNow() + 1,
      }),
    );
  });

  function practicedDueView(extra?: Partial<PassageView>): PassageView {
    const now = getSessionNow();
    return passageView(
      [
        piece(0, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
        piece(1, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
        piece(2, "learning", { learnStage: 1, dueAt: now }),
      ],
      extra,
    );
  }

  it("resumes the due verse after a reload mid-step", async () => {
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({ packId: PACK_ID, origin: performance.timeOrigin - 1 }),
    );
    renderSession(practicedDueView());

    expect(
      screen.getByRole("status", { name: "Session phase: First letters" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Warm up" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
  });

  it("opens with a warm-up when reopening a passage practiced earlier today", () => {
    renderSession(
      practicedDueView({ lastSessionAt: getSessionNow() - 60_000 }),
    );

    expect(
      screen.getByRole("status", { name: "Session phase: Warm up" }),
    ).toBeInTheDocument();
    expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: First letters" }),
    ).not.toBeInTheDocument();
  });

  function warmupView(attachment: "attached" | "solid"): PassageView {
    const now = getSessionNow();
    fetchChaptersBatchMock.mockResolvedValue([
      {
        chapter: 23,
        data: {
          ...psalm23,
          verses: [
            ...psalm23.verses,
            {
              number: 3,
              text: "He restores my soul. He leads me in paths of righteousness.",
            },
          ],
        },
      },
    ]);
    const learned = { learnStage: attachment === "solid" ? 3 : 2 };
    return passageView(
      [
        piece(0, attachment, { ...learned, dueAt: now + DAY_MS }),
        piece(1, attachment, { ...learned, dueAt: now + DAY_MS }),
        piece(2, "learning", { learnStage: 1, dueAt: now }),
      ],
      { lastSessionAt: now - 60_000 },
    );
  }

  it("shows where a from-memory warm-up stops", async () => {
    renderSession(warmupView("solid"));

    expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
    const cue = await screen.findByLabelText(STOP_BEFORE_LABEL);
    expect(cue).toHaveTextContent("He restores my soul…");
  });

  it("leaves the stop-before cue off a warm-up that still shows hints", async () => {
    renderSession(warmupView("attached"));

    expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
    expect(await screen.findByLabelText("Hint")).toBeInTheDocument();
    expect(screen.queryByLabelText(STOP_BEFORE_LABEL)).not.toBeInTheDocument();
  });

  /** Skip warm-up, so the day's step starts. */
  async function startDayStep() {
    await userEvent.click(
      await screen.findByRole("button", { name: WARMUP_SKIP_LABEL }),
    );
  }

  it("leaves no in-progress marker during warm-up, so a reload restarts it", async () => {
    const first = renderSession(practicedDueView());
    expect(
      screen.getByRole("status", { name: "Session phase: Warm up" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();

    first.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderSession(practicedDueView());

    expect(
      screen.getByRole("status", { name: "Session phase: Warm up" }),
    ).toBeInTheDocument();
    expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
  });

  it("marks the step in progress once warm-up is skipped", async () => {
    renderSession(practicedDueView());
    await startDayStep();

    expect(
      screen.getByRole("status", { name: "Session phase: First letters" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).not.toBeNull();
  });

  it("clears the in-progress marker when the learner leaves", async () => {
    const onExit = vi.fn();
    renderSession(practicedDueView(), onExit);
    await startDayStep();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).not.toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Back to Memory" }),
    );

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("clears the in-progress marker when the learner goes Home", async () => {
    const onExit = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <PassageSession
          packId={PACK_ID}
          view={practicedDueView()}
          packName="Psalm 23"
          onExit={onExit}
          backLabel="Back to John 3"
          exitHref="/passage/John-3"
        />
      </TooltipProvider>,
    );
    await startDayStep();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).not.toBeNull();

    await userEvent.click(screen.getByRole("link", { name: "Go to Memory" }));

    expect(onExit).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("shows Go to Memory when Back does not go to Memory", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PassageSession
          packId={PACK_ID}
          view={practicedDueView()}
          packName="Psalm 23"
          onExit={() => {}}
          backLabel="Back to John 3"
          exitHref="/passage/John-3"
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Back to John 3" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Memory" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });

  it("hides Go to Memory when Back already goes to Memory", () => {
    renderSession(practicedDueView());

    expect(
      screen.getByRole("button", { name: "Back to Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Go to Memory" }),
    ).not.toBeInTheDocument();
  });

  it("shows the warm-up after leaving without Back and opening on a later page load", async () => {
    const { unmount } = renderSession(practicedDueView());
    await startDayStep();
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).not.toBeNull();

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const leftover = sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY);
    if (leftover) {
      const parsed = JSON.parse(leftover) as { packId: string; origin: number };
      sessionStorage.setItem(
        PASSAGE_STEP_IN_PROGRESS_KEY,
        JSON.stringify({
          packId: parsed.packId,
          origin: performance.timeOrigin - 1,
        }),
      );
    }

    renderSession(practicedDueView());

    expect(
      screen.getByRole("status", { name: "Session phase: Warm up" }),
    ).toBeInTheDocument();
    expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: First letters" }),
    ).not.toBeInTheDocument();
  });

  it("still resumes after a reload when StrictMode remounts the session", () => {
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({ packId: PACK_ID, origin: performance.timeOrigin - 1 }),
    );
    render(
      <StrictMode>
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={practicedDueView()}
            packName="Psalm 23"
            onExit={() => {}}
          />
        </TooltipProvider>
      </StrictMode>,
    );

    expect(
      screen.getByRole("status", { name: "Session phase: First letters" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Warm up" }),
    ).not.toBeInTheDocument();
  });

  it("jumps into a due verse instead of a mixed recitation", async () => {
    renderSession(
      passageView([
        piece(0, "attached", { learnStage: 2 }),
        piece(1, "learning", { learnStage: 0 }),
      ]),
    );

    expect(
      screen.getByRole("status", {
        name: "Session phase: Fill in the blanks",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Rope" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Session phase: Frontier" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your recalled verse")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
  });

  it("auto-starts the first verse instead of an introduce screen", async () => {
    renderSession(passageView([piece(0, "unreached"), piece(1, "unreached")]));

    expect(
      screen.getByLabelText("Starting the first verse"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/introduced a new piece/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /introduce/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.introduceNext").mock
      .calls[0] as [{ packId: string; now: number; tzOffsetMinutes: number }];
    expect(args.packId).toBe(PACK_ID);
    expect(args.now).toEqual(expect.any(Number));
    expect(args.tzOffsetMinutes).toEqual(expect.any(Number));
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();

    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Session phase: Read" }),
    ).toBeInTheDocument();
  });

  it("lets the learner retry when auto-start fails", async () => {
    const onExit = vi.fn();
    mutationMock("passageMemory.introduceNext").mockRejectedValue(
      new Error("ConvexError"),
    );
    renderSession(
      passageView([piece(0, "unreached"), piece(1, "unreached")]),
      onExit,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't start the next verse/i,
    );
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Psalm 23:1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.introduceNext")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("prompts the next verse without a recitation box after today's work", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
        piece(1, "unreached"),
      ]),
      onExit,
    );

    expect(screen.getByText("Psalm 23:1")).toBeInTheDocument();
    expect(screen.getByText(NEXT_VERSE_PROMPT_COPY)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Psalm 23:2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/rope/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/frontier/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mixed-support/i)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.introduceNext")).not.toHaveBeenCalled();
  });

  it("does not render a blank Learn screen when the current verse is locked", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView([
        piece(0, "attached", {
          learnStage: 2,
          dueAt: getSessionNow() + DAY_MS,
        }),
      ]),
      onExit,
    );

    expect(screen.getByText(FRONTIER_LOCKED_COPY)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("ends the session when today's introduce budget is used", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView(
        [piece(0, "solid", { learnStage: 3 }), piece(1, "unreached")],
        { remainingIntroduces: 0, addsOnDay: 5 },
      ),
      onExit,
    );

    expect(screen.getByText(BUDGET_EXHAUSTED_COPY)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Start / }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: DONE_FOR_NOW_LABEL }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.introduceNext")).not.toHaveBeenCalled();
  });

  it("shows the end of the previous verse at From Memory", async () => {
    renderSession(
      passageView([
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "learning", { learnStage: 3, stageReps: 0 }),
      ]),
    );

    expect(
      await screen.findByText("Recall the verse from memory"),
    ).toBeInTheDocument();
    const cue = await screen.findByLabelText("Pick up after");
    expect(cue).toHaveTextContent("my shepherd; I shall not want.");
    expect(cue).not.toHaveTextContent(PASSAGE_TWO);
  });

  it("shows the start of the next verse at From Memory, even on verse 1", async () => {
    renderSession(
      passageView([
        piece(0, "learning", { learnStage: 3, stageReps: 0 }),
        piece(1, "unreached"),
      ]),
    );

    const cue = await screen.findByLabelText(STOP_BEFORE_LABEL);
    expect(cue).toHaveTextContent("He makes me lie…");
    expect(screen.queryByLabelText("Pick up after")).not.toBeInTheDocument();
  });

  it("does not add a stop-before cue on the last verse", async () => {
    renderSession(
      passageView([
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "learning", { learnStage: 3, stageReps: 0 }),
      ]),
    );

    expect(await screen.findByLabelText("Pick up after")).toBeInTheDocument();
    expect(screen.queryByLabelText(STOP_BEFORE_LABEL)).not.toBeInTheDocument();
  });

  it("does not add a pick-up cue while hints are still shown", async () => {
    renderSession(
      passageView([
        piece(0, "solid", { learnStage: 3 }),
        piece(1, "learning", { learnStage: 2, stageReps: 0 }),
      ]),
    );

    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Pick up after")).not.toBeInTheDocument();
  });

  it("does not add a stop-before cue while hints are still shown", async () => {
    renderSession(
      passageView([
        piece(0, "learning", { learnStage: 2, stageReps: 0 }),
        piece(1, "unreached"),
      ]),
    );

    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(STOP_BEFORE_LABEL)).not.toBeInTheDocument();
  });

  it("sends the verse word count with a frontier attempt", async () => {
    renderSession(
      passageView([piece(0, "learning", { learnStage: 0, stageReps: 0 })]),
    );

    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalled();
    });
    const [args] = mutationMock("passageMemory.recordAttempt").mock
      .calls[0] as [{ kind: string; wordCount?: number }];
    expect(args.kind).toBe("frontier");
    expect(args.wordCount).toBeGreaterThan(0);
  });

  it("advances the journey bar on a qualifying check before Continue", async () => {
    const started = piece(0, "learning", { learnStage: 1, stageReps: 0 });
    const progressed = piece(0, "learning", { learnStage: 1, stageReps: 1 });
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([progressed]),
    );

    renderSession(passageView([started]));

    const journeyBefore = await screen.findByLabelText(/Learning journey:/);
    const pctBefore = Number(
      (journeyBefore.getAttribute("aria-label") ?? "").match(/(\d+)%/)?.[1],
    );
    expect(
      screen.getByText(/First letters · 1 of \d+ today/),
    ).toBeInTheDocument();

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.getByText("100% recalled")).toBeVisible();
    await waitFor(() => {
      const journeyAfter = screen.getByLabelText(/Learning journey:/);
      const pctAfter = Number(
        (journeyAfter.getAttribute("aria-label") ?? "").match(/(\d+)%/)?.[1],
      );
      expect(pctAfter).toBeGreaterThan(pctBefore);
    });
    // Step label stays on the graded step; only the journey bar moves early.
    expect(
      screen.getByText(/First letters · 1 of \d+ today/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue|Try again/ }),
    ).toBeInTheDocument();
  });

  it("hands the journey bar to reviewing progress on the final qualifying check", async () => {
    const almostDone = piece(0, "learning", {
      learnStage: 3,
      stageReps: 1,
    });
    const graduated = piece(0, "solid", {
      learnStage: 3,
      stageReps: 0,
    });
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([graduated], { status: "reviewing" }),
    );

    renderSession(passageView([almostDone]));

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByText("Word for word.")).toBeVisible();
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Progress to mastered: Memorized/),
      ).toBeInTheDocument();
    });
  });

  it("marks a newly finished passage with the by-heart moment once", async () => {
    const onExit = vi.fn();
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([piece(0, "solid", { learnStage: 3 })], {
        status: "reviewing",
        needsCelebration: true,
      }),
    );

    renderSession(
      passageView([piece(0, "learning", { learnStage: 3, stageReps: 1 })], {
        createdAt: getSessionNow() - 2 * DAY_MS,
      }),
      onExit,
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    // The result that finished it stays up first.
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutationMock("passageMemory.markCelebrated")).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    const moment = await screen.findByRole("dialog", {
      name: "You can say all of Psalm 23 by heart.",
    });
    expect(moment).toHaveTextContent("1 verse · 3 days");
    expect(moment).toHaveTextContent(PASSAGE_ONE);
    expect(mutationMock("passageMemory.markCelebrated")).toHaveBeenCalledTimes(
      1,
    );
    expect(mutationMock("passageMemory.markCelebrated")).toHaveBeenCalledWith({
      packId: PACK_ID,
    });

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(mutationMock("passageMemory.markCelebrated")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("skips the moment for a passage already celebrated", async () => {
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView([piece(0, "solid", { learnStage: 3 })], {
        status: "reviewing",
        celebratedAt: getSessionNow() - DAY_MS,
      }),
    );

    renderSession(
      passageView([piece(0, "learning", { learnStage: 3, stageReps: 1 })]),
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await screen.findByText("Word for word.");
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutationMock("passageMemory.markCelebrated")).not.toHaveBeenCalled();
  });

  it("shows a missed by-heart moment when the session reopens", async () => {
    const onExit = vi.fn();
    renderSession(
      passageView([piece(0, "solid", { learnStage: 3 })], {
        status: "reviewing",
        needsCelebration: true,
      }),
      onExit,
    );

    const moment = await screen.findByRole("dialog", {
      name: "You can say all of Psalm 23 by heart.",
    });
    expect(moment).toHaveTextContent(PASSAGE_ONE);
    expect(mutationMock("passageMemory.markCelebrated")).toHaveBeenCalledTimes(
      1,
    );

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onExit).not.toHaveBeenCalled();
    expect(mutationMock("passageMemory.markCelebrated")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("never shows the moment for an older passage without the flag", async () => {
    renderSession(
      passageView([piece(0, "solid", { learnStage: 3 })], {
        status: "reviewing",
      }),
    );

    await screen.findByText("Recite the whole passage from memory");
    await screen.findByRole("textbox");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mutationMock("passageMemory.markCelebrated")).not.toHaveBeenCalled();
  });

  describe("carried-over notice", () => {
    const carriedView = () =>
      passageView([
        piece(0, "solid", { learnStage: 3, carriedOver: true }),
        piece(1, "unreached"),
      ]);
    const seenKey = `${CARRIED_OVER_SEEN_KEY_PREFIX}passage_1`;

    beforeEach(() => {
      localStorage.clear();
    });

    it("says once that a memorized verse is skipped, until dismissed", async () => {
      renderSession(carriedView());

      const note = screen.getByRole("note");
      expect(note).toHaveTextContent(
        "Verse 1 is already memorized, so we'll skip ahead.",
      );
      await waitFor(() => expect(localStorage.getItem(seenKey)).toBe("1"));

      await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });

    it("stays quiet once this passage has shown it", () => {
      localStorage.setItem(seenKey, "1");
      renderSession(carriedView());

      expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });

    it("stays quiet without carried-over verses or once reviewing", () => {
      const { unmount } = renderSession(
        passageView([
          piece(0, "solid", { learnStage: 3 }),
          piece(1, "unreached"),
        ]),
      );
      expect(screen.queryByRole("note")).not.toBeInTheDocument();
      unmount();

      renderSession(
        passageView([piece(0, "solid", { learnStage: 3, carriedOver: true })], {
          status: "reviewing",
        }),
      );
      expect(screen.queryByRole("note")).not.toBeInTheDocument();
      expect(localStorage.getItem(seenKey)).toBeNull();
    });
  });

  describe("standalone review", () => {
    const solidPieces = () => [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "solid", { learnStage: 3 }),
    ];
    const savedDueAt = () => getSessionNow() + 3 * DAY_MS;

    beforeEach(() => {
      const saved = passageView(solidPieces(), {
        status: "reviewing",
        dueAt: savedDueAt(),
      });
      mutationMock("passageMemory.recordAttempt").mockResolvedValue(saved);
      mutationMock("passageMemory.holdAttempt").mockResolvedValue({
        heldId: "held_1",
      });
      mutationMock("passageMemory.applyHeldAttempt").mockResolvedValue(saved);
    });

    function renderReview(onExit: () => void = () => {}) {
      return render(
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={passageView(solidPieces(), { status: "reviewing" })}
            packName="Psalm 23"
            onExit={onExit}
            endsAfterReview
          />
        </TooltipProvider>,
      );
    }

    async function check(answer: string) {
      const box = await screen.findByLabelText("Your recited passage");
      await userEvent.click(box);
      await userEvent.paste(answer);
      const button = screen.getByRole("button", { name: /Check answer/ });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
    }

    /** The one counted try: saved directly, or held and then applied. */
    function savedAccuracy(): number {
      const calls = [
        ...mutationMock("passageMemory.recordAttempt").mock.calls,
        ...mutationMock("passageMemory.holdAttempt").mock.calls,
      ] as [{ accuracy: number }][];
      expect(calls).toHaveLength(1);
      return calls[0]?.[0].accuracy ?? -1;
    }

    function countedSaves(): number {
      return (
        mutationMock("passageMemory.recordAttempt").mock.calls.length +
        mutationMock("passageMemory.applyHeldAttempt").mock.calls.length
      );
    }

    it.each([
      ["an exact answer", `${PASSAGE_ONE} ${PASSAGE_TWO}`, [100, 100]],
      ["mistakes", `${PASSAGE_ONE} He makes me sit in pastures.`, [1, 99]],
      ["a 0% answer", "nothing here matches", [0, 0]],
    ] as const)(
      "finishes once with a summary after %s",
      async (_label, answer, [min, max]) => {
        const onExit = vi.fn();
        renderReview(onExit);

        await check(answer);
        await userEvent.click(
          await screen.findByRole("button", { name: /Continue/ }),
        );

        const heading = await screen.findByRole("heading", {
          name: "Review complete",
        });
        expect(heading).toHaveFocus();
        expect(
          screen.getAllByRole("heading", { name: "Review complete" }),
        ).toHaveLength(1);
        const accuracy = savedAccuracy();
        expect(accuracy).toBeGreaterThanOrEqual(min);
        expect(accuracy).toBeLessThanOrEqual(max);
        expect(screen.getByText(`${accuracy}%`)).toBeInTheDocument();
        expect(screen.getByText("Accuracy")).toBeInTheDocument();
        expect(
          screen.getByText("Psalm 23", { selector: "li p" }),
        ).toBeVisible();
        expect(
          screen.getByText(
            `Next review ${formatDueDay(savedDueAt(), getSessionNow())}`,
          ),
        ).toBeInTheDocument();
        // Never back into From memory.
        expect(screen.queryByLabelText("Your recited passage")).toBeNull();
        expect(
          screen.queryByText("Recite the whole passage from memory"),
        ).toBeNull();

        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(onExit).toHaveBeenCalledTimes(1);
        expect(countedSaves()).toBe(1);
      },
    );

    it("drops the step label from the header on the summary", async () => {
      renderReview();
      const header = screen.getByRole("banner");
      expect(
        within(header).getByRole("status", {
          name: "Session phase: Recite it all",
        }),
      ).toBeInTheDocument();

      await check(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
      await userEvent.click(
        await screen.findByRole("button", { name: /Continue/ }),
      );

      await screen.findByRole("heading", { name: "Review complete" });
      expect(
        within(header).queryByRole("status", { name: /Session phase/ }),
      ).toBeNull();
      expect(within(header).queryByText("Recite it all")).toBeNull();
      expect(
        within(header).getByRole("heading", { level: 1, name: "Psalm 23" }),
      ).toBeInTheDocument();
    });

    it("keeps the error and shows no summary when the save fails", async () => {
      mutationMock("passageMemory.recordAttempt").mockRejectedValue(
        new Error("offline"),
      );
      renderReview();

      await check(`${PASSAGE_ONE} ${PASSAGE_TWO}`);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't save that attempt. Please try again.",
      );
      expect(screen.getByLabelText("Your recited passage")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Continue/ })).toBeNull();
      expect(
        screen.queryByRole("heading", { name: "Review complete" }),
      ).toBeNull();
    });
  });

  describe("Memorized review refresher", () => {
    const FULL = `${PASSAGE_ONE} ${PASSAGE_TWO}`;
    // Verse 1 clean, verse 2 at 25%: 65% overall, a close miss.
    const WEAK_TWO = `${PASSAGE_ONE} He makes`;
    const SAVED_DUE = () => getSessionNow() + 2 * DAY_MS;
    const PASSAGE_TOOLTIP =
      "Do a refresher on this passage for some more practice.";

    const memorized = () => [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "solid", { learnStage: 3 }),
    ];
    // Psalm 23:1–2 as one multi-verse learning piece.
    const onePiece = () => [
      piece(0, "solid", { learnStage: 3, startVerse: 1, endVerse: 2 }),
    ];
    const verse = (number: number) => ({ chapter: 23, verse: number });
    const scores = (first: number, second: number) => [
      { ...verse(1), accuracy: first },
      { ...verse(2), accuracy: second },
    ];

    function reviewView(extra?: Partial<PassageView>): PassageView {
      return passageView(memorized(), {
        status: "reviewing",
        intervalDays: 2,
        dueAt: getSessionNow() - 1,
        ...extra,
      });
    }

    beforeEach(() => {
      mutationMock("passageMemory.recordAttempt").mockResolvedValue(
        passageView(memorized(), { status: "reviewing", dueAt: SAVED_DUE() }),
      );
      mutationMock("passageMemory.notePracticeRecital").mockResolvedValue(
        passageView(memorized(), { status: "reviewing", dueAt: SAVED_DUE() }),
      );
      hold().mockResolvedValue({ heldId: "held_1" });
      applyHeld().mockResolvedValue(
        passageView(memorized(), { status: "reviewing", dueAt: SAVED_DUE() }),
      );
    });

    function renderReview(view: PassageView = reviewView()) {
      return render(
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={view}
            packName="Psalm 23"
            onExit={() => {}}
            endsAfterReview
          />
        </TooltipProvider>,
      );
    }

    const record = () => mutationMock("passageMemory.recordAttempt");
    const hold = () => mutationMock("passageMemory.holdAttempt");
    const applyHeld = () => mutationMock("passageMemory.applyHeldAttempt");
    const answerBox = () => screen.getByLabelText("Your recited passage");

    async function check(answer: string) {
      const box = await screen.findByLabelText("Your recited passage");
      await userEvent.click(box);
      await userEvent.paste(answer);
      const button = screen.getByRole("button", { name: /Check answer/ });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
    }

    async function clickButton(name: RegExp | string) {
      await userEvent.click(await screen.findByRole("button", { name }));
    }

    function hintText(): string {
      return screen.getByLabelText("Hint").textContent ?? "";
    }

    async function expectFreshStep(header: string) {
      expect(await screen.findByText(header)).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expect(answerBox()).toHaveValue("");
    }

    it("offers a quiet link only once a due passage's text is loaded", async () => {
      let resolve: (value: unknown) => void = () => {};
      fetchChaptersBatchMock.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      renderReview();
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
      resolve([{ chapter: 23, data: psalm23 }]);
      expect(
        await screen.findByRole("button", { name: "Need a refresher?" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Recite the whole passage from memory"),
      ).toBeInTheDocument();
      expect(screen.getByText("2 verses · whole passage")).toBeInTheDocument();
    });

    it("shows no link on a text error or while learning", async () => {
      fetchChaptersBatchMock.mockRejectedValue(new Error("offline"));
      const { unmount } = renderReview();
      expect(
        await screen.findByText("Could not load verse text."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
      unmount();

      fetchChaptersBatchMock.mockResolvedValue([
        { chapter: 23, data: psalm23 },
      ]);
      // Recite it all while learning shows the same empty panel, without a
      // link: only the warm-up and the section recital refresh (S15).
      renderSession(passageView(memorized()));
      await screen.findByText(/No hint text/);
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
    });

    it("runs a pre-try refresher: First letters counts nothing, From memory counts and keeps it", async () => {
      renderReview(reviewView({ shakyVerses: [verse(2)] }));
      await clickButton("Need a refresher?");
      await expectFreshStep("Refresh · First letters · 1 of 2");
      // Only the shaky verse 2 is hinted, on half its words; verse 1 before
      // it stays blank.
      expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);

      // Step 1 under 85% only continues, and the count grows to 3 (F9).
      await check("The Lord");
      expect(await screen.findByText(/recalled/)).toBeInTheDocument();
      expect(
        screen.getByText("Refresh · First letters · 1 of 3"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      // Both verses missed, so both get every word, verse 1 included.
      expect(hintText()).toBe(`${ONE_EVERY} ${TWO_EVERY}`);

      // The every-word step retries on the same hint (F10).
      await check("The Lord");
      await clickButton(/Try again/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      expect(hintText()).toBe(`${ONE_EVERY} ${TWO_EVERY}`);

      await check(FULL);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 3 of 3");
      expect(
        screen.getByText("Now try it without the hints."),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Hint")).toBeNull();
      expect(answerBox()).toHaveAttribute(
        "placeholder",
        "Type the passage from memory",
      );
      expect(
        screen.getByText("Recite the whole passage from memory"),
      ).toBeInTheDocument();
      expect(record()).not.toHaveBeenCalled();

      await check(FULL);
      expect(record()).toHaveBeenCalledTimes(1);
      expect(record()).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "review",
          accuracy: 100,
          refresherUsed: true,
          replaceHeldId: undefined,
          verseScores: scores(100, 100),
        }),
      );
      expect(
        await screen.findByText(
          `Next review ${formatDueDay(SAVED_DUE(), getSessionNow())}`,
        ),
      ).toBeInTheDocument();
      await clickButton(/Continue/);
      expect(
        await screen.findByRole("heading", { name: "Review complete" }),
      ).toBeInTheDocument();
      // No first try to show: the From memory score and the note, as a verse.
      expect(screen.getByText("100% · Refresher used")).toBeInTheDocument();
    });

    it("hints every verse when none is shaky or when all are (AC9)", async () => {
      const { unmount } = renderReview();
      await clickButton("Need a refresher?");
      await screen.findByText("Refresh · First letters · 1 of 2");
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      unmount();

      renderReview(reviewView({ shakyVerses: [verse(1), verse(2)] }));
      await clickButton("Need a refresher?");
      await screen.findByText("Refresh · First letters · 1 of 2");
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
    });

    it("skips the every-word step when every verse reaches 85% (F3)", async () => {
      renderReview(reviewView({ shakyVerses: [verse(2)] }));
      await clickButton("Need a refresher?");
      await check(FULL);
      expect(
        screen.getByText("Refresh · First letters · 1 of 2"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 2 of 2");
      expect(screen.queryByLabelText("Hint")).toBeNull();
      expect(record()).not.toHaveBeenCalled();
    });

    it("gives every word only to the verses step 1 missed (F4, S11)", async () => {
      // Nothing shaky and no held miss: step 1 half-hints every verse (AC9).
      renderReview();
      await clickButton("Need a refresher?");
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      await check(PASSAGE_ONE);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      // Verse 1 passed and stays blank in place; the range is unchanged.
      expect(hintText()).toBe(`${ONE_BLANK} ${TWO_EVERY}`);
      await check(FULL);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 3 of 3");
      expect(record()).not.toHaveBeenCalled();
    });

    // Top bar ends at 105; the new step's answer box starts below the fold.
    it.each([
      ["fully in view stays put", 159, 159],
      ["partly under the top bar scrolls to the top", 99, 105],
      ["above the scroll area scrolls to the top", -40, 105],
    ])(
      "on Continue, a next step's label %s; Try again does not reveal it (#379)",
      async (_, labelTop, settledTop) => {
        const layout = mockStepLabelLayout(labelTop);
        try {
          renderReview();
          await clickButton("Need a refresher?");
          await check("The Lord");
          layout.scrollToTop();
          await clickButton(/Continue/);
          await expectFreshStep("Refresh · First letters · 2 of 3");
          // Measured only once the new card has eased in.
          await waitFor(() => expect(layout.labelMeasures).not.toEqual([]));
          expect(layout.labelMeasures.every((m) => m.settled)).toBe(true);
          expect(layout.labelTop()).toBe(settledTop);
          const scrolls = layout.labelScrolls.length;
          expect(scrolls).toBe(labelTop === settledTop ? 0 : 1);

          await check("The Lord");
          await clickButton(/Try again/);
          await expectFreshStep("Refresh · First letters · 2 of 3");
          expect(layout.labelScrolls).toHaveLength(scrolls);
        } finally {
          layout.restore();
        }
      },
    );

    it("holds a cold miss on the server and counts it on Continue", async () => {
      renderReview();
      await check(WEAK_TWO);
      const offer = await screen.findByRole("button", {
        name: "Need a refresher?",
      });
      await waitFor(() => expect(offer).toHaveFocus());
      expect(screen.getByText(PASSAGE_TOOLTIP)).toBeInTheDocument();
      expect(screen.getByText(/65% recalled/)).toBeInTheDocument();
      expect(screen.getByText(/^Next review /)).toBeInTheDocument();
      expect(hold()).toHaveBeenCalledTimes(1);
      expect(hold()).toHaveBeenCalledWith(
        expect.objectContaining({ accuracy: 65, verseScores: scores(100, 25) }),
      );
      expect(record()).not.toHaveBeenCalled();
      expect(applyHeld()).not.toHaveBeenCalled();

      await clickButton(/Continue/);
      expect(applyHeld()).toHaveBeenCalledTimes(1);
      expect(applyHeld()).toHaveBeenCalledWith(
        expect.objectContaining({ heldId: "held_1", packId: PACK_ID }),
      );
      expect(
        await screen.findByRole("heading", { name: "Review complete" }),
      ).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
      expect(record()).not.toHaveBeenCalled();
    });

    it("shows no offer until the miss is held, and retries the same hold", async () => {
      hold().mockRejectedValueOnce(new Error("offline"));
      renderReview();
      await check(WEAK_TWO);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't save your result. Try again.",
      );
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
      expect(screen.queryByText(/^Next review /)).toBeNull();

      await clickButton(/Try again/);
      const offer = await screen.findByRole("button", {
        name: "Need a refresher?",
      });
      await waitFor(() => expect(offer).toHaveFocus());
      const [first, second] = hold().mock.calls as unknown[][];
      expect(second?.[0]).toEqual(first?.[0]);
    });

    it("saves an 85%+ cold try right away with no offer", async () => {
      renderReview();
      // 16 of 17 words: 94%.
      await check(`${PASSAGE_ONE} He makes me lie down in green`);
      expect(record()).toHaveBeenCalledTimes(1);
      await screen.findByRole("button", { name: /Continue/ });
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
    });

    it("summarizes the cold try, then From memory, and averages only those", async () => {
      renderReview();
      // Seven exact words, two small typos, three more exact, five missing:
      // (10 + 2 × 0.8) / 17 = 68%.
      await check("The Lorf is my shepherf; I shall not want. He makes me");
      expect(await screen.findByText(/68% recalled/)).toBeInTheDocument();
      await clickButton("Need a refresher?");
      // First letters misses and a pass never reach the summary.
      await check("The Lord");
      await clickButton(/Continue/);
      await check("The Lord");
      await clickButton(/Try again/);
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 3 of 3");
      await check(FULL);
      await clickButton(/Continue/);

      await screen.findByRole("heading", { name: "Review complete" });
      expect(screen.getByText("84%")).toBeInTheDocument();
      expect(
        screen.getByText("68% → 100% · Refresher used"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `Next review ${formatDueDay(SAVED_DUE(), getSessionNow())}`,
        ),
      ).toBeInTheDocument();
    });

    it("still shows one score when no refresher was used", async () => {
      renderReview();
      await check(`${PASSAGE_ONE} He makes me lie down in green`);
      await clickButton(/Continue/);
      await screen.findByRole("heading", { name: "Review complete" });
      expect(screen.getByText("94%")).toBeInTheDocument();
      expect(screen.queryByText(/Refresher used/)).toBeNull();
      expect(screen.queryByText(/→/)).toBeNull();
    });

    it("hints the held miss's weak verses at once, then replaces the miss", async () => {
      renderReview();
      await check(WEAK_TWO);
      await clickButton("Need a refresher?");
      await expectFreshStep("Refresh · First letters · 1 of 2");
      expect(hintText()).toMatch(/^[_\s;.]+ H_ m____/);
      expect(record()).not.toHaveBeenCalled();

      await check(FULL);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 2 of 2");
      await check(FULL);

      expect(record()).toHaveBeenCalledTimes(1);
      expect(record()).toHaveBeenCalledWith(
        expect.objectContaining({
          accuracy: 100,
          refresherUsed: true,
          replaceHeldId: "held_1",
          verseScores: scores(100, 100),
        }),
      );
      await screen.findByText(/^Next review /);
      await clickButton(/Continue/);
      await screen.findByRole("heading", { name: "Review complete" });
      // Both unhinted tries count: (65 + 100) / 2, rounded.
      expect(screen.getByText("83%")).toBeInTheDocument();
      expect(
        screen.getByText("65% → 100% · Refresher used"),
      ).toBeInTheDocument();
      expect(record()).toHaveBeenCalledTimes(1);
      expect(applyHeld()).not.toHaveBeenCalled();
    });

    it("counts a seen miss by its held id when leaving the result or its refresher", async () => {
      const first = renderReview();
      await check(WEAK_TWO);
      await screen.findByRole("button", { name: "Need a refresher?" });
      first.unmount();
      expect(applyHeld()).toHaveBeenCalledTimes(1);
      expect(applyHeld()).toHaveBeenLastCalledWith(
        expect.objectContaining({ heldId: "held_1" }),
      );

      hold().mockResolvedValue({ heldId: "held_2" });
      const second = renderReview();
      await check(WEAK_TWO);
      await clickButton("Need a refresher?");
      await screen.findByText("Refresh · First letters · 1 of 2");
      window.dispatchEvent(new Event("pagehide"));
      expect(applyHeld()).toHaveBeenCalledTimes(2);
      expect(applyHeld()).toHaveBeenLastCalledWith(
        expect.objectContaining({ heldId: "held_2" }),
      );
      // Already applied on pagehide: unmounting does not apply it again.
      second.unmount();
      expect(applyHeld()).toHaveBeenCalledTimes(2);
      expect(record()).not.toHaveBeenCalled();
    });

    it("leaves a held miss to the server when the tab dies, and a reload opens fresh", async () => {
      const first = renderReview();
      await check(WEAK_TWO);
      await screen.findByRole("button", { name: "Need a refresher?" });
      // The leave-time apply never lands; the held row stays for the next
      // load or the backstop, which apply it once (held-passage-attempts.test).
      applyHeld().mockRejectedValueOnce(new Error("tab closed"));
      first.unmount();
      expect(applyHeld()).toHaveBeenCalledTimes(1);

      // After the reload the passage is no longer due: a miss is practice.
      renderReview(reviewView({ dueAt: SAVED_DUE() }));
      await check(WEAK_TWO);
      await screen.findByText("Practice only, your progress didn't change.");
      expect(hold()).toHaveBeenCalledTimes(1);
      expect(record()).not.toHaveBeenCalled();
    });

    it("counts nothing when leaving a pre-try refresher", async () => {
      const { unmount } = renderReview();
      await clickButton("Need a refresher?");
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
      unmount();
      expect(record()).not.toHaveBeenCalled();
      expect(hold()).not.toHaveBeenCalled();
      expect(applyHeld()).not.toHaveBeenCalled();
      expect(
        mutationMock("passageMemory.notePracticeRecital"),
      ).not.toHaveBeenCalled();
    });

    it("retries the same From memory result after a failed save", async () => {
      let finish: (value: unknown) => void = () => {};
      const pendingSave = new Promise((done) => {
        finish = done;
      });
      record()
        .mockRejectedValueOnce(new Error("offline"))
        .mockReturnValueOnce(pendingSave);
      renderReview();
      await clickButton("Need a refresher?");
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
      await check(FULL);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't save your result. Try again.",
      );
      expect(screen.queryByText(/^Next review /)).toBeNull();
      const retry = screen.getByRole("button", { name: /Try again/ });
      await waitFor(() => expect(retry).toHaveFocus());
      await userEvent.dblClick(retry);
      expect(
        await screen.findByRole("button", { name: "Saving..." }),
      ).toBeDisabled();
      expect(record()).toHaveBeenCalledTimes(2);
      const [first, second] = record().mock.calls as unknown[][];
      expect(second?.[0]).toEqual(first?.[0]);

      finish(
        passageView(memorized(), { status: "reviewing", dueAt: SAVED_DUE() }),
      );
      expect(await screen.findByText(/^Next review /)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
      await clickButton(/Continue/);
      await screen.findByRole("heading", { name: "Review complete" });
      expect(record()).toHaveBeenCalledTimes(2);
    });

    it("keeps a held miss when applying it fails, then applies the same one", async () => {
      applyHeld().mockRejectedValueOnce(new Error("offline"));
      renderReview();
      await check(WEAK_TWO);
      await clickButton(/Continue/);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't save your result. Try again.",
      );
      await clickButton(/Try again/);
      await screen.findByRole("heading", { name: "Review complete" });
      expect(applyHeld()).toHaveBeenCalledTimes(2);
      const [first, second] = applyHeld().mock.calls as [{ heldId: string }][];
      expect(second?.[0].heldId).toBe(first?.[0].heldId);
      expect(hold()).toHaveBeenCalledTimes(1);
      expect(record()).not.toHaveBeenCalled();
    });

    it("lets a counted refresher miss stand; another refresher is practice only", async () => {
      renderReview();
      await clickButton("Need a refresher?");
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
      await check(WEAK_TWO);
      expect(record()).toHaveBeenCalledTimes(1);

      await clickButton("Try another refresher");
      await expectFreshStep("Refresh · First letters · 1 of 2");
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
      await check(FULL);

      expect(
        await screen.findByText("Practice only, your progress didn't change."),
      ).toBeInTheDocument();
      expect(mutationMock("passageMemory.notePracticeRecital")).toBeCalledWith(
        expect.objectContaining({ verseScores: scores(100, 100) }),
      );
      expect(record()).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: "Try another refresher" }),
      ).toBeInTheDocument();
      await clickButton(/Continue/);
      await screen.findByRole("heading", { name: "Review complete" });
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    describe("••• and summary Refresh (S13)", () => {
      const BACK = "Back to Psalm 23";
      const COUNTED = "Counted as today's review";
      const PRACTICE_ONLY = "Practice only, your progress didn't change.";
      const practice = () => mutationMock("passageMemory.notePracticeRecital");

      beforeEach(() => {
        router.navigate.mockReset();
        router.navigate.mockResolvedValue(undefined);
        router.location = { href: "/memory/pack_1/review", state: {} };
      });

      function renderRefresh(
        refresh: "review" | "practice",
        view: PassageView = reviewView(),
      ) {
        const onExit = vi.fn();
        const utils = render(
          <TooltipProvider delayDuration={0}>
            <PassageSession
              packId={PACK_ID}
              view={view}
              packName="Psalm 23"
              onExit={onExit}
              backLabel={BACK}
              endsAfterReview={refresh === "review"}
              refresh={refresh}
            />
          </TooltipProvider>,
        );
        return { onExit, ...utils };
      }

      /** First letters passed, now on the unhinted From memory step. */
      async function toFromMemory() {
        await check(FULL);
        await clickButton(/Continue/);
        await expectFreshStep("Refresh · From memory · 2 of 2");
        expect(
          screen.getByText("Now try it without the hints."),
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Hint")).toBeNull();
      }

      function expectNothingCounted() {
        expect(record()).not.toHaveBeenCalled();
        expect(hold()).not.toHaveBeenCalled();
        expect(applyHeld()).not.toHaveBeenCalled();
      }

      it("opens at First letters over the whole passage, never a cold prompt", async () => {
        let resolve: (value: unknown) => void = () => {};
        fetchChaptersBatchMock.mockReturnValue(
          new Promise((done) => {
            resolve = done;
          }),
        );
        renderRefresh("review");
        expect(
          screen.getByText("Refresh · First letters · 1 of 2"),
        ).toBeInTheDocument();
        expect(screen.queryByText(/No hint text/)).toBeNull();
        resolve([{ chapter: 23, data: psalm23 }]);
        await expectFreshStep("Refresh · First letters · 1 of 2");
        expect(
          screen.getByText("2 verses · whole passage"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Recite the whole passage from memory"),
        ).toBeInTheDocument();
        expect(screen.queryByText(/No hint text/)).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Need a refresher?" }),
        ).toBeNull();
      });

      it.each(["review", "practice"] as const)(
        "hints every verse when none is shaky (%s)",
        async (refresh) => {
          renderRefresh(refresh);
          await screen.findByLabelText("Hint");
          expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
        },
      );

      it("gives every word only to the fallback verses step 1 missed (F4)", async () => {
        renderRefresh("practice");
        await screen.findByLabelText("Hint");
        await check(`${PASSAGE_ONE} He makes`);
        expect(
          screen.getByText("Refresh · First letters · 1 of 3"),
        ).toBeInTheDocument();
        await clickButton(/Continue/);
        await expectFreshStep("Refresh · First letters · 2 of 3");
        expect(hintText()).toBe(`${ONE_BLANK} ${TWO_EVERY}`);
      });

      it("hints only the shaky verses, never the verse before one", async () => {
        const { unmount } = renderRefresh(
          "review",
          reviewView({ shakyVerses: [verse(2)] }),
        );
        await screen.findByLabelText("Hint");
        expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);
        unmount();

        renderRefresh(
          "practice",
          reviewView({ shakyVerses: [verse(1), verse(2)] }),
        );
        await screen.findByLabelText("Hint");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      });

      it("hints a shaky verse alone inside a multi-verse piece", async () => {
        renderRefresh(
          "review",
          reviewView({ pieces: onePiece(), shakyVerses: [verse(1)] }),
        );
        await screen.findByLabelText("Hint");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_BLANK}`);
      });

      it("hints every verse on Try another refresher too, as on the first round (AC9)", async () => {
        const { unmount } = renderRefresh("review");
        await toFromMemory();
        await check(WEAK_TWO);
        await clickButton("Try another refresher");
        await expectFreshStep("Refresh · First letters · 1 of 2");
        // The saved view marks nothing shaky: every verse, never all blanks.
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
        unmount();

        renderRefresh("practice");
        await toFromMemory();
        await check(FULL);
        await clickButton("Try another refresher");
        await expectFreshStep("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      });

      it("retries the every-word step without limit and counts nothing for it", async () => {
        renderRefresh("review");
        await check("The Lord");
        expect(screen.queryByText(COUNTED)).toBeNull();
        await clickButton(/Continue/);
        for (let round = 0; round < 3; round += 1) {
          await expectFreshStep("Refresh · First letters · 2 of 3");
          expect(hintText()).toBe(`${ONE_EVERY} ${TWO_EVERY}`);
          await check("The Lord");
          expect(await screen.findByText(/recalled/)).toBeInTheDocument();
          expect(screen.queryByText(COUNTED)).toBeNull();
          await clickButton(/Try again/);
        }
        await check(FULL);
        await clickButton(/Continue/);
        await expectFreshStep("Refresh · From memory · 3 of 3");
        expectNothingCounted();
        expect(practice()).not.toHaveBeenCalled();
      });

      it.each([
        ["100%", FULL, 100],
        ["94%", `${PASSAGE_ONE} He makes me lie down in green`, 94],
        ["65%", WEAK_TWO, 65],
        ["53%", PASSAGE_ONE, 53],
        ["0%", "nothing here matches", 0],
      ])(
        "counts a due From memory %s once, then goes back with no summary (R30)",
        async (_label, answer, accuracy) => {
          const { onExit } = renderRefresh("review");
          await toFromMemory();
          await check(answer);

          expect(
            await screen.findByText(
              `Next review ${formatDueDay(SAVED_DUE(), getSessionNow())}`,
            ),
          ).toBeInTheDocument();
          expect(screen.getByText(COUNTED)).toBeInTheDocument();
          expect(screen.queryByText(PRACTICE_ONLY)).toBeNull();
          expect(record()).toHaveBeenCalledTimes(1);
          expect(record()).toHaveBeenCalledWith(
            expect.objectContaining({
              kind: "review",
              accuracy,
              refresherUsed: true,
              replaceHeldId: undefined,
            }),
          );
          // No held cold miss, so no post-miss softening.
          expect(hold()).not.toHaveBeenCalled();
          expect(practice()).not.toHaveBeenCalled();
          expect(
            screen.queryByRole("button", { name: "Try another refresher" }),
          ).toSatisfy((offer) => (accuracy < 85 ? offer !== null : !offer));

          await clickButton(/Continue/);
          expect(onExit).toHaveBeenCalledTimes(1);
          expect(
            screen.queryByRole("heading", { name: "Review complete" }),
          ).toBeNull();
          expect(record()).toHaveBeenCalledTimes(1);
          expect(applyHeld()).not.toHaveBeenCalled();
        },
      );

      it("shows no counted line or date until the save lands, then retries the same result", async () => {
        let finish: (value: unknown) => void = () => {};
        record()
          .mockRejectedValueOnce(new Error("offline"))
          .mockReturnValueOnce(
            new Promise((done) => {
              finish = done;
            }),
          );
        const { onExit } = renderRefresh("review");
        await toFromMemory();
        await check(WEAK_TWO);

        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Couldn't save your result. Try again.",
        );
        expect(screen.queryByText(COUNTED)).toBeNull();
        expect(screen.queryByText(/^Next review /)).toBeNull();
        await userEvent.dblClick(
          screen.getByRole("button", { name: /Try again/ }),
        );
        expect(
          await screen.findByRole("button", { name: "Saving..." }),
        ).toBeDisabled();
        expect(screen.queryByText(COUNTED)).toBeNull();
        expect(record()).toHaveBeenCalledTimes(2);
        const [first, second] = record().mock.calls as unknown[][];
        expect(second?.[0]).toEqual(first?.[0]);

        finish(
          passageView(memorized(), { status: "reviewing", dueAt: SAVED_DUE() }),
        );
        expect(await screen.findByText(COUNTED)).toBeInTheDocument();
        expect(onExit).not.toHaveBeenCalled();
        await clickButton(/Continue/);
        expect(onExit).toHaveBeenCalledTimes(1);
        expect(record()).toHaveBeenCalledTimes(2);
      });

      it.each(["First letters", "every-word First letters", "From memory"])(
        "counts nothing on Back from %s",
        async (step) => {
          const { onExit } = renderRefresh("review");
          await screen.findByLabelText("Hint");
          if (step === "From memory") await toFromMemory();
          if (step === "every-word First letters") {
            await check("The Lord");
            await clickButton(/Continue/);
            await expectFreshStep("Refresh · First letters · 2 of 3");
          }
          await userEvent.click(screen.getByRole("button", { name: BACK }));
          expect(onExit).toHaveBeenCalledTimes(1);
          expectNothingCounted();
          expect(practice()).not.toHaveBeenCalled();
        },
      );

      it.each([
        ["a not-due menu Refresh (R50)", "review" as const, SAVED_DUE],
        ["a summary Refresh (R51)", "practice" as const, SAVED_DUE],
        [
          "a summary Refresh even if due",
          "practice" as const,
          () => getSessionNow() - 1,
        ],
      ])(
        "keeps %s practice only, pass or miss",
        async (_label, refresh, dueAt) => {
          const { onExit } = renderRefresh(
            refresh,
            reviewView({ dueAt: dueAt() }),
          );
          await check("The Lord");
          await clickButton(/Continue/);
          await check(FULL);
          await clickButton(/Continue/);
          await expectFreshStep("Refresh · From memory · 3 of 3");
          // First letters never touches shaky metadata.
          expect(practice()).not.toHaveBeenCalled();

          await check(WEAK_TWO);
          expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
          expect(screen.queryByText(COUNTED)).toBeNull();
          expect(screen.queryByText(/^Next review /)).toBeNull();
          expect(practice()).toHaveBeenCalledWith(
            expect.objectContaining({ verseScores: scores(100, 25) }),
          );
          await clickButton("Try another refresher");
          await toFromMemory();
          await check(FULL);
          expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
          expect(practice()).toHaveBeenLastCalledWith(
            expect.objectContaining({ verseScores: scores(100, 100) }),
          );

          await clickButton(/Continue/);
          expect(onExit).toHaveBeenCalledTimes(1);
          expectNothingCounted();
          expect(
            screen.queryByRole("heading", { name: "Review complete" }),
          ).toBeNull();
        },
      );

      it("adopts the shaky verses a practice recital leaves (AC29)", async () => {
        // The server cleared verse 1 at 85%+ and kept verse 2 at 84%.
        practice().mockResolvedValue(
          passageView(memorized(), {
            status: "reviewing",
            dueAt: SAVED_DUE(),
            shakyVerses: [verse(2)],
          }),
        );
        renderRefresh(
          "practice",
          reviewView({ dueAt: SAVED_DUE(), shakyVerses: [verse(1), verse(2)] }),
        );
        await toFromMemory();
        await check(WEAK_TWO);
        await clickButton("Try another refresher");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toMatch(/^[_\s;.]+ H_ m____/);
        expect(hintText()).not.toMatch(/T__/);
      });

      it("keeps the practice result when shaky metadata can't save", async () => {
        practice().mockRejectedValue(new Error("offline"));
        renderRefresh("practice", reviewView({ dueAt: SAVED_DUE() }));
        await toFromMemory();
        await check(FULL);
        expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(
          screen.getByRole("button", { name: /Continue/ }),
        ).toBeInTheDocument();
      });

      describe("summary Refresh (R51)", () => {
        const refreshButton = () =>
          screen.findByRole("button", { name: "Refresh Psalm 23" });

        /** A finished review: its rows and accuracy, as they show. */
        async function finishedSummary(steps: () => Promise<void>) {
          const utils = renderReview();
          await steps();
          await clickButton(/Continue/);
          await screen.findByRole("heading", { name: "Review complete" });
          return utils;
        }

        function expectSummary(accuracy: string, line?: string) {
          expect(screen.getByText(accuracy)).toBeInTheDocument();
          expect(screen.getByText("Accuracy")).toBeInTheDocument();
          expect(
            screen.getByText("Psalm 23", { selector: "li p" }),
          ).toBeVisible();
          if (line) expect(screen.getByText(line)).toBeInTheDocument();
          expect(
            screen.getByText(
              `Next review ${formatDueDay(SAVED_DUE(), getSessionNow())}`,
            ),
          ).toBeInTheDocument();
        }

        it("offers it on a counted cold miss and on a bad miss", async () => {
          const { unmount } = await finishedSummary(() => check(WEAK_TWO));
          expectSummary("65%");
          expect(await refreshButton()).toBeInTheDocument();
          unmount();

          hold().mockClear();
          await finishedSummary(() => check("nothing here matches"));
          expectSummary("0%");
          expect(await refreshButton()).toBeInTheDocument();
        });

        it("offers it after a pre-try refresher's From memory miss", async () => {
          await finishedSummary(async () => {
            await clickButton("Need a refresher?");
            await check(FULL);
            await clickButton(/Continue/);
            await screen.findByText("Refresh · From memory · 2 of 2");
            await check(WEAK_TWO);
          });
          expectSummary("65%", "65% · Refresher used");
          expect(await refreshButton()).toBeInTheDocument();
        });

        it("goes by the last counted try: none after 65% → 100%", async () => {
          await finishedSummary(async () => {
            await check(WEAK_TWO);
            await clickButton("Need a refresher?");
            await check(FULL);
            await clickButton(/Continue/);
            await screen.findByText("Refresh · From memory · 2 of 2");
            await check(FULL);
          });
          expectSummary("83%", "65% → 100% · Refresher used");
          expect(
            screen.queryByRole("button", { name: "Refresh Psalm 23" }),
          ).toBeNull();
        });

        it("ends the row on a practice round without counting it", async () => {
          await finishedSummary(async () => {
            await clickButton("Need a refresher?");
            await check(FULL);
            await clickButton(/Continue/);
            await screen.findByText("Refresh · From memory · 2 of 2");
            await check(WEAK_TWO);
            await clickButton("Try another refresher");
            await check(FULL);
            await clickButton(/Continue/);
            await screen.findByText("Refresh · From memory · 2 of 2");
            await check(FULL);
          });
          // The 100% shows on the row but not the headline or Refresh.
          expectSummary("65%", "65% → 100% · Refresher used");
          expect(await refreshButton()).toBeInTheDocument();
        });

        it("hides it on a counted pass", async () => {
          await finishedSummary(() =>
            check(`${PASSAGE_ONE} He makes me lie down in green`),
          );
          expectSummary("94%");
          expect(
            screen.queryByRole("button", { name: "Refresh Psalm 23" }),
          ).toBeNull();
        });

        it("keeps the summary on its entry, then opens a practice-only Refresh", async () => {
          await finishedSummary(() => check(WEAK_TWO));
          await userEvent.click(await refreshButton());

          await waitFor(() => expect(router.navigate).toHaveBeenCalledTimes(2));
          expect(router.navigate).toHaveBeenNthCalledWith(1, {
            href: "/memory/pack_1/review",
            replace: true,
            state: {
              sessionSummary: {
                kind: "passage",
                packId: PACK_ID,
                title: "Psalm 23",
                attempts: [expect.objectContaining({ accuracy: 65 })],
                dueAt: SAVED_DUE(),
                status: "reviewing",
              },
              refreshedPassage: PACK_ID,
            },
          });
          expect(router.navigate).toHaveBeenNthCalledWith(2, {
            href: "/memory/pack_1/practice?refresh=1&return=%2Fmemory",
            state: { summaryRefresh: true },
          });
        });

        it("shows the R34 error in the row, keeps the summary and focus, then retries into step 1", async () => {
          await finishedSummary(() => check(WEAK_TWO));
          const saves = [record(), hold(), applyHeld(), practice()].map(
            (mock) => mock.mock.calls.length,
          );
          sessionStorage.clear();
          let fail: (error: Error) => void = () => {};
          let resolve: (value: unknown) => void = () => {};
          fetchChaptersBatchMock
            .mockReturnValueOnce(
              new Promise((_, reject) => {
                fail = reject;
              }),
            )
            .mockReturnValueOnce(
              new Promise((done) => {
                resolve = done;
              }),
            );
          const button = await refreshButton();
          await userEvent.click(button);
          expect(button).toBeDisabled();
          // A browser drops focus from a button that turns disabled; jsdom
          // keeps it, so move it away as a browser would.
          act(() =>
            screen.getByRole("heading", { name: "Review complete" }).focus(),
          );
          expect(button).not.toHaveFocus();
          await act(async () => {
            fail(new Error("offline"));
            await Promise.resolve();
          });

          const alert = await screen.findByRole("alert");
          expect(alert).toHaveTextContent(
            /^Couldn't start the refresher\. Try again\.$/,
          );
          expect(screen.getAllByRole("alert")).toHaveLength(1);
          expect(alert.closest("li")).toContainElement(button);
          await waitFor(() => expect(button).toHaveFocus());
          expect(button).toBeEnabled();
          expectSummary("65%");
          expect(
            screen.getByRole("heading", { name: "Review complete" }),
          ).toBeInTheDocument();
          expect(router.navigate).not.toHaveBeenCalled();

          await userEvent.dblClick(button);
          expect(button).toBeDisabled();
          expect(button).toHaveAttribute("aria-busy", "true");
          expect(fetchChaptersBatchMock).toHaveBeenCalledTimes(3);
          resolve([{ chapter: 23, data: psalm23 }]);
          await waitFor(() => expect(router.navigate).toHaveBeenCalledTimes(2));
          expect(screen.queryByRole("alert")).toBeNull();
          expect(
            [record(), hold(), applyHeld(), practice()].map(
              (mock) => mock.mock.calls.length,
            ),
          ).toEqual(saves);

          // The practice route it opened starts at First letters.
          const [, [opened]] = router.navigate.mock.calls as [
            unknown,
            [{ href: string }],
          ];
          expect(opened.href).toBe(
            "/memory/pack_1/practice?refresh=1&return=%2Fmemory",
          );
          cleanup();
          renderRefresh("practice", reviewView({ dueAt: SAVED_DUE() }));
          await expectFreshStep("Refresh · First letters · 1 of 2");
        });

        it.each(["a pass", "a miss", "Back"])(
          "comes back after %s to the same summary, focused on Refresh",
          async (journey) => {
            const first = await finishedSummary(() => check(WEAK_TWO));
            await userEvent.click(await refreshButton());
            await waitFor(() =>
              expect(router.navigate).toHaveBeenCalledTimes(2),
            );
            const [[{ state }]] = router.navigate.mock.calls as [
              [{ state: { sessionSummary: PassageSummarySnapshot } }],
            ];
            const snapshot = state.sessionSummary;
            first.unmount();
            const saves = record().mock.calls.length + hold().mock.calls.length;

            // The practice-only Refresh, on its own history entry.
            const { onExit, unmount } = renderRefresh(
              "practice",
              reviewView({ dueAt: SAVED_DUE() }),
            );
            if (journey === "Back") {
              await screen.findByLabelText("Hint");
              await userEvent.click(screen.getByRole("button", { name: BACK }));
            } else {
              await toFromMemory();
              await check(journey === "a pass" ? FULL : WEAK_TWO);
              await screen.findByText(PRACTICE_ONLY);
              await clickButton(/Continue/);
            }
            expect(onExit).toHaveBeenCalledTimes(1);
            expect(router.navigate).toHaveBeenCalledTimes(2);
            expect(record().mock.calls.length + hold().mock.calls.length).toBe(
              saves,
            );
            unmount();

            // Back on the summary's entry, as the route restores it.
            router.location = {
              href: "/memory/pack_1/review",
              state: { sessionSummary: snapshot, refreshedPassage: PACK_ID },
            };
            render(
              <TooltipProvider delayDuration={0}>
                <PassageSession
                  packId={PACK_ID}
                  view={reviewView({ dueAt: SAVED_DUE() })}
                  packName="Psalm 23"
                  onExit={() => {}}
                  endsAfterReview
                  restoredSummary={snapshot}
                />
              </TooltipProvider>,
            );
            expect(
              screen.getByRole("heading", { name: "Review complete" }),
            ).not.toHaveFocus();
            expectSummary("65%");
            await waitFor(async () =>
              expect(await refreshButton()).toHaveFocus(),
            );
            expect(screen.queryByLabelText("Your recited passage")).toBeNull();
            expect(record().mock.calls.length + hold().mock.calls.length).toBe(
              saves,
            );
          },
        );
      });
    });

    describe("inside one multi-verse piece", () => {
      // Verse 1 is 9 words, verse 2 is 8: either alone misses overall.
      it("marks and hints only an omitted first verse, not its piece-mate", async () => {
        renderReview(reviewView({ pieces: onePiece() }));
        await check(PASSAGE_TWO);
        expect(hold()).toHaveBeenCalledWith(
          expect.objectContaining({ verseScores: scores(0, 100) }),
        );
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_BLANK}`);
      });

      it("marks and hints only an omitted second verse, not its piece-mate", async () => {
        renderReview(reviewView({ pieces: onePiece() }));
        await check(PASSAGE_ONE);
        expect(hold()).toHaveBeenCalledWith(
          expect.objectContaining({ verseScores: scores(100, 0) }),
        );
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);
      });

      it("hints a remembered shaky verse alone within its piece", async () => {
        renderReview(
          reviewView({ pieces: onePiece(), shakyVerses: [verse(2)] }),
        );
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);
      });

      it("sends practice scores per verse, so only the clean verse can clear", async () => {
        renderReview(
          reviewView({
            pieces: onePiece(),
            shakyVerses: [verse(1), verse(2)],
          }),
        );
        await clickButton("Need a refresher?");
        await check(FULL);
        await clickButton(/Continue/);
        await screen.findByText("Refresh · From memory · 2 of 2");
        await check(WEAK_TWO);
        await clickButton("Try another refresher");
        await check(FULL);
        await clickButton(/Continue/);
        await screen.findByText("Refresh · From memory · 2 of 2");
        await check(WEAK_TWO);
        expect(
          mutationMock("passageMemory.notePracticeRecital"),
        ).toHaveBeenCalledWith(
          expect.objectContaining({ verseScores: scores(100, 25) }),
        );
      });
    });

    describe("S12: Practice anytime on a not-due passage (R40)", () => {
      const notePractice = () =>
        mutationMock("passageMemory.notePracticeRecital");
      const notDueView = (extra?: Partial<PassageView>) =>
        reviewView({ dueAt: SAVED_DUE(), ...extra });

      function renderPractice(view: PassageView, onExit = vi.fn()) {
        render(
          <TooltipProvider delayDuration={0}>
            <PassageSession
              packId={PACK_ID}
              view={view}
              packName="Psalm 23"
              onExit={onExit}
            />
          </TooltipProvider>,
        );
        return onExit;
      }

      /** Practice saves nothing and never reaches a session summary. */
      function expectNothingCounted() {
        expect(record()).not.toHaveBeenCalled();
        expect(hold()).not.toHaveBeenCalled();
        expect(applyHeld()).not.toHaveBeenCalled();
        expect(screen.queryByText(/^Next review /)).toBeNull();
        expect(
          screen.queryByRole("heading", { name: "Review complete" }),
        ).toBeNull();
        expect(screen.queryByText("Accuracy")).toBeNull();
      }

      /** Continue goes back to the page it came from, without a new prompt. */
      async function continueBack(onExit: ReturnType<typeof vi.fn>) {
        await clickButton(/Continue/);
        expect(onExit).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/No hint text/)).toBeNull();
        expect(
          screen.getByText("Practice only, your progress didn't change."),
        ).toBeInTheDocument();
        expectNothingCounted();
      }

      it.each([
        ["Memorized", "a pass", "reviewing", FULL, /100% recalled/, [100, 100]],
        [
          "Memorized",
          "a miss",
          "reviewing",
          WEAK_TWO,
          /65% recalled/,
          [100, 25],
        ],
        ["Mastered", "a pass", "mastered", FULL, /100% recalled/, [100, 100]],
        ["Mastered", "a miss", "mastered", WEAK_TWO, /65% recalled/, [100, 25]],
      ] as const)(
        "R40: a not-due %s passage's plain Practice is practice only on %s, then Continue returns",
        async (_label, _score, status, answer, recalled, [first, second]) => {
          const onExit = renderPractice(notDueView({ status }));
          expect(
            screen.getByText("Recite the whole passage from memory"),
          ).toBeInTheDocument();
          expect(
            screen.getByText("2 verses · whole passage"),
          ).toBeInTheDocument();
          expect(
            await screen.findByRole("button", { name: "Need a refresher?" }),
          ).toBeInTheDocument();
          await waitFor(() => expect(answerBox()).toHaveFocus());

          await check(answer);
          expect(await screen.findByText(recalled)).toBeInTheDocument();
          expect(
            screen.getByText("Practice only, your progress didn't change."),
          ).toBeInTheDocument();
          // No post-miss offer, held miss or early review.
          expect(
            screen.queryByRole("button", { name: /refresher/ }),
          ).toBeNull();
          expect(notePractice()).toHaveBeenCalledTimes(1);
          expect(notePractice()).toHaveBeenCalledWith(
            expect.objectContaining({
              packId: PACK_ID,
              verseScores: scores(first, second),
            }),
          );
          expectNothingCounted();
          await waitFor(() =>
            expect(
              screen.getByRole("button", { name: /Continue/ }),
            ).toHaveFocus(),
          );
          await continueBack(onExit);
        },
      );

      it.each([
        ["a pass", FULL, /100% recalled/, [100, 100]],
        ["a miss", WEAK_TWO, /65% recalled/, [100, 25]],
      ] as const)(
        "R40: its refresher is practice only at both steps, ending on %s, then Continue returns",
        async (_label, answer, recalled, [first, second]) => {
          const onExit = renderPractice(
            notDueView({ shakyVerses: [verse(2)] }),
          );
          await clickButton("Need a refresher?");
          await expectFreshStep("Refresh · First letters · 1 of 2");
          // Only the remembered shaky verse 2; verse 1 before it stays blank.
          expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);

          await check("The Lord");
          await clickButton(/Continue/);
          await expectFreshStep("Refresh · First letters · 2 of 3");
          // A hinted 100% never clears shakiness.
          await check(FULL);
          expect(notePractice()).not.toHaveBeenCalled();
          await clickButton(/Continue/);
          await expectFreshStep("Refresh · From memory · 3 of 3");
          expect(
            screen.getByText("Now try it without the hints."),
          ).toBeInTheDocument();
          expect(screen.queryByLabelText("Hint")).toBeNull();

          await check(answer);
          expect(await screen.findByText(recalled)).toBeInTheDocument();
          expect(
            screen.getByText("Practice only, your progress didn't change."),
          ).toBeInTheDocument();
          expect(notePractice()).toHaveBeenCalledTimes(1);
          expect(notePractice()).toHaveBeenCalledWith(
            expect.objectContaining({ verseScores: scores(first, second) }),
          );
          expectNothingCounted();
          await continueBack(onExit);
        },
      );

      it("R40: another refresher from its result stays practice only", async () => {
        const onExit = renderPractice(notDueView());
        await clickButton("Need a refresher?");
        await check(FULL);
        await clickButton(/Continue/);
        await check(WEAK_TWO);
        await clickButton("Try another refresher");
        await expectFreshStep("Refresh · First letters · 1 of 2");
        await check(FULL);
        await clickButton(/Continue/);
        await screen.findByText("Refresh · From memory · 2 of 2");
        await check(FULL);
        await screen.findByText("Practice only, your progress didn't change.");
        expect(notePractice()).toHaveBeenCalledTimes(2);
        expectNothingCounted();
        await continueBack(onExit);
      });

      it("R40: First letters hints every verse when none is shaky or when all are (AC9)", async () => {
        renderPractice(notDueView());
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
        cleanup();

        renderPractice(notDueView({ shakyVerses: [verse(1), verse(2)] }));
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      });

      it("R40: a failed shaky-verse save keeps the practice result, with no error or retry", async () => {
        notePractice().mockRejectedValue(new Error("offline"));
        const onExit = renderPractice(notDueView({ shakyVerses: [verse(2)] }));
        await check(FULL);
        expect(await screen.findByText(/100% recalled/)).toBeInTheDocument();
        expect(
          screen.getByText("Practice only, your progress didn't change."),
        ).toBeInTheDocument();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
        await continueBack(onExit);
        expect(notePractice()).toHaveBeenCalledTimes(1);
      });

      it("R40: Back out of its refresher counts nothing and uses the session exit", async () => {
        const onExit = renderPractice(notDueView());
        await clickButton("Need a refresher?");
        await check(FULL);
        await clickButton(/Continue/);
        await screen.findByText("Refresh · From memory · 2 of 2");
        await clickButton("Back to Memory");
        expect(onExit).toHaveBeenCalledTimes(1);
        expect(notePractice()).not.toHaveBeenCalled();
        expectNothingCounted();
      });
    });

    describe("S12: stale passage prompt (R48)", () => {
      const REFRESH_FIRST = "Refresh it first";
      const notePractice = () =>
        mutationMock("passageMemory.notePracticeRecital");
      const reviews = (...accuracies: number[]) =>
        accuracies.map((accuracy, index) => ({
          accuracy,
          createdAt: getSessionNow() - (index + 1) * DAY_MS,
        }));
      // Due 8 days ago on a 2-day gap: stale by time.
      const staleDue = () =>
        reviewView({ dueAt: getSessionNow() - 8 * DAY_MS });

      function history(value: unknown) {
        queryMock.mockImplementation((_name: string, args: unknown) =>
          args === "skip" ? undefined : value,
        );
      }

      function renderPractice(view: PassageView) {
        return render(
          <TooltipProvider delayDuration={0}>
            <PassageSession
              packId={PACK_ID}
              view={view}
              packName="Psalm 23"
              onExit={() => {}}
            />
          </TooltipProvider>,
        );
      }

      async function expectCueStack() {
        const sentence = await screen.findByText(
          "No hint text. Type the passage from memory — verse numbers not needed — then check your answer.",
        );
        const refreshFirst = screen.getByRole("button", {
          name: REFRESH_FIRST,
        });
        // Sentence, then only Refresh it first: no quiet link (AC10).
        expect(
          sentence.compareDocumentPosition(refreshFirst) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
          screen.queryByRole("button", { name: "Need a refresher?" }),
        ).toBeNull();
        // No tooltip.
        expect(refreshFirst).not.toHaveAttribute("aria-describedby");
        return refreshFirst;
      }

      async function expectLinkOnly() {
        expect(
          await screen.findByRole("button", { name: "Need a refresher?" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
      }

      it("R48: reads only this passage's own review history", () => {
        renderReview();
        expect(queryMock).toHaveBeenCalledWith("passageMemory.recentReviews", {
          packId: PACK_ID,
        });
        cleanup();
        queryMock.mockClear();
        renderSession(passageView(memorized()));
        expect(queryMock).toHaveBeenCalledWith(
          "passageMemory.recentReviews",
          "skip",
        );
        expect(queryMock).not.toHaveBeenCalledWith(
          "passageMemory.recentReviews",
          expect.objectContaining({ packId: PACK_ID }),
        );
      });

      it("R48: a stale due passage stacks the cue; Refresh it first opens the counted refresher", async () => {
        renderReview(staleDue());
        const refreshFirst = await expectCueStack();
        refreshFirst.focus();
        await userEvent.keyboard("{Enter}");
        await expectFreshStep("Refresh · First letters · 1 of 2");
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
        await check(FULL);
        await clickButton(/Continue/);
        await expectFreshStep("Refresh · From memory · 2 of 2");
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
        await check(FULL);
        expect(record()).toHaveBeenCalledTimes(1);
        expect(record()).toHaveBeenCalledWith(
          expect.objectContaining({ refresherUsed: true, accuracy: 100 }),
        );
        expect(await screen.findByText(/^Next review /)).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
        await clickButton(/Continue/);
        await screen.findByRole("heading", { name: "Review complete" });
        expect(screen.getByText("100% · Refresher used")).toBeInTheDocument();
        expect(notePractice()).not.toHaveBeenCalled();
      });

      it("R48: two of the last three tries under 60% make a not-due passage stale; its cue opens practice", async () => {
        history(reviews(59, 100, 40));
        renderPractice(reviewView({ dueAt: SAVED_DUE() }));
        const refreshFirst = await expectCueStack();
        await userEvent.dblClick(refreshFirst);
        await expectFreshStep("Refresh · First letters · 1 of 2");
        await check(FULL);
        await clickButton(/Continue/);
        await screen.findByText("Refresh · From memory · 2 of 2");
        await check(FULL);
        expect(
          await screen.findByText(
            "Practice only, your progress didn't change.",
          ),
        ).toBeInTheDocument();
        expect(notePractice()).toHaveBeenCalledTimes(1);
        expect(record()).not.toHaveBeenCalled();
        expect(hold()).not.toHaveBeenCalled();
      });

      it.each([
        ["60% is not a stale miss", reviews(60, 59, 60), {}],
        ["only the newest three tries count", reviews(100, 100, 59, 40), {}],
        [
          "tries before Start over are ignored",
          reviews(59, 40, 30),
          { startedOverAt: getSessionNow() - DAY_MS / 2 },
        ],
        [
          "6 days overdue on a short gap is not stale",
          [],
          { dueAt: getSessionNow() - 6 * DAY_MS },
        ],
        [
          "its own longer gap must pass first",
          [],
          { dueAt: getSessionNow() - 9 * DAY_MS, intervalDays: 10 },
        ],
      ] as const)(
        "R48: not stale, link only: %s",
        async (_label, tries, extra) => {
          history(tries);
          renderReview(reviewView(extra));
          await expectLinkOnly();
        },
      );

      it("R48: stale at its own longer gap, overdue by exactly that gap", async () => {
        renderReview(
          reviewView({
            dueAt: getSessionNow() - 10 * DAY_MS,
            intervalDays: 10,
          }),
        );
        await expectCueStack();
      });

      it("R48: shows no link or cue until the history loads, and none while learning", async () => {
        history(undefined);
        const { rerender } = renderReview(staleDue());
        await screen.findByText(/No hint text/);
        expect(
          screen.queryByRole("button", { name: "Need a refresher?" }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();

        history([]);
        rerender(
          <TooltipProvider delayDuration={0}>
            <PassageSession
              packId={PACK_ID}
              view={staleDue()}
              packName="Psalm 23"
              onExit={() => {}}
              endsAfterReview
            />
          </TooltipProvider>,
        );
        await expectCueStack();
        cleanup();

        // A warm-up while learning: never a cue, even on old misses.
        history(reviews(10, 10, 10));
        renderSession(passageView(memorized()));
        await screen.findByText(/No hint text/);
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
      });

      it("R48: the cue never appears once typing has started, but stays if already shown", async () => {
        history(undefined);
        const view = staleDue();
        const ui = () => (
          <TooltipProvider delayDuration={0}>
            <PassageSession
              packId={PACK_ID}
              view={view}
              packName="Psalm 23"
              onExit={() => {}}
              endsAfterReview
            />
          </TooltipProvider>
        );
        const { rerender } = render(ui());
        await userEvent.type(
          await screen.findByLabelText("Your recited passage"),
          "The",
        );
        history([]);
        rerender(ui());
        await expectLinkOnly();
        cleanup();

        renderReview(staleDue());
        await expectCueStack();
        await userEvent.type(answerBox(), "The");
        expect(
          screen.getByRole("button", { name: REFRESH_FIRST }),
        ).toBeInTheDocument();
      });

      it("R48: shows no cue on a text error or a graded result", async () => {
        fetchChaptersBatchMock.mockRejectedValue(new Error("offline"));
        renderReview(staleDue());
        expect(
          await screen.findByText("Could not load verse text."),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Need a refresher?" }),
        ).toBeNull();
        cleanup();

        fetchChaptersBatchMock.mockResolvedValue([
          { chapter: 23, data: psalm23 },
        ]);
        renderReview(staleDue());
        await expectCueStack();
        await check(FULL);
        await screen.findByRole("button", { name: /Continue/ });
        expect(
          screen.queryByRole("button", { name: REFRESH_FIRST }),
        ).toBeNull();
        expect(
          screen.queryByRole("button", { name: "Need a refresher?" }),
        ).toBeNull();
      });
    });

    it("checks once on a double activation, with Enter and Shift+Enter", async () => {
      renderReview();
      await clickButton("Need a refresher?");
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
      const box = answerBox();
      await userEvent.type(box, "The Lord{Shift>}{Enter}{/Shift}is");
      expect(box).toHaveValue("The Lord\nis");
      await userEvent.clear(box);
      await userEvent.paste(FULL);
      await userEvent.dblClick(
        screen.getByRole("button", { name: /Check answer/ }),
      );
      await screen.findByText(/^Next review /);
      expect(record()).toHaveBeenCalledTimes(1);
    });

    it("checks with Enter", async () => {
      renderReview();
      const box = await screen.findByLabelText("Your recited passage");
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Check answer/ }),
        ).toBeDisabled(),
      );
      await userEvent.click(box);
      await userEvent.paste(FULL);
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("button", { name: /Continue/ });
      expect(record()).toHaveBeenCalledTimes(1);
    });
  });

  describe("Learning passage refresher (S15)", () => {
    const LINK = "Need a refresher?";
    const TOOLTIP = "Do a refresher on this passage for some more practice.";
    const PRACTICE_ONLY = "Practice only, your progress didn't change.";
    const STEP_ONE = "Refresh · First letters · 1 of 2";
    const STEP_TWO = "Refresh · From memory · 2 of 2";
    const VERSE_THREE =
      "He restores my soul. He leads me in paths of righteousness.";
    const WARMUP = `${PASSAGE_ONE} ${PASSAGE_TWO}`;
    // 40 distinct words a verse, so a two-verse range can score 84% and 85%.
    const LETTERS = "abcdefghijklmnopqrstuvwxyz";
    const longVerse = (number: number) =>
      Array.from(
        { length: 40 },
        (_, index) =>
          `${LETTERS[number]}${LETTERS[index % 26]}${LETTERS[Math.floor(index / 26)]}`,
      ).join(" ");
    const LONG = [1, 2, 3, 4, 5].map(longVerse);
    const LONG_PAIR = `${LONG[0]} ${LONG[1]}`;
    const lettered = (word: string) => word[0].padEnd(word.length, "_");
    const blank = (word: string) => "_".repeat(word.length);
    /** An unpunctuated verse's step 1 hint: its first half lettered. */
    const longHalf = (text: string) => {
      const words = text.split(" ");
      const hinted = Math.ceil(words.length / 2);
      return words
        .map((word, index) => (index < hinted ? lettered(word) : blank(word)))
        .join(" ");
    };
    const longEvery = (text: string) => text.split(" ").map(lettered).join(" ");
    const longBlank = (text: string) => text.split(" ").map(blank).join(" ");

    const record = () => mutationMock("passageMemory.recordAttempt");
    const answerBox = () => screen.getByLabelText("Your recited passage");
    const queryLink = () => screen.queryByRole("button", { name: LINK });

    const chapter = (texts: readonly string[]) => [
      {
        chapter: 23,
        data: {
          ...psalm23,
          verses: texts.map((text, index) => ({ number: index + 1, text })),
        },
      },
    ];

    function serveChapter(texts: readonly string[]) {
      fetchChaptersBatchMock.mockResolvedValue(chapter(texts));
    }

    /** Learning passage: verses 1–2 learned, verse 3 being learned. */
    function warmup(
      attachments: ["attached" | "solid", "attached" | "solid"],
      texts: readonly string[] = [PASSAGE_ONE, PASSAGE_TWO, VERSE_THREE],
    ): PassageView {
      serveChapter(texts);
      const now = getSessionNow();
      const learned = (attachment: "attached" | "solid") => ({
        learnStage: attachment === "solid" ? 3 : 2,
        dueAt: now + DAY_MS,
      });
      const view = passageView(
        [
          piece(0, attachments[0], learned(attachments[0])),
          piece(1, attachments[1], learned(attachments[1])),
          piece(2, "learning", { learnStage: 1, dueAt: now }),
        ],
        { lastSessionAt: now - 60_000 },
      );
      // The server echoes the same passage back, as a warm-up try changes
      // no piece.
      record().mockResolvedValue(view);
      return view;
    }

    /**
     * Verses 1–3 learned (the whole warm-up, at 120 words), verse 4 being
     * learned. A miss stalling on verse 3 repairs verses 2–3 only.
     */
    function longWarmup(): PassageView {
      serveChapter(LONG.slice(0, 4));
      const now = getSessionNow();
      const solid = (index: number) =>
        piece(index, "solid", { learnStage: 3, dueAt: now + DAY_MS });
      const view = passageView(
        [solid(0), solid(1), solid(2), piece(3, "learning", { dueAt: now })],
        { lastSessionAt: now - 60_000 },
      );
      record().mockResolvedValue(view);
      return view;
    }
    const LONG_WARMUP = LONG.slice(0, 3).join(" ");

    /** Reopen mid-step, so the session starts on the due new verse. */
    function resumeMidStep() {
      sessionStorage.setItem(
        PASSAGE_STEP_IN_PROGRESS_KEY,
        JSON.stringify({ packId: PACK_ID, origin: performance.timeOrigin - 1 }),
      );
    }

    /** Verse 2 finishes section 1 on this From memory try. */
    function sectionView(): PassageView {
      serveChapter(LONG.slice(0, 3));
      resumeMidStep();
      const now = getSessionNow();
      const second = (attachment: "attached" | "solid") =>
        piece(1, attachment, {
          learnStage: 3,
          stageReps: requiredRepsFor(3, 40) - 1,
          dueAt: now,
        });
      record().mockResolvedValue(
        passageView([
          piece(0, "solid", { learnStage: 3 }),
          second("solid"),
          piece(2, "unreached", { sectionIndex: 1 }),
        ]),
      );
      return passageView([
        piece(0, "solid", { learnStage: 3 }),
        second("attached"),
        piece(2, "unreached", { sectionIndex: 1 }),
      ]);
    }

    /** Verse 1 clears Challenge next to verse 2: Connect verses 1–2. */
    function connectView(): PassageView {
      serveChapter(LONG.slice(0, 2));
      resumeMidStep();
      const now = getSessionNow();
      record().mockResolvedValue(
        passageView([
          piece(0, "attached", { learnStage: 3, dueAt: now + DAY_MS }),
          piece(1, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
        ]),
      );
      return passageView([
        piece(0, "attached", {
          learnStage: 2,
          stageReps: requiredRepsFor(2, 40) - 1,
          dueAt: now,
        }),
        piece(1, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
      ]);
    }

    /** The leading words of `full` that score exactly `percent`. */
    function typedAt(full: string, percent: number): string {
      const words = full.split(" ");
      for (let count = words.length; count > 0; count -= 1) {
        const typed = words.slice(0, count).join(" ");
        if (verseAttemptAccuracy(diffWords(typed, full)) === percent) {
          return typed;
        }
      }
      throw new Error(`No prefix scores ${percent}%`);
    }

    async function check(answer: string, label = "Your recited passage") {
      const box = await screen.findByLabelText(label);
      await userEvent.click(box);
      await userEvent.paste(answer);
      const button = screen.getByRole("button", { name: /Check answer/ });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      await screen.findByText(/recalled/);
    }

    async function clickButton(name: RegExp | string) {
      await userEvent.click(await screen.findByRole("button", { name }));
    }

    async function expectFreshStep(header: string) {
      expect(await screen.findByText(header)).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expect(answerBox()).toHaveValue("");
    }

    /** First letters, then From memory, both passed; ends on the closing. */
    async function runRefresher(full: string) {
      await expectFreshStep(STEP_ONE);
      await check(full);
      await clickButton(/Continue/);
      await expectFreshStep(STEP_TWO);
      await check(full);
      expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );
    }

    /** Only the logged try reaches the server, and nothing else is called. */
    function expectOnlyLoggedTries(count: number) {
      expect(record()).toHaveBeenCalledTimes(count);
      for (const name of [
        "passageMemory.holdAttempt",
        "passageMemory.applyHeldAttempt",
        "passageMemory.notePracticeRecital",
        "passageMemory.introduceNext",
      ]) {
        expect(mutationMock(name)).not.toHaveBeenCalled();
      }
    }

    function hintText(): string {
      return screen.getByLabelText("Hint").textContent ?? "";
    }

    function header(name: string) {
      return screen.getByRole("status", { name: `Session phase: ${name}` });
    }

    it("R32: puts the link under the empty warm-up hint and refreshes exactly the warm-up verses", async () => {
      renderSession(warmup(["solid", "solid"]));
      const sentence = await screen.findByText(
        /^No hint text\. Type the passage/,
      );
      const link = await screen.findByRole("button", { name: LINK });
      expect(sentence.parentElement).toBe(link.parentElement);
      expect(
        sentence.compareDocumentPosition(link) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();

      await userEvent.click(link);
      await expectFreshStep(STEP_ONE);
      // Half first letters on each warm-up verse, nothing from verse 3.
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      expect(hintText()).not.toMatch(/r_______/);
      expect(screen.getByText(WARMUP_PROMPT_COPY)).toBeInTheDocument();
      expect(answerBox()).toHaveAttribute(
        "placeholder",
        "Type the passage from memory",
      );
      // The range is fixed while refreshing: no start buttons, no link.
      expect(
        screen.queryByRole("button", { name: WARMUP_SKIP_LABEL }),
      ).toBeNull();
      expect(queryLink()).toBeNull();
    });

    it("R32: keeps a partial warm-up hint as it is, with the link beneath it", async () => {
      const view = warmup(["solid", "attached"]);
      renderSession(view);
      const hint = await screen.findByLabelText("Hint");
      expect(hint.textContent).toBe(
        compositeHintForWindow(view.pieces, 0, 2, [
          PASSAGE_ONE,
          PASSAGE_TWO,
          VERSE_THREE,
        ]),
      );
      const link = await screen.findByRole("button", { name: LINK });
      expect(
        hint.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(hint.closest(".rounded-xl")).toContainElement(link);

      await userEvent.click(link);
      await expectFreshStep(STEP_ONE);
      // Half first letters on each verse now, including the one the hint had
      // hidden.
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
    });

    it("R32: refreshes a warm-up widened to the beginning of the passage, with nothing cut off", async () => {
      serveChapter(LONG);
      const now = getSessionNow();
      const solid = (index: number) =>
        piece(index, "solid", { learnStage: 3, dueAt: now + DAY_MS });
      const view = passageView(
        [solid(0), solid(1), solid(2), solid(3), piece(4, "learning")],
        { lastSessionAt: now - 60_000 },
      );
      renderSession(view);
      await clickButton("From the beginning of the passage");
      await clickButton(LINK);
      await expectFreshStep(STEP_ONE);
      // Each verse gets its own half, not one half over the joined text.
      expect(hintText()).toBe(LONG.slice(0, 4).map(longHalf).join(" "));
    });

    it("R32: offers a refresher under 85% with focus on Continue, and none at 85% or 100%", async () => {
      const first = renderSession(
        warmup(["solid", "solid"], [...LONG.slice(0, 2), VERSE_THREE]),
      );
      await check(typedAt(LONG_PAIR, 84));
      expect(screen.getByText(/84% recalled/)).toBeInTheDocument();
      const offer = screen.getByRole("button", { name: LINK });
      expect(screen.getByText(TOOLTIP)).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );
      expect(offer).not.toHaveFocus();
      first.unmount();

      for (const percent of [85, 100]) {
        const run = renderSession(
          warmup(["solid", "solid"], [...LONG.slice(0, 2), VERSE_THREE]),
        );
        await check(typedAt(LONG_PAIR, percent));
        expect(
          screen.getByText(new RegExp(`^${percent}% recalled`)),
        ).toBeInTheDocument();
        expect(queryLink()).toBeNull();
        run.unmount();
      }
    });

    it("R32: a pre-try refresher counts nothing and resumes the unattempted warm-up", async () => {
      renderSession(warmup(["solid", "solid"]));
      await clickButton(LINK);
      await runRefresher(WARMUP);
      expectOnlyLoggedTries(0);

      await clickButton(/Continue/);
      // Back on the same warm-up, untried and with no refresher state left.
      expect(header("Warm up")).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expect(answerBox()).toHaveValue("");
      expect(
        screen.getByText(/^No hint text\. Type the passage/),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Hint")).toBeNull();
      expect(screen.queryByText(/Refresh ·/)).toBeNull();
      expect(screen.queryByText(PRACTICE_ONLY)).toBeNull();
      expect(screen.getByRole("button", { name: LINK })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: WARMUP_SKIP_LABEL }),
      ).toBeInTheDocument();
      expectOnlyLoggedTries(0);

      // The warm-up try itself is then logged once, as on main.
      await check(WARMUP);
      expect(record()).toHaveBeenCalledTimes(1);
      expect(record()).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "rope", accuracy: 100 }),
      );
    });

    it("leaves no in-progress marker while fixing a tricky spot in the warm-up", async () => {
      renderSession(longWarmup());
      await check(LONG_PAIR);
      await clickButton(/Continue/);

      expect(header("Fix a tricky spot")).toBeInTheDocument();
      expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
    });

    it("R32: a post-miss refresher leaves the logged try and its next screen as they were", async () => {
      // Without the refresher: the miss, then Continue.
      const control = renderSession(longWarmup());
      await check(LONG_PAIR);
      expect(screen.getByText(/67% recalled/)).toBeInTheDocument();
      await clickButton(/Continue/);
      expect(header("Fix a tricky spot")).toBeInTheDocument();
      expect(screen.getByText("Try this part again")).toBeInTheDocument();
      const nextScreen = document.body.textContent;
      const loggedTry = record().mock.calls[0]?.[0] as Record<string, unknown>;
      expectOnlyLoggedTries(1);
      control.unmount();
      mutationMocks.clear();

      // The same miss, then the refresher, then Continue.
      renderSession(longWarmup());
      await check(LONG_PAIR);
      await clickButton(LINK);
      // The refresher covers the warm-up's verses 1–3, not the tricky spot,
      // and the tricky spot's starting hint stays out of it.
      await expectFreshStep(STEP_ONE);
      expect(hintText()).toBe(LONG.slice(0, 3).map(longHalf).join(" "));
      expect(screen.queryByText("Try this part again")).toBeNull();
      const noRepairCue = () => {
        expect(screen.queryByLabelText("Starting hint")).toBeNull();
        expect(screen.queryByLabelText("Pick up after")).toBeNull();
      };
      noRepairCue();
      // Step 1 under 85% continues to every word on the verses it missed
      // (verse 1 passed); a miss there reads Try again, a pass Continue.
      await check(LONG[0]);
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      expect(hintText()).toBe(
        [longBlank(LONG[0]), longEvery(LONG[1]), longEvery(LONG[2])].join(" "),
      );
      noRepairCue();
      await check("baa");
      await clickButton(/Try again/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      await check(LONG_WARMUP);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 3 of 3");
      noRepairCue();
      await check(LONG_WARMUP);
      expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
      expectOnlyLoggedTries(1);

      await clickButton(/Continue/);
      expect(header("Fix a tricky spot")).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expect(answerBox()).toHaveValue("");
      expect(document.body.textContent).toBe(nextScreen);
      expectOnlyLoggedTries(1);
      const refreshedTry = record().mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      const logged = ({
        kind,
        quality,
        accuracy,
        pieceIndex,
      }: Record<string, unknown>) => ({ kind, quality, accuracy, pieceIndex });
      expect(logged(refreshedTry)).toEqual(logged(loggedTry));
      expect(loggedTry).toEqual(
        expect.objectContaining({ kind: "rope", accuracy: 67 }),
      );
    });

    it("R37: offers the section recital a link and an under-85% offer over that section's verses", async () => {
      renderSession(sectionView());
      await check(LONG[1] ?? "", "Your recalled verse");
      await clickButton(/Continue/);
      await clickButton(SECTION_RECITE_LABEL);
      expect(await screen.findByText("This section")).toBeInTheDocument();
      expect(
        screen.getByText("Recite this section from memory"),
      ).toBeInTheDocument();
      await clickButton(LINK);
      await expectFreshStep(STEP_ONE);
      expect(hintText()).toMatch(/^b__ b__ .* c__/);
      expect(hintText()).not.toMatch(/d__/);
    });

    it("R37: a section recital at 84% gets the offer, at 85% none, and the refresher keeps its next step", async () => {
      async function reciteSection(percent: number) {
        const run = renderSession(sectionView());
        await check(LONG[1] ?? "", "Your recalled verse");
        await clickButton(/Continue/);
        await clickButton(SECTION_RECITE_LABEL);
        await check(typedAt(LONG_PAIR, percent));
        return run;
      }

      const atPass = await reciteSection(85);
      expect(queryLink()).toBeNull();
      atPass.unmount();
      mutationMocks.clear();

      const control = await reciteSection(84);
      expect(screen.getByRole("button", { name: LINK })).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );
      await clickButton(/Continue/);
      const nextScreen = document.body.textContent;
      expectOnlyLoggedTries(2);
      control.unmount();
      mutationMocks.clear();

      await reciteSection(84);
      await clickButton(LINK);
      await runRefresher(LONG_PAIR);
      await clickButton(/Continue/);
      expect(document.body.textContent).toBe(nextScreen);
      expectOnlyLoggedTries(2);
    });

    it("every-word First letters at 84% reads Try again and at 85% Continue; From memory has no hints", async () => {
      renderSession(
        warmup(["solid", "solid"], [...LONG.slice(0, 2), VERSE_THREE]),
      );
      await clickButton(LINK);
      await expectFreshStep(STEP_ONE);
      // 85% overall, but verse 2 alone is under 85%: Continue only.
      await check(typedAt(LONG_PAIR, 85));
      expect(screen.queryByText(PRACTICE_ONLY)).toBeNull();
      expect(
        screen.getByText("Refresh · First letters · 1 of 3"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      expect(hintText()).toBe(`${longBlank(LONG[0])} ${longEvery(LONG[1])}`);
      await check(typedAt(LONG_PAIR, 84));
      await clickButton(/Try again/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      await check(typedAt(LONG_PAIR, 85));
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 3 of 3");
      expect(
        screen.getByText("Now try it without the hints."),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Hint")).toBeNull();
      expect(queryLink()).toBeNull();
      // A From memory miss is still practice only, with no other offer.
      await check(typedAt(LONG_PAIR, 30));
      expect(screen.getByText(PRACTICE_ONLY)).toBeInTheDocument();
      expect(queryLink()).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Try another refresher" }),
      ).toBeNull();
      expectOnlyLoggedTries(0);
    });

    it("Back during either step changes nothing", async () => {
      const onExit = vi.fn();
      const first = renderSession(warmup(["solid", "solid"]), onExit);
      await clickButton(LINK);
      await expectFreshStep(STEP_ONE);
      await clickButton("Back to Memory");
      expect(onExit).toHaveBeenCalledTimes(1);
      expectOnlyLoggedTries(0);
      first.unmount();

      renderSession(warmup(["solid", "solid"]), onExit);
      await check(PASSAGE_ONE);
      await clickButton(LINK);
      await check(WARMUP);
      await clickButton(/Continue/);
      await expectFreshStep(STEP_TWO);
      await clickButton("Back to Memory");
      expect(onExit).toHaveBeenCalledTimes(2);
      expectOnlyLoggedTries(1);
    });

    it("R31: the new verse shows no link and no offer at any step", async () => {
      serveChapter([PASSAGE_ONE, PASSAGE_TWO, VERSE_THREE]);
      resumeMidStep();
      renderSession(practicedDueView());
      expect(
        await screen.findByText("Type what you remember"),
      ).toBeInTheDocument();
      expect(queryLink()).toBeNull();
      await check("The", "Your recalled verse");
      expect(queryLink()).toBeNull();
    });

    it("R31: a new verse typed from memory shows no link", async () => {
      serveChapter([PASSAGE_ONE]);
      resumeMidStep();
      renderSession(
        passageView([piece(0, "learning", { learnStage: 3 })], {
          lastSessionAt: getSessionNow() - 60_000,
        }),
      );
      expect(
        await screen.findByText(/^No hint text\. Type the verse/),
      ).toBeInTheDocument();
      expect(queryLink()).toBeNull();
    });

    it("Fix a tricky spot shows no link and no offer", async () => {
      renderSession(warmup(["solid", "solid"]));
      await check(PASSAGE_ONE);
      await clickButton(/Continue/);
      expect(header("Fix a tricky spot")).toBeInTheDocument();
      expect(queryLink()).toBeNull();
      await check("He");
      expect(queryLink()).toBeNull();
    });

    it("R38: the Connect verses recital shows no link, and no offer at 30% or 84%", async () => {
      for (const percent of [30, 84]) {
        const run = renderSession(connectView());
        await check(LONG[0] ?? "", "Your recalled verse");
        await clickButton(/Continue/);
        await clickButton(CONNECT_RECITE_LABEL);
        expect(await screen.findByText("Together")).toBeInTheDocument();
        expect(queryLink()).toBeNull();
        await check(typedAt(LONG_PAIR, percent));
        expect(
          screen.getByText(new RegExp(`^${percent}% recalled`)),
        ).toBeInTheDocument();
        expect(queryLink()).toBeNull();
        run.unmount();
        mutationMocks.clear();
      }
    });

    it("shows no link while loading or on a text error, then once Retry loads it", async () => {
      let resolve: (value: unknown) => void = () => {};
      const view = warmup(["solid", "solid"]);
      fetchChaptersBatchMock.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const loading = renderSession(view);
      expect(queryLink()).toBeNull();
      expect(
        screen.getByRole("button", { name: /Check answer/ }),
      ).toBeDisabled();
      resolve(chapter([PASSAGE_ONE, PASSAGE_TWO, VERSE_THREE]));
      expect(
        await screen.findByRole("button", { name: LINK }),
      ).toBeInTheDocument();
      loading.unmount();
      // Drop the text the first render cached, so this one fetches again.
      sessionStorage.clear();

      fetchChaptersBatchMock.mockRejectedValueOnce(new Error("offline"));
      renderSession(view);
      expect(
        await screen.findByText("Could not load verse text."),
      ).toBeInTheDocument();
      expect(queryLink()).toBeNull();
      serveChapter([PASSAGE_ONE, PASSAGE_TWO, VERSE_THREE]);
      await clickButton("Retry");
      expect(
        await screen.findByRole("button", { name: LINK }),
      ).toBeInTheDocument();
    });

    it("R37: the Psalm 112 preview fixture reaches Recite this section and its refresher by the tester's steps", async () => {
      const [pack] = testerSectionRecitalPacks(getSessionNow(), undefined);
      const pieces = pack.passage!.pieces;
      const section = pieces.filter((item) => item.sectionIndex === 0);
      const due = section.at(-1)!;
      const text = (verse: number) => `Psalm verse ${LETTERS[verse]} words`;
      const versesOf = (item: PassagePiece) =>
        Array.from(
          { length: item.endVerse - item.startVerse + 1 },
          (_, offset) => text(item.startVerse + offset),
        ).join(" ");
      fetchChaptersBatchMock.mockResolvedValue([
        {
          chapter: 112,
          data: {
            ...psalm23,
            canonical: "Psalm 112",
            verses: pieces
              .flatMap((item) =>
                Array.from(
                  { length: item.endVerse - item.startVerse + 1 },
                  (_, offset) => item.startVerse + offset,
                ),
              )
              .map((number) => ({ number, text: text(number) })),
          },
        },
      ]);
      // The server marks the due piece solid on that pass.
      record().mockResolvedValue(
        passageView(
          pieces.map((item) =>
            item.index === due.index
              ? { ...item, attachment: "solid" as const }
              : item,
          ),
        ),
      );
      render(
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={passageView(pieces, {
              lastSessionAt: getSessionNow() - 60_000,
            })}
            packName="Psalm 112"
            onExit={() => {}}
          />
        </TooltipProvider>,
      );

      // Skip warm-up, type the due verse from memory, Check answer, Continue.
      await clickButton(WARMUP_SKIP_LABEL);
      await check(versesOf(due), "Your recalled verse");
      await clickButton(/Continue/);
      // Section complete → Recite this section, with the link before a try.
      expect(await screen.findByText("Section complete")).toBeInTheDocument();
      await clickButton(SECTION_RECITE_LABEL);
      expect(await screen.findByText("This section")).toBeInTheDocument();
      await clickButton(LINK);
      await expectFreshStep(STEP_ONE);
      // Each verse of the section gets its own half.
      expect(hintText()).toBe(
        section
          .flatMap((item) =>
            Array.from(
              { length: item.endVerse - item.startVerse + 1 },
              (_, offset) => longHalf(text(item.startVerse + offset)),
            ),
          )
          .join(" "),
      );
    });

    describe("warm-up start and skip controls", () => {
      const SIX = [
        PASSAGE_ONE,
        PASSAGE_TWO,
        VERSE_THREE,
        "Even though I walk through the valley.",
        "You prepare a table before me.",
        "Surely goodness and mercy shall follow me.",
      ];
      // The default warm-up is verses 3–5, inside a section that starts at
      // verse 2, so all three controls show.
      const RANGE = SIX.slice(2, 5).join(" ");
      const CONTROLS = [
        "From the start of this section",
        "From the beginning of the passage",
        WARMUP_SKIP_LABEL,
      ];

      function allControlsWarmup(): PassageView {
        serveChapter(SIX);
        const now = getSessionNow();
        const solid = (index: number) =>
          piece(index, "solid", {
            learnStage: 3,
            dueAt: now + DAY_MS,
            sectionIndex: index === 0 ? 0 : 1,
          });
        const view = passageView(
          [
            solid(0),
            solid(1),
            solid(2),
            solid(3),
            solid(4),
            piece(5, "learning", { sectionIndex: 1, dueAt: now }),
          ],
          { lastSessionAt: now - 60_000 },
        );
        record().mockResolvedValue(view);
        return view;
      }

      function expectControls(shown: boolean) {
        for (const name of CONTROLS) {
          const control = screen.queryByRole("button", { name });
          if (shown) expect(control).toBeInTheDocument();
          else expect(control).toBeNull();
        }
        // The session's Back stays available throughout.
        expect(
          screen.getByRole("button", { name: "Back to Memory" }),
        ).toBeEnabled();
      }

      it("hides all three during step 1, step 2 and the step-2 result, and restores them on the untried warm-up", async () => {
        renderSession(allControlsWarmup());
        await screen.findByRole("button", { name: LINK });
        expectControls(true);

        await clickButton(LINK);
        await expectFreshStep(STEP_ONE);
        expectControls(false);
        await check(RANGE);
        expectControls(false);
        await clickButton(/Continue/);
        await expectFreshStep(STEP_TWO);
        expectControls(false);
        await check(RANGE);
        expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
        expectControls(false);

        await clickButton(/Continue/);
        expect(header("Warm up")).toBeInTheDocument();
        await waitFor(() => expect(answerBox()).toHaveFocus());
        expectControls(true);
        expectOnlyLoggedTries(0);
      });

      it("keeps them hidden through a post-miss refresher and does not restore them after it", async () => {
        renderSession(allControlsWarmup());
        await check(SIX[2] ?? "");
        expectControls(false);

        await clickButton(LINK);
        await expectFreshStep(STEP_ONE);
        expectControls(false);
        await check(RANGE);
        await clickButton(/Continue/);
        await expectFreshStep(STEP_TWO);
        expectControls(false);
        await check(RANGE);
        expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
        expectControls(false);

        // The logged try's normal next screen, with no warm-up controls.
        await clickButton(/Continue/);
        expect(header("Fix a tricky spot")).toBeInTheDocument();
        expectControls(false);
        expectOnlyLoggedTries(1);
      });
    });

    it("opens once on a double activation and runs by keyboard alone", async () => {
      const user = userEvent.setup();
      renderSession(warmup(["solid", "solid"]));
      await user.dblClick(await screen.findByRole("button", { name: LINK }));
      await expectFreshStep(STEP_ONE);
      expect(screen.getAllByText(STEP_ONE)).toHaveLength(1);

      // Shift+Enter adds a line; Enter checks.
      await user.keyboard("The{Shift>}{Enter}{/Shift}Lord");
      expect(answerBox()).toHaveValue("The\nLord");
      expect(screen.queryByText(/recalled/)).toBeNull();
      await user.clear(answerBox());
      await user.paste(WARMUP);
      await user.keyboard("{Enter}");
      await screen.findByText(/recalled/);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );
      await user.keyboard("{Enter}");
      await expectFreshStep(STEP_TWO);
      await user.paste(WARMUP);
      await user.keyboard("{Enter}");
      expect(await screen.findByText(PRACTICE_ONLY)).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );
      await user.keyboard("{Enter}");
      expect(header("Warm up")).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expectOnlyLoggedTries(0);
    });
  });

  describe("Learning passage ••• Refresh (S14)", () => {
    const BACK = "Back to Psalm 23";
    const PRACTICE_ONLY = "Practice only, your progress didn't change.";
    const STEP_ONE = "Refresh · First letters · 1 of 2";
    const STEP_TWO = "Refresh · From memory · 2 of 2";
    const VERSE_THREE =
      "He restores my soul. He leads me in paths of righteousness.";
    const LEARNED = `${PASSAGE_ONE} ${PASSAGE_TWO}`;
    // 40 distinct words a verse, so the two learned verses can score 84% and 85%.
    const LETTERS = "abcdefghijklmnopqrstuvwxyz";
    const longVerse = (number: number) =>
      Array.from(
        { length: 40 },
        (_, index) =>
          `${LETTERS[number]}${LETTERS[index % 26]}${LETTERS[Math.floor(index / 26)]}`,
      ).join(" ");

    const answerBox = () => screen.getByLabelText("Your recited passage");
    const verse = (number: number) => ({ chapter: 23, verse: number });
    const masked = (text: string, mode: "hidden" | "first-letters") =>
      maskVerseText(text, mode)
        .map((token) => token.text)
        .join("");

    /** The chapter as served: only `texts`, so later verses have no text. */
    function serveChapter(texts: readonly string[]) {
      fetchChaptersBatchMock.mockResolvedValue([
        {
          chapter: 23,
          data: {
            ...psalm23,
            verses: texts.map((text, index) => ({ number: index + 1, text })),
          },
        },
      ]);
    }

    /**
     * Verse 1 solid, verse 2 attached, verse 3 being learned, verse 4 not
     * reached. Only verses 1–2 have text, so loading more would fail.
     */
    function learningView(
      extra?: Partial<PassageView>,
      texts: readonly string[] = [PASSAGE_ONE, PASSAGE_TWO],
    ): PassageView {
      serveChapter(texts);
      const now = getSessionNow();
      return passageView(
        [
          piece(0, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
          piece(1, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
          piece(2, "learning", { learnStage: 1, dueAt: now }),
          piece(3, "unreached"),
        ],
        { lastSessionAt: now - 60_000, ...extra },
      );
    }

    function renderRefresh(view: PassageView = learningView()) {
      const onExit = vi.fn();
      const utils = render(
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={view}
            packName="Psalm 23"
            onExit={onExit}
            backLabel={BACK}
            refresh="practice"
          />
        </TooltipProvider>,
      );
      return { onExit, ...utils };
    }

    async function check(answer: string) {
      const box = await screen.findByLabelText("Your recited passage");
      await userEvent.click(box);
      await userEvent.paste(answer);
      const button = screen.getByRole("button", { name: /Check answer/ });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      await screen.findByText(/recalled/);
    }

    async function clickButton(name: RegExp | string) {
      await userEvent.click(await screen.findByRole("button", { name }));
    }

    async function expectFreshStep(header: string) {
      expect(await screen.findByText(header)).toBeInTheDocument();
      await waitFor(() => expect(answerBox()).toHaveFocus());
      expect(answerBox()).toHaveValue("");
    }

    function hintText(): string {
      return screen.getByLabelText("Hint").textContent ?? "";
    }

    /** No mutation ran: nothing about the passage was saved. */
    function expectNothingSaved() {
      for (const [name, fn] of mutationMocks) {
        expect(fn, name).not.toHaveBeenCalled();
      }
    }

    it("opens at First letters over the learned verses only, with no warm-up chrome", async () => {
      renderRefresh();
      await expectFreshStep(STEP_ONE);
      // The learned verses' title, never "whole passage" for a prefix.
      expect(screen.getByText("Psalm 23:1–2")).toBeInTheDocument();
      expect(
        screen.getByText("Type this part from memory"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/whole passage/)).toBeNull();
      expect(screen.queryByText(WARMUP_PROMPT_COPY)).toBeNull();
      expect(screen.queryByText(WARMUP_SKIP_LABEL)).toBeNull();
      expect(
        screen.queryByRole("status", { name: /Session phase/ }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
      // Every learned verse is hinted (none is shaky); verse 3, in progress,
      // and verse 4, unreached, never appear.
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      expect(screen.queryByText(/restores/)).toBeNull();

      // The answer is the learned verses: typing them is 100%.
      await check(LEARNED);
      expect(screen.getByText("100% recalled")).toBeInTheDocument();
    });

    it("covers a single learned verse alone", async () => {
      const now = getSessionNow();
      serveChapter([PASSAGE_ONE]);
      renderRefresh(
        passageView([
          piece(0, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
          piece(1, "learning", { learnStage: 1, dueAt: now }),
        ]),
      );
      await expectFreshStep(STEP_ONE);
      expect(screen.getByText("Psalm 23:1")).toBeInTheDocument();
      expect(hintText()).toBe(ONE_HALF);
      await check(PASSAGE_ONE);
      expect(screen.getByText("100% recalled")).toBeInTheDocument();
    });

    it("hints only the shaky learned verses, every other learned word blank", async () => {
      renderRefresh(learningView({ shakyVerses: [verse(2)] }));
      await expectFreshStep(STEP_ONE);
      expect(hintText()).toBe(`${ONE_BLANK} ${TWO_HALF}`);
    });

    it.each([
      ["only the verse in progress", [verse(3)]],
      ["only an unreached verse", [verse(4)]],
      ["none", []],
    ])(
      "hints every learned verse when the shaky ones are %s",
      async (_label, shakyVerses) => {
        renderRefresh(
          learningView({ shakyVerses }, [
            PASSAGE_ONE,
            PASSAGE_TWO,
            VERSE_THREE,
            "Even though I walk through the valley.",
          ]),
        );
        await expectFreshStep(STEP_ONE);
        expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      },
    );

    it("every-word First letters at 84% reads Try again and at 85% Continue; From memory is unhinted and ends practice only", async () => {
      const long = [longVerse(1), longVerse(2)];
      const full = long.join(" ");
      const typedAt = (percent: number) => {
        const words = full.split(" ");
        for (let count = words.length; count > 0; count -= 1) {
          const typed = words.slice(0, count).join(" ");
          if (verseAttemptAccuracy(diffWords(typed, full)) === percent) {
            return typed;
          }
        }
        throw new Error(`No prefix scores ${percent}%`);
      };
      const { onExit } = renderRefresh(learningView(undefined, long));
      await expectFreshStep(STEP_ONE);
      // 84% overall with verse 2 under 85%: Continue only, to every word on
      // verse 2 alone.
      await check(typedAt(84));
      expect(screen.queryByText(PRACTICE_ONLY)).toBeNull();
      expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      expect(hintText()).toBe(
        `${masked(long[0], "hidden")} ${masked(long[1], "first-letters")}`,
      );
      await check(typedAt(84));
      await clickButton(/Try again/);
      await expectFreshStep("Refresh · First letters · 2 of 3");
      await check(typedAt(85));
      await clickButton(/Continue/);

      await expectFreshStep("Refresh · From memory · 3 of 3");
      expect(
        screen.getByText("Now try it without the hints."),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Hint")).toBeNull();
      await check(typedAt(30));
      expect(screen.getByText(PRACTICE_ONLY)).toBeInTheDocument();
      // Just the score, the closing and Continue.
      for (const name of [
        /Refresh/,
        "Try another refresher",
        "Need a refresher?",
        /Try again/,
      ]) {
        expect(screen.queryByRole("button", { name })).toBeNull();
      }
      expect(screen.queryByText("Counted as today's review")).toBeNull();
      expect(screen.queryByText(/^Next review /)).toBeNull();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus(),
      );

      await clickButton(/Continue/);
      expect(onExit).toHaveBeenCalledTimes(1);
      expectNothingSaved();
    });

    it("Continue after a pass leaves straight to the passage page", async () => {
      const { onExit } = renderRefresh();
      await expectFreshStep(STEP_ONE);
      await check(LEARNED);
      await clickButton(/Continue/);
      await expectFreshStep(STEP_TWO);
      await check(LEARNED);
      expect(screen.getByText(PRACTICE_ONLY)).toBeInTheDocument();
      await clickButton(/Continue/);
      expect(onExit).toHaveBeenCalledTimes(1);
      // No Learning screen flashes up on the way out.
      expect(screen.queryByText(NEXT_VERSE_PROMPT_COPY)).toBeNull();
      expect(screen.queryByText(WARMUP_PROMPT_COPY)).toBeNull();
      expectNothingSaved();
    });

    it.each(["First letters", "From memory"])(
      "Back during %s leaves to the passage page and saves nothing",
      async (step) => {
        // A Learning step left in progress in this tab stays as it was.
        const marker = JSON.stringify({
          packId: PACK_ID,
          origin: performance.timeOrigin - 1,
        });
        sessionStorage.setItem(PASSAGE_STEP_IN_PROGRESS_KEY, marker);
        const { onExit, unmount } = renderRefresh();
        await expectFreshStep(STEP_ONE);
        if (step === "From memory") {
          await check(LEARNED);
          await clickButton(/Continue/);
          await expectFreshStep(STEP_TWO);
          await userEvent.type(answerBox(), "The Lord");
        } else {
          await userEvent.type(answerBox(), "The Lord");
        }
        await clickButton(BACK);
        expect(onExit).toHaveBeenCalledTimes(1);
        unmount();
        window.dispatchEvent(new Event("pagehide"));
        expectNothingSaved();
        expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBe(
          marker,
        );
      },
    );

    it("keeps its own window on a passage mid-section, with no Learning panels", async () => {
      // Verse 2 just finished section 1: the Learning session would offer
      // Section complete here.
      serveChapter([PASSAGE_ONE, PASSAGE_TWO]);
      const now = getSessionNow();
      renderRefresh(
        passageView([
          piece(0, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
          piece(1, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
          piece(2, "unreached", { sectionIndex: 1 }),
        ]),
      );
      await expectFreshStep(STEP_ONE);
      expect(screen.queryByText(SECTION_COMPLETE_COPY)).toBeNull();
      expect(screen.queryByText(NEXT_VERSE_PROMPT_COPY)).toBeNull();
      expect(screen.queryByText(DONE_FOR_NOW_LABEL)).toBeNull();
      expect(screen.getByText("Psalm 23:1–2")).toBeInTheDocument();
      expectNothingSaved();
    });

    it("shows the text error with Retry, and no score, until the text loads", async () => {
      const view = learningView();
      fetchChaptersBatchMock.mockRejectedValueOnce(new Error("offline"));
      renderRefresh(view);
      expect(
        await screen.findByText("Could not load verse text."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/recalled/)).toBeNull();
      expect(
        screen.getByRole("button", { name: /Check answer/ }),
      ).toBeDisabled();
      await clickButton("Retry");
      await screen.findByLabelText("Hint");
      expect(screen.getByText(STEP_ONE)).toBeInTheDocument();
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
      expectNothingSaved();
    });

    it("leaves S15's warm-up refresher hinting its whole range, shaky or not", async () => {
      serveChapter([PASSAGE_ONE, PASSAGE_TWO, VERSE_THREE]);
      const now = getSessionNow();
      render(
        <TooltipProvider delayDuration={0}>
          <PassageSession
            packId={PACK_ID}
            view={passageView(
              [
                piece(0, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
                piece(1, "solid", { learnStage: 3, dueAt: now + DAY_MS }),
                piece(2, "learning", { learnStage: 1, dueAt: now }),
              ],
              { lastSessionAt: now - 60_000, shakyVerses: [verse(2)] },
            )}
            packName="Psalm 23"
            onExit={() => {}}
          />
        </TooltipProvider>,
      );
      await clickButton("Need a refresher?");
      await expectFreshStep(STEP_ONE);
      expect(hintText()).toBe(`${ONE_HALF} ${TWO_HALF}`);
    });
  });

  it("uses plain language for the remaining session copy", () => {
    expect(DONE_FOR_NOW_LABEL).toBe("That's enough for today");
    expect(FRONTIER_LOCKED_COPY).toBe(
      "Today's new verses are in. Tomorrow we'll start with a quick recite, then add more.",
    );
    expect(FRONTIER_LOCKED_COPY).not.toMatch(/rope|set for today/i);
    expect(BUDGET_EXHAUSTED_COPY).toBe(
      "That's 5 new verses today, a good day's work. Tomorrow you'll add the next ones.",
    );
    expect(NEXT_VERSE_PROMPT_COPY).toMatch(/down for the day/);
    expect(NEXT_VERSE_PROMPT_COPY).not.toMatch(/rope|frontier|introduce/i);
    expect(CONNECT_TITLE).toBe("Connect these verses");
    expect(CONNECT_COPY).toBe("Say them together so they stay linked.");
    expect(CONNECT_RECITE_LABEL).toBe("Join verses");
    expect(WARMUP_PROMPT_COPY).toMatch(/Warm up/i);
    expect(WARMUP_PROMPT_COPY).not.toMatch(/rope/i);
    expect(WARMUP_SKIP_LABEL).toBe("Skip warm-up");
    expect(PRACTICE_WHAT_YOU_KNOW_LABEL).toBe("Go over what you know");
    expect(SECTION_COMPLETE_COPY).toMatch(/finished this section/);
    expect(SECTION_RECITE_LABEL).toBe("Recite this section");
  });
});
