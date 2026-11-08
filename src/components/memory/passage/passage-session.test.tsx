import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { formatDueDay } from "@/lib/memorize-plan";
import { DAY_MS } from "@/lib/memory-scheduler";
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
  STOP_BEFORE_LABEL,
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
  useAction: (name: string) =>
    name === "esv.getChaptersBatch" ? fetchChaptersBatchMock : vi.fn(),
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

    it("shows no link on a text error, a not-due passage or while learning", async () => {
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
      const notDue = renderReview(reviewView({ dueAt: SAVED_DUE() }));
      await screen.findByText(/No hint text/);
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
      notDue.unmount();

      // A warm-up while learning shows the same empty panel, without a link.
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
      // Only the shaky verse 2 is hinted; verse 1 before it stays blank.
      expect(hintText()).toMatch(/^[_\s;.]+ H_ m____ m_ l__ d___/);
      expect(hintText()).not.toMatch(/T__/);

      await check("The Lord");
      expect(await screen.findByText(/recalled/)).toBeInTheDocument();
      await clickButton(/Try again/);
      await expectFreshStep("Refresh · First letters · 1 of 2");

      await check(FULL);
      await clickButton(/Continue/);
      await expectFreshStep("Refresh · From memory · 2 of 2");
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

    it("hints nothing when no verse is shaky, and every verse when all are", async () => {
      const { unmount } = renderReview();
      await clickButton("Need a refresher?");
      await screen.findByText("Refresh · First letters · 1 of 2");
      expect(hintText()).not.toMatch(/[a-z]/i);
      unmount();

      renderReview(reviewView({ shakyVerses: [verse(1), verse(2)] }));
      await clickButton("Need a refresher?");
      await screen.findByText("Refresh · First letters · 1 of 2");
      expect(hintText()).toMatch(/^T__ L___ i_ .* H_ m____/);
    });

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
      // A First letters miss and then a pass never reach the summary.
      await check("The Lord");
      await clickButton(/Try again/);
      await check(FULL);
      await clickButton(/Continue/);
      await screen.findByText("Refresh · From memory · 2 of 2");
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

    it("saves a not-due miss right away with no offer", async () => {
      renderReview(reviewView({ dueAt: SAVED_DUE() }));
      await check(WEAK_TWO);
      expect(record()).toHaveBeenCalledTimes(1);
      await screen.findByRole("button", { name: /Continue/ });
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
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

      // After the reload the passage is no longer due: no link, no hold.
      renderReview(reviewView({ dueAt: SAVED_DUE() }));
      await screen.findByText(/No hint text/);
      expect(
        screen.queryByRole("button", { name: "Need a refresher?" }),
      ).toBeNull();
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
        expect(hintText()).toMatch(
          /^T__ L___ i_ m_ s_______; I s____ n__ w___\. _/,
        );
        expect(hintText()).not.toMatch(/H_/);
      });

      it("marks and hints only an omitted second verse, not its piece-mate", async () => {
        renderReview(reviewView({ pieces: onePiece() }));
        await check(PASSAGE_ONE);
        expect(hold()).toHaveBeenCalledWith(
          expect.objectContaining({ verseScores: scores(100, 0) }),
        );
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toMatch(/^[_\s;.]+ H_ m____ m_ l__ d___/);
        expect(hintText()).not.toMatch(/T__/);
      });

      it("hints a remembered shaky verse alone within its piece", async () => {
        renderReview(
          reviewView({ pieces: onePiece(), shakyVerses: [verse(2)] }),
        );
        await clickButton("Need a refresher?");
        await screen.findByText("Refresh · First letters · 1 of 2");
        expect(hintText()).toMatch(/^[_\s;.]+ H_ m____/);
        expect(hintText()).not.toMatch(/T__/);
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
