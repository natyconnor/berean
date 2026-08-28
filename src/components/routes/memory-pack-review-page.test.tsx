import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { EsvChapterData } from "../../../shared/esv-api";

import { MemoryPackReviewPage } from "./memory-pack-review-page";

const { queryResults, actionMocks, mutationMocks, navigateMock } = vi.hoisted(
  () => ({
    queryResults: new Map<string, unknown>(),
    actionMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    navigateMock: vi.fn(),
  }),
);

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

vi.mock("convex/react", () => ({
  useQuery: (name: string) => queryResults.get(name),
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) => actionMock(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => queryResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
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
  Route: { useParams: () => ({ packId: "pack_1" }) },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch", getPassage: "esv.get" },
    packs: {
      get: "packs.get",
      recordUnifiedReview: "packs.recordUnifiedReview",
      resolveMembers: "packs.resolveMembers",
    },
    savedVerses: { listAll: "savedVerses.listAll" },
    verseMemory: { recordAttempt: "verseMemory.recordAttempt" },
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
}: {
  unified: boolean;
  members?: ReturnType<typeof member>[];
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

  return render(
    <TooltipProvider delayDuration={0}>
      <MemoryPackReviewPage />
    </TooltipProvider>,
  );
}

describe("MemoryPackReviewPage", () => {
  beforeEach(() => {
    queryResults.clear();
    actionMocks.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    actionMock("esv.get").mockResolvedValue(psalm23);
    actionMock("esv.getChaptersBatch").mockResolvedValue([
      { chapter: 23, data: psalm23 },
    ]);
  });

  it("queues one card per due span while unified review is off", async () => {
    renderReview({ unified: false });

    expect(await screen.findByText("Verse 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:1-3 \(/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:4-6 \(/ }),
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
      screen.queryByRole("button", { name: /^Psalm 23:1-3 \(/ }),
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
      screen.queryByRole("button", { name: /^Psalm 23:1-3 \(/ }),
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
});
