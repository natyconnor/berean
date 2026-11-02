import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import {
  LEAVE_NOW_FIRST_TRY_COUNTS,
  NEED_A_REFRESHER_LABEL,
  NOW_TRY_WITHOUT_HINTS,
  PRACTICE_ONLY_CLOSING,
  PRACTICE_ONLY_NOTE,
  REFRESH_SAVE_ERROR,
  TRY_ANOTHER_REFRESHER_LABEL,
  refresherHeader,
} from "@/lib/memory-copy";
import { MIN_LEARNING_LOCK_MS } from "@/lib/memory-scheduler";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EsvChapterData } from "../../../../shared/esv-api";
import { verseRefKey } from "../../../../shared/verse-ref-key";

import {
  PracticeBoard,
  type PracticeRunState,
  type PracticeSessionResult,
  type PracticeVerse,
} from "./practice-board";

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
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: {
      recordUnifiedReview: "packs.recordUnifiedReview",
    },
    passageMemory: {
      recordAttempt: "passageMemory.recordAttempt",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
    verseMemory: {
      recordAttempt: "verseMemory.recordAttempt",
      holdAttempt: "verseMemory.holdAttempt",
      applyHeldAttempt: "verseMemory.applyHeldAttempt",
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

function span(startVerse: number, endVerse: number) {
  return { book: "Psalms", chapter: 23, startVerse, endVerse };
}

const compositeVerse: PracticeVerse = {
  reference: span(1, 1),
  learnStage: 3,
  stageReps: 0,
  status: "reviewing",
  dueAt: getSessionNow() - 1000,
  ease: 2.3,
  intervalDays: 1,
  consecutiveCorrect: 1,
  lapses: 0,
  earlyReviewApplied: false,
  composite: {
    packId: PACK_ID,
    members: [span(1, 1), span(2, 2)],
  },
};

function renderComposite() {
  return render(
    <TooltipProvider delayDuration={0}>
      <PracticeBoard
        kind="review"
        verses={[compositeVerse]}
        scopeLabel="Psalm 23"
        onExit={() => {}}
        exitLabel="Back to pack"
        // Live value once the recitation has been graded: the whole pack now
        // shares one future due date, so nothing is left due today.
        remainingDue={0}
      />
    </TooltipProvider>,
  );
}

describe("PracticeBoard composite recitation", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("packs.recordUnifiedReview").mockResolvedValue({
      status: "reviewing",
      learnStage: 3,
      stageReps: 0,
      ease: 2.35,
      intervalDays: 2.3,
      dueAt: getSessionNow() + 2 * 24 * 60 * 60 * 1000,
      consecutiveCorrect: 2,
      lapses: 0,
      earlyReviewApplied: false,
    });
  });

  it("recites the pack as one card and grades it through recordUnifiedReview", async () => {
    const { container } = renderComposite();

    // Verse numbers are never typed: the concatenated text is the answer.
    const answer = await screen.findByLabelText("Your recited passage");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });

    // Pack name as the title, a quiet verse-count subtitle, one rail row, and
    // no order toggle — it is a single passage in passage order.
    expect(
      container.querySelector('[data-slot="card-title"]'),
    ).toHaveTextContent("Psalm 23");
    expect(screen.getByText("2 verses · one recitation")).toBeInTheDocument();
    expect(
      screen.getByText("Recite the whole passage from memory"),
    ).toBeInTheDocument();
    expect(screen.getByText("Passage")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Shuffle/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /^Psalm 23 \(From memory step\)$/,
      }),
    ).toHaveLength(1);

    await userEvent.click(check);

    const recordUnified = mutationMock("packs.recordUnifiedReview");
    await waitFor(() => {
      expect(recordUnified).toHaveBeenCalledTimes(1);
    });
    const [args] = recordUnified.mock.calls[0] as [
      { id: string; quality: string; accuracy: number; wordCount: number },
    ];
    expect(args.id).toBe(PACK_ID);
    expect(args.quality).toBe("exact");
    expect(args.accuracy).toBe(100);
    // The whole passage drives the long-verse rep curve, not one span: 9
    // words from the first unit plus 8 from the second.
    expect(args.wordCount).toBe(17);

    // The composite grade never touches the per-verse mutation.
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("passageMemory.recordAttempt")).not.toHaveBeenCalled();

    // The headline leads; the percentage is quiet text under it.
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.getByText("100% recalled")).toBeVisible();
    expect(screen.queryByText("100% recalled.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    // One summary, one accuracy, labeled with the pack — and no per-verse
    // practice shortcut into a single span.
    const summary = await screen.findByRole("heading", {
      name: /All caught up/,
    });
    expect(summary).toBeVisible();
    expect(screen.getByText("100%")).toBeVisible();
    const row = within(screen.getByRole("listitem"));
    expect(row.getByText("Psalm 23")).toBeVisible();
    expect(
      row.queryByRole("button", { name: "Practice" }),
    ).not.toBeInTheDocument();
  });

  it("celebrates a word-for-word recitation in one banner with particles", async () => {
    renderComposite();

    const answer = await screen.findByLabelText("Your recited passage");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    expect(await screen.findByText("Nailed it!")).toBeVisible();
    const banner = screen
      .getByText("Word for word.")
      .closest('[role="status"]');
    expect(banner).toHaveAttribute("data-tone", "exact");
    expect(banner).toHaveTextContent("🎉");
    expect(banner).toHaveTextContent("100% recalled");
    expect(banner).toHaveTextContent(/Next review in \d+ days\./);
    expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
  });

  it("grades a reviewing passage through passageMemory, not unified review", async () => {
    mutationMock("passageMemory.recordAttempt").mockResolvedValue({
      status: "reviewing",
      stageReps: 0,
      ease: 2.35,
      intervalDays: 2.3,
      dueAt: getSessionNow() + 2 * 24 * 60 * 60 * 1000,
      consecutiveCorrect: 2,
      lapses: 0,
      earlyReviewApplied: false,
    });
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[
            {
              ...compositeVerse,
              composite: {
                ...compositeVerse.composite!,
                passageStatus: "reviewing",
              },
            },
          ]}
          scopeLabel="Psalm 23"
          onExit={() => {}}
          remainingDue={0}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recited passage");
    await userEvent.click(answer);
    await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await userEvent.click(check);

    const recordPassage = mutationMock("passageMemory.recordAttempt");
    await waitFor(() => {
      expect(recordPassage).toHaveBeenCalledTimes(1);
    });
    const [args] = recordPassage.mock.calls[0] as [
      { packId: string; kind: string; quality: string; accuracy: number },
    ];
    expect(args.packId).toBe(PACK_ID);
    expect(args.kind).toBe("review");
    expect(args.quality).toBe("exact");
    expect(mutationMock("packs.recordUnifiedReview")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("opens a pack recitation already reviewed this session read-only", async () => {
    const unifiedId = `unified:${PACK_ID}`;
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[
            compositeVerse,
            {
              ...compositeVerse,
              composite: undefined,
              verseRefId: "vr_ps23_1" as Id<"verseRefs">,
            },
          ]}
          scopeLabel="Psalm 23"
          onExit={() => {}}
          remainingDue={0}
          initialVerseId={unifiedId}
          runState={{
            progress: {
              [unifiedId]: {
                status: "reviewing",
                learnStage: 3,
                stageReps: 0,
                dueAt: getSessionNow() + 2 * 24 * 60 * 60 * 1000,
                intervalDays: 2.3,
              },
            },
            attempts: [],
            graded: [unifiedId],
          }}
        />
      </TooltipProvider>,
    );

    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText(/^Next review /)).toBeInTheDocument();
    expect(screen.queryByLabelText("Your recited passage")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(mutationMock("packs.recordUnifiedReview")).not.toHaveBeenCalled();
  });

  it("offers retry when the composite passage fails to load", async () => {
    fetchChaptersBatchMock.mockRejectedValue(new Error("ESV is down"));
    renderComposite();

    expect(
      await screen.findByText("Could not load verse text."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
  });
});

const VERSE_REF_ID = "vr_ps23_1" as Id<"verseRefs">;

const learningVerse: PracticeVerse = {
  verseRefId: VERSE_REF_ID,
  reference: span(1, 1),
  learnStage: 0,
  stageReps: 0,
  status: "learning",
  dueAt: getSessionNow() - 1000,
};

describe("PracticeBoard learning Read prime", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 1,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });
  });

  it("advances from Read when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[learningVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Read it through, then continue")).toBeVisible();
    });
    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    await waitFor(() => {
      expect(continueButton).toBeEnabled();
    });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
    const [args] = mutationMock("verseMemory.recordAttempt").mock.calls[0] as [
      { verseRefId: string; mode: string; stage: number; quality: string },
    ];
    expect(args.verseRefId).toBe(VERSE_REF_ID);
    expect(args.mode).toBe("learn");
    expect(args.stage).toBe(0);
    expect(args.quality).toBe("exact");

    expect(
      await screen.findByText("Type what you remember"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Read it through, then continue"),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();
    });
  });

  it("skips the hearted-id list when every card already has verseRefId", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[learningVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(queryCalls).toContainEqual(["savedVerses.listRecordingIds", "skip"]);
  });

  it("subscribes to the hearted-id list when a card is missing verseRefId", () => {
    const withoutRefId: PracticeVerse = {
      reference: learningVerse.reference,
      learnStage: learningVerse.learnStage,
      stageReps: learningVerse.stageReps,
      status: learningVerse.status,
      dueAt: learningVerse.dueAt,
    };
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[withoutRefId]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(queryCalls).toContainEqual(["savedVerses.listRecordingIds", {}]);
  });
});

const guidedVerse: PracticeVerse = {
  ...learningVerse,
  learnStage: 1,
};

describe("PracticeBoard learning step label", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
  });

  it("shows the current step (1 of N), not completed count", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByText(/First letters · 1 of \d+ today/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/First letters · 0 of/)).not.toBeInTheDocument();
  });

  it("advances the journey bar when a check settles, before Continue", async () => {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 1,
      stageReps: 1,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });

    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    await screen.findByText(/First letters · 1 of \d+ today/);
    const pctBefore = Math.max(
      ...screen
        .getAllByLabelText(/Learning journey:/)
        .map((el) =>
          Number((el.getAttribute("aria-label") ?? "").match(/(\d+)%/)?.[1]),
        ),
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByText("Word for word.")).toBeVisible();
    await waitFor(() => {
      const pctAfter = Math.max(
        ...screen
          .getAllByLabelText(/Learning journey:/)
          .map((el) =>
            Number((el.getAttribute("aria-label") ?? "").match(/(\d+)%/)?.[1]),
          ),
      );
      expect(pctAfter).toBeGreaterThan(pctBefore);
    });
    // Step label stays on the step just graded until Continue.
    expect(
      screen.getByText(/First letters · 1 of \d+ today/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue/ }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(
      await screen.findByText(/First letters · 2 of \d+ today/),
    ).toBeInTheDocument();
  });

  it("ends the day after clearing First letters instead of opening blanks", async () => {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 2,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + MIN_LEARNING_LOCK_MS,
      consecutiveCorrect: 3,
      lapses: 0,
      earlyReviewApplied: false,
    });

    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[{ ...guidedVerse, stageReps: 2 }]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByText("Word for word.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(await screen.findByText("That's today's step.")).toBeInTheDocument();
    expect(
      screen.getByText("Tomorrow: Fill in the blanks"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Each day builds on the last\. See you tomorrow\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
  });

  async function finishLastStep() {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: 2,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + MIN_LEARNING_LOCK_MS,
      consecutiveCorrect: 3,
      lapses: 0,
      earlyReviewApplied: false,
    });
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
  }

  it("ends on Done with a ghost Extra practice that returns where it started", async () => {
    const onExit = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[{ ...guidedVerse, stageReps: 2 }]}
          scopeLabel="Memory"
          onExit={onExit}
          backLabel="Back to Memory"
          returnTo="/memory"
          hasMemorized
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Back to Memory" }),
    ).toBeInTheDocument();
    await finishLastStep();

    expect(await screen.findByText("That's today's step.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Extra practice" }),
    ).toHaveAttribute("href", "/memory/practice?return=%2Fmemory");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("leaves out Extra practice when nothing is memorized yet", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[{ ...guidedVerse, stageReps: 2 }]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    await finishLastStep();

    expect(
      await screen.findByRole("button", { name: "Done" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Extra practice" }),
    ).not.toBeInTheDocument();
  });

  it("hands the results up instead of a summary inside a longer session", async () => {
    const onComplete = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[{ ...guidedVerse, stageReps: 2 }]}
          scopeLabel="Today"
          onExit={() => {}}
          progress={{ label: "Learning · 1 verse", fraction: 0.4 }}
          onComplete={onComplete}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("progressbar", {
        name: "Session progress: Learning · 1 verse",
      }),
    ).toHaveAttribute("aria-valuenow", "40");
    await finishLastStep();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith({
      verses: [
        expect.objectContaining({
          reference: guidedVerse.reference,
          learnStage: 2,
          status: "learning",
        }),
      ],
      attempts: [],
    });
    expect(screen.queryByText("That's today's step.")).not.toBeInTheDocument();
  });
});

describe("PracticeBoard recall submit loading", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
  });

  it("shows Saving… while a passing recall is saving, then Continue", async () => {
    let resolveRecord!: (value: unknown) => void;
    const pendingRecord = new Promise((resolve) => {
      resolveRecord = resolve;
    });
    mutationMock("verseMemory.recordAttempt").mockReturnValue(pendingRecord);

    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);

    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });

    await userEvent.click(check);

    expect(await screen.findByText("Word for word.")).toBeVisible();
    const savingButton = screen.getByRole("button", { name: "Saving..." });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute("aria-busy", "true");
    expect(savingButton.querySelector("[data-icon=spinner]")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Try again|Continue/ }),
    ).not.toBeInTheDocument();

    resolveRecord({
      status: "learning",
      learnStage: 1,
      stageReps: 1,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 1,
      lapses: 0,
      earlyReviewApplied: false,
    });

    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    await waitFor(() => {
      expect(continueButton).toBeEnabled();
      expect(continueButton).not.toHaveAttribute("aria-busy");
    });
    expect(continueButton.querySelector("[data-icon=spinner]")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Saving..." }),
    ).not.toBeInTheDocument();
  });

  it("shows Saving… instead of Try again while a miss is saving", async () => {
    let resolveRecord!: (value: unknown) => void;
    const pendingRecord = new Promise((resolve) => {
      resolveRecord = resolve;
    });
    mutationMock("verseMemory.recordAttempt").mockReturnValue(pendingRecord);

    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[guidedVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste("not the verse");

    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    const savingButton = await screen.findByRole("button", {
      name: "Saving...",
    });
    expect(savingButton).toBeDisabled();
    expect(savingButton).toHaveAttribute("aria-busy", "true");
    expect(savingButton.querySelector("[data-icon=spinner]")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Try again/ }),
    ).not.toBeInTheDocument();

    resolveRecord({
      status: "learning",
      learnStage: 1,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: getSessionNow() + 1000,
      consecutiveCorrect: 0,
      lapses: 0,
      earlyReviewApplied: false,
    });

    const tryAgain = await screen.findByRole("button", { name: /Try again/ });
    await waitFor(() => {
      expect(tryAgain).toBeEnabled();
      expect(tryAgain).not.toHaveAttribute("aria-busy");
    });
    expect(
      screen.queryByRole("button", { name: "Saving..." }),
    ).not.toBeInTheDocument();
  });
});

function learningRef(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
): PracticeVerse {
  return {
    verseRefId: `${book}.${chapter}.${startVerse}` as Id<"verseRefs">,
    reference: { book, chapter, startVerse, endVerse },
    learnStage: 1,
    stageReps: 0,
    status: "learning",
    dueAt: getSessionNow() - 1000,
  };
}

const psalm8: EsvChapterData = {
  canonical: "Psalm 8",
  copyright: "test",
  verses: [
    { number: 2, text: "Out of the mouth of babies and infants." },
    { number: 3, text: "When I look at your heavens." },
    { number: 4, text: "What is man that you are mindful of him." },
    {
      number: 5,
      text: "Yet you have made him a little lower than the heavenly beings.",
    },
  ],
};

const luke9: EsvChapterData = {
  canonical: "Luke 9",
  copyright: "test",
  verses: [
    { number: 23, text: "And he said to all, If anyone would come after me." },
    { number: 24, text: "For whoever would save his life will lose it." },
  ],
};

function verseRailLabels(): string[] {
  return screen
    .getAllByRole("button", { name: / step[,)]/ })
    .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "");
}

describe("PracticeBoard in-order Scripture sequence", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(query === "Luke 9" ? luke9 : psalm8),
    );
  });

  it("keeps a mixed Continue Learning queue in Bible order with chapter groups", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[
            learningRef("Luke", 9, 23, 24),
            learningRef("Psalms", 8, 5),
            learningRef("Psalms", 8, 3, 4),
            learningRef("Psalms", 8, 2),
          ]}
          scopeLabel="Today's learning"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", {
        name: /Psalm 8:2 \(First letters step\)/,
      }),
    ).toBeVisible();
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
    expect(
      screen.getByText(
        "Scripture order. Verses from the same chapter stay together.",
      ),
    ).toBeVisible();
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3–4",
      "Psalm 8:5",
      "Luke 9:23–24",
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
    expect(
      screen.getByText("Sets stay together. Only the set order is random."),
    ).toBeVisible();
    const shuffled = verseRailLabels();
    expect(shuffled).toContain("Psalm 8:2");
    expect(
      shuffled.slice(
        shuffled.indexOf("Psalm 8:2"),
        shuffled.indexOf("Psalm 8:2") + 3,
      ),
    ).toEqual(["Psalm 8:2", "Psalm 8:3–4", "Psalm 8:5"]);
    expect(
      shuffled.join() === "Luke 9:23–24,Psalm 8:2,Psalm 8:3–4,Psalm 8:5" ||
        shuffled.join() === "Psalm 8:2,Psalm 8:3–4,Psalm 8:5,Luke 9:23–24",
    ).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "In order" }));
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3–4",
      "Psalm 8:5",
      "Luke 9:23–24",
    ]);
    expect(screen.getByText("Psalm 8")).toBeVisible();
    expect(screen.getByText("Luke 9")).toBeVisible();
  });

  it("hides Shuffle when the queue is a single chapter set", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[
            learningRef("Psalms", 8, 5),
            learningRef("Psalms", 8, 3, 4),
            learningRef("Psalms", 8, 2),
          ]}
          scopeLabel="Psalm 8"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", {
        name: /Psalm 8:2 \(First letters step\)/,
      }),
    ).toBeVisible();
    expect(verseRailLabels()).toEqual([
      "Psalm 8:2",
      "Psalm 8:3–4",
      "Psalm 8:5",
    ]);
    expect(
      screen.queryByRole("button", { name: "Shuffle" }),
    ).not.toBeInTheDocument();
  });
});

const reviewingVerse: PracticeVerse = {
  verseRefId: VERSE_REF_ID,
  reference: span(1, 1),
  learnStage: 3,
  stageReps: 0,
  status: "reviewing",
  dueAt: getSessionNow() - 1000,
  ease: 2.3,
  intervalDays: 5,
  consecutiveCorrect: 3,
  lapses: 0,
  earlyReviewApplied: false,
};

const stillDueSchedule = {
  status: "reviewing" as const,
  learnStage: 3,
  stageReps: 0,
  ease: 2.3,
  intervalDays: 5,
  dueAt: getSessionNow() - 1000,
  consecutiveCorrect: 3,
  lapses: 0,
  earlyReviewApplied: false,
};

const heldSchedule = {
  ...stillDueSchedule,
  dueAt: getSessionNow() + 5 * 24 * 60 * 60 * 1000,
};

const SECOND_REF_ID = "vr_ps23_2" as Id<"verseRefs">;
const secondReviewingVerse: PracticeVerse = {
  ...reviewingVerse,
  verseRefId: SECOND_REF_ID,
  reference: span(2, 2),
};
const FIRST_ID = verseRefKey(span(1, 1));
const SECOND_ID = verseRefKey(span(2, 2));

describe("PracticeBoard spent reviews", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(heldSchedule);
    mutationMock("verseMemory.holdAttempt").mockResolvedValue({
      heldId: "held_1",
    });
    mutationMock("verseMemory.applyHeldAttempt").mockResolvedValue({
      applied: true,
      schedule: heldSchedule,
    });
  });

  function renderBoard(
    kind: "review" | "practice",
    extra: Partial<Parameters<typeof PracticeBoard>[0]> = {},
  ) {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind={kind}
          verses={[reviewingVerse, secondReviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
          {...extra}
        />
      </TooltipProvider>,
    );
  }

  async function recite(text: string) {
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(text);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
  }

  /** The board's own verse rail row, e.g. "Psalm 23:1 (From memory step)". */
  function railButton(reference: string): HTMLElement {
    return screen.getByRole("button", {
      name: new RegExp(`^${reference} \\(`),
    });
  }

  it("opens a review spent this session read-only, with where it landed", async () => {
    renderBoard("review");

    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();

    await userEvent.click(railButton("Psalm 23:1"));

    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText(/^Next review /)).toBeInTheDocument();
    expect(screen.getByText("Done for today")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your recalled verse")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Check answer/ }),
    ).not.toBeInTheDocument();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
  });

  it("spends an 85–99% review on Continue only, then opens it read-only", async () => {
    renderBoard("review");

    await recite("The Lord is my shepherd I shall not eat");
    expect(
      await screen.findByRole("button", { name: /Continue/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Try again/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /keep going/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    await userEvent.click(railButton("Psalm 23:1"));

    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your recalled verse")).toBeNull();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
  });

  it("lets Practice recall the same verse again", async () => {
    renderBoard("practice");

    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await userEvent.click(railButton("Psalm 23:2"));
    await userEvent.click(railButton("Psalm 23:1"));

    expect(screen.queryByText("Reviewed")).not.toBeInTheDocument();
    await recite(PASSAGE_ONE);
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  it("reports the card on screen when the learner moves in the run", async () => {
    const onCurrentVerseId = vi.fn<(id: string) => void>();
    renderBoard("review", { onCurrentVerseId });

    await waitFor(() => {
      expect(onCurrentVerseId).toHaveBeenCalledWith(FIRST_ID);
    });
    await userEvent.click(railButton("Psalm 23:2"));
    expect(onCurrentVerseId).toHaveBeenLastCalledWith(SECOND_ID);
  });

  it("opens at the chosen verse and reports its run so it can resume", async () => {
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    const { unmount } = renderBoard("review", {
      initialVerseId: SECOND_ID,
      onRunStateChange,
    });

    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    await recite(PASSAGE_TWO);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await waitFor(() => {
      const [state] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.graded).toEqual([SECOND_ID]);
      expect(state?.progress[SECOND_ID]?.dueAt).toBe(heldSchedule.dueAt);
    });
    const [state, result] = onRunStateChange.mock.lastCall ?? [];
    expect(result?.attempts).toHaveLength(1);
    unmount();

    renderBoard("review", { initialVerseId: SECOND_ID, runState: state });
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your recalled verse")).toBeNull();
    await userEvent.click(railButton("Psalm 23:1"));
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
  });

  const spentRun = (ids: string[]): PracticeRunState => ({
    progress: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: heldSchedule.status,
          learnStage: heldSchedule.learnStage,
          stageReps: 0,
          dueAt: heldSchedule.dueAt,
          intervalDays: heldSchedule.intervalDays,
        },
      ]),
    ),
    attempts: ids.map(() => ({ reference: span(1, 1), accuracy: 100 })),
    graded: ids,
  });

  it("finishes straight away when a run is picked back up with nothing left", async () => {
    const onComplete = vi.fn();
    renderBoard("review", {
      runState: spentRun([FIRST_ID, SECOND_ID]),
      initialVerseId: FIRST_ID,
      onComplete,
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: [expect.anything(), expect.anything()],
      }),
    );
    expect(screen.queryByText("Reviewed")).not.toBeInTheDocument();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("moves from a reviewed card to the next one with work left", async () => {
    renderBoard("review");

    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    await userEvent.click(railButton("Psalm 23:1"));
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
  });

  it("finishes the run from the last spent card, as dismissing its result would", async () => {
    const onComplete = vi.fn();
    renderBoard("review", {
      runState: spentRun([FIRST_ID]),
      initialVerseId: SECOND_ID,
      onComplete,
    });

    await recite(PASSAGE_TWO);
    expect(await screen.findByText("Word for word.")).toBeInTheDocument();
    // Leave before dismissing the last result: every card is spent now.
    await userEvent.click(railButton("Psalm 23:1"));
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
  });

  it("moves on from a learning card that is done for today", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[
            { ...guidedVerse, reference: span(1, 1) },
            {
              ...guidedVerse,
              verseRefId: SECOND_REF_ID,
              reference: span(2, 2),
            },
          ]}
          scopeLabel="Memory"
          onExit={() => {}}
          initialVerseId={FIRST_ID}
          runState={{
            progress: {
              [FIRST_ID]: {
                status: "learning",
                learnStage: 2,
                stageReps: 0,
                dueAt: getSessionNow() + MIN_LEARNING_LOCK_MS,
              },
            },
            attempts: [],
            graded: [FIRST_ID],
          }}
        />
      </TooltipProvider>,
    );

    expect(await screen.findByText("Done for today")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
  });
});

describe("PracticeBoard session Home", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
  });

  it("shows Go to Memory when Back does not go to Memory", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[compositeVerse]}
          scopeLabel="Psalm 23"
          onExit={() => {}}
          backLabel="Back to John 3"
          exitHref="/passage/John-3"
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Back to John 3" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Memory" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });

  it("hides Go to Memory when Back already goes to Memory", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[compositeVerse]}
          scopeLabel="Psalm 23"
          onExit={() => {}}
          backLabel="Back to Memory"
          exitHref="/memory"
        />
      </TooltipProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Back to Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Go to Memory" }),
    ).not.toBeInTheDocument();
  });
});

describe("PracticeBoard session order", () => {
  const genesis1: EsvChapterData = {
    canonical: "Genesis 1",
    copyright: "test",
    verses: [{ number: 1, text: "In the beginning, God created." }],
  };

  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(
        query === "Luke 9" ? luke9 : query === "Genesis 1" ? genesis1 : psalm8,
      ),
    );
  });

  function sessionVerses(): PracticeVerse[] {
    return [
      learningRef("Genesis", 1, 1),
      learningRef("Psalms", 8, 2),
      learningRef("Luke", 9, 23, 24),
    ];
  }

  function railRow(reference: string): HTMLElement {
    return screen.getByRole("button", {
      name: new RegExp(`^${reference} \\(`),
    });
  }

  it("keeps the shown card, rail highlight, and deal landing after Shuffle", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={sessionVerses()}
          scopeLabel="Today's learning"
          onExit={() => {}}
          initialVerseId={verseRefKey({
            book: "Psalms",
            chapter: 8,
            startVerse: 2,
            endVerse: 2,
          })}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(railRow("Psalm 8:2")).toBeVisible();
    });
    expect(railRow("Psalm 8:2")).toHaveAttribute("aria-current", "true");
    await waitFor(() => {
      expect(screen.getByText("Verse 2 of 3")).toBeVisible();
    });

    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    expect(railRow("Psalm 8:2")).toHaveAttribute("aria-current", "true");
    const faces = screen.getAllByText("Shuffling your learning order");
    expect(faces.length).toBeGreaterThan(0);
    const lastFace = faces[faces.length - 1]?.closest("div");
    expect(lastFace).not.toBeNull();
    await waitFor(() => {
      expect(
        within(lastFace as HTMLElement).getByRole("heading", {
          name: "Psalm 8:2",
        }),
      ).toBeVisible();
    });
  });

  it("moves Next and a rail pick with the same list and highlight", async () => {
    const shown = verseRefKey({
      book: "Psalms",
      chapter: 8,
      startVerse: 2,
      endVerse: 2,
    });
    const luke = verseRefKey({
      book: "Luke",
      chapter: 9,
      startVerse: 23,
      endVerse: 24,
    });
    const onShow = vi.fn<(id: string) => void>();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={sessionVerses()}
          scopeLabel="Today's learning"
          onExit={() => {}}
          orderedIds={[
            shown,
            luke,
            verseRefKey({
              book: "Genesis",
              chapter: 1,
              startVerse: 1,
              endVerse: 1,
            }),
          ]}
          shownId={shown}
          onShow={onShow}
        />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(railRow("Psalm 8:2")).toBeVisible();
    });
    expect(railRow("Psalm 8:2")).toHaveAttribute("aria-current", "true");
    expect(verseRailLabels()[0]).toBe("Psalm 8:2");
    await waitFor(() => {
      expect(screen.getByText("Verse 1 of 3")).toBeVisible();
    });

    await userEvent.click(railRow("Luke 9:23–24"));
    expect(onShow).toHaveBeenCalledWith(luke);
  });
});

describe("PracticeBoard pre-try refresher", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(heldSchedule);
    mutationMock("verseMemory.holdAttempt").mockResolvedValue({
      heldId: "held_1",
    });
    mutationMock("verseMemory.applyHeldAttempt").mockResolvedValue({
      applied: true,
      schedule: heldSchedule,
    });
  });

  function renderReview(
    extra: Partial<Parameters<typeof PracticeBoard>[0]> = {},
  ) {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[reviewingVerse, secondReviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
          {...extra}
        />
      </TooltipProvider>,
    );
  }

  async function openRefresher() {
    const link = await screen.findByRole("button", {
      name: NEED_A_REFRESHER_LABEL,
    });
    await userEvent.click(link);
  }

  it("shows the quiet link on a due Memorized verse once the text has loaded", async () => {
    renderReview();
    const link = await screen.findByRole("button", {
      name: NEED_A_REFRESHER_LABEL,
    });
    await waitFor(() => {
      expect(link).toBeVisible();
    });
  });

  it("hides the link on Learning, New, the Learn flow, and composite cards", async () => {
    const hideLink = () => {
      expect(
        screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
      ).not.toBeInTheDocument();
    };

    const learning = render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[{ ...reviewingVerse, status: "learning", learnStage: 3 }]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    hideLink();
    learning.unmount();

    const learnFlow = render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[reviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    hideLink();
    learnFlow.unmount();

    const asNew = render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[{ ...reviewingVerse, status: "new", learnStage: 0 }]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    hideLink();
    asNew.unmount();

    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    const pack = renderComposite();
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
    hideLink();
    pack.unmount();
  });

  it("hides the link when verse text fails to load", async () => {
    getPassageMock.mockReset();
    getPassageMock.mockRejectedValue(new Error("ESV is down"));
    renderReview({ verses: [reviewingVerse] });
    expect(
      await screen.findByText("Could not load verse text."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("hides the link while verse text is still loading", async () => {
    getPassageMock.mockReset();
    getPassageMock.mockReturnValue(new Promise(() => {}));
    renderReview({ verses: [reviewingVerse] });
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/No hint text/)).not.toBeInTheDocument();
  });

  it("opens First letters, then From memory, with Try again under 85% and Continue at 85%+", async () => {
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onRunStateChange });
    await openRefresher();

    await waitFor(() => {
      expect(screen.getByText(refresherHeader(1))).toBeVisible();
    });
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    const step1Box = await screen.findByLabelText("Your recalled verse");
    expect(step1Box).toHaveValue("");
    expect(step1Box).toHaveFocus();

    await userEvent.paste("nope");
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByText("Another look will help it stick."),
    ).toBeVisible();
    expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(screen.getByText(refresherHeader(1))).toBeVisible();
    const retried = screen.getByLabelText("Your recalled verse");
    expect(retried).toHaveValue("");
    expect(retried).toHaveFocus();

    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByText(refresherHeader(2))).toBeVisible();
    expect(screen.getByText(NOW_TRY_WITHOUT_HINTS)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    const step2Box = screen.getByLabelText("Your recalled verse");
    expect(step2Box).toHaveValue("");
    expect(step2Box).toHaveFocus();

    await waitFor(() => {
      const [state] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.attempts).toEqual([]);
      expect(state?.graded).toEqual([]);
    });
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledWith(
      expect.objectContaining({
        hint: "first-letters",
        holdSchedule: true,
      }),
    );
  });

  it("offers Try another refresher after a counted From memory miss", async () => {
    renderReview();
    await openRefresher();
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );

    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste("nope");
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Continue/ })).toBeVisible();
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
    expect(screen.getByText(PRACTICE_ONLY_NOTE)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Try again/ }),
    ).not.toBeInTheDocument();
  });

  it("counts nothing when backing out before From memory", async () => {
    const onExit = vi.fn();
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onExit, onRunStateChange });
    await openRefresher();
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(onExit).toHaveBeenCalled();
    const [state] = onRunStateChange.mock.lastCall ?? [];
    expect(state?.attempts).toEqual([]);
    expect(state?.graded).toEqual([]);
  });

  it("shows Try again on a counted save failure and resends the same now", async () => {
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(heldSchedule);

    renderReview();
    await openRefresher();
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );

    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_SAVE_ERROR,
    );
    expect(
      screen.queryByRole("button", { name: /Continue/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(
      await screen.findByRole("button", { name: /Continue/ }),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(refresherHeader(2))).toBeVisible();
    expect(screen.getByText("Word for word.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();

    const calls = record.mock.calls as Array<[Record<string, unknown>]>;
    expect(calls).toHaveLength(3);
    expect(calls[1]?.[0]?.now).toBe(calls[2]?.[0]?.now);
    expect(calls[1]?.[0]?.refresherUsed).toBe(true);
    expect(calls[2]?.[0]?.refresherUsed).toBe(true);
    expect(calls[1]?.[0]?.accuracy).toBe(calls[2]?.[0]?.accuracy);
  });

  it("saves a counted From memory try once even if Check is activated twice", async () => {
    renderReview();
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    const check = screen.getByRole("button", { name: /Check answer/ });
    check.click();
    check.click();
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  it("retries a cold From memory save with the same now", async () => {
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(heldSchedule);

    renderReview();
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_SAVE_ERROR,
    );
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    expect(continueButton).toBeVisible();
    expect(continueButton).toHaveFocus();

    const calls = record.mock.calls as Array<[Record<string, unknown>]>;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0]?.now).toBe(calls[1]?.[0]?.now);
    expect(calls[0]?.[0]?.refresherUsed).toBeUndefined();
  });
});

const HELD_ID = "held_1" as Id<"heldVerseAttempts">;
const CLOSE_MISS = "The Lord is my shepherd I shall";
const BAD_MISS = "nope";

describe("PracticeBoard held first try", () => {
  beforeEach(() => {
    queryResults.clear();
    queryCalls.length = 0;
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listRecordingIds", []);
    fetchChaptersBatchMock.mockReset();
    getPassageMock.mockReset();
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(heldSchedule);
    mutationMock("verseMemory.holdAttempt").mockResolvedValue({
      heldId: HELD_ID,
    });
    mutationMock("verseMemory.applyHeldAttempt").mockResolvedValue({
      applied: true,
      schedule: heldSchedule,
    });
  });

  function renderReview(
    extra: Partial<Parameters<typeof PracticeBoard>[0]> = {},
  ) {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[reviewingVerse, secondReviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
          {...extra}
        />
      </TooltipProvider>,
    );
  }

  async function holdColdMiss(answer: string) {
    const box = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(box);
    await userEvent.paste(answer);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    const offer = await screen.findByRole("button", {
      name: NEED_A_REFRESHER_LABEL,
    });
    await waitFor(() => {
      expect(offer).toBeEnabled();
    });
    return offer;
  }

  it("holds a 70% miss with the S1 next-review line and no held copy", async () => {
    renderReview();
    const offer = await holdColdMiss(CLOSE_MISS);
    expect(screen.getByText(/Next review/)).toBeVisible();
    expect(screen.queryByText(/held/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not saved/i)).not.toBeInTheDocument();
    expect(offer).toHaveFocus();
    expect(screen.getByRole("button", { name: /Continue/ })).toBeVisible();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.holdAttempt")).toHaveBeenCalledTimes(1);
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
  });

  it("uses We'll bring it back sooner on a held miss under 60%", async () => {
    renderReview();
    await holdColdMiss(BAD_MISS);
    expect(screen.getByText("We'll bring it back sooner.")).toBeVisible();
    expect(
      screen.queryByText("Another look will help it stick."),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/back to fill in the blanks/i)).toBeVisible();
  });

  it("applies the held miss once on Continue", async () => {
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onRunStateChange });
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => {
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).toHaveBeenCalledTimes(1);
    });
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledWith({
      heldId: HELD_ID,
    });
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    await waitFor(() => {
      const [state] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.graded).toEqual([FIRST_ID]);
      expect(state?.attempts).toHaveLength(1);
    });
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("applies the held miss once on Back", async () => {
    const onExit = vi.fn();
    renderReview({ onExit });
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(onExit).toHaveBeenCalled();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
  });

  it("applies the held miss once on unmount and pagehide", async () => {
    const first = renderReview();
    await holdColdMiss(CLOSE_MISS);
    first.unmount();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );

    mutationMock("verseMemory.applyHeldAttempt").mockClear();
    const second = renderReview();
    await holdColdMiss(CLOSE_MISS);
    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => {
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).toHaveBeenCalledTimes(1);
    });
    second.unmount();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("shows the leave line on an after-miss refresher and applies the held miss on Back", async () => {
    renderReview();
    const offer = await holdColdMiss(CLOSE_MISS);
    await userEvent.click(offer);
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    expect(screen.getByText(LEAVE_NOW_FIRST_TRY_COUNTS)).toBeVisible();
    const step1 = screen.getByLabelText("Your recalled verse");
    expect(step1).toHaveFocus();
    expect(step1).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(""),
    );
    expect(step1.getAttribute("aria-describedby") ?? "").toMatch(/leave/);

    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
  });

  it("never shows the leave line on a pre-try refresher", async () => {
    renderReview();
    await userEvent.click(
      await screen.findByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    await waitFor(() => {
      expect(screen.getByText(refresherHeader(1))).toBeVisible();
    });
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
  });

  it("replaces the held miss with a From memory pass and keeps the gap", async () => {
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    const record = mutationMock("verseMemory.recordAttempt");
    await waitFor(() => {
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          replaceHeldId: HELD_ID,
          refresherUsed: true,
        }),
      );
    });
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
  });

  it("replaces the held miss with a From memory miss and offers practice", async () => {
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(BAD_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: /Continue/ });
    expect(continueButton).toHaveFocus();
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledWith(
      expect.objectContaining({
        replaceHeldId: HELD_ID,
        refresherUsed: true,
      }),
    );
  });

  it("keeps the held miss when step 2 fails, then Back applies it", async () => {
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockRejectedValueOnce(new Error("offline"));
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_SAVE_ERROR,
    );
    expect(screen.getByText(LEAVE_NOW_FIRST_TRY_COUNTS)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
    const recordCalls = record.mock.calls as Array<[Record<string, unknown>]>;
    expect(recordCalls.some((call) => call[0]?.replaceHeldId)).toBe(true);
  });

  it("runs a later round as practice only", async () => {
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onRunStateChange });
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(BAD_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    const practice1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practice1);
    await userEvent.paste(PASSAGE_ONE);
    await waitFor(() => {
      expect(practice1).toHaveValue(PASSAGE_ONE);
    });
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const practice2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practice2);
    await userEvent.paste(PASSAGE_ONE);
    await waitFor(() => {
      expect(practice2).toHaveValue(PASSAGE_ONE);
    });
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus();
    const [state] = onRunStateChange.mock.lastCall ?? [];
    expect(state?.attempts).toHaveLength(1);
  });

  it("shows the leave line on both after-miss steps, then drops it once step 2 is saved", async () => {
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    expect(await screen.findByText(LEAVE_NOW_FIRST_TRY_COUNTS)).toBeVisible();
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(screen.getByText(LEAVE_NOW_FIRST_TRY_COUNTS)).toBeVisible();
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
    expect(screen.getByText(LEAVE_NOW_FIRST_TRY_COUNTS)).toBeVisible();
    const step2 = screen.getByLabelText("Your recalled verse");
    expect(step2.getAttribute("aria-describedby") ?? "").toMatch(/leave/);
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(
      screen.queryByText(LEAVE_NOW_FIRST_TRY_COUNTS),
    ).not.toBeInTheDocument();
  });

  it("disables the offer and shows Saving... while Continue applies the held miss", async () => {
    let release: (value: {
      applied: boolean;
      schedule: typeof heldSchedule;
    }) => void = () => {};
    mutationMock("verseMemory.applyHeldAttempt").mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByRole("button", { name: /Saving/ })).toBeVisible();
    expect(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeDisabled();
    release({ applied: true, schedule: heldSchedule });
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
  });

  it("focuses Try again on a held Continue save error, then Continue after a successful retry", async () => {
    mutationMock("verseMemory.applyHeldAttempt")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ applied: true, schedule: heldSchedule });
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const retry = await screen.findByRole("button", { name: /Try again/ });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_SAVE_ERROR,
    );
    expect(retry).toHaveFocus();
    expect(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).toBeEnabled();
    await userEvent.click(retry);
    expect(await screen.findByText("Verse 2 of 2")).toBeInTheDocument();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      2,
    );
  });

  it("focuses Continue after a successful retry of a counted step 2 save", async () => {
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(heldSchedule);
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    const step2 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    const retry = await screen.findByRole("button", { name: /Try again/ });
    expect(retry).toHaveFocus();
    await userEvent.click(retry);
    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    expect(continueButton).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not hold a Learning miss", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="learning"
          verses={[{ ...reviewingVerse, status: "learning", learnStage: 3 }]}
          scopeLabel="Memory"
          onExit={() => {}}
        />
      </TooltipProvider>,
    );
    const box = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(box);
    await userEvent.paste(BAD_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalled();
    });
    expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
  });
});
