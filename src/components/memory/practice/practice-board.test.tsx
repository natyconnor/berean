import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { EsvChapterData } from "../../../../shared/esv-api";

import { PracticeBoard, type PracticeVerse } from "./practice-board";

const { queryResults, mutationMocks, navigateMock, fetchChaptersBatchMock } =
  vi.hoisted(() => ({
    queryResults: new Map<string, unknown>(),
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    navigateMock: vi.fn(),
    fetchChaptersBatchMock: vi.fn(),
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
  useAction: () => fetchChaptersBatchMock,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => queryResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch", getPassage: "esv.get" },
    packs: { recordUnifiedReview: "packs.recordUnifiedReview" },
    savedVerses: { listAll: "savedVerses.listAll" },
    verseMemory: { recordAttempt: "verseMemory.recordAttempt" },
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
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    queryResults.set("savedVerses.listAll", []);
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([{ chapter: 23, data: psalm23 }]);
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
    expect(screen.getByText("Passage")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Shuffle/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /^Psalm 23 \(From Memory band\)$/,
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

    expect(await screen.findByText("100% recalled.")).toBeVisible();
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
});
