import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verseAttemptAccuracy } from "@/components/study/study-attempt-quality";
import { reviewOutcomeMessage } from "@/components/study/verse-attempt-feedback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { mockStepLabelLayout } from "@/test/step-label-layout";
import { getSessionNow } from "@/hooks/use-live-now";
import { diffWords } from "@/lib/diff-words";
import {
  COUNTED_TODAY_CLOSING,
  NEED_A_REFRESHER_LABEL,
  NEED_A_REFRESHER_TOOLTIP,
  NOW_TRY_WITHOUT_HINTS,
  PRACTICE_ONLY_CLOSING,
  PRACTICE_PASS_EMOJI,
  PRACTICE_PASS_LEAD,
  PRACTICE_PASS_REST,
  REFRESH_IT_FIRST_LABEL,
  REFRESH_SAVE_ERROR,
  TRY_ANOTHER_REFRESHER_LABEL,
  refresherHeader,
} from "@/lib/memory-copy";
import { formatDueDay } from "@/lib/memorize-plan";
import {
  DAY_MS,
  MASTERED_INTERVAL_DAYS,
  MIN_LEARNING_LOCK_MS,
  REVIEW_LAPSE_LEARN_STAGE,
} from "@/lib/memory-scheduler";
import { previewNextSchedule } from "@/lib/memory-schedule-preview";
import {
  averageReviewAccuracy,
  groupReviewSessionAttempts,
  refresherResultCopy,
} from "@/lib/review-session-attempts";
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
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ href: "/memory/review", state: {} }),
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
    packs: {
      recordUnifiedReview: "packs.recordUnifiedReview",
    },
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
    queryResults.set("passageMemory.getForPack", { shakyVerses: [] });
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

  describe("in Today's queue", () => {
    const passageReview: PracticeVerse = {
      ...compositeVerse,
      composite: { ...compositeVerse.composite!, passageStatus: "reviewing" },
    };

    beforeEach(() => {
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
    });

    async function reciteAndContinue(
      onComplete: () => void,
      rest: PracticeVerse[] = [],
    ) {
      render(
        <TooltipProvider delayDuration={0}>
          <PracticeBoard
            kind="review"
            verses={[passageReview, ...rest]}
            scopeLabel="Today"
            onExit={() => {}}
            onComplete={onComplete}
          />
        </TooltipProvider>,
      );
      const answer = await screen.findByLabelText("Your recited passage");
      await userEvent.click(answer);
      await userEvent.paste(`${PASSAGE_ONE} ${PASSAGE_TWO}`);
      const check = screen.getByRole("button", { name: /Check answer/ });
      await waitFor(() => expect(check).toBeEnabled());
      await userEvent.click(check);
      await userEvent.click(
        await screen.findByRole("button", { name: /Continue/ }),
      );
    }

    it("advances from a passage review to the next item", async () => {
      const onComplete = vi.fn();
      await reciteAndContinue(onComplete, [secondReviewingVerse]);

      expect(
        await screen.findByLabelText("Your recalled verse"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Your recited passage")).toBeNull();
      expect(
        screen.queryByRole("heading", { name: "Review complete" }),
      ).toBeNull();
      expect(onComplete).not.toHaveBeenCalled();
      expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });

    it("hands up the run after a passage review that is the last item", async () => {
      const onComplete = vi.fn();
      await reciteAndContinue(onComplete);

      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByRole("heading", { name: "Review complete" }),
      ).toBeNull();
      expect(mutationMock("passageMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
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

  it("shows each pack verse's bar and next review after a bad miss, with no refresher", async () => {
    const now = getSessionNow();
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[
            {
              ...compositeVerse,
              composite: {
                packId: PACK_ID,
                members: [span(1, 1), span(2, 2)],
                memberSchedules: [
                  {
                    status: "reviewing",
                    learnStage: 3,
                    stageReps: 1,
                    dueAt: now,
                    ease: 2.3,
                    intervalDays: 1,
                    consecutiveCorrect: 1,
                    lapses: 0,
                    earlyReviewApplied: false,
                  },
                  {
                    status: "reviewing",
                    learnStage: 3,
                    stageReps: 3,
                    dueAt: now,
                    ease: 2.3,
                    intervalDays: 1,
                    consecutiveCorrect: 3,
                    lapses: 0,
                    earlyReviewApplied: false,
                  },
                ],
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
    await userEvent.paste("nope");
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/Learning journey: Fill in the blanks/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByLabelText(/Progress to mastered: Memorized · 0%/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Next review /).length).toBeGreaterThan(0);
    expect(screen.queryByText(/reps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Refresher used/)).not.toBeInTheDocument();
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

  it("lets Practice recall the same verse again, practice only once it is not due", async () => {
    renderBoard("practice");

    // Due: the first Practice try is the review.
    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
    await userEvent.click(railButton("Psalm 23:2"));
    await userEvent.click(railButton("Psalm 23:1"));

    // Now not due: another try is practice only and records nothing (R44).
    expect(screen.queryByText("Reviewed")).not.toBeInTheDocument();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(1);
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

  function verseHint(text: string) {
    return screen.getByText(
      (_, element) => element?.tagName === "P" && element.textContent === text,
    );
  }

  it("skips the every-word step after an 85%+ first try (F1)", async () => {
    renderReview();
    await openRefresher();
    await screen.findByText(refresherHeader(1));
    // Half the words lettered, the rest blank, never a visible word (F1).
    expect(
      verseHint("T__ L___ i_ m_ s_______; _ _____ ___ ____."),
    ).toBeInTheDocument();
    const box = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(box);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.getByText(refresherHeader(1))).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Try again/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText(refresherHeader(2))).toBeVisible();
    expect(screen.getByText(NOW_TRY_WITHOUT_HINTS)).toBeVisible();
  });

  it("opens First letters, Continue under 85% to every word, Try again there, then From memory (F2, F9, F10)", async () => {
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
    expect(screen.getByText(refresherHeader(1, 3))).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Try again/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText(refresherHeader(2, 3))).toBeVisible();
    expect(
      verseHint("T__ L___ i_ m_ s_______; I s____ n__ w___."),
    ).toBeInTheDocument();
    const everyWordBox = screen.getByLabelText("Your recalled verse");
    expect(everyWordBox).toHaveValue("");
    await waitFor(() => expect(everyWordBox).toHaveFocus());

    await userEvent.paste("nope");
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Try again/ }),
    );
    expect(screen.getByText(refresherHeader(2, 3))).toBeVisible();
    expect(
      verseHint("T__ L___ i_ m_ s_______; I s____ n__ w___."),
    ).toBeInTheDocument();
    const retried = screen.getByLabelText("Your recalled verse");
    expect(retried).toHaveValue("");
    expect(retried).toHaveFocus();

    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByText(refresherHeader(3, 3))).toBeVisible();
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
        await openRefresher();
        const step1Box = await screen.findByLabelText("Your recalled verse");
        await waitFor(() => expect(step1Box).toHaveFocus());
        await userEvent.paste("nope");
        await userEvent.click(
          screen.getByRole("button", { name: /Check answer/ }),
        );
        const continueButton = await screen.findByRole("button", {
          name: /Continue/,
        });
        layout.scrollToTop();
        await userEvent.click(continueButton);
        expect(screen.getByText(refresherHeader(2, 3))).toBeVisible();
        await waitFor(() => expect(layout.labelMeasures).not.toEqual([]));
        expect(layout.labelTop()).toBe(settledTop);
        const scrolls = layout.labelScrolls.length;
        expect(scrolls).toBe(labelTop === settledTop ? 0 : 1);
        const everyWordBox = screen.getByLabelText("Your recalled verse");
        await waitFor(() => expect(everyWordBox).toHaveFocus());

        await userEvent.paste("nope");
        await userEvent.click(
          screen.getByRole("button", { name: /Check answer/ }),
        );
        await userEvent.click(
          await screen.findByRole("button", { name: /Try again/ }),
        );
        await waitFor(() =>
          expect(screen.getByLabelText("Your recalled verse")).toHaveFocus(),
        );
        expect(layout.labelScrolls).toHaveLength(scrolls);
      } finally {
        layout.restore();
      }
    },
  );

  it("keeps S1 pass copy on a pre-try From memory pass", async () => {
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
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.getByText("Nailed it!")).toBeVisible();
    expect(screen.queryByText(PRACTICE_PASS_LEAD)).not.toBeInTheDocument();
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
    expect(
      screen.queryByText("Another refresher is practice only."),
    ).not.toBeInTheDocument();
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

  function withinCard() {
    const card = document.querySelector('[data-slot="card"]');
    expect(card).toBeInstanceOf(HTMLElement);
    return within(card as HTMLElement);
  }

  it("holds a 70% miss with the S1 next-review line and no held copy", async () => {
    renderReview();
    const card = document.querySelector('[data-slot="card"]');
    expect(card).toBeTruthy();
    const before = within(card as HTMLElement).getByLabelText(
      /Progress to mastered: Memorized/,
    );
    const beforePct = Number(
      before.getAttribute("aria-label")?.match(/(\d+)%/)?.[1],
    );
    const offer = await holdColdMiss(CLOSE_MISS);
    expect(screen.getByText("So close.")).toBeVisible();
    const dateLine = screen.getByText(/^Next review /);
    expect(dateLine).toBeVisible();
    expect(dateLine.textContent).toMatch(/^Next review \S+$/);
    expect(screen.queryByText(/if you/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/held/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not saved/i)).not.toBeInTheDocument();
    const after = within(card as HTMLElement).getByLabelText(
      /Progress to mastered: Memorized/,
    );
    const afterPct = Number(
      after.getAttribute("aria-label")?.match(/(\d+)%/)?.[1],
    );
    expect(afterPct).toBeLessThan(beforePct);
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
    expect(screen.getByText(/^Next review /)).toBeVisible();
    expect(
      screen.queryByText(/back to fill in the blanks/i),
    ).not.toBeInTheDocument();
    expect(
      withinCard().getByLabelText(/Progress to mastered: Memorized/),
    ).toBeInTheDocument();
    const labels = screen.getAllByLabelText(/Progress to mastered: Memorized/);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(labels.map((el) => el.getAttribute("aria-label"))).size,
    ).toBe(1);
  });

  it("slides a Mastered close miss to about 91% Memorized, then a pass returns 100%", async () => {
    const mastered = {
      ...reviewingVerse,
      status: "mastered" as const,
      intervalDays: MASTERED_INTERVAL_DAYS,
      stageReps: 0,
      consecutiveCorrect: 11,
      ease: 2.3,
    };
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "mastered",
      learnStage: 3,
      stageReps: 0,
      ease: 2.3,
      intervalDays: MASTERED_INTERVAL_DAYS,
      dueAt: getSessionNow() + MASTERED_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
      consecutiveCorrect: 11,
      lapses: 0,
      earlyReviewApplied: false,
    });
    renderReview({ verses: [mastered] });
    const before = withinCard().getByLabelText(
      /Progress to mastered: Mastered · 100%/,
    );
    expect(before).toBeInTheDocument();
    await holdColdMiss(CLOSE_MISS);
    const held = withinCard().getByLabelText(/Progress to mastered: Memorized/);
    expect(held.getAttribute("aria-label")).toMatch(/91%/);
    expect(held).toHaveAttribute("data-journey-motion", "slide");
    expect(
      screen.queryByLabelText(/Learning journey: Fill in the blanks/),
    ).not.toBeInTheDocument();
    const labels = screen.getAllByLabelText(/Progress to mastered: Memorized/);
    expect(
      new Set(labels.map((el) => el.getAttribute("aria-label"))).size,
    ).toBe(1);
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
    await waitFor(() => {
      expect(
        withinCard().getByLabelText(/Progress to mastered: Mastered · 100%/),
      ).toBeInTheDocument();
    });
  });

  it("slides a Mastered bad miss to about 73% Memorized, then a pass to about 82%", async () => {
    const now = getSessionNow();
    const mastered = {
      ...reviewingVerse,
      status: "mastered" as const,
      intervalDays: MASTERED_INTERVAL_DAYS,
      stageReps: 0,
      consecutiveCorrect: 11,
      ease: 2.3,
    };
    const pass = previewNextSchedule(
      {
        status: "mastered",
        learnStage: mastered.learnStage,
        stageReps: mastered.stageReps ?? 0,
        dueAt: mastered.dueAt ?? now,
        ease: mastered.ease,
        intervalDays: mastered.intervalDays,
        consecutiveCorrect: mastered.consecutiveCorrect,
        lapses: mastered.lapses,
        earlyReviewApplied: mastered.earlyReviewApplied,
      },
      {
        quality: "exact",
        accuracy: 100,
        mode: "review",
        now,
        wordCount: 9,
        refresherUsed: true,
        heldMissAccuracy: 40,
      },
    );
    expect(pass).not.toBeNull();
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(pass);
    renderReview({ verses: [mastered] });
    await holdColdMiss(BAD_MISS);
    const held = withinCard().getByLabelText(/Progress to mastered: Memorized/);
    expect(held.getAttribute("aria-label")).toMatch(/73%/);
    expect(held).toHaveAttribute("data-journey-motion", "slide");
    expect(
      screen.queryByLabelText(/Learning journey: Fill in the blanks/),
    ).not.toBeInTheDocument();
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
    await waitFor(() => {
      expect(
        withinCard()
          .getByLabelText(/Progress to mastered: Memorized/)
          .getAttribute("aria-label"),
      ).toMatch(/82%/);
    });
  });

  function sideJourney(): HTMLElement {
    const heading = screen.getByText("Progress");
    const panel = heading.parentElement;
    expect(panel).toBeInstanceOf(HTMLElement);
    return within(panel as HTMLElement).getByLabelText(
      /Progress to mastered|Learning journey/,
    );
  }

  function fillWidth(bar: HTMLElement): number {
    const fill = bar.querySelector(".h-full");
    expect(fill).toBeInstanceOf(HTMLElement);
    return Number.parseFloat((fill as HTMLElement).style.width);
  }

  it("keeps the dropped side progress on refresher step 2 and rises on a pass", async () => {
    const now = getSessionNow();
    const mastered = {
      ...reviewingVerse,
      status: "mastered" as const,
      intervalDays: MASTERED_INTERVAL_DAYS,
      stageReps: 0,
      consecutiveCorrect: 11,
      ease: 2.3,
    };
    const pass = previewNextSchedule(
      {
        status: "mastered",
        learnStage: mastered.learnStage,
        stageReps: mastered.stageReps ?? 0,
        dueAt: mastered.dueAt ?? now,
        ease: mastered.ease,
        intervalDays: mastered.intervalDays,
        consecutiveCorrect: mastered.consecutiveCorrect,
        lapses: mastered.lapses,
        earlyReviewApplied: mastered.earlyReviewApplied,
      },
      {
        quality: "exact",
        accuracy: 100,
        mode: "review",
        now,
        wordCount: 9,
        refresherUsed: true,
        heldMissAccuracy: 40,
      },
    );
    expect(pass).not.toBeNull();
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(pass);
    renderReview({ verses: [mastered] });
    await holdColdMiss(BAD_MISS);
    const droppedLabel = sideJourney().getAttribute("aria-label");
    expect(droppedLabel).toMatch(/Memorized/);
    expect(droppedLabel).toMatch(/73%/);
    expect(withinCard().getByLabelText(/Progress to mastered/)).toHaveAttribute(
      "aria-label",
      droppedLabel,
    );

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
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
    const side = sideJourney();
    expect(side).toHaveAttribute("aria-label", droppedLabel);
    expect(within(side).getByText("Memorized")).toBeVisible();
    expect(within(side).getByText("73% to mastered")).toBeVisible();
    expect(within(side).queryByText("Mastered")).not.toBeInTheDocument();
    expect(within(side).queryByText("100%")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fillWidth(sideJourney())).toBe(73);
    });
    const droppedWidth = fillWidth(sideJourney());

    const step2 = screen.getByLabelText("Your recalled verse");
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(fillWidth(sideJourney())).toBeGreaterThanOrEqual(droppedWidth);
    await waitFor(() => {
      const sideLabel = sideJourney().getAttribute("aria-label");
      const headerLabel = withinCard()
        .getByLabelText(/Progress to mastered/)
        .getAttribute("aria-label");
      expect(sideLabel).toBe(headerLabel);
      expect(sideLabel).toMatch(/82%/);
      expect(fillWidth(sideJourney())).toBeGreaterThanOrEqual(droppedWidth);
    });
  });

  it("keeps saved side progress through a practice-only miss and pass", async () => {
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
    await userEvent.click(
      await screen.findByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    const practice1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practice1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
    const saved = sideJourney().getAttribute("aria-label");
    expect(saved).toBeTruthy();

    const practiceMiss = screen.getByLabelText("Your recalled verse");
    await userEvent.click(practiceMiss);
    await userEvent.paste(BAD_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(sideJourney()).toHaveAttribute("aria-label", saved);

    await userEvent.click(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    const again1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(again1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(sideJourney()).toHaveAttribute("aria-label", saved);
    const practicePass = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practicePass);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(sideJourney()).toHaveAttribute("aria-label", saved);
  });

  it("drops to Fill in the blanks on a held bad miss with fewer than 3 banked", async () => {
    renderReview({
      verses: [
        {
          ...reviewingVerse,
          intervalDays: 1,
          stageReps: 1,
          consecutiveCorrect: 1,
        },
        secondReviewingVerse,
      ],
    });
    await holdColdMiss(BAD_MISS);
    expect(
      withinCard().getByLabelText(/Learning journey: Fill in the blanks/),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Next review /)).toBeVisible();
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
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    expect(mutationMock("verseMemory.applyHeldAttempt")).toHaveBeenCalledTimes(
      1,
    );
  });

  it.each([
    ["stays Memorized", "reviewing", true],
    ["drops to Learning", "learning", false],
  ] as const)(
    "offers summary Refresh after an applied close miss only when it %s (S9)",
    async (_, status, shown) => {
      mutationMock("verseMemory.applyHeldAttempt").mockResolvedValue({
        applied: true,
        schedule: { ...heldSchedule, status },
      });
      renderReview({ verses: [reviewingVerse] });
      await holdColdMiss(CLOSE_MISS);
      await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(await screen.findByText("All caught up!")).toBeVisible();
      const refresh = screen.queryByRole("button", {
        name: "Refresh Psalm 23:1",
      });
      if (shown) expect(refresh).toBeVisible();
      else expect(refresh).not.toBeInTheDocument();
    },
  );

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

  it("shows no leave line on an after-miss refresher and applies the held miss on Back", async () => {
    renderReview();
    const offer = await holdColdMiss(CLOSE_MISS);
    await userEvent.click(offer);
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    const step1 = screen.getByLabelText("Your recalled verse");
    expect(step1).toHaveFocus();
    expect(step1.getAttribute("aria-describedby") ?? "").not.toMatch(/leave/);

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
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Back to Memory/ }),
    );
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
  });

  it("replaces the held miss with a From memory pass and keeps the current gap", async () => {
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
    expect(screen.getByText("Nailed it!")).toBeVisible();
    expect(screen.queryByText(PRACTICE_PASS_LEAD)).not.toBeInTheDocument();
    expect(
      screen.queryByText("If you leave now, your first try counts."),
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

  it("shows the refresher result line next to the bar and date after a close miss then a pass", async () => {
    const missAccuracy = verseAttemptAccuracy(
      diffWords(CLOSE_MISS, PASSAGE_ONE),
    );
    renderReview({ verses: [reviewingVerse] });
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
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const line = await screen.findByText(
      `${missAccuracy}% → 100% · Refresher used`,
    );
    const row = line.closest("li");
    expect(row).toBeTruthy();
    expect(
      within(row as HTMLElement).getByLabelText(/Progress to mastered/),
    ).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/^Next review /)).toBeVisible();
    expect(screen.queryByText(/reps/i)).not.toBeInTheDocument();
    // The last try passed: no summary Refresh (S9).
    expect(
      screen.queryByRole("button", { name: /^Refresh / }),
    ).not.toBeInTheDocument();
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
      screen.queryByText("If you leave now, your first try counts."),
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
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
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
      screen.queryByText("If you leave now, your first try counts."),
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
    const practicePassBanner = await screen.findByRole("status");
    expect(practicePassBanner).toHaveTextContent(PRACTICE_PASS_LEAD);
    expect(practicePassBanner).toHaveTextContent(PRACTICE_PASS_REST);
    expect(practicePassBanner).toHaveTextContent(PRACTICE_PASS_EMOJI);
    expect(practicePassBanner).toHaveTextContent("100% recalled");
    expect(practicePassBanner).not.toHaveTextContent("Nailed it!");
    expect(practicePassBanner).not.toHaveTextContent("Word for word.");
    expect(practicePassBanner).not.toHaveTextContent("Well remembered");
    expect(practicePassBanner).not.toHaveTextContent("see if it comes back");
    expect(screen.queryByText("🎉")).not.toBeInTheDocument();
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
    // A 100% practice pass leaves only Continue.
    expect(
      screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus();
    const [state] = onRunStateChange.mock.lastCall ?? [];
    const missAccuracy = verseAttemptAccuracy(
      diffWords(CLOSE_MISS, PASSAGE_ONE),
    );
    const badAccuracy = verseAttemptAccuracy(diffWords(BAD_MISS, PASSAGE_ONE));
    expect(state?.attempts).toHaveLength(3);
    expect(state?.attempts?.[0]?.refresherUsed).toBeUndefined();
    expect(state?.attempts?.[1]?.refresherUsed).toBe(true);
    // Try another's From memory ends the row, but only as practice.
    expect(state?.attempts?.[2]).toMatchObject({
      accuracy: 100,
      displayOnly: true,
    });
    const [row] = groupReviewSessionAttempts(state?.attempts ?? []);
    expect(refresherResultCopy(row?.accuracies ?? [])).toBe(
      `${missAccuracy}% → 100% · Refresher used`,
    );
    expect(averageReviewAccuracy(state?.attempts ?? [])).toBe(
      Math.round((missAccuracy + badAccuracy) / 2),
    );
    expect(row?.countedAccuracy).toBe(badAccuracy);
  });

  async function reachPracticeFromMemory() {
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
    const practice1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practice1);
    await userEvent.paste(PASSAGE_ONE);
    await waitFor(() => {
      expect(practice1).toHaveValue(PASSAGE_ONE);
    });
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    return screen.getByLabelText("Your recalled verse");
  }

  async function tryAnotherFromMemory() {
    const record = mutationMock("verseMemory.recordAttempt");
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
    const tryAnother = await screen.findByRole("button", {
      name: TRY_ANOTHER_REFRESHER_LABEL,
    });
    // The counted From memory try saved.
    const counted = record.mock.calls as Array<[Record<string, unknown>]>;
    expect(counted.at(-1)?.[0]).toMatchObject({ refresherUsed: true });
    record.mockClear();
    await userEvent.click(tryAnother);
    const practice1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(practice1);
    await userEvent.paste(PASSAGE_ONE);
    await waitFor(() => {
      expect(practice1).toHaveValue(PASSAGE_ONE);
    });
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
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
    return record;
  }

  it("saves nothing from Try another on a verse still in review", async () => {
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onRunStateChange });
    const record = await tryAnotherFromMemory();
    expect(record).not.toHaveBeenCalled();
    const [state] = onRunStateChange.mock.lastCall ?? [];
    expect(state?.attempts?.at(-1)).toMatchObject({
      accuracy: 100,
      displayOnly: true,
    });
  });

  it("saves nothing from Try another after a lapse to Learning", async () => {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      ...stillDueSchedule,
      status: "learning",
      stageReps: 1,
      lapses: 1,
    });
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderReview({ onRunStateChange });
    const record = await tryAnotherFromMemory();
    // No learn rep, schedule, or chart point from a practice round.
    expect(record).not.toHaveBeenCalled();
    expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
    const [state] = onRunStateChange.mock.lastCall ?? [];
    expect(state?.attempts?.at(-1)).toMatchObject({
      accuracy: 100,
      displayOnly: true,
    });
  });

  it("shows practice pass copy at 90% with no Well remembered line", async () => {
    renderReview();
    const practice2 = await reachPracticeFromMemory();
    await userEvent.click(practice2);
    await userEvent.paste("The Lord is my shepherd I shall not eat");
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent(PRACTICE_PASS_LEAD);
    expect(banner).toHaveTextContent(PRACTICE_PASS_REST);
    expect(banner).toHaveTextContent(PRACTICE_PASS_EMOJI);
    expect(banner).not.toHaveTextContent("Well remembered");
    expect(banner).not.toHaveTextContent("Nailed it!");
    expect(banner).not.toHaveTextContent("see if it comes back");
    expect(screen.queryByText("🙌")).not.toBeInTheDocument();
    expect(screen.getByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    // Under 100%, practice still offers another refresher.
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
  });

  it("keeps S1 miss copy plus the practice-only line at 70%", async () => {
    renderReview();
    const practice2 = await reachPracticeFromMemory();
    await userEvent.click(practice2);
    await userEvent.paste(CLOSE_MISS);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("So close.");
    expect(banner).toHaveTextContent(
      "A few words slipped. The highlighted ones are worth another look.",
    );
    expect(banner).not.toHaveTextContent(PRACTICE_PASS_LEAD);
    expect(screen.getByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
  });

  it("shows no leave line on either after-miss step", async () => {
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    const step1 = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(step1);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
    const step2 = screen.getByLabelText("Your recalled verse");
    expect(step2.getAttribute("aria-describedby") ?? "").not.toMatch(/leave/);
    await userEvent.click(step2);
    await userEvent.paste(PASSAGE_ONE);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(
      screen.queryByText("If you leave now, your first try counts."),
    ).not.toBeInTheDocument();
  });

  it("previews the held miss date and bar without saving, matching Continue", async () => {
    renderReview();
    await holdColdMiss(CLOSE_MISS);
    const now = getSessionNow();
    const preview = previewNextSchedule(
      {
        status: "reviewing",
        learnStage: reviewingVerse.learnStage,
        stageReps: reviewingVerse.stageReps ?? 0,
        dueAt: reviewingVerse.dueAt ?? now,
        ease: reviewingVerse.ease,
        intervalDays: reviewingVerse.intervalDays,
        consecutiveCorrect: reviewingVerse.consecutiveCorrect,
        lapses: reviewingVerse.lapses,
        earlyReviewApplied: reviewingVerse.earlyReviewApplied,
      },
      {
        quality: "close",
        accuracy: 70,
        mode: "review",
        now,
        wordCount: 9,
      },
    );
    expect(preview).not.toBeNull();
    expect(
      screen.getByText(`Next review ${formatDueDay(preview!.dueAt, now)}`),
    ).toBeVisible();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
    mutationMock("verseMemory.applyHeldAttempt").mockResolvedValueOnce({
      applied: true,
      schedule: preview,
    });
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => {
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).toHaveBeenCalledTimes(1);
    });
  });

  it("does not open the Need a refresher? tooltip on auto-focus", async () => {
    renderReview();
    const offer = await holdColdMiss(CLOSE_MISS);
    expect(offer).toHaveFocus();
    const tip = screen.getByText(NEED_A_REFRESHER_TOOLTIP);
    expect(tip).toHaveClass("sr-only");
    expect(offer.getAttribute("aria-describedby") ?? "").toContain(tip.id);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(offer).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      NEED_A_REFRESHER_TOOLTIP,
    );
  });

  it("after a 40% miss, a refresher pass stays Memorized two steps back", async () => {
    const tomorrow = getSessionNow() + 24 * 60 * 60 * 1000;
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "reviewing",
      learnStage: 3,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 1,
      dueAt: tomorrow,
      consecutiveCorrect: 0,
      lapses: 0,
      earlyReviewApplied: false,
    });
    renderReview();
    await holdColdMiss(BAD_MISS);
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
    expect(screen.getByText("Next review tomorrow")).toBeVisible();
    await waitFor(() => {
      expect(
        withinCard().getByLabelText(/Progress to mastered: Memorized/),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(REVIEW_LAPSE_LEARN_STAGE).toBe(2);
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

  it("keeps a 3-banked bad miss at 0% Memorized after Continue", async () => {
    renderReview({
      verses: [
        {
          ...reviewingVerse,
          intervalDays: 1,
          stageReps: 3,
          consecutiveCorrect: 3,
        },
      ],
    });
    await holdColdMiss(BAD_MISS);
    expect(
      withinCard().getByLabelText(/Progress to mastered: Memorized · 0%/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Learning journey: Fill in the blanks/),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => {
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps a 0-banked close miss at 0% Memorized with the sky start mark", async () => {
    renderReview({
      verses: [
        {
          ...reviewingVerse,
          intervalDays: 1,
          stageReps: 0,
          consecutiveCorrect: 0,
        },
      ],
    });
    await holdColdMiss(CLOSE_MISS);
    expect(
      withinCard().getByLabelText(/Progress to mastered: Memorized · 0%/),
    ).toBeInTheDocument();
    expect(withinCard().getByText("0% to mastered")).toBeVisible();
    expect(screen.getByText(/^Next review /)).toBeVisible();
    expect(
      screen.queryByLabelText(/Learning journey: Fill in the blanks/),
    ).not.toBeInTheDocument();
  });

  it("after a bad miss with two banked, a refresher pass lands at 0% Memorized", async () => {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "reviewing",
      learnStage: 3,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 1,
      dueAt: getSessionNow() + 24 * 60 * 60 * 1000,
      consecutiveCorrect: 0,
      lapses: 1,
      earlyReviewApplied: false,
    });
    renderReview({
      verses: [
        {
          ...reviewingVerse,
          intervalDays: 1,
          stageReps: 2,
          consecutiveCorrect: 2,
        },
      ],
    });
    await holdColdMiss(BAD_MISS);
    expect(
      withinCard().getByLabelText(/Learning journey: Fill in the blanks/),
    ).toBeInTheDocument();
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
    const bar = withinCard().getByLabelText(
      /Progress to mastered: Memorized · 0%/,
    );
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("data-journey-motion", "fade");
  });

  it("after a bad miss with one banked, a refresher pass stays in Learning", async () => {
    mutationMock("verseMemory.recordAttempt").mockResolvedValue({
      status: "learning",
      learnStage: REVIEW_LAPSE_LEARN_STAGE,
      stageReps: 0,
      ease: 2.1,
      intervalDays: 0,
      dueAt: getSessionNow(),
      consecutiveCorrect: 0,
      lapses: 1,
      earlyReviewApplied: false,
    });
    renderReview({
      verses: [
        {
          ...reviewingVerse,
          intervalDays: 1,
          stageReps: 1,
          consecutiveCorrect: 1,
        },
      ],
    });
    await holdColdMiss(BAD_MISS);
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
      withinCard().getByLabelText(/Learning journey: Fill in the blanks/),
    ).toBeInTheDocument();
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

describe("PracticeBoard not-due Practice", () => {
  const notDueVerse: PracticeVerse = {
    ...reviewingVerse,
    dueAt: getSessionNow() + 3 * 24 * 60 * 60 * 1000,
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

  function renderPractice(
    extra: Partial<Parameters<typeof PracticeBoard>[0]> = {},
  ) {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="practice"
          verses={[notDueVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
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

  /** The card fades in from opacity 0 on mount; wait until it shows. */
  async function findVisibleRefresherLink(): Promise<HTMLElement> {
    const link = await screen.findByRole("button", {
      name: NEED_A_REFRESHER_LABEL,
    });
    await waitFor(() => {
      expect(link).toBeVisible();
    });
    return link;
  }

  function expectNoProgressWrite() {
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
  }

  function sideJourneyLabel(): string | null {
    const panel = screen.getByText("Progress").parentElement;
    expect(panel).toBeInstanceOf(HTMLElement);
    return within(panel as HTMLElement)
      .getByLabelText(/Progress to mastered|Learning journey/)
      .getAttribute("aria-label");
  }

  it.each([
    ["pass", PASSAGE_ONE, "Word for word."],
    ["miss", BAD_MISS, /Try again/],
  ] as const)(
    "a %s changes nothing: no write, no credit, no summary row",
    async (_label, answer, shown) => {
      const onRunStateChange =
        vi.fn<
          (state: PracticeRunState, result: PracticeSessionResult) => void
        >();
      renderPractice({ onRunStateChange });
      await findVisibleRefresherLink();
      const before = sideJourneyLabel();

      await recite(answer);
      if (typeof shown === "string") {
        expect(await screen.findByText(shown)).toBeVisible();
      } else {
        expect(
          await screen.findByRole("button", { name: shown }),
        ).toBeVisible();
      }

      expectNoProgressWrite();
      expect(sideJourneyLabel()).toBe(before);
      expect(
        screen.queryByText(/bring it back sooner/),
      ).not.toBeInTheDocument();
      // No post-miss offer, and no next-review line: nothing was scheduled.
      expect(
        screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
      const [state, result] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.graded).toEqual([]);
      expect(state?.attempts).toEqual([]);
      // Level, gap and due date are what the card opened with.
      expect(state?.progress[FIRST_ID]).toMatchObject({
        status: notDueVerse.status,
        learnStage: notDueVerse.learnStage,
        stageReps: notDueVerse.stageReps,
        intervalDays: notDueVerse.intervalDays,
        ease: notDueVerse.ease,
        dueAt: notDueVerse.dueAt,
      });
      expect(result?.attempts).toEqual([]);
    },
  );

  it("shows the quiet link, and its refresher is practice only", async () => {
    renderPractice();
    await userEvent.click(await findVisibleRefresherLink());
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();

    await recite(BAD_MISS);
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    await recite(PASSAGE_ONE);
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(screen.getByText(PRACTICE_PASS_LEAD)).toBeVisible();
    // A 100% practice pass leaves only Continue.
    expect(
      screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/ })).toBeVisible();

    expectNoProgressWrite();
  });

  it("drops the miss line on a not-due practice miss, keeping the lead", async () => {
    renderPractice();
    await findVisibleRefresherLink();
    await recite(BAD_MISS);
    expect(await screen.findByText("This one needs more time.")).toBeVisible();
    expect(screen.queryByText(/bring it back sooner/)).not.toBeInTheDocument();
    expectNoProgressWrite();
  });

  it("keeps the miss line on a due review miss", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[reviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
        />
      </TooltipProvider>,
    );
    await findVisibleRefresherLink();
    await recite(BAD_MISS);
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
  });

  it("keeps the miss line on a due Practice miss that counts", async () => {
    // The counted miss reschedules the verse past now; the result keeps the
    // line it was graded with.
    renderPractice({ verses: [reviewingVerse] });
    await findVisibleRefresherLink();
    await recite(BAD_MISS);
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
    await waitFor(() => {
      expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
        1,
      );
    });
    expect(screen.getByText("We'll bring it back sooner.")).toBeVisible();
  });

  // The saved result's due date, far from anything a preview would compute.
  const savedReview = {
    ...stillDueSchedule,
    intervalDays: 40,
    dueAt: getSessionNow() + 40 * 24 * 60 * 60 * 1000,
  };

  it.each(["review", "practice"] as const)(
    "a due %s pass shows Next review from the saved result",
    async (kind) => {
      mutationMock("verseMemory.recordAttempt").mockResolvedValue(savedReview);
      renderPractice({ kind, verses: [reviewingVerse], remainingDue: 0 });
      await findVisibleRefresherLink();
      await recite(PASSAGE_ONE);

      await waitFor(() => {
        expect(mutationMock("verseMemory.recordAttempt")).toHaveBeenCalledTimes(
          1,
        );
      });
      const line = reviewOutcomeMessage({
        outcome: "exact",
        nextSchedule: savedReview,
        now: Date.now(),
        lapsedToLearning: false,
      });
      expect(line).toMatch(/^Next review /);
      expect(await screen.findByText(line!)).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it.each(["review", "practice"] as const)(
    "a due %s save failure shows the review save error, then retries at the same time",
    async (kind) => {
      const record = mutationMock("verseMemory.recordAttempt");
      record
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(savedReview);
      renderPractice({ kind, verses: [reviewingVerse], remainingDue: 0 });
      await findVisibleRefresherLink();
      await recite(PASSAGE_ONE);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        REFRESH_SAVE_ERROR,
      );
      expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
      expect(record).toHaveBeenCalledTimes(2);
      expect(await screen.findByText(/^Next review /)).toBeVisible();
      // The retry resends the same try, at the first try's time.
      const calls = record.mock.calls as Array<[Record<string, unknown>]>;
      expect(calls[1]?.[0]).toEqual(calls[0]?.[0]);
      expect(calls[0]?.[0]?.now).toEqual(expect.any(Number));
    },
  );

  it("a not-due Practice result shows neither Next review nor a save error", async () => {
    mutationMock("verseMemory.recordAttempt").mockRejectedValue(
      new Error("offline"),
    );
    renderPractice();
    await findVisibleRefresherLink();
    await recite(PASSAGE_ONE);

    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(
      await screen.findByRole("button", { name: /Try again|Continue/ }),
    ).toBeEnabled();
    expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectNoProgressWrite();
  });

  it("offers the quiet link on a due Practice card, and its From memory try counts", async () => {
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockResolvedValueOnce(heldSchedule);
    renderPractice({ verses: [reviewingVerse] });

    await userEvent.click(await findVisibleRefresherLink());
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByText(PRACTICE_ONLY_CLOSING)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(record).toHaveBeenCalledTimes(2);
    });
    expect(record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        verseRefId: VERSE_REF_ID,
        mode: "practice",
        hint: "first-letters",
        holdSchedule: true,
      }),
    );
    const counted = record.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(counted).toMatchObject({
      verseRefId: VERSE_REF_ID,
      mode: "practice",
      quality: "exact",
      refresherUsed: true,
    });
    expect(counted).not.toHaveProperty("holdSchedule");
    expect(counted).not.toHaveProperty("hint");
  });
});

describe("PracticeBoard ••• Refresh", () => {
  const notDueVerse: PracticeVerse = {
    ...reviewingVerse,
    dueAt: getSessionNow() + 3 * 24 * 60 * 60 * 1000,
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
    getPassageMock.mockResolvedValue(psalm23);
    mutationMock("verseMemory.recordAttempt").mockResolvedValue(heldSchedule);
  });

  function renderRefresh(
    kind: "review" | "practice",
    verse: PracticeVerse,
    onExit = vi.fn(),
  ) {
    render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind={kind}
          verses={[verse]}
          scopeLabel="Psalm 23:1"
          onExit={onExit}
          backLabel="Back to verse"
          remainingDue={0}
          refresh
        />
      </TooltipProvider>,
    );
    return onExit;
  }

  async function recite(text: string) {
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(text);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
  }

  /** The card fades in on mount: wait until step 1 shows. */
  async function findStep1() {
    const header = await screen.findByText(refresherHeader(1));
    await waitFor(() => {
      expect(header).toBeVisible();
    });
  }

  async function passStep1() {
    await findStep1();
    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
  }

  function recordCalls() {
    return mutationMock("verseMemory.recordAttempt").mock.calls.map(
      ([args]) => args as Record<string, unknown>,
    );
  }

  function countedCalls() {
    return recordCalls().filter((args) => args.holdSchedule !== true);
  }

  it("opens straight at First letters, with no cold try first", async () => {
    renderRefresh("review", reviewingVerse);
    await findStep1();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/No hint text/)).not.toBeInTheDocument();
  });

  it.each([
    ["Practice, pass", "practice", PASSAGE_ONE, false],
    ["Practice, miss", "practice", BAD_MISS, true],
    ["Review reopened after it counted, pass", "review", PASSAGE_ONE, false],
    ["Review reopened after it counted, miss", "review", CLOSE_MISS, true],
  ] as const)(
    "is practice only on a not-due verse (%s) and Continue goes back",
    async (_, kind, answer, offersTryAnother) => {
      const onExit = renderRefresh(kind, notDueVerse);
      await passStep1();
      await recite(answer);
      expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
      expect(screen.getByText(/% recalled/)).toBeVisible();
      expect(screen.queryByText(COUNTED_TODAY_CLOSING)).not.toBeInTheDocument();
      expect(screen.queryByText(/Next review/)).not.toBeInTheDocument();
      // Try another shows under 100% only.
      expect(
        screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }) !==
          null,
      ).toBe(offersTryAnother);

      await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
      expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["pass", PASSAGE_ONE],
    ["miss", CLOSE_MISS],
  ] as const)(
    "counts From memory once on a due verse (%s) and Continue goes back",
    async (_, answer) => {
      const onExit = renderRefresh("review", reviewingVerse);
      await passStep1();
      expect(countedCalls()).toHaveLength(0);

      await recite(answer);
      expect(await screen.findByText(COUNTED_TODAY_CLOSING)).toBeVisible();
      expect(screen.getByText(/Next review/)).toBeVisible();
      expect(screen.queryByText(PRACTICE_ONLY_CLOSING)).not.toBeInTheDocument();
      expect(countedCalls()).toEqual([
        expect.objectContaining({
          verseRefId: VERSE_REF_ID,
          mode: "review",
          refresherUsed: true,
        }),
      ]);

      await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(countedCalls()).toHaveLength(1);
      expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
    },
  );

  it("keeps the counted line when a due bad miss drops the verse to Learning", async () => {
    // First letters saves as held; the counted From memory miss comes back
    // in Learning at fill in the blanks, as the server does for a lapse.
    mutationMock("verseMemory.recordAttempt")
      .mockResolvedValueOnce(heldSchedule)
      .mockResolvedValue({
        ...stillDueSchedule,
        status: "learning",
        learnStage: REVIEW_LAPSE_LEARN_STAGE,
        intervalDays: 0,
        consecutiveCorrect: 0,
        lapses: 1,
        dueAt: getSessionNow(),
      });
    const onExit = renderRefresh("review", {
      ...reviewingVerse,
      intervalDays: 1,
      consecutiveCorrect: 0,
    });
    await passStep1();
    await recite(BAD_MISS);
    expect(await screen.findByText(COUNTED_TODAY_CLOSING)).toBeVisible();
    expect(screen.queryByText(PRACTICE_ONLY_CLOSING)).not.toBeInTheDocument();
    expect(countedCalls()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(countedCalls()).toHaveLength(1);
  });

  it("keeps a later round after a counted miss practice only", async () => {
    const onExit = renderRefresh("review", reviewingVerse);
    await passStep1();
    await recite(CLOSE_MISS);
    await screen.findByText(COUNTED_TODAY_CLOSING);
    await userEvent.click(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    );
    await passStep1();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(countedCalls()).toHaveLength(1);
  });

  it.each(["First letters", "From memory"] as const)(
    "counts nothing when backing out at %s",
    async (step) => {
      const onExit = renderRefresh("review", reviewingVerse);
      if (step === "First letters") {
        await findStep1();
        await recite(PASSAGE_ONE);
        await screen.findByRole("button", { name: /Continue/ });
      } else {
        await passStep1();
      }
      await userEvent.click(
        screen.getByRole("button", { name: "Back to verse" }),
      );
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(countedCalls()).toHaveLength(0);
      expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
      expect(
        mutationMock("verseMemory.applyHeldAttempt"),
      ).not.toHaveBeenCalled();
    },
  );

  it("holds the counted line until the result is saved", async () => {
    // First letters saves; the From memory save fails.
    mutationMock("verseMemory.recordAttempt")
      .mockResolvedValueOnce(heldSchedule)
      .mockRejectedValue(new Error("offline"));
    renderRefresh("review", reviewingVerse);
    await passStep1();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText(REFRESH_SAVE_ERROR)).toBeVisible();
    expect(screen.queryByText(COUNTED_TODAY_CLOSING)).not.toBeInTheDocument();
  });
});

describe("PracticeBoard stale Refresh it first", () => {
  const NOW = getSessionNow();
  const notDueVerse: PracticeVerse = {
    ...reviewingVerse,
    dueAt: NOW + 3 * DAY_MS,
  };

  /** `verseDetail` for the card's stale check; only the fields it reads. */
  function verseDetail(
    over: {
      status?: "reviewing" | "mastered" | "learning" | "new";
      dueAt?: number;
      intervalDays?: number;
      startedOverAt?: number;
      accuracies?: number[];
      attempts?: Array<{ accuracy: number; createdAt: number }>;
    } = {},
  ) {
    return {
      status: over.status ?? "reviewing",
      dueAt: over.dueAt ?? NOW - 1000,
      intervalDays: over.intervalDays ?? 5,
      startedOverAt: over.startedOverAt,
      attempts:
        over.attempts ??
        (over.accuracies ?? [92]).map((accuracy, index) => ({
          accuracy,
          createdAt: NOW - (index + 1) * DAY_MS,
        })),
    };
  }
  const overdueDetail = verseDetail({ dueAt: NOW - 8 * DAY_MS });

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
    extra: Partial<Parameters<typeof PracticeBoard>[0]> = {},
  ) {
    return render(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[reviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
          {...extra}
        />
      </TooltipProvider>,
    );
  }

  async function findVisibleLink(): Promise<HTMLElement> {
    const link = await screen.findByRole("button", {
      name: NEED_A_REFRESHER_LABEL,
    });
    await waitFor(() => {
      expect(link).toBeVisible();
    });
    return link;
  }

  const cue = () =>
    screen.queryByRole("button", { name: REFRESH_IT_FIRST_LABEL });

  /** A stale card shows only Refresh it first, no quiet link (AC10). */
  async function findVisibleCue(): Promise<HTMLElement> {
    const button = await screen.findByRole("button", {
      name: REFRESH_IT_FIRST_LABEL,
    });
    await waitFor(() => {
      expect(button).toBeVisible();
    });
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    return button;
  }

  async function recite(text: string) {
    const answer = await screen.findByLabelText("Your recalled verse");
    await userEvent.click(answer);
    await userEvent.paste(text);
    await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
  }

  async function passStep1() {
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    await recite(PASSAGE_ONE);
    await userEvent.click(
      await screen.findByRole("button", { name: /Continue/ }),
    );
    expect(await screen.findByText(refresherHeader(2))).toBeVisible();
  }

  function expectNoProgressWrite() {
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
    expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
  }

  it("puts only an outlined Refresh it first under the sentence on a stale due verse", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard();
    const button = await findVisibleCue();
    const sentence = screen.getByText(
      "No hint text. Type the verse from memory, then check your answer.",
    );

    expect(button).toBeVisible();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveAccessibleName(REFRESH_IT_FIRST_LABEL);
    expect(button).toHaveClass("whitespace-normal", "h-auto", "max-w-full");
    expect(button).not.toHaveClass("whitespace-nowrap", "flex-1");
    expect(button).toHaveClass("focus-visible:ring-[3px]");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(
      sentence.compareDocumentPosition(button) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No reason line: nothing new besides the button.
    expect(screen.queryByText(/stale|been a while/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();
    expect(queryCalls).toContainEqual([
      "verseMemory.verseDetail",
      { verseRefId: VERSE_REF_ID, now: NOW },
    ]);
  });

  it.each([
    [
      "2 of the last 3 tries under 60%",
      verseDetail({ accuracies: [40, 90, 59] }),
    ],
    [
      "overdue by its own gap",
      verseDetail({ intervalDays: 20, dueAt: NOW - 20 * DAY_MS }),
    ],
    [
      "Mastered and overdue",
      verseDetail({
        status: "mastered",
        intervalDays: 35,
        dueAt: NOW - 35 * DAY_MS,
      }),
    ],
  ])("shows the button when %s", async (_label, detail) => {
    queryResults.set("verseMemory.verseDetail", detail);
    renderBoard({
      verses: [{ ...reviewingVerse, status: detail.status }],
    });
    await findVisibleCue();
  });

  it.each([
    [
      "1 of 3 under 60% and a 60–84% try",
      verseDetail({ accuracies: [40, 72, 95] }),
    ],
    [
      "overdue under its own gap",
      verseDetail({ intervalDays: 20, dueAt: NOW - 10 * DAY_MS }),
    ],
    ["overdue under 7 days", verseDetail({ dueAt: NOW - 6 * DAY_MS })],
    [
      "misses only from before a Start over",
      verseDetail({
        startedOverAt: NOW - 2 * DAY_MS,
        attempts: [
          { accuracy: 95, createdAt: NOW - DAY_MS },
          { accuracy: 20, createdAt: NOW - 3 * DAY_MS },
          { accuracy: 10, createdAt: NOW - 4 * DAY_MS },
        ],
      }),
    ],
  ])("shows only the quiet link when %s", async (_label, detail) => {
    queryResults.set("verseMemory.verseDetail", detail);
    renderBoard();
    await findVisibleLink();
    expect(cue()).not.toBeInTheDocument();
  });

  it("never shows on Learning, New, the Learn flow, or a pack card", async () => {
    queryResults.set(
      "verseMemory.verseDetail",
      verseDetail({ dueAt: NOW - 30 * DAY_MS, accuracies: [10, 20, 30] }),
    );
    const noCueOrLink = () => {
      expect(cue()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
      ).not.toBeInTheDocument();
    };

    const learning = renderBoard({
      verses: [{ ...reviewingVerse, status: "learning", learnStage: 3 }],
    });
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    noCueOrLink();
    learning.unmount();

    const learnFlow = renderBoard({ kind: "learning" });
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    noCueOrLink();
    learnFlow.unmount();

    const asNew = renderBoard({
      verses: [{ ...reviewingVerse, status: "new", learnStage: 0 }],
    });
    expect(
      await screen.findByText("Read it through, then continue"),
    ).toBeInTheDocument();
    noCueOrLink();
    asNew.unmount();

    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
    const pack = renderComposite();
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
    noCueOrLink();
    pack.unmount();

    // None of these even read the history.
    expect(
      queryCalls.filter(
        ([name, args]) => name === "verseMemory.verseDetail" && args !== "skip",
      ),
    ).toEqual([]);
  });

  it("shows no button while the text loads or after it fails", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    getPassageMock.mockReset();
    getPassageMock.mockReturnValue(new Promise(() => {}));
    const loading = renderBoard();
    expect(
      await screen.findByLabelText("Your recalled verse"),
    ).toBeInTheDocument();
    expect(cue()).not.toBeInTheDocument();
    loading.unmount();

    getPassageMock.mockReset();
    getPassageMock.mockRejectedValue(new Error("ESV is down"));
    renderBoard();
    expect(
      await screen.findByText("Could not load verse text."),
    ).toBeInTheDocument();
    expect(cue()).not.toBeInTheDocument();
  });

  it("never appears once typing has started, even if the history arrives later", async () => {
    // History has not loaded yet.
    renderBoard();
    await findVisibleLink();
    expect(cue()).not.toBeInTheDocument();
    const answer = screen.getByLabelText("Your recalled verse");
    await userEvent.type(answer, "The");

    queryResults.set("verseMemory.verseDetail", overdueDetail);
    await userEvent.type(answer, " Lord");
    expect(answer).toHaveValue("The Lord");
    expect(cue()).not.toBeInTheDocument();
    expect(answer).toHaveFocus();
  });

  it("appears when slow history arrives before typing, and stays while typing", async () => {
    const view = renderBoard();
    await findVisibleLink();
    expect(cue()).not.toBeInTheDocument();

    queryResults.set("verseMemory.verseDetail", overdueDetail);
    view.rerender(
      <TooltipProvider delayDuration={0}>
        <PracticeBoard
          kind="review"
          verses={[reviewingVerse]}
          scopeLabel="Memory"
          onExit={() => {}}
          remainingDue={0}
        />
      </TooltipProvider>,
    );
    expect(cue()).toBeVisible();
    // The quiet link gives way to Refresh it first.
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();

    await userEvent.type(screen.getByLabelText("Your recalled verse"), "The");
    // Even if the history changes under it, the shown button holds.
    queryResults.set("verseMemory.verseDetail", verseDetail());
    await userEvent.type(screen.getByLabelText("Your recalled verse"), " L");
    expect(cue()).toBeVisible();
  });

  it("is reached by Tab before the answer box, and Enter opens the refresher with the answer focused", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard();
    const button = await findVisibleCue();
    const answer = screen.getByLabelText("Your recalled verse");
    expect(answer).toHaveFocus();

    // Natural order: the button, then the answer box.
    await userEvent.tab({ shift: true });
    expect(button).toHaveFocus();
    await userEvent.tab();
    expect(answer).toHaveFocus();

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    const step1 = screen.getByLabelText("Your recalled verse");
    expect(step1).toHaveValue("");
    await waitFor(() => {
      expect(step1).toHaveFocus();
    });
    expect(cue()).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("opens the same refresher with Space", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard();
    (await findVisibleCue()).focus();
    await userEvent.keyboard(" ");
    expect(await screen.findByText(refresherHeader(1))).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();
    });
    expect(cue()).not.toBeInTheDocument();
  });

  it("due: the From memory try counts as today's review, then Continue moves on", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockResolvedValueOnce(heldSchedule);
    const onRunStateChange =
      vi.fn<(state: PracticeRunState, result: PracticeSessionResult) => void>();
    renderBoard({
      verses: [reviewingVerse, secondReviewingVerse],
      onRunStateChange,
    });
    await userEvent.click(await findVisibleCue());
    await passStep1();
    expect(cue()).not.toBeInTheDocument();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByText(PRACTICE_ONLY_CLOSING)).not.toBeInTheDocument();
    expect(cue()).not.toBeInTheDocument();

    await waitFor(() => {
      expect(record).toHaveBeenCalledTimes(2);
    });
    expect(record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ hint: "first-letters", holdSchedule: true }),
    );
    const counted = record.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(counted).toMatchObject({
      verseRefId: VERSE_REF_ID,
      mode: "review",
      quality: "exact",
      refresherUsed: true,
    });
    expect(counted).not.toHaveProperty("holdSchedule");
    await waitFor(() => {
      const [state] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.graded).toEqual([FIRST_ID]);
    });

    // Continue moves on as S4 does; the next card starts clean.
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const next = await screen.findByLabelText("Your recalled verse");
    await waitFor(() => {
      expect(next).toHaveFocus();
    });
    expect(next).toHaveValue("");
    expect(screen.queryByText(refresherHeader(1))).not.toBeInTheDocument();
  });

  it("due: a From memory miss follows the counted miss path", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard();
    await userEvent.click(await findVisibleCue());
    await passStep1();
    await recite(BAD_MISS);
    expect(
      await screen.findByText("We'll bring it back sooner."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: TRY_ANOTHER_REFRESHER_LABEL }),
    ).toBeVisible();
    expect(cue()).not.toBeInTheDocument();
  });

  it("due Practice card: shows the button and its From memory try counts", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    const record = mutationMock("verseMemory.recordAttempt");
    record
      .mockResolvedValueOnce(stillDueSchedule)
      .mockResolvedValueOnce(heldSchedule);
    renderBoard({ kind: "practice" });
    await userEvent.click(await findVisibleCue());
    await passStep1();
    await recite(PASSAGE_ONE);
    expect(await screen.findByText("Word for word.")).toBeVisible();
    expect(screen.queryByText(PRACTICE_ONLY_CLOSING)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(record).toHaveBeenCalledTimes(2);
    });
    expect(record.mock.calls[1]?.[0]).toMatchObject({
      mode: "practice",
      refresherUsed: true,
    });
  });

  it.each([
    ["pass", PASSAGE_ONE],
    ["miss", BAD_MISS],
  ] as const)(
    "not-due Practice: a %s ends practice only, writes nothing, and the button does not come back",
    async (_label, answer) => {
      queryResults.set(
        "verseMemory.verseDetail",
        verseDetail({ dueAt: notDueVerse.dueAt, accuracies: [30, 90, 20] }),
      );
      const onRunStateChange =
        vi.fn<
          (state: PracticeRunState, result: PracticeSessionResult) => void
        >();
      renderBoard({
        kind: "practice",
        verses: [notDueVerse],
        onRunStateChange,
      });
      await userEvent.click(await findVisibleCue());
      await passStep1();
      await recite(answer);
      expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
      expectNoProgressWrite();
      const [state, result] = onRunStateChange.mock.lastCall ?? [];
      expect(state?.graded).toEqual([]);
      expect(state?.attempts).toEqual([]);
      expect(result?.attempts).toEqual([]);
      expect(state?.progress[FIRST_ID]).toMatchObject({
        status: notDueVerse.status,
        learnStage: notDueVerse.learnStage,
        stageReps: notDueVerse.stageReps,
        intervalDays: notDueVerse.intervalDays,
        ease: notDueVerse.ease,
        dueAt: notDueVerse.dueAt,
      });

      if (answer === PASSAGE_ONE) {
        // Continue returns to the cold try: link only, answer focused.
        await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
        const link = await findVisibleLink();
        expect(link).toBeEnabled();
        expect(cue()).not.toBeInTheDocument();
        const cold = screen.getByLabelText("Your recalled verse");
        expect(cold).toHaveValue("");
        await waitFor(() => {
          expect(cold).toHaveFocus();
        });
      }
    },
  );

  it("is gone after a cold try and does not return on Try again", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard({ kind: "practice", verses: [notDueVerse] });
    await findVisibleCue();
    await recite(BAD_MISS);
    expect(cue()).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: /Try again/ }),
    );
    const link = await findVisibleLink();
    expect(link).toBeEnabled();
    expect(cue()).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();
    });
    expectNoProgressWrite();
  });

  it("is not added to a ••• Refresh, which already opens in the refresher", async () => {
    queryResults.set("verseMemory.verseDetail", overdueDetail);
    renderBoard({ refresh: true });
    const header = await screen.findByText(refresherHeader(1));
    await waitFor(() => {
      expect(header).toBeVisible();
    });
    expect(cue()).not.toBeInTheDocument();
    expect(
      queryCalls.filter(
        ([name, args]) => name === "verseMemory.verseDetail" && args !== "skip",
      ),
    ).toEqual([]);
  });
});
