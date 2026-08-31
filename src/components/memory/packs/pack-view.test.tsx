import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { DAY_MS } from "@/lib/memory-scheduler";
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
      setUnifiedReview: "packs.setUnifiedReview",
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
    dueAt?: number;
    lastReviewedAt?: number;
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
    dueAt: span.dueAt ?? Date.now() - 1000,
    lastReviewedAt: span.lastReviewedAt,
    isDue: span.isDue ?? false,
  };
}

function renderPack({
  kind = "scope",
  members,
  unifiedReviewEnabled,
  heartHint,
  scope = psalm23Scope,
}: {
  kind?: "scope" | "custom";
  members: ReturnType<typeof member>[];
  unifiedReviewEnabled?: boolean;
  heartHint?: boolean;
  scope?: typeof psalm23Scope;
}) {
  queryResults.set("packs.get", {
    _id: PACK_ID,
    name: "Psalm 23",
    kind,
    scope: kind === "scope" ? scope : undefined,
    createdAt: 0,
    lastOpenedAt: 0,
    unifiedReviewEnabled,
  });
  queryResults.set("packs.resolveMembers", members);
  queryResults.set("savedVerses.listAll", []);

  return render(
    <TooltipProvider delayDuration={0}>
      <PackView packId={PACK_ID as never} heartHint={heartHint} />
    </TooltipProvider>,
  );
}

/** The pack's action row, so per-verse list actions can't be mistaken for it. */
function header() {
  return within(screen.getByRole("banner"));
}

/** The Verses section, where Add verses and Memorize whole passage live. */
function verses() {
  const heading = screen.getByRole("heading", { name: "Verses" });
  const section = heading.closest("section");
  if (!section) {
    throw new Error("Verses heading is not inside a section");
  }
  return within(section);
}

/** The mid-page Learn whole passage card (complete scopes still being learned). */
function packLearn() {
  const heading = screen.getByRole("heading", { name: "Learn whole passage" });
  const section = heading.closest("section");
  if (!section) {
    throw new Error("Learn whole passage heading is not inside a section");
  }
  return within(section);
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
      skippedInvalid: 0,
    });
  });

  it("lets unstarted units Learn, and names a session lock Tomorrow", () => {
    const now = getSessionNow();
    renderPack({
      members: [
        member({
          startVerse: 1,
          endVerse: 2,
          status: "new",
          // Live heartMany stamp can sit minutes ahead of the frozen UI clock.
          dueAt: now + 5 * 60 * 1000,
        }),
        member({
          startVerse: 3,
          endVerse: 3,
          status: "learning",
          dueAt: now + 8 * 60 * 60 * 1000,
          lastReviewedAt: now - 1000,
        }),
        member({
          startVerse: 4,
          endVerse: 4,
          status: "learning",
          dueAt: now,
          lastReviewedAt: now - 1000,
        }),
      ],
    });

    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByText(/Due today/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn" })).toBeEnabled();

    expect(screen.getByText("Learning · Tomorrow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tomorrow" })).toBeDisabled();

    expect(
      screen.getByRole("button", { name: "Continue Learning" }),
    ).toBeEnabled();
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
      packLearn().getByRole("button", { name: /Continue Learning/ }),
    ).toBeInTheDocument();
    expect(
      header().queryByRole("button", { name: /Continue Learning/ }),
    ).not.toBeInTheDocument();
    expect(
      header().queryByRole("button", { name: /Learn this pack/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Memorize whole passage only for an incomplete scope pack", async () => {
    const { unmount } = renderPack({
      members: [member({ startVerse: 1, endVerse: 2, status: "new" })],
    });
    const remaining = verses().getByRole("button", {
      name: "Memorize whole passage",
    });
    expect(remaining).toBeInTheDocument();
    expect(
      header().queryByRole("button", { name: "Memorize whole passage" }),
    ).not.toBeInTheDocument();
    expect(
      verses().getByRole("button", { name: "Add verses" }),
    ).toBeInTheDocument();
    await userEvent.hover(remaining);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Want to memorize this whole passage? Click here to automatically heart all the verses",
    );
    unmount();

    const empty = renderPack({ members: [] });
    const heartAll = verses().getByRole("button", {
      name: "Memorize whole passage",
    });
    expect(heartAll).toBeInTheDocument();
    expect(
      screen.getByText(
        /Memorize whole passage hearts every verse in this scope/,
      ),
    ).toBeInTheDocument();
    await userEvent.hover(heartAll);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Want to memorize this whole passage? Click here to automatically heart all the verses",
    );
    empty.unmount();

    // Every verse of Psalm 23 hearted: nothing left to fill in.
    const covered = renderPack({
      members: [member({ startVerse: 1, endVerse: 6, status: "reviewing" })],
    });
    expect(
      screen.queryByRole("button", {
        name: "Memorize whole passage",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add verses" }),
    ).not.toBeInTheDocument();
    covered.unmount();

    // Recited as one passage: a fresh heart would arrive as a new unit and
    // block the recitation, so the offer is withheld until it is switched off.
    const unified = renderPack({
      unifiedReviewEnabled: true,
      members: [member({ startVerse: 1, endVerse: 2, status: "reviewing" })],
    });
    expect(
      screen.queryByRole("button", {
        name: "Memorize whole passage",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add verses" }),
    ).not.toBeInTheDocument();
    unified.unmount();

    renderPack({
      kind: "custom",
      members: [member({ startVerse: 1, endVerse: 2, status: "new" })],
    });
    expect(
      screen.queryByRole("button", {
        name: "Memorize whole passage",
      }),
    ).not.toBeInTheDocument();
    expect(
      verses().getByRole("button", { name: "Add verses" }),
    ).toBeInTheDocument();
  });

  it("hearts only the gaps from the Memorize whole passage dialog", async () => {
    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 2, status: "new" }),
        member({ startVerse: 3, endVerse: 3, status: "new" }),
      ],
    });

    await userEvent.click(
      verses().getByRole("button", { name: "Memorize whole passage" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Memorize whole passage" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "3 of 6 verses are already hearted. If you want to memorize the rest of this chapter together, we can auto-heart the remaining verses as short memory passages so you can start learning.",
      ),
    ).toBeVisible();

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          /^Psalm 23 · 6 verses → \d+ new passages? · 2 already hearted$/.test(
            element.textContent ?? "",
          ),
      ),
    ).toBeVisible();

    const confirm = await screen.findByRole("button", {
      name: /^Heart \d+ new passages?$/,
    });
    await userEvent.click(confirm);

    const heartMany = mutationMock("savedVerses.heartMany");
    await waitFor(() => {
      expect(heartMany).toHaveBeenCalled();
    });
    const [heartArgs] = heartMany.mock.calls[0] as [
      { spans: VerseSpan[]; now: number },
    ];
    expect(heartArgs.now).toBe(getSessionNow());

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

  it("names these chapters when the scope spans more than one", async () => {
    renderPack({
      scope: {
        books: ["Psalms"],
        chapterRanges: [{ book: "Psalms", startChapter: 23, endChapter: 24 }],
        tags: [],
        tagMatchMode: "any",
      },
      members: [member({ startVerse: 1, endVerse: 2, status: "new" })],
    });

    await userEvent.click(
      verses().getByRole("button", { name: "Memorize whole passage" }),
    );

    expect(
      await screen.findByText(
        "2 of 16 verses are already hearted. If you want to memorize the rest of these chapters together, we can auto-heart the remaining verses as short memory passages so you can start learning.",
      ),
    ).toBeVisible();
  });

  it("points at Memorize whole passage after creating an empty scope pack", () => {
    renderPack({ members: [], heartHint: true });

    expect(
      verses().getByRole("button", { name: "Memorize whole passage" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Want to memorize this whole passage? Click here to automatically heart all the verses",
    );
  });

  it("promotes Learn whole passage after the scope is fully hearted", async () => {
    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 2, status: "new" }),
        member({ startVerse: 3, endVerse: 6, status: "new" }),
      ],
    });

    expect(
      header().queryByRole("button", { name: /Learn this pack/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add verses" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Starting one verse at a time splits the passage/),
    ).toBeInTheDocument();

    const learn = packLearn().getByRole("button", {
      name: /Learn whole passage/,
    });
    expect(learn).toHaveTextContent("2");

    await userEvent.click(learn);

    const enroll = mutationMock("packs.enrollLearning");
    expect(enroll).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId/learn",
        params: { packId: PACK_ID },
      });
    });
  });

  it("offers Learn whole passage instead of Recite until every unit has graduated", () => {
    const { unmount } = renderPack({
      members: [
        member({ startVerse: 1, endVerse: 3, status: "reviewing" }),
        member({ startVerse: 4, endVerse: 6, status: "learning" }),
      ],
    });

    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
    expect(
      packLearn().getByRole("button", { name: /Continue Learning/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/stays together/)).toBeInTheDocument();
    unmount();

    const lockedNow = getSessionNow();
    const locked = renderPack({
      members: [
        member({
          startVerse: 1,
          endVerse: 3,
          status: "learning",
          dueAt: lockedNow + 8 * 60 * 60 * 1000,
          lastReviewedAt: lockedNow - 1000,
        }),
        member({
          startVerse: 4,
          endVerse: 6,
          status: "learning",
          dueAt: lockedNow + 8 * 60 * 60 * 1000,
          lastReviewedAt: lockedNow - 1000,
        }),
      ],
    });
    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
    expect(
      packLearn().getByRole("button", { name: /Continue Learning · Tomorrow/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Come back tomorrow/)).toBeInTheDocument();
    locked.unmount();

    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 3, status: "reviewing" }),
        member({ startVerse: 4, endVerse: 6, status: "mastered" }),
      ],
    });

    expect(
      screen.getByRole("switch", { name: "Recite as one passage" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: "Learn whole passage" }),
    ).not.toBeInTheDocument();
  });

  it("hides Recite as one passage when only one hearted member is in scope", () => {
    renderPack({
      members: [member({ startVerse: 1, endVerse: 6, status: "reviewing" })],
    });

    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
  });

  it("hides Recite as one passage when the members are not a contiguous block", () => {
    renderPack({
      members: [
        member({ startVerse: 1, endVerse: 2, status: "reviewing" }),
        member({ startVerse: 5, endVerse: 6, status: "reviewing" }),
      ],
    });

    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Recite as one passage visible while unified is already on", () => {
    renderPack({
      unifiedReviewEnabled: true,
      members: [
        member({ startVerse: 1, endVerse: 2, status: "reviewing" }),
        member({ startVerse: 5, endVerse: 6, status: "reviewing" }),
      ],
    });

    expect(
      screen.getByRole("switch", { name: "Recite as one passage" }),
    ).toBeInTheDocument();
  });

  it("hides the recitation switch on a custom pack", () => {
    renderPack({
      kind: "custom",
      members: [member({ startVerse: 1, endVerse: 6, status: "reviewing" })],
    });

    expect(
      screen.queryByRole("switch", { name: "Recite as one passage" }),
    ).not.toBeInTheDocument();
  });

  it("confirms before syncing reviews, then opens the recitation", async () => {
    renderPack({
      members: [
        member({
          startVerse: 1,
          endVerse: 3,
          status: "reviewing",
          isDue: true,
        }),
        member({ startVerse: 4, endVerse: 6, status: "reviewing" }),
      ],
    });

    await userEvent.click(
      screen.getByRole("switch", { name: "Recite as one passage" }),
    );

    // The awkward part is named out loud: the unit that isn't due yet moves.
    expect(
      await screen.findByText(/Recite Psalm 23 as one passage\?/),
    ).toBeVisible();
    expect(screen.getByText(/1 of 2 units isn't due yet/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on and recite" }),
    );

    const setUnified = mutationMock("packs.setUnifiedReview");
    expect(setUnified).toHaveBeenCalledTimes(1);
    expect(setUnified).toHaveBeenCalledWith({
      id: PACK_ID,
      enabled: true,
      // The same frozen clock enrollLearning uses, so the pulled-forward
      // `dueAt` reads as due to the queues.
      now: getSessionNow(),
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId/review",
        params: { packId: PACK_ID },
      });
    });
  });

  it("reviews a unified pack as one due item, and switches back off without a dialog", async () => {
    renderPack({
      unifiedReviewEnabled: true,
      members: [
        member({
          startVerse: 1,
          endVerse: 3,
          status: "reviewing",
          isDue: true,
        }),
        member({
          startVerse: 4,
          endVerse: 6,
          status: "reviewing",
          isDue: true,
        }),
      ],
    });

    const review = header().getByRole("button", { name: /Review passage/ });
    expect(review).toHaveTextContent("1");
    expect(
      header().getByText(/one recitation · due today/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("switch", { name: "Recite as one passage" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const setUnified = mutationMock("packs.setUnifiedReview");
    expect(setUnified).toHaveBeenCalledWith({
      id: PACK_ID,
      enabled: false,
      now: getSessionNow(),
    });
  });

  it("reviews a due verse and practices one that is not due yet", async () => {
    const now = getSessionNow();
    renderPack({
      kind: "custom",
      members: [
        member({
          startVerse: 1,
          endVerse: 1,
          status: "reviewing",
          isDue: true,
          dueAt: now,
        }),
        member({
          startVerse: 2,
          endVerse: 2,
          status: "reviewing",
          isDue: false,
          dueAt: now + 4 * DAY_MS,
        }),
      ],
    });

    expect(header().getByRole("button", { name: /^Review/ })).toBeEnabled();
    expect(verses().getByRole("button", { name: "Review" })).toBeEnabled();
    expect(verses().getByRole("button", { name: "Practice" })).toBeEnabled();

    await userEvent.click(verses().getByRole("button", { name: "Review" }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/memory/review",
      search: {
        book: "Psalms",
        chapter: 23,
        startVerse: 1,
        endVerse: 1,
      },
    });

    await userEvent.click(verses().getByRole("button", { name: "Practice" }));
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/memory/practice",
      search: {
        book: "Psalms",
        chapter: 23,
        startVerse: 2,
        endVerse: 2,
      },
    });
  });

  it("offers Practice on individual verses when pack Review is disabled", async () => {
    const now = getSessionNow();
    renderPack({
      kind: "custom",
      members: [
        member({
          startVerse: 1,
          endVerse: 1,
          status: "reviewing",
          isDue: false,
          dueAt: now + DAY_MS,
        }),
        member({
          startVerse: 2,
          endVerse: 2,
          status: "mastered",
          isDue: false,
          dueAt: now + 3 * DAY_MS,
        }),
      ],
    });

    const review = header().getByRole("button", { name: /^Review$/ });
    expect(review).toBeDisabled();
    expect(
      verses().queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
    expect(verses().getAllByRole("button", { name: "Practice" })).toHaveLength(
      2,
    );

    await userEvent.hover(review.parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Nothing is due for review. Practice instead, or come back when a verse is scheduled.",
    );
  });

  it("explains a disabled Review when no verse has graduated yet", async () => {
    renderPack({
      members: [member({ startVerse: 1, endVerse: 2, status: "learning" })],
    });

    const review = header().getByRole("button", { name: /^Review$/ });
    expect(review).toBeDisabled();
    await userEvent.hover(review.parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Verses enter Review after they finish Learning.",
    );
  });
});
