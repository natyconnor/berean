import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddToPack } from "./add-to-pack";

const mocks = vi.hoisted(() => ({
  addVerse: vi.fn(),
  navigate: vi.fn(),
  packs: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.addVerse,
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: () => ({
    results: mocks.packs,
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: { packs: { listMine: "packs.listMine", addVerse: "packs.addVerse" } },
}));

const NOW = Date.UTC(2026, 9, 12, 18);
const ROMANS_8_28 = {
  book: "Romans",
  chapter: 8,
  startVerse: 28,
  endVerse: 28,
};

function chapterScope(book: string, chapter: number) {
  return {
    books: [book],
    chapterRanges: [{ book, startChapter: chapter, endChapter: chapter }],
    tags: [],
    tagMatchMode: "any" as const,
  };
}

const packSummary = {
  kind: "pack",
  verseCount: 2,
  learned: 0,
  mastered: 0,
  today: 0,
};
const passageSummary = {
  kind: "passage",
  status: "building",
  verseCount: 39,
  learnedVerses: 4,
  hasWorkToday: true,
  nextDueAt: NOW,
  masteryFraction: 0,
};

async function openPopover() {
  render(
    <AddToPack
      reference={ROMANS_8_28}
      now={NOW}
      returnTo="/memory?panel=verse%3Av1"
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Add to pack" }));
}

beforeEach(() => {
  mocks.addVerse.mockReset();
  mocks.addVerse.mockResolvedValue(null);
  mocks.packs = [];
});

describe("AddToPack", () => {
  it("lists every pack it can join, and passages that already hold it as disabled", async () => {
    mocks.packs = [
      {
        _id: "merced",
        name: "Merced Team",
        kind: "custom",
        lastOpenedAt: 1,
        summary: packSummary,
      },
      {
        _id: "rom8",
        name: "Romans 8",
        kind: "scope",
        scope: chapterScope("Romans", 8),
        lastOpenedAt: 1,
        summary: passageSummary,
      },
      {
        _id: "ps23",
        name: "Psalm 23",
        kind: "scope",
        scope: chapterScope("Psalms", 23),
        lastOpenedAt: 1,
        summary: passageSummary,
      },
    ];
    await openPopover();

    const newPack = await screen.findByRole("link", { name: "New pack…" });
    expect(newPack).toHaveAttribute(
      "href",
      "/memory/new?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%3Fpanel%3Dverse%253Av1",
    );
    expect(
      screen.getByRole("button", {
        name: /Romans 8\s*Already part of this passage/,
      }),
    ).toBeDisabled();
    expect(screen.queryByText("Psalm 23")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Merced Team" }));
    expect(mocks.addVerse).toHaveBeenCalledWith({
      id: "merced",
      ...ROMANS_8_28,
    });
    expect(
      await screen.findByRole("button", { name: /Merced Team\s*Added/ }),
    ).toBeDisabled();
  });

  it("says so when there are no packs, still offering New pack…", async () => {
    await openPopover();

    expect(await screen.findByText("No packs yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New pack…" })).toBeInTheDocument();
  });
});
