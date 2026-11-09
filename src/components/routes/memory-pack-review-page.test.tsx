import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { EsvChapterData } from "../../../shared/esv-api";

import { MemoryPackPracticePage } from "./memory-pack-practice-page";
import { MemoryPackReviewPage } from "./memory-pack-review-page";
import type { Id } from "../../../convex/_generated/dataModel";

const {
  queryResults,
  actionMocks,
  mutationMocks,
  navigateMock,
  leftovers,
  router,
} = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  actionMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  navigateMock: vi.fn(),
  leftovers: { ready: true },
  router: {
    search: {},
    state: {},
    back: vi.fn(),
  },
}));

function actionMock(name: string) {
  const existing = actionMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  actionMocks.set(name, created);
  return created;
}

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("@/hooks/use-apply-leftover-held-attempts", () => ({
  useLeftoverHeldAttemptsReady: () => leftovers.ready,
  useApplyLeftoverHeldAttempts: () => {},
  resetApplyLeftoverHeldAttemptsForTests: () => {},
}));

vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : queryResults.get(name),
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) => actionMock(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => queryResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useCanGoBack: () => false,
  useRouter: () => ({ history: { back: router.back } }),
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ href: "/memory/pack_1/review", state: router.state }),
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/routes/memory_.$packId.review", () => ({
  Route: {
    useParams: () => ({ packId: "pack_1" }),
    useSearch: () => router.search,
  },
}));

vi.mock("@/routes/memory_.$packId.practice", () => ({
  Route: {
    useParams: () => ({ packId: "pack_1" }),
    useSearch: () => router.search,
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch", getPassage: "esv.get" },
    packs: {
      get: "packs.get",
      recordUnifiedReview: "packs.recordUnifiedReview",
      resolveMembers: "packs.resolveMembers",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
    verseMemory: { recordAttempt: "verseMemory.recordAttempt" },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      introduceNext: "passageMemory.introduceNext",
      recordAttempt: "passageMemory.recordAttempt",
      notePracticeRecital: "passageMemory.notePracticeRecital",
    },
  },
}));

const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [
    { number: 1, text: "The Lord is my shepherd; I shall not want." },
    { number: 2, text: "He makes me lie down in green pastures." },
    { number: 3, text: "He restores my soul." },
    { number: 4, text: "Even though I walk through the valley." },
    { number: 5, text: "You prepare a table before me." },
    { number: 6, text: "Surely goodness and mercy shall follow me." },
  ],
};

type MemberStatus = "new" | "learning" | "reviewing" | "mastered";

function member(
  startVerse: number,
  endVerse: number,
  status: MemberStatus = "reviewing",
) {
  return {
    verseRefId: `ref_${startVerse}_${endVerse}`,
    book: "Psalms",
    chapter: 23,
    startVerse,
    endVerse,
    status,
    learnStage: 3,
    stageReps: 0,
    ease: 2.3,
    intervalDays: 1,
    consecutiveCorrect: 1,
    lapses: 0,
    earlyReviewApplied: false,
    dueAt: getSessionNow() - 1000,
    isDue: true,
  };
}

function renderReview({
  unified,
  members = [member(1, 3), member(4, 6)],
  passage = null,
  page = <MemoryPackReviewPage />,
}: {
  unified: boolean;
  members?: ReturnType<typeof member>[];
  passage?: unknown;
  page?: ReactNode;
}) {
  queryResults.set("packs.get", {
    _id: "pack_1",
    name: "Psalm 23",
    kind: "scope",
    createdAt: 0,
    lastOpenedAt: 0,
    unifiedReviewEnabled: unified,
  });
  queryResults.set("packs.resolveMembers", members);
  queryResults.set("savedVerses.listAll", []);
  queryResults.set("savedVerses.listRecordingIds", []);
  queryResults.set("passageMemory.getForPack", passage);

  return render(<TooltipProvider delayDuration={0}>{page}</TooltipProvider>);
}

describe("MemoryPackReviewPage", () => {
  beforeEach(() => {
    queryResults.clear();
    actionMocks.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    leftovers.ready = true;
    router.search = {};
    router.state = {};
    router.back.mockReset();
    actionMock("esv.get").mockResolvedValue(psalm23);
    actionMock("esv.getChaptersBatch").mockResolvedValue([
      { chapter: 23, data: psalm23 },
    ]);
  });

  it("queues one card per due span while unified review is off", async () => {
    renderReview({ unified: false });

    expect(await screen.findByText("Verse 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:1–3 \(/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:4–6 \(/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/one recitation/)).not.toBeInTheDocument();
  });

  it("queues a single composite card while unified review is on", async () => {
    const { container } = renderReview({ unified: true });

    // Six verses across two memory units, recited as one passage.
    expect(
      await screen.findByText("6 verses · one recitation"),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="card-title"]'),
    ).toHaveTextContent("Psalm 23");
    // One rail row for the pack, none for the individual spans.
    expect(
      screen.getByRole("button", { name: /^Psalm 23 \(/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:1–3 \(/ }),
    ).not.toBeInTheDocument();
  });

  it("blocks the session instead of grading spans when a unified member is still learning", async () => {
    renderReview({
      unified: true,
      members: [member(1, 3), { ...member(4, 6, "learning"), learnStage: 1 }],
    });

    expect(
      await screen.findByRole("heading", {
        name: "Finish learning this pack first",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 unit is still learning/)).toBeInTheDocument();

    // No recitation card, and — critically — no per-span cards that would grade
    // through verseMemory.recordAttempt while the pack is flagged as one item.
    expect(screen.queryByText(/one recitation/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verse 1 of/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:1–3 \(/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Learn this pack" }),
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/memory/$packId/learn",
      params: { packId: "pack_1" },
    });
  });

  it("opens a reviewing passage only after leftover held misses are applied", async () => {
    leftovers.ready = false;
    const view = renderReview({ unified: false, passage: reviewingPassage() });
    expect(screen.queryByLabelText("Your recited passage")).toBeNull();

    leftovers.ready = true;
    view.rerender(
      <TooltipProvider delayDuration={0}>
        <MemoryPackReviewPage />
      </TooltipProvider>,
    );
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
  });

  it("recites a reviewing passage instead of a unified composite from hearts", async () => {
    renderReview({ unified: true, passage: reviewingPassage() });

    expect(
      await screen.findByRole("status", {
        name: "Session phase: Recite it all",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/one recitation/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verse 1 of/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:1–3 \(/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23 \(/ }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByLabelText("Your recited passage"),
    ).toBeInTheDocument();
  });

  describe("passage Refresh (S13)", () => {
    const BACK_TO_PASSAGE = "Back to Psalm 23";
    const notDue = () => ({
      ...reviewingPassage(),
      dueAt: getSessionNow() + 3 * 24 * 60 * 60 * 1000,
    });

    it("opens a due ••• Refresh in the refresher and goes back to the passage page", async () => {
      router.search = { refresh: true, return: "/memory/pack_1" };
      renderReview({ unified: false, passage: reviewingPassage() });

      expect(
        await screen.findByText("Refresh · First letters · 1 of 2"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/No hint text/)).toBeNull();
      await userEvent.click(
        screen.getByRole("button", { name: BACK_TO_PASSAGE }),
      );
      expect(navigateMock).toHaveBeenCalledWith({
        href: "/memory/pack_1",
        replace: true,
        state: { refreshedPassage: "pack_1" },
      });
      expect(router.back).not.toHaveBeenCalled();
      expect(
        mutationMock("passageMemory.recordAttempt"),
      ).not.toHaveBeenCalled();
    });

    it("opens a not-due ••• Refresh from Practice, back to the passage page", async () => {
      router.search = { refresh: true, return: "/memory/pack_1" };
      renderReview({
        unified: false,
        passage: notDue(),
        page: <MemoryPackPracticePage />,
      });

      expect(
        await screen.findByText("Refresh · First letters · 1 of 2"),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("button", { name: BACK_TO_PASSAGE }),
      );
      expect(navigateMock).toHaveBeenCalledWith({
        href: "/memory/pack_1",
        replace: true,
        state: { refreshedPassage: "pack_1" },
      });
    });

    it("leaves a summary Refresh by going back to the summary", async () => {
      router.search = { refresh: true, return: "/memory" };
      router.state = { summaryRefresh: true };
      renderReview({
        unified: false,
        passage: notDue(),
        page: <MemoryPackPracticePage />,
      });

      expect(
        await screen.findByText("Refresh · First letters · 1 of 2"),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole("button", { name: "Back to summary" }),
      );
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    describe("on a Learning passage (S14)", () => {
      /** Verses 1–3 learned, 4–6 being learned. */
      const learning = () => {
        const passage = reviewingPassage();
        return {
          ...passage,
          status: "building",
          dueAt: getSessionNow(),
          pieces: [
            passage.pieces[0],
            { ...passage.pieces[1], attachment: "learning", learnStage: 1 },
          ],
          frontierIndex: 1,
          ropePieceIndexes: [0],
        };
      };
      const LEARNED =
        "The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He restores my soul.";

      async function check(answer: string) {
        const box = await screen.findByLabelText("Your recited passage");
        await userEvent.click(box);
        await userEvent.paste(answer);
        await userEvent.click(
          screen.getByRole("button", { name: /Check answer/ }),
        );
        await screen.findByText(/recalled/);
      }

      function expectNothingSaved() {
        for (const [name, fn] of mutationMocks) {
          expect(fn, name).not.toHaveBeenCalled();
        }
      }

      beforeEach(() => {
        router.search = { refresh: true, return: "/memory/pack_1" };
      });

      it("runs First letters, From memory and Continue back to the passage page, saving nothing", async () => {
        renderReview({
          unified: false,
          passage: learning(),
          page: <MemoryPackPracticePage />,
        });
        expect(
          await screen.findByText("Refresh · First letters · 1 of 2"),
        ).toBeInTheDocument();
        expect(screen.getByText("Psalm 23:1–3")).toBeInTheDocument();
        await check(LEARNED);
        await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
        expect(
          await screen.findByText("Refresh · From memory · 2 of 2"),
        ).toBeInTheDocument();
        await check(LEARNED);
        expect(
          screen.getByText("Practice only, your progress didn't change."),
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
        expect(navigateMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).toHaveBeenCalledWith({
          href: "/memory/pack_1",
          replace: true,
          state: { refreshedPassage: "pack_1" },
        });
        expectNothingSaved();
      });

      it("goes back to the passage page on Back, saving nothing", async () => {
        renderReview({
          unified: false,
          passage: learning(),
          page: <MemoryPackPracticePage />,
        });
        await screen.findByText("Refresh · First letters · 1 of 2");
        await userEvent.click(
          screen.getByRole("button", { name: "Back to Psalm 23" }),
        );
        expect(navigateMock).toHaveBeenCalledWith({
          href: "/memory/pack_1",
          replace: true,
          state: { refreshedPassage: "pack_1" },
        });
        expectNothingSaved();
      });
    });

    it("shows a kept passage summary as it was, and ignores another pack's", async () => {
      const dueAt = getSessionNow() + 24 * 60 * 60 * 1000;
      const snapshot = {
        kind: "passage",
        packId: "pack_1",
        title: "Psalm 23",
        attempts: [
          {
            reference: {
              book: "Psalms",
              chapter: 23,
              startVerse: 1,
              endVerse: 3,
            },
            label: "Psalm 23",
            accuracy: 65,
            offerPractice: false,
          },
        ],
        dueAt,
        status: "reviewing",
      };
      router.state = { sessionSummary: snapshot, refreshedPassage: "pack_1" };
      const kept = renderReview({ unified: false, passage: notDue() });
      expect(
        screen.getByRole("heading", { name: "Review complete" }),
      ).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
      expect(
        await screen.findByRole("button", { name: "Refresh Psalm 23" }),
      ).toHaveFocus();
      expect(screen.queryByLabelText("Your recited passage")).toBeNull();
      kept.unmount();

      router.state = { sessionSummary: { ...snapshot, packId: "pack_2" } };
      renderReview({ unified: false, passage: reviewingPassage() });
      expect(
        await screen.findByLabelText("Your recited passage"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Review complete" }),
      ).toBeNull();
    });
  });
});

function reviewingPassage() {
  const now = getSessionNow();
  const pieces = [
    {
      index: 0,
      book: "Psalms",
      chapter: 23,
      startVerse: 1,
      endVerse: 3,
      sectionIndex: 0,
      attachment: "solid" as const,
      learnStage: 3,
      stageReps: 0,
    },
    {
      index: 1,
      book: "Psalms",
      chapter: 23,
      startVerse: 4,
      endVerse: 6,
      sectionIndex: 0,
      attachment: "solid" as const,
      learnStage: 3,
      stageReps: 0,
    },
  ];
  return {
    _id: "passage_1" as Id<"passageMemory">,
    packId: "pack_1" as Id<"packs">,
    status: "reviewing",
    pieces,
    addsOnDay: 0,
    ease: 2.3,
    intervalDays: 1,
    dueAt: now - 1000,
    consecutiveCorrect: 1,
    lapses: 0,
    stageReps: 0,
    createdAt: now,
    updatedAt: now,
    remainingIntroduces: 5,
    frontierIndex: 2,
    rehearsalStartIndex: 0,
    ropePieceIndexes: [0, 1],
  };
}
