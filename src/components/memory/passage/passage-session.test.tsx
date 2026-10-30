import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { DAY_MS, requiredRepsFor } from "@/lib/memory-scheduler";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  clearPassageStepInProgress,
  PASSAGE_STEP_IN_PROGRESS_KEY,
} from "@/lib/passage-step-resume";
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
  WARMUP_PROMPT_COPY,
  WARMUP_SKIP_LABEL,
} from "./passage-session-model";
import { PassageSession } from "./passage-session";
import type { PassageView } from "./passage-session-types";
import { CARRIED_OVER_SEEN_KEY_PREFIX } from "./use-carried-over-notice";

const { mutationMocks, fetchChaptersBatchMock } = vi.hoisted(() => ({
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  fetchChaptersBatchMock: vi.fn(),
}));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useQuery: (name: string) =>
    name === "passageMemory.shakyPieces" ? [] : { stale: false },
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: {
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
      createAndMemorize: "packs.createAndMemorize",
    },
    passageMemory: {
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
      markCelebrated: "passageMemory.markCelebrated",
      reviewFreshness: "passageMemory.reviewFreshness",
      finishRefresh: "passageMemory.finishRefresh",
      shakyPieces: "passageMemory.shakyPieces",
    },
  },
}));

const PACK_ID = "pack_1" as Id<"packs">;
const PASSAGE_ONE = "The Lord is my shepherd; I shall not want.";
const PASSAGE_TWO = "He makes me lie down in green pastures.";

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

  it("clears the in-progress marker when the learner leaves", async () => {
    const onExit = vi.fn();
    renderSession(practicedDueView(), onExit);
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

  it("opens a Refresh sitting over only the learned verses of a building passage", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PassageSession
          packId={PACK_ID}
          view={passageView([
            piece(0, "solid", { learnStage: 3 }),
            piece(1, "learning", { learnStage: 2 }),
          ])}
          packName="Psalm 23"
          onExit={() => {}}
          refresh
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("status", { name: "Session phase: Refresh" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Type it with first letters")).toBeInTheDocument();
    expect(screen.queryByText(/Warm up/i)).not.toBeInTheDocument();
    expect(
      await screen.findByText((_, node) => node?.textContent === "T__"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText((_, node) => node?.textContent === "H_"),
    ).not.toBeInTheDocument();
  });

  it("puts a reviewing Refresh sitting in the same scroll shell as Learn", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PassageSession
          packId={PACK_ID}
          view={passageView(
            Array.from({ length: 6 }, (_, index) =>
              piece(index, "solid", { learnStage: 3 }),
            ),
            { status: "reviewing" },
          )}
          packName="Psalm 23"
          onExit={() => {}}
          refresh
        />
      </TooltipProvider>,
    );

    expect(
      document.querySelector('[data-slot="scroll-area-viewport"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("status", { name: "Session phase: Refresh" }),
    ).toBeInTheDocument();
  });

  it("ends a passage Review on the summary after Continue", async () => {
    const user = userEvent.setup();
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(
      passageView(
        [
          piece(0, "solid", { learnStage: 3 }),
          piece(1, "solid", { learnStage: 3 }),
        ],
        { status: "reviewing" },
      ),
    );
    renderSession(
      passageView(
        [
          piece(0, "solid", { learnStage: 3 }),
          piece(1, "solid", { learnStage: 3 }),
        ],
        { status: "reviewing" },
      ),
    );

    const answer = await screen.findByLabelText("Your recited passage");
    await user.click(answer);
    await user.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    expect(await screen.findByText("All caught up!")).toBeInTheDocument();
    expect(
      screen.queryByText("Recite the whole passage from memory"),
    ).not.toBeInTheDocument();
  });

  it("runs First letters then From memory after Refresh these verses on a failed join", async () => {
    const user = userEvent.setup();
    const now = getSessionNow();
    const joinView = passageView(
      [
        piece(0, "attached", {
          learnStage: 3,
          stageReps: requiredRepsFor(3) - 1,
          dueAt: now,
        }),
        piece(1, "attached", {
          learnStage: 3,
          dueAt: now + DAY_MS,
        }),
      ],
      { remainingIntroduces: 0, addsOnDay: 5 },
    );
    mutationMock("passageMemory.recordAttempt").mockResolvedValue(joinView);
    renderSession(joinView);

    await user.click(
      await screen.findByRole("button", { name: WARMUP_SKIP_LABEL }),
    );
    const frontierAnswer = await screen.findByLabelText("Your recalled verse");
    await user.click(frontierAnswer);
    await user.paste(PASSAGE_ONE);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    await user.click(
      await screen.findByRole("button", { name: CONNECT_RECITE_LABEL }),
    );
    const joinAnswer = await screen.findByLabelText("Your recited passage");
    await user.click(joinAnswer);
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(
      await screen.findByRole("button", { name: "Refresh these verses" }),
    );
    const recordedBeforeRefresh = mutationMock("passageMemory.recordAttempt")
      .mock.calls.length;

    expect(
      await screen.findByText("Refresh · First letters"),
    ).toBeInTheDocument();
    expect(screen.getByText("First letters · 1 of 2")).toBeInTheDocument();

    const lettersAnswer = await screen.findByLabelText("Your recited passage");
    await user.click(lettersAnswer);
    await user.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText(/recalled/)).toBeVisible();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    expect(
      await screen.findByText("Refresh · From memory"),
    ).toBeInTheDocument();
    expect(screen.getByText("From memory · 2 of 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Now try it without the hints. Verse numbers aren't needed.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Starting hint")).not.toBeInTheDocument();
    expect(screen.queryByText("Try this part again")).not.toBeInTheDocument();
    expect(
      screen.queryByText("That's enough for today"),
    ).not.toBeInTheDocument();

    const memoryAnswer = await screen.findByLabelText("Your recited passage");
    await user.click(memoryAnswer);
    await user.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Back on track.")).toBeVisible();
    await user.click(await screen.findByRole("button", { name: /Continue/ }));

    expect(screen.queryByText("Refresh · From memory")).not.toBeInTheDocument();
    expect(mutationMock("passageMemory.recordAttempt").mock.calls).toHaveLength(
      recordedBeforeRefresh,
    );
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
