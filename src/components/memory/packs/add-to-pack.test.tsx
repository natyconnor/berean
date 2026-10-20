import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { AddToPack } from "./add-to-pack";

const mocks = vi.hoisted(() => ({
  addVerse: vi.fn(),
  createAndMemorize: vi.fn(),
  navigate: vi.fn(),
  packs: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) =>
    name === "packs.createAndMemorize"
      ? mocks.createAndMemorize
      : mocks.addVerse,
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: () => ({
    results: mocks.packs,
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    packs: {
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
      createAndMemorize: "packs.createAndMemorize",
    },
  },
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
const MERCED = {
  _id: "merced",
  name: "Merced Team",
  kind: "custom",
  lastOpenedAt: 1,
  summary: packSummary,
};

function renderPicker(props: Partial<ComponentProps<typeof AddToPack>> = {}) {
  render(
    <TooltipProvider>
      <AddToPack reference={ROMANS_8_28} now={NOW} {...props} />
    </TooltipProvider>,
  );
}

async function openPopover(
  props: Partial<ComponentProps<typeof AddToPack>> = {
    returnTo: "/memory?panel=verse%3Av1",
  },
) {
  renderPicker(props);
  await userEvent.click(screen.getByRole("button", { name: "Add to pack" }));
}

beforeEach(() => {
  mocks.addVerse.mockReset();
  mocks.addVerse.mockResolvedValue(null);
  mocks.createAndMemorize.mockReset();
  mocks.createAndMemorize.mockResolvedValue({ packId: "hope" });
  mocks.packs = [];
});

describe("AddToPack", () => {
  it("lists every pack it can join, and passages that already hold it as disabled", async () => {
    mocks.packs = [
      MERCED,
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
      {
        _id: "rom8-pack",
        name: "Romans 8 unstarted",
        kind: "scope",
        scope: chapterScope("Romans", 8),
        lastOpenedAt: 1,
        summary: packSummary,
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
    expect(screen.queryByText("Romans 8 unstarted")).not.toBeInTheDocument();

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

  it("names a new pack right in the picker without a return path", async () => {
    await openPopover({});

    expect(
      screen.queryByRole("link", { name: "New pack…" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New pack…" }));
    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    const name = screen.getByRole("textbox", { name: "New pack name" });
    expect(name).toHaveFocus();
    await userEvent.type(name, "  Verses on hope {Enter}");

    expect(mocks.createAndMemorize).toHaveBeenCalledWith({
      name: "Verses on hope",
      spans: [ROMANS_8_28],
      now: expect.any(Number) as number,
    });
    expect(
      await screen.findByRole("button", { name: "New pack…" }),
    ).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the name and says so when making the pack fails", async () => {
    mocks.createAndMemorize.mockRejectedValue(new Error("offline"));
    await openPopover({});

    await userEvent.click(screen.getByRole("button", { name: "New pack…" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "New pack name" }),
      "Hope",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't make that pack. Please try again.",
    );
    expect(screen.getByRole("textbox", { name: "New pack name" })).toHaveValue(
      "Hope",
    );
  });

  it("is an icon button named for the verse, and remembers what it added", async () => {
    mocks.packs = [MERCED];
    renderPicker({ variant: "icon" });

    const trigger = screen.getByRole("button", {
      name: "Add Romans 8:28 to a pack",
    });
    await userEvent.click(trigger);
    await userEvent.click(
      await screen.findByRole("button", { name: "Merced Team" }),
    );
    await screen.findByRole("button", { name: /Merced Team\s*Added/ });

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Merced Team/ }),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(trigger);
    expect(
      await screen.findByRole("button", { name: /Merced Team\s*Added/ }),
    ).toBeDisabled();
    expect(mocks.addVerse).toHaveBeenCalledTimes(1);
  });
});
