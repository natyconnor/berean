import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import type { EsvChapterData } from "../../../../shared/esv-api";

import { PackView } from "./pack-view";

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
  useQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : queryResults.get(name),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
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

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch" },
    packs: {
      addVerse: "packs.addVerse",
      enrollLearning: "packs.enrollLearning",
      get: "packs.get",
      remove: "packs.remove",
      removeVerse: "packs.removeVerse",
      rename: "packs.rename",
      resolveMembers: "packs.resolveMembers",
      touch: "packs.touch",
    },
    savedVerses: {
      heartMany: "savedVerses.heartMany",
      listAll: "savedVerses.listAll",
    },
  },
}));

const PACK_ID = "pack_1";
const psalm23Scope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 23, endChapter: 23 }],
  tags: [],
  tagMatchMode: "any" as const,
};

const psalm23Text: EsvChapterData = {
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
  span: Omit<VerseSpan, "book" | "chapter"> & {
    status: MemberStatus;
    isDue?: boolean;
  },
) {
  return {
    verseRefId: `ref_${span.startVerse}_${span.endVerse}`,
    book: "Psalms",
    chapter: 23,
    startVerse: span.startVerse,
    endVerse: span.endVerse,
    status: span.status,
    learnStage: 0,
    stageReps: 0,
    ease: 2.5,
    intervalDays: 0,
    consecutiveCorrect: 0,
    lapses: 0,
    dueAt: Date.now() - 1000,
    isDue: span.isDue ?? false,
  };
}

function renderPack({
  kind = "scope",
  members,
}: {
  kind?: "scope" | "custom";
  members: ReturnType<typeof member>[];
}) {
  queryResults.set("packs.get", {
    _id: PACK_ID,
    name: "Psalm 23",
    kind,
    scope: kind === "scope" ? psalm23Scope : undefined,
    createdAt: 0,
    lastOpenedAt: 0,
  });
  queryResults.set("packs.resolveMembers", members);
  queryResults.set("savedVerses.listAll", []);

  return render(
    <TooltipProvider delayDuration={0}>
      <PackView packId={PACK_ID as never} />
    </TooltipProvider>,
  );
}

/** The pack's action row, so per-verse list actions can't be mistaken for it. */
function header() {
  return within(screen.getByRole("banner"));
}

describe("PackView", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([
      { chapter: 23, data: psalm23Text },
    ]);
    mutationMock("savedVerses.heartMany").mockResolvedValue({
      added: 1,
      skippedExact: 0,
      skippedOverlap: 0,
    });
  });

  it("queues the whole pack from Learn this pack, then opens the pack session", async () => {
    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 2, status: "new" }),
        member({ startVerse: 3, endVerse: 3, status: "learning" }),
      ],
    });

    const learn = header().getByRole("button", { name: /Learn this pack/ });
    // New members plus the learning ones already waiting.
    expect(learn).toHaveTextContent("2");
    expect(
      header().queryByRole("button", { name: /Continue Learning/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(learn);

    const enroll = mutationMock("packs.enrollLearning");
    expect(enroll).toHaveBeenCalledTimes(1);
    const [enrollArgs] = enroll.mock.calls[0] as [{ id: string; now: number }];
    expect(enrollArgs.id).toBe(PACK_ID);
    // The frozen session clock, not a live one: a `dueAt` ahead of the clock
    // the queues read would look like a finished learning session.
    expect(enrollArgs.now).toBe(getSessionNow());
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId/learn",
        params: { packId: PACK_ID },
      });
    });
  });

  it("keeps Continue Learning when nothing is new", () => {
    renderPack({
      members: [member({ startVerse: 1, endVerse: 6, status: "learning" })],
    });

    expect(
      header().getByRole("button", { name: /Continue Learning/ }),
    ).toBeInTheDocument();
    expect(
      header().queryByRole("button", { name: /Learn this pack/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Heart remaining only for an incomplete scope pack", () => {
    const { unmount } = renderPack({
      members: [member({ startVerse: 1, endVerse: 2, status: "new" })],
    });
    expect(
      header().getByRole("button", { name: "Heart remaining" }),
    ).toBeInTheDocument();
    unmount();

    // Every verse of Psalm 23 hearted: nothing left to fill in.
    const covered = renderPack({
      members: [member({ startVerse: 1, endVerse: 6, status: "reviewing" })],
    });
    expect(
      header().queryByRole("button", { name: "Heart remaining" }),
    ).not.toBeInTheDocument();
    covered.unmount();

    renderPack({
      kind: "custom",
      members: [member({ startVerse: 1, endVerse: 2, status: "new" })],
    });
    expect(
      header().queryByRole("button", { name: "Heart remaining" }),
    ).not.toBeInTheDocument();
  });

  it("hearts only the gaps from the Heart remaining dialog", async () => {
    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 2, status: "new" }),
        member({ startVerse: 3, endVerse: 3, status: "new" }),
      ],
    });

    await userEvent.click(
      header().getByRole("button", { name: "Heart remaining" }),
    );

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          /^Psalm 23 · 6 verses → \d+ new units? · 2 already hearted$/.test(
            element.textContent ?? "",
          ),
      ),
    ).toBeVisible();

    const confirm = await screen.findByRole("button", {
      name: /^Heart \d+ new units?$/,
    });
    await userEvent.click(confirm);

    const heartMany = mutationMock("savedVerses.heartMany");
    await waitFor(() => {
      expect(heartMany).toHaveBeenCalled();
    });

    const hearted = new Set<number>();
    for (const [args] of heartMany.mock.calls as Array<
      [{ spans: VerseSpan[]; now: number }]
    >) {
      for (const span of args.spans) {
        expect(span.book).toBe("Psalms");
        expect(span.chapter).toBe(23);
        for (let verse = span.startVerse; verse <= span.endVerse; verse += 1) {
          hearted.add(verse);
        }
      }
    }
    expect([...hearted].sort((a, b) => a - b)).toEqual([4, 5, 6]);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
